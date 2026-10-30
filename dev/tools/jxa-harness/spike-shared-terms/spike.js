// THROWAWAY SPIKE: find synergy from shared terms. Needs come from conditions (never effect targets, never
// opponent-scoped); makes come from types, keywords and effects. A link = one card's make is another's need.
const log = process.env.QUIET ? () => {} : console.log;
const fs = require("fs");
const q = require("./qual.js");
const root = "/Users/seth_burns/xpwd/p_projects/bulk-to-bracket";
const ownedRaw = JSON.parse(fs.readFileSync(root + "/dev/tools/jxa-harness/owned_raw.json", "utf8"));
const precons = JSON.parse(fs.readFileSync("precon_full.json", "utf8")).filter((d) => !/Collector/.test(d.name));

// ---- cards
const seenId = new Set();
const owned = [];
for (const c of ownedRaw) {
  if (seenId.has(c.oracle_id)) continue;
  seenId.add(c.oracle_id);
  const n = q.norm(c, "scry");
  n.kw = (c.keywords || []).map((k) => k.toLowerCase());
  owned.push(n);
}
q.setTypes(owned.concat(...precons.map((d) => d.main.concat(d.commander).map((c) => q.norm(c, "mtgj")))));
const ownedNL = owned.filter((c) => !q.isLand(c));
const byName = new Map(ownedNL.map((c) => [c.name, c]));

// ---- vocabulary (all from the data)
const front = (c) => (c.type_line || "").split(" // ")[0].split("—")[0].toLowerCase();
const SUBS = new Set(), KW = new Set();
for (const c of owned) { q.subsOf(c).forEach((s) => SUBS.add(s)); c.kw.forEach((k) => KW.add(k)); }
const TYPES = new Set(["creature", "artifact", "enchantment", "instant", "sorcery", "planeswalker", "battle", "legendary", "saga"]);
const STOPT = new Set(["time", "turn", "first", "second", "power", "toughness", "plan", "cat", "spell", "card", "player", "token", "opponent", "control", "other", "another", "you", "your", "each", "target", "that", "this", "enchant", "equip", "ward", "kicker", "cycling", "flash", "defender", "scry", "mill", "amass", "fabricate", "bolster", "adapt", "learn"]);
const HIST = ["artifact", "legendary", "saga"];
const NONC = ["artifact", "enchantment", "instant", "sorcery", "planeswalker", "battle"];
const sing = (w) => [w, w.replace(/s$/, ""), w.replace(/ves$/, "f"), w.replace(/ies$/, "y"), w.replace(/men$/, "man")];
const kwList = [...KW].filter((k) => k.length > 3 && !STOPT.has(k));

function termsIn(p) {
  p = p.toLowerCase();
  const t = new Set();
  for (const m of p.matchAll(/([+\-]?\d+\/[+\-]?\d+|[a-z]+) counters?/g)) { if (!["a", "the", "that", "more", "of", "one", "any", "each", "no", "all"].includes(m[1])) t.add(m[1] + " counter"); t.add("counter"); }
  if (/\bhistoric\b/.test(p)) HIST.forEach((x) => t.add(x));
  if (/\bnoncreature\b/.test(p)) NONC.forEach((x) => t.add(x));
  for (const w of p.replace(/[^a-z' -]/g, " ").split(/\s+/)) {
    if (!w) continue;
    for (const v of sing(w)) { if (STOPT.has(v)) continue; if (SUBS.has(v) || TYPES.has(v)) { t.add(v); break; } }
  }
  for (const k of kwList) if (new RegExp("\\b" + k.replace(/[^a-z ]/g, "") + "\\b").test(p)) t.add(k);
  return t;
}

// keyword -> terms its reminder text makes (infect: "poison counters", "-1/-1 counters")
const kwMakes = new Map();
for (const c of owned) for (const k of c.kw) {
  if (kwMakes.has(k)) continue;
  const m = new RegExp(k.replace(/[^a-z ]/g, "") + " (?:[0-9x{}a-z]+ )?\\(([^)]*)\\)", "i").exec(c.oracle_text || "");
  if (m) { const t = new Set(); for (const x of termsIn(m[1])) if (/counter/.test(x)) t.add(x); kwMakes.set(k, t); }
}

const EV_FROM_TRIGGER = { dies: "ev:dies", "sacrifice-event": "ev:sacrifice", "token-event": "ev:token", "draw-event": "ev:draw", "draw-second": "ev:draw", "life-event": "ev:lifegain", "discard-event": "ev:discard", "cycle-event": "ev:cycle", landfall: "ev:landfall", "counter-placed": "ev:counter", "leave-graveyard": "ev:graveyard", "cast-spell": "ev:cast", "cast-noncreature": "ev:cast", "cast-second": "ev:cast", etb: "ev:enter", attacks: "ev:attack", "combat-damage": "ev:attack" };
const EV_FROM_EFFECT = { destroy: "ev:dies", damage: "ev:dies", sacrifice: "ev:sacrifice", "create-token": "ev:token", draw: "ev:draw", loot: "ev:draw", rummage: "ev:draw", "discard-self": "ev:discard", "discard-opponent": "ev:discard", "mill-self": "ev:graveyard", "put-into-graveyard": "ev:graveyard", surveil: "ev:graveyard", "gain-life": "ev:lifegain", "land-to-battlefield": "ev:landfall", counters: "ev:counter" };

function read(c) {
  const needs = new Set(), makes = new Set(), clauses = [];
  const addClause = (set) => { if (set && set.size) { clauses.push(set); set.forEach((t) => needs.add(t)); } };
  const ty = front(c);
  const subs = q.subsOf(c);
  for (const w of ty.split(/\s+/)) if (TYPES.has(w)) makes.add(w);
  subs.forEach((s) => makes.add(s));
  if (/creature/.test(ty)) makes.add("ev:attack"), makes.add("ev:enter");
  if (!/\bland\b/.test(ty)) makes.add("ev:cast");
  const text = (c.oracle_text || "").toLowerCase();
  for (const k of kwList) if (new RegExp("(?:^|\\n|, )" + k.replace(/[^a-z ]/g, "") + "\\b").test(text)) { makes.add(k); (kwMakes.get(k) || []).forEach((x) => makes.add(x)); }
  for (const ab of q.abs(c)) {
    const line = ab.line.replace(/^[a-z' ]+ — /, "");
    const labels = ab.effects.map((e) => e.label);
    // ---- needs: conditions only
    if (ab.kind === "triggered") {
      const clause = line.split(",")[0];
      const self = (/^(?:when|whenever|at) (?:~|this )/.test(clause) && !/\b(?:another|other|or)\b/.test(clause)) || /beginning of|end step/.test(clause);
      if (!self && !/opponent/.test(clause)) {
        addClause(termsIn(clause));
        for (const t of ab.trigger) if (EV_FROM_TRIGGER[t]) addClause(new Set([EV_FROM_TRIGGER[t]]));
      }
    }
    const cond = [/\bif you control (?:an? |another |at least \w+ |two or more )?([^,.]+)/, /\bas long as you control (?:an? )?([^,.]+)/, /\bfor each ([^,.]+?) you control/, /\bnumber of ([^,.]+?) you control/, /costs? \{[^}]+\} less to cast if you control (?:an? )?([^,.]+)/, /\b(?:other )?([a-z ]+?) you control (?:get|gets|have|has)\b/, /\b([a-z ]+?) spells? you cast/, /return (?:up to \w+ )?(?:target |another )?([^.]*?)(?: cards?)? from your graveyard/, /search your library for (?:an? |up to \w+ )([^.]*?) card/, /\bwith (?:an? |the )?([a-z]+) (?:counters?) on (?:it|them)/];
    for (const re of cond) { const m = re.exec(line); if (m && !/opponent/.test(m[1])) addClause(termsIn(m[1])); }
    if (/\bproliferate\b/.test(line)) addClause(new Set(["counter"]));
    // ---- makes: effects
    for (const l of labels) if (EV_FROM_EFFECT[l]) makes.add(EV_FROM_EFFECT[l]);
    if (ab.kind === "activated" && ab.cost.includes("sacrifice-other")) { makes.add("ev:sacrifice"); makes.add("ev:dies"); }
    if (/\bproliferate\b/.test(line)) makes.add("ev:counter");
    const mk = /\bcreate[sd]? (?:an? |two |three |x |that many |\d+ )?([^.]*?) tokens?/.exec(line);
    if (mk) termsIn(mk[1]).forEach((x) => makes.add(x));
    for (const m of line.matchAll(/\b(?:put|puts|gets?|enters? with)\b[^.]*?([+\-]?\d+\/[+\-]?\d+|[a-z]+) counters?/g)) { if (!["a", "the", "that", "more", "of", "one", "any", "each"].includes(m[1])) makes.add(m[1] + " counter"); makes.add("counter"); makes.add("ev:counter"); }
  }
  for (const x of [...makes]) if (/ counter$/.test(x)) makes.add("counter");
  // a Wizard is a creature etc. already via types; needs on a term the card itself makes do not count
  return { needs, makes, clauses };
}

const R = new Map();
function rd(c) { let r = R.get(c); if (!r) { r = read(c); R.set(c, r); } return r; }

// ---- weights: rarer makers weigh more (computed, not listed)
const N = ownedNL.length, makersN = new Map(), needersN = new Map();
for (const c of ownedNL) { const r = rd(c); r.makes.forEach((t) => makersN.set(t, (makersN.get(t) || 0) + 1)); r.needs.forEach((t) => needersN.set(t, (needersN.get(t) || 0) + 1)); }
const idf = (t) => Math.log(N / (1 + (makersN.get(t) || 0)));
const idfOk = (t) => idf(t) >= 1.5;
var termLiftRef = new Map();
const clIdfCache = new Map();
function clauseIdf(cl) { // weight by the supply of the WHOLE clause, so a union like "noncreature" is not six links
  const key = [...cl].sort().join("|");
  let v = clIdfCache.get(key);
  if (v === undefined) { let n = 0; for (const c of ownedNL) { const m = rd(c).makes; for (const t of cl) if (m.has(t)) { n++; break; } } v = Math.log(N / (1 + n)); clIdfCache.set(key, v); }
  return v;
}
function okClause(cl) {
  if (clauseIdf(cl) < 1.5) return false;
  if (cl.size === 1) { const L = termLiftRef.get([...cl][0]); if (L && L.lift < 1.2) return false; }
  return true;
}
function linkClauses(a, b) {
  const out = [];
  for (const [x, y] of [[a, b], [b, a]]) for (const cl of rd(x).clauses) { const hit = [...cl].filter((t) => rd(y).makes.has(t)); if (hit.length) out.push({ cl, hit, needer: x }); }
  return out;
}
function strongLinks(a, b) { return linkClauses(a, b).filter((l) => okClause(l.cl)); }
function link(a, b) { return linkClauses(a, b).flatMap((l) => l.hit); } // kept for the section 3 helpers

// ================= 1. CHECK SET (scored before any output is read)
const find = (re) => ownedNL.find((c) => re.test((c.oracle_text || "").toLowerCase()) && !/opponent controls|opponents control/.test(""));
const insect = ownedNL.find((c) => q.subsOf(c).includes("insect") && !/legendary/.test(front(c)));
const landfall = ownedNL.find((c) => /^landfall/i.test(c.oracle_text || "") && !/legendary/.test(front(c)));
const nonArt = ownedNL.find((c) => /non-?artifact/.test((c.oracle_text || "").toLowerCase()) && /destroy|exile/.test((c.oracle_text || "").toLowerCase()) && !/artifact/.test(front(c)));
const spot = ownedNL.find((c) => /^destroy target creature\.?$/i.test((c.oracle_text || "").trim()) && /instant/.test(front(c)));
const oppCast = ownedNL.find((c) => /whenever an opponent casts/.test((c.oracle_text || "").toLowerCase()));
const nonWiz = ownedNL.find((c) => /non-?wizard/.test((c.oracle_text || "").toLowerCase()));
const P = (a, b, why, want) => ({ a: typeof a === "string" ? byName.get(a) : a, b: typeof b === "string" ? byName.get(b) : b, why, want });
const checks = [
  P("Kaza, Roil Chaser", "Wizard's Lightning", "wizards feed the discounted instant", true),
  P("Balmor, Battlemage Captain", "Wizard's Lightning", "spell payoff and a spell", true),
  P("Contagion Clasp", "Blightwidow", "proliferate and poison", true),
  P("Dragonspark Reactor", "Prismatic Lens", "artifact payoff and an artifact", true),
  P("Aatchik, Emerald Radian", insect, "Insect payoff and an Insect", true),
  P("Greasefang, Okiba Boss", "Smuggler's Copter", "returns Vehicles", true),
  P(landfall, "Cultivate", "landfall and a land ramp spell", true),
  P("Naturalize", "Dragonspark Reactor", "destroying artifacts is not needing them", false),
  P(oppCast, "Wizard's Lightning", "an opponent casting is not your spells", false),
  P(nonArt, "Dragonspark Reactor", "non-artifact is not artifacts", false),
  P(spot, "Prismatic Lens", "removal target is not a need", false),
  P("Naturalize", "Wizard's Lightning", "no Wizard in Naturalize", false)
];
log("=== 1. CHECK SET (12 pairs, scored first)");
let pass = 0;
for (const k of checks) {
  if (!k.a || !k.b) { log("  SKIP (card not owned):", k.why); continue; }
  const all_ = linkClauses(k.a, k.b), strong = all_.filter((l) => okClause(l.cl)).flatMap((l) => l.hit), l = all_.flatMap((x) => x.hit);
  const ok = k.want ? strong.length > 0 : strong.length === 0;
  if (ok) pass++;
  log("  " + (ok ? "PASS" : "FAIL") + " " + (k.want ? "link  " : "NOLINK") + " " + k.a.name.slice(0, 24).padEnd(24) + " x " + k.b.name.slice(0, 20).padEnd(20) + " | " + (strong.join(", ") || "-") + (l.length > strong.length ? "  (weak: " + l.filter((x) => !strong.includes(x)).join(",") + ")" : "") + " | " + k.why);
}
log("  passed", pass, "of", checks.filter((k) => k.a && k.b).length);

// ================= 2. PRECON LIFT (outside validation: no hand labels)
const decks = precons.map((d) => d.main.concat(d.commander).map((c) => q.norm(c, "mtgj")).filter((c) => !q.isLand(c)));
const dRd = decks.map((cs) => cs.map((c) => read(c)));
const termLift = new Map();
const allTerms = new Set([...needersN.keys()]);
for (const t of allTerms) {
  const A = [], B = [];
  decks.forEach((cs, i) => {
    const rs = dRd[i], needers = rs.filter((r) => r.needs.has(t)).length;
    const makers = rs.filter((r) => r.makes.has(t)).length;
    (needers ? A : B).push(makers / cs.length);
  });
  if (A.length < 8 || B.length < 8) continue;
  const m = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  termLift.set(t, { lift: m(A) / Math.max(m(B), 0.002), nA: A.length, mA: m(A), mB: m(B) });
}
log("\n=== 2. PRECON LIFT: do decks that NEED a term hold more cards that MAKE it? (lift ~1 = noise)");
const lifts = [...termLift.values()];
termLift.forEach((v, k) => termLiftRef.set(k, v));
log("  terms testable:", lifts.length, "| lift >= 1.5:", lifts.filter((x) => x.lift >= 1.5).length, "| lift < 1.2 (noise):", lifts.filter((x) => x.lift < 1.2).length);

// ================= 3. TOP SHARED TERMS ACROSS THE COLLECTION
function covered(t) { // does the hand-written reader (connections.js) have any channel for this term's needers?
  const needers = ownedNL.filter((c) => rd(c).needs.has(t));
  if (!needers.length) return null;
  const hit = needers.filter((c) => { const l = q.readCard(c); return [...l.wants].some((w) => !q.CHANNEL_UNIVERSAL.has(w)); }).length;
  return hit / needers.length;
}
log("\n=== 3. TOP SHARED TERMS (makers>=5, needers>=3), ranked by idf x log(min(makers,needers))");
const terms = [...needersN.keys()].filter((t) => (makersN.get(t) || 0) >= 5 && needersN.get(t) >= 3 && idfOk(t))
  .map((t) => ({ t, s: idf(t) * Math.log(Math.min(makersN.get(t), needersN.get(t)) + 1) }))
  .sort((a, b) => b.s - a.s);
log("  term".padEnd(22) + "makers needers lift  reader-covers  e.g. needer");
for (const { t } of terms.slice(0, 45)) {
  const L = termLift.get(t), cv = covered(t), ex = ownedNL.find((c) => rd(c).needs.has(t));
  log("  " + t.slice(0, 20).padEnd(20) + String(makersN.get(t)).padStart(7) + String(needersN.get(t)).padStart(8) + (L ? L.lift.toFixed(1).padStart(6) : "   n/a") + (cv == null ? "" : (Math.round(cv * 100) + "%").padStart(10)) + "   " + (ex ? ex.name.slice(0, 28) : ""));
}
const blind = terms.filter(({ t }) => { const cv = covered(t); return cv != null && cv < 0.3; }).slice(0, 25);
log("\n  terms with real supply on both sides that the hand-written reader barely covers (<30%):");
log("  " + blind.map(({ t }) => t + "(" + makersN.get(t) + "/" + needersN.get(t) + ")").join(", "));

// ================= 4. PRECONS: top terms vs what the deck is about
log("\n=== 4. PRECONS: strongest shared terms per deck (sampled every 9th deck)");
precons.forEach((d, i) => {
  if (i % 9 !== 0) return;
  const rs = dRd[i], tally = new Map();
  rs.forEach((r) => r.needs.forEach((t) => { if (!idfOk(t)) return; const mk = rs.filter((x) => x !== r && x.makes.has(t)).length; if (mk >= 2) tally.set(t, (tally.get(t) || 0) + 1); }));
  const top = [...tally].sort((a, b) => b[1] * idf(b[0]) - a[1] * idf(a[0])).slice(0, 6).map(([t, n]) => t + ":" + n);
  log("  " + d.name.slice(0, 40).padEnd(40) + "| " + top.join("  "));
});

module.exports = { rd, link, linkClauses, strongLinks, okClause, clauseIdf, idf, idfOk, ownedNL, byName, front, termLift, dRd, decks, checks, N };
