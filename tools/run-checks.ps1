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

# ...and then WAIT for them to actually be gone.
#
# Stop-Process does not block. It asks Windows to terminate the process
# and returns immediately, so the next few lines delete the profile
# directory and launch a fresh Edge while the old one is still dying.
# The new browser then hangs, produces an empty dump, and gets killed at
# the timeout - which looks exactly like a broken harness and is not one.
#
# This is what the Application suites hit in CI: they run straight after
# five run-async.ps1 Edge sessions, and only the FIRST suite failed,
# which is the signature of debris rather than of a bad test.
$deadline = (Get-Date).AddSeconds(15)
while ((Get-Process msedge -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 250
}
if (Get-Process msedge -ErrorAction SilentlyContinue) {
  Write-Host '  (msedge processes are still alive after 15 s; continuing anyway)' -ForegroundColor DarkYellow
}

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
  '--disable-extensions', "--user-data-dir=`"$scratch\$ProfileDir`"",
  # Make the suites hermetic.
  #
  # Rendering the shelf fires ~159 requests at covers.openlibrary.org.
  # Not one assertion in any of these four suites depends on those
  # images arriving: they check cover POLICY and the verified registry,
  # which are pure data. The real image-failure path is cover-check's
  # job, and that runs under run-async.ps1, which this does not touch.
  #
  # What the requests DO is make every run depend on a third-party CDN
  # being reachable and quick from wherever CI happens to be. Measured
  # locally that was 35 of regress's 102 seconds, and a rate-limited or
  # slow datacentre route makes it unbounded.
  #
  # 127.0.0.1 rather than a black-hole address on purpose: nothing is
  # listening on :443 there, so each request is refused immediately
  # instead of waiting out a connect timeout.
  #
  # It must arrive as ONE argument. Unquoted, the spaces split it and
  # Edge reads the remainder as a second URL - "Multiple targets are
  # not supported in headless mode" - which is the same trap that the
  # $ProfileDir comment at the top of this file describes.
  '--host-resolver-rules="MAP covers.openlibrary.org 127.0.0.1"'
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
  # 40 rather than 5: when this fires, the last five lines are always the
  # same benign Chromium chatter (an Edge LLM notice on Server SKUs, a
  # renderer task-provider warning) and whatever actually went wrong has
  # already scrolled past.
  Get-Content $errPath -Tail 40
  exit 1
}

$match = [regex]::Match($dom, '(?s)<pre id="out"[^>]*>(.*?)</pre>')
if (-not $match.Success) {
  'NO REPORT ELEMENT; first 900 chars:'
  $dom.Substring(0, [Math]::Min(900, $dom.Length))
  exit 1
}

$report = [System.Net.WebUtility]::HtmlDecode($match.Groups[1].Value)
$report

# ---------------------------------------------------------------- grading
#
# Until now this script printed the report and stopped. It had exactly one
# exit statement - the empty-dump branch above - so on success it fell off
# the end and never set an exit code at all. PowerShell leaves
# $LASTEXITCODE at its previous value in that case, which meant one real
# failure marked every later suite as failed too, and, far worse, a suite
# full of genuine FAIL lines returned whatever the last run happened to
# leave behind. CI could not see a failing test.
#
# Every path below sets a code explicitly.
#
# -cmatch, not -match: PowerShell comparison operators are case-
# INSENSITIVE by default, and "fallback" contains "fail".
# '^\s*FAIL' catches all three spellings the harnesses emit: the per-check
# 'FAIL  <label>', regress's 'N FAILURES', and smoke's 'N FAILURE(S)'.
if ($report -cmatch '(?m)^\s*FAIL') { exit 1 }

# A report can also be wrong by being short. Every harness ends with a
# marker: regress prints both 'ALL PASS' and '<<END>>', smoke and
# responsive print 'ALL PASS', and catalogue-check prints only '<<END>>'
# because it has no pass/fail vocabulary of its own. Requiring one of the
# two catches a run that died partway with nothing marked FAIL.
if ($report -cnotmatch 'ALL PASS' -and $report -cnotmatch '<<END>>') {
  Write-Host 'No completion marker in the report; it is truncated.' -ForegroundColor Red
  exit 1
}

exit 0
