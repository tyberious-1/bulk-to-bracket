#!/bin/bash
# Zips just the app: index.html, pauper.html, style.css, js/ and README.md (about 0.6 MB).
# Leaves out tools/ (fixtures, one of them a friend's collection), tests/, docs/, .git and any
# personal CSV, so nothing private or heavy goes along.
#
# Usage: bash dev/tools/make-app-zip.sh [output.zip]
# Default output: bulk-to-bracket-app.zip next to the repo folder (outside it, so it is never
# zipped into itself or committed).
set -e
cd "$(dirname "$0")/../.."
out="${1:-../bulk-to-bracket-app.zip}"
for f in index.html pauper.html style.css README.md js; do
  [ -e "$f" ] || { echo "missing: $f" >&2; exit 1; }
done
rm -f "$out"
zip -r -q "$out" index.html pauper.html style.css README.md js -x '*.DS_Store'
echo "wrote $out"
unzip -l "$out" | tail -1
