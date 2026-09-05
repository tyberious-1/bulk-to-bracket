// The deck assembler.
//
// buildDeckFromScoredPool runs four phases: hit the EDHREC type mix from
// EDHREC-owned matches, satisfy any unmet type minimums, fill the remainder
// with whatever best serves the shortest type and role, then force creatures
// in if the collection turned out to be spell-heavy. Lands are added last.
//
// Depends on: cards.js, csv.js, deck-stats.js, manabase.js, scoring.js,
//   text.js, themes.js, type-plan.js

// Backfill redundancy.
//
// scoreFallbackCard's tribal term is +12 against a base of 5, so when EDHREC
// reports a creature-type theme every card of that type outranks everything
// else and the backfill becomes one card seven times: a Krydle build took seven
// Rogues, five of them "unblockable", three contributing no ramp, draw or
// removal at all. The bonus a shared trait earns the first pick should not be
// earned in full by the fifth.
//
// A candidate is charged for its *most* repeated trait rather than the sum over
// all of them -- summing would punish a card for being described in more words
// than its rivals. At this weight the tribal bonus is spent by the fourth copy,
// and the slot goes to something that does a different job.
const FALLBACK_REDUNDANCY_WEIGHT = 4;

// exemptTraits holds what the deck is *trying* to repeat. A Dragon tribal
// commander wants its fourth and tenth Dragon as much as its first, so charging
// for them fights the plan: Rivaz of the Claw went from 13 dragons to 8, with
// none of 23 backfilled slots going to a dragon out of the 35 legal ones owned.
// Accidental sameness is what this penalty is for.
function getCardRedundancyKeys(card, exemptTraits) {
  const keys = new Set([...detectCardTags(card), ...getCardSubtypes(card)]);
  if (exemptTraits) {
    for (const trait of exemptTraits) keys.delete(trait);
  }
  return Array.from(keys);
}

function getRedundancyPenalty(keys, redundancyCounts) {
  let mostRepeated = 0;
  for (const key of keys || []) {
    const seen = redundancyCounts.get(key) || 0;
    if (seen > mostRepeated) mostRepeated = seen;
  }
  return mostRepeated * FALLBACK_REDUNDANCY_WEIGHT;
}

// Same contract as pickBestCardForBucket, but the ranking has to be re-decided
// on every call: the penalty depends on what the deck already holds, so a
// pre-sorted pool cannot answer it.
function pickBestFallbackCard(pool, usedNames, commanderKeys, bucket, curvePlan, redundancyCounts) {
  let best = null;
  let bestScore = -Infinity;
  let bestIgnoringCurve = null;
  let bestIgnoringCurveScore = -Infinity;

  for (const card of pool) {
    const key = normalizeCardName(card.name);
    if (usedNames.has(key) || commanderKeys.has(key)) continue;
    if (getDeckTypeBucket(card.type || card.type_line || "") !== bucket) continue;

    const adjusted = Number(card.score || 0) - getRedundancyPenalty(card.redundancyKeys, redundancyCounts);

    if (curveHasRoom(curvePlan, card.cmc)) {
      if (adjusted > bestScore) {
        best = card;
        bestScore = adjusted;
      }
      continue;
    }

    if (adjusted > bestIgnoringCurveScore) {
      bestIgnoringCurve = card;
      bestIgnoringCurveScore = adjusted;
    }
  }

  // Every band this bucket can still reach is full -- take the best remaining
  // card rather than leaving the slot empty.
  return best || bestIgnoringCurve;
}

function buildDeckFromScoredPool(
  scoredNonlands,
  commanderColors,
  collectionData,
  allOwnedCardData,
  commanderThemes,
  commanderName,
  modePrefs,
  edhrecTypeAverages = null,
  edhrecRoleTargets = null,
  edhrecCards = [],
  options = {}
) {
  const deck = [];
  const usedNames = new Set();

  // A deck may have two commanders (partner, Background, Doctor's companion).
  // Both must be excluded from the 98, under their full name and their front
  // face, since Scryfall reports two-faced cards as "Front // Back".
  const commanderNames = Array.isArray(options.commanderNames) && options.commanderNames.length
    ? options.commanderNames
    : [commanderName];
  const commanderKeys = new Set();
  for (const name of commanderNames) {
    if (!name) continue;
    commanderKeys.add(normalizeCardName(name));
    commanderKeys.add(normalizeCardName(getPrimaryCardName(name)));
  }

  // Cards besides the commanders: 99 alone, 98 for a pair.
  const deckSize = Number(options.deckSize) || 99;

  const strategyProfile = getCommanderStrategyProfile(commanderName, commanderThemes, commanderColors);

  // The traits this deck is built to repeat, which the backfill must not be
  // charged for pursuing -- a Dragon tribal deck wants its tenth Dragon as much
  // as its first.
  //
  // Only the headline tribe counts. EDHREC lists themes by how many decks play
  // them, so the first is what the deck is about: Rivaz of the Claw leads with
  // "dragons" and turns 35 owned dragons into 25 in the deck, while Krydle of
  // Baldur's Gate leads with "mill" and is merely itself a Rogue -- there,
  // seven more Rogues is seven copies of the same card, none of which do
  // anything. Exempting every tribe named anywhere in the themes brought that
  // straight back.
  //
  // A tribe reaches the trait list under two names, "dragon" from the type line
  // and "dragon tribal" from detectCardTags, and exempting one leaves the other
  // charging full price.
  const planTraits = new Set();
  if (strategyProfile.wantsTribal) {
    for (const alias of getCommanderTribalThemes((commanderThemes || []).slice(0, 1))) {
      planTraits.add(alias);
      planTraits.add(alias.replace(" tribal", ""));
    }
  }

  const recommendedLandCount = recommendLandCount(commanderColors);
  const typePlan = buildTypeTargetPlan(edhrecTypeAverages, strategyProfile, recommendedLandCount, commanderThemes, deckSize);
  const targetLandCount = typePlan.landCount;
  const targetNonlandCount = typePlan.nonlandCount;
  const edhrecCardLookup = new Map(
    (Array.isArray(edhrecCards) ? edhrecCards : []).map((entry) => [normalizeCardName(entry.name), entry])
  );

  const roleTargets = normalizeRoleTargets(edhrecRoleTargets);

  const curvePlan = buildCurvePlan(targetNonlandCount);

  const fallbackPool = [];
  const collectionEntries = getCollectionEntries(collectionData);
  for (const entry of collectionEntries) {
    const normalizedName = entry.normalizedName;
    if (commanderKeys.has(normalizedName)) continue;

    const card = allOwnedCardData.get(normalizedName);
    if (!card) continue;
    if (getCardType(card).includes("land")) continue;
    if (!legalForCommander(card.colors, commanderColors)) continue;

    const fit = classifyBackfillModeFit(card, modePrefs);
    if (fit.tier >= 2) continue;
    const modeFitAdjustment = fit.tier === 0 ? 12 : -10;

    fallbackPool.push({
      name: card.name,
      role: detectRole(card),
      score: scoreFallbackCard(card, commanderThemes, strategyProfile, commanderColors, modePrefs) + modeFitAdjustment,
      type: getCardType(card),
      cmc: card.cmc,
      colors: card.colors,
      modeFitTier: fit.tier,
      // Precomputed: the picker reads these once per candidate per slot.
      redundancyKeys: getCardRedundancyKeys(card, planTraits)
    });
  }

  scoredNonlands.sort((a, b) => b.score - a.score);
  fallbackPool.sort((a, b) => b.score - a.score);

  const buckets = ["Creature", "Artifact", "Enchantment", "Instant", "Sorcery", "Planeswalker"];

  // Traits of everything already drafted, EDHREC picks included -- a Rogue
  // taken from the EDHREC pool makes the next Rogue no less of a repeat.
  const redundancyCounts = new Map();

  function getRedundancySource(card) {
    return allOwnedCardData.get(normalizeCardName(card.name))
      || allOwnedCardData.get(normalizeCardName(getPrimaryCardName(card.name)))
      || null;
  }

  function adjustRedundancy(card, delta) {
    const source = getRedundancySource(card);
    if (!source) return;

    for (const key of getCardRedundancyKeys(source, planTraits)) {
      const next = (redundancyCounts.get(key) || 0) + delta;
      if (next > 0) redundancyCounts.set(key, next);
      else redundancyCounts.delete(key);
    }
  }

  function addCard(card, source) {
    if (!card) return false;
    const key = normalizeCardName(card.name);
    if (usedNames.has(key) || commanderKeys.has(key)) return false;
    deck.push({ ...card, source });
    usedNames.add(key);
    recordCurvePick(curvePlan, card.cmc);
    adjustRedundancy(card, 1);
    return true;
  }

  // Phase 1: hit the EDHREC type mix using EDHREC-owned matches first.
  for (const bucket of buckets) {
    const target = Number(typePlan?.buckets?.[bucket]?.target || 0);
    while (getTypePlanBucketNeed(deck, typePlan, bucket) > 0 && deck.length < targetNonlandCount) {
      const edhrecPick = pickBestCardForBucket(scoredNonlands, usedNames, commanderKeys, bucket, curvePlan);
      if (edhrecPick) {
        addCard(edhrecPick, "edhrec");
        continue;
      }

      const fallbackPick = pickBestFallbackCard(fallbackPool, usedNames, commanderKeys, bucket, curvePlan, redundancyCounts);
      if (fallbackPick) {
        addCard(fallbackPick, bucket === "Creature" ? "fallback-creature" : "fallback");
        continue;
      }

      break;
    }
  }

  // Phase 2: satisfy missing type minimums from the rest of the collection.
  for (const neededBucket of getCardsNeededForTypeMinimums(deck, typePlan)) {
    if (deck.length >= targetNonlandCount) break;

    const edhrecPick = pickBestCardForBucket(scoredNonlands, usedNames, commanderKeys, neededBucket, curvePlan);
    if (edhrecPick) {
      addCard(edhrecPick, "edhrec");
      continue;
    }

    const fallbackPick = pickBestFallbackCard(fallbackPool, usedNames, commanderKeys, neededBucket, curvePlan, redundancyCounts);
    if (fallbackPick) {
      addCard(fallbackPick, neededBucket === "Creature" ? "fallback-creature" : "fallback");
    }
  }

  // Phase 3: fill the remaining slots with the best cards, prioritizing whatever type and role is still short.
  const combinedPool = [...scoredNonlands, ...fallbackPool];
  while (deck.length < targetNonlandCount) {
    const best = chooseBestFlexibleCard(combinedPool, deck, typePlan, roleTargets, usedNames, commanderKeys);
    if (!best) break;

    const bucket = getDeckTypeBucket(best.type || best.type_line || "");
    const source = scoredNonlands.includes(best)
      ? "edhrec"
      : bucket === "Creature" ? "fallback-creature" : "fallback";

    addCard(best, source);
  }

  // Phase 4: emergency creature backfill if the collection was extremely spell-heavy.
  const creatureRule = typePlan?.buckets?.Creature;
  if (creatureRule) {
    while ((countByType(deck).Creature || 0) < creatureRule.min && deck.length) {
      const fallbackCreature = pickBestFallbackCard(fallbackPool, usedNames, commanderKeys, "Creature", curvePlan, redundancyCounts);
      if (!fallbackCreature) break;

      let replaceIndex = -1;
      let replaceScore = Infinity;
      const counts = countByType(deck);
      for (let i = 0; i < deck.length; i++) {
        const existing = deck[i];
        const bucket = getDeckTypeBucket(existing.type || existing.type_line || "");
        if (bucket === "Creature") continue;
        const rule = typePlan?.buckets?.[bucket];
        if (rule && (counts[bucket] || 0) <= rule.min) continue;
        if ((existing.score || 0) < replaceScore) {
          replaceScore = existing.score || 0;
          replaceIndex = i;
        }
      }

      if (replaceIndex === -1) break;
      usedNames.delete(normalizeCardName(deck[replaceIndex].name));
      releaseCurvePick(curvePlan, deck[replaceIndex].cmc);
      adjustRedundancy(deck[replaceIndex], -1);
      deck.splice(replaceIndex, 1);
      addCard(fallbackCreature, "fallback-creature");
    }
  }

  const selectedNonbasicLands = buildNonbasicManaBase(
    collectionData,
    allOwnedCardData,
    commanderColors,
    targetLandCount,
    strategyProfile,
    modePrefs,
    edhrecCardLookup
  );

  let remainingLandCount = targetLandCount - selectedNonbasicLands.length;
  if (remainingLandCount < 0) remainingLandCount = 0;

  const basicLands = buildBasicManaBase(
    commanderColors,
    remainingLandCount,
    selectedNonbasicLands
  );

  let finalDeck = [...deck, ...selectedNonbasicLands, ...basicLands];

  while (finalDeck.length < deckSize) {
    const extra = buildBasicManaBase(
      commanderColors,
      1,
      finalDeck.filter((c) => c.role === "land")
    );
    finalDeck.push(...extra);
  }

  if (finalDeck.length > deckSize) {
    finalDeck = finalDeck.slice(0, deckSize);
  }

  return finalDeck;
}

function mergeDeckCounts(deck) {
  const map = new Map();

  for (const card of deck) {
    const key = normalizeCardName(card.name);
    if (!map.has(key)) {
      map.set(key, {
        name: card.name,
        count: 1,
        type: getCardType(card),
        text: getCardText(card),
        role: card.role,
        source: card.source,
        reasons: card.reasons || [],
        scryfallUrl: card.scryfallUrl || card.scryfall_uri || "",
        imageUrl: getCardImageUrl(card)
      });
    } else {
      const existing = map.get(key);
      existing.count += 1;
      existing.reasons = Array.from(new Set([...(existing.reasons || []), ...(card.reasons || [])]));
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function getCardSection(cardType) {
  const type = String(cardType || "").toLowerCase();
  if (type.includes("creature")) return "Creatures";
  if (type.includes("artifact")) return "Artifacts";
  if (type.includes("enchantment")) return "Enchantments";
  if (type.includes("planeswalker")) return "Planeswalkers";
  if (type.includes("instant")) return "Instants";
  if (type.includes("sorcery")) return "Sorceries";
  if (type.includes("land")) return "Lands";
  return "Other";
}

function generateCardReasons(card, commanderThemes, strategyProfile, commanderColors) {
  const reasons = [];
  const tags = detectCardTags(card);
  const role = detectRole(card);

  if (role === "ramp") reasons.push("ramp");
  if (role === "draw") reasons.push("draw");
  if (role === "removal") reasons.push("removal");
  if (role === "wipe") reasons.push("wipe");
  if (isTokenMaker(card)) reasons.push("token maker");
  if (isSacrificeCard(card)) reasons.push("sac outlet");
  if (isGameChanger(card.name)) reasons.push("game changer");

  const themeSignals = buildThemeSignalSet(commanderThemes);
  for (const theme of commanderThemes) {
    const aliases = getThemeAliases(theme);
    if (aliases.some((alias) => tags.includes(alias)) || themeSignals.has(normalizeThemeName(theme)) && tags.includes(normalizeThemeName(theme))) {
      reasons.push(theme);
    }
  }

  if (strategyProfile.wantsTribal) {
    for (const tribe of strategyProfile.tribalTypes) {
      if (hasTribalType(card, tribe)) reasons.push(`${tribe} tribal`);
    }
  }

  if (card.role === "land") {
    if (card.source === "basic-land") reasons.push("basic fixing");
    if (card.source === "nonbasic-land") reasons.push("mana land");
  }

  if (card.source === "edhrec") reasons.push("edhrec match");
  if (card.source === "fallback") reasons.push("collection fallback");
  if (card.source === "fallback-creature") reasons.push("creature fallback");

  return Array.from(new Set(reasons)).slice(0, 5);
}
