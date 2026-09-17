/**
 * birthday-candidates.js — books being considered as a present.
 *
 * Deliberately NOT part of the library. Nothing in here is one of her
 * books, it is never counted in the shelves, the stats, the Reading DNA
 * or the recommendations, and it never gets a reading status. It exists
 * so a candidate can be written down somewhere without quietly becoming
 * a fact about what she owns.
 *
 * It lives behind Settings → Birthday shortlist, which is the one place
 * in the app she is not expected to wander into by accident.
 *
 * Moving one into the library is a deliberate act: open the shortlist
 * and press "Put it on her shelves". That runs it through the same
 * makeBook() pipeline as everything else, so it arrives on the to-read
 * pile like any other book — never pre-marked as read.
 */

export const BIRTHDAY_CANDIDATES = [
  {
    title: 'Klara and the Sun',
    author: 'Kazuo Ishiguro',
    genre: 'Literary Fiction',
    subgenre: 'Speculative',
    description: 'Klara is an Artificial Friend who watches the world from a store window before being chosen to accompany a girl named Josie. Because Klara narrates, everything reaches us slightly misunderstood, which is the point. Ishiguro uses her to ask what love is for, and whether a person can be replaced.',
    note: 'Moved off the shelves on purpose — this is a present, not something she already has.',
  },
];

export default BIRTHDAY_CANDIDATES;
