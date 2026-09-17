# 🌊 Ponyo's Little Library

A private library for one reader. It runs in a browser on one computer —
no account, no server, no bill. Every genre is a different room.

---

## Running it

**Double-click `start-library.bat`.**

It starts a tiny web server using PowerShell — which Windows already has,
so there is nothing to install — and opens <http://localhost:8765>. Close
the black window when you are done.

Port busy? `.\serve.ps1 -Port 8890`. Have Node or Python? `npx serve .` or
`python -m http.server 8765` work identically.

Opening `index.html` by double-clicking shows a blank page: browsers refuse
to load ES modules from a `file://` path. That is a browser rule, not a bug.

**Internet is optional.** The app works fully offline — search, notes,
stats, worlds, everything. The only thing a connection adds is the real
cover photographs. Without one, every book falls back to its generated
cover, which carries the title and author.

---

## Her artwork

`assets/ponyo/` holds her pictures. Six are there now, and they are
**collages** — each file is a grid of eight to sixteen separate scenes,
and three of them are full mockups of this website.

So the app never uses a file. It uses a **panel**: one rectangle inside
one file, listed in `src/data/scenes.js` with the roles it suits. Six
files become fifty scenes that way, and a view asks for a role — `hero`,
`horror`, `gossip`, `romance`, `travel` — never a filename.

The most useful file is the 4×4 of sixteen genre scenes. Every genre
environment in the app is built on a panel from it: horror is her hiding
under a blanket with a frightened kitten, mystery is the magnifying glass
and the corkboard, romance is candles and a letter, children's is the
floor covered in picture books.

Where they turn up: a rotating hero on the landing page, a full-height
scene behind every genre, framed artwork in Reading DNA and Numbers, and
the picture on the wall of the study in Library Mode. Which panel shows
is a function of the page load, so a refresh genuinely changes it.

**Text never sits on her face.** On a wide screen the words are beside
the picture; on a narrow one the picture comes first and the words
follow. The one exception is the blurred wash behind the landing page,
which is colour rather than a portrait.

### Adding more

1. copy the files into `assets/ponyo/`
2. run `powershell -ExecutionPolicy Bypass -File tools/import-ponyo-images.ps1`
3. reload

The script writes `assets/ponyo/manifest.json` — a web page cannot list a
directory, so something has to keep the index. A new file is usable
immediately as a whole-image scene. To cut it into panels, add an entry
to `CROPS` in `scenes.js`; that is data, not logic, and it is the only
edit. `tools/scenes.html` lays every crop out side by side so a bad
rectangle is obvious at a glance.

---

## The kitten

The companion is a small long-haired Persian, drawn from primitives in
`src/ui/cat.js`. It has seventeen moods and it turns up everywhere: on
the landing page waving, on every shelf header in that genre's mood, in
the corner when something happens, as the player character in Library
Mode, and in the empty states.

Its fur is a fixed warm cream rather than the world colour. That is
deliberate — tinting the whole animal with the palette made it teal on
the house theme, and a small round teal creature does not read as a cat.
The world still gets in, through the props and the light around it.

It replaced the sea creature entirely. The ocean is still the house
identity — the palette, the waves, the bubbles, the name — but the thing
that follows her around is a cat, because she likes cats.

---

## First thing to do

Every book starts on the to-read pile, because guessing what she has
already read would mean inventing facts about her.

**Settings → Sort the shelves quickly** walks through them one at a time
with three big buttons. A hundred books takes about two minutes. She can
also tap the small icons on any cover.

---

## What is in it

**206 books** — the complete collection list. 208 rows in, two exact
repeats merged, every one with a real description and a genre. **159 have
verified cover photographs**; the rest have a cover drawn for them.

The count is never written down anywhere. **Settings → What is actually on
the shelves** counts it live, and explains where each number came from, so
importing the rest of the list moves every figure on its own.

**The landing page** is the front door, and the only way in. A greeting
that rotates every page load, a panel of her own artwork beside it, the
kitten waving, four doors into the app with live counts on them, and a
line at the bottom. Every number on it is counted at build time.

**Refreshing the browser always comes back here.** Not by a rule — by
construction. The landing page is not a route: it lives outside the
router entirely, is built before the app renders, and removes itself on
the way in. There is no current page to persist, so there is nothing to
restore. F5 from Numbers, Reading DNA, Library Mode, a genre or an open
book all land at the front door, while every book, status, rating, note,
tag, file and preference comes back untouched.

There is deliberately **no Home page inside the app**. Entering puts her
on the shelves, which is where the books are.

**Twelve genre worlds, each with its own scene.** This is the part worth showing off. The page does
not change colour when she moves between shelves — it changes *place*:

| Shelf | Where she ends up |
|---|---|
| Horror | a leaning bookcase, a moon, drifting fog, floating candles, bats, eyes under the shelf |
| Mystery | a rain-streaked window, a corkboard of pinned notes joined with string, a magnifying glass, a fingerprint |
| Romance | a garland of flowers, an opened love letter, a sealed envelope, petals falling |
| Fantasy | a magic door standing open, books floating mid-air, a ring of glowing runes, sparks |
| Psychology | ruled notebook paper, a neuron drawn as a diagram, sticky notes, a thought trail |
| Economics | newspaper columns, a line chart with candlesticks, a stack of coins tumbling past |
| Japanese / Korean | a paper screen, a moon, a branch in blossom, fine rain, a teacup |
| History | an old map with rhumb lines, a compass rose, two columns, an unrolled scroll |
| Mythology | a constellation figure joined up in the sky, a pillared doorway, a half-unrolled scroll, one very large hand reaching in |
| Dystopian | chimneys on the horizon, a perimeter fence, notices nobody reads, and an eye on a tower that scans and blinks; ash falls instead of rain |
| Science | a joined-up constellation, an atom, a molecule chain, a page of working |
| Children's | a sun with rays, bunting, a happy pile of books, confetti |

Every scene is original SVG drawn from primitives. Nothing is traced,
photographed or borrowed.

**And every world is inhabited.** Sixteen original cartoon characters live
across the ten worlds, with ten different ways of moving: cute ghosts rise
and hesitate through the horror shelf while bats flit past with beating
wings; a magnifying glass with a face peers around Mystery and folded notes
glide by; butterflies and a winged love letter cross Romance; star sprites
orbit and books fly like birds in Fantasy; a koi swims through Japanese
Literature; a coin rolls across Economics; an owl bobs in History. They are
drawn from the same face primitives, which is what makes them read as one
family rather than a sheet of stickers, and they are kept out of the middle
of the screen so nothing ever drifts across a book title.

**The kitten** — a small Persian with seventeen moods, and the recurring
character the whole place is built around. It wears a deerstalker on the
mystery shelf, hides with its ears back on the horror shelf, puts on tiny
glasses and consults a chart in economics, and falls asleep when the mood
is "tired". It sits on **every shelf header** in that shelf's mood, turns
up in the corner to say things, walks around Library Mode as the player
character, and stares at you flatly when a search finds nothing. What it
wears comes from the world itself, so adding a world can never leave it
standing there with the wrong face.

**"How is Ponyo feeling today?"** — eleven moods, or she can just type
*"I'm feeling lonely and want something comforting"*. A local scoring
function reads it and recommends actual books off her own shelves, with the
reason attached. No API, no network, instant. Books she has set down are
never recommended back to her.

**Surprise me** — seven kinds of chaos, from *completely random* to
*something that will ruin me*, each drawing from a different mood.

**Reading DNA** — her collection as a map of islands she can sail to, a
garden where the genres she reads most grow biggest, and a constellation of
the authors she went back to. Every shape is a real filter; clicking an
island takes her to that shelf.

All three are computed from the books as they stand, so they redraw
themselves as her reading changes — nothing is fixed in place. The islands
pack themselves apart until none of them overlap, long genre names break
onto two lines, and every caption is outlined in the page colour so it stays
readable wherever it lands. If there are more genres than fit, the map says
so rather than quietly showing ten and implying that is all of them.

**A book page** with the real cover, a description, reading progress, dates,
a notebook that holds many dated notes (pinnable), a photo scrapbook, tags
and file attachments — reached identically from the shelves, from a
recommendation, or from a room in Library Mode.

**Library Mode** — the shelves, as a building she can walk around.

A floor seen from above, with a camera that follows her: a reading hall
with a rug under a lamp, tables, a returns desk, plants, a cat asleep on
one of the tables, and rooms around the edges with shelving along their
back walls.

**She actually moves.** Hold `W A S D` or the arrow keys and she walks;
drag anywhere on the floor and it works like a stick; tap a spot and she
walks to it. Movement is a real frame loop with acceleration, and it
stops the moment she does, so standing still costs nothing.

**And things are in the way.** Walls, shelving, tables, the desk, the
lamp and the plants are all rectangles in a collision list, resolved one
axis at a time so she slides along a wall instead of sticking to it. The
drawing and the collision list are the same rectangles, so what you see
is what you bump into.

**Doorways, not buttons.** Stand in one and the building offers you the
room — *Enter Mystery →* — and `E` takes it. Stand on the stairs and you
are on the next floor, at the landing you left from. A test walks into
every doorway on every floor and fails if any of them is blocked; that
test exists because a solid reception desk once sat squarely across the
Mystery entrance and nothing on screen explained why the room could not
be reached.

**Inside a section** the plan gives way to a wall of covers: a hero, then
rows — what she is in the middle of, what she has never opened, an author
she clearly trusts, what she has finished — scrolling sideways. Click a
cover and the **same book page** opens that opens everywhere else. A test
asserts the feature set is identical from both routes, because a book
that behaved differently depending on how you reached it would be the
worst kind of bug.

**Three rooms are not genres.** The Curious Empath's Study, with a globe,
a marked-up map, cold tea and a board of what she reads about the world;
The Whispering Corner, where two small creatures gossip about the library
itself; and The Glasshouse, warm and green, holding the books she loves.
All three are built from real counts, because an Easter egg that turns
out to be empty is a dead end with a nice name on it.

The plan is derived from the books she actually owns — no genre, no room
— and arranged by floor theme: stories downstairs, people and the world
on the first floor, elsewhere at the top. Every room is tabbable, an
on-screen pad appears for touch, and the genre world behind the building
changes as she steps into each section.

It is an **addition**. The Shelves view is untouched and still the
default; this is a second door into the same library.

**Celebrations.** Finishing a book raises bubbles, the kitten cheers, and
the TBR is informed of its loss.

**Sixteen achievements**, on their own page in Settings, where they belong.

---

## Where the books came from

All 208 rows of the collection list, transcribed. The books live in
`src/data/catalogue/` — six files grouped by part of the shelf, joined
back into one array by `src/data/catalogue.js`, because two hundred books
with a paragraph each is a file nobody can edit at one in the morning.

Every entry has the published title, one consistent spelling per author, a
real genre, and a description written from the actual book.

The cleaning rules in `src/data/corrections.js` do the work the brief
describes, and they run over the shipped catalogue *and* over anything
pasted into the importer, so a badly typed row is fixed the same way
whichever door it comes through:

- **Misspellings** — *Book Theif* → *The Book Thief*, *The Haindmaid's
  Tale* → *The Handmaid's Tale*, *Oliver Dicken* → *Charles Dickens*,
  *Gabreille Zevin*, *Alex Michaeldes*, *Fitzerald*, *Stephen Meyer*.
- **Multi-book rows split** — *The Famous Five (Five Go to Smuggler's Top;
  Five Go Off in a Caravan; Five on Kirrin Island Again)* becomes three
  books sharing a series. *The Stockmen; Black Wind; Gweilo; The
  Blood-Dimmed Tide* becomes four. A subtitle in brackets — *Babel (Or the
  Necessity of Violence)* — is correctly **not** split.
- **Duplicates merged** by accent-folded, article-stripped title + author,
  keeping the richer record field by field. Different volumes of a series
  have different titles, so they never collapse into each other.

### What was not invented

Six rows were genuinely ambiguous — no author given, dozens of editions
under one name, or a book that could not be identified with confidence
from a title and nothing else: *The Executors*, *Two of a Kind Diaries*,
*Sweet Revenge*, *Tales from the Arabian Nights*, *Thomas Titans* and
*Spicy Bites of Biryani*.

They are kept, flagged `needsReview`, shown with a **?** badge and a
"Needs a look" filter, and given **no cover**, because a guessed cover is
a lie with a picture on it. Each one says on its own page exactly what
was unclear. Editing one clears its own flag.

### What was corrected

Eight rows were wrong in ways that could be checked, and the corrections
are listed at the top of `src/data/catalogue.js` rather than applied
silently — including *Breakthrough Nations* → *Breakout Nations*,
*Stranger Houses* → *Strange Houses*, and row 92, where the title and
author columns had swapped places (*Crystal* is the novel, Katie Price
wrote it).

### Adding more

**Settings → Paste in more books** takes raw spreadsheet rows, with or
without the `S. No.` column — tabs, commas or pipes — and runs them
through the *same* cleaning pipeline the catalogue went through: compound
rows split, misspellings corrected, genuine duplicates merged, anything
already shelved skipped rather than overwritten.

It shows the arithmetic before you commit — *"208 rows read → 206 books
ready to shelve; 2 duplicates merged"* — because a final number on its
own looks like the importer lost some. Importing the same list twice is
harmless.

---

## Covers

A cover is **not part of a book**. The book is the title, the author and
what she thought of it; the cover is a picture that happens to be available
today, from a source that might be gone tomorrow. So they are kept apart.

Covers live in **their own store, keyed by book id**, and one function —
`resolveCover()` in `src/data/cover-policy.js` — decides what any given
book shows. Four sources, in order of trust:

| Source | Status | Where it comes from |
|---|---|---|
| `upload` | real | a file she chose herself; always wins |
| `manual` | real | a URL she pasted into the book form |
| `openlibrary` | real | a verified match shipped in `covers.js` |
| `generated` | fallback | drawn from the title, author and genre |

**Replacing a cover never rewrites the book.** That is the point of the
separate store, and Phase 2 inherits it: pointing every fallback at a real
image is a write to the covers collection and nothing else. The books are
not touched, so nothing she has written can be lost doing it.

`status` is the useful half. A book whose cover is `fallback` is a book
still waiting for a real photograph — that list is exactly what Phase 2
works through, and **Settings → What is actually on the shelves** counts it
for you. A URL that dies simply drops back to `fallback` on its own, which
is why a dead link shows a designed cover rather than a grey box.

Every one of the 159 shipped covers was verified four ways — the matched
edition's author had to be the book's author, foreign-language editions
needed an exact title match, and the URL had to return a real JPEG. That
audit rejected an *Almond* by the wrong author and a book called *The Kama
Sutra of Business*. See [tools/README.md](tools/README.md) to regenerate.

Each card draws the generated cover **first** and lays the photograph over
it, revealing it only once it has actually decoded. A cover that never
arrives leaves a designed cover with the title on it, not a grey box.

---

## Making it look right

**Settings → The room** has three controls, in the order people actually
reach for them:

1. **Light / Dark / Follow the system.** The dial people expect. Left on
   "follow the system", the library goes dark when the computer does — at
   sunset, live, without a reload.
2. **A palette per family.** Two for daytime (Daylight, Parchment) and
   three for night (Ocean, Midnight, Warm library). She picks a favourite
   in each and the app remembers both, so following the system swaps
   between *her* two rather than between two defaults. Picking one pins
   that family, because choosing Midnight at noon should show Midnight.
3. **🎲 Surprise me with a theme.** Never hands back the palette already
   showing, and never jumps from dark to white if she has pinned a family.

**Adding a theme is two steps and nothing else changes**: a palette block
in `styles/tokens.css`, plus one entry in `THEMES` in
`src/theme/theme-manager.js` saying whether it is light or dark. The
picker, the shuffle and the light/dark dial all read that object, so a new
theme appears in all three for free — and the kitten and the genre scenery
recolour themselves, because their line work follows the theme.

## Things it says

Nothing repeats the way it used to. Every surface draws from a pool of
lines and takes a **new one each time she arrives** — a new shelf, a
different genre, opening a book, walking to Reading DNA, a fresh reload.

The lines are dealt from a shuffled bag rather than picked at random, so
the whole pool is used before anything comes round again; genuine
randomness says the same thing twice in a row often enough to look broken.
And a line holds steady while she is looking at it, so typing in the search
box does not make the page mutter to itself.

All of it lives in `src/data/quips.js`, including the new pool of asides
that appear on a book page.

## Whose voice this is

Hers, and only hers.

An earlier version had notes from you tucked into it — sealed letters on
certain books, a long note in Settings, one-liners that surfaced from the
corner. All of that is gone, along with the module that held it. The
library can be lovingly made without standing in the room talking.

What remains is the library's own voice: dry, fond, and about books. The
regression suite asserts that none of it comes back.

---

## Keyboard & accessibility

| Key | Does |
|---|---|
| `/` | Jump to search |
| `Esc` | Close the drawer or dialog, or clear the search box |
| `Enter`/`Space` | Activates the DNA islands and constellation stars |

Focus is always visible, dialogs trap and restore focus, and every
interactive SVG shape is reachable by keyboard.

Both the system "reduce motion" setting and the **Movement** switch in
Settings stop everything that moves — particles, drifting scenery, the
celebration, the kitten's breathing — while keeping the scenery itself, because
the scenery is the point.

---

## Project layout

```
index.html              the shell
start-library.bat       double-click to run
serve.ps1               the local web server (PowerShell, no installs)
assets/ponyo/           her pictures, plus the manifest that indexes them
tools/                  cover-fetching scripts, the picture importer,
                        the check suites and the screenshot runner
                        (none of it runs in the browser)

styles/
  tokens.css            themes, genre moods, world channels, type scale
  base.css              reset, typography, ambient background
  layout.css            welcome screen, app shell, responsive chrome
  components.css        buttons, book cards, shelves, drawer, forms
  views.css             library, book detail, DNA, numbers, settings
  scenes.css            how one panel of a collage is cropped and framed
  landing.css           the front door
  worlds.css            the world stage, its particles and its cast
  library-mode.css      the building you can walk around, and the
                        sections you walk into
  personality.css       the kitten, celebrations, mood card, achievements
  animations.css        every keyframe + the reduced-motion contract

src/
  main.js               boot: storage → repository → store → app

  storage/              adapter.js (the contract), indexeddb-adapter,
                        repository (the only thing views call)
  data/                 catalogue.js + catalogue/ (the 206 books, in parts),
                        covers, cover-policy, corrections, genres, quips,
                        book-atmosphere, models, import,
                        birthday-candidates,
                        portraits (the artwork index), scenes (which
                        panel of which collage), building (the floor
                        plan, its walls and its collision list)
  state/                store (what is on screen), selectors (all → visible)
  theme/                theme-manager (appearance + palettes), worlds
                        (the scenery), creatures (who lives in them)
  analytics/            stats, dna, recommend, achievements
  ui/                   app (routing + render loop), landing (the front
                        door), cat (the kitten), scene (cropping one
                        panel out of a collage), world-stage, covers,
                        celebrate, components/
    lm/                 Library Mode: scenery (drawing the building),
                        engine (movement, camera, input),
                        section (what a room looks like inside)
    views/              library, library-mode, dna, stats,
                        settings, book-detail
```

`ARCHITECTURE.md` explains how the pieces fit and exactly what Phase 2 has
to replace.

---

## Stack

Plain HTML, CSS and JavaScript modules. No framework, no build step, no
dependencies, nothing to install, nothing to keep up to date.

Fonts are system stacks — including the script face on the front door — so
there is not a single blocking network request. Edit a file, refresh the
page.
