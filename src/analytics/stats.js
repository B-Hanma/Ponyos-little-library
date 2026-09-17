/**
 * stats.js — only numbers the collection can actually support.
 *
 * Nothing here estimates pages, hours or reading speed, because the data
 * does not contain any of that. Everything below is countable from what
 * is really on the shelves.
 */

import { STATUS } from '../data/models.js';
import { countBy, genreFacets, authorFacets, tagFacets } from '../state/selectors.js';
import { relativeDays } from '../utils/text.js';

export function computeStats(books) {
  const total = books.length;
  const byStatus = {
    [STATUS.READ]: 0,
    [STATUS.READING]: 0,
    [STATUS.TBR]: 0,
    [STATUS.DNF]: 0,
  };
  let favourites = 0;
  let rated = 0;
  let ratingSum = 0;
  let withNotes = 0;
  let tagged = 0;

  for (const book of books) {
    if (byStatus[book.status] !== undefined) byStatus[book.status] += 1;
    if (book.favourite) favourites += 1;
    if (book.rating > 0) { rated += 1; ratingSum += book.rating; }
    if (book.notes.length || book.thoughts.trim()) withNotes += 1;
    if (book.tags.length) tagged += 1;
  }

  const genres = genreFacets(books);
  const authors = authorFacets(books);
  const tags = tagFacets(books);
  const ratings = countBy(books.filter((b) => b.rating > 0), (b) => String(b.rating));

  return {
    total,
    read: byStatus[STATUS.READ],
    reading: byStatus[STATUS.READING],
    tbr: byStatus[STATUS.TBR],
    dnf: byStatus[STATUS.DNF],
    favourites,
    rated,
    withNotes,
    tagged,
    averageRating: rated ? ratingSum / rated : 0,
    /** Share of the library she has finished, 0-1. */
    progress: total ? byStatus[STATUS.READ] / total : 0,
    genres,
    authors,
    tags,
    ratings,
    /** Authors she owns more than one book by. */
    repeatAuthors: authors.filter((a) => a.count > 1 && a.name !== 'Author unknown'),
    topGenre: genres[0] ?? null,
    topAuthor: authors.find((a) => a.name !== 'Author unknown') ?? null,
    mostCommonRating: ratings[0] ?? null,
  };
}

/**
 * The playful facts on the dashboard.
 * Each one returns null when the collection cannot honestly support it,
 * and the view simply does not draw it.
 */
export function funFacts(books, stats) {
  const facts = [];

  if (stats.topAuthor && stats.topAuthor.count > 1) {
    facts.push({
      icon: '\u{1F58B}',
      label: 'Most shelf space',
      value: stats.topAuthor.name,
      note: `${stats.topAuthor.count} books. At this point it is a relationship.`,
    });
  }

  if (stats.topGenre) {
    facts.push({
      icon: '\u{1F4DA}',
      label: 'Biggest shelf',
      value: stats.topGenre.name,
      note: `${stats.topGenre.count} of ${stats.total}. No notes, no judgement.`,
    });
  }

  // Longest TBR resident: the book that has been waiting the longest.
  const waiting = books
    .filter((b) => b.status === STATUS.TBR)
    .sort((a, b) => (a.addedAt ?? '').localeCompare(b.addedAt ?? ''))[0];
  if (waiting) {
    const days = relativeDays(waiting.addedAt) ?? 0;
    facts.push({
      icon: '\u{1F41A}',
      label: 'Longest resident of the pile',
      value: waiting.title,
      note: days > 1
        ? `Waiting ${days} days. It has not said anything, but it has noticed.`
        : 'Just arrived. Already being ignored politely.',
    });
  }

  if (stats.mostCommonRating) {
    const n = Number(stats.mostCommonRating.name);
    facts.push({
      icon: '\u{2B50}',
      label: 'Rating you hand out most',
      value: `${n} ${n === 1 ? 'star' : 'stars'}`,
      note: n >= 4
        ? 'A generous woman. Or excellent taste in what to pick up.'
        : 'Hard to impress. Respect.',
    });
  }

  if (stats.favourites) {
    facts.push({
      icon: '\u{2764}',
      label: 'Would rescue from a flood',
      value: `${stats.favourites} ${stats.favourites === 1 ? 'book' : 'books'}`,
      note: 'The short list. Everyone else swims.',
    });
  }

  if (stats.reading > 2) {
    facts.push({
      icon: '\u{1F331}',
      label: 'Open at once',
      value: `${stats.reading} books`,
      note: 'Reading several books simultaneously is a personality, not a problem.',
    });
  }

  const unshelved = books.filter((b) => !b.genre).length;
  if (unshelved) {
    facts.push({
      icon: '\u{1F4D4}',
      label: 'Refuse to be categorised',
      value: `${unshelved} ${unshelved === 1 ? 'book' : 'books'}`,
      note: 'No genre on file. Give them one, or let them stay mysterious.',
    });
  }

  if (stats.withNotes) {
    facts.push({
      icon: '\u{270D}',
      label: 'Books you talked back to',
      value: `${stats.withNotes} ${stats.withNotes === 1 ? 'book' : 'books'}`,
      note: 'Notes, thoughts, arguments. The best part of any library.',
    });
  }

  return facts;
}

/** A sentence about progress that is honest when there is nothing to say. */
export function progressLine(stats) {
  if (!stats.total) return 'Nothing on the shelves yet.';
  if (!stats.read && !stats.reading) {
    return 'Nothing marked read yet. Tap the little icons on a cover to start sorting.';
  }
  const left = stats.total - stats.read;
  if (left <= 0) return 'Every book on these shelves has been read. That is genuinely alarming.';
  return `${stats.read} read, ${left} still to go. The pile is holding steady.`;
}
