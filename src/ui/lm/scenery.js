/**
 * scenery.js — drawing the building.
 *
 * Everything here is SVG built from primitives: no images, no sprite
 * sheets, nothing traced from anybody's artwork. It is all coloured
 * through `--world-ink` and `--world-glow`, so the same drawing works in
 * all five palettes and re-tints itself when she walks into the horror
 * room.
 *
 * ── DRAWN AND SOLID ARE THE SAME RECTANGLES ───────────────────────
 * Walls, shelving and furniture are drawn from the exact rectangles
 * building.js puts in the collision list. That is deliberate: if the
 * drawing and the collision ever disagreed, she would bump into thin
 * air, and there is no way to debug that by looking at it.
 *
 * ── THE LIVING DETAILS ────────────────────────────────────────────
 * The cat's tail, the steam off the tea, the dust in the window light,
 * the plants — all of it is CSS animation on a handful of elements, not
 * a per-frame redraw. The whole floor costs nothing while she stands
 * still, which is what lets this run on a phone.
 */

import { esc } from '../../utils/dom.js';
import { shelvesOf, FLOOR_W, FLOOR_H, WALL } from '../../data/building.js';
import { scenePanelSVG } from '../scene.js';
import { cat } from '../cat.js';

/* ───────────────────────────── the floor ─────────────────────────── */

export function drawFloor(floor, { token = '' } = {}) {
  return `
  <svg class="lm-svg" viewBox="0 0 ${FLOOR_W} ${FLOOR_H}"
       width="${FLOOR_W}" height="${FLOOR_H}" aria-hidden="true">
    ${defs()}

    <rect class="lm-ground" x="0" y="0" width="${FLOOR_W}" height="${FLOOR_H}"/>
    ${windows(floor)}
    ${floor.props.filter((p) => p.kind === 'rug').map(rug).join('')}
    ${hallLight()}

    ${floor.rooms.map((room) => drawRoom(room, token)).join('')}
    ${floor.stairs.map(drawStairs).join('')}
    ${floor.props.filter((p) => p.kind !== 'rug').map(drawProp).join('')}
    ${outerWall()}
    ${dust()}
  </svg>`;
}

function defs() {
  return `
  <defs>
    <linearGradient id="lm-boards" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgb(var(--world-ink) / .07)"/>
      <stop offset="1" stop-color="rgb(var(--world-ink) / .02)"/>
    </linearGradient>
    <radialGradient id="lm-pool" cx="0.5" cy="0.5">
      <stop offset="0" stop-color="rgb(var(--world-glow) / .26)"/>
      <stop offset="1" stop-color="rgb(var(--world-glow) / 0)"/>
    </radialGradient>
    <linearGradient id="lm-sun" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="rgb(var(--world-glow) / .22)"/>
      <stop offset="1" stop-color="rgb(var(--world-glow) / 0)"/>
    </linearGradient>
  </defs>`;
}

/** Tall windows down the long walls, with light falling in through them. */
function windows(floor) {
  const bays = [
    { x: 300, flip: 1 }, { x: 640, flip: 1 }, { x: 1120, flip: 1 },
  ];
  return `
  <g class="lm-windows">
    ${bays.map((bay) => `
      <g>
        <rect class="lm-window" x="${bay.x}" y="${WALL - 4}" width="180" height="26" rx="4"/>
        <path class="lm-sunbeam" d="M${bay.x} ${WALL + 22} h180 l90 ${floor.index === 0 ? 260 : 210} h-360z"
              fill="url(#lm-sun)"/>
      </g>`).join('')}
  </g>`;
}

function hallLight() {
  return `<ellipse class="lm-pool" cx="${FLOOR_W / 2}" cy="${FLOOR_H / 2}"
    rx="520" ry="330" fill="url(#lm-pool)"/>`;
}

function rug(prop) {
  return `
  <g class="lm-rug">
    <rect x="${prop.x}" y="${prop.y}" width="${prop.w}" height="${prop.h}" rx="26"/>
    <rect x="${prop.x + 18}" y="${prop.y + 18}" width="${prop.w - 36}" height="${prop.h - 36}" rx="18"
          class="lm-rug__inner"/>
    <rect x="${prop.x + 40}" y="${prop.y + 40}" width="${prop.w - 80}" height="${prop.h - 80}" rx="12"
          class="lm-rug__core"/>
  </g>`;
}

function outerWall() {
  return `
  <g class="lm-outer">
    <rect x="0" y="0" width="${FLOOR_W}" height="${WALL}"/>
    <rect x="0" y="${FLOOR_H - WALL}" width="${FLOOR_W}" height="${WALL}"/>
    <rect x="0" y="0" width="${WALL}" height="${FLOOR_H}"/>
    <rect x="${FLOOR_W - WALL}" y="0" width="${WALL}" height="${FLOOR_H}"/>
  </g>`;
}

/* ───────────────────────────── a room ────────────────────────────── */

export function drawRoom(room, token) {
  const horizontal = room.door === 'south' || room.door === 'north';
  const signY = room.door === 'south' ? room.y + room.h - 66 : room.y + 84;
  const signX = horizontal ? room.x + room.w / 2 : room.x + room.w / 2;

  return `
  <g class="lm-room" data-room-id="${esc(room.id)}">
    <rect class="lm-room__floor" x="${room.x}" y="${room.y}" width="${room.w}" height="${room.h}" rx="10"/>
    ${wallPaths(room)}
    ${room.doorway ? `<rect class="lm-room__mat" x="${room.doorway.x + 10}" y="${room.doorway.y + 8}"
        width="${room.doorway.w - 20}" height="${room.doorway.h - 16}" rx="8"/>` : ''}
    ${shelvesOf(room).map((run) => stack(run, room)).join('')}
    ${room.kind === 'special' ? specialInterior(room, token) : ''}
    ${roomSign(room, signX, signY)}
  </g>`;
}

/** The walls, drawn from the same rectangles the collision list holds. */
function wallPaths(room) {
  // Recomputed here rather than imported so the drawing cannot drift out
  // of step with a room that was built differently.
  const { x, y, w, h, door, doorway } = room;
  const parts = [];
  const gapStart = door === 'south' || door === 'north' ? doorway.x - x : doorway.y - y;
  const gapEnd = gapStart + doorway[door === 'south' || door === 'north' ? 'w' : 'h'];

  for (const side of ['north', 'south']) {
    const yy = side === 'north' ? y : y + h - WALL;
    if (door !== side) { parts.push({ x, y: yy, w, h: WALL }); continue; }
    parts.push({ x, y: yy, w: gapStart, h: WALL });
    parts.push({ x: x + gapEnd, y: yy, w: w - gapEnd, h: WALL });
  }
  for (const side of ['west', 'east']) {
    const xx = side === 'west' ? x : x + w - WALL;
    if (door !== side) { parts.push({ x: xx, y, w: WALL, h }); continue; }
    parts.push({ x: xx, y, w: WALL, h: gapStart });
    parts.push({ x: xx, y: y + gapEnd, w: WALL, h: h - gapEnd });
  }

  return parts.map((p) => `<rect class="lm-wall" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/>`).join('');
}

/**
 * A run of shelving: the carcass, then spines on it.
 *
 * Wide spines and not many of them. A run drawn with forty 4px spines
 * reads as a barcode; a dozen chunky ones read as books.
 */
function stack(run, room) {
  const vertical = run.h > run.w;
  const length = vertical ? run.h : run.w;
  const n = Math.max(5, Math.floor(length / 34));
  let spines = '';

  for (let i = 0; i < n; i += 1) {
    const seed = (i * 7 + room.x + room.y) % 11;
    const thick = 15 + (seed % 7);
    const depth = 20 + ((seed * 3) % 9);
    const warm = seed % 3 === 0;
    spines += vertical
      ? `<rect class="lm-spine ${warm ? 'is-warm' : ''}" x="${run.x + 5}" y="${run.y + 8 + i * (length / n)}"
           width="${depth}" height="${thick}" rx="2"/>`
      : `<rect class="lm-spine ${warm ? 'is-warm' : ''}" x="${run.x + 8 + i * (length / n)}" y="${run.y + 5}"
           width="${thick}" height="${depth}" rx="2"/>`;
  }

  return `
  <g class="lm-stack">
    <rect class="lm-stack__body" x="${run.x}" y="${run.y}" width="${run.w}" height="${run.h}" rx="4"/>
    ${spines}
  </g>`;
}

/** The sign over the door: icon, name, count. */
function roomSign(room, x, y) {
  const count = room.kind === 'special' ? '' : `${room.count} books`;
  return `
  <g class="lm-sign">
    <text class="lm-sign__icon" x="${x}" y="${y - 30}" text-anchor="middle">${room.icon}</text>
    <text class="lm-sign__name" x="${x}" y="${y}" text-anchor="middle">${esc(room.label)}</text>
    ${count ? `<text class="lm-sign__count" x="${x}" y="${y + 22}" text-anchor="middle">${count}</text>` : ''}
  </g>`;
}

/* ───────────────────── the three odd rooms, furnished ────────────── */

/**
 * The special rooms get their contents drawn in, because the whole point
 * of them is discovering a place rather than opening a category.
 */
function specialInterior(room, token) {
  const cx = room.x + room.w / 2;
  const cy = room.y + room.h / 2;

  if (room.id === '__study') {
    return `
    <g class="lm-study">
      ${scenePanelSVG('research', token, { x: room.x + 40, y: room.y + 42, w: 104, h: 84, label: 'Framed picture on the study wall' })}
      <!-- wall map, marked up -->
      <g class="lm-map" transform="translate(${room.x + 170} ${room.y + 44})">
        <rect width="128" height="86" rx="3"/>
        <path class="lm-map__coast" d="M12 56q22-26 44-12t34-22 28 4"/>
        <g class="lm-map__pins">
          <circle cx="40" cy="44" r="4"/><circle cx="82" cy="30" r="4"/><circle cx="104" cy="52" r="4"/>
        </g>
      </g>
      <!-- the desk, a globe and cold tea -->
      <g transform="translate(${cx - 70} ${cy + 30})">
        <rect class="lm-desk" width="150" height="54" rx="5"/>
        <g class="lm-globe" transform="translate(24 -8)">
          <circle r="19" class="lm-globe__ball"/>
          <path class="lm-globe__land" d="M-10-14q8 14 0 28M8-16q-7 16 0 30"/>
          <path class="lm-globe__stand" d="M-7 22h14l-3 10h-8z"/>
        </g>
        <g class="lm-steam" transform="translate(112 -6)">
          <path d="M0 0h18v9a9 9 0 0 1-18 0z" class="lm-cup"/>
          <path class="lm-steam__wisp" d="M5-6q4-7 0-13"/>
          <path class="lm-steam__wisp" d="M13-6q4-7 0-13"/>
        </g>
      </g>
      <!-- a chart taped to the wall -->
      <g class="lm-chart" transform="translate(${room.x + room.w - 130} ${room.y + 44})">
        <rect width="88" height="64" rx="3"/>
        <path d="M10 52l16-18 14 10 16-26 14 16"/>
      </g>
    </g>`;
  }

  if (room.id === '__gossip') {
    return `
    <g class="lm-gossip">
      <g transform="translate(${cx - 52} ${cy + 16})">
        ${creatureAt(0, 0, 'whisper')}
        ${creatureAt(104, 6, 'cheer')}
      </g>
      <g class="lm-bubbles">
        <g class="lm-bubble" transform="translate(${cx - 96} ${cy - 44})">
          <rect width="76" height="34" rx="16"/><path d="M22 34l-4 12 16-12z"/>
          <g class="lm-bubble__dots"><circle cx="24" cy="17" r="3.4"/><circle cx="38" cy="17" r="3.4"/><circle cx="52" cy="17" r="3.4"/></g>
        </g>
        <g class="lm-bubble lm-bubble--b" transform="translate(${cx + 24} ${cy - 62})">
          <rect width="60" height="30" rx="14"/><path d="M36 30l6 11-16-11z"/>
          <g class="lm-bubble__dots"><circle cx="22" cy="15" r="3"/><circle cx="34" cy="15" r="3"/><circle cx="46" cy="15" r="3"/></g>
        </g>
      </g>
      <g class="lm-scraps">
        <rect x="${room.x + 30}" y="${room.y + 44}" width="42" height="30" rx="2" transform="rotate(-8 ${room.x + 51} ${room.y + 59})"/>
        <rect x="${room.x + 84}" y="${room.y + 38}" width="42" height="30" rx="2" transform="rotate(6 ${room.x + 105} ${room.y + 53})"/>
        <rect x="${room.x + room.w - 80}" y="${room.y + 46}" width="42" height="30" rx="2" transform="rotate(-4 ${room.x + room.w - 59} ${room.y + 61})"/>
      </g>
    </g>`;
  }

  if (room.id === '__glasshouse') {
    return `
    <g class="lm-glass">
      <g class="lm-pond" transform="translate(${cx} ${cy + 34})">
        <ellipse rx="74" ry="34"/>
        <ellipse class="lm-pond__ring" rx="30" ry="14"/>
        <ellipse class="lm-pond__ring lm-pond__ring--b" rx="52" ry="24"/>
      </g>
      <g class="lm-fronds">
        ${[0, 1, 2, 3, 4].map((i) => {
    const x = room.x + 44 + i * ((room.w - 88) / 4);
    return `<g class="lm-frond" style="--i:${i}" transform="translate(${x} ${room.y + room.h - 40})">
            <path d="M0 0q-4-40-26-56q10 40 26 56z"/>
            <path d="M0 0q6-44 28-60q-6 44-28 60z"/>
            <path d="M0 0v-46" class="lm-frond__stem"/>
          </g>`;
  }).join('')}
      </g>
      <g class="lm-flutter">
        <g class="lm-bfly" style="--i:0" transform="translate(${cx - 60} ${cy - 40})">${butterfly()}</g>
        <g class="lm-bfly" style="--i:1" transform="translate(${cx + 50} ${cy - 16})">${butterfly()}</g>
        <g class="lm-bfly" style="--i:2" transform="translate(${cx + 8} ${cy - 62})">${butterfly()}</g>
      </g>
    </g>`;
  }

  return '';
}

function butterfly() {
  return `<path d="M0 0q-11-10-16-3t7 11zM0 0q11-10 16-3t-7 11z"/><path d="M0-4v9" stroke-width="2"/>`;
}

/** A small creature standing somewhere in the world, at world scale. */
function creatureAt(x, y, pose) {
  return `<g transform="translate(${x} ${y}) scale(.34)" class="lm-extra">${cat(pose, { size: 150 })}</g>`;
}

/* ──────────────────────────── the stairs ─────────────────────────── */

function drawStairs(flight) {
  const steps = 7;
  const stepH = flight.h / steps;
  return `
  <g class="lm-stairs" data-stairs="${flight.to}">
    <rect class="lm-stairs__well" x="${flight.x}" y="${flight.y}" width="${flight.w}" height="${flight.h}" rx="6"/>
    ${Array.from({ length: steps }, (_, i) => `
      <rect class="lm-stairs__step" x="${flight.x + 8 + (flight.dir === 'up' ? i * 2 : (steps - i) * 2)}"
            y="${flight.y + i * stepH + 2}"
            width="${flight.w - 16 - (flight.dir === 'up' ? i * 4 : (steps - i) * 4)}"
            height="${stepH - 4}" rx="2"/>`).join('')}
    <text class="lm-stairs__label" x="${flight.x + flight.w / 2}" y="${flight.y + flight.h / 2 + 5}"
          text-anchor="middle">${flight.dir === 'up' ? '↑' : '↓'} ${esc(flight.label)}</text>
  </g>`;
}

/* ───────────────────────────── furniture ─────────────────────────── */

function drawProp(prop) {
  const g = (inner, cls = '') => `<g class="lm-prop ${cls}" transform="translate(${prop.x} ${prop.y})">${inner}</g>`;

  switch (prop.kind) {
    case 'table':
      return g(`
        <rect class="lm-table" width="${prop.w}" height="${prop.h}" rx="10"/>
        <rect class="lm-table__top" x="6" y="6" width="${prop.w - 12}" height="${prop.h - 12}" rx="7"/>
        <rect class="lm-book-flat" x="${prop.w / 2 - 22}" y="${prop.h / 2 - 12}" width="44" height="26" rx="2"/>`);

    case 'desk':
      return g(`
        <rect class="lm-table" width="${prop.w}" height="${prop.h}" rx="8"/>
        <rect class="lm-table__top" x="6" y="6" width="${prop.w - 12}" height="${prop.h - 12}" rx="5"/>
        <rect class="lm-book-flat" x="18" y="16" width="52" height="30" rx="2"/>
        <rect class="lm-book-flat" x="24" y="10" width="48" height="28" rx="2"/>
        ${prop.label ? `<text class="lm-prop__label" x="${prop.w / 2}" y="${prop.h + 20}" text-anchor="middle">${esc(prop.label)}</text>` : ''}`);

    case 'chair':
      return g(`
        <rect class="lm-chair" width="${prop.w}" height="${prop.h}" rx="6"/>
        <rect class="lm-chair__back" x="2" y="-6" width="${prop.w - 4}" height="8" rx="4"/>`);

    case 'lamp':
      return g(`
        <circle class="lm-lamp__glow" r="70" cx="16" cy="16"/>
        <path class="lm-lamp__shade" d="M-6 6 16-16 38 6z"/>
        <rect class="lm-lamp__post" x="13" y="6" width="6" height="30" rx="3"/>
        <ellipse class="lm-lamp__foot" cx="16" cy="36" rx="16" ry="5"/>`, 'lm-prop--lamp');

    case 'plant':
      return g(`
        <path class="lm-pot" d="M4 ${prop.h} h${prop.w - 8} l-4 -20 h-${prop.w - 16} z"/>
        <g class="lm-leaves">
          <path d="M${prop.w / 2} ${prop.h - 20} q-4 -30 -22 -40 q6 32 22 40z"/>
          <path d="M${prop.w / 2} ${prop.h - 20} q4 -34 24 -44 q-4 36 -24 44z"/>
          <path d="M${prop.w / 2} ${prop.h - 20} v-38" class="lm-leaves__stem"/>
        </g>`);

    case 'cat':
      return g(`
        <g class="lm-cat">
          <ellipse class="lm-cat__body" cx="26" cy="20" rx="26" ry="14"/>
          <circle class="lm-cat__head" cx="48" cy="12" r="11"/>
          <path class="lm-cat__ears" d="M42 4l-2-8 7 4zM54 4l3-8 2 8z"/>
          <path class="lm-cat__tail" d="M2 20q-16 2-12-12"/>
          <g class="lm-cat__face">
            <path d="M44 11h1M52 11h1"/>
            <path d="M46 16q2 2 4 0"/>
          </g>
          <g class="lm-cat__z"><text x="56" y="-6">z</text></g>
        </g>`, 'lm-prop--cat');

    case 'trolley':
      return g(`
        <rect class="lm-table" width="${prop.w}" height="${prop.h}" rx="5"/>
        <rect class="lm-book-flat" x="8" y="8" width="30" height="18" rx="2"/>
        <rect class="lm-book-flat" x="44" y="10" width="34" height="16" rx="2"/>
        <circle class="lm-wheel" cx="14" cy="${prop.h + 5}" r="5"/>
        <circle class="lm-wheel" cx="${prop.w - 14}" cy="${prop.h + 5}" r="5"/>`);

    case 'ladder':
      return g(`
        <rect class="lm-ladder" x="0" y="0" width="5" height="${prop.h}" rx="2"/>
        <rect class="lm-ladder" x="${prop.w - 5}" y="0" width="5" height="${prop.h}" rx="2"/>
        ${Array.from({ length: 6 }, (_, i) => `<rect class="lm-ladder" x="0" y="${12 + i * (prop.h / 6)}" width="${prop.w}" height="4" rx="2"/>`).join('')}`);

    case 'sign':
      return g(`
        <rect class="lm-signpost" x="${prop.w / 2 - 2}" y="14" width="4" height="${prop.h - 14}" rx="2"/>
        <rect class="lm-signboard" x="0" y="0" width="${prop.w}" height="18" rx="4"/>
        ${prop.label ? `<text class="lm-prop__label" x="${prop.w / 2}" y="${prop.h + 16}" text-anchor="middle">${esc(prop.label)}</text>` : ''}`);

    default:
      return '';
  }
}

/* ──────────────────────── dust in the light ──────────────────────── */

/**
 * Motes drifting through the window light.
 *
 * Twenty-four of them, positioned deterministically rather than
 * randomly, so the floor looks the same each time she walks back onto
 * it. Random dust re-scattering on every re-render is the sort of thing
 * that registers as a flicker without being identifiable as one.
 */
function dust() {
  let out = '';
  for (let i = 0; i < 24; i += 1) {
    const x = 120 + ((i * 397) % (FLOOR_W - 240));
    const y = 90 + ((i * 271) % (FLOOR_H - 180));
    out += `<circle class="lm-mote" cx="${x}" cy="${y}" r="${2 + (i % 3)}" style="--i:${i}"/>`;
  }
  return `<g class="lm-dust">${out}</g>`;
}
