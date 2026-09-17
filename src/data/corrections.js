/**
 * corrections.js — the cleaning pipeline for a hand-typed book list.
 *
 * The original collection was typed into a spreadsheet over years. It has
 * misspelled titles, misspelled authors, several books crammed into one
 * row, and the same book entered twice under different spellings.
 *
 * Everything needed to clean that up lives here, so the rules can be read
 * and extended in one place instead of being scattered through the import
 * code. The same pipeline runs over the shipped catalogue AND over
 * anything pasted into Settings → Import, which means a row typed badly
 * gets fixed identically no matter which door it came through.
 */

import { normalize, smartTitle, unflipAuthor } from '../utils/text.js';

/* ------------------------------------------------------------------ *
 * 1. TITLE CORRECTIONS
 *    key: the normalized (lowercased, punctuation-free) wrong spelling
 *    value: the published title
 * ------------------------------------------------------------------ */
const TITLE_FIXES = new Map(Object.entries({
  'book theif': 'The Book Thief',
  'the book theif': 'The Book Thief',
  'the haindmaid s tale': "The Handmaid's Tale",
  'the haindmaids tale': "The Handmaid's Tale",
  'the handmaids tale': "The Handmaid's Tale",
  'the thousand slendid suns': 'A Thousand Splendid Suns',
  'a thousand slendid suns': 'A Thousand Splendid Suns',
  'the thousand splendid suns': 'A Thousand Splendid Suns',
  'thousand splendid suns': 'A Thousand Splendid Suns',
  'the silent patiant': 'The Silent Patient',
  'the alchemis': 'The Alchemist',
  'norwegian wod': 'Norwegian Wood',
  'kafka on the shor': 'Kafka on the Shore',
  'the great gatsy': 'The Great Gatsby',
  'pride prejudice': 'Pride and Prejudice',
  'the diary of young girl': 'The Diary of a Young Girl',
  'tuesday with morrie': 'Tuesdays with Morrie',
  'the perks of being wallflower': 'The Perks of Being a Wallflower',
  'sophies world': "Sophie's World",
  'thinking fast slow': 'Thinking, Fast and Slow',
  'the god of small thing': 'The God of Small Things',
  'and the mountain echoed': 'And the Mountains Echoed',
  'one flew over the cuckoos nest': "One Flew Over the Cuckoo's Nest",
  'the fault in our star': 'The Fault in Our Stars',
  'ghachar ghochar a novel': 'Ghachar Ghochar',
  'before coffee gets cold': 'Before the Coffee Gets Cold',
}));

/* ------------------------------------------------------------------ *
 * 2. AUTHOR CORRECTIONS
 * ------------------------------------------------------------------ */
const AUTHOR_FIXES = new Map(Object.entries({
  'oliver dicken': 'Charles Dickens',
  'charles dicken': 'Charles Dickens',
  'gabreille zevin': 'Gabrielle Zevin',
  'gabrielle zevin': 'Gabrielle Zevin',
  'alex michaeldes': 'Alex Michaelides',
  'alex michaelidas': 'Alex Michaelides',
  'fitzerald': 'F. Scott Fitzgerald',
  'f scott fitzerald': 'F. Scott Fitzgerald',
  'scott fitzerald': 'F. Scott Fitzgerald',
  'stephen meyer': 'Stephenie Meyer',
  'stephanie meyer': 'Stephenie Meyer',
  'khaled hossaini': 'Khaled Hosseini',
  'khaled hosseni': 'Khaled Hosseini',
  'haruki murakmi': 'Haruki Murakami',
  'murakami haruki': 'Haruki Murakami',
  'jhumpa lahri': 'Jhumpa Lahiri',
  'arundhati ray': 'Arundhati Roy',
  'markus zusack': 'Markus Zusak',
  'margret atwood': 'Margaret Atwood',
  'george orwel': 'George Orwell',
  'jane austin': 'Jane Austen',
  'daniel kahnemann': 'Daniel Kahneman',
  'malcom gladwell': 'Malcolm Gladwell',
  'rolf dobeli': 'Rolf Dobelli',
  'sidhartha mukherjee': 'Siddhartha Mukherjee',
  'devdutt patnaik': 'Devdutt Pattanaik',
  'ashwin sangi': 'Ashwin Sanghi',
  'kavita kaney': 'Kavita Kane',
  'kavita kane': 'Kavita Kane',
  'r f kuang': 'R.F. Kuang',
  'rf kuang': 'R.F. Kuang',
  'rebecca f kuang': 'R.F. Kuang',
  'han gang': 'Han Kang',
  'min jin lee': 'Min Jin Lee',
  'enid blyton': 'Enid Blyton',
  'jeff kinny': 'Jeff Kinney',
  'roald dhal': 'Roald Dahl',
  'h g wells': 'H.G. Wells',
  'hg wells': 'H.G. Wells',
  'thomas friedman': 'Thomas L. Friedman',
  'nassim taleb': 'Nassim Nicholas Taleb',
  'abhijit banerjee': 'Abhijit V. Banerjee & Esther Duflo',
  'banerjee duflo': 'Abhijit V. Banerjee & Esther Duflo',
  'ha joon chang': 'Ha-Joon Chang',
  'kazuo ishiguru': 'Kazuo Ishiguro',
}));

/**
 * A title that is really a series wrapper, e.g.
 *   "The Famous Five (Five Go to Smuggler's Top; Five Go Off in a Caravan)"
 * The outer name becomes the series, the inner names become books.
 */
const SERIES_WRAPPER = /^(.+?)\s*[([]\s*(.+?)\s*[)\]]\s*$/;

/** Separators that mean "these are several different books in one cell". */
const MULTI_SPLIT = /\s*;\s*|\s+\/\s+/;

export function fixTitle(raw) {
  const value = smartTitle(String(raw ?? '').trim());
  const hit = TITLE_FIXES.get(normalize(value));
  return hit ?? value;
}

export function fixAuthor(raw) {
  const value = smartTitle(unflipAuthor(String(raw ?? '').trim()));
  const hit = AUTHOR_FIXES.get(normalize(value));
  return hit ?? value;
}

/**
 * Turn one spreadsheet row into one OR MORE book drafts.
 *
 * Handles three shapes the original list actually contains:
 *   "Gweilo"                                   -> one book
 *   "A; B; C; D"                               -> four books
 *   "The Famous Five (A; B; C)"                -> three books, series "The Famous Five"
 *
 * The author, genre and any other columns are copied onto every book the
 * row produces, because that is what the row meant.
 *
 * @param {{title: string, author?: string, genre?: string}} row
 * @returns {Array<Object>}
 */
export function expandRow(row) {
  const rawTitle = String(row.title ?? '').trim();
  if (!rawTitle) return [];

  const author = fixAuthor(row.author);
  const base = { ...row, author };

  // "The Famous Five (Five Go to Smuggler's Top; Five Go Off in a Caravan)"
  const wrapped = rawTitle.match(SERIES_WRAPPER);
  if (wrapped) {
    const seriesName = smartTitle(wrapped[1].trim());
    const inner = wrapped[2].split(MULTI_SPLIT).map((t) => t.trim()).filter(Boolean);
    // Only treat the bracket as a book list if it really holds several titles.
    // "Babel (Or the Necessity of Violence)" is a subtitle, not two books.
    if (inner.length > 1) {
      return inner.map((title) => ({ ...base, title: fixTitle(title), series: seriesName }));
    }
  }

  // "The Stockmen; Black Wind; Gweilo; The Blood-Dimmed Tide"
  const parts = rawTitle.split(MULTI_SPLIT).map((t) => t.trim()).filter(Boolean);
  if (parts.length > 1) {
    return parts.map((title) => ({ ...base, title: fixTitle(title) }));
  }

  return [{ ...base, title: fixTitle(rawTitle) }];
}

/**
 * Merge duplicates while keeping genuinely different books apart.
 *
 * Two rows are the same book when their accent-folded, article-stripped
 * title AND author match. A different series entry has a different title,
 * so "Five Go Off in a Caravan" never collapses into "Five Go to
 * Smuggler's Top" — which is exactly the distinction the brief asks for.
 *
 * When two records collide, the richer one wins field by field: a row that
 * knows the genre beats one that does not, rather than the later row simply
 * overwriting the earlier.
 */
export function mergeDuplicates(drafts) {
  const byKey = new Map();
  for (const draft of drafts) {
    const key = `${normalize(draft.title).replace(/^(the|a|an)\s+/, '')}::${normalize(draft.author)}`;
    const existing = byKey.get(key);
    if (!existing) { byKey.set(key, { ...draft }); continue; }
    byKey.set(key, {
      ...existing,
      genre: existing.genre || draft.genre,
      subgenre: existing.subgenre || draft.subgenre,
      series: existing.series || draft.series,
      description: (existing.description?.length ?? 0) >= (draft.description?.length ?? 0)
        ? existing.description : draft.description,
      coverUrl: existing.coverUrl || draft.coverUrl,
      needsReview: existing.needsReview || draft.needsReview,
      tags: Array.from(new Set([...(existing.tags ?? []), ...(draft.tags ?? [])])),
    });
  }
  return Array.from(byKey.values());
}

/** The whole pipeline: messy rows in, clean unique book drafts out. */
export function cleanRows(rows) {
  return mergeDuplicates(rows.flatMap(expandRow));
}
