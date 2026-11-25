#!/bin/bash
# Usage: dev/tests/jxa/run.sh <source files...> <test file>
# Concatenates helpers.js + the given source files + the test file, and runs the result under
# osascript (macOS). Where osascript is absent (Linux) it runs the same files under node via
# dev/tests/jxa/run-node.js. Run from the repo root.
files=("$@")
count=${#files[@]}
test_file="${files[$((count-1))]}"
src_files=("${files[@]:0:$((count-1))}")

if ! command -v osascript >/dev/null 2>&1; then
  exec node dev/tests/jxa/run-node.js "${src_files[@]}" "$test_file"
fi
tmp=$(mktemp /tmp/jxa-test-XXXXXX.js)
cat dev/tests/jxa/helpers.js "${src_files[@]}" "$test_file" > "$tmp"
osascript -l JavaScript "$tmp"
rc=$?
rm -f "$tmp"
exit $rc
