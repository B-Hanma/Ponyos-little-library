/**
 * app.js — the shell: routing, global events, and the render loop.
 *
 * There is one render function. The store schedules it on the next frame
 * whenever anything changes, and it swaps the contents of #view. All
 * clicks inside #view are handled here by delegation, so views can stay
 * as pure markup functions.
 *
 * This file also owns the things that cut across every view: which world
 * is on stage, the mood check-in, celebrations and achievements.
 */

import { qs, qsa, on, debounce, esc } from '../utils/dom.js';
import { VIEWS, SHELVES } from '../state/store.js';
import { visibleBooks, moodFor } from '../state/selectors.js';
import {
  setMood as setPageMood, setTheme, setMoodsEnabled, setMotion, setReadingFont, setTextSize,
  resolveTheme, shuffleTheme, watchSystemScheme, THEMES,
} from '../theme/theme-manager.js';
import { renderLibrary } from './views/library.js';
import { renderLibraryMode, wireLibraryMode, teardownLibraryMode } from './views/library-mode.js';
import { renderDNA } from './views/dna.js';
import { renderStats } from './views/stats.js';
import { renderSettings, importDialogBody, importPreview } from './views/settings.js';
import { openBookDetail, bookForm, readForm } from './views/book-detail.js';
import { openModal, toast, confirmDialog } from './components/overlays.js';
import { openTriage } from './components/triage.js';
import { moodPose } from './components/mood-card.js';
import { createWorldStage, announceWorld } from './world-stage.js';
import { installCoverFallback, coverMarkup } from './covers.js';
import { celebrateFinish, mascotSays, sparkleAt } from './celebrate.js';
import { cat, catForWorld as worldMood } from './cat.js';
import { parseBookList, parseBackup } from '../data/import.js';
import { MOOD_BY_ID, interpret, recommend, CHAOS, randomBook } from '../analytics/recommend.js';
import { newlyEarned, earned, byId as achievementById } from '../analytics/achievements.js';
import { STATUS } from '../data/models.js';
import { genreMeta } from '../data/genres.js';
import {
  ADD_HINTS, TOASTS, WELCOME_BACK, GENRE_LINES, pick, roll, arrive,
} from '../data/quips.js';
import { SEED_BOOKS, SEED_VERSION } from '../data/seed-books.js';

const RENDERERS = {
  [VIEWS.LIBRARY]: renderLibrary,
  [VIEWS.BUILDING]: renderLibraryMode,
  [VIEWS.DNA]: renderDNA,
  [VIEWS.STATS]: renderStats,
  [VIEWS.SETTINGS]: renderSettings,
};

const today = () => new Date().toISOString().slice(0, 10);

export function createApp(ctx) {
  const { repo, store, cache } = ctx;
  const viewRoot = qs('#view');
  ctx.refresh = () => store.touch('book');

  installCoverFallback();

  // The kitten asleep at the foot of the rail. Rendered once — it is
  // chrome, not part of any view's markup.
  const railCat = qs('[data-rail-cat]');
  if (railCat) railCat.innerHTML = cat('sleep', { size: 44, tint: 'grey' });

  /* ───────────────────────────── the stage ───────────────────────── */

  const stage = createWorldStage();
  ctx.stage = stage;
  let lastWorld = null;
  let lastAnnouncedGenre = null;

  /* ─────────────────────────── achievements ──────────────────────── */

  /** Recomputed after every write; anything newly true is announced. */
  function checkAchievements({ silent = false } = {}) {
    const known = repo.getSetting('achievements', []) ?? [];
    const fresh = newlyEarned(repo.all(), known);
    if (!fresh.length) return [];
    repo.setSetting('achievements', earned(repo.all()));
    if (!silent) {
      fresh.forEach((id, i) => {
        const a = achievementById[id];
        setTimeout(() => toast(`${a.icon}  ${a.name} — ${a.blurb}`, { duration: 6000 }), i * 800);
      });
    }
    return fresh.map((id) => achievementById[id]);
  }
  ctx.checkAchievements = checkAchievements;

  /* ───────────────────────────── render ──────────────────────────── */

  function render() {
    const state = store.state;
    viewRoot.innerHTML = RENDERERS[state.view](ctx);
    syncChrome(state);
    syncWorld(state);
    syncRails();
    // Library mode is the one view with something live in it — a
    // character with a frame loop and a keyboard — so it is wired after
    // each render and torn down whenever the page is showing anything
    // else. A walk loop still running behind the Numbers page would keep
    // answering the arrow keys.
    if (state.view === VIEWS.BUILDING) wireLibraryMode(ctx, viewRoot);
    else teardownLibraryMode();
    document.title = state.view === VIEWS.LIBRARY
      ? "Ponyo's Little Library"
      : `${titleFor(state.view)} · Ponyo's Little Library`;
  }

  function titleFor(view) {
    return {
      library: 'Shelves',
      building: 'Library mode',
      dna: 'Reading DNA',
      stats: 'Numbers',
      settings: 'Yours',
    }[view] ?? 'Library';
  }

  function syncChrome(state) {
    for (const button of qsa('[data-nav]')) {
      button.classList.toggle('is-active', button.dataset.nav === state.view);
    }
    const clear = qs('#search-clear');
    if (clear) clear.hidden = !state.query;
  }

  /**
   * The world follows what is on screen. An explicit genre filter wins;
   * otherwise the dominant genre of the visible books decides, and a
   * mixed shelf stays home.
   */
  function syncWorld(state) {
    // While a book is open it owns the stage — it borrowed the world on
    // the way in and will hand it back on the way out. Without this, any
    // re-render behind the drawer (a rating, a note) would yank the page
    // back to the shelf's world mid-read.
    if (state.openBookId) return;

    let world = 'tide';
    if (state.view === VIEWS.LIBRARY) {
      world = moodFor(state, visibleBooks(repo.all(), state));
    } else if (state.view === VIEWS.DNA) {
      world = 'cosmos';
    } else if (state.view === VIEWS.BUILDING) {
      // Walking into a section changes the weather outside the building,
      // so the horror room really does darken the whole page. The room
      // carries its own world because the odd rooms — the study, the
      // glasshouse — are not genres and have nothing to look up.
      world = state.room ? (state.roomWorld ?? genreMeta(state.room).mood) : 'foxed';
    }
    setPageMood(world);
    stage.show(world);

    // Say something when she walks into a genre on purpose.
    if (state.genre && state.genre !== lastAnnouncedGenre) {
      lastAnnouncedGenre = state.genre;
      const extra = GENRE_LINES[state.genre];
      announceWorld(world, state.genre);
      if (extra) setTimeout(() => mascotSays(worldMood(world), roll(extra), { duration: 5000 }), 900);
    } else if (!state.genre) {
      lastAnnouncedGenre = null;
      if (world !== lastWorld && lastWorld !== null) announceWorld(world);
    }
    lastWorld = world;
  }

  /** A genre rail fades at its right edge until there is nothing left to scroll to. */
  function syncRails() {
    for (const rail of qsa('.shelf__rail', viewRoot)) {
      const wrap = rail.parentElement;
      const atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4;
      wrap.classList.toggle('is-end', atEnd);
    }
  }

  viewRoot.addEventListener('scroll', (event) => {
    if (event.target instanceof Element && event.target.classList.contains('shelf__rail')) syncRails();
  }, true);
  window.addEventListener('resize', debounce(() => { syncRails(); stage.refresh(); }, 200));

  store.subscribe(render);

  // The OS flipping to dark at sunset should flip the library with it,
  // but only while she has actually asked it to follow along.
  watchSystemScheme(() => {
    if (store.state.prefs.appearance !== 'system') return;
    applyResolvedTheme();
    if (store.state.view === VIEWS.SETTINGS) render();
  });

  /* ─────────────────────────── navigation ───────────────────────── */

  /**
   * Which message channel each page draws from. Arriving on a page
   * releases its held line so the page says something new — without
   * this, walking to Numbers and back would be greeted by the sentence
   * she just read.
   */
  const CHANNELS = {
    [VIEWS.LIBRARY]: ['shelf'],
    [VIEWS.BUILDING]: ['hall', 'room'],
    [VIEWS.DNA]: ['dna'],
    [VIEWS.STATS]: ['numbers'],
    [VIEWS.SETTINGS]: [],
  };

  function go(view) {
    for (const channel of CHANNELS[view] ?? ['shelf']) arrive(channel);
    store.set({ view });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  on(document, 'click', '[data-nav]', (event, el) => go(el.dataset.nav));

  /* ───────────────────────────── search ─────────────────────────── */

  const searchInput = qs('#search-input');
  searchInput.addEventListener('input', debounce((event) => {
    store.set({ query: event.target.value, view: VIEWS.LIBRARY });
  }, 140));
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { searchInput.value = ''; store.set({ query: '' }); }
  });
  qs('#search-clear').addEventListener('click', () => {
    searchInput.value = '';
    store.set({ query: '' });
    searchInput.focus();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || event.metaKey || event.ctrlKey) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.querySelector('.drawer, .modal')) return;
    event.preventDefault();
    searchInput.focus();
    searchInput.select();
  });

  /* ──────────────────────── view interactions ───────────────────── */

  on(viewRoot, 'click', '[data-open]', (event, el) => openBookDetail(ctx, el.dataset.open));

  on(viewRoot, 'click', '[data-quick]', (event, el) => {
    event.stopPropagation();
    const book = repo.get(el.dataset.id);
    if (!book) return;
    const next = el.dataset.quick;
    if (next === book.status) return;
    repo.update(book.id, { status: next });
    store.touch('book');
    if (next === STATUS.READ) {
      const fresh = checkAchievements({ silent: true });
      celebrateFinish(repo.get(book.id), { achievements: fresh });
    }
  });

  on(viewRoot, 'click', '[data-shelf]', (event, el) => store.set({ shelf: el.dataset.shelf }));

  /* ── library mode ── */
  on(viewRoot, 'click', '[data-floor]', (event, el) => {
    // The lift. A new floor means whatever room she was in is closed,
    // but where she stood on that floor is remembered — see `walkers`.
    store.set({ floor: Number(el.dataset.floor), room: null, roomWorld: null });
  });

  /**
   * Coming back out of a section onto the floor.
   *
   * Where she reappears is not decided here: walking into a room parked
   * her on its threshold, and the floor picks that up on its way back
   * in. This only has to close the room.
   */
  on(viewRoot, 'click', '[data-leave-room]', () => {
    store.set({ room: null, roomWorld: null });
  });

  /**
   * Leaving a genre she walked into from the building.
   *
   * The genre view is shared — Library Mode has no genre screen of its
   * own — so the only thing that differs is the way back. `fromBuilding`
   * remembers which floor, and the walker's saved position takes care of
   * putting her on the threshold she came through.
   */
  on(viewRoot, 'click', '[data-back-to-floor]', () => {
    const from = store.state.fromBuilding;
    store.set({
      view: VIEWS.BUILDING,
      floor: from?.floor ?? 0,
      genre: '',
      room: null,
      roomWorld: null,
      fromBuilding: null,
    });
    window.scrollTo({ top: 0, behavior: 'auto' });
  });

  on(viewRoot, 'change', '[data-filter]', (event, el) => {
    const key = el.dataset.filter;
    const value = key === 'minRating' ? Number(el.value) : el.value;
    store.set({ [key]: value });
  });

  on(viewRoot, 'click', '[data-clear-filters]', () => {
    searchInput.value = '';
    store.resetFilters();
  });

  const jumpTo = (patch) => {
    store.set({ view: VIEWS.LIBRARY, shelf: SHELVES.ALL, query: '', genre: '', author: '', tag: '', ...patch });
    searchInput.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  // The map islands and constellation stars are SVG groups, so they need
  // their keyboard behaviour spelled out the way a <button> gets it free.
  on(viewRoot, 'keydown', '[role="button"][tabindex="0"]', (event, el) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  on(viewRoot, 'click', '[data-see-genre]', (e, el) => jumpTo({ genre: el.dataset.seeGenre }));
  on(viewRoot, 'click', '[data-see-author]', (e, el) => jumpTo({ author: el.dataset.seeAuthor }));
  on(viewRoot, 'click', '[data-see-tag]', (e, el) => jumpTo({ tag: el.dataset.seeTag }));
  on(viewRoot, 'click', '[data-see-shelf]', (e, el) => jumpTo({ shelf: el.dataset.seeShelf }));

  on(viewRoot, 'click', '[data-review-toggle]', () => {
    store.set({ reviewOnly: !store.state.reviewOnly });
  });

  on(viewRoot, 'click', '[data-toggle-layout]', () => {
    savePref({ layout: store.state.prefs.layout === 'shelves' ? 'grid' : 'shelves' });
  });

  /* ──────────────────────── the mood check-in ───────────────────── */

  function computeRecs() {
    const state = store.state;
    if (!state.mood) return [];
    const mood = MOOD_BY_ID[state.mood];
    if (!mood) return [];
    return recommend(repo.all(), mood, {
      extraWords: state.moodWords ?? [],
      limit: 4,
      seed: state.moodSeed ?? 0,
    });
  }
  ctx.computeRecs = computeRecs;

  function setMoodId(id, { words = [], announce = true } = {}) {
    store.set({ mood: id, moodWords: words, moodSeed: 0, moodCollapsed: false });
    repo.setSetting('mood', id);
    repo.setSetting('moodWords', words);
    repo.setSetting('moodDate', today());
    if (announce && MOOD_BY_ID[id]) mascotSays(moodPose(id), MOOD_BY_ID[id].line, { duration: 5200 });
  }
  ctx.setMoodId = setMoodId;

  on(viewRoot, 'click', '[data-mood]', (event, el) => setMoodId(el.dataset.mood));

  on(viewRoot, 'submit', '[data-mood-form]', (event, el) => {
    event.preventDefault();
    const text = qs('[data-mood-text]', el)?.value ?? '';
    const { mood, extraWords, matched } = interpret(text);
    store.set({ moodText: text });
    repo.setSetting('moodText', text);
    setMoodId(mood.id, { words: extraWords, announce: false });
    mascotSays(moodPose(mood.id), matched
      ? mood.line
      : 'Not sure I follow, but here is something anyway.', { duration: 5200 });
  });

  on(viewRoot, 'click', '[data-mood-more]', () => {
    store.set({ moodSeed: (store.state.moodSeed ?? 0) + 4 });
  });

  on(viewRoot, 'click', '[data-mood-collapse]', () => {
    store.set({ moodCollapsed: true });
    repo.setSetting('moodCollapsed', true);
  });
  on(viewRoot, 'click', '[data-mood-expand]', () => {
    store.set({ moodCollapsed: false });
    repo.setSetting('moodCollapsed', false);
  });

  /* ───────────────────────────── surprise me ─────────────────────── */

  function openSurprise() {
    openModal({
      title: 'What kind of chaos are we choosing today?',
      subtitle: 'Everything here comes from books you already own.',
      body: `<div class="chaos-grid">
        ${CHAOS.map((c) => `
          <button class="chaos" type="button" data-chaos="${c.id}">
            <span class="chaos__emoji" aria-hidden="true">${c.emoji}</span>
            <span class="chaos__label">${c.label}</span>
            <span class="chaos__line">${c.line}</span>
          </button>`).join('')}
      </div>`,
      onMount(panel, close) {
        panel.addEventListener('click', (event) => {
          const btn = event.target.closest('[data-chaos]');
          if (!btn) return;
          const choice = CHAOS.find((c) => c.id === btn.dataset.chaos);
          close();
          revealSurprise(choice);
        });
      },
    });
  }
  ctx.openSurprise = openSurprise;

  function revealSurprise(choice) {
    const books = repo.all();
    let book = null;
    let why = choice.line;

    if (choice.id === 'random') {
      book = randomBook(books);
    } else {
      const moodId = choice.id === 'mymood' ? (store.state.mood ?? 'justread') : choice.moodId;
      const mood = MOOD_BY_ID[moodId] ?? MOOD_BY_ID.justread;
      // Ask for a wide band and pick from it at random. Taking the top
      // match every time would make "roll again" hand back the same book,
      // which is the one thing a dice button must never do.
      const hits = recommend(books, mood, { limit: 12, seed: Math.floor(Math.random() * 97) });
      const pool = hits.length ? hits : [];
      book = pool.length
        ? pool[Math.floor(Math.random() * pool.length)].book
        : randomBook(books);
      if (choice.id === 'mymood' && store.state.mood) why = mood.line;
    }

    if (!book) { toast('There is nothing on the shelves to pick from yet.'); return; }

    openModal({
      title: 'Here.',
      size: 'sm',
      body: `
        <div style="display:grid;justify-items:center;gap:var(--sp-3);text-align:center">
          ${cat('cheer', { size: 66, className: 'cat--alive' })}
          <p class="muted" style="font-family:var(--font-display);font-style:italic">${why}</p>
          <div class="rec" style="width:100%;pointer-events:none">
            <span class="rec__cover">${coverFor(book)}</span>
            <span class="rec__body">
              <span class="rec__title">${esc(book.title)}</span>
              <span class="rec__author">${esc(book.author)}</span>
              ${book.genre ? `<span class="rec__why">${esc(book.genre)}</span>` : ''}
            </span>
          </div>
        </div>`,
      footer: `
        <button class="btn" type="button" data-again>Roll again</button>
        <button class="btn btn--primary" type="button" data-open-it>Open it</button>`,
      onMount(panel, close) {
        qs('[data-again]', panel).addEventListener('click', () => { close(); revealSurprise(choice); });
        qs('[data-open-it]', panel).addEventListener('click', () => { close(); openBookDetail(ctx, book.id); });
      },
    });
  }

  function coverFor(book) {
    return coverMarkup(book, cache);
  }

  qs('#surprise-btn')?.addEventListener('click', openSurprise);
  on(document, 'click', '[data-action="surprise"]', openSurprise);

  /* ── the rail's two non-route buttons ── */

  // Back out to the front door. main.js owns the landing page, so it
  // hands us a way to re-open it rather than us rebuilding one here.
  on(document, 'click', '[data-action="landing"]', () => ctx.showLanding?.());

  // Mood lives on the shelves, above everything. Jumping to it means
  // going there and expanding it if she had folded it away.
  on(document, 'click', '[data-action="mood"]', () => {
    store.set({ view: VIEWS.LIBRARY, genre: '', moodCollapsed: false });
    repo.setSetting('moodCollapsed', false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ─────────────────────────── preferences ──────────────────────── */

  function savePref(patch) {
    store.set({ prefs: patch });
    for (const [key, value] of Object.entries(patch)) repo.setSetting(key, value);

    if ('theme' in patch) setTheme(patch.theme);
    // Appearance is the dial; theme is what it resolves to. Changing
    // either re-resolves both, so "follow the system" can override a
    // palette she picked in the other family.
    if ('appearance' in patch || 'themeLight' in patch || 'themeDark' in patch) {
      applyResolvedTheme();
    }
    if ('dynamicMoods' in patch) {
      setMoodsEnabled(patch.dynamicMoods);
      stage.setEnabled(patch.dynamicMoods && store.state.prefs.animations !== false);
      syncWorld(store.state);
    }
    if ('animations' in patch) {
      setMotion(patch.animations);
      stage.setEnabled(patch.animations && store.state.prefs.dynamicMoods !== false);
    }
    if ('readingFont' in patch) setReadingFont(patch.readingFont);
    if ('textSize' in patch) setTextSize(patch.textSize);
  }
  ctx.savePref = savePref;

  /**
   * Re-resolve the palette from the appearance dial and write the result
   * back, so a reload paints the right one on the first frame instead of
   * flashing the old palette and correcting itself.
   */
  function applyResolvedTheme() {
    const prefs = store.state.prefs;
    const theme = setTheme(resolveTheme(prefs));
    if (theme !== prefs.theme) {
      store.set({ prefs: { theme } });
      repo.setSetting('theme', theme);
    }
    return theme;
  }

  /**
   * Picking a palette pins her to that family — choosing Midnight in
   * broad daylight should show Midnight, not be silently overruled by
   * the system setting a frame later. It is also remembered as her
   * favourite for that family.
   */
  on(viewRoot, 'click', '[data-set-theme]', (event, el) => {
    const theme = el.dataset.setTheme;
    const scheme = THEMES[theme]?.scheme === 'light' ? 'light' : 'dark';
    savePref({
      theme,
      appearance: scheme,
      [scheme === 'light' ? 'themeLight' : 'themeDark']: theme,
    });
    render();
  });

  on(viewRoot, 'click', '[data-set-appearance]', (event, el) => {
    savePref({ appearance: el.dataset.setAppearance });
    render();
  });

  on(viewRoot, 'click', '[data-action="shuffle-theme"]', () => {
    const prefs = store.state.prefs;
    // Pinned to light or dark? Stay in that family — a "surprise" that
    // flipped the whole page from dark to white reads as a fault.
    const scheme = prefs.appearance === 'system' ? undefined : prefs.appearance;
    const next = shuffleTheme(prefs.theme, scheme);
    const family = THEMES[next]?.scheme === 'light' ? 'light' : 'dark';
    savePref({
      theme: next,
      appearance: family,
      [family === 'light' ? 'themeLight' : 'themeDark']: next,
    });
    render();
    toast(`${THEMES[next].label}. ${THEMES[next].desc}`);
  });
  on(viewRoot, 'click', '[data-set-font]', (e, el) => savePref({ readingFont: el.dataset.setFont }));
  on(viewRoot, 'click', '[data-set-size]', (e, el) => savePref({ textSize: el.dataset.setSize }));
  on(viewRoot, 'click', '[data-toggle]', (event, el) => {
    const key = el.dataset.toggle;
    const prefs = store.state.prefs;
    if (key === 'layoutShelves') savePref({ layout: prefs.layout === 'shelves' ? 'grid' : 'shelves' });
    else savePref({ [key]: !prefs[key] });
  });

  /* ──────────────────────────── data tools ──────────────────────── */

  on(viewRoot, 'click', '[data-action="triage"]', () => openTriage(ctx));
  on(viewRoot, 'click', '[data-action="import"]', () => openImport());
  on(viewRoot, 'click', '[data-action="export"]', () => exportBackup());
  on(viewRoot, 'click', '[data-action="reset"]', () => resetEverything());
  on(viewRoot, 'click', '[data-action="add-book"]', () => openAddBook());

  function openImport() {
    let parsed = { books: [], skipped: [] };
    openModal({
      title: 'Import a book list',
      body: importDialogBody(),
      footer: `
        <button class="btn" type="button" data-close>Cancel</button>
        <button class="btn btn--primary" type="button" data-do-import>Shelve them</button>`,
      onMount(panel, close) {
        const textarea = qs('[data-import]', panel);
        const update = () => {
          parsed = parseBookList(textarea.value);
          importPreview(panel, parsed.report);
        };
        textarea.addEventListener('input', debounce(update, 200));

        qs('[data-import-file]', panel).addEventListener('change', async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const text = await file.text();
          const backup = parseBackup(text);
          if (backup) {
            const { added } = repo.importBooks(backup.books);
            store.touch('book');
            close();
            toast(added ? `${added} restored from the backup.` : TOASTS.nothingImported);
            return;
          }
          textarea.value = text;
          update();
        });

        qs('[data-do-import]', panel).addEventListener('click', () => {
          if (!parsed.books.length) { toast('Nothing readable in there yet.'); return; }
          const { added, skipped } = repo.importBooks(parsed.books);
          store.touch('book');
          checkAchievements();
          close();
          toast(added
            ? `${added} ${added === 1 ? 'book' : 'books'} shelved.${skipped ? ` ${skipped} already here.` : ''}`
            : TOASTS.nothingImported);
        });
      },
    });
  }

  function exportBackup() {
    const data = repo.exportJSON();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ponyo-library-${today()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Backup downloaded. Attachments stay on this device.');
  }

  async function resetEverything() {
    const ok = await confirmDialog({
      title: 'Erase the whole library?',
      message: 'Every book, rating, note, tag and attached file on this device will be deleted, and the original shelves will be rebuilt. This cannot be undone.',
      confirmLabel: 'Erase everything',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;
    await repo.wipe();
    await repo.seed(SEED_BOOKS, SEED_VERSION);
    store.set({ prefs: { layout: 'shelves' }, mood: null, moodWords: [], moodText: '' });
    store.touch('book');
    toast('Back to the beginning.');
  }

    /* ───────────────────────────── add book ───────────────────────── */

  function openAddBook() {
    openModal({
      title: 'Add a book',
      subtitle: pick(ADD_HINTS, String(repo.count())),
      body: bookForm({ status: 'tbr' }),
      footer: `
        <button class="btn" type="button" data-close>Cancel</button>
        <button class="btn btn--primary" type="button" data-save>Put it on the shelf</button>`,
      onMount(panel, close) {
        qs('[data-save]', panel).addEventListener('click', () => {
          const values = readForm(panel);
          if (!values.title) { toast('It needs a title, at least.'); return; }
          const book = repo.add(values);
          store.touch('book');
          checkAchievements();
          close();
          toast(TOASTS.added, { action: { label: 'Open it', onClick: () => openBookDetail(ctx, book.id) } });
        });
        panel.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' && event.target.tagName === 'INPUT') {
            event.preventDefault();
            qs('[data-save]', panel).click();
          }
        });
      },
    });
  }
  ctx.openAddBook = openAddBook;
  qs('#add-book-btn')?.addEventListener('click', openAddBook);

  /* ──────────────────────────── odds and ends ───────────────────── */

  on(viewRoot, 'click', '[data-heart]', (event, el) => {
    const book = repo.get(el.dataset.heart);
    if (!book) return;
    repo.update(book.id, { favourite: !book.favourite });
    if (!book.favourite) sparkleAt(el);
    store.touch('book');
    checkAchievements();
  });

  repo.subscribe((event) => {
    if (event.type === 'error') {
      toast('Something could not be saved. Your browser may be out of space.', { duration: 8000 });
    }
  });

  cache.onResolved(() => store.touch('covers'));

  /**
   * Called by main.js once the landing page has let her through.
   *
   * The kitten follows her in and says one thing. Deliberately NOT a
   * "welcome back, returning visitor" message: she is the only member
   * this library will ever have, so treating a second visit as a
   * milestone reads as a stranger being polite to her.
   */
  function greet() {
    setTimeout(() => mascotSays('wave', roll(WELCOME_BACK), { duration: 6000 }), 700);
    checkAchievements({ silent: true });
  }

  return { render, go, openAddBook, greet, openSurprise, stage };
}
