// Goldfish simulator and link score for whole decks (solo games, no opponents). Measures how fast a deck gets its
// commander and its linked cards into play, plus how many of its cards link into the commander's web.
// Usage (from the repo root):
//   node dev/tools/jxa-harness/precon_research/goldfish.js DECKS_FILE REF_DIR [games] [randomDecks]
//     DECKS_FILE  a dump_own.js / dump_decks.js output (a line starting "DECKS {...}"); one or more, comma separated
//     REF_DIR     folder holding EDHREC average decks (ref/<slug>.json from json.edhrec.com/pages/average-decks/<slug>.json)
//                 and cards.json (name -> Scryfall card, from fetch_ref_cards.py); optional, omit for builder decks only
// Each deck is scored three ways: the builder's deck, EDHREC's average deck and a random same-color fill of the
// owned pile. All use one link reader (getEngineBonus), so a link count says how well a deck connects to its commander's
// words, not that it wins. The goldfish side is mostly independent of that reader: it counts lands, ramp, draw and mana
// spent from card text. Known limits: colors are ignored (every land makes one mana of any color), no commander tax,
// no tapped lands, no mana abilities beyond "{T}: Add", draw engines count once, X spells cost their mana value.
const fs = require("fs"), vm = require("vm"), path = require("path");
const root = path.join(__dirname, "../../../..");
const ctx = vm.createContext({ window: {}, localStorage: { getItem() { return null; }, setItem() {} } });
for (const f of ["js/constants.js", "js/utils/text.js", "js/utils/cards.js", "js/format.js", "js/analysis/mechanics-data.js", "js/analysis/abilities.js", "js/cache.js", "js/api/scryfall.js", "js/analysis/engines.js"]) {
  try { vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f }); } catch (e) { console.error(f, e.message); }
}

const owned = JSON.parse(fs.readFileSync(path.join(__dirname, "../owned_raw.json"), "utf8"));
const LINKED = 6, STRONG = 14;   // engine bonus: some link / a strong link (CENTER_STRONG_LINK)
const TURNS = 10;
const textOf = (r) => r.oracle_text || (r.card_faces || []).map((f) => f.oracle_text || "").join("\n");
const typeOf = (r) => (r.type_line || (r.card_faces || [])[0]?.type_line || "").toLowerCase();

// Link strength of each raw card against a commander's text, through the builder's own reader. A commander the center
// reader leaves unread gets the shared-terms fallback, scanned over the owned pile plus the cards being scored.
function linkScores(cmdTexts, raws) {
  ctx.cmdTexts = cmdTexts; ctx.raws = raws; ctx.ownedRaws = owned;
  return JSON.parse(vm.runInContext(`(function () {
    const needs = parseCommanderNeeds(cmdTexts);
    const seen = new Set(), pool = [];
    for (const r of ownedRaws.concat(raws)) { if (seen.has(r.name)) continue; seen.add(r.name); pool.push(convertScryfallCard(r)); }
    attachSharedTerms(needs, cmdTexts, pool, { eventEngines: true });
    return JSON.stringify(raws.map((r) => getEngineBonus(convertScryfallCard(r), needs)));
  })()`, ctx));
}

// What a card does for the goldfish, from its text.
function info(raw, link) {
  const t = textOf(raw).toLowerCase(), type = typeOf(raw);
  const cmc = Number(raw.cmc || 0);
  const isLand = type.includes("land") && !type.includes("creature");
  const own = t.replace(new RegExp(raw.name.split(",")[0].toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "~");
  let mana = 0, sick = false;
  if (!isLand && /\{t\}[^.\n]*: add /.test(own)) {
    mana = /add \{[a-z0-9]\}\{[a-z0-9]\}|add two mana|add \{[a-z0-9]\}\{[a-z0-9]\}\{/.test(own) ? 2 : 1;
    sick = type.includes("creature");
  }
  let fetchLand = 0;
  if (!isLand && /search your library for (?:a|up to \w+) (?:basic )?(?:land|forest|island|swamp|mountain|plains)[^.]*(?:onto the battlefield|put (?:it|them|that card) onto the battlefield)/.test(own)) fetchLand = /up to two|two basic|two land/.test(own) ? 2 : 1;
  if (!isLand && /put (?:a|up to \w+) land cards? from your hand onto the battlefield/.test(own)) fetchLand = Math.max(fetchLand, 1);
  let draw = 0;
  const dm = /draws? (a|one|two|three|four|\d+) cards?/.exec(own);
  if (!isLand && dm && !/target (?:player|opponent) draws|each opponent draws/.test(own)) draw = { a: 1, one: 1, two: 2, three: 3, four: 4 }[dm[1]] || Number(dm[1]) || 1;
  return { name: raw.name, cmc, isLand, mana, sick, fetchLand, draw, link: link || 0, type };
}

function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// deck = { commander: info, lands: n, cards: [info, nonland], landfall: bool }
// Landfall (2026-11-25): when the commander triggers on lands entering, a land is a plan card. Each land that enters
// (played or fetched) while the commander is in play counts as a linked play, so Omnath's 5/5 per land shows in plan6/8.
function simulate(deck, games, seed) {
  const rng = mulberry32(seed);
  const land = { name: "Land", isLand: true, mana: 0, cmc: 0, link: 0 };
  const cmdTurn = [], planTurn = {}, effSum = new Array(TURNS + 1).fill(0), effN = new Array(TURNS + 1).fill(0);
  let landfallBy8 = 0, screw3 = 0, linkedBy = { 4: 0, 6: 0, 8: 0 }, planBy = { 4: 0, 6: 0, 8: 0 }, cmdBy = { 4: 0, 5: 0, 6: 0, 8: 0 };
  for (let g = 0; g < games; g++) {
    const lib0 = [];
    for (let i = 0; i < deck.lands; i++) lib0.push(land);
    for (const c of deck.cards) lib0.push(c);
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    let lib = shuffle(lib0.slice()), hand = [];
    // free first mulligan, then bottom one more card per extra mulligan; keep 2-5 lands, max two mulligans
    for (let mull = 0; ; mull++) {
      lib = shuffle(lib0.slice()); hand = lib.splice(0, 7);
      const lc = hand.filter((c) => c.isLand).length;
      if ((lc >= 2 && lc <= 5) || mull >= 2) {
        for (let b = 0; b < Math.max(0, mull - 1); b++) {   // bottom the card we want least: extra lands first, else the dearest spell
          let k = hand.filter((x) => x.isLand).length > 3 ? hand.findIndex((c) => c.isLand) : -1;
          if (k < 0) { k = 0; hand.forEach((c, i) => { if (!c.isLand && c.cmc > hand[k].cmc) k = i; }); }
          lib.push(hand.splice(k, 1)[0]);
        }
        break;
      }
    }
    let lands = 0, rocks = 0, dorksReady = 0, dorksNew = 0, cmdOn = false, cmdAt = 0, linkedCast = 0, strongCast = 0;
    let screwed = false, landfallHits = 0;
    for (let turn = 1; turn <= TURNS; turn++) {
      if (lib.length) hand.push(lib.shift());
      dorksReady += dorksNew; dorksNew = 0;
      const li = hand.findIndex((c) => c.isLand);
      // A landfall deck casts its commander before the land drop when it can (play Omnath, then the land).
      let landPending = li >= 0;
      if (landPending) hand.splice(li, 1);
      if (landPending && !(deck.landfall && !cmdOn && deck.commander.cmc <= lands + rocks + dorksReady)) { lands++; landPending = false; if (deck.landfall && cmdOn) { linkedCast++; landfallHits++; } }
      if (turn === 3 && lands < 3) screwed = true;
      let avail = lands + rocks + dorksReady, total = avail;
      // cast: commander, then cheap ramp early, then linked cards, then the dearest spell that fits
      for (let guard = 0; guard < 12; guard++) {
        let best = null, bestPri = -1e9;
        if (!cmdOn && deck.commander.cmc <= avail) { best = "cmd"; bestPri = 1e6; }
        for (let i = 0; i < hand.length; i++) {
          const c = hand[i];
          if (c.isLand || c.cmc > avail) continue;
          let pri = c.cmc;
          if ((c.mana || c.fetchLand) && turn <= 5) pri += 100 - c.cmc * 5;
          if (c.draw && turn <= 6) pri += 40;
          if (c.link >= LINKED) pri += 60 + c.link;
          if (pri > bestPri) { bestPri = pri; best = i; }
        }
        if (best === null) break;
        if (best === "cmd") { avail -= deck.commander.cmc; cmdOn = true; cmdAt = turn; if (landPending) { lands++; avail++; total++; landPending = false; linkedCast++; landfallHits++; } continue; }
        const c = hand.splice(best, 1)[0];
        avail -= c.cmc;
        if (c.mana) { if (c.sick) dorksNew += c.mana; else { rocks += c.mana; avail += c.mana; total += c.mana; } }
        for (let k = 0; k < c.fetchLand; k++) { const j = lib.findIndex((x) => x.isLand); if (j >= 0) { lib.splice(j, 1); lands++; if (deck.landfall && cmdOn) { linkedCast++; landfallHits++; } } }
        for (let k = 0; k < c.draw; k++) if (lib.length) hand.push(lib.shift());
        if (c.link >= LINKED) linkedCast++;
        if (c.link >= STRONG) strongCast++;
      }
      if (landPending) { lands++; landPending = false; }
      if (turn <= 6) { effSum[turn] += total ? (total - avail) / total : 1; effN[turn]++; }
      if (turn === 8) landfallBy8 += landfallHits;
      for (const T of [4, 6, 8]) if (turn === T) { linkedBy[T] += linkedCast; if (cmdOn && linkedCast >= 3) planBy[T]++; }
      for (const T of [4, 5, 6, 8]) if (turn === T && cmdOn) cmdBy[T]++;
    }
    if (screwed) screw3++;
    cmdTurn.push(cmdOn ? cmdAt : TURNS + 1);
  }
  cmdTurn.sort((a, b) => a - b);
  const eff = []; for (let t = 1; t <= 6; t++) eff.push(effSum[t] / Math.max(1, effN[t]));
  return {
    cmdMedian: cmdTurn[Math.floor(cmdTurn.length / 2)],
    cmdT4: cmdBy[4] / games, cmdT6: cmdBy[6] / games, cmdT8: cmdBy[8] / games,
    linked4: linkedBy[4] / games, linked6: linkedBy[6] / games, linked8: linkedBy[8] / games,
    plan6: planBy[6] / games, plan8: planBy[8] / games, landfall8: landfallBy8 / games,
    screw3: screw3 / games, eff: eff.reduce((a, b) => a + b, 0) / 6
  };
}

const [decksArg, refDir, gamesArg, randArg] = process.argv.slice(2);
if (!decksArg) { console.error("usage: goldfish.js DECKS_FILE[,DECKS_FILE] [REF_DIR] [games] [randomDecks]"); process.exit(1); }
const GAMES = Number(gamesArg) || 3000, RANDOM_DECKS = Number(randArg) || 12;
const ownedBy = new Map(owned.map((r) => [r.name, r]));
for (const r of owned) ownedBy.set(r.name.split(" // ")[0], r);
const refCards = refDir ? JSON.parse(fs.readFileSync(path.join(refDir, "cards.json"), "utf8")) : {};
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const built = {};
for (const f of decksArg.split(",")) {
  const line = fs.readFileSync(f, "utf8").split("\n").find((l) => l.startsWith("DECKS "));
  if (line) Object.assign(built, JSON.parse(line.slice(6)));
}

const pct = (x) => String(Math.round(x * 100)).padStart(3) + "%";
const f1 = (x) => x.toFixed(1).padStart(4);
function evaluate(label, cmdRaws, lands, nonlandRaws, seed) {
  const texts = cmdRaws.map(textOf);
  const links = linkScores(texts, nonlandRaws);
  const cards = nonlandRaws.map((r, i) => info(r, links[i]));
  const cmd = info(cmdRaws[0], 0);
  const landfall = typeof ctx.getCommanderEvents === "function" && ctx.getCommanderEvents(texts).some((e) => e.event === "landfall");
  const sim = simulate({ commander: cmd, lands, cards, landfall }, GAMES, seed);
  sim.landfall = landfall;
  return {
    label, n: cards.length, linked: cards.filter((c) => c.link >= LINKED).length, strong: cards.filter((c) => c.link >= STRONG).length,
    unlinked: cards.filter((c) => c.link === 0).length, avgCmc: cards.reduce((s, c) => s + c.cmc, 0) / cards.length,
    ramp: cards.filter((c) => c.mana || c.fetchLand).length, draw: cards.filter((c) => c.draw).length, ...sim
  };
}
const mean = (rows, k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
function show(r) {
  console.log("  " + r.label.padEnd(9) + String(r.n).padStart(3) + "  link " + String(r.linked).padStart(2) + "/" + String(r.strong).padStart(2) + " none " + String(Math.round(r.unlinked)).padStart(2)
    + "  cmc " + f1(r.avgCmc) + " ramp " + f1(r.ramp) + " draw " + f1(r.draw)
    + " | cmd med T" + r.cmdMedian + " by4 " + pct(r.cmdT4) + " by6 " + pct(r.cmdT6)
    + " | linked cast by6 " + f1(r.linked6) + " plan6 " + pct(r.plan6) + " plan8 " + pct(r.plan8)
    + " | screw3 " + pct(r.screw3) + " mana used " + pct(r.eff) + (r.landfall ? " | landfall by8 " + f1(r.landfall8) : ""));
}

console.log("columns: n nonland | link = cards linked(>=" + LINKED + ") / strong(>=" + STRONG + ") | none = no link | cmc, ramp, draw counts | commander median turn, cast by T4, T6 | linked cards cast by T6, plan online (commander + 3 linked cards) by T6, T8 | <3 lands on T3 | mana spent T1-6");
for (const key of Object.keys(built)) {
  const d = built[key];
  const names = key.split(" + ");
  const cmdRaws = names.map((n) => ownedBy.get(n) || refCards[n]).filter(Boolean);
  if (!cmdRaws.length) { console.log("skip", key); continue; }
  const ci = new Set(cmdRaws.flatMap((r) => r.color_identity || []));
  const nonland = d.entries.map((e) => ownedBy.get(e.name)).filter(Boolean);
  const lands = d.plan.landCount;
  console.log("\n" + key + (d.entries.length !== nonland.length ? "  (" + (d.entries.length - nonland.length) + " names not found)" : ""));
  const rows = [evaluate("builder", cmdRaws, lands, nonland, 1)];
  show(rows[0]);
  // EDHREC average deck
  const refFile = refDir && [slug(key.replace(" + ", " ")), slug(names[0])].map((s) => path.join(refDir, s + ".json")).find((p) => fs.existsSync(p));
  if (refFile) {
    const ref = JSON.parse(fs.readFileSync(refFile, "utf8")).deck;
    const rc = [];
    for (const k of Object.keys(ref.cards)) if (k !== "Land") for (const [nm, q] of ref.cards[k]) { const r = refCards[nm] || ownedBy.get(nm); if (r) for (let i = 0; i < q; i++) rc.push(r); }
    const nl = ref.cards.Land ? ref.cards.Land.reduce((s, x) => s + x[1], 0) : lands;
    const r = evaluate("edhrec", cmdRaws, nl, rc, 2);
    show(r);
  }
  // random fill from the owned pile, same colors, same size
  const pool = owned.filter((r) => !typeOf(r).includes("land") && (r.color_identity || []).every((c) => ci.has(c)) && !names.includes(r.name));
  const rr = [];
  const rng = mulberry32(99);
  for (let k = 0; k < RANDOM_DECKS; k++) {
    const pick = new Set(), picked = [];
    while (picked.length < nonland.length && picked.length < pool.length) { const c = pool[Math.floor(rng() * pool.length)]; if (!pick.has(c.name)) { pick.add(c.name); picked.push(c); } }
    rr.push(evaluate("random", cmdRaws, lands, picked, 100 + k));
  }
  const avg = { label: "random*", n: nonland.length };
  for (const k of Object.keys(rr[0])) if (k !== "label" && k !== "n") avg[k] = mean(rr, k);
  avg.cmdMedian = rr.map((x) => x.cmdMedian).sort((a, b) => a - b)[Math.floor(rr.length / 2)];
  show(avg);
}
console.log("\nrandom* = mean of " + RANDOM_DECKS + " random fills of the owned pile in the commander's colors.");
