/**
 * book-card.js — a book, as an object you could pick up.
 *
 * Renders to an HTML string. Interaction is handled by the library view
 * through delegation, so a shelf of two hundred cards costs two
 * listeners instead of six hundred.
 */

import { esc } from '../../utils/dom.js';
import { coverMarkup } from '../covers.js';
import { STATUS, STATUS_META } from '../../data/models.js';

const HEART = '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M12 20s-7-4.5-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 2.5C19 15.5 12 20 12 20z"/></svg>';

const QUICK_ACTIONS = [
  { status: STATUS.READ, icon: '\u{1F4D6}', label: 'Mark as read' },
  { status: STATUS.READING, icon: '\u{1F331}', label: 'Mark as currently reading' },
  { status: STATUS.TBR, icon: '\u{1F41A}', label: 'Move to the to-read pile' },
];

function stars(rating) {
  if (!rating) return '';
  return `<div class="book__stars" aria-label="${rating} out of 5 stars">${'★'.repeat(rating)}</div>`;
}

function badges(book) {
  const out = [];
  if (book.favourite) {
    out.push(`<span class="badge badge--fav" title="Favourite">${HEART}</span>`);
  }
  if (book.status !== STATUS.TBR) {
    const meta = STATUS_META[book.status];
    out.push(`<span class="badge badge--${meta.badge}" title="${esc(meta.label)}">${meta.icon}</span>`);
  }
  if (book.needsReview) {
    out.push('<span class="badge badge--review" title="The source row was ambiguous — needs a look">?</span>');
  }
  return out.length ? `<div class="book__badges">${out.join('')}</div>` : '';
}

/**
 * @param {Object} book
 * @param {{cache?: Object, index?: number}} options
 */
export function bookCard(book, { cache, index = 0 } = {}) {
  const delay = Math.min(index, 24) * 22;
  const status = STATUS_META[book.status];
  const label = [
    `${book.title} by ${book.author}`,
    status.label,
    book.rating ? `${book.rating} stars` : '',
    book.favourite ? 'favourite' : '',
  ].filter(Boolean).join('. ');

  const quick = QUICK_ACTIONS.map((action) => `
        <button type="button"
                data-quick="${action.status}"
                data-id="${esc(book.id)}"
                class="${book.status === action.status ? 'is-on' : ''}"
                title="${esc(action.label)}"
                aria-label="${esc(action.label)}">${action.icon}</button>`).join('');

  return `
  <article class="book" style="animation-delay:${delay}ms">
    <div class="book__object">
      <div class="book__art">${coverMarkup(book, cache)}</div>
      <button class="book__hit" type="button" data-open="${esc(book.id)}" aria-label="${esc(label)}">
      </button>
      ${badges(book)}
      <div class="book__quick" role="group" aria-label="Quick status">${quick}
      </div>
    </div>
    <div class="book__meta">
      <span class="book__title">${esc(book.title)}</span>
      <span class="book__author">${esc(book.author)}</span>
      ${stars(book.rating)}
    </div>
  </article>`;
}

/** A whole grid of them. */
export function bookGrid(books, cache) {
  if (!books.length) return '';
  // The cache handles requesting uploads itself, so a grid is just a map.
  return `<div class="grid-books">${
    books.map((book, i) => bookCard(book, { cache, index: i })).join('')
  }</div>`;
}
