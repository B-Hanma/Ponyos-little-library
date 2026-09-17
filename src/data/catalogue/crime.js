/**
 * catalogue/crime.js — mystery, thriller, crime and horror.
 *
 * One of several parts assembled by ../catalogue.js. See that file for
 * the rules every part follows.
 *
 * Note on series: seven Lee Child novels, five Goosebumps and three
 * Nancy Drew mysteries appear here. They look like duplicates in a list
 * and are not — each is a separate book, and `series` is what groups
 * them on the shelf.
 */

export const CRIME = [
  /* ────────────────────────── mystery ────────────────────────── */
  {
    title: 'Salvation of a Saint',
    author: 'Keigo Higashino',
    genre: 'Mystery',
    subgenre: 'Howdunnit',
    description: 'A man is found poisoned in his own home and the only person with a motive was four hundred miles away. Higashino tells you almost everything early; the pleasure is watching Detective Kusanagi fail to explain the one impossible detail. Cold, precise and quietly devastating about marriage.',
  },
  {
    title: 'Murder in the Family',
    author: 'Cara Hunter',
    genre: 'Mystery',
    subgenre: 'Cold Case',
    description: 'A cold case from 1987 is reopened as a true-crime streaming series, and the novel is built entirely out of transcripts, emails, articles and forum posts. The form sounds like a gimmick and turns out to be the whole trick. Very hard to put down once the documents start contradicting each other.',
  },
  {
    title: 'Peril at End House',
    author: 'Agatha Christie',
    genre: 'Mystery',
    subgenre: 'Classic Detective',
    description: 'On holiday in Cornwall, Poirot meets a young woman who has survived three accidents in three days and refuses to be worried about it. He is, of course, right to be. One of Christie\'s tidiest constructions, and a fine demonstration of how she hides things in plain sight.',
  },
  {
    title: 'Mardi Gras Masquerade',
    author: 'Carolyn Keene',
    genre: 'Mystery',
    series: 'Nancy Drew',
    subgenre: 'Teen Detective',
    description: 'Nancy Drew goes to New Orleans for carnival and finds sabotage behind the parade floats. Costumes, a stolen something, and a suspect list that narrows every chapter. Comfort reading with a plot that behaves itself.',
  },
  {
    title: 'The Crooked Banister',
    author: 'Carolyn Keene',
    genre: 'Mystery',
    series: 'Nancy Drew',
    subgenre: 'Teen Detective',
    description: 'A zigzag-shaped house belonging to a missing man, a robot in the garden and a staircase that is wrong on purpose. One of the stranger Nancy Drew titles, and better for it.',
  },
  {
    title: 'Mystery on Maui',
    author: 'Carolyn Keene',
    genre: 'Mystery',
    series: 'Nancy Drew',
    subgenre: 'Teen Detective',
    description: 'Hawaii, a resort with a problem it would rather not report, and Nancy on holiday for approximately one afternoon before she starts investigating. Sunny, breezy and solved by the last page.',
  },

  /* ────────────────────────── thriller ────────────────────────── */
  {
    title: 'The Silent Patient',
    author: 'Alex Michaelides',
    genre: 'Thriller',
    subgenre: 'Psychological',
    description: 'Alicia Berenson shot her husband and has not spoken since. A psychotherapist takes a job at her secure unit determined to be the one who gets her to talk. Built entirely around its twist, and the twist is a good one.',
  },
  {
    title: 'The Da Vinci Code',
    author: 'Dan Brown',
    genre: 'Thriller',
    subgenre: 'Conspiracy',
    description: 'A murder in the Louvre sends a symbologist and a cryptographer running across Europe through anagrams, secret societies and a very large claim about Christianity. Short chapters, relentless pace, cheerfully silly. It sold eighty million copies for a reason.',
  },
  {
    title: 'The Mahabharata Secret',
    author: 'Christopher C. Doyle',
    genre: 'Thriller',
    subgenre: 'Mythological',
    description: 'A nuclear scientist is murdered and leaves behind a puzzle pointing at a secret Ashoka buried two thousand years ago. Doyle does for the Mahabharata what Dan Brown did for the Grail. Pacey, daft and fun if you do not fight it.',
  },
  {
    title: 'The Krishna Key',
    author: 'Ashwin Sanghi',
    genre: 'Thriller',
    subgenre: 'Mythological',
    description: 'A historian is framed for murder by a killer who believes he is Kalki, the final avatar of Vishnu. The chase runs through Dwarka, Mathura and a great deal of scripture, cut with flashbacks to Krishna himself.',
  },
  {
    title: 'Chanakya\'s Chant',
    author: 'Ashwin Sanghi',
    genre: 'Thriller',
    subgenre: 'Political',
    description: 'Two stories in parallel: Chanakya installing an emperor in 340 BC, and a modern kingmaker doing exactly the same thing in Indian politics with exactly the same tactics. The argument is that nothing about power has changed in 2,300 years.',
  },
  {
    title: 'Killing Floor',
    author: 'Lee Child',
    genre: 'Thriller',
    series: 'Jack Reacher',
    subgenre: 'Action',
    description: 'Jack Reacher gets off a bus in a Georgia town he picked at random and is arrested for a murder committed an hour earlier. The first Reacher novel, narrated in first person and tighter than most that followed. Establishes the whole formula in one go.',
  },
  {
    title: 'Die Trying',
    author: 'Lee Child',
    genre: 'Thriller',
    series: 'Jack Reacher',
    subgenre: 'Action',
    description: 'Reacher helps a woman on crutches to her car and is kidnapped alongside her. She turns out to be FBI, and the men who took them are building something in Montana. Largely a two-hander in a locked room, which suits Child well.',
  },
  {
    title: 'Tripwire',
    author: 'Lee Child',
    genre: 'Thriller',
    series: 'Jack Reacher',
    subgenre: 'Action',
    description: 'Reacher is digging swimming pools in Key West when a private investigator turns up looking for him and is dead within a day. The trail leads to New York and a loan shark with a hook for a hand. One of the more personal entries in the series.',
  },
  {
    title: 'A Wanted Man',
    author: 'Lee Child',
    genre: 'Thriller',
    series: 'Jack Reacher',
    subgenre: 'Action',
    description: 'Reacher hitches a ride with three people in a car and works out within a few miles that at least one of them is lying about everything. Almost the entire first half happens inside the vehicle. Claustrophobic and very well paced.',
  },
  {
    title: 'Gone Tomorrow',
    author: 'Lee Child',
    genre: 'Thriller',
    series: 'Jack Reacher',
    subgenre: 'Action',
    description: 'Reacher spots a fellow passenger on the New York subway displaying all eleven signs of a suicide bomber. He is right about the list and wrong about what it means. Opens with one of the best chapters Child ever wrote.',
  },
  {
    title: 'Make Me',
    author: 'Lee Child',
    genre: 'Thriller',
    series: 'Jack Reacher',
    subgenre: 'Action',
    description: 'Reacher gets off a train at a wheat-country town called Mother\'s Rest purely because he is curious about the name, and finds a private investigator waiting for someone who never arrives. Slower and stranger than most, with a genuinely grim answer.',
  },
  {
    title: 'Night School',
    author: 'Lee Child',
    genre: 'Thriller',
    series: 'Jack Reacher',
    subgenre: 'Action',
    description: 'A prequel: Reacher is still in the army in 1996, sent to a fake training course that is really a joint-agency scramble over a message picked up in Hamburg. Comes with Sergeant Neagley, which is always an improvement.',
  },
  {
    title: 'Black Wind',
    author: 'Clive Cussler & Dirk Cussler',
    genre: 'Thriller',
    series: 'Dirk Pitt',
    subgenre: 'Adventure',
    description: 'A Japanese submarine lost at the end of the Second World War turns out to have been carrying a biological weapon, and someone has just gone looking for it. Dirk Pitt does what Dirk Pitt does: dives, chases and improbable escapes.',
  },
  {
    title: 'The Blood-Dimmed Tide',
    author: 'Rennie Airth',
    genre: 'Crime',
    series: 'John Madden',
    subgenre: 'Historical',
    description: 'Former Scotland Yard inspector John Madden, retired to a Surrey farm in 1932, finds a body in the woods and is drawn back into a hunt that reaches across a Europe already turning dark. Quiet, sad, superbly written crime fiction.',
  },
  {
    title: 'The Stockmen',
    author: 'Rachel Treasure',
    genre: 'Contemporary Fiction',
    subgenre: 'Rural',
    description: 'A Tasmanian woman inherits a run-down property and the complications that come with it, in a novel about land, family and stubbornness. Treasure writes Australian rural life from the inside — she farmed it. Warm, earthy and not at all delicate.',
  },

  /* ─────────────────────────── horror ─────────────────────────── */
  {
    title: 'The Haunting of Hill House',
    author: 'Shirley Jackson',
    genre: 'Horror',
    subgenre: 'Gothic',
    description: 'Four people spend a summer in a house with a reputation, and lonely, fragile Eleanor begins to feel the house has chosen her. Almost nothing happens that could not be explained, which is exactly why it is frightening. The opening paragraph is one of the best in English.',
  },
  {
    title: 'Strange Houses',
    author: 'Uketsu',
    genre: 'Horror',
    subgenre: 'Puzzle',
    description: 'A writer is shown the floor plan of an ordinary suburban house with one room that makes no sense, and the explanation gets worse the longer anyone looks at it. Told largely through diagrams. Began as a viral video and works alarmingly well on the page.',
  },
  {
    title: 'Zombie School',
    author: 'R. L. Stine',
    genre: 'Horror',
    series: 'Goosebumps',
    subgenre: 'Spooky for Kids',
    description: 'Matt is sent to a boarding school where the other students are unnervingly grey, unnervingly quiet and definitely not fine. Stine does what he always does: short chapters, a cliffhanger on every one, and a twist in the last two pages.',
  },
  {
    title: 'Scary Birthday to You!',
    author: 'R. L. Stine',
    genre: 'Horror',
    series: 'Goosebumps',
    subgenre: 'Spooky for Kids',
    description: 'A birthday wish goes wrong in the specific, ironic way birthday wishes always go wrong in a Goosebumps book. Cheerfully nasty and over in an afternoon. Built to be read under a duvet with a torch.',
  },
  {
    title: 'You\'re Plant Food',
    author: 'R. L. Stine',
    genre: 'Horror',
    series: 'Goosebumps',
    subgenre: 'Spooky for Kids',
    description: 'A greenhouse, suspicious plants and a smell nobody can place. Stine takes a perfectly ordinary garden and makes it carnivorous. Exactly as ridiculous and exactly as effective as that sounds.',
  },
  {
    title: 'Checkout Time at the Dead-End Hotel',
    author: 'R. L. Stine',
    genre: 'Horror',
    series: 'Goosebumps',
    subgenre: 'Spooky for Kids',
    description: 'A family checks into a hotel with no other guests, almost no staff and a distinctly final name. The dread builds through small wrongnesses rather than monsters. One of the better Goosebumps premises.',
  },
  {
    title: 'Welcome to the Wicked Wax Museum',
    author: 'R. L. Stine',
    genre: 'Horror',
    series: 'Goosebumps',
    subgenre: 'Spooky for Kids',
    description: 'The waxwork figures are too detailed, the owner is too interested, and the exit is further away than it was. A classic setting played completely straight. Short, silly, and genuinely creepy in a couple of places.',
  },
];
