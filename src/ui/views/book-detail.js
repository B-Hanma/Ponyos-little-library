/**
 * book-detail.js — the drawer that opens when she taps a book.
 *
 * Everything in here saves as she types. There is no Save button,
 * because a personal notebook should not ask permission.
 *
 * On desktop it is a right-hand drawer; on phones the same markup
 * becomes a bottom sheet. Opening it plays a short book-opening motion,
 * borrows the book's own atmosphere for the page behind it, and lands on
 * the cover.
 */

import { qs, qsa, esc, on, debounce, trapFocus, lockScroll } from '../../utils/dom.js';
import { coverMarkup } from '../covers.js';
import {
  STATUS, STATUS_META, ALL_STATUSES, addNote, progressFraction,
} from '../../data/models.js';
import { genreMeta, GENRE_NAMES, normalizeGenre } from '../../data/genres.js';
import { atmosphereFor, motifFor } from '../../data/book-atmosphere.js';
import {
  SUGGESTED_TAGS, RATING_WORDS, PROGRESS_LINES, TOASTS, BOOK_LINES,
  line as rotatingLine, SESSION, arrive,
} from '../../data/quips.js';
import { formatBytes, formatDate } from '../../utils/text.js';
import { processCoverImage } from '../../utils/image.js';
import { toast, confirmDialog, openModal } from '../components/overlays.js';
import { celebrateFinish, sparkleAt } from '../celebrate.js';
import { borrowMood } from '../../theme/theme-manager.js';

const STAR = '<svg viewBox="0 0 24 24" width="19" height="19"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z"/></svg>';
const HEART = '<svg viewBox="0 0 24 24" width="19" height="19"><path d="M12 20s-7-4.5-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 2.5C19 15.5 12 20 12 20z"/></svg>';

let active = null;

export function isDetailOpen() { return Boolean(active); }
export function closeDetail() { active?.close(); }

function progressLine(book) {
  // A finished book is finished. Saying "almost done" to someone who has
  // closed the cover is the kind of small wrongness that breaks the spell.
  if (book.status === STATUS.READ) return 'Finished. It lives in your head now.';
  if (book.status === STATUS.DNF) return 'Set down. However far you got was far enough.';
  const f = progressFraction(book);
  if (f === null) return PROGRESS_LINES[0][1];
  let line = PROGRESS_LINES[0][1];
  for (const [at, text] of PROGRESS_LINES) if (f >= at) line = text;
  return line;
}

/**
 * @param {Object} ctx  { repo, store, cache, refresh, stage, checkAchievements }
 * @param {string} bookId
 */
export function openBookDetail(ctx, bookId) {
  const { repo, store, cache, refresh } = ctx;
  const book = repo.get(bookId);
  if (!book) return;

  active?.close();

  // A new aside each time a book is opened, even the same one twice.
  arrive('book');

  const previouslyFocused = document.activeElement;
  const unlock = lockScroll();

  // The page behind borrows this book's own atmosphere where it has one,
  // otherwise its genre's world.
  const atmosphere = atmosphereFor(book);
  const world = atmosphere?.world ?? genreMeta(book.genre).mood;
  const restoreMood = borrowMood(world);
  const previousWorld = ctx.stage?.current ?? null;
  ctx.stage?.show(world);

  const root = qs('#drawer-root');
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const drawer = document.createElement('aside');
  drawer.className = 'drawer drawer--opening';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', `${book.title} by ${book.author}`);

  root.append(scrim, drawer);
  const releaseFocus = trapFocus(drawer);
  setTimeout(() => drawer.classList.remove('drawer--opening'), 620);

  let current = book;
  let thumbUrls = [];

  function save(patch) {
    current = repo.update(current.id, patch) ?? current;
    store.touch('book');
    refresh?.();
    return current;
  }

  function rerender({ keepScroll = true } = {}) {
    const body = qs('.drawer__body', drawer);
    const top = keepScroll && body ? body.scrollTop : 0;
    drawer.innerHTML = template(current, cache);
    const nextBody = qs('.drawer__body', drawer);
    if (nextBody) nextBody.scrollTop = top;
    if (current.coverId) cache.request(current.coverId);
    refreshAttachments();
  }

  function close() {
    if (!active) return;
    active = null;
    releaseFocus();
    unlock();
    restoreMood();
    if (previousWorld) ctx.stage?.show(previousWorld);
    document.removeEventListener('keydown', onKey);
    for (const url of thumbUrls) URL.revokeObjectURL(url);
    thumbUrls = [];
    drawer.classList.add('is-closing');
    scrim.classList.add('is-closing');
    setTimeout(() => { drawer.remove(); scrim.remove(); }, 270);
    store.set({ openBookId: null });
    if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus({ preventScroll: true });
  }

  function onKey(event) {
    if (event.key === 'Escape' && !document.querySelector('.modal')) close();
  }

  document.addEventListener('keydown', onKey);
  scrim.addEventListener('click', close);
  active = { close };
  store.set({ openBookId: current.id });

  rerender({ keepScroll: false });
  wire();

  /* ─────────────────────────── interactions ─────────────────────── */

  function wire() {
    on(drawer, 'click', '[data-close-drawer]', close);

    on(drawer, 'click', '[data-status]', (event, el) => {
      const next = el.dataset.status;
      if (next === current.status) return;
      save({ status: next });
      rerender();
      if (next === STATUS.READ) {
        const fresh = ctx.checkAchievements?.({ silent: true }) ?? [];
        celebrateFinish(current, { achievements: fresh });
      }
    });

    on(drawer, 'click', '[data-star]', (event, el) => {
      const value = Number(el.dataset.star);
      save({ rating: current.rating === value ? 0 : value });
      rerender();
    });

    on(drawer, 'click', '[data-fav]', (event, el) => {
      const wasOff = !current.favourite;
      save({ favourite: !current.favourite });
      if (wasOff) sparkleAt(el);
      rerender();
      ctx.checkAchievements?.();
      toast(current.favourite ? TOASTS.favourited : TOASTS.unfavourited);
    });

    /* progress */
    const saveProgress = debounce(() => {
      const cur = Number(qs('[data-progress-current]', drawer)?.value) || 0;
      const total = Number(qs('[data-progress-total]', drawer)?.value) || 0;
      const unit = qs('[data-progress-unit]', drawer)?.value ?? 'page';
      save({ progress: { current: cur, total, unit } });
      const bar = qs('[data-progress-bar]', drawer);
      const f = progressFraction(current);
      if (bar) bar.style.width = `${Math.round((f ?? 0) * 100)}%`;
      const line = qs('[data-progress-line]', drawer);
      if (line) line.textContent = progressLine(current);
    }, 500);
    on(drawer, 'input', '[data-progress-current], [data-progress-total]', saveProgress);
    on(drawer, 'change', '[data-progress-unit]', () => { saveProgress(); setTimeout(rerender, 520); });

    /* tags */
    on(drawer, 'click', '[data-add-tag]', (event, el) => {
      const tag = el.dataset.addTag;
      if (!current.tags.includes(tag)) { save({ tags: [...current.tags, tag] }); rerender(); }
    });
    on(drawer, 'click', '[data-remove-tag]', (event, el) => {
      save({ tags: current.tags.filter((t) => t !== el.dataset.removeTag) });
      rerender();
    });
    on(drawer, 'keydown', '[data-tag-input]', (event, el) => {
      if (event.key !== 'Enter' && event.key !== ',') return;
      event.preventDefault();
      const value = el.value.trim().toLowerCase();
      if (value && !current.tags.includes(value)) save({ tags: [...current.tags, value] });
      el.value = '';
      rerender();
      qs('[data-tag-input]', drawer)?.focus();
    });

    /* the notebook — many dated notes rather than one box */
    on(drawer, 'submit', '[data-note-form]', (event, el) => {
      event.preventDefault();
      const field = qs('[data-note-input]', el);
      const text = field.value.trim();
      if (!text) return;
      save({ notes: addNote(current, text) });
      field.value = '';
      rerender();
      ctx.checkAchievements?.();
      toast(TOASTS.noteSaved);
    });
    on(drawer, 'click', '[data-pin-note]', (event, el) => {
      const id = el.dataset.pinNote;
      save({ notes: current.notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)) });
      rerender();
    });
    on(drawer, 'click', '[data-delete-note]', (event, el) => {
      save({ notes: current.notes.filter((n) => n.id !== el.dataset.deleteNote) });
      rerender();
    });

    /* the long-form field still autosaves */
    const saveProse = debounce((field, value) => {
      save({ [field]: value });
      const flag = qs(`[data-saved="${field}"]`, drawer);
      if (flag) { flag.textContent = 'saved'; setTimeout(() => { flag.textContent = ''; }, 1600); }
    }, 600);
    on(drawer, 'input', '[data-field]', (event, el) => saveProse(el.dataset.field, el.value));

    on(drawer, 'click', '[data-edit-book]', () => openEditor());
    on(drawer, 'click', '[data-delete-book]', () => remove());

    /* files */
    /**
     * A cover she chose, made into a cover this library can draw.
     *
     * The order here is the whole safety property: the image is cropped,
     * resampled and re-encoded FIRST, and storage is only touched once
     * there is a finished 600x900 JPEG to put in it. So a picture the
     * browser cannot decode, or one that fails halfway through, leaves
     * the cover she already had exactly where it was — and leaves no
     * half-written original blob behind either, because the original is
     * never written at all.
     */
    on(drawer, 'change', '[data-cover-input]', async (event, el) => {
      const file = el.files?.[0];
      if (!file) return;
      if (file.type && !file.type.startsWith('image/')) {
        toast('That needs to be an image.');
        el.value = '';
        return;
      }

      const drop = el.closest('.filedrop');
      const label = qs('[data-cover-label]', drop ?? drawer);
      const idleText = label?.textContent ?? '';
      const setBusy = (busy) => {
        el.disabled = busy;
        drop?.classList.toggle('is-busy', busy);
        if (label) label.textContent = busy ? 'Preparing your cover…' : idleText;
      };

      setBusy(true);
      try {
        const processed = await processCoverImage(file);
        if (current.coverId) cache.forget(current.coverId);
        await repo.addFile(current.id, processed.file, 'cover');
        current = repo.get(current.id);
        cache.request(current.coverId);
        setBusy(false);
        el.value = '';
        setTimeout(() => rerender(), 140);
        refresh?.();
      } catch (error) {
        setBusy(false);
        el.value = '';
        toast(error?.message ?? 'That image could not be prepared.');
      }
    });

    /**
     * Give a book its original cover back.
     *
     * A custom cover can be referenced from two places — `book.coverId`
     * and a `fileId` on the separate covers override — so both are
     * cleared, each through the API that already owns it. Nothing new is
     * stored and nothing is written by hand.
     *
     * The repository persists in the background and swallows write
     * failures by design, which is right for a library that should keep
     * working when storage misbehaves but wrong for a button that has
     * just promised something. So the result is CHECKED: if a reference
     * or a blob is still there afterwards, this reports a failure rather
     * than a cheerful message over a cover that never went away.
     */
    on(drawer, 'click', '[data-remove-cover]', async (event, el) => {
      const override = repo.getCover?.(current.id);
      const fileIds = [current.coverId, override?.fileId].filter(Boolean);
      if (!fileIds.length) return;

      const label = el.textContent;
      el.disabled = true;
      el.textContent = 'Removing…';

      try {
        if (override?.fileId) repo.clearCover(current.id);
        if (current.coverId) await repo.removeFile(current.id, current.coverId);

        current = repo.get(current.id);
        const stillReferenced = current.coverId || repo.getCover?.(current.id)?.fileId;
        const orphans = [];
        for (const id of fileIds) {
          if (await repo.getFile(id)) orphans.push(id);
        }
        if (stillReferenced || orphans.length) {
          throw new Error('That cover could not be fully removed.');
        }

        for (const id of fileIds) cache.forget(id);
        rerender();
        refresh?.();
        toast('Back to the cover it came with.');
      } catch (error) {
        // Re-read rather than guess: whatever state storage is actually
        // in, the drawer should be showing it.
        current = repo.get(current.id) ?? current;
        el.disabled = false;
        el.textContent = label;
        rerender();
        toast(error?.message ?? 'That cover could not be removed.');
      }
    });

    on(drawer, 'change', '[data-file-input]', async (event, el) => {
      const files = Array.from(el.files ?? []);
      for (const file of files) await repo.addFile(current.id, file, 'attachment');
      current = repo.get(current.id);
      await refreshAttachments();
      toast(`${files.length} ${files.length === 1 ? 'file' : 'files'} tucked in.`);
    });

    /* memories: a photo plus a caption and a date */
    on(drawer, 'change', '[data-memory-input]', async (event, el) => {
      const file = el.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { toast('A memory should be a picture.'); return; }
      const record = await repo.addFile(current.id, file, 'memory');
      save({
        memories: [
          { id: `mem_${record.id}`, fileId: record.id, note: '', takenAt: new Date().toISOString() },
          ...current.memories,
        ],
      });
      rerender();
      ctx.checkAchievements?.();
      toast('Added to the scrapbook.');
    });
    on(drawer, 'input', '[data-memory-note]', debounce((event, el) => {
      const id = el.dataset.memoryNote;
      save({ memories: current.memories.map((m) => (m.id === id ? { ...m, note: el.value } : m)) });
    }, 600));
    on(drawer, 'click', '[data-delete-memory]', async (event, el) => {
      const id = el.dataset.deleteMemory;
      const memory = current.memories.find((m) => m.id === id);
      if (memory?.fileId) await repo.removeFile(current.id, memory.fileId);
      current = repo.get(current.id);
      save({ memories: current.memories.filter((m) => m.id !== id) });
      rerender();
    });

    on(drawer, 'click', '[data-remove-file]', async (event, el) => {
      await repo.removeFile(current.id, el.dataset.removeFile);
      current = repo.get(current.id);
      await refreshAttachments();
    });

    on(drawer, 'click', '[data-open-file]', async (event, el) => {
      const record = await repo.getFile(el.dataset.openFile);
      if (!record?.blob) return;
      const url = URL.createObjectURL(record.blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    });
  }

  /** Attachments and memory photos live in blob storage, so they load late. */
  async function refreshAttachments() {
    for (const url of thumbUrls) URL.revokeObjectURL(url);
    thumbUrls = [];

    const files = await repo.listFiles(current.id);

    const slot = qs('[data-attachments]', drawer);
    if (slot) {
      const plain = files.filter((f) => f.role === 'attachment');
      slot.innerHTML = plain.length
        ? plain.map((file) => {
          let url = '';
          if (file.type.startsWith('image/') && file.blob) {
            url = URL.createObjectURL(file.blob);
            thumbUrls.push(url);
          }
          return attachmentRow(file, url);
        }).join('')
        : '<p class="small mute-2">Nothing attached yet.</p>';
    }

    for (const memory of current.memories) {
      const img = qs(`[data-memory-img="${memory.id}"]`, drawer);
      const file = files.find((f) => f.id === memory.fileId);
      if (img && file?.blob) {
        const url = URL.createObjectURL(file.blob);
        thumbUrls.push(url);
        img.src = url;
      }
    }
  }

  /* ─────────────────────────── sub-dialogs ─────────────────────── */

  function openEditor() {
    openModal({
      title: 'Edit this book',
      body: bookForm(current),
      footer: `
        <button class="btn" type="button" data-cancel>Cancel</button>
        <button class="btn btn--primary" type="button" data-save>Save</button>`,
      onMount(panel, closeModal) {
        qs('[data-cancel]', panel).addEventListener('click', closeModal);
        qs('[data-save]', panel).addEventListener('click', () => {
          const values = readForm(panel);
          if (!values.title) { toast('A book needs a title, at minimum.'); return; }
          // Editing an ambiguous row is exactly how it stops being ambiguous.
          if (current.needsReview && values.title && values.author) values.needsReview = false;
          save(values);
          rerender();
          closeModal();
          toast(TOASTS.updated);
        });
      },
    });
  }

  async function remove() {
    const ok = await confirmDialog({
      title: `Delete ${current.title}?`,
      message: 'This removes the book, its notes, its rating and anything attached to it. You can undo this once, from the message that appears.',
      confirmLabel: 'Delete it',
      cancelLabel: 'Keep it',
    });
    if (!ok) return;

    const snapshot = JSON.parse(JSON.stringify(current));
    await repo.remove(current.id);
    close();
    store.touch('book');
    refresh?.();
    toast(TOASTS.deleted, {
      duration: 9000,
      action: {
        label: 'Undo',
        onClick: () => {
          repo.restore(snapshot);
          store.touch('book');
          refresh?.();
          toast(TOASTS.restored);
        },
      },
    });
  }
}

/* ───────────────────────────── markup ───────────────────────────── */

function template(book, cache) {
  const meta = genreMeta(book.genre);
  const cover = coverMarkup(book, cache);
  const fraction = progressFraction(book);

  /**
   * The id of a picture she uploaded herself, from either of the two
   * places one can live: the book record, or an override in the separate
   * covers store. These are exactly the two `resolveCover` treats as an
   * upload, so the remove action appears precisely when a custom cover
   * is what she is actually looking at — and not for an Open Library
   * photograph, a pasted URL, or the drawn fallback.
   */
  const uploadedCoverId = cache?.forBook?.(book)?.override?.fileId || book.coverId || '';

  return `
  <div class="drawer__head">
    <span class="drawer__grab"></span>
    <button class="icon-btn" type="button" data-close-drawer aria-label="Close">
      <svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
    <div class="drawer__head-actions">
      <button class="icon-btn heart-btn ${book.favourite ? 'is-on' : ''}" type="button" data-fav
              aria-pressed="${book.favourite}" aria-label="Favourite">${HEART}</button>
      <button class="icon-btn" type="button" data-edit-book aria-label="Edit details">
        <svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 20h4l10-10-4-4L4 16zM14 6l4 4"/></svg>
      </button>
      <button class="icon-btn" type="button" data-delete-book aria-label="Delete this book">
        <svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 7h14M10 7V5h4v2M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>
      </button>
    </div>
  </div>

  <div class="drawer__body">
    <div class="detail__hero">
      ${motifFor(book)}
      <div class="detail__cover">
        ${cover}
      </div>
      <div class="detail__intro">
        <h2 class="detail__title">${esc(book.title)}</h2>
        <p class="detail__author">${esc(book.author)}</p>
        <div class="detail__genre-line">
          ${book.genre ? `<span class="chip chip--accent">${meta.icon} ${esc(book.genre)}</span>` : '<span class="chip">Unshelved</span>'}
          ${book.subgenre ? `<span class="chip">${esc(book.subgenre)}</span>` : ''}
          ${book.series ? `<span class="chip">${esc(book.series)}</span>` : ''}
        </div>
        <p class="detail__quip">${esc(meta.quip)}</p>
        <!-- Keyed on the book id, so opening the same book twice says
             two different things — but typing a note does not change it
             underneath her. -->
        <p class="detail__aside">${esc(rotatingLine(BOOK_LINES, 'book', `${SESSION}:${book.id}`))}</p>
      </div>
    </div>

    ${book.needsReview ? `
    <div class="detail__section">
      <div class="review-note">
        <span aria-hidden="true" style="font-size:1.1rem">🔍</span>
        <span><strong>This one needs a look.</strong> The original list was ambiguous about it —
        several different books share the name, or the author was missing. Nothing has been
        guessed. Edit it once you have the copy in hand and the flag clears itself.</span>
      </div>
    </div>` : ''}

    ${book.description ? `
    <div class="detail__section">
      <div class="detail__label">What it is</div>
      <p class="detail__blurb">${esc(book.description)}</p>
    </div>` : ''}

    <div class="detail__section">
      <div class="detail__label">Where you are with it</div>
      <div class="segmented" role="group" aria-label="Reading status">
        ${ALL_STATUSES.map((status) => `
          <button type="button" data-status="${status}" class="${book.status === status ? 'is-on' : ''}"
                  aria-pressed="${book.status === status}">
            <span aria-hidden="true">${STATUS_META[status].icon}</span>${STATUS_META[status].short}
          </button>`).join('')}
      </div>

      <div class="progress">
        <div class="progress__track">
          <div class="progress__bar" data-progress-bar style="width:${Math.round((fraction ?? 0) * 100)}%"></div>
        </div>
        <div class="progress__row">
          <input class="input input--tiny" type="number" min="0" inputmode="numeric"
                 data-progress-current value="${book.progress.current || ''}"
                 aria-label="Current ${book.progress.unit}" placeholder="0">
          <span class="progress__of">of</span>
          <input class="input input--tiny" type="number" min="0" inputmode="numeric"
                 data-progress-total value="${book.progress.total || ''}"
                 aria-label="Total pages" placeholder="—"
                 ${book.progress.unit === 'percent' ? 'disabled' : ''}>
          <select class="select select--tiny" data-progress-unit aria-label="Progress unit">
            <option value="page" ${book.progress.unit === 'page' ? 'selected' : ''}>pages</option>
            <option value="percent" ${book.progress.unit === 'percent' ? 'selected' : ''}>percent</option>
          </select>
          <span class="progress__pct">${fraction === null ? '' : `${Math.round(fraction * 100)}%`}</span>
        </div>
        <p class="progress__line" data-progress-line>${esc(progressLine(book))}</p>
      </div>

      ${book.startedAt || book.finishedAt ? `
        <p class="tiny mute-2" style="margin-top:var(--sp-3)">
          ${book.startedAt ? `Started ${esc(formatDate(book.startedAt))}. ` : ''}
          ${book.finishedAt ? `Finished ${esc(formatDate(book.finishedAt))}.` : ''}
        </p>` : ''}
    </div>

    <div class="detail__section">
      <div class="detail__label">What you thought of it</div>
      <div class="detail__rating-row">
        <div class="stars" role="group" aria-label="Rating">
          ${[1, 2, 3, 4, 5].map((n) => `
            <button type="button" data-star="${n}" class="${book.rating >= n ? 'is-on' : ''}"
                    aria-label="${n} ${n === 1 ? 'star' : 'stars'}" aria-pressed="${book.rating >= n}">${STAR}</button>`).join('')}
        </div>
        <span class="detail__rating-word">${esc(RATING_WORDS[book.rating])}</span>
      </div>
    </div>

    <div class="detail__section">
      <div class="detail__label">Tags</div>
      <div class="tag-row" style="margin-bottom:var(--sp-3)">
        ${book.tags.map((tag) => `
          <span class="chip chip--accent">${esc(tag)}
            <button class="chip__x" type="button" data-remove-tag="${esc(tag)}" aria-label="Remove tag ${esc(tag)}">&times;</button>
          </span>`).join('') || '<span class="small mute-2">No tags yet.</span>'}
      </div>
      <input class="input" type="text" data-tag-input placeholder="Add a tag and press Enter" aria-label="Add a tag">
      <div class="tag-row" style="margin-top:var(--sp-3)">
        ${SUGGESTED_TAGS.filter((t) => !book.tags.includes(t)).slice(0, 5)
    .map((tag) => `<button class="chip" type="button" data-add-tag="${esc(tag)}">+ ${esc(tag)}</button>`).join('')}
      </div>
    </div>

    ${notebook(book)}

    <div class="detail__section">
      <div class="detail__label">Thoughts <span class="tiny mute-2" data-saved="thoughts"></span></div>
      <textarea class="textarea textarea--tall" data-field="thoughts"
        placeholder="The long version. What it made you think about, who it reminded you of, whether you forgive the ending.">${esc(book.thoughts)}</textarea>
    </div>

    ${memories(book)}

    <div class="detail__section">
      <div class="detail__label">Attached</div>
      <div class="attachments" data-attachments></div>
      <label class="filedrop" style="margin-top:var(--sp-3)">
        <input type="file" multiple hidden data-file-input>
        <span>Attach a PDF, an EPUB, a text file, a screenshot</span>
        <span class="tiny mute-2">Stored on this device only. Only upload files you already have the right to keep.</span>
      </label>
      <label class="filedrop" style="margin-top:var(--sp-2)">
        <input type="file" accept="image/*" hidden data-cover-input>
        <span data-cover-label>${uploadedCoverId ? 'Replace the cover image' : 'Use your own cover image'}</span>
        <span class="tiny mute-2">Cropped to fit the shelf automatically</span>
      </label>
      ${uploadedCoverId ? `
      <div class="cover-undo">
        <button class="btn btn--ghost btn--sm" type="button" data-remove-cover>Remove custom cover</button>
      </div>` : ''}
    </div>

    <div class="detail__section" style="display:flex;justify-content:space-between;align-items:center;gap:var(--sp-3);flex-wrap:wrap">
      <span class="tiny mute-2">Added ${esc(formatDate(book.addedAt))}</span>
    </div>
  </div>`;
}

/** Many dated notes, newest first, pinned ones on top. */
function notebook(book) {
  const sorted = [...book.notes].sort((a, b) => (b.pinned - a.pinned)
    || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  return `
  <div class="detail__section">
    <div class="detail__label">Notes <span class="tiny mute-2">${book.notes.length || ''}</span></div>
    <form class="note-new" data-note-form>
      <textarea class="textarea note-new__field" data-note-input rows="2"
        placeholder="A quote, a page number, the character you are annoyed by…"></textarea>
      <button class="btn btn--primary btn--sm" type="submit">Add</button>
    </form>
    ${sorted.length ? `
    <ul class="notes">
      ${sorted.map((note) => `
        <li class="note ${note.pinned ? 'is-pinned' : ''}">
          <p class="note__text">${esc(note.text)}</p>
          <div class="note__foot">
            <span class="note__date">${esc(formatDate(note.createdAt))}</span>
            <button class="note__act" type="button" data-pin-note="${esc(note.id)}"
                    aria-pressed="${note.pinned}">${note.pinned ? '★ pinned' : '☆ pin'}</button>
            <button class="note__act" type="button" data-delete-note="${esc(note.id)}">delete</button>
          </div>
        </li>`).join('')}
    </ul>` : '<p class="small mute-2" style="margin-top:var(--sp-3)">Nothing written yet.</p>'}
  </div>`;
}

/** The scrapbook: photos with a caption and a date. */
function memories(book) {
  return `
  <div class="detail__section">
    <div class="detail__label">Memories</div>
    ${book.memories.length ? `
    <div class="memories">
      ${book.memories.map((m) => `
        <figure class="memory">
          <img class="memory__img" data-memory-img="${esc(m.id)}" alt="" />
          <figcaption class="memory__cap">
            <input class="memory__note" data-memory-note="${esc(m.id)}" value="${esc(m.note)}"
                   placeholder="Where were you?" aria-label="Caption">
            <span class="memory__date">${esc(formatDate(m.takenAt))}</span>
          </figcaption>
          <button class="memory__x" type="button" data-delete-memory="${esc(m.id)}" aria-label="Remove this memory">&times;</button>
        </figure>`).join('')}
    </div>` : ''}
    <label class="filedrop filedrop--memory" style="margin-top:${book.memories.length ? 'var(--sp-3)' : '0'}">
      <input type="file" accept="image/*" hidden data-memory-input>
      <span>📸 Add a photo from while you were reading it</span>
      <span class="tiny mute-2">The cafe, the train, the page you had to photograph</span>
    </label>
  </div>`;
}

function attachmentRow(file, thumbUrl) {
  const thumb = thumbUrl
    ? `<img class="attachment__thumb" alt="" src="${esc(thumbUrl)}">`
    : `<span class="attachment__thumb attachment__thumb--icon">
         <svg viewBox="0 0 24 24" width="18" height="18"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5"/></svg>
       </span>`;
  return `
  <div class="attachment">
    ${thumb}
    <button class="attachment__name" type="button" data-open-file="${esc(file.id)}" style="text-align:left">${esc(file.name)}</button>
    <span class="attachment__size">${esc(formatBytes(file.size))}</span>
    <button class="icon-btn" type="button" data-remove-file="${esc(file.id)}" aria-label="Remove ${esc(file.name)}">
      <svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
  </div>`;
}

/* ───────────────────── shared add/edit form ───────────────────── */

export function bookForm(book = {}) {
  return `
  <div class="field">
    <label class="field__label" for="f-title">Title</label>
    <input class="input" id="f-title" data-f="title" value="${esc(book.title ?? '')}" placeholder="What is it called?">
  </div>
  <div class="field-row">
    <div class="field">
      <label class="field__label" for="f-author">Author</label>
      <input class="input" id="f-author" data-f="author" value="${esc(book.author === 'Author unknown' ? '' : (book.author ?? ''))}" placeholder="Who wrote it?">
    </div>
    <div class="field">
      <label class="field__label" for="f-genre">Genre</label>
      <input class="input" id="f-genre" data-f="genre" list="genre-list" value="${esc(book.genre ?? '')}" placeholder="Optional">
      <datalist id="genre-list">${GENRE_NAMES.map((g) => `<option value="${esc(g)}"></option>`).join('')}</datalist>
    </div>
  </div>
  <div class="field-row">
    <div class="field">
      <label class="field__label" for="f-subgenre">Subgenre <span class="field__hint">optional</span></label>
      <input class="input" id="f-subgenre" data-f="subgenre" value="${esc(book.subgenre ?? '')}" placeholder="Dark academia, cosy crime…">
    </div>
    <div class="field">
      <label class="field__label" for="f-series">Series <span class="field__hint">optional</span></label>
      <input class="input" id="f-series" data-f="series" value="${esc(book.series ?? '')}" placeholder="Part of something bigger?">
    </div>
  </div>
  <div class="field-row">
    <div class="field">
      <label class="field__label" for="f-status">Shelf</label>
      <select class="select" id="f-status" data-f="status">
        ${ALL_STATUSES.map((s) => `<option value="${s}" ${book.status === s ? 'selected' : ''}>${STATUS_META[s].label}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label class="field__label" for="f-rating">Rating</label>
      <select class="select" id="f-rating" data-f="rating">
        <option value="0">Not rated</option>
        ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${Number(book.rating) === n ? 'selected' : ''}>${'★'.repeat(n)}</option>`).join('')}
      </select>
    </div>
  </div>
  <div class="field">
    <label class="field__label" for="f-cover">Cover image URL <span class="field__hint">optional</span></label>
    <input class="input" id="f-cover" data-f="coverUrl" value="${esc(book.coverUrl ?? '')}" placeholder="https://…">
    <span class="field__hint">Leave blank for a generated cover. You can also upload one from the book page.</span>
  </div>
  <div class="field">
    <label class="field__label" for="f-desc">Description <span class="field__hint">optional</span></label>
    <textarea class="textarea" id="f-desc" data-f="description" placeholder="What it is about, in your words.">${esc(book.description ?? '')}</textarea>
  </div>
  <div class="field">
    <label class="switch" style="border:none;padding:0">
      <span class="switch__text">
        <span class="switch__title">Favourite</span>
        <span class="switch__desc">One of the ones you would rescue from a flood.</span>
      </span>
      <input type="checkbox" data-f="favourite" ${book.favourite ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--accent)">
    </label>
  </div>`;
}

export function readForm(panel) {
  const values = {};
  for (const input of qsa('[data-f]', panel)) {
    const key = input.dataset.f;
    if (input.type === 'checkbox') values[key] = input.checked;
    else if (key === 'rating') values[key] = Number(input.value);
    else values[key] = input.value.trim();
  }
  values.genre = normalizeGenre(values.genre) || values.genre;
  return values;
}
