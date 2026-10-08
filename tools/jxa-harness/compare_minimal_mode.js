// Ad-hoc driver (not part of the committed test suite) to validate Minimal
// Build mode against the real Rosheen Meanderer case that motivated it:
// confirms the fallback-generic picks it produced (Human Torch, Johnny Storm
// / Iron Spider, Stark Upgrade) are gone under minimal mode, while the
// legitimate EDHREC-sourced pick (Rosheen, Roaring Prophet) survives.
//
// Usage: cat tools/jxa-harness/combined.js tools/jxa-harness/compare_minimal_mode.js > /tmp/run.js && osascript -l JavaScript /tmp/run.js

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
    { themeCardNames, deckSize: 99 }
  );
}

async function main() {
  const name = "Rosheen Meanderer";

  for (const mode of ["", "minimal"]) {
    const finalDeck = await buildForCommander(name, mode);
    const nonlands = finalDeck.filter((c) => c.role !== "land");
    const bySource = {};
    for (const c of nonlands) bySource[c.source] = (bySource[c.source] || 0) + 1;

    jxaPrint(`=== mode="${mode || "(default)"}" ===`);
    jxaPrint("Nonland count: " + nonlands.length);
    jxaPrint("Source breakdown: " + JSON.stringify(bySource));
    jxaPrint("fallback-generic picks: " + nonlands.filter((c) => c.source === "fallback-generic").map((c) => c.name).join(", "));
    jxaPrint("Has Human Torch, Johnny Storm: " + nonlands.some((c) => c.name === "Human Torch, Johnny Storm"));
    jxaPrint("Has Iron Spider, Stark Upgrade: " + nonlands.some((c) => c.name === "Iron Spider, Stark Upgrade"));
    jxaPrint("Has Rosheen, Roaring Prophet: " + nonlands.some((c) => c.name === "Rosheen, Roaring Prophet"));
    jxaPrint("");
  }
}

main().catch((err) => {
  jxaPrint("ERROR: " + (err && err.message ? err.message : String(err)));
  if (err && err.stack) jxaPrint(err.stack);
});
