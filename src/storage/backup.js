/**
 * backup.js — a whole library in one file, and a safe way back in.
 *
 * ── THE PROBLEM THIS FIXES ────────────────────────────────────────
 * `repo.exportJSON()` has always been honest about what it is: it says
 * "everything except blobs" right there in its comment. What that means
 * in practice is that a backup taken before today carried every rating
 * and every note — and silently dropped every cover she had uploaded,
 * every photograph attached to a memory and every PDF. It looked like a
 * complete backup. Restoring it would have looked like a success. Her
 * pictures would simply have been gone.
 *
 * That is the worst kind of bug: one that only ever shows up on the day
 * you actually need the backup. So a .ponyolib is a ZIP, not a JSON —
 * text and bytes together, nothing left behind.
 *
 * ── WHAT IS IN THE ARCHIVE ────────────────────────────────────────
 *   manifest.json    format, version, when, and counts to check against
 *   books.json       every book record, each with its bookKey
 *   settings.json    her preferences, minus anything purely transient
 *   covers.json      cover overrides, addressed by bookKey
 *   files.json       one entry per binary: role, name, type, size, path
 *   files/<id>.<ext> the bytes themselves
 *   README.txt       what this file is, for whoever opens it in 2031
 *
 * ── WHY bookKey AND NOT id ────────────────────────────────────────
 * Book ids are generated at seed time from the clock and a random
 * suffix, so the same book has a DIFFERENT id in every installation.
 * Matching on id across machines would therefore match nothing, and a
 * restore would duplicate the entire library. `bookKey(title, author)`
 * — the same key the catalogue already uses to merge duplicates — is
 * the same everywhere, so it is the identity that crosses installs.
 *
 * Within one installation the existing ids are kept exactly as they
 * are: a restore that renumbered everything would be a migration, not
 * a restore.
 *
 * ── NOTHING HERE TOUCHES STORAGE DIRECTLY ─────────────────────────
 * This module decides WHAT should happen. `repo.applyRestore()` is the
 * only thing that writes, and it is handed a finished list. That split
 * is what makes the diff we show her trustworthy: the plan she approves
 * is literally the plan that runs.
 */

import { createZip, readZip } from '../utils/zip.js';
import { makeBook, newId, keyOf } from '../data/models.js';
import { bookKey } from '../utils/text.js';

export const BACKUP_FORMAT = 'ponyo-library';
export const BACKUP_KIND = 'backup';

/**
 * Version 1 was the metadata-only JSON export, which still exists and
 * still works. Version 2 is the complete archive.
 */
export const BACKUP_VERSION = 2;
export const BACKUP_EXTENSION = '.ponyolib';
export const BACKUP_MIME = 'application/zip';

const MANIFEST = 'manifest.json';
const BOOKS = 'books.json';
const SETTINGS = 'settings.json';
const COVERS = 'covers.json';
const FILES = 'files.json';
const FILE_DIR = 'files/';
const README = 'README.txt';

/** Every entry a valid archive must contain. */
const REQUIRED = [MANIFEST, BOOKS, SETTINGS, COVERS, FILES];

/**
 * Settings that describe the moment rather than the library.
 *
 * `hasEntered` is "has she walked past the landing page in this
 * session", and `moodCollapsed` is whether a card is folded shut.
 * Carrying either into a backup would mean restoring somebody's
 * scroll position, which is not data.
 */
const TRANSIENT_SETTINGS = new Set(['hasEntered', 'moodCollapsed']);

/** The book fields a restore is actually about. Used for the diff. */
const COMPARED_FIELDS = [
  ['status', 'shelf'],
  ['rating', 'rating'],
  ['favourite', 'favourite'],
  ['notes', 'notes'],
  ['thoughts', 'thoughts'],
  ['tags', 'tags'],
  ['progress', 'progress'],
  ['memories', 'memories'],
  ['coverId', 'cover'],
  ['attachmentIds', 'attachments'],
  ['startedAt', 'dates'],
  ['finishedAt', 'dates'],
];

/* ────────────────────────────── helpers ─────────────────────────── */

/** A file id, reduced to characters that are safe in a zip path. */
function safeSegment(value, fallback = 'file') {
  const clean = String(value ?? '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+/, '');
  return clean || fallback;
}

/** Guess a sensible extension so the archive is browsable by hand. */
function extensionFor(record) {
  const fromName = String(record.name ?? '').match(/\.([A-Za-z0-9]{1,8})$/);
  if (fromName) return `.${fromName[1].toLowerCase()}`;
  const type = String(record.type ?? '').toLowerCase();
  if (type === 'image/jpeg') return '.jpg';
  if (type === 'image/png') return '.png';
  if (type === 'image/webp') return '.webp';
  if (type === 'image/gif') return '.gif';
  if (type === 'image/avif') return '.avif';
  if (type === 'application/pdf') return '.pdf';
  if (type === 'image/svg+xml') return '.svg';
  return '.bin';
}

/**
 * A path is only acceptable if it stays inside files/ and contains no
 * traversal. An archive is untrusted input even when we wrote it.
 */
function isSafeFilePath(path) {
  const value = String(path ?? '');
  if (!value.startsWith(FILE_DIR)) return false;
  if (value.includes('..') || value.includes('\\') || value.includes('//')) return false;
  if (value.startsWith('/') || /^[A-Za-z]:/.test(value)) return false;
  return /^files\/[A-Za-z0-9._-]+$/.test(value);
}

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * A timestamped filename, to the second.
 *
 * Two things ride on this. Backups sort chronologically in a folder,
 * and — because the seconds are in there — saving twice never lands on
 * the same name. The browser's own download handling refuses to
 * overwrite regardless (it appends " (1)"), so between the two there is
 * no path by which a new backup destroys an older one.
 */
export function backupFilename(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `ponyo-library-${stamp}${BACKUP_EXTENSION}`;
}

/** Bytes, in words. */
export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/* ──────────────────────────── building ──────────────────────────── */

const READ_ME = `Ponyo's Little Library — backup
================================

This is a ZIP file. Rename it to .zip and you can open it with anything.

  manifest.json   what this backup is, when it was made, and how many
                  of each thing it should contain
  books.json      every book: shelf, rating, notes, tags, progress,
                  dates, and the bookKey used to match it on restore
  settings.json   appearance and reading preferences
  covers.json     covers that were replaced by hand
  files.json      an index of the binary files below
  files/          uploaded covers, memory photographs, attachments

Nothing in here is encrypted and nothing phones home. To restore it,
open the library and use Settings -> Restore from a backup.
`;

/**
 * Build a complete backup of the library.
 *
 * ── "WRITE THROUGH A TEMPORARY OBJECT" ────────────────────────────
 * A browser page cannot write a temp file and rename it, but it can do
 * the thing that rule is actually for: never hand over a half-made
 * artefact. The archive is assembled in memory, then opened and
 * verified, and only a Blob that survived verification is ever offered
 * as a download. A failure at any point throws, and she is told —
 * rather than quietly receiving a broken file she will trust for years.
 *
 * @param {Object} repo
 * @param {Object} [options]
 * @param {Date}   [options.date]
 * @param {Function} [options.onProgress] (stage: string, done, total) => void
 * @returns {Promise<{blob: Blob, filename: string, manifest: Object}>}
 */
export async function buildBackup(repo, { date = new Date(), onProgress } = {}) {
  onProgress?.('reading', 0, 1);
  const snap = await repo.snapshot();

  // bookKey travels with every record, and is what restore matches on.
  const keyById = new Map(snap.books.map((book) => [book.id, keyOf(book)]));
  const books = snap.books.map((book) => ({ ...book, bookKey: keyOf(book) }));

  const settings = {};
  for (const [key, value] of Object.entries(snap.settings)) {
    if (!TRANSIENT_SETTINGS.has(key)) settings[key] = value;
  }

  // Cover overrides are keyed by book id, which is install-specific, so
  // the archive addresses them by bookKey instead.
  const covers = snap.covers.map((cover) => ({
    bookKey: keyById.get(cover.id) ?? '',
    url: cover.url ?? '',
    fileId: cover.fileId ?? '',
    source: cover.source ?? '',
    updatedAt: cover.updatedAt ?? '',
  }));

  const files = [];
  const binaries = [];
  let bytes = 0;

  for (const record of snap.files) {
    if (!record?.id || !record.blob) continue;
    const path = `${FILE_DIR}${safeSegment(record.id)}${extensionFor(record)}`;
    const size = record.blob.size ?? record.size ?? 0;
    files.push({
      id: record.id,
      // bookId is install-specific; bookKey is not.
      bookKey: keyById.get(record.bookId) ?? '',
      role: record.role ?? 'attachment',
      name: record.name ?? 'untitled',
      type: record.type ?? 'application/octet-stream',
      size,
      path,
      addedAt: record.addedAt ?? '',
    });
    // Covers and photographs are already compressed; deflating a JPEG
    // spends time to make it very slightly bigger.
    binaries.push({ name: path, data: record.blob, compress: false });
    bytes += size;
  }

  const manifest = {
    format: BACKUP_FORMAT,
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    createdAt: date.toISOString(),
    app: "Ponyo's Little Library",
    counts: {
      books: books.length,
      settings: Object.keys(settings).length,
      covers: covers.length,
      files: files.length,
      bytes,
    },
  };

  const entries = [
    { name: MANIFEST, data: JSON.stringify(manifest, null, 2) },
    { name: BOOKS, data: JSON.stringify(books) },
    { name: SETTINGS, data: JSON.stringify(settings, null, 2) },
    { name: COVERS, data: JSON.stringify(covers, null, 2) },
    { name: FILES, data: JSON.stringify(files, null, 2) },
    { name: README, data: READ_ME },
    ...binaries,
  ];

  const blob = await createZip(entries, {
    date,
    type: BACKUP_MIME,
    onProgress: (done, total) => onProgress?.('writing', done, total),
  });

  // Open what we just wrote and check it before calling it a backup.
  onProgress?.('verifying', 0, 1);
  await verifyBackup(blob, { expect: manifest });
  onProgress?.('done', 1, 1);

  return { blob, filename: backupFilename(date), manifest };
}

/* ─────────────────────────── validating ─────────────────────────── */

export class BackupError extends Error {
  constructor(message, { hint = '' } = {}) {
    super(message);
    this.name = 'BackupError';
    this.hint = hint;
  }
}

function assertManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new BackupError('The backup has no readable manifest.');
  }
  if (manifest.format !== BACKUP_FORMAT) {
    throw new BackupError('That archive was not made by this library.');
  }
  if (manifest.kind && manifest.kind !== BACKUP_KIND) {
    throw new BackupError(`That archive is a "${manifest.kind}", not a backup.`);
  }
  const version = Number(manifest.version);
  if (!Number.isFinite(version) || version < 2) {
    throw new BackupError('That backup is from an older format.', {
      hint: 'A metadata-only .json export can still be brought in with "Paste in more books".',
    });
  }
  if (version > BACKUP_VERSION) {
    throw new BackupError(
      `That backup was made by a newer version of the library (format ${version}).`,
      { hint: 'Update the library first, then restore.' },
    );
  }
  if (!manifest.counts || typeof manifest.counts !== 'object') {
    throw new BackupError('The backup manifest is incomplete.');
  }
}

/**
 * Read and check an archive without changing anything.
 *
 * Validation is layered, cheapest first, so a file that is simply the
 * wrong thing fails immediately with a sentence she can act on:
 *
 *   1. is it a ZIP at all
 *   2. does it hold a manifest we recognise, at a version we support
 *   3. are all the required entries present and parseable
 *   4. do the record counts match what the manifest claims
 *   5. is every file in files.json actually in the archive, at the
 *      right size, with a path that stays inside files/
 *   6. (deep) do the bytes still match their checksums
 *
 * @param {Blob} blob
 * @param {Object} [options]
 * @param {boolean} [options.deep]  read every byte and verify every CRC
 * @param {Object} [options.expect] a manifest the archive must agree with
 * @returns {Promise<Object>} the parsed payload
 */
export async function verifyBackup(blob, { deep = true, expect = null } = {}) {
  let zip;
  try {
    zip = await readZip(blob);
  } catch (error) {
    throw new BackupError(error.message || 'That file could not be opened.', {
      hint: 'A backup from this library is a .ponyolib file.',
    });
  }

  for (const name of REQUIRED) {
    if (!zip.has(name)) {
      throw new BackupError(`The backup is incomplete — "${name}" is missing.`);
    }
  }

  let manifest;
  try {
    manifest = await zip.json(MANIFEST);
  } catch (error) {
    throw new BackupError(error.message);
  }
  assertManifest(manifest);

  let books;
  let settings;
  let covers;
  let files;
  try {
    books = await zip.json(BOOKS);
    settings = await zip.json(SETTINGS);
    covers = await zip.json(COVERS);
    files = await zip.json(FILES);
  } catch (error) {
    throw new BackupError(error.message);
  }

  if (!Array.isArray(books)) throw new BackupError('The book list in the backup is damaged.');
  if (!Array.isArray(covers)) throw new BackupError('The cover list in the backup is damaged.');
  if (!Array.isArray(files)) throw new BackupError('The file index in the backup is damaged.');
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new BackupError('The settings in the backup are damaged.');
  }

  // The manifest is a claim; the entries are the evidence. Disagreement
  // means the archive was edited or written by something broken.
  const counts = manifest.counts ?? {};
  if (Number(counts.books) !== books.length) {
    throw new BackupError(
      `The backup says it holds ${counts.books} books but contains ${books.length}.`,
    );
  }
  if (Number(counts.files) !== files.length) {
    throw new BackupError(
      `The backup says it holds ${counts.files} files but its index lists ${files.length}.`,
    );
  }
  if (counts.covers !== undefined && Number(counts.covers) !== covers.length) {
    throw new BackupError('The cover count in the backup does not match its manifest.');
  }

  for (const entry of files) {
    if (!entry || typeof entry !== 'object') {
      throw new BackupError('The file index in the backup is damaged.');
    }
    if (!isSafeFilePath(entry.path)) {
      throw new BackupError(`The backup contains an unsafe file path ("${entry.path}").`);
    }
    if (!zip.has(entry.path)) {
      throw new BackupError(`The backup is missing one of its files (${entry.name || entry.path}).`);
    }
    const stored = zip.sizeOf(entry.path);
    if (Number(entry.size) !== stored) {
      throw new BackupError(`"${entry.name || entry.path}" is the wrong size in the backup.`);
    }
  }

  if (expect) {
    const claimed = expect.counts ?? {};
    if (Number(claimed.books) !== books.length || Number(claimed.files) !== files.length) {
      throw new BackupError('The archive we just wrote does not match what went into it.');
    }
  }

  // Reading an entry verifies its CRC32 on the way out, so this is the
  // step that distinguishes "the archive is well-formed" from "the
  // bytes are intact".
  if (deep) {
    for (const name of [...REQUIRED, ...files.map((f) => f.path)]) {
      await zip.bytes(name);
    }
  }

  return { zip, manifest, books, settings, covers, files };
}

/**
 * Turn an archive into a payload ready for planning, with the blobs
 * pulled out. Validates first; throws BackupError if anything is wrong.
 */
export async function readBackup(blob, { deep = true } = {}) {
  const parsed = await verifyBackup(blob, { deep });
  const { zip } = parsed;

  const blobs = new Map();
  for (const entry of parsed.files) {
    blobs.set(entry.id, await zip.blob(entry.path, entry.type));
  }

  return {
    manifest: parsed.manifest,
    books: parsed.books,
    settings: parsed.settings,
    covers: parsed.covers,
    files: parsed.files,
    blobs,
  };
}

/**
 * Recognise the old metadata-only export, so the UI can say something
 * useful instead of "not a ZIP archive".
 */
export function looksLikeLegacyExport(text) {
  try {
    const data = JSON.parse(text);
    return data?.format === BACKUP_FORMAT && Array.isArray(data.books);
  } catch {
    return false;
  }
}

/* ──────────────────────────── planning ─────────────────────────── */

/** The key an archived record should be matched on. */
const keyForIncoming = (book) => (
  typeof book.bookKey === 'string' && book.bookKey
    ? book.bookKey
    : bookKey(book.title, book.author)
);

/** Which of the fields that matter actually differ. */
function changedFields(existing, incoming) {
  const labels = new Set();
  for (const [field, label] of COMPARED_FIELDS) {
    if (!same(existing[field], incoming[field])) labels.add(label);
  }
  return Array.from(labels);
}

/**
 * Work out exactly what a restore would do, without doing any of it.
 *
 * The object returned here is both what she is shown and what gets
 * executed, so the summary cannot drift out of step with the outcome.
 *
 * @param {Object} repo
 * @param {Object} payload  from readBackup()
 * @param {'merge'|'replace'} mode
 */
export function planRestore(repo, payload, mode = 'merge') {
  const existing = repo.all();
  const byKey = new Map();
  for (const book of existing) {
    const key = keyOf(book);
    // First one wins, matching how the catalogue dedupes.
    if (!byKey.has(key)) byKey.set(key, book);
  }

  const warnings = [];
  const newBooks = [];
  const updatedBooks = [];
  let unchangedBooks = 0;

  /** bookKey -> the id this book will have after the restore. */
  const idForKey = new Map();
  const seen = new Set();
  const usedIds = new Set(mode === 'replace' ? [] : existing.map((b) => b.id));
  const removeFileIds = [];

  for (const incoming of payload.books) {
    const key = keyForIncoming(incoming);
    if (!incoming?.title) { warnings.push('A book with no title was skipped.'); continue; }
    if (seen.has(key)) {
      warnings.push(`The backup holds "${incoming.title}" twice; the first copy was used.`);
      continue;
    }
    seen.add(key);

    const match = mode === 'replace' ? undefined : byKey.get(key);

    if (match) {
      idForKey.set(key, match.id);
      const changes = changedFields(match, incoming);
      if (changes.length) {
        updatedBooks.push({
          key, id: match.id, title: incoming.title, author: incoming.author, changes,
        });
      } else {
        unchangedBooks += 1;
      }

      // Anything the existing record pointed at that the backup does not
      // would otherwise sit in storage forever with nothing referencing it.
      const kept = new Set([
        incoming.coverId,
        ...(Array.isArray(incoming.attachmentIds) ? incoming.attachmentIds : []),
        ...(Array.isArray(incoming.memories) ? incoming.memories.map((m) => m?.fileId) : []),
      ].filter(Boolean));
      const held = [
        match.coverId,
        ...(match.attachmentIds ?? []),
        ...((match.memories ?? []).map((m) => m?.fileId)),
        repo.getCover?.(match.id)?.fileId,
      ].filter(Boolean);
      for (const id of held) if (!kept.has(id)) removeFileIds.push(id);
    } else {
      // A fresh book keeps its archived id unless that id is already
      // taken here, which only happens when restoring onto itself.
      const id = incoming.id && !usedIds.has(incoming.id) ? incoming.id : newId();
      usedIds.add(id);
      idForKey.set(key, id);
      newBooks.push({ key, id, title: incoming.title, author: incoming.author });
    }
  }

  // Replace is the only mode that can take books away.
  const removedBooks = mode === 'replace'
    ? existing.filter((book) => !seen.has(keyOf(book)))
      .map((book) => ({ id: book.id, title: book.title, author: book.author }))
    : [];

  // Files, described by what she would actually notice.
  //
  // The three buckets are deliberately not "every file in the archive".
  // Restoring a backup on top of itself rewrites the same bytes under the
  // same id to the same book, and calling that a replacement would make
  // an identical restore look like it was about to change three of her
  // pictures. A file already attached here IS this file — file ids are
  // stable within an installation — so it is unchanged.
  const filesAdded = [];
  const filesReplaced = [];
  const filesUnchanged = [];
  let fileBytes = 0;
  for (const entry of payload.files) {
    fileBytes += Number(entry.size) || 0;
    const targetId = entry.bookKey ? idForKey.get(entry.bookKey) : '';
    const target = targetId ? repo.get(targetId) : null;
    const descriptor = {
      id: entry.id,
      name: entry.name,
      role: entry.role,
      size: Number(entry.size) || 0,
      book: target?.title ?? '',
    };

    const attachedHere = Boolean(target) && (
      target.coverId === entry.id
      || (target.attachmentIds ?? []).includes(entry.id)
      || (target.memories ?? []).some((m) => m?.fileId === entry.id)
    );

    if (attachedHere) filesUnchanged.push(descriptor);
    // A cover landing on a book that already shows a different picture is
    // the one case where she loses something she can see.
    else if (entry.role === 'cover' && target?.coverId) filesReplaced.push(descriptor);
    else filesAdded.push(descriptor);

    if (entry.bookKey && !idForKey.has(entry.bookKey)) {
      warnings.push(`"${entry.name}" belongs to a book that is not in this backup; it will be kept but unattached.`);
    }
  }

  // Settings.
  const current = repo.allSettings();
  const settingsChanged = [];
  const settingsAdded = [];
  for (const [key, value] of Object.entries(payload.settings ?? {})) {
    if (TRANSIENT_SETTINGS.has(key)) continue;
    if (!(key in current)) settingsAdded.push({ key, to: value });
    else if (!same(current[key], value)) settingsChanged.push({ key, from: current[key], to: value });
  }

  return {
    mode,
    createdAt: payload.manifest?.createdAt ?? '',
    newBooks,
    updatedBooks,
    unchangedBooks,
    removedBooks,
    filesAdded,
    filesReplaced,
    filesUnchanged,
    fileBytes,
    settingsChanged,
    settingsAdded,
    removeFileIds: Array.from(new Set(removeFileIds)),
    idForKey,
    warnings: Array.from(new Set(warnings)),
    /** True when running this would change precisely nothing. */
    get isNoop() {
      return !this.newBooks.length && !this.updatedBooks.length
        && !this.removedBooks.length && !this.filesAdded.length
        && !this.filesReplaced.length && !this.settingsChanged.length
        && !this.settingsAdded.length;
    },
  };
}

/* ──────────────────────────── applying ─────────────────────────── */

/**
 * Turn a plan into the exact records that will be written.
 * Pure: hand it the same plan twice and get the same writes twice.
 */
function writesFor(payload, plan) {
  const { idForKey, mode } = plan;
  const skipped = new Set();

  const books = [];
  const seen = new Set();
  for (const incoming of payload.books) {
    const key = keyForIncoming(incoming);
    if (!incoming?.title || seen.has(key)) { skipped.add(key); continue; }
    seen.add(key);
    const id = idForKey.get(key);
    if (!id) continue;
    // makeBook keeps the archived timestamps and drops anything it does
    // not recognise, so bookKey never leaks into a stored record.
    books.push(makeBook({ ...incoming, id }));
  }

  const files = [];
  for (const entry of payload.files) {
    const blob = payload.blobs.get(entry.id);
    if (!blob) continue;
    files.push({
      id: entry.id,
      bookId: (entry.bookKey && idForKey.get(entry.bookKey)) || '',
      name: entry.name ?? 'untitled',
      type: entry.type ?? 'application/octet-stream',
      size: blob.size ?? (Number(entry.size) || 0),
      role: entry.role ?? 'attachment',
      blob,
      addedAt: entry.addedAt || new Date().toISOString(),
    });
  }

  const covers = [];
  for (const cover of payload.covers) {
    const id = cover.bookKey ? idForKey.get(cover.bookKey) : '';
    if (!id) continue;
    if (!cover.url && !cover.fileId) continue;
    covers.push({
      id,
      url: cover.url ?? '',
      fileId: cover.fileId ?? '',
      source: cover.source || 'manual',
      updatedAt: cover.updatedAt || new Date().toISOString(),
    });
  }

  const settings = {};
  for (const [key, value] of Object.entries(payload.settings ?? {})) {
    if (TRANSIENT_SETTINGS.has(key)) continue;
    settings[key] = value;
  }

  return { mode, books, files, covers, settings, removeFileIds: plan.removeFileIds };
}

/**
 * Perform a restore.
 *
 * ── THE SAFETY NET IS NOT OPTIONAL ────────────────────────────────
 * Before a single record is written, a complete backup of the library
 * as it stands right now is built AND verified. If that snapshot cannot
 * be made, or cannot be read back, the restore is abandoned untouched —
 * because a restore with no way back is not a feature, it is a coin
 * toss with her library.
 *
 * The snapshot Blob comes back in the result so the UI can offer it as
 * a download, which is what makes the undo real rather than theoretical.
 *
 * @param {Object} repo
 * @param {Object} payload   from readBackup()
 * @param {Object} plan      from planRestore()
 * @param {Object} [options]
 * @param {Function} [options.onProgress] (stage, done, total) => void
 */
export async function applyRestore(repo, payload, plan, { onProgress } = {}) {
  onProgress?.('snapshot', 0, 1);

  let snapshot;
  try {
    snapshot = await buildBackup(repo, { date: new Date() });
  } catch (error) {
    throw new BackupError(
      `The restore was cancelled because a safety copy of your current library could not be made (${error.message}).`,
      { hint: 'Nothing has been changed.' },
    );
  }

  onProgress?.('applying', 0, 1);
  const writes = writesFor(payload, plan);

  let result;
  try {
    result = await repo.applyRestore(writes);
  } catch (error) {
    // The snapshot exists and is verified, and this is the exact moment
    // it is for — so it travels with the error. Throwing a bare failure
    // here would leave the only copy of her pre-restore library sitting
    // in a local variable in this function, about to be collected.
    const failure = new BackupError(
      `The restore stopped partway through (${error.message}).`,
      { hint: 'A verified copy of your library from just before the restore can still be saved.' },
    );
    failure.snapshot = snapshot;
    failure.partial = true;
    throw failure;
  }

  onProgress?.('done', 1, 1);
  return {
    ...result,
    mode: plan.mode,
    snapshot,
    booksAfter: repo.count(),
  };
}
