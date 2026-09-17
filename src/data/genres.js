/**
 * genres.js — the shelf taxonomy.
 *
 * Two jobs:
 *   1. Turn whatever was typed in the source list ("psych", "Self Help",
 *      "sci-fi") into one canonical genre name.
 *   2. Tell the theme system which mood a genre should feel like.
 *
 * Genres are intentionally coarse. A library of two hundred books wants
 * about twenty shelves, not eighty.
 */

/** canonical name -> { mood, icon, quip } */
export const GENRES = Object.freeze({
  'Literary Fiction':    { mood: 'tide',    icon: '\u{1F30A}', quip: 'Beautiful sentences, questionable emotional outcomes.' },
  'Contemporary Fiction':{ mood: 'tide',    icon: '\u{1F4D8}', quip: 'People being people, recently.' },
  'Historical Fiction':  { mood: 'foxed',   icon: '\u{1F3DB}', quip: 'The past, with better dialogue than it actually had.' },
  'Japanese Literature': { mood: 'washi',   icon: '\u{1F338}', quip: 'Quiet. Then devastating. Then a cat appears.' },
  'Korean Literature':   { mood: 'washi',   icon: '\u{1F343}', quip: 'Gentle on the surface. Not gentle underneath.' },
  'Mystery':             { mood: 'noir',    icon: '\u{1F50E}', quip: 'Detective Ponyo has arrived. Nobody touch anything.' },
  'Thriller':            { mood: 'noir',    icon: '\u{1F5DD}', quip: 'You were going to sleep tonight. Were you.' },
  'Crime':               { mood: 'noir',    icon: '\u{1F9E9}', quip: 'Somebody did something and you are going to find out who.' },
  'Horror':              { mood: 'hollow',  icon: '\u{1F56F}', quip: 'Leave the lamp on. I am not judging.' },
  'Romance':             { mood: 'ember',   icon: '\u{1F49E}', quip: 'Emotional damage incoming. Voluntarily.' },
  'Young Adult':         { mood: 'ember',   icon: '\u{1F31F}', quip: 'Feelings at maximum volume, and honestly, fair.' },
  'Fantasy':             { mood: 'arcane',  icon: '\u{1F52E}', quip: 'Magic system first, emotional wellbeing second.' },
  'Science Fiction':     { mood: 'arcane',  icon: '\u{1F6F8}', quip: 'Space, and the terrible decisions people make in it.' },
  'Dystopian':           { mood: 'dystopia', icon: '\u{1F311}', quip: 'Reading these for fun is a choice, and you made it.' },
  'Classics':            { mood: 'foxed',   icon: '\u{1F4DC}', quip: 'Old books that are still right about everything.' },
  'Psychology':          { mood: 'clarity', icon: '\u{1F9E0}', quip: 'You are once again investigating why people are like this.' },
  'Self-Help':           { mood: 'clarity', icon: '\u{1F331}', quip: 'Personal growth, purchased in paperback form.' },
  'Science':             { mood: 'cosmos', icon: '\u{1F52C}', quip: 'The universe, explained slowly and patiently.' },
  'Economics':           { mood: 'ledger',  icon: '\u{1F4C8}', quip: 'Okay professor. Let us talk about capitalism.' },
  'Business':            { mood: 'ledger',  icon: '\u{1F4BC}', quip: 'Strategy, ambition, and at least one origin story.' },
  'History':             { mood: 'foxed',   icon: '\u{1F5FA}', quip: 'Everything that already happened, argued about again.' },
  'Mythology':           { mood: 'myth',    icon: '\u{1F3F9}', quip: 'Gods behaving badly, retold with sympathy.' },
  'Philosophy':          { mood: 'clarity', icon: '\u{1F54A}', quip: 'What is real, and does it have to be at this hour.' },
  'Memoir':              { mood: 'washi',   icon: '\u{1F4D3}', quip: 'A real person, handing you their whole life.' },
  'Biography':           { mood: 'ledger',  icon: '\u{1F3AD}', quip: 'Someone else’s entire existence, condensed.' },
  'Essays':              { mood: 'clarity', icon: '\u{270D}',  quip: 'Short thoughts by people who think for a living.' },
  'Nonfiction':          { mood: 'clarity', icon: '\u{1F4DA}', quip: 'True things, arranged neatly.' },
  'Humour':              { mood: 'sunny',   icon: '\u{1F604}', quip: 'We are temporarily suspending intellectual analysis.' },
  "Children's":   { mood: 'sunny',   icon: '\u{1F36C}', quip: 'No thoughts. Only chocolate factory.' },
  'Poetry':              { mood: 'washi',   icon: '\u{1FAB6}', quip: 'Few words. Maximum damage.' },
});

export const GENRE_NAMES = Object.keys(GENRES);

/** Lowercased aliases -> canonical genre. Grown from the raw list. */
const ALIASES = new Map(Object.entries({
  'fiction': 'Literary Fiction',
  'literary': 'Literary Fiction',
  'literary fiction': 'Literary Fiction',
  'lit fic': 'Literary Fiction',
  'general fiction': 'Contemporary Fiction',
  'contemporary': 'Contemporary Fiction',
  'novel': 'Contemporary Fiction',
  'drama': 'Literary Fiction',
  'historical': 'Historical Fiction',
  'history fiction': 'Historical Fiction',
  'japanese': 'Japanese Literature',
  'japanese fiction': 'Japanese Literature',
  'jpn lit': 'Japanese Literature',
  'korean': 'Korean Literature',
  'korean fiction': 'Korean Literature',
  'k lit': 'Korean Literature',
  'mystery': 'Mystery',
  'detective': 'Mystery',
  'whodunit': 'Mystery',
  'crime': 'Crime',
  'crime fiction': 'Crime',
  'thriller': 'Thriller',
  'suspense': 'Thriller',
  'psychological thriller': 'Thriller',
  'horror': 'Horror',
  'gothic': 'Horror',
  'romance': 'Romance',
  'romantic': 'Romance',
  'love story': 'Romance',
  'ya': 'Young Adult',
  'young adult': 'Young Adult',
  'teen': 'Young Adult',
  'fantasy': 'Fantasy',
  'magical realism': 'Fantasy',
  'sci fi': 'Science Fiction',
  'scifi': 'Science Fiction',
  'science fiction': 'Science Fiction',
  'speculative': 'Science Fiction',
  'dystopia': 'Dystopian',
  'dystopian': 'Dystopian',
  'classic': 'Classics',
  'classics': 'Classics',
  'psychology': 'Psychology',
  'psych': 'Psychology',
  'behavioural science': 'Psychology',
  'behavioral economics': 'Psychology',
  'self help': 'Self-Help',
  'self-help': 'Self-Help',
  'selfhelp': 'Self-Help',
  'motivational': 'Self-Help',
  'productivity': 'Self-Help',
  'science': 'Science',
  'popular science': 'Science',
  'physics': 'Science',
  'biology': 'Science',
  'economics': 'Economics',
  'economy': 'Economics',
  'finance': 'Economics',
  'business': 'Business',
  'management': 'Business',
  'entrepreneurship': 'Business',
  'history': 'History',
  'indian history': 'History',
  'politics': 'History',
  'mythology': 'Mythology',
  'myth': 'Mythology',
  'mytho': 'Mythology',
  'religion': 'Mythology',
  'philosophy': 'Philosophy',
  'memoir': 'Memoir',
  'autobiography': 'Memoir',
  'diary': 'Memoir',
  'biography': 'Biography',
  'essays': 'Essays',
  'essay': 'Essays',
  'journalism': 'Essays',
  'non fiction': 'Nonfiction',
  'nonfiction': 'Nonfiction',
  'non-fiction': 'Nonfiction',
  'humour': 'Humour',
  'humor': 'Humour',
  'comedy': 'Humour',
  'graphic novel': 'Humour',
  'childrens': "Children's",
  'children': "Children's",
  'kids': "Children's",
  'middle grade': "Children's",
  'poetry': 'Poetry',
}));

/**
 * Map a raw genre string onto the canonical list.
 * Returns '' when the value is missing or unrecognisable — an honest
 * blank is better than a confident wrong shelf.
 */
export function normalizeGenre(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  if (GENRES[value]) return value;

  // Hyphens become spaces so "sci-fi" and "non-fiction" land on the same
  // aliases as "sci fi" and "non fiction".
  const key = value.toLowerCase().replace(/[^a-z\s/,|;&-]/g, '').replace(/[\s-]+/g, ' ').trim();
  if (ALIASES.has(key)) return ALIASES.get(key);

  // "Mystery / Thriller" or "fiction, japanese" — take the first part we know.
  for (const part of key.split(/[/,|;]+|\band\b|&/).map((p) => p.trim())) {
    if (ALIASES.has(part)) return ALIASES.get(part);
  }
  // Last try: a canonical name mentioned anywhere in the string.
  const hit = GENRE_NAMES.find((name) => key.includes(name.toLowerCase()));
  return hit ?? '';
}

export const UNSHELVED = 'Unshelved';

export function genreMeta(genre) {
  return GENRES[genre] ?? {
    mood: 'tide',
    icon: '\u{1F4D4}',
    quip: 'Not filed anywhere yet. It is fine. It is fine.',
  };
}

export function moodForGenre(genre) {
  return genreMeta(genre).mood;
}
