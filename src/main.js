/**
 * main.js — boot.
 *
 * Wires the pieces together and gets out of the way:
 *
 *   storage  →  repository  →  store  →  app
 *
 * The repository is handed an IndexedDB adapter here, and that is the
 * only line in the entire codebase that knows where the data lives.
 * Phase 2 replaces this one import.
 *
 * ── THE FRONT DOOR ────────────────────────────────────────────────
 * The landing page is mounted here, before the app is shown, and it is
 * NOT a route. That is the whole mechanism behind "every reload starts
 * at the front door": there is no current page to persist, so there is
 * nothing to restore. Everything durable — books, statuses, ratings,
 * notes, tags, files, preferences — is in the repository and comes back
 * exactly as it was.
 */

import { qs } from './utils/dom.js';
import { createIndexedDbAdapter } from './storage/indexeddb-adapter.js';
import { createRepository } from './storage/repository.js';
import { createStore, DEFAULT_PREFS, VIEWS } from './state/store.js';
import { createCoverCache } from './ui/cover-urls.js';
import { createApp } from './ui/app.js';
import { applyPreferences, prefersReducedMotion } from './theme/theme-manager.js';
import { SEED_BOOKS, SEED_VERSION, RETIRED_KEYS } from './data/seed-books.js';
import { loadPortraits } from './data/portraits.js';
import { mountLanding } from './ui/landing.js';
import { toast } from './ui/components/overlays.js';

async function boot() {
  // ── storage ──
  //
  // Her artwork is indexed at the same time as the books, because the
  // landing page is built synchronously the moment this resolves and a
  // picture that arrived a beat later would pop in after the page had
  // settled. It is one small local JSON file and it never rejects — an
  // empty folder is a valid answer.
  const repo = createRepository(createIndexedDbAdapter());
  const [result] = await Promise.all([
    repo.init({
      seedBooks: SEED_BOOKS,
      seedVersion: SEED_VERSION,
      retiredKeys: RETIRED_KEYS,
    }),
    loadPortraits(),
  ]);

  // ── preferences ──
  const prefs = { ...DEFAULT_PREFS };
  for (const key of Object.keys(DEFAULT_PREFS)) {
    const stored = repo.getSetting(key, undefined);
    if (stored !== undefined && stored !== null) prefs[key] = stored;
  }
  // Respect the OS setting the first time; after that her toggle wins.
  if (repo.getSetting('animations', undefined) === undefined && prefersReducedMotion()) {
    prefs.animations = false;
  }
  applyPreferences(prefs);

  // ── the mood check-in, if she already answered today ──
  const moodDate = repo.getSetting('moodDate', null);
  const sameDay = moodDate === new Date().toISOString().slice(0, 10);

  // ── state + app ──
  const store = createStore({
    prefs,
    mood: sameDay ? repo.getSetting('mood', null) : null,
    moodWords: sameDay ? (repo.getSetting('moodWords', []) ?? []) : [],
    moodText: sameDay ? (repo.getSetting('moodText', '') ?? '') : '',
    moodCollapsed: sameDay ? Boolean(repo.getSetting('moodCollapsed', false)) : false,
  });
  const cache = createCoverCache(repo);
  const ctx = { repo, store, cache };
  const app = createApp(ctx);

  // Scenery is part of the motion budget: no movement, no stage.
  app.stage.setEnabled(prefs.animations !== false && prefs.dynamicMoods !== false);
  store.set({ ready: true });

  // ── the front door ──
  //
  // The app is rendered behind the landing page rather than after it, so
  // stepping through the door reveals a page that is already built
  // instead of one that starts building as the curtain lifts.
  app.render();

  function openLanding() {
    qs('#app').hidden = true;
    mountLanding({
      repo,
      onEnter(view) {
        qs('#app').hidden = false;
        // A door on the landing page can ask for any destination; the
        // button in the middle asks for the shelves.
        if (view && view !== store.state.view) app.go(view);
        qs('#main')?.focus({ preventScroll: true });
        app.greet();
      },
    });
  }

  // The rail's first button goes back out to the front door. Handing the
  // app a way to re-open it keeps the landing page's ownership in one
  // place: main.js builds it, main.js rebuilds it.
  ctx.showLanding = openLanding;
  openLanding();

  if (repo.isDegraded) {
    setTimeout(() => toast(
      'This browser will not let the library save anything, so nothing you change here will survive a refresh.',
      { duration: 10000 },
    ), 1400);
  }
  if (result.toppedUp) {
    setTimeout(() => toast('A few new books appeared on the shelves.'), 1600);
  }
}

boot().catch((error) => {
  console.error('[library] failed to open', error);
  document.body.innerHTML = `
    <div style="display:grid;place-items:center;min-height:100dvh;padding:2rem;text-align:center;
                font-family:Georgia,serif;color:#eaf4f6;background:#07161f">
      <div style="max-width:32rem">
        <p style="font-size:3rem;margin:0 0 1rem">&#128218;</p>
        <h1 style="font-size:1.6rem;margin:0 0 .75rem">The library would not open.</h1>
        <p style="opacity:.75;line-height:1.7">
          Something went wrong while starting up. Refreshing usually fixes it.
          If it does not, the details are in the browser console.
        </p>
      </div>
    </div>`;
});
