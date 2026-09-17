/**
 * achievements.js — small, optional, deliberately not a game.
 *
 * Each achievement is a pure predicate over the library, so nothing has
 * to be tracked as it happens: the set is simply recomputed whenever
 * something changes, and anything newly true is announced once.
 *
 * They live on their own panel rather than sprinkled through the UI,
 * because a library covered in badges stops looking like a library.
 */

import { STATUS } from '../data/models.js';

const count = (books, fn) => books.filter(fn).length;
const read = (books) => books.filter((b) => b.status === STATUS.READ);
const inGenre = (books, ...genres) => books.filter((b) => genres.includes(b.genre));

export const ACHIEVEMENTS = [
  {
    id: 'first', icon: '\u{1F4DA}', name: 'First Book',
    blurb: 'You finished one. It begins.',
    test: (b) => read(b).length >= 1,
  },
  {
    id: 'five', icon: '\u{1F525}', name: 'Five Down',
    blurb: 'Five books read. A pattern is forming.',
    test: (b) => read(b).length >= 5,
  },
  {
    id: 'ten', icon: '\u{1F30A}', name: 'Ten Down',
    blurb: 'Ten finished. Officially a habit.',
    test: (b) => read(b).length >= 10,
  },
  {
    id: 'twentyfive', icon: '\u{1F3C6}', name: 'Twenty-Five',
    blurb: 'A quarter of a hundred. Someone is showing off.',
    test: (b) => read(b).length >= 25,
  },
  {
    id: 'thinker', icon: '\u{1F9E0}', name: 'Thinks Too Much',
    blurb: 'Five books about why people are like this.',
    test: (b) => inGenre(b, 'Psychology', 'Philosophy', 'Essays').filter((x) => x.status === STATUS.READ).length >= 5,
  },
  {
    id: 'horror', icon: '\u{1F47B}', name: 'Horror Survivor',
    blurb: 'Finished something you had to leave the lamp on for.',
    test: (b) => inGenre(b, 'Horror').some((x) => x.status === STATUS.READ),
  },
  {
    id: 'detective', icon: '\u{1F50E}', name: 'Detective Ponyo',
    blurb: 'Three mysteries solved. Allegedly before the detective did.',
    test: (b) => inGenre(b, 'Mystery', 'Crime', 'Thriller').filter((x) => x.status === STATUS.READ).length >= 3,
  },
  {
    id: 'romance', icon: '\u{1F49E}', name: 'Romance Goblin',
    blurb: 'Three romances. You knew what they would do to you.',
    test: (b) => inGenre(b, 'Romance', 'Young Adult').filter((x) => x.status === STATUS.READ).length >= 3,
  },
  {
    id: 'tbr', icon: '\u{1F41A}', name: 'TBR Warrior',
    blurb: 'Read more than are waiting. Genuinely rare.',
    test: (b) => read(b).length > count(b, (x) => x.status === STATUS.TBR) && read(b).length >= 5,
  },
  {
    id: 'damage', icon: '\u{1F494}', name: 'Emotional Damage Survivor',
    blurb: 'Tagged a book as devastating and kept going anyway.',
    test: (b) => b.some((x) => x.tags.some((t) => /devastat|cry|wreck/i.test(t))),
  },
  {
    id: 'annotator', icon: '\u{270D}', name: 'Talks Back to Books',
    blurb: 'Wrote notes on ten of them.',
    test: (b) => count(b, (x) => x.notes.length > 0) >= 10,
  },
  {
    id: 'scrapbook', icon: '\u{1F4F8}', name: 'Keeps the Receipts',
    blurb: 'Attached a memory to a book.',
    test: (b) => b.some((x) => x.memories.length > 0),
  },
  {
    id: 'polyglot', icon: '\u{1F338}', name: 'Disappears Into Asia',
    blurb: 'Five books from Japan or Korea.',
    test: (b) => inGenre(b, 'Japanese Literature', 'Korean Literature').length >= 5,
  },
  {
    id: 'loyal', icon: '\u{1F91D}', name: 'Loyal Reader',
    blurb: 'Read two books by the same author.',
    test: (b) => {
      const tally = new Map();
      for (const book of read(b)) tally.set(book.author, (tally.get(book.author) ?? 0) + 1);
      return Array.from(tally.values()).some((n) => n >= 2);
    },
  },
  {
    id: 'quitter', icon: '\u{1F343}', name: 'Knows When to Stop',
    blurb: 'Put a book down unfinished. That takes confidence.',
    test: (b) => b.some((x) => x.status === STATUS.DNF),
  },
  {
    id: 'multitask', icon: '\u{1F331}', name: 'Three at Once',
    blurb: 'Three books open simultaneously. A personality, not a problem.',
    test: (b) => count(b, (x) => x.status === STATUS.READING) >= 3,
  },
];

/** ids of everything currently true. */
export function earned(books) {
  return ACHIEVEMENTS.filter((a) => {
    try { return a.test(books); } catch { return false; }
  }).map((a) => a.id);
}

/**
 * Compare against what was already known and return the ids that are
 * newly true, so the UI can announce exactly those.
 */
export function newlyEarned(books, known = []) {
  const now = earned(books);
  const before = new Set(known);
  return now.filter((id) => !before.has(id));
}

export const byId = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
