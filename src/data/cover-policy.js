/**
 * cover-policy.js — one function decides what picture a book shows.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────
 * A cover is not part of a book. The book is the title, the author and
 * what she thought of it; the cover is a picture that happens to be
 * available today, from a source that might die tomorrow. Keeping them
 * apart means Phase 2 can improve every cover in the library without
 * touching a single book record — and that a dead URL degrades to
 * something designed instead of to a grey box.
 *
 * ── THE FOUR SOURCES, IN ORDER OF TRUST ───────────────────────────
 *   upload       a file she chose herself. Always wins.
 *   manual       a URL she pasted into the book form.
 *   openlibrary  a verified match shipped in covers.js.
 *   generated    drawn from the title, author and genre. Never fails,
 *                works offline, and is the reason nothing is ever blank.
 *
 * ── STATUS IS NOT SOURCE ──────────────────────────────────────────
 * `source` says where the picture came from. `status` says whether it
 * is the real published cover or our own artwork. Phase 2 reads
 * `status === 'fallback'` to find the books still worth hunting a real
 * cover for, which is exactly the list you want and nothing more.
 *
 * Nothing here fetches anything or touches the DOM.
 */

export const COVER_SOURCE = Object.freeze({
  UPLOAD: 'upload',
  MANUAL: 'manual',
  OPENLIBRARY: 'openlibrary',
  GENERATED: 'generated',
});

export const COVER_STATUS = Object.freeze({
  /** A photograph of the actual published cover. */
  REAL: 'real',
  /** Our own artwork, drawn from the book's own metadata. */
  FALLBACK: 'fallback',
});

export const SOURCE_LABEL = Object.freeze({
  [COVER_SOURCE.UPLOAD]: 'your own image',
  [COVER_SOURCE.MANUAL]: 'a link you added',
  [COVER_SOURCE.OPENLIBRARY]: 'Open Library',
  [COVER_SOURCE.GENERATED]: 'drawn for this book',
});

/** The empty descriptor: no photograph, so the generated cover shows. */
const GENERATED = Object.freeze({
  url: '',
  fileId: '',
  source: COVER_SOURCE.GENERATED,
  status: COVER_STATUS.FALLBACK,
});

/**
 * What should this book show?
 *
 * @param {Object} book                  the book record
 * @param {Object} [options]
 * @param {Object} [options.override]    a record from the `covers` store,
 *                                       which is where Phase 2 will put
 *                                       improved covers. Beats the book.
 * @param {string} [options.objectUrl]   a resolved blob URL for an upload
 * @returns {{url: string, fileId: string, source: string, status: string}}
 */
export function resolveCover(book = {}, { override, objectUrl } = {}) {
  // 1. An image she uploaded. The blob may not have resolved yet, in
  //    which case we still report `upload` — the caller renders the
  //    generated cover meanwhile and swaps when the URL arrives.
  const fileId = override?.fileId || book.coverId || '';
  if (fileId) {
    return {
      url: objectUrl || '',
      fileId,
      source: COVER_SOURCE.UPLOAD,
      status: COVER_STATUS.REAL,
    };
  }

  // 2. Whatever the independent cover store says. This is the seam.
  if (override?.url) {
    return {
      url: override.url,
      fileId: '',
      source: override.source || COVER_SOURCE.MANUAL,
      status: COVER_STATUS.REAL,
    };
  }

  // 3. What shipped with the book.
  if (book.coverUrl) {
    return {
      url: book.coverUrl,
      fileId: '',
      source: book.coverSource || COVER_SOURCE.OPENLIBRARY,
      status: COVER_STATUS.REAL,
    };
  }

  // 4. Always available, offline, free.
  return { ...GENERATED };
}

/** True when this book is still waiting for a real cover. */
export function needsRealCover(book, options) {
  return resolveCover(book, options).status === COVER_STATUS.FALLBACK;
}

/**
 * The shape stored in the independent `covers` collection.
 * One record per book, so a cover can be replaced without rewriting the
 * book — which is the whole point of keeping them apart.
 */
export function makeCoverRecord(bookId, { url = '', fileId = '', source = COVER_SOURCE.MANUAL } = {}) {
  return {
    id: bookId,
    url: String(url || '').trim(),
    fileId: String(fileId || '').trim(),
    source,
    updatedAt: new Date().toISOString(),
  };
}
