/**
 * migrate.js — moving her library out of the browser and onto the disk,
 * once, carefully, and never at the cost of the copy she already has.
 *
 * ── THE ONE RULE ──────────────────────────────────────────────────
 * IndexedDB is a SOURCE. It is read, and it is never written to and
 * never cleared by anything in this file. If every line below failed in
 * the worst possible order, her library would still be exactly where it
 * was this morning. That is the property this module is built around,
 * and the reason the browser database is left in place afterwards even
 * though nothing will read it again.
 *
 * ── THE FOUR OUTCOMES ─────────────────────────────────────────────
 *
 *   adopted   library.json already exists and is finished. Nothing to
 *             do; the desktop app opens it.
 *   fresh     no library.json, and nothing in IndexedDB worth moving.
 *             A new, empty filesystem library is created and the app
 *             seeds it the usual way.
 *   migrated  no library.json, and a real library in IndexedDB. A
 *             verified .ponyolib is written first, then the records,
 *             then everything is read back off the disk and compared
 *             against what it came from.
 *   failed    anything went wrong. The half-written filesystem output
 *             is deleted, the .ponyolib safety copy is KEPT, and the
 *             error is thrown.
 *
 * ── WHY THE MARKER FILE EXISTS ────────────────────────────────────
 * "library.json exists" cannot mean "migration finished", because the
 * adapter rewrites library.json after every batch — a crash halfway
 * through would leave a complete-LOOKING document holding half a
 * library, and the next launch would adopt it and call it done. So a
 * marker is written before the first byte and only moved to `complete`
 * after verification passes. A marker still saying `running` at startup
 * is proof of a migration that died, and its output is thrown away
 * rather than trusted.
 */

import { COLLECTIONS } from './adapter.js';
import { createIndexedDbAdapter } from './indexeddb-adapter.js';
import { createFsAdapter, writeFileAtomic, LIBRARY_FILE, FILES_DIR } from './fs-adapter.js';
import { buildBackup } from './backup.js';

export const MARKER_FILE = 'migration.json';
export const BACKUPS_DIR = 'backups';

/** Thrown when a migration could not be completed. The app shows this. */
export class MigrationError extends Error {
  constructor(message, { hint = '', cause = null } = {}) {
    super(message);
    this.name = 'MigrationError';
    this.hint = hint;
    this.cause = cause;
  }
}

const join = (...parts) => parts.filter(Boolean).join('/');

async function readJson(fs, path) {
  if (!(await fs.exists(path))) return null;
  try {
    return JSON.parse(await fs.readTextFile(path));
  } catch {
    return null;
  }
}

/**
 * What does the disk say about previous attempts?
 *
 * @returns {Promise<{status: 'absent'|'incomplete'|'complete', marker: Object|null}>}
 */
export async function readMigrationState(fs, root = '') {
  const marker = await readJson(fs, join(root, MARKER_FILE));

  if (marker?.status === 'complete') return { status: 'complete', marker };
  if (marker?.status === 'running') return { status: 'incomplete', marker };

  // No marker at all. If there is nonetheless a library here, it is a
  // real one — adopt it. Deleting a library.json this module did not
  // write mid-migration is never the right move.
  if (await fs.exists(join(root, LIBRARY_FILE))) {
    return { status: 'complete', marker: null };
  }
  return { status: 'absent', marker: null };
}

async function writeMarker(fs, root, marker) {
  await writeFileAtomic(fs, join(root, MARKER_FILE), JSON.stringify(marker, null, 2), { text: true });
}

/**
 * Delete the filesystem library, and nothing else.
 *
 * `backups/` is deliberately untouched: the pre-migration archive is a
 * complete, verified artifact rather than incomplete output, and it is
 * the one thing that would matter if everything else were lost.
 */
async function purgeLibrary(fs, root) {
  const filesDir = join(root, FILES_DIR);
  try {
    if (await fs.exists(filesDir)) {
      for (const name of await fs.readDir(filesDir)) {
        await fs.remove(join(filesDir, name)).catch(() => {});
      }
    }
  } catch { /* nothing to clean */ }
  await fs.remove(join(root, LIBRARY_FILE)).catch(() => {});
  await fs.remove(join(root, MARKER_FILE)).catch(() => {});
}

/**
 * Everything in the browser database, in the shape `repo.snapshot()`
 * returns — without opening a repository over it.
 *
 * A repository would be the obvious way to read this, and it is the
 * wrong one: `repo.init()` seeds an empty library and writes a
 * `seed:version` flag, which would mean WRITING to the source we have
 * promised only to read. The adapter has everything needed anyway.
 */
async function readSource(adapter) {
  const [books, settingRecords, files] = await Promise.all([
    adapter.list(COLLECTIONS.BOOKS),
    adapter.list(COLLECTIONS.SETTINGS),
    adapter.listAllBlobs(),
  ]);
  // Libraries written before the covers store exists answer this with
  // an error rather than an empty list.
  let covers = [];
  try {
    covers = await adapter.list(COLLECTIONS.COVERS);
  } catch { covers = []; }

  const settings = {};
  for (const record of settingRecords) settings[record.key] = record.value;
  return { books, settings, covers, files, settingRecords };
}

/**
 * Is there a browser library here at all?
 *
 * Asked before opening anything, because `indexedDB.open` CREATES the
 * database when it is missing. On a desktop install that never had a
 * browser library — the normal case, forever, for everyone who gets the
 * app rather than the web page — merely looking would leave an empty
 * `ponyo-library` behind in the webview. That is a write, and this
 * module has promised not to make any.
 *
 * `databases()` is not universally available; where it is missing the
 * honest answer is "maybe", and opening is the only way to find out.
 */
async function hasBrowserLibrary(name) {
  if (typeof indexedDB === 'undefined') return false;
  if (typeof indexedDB.databases !== 'function') return true;
  try {
    return (await indexedDB.databases()).some((db) => db.name === name);
  } catch {
    return true;
  }
}

const isEmpty = (source) =>
  source.books.length === 0
  && source.covers.length === 0
  && source.files.length === 0
  && Object.keys(source.settings).length === 0;

const bytesOf = async (blob) => new Uint8Array(await blob.arrayBuffer());

function sameBytes(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Read the filesystem library back from scratch and prove it holds what
 * it was given.
 *
 * A fresh adapter on purpose: verifying through the instance that just
 * did the writing would be asking the in-memory copy whether the
 * in-memory copy is correct, which it always is. This opens the file
 * that is actually on the disk.
 *
 * @returns {Promise<{ok: boolean, problems: string[], counts: Object}>}
 */
export async function verifyMigration(fs, root, source) {
  const problems = [];
  const check = (cond, message) => { if (!cond) problems.push(message); };

  const adapter = createFsAdapter({ fs, root });
  await adapter.open();

  const books = await adapter.list(COLLECTIONS.BOOKS);
  const covers = await adapter.list(COLLECTIONS.COVERS);
  const settingRecords = await adapter.list(COLLECTIONS.SETTINGS);
  const files = await adapter.listAllBlobs();

  check(books.length === source.books.length,
    `book count is ${books.length}, expected ${source.books.length}`);
  const byId = new Map(books.map((b) => [b.id, b]));
  for (const book of source.books) {
    const landed = byId.get(book.id);
    if (!landed) { check(false, `book missing: ${book.id}`); continue; }
    check(same(landed, book), `book changed in transit: ${book.title ?? book.id}`);
  }

  const settings = {};
  for (const record of settingRecords) settings[record.key] = record.value;
  const sourceKeys = Object.keys(source.settings);
  check(Object.keys(settings).length === sourceKeys.length,
    `setting count is ${Object.keys(settings).length}, expected ${sourceKeys.length}`);
  for (const key of sourceKeys) {
    check(same(settings[key], source.settings[key]), `setting changed in transit: ${key}`);
  }

  check(covers.length === source.covers.length,
    `cover count is ${covers.length}, expected ${source.covers.length}`);
  const coverById = new Map(covers.map((c) => [c.id, c]));
  for (const cover of source.covers) {
    const landed = coverById.get(cover.id);
    if (!landed) { check(false, `cover override missing: ${cover.id}`); continue; }
    check(same(landed, cover), `cover override changed in transit: ${cover.id}`);
  }

  check(files.length === source.files.length,
    `file count is ${files.length}, expected ${source.files.length}`);
  const fileById = new Map(files.map((f) => [f.id, f]));
  for (const record of source.files) {
    const landed = fileById.get(record.id);
    if (!landed) { check(false, `file missing: ${record.id}`); continue; }

    for (const field of ['bookId', 'name', 'type', 'role']) {
      check(String(landed[field] ?? '') === String(record[field] ?? ''),
        `file ${field} changed: ${record.id}`);
    }
    check(String(landed.addedAt ?? '') === String(record.addedAt ?? ''),
      `file addedAt changed: ${record.id}`);

    const wanted = await bytesOf(record.blob);
    const got = await bytesOf(landed.blob);
    check(got.length === wanted.length,
      `file is ${got.length} bytes, expected ${wanted.length}: ${record.id}`);
    check(sameBytes(got, wanted), `file bytes changed in transit: ${record.id}`);
    check(landed.blob.type === (record.type || 'application/octet-stream'),
      `file type lost on the way back: ${record.id}`);
  }

  adapter.close();
  return {
    ok: problems.length === 0,
    problems,
    counts: {
      books: books.length,
      settings: Object.keys(settings).length,
      covers: covers.length,
      files: files.length,
    },
  };
}

/**
 * Do the whole thing.
 *
 * @param {Object} options
 * @param {Object} options.fs            filesystem backend
 * @param {string} [options.root]        library directory
 * @param {Object} [options.state]       from readMigrationState
 * @param {Function} [options.onProgress] (step, detail) => void
 * @param {Object} [options.source]      an adapter to migrate FROM, for tests
 * @param {Date}   [options.date]        for a deterministic backup name
 */
export async function runMigration({
  fs, root = '', state = null, onProgress = null, source = null, date = new Date(),
} = {}) {
  const step = (name, detail = '') => onProgress?.(name, detail);
  const current = state || await readMigrationState(fs, root);

  if (current.status === 'complete') {
    return { mode: 'adopted', counts: null, backup: null };
  }

  // A previous attempt died partway. Its output is not a library.
  if (current.status === 'incomplete') {
    step('cleaning', 'removing an unfinished migration');
    await purgeLibrary(fs, root);
  }

  // ── read the source, without touching it ──
  step('reading', 'looking for a browser library');
  const ownsSource = !source;
  const from = source || createIndexedDbAdapter();

  if (ownsSource && !(await hasBrowserLibrary(from.database))) {
    step('reading', 'no browser library found');
    return await createFresh(fs, root, step, date, 'empty');
  }
  let snapshot;
  try {
    if (ownsSource) await from.open();
    snapshot = await readSource(from);
  } catch (error) {
    // A database that exists and will not open is NOT the same as no
    // database, and the difference is her entire library.
    //
    // `openDatabase` gives up after four seconds of silence, which is
    // the right call for the app — a hang there means a blank page —
    // but it means a browser that is merely busy, or a second window
    // holding the database, arrives here as a failure. Treating that as
    // "nothing to migrate" would create an empty library, mark it
    // complete, and every launch after this one would adopt the empty
    // one without ever looking at the browser again.
    //
    // So: refuse. Nothing is written, nothing is marked, and the next
    // launch tries again from exactly where it started.
    if (ownsSource) from.close?.();
    step('failed', 'the browser library could not be read');
    throw new MigrationError(
      `A browser library is here but could not be read (${error.message}).`,
      {
        hint: 'Nothing was changed. Closing any other window with the library open and starting again usually fixes it.',
        cause: error,
      },
    );
  }

  if (isEmpty(snapshot)) {
    if (ownsSource) from.close?.();
    return await createFresh(fs, root, step, date, 'empty');
  }

  // ── from here on there is something to lose ──
  await writeMarker(fs, root, {
    status: 'running',
    startedAt: date.toISOString(),
    source: 'indexeddb',
    expects: {
      books: snapshot.books.length,
      settings: Object.keys(snapshot.settings).length,
      covers: snapshot.covers.length,
      files: snapshot.files.length,
    },
  });

  let backupPath = '';
  try {
    // 1. the safety copy, through the existing, tested backup engine.
    //    buildBackup only ever calls snapshot(), and verifies the
    //    archive it produced before returning it.
    step('backup', 'writing a safety copy');
    const { blob, manifest } = await buildBackup({ snapshot: async () => snapshot }, { date });
    await fs.mkdir(join(root, BACKUPS_DIR));
    const stamp = date.toISOString().replace(/[:.]/g, '-');
    backupPath = join(root, BACKUPS_DIR, `pre-migration-${stamp}.ponyolib`);
    await writeFileAtomic(fs, backupPath, await bytesOf(blob));
    step('backup', `${manifest.counts.books} books archived`);

    // 2. write the library
    step('writing', 'copying the library to disk');
    const adapter = createFsAdapter({ fs, root });
    await adapter.open();
    await adapter.putMany(COLLECTIONS.BOOKS, snapshot.books);
    if (snapshot.settingRecords.length) {
      await adapter.putMany(COLLECTIONS.SETTINGS, snapshot.settingRecords);
    }
    if (snapshot.covers.length) {
      await adapter.putMany(COLLECTIONS.COVERS, snapshot.covers);
    }
    for (const record of snapshot.files) await adapter.putBlob(record);
    await adapter.flush();
    adapter.close();

    // 3. read it back off the disk and compare
    step('verifying', 'checking every record arrived');
    const verdict = await verifyMigration(fs, root, snapshot);
    if (!verdict.ok) {
      throw new MigrationError(
        `The copied library did not match the original (${verdict.problems[0]}).`,
        { hint: 'Nothing was removed from the browser, and a safety copy was saved.' },
      );
    }

    // 4. only now
    await writeMarker(fs, root, {
      status: 'complete',
      completedAt: new Date().toISOString(),
      source: 'indexeddb',
      backup: backupPath,
      counts: verdict.counts,
    });
    step('done', `${verdict.counts.books} books`);

    return { mode: 'migrated', counts: verdict.counts, backup: backupPath, problems: [] };
  } catch (error) {
    step('failed', error.message);
    await purgeLibrary(fs, root);
    if (error instanceof MigrationError) throw error;
    throw new MigrationError(`The library could not be copied to this computer (${error.message}).`, {
      hint: backupPath
        ? 'Nothing was removed from the browser, and a safety copy was saved.'
        : 'Nothing was removed from the browser.',
      cause: error,
    });
  } finally {
    if (ownsSource) from.close?.();
  }
}

/** A new, empty library. The app seeds it exactly as it would a new browser one. */
async function createFresh(fs, root, step, date, reason) {
  step('writing', 'creating a new library');
  await writeMarker(fs, root, { status: 'running', startedAt: date.toISOString(), source: reason });
  try {
    const adapter = createFsAdapter({ fs, root });
    await adapter.open();
    await adapter.flush();
    adapter.close();
  } catch (error) {
    await purgeLibrary(fs, root);
    throw new MigrationError(`A library folder could not be created (${error.message}).`, { cause: error });
  }
  await writeMarker(fs, root, {
    status: 'complete',
    completedAt: new Date().toISOString(),
    source: reason,
    counts: { books: 0, settings: 0, covers: 0, files: 0 },
  });
  step('done', 'a new library');
  return { mode: 'fresh', counts: { books: 0, settings: 0, covers: 0, files: 0 }, backup: null };
}
