// Ad-hoc driver (not part of the committed tests/jxa suite): builds every
// commander in prefetch_data.json and prints their nonland card names as JSON,
// ready for synergy_measure.py.
//
// Usage: bash tools/jxa-harness/build_harness.sh tools/jxa-harness/combined.js
//        cat tools/jxa-harness/combined.js tools/jxa-harness/dump_decks.js > /tmp/run.js
//        osascript -l JavaScript /tmp/run.js | grep '^DECKS ' | sed 's/^DECKS //' > decks.json
//        python3 tools/jxa-harness/synergy_measure.py decks.json
//
// Note: the tracked prefetch_data.json holds commander pages only, while the app
// also fetches up to 12 theme pages per commander, so builds here use a smaller
// EDHREC pool than the real app (about 30 vs 40 of 60 picks from EDHREC).

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
const ownedRawAll = readJsonFile("tools/jxa-harness/owned_raw.json");
const rng = mulberry32(12345);
const ownedRaw = SAMPLE_FRACTION >= 1 ? ownedRawAll : ownedRawAll.filter(() => rng() < SAMPLE_FRACTION);
const prefetch = readJsonFile("tools/jxa-harness/prefetch_data.json");

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

async function buildForCommander(name, mode) {
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

  const themeCardNames = modePrefs.minimalBuild
    ? new Map()
    : await buildThemeCandidateNames(
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
    { themeCardNames, deckSize: 99, commanderTexts: [commanderCard.text] }
  );
}


async function main() {
  const out = {};
  for (const name of Object.keys(prefetch.commanderCards)) {
    if (name === "Rosheen Meanderer") continue;
    const deck = await buildForCommander(name, "");
    out[name] = { current: deck.filter((c) => c.role !== "land").map((c) => c.name) };
  }
  jxaPrint("DECKS " + JSON.stringify(out));
}

main().catch((err) => jxaPrint("ERROR: " + (err && err.stack ? err.stack : String(err))));
