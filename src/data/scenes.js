/**
 * scenes.js — her artwork, cut into the scenes that are actually in it.
 *
 * ── WHY CROPS AND NOT FILES ───────────────────────────────────────
 * Every file in `assets/ponyo/` is a COLLAGE: eight or ten separate
 * little scenes laid out in a grid, and two of them are full mockups of
 * this very website. Dropping one of those on a page whole would put a
 * picture of a website inside the website, and dropping a ten-panel
 * grid into a hero slot shows nine scenes nobody asked for.
 *
 * So the unit here is not the file. It is the PANEL. Each entry below is
 * a rectangle inside a file, expressed in fractions of that file so it
 * survives any future re-export at a different size, plus the roles that
 * panel is right for.
 *
 * ── ROLES, NOT FILENAMES ──────────────────────────────────────────
 * Nothing in the UI ever names a file. A view asks for a role — `hero`,
 * `economics`, `gossip`, `cosy` — and gets a scene. That is what lets
 * artwork be added later without touching a single view.
 *
 * ── ADDING ARTWORK LATER ──────────────────────────────────────────
 * Drop files in `assets/ponyo/`, run `tools/import-ponyo-images.ps1`,
 * and they are picked up immediately as whole-image scenes tagged
 * `any` — usable everywhere, cropped by nothing. To give a new collage
 * proper panels, add an entry to CROPS keyed by its filename. That is
 * the only edit, and it is data, not logic.
 */

/** Roles the UI can ask for. Anything not listed falls back to `any`. */
export const ROLE = Object.freeze({
  HERO: 'hero',              // the landing page
  COSY: 'cosy',              // reading, blankets, a cat asleep
  RESEARCH: 'research',      // notebooks, data, the desk
  ECONOMICS: 'economics',    // charts, policy, a laptop that means it
  ENVIRONMENT: 'environment',// outdoors, plants, the actual planet
  GOSSIP: 'gossip',          // tea, friends, information
  TRAVEL: 'travel',          // elsewhere, with a backpack
  TIRED: 'tired',            // asleep on the keyboard
  CAT: 'cat',                // her and a cat, specifically
  SHELVES: 'shelves',        // books, in bulk
  LIBRARY: 'library',        // the building itself
  DNA: 'dna',
  NUMBERS: 'numbers',
  SURPRISE: 'surprise',
  KITTEN: 'kitten',          // the kitten on its own, waving
  ANY: 'any',

  /* one per genre world */
  HORROR: 'horror',
  MYSTERY: 'mystery',
  ROMANCE: 'romance',
  LITERARY: 'literary',
  PSYCHOLOGY: 'psychology',
  BUSINESS: 'business',
  NATURE: 'nature',
  SCIENCE: 'science',
  HISTORY: 'history',
  CHILDREN: 'children',
  DYSTOPIAN: 'dystopian',
});

/**
 * Panels, keyed by filename.
 *
 * `[x, y, w, h]` are fractions of the source image: left, top, width,
 * height. Measured off the artwork by eye and then checked against a
 * rendered contact sheet — see `tools/scenes.html`, which lays every
 * crop out side by side so a bad rectangle is obvious at a glance
 * rather than three views later.
 */
const CROPS = {
  /*
    ── THE GENRE GRID ────────────────────────────────────────────────
    Sixteen scenes in a 4×4, one per world, and almost no slogan text in
    any of them — which makes this the most useful file in the folder.
    Every genre environment in the app is built on a panel from here.

    Rows and columns are inset slightly from the true boundaries so the
    thin white gutters between panels never creep into a crop.
  */
  'ponyo .png.png': [
    // row 1
    { id: 'g-cosy', box: [0.005, 0.005, 0.213, 0.230], roles: ['cosy', 'hero'], hasCat: true,
      alt: 'Ponyo curled up among cushions and books with a sleeping kitten' },
    { id: 'g-desk', box: [0.232, 0.005, 0.240, 0.230], roles: ['research', 'business', 'hero'], hasCat: true,
      alt: 'Ponyo at a laptop by a city window, books stacked beside her' },
    { id: 'g-travel', box: [0.486, 0.005, 0.236, 0.230], roles: ['travel'], hasCat: true,
      alt: 'Ponyo on a coastal path with a kitten riding in her backpack' },
    { id: 'g-gossip', box: [0.734, 0.005, 0.260, 0.230], roles: ['gossip'], hasCat: true,
      alt: 'Ponyo and two cats at a table under a Gossip Corner sign' },

    // row 2
    { id: 'g-mystery', box: [0.005, 0.258, 0.213, 0.225], roles: ['mystery'], hasCat: true,
      alt: 'Ponyo behind a magnifying glass, a corkboard of clues behind her, a kitten in a deerstalker' },
    { id: 'g-horror', box: [0.232, 0.258, 0.240, 0.225], roles: ['horror'], hasCat: true,
      alt: 'Ponyo hiding under a blanket with a frightened kitten, candles and a shape in the dark' },
    { id: 'g-nature', box: [0.486, 0.258, 0.236, 0.225], roles: ['nature', 'environment'], hasCat: true,
      alt: 'Ponyo asleep over her books surrounded by leaves and flowers' },
    { id: 'g-psych', box: [0.734, 0.258, 0.260, 0.225], roles: ['psychology'], hasCat: true,
      alt: 'Ponyo writing at a desk under a wall of notes, a kitten watching her' },

    // row 3
    { id: 'g-science', box: [0.005, 0.505, 0.213, 0.218], roles: ['science'], hasCat: true,
      alt: 'Ponyo beside a telescope holding a small glowing planet, a kitten looking up' },
    { id: 'g-history', box: [0.232, 0.505, 0.240, 0.218], roles: ['history', 'myth'], hasCat: true,
      alt: 'Ponyo reading an old map among globes and antique books' },
    { id: 'g-romance', box: [0.486, 0.505, 0.236, 0.218], roles: ['romance'], hasCat: true,
      alt: 'Ponyo reading a letter by candlelight among flowers, a kitten asleep on the book' },
    { id: 'g-city', box: [0.734, 0.505, 0.260, 0.218], roles: ['business', 'economics'], hasCat: true,
      alt: 'Ponyo at a laptop with luggage beside her and a city skyline through the window' },

    // row 4
    { id: 'g-children', box: [0.005, 0.735, 0.213, 0.258], roles: ['children'], hasCat: true,
      alt: 'Ponyo among colourful picture books and toys, a kitten batting at a butterfly' },
    { id: 'g-literary', box: [0.232, 0.735, 0.240, 0.258], roles: ['literary', 'cosy'], hasCat: true,
      alt: 'Ponyo reading by lantern light at night, a kitten asleep on her books' },
    { id: 'g-corridor', box: [0.486, 0.735, 0.236, 0.258], roles: ['library'], hasCat: true,
      alt: 'Ponyo walking away down a long library corridor with a cat at her heel' },
    { id: 'g-night', box: [0.734, 0.735, 0.260, 0.258], roles: ['dystopian', 'numbers'], hasCat: true,
      alt: 'Ponyo at a laptop against a rainy night skyline' },
  ],

  /*
    Two more full mockups of this site. The hero and the five
    destination thumbnails are worth having; everything else in them is
    interface, which is why the crops are tight.
  */
  'ponyo2.png': [
    { id: 'm2-hero', box: [0.360, 0.060, 0.300, 0.450], roles: ['hero'], hasCat: true,
      alt: 'Ponyo at her desk with a sleeping cat, cherry blossom and a rainy city beyond the window' },
    { id: 'm2-corridor', box: [0.035, 0.590, 0.150, 0.160], roles: ['library'], hasCat: true,
      alt: 'A tall lamplit library corridor' },
    { id: 'm2-shelves', box: [0.218, 0.590, 0.150, 0.160], roles: ['shelves'], hasCat: true,
      alt: 'Ponyo reaching for a book on a high shelf' },
    { id: 'm2-dna', box: [0.402, 0.590, 0.152, 0.160], roles: ['dna'], hasCat: true,
      alt: 'Ponyo beside a glowing orb of constellations' },
    { id: 'm2-numbers', box: [0.590, 0.590, 0.152, 0.160], roles: ['numbers'], hasCat: true,
      alt: 'Ponyo writing beside glowing charts' },
    { id: 'm2-surprise', box: [0.782, 0.590, 0.152, 0.160], roles: ['surprise'], hasCat: true,
      alt: 'Ponyo and a kitten peering into a mystery box' },
  ],

  'ponyo 3.png': [
    { id: 'm3-hero', box: [0.275, 0.100, 0.340, 0.420], roles: ['hero'], hasCat: true,
      alt: 'Ponyo reading in a nest of blankets with a sleeping cat, a rainy city beyond' },
    { id: 'm3-corridor', box: [0.075, 0.588, 0.142, 0.128], roles: ['library'], hasCat: true,
      alt: 'Ponyo walking into a tall library with a cat beside her' },
    { id: 'm3-shelves', box: [0.253, 0.588, 0.150, 0.128], roles: ['shelves'], hasCat: true,
      alt: 'Ponyo choosing a book from a green, lamplit shelf' },
    { id: 'm3-dna', box: [0.443, 0.588, 0.133, 0.128], roles: ['dna'], hasCat: true,
      alt: 'Ponyo among floating glass spheres full of stars' },
    { id: 'm3-numbers', box: [0.618, 0.588, 0.144, 0.128], roles: ['numbers'], hasCat: true,
      alt: 'Ponyo writing at a desk lit by charts' },
    { id: 'm3-surprise', box: [0.803, 0.588, 0.142, 0.128], roles: ['surprise'], hasCat: true,
      alt: 'Ponyo and a kitten behind a box with a question mark on it' },
  ],

  'ponyo-library-world.png.png': [
    { id: 'a-walk', box: [0.000, 0.000, 0.180, 0.625], roles: ['travel', 'any'],
      alt: 'Ponyo walking outside, camera in hand' },
    { id: 'a-mirror', box: [0.181, 0.000, 0.150, 0.625], roles: ['any'],
      alt: 'Ponyo in an orange dress' },
    { id: 'a-desk', box: [0.333, 0.000, 0.354, 0.552], roles: ['research', 'economics', 'hero', 'numbers'],
      alt: 'Ponyo at her desk behind a stack of climate and economics books' },
    { id: 'a-gossip', box: [0.689, 0.000, 0.311, 0.552], roles: ['gossip'],
      alt: 'Ponyo and two friends mid-gossip' },
    { id: 'a-cliff', box: [0.000, 0.630, 0.127, 0.370], roles: ['travel', 'environment'],
      alt: 'Ponyo on a cliff path above the sea' },
    { id: 'a-cosy', box: [0.179, 0.576, 0.244, 0.424], roles: ['cosy', 'cat', 'shelves'],
      alt: 'Ponyo curled up with a white cat and a stack of books' },
    { id: 'a-sit', box: [0.427, 0.552, 0.163, 0.448], roles: ['any'],
      alt: 'Ponyo sitting, mid-sentence' },
    { id: 'a-tea', box: [0.589, 0.552, 0.241, 0.448], roles: ['tired', 'numbers', 'gossip'],
      alt: 'Ponyo behind a mug, a to-do list on the wall' },
    { id: 'a-sunset', box: [0.830, 0.552, 0.170, 0.448], roles: ['travel', 'any'],
      alt: 'Ponyo against a sunset skyline' },
  ],

  'ponyo-library-world.png (3).png': [
    { id: 'b-peacock', box: [0.000, 0.000, 0.225, 0.475], roles: ['any'],
      alt: 'Ponyo by a painted wall' },
    { id: 'b-write', box: [0.228, 0.000, 0.339, 0.475], roles: ['environment', 'research', 'hero'],
      alt: 'Ponyo writing outdoors beside a stack of climate books' },
    { id: 'b-field', box: [0.570, 0.000, 0.208, 0.475], roles: ['travel', 'research'],
      alt: 'Ponyo walking to fieldwork with rolled papers' },
    { id: 'b-tea', box: [0.781, 0.000, 0.219, 0.475], roles: ['gossip'],
      alt: 'Ponyo behind a "spill the tea" mug and a stack of books' },
    { id: 'b-model', box: [0.000, 0.479, 0.410, 0.267], roles: ['economics', 'research', 'numbers'],
      alt: 'Ponyo at a laptop under a board reading pollution, economy, real change' },
    { id: 'b-girltalk', box: [0.413, 0.479, 0.368, 0.267], roles: ['gossip'],
      alt: 'Ponyo and a friend whispering over a laptop' },
    { id: 'b-cathug', box: [0.784, 0.479, 0.216, 0.267], roles: ['cat', 'cosy'],
      alt: 'Ponyo hugging a very content grey cat' },
    { id: 'b-smoke', box: [0.000, 0.749, 0.339, 0.251], roles: ['environment'],
      alt: 'Ponyo with a notebook, looking out over chimneys' },
    { id: 'b-read', box: [0.342, 0.749, 0.329, 0.251], roles: ['cosy', 'cat', 'shelves'],
      alt: 'Ponyo reading in a warm room with a cat asleep on her books' },
    { id: 'b-asleep', box: [0.674, 0.749, 0.326, 0.251], roles: ['tired', 'numbers'],
      alt: 'Ponyo asleep at her laptop' },
  ],

  /*
    Two of the five files are full MOCKUPS of this website, complete with
    their own nav labels ("Shelves — Browse by genre"), their own little
    ">" buttons, and invented book counts ("32 books"). Those are the
    designer's placeholders, not data.

    So the crops below deliberately cut INSIDE each mocked-up card: past
    the label band at the top, and short of the button at the right. A
    contact sheet (tools/scenes.html) is what made that necessary to fix
    and easy to check — the first cut of these rectangles put a fake
    "Reading DNA — See what makes you, you" caption inside the real
    Reading DNA page, and a fake "28 books" beside a real count.
  */
  'ponyo-library-world.png (2).png': [
    { id: 'c-hero', box: [0.178, 0.050, 0.322, 0.395], roles: ['hero', 'cat', 'research'], hasCat: true,
      alt: 'Ponyo at her desk with two cats and a laptop' },
    { id: 'c-corridor', box: [0.006, 0.516, 0.166, 0.178], roles: ['library'],
      alt: 'A long library corridor' },
    { id: 'c-shelves', box: [0.223, 0.516, 0.148, 0.178], roles: ['shelves', 'library'],
      alt: 'Bookshelves with a cat asleep on a pile of books' },
    { id: 'c-dna', box: [0.418, 0.516, 0.146, 0.178], roles: ['dna', 'cosy'],
      alt: 'Ponyo reading with a kitten tucked against the book' },
    { id: 'c-numbers', box: [0.610, 0.516, 0.155, 0.178], roles: ['numbers', 'tired'],
      alt: 'Ponyo thinking at a laptop' },
    { id: 'c-surprise', box: [0.812, 0.516, 0.147, 0.178], roles: ['shelves', 'cat'],
      alt: 'Ponyo behind a tall stack of books with a cat' },
    { id: 'c-notebook', box: [0.072, 0.713, 0.384, 0.283], roles: ['research', 'economics'],
      alt: 'Ponyo writing in a notebook with a cat asleep beside her' },
  ],

  'ponyo-library-world.png (4).png': [
    /* x starts at .315, not .280: the mockup's own "Enter my library"
       button and its fine print sit just to the left, and the wider crop
       caught a sliver of both — a pink button fragment and the words
       "…device." floating at the edge of the real page. */
    { id: 'd-hero', box: [0.315, 0.078, 0.370, 0.645], roles: ['hero', 'cat', 'cosy'], hasCat: true,
      alt: 'Ponyo at a lamplit desk with a sleeping cat and a city window behind her' },
    { id: 'd-kitten', box: [0.000, 0.330, 0.150, 0.215], roles: ['kitten'],
      alt: 'A small Persian kitten waving' },
  ],

  'ponyo-library-world.png (5).png': [
    { id: 'e-hero', box: [0.020, 0.040, 0.420, 0.215], roles: ['hero', 'kitten'], hasCat: true,
      alt: 'Ponyo resting her chin on her hand while a kitten waves' },
    /*
      The genre strip. Each card in the mockup carries a name and a made-up
      count ("32 books") in a band across its bottom; the crops stop short
      of that band, because the real counts come from the catalogue and two
      different numbers on one card is worse than none.
    */
    { id: 'e-environment', box: [0.008, 0.306, 0.126, 0.166], roles: ['environment'],
      alt: 'Ponyo in the mountains with a cat' },
    { id: 'e-economics', box: [0.137, 0.306, 0.122, 0.166], roles: ['economics'],
      alt: 'Ponyo at a desk of charts with a cat' },
    { id: 'e-research', box: [0.262, 0.306, 0.119, 0.166], roles: ['research'],
      alt: 'Ponyo among research books under a climate sign' },
    { id: 'e-gossip', box: [0.383, 0.306, 0.117, 0.166], roles: ['gossip'],
      alt: 'Ponyo mid-thought with a laptop and a pen' },
    { id: 'e-fiction', box: [0.502, 0.306, 0.115, 0.166], roles: ['cosy'],
      alt: 'Ponyo holding a fluffy cat' },
    { id: 'e-horror', box: [0.621, 0.306, 0.118, 0.166], roles: ['horror'],
      alt: 'Ponyo hiding under a blanket with a kitten' },
    { id: 'e-selfhelp', box: [0.742, 0.306, 0.122, 0.166], roles: ['selfhelp'],
      alt: 'Ponyo sitting calmly in the light' },
    { id: 'e-travel', box: [0.867, 0.306, 0.123, 0.166], roles: ['travel'],
      alt: 'Ponyo with a backpack and a cat above a hillside town' },
    { id: 'e-library', box: [0.008, 0.521, 0.982, 0.189], roles: ['library'],
      alt: 'The inside of a warm, tall library with a kitten on the rug' },
    { id: 'e-dna', box: [0.010, 0.735, 0.250, 0.150], roles: ['dna'],
      alt: 'Ponyo thinking, a kitten on the desk' },
  ],
};

/* ─────────────────────────── the registry ────────────────────────── */

/** @type {Array<{id, file, src, box, roles, alt, ratio}>} */
let scenes = [];

/**
 * Build the scene list from whatever the manifest found.
 *
 * A file with panels registered above contributes one scene per panel.
 * A file nobody has cropped contributes one whole-image scene tagged
 * `any`, so new artwork is useful the moment it is dropped in — just
 * not yet placed with any care.
 */
export function buildScenes(portraits) {
  scenes = [];
  for (const portrait of portraits) {
    const panels = CROPS[portrait.file];
    if (panels) {
      for (const panel of panels) {
        scenes.push({
          id: panel.id,
          file: portrait.file,
          src: portrait.src,
          box: panel.box,
          roles: panel.roles,
          alt: panel.alt,
          /**
           * True when there is already a cat in the picture.
           *
           * The landing page draws its own kitten beside the hero, and
           * three of the hero panels already contain one — plus, in one
           * case, a hand-lettered "Hi Ponyo!". Drawing a second kitten
           * with a second greeting on top of that looked like a mistake,
           * because it was one.
           */
          hasCat: Boolean(panel.hasCat),
          // The panel's own aspect ratio, not the file's.
          ratio: portrait.ratio
            ? (portrait.ratio * panel.box[2]) / panel.box[3]
            : 0,
        });
      }
    } else {
      scenes.push({
        id: `whole:${portrait.file}`,
        file: portrait.file,
        src: portrait.src,
        box: [0, 0, 1, 1],
        roles: [ROLE.ANY],
        alt: portrait.alt,
        hasCat: false,
        ratio: portrait.ratio,
      });
    }
  }
  return scenes;
}

export function allScenes() { return scenes; }
export function sceneCount() { return scenes.length; }

/** Every scene that suits a role, best matches first. */
export function scenesFor(role) {
  if (!role || role === ROLE.ANY) return scenes;
  const exact = scenes.filter((s) => s.roles.includes(role));
  if (exact.length) return exact;
  // Nothing tagged for this role: fall back to anything general rather
  // than to nothing, so a new genre never renders an empty frame.
  return scenes.filter((s) => s.roles.includes(ROLE.ANY)) .concat(scenes).slice(0, scenes.length);
}

export function hasScene(role) { return scenesFor(role).length > 0; }

/**
 * One scene for a role, chosen from a token.
 *
 * Same token, same scene — so a re-render is stable while a new visit
 * moves along the list. Rotation rather than random: pure randomness
 * shows the same picture twice running often enough to look broken.
 */
export function sceneFor(role, token = '') {
  const pool = scenesFor(role);
  if (!pool.length) return null;
  return pool[hash(`${role}:${token}`) % pool.length];
}

/** Several distinct scenes for a role. Returns fewer rather than repeats. */
export function sceneSet(role, count, token = '') {
  const pool = scenesFor(role);
  if (!pool.length) return [];
  const start = hash(`${role}:${token}`) % pool.length;
  const out = [];
  for (let i = 0; i < Math.min(count, pool.length); i += 1) {
    out.push(pool[(start + i) % pool.length]);
  }
  return out;
}

/** FNV-ish. Small, stable, and the same one the covers use. */
function hash(value) {
  let h = 2166136261;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Which artwork role a genre should wear.
 *
 * One table, consulted by every genre surface, so a shelf, its world and
 * its cat cannot end up disagreeing about what kind of place this is.
 */
const GENRE_ROLE = {
  'Horror': 'horror',
  'Thriller': 'mystery',
  'Mystery': 'mystery',
  'Crime': 'mystery',
  'Romance': 'romance',
  'Literary Fiction': 'literary',
  'Contemporary Fiction': 'literary',
  'Classics': 'literary',
  'Historical Fiction': 'history',
  'Japanese Literature': 'literary',
  'Korean Literature': 'literary',
  'Poetry': 'romance',
  'Economics': 'economics',
  'Business': 'business',
  'Science': 'science',
  'Nonfiction': 'research',
  'Psychology': 'psychology',
  'Philosophy': 'psychology',
  'Self-Help': 'nature',
  'History': 'history',
  'Mythology': 'history',
  'Memoir': 'gossip',
  'Biography': 'gossip',
  'Essays': 'research',
  'Humour': 'gossip',
  "Children's": 'children',
  'Young Adult': 'children',
  'Fantasy': 'science',
  'Science Fiction': 'science',
  'Dystopian': 'dystopian',
};

export function roleForGenre(genre) {
  return GENRE_ROLE[genre] ?? ROLE.ANY;
}
