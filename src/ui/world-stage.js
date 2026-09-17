/**
 * world-stage.js — puts the genre worlds on screen.
 *
 * Two stacked layers. When the world changes, the new scene is built in
 * the hidden layer, then the two crossfade and swap roles. Nothing is
 * ever rebuilt in place, so the transition is a dissolve between two
 * different places rather than a flicker.
 *
 * The stage is `pointer-events: none` and lives behind all content. It
 * is decoration, and it is the first thing switched off when motion is
 * reduced.
 */

import { qs } from '../utils/dom.js';
import { getWorld, HOUSE_WORLD } from '../theme/worlds.js';
import { CREATURES } from '../theme/creatures.js';

/* Particle kinds: how many, how they look, how they move.
   Everything is a plain <i> so a hundred of them cost almost nothing. */
const PARTICLES = {
  rain:     { cls: 'p-rain',     dur: [0.6, 1.2],  drift: 10 },
  fog:      { cls: 'p-fog',      dur: [26, 46],    drift: 0 },
  petals:   { cls: 'p-petal',    dur: [11, 20],    drift: 140 },
  sparks:   { cls: 'p-spark',    dur: [4, 9],      drift: 60 },
  motes:    { cls: 'p-mote',     dur: [16, 30],    drift: 70 },
  bubbles:  { cls: 'p-bubble',   dur: [10, 18],    drift: 50 },
  coins:    { cls: 'p-coin',     dur: [7, 13],     drift: 40 },
  stars:    { cls: 'p-star',     dur: [2.5, 6],    drift: 0 },
  confetti: { cls: 'p-confetti', dur: [5, 10],     drift: 120 },
  /** Slow, heavy, and going one way only. For the dystopian world. */
  ash:      { cls: 'p-ash',      dur: [9, 17],     drift: 90 },
};

const rand = (a, b) => a + Math.random() * (b - a);

function buildParticles(spec) {
  if (!spec) return '';
  const meta = PARTICLES[spec.kind];
  if (!meta) return '';

  // Fewer on small screens; the effect should never cost scroll smoothness.
  const narrow = window.innerWidth < 720;
  const count = Math.round(spec.count * (narrow ? 0.5 : 1));

  let html = '';
  for (let i = 0; i < count; i += 1) {
    const dur = rand(meta.dur[0], meta.dur[1]).toFixed(2);
    const delay = (-Math.random() * dur).toFixed(2);
    const left = (Math.random() * 100).toFixed(2);
    const top = (Math.random() * 100).toFixed(2);
    const drift = (rand(-meta.drift, meta.drift)).toFixed(0);
    const scale = rand(0.6, 1.4).toFixed(2);
    const spin = Math.round(rand(-260, 260));
    html += `<i class="${meta.cls}" style="left:${left}%;top:${top}%;`
      + `--dur:${dur}s;--delay:${delay}s;--drift:${drift}px;--s:${scale};--spin:${spin}deg"></i>`;
  }
  return `<div class="world__particles">${html}</div>`;
}

/**
 * The cast: the world's characters, as opposed to its weather.
 *
 * Particles are atmosphere and there are dozens of them. These are a
 * handful of actual creatures — drawn brighter than the scenery, with
 * faces, and each on its own path. They are placed inside the outer
 * third of the stage on purpose: the middle of the screen is where the
 * books are, and a ghost drifting across a book title is a bug, however
 * charming the ghost.
 */
function buildCast(spec) {
  if (!Array.isArray(spec) || !spec.length) return '';

  // A phone gets the headline act only. Five creatures on a 390px screen
  // is not five times as charming, it is a crowd.
  const narrow = window.innerWidth < 720;

  let html = '';
  for (const entry of spec) {
    const creature = CREATURES[entry.kind];
    if (!creature) continue;
    const count = narrow ? Math.max(1, Math.round(entry.count / 2)) : entry.count;

    for (let i = 0; i < count; i += 1) {
      // Left or right band, never the middle column where text lives.
      const band = Math.random() < 0.5
        ? rand(1, 26)
        : rand(74, 96);
      const top = rand(8, 82).toFixed(1);
      const size = Math.round((entry.size ?? creature.size) * rand(0.78, 1.18));
      const dur = rand(11, 26).toFixed(1);
      const delay = (-Math.random() * dur).toFixed(1);
      const sway = Math.round(rand(24, 90));
      const flip = Math.random() < 0.5 ? -1 : 1;

      html += `<div class="world__creature ${creature.motion}" style="`
        + `left:${band.toFixed(1)}%;top:${top}%;width:${size}px;`
        + `--dur:${dur}s;--delay:${delay}s;--sway:${sway}px;--flip:${flip}"`
        + `>${creature.draw()}</div>`;
    }
  }
  return `<div class="world__cast">${html}</div>`;
}

export function createWorldStage() {
  const root = document.createElement('div');
  root.className = 'world';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = '<div class="world__layer is-front"></div><div class="world__layer"></div>';
  document.body.prepend(root);

  const layers = Array.from(root.querySelectorAll('.world__layer'));
  let front = 0;
  let currentId = null;
  let enabled = true;
  let pending = null;
  let frame = 0;

  function paint(id) {
    if (id === currentId) return;
    const world = getWorld(id);
    const back = layers[1 - front];

    back.innerHTML = world.backdrop()
      + (enabled ? buildParticles(world.particles) : '')
      + (enabled ? buildCast(world.cast) : '');
    back.dataset.world = id;

    // force a style flush so the crossfade actually animates
    void back.offsetWidth;

    back.classList.add('is-front');
    layers[front].classList.remove('is-front');
    front = 1 - front;
    currentId = id;
  }

  return {
    get current() { return currentId; },

    /** Coalesced: several requests in one frame paint once. */
    show(id) {
      pending = enabled ? (id || HOUSE_WORLD) : HOUSE_WORLD;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        paint(pending);
      });
    },

    /**
     * Turn the scenery off entirely. Used by the motion switch and by
     * prefers-reduced-motion: with no scenery there is nothing to drift.
     */
    setEnabled(on) {
      enabled = Boolean(on);
      root.hidden = !enabled;
      if (!enabled) {
        layers.forEach((l) => { l.innerHTML = ''; });
        currentId = null;
      } else if (currentId === null) {
        this.show(HOUSE_WORLD);
      }
    },

    /** Rebuild particles on resize so a phone rotating landscape is not sparse. */
    refresh() {
      const id = currentId;
      currentId = null;
      if (id) this.show(id);
    },
  };
}

/**
 * The line the library says when she arrives somewhere new.
 * Shown once per world change, then it fades.
 */
export function announceWorld(id, label) {
  const world = getWorld(id);
  const host = qs('#world-announce');
  if (!host) return;
  host.innerHTML = `
    <span class="world-announce__name">${label ?? world.name}</span>
    <span class="world-announce__line">${world.greeting}</span>`;
  host.classList.remove('is-showing');
  void host.offsetWidth;
  host.classList.add('is-showing');
}
