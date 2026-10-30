// Plan audit (not part of the committed dev/tests/jxa suite): builds a commander with the real
// builder, then reports how well the deck carries the commander's plan. For each engine class it
// lists the owned legal cards, which were picked, and a reason for each one left out; it prints the
// deck's composition, mechanic checks (vehicle count vs creatures, crew coverage, Roads lands) and
// a wording scan for owned cards that talk about the mechanic but fall in no class.
//
// Usage: bash dev/tools/jxa-harness/build_harness.sh OUT/h.js
//        (echo 'const ONLY_COMMANDERS = ["Greasefang, Okiba Boss"];'; cat OUT/h.js dev/tools/jxa-harness/plan_audit.js) > OUT/run.js
//        osascript -l JavaScript OUT/run.js
// Add connections.js between the harness and this file for the connection report (outputs meeting inputs).
// Optional globals set before the script: ONLY_COMMANDERS, MODE_OVERRIDE, PREFETCH_PATH (a fixture
// with the commander added; default prefetch_data.json).
// Reasons are heuristics ("outscored" compares with the weakest pick of the class); read them as leads.

function jxaPrint(s) {
  $.NSFileHandle.fileHandleWithStandardOutput.writeData(
    $.NSString.alloc.initWithUTF8String(s + "\n").dataUsingEncoding($.NSUTF8StringEncoding)
  );
}

function readJsonFile(path) {
  const standardized = $.NSString.alloc.initWithString(path).stringByStandardizingPath.js;
  const data = $.NSData.dataWithContentsOfFile(standardized);
  const str = $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding).js;
  return JSON.parse(str);
}

// Build from a seeded random fraction of the collection to test thin inventories
// (1 = everything). Pair it with `synergy_measure.py --slice <same value>`.
const SAMPLE_FRACTION = 1;
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ownedRawAll = readJsonFile("dev/tools/jxa-harness/owned_raw.json");
const rng = mulberry32(12345);
const ownedRaw = SAMPLE_FRACTION >= 1 ? ownedRawAll : ownedRawAll.filter(() => rng() < SAMPLE_FRACTION);
const prefetch = readJsonFile(typeof PREFETCH_PATH !== "undefined" ? PREFETCH_PATH : "dev/tools/jxa-harness/prefetch_data.json");

fetch = function (url) {
  const body = prefetch.edhrecPages[url];
  if (body === undefined) {
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
  }
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
};

for (const raw of ownedRaw) {
  const card = convertScryfallCard(raw);
  cardCache.set(normalizeCardName(card.name), card);
  indexCardByFrontFace(cardCache, card);
}

// A key like "Tormod, the Desecrator + Ghost of Ramirez DePietro" builds the
// partner pair; both cards need an entry in prefetch.commanderCards.
async function auditForCommander(key, mode) {
  const [name, partnerName] = key.split(" + ");
  const commanderRaw = prefetch.commanderCards[name];
  const commanderCard = convertScryfallCard(commanderRaw);
  const partnerRaw = partnerName ? prefetch.commanderCards[partnerName] : null;
  const partnerCard = partnerRaw ? convertScryfallCard(partnerRaw) : null;
  const colorSet = new Set([...(commanderRaw.color_identity || []), ...(partnerRaw?.color_identity || [])]);
  const commanders = {
    primary: commanderCard,
    partner: partnerCard,
    names: partnerCard ? [name, partnerCard.name] : [name],
    colors: sortColorsWubrg(Array.from(colorSet))
  };

  const edhrecData = await getEDHREC(commanders.names);
  const edhrecCards = Array.isArray(edhrecData?.cards) ? edhrecData.cards : [];
  const edhrecTags = Array.isArray(edhrecData?.tags) ? edhrecData.tags : [];

  const byNormalized = new Map();
  const firstSeenName = new Map();
  for (const raw of ownedRaw) {
    const normalizedName = normalizeCardName(raw.name);
    byNormalized.set(normalizedName, (byNormalized.get(normalizedName) || 0) + 1);
    if (!firstSeenName.has(normalizedName)) firstSeenName.set(normalizedName, raw.name);
  }
  const entries = Array.from(byNormalized.entries()).map(([normalizedName, quantity]) => ({
    rawName: firstSeenName.get(normalizedName) || normalizedName,
    normalizedName,
    quantity
  }));
  const byFrontFace = new Map();
  for (const entry of entries) {
    const front = normalizeCardName(getPrimaryCardName(entry.normalizedName));
    if (!front || front === entry.normalizedName) continue;
    if (byNormalized.has(front) || byFrontFace.has(front)) continue;
    byFrontFace.set(front, entry.quantity);
  }
  const collection = { byNormalized, byFrontFace, entries, originals: entries, uniqueRawNames: entries.map((entry) => entry.rawName) };
  const allOwnedNames = ownedRaw.map((raw) => raw.name);
  const allOwnedCardData = await fetchCardDataBatchWithProgress(allOwnedNames, () => {});

  const commanderThemes = await detectCommanderThemes(
    edhrecCards,
    edhrecTags,
    collection,
    allOwnedCardData,
    commanders.colors
  );

  const strategyProfile = getCommanderStrategyProfile(commanders.primary.name, commanderThemes, commanders.colors);
  const modePrefs = getModePreferences(mode, strategyProfile);
  modePrefs.engineNeeds = applyEventSwitch(parseCommanderNeeds([commanderCard.text, partnerCard?.text]), modePrefs);

  const ownedCandidates = edhrecCards.length
    ? edhrecCards.filter((c) => hasOwnedCard(collection, c.name))
    : getCollectionEntries(collection).map((entry) => ({ name: entry.rawName, synergy: 0, decks: 0, label: "Collection Fallback", labels: ["Collection Fallback"] }));

  const ownedCardData = new Map();
  for (const candidate of ownedCandidates) {
    const normalizedName = normalizeCardName(candidate.name);
    if (allOwnedCardData.has(normalizedName)) ownedCardData.set(normalizedName, allOwnedCardData.get(normalizedName));
  }

  const scoredNonlands = [];
  for (const edhrecCard of ownedCandidates) {
    const normalizedName = normalizeCardName(edhrecCard.name);
    const card = ownedCardData.get(normalizedName);
    if (!card || getCardType(card).includes("land") || !legalForCommander(card.colors, commanders.colors) || deadForColors(card, commanders.colors)) continue;

    scoredNonlands.push({
      name: card.name,
      role: detectRole(card, isActiveBuildTribal(strategyProfile, modePrefs)),
      score: scoreCard(card, edhrecCard, commanderThemes, strategyProfile, commanders.colors, modePrefs),
      type: getCardType(card),
      cmc: card.cmc,
      colors: card.colors
    });
  }

  const themeCardNames = modePrefs.minimalBuild
    ? new Map()
    : await buildThemeCandidateNames(
        commanderThemes,
        collection,
        allOwnedCardData,
        commanders.colors,
        edhrecData?.themeCardLists || {}
      );

  if (!modePrefs.minimalBuild) {
    addEngineCandidates(themeCardNames, modePrefs.engineNeeds, allOwnedCardData, commanders.colors);
  }

  const deck = await buildDeckFromScoredPool(
    scoredNonlands,
    commanders.colors,
    collection,
    allOwnedCardData,
    commanderThemes,
    commanders.primary.name,
    modePrefs,
    edhrecData?.typeAverages || null,
    edhrecData?.roleTargets || null,
    edhrecCards,
    { themeCardNames, deckSize: partnerCard ? 98 : 99, commanderTexts: [commanderCard.text, partnerCard?.text].filter(Boolean) }
  );
  return auditDeck(key, deck, { commanderCards: [commanders.primary, commanders.partner].filter(Boolean), commanderNames: commanders.names, needs: modePrefs.engineNeeds, allOwnedCardData, scoredNonlands, themeCardNames, colors: commanders.colors, commanderThemes, strategyProfile, modePrefs });
}

function frontType(card) { return getCardType(card).split("—")[0]; }

function auditDeck(key, deck, ctx) {
  const { commanderNames, needs, allOwnedCardData, scoredNonlands, themeCardNames, colors, commanderThemes, strategyProfile, modePrefs } = ctx;
  const lines = [];
  const say = (s) => lines.push(s);
  const dataOf = (name) => allOwnedCardData.get(normalizeCardName(name));
  const pickedNames = new Set(deck.map((c) => c.name));
  const payloads = getPayloadTypes(needs);

  say("=== " + key + " ===");
  say("payload types: " + (payloads.join(", ") || "none") + " | event ids: " + ((needs.events || []).map((e) => e.id || e).join(", ") || "none"));

  // Composition
  const comp = {};
  for (const c of deck) {
    let k;
    if (c.role === "land") k = "land";
    else {
      const d = dataOf(c.name);
      const t = d ? getCardType(d) : "?";
      const front = t.split("—")[0];
      if (t.includes("vehicle") && !front.includes("creature")) k = "vehicle";
      else if (front.includes("creature")) k = t.includes("mount") ? "creature (mount)" : "creature";
      else k = ["planeswalker", "artifact", "enchantment", "instant", "sorcery"].find((x) => front.includes(x)) || t;
    }
    comp[k] = (comp[k] || 0) + 1;
  }
  say("composition (" + deck.length + "): " + Object.entries(comp).map(([k, v]) => k + " " + v).join(", "));
  const roles = {};
  for (const c of deck) if (c.role && c.role !== "land") roles[c.role] = (roles[c.role] || 0) + 1;
  say("roles: " + Object.entries(roles).map(([k, v]) => k + " " + v).join(", "));

  // Per-class coverage
  const scoreByName = new Map(scoredNonlands.map((r) => [r.name, r.score]));
  const classRows = {};
  const unclassified = [];
  for (const [norm, card] of allOwnedCardData) {
    if (frontType(card).includes("land") || commanderNames.includes(card.name)) continue;
    if (!legalForCommander(card.colors, colors, card) || deadForColors(card, colors)) continue;
    const classes = getEngineClasses(card, needs).filter((c) => !String(c).startsWith("event:"));
    const text = String(card.text || "").toLowerCase();
    if (!classes.length && payloads.length && /\b(crew|saddle|vehicles?|mounts?)\b/.test(text)) unclassified.push(card.name);
    for (const cls of classes) (classRows[cls] = classRows[cls] || []).push(card);
  }
  for (const [cls, cards] of Object.entries(classRows)) {
    const rowScore = (card) => {
      if (scoreByName.has(card.name)) return scoreByName.get(card.name);
      return scoreFallbackCard(card, commanderThemes, strategyProfile, colors, modePrefs);
    };
    const picked = cards.filter((c) => pickedNames.has(c.name));
    const left = cards.filter((c) => !pickedNames.has(c.name));
    const pickedScores = picked.map(rowScore);
    const weakest = pickedScores.length ? Math.min(...pickedScores) : null;
    say("");
    say("class " + cls + ": owned " + cards.length + ", picked " + picked.length);
    const rows = left.map((c) => ({ c, s: rowScore(c) })).sort((a, b) => b.s - a.s).slice(0, 12);
    for (const { c, s } of rows) {
      const inPool = scoreByName.has(c.name) || themeCardNames.has(normalizeCardName(c.name));
      let why;
      if (!inPool) why = "in no candidate pool";
      else if (weakest !== null && s < weakest) why = "outscored by weakest pick (" + weakest.toFixed(1) + ")";
      else why = "scores at or above the weakest pick (" + (weakest === null ? "none picked" : weakest.toFixed(1)) + "): cut by a bucket target, role cap or cap";
      say("  out: " + c.name + " score " + s.toFixed(1) + " bonus " + getEngineBonus(c, needs) + " -> " + why);
    }
    if (left.length > rows.length) say("  ... " + (left.length - rows.length) + " more not shown");
  }

  if (unclassified.length) say("\nplan wording but no engine class (" + unclassified.length + "): " + unclassified.slice(0, 25).join(", ") + (unclassified.length > 25 ? ", ..." : ""));

  // Mechanic checks
  say("");
  const deckCards = deck.filter((c) => c.role !== "land").map((c) => dataOf(c.name)).filter(Boolean);
  const creatures = deckCards.filter((c) => frontType(c).includes("creature"));
  const vehicles = deckCards.filter((c) => getCardType(c).includes("vehicle") && !frontType(c).includes("creature"));
  if (payloads.includes("vehicle")) {
    const limit = Math.floor(creatures.length / ENGINE_CREATURES_PER_VEHICLE);
    say("check vehicles: " + vehicles.length + " vehicles vs " + creatures.length + " creatures (ceiling " + limit + "): " + (vehicles.length <= limit ? "ok" : "OVER"));
    const crewers = creatures.map((c) => getCrewPower(c)).filter((p) => !(p < 0));
    const uncrewable = vehicles.filter((v) => {
      const m = /crew (\d+)/.exec(String(v.text || "").toLowerCase());
      if (!m) return false;
      const need = Number(m[1]);
      return crewers.filter((p) => p >= Math.ceil(need / 2)).length < 2;
    });
    say("check crew coverage: " + (uncrewable.length ? "no pair of creatures crews " + uncrewable.map((v) => v.name).join(", ") : "every vehicle has a crewing pair"));
  }
  if (payloads.includes("mount")) {
    const mounts = creatures.filter((c) => getCardType(c).includes("mount"));
    say("check mounts: " + mounts.length + " Mounts in the deck");
  }
  if (payloads.length) {
    const roads = [];
    for (const [norm, card] of allOwnedCardData) {
      if (!frontType(card).includes("land")) continue;
      if (!legalForCommander(card.colors, colors, card)) continue;
      if (getEngineLandBonus(card, needs) > 0) roads.push(card.name);
    }
    const landsIn = new Set(deck.filter((c) => c.role === "land").map((c) => c.name));
    const missing = roads.filter((n) => !landsIn.has(n));
    say("check payload lands: owned " + roads.length + ", in deck " + (roads.length - missing.length) + (missing.length ? ", missing " + missing.join(", ") : ""));
  }
  if (typeof connectionReport === "function") {
    const cmdRows = ctx.commanderCards.map((card) => ({ card, role: "commander" }));
    const rows = deck.filter((c) => c.role !== "land").map((c) => ({ card: dataOf(c.name), role: c.role })).filter((r) => r.card);
    say(connectionReport(cmdRows.concat(rows), allOwnedCardData, colors, commanderNames));
  }
  return lines.join("\n");
}

async function main() {
  const only = typeof ONLY_COMMANDERS !== "undefined" ? ONLY_COMMANDERS : [Object.keys(prefetch.commanderCards)[0]];
  for (const name of only) {
    jxaPrint(await auditForCommander(name, typeof MODE_OVERRIDE !== "undefined" ? MODE_OVERRIDE : ""));
  }
}

main().catch((err) => jxaPrint("ERROR: " + (err && err.stack ? err.stack : String(err))));
