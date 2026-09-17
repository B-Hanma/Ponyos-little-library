<#
  Final authority on which covers ship.

  A cover stays only when we can positively believe it. Three outcomes:
    KEEP  - matched author's surname matches the catalogue author
    KEEP* - matched author is non-Latin (a Japanese/Korean edition of the
            same book); title matched exactly, so accept it
    DROP  - anything else, including right title by the wrong writer
#>
param([string]$Root = "d:\Ponyo's library")
$ErrorActionPreference = 'Stop'
$ua = 'PonyosLittleLibrary/1.0 (personal offline library project)'

function Norm([string]$s) {
  $s = $s.ToLowerInvariant() -replace '[^a-z0-9 ]', ' ' -replace '\s+', ' '
  return $s.Trim()
}

# read catalogue as aligned title/author pairs.
# The catalogue is split across src/data/catalogue/*.js — catalogue.js is
# only the aggregator now and contains no books.
$src = (Get-ChildItem (Join-Path $Root 'src\data\catalogue') -Filter '*.js' |
        Sort-Object Name |
        ForEach-Object { Get-Content $_.FullName -Raw }) -join "`n"
$entries = [regex]::Matches($src, "(?s)\{\s*\r?\n\s+title:\s*(?<tq>'|`")(?<t>.*?)\k<tq>,\s*\r?\n\s+author:\s*(?<aq>'|`")(?<a>.*?)\k<aq>,")
$wanted = @{}
foreach ($m in $entries) {
  $t = $m.Groups['t'].Value -replace "\\'", "'"
  $a = $m.Groups['a'].Value -replace "\\'", "'"
  $wanted[$t] = $a
}
Write-Host "catalogue pairs parsed: $($wanted.Count)" -ForegroundColor Cyan

$path = Join-Path $Root 'src\data\covers.json'
$raw = Get-Content $path -Raw | ConvertFrom-Json
$covers = [ordered]@{}
foreach ($p in $raw.PSObject.Properties) { $covers[$p.Name] = $p.Value }

# re-add the two dropped purely because their edition lists a Japanese author
$readd = @{
  'Norwegian Wood' = @{ coverId = 2237620; matched = 'Norwegian Wood'; author = '(Japanese edition)'; year = 1987 }
  'Before the Coffee Gets Cold' = @{ coverId = 10138333; matched = 'Before the Coffee Gets Cold'; author = '(Japanese edition)'; year = 2015 }
  'There Are Rivers in the Sky' = @{ coverId = 14653203; matched = 'There Are Rivers in the Sky'; author = 'Elif Şafak'; year = 2024 }
  'Salvation of a Saint' = @{ coverId = 9928801; matched = 'Salvation of a Saint'; author = '東野圭吾, Alexander O. Smith'; year = 2008 }
}
foreach ($k in $readd.Keys) { if (-not $covers.Contains($k)) { $covers[$k] = $readd[$k] } }

# ── one picture cannot be two books ──────────────────────────────────
# Open Library happily returns a box-set or series image for every
# volume in a series, which is how fourteen Diary of a Wimpy Kid books
# ended up sharing three covers. The author check cannot catch it — the
# author IS right — so catch it here instead.
#
# When several titles claim the same image, none of them gets it. We
# cannot tell which book it belongs to, and a shared picture is by
# definition not any one book's cover. They fall back to their generated
# covers, which at least carry the right title.
$byId = @{}
foreach ($k in @($covers.Keys)) {
  $id = [string]$covers[$k].coverId
  if (-not $byId.ContainsKey($id)) { $byId[$id] = @() }
  $byId[$id] += $k
}
$shared = 0
foreach ($id in $byId.Keys) {
  if ($byId[$id].Count -lt 2) { continue }
  Write-Host ("  SHARED cover {0} claimed by {1} titles - dropping all:" -f $id, $byId[$id].Count) -ForegroundColor Yellow
  foreach ($k in $byId[$id]) {
    Write-Host ("      - {0}" -f $k) -ForegroundColor DarkYellow
    $covers.Remove($k)
    $shared++
  }
}
if ($shared) { Write-Host ("  dropped {0} covers that were shared between books" -f $shared) -ForegroundColor Yellow }

$keep = 0; $soft = 0; $drop = 0
foreach ($k in @($covers.Keys)) {
  if (-not $wanted.ContainsKey($k)) {
    Write-Host ("  DROP  {0,-42} not in catalogue" -f $k) -ForegroundColor Red
    $covers.Remove($k); $drop++; continue
  }
  $want = $wanted[$k]
  if (-not $want) {
    Write-Host ("  DROP  {0,-42} catalogue has no author (ambiguous entry)" -f $k) -ForegroundColor Red
    $covers.Remove($k); $drop++; continue
  }
  # A book can have several authors, and Open Library frequently credits
  # only one of them. Collect EVERY surname the catalogue claims and
  # accept the match if the edition names any of them.
  #
  # Checking only the first credited author is what made this audit drop
  # a correct cover for Guaranteed to Fail: the catalogue lists four
  # names, and the edition credited the one this check never looked at.
  #
  # NOTE: assign before splitting. `Norm $x -split ' '` would pass -split
  # as a second ARGUMENT to Norm, not as an operator on its result.
  $surnames = @()
  foreach ($piece in ($want -split '&|,|\band\b')) {
    $normPiece = Norm $piece.Trim()
    if (-not $normPiece) { continue }
    $pieceParts = @($normPiece -split ' ' | Where-Object { $_.Length -gt 2 })
    if ($pieceParts.Count) { $surnames += $pieceParts[$pieceParts.Count - 1] }
  }
  $gotRaw = [string]$covers[$k].author
  $got = Norm $gotRaw

  $matched = $false
  foreach ($surname in $surnames) {
    if ($got -match [regex]::Escape($surname)) { $matched = $true; break }
  }
  if ($matched) { $keep++; continue }

  # A foreign-language edition lists its author in that language's script
  # ("Elif Şafak", "東野圭吾"), so the surname comparison cannot work. Accept
  # it only when the TITLE is an exact match — which is what separates a
  # Turkish printing of the right book from an unrelated book of the same
  # name by a different writer.
  $hasNonAscii = $gotRaw -match '[^\x00-\x7F]' -or $gotRaw -eq '(Japanese edition)'
  if ($hasNonAscii -and (Norm $covers[$k].matched) -eq (Norm $k)) {
    Write-Host ("  KEEP* {0,-42} foreign edition, exact title" -f $k) -ForegroundColor DarkCyan
    $soft++; continue
  }

  Write-Host ("  DROP  {0,-42} '{1}' by {2}  (wanted {3})" -f $k, $covers[$k].matched, $gotRaw, $want) -ForegroundColor Red
  $covers.Remove($k); $drop++
}

$json = $covers | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($path, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host ""
Write-Host ("kept $keep, kept-foreign $soft, dropped $drop  ->  {0} verified covers of {1} books" -f $covers.Count, $wanted.Count) -ForegroundColor Green
