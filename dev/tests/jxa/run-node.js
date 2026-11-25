// Node fallback for run.sh when osascript is absent (Linux). Same contract as run.sh: argv is
// the source files followed by the test file, all relative to the repo root. The files are
// concatenated behind helpers.js, with a node jxaPrint that replaces helpers.js's JXA one (its
// `$` is JXA-only), then run as plain global scripts. Exits 1 if any suite prints SUITE FAILED
// or the script throws, so a failure stays visible to callers.
const fs = require("fs");
const vm = require("vm");

const nodeShim = `
function jxaPrint(s) {
  if (s === "SUITE FAILED") process.exitCode = 1;
  process.stdout.write(s + "\\n");
}
`;

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node dev/tests/jxa/run-node.js <source files...> <test file>");
  process.exit(2);
}
const helpers = fs.readFileSync("dev/tests/jxa/helpers.js", "utf8");
const parts = [helpers, nodeShim];
for (const f of files) parts.push(fs.readFileSync(f, "utf8"));
try {
  vm.runInThisContext(parts.join("\n;\n"), { filename: files[files.length - 1] });
} catch (err) {
  process.stdout.write("FAIL " + files[files.length - 1] + ": " + (err && err.stack || err) + "\n");
  process.exitCode = 1;
}
