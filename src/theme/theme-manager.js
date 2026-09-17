/**
 * theme-manager.js — the only place allowed to touch <html> attributes.
 *
 * Three independent dials:
 *
 *   appearance — light, dark, or follow the system. This is the dial
 *                people expect to find, and it works even if she never
 *                opens the palette picker.
 *   theme      — which palette, within that light/dark family. Ocean and
 *                Midnight are dark; Daylight and Parchment are light.
 *                Warm library is dark. She picks one per family and the
 *                app remembers both.
 *   mood       — set by what she is looking at right now. Filtering to
 *                Mystery tilts the page cool; opening a romance tilts it
 *                warm. She never picks this.
 *
 * Mood changes are debounced and coalesced, because scrolling past four
 * genre shelves should not strobe the page. If she turns moods off in
 * Settings, everything stays on the house mood and nothing else in the
 * app has to know.
 *
 * ── ADDING A THEME ────────────────────────────────────────────────
 * Two steps, and nothing else in the app changes:
 *   1. a palette block in styles/tokens.css — [data-theme="yours"] —
 *      plus one line in the --world-ink / --world-bg table so the genre
 *      scenery knows whether to draw light lines or dark ones;
 *   2. an entry below, with `scheme` saying which family it belongs to.
 * The picker, the shuffle and the light/dark dial all read this object,
 * so a new theme appears in all three for free.
 */

export const THEMES = Object.freeze({
  ocean: {
    label: 'Ocean',
    desc: 'Evening, underwater. The house style.',
    scheme: 'dark',
    strip: 'linear-gradient(90deg,#07161f,#143143,#7fd8d0,#ff6f61)',
  },
  light: {
    label: 'Daylight',
    desc: 'Pearl and sea glass. Good for afternoons.',
    scheme: 'light',
    strip: 'linear-gradient(90deg,#f6f3ec,#e9e2d3,#7fd8d0,#ff6f61)',
  },
  dark: {
    label: 'Midnight',
    desc: 'Plain and quiet. For reading at 2am.',
    scheme: 'dark',
    strip: 'linear-gradient(90deg,#101012,#232329,#8fb3d9,#c96a63)',
  },
  library: {
    label: 'Warm library',
    desc: 'Lamplight, old wood, a blanket.',
    scheme: 'dark',
    strip: 'linear-gradient(90deg,#22170f,#3d2b20,#e3b04b,#cf9b6e)',
  },
  parchment: {
    label: 'Parchment',
    desc: 'Old paper and ink, read by a window.',
    scheme: 'light',
    strip: 'linear-gradient(90deg,#efe6d2,#e2d5b9,#b07d3a,#8a5a3c)',
  },
});

/** 'system' | 'light' | 'dark' */
export const APPEARANCES = Object.freeze(['system', 'light', 'dark']);

export const themesOfScheme = (scheme) =>
  Object.entries(THEMES).filter(([, t]) => t.scheme === scheme).map(([key]) => key);

/** The default palette for each family, used when she has never picked one. */
const DEFAULT_FOR_SCHEME = Object.freeze({ dark: 'ocean', light: 'light' });

const systemQuery = window.matchMedia('(prefers-color-scheme: dark)');

/** What the operating system is currently asking for. */
export function systemScheme() {
  return systemQuery.matches ? 'dark' : 'light';
}

export const HOUSE_MOOD = 'tide';

const root = document.documentElement;

let currentMood = HOUSE_MOOD;
let moodsEnabled = true;
let pendingMood = null;
let frame = 0;

/** Apply the base palette. */
export function setTheme(theme) {
  const name = THEMES[theme] ? theme : 'ocean';
  root.dataset.theme = name;
  // Tells the browser to render form controls and scrollbars to match,
  // which is the difference between a dark theme and a dark theme with
  // a white scrollbar down the side of it.
  root.style.colorScheme = THEMES[name].scheme;
  return name;
}

/**
 * Which palette should be showing, given the appearance dial and the
 * palettes she has chosen in each family.
 *
 * @param {{appearance?: string, theme?: string, themeLight?: string, themeDark?: string}} prefs
 */
export function resolveTheme(prefs = {}) {
  const wanted = APPEARANCES.includes(prefs.appearance) ? prefs.appearance : 'system';
  const scheme = wanted === 'system' ? systemScheme() : wanted;

  const chosen = scheme === 'dark' ? prefs.themeDark : prefs.themeLight;
  if (THEMES[chosen]?.scheme === scheme) return chosen;

  // Her single `theme` preference still counts if it happens to be in
  // the right family — that is the pre-appearance setting, migrated.
  if (THEMES[prefs.theme]?.scheme === scheme) return prefs.theme;

  return DEFAULT_FOR_SCHEME[scheme];
}

/**
 * Follow the OS while the appearance dial says "system".
 * Returns an unsubscribe function.
 */
export function watchSystemScheme(onChange) {
  const handler = () => onChange(systemScheme());
  systemQuery.addEventListener('change', handler);
  return () => systemQuery.removeEventListener('change', handler);
}

/**
 * A different palette from the one showing now.
 *
 * Honest about its constraints: it will not hand back the theme she is
 * already looking at, and if the appearance dial is pinned to light or
 * dark it only shuffles within that family — a "surprise" that flipped
 * the page from dark to white would read as a bug.
 *
 * @param {string} current
 * @param {string} [scheme] restrict to one family
 */
export function shuffleTheme(current, scheme) {
  const pool = (scheme ? themesOfScheme(scheme) : Object.keys(THEMES))
    .filter((key) => key !== current);
  if (!pool.length) return current;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Turn the dynamic genre moods on or off wholesale. */
export function setMoodsEnabled(enabled) {
  moodsEnabled = Boolean(enabled);
  if (!moodsEnabled) commit(HOUSE_MOOD);
  return moodsEnabled;
}

export function getMood() { return currentMood; }

/**
 * Ask for a mood. Several calls in the same frame collapse into one,
 * so a re-render that touches twenty cards still only repaints once.
 */
export function setMood(mood) {
  const next = moodsEnabled ? (mood || HOUSE_MOOD) : HOUSE_MOOD;
  if (next === currentMood && !pendingMood) return;
  pendingMood = next;
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const value = pendingMood;
    pendingMood = null;
    commit(value);
  });
}

function commit(mood) {
  if (mood === currentMood) return;
  currentMood = mood;
  root.dataset.mood = mood;
}

/** Temporarily borrow a mood (a drawer opening), then hand it back. */
export function borrowMood(mood) {
  const previous = currentMood;
  setMood(mood);
  return () => setMood(previous);
}

// ─────────────────────────── other preferences ───────────────────────────

export function setReadingFont(font) {
  const value = font === 'serif' ? 'serif' : 'sans';
  root.dataset.readingFont = value;
  return value;
}

export function setTextSize(size) {
  const value = ['normal', 'cozy', 'large'].includes(size) ? size : 'normal';
  root.dataset.textSize = value;
  return value;
}

/**
 * Motion has two switches: the OS preference and hers.
 * The OS one is honoured in CSS; this only handles her override.
 */
export function setMotion(enabled) {
  root.dataset.motion = enabled ? 'on' : 'off';
  return enabled;
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Apply a whole settings object at once. Used on boot and after any
 * appearance change. Returns the palette that ended up showing, which
 * is not always the one in `prefs.theme` — "follow the system" gets the
 * last word.
 */
export function applyPreferences(prefs) {
  const theme = setTheme(resolveTheme(prefs));
  setMoodsEnabled(prefs.dynamicMoods);
  setReadingFont(prefs.readingFont);
  setTextSize(prefs.textSize);
  setMotion(prefs.animations);
  return theme;
}
