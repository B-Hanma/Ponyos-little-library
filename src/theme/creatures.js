/**
 * creatures.js — the little residents of each world.
 *
 * ── WHAT THESE ARE ────────────────────────────────────────────────
 * The backdrops in worlds.js are scenery: silhouettes and washes that
 * sit *behind* text without fighting it. These are different. They are
 * characters — drawn brighter, with faces, and they move on their own.
 * A horror shelf should not merely be dark; something should be drifting
 * through it looking slightly apologetic about the whole business.
 *
 * ── ORIGINAL, AND DELIBERATELY SO ─────────────────────────────────
 * Every creature here is built from circles, arcs and paths in this
 * file. Nothing is traced, photographed, or borrowed from a film, an
 * anime or a book cover. Where a genre has an obvious mascot in popular
 * culture, we drew the *feeling* instead: the horror ghost is a rounded
 * sheet with a wobbling hem and worried eyebrows, not anyone's ghost.
 *
 * ── ONE FAMILY ────────────────────────────────────────────────────
 * They all share `face()` — the same eye shapes and the same blush as
 * the kitten in ui/cat.js. That is what stops ten different
 * creatures from looking like ten different clip-art sets, and it is why
 * the mascot can turn up in any world and still belong there.
 *
 * ── COST ──────────────────────────────────────────────────────────
 * Each creature is one <svg> in an absolutely-positioned wrapper,
 * animated by CSS transforms only. A world shows between two and five.
 * They are decoration: pointer-events none, aria-hidden, and they are
 * removed entirely — not merely paused — when motion is switched off.
 */

const ink = (o = 1) => `rgb(var(--world-ink) / ${o})`;
const glow = (o = 1) => `rgb(var(--world-glow) / ${o})`;

/**
 * The shared face. Same vocabulary as the mascot: two eyes, an optional
 * mouth, and a blush. Everything below is built around one of these.
 *
 * @param {Object} options
 * @param {number} options.cx  centre of the face
 * @param {number} options.cy
 * @param {number} [options.gap]   distance between the eyes
 * @param {number} [options.r]     eye radius
 * @param {'open'|'shut'|'happy'|'wide'|'wink'} [options.eyes]
 * @param {'smile'|'o'|'wobble'|'none'} [options.mouth]
 * @param {boolean} [options.blush]
 */
function face({ cx, cy, gap = 9, r = 2.6, eyes = 'open', mouth = 'smile', blush = true }) {
  const lx = cx - gap / 2;
  const rx = cx + gap / 2;
  const dark = 'rgb(20 22 28 / .82)';

  let eyeMarkup = '';
  if (eyes === 'shut' || eyes === 'happy') {
    // Two upward arcs — the universal "eyes closed, content" face.
    const dir = eyes === 'happy' ? -1 : 1;
    eyeMarkup = `<g fill="none" stroke="${dark}" stroke-width="1.5" stroke-linecap="round">
      <path d="M${lx - r} ${cy} q${r} ${dir * -r * 1.4} ${r * 2} 0"/>
      <path d="M${rx - r} ${cy} q${r} ${dir * -r * 1.4} ${r * 2} 0"/>
    </g>`;
  } else if (eyes === 'wink') {
    eyeMarkup = `<circle cx="${lx}" cy="${cy}" r="${r}" fill="${dark}"/>
      <path d="M${rx - r} ${cy} q${r} ${-r * 1.4} ${r * 2} 0" fill="none" stroke="${dark}" stroke-width="1.5" stroke-linecap="round"/>`;
  } else {
    const rr = eyes === 'wide' ? r * 1.35 : r;
    eyeMarkup = `<circle cx="${lx}" cy="${cy}" r="${rr}" fill="${dark}"/>
      <circle cx="${rx}" cy="${cy}" r="${rr}" fill="${dark}"/>
      <circle cx="${lx + rr * 0.35}" cy="${cy - rr * 0.35}" r="${rr * 0.3}" fill="rgb(255 255 255 / .9)"/>
      <circle cx="${rx + rr * 0.35}" cy="${cy - rr * 0.35}" r="${rr * 0.3}" fill="rgb(255 255 255 / .9)"/>`;
  }

  let mouthMarkup = '';
  if (mouth === 'smile') {
    mouthMarkup = `<path d="M${cx - 2.6} ${cy + r + 2} q2.6 2.6 5.2 0" fill="none" stroke="${dark}" stroke-width="1.3" stroke-linecap="round"/>`;
  } else if (mouth === 'o') {
    mouthMarkup = `<ellipse cx="${cx}" cy="${cy + r + 3}" rx="1.9" ry="2.4" fill="${dark}"/>`;
  } else if (mouth === 'wobble') {
    mouthMarkup = `<path d="M${cx - 3} ${cy + r + 2.4} q1.5 1.8 3 0 q1.5 -1.8 3 0" fill="none" stroke="${dark}" stroke-width="1.3" stroke-linecap="round"/>`;
  }

  const blushMarkup = blush
    ? `<g fill="rgb(255 138 128 / .5)">
        <ellipse cx="${lx - r - 2.4}" cy="${cy + 2.6}" rx="2.6" ry="1.7"/>
        <ellipse cx="${rx + r + 2.4}" cy="${cy + 2.6}" rx="2.6" ry="1.7"/>
      </g>` : '';

  return eyeMarkup + mouthMarkup + blushMarkup;
}

/**
 * The creature catalogue.
 *
 * Each entry says how it is drawn, how big it wants to be, and how it
 * moves — `motion` is a CSS class defined in animations.css. Keeping the
 * movement in CSS rather than JS means a hundred of them would still
 * cost one compositor pass, and means the reduced-motion rules can stop
 * all of it in one place.
 */
export const CREATURES = {
  /* ── horror: cute, not gory. Apologetic rather than threatening. ── */
  ghost: {
    size: 62,
    motion: 'c-haunt',
    draw: () => `
      <svg viewBox="0 0 48 56" aria-hidden="true">
        <path d="M24 3c10 0 16 8 16 18v27c0 2-2.4 3-3.9 1.6l-3.4-3.2a2.4 2.4 0 0 0-3.3 0l-3 2.8a2.4 2.4 0 0 1-3.3 0l-3-2.8a2.4 2.4 0 0 0-3.3 0l-3.4 3.2C12 51.8 8 50.8 8 48.8V21C8 11 14 3 24 3Z"
              fill="rgb(255 255 255 / .82)" stroke="${ink(0.35)}" stroke-width="1"/>
        <path d="M17 15q3-3 6 0M25 15q3-3 6 0" fill="none" stroke="rgb(20 22 28 / .45)" stroke-width="1.2" stroke-linecap="round"/>
        ${face({ cx: 24, cy: 22, gap: 12, r: 3.1, eyes: 'wide', mouth: 'o' })}
      </svg>`,
  },
  bat: {
    size: 54,
    motion: 'c-flit',
    draw: () => `
      <svg viewBox="0 0 64 34" aria-hidden="true">
        <g fill="${ink(0.7)}">
          <path class="c-wing c-wing--l" d="M28 17C20 6 12 4 3 7c5 3 6 8 5 13 4-3 8-2 12 1Z"/>
          <path class="c-wing c-wing--r" d="M36 17C44 6 52 4 61 7c-5 3-6 8-5 13-4-3-8-2-12 1Z"/>
          <ellipse cx="32" cy="18" rx="7.5" ry="9"/>
          <path d="M26 11l2-6 3 5ZM38 11l-2-6-3 5Z"/>
        </g>
        ${face({ cx: 32, cy: 16, gap: 7, r: 2.2, eyes: 'open', mouth: 'smile' })}
      </svg>`,
  },

  /* ── mystery: the evidence has opinions. ── */
  sleuth: {
    size: 58,
    motion: 'c-peer',
    draw: () => `
      <svg viewBox="0 0 52 58" aria-hidden="true">
        <g fill="none" stroke="${ink(0.8)}" stroke-width="3.4">
          <circle cx="24" cy="22" r="16"/>
          <path d="M35 34 46 50" stroke-linecap="round" stroke-width="6"/>
        </g>
        <circle cx="24" cy="22" r="14" fill="${glow(0.16)}"/>
        ${face({ cx: 24, cy: 21, gap: 11, r: 3, eyes: 'open', mouth: 'smile' })}
      </svg>`,
  },
  note: {
    size: 46,
    motion: 'c-glide',
    draw: () => `
      <svg viewBox="0 0 46 40" aria-hidden="true">
        <path d="M3 20 43 3 26 37 21 25Z" fill="rgb(255 255 255 / .74)" stroke="${ink(0.35)}" stroke-width="1"/>
        <path d="M43 3 21 25" fill="none" stroke="${ink(0.3)}" stroke-width="1"/>
        ${face({ cx: 22, cy: 19, gap: 7, r: 2, eyes: 'open', mouth: 'smile', blush: false })}
      </svg>`,
  },

  /* ── romance ── */
  butterfly: {
    size: 44,
    motion: 'c-flutter',
    draw: () => `
      <svg viewBox="0 0 48 40" aria-hidden="true">
        <g fill="${glow(0.6)}" stroke="${ink(0.25)}" stroke-width="0.8">
          <path class="c-wing c-wing--l" d="M23 20C16 6 6 4 3 11c-3 7 6 13 20 9Z"/>
          <path class="c-wing c-wing--r" d="M25 20C32 6 42 4 45 11c3 7-6 13-20 9Z"/>
          <path class="c-wing c-wing--l" d="M23 21C17 30 9 34 6 29c-3-5 4-9 17-8Z" opacity=".8"/>
          <path class="c-wing c-wing--r" d="M25 21C31 30 39 34 42 29c3-5-4-9-17-8Z" opacity=".8"/>
        </g>
        <ellipse cx="24" cy="21" rx="2.6" ry="8" fill="${ink(0.72)}"/>
        <path d="M23 13q-3-6-6-7M25 13q3-6 6-7" fill="none" stroke="${ink(0.6)}" stroke-width="1.2" stroke-linecap="round"/>
        ${face({ cx: 24, cy: 15, gap: 4.4, r: 1.5, eyes: 'happy', mouth: 'none', blush: false })}
      </svg>`,
  },
  letterbird: {
    size: 50,
    motion: 'c-glide',
    draw: () => `
      <svg viewBox="0 0 52 40" aria-hidden="true">
        <path d="M6 12h34a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4Z"
              fill="rgb(255 250 246 / .84)" stroke="${ink(0.3)}" stroke-width="1"/>
        <path d="M2 16 23 28 44 16" fill="none" stroke="${ink(0.3)}" stroke-width="1"/>
        <path class="c-wing c-wing--r" d="M42 16c6-6 10-6 10-2s-4 8-10 8Z" fill="${glow(0.55)}"/>
        <path d="M23 8c0-4 5-4 5 0 0-4 5-4 5 0 0 4-5 7-5 7s-5-3-5-7Z" fill="rgb(255 138 128 / .78)"/>
        ${face({ cx: 22, cy: 26, gap: 8, r: 2.2, eyes: 'happy', mouth: 'smile' })}
      </svg>`,
  },

  /* ── fantasy ── */
  sprite: {
    size: 52,
    motion: 'c-orbit',
    draw: () => `
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 2 29 17 44 22 29 27 24 42 19 27 4 22 19 17Z" fill="${glow(0.7)}" stroke="${ink(0.22)}" stroke-width="0.8"/>
        ${face({ cx: 24, cy: 21, gap: 8, r: 2.4, eyes: 'happy', mouth: 'smile' })}
      </svg>`,
  },
  bookbird: {
    size: 58,
    motion: 'c-flit',
    draw: () => `
      <svg viewBox="0 0 60 40" aria-hidden="true">
        <g fill="rgb(255 252 246 / .8)" stroke="${ink(0.32)}" stroke-width="1">
          <path class="c-wing c-wing--l" d="M30 24 4 12q-2-1 0-2L30 18Z"/>
          <path class="c-wing c-wing--r" d="M30 24 56 12q2-1 0-2L30 18Z"/>
        </g>
        <path d="M30 17v9" stroke="${ink(0.45)}" stroke-width="2" stroke-linecap="round"/>
        <ellipse cx="30" cy="28" rx="7" ry="6" fill="${glow(0.4)}"/>
        ${face({ cx: 30, cy: 27, gap: 6, r: 2, eyes: 'open', mouth: 'smile' })}
      </svg>`,
  },

  /* ── psychology ── */
  thought: {
    size: 50,
    motion: 'c-drift',
    draw: () => `
      <svg viewBox="0 0 52 48" aria-hidden="true">
        <path d="M14 8h24a10 10 0 0 1 0 20h-9l-8 7v-7h-7a10 10 0 0 1 0-20Z"
              fill="rgb(255 255 255 / .78)" stroke="${ink(0.3)}" stroke-width="1"/>
        <circle cx="13" cy="39" r="4" fill="rgb(255 255 255 / .6)"/>
        <circle cx="7" cy="45" r="2.4" fill="rgb(255 255 255 / .45)"/>
        ${face({ cx: 26, cy: 17, gap: 10, r: 2.6, eyes: 'open', mouth: 'smile' })}
      </svg>`,
  },

  /* ── economics: a coin that has seen some things. ── */
  coinface: {
    size: 44,
    motion: 'c-roll',
    draw: () => `
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle cx="22" cy="22" r="19" fill="${glow(0.5)}" stroke="${ink(0.35)}" stroke-width="1.4"/>
        <circle cx="22" cy="22" r="14.5" fill="none" stroke="${ink(0.25)}" stroke-width="1"/>
        ${face({ cx: 22, cy: 21, gap: 9, r: 2.5, eyes: 'wink', mouth: 'smile' })}
      </svg>`,
  },

  /* ── japanese / korean, and the house world ── */
  koi: {
    size: 56,
    motion: 'c-swim',
    draw: () => `
      <svg viewBox="0 0 60 34" aria-hidden="true">
        <path d="M38 17c0-8-7-13-16-13S6 9 6 17s7 13 16 13 16-5 16-13Z" fill="${glow(0.6)}" stroke="${ink(0.25)}" stroke-width="0.9"/>
        <path class="c-tail" d="M38 17c6-6 14-9 20-8-4 4-4 12 0 16-6 1-14-2-20-8Z" fill="${glow(0.45)}"/>
        <path d="M20 5q4 5 0 10M28 6q3 4 0 9" fill="none" stroke="${ink(0.28)}" stroke-width="1.2"/>
        ${face({ cx: 15, cy: 16, gap: 7, r: 2.2, eyes: 'open', mouth: 'o' })}
      </svg>`,
  },
  leaf: {
    size: 40,
    motion: 'c-flutter',
    draw: () => `
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <path d="M20 3C32 11 34 26 20 37 6 26 8 11 20 3Z" fill="${glow(0.5)}" stroke="${ink(0.25)}" stroke-width="0.9"/>
        <path d="M20 5v30" fill="none" stroke="${ink(0.3)}" stroke-width="1"/>
        ${face({ cx: 20, cy: 19, gap: 7.5, r: 2.2, eyes: 'open', mouth: 'smile' })}
      </svg>`,
  },

  /* ── history ── */
  owl: {
    size: 54,
    motion: 'c-bob',
    draw: () => `
      <svg viewBox="0 0 48 52" aria-hidden="true">
        <path d="M24 6c11 0 18 9 18 21S35 48 24 48 6 39 6 27 13 6 24 6Z" fill="${ink(0.62)}"/>
        <path d="M9 10l7 6M39 10l-7 6" stroke="${ink(0.62)}" stroke-width="5" stroke-linecap="round"/>
        <circle cx="17" cy="23" r="7.5" fill="rgb(255 252 244 / .86)"/>
        <circle cx="31" cy="23" r="7.5" fill="rgb(255 252 244 / .86)"/>
        <circle cx="17" cy="23" r="3.2" fill="rgb(20 22 28 / .84)"/>
        <circle cx="31" cy="23" r="3.2" fill="rgb(20 22 28 / .84)"/>
        <path d="M24 28l-3.4 4h6.8Z" fill="rgb(255 176 92 / .92)"/>
        <path d="M14 38q10 6 20 0" fill="none" stroke="${ink(0.4)}" stroke-width="1.4"/>
      </svg>`,
  },

  /* ── science ── */
  atomling: {
    size: 56,
    motion: 'c-orbit',
    draw: () => `
      <svg viewBox="0 0 52 52" aria-hidden="true">
        <g fill="none" stroke="${glow(0.55)}" stroke-width="1.6">
          <ellipse cx="26" cy="26" rx="23" ry="9"/>
          <ellipse cx="26" cy="26" rx="23" ry="9" transform="rotate(60 26 26)"/>
          <ellipse cx="26" cy="26" rx="23" ry="9" transform="rotate(120 26 26)"/>
        </g>
        <circle cx="26" cy="26" r="10" fill="${glow(0.62)}" stroke="${ink(0.25)}" stroke-width="0.9"/>
        ${face({ cx: 26, cy: 25, gap: 8, r: 2.3, eyes: 'open', mouth: 'smile' })}
      </svg>`,
  },

  /* ── children's ── */
  sunny: {
    size: 56,
    motion: 'c-bob',
    draw: () => `
      <svg viewBox="0 0 56 56" aria-hidden="true">
        <g stroke="${glow(0.7)}" stroke-width="3" stroke-linecap="round">
          ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
    const r1 = 19; const r2 = 26;
    const rad = (a * Math.PI) / 180;
    return `<path d="M${(28 + Math.cos(rad) * r1).toFixed(1)} ${(28 + Math.sin(rad) * r1).toFixed(1)} L${(28 + Math.cos(rad) * r2).toFixed(1)} ${(28 + Math.sin(rad) * r2).toFixed(1)}"/>`;
  }).join('')}
        </g>
        <circle cx="28" cy="28" r="16" fill="${glow(0.62)}" stroke="${ink(0.2)}" stroke-width="0.9"/>
        ${face({ cx: 28, cy: 27, gap: 11, r: 2.8, eyes: 'happy', mouth: 'smile' })}
      </svg>`,
  },

  /* ── literary fiction: the one who has read everything ── */
  lamp: {
    size: 50,
    motion: 'c-bob',
    draw: () => `
      <svg viewBox="0 0 46 52" aria-hidden="true">
        <path d="M23 4 42 26H4Z" fill="${ink(0.6)}"/>
        <ellipse cx="23" cy="30" rx="12" ry="5" fill="${glow(0.55)}"/>
        <rect x="20.5" y="30" width="5" height="16" rx="2.5" fill="${ink(0.55)}"/>
        <rect x="11" y="45" width="24" height="5" rx="2.5" fill="${ink(0.6)}"/>
        ${face({ cx: 23, cy: 18, gap: 9, r: 2.4, eyes: 'happy', mouth: 'smile' })}
      </svg>`,
  },
};

/** Every creature name, for tests and for the docs. */
export const CREATURE_NAMES = Object.keys(CREATURES);
