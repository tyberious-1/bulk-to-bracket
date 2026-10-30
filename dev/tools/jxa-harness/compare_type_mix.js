// Ad-hoc driver (not part of the committed dev/tests/jxa suite) that builds every
// commander in prefetch_data.json and reports, per build, how far each card
// type sits from EDHREC's own average deck, plus the total support-role
// contributions and where the picks came from. The last line sums the absolute
// type gaps across every build: the one number to compare before and after a
// builder change. Baseline as of the 2026-10-13 collection with the Phase 1b
// quality floor at 0.6: 210 across the 54 fixture builds (112 of that across
// the original 26; the 28 spell-heavy commanders added later were 298 before
// Phase 1b and 96 after).
//
// Usage: bash dev/tools/jxa-harness/build_harness.sh dev/tools/jxa-harness/combined.js
//        cat dev/tools/jxa-harness/combined.js dev/tools/jxa-harness/compare_type_mix.js > /tmp/run.js
//        osascript -l JavaScript /tmp/run.js
// Pass a mode other than default by editing MODE below (e.g. "curveFirst").

const MODE = "";

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

const ownedRaw = readJsonFile("dev/tools/jxa-harness/owned_raw.json");
const prefetch = readJsonFile("dev/tools/jxa-harness/prefetch_data.json");

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


const BUCKETS = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment"];

async function main() {
  let totalGap = 0;
  let builds = 0;
  jxaPrint("commander".padEnd(30) + "type gaps vs EDHREC (ours-theirs)".padEnd(40) + "role totals R/D/Rm/W".padEnd(24) + "picks edhrec/fallback");
  for (const name of Object.keys(prefetch.commanderCards)) {
    if (name === "Rosheen Meanderer") continue;
    const page = prefetch.edhrecPages["https://json.edhrec.com/pages/commanders/" + slugifyForEdhrec(name) + ".json"];
    if (!page) continue;
    const avg = {};
    for (const x of page.panels.piechart.content) avg[x.label] = x.value;

    const deck = await buildForCommander(name, MODE);
    const nonland = deck.filter((c) => c.role !== "land");
    const count = (k) => nonland.filter((c) => getDeckTypeBucket(c.type || "") === k).length;
    const gaps = BUCKETS.map((k) => count(k) - (avg[k] || 0));
    totalGap += gaps.reduce((sum, g) => sum + Math.abs(g), 0);
    builds += 1;

    const roles = ["ramp", "draw", "removal", "wipe"].map((r) => nonland.filter((c) => (c.roles || []).includes(r)).length);
    const fromEdhrec = nonland.filter((c) => c.source === "edhrec").length;
    jxaPrint(
      name.slice(0, 29).padEnd(30) +
      BUCKETS.map((k, i) => k.slice(0, 2) + (gaps[i] >= 0 ? "+" : "") + gaps[i]).join(" ").padEnd(40) +
      roles.join("/").padEnd(24) +
      fromEdhrec + "/" + (nonland.length - fromEdhrec)
    );
  }
  jxaPrint("");
  jxaPrint("total absolute type gap across " + builds + " builds: " + totalGap);
}

main().catch((err) => jxaPrint("ERROR: " + (err && err.stack ? err.stack : String(err))));
