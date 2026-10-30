// Prints which owned cards fall into each engine class for a commander, so the
// patterns in js/analysis/engines.js can be tuned by reading the matches.
//
// Usage: node dev/tools/jxa-harness/engine_matches.js "Greasefang, Okiba Boss"
//        node dev/tools/jxa-harness/engine_matches.js "Tormod, the Desecrator + Ghost of Ramirez DePietro"
const fs = require("fs");
const vm = require("vm");

for (const file of ["js/constants.js", "js/utils/text.js", "js/utils/cards.js", "js/format.js", "js/analysis/engines.js"]) {
  vm.runInThisContext(fs.readFileSync(file, "utf8"), { filename: file });
}

const owned = JSON.parse(fs.readFileSync("dev/tools/jxa-harness/owned_raw.json", "utf8"));
const prefetch = JSON.parse(fs.readFileSync("dev/tools/jxa-harness/prefetch_data.json", "utf8"));

function toCard(raw) {
  const faces = Array.isArray(raw.card_faces) ? raw.card_faces : [];
  const text = raw.oracle_text || faces.map((f) => f.oracle_text || "").join("\n");
  return {
    name: raw.name,
    type: String(raw.type_line || "").toLowerCase(),
    text: text.toLowerCase(),
    cmc: Number(raw.cmc || 0),
    colors: raw.color_identity || [],
    manaCost: raw.mana_cost || (faces[0] && faces[0].mana_cost) || "",
    raw
  };
}

const key = process.argv[2];
if (!key) throw new Error("pass a commander name or 'A + B' pair");
const names = key.split(" + ");
const cmdCards = names.map((n) => {
  const raw = prefetch.commanderCards[n];
  if (!raw) throw new Error(`no fixture for ${n}; run dev/tools/jxa-harness/prefetch.py`);
  return toCard(raw);
});
const colors = new Set(cmdCards.flatMap((c) => c.colors));
const needs = parseCommanderNeeds(cmdCards.map((c) => c.text));
console.log("needs:", JSON.stringify(needs), "colors:", Array.from(colors).join(""));

const byClass = {};
const seen = new Set();
for (const raw of owned) {
  if (seen.has(raw.name)) continue;
  seen.add(raw.name);
  const card = toCard(raw);
  if (card.type.split("—")[0].includes("land")) continue;
  if (!card.colors.every((c) => colors.has(c))) continue;
  for (const cls of getEngineClasses(card, needs)) (byClass[cls] = byClass[cls] || []).push(card.name);
}
for (const [cls, list] of Object.entries(byClass)) {
  console.log(`\n${cls} (${list.length}): ${list.slice(0, 60).join(", ")}${list.length > 60 ? ", ..." : ""}`);
}
