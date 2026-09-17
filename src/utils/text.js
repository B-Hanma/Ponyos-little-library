/**
 * text.js — string handling for messy, hand-typed book data.
 *
 * The source list was typed by a human over years: inconsistent case,
 * stray punctuation, accents that come and go, and the same author
 * spelled three ways. Everything here exists to make two spellings of
 * the same book collide on purpose, so we merge duplicates instead of
 * shipping them twice.
 */

/** Strip accents so "Kane" and "Kané" compare equal. */
export function fold(value) {
  // \p{Diacritic} catches every combining accent mark after NFD decomposition.
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/** Lowercase, accent-free, punctuation-free, single-spaced. The comparison key. */
export function normalize(value) {
  return fold(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')   // also flattens curly quotes, dashes, ampersands
    .trim();
}

/** Key used to decide "this is the same book". Leading articles are ignored. */
export function bookKey(title, author) {
  const t = normalize(title).replace(/^(the|a|an)\s+/, '');
  const a = normalize(author).replace(/^(the|a|an)\s+/, '');
  return `${t}::${a}`;
}

const LOWER_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into',
  'nor', 'of', 'on', 'or', 'the', 'to', 'up', 'with', 'over', 'vs',
]);

/**
 * Title-case that leaves ALREADY-sensible strings alone.
 * Only rewrites strings that are clearly all-caps or all-lowercase,
 * because "iWoz" and "PS, I Love You" are correct as typed.
 */
export function smartTitle(raw) {
  const value = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!value) return '';
  const isAllCaps = value === value.toUpperCase() && /[A-Z]{3}/.test(value);
  const isAllLower = value === value.toLowerCase();
  // Mixed case is assumed deliberate — "iWoz" and "PS, I Love You" are
  // correct as typed. The one exception is a lowercase first letter,
  // which is always a typo rather than a style choice.
  if (!isAllCaps && !isAllLower) return value.replace(/^\p{Ll}/u, (c) => c.toUpperCase());

  const words = value.toLowerCase().split(' ');
  return words
    .map((word, index) => {
      if (index !== 0 && index !== words.length - 1 && LOWER_WORDS.has(word)) return word;
      return word.replace(/^([a-z])/, (m) => m.toUpperCase());
    })
    .join(' ')
    .replace(/(^|[\s(])([a-z])/g, (m, pre, ch) => pre + ch.toUpperCase());
}

/** "Lahiri, Jhumpa" -> "Jhumpa Lahiri". Left alone if there is no comma. */
export function unflipAuthor(raw) {
  const value = String(raw ?? '').trim();
  if (!value.includes(',')) return value;
  // Real multi-author strings use "&" or "and"; only flip a simple "Last, First".
  const parts = value.split(',').map((p) => p.trim());
  if (parts.length === 2 && !/\b(and|&)\b/i.test(value) && parts[1].split(' ').length <= 3) {
    return `${parts[1]} ${parts[0]}`.trim();
  }
  return value;
}

export function sortableAuthor(author) {
  const value = String(author ?? '').trim();
  if (!value) return 'zzz';
  const parts = value.split(/\s+/);
  return normalize(parts[parts.length - 1] + ' ' + parts.slice(0, -1).join(' '));
}

/** Title without a leading article, for alphabetical shelving. */
export function sortableTitle(title) {
  return normalize(title).replace(/^(the|a|an)\s+/, '');
}

export function initials(value) {
  return fold(value)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function plural(count, one, many) {
  return count === 1 ? one : (many ?? `${one}s`);
}

export function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const n = bytes / Math.pow(1024, i);
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

export function formatDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function relativeDays(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86400000);
}

/**
 * Deterministic 32-bit hash. Used to give every book the same generated
 * cover every time, on every device, with no stored state.
 */
export function hash(value) {
  let h = 2166136261;
  const str = String(value ?? '');
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

/** Split a search box query into meaningful tokens. */
export function tokenize(query) {
  return normalize(query).split(' ').filter((t) => t.length > 0);
}
