/**
 * platform.js — the one module allowed to know what it is running on.
 *
 * `main.js` asks for storage and gets an adapter. Everything above it —
 * the repository, the store, every view — stays exactly as it was and
 * never learns whether the library is in a browser database or in a
 * folder on her Mac.
 *
 *   browser  →  createIndexedDbAdapter()        unchanged, forever
 *   desktop  →  migrate if needed, then the filesystem
 *
 * ── TAURI DETECTION LIVES HERE AND NOWHERE ELSE ───────────────────
 * Exactly one expression in the codebase reads `window.__TAURI__`, and
 * it is `isDesktop()` below. If the desktop shell is ever replaced with
 * something else, this file changes and nothing else does.
 *
 * The Tauri APIs are read off the global rather than imported, because
 * this project has no build step and is not getting one for this. With
 * `app.withGlobalTauri` enabled, `window.__TAURI__.fs` is the same
 * plugin the npm package wraps.
 *
 * ── UNVERIFIED ────────────────────────────────────────────────────
 * `createTauriFileSystem` has never run against a real Tauri build —
 * there is no Rust toolchain on the machine this was written on. Its
 * shape follows the documented Tauri v2 fs plugin, and the adapter
 * above it is fully tested against a filesystem backend, so if a call
 * signature here is wrong the fix is in this function alone. Nothing
 * else depends on being right about Tauri.
 */

import { createIndexedDbAdapter } from './indexeddb-adapter.js';
import { createFsAdapter } from './fs-adapter.js';
import { runMigration, readMigrationState } from './migrate.js';

/** Where the library lives inside the app's own data directory. */
export const LIBRARY_ROOT = 'library';

/** Is this the desktop build? */
export function isDesktop() {
  return typeof globalThis !== 'undefined' && Boolean(globalThis.__TAURI__?.fs);
}

/**
 * Wrap Tauri's fs plugin in the small backend `createFsAdapter` wants.
 *
 * Everything is resolved against `BaseDirectory.AppData`, so no absolute
 * path is ever constructed here and the app cannot read outside its own
 * folder even if a record id tried to.
 */
export function createTauriFileSystem(tauri = globalThis.__TAURI__) {
  const fs = tauri.fs;
  const baseDir = fs.BaseDirectory.AppData;
  const at = { baseDir };

  return {
    async mkdir(path) {
      if (await fs.exists(path, at)) return;
      await fs.mkdir(path, { baseDir, recursive: true });
    },
    exists: (path) => fs.exists(path, at),
    readTextFile: (path) => fs.readTextFile(path, at),
    writeTextFile: (path, text) => fs.writeTextFile(path, text, at),
    async readFile(path) { return new Uint8Array(await fs.readFile(path, at)); },
    writeFile: (path, bytes) => fs.writeFile(path, bytes, at),
    rename: (from, to) => fs.rename(from, to, { oldPathBaseDir: baseDir, newPathBaseDir: baseDir }),
    remove: (path) => fs.remove(path, at),
    async readDir(path) {
      const entries = await fs.readDir(path, at);
      return entries.map((entry) => entry.name);
    },
  };
}

/**
 * Open storage for whatever this is running on.
 *
 * @param {Object} [options]
 * @param {Object} [options.fs]      a filesystem backend, for tests
 * @param {string} [options.root]    library directory
 * @param {boolean} [options.desktop] override detection, for tests
 * @param {Function} [options.onProgress] migration progress
 * @returns {Promise<{adapter: Object, mode: string, migration: Object|null}>}
 */
export async function createStorage({
  fs = null,
  root = LIBRARY_ROOT,
  desktop = null,
  onProgress = null,
} = {}) {
  const useDesktop = desktop === null ? isDesktop() : desktop;

  if (!useDesktop) {
    // The browser path is deliberately identical to what main.js did
    // before this file existed. Nothing here touches it.
    return { adapter: createIndexedDbAdapter(), mode: 'indexeddb', migration: null };
  }

  const backend = fs || createTauriFileSystem();

  // One decision, made once, on the evidence on disk: is there already
  // a finished filesystem library here?
  const state = await readMigrationState(backend, root);

  // `adopted` rather than null on the common path. Null is what the
  // browser returns, and "there was nothing to migrate because this is a
  // browser" and "there was nothing to migrate because it already
  // happened" are different answers that a caller may want to tell
  // apart. The check is skipped rather than re-run — this is every
  // launch after the first.
  const migration = state.status === 'complete'
    ? { mode: 'adopted', counts: state.marker?.counts ?? null, backup: state.marker?.backup ?? null }
    : await runMigration({ fs: backend, root, state, onProgress });

  const adapter = createFsAdapter({ fs: backend, root });
  return { adapter, mode: 'filesystem', migration };
}
