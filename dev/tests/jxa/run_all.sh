#!/bin/bash
# Usage: bash dev/tests/jxa/run_all.sh [substring of a test file name]
# Runs every dev/tests/jxa/*.test.js with the full harness script list ahead of it (read from
# build_harness.sh, so the two cannot drift), plus the one ui file the commanders-tab,
# theme-tab and export suites need. Prints one line per suite: the last lines of its output,
# and "CRASHED (exit N)" when the run exited nonzero without printing a SUITE line. A failing test in any
# suite of the file is named on that line, since only the last suite's lines are shown.
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
  rc=$?
  summary=$(echo "$out" | tail -2 | tr '\n' ' ')
  if [ $rc -ne 0 ] && ! echo "$out" | grep -q "^SUITE "; then summary="CRASHED (exit $rc): $summary"; fi
  # A file can hold several suites; only the last prints in the summary, so name any failure from an earlier one.
  failed=$(echo "$out" | grep "^FAIL " | head -3 | tr "\n" " ")
  if [ -n "$failed" ]; then summary="SUITE FAILED: $failed| $summary"; fi
  echo "$(basename "$t"): $summary"
done
