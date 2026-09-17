/**
 * catalogue.js — the books, with everything known about them.
 *
 * ── WHERE THIS CAME FROM ──────────────────────────────────────────
 * The complete 208-row collection list, transcribed row by row. The
 * source numbered 208 entries; two of them were exact repeats, so the
 * catalogue holds 206 books. See THE REPEATS below.
 *
 * ── WHY IT IS SPLIT INTO PARTS ────────────────────────────────────
 * Two hundred books with a paragraph each is several thousand lines,
 * which is a file nobody can edit at one in the morning. The books
 * therefore live in `catalogue/`, grouped by the part of the shelf they
 * belong to, and this file joins them back into one array.
 *
 * Nothing else in the app knows or cares: `CATALOGUE` is exactly what it
 * always was. Adding a book means adding it to whichever part fits.
 *
 * ── WHAT WAS CORRECTED, AND WHY ───────────────────────────────────
 * Titles are given as published, and each author has one consistent
 * spelling. The corrections made to the source rows are listed here
 * rather than applied silently:
 *
 *   row 20   "Breakthrough Nations"  ->  "Breakout Nations"
 *            Ruchir Sharma has no book of the first name; Breakout
 *            Nations (2012) is the book.
 *   row 48   "Stranger Houses"       ->  "Strange Houses"
 *            Uketsu's novel, published in English as Strange Houses.
 *   row 92   "Katie Price / Crystal" ->  "Crystal" by Katie Price
 *            The two columns were the wrong way round: Crystal is the
 *            novel, Katie Price wrote it.
 *   row 129  "Durjoy Dutta"          ->  "Durjoy Datta"
 *   row 142  "The New Emerging Markets Multinationals"
 *                                    -> "The New Emerging Market
 *            Multinationals" (published title, singular "Market")
 *   row 152  "P.S. I Love You"       ->  "PS, I Love You"
 *   row 156  "Renie Airth"           ->  "Rennie Airth"
 *   row 166  author order normalised to the published credit
 *
 * Misspellings from earlier versions of the list are still caught
 * automatically by corrections.js if they arrive again through the
 * importer: Book Theif, The Haindmaid's Tale, Oliver Dicken, Gabreille
 * Zevin, Alex Michaeldes, Fitzerald, Stephen Meyer.
 *
 * ── THE REPEATS ───────────────────────────────────────────────────
 * Rows 22 and 189 are both The Art of Thinking Clearly by Rolf Dobelli.
 * Rows 134 and 176 are both Two of a Kind Diaries. Each is kept once.
 *
 * Everything that only LOOKS like a repeat is kept in full, because it
 * is not one: fourteen Wimpy Kid books, seven Lee Child novels, five
 * Goosebumps, four Famous Five, three Nancy Drew, three Kavita Kane,
 * three Ashwin Sanghi, three Sophie Kinsella, three Devdutt Pattanaik,
 * three Thomas Friedman, three Khaled Hosseini and three Daniel Goleman
 * are all separate books with separate titles.
 *
 * ── GENRES ────────────────────────────────────────────────────────
 * The source said "Not specified" for most rows. Genres here are the
 * book's actual subject, assigned per book, using the fixed vocabulary
 * in genres.js so the shelves and the genre worlds line up. Where the
 * source DID give a genre it is honoured, unless it was plainly a note
 * rather than a genre ("Famous Five", "Diary"), in which case it became
 * the `series` instead.
 *
 * ── WHAT IS NOT INVENTED ──────────────────────────────────────────
 * Descriptions are written from the actual books. Where a title is
 * genuinely ambiguous — several editions share the name, no author was
 * given, or the book could not be identified with confidence — the
 * entry carries `needsReview: true`, keeps whatever the source actually
 * said, says plainly on screen that it needs a look, and is given NO
 * cover, because a guessed cover is a lie with a picture on it.
 *
 * Reading status is NOT set anywhere in here. Nothing claims she has
 * read anything; that is hers to say, via the shelf-sorting flow.
 *
 * Fields: title, author, genre, subgenre?, series?, description,
 *         tags?, needsReview?
 */

import { NOVELS } from './catalogue/novels.js';
import { CRIME } from './catalogue/crime.js';
import { SPECULATIVE } from './catalogue/speculative.js';
import { MINDS } from './catalogue/minds.js';
import { WORLD } from './catalogue/world.js';
import { YOUNG } from './catalogue/young.js';

/** Bump this to make an existing library top itself up on next load. */
export const CATALOGUE_VERSION = '2026.09.16-full208';

/** The parts, in shelf order. Named so a count check can report them. */
export const CATALOGUE_PARTS = Object.freeze({
  novels: NOVELS,
  crime: CRIME,
  speculative: SPECULATIVE,
  minds: MINDS,
  world: WORLD,
  young: YOUNG,
});

export const CATALOGUE = [
  ...NOVELS,
  ...CRIME,
  ...SPECULATIVE,
  ...MINDS,
  ...WORLD,
  ...YOUNG,
];

export default CATALOGUE;
