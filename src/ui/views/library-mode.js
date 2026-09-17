/**
 * library-mode.js — the library as a place you walk around.
 *
 * ── THE SHAPE OF IT ───────────────────────────────────────────────
 *   a floor      seen from above, rooms off a hall, furniture in it
 *   walking      WASD, arrows, or drag anywhere; she actually moves
 *   a doorway    stand in one and the building offers you the room
 *   a section    a wall of covers, browsed sideways
 *   a book       opens the SAME book page as everywhere else
 *   the stairs   stand on them and you are on the next floor
 *
 * That fifth point is the one that matters. This mode adds a way IN; it
 * does not add a second version of anything. A cover here is the same
 * component as a cover on the shelves and calls the same
 * `openBookDetail`, so a book cannot have two different sets of features
 * depending on how she reached it.
 *
 * ── WHY 2D ────────────────────────────────────────────────────────
 * A top-down plan in SVG opens instantly, works on a phone, scales to
 * any screen, needs no assets and no engine, and is readable at a
 * glance. A 3D library would be a download, a loading screen and a
 * frame-rate problem, in exchange for being harder to navigate.
 *
 * ── HOW THE PIECES SPLIT ──────────────────────────────────────────
 *   data/building.js   the plan: rooms, walls, furniture, collision
 *   ui/lm/scenery.js   drawing all of the above
 *   ui/lm/engine.js    movement, camera, input
 *   ui/lm/section.js   what a room looks like once you are in it
 *   here               wiring, state, and the things she is told
 *
 * This file is deliberately the smallest of the five.
 */

import { esc, qs, qsa } from '../../utils/dom.js';
import { VIEWS, SHELVES } from '../../state/store.js';
import { planBuilding, booksInRoom, FLOOR_W, FLOOR_H } from '../../data/building.js';
import { drawFloor } from '../lm/scenery.js';
import { createExplorer } from '../lm/engine.js';
import { specialPanel, stacksPanel } from '../lm/section.js';
import { cat } from '../cat.js';
import { mascotSays } from '../celebrate.js';
import { line, SESSION, BUILDING_LINES } from '../../data/quips.js';
import { prefersReducedMotion } from '../../theme/theme-manager.js';

/* ────────────────────────────── markup ───────────────────────────── */

export function renderLibraryMode(ctx) {
  const { repo, store } = ctx;
  const state = store.state;
  const plan = planBuilding(repo.all());

  if (!plan.floors.length) {
    return `
    <div class="page-head">
      <p class="eyebrow">Library mode</p>
      <h1 class="page-head__title">There is no building yet</h1>
      <p class="page-head__sub">
        Rooms are made out of genres, and none of your books have one on file yet.
        Give a few books a genre and the floors will build themselves.
      </p>
    </div>`;
  }

  const floorIndex = Math.min(state.floor ?? 0, plan.floors.length - 1);
  const floor = plan.floors[floorIndex];
  const openRoom = state.room ? floor.rooms.find((r) => r.id === state.room) : null;

  // Inside a section the plan is not drawn at all. Keeping a live floor
  // behind a full-bleed overlay would mean a movement loop running under
  // something she cannot see, and a character who has wandered off by
  // the time she comes back out.
  // Only the rooms that are NOT single genres are rendered here. A genre
  // room hands straight over to the shelves' own genre view — see
  // enterRoom below — so there is no second genre screen to keep in step
  // with the first.
  if (openRoom) {
    return `
    <div class="lm lm--inside">
      ${openRoom.kind === 'special'
    ? specialPanel(openRoom, repo.all(), ctx)
    : stacksPanel(openRoom, booksInRoom(openRoom, repo.all()), ctx)}
    </div>`;
  }

  return `
  <div class="lm">
    ${floorBar(plan, floor)}
    ${stage(floor)}
  </div>`;
}

function floorBar(plan, floor) {
  return `
  <div class="lm__bar">
    <div class="lm__where">
      <span class="eyebrow">Library mode</span>
      <h1 class="lm__floor-name">${esc(floor.name)}</h1>
      <p class="lm__floor-blurb">${esc(floor.blurb)}</p>
    </div>

    <div class="lm__lift" role="group" aria-label="Floors">
      ${plan.floors.map((f) => `
        <button class="lm__lift-btn ${f.index === floor.index ? 'is-on' : ''}" type="button"
                data-floor="${f.index}" aria-pressed="${f.index === floor.index}">
          <span class="lm__lift-num">${f.index + 1}</span>
          <span class="lm__lift-label">${esc(f.name.replace(/^The /, ''))}</span>
        </button>`).join('')}
      <button class="btn btn--ghost btn--sm lm__leave" type="button" data-nav="library">
        Back to the shelves
      </button>
    </div>
  </div>`;
}

/**
 * The viewport, the world inside it, and the controls on top.
 *
 * `data-lm-ui` marks anything the character should not be steered by:
 * the engine treats a press on one of those as a press on a control
 * rather than as a shove of the stick.
 */
function stage(floor) {
  const token = `${SESSION}:floor${floor.index}`;

  return `
  <div class="lm__viewport" data-lm-viewport tabindex="0" role="application"
       aria-label="${esc(floor.name)} — walk with the arrow keys or W A S D, press E to go in">
    <div class="lm__world" data-lm-world style="width:${FLOOR_W}px;height:${FLOOR_H}px">
      ${drawFloor(floor, { token })}

      <div class="lm__walker" data-lm-walker>
        <span class="lm__walker-shadow" aria-hidden="true"></span>
        ${cat('sit', { size: 86, className: 'lm__walker-body' })}
      </div>
    </div>

    <div class="lm__prompt" data-lm-prompt hidden data-lm-ui></div>

    <div class="lm__stick" data-lm-stick aria-hidden="true">
      <span class="lm__stick-knob"></span>
    </div>

    <div class="lm__pad" data-lm-ui role="group" aria-label="Move">
      ${['up', 'left', 'down', 'right'].map((dir) => `
        <button class="lm__pad-btn lm__pad-btn--${dir}" type="button" data-lm-move="${dir}"
                aria-label="Walk ${dir}"></button>`).join('')}
    </div>

  </div>

  <!-- Under the floor, not on top of it. Both of these used to float
       inside the viewport, where they sat across the room signs and the
       shelving — the one place in the app where every pixel is already
       carrying information. -->
  <div class="lm__foot">
    <p class="lm__hint">
      <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or the arrows ·
      drag to steer · <kbd>E</kbd> to go in
    </p>
    <p class="lm__say">${esc(line(BUILDING_LINES, 'hall', token))}</p>
  </div>`;
}

/* ─────────────────────────── interactions ────────────────────────── */

/**
 * The live character, if one exists.
 *
 * Module-level because this view is re-rendered on any data change, and
 * each render must tear the previous one down. Without that, rating a
 * book from inside Library Mode would leave a second character walking
 * around inside the first, both listening to the same keyboard.
 */
let explorer = null;
let greeted = false;

/**
 * Where she was standing on each floor, keyed by floor index.
 *
 * Deliberately NOT in the store. The store schedules a render on every
 * write, and her position changes several times a second while she is
 * walking — putting it there would re-render the view (and therefore
 * rebuild the character, mid-stride) about twice a second. It is
 * presentation state that only this view can produce and only this view
 * consumes, so this is where it lives.
 *
 * It is also not persisted. Where a character was standing is not a fact
 * about her library, and a reload starts at the front door by design.
 */
const POSITIONS = new Map();

export function wireLibraryMode(ctx, root) {
  teardownLibraryMode();

  const viewport = qs('[data-lm-viewport]', root);
  if (!viewport) {
    // Inside a section: no floor to walk, but the rails want arrow keys.
    wireRails(root);
    return;
  }

  const world = qs('[data-lm-world]', viewport);
  const walker = qs('[data-lm-walker]', viewport);
  const prompt = qs('[data-lm-prompt]', viewport);

  const plan = planBuilding(ctx.repo.all());
  const floorIndex = Math.min(ctx.store.state.floor ?? 0, plan.floors.length - 1);
  const floor = plan.floors[floorIndex];
  if (!floor || !world || !walker) return;

  // Where she was standing, if she has been on this floor before.
  // Remembered per floor, so going up and coming back down returns her
  // to the landing rather than to the middle of the hall — and so does
  // coming back out of a section, because leaving one writes the
  // doorway she used into exactly this slot.
  const start = POSITIONS.get(floorIndex) ?? floor.spawn;

  explorer = createExplorer({
    viewport,
    world,
    walker,
    floor,
    start,
    reducedMotion: prefersReducedMotion() || ctx.store.state.prefs.animations === false,

    onNear(target) {
      if (!target) { prompt.hidden = true; prompt.innerHTML = ''; return; }
      prompt.hidden = false;
      prompt.innerHTML = target.kind === 'stairs'
        ? `<span class="lm__prompt-key" aria-hidden="true">${target.flight.dir === 'up' ? '↑' : '↓'}</span>
           <span>${esc(target.flight.label)} to ${esc(plan.floors[target.flight.to]?.name ?? 'the next floor')}</span>`
        : `<button class="lm__prompt-btn" type="button" data-lm-enter="${esc(target.room.id)}">
             <span class="lm__prompt-key" aria-hidden="true">E</span>
             <span>Enter ${esc(target.room.label)}</span>
             <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>
           </button>`;
    },

    onEnter(room) { enterRoom(ctx, room); },

    onStairs(flight) {
      // Arrive on the landing at the same end she left from, so the
      // stairs feel like they join two places rather than cutting to one.
      POSITIONS.set(floorIndex, explorer.position);
      POSITIONS.set(flight.to, { x: flight.x - 90, y: flight.y + flight.h / 2 });
      ctx.store.set({ floor: flight.to, room: null, roomWorld: null });
    },

    onRest(position) { POSITIONS.set(floorIndex, position); },
  });

  /* the on-screen pad, for anyone with neither keyboard nor patience */
  for (const button of qsa('[data-lm-move]', viewport)) {
    const vector = {
      up: [0, -170], down: [0, 170], left: [-170, 0], right: [170, 0],
    }[button.dataset.lmMove];
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const here = explorer.position;
      explorer.walkTo(here.x + vector[0], here.y + vector[1]);
    });
  }

  /* tapping the prompt does what pressing E does */
  prompt.addEventListener('click', (event) => {
    const button = event.target.closest('[data-lm-enter]');
    if (!button) return;
    const room = floor.rooms.find((r) => r.id === button.dataset.lmEnter);
    if (room) enterRoom(ctx, room);
  });

  // A quiet hello, once per visit rather than once per render.
  if (!greeted) {
    greeted = true;
    setTimeout(() => mascotSays('wave', 'Right. Where are we going.', { duration: 4200 }), 620);
  }
}

/**
 * Going through a door.
 *
 * ── THE IMPORTANT PART ────────────────────────────────────────────
 * A genre room does NOT open a Library-Mode version of that genre. It
 * opens THE genre — the same view the shelves open, with the same
 * cinematic stage, the same filter bar, the same cards, the same world.
 * Library Mode is a second doorway into one library, not a second
 * application, and the way to guarantee that is for it to have no genre
 * screen of its own to drift out of step.
 *
 * `fromBuilding` is the breadcrumb: it puts a "back to the floor" button
 * on the genre stage and sends her back to the exact spot she left from.
 *
 * The rooms that are NOT genres — the study, the whispering corner, the
 * glasshouse, the stacks — keep their own panels, because they are not
 * duplicates of anything. There is no "Whispering Corner" on the
 * shelves to be consistent with.
 */
function enterRoom(ctx, room) {
  // Park her on the threshold she came through, whichever way this goes.
  const floorIndex = ctx.store.state.floor ?? 0;
  POSITIONS.set(floorIndex, { ...room.stand });

  const isSingleGenre = room.kind !== 'special' && (room.genres ?? []).length === 1;

  if (isSingleGenre) {
    ctx.store.set({
      view: VIEWS.LIBRARY,
      genre: room.genres[0],
      shelf: SHELVES.ALL,
      query: '',
      author: '',
      tag: '',
      minRating: 0,
      room: null,
      roomWorld: null,
      // The genre is part of the breadcrumb on purpose: the "back to the
      // floor" button only shows while it still matches the genre on
      // screen. That makes the crumb self-invalidating — changing the
      // filter, clearing it or jumping to another genre from a card all
      // drop it without anyone having to remember to.
      fromBuilding: { floor: floorIndex, room: room.id, genre: room.genres[0] },
    });
    window.scrollTo({ top: 0, behavior: 'auto' });
    return;
  }

  ctx.store.set({ room: room.id, roomWorld: room.world });
}

/**
 * Inside a section: arrow keys scroll whichever rail has focus.
 * A horizontal scroller that only answers to a trackpad is unusable.
 */
function wireRails(root) {
  for (const rail of qsa('.lmx__rail', root)) {
    rail.addEventListener('keydown', (event) => {
      const step = rail.clientWidth * 0.8;
      if (event.key === 'ArrowRight') { rail.scrollBy({ left: step, behavior: 'smooth' }); event.preventDefault(); }
      if (event.key === 'ArrowLeft') { rail.scrollBy({ left: -step, behavior: 'smooth' }); event.preventDefault(); }
    });
  }
}

/** Called before every re-render, and by app.js when the view is left. */
export function teardownLibraryMode() {
  if (!explorer) return;
  explorer.destroy();
  explorer = null;
}
