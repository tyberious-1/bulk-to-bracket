runSuite("scoring", {
  "detectRole: exiling only your own creatures is not a wipe": function () {
    const own = { type: "Enchantment", text: "When this enchantment enters, exile all creatures you control. Then create that many 5/5 red dragon creature tokens with flying." };
    assertTrue(detectRole(own, false) !== "wipe", "Day of the Dragons");
    const wrath = { type: "Sorcery", text: "Exile all creatures." };
    assertEqual(detectRole(wrath, false), "wipe");
  },
  "detectRole: a pacifism-style aura counts as removal": function () {
    const card = { type: "Enchantment — Aura", text: "Enchant creature. Enchanted creature can't attack or block." };
    assertEqual(detectRole(card, false), "removal");
  },
  "detectRole: a freeze aura counts as removal": function () {
    const card = { type: "Enchantment — Aura", text: "Enchant creature. When this Aura enters, tap enchanted creature. Enchanted creature doesn't untap during its controller's untap step." };
    assertEqual(detectRole(card, false), "removal");
  },
  "detectRole: theft counts as removal, a threaten effect does not": function () {
    const steal = { type: "Enchantment — Aura", text: "Enchant creature. You control enchanted creature." };
    const mind = { type: "Sorcery", text: "Gain control of target creature." };
    const threaten = { type: "Sorcery", text: "Gain control of target creature until end of turn. Untap that creature. It gains haste until end of turn." };
    assertEqual(detectRole(mind, false), "removal");
    assertEqual(detectRole(threaten, false), "synergy");
    assertEqual(detectRole(steal, false), "removal");
  },
  "detectRole: bounce and tucking count as removal": function () {
    assertEqual(detectRole({ type: "Instant", text: "Return target nonland permanent to its owner's hand." }, false), "removal");
    assertEqual(detectRole({ type: "Instant", text: "Put target creature on the bottom of its owner's library." }, false), "removal");
  },
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
  "detectRole: a Treasure that only appears after combat damage is not ramp (Goldvein Pick, Prying Blade)": function () {
    const pick = { type: "Artifact \u2014 Equipment", text: "Equipped creature gets +1/+1. Whenever equipped creature deals combat damage to a player, create a Treasure token. Equip {1}" };
    const blade = { type: "Artifact \u2014 Equipment", text: "Equipped creature gets +1/+0. Whenever equipped creature deals combat damage to a player, create a Treasure token. Equip {2}" };
    assertTrue(detectRole(pick, false) !== "ramp", "Goldvein Pick");
    assertTrue(detectRole(blade, false) !== "ramp", "Prying Blade");
  },
  "detectRole: a red card's attack-trigger Treasure is ramp, the same text on a colorless card is not": function () {
    const text = "Whenever this creature attacks, create a Treasure token.";
    assertEqual(detectRole({ type: "Creature \u2014 Goblin", text: text, colors: ["R"] }, false), "ramp");
    assertTrue(detectRole({ type: "Creature \u2014 Construct", text: text, colors: [] }, false) !== "ramp", "colorless");
  },
  "detectRole: a red card's Treasure that waits for its own death is still not ramp": function () {
    const card = { type: "Creature \u2014 Goblin", text: "When this creature dies, create a Treasure token.", colors: ["R"] };
    assertTrue(detectRole(card, false) !== "ramp", "dies trigger");
  },
  "detectRole: a draw spell with a Treasure rider is draw, not ramp (Deadly Dispute)": function () {
    const card = { type: "Instant", text: "As an additional cost to cast this spell, sacrifice an artifact or creature. Draw two cards and create a Treasure token." };
    assertEqual(detectRole(card, false), "draw");
  },
  "detectRole: a Treasure made when the card enters is still ramp": function () {
    const card = { type: "Artifact \u2014 Equipment", text: "When this Equipment enters, create a Treasure token. Equipped creature gets +1/+0. Equip {2}" };
    assertEqual(detectRole(card, false), "ramp");
  },
  "detectRole: putting a land from your hand onto the battlefield is ramp": function () {
    const card = { type: "Instant", text: "Target creature gets +2/+2 until end of turn. You may put a land card from your hand onto the battlefield." };
    assertEqual(detectRole(card, false), "ramp");
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
  },

  "scoreFallbackCard: curveFirst adds a cheap-removal bonus for 2-CMC-or-less removal": function () {
    const cheapRemoval = { type: "Instant", text: "Destroy target creature.", cmc: 1 };
    const strategyProfile = { wantsCreatures: false, wantsTokens: false, wantsSacrifice: false, wantsGoWide: false, wantsTribal: false, tribalTypes: [] };
    const commanderColors = ["W"];
    const commanderThemes = [];

    const normalModePrefs = getModePreferences("", strategyProfile);
    const curveFirstModePrefs = getModePreferences("curveFirst", strategyProfile);

    const normalScore = scoreFallbackCard(cheapRemoval, commanderThemes, strategyProfile, commanderColors, normalModePrefs);
    const curveFirstScore = scoreFallbackCard(cheapRemoval, commanderThemes, strategyProfile, commanderColors, curveFirstModePrefs);

    assertClose(curveFirstScore - normalScore, 4, 0.001, "expected exactly the +4 cheap-removal bonus under curveFirst");
  },

  "scoreFallbackCard: curveFirst does not bonus removal costing more than 2": function () {
    const expensiveRemoval = { type: "Sorcery", text: "Destroy target creature.", cmc: 5 };
    const strategyProfile = { wantsCreatures: false, wantsTokens: false, wantsSacrifice: false, wantsGoWide: false, wantsTribal: false, tribalTypes: [] };
    const commanderColors = ["W"];
    const commanderThemes = [];

    const normalModePrefs = getModePreferences("", strategyProfile);
    const curveFirstModePrefs = getModePreferences("curveFirst", strategyProfile);

    const normalScore = scoreFallbackCard(expensiveRemoval, commanderThemes, strategyProfile, commanderColors, normalModePrefs);
    const curveFirstScore = scoreFallbackCard(expensiveRemoval, commanderThemes, strategyProfile, commanderColors, curveFirstModePrefs);

    assertClose(curveFirstScore - normalScore, 0, 0.001, "expensive removal should score the same under curveFirst");
  },

  "getThemeFocusAdjustment: a chosen plan's signature card gets a lift scaled by inclusion": function () {
    const card = { name: "Plan Card", type: "creature", text: "", oracle_text: "", cmc: 2, colors: [] };
    const base = { themeFocus: "auras", themeFocusAliases: [], focusedThemeSignals: ["auras"] };
    const without = getThemeFocusAdjustment(card, [], base);
    const low = getThemeFocusAdjustment(card, [], { ...base, planSignature: new Map([["plan card", 0.2]]) });
    const high = getThemeFocusAdjustment(card, [], { ...base, planSignature: new Map([["plan card", 0.8]]) });
    assertTrue(low > without);
    assertTrue(high > low);
  }
  ,
  "detectCardTags: attachment hosers are not voltron, attachment payoffs and movers are": function () {
    const card = (name, type, text) => ({ name: name, type: type, text: text, cmc: 3 });
    const tags = (c) => detectCardTags(c);
    assertTrue(tags(card("Street Sweeper", "artifact creature — construct", "whenever this creature attacks, destroy all auras attached to target land.")).indexOf("voltron") === -1, "Street Sweeper destroys Auras");
    assertTrue(tags(card("Disarm", "instant", "unattach all equipment from target creature.")).indexOf("voltron") === -1, "Disarm removes Equipment");
    assertTrue(tags(card("Stolen Uniform", "instant", "choose target creature you control and target equipment. gain control of that equipment until end of turn. attach it to the chosen creature.")).indexOf("voltron") !== -1, "Stolen Uniform moves Equipment");
    assertTrue(tags(card("Enchantment Alteration", "instant", "attach target aura attached to a creature or land to another permanent of that type.")).indexOf("voltron") !== -1, "Enchantment Alteration moves an Aura");
    assertTrue(tags(card("Brood Keeper", "creature — dragon", "flying\nwhenever an aura becomes attached to this creature, create a 2/2 red dragon creature token with flying.")).indexOf("voltron") !== -1, "Brood Keeper");
    assertTrue(tags(card("Plain Equipment", "artifact — equipment", "equipped creature gets +1/+1.\nequip {1}")).indexOf("voltron") !== -1, "an Equipment still counts");
  }
  ,
  "detectRole: exiling a card from a graveyard is not removal, exiling a permanent still is": function () {
    const role = (name, type, text) => detectRole({ name: name, type: type, text: text, cmc: 3 });
    assertTrue(role("Fiend-shaped", "creature — spirit", "flying\n{2}{b}: exile target creature card from a graveyard. put a +1/+1 counter on this creature.") !== "removal", "Inherited Fiend");
    assertTrue(role("Lantern-shaped", "artifact", "when this artifact enters, exile target card from a graveyard.") !== "removal", "Lantern of the Lost");
    assertEqual(role("Swords-shaped", "instant", "exile target creature. its controller gains life equal to its power."), "removal");
    assertEqual(role("Comma-shaped", "sorcery", "exile target creature, then return target creature card from your graveyard to the battlefield."), "removal");
    assertEqual(role("Both-shaped", "creature — spirit", "when this creature enters, exile target creature an opponent controls.\n{2}: exile target card from a graveyard."), "removal");
  },
  "cardMatchesRole: draw in reminder text counts only when the card really draws": function () {
    const draw = (text) => cardMatchesRole({ name: "Sample", type: "Creature", text: text, cmc: 3 }, "draw", false);
    assertTrue(!draw("When this creature enters, create a Blood token. (It's an artifact with \"{1}, {T}, discard a card, sacrifice this artifact: Draw a card.\")"), "Blood token");
    assertTrue(!draw("Dredge 2 (If you would draw a card, you may mill two cards instead. If you do, return this card from your graveyard to your hand.)"), "dredge");
    assertTrue(!draw("When this creature enters, learn. (You may reveal a Lesson card you own from outside the game and put it into your hand, or discard a card to draw a card.)"), "learn");
    assertTrue(!draw("Gift a card (You may promise an opponent a gift as you cast this spell. If you do, they draw a card before its other effects.)"), "gift");
    assertTrue(draw("When this creature enters, investigate. (Create a Clue token. It's an artifact with \"{2}, sacrifice this artifact: Draw a card.\")"), "Clue stays");
    assertTrue(draw("When this creature enters, create a Blood token. (It's an artifact with \"{1}, {T}, discard a card, sacrifice this artifact: Draw a card.\")\nWhenever this creature attacks, draw a card."), "real draw beside a Blood token");
  },
  "cardMatchesRole: draw and removal wordings the literal lists could not hold (Scryfall-tag check, 2026-11-03)": function () {
    const has = (role, text) => cardMatchesRole({ name: "Sample", type: "Instant", text: text, cmc: 3 }, role, false);
    assertTrue(has("draw", "Target player draws two cards."), "target player draws two");
    assertTrue(has("draw", "Draw X cards, where X is the number of card types among cards in your graveyard."), "draw X cards");
    assertTrue(has("draw", "Draw cards equal to the greatest mana value among permanents you control."), "draw cards equal to");
    assertTrue(!has("draw", "Discard up to two cards, then draw that many cards."), "a rummage is not net draw");
    assertTrue(!has("draw", "Exile target nonland permanent. Its controller draws a card."), "the opponent drawing is not draw");
    assertTrue(!has("draw", "Each player discards their hand, then draws seven cards."), "a symmetrical wheel is not draw");
    assertTrue(has("removal", "Plasma Bolt deals 2 damage to any target."), "burn of 2 to any target");
    assertTrue(has("removal", "Explosive Apparatus deals X damage to any target."), "X damage to any target");
    assertTrue(!has("removal", "When this creature enters, it deals 1 damage to any target."), "a 1-damage ping is not removal");
    assertTrue(has("removal", "When this enchantment enters, exile up to one other target nonland permanent until this enchantment leaves the battlefield."), "exile up to one target");
    assertTrue(!has("removal", "Exile up to one target creature. Return it to the battlefield under its owner's control at the beginning of the next end step."), "a flicker is not removal");
    assertTrue(has("removal", "Put target creature into its owner's library second from the top."), "tuck into the library");
    assertTrue(has("removal", "Target creature's owner puts it on their choice of the top or bottom of their library."), "owner puts it on the library");
    assertTrue(has("removal", "Return up to two target creatures to their owners' hands."), "bounce up to two");
    assertTrue(!has("removal", "Return target creature you control to its owner's hand."), "bouncing your own creature is not removal");
    assertTrue(has("removal", "Enchant permanent. Enchanted permanent doesn't untap during its controller's untap step."), "aura that keeps a permanent tapped");
  }
});
