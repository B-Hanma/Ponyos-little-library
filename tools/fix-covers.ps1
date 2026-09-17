<#
  Second pass over covers.json:
   1. drops covers for books flagged needsReview (we must not guess)
   2. drops matches whose title is not actually the book we asked for
   3. retries those, plus the original misses, with looser queries
   4. verifies every surviving cover id really serves an image
#>
param([string]$Root = "d:\Ponyo's library")
$ErrorActionPreference = 'Stop'
$ua = 'PonyosLittleLibrary/1.0 (personal offline library project)'

# titles that must never get an auto-matched cover
$ambiguous = @('Black Wind', 'The Stockmen', 'Tales from the Arabian Nights', 'Two of a Kind Diaries')

function Norm([string]$s) {
  $s = $s.ToLowerInvariant()
  $s = $s -replace '[^a-z0-9 ]', ' '
  $s = $s -replace '\s+', ' '
  return $s.Trim()
}

# how much of the wanted title appears in the matched title
function TitleScore([string]$want, [string]$got) {
  $w = Norm $want; $g = Norm $got
  if ($w -eq $g) { return 1.0 }
  $w = $w -replace '^(the|a|an) ', ''
  $g = $g -replace '^(the|a|an) ', ''
  if ($w -eq $g) { return 0.97 }
  if ($g.StartsWith($w)) { return 0.9 }
  if ($g -like "*$w*") { return 0.8 }
  $wt = $w -split ' ' | Where-Object { $_.Length -gt 2 }
  if (-not $wt) { return 0 }
  $hits = ($wt | Where-Object { $g -like "*$_*" }).Count
  return [math]::Round($hits / $wt.Count, 2)
}

function Lookup([string]$title, [string]$author, [switch]$TitleOnly) {
  $qTitle = ($title -split ':')[0].Trim()
  $url = "https://openlibrary.org/search.json?title=$([uri]::EscapeDataString($qTitle))"
  if ($author -and -not $TitleOnly) { $url += "&author=$([uri]::EscapeDataString(($author -split '&')[0].Trim()))" }
  $url += '&fields=title,author_name,cover_i,first_publish_year,language&limit=20'
  try { return (Invoke-RestMethod -Uri $url -Headers @{ 'User-Agent' = $ua } -TimeoutSec 25).docs }
  catch { return @() }
}

function BestMatch([string]$title, [string]$author, $docs) {
  $best = $null; $bestScore = 0
  foreach ($d in $docs) {
    if (-not $d.cover_i) { continue }
    $s = TitleScore $title $d.title
    # prefer English editions; a Catalan translation is a real cover but the wrong one
    if ($d.language -and ($d.language -contains 'eng')) { $s += 0.06 }
    # penalise obvious alternate formats
    if ($d.title -match '(?i)graphic novel|abridged|study guide|summary|workbook|boxed set|collins classics') { $s -= 0.45 }
    if ($author -and $d.author_name) {
      $a = Norm (($author -split '&')[0].Trim())
      $surname = ($a -split ' ')[-1]
      if (-not (($d.author_name | ForEach-Object { Norm $_ }) -match [regex]::Escape($surname))) { $s -= 0.35 }
    }
    if ($s -gt $bestScore) { $bestScore = $s; $best = $d }
  }
  if ($bestScore -lt 0.62) { return $null }
  return @{ doc = $best; score = $bestScore }
}

$path = Join-Path $Root 'src\data\covers.json'
$raw = Get-Content $path -Raw | ConvertFrom-Json
$covers = [ordered]@{}
foreach ($p in $raw.PSObject.Properties) { $covers[$p.Name] = $p.Value }

# --- source of truth for titles/authors ---
# The catalogue is split across src/data/catalogue/*.js — catalogue.js is
# only the aggregator now and contains no books.
$src = (Get-ChildItem (Join-Path $Root 'src\data\catalogue') -Filter '*.js' |
        Sort-Object Name |
        ForEach-Object { Get-Content $_.FullName -Raw }) -join "`n"
$tm = [regex]::Matches($src, "(?m)^\s{4}title:\s*'((?:[^'\\]|\\.)*)'|^\s{4}title:\s*`"((?:[^`"\\]|\\.)*)`"")
$am = [regex]::Matches($src, "(?m)^\s{4}author:\s*'((?:[^'\\]|\\.)*)'|^\s{4}author:\s*`"((?:[^`"\\]|\\.)*)`"")
$books = @()
for ($n = 0; $n -lt $tm.Count; $n++) {
  if ($tm[$n].Groups[1].Success) { $t = $tm[$n].Groups[1].Value } else { $t = $tm[$n].Groups[2].Value }
  if ($am[$n].Groups[1].Success) { $a = $am[$n].Groups[1].Value } else { $a = $am[$n].Groups[2].Value }
  $t = $t -replace "\\'", "'"
  $a = $a -replace "\\'", "'"
  $books += @{ title = $t; author = $a }
}

Write-Host "=== pass 1: drop ambiguous + bad matches ===" -ForegroundColor Cyan
foreach ($t in $ambiguous) {
  if ($covers.Contains($t)) { $covers.Remove($t); Write-Host "  dropped (ambiguous): $t" -ForegroundColor DarkYellow }
}
$recheck = @()
foreach ($b in $books) {
  if ($ambiguous -contains $b.title) { continue }
  if (-not $covers.Contains($b.title)) { $recheck += $b; continue }
  $s = TitleScore $b.title $covers[$b.title].matched
  if ($s -lt 0.8 -or $covers[$b.title].matched -match '(?i)graphic novel') {
    Write-Host ("  requeue: {0}  (was '{1}', score {2})" -f $b.title, $covers[$b.title].matched, $s) -ForegroundColor DarkYellow
    $covers.Remove($b.title)
    $recheck += $b
  }
}

Write-Host ""
Write-Host "=== pass 2: retry $($recheck.Count) ===" -ForegroundColor Cyan
foreach ($b in $recheck) {
  $docs = Lookup $b.title $b.author
  $m = BestMatch $b.title $b.author $docs
  if (-not $m) { $docs = Lookup $b.title $b.author -TitleOnly; $m = BestMatch $b.title $b.author $docs }
  if ($m) {
    $covers[$b.title] = [ordered]@{
      coverId = $m.doc.cover_i
      matched = $m.doc.title
      author  = ($m.doc.author_name -join ', ')
      year    = $m.doc.first_publish_year
    }
    Write-Host ("  OK  {0} -> {1} (cover {2}, score {3})" -f $b.title, $m.doc.title, $m.doc.cover_i, $m.score) -ForegroundColor Green
  } else {
    Write-Host ("  --  {0}  (no confident match; generated cover will be used)" -f $b.title) -ForegroundColor DarkYellow
  }
  Start-Sleep -Milliseconds 150
}

Write-Host ""
Write-Host "=== pass 3: verify every cover id serves an image ===" -ForegroundColor Cyan
$dead = @()
foreach ($k in @($covers.Keys)) {
  $id = $covers[$k].coverId
  try {
    $r = Invoke-WebRequest -Uri "https://covers.openlibrary.org/b/id/$id-M.jpg?default=false" -Method Get -UseBasicParsing -TimeoutSec 25 -Headers @{ 'User-Agent' = $ua }
    if ($r.StatusCode -ne 200 -or $r.RawContentLength -lt 900) { $dead += $k }
  } catch { $dead += $k }
  Start-Sleep -Milliseconds 400
}
foreach ($k in $dead) { Write-Host "  dead cover, dropped: $k" -ForegroundColor Red; $covers.Remove($k) }

$json = $covers | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($path, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host ""
Write-Host ("final: {0} real covers / {1} books" -f $covers.Count, $books.Count) -ForegroundColor Green
