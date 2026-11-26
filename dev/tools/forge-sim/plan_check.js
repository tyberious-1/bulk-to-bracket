// plan_check.js <log> <card json>...: did each deck play its commander's plan? Per deck, averaged per game.
// Universal: any duel or pod log. The plan events per commander live in plan_rules.js; a commander with no entry gets the
// generic checks only: its own triggers, and casts of the creature types its text names (Elves, Vampires...).
// General stats (wins, commander cast turn, spells, attackers, draws) come from parse.js, plan_turns.js and gamesum.js.
// <card json>: Scryfall card arrays (as dev/tools/jxa-harness/fetch_owned.py writes) covering the decks' cards and commanders.
// Limits: the log has no enter-the-battlefield line, so "put in attacking" is an undeclared attacker seen in that combat;
// declined optional triggers are invisible; a creature stays "suited" after its Equipment moves.
const fs = require("fs");
const path = require("path");
const { baseName, shortName, clockMs } = require("./common");
const RULES = require("./plan_rules");

const [log, ...dbs] = process.argv.slice(2);
if (!log || !dbs.length) { console.error("usage: node plan_check.js <log> <card json>..."); process.exit(1); }
const db = {};
for (const f of dbs) for (const r of require(path.resolve(f))) db[r.name.split(" // ")[0]] = r;
const typeOf = (n) => (db[n]?.type_line || "").split("//")[0];
const cmcOf = (n) => Number(db[n]?.cmc || 0);
const textOf = (n) => db[n] ? (db[n].oracle_text || (db[n].card_faces || []).map((f) => f.oracle_text).join("\n") || "") : "";

// Creature types any known card has, for the generic "types the commander names" rule.
const creatureTypes = new Set();
for (const r of Object.values(db)) {
  const [front, sub] = (r.type_line || "").split("//")[0].split("—");
  if (/Creature/.test(front || "") && sub) for (const t of sub.trim().split(/\s+/)) creatureTypes.add(t);
}
// Artifact and enchantment subtypes that also sit on creature type lines (reconfigure, Vehicle creatures).
for (const t of ["Equipment", "Vehicle", "Aura", "Saga", "Food", "Clue", "Treasure", "Blood"]) creatureTypes.delete(t);
const plural = { Elf: "Elves", Dwarf: "Dwarves", Wolf: "Wolves" };
function genericRules(commander) {
  const text = textOf(commander);
  const named = [...creatureTypes].filter((t) => new RegExp(`\\b(${t}|${plural[t] || t + "s"})\\b`).test(text));
  return [
    { label: "commander triggers", on: "trigger", when: (e) => e.source === commander },
    ...named.map((t) => ({ label: `${t} cards cast`, on: "cast", when: (e) => new RegExp(`\\b${t}\\b`).test(typeOf(e.card)) })),
  ];
}
const rulesCache = {};
function rulesFor(player) {
  const commander = baseName(player);
  if (!rulesCache[commander]) {
    const own = RULES[commander] || [];
    const generic = genericRules(commander).filter((g) => !own.some((r) => r.label === g.label));
    rulesCache[commander] = [...own, ...generic];
  }
  return rulesCache[commander];
}

const games = [];
let g;
const newGame = () => { g = { stats: {}, owner: {}, suited: new Set(), declared: new Set(), turn: null, winner: null }; games.push(g); };
newGame();
const helpers = { typeOf, cmcOf, suited: (id) => g.suited.has(id) };
function emit(player, kind, e) {
  if (!player) return;
  const s = (g.stats[player] = g.stats[player] || {});
  for (const r of rulesFor(player)) {
    if (r.on !== kind || !r.when(e, helpers)) continue;
    s[r.label] = (s[r.label] || 0) + (r.amount ? r.amount(e) : 1);
  }
}
const who = (s) => s.replace(/^Ai\(\d\)-/, "");

const logText = fs.readFileSync(log, "utf8");
const CLOCK_MS = clockMs(logText);
for (const l of logText.split("\n")) {
  let m;
  if ((m = /^Game Result: Game \d+ ended in (\d+) ms\. Ai\(\d\)-(.*) has won!/.exec(l))) {
    g.winner = Number(m[1]) >= CLOCK_MS ? null : m[2];
    g.timeout = !g.winner;
    newGame();
    continue;
  }
  if ((m = /^Turn: Turn \d+ \((.*)\)$/.exec(l))) { g.turn = who(m[1]); g.stats[g.turn] = g.stats[g.turn] || {}; g.declared = new Set(); continue; }
  if ((m = /^Add To Stack: (Ai\(\d\)-.*?) cast (.*?)(?: targeting .*)?$/.exec(l))) { emit(who(m[1]), "cast", { card: m[2] }); continue; }
  if ((m = /^Add To Stack: (Ai\(\d\)-.*?) triggered (.*?)(?: targeting .*)?$/.exec(l))) { emit(who(m[1]), "trigger", { source: m[2] }); continue; }
  if ((m = /^Combat: (Ai\(\d\)-.*?) assigned (.*) to attack (.*)\.$/.exec(l))) {
    const p = who(m[1]);
    for (const a of m[2].matchAll(/(.+?) \((\d+)\)(?:, | and |$)/g)) {
      const card = a[1].replace(/^(and |, )/, "").trim(), id = a[2];
      g.owner[id] = p; g.declared.add(id);
      emit(p, "attack", { card, id });
    }
    continue;
  }
  // An attacker named in a block line that was never declared was put onto the battlefield attacking.
  if (g.turn && (m = /(?:didn't block|to block) (.*?) \((\d+)\)/.exec(l)) && !g.declared.has(m[2]) && !g.owner[m[2]]) {
    g.declared.add(m[2]); g.owner[m[2]] = g.turn;
    emit(g.turn, "putIn", { card: m[1], id: m[2] });
  }
  if ((m = /^Damage: (.*?) \((\d+)\) deals (\d+) combat damage to Ai\(\d\)-/.exec(l))) {
    emit(g.owner[m[2]], "damage", { card: m[1], id: m[2], amount: Number(m[3]) });
    continue;
  }
  if ((m = /^Resolve Stack: (.*?) \((\d+)\) - +Attach to (.*?) \((\d+)\)/.exec(l))) {
    const ownTarget = !(g.owner[m[4]] && g.owner[m[4]] !== g.turn);
    if (ownTarget) g.suited.add(m[4]);
    emit(g.turn, "attach", { card: m[1], target: m[3], id: m[4], ownTarget });
    continue;
  }
  if ((m = /^Resolve Stack: (.*)$/.exec(l))) {
    const phase = /\[Phase: (Ai\(\d\)-.*?)\]/.exec(l);
    emit(phase ? who(phase[1]) : g.turn, "resolve", { text: m[1] });
  }
}
games.pop(); // the trailing object after the last result line (an unfinished game, if the log was cut)

console.log(`games: ${games.length} (clock draws: ${games.filter((x) => x.timeout).length})`);
const players = [...new Set(games.flatMap((x) => Object.keys(x.stats)))];
for (const p of players) {
  const rows = games.map((x) => x.stats[p]).filter(Boolean);
  const labels = rulesFor(p).map((r) => r.label).filter((v, i, a) => a.indexOf(v) === i);
  const generic = !RULES[baseName(p)];
  console.log(`\n${shortName(p)} (${rows.length} games${generic ? ", no plan_rules entry: generic checks only" : ""}):`);
  for (const k of labels) {
    const vals = rows.map((r) => r[k] || 0);
    console.log(`  ${k}: ${(vals.reduce((a, b) => a + b, 0) / rows.length).toFixed(1)} per game (games with any: ${vals.filter(Boolean).length})`);
  }
}
