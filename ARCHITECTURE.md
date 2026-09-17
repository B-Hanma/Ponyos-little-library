# Architecture

## The shape of it

```
                      ┌──────────────────────────────┐
  IndexedDB  ◄──────► │  StorageAdapter              │   ← the seam
                      │  (adapter.js: the contract)  │
                      └──────────────┬───────────────┘
                                     │
                      ┌──────────────▼───────────────┐
                      │  Repository                  │   in-memory copy
                      │  (repository.js)             │   + async writes
                      └──────────────┬───────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
   ┌──────▼──────┐          ┌────────▼────────┐        ┌────────▼────────┐
   │  Store      │          │  Selectors      │        │  Analytics      │
   │ (what is on │          │ (all → visible) │        │ (stats, DNA)    │
   │  screen)    │          └────────┬────────┘        └────────┬────────┘
   └──────┬──────┘                   │                          │
          │                          │                          │
          └──────────────────────────┼──────────────────────────┘
                                     │
                      ┌──────────────▼───────────────┐
                      │  Views (markup functions)    │
                      │  + app.js (one render loop)  │
                      └──────────────┬───────────────┘
                                     │
                      ┌──────────────▼───────────────┐
                      │  Theme manager               │
                      │  (the only code that touches │
                      │   <html> attributes)         │
                      └──────────────────────────────┘
```

Data flows down. Events flow up through the repository, which is the only thing
that writes.

---

## The layers, and why each one exists

### `storage/adapter.js` — the contract

A small, document-shaped interface: collections of records with string ids, plus
a separate blob store for files.

```js
open()
list(collection)               get(collection, id)
put(collection, record)        putMany(collection, records)
remove(collection, id)         clear(collection)
putBlob(record)                getBlob(id)
removeBlob(id)                 listBlobsByBook(bookId)
```

It is deliberately the common denominator between IndexedDB, Firestore,
Supabase and a plain REST API — nothing in it assumes a local database.

Two implementations ship today: `indexeddb-adapter.js`, and a memory adapter in
`adapter.js` used as a fallback when storage is unavailable.

### `storage/repository.js` — the front door

Views never touch an adapter. They ask the repository.

It keeps the whole library in memory — two hundred records is nothing — so reads
are synchronous and instant while writes go to storage in the background. That
is what makes typing in a notes field feel like typing in a notebook rather than
like filling in a form.

It also owns seeding, de-duplication, import, export, undo-able deletes, and
the file-attachment lifecycle.

### `data/models.js` — what a book is

One place decides what a valid book looks like. The seed list and anything she
types both go through `makeBook`, so the collection can never end up
half-normalized. `updateBook` applies patches and keeps the started/finished
timestamps honest.

### `state/store.js` — what is on screen

A plain object, a set of listeners, and a render pass batched to the next
animation frame. Durable things live in the repository; transient things —
current shelf, search query, open book — live here.

### `state/selectors.js` — all → visible

Pure functions, no DOM, no storage. Filter, search, sort, group, and decide
which mood the page should be in. Testable on its own, which is how the
"every book must appear somewhere" rule in `groupByGenre` stays true.

### `ui/` — markup functions and one render loop

Views are functions that return HTML strings. `app.js` swaps `#view`'s contents
and handles every click by delegation, so a shelf of two hundred cards costs two
listeners rather than six hundred. Everything user-supplied goes through `esc()`
on the way into markup.

### `theme/theme-manager.js` — two independent dials

| Dial | Set by | Changes |
|---|---|---|
| `data-theme` | her, in Settings | the base palette |
| `data-mood` | what is on screen | accents and ambient glows only |

Because a mood only ever overrides accents, a genre change reads as light moving
through water rather than a page repaint. Mood requests are coalesced to one per
frame, so scrolling past four genre shelves cannot strobe the page.

---

## Phase 2: putting it in the cloud

**Everything above `StorageAdapter` stays exactly as it is.** No view, selector,
analytic or style changes.

### 1. Write a second adapter

```js
// src/storage/cloud-adapter.js
export function createCloudAdapter({ db, bucket, userId }) {
  const path = (c) => `users/${userId}/${c}`;
  return {
    name: 'cloud',
    async open() { /* auth is already resolved by the time this is called */ },
    async list(c)          { return readCollection(db, path(c)); },
    async get(c, id)       { return readDoc(db, path(c), id); },
    async put(c, record)   { await writeDoc(db, path(c), record.id ?? record.key, record); return record; },
    async putMany(c, rs)   { await batchWrite(db, path(c), rs); return rs; },
    async remove(c, id)    { await deleteDoc(db, path(c), id); },
    async clear(c)         { await deleteCollection(db, path(c)); },

    async putBlob(record)  { const url = await upload(bucket, `${userId}/${record.id}`, record.blob);
                             await writeDoc(db, path('files'), record.id, { ...record, blob: null, url });
                             return record; },
    async getBlob(id)      { const meta = await readDoc(db, path('files'), id);
                             return meta && { ...meta, blob: await download(meta.url) }; },
    async removeBlob(id)   { await remove(bucket, `${userId}/${id}`); await deleteDoc(db, path('files'), id); },
    async listBlobsByBook(bookId) { return queryWhere(db, path('files'), 'bookId', bookId); },
  };
}
```

### 2. Change one line in `main.js`

```js
const repo = createRepository(createIndexedDbAdapter());   // before
const repo = createRepository(createCloudAdapter({ ... })); // after
```

That is the entire integration. `main.js` is the only file in the codebase that
knows where the data lives.

### 3. What you will want to add, in order

**Auth.** A gate in front of `boot()` that resolves a `userId` before the
adapter is constructed. The welcome screen is already a full-screen step, so it
is the natural place for it.

**Offline-first, not cloud-only.** Do not throw the local adapter away — compose
them. Reads come from IndexedDB, writes go to both, and a queue drains to the
cloud when the connection returns:

```js
createRepository(createSyncingAdapter({
  local: createIndexedDbAdapter(),
  remote: createCloudAdapter({ ... }),
}));
```

This keeps the promise the app makes on its own welcome screen — that it works
without an internet connection — and it is why the adapter interface is
async-everywhere even though IndexedDB reads could have been faked as sync.

**Conflict resolution.** Every record already carries `updatedAt`. Last-write-
wins on a whole record is adequate for a single reader on two devices; if two
devices edit the same book's notes at the same time you will want per-field
merging, which `updatedAt` gives you enough information to build.

**Attachments.** Blob records already separate metadata from bytes, which is
exactly the split object storage wants: the row goes in the database, the bytes
go in the bucket, and `getBlob` reassembles them.

### What Phase 2 must not do

- Require an account to look at the library. The local path has to keep working.
- Move filtering or search to the server. They are pure functions over an
  in-memory list and they are instant; a round trip would make it worse.
- Put anything user-written through a third party without saying so on screen.
  The welcome screen currently promises "everything you write here stays on this
  device", and that sentence has to change at the same time the storage does.

---

## Decisions worth knowing about

**No framework, no build step.** Around 200 books and a dozen screens. A
framework would be more machinery than the problem needs, and a build step would
sit between the author and a file he wants to change at 1am. Edit, refresh.

**Generated cover art.** Real covers mean a network connection and someone
else's rights. Instead the genre picks a colour family and a hash of the title
picks the shade and motif — deterministic, offline, free, and it makes a shelf
look designed because all the Japanese literature is quietly in the same key.

**Everything starts on the to-read pile.** Pre-filling what she has read would
be inventing facts about her. The triage flow makes fixing that take minutes.

**IndexedDB over localStorage.** Real Blobs without base64 bloat, and room to
grow. A four-second timeout on `open()` catches the environments — private
browsing, blocked storage — where IndexedDB neither succeeds nor fails, so a
silent hang degrades to a memory-only session with a warning instead of a
permanently blank page.

**One file per concern, and all the jokes in one of them.** `quips.js` holds
every line of humour so the tone can be tuned without hunting through views —
and so nothing accidentally becomes a joke inside a delete confirmation.

---

# Addendum: the genre-world build

Everything above still holds — the storage seam is unchanged, and Phase 2
is still one adapter and one line in `main.js`. This section covers what
was added on top.

## The two dials became three

| Layer | Set by | Changes |
|---|---|---|
| `data-theme` | her, in Settings | the base palette |
| `data-mood` | what is on screen | accents and ambient glows |
| **the world stage** | what is on screen | the actual scenery |

`theme/worlds.js` is a plain data file: eleven entries, each with a
`backdrop()` returning SVG, a particle spec, a greeting and a mascot pose.
`ui/world-stage.js` owns two stacked layers and crossfades between them, so
a genre change dissolves between two places rather than repainting one.

**Adding a world** is one entry in `worlds.js` plus one `mood:` value in
`genres.js`. Nothing else in the app changes.

### How the scenes stay readable

Three things, and they matter more than the drawings:

1. **`--world-ink` follows the theme, `--world-glow` follows the mood.**
   Line work is light on a dark page and dark on a light one automatically,
   so one set of scenes works in all four themes.
2. **A reverse vignette** masks the middle of the stage, where the cards
   are, and leaves the scene strongest at the edges.
3. **Low opacity, and particles are the first thing motion settings kill.**

### Stacking order is load-bearing

`.ambient` is `z-index: -2`, `.world` is `-1`. They must not share a layer:
the ambient wash is opaque, and when both sat at `-1` it painted straight
over every scene. That is exactly the kind of thing that looks like "the
feature does not work" rather than "one number is wrong".

## Covers as metadata

```
covers.js  (verified ids)  →  seed-books.js  →  book.coverUrl  →  the UI
```

No component names an image. `ui/covers.js` renders the generated cover
first and the photograph over it, and `installCoverFallback()` adds
`.is-loaded` on decode / removes the `<img>` on error. The CSS only hides
the generated title plate once `.is-loaded` is present, so a cover that
fails degrades to a designed cover rather than a blank rectangle.

Phase 2 changes `coverUrlFor()` to point at a bucket. That is the whole
migration.

## The recommendation engine is a scoring function

`analytics/recommend.js` has no network and no model. A mood is a shopping
list (genres, subgenres, keywords, things to avoid); every book is scored
against it; DNF books are excluded unconditionally. Free text is matched
against a phrase table, and any remaining words she typed become bonus
keywords, so "something dark about families" narrows further than
"something dark".

It returns the reason alongside each book, which is why the cards can say
*"korean literature · healing fiction"* instead of asking her to trust it.

## Records grew; the model absorbed it

`notes` went from a string to a list of dated entries. `makeBook` migrates
old records on read rather than requiring a schema version bump, which is
why a library saved before the change still opens. Two analytics files and
the triage filter were still calling `notes.trim()` — worth knowing that a
shape change like this does not announce itself, and the test suite is what
found it.

## What is still true for Phase 2

- Views never touch storage. They call the repository.
- Filtering, search and recommendations are pure functions over an
  in-memory list. They stay client-side; a round trip would make them worse.
- The welcome screen promises that everything stays on the device. When the
  storage layer changes, **that sentence has to change with it.**

---

# Addendum 2: covers as their own record, and three dials

## Covers moved out of the book

The seam that mattered most this round.

```
                    resolveCover(book, { override, objectUrl })
                                    │
       ┌────────────┬───────────────┼───────────────┬──────────────┐
       ▼            ▼               ▼               ▼              ▼
   upload       manual        openlibrary      generated      (nothing
  (a blob     (a URL she     (verified ids    (drawn from      is ever
 she chose)    pasted)        in covers.js)    the book)        blank)
   status:      status:         status:          status:
    real         real            real           fallback
```

`COLLECTIONS.COVERS` is a real collection keyed by **book id**, alongside
`books` and `settings`. One function in `data/cover-policy.js` decides
which source wins; nothing else in the codebase has an opinion.

**Why this shape.** A cover is not an attribute of a book, it is a
picture that happens to be available today from a host that may be gone
tomorrow. Keeping them apart buys four things:

1. `repo.setCover(id, …)` **never writes to the book record** — so
   improving every cover in the library cannot lose a single note she
   wrote. There is a regression check asserting exactly this.
2. `status === 'fallback'` *is* the work queue. Phase 2 does not need to
   guess which books need attention; it asks.
3. A dead URL degrades on its own. `installCoverFallback()` removes the
   `<img>` on error and the generated cover is already underneath it,
   so the failure mode is a designed cover, never a grey box.
4. "Replace cover" is already possible in the data layer. It needs a
   file input and nothing else.

IndexedDB went to **version 2** for this; the migration is additive
(`if (from < 2)` creates the store) and `repository.init` tolerates the
store being absent, so a library saved before the change still opens.

## Retiring a seeded book

`topUpSeed` used to only add. It now also accepts `retiredKeys` and will
remove a seeded book that has been pulled from the catalogue — **but only
while it is untouched**: no status change, no rating, no favourite, no
notes, thoughts, tags, memories or attachments. A catalogue edit does not
get to delete her reading. This is how *Klara and the Sun* left the
shelves for `data/birthday-candidates.js` without a destructive migration.

## The third dial, and the one above it

| Dial | Set by | Changes |
|---|---|---|
| **appearance** | her, or the OS | which light/dark family applies |
| `data-theme` | her, within that family | the base palette |
| `data-mood` | what is on screen | accents and ambient glows |
| the world stage | what is on screen | the actual scenery |

`appearance` sits *above* `theme`: it decides which family, and she keeps
a favourite palette in each (`themeLight`, `themeDark`). `resolveTheme()`
is the pure function that turns those four preferences into one palette
name; `applyPreferences()` returns whichever palette actually won, which
is not always the one stored — "follow the system" gets the last word.

`setTheme` also sets `color-scheme`, which is the difference between a
dark theme and a dark theme with a white scrollbar down the side of it.

**Adding a theme stays two steps**: a palette block in `tokens.css` plus
one `THEMES` entry declaring `scheme`. The picker, the shuffle and the
light/dark dial all enumerate that object.

## The cast

`theme/creatures.js` is a second data file next to `worlds.js`. A world's
`backdrop()` is scenery — silhouettes that sit *behind* text. Its `cast`
is characters: brighter, with faces, each on its own CSS gait.

Three constraints shaped it:

- **One family.** Every creature is built from the same `face()` helper
  as the mascot. Without that, sixteen drawings look like sixteen clip-art
  sets rather than one world.
- **Never over the text.** `buildCast()` places them only in the outer
  bands (1–26% and 74–96%). A ghost drifting across a book title is a bug
  however charming the ghost.
- **Transform-only movement**, so a dozen of them cost one compositor
  pass — and `display: none` under both reduced-motion paths, on top of
  the stage already being removed entirely when motion is off.

## Lines that change

`quips.js` gained `line(list, channel, token)`. `pick()` never changed and
`roll()` changed on every keystroke; `line()` holds a line steady while
the token is stable and draws a new one when she arrives somewhere new.
Lines come from a shuffled bag, so the pool is exhausted before anything
repeats — pure randomness repeats often enough to look broken.

## Testing

`tools/regress.html` boots the **real app** — real views, real store, real
render loop — against the memory adapter, and asserts about fifty things.
`tools/run-checks.ps1` runs it in headless Edge and prints the result.

The memory adapter is not a shortcut: IndexedDB does not participate in
`--virtual-time-budget`, so the real boot path never completes under the
only headless mode that can read a result back out. `tools/README.md`
documents that and the two other traps that cost the most time.

---

# Addendum 3: the whole list, and a building to put it in

## The catalogue is six files now

208 source rows, 206 books. At a paragraph each that is a two-thousand
line file, which is a file nobody edits — so the books live in
`data/catalogue/` (novels, crime, speculative, minds, world, young) and
`data/catalogue.js` spreads them back into one array.

**Nothing downstream knows.** `CATALOGUE` is exactly the export it always
was. The only places that needed changing were the three cover scripts in
`tools/`, which read the source text directly and were still looking at
an aggregator that now contains no books.

Adding a book means adding it to whichever part fits. `CATALOGUE_PARTS`
exports the parts by name so a check can report which one grew.

## Covers: two new ways to be wrong

The three-pass pipeline caught the same class of error it always does —
an *Almond* by Allen Say, a *Funny Side Up* by the wrong author, two
Nancy Drew titles credited to the Hardy Boys ghostwriter. Running it over
206 books instead of 96 surfaced two failure modes it did not have
before:

**One picture cannot be two books.** Open Library returns a box-set image
for every volume in a series, so fourteen Diary of a Wimpy Kid books came
back sharing three cover ids. The author check cannot catch this — the
author is right. A new pass groups by cover id and drops every title
claiming a shared image: we cannot tell which book it belongs to, and a
shared picture is by definition not any one book's cover.

**A book can have four authors.** The audit compared the edition's credit
against the *first* name in the catalogue's author string, which dropped
a correct cover for *Guaranteed to Fail* — four authors, and Open Library
credited the one the check never looked at. It now collects every surname
and accepts a match on any of them.

Result: 159 verified covers of 206 books, and the other 47 draw their
own. The flagged rows are never looked up at all.

## Library Mode

A second view over the same repository. `data/building.js` turns the book
list into a floor plan; `ui/views/library-mode.js` draws it and handles
walking; `styles/library-mode.css` is scoped entirely under `.lm`.

**The plan is derived, never drawn.** Rooms come from the genres she
actually owns, so importing books rearranges the building and an empty
genre never leaves an empty room. Only the room POSITIONS are fixed — a
library that moved overnight would be disorienting rather than charming.

**Three floors, hard-capped.** Thirty genres over six-room floors would
be five storeys, and a five-button lift is a filing cabinet. The genres
she reads most get their own rooms; the long tail shares "The stacks".
`booksInRoom()` is the seam that makes a multi-genre room possible
without the view knowing about it.

**There is no game loop.** A tap sets a target, CSS transitions the
character over a distance-proportional duration, and a timer fires on
arrival to check which room she is standing in. Nothing runs while she
reads. Movement is transform-only and is switched off entirely by both
reduced-motion paths.

**One book page, two doors.** The wall of covers is `bookGrid` — the
component the shelves use — so a cover behaves identically in a room:
same badges, same quick actions, same `openBookDetail`. There is a test
that opens the same book from both routes and compares the rendered
section set, because a book with different features depending on how you
reached it is the worst bug this app could have.

## Typography

Two fixes, both the same shape: **the label needed more room than the
thing it labelled.**

- The Reading Ocean packed islands on their radius while the *captions*
  were what collided. It now packs on a keep-out radius that includes the
  caption block, relaxes to convergence, wraps long genre names onto two
  balanced lines, and outlines every label in the page colour with
  `paint-order: stroke fill`.
- The constellation spaced twelve authors 140px apart and set their names
  at 12px — "Khaled Hosseini" is wider than that before any jitter. Names
  now wrap to given-names / surname, the jitter is bounded to a fraction
  of the column gap, and the labels get the same outline.

The greeting was a third instance: `text-wrap: nowrap` on the title made
the line wider than a narrow screen, and because it is centred the
overflow split across both edges — the H fell off the left, and the
over-wide column clipped the paragraph under it. It is sized from `vw`
now, `.welcome__inner` is capped at `min(34rem, 100%)`, and swash
alternates are disabled so a script capital cannot reach into its
neighbour.

Verified by measuring in iframes at seven widths, not by screenshot:
headless Edge clamps its window to about 500px, so `--window-size=320`
renders at 500 and crops, which looks exactly like an overflow when
nothing is wrong.

## What was removed

`data/letters.js` is gone, along with the sealed notes, the long letter
in Settings, the editable one-liners and the `curatorNote` fields on the
record. The library is hers; it should not contain somebody else
narrating. The regression suite asserts the module cannot be imported and
that no view mentions him, so this cannot quietly come back.

---

# Addendum 4: a hallway, a building with walls in it, and her face

## Home exists, and the route does not

There is now a `home` view, and it is the store's initial value. That is
the whole of the "refresh goes back to the beginning" feature: **the
current route is never persisted and never read back**.

It is worth being explicit about what that is *not*. It is not a reset.
`repo` still holds every book, status, rating, note, tag, date and
attached file, and `settings` still holds every preference; none of it is
touched by a reload. The only thing that does not survive is where she
happened to be standing, which is not a fact about her library.

The test for it cannot press F5, so it proves the reason instead: no
route-ish key is ever written to storage, `view` is not a preference, and
a freshly constructed store — which is exactly what a reload builds —
opens on `home` with no room and no floor.

## Her pictures are a manifest, not a folder

A web page cannot list a directory; it can only ask for a file by name.
So `assets/ponyo/manifest.json` is the index, written by
`tools/import-ponyo-images.ps1` from whatever is actually in the folder,
and `data/portraits.js` is the only thing that reads it.

Two consequences worth keeping:

* **No filename appears anywhere in the UI.** Views ask for a *slot* —
  `home`, `dna`, `study`, `gallery` — and get whatever is eligible.
  Adding a picture is a file copy and a script, never an edit.
* **An empty folder is a valid state.** Every frame has a drawn
  fallback. Nothing substitutes a stock photograph, because a picture of
  the wrong person is worse than no picture.

The manifest URL is resolved against `import.meta.url`, not against the
page. A plain relative path silently means something different depending
on which page is asking — a harness served from `/tools/` asked for
`/tools/assets/ponyo/...`, got a 404, and concluded she owned no
pictures.

`ui/portrait.js` owns every way a picture may appear, and enforces one
rule: **text never sits on her face.** Wide screens put words beside the
picture, narrow ones put the picture first. The single exception is
`portraitBackdrop`, blurred to 46px, which is colour rather than a
portrait.

## Library Mode became a place

The previous version described six rectangles and let the character walk
through all of them. That is a diagram. This version splits into four
files and describes a building:

| file | job |
|---|---|
| `data/building.js` | the plan: rooms, doorways, walls, furniture, stairs, and the collision list |
| `ui/lm/scenery.js` | drawing all of the above |
| `ui/lm/engine.js` | movement, camera, input |
| `ui/lm/section.js` | what a room looks like once you are inside it |

`views/library-mode.js` is deliberately the smallest of the five: it
wires them together and owns nothing else.

### Drawn and solid are the same rectangles

Walls and shelving are drawn from the exact rectangles that go into the
collision list. If the two could drift apart she would bump into thin
air, and there is no way to debug that by looking at it.

### The movement loop runs only while something is moving

There is no tick scheduler. A key down or a drag wakes a `rAF` loop; the
loop stops itself when velocity falls below a threshold and no input is
held. Each axis is resolved separately against the collision list, which
is what lets her slide along a wall rather than stick to it, and a
frame delta is clamped so a backgrounded tab cannot integrate three
seconds in one step and teleport her through a wall.

### Her position is deliberately not in the store

Every write to the store schedules a render, and in this view a render
rebuilds the character. Saving a position that changes sixty times a
second through the store would rebuild her mid-stride, about twice a
second. It lives in a module-level `Map` keyed by floor — presentation
state that only this view produces and only this view consumes.

### The furniture band

Room doorways occupy fixed y-bands. Furniture is therefore constrained to
the hall between them, and a test asserts it: every doorway on every
floor must be walkable, and nothing solid may intersect a doorway
rectangle. That test exists because the reception desk shipped sitting
across the Mystery entrance, making a whole section unreachable with
nothing on screen to explain it.

## Three rendering faults, one technique

`background-clip: text` with a transparent fill was used for the
greeting. It produced, in order:

1. a capital H with most of itself shaved off, because the gradient is
   clipped to the glyph box and a script face overhangs its own advance
   width;
2. a padding / negative-margin hack to give those strokes room, which
   then had to be maintained;
3. a greeting that painted **nothing at all** under some rendering
   paths, while every computed style said it was fine.

It is gone from both greetings. They are painted in a solid colour with
one word tinted, which is all the gradient was really buying. The
decorative script face was demoted at the same time: it is no longer used
for any heading, only for short asides at small sizes.

A single rule in `base.css` now turns off swashes and discretionary
ligatures for every heading, title and `svg text` in the app, rather than
per element — the next long title would have found the same bug.

## Custom properties need a `:root` default

`--accent` and `--accent-2` were only ever declared inside
`[data-mood="…"]` blocks. An undefined custom property does not fall
back; it invalidates the whole declaration that used it. So

```css
background: linear-gradient(90deg, var(--accent-2), var(--accent));
```

computed to `none`, the element simply was not there, and nothing in the
inspector pointed at it. `index.html` ships `data-mood="tide"` so this
never bit the app in a browser — but "works because of an attribute in
the HTML" is not a foundation. The house mood is now declared on `:root`
as well.

---

# Addendum 5: a front door, a cat, and artwork that is not files

## The landing page is not a route

There is no `home` view any more, and that is the point.

The landing page lives in `ui/landing.js`, is mounted by `main.js` before
the app is shown, and removes itself on the way in. It never enters the
store. Which makes "every reload starts at the front door" true **by
construction** rather than by a rule someone has to remember: there is no
current page to persist, so there is nothing that could be restored.

Everything durable is still in the repository and comes back untouched. A
test proves the mechanism rather than the symptom — no route-ish key is
ever written to storage, `view` is not a preference, and a freshly built
store opens on the shelves — because no harness here can press F5.

Entering drops her on the shelves. A second in-app "home dashboard" would
have been a page whose only job was to link to the pages with the books
on them.

## Artwork is panels, not files

Every file in `assets/ponyo/` is a collage: eight or ten separate scenes
in a grid. Two of them are complete mockups of this website, nav labels
and invented book counts included.

So the unit is the **panel**. `data/scenes.js` holds a rectangle per
panel, in fractions of its image, plus the roles that panel suits. Five
files become about forty scenes. Nothing in the UI names a file; a view
asks for `hero` or `economics` or `gossip` and gets a scene.

Three things fell out of that which are worth keeping:

* **`object-fit` cannot do this.** It crops toward a point, so it always
  drags in the neighbouring panels. `ui/scene.js` uses two boxes instead:
  the outer one is whatever size the layout gives it, and the inner image
  is scaled by 1/cropWidth and offset by the crop origin, all in
  percentages. `fit: 'cover'` wraps that in the standard cover trick so a
  panel can fill a container of any shape.
* **A crop is four numbers typed by eye**, and four numbers typed by eye
  are wrong until proven otherwise. `tools/scenes.html` renders every
  panel side by side. It immediately showed that six crops included the
  mockups' own UI — a fake "Reading DNA — See what makes you, you"
  caption, a fake "28 books" — and that one clipped the edge of a
  mocked-up button. None of those would have been caught by reading the
  numbers.
* **Panels that already contain a cat are tagged.** The landing page
  draws its own kitten beside the hero; three hero panels already have
  one, and one has a hand-lettered "Hi Ponyo!" as well. Without the tag
  it drew a second kitten with a second greeting on top of the first.

## The seal became a cat

`ui/mascot.js` is gone. `ui/cat.js` replaces it: one long-haired Persian,
seventeen moods, same shape everywhere.

The interesting mistake was colour. The first version tinted the fur with
`--world-glow`, the way the sea creature had been, so the animal
recoloured with each world. On the house theme that produced a small
round teal creature — which is to say, the sea creature it was replacing.
The fur is now a fixed warm cream and the world reaches it through the
props and the light instead. A cat has to look like a cat in every room.

Which mood it wears comes from the world (`cat:` in `worlds.js`), not
from a table in `cat.js`, so adding a world cannot leave the kitten
standing in it with the wrong face. A test walks every world and checks
the mood it names actually exists.

## Two rendering traps, again

**Backticks inside an HTML comment inside a template literal.** A comment
in generated markup that said "…and `cover` on a wide banner…" ended the
template literal at the backtick. The error — `Unexpected identifier
'cover'` — points at the word, not at the quote.

**`--virtual-time-budget` does not advance CSS animations.** Anything
with `animation-fill-mode: both` and a delay is photographed at 0%, which
for an entrance animation is opacity 0. The landing page's door cards
were simply absent from every screenshot. `tools/shot.html` now holds
entrance animations at their end state for the photograph only; the app
itself is untouched.

---

# Addendum 6: a rail, sixteen rooms, and a household of cats

## The artwork got a genre grid

A later drop of artwork included a 4×4 of sixteen genre-specific scenes
— horror, mystery, romance, psychology, science, history, children's,
gossip, nature, travel, literary, a library corridor — with almost no
slogan text in any of them. That single file is what made real genre
environments possible; before it, every "genre scene" was a general
portrait with a tint over it.

`GENRE_ROLE` in `scenes.js` now maps each genre to its own role, and
every role resolves to its own panel. A test asserts that six sampled
genres disagree on all four channels at once: artwork, world, kitten
mood and kitten coat. A system that only recoloured would pass three of
those and fail the fourth.

## The genre stage is anchored, not full-bleed

This is a resolution decision that looks like a taste decision.

Each genre panel is a crop out of a 1536px collage, so it is about 370px
wide at source. Stretching one across a 1300px band magnifies it three
and a half times, and the first version of the stage did exactly that —
the result was a blurred smear of somebody's sleeve.

So the scene occupies the right of the band at roughly native scale and
bleeds off the top, right and bottom, with its left edge dissolved by a
mask. Nothing frames it, so it still reads as a room rather than a
picture hung on a page, but nothing is magnified past what the artwork
can carry. On a phone the same scene moves to the top of the band and
dissolves downward instead, because there is no width for both a
legible sentence and a visible scene side by side.

The genre's weather — rain, fog, petals, sparks, ash — falls in front of
the scene, built from the same world tokens the page-wide stage uses.

## The kitten became a household

One drawing, several cats. `COATS` in `cat.js` holds seven coats and each
world names one, alongside the mood it already named. Without the coat
half, every kitten in the app was the same cream Persian and a page of
them read as one sticker repeated rather than as a household.

Eye colour travels with the coat, because a black cat with brown eyes
looks like a colouring mistake.

## The rail

A vertical nav replaces the top-row links above 1024px: Landing,
Shelves, Library mode, Reading DNA, Numbers, Surprise me, Mood, Yours,
with a sleeping kitten at the foot of it.

Two of those buttons are not routes. **Landing** re-opens the front door
— `main.js` owns the landing page, so it hands the app a `showLanding`
rather than the app building a second one. **Mood** is not a page at all;
it goes to the shelves and expands the check-in if she had folded it
away. Both are `data-action`, not `data-nav`, which is what keeps
`syncChrome`'s active-state logic honest.

The landing page now empties itself rather than removing itself on the
way in, so the rail can bring it back.

---

# Addendum 7: one genre screen, not two

## What Library Mode used to do

`ui/lm/section.js` held a `sectionBrowser()` — a hero, a set of rows, a
quip — that rendered a genre for Library Mode. The shelves rendered the
same genre a completely different way. Both used `bookCard` and
`openBookDetail`, so a *book* was consistent, but the *genre* was two
screens: two layouts to keep in step, two places for a genre to look
wrong, and only one of them got the cinematic stage.

## What it does now

Walking through a genre door sets `view: LIBRARY, genre: X` and lands on
the shelves' own genre view — the same stage, the same weather, the same
filter bar, the same cards, the same world. Library Mode has no genre
screen left to drift.

`fromBuilding` is the breadcrumb: `{ floor, room, genre }`. It puts a
"back to the floor" button on the stage and sends her to the floor she
left, where the walker's saved position already has her standing on the
threshold she came through.

**The breadcrumb is keyed on the genre on purpose.** The button only
renders while `fromBuilding.genre === state.genre`, which makes it
self-invalidating: changing the filter, clearing it, or jumping to
another genre from a card all drop it without anyone having to remember
to clear it in five handlers.

## The rooms that are not genres

Three special rooms — the study, the whispering corner, the glasshouse —
keep their own panels, because they are not duplicates of anything.
There is no Whispering Corner on the shelves to be consistent with.

The stacks is the one genre-ish room that cannot hand over, because the
filter takes one genre and that room is the long tail of thirteen. It is
now a **signpost**: it lists its shelves with counts, and every row leads
into the same shared genre view.

## The generated cover grew type

Related, and found while checking that no book renders blank: the
generated cover was colour and a motif and nothing else. A card printed
the title underneath, so on a shelf it survived — but in the book drawer
and anywhere a cover stands alone it was an anonymous swatch, and a
comment in `covers.js` claimed it "carries the title" when it did not.

It does now: the title wrapped over up to three lines, the author under a
rule, in the book's own ink. Which meant the `.book__title-plate` overlay
— which existed *because* the cover had no type — was printing a second
copy of both directly over the first. It is gone from the card and from
the drawer.
