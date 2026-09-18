<#
  run-async.ps1 - run a harness that finishes when IT says so, not when
  the load event happens to fire.

  WHY THIS EXISTS, AND WHY run-checks.ps1 COULD NOT DO IT
  -------------------------------------------------------
  run-checks.ps1 grades a page by dumping its DOM. That works for the
  synchronous harnesses, and for anything whose async work is timers,
  because --virtual-time-budget fast-forwards those. The backup system
  is neither:

   * --dump-dom fires at the load event. A module doing real async work
     has not finished by then, so the dump captured one line ("probe
     start") and looked exactly like a hung harness.

   * --virtual-time-budget only advances virtual time when TIMERS are
     pending. CompressionStream, Blob.arrayBuffer and IndexedDB are not
     timers, so under a virtual clock the run stalls partway through and
     the stall point MOVES depending on how much work came before it.
     That is the worst kind of test failure: non-deterministic, and
     indistinguishable from a real bug in the code being tested.

  So this runner inverts the contract. Edge runs in REAL time with no
  budget and no DOM dump, and the harness tells us when it is done by
  POSTing its report to a one-shot listener. Nothing is inferred from
  page lifecycle at all.

  The harness gets its sink address from ?sink= in the query string, so
  it hardcodes no port and still works when opened by hand in a browser
  (no sink, no POST, report just renders on the page).

  Requires serve.ps1 to already be serving the project on -SitePort.
#>

param(
  [string]$Harness = 'tools/backup-check.html',
  [int]$SitePort = 8765,
  # The result sink. A separate port so serve.ps1 is left completely alone.
  [int]$SinkPort = 8799,
  [int]$TimeoutSec = 300,
  [string]$ProfileDir = 'async'
)
$ErrorActionPreference = 'Stop'
$edgeExe = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

# Same scratch discipline as run-checks.ps1: the project path contains a
# space AND an apostrophe, both of which Edge mishandles inside
# --user-data-dir, and it fails silently when it does.
$scratch = Join-Path $env:TEMP 'ponyo-checks'
if (-not (Test-Path $scratch)) { New-Item -ItemType Directory -Path $scratch | Out-Null }

# A leftover headless Edge holds the profile lock and makes this hang.
Get-Process msedge -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Throw the profile away every run. Edge caches the harness and every
# module it imports, and the local server sends no validator, so a stale
# profile can quietly grade the PREVIOUS version of the code.
$profilePath = Join-Path $scratch $ProfileDir
if (Test-Path $profilePath) { Remove-Item $profilePath -Recurse -Force -ErrorAction SilentlyContinue }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$SinkPort/")
try {
  $listener.Start()
} catch {
  Write-Host "  Could not open the result sink on port $SinkPort." -ForegroundColor Red
  Write-Host "  $($_.Exception.Message)"
  exit 1
}

$sink = "http://localhost:$SinkPort/result"
$url = "http://localhost:$SitePort/$Harness" + "?sink=" + [System.Uri]::EscapeDataString($sink)

$edgeArgs = @(
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
  '--disable-extensions', "--user-data-dir=`"$profilePath`"",
  # No --virtual-time-budget and no --dump-dom. Real time, real async.
  $url
)

$proc = Start-Process -FilePath $edgeExe -PassThru -NoNewWindow `
  -RedirectStandardOutput (Join-Path $scratch 'async.out') `
  -RedirectStandardError (Join-Path $scratch 'async.err') `
  -ArgumentList $edgeArgs

$report = $null
$async = $listener.BeginGetContext($null, $null)
if ($async.AsyncWaitHandle.WaitOne($TimeoutSec * 1000)) {
  $context = $listener.EndGetContext($async)
  $reader = New-Object System.IO.StreamReader($context.Request.InputStream, [System.Text.Encoding]::UTF8)
  $report = $reader.ReadToEnd()
  $reader.Close()
  # sendBeacon does not read the response, but it must not be left open.
  $context.Response.StatusCode = 204
  $context.Response.Close()
}

try { Stop-Process -Id $proc.Id -Force -ErrorAction Stop } catch { }
$listener.Stop()
$listener.Close()

if ([string]::IsNullOrWhiteSpace($report)) {
  Write-Host "NO REPORT after $TimeoutSec s. The harness never reached its finish line." -ForegroundColor Red
  Write-Host "Edge stderr (last 15 lines):"
  if (Test-Path (Join-Path $scratch 'async.err')) {
    Get-Content (Join-Path $scratch 'async.err') -Tail 15
  }
  exit 1
}

$report

# -cmatch, not -match: PowerShell comparisons are case-INSENSITIVE by
# default, and a harness with a scenario called "a failure partway
# through" would then fail a run in which every check passed. The marker
# the harnesses print is 'N FAILURE(S)', in capitals, so match that.
if ($report -cmatch 'FAILURE\(S\)') { exit 1 }
if ($report -cnotmatch 'ALL PASS') {
  Write-Host "No ALL PASS line in the report." -ForegroundColor Red
  exit 1
}
exit 0
