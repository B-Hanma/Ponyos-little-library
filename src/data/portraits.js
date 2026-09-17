/**
 * portraits.js — her own pictures, and where they are allowed to appear.
 *
 * ── WHY THERE IS A MANIFEST ───────────────────────────────────────
 * A web page cannot list a directory. It can only ask for a file by
 * name. So `assets/ponyo/manifest.json` is the index: a script writes
 * it from whatever is actually in the folder, and the app reads it and
 * nothing else. Adding a picture later never means editing code, and
 * no filename is hardcoded anywhere in the UI.
 *
 * ── WHY IT DEGRADES INSTEAD OF BREAKING ───────────────────────────
 * The folder can legitimately be empty. When it is, every frame in the
 * app falls back to drawn artwork — an empty frame with the little sea
 * creature sitting in it. It does NOT substitute a photograph of some
 * stranger from the internet, because a picture of the wrong person is
 * worse than no picture.
 *
 * ── SLOTS ─────────────────────────────────────────────────────────
 * A picture can say where it belongs by having one of the slot names in
 * its filename ("study-desk.jpg"). Anything untagged is eligible
 * everywhere, which is the sane default: most people will drop in eight
 * pictures and never think about it again.
 *
 * ── ROTATION ──────────────────────────────────────────────────────
 * Which picture shows is a pure function of (slot, token). The token is
 * the visit id, so a reload changes the picture and a re-render during
 * the same visit does not — a hero that reshuffled every time she
 * rated a book would read as a glitch.
 */

import { buildScenes } from './scenes.js';

export const SLOTS = Object.freeze(['home', 'dna', 'study', 'gallery']);

/**
 * Where the index lives.
 *
 * Resolved against this module's own URL rather than against the page,
 * because a plain relative path silently means something different
 * depending on which page is asking. A harness served from /tools/ got
 * /tools/assets/ponyo/... and concluded, quite reasonably, that she owns
 * no pictures. Anchoring to the module makes the answer the same
 * everywhere, and keeps working if the app is ever served from a
 * subdirectory.
 */
const MANIFEST_URL = new URL('../../assets/ponyo/manifest.json', import.meta.url).href;
const BASE = new URL('../../assets/ponyo/', import.meta.url).href;

/** @type {{images: Portrait[], loaded: boolean, error: string}} */
const state = { images: [], loaded: false, error: '' };

/**
 * @typedef {Object} Portrait
 * @property {string} src        full path, ready for an <img>
 * @property {string} file       the filename as written on disk
 * @property {string[]} slots    which slots it is eligible for
 * @property {number} ratio      width / height, 0 when unknown
 * @property {number[]} focal    [x, y] 0..1, where her face roughly is
 * @property {string} alt        what a screen reader is told
 */

/**
 * Read the manifest once. Safe to call from anywhere, any number of
 * times; later callers get the same promise.
 *
 * Never rejects. A missing or malformed manifest is an empty gallery,
 * not a broken page.
 */
let inflight = null;
export function loadPortraits() {
  if (state.loaded) return Promise.resolve(state.images);
  if (inflight) return inflight;

  inflight = fetch(MANIFEST_URL, { cache: 'no-cache' })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      const raw = Array.isArray(data?.images) ? data.images : [];
      state.images = raw.map(normalise).filter(Boolean);
      state.loaded = true;
      buildScenes(state.images);
      return state.images;
    })
    .catch((error) => {
      // A file:// open, or no manifest yet. Both are fine; both mean
      // "draw the empty frames".
      state.error = String(error?.message ?? error);
      state.loaded = true;
      state.images = [];
      return state.images;
    });

  return inflight;
}

function normalise(entry) {
  const file = String(entry?.file ?? '').trim();
  if (!file || file.includes('/') || file.includes('\\')) return null;

  const named = SLOTS.filter((slot) => file.toLowerCase().includes(slot));
  const w = Number(entry?.w) || 0;
  const h = Number(entry?.h) || 0;
  const focal = Array.isArray(entry?.focal) && entry.focal.length === 2
    ? [clamp01(entry.focal[0]), clamp01(entry.focal[1])]
    : [0.5, 0.38];

  return {
    // Encoded, because the artwork arrived with names like
    // "ponyo-library-world.png (2).png". Spaces and parentheses survive
    // an <img src> by luck and a CSS url() by quoting; encoding them
    // once here means neither has to be lucky.
    src: BASE + encodeURIComponent(file),
    file,
    // An untagged picture is eligible everywhere — the common case.
    slots: named.length ? named : [...SLOTS],
    ratio: w && h ? w / h : 0,
    focal,
    alt: String(entry?.alt ?? '').trim() || 'A picture of Ponyo',
  };
}

const clamp01 = (n) => Math.max(0, Math.min(1, Number(n) || 0));

/** Everything the manifest offered, in file order. */
export function allPortraits() { return state.images; }

/** True once the manifest has been read, whatever it said. */
export function portraitsReady() { return state.loaded; }

/** True when there is at least one real picture to show. */
export function hasPortraits(slot) { return eligible(slot).length > 0; }

function eligible(slot) {
  if (!slot) return state.images;
  return state.images.filter((p) => p.slots.includes(slot));
}

/**
 * One picture for a slot, chosen deterministically from a token.
 *
 * Same token, same picture — so a re-render is stable. A new visit id
 * moves to the next picture in a rotated order rather than a fresh
 * random pick, which is what stops the same one turning up three
 * reloads running.
 *
 * @param {string} slot
 * @param {string|number} token
 * @returns {Portrait|null}
 */
export function portraitFor(slot, token = '') {
  const pool = eligible(slot);
  if (!pool.length) return null;
  return pool[hashToken(`${slot}:${token}`) % pool.length];
}

/**
 * Several distinct pictures for a slot — for a picture wall.
 * Returns fewer than asked for rather than repeating one.
 */
export function portraitSet(slot, count, token = '') {
  const pool = eligible(slot);
  if (!pool.length) return [];
  const start = hashToken(`${slot}:${token}`) % pool.length;
  const out = [];
  for (let i = 0; i < Math.min(count, pool.length); i += 1) {
    out.push(pool[(start + i) % pool.length]);
  }
  return out;
}

/** FNV-ish. Small, stable, and the same one the covers use. */
function hashToken(value) {
  let h = 2166136261;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** For the settings page: an honest sentence about what was found. */
export function portraitReport() {
  if (!state.loaded) return 'Still looking.';
  if (state.images.length) {
    return `${state.images.length} ${state.images.length === 1 ? 'picture' : 'pictures'} in assets/ponyo.`;
  }
  return 'No pictures in assets/ponyo yet — the frames are drawn empty until there are.';
}
