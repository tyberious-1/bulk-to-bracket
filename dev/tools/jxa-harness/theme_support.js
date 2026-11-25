// Ad-hoc measure: how many owned, color-legal nonland cards each theme name matches through the builder's own local
// counter (findLocalThemeMatches), the same count deriveCommanderThemes uses to keep or drop a candidate theme.
// Usage (from the repo root): node dev/tools/jxa-harness/theme_support.js "<Commander Name>" "<theme>" ["<theme>" ...]
// The load list comes from build_harness.sh (up to plans.js), never by hand: a missing catalog-data.js hides every tribe.
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const root = process.cwd();
const harness = fs.readFileSync(path.join(root, "dev/tools/jxa-harness/build_harness.sh"), "utf8");
const all = /scripts=\(([\s\S]*?)\n\)/.exec(harness)[1].match(/js\/[\w\/.-]+\.js/g);
const files = all.slice(0, all.indexOf("js/analysis/plans.js") + 1);
const ctx = vm.createContext({});
for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
const T = vm.runInContext("({ findLocalThemeMatches, getCollectionEntries, convertScryfallCard, normalizeCardName, getCommanderCenter, sortColorsWubrg })", ctx);

const [cmdName, ...themes] = process.argv.slice(2);
const raw = JSON.parse(fs.readFileSync("dev/tools/jxa-harness/owned_raw.json", "utf8"));
const arr = (Array.isArray(raw) ? raw : Object.values(raw)).filter(Boolean);
const cmd = arr.find((c) => c.name === cmdName);
const colors = T.sortColorsWubrg(cmd.color_identity || []);
const counts = new Map();
const cards = new Map();
for (const c of arr) {
  const key = T.normalizeCardName(c.name);
  counts.set(key, (counts.get(key) || 0) + 1);
  if (!cards.has(key)) cards.set(key, T.convertScryfallCard(c));
}
const entries = [...counts.entries()].map(([normalizedName, quantity]) => ({ rawName: cards.get(normalizedName).name, normalizedName, quantity }));
const collection = { byNormalized: counts, byFrontFace: new Map(), entries, originals: entries, uniqueRawNames: entries.map((e) => e.rawName) };
for (const theme of themes) {
  const set = T.findLocalThemeMatches(theme, collection, cards, colors);
  console.log(theme.padEnd(18) + String(set.size).padStart(5) + "  e.g. " + [...set].slice(0, 5).join(", "));
}
