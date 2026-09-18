#!/usr/bin/env bash
#
# sync-frontend.sh — stage the frontend for bundling.
#
# The app has no build step and is not getting one. `index.html` loads
# `src/main.js` as a plain ES module and every path in the project is
# relative, so the frontend that ships is byte-for-byte the frontend that
# runs at localhost:8765. This script copies it; it does not transform it.
#
# It exists because `frontendDist` bundles a WHOLE directory, and the
# repository root also holds `.git`, `tools/` and `src-tauri/` itself —
# none of which belong inside a 15 MB gift, and one of which would make
# the bundle contain a copy of its own build output.
#
# Paths are resolved from this script's own location, so it does not care
# where it is called from.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/.." && pwd)"
dist="$root/dist"

rm -rf "$dist"
mkdir -p "$dist"

# Exactly what the browser loads, and nothing else.
cp "$root/index.html" "$dist/"
cp -R "$root/src" "$dist/src"
cp -R "$root/styles" "$dist/styles"
cp -R "$root/assets" "$dist/assets"

# The entry point has to survive the copy, or the window opens blank.
test -f "$dist/index.html"
test -f "$dist/src/main.js"
test -f "$dist/src/storage/platform.js"
test -f "$dist/assets/ponyo/manifest.json"
grep -q 'src/main.js' "$dist/index.html"

echo "staged $(du -sh "$dist" | cut -f1) into dist/"
