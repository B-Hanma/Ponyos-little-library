/**
 * quips.js — everything the library says out loud.
 *
 * All the personality lives in one file so the tone can be tuned without
 * hunting through views, and so nothing accidentally turns into a joke
 * in the middle of a destructive confirmation.
 *
 * House rules:
 *   • dry and affectionate, never cutesy for its own sake
 *   • at most one joke per screen
 *   • the delete dialog is a joke-free zone, always
 *
 * Lines rotate. `pick()` is seeded so a given shelf keeps the same line
 * while she is looking at it; `roll()` is genuinely random for moments
 * that should feel fresh each time.
 */

import { hash } from '../utils/text.js';

/** Deterministic: the same seed always gives the same line. */
export function pick(list, seed = '') {
  if (!list?.length) return '';
  return list[hash(String(seed)) % list.length];
}

/** Random: a new line every time it is called. */
export function roll(list) {
  if (!list?.length) return '';
  return list[Math.floor(Math.random() * list.length)];
}

/* ------------------------------------------------------------------ *
 * a fresh line every time she arrives — but not mid-sentence
 * ------------------------------------------------------------------ */

/**
 * The problem with `pick()` is that it never changes: the Mystery shelf
 * has said the same thing since the day it was built. The problem with
 * `roll()` is that views re-render on every keystroke, so a random line
 * would flicker while she types in the search box.
 *
 * `line()` splits the difference. It holds a line steady for as long as
 * she is looking at the same thing, and draws a new one the moment the
 * `token` changes — a different shelf, a different book, a new visit to
 * the page, a fresh reload.
 *
 * Lines come out of a shuffled bag rather than at random, so the pool is
 * exhausted before anything repeats. Pure randomness says the same thing
 * twice in a row often enough to look broken.
 */
const bags = new Map();   // channel -> indices still unused this cycle
const held = new Map();   // channel -> { token, text }

/** A new shuffled bag of indices for a list of this length. */
function refill(length) {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

/**
 * @param {string[]} list     the pool to draw from
 * @param {string} channel    which surface is speaking (shelf, dna, book…)
 * @param {string} token      changes when she arrives somewhere new
 */
export function line(list, channel, token = '') {
  if (!list?.length) return '';

  const previous = held.get(channel);
  if (previous && previous.token === token) return previous.text;

  let bag = bags.get(channel);
  if (!bag?.length || bag.length > list.length) bag = refill(list.length);

  let index = bag.pop();
  // Two visits in a row should never say the same thing, even across a
  // bag refill.
  if (list[index] === previous?.text && bag.length) index = bag.pop();
  bags.set(channel, bag);

  const text = list[index] ?? list[0];
  held.set(channel, { token, text });
  return text;
}

/**
 * Force the next `line()` on this channel to be a new one, even though
 * nothing about the token changed. Called when she navigates to a page —
 * arriving at Numbers for the second time should not be greeted by the
 * sentence she just left.
 */
export function arrive(channel) {
  held.delete(channel);
}

/**
 * Changes on every reload, so opening the library tomorrow greets her
 * differently even if she lands on exactly the same shelf.
 */
export const SESSION = Math.random().toString(36).slice(2, 8);

/* ------------------------------------------------------------------ *
 * arriving
 * ------------------------------------------------------------------ */

export const WELCOME_BACK = [
  'Welcome back, bookworm. Your TBR is judging you.',
  'Ponyo has returned. The books may now relax.',
  'You came back. We missed you. Your books did not.',
  'The shelves have been exactly where you left them. Suspiciously obedient.',
  'Reopening the library. Nobody has read anything in your absence.',
  'Good. You are here. The pile was getting ideas.',
  'Back again. The to-read shelf would like a word, but it can wait.',
  'The library is open. Attendance: one. Perfect.',
  'Your TBR has requested legal representation.',
  'The kitten has reviewed your choices. It has concerns.',
  'Someone opened a book. Historic moment.',
  'You came here to read. Somehow you are gossiping with a cat.',
  'The books are judging your TBR strategy.',
  'You bought another one, did you not.',
  'The kitten would like you to stop overthinking.',
  'Reality is overrated anyway. In you go.',
  'This shelf contains questionable decisions and excellent stories.',
  'The kitten says that one looks suspicious.',
  'Ah. Emotional damage. Excellent.',
  'Everything is exactly where you left it. I checked twice.',
  'You came here for one book. We both know that is not true.',
  'The shelves have been pretending to behave.',
  'Nothing has been read in your absence. Standards have slipped.',
  'Same sea, same books, same you.',
  'Door was open. It is always open.',
];

export const FIRST_VISIT = [
  'Everything in here is yours. Go on.',
];

/* ------------------------------------------------------------------ *
 * the landing page — the front door, and the only way in
 * ------------------------------------------------------------------ */

/**
 * The line under the greeting. A fresh one every page load.
 *
 * Nothing in here is about anyone but her and the books. No second
 * voice, no notes from anybody, no "someone made this for you" — this
 * is her flat, and the library is the only thing talking.
 */
export const LANDING_LINES = [
  'Same books. Bigger dreams. A kinder planet.',
  'Same shelves, same books, same you.',
  'The lamps are on and nobody else is coming.',
  'Everything on these shelves got here because you wanted it.',
  'Tea first, or straight to the shelves. Both are correct.',
  'Somewhere in this building is the book you actually want.',
  'A reader, a researcher, a gossip, a girl who cares.',
  'No due dates. No fines. No other members.',
  'Good books. Good gossip. A better tomorrow.',
  'Come in. Take your shoes off. The cat has the good chair.',
  'Research first. Existential crisis later.',
  'It is always reading weather in here.',
  'Every book in here is one you chose on purpose.',
  'The kettle is on and the shelves have been talking.',
  'The kitten has been holding your place. Badly.',
  'Somewhere on these shelves is a terrible decision you will love.',
  'Rain outside. Lamps on. No obligations.',
  'One more chapter. We both know how that ends.',
  'The cat has opinions about your reading order.',
  'Books, gossip, and a strong position on several issues.',
  'Nothing in here needs fixing. Read something.',
];

/** The small line above the greeting. */
export const LANDING_KICKERS = [
  'open, as always',
  'one reader, several hundred books',
  'members: you, and a cat',
  'no library card required',
  'shelves stocked, kettle on',
  'a small building by the sea',
  'currently: quiet',
  'still yours',
];

/** The line under the doors. */
export const LANDING_QUOTES = [
  '"A reader, a dreamer, a researcher, a gossiper, a girl who cares."',
  '"A little space for a bigger tomorrow."',
  '"Good books. Brighter tomorrows."',
  '"Same girl. Different chapters."',
  '"Understanding today, for a healthier tomorrow."',
  '"Curious mind. Kind heart. Bigger questions."',
];

/** Rotating tooltips on each door. */
export const DOOR_LINES = {
  library: [
    'Everything, in order, on wooden planks.',
    'The whole coastline, all at once.',
    'Where the books actually live.',
  ],
  building: [
    'Walk around. Bump into things.',
    'The kitten knows the way.',
    'Mind the third stair.',
  ],
  dna: [
    'What the shelves say when you are not in the room.',
    'A map of where you keep going back to.',
  ],
  stats: [
    'Counting things, because counting things is soothing.',
    'The library, with a calculator.',
  ],
};

/* ------------------------------------------------------------------ *
 * the home page
 * ------------------------------------------------------------------ */

/**
 * The line under the greeting. Rotates every visit.
 *
 * Nothing in here is about anyone but her and the books. No second
 * voice, no notes from anybody, no "someone made this for you" — this
 * is her flat and the library is the only thing talking.
 */
export const HOME_LINES = [
  'The lamps are on and nobody else is coming.',
  'Everything on these shelves got here because you wanted it.',
  'Tea first, or straight to the shelves. Both are correct.',
  'Somewhere in this building is the book you actually want.',
  'The quiet in here is the good kind.',
  'No due dates. No fines. No other members.',
  'Your to-read pile has not moved. It is being very patient.',
  'A library of one, with alarmingly good taste.',
  'Come in. Take your shoes off.',
  'Every book in here is one you chose on purpose.',
  'Nothing in this building needs anything from you today.',
  'The shelves reorganised themselves overnight. They deny it.',
  'You came here for one book. We both know that is not true.',
  'It is always reading weather in here.',
  'Research first, existential crisis later. Or the other way round.',
  'The good chair is free. It is always free.',
];

/** The small line above the greeting. */
export const HOME_EYEBROWS = [
  'open, as always',
  'one reader, several hundred books',
  'currently: quiet',
  'no library card required',
  'shelves stocked, kettle on',
  'a small building by the sea',
  'members: you',
  'still yours',
];

/** The heading on the notebook page. */
export const DESK_HEADS = [
  'Things the library noticed',
  'From the desk',
  'Field notes on your own shelves',
  'Observations, unsolicited',
  'What the catalogue is saying about you',
];

/** Lines for the walk-around mode, said by the building itself. */
export const BUILDING_LINES = [
  'Mind the third stair. It has opinions.',
  'Nobody else is in today. Nobody else is ever in.',
  'Every door is unlocked. It is your building.',
  'The heating works. That is the main thing.',
  'Somewhere in here is the book you are actually looking for.',
  'A library with one member and excellent taste.',
  'The lift is decorative. Use the stairs.',
  'Something moved on the top floor. Probably fine.',
  'You can take books off the shelves. That is what they are for.',
  'The cat has claimed the good chair again.',
  'Walk slowly. The building is showing off.',
  'There is a room up here nobody has found yet.',
];

/** Said when she is standing inside a section, whichever one it is. */
export const ROOM_LINES = [
  'Take your time. The door does not lock.',
  'Pull one out. Put it back wherever.',
  'Everything on this wall is yours.',
  'The good ones are at eye level, as always.',
  'Nobody is going to ask you to leave.',
  'Sit on the floor if you like. It is your floor.',
  'This whole wall got here one decision at a time.',
  'You are allowed to just look at the spines.',
];

/** The study, which is about her books, never about her job. */
export const STUDY_LINES = [
  'The globe is decorative. The reading is not.',
  'Somebody in here is wrong about something, and you are going to find out who.',
  'A room for the books that want to argue with each other.',
  'Cold tea, warm lamp, unresolved question.',
  'This is where the library keeps its homework.',
  'Every book on this board disagrees with at least one other.',
];

/** The whispering corner. Gossip about the library, never about a person. */
export const GOSSIP_LINES = [
  'Right. Sit down. The shelves have been talking.',
  'None of this leaves the room, obviously.',
  'You did not hear any of it from the catalogue.',
  'Purely observational. Entirely unsolicited.',
  'Spill the tea. The tea is about books.',
  'Two chairs, no books, and a great deal of information.',
];

/* ------------------------------------------------------------------ *
 * shelves
 * ------------------------------------------------------------------ */

export const SHELF_QUIPS = {
  all: [
    'Everything you own, pretending to be organised.',
    'The whole coastline, all at once.',
    'Every book you have ever said "I will get to it" about.',
  ],
  read: [
    'Survived. Mostly.',
    'Books you finished, and the feelings you kept.',
    'Every one of these rearranged the furniture in your head a little.',
    'Done. Filed. Occasionally still thought about at 2am.',
  ],
  reading: [
    'Currently open, currently unresolved.',
    'In progress. No spoilers, not even from yourself.',
    'Somewhere between page one and an opinion.',
    'These are all technically being read. Technically.',
  ],
  tbr: [
    'Books patiently waiting while you buy more books.',
    'The pile. It knows what it did.',
    'You said you would read these.',
    'Buying books is not the same as reading them. Apparently.',
    'Future you has plans for these. Bold of future you.',
    'A monument to optimism.',
  ],
  favourites: [
    'The ones you would rescue from a flood.',
    'Books you have opinions about at parties.',
    'Kept close, reread often, defended loudly.',
    'The short list. Everyone else swims.',
  ],
  dnf: [
    'Set down, not judged. Life is short and books are many.',
    'You two just wanted different things.',
    'Walked away. Genuinely braver than finishing.',
  ],
};

/* ------------------------------------------------------------------ *
 * genre arrivals — extra lines on top of the world greeting
 * ------------------------------------------------------------------ */

export const GENRE_LINES = {
  Horror: [
    'Ponyo, this is your final warning.',
    'Everything in here is fine. Nothing in here is fine.',
    'You are choosing this. Remember that later.',
    'The kitten has already left the room.',
    'Leave the lamp on. Nobody is judging.',
  ],
  Mystery: [
    'Trust nobody. Especially the narrator.',
    'Somebody in this shelf is lying.',
    'Take notes. You will think you do not need to.',
    'Detective Ponyo has entered the building.',
    'The cat found a clue. The cat is not sharing.',
  ],
  Thriller: [
    'You were going to sleep tonight. Were you.',
    'Short chapters. That is the trap.',
  ],
  Romance: [
    'Proceed with caution. Feelings live here.',
    'Emotional damage incoming. Voluntarily.',
    'You know exactly what happens at the end and you want it anyway.',
    'One of these will ruin a perfectly good Tuesday.',
  ],
  'Young Adult': [
    'Feelings at maximum volume, and honestly, fair.',
    'Everyone here is seventeen and going through it.',
  ],
  Psychology: [
    'Let us investigate why you keep buying books.',
    'We are about to overthink this.',
    'You have read four books about why people do things. Curious.',
    'The kitten would like you to stop overthinking. The kitten is ignored.',
  ],
  Economics: [
    'Your bookshelf has entered capitalism.',
    'Okay professor. Let us talk about markets.',
    'Filed under economics. Actually about fairness.',
    'Okay professor. Let us investigate capitalism.',
    'Charts, opinions, and one very serious cat.',
  ],
  Fantasy: [
    'Reality has been temporarily suspended.',
    'Magic system first, emotional wellbeing second.',
    'The books are floating again. Ignore it.',
  ],
  'Science Fiction': [
    'Space, and the terrible decisions people make in it.',
  ],
  Dystopian: [
    'Reading these for fun is a choice, and you made it.',
    'None of this is a warning. All of this is a warning.',
  ],
  'Japanese Literature': [
    'Quiet. Then devastating. Then a cat appears.',
    'Nothing happens. It will wreck you.',
  ],
  'Korean Literature': [
    'Gentle on the surface. Not gentle underneath.',
  ],
  'Literary Fiction': [
    'Beautiful sentences, questionable emotional outcomes.',
    'Nothing explodes. Everything hurts.',
  ],
  Science: [
    'The universe, explained slowly and patiently.',
  ],
  History: [
    'Everything that already happened, argued about again.',
  ],
  Mythology: [
    'Gods behaving badly, retold with sympathy.',
  ],
  Classics: [
    'Old books that are still right about everything.',
  ],
  "Children's": [
    'We are temporarily suspending intellectual analysis.',
    'No thoughts. Only chocolate factory.',
    'Sit on the floor. That is the correct position.',
  ],
  Humour: [
    'Nothing here will improve you. That is the point.',
  ],
  'Self-Help': [
    'Personal growth, purchased in paperback form.',
    'Morning light, a plant, and a plan you will revise.',
  ],
  Memoir: [
    'Somebody handing you their whole life. Door closed. Spill it.',
    'Research later. Gossip now.',
  ],
  Biography: [
    'An entire existence, condensed and slightly exaggerated.',
  ],
  Business: [
    'Strategy, ambition, and at least one origin story.',
    'The kitten has appointed itself manager.',
  ],
  Nonfiction: [
    'True things, arranged neatly.',
  ],
  Poetry: [
    'Few words. Maximum damage.',
  ],
  Crime: [
    'Somebody did something and you are going to find out who.',
  ],
  Philosophy: [
    'What is real, and does it have to be at this hour.',
  ],
  'Historical Fiction': [
    'The past, with better dialogue than it actually had.',
  ],
  'Contemporary Fiction': [
    'People being people, recently.',
  ],
  Essays: [
    'Short thoughts by people who think for a living.',
  ],
};

/* ------------------------------------------------------------------ *
 * empty states
 * ------------------------------------------------------------------ */

export const EMPTY_LINES = {
  search: [
    'Nothing here by that name. The sea is big though, try again.',
    'No matches. Either it is not here, or it is hiding.',
    'Searched everywhere. Found feelings, no books.',
  ],
  shelf: [
    'This shelf is empty. Suspiciously tidy.',
    'Nothing on this shelf yet. Room to grow.',
  ],
  filter: [
    'No books survived that combination of filters.',
    'You have filtered your way into an empty room.',
  ],
  library: [
    'The shelves are bare. Add the first one?',
  ],
};

/* ------------------------------------------------------------------ *
 * book-level voice
 * ------------------------------------------------------------------ */

export const RATING_WORDS = {
  0: 'not rated yet',
  1: 'we do not talk about this one',
  2: 'it happened',
  3: 'genuinely fine, and fine is allowed',
  4: 'very good, slightly haunting',
  5: 'personality-altering',
};

export const PROGRESS_LINES = [
  [0, 'Not started. The book is being very patient.'],
  [0.1, 'You have begun. Barely, but you have begun.'],
  [0.3, 'In it now. No turning back without guilt.'],
  [0.5, 'Halfway. This is the dangerous part.'],
  [0.75, 'Nearly there. Do not start another one.'],
  [0.95, 'Almost done. Clear your evening.'],
];

export const SUGGESTED_TAGS = [
  'comfort book',
  'emotionally devastating',
  'reread',
  'made me cry on public transport',
  'recommendation',
  'gift',
  'weird in a good way',
  'slow start worth it',
  'stayed up too late',
  'unhinged',
  'made me annoying at dinner',
];

/* ------------------------------------------------------------------ *
 * celebrations
 * ------------------------------------------------------------------ */

export const CELEBRATE = [
  'Ponyo conquered another one.',
  'Another book defeated.',
  'The TBR has suffered a devastating loss.',
  'ONE BOOK ESCAPED THE TBR.',
  'Finished. The pile is visibly upset.',
  'That is another one that lives in your head now.',
  'Closed the book. Opened the feelings. Standard.',
  'Another book has left the ecosystem.',
  'The pile is one shorter and in visible distress.',
  'Read. Filed. Emotionally unresolved.',
  'You did the thing. The thing is done.',
  'One down. The others have noticed.',
  'Finished at an unreasonable hour, as intended.',
  'That one is yours now. Permanently.',
  'The TBR would like to lodge a complaint.',
  'Book closed. Staring at wall. Normal.',
  'Somewhere a shelf just got slightly smug.',
];

export const STARTED = [
  'Started. Good luck in there.',
  'Opened. No going back.',
  'Beginning a new one while three are still open. Iconic.',
  'Page one. The best page.',
  'Just one chapter. Famous last words.',
  'Started. The others can wait their turn.',
  'In you go. Emotional damage may occur.',
];

/* ------------------------------------------------------------------ *
 * page intros
 * ------------------------------------------------------------------ */

export const DNA_INTRO = [
  'Your whole collection, read as one long sentence about you.',
  'What the shelves say when you are not in the room.',
  'Not a diagnosis. Just a very well-informed guess.',
  'The library, attempting to describe its own reader.',
  'Every island down there is a genre you went looking for.',
  'A map of where you keep going back to.',
  'This is what several hundred choices look like from above.',
];

export const NUMBERS_INTRO = [
  'Counting things, because counting things is soothing.',
  'The library, with a calculator.',
  'Everything here is counted. Nothing here is invented.',
  'The shelves, reduced to arithmetic. Sorry, shelves.',
  'Numbers you did not ask for, about books you did.',
  'Data, but the cosy kind.',
];

export const ADD_HINTS = [
  'Genre is optional. Some books refuse to be categorised and that is their right.',
  'You can leave everything blank except the title. Nobody is marking this.',
  'Another book has entered the ecosystem.',
  'You already own several hundred. One more is statistically irrelevant.',
  'It does not need a rating yet. You have not read it.',
];

export const TOASTS = {
  added: 'On the shelf.',
  updated: 'Saved.',
  deleted: 'Gone. Say the word and I will put it back.',
  restored: 'Back where it was.',
  favourited: 'Noted, and quietly approved of.',
  unfavourited: 'Removed from favourites. Bold.',
  imported: 'Shelved.',
  nothingImported: 'Nothing new in that — you already had all of it.',
  noteSaved: 'Written down.',
};

/* ------------------------------------------------------------------ *
 * opening a book
 * ------------------------------------------------------------------ */

/**
 * A small aside at the top of a book page. Drawn fresh every time a book
 * is opened — `line()` is keyed on the book's id, so opening the same
 * book twice says two different things, and re-rendering while she types
 * a note does not change it mid-sentence.
 *
 * Deliberately about the act of reading rather than about the book, so
 * nothing here can ever be wrong about a particular title.
 */
export const BOOK_LINES = [
  'Everything you write here is only ever yours.',
  'No rush. The book is not going anywhere.',
  'Rate it honestly. Nobody is marking this.',
  'Two stars is a perfectly respectable opinion.',
  'You can change your mind later. You usually do.',
  'Setting a book down is allowed. It is not a moral failure.',
  'Half a thought counts as a note.',
  'The shelf will remember this exactly as you leave it.',
  'Write the bit that annoyed you too. That is the interesting part.',
  'Nobody else is ever going to read this page.',
  'A book you did not finish still happened to you.',
  'Put a photo in here. Future you will be delighted.',
  'You are allowed to love a book that is objectively bad.',
  'If you remember one line from this, write it down.',
  'The page count is a suggestion, not a contract.',
  'Your notes here are the only review that matters.',
  'Nobody is timing you.',
  'A reread counts. A reread counts twice, really.',
  'Emotional damage may occur. Voluntarily.',
  'You do not owe this book an explanation.',
  'Give it three stars and get on with your life.',
  'One sentence about how it made you feel. That is a note.',
  'You are allowed to skim. The book will never know.',
  'Detective mode optional but encouraged.',
  'This page will look exactly like this in ten years.',
];
