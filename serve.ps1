<#
  serve.ps1 — a tiny static file server for Ponyo's Little Library.

  The app is built from ES modules, which browsers refuse to load over
  file:// for security reasons. So it needs to be served over http://.

  This script uses only what ships with Windows — no Node, no Python,
  no installs. Double-click start-library.bat instead of running this
  directly if you would rather not think about PowerShell.

  Stop the server with Ctrl+C, or just close the window.
#>

param(
  [int]$Port = 8765,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.mjs'  = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.ico'  = 'image/x-icon'
  '.woff2'= 'font/woff2'
  '.txt'  = 'text/plain; charset=utf-8'
  '.md'   = 'text/markdown; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
  $listener.Start()
} catch {
  Write-Host ""
  Write-Host "  Could not open port $Port." -ForegroundColor Red
  Write-Host "  Something else may be using it. Try:  .\serve.ps1 -Port 8890"
  Write-Host ""
  exit 1
}

$url = "http://localhost:$Port/"
Write-Host ""
Write-Host "  Ponyo's Little Library" -ForegroundColor Cyan
Write-Host "  serving $root"
Write-Host "  open  $url" -ForegroundColor Green
Write-Host "  press Ctrl+C to stop"
Write-Host ""

if (-not $NoBrowser) { Start-Process $url }

while ($listener.IsListening) {
  try {
    $context = $listener.GetContext()
  } catch {
    break
  }

  $response = $context.Response
  try {
    $path = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath)
    if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }

    # Resolve inside the project folder and refuse anything that escapes it.
    $target = Join-Path $root ($path.TrimStart('/') -replace '/', '\')
    $full = [System.IO.Path]::GetFullPath($target)

    if (-not $full.StartsWith([System.IO.Path]::GetFullPath($root), [System.StringComparison]::OrdinalIgnoreCase)) {
      $response.StatusCode = 403
      $body = [System.Text.Encoding]::UTF8.GetBytes('Forbidden')
    } elseif (Test-Path -LiteralPath $full -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $type = $mime[$ext]
      if (-not $type) { $type = 'application/octet-stream' }
      $response.ContentType = $type
      $response.Headers.Add('Cache-Control', 'no-cache')
      $body = [System.IO.File]::ReadAllBytes($full)
      $response.StatusCode = 200
    } else {
      $response.StatusCode = 404
      $response.ContentType = 'text/plain; charset=utf-8'
      $body = [System.Text.Encoding]::UTF8.GetBytes("Not found: $path")
    }

    $response.ContentLength64 = $body.Length
    $response.OutputStream.Write($body, 0, $body.Length)
  } catch {
    Write-Host "  ! $($_.Exception.Message)" -ForegroundColor DarkYellow
  } finally {
    $response.Close()
  }
}

$listener.Stop()
