/**
 * repository.js — the library's front door.
 *
 * Views never touch an adapter directly. They ask the repository for
 * books and settings, and the repository keeps a full in-memory copy
 * (200-ish records is nothing) so reads are synchronous and instant
 * while writes go to storage in the background.
 *
 * Swapping to the cloud in Phase 2 means passing a different adapter
 * into `createRepository` and nothing else.
 */

import { COLLECTIONS, createMemoryAdapter } from './adapter.js';
import { makeBook, updateBook, newId, dedupeBooks, keyOf } from '../data/models.js';
import { makeCoverRecord } from '../data/cover-policy.js';

const SEED_FLAG = 'seed:version';

export function createRepository(adapter) {
  /** @type {Map<string, Object>} */
  const books = new Map();
  /** @type {Map<string, any>} */
  const settings = new Map();
  /**
   * Covers, keyed by book id, kept OUT of the book record on purpose:
   * a picture can then be replaced or improved without rewriting the
   * book. Phase 2 fills this from cloud storage.
   * @type {Map<string, Object>}
   */
  const covers = new Map();
  const listeners = new Set();
  let degraded = false;

  function emit(event) {
    for (const fn of listeners) fn(event);
  }

  /** Writes are fire-and-forget from the UI's point of view, but never silent. */
  async function persist(work, label) {
    if (degraded) return;
    try {
      await work();
    } catch (error) {
      console.error(`[library] could not save (${label})`, error);
      emit({ type: 'error', label, error });
    }
  }

  return {
    /** Subscribe to repository-level events (currently only save failures). */
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    get isDegraded() { return degraded; },
    markDegraded() { degraded = true; },

    /**
     * Open storage, load everything into memory, and seed on first run.
     * @param {{seedBooks: Object[], seedVersion: string}} options
     */
    async init({ seedBooks = [], seedVersion = '1', retiredKeys = [] } = {}) {
      try {
        await adapter.open();
      } catch (error) {
        console.warn('[library] storage unavailable, running in memory only', error);
        degraded = true;
        adapter = createMemoryAdapter();
        await adapter.open();
      }

      for (const record of await adapter.list(COLLECTIONS.SETTINGS)) {
        settings.set(record.key, record.value);
      }
      for (const record of await adapter.list(COLLECTIONS.BOOKS)) {
        books.set(record.id, record);
      }
      // Older libraries predate the covers store; an empty list is the
      // correct answer there, not an error.
      try {
        for (const record of await adapter.list(COLLECTIONS.COVERS)) {
          covers.set(record.id, record);
        }
      } catch { /* no covers store yet */ }

      const seededVersion = settings.get(SEED_FLAG);
      if (!seededVersion && books.size === 0) {
        await this.seed(seedBooks, seedVersion);
        return { seeded: true, degraded };
      }

      // A later seed version can add books she does not have yet without
      // ever touching the ones she has already annotated.
      if (seededVersion && seededVersion !== seedVersion) {
        const result = await this.topUpSeed(seedBooks, seedVersion, retiredKeys);
        return { seeded: false, toppedUp: true, ...result, degraded };
      }

      return { seeded: false, degraded };
    },

    async seed(seedBooks, seedVersion) {
      const prepared = dedupeBooks(seedBooks.map((b) => makeBook({ ...b, seeded: true })));
      for (const book of prepared) books.set(book.id, book);
      await persist(async () => {
        await adapter.putMany(COLLECTIONS.BOOKS, prepared);
        await adapter.put(COLLECTIONS.SETTINGS, { key: SEED_FLAG, value: seedVersion });
      }, 'seed');
      settings.set(SEED_FLAG, seedVersion);
    },

    /**
     * A later seed version can add books she does not have yet, and can
     * retire a book that was pulled from the catalogue — but ONLY if she
     * never touched it. A book she rated, shelved or wrote on is hers,
     * and a catalogue edit does not get to delete it.
     */
    async topUpSeed(seedBooks, seedVersion, retiredKeys = []) {
      const retired = new Set(retiredKeys);
      const dropped = [];
      if (retired.size) {
        for (const book of books.values()) {
          if (!retired.has(keyOf(book))) continue;
          if (!book.seeded) continue;
          if (book.status !== 'tbr' || book.rating || book.favourite) continue;
          if (book.notes?.length || book.thoughts || book.tags?.length) continue;
          if (book.memories?.length || book.attachmentIds?.length) continue;
          books.delete(book.id);
          dropped.push(book.id);
        }
      }
      const known = new Set(Array.from(books.values()).map(keyOf));
      const fresh = dedupeBooks(seedBooks.map((b) => makeBook({ ...b, seeded: true })))
        .filter((book) => !known.has(keyOf(book)));
      for (const book of fresh) books.set(book.id, book);
      await persist(async () => {
        await adapter.putMany(COLLECTIONS.BOOKS, fresh);
        await adapter.put(COLLECTIONS.SETTINGS, { key: SEED_FLAG, value: seedVersion });
      }, 'top-up');
      if (dropped.length) {
        persist(async () => {
          for (const id of dropped) await adapter.remove(COLLECTIONS.BOOKS, id);
        }, 'retire');
      }
      settings.set(SEED_FLAG, seedVersion);
      return { added: fresh.length, retired: dropped.length };
    },

    // ---------------------------------------------------------------- books

    all() { return Array.from(books.values()); },
    get(id) { return books.get(id); },
    count() { return books.size; },

    /** Returns the created record immediately; storage catches up. */
    add(input) {
      const book = makeBook({ ...input, seeded: false });
      books.set(book.id, book);
      persist(() => adapter.put(COLLECTIONS.BOOKS, book), 'add');
      return book;
    },

    update(id, patch) {
      const current = books.get(id);
      if (!current) return null;
      const next = updateBook(current, patch);
      books.set(id, next);
      persist(() => adapter.put(COLLECTIONS.BOOKS, next), 'update');
      return next;
    },

    /** Removes the book and every file attached to it. */
    async remove(id) {
      const book = books.get(id);
      if (!book) return null;
      books.delete(id);
      await persist(async () => {
        const cover = covers.get(id);
        covers.delete(id);
        for (const fileId of [...book.attachmentIds, book.coverId, cover?.fileId].filter(Boolean)) {
          await adapter.removeBlob(fileId);
        }
        await adapter.remove(COLLECTIONS.COVERS, id);
        await adapter.remove(COLLECTIONS.BOOKS, id);
      }, 'remove');
      return book;
    },

    /** Put a removed book back exactly as it was (the undo path). */
    restore(book) {
      books.set(book.id, book);
      persist(() => adapter.put(COLLECTIONS.BOOKS, book), 'restore');
      return book;
    },

    /** Bulk import. Returns { added, skipped } — never overwrites her edits. */
    importBooks(inputs) {
      const known = new Set(Array.from(books.values()).map(keyOf));
      const fresh = [];
      let skipped = 0;
      for (const input of dedupeBooks(inputs.map((b) => makeBook(b)))) {
        if (!input.title) { skipped += 1; continue; }
        if (known.has(keyOf(input))) { skipped += 1; continue; }
        known.add(keyOf(input));
        books.set(input.id, input);
        fresh.push(input);
      }
      persist(() => adapter.putMany(COLLECTIONS.BOOKS, fresh), 'import');
      return { added: fresh.length, skipped };
    },

    // --------------------------------------------------------------- covers

    /**
     * The cover record for a book, or undefined. Deliberately separate
     * from the book: replacing a picture must never rewrite a book.
     */
    getCover(bookId) { return covers.get(bookId); },

    /** Every override she has set, for Settings and for export. */
    allCovers() { return Array.from(covers.values()); },

    /** Point a book at a different picture. Returns the record. */
    setCover(bookId, options) {
      const record = makeCoverRecord(bookId, options);
      if (!record.url && !record.fileId) return this.clearCover(bookId);
      covers.set(bookId, record);
      persist(() => adapter.put(COLLECTIONS.COVERS, record), 'cover');
      return record;
    },

    /** Fall back to whatever shipped, or to the generated cover. */
    clearCover(bookId) {
      const previous = covers.get(bookId);
      covers.delete(bookId);
      persist(async () => {
        await adapter.remove(COLLECTIONS.COVERS, bookId);
        if (previous?.fileId) await adapter.removeBlob(previous.fileId);
      }, 'clear cover');
      return previous ?? null;
    },

    // ------------------------------------------------------------- settings

    getSetting(key, fallback = null) {
      return settings.has(key) ? settings.get(key) : fallback;
    },
    setSetting(key, value) {
      settings.set(key, value);
      persist(() => adapter.put(COLLECTIONS.SETTINGS, { key, value }), 'setting');
      return value;
    },
    allSettings() { return Object.fromEntries(settings); },

    // ---------------------------------------------------------------- files

    /**
     * Store a File/Blob against a book.
     * @param {string} bookId
     * @param {File} file
     * @param {'cover'|'attachment'} role
     */
    async addFile(bookId, file, role = 'attachment') {
      const record = {
        id: newId('fl'),
        bookId,
        name: file.name || 'untitled',
        type: file.type || 'application/octet-stream',
        size: file.size ?? 0,
        role,
        blob: file,
        addedAt: new Date().toISOString(),
      };
      await adapter.putBlob(record);

      const book = books.get(bookId);
      if (book) {
        if (role === 'cover') {
          if (book.coverId) await adapter.removeBlob(book.coverId).catch(() => {});
          this.update(bookId, { coverId: record.id });
        } else {
          this.update(bookId, { attachmentIds: [...book.attachmentIds, record.id] });
        }
      }
      return record;
    },

    getFile(id) { return adapter.getBlob(id); },

    async removeFile(bookId, fileId) {
      await adapter.removeBlob(fileId).catch(() => {});
      const book = books.get(bookId);
      if (!book) return;
      if (book.coverId === fileId) this.update(bookId, { coverId: '' });
      else this.update(bookId, { attachmentIds: book.attachmentIds.filter((x) => x !== fileId) });
    },

    listFiles(bookId) { return adapter.listBlobsByBook(bookId); },

    // ------------------------------------------------------------ wholesale

    /** Everything except blobs — small enough to hand back as JSON. */
    exportJSON() {
      return {
        format: 'ponyo-library',
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: Object.fromEntries(settings),
        books: Array.from(books.values()).map(({ ...book }) => book),
      };
    },

    async wipe() {
      books.clear();
      settings.clear();
      await persist(async () => {
        await adapter.clear(COLLECTIONS.BOOKS);
        await adapter.clear(COLLECTIONS.SETTINGS);
      }, 'wipe');
    },
  };
}
