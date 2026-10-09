// Type-mix planning.
//
// buildRoleTargetPlan turns role targets (ramp/draw/removal/wipe) into the
// hard constraint the deck is built against, with type buckets (Creature/
// Instant/etc.) as a soft diversity floor layered on top. See the design doc
// for why this flips today's priority.
//
// Depends on: deck-stats.js, text.js, themes.js

// deckSize is the number of cards besides the commanders: 99 for a single
// commander, 98 when a partner or Background takes the second slot.
//
// Role targets (ramp/draw/removal/wipe, plus a synergy catch-all) are now the
// hard constraint the deck is built against; type buckets (Creature/Instant/
// etc.) are a soft diversity floor layered on top, not a competing quota. See
// the design doc for why this flips today's priority.
function buildRoleTargetPlan(edhrecTypeAverages, strategyProfile, targetLandCount, roleTargets, commanderThemes = [], deckSize = 99, modePrefs = {}) {
  const themeSignals = buildThemeSignalSet(commanderThemes);
  // targetLandCount is already the final, sanity-bounded number the caller
  // computed (deck.js blends the pip estimate with EDHREC's average itself
  // now, see manabase.js's resolveLandCount) -- trust it rather than
  // re-deriving it here from edhrecTypeAverages.Land, which would silently
  // reintroduce EDHREC-overrides-everything behavior.
  const requestedLandCount = Math.round(targetLandCount);
  const targetNonlandCount = deckSize - requestedLandCount;

  const wantsVoltron = themeSignals.has("voltron") || modePrefs?.focusedThemeSignal === "voltron";

  // Archetype creature counts per Draftsim's "How Many Creatures in a
  // Commander Deck" guide: Typal 30+, Aggro/go-wide 30+, Voltron 20-30,
  // Spellslinger <=25 (its own real-deck example runs 14), Control/generic
  // 20-30, everything else (combo, low-creature) 15-30.
  const defaults = {
    Creature: strategyProfile.wantsTribal
      ? 31
      : strategyProfile.wantsGoWide
      ? 30
      : wantsVoltron
      ? 24
      : strategyProfile.wantsCantrips
      ? 15
      : strategyProfile.wantsCreatures
      ? 22
      : 18,
    Instant: strategyProfile.wantsCantrips ? 10 : 7,
    Sorcery: strategyProfile.wantsCantrips ? 11 : 8,
    Artifact: themeSignals?.has?.("artifacts") || modePrefs?.focusedThemeSignal === "artifacts" || wantsVoltron ? 11 : 7,
    Enchantment: themeSignals?.has?.("enchantments") || modePrefs?.focusedThemeSignal === "enchantments" || wantsVoltron ? 10 : 5,
    Planeswalker: 1
  };

  const typeKeys = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker"];
  const raw = Object.fromEntries(
    typeKeys.map((bucket) => {
      const value = Number(edhrecTypeAverages?.[bucket]);
      return [bucket, Number.isFinite(value) && value >= 0 ? value : defaults[bucket]];
    })
  );

  let totalRaw = typeKeys.reduce((sum, bucket) => sum + (raw[bucket] || 0), 0);
  if (totalRaw <= 0) totalRaw = typeKeys.reduce((sum, bucket) => sum + defaults[bucket], 0);

  // Scaled purely to inform the soft target/min below -- type buckets no
  // longer have to sum to targetNonlandCount, since role buckets do that job.
  const typeBuckets = {};
  for (const bucket of typeKeys) {
    const exact = ((raw[bucket] || defaults[bucket]) / totalRaw) * targetNonlandCount;
    const target = Math.max(bucket === "Planeswalker" ? 0 : 1, Math.round(exact));
    const minimumFloor = bucket === "Creature" ? 15 : bucket === "Planeswalker" ? 0 : 1;
    typeBuckets[bucket] = { target: Math.max(target, minimumFloor), min: minimumFloor };
  }

  const roleKeys = ["ramp", "draw", "removal", "wipe"];
  const roleBuckets = {};
  let roleTotal = 0;
  for (const role of roleKeys) {
    const target = Math.max(0, Math.round(Number(roleTargets?.[role]) || 0));
    roleBuckets[role] = { target, min: Math.max(0, target - 2), max: target + 2 };
    roleTotal += target;
  }

  const synergyTarget = Math.max(0, targetNonlandCount - roleTotal);
  roleBuckets.synergy = {
    target: synergyTarget,
    min: Math.max(0, synergyTarget - 3),
    max: synergyTarget + 3
  };

  // Rounding fixup: if role targets (unusual EDHREC data) overshoot
  // targetNonlandCount, trim synergy first since it's the most elastic
  // bucket, down to its own floor of 0.
  let assignedTotal = roleTotal + roleBuckets.synergy.target;
  if (assignedTotal > targetNonlandCount) {
    const overflow = assignedTotal - targetNonlandCount;
    const trim = Math.min(overflow, roleBuckets.synergy.target);
    roleBuckets.synergy.target -= trim;
    roleBuckets.synergy.min = Math.max(0, roleBuckets.synergy.target - 3);
    roleBuckets.synergy.max = roleBuckets.synergy.target + 3;
  }

  return {
    landCount: requestedLandCount,
    nonlandCount: targetNonlandCount,
    roleBuckets,
    typeBuckets
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

// Curve shares, nudged by how ramp-heavy the plan is and whether the
// strategy wants a low, wide curve. Bounded (+/-0.02 to +/-0.05 of total
// share) so this stays a nudge, not a new curve model.
function adjustCurveShares(shares, roleTargets, strategyProfile) {
  const rampTarget = Number(roleTargets?.ramp) || 10;
  const rampShift = Math.max(-0.02, Math.min(0.05, (rampTarget - 10) * 0.01));
  const lowCurveFlag = Boolean(
    strategyProfile?.wantsGoWide || strategyProfile?.wantsTribal || strategyProfile?.wantsCantrips
  );
  const curveShift = rampShift - (lowCurveFlag ? 0.02 : 0);

  const lowBands = ["1", "2"];
  const highBands = ["5", "6", "7"];
  const adjusted = { ...shares };

  if (curveShift === 0) return adjusted;

  // Positive curveShift: move weight from low bands into high bands.
  // Negative: the reverse. Each side's shift is split proportionally to its
  // members' existing share of that side's total.
  const fromBands = curveShift > 0 ? lowBands : highBands;
  const toBands = curveShift > 0 ? highBands : lowBands;
  const magnitude = Math.abs(curveShift);

  const fromTotal = fromBands.reduce((sum, band) => sum + shares[band], 0);
  const toTotal = toBands.reduce((sum, band) => sum + shares[band], 0);

  for (const band of fromBands) {
    const share = fromTotal > 0 ? shares[band] / fromTotal : 1 / fromBands.length;
    adjusted[band] = Math.max(0, shares[band] - magnitude * share);
  }
  for (const band of toBands) {
    const share = toTotal > 0 ? shares[band] / toTotal : 1 / toBands.length;
    adjusted[band] = shares[band] + magnitude * share;
  }

  return adjusted;
}

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

function getCardsNeededForTypeMinimums(deck, typeBuckets) {
  const counts = countByType(deck);
  const needed = [];
  for (const [bucket, rule] of Object.entries(typeBuckets || {})) {
    const deficit = Math.max(0, (rule?.min || 0) - (counts[bucket] || 0));
    for (let i = 0; i < deficit; i++) needed.push(bucket);
  }
  return needed;
}

function getRoleCounts(deck) {
  return {
    ramp: deck.filter((card) => card.role === "ramp").length,
    draw: deck.filter((card) => card.role === "draw").length,
    removal: deck.filter((card) => card.role === "removal").length,
    wipe: deck.filter((card) => card.role === "wipe").length,
    synergy: deck.filter((card) => card.role === "synergy").length
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

// Phase 2 fills most of a full build's remaining nonland slots, but unlike
// Phase 0's pickBestForRole and Phase 1's pickBestCardForBucket, it never
// consulted the curve plan at all -- a card's role/type deficit terms (worth
// up to ~65 points) made a band's cap irrelevant here however full that band
// already was. curvePlan is optional (callers that don't care about the
// curve, like this file's own unit tests, can omit it) and, same as the
// other two pickers, being over a band's cap never excludes a card outright
// -- bestIgnoringCurve stays available if nothing in-budget fits.
function chooseBestFlexibleCard(pool, deck, plan, usedNames, excludedKeys, curvePlan = null) {
  const typeCounts = countByType(deck);
  const roleCounts = getRoleCounts(deck);
  const roleBuckets = plan?.roleBuckets || {};
  const typeBuckets = plan?.typeBuckets || {};

  let best = null;
  let bestScore = -Infinity;
  let bestIgnoringCurve = null;
  let bestIgnoringCurveScore = -Infinity;

  for (const card of pool) {
    const key = normalizeCardName(card.name);
    if (usedNames.has(key) || excludedKeys.has(key)) continue;

    const roleRule = roleBuckets[card.role];
    const roleCount = roleCounts[card.role] || 0;
    if (roleRule && roleCount >= roleRule.max + 2) continue;

    let adjustedScore = Number(card.score || 0);

    // Role deficit is the dominant term now -- this is the hard constraint.
    if (roleRule) {
      const target = Number(roleRule.target || 0);
      const deficit = Math.max(0, target - roleCount);
      const overflow = Math.max(0, roleCount - target);
      adjustedScore += deficit * 30;
      adjustedScore -= overflow * 18;
      if (roleCount < (roleRule.min || 0)) adjustedScore += 35;
      if (roleCount >= (roleRule.max || 999)) adjustedScore -= 28;
    }

    // Type deficit is a minor tiebreaker -- soft diversity, not a gate.
    const bucket = getDeckTypeBucket(card.type || card.type_line || "");
    const typeRule = typeBuckets[bucket];
    if (typeRule) {
      const typeDeficit = Math.max(0, Number(typeRule.target || 0) - (typeCounts[bucket] || 0));
      adjustedScore += typeDeficit * 8;
    }

    if (bucket === "Creature") adjustedScore += 4;

    if (adjustedScore > bestIgnoringCurveScore) {
      bestIgnoringCurve = card;
      bestIgnoringCurveScore = adjustedScore;
    }

    if (!curveHasRoom(curvePlan, card.cmc)) continue;

    if (adjustedScore > bestScore) {
      best = card;
      bestScore = adjustedScore;
    }
  }

  return best || bestIgnoringCurve;
}
