// buildDeckFromScoredPool fixture: a green commander with one owned card per
// support role (ramp/draw/removal/wipe) plus a handful of "vanilla" nonland
// cards that carry no support role at all. No EDHREC pool (scoredNonlands is
// empty) -- every pick has to come from the collection fallback built inside
// buildDeckFromScoredPool itself, so the fixture only needs collectionData +
// allOwnedCardData, not the EDHREC response shapes.
function makeCard(name, type, text, cmc, colors, rarity) {
  return { name, type, text, cmc, colors, manaCost: "", rawType: type, rawText: text, rarity: rarity || "common" };
}

const TEST_COMMANDER_NAME = "Test Grove Warden";

const TEST_RAMP_CARD = makeCard("Test Mana Rock", "artifact", "{t}: add {g}.", 2, []);
const TEST_DRAW_CARD = makeCard("Test Draw Spell", "sorcery", "draw a card.", 2, ["G"]);
const TEST_REMOVAL_CARD = makeCard("Test Removal Spell", "sorcery", "destroy target creature.", 3, ["G"]);
const TEST_WIPE_CARD = makeCard("Test Board Wipe", "sorcery", "destroy all creatures.", 4, ["G"]);

const TEST_FILLER_CARDS = [
  makeCard("Test Vanilla Bear", "creature — bear", "", 2, ["G"]),
  makeCard("Test Vanilla Elk", "creature — elk", "", 3, ["G"]),
  makeCard("Test Vanilla Wolf", "creature — wolf", "", 4, ["G"]),
  makeCard("Test Vanilla Ox", "creature — ox", "", 5, ["G"]),
  makeCard("Test Vanilla Instant", "instant", "target creature gets +2/+2 until end of turn.", 1, ["G"]),
  makeCard("Test Vanilla Sorcery", "sorcery", "you gain 4 life.", 2, ["G"]),
  makeCard("Test Vanilla Enchantment", "enchantment", "", 3, ["G"]),
  makeCard("Test Vanilla Artifact", "artifact", "", 2, [])
];

const TEST_RARE_BOMB_CARD = makeCard("Test Rare Bomb", "creature — dragon", "destroy target creature. draw a card.", 5, ["G"], "rare");

function buildFixture(minimalBuild) {
  const commanderCard = makeCard(TEST_COMMANDER_NAME, "legendary creature — treefolk", "", 4, ["G"]);
  const ownedCards = [TEST_RAMP_CARD, TEST_DRAW_CARD, TEST_REMOVAL_CARD, TEST_WIPE_CARD, ...TEST_FILLER_CARDS];

  const allOwnedCardData = new Map();
  allOwnedCardData.set(normalizeCardName(commanderCard.name), commanderCard);
  for (const card of ownedCards) allOwnedCardData.set(normalizeCardName(card.name), card);

  const entries = ownedCards.map((card) => ({
    normalizedName: normalizeCardName(card.name),
    rawName: card.name,
    quantity: 1
  }));
  const collectionData = { entries };

  const commanderThemes = [];
  const strategyProfile = getCommanderStrategyProfile(TEST_COMMANDER_NAME, commanderThemes, ["G"]);
  const modePrefs = getModePreferences(minimalBuild ? "minimal" : "", strategyProfile);
  const roleTargets = { ramp: 1, draw: 1, removal: 1, wipe: 1 };

  return buildDeckFromScoredPool(
    [],
    ["G"],
    collectionData,
    allOwnedCardData,
    commanderThemes,
    TEST_COMMANDER_NAME,
    modePrefs,
    null,
    roleTargets,
    [],
    { deckSize: 99, themeCardNames: new Map() }
  );
}

function buildPauperFixture() {
  const commanderCard = makeCard(TEST_COMMANDER_NAME, "creature — treefolk", "", 4, ["G"], "uncommon");
  const ownedCards = [TEST_RAMP_CARD, TEST_DRAW_CARD, TEST_WIPE_CARD, TEST_RARE_BOMB_CARD, ...TEST_FILLER_CARDS];

  const allOwnedCardData = new Map();
  allOwnedCardData.set(normalizeCardName(commanderCard.name), commanderCard);
  for (const card of ownedCards) allOwnedCardData.set(normalizeCardName(card.name), card);

  const entries = ownedCards.map((card) => ({
    normalizedName: normalizeCardName(card.name),
    rawName: card.name,
    quantity: 1
  }));
  const collectionData = { entries };

  const commanderThemes = [];
  const strategyProfile = getCommanderStrategyProfile(TEST_COMMANDER_NAME, commanderThemes, ["G"]);
  const modePrefs = getModePreferences("minimal", strategyProfile);
  // removal's only owned candidate (TEST_RARE_BOMB_CARD) is rare, not common --
  // the pauper-format pool must exhaust rather than draft it.
  const roleTargets = { ramp: 1, draw: 1, removal: 1, wipe: 1 };

  setActiveFormat("pauperCommander");
  try {
    return buildDeckFromScoredPool(
      [],
      ["G"],
      collectionData,
      allOwnedCardData,
      commanderThemes,
      TEST_COMMANDER_NAME,
      modePrefs,
      null,
      roleTargets,
      [],
      { deckSize: 99, themeCardNames: new Map() }
    );
  } finally {
    setActiveFormat("commander");
  }
}

// Phase 0 (the role-filling pass) is supposed to respect buildCurvePlan's
// per-band caps, same as Phases 1-4 do via curveHasRoom -- a card over its
// band's cap only gets picked when nothing in-budget can fill the role. This
// fixture starves band 3 (three CMC-3 ramp candidates, cap room for only two)
// while a CMC-1 ramp candidate with plenty of band room sits far behind them
// on raw score, so a flat score penalty for being over-cap is never enough
// to prefer it once the gap exceeds that penalty -- exactly how EDHREC-pool
// cards (scored via scoreCard/scoreFallbackCard's curve + role + popularity
// terms, which routinely swing 20+ points) can out-score an in-budget
// alternative by far more than deck.js's flat -8.
const TEST_BAND3_DORK_ONE = makeCard("Test Band3 Dork One", "creature — bear", "{t}: add {g}.", 3, ["G"]);
const TEST_BAND3_DORK_TWO = makeCard("Test Band3 Dork Two", "creature — elk", "{t}: add {g}.", 3, ["G"]);
const TEST_BAND3_DORK_THREE = makeCard("Test Band3 Dork Three", "creature — wolf", "{t}: add {g}.", 3, ["G"]);
const TEST_BAND1_ROCK = makeCard("Test Band1 Rock", "artifact", "{t}: add {g}.", 1, []);

function buildCurveCapFixture() {
  const commanderCard = makeCard(TEST_COMMANDER_NAME, "legendary creature — treefolk", "", 4, ["G"]);
  const ramp = [TEST_BAND3_DORK_ONE, TEST_BAND3_DORK_TWO, TEST_BAND3_DORK_THREE, TEST_BAND1_ROCK];

  const allOwnedCardData = new Map();
  allOwnedCardData.set(normalizeCardName(commanderCard.name), commanderCard);
  for (const card of ramp) allOwnedCardData.set(normalizeCardName(card.name), card);

  // No collection entries -- every candidate rides in via the EDHREC-style
  // scoredNonlands pool below (with an explicit score, bypassing the
  // generic-fallback-tier scoring and its redundancy penalty) so the only
  // thing deciding between candidates is the curve cap itself.
  const collectionData = { entries: [] };
  const commanderThemes = [];
  const strategyProfile = getCommanderStrategyProfile(TEST_COMMANDER_NAME, commanderThemes, ["G"]);
  const modePrefs = getModePreferences("minimal", strategyProfile);
  const roleTargets = { ramp: 3, draw: 0, removal: 0, wipe: 0 };

  const scoredNonlands = ramp.map((card) => ({
    name: card.name,
    score: card.cmc === 3 ? 20 : 10,
    type: card.type,
    cmc: card.cmc,
    colors: card.colors
  }));

  return buildDeckFromScoredPool(
    scoredNonlands,
    ["G"],
    collectionData,
    allOwnedCardData,
    commanderThemes,
    TEST_COMMANDER_NAME,
    modePrefs,
    null,
    roleTargets,
    [],
    { deckSize: 47, themeCardNames: new Map() }
  );
}

runSuite("deck", {
  "buildDeckFromScoredPool: role-filling phase respects the curve plan's per-band cap": function () {
    const finalDeck = buildCurveCapFixture();
    const band3Count = finalDeck.filter((c) => c.cmc === 3).length;
    const names = finalDeck.map((c) => c.name);

    assertTrue(
      band3Count <= 2,
      "expected at most 2 CMC-3 cards (the band's cap), got " + band3Count + ": " + JSON.stringify(names)
    );
    assertTrue(
      names.includes(TEST_BAND1_ROCK.name),
      "expected the in-budget CMC-1 alternative to be drafted once band 3 was full, got " + JSON.stringify(names)
    );
  },
  "buildDeckFromScoredPool: minimal build includes only the support package, no filler": function () {
    const finalDeck = buildFixture(true);
    const nonlands = finalDeck.filter((c) => c.role !== "land");
    const nonlandNames = nonlands.map((c) => c.name).sort();

    assertEqual(
      nonlandNames,
      [TEST_DRAW_CARD.name, TEST_REMOVAL_CARD.name, TEST_RAMP_CARD.name, TEST_WIPE_CARD.name].sort()
    );
  },

  "buildDeckFromScoredPool: minimal build stops well short of deckSize": function () {
    const finalDeck = buildFixture(true);
    assertTrue(finalDeck.length < 60, "expected a short list, got " + finalDeck.length + " cards");
  },

  "buildDeckFromScoredPool: default build still backfills with non-support filler": function () {
    const finalDeck = buildFixture(false);
    const nonlandNames = new Set(finalDeck.filter((c) => c.role !== "land").map((c) => c.name));
    const hasFiller = TEST_FILLER_CARDS.some((card) => nonlandNames.has(card.name));

    assertTrue(hasFiller, "expected default build to still draft filler cards");
  },

  "buildDeckFromScoredPool: default build pads all the way to deckSize": function () {
    const finalDeck = buildFixture(false);
    assertEqual(finalDeck.length, 99);
  },

  "buildDeckFromScoredPool: pauper format never drafts a non-common card": function () {
    const finalDeck = buildPauperFixture();
    const nonCommons = finalDeck.filter((c) => c.role !== "land" && c.name === TEST_RARE_BOMB_CARD.name);
    assertEqual(nonCommons.length, 0);
  },

  "buildDeckFromScoredPool: pauper format exhausts gracefully when the only candidate for a role is non-common": function () {
    const finalDeck = buildPauperFixture();
    const hasRemoval = finalDeck.some((c) => (c.roles || []).includes("removal"));
    assertTrue(!hasRemoval, "expected no removal card -- the only owned removal candidate is rare, not common");
  }
});
