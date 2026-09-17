/**
 * engine.js — moving a character around a floor, and pointing a camera
 * at her.
 *
 * ── WHAT THIS IS, AND IS NOT ──────────────────────────────────────
 * It is about two hundred lines of arithmetic: read the held keys, turn
 * them into a velocity, ask building.js whether the next position is
 * inside anything, and move the camera. It is NOT a game engine. There
 * is no entity system, no physics, no tick scheduler, and nothing to
 * learn before you can read it.
 *
 * ── WHY A REAL LOOP THIS TIME ─────────────────────────────────────
 * The previous version tweened the character to a point with a CSS
 * transition. That is fine for "go there" and useless for "walk
 * around": you cannot hold a direction, you cannot feel a wall, and you
 * cannot change your mind halfway. Holding a key has to mean something,
 * so there is a frame loop — but only while she is actually moving.
 * Standing still costs nothing, which is what keeps this civil on a
 * phone.
 *
 * ── INPUT ─────────────────────────────────────────────────────────
 *   WASD and the arrow keys      held, not tapped
 *   a drag anywhere on the floor an on-screen stick, for touch
 *   a tap on the floor           walk there, and stop when you arrive
 *   E, Enter or Space            go into whatever you are standing in
 *
 * All four feed the same velocity, so they compose: you can shove the
 * stick and press a key and nothing fights.
 */

import {
  moveWithCollision, doorwayAt, stairsAt, FLOOR_W, FLOOR_H,
} from '../../data/building.js';

/** World units per second at a full push. */
const SPEED = 430;
/** How fast she gets up to speed, and how fast she stops. */
const EASE_IN = 13;
const EASE_OUT = 17;
/** Below this, treat her as stopped and let the loop die. */
const STILL = 4;

/** How long she has to stand on a flight of stairs before it takes her. */
const STAIR_DWELL = 420;

const KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

/**
 * @param {Object} options
 * @param {HTMLElement} options.viewport  the element with overflow hidden
 * @param {HTMLElement} options.world     the thing that gets moved
 * @param {HTMLElement} options.walker    the character
 * @param {Object} options.floor          from planBuilding()
 * @param {{x: number, y: number}} options.start
 * @param {Function} options.onNear       (target|null) => void
 * @param {Function} options.onEnter      (room) => void
 * @param {Function} options.onStairs     (flight) => void
 * @param {Function} options.onRest       ({x, y}) => void  — for saving
 * @param {boolean} options.reducedMotion
 */
export function createExplorer(options) {
  const {
    viewport, world, walker, floor, start,
    onNear, onEnter, onStairs, onRest, reducedMotion = false,
  } = options;

  const pos = { x: start.x, y: start.y };
  const vel = { x: 0, y: 0 };
  const held = new Set();
  const stick = { active: false, x: 0, y: 0, id: null };
  let target = null;            // a tapped destination, or null
  let facing = 1;
  let frame = 0;
  let last = 0;
  let scale = 1;
  let near = null;
  let stairTimer = 0;
  let restTimer = 0;
  let dead = false;

  /* ───────────────────────────── camera ──────────────────────────── */

  /**
   * How much of the world to show.
   *
   * A phone gets a tighter crop, because the same field of view on a
   * 390px screen renders the room signs unreadable — and a library you
   * cannot read the signs in is a maze.
   */
  function fit() {
    const rect = viewport.getBoundingClientRect();
    if (!rect.width) return;
    // How many world units across to show. A phone gets a tighter crop,
    // because the same field of view on a 390px screen renders the room
    // signs unreadable — and a library whose signs you cannot read is a
    // maze. A desktop shows most of the floor at once, so the shape of
    // the building is legible before she has walked anywhere.
    const visible = rect.width < 560 ? 860 : rect.width < 1000 ? 1180 : 1560;
    scale = Math.max(0.3, Math.min(1.1, rect.width / visible));
    camera(true);
  }

  /** Centre on her, then refuse to show anything outside the building. */
  function camera(instant = false) {
    const rect = viewport.getBoundingClientRect();
    const w = FLOOR_W * scale;
    const h = FLOOR_H * scale;

    let x = rect.width / 2 - pos.x * scale;
    let y = rect.height / 2 - pos.y * scale;

    // When the floor is smaller than the viewport there is nothing to
    // pan: centre it and leave it alone.
    x = w <= rect.width ? (rect.width - w) / 2 : Math.max(rect.width - w, Math.min(0, x));
    y = h <= rect.height ? (rect.height - h) / 2 : Math.max(rect.height - h, Math.min(0, y));

    world.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(4)})`;
    if (instant) world.style.transition = 'none';
  }

  /* ─────────────────────────── the loop ──────────────────────────── */

  function wake() {
    if (dead || frame) return;
    last = performance.now();
    frame = requestAnimationFrame(step);
  }

  function step(now) {
    frame = 0;
    // Clamped: a backgrounded tab hands back a delta of several seconds,
    // and integrating that in one go teleports her through a wall.
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    const wish = direction();
    const ease = (wish.x || wish.y) ? EASE_IN : EASE_OUT;
    vel.x += ((wish.x * SPEED) - vel.x) * Math.min(1, ease * dt);
    vel.y += ((wish.y * SPEED) - vel.y) * Math.min(1, ease * dt);

    const speed = Math.hypot(vel.x, vel.y);
    if (speed > STILL) {
      const moved = moveWithCollision(pos, vel.x * dt, vel.y * dt, floor.solids);
      // Walking into a wall kills the velocity into it, so she does not
      // keep accelerating against something she cannot pass.
      if (moved.x === pos.x) vel.x = 0;
      if (moved.y === pos.y) vel.y = 0;
      pos.x = moved.x;
      pos.y = moved.y;

      if (Math.abs(vel.x) > 20) facing = vel.x < 0 ? -1 : 1;
      paint();
      checkSurroundings();
      scheduleRest();
    } else {
      vel.x = 0; vel.y = 0;
      walker.classList.remove('is-walking');
    }

    // Keep going only while there is something to do.
    if (speed > STILL || wish.x || wish.y) wake();
  }

  /** Keys, stick and tapped target, combined into one unit vector. */
  function direction() {
    let x = 0;
    let y = 0;

    for (const code of held) {
      const move = KEYS[code];
      if (move) { x += move[0]; y += move[1]; }
    }
    if (stick.active) { x += stick.x; y += stick.y; }

    if (!x && !y && target) {
      const dx = target.x - pos.x;
      const dy = target.y - pos.y;
      const distance = Math.hypot(dx, dy);
      // Arrived, or stuck against something on the way. Either way, stop
      // rather than grinding into a wall forever.
      if (distance < 26) { target = null; } else { x = dx / distance; y = dy / distance; }
    }

    const length = Math.hypot(x, y);
    // Normalised, so walking diagonally is not 41% faster than walking
    // straight — the classic way a hand-rolled mover feels wrong.
    return length > 1 ? { x: x / length, y: y / length } : { x, y };
  }

  function paint() {
    walker.style.transform = `translate3d(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px, 0)`;
    walker.style.setProperty('--face', facing);
    walker.classList.add('is-walking');
    camera();
  }

  /* ───────────────────── doorways, stairs, prompts ───────────────── */

  function checkSurroundings() {
    const flight = stairsAt(floor, pos.x, pos.y);
    if (flight) {
      // A short dwell, so brushing past the bottom step does not launch
      // her up a floor mid-stride.
      if (!stairTimer) {
        stairTimer = setTimeout(() => { stairTimer = 0; onStairs?.(flight); }, STAIR_DWELL);
      }
      announce({ kind: 'stairs', flight });
      return;
    }
    if (stairTimer) { clearTimeout(stairTimer); stairTimer = 0; }

    const room = doorwayAt(floor, pos.x, pos.y);
    announce(room ? { kind: 'room', room } : null);
  }

  function announce(next) {
    const id = next ? (next.room?.id ?? `stairs:${next.flight.to}`) : null;
    const wasId = near ? (near.room?.id ?? `stairs:${near.flight.to}`) : null;
    if (id === wasId) return;
    near = next;
    onNear?.(next);
  }

  /** Save where she is, but not sixty times a second. */
  function scheduleRest() {
    if (restTimer) return;
    restTimer = setTimeout(() => {
      restTimer = 0;
      onRest?.({ x: Math.round(pos.x), y: Math.round(pos.y) });
    }, 420);
  }

  /* ──────────────────────────── input ────────────────────────────── */

  function onKeyDown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = document.activeElement?.tagName;
    // Never steal typing, and never fight an open drawer or dialog.
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (document.querySelector('.drawer, .modal')) return;

    if (KEYS[event.code]) {
      event.preventDefault();
      target = null;            // taking the wheel cancels a tapped walk
      held.add(event.code);
      wake();
      return;
    }
    if (event.code === 'KeyE' || event.code === 'Enter' || event.code === 'Space') {
      if (!near) return;
      event.preventDefault();
      trigger();
    }
  }

  function onKeyUp(event) {
    if (!held.delete(event.code)) return;
    wake();
  }

  /** Whatever she is standing in, opened. */
  function trigger() {
    if (!near) return;
    if (near.kind === 'stairs') onStairs?.(near.flight);
    else onEnter?.(near.room);
  }

  /* ── the stick: drag anywhere on the floor ── */

  function onPointerDown(event) {
    // A press on a real control is that control's business.
    if (event.target.closest('button, a, [data-lm-ui]')) return;
    stick.id = event.pointerId;
    stick.active = true;
    stick.origin = { x: event.clientX, y: event.clientY };
    stick.moved = false;
    stick.x = 0; stick.y = 0;
    viewport.setPointerCapture?.(event.pointerId);
    viewport.classList.add('is-steering');
  }

  function onPointerMove(event) {
    if (!stick.active || event.pointerId !== stick.id) return;
    const dx = event.clientX - stick.origin.x;
    const dy = event.clientY - stick.origin.y;
    const distance = Math.hypot(dx, dy);

    // A few pixels of slop, so a tap is a tap and not a twitch of the
    // stick in whatever direction the finger rolled.
    if (distance < 12) { stick.x = 0; stick.y = 0; return; }
    stick.moved = true;
    const reach = Math.min(distance, 64);
    stick.x = (dx / distance) * (reach / 64);
    stick.y = (dy / distance) * (reach / 64);
    target = null;
    knob(stick.x, stick.y);
    wake();
  }

  function onPointerUp(event) {
    if (!stick.active || event.pointerId !== stick.id) return;
    const wasDrag = stick.moved;
    stick.active = false;
    stick.x = 0; stick.y = 0;
    stick.id = null;
    viewport.classList.remove('is-steering');
    knob(0, 0);

    // A press that never became a drag is a "walk over there".
    if (!wasDrag) walkToPointer(event);
    wake();
  }

  function knob(x, y) {
    viewport.style.setProperty('--stick-x', `${(x * 26).toFixed(1)}px`);
    viewport.style.setProperty('--stick-y', `${(y * 26).toFixed(1)}px`);
  }

  function walkToPointer(event) {
    const rect = world.getBoundingClientRect();
    target = {
      x: (event.clientX - rect.left) / scale,
      y: (event.clientY - rect.top) / scale,
    };
    wake();
  }

  /* ──────────────────────────── set-up ───────────────────────────── */

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  viewport.addEventListener('pointerdown', onPointerDown);
  viewport.addEventListener('pointermove', onPointerMove);
  viewport.addEventListener('pointerup', onPointerUp);
  viewport.addEventListener('pointercancel', onPointerUp);

  const resize = () => fit();
  window.addEventListener('resize', resize);

  // Keys held when the tab loses focus would otherwise stay held, and
  // she would still be walking when the page came back.
  const blur = () => { held.clear(); stick.active = false; stick.x = 0; stick.y = 0; };
  window.addEventListener('blur', blur);

  fit();
  paint();
  walker.classList.remove('is-walking');
  checkSurroundings();

  if (reducedMotion) walker.classList.add('is-still');

  return {
    get position() { return { x: pos.x, y: pos.y }; },

    /** Put her somewhere immediately — used when a room hands her back. */
    teleport(x, y) {
      pos.x = x; pos.y = y;
      vel.x = 0; vel.y = 0;
      target = null;
      paint();
      walker.classList.remove('is-walking');
      checkSurroundings();
    },

    /** Send her somewhere on her own legs. */
    walkTo(x, y) { target = { x, y }; wake(); },

    /** Whatever she is currently standing in. */
    get nearby() { return near; },
    trigger,

    refit: fit,

    destroy() {
      dead = true;
      if (frame) cancelAnimationFrame(frame);
      clearTimeout(stairTimer);
      clearTimeout(restTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      viewport.removeEventListener('pointerdown', onPointerDown);
      viewport.removeEventListener('pointermove', onPointerMove);
      viewport.removeEventListener('pointerup', onPointerUp);
      viewport.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('resize', resize);
      window.removeEventListener('blur', blur);
    },
  };
}
