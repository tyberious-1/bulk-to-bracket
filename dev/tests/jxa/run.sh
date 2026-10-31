#!/bin/bash
# Usage: dev/tests/jxa/run.sh <source files...> <test file>
# Concatenates helpers.js + the given source files + the test file, and
# runs the result under osascript, since this machine has no Node/Deno/Bun.
files=("$@")
count=${#files[@]}
test_file="${files[$((count-1))]}"
src_files=("${files[@]:0:$((count-1))}")

tmp=$(mktemp /tmp/jxa-test-XXXXXX.js)
cat dev/tests/jxa/helpers.js "${src_files[@]}" "$test_file" > "$tmp"
if command -v osascript &> /dev/null; then
  osascript -l JavaScript "$tmp"
else
  node "$tmp"
fi
rm -f "$tmp"
