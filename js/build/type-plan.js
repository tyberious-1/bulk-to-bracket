// Type-mix planning.
//
// buildTypeTargetPlan turns EDHREC's average type counts into per-bucket
// target/min/max rules that always sum to the nonland slot count, so the
// builder can never overfill instants while starving creatures. The rest of
// the module answers "what does this deck still need?" against that plan.
//
// Depends on: deck-stats.js, text.js, themes.js

// deckSize is the number of cards besides the commanders: 99 for a single
// commander, 98 when a partner or Background takes the second slot.
function buildTypeTargetPlan(edhrecTypeAverages, strategyProfile, targetLandCount, commanderThemes = [], deckSize = 99) {
  const themeSignals = buildThemeSignalSet(commanderThemes);
  // EDHREC's average land count runs 34-36, which plays land-light in
  // practice, so treat 36 as the floor and allow up to 42.
  const requestedLandCount = Math.max(36, Math.min(42, Math.round(Number(edhrecTypeAverages?.Land) || targetLandCount)));
  const targetNonlandCount = deckSize - requestedLandCount;

  const defaults = {
    Creature: strategyProfile.wantsCreatures
      ? (strategyProfile.wantsTribal || strategyProfile.wantsGoWide ? 26 : 20)
      : 15,
    Instant: strategyProfile.wantsCantrips ? 10 : 7,
    Sorcery: strategyProfile.wantsCantrips ? 11 : 8,
    Artifact: themeSignals?.has?.("artifacts") ? 11 : 7,
    Enchantment: themeSignals?.has?.("enchantments") ? 10 : 5,
    Planeswalker: 1
  };

  const buckets = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker"];
  const raw = Object.fromEntries(
    buckets.map((bucket) => {
      const value = Number(edhrecTypeAverages?.[bucket]);
      return [bucket, Number.isFinite(value) && value >= 0 ? value : defaults[bucket]];
    })
  );

  let totalRaw = buckets.reduce((sum, bucket) => sum + (raw[bucket] || 0), 0);
  if (totalRaw <= 0) totalRaw = buckets.reduce((sum, bucket) => sum + defaults[bucket], 0);

  const scaled = {};
  let assigned = 0;
  for (const bucket of buckets) {
    const exact = ((raw[bucket] || defaults[bucket]) / totalRaw) * targetNonlandCount;
    scaled[bucket] = Math.max(bucket === "Planeswalker" ? 0 : 1, Math.round(exact));
    assigned += scaled[bucket];
  }

  const preferenceOrder = ["Creature", "Artifact", "Enchantment", "Instant", "Sorcery", "Planeswalker"];
  while (assigned < targetNonlandCount) {
    for (const bucket of preferenceOrder) {
      scaled[bucket] += 1;
      assigned += 1;
      if (assigned >= targetNonlandCount) break;
    }
  }
  while (assigned > targetNonlandCount) {
    for (const bucket of ["Planeswalker", "Sorcery", "Instant", "Enchantment", "Artifact", "Creature"]) {
      const minimumFloor = bucket === "Creature"
        ? 8
        : bucket === "Planeswalker" ? 0 : 1;
      if (scaled[bucket] > minimumFloor) {
        scaled[bucket] -= 1;
        assigned -= 1;
      }
      if (assigned <= targetNonlandCount) break;
    }
  }

  const providedCreature = Number(edhrecTypeAverages?.Creature);
  const providedNonlandTotal = buckets.reduce((sum, bucket) => {
    const value = Number(edhrecTypeAverages?.[bucket]);
    return sum + (Number.isFinite(value) && value >= 0 ? value : 0);
  }, 0);

  const desiredCreatureTargetFromEdhrec =
    Number.isFinite(providedCreature) && providedCreature > 0
      ? Math.round(
        providedNonlandTotal > 0
          ? (providedCreature / providedNonlandTotal) * targetNonlandCount
          : providedCreature
      )
      : null;

  if (desiredCreatureTargetFromEdhrec && scaled.Creature < desiredCreatureTargetFromEdhrec) {
    const boost = desiredCreatureTargetFromEdhrec - scaled.Creature;
    scaled.Creature += boost;
    assigned += boost;
  }

  while (assigned > targetNonlandCount) {
    for (const bucket of ["Planeswalker", "Sorcery", "Instant", "Enchantment", "Artifact"]) {
      const minimumFloor = bucket === "Planeswalker" ? 0 : 1;
      if (scaled[bucket] > minimumFloor) {
        scaled[bucket] -= 1;
        assigned -= 1;
      }
      if (assigned <= targetNonlandCount) break;
    }
    if (assigned > targetNonlandCount && scaled.Creature > 8) {
      scaled.Creature -= 1;
      assigned -= 1;
    }
  }

  const plan = {};
  for (const bucket of buckets) {
    const target = scaled[bucket];
    const flex = 2;
    const minimumFloor = bucket === "Creature"
      ? 8
      : bucket === "Planeswalker" ? 0 : 1;
    plan[bucket] = {
      target,
      min: Math.max(minimumFloor, target - flex),
      max: Math.max(target, target + flex)
    };
  }

  return {
    landCount: requestedLandCount,
    nonlandCount: targetNonlandCount,
    buckets: plan
  };
}

// Mana-value planning.
//
// The type plan alone can't shape a curve: the pickers walk a score-sorted
// pool and take the first card of the right type, so whichever mana value
// scores highest gets drafted until the collection runs out of it. On a bulk
// collection that means every slot goes to one or two mana values. Curve
// bands work like the type buckets above -- each band gets a slot quota, and
// a card is only picked while its band still has room.

// Bands are 1 (zero and one drops), 2..6, and 7 (everything seven and up).
function getCmcBand(cmc) {
  const value = Number(cmc) || 0;
  if (value <= 1) return 1;
  if (value >= 7) return 7;
  return Math.round(value);
}

// Shares of the nonland slots per band. EDHREC's endpoints don't report a
// curve, so these are fixed: a normal descending Commander curve that still
// leaves room for a real top end.
const DEFAULT_CURVE_SHARES = { 1: 0.08, 2: 0.20, 3: 0.22, 4: 0.18, 5: 0.13, 6: 0.10, 7: 0.09 };

function buildCurvePlan(nonlandCount, shares = DEFAULT_CURVE_SHARES) {
  const caps = {};
  for (const band of Object.keys(shares)) {
    caps[band] = Math.max(1, Math.round(shares[band] * nonlandCount));
  }
  return { caps, counts: {} };
}

function curveHasRoom(curvePlan, cmc) {
  if (!curvePlan) return true;
  const band = getCmcBand(cmc);
  return (curvePlan.counts[band] || 0) < (curvePlan.caps[band] || 0);
}

function recordCurvePick(curvePlan, cmc) {
  if (!curvePlan) return;
  const band = getCmcBand(cmc);
  curvePlan.counts[band] = (curvePlan.counts[band] || 0) + 1;
}

function releaseCurvePick(curvePlan, cmc) {
  if (!curvePlan) return;
  const band = getCmcBand(cmc);
  curvePlan.counts[band] = Math.max(0, (curvePlan.counts[band] || 0) - 1);
}

// No current caller; kept alongside the rest of the plan predicates.
function canAddCardForTypePlan(card, deck, typePlan, strict = true) {
  const planBuckets = typePlan?.buckets || typePlan || {};
  const bucket = getDeckTypeBucket(card.type || card.type_line || "");
  if (!planBuckets[bucket]) return true;
  const counts = countByType(deck);
  const limit = strict ? planBuckets[bucket].max : planBuckets[bucket].max + 2;
  return counts[bucket] < limit;
}

function getCardsNeededForTypeMinimums(deck, typePlan) {
  const planBuckets = typePlan?.buckets || typePlan || {};
  const counts = countByType(deck);
  const needed = [];
  for (const [bucket, rule] of Object.entries(planBuckets)) {
    const deficit = Math.max(0, (rule?.min || 0) - (counts[bucket] || 0));
    for (let i = 0; i < deficit; i++) needed.push(bucket);
  }
  return needed;
}

function getTypePlanBucketNeed(deck, typePlan, bucket) {
  const planBuckets = typePlan?.buckets || typePlan || {};
  const counts = countByType(deck);
  const rule = planBuckets[bucket];
  if (!rule) return 0;
  return Math.max(0, (rule.target || 0) - (counts[bucket] || 0));
}

function getRoleCounts(deck) {
  return {
    ramp: deck.filter((card) => card.role === "ramp").length,
    draw: deck.filter((card) => card.role === "draw").length,
    removal: deck.filter((card) => card.role === "removal").length,
    wipe: deck.filter((card) => card.role === "wipe").length
  };
}

// excludedKeys holds every commander's normalized name (a deck may have two),
// so a commander is never also drafted into its own deck.
function pickBestCardForBucket(pool, usedNames, excludedKeys, bucket, curvePlan = null) {
  let bestIgnoringCurve = null;

  for (const card of pool) {
    const key = normalizeCardName(card.name);
    if (usedNames.has(key) || excludedKeys.has(key)) continue;
    if (getDeckTypeBucket(card.type || card.type_line || "") !== bucket) continue;

    // The pool is score-sorted, so the first card whose band still has room is
    // the best card we can take without distorting the curve.
    if (curveHasRoom(curvePlan, card.cmc)) return card;
    if (!bestIgnoringCurve) bestIgnoringCurve = card;
  }

  // Every band this bucket can still reach is full -- take the best remaining
  // card rather than leaving the slot empty.
  return bestIgnoringCurve;
}

function chooseBestFlexibleCard(pool, deck, typePlan, roleTargets, usedNames, excludedKeys) {
  const counts = countByType(deck);
  const roleCounts = getRoleCounts(deck);
  const planBuckets = typePlan?.buckets || typePlan || {};

  let best = null;
  let bestScore = -Infinity;

  for (const card of pool) {
    const key = normalizeCardName(card.name);
    if (usedNames.has(key) || excludedKeys.has(key)) continue;

    const bucket = getDeckTypeBucket(card.type || card.type_line || "");
    const rule = planBuckets[bucket];
    const bucketCount = counts[bucket] || 0;
    if (rule && bucketCount >= rule.max + 2) continue;

    let adjustedScore = Number(card.score || 0);

    if (rule) {
      const target = Number(rule.target || 0);
      const deficit = Math.max(0, target - bucketCount);
      const overflow = Math.max(0, bucketCount - target);
      adjustedScore += deficit * 30;
      adjustedScore -= overflow * 18;
      if (bucketCount < (rule.min || 0)) adjustedScore += 35;
      if (bucketCount >= (rule.max || 999)) adjustedScore -= 28;
    }

    if (roleTargets && roleTargets[card.role]) {
      const roleDeficit = Math.max(0, Number(roleTargets[card.role]) - Number(roleCounts[card.role] || 0));
      adjustedScore += roleDeficit * 12;
    }

    if (bucket === "Creature") adjustedScore += 4;

    if (adjustedScore > bestScore) {
      best = card;
      bestScore = adjustedScore;
    }
  }

  return best;
}
