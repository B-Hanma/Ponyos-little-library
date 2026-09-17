/**
 * landing.js — the front door, and the only way in.
 *
 * ── WHY THIS IS NOT A VIEW ────────────────────────────────────────
 * The landing page is not part of the app's routing. It lives outside
 * the store entirely, is built before the app renders, and removes
 * itself on the way in. That is deliberate: it makes "a reload always
 * starts here" true by construction rather than by a rule somebody has
 * to remember. There is no route to persist because there is no route.
 *
 * ── WHAT IT SHOWS ─────────────────────────────────────────────────
 * A greeting, a kitten waving, a panel of her own artwork chosen fresh
 * each visit, one door per destination with a real count on it, and a
 * line that rotates. Everything countable is counted here, at build
 * time, from the repository — no number on this page is written down.
 *
 * ── THE ARTWORK ───────────────────────────────────────────────────
 * Every file in assets/ponyo is a collage, so this asks for a `hero`
 * SCENE — one panel, cropped — rather than a file. Which panel is a
 * function of the visit id, so a refresh genuinely changes the picture.
 * Text is never placed over it.
 */

import { qs, esc } from '../utils/dom.js';
import { VIEWS, SHELVES } from '../state/store.js';
import { shelfCounts } from '../state/selectors.js';
import { scene, sceneWash } from './scene.js';
import { hasScene, sceneFor } from '../data/scenes.js';
import { cat } from './cat.js';
import { plural } from '../utils/text.js';
import {
  LANDING_LINES, LANDING_KICKERS, LANDING_QUOTES, DOOR_LINES, line, SESSION,
} from '../data/quips.js';
import { prefersReducedMotion } from '../theme/theme-manager.js';

/**
 * Build and wire the landing page.
 *
 * @param {Object} options
 * @param {Object} options.repo
 * @param {Function} options.onEnter  called with the view to open
 * @param {HTMLElement} [options.host]  where to build it; defaults to
 *        `#landing`. Injectable so a harness can mount a second copy
 *        without fighting the one that ships in index.html.
 */
export function mountLanding({ repo, onEnter, host: given }) {
  const host = given ?? qs('#landing');
  if (!host) return;
  // Re-entering from the rail: the element is still in the document but
  // was emptied on the way out, so clear any leaving state first.
  host.classList.remove('is-leaving');
  document.documentElement.classList.remove('is-entering');

  const books = repo.all();
  const counts = shelfCounts(books);
  // A fresh token per page load. This is what makes the artwork and the
  // words change on refresh rather than being stuck for a session.
  const token = `${SESSION}:${Math.floor(Date.now() / 1000)}`;

  const genres = new Set(books.map((b) => (b.genre || '').trim()).filter(Boolean));
  const authors = new Set(books.map((b) => b.author).filter((a) => a && a !== 'Author unknown'));

  // Which hero panel came up decides whether the drawn kitten appears:
  // several of them already have a cat in the picture, and one has a
  // hand-lettered "Hi Ponyo!" as well.
  const hero = sceneFor('hero', token);

  const doors = [
    {
      view: VIEWS.LIBRARY,
      name: 'The shelves',
      note: `${books.length} ${plural(books.length, 'book', 'books')}, sorted properly`,
      art: iconShelves(),
    },
    {
      view: VIEWS.BUILDING,
      name: 'Library mode',
      note: 'Walk, explore, discover',
      art: iconBuilding(),
    },
    {
      view: VIEWS.DNA,
      name: 'Reading DNA',
      note: `${authors.size} ${plural(authors.size, 'author', 'authors')} in the sky`,
      art: iconOcean(),
    },
    {
      view: VIEWS.STATS,
      name: 'Numbers',
      note: `${counts[SHELVES.READ] ?? 0} read, ${counts[SHELVES.TBR] ?? 0} waiting`,
      art: iconBars(),
    },
  ];

  host.innerHTML = `
  <div class="lp" data-lp>
    ${sceneWash('cosy', `${token}:wash`, { className: 'lp__wash' })}
    <div class="lp__vignette" aria-hidden="true"></div>
    <div class="lp__motes" aria-hidden="true"></div>

    <div class="lp__inner">
      <header class="lp__brand">
        <svg class="lp__mark" viewBox="0 0 64 64" width="34" height="34" aria-hidden="true">
          <path class="mk-wave" d="M4 42c6 0 6-6 12-6s6 6 12 6 6-6 12-6 6 6 12 6 6-6 8-6"/>
          <path class="mk-book" d="M18 14h11a5 5 0 0 1 5 5v15a5 5 0 0 0-5-4H18zM46 14H35a5 5 0 0 0-5 5v15a5 5 0 0 1 5-4h11z"/>
        </svg>
        <span class="lp__brand-text">
          <strong>Ponyo's</strong>
          <span>little library</span>
        </span>
      </header>

      <div class="lp__stage">
        <div class="lp__words">
          <p class="lp__kicker">${esc(line(LANDING_KICKERS, 'lp-kicker', token))}</p>

          <h1 class="lp__title">Hello, <em>Ponyo</em></h1>

          <p class="lp__line">${esc(line(LANDING_LINES, 'lp-line', token))}</p>

          <p class="lp__count">
            <strong>${books.length}</strong> ${plural(books.length, 'book', 'books')},
            ${genres.size} ${plural(genres.size, 'shelf', 'shelves')}, one reader.
          </p>

          <button class="lp__enter" type="button" data-lp-enter>
            <span>Enter my library</span>
            <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>
          </button>

          <p class="lp__fineprint">Everything you write here stays on this device.</p>
        </div>

        <div class="lp__art">
          ${scene('hero', token, { fit: 'box', className: 'lp__scene', eager: true,
    sizes: '(max-width: 900px) 88vw, 40vw' })}
          ${hero?.hasCat ? '' : `
          <div class="lp__kitten">
            <span class="lp__bubble" aria-hidden="true">Hi, Ponyo!</span>
            ${cat('wave', { size: 104, className: 'cat--alive', label: 'A small Persian kitten, waving' })}
          </div>`}
        </div>
      </div>

      <nav class="lp__doors" aria-label="Where to start">
        ${doors.map((door, i) => `
          <button class="lp__door" type="button" data-lp-door="${door.view}" style="--i:${i}">
            <span class="lp__door-art" aria-hidden="true">${door.art}</span>
            <span class="lp__door-body">
              <span class="lp__door-name">${esc(door.name)}</span>
              <span class="lp__door-note">${esc(door.note)}</span>
            </span>
            <svg class="lp__door-go" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
              <path d="M5 12h13M13 6l6 6-6 6"/>
            </svg>
          </button>`).join('')}
      </nav>

      <p class="lp__quote">${esc(line(LANDING_QUOTES, 'lp-quote', token))}</p>

      <p class="lp__strip" aria-hidden="true">
        <span>${books.length} books</span>
        <span>&#8734; ideas</span>
        <span>a kinder planet</span>
        <span>more chai</span>
        <span>cats, always</span>
      </p>
    </div>
  </div>`;

  /* ── the door line under each destination rotates too ── */
  for (const button of host.querySelectorAll('[data-lp-door]')) {
    const pool = DOOR_LINES[button.dataset.lpDoor];
    if (!pool) continue;
    button.title = line(pool, `door:${button.dataset.lpDoor}`, token);
  }

  const still = prefersReducedMotion();
  if (!still) drift(qs('.lp__motes', host));

  /* ── going in ── */

  let leaving = false;
  function enter(view) {
    if (leaving) return;
    leaving = true;
    host.classList.add('is-leaving');
    document.documentElement.classList.add('is-entering');

    const done = () => {
      // Emptied, not removed. The rail can bring it back, and an element
      // that removed itself could not be re-mounted without main.js
      // re-creating it.
      host.innerHTML = '';
      host.classList.remove('is-leaving');
      document.documentElement.classList.remove('is-entering');
      onEnter(view);
    };
    if (still) done(); else setTimeout(done, 820);
  }

  host.addEventListener('click', (event) => {
    const door = event.target.closest('[data-lp-door]');
    if (door) { enter(door.dataset.lpDoor); return; }
    if (event.target.closest('[data-lp-enter]')) enter(VIEWS.LIBRARY);
  });

  host.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (document.activeElement?.closest('[data-lp-door], [data-lp-enter]')) return;
    event.preventDefault();
    enter(VIEWS.LIBRARY);
  });

  qs('[data-lp-enter]', host)?.focus({ preventScroll: true });
}

/** True when there is artwork to build a hero out of. */
export function landingHasArt() { return hasScene('hero'); }

/* ───────────────────────────── the dust ──────────────────────────── */

/**
 * Motes drifting through the lamplight. Plain elements on a compositor
 * animation; a phone gets half as many.
 */
function drift(host) {
  if (!host) return;
  const count = window.innerWidth < 720 ? 14 : 30;
  let html = '';
  for (let i = 0; i < count; i += 1) {
    const size = 2 + Math.random() * 5;
    html += `<i style="left:${(Math.random() * 100).toFixed(2)}%;
      top:${(Math.random() * 100).toFixed(2)}%;
      width:${size.toFixed(1)}px;height:${size.toFixed(1)}px;
      --dur:${(16 + Math.random() * 22).toFixed(1)}s;
      --delay:${(-Math.random() * 30).toFixed(1)}s;
      --dx:${Math.round(-50 + Math.random() * 100)}px"></i>`;
  }
  host.innerHTML = html;
}

/* ─────────────────────────── door drawings ───────────────────────── */

const INK = 'rgb(var(--world-ink) / .5)';
const GLOW = 'rgb(var(--world-glow) / .9)';

/**
 * Books on a shelf — deliberately NOT a row of even bars.
 *
 * The first version drew ten identical spines and was indistinguishable
 * from the Numbers bar chart two doors along. Varied widths, varied
 * heights, one leaning against its neighbour and a plank underneath:
 * that is a shelf, and nothing else in the app looks like it.
 */
function iconShelves() {
  const spines = [
    [4, 7, 26], [12, 5, 32], [18, 8, 22], [27, 6, 30], [34, 9, 27],
    [44, 6, 34], [51, 7, 24], [59, 5, 31], [65, 8, 28],
  ].map(([x, w, h], i) => `<rect x="${x}" y="${42 - h}" width="${w}" height="${h}" rx="1.5"
      fill="${i % 4 === 1 ? GLOW : INK}"/>`).join('');
  return `<svg viewBox="0 0 90 52" aria-hidden="true">
    ${spines}
    <!-- the one that has given up -->
    <rect x="75" y="20" width="7" height="22" rx="1.5" fill="${INK}"
          transform="rotate(14 78 42)"/>
    <rect x="2" y="42" width="86" height="4" rx="2" fill="${INK}"/>
    <rect x="2" y="48" width="86" height="3" rx="1.5" fill="${INK}" opacity=".5"/></svg>`;
}

function iconBuilding() {
  return `<svg viewBox="0 0 90 52" aria-hidden="true">
    <path d="M10 48V22L45 6l35 16v26z" fill="none" stroke="${INK}" stroke-width="2.6"/>
    <rect x="38" y="32" width="14" height="16" rx="2" fill="${GLOW}"/>
    <rect x="20" y="28" width="10" height="9" rx="1.5" fill="${INK}"/>
    <rect x="60" y="28" width="10" height="9" rx="1.5" fill="${INK}"/></svg>`;
}

function iconOcean() {
  return `<svg viewBox="0 0 90 52" aria-hidden="true">
    <circle cx="22" cy="14" r="7" fill="${GLOW}" opacity=".6"/>
    <circle cx="50" cy="9" r="4" fill="${GLOW}"/>
    <circle cx="70" cy="19" r="6" fill="${GLOW}" opacity=".5"/>
    <path d="M22 14 50 9 70 19" stroke="${GLOW}" stroke-width="1.4" fill="none" opacity=".7"/>
    <path d="M4 36q11 7 22 0t22 0 22 0 18 0" stroke="${INK}" stroke-width="2.6" fill="none"/>
    <path d="M4 44q11 7 22 0t22 0 22 0 18 0" stroke="${INK}" stroke-width="2.2" fill="none" opacity=".6"/></svg>`;
}

function iconBars() {
  const bars = [14, 30, 21, 40, 26];
  return `<svg viewBox="0 0 90 52" aria-hidden="true">
    ${bars.map((h, i) => `<rect x="${12 + i * 15}" y="${44 - h}" width="10" height="${h}" rx="2"
      fill="${i === 3 ? GLOW : INK}"/>`).join('')}
    <path d="M4 46h82" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/></svg>`;
}
