/**
 * library.js — the shelves.
 *
 * Two layouts, one dataset:
 *   shelves — genre rails on wooden planks. The default, because it
 *             looks like a room rather than a database.
 *   grid    — one flat wall of covers, for when she is hunting.
 *
 * Searching or filtering by genre always collapses to the grid, since
 * rails of one book each are silly.
 *
 * The mood check-in sits above everything, and the TBR shelf gets its
 * own pile illustration instead of a plain grid.
 */

import { esc } from '../../utils/dom.js';
import { SHELVES, SORTS } from '../../state/store.js';
import {
  visibleBooks, shelfCounts, groupByGenre, genreFacets, authorFacets, tagFacets, UNSHELVED_LABEL,
} from '../../state/selectors.js';
import { bookGrid, bookCard } from '../components/book-card.js';
import { moodCard } from '../components/mood-card.js';
import { genreMeta } from '../../data/genres.js';
import { SHELF_QUIPS, EMPTY_LINES, GENRE_LINES, line, SESSION } from '../../data/quips.js';
import { cat, catForWorld as worldMood, catCoatForWorld as worldCoat } from '../cat.js';
import { scene } from '../scene.js';
import { roleForGenre } from '../../data/scenes.js';
import { getWorld } from '../../theme/worlds.js';
import { plural } from '../../utils/text.js';

const SHELF_TABS = [
  { key: SHELVES.ALL, label: 'Everything', icon: '\u{1F30A}' },
  { key: SHELVES.READING, label: 'Reading', icon: '\u{1F331}' },
  { key: SHELVES.TBR, label: 'To read', icon: '\u{1F41A}' },
  { key: SHELVES.READ, label: 'Read', icon: '\u{1F4D6}' },
  { key: SHELVES.FAVOURITES, label: 'Favourites', icon: '\u{2764}' },
  { key: SHELVES.DNF, label: 'Set down', icon: '\u{1F343}' },
];

const SORT_LABELS = {
  [SORTS.SHELF]: 'By author',
  [SORTS.TITLE]: 'By title',
  [SORTS.RECENT]: 'Recently touched',
  [SORTS.OLDEST]: 'Oldest first',
  [SORTS.RATING]: 'Highest rated',
};

const RAIL_LIMIT = 18;

export function renderLibrary(ctx) {
  const { repo, store } = ctx;
  const state = store.state;
  const all = repo.all();
  const visible = visibleBooks(all, state);
  const counts = shelfCounts(all);

  const useShelves = state.prefs.layout === 'shelves' && !store.hasFilters();

  return `
    ${state.genre ? genreBanner(
    state.genre,
    visible.length,
    state.fromBuilding?.genre === state.genre ? state.fromBuilding : null,
  ) : moodCard({
    mood: state.mood,
    recs: ctx.computeRecs ? ctx.computeRecs() : [],
    freeText: state.moodText,
    collapsed: state.moodCollapsed,
    cache: ctx.cache,
  })}
    ${filterBar(state, counts, all, visible)}
    ${state.shelf === SHELVES.TBR && !store.hasFilters() ? tbrPile(counts) : ''}
    ${visible.length
    ? (useShelves ? shelvesLayout(visible, ctx) : bookGrid(visible, ctx.cache))
    : emptyState(state)}
  `;
}

function filterBar(state, counts, all, visible) {
  const genres = genreFacets(all);
  const authors = authorFacets(all).filter((a) => a.count > 1);
  const tags = tagFacets(all);
  const needsReview = all.filter((b) => b.needsReview).length;
  // A new line each time she arrives on a shelf — steady while she is there.
  const quip = line(
    SHELF_QUIPS[state.shelf] ?? SHELF_QUIPS.all,
    'shelf',
    `${SESSION}:${state.shelf}:${state.genre}`,
  );

  return `
  <div class="filterbar">
    <div class="shelf-tabs" role="tablist" aria-label="Shelves">
      ${SHELF_TABS.map((tab) => `
        <button class="pill ${state.shelf === tab.key ? 'is-active' : ''}" type="button"
                role="tab" aria-selected="${state.shelf === tab.key}" data-shelf="${tab.key}">
          <span aria-hidden="true">${tab.icon}</span>${tab.label}
          <span class="pill__count">${counts[tab.key] ?? 0}</span>
        </button>`).join('')}
    </div>

    <div class="refine">
      <select class="select" data-filter="genre" aria-label="Filter by genre">
        <option value="">All genres</option>
        ${genres.map((g) => `<option value="${esc(g.name)}" ${state.genre === g.name ? 'selected' : ''}>${esc(g.name)} (${g.count})</option>`).join('')}
      </select>

      <select class="select" data-filter="author" aria-label="Filter by author">
        <option value="">All authors</option>
        ${authors.map((a) => `<option value="${esc(a.name)}" ${state.author === a.name ? 'selected' : ''}>${esc(a.name)} (${a.count})</option>`).join('')}
      </select>

      <select class="select" data-filter="minRating" aria-label="Minimum rating">
        <option value="0">Any rating</option>
        ${[5, 4, 3].map((n) => `<option value="${n}" ${state.minRating === n ? 'selected' : ''}>${'★'.repeat(n)} and up</option>`).join('')}
      </select>

      ${tags.length ? `
      <select class="select" data-filter="tag" aria-label="Filter by tag">
        <option value="">All tags</option>
        ${tags.map((t) => `<option value="${esc(t.name)}" ${state.tag === t.name ? 'selected' : ''}>${esc(t.name)} (${t.count})</option>`).join('')}
      </select>` : ''}

      <select class="select" data-filter="sort" aria-label="Sort">
        ${Object.entries(SORT_LABELS).map(([key, label]) => `<option value="${key}" ${state.sort === key ? 'selected' : ''}>${label}</option>`).join('')}
      </select>

      <button class="pill" type="button" data-toggle-layout title="Switch layout">
        ${state.prefs.layout === 'shelves' ? '\u{1F5C3} Shelves' : '\u{1F4D1} Grid'}
      </button>

      ${needsReview ? `
        <button class="pill ${state.reviewOnly ? 'is-active' : ''}" type="button" data-review-toggle
                title="Books whose source row was ambiguous">
          \u{1F50D} Needs a look <span class="pill__count">${needsReview}</span>
        </button>` : ''}

      ${state.query || state.genre || state.author || state.minRating || state.tag || state.reviewOnly
    ? '<button class="pill" type="button" data-clear-filters>Clear</button>' : ''}

      <button class="pill pill--add" type="button" data-action="add-book">+ Add a book</button>

      <span class="refine__spacer"></span>
      <span class="refine__count">${visible.length} ${plural(visible.length, 'book')}</span>
    </div>

    <p class="mood-note">${esc(currentQuip(state, quip))}</p>
  </div>`;
}

function currentQuip(state, shelfQuip) {
  if (state.reviewOnly) return 'Rows the source list was not clear about. Fill in what you know.';
  if (state.query) return `Looking for “${state.query}”.`;
  if (state.genre && state.genre !== UNSHELVED_LABEL) return genreMeta(state.genre).quip;
  if (state.genre === UNSHELVED_LABEL) return 'Books with no genre on file. Mysterious by accident.';
  if (state.author) return `Everything here is by ${state.author}.`;
  return shelfQuip;
}

/** The to-read shelf gets a physical pile rather than a bare grid. */
function tbrPile(counts) {
  const n = counts[SHELVES.TBR] ?? 0;
  if (!n) return '';
  const shown = Math.min(n, 9);
  return `
  <div class="pile">
    <div class="pile__stack" style="width:180px">
      ${Array.from({ length: shown }, (_, i) => `
        <span class="pile__book" style="--i:${i};--r:${((i * 37) % 7) - 3}deg"></span>`).join('')}
    </div>
    <span class="pile__count">${n} ${plural(n, 'book')} waiting</span>
    <span class="pile__line">Each one is convinced it is next.</span>
  </div>`;
}

function shelvesLayout(books, ctx) {
  const groups = groupByGenre(books);
  return groups.map((group) => {
    const meta = group.isOdds
      ? { icon: '\u{1F9F6}', quip: 'One of each. The shelf for books that came alone.' }
      : group.genre === UNSHELVED_LABEL
        ? { icon: '\u{1F4D4}', quip: 'Not filed anywhere. Yet.' }
        : genreMeta(group.genre);

    const shown = group.isOdds ? group.books : group.books.slice(0, RAIL_LIMIT);
    const hidden = group.books.length - shown.length;

    return `
    <section class="shelf" data-mood="${group.mood}">
      <div class="shelf__head">
        <!-- She is in costume for the shelf: a deerstalker on Mystery, a
             sheet on Horror. The same character everywhere, so a genre
             reads as a place she also lives in. -->
        ${cat(worldMood(group.mood), { size: 46, className: 'cat--shelf' })}
        <div class="shelf__titles">
          <h2 class="shelf__name">
            <span aria-hidden="true">${meta.icon}</span>
            ${esc(group.genre)}
            <em>${group.books.length}</em>
          </h2>
          <p class="shelf__quip">${esc(meta.quip)}</p>
        </div>
        ${!group.isOdds && group.genre !== UNSHELVED_LABEL ? `
          <button class="btn btn--ghost btn--sm" type="button" data-see-genre="${esc(group.genre)}">
            ${hidden ? `See all ${group.books.length}` : 'Enter this world'} &rarr;
          </button>` : ''}
      </div>
      <div class="shelf__rail-wrap is-end">
        <div class="shelf__rail">
          ${shown.map((book, i) => {
    return bookCard(book, { cache: ctx.cache, index: i });
  }).join('')}
        </div>
      </div>
      <div class="shelf__plank"></div>
    </section>`;
  }).join('');
}

/**
 * The banner at the top of a genre.
 *
 * Filtering to a genre already changes the whole page — the palette, the
 * scenery behind it, the weather. This is the part of that change you
 * can look directly at: a panel of her own artwork chosen for this kind
 * of book, the kitten in that genre's mood, and the genre's own line.
 *
 * It replaces the mood check-in while a genre is open rather than
 * stacking on top of it: two big cards competing above the shelf is how
 * a page stops having a subject.
 */
function genreBanner(genre, count, fromBuilding) {
  const meta = genreMeta(genre);
  const role = roleForGenre(genre);

  const world = getWorld(meta.mood);

  return `
  <section class="stage" data-mood="${meta.mood}" data-genre-stage>
    ${fromBuilding ? `
    <!-- She walked in through a door rather than arriving by filter, so
         the way out is back to the floor she left, at the spot she left
         it — not to the top of the shelves. -->
    <button class="stage__back" type="button" data-back-to-floor>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M19 12H6M11 6l-6 6 6 6"/></svg>
      Back to the floor
    </button>` : ''}
    <!--
      The scene IS the page here, not a thumbnail on it.

      Her artwork fills the whole band; the words sit inside the scene on
      a soft vertical scrim that fades out well before the middle, so the
      picture is never printed over and she is never written across. The
      genre's own particles fall in front of it, and the kitten stands at
      the bottom of the frame in that genre's coat and mood.
    -->
    <div class="stage__scene" aria-hidden="true">
      ${scene(role, `${SESSION}:${genre}`, { fit: 'cover' })}
    </div>
    <div class="stage__scrim" aria-hidden="true"></div>
    <div class="stage__weather" data-weather="${world.particles?.kind ?? 'motes'}" aria-hidden="true"></div>

    <div class="stage__body">
      <p class="stage__eyebrow">${count} ${plural(count, 'book', 'books')} on this shelf</p>
      <h2 class="stage__name">
        <span class="stage__icon" aria-hidden="true">${meta.icon}</span>
        ${esc(genre)}
      </h2>
      <p class="stage__quip">${esc(meta.quip)}</p>
      <div class="stage__foot">
        <!-- The kitten sits WITH the words, not over the artwork. The
             scene already has a cat in it; a second one pasted across it
             read as a sticker rather than as company. -->
        <span class="stage__cat" aria-hidden="true">${cat(worldMood(meta.mood), {
    size: 72,
    className: 'cat--alive',
    tint: worldCoat(meta.mood),
  })}</span>
        <p class="stage__line">${esc(line(
    GENRE_LINES[genre] ?? [world.greeting],
    `genre:${genre}`, `${SESSION}:${genre}`,
  ))}</p>
      </div>
    </div>
  </section>`;
}

function emptyState(state) {
  const kind = state.query ? 'search' : 'shelf';
  return `
  <div class="empty">
    ${cat('deadpan', { size: 110, className: 'cat--peek' })}
    <h2 class="empty__title">Nothing here</h2>
    <p class="empty__text">${esc(line(EMPTY_LINES[kind], `empty:${kind}`, state.query || state.shelf))}</p>
    <button class="btn" type="button" data-clear-filters>Clear the filters</button>
  </div>`;
}
