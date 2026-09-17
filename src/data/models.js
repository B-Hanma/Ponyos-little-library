/**
 * models.js — the shape of a book, and the rules for cleaning one up.
 *
 * One record type, one place that decides what a valid book looks like.
 * The catalogue and anything she types by hand both go through
 * `makeBook`, so the collection can never end up half-normalized.
 *
 * Records are versioned by shape rather than by a number: `makeBook` is
 * tolerant of older records missing newer fields, so a library saved
 * before notes became a list still opens.
 */

import { smartTitle, unflipAuthor, bookKey } from '../utils/text.js';

export const STATUS = Object.freeze({
  TBR: 'tbr',
  READING: 'reading',
  READ: 'read',
  DNF: 'dnf',
});

export const STATUS_META = Object.freeze({
  [STATUS.TBR]:     { label: 'To read',  short: 'TBR',     icon: '\u{1F41A}', badge: '' },
  [STATUS.READING]: { label: 'Reading',  short: 'Reading', icon: '\u{1F331}', badge: 'reading' },
  [STATUS.READ]:    { label: 'Read',     short: 'Read',    icon: '\u{1F4D6}', badge: 'read' },
  [STATUS.DNF]:     { label: 'Set down', short: 'DNF',     icon: '\u{1F343}', badge: 'dnf' },
});

export const ALL_STATUSES = [STATUS.TBR, STATUS.READING, STATUS.READ, STATUS.DNF];

/** The author string used when the source list genuinely did not say. */
export const UNKNOWN_AUTHOR = 'Author unknown';

let counter = 0;
export function newId(prefix = 'bk') {
  counter += 1;
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}${counter.toString(36)}${rand}`;
}

/**
 * Notes used to be a single string. They are now a list of dated entries,
 * so she can write on a book more than once. Old records are migrated
 * transparently the first time they are loaded.
 */
function normalizeNotes(input) {
  if (Array.isArray(input)) {
    return input
      .filter((n) => n && typeof n.text === 'string')
      .map((n) => ({
        id: n.id ?? newId('nt'),
        text: n.text,
        createdAt: n.createdAt ?? new Date().toISOString(),
        pinned: Boolean(n.pinned),
      }));
  }
  if (typeof input === 'string' && input.trim()) {
    return [{ id: newId('nt'), text: input, createdAt: new Date().toISOString(), pinned: false }];
  }
  return [];
}

/** { current, total, unit } — how far into the book she is. */
function normalizeProgress(input, status) {
  const current = Math.max(0, Number(input?.current) || 0);
  const total = Math.max(0, Number(input?.total) || 0);
  const unit = input?.unit === 'percent' ? 'percent' : 'page';
  // A finished book is finished, whatever the counter says.
  if (status === STATUS.READ && total && current < total) return { current: total, total, unit };
  return { current, total, unit };
}

/** 0-1, or null when there is nothing to compute from. */
export function progressFraction(book) {
  if (book.status === STATUS.READ) return 1;
  const { current, total, unit } = book.progress;
  if (unit === 'percent') return current ? Math.min(1, current / 100) : null;
  if (!total || !current) return null;
  return Math.min(1, current / total);
}

/**
 * Build a complete, valid book record from anything partial.
 * Unknown fields are dropped; known fields are cleaned, never invented.
 */
export function makeBook(input = {}) {
  const title = smartTitle(input.title ?? '').trim();
  const author = smartTitle(unflipAuthor(input.author ?? '')).trim();
  const now = new Date().toISOString();
  const status = ALL_STATUSES.includes(input.status) ? input.status : STATUS.TBR;

  return {
    id: input.id ?? newId(),
    title,
    author: author || UNKNOWN_AUTHOR,
    /** Primary genre. Empty string means "we honestly do not know". */
    genre: (input.genre ?? '').trim(),
    subgenre: (input.subgenre ?? '').trim(),
    series: (input.series ?? '').trim(),
    description: (input.description ?? '').trim(),

    status,
    rating: clampRating(input.rating),
    favourite: Boolean(input.favourite),

    /** [{ id, text, createdAt, pinned }] */
    notes: normalizeNotes(input.notes),
    thoughts: input.thoughts ?? '',

    tags: dedupeTags(input.tags),

    /**
     * Covers are metadata, never baked into a component.
     *
     *   coverUrl     a remote image (Open Library today, cloud storage later)
     *   coverId      an image she uploaded, living in the local blob store
     *   coverRef     the id at the source, so a cover can be re-fetched
     *                or upgraded later without re-matching the book
     *   coverSource  where the picture came from — see cover-policy.js
     *
     * These four are what the book *shipped* with. Anything she changes
     * later is written to the separate `covers` collection instead, so a
     * replaced cover never rewrites the book record. resolveCover() in
     * cover-policy.js is the only thing that decides between them.
     */
    coverUrl: input.coverUrl ?? '',
    coverId: input.coverId ?? '',
    coverRef: input.coverRef ?? '',
    coverSource: input.coverSource ?? '',

    attachmentIds: Array.isArray(input.attachmentIds) ? [...input.attachmentIds] : [],
    /** Photos with a date and a caption — the scrapbook. */
    memories: Array.isArray(input.memories)
      ? input.memories.map((m) => ({
        id: m.id ?? newId('mem'),
        fileId: m.fileId ?? '',
        note: m.note ?? '',
        takenAt: m.takenAt ?? m.createdAt ?? now,
      }))
      : [],

    progress: normalizeProgress(input.progress, status),

    /** true when the source row was ambiguous and a human should look. */
    needsReview: Boolean(input.needsReview),
    /** true for books that came with the library, false for ones she added. */
    seeded: Boolean(input.seeded),

    addedAt: input.addedAt ?? now,
    updatedAt: input.updatedAt ?? now,
    startedAt: input.startedAt ?? null,
    finishedAt: input.finishedAt ?? null,
  };
}

export function clampRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(5, Math.max(0, Math.round(n)));
}

export function dedupeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of tags) {
    const tag = String(raw ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/**
 * Apply a partial update, keeping timestamps honest.
 * Status changes stamp the started/finished dates so the dashboard has
 * something real to count later.
 */
export function updateBook(book, patch) {
  const next = { ...book, ...patch, updatedAt: new Date().toISOString() };

  if ('rating' in patch) next.rating = clampRating(patch.rating);
  if ('tags' in patch) next.tags = dedupeTags(patch.tags);
  if ('notes' in patch) next.notes = normalizeNotes(patch.notes);
  if ('title' in patch) next.title = smartTitle(patch.title).trim();
  if ('author' in patch) next.author = smartTitle(unflipAuthor(patch.author)).trim() || UNKNOWN_AUTHOR;

  if (patch.status && patch.status !== book.status) {
    if (patch.status === STATUS.READING && !next.startedAt) next.startedAt = next.updatedAt;
    if (patch.status === STATUS.READ) next.finishedAt = next.updatedAt;
    if (patch.status === STATUS.TBR) { next.startedAt = null; next.finishedAt = null; }
  }

  // Filling in a page count is itself a sign she has started reading.
  if (patch.progress) {
    next.progress = normalizeProgress({ ...book.progress, ...patch.progress }, next.status);
    if (next.progress.current > 0 && next.status === STATUS.TBR) {
      next.status = STATUS.READING;
      next.startedAt = next.startedAt ?? next.updatedAt;
    }
  } else {
    next.progress = normalizeProgress(next.progress, next.status);
  }

  return next;
}

/** Add one dated note to a book, newest first. */
export function addNote(book, text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return book.notes;
  return [{ id: newId('nt'), text: trimmed, createdAt: new Date().toISOString(), pinned: false }, ...book.notes];
}

/** Everything she has written on a book, as one searchable string. */
export function noteText(book) {
  return book.notes.map((n) => n.text).join(' ');
}

export const keyOf = (book) => bookKey(book.title, book.author);

/**
 * Fold a list of book-ish objects down to one record per real book.
 * The source list had duplicates and near-duplicates; this merges them
 * rather than dropping anything, so an ambiguous entry survives as the
 * richer of the two records.
 */
export function dedupeBooks(books) {
  const byKey = new Map();
  for (const book of books) {
    const key = keyOf(book);
    const existing = byKey.get(key);
    if (!existing) { byKey.set(key, book); continue; }
    byKey.set(key, {
      ...existing,
      // Prefer whichever record actually knows something.
      genre: existing.genre || book.genre,
      subgenre: existing.subgenre || book.subgenre,
      series: existing.series || book.series,
      description: existing.description.length >= book.description.length
        ? existing.description : book.description,
      coverUrl: existing.coverUrl || book.coverUrl,
      needsReview: existing.needsReview || book.needsReview,
      tags: dedupeTags([...existing.tags, ...book.tags]),
    });
  }
  return Array.from(byKey.values());
}
