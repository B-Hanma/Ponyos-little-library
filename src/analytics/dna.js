/**
 * dna.js — reading the collection back to her.
 *
 * Ground rules, so this stays charming instead of creepy:
 *   • Every observation is triggered by something countable. If the
 *     books are not there, the line is not shown.
 *   • No percentages pretending to be psychology. "You disappear into
 *     Japan a lot" is a fair reading of eight Japanese novels.
 *     "You are 82.3% introspective" is a lie with a decimal point.
 *   • The tone is a person who noticed, not a machine that measured.
 */

import { countBy } from '../state/selectors.js';
import { STATUS } from '../data/models.js';

/**
 * Thematic threads. A thread fires when enough books match it, and each
 * one owns its own voice. `match` only ever looks at real fields.
 */
const THREADS = [
  {
    id: 'people',
    name: 'People, examined closely',
    icon: '\u{1F30A}',
    genres: ['Literary Fiction', 'Contemporary Fiction', 'Historical Fiction'],
    min: 4,
    desc: 'Books where not very much happens and it ruins you anyway.',
  },
  {
    id: 'why',
    name: 'Why humans are like that',
    icon: '\u{1F9E0}',
    genres: ['Psychology', 'Essays', 'Science', 'Philosophy'],
    min: 3,
    desc: 'You keep buying books that promise to explain people. You have not stopped yet.',
  },
  {
    id: 'east',
    name: 'The quiet devastation shelf',
    icon: '\u{1F338}',
    genres: ['Japanese Literature', 'Korean Literature'],
    min: 3,
    desc: 'Small rooms, ordinary afternoons, and something enormous underneath.',
  },
  {
    id: 'crime',
    name: 'Somebody did something',
    icon: '\u{1F50E}',
    genres: ['Mystery', 'Thriller', 'Crime'],
    min: 3,
    desc: 'You would like to know who, how, and whether they feel bad about it.',
  },
  {
    id: 'fair',
    name: 'Is any of this fair',
    icon: '\u{1F4C8}',
    genres: ['Economics', 'Business', 'History'],
    min: 3,
    desc: 'Filed under economics. Actually about fairness, and you know it.',
  },
  {
    id: 'elsewhere',
    name: 'Reality, negotiable',
    icon: '\u{1F52E}',
    genres: ['Fantasy', 'Science Fiction', 'Dystopian'],
    min: 3,
    desc: 'When this world is being tedious, you go and audit a different one.',
  },
  {
    id: 'heart',
    name: 'Deliberate emotional damage',
    icon: '\u{1F49E}',
    genres: ['Romance', 'Young Adult'],
    min: 3,
    desc: 'You saw the warning label. You bought it anyway.',
  },
  {
    id: 'old',
    name: 'Old books that are still right',
    icon: '\u{1F4DC}',
    genres: ['Classics', 'Mythology'],
    min: 3,
    desc: 'Stories that have outlived everyone who complained about them.',
  },
  {
    id: 'dark',
    name: 'Comfortable in the dark',
    icon: '\u{1F56F}',
    genres: ['Horror'],
    min: 1,
    desc: 'Not a large shelf. A telling one.',
  },
];

function threadsFor(books) {
  return THREADS
    .map((thread) => {
      const matched = books.filter((b) => thread.genres.includes(b.genre));
      return { ...thread, count: matched.length, books: matched };
    })
    .filter((thread) => thread.count >= thread.min)
    .sort((a, b) => b.count - a.count);
}

/**
 * The name at the top of the page. Chosen from the two strongest
 * threads, so it changes as the collection changes.
 */
function archetype(threads) {
  const ids = threads.slice(0, 2).map((t) => t.id).sort().join('+');
  const NAMES = {
    'people+why': 'The Curious Empath',
    'east+people': 'The Quiet Devastation Enthusiast',
    'crime+people': 'The Sympathetic Detective',
    'fair+why': 'The Kind Economist',
    'elsewhere+people': 'The Homesick Traveller',
    'heart+people': 'The Willing Casualty',
    'crime+why': 'The Off-Duty Profiler',
    'east+why': 'The Patient Observer',
    'fair+people': 'The Reader Who Keeps Score',
    'elsewhere+why': 'The Speculative Analyst',
    'heart+why': 'The Feelings Scientist',
    'crime+east': 'The Quiet Investigator',
    'old+people': 'The Long-Memory Reader',
  };
  if (NAMES[ids]) return NAMES[ids];
  if (threads[0]) {
    const SOLO = {
      people: 'The Close Reader',
      why: 'The Question Asker',
      east: 'The One Who Disappears Into Japan',
      crime: 'Detective Ponyo',
      fair: 'The Kind Economist',
      elsewhere: 'The World Hopper',
      heart: 'The Willing Casualty',
      old: 'The Long-Memory Reader',
      dark: 'The One Who Leaves the Lamp On',
    };
    return SOLO[threads[0].id] ?? 'The Reader';
  }
  return 'The Reader, Just Getting Started';
}

/**
 * The lines under the name. Each is guarded by a real condition, and the
 * whole thing degrades gracefully down to a nearly-empty library.
 */
function observations(books, threads) {
  const lines = [];
  const has = (id) => threads.find((t) => t.id === id);
  const authors = countBy(books, (b) => b.author).filter((a) => a.name !== 'Author unknown');
  const repeat = authors.filter((a) => a.count > 1);

  if (has('people')) {
    lines.push('You like stories about people. Not plots about people — people.');
  }
  if (has('why')) {
    lines.push('You also seem to want to know why they do any of it, which is a different and slightly nosier hobby.');
  }
  if (has('east')) {
    const n = has('east').count;
    lines.push(`You disappear into Japan and Korea regularly — ${n} books' worth, all of them quiet on the outside.`);
  }
  if (has('crime')) {
    lines.push('And then, with no warning, somebody gets murdered and you are extremely fine with it.');
  }
  if (has('fair')) {
    lines.push('There is a whole shelf here filed under economics that is really a shelf about fairness.');
  }
  if (has('elsewhere')) {
    lines.push('When this world is being tedious you go and inspect a different one, usually one with a worse government.');
  }
  if (has('heart') && has('people')) {
    lines.push('You do not avoid books that will hurt. You appear to seek them out and schedule them.');
  }
  if (has('dark')) {
    lines.push('You do not mind the dark. You just prefer to enter it voluntarily.');
  }
  if (repeat.length >= 3) {
    const names = repeat.slice(0, 3).map((a) => a.name).join(', ');
    lines.push(`When you find someone you trust, you stay: ${names}.`);
  } else if (repeat.length) {
    lines.push(`You have gone back for seconds with ${repeat[0].name}, which is the highest compliment you give.`);
  }

  const tbr = books.filter((b) => b.status === STATUS.TBR).length;
  const read = books.filter((b) => b.status === STATUS.READ).length;
  if (tbr > read && tbr > 8) {
    lines.push(`And you have ${tbr} books waiting, which is less a reading list and more a declaration of intent.`);
  } else if (read > 0 && read >= tbr) {
    lines.push('You actually finish things, which among book people makes you a rare and slightly suspicious character.');
  }

  if (!lines.length) {
    lines.push('The shelves are still filling up. Come back once there is more to read into.');
  }
  return lines;
}

/** Author clusters worth calling out on the page. */
function constellation(books) {
  return countBy(books, (b) => b.author)
    .filter((a) => a.count > 1 && a.name !== 'Author unknown')
    .slice(0, 14);
}

/** Small honest observations about how she keeps the library. */
function habits(books) {
  const out = [];
  const rated = books.filter((b) => b.rating > 0);
  if (rated.length >= 5) {
    const avg = rated.reduce((sum, b) => sum + b.rating, 0) / rated.length;
    out.push(avg >= 4
      ? 'You rate generously. Either you are kind, or you are very good at choosing.'
      : 'You rate carefully. A five from you clearly means something.');
  }
  const favourites = books.filter((b) => b.favourite);
  if (favourites.length >= 3) {
    const favGenres = countBy(favourites, (b) => b.genre);
    if (favGenres[0]?.count >= 2) {
      out.push(`Your favourites cluster around ${favGenres[0].name}. The heart wants what it wants.`);
    }
  }
  const annotated = books.filter((b) => b.notes.length || b.thoughts.trim());
  if (annotated.length >= 3) {
    out.push(`You have written something back to ${annotated.length} of these. That is the whole point of a library.`);
  }
  const dnf = books.filter((b) => b.status === STATUS.DNF);
  if (dnf.length >= 2) {
    out.push(`You have put ${dnf.length} books down unfinished, which takes more confidence than finishing them.`);
  }
  return out;
}

export function computeDNA(books) {
  const threads = threadsFor(books);
  return {
    archetype: archetype(threads),
    observations: observations(books, threads),
    threads,
    constellation: constellation(books),
    habits: habits(books),
    /** Genre spread, biggest first, for the bars. */
    spread: countBy(books, (b) => b.genre || 'Unshelved').slice(0, 10),
    total: books.length,
  };
}
