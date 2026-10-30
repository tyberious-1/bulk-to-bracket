// Prints, for a commander, the events its own abilities run on and the owned in-color cards that
// produce each event, so a person can read the lists. A trailing * marks a weak producer (expensive
// per use); "flawed" lists what costs a card points.
// Usage: node dev/tools/jxa-harness/event_producers.js "Omnath, Locus of Rage" [more commanders...]
//        node dev/tools/jxa-harness/event_producers.js --limit 60 "Kuja, Genome Sorcerer"
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const root = path.join(__dirname, "../../..");
for (const file of ["js/constants.js", "js/utils/text.js", "js/utils/cards.js", "js/format.js", "js/analysis/abilities.js", "js/analysis/engines.js"]) {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
}
const owned = JSON.parse(fs.readFileSync(path.join(__dirname, "owned_raw.json"), "utf8"));
const prefetch = JSON.parse(fs.readFileSync(path.join(__dirname, "prefetch_data.json"), "utf8"));

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

const args = process.argv.slice(2);
let limit = 40;
if (args[0] === "--limit") { limit = Number(args[1]); args.splice(0, 2); }
if (!args.length) throw new Error("pass one or more commander names (keys of prefetch_data.json commanderCards, or 'A + B' for a pair)");

const seen = new Set();
const pool = [];
for (const raw of owned) {
  if (seen.has(raw.name)) continue;
  seen.add(raw.name);
  pool.push(toCard(raw));
}

for (const key of args) {
  const cards = key.split(" + ").map((n) => {
    const raw = prefetch.commanderCards[n];
    if (!raw) throw new Error(`no fixture for ${n}`);
    return toCard(raw);
  });
  const colors = new Set(cards.flatMap((c) => c.colors));
  const needs = parseCommanderNeeds(cards.map((c) => c.text));
  console.log(`== ${key} | events: ${JSON.stringify(needs.events)}`);
  if (!needs.events.length) { console.log("   no events"); continue; }
  const byEvent = new Map();
  for (const card of pool) {
    if (!card.colors.every((c) => colors.has(c))) continue;
    if (cards.some((c) => c.name === card.name)) continue;
    for (const p of getEventProducers(card, needs)) {
      if (!byEvent.has(p.event)) byEvent.set(p.event, []);
      byEvent.get(p.event).push({ card, p });
    }
  }
  for (const [event, rows] of byEvent) {
    // Strong producers first, then cheaper, so the head of the list is what a build would reach for.
    rows.sort((a, b) => (a.p.weak - b.p.weak) || (a.card.cmc - b.card.cmc) || a.card.name.localeCompare(b.card.name));
    const strong = rows.filter((r) => !r.p.weak).length;
    console.log(`   ${event}: ${rows.length} producers (${strong} strong), first ${Math.min(limit, rows.length)}:`);
    for (const { card, p } of rows.slice(0, limit)) {
      const flawed = p.flaws.length ? `; flawed: ${p.flaws.join(", ")}` : "";
      console.log(`     ${card.name}${p.weak ? "*" : ""} [cmc ${card.cmc}] (${p.via}${flawed})`);
    }
  }
}
