/**
 * covers.js — every book gets a cover, offline, for free.
 *
 * Real cover images would mean an internet connection and somebody
 * else's rights, so instead each book grows its own: the genre picks the
 * colour family, a hash of the title picks the exact shade and the
 * motif. Same book, same cover, on every device, forever, with nothing
 * stored.
 *
 * The result is a shelf that looks designed rather than random, because
 * all the Japanese literature is quietly in the same key.
 */

import { hash } from '../utils/text.js';
import { esc } from '../utils/dom.js';
import { resolveCover, SOURCE_LABEL } from '../data/cover-policy.js';

/** genre -> [base hue, accent hue] */
const HUES = {
  'Literary Fiction': [196, 12],
  'Contemporary Fiction': [188, 38],
  'Historical Fiction': [30, 200],
  'Japanese Literature': [12, 92],
  'Korean Literature': [95, 22],
  'Mystery': [214, 44],
  'Thriller': [222, 6],
  'Crime': [206, 40],
  'Horror': [352, 210],
  'Romance': [342, 22],
  'Young Adult': [318, 40],
  'Fantasy': [264, 168],
  'Science Fiction': [232, 170],
  'Dystopian': [240, 8],
  'Classics': [34, 180],
  'Psychology': [190, 140],
  'Self-Help': [150, 46],
  'Science': [186, 260],
  'Economics': [42, 168],
  'Business': [46, 210],
  'History': [28, 190],
  'Mythology': [20, 44],
  'Philosophy': [206, 96],
  'Memoir': [16, 130],
  'Biography': [40, 216],
  'Essays': [178, 120],
  'Nonfiction': [200, 100],
  'Humour': [46, 178],
  "Children's": [40, 190],
  'Poetry': [300, 180],
};

const DEFAULT_HUES = [198, 20];

const MOTIFS = ['waves', 'arch', 'moon', 'rings', 'rule', 'leaf', 'grid', 'horizon'];

function paletteFor(book) {
  const [baseHue, accentHue] = HUES[book.genre] ?? DEFAULT_HUES;
  const h = hash(`${book.title}|${book.author}`);

  const hueShift = (h % 19) - 9;              // +/- 9deg of family variation
  const sat = 34 + (h >> 5) % 26;             // 34-59%, enough to read as a colour
  const light = 21 + (h >> 9) % 15;           // 21-35%, still dark enough for white type

  return {
    top: `hsl(${baseHue + hueShift} ${sat}% ${light + 11}%)`,
    bottom: `hsl(${baseHue + hueShift - 8} ${sat + 8}% ${light}%)`,
    ink: `hsl(${accentHue} ${Math.min(78, sat + 30)}% ${62 + (h >> 13) % 14}%)`,
    motif: MOTIFS[(h >> 3) % MOTIFS.length],
    seed: h,
  };
}

function motifMarkup(kind, ink, seed) {
  const o = (n) => (seed >> n) % 20 - 10;     // small deterministic offsets
  switch (kind) {
    case 'waves':
      return `<g stroke="${ink}" stroke-width="2.4" fill="none" opacity=".55">
        <path d="M-10 118 q 22 -14 44 0 t 44 0 t 44 0 t 44 0"/>
        <path d="M-10 134 q 22 -14 44 0 t 44 0 t 44 0 t 44 0" opacity=".7"/>
        <path d="M-10 150 q 22 -14 44 0 t 44 0 t 44 0 t 44 0" opacity=".45"/>
      </g>`;
    case 'arch':
      return `<path d="M30 168 V86 a30 30 0 0 1 60 0 v82" fill="none" stroke="${ink}" stroke-width="2.6" opacity=".6"/>
        <circle cx="60" cy="86" r="9" fill="${ink}" opacity=".5"/>`;
    case 'moon':
      return `<circle cx="${62 + o(2)}" cy="70" r="26" fill="${ink}" opacity=".42"/>
        <circle cx="${72 + o(4)}" cy="64" r="26" fill="none" stroke="${ink}" stroke-width="1.6" opacity=".5"/>`;
    case 'rings':
      return `<g fill="none" stroke="${ink}" opacity=".5">
        <circle cx="60" cy="96" r="14" stroke-width="2"/>
        <circle cx="60" cy="96" r="26" stroke-width="1.5" opacity=".7"/>
        <circle cx="60" cy="96" r="38" stroke-width="1" opacity=".45"/>
      </g>`;
    case 'rule':
      return `<g stroke="${ink}" stroke-width="3" opacity=".55">
        <path d="M22 72 H98"/><path d="M22 86 H74" opacity=".65"/><path d="M22 100 H88" opacity=".4"/>
      </g>`;
    case 'leaf':
      return `<path d="M60 44 C92 66 92 118 60 150 C28 118 28 66 60 44 Z" fill="none" stroke="${ink}" stroke-width="2.2" opacity=".55"/>
        <path d="M60 44 V150" stroke="${ink}" stroke-width="1.2" opacity=".4"/>`;
    case 'grid':
      return `<g stroke="${ink}" stroke-width="1.2" opacity=".38">
        <path d="M24 56 V150 M48 56 V150 M72 56 V150 M96 56 V150"/>
        <path d="M18 74 H102 M18 98 H102 M18 122 H102"/>
      </g>`;
    case 'horizon':
    default:
      return `<path d="M0 132 H120" stroke="${ink}" stroke-width="2" opacity=".6"/>
        <circle cx="${44 + o(6)}" cy="110" r="15" fill="${ink}" opacity=".4"/>`;
  }
}

/**
 * The SVG for a book's generated cover.
 * @param {Object} book
 * @returns {string} inline SVG markup
 */
/**
 * Break a title into at most `max` lines of roughly `width` characters,
 * so it can be set as tspans on the generated cover.
 *
 * A word longer than the line is allowed to overhang rather than being
 * hyphenated: "Bartholomew" on its own line looks like a cover, and
 * "Bartholo-" looks like a bug.
 */
function wrapTitle(text, width = 15, max = 3) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= width || !current) { current = candidate; continue; }
    lines.push(current);
    current = word;
    if (lines.length === max) break;
  }
  if (current && lines.length < max) lines.push(current);

  // Anything that did not fit gets an ellipsis on the last line rather
  // than being silently dropped.
  const used = lines.join(' ').split(/\s+/).length;
  if (used < words.length && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1]}…`;
  }
  return lines;
}

/**
 * The SVG for a book's generated cover.
 *
 * ── WHY IT CARRIES TYPE ───────────────────────────────────────────
 * This used to be colour and a motif and nothing else — a handsome
 * rectangle that told you nothing. On a shelf that is survivable,
 * because the card prints the title underneath; in the book drawer, in
 * Library Mode and anywhere the cover stands alone it is just a swatch.
 *
 * So the designed cover is now a designed cover: the title set across up
 * to three lines, the author under a rule, both in the book's own ink.
 * Title, author, genre and mood all feed it — the genre picks the colour
 * family and the motif, a hash of title-and-author picks the exact shade,
 * so two books on one shelf never come out identical.
 *
 * @param {Object} book
 * @returns {string} inline SVG markup
 */
export function coverSVG(book) {
  const p = paletteFor(book);
  const id = `g${p.seed.toString(36)}`;
  const lines = wrapTitle(book.title, 15, 3);

  // The block of type is centred on the lower third and grows upward, so
  // a one-line title and a three-line title share a baseline.
  const lineHeight = 11;
  const top = 138 - (lines.length - 1) * lineHeight;

  const author = String(book.author ?? '').trim();
  const authorLine = author && author !== 'Author unknown'
    ? `<text class="cover__author" x="60" y="163" text-anchor="middle"
         font-size="5.6" fill="${p.ink}" opacity=".85">${esc(trim(author, 26))}</text>`
    : '';

  return `<svg viewBox="0 0 120 180" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stop-color="${p.top}"/>
        <stop offset="1" stop-color="${p.bottom}"/>
      </linearGradient>
    </defs>
    <rect width="120" height="180" fill="url(#${id})"/>
    ${motifMarkup(p.motif, p.ink, p.seed)}

    <!-- a wash under the type, so a busy motif never eats the title -->
    <rect x="0" y="${top - 16}" width="120" height="${196 - top}" fill="${p.bottom}" opacity=".62"/>

    <text class="cover__title" x="60" text-anchor="middle" font-size="10"
          fill="#fff" opacity=".96">
      ${lines.map((l, i) => `<tspan x="60" y="${top + i * lineHeight}">${esc(l)}</tspan>`).join('')}
    </text>
    ${author && author !== 'Author unknown'
    ? `<path d="M44 150 H76" stroke="${p.ink}" stroke-width=".8" opacity=".55"/>` : ''}
    ${authorLine}

    <rect x="15" y="6" width="99" height="168" fill="none" stroke="${p.ink}" stroke-width=".8" opacity=".28"/>
  </svg>`;
}

/** Shorten to fit, with an ellipsis rather than a hard cut. */
function trim(text, max) {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Cover markup for a book.
 *
 * Which picture wins is decided in one place — resolveCover() in
 * cover-policy.js — so this function never has an opinion about sources.
 * It only draws what it is told.
 *
 * The generated cover is ALWAYS rendered underneath, and the photograph
 * sits on top of it. If the photo cannot load — offline, dead host, a
 * URL that rotted — a global error handler removes the <img> and the
 * generated cover is simply already there. No broken-image icons, no
 * layout shift, and the library still works on a plane.
 *
 * @param {Object} book
 * @param {Object} [cache] the cover cache; supplies uploads and overrides
 */
export function coverMarkup(book, cache) {
  const cover = coverFor(book, cache);
  const generated = coverSVG(book);
  // No photograph — or one whose blob has not resolved yet. Either way
  // the designed cover is already the answer, and it carries the title.
  if (!cover.url) return generated;
  return `${generated}<img class="book__photo" src="${esc(cover.url)}" alt="" loading="lazy" decoding="async">`;
}

/**
 * The resolved cover descriptor for a book, asking the cache for any
 * upload or override it holds. Safe with no cache at all.
 */
export function coverFor(book, cache) {
  const resolved = cache?.forBook?.(book) ?? {};
  return resolveCover(book, resolved);
}

/**
 * Where a book's picture came from, in words, for the book page.
 * Says "drawn for this book" rather than pretending — a fallback is not
 * something to hide, it is something Phase 2 can improve.
 */
export function coverCredit(book, cache) {
  const cover = coverFor(book, cache);
  return { ...cover, label: SOURCE_LABEL[cover.source] ?? '' };
}

/**
 * Cover images are opt-in on arrival, not on request.
 *
 * A photo is only trusted once it has actually decoded — at which point
 * it gets `.is-loaded`, which is what the CSS keys off to hide the
 * generated title plate underneath. Until then (and forever, if the
 * request fails) the generated cover is what she sees, complete with
 * title and author. A failed cover therefore degrades to a designed
 * cover rather than to a blank rectangle.
 *
 * Neither `load` nor `error` bubbles, so both are caught in the capture
 * phase. Call once at boot.
 */
export function installCoverFallback() {
  const isCover = (el) => el instanceof HTMLImageElement && el.classList.contains('book__photo');

  document.addEventListener('load', (event) => {
    if (isCover(event.target)) event.target.classList.add('is-loaded');
  }, true);

  document.addEventListener('error', (event) => {
    if (isCover(event.target)) event.target.remove();
  }, true);
}

