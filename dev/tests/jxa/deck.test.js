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

// pickCheapThemeSeeds fixtures: theme-match candidates carry no support role,
// so they're invisible to Phase 0 (js/build/deck.js's role-filling loop) no
// matter their CMC -- only this helper, called before Phase 0 runs, ever
// gives them a shot at the cheap bands Phase 0 would otherwise claim whole
// for generic ramp/draw/removal. Candidates are plain { name, score, cmc }
// shapes, same as the themeFallbackPool entries the real pipeline passes in
// (already sorted best-score-first, which pickCheapThemeSeeds relies on
// rather than re-sorting itself).
const TEST_SEED_THEME_CMC1_A = makeCard("Test Seed Theme Alpha", "creature — bear", "", 1, ["G"]);
const TEST_SEED_THEME_CMC1_B = makeCard("Test Seed Theme Beta", "creature — elk", "", 1, ["G"]);
const TEST_SEED_THEME_CMC5 = makeCard("Test Seed Theme Delta", "creature — ox", "", 5, ["G"]);

function makeSeedCandidate(card, score) {
  return { name: card.name, score, type: card.type, cmc: card.cmc, colors: card.colors };
}

function buildFixture(minimalBuild, funPicks = [], extraOwned = []) {
  const commanderCard = makeCard(TEST_COMMANDER_NAME, "legendary creature — treefolk", "", 4, ["G"]);
  const ownedCards = [TEST_RAMP_CARD, TEST_DRAW_CARD, TEST_REMOVAL_CARD, TEST_WIPE_CARD, ...TEST_FILLER_CARDS, ...extraOwned];

  const allOwnedCardData = new Map();
  allOwnedCardData.set(normalizeCardName(commanderCard.name), commanderCard);
  for (const card of ownedCards) allOwnedCardData.set(normalizeCardName(card.name), card);

  const entries = ownedCards.map((card) => ({
    normalizedName: normalizeCardName(card.name),
    rawName: card.name,
    quantity: 1
  }));
  const collectionData = { entries, byNormalized: new Map(entries.map((e) => [e.normalizedName, e.quantity])) };

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
    { deckSize: 99, themeCardNames: new Map(), funPicks }
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

// Reproduces the bug this fixture pins down: a commander whose EDHREC pool
// happens to recommend a perfectly good generic ramp card at CMC 1, and
// whose owned collection separately has one on-theme creature that also
// costs CMC 1 but carries no ramp/draw/removal/wipe role. deckSize 47 gives
// the same ~9-card nonland budget buildCurveCapFixture uses, so band 1's cap
// is exactly 1 slot (see js/build/type-plan.js's DEFAULT_CURVE_SHARES). A
// minimal build (Phase 0 only, per the "Minimal Build stops here" comment in
// deck.js) isolates the question precisely: without a theme-seeding pre-pass,
// Phase 0's edhrec-pool check finds the ramp card immediately, claims band
// 1's only slot, satisfies the role target, and the loop ends -- the theme
// card never gets added at all, since Phase 0 never looks at cards without
// a role tag and minimal mode never reaches Phase 1/2 where it otherwise
// could. With the pre-pass, the theme card claims band 1 first; the ramp
// card still gets added afterward (an unmet role is a hard constraint, so it
// goes in over-cap) and both cards coexist at CMC 1.
const TEST_CHEAP_RAMP = makeCard("Test Cheap Ramp Dork", "creature — squirrel", "{t}: add {g}.", 1, ["G"]);
const TEST_CHEAP_THEME_CREATURE = makeCard("Test Cheap Theme Creature", "creature — bear", "", 1, ["G"]);

function buildThemeSeedFixture() {
  const commanderCard = makeCard(TEST_COMMANDER_NAME, "legendary creature — treefolk", "", 4, ["G"]);

  const allOwnedCardData = new Map();
  allOwnedCardData.set(normalizeCardName(commanderCard.name), commanderCard);
  allOwnedCardData.set(normalizeCardName(TEST_CHEAP_RAMP.name), TEST_CHEAP_RAMP);
  allOwnedCardData.set(normalizeCardName(TEST_CHEAP_THEME_CREATURE.name), TEST_CHEAP_THEME_CREATURE);

  const collectionData = {
    entries: [
      {
        normalizedName: normalizeCardName(TEST_CHEAP_THEME_CREATURE.name),
        rawName: TEST_CHEAP_THEME_CREATURE.name,
        quantity: 1
      }
    ]
  };

  const commanderThemes = [];
  const strategyProfile = getCommanderStrategyProfile(TEST_COMMANDER_NAME, commanderThemes, ["G"]);
  const modePrefs = getModePreferences("minimal", strategyProfile);
  const roleTargets = { ramp: 1, draw: 0, removal: 0, wipe: 0 };

  const scoredNonlands = [{
    name: TEST_CHEAP_RAMP.name,
    score: 20,
    type: TEST_CHEAP_RAMP.type,
    cmc: TEST_CHEAP_RAMP.cmc,
    colors: TEST_CHEAP_RAMP.colors
  }];

  const themeCardNames = new Map([
    [normalizeCardName(TEST_CHEAP_THEME_CREATURE.name), { rank: 1, hits: 1 }]
  ]);

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
    { deckSize: 47, themeCardNames }
  );
}


// Phase 2 asks the fallback tiers in order and stops at the first one that
// returns any card, so a theme tier that still holds creatures keeps winning
// slots even once it has no instants left -- the generic tier's instants are
// never reached however far under its target the Instant bucket is. This
// fixture gives the theme tier far more creatures than the deck has slots for,
// and puts every instant in the generic tier, so the only thing that can seat
// an instant is a pass that fills each bucket's shortfall tier by tier.
function buildTypeTargetFixture(instantText, roleTargets) {
  const commanderCard = makeCard(TEST_COMMANDER_NAME, "legendary creature — treefolk", "", 4, ["G"]);
  const themeCreatures = [];
  for (let i = 0; i < 70; i++) {
    themeCreatures.push(makeCard("Test Theme Creature " + i, "creature — bear", "", 1 + (i % 6), ["G"]));
  }
  const genericInstants = [];
  for (let i = 0; i < 6; i++) {
    genericInstants.push(makeCard("Test Generic Instant " + i, "instant", instantText || "", 1 + (i % 4), ["G"]));
  }
  const ownedCards = [...themeCreatures, ...genericInstants];

  const allOwnedCardData = new Map();
  allOwnedCardData.set(normalizeCardName(commanderCard.name), commanderCard);
  for (const card of ownedCards) allOwnedCardData.set(normalizeCardName(card.name), card);

  const collectionData = {
    entries: ownedCards.map((card) => ({ normalizedName: normalizeCardName(card.name), rawName: card.name, quantity: 1 }))
  };
  const themeCardNames = new Map(themeCreatures.map((card) => [normalizeCardName(card.name), { rank: 0, hits: 1 }]));

  const commanderThemes = [];
  const strategyProfile = getCommanderStrategyProfile(TEST_COMMANDER_NAME, commanderThemes, ["G"]);
  const modePrefs = getModePreferences("", strategyProfile);

  return buildDeckFromScoredPool(
    [],
    ["G"],
    collectionData,
    allOwnedCardData,
    commanderThemes,
    TEST_COMMANDER_NAME,
    modePrefs,
    { Land: 38, Creature: 10, Instant: 5 },
    roleTargets || { ramp: 0, draw: 0, removal: 0, wipe: 0 },
    [],
    { deckSize: 99, themeCardNames }
  );
}


// Curve First + a typed cost-reducer commander (Kaza, Roil Chaser's "next
// instant or sorcery spell you cast this turn costs {X} less"): the curve plan
// should file the sorcery one band lower (mana value 5 -> 4, colored pips as a
// floor) and leave a same-cost creature alone. The same build in a default
// mode must not touch either, since the effective-cost layer is Curve First
// only.
const TEST_REDUCER_TEXT = "Flying, haste\n{T}: The next instant or sorcery spell you cast this turn costs {X} less to cast, where X is the number of Wizards you control as this ability resolves.";
const TEST_REDUCED_SORCERY = makeCard("Test Reduced Sorcery", "sorcery", "", 5, ["U", "R"]);
TEST_REDUCED_SORCERY.manaCost = "{3}{U}{R}";
const TEST_UNREDUCED_CREATURE = makeCard("Test Unreduced Creature", "creature \u2014 wizard", "", 5, ["U", "R"]);
TEST_UNREDUCED_CREATURE.manaCost = "{3}{U}{R}";

function buildEffectiveCostFixture(mode) {
  const commanderCard = makeCard("Test Spellslinger", "legendary creature \u2014 human wizard", TEST_REDUCER_TEXT.toLowerCase(), 2, ["U", "R"]);
  const owned = [TEST_REDUCED_SORCERY, TEST_UNREDUCED_CREATURE];

  const allOwnedCardData = new Map();
  allOwnedCardData.set(normalizeCardName(commanderCard.name), commanderCard);
  for (const card of owned) allOwnedCardData.set(normalizeCardName(card.name), card);

  const commanderThemes = [];
  const strategyProfile = getCommanderStrategyProfile(commanderCard.name, commanderThemes, ["U", "R"]);
  const modePrefs = getModePreferences(mode, strategyProfile);
  const scoredNonlands = owned.map((card) => ({
    name: card.name, score: 30, type: card.type, cmc: card.cmc, colors: card.colors
  }));

  return buildDeckFromScoredPool(
    scoredNonlands,
    ["U", "R"],
    { entries: [] },
    allOwnedCardData,
    commanderThemes,
    commanderCard.name,
    modePrefs,
    null,
    { ramp: 0, draw: 0, removal: 0, wipe: 0 },
    [],
    { deckSize: 99, themeCardNames: new Map(), commanderTexts: [commanderCard.rawText] }
  );
}

runSuite("deck:pickCheapThemeSeeds", {
  "claims only up to the configured per-band limit, highest score first": function () {
    const pool = [
      makeSeedCandidate(TEST_SEED_THEME_CMC1_A, 10),
      makeSeedCandidate(TEST_SEED_THEME_CMC1_B, 5)
    ];
    const curvePlan = { caps: { 1: 5 }, counts: {} };

    const picks = pickCheapThemeSeeds(pool, curvePlan, new Set(), new Set());

    assertEqual(picks.map((c) => c.name), [TEST_SEED_THEME_CMC1_A.name]);
  },

  "skips bands the pool has no candidate for": function () {
    const pool = [makeSeedCandidate(TEST_SEED_THEME_CMC5, 10)];
    const curvePlan = { caps: { 1: 5, 2: 5, 3: 5 }, counts: {} };

    const picks = pickCheapThemeSeeds(pool, curvePlan, new Set(), new Set());

    assertEqual(picks, []);
  },

  "never reclaims a card already used or that is a commander": function () {
    const pool = [makeSeedCandidate(TEST_SEED_THEME_CMC1_A, 10)];
    const curvePlan = { caps: { 1: 5 }, counts: {} };
    const usedNames = new Set([normalizeCardName(TEST_SEED_THEME_CMC1_A.name)]);

    const picks = pickCheapThemeSeeds(pool, curvePlan, usedNames, new Set());

    assertEqual(picks, []);
  }
});

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

  "buildDeckFromScoredPool: a cheap theme payoff is seeded ahead of Phase 0's role fill": function () {
    const finalDeck = buildThemeSeedFixture();
    const names = finalDeck.filter((c) => c.role !== "land").map((c) => c.name);

    assertTrue(
      names.includes(TEST_CHEAP_THEME_CREATURE.name),
      "expected the cheap theme-match card to be seeded before Phase 0 claimed the whole band, got " + JSON.stringify(names)
    );
    assertTrue(
      names.includes(TEST_CHEAP_RAMP.name),
      "expected the ramp role to still be satisfied alongside the seeded theme card, got " + JSON.stringify(names)
    );
  },
  "buildDeckFromScoredPool: a bucket short of its target is filled from the generic tier when the theme tier has none": function () {
    const finalDeck = buildTypeTargetFixture();
    const instants = finalDeck.filter((c) => c.role !== "land" && /instant/.test(c.type || ""));
    assertEqual(instants.length, 6);
  },
  "buildDeckFromScoredPool: filling a type bucket never spends past a support role's target": function () {
    // Every generic instant draws a card and the draw target is 2 (a target
    // of 0 would be normalized to the default 10), so the role phase seats two
    // and the Instant shortfall must not be topped up with the other four.
    const finalDeck = buildTypeTargetFixture("draw a card.", { ramp: 1, draw: 2, removal: 1, wipe: 1 });
    const instants = finalDeck.filter((c) => c.role !== "land" && /instant/.test(c.type || ""));
    assertEqual(instants.length, 2);
  },
  "buildDeckFromScoredPool: Curve First files a cost-reduced card type one band lower": function () {
    const deck = buildEffectiveCostFixture("curveFirst");
    const sorcery = deck.find((c) => c.name === TEST_REDUCED_SORCERY.name);
    const creature = deck.find((c) => c.name === TEST_UNREDUCED_CREATURE.name);
    assertTrue(sorcery && creature, "both candidates should make the deck");
    assertEqual(curveCmcOf(sorcery), 4);
    assertEqual(curveCmcOf(creature), 5);
  },
  "buildDeckFromScoredPool: the effective-cost layer is off outside Curve First": function () {
    const deck = buildEffectiveCostFixture("");
    const sorcery = deck.find((c) => c.name === TEST_REDUCED_SORCERY.name);
    assertTrue(sorcery, "the sorcery should make the deck");
    assertEqual(curveCmcOf(sorcery), 5);
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
  },

  "buildDeckFromScoredPool: fun picks go in the deck, tagged, even when nothing else would pick them": function () {
    const odd = makeCard("Test Odd Favourite", "creature — squid", "", 7, ["G"]);
    const finalDeck = buildFixture(false, ["Test Odd Favourite"], [odd]);
    const entry = finalDeck.find((c) => c.name === "Test Odd Favourite");
    assertTrue(!!entry, "expected the fun pick in the deck");
    assertEqual(entry.source, "fun-pick");
  },

  "buildDeckFromScoredPool: a fun pick outside the commander's colors or the collection is skipped": function () {
    const offColor = makeCard("Test Red Favourite", "creature — goblin", "", 2, ["R"]);
    const finalDeck = buildFixture(false, ["Test Red Favourite", "Test Not Owned"], [offColor]);
    assertEqual(finalDeck.filter((c) => c.source === "fun-pick").length, 0);
  },

  "buildDeckFromScoredPool: fun picks are capped at FUN_PICK_MAX": function () {
    const extras = [];
    for (let i = 0; i < 8; i += 1) extras.push(makeCard("Test Fun " + i, "creature — bear", "", 3, ["G"]));
    const finalDeck = buildFixture(false, extras.map((c) => c.name), extras);
    assertEqual(finalDeck.filter((c) => c.source === "fun-pick").length, FUN_PICK_MAX);
  },

  "buildDeckFromScoredPool: Minimal Build skips fun picks": function () {
    const odd = makeCard("Test Odd Favourite", "creature — squid", "", 7, ["G"]);
    const finalDeck = buildFixture(true, ["Test Odd Favourite"], [odd]);
    assertEqual(finalDeck.filter((c) => c.source === "fun-pick").length, 0);
  }
});
