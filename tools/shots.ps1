<#
  shots.ps1 -- photograph the app.

  Loads tools/shot.html in headless Edge and saves a PNG per view, so a
  change can be LOOKED at rather than only asserted about.

  Two things that cost an hour each the first time:

   * --screenshot fires at the load event, which arrives before a module
     with a top-level await has finished. shot.html therefore does its
     waiting inside the module, and the module's final await is what
     delays load -- so by the time the picture is taken the page is
     actually built.
   * --virtual-time-budget freezes rAF, which freezes the world stage and
     the Library Mode camera. So these run in REAL time, with a wait.

  Output: %TEMP%\ponyo-shots\<name>.png
#>
param(
  [int]$Width = 1440,
  [int]$Height = 960,
  [string[]]$Views = @('home', 'library', 'building', 'dna', 'stats', 'settings')
)
$ErrorActionPreference = 'Stop'
$edgeExe = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

$shots = Join-Path $env:TEMP 'ponyo-shots'
if (-not (Test-Path $shots)) { New-Item -ItemType Directory -Path $shots | Out-Null }
$scratch = Join-Path $env:TEMP 'ponyo-checks'
if (-not (Test-Path $scratch)) { New-Item -ItemType Directory -Path $scratch | Out-Null }

Get-Process msedge -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

function Shoot($name, $query) {
  $png = Join-Path $shots "$name.png"
  if (Test-Path $png) { Remove-Item $png -Force }

  # A fresh profile per shot: Edge caches modules aggressively and the
  # local server offers no validator, so a reused profile photographs
  # the code as it was an edit ago.
  $profileDir = Join-Path $scratch "shot-$name"
  if (Test-Path $profileDir) { Remove-Item $profileDir -Recurse -Force -ErrorAction SilentlyContinue }

  $edgeArgs = @(
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--disable-extensions',
    '--hide-scrollbars',
    # --screenshot fires at the load event, and this Edge build does not
    # wait for a module's top-level await before firing it -- so without
    # this the picture is of an empty page. Virtual time fast-forwards
    # the timers AND holds the screenshot until the budget is spent,
    # which also means entrance animations have finished and the picture
    # is of the settled page rather than a frame mid-fade.
    # Safe here only because shot.html uses the memory adapter: real
    # IndexedDB does not participate in virtual time and would hang.
    '--virtual-time-budget=12000',
    "--user-data-dir=`"$profileDir`"",
    "--window-size=$Width,$Height",
    "--screenshot=`"$png`"",
    "http://localhost:8765/tools/shot.html?$query"
  )
  $proc = Start-Process -FilePath $edgeExe -PassThru -NoNewWindow -ArgumentList $edgeArgs `
    -RedirectStandardOutput (Join-Path $scratch 'shot.out') `
    -RedirectStandardError (Join-Path $scratch 'shot.err')
  try { $proc | Wait-Process -Timeout 60 -ErrorAction Stop } catch { }
  try { Stop-Process -Id $proc.Id -Force -ErrorAction Stop } catch { }

  if (Test-Path $png) {
    $kb = [math]::Round((Get-Item $png).Length / 1KB)
    Write-Host ("  {0,-22} {1,6} KB   {2}" -f $name, $kb, $png)
  } else {
    Write-Host ("  {0,-22} NO IMAGE" -f $name) -ForegroundColor Red
  }
}

Write-Host ""
foreach ($v in $Views) { Shoot $v "view=$v" }
Write-Host ""
Write-Host "  shots in $shots"
