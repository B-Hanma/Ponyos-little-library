/**
 * cover-urls.js — object URLs for uploaded cover images.
 *
 * Reading a blob out of storage is async, but rendering a card is not.
 * So cards render the generated cover immediately, ask this cache for
 * the real one, and the cache swaps the image in when it arrives. That
 * keeps the shelf painting in one frame no matter how many covers she
 * has uploaded.
 *
 * URLs are revoked when a cover is replaced or its book is deleted,
 * so the tab does not slowly leak blobs.
 */

const urls = new Map();       // fileId -> objectURL
const pending = new Set();    // fileId currently being fetched
const waiting = new Set();    // callbacks to run when a batch resolves

export function createCoverCache(repo) {
  let notifyTimer = 0;

  function notify() {
    clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => {
      for (const fn of waiting) fn();
    }, 30);
  }

  return {
    /** Synchronous: the URL if we already have it, otherwise undefined. */
    peek(fileId) {
      return fileId ? urls.get(fileId) : undefined;
    },

    /**
     * Everything a cover needs for one book, in one synchronous call:
     * the override record from the independent covers store, and the
     * object URL for an uploaded image (requesting it if this is the
     * first time we have been asked).
     *
     * Render-safe: never blocks, never throws, and returns the same
     * shape whether or not anything has loaded yet.
     */
    forBook(book) {
      if (!book) return {};
      const override = repo.getCover?.(book.id);
      const fileId = override?.fileId || book.coverId || '';
      if (fileId) this.request(fileId);
      return { override, objectUrl: fileId ? urls.get(fileId) : undefined };
    },

    /** Kick off a load if needed. Safe to call on every render. */
    request(fileId) {
      if (!fileId || urls.has(fileId) || pending.has(fileId)) return;
      pending.add(fileId);
      repo.getFile(fileId)
        .then((record) => {
          pending.delete(fileId);
          if (!record?.blob) return;
          urls.set(fileId, URL.createObjectURL(record.blob));
          notify();
        })
        .catch(() => { pending.delete(fileId); });
    },

    /** Called when a cover changes, so the old URL does not linger. */
    forget(fileId) {
      const url = urls.get(fileId);
      if (url) URL.revokeObjectURL(url);
      urls.delete(fileId);
    },

    /** Re-render hook: fires once after a batch of covers resolves. */
    onResolved(fn) { waiting.add(fn); return () => waiting.delete(fn); },

    dispose() {
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
    },
  };
}
