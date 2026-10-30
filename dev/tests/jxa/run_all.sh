#!/bin/bash
# Usage: bash dev/tests/jxa/run_all.sh [substring of a test file name]
# Runs every dev/tests/jxa/*.test.js with the full harness script list ahead of it (read from
# build_harness.sh, so the two cannot drift), plus the one ui file the commanders-tab,
# theme-tab and export suites need. Prints one line per suite.
base=($(sed -n '/^scripts=(/,/^)/p' dev/tools/jxa-harness/build_harness.sh | grep 'js/'))
for t in dev/tests/jxa/*.test.js; do
  if [ -n "$1" ] && [[ "$t" != *"$1"* ]]; then continue; fi
  case "$t" in
    *commanders-tab*) extra=(js/ui/commanders-tab.js);;
    *theme-tab*) extra=(js/ui/theme-tab.js);;
    *export*) extra=(js/ui/export.js);;
    *) extra=();;
  esac
  out=$(dev/tests/jxa/run.sh "${base[@]}" "${extra[@]}" "$t" 2>&1)
  echo "$(basename "$t"): $(echo "$out" | tail -2 | tr '\n' ' ')"
done
