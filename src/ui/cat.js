/**
 * cat.js — the kitten who lives here.
 *
 * A small long-haired Persian: flat face, enormous eyes, a ruff of fur
 * round the neck, tufted ears and a tail that never stops. Drawn
 * entirely from primitives, so it recolours with the current world,
 * scales anywhere, ships with no image files, and is nobody else's
 * character.
 *
 * It replaces the sea creature as the companion. The ocean is still the
 * house identity — the palette, the waves, the bubbles — but the thing
 * that follows her around is a cat, because she likes cats.
 *
 * ── ONE BODY, MANY MOODS ──────────────────────────────────────────
 * `cat('detective')` is the same kitten wearing a different expression
 * and holding a different prop. Adding a mood is one entry in MOODS,
 * never a new drawing — which is what keeps every appearance recognisably
 * the same animal rather than a sheet of stickers.
 *
 * ── THE VIEWBOX ───────────────────────────────────────────────────
 * -100..100 on both axes, origin at the middle of the face. Props are
 * positioned in those units. Keep new props inside about ±96 or they
 * will be clipped by callers that size the SVG tightly.
 */

import { getWorld } from '../theme/worlds.js';

/*
 * The fur is a FIXED warm palette, not the world colour.
 *
 * The first version tinted the whole animal with `--world-glow`, which
 * made it teal on the house theme — and a small round teal creature does
 * not read as a Persian kitten, it reads as the sea creature it was
 * meant to replace. A cat has to look like a cat in every world. The
 * world still gets in, but through the props and the glow around it
 * rather than through the animal's coat.
 *
 * Overridable per surface with --cat-fur / --cat-deep if a genre ever
 * wants a black cat.
 */
const FUR = 'var(--cat-fur, #f2e3d2)';
const FUR_DEEP = 'var(--cat-deep, #c2a98f)';
const FUR_DARK = 'var(--cat-dark, #9c8269)';
const LINE = 'var(--cat-line, #4a3a2e)';
const BLUSH = 'var(--cat-blush, #ff9bb0)';
const EYE = 'var(--cat-eye, #3c3326)';

/**
 * Coats.
 *
 * One drawing, several cats. Without this every kitten in the app was
 * the same cream Persian, which made a row of them read as one sticker
 * repeated rather than as a household. The mood supplies the expression
 * and the props; the coat supplies the animal.
 *
 * Eye colour moves with the coat, because a black cat with brown eyes
 * looks like a colouring mistake.
 */
export const COATS = Object.freeze({
  cream:  { fur: '#f2e3d2', deep: '#c2a98f', dark: '#9c8269', eye: '#3c3326' },
  grey:   { fur: '#e2e4e6', deep: '#a8b0b6', dark: '#7d868d', eye: '#3a4a52' },
  tabby:  { fur: '#e8d3b4', deep: '#b08b5e', dark: '#7f6039', eye: '#4a3a1f' },
  ginger: { fur: '#fbd9ad', deep: '#e09a53', dark: '#b06d2c', eye: '#5a3312' },
  smoke:  { fur: '#cfd3dc', deep: '#8a90a0', dark: '#5f6472', eye: '#2f3644' },
  ink:    { fur: '#8d8fa0', deep: '#575a6b', dark: '#3b3d4a', eye: '#d8c98a' },
  snow:   { fur: '#fdfaf6', deep: '#d9d2c8', dark: '#a89f92', eye: '#5b7f96' },
});

/** The CSS custom properties for a coat, ready for a style attribute. */
function coatStyle(name) {
  const coat = COATS[name];
  if (!coat) return '';
  return `--cat-fur:${coat.fur};--cat-deep:${coat.deep};`
    + `--cat-dark:${coat.dark};--cat-eye:${coat.eye}`;
}

/* ------------------------------------------------------------------ *
 * the body
 * ------------------------------------------------------------------ */

/* Eyes sit at (±24, -8) on a head centred at (0, -12). Big, because
   that is most of what makes a kitten read as a kitten. */
const EYES = {
  open: `
    <ellipse cx="-24" cy="-8" rx="14" ry="16" fill="#fff"/>
    <ellipse cx="24" cy="-8" rx="14" ry="16" fill="#fff"/>
    <ellipse cx="-23" cy="-6" rx="10" ry="12.5" fill="${EYE}"/>
    <ellipse cx="25" cy="-6" rx="10" ry="12.5" fill="${EYE}"/>
    <circle cx="-19" cy="-12" r="4.2" fill="#fff"/>
    <circle cx="29" cy="-12" r="4.2" fill="#fff"/>
    <circle cx="-26" cy="0" r="2.2" fill="#fff" opacity=".75"/>
    <circle cx="22" cy="0" r="2.2" fill="#fff" opacity=".75"/>`,

  shut: `
    <path d="M-36 -8 q12 11 24 0" fill="none" stroke="${LINE}" stroke-width="4" stroke-linecap="round"/>
    <path d="M12 -8 q12 11 24 0" fill="none" stroke="${LINE}" stroke-width="4" stroke-linecap="round"/>`,

  wide: `
    <ellipse cx="-24" cy="-8" rx="16" ry="18" fill="#fff"/>
    <ellipse cx="24" cy="-8" rx="16" ry="18" fill="#fff"/>
    <ellipse cx="-23" cy="-6" rx="11.5" ry="13.5" fill="${EYE}"/>
    <ellipse cx="25" cy="-6" rx="11.5" ry="13.5" fill="${EYE}"/>
    <circle cx="-18" cy="-13" r="4.6" fill="#fff"/>
    <circle cx="30" cy="-13" r="4.6" fill="#fff"/>`,

  squint: `
    <path d="M-36 -11 q12 12 24 1" fill="none" stroke="${LINE}" stroke-width="4" stroke-linecap="round"/>
    <path d="M12 -10 q12 12 24 -1" fill="none" stroke="${LINE}" stroke-width="4" stroke-linecap="round"/>`,

  hearts: `
    <g fill="${BLUSH}">
      <path d="M-24 -18 c-7 -7 -16 -1 -16 6 c0 7 10 11 16 17 c6 -6 16 -10 16 -17 c0 -7 -9 -13 -16 -6z"/>
      <path d="M24 -18 c-7 -7 -16 -1 -16 6 c0 7 10 11 16 17 c6 -6 16 -10 16 -17 c0 -7 -9 -13 -16 -6z"/>
    </g>`,

  /** One eye shut. For the mischievous ones. */
  wink: `
    <ellipse cx="-24" cy="-8" rx="14" ry="16" fill="#fff"/>
    <ellipse cx="-23" cy="-6" rx="10" ry="12.5" fill="${EYE}"/>
    <circle cx="-19" cy="-12" r="4.2" fill="#fff"/>
    <path d="M12 -8 q12 11 24 0" fill="none" stroke="${LINE}" stroke-width="4" stroke-linecap="round"/>`,
};

const MOUTHS = {
  /** The cat :3 — two little curves meeting under the nose. */
  w: `<path d="M-11 20 q5.5 7 11 0 q5.5 7 11 0" fill="none" stroke="${LINE}"
        stroke-width="3" stroke-linecap="round"/>`,
  smile: `<path d="M-9 19 q9 8 18 0" fill="none" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>`,
  o: `<ellipse cx="0" cy="23" rx="6.5" ry="7.5" fill="${LINE}"/>`,
  flat: `<path d="M-9 22 h18" fill="none" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>`,
  wobble: `<path d="M-12 22 q6 -6 12 0 q6 6 12 0" fill="none" stroke="${LINE}"
            stroke-width="3" stroke-linecap="round"/>`,
  grin: `<path d="M-14 17 q14 15 28 0 z" fill="${LINE}"/>`,
};

/**
 * The kitten.
 *
 * Order matters: tail and haunches first so they sit behind, then the
 * ruff, then the head, then the face. The tail carries its own class so
 * CSS can swish it without touching anything else.
 */
function body({ eyes = 'open', mouth = 'w', tail = true } = {}) {
  return `
    <!-- tail: a big fluffy plume, drawn first so it sits behind -->
    ${tail ? `<g class="cat__tail">
      <!-- Swept well clear of the body. Tucked in close it read as a
           drop shadow rather than as a tail. -->
      <path d="M44 84 q52 2 50 -38 q-2 -30 -30 -32" fill="none"
            stroke="${FUR_DEEP}" stroke-width="24" stroke-linecap="round"/>
      <path d="M62 16 q18 6 16 22" fill="none"
            stroke="${FUR}" stroke-width="13" stroke-linecap="round"/>
    </g>` : ''}

    <!-- body: small and low. A Persian kitten is mostly head and floof. -->
    <path d="M-44 88 q-6 -40 10 -54 q18 -14 34 -14 q16 0 34 14 q16 14 10 54z"
          fill="${FUR_DEEP}"/>
    <path d="M-26 88 q-4 -30 6 -40 q10 -10 20 -10 q10 0 20 10 q10 10 6 40z"
          fill="${FUR}" opacity=".7"/>

    <!-- front paws, toes out -->
    <g>
      <ellipse cx="-21" cy="84" rx="15" ry="10" fill="${FUR}"/>
      <ellipse cx="21" cy="84" rx="15" ry="10" fill="${FUR}"/>
      <g stroke="${FUR_DEEP}" stroke-width="2" stroke-linecap="round" opacity=".8">
        <path d="M-27 81 v6 M-21 80 v7 M-15 81 v6"/>
        <path d="M15 81 v6 M21 80 v7 M27 81 v6"/>
      </g>
    </g>

    <!-- the ruff: the scalloped collar of fur that says "Persian" -->
    <path d="M-58 16 q-10 20 2 32 q-12 6 -6 18 q16 10 30 4 q16 10 32 4
             q16 4 28 -12 q2 -12 -8 -14 q14 -12 4 -32z"
          fill="${FUR}"/>
    <path d="M-52 30 q10 12 24 10 M52 30 q-10 12 -24 10"
          fill="none" stroke="${FUR_DEEP}" stroke-width="3" stroke-linecap="round" opacity=".55"/>

    <!-- ears: high, wide apart, with pink inners and real tufts -->
    <g>
      <path d="M-60 -18 q-10 -44 4 -56 q14 6 28 32z" fill="${FUR_DEEP}"/>
      <path d="M60 -18 q10 -44 -4 -56 q-14 6 -28 32z" fill="${FUR_DEEP}"/>
      <path d="M-54 -22 q-7 -32 2 -41 q10 6 20 26z" fill="${BLUSH}" opacity=".6"/>
      <path d="M54 -22 q7 -32 -2 -41 q-10 6 -20 26z" fill="${BLUSH}" opacity=".6"/>
      <g stroke="${FUR}" stroke-width="3.4" stroke-linecap="round">
        <path d="M-52 -64 l-9 -12 M-44 -70 l-3 -14"/>
        <path d="M52 -64 l9 -12 M44 -70 l3 -14"/>
      </g>
    </g>

    <!-- the head: very round, very wide, sitting low -->
    <ellipse cx="0" cy="-12" rx="62" ry="54" fill="${FUR}"/>
    <!-- cheek floof, so the outline is not a clean oval -->
    <ellipse cx="-50" cy="4" rx="20" ry="17" fill="${FUR}"/>
    <ellipse cx="50" cy="4" rx="20" ry="17" fill="${FUR}"/>
    <ellipse cx="-38" cy="-40" rx="17" ry="13" fill="${FUR}"/>
    <ellipse cx="38" cy="-40" rx="17" ry="13" fill="${FUR}"/>

    <!-- tabby markings on the forehead -->
    <g fill="${FUR_DEEP}" opacity=".75">
      <path d="M-20 -52 q6 -14 10 -2 q-6 -2 -10 2z"/>
      <path d="M0 -58 q6 -15 12 -2 q-7 -2 -12 2z"/>
      <path d="M20 -52 q7 -13 11 -1 q-7 -2 -11 1z"/>
    </g>

    <!-- blush -->
    <ellipse cx="-38" cy="8" rx="11" ry="6.5" fill="${BLUSH}" opacity=".5"/>
    <ellipse cx="38" cy="8" rx="11" ry="6.5" fill="${BLUSH}" opacity=".5"/>

    ${EYES[eyes] ?? EYES.open}
    ${lids(eyes)}

    <!-- muzzle: two soft pads, a nose, then the mouth -->
    <ellipse cx="-11" cy="18" rx="13" ry="10" fill="${FUR}"/>
    <ellipse cx="11" cy="18" rx="13" ry="10" fill="${FUR}"/>
    <path d="M-7 9 h14 l-7 7z" fill="${BLUSH}"/>
    ${MOUTHS[mouth] ?? MOUTHS.w}

    <!-- whiskers -->
    <g stroke="${FUR_DARK}" stroke-width="2" stroke-linecap="round" opacity=".6">
      <path d="M-30 14 l-30 -7 M-30 20 l-31 5"/>
      <path d="M30 14 l30 -7 M30 20 l31 5"/>
    </g>`;
}

/**
 * Eyelids, for blinking. Fur-coloured caps parked above open eyes at
 * scaleY(0); CSS drops them on an off-beat rhythm. Only drawn over eyes
 * that are actually open — blinking a closed eye is a glitch.
 */
function lids(eyes) {
  if (eyes !== 'open' && eyes !== 'wide') return '';
  const r = eyes === 'wide' ? 16.4 : 14.4;
  return `
    <g class="cat__lids" aria-hidden="true" fill="${FUR}">
      <rect class="cat__lid" x="${-24 - r}" y="-26" width="${r * 2}" height="22" rx="${r * 0.5}"/>
      <rect class="cat__lid" x="${24 - r}" y="-26" width="${r * 2}" height="22" rx="${r * 0.5}"/>
    </g>`;
}

/* ------------------------------------------------------------------ *
 * moods
 * ------------------------------------------------------------------ */

const MOODS = {
  sit: { body: {}, props: '' },

  /** Hello. One paw up, with a class so CSS can swing it. */
  wave: {
    body: { eyes: 'open', mouth: 'grin' },
    /* Raised beside the head, not resting on the chest — at chest height
       it read as a paw the kitten happened to be holding up. */
    props: `<g class="cat__wave">
      <path d="M46 52 q18 -16 24 -34" fill="none" stroke="${FUR_DEEP}"
            stroke-width="15" stroke-linecap="round"/>
      <ellipse cx="72" cy="12" rx="15" ry="12" fill="${FUR}" transform="rotate(-18 72 12)"/>
      <g stroke="${FUR_DEEP}" stroke-width="2.6" stroke-linecap="round" opacity=".8"
         transform="rotate(-18 72 12)">
        <path d="M64 4 v-6 M72 2 v-7 M80 4 v-6"/>
      </g>
    </g>`,
  },

  blink: { body: { eyes: 'shut', mouth: 'smile' }, props: '' },

  /** Asleep on something. */
  sleep: {
    body: { eyes: 'shut', mouth: 'flat' },
    props: `<g fill="${LINE}" opacity=".7" font-family="var(--font-display)">
      <text x="56" y="-42" font-size="20">z</text>
      <text x="74" y="-60" font-size="15">z</text>
      <text x="88" y="-74" font-size="11">z</text>
    </g>`,
  },

  /** Mid-stretch, front paws forward. */
  stretch: {
    body: { eyes: 'squint', mouth: 'o' },
    props: `<g stroke="${FUR_DEEP}" stroke-width="7" stroke-linecap="round" fill="none" opacity=".9">
      <path d="M-30 74 q-22 4 -34 -4"/><path d="M30 74 q22 4 34 -4"/>
    </g>`,
  },

  /** Pleased with itself. */
  cheer: {
    body: { eyes: 'squint', mouth: 'grin' },
    props: `<g stroke="${LINE}" stroke-width="3.2" stroke-linecap="round" opacity=".75">
      <path d="M-62 -40 l-11 -12 M0 -62 v-15 M62 -40 l11 -12"/>
    </g>
    <g fill="${FUR_DEEP}">
      <circle cx="-76" cy="-56" r="3.4"/><circle cx="2" cy="-82" r="3.4"/><circle cx="78" cy="-56" r="3.4"/>
    </g>`,
  },

  /** Unimpressed, while somebody panics. */
  deadpan: {
    body: { eyes: 'squint', mouth: 'flat' },
    props: '',
  },

  /* ── one per world ── */

  detective: {
    body: { eyes: 'squint', mouth: 'flat' },
    props: `<g transform="translate(0 -56)">
      <path d="M-38 6 q38 -30 76 0 q4 6 -5 7 h-66 q-9 -1 -5 -7z" fill="${LINE}" opacity=".85"/>
      <ellipse cx="0" cy="13" rx="48" ry="6" fill="${LINE}" opacity=".7"/>
    </g>
    <g transform="translate(52 34)" fill="none" stroke="${LINE}" stroke-width="4.6" opacity=".9">
      <circle cx="0" cy="0" r="16" fill="rgb(var(--world-glow) / .25)"/>
      <path d="M12 12 L28 28" stroke-linecap="round"/>
    </g>`,
  },

  /** Horror: hiding, but only just. */
  scared: {
    body: { eyes: 'wide', mouth: 'wobble' },
    props: `<g opacity=".8">
      <path d="M-62 34 q-14 -6 -12 -20" stroke="${FUR_DEEP}" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M62 34 q14 -6 12 -20" stroke="${FUR_DEEP}" stroke-width="5" fill="none" stroke-linecap="round"/>
    </g>
    <g fill="${LINE}" opacity=".5">
      <path d="M-70 -30 l-8 -8 M74 -28 l8 -8"/>
    </g>`,
  },

  smitten: {
    body: { eyes: 'hearts', mouth: 'smile' },
    props: `<g fill="${BLUSH}" opacity=".85">
      <path d="M62 -46 c-4 -4 -9 -1 -9 3 c0 4 6 7 9 10 c3 -3 9 -6 9 -10 c0 -4 -5 -7 -9 -3z"/>
      <path d="M-62 -34 c-3 -3 -7 -1 -7 2 c0 3 4 5 7 8 c3 -3 7 -5 7 -8 c0 -3 -4 -5 -7 -2z"/>
    </g>`,
  },

  /** Economics: tiny glasses, and a chart it is taking seriously. */
  professor: {
    body: { eyes: 'open', mouth: 'flat' },
    props: `<g fill="none" stroke="${LINE}" stroke-width="3" opacity=".85">
      <circle cx="-19" cy="-2" r="16"/><circle cx="19" cy="-2" r="16"/>
      <path d="M-3 -2 h6"/><path d="M-35 -6 l-14 -5"/><path d="M35 -6 l14 -5"/>
    </g>
    <g transform="translate(-74 30)">
      <rect width="42" height="32" rx="3" fill="rgb(var(--world-bg) / .8)" stroke="${LINE}" stroke-width="2"/>
      <path d="M6 26 l9 -11 8 6 9 -14" fill="none" stroke="rgb(var(--world-glow) / .95)" stroke-width="3"/>
    </g>`,
  },

  /** Gossip: leaning in. */
  whisper: {
    body: { eyes: 'wink', mouth: 'grin' },
    props: `<g transform="translate(54 -34)">
      <rect width="46" height="26" rx="13" fill="rgb(var(--world-glow) / .3)"/>
      <path d="M12 26 l-3 9 11 -9z" fill="rgb(var(--world-glow) / .3)"/>
      <g fill="rgb(var(--world-glow) / .95)">
        <circle cx="14" cy="13" r="2.8"/><circle cx="23" cy="13" r="2.8"/><circle cx="32" cy="13" r="2.8"/>
      </g>
    </g>`,
  },

  /** Nature: sitting in the leaves. */
  garden: {
    body: { eyes: 'squint', mouth: 'smile' },
    props: `<g fill="rgb(var(--world-glow) / .7)">
      <path d="M-70 68 q-6 -26 -26 -34 q6 26 26 34z"/>
      <path d="M70 68 q6 -26 26 -34 q-6 26 -26 34z"/>
      <path d="M-84 74 q14 -4 22 2 q-14 4 -22 -2z"/>
    </g>`,
  },

  /** Travel: a very small backpack. */
  explorer: {
    body: { eyes: 'open', mouth: 'smile' },
    props: `<g transform="translate(-62 26)">
      <rect width="30" height="36" rx="8" fill="${LINE}" opacity=".8"/>
      <rect x="6" y="8" width="18" height="12" rx="3" fill="rgb(var(--world-glow) / .8)"/>
    </g>`,
  },

  /** Fantasy. */
  wizard: {
    body: { eyes: 'squint', mouth: 'smile' },
    props: `<g transform="translate(0 -58)">
      <path d="M-30 8 L0 -58 L30 8z" fill="rgb(var(--world-glow) / .85)"/>
      <ellipse cx="0" cy="10" rx="38" ry="7" fill="rgb(var(--world-glow) / .7)"/>
      <circle cx="0" cy="-58" r="5" fill="${LINE}"/>
      <g fill="${LINE}" opacity=".55"><circle cx="-11" cy="-16" r="2.6"/><circle cx="12" cy="-30" r="2.6"/></g>
    </g>`,
  },

  /** Reading, with the book held up. */
  read: {
    body: { eyes: 'squint', mouth: 'smile' },
    props: `<g transform="translate(0 56)">
      <path d="M-44 0 h38 a7 7 0 0 1 7 7 v24 a7 7 0 0 0 -7 -6 h-38z" fill="${LINE}" opacity=".85"/>
      <path d="M44 0 h-38 a7 7 0 0 0 -7 7 v24 a7 7 0 0 1 7 -6 h38z" fill="${LINE}" opacity=".65"/>
    </g>`,
  },

  /** Thinking about it rather harder than required. */
  thinker: {
    body: { eyes: 'squint', mouth: 'flat' },
    props: `<g fill="none" stroke="rgb(var(--world-glow) / .8)" stroke-width="2.6">
      <circle cx="56" cy="-52" r="9"/><circle cx="74" cy="-68" r="5.5"/><circle cx="85" cy="-80" r="3"/>
    </g>`,
  },
};

/* ------------------------------------------------------------------ *
 * rendering
 * ------------------------------------------------------------------ */

/**
 * @param {string} mood  key from MOODS
 * @param {{size?: number, className?: string, label?: string, tint?: string}} options
 *        `tint` is a coat name from COATS. Omit it and she is cream.
 */
export function cat(mood = 'sit', { size = 96, className = '', label = '', tint = '' } = {}) {
  const spec = MOODS[mood] ?? MOODS.sit;
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  const coat = coatStyle(tint);
  return `<svg class="cat ${className}" ${a11y} viewBox="-100 -100 200 200"
    width="${size}" height="${size}"${coat ? ` style="${coat}"` : ''}>
    <g class="cat__body">${body(spec.body)}${spec.props}</g>
  </svg>`;
}

/**
 * Which cat lives in which world — coat as well as mood.
 *
 * Read from the world so a genre's shelf, its banner and its room all
 * get the same animal. Without the coat half of this, every kitten in
 * the app was the same cream Persian and a page of them read as one
 * sticker repeated.
 */
export function catCoatForWorld(worldId) {
  return getWorld(worldId)?.coat ?? 'cream';
}

export const CAT_MOODS = Object.keys(MOODS);

/**
 * Which mood the kitten wears in a given world.
 *
 * Read from the world itself (`cat:` in worlds.js) rather than from a
 * table kept here, so adding a world cannot leave the kitten standing in
 * it with the wrong face. Falls back to the mascot pose's rough
 * equivalent, then to sitting.
 */
const FROM_MASCOT = {
  detective: 'detective', ghost: 'scared', smitten: 'smitten', wizard: 'wizard',
  thinker: 'thinker', professor: 'professor', scholar: 'thinker', tea: 'whisper',
  astronaut: 'explorer', silly: 'cheer', read: 'read', sleep: 'sleep',
  cheer: 'cheer', shrug: 'deadpan', float: 'sit', wave: 'wave', peek: 'whisper',
};

export function catForWorld(worldId) {
  const world = getWorld(worldId);
  if (world?.cat && MOODS[world.cat]) return world.cat;
  const viaMascot = FROM_MASCOT[world?.mascot];
  return viaMascot && MOODS[viaMascot] ? viaMascot : 'sit';
}
