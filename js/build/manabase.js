// Mana base construction.
//
// Nonbasics are scored and capped by color count (a mono-color deck gets very
// few, a five-color deck gets many), then basics fill the remainder, always
// topping up whichever color has the fewest sources so far.
//
// Depends on: cards.js, constants.js, csv.js, edhrec.js, scoring.js, text.js

const COLORED_MANA_SYMBOLS = ["W", "U", "B", "R", "G"];

const BASIC_LAND_SUBTYPE_COLORS = {
  plains: "W",
  island: "U",
  swamp: "B",
  mountain: "R",
  forest: "G"
};

// Costs that make a mana ability something you can only reach occasionally:
// an extra payment, a one-shot sacrifice, a counter you run out of. Paying
// life is deliberately absent -- it doesn't limit how often the land fixes,
// and the scorer already docks a little for it.
const GATED_ACTIVATION_MARKERS = ["sacrifice", "discard", "exile", "remove", "reveal", "return", "pay"];

function isFreeManaActivation(cost) {
  const cleaned = cost.replace(/[()]/g, "").replace(/pay \d+ life/g, "");
  if (GATED_ACTIVATION_MARKERS.some((marker) => cleaned.includes(marker))) return false;

  // Anything beyond tapping -- generic mana, energy, a snow symbol -- is a cost.
  const symbols = cleaned.match(/\{[^}]*\}/g) || [];
  return symbols.every((symbol) => symbol === "{t}");
}

function readAddedManaColors(effect) {
  const colors = new Set();

  for (const symbol of effect.match(/\{([wubrg])\}/g) || []) {
    colors.add(symbol.replace(/[{}]/g, "").toUpperCase());
  }

  // Covers "one mana of any color" and "any type that a land you control
  // could produce".
  if (effect.includes("mana of any color") || effect.includes("mana of any type")) {
    for (const color of COLORED_MANA_SYMBOLS) colors.add(color);
  }

  return colors;
}

// Scryfall's produced_mana is the union of every color a card could ever add,
// whatever that costs -- so a land that taps for {C} and converts to any color
// for {1} still reports all five. Reading that union as "colors this land
// makes" ranks slow filter lands above real dual lands, so read the mana
// abilities out of the rules text instead and keep the ones a bare {T} pays
// for apart from the ones sitting behind a cost.
//
// Returns:
//   reliable    -- colors a plain tap produces, every turn
//   conditional -- colors only reachable by paying something extra
//   flexible    -- count of "add one mana of the chosen color" taps, which
//                  make exactly one color but not a knowable one
//   freeAnyColor / freeAnyType -- an untaxed any-color ability, worth a bonus
function getLandManaProfile(card) {
  const text = getCardText(card);
  const reliable = new Set();
  const conditional = new Set();
  let flexible = 0;
  let freeAnyColor = false;
  let freeAnyType = false;
  let sawManaAbility = false;

  // A typed dual ("Land - Plains Island") carries its mana abilities in the
  // type line, and Scryfall renders them only as parenthesized reminder text.
  for (const [subtype, color] of Object.entries(BASIC_LAND_SUBTYPE_COLORS)) {
    if (getCardType(card).includes(subtype)) reliable.add(color);
  }

  for (const line of text.split("\n")) {
    const split = line.indexOf(":");
    if (split === -1) continue;

    const cost = line.slice(0, split);
    const effect = line.slice(split + 1);
    if (!effect.includes("add")) continue;

    sawManaAbility = true;
    const colors = readAddedManaColors(effect);

    // "Spend this mana only to cast artifact spells" is mana the deck mostly
    // can't cast with, so it counts the same as mana behind a cost.
    const free = isFreeManaActivation(cost) && !effect.includes("spend this mana only");

    if (effect.includes("of the chosen color")) {
      if (free) flexible += 1;
    }

    if (free) {
      for (const color of colors) reliable.add(color);
      if (effect.includes("mana of any color")) freeAnyColor = true;
      if (effect.includes("mana of any type")) freeAnyType = true;
    } else {
      for (const color of colors) conditional.add(color);
    }
  }

  // No parsable ability at all: trust produced_mana rather than call the land
  // colorless. Filter lands always print their ability, so this only catches
  // cards whose mana comes from somewhere the text doesn't spell out.
  if (!sawManaAbility && !reliable.size) {
    const direct = Array.isArray(card?.producedMana) ? card.producedMana : [];
    for (const color of direct) {
      const upper = String(color || "").toUpperCase();
      if (COLORED_MANA_SYMBOLS.includes(upper)) reliable.add(upper);
    }
  }

  for (const color of reliable) conditional.delete(color);

  return {
    reliable: sortColorsWubrg(Array.from(reliable)),
    conditional: sortColorsWubrg(Array.from(conditional)),
    flexible,
    freeAnyColor,
    freeAnyType
  };
}

// Scaled so a land half of this commander's decks play clearly outranks an
// unranked tapped dual (~10) and a taxed any-color land (~16), while a land
// almost nobody plays adds close to nothing.
//
// The rate itself comes from getEdhrecInclusionRate in edhrec.js. Lands
// deliberately ignore `synergy`: it measures how much *more* than baseline a
// card shows up, and the best lands are baseline by definition, so it reads
// negative for exactly the lands worth playing (Watery Grave -0.21).
const EDHREC_LAND_INCLUSION_WEIGHT = 30;

function recommendLandCount(commanderColors) {
  if (commanderColors.length === 0) return 38;
  if (commanderColors.length === 1) return 36;
  if (commanderColors.length === 2) return 37;
  return 38;
}

function evaluateNonbasicLand(card, commanderColors, strategyProfile, modePrefs, edhrecCardLookup = null) {
  if (!getCardType(card).includes("land")) return null;
  if (isBasicLand(card.name)) return null;

  const mana = getLandManaProfile(card);
  const relevantReliable = mana.reliable.filter((c) => commanderColors.includes(c));
  const relevantConditional = mana.conditional.filter((c) => commanderColors.includes(c));
  const normalizedName = normalizeCardName(card.name);
  const text = getCardText(card);

  // A "choose a color" tap is one real source, but only for a color the deck
  // still needs -- it can't cover two at once.
  const flexibleSources = Math.min(
    mana.flexible,
    Math.max(0, commanderColors.length - relevantReliable.length)
  );
  const reliableSources = relevantReliable.length + flexibleSources;

  let score = 0;
  score += reliableSources * 6;
  score += relevantConditional.length * 1.5;

  if (normalizedName === "command tower") score += 10;
  if (normalizedName === "exotic orchard") score += 7;
  if (normalizedName === "path of ancestry" && strategyProfile.wantsTribal) score += 9;
  if (normalizedName === "secluded courtyard" && strategyProfile.wantsTribal) score += 8;
  if (normalizedName === "unclaimed territory" && strategyProfile.wantsTribal) score += 8;

  if (card.name.toLowerCase().includes("triome")) score += 8;
  if (card.name.toLowerCase().includes("pathway")) score += 6;

  // Only an untaxed any-color tap earns this. Gated versions already had their
  // colors counted at the conditional rate above; paying the bonus too is what
  // used to float filter lands over real duals.
  if (mana.freeAnyColor) score += 6;
  if (mana.freeAnyType) score += 5;

  if (strategyProfile.wantsTokens && text.includes("create") && text.includes("token")) score += 5;
  if (strategyProfile.wantsSacrifice && text.includes("sacrifice")) score += 4;
  if (strategyProfile.wantsGoWide && text.includes("creature")) score += 2;

  // "Enters tapped unless ..." is a land that can come down untapped, which
  // beats one that never can -- so refund part of the tapped penalty rather
  // than stacking a second one on top of it.
  if (text.includes("enters tapped")) score -= 2;
  if (text.includes("enters tapped unless")) score += 1;
  if (text.includes("pay 1 life")) score -= 0.5;
  if (reliableSources === 0 && relevantConditional.length === 0) score -= 20;

  if (strategyProfile.monoColor) {
    if (!isSynergisticMonoColorLand(card, commanderColors, strategyProfile)) score -= 12;
    if (isLowPriorityMonoColorFixer(card, commanderColors)) score -= 12;
  }

  if (modePrefs.themeFocus) {
    if (cardMatchesThemeFocus(card, modePrefs)) score += 5;
    else score -= 6;
  }

  // How often real decks for this commander actually play the land beats any
  // text heuristic at ranking one dual against another, so where EDHREC has an
  // opinion it leads. Lands it has never seen keep their heuristic score --
  // which for an off-meta collection is most of them.
  const inclusionRate = getEdhrecInclusionRate(edhrecCardLookup?.get(normalizedName));
  if (inclusionRate !== null) score += inclusionRate * EDHREC_LAND_INCLUSION_WEIGHT;

  score *= modePrefs.manaBaseBias;

  return {
    name: card.name,
    role: "land",
    score,
    type: getCardType(card),
    cmc: 0,
    // Reliable colors only: buildBasicManaBase counts these as existing
    // sources, and a filter land shouldn't tell it every color is covered.
    colors: mana.reliable,
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
