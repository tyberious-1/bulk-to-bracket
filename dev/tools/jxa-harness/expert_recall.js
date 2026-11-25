// Expert-list recall: for each commander in a decks file, read the commander with the repo's own center reader and report
// which of the expert's non-land picks the reader links to the commander and which it does not (2026-11-17).
//
// This measures what the READER SEES, not whether the deck is good. An unlinked pick is a lead to read (a plan the reader
// cannot see, or a generic role card that should not link), never a failure. Linked picks can also be false links.
//
// Usage (from the repo root):  node dev/tools/jxa-harness/expert_recall.js [decks.js]  > out.txt
//   decks.js (default dev/tools/jxa-harness/expert_lists/decks.js, git-ignored: they are other people's lists) is
//   module.exports = { "<Commander Name>": "<one non-land card name per line>", ... }
//   A name may be "Front // Back" or "Printed Name (Real Card Name)" for flavour-named printings.
// Sends Scryfall only card names (collection endpoint) with a generic user agent.
//
// Measuring trap (2026-11-17): the reader needs the app's real load order. js/analysis/catalog-data.js defines
// CATALOG_CREATURE_TYPES; without it every tribe line except a few (elves, dwarves) reads as nothing and the report lies.
// So the file list is read from build_harness.sh, up to engines.js, and never hand-written.
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const root = process.cwd();
const harness = fs.readFileSync(path.join(root, "dev/tools/jxa-harness/build_harness.sh"), "utf8");
const block = /scripts=\(([\s\S]*?)\n\)/.exec(harness);
if (!block) throw new Error("could not read the scripts list from build_harness.sh");
const all = block[1].match(/js\/[\w\/.-]+\.js/g);
const files = all.slice(0, all.indexOf("js/analysis/engines.js") + 1);

const ctx = vm.createContext({});
for (const file of files) vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), ctx, { filename: file });
const R = vm.runInContext("({ getCommanderCenter, parseCommanderNeeds, getCenterLinks, getEngineBonus, sanitizeCard })", ctx);
const decks = require(path.resolve(process.argv[2] || "dev/tools/jxa-harness/expert_lists/decks.js"));

function lookupName(printed) {
  const paren = /\(([^)]+)\)\s*$/.exec(printed);
  if (paren) return paren[1].trim();
  return printed.split(" // ")[0].trim();
}

async function scryfall(names) {
  const out = new Map();
  const list = [...new Set(names)];
  for (let i = 0; i < list.length; i += 70) {
    const r = await fetch("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "bulk-to-bracket-measure/1.0", Accept: "application/json" },
      body: JSON.stringify({ identifiers: list.slice(i, i + 70).map((name) => ({ name })) })
    });
    const j = await r.json();
    for (const c of j.data || []) out.set(c.name.split(" // ")[0].toLowerCase(), c);
  }
  return out;
}

function toCard(c) {
  const faces = c.card_faces || [];
  const text = c.oracle_text || faces.map((f) => f.oracle_text || "").join("\n");
  const type = c.type_line || (faces[0] && faces[0].type_line) || "";
  return R.sanitizeCard({
    name: c.name, type_line: type, oracle_text: text, cmc: c.cmc,
    power: c.power != null ? c.power : faces[0] && faces[0].power,
    toughness: c.toughness != null ? c.toughness : faces[0] && faces[0].toughness,
    raw: c
  });
}

(async () => {
  const commanders = Object.keys(decks);
  const names = [];
  for (const cmd of commanders) for (const line of decks[cmd].split("\n")) if (line.trim()) names.push(lookupName(line.trim()));
  const data = await scryfall([...names, ...commanders.map((c) => c.split(" // ")[0])]);
  for (const cmd of commanders) {
    const cdata = data.get(cmd.split(" // ")[0].toLowerCase());
    console.log("\n==== " + cmd);
    if (!cdata) { console.log("commander not found"); continue; }
    const texts = (cdata.oracle_text || (cdata.card_faces || []).map((f) => f.oracle_text).join("\n")).split("\n").filter(Boolean);
    const center = R.getCommanderCenter(texts);
    console.log("commander text: " + texts.join(" / ").slice(0, 400));
    console.log("reader center: " + (center.map((c) => c.kind + (c.measure ? "/" + c.measure : "") + (c.kw ? "/" + c.kw : "") + (c.type ? "/" + c.type : "")).join(", ") || "(nothing)"));
    const needs = R.parseCommanderNeeds(texts);
    const linked = [], unlinked = [], missing = [];
    for (const line of decks[cmd].split("\n")) {
      const printed = line.trim();
      if (!printed) continue;
      const c = data.get(lookupName(printed).toLowerCase());
      if (!c) { missing.push(printed); continue; }
      const links = R.getCenterLinks(toCard(c), needs);
      const bonus = R.getEngineBonus(toCard(c), needs);
      (links.length ? linked : unlinked).push({ name: c.name, cmc: c.cmc, type: (c.type_line || "").split(" — ")[0], links: links.map((l) => l.link).join("+"), bonus });
    }
    console.log("non-land picks read: " + (linked.length + unlinked.length) + "; linked: " + linked.length + "; unlinked: " + unlinked.length + (missing.length ? "; not found: " + missing.join(", ") : ""));
    console.log("LINKED:");
    for (const x of linked) console.log("  " + x.name + " [" + x.links + "] bonus " + x.bonus);
    console.log("UNLINKED:");
    for (const x of unlinked) console.log("  " + x.name + " (" + x.cmc + ", " + x.type + ")" + (x.bonus ? " bonus " + x.bonus : ""));
  }
})();
