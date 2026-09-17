<#
  Queries Open Library for a cover id per book in catalogue.js and writes
  src/data/covers.json. Run again any time the catalogue grows.
#>
param(
  [string]$Root = "d:\Ponyo's library"
)
$ErrorActionPreference = 'Stop'
$ua = 'PonyosLittleLibrary/1.0 (personal offline library project)'

# The catalogue is split across src/data/catalogue/*.js — catalogue.js is
# only the aggregator now, and reading it would find no books at all.
$src = (Get-ChildItem (Join-Path $Root 'src\data\catalogue') -Filter '*.js' |
        Sort-Object Name |
        ForEach-Object { Get-Content $_.FullName -Raw }) -join "`n"

# Parse whole { ... } entries rather than matching titles and authors
# separately. Independent matches only line up while every entry has
# both fields in the same order, which is a silent trap waiting for the
# first entry that does not.
$blocks = [regex]::Matches($src, "(?ms)^  \{\r?\n(.*?)^  \},")
Write-Host "entries found: $($blocks.Count)"

$books = @()
foreach ($b in $blocks) {
  $body = $b.Groups[1].Value
  $tm = [regex]::Match($body, "(?m)^\s{4}title:\s*'((?:[^'\\]|\\.)*)'")
  $am = [regex]::Match($body, "(?m)^\s{4}author:\s*'((?:[^'\\]|\\.)*)'")
  if (-not $tm.Success) { continue }
  # A flagged row is one we could not identify. We do not know which book
  # it is, so we do not go looking for a picture of it.
  if ($body -match 'needsReview:\s*true') { continue }
  $books += [pscustomobject]@{
    Title  = $tm.Groups[1].Value -replace "\\'", "'"
    Author = if ($am.Success) { $am.Groups[1].Value -replace "\\'", "'" } else { '' }
  }
}
Write-Host "books to look up: $($books.Count)  (flagged rows skipped)"

$result = [ordered]@{}
$hit = 0; $miss = 0; $i = 0

foreach ($book in $books) {
  $t = $book.Title
  $a = $book.Author
  $i++

  # strip subtitle after a colon for a cleaner match
  $qTitle = ($t -split ':')[0].Trim()
  $qAuthor = ($a -split '&')[0].Trim()

  $url = "https://openlibrary.org/search.json?title=$([uri]::EscapeDataString($qTitle))"
  if ($qAuthor) { $url += "&author=$([uri]::EscapeDataString($qAuthor))" }
  $url += '&fields=title,author_name,cover_i,first_publish_year,edition_count&limit=5&sort=editions'

  try {
    $r = Invoke-RestMethod -Uri $url -Headers @{ 'User-Agent' = $ua } -TimeoutSec 25
    $doc = $r.docs | Where-Object { $_.cover_i } | Select-Object -First 1
    if ($doc) {
      $result[$t] = [ordered]@{
        coverId = $doc.cover_i
        matched = $doc.title
        author  = ($doc.author_name -join ', ')
        year    = $doc.first_publish_year
      }
      $hit++
      Write-Host ("  [{0,3}] OK   {1}  ->  cover {2}  ({3})" -f $i, $t, $doc.cover_i, $doc.title)
    } else {
      $miss++
      Write-Host ("  [{0,3}] --   {1}  (no cover)" -f $i, $t) -ForegroundColor DarkYellow
    }
  } catch {
    $miss++
    Write-Host ("  [{0,3}] ERR  {1}  {2}" -f $i, $t, $_.Exception.Message) -ForegroundColor Red
  }
  Start-Sleep -Milliseconds 120
}

$out = Join-Path $Root 'src\data\covers.json'
$json = $result | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($out, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host ""
Write-Host "hits: $hit   misses: $miss   -> $out" -ForegroundColor Green
