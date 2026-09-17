/**
 * worlds.js — a different place to stand in, per genre.
 *
 * A world is a small stage set. Each one owns:
 *
 *   backdrop   original SVG scenery drawn behind everything
 *   props      a few larger silhouettes that sit in the corners
 *   particles  what drifts through the air, and how much of it
 *   greeting   what the library says when she arrives
 *   accent     the colour pair the rest of the UI borrows
 *
 * Everything is drawn from primitives — no photographs, no traced
 * artwork, nothing copyrighted. The scenes are deliberately silhouettes
 * and washes rather than illustration, so they can sit under text
 * without fighting it, and so a single set works in all four base
 * themes.
 *
 * ADDING A WORLD: append one entry here and point a genre at it in
 * genres.js. Nothing else in the app needs to change.
 */

/* Shared SVG helpers — keeps the scenes short and consistent. */
const ink = (o = 1) => `rgb(var(--world-ink) / ${o})`;
const glow = (o = 1) => `rgb(var(--world-glow) / ${o})`;

/** A row of book spines, used by several worlds. */
function shelf(y, x = 0, width = 340, seed = 3) {
  let out = '';
  let cursor = x;
  let i = 0;
  while (cursor < x + width) {
    const w = 9 + ((seed * (i + 3) * 7) % 13);
    const h = 44 + ((seed * (i + 5) * 11) % 30);
    const lean = i % 9 === 8 ? 'transform="rotate(9)" transform-origin="' + cursor + ' ' + (y) + '"' : '';
    out += `<rect x="${cursor}" y="${y - h}" width="${w}" height="${h}" rx="1.5" ${lean}/>`;
    cursor += w + 2.5;
    i += 1;
  }
  return `<g fill="${ink(0.5)}">${out}</g>
    <rect x="${x}" y="${y}" width="${width}" height="4" rx="1" fill="${ink(0.66)}"/>`;
}

export const WORLDS = {
  /* ─────────────────────────── the house world ─────────────────────── */
  tide: {
    name: 'The open shelf',
    greeting: 'The whole library, all at once.',
    mascot: 'float', cat: 'sit', coat: 'grey',
    particles: { kind: 'motes', count: 16 },
    cast: [{ kind: 'koi', count: 2 }, { kind: 'lamp', count: 1 }],
    backdrop: () => `
      <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMax slice">
        <defs>
          <radialGradient id="w-tide-lamp" cx="0.5" cy="0.5">
            <stop offset="0" stop-color="${glow(0.5)}"/>
            <stop offset="1" stop-color="${glow(0)}"/>
          </radialGradient>
        </defs>
        <ellipse cx="985" cy="300" rx="260" ry="230" fill="url(#w-tide-lamp)"/>
        <g opacity=".8">${shelf(560, 60, 400, 3)}</g>
        <g opacity=".55">${shelf(470, 110, 300, 7)}</g>
        <!-- a reading lamp -->
        <g fill="${ink(0.66)}" transform="translate(950 250)">
          <path d="M0 60 L34 0 L68 60 Z"/>
          <rect x="31" y="60" width="6" height="150" rx="3"/>
          <rect x="6" y="208" width="56" height="7" rx="3.5"/>
        </g>
        <!-- rain on the window -->
        <g stroke="${glow(0.35)}" stroke-width="2" stroke-linecap="round">
          <path d="M700 90 l-10 50M760 140 l-10 50M820 60 l-10 50M680 220 l-10 50M840 240 l-10 50"/>
        </g>
        <!-- a cup, steaming -->
        <g transform="translate(560 600)" fill="${ink(0.6)}">
          <path d="M0 0 h46 v20 a23 23 0 0 1 -46 0 Z"/>
          <path d="M46 4 a13 13 0 0 1 0 14" fill="none" stroke="${ink(0.6)}" stroke-width="4"/>
        </g>
        <g stroke="${glow(0.4)}" stroke-width="2.5" fill="none" stroke-linecap="round">
          <path d="M572 592 q8 -14 0 -26 q-8 -12 0 -22"/>
          <path d="M592 594 q8 -12 0 -22"/>
        </g>
      </svg>`,
    props: [],
  },

  /* ──────────────────────────────── MYSTERY ────────────────────────── */
  noir: {
    name: 'The case room',
    greeting: 'Detective Ponyo has entered the library.',
    mascot: 'detective', cat: 'detective', coat: 'tabby',
    particles: { kind: 'rain', count: 46 },
    cast: [{ kind: 'sleuth', count: 1 }, { kind: 'note', count: 3 }],
    backdrop: () => `
      <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMax slice">
        <!-- rain-streaked window -->
        <rect x="60" y="40" width="330" height="420" rx="6" fill="${glow(0.07)}" stroke="${ink(0.35)}" stroke-width="3"/>
        <path d="M225 40 v420 M60 250 h330" stroke="${ink(0.3)}" stroke-width="3"/>
        <!-- the corkboard: pins and string -->
        <g stroke="${glow(0.4)}" stroke-width="1.6" fill="none">
          <path d="M700 120 L860 210 L790 340 L940 280 L700 120"/>
          <path d="M860 210 L1010 150"/>
        </g>
        <g fill="${ink(0.55)}">
          <rect x="676" y="96" width="52" height="42" rx="2" transform="rotate(-6 702 117)"/>
          <rect x="836" y="188" width="52" height="42" rx="2" transform="rotate(5 862 209)"/>
          <rect x="766" y="318" width="52" height="42" rx="2" transform="rotate(-3 792 339)"/>
          <rect x="916" y="258" width="52" height="42" rx="2" transform="rotate(8 942 279)"/>
          <rect x="986" y="128" width="52" height="42" rx="2" transform="rotate(-7 1012 149)"/>
        </g>
        <g fill="${glow(0.75)}">
          <circle cx="702" cy="117" r="4"/><circle cx="862" cy="209" r="4"/>
          <circle cx="792" cy="339" r="4"/><circle cx="942" cy="279" r="4"/>
          <circle cx="1012" cy="149" r="4"/>
        </g>
        <!-- desk edge with a magnifying glass -->
        <rect x="0" y="600" width="1200" height="100" fill="${ink(0.5)}"/>
        <g transform="translate(200 520)" fill="none" stroke="${ink(0.8)}" stroke-width="7">
          <circle cx="46" cy="46" r="42" fill="${glow(0.1)}"/>
          <path d="M78 78 L126 126" stroke-linecap="round"/>
        </g>
        <!-- a fingerprint -->
        <g transform="translate(980 500)" fill="none" stroke="${glow(0.3)}" stroke-width="2.4">
          <path d="M0 40 a40 44 0 0 1 80 0"/><path d="M10 44 a30 34 0 0 1 60 0"/>
          <path d="M20 48 a20 24 0 0 1 40 0"/><path d="M30 52 a10 14 0 0 1 20 0"/>
        </g>
      </svg>`,
    props: [],
  },

  /* ──────────────────────────────── ROMANCE ────────────────────────── */
  ember: {
    name: 'The dangerous section',
    greeting: 'Oh no. Ponyo has entered the emotionally dangerous section.',
    mascot: 'smitten', cat: 'smitten', coat: 'cream',
    particles: { kind: 'petals', count: 26 },
    cast: [{ kind: 'butterfly', count: 3 }, { kind: 'letterbird', count: 1 }],
    backdrop: () => `
      <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMax slice">
        <defs>
          <radialGradient id="w-ember-soft" cx="0.5" cy="0.4">
            <stop offset="0" stop-color="${glow(0.4)}"/><stop offset="1" stop-color="${glow(0)}"/>
          </radialGradient>
        </defs>
        <ellipse cx="600" cy="220" rx="520" ry="300" fill="url(#w-ember-soft)"/>
        <!-- a garland of flowers along the top -->
        <g>
          <path d="M-20 60 q150 90 310 40 q170 -52 330 10 q160 62 320 -20 q90 -46 180 -10"
                fill="none" stroke="${ink(0.4)}" stroke-width="3"/>
          ${[40, 180, 330, 470, 620, 760, 900, 1040, 1160].map((x, i) => {
    const y = 58 + ((i * 37) % 44);
    return `<g transform="translate(${x} ${y})">
              ${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-9" rx="5.5" ry="9" fill="${glow(0.55)}" transform="rotate(${a})"/>`).join('')}
              <circle r="3.6" fill="${ink(0.75)}"/></g>`;
  }).join('')}
        </g>
        <!-- a love letter, opened -->
        <g transform="translate(120 430) rotate(-8)">
          <rect width="200" height="140" rx="4" fill="${glow(0.16)}" stroke="${ink(0.45)}" stroke-width="2.5"/>
          <path d="M0 0 L100 78 L200 0" fill="none" stroke="${ink(0.45)}" stroke-width="2.5"/>
          <g stroke="${ink(0.3)}" stroke-width="2.5" stroke-linecap="round">
            <path d="M28 96 h90M28 112 h130M28 128 h60"/>
          </g>
        </g>
        <!-- a sealed envelope with a heart -->
        <g transform="translate(920 470) rotate(7)">
          <rect width="170" height="118" rx="4" fill="${glow(0.12)}" stroke="${ink(0.45)}" stroke-width="2.5"/>
          <path d="M0 0 L85 66 L170 0" fill="none" stroke="${ink(0.45)}" stroke-width="2.5"/>
          <path d="M85 58 c-14 -14 -30 -4 -30 9 c0 14 18 22 30 32 c12 -10 30 -18 30 -32 c0 -13 -16 -23 -30 -9 z" fill="${glow(0.8)}"/>
        </g>
      </svg>`,
    props: [],
  },

  /* ──────────────────────────────── HORROR ─────────────────────────── */
  hollow: {
    name: 'The room with the lamp on',
    greeting: 'Ponyo… are you sure you want to open this shelf?',
    mascot: 'ghost', cat: 'scared', coat: 'smoke',
    particles: { kind: 'fog', count: 7 },
    cast: [{ kind: 'ghost', count: 3 }, { kind: 'bat', count: 2 }],
    backdrop: () => `
      <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMax slice">
        <defs>
          <radialGradient id="w-moon" cx="0.5" cy="0.5">
            <stop offset="0" stop-color="${glow(0.5)}"/><stop offset="0.45" stop-color="${glow(0.13)}"/>
            <stop offset="1" stop-color="${glow(0)}"/>
          </radialGradient>
        </defs>
        <circle cx="980" cy="150" r="230" fill="url(#w-moon)"/>
        <circle cx="980" cy="150" r="58" fill="${glow(0.5)}"/>
        <circle cx="1002" cy="134" r="52" fill="rgb(var(--world-bg) / .95)"/>
        <!-- a leaning bookcase -->
        <g transform="translate(70 120) rotate(-2)" opacity=".92">
          <rect x="-14" y="-14" width="360" height="470" rx="4" fill="none" stroke="${ink(0.55)}" stroke-width="5"/>
          ${shelf(150, 6, 320, 5)}${shelf(300, 6, 320, 11)}${shelf(450, 6, 320, 2)}
        </g>
        <!-- cobwebs in two corners -->
        <g fill="none" stroke="${glow(0.24)}" stroke-width="1.6">
          <path d="M0 0 L120 0 M0 0 L85 85 M0 0 L0 120"/>
          <path d="M34 0 q-8 22 -24 34 M62 0 q-14 40 -44 62 M92 0 q-20 58 -64 88"/>
          <g transform="translate(1200 0) scale(-1 1)">
            <path d="M0 0 L100 0 M0 0 L70 70 M0 0 L0 100"/>
            <path d="M30 0 q-7 18 -20 28 M54 0 q-12 34 -38 52"/>
          </g>
        </g>
        <!-- floating candles -->
        ${[[470, 300], [600, 210], [720, 330], [545, 400]].map(([x, y], i) => `
          <g transform="translate(${x} ${y})" class="w-candle" style="--d:${i * 1.3}s">
            <rect x="-9" y="0" width="18" height="46" rx="3" fill="${ink(0.62)}"/>
            <ellipse cx="0" cy="-12" rx="6" ry="13" fill="${glow(0.85)}"/>
            <ellipse cx="0" cy="-9" rx="2.6" ry="7" fill="rgb(var(--world-bg) / .6)"/>
            <ellipse cx="0" cy="-12" rx="30" ry="34" fill="${glow(0.11)}"/>
          </g>`).join('')}
        <!-- two pairs of eyes under the shelf -->
        <g fill="${glow(0.7)}">
          <ellipse cx="180" cy="628" rx="9" ry="6"/><ellipse cx="212" cy="628" rx="9" ry="6"/>
          <ellipse cx="900" cy="600" rx="7" ry="5"/><ellipse cx="926" cy="600" rx="7" ry="5"/>
        </g>
        <!-- bats -->
        <g fill="${ink(0.66)}">
          ${[[330, 90, 1], [400, 140, 0.75], [268, 168, 0.55]].map(([x, y, s], i) => `
            <g transform="translate(${x} ${y}) scale(${s})" class="w-bat" style="--d:${i * 0.7}s">
              <path d="M0 0 q-16 -12 -34 -6 q12 4 14 14 q10 -8 20 -2 q10 -6 20 2 q2 -10 14 -14 q-18 -6 -34 6z"/>
            </g>`).join('')}
        </g>
      </svg>`,
    props: [],
  },

  /* ──────────────────────────────── FANTASY ────────────────────────── */
  arcane: {
    name: 'The enchanted stacks',
    greeting: 'Reality has been temporarily suspended.',
    mascot: 'wizard', cat: 'wizard', coat: 'ink',
    particles: { kind: 'sparks', count: 34 },
    cast: [{ kind: 'sprite', count: 3 }, { kind: 'bookbird', count: 2 }],
    backdrop: () => `
      <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMax slice">
        <defs>
          <radialGradient id="w-door" cx="0.5" cy="0.5">
            <stop offset="0" stop-color="${glow(0.55)}"/><stop offset="1" stop-color="${glow(0)}"/>
          </radialGradient>
        </defs>
        <!-- a magic door standing open -->
        <g transform="translate(830 190)">
          <ellipse cx="110" cy="230" rx="180" ry="210" fill="url(#w-door)"/>
          <path d="M20 440 V110 a90 90 0 0 1 180 0 V440 Z" fill="${glow(0.13)}" stroke="${ink(0.6)}" stroke-width="5"/>
          <path d="M110 440 V20" stroke="${ink(0.35)}" stroke-width="3"/>
        </g>
        <!-- floating books -->
        ${[[180, 250, -14, 1], [330, 170, 10, 0.8], [250, 400, 6, 0.9], [430, 320, -8, 0.7], [110, 420, 12, 0.66]]
    .map(([x, y, r, s], i) => `
          <g transform="translate(${x} ${y}) rotate(${r}) scale(${s})" class="w-floatbook" style="--d:${i * 0.9}s">
            <path d="M0 0 h54 a10 10 0 0 1 10 10 v46 a10 10 0 0 0 -10 -8 H0z" fill="${ink(0.6)}"/>
            <path d="M128 0 H74 a10 10 0 0 0 -10 10 v46 a10 10 0 0 1 10 -8 h54z" fill="${ink(0.46)}"/>
            <path d="M64 10 v46" stroke="${glow(0.5)}" stroke-width="2.5"/>
          </g>`).join('')}
        <!-- glowing runes in a ring -->
        <g transform="translate(600 480)" opacity=".7">
          <circle r="120" fill="none" stroke="${glow(0.28)}" stroke-width="2" stroke-dasharray="6 12"/>
          <circle r="86" fill="none" stroke="${glow(0.2)}" stroke-width="1.5"/>
          ${[0, 60, 120, 180, 240, 300].map((a) => `
            <g transform="rotate(${a}) translate(0 -120)">
              <path d="M-7 -9 L7 -9 M0 -9 L0 9 M-6 9 L6 4" stroke="${glow(0.75)}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
            </g>`).join('')}
        </g>
        <!-- stars -->
        <g fill="${glow(0.66)}">
          ${[[90, 80, 3], [240, 60, 2], [520, 110, 2.6], [660, 60, 1.8], [400, 40, 2.2], [1130, 420, 2.4], [60, 560, 2], [1160, 90, 2.6]]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}
        </g>
      </svg>`,
    props: [],
  },

  /* ─────────────────────────────── DYSTOPIAN ───────────────────────── */
  /**
   * Split out of the fantasy world, which it never belonged in. A
   * dystopia is not enchanted — it is administrated. Everything here is
   * signage, surveillance and infrastructure: a watching eye on a
   * tower, a perimeter fence, notices nobody reads, and chimneys on the
   * horizon. Her own subject is in the skyline on purpose.
   */
  dystopia: {
    name: 'The permitted zone',
    greeting: 'Reading this for fun is a choice, and you made it.',
    mascot: 'shrug', cat: 'deadpan', coat: 'smoke',
    particles: { kind: 'ash', count: 30 },
    cast: [{ kind: 'note', count: 2 }, { kind: 'bat', count: 1 }],
    backdrop: () => `
      <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMax slice">
        <defs>
          <radialGradient id="w-eye" cx="0.5" cy="0.5">
            <stop offset="0" stop-color="${glow(0.5)}"/><stop offset="1" stop-color="${glow(0)}"/>
          </radialGradient>
        </defs>

        <!-- chimneys on the horizon, with what comes out of them -->
        <g fill="${ink(0.42)}">
          <rect x="60" y="300" width="42" height="300"/>
          <rect x="128" y="360" width="34" height="240"/>
          <rect x="1040" y="330" width="46" height="270"/>
        </g>
        <g fill="${ink(0.2)}">
          <ellipse cx="82" cy="284" rx="56" ry="26"/>
          <ellipse cx="120" cy="248" rx="78" ry="32"/>
          <ellipse cx="1062" cy="312" rx="60" ry="26"/>
        </g>

        <!-- the tower, and the thing on top of it that is looking back -->
        <g transform="translate(880 120)">
          <ellipse cx="0" cy="66" rx="190" ry="150" fill="url(#w-eye)"/>
          <path d="M-46 520 L-16 120 h32 L46 520 Z" fill="${ink(0.6)}"/>
          <ellipse cx="0" cy="66" rx="62" ry="34" fill="${ink(0.72)}"/>
          <ellipse class="w-eye" cx="0" cy="66" rx="30" ry="30" fill="${glow(0.85)}"/>
          <circle cx="0" cy="66" r="12" fill="${ink(0.9)}"/>
        </g>

        <!-- perimeter fence -->
        <g stroke="${ink(0.5)}" stroke-width="3">
          <path d="M0 596 H1200"/>
          ${Array.from({ length: 26 }, (_, i) => `<path d="M${i * 48} 596 V520"/>`).join('')}
          <path d="M0 540 H1200" stroke-dasharray="14 10" opacity=".7"/>
        </g>

        <!-- notices nobody reads -->
        ${[[250, 400, -4], [400, 360, 5], [560, 420, -2]].map(([x, y, r]) => `
          <g transform="translate(${x} ${y}) rotate(${r})">
            <rect width="92" height="116" rx="3" fill="${ink(0.3)}" stroke="${ink(0.55)}" stroke-width="2.5"/>
            <path d="M14 26 h64 M14 46 h64 M14 66 h44" stroke="${ink(0.6)}" stroke-width="4" stroke-linecap="round"/>
            <path d="M46 84 v18 M38 92 h16" stroke="${glow(0.7)}" stroke-width="4" stroke-linecap="round"/>
          </g>`).join('')}
      </svg>`,
    props: [],
  },

  /* ─────────────────────────────── MYTHOLOGY ───────────────────────── */
  /**
   * Also split out — it was sharing the history world, and a myth is not
   * a document. Scrolls, a pillared doorway, a constellation figure
   * drawn in the sky, and one very large hand.
   */
  myth: {
    name: 'The old stories',
    greeting: 'Gods behaving badly, retold with sympathy.',
    mascot: 'scholar', cat: 'explorer', coat: 'ginger',
    particles: { kind: 'stars', count: 30 },
    cast: [{ kind: 'owl', count: 1 }, { kind: 'letterbird', count: 2 }],
    backdrop: () => `
      <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMax slice">
        <!-- a constellation figure, joined up -->
        <g stroke="${glow(0.42)}" stroke-width="2" fill="none">
          <path d="M120 120 L220 80 L300 150 L260 250 L150 240 Z"/>
          <path d="M300 150 L410 110"/>
        </g>
        <g fill="${glow(0.85)}">
          ${[[120, 120, 4], [220, 80, 3.2], [300, 150, 4.6], [260, 250, 3], [150, 240, 3.6], [410, 110, 3]]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}
        </g>

        <!-- a pillared doorway -->
        <g transform="translate(620 180)">
          <rect x="-10" y="0" width="360" height="34" rx="6" fill="${ink(0.55)}"/>
          <path d="M-30 0 L170 -54 L370 0 Z" fill="${ink(0.46)}"/>
          ${[0, 1, 2, 3].map((i) => `
            <g transform="translate(${18 + i * 100} 34)">
              <rect width="44" height="330" fill="${ink(0.5)}"/>
              <rect x="-6" y="-8" width="56" height="12" rx="3" fill="${ink(0.62)}"/>
              <path d="M12 10 v310 M22 10 v310 M32 10 v310" stroke="${ink(0.66)}" stroke-width="2"/>
            </g>`).join('')}
        </g>

        <!-- a scroll, half unrolled -->
        <g transform="translate(140 470)">
          <rect x="0" y="12" width="300" height="86" fill="${ink(0.34)}"/>
          <path d="M20 36 h250 M20 56 h250 M20 76 h170" stroke="${ink(0.6)}" stroke-width="4" stroke-linecap="round"/>
          <rect x="-16" y="0" width="30" height="110" rx="15" fill="${ink(0.62)}"/>
          <rect x="286" y="0" width="30" height="110" rx="15" fill="${ink(0.62)}"/>
        </g>

        <!-- a very large hand, reaching in from off-stage -->
        <g transform="translate(1010 430)" fill="${ink(0.4)}">
          <path d="M0 240 V90 a22 22 0 0 1 44 0 v-40 a22 22 0 0 1 44 0 v22 a22 22 0 0 1 44 0 v34
                   a22 22 0 0 1 40 12 v122 Z"/>
        </g>
      </svg>`,
    props: [],
  },

  /* ─────────────────────────────── PSYCHOLOGY ──────────────────────── */
  clarity: {
    name: 'The notebook',
    greeting: 'We are about to overthink this.',
    mascot: 'thinker', cat: 'thinker', coat: 'snow',
    particles: { kind: 'bubbles', count: 14 },
    cast: [{ kind: 'thought', count: 3 }],
    backdrop: () => `
      <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMax slice">
        <!-- ruled notebook paper -->
        <g stroke="${ink(0.16)}" stroke-width="1.5">
          ${Array.from({ length: 14 }, (_, i) => `<path d="M0 ${60 + i * 46} H1200"/>`).join('')}
        </g>
        <path d="M130 0 V700" stroke="${glow(0.4)}" stroke-width="2"/>
        <g fill="${ink(0.28)}">
          ${Array.from({ length: 12 }, (_, i) => `<circle cx="64" cy="${72 + i * 54}" r="7"/>`).join('')}
        </g>
        <!-- a neuron, drawn as a diagram -->
        <g transform="translate(860 300)" fill="none" stroke="${glow(0.5)}" stroke-width="2.4" stroke-linecap="round">
          <circle r="34" fill="${glow(0.14)}"/>
          <circle r="12" fill="${glow(0.4)}"/>
          ${[20, 70, 130, 200, 250, 310].map((a) => `
            <g transform="rotate(${a})">
              <path d="M34 0 q40 -8 62 4 q22 12 46 2"/>
              <path d="M142 6 l16 -10 M142 6 l16 10"/>
            </g>`).join('')}
          <path d="M-34 4 q-70 10 -120 -6" stroke-width="3.4"/>
          <path d="M-154 -2 l-18 -14 M-154 -2 l-18 14"/>
        </g>
        <!-- sticky notes -->
        <g>
          <g transform="translate(240 160) rotate(-5)">
            <rect width="112" height="108" fill="${glow(0.3)}"/>
            <g stroke="${ink(0.4)}" stroke-width="2.5" stroke-linecap="round"><path d="M18 34 h74M18 54 h58M18 74 h68"/></g>
          </g>
          <g transform="translate(400 440) rotate(6)">
            <rect width="104" height="100" fill="${glow(0.2)}"/>
            <g stroke="${ink(0.36)}" stroke-width="2.5" stroke-linecap="round"><path d="M16 32 h68M16 52 h44"/></g>
          </g>
          <g transform="translate(180 470) rotate(3)">
            <rect width="96" height="94" fill="${glow(0.24)}"/>
            <g stroke="${ink(0.36)}" stroke-width="2.5" stroke-linecap="round"><path d="M16 30 h60M16 50 h52M16 70 h34"/></g>
          </g>
        </g>
        <!-- a thought trail leading off -->
        <g fill="${glow(0.3)}">
          <circle cx="560" cy="250" r="30"/><circle cx="614" cy="212" r="18"/>
          <circle cx="648" cy="186" r="11"/><circle cx="672" cy="168" r="6"/>
        </g>
      </svg>`,
    props: [],
  },

  /* ─────────────────────────── ECONOMICS / BUSINESS ────────────────── */
  ledger: {
    name: 'The trading floor',
    greeting: 'Welcome back, Professor Ponyo. Let us talk capitalism.',
    mascot: 'professor', cat: 'professor', coat: 'tabby',
    particles: { kind: 'coins', count: 12 },
    cast: [{ kind: 'coinface', count: 3 }],
    backdrop: () => `
      <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMax slice">
        <!-- newspaper columns -->
        <g>
          ${[60, 250, 440].map((x, c) => `
            <g transform="translate(${x} 70)">
              <rect width="150" height="16" rx="2" fill="${ink(0.42)}"/>
              <g stroke="${ink(0.18)}" stroke-width="2.2">
                ${Array.from({ length: 22 }, (_, i) => `<path d="M0 ${40 + i * 17} H${i % 6 === 5 ? 96 : 150}"/>`).join('')}
              </g>
            </g>`).join('')}
        </g>
        <path d="M232 60 V500 M422 60 V500" stroke="${ink(0.2)}" stroke-width="1.5"/>
        <!-- a chart on the board -->
        <g transform="translate(700 180)">
          <rect width="430" height="300" rx="6" fill="${glow(0.08)}" stroke="${ink(0.35)}" stroke-width="2.5"/>
          <g stroke="${ink(0.18)}" stroke-width="1.5">
            ${[60, 120, 180, 240].map((y) => `<path d="M20 ${y} H410"/>`).join('')}
          </g>
          <path d="M30 250 L100 210 L170 224 L240 150 L310 170 L390 70"
                fill="none" stroke="${glow(0.85)}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
          <path d="M30 250 L100 210 L170 224 L240 150 L310 170 L390 70 V280 H30 Z" fill="${glow(0.12)}"/>
          <g fill="${glow(0.9)}">
            <path d="M390 70 l-16 4 l6 -16 z"/>
          </g>
          <!-- candlesticks along the bottom -->
          <g>
            ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
    const x = 44 + i * 46;
    const up = i % 3 !== 1;
    const h = 26 + ((i * 13) % 34);
    return `<g stroke="${up ? glow(0.7) : ink(0.55)}" stroke-width="2.5">
                <path d="M${x} ${300 - h - 12} V${300 - 4}"/>
              </g><rect x="${x - 6}" y="${300 - h - 4}" width="12" height="${h - 10}" fill="${up ? glow(0.5) : ink(0.45)}"/>`;
  }).join('')}
          </g>
        </g>
        <!-- a stack of coins -->
        <g transform="translate(560 560)">
          ${[0, 1, 2, 3, 4].map((i) => `
            <ellipse cx="0" cy="${-i * 13}" rx="34" ry="11" fill="${glow(0.4)}" stroke="${ink(0.5)}" stroke-width="2"/>`).join('')}
        </g>
      </svg>`,
    props: [],
  },

  /* ────────────────────── JAPANESE & KOREAN LITERATURE ─────────────── */
  washi: {
    name: 'The quiet room',
    greeting: 'Quiet on the surface. Not quiet underneath.',
    mascot: 'tea', cat: 'blink', coat: 'snow',
    particles: { kind: 'petals', count: 18 },
    cast: [{ kind: 'koi', count: 2 }, { kind: 'leaf', count: 3 }],
    backdrop: () => `
      <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMax slice">
        <!-- paper screen grid -->
        <g stroke="${ink(0.2)}" stroke-width="2.5" fill="none">
          <rect x="60" y="40" width="420" height="500"/>
          <path d="M200 40 V540 M340 40 V540 M60 180 H480 M60 320 H480 M60 460 H480"/>
        </g>
        <rect x="60" y="40" width="420" height="500" fill="${glow(0.07)}"/>
        <!-- moon -->
        <circle cx="900" cy="170" r="92" fill="${glow(0.26)}"/>
        <circle cx="900" cy="170" r="92" fill="none" stroke="${glow(0.4)}" stroke-width="2"/>
        <!-- a single branch in blossom -->
        <g stroke="${ink(0.6)}" fill="none" stroke-linecap="round">
          <path d="M1200 420 q-150 -34 -250 -120 q-60 -52 -130 -66" stroke-width="6"/>
          <path d="M1010 356 q-30 -46 -84 -60" stroke-width="3.6"/>
          <path d="M1104 392 q-16 -50 -66 -76" stroke-width="3"/>
        </g>
        <g>
          ${[[820, 234], [930, 300], [1000, 352], [1084, 388], [944, 240], [1040, 318], [876, 268]]
    .map(([x, y], i) => `
            <g transform="translate(${x} ${y}) rotate(${i * 23})">
              ${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-8" rx="5" ry="8.5" fill="${glow(0.62)}" transform="rotate(${a})"/>`).join('')}
              <circle r="3" fill="${ink(0.5)}"/>
            </g>`).join('')}
        </g>
        <!-- rain, very fine -->
        <g stroke="${glow(0.22)}" stroke-width="1.4" stroke-linecap="round">
          ${Array.from({ length: 16 }, (_, i) => `<path d="M${90 + i * 26} ${70 + (i % 5) * 80} l-7 42"/>`).join('')}
        </g>
        <!-- teacup on a mat -->
        <g transform="translate(560 600)">
          <rect x="-56" y="34" width="150" height="8" rx="4" fill="${ink(0.35)}"/>
          <path d="M0 0 h56 v22 a28 28 0 0 1 -56 0 Z" fill="${ink(0.55)}"/>
          <g stroke="${glow(0.45)}" stroke-width="2.4" fill="none" stroke-linecap="round">
            <path d="M16 -10 q9 -15 0 -28"/><path d="M40 -8 q9 -13 0 -24"/>
          </g>
        </g>
      </svg>`,
    props: [],
  },

  /* ───────────────────── HISTORY, MYTHOLOGY, CLASSICS ──────────────── */
  foxed: {
    name: 'The map room',
    greeting: 'Everything that already happened, argued about again.',
    mascot: 'scholar', cat: 'read', coat: 'ginger',
    particles: { kind: 'motes', count: 20 },
    cast: [{ kind: 'owl', count: 1 }, { kind: 'note', count: 2 }],
    backdrop: () => `
      <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMax slice">
        <!-- an old map: coastline, latitude lines, rhumb lines -->
        <g stroke="${ink(0.22)}" stroke-width="1.4" fill="none">
          ${[120, 220, 320, 420, 520, 620].map((y) => `<path d="M0 ${y} H1200"/>`).join('')}
          ${[150, 350, 550, 750, 950, 1150].map((x) => `<path d="M${x} 0 V700"/>`).join('')}
        </g>
        <path d="M120 430 q80 -70 180 -50 q60 12 96 -30 q50 -58 140 -40 q80 16 120 -34 q46 -58 130 -30"
              fill="none" stroke="${ink(0.5)}" stroke-width="3.5"/>
        <path d="M120 430 q80 -70 180 -50 q60 12 96 -30 q50 -58 140 -40 q80 16 120 -34 q46 -58 130 -30 V700 H120 Z"
              fill="${ink(0.09)}"/>
        <!-- compass rose -->
        <g transform="translate(960 470)" fill="none" stroke="${glow(0.55)}" stroke-width="2.4">
          <circle r="76"/><circle r="56" stroke-dasharray="4 8"/>
          <g fill="${glow(0.45)}" stroke="none">
            <path d="M0 -88 L13 -14 L0 0 L-13 -14 Z"/><path d="M0 88 L13 14 L0 0 L-13 14 Z"/>
            <path d="M-88 0 L-14 13 L0 0 L-14 -13 Z"/><path d="M88 0 L14 13 L0 0 L14 -13 Z"/>
          </g>
        </g>
        <!-- two columns -->
        <g fill="${ink(0.4)}">
          ${[70, 1090].map((x) => `
            <g transform="translate(${x} 250)">
              <rect x="-34" y="-16" width="68" height="16" rx="3"/>
              <rect x="-26" y="0" width="52" height="330"/>
              <rect x="-38" y="330" width="76" height="20" rx="3"/>
              <g stroke="${ink(0.22)}" stroke-width="2">
                <path d="M-14 6 V326 M0 6 V326 M14 6 V326"/>
              </g>
            </g>`).join('')}
        </g>
        <!-- an unrolled scroll -->
        <g transform="translate(380 560) rotate(-3)">
          <rect width="260" height="110" fill="${glow(0.12)}" stroke="${ink(0.4)}" stroke-width="2"/>
          <rect x="-14" y="-8" width="16" height="126" rx="8" fill="${ink(0.55)}"/>
          <rect x="258" y="-8" width="16" height="126" rx="8" fill="${ink(0.55)}"/>
          <g stroke="${ink(0.3)}" stroke-width="2.4" stroke-linecap="round">
            <path d="M26 34 h190M26 56 h150M26 78 h176"/>
          </g>
        </g>
      </svg>`,
    props: [],
  },

  /* ──────────────────────────────── SCIENCE ────────────────────────── */
  cosmos: {
    name: 'The observatory',
    greeting: 'The universe, explained slowly and patiently.',
    mascot: 'astronaut', cat: 'thinker', coat: 'ink',
    particles: { kind: 'stars', count: 40 },
    cast: [{ kind: 'atomling', count: 2 }, { kind: 'sprite', count: 2 }],
    backdrop: () => `
      <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMax slice">
        <!-- a constellation, joined up -->
        <g stroke="${glow(0.35)}" stroke-width="1.6" fill="none">
          <path d="M150 140 L260 210 L360 160 L470 250 L610 200 L700 300"/>
          <path d="M260 210 L300 340 L430 380 L470 250"/>
        </g>
        <g fill="${glow(0.85)}">
          ${[[150, 140, 4.5], [260, 210, 3.4], [360, 160, 3], [470, 250, 4], [610, 200, 3.2], [700, 300, 2.6], [300, 340, 3], [430, 380, 3.6]]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}
        </g>
        <!-- an atom / orbit diagram -->
        <g transform="translate(940 380)" fill="none" stroke="${glow(0.45)}" stroke-width="2.2">
          <ellipse rx="130" ry="50"/>
          <ellipse rx="130" ry="50" transform="rotate(60)"/>
          <ellipse rx="130" ry="50" transform="rotate(120)"/>
          <circle r="16" fill="${glow(0.6)}" stroke="none"/>
          <circle cx="130" cy="0" r="7" fill="${glow(0.9)}" stroke="none"/>
          <circle cx="-65" cy="112" r="6" fill="${glow(0.75)}" stroke="none"/>
          <circle cx="-65" cy="-112" r="6" fill="${glow(0.75)}" stroke="none"/>
        </g>
        <!-- a molecule chain -->
        <g transform="translate(140 520)" stroke="${ink(0.5)}" stroke-width="3" fill="none">
          <path d="M0 0 L60 -34 L120 0 L180 -34 L240 0"/>
          <path d="M60 -34 V-96 M180 -34 V-96"/>
        </g>
        <g fill="${ink(0.66)}">
          ${[[140, 520], [200, 486], [260, 520], [320, 486], [380, 520], [200, 424], [320, 424]]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11"/>`).join('')}
        </g>
        <!-- a page of working -->
        <g transform="translate(600 500) rotate(-4)">
          <rect width="210" height="150" rx="3" fill="${glow(0.1)}" stroke="${ink(0.3)}" stroke-width="2"/>
          <g stroke="${ink(0.32)}" stroke-width="2.4" stroke-linecap="round" fill="none">
            <path d="M24 42 h60 M100 42 h14 M130 42 h56"/>
            <path d="M24 78 h40 M80 78 h14 M110 78 h76"/>
            <path d="M24 114 h100"/>
            <path d="M100 36 v12 M94 42 h12"/>
          </g>
        </g>
      </svg>`,
    props: [],
  },

  /* ────────────────────────── CHILDREN'S / HUMOUR ──────────────────── */
  sunny: {
    name: 'The fun shelf',
    greeting: 'We are temporarily suspending intellectual analysis.',
    mascot: 'silly', cat: 'cheer', coat: 'ginger',
    particles: { kind: 'confetti', count: 30 },
    cast: [{ kind: 'sunny', count: 1 }, { kind: 'butterfly', count: 2 }, { kind: 'bookbird', count: 1 }],
    backdrop: () => `
      <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMax slice">
        <defs>
          <radialGradient id="w-sun" cx="0.5" cy="0.5">
            <stop offset="0" stop-color="${glow(0.5)}"/><stop offset="1" stop-color="${glow(0)}"/>
          </radialGradient>
        </defs>
        <circle cx="200" cy="140" r="220" fill="url(#w-sun)"/>
        <circle cx="200" cy="140" r="64" fill="${glow(0.6)}"/>
        <g stroke="${glow(0.5)}" stroke-width="6" stroke-linecap="round">
          ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `
            <path d="M200 140 m0 -92 v-30" transform="rotate(${a} 200 140)"/>`).join('')}
        </g>
        <!-- bunting -->
        <path d="M0 60 q300 90 600 30 q300 -60 600 40" fill="none" stroke="${ink(0.4)}" stroke-width="3"/>
        ${Array.from({ length: 14 }, (_, i) => {
    const x = 50 + i * 84;
    const y = 62 + Math.sin(i / 1.9) * 26 + (i > 7 ? 14 : 0);
    return `<path d="M${x} ${y} l22 0 l-11 30 z" fill="${i % 2 ? glow(0.55) : ink(0.45)}"/>`;
  }).join('')}
        <!-- a happy pile of books -->
        <g transform="translate(760 430)">
          ${[0, 1, 2, 3].map((i) => `
            <rect x="${i * 6 - 10}" y="${-i * 34}" width="${210 - i * 14}" height="30" rx="4"
                  fill="${i % 2 ? glow(0.4) : ink(0.5)}" transform="rotate(${(i % 2 ? 2 : -2)} 100 ${-i * 34 + 15})"/>`).join('')}
        </g>
      </svg>`,
    props: [],
  },
};

export const WORLD_IDS = Object.keys(WORLDS);
export const HOUSE_WORLD = 'tide';

export function getWorld(id) {
  return WORLDS[id] ?? WORLDS[HOUSE_WORLD];
}
