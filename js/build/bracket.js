// Power-level estimation and structural warnings.
//
// The bracket score weights fast mana, tutors, extra turns, mass land denial
// and compact combos far above the support-package counts, then floors the
// bracket whenever Game Changers are present.
//
// Depends on: cards.js, text.js, themes.js

function getBracketLabel(bracket) {
  const labels = {
    1: "Bracket 1 — Exhibition",
    2: "Bracket 2 — Core",
    3: "Bracket 3 — Upgraded",
    4: "Bracket 4 — Optimized",
    5: "Bracket 5 — cEDH"
  };
  return labels[bracket] || "Unknown";
}

// commanderNames accepts a single name or, for a partnered deck, both.
function detectGameChangers(deck, commanderNames) {
  const detected = [];
  const seen = new Set();

  const leaders = Array.isArray(commanderNames) ? commanderNames : [commanderNames];
  const allNames = [...leaders.filter(Boolean), ...deck.map((c) => c.name)];
  for (const name of allNames) {
    const normalized = normalizeCardName(name);
    if (isGameChanger(name) && !seen.has(normalized)) {
      detected.push(name);
      seen.add(normalized);
    }
  }

  return detected.sort((a, b) => a.localeCompare(b));
}

function estimateDeckBracket(deck, commanderThemes, commanderColors, commanderNames) {
  const names = deck.map((c) => normalizeCardName(c.name));
  const nonlands = deck.filter((c) => c.role !== "land");
  const lands = deck.filter((c) => c.role === "land");
  const creatures = nonlands.filter((c) => getCardType(c).includes("creature")).length;

  const rampCount = nonlands.filter((c) => c.role === "ramp").length;
  const drawCount = nonlands.filter((c) => c.role === "draw").length;
  const removalCount = nonlands.filter((c) => c.role === "removal").length;
  const wipeCount = nonlands.filter((c) => c.role === "wipe").length;

  const avgCmc =
    nonlands.length > 0
      ? nonlands.reduce((sum, c) => sum + (c.cmc || 0), 0) / nonlands.length
      : 0;

  const fastManaCards = [
    "sol ring", "mana crypt", "chrome mox", "mox diamond", "jeweled lotus", "mana vault", "grim monolith", "lotus petal"
  ];

  const tutorCards = [
    "demonic tutor", "vampiric tutor", "imperial seal", "worldly tutor", "enlightened tutor",
    "mystical tutor", "gamble", "diabolic intent", "eladamri's call", "green sun's zenith",
    "finale of devastation", "crop rotation"
  ];

  const extraTurnCards = [
    "time warp", "temporal manipulation", "capture of jingzhou", "nexus of fate", "time stretch", "expropriate"
  ];

  const massLandDenialCards = [
    "armageddon", "ravages of war", "ruination", "winter orb", "blood moon", "magus of the moon", "sunder"
  ];

  const compactComboCards = [
    "thassa's oracle", "underworld breach", "ad nauseam", "protean hulk", "bolas's citadel", "dockside extortionist", "food chain"
  ];

  const fastManaCount = names.filter((n) => fastManaCards.includes(n)).length;
  const tutorCount = names.filter((n) => tutorCards.includes(n)).length;
  const extraTurnCount = names.filter((n) => extraTurnCards.includes(n)).length;
  const massLandDenialCount = names.filter((n) => massLandDenialCards.includes(n)).length;
  const compactComboCount = names.filter((n) => compactComboCards.includes(n)).length;
  const gameChangers = detectGameChangers(deck, commanderNames);
  const gameChangerCount = gameChangers.length;

  let score = 0;
  score += rampCount * 0.25;
  score += drawCount * 0.2;
  score += removalCount * 0.15;
  score += wipeCount * 0.2;

  if (avgCmc <= 2.2) score += 2.5;
  else if (avgCmc <= 2.8) score += 1.5;
  else if (avgCmc <= 3.3) score += 0.5;

  score += fastManaCount * 2.5;
  score += tutorCount * 1.75;
  score += extraTurnCount * 1.5;
  score += massLandDenialCount * 2;
  score += compactComboCount * 2.5;
  score += gameChangerCount * 1.2;

  if (commanderHasTheme(commanderThemes, "tokens")) score += 0.4;
  if (commanderHasTheme(commanderThemes, "sacrifice")) score += 0.4;
  if (commanderHasTheme(commanderThemes, "cantrips")) score += 0.6;
  if (commanderHasTheme(commanderThemes, "counters")) score += 0.3;
  if (getCommanderTribalThemes(commanderThemes).length) score += 0.3;

  if (commanderColors.length >= 3) score += 0.3;
  if (creatures >= 24) score -= 0.3;
  if (lands >= 37) score -= 0.2;

  let bracket = 2;
  if (score < 1.5) bracket = 1;
  else if (score < 4.5) bracket = 2;
  else if (score < 8.5) bracket = 3;
  else if (score < 13) bracket = 4;
  else bracket = 5;

  if (gameChangerCount > 0 && bracket < 3) bracket = 3;
  if (gameChangerCount > 3 && bracket < 4) bracket = 4;

  const reasons = [];
  if (gameChangerCount) reasons.push(`game changers: ${gameChangerCount}`);
  if (fastManaCount) reasons.push(`fast mana: ${fastManaCount}`);
  if (tutorCount) reasons.push(`tutors: ${tutorCount}`);
  if (compactComboCount) reasons.push(`combo pieces: ${compactComboCount}`);
  if (extraTurnCount) reasons.push(`extra turns: ${extraTurnCount}`);
  if (massLandDenialCount) reasons.push(`mass land denial: ${massLandDenialCount}`);
  reasons.push(`avg CMC: ${avgCmc.toFixed(2)}`);
  reasons.push(`ramp/draw/removal/wipes: ${rampCount}/${drawCount}/${removalCount}/${wipeCount}`);

  return {
    bracket,
    label: getBracketLabel(bracket),
    score: Number(score.toFixed(2)),
    reasons,
    gameChangers
  };
}

function generateWarnings(deck, commanderThemes, bracketInfo) {
  const warnings = [];
  const creatures = deck.filter((c) => getCardType(c).includes("creature")).length;
  const ramp = deck.filter((c) => c.role === "ramp").length;
  const draw = deck.filter((c) => c.role === "draw").length;
  const removal = deck.filter((c) => c.role === "removal").length;
  const wipes = deck.filter((c) => c.role === "wipe").length;
  const basics = deck.filter((c) => c.source === "basic-land").length;
  const nonbasics = deck.filter((c) => c.source === "nonbasic-land").length;
  const fallbackCards = deck.filter((c) => c.source === "fallback" || c.source === "fallback-creature").length;
  const nonlandCount = deck.filter((c) => c.role !== "land").length;

  // Backfilling from the collection is what this builder is for, so only flag
  // it once it dominates. Measured as a share, because the nonland total moves
  // with the land count.
  const fallbackShare = fallbackCards / Math.max(nonlandCount, 1);

  if (getCommanderTribalThemes(commanderThemes).length && creatures < 22) {
    warnings.push("Low creature count for a tribal deck.");
  }
  if (commanderHasTheme(commanderThemes, "gowide") && creatures < 20) {
    warnings.push("Go-wide strategy may be light on creatures or token bodies.");
  }
  if (ramp < 8) warnings.push("Ramp count is on the low side.");
  if (draw < 8) warnings.push("Card draw count is on the low side.");
  if (removal < 6) warnings.push("Interaction count may be low.");
  if (wipes < 2 && bracketInfo.bracket >= 3) warnings.push("Only a small number of board wipes found.");
  if (nonbasics > basics * 1.5 && basics < 10) warnings.push("Mana base may still be a bit too greedy on nonbasics.");
  if (fallbackShare >= 0.6) warnings.push("Most of this deck came from collection theme-matching rather than EDHREC overlap — your collection has few of this commander's staples.");
  if (bracketInfo.gameChangers.length >= 4) warnings.push("This build contains several Game Changers and may read stronger than expected at casual tables.");

  return warnings;
}
