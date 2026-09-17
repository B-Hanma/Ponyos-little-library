/**
 * stats.js (view) — the Numbers page.
 *
 * Counting things, and nothing more. Every figure here is derived from
 * the actual records; nothing is estimated, and any card whose data does
 * not exist simply is not drawn.
 */

import { esc } from '../../utils/dom.js';
import { computeStats, funFacts, progressLine } from '../../analytics/stats.js';
import { genreMeta } from '../../data/genres.js';
import { NUMBERS_INTRO, line, SESSION } from '../../data/quips.js';
import { cat } from '../cat.js';
import { scene } from '../scene.js';

const RING = 2 * Math.PI * 56;

export function renderStats(ctx) {
  const books = ctx.repo.all();
  const stats = computeStats(books);
  const facts = funFacts(books, stats);
  const pct = Math.round(stats.progress * 100);
  const biggestGenre = stats.genres[0]?.count ?? 1;

  const tiles = [
    { num: stats.total, label: 'books on the shelves', foot: 'the whole coastline' },
    { num: stats.read, label: 'finished', foot: 'and kept' },
    { num: stats.reading, label: 'open right now', foot: stats.reading > 1 ? 'simultaneously, yes' : 'one at a time' },
    { num: stats.tbr, label: 'waiting patiently', foot: 'the pile' },
    { num: stats.favourites, label: 'favourites', foot: 'the short list' },
    { num: stats.dnf, label: 'set down', foot: 'no hard feelings' },
  ];

  return `
  <div class="stats-head">
    <div class="page-head">
      <p class="eyebrow">Numbers</p>
      <h1 class="page-head__title">The library, with a calculator</h1>
      <p class="page-head__sub">${esc(line(NUMBERS_INTRO, 'numbers', `${SESSION}:${stats.total}`))}</p>
      <div class="stats-head__cat" aria-hidden="true">
        ${cat('thinker', { size: 76, className: 'cat--alive' })}
      </div>
    </div>
    <div class="stats-head__art">
      ${scene('numbers', `${SESSION}:numbers`, { fit: 'box' })}
    </div>
  </div>

  <div class="stat-grid">
    ${tiles.map((tile) => `
      <div class="stat">
        <span class="stat__num">${tile.num}</span>
        <span class="stat__label">${esc(tile.label)}</span>
        <span class="stat__foot">${esc(tile.foot)}</span>
      </div>`).join('')}
  </div>

  <div class="dna-grid">
    <section class="card">
      <h3 class="section__title">How far in you are</h3>
      <div class="progress-ring" style="margin-top:var(--sp-4)">
        <div class="ring">
          <svg viewBox="0 0 128 128" role="img" aria-label="${pct}% of the library read">
            <circle class="ring__bg" cx="64" cy="64" r="56" fill="none" stroke-width="11"/>
            <circle class="ring__fg" cx="64" cy="64" r="56" fill="none" stroke-width="11"
                    stroke-dasharray="${RING}" stroke-dashoffset="${RING * (1 - stats.progress)}"/>
          </svg>
          <div class="ring__mid">
            <span class="ring__pct">${pct}%</span>
            <span class="ring__cap">read</span>
          </div>
        </div>
        <div style="flex:1;min-width:14rem">
          <p class="muted" style="font-family:var(--font-display);font-size:var(--step-1);line-height:1.6">
            ${esc(progressLine(stats))}
          </p>
          ${stats.rated ? `
            <p class="small mute-2" style="margin-top:var(--sp-3)">
              You have rated ${stats.rated} of them, averaging ${stats.averageRating.toFixed(1)} stars.
            </p>` : ''}
        </div>
      </div>
    </section>

    <section class="card">
      <h3 class="section__title">Shelf by shelf</h3>
      <div class="bars" style="margin-top:var(--sp-4)">
        ${stats.genres.slice(0, 12).map((row, i) => `
          <div>
            <div class="bar__top">
              <button class="bar__name" type="button" data-see-genre="${esc(row.name)}" style="background:none;border:none;padding:0;color:inherit;cursor:pointer;text-align:left">
                ${genreMeta(row.name).icon} ${esc(row.name)}
              </button>
              <span class="bar__val">${row.count}</span>
            </div>
            <div class="bar__track">
              <div class="bar__fill" style="width:${Math.round((row.count / biggestGenre) * 100)}%;animation-delay:${i * 60}ms"></div>
            </div>
          </div>`).join('')}
      </div>
    </section>

    ${facts.length ? `
    <section class="card">
      <h3 class="section__title">Things worth noticing</h3>
      <div class="facts" style="margin-top:var(--sp-4)">
        ${facts.map((fact) => `
          <div class="fact">
            <span class="fact__icon" aria-hidden="true">${fact.icon}</span>
            <div class="fact__body">
              <span class="fact__label">${esc(fact.label)}</span>
              <span class="fact__value">${esc(fact.value)}</span>
              <span class="fact__note">${esc(fact.note)}</span>
            </div>
          </div>`).join('')}
      </div>
    </section>` : ''}

    ${stats.repeatAuthors.length ? `
    <section class="card">
      <h3 class="section__title">Most shelf space</h3>
      <div class="authors" style="margin-top:var(--sp-4)">
        ${stats.repeatAuthors.slice(0, 16).map((a) => `
          <button class="author-tag" type="button" data-see-author="${esc(a.name)}">${esc(a.name)}<b>${a.count}</b></button>`).join('')}
      </div>
    </section>` : ''}

    ${stats.tags.length ? `
    <section class="card">
      <h3 class="section__title">Your own vocabulary</h3>
      <p class="muted small" style="margin-bottom:var(--sp-4)">Tags you invented, counted back to you.</p>
      <div class="authors">
        ${stats.tags.slice(0, 20).map((t) => `
          <button class="author-tag" type="button" data-see-tag="${esc(t.name)}">${esc(t.name)}<b>${t.count}</b></button>`).join('')}
      </div>
    </section>` : ''}
  </div>`;
}
