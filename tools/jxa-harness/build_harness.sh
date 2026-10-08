#!/bin/bash
# Usage: tools/jxa-harness/build_harness.sh <output.js>
# Concatenates prelude.js + the project's <script> files (index.html's
# order) into one runnable JXA script.
set -e
out="${1:-tools/jxa-harness/combined.js}"

scripts=(
  js/constants.js
  js/utils/text.js
  js/utils/cards.js
  js/format.js
  js/analysis/pairing.js
  js/collection/csv.js
  js/analysis/themes.js
  js/analysis/scoring.js
  js/api/http.js
  js/api/edhrec.js
  js/cache.js
  js/api/scryfall.js
  js/utils/deck-stats.js
  js/build/bracket.js
  js/build/manabase.js
  js/build/type-plan.js
  js/build/deck.js
  js/analysis/commander-match.js
)

cat tools/jxa-harness/prelude.js "${scripts[@]}" > "$out"
echo "wrote $out"
