// jxaPrint isn't defined by combined.js (it only lives in tests/jxa/helpers.js,
// which isn't part of this harness's concatenation). Defined here, verbatim
// from tests/jxa/helpers.js, so this file's printed output actually reaches
// stdout under `osascript -l JavaScript`.
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

const ownedRaw = readJsonFile("tools/jxa-harness/owned_raw.json");
const prefetch = readJsonFile("tools/jxa-harness/prefetch_data.json");

// Real getEDHREC() calls fetchEdhrecCommanderJson (EDHREC_BASE URLs) and may
// also try theme sub-pages this harness never prefetched -- those simply
// come back "not found" here, same as they would against a live EDHREC that
// has no page for that theme. That's fine: both the "before" and "after" run
// see the same missing data, so the comparison stays fair.
fetch = function (url) {
  const body = prefetch.edhrecPages[url];
  if (body === undefined) {
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
  }
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
};

// Seeds js/cache.js's module-level cardCache so fetchCardDataBatchWithProgress
// finds every owned card already cached and never calls fetch for Scryfall's
// collection endpoint at all.
for (const raw of ownedRaw) {
  const card = convertScryfallCard(raw);
  cardCache.set(normalizeCardName(card.name), card);
  indexCardByFrontFace(cardCache, card);
}

function simulateOpeningHands(finalDeck, commanderColors, trials) {
  const results = {};
  for (const color of commanderColors) results[color] = 0;

  for (let t = 0; t < trials; t++) {
    const shuffled = [...finalDeck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    let hand = shuffled.slice(0, 7);
    const hasAnyLand = hand.some((c) => c.role === "land");
    if (!hasAnyLand) hand = shuffled.slice(0, 6); // one mulligan-to-6, keep the new 6

    for (const color of commanderColors) {
      const hasSource = hand.some((c) => c.role === "land" && Array.isArray(c.colors) && c.colors.includes(color));
      if (hasSource) results[color] += 1;
    }
  }

  const rates = {};
  for (const color of commanderColors) rates[color] = results[color] / trials;
  return rates;
}

function summarize(label, finalDeck, commanderColors) {
  const lands = finalDeck.filter((c) => c.role === "land");
  const nonlands = finalDeck.filter((c) => c.role !== "land");
  const typeCounts = countByType(nonlands);
  const roleCounts = { ramp: 0, draw: 0, removal: 0, wipe: 0, synergy: 0 };
  for (const card of nonlands) {
    // finalDeck entries are deck.js's pushed { ...card, source, roles }
    // objects, which carry only name/type/cmc/colors/score/source/roles --
    // never oracle text (see js/build/deck.js's addCard comment). Calling
    // getRoleContributions(card) directly on one of these always returns []
    // because getCardText(card) is "" for them; deck.js works around this by
    // precomputing `.roles` once against the real collection record at push
    // time, so that's what's read here too, instead of reproducing the bug.
    const roles = card.roles || [];
    if (roles.length === 0) roleCounts.synergy += 1;
    for (const role of roles) if (roleCounts[role] !== undefined) roleCounts[role] += 1;
  }
  const sourceCounts = {};
  for (const color of commanderColors) sourceCounts[color] = 0;
  for (const land of lands) {
    for (const color of (land.colors || [])) if (sourceCounts[color] !== undefined) sourceCounts[color] += 1;
  }
  const handRates = simulateOpeningHands(finalDeck, commanderColors, 2000);

  const cmcCounts = {};
  for (const card of nonlands) {
    const band = Math.round(Number(card.cmc) || 0);
    cmcCounts[band] = (cmcCounts[band] || 0) + 1;
  }

  jxaPrint("--- " + label + " ---");
  jxaPrint("Lands: " + lands.length);
  jxaPrint("Sources: " + JSON.stringify(sourceCounts));
  jxaPrint("Types: " + JSON.stringify(typeCounts));
  jxaPrint("Roles: " + JSON.stringify(roleCounts));
  jxaPrint("CMC: " + JSON.stringify(cmcCounts));
  jxaPrint("Opening-hand on-color rate (2000 trials): " + JSON.stringify(handRates));
}

// Mirrors js/main.js's real build path (lines ~90-360): resolveCommanders +
// getEDHREC + fetchCardDataBatchWithProgress + detectCommanderThemes +
// the candidate-scoring loop + buildThemeCandidateNames + buildDeckFromScoredPool.
// resolveCommanders itself is skipped -- it always calls Scryfall's single-card
// endpoint with no cache check, which this harness has no stub for -- and its
// job (turn a name into a card + color identity) is done directly below from
// the commander card prefetch.py already fetched.
async function buildForCommander(name) {
  const commanderRaw = prefetch.commanderCards[name];
  const commanderCard = convertScryfallCard(commanderRaw);
  const commanders = {
    primary: commanderCard,
    partner: null,
    names: [name],
    colors: commanderRaw.color_identity || []
  };

  const edhrecData = await getEDHREC(commanders.names);
  const edhrecCards = Array.isArray(edhrecData?.cards) ? edhrecData.cards : [];
  const edhrecTags = Array.isArray(edhrecData?.tags) ? edhrecData.tags : [];

  // Real collections come from js/collection/csv.js's parseCSV, which returns
  // { byNormalized: Map<normalizedName, quantity>, byFrontFace, entries, ... }.
  // hasOwnedCard() and getCollectionEntries() both require that shape (in
  // particular collectionData.byNormalized), so it's rebuilt here from
  // ownedRaw the same way parseCSV builds it from CSV rows -- one row per
  // owned copy, deduped by normalized name.
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
  const modePrefs = getModePreferences("", strategyProfile);

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
    if (!card || getCardType(card).includes("land") || !legalForCommander(card.colors, commanders.colors)) continue;

    scoredNonlands.push({
      name: card.name,
      role: detectRole(card, isActiveBuildTribal(strategyProfile, modePrefs)),
      score: scoreCard(card, edhrecCard, commanderThemes, strategyProfile, commanders.colors, modePrefs),
      type: getCardType(card),
      cmc: card.cmc,
      colors: card.colors
    });
  }

  const themeCardNames = await buildThemeCandidateNames(
    commanderThemes,
    collection,
    allOwnedCardData,
    commanders.colors,
    edhrecData?.themeCardLists || {}
  );

  return buildDeckFromScoredPool(
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
    { themeCardNames, deckSize: 99 }
  );
}

async function main() {
  const names = Object.keys(prefetch.commanderCards);
  for (const name of names) {
    const finalDeck = await buildForCommander(name);
    summarize(name, finalDeck, prefetch.commanderCards[name].color_identity || []);
  }
}

main().catch((err) => {
  jxaPrint("ERROR: " + (err && err.message ? err.message : String(err)));
  if (err && err.stack) jxaPrint(err.stack);
});
