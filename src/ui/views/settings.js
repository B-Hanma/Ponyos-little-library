/**
 * settings.js (view) — how the library looks, and what happens to her data.
 *
 * Kept deliberately short. Four appearance choices, three switches, and
 * the data tools. Anything that destroys something asks first.
 */

import { qs, esc } from '../../utils/dom.js';
import {
  THEMES, APPEARANCES, themesOfScheme, systemScheme,
} from '../../theme/theme-manager.js';
import { computeStats } from '../../analytics/stats.js';
import { ACHIEVEMENTS, earned } from '../../analytics/achievements.js';
import { COVER_COUNT } from '../../data/covers.js';
import { resolveCover, COVER_STATUS } from '../../data/cover-policy.js';
import { backupCard } from '../components/backup-restore.js';

export function renderSettings(ctx) {
  const { repo, store } = ctx;
  const prefs = store.state.prefs;
  const books = repo.all();
  const stats = computeStats(books);
  const gotAchievements = earned(books);
  const appearance = prefs.appearance ?? 'system';
  const needsReview = books.filter((b) => b.needsReview).length;

  // Cover numbers come from the policy, not from poking at fields, so
  // this panel can never disagree with what the shelves actually draw.
  const realCovers = books.filter(
    (b) => resolveCover(b, ctx.cache?.forBook?.(b)).status === COVER_STATUS.REAL,
  ).length;
  const fallbackCovers = books.length - realCovers;

  // Where the collection came from, as arithmetic she can check.
  const fromSeries = books.filter((b) => b.series).length;
  const addedByHand = books.filter((b) => !b.seeded).length;

  return `
  <div class="page-head">
    <p class="eyebrow">Yours</p>
    <h1 class="page-head__title">Make it feel right</h1>
    <p class="page-head__sub">Nothing here leaves this device. Change anything; nothing is precious.</p>
  </div>

  <div class="dna-grid">
    <section class="card">
      <h3 class="section__title">The room</h3>

      <div class="field" style="margin-bottom:var(--sp-4)">
        <span class="field__label">Light or dark</span>
        <div class="seg-choice">
          ${APPEARANCES.map((mode) => `
            <button class="pill ${appearance === mode ? 'is-active' : ''}" type="button"
                    data-set-appearance="${mode}" aria-pressed="${appearance === mode}">
              ${mode === 'system' ? 'Follow the system' : mode === 'light' ? 'Light' : 'Dark'}
            </button>`).join('')}
        </div>
        <span class="field__hint">
          ${appearance === 'system'
    ? `Your computer is asking for ${systemScheme()} right now, so that is what you are seeing.`
    : 'Pinned. Your computer’s own setting is being ignored.'}
        </span>
      </div>

      <p class="muted small" style="margin-bottom:var(--sp-3)">
        Pick the light you read in. She keeps one favourite for daytime and one for night,
        and swaps between them on her own.
      </p>

      ${['light', 'dark'].map((scheme) => `
        <p class="field__label" style="margin-top:var(--sp-3)">${scheme === 'light' ? 'Daytime' : 'Night'}</p>
        <div class="theme-picker">
          ${themesOfScheme(scheme).map((key) => `
            <button class="swatch ${prefs.theme === key ? 'is-on' : ''}" type="button" data-set-theme="${key}"
                    aria-pressed="${prefs.theme === key}">
              <span class="swatch__strip" style="background:${THEMES[key].strip}"></span>
              <span class="swatch__name">${esc(THEMES[key].label)}</span>
              <span class="swatch__desc">${esc(THEMES[key].desc)}</span>
            </button>`).join('')}
        </div>`).join('')}

      <div class="seg-choice" style="margin-top:var(--sp-4)">
        <button class="btn" type="button" data-action="shuffle-theme">🎲 Surprise me with a theme</button>
      </div>
    </section>

    <section class="card">
      <h3 class="section__title">Behaviour</h3>
      ${switchRow('dynamicMoods', prefs.dynamicMoods,
    'Let genres change the mood',
    'The page re-tints as you move between shelves. Mystery goes cool, romance goes warm.')}
      ${switchRow('animations', prefs.animations,
    'Movement',
    'Drifting light, floating covers, page transitions. Turn it off for a completely still library.')}
      ${switchRow('layoutShelves', prefs.layout === 'shelves',
    'Shelves instead of a grid',
    'Genre rails on wooden planks. Turn this off for one flat wall of covers.')}
    </section>

    <section class="card">
      <h3 class="section__title">Reading comfort</h3>
      <div class="field" style="margin-top:var(--sp-4)">
        <span class="field__label">Font for your own writing</span>
        <div class="seg-choice">
          <button class="pill ${prefs.readingFont === 'sans' ? 'is-active' : ''}" type="button" data-set-font="sans">Clean</button>
          <button class="pill ${prefs.readingFont === 'serif' ? 'is-active' : ''}" type="button" data-set-font="serif">Bookish</button>
        </div>
      </div>
      <div class="field">
        <span class="field__label">Text size</span>
        <div class="seg-choice">
          ${['normal', 'cozy', 'large'].map((size) => `
            <button class="pill ${prefs.textSize === size ? 'is-active' : ''}" type="button" data-set-size="${size}">
              ${size === 'normal' ? 'Standard' : size === 'cozy' ? 'Cosy' : 'Large'}
            </button>`).join('')}
        </div>
      </div>
    </section>

    <section class="card" style="grid-column:1/-1">
      <h3 class="section__title">What is actually on the shelves
        <span class="section__note">counted, not claimed</span>
      </h3>
      <p class="muted small" style="margin-bottom:var(--sp-4)">
        Every number here is counted from the library as it stands right now. If you import
        more books, they all move on their own.
      </p>

      <div class="tally">
        ${tallyRow('Books', stats.total, 'after compound rows were split and duplicates merged')}
        ${tallyRow('Read', stats.read, 'marked by you, never guessed')}
        ${tallyRow('With your writing in them', stats.withNotes, 'notes, thoughts or memories')}
        ${fromSeries ? tallyRow('Part of a series', fromSeries, 'split out of a single row in the list') : ''}
        ${addedByHand ? tallyRow('Added by you', addedByHand, 'imported or typed in, not shipped') : ''}
        ${tallyRow('Real cover photographs', realCovers, `verified against the author; ${COVER_COUNT} shipped in the catalogue`)}
        ${tallyRow('Covers drawn for the book', fallbackCovers, 'no verified photograph yet — these are the ones worth hunting')}
        ${needsReview ? tallyRow('Flagged for a look', needsReview, 'the original row was ambiguous; nothing was invented') : ''}
      </div>

      <p class="muted small" style="margin-top:var(--sp-4)">
        ${repo.isDegraded
    ? '<strong style="color:#ff8b80">Storage is unavailable in this browser, so changes will not survive a refresh.</strong>'
    : 'Saved in this browser, on this device.'}
      </p>
      <div class="seg-choice">
        <button class="btn btn--primary" type="button" data-action="import">Paste in more books</button>
        <button class="btn" type="button" data-action="triage">Sort the shelves quickly</button>
      </div>
    </section>

    ${backupCard()}

    <section class="card" style="grid-column:1/-1">
      <h3 class="section__title">Achievements
        <span class="section__note">${gotAchievements.length} of ${ACHIEVEMENTS.length}</span>
      </h3>
      <p class="muted small" style="margin-bottom:var(--sp-4)">
        Entirely optional. Nothing here unlocks anything; they are just nice to see.
      </p>
      <div class="achievements">
        ${ACHIEVEMENTS.map((a) => `
          <div class="ach ${gotAchievements.includes(a.id) ? 'is-earned' : ''}">
            <span class="ach__icon" aria-hidden="true">${a.icon}</span>
            <span class="ach__body">
              <span class="ach__name">${esc(a.name)}</span>
              <span class="ach__blurb">${esc(a.blurb)}</span>
            </span>
          </div>`).join('')}
      </div>
    </section>


    <section class="card danger-zone">
      <h3 class="section__title">Start over</h3>
      <p class="muted small" style="margin-bottom:var(--sp-4)">
        Erases every book, rating, note and attachment on this device and reloads the original shelves.
        Download a backup first if you are not certain.
      </p>
      <button class="btn btn--danger" type="button" data-action="reset">Erase everything</button>
    </section>
  </div>`;
}

/** One line of the shelf tally: a number, what it counts, and why. */
function tallyRow(label, value, note) {
  return `
  <div class="tally__row">
    <span class="tally__num">${value}</span>
    <span class="tally__body">
      <span class="tally__label">${esc(label)}</span>
      <span class="tally__note">${esc(note)}</span>
    </span>
  </div>`;
}

function switchRow(key, on, title, desc) {
  return `
  <button class="switch" type="button" data-toggle="${key}" role="switch" aria-checked="${on}" style="width:100%;text-align:left">
    <span class="switch__text">
      <span class="switch__title">${esc(title)}</span>
      <span class="switch__desc">${esc(desc)}</span>
    </span>
    <span class="switch__track ${on ? 'is-on' : ''}"></span>
  </button>`;
}

/** Markup for the import dialog body. Wired up in app.js. */
export function importDialogBody() {
  return `
  <p class="muted small" style="margin-bottom:var(--sp-4)">
    Copy the rows straight out of your spreadsheet and paste them here — with or without
    the numbering column. Tabs, commas or pipes all work. Books already on the shelves are
    skipped, never overwritten.
  </p>
  <div class="field">
    <label class="field__label" for="import-text">Paste rows</label>
    <textarea class="textarea textarea--tall" id="import-text" data-import
placeholder="1	Norwegian Wood	Haruki Murakami	Japanese Literature
2	Pachinko	Min Jin Lee	Historical Fiction"></textarea>
    <span class="field__hint">Or: one title per line. "Title - Author" is understood too.</span>
  </div>
  <div class="field">
    <label class="filedrop">
      <input type="file" accept=".csv,.tsv,.txt,.json" hidden data-import-file>
      <span>…or choose a .csv / .tsv / .txt file</span>
      <span class="tiny mute-2">A .json backup from this library also works</span>
    </label>
  </div>
  <p class="small" data-import-preview></p>`;
}

/**
 * Live preview under the import textarea — a receipt, not a number.
 *
 * She pasted a list of rows; what lands on the shelves is a different
 * number, because compound rows split apart and duplicates fold
 * together. Showing only the final count would look like the importer
 * had quietly lost some, so it shows the arithmetic instead.
 */
export function importPreview(panel, report) {
  const slot = qs('[data-import-preview]', panel);
  if (!slot) return;
  if (!report || (!report.rows && !report.unreadable)) { slot.textContent = ''; return; }

  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const steps = [];
  if (report.split) {
    steps.push(`${plural(report.split, 'extra book')} came out of rows holding more than one title`);
  }
  if (report.merged) {
    steps.push(`${plural(report.merged, 'duplicate')} merged`);
  }
  if (report.unreadable) {
    steps.push(`<span class="mute-2">${plural(report.unreadable, 'line')} could not be read</span>`);
  }

  slot.innerHTML = `
    <strong>${plural(report.rows, 'row')} read → ${plural(report.books, 'book')} ready to shelve.</strong>
    ${steps.length ? `<br><span class="mute-2">${steps.join(' · ')}.</span>` : ''}
    <br><span class="tiny mute-2">Anything already on the shelves is skipped, never overwritten.</span>`;
}
