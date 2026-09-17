/**
 * store.js — one object holding "what is on screen right now".
 *
 * Deliberately tiny: a plain state object, a set of listeners, and a
 * render pass batched to the next animation frame. No reactivity magic,
 * nothing to learn before you can read a view.
 *
 * Anything durable (books, settings) lives in the repository. Anything
 * transient (the current filter, the open drawer) lives here.
 */

/**
 * The views inside the app.
 *
 * There is deliberately no `home` here. The landing page is not a view:
 * it lives outside the router entirely, is built before the app renders
 * and removes itself on the way in — which is what makes "every reload
 * starts at the front door" true by construction. There is no route to
 * persist because there is no route.
 *
 * Everything durable (books, ratings, notes, files, themes) lives in the
 * repository and survives a reload untouched.
 */
export const VIEWS = Object.freeze({
  LIBRARY: 'library',
  /** The explorable building. An addition to the shelves, never a replacement. */
  BUILDING: 'building',
  DNA: 'dna',
  STATS: 'stats',
  SETTINGS: 'settings',
});

export const SHELVES = Object.freeze({
  ALL: 'all',
  READING: 'reading',
  TBR: 'tbr',
  READ: 'read',
  FAVOURITES: 'favourites',
  DNF: 'dnf',
});

export const SORTS = Object.freeze({
  SHELF: 'shelf',        // the arrangement of a real bookshelf: by author
  TITLE: 'title',
  RECENT: 'recent',
  RATING: 'rating',
  OLDEST: 'oldest',
});

export const DEFAULT_PREFS = Object.freeze({
  /** 'system' | 'light' | 'dark' — follows the OS until she says otherwise. */
  appearance: 'system',
  /** The palette currently showing. Derived; kept so a reload paints instantly. */
  theme: 'ocean',
  /** Her preferred palette in each family, remembered separately. */
  themeDark: 'ocean',
  themeLight: 'light',
  dynamicMoods: true,
  animations: true,
  readingFont: 'sans',
  textSize: 'normal',
  layout: 'shelves',     // 'shelves' | 'grid'
  hasEntered: false,
});

export function createStore(initial = {}) {
  const state = {
    view: VIEWS.LIBRARY,
    shelf: SHELVES.ALL,
    query: '',
    genre: '',
    author: '',
    minRating: 0,
    tag: '',
    sort: SORTS.SHELF,
    openBookId: null,

    /* ── library mode ── */
    /** Which floor she is on. */
    floor: 0,
    /** The id of the section she has stepped into, or null. */
    room: null,
    /** That section's world, so the page can re-tint without re-deriving it. */
    roomWorld: null,
    /**
     * Set when a genre was reached by walking through a door in Library
     * Mode rather than by filtering. Carries the floor to return to and
     * the genre it belongs to — the genre is what makes it
     * self-invalidating, so changing the filter silently drops it.
     */
    fromBuilding: null,
    /*
     * Where her character is standing is deliberately NOT here. It moves
     * several times a second, and every write to this store schedules a
     * render — which in Library Mode means rebuilding the character
     * mid-stride. It lives in the view instead. See library-mode.js.
     */

    /** the mood check-in: what she said today, and what it produced */
    mood: null,
    moodText: '',
    moodWords: [],
    moodSeed: 0,
    moodCollapsed: false,

    /** true when only books flagged for review should show */
    reviewOnly: false,

    prefs: { ...DEFAULT_PREFS },
    ready: false,
    ...initial,
  };

  const listeners = new Set();
  let frame = 0;
  let dirty = new Set();

  function flush() {
    frame = 0;
    const changed = dirty;
    dirty = new Set();
    for (const fn of listeners) fn(state, changed);
  }

  return {
    get state() { return state; },

    /** Read a slice without subscribing. */
    get(key) { return state[key]; },

    /**
     * Merge a patch and schedule one render.
     * Keys whose value did not actually change are dropped, so views can
     * cheaply ask "did the thing I care about move?".
     */
    set(patch) {
      let touched = false;
      for (const [key, value] of Object.entries(patch)) {
        if (key === 'prefs') {
          state.prefs = { ...state.prefs, ...value };
          dirty.add('prefs');
          touched = true;
          continue;
        }
        if (state[key] === value) continue;
        state[key] = value;
        dirty.add(key);
        touched = true;
      }
      if (!touched) return;
      if (!frame) frame = requestAnimationFrame(flush);
    },

    /** Force a render even when nothing in state moved (data changed underneath). */
    touch(reason = 'data') {
      dirty.add(reason);
      if (!frame) frame = requestAnimationFrame(flush);
    },

    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    /** Clear every refinement but keep the shelf and the view. */
    resetFilters() {
      this.set({ query: '', genre: '', author: '', minRating: 0, tag: '', reviewOnly: false });
    },

    hasFilters() {
      return Boolean(state.query || state.genre || state.author || state.minRating
        || state.tag || state.reviewOnly);
    },
  };
}
