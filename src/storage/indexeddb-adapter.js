/**
 * indexeddb-adapter.js — the Phase 1 implementation of StorageAdapter.
 *
 * IndexedDB rather than localStorage for two reasons that actually matter
 * here: it stores real Blobs (her cover images and PDFs) without base64
 * bloat, and it has room for a library that keeps growing.
 *
 * The raw IndexedDB API is event-based and unpleasant, so the first third
 * of this file is a thin promise wrapper and the rest is the adapter.
 */

import { COLLECTIONS, StorageUnavailableError } from './adapter.js';

const DB_NAME = 'ponyo-library';
const DB_VERSION = 2;
const BLOB_STORE = 'files';

/** Wrap an IDBRequest as a promise. */
function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Resolve once a transaction has actually committed. */
function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

/**
 * Some environments neither succeed nor fail when opening IndexedDB:
 * private browsing modes, blocked third-party storage, and a tab holding
 * an upgrade open all leave the request hanging silently. A hang would
 * leave her staring at an empty library forever, so treat silence as a
 * failure and let the repository fall back to memory.
 */
const OPEN_TIMEOUT_MS = 4000;

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis) || !globalThis.indexedDB) {
      reject(new StorageUnavailableError('This browser has no IndexedDB.'));
      return;
    }

    let settled = false;
    const finish = (fn) => (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(
      () => finish(reject)(new StorageUnavailableError('IndexedDB did not respond.')),
      OPEN_TIMEOUT_MS,
    );
    resolve = finish(resolve);
    reject = finish(reject);

    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(new StorageUnavailableError('IndexedDB could not be opened.', error));
      return;
    }

    req.onupgradeneeded = (event) => {
      const db = req.result;
      const from = event.oldVersion;
      // Migrations are additive and ordered; add a new `if (from < N)`
      // block for each future schema change and bump DB_VERSION.
      if (from < 1) {
        const books = db.createObjectStore(COLLECTIONS.BOOKS, { keyPath: 'id' });
        books.createIndex('status', 'status', { unique: false });
        books.createIndex('updatedAt', 'updatedAt', { unique: false });

        db.createObjectStore(COLLECTIONS.SETTINGS, { keyPath: 'key' });

        const files = db.createObjectStore(BLOB_STORE, { keyPath: 'id' });
        files.createIndex('bookId', 'bookId', { unique: false });
      }
      if (from < 2) {
        // Covers moved out of the book record and into their own store,
        // so a picture can be replaced without rewriting the book.
        db.createObjectStore(COLLECTIONS.COVERS, { keyPath: 'id' });
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      // If another tab opens a newer version, step aside gracefully.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(new StorageUnavailableError('IndexedDB was blocked or denied.', req.error));
    req.onblocked = () => reject(new StorageUnavailableError('Another tab is holding an older version of the library open.'));
  });
}

export function createIndexedDbAdapter() {
  /** @type {IDBDatabase|null} */
  let db = null;

  const store = (name, mode) => db.transaction(name, mode).objectStore(name);

  return {
    name: 'indexeddb',

    async open() {
      if (db) return;
      db = await openDatabase();
    },

    async list(collection) {
      return request(store(collection, 'readonly').getAll());
    },

    async get(collection, id) {
      return request(store(collection, 'readonly').get(id));
    },

    async put(collection, record) {
      const tx = db.transaction(collection, 'readwrite');
      tx.objectStore(collection).put(record);
      await done(tx);
      return record;
    },

    async putMany(collection, records) {
      if (!records.length) return records;
      const tx = db.transaction(collection, 'readwrite');
      const os = tx.objectStore(collection);
      for (const record of records) os.put(record);
      await done(tx);
      return records;
    },

    async remove(collection, id) {
      const tx = db.transaction(collection, 'readwrite');
      tx.objectStore(collection).delete(id);
      await done(tx);
    },

    async clear(collection) {
      const tx = db.transaction(collection, 'readwrite');
      tx.objectStore(collection).clear();
      await done(tx);
    },

    async putBlob(record) {
      const tx = db.transaction(BLOB_STORE, 'readwrite');
      tx.objectStore(BLOB_STORE).put(record);
      await done(tx);
      return record;
    },

    async getBlob(id) {
      return request(store(BLOB_STORE, 'readonly').get(id));
    },

    async removeBlob(id) {
      const tx = db.transaction(BLOB_STORE, 'readwrite');
      tx.objectStore(BLOB_STORE).delete(id);
      await done(tx);
    },

    async listBlobsByBook(bookId) {
      return request(store(BLOB_STORE, 'readonly').index('bookId').getAll(bookId));
    },
  };
}
