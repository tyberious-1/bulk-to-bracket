runSuite("scoring", {
  "isFlexibleTribalPayoff: detects Herald's Horn's chosen-type templating": function () {
    const card = {
      type: "Artifact",
      text: "As this artifact enters, choose a creature type. Creature spells you cast of the chosen type cost {1} less to cast. At the beginning of your upkeep, look at the top card of your library. If it's a creature card of the chosen type, you may reveal it and put it into your hand."
    };
    assertTrue(isFlexibleTribalPayoff(card), "expected Herald's Horn to be detected as a flexible tribal payoff");
  },
  "isFlexibleTribalPayoff: a plain mana rock is not a flexible tribal payoff": function () {
    const card = { type: "Artifact", text: "{T}: Add {C}{C}." };
    assertTrue(!isFlexibleTribalPayoff(card), "a Mind Stone-shaped rock should not match");
  },
  "detectRole: Herald's Horn falls through to synergy outside a tribal deck": function () {
    const card = {
      type: "Artifact",
      text: "As this artifact enters, choose a creature type. Creature spells you cast of the chosen type cost {1} less to cast. At the beginning of your upkeep, look at the top card of your library. If it's a creature card of the chosen type, you may reveal it and put it into your hand."
    };
    assertEqual(detectRole(card, false), "synergy");
  },
  "detectRole: Herald's Horn counts as ramp inside an actual tribal deck": function () {
    const card = {
      type: "Artifact",
      text: "As this artifact enters, choose a creature type. Creature spells you cast of the chosen type cost {1} less to cast. At the beginning of your upkeep, look at the top card of your library. If it's a creature card of the chosen type, you may reveal it and put it into your hand."
    };
    assertEqual(detectRole(card, true), "ramp");
  },
  "detectRole: isTribalDeck defaults to false when omitted": function () {
    const card = {
      type: "Artifact",
      text: "As this artifact enters, choose a creature type. Creature spells you cast of the chosen type cost {1} less to cast."
    };
    assertEqual(detectRole(card), "synergy");
  },
  "detectRole: a plain mana rock is ramp regardless of isTribalDeck": function () {
    const card = { type: "Artifact", text: "{T}: Add {C}{C}." };
    assertEqual(detectRole(card, false), "ramp");
    assertEqual(detectRole(card, true), "ramp");
  },
  "getRoleContributions: Kindred Discovery's draw trigger is suppressed outside a tribal deck": function () {
    const card = {
      type: "Enchantment",
      text: "As this enchantment enters, choose a creature type. Whenever a creature you control of the chosen type enters or attacks, draw a card."
    };
    assertEqual(getRoleContributions(card, false), []);
    assertEqual(getRoleContributions(card, true), ["draw"]);
  },
  "isActiveBuildTribal: no theme focused falls back to the commander's overall tribal tendency": function () {
    const tribalProfile = { wantsTribal: true };
    const nonTribalProfile = { wantsTribal: false };
    const noFocus = { themeFocus: "", focusedTribalTypes: [] };
    assertTrue(isActiveBuildTribal(tribalProfile, noFocus) === true);
    assertTrue(isActiveBuildTribal(nonTribalProfile, noFocus) === false);
  },
  "isActiveBuildTribal: a non-tribal focus (Control) overrides an otherwise-tribal commander": function () {
    // Charix, the Raging Isle supports Crab tribal (wantsTribal true), but a
    // user actively focused on Control right now is not building tribal --
    // the active focus decides, not the commander's general potential.
    const strategyProfile = { wantsTribal: true };
    const controlFocus = { themeFocus: "control", focusedTribalTypes: [] };
    assertTrue(isActiveBuildTribal(strategyProfile, controlFocus) === false);
  },
  "isActiveBuildTribal: a tribal focus is tribal even if the general profile isn't": function () {
    const strategyProfile = { wantsTribal: false };
    const tribalFocus = { themeFocus: "crab tribal", focusedTribalTypes: ["crab"] };
    assertTrue(isActiveBuildTribal(strategyProfile, tribalFocus) === true);
  },
  "scoreFallbackCard: minimalBuild suppresses the keyword-tag theme bonus": function () {
    // This is the mechanism behind the Rosheen Meanderer case that prompted
    // minimal build mode: a card earns this bonus for merely mentioning a
    // theme word (here "+1/+1 counter") in its own text, with no check that
    // it actually pays off a counters strategy -- e.g. Human Torch, Johnny
    // Storm riding this into a slot it has no real synergy with.
    const card = { type: "Creature", text: "When this creature enters, put a +1/+1 counter on it.", cmc: 3 };
    const commanderThemes = ["counters"];
    const strategyProfile = { wantsCreatures: false, wantsTokens: false, wantsSacrifice: false, wantsGoWide: false, wantsTribal: false, tribalTypes: [] };
    const commanderColors = ["G"];

    const normalModePrefs = getModePreferences("", strategyProfile);
    const minimalModePrefs = getModePreferences("minimal", strategyProfile);

    const normalScore = scoreFallbackCard(card, commanderThemes, strategyProfile, commanderColors, normalModePrefs);
    const minimalScore = scoreFallbackCard(card, commanderThemes, strategyProfile, commanderColors, minimalModePrefs);

    assertClose(normalScore - minimalScore, 4, 0.001, "expected exactly the +4 keyword-tag bonus to be missing under minimalBuild");
  }
});
