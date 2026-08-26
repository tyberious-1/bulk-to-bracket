// Card classification and scoring.
//
// detectRole / detectCardTags read oracle text to decide what a card *does*;
// scoreCard and scoreFallbackCard turn that plus commander themes, EDHREC
// synergy and the active mode preferences into a single sortable number.
//
// Depends on: cards.js, constants.js, text.js, themes.js

function isCreatureCard(card) {
  return getCardType(card).includes("creature");
}

function hasTribalType(card, tribe) {
  const pattern = new RegExp(`\\b${tribe}\\b`);
  return pattern.test(`${getCardType(card)} ${getCardText(card)}`);
}

function isTokenMaker(card) {
  return getCardText(card).includes("create") && getCardText(card).includes("token");
}

function isSacrificeCard(card) {
  return getCardText(card).includes("sacrifice");
}

function isSynergisticMonoColorLand(card, commanderColors, profile) {
  const name = normalizeCardName(card.name);
  const text = getCardText(card);

  if (commanderColors.length !== 1) return true;

  if (name === "path of ancestry" && profile.wantsTribal) return true;
  if (name === "secluded courtyard" && profile.wantsTribal) return true;
  if (name === "unclaimed territory" && profile.wantsTribal) return true;
  if (name === "dwarven mine" && commanderColors[0] === "R") return true;
  if (name === "mines of moria" && profile.wantsTokens) return true;
  if (text.includes("create") && text.includes("token")) return true;
  if (text.includes("sacrifice") || text.includes("whenever a creature dies")) return true;

  return false;
}

function isLowPriorityMonoColorFixer(card, commanderColors) {
  if (commanderColors.length !== 1) return false;

  const name = normalizeCardName(card.name);
  const lowPriorityNames = new Set([
    "command tower",
    "exotic orchard",
    "rupture spire",
    "gateway plaza",
    "transguild promenade",
    "unclaimed territory",
    "secluded courtyard",
    "path of ancestry",
    "thriving bluff",
    "public thoroughfare",
    "vibrant cityscape",
    "tendo ice bridge",
    "uncharted haven",
    "command bridge",
    "crossroads village",
    "capital city",
    "gallifrey council chamber",
    "opal palace",
    "corrupted crossroads",
    "cascading cataracts",
    "secluded starforge"
  ]);

  return lowPriorityNames.has(name);
}

function isLowPriorityMonoColorRock(card, commanderColors, profile) {
  if (commanderColors.length !== 1) return false;
  if (!getCardType(card).includes("artifact")) return false;

  const name = normalizeCardName(card.name);
  if (name === "arcane signet") return true;
  if (name === "commander's sphere") return true;
  if (name === "heraldic banner") return false;
  if (name === "sol ring") return false;
  if (name === "mind stone") return false;
  if (name === "skullclamp") return false;
  if (name === "idol of oblivion" && profile.wantsTokens) return false;

  return false;
}

function isGenericStaple(card) {
  const staples = new Set([
    "sol ring",
    "arcane signet",
    "command tower",
    "swiftfoot boots",
    "skullclamp",
    "swords to plowshares",
    "path to exile",
    "cyclonic rift",
    "rhystic study",
    "smothering tithe",
    "demonic tutor",
    "vampiric tutor",
    "teferi's protection"
  ]);
  return staples.has(normalizeCardName(card.name));
}

function detectRole(card) {
  const text = getCardText(card);
  const type = getCardType(card);

  if (type.includes("land")) return "land";

  if (
    text.includes("add {") ||
    text.includes("create a treasure") ||
    text.includes("create treasure") ||
    text.includes("search your library for a land")
  ) {
    return "ramp";
  }

  if (
    text.includes("draw a card") ||
    text.includes("draw two cards") ||
    text.includes("draw three cards") ||
    text.includes("whenever you draw")
  ) {
    return "draw";
  }

  if (
    text.includes("destroy target") ||
    text.includes("exile target") ||
    text.includes("counter target spell") ||
    text.includes("return target permanent")
  ) {
    return "removal";
  }

  if (
    text.includes("destroy all creatures") ||
    text.includes("exile all creatures") ||
    text.includes("each creature gets")
  ) {
    return "wipe";
  }

  return "synergy";
}

function detectCardTags(card) {
  const tags = [];
  const text = getCardText(card);
  const type = getCardType(card);
  const combined = `${type} ${text}`;

  if (text.includes("graveyard")) tags.push("graveyard");
  if (text.includes("token")) {
    tags.push("tokens");
    tags.push("gowide");
  }
  if (type.includes("artifact")) tags.push("artifacts");
  if (type.includes("enchantment")) tags.push("enchantments");
  if (text.includes("landfall") || text.includes("search your library for a land")) tags.push("lands");
  if (type.includes("instant") || type.includes("sorcery")) tags.push("spellslinger");
  if (text.includes("sacrifice")) tags.push("sacrifice");

  if (text.includes("+1/+1 counter") || text.includes("put a counter on") || text.includes("put counters on")) {
    tags.push("counters");
    tags.push("countersmatter");
  }

  if (text.includes("gain life") || text.includes("life total")) tags.push("lifegain");
  if (text.includes("return target creature card from your graveyard")) tags.push("reanimator");

  if (
    text.includes("each player draws") ||
    text.includes("each opponent draws") ||
    text.includes("target opponent draws") ||
    text.includes("an opponent draws")
  ) {
    tags.push("group hug");
    tags.push("opponent draw");
  }

  if (
    text.includes("draw a card") &&
    (type.includes("instant") || type.includes("sorcery")) &&
    card.cmc <= 2
  ) {
    tags.push("cantrips");
  }

  if (
    text.includes("each player discards") ||
    text.includes("then draws") ||
    text.includes("discard their hand")
  ) {
    tags.push("wheels");
  }

  if (
    text.includes("exile another target") ||
    text.includes("return it to the battlefield")
  ) {
    tags.push("blink");
  }

  for (const tribalType of TRIBAL_TYPES) {
    const pattern = new RegExp(`\\b${tribalType}\\b`);
    if (pattern.test(combined)) tags.push(`${tribalType} tribal`);
  }

  return tags;
}

function getThemeFocusAdjustment(card, tags, modePrefs) {
  if (!modePrefs.themeFocus) return 0;

  const focusAliases = new Set((modePrefs.themeFocusAliases || []).map((alias) => normalizeThemeName(alias)));
  const normalizedTags = tags.map((tag) => normalizeThemeName(tag));
  const matchedFocusedTag = normalizedTags.some((tag) => focusAliases.has(tag));
  let adjustment = matchedFocusedTag ? 18 : -5;

  if (modePrefs.focusedThemeSignal === "artifacts" && getCardType(card).includes("artifact")) adjustment += 8;
  if (modePrefs.focusedThemeSignal === "enchantments" && getCardType(card).includes("enchantment")) adjustment += 8;
  if (["spellslinger", "cantrips"].includes(modePrefs.focusedThemeSignal) && (getCardType(card).includes("instant") || getCardType(card).includes("sorcery"))) adjustment += 9;
  if (["tokens", "gowide"].includes(modePrefs.focusedThemeSignal) && (isTokenMaker(card) || isCreatureCard(card))) adjustment += 9;
  if (["sacrifice", "aristocrats"].includes(modePrefs.focusedThemeSignal) && isSacrificeCard(card)) adjustment += 8;
  if (["counters", "countersmatter"].includes(modePrefs.focusedThemeSignal) && normalizedTags.includes("counters")) adjustment += 8;
  if (["graveyard", "reanimator"].includes(modePrefs.focusedThemeSignal) && (normalizedTags.includes("graveyard") || normalizedTags.includes("reanimator"))) adjustment += 9;

  for (const tribe of modePrefs.focusedTribalTypes || []) {
    if (hasTribalType(card, tribe)) adjustment += 12;
  }

  return adjustment;
}

function edhrecLabelMatchesTheme(label, modePrefs) {
  if (!modePrefs.themeFocus) return true;
  const normalizedLabel = normalizeThemeName(label);
  return (modePrefs.themeFocusAliases || []).some((alias) => normalizedLabel.includes(alias));
}

function getEdhrecReferenceBonus(edhrecCard, modePrefs) {
  if (!edhrecCard) return 0;
  const labels = Array.isArray(edhrecCard.labels) && edhrecCard.labels.length
    ? edhrecCard.labels
    : [edhrecCard.label || ""];
  const normalizedLabels = labels.map((label) => normalizeThemeName(label)).filter(Boolean);
  if (!normalizedLabels.length) return 0;

  let themeMatch = false;
  let averageDeckSection = false;

  for (const label of normalizedLabels) {
    if (!themeMatch && edhrecLabelMatchesTheme(label, modePrefs)) themeMatch = true;

    if (label.includes("average deck") || label.includes("average decks")) {
      averageDeckSection = true;
    }
  }

  let bonus = 0;
  if (modePrefs.themeFocus) bonus += themeMatch ? 12 : -10;
  if (averageDeckSection) bonus += 6;

  return bonus;
}

function cardMatchesThemeFocus(card, modePrefs) {
  if (!modePrefs.themeFocus) return true;

  const tags = detectCardTags(card).map((tag) => normalizeThemeName(tag));
  const aliases = new Set((modePrefs.themeFocusAliases || []).map((alias) => normalizeThemeName(alias)));
  if (tags.some((tag) => aliases.has(tag))) return true;

  for (const tribe of modePrefs.focusedTribalTypes || []) {
    if (hasTribalType(card, tribe)) return true;
  }

  return false;
}

function classifyBackfillModeFit(card, modePrefs) {
  const themeMatch = cardMatchesThemeFocus(card, modePrefs);
  const role = detectRole(card);
  const supportRole = ["ramp", "draw", "removal", "wipe"].includes(role);

  const strict = themeMatch;
  const relaxed = supportRole;
  return {
    strict,
    relaxed,
    tier: strict ? 0 : relaxed ? 1 : 2
  };
}

function scoreCard(card, edhrecCard, commanderThemes, strategyProfile, commanderColors, modePrefs) {
  const synergyScore = Number(edhrecCard.synergy || 0) * 6;
  const popularityScore = Math.min(Number(edhrecCard.decks || 0) / 1200, 18);

  let roleBonus = 0;
  const role = detectRole(card);

  if (role === "ramp") roleBonus = 4;
  else if (role === "draw") roleBonus = 4;
  else if (role === "removal") roleBonus = 4;
  else if (role === "wipe") roleBonus = 3;

  let curveBonus = 0;
  if (card.cmc <= 2) curveBonus = 3;
  else if (card.cmc <= 4) curveBonus = 4;
  else if (card.cmc <= 6) curveBonus = 1;

  const tags = detectCardTags(card);
  const themeSignals = buildThemeSignalSet(commanderThemes);
  let themeBonus = 0;

  for (const tag of tags) {
    if (themeSignals.has(normalizeThemeName(tag))) themeBonus += 5;
  }

  if (strategyProfile.wantsCreatures && isCreatureCard(card)) themeBonus += 5 * modePrefs.creatureBias;
  if (strategyProfile.wantsTokens && isTokenMaker(card)) themeBonus += 7 * modePrefs.synergyBias;
  if (strategyProfile.wantsSacrifice && isSacrificeCard(card)) themeBonus += 6 * modePrefs.synergyBias;
  if (strategyProfile.wantsGoWide && isCreatureCard(card)) themeBonus += 3 * modePrefs.creatureBias;

  if (strategyProfile.wantsTribal) {
    for (const tribe of strategyProfile.tribalTypes) {
      if (hasTribalType(card, tribe)) themeBonus += 10 * modePrefs.tribalBias;
    }
  }

  if (themeSignals.has("group hug") && tags.includes("opponent draw")) themeBonus += 4;
  if (themeSignals.has("counters") && tags.includes("counters")) themeBonus += 4;
  if (themeSignals.has("cantrips") && tags.includes("cantrips")) themeBonus += 3;
  themeBonus += getThemeFocusAdjustment(card, tags, modePrefs);
  themeBonus += getEdhrecReferenceBonus(edhrecCard, modePrefs);

  let penalty = 0;
  if (isLowPriorityMonoColorRock(card, commanderColors, strategyProfile)) penalty += 8;
  if (modePrefs.casualBias > 1 && isGameChanger(card.name)) penalty += 10 * modePrefs.casualBias;
  if (modePrefs.fewerStaplesBias > 1 && isGenericStaple(card)) penalty += 6 * modePrefs.fewerStaplesBias;

  return synergyScore * modePrefs.synergyBias + popularityScore + roleBonus + curveBonus + themeBonus - penalty;
}

function scoreFallbackCard(card, commanderThemes, strategyProfile, commanderColors, modePrefs) {
  let score = 5;

  const role = detectRole(card);
  if (role === "ramp") score += 4;
  else if (role === "draw") score += 4;
  else if (role === "removal") score += 4;
  else if (role === "wipe") score += 3;

  if (card.cmc <= 2) score += 3;
  else if (card.cmc <= 4) score += 4;
  else if (card.cmc <= 6) score += 1;

  const tags = detectCardTags(card);
  const themeSignals = buildThemeSignalSet(commanderThemes);
  for (const tag of tags) {
    if (themeSignals.has(normalizeThemeName(tag))) score += 4 * modePrefs.synergyBias;
  }

  score += getThemeFocusAdjustment(card, tags, modePrefs);

  if (strategyProfile.wantsCreatures && isCreatureCard(card)) score += 6 * modePrefs.creatureBias;
  if (strategyProfile.wantsTokens && isTokenMaker(card)) score += 8 * modePrefs.synergyBias;
  if (strategyProfile.wantsSacrifice && isSacrificeCard(card)) score += 7 * modePrefs.synergyBias;
  if (strategyProfile.wantsGoWide && isCreatureCard(card)) score += 3 * modePrefs.creatureBias;

  if (strategyProfile.wantsTribal) {
    for (const tribe of strategyProfile.tribalTypes) {
      if (hasTribalType(card, tribe)) score += 12 * modePrefs.tribalBias;
    }
  }

  if (isLowPriorityMonoColorRock(card, commanderColors, strategyProfile)) score -= 8;
  if (modePrefs.casualBias > 1 && isGameChanger(card.name)) score -= 10 * modePrefs.casualBias;
  if (modePrefs.fewerStaplesBias > 1 && isGenericStaple(card)) score -= 6 * modePrefs.fewerStaplesBias;

  return score;
}
