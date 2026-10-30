// Shared-term audit: the scoreboard for theme-plan roles (spec: dev/docs/superpowers/specs/2026-10-29-theme-plan-roles-design.md).
// Not part of the committed dev/tests/jxa suite.
//
// Reads every card's words as terms it MAKES (types, subtypes, keywords, effects) and need CLAUSES it has (from
// conditions only), then measures how a deck's cards link: one card's make meeting another's need.
//
// INDEPENDENCE RULE: this file has its own copy of the reading and must never call js/analysis/terms.js. It loads the
// app's js/ files only to read card abilities (abilities.js) and to build decks. If the builder were graded by the
// reading it selects with, linked share would rise by construction.
//
// Usage (from the repo root; needs dev/tools/jxa-harness/precon_full.json, made by fetch_precons.js):
//   node dev/tools/jxa-harness/shared_terms.js checks              known-pair check set, exit 1 on any failure
//   node dev/tools/jxa-harness/shared_terms.js floor               precon reference ranges -> precon_floor.json
//   node dev/tools/jxa-harness/shared_terms.js audit [--out f.json]  22 plans at midrange, printed (and saved)
//   node dev/tools/jxa-harness/shared_terms.js compare <baseline.json>   acceptance verdict (Task 6)
//
// Measures: a card is LINKED if one of its counted need clauses is met by another deck card, or it meets another
// card's; a PAYOFF has a counted need clause met by at least 2 other deck cards; an ENGINE is a term with at least
// 2 payoffs needing it and at least 3 makers in the deck. A clause is COUNTED when ln(nonland cards / (1 + cards that
// make any term in it)) >= 1.5 and, for a single-term clause, the precon lift is not noise (< 1.2).
// Known blind spots: instants and sorceries (about 25% of a collection) read as common, so spell-payoff plans
// under-read; generic hub cards (Magnetic Snuffler) show up often; effect-only themes (blink) have no noun to name.
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.join(__dirname, "../../..");
const PRECONS = path.join(__dirname, "precon_full.json");
const FLOOR = path.join(__dirname, "precon_floor.json");
const CLAUSE_MIN = 1.5;

// ---- the app's own code, for abilities and for building decks
function loadApp() {
  const store = {};
  const ctx = vm.createContext({
    console, setTimeout, clearTimeout, AbortController,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    fetch: () => Promise.reject(new Error("no network in the audit"))
  });
  const scripts = fs.readFileSync(path.join(__dirname, "build_harness.sh"), "utf8").match(/js\/[\w/.-]+\.js/g);
  for (const f of scripts) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
  return ctx;
}
const APP = loadApp();
const getAbs = (card) => APP.getCardAbilities(card);

// ---- cards
function norm(c, src) {
  if (src === "scry") {
    const faces = c.card_faces && !c.oracle_text ? c.card_faces : [c];
    return { name: c.name, type_line: c.type_line, oracle_text: faces.map((f) => f.oracle_text || "").join("\n"), colors: c.color_identity, kw: (c.keywords || []).map((k) => k.toLowerCase()) };
  }
  return { name: c.name, type_line: c.type, oracle_text: c.text || "", colors: c.colorIdentity, kw: [] };
}
const front = (c) => (c.type_line || "").split(" // ")[0].split("—")[0].toLowerCase();
const subsOf = (c) => ((((c.type_line || "").split(" // ")[0]).split("—")[1]) || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
const isLand = (c) => /\bland\b/.test(front(c)) && !/creature/.test(front(c));

const ownedRaw = JSON.parse(fs.readFileSync(path.join(__dirname, "owned_raw.json"), "utf8"));
const owned = [];
{ const seen = new Set(); for (const c of ownedRaw) { if (seen.has(c.oracle_id)) continue; seen.add(c.oracle_id); owned.push(norm(c, "scry")); } }
const ownedNL = owned.filter((c) => !isLand(c));
const byName = new Map(ownedNL.map((c) => [c.name, c]));
const N = ownedNL.length;

// ---- vocabulary, all from the data
const SUBS = new Set(), KW = new Set();
for (const c of owned) { subsOf(c).forEach((s) => SUBS.add(s)); c.kw.forEach((k) => KW.add(k)); }
const TYPES = new Set(["creature", "artifact", "enchantment", "instant", "sorcery", "planeswalker", "battle", "legendary", "saga"]);
const STOPT = new Set(["time", "turn", "first", "second", "power", "toughness", "plan", "cat", "spell", "card", "player", "token", "opponent", "control", "other", "another", "you", "your", "each", "target", "that", "this", "enchant", "equip", "ward", "kicker", "cycling", "flash", "defender", "scry", "mill", "amass", "fabricate", "bolster", "adapt", "learn"]);
const HIST = ["artifact", "legendary", "saga"];
const NONC = ["artifact", "enchantment", "instant", "sorcery", "planeswalker", "battle"];
const sing = (w) => [w, w.replace(/s$/, ""), w.replace(/ves$/, "f"), w.replace(/ies$/, "y"), w.replace(/men$/, "man")];
const kwList = [...KW].filter((k) => k.length > 3 && !STOPT.has(k));
const COUNTER_NOT_KIND = ["a", "the", "that", "more", "of", "one", "any", "each", "no", "all"];

function termsIn(p) {
  p = p.toLowerCase();
  const t = new Set();
  for (const m of p.matchAll(/([+\-]?\d+\/[+\-]?\d+|[a-z]+) counters?/g)) { if (!COUNTER_NOT_KIND.includes(m[1])) t.add(m[1] + " counter"); t.add("counter"); }
  if (/\bhistoric\b/.test(p)) HIST.forEach((x) => t.add(x));
  if (/\bnoncreature\b/.test(p)) NONC.forEach((x) => t.add(x));
  for (const w of p.replace(/[^a-z' -]/g, " ").split(/\s+/)) {
    if (!w) continue;
    for (const v of sing(w)) { if (STOPT.has(v)) continue; if (SUBS.has(v) || TYPES.has(v)) { t.add(v); break; } }
  }
  for (const k of kwList) if (new RegExp("\\b" + k.replace(/[^a-z ]/g, "") + "\\b").test(p)) t.add(k);
  return t;
}

// keyword -> counter terms its reminder text makes (infect: "poison counters", "-1/-1 counters")
const kwMakes = new Map();
for (const c of owned) for (const k of c.kw) {
  if (kwMakes.has(k)) continue;
  const m = new RegExp(k.replace(/[^a-z ]/g, "") + " (?:[0-9x{}a-z]+ )?\\(([^)]*)\\)", "i").exec(c.oracle_text || "");
  if (m) { const t = new Set(); for (const x of termsIn(m[1])) if (/counter/.test(x)) t.add(x); kwMakes.set(k, t); }
}

const EV_FROM_TRIGGER = { dies: "ev:dies", "sacrifice-event": "ev:sacrifice", "token-event": "ev:token", "draw-event": "ev:draw", "draw-second": "ev:draw", "life-event": "ev:lifegain", "discard-event": "ev:discard", "cycle-event": "ev:cycle", landfall: "ev:landfall", "counter-placed": "ev:counter", "leave-graveyard": "ev:graveyard", "cast-spell": "ev:cast", "cast-noncreature": "ev:cast", "cast-second": "ev:cast", etb: "ev:enter", attacks: "ev:attack", "combat-damage": "ev:attack" };
const EV_FROM_EFFECT = { destroy: "ev:dies", damage: "ev:dies", sacrifice: "ev:sacrifice", "create-token": "ev:token", draw: "ev:draw", loot: "ev:draw", rummage: "ev:draw", "discard-self": "ev:discard", "discard-opponent": "ev:discard", "mill-self": "ev:graveyard", "put-into-graveyard": "ev:graveyard", surveil: "ev:graveyard", "gain-life": "ev:lifegain", "land-to-battlefield": "ev:landfall", counters: "ev:counter" };
const NEED_PATTERNS = [
  /\bif you control (?:an? |another |at least \w+ |two or more )?([^,.]+)/, /\bas long as you control (?:an? )?([^,.]+)/,
  /\bfor each ([^,.]+?) you control/, /\bnumber of ([^,.]+?) you control/, /costs? \{[^}]+\} less to cast if you control (?:an? )?([^,.]+)/,
  /\b(?:other )?([a-z ]+?) you control (?:get|gets|have|has)\b/, /\b([a-z ]+?) spells? you cast/,
  /return (?:up to \w+ )?(?:target |another )?([^.]*?)(?: cards?)? from your graveyard/, /search your library for (?:an? |up to \w+ )([^.]*?) card/,
  /\bwith (?:an? |the )?([a-z]+) (?:counters?) on (?:it|them)/
];

const READ = new Map();
function read(c) {
  let r = READ.get(c);
  if (r) return r;
  const needs = new Set(), makes = new Set(), clauses = [];
  const addClause = (set) => { if (set && set.size) { clauses.push(set); set.forEach((t) => needs.add(t)); } };
  const ty = front(c);
  for (const w of ty.split(/\s+/)) if (TYPES.has(w)) makes.add(w);
  subsOf(c).forEach((s) => makes.add(s));
  if (/creature/.test(ty)) { makes.add("ev:attack"); makes.add("ev:enter"); }
  if (!/\bland\b/.test(ty)) makes.add("ev:cast");
  const text = (c.oracle_text || "").toLowerCase();
  for (const k of kwList) if (new RegExp("(?:^|\\n|, )" + k.replace(/[^a-z ]/g, "") + "\\b").test(text)) { makes.add(k); (kwMakes.get(k) || []).forEach((x) => makes.add(x)); }
  for (const ab of getAbs(c)) {
    const line = ab.line.replace(/^[a-z' ]+ — /, "");
    const labels = ab.effects.map((e) => e.label);
    if (ab.kind === "triggered") {
      const clause = line.split(",")[0];
      const self = (/^(?:when|whenever|at) (?:~|this )/.test(clause) && !/\b(?:another|other|or)\b/.test(clause)) || /beginning of|end step/.test(clause);
      if (!self && !/opponent/.test(clause)) {
        addClause(termsIn(clause));
        for (const t of ab.trigger) {
          // abilities.js labels any trigger that says "token" as token-event; "whenever you sacrifice a Blood token" is about
          // a sacrifice, so a token-creation need requires create/enters wording.
          if (t === "token-event" && !/\b(?:creates?|created|enters)\b/.test(clause)) continue;
          if (EV_FROM_TRIGGER[t]) addClause(new Set([EV_FROM_TRIGGER[t]]));
        }
      }
    }
    for (const re of NEED_PATTERNS) { const m = re.exec(line); if (m && !/opponent/.test(m[1])) addClause(termsIn(m[1])); }
    if (/\bproliferate\b/.test(line)) addClause(new Set(["counter"]));
    for (const l of labels) if (EV_FROM_EFFECT[l]) makes.add(EV_FROM_EFFECT[l]);
    if (ab.kind === "activated" && ab.cost.includes("sacrifice-other")) { makes.add("ev:sacrifice"); makes.add("ev:dies"); }
    if (/\bproliferate\b/.test(line)) makes.add("ev:counter");
    const mk = /\bcreate[sd]? (?:an? |two |three |x |that many |\d+ )?([^.]*?) tokens?/.exec(line);
    if (mk) termsIn(mk[1]).forEach((x) => makes.add(x));
    for (const m of line.matchAll(/\b(?:put|puts|gets?|enters? with)\b[^.]*?([+\-]?\d+\/[+\-]?\d+|[a-z]+) counters?/g)) { if (!COUNTER_NOT_KIND.includes(m[1])) makes.add(m[1] + " counter"); makes.add("counter"); makes.add("ev:counter"); }
  }
  for (const x of [...makes]) if (/ counter$/.test(x)) makes.add("counter");
  r = { needs, makes, clauses };
  READ.set(c, r);
  return r;
}

// ---- weights: a clause is as rare as the union of its makers
const makersN = new Map(), needersN = new Map();
for (const c of ownedNL) { const r = read(c); r.makes.forEach((t) => makersN.set(t, (makersN.get(t) || 0) + 1)); r.needs.forEach((t) => needersN.set(t, (needersN.get(t) || 0) + 1)); }
const clIdfCache = new Map();
function clauseIdf(cl) {
  const key = [...cl].sort().join("|");
  let v = clIdfCache.get(key);
  if (v === undefined) { let n = 0; for (const c of ownedNL) { const m = read(c).makes; for (const t of cl) if (m.has(t)) { n++; break; } } v = Math.log(N / (1 + n)); clIdfCache.set(key, v); }
  return v;
}
const termLift = new Map();
function okClause(cl) {
  if (clauseIdf(cl) < CLAUSE_MIN) return false;
  if (cl.size === 1) { const L = termLift.get([...cl][0]); if (L && L.lift < 1.2) return false; }
  return true;
}
function linkClauses(a, b) {
  const out = [];
  for (const [x, y] of [[a, b], [b, a]]) for (const cl of read(x).clauses) { const hit = [...cl].filter((t) => read(y).makes.has(t)); if (hit.length) out.push({ cl, hit, needer: x }); }
  return out;
}
const strongLinks = (a, b) => linkClauses(a, b).filter((l) => okClause(l.cl));

// ---- precon reference decks and the per-term lift (do decks that need a term hold more of its makers?)
function loadPrecons() {
  if (!fs.existsSync(PRECONS)) { console.error("missing " + PRECONS + " - run: node dev/tools/jxa-harness/fetch_precons.js"); process.exit(2); }
  return JSON.parse(fs.readFileSync(PRECONS, "utf8")).filter((d) => !/Collector/.test(d.name));
}
const PRECON_DECKS = loadPrecons().map((d) => d.main.concat(d.commander).map((c) => norm(c, "mtgj")).filter((c) => !isLand(c)));
{
  const reads = PRECON_DECKS.map((cs) => cs.map((c) => read(c)));
  for (const t of needersN.keys()) {
    const A = [], B = [];
    PRECON_DECKS.forEach((cs, i) => {
      const needers = reads[i].filter((r) => r.needs.has(t)).length, makers = reads[i].filter((r) => r.makes.has(t)).length;
      (needers ? A : B).push(makers / cs.length);
    });
    if (A.length < 8 || B.length < 8) continue;
    const m = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    termLift.set(t, { lift: m(A) / Math.max(m(B), 0.002), nA: A.length });
  }
}

// ---- the measure
function measure(cards) {
  const n = cards.length, linked = new Array(n).fill(false), payoff = new Array(n).fill(false);
  const needT = new Map(), makeT = new Map();
  const add = (m, t, i) => { if (!m.has(t)) m.set(t, new Set()); m.get(t).add(i); };
  for (let i = 0; i < n; i++) {
    for (const cl of read(cards[i]).clauses) {
      if (!okClause(cl)) continue;
      const sup = new Set();
      for (let j = 0; j < n; j++) if (j !== i) for (const t of cl) if (read(cards[j]).makes.has(t)) { sup.add(j); add(makeT, t, j); }
      if (sup.size) { linked[i] = true; sup.forEach((j) => (linked[j] = true)); }
      if (sup.size >= 2) { payoff[i] = true; for (const t of cl) add(needT, t, i); }
    }
  }
  const engines = [...needT].filter(([t, s]) => s.size >= 2 && (makeT.get(t) || new Set()).size >= 3).map(([t, s]) => [t, s.size, makeT.get(t).size]).sort((a, b) => b[1] + b[2] - a[1] - a[2]);
  return { n, linked: n ? linked.filter(Boolean).length / n : 0, payoffs: payoff.filter(Boolean).length, engines };
}
const pct = (a, p) => { a = a.slice().sort((x, y) => x - y); return a[Math.floor(a.length * p)]; };
const spread = (a) => ({ p10: pct(a, 0.1), p50: pct(a, 0.5), p90: pct(a, 0.9) });

// ---- the check set: known pairs, positives must link and negatives must not (on a counted clause)
const CHECKS = [
  ["Kaza, Roil Chaser", "Wizard's Lightning", true, "Wizards feed the discounted instant"],
  ["Balmor, Battlemage Captain", "Wizard's Lightning", true, "spell payoff and a spell"],
  ["Contagion Clasp", "Blightwidow", true, "proliferate and poison"],
  ["Dragonspark Reactor", "Prismatic Lens", true, "artifact payoff and an artifact"],
  ["Aatchik, Emerald Radian", "Acridian", true, "Insect payoff and an Insect"],
  ["Greasefang, Okiba Boss", "Smuggler's Copter", true, "returns Vehicles"],
  ["Belligerent Whiptail", "Cultivate", true, "landfall and a land ramp spell"],
  ["Attended Healer", "Airdrop Aeronauts", true, "lifegain payoff and a lifegain source (white)"],
  ["Gluttonous Guest", "Altar's Reap", true, "sacrifice payoff and a sacrifice (black)"],
  ["Evolution Sage", "Rampant Growth", true, "landfall payoff and a land ramp spell (green)"],
  ["Bishop of the Bloodstained", "Basilica Stalker", true, "Vampire payoff and a Vampire (black)"],
  ["Naturalize", "Dragonspark Reactor", false, "destroying artifacts is not needing them"],
  ["Circle of Confinement", "Wizard's Lightning", false, "an opponent casting is not your spells"],
  ["Expunge", "Dragonspark Reactor", false, "non-artifact is not artifacts"],
  ["Bilbo's Deadly Slice", "Prismatic Lens", false, "a removal target is not a need"],
  ["Naturalize", "Wizard's Lightning", false, "no Wizard in Naturalize"],
  ["Victim of Night", "Bishop of the Bloodstained", false, "non-Vampire names the tribe only to leave it out"],
  ["Demystify", "Archon of Falling Stars", false, "destroy target enchantment is not needing enchantments"],
  ["Agents of HYDRA", "Gluttonous Guest", false, "a self dies trigger is not a sacrifice payoff"],
  ["Attended Healer", "Victim of Night", false, "unrelated: a lifegain payoff and a removal spell"]
];
function runChecks() {
  let pass = 0, run = 0;
  for (const [an, bn, want, why] of CHECKS) {
    const a = byName.get(an), b = byName.get(bn);
    if (!a || !b) { console.log("  SKIP (not owned: " + (!a ? an : bn) + "): " + why); continue; }
    run++;
    const all = linkClauses(a, b), strong = all.filter((l) => okClause(l.cl)).flatMap((l) => l.hit);
    const ok = want ? strong.length > 0 : strong.length === 0;
    if (ok) pass++;
    console.log("  " + (ok ? "PASS" : "FAIL") + " " + (want ? "link  " : "NOLINK") + " " + an.slice(0, 26).padEnd(26) + " x " + bn.slice(0, 26).padEnd(26) + " | " + (strong.join(", ") || "-") + " | " + why);
  }
  console.log("  passed " + pass + " of " + run);
  return pass === run && run > 0;
}

// ---- the 22 plans: 12 sample (as in bottom_up_audit.js) and 10 held-out, chosen by rule on 2026-10-29 and fixed here
const T = (tribe) => ({ kind: "tribal", tag: tribe + "s", label: tribe, tribe });
const H = (tag) => ({ kind: "theme", tag, label: tag });
const PLANS = [
  ["vehicles", H("vehicles"), ["W", "B"], "sample"], ["enchantments", H("enchantments"), ["U"], "sample"], ["wizard", T("wizard"), ["U", "R"], "sample"],
  ["sacrifice", H("sacrifice"), ["B", "R"], "sample"], ["infect~deathtouch", H("infect~deathtouch"), ["G"], "sample"], ["vampire", T("vampire"), ["B", "R"], "sample"],
  ["artifacts", H("artifacts"), ["R", "W"], "sample"], ["spellslinger", H("spellslinger"), ["U", "R"], "sample"], ["insect", T("insect"), ["B", "G"], "sample"],
  ["lands", H("lands"), ["G", "R"], "sample"], ["knight", T("knight"), ["U", "W"], "sample"], ["graveyard", H("graveyard"), ["U", "B"], "sample"],
  ["warrior", T("warrior"), ["R", "G"], "held-out"], ["soldier", T("soldier"), ["W", "R"], "held-out"], ["rogue", T("rogue"), ["U", "B"], "held-out"],
  ["elf", T("elf"), ["G", "B"], "held-out"], ["zombie", T("zombie"), ["B", "U"], "held-out"],
  ["tokens", H("tokens"), ["W", "R"], "held-out"], ["counters", H("counters"), ["G", "W"], "held-out"], ["lifegain", H("lifegain"), ["B", "W"], "held-out"],
  ["blink", H("blink"), ["G", "B"], "held-out"], ["voltron", H("voltron"), ["U", "W"], "held-out"]
];

function buildPlans() {
  APP.__cards = ownedRaw.map((c) => APP.convertScryfallCard(c));
  APP.__plans = PLANS;
  const out = vm.runInContext(`JSON.stringify(__plans.map(([k, s, c, kind]) => {
    const r = buildDeckBottomUp(__cards, { archetype: "midrange", subtype: s, colors: c });
    return { key: k, kind, colors: c, deck: r.deck.map((x) => x.name), placeholders: r.report.fallbackCount, builderPayoffs: r.report.payoffs, creatures: r.report.creatures, roles: r.report.roleCounts };
  }))`, APP);
  return JSON.parse(out);
}

function audit(outFile) {
  const builds = buildPlans();
  const rows = builds.map((b) => {
    const cards = b.deck.map((nm) => byName.get(nm)).filter((c) => c && !isLand(c));
    const m = measure(cards);
    return { key: b.key, kind: b.kind, colors: b.colors, cards: cards.length, linked: Math.round(m.linked * 1000) / 10, payoffs: m.payoffs, engines: m.engines.length, engineTerms: m.engines.slice(0, 4).map(([t, p, k]) => t + ":" + p + "/" + k), placeholders: b.placeholders, builderPayoffs: b.builderPayoffs, creatures: b.creatures, roles: b.roles, deck: b.deck };
  });
  const floor = fs.existsSync(FLOOR) ? JSON.parse(fs.readFileSync(FLOOR, "utf8")) : null;
  if (floor) console.log("PRECON FLOOR p10/p50/p90: linked " + [floor.linked.p10, floor.linked.p50, floor.linked.p90].map((x) => Math.round(x * 100) + "%").join("/") + " | payoffs " + [floor.payoffs.p10, floor.payoffs.p50, floor.payoffs.p90].join("/") + " | engines " + [floor.engines.p10, floor.engines.p50, floor.engines.p90].join("/") + "\n");
  console.log("plan                 kind      colors cards linked payoffs engines placeholders builder-payoffs  engines (term: payoffs/makers)");
  for (const r of rows) console.log(r.key.padEnd(20) + " " + r.kind.padEnd(9) + " " + r.colors.join("").padEnd(6) + String(r.cards).padStart(5) + (r.linked + "%").padStart(7) + String(r.payoffs).padStart(8) + String(r.engines).padStart(8) + String(r.placeholders).padStart(13) + String(r.builderPayoffs).padStart(16) + "   " + r.engineTerms.join(" "));
  if (outFile) { fs.writeFileSync(outFile, JSON.stringify({ generated: new Date().toISOString(), plans: rows }, null, 1)); console.log("\nwrote " + outFile); }
  return rows;
}

// ---- the acceptance verdict: no regression against a frozen baseline, and the weak class must show its payoffs
const WEAK_CLASS = ["artifacts", "blink", "voltron", "infect~deathtouch", "tokens", "vehicles"];
function legalOwned(colors) {
  APP.__cards = ownedRaw.map((c) => APP.convertScryfallCard(c));
  APP.__colors = colors;
  return JSON.parse(vm.runInContext(`JSON.stringify(__cards.filter((c) => !getCardType(c).includes("land") && legalForCommander(c.colors || [], __colors, c) && !deadForColors(c, __colors)).map((c) => c.name))`, APP));
}
// Owned legal cards that need a term the deck's own cards make (two or more of them): what a deck could play as payoffs.
// Only clauses on the plan's own terms count (a term at least 40% of the deck makes, the share the builder asks of a plan's members): a tokens deck that happens to make one
// Treasure does not owe the player Treasure payoffs.
function ownedPayoffs(deckCards, colors, byClause) {
  const out = [];
  const share = new Map();
  for (const d of deckCards) for (const t of read(d).makes) share.set(t, (share.get(t) || 0) + 1);
  const planTerms = new Set([...share].filter(([t, n]) => n >= deckCards.length * 0.4 && okClause(new Set([t]))).map(([t]) => t));
  for (const nm of legalOwned(colors)) {
    const c = byName.get(nm);
    if (!c) continue;
    for (const cl of read(c).clauses) {
      if (!okClause(cl) || ![...cl].some((t) => planTerms.has(t))) continue;
      let n = 0;
      for (const d of deckCards) if (d !== c) for (const t of cl) if (read(d).makes.has(t)) { n++; break; }
      if (n >= 2) { out.push(nm); if (byClause) byClause.set([...cl].join("|"), (byClause.get([...cl].join("|")) || []).concat(nm)); break; }
    }
  }
  return out;
}
function compare(baseFile) {
  const before = JSON.parse(fs.readFileSync(baseFile, "utf8")).plans;
  const after = audit(null);
  console.log("");
  let fails = 0, pass = 0;
  const unmeasured = [];
  for (const a of after) {
    const b = before.find((x) => x.key === a.key);
    const why = [];
    if (b) {
      if (a.linked < b.linked - 3) why.push(`linked ${b.linked}% -> ${a.linked}%`);
      if (a.payoffs < b.payoffs) why.push(`payoffs ${b.payoffs} -> ${a.payoffs}`);
      if (a.placeholders > b.placeholders) why.push(`placeholders ${b.placeholders} -> ${a.placeholders}`);
    }
    let note = "";
    if (WEAK_CLASS.includes(a.key)) {
      const cards = a.deck.map((nm) => byName.get(nm)).filter((c) => c && !isLand(c));
      const owned = ownedPayoffs(cards, a.colors);
      if (!owned.length && a.payoffs === 0 && !a.engines) { unmeasured.push(a.key); note = " (UNMEASURED: no owned card reads as a payoff)"; }
      else {
        const need = Math.min(owned.length, 5);
        if (a.payoffs < need) why.push(`payoff cards ${a.payoffs} < min(owned ${owned.length}, 5)`);
        if (a.engines < 1 && owned.length) why.push("no engine");
      }
    }
    if (why.length) fails++; else pass++;
    console.log((why.length ? "FAIL " : "PASS ") + a.key.padEnd(20) + (why.length ? why.join("; ") : "") + note);
  }
  console.log(`\n${pass} PASS, ${fails} FAIL, ${unmeasured.length} UNMEASURED${unmeasured.length ? " (" + unmeasured.join(", ") + ")" : ""}`);
  return fails === 0;
}

// What the builder derives for one plan: its terms, and every owned legal card that stands as a payoff or amplifier.
function planDiag(key) {
  const plan = PLANS.find((p) => p[0] === key);
  if (!plan) { console.error("unknown plan " + key); return; }
  APP.__cards = ownedRaw.map((c) => APP.convertScryfallCard(c));
  APP.__plan = plan;
  const out = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const sub = withPlanTerms(__plan[1], __cards);
    const r = buildDeckBottomUp(__cards, { archetype: "midrange", subtype: __plan[1], colors: __plan[2] });
    const inDeck = new Set(r.deck.map((c) => c.name));
    const rows = __cards.filter((c) => !getCardType(c).includes("land") && legalForCommander(c.colors || [], __plan[2], c) && !deadForColors(c, __plan[2]))
      .map((c) => ({ name: c.name, st: subtypeStanding(c, sub), eng: annotateBottomUpCard(c, sub).engine, inDeck: inDeck.has(c.name) }))
      .filter((x) => x.st === "payoff" || (x.st === "member" && x.eng));
    return { planTerms: sub.planTerms ? [...sub.planTerms] : [], makeTerms: sub.planMakeTerms ? [...sub.planMakeTerms] : [], reservation: r.report.payoffReservation, rows };
  })())`, APP));
  console.log("planTerms:", out.planTerms.join(", ") || "(none)");
  console.log("makeTerms:", out.makeTerms.join(", ") || "(none)");
  console.log("reservation:", JSON.stringify(out.reservation), " payoff rows owned:", out.rows.length);
  const a = audit(null).find((x) => x.key === key), by = new Map();
  const owned = ownedPayoffs(a.deck.map((nm) => byName.get(nm)).filter((c) => c && !isLand(c)), plan[2], by);
  console.log("audit reading: " + owned.length + " owned cards need a term two deck cards make; by clause:");
  for (const [cl, names] of [...by].sort((x, y) => y[1].length - x[1].length).slice(0, 8)) console.log("  " + cl + " (" + names.length + "): " + names.slice(0, 5).join(", "));
  for (const r of out.rows.slice(0, 40)) console.log("  " + (r.inDeck ? "IN  " : "out ") + r.st + (r.eng ? "+engine " : " ") + r.name);
}

function floor() {
  const ms = PRECON_DECKS.map((cs) => measure(cs));
  const lifts = [...termLift.values()];
  const out = {
    generated: new Date().toISOString(), decks: ms.length, supply: "owned collection (" + N + " nonland cards)",
    linked: spread(ms.map((m) => m.linked)), payoffs: spread(ms.map((m) => m.payoffs)), engines: spread(ms.map((m) => m.engines.length)),
    lift: { testable: lifts.length, atLeast1_5: lifts.filter((x) => x.lift >= 1.5).length, noiseBelow1_2: lifts.filter((x) => x.lift < 1.2).length }
  };
  fs.writeFileSync(FLOOR, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
}

const mode = process.argv[2];
if (mode === "checks") process.exit(runChecks() ? 0 : 1);
else if (mode === "floor") floor();
else if (mode === "audit") { const i = process.argv.indexOf("--out"); audit(i > 0 ? process.argv[i + 1] : null); }
else if (mode === "who-needs") {
  // Owned cards whose counted clause names a term (audit reading): node shared_terms.js who-needs ev:token
  const hits = ownedNL.filter((c) => !isLand(c) && read(c).clauses.some((cl) => okClause(cl) && cl.has(process.argv[3])));
  console.log(hits.length + " owned cards: " + hits.slice(0, 40).map((c) => c.name).join(", "));
} else if (mode === "plan") planDiag(process.argv[3]);
else if (mode === "compare") process.exit(compare(process.argv[3]) ? 0 : 1);
else { console.error("usage: node shared_terms.js checks | floor | audit [--out f.json] | compare <baseline.json>"); process.exit(2); }

module.exports = { read, measure, strongLinks, okClause, CHECKS, PLANS };
