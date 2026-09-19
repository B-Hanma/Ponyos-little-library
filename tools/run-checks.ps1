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
  # The result sink. A different port from run-async.ps1's 8799 so the
  # two runners can never collide.
  [int]$SinkPort = 8798,
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

# The result sink. A separate port, so serve.ps1 is left alone.
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
$url = "http://localhost:8765/$Harness" + "?sink=" + [System.Uri]::EscapeDataString($sink)

$edgeArgs = @(
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
  '--disable-extensions', "--user-data-dir=`"$scratch\$ProfileDir`"",
  # No --virtual-time-budget and no --dump-dom. Real time, real async.
  $url
)

$proc = Start-Process -FilePath $edgeExe -PassThru -NoNewWindow `
  -RedirectStandardOutput $dumpPath -RedirectStandardError $errPath `
  -ArgumentList $edgeArgs

# Wait for the harness to say it is finished.
$report = $null
$async = $listener.BeginGetContext($null, $null)
if ($async.AsyncWaitHandle.WaitOne($TimeoutSec * 1000)) {
  $context = $listener.EndGetContext($async)
  $reader = New-Object System.IO.StreamReader($context.Request.InputStream, [System.Text.Encoding]::UTF8)
  $report = $reader.ReadToEnd()
  $reader.Close()
  # sendBeacon never reads the response, but it must not be left open.
  $context.Response.StatusCode = 204
  $context.Response.Close()
} else {
  Write-Host "  (no report after $TimeoutSec s)" -ForegroundColor DarkYellow
}
$listener.Stop()
$listener.Close()
# No Wait-Process here any more.
#
# Nothing asks Edge to exit now: without --dump-dom it has no reason to,
# and we no longer need it to, because the report arrived over the sink
# above. Waiting for an exit that is never coming just burned the whole
# timeout before every teardown - which is why the first run of this
# transport still took 248s per suite while reporting ALL PASS.
#
# The report is in hand, so take the browser down immediately.
#
# Kill the TREE, not just the process we started.
#
# Stop-Process terminates one PID. Edge is a parent plus a tree of
# msedge.exe children - renderer, GPU, network, utility, crashpad - and
# killing the parent orphans every one of them. The orphans keep the
# profile directory locked, so the NEXT suite launches into a directory
# it cannot own, hangs, gets killed at the timeout and reports EMPTY
# DUMP. That is why the failure spreads to whichever suite runs next
# rather than staying with one.
#
# taskkill /T walks the tree; /F is required because a headless browser
# will not respond to a polite close.
# The try/catch is not optional. When Edge has already exited - the
# normal case - taskkill writes "process not found" to stderr, and
# PowerShell 5.1 turns a native command's redirected stderr into a
# terminating NativeCommandError under $ErrorActionPreference = 'Stop'.
# Without this, a clean run aborts the script right before it reads the
# dump, which looks exactly like the hang it was added to prevent.
try { & taskkill.exe /T /F /PID $proc.Id 2>&1 | Out-Null } catch { }
try { Stop-Process -Id $proc.Id -Force -ErrorAction Stop } catch { }

# ...and wait for the tree to actually be gone before returning, so the
# next suite starts on clean ground.
$goneBy = (Get-Date).AddSeconds(15)
while ((Get-Process msedge -ErrorAction SilentlyContinue) -and (Get-Date) -lt $goneBy) {
  Start-Sleep -Milliseconds 250
}

if ([string]::IsNullOrWhiteSpace($report)) {
  'NO REPORT. The harness never reached its finish line. Edge stderr:'
  # 40 rather than 5: when this fires, the last five lines are always the
  # same benign Chromium chatter (an Edge LLM notice on Server SKUs, a
  # renderer task-provider warning) and whatever actually went wrong has
  # already scrolled past.
  Get-Content $errPath -Tail 40
  exit 1
}

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
