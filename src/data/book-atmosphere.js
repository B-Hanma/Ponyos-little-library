/**
 * book-atmosphere.js — a few books get their own weather.
 *
 * Genre sets the world. A handful of books are distinctive enough to
 * deserve something more specific, so opening them changes the scene in
 * the drawer and, briefly, the world behind the page.
 *
 * These are ORIGINAL motifs — silhouettes and abstractions drawn from
 * primitives, suggested by the book. Nothing is traced from a cover, a
 * film still, or anyone's artwork.
 *
 * Adding one: key by title (matching is case- and punctuation-
 * insensitive), name a world, and optionally draw a motif. A book with
 * no entry simply uses its genre's world, which is the common case.
 */

import { normalize } from '../utils/text.js';

const ink = (o = 1) => `rgb(var(--world-ink) / ${o})`;
const glow = (o = 1) => `rgb(var(--world-glow) / ${o})`;

/** Each motif draws into a 240 x 120 box behind the book's title. */
const MOTIFS = {
  mansion: () => `
    <g fill="${ink(0.5)}">
      <path d="M40 120 V56 L86 26 L132 56 V120 Z"/>
      <path d="M132 120 V72 L170 50 L208 72 V120 Z"/>
      <rect x="78" y="14" width="14" height="26"/>
    </g>
    <g fill="${glow(0.85)}">
      <rect x="60" y="74" width="14" height="18"/>
      <rect x="98" y="74" width="14" height="18"/>
      <rect x="152" y="86" width="12" height="16"/>
    </g>
    <circle cx="196" cy="26" r="16" fill="${glow(0.45)}"/>
    <g stroke="${ink(0.28)}" stroke-width="7" stroke-linecap="round">
      <path d="M0 108 h240" opacity=".5"/><path d="M0 96 h240" opacity=".3"/>
    </g>`,

  eye: () => `
    <g fill="none" stroke="${ink(0.55)}" stroke-width="4">
      <path d="M50 60 q70 -46 140 0 q-70 46 -140 0z"/>
      <circle cx="120" cy="60" r="22"/>
    </g>
    <circle cx="120" cy="60" r="10" fill="${glow(0.9)}"/>
    <g stroke="${ink(0.3)}" stroke-width="3">
      <path d="M20 100 h60M90 100 h40M150 100 h70M20 112 h100M140 112 h80"/>
    </g>
    <g fill="${ink(0.35)}">
      <rect x="18" y="16" width="34" height="8"/><rect x="18" y="30" width="22" height="6"/>
    </g>`,

  stationery: () => `
    <rect x="34" y="14" width="172" height="96" rx="3" fill="${glow(0.12)}" stroke="${ink(0.4)}" stroke-width="2.4"/>
    <g stroke="${ink(0.3)}" stroke-width="2.4" stroke-linecap="round">
      <path d="M54 44 h96M54 60 h124M54 76 h72"/>
    </g>
    <g transform="translate(176 86)">
      ${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-10" rx="6" ry="10" fill="${glow(0.55)}" transform="rotate(${a})"/>`).join('')}
      <circle r="4" fill="${ink(0.6)}"/>
    </g>
    <path d="M28 108 q30 -14 62 -4" fill="none" stroke="${ink(0.35)}" stroke-width="2"/>`,

  surreal: () => `
    <circle cx="66" cy="42" r="26" fill="${glow(0.4)}"/>
    <g fill="${ink(0.45)}">
      <path d="M150 50 q24 -16 46 0 q-22 16 -46 0z"/>
      <path d="M150 50 l-16 -12 v24z"/>
      <path d="M186 88 q18 -12 34 0 q-16 12 -34 0z"/>
      <path d="M186 88 l-12 -9 v18z"/>
    </g>
    <g stroke="${glow(0.4)}" stroke-width="2" stroke-linecap="round">
      <path d="M30 88 l-6 22M58 96 l-6 22M86 84 l-6 22M114 100 l-6 22"/>
    </g>
    <g fill="${ink(0.3)}">
      <rect x="96" y="26" width="34" height="8" rx="2" transform="rotate(-14 113 30)"/>
      <rect x="112" y="48" width="26" height="7" rx="2" transform="rotate(9 125 51)"/>
    </g>`,

  silver: () => `
    <g fill="none" stroke="${glow(0.6)}" stroke-width="3">
      <rect x="70" y="34" width="100" height="26" rx="4"/>
      <rect x="86" y="68" width="68" height="22" rx="4"/>
    </g>
    <g fill="${glow(0.3)}">
      <rect x="70" y="34" width="100" height="26" rx="4"/>
    </g>
    <g stroke="${ink(0.4)}" stroke-width="2.4" stroke-linecap="round">
      <path d="M22 30 h32M22 44 h22M186 84 h32M196 98 h22"/>
    </g>
    <g fill="${ink(0.45)}">
      <path d="M46 96 l14 -22 l14 22z"/><path d="M166 40 l12 -18 l12 18z"/>
    </g>`,

  ocean: () => `
    <g fill="none" stroke="${glow(0.5)}" stroke-width="3" stroke-linecap="round">
      <path d="M0 70 q30 -18 60 0 t60 0 t60 0 t60 0"/>
      <path d="M0 88 q30 -18 60 0 t60 0 t60 0 t60 0" opacity=".7"/>
      <path d="M0 106 q30 -18 60 0 t60 0 t60 0 t60 0" opacity=".45"/>
    </g>
    <circle cx="188" cy="34" r="20" fill="${glow(0.4)}"/>
    <g fill="${ink(0.4)}">
      <path d="M56 40 q20 -12 38 0 q-18 12 -38 0z"/><path d="M56 40 l-12 -9 v18z"/>
    </g>`,

  train: () => `
    <g fill="${ink(0.45)}">
      <rect x="20" y="52" width="168" height="44" rx="6"/>
      <rect x="188" y="62" width="34" height="34" rx="4"/>
    </g>
    <g fill="${glow(0.6)}">
      ${[34, 66, 98, 130, 162].map((x) => `<rect x="${x}" y="62" width="20" height="18" rx="2"/>`).join('')}
    </g>
    <g fill="${ink(0.6)}">
      <circle cx="52" cy="102" r="9"/><circle cx="110" cy="102" r="9"/><circle cx="168" cy="102" r="9"/>
    </g>
    <path d="M0 114 h240" stroke="${ink(0.35)}" stroke-width="3"/>`,

  cafe: () => `
    <g transform="translate(88 40)">
      <path d="M0 0 h64 v28 a32 32 0 0 1 -64 0z" fill="${ink(0.5)}"/>
      <path d="M64 6 a16 16 0 0 1 0 18" fill="none" stroke="${ink(0.5)}" stroke-width="5"/>
      <ellipse cx="32" cy="66" rx="52" ry="8" fill="${ink(0.3)}"/>
      <g stroke="${glow(0.6)}" stroke-width="3" fill="none" stroke-linecap="round">
        <path d="M16 -12 q10 -18 0 -32"/><path d="M44 -14 q10 -15 0 -27"/>
      </g>
    </g>
    <g fill="${ink(0.35)}">
      <rect x="10" y="88" width="40" height="8" rx="2"/><rect x="196" y="80" width="34" height="8" rx="2"/>
    </g>`,
};

/** normalized title -> { world, motif } */
const RAW = {
  'The Haunting of Hill House': { world: 'hollow', motif: 'mansion' },
  '1984': { world: 'arcane', motif: 'eye' },
  'Animal Farm': { world: 'foxed', motif: 'eye' },
  "The Handmaid's Tale": { world: 'arcane', motif: 'eye' },
  'The Testaments': { world: 'arcane', motif: 'eye' },
  'Pride and Prejudice': { world: 'ember', motif: 'stationery' },
  'PS, I Love You': { world: 'ember', motif: 'stationery' },
  'Kafka on the Shore': { world: 'washi', motif: 'surreal' },
  'Norwegian Wood': { world: 'washi', motif: 'surreal' },
  'Babel': { world: 'arcane', motif: 'silver' },
  'Katabasis': { world: 'arcane', motif: 'silver' },
  'The Ocean of Churn': { world: 'foxed', motif: 'ocean' },
  'Pachinko': { world: 'foxed', motif: 'train' },
  'The People on Platform 5': { world: 'tide', motif: 'train' },
  'Before the Coffee Gets Cold': { world: 'washi', motif: 'cafe' },
  'Welcome to the Hyunam-Dong Bookshop': { world: 'washi', motif: 'cafe' },
  'Tuesdays with Morrie': { world: 'washi', motif: 'cafe' },
  'Project Hail Mary': { world: 'cosmos', motif: 'ocean' },
  'A Brief History of Time': { world: 'cosmos', motif: 'ocean' },
};

const INDEX = new Map(Object.entries(RAW).map(([title, spec]) => [normalize(title), spec]));

/**
 * The atmosphere for a book: its own if it has one, otherwise nothing
 * and the caller falls back to the genre world.
 * @returns {{world: string, motif: string}|null}
 */
export function atmosphereFor(book) {
  return INDEX.get(normalize(book?.title ?? '')) ?? null;
}

/** The motif SVG for a book, or '' when it does not have one. */
export function motifFor(book) {
  const spec = atmosphereFor(book);
  if (!spec?.motif || !MOTIFS[spec.motif]) return '';
  return `<svg class="detail__motif" viewBox="0 0 240 120" aria-hidden="true">${MOTIFS[spec.motif]()}</svg>`;
}

export const ATMOSPHERE_COUNT = INDEX.size;
