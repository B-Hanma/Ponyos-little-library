/**
 * recommend.js — "how are you feeling?" turned into actual books.
 *
 * This is deliberately NOT an AI call. It is a scoring function over the
 * books she already owns, driven by a small hand-written vocabulary. It
 * runs offline, instantly, and always explains itself — every suggestion
 * comes back with the reason it was picked.
 *
 * Two entry points:
 *   MOODS        the buttons on the check-in card
 *   interpret()  free text: "I want something dark" / "something funny"
 */

import { STATUS } from '../data/models.js';

/**
 * A mood is a shopping list.
 *   genres/subgenres/tags  what to look for, worth the most
 *   words                  matched against title + description
 *   avoidGenres            never suggest these in this mood
 *   preferUnread           TBR first (default) or comfort rereads first
 */
export const MOODS = [
  {
    id: 'happy', emoji: '\u{1F60A}', label: 'Happy',
    line: 'Good. Let us not ruin it. Probably.',
    genres: ['Contemporary Fiction', 'Humour', "Children's", 'Literary Fiction'],
    subgenres: ['Feel-Good', 'Friendship', 'Adventure', 'Humour'],
    words: ['warm', 'funny', 'charming', 'joy', 'gentle', 'delight'],
    avoidGenres: ['Horror'],
  },
  {
    id: 'emotional', emoji: '\u{1F979}', label: 'Emotional',
    line: 'Understood. We are doing this on purpose.',
    genres: ['Literary Fiction', 'Young Adult', 'Romance', 'Korean Literature'],
    subgenres: ['Grief', 'Family', 'Friendship', 'Coming of Age'],
    words: ['devastating', 'grief', 'loss', 'heartbreak', 'tender', 'love', 'family'],
  },
  {
    id: 'tired', emoji: '\u{1F634}', label: 'Tired',
    line: 'Short, gentle, no homework. Here.',
    genres: ['Japanese Literature', 'Korean Literature', "Children's", 'Humour'],
    subgenres: ['Healing Fiction', 'Magical Realism', 'Feel-Good', 'Adventure'],
    words: ['quiet', 'gentle', 'small', 'cafe', 'bookshop', 'slowly', 'comfort'],
    avoidGenres: ['Horror', 'Thriller', 'Economics'],
  },
  {
    id: 'chaotic', emoji: '\u{1F608}', label: 'Chaotic',
    line: 'Oh good. Let us make some questionable decisions.',
    genres: ['Thriller', 'Fantasy', 'Mystery', 'Humour'],
    subgenres: ['Conspiracy', 'Dark Academia', 'Satire', 'Political'],
    words: ['murder', 'conspiracy', 'revenge', 'chase', 'unhinged', 'secret'],
  },
  {
    id: 'overthinking', emoji: '\u{1F9E0}', label: 'Overthinking',
    line: 'You already think too much. But apparently you want to read about thinking too.',
    genres: ['Psychology', 'Philosophy', 'Science', 'Essays'],
    subgenres: ['Behavioural Science', 'Cognitive Bias', 'Creativity'],
    words: ['mind', 'bias', 'decision', 'reason', 'why', 'behaviour', 'thinking'],
  },
  {
    id: 'sad', emoji: '\u{1F494}', label: 'Sad',
    line: 'Ponyo needs a hug. These are soft ones.',
    genres: ['Japanese Literature', 'Korean Literature', 'Contemporary Fiction', 'Memoir'],
    subgenres: ['Healing Fiction', 'Feel-Good', 'Grief', 'Friendship'],
    words: ['comfort', 'kind', 'healing', 'gentle', 'recover', 'hope', 'warm'],
    avoidGenres: ['Horror', 'Dystopian'],
    preferUnread: false,
  },
  {
    id: 'romantic', emoji: '\u{1F338}', label: 'Romantic',
    line: 'Ahhh. We are in THAT mood today.',
    genres: ['Romance', 'Young Adult', 'Classics', 'Literary Fiction'],
    subgenres: ['Romance', 'Contemporary', 'Grief'],
    words: ['love', 'letters', 'longing', 'wedding', 'heart', 'kiss', 'marriage'],
  },
  {
    id: 'angry', emoji: '\u{1F624}', label: 'Angry',
    line: 'Okay. No cheerful books. We understand.',
    genres: ['Dystopian', 'Economics', 'Horror', 'Classics'],
    subgenres: ['Political', 'Critique', 'Feminist', 'Satire'],
    words: ['power', 'injustice', 'capitalism', 'revolution', 'fury', 'unfair', 'empire'],
    avoidGenres: ["Children's"],
  },
  {
    id: 'fried', emoji: '\u{1FAE0}', label: 'Mentally exhausted',
    line: 'No thinking required. I have checked.',
    genres: ["Children's", 'Humour', 'Mystery', 'Contemporary Fiction'],
    subgenres: ['Adventure', 'Humour', 'Golden Age', 'Feel-Good'],
    words: ['fun', 'funny', 'light', 'adventure', 'silly'],
    avoidGenres: ['Psychology', 'Economics', 'Science', 'Philosophy'],
  },
  {
    id: 'curious', emoji: '\u{2728}', label: 'Curious',
    line: 'Excellent. Let us go and learn something unreasonable.',
    genres: ['Science', 'History', 'Nonfiction', 'Essays', 'Economics'],
    subgenres: ['Cosmology', 'Maritime', 'Data', 'Biology', 'History'],
    words: ['history', 'universe', 'discover', 'explain', 'invention', 'strange'],
  },
  {
    id: 'justread', emoji: '\u{1F4DA}', label: 'I just want to read',
    line: 'No mood. No theme. Just a book. Respect.',
    genres: [],
    subgenres: [],
    words: [],
  },
];

export const MOOD_BY_ID = Object.fromEntries(MOODS.map((m) => [m.id, m]));

/* ------------------------------------------------------------------ *
 * free text
 * ------------------------------------------------------------------ */

/** Phrases that point at a mood. Longest match wins, so "not sad" is safe-ish. */
const PHRASES = [
  [['comfort', 'comforting', 'cosy', 'cozy', 'blanket', 'safe', 'hug', 'lonely'], 'sad'],
  [['dark', 'grim', 'bleak', 'scary', 'creepy', 'horror', 'haunted', 'ghost'], 'chaotic'],
  [['funny', 'fun', 'laugh', 'silly', 'light', 'lighthearted', 'easy'], 'fried'],
  [['cry', 'sob', 'devastate', 'devastating', 'emotional', 'feelings', 'heartbreak'], 'emotional'],
  [['love', 'romance', 'romantic', 'crush', 'kiss'], 'romantic'],
  [['think', 'thinking', 'clever', 'smart', 'brain', 'psychology', 'why people'], 'overthinking'],
  [['angry', 'rage', 'furious', 'unfair', 'injustice', 'capitalism'], 'angry'],
  [['tired', 'exhausted', 'sleepy', 'short', 'quick', 'quiet', 'slow'], 'tired'],
  [['learn', 'curious', 'history', 'science', 'universe', 'interesting'], 'curious'],
  [['happy', 'cheerful', 'nice', 'warm', 'good mood'], 'happy'],
  [['chaos', 'chaotic', 'wild', 'twist', 'thriller', 'murder', 'mystery'], 'chaotic'],
];

/**
 * Read a free-text request and return a mood plus whatever extra words
 * she used, so "something dark about families" narrows further than
 * "something dark" alone.
 * @returns {{mood: Object, extraWords: string[], matched: boolean}}
 */
export function interpret(text) {
  const raw = String(text ?? '').toLowerCase();
  if (!raw.trim()) return { mood: MOOD_BY_ID.justread, extraWords: [], matched: false };

  let best = null;
  let bestLen = 0;
  for (const [needles, moodId] of PHRASES) {
    for (const needle of needles) {
      if (raw.includes(needle) && needle.length > bestLen) {
        best = moodId;
        bestLen = needle.length;
      }
    }
  }

  // Anything she typed that is not a stop word becomes a bonus keyword.
  const STOP = new Set(['i', 'want', 'something', 'a', 'an', 'the', 'to', 'read', 'me', 'feel',
    'feeling', 'and', 'but', 'for', 'about', 'im', 'am', 'is', 'that', 'give', 'book', 'books']);
  const extraWords = raw.replace(/[^a-z\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w));

  return {
    mood: best ? MOOD_BY_ID[best] : MOOD_BY_ID.justread,
    extraWords,
    matched: Boolean(best),
  };
}

/* ------------------------------------------------------------------ *
 * scoring
 * ------------------------------------------------------------------ */

function scoreBook(book, mood, extraWords) {
  // She put this one down. Never suggest it back to her.
  if (book.status === STATUS.DNF) return null;
  if (mood.avoidGenres?.includes(book.genre)) return null;

  let score = 0;
  const reasons = [];

  if (mood.genres?.includes(book.genre)) {
    score += 3;
    reasons.push(book.genre.toLowerCase());
  }
  if (book.subgenre && mood.subgenres?.includes(book.subgenre)) {
    score += 2;
    reasons.push(book.subgenre.toLowerCase());
  }
  for (const tag of book.tags) {
    if (mood.tags?.includes(tag)) { score += 2; reasons.push(tag); }
  }

  const haystack = `${book.title} ${book.description} ${book.subgenre} ${book.tags.join(' ')}`.toLowerCase();
  let wordHits = 0;
  for (const word of mood.words ?? []) {
    if (haystack.includes(word)) { wordHits += 1; }
  }
  score += Math.min(wordHits, 3) * 1.2;

  for (const word of extraWords) {
    if (haystack.includes(word)) { score += 2.5; reasons.push(`you said "${word}"`); }
  }

  // "I just want to read" has no vocabulary, so give everything a floor
  // and let the status and rating nudges do the sorting.
  if (!mood.genres?.length) score += 1;

  if (score <= 0) return null;

  // Prefer something new, unless the mood is explicitly about comfort.
  const preferUnread = mood.preferUnread !== false;
  if (preferUnread) {
    if (book.status === STATUS.TBR) score += 1.6;
    if (book.status === STATUS.READ) score -= 1.2;
  } else {
    if (book.favourite) { score += 2.4; reasons.push('you already love it'); }
    if (book.status === STATUS.READ) score += 1;
  }

  if (book.favourite && preferUnread) score += 0.6;
  if (book.rating >= 4) score += 0.4;
  if (book.status === STATUS.READING) score += 0.8;

  return { book, score, reasons: Array.from(new Set(reasons)).slice(0, 2) };
}

/**
 * @param {Object[]} books
 * @param {Object} mood
 * @param {{extraWords?: string[], limit?: number, seed?: number}} options
 * @returns {Array<{book, score, reasons}>}
 */
export function recommend(books, mood, { extraWords = [], limit = 4, seed = 0 } = {}) {
  const scored = books
    .map((book) => scoreBook(book, mood, extraWords))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return [];

  // Take a wider band than we need and rotate through it, so asking twice
  // in a row does not hand back the same four books.
  const pool = scored.slice(0, Math.max(limit, Math.min(scored.length, limit * 4)));
  const offset = seed % Math.max(1, pool.length);
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];

  // Keep the genuinely best one pinned at the front.
  const top = scored[0];
  const rest = rotated.filter((r) => r.book.id !== top.book.id);
  return [top, ...rest].slice(0, limit);
}

/* ------------------------------------------------------------------ *
 * Surprise Me
 * ------------------------------------------------------------------ */

export const CHAOS = [
  {
    id: 'random', emoji: '\u{1F3B2}', label: 'Completely random',
    line: 'No thoughts behind this whatsoever.',
  },
  {
    id: 'emotional', emoji: '\u{2764}', label: 'Something emotional',
    line: 'Clear your evening.', moodId: 'emotional',
  },
  {
    id: 'thinky', emoji: '\u{1F9E0}', label: 'Something thought-provoking',
    line: 'Bring a pencil.', moodId: 'overthinking',
  },
  {
    id: 'dark', emoji: '\u{1F47B}', label: 'Something dark',
    line: 'Leave the lamp on.', moodId: 'chaotic',
  },
  {
    id: 'cosy', emoji: '\u{1F338}', label: 'Something cosy',
    line: 'Blanket acquired. Tea acquired.', moodId: 'tired',
  },
  {
    id: 'addictive', emoji: '\u{1F525}', label: 'Something addictive',
    line: 'You will not be sleeping.', moodId: 'chaotic',
  },
  {
    id: 'mymood', emoji: '\u{1F30A}', label: 'Based on my mood',
    line: 'Going off what you told me earlier.',
  },
];

/** A genuinely random pick, still skipping anything she set down. */
export function randomBook(books, seed = Math.floor(Math.random() * 1e9)) {
  const pool = books.filter((b) => b.status !== STATUS.DNF);
  if (!pool.length) return null;
  return pool[seed % pool.length];
}
