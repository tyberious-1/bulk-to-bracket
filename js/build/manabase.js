// Mana base construction.
//
// Nonbasics are scored and capped by color count (a mono-color deck gets very
// few, a five-color deck gets many), then basics fill the remainder, always
// topping up whichever color has the fewest sources so far.
//
// Depends on: cards.js, constants.js, csv.js, scoring.js, text.js

function getProducedManaColors(card) {
  const valid = new Set(["W", "U", "B", "R", "G"]);
  const directProduced = Array.isArray(card?.producedMana) ? card.producedMana : [];
  const produced = new Set(
    directProduced
      .map((color) => String(color || "").toUpperCase())
      .filter((color) => valid.has(color))
  );

  const text = getCardText(card);
  if (text.includes("mana of any color")) {
    for (const color of ["W", "U", "B", "R", "G"]) produced.add(color);
  }

  const addLines = text.split("\n").filter((line) => line.includes("add"));
  for (const line of addLines) {
    const matches = line.match(/\{([wubrg])\}/g) || [];
    for (const symbol of matches) {
      const color = symbol.replace(/[{}]/g, "").toUpperCase();
      if (valid.has(color)) produced.add(color);
    }
  }

  return sortColorsWubrg(Array.from(produced));
}

function recommendLandCount(commanderColors) {
  if (commanderColors.length === 0) return 38;
  if (commanderColors.length === 1) return 36;
  if (commanderColors.length === 2) return 37;
  return 38;
}

function evaluateNonbasicLand(card, commanderColors, strategyProfile, modePrefs, edhrecCardLookup = null) {
  if (!getCardType(card).includes("land")) return null;
  if (isBasicLand(card.name)) return null;

  const produced = getProducedManaColors(card);
  const relevantProduced = produced.filter((c) => commanderColors.includes(c));
  const normalizedName = normalizeCardName(card.name);
  const text = getCardText(card);

  let score = 0;
  score += relevantProduced.length * 6;

  if (normalizedName === "command tower") score += 10;
  if (normalizedName === "exotic orchard") score += 7;
  if (normalizedName === "path of ancestry" && strategyProfile.wantsTribal) score += 9;
  if (normalizedName === "secluded courtyard" && strategyProfile.wantsTribal) score += 8;
  if (normalizedName === "unclaimed territory" && strategyProfile.wantsTribal) score += 8;

  if (card.name.toLowerCase().includes("triome")) score += 8;
  if (card.name.toLowerCase().includes("pathway")) score += 6;

  if (text.includes("add one mana of any color")) score += 6;
  if (text.includes("add one mana of any type")) score += 5;

  if (strategyProfile.wantsTokens && text.includes("create") && text.includes("token")) score += 5;
  if (strategyProfile.wantsSacrifice && text.includes("sacrifice")) score += 4;
  if (strategyProfile.wantsGoWide && text.includes("creature")) score += 2;

  if (text.includes("enters tapped")) score -= 2;
  if (text.includes("unless you control")) score -= 1;
  if (text.includes("pay 1 life")) score -= 0.5;
  if (relevantProduced.length === 0) score -= 20;

  if (strategyProfile.monoColor) {
    if (!isSynergisticMonoColorLand(card, commanderColors, strategyProfile)) score -= 12;
    if (isLowPriorityMonoColorFixer(card, commanderColors)) score -= 12;
  }

  if (modePrefs.themeFocus) {
    if (cardMatchesThemeFocus(card, modePrefs)) score += 5;
    else score -= 6;
  }

  const edhrecEntry = edhrecCardLookup?.get(normalizedName);
  if (edhrecEntry) {
    score += Math.max(0, Number(edhrecEntry.synergy || 0)) * 0.8;
    score += Math.min(12, Number(edhrecEntry.decks || 0) / 350);
    const labels = Array.isArray(edhrecEntry.labels)
      ? edhrecEntry.labels.map((x) => normalizeThemeName(x))
      : [normalizeThemeName(edhrecEntry.label)];
    if (labels.some((label) => label.includes("land"))) score += 4;
  }

  score *= modePrefs.manaBaseBias;

  return {
    name: card.name,
    role: "land",
    score,
    type: getCardType(card),
    cmc: 0,
    colors: produced,
    source: "nonbasic-land"
  };
}

function buildNonbasicManaBase(collectionData, allOwnedCardData, commanderColors, targetLandCount, strategyProfile, modePrefs, edhrecCardLookup = null) {
  const landPool = [];
  const entries = getCollectionEntries(collectionData);

  for (const entry of entries) {
    const normalizedName = entry.normalizedName;

    const card = allOwnedCardData.get(normalizedName);
    if (!card) continue;
    if (!getCardType(card).includes("land")) continue;
    if (isBasicLand(card.name)) continue;
    if (!legalForCommander(card.colors, commanderColors)) continue;

    const landCandidate = evaluateNonbasicLand(card, commanderColors, strategyProfile, modePrefs, edhrecCardLookup);
    if (!landCandidate) continue;
    landPool.push(landCandidate);
  }

  landPool.sort((a, b) => b.score - a.score);

  const threshold =
    commanderColors.length === 1 ? 7 :
    commanderColors.length === 2 ? 4 :
    commanderColors.length === 3 ? 3 :
    2;

  const filtered = landPool.filter((land) => land.score >= threshold);

  const maxNonbasicCount =
    commanderColors.length === 1 ? Math.min(6, targetLandCount) :
    commanderColors.length === 2 ? Math.min(modePrefs.manaBaseBias > 1 ? 15 : 12, targetLandCount) :
    commanderColors.length === 3 ? Math.min(modePrefs.manaBaseBias > 1 ? 18 : 16, targetLandCount) :
    Math.min(modePrefs.manaBaseBias > 1 ? 22 : 20, targetLandCount);

  return filtered.slice(0, maxNonbasicCount);
}

function buildBasicManaBase(commanderColors, landCountNeeded, selectedNonbasics = []) {
  if (landCountNeeded <= 0) return [];

  if (commanderColors.length === 0) {
    return Array.from({ length: landCountNeeded }, () => ({
      name: "Wastes",
      role: "land",
      score: 0,
      type: "basic land",
      cmc: 0,
      colors: [],
      source: "basic-land"
    }));
  }

  const sourceCounts = {};
  for (const color of commanderColors) sourceCounts[color] = 0;

  for (const land of selectedNonbasics) {
    const produced = Array.isArray(land.colors) ? land.colors : [];
    for (const color of produced) {
      if (sourceCounts[color] !== undefined) sourceCounts[color] += 1;
    }
  }

  const lands = [];
  const colorsSorted = [...commanderColors].sort((a, b) => sourceCounts[a] - sourceCounts[b]);

  for (let i = 0; i < landCountNeeded; i++) {
    colorsSorted.sort((a, b) => sourceCounts[a] - sourceCounts[b]);
    const color = colorsSorted[0];
    sourceCounts[color] += 1;

    lands.push({
      name: COLOR_TO_BASIC[color],
      role: "land",
      score: 0,
      type: "basic land",
      cmc: 0,
      colors: [color],
      source: "basic-land"
    });
  }

  return lands;
}
