# tools/

Scripts that generate data. Nothing here runs in the browser, and the app
never depends on them at runtime — they produce files that get committed.

## Refreshing the book covers

After adding books to `src/data/catalogue.js`, run these three in order
from the project root:

```powershell
.\tools\fetch-covers.ps1     # queries Open Library, writes src/data/covers.json
.\tools\fix-covers.ps1       # retries poor matches, verifies every image loads
.\tools\final-covers.ps1     # strict author audit — the one that decides
```

Then copy the surviving ids into `src/data/covers.js`, which is the module
the app actually imports. (`covers.json` is the working file; `covers.js`
is the shipped one.)

### Why three passes

Matching a title to a cover is easy. Matching it to the **right** cover is
not, and a confidently wrong cover is worse than an honest generated one.
Each pass removes a different kind of wrong:

1. **fetch** — a first guess per book, title + author.
2. **fix** — drops matches whose title is not really the book (an omnibus,
   a graphic-novel adaptation, a study guide), retries them with looser
   queries, and checks each surviving URL actually returns a JPEG.
3. **final** — the hard rule: the matched edition's author must be the
   book's author. This is what catches a right-sounding title by a
   completely different writer. Foreign-language editions are allowed
   through only on an exact title match, which keeps the Japanese printing
   of *Norwegian Wood* while still rejecting an unrelated book that
   happens to be called *Almond*.

Books flagged `needsReview` in the catalogue are deliberately excluded
from every pass. We do not know which book they are, so we do not guess at
a picture for them.

### A PowerShell trap worth knowing

`Norm $x -split ' '` does **not** split the result of `Norm`. PowerShell
parses it as three arguments to `Norm`. Assign first:

```powershell
$normalised = Norm $x
$parts = $normalised -split ' '
```

The original version of the audit had this bug, which silently reduced
every surname to a single letter and let almost every bad match through.

## Running the checks

```powershell
.\tools\run-checks.ps1
```

Needs the library running on port 8765 (`start-library.bat`). It loads
`tools/regress.html` in headless Edge and prints the result: about fifty
assertions covering the dataset, the cover policy, every book's detail
page, the genre worlds, the themes, the importer and the Reading Ocean.

There are four suites in total — see below. The full set is:

```powershell
.\tools\run-checks.ps1                                     # regress
.\tools\run-checks.ps1 -Harness tools/smoke.html
.\tools\run-checks.ps1 -Harness tools/catalogue-check.html
.\tools\run-checks.ps1 -Harness tools/responsive.html -BudgetMs 260000 -TimeoutSec 320
```

`regress.html` boots the real app against the **memory adapter** rather
than IndexedDB. That is not laziness — see below.

### Three traps in headless Edge, all of which cost an hour

1. **`--virtual-time-budget` freezes IndexedDB.** IndexedDB does not
   participate in virtual time, so the real boot path never finishes and
   the harness times out looking at the welcome screen. Hence the memory
   adapter.
2. **`requestAnimationFrame` never fires under virtual time either.** The
   world stage coalesces paints with rAF, so the harness stubs it with
   `setTimeout` before importing anything. Without the stub the stage
   reports zero creatures and looks broken when it is not.
3. **`--screenshot` captures before top-level `await` resolves**, so it
   cannot photograph anything a module builds asynchronously. Use
   `--dump-dom` and read the result out of the page instead.

And one PowerShell trap: `$Profile` is an automatic variable holding a
path **with a space in it**, so a parameter of that name silently splits
`--user-data-dir` in two and Edge rejects the second half as a second URL
("Multiple targets are not supported in headless mode"). The runner's
parameter is called `$ProfileDir` for exactly that reason.

### A fourth trap, found the hard way

**Edge caches the harness and every module it imports.** The local server
offers no validator, so a re-run can quietly grade the *previous* version
of the code. The symptom is worse than a stale pass: an edited harness
produces a byte-identical dump, which reads as "my change did nothing"
when in fact the change was never loaded. The runner now deletes the
browser profile before every run. It costs about a second.

## The other check suites

```powershell
.\tools\run-checks.ps1 -Harness tools/smoke.html
.\tools\run-checks.ps1 -Harness tools/catalogue-check.html
.\tools\run-checks.ps1 -Harness tools/responsive.html -BudgetMs 260000 -TimeoutSec 320
```

**smoke** is the app-wide suite. It boots the real app, renders every
view, and checks: that the landing page builds, counts everything from
the dataset, and lets her through a door; that nothing route-ish is ever
persisted and a fresh store opens clean; that the building covers every
genre, that no two rooms overlap and that **every doorway on every floor
can be walked into**; that walls, shelving and furniture actually stop
her; that a section opens a wall of covers; that the same book has an
identical feature set opened from Library Mode and from the shelves; that
a book with no photograph behaves the same as one with; that every
artwork crop lies inside its image and every role the UI asks for
resolves; that the kitten replaced the seal and every world dresses it in
a mood that exists; and that no second voice appears anywhere in the app.

The landing page is tested by MOUNTING it, not by routing to it — it is
deliberately not a view. `mountLanding` takes an optional host element so
the harness can build its own copy without fighting the empty one that
ships in `index.html`.

It replaces the old `library-mode-check.html`, which tested an
interaction model that no longer exists. One suite for the building beats
two that have to be kept in step.

**catalogue-check** holds the 208-row source list and diffs it against
what `catalogue.js` exports: anything missing, anything extra, anything
duplicated, plus books with no description or no genre. It is how the two
cross-part duplicates (*Strange Houses*, *The Wealth of Nations*) and one
missing book (*Sophie's World*) were found after the catalogue was split
into parts.

**responsive** loads the app in an iframe at ten widths from 320px to
1440px and asks whether anything sticks out sideways. Two things make it
worth having rather than eyeballing screenshots:

* **Edge clamps its own window to about 500px**, so
  `--window-size=390` renders at 500 and crops. That looks exactly like
  an overflow bug and is not one. An iframe is the only honest way to
  measure a narrow viewport.
* **`scrollWidth > clientWidth` is the wrong question.** The ambient
  wash, the world scenery, the genre rails and the Library Mode floor all
  extend past the viewport *on purpose* and are clipped or scrolled by an
  ancestor. Counting those produced nine false failures per view, which
  is worse than no check at all. It reports only elements that nothing is
  clipping — and measures the fixed chrome separately, since a tab bar is
  allowed to sit over the page but not to run off the side of it.

It found a real one: after Home was added, the top row held six
destinations plus the brand, the search field and two buttons, and
between 861px and about 1000px it was ~180px wider than the window.

## Looking at the artwork and the kitten

```powershell
# every crop in scenes.js, side by side
start http://localhost:8765/tools/scenes.html
# every kitten mood, and the kitten at five sizes
start http://localhost:8765/tools/cats.html
```

**scenes.html** is not decoration. A crop rectangle is four numbers typed
by eye off a collage, and reading them tells you nothing. Rendered side
by side, a bad one is obvious in a second — which is how six crops were
found to include the mockups' own UI labels and invented book counts, and
one to clip the edge of a mocked-up button.

**cats.html** shows all seventeen moods plus a size ramp from 40px to
150px. A character built from primitives is only as good as its worst
expression and its smallest size, and neither is visible one mood at a
time.

## Photographing it

```powershell
.\tools\shots.ps1 -Views @('home','building','dna')
```

Saves a PNG per view to `%TEMP%\ponyo-shots`. This is how the greeting
that painted nothing, the stray outlines around every rectangle in the
floor plan, and the reception desk parked across a doorway were all
found — none of which any assertion was looking for.

Two things it has to work around:

* `--screenshot` fires at the load event, and this Edge build does not
  wait for a module's top-level `await`, so the picture is of an empty
  page. Running under `--virtual-time-budget` both fast-forwards the
  timers and holds the screenshot until the budget is spent, which also
  means entrance animations have finished.
* `shot.html` fetches the shell and attaches its stylesheets afterwards,
  so `body` colour starts at the initial black and *transitions* to the
  palette over 900ms. A shot taken inside that window shows near-black
  headings and looks exactly like a contrast bug that does not exist.
  The harness disables that transition for the photograph only.

## Indexing her pictures

```powershell
.\tools\import-ponyo-images.ps1
```

Writes `assets/ponyo/manifest.json` from whatever is in the folder,
reading real pixel dimensions so the app knows each aspect ratio. Keeps
any `focal` or `alt` values that were hand-tuned after a previous run.

Keep this file ASCII. PowerShell 5.1 reads `.ps1` as ANSI unless there is
a BOM, and an em dash in a comment is enough to produce a parse error
sixty lines further down.

### Two more traps

**A path with an apostrophe.** `D:\Ponyo's library` breaks Edge's
`--user-data-dir`, silently: it starts, never loads, never exits, and
leaves an empty dump. The runner keeps its profile and its dump in
`%TEMP%` for this reason. Do not "tidy" them back next to the script.

**`Wait-Process -Timeout` throws.** With `$ErrorActionPreference = 'Stop'`
that aborts the runner before its cleanup, leaving a headless Edge alive
which makes every later run hang on a profile lock — and the symptom is
an empty dump with no error, which looks exactly like a broken harness.
The runner catches it and kills strays before starting.

## The backup suite, and the runner that can wait

```powershell
.\tools\run-async.ps1 -Harness tools/backup-check.html
```

**run-async.ps1** exists because `run-checks.ps1` structurally cannot
grade the backup system. It grades a page by dumping its DOM at the load
event, and it leans on `--virtual-time-budget` to drain async work first.
Neither holds here:

- `--dump-dom` fires at the load event, long before a module doing real
  async work has finished. The dump captured one line and looked exactly
  like a hung harness.
- `--virtual-time-budget` only advances virtual time while **timers** are
  pending. `CompressionStream`, `Blob.arrayBuffer` and IndexedDB are not
  timers, so under a virtual clock the run stalls partway and *the stall
  point moves* depending on how much work came before it — a failure
  indistinguishable from a real bug in the code being tested.

So this runner inverts the contract. Edge runs in **real time**, with no
budget and no DOM dump, and the harness announces its own finish line by
POSTing its report to a one-shot `HttpListener` on a second port. Nothing
is inferred from the page lifecycle. The sink address arrives as `?sink=`
in the query string, so the harness hardcodes no port and still works
when you just open it in a browser — no sink, no POST, report on screen.

It needs `serve.ps1` already running, and leaves it completely alone.

**backup-check.html** proves the `.ponyolib` engine. The whole suite is
written once and run against **both** adapters — memory for speed and
determinism, then `createIndexedDbAdapter` for the path her library will
actually use — followed by the things only a real database can be asked.
It covers: a realistic library (real catalogue, user edits, an uploaded
cover, a PDF, a memory photograph, a cover override); build, verify, read,
plan and apply; cross-install portability, where the destination has
genuinely different generated ids and every book still matches on
`bookKey(title, author)`; merge versus replace; idempotency; orphan
cleanup when a cover is superseded; and refusal of malformed archives,
lying manifests, path traversal, a single flipped byte caught by CRC32,
and truncation — each with a check that nothing was written while being
refused.

Two things in it are worth knowing about:

**It cannot touch her library.** `createIndexedDbAdapter` takes a
`database` option, defaulting to the real `ponyo-library`, purely so the
harness can point at throwaway `ponyo-test-*` databases. They are deleted
at the end, and the suite asserts both that none are left behind and that
`ponyo-library` was neither created nor removed.

**It fails loudly if IndexedDB is unavailable.** `repo.init` catches a
failed open and silently swaps in the memory adapter, which is right for
her and catastrophic for a test — the whole IndexedDB pass would go green
while testing nothing. The harness checks `repo.isDegraded` and throws.

## The Settings flow, driven

```powershell
.\tools\run-async.ps1 -Harness tools/backup-ui-check.html
```

**backup-ui-check.html** boots the real app, opens the real Settings
page and clicks the real buttons. Two browser behaviours cannot be
triggered from script, and both are stubbed at the prototype rather than
worked around in the app:

- `HTMLInputElement.click` — a file picker cannot be opened or answered
  from a test. The stub answers it with a `File` the test chooses, or
  cancels it.
- `HTMLAnchorElement.click` — a download would go to disk. The stub
  captures the blob URL instead, and the test then **fetches it back**
  and validates the real archive bytes the user would have received.

Everything else is genuine: the real markup, the real delegated click
handlers, the real modals, the real engine. It covers the backup
producing a valid archive, a cancelled picker doing nothing at all,
invalid and legacy files being refused with no writes, the preview's
numbers matching an independently computed plan, Merge and Replace
reaching the engine in the right mode (asserted by spying on
`repo.applyRestore`), the second confirmation Replace requires,
cancelling that confirmation, the app state refreshing without a reload,
and both failure paths — a snapshot failure that leaves the library
untouched, and a mid-write failure that offers the safety copy.

One trap it produced, worth remembering: a click on a node captured
*before* a `store` change never reaches the handler, because any store
change re-renders `#view` and detaches it. Look buttons up at the moment
of clicking.

And one in the runner: PowerShell's `-match` is case-insensitive, so a
scenario named "a failure partway through" failed a run in which every
check passed. `run-async.ps1` now uses `-cmatch 'FAILURE\(S\)'` and also
insists on seeing an `ALL PASS` line.

## Covers she uploads herself

```powershell
.\tools\run-async.ps1 -Harness tools/cover-check.html
```

**cover-check.html** covers `src/utils/image.js`, which crops and
re-encodes an uploaded cover into the canonical 600 x 900 JPEG before it
is stored.

It does not take the code's word for anything. Every processing test
**decodes the blob that was actually produced** and measures it:
dimensions from the decoded bitmap, format from the file's magic bytes
(so a PNG relabelled `image/jpeg` would fail), and the crop itself from
sampled pixels. Sources are built with red/blue halves precisely so that
a centre crop, a mirrored crop and a stretched crop all look different
from each other.

The distortion test is the nice one: a 300 x 300 red square centred in a
1200 x 600 landscape must still measure square afterwards, at exactly
the size uniform scaling predicts — 450 x 450. If either axis were
scaled independently, that would be two different numbers.

One thing it deliberately does NOT assert: that the output is always
smaller than the input. It usually is, dramatically so — a 3000 x 2000
photograph goes 153 KB to 15 KB. But pure high-frequency noise is the
one thing JPEG is worse at than PNG, and there the output grows. That
case is asserted as *bounded* instead, because claiming "always smaller"
would be claiming something untrue.

It also drives **Remove custom cover** through the real drawer: that the
action appears only when a custom cover exists, that removal clears the
reference AND the blob, that the policy fallback is on screen
immediately with no reload, that a failed removal keeps the cover and
says so, and that upload/replace/remove/re-add cycles never leave a
second cover file behind. Both routes to a custom cover are covered —
`book.coverId` and a `fileId` on the separate covers override.

A trap it produced: opening a book calls `active?.close()` on the
previous drawer, which then sits in the DOM through its exit animation
with its handlers still bound. A document-wide `querySelector` can
therefore hand back the OLD drawer's controls, so an upload driven
through them updates the library while the drawer actually on screen
never re-renders — which looks exactly like a broken feature. Scope
drawer queries to `#drawer-root .drawer:not(.is-closing)`.

## Opening an older library

```powershell
.\tools\run-async.ps1 -Harness tools/compat-check.html
```

**compat-check.html** covers the two ways a library can arrive from the
past, and both had been taken on faith until it existed.

**The IndexedDB v1 to v2 upgrade.** Every other test database is created
fresh, which means it takes the `from < 1` branch and the `from < 2`
branch has never run. So this harness builds a genuine version 1
database by hand — three stores, the right indexes, and crucially **no
covers store** — fills it with records in the shape v1 actually wrote
(`notes` as a plain string, no `tags`/`memories`/`progress`, the cover
on the book record), and only then hands it to the production adapter.
What runs next is the real migration. It then checks that every book,
setting, blob byte and index survived, that the new covers store works,
that the repository opens it normally, that it backs up and restores,
and that reopening it a second time does nothing at all.

This is what caught the shape-migration bug: the *schema* upgrade was
always correct, but nothing migrated the *records*, so a v1 library
loaded and then threw in stats, search, DNA and achievements. See the
comment on the load loop in `repository.js`.

**A backup taken before a catalogue update.** Her library is seeded from
a catalogue that grows, and `seed:version` drives the top-up. A backup
carries that flag, so restoring an old one moves the destination's flag
*backwards*. That is deliberate, and the tests now say so out loud:
Merge keeps the newer books and the next boot's top-up is a no-op;
Replace drops them, and the next boot puts them back, with her restored
edits and her uploaded cover intact throughout. The catalogue is app
data and repairs itself; only her own writing is precious.

## The library as files on a disk

```powershell
.\tools\run-async.ps1 -Harness tools/fs-adapter-check.html
```

**fs-adapter-check.html** covers `src/storage/fs-adapter.js`,
`platform.js` and `migrate.js` — the storage the desktop build will use
instead of IndexedDB.

`createFsAdapter` is handed its filesystem rather than importing one, and
this harness hands it one it can break on purpose. The adapter, the write
queue, the atomic-write path and every line of `migrate.js` are the real
modules; only the *disk* is a fake, because a real disk cannot be asked
the two questions that matter most here on demand:

* **What is on disk when a write fails halfway?** The fake fails one
  named operation, once — the temp write, or the rename that commits it —
  and the test then reads `library.json` back and requires it to be
  byte-identical to before, still valid JSON, with no `.tmp` left behind.
* **What happens when two saves race?** The repository fires writes
  without awaiting them, so thirty concurrent `put` calls are exactly
  what it does on a busy afternoon. Without the queue each would read,
  modify and rewrite the whole document, and the last to land would erase
  the other twenty-nine. The fake counts overlapping writes, so
  "serialised" is measured — peak concurrency must be 1 — rather than
  assumed.

The migration tests use a **real** IndexedDB, because migrating from a
fake proves nothing about the database her books are actually in. They
cover all four outcomes: a fresh install, a real library copied and
verified, a second launch adopting what is already there, and a
migration that died halfway being thrown away rather than trusted. The
failure path asserts the whole safety contract at once — the incomplete
filesystem output is deleted, the pre-migration `.ponyolib` is kept, and
the browser database is byte-for-byte what it was.

Two things worth knowing:

**Verification is not a formality.** After a good migration the suite
corrupts one cover on disk and requires the verifier to notice, then
truncates it and requires the length check to notice. A verifier nobody
has ever seen fail is not a verifier.

**Looking for a browser library must not create one.** `indexedDB.open`
creates the database when it is missing, so the naive check would leave
an empty `ponyo-library` behind in the webview of every desktop install
that never used the web version — a write, from the module that promised
not to make any. `migrate.js` asks `indexedDB.databases()` first, and the
suite asserts the real database is never created.

### What these suites do NOT cover

**The STORE fallback in situ.** `zip.js` skips compression when
`CompressionStream` is missing. That path is exercised by a stub, but no
browser actually lacking it has been tried.

**Large libraries.** The archive is assembled in memory and then read
back in full to verify. At 47 KB that is free; a library with several
large PDFs would spike memory, and there is no streaming path.

**A merge that would overwrite newer edits.** For a matched book the
archived record wins wholesale. Rate a book *after* taking a backup,
then merge that backup, and the newer rating is lost. It is shown in the
diff, but it is not a field-level merge.
