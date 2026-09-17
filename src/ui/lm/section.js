/**
 * section.js — what happens after she walks through a door.
 *
 * ── THE TRANSITION ────────────────────────────────────────────────
 * Stepping into a section swaps the floor plan for a full-bleed wall of
 * covers: a big one on the left, rows of the rest beside it, scrolling
 * sideways. The genre's own world is already on the page behind it, so
 * walking into Horror really does put fog and candles behind the
 * covers.
 *
 * ── THE PART THAT MATTERS ─────────────────────────────────────────
 * Every card here is `bookCard` — the identical component the shelves
 * use — so a cover behaves the same in both places: same badges, same
 * quick actions, and a click that calls the same `openBookDetail`. There
 * is deliberately no second book page. A book cannot have different
 * features depending on which route she took to reach it, because there
 * is only one implementation of a book.
 *
 * ── THE ROWS ARE DERIVED ──────────────────────────────────────────
 * Nothing here is a fixed list. A row appears when it has something in
 * it and is silently skipped when it does not, so a section of three
 * books shows one row and a section of forty shows five.
 */

import { esc } from '../../utils/dom.js';
import { bookCard } from '../components/book-card.js';
import { STATUS } from '../../data/models.js';
import { countBy } from '../../state/selectors.js';
import { cat, catForWorld, catCoatForWorld } from '../cat.js';
import { genreMeta } from '../../data/genres.js';
import { framedScene } from '../scene.js';
import { line, SESSION, GOSSIP_LINES, STUDY_LINES } from '../../data/quips.js';
import { plural } from '../../utils/text.js';

/* ─────────────────────────── the stacks ──────────────────────────── */

/**
 * The one room that holds several genres at once.
 *
 * Every OTHER room in the building is a single genre, and walking into
 * one of those hands straight over to the shelves' own genre view — the
 * same stage, the same filter bar, the same cards. There used to be a
 * second genre browser in this file for Library Mode to use instead,
 * which meant two screens for one idea and two places for a genre to
 * look wrong.
 *
 * The stacks cannot do that, because the filter takes one genre and this
 * room is the long tail of a dozen. So it is a signpost rather than a
 * browser: which shelf, and how many on it. Every entry leads into the
 * same genre view as everything else.
 */
export function stacksPanel(room, books, ctx) {
  const shelves = countBy(books, (b) => b.genre)
    .filter((g) => g.name)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return `
  <section class="lmx lmx--special" data-section="${esc(room.id)}">
    <div class="lmx__top">
      <button class="btn btn--ghost btn--sm lmx__back" type="button" data-leave-room>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M19 12H6M11 6l-6 6 6 6"/></svg>
        Back to the floor
      </button>
      <p class="lmx__breadcrumb">${esc(room.label)}</p>
    </div>

    <header class="lmx__hero lmx__hero--special">
      <div class="lmx__hero-words">
        <span class="lmx__icon" aria-hidden="true">${room.icon}</span>
        <h1 class="lmx__title">${esc(room.label)}</h1>
        <p class="lmx__count">${books.length} ${plural(books.length, 'book', 'books')}
          across ${shelves.length} small ${plural(shelves.length, 'shelf', 'shelves')}</p>
        <p class="lmx__quip">${esc(room.quip ?? '')}</p>
      </div>
      <div class="lmx__hero-mascot" aria-hidden="true">
        ${cat(catForWorld(room.world), { size: 78, className: 'cat--alive', tint: catCoatForWorld(room.world) })}
      </div>
    </header>

    <div class="stacks">
      ${shelves.map((shelf) => `
        <button class="stacks__row" type="button" data-see-genre="${esc(shelf.name)}">
          <span class="stacks__icon" aria-hidden="true">${genreMeta(shelf.name).icon}</span>
          <span class="stacks__body">
            <span class="stacks__name">${esc(shelf.name)}</span>
            <span class="stacks__quip">${esc(genreMeta(shelf.name).quip)}</span>
          </span>
          <span class="stacks__count">${shelf.count}</span>
          <svg class="stacks__go" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M5 12h13M13 6l6 6-6 6"/>
          </svg>
        </button>`).join('')}
    </div>
  </section>`;
}

/* ───────────────────────── the odd rooms ─────────────────────────── */

/**
 * The three rooms that are not genres.
 *
 * Each one has real content in it, derived from her actual books — an
 * Easter egg that turns out to be empty is just a dead end with a nice
 * name on it.
 */
export function specialPanel(room, allBooks, ctx) {
  const inner = room.id === '__study' ? study(allBooks)
    : room.id === '__gossip' ? gossip(allBooks)
      : glasshouse(allBooks, ctx);

  return `
  <section class="lmx lmx--special" data-section="${esc(room.id)}">
    <div class="lmx__top">
      <button class="btn btn--ghost btn--sm lmx__back" type="button" data-leave-room>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M19 12H6M11 6l-6 6 6 6"/></svg>
        Back to the floor
      </button>
      <p class="lmx__breadcrumb">${esc(room.label)}</p>
    </div>

    <header class="lmx__hero lmx__hero--special">
      <div class="lmx__hero-words">
        <span class="lmx__icon" aria-hidden="true">${room.icon}</span>
        <h1 class="lmx__title">${esc(room.label)}</h1>
        <p class="lmx__quip">${esc(room.quip ?? '')}</p>
      </div>
      <div class="lmx__hero-mascot" aria-hidden="true">
        ${cat(catForWorld(room.world), {
    size: 78, className: 'cat--alive', tint: catCoatForWorld(room.world),
  })}
      </div>
    </header>

    ${inner}
  </section>`;
}

/**
 * The study.
 *
 * Her actual subject gets a room, but the room talks about her BOOKS,
 * not about her job — this is a library, and a page that started
 * summarising someone's career would be a CV with a globe on it.
 * Everything below is counted from the shelves.
 */
function study(books) {
  const worldly = books.filter((b) => ['Economics', 'Business', 'Science', 'History',
    'Nonfiction', 'Philosophy', 'Psychology'].includes(b.genre));
  const byGenre = countBy(worldly, (b) => b.genre).filter((g) => g.name);

  return `
  <div class="study">
    <div class="study__board">
      <h2 class="study__head">Pinned to the board</h2>
      <ul class="study__list">
        ${byGenre.slice(0, 6).map((g) => `
          <li class="study__item" data-see-genre="${esc(g.name)}" role="button" tabindex="0">
            <span class="study__item-name">${esc(g.name)}</span>
            <span class="study__item-bar"><i style="width:${Math.round((g.count / byGenre[0].count) * 100)}%"></i></span>
            <span class="study__item-count">${g.count}</span>
          </li>`).join('')}
      </ul>
      <p class="study__note">
        ${worldly.length} of your books are about how the world actually behaves.
        That is ${Math.round((worldly.length / Math.max(1, books.length)) * 100)}% of the whole library.
      </p>
    </div>

    <div class="study__wall">
      ${framedScene('economics', `${SESSION}:study`, { caption: 'the desk, mid-thought', tilt: -1.5 })}
      <p class="study__aside">${esc(line(STUDY_LINES, 'study', `${SESSION}:study`))}</p>
    </div>
  </div>`;
}

/**
 * The whispering corner.
 *
 * Gossip about the LIBRARY — the author who will not leave, the shelf
 * that is out of control — all of it counted, none of it about a person.
 */
function gossip(books) {
  const items = [];
  const authors = countBy(books, (b) => b.author)
    .filter((a) => a.name && a.name !== 'Author unknown');
  const genres = countBy(books, (b) => b.genre).filter((g) => g.name);

  if (authors[0]?.count > 1) {
    items.push(`${authors[0].name} has ${authors[0].count} books in here. At this point it is a residency.`);
  }
  if (genres[0]) {
    items.push(`${genres[0].name} is quietly taking over — ${genres[0].count} books and counting.`);
  }

  const longest = [...books].sort((a, b) => b.title.length - a.title.length)[0];
  if (longest) items.push(`The longest title in the building is "${longest.title}". Nobody asked it to be.`);

  const unread = books.filter((b) => b.status === STATUS.TBR).length;
  if (unread) items.push(`${unread} books have never been opened and they all know about each other.`);

  const series = countBy(books.filter((b) => b.series), (b) => b.series);
  if (series[0]?.count > 2) {
    items.push(`There are ${series[0].count} ${series[0].name} books on these shelves. That is a commitment.`);
  }

  const dnf = books.filter((b) => b.status === STATUS.DNF).length;
  if (dnf) items.push(`${dnf} ${plural(dnf, 'book was', 'books were')} put down mid-sentence. They are still bitter.`);

  const shortest = [...books].filter((b) => b.title.length > 2)
    .sort((a, b) => a.title.length - b.title.length)[0];
  if (shortest) items.push(`"${shortest.title}" has the shortest title here and it is extremely smug about it.`);

  return `
  <div class="gossip">
    <p class="gossip__intro">${esc(line(GOSSIP_LINES, 'gossip', `${SESSION}:gossip`))}</p>
    <ul class="gossip__notes">
      ${items.map((text, i) => `
        <li class="gossip__note" style="--i:${i}">
          <span class="gossip__pin" aria-hidden="true"></span>
          ${esc(text)}
        </li>`).join('')}
    </ul>
    ${items.length ? '' : '<p class="muted">Nothing to report. Suspicious.</p>'}
  </div>`;
}

/**
 * The glasshouse: the quiet room, holding the books she actually loves.
 * Falls back to whatever she has rated highest when nothing is hearted
 * yet, so the room is never empty on day one.
 */
function glasshouse(books, ctx) {
  let picked = books.filter((b) => b.favourite);
  let note = 'Everything in here has a heart on it.';

  if (!picked.length) {
    picked = books.filter((b) => b.rating >= 4).slice(0, 12);
    note = 'Nothing is hearted yet, so this is what you rated highest.';
  }
  if (!picked.length) {
    picked = books.filter((b) => b.status === STATUS.READ).slice(0, 12);
    note = 'Nothing is hearted yet, so this is what you have finished.';
  }

  return `
  <div class="glass">
    <p class="glass__note">${esc(note)}</p>
    ${picked.length
    ? `<div class="lmx__rail" tabindex="0" role="group" aria-label="The glasshouse">
         ${picked.map((book, i) => bookCard(book, { cache: ctx.cache, index: i })).join('')}
       </div>`
    : `<p class="muted">Heart a few books and they will end up in here.</p>`}
    <div class="glass__vines" aria-hidden="true">
      ${[0, 1, 2, 3, 4, 5].map((i) => `<span class="glass__vine" style="--i:${i}"></span>`).join('')}
    </div>
  </div>`;
}
