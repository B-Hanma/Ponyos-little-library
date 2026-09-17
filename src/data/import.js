/**
 * import.js — paste a spreadsheet, get books.
 *
 * The original collection lives in a sheet with columns like
 *
 *     S. No. | Book Name | Author | Genre
 *
 * so that is exactly what this accepts: rows copied straight out of
 * Excel or Google Sheets (tab separated), or a CSV file, or even a
 * plain list of titles one per line. Everything is normalised on the
 * way in and the repository refuses to overwrite a book she has
 * already annotated.
 */

import { normalizeGenre } from './genres.js';
import { smartTitle, unflipAuthor, normalize } from '../utils/text.js';
import { expandRow, mergeDuplicates } from './corrections.js';

/** Split one CSV line, respecting quoted fields containing commas. */
function splitCsvLine(line) {
  const out = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(field); field = ''; }
    else field += ch;
  }
  out.push(field);
  return out;
}

function splitLine(line) {
  if (line.includes('\t')) return line.split('\t');
  if (line.includes(',')) return splitCsvLine(line);
  if (line.includes('|')) return line.split('|');
  return [line];
}

const HEADER_WORDS = ['book name', 'title', 'author', 'genre', 's. no', 's.no', 'sno', 'serial'];

function looksLikeHeader(cells) {
  const joined = cells.join(' ').toLowerCase();
  return HEADER_WORDS.filter((word) => joined.includes(word)).length >= 2;
}

/** A cell that is just a row number. */
const isIndexCell = (cell) => /^\d{1,4}[.)]?$/.test(cell.trim());

/**
 * Parse pasted text into book drafts.
 *
 * The result runs through the SAME cleaning pipeline as the shipped
 * catalogue — corrections.js — so a row typed into the import box is
 * split, spell-corrected and de-duplicated exactly like one typed into
 * the catalogue file. That is the whole point: there is one set of
 * rules, and both doors lead through it.
 *
 * What the pipeline does, in order:
 *   1. a compound row becomes several books
 *      "The Famous Five (Five Go to Smuggler's Top; Five Go Off in a
 *      Caravan; Five on Kirrin Island Again)" -> three books, one series
 *      "The Stockmen; Black Wind; Gweilo; The Blood-Dimmed Tide" -> four
 *      A bracketed SUBTITLE is deliberately not split.
 *   2. known misspellings are corrected (Book Theif, Oliver Dicken, …)
 *   3. genuine duplicates are merged, keeping the richer record
 *      field by field. Different volumes of a series have different
 *      titles, so they never collapse into each other.
 *
 * `report` is what the UI shows her, because "203 rows became 208
 * books, 4 duplicates merged" is the only honest way to say what
 * happened to her list.
 *
 * @returns {{books: Object[], skipped: string[], report: Object}}
 */
export function parseBookList(text) {
  const rows = [];
  const skipped = [];
  const seen = new Set();

  const lines = String(text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    let cells = splitLine(line).map((c) => c.trim().replace(/^"|"$/g, ''));

    if (looksLikeHeader(cells)) continue;
    if (cells.length && isIndexCell(cells[0])) cells = cells.slice(1);

    const [rawTitle = '', rawAuthor = '', rawGenre = ''] = cells;
    const title = smartTitle(rawTitle);
    if (!title || title.length < 2) { skipped.push(line); continue; }

    // Handle "Title - Author" and "Title by Author" on a single-column paste.
    let author = unflipAuthor(smartTitle(rawAuthor));
    let cleanTitle = title;
    if (!author) {
      const split = title.match(/^(.+?)\s+(?:-|–|—|by)\s+(.+)$/i);
      if (split) {
        cleanTitle = smartTitle(split[1].trim());
        author = unflipAuthor(smartTitle(split[2].trim()));
      }
    }

    // Dedupe identical LINES here; real book-level de-duplication is
    // cleanRows' job, and it knows about articles and accents.
    const key = `${normalize(cleanTitle)}::${normalize(author)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push({
      title: cleanTitle,
      author,
      // An unrecognised genre becomes blank rather than a wrong shelf.
      genre: normalizeGenre(rawGenre),
    });
  }

  // One pipeline, shared with the shipped catalogue.
  const expanded = rows.flatMap(expandRow);
  const books = mergeDuplicates(expanded);

  return {
    books,
    skipped,
    report: {
      /** Numbered rows we could read. */
      rows: rows.length,
      /** Lines we could not make a book out of. */
      unreadable: skipped.length,
      /** Books after compound rows were split apart. */
      expanded: expanded.length,
      /** How many extra books came out of compound rows. */
      split: Math.max(0, expanded.length - rows.length),
      /** Genuine duplicates folded together. */
      merged: Math.max(0, expanded.length - books.length),
      /** What would actually go on the shelves. */
      books: books.length,
    },
  };
}

/** Read a .json export back in. Returns book drafts, or null if it is not ours. */
export function parseBackup(text) {
  try {
    const data = JSON.parse(text);
    if (data?.format !== 'ponyo-library' || !Array.isArray(data.books)) return null;
    return data;
  } catch {
    return null;
  }
}
