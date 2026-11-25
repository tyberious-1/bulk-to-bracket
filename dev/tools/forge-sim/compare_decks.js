// compare_decks.js <builder.dck> <reference.dck> <owned json> [<card json>...]: the builder's deck against a reference list
// for the same commander, on paper. Prints type and rough role counts (text patterns, not the app's role reader), shared
// cards, and the reference's cards that are owned but the builder left out (the most telling list: the builder had them).
const fs = require("fs");
const path = require("path");
const [bFile, rFile, ownedFile, ...more] = process.argv.slice(2);
if (!bFile || !rFile || !ownedFile) { console.error("usage: node compare_decks.js <builder.dck> <reference.dck> <owned json> [<card json>...]"); process.exit(1); }
const db = {};
const owned = new Set();
for (const r of require(path.resolve(ownedFile))) { db[r.name.split(" // ")[0]] = r; owned.add(r.name.split(" // ")[0]); }
for (const f of more) for (const r of require(path.resolve(f))) db[r.name.split(" // ")[0]] = db[r.name.split(" // ")[0]] || r;
// Alternate printing names: "Hope's Aero Magic (Cyclonic Rift)" is Cyclonic Rift; "森 (Forest)" is Forest.
const realName = (n) => { const m = /\(([^()]+)\)$/.exec(n); return m ? m[1] : n; };
const read = (f) => {
  const out = [];
  let sec = "";
  for (const l of fs.readFileSync(f, "utf8").split("\n")) {
    if (/^\[/.test(l)) { sec = l.toLowerCase(); continue; }
    const m = /^(\d+) ([^|]+)/.exec(l);
    if (m && sec === "[main]") out.push([Number(m[1]), realName(m[2].replace(/\+$/, "").trim())]);
  }
  return out;
};
const textOf = (c) => (c?.oracle_text || (c?.card_faces || []).map((f) => f.oracle_text).join(" ") || "").toLowerCase();
const typeOf = (c) => (c?.type_line || "").split("//")[0];
function stats(list) {
  const s = { lands: 0, creatures: 0, artifacts: 0, enchantments: 0, instantsSorceries: 0, ramp: 0, draw: 0, removal: 0, wipes: 0, mv: 0, nonland: 0, unknown: 0 };
  for (const [q, n] of list) {
    const c = db[n];
    if (!c) { s.unknown += q; continue; }
    const t = typeOf(c), x = textOf(c);
    if (/Land/.test(t)) { s.lands += q; continue; }
    s.nonland += q; s.mv += c.cmc * q;
    if (/Creature/.test(t)) s.creatures += q;
    else if (/Artifact/.test(t)) s.artifacts += q;
    else if (/Enchantment/.test(t)) s.enchantments += q;
    else if (/Instant|Sorcery/.test(t)) s.instantsSorceries += q;
    if (/add \{|search your library for (a|up to \w+) basic land|land cards? onto the battlefield/.test(x)) s.ramp += q;
    if (/draw (a|two|three|x|\w+) cards?/.test(x)) s.draw += q;
    if (/(destroy|exile) all|all creatures get -|each creature deals/.test(x)) s.wipes += q;
    else if (/(destroy|exile) target|deals? (\d+|x) damage to (any|target creature)|return target (creature|nonland)|counter target/.test(x)) s.removal += q;
  }
  s.mv = Number((s.mv / Math.max(1, s.nonland)).toFixed(2));
  delete s.nonland;
  return s;
}
const B = read(bFile), R = read(rFile);
const bNames = new Set(B.map(([, n]) => n)), rNames = new Set(R.map(([, n]) => n));
const basic = /^(Plains|Island|Swamp|Mountain|Forest|Wastes|Snow-Covered \w+)$/;
const shared = [...rNames].filter((n) => bNames.has(n) && !basic.test(n));
const missedOwned = [...rNames].filter((n) => !bNames.has(n) && owned.has(n) && !basic.test(n));
const notOwned = [...rNames].filter((n) => !owned.has(n) && !basic.test(n));
const bs = stats(B), rs = stats(R);
console.log(`stat                builder  reference`);
for (const k of Object.keys(bs)) console.log(`${k.padEnd(20)}${String(bs[k]).padEnd(9)}${rs[k]}`);
console.log(`shared nonbasic cards: ${shared.length} | reference cards not owned: ${notOwned.length} | owned but left out by the builder: ${missedOwned.length}`);
console.log(`owned, in the reference, not in the build: ${missedOwned.join("; ")}`);
