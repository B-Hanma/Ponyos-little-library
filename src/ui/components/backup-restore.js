/**
 * backup-restore.js — the door to the .ponyolib engine.
 *
 * The engine in storage/backup.js is deliberately ignorant of the DOM:
 * it builds archives, validates them, plans a restore and applies one.
 * This file is the only thing that turns those into buttons, and it adds
 * no rules of its own — the plan she approves here is the plan that runs.
 *
 * ── THREE PROMISES THIS UI HAS TO KEEP ────────────────────────────
 *
 * 1. Nothing is ever vague about destruction. There is no "Sync" and no
 *    "Combine". There is Merge, which can overwrite edits she made after
 *    the backup was taken, and Replace, which removes books the backup
 *    has never heard of. Both say so in words before she commits, and
 *    Replace asks a second time.
 *
 * 2. Progress is never invented. Every stage below corresponds to a real
 *    awaited operation — a real read, a real checksum pass, a real
 *    snapshot, a real write. Nothing animates to look busy.
 *
 * 3. A failure always says what happened to her library. "Nothing was
 *    changed" and "this stopped halfway" are completely different
 *    sentences and she is entitled to the right one.
 */

import { esc, qs, qsa } from '../../utils/dom.js';
import { openModal, confirmDialog, toast } from './overlays.js';
import {
  buildBackup, verifyBackup, readBackup, planRestore, applyRestore,
  formatBytes, BACKUP_EXTENSION,
} from '../../storage/backup.js';

/* ───────────────────────────── the card ─────────────────────────── */

/**
 * The Settings card. Reuses the page's existing furniture — a `.card`
 * with a `.section__title`, `.seg-choice` for the buttons — so it reads
 * as part of the page rather than as something bolted on.
 */
export function backupCard() {
  return `
  <section class="card" style="grid-column:1/-1">
    <h3 class="section__title">Backup and restore
      <span class="section__note">one file, everything in it</span>
    </h3>

    <p class="muted small" style="margin-bottom:var(--sp-4)">
      Your library is stored locally in this browser. A .ponyolib backup contains your books,
      settings, custom covers, photos and attachments.
    </p>

    <div class="seg-choice">
      <button class="btn btn--primary" type="button" data-action="backup">Back up the whole library</button>
      <button class="btn" type="button" data-action="restore">Restore from a backup</button>
    </div>

    <p class="tiny mute-2" style="margin-top:var(--sp-4)">
      Keep the file somewhere you will still have it later — another drive, or a folder that syncs
      itself. Nothing is uploaded anywhere from here, and nothing is backed up on its own.
    </p>

    <details style="margin-top:var(--sp-4)">
      <summary class="tiny mute-2" style="cursor:pointer">Just the book list, as text</summary>
      <p class="tiny mute-2" style="margin:var(--sp-3) 0">
        A .json list of titles, authors, shelves, ratings and notes, readable in any text editor.
        Useful for looking at or moving elsewhere — but it cannot hold your covers, photos or
        attachments, so it is not a backup.
      </p>
      <button class="btn btn--sm" type="button" data-action="export">Download the book list (.json)</button>
    </details>
  </section>`;
}

/* ─────────────────────── the progress dialog ────────────────────── */

const BACKUP_STAGES = [
  { id: 'reading', label: 'Reading your library' },
  { id: 'writing', label: 'Writing the archive' },
  { id: 'verifying', label: 'Opening it again to check it' },
  { id: 'complete', label: 'Done' },
];

const CHECK_STAGES = [
  { id: 'reading', label: 'Reading the file' },
  { id: 'validating', label: 'Checking every byte against its checksum' },
  { id: 'planning', label: 'Working out what would change' },
];

const APPLY_STAGES = [
  { id: 'snapshotting', label: 'Saving a copy of your library as it is now' },
  { id: 'applying', label: 'Restoring from the backup' },
  { id: 'verifying', label: 'Checking the result' },
  { id: 'complete', label: 'Done' },
];

function stageRows(stages, activeIndex, failedIndex = -1) {
  return stages.map((stage, i) => {
    let state = 'is-waiting';
    let mark = '';
    if (failedIndex === i) { state = 'is-failed'; mark = '✕'; }
    else if (i < activeIndex) { state = 'is-done'; mark = '✓'; }
    else if (i === activeIndex) { state = 'is-active'; mark = ''; }
    return `
      <li class="progress-step ${state}">
        <span class="progress-step__mark" aria-hidden="true">${mark}</span>
        <span class="progress-step__label">${esc(stage.label)}</span>
      </li>`;
  }).join('');
}

/**
 * A modal that reports real progress and can end in a result or an error.
 *
 * ── WHY THIS ONE DIALOG REFUSES TO CLOSE ──────────────────────────
 * Every other dialog in the app can be waved away with Escape or a
 * click outside, and that is right for all of them. It is wrong here.
 * Dismissing this one does not stop the backup or the restore — the
 * work carries on regardless — so an accidental Escape would hide a
 * live operation and leave her with no idea whether her library was
 * mid-restore. The honest options were to abort the work, which is
 * unsafe partway through a restore, or to keep the report on screen
 * until there is something true to report. This does the second.
 *
 * So it opens with `dismissible: false`, which withholds Escape, the
 * scrim, the backdrop and the header close button, and calls
 * `setDismissible(true)` the instant it reaches a terminal state. There
 * is deliberately no Cancel button, because nothing here can honestly
 * be cancelled.
 *
 * The `isConnected` guards below are kept anyway: `close()` is still
 * available programmatically, and a guard that costs nothing is better
 * than an exception thrown into a promise nobody is awaiting.
 */
function openProgress({ title, subtitle = '', stages }) {
  let panel = null;
  let close = () => {};
  let index = 0;

  const handle = openModal({
    title,
    subtitle,
    size: 'sm',
    // Held shut until the operation finishes or fails.
    dismissible: false,
    body: `
      <ol class="progress-steps" data-stages>${stageRows(stages, 0)}</ol>
      <div data-result></div>`,
    footer: `<button class="btn" type="button" data-close disabled>Close</button>`,
    onMount(p, c) { panel = p; close = c; },
  });

  const live = () => Boolean(panel?.isConnected);

  function redraw(failedIndex = -1) {
    if (!live()) return;
    const list = qs('[data-stages]', panel);
    if (list) list.innerHTML = stageRows(stages, index, failedIndex);
  }

  return {
    get open() { return live(); },

    /** Advance to a named stage. Unknown names are ignored, never faked. */
    mark(id) {
      const at = stages.findIndex((s) => s.id === id);
      if (at < 0 || at < index) return;
      index = at;
      redraw();
    },

    /** Finish successfully: show the result, hand the exits back. */
    finish({ html, footer }) {
      index = stages.length;
      redraw();
      // Terminal state: Escape, the scrim and the close button all work
      // again, because now there is nothing left to interrupt.
      handle.setDismissible(true);
      if (!live()) return;
      const slot = qs('[data-result]', panel);
      if (slot) slot.innerHTML = html;
      const foot = qs('.modal__foot', panel);
      if (foot) {
        foot.innerHTML = footer
          ?? '<button class="btn btn--primary" type="button" data-dismiss>Close</button>';
        qsa('[data-dismiss]', foot).forEach((b) => b.addEventListener('click', close));
      }
      return panel;
    },

    /** Finish badly. `note` is the sentence about her library's state. */
    fail(error, { note = '', extra = '' } = {}) {
      redraw(index);
      // A failure is terminal too, and she must be able to get out of it.
      handle.setDismissible(true);
      if (!live()) {
        toast(error?.message ?? 'That did not work.');
        return null;
      }
      const slot = qs('[data-result]', panel);
      if (slot) {
        slot.innerHTML = `
          <div class="notice notice--bad">
            <p class="notice__title">${esc(error?.message ?? 'That did not work.')}</p>
            ${error?.hint ? `<p class="notice__body">${esc(error.hint)}</p>` : ''}
            ${note ? `<p class="notice__body"><strong>${esc(note)}</strong></p>` : ''}
          </div>
          ${extra}`;
      }
      const foot = qs('.modal__foot', panel);
      if (foot) {
        foot.innerHTML = '<button class="btn btn--primary" type="button" data-dismiss>Close</button>';
        qsa('[data-dismiss]', foot).forEach((b) => b.addEventListener('click', close));
      }
      return panel;
    },

    close() { close(); },
    get panel() { return panel; },
  };
}

/* ───────────────────────────── helpers ─────────────────────────── */

/** Hand the blob over as a download. Called only once it is verified. */
function offerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.click();
  // Long enough for the browser to have taken it, short enough to free.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * Ask for a file without leaving an input in the DOM.
 *
 * Resolves with null when she cancels. There is no reliable cancel event
 * on a file input, so `cancel` is used where it exists and the promise is
 * simply left unresolved-but-harmless otherwise: nothing downstream runs
 * until a file actually arrives.
 */
function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.hidden = true;
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };
    input.addEventListener('change', () => done(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => done(null));
    document.body.append(input);
    input.click();
  });
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function when(iso) {
  if (!iso) return 'an unknown date';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'an unknown date';
  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** One row of the plan, in the same shape as the shelf tally. */
function row(value, label, note) {
  return `
  <div class="tally__row">
    <span class="tally__num">${value}</span>
    <span class="tally__body">
      <span class="tally__label">${esc(label)}</span>
      <span class="tally__note">${esc(note)}</span>
    </span>
  </div>`;
}

/* ═════════════════════════════ backup ════════════════════════════ */

/**
 * Build a backup and hand it over.
 *
 * The archive is verified by the engine before `buildBackup` returns, and
 * only then does the download happen — so she is never given a file that
 * has not already been opened and checked.
 */
export async function runBackup(ctx) {
  const ui = openProgress({
    title: 'Backing up your library',
    subtitle: 'This stays on your computer.',
    stages: BACKUP_STAGES,
  });

  try {
    const result = await buildBackup(ctx.repo, {
      onProgress: (stage) => ui.mark(stage === 'done' ? 'complete' : stage),
    });

    ui.mark('complete');
    offerDownload(result.blob, result.filename);

    const counts = result.manifest.counts ?? {};
    ui.finish({
      html: `
        <div class="notice notice--good">
          <p class="notice__title">Backup complete.</p>
          <p class="notice__body">Saved as <code>${esc(result.filename)}</code>. If your browser asked
          where to put it, it is wherever you chose; otherwise look in Downloads.</p>
        </div>
        <div class="tally" style="margin-top:var(--sp-4)">
          ${row(counts.books ?? 0, 'Books', 'every shelf, rating, note, tag and date')}
          ${row(counts.files ?? 0, 'Files', counts.files
    ? `covers, photos and attachments — ${formatBytes(counts.bytes)}`
    : 'nothing uploaded yet, so there was nothing to carry')}
          ${row(counts.settings ?? 0, 'Preferences', 'how the library looks and reads')}
          ${row(counts.covers ?? 0, 'Replaced covers', 'pictures you chose yourself')}
        </div>
        <p class="tiny mute-2" style="margin-top:var(--sp-4)">
          Archive size ${esc(formatBytes(result.blob.size))}. It is a ZIP: rename it to .zip and you
          can look inside.
        </p>`,
    });
  } catch (error) {
    // Nothing was written to her library by a backup, whatever happened.
    ui.fail(error, { note: 'Your library was not changed.' });
  }
}

/** The legacy metadata-only export. Kept, but never called the backup. */
export function runLegacyExport(ctx) {
  try {
    const data = ctx.repo.exportJSON();
    const stamp = new Date().toISOString().slice(0, 10);
    offerDownload(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      `ponyo-library-${stamp}.json`,
    );
    toast(`${plural(data.books.length, 'book')} written to a .json list. Covers and attachments are not in it.`);
  } catch (error) {
    toast(error?.message ?? 'That list could not be written.');
  }
}

/* ════════════════════════════ restore ═══════════════════════════ */

/**
 * The whole restore journey: pick, check, preview, choose, confirm, apply.
 *
 * Validation happens before the library is touched, and the plan is built
 * before anything is applied — so every number she is shown was computed
 * against her real library, and cancelling at any point up to the final
 * button leaves it exactly as it was.
 */
export async function runRestore(ctx) {
  const file = await pickFile(`${BACKUP_EXTENSION},.zip,application/zip`);
  // A cancelled picker does nothing at all — no dialog, no toast.
  if (!file) return;

  const ui = openProgress({
    title: 'Checking the backup',
    subtitle: file.name,
    stages: CHECK_STAGES,
  });

  let payload;
  let plan;
  try {
    // Two real passes: a structural read that rejects the wrong kind of
    // file almost immediately, then the deep one that checksums every
    // byte and pulls the images out.
    ui.mark('reading');
    await verifyBackup(file, { deep: false });

    ui.mark('validating');
    payload = await readBackup(file, { deep: true });

    ui.mark('planning');
    plan = planRestore(ctx.repo, payload, 'merge');
  } catch (error) {
    ui.fail(error, { note: 'Your library was not touched.' });
    return;
  }

  ui.close();
  openPreview(ctx, payload, plan);
}

/** What each mode will actually do, in plain sentences. */
function consequences(mode, plan, libraryCount) {
  if (mode === 'replace') {
    return `
    <div class="notice notice--warn">
      <p class="notice__title">Replace puts the library back exactly as the backup has it.</p>
      <p class="notice__body">
        ${plan.removedBooks.length
    ? `<strong>${plural(plan.removedBooks.length, 'book')}</strong> currently on your shelves ${plan.removedBooks.length === 1 ? 'is' : 'are'} not in this backup, and will be removed along with anything attached to ${plan.removedBooks.length === 1 ? 'it' : 'them'}.`
    : 'Every book you have now is also in the backup, so nothing will be removed.'}
      </p>
      <p class="notice__body">
        A complete copy of your library as it stands right now is saved and checked first, and you
        can download it on the next screen. If the copy cannot be made, the restore is abandoned
        and nothing changes.
      </p>
    </div>`;
  }
  return `
  <div class="notice notice--warn">
    <p class="notice__title">Merge restores the books in the backup and leaves everything else alone.</p>
    <p class="notice__body">
      ${plan.updatedBooks.length
    ? `<strong>${plural(plan.updatedBooks.length, 'book')}</strong> will be set back to how the backup has ${plan.updatedBooks.length === 1 ? 'it' : 'them'}. If you have changed ${plan.updatedBooks.length === 1 ? 'that book' : 'any of those books'} since ${when(plan.createdAt)}, those later changes are lost.`
    : 'No book on your shelves differs from the backup, so nothing will be overwritten.'}
    </p>
    <p class="notice__body">
      Books you have that the backup does not will stay exactly where they are.
      ${libraryCount ? `You have ${plural(libraryCount, 'book')} right now.` : ''}
    </p>
  </div>`;
}

/** The plan, as a tally she can read before agreeing to it. */
function planTally(plan, mode) {
  const files = plan.filesAdded.length + plan.filesReplaced.length + plan.filesUnchanged.length;
  return `
  <div class="tally">
    ${row(plan.newBooks.length, 'Books to add', plan.newBooks.length
    ? 'in the backup, not on your shelves'
    : 'nothing in the backup is new to you')}
    ${row(plan.updatedBooks.length, 'Books to update', plan.updatedBooks.length
    ? 'matched by title and author; the backup’s version wins'
    : 'no differences found')}
    ${row(plan.unchangedBooks, 'Books unchanged', 'already identical to the backup')}
    ${mode === 'replace'
    ? row(plan.removedBooks.length, 'Books to remove', plan.removedBooks.length
      ? 'on your shelves but not in this backup'
      : 'nothing would be removed')
    : ''}
    ${row(plan.filesAdded.length, 'Covers and files to add', files
    ? 'uploaded covers, photographs and attachments'
    : 'the backup holds no uploaded files')}
    ${row(plan.filesReplaced.length, 'Covers to replace', plan.filesReplaced.length
    ? `a picture you can see will change: ${plan.filesReplaced.map((f) => f.book).filter(Boolean).join(', ')}`
    : 'no picture you can see will change')}
    ${row(plan.filesUnchanged.length, 'Files unchanged', 'already here, byte for byte')}
    ${row(plan.settingsChanged.length + plan.settingsAdded.length, 'Preference changes',
    plan.settingsChanged.length || plan.settingsAdded.length
      ? plan.settingsChanged.concat(plan.settingsAdded).map((s) => s.key).join(', ')
      : 'nothing about how the library looks will move')}
  </div>`;
}

function previewBody(ctx, plan, mode, manifest) {
  const count = ctx.repo.count();
  return `
  <p class="muted small" style="margin-bottom:var(--sp-4)">
    Taken on <strong>${esc(when(manifest.createdAt))}</strong> ·
    format ${esc(String(manifest.version))} ·
    ${esc(plural(manifest.counts?.books ?? 0, 'book'))} and
    ${esc(plural(manifest.counts?.files ?? 0, 'file'))} inside.
    Nothing has been changed yet.
  </p>

  <div class="field">
    <span class="field__label">How should this be restored?</span>
    <div class="seg-choice" role="radiogroup" aria-label="Restore mode">
      <button class="pill ${mode === 'merge' ? 'is-active' : ''}" type="button"
              data-mode="merge" role="radio" aria-checked="${mode === 'merge'}">Merge</button>
      <button class="pill ${mode === 'replace' ? 'is-active' : ''}" type="button"
              data-mode="replace" role="radio" aria-checked="${mode === 'replace'}">Replace</button>
    </div>
  </div>

  <div data-consequences>${consequences(mode, plan, count)}</div>

  <h4 class="field__label" style="margin-top:var(--sp-5)">What will change</h4>
  <div data-plan>${planTally(plan, mode)}</div>

  ${plan.warnings.length ? `
    <div class="notice notice--warn" style="margin-top:var(--sp-4)">
      <p class="notice__title">Worth knowing</p>
      ${plan.warnings.slice(0, 4).map((w) => `<p class="notice__body">${esc(w)}</p>`).join('')}
    </div>` : ''}`;
}

function openPreview(ctx, payload, initialPlan) {
  let mode = 'merge';
  let plan = initialPlan;

  openModal({
    title: 'Restore from this backup',
    subtitle: 'Check what would change before anything happens.',
    body: previewBody(ctx, plan, mode, payload.manifest),
    footer: `
      <button class="btn" type="button" data-close>Cancel</button>
      <button class="btn btn--primary" type="button" data-go>Restore and merge</button>`,
    onMount(panel, close) {
      const action = qs('[data-go]', panel);

      const repaint = () => {
        // The plan is recomputed from her real library for the chosen
        // mode, so the tally is never a guess about what the other mode
        // would have done.
        plan = planRestore(ctx.repo, payload, mode);
        qs('[data-consequences]', panel).innerHTML = consequences(mode, plan, ctx.repo.count());
        qs('[data-plan]', panel).innerHTML = planTally(plan, mode);
        qsa('[data-mode]', panel).forEach((btn) => {
          const on = btn.dataset.mode === mode;
          btn.classList.toggle('is-active', on);
          btn.setAttribute('aria-checked', String(on));
        });
        action.textContent = mode === 'replace' ? 'Replace the library…' : 'Restore and merge';
        action.classList.toggle('btn--danger', mode === 'replace');
        action.classList.toggle('btn--primary', mode !== 'replace');
        action.disabled = plan.isNoop && mode === 'merge';
        action.title = action.disabled ? 'This backup matches your library exactly.' : '';
      };

      qsa('[data-mode]', panel).forEach((btn) => {
        btn.addEventListener('click', () => {
          if (btn.dataset.mode === mode) return;
          mode = btn.dataset.mode;
          repaint();
        });
      });

      repaint();

      action.addEventListener('click', async () => {
        if (mode === 'replace') {
          // The deliberate second step. Nothing has happened yet.
          const sure = await confirmDialog({
            title: 'Replace the whole library?',
            message: plan.removedBooks.length
              ? `${plural(plan.removedBooks.length, 'book')} that ${plan.removedBooks.length === 1 ? 'is' : 'are'} not in this backup will be removed, along with anything attached. A complete, verified copy of your library as it is right now is saved first, and you can download it immediately afterwards to undo this.`
              : 'Your library will be set back to exactly what this backup holds. A complete, verified copy of your library as it is right now is saved first, and you can download it immediately afterwards to undo this.',
            confirmLabel: 'Replace it',
            cancelLabel: 'Cancel',
            danger: true,
          });
          if (!sure) return;
        }
        close();
        await applyPlan(ctx, payload, plan);
      });
    },
  });
}

/**
 * Run the restore, then check the result rather than assuming it.
 *
 * The verification stage is a real one: the book count is compared with
 * what the plan predicted, and every file the archive carried is fetched
 * back out of storage. If either disagrees she is told, because a restore
 * that silently half-worked is worse than one that failed.
 */
async function applyPlan(ctx, payload, plan) {
  const before = ctx.repo.count();
  const ui = openProgress({
    title: plan.mode === 'replace' ? 'Replacing your library' : 'Restoring your library',
    subtitle: 'Please leave this open until it finishes.',
    stages: APPLY_STAGES,
  });

  try {
    const result = await applyRestore(ctx.repo, payload, plan, {
      onProgress: (stage) => {
        if (stage === 'snapshot') ui.mark('snapshotting');
        else if (stage === 'applying') ui.mark('applying');
      },
    });

    ui.mark('verifying');
    const expected = plan.mode === 'replace'
      ? plan.newBooks.length
      : before + plan.newBooks.length;
    const problems = [];
    if (ctx.repo.count() !== expected) {
      problems.push(`The library holds ${ctx.repo.count()} books; the plan expected ${expected}.`);
    }
    for (const entry of payload.files) {
      const stored = await ctx.repo.getFile(entry.id);
      if (!stored?.blob) problems.push(`"${entry.name}" did not arrive in storage.`);
    }

    ui.mark('complete');

    // Preferences, mood and the shelves all re-read from storage, so the
    // app matches what is now saved without needing a reload.
    ctx.reloadPreferences?.();
    ctx.store.touch('book');
    ctx.checkAchievements?.({ silent: true });

    const snapshotButton = result.snapshot?.blob
      ? '<button class="btn" type="button" data-snapshot>Save the copy from before</button>'
      : '';

    const panel = ui.finish({
      html: `
        <div class="notice notice--${problems.length ? 'warn' : 'good'}">
          <p class="notice__title">${problems.length
    ? 'Restored, but something does not add up.'
    : plan.mode === 'replace' ? 'Your library has been replaced.' : 'Your library has been restored.'}</p>
          <p class="notice__body">
            ${esc(plural(ctx.repo.count(), 'book'))} on the shelves${plan.newBooks.length
    ? `, ${esc(plural(plan.newBooks.length, 'of them new'))}` : ''}.
            ${plan.updatedBooks.length ? `${esc(plural(plan.updatedBooks.length, 'book'))} updated.` : ''}
            ${payload.files.length ? `${esc(plural(payload.files.length, 'file'))} in place.` : ''}
          </p>
          ${problems.map((p) => `<p class="notice__body">${esc(p)}</p>`).join('')}
        </div>
        <p class="tiny mute-2" style="margin-top:var(--sp-4)">
          A complete copy of your library from just before this restore was saved and checked.
          Keep it until you are happy with the result.
        </p>`,
      footer: `
        ${snapshotButton}
        <button class="btn btn--primary" type="button" data-dismiss>Done</button>`,
    });

    if (panel) {
      qsa('[data-dismiss]', panel).forEach((b) => b.addEventListener('click', () => ui.close()));
      qs('[data-snapshot]', panel)?.addEventListener('click', () => {
        offerDownload(result.snapshot.blob, result.snapshot.filename);
        toast('The copy from before the restore was downloaded.');
      });
    }
  } catch (error) {
    // The engine distinguishes these two, and so must she: a snapshot
    // failure means nothing was touched, while a partial failure means
    // the library moved and the safety copy is the way back.
    const note = error?.partial
      ? 'Your library may be partly restored. Save the copy from before and check it.'
      : 'Your library was not changed.';

    const panel = ui.fail(error, {
      note,
      extra: error?.snapshot?.blob
        ? '<p class="small" style="margin-top:var(--sp-3)"><button class="btn btn--danger" type="button" data-snapshot>Save the copy from before</button></p>'
        : '',
    });

    if (panel) {
      qs('[data-snapshot]', panel)?.addEventListener('click', () => {
        offerDownload(error.snapshot.blob, error.snapshot.filename);
        toast('The copy from before the restore was downloaded.');
      });
    }

    // Whatever happened, the shelves should show what is actually there.
    ctx.store.touch('book');
  }
}
