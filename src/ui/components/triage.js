/**
 * triage.js — "sort the shelves quickly".
 *
 * The library arrives with every book on the to-read pile, because
 * guessing what she has already read would be inventing facts about her.
 * This is the fix: one book at a time, three big buttons, no forms.
 * Two hundred books takes about three minutes.
 */

import { qs, esc } from '../../utils/dom.js';
import { openModal } from './overlays.js';
import { coverMarkup } from '../covers.js';
import { STATUS } from '../../data/models.js';

/** Books that have never been touched — still seeded, still on the pile. */
function untouched(repo) {
  return repo.all().filter((b) => b.seeded
    && b.status === STATUS.TBR
    && !b.rating
    && !b.favourite
    && !b.notes.length
    && !b.thoughts.trim());
}

export function openTriage(ctx) {
  const { repo, store, cache, refresh } = ctx;
  const queue = untouched(repo);

  if (!queue.length) {
    openModal({
      title: 'Nothing left to sort',
      size: 'sm',
      body: '<p class="muted">Every book here has been given a shelf, a rating or an opinion. Well done, genuinely.</p>',
      footer: '<button class="btn btn--primary" type="button" data-close>Good</button>',
    });
    return;
  }

  let index = 0;
  let sorted = 0;
  /** Set by onMount, which runs before openModal returns. */
  let panel = null;

  openModal({
    title: 'Sort the shelves',
    subtitle: 'Where does this one belong? Skip anything you are not sure about.',
    body: '<div data-triage></div>',
    footer: '<button class="btn btn--ghost" type="button" data-stop>Done for now</button>',
    onMount(mounted, closeModal) {
      panel = mounted;
      qs('[data-stop]', mounted).addEventListener('click', closeModal);
      mounted.addEventListener('click', (event) => {
        const button = event.target.closest('[data-triage-set], [data-triage-skip]');
        if (!button) return;
        const book = queue[index];
        if (!book) return;
        if (button.dataset.triageSet) {
          repo.update(book.id, { status: button.dataset.triageSet });
          sorted += 1;
        }
        index += 1;
        store.touch('book');
        refresh?.();
        if (index >= queue.length) { finish(closeModal); return; }
        draw();
      });
      draw();
    },
    onClose() {
      store.touch('book');
      refresh?.();
    },
  });

  function finish(closeModal) {
    qs('[data-triage]', panel).innerHTML = `
      <div class="empty">
        <div class="empty__art" aria-hidden="true">\u{1F30A}</div>
        <h2 class="empty__title">That is the lot.</h2>
        <p class="empty__text">${sorted} ${sorted === 1 ? 'book' : 'books'} moved to where they belong.</p>
      </div>`;
    setTimeout(closeModal, 1800);
  }

  function draw() {
    const book = queue[index];
    if (!book) return;

    qs('[data-triage]', panel).innerHTML = `
      <div class="triage">
        <div class="triage__cover">${coverMarkup(book, cache)}</div>
        <div>
          <h3 class="triage__title serif">${esc(book.title)}</h3>
          <p class="triage__author">${esc(book.author)}${book.genre ? ` &middot; ${esc(book.genre)}` : ''}</p>
        </div>
        <div class="triage__actions">
          <button class="btn btn--primary" type="button" data-triage-set="${STATUS.READ}">\u{1F4D6} Read it</button>
          <button class="btn" type="button" data-triage-set="${STATUS.READING}">\u{1F331} Reading it</button>
          <button class="btn" type="button" data-triage-set="${STATUS.TBR}">\u{1F41A} Not yet</button>
          <button class="btn btn--ghost" type="button" data-triage-skip>Skip</button>
        </div>
        <p class="triage__progress">${index + 1} of ${queue.length}</p>
      </div>`;
  }
}
