// Bracket estimation and structural warnings.
//
// The bracket comes from the criteria the official system names -- Game
// Changers, mass land denial, chained extra turns, two-card combos, heavy
// tutoring -- each acting as a floor on the result. It is not a power score:
// brackets 1 and 2 are defined by what a deck does not do, and summing the
// things a good deck does have cannot express that.
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

  // A Game Changer is counted as a Game Changer and nothing else. Four cards
  // sit on both the official list and one of the lists above -- Vampiric and
  // Worldly Tutor, Thassa's Oracle, Underworld Breach -- and counting them
  // twice overstated the very decks the gates below already catch.
  const gameChangers = detectGameChangers(deck, commanderNames);
  const gameChangerKeys = new Set(gameChangers.map((name) => normalizeCardName(name)));
  const countExcludingGameChangers = (list) =>
    names.filter((n) => list.includes(n) && !gameChangerKeys.has(n)).length;

  const fastManaCount = countExcludingGameChangers(fastManaCards);
  const tutorCount = countExcludingGameChangers(tutorCards);
  const extraTurnCount = countExcludingGameChangers(extraTurnCards);
  const massLandDenialCount = countExcludingGameChangers(massLandDenialCards);
  const compactComboCount = countExcludingGameChangers(compactComboCards);
  const gameChangerCount = gameChangers.length;

  // Brackets are decided by the criteria the official system names, not by a
  // weighted score. Brackets 1 and 2 are defined by what a deck does NOT do,
  // so a sum of desirable-deck qualities can only drift from them: the support
  // package this builder deliberately fills used to contribute 7.45 of a 8.95
  // total, which read every honest Core deck as Optimized.
  const gates = [];
  let bracket = 2;

  function requireAtLeast(minimum, reason) {
    if (bracket < minimum) bracket = minimum;
    gates.push(reason);
  }

  // Nothing below 4 may run mass land denial or chain extra turns, and a
  // two-card infinite combo is allowed at 3 only when it cannot come online
  // early. Nothing in the card data says when a combo assembles, so any pair
  // is treated as the stricter case.
  if (massLandDenialCount > 0) requireAtLeast(4, `mass land denial: ${massLandDenialCount}`);
  if (extraTurnCount >= 2) requireAtLeast(4, `extra turns that can chain: ${extraTurnCount}`);
  if (compactComboCount >= 2) requireAtLeast(4, `two-card combo pieces: ${compactComboCount}`);
  if (gameChangerCount > 3) requireAtLeast(4, `more than three game changers: ${gameChangerCount}`);
  else if (gameChangerCount > 0) requireAtLeast(3, `game changers: ${gameChangerCount}`);

  // Core expects few tutors; past a handful the deck is playing a different
  // game even with no Game Changer in it. Most of the named tutors are
  // themselves Game Changers and were counted above, so in practice this fires
  // only for the handful that are not -- Diabolic Intent, Eladamri's Call,
  // Green Sun's Zenith, Finale of Devastation.
  if (tutorCount >= 3) requireAtLeast(3, `heavy tutoring: ${tutorCount}`);

  // Exhibition is a deliberate choice rather than an accident, so it takes a
  // deck with no acceleration, no selection, no combo, and a curve saying that
  // winning is not the point.
  const powerCardCount =
    fastManaCount + tutorCount + extraTurnCount +
    massLandDenialCount + compactComboCount + gameChangerCount;

  if (powerCardCount === 0 && avgCmc > 3.2 && removalCount + wipeCount < 6) {
    bracket = 1;
    gates.push("no accelerants, tutors or combos, and a slow curve");
  }

  // Bracket 5 is never assigned here: cEDH is a statement about the table a
  // deck is built for, and no card list settles it.

  // Kept for the build log and for ordering two decks that land in the same
  // bracket. It decides nothing, and it ignores the support package.
  const score = Number((
    fastManaCount * 1.5 +
    tutorCount * 1.25 +
    extraTurnCount * 1.5 +
    massLandDenialCount * 2 +
    compactComboCount * 2 +
    gameChangerCount * 2
  ).toFixed(2));

  const reasons = [];
  if (gates.length) reasons.push(...gates);
  else reasons.push("no game changers, mass land denial, extra-turn chain or two-card combo");
  if (fastManaCount) reasons.push(`fast mana: ${fastManaCount}`);
  if (extraTurnCount === 1) reasons.push("one extra-turn spell, which cannot chain");
  if (compactComboCount === 1) reasons.push("one combo piece, no pair");
  reasons.push(`avg CMC: ${avgCmc.toFixed(2)}`);
  reasons.push(`ramp/draw/removal/wipes: ${rampCount}/${drawCount}/${removalCount}/${wipeCount}`);

  return {
    bracket,
    label: getBracketLabel(bracket),
    score,
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
