/**
 * selectors.js — turning "all the books" into "the books on screen".
 *
 * Pure functions, no DOM, no storage. Given the full list and the
 * current state they return what to draw. That makes the filtering
 * logic testable on its own and keeps the views about layout.
 */

import { STATUS, noteText } from '../data/models.js';
import { SHELVES, SORTS } from './store.js';
import { normalize, tokenize, sortableAuthor, sortableTitle } from '../utils/text.js';
import { moodForGenre } from '../data/genres.js';

const UNSHELVED_LABEL = 'Unshelved';

/** Books belonging to a named shelf. */
export function onShelf(books, shelf) {
  switch (shelf) {
    case SHELVES.READING:    return books.filter((b) => b.status === STATUS.READING);
    case SHELVES.TBR:        return books.filter((b) => b.status === STATUS.TBR);
    case SHELVES.READ:       return books.filter((b) => b.status === STATUS.READ);
    case SHELVES.DNF:        return books.filter((b) => b.status === STATUS.DNF);
    case SHELVES.FAVOURITES: return books.filter((b) => b.favourite);
    default:                 return books;
  }
}

/**
 * Score a book against a search query.
 * Every token has to land somewhere, so "murakami wood" narrows rather
 * than widens. Where it lands decides the ranking.
 */
function score(book, tokens) {
  if (!tokens.length) return 1;

  const title = normalize(book.title);
  const author = normalize(book.author);
  const genre = normalize(`${book.genre} ${book.subgenre}`);
  const series = normalize(book.series);
  const tags = book.tags.join(' ');
  const prose = normalize(`${noteText(book)} ${book.thoughts} ${book.description}`);

  let total = 0;
  for (const token of tokens) {
    let best = 0;
    if (title.startsWith(token)) best = 100;
    else if (title.includes(token)) best = 70;
    if (author.startsWith(token)) best = Math.max(best, 90);
    else if (author.includes(token)) best = Math.max(best, 65);
    if (genre.includes(token)) best = Math.max(best, 45);
    if (series.includes(token)) best = Math.max(best, 40);
    if (tags.includes(token)) best = Math.max(best, 38);
    if (prose.includes(token)) best = Math.max(best, 12);
    if (!best) return 0;          // a token that matched nothing kills the book
    total += best;
  }
  // Nudge her favourites up when scores are otherwise close.
  return total + (book.favourite ? 3 : 0);
}

export function search(books, query) {
  const tokens = tokenize(query);
  if (!tokens.length) return books;
  return books
    .map((book) => ({ book, s: score(book, tokens) }))
    .filter((row) => row.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((row) => row.book);
}

export function applyRefinements(books, { genre, author, minRating, tag, reviewOnly }) {
  let out = books;
  if (reviewOnly) out = out.filter((b) => b.needsReview);
  if (genre) {
    out = genre === UNSHELVED_LABEL
      ? out.filter((b) => !b.genre)
      : out.filter((b) => b.genre === genre);
  }
  if (author) out = out.filter((b) => b.author === author);
  if (minRating) out = out.filter((b) => b.rating >= minRating);
  if (tag) out = out.filter((b) => b.tags.includes(tag));
  return out;
}

export function sortBooks(books, sort) {
  const list = [...books];
  switch (sort) {
    case SORTS.TITLE:
      return list.sort((a, b) => sortableTitle(a.title).localeCompare(sortableTitle(b.title)));
    case SORTS.RECENT:
      return list.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    case SORTS.OLDEST:
      return list.sort((a, b) => (a.addedAt ?? '').localeCompare(b.addedAt ?? ''));
    case SORTS.RATING:
      return list.sort((a, b) => (b.rating - a.rating)
        || sortableTitle(a.title).localeCompare(sortableTitle(b.title)));
    case SORTS.SHELF:
    default:
      // How books actually sit on a shelf: by author, then by title.
      return list.sort((a, b) => sortableAuthor(a.author).localeCompare(sortableAuthor(b.author))
        || sortableTitle(a.title).localeCompare(sortableTitle(b.title)));
  }
}

/** The full pipeline, in the order a person would describe it. */
export function visibleBooks(books, state) {
  let out = onShelf(books, state.shelf);
  out = applyRefinements(out, state);
  if (state.query) return search(out, state.query);   // search decides its own order
  return sortBooks(out, state.sort);
}

/** Counts for the shelf tabs — always over the whole library, never the filtered set. */
export function shelfCounts(books) {
  const counts = {
    [SHELVES.ALL]: books.length,
    [SHELVES.READING]: 0,
    [SHELVES.TBR]: 0,
    [SHELVES.READ]: 0,
    [SHELVES.DNF]: 0,
    [SHELVES.FAVOURITES]: 0,
  };
  for (const book of books) {
    if (counts[book.status] !== undefined) counts[book.status] += 1;
    if (book.favourite) counts[SHELVES.FAVOURITES] += 1;
  }
  return counts;
}

/** [{ name, count }] sorted biggest first. */
export function countBy(books, getKey) {
  const map = new Map();
  for (const book of books) {
    for (const key of [].concat(getKey(book))) {
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
  }
  return Array.from(map, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export const genreFacets = (books) => {
  const facets = countBy(books, (b) => b.genre);
  const unshelved = books.filter((b) => !b.genre).length;
  if (unshelved) facets.push({ name: UNSHELVED_LABEL, count: unshelved });
  return facets;
};
export const authorFacets = (books) => countBy(books, (b) => b.author);
export const tagFacets = (books) => countBy(books, (b) => b.tags);

export const ODDS_LABEL = 'Odds and ends';

/**
 * Group into genre shelves for the bookshelf layout.
 *
 * Genres with only one book do not get a rail of their own — a plank
 * holding a single paperback looks like a mistake. They are swept into
 * one "Odds and ends" shelf at the bottom instead. Every book appears
 * exactly once, which matters: the shelves are the default view, so
 * anything dropped here would be invisible to her.
 */
export function groupByGenre(books, { minPerShelf = 2 } = {}) {
  const groups = new Map();
  for (const book of books) {
    const key = book.genre || UNSHELVED_LABEL;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(book);
  }

  const shelves = [];
  const strays = [];
  for (const [genre, list] of groups) {
    if (list.length >= minPerShelf) {
      shelves.push({
        genre,
        books: sortBooks(list, SORTS.SHELF),
        mood: genre === UNSHELVED_LABEL ? 'tide' : moodForGenre(genre),
      });
    } else {
      strays.push(...list);
    }
  }

  shelves.sort((a, b) => b.books.length - a.books.length || a.genre.localeCompare(b.genre));

  if (strays.length) {
    shelves.push({
      genre: ODDS_LABEL,
      books: sortBooks(strays, SORTS.SHELF),
      mood: 'tide',
      isOdds: true,
    });
  }
  return shelves;
}

/**
 * The mood the page should be in, given what is on screen.
 * An explicit genre filter wins; otherwise the dominant genre of the
 * visible books decides, and a mixed shelf stays home at "tide".
 */
export function moodFor(state, visible) {
  if (state.genre && state.genre !== UNSHELVED_LABEL) return moodForGenre(state.genre);
  if (!visible.length) return 'tide';

  const tally = new Map();
  for (const book of visible) {
    const mood = book.genre ? moodForGenre(book.genre) : 'tide';
    tally.set(mood, (tally.get(mood) ?? 0) + 1);
  }
  const [top, count] = Array.from(tally).sort((a, b) => b[1] - a[1])[0];
  return count / visible.length >= 0.5 ? top : 'tide';
}

export { UNSHELVED_LABEL };
