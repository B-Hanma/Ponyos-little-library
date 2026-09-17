/**
 * mood-card.js — "How is Ponyo feeling today?"
 *
 * Sits at the top of the library. Asking is the feature; the
 * recommendations underneath are the payoff. Her answer is remembered
 * for the day, so it is a check-in rather than a quiz she has to retake
 * every time she opens a shelf.
 */

import { esc } from '../../utils/dom.js';
import { MOODS, MOOD_BY_ID } from '../../analytics/recommend.js';
import { cat } from '../cat.js';
import { coverMarkup } from '../covers.js';

/** Cat moods that match her mood, so the kitten reacts too. */
const MOOD_POSE = {
  happy: 'cheer',
  emotional: 'smitten',
  tired: 'sleep',
  chaotic: 'cheer',
  overthinking: 'thinker',
  sad: 'blink',
  romantic: 'smitten',
  angry: 'deadpan',
  fried: 'sleep',
  curious: 'explorer',
  justread: 'read',
};

export function moodPose(moodId) {
  return MOOD_POSE[moodId] ?? 'sit';
}

/**
 * @param {{mood: string|null, recs: Array, freeText: string, collapsed: boolean, cache: Object}} state
 */
export function moodCard({ mood, recs = [], freeText = '', collapsed = false, cache }) {
  const active = mood ? MOOD_BY_ID[mood] : null;

  if (collapsed) {
    return `
    <div class="mood-card mood-card--slim">
      <div class="mood-card__head" style="margin:0">
        ${cat(active ? moodPose(active.id) : 'sit', { size: 52, className: 'cat--alive mood-card__mascot' })}
        <div style="flex:1;min-width:0">
          <p class="mood-card__sub" style="margin:0">
            ${active ? `Today you said you were feeling <strong>${esc(active.label.toLowerCase())}</strong>.` : 'Feeling something in particular today?'}
          </p>
        </div>
        <button class="btn btn--sm" type="button" data-mood-expand>
          ${active ? 'Change it' : 'Tell the library'}
        </button>
      </div>
    </div>`;
  }

  return `
  <div class="mood-card">
    <div class="mood-card__head">
      ${cat(active ? moodPose(active.id) : 'sit', { size: 76, className: 'cat--alive mood-card__mascot' })}
      <div style="flex:1;min-width:14rem">
        <h2 class="mood-card__title">🌊 How is Ponyo feeling today?</h2>
        <p class="mood-card__sub">Pick one, or just tell me. I will find you something.</p>
      </div>
      <button class="icon-btn" type="button" data-mood-collapse aria-label="Hide this">
        <svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 15l6-6 6 6"/></svg>
      </button>
    </div>

    <div class="mood-grid" role="group" aria-label="Moods">
      ${MOODS.map((m) => `
        <button class="mood-chip ${mood === m.id ? 'is-on' : ''}" type="button"
                data-mood="${m.id}" aria-pressed="${mood === m.id}">
          <span class="mood-chip__emoji" aria-hidden="true">${m.emoji}</span>${esc(m.label)}
        </button>`).join('')}
    </div>

    <form class="mood-tell" data-mood-form>
      <input class="input" type="text" data-mood-text
             value="${esc(freeText)}"
             placeholder="…or: “I am feeling lonely and want something comforting”"
             aria-label="Tell the library how you feel">
      <button class="btn btn--primary" type="submit">Find me something</button>
    </form>

    ${active ? verdict(active, recs, cache) : ''}
  </div>`;
}

function verdict(mood, recs, cache) {
  if (!recs.length) {
    return `
    <div class="mood-verdict">
      <p class="mood-verdict__line">${esc(mood.line)}</p>
      <p class="muted small">Nothing on the shelves matches that yet — add a few more books and ask again.</p>
    </div>`;
  }
  return `
  <div class="mood-verdict">
    <p class="mood-verdict__line">${esc(mood.line)}</p>
    <div class="recs">
      ${recs.map(({ book, reasons }) => {
    return `
        <button class="rec" type="button" data-open="${esc(book.id)}">
          <span class="rec__cover">${coverMarkup(book, cache)}</span>
          <span class="rec__body">
            <span class="rec__title">${esc(book.title)}</span>
            <span class="rec__author">${esc(book.author)}</span>
            ${reasons.length ? `<span class="rec__why">${esc(reasons.join(' · '))}</span>` : ''}
          </span>
        </button>`;
  }).join('')}
    </div>
    <button class="btn btn--ghost btn--sm" type="button" data-mood-more style="margin-top:var(--sp-3)">
      Show me different ones
    </button>
  </div>`;
}
