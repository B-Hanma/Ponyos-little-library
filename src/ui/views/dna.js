/**
 * dna.js (view) — Ponyo's Reading DNA.
 *
 * Not a dashboard. Three ways of looking at the same collection, each
 * one a picture rather than a table:
 *
 *   Reading Ocean    genres as islands in a sea, sized by how much of
 *                    her is there. Click an island to sail to it.
 *   Taste Garden     the same data as flowers, because a bar chart
 *                    cannot show that something has been growing.
 *   Constellation    authors she went back to, joined into a figure.
 *
 * Everything is generated SVG, deterministic from the data, and
 * clickable — every shape is a real filter into the library.
 */

import { esc } from '../../utils/dom.js';
import { computeDNA } from '../../analytics/dna.js';
import { genreMeta } from '../../data/genres.js';
import { DNA_INTRO, line, SESSION } from '../../data/quips.js';
import { cat } from '../cat.js';
import { framedScene } from '../scene.js';
import { hash } from '../../utils/text.js';

/* ------------------------------------------------------------------ *
 * layout helpers — deterministic, so the map never jumps around
 * ------------------------------------------------------------------ */

/** Lay islands out on a loose spiral, biggest in the middle. */
/**
 * How much vertical room an island's label needs below it. Two lines of
 * name plus the count. Layout has to know this, or islands get placed
 * so their captions land on top of each other.
 */
const LABEL_BLOCK = 40;

/** A genre name broken into at most two balanced lines. */
function splitLabel(name) {
  if (name.length <= 14) return [name];
  const words = name.split(' ');
  if (words.length === 1) return [name];

  // Break at the point that leaves the two halves closest in length.
  let best = 1;
  let bestGap = Infinity;
  for (let i = 1; i < words.length; i += 1) {
    const left = words.slice(0, i).join(' ').length;
    const right = words.slice(i).join(' ').length;
    const gap = Math.abs(left - right);
    if (gap < bestGap) { bestGap = gap; best = i; }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

/**
 * Scatter the islands, then push them apart until nothing overlaps.
 *
 * The spiral alone gives a pleasant distribution but says nothing about
 * collisions, and an island's NAME takes far more room than the island
 * does — which is why "Contemporary Fiction" used to sit across its
 * neighbour's coastline. The relaxation pass below treats each island as
 * a circle big enough to hold its own caption, and separates them.
 */
function placeIslands(rows, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const max = rows[0]?.count ?? 1;
  const golden = 2.399963;

  const islands = rows.map((row, i) => {
    const r = 21 + Math.sqrt(row.count / max) * 36;
    // spiral outward; the seed nudges each one so it does not look mechanical
    const angle = i * golden + (hash(row.name) % 100) / 220;
    const dist = i === 0 ? 0 : 96 + Math.sqrt(i) * 74;
    const jitter = (hash(`${row.name}y`) % 20) - 10;
    return {
      ...row,
      r,
      lines: splitLabel(row.name),
      /**
       * The radius the island actually OCCUPIES, which is not its radius:
       * a shoreline is drawn at r + 7, and a two-line caption hangs below
       * it. Packing on `r` is what let "Literary Fiction" sit across its
       * neighbour's coast.
       */
      keepOut: r + 10 + LABEL_BLOCK * 0.6,
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist * 0.58 + jitter,
    };
  });

  /**
   * Relax until nothing overlaps: straightforward circle separation, run
   * to convergence rather than for a fixed number of passes, so a
   * crowded library gets as many passes as it needs and a sparse one
   * stops immediately.
   */
  for (let pass = 0; pass < 260; pass += 1) {
    let moved = 0;

    for (let i = 0; i < islands.length; i += 1) {
      for (let j = i + 1; j < islands.length; j += 1) {
        const a = islands[i];
        const b = islands[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy) || 0.01;
        const wanted = a.keepOut + b.keepOut;
        if (distance >= wanted) continue;

        // Half the shortfall each, along the line between them.
        const push = (wanted - distance) / 2;
        const ux = dx / distance;
        const uy = dy / distance;
        a.x -= ux * push; a.y -= uy * push;
        b.x += ux * push; b.y += uy * push;
        moved += push;
      }
    }

    // Keep everyone in frame — caption included, or the bottom row's
    // names get clipped by the edge of the map.
    for (const island of islands) {
      const sideMargin = Math.max(island.r + 8, 52);
      // A one-line name and a two-line name need different amounts of
      // room below the island; using one number for both is what clipped
      // "Japanese Literature" against the bottom edge.
      const below = island.r + 21 + island.lines.length * 15 + 10;
      island.x = Math.max(sideMargin, Math.min(width - sideMargin, island.x));
      island.y = Math.max(island.r + 12, Math.min(height - below, island.y));
    }

    if (moved < 0.5) break;
  }

  return islands;
}

/**
 * A wobbly closed blob — an island, not a circle and not a polygon.
 *
 * Points are scattered around an ellipse, then joined with quadratic
 * curves that pass through the MIDPOINTS between them, using each point
 * as the control handle. That is the standard trick for turning a ring
 * of points into one smooth closed curve, and it is what stops these
 * reading as spiky crystals.
 */
function islandPath(cx, cy, r, seed) {
  const count = 9;
  const pts = [];
  for (let i = 0; i < count; i += 1) {
    const a = (Math.PI * 2 * i) / count;
    const wobble = 0.8 + ((hash(`${seed}${i}`) % 40) / 100);
    pts.push([
      cx + Math.cos(a) * r * wobble,
      cy + Math.sin(a) * r * wobble * 0.8,
    ]);
  }

  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const n = (v) => v.toFixed(1);

  const start = mid(pts[count - 1], pts[0]);
  let d = `M${n(start[0])} ${n(start[1])}`;
  for (let i = 0; i < count; i += 1) {
    const ctrl = pts[i];
    const end = mid(pts[i], pts[(i + 1) % count]);
    d += `Q${n(ctrl[0])} ${n(ctrl[1])} ${n(end[0])} ${n(end[1])}`;
  }
  return `${d}Z`;
}

/* ------------------------------------------------------------------ *
 * the three pictures
 * ------------------------------------------------------------------ */

/** How many islands fit before the map stops being a map. */
const MAX_ISLANDS = 10;

function readingOcean(spread) {
  const W = 900;
  const H = 560;
  const islands = placeIslands(spread.slice(0, MAX_ISLANDS), W, H);
  // Never truncate silently: a map showing ten of her fourteen genres
  // while implying it shows all of them is a small lie.
  const offMap = Math.max(0, spread.length - islands.length);

  return `
  <svg class="ocean-map" viewBox="0 0 ${W} ${H}" role="group" aria-label="Your reading, as a map">
    <defs>
      <linearGradient id="dna-sea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="rgb(var(--world-glow) / .14)"/>
        <stop offset="1" stop-color="rgb(var(--world-glow) / .04)"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" rx="18" fill="url(#dna-sea)"/>

    <!-- open water -->
    <g stroke="rgb(var(--world-glow) / .25)" stroke-width="1.6" fill="none" stroke-linecap="round">
      ${Array.from({ length: 11 }, (_, i) => `
        <path d="M${20 + (i % 3) * 30} ${34 + i * 40} q22 -11 44 0 t44 0"/>
        <path d="M${640 + (i % 4) * 26} ${20 + i * 42} q22 -11 44 0 t44 0"/>`).join('')}
    </g>

    ${islands.map((island, i) => {
    const meta = genreMeta(island.name);
    return `
      <g class="island" data-see-genre="${esc(island.name)}" role="button" tabindex="0"
         aria-label="${esc(island.name)}, ${island.count} books"
         style="--d:${i * 70}ms">
        <ellipse cx="${island.x}" cy="${island.y + island.r * 0.72}" rx="${island.r * 1.06}" ry="${island.r * 0.3}"
                 fill="rgb(var(--world-ink) / .1)"/>
        <path class="island__shore" d="${islandPath(island.x, island.y, island.r + 7, island.name + 's')}"
              fill="rgb(var(--world-glow) / .22)"/>
        <path class="island__land" d="${islandPath(island.x, island.y, island.r, island.name)}"
              fill="rgb(var(--world-ink) / .32)"/>
        <text class="island__icon" x="${island.x}" y="${island.y + 6}" text-anchor="middle"
              font-size="${Math.max(15, island.r * 0.46)}">${meta.icon}</text>

        <!-- The name is stroked in the page colour underneath itself
             (paint-order: stroke) so it stays legible wherever it lands:
             over open water, over a shoreline, over another island's
             halo. Without it the labels dissolve into the sea texture. -->
        <text class="island__name" x="${island.x}" y="${island.y + island.r + 21}" text-anchor="middle">
          ${island.lines.map((part, n) => `
            <tspan x="${island.x}" dy="${n === 0 ? 0 : 15}">${esc(part)}</tspan>`).join('')}
        </text>
        <text class="island__count" x="${island.x}"
              y="${island.y + island.r + 21 + island.lines.length * 15}" text-anchor="middle">
          ${island.count} ${island.count === 1 ? 'book' : 'books'}
        </text>
      </g>`;
  }).join('')}

    ${offMap ? `
      <text class="ocean-map__more" x="${W - 18}" y="${H - 14}" text-anchor="end">
        + ${offMap} more ${offMap === 1 ? 'genre' : 'genres'} below the horizon
      </text>` : ''}
  </svg>`;
}

function tasteGarden(spread) {
  const rows = spread.slice(0, 9);
  const max = rows[0]?.count ?? 1;
  return `
  <div class="garden">
    ${rows.map((row, i) => {
    const scale = 0.5 + (row.count / max) * 0.5;
    const petals = Math.max(5, Math.min(11, 4 + Math.round(row.count / 2)));
    const seed = hash(row.name);
    return `
      <button class="flower" type="button" data-see-genre="${esc(row.name)}"
              style="--i:${i};--scale:${scale.toFixed(2)}"
              aria-label="${esc(row.name)}, ${row.count} books">
        <svg viewBox="-50 -70 100 140" aria-hidden="true">
          <path d="M0 70 q${(seed % 12) - 6} -40 0 -74" fill="none"
                stroke="rgb(var(--world-glow) / .5)" stroke-width="3.4" stroke-linecap="round"/>
          <path d="M0 26 q-20 -12 -26 4 q18 10 26 -4z" fill="rgb(var(--world-glow) / .35)"/>
          <path d="M0 42 q20 -12 26 4 q-18 10 -26 -4z" fill="rgb(var(--world-glow) / .28)"/>
          <g transform="translate(0 -46)">
            ${Array.from({ length: petals }, (_, p) => {
    const a = (360 / petals) * p;
    return `<ellipse cx="0" cy="-15" rx="8" ry="15" transform="rotate(${a})"
                      fill="rgb(var(--world-glow) / ${(0.42 + (p % 3) * 0.12).toFixed(2)})"/>`;
  }).join('')}
            <circle r="8" fill="rgb(var(--world-ink) / .45)"/>
          </g>
        </svg>
        <span class="flower__name">${esc(row.name)}</span>
        <span class="flower__count">${row.count}</span>
      </button>`;
  }).join('')}
    <div class="garden__soil"></div>
  </div>`;
}

/** An author's name over at most two lines: given names, then surname. */
function splitName(name) {
  const words = name.trim().split(/\s+/);
  if (words.length < 2 || name.length <= 13) return [name];
  return [words.slice(0, -1).join(' '), words[words.length - 1]];
}

function constellation(authors) {
  if (authors.length < 3) return '';
  const W = 860;
  const H = 360;

  const shown = authors.slice(0, 12);
  const cols = Math.ceil(shown.length / 2);
  const rows = Math.ceil(shown.length / cols);

  /**
   * Names, not dots, decide this layout.
   *
   * Twelve authors on a six-wide grid leaves about 140px per star, and
   * "Khaled Hosseini" at the old 12px was already wider than that before
   * any jitter was added — so labels landed on top of each other and on
   * the joining lines. Three things fix it: names wrap onto two lines,
   * the jitter is small enough that it cannot close the gap, and each
   * label is outlined in the page colour so it reads over anything.
   */
  const colGap = (W - 120) / Math.max(1, cols - 1);
  const jitterRange = Math.min(18, colGap * 0.12);

  const stars = shown.map((a, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const jitterX = ((hash(a.name) % 100) / 100 - 0.5) * 2 * jitterRange;
    const jitterY = ((hash(`${a.name}y`) % 100) / 100 - 0.5) * 26;
    return {
      ...a,
      lines: splitName(a.name),
      x: 60 + col * colGap + jitterX,
      y: 74 + row * ((H - 150) / Math.max(1, rows - 1)) + jitterY,
      r: 3.5 + Math.min(a.count, 6) * 1.6,
    };
  });

  let lines = '';
  for (let i = 0; i < stars.length - 1; i += 1) {
    lines += `<line x1="${stars[i].x}" y1="${stars[i].y}" x2="${stars[i + 1].x}" y2="${stars[i + 1].y}"/>`;
  }

  return `
  <svg class="constellation" viewBox="0 0 ${W} ${H}" role="group" aria-label="Authors you went back to">
    <g stroke="rgb(var(--world-glow) / .3)" stroke-width="1.4">${lines}</g>
    ${stars.map((s, i) => `
      <g class="star-node" data-see-author="${esc(s.name)}" role="button" tabindex="0"
         aria-label="${esc(s.name)}, ${s.count} books" style="--d:${i * 80}ms">
        <circle class="star-node__halo" cx="${s.x}" cy="${s.y}" r="${s.r + 9}"/>
        <circle class="star-node__dot" cx="${s.x}" cy="${s.y}" r="${s.r}"/>
        <text class="star-node__label" x="${s.x}" y="${s.y + s.r + 18}" text-anchor="middle">
          ${s.lines.map((part, n) => `
            <tspan x="${s.x}" dy="${n === 0 ? 0 : 14}">${esc(part)}</tspan>`).join('')}
        </text>
      </g>`).join('')}
  </svg>`;
}

/* ------------------------------------------------------------------ *
 * the page
 * ------------------------------------------------------------------ */

export function renderDNA(ctx) {
  const books = ctx.repo.all();
  const dna = computeDNA(books);

  return `
  <div class="page-head">
    <p class="eyebrow">Reading DNA</p>
    <h1 class="page-head__title">What the shelves say about you</h1>
    <p class="page-head__sub">${esc(line(DNA_INTRO, 'dna', `${SESSION}:${books.length}`))}</p>
  </div>

  <section class="dna-hero">
    <div class="dna-hero__body">
      <div class="dna-hero__top">
        ${cat('thinker', { size: 96, className: 'cat--alive' })}
        <div>
          <!-- Not "diagnosis". This is a library noticing a pattern in
               its own stock, and the label has to say so: the whole page
               is playful literary analysis, and dressing it up as a
               clinical finding would be both untrue and unkind. -->
          <p class="eyebrow dna-hero__label">Going by the shelves, you might be</p>
          <h2 class="dna-hero__name">${esc(dna.archetype)}</h2>
          <p class="dna-hero__caveat">Which is a guess made entirely out of ${books.length} books.</p>
        </div>
      </div>
      <div class="dna-hero__lines">
        ${dna.observations.map((line, i) => `
          <p class="dna-hero__line" style="animation-delay:${120 + i * 90}ms">${esc(line)}</p>`).join('')}
      </div>
    </div>

    <div class="dna-hero__art">
      ${framedScene('dna', `${SESSION}:dna`, { caption: 'the reader in question', tilt: 1.4 })}
    </div>
  </section>

  <section class="section">
    <h3 class="section__title">🌊 Your reading ocean
      <span class="section__note">every island is a real shelf — click one to sail there</span>
    </h3>
    ${readingOcean(dna.spread)}
  </section>

  <section class="section">
    <h3 class="section__title">🌸 The taste garden
      <span class="section__note">the more you read of something, the more it grows</span>
    </h3>
    ${tasteGarden(dna.spread)}
  </section>

  ${dna.constellation.length >= 3 ? `
  <section class="section">
    <h3 class="section__title">✨ People you went back to
      <span class="section__note">the closest thing a library has to loyalty</span>
    </h3>
    ${constellation(dna.constellation)}
  </section>` : ''}

  <div class="dna-grid">
    <section class="card">
      <h3 class="section__title">The threads <span class="section__note">what keeps coming back</span></h3>
      <div class="themes">
        ${dna.threads.length ? dna.threads.map((thread) => `
          <button class="theme-row" type="button" data-see-genre="${esc(thread.genres[0])}">
            <span class="theme-row__mark" aria-hidden="true">${thread.icon}</span>
            <span class="theme-row__body">
              <span class="theme-row__name">${esc(thread.name)}</span>
              <span class="theme-row__desc">${esc(thread.desc)}</span>
              <span class="theme-row__count">${thread.count} ${thread.count === 1 ? 'book' : 'books'}</span>
            </span>
          </button>`).join('')
    : '<p class="muted">Not enough books yet for a pattern. Give it time.</p>'}
      </div>
    </section>

    ${dna.habits.length ? `
    <section class="card">
      <h3 class="section__title">How you keep a library</h3>
      <div class="themes">
        ${dna.habits.map((habit) => `
          <div class="theme-row">
            <span class="theme-row__mark" aria-hidden="true">\u{1F4DA}</span>
            <span class="theme-row__body"><span class="theme-row__desc">${esc(habit)}</span></span>
          </div>`).join('')}
      </div>
    </section>` : ''}
  </div>

  <p class="muted small" style="margin-top:var(--sp-6);max-width:62ch">
    None of this is science. It is one person reading a hundred book titles and drawing
    conclusions, which is exactly what you do to other people at parties.
  </p>`;
}
