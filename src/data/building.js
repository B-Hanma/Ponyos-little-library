/**
 * building.js — the library as a floor plan you can bump into.
 *
 * ── WHAT CHANGED, AND WHY ─────────────────────────────────────────
 * The first version of this file described six rectangles and let the
 * character walk through all of them. That is a diagram, not a place:
 * nothing resisted her, so nothing felt solid, and the "rooms" read as
 * buttons drawn to look like rooms.
 *
 * This version describes a building. Every wall, shelf, desk and table
 * is a real rectangle in a collision list. Rooms are entered through
 * actual doorways, because the wall either side of the doorway stops
 * you. The middle of each floor is a hall with furniture in it that you
 * have to walk around. Stairs are a place you stand on.
 *
 * ── STILL DERIVED, NOT DRAWN ──────────────────────────────────────
 * Which genres exist is never hardcoded. The floors have THEMES — the
 * ground floor is stories, the first floor is people and the world, the
 * top floor is elsewhere — and each theme claims whichever of its
 * genres actually appear in her books, biggest first. A genre she does
 * not own never leaves an empty room, and a genre nobody claimed still
 * gets shelf space in the stacks. Import fifty books and the building
 * rearranges itself.
 *
 * What IS fixed is the geometry. A library should be in the same place
 * tomorrow, or walking around it is disorienting rather than pleasant.
 *
 * ── SCOPE ─────────────────────────────────────────────────────────
 * Deliberately 2D, deliberately small, deliberately no engine. This is
 * a web page that has to open instantly on a phone. Collision is
 * "rectangle against rectangle". There is no physics, no pathfinding
 * and no 3D, and none of the three would make it better.
 */

import { genreMeta } from './genres.js';

/* ───────────────────────── the size of a floor ───────────────────── */

/** World units. The camera shows roughly half this at a time. */
export const FLOOR_W = 1800;
export const FLOOR_H = 1120;

/** How fat a wall is, and how wide a doorway is cut into it. */
const WALL = 16;
const DOOR = 130;

/** The character's half-width for collision. */
export const BODY = 19;

/* ───────────────────────────── the slots ─────────────────────────── */

/**
 * Where rooms sit, in reading order, and which side their doorway is
 * cut into. Three along the top, three along the bottom, and the two
 * ends of the hall reserved for the special rooms and the stairs.
 */
const SLOTS = [
  { x: 60, y: 54, w: 470, h: 300, door: 'south' },
  { x: 665, y: 54, w: 470, h: 300, door: 'south' },
  { x: 1270, y: 54, w: 470, h: 300, door: 'south' },
  { x: 60, y: 766, w: 470, h: 300, door: 'north' },
  { x: 665, y: 766, w: 470, h: 300, door: 'north' },
  { x: 1270, y: 766, w: 470, h: 300, door: 'north' },
];

/** The odd room at the west end of the hall — one per floor, not a genre. */
const SPECIAL_SLOT = { x: 60, y: 420, w: 330, h: 280, door: 'east' };

/** The stairs, at the east end, opposite the special room. */
const STAIR_SLOT = { x: 1500, y: 452, w: 240, h: 216 };

const PER_FLOOR = SLOTS.length;
const MAX_FLOORS = 3;
const CAPACITY = MAX_FLOORS * PER_FLOOR;

/**
 * Where she appears when she arrives on a floor.
 *
 * The middle of the hall, and slightly south of dead centre so the
 * opening shot shows the reading hall with a row of rooms above and
 * below rather than one row and a lot of floorboards. Deliberately clear
 * of the lamp, which is solid.
 */
export const ENTRY = { x: FLOOR_W / 2, y: 620 };

/* ──────────────────────────── the floors ─────────────────────────── */

/**
 * What each floor is FOR.
 *
 * `wants` is a preference, not a requirement. A floor takes whichever of
 * its genres she actually owns; anything left over is redistributed, so
 * the shape of the building follows the shape of her collection rather
 * than the other way round.
 */
const FLOOR_THEMES = [
  {
    name: 'The ground floor',
    blurb: 'Stories about people, and people who did something they should not have.',
    wants: ['Literary Fiction', 'Contemporary Fiction', 'Mystery', 'Crime', 'Thriller',
      'Romance', "Children's", 'Young Adult', 'Humour', 'Poetry'],
    special: 'gossip',
  },
  {
    name: 'The upper reading room',
    blurb: 'Quieter. This is where the homework lives.',
    wants: ['Psychology', 'Self-Help', 'Philosophy', 'Economics', 'Business', 'History',
      'Japanese Literature', 'Korean Literature', 'Memoir', 'Biography', 'Essays', 'Nonfiction'],
    special: 'study',
  },
  {
    name: 'The gallery',
    blurb: 'Narrow, warm, and full of places that are not here.',
    wants: ['Fantasy', 'Science Fiction', 'Dystopian', 'Science', 'Mythology', 'Horror',
      'Classics', 'Historical Fiction'],
    special: 'glasshouse',
  },
];

/**
 * The rooms that are not genres.
 *
 * Each one is a real destination with real content behind it — see
 * library-mode.js — rather than scenery you can walk into. They are
 * placed at the quiet end of each hall, which is where you find the
 * odd rooms in a real library.
 */
export const SPECIAL_ROOMS = Object.freeze({
  gossip: {
    id: '__gossip',
    label: 'The Whispering Corner',
    icon: '\u{1F4AC}',
    world: 'sunny',
    kind: 'special',
    quip: 'Two chairs, no books, and a great deal of information.',
  },
  study: {
    id: '__study',
    label: "The Curious Empath's Study",
    icon: '\u{1F30D}',
    world: 'clarity',
    kind: 'special',
    quip: 'Maps, a globe, cold tea, and a question nobody asked her to answer.',
  },
  glasshouse: {
    id: '__glasshouse',
    label: 'The Glasshouse',
    icon: '\u{1F33F}',
    world: 'tide',
    kind: 'special',
    quip: 'Warm, green, and slightly too humid for paper.',
  },
});

/** The catch-all room for genres too small to get their own. */
const STACKS = {
  id: '__stacks',
  label: 'The stacks',
  icon: '\u{1F5C3}',
  world: 'foxed',
  kind: 'genre',
  quip: 'Everything that did not fill a room of its own.',
};

/* ─────────────────────────── building it ─────────────────────────── */

/**
 * Build the whole library out of the books she owns.
 *
 * @param {Object[]} books
 * @returns {{floors: Array, totalRooms: number, genresShown: number, unshelved: number}}
 */
export function planBuilding(books) {
  const counts = new Map();
  for (const book of books) {
    const genre = (book.genre || '').trim();
    if (!genre) continue;
    counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }

  const ordered = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  if (!ordered.length) {
    return { floors: [], totalRooms: 0, genresShown: 0, unshelved: books.length };
  }

  const assigned = assignToFloors(ordered);

  const floors = FLOOR_THEMES.map((theme, index) => {
    const sections = assigned[index] ?? [];
    if (!sections.length && index > 0) return null;

    const rooms = sections.map((section, n) => makeRoom(section, SLOTS[n]));

    // The odd room at the west end, and the stairs at the east.
    const special = SPECIAL_ROOMS[theme.special];
    if (special) rooms.push(makeRoom({ ...special, count: 0 }, SPECIAL_SLOT));

    const stairs = stairsFor(index, floors_length(assigned));
    const props = propsFor(index);

    return {
      index,
      name: theme.name,
      blurb: theme.blurb,
      rooms,
      stairs,
      props,
      solids: solidsFor(rooms, stairs, props),
      spawn: { ...ENTRY },
    };
  }).filter(Boolean);

  return {
    floors,
    totalRooms: floors.reduce((n, f) => n + f.rooms.length, 0),
    genresShown: ordered.length,
    unshelved: books.filter((b) => !(b.genre || '').trim()).length,
  };
}

/** How many floors actually ended up with anything on them. */
function floors_length(assigned) {
  return assigned.filter((list) => list.length).length;
}

/**
 * Hand each genre to the floor that wants it.
 *
 * Three passes, in this order, because the alternative — one pass that
 * tries to be clever — produces a ground floor of leftovers:
 *   1. every floor takes its own genres, biggest first;
 *   2. genres nobody asked for go wherever there is space;
 *   3. whatever still has not fitted shares the stacks.
 */
function assignToFloors(ordered) {
  // ── 1. decide what the sections ARE ─────────────────────────────
  //
  // This happens before anything is placed, and that ordering is the
  // whole point. An earlier version placed first and then tried to make
  // room for the stacks by evicting a room that had already been filled
  // — which silently dropped that genre's books out of the building
  // entirely. Deciding the section list up front means the number of
  // sections can never exceed the number of slots, so nothing ever has
  // to be evicted and no book can fall out.
  const sections = [];
  let stacks = null;

  if (ordered.length <= CAPACITY) {
    for (const [genre, count] of ordered) sections.push(section(genre, count));
  } else {
    // The genres she reads most get their own rooms; the long tail
    // shares the last one, the way the awkward shelves at the back of a
    // real library do. Every book is still exactly one click away.
    for (const [genre, count] of ordered.slice(0, CAPACITY - 1)) {
      sections.push(section(genre, count));
    }
    const tail = ordered.slice(CAPACITY - 1);
    stacks = {
      ...STACKS,
      genres: tail.map(([genre]) => genre),
      count: tail.reduce((n, [, c]) => n + c, 0),
    };
  }

  // ── 2. place them, by floor theme ───────────────────────────────
  const assigned = FLOOR_THEMES.map(() => []);
  const placed = new Set();

  FLOOR_THEMES.forEach((theme, index) => {
    for (const part of sections) {
      if (placed.has(part.id)) continue;
      if (assigned[index].length >= PER_FLOOR) break;
      if (!theme.wants.includes(part.id)) continue;
      assigned[index].push(part);
      placed.add(part.id);
    }
  });

  // ── 3. anything no floor asked for goes wherever there is room ──
  for (const part of sections) {
    if (placed.has(part.id)) continue;
    const floor = assigned.findIndex((list) => list.length < PER_FLOOR);
    if (floor === -1) break;          // cannot happen: sections <= CAPACITY
    assigned[floor].push(part);
    placed.add(part.id);
  }

  if (stacks) {
    const floor = assigned.findIndex((list) => list.length < PER_FLOOR);
    assigned[floor === -1 ? assigned.length - 1 : floor].push(stacks);
  }

  return assigned;
}

function section(genre, count) {
  const meta = genreMeta(genre);
  return {
    id: genre,
    kind: 'genre',
    genres: [genre],
    count,
    label: genre,
    icon: meta.icon,
    world: meta.mood,
    quip: meta.quip,
  };
}

/* ───────────────────── turning a slot into a room ────────────────── */

/**
 * A room, with its doorway worked out.
 *
 * The doorway is a gap in one wall plus a rectangle in front of it. That
 * rectangle is what "she is standing in the doorway" means everywhere
 * else in the app — it is the trigger zone, and it sticks out into the
 * hall so she can be offered the room slightly before she is inside it.
 */
function makeRoom(section, slot) {
  const { x, y, w, h, door } = slot;
  const mid = { x: x + w / 2, y: y + h / 2 };

  const doorway = {
    south: { x: mid.x - DOOR / 2, y: y + h - 6, w: DOOR, h: 74 },
    north: { x: mid.x - DOOR / 2, y: y - 68, w: DOOR, h: 74 },
    east: { x: x + w - 6, y: mid.y - DOOR / 2, w: 74, h: DOOR },
    west: { x: x - 68, y: mid.y - DOOR / 2, w: 74, h: DOOR },
  }[door];

  return {
    ...section,
    genre: section.id,
    x, y, w, h,
    door,
    doorway,
    /** Where she ends up if she asks to be taken here. */
    stand: {
      south: { x: mid.x, y: y + h + 40 },
      north: { x: mid.x, y: y - 40 },
      east: { x: x + w + 40, y: mid.y },
      west: { x: x - 40, y: mid.y },
    }[door],
    /** Inside, just past the threshold — where the camera settles. */
    inside: {
      south: { x: mid.x, y: y + h - 70 },
      north: { x: mid.x, y: y + 70 },
      east: { x: x + w - 70, y: mid.y },
      west: { x: x + 70, y: mid.y },
    }[door],
  };
}

/**
 * The walls of a room: four sides, with a hole where the doorway is.
 * Returned as collision rectangles, which is also exactly what the view
 * draws, so what you see is what you bump into.
 */
function wallsOf(room) {
  const { x, y, w, h, door } = room;
  const out = [];
  const gapStart = door === 'south' || door === 'north'
    ? room.doorway.x - x
    : room.doorway.y - y;
  const gapEnd = gapStart + DOOR;

  // north and south run horizontally; east and west run vertically
  for (const side of ['north', 'south']) {
    const yy = side === 'north' ? y : y + h - WALL;
    if (door !== side) { out.push({ x, y: yy, w, h: WALL }); continue; }
    out.push({ x, y: yy, w: gapStart, h: WALL });
    out.push({ x: x + gapEnd, y: yy, w: w - gapEnd, h: WALL });
  }
  for (const side of ['west', 'east']) {
    const xx = side === 'west' ? x : x + w - WALL;
    if (door !== side) { out.push({ x: xx, y, w: WALL, h }); continue; }
    out.push({ x: xx, y, w: WALL, h: gapStart });
    out.push({ x: xx, y: y + gapEnd, w: WALL, h: h - gapEnd });
  }
  return out;
}

/**
 * Shelving inside a room: two runs along the back wall, plus an island
 * in the middle of the bigger rooms. Solid — you walk down the aisle,
 * not through the stack.
 */
export function shelvesOf(room) {
  const inset = WALL + 22;
  const runs = [];
  const horizontal = room.door === 'south' || room.door === 'north';

  if (horizontal) {
    const top = room.door === 'south' ? room.y + inset : room.y + room.h - inset - 34;
    runs.push({ x: room.x + inset, y: top, w: room.w - inset * 2, h: 34 });
    if (room.h > 260) {
      runs.push({
        x: room.x + inset + 40,
        y: room.door === 'south' ? top + 96 : top - 96,
        w: room.w - inset * 2 - 80,
        h: 34,
      });
    }
  } else {
    const left = room.door === 'east' ? room.x + inset : room.x + room.w - inset - 34;
    runs.push({ x: left, y: room.y + inset, w: 34, h: room.h - inset * 2 });
  }
  return runs;
}

/* ────────────────────────────── stairs ───────────────────────────── */

/**
 * The staircase at the east end. Standing on a flight takes her there;
 * there is no button, because a library does not have a button.
 */
function stairsFor(index, floorCount) {
  const out = [];
  const half = STAIR_SLOT.h / 2 - 6;

  if (index > 0) {
    out.push({
      x: STAIR_SLOT.x, y: STAIR_SLOT.y, w: STAIR_SLOT.w, h: half,
      to: index - 1, dir: 'down', label: 'Down',
    });
  }
  if (index < floorCount - 1) {
    out.push({
      x: STAIR_SLOT.x, y: STAIR_SLOT.y + STAIR_SLOT.h - half, w: STAIR_SLOT.w, h: half,
      to: index + 1, dir: 'up', label: 'Up',
    });
  }
  return out;
}

/* ─────────────────────── furniture in the hall ───────────────────── */

/**
 * What is in the middle of each floor.
 *
 * `solid: true` means she walks around it. Everything else is drawn and
 * ignored by collision — a rug is not an obstacle, and a cat, generously,
 * moves out of the way.
 */
/**
 * What is in the middle of each floor.
 *
 * `solid: true` means she walks around it. Everything else is drawn and
 * ignored by collision — a rug is not an obstacle, and a cat, generously,
 * moves out of the way.
 *
 * ── THE BAND ──────────────────────────────────────────────────────
 * Furniture lives strictly between HALL_TOP and HALL_BOTTOM, and east of
 * the special room. That is not fussiness: the doorways of the north
 * rooms end at y=422 and those of the south rooms begin at y=698, so
 * anything placed outside this band can land across a doorway — and a
 * solid desk across a doorway makes an entire section of the library
 * unreachable, silently, with nothing on screen to explain why. The
 * first version of this file did exactly that to the Mystery room.
 *
 * A test asserts the band is respected on every floor, so the next
 * person to move a plant finds out immediately.
 */
export const HALL_TOP = 440;
export const HALL_BOTTOM = 690;
/** East of this is clear of the special room at the west end. */
export const HALL_WEST = 470;
/** West of this is clear of the stairwell at the east end. */
export const HALL_EAST = 1470;

function propsFor(index) {
  const common = [
    { kind: 'rug', x: 700, y: 464, w: 400, h: 180 },
    { kind: 'lamp', x: 884, y: 536, w: 32, h: 32, solid: true },
  ];

  if (index === 0) {
    return [
      ...common,
      { kind: 'desk', x: 1150, y: 452, w: 260, h: 72, solid: true, label: 'Returns' },
      { kind: 'table', x: 520, y: 596, w: 180, h: 80, solid: true },
      { kind: 'chair', x: 486, y: 620, w: 32, h: 36, solid: true },
      { kind: 'table', x: 1180, y: 596, w: 180, h: 80, solid: true },
      { kind: 'cat', x: 1224, y: 566, w: 56, h: 34 },
      { kind: 'plant', x: 620, y: 452, w: 44, h: 44, solid: true },
      { kind: 'plant', x: 1092, y: 640, w: 44, h: 44, solid: true },
      { kind: 'sign', x: 1400, y: 596, w: 40, h: 56, solid: true, label: 'Quiet, ideally' },
    ];
  }

  if (index === 1) {
    return [
      ...common,
      { kind: 'table', x: 540, y: 592, w: 220, h: 84, solid: true },
      { kind: 'chair', x: 590, y: 556, w: 32, h: 36, solid: true },
      { kind: 'chair', x: 676, y: 556, w: 32, h: 36, solid: true },
      { kind: 'table', x: 1160, y: 592, w: 220, h: 84, solid: true },
      { kind: 'trolley', x: 500, y: 452, w: 92, h: 52, solid: true },
      { kind: 'plant', x: 1400, y: 452, w: 44, h: 44, solid: true },
      { kind: 'ladder', x: 660, y: 448, w: 26, h: 110 },
    ];
  }

  return [
    ...common,
    { kind: 'table', x: 840, y: 596, w: 200, h: 84, solid: true },
    { kind: 'ladder', x: 1330, y: 448, w: 26, h: 110 },
    { kind: 'plant', x: 560, y: 452, w: 44, h: 44, solid: true },
    { kind: 'plant', x: 1300, y: 640, w: 44, h: 44, solid: true },
    { kind: 'cat', x: 620, y: 566, w: 56, h: 34 },
  ];
}

/* ─────────────────────────── collision list ──────────────────────── */

/**
 * Everything solid on a floor: the outer wall, every room wall, every
 * run of shelving, and the furniture that is marked solid.
 *
 * Built once per floor and handed to the movement code, which does
 * nothing cleverer than testing a rectangle against this list.
 */
function solidsFor(rooms, stairs, props) {
  const out = [
    // the outside of the building
    { x: -WALL, y: -WALL, w: FLOOR_W + WALL * 2, h: WALL * 2 },
    { x: -WALL, y: FLOOR_H - WALL, w: FLOOR_W + WALL * 2, h: WALL * 2 },
    { x: -WALL, y: -WALL, w: WALL * 2, h: FLOOR_H + WALL * 2 },
    { x: FLOOR_W - WALL, y: -WALL, w: WALL * 2, h: FLOOR_H + WALL * 2 },
  ];

  for (const room of rooms) {
    out.push(...wallsOf(room));
    out.push(...shelvesOf(room));
  }

  // The bannister down the side of the stairs, so she has to approach
  // them from the hall rather than sliding in sideways.
  for (const flight of stairs) {
    out.push({ x: flight.x - 10, y: flight.y, w: 10, h: flight.h });
  }

  // The furniture that is meant to be furniture. Without this the tables
  // and the desk are drawings she walks straight through, which is the
  // difference between a room and a picture of a room.
  for (const prop of props ?? []) {
    if (prop.solid) out.push({ x: prop.x, y: prop.y, w: prop.w, h: prop.h });
  }

  return out;
}

/* ──────────────────────────── queries ────────────────────────────── */

/** Every book belonging to a room — one genre, or the whole tail. */
export function booksInRoom(room, books) {
  if (!room || room.kind === 'special') return [];
  const wanted = new Set(room.genres ?? [room.genre]);
  return books.filter((b) => wanted.has((b.genre || '').trim()));
}

/** The room whose doorway she is standing in, or null. */
export function doorwayAt(floor, x, y) {
  return floor.rooms.find((room) => inside(room.doorway, x, y)) ?? null;
}

/** The flight of stairs she is standing on, or null. */
export function stairsAt(floor, x, y) {
  return floor.stairs.find((flight) => inside(flight, x, y)) ?? null;
}

/** True when the point is inside the room proper (not just the doorway). */
export function insideRoom(room, x, y) {
  return inside(room, x, y);
}

const inside = (rect, x, y) => rect
  && x >= rect.x && x <= rect.x + rect.w
  && y >= rect.y && y <= rect.y + rect.h;

/**
 * Move, and stop at whatever is in the way.
 *
 * Each axis is resolved separately. That is what lets her slide along a
 * wall instead of sticking to it: walking diagonally into a wall keeps
 * the component that is still free. It is the cheapest collision
 * response there is and it feels correct, which is the only test that
 * matters here.
 *
 * @returns {{x: number, y: number, hit: boolean}}
 */
export function moveWithCollision(from, dx, dy, solids) {
  let { x, y } = from;
  let hit = false;

  if (dx) {
    const next = x + dx;
    if (blocked(next, y, solids)) { hit = true; } else { x = next; }
  }
  if (dy) {
    const next = y + dy;
    if (blocked(x, next, solids)) { hit = true; } else { y = next; }
  }

  return {
    x: Math.max(BODY, Math.min(FLOOR_W - BODY, x)),
    y: Math.max(BODY, Math.min(FLOOR_H - BODY, y)),
    hit,
  };
}

function blocked(x, y, solids) {
  for (const rect of solids) {
    if (x + BODY > rect.x && x - BODY < rect.x + rect.w
      && y + BODY > rect.y && y - BODY < rect.y + rect.h) return true;
  }
  return false;
}

export { WALL, DOOR };
