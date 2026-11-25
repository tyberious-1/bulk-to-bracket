#!/bin/bash
# Fetch the current Magic Comprehensive Rules (plain text) from Wizards.
# Usage (from the repo root): bash dev/tools/jxa-harness/fetch_comp_rules.sh [OUT_DIR]
# Default OUT_DIR is dev/tools/jxa-harness/rules/ (git-ignored, about 1 MB). Writes OUT_DIR/cr.txt.
# The file name changes with each release, so the script reads it off magic.wizards.com/en/rules.
# The digest of the rules that matter for reading cards is dev/docs/mtg-rules-primer.md; refresh it after a new release.
set -e
OUT="${1:-dev/tools/jxa-harness/rules}"
mkdir -p "$OUT"
URL=$(curl -sL -A "bulk-to-bracket-measure/1.0" "https://magic.wizards.com/en/rules" | grep -oE 'https://media\.wizards\.com/[^"]*MagicCompRules[^"]*\.txt' | head -1 | sed 's/ /%20/g')
[ -n "$URL" ] || { echo "could not find the rules text link" >&2; exit 1; }
curl -sL -A "bulk-to-bracket-measure/1.0" "$URL" -o "$OUT/cr.txt"
echo "$URL" > "$OUT/source.txt"
head -c 300 "$OUT/cr.txt" | tr -d '\r' | head -3
wc -l "$OUT/cr.txt"
