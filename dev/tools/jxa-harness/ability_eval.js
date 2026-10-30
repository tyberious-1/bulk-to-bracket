// Measures the ability labels over the owned collection and prints how single cards read.
// Usage: node dev/tools/jxa-harness/ability_eval.js coverage
//        node dev/tools/jxa-harness/ability_eval.js vocab [n]
//        node dev/tools/jxa-harness/ability_eval.js case "Bag of Holding" "Street Sweeper"
//        node dev/tools/jxa-harness/ability_eval.js vetoes
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const root = path.join(__dirname, "../../..");
const ctx = vm.createContext({});
for (const file of ["js/constants.js", "js/utils/text.js", "js/utils/cards.js", "js/format.js", "js/analysis/abilities.js", "js/analysis/engines.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), ctx, { filename: file });
}
const T = vm.runInContext("({ tagCard: getCardAbilities, isGraveyardHostile })", ctx);
const owned = JSON.parse(fs.readFileSync(path.join(__dirname, "owned_raw.json"), "utf8"));
const byName = new Map();
for (const c of owned) {
  byName.set(c.name.toLowerCase(), c);
  const front = c.name.split(" // ")[0].toLowerCase();
  if (!byName.has(front)) byName.set(front, c);
}

function isLabeled(ab) {
  return ab.kind === "keyword" || ab.kind === "structural" || ab.effects.length > 0;
}

function coverage() {
  let cards = 0, cardsFull = 0, lines = 0, labeled = 0;
  const unlabeled = new Map();
  for (const raw of owned) {
    if (/^(?:basic )?land/i.test(raw.type_line) && !raw.oracle_text) continue;
    const abs = T.tagCard(raw);
    if (!abs.length) continue;
    cards++;
    let all = true;
    for (const ab of abs) {
      lines++;
      if (isLabeled(ab)) labeled++;
      else {
        all = false;
        const key = ab.line.replace(/\d+/g, "N").slice(0, 110);
        unlabeled.set(key, (unlabeled.get(key) || 0) + 1);
      }
    }
    if (all) cardsFull++;
  }
  console.log(`cards with rules text: ${cards}`);
  console.log(`cards where every line got a label: ${cardsFull} (${(100 * cardsFull / cards).toFixed(1)}%)`);
  console.log(`lines: ${lines}, labeled: ${labeled} (${(100 * labeled / lines).toFixed(1)}%)`);
  console.log("most common unlabeled lines:");
  [...unlabeled.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).forEach(([k, n]) => console.log(String(n).padStart(4), k));
}

function vocab(limit) {
  const wordRe = /graveyard|discard|\bmills?\b|surveil|\bcrews?\b|vehicle|connive|explore/;
  const labelRe = /^(?:return-from-graveyard|exile-from-graveyard|put-into-graveyard|mill-self|mill-other|surveil|loot|rummage|discard-self|discard-opponent|discard-any-player|crew-helper|explore-or-learn|keyword:(?:flashback|escape|unearth|embalm|eternalize|disturb|jump-start|aftermath|retrace|scavenge|dredge|crew|cycling))$/;
  let lines = 0, hit = 0;
  const miss = new Map();
  const seen = new Set();
  for (const raw of owned) {
    if (seen.has(raw.name)) continue;
    seen.add(raw.name);
    for (const ab of T.tagCard(raw)) {
      if (!wordRe.test(ab.line)) continue;
      lines++;
      const ok = ab.effects.some((e) => labelRe.test(e.label)) || ab.cost.some((c) => /discard|exile-self-from-graveyard/.test(c)) || ab.trigger.some((t) => /crews|discard-event|leave-graveyard|cycle-event/.test(t));
      if (ok) hit++;
      else {
        const key = ab.line.replace(/\d+/g, "N").slice(0, 120);
        miss.set(key, (miss.get(key) || 0) + 1);
      }
    }
  }
  console.log(`graveyard/discard/mill/crew-vocabulary lines: ${lines}, with a matching label: ${hit} (${(100 * hit / lines).toFixed(1)}%)`);
  [...miss.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit || 45).forEach(([k, n]) => console.log(String(n).padStart(4), k));
}

function showCase(name) {
  const raw = byName.get(name.toLowerCase());
  if (!raw) { console.log("not owned:", name); return; }
  console.log("==", raw.name, "|", raw.type_line);
  for (const ab of T.tagCard(raw)) {
    const eff = ab.effects.map((e) => e.label + (e.object ? `(${e.object}${e.to ? "->" + e.to : ""}${e.kind ? "/" + e.kind : ""})` : "")).join(" ");
    console.log(`  [${ab.kind}] trig=${ab.trigger.join("+") || "-"} cost=${ab.cost.join("+") || "-"} eff=${eff || "-"} restr=${ab.restrictions.join("+") || "-"}`);
    console.log("     ", ab.line.slice(0, 140));
  }
}

// Every owned card the graveyard veto fires on: it should be rare and each one defensible.
function vetoes() {
  const seen = new Set();
  for (const raw of owned) {
    if (seen.has(raw.name)) continue;
    seen.add(raw.name);
    if (T.isGraveyardHostile(raw)) console.log(raw.name, "|", (raw.oracle_text || "").replace(/\n/g, " / ").slice(0, 150));
  }
}

const [mode, ...rest] = process.argv.slice(2);
if (mode === "coverage") coverage();
else if (mode === "vocab") vocab(+rest[0]);
else if (mode === "case") rest.forEach(showCase);
else if (mode === "vetoes") vetoes();
else console.log("modes: coverage | vocab [n] | case <names...> | vetoes");
