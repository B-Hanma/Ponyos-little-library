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

### What these suites do NOT cover

**Real IndexedDB.** Every suite runs against `createMemoryAdapter`,
because the real storage path cannot be observed through this harness at
all:

- with `--virtual-time-budget`, IndexedDB callbacks never fire;
- without it, `--dump-dom` fires at the load event, long before any
  async work has finished.

Both were tried, including a two-pass scheme that parked a report in
localStorage between runs. Neither produced a result, so there is no
automated check for it — an honest gap is better than a test that
silently never runs.

What this means in practice: the repository's *logic* is covered (the
cover store round-trips, top-up, retire, import, undo), but the
IndexedDB `onupgradeneeded` block and the write path are verified by
hand. Open the library, change something, reload, and confirm it is
still there.
