<#
  run.ps1 — load a harness page in headless Edge and print the
  <pre id="out"> it built.

  Three things learned the hard way, all worth keeping:

   * Edge's stdout is empty when captured with `&`. It has to be
     redirected to a file by Start-Process.
   * --virtual-time-budget only works for harnesses that avoid
     IndexedDB. IndexedDB does not participate in virtual time, so the
     real boot path hangs forever under it. Harnesses use the memory
     adapter instead.
   * $Profile is a PowerShell automatic variable. A param called
     $Profile expands to the profile SCRIPT PATH, which contains a
     space, which splits --user-data-dir into two arguments, the second
     of which Edge reads as a second URL: "Multiple targets are not
     supported in headless mode".
#>
param(
  [string]$Harness = 'tools/regress.html',
  [int]$BudgetMs = 90000,
  [int]$TimeoutSec = 180,
  [string]$ProfileDir = 'run',
  # Drop --virtual-time-budget. Needed by any harness that touches real
  # IndexedDB, which does not participate in virtual time and will hang
  # forever under it. --dump-dom waits for the load event either way, and
  # a module's top-level await delays that, so the report still arrives.
  [switch]$RealTime
)
$ErrorActionPreference = 'Stop'
$edgeExe = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

# Scratch files live in TEMP, never beside the script.
#
# The project folder is "D:\Ponyo's library" — a path containing both a
# space and an apostrophe. Edge handles neither well inside
# --user-data-dir, and the failure is silent: it starts, never loads the
# page, never exits, and leaves an empty dump behind. Keeping the profile
# and the dump somewhere boring avoids the whole class of problem.
$scratch = Join-Path $env:TEMP 'ponyo-checks'
if (-not (Test-Path $scratch)) { New-Item -ItemType Directory -Path $scratch | Out-Null }
$dumpPath = Join-Path $scratch 'dom.html'
$errPath = Join-Path $scratch 'dom.err'

# A headless Edge left over from an earlier run will make this one hang
# waiting for a profile lock, and the symptom is an empty dump with no
# error — which looks exactly like a broken harness. Clear the field.
Get-Process msedge -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Throw the browser profile away between runs.
#
# This is not tidiness. Edge caches the harness page AND every module it
# imports in the profile's disk cache, and the local server offers no
# validator, so a run can quietly grade the PREVIOUS version of the code.
# The symptom is worse than a stale pass: an edited harness produces a
# byte-identical dump, which reads as "my change did nothing" when in
# fact the change was never loaded. A fresh profile costs about a second
# and removes the entire class of problem.
$profilePath = Join-Path $scratch $ProfileDir
if (Test-Path $profilePath) { Remove-Item $profilePath -Recurse -Force -ErrorAction SilentlyContinue }

$edgeArgs = @(
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
  '--disable-extensions', "--user-data-dir=`"$scratch\$ProfileDir`""
)
if (-not $RealTime) { $edgeArgs += "--virtual-time-budget=$BudgetMs" }
$edgeArgs += '--dump-dom'
$edgeArgs += "http://localhost:8765/$Harness"

$proc = Start-Process -FilePath $edgeExe -PassThru -NoNewWindow `
  -RedirectStandardOutput $dumpPath -RedirectStandardError $errPath `
  -ArgumentList $edgeArgs
# Wait-Process THROWS on timeout, and with $ErrorActionPreference = 'Stop'
# that aborts the script before the cleanup below — leaving a headless
# Edge running, which then makes every later run hang too. Catch it.
try { $proc | Wait-Process -Timeout $TimeoutSec -ErrorAction Stop }
catch { Write-Host "  (Edge did not exit in $TimeoutSec s; killing it)" -ForegroundColor DarkYellow }
try { Stop-Process -Id $proc.Id -Force -ErrorAction Stop } catch { }

$dom = Get-Content $dumpPath -Raw
if ([string]::IsNullOrEmpty($dom)) {
  'EMPTY DUMP. Edge stderr:'
  Get-Content $errPath -Tail 5
  exit 1
}
$match = [regex]::Match($dom, '(?s)<pre id="out"[^>]*>(.*?)</pre>')
if ($match.Success) { [System.Net.WebUtility]::HtmlDecode($match.Groups[1].Value) }
else { 'NO REPORT ELEMENT; first 900 chars:'; $dom.Substring(0, [Math]::Min(900, $dom.Length)) }
