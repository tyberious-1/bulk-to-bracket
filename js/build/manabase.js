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

  // A "sacrifice this land: search your library for a basic Swamp, Mountain,
  // or Forest card" effect (Jund Panorama, Grasslands, Krosan Verge...), or the
  // untyped "search your library for a basic land card" (Evolving Wilds,
  // Terramorphic Expanse, Ash Barrens), never says "add" -- it doesn't produce
  // mana itself, it becomes a different land -- so the loop above never sees
  // it. Scanned separately here, one line at a time to match how the loop
  // above is already scoped, so an unrelated ability elsewhere on the card
  // can't attach a color this clause never named.
  //
  // A typed fetch is filed as reliable, the same as a typed dual, not
  // conditional: "reliable" already means "any one of these colors, your
  // choice" rather than "all of them at once" -- a Land - Forest Island
  // doesn't tap for both simultaneously either. Once one of these cracks it
  // behaves exactly like a basic forever after, which is the same guarantee a
  // dual gives, just decided once at crack time instead of re-decided every
  // turn. An untyped fetch is filed as flexible instead, one slot more
  // permissive than a typed one -- it can become any of the deck's colors, not
  // a fixed subset, the same shape "add one mana of the chosen color" already
  // gets credit for above. What a dual does NOT cost that either of these does
  // is a real activation: mana plus sacrificing the land itself, and usually a
  // tapped basic at the end of it. searchesForBasics flags that, so
  // evaluateNonbasicLand can charge for the setup instead of silently
  // pretending it is free.
  //
  // Measured against this collection: 13 owned nonbasic lands carry one of
  // these two effects (Obscura Storefront, Grasslands, Krosan Verge, Jund
  // Panorama, Naya Panorama, Sheltering Landscape, Riveteers Overlook typed;
  // Ash Barrens, Evolving Wilds, Terramorphic Expanse, Warped Landscape,
  // Myriad Landscape, Blighted Woodland untyped), and every one of them scored
  // zero relevant colors and ate evaluateNonbasicLand's flat -20 no-fixing
  // penalty, regardless of how well the fetched types matched the deck.
  let searchesForBasics = false;
  for (const line of text.split("\n")) {
    if (!line.includes("search your library for")) continue;

    let namedType = false;
    for (const [subtype, color] of Object.entries(BASIC_LAND_SUBTYPE_COLORS)) {
      if (line.includes(subtype)) {
        reliable.add(color);
        namedType = true;
      }
    }
    if (namedType) {
      searchesForBasics = true;
      continue;
    }

    // Evolving Wilds, Terramorphic Expanse, Ash Barrens: "search your library
    // for a basic land card", no type named at all. This is strictly more
    // flexible than a typed fetch -- any of the deck's colors, not a fixed
    // subset -- which is exactly what `flexible` already models for a "mana of
    // the chosen color" tap. Two lands (Myriad Landscape, Blighted Woodland)
    // fetch up to two; Myriad Landscape's must share a type, so it only ever
    // realizes one color despite touching two cards.
    if (line.includes("basic land card")) {
      searchesForBasics = true;
      if (line.includes("two basic land cards") && !line.includes("share a")) flexible += 2;
      else flexible += 1;
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
    freeAnyType,
    searchesForBasics
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

// Pip counting for the mana-base math below. Generic numbers and {X} are
// deliberately excluded -- they never force a specific color, so they carry
// no color requirement to plan a land base around.
function parsePips(manaCost) {
  const pips = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  // A split card's mana_cost is both halves joined with " // " (you cast one
  // side, not both) -- count only the first half so the two costs don't sum
  // as if the card required both simultaneously.
  const firstCost = String(manaCost || "").split("//")[0];
  const symbols = firstCost.match(/\{[^}]+\}/g) || [];

  for (const symbol of symbols) {
    const inner = symbol.slice(1, -1);
    if (!inner.includes("/")) {
      if (Object.prototype.hasOwnProperty.call(pips, inner)) pips[inner] += 1;
      continue;
    }

    const parts = inner.split("/");
    const isPhyrexian = parts.includes("P");
    const colorParts = parts.filter((part) => Object.prototype.hasOwnProperty.call(pips, part));
    if (colorParts.length === 0) continue;

    if (isPhyrexian) {
      for (const color of colorParts) pips[color] += 1;
    } else {
      for (const color of colorParts) pips[color] += 1 / colorParts.length;
    }
  }

  return pips;
}

// Land count, estimated once before any card is picked. The estimate has to
// come from the candidate pool rather than the deck itself, because the
// nonland slot count (deckSize - landCount) has to exist before picking can
// start -- see the design doc's "Non-goals" for why this stays single-pass.
function estimateLandCount(candidatePool, commanderColors, roleTargets) {
  const sorted = [...candidatePool].sort((a, b) => (b.score || 0) - (a.score || 0));
  const sample = sorted.slice(0, Math.min(160, sorted.length));

  let totalPips = 0;
  for (const card of sample) {
    const pips = parsePips(card.manaCost);
    for (const color of commanderColors) totalPips += pips[color] || 0;
  }
  const pipIntensity = sample.length ? totalPips / sample.length : 0;

  const rampTarget = Number(roleTargets?.ramp) || 10;
  const baseline = recommendLandCount(commanderColors);
  const raw = baseline + Math.round(pipIntensity * 2) - Math.round((rampTarget - 10) / 3);

  return Math.max(35, Math.min(42, raw));
}

// Blends the pip-based estimate with EDHREC's own reported average, when it
// has one. The pip estimate is the primary land-count basis (see the design
// doc); edhrecTypeAverages.Land, floor/ceiling corrected to [38, 42] the same
// way it always needed (EDHREC's raw average runs land-light in practice --
// see the comment on estimateLandCount above), is now only a sanity bound:
// it keeps a wild pip estimate within 2 lands of what real decks for this
// commander run, rather than overriding it outright.
function resolveLandCount(pipEstimate, edhrecTypeAverages) {
  if (!Number(edhrecTypeAverages?.Land)) return pipEstimate;
  const edhrecLand = Math.max(38, Math.min(42, Math.round(Number(edhrecTypeAverages.Land))));
  return Math.max(edhrecLand - 2, Math.min(edhrecLand + 2, pipEstimate));
}

// Per-color land-source targets, computed from the deck's actual picked
// nonland cards (not an estimate -- by the time this runs, the deck is
// already built). Replaces buildBasicManaBase's old "fewest sources so far"
// identity-only balance with one weighted by real pip counts.
function computeColorSourceTargets(nonlandDeckCards, commanderColors, landCount) {
  const targets = {};
  if (commanderColors.length === 0) return targets;

  const pipTotals = {};
  for (const color of commanderColors) pipTotals[color] = 0;

  for (const card of nonlandDeckCards) {
    const pips = parsePips(card.manaCost);
    for (const color of commanderColors) pipTotals[color] += pips[color] || 0;
  }

  const grandTotal = commanderColors.reduce((sum, color) => sum + pipTotals[color], 0);

  if (grandTotal <= 0) {
    const even = Math.floor(landCount / commanderColors.length);
    let assigned = 0;
    for (const color of commanderColors) {
      targets[color] = even;
      assigned += even;
    }
    let i = 0;
    while (assigned < landCount) {
      targets[commanderColors[i % commanderColors.length]] += 1;
      assigned += 1;
      i += 1;
    }
    return targets;
  }

  // Any color that appears at all is guaranteed enough sources to actually
  // be castable, even if its pip share is small (a one-card splash). The
  // flat 12%-of-landCount minimum is thin for a 2- or 3-color identity: a
  // commander that costs, say, {1}{B}{R} needs both colors reliably every
  // game, but a deck whose 60 nonland spells happen to skew hard toward one
  // of them can otherwise starve the other down to that flat minimum even
  // though it's a primary color, not a splash (see the harness comparison
  // that caught this -- tools/jxa-harness/compare_report.md). Scale a second
  // floor down as more colors compete for the same landCount (so a 5-color
  // splash color still gets much less than a primary one, same as before),
  // but up when there are few colors sharing it, and take the stronger of
  // the two.
  const splashFloor = Math.max(
    8,
    Math.round(0.12 * landCount),
    Math.round(landCount / (commanderColors.length + 0.5))
    // (tuned empirically against tools/jxa-harness/compare.js: +1 recovered
    // about half of Rivaz's regression, +0.5 recovered nearly all of it
    // while leaving Krydle's already-clean result unchanged)
  );
  const floored = {};
  let flooredTotal = 0;
  for (const color of commanderColors) {
    floored[color] = pipTotals[color] > 0 ? splashFloor : 0;
    flooredTotal += floored[color];
  }

  // Enough colors can each demand the splash floor that the floors alone
  // overflow landCount (a 5-color deck at a 35-land count: 5 x 8 = 40 > 35).
  // The fixup loop below only ever reduces a target back down to its own
  // floor, never below it, so if the floors themselves don't fit, nothing
  // after this point could recover -- scale every floor down proportionally
  // right here instead, using a largest-remainder fixup to land on exactly
  // landCount.
  if (flooredTotal > landCount) {
    const scale = landCount / flooredTotal;
    const scaled = {};
    let scaledTotal = 0;
    for (const color of commanderColors) {
      scaled[color] = floored[color] > 0 ? Math.max(1, Math.floor(floored[color] * scale)) : 0;
      scaledTotal += scaled[color];
    }

    const scaledOrder = commanderColors
      .filter((color) => floored[color] > 0)
      .sort((a, b) => pipTotals[b] - pipTotals[a]);
    let j = 0;
    while (scaledTotal < landCount && scaledOrder.length) {
      scaled[scaledOrder[j % scaledOrder.length]] += 1;
      scaledTotal += 1;
      j += 1;
    }
    j = 0;
    let downGuard = landCount * 4;
    while (scaledTotal > landCount && scaledOrder.length && downGuard-- > 0) {
      const color = scaledOrder[j % scaledOrder.length];
      if (scaled[color] > 1) {
        scaled[color] -= 1;
        scaledTotal -= 1;
      }
      j += 1;
    }

    return scaled;
  }

  const remaining = Math.max(0, landCount - flooredTotal);
  let assigned = 0;
  for (const color of commanderColors) {
    const share = pipTotals[color] / grandTotal;
    targets[color] = floored[color] + Math.round(share * remaining);
    assigned += targets[color];
  }

  // Rounding fixups so targets always sum to exactly landCount. Adjust the
  // heaviest-pip colors first -- they have the most room above their floor.
  const order = [...commanderColors].sort((a, b) => pipTotals[b] - pipTotals[a]);
  let guard = landCount * 4;
  let i = 0;
  while (assigned > landCount && guard-- > 0) {
    const color = order[i % order.length];
    if (targets[color] > floored[color]) {
      targets[color] -= 1;
      assigned -= 1;
    }
    i += 1;
  }
  i = 0;
  while (assigned < landCount) {
    targets[order[i % order.length]] += 1;
    assigned += 1;
    i += 1;
  }

  return targets;
}

function recommendLandCount(commanderColors) {
  if (commanderColors.length === 0) return 38;
  if (commanderColors.length === 1) return 36;
  if (commanderColors.length === 2) return 37;
  return 38;
}

function evaluateNonbasicLand(card, commanderColors, strategyProfile, modePrefs, edhrecCardLookup = null, colorTargets = null) {
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
  const totalColorTargets = commanderColors.reduce((sum, color) => sum + (colorTargets?.[color] || 0), 0);
  const avgColorTarget = totalColorTargets > 0 ? totalColorTargets / commanderColors.length : 1;
  const targetWeight = (color) => (colorTargets ? (colorTargets[color] || 0) / avgColorTarget : 1);

  // A flexible source (relevantReliable didn't already cover it) is weighted
  // like the rest of the deck's colors on average, since it isn't tied to one.
  score += relevantReliable.reduce((sum, color) => sum + 6 * targetWeight(color), 0) + flexibleSources * 6;
  score += relevantConditional.reduce((sum, color) => sum + 1.5 * targetWeight(color), 0);

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

  // A dual gives you either of its colors for free, forever, from the turn it
  // enters. A search-for-a-basic land is charging for the same eventual
  // guarantee: a real activation (mana plus sacrificing the land), and the
  // fetched basic itself usually enters tapped on top of that. Charged once
  // regardless of how many types are named -- the cost is paying the ability,
  // not paying it once per color it could have fetched.
  if (mana.searchesForBasics) score -= 3;

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

function buildNonbasicManaBase(collectionData, allOwnedCardData, commanderColors, targetLandCount, strategyProfile, modePrefs, edhrecCardLookup = null, colorTargets = null) {
  const landPool = [];
  const entries = getCollectionEntries(collectionData);

  for (const entry of entries) {
    const normalizedName = entry.normalizedName;

    const card = allOwnedCardData.get(normalizedName);
    if (!card) continue;
    if (!getCardType(card).includes("land")) continue;
    if (isBasicLand(card.name)) continue;
    if (!legalForCommander(card.colors, commanderColors)) continue;

    const landCandidate = evaluateNonbasicLand(card, commanderColors, strategyProfile, modePrefs, edhrecCardLookup, colorTargets);
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

function buildBasicManaBase(commanderColors, landCountNeeded, selectedNonbasics = [], colorTargets = null) {
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

  const deficit = (color) => sourceCounts[color] - (colorTargets?.[color] ?? 0);
  const lands = [];
  const colorsSorted = [...commanderColors].sort((a, b) => deficit(a) - deficit(b));

  for (let i = 0; i < landCountNeeded; i++) {
    colorsSorted.sort((a, b) => deficit(a) - deficit(b));
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
