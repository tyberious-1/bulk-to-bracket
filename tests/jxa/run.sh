#!/bin/bash
# Usage: tests/jxa/run.sh <source files...> <test file>
# Concatenates helpers.js + the given source files + the test file, and
# runs the result under osascript, since this machine has no Node/Deno/Bun.
files=("$@")
count=${#files[@]}
test_file="${files[$((count-1))]}"
src_files=("${files[@]:0:$((count-1))}")

tmp=$(mktemp /tmp/jxa-test-XXXXXX.js)
cat tests/jxa/helpers.js "${src_files[@]}" "$test_file" > "$tmp"
osascript -l JavaScript "$tmp"
rm -f "$tmp"
