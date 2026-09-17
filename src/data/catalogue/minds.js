/**
 * catalogue/minds.js — psychology, self-help, science and philosophy.
 *
 * One of several parts assembled by ../catalogue.js. See that file for
 * the rules every part follows.
 */

export const MINDS = [
  /* ───────────────────────── psychology ───────────────────────── */
  {
    title: 'Thinking, Fast and Slow',
    author: 'Daniel Kahneman',
    genre: 'Psychology',
    subgenre: 'Decision Making',
    description: 'A Nobel laureate lays out the two systems he says run your mind: the fast, intuitive one that is usually right and occasionally catastrophic, and the slow, effortful one that would rather not be involved. Dense, and the source text for most pop-psychology written since.',
  },
  {
    title: 'Predictably Irrational',
    author: 'Dan Ariely',
    genre: 'Psychology',
    subgenre: 'Behavioural Economics',
    description: 'A series of cheerful experiments showing that people get the same decisions wrong in the same ways every time — about free things, about relative prices, about their own honesty. Lighter than Kahneman and a good companion to it.',
  },
  {
    title: 'The Art of Thinking Clearly',
    author: 'Rolf Dobelli',
    genre: 'Psychology',
    subgenre: 'Cognitive Bias',
    description: 'Ninety-nine cognitive biases, three pages each, no throat-clearing. Designed to be read one chapter at a time rather than straight through. Dobelli is blunt about the fact that knowing the bias does not stop you falling for it.',
  },
  {
    title: 'The Art of the Good Life',
    author: 'Rolf Dobelli',
    genre: 'Psychology',
    subgenre: 'Practical Philosophy',
    description: 'Fifty-two short mental models for living, from the same short-chapter template as his first book. Less about avoiding errors, more about arranging a life you can actually sustain. Pleasantly unsentimental.',
  },
  {
    title: 'The Social Animal',
    author: 'David Brooks',
    genre: 'Psychology',
    subgenre: 'Narrative Nonfiction',
    description: 'Brooks invents two people, Harold and Erica, and follows them from birth to death as a vehicle for everything research says about the unconscious mind. The device is odd and mostly works. A book arguing that character and emotion matter more than intellect.',
  },
  {
    title: 'Social Intelligence',
    author: 'Daniel Goleman',
    genre: 'Psychology',
    subgenre: 'Relationships',
    description: 'Goleman\'s follow-up to Emotional Intelligence, on the neuroscience of how two brains change each other in a conversation. Argues that we are wired to connect and that most institutions are built as if we were not.',
  },
  {
    title: 'Working with Emotional Intelligence',
    author: 'Daniel Goleman',
    genre: 'Psychology',
    subgenre: 'Workplace',
    description: 'The workplace application of Goleman\'s big idea: that self-awareness and empathy predict performance better than IQ or technical skill. Full of corporate case studies. Useful if you manage people, slow if you do not.',
  },
  {
    title: 'Focus',
    author: 'Daniel Goleman',
    genre: 'Psychology',
    subgenre: 'Attention',
    description: 'Attention treated as a muscle with three directions — inward, toward others, and outward at the wider system. Goleman argues that the third is the one leaders lack. Written just as everyone started worrying about their phones.',
  },
  {
    title: 'Barking Up the Wrong Tree',
    author: 'Eric Barker',
    genre: 'Psychology',
    subgenre: 'Success',
    description: 'Takes the standard advice about success — be nice, work hard, network, believe in yourself — and asks what the research actually says. The answers are frequently "it depends, uncomfortably". Funny, well-sourced and refreshingly unbossy.',
  },
  {
    title: 'Originals',
    author: 'Adam Grant',
    genre: 'Psychology',
    subgenre: 'Creativity',
    description: 'How non-conformists get their ideas accepted: procrastinate strategically, lead with the flaws, and be a great deal less fearless than the mythology suggests. Grant is good at puncturing the lone-genius story with data.',
  },
  {
    title: 'Lateral Thinking',
    author: 'Edward de Bono',
    genre: 'Psychology',
    subgenre: 'Creativity',
    description: 'De Bono coined the phrase and this is the manual: a set of deliberate techniques for escaping the obvious answer, with exercises. Dated in its examples and still the clearest thing written on the subject.',
  },
  {
    title: 'Inside the Nudge Unit',
    author: 'David Halpern',
    genre: 'Psychology',
    subgenre: 'Public Policy',
    description: 'An insider account of the UK Behavioural Insights Team — the people who rewrote tax letters and got millions paid on time. Half behavioural science, half civil-service memoir. Honest about the experiments that failed.',
  },

  /* ───────────────────────── self-help ────────────────────────── */
  {
    title: 'The Subtle Art of Not Giving a F*ck',
    author: 'Mark Manson',
    genre: 'Self-Help',
    subgenre: 'Anti-Self-Help',
    description: 'Manson\'s argument is that you have a limited number of things you can care about and most people spend them badly. Sweary, blunt, and built on the idea that suffering is the price of anything worth having. It works or it annoys you; rarely in between.',
  },
  {
    title: 'The Power of Your Subconscious Mind',
    author: 'Joseph Murphy',
    genre: 'Self-Help',
    subgenre: 'Classic',
    description: 'A 1963 bestseller arguing that repeated belief reshapes what the mind will let you do. Half New Thought philosophy, half practical affirmation manual. Read as a historical document it is fascinating; read as science it is not one.',
  },
  {
    title: 'The Magic of Thinking Big',
    author: 'David J. Schwartz',
    genre: 'Self-Help',
    subgenre: 'Classic',
    description: 'A 1959 classic on the gap between what people attempt and what they are capable of. Plain-spoken, relentlessly practical, and the ancestor of most motivational writing since. Dated in tone, still quoted constantly.',
  },
  {
    title: 'Think and Grow Rich',
    author: 'Napoleon Hill',
    genre: 'Self-Help',
    subgenre: 'Classic',
    description: 'Hill claims to have distilled the habits of five hundred wealthy men into thirteen principles, desire and persistence chief among them. Published in 1937 and never out of print. Its research has been widely questioned; its influence has not.',
  },
  {
    title: 'The 5 AM Club',
    author: 'Robin Sharma',
    genre: 'Self-Help',
    subgenre: 'Habits',
    description: 'The case for owning the first hour of the day, wrapped in a parable about a billionaire, an artist and an entrepreneur. The routine at its centre is simple; the fable around it is not to everyone\'s taste.',
  },
  {
    title: 'Discussions on Youth',
    author: 'Daisaku Ikeda',
    genre: 'Self-Help',
    subgenre: 'Buddhist',
    description: 'Answers to questions from young people about friendship, study, family and despair, from a Buddhist perspective. Written as direct address rather than doctrine. Gentle, repetitive by design, and meant to be dipped into.',
  },
  {
    title: 'The Concise Laws of Power',
    author: 'Robert Greene & Joost Elffers',
    genre: 'Nonfiction',
    subgenre: 'Strategy',
    description: 'The short edition of The 48 Laws of Power: each law stated, illustrated with a historical anecdote, and left there. Amoral on purpose and frequently uncomfortable. Best read as a description of how power behaves, not a instruction manual.',
  },

  /* ────────────────────────── philosophy ─────────────────────── */
  {
    title: 'Sophie\'s World',
    author: 'Jostein Gaarder',
    genre: 'Philosophy',
    subgenre: 'Novel of Ideas',
    description: 'Fourteen-year-old Sophie starts receiving anonymous notes asking who she is, and gets a complete history of Western philosophy in reply. Then the frame around the story starts behaving very oddly indeed. A genuinely good introduction to philosophy wrapped inside a puzzle.',
  },

  /* ─────────────────────────── science ────────────────────────── */
  {
    title: 'A Brief History of Time',
    author: 'Stephen Hawking',
    genre: 'Science',
    subgenre: 'Cosmology',
    description: 'Hawking explains black holes, the big bang and the shape of time with famously one equation in the whole book. Some chapters are harder than they look. Still the book that made cosmology a thing people read on trains.',
  },
  {
    title: 'The Gene',
    author: 'Siddhartha Mukherjee',
    genre: 'Science',
    subgenre: 'Biology',
    description: 'The history of the gene as an idea, from Mendel\'s peas to gene editing, threaded through the mental illness in Mukherjee\'s own family. He is a superb narrator of science. Long, humane and quietly alarming about what comes next.',
  },
  {
    title: 'The Evolution of Everything',
    author: 'Matt Ridley',
    genre: 'Science',
    subgenre: 'Big Ideas',
    description: 'Ridley argues that almost everything — morality, technology, money, government — evolves from the bottom up rather than being designed from the top. Provocative, sweeping, and occasionally pushing the thesis further than the evidence.',
  },
  {
    title: 'Homo Deus: A Brief History of Tomorrow',
    author: 'Yuval Noah Harari',
    genre: 'Science',
    subgenre: 'Futurism',
    description: 'Having survived famine, plague and war, Harari asks what humanity does next, and answers: tries to become gods, and may make itself redundant in the process. The sequel to Sapiens, and the more unsettling of the two.',
  },
  {
    title: 'Factfulness',
    author: 'Hans Rosling',
    genre: 'Science',
    subgenre: 'Statistics',
    description: 'Rosling opens with a quiz about the state of the world that almost everyone fails, then explains the ten instincts that make us fail it. An argument that the world is better than you think and still bad enough to matter. Written while he was dying, and full of life.',
  },
  {
    title: 'What the Dog Saw',
    author: 'Malcolm Gladwell',
    genre: 'Essays',
    subgenre: 'Reportage',
    description: 'A collection of Gladwell\'s New Yorker pieces — on ketchup, hair dye, dog training, criminal profiling and why we confuse confidence with competence. Better than his books, because the ideas are not stretched to three hundred pages.',
  },
  {
    title: 'Curation',
    author: 'Michael Bhaskar',
    genre: 'Nonfiction',
    subgenre: 'Culture',
    description: 'An argument that in a world of infinite content, the valuable skill is no longer making more of it but selecting well. Bhaskar takes curation from museums into retail, media and software. Quietly persuasive about why taste became an industry.',
  },
];
