/**
 * adapter.js — the contract between the app and wherever data lives.
 *
 * NOTHING above this file knows about IndexedDB. The whole application
 * talks to a `StorageAdapter`, and today that adapter happens to be
 * backed by IndexedDB in her browser. In Phase 2 you write a second
 * adapter backed by a cloud database, hand it to the repository, and
 * every view keeps working untouched.
 *
 * The contract is deliberately small and document-shaped (collections
 * of records with string ids, plus a separate blob store), because that
 * is the common denominator between IndexedDB, Firestore, Supabase and
 * a plain REST API.
 *
 *   COLLECTIONS
 *     books     — one record per book (see models.js)
 *     settings  — { key, value } preference records
 *   BLOBS
 *     files     — { id, bookId, name, type, size, role, blob, addedAt }
 *
 * Every method returns a Promise. Implementations must not mutate the
 * objects they are handed.
 *
 * @typedef {Object} StorageAdapter
 * @property {() => Promise<void>}                    open
 * @property {(c: string) => Promise<Object[]>}       list
 * @property {(c: string, id: string) => Promise<Object|undefined>} get
 * @property {(c: string, record: Object) => Promise<Object>}       put
 * @property {(c: string, records: Object[]) => Promise<Object[]>}  putMany
 * @property {(c: string, id: string) => Promise<void>}             remove
 * @property {(c: string) => Promise<void>}           clear
 * @property {(record: Object) => Promise<Object>}    putBlob
 * @property {(id: string) => Promise<Object|undefined>} getBlob
 * @property {(id: string) => Promise<void>}          removeBlob
 * @property {(bookId: string) => Promise<Object[]>}  listBlobsByBook
 * @property {() => Promise<Object[]>}                listAllBlobs
 * @property {() => Promise<void>}                    clearBlobs
 *
 * `listAllBlobs` and `clearBlobs` exist for backup and restore, which
 * are the only two operations that legitimately need to see the whole
 * blob store at once: a backup that walked books instead would silently
 * omit any file whose book had been deleted, and a Replace restore that
 * cleared only the collections would leave every uploaded image behind
 * as an orphan taking up space forever. Phase 2's filesystem adapter
 * implements these the same way — a directory listing and a delete.
 */

export const COLLECTIONS = Object.freeze({
  BOOKS: 'books',
  SETTINGS: 'settings',
  /**
   * Covers live in their own collection, keyed by book id, so a picture
   * can be replaced or improved without rewriting the book record.
   * Phase 2 fills this in from cloud storage; Phase 1 writes to it when
   * she replaces a cover by hand.
   */
  COVERS: 'covers',
});

/**
 * Thrown when storage is unavailable (private browsing, blocked origin,
 * quota exhausted). The app catches this and degrades to memory-only so
 * she can still look around instead of seeing a blank page.
 */
export class StorageUnavailableError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'StorageUnavailableError';
    this.cause = cause;
  }
}

/**
 * A no-persistence adapter used as a last-resort fallback.
 * Implements exactly the same contract, so nothing downstream notices.
 */
export function createMemoryAdapter() {
  const collections = new Map();
  const blobs = new Map();
  const table = (name) => {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  };

  return {
    name: 'memory',
    async open() {},
    async list(collection) { return Array.from(table(collection).values()); },
    async get(collection, id) { return table(collection).get(id); },
    async put(collection, record) { table(collection).set(record.id ?? record.key, record); return record; },
    async putMany(collection, records) {
      for (const record of records) table(collection).set(record.id ?? record.key, record);
      return records;
    },
    async remove(collection, id) { table(collection).delete(id); },
    async clear(collection) { table(collection).clear(); },
    async putBlob(record) { blobs.set(record.id, record); return record; },
    async getBlob(id) { return blobs.get(id); },
    async removeBlob(id) { blobs.delete(id); },
    async listBlobsByBook(bookId) { return Array.from(blobs.values()).filter((b) => b.bookId === bookId); },
    async listAllBlobs() { return Array.from(blobs.values()); },
    async clearBlobs() { blobs.clear(); },
  };
}
