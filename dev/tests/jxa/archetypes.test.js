
function buCard(name, type, text, cmc, colors, rarity) {
  return { name, type, text, cmc: cmc || 0, colors: colors || [], rarity: rarity || "common", manaCost: "" };
}
const BU_ZOMBIE = { kind: "tribal", tag: "zombies", label: "Zombies", tribe: "zombie" };

// A themed pool for the term reading: 40 artifacts (10%) among 360 plain sorceries, plus the cards a test adds.
function buThemePool(extra) {
  const pool = [];
  for (let i = 0; i < 40; i++) pool.push(buCard("Rock " + i, "artifact", "{t}: add {c}.", 1));
  for (let i = 0; i < 360; i++) pool.push(buCard("Filler " + i, "sorcery", "draw a card.", 2));
  return pool.concat(extra || []);
}
// A theme subtype carrying the plan terms the builder attaches (withPlanTerms does this for a real build).
function buPlanSubtype(tag, cards, planTerms, planMakeTerms) {
  const vocab = buildTermVocab(cards);
  return { kind: "theme", tag, label: tag, planTerms: new Set(planTerms), planMakeTerms: new Set(planMakeTerms || planTerms), termVocab: vocab, termSupply: createTermSupply(cards, vocab) };
}

runSuite("archetypes", {
  "cardKeywords: Scryfall's list when the card carries it, else only keyword-only lines of text": () => {
    const listed = { ...buCard("Listed", "creature \u2014 zombie", "", 2, ["B"]), raw: { keywords: ["Flying", "Double strike", "Flash"] } };
    assertEqual([...cardKeywords(listed)].sort(), ["double strike", "flying"]);
    const text = buCard("Text", "creature \u2014 zombie", "flying, first strike (reminder text, vigilance)\nwhen this creature enters, target creature gains lifelink until end of turn.", 3, ["B"]);
    assertEqual([...cardKeywords(text)].sort(), ["first strike", "flying"]);
    const double = buCard("Double", "creature \u2014 zombie", "double strike", 3, ["B"]);
    assertEqual([...cardKeywords(double)], ["double strike"]);
    assertEqual(cardKeywords(buCard("Plain", "creature \u2014 zombie", "", 2, ["B"])).size, 0);
  },

  "archetypeScore: a flying first striker outranks a plain member of the same cost, most for aggro and least for control": () => {
    const plain = buCard("Plain Zombie", "creature \u2014 zombie", "", 3, ["B"]);
    const flier = buCard("Flying Zombie", "creature \u2014 zombie", "flying, first strike", 3, ["B"]);
    const gap = (archetype) => archetypeScore(flier, { archetype, subtype: BU_ZOMBIE }) - archetypeScore(plain, { archetype, subtype: BU_ZOMBIE });
    assertTrue(gap("midrange") > 0.5, "midrange gap " + gap("midrange"));
    assertTrue(gap("aggro") > gap("midrange") && gap("midrange") > gap("control") && gap("control") > 0);
    assertTrue(gap("aggro") < BOTTOM_UP_WEIGHT.member - BOTTOM_UP_WEIGHT.mention, "keywords must stay inside the member tier");
  },

  "archetypeScore: keywords score the deck's own creatures, not a creature that is only here for a role": () => {
    const ctx = { archetype: "midrange", subtype: BU_ZOMBIE };
    const drainer = buCard("Drake Reader", "creature \u2014 drake", "flying\nwhen this creature enters, draw a card.", 3, ["U"]);
    const rock = buCard("Reading Rock", "artifact", "when this artifact enters, draw a card.", 3, []);
    assertEqual(archetypeScore(drainer, ctx), archetypeScore(rock, ctx));
  },

  "isEdict: each player sacrifices a creature is an edict, a mass sacrifice is not": () => {
    assertTrue(isEdict("each player sacrifices a creature of their choice."));
    assertTrue(isEdict("when this creature exploits a creature, each opponent sacrifices a creature of their choice."));
    assertTrue(!isEdict("each player sacrifices all creatures they control."));
    assertTrue(!isEdict("destroy all creatures. each player sacrifices a land."));
  },

  "bottomUpRole: a sacrifice trigger beside a for-each count is an edict, and a two-creature edict is removal": () => {
    const winter = buCard("Winter", "legendary creature \u2014 human warlock",
      "when winter enters, you may sacrifice a creature or planeswalker. when you do, each opponent sacrifices a creature of their choice.\nwinter gets +1/+0 for each creature and planeswalker card in your graveyard.", 3, ["B"]);
    assertEqual(bottomUpRole(winter), "removal");
    const barter = buCard("Barter in Blood", "sorcery", "each player sacrifices two creatures of their choice.", 4, ["B"]);
    assertEqual(bottomUpRole(barter), "removal");
    const real = buCard("Phasing", "enchantment \u2014 saga", "iii \u2014 destroy all creatures. for each creature destroyed this way, its controller creates a 2/2 token.", 4, ["B"]);
    assertEqual(bottomUpRole(real), "wipe");
  },

  "bottomUpRole: artifact and enchantment removal counts as removal, face-only damage and land destruction do not": () => {
    const commando = buCard("Cathar Commando", "creature \u2014 human soldier", "flash\n{1}, sacrifice this creature: destroy target artifact or enchantment.", 2, ["W"]);
    assertEqual(bottomUpRole(commando), "removal");
    assertEqual(removalKind(commando), "permanent");
    const cloudchaser = buCard("Aven Cloudchaser", "creature \u2014 bird soldier",
      "flying (this creature can't be blocked except by creatures with flying or reach.)\nwhen this creature enters, destroy target enchantment.", 4, ["W"]);
    assertEqual(bottomUpRole(cloudchaser), "removal");
    assertEqual(removalKind(cloudchaser), "permanent");
    const hero = buCard("Heartfire Hero", "creature \u2014 human soldier",
      "valiant \u2014 whenever this creature becomes the target of a spell or ability you control for the first time each turn, put a +1/+1 counter on it.\nwhen this creature dies, it deals damage equal to its power to each opponent.", 1, ["R"]);
    assertTrue(bottomUpRole(hero) !== "removal");
    const dead = buCard("Polluted Dead", "creature \u2014 zombie", "when this creature dies, destroy target land.", 5, ["B"]);
    assertTrue(bottomUpRole(dead) !== "removal");
    const bearer = buCard("Mine Bearer", "creature \u2014 human soldier", "{t}, sacrifice this creature: destroy target attacking creature.", 3, ["W"]);
    assertEqual(removalKind(bearer), "hard");
    const both = buCard("Reclaim", "instant", "destroy target artifact or creature.", 2, ["W"]);
    assertEqual(bottomUpRole(both), "removal");
    assertEqual(removalKind(both), "hard");
    const beast = buCard("Beast Within", "instant", "destroy target permanent. its controller creates a 3/3 green beast creature token.", 3, ["G"]);
    assertEqual(removalKind(beast), "hard");
  },

  "answerFloor: artifact and enchantment answers are reserved in every archetype and scale with the deck": () => {
    assertEqual(answerFloor("aggro"), 1);
    assertEqual(answerFloor("midrange"), 2);
    assertEqual(answerFloor("control"), 2);
    assertTrue(answerFloor("control", 31) <= 2);
    assertEqual(BOTTOM_UP_ANSWER_CAP, 3);
  },

  "archetypeScore: an artifact and enchantment answer ranks like hard removal": () => {
    const ctx = { archetype: "midrange", subtype: null };
    const disenchant = buCard("Disenchant", "instant", "destroy target artifact or enchantment.", 3, ["W"]);
    const doom = buCard("Murder", "instant", "destroy target creature.", 3, ["B"]);
    assertEqual(archetypeScore(disenchant, ctx), archetypeScore(doom, ctx));
  },

  "removalFinesse: instant speed and a flexible target beat an extra cost or a narrow target, with the same kind weight": () => {
    const ctx = { archetype: "midrange", subtype: null };
    const absence = buCard("Fateful Absence", "instant", "destroy target creature or planeswalker. its controller investigates.", 2, ["W"]);
    const purge = buCard("Angelic Purge", "sorcery", "as an additional cost to cast this spell, sacrifice a permanent.\nexile target artifact, creature, or enchantment.", 2, ["W"]);
    const tapped = buCard("Smite Tapped", "instant", "destroy target tapped creature.", 2, ["W"]);
    assertEqual(removalKind(absence), "hard");
    assertEqual(removalKind(purge), "hard");
    assertTrue(archetypeScore(absence, ctx) > archetypeScore(tapped, ctx));
    assertTrue(archetypeScore(tapped, ctx) > archetypeScore(purge, ctx) - 0.0001 || archetypeScore(absence, ctx) > archetypeScore(purge, ctx));
    assertTrue(archetypeScore(absence, ctx) - archetypeScore(purge, ctx) >= 0.5, "finesse gap too small");
  },

  "bottomUpRole: counter target noncreature or creature spell is removal (a counterspell), and counter target spell stays one": () => {
    const negate = buCard("Negate", "instant", "counter target noncreature spell.", 2, ["U"]);
    const scatter = buCard("Essence Scatter", "instant", "counter target creature spell.", 2, ["U"]);
    const cancel = buCard("Cancel", "instant", "counter target spell.", 3, ["U"]);
    const stifle = buCard("Trickster", "instant", "counter target activated ability.", 1, ["U"]);
    for (const card of [negate, scatter, cancel]) assertEqual(bottomUpRole(card), "removal");
    assertEqual(removalKind(negate), "narrowcounter");
    assertEqual(removalKind(cancel), "counter");
    assertTrue(isCounterKind(removalKind(scatter)));
    assertTrue(bottomUpRole(stifle) !== "removal");
  },

  "bottomUpRole: a creature whose sweep is a repeatable ability is not a wipe, one that sweeps on entering is": () => {
    const ashling = buCard("Ashling the Pilgrim", "legendary creature \u2014 elemental shaman",
      "{1}{r}: put a +1/+1 counter on ashling. if this is the third time this ability has resolved this turn, remove all +1/+1 counters from ashling, and it deals that much damage to each creature and each player.", 2, ["R"]);
    assertTrue(bottomUpRole(ashling) !== "wipe");
    const zodiark = buCard("Zodiark", "legendary creature \u2014 god", "indestructible\nwhen zodiark enters, each player sacrifices all other creatures they control.", 5, ["B"]);
    assertEqual(bottomUpRole(zodiark), "wipe");
    const ajani = buCard("Ajani Unrelenting", "legendary planeswalker \u2014 ajani", "\u22123: ajani deals 4 damage to each creature except for tokens you control.", 6, ["W", "R"]);
    assertEqual(bottomUpRole(ajani), "wipe");
  },

  "bottomUpRole: mana that only arrives when a creature attacks is not ramp": () => {
    const collector = buCard("Brazen Collector", "creature \u2014 goblin", "first strike\nwhenever this creature attacks, add {r}. until end of turn, you don't lose this mana as steps and phases end.", 2, ["R"]);
    assertTrue(bottomUpRole(collector) !== "ramp");
    assertEqual(bottomUpRole(buCard("Llanowar Elves", "creature \u2014 elf druid", "{t}: add {g}.", 1, ["G"])), "ramp");
  },

  "bottomUpRole: land destruction is not creature removal": () => {
    const dead = buCard("Polluted Dead", "creature \u2014 zombie", "when this creature dies, destroy target land.", 5, ["B"]);
    assertTrue(bottomUpRole(dead) !== "removal");
    const stone = buCard("Stone Rain", "sorcery", "destroy target land.", 3, ["R"]);
    assertTrue(bottomUpRole(stone) !== "removal");
    const mixed = buCard("Beast Within", "instant", "destroy target permanent. its controller creates a 3/3 green beast creature token.", 3, ["G"]);
    assertEqual(bottomUpRole(mixed), "removal");
  },

  "removalKind: removal that needs a damaged creature is conditional, below bounce-level hard removal": () => {
    const forayer = buCard("Qutrub Forayer", "creature \u2014 zombie",
      "when this creature enters, choose one \u2014\n\u2022 destroy target creature that was dealt damage this turn.\n\u2022 exile up to two target cards from a single graveyard.", 3, ["B"]);
    assertEqual(removalKind(forayer), "conditional");
    assertEqual(removalKind(buCard("Doom Blade", "instant", "destroy target nonblack creature.", 2, ["B"])), "hard");
    const ctx = { archetype: "control", subtype: null };
    assertTrue(archetypeScore(buCard("Doom Blade", "instant", "destroy target nonblack creature.", 3, ["B"]), ctx)
      > archetypeScore(buCard("Qutrub Forayer", "creature \u2014 zombie", "when this creature enters, destroy target creature that was dealt damage this turn.", 3, ["B"]), ctx));
  },

  "bottomUpRole: edicts are removal, real sweepers stay wipes": () => {
    const innocent = buCard("Innocent Blood", "sorcery", "each player sacrifices a creature of their choice.", 1, ["B"]);
    assertEqual(bottomUpRole(innocent), "removal");
    const wrath = buCard("Sweep Away", "sorcery", "destroy all creatures.", 4, ["W"]);
    assertEqual(bottomUpRole(wrath), "wipe");
  },

  "bottomUpRole: a cost reducer and a one-shot sacrifice are not ramp": () => {
    const granGran = buCard("Gran-Gran", "legendary creature — human peasant ally",
      "whenever gran-gran becomes tapped, draw a card, then discard a card.\nnoncreature spells you cast cost {1} less to cast as long as there are three or more lesson cards in your graveyard.", 1, ["B"]);
    assertEqual(bottomUpRole(granGran), "draw");
    const bloodPet = buCard("Blood Pet", "creature — thrull", "sacrifice this creature: add {b}.", 1, ["B"]);
    assertEqual(bottomUpRole(bloodPet), "synergy");
    const paladin = buCard("Forsworn Paladin", "creature — human knight",
      "menace\n{1}{b}, {t}, pay 1 life: create a treasure token.", 1, ["B"]);
    assertEqual(bottomUpRole(paladin), "synergy");
  },

  "bottomUpRole: real ramp stays ramp": () => {
    const elf = buCard("Llanowar Elves", "creature — elf druid", "{t}: add {g}.", 1, ["G"]);
    assertEqual(bottomUpRole(elf), "ramp");
    const growth = buCard("Rampant Growth", "sorcery", "search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.", 2, ["G"]);
    assertEqual(bottomUpRole(growth), "ramp");
  },

  "bottomUpRole: combat-only mana and a sacrifice-a-creature mana ability are not ramp": () => {
    const azula = buCard("Azula", "creature \u2014 human noble",
      "firebending 1 (whenever this creature attacks, add {r}. this mana lasts until end of combat.)\nwhenever azula attacks, you may discard a card.", 3, ["B", "R"]);
    assertTrue(bottomUpRole(azula) !== "ramp");
    const altar = buCard("Transmogrant Altar", "artifact",
      "{b}, {t}, sacrifice a creature: add {c}{c}{c}.\n{2}, {t}, sacrifice a creature: create a 3/3 colorless zombie artifact creature token. activate only as a sorcery.", 3, []);
    assertTrue(bottomUpRole(altar) !== "ramp");
  },

  "bottomUpRole: Treasure makers keep ramp when their reminder text is present, a mana-costing maker and reminder-only mana do not": () => {
    const reminder = ' (it\'s an artifact with "{t}, sacrifice this token: add one mana of any color.")';
    const ghast = buCard("Shambling Ghast", "creature \u2014 zombie", "when this creature dies, create a treasure token." + reminder, 1, ["B"]);
    assertEqual(bottomUpRole(ghast), "ramp");
    assertEqual(rampKind(ghast), "oneshot");
    const hoarder = buCard("Dire Fleet Hoarder", "creature \u2014 human pirate", "when this creature dies, create a treasure token." + reminder + "\nblitz {1}{b}", 2, ["B"]);
    assertEqual(bottomUpRole(hoarder), "ramp");
    const dredger = buCard("Treasure Dredger", "creature \u2014 human", "{1}, {t}, pay 1 life: create a treasure token." + reminder, 2, ["B"]);
    assertTrue(bottomUpRole(dredger) !== "ramp");
    const azula = buCard("Azula", "creature \u2014 human noble",
      "firebending 1 (whenever this creature attacks, add {r}. this mana lasts until end of combat.)\nwhenever azula attacks, you may discard a card.", 3, ["B", "R"]);
    assertTrue(bottomUpRole(azula) !== "ramp");
  },

  "rampKind: rocks, dorks and land search are reliable, a one-shot Treasure is not": () => {
    assertEqual(rampKind(buCard("Llanowar Elves", "creature \u2014 elf druid", "{t}: add {g}.", 1, ["G"])), "reliable");
    assertEqual(rampKind(buCard("Apprentice Wizard", "creature \u2014 human wizard", "{u}, {t}: add {c}{c}{c}.", 3, ["U"])), "reliable");
    assertEqual(rampKind(buCard("Changeling Wayfinder", "creature \u2014 shapeshifter",
      "changeling\nwhen this creature enters, you may search your library for a basic land card, reveal it, put it into your hand, then shuffle.", 3, [])), "reliable");
    const ghast = buCard("Shambling Ghast", "creature \u2014 zombie",
      "when this creature dies, choose one \u2014\n\u2022 target creature an opponent controls gets -1/-1 until end of turn.\n\u2022 create a treasure token.", 1, ["B"]);
    assertEqual(bottomUpRole(ghast), "ramp");
    assertEqual(rampKind(ghast), "oneshot");
    const aerialist = buCard("Burdened Aerialist", "creature \u2014 human pirate",
      "when this creature enters, create a treasure token.\nwhenever you sacrifice a token, this creature gains flying until end of turn.", 3, ["U"]);
    assertEqual(rampKind(aerialist), "oneshot");
  },

  "drawKind: engines, plain draw, cantrips and looting rank apart": () => {
    const eternal = buCard("Eternal", "creature \u2014 cleric zombie", "afflict 2\nwhenever this creature attacks and isn't blocked, draw a card.", 3, ["B"]);
    const reaper = buCard("Reaper", "creature \u2014 knight zombie", "whenever a nontoken creature you control dies, this creature deals 1 damage to you and you draw a card.", 3, ["B"]);
    const stitched = buCard("Stitched Assistant", "creature \u2014 zombie", "exploit\nwhen this creature exploits a creature, scry 1, then draw a card.", 3, ["U"]);
    const startle = buCard("Startle", "instant", "target creature gets -2/-0 until end of turn. create a 2/2 black zombie creature token with decayed.\ndraw a card.", 2, ["B"]);
    const lamplighter = buCard("Lamplighter", "creature \u2014 horror zombie", "when this creature enters, if you control another zombie, you may draw a card. if you do, discard a card.", 5, ["B"]);
    const entomber = buCard("Entomber", "creature \u2014 zombie", "{t}, discard a creature card: draw a card.", 2, ["B"]);
    const night = buCard("Night's Whisper", "sorcery", "you draw two cards and you lose 2 life.", 2, ["B"]);
    assertEqual(drawKind(eternal), "engine");
    assertEqual(drawKind(reaper), "engine");
    assertEqual(drawKind(night), "pure");
    assertEqual(drawKind(stitched), "cantrip");
    assertEqual(drawKind(startle), "cantrip");
    assertEqual(drawKind(lamplighter), "filter");
    assertEqual(drawKind(entomber), "filter");
  },

  "drawKind: power-based triggers, an ability-word prefix and a pay-then-draw trigger are engines": () => {
    const kiora = buCard("Kiora", "legendary planeswalker", "whenever a creature you control with power 4 or greater enters, draw a card.\n\u22121: untap target permanent.", 3, ["G", "U"]);
    const colossal = buCard("Colossal Majesty", "enchantment", "at the beginning of your upkeep, if you control a creature with power 4 or greater, draw a card.", 3, ["G"]);
    const warg = buCard("The Chief Warg", "legendary creature \u2014 wolf",
      "menace\nferocious \u2014 whenever you attack while you control a creature with power 4 or greater, you draw a card and lose 1 life.", 4, ["B", "G"]);
    const mentor = buCard("Mentor of the Meek", "creature \u2014 human soldier",
      "whenever another creature you control with power 2 or less enters, you may pay {1}. if you do, draw a card.", 3, ["W"]);
    assertEqual(drawKind(kiora), "engine");
    assertEqual(drawKind(colossal), "engine");
    assertEqual(drawKind(warg), "engine");
    assertEqual(drawKind(mentor), "engine");
    const gremlin = buCard("Irreverent Gremlin", "creature \u2014 gremlin",
      "menace\nwhenever another creature you control with power 2 or less enters, you may discard a card. if you do, draw a card. do this only once each turn.", 2, ["R"]);
    assertEqual(drawKind(gremlin), "filter");
    const garruk = buCard("Garruk's Uprising", "enchantment",
      "when this enchantment enters, if you control a creature with power 4 or greater, draw a card.", 3, ["G"]);
    assertEqual(drawKind(garruk), "cantrip");
  },

  "archetypeScore: a mana rock outscores a one-shot Treasure, and an engine outscores a cantrip": () => {
    const ctx = { archetype: "midrange", subtype: null };
    const rock = buCard("Rock", "artifact", "{t}: add {c}{c}.", 3, []);
    const treasure = buCard("Aerialist", "creature \u2014 human pirate", "when this creature enters, create a treasure token.", 3, ["U"]);
    assertTrue(archetypeScore(rock, ctx) > archetypeScore(treasure, ctx));
    const engine = buCard("Eternal", "creature \u2014 cleric zombie", "whenever this creature attacks and isn't blocked, draw a card.", 3, ["B"]);
    const cantrip = buCard("Chill", "instant", "tap target creature.\ndraw a card.", 3, ["U"]);
    assertTrue(archetypeScore(engine, ctx) > archetypeScore(cantrip, ctx));
  },

  "drawTrigger: a draw that fires on the tribe is a tribe trigger, a graveyard-leaving draw counts for Zombies only": () => {
    const archivist = buCard("Grave Archivist", "creature \u2014 human wizard", "whenever another zombie enters the battlefield under your control, draw a card.", 3, ["U"]);
    assertEqual(drawTrigger(archivist, BU_ZOMBIE), "tribe");
    assertEqual(drawTrigger(archivist, { kind: "tribal", tag: "elves", label: "Elves", tribe: "elf" }), "");
    const dies = buCard("Zombie Scribe", "creature \u2014 human", "whenever a zombie you control dies, draw a card.", 3, ["B"]);
    assertEqual(drawTrigger(dies, BU_ZOMBIE), "tribe");
    const flicker = buCard("Crypt Scholar", "enchantment", "whenever a card leaves your graveyard, you may draw a card.", 3, ["B"]);
    assertEqual(drawTrigger(flicker, BU_ZOMBIE), "graveyard");
    assertEqual(drawTrigger(flicker, { kind: "tribal", tag: "elves", label: "Elves", tribe: "elf" }), "");
    const plain = buCard("Plain Engine", "creature \u2014 human", "whenever this creature attacks, draw a card.", 3, ["U"]);
    assertEqual(drawTrigger(plain, BU_ZOMBIE), "");
    assertEqual(drawTrigger(buCard("Exile Zombie", "instant", "exile target zombie. draw a card.", 3, ["B"]), BU_ZOMBIE), "");
  },

  "archetypeScore: in a Zombie deck a draw trigger on Zombies or on the graveyard outscores a plain engine": () => {
    const ctx = { archetype: "control", subtype: BU_ZOMBIE };
    const plain = buCard("Plain Engine", "creature \u2014 human wizard", "whenever this creature attacks, draw a card.", 3, ["U"]);
    const grave = buCard("Crypt Scholar", "enchantment", "whenever a card leaves your graveyard, you may draw a card.", 3, ["B"]);
    const tribe = buCard("Grave Archivist", "creature \u2014 human wizard", "whenever another zombie enters the battlefield under your control, draw a card.", 3, ["U"]);
    assertEqual(annotateBottomUpCard(grave, BU_ZOMBIE).role, "draw");
    assertEqual(annotateBottomUpCard(tribe, BU_ZOMBIE).role, "draw");
    assertTrue(archetypeScore(grave, ctx) > archetypeScore(plain, ctx));
    assertTrue(archetypeScore(tribe, ctx) > archetypeScore(plain, ctx));
    // Without a tribe the trigger earns nothing extra.
    const none = { archetype: "control", subtype: null };
    assertEqual(archetypeScore(grave, none), archetypeScore(plain, none));
  },

  "counterFloor: blue control and midrange reserve counterspells, mono-blue more, aggro and non-blue none": () => {
    assertEqual(counterFloor("control", ["U", "B"]), 5);
    assertEqual(counterFloor("control", ["U"]), 7);
    assertEqual(counterFloor("midrange", ["U", "G"]), 3);
    assertEqual(counterFloor("midrange", ["U"]), 5);
    assertEqual(counterFloor("aggro", ["U"]), 0);
    assertEqual(counterFloor("control", ["B", "G"]), 0);
    assertEqual(counterFloor("control", []), 0);
    // A smaller deck (a partner pair leaves fewer slots) scales the floor down, never above the removal slots.
    assertTrue(counterFloor("control", ["U"], 31) < 7);
    assertTrue(counterFloor("control", ["U"], 62) <= ARCHETYPES.control.slots.removal);
  },

  "removalKind: a counter that lets the caster pay is soft and ranks below a hard counter": () => {
    assertEqual(removalKind(buCard("Hard", "instant", "counter target spell.", 2, ["U"])), "counter");
    assertEqual(removalKind(buCard("Soft", "instant", "counter target spell unless its controller pays {4}.", 3, ["U"])), "softcounter");
    const ctx = { archetype: "control", subtype: null };
    assertTrue(archetypeScore(buCard("Hard", "instant", "counter target spell.", 3, ["U"]), ctx)
      > archetypeScore(buCard("Soft", "instant", "counter target spell unless its controller pays {4}.", 3, ["U"]), ctx));
    assertTrue(archetypeScore(buCard("Soft", "instant", "counter target spell unless its controller pays {4}.", 3, ["U"]), ctx)
      > archetypeScore(buCard("Bounce", "instant", "return target creature to its owner's hand.", 3, ["U"]), ctx));
  },

  "removalKind: hard, counter, bounce and aura are told apart": () => {
    assertEqual(removalKind(buCard("a", "instant", "destroy target creature.")), "hard");
    assertEqual(removalKind(buCard("b", "instant", "counter target spell.")), "counter");
    assertEqual(removalKind(buCard("c", "instant", "return target nonland permanent to its owner's hand.")), "bounce");
    assertEqual(removalKind(buCard("d", "enchantment — aura", "enchant creature\nwhen this aura enters, tap enchanted creature.")), "other");
  },

  "subtypeStanding: member, payoff, mention and a card that spares the tribe": () => {
    assertEqual(subtypeStanding(buCard("m", "creature — zombie warrior", ""), BU_ZOMBIE), "member");
    assertEqual(subtypeStanding(buCard("p", "enchantment", "zombies you control get +1/+1."), BU_ZOMBIE), "payoff");
    assertEqual(subtypeStanding(buCard("h", "sorcery", "exile target zombie."), BU_ZOMBIE), "mention");
    assertEqual(subtypeStanding(buCard("v", "instant", "destroy target non-vampire, non-werewolf, non-zombie creature."), BU_ZOMBIE), "none");
  },

  "subtypeStanding: conditional wording is a payoff": () => {
    const wizards = { kind: "tribal", tag: "wizards", label: "Wizards", tribe: "wizard" };
    assertEqual(subtypeStanding(buCard("a", "instant", "this spell costs {2} less to cast if you control a wizard.\nit deals 3 damage to any target."), wizards), "payoff");
    assertEqual(subtypeStanding(buCard("b", "enchantment", "as long as you control a wizard, creatures you control get +1/+0."), wizards), "payoff");
    assertEqual(subtypeStanding(buCard("c", "sorcery", "for each wizard you control, draw a card."), wizards), "payoff");
    assertEqual(subtypeStanding(buCard("d", "enchantment", "wizard spells you cast cost {1} less to cast."), wizards), "payoff");
    assertEqual(subtypeStanding(buCard("e", "creature — elemental", "when this creature enters, put a +1/+1 counter on it for each wizard you control."), wizards), "payoff");
    assertEqual(subtypeStanding(buCard("f", "instant", "destroy target non-wizard creature."), wizards), "none");
    assertEqual(subtypeStanding(buCard("g", "sorcery", "exile target wizard."), wizards), "mention");
  },

  "subtypeStanding: a theme subtype matches on the detected tag": () => {
    const tokens = { kind: "theme", tag: "tokens", label: "Tokens" };
    assertEqual(subtypeStanding(buCard("t", "sorcery", "create two 1/1 white soldier creature tokens."), tokens), "member");
    assertEqual(subtypeStanding(buCard("x", "sorcery", "draw a card."), tokens), "none");
  },

  "derivePlanTerms: the terms most members make, never a term nearly every card makes": () => {
    const members = [];
    for (let i = 0; i < 20; i++) members.push(buCard("Muster " + i, "sorcery", "create two 1/1 white soldier creature tokens.", 3));
    const soldiers = [buCard("Pool Soldier A", "creature — soldier", "", 2), buCard("Pool Soldier B", "creature — soldier", "", 2), buCard("Pool Soldier C", "creature — soldier", "", 2)];
    const pool = buThemePool(members.concat(soldiers));
    const vocab = buildTermVocab(pool);
    const terms = derivePlanTerms(pool, { kind: "theme", tag: "tokens", label: "Tokens" }, vocab, createTermSupply(pool, vocab));
    assertTrue(terms.has("soldier") && terms.has("ev:token"), "terms: " + [...terms].join(", "));
    assertTrue(!terms.has("ev:cast"), "every spell makes ev:cast, so it is too common to be a plan term");
    assertTrue(!terms.has("artifact"), "no member makes artifact");
    assertEqual(derivePlanTerms(pool, { kind: "theme", tag: "tokens", label: "Tokens" }, vocab, createTermSupply(pool.slice(0, 50), vocab)).size, 0);
  },

  "theme standing: a payoff that needs a plan term is a payoff, a source is a member, a removal that targets it is neither": () => {
    const watcher = buCard("Forge Watcher", "enchantment", "whenever an artifact you control enters, draw a card.", 3);
    const pool = buThemePool([watcher]);
    const sub = buPlanSubtype("artifacts", pool, ["artifact"]);
    assertEqual(subtypeStanding(watcher, sub), "payoff");
    assertEqual(subtypeStanding(pool[0], sub), "member");
    assertEqual(subtypeStanding(buCard("Rust Wave", "sorcery", "destroy target artifact."), sub), "none");
  },

  "theme standing: a card that needs and makes the plan term is a member with the engine flag": () => {
    const reactor = buCard("Spark Engine", "artifact", "whenever this artifact or another artifact you control enters, put a charge counter on this artifact.", 3);
    const pool = buThemePool([reactor]);
    const sub = buPlanSubtype("artifacts", pool, ["artifact"]);
    assertEqual(subtypeStanding(reactor, sub), "member");
    assertTrue(annotateBottomUpCard(reactor, sub).engine, "an amplifier is flagged");
    assertTrue(!annotateBottomUpCard(pool[1], sub).engine, "a plain source is not");
  },

  "theme standing: proliferate is an amplifier of a poison plan": () => {
    const infect = [];
    for (let i = 0; i < 10; i++) infect.push(buCard("Venom Snake " + i, "creature — snake", "infect (this creature deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters.)", 2));
    const sage = buCard("Spread Sage", "creature — druid", "{4}, {t}: proliferate. (choose any number of permanents and/or players, then give each another counter of each kind already there.)", 3);
    const pool = buThemePool(infect.concat([sage]));
    const sub = buPlanSubtype("infect~deathtouch", pool, ["poison counter", "counter"], ["poison counter"]);
    assertEqual(subtypeStanding(infect[0], sub), "member");
    assertTrue(["payoff", "member"].includes(subtypeStanding(sage, sub)) && annotateBottomUpCard(sage, sub).engine, "proliferate counts as a payoff-or-engine");
  },

  "theme standing: without plan terms, or in a pool under 200 cards, nothing is invented": () => {
    const watcher = buCard("Late Watcher", "enchantment", "whenever an artifact you control enters, draw a card.", 3);
    const pool = buThemePool([watcher]);
    const bare = { kind: "theme", tag: "tokens", label: "Tokens" };
    assertEqual(subtypeStanding(watcher, bare), "none");
    assertEqual(subtypeStanding(watcher, { ...bare, planTerms: new Set(), planMakeTerms: new Set() }), "none");
    const small = buPlanSubtype("artifacts", pool.slice(0, 100).concat([watcher]), ["artifact"]);
    assertEqual(subtypeStanding(watcher, small), "mention");
  },

  "sparesSubtype: except / non- phrasing on removal and wipes only": () => {
    const sweep = "all creatures except zombies get -1/-1 until end of turn.";
    assertTrue(sparesSubtype(buCard("s", "sorcery", sweep), BU_ZOMBIE, "wipe"));
    assertTrue(sparesSubtype(buCard("v", "instant", "destroy target non-zombie creature."), BU_ZOMBIE, "removal"));
    assertTrue(!sparesSubtype(buCard("v", "instant", "destroy target non-zombie creature."), BU_ZOMBIE, "draw"));
    assertTrue(!sparesSubtype(buCard("w", "sorcery", "destroy all creatures."), BU_ZOMBIE, "wipe"));
  },

  "archetypeScore: aggro prefers a cheap creature, control prefers hard removal over an aura": () => {
    const cheap = buCard("Cheap", "creature — zombie", "haste", 1, ["B"]);
    const dear = buCard("Dear", "creature — zombie", "", 5, ["B"]);
    assertTrue(archetypeScore(cheap, { archetype: "aggro", subtype: BU_ZOMBIE }) > archetypeScore(dear, { archetype: "aggro", subtype: BU_ZOMBIE }));
    const hard = buCard("Hard", "instant", "destroy target creature.", 2, ["B"]);
    const aura = buCard("Aura", "enchantment — aura", "enchant creature\nwhen this aura enters, tap enchanted creature.\nenchanted creature doesn't untap during its controller's untap step.", 2, ["U"]);
    assertTrue(archetypeScore(hard, { archetype: "control", subtype: BU_ZOMBIE }) > archetypeScore(aura, { archetype: "control", subtype: BU_ZOMBIE }));
  },

  "archetypeScore: mentioning haste earns nothing, in aggro or elsewhere": () => {
    const pump = buCard("Pump", "sorcery", "target creature gets +3/+0 until end of turn.", 2, ["B"]);
    const hasteTrick = buCard("Pump Haste", "sorcery", "target creature gets +3/+0 and gains haste until end of turn.", 2, ["B"]);
    assertEqual(archetypeScore(hasteTrick, { archetype: "aggro", subtype: BU_ZOMBIE }), archetypeScore(pump, { archetype: "aggro", subtype: BU_ZOMBIE }));
  },

  "archetypeScore: a tribe member that makes or pumps the tribe outscores a plain member of the same cost": () => {
    const plain = buCard("Plain", "creature — zombie", "", 3, ["B"]);
    const maker = buCard("Maker", "creature — zombie", "when this creature enters, create a 1/1 black zombie creature token.", 3, ["B"]);
    const lord = buCard("Lord", "creature — zombie", "other zombies you control get +1/+1.", 3, ["B"]);
    const ctx = { archetype: "midrange", subtype: BU_ZOMBIE };
    assertTrue(archetypeScore(maker, ctx) > archetypeScore(plain, ctx), "token maker not lifted");
    assertTrue(archetypeScore(lord, ctx) > archetypeScore(plain, ctx), "lord not lifted");
    assertEqual(annotateBottomUpCard(maker, BU_ZOMBIE).standing, "member");
  },

  "archetypeScore: giving the opponent a tribe token, or an embalm reminder, is not an engine": () => {
    const plain = buCard("Plain", "creature — zombie", "", 3, ["B"]);
    const gift = buCard("Gift", "creature — zombie", "whenever this creature deals combat damage to a player, that player creates a 1/1 black zombie creature token.", 3, ["B"]);
    const embalm = buCard("Embalmer", "creature — zombie", "this creature can block an additional creature each combat.\nembalm {2}{b} ({2}{b}, exile this card from your graveyard: create a token that's a copy of it, except it's a white zombie. embalm only as a sorcery.)", 3, ["B"]);
    const ctx = { archetype: "midrange", subtype: BU_ZOMBIE };
    assertEqual(archetypeScore(gift, ctx), archetypeScore(plain, ctx));
    assertEqual(archetypeScore(embalm, ctx), archetypeScore(plain, ctx));
  },

  "archetypeScore: a symmetrical sweeper scores lower in aggro than in control, and a sparing one higher": () => {
    const wrath = buCard("Wrath Thing", "sorcery", "destroy all creatures.", 4, ["B"]);
    assertTrue(archetypeScore(wrath, { archetype: "control", subtype: BU_ZOMBIE }) > archetypeScore(wrath, { archetype: "aggro", subtype: BU_ZOMBIE }));
    const spare = buCard("Spare Thing", "sorcery", "destroy all creatures except zombies.", 4, ["B"]);
    assertTrue(archetypeScore(spare, { archetype: "control", subtype: BU_ZOMBIE }) > archetypeScore(wrath, { archetype: "control", subtype: BU_ZOMBIE }));
  },

  "removalKind: a destroy that names only creature types is conditional, one that names creatures is hard": () => {
    const slayer = buCard("Slayer Fixture", "creature \u2014 human cleric", "when this creature enters, you may destroy target vampire, werewolf, or zombie.", 4, ["W"]);
    assertEqual(bottomUpRole(slayer), "removal");
    assertEqual(removalKind(slayer), "conditional");
    const dragon = buCard("Dragon Bane Fixture", "instant", "destroy target dragon.", 2, ["W"]);
    assertEqual(removalKind(dragon), "conditional");
    const plain = buCard("Doom Blade Fixture", "instant", "destroy target nonblack creature.", 2, ["B"]);
    assertEqual(removalKind(plain), "hard");
    const attacker = buCard("Smite Fixture", "instant", "destroy target attacking creature.", 1, ["W"]);
    assertEqual(removalKind(attacker), "hard");
    // a modal card whose other mode hits any creature is not conditional
    const modal = buCard("Modal Fixture", "instant", "choose one \u2014\n\u2022 destroy target vehicle.\n\u2022 this spell deals 6 damage to target creature or planeswalker.", 3, ["R"]);
    assertEqual(removalKind(modal), "hard");
    const fighter = buCard("Fight Fixture", "sorcery", "choose one \u2014\n\u2022 target creature you control fights target creature an opponent controls.\n\u2022 destroy target vehicle.", 2, ["G"]);
    assertTrue(removalKind(fighter) !== "conditional");
    const exileAny = buCard("Swords Fixture", "instant", "exile target creature.", 1, ["W"]);
    assertEqual(removalKind(exileAny), "hard");
  },

  "bottomUpRole: an exile-up-to-one-target permanent on entering is removal": () => {
    const iceberg = buCard("Iceberg Fixture", "enchantment", "flash\nwhen this enchantment enters, exile up to one other target nonland permanent until this enchantment leaves the battlefield.", 3, ["W"]);
    assertEqual(bottomUpRole(iceberg), "removal");
    assertEqual(removalKind(iceberg), "hard");
    const mountainKing = buCard("Mountain Fixture", "enchantment", "when this enchantment enters, for each opponent, exile up to one target nonland permanent that player controls until this enchantment leaves the battlefield.\nwhen this enchantment enters, recruit. (draw a card, then discard a card. if you discarded a nonland card, create a 1/1 white human soldier creature token.)", 4, ["W"]);
    assertEqual(bottomUpRole(mountainKing), "removal");
    // exiling your own creature (blink) and a graveyard card answer nothing
    const blink = buCard("Blink Fixture", "creature \u2014 spirit", "when this creature enters, exile up to one other target creature you control, then return it to the battlefield.\ndraw a card.", 3, ["W"]);
    assertTrue(bottomUpRole(blink) !== "removal");
    const yard = buCard("Yard Fixture", "creature \u2014 spirit", "when this creature enters, exile up to one target card from a graveyard.", 2, ["B"]);
    assertTrue(bottomUpRole(yard) !== "removal");
  },

  "rebuildKind: token makers, boosts for the tribe and mass recursion rebuild a board; spot effects do not": () => {
    const soldiers = { kind: "tribal", tag: "soldiers", label: "Soldiers", tribe: "soldier" };
    const kind = (card) => rebuildKind(card, soldiers);
    assertEqual(kind(buCard("Raise Fixture", "instant", "create two 1/1 white soldier creature tokens.", 2, ["W"])), "tokens");
    assertEqual(kind(buCard("Recruit Fixture", "creature \u2014 human soldier", "when this creature enters, recruit. (draw a card, then discard a card. if you discarded a nonland card, create a 1/1 white human soldier creature token.)", 3, ["W"])), "tokens");
    assertEqual(kind(buCard("Anthem Fixture", "enchantment", "creatures you control get +1/+1.", 3, ["W"])), "boost");
    assertEqual(kind(buCard("Lord Fixture", "creature \u2014 human soldier", "other soldier creatures you control get +1/+1.", 3, ["W"])), "boost");
    assertEqual(kind(buCard("Counters Fixture", "sorcery", "put a +1/+1 counter on each creature you control.", 4, ["W"])), "boost");
    assertEqual(kind(buCard("Mass Return Fixture", "sorcery", "return up to three target creature cards from your graveyard to the battlefield.", 6, ["W"])), "recursion");
    // not rebuild: a Treasure or Clue, a single creature pumped, one creature returned from the graveyard to hand
    assertEqual(kind(buCard("Treasure Fixture", "sorcery", "create a treasure token. (it's an artifact with \"{t}, sacrifice this artifact: add one mana of any color.\")", 2, ["R"])), "");
    assertEqual(kind(buCard("Trick Fixture", "instant", "target creature gets +2/+2 until end of turn.", 1, ["W"])), "");
    assertEqual(kind(buCard("Raise Dead Fixture", "sorcery", "return target creature card from your graveyard to your hand.", 1, ["B"])), "");
    // a token handed to the target's controller is the opponent's rebuild, not yours
    assertEqual(kind(buCard("Gift Fixture", "instant", "destroy target permanent. its controller creates a 3/3 green elephant creature token.", 3, ["W"])), "");
    assertEqual(kind(buCard("Vanilla Fixture", "creature \u2014 human soldier", "", 2, ["W"])), "");
    // a boost aimed at another tribe is not a rebuild for this one
    assertEqual(kind(buCard("Elf Lord Fixture", "creature \u2014 elf", "other elf creatures you control get +1/+1.", 3, ["G"])), "");
    assertEqual(rebuildKind(buCard("Anthem Fixture", "enchantment", "creatures you control get +1/+1.", 3, ["W"]), null), "boost");
  },

  "protectsBoard: indestructible, hexproof or protection for your creatures survives a wipe": () => {
    assertTrue(protectsBoard(buCard("Formation Fixture", "instant", "creatures you control gain indestructible until end of turn.", 3, ["W"])));
    assertTrue(protectsBoard(buCard("Cloak Fixture", "instant", "creatures you control gain hexproof and indestructible until end of turn.", 3, ["G"])));
    assertTrue(!protectsBoard(buCard("Single Fixture", "instant", "target creature gains indestructible until end of turn.", 1, ["W"])));
    assertTrue(!protectsBoard(buCard("Wipe Fixture", "sorcery", "destroy all creatures.", 4, ["B"])));
  },

  "bottomUpLandCount: aggro runs one land fewer than the colors' baseline, control one more, clamped to 35-38": () => {
    assertEqual(bottomUpLandCount("midrange", ["U", "B"]), 37);
    assertEqual(bottomUpLandCount("aggro", ["U", "B"]), 36);
    assertEqual(bottomUpLandCount("control", ["U", "B"]), 38);
    assertEqual(bottomUpLandCount("aggro", ["W"]), 35);
    assertEqual(bottomUpLandCount("control", ["W"]), 37);
    assertEqual(bottomUpLandCount("control", ["W", "U", "B"]), 38);
    assertEqual(bottomUpLandCount("aggro", ["W", "U", "B"]), 37);
    assertEqual(bottomUpLandCount("midrange", ["W", "U", "B", "R", "G"]), 38);
    assertEqual(bottomUpLandCount("nonsense", ["W", "U"]), 37);
  },

  "bottomUpRole: damage at any target, shrink spells, creature bounce and tucking are removal": () => {
    const role = (type, text) => bottomUpRole(buCard("Fixture", type, text, 3, ["R"]));
    // burn: two or more damage at any target or a creature
    assertEqual(role("instant", "this spell deals 3 damage to any target. you gain 3 life."), "removal");
    assertEqual(role("sorcery", "this spell deals x damage to target creature or planeswalker."), "removal");
    assertEqual(role("creature \u2014 goblin", "when this creature enters, it deals 2 damage to any target."), "removal");
    assertTrue(role("creature \u2014 elemental", "whenever a land you control enters, this creature deals 1 damage to any target.") !== "removal");
    assertTrue(role("instant", "this spell deals 3 damage to target opponent.") !== "removal");
    // shrink: -2/-2 or worse on one creature
    assertEqual(role("creature \u2014 insect", "flash\nwhen this creature enters, target creature an opponent controls gets -2/-2 until end of turn."), "removal");
    assertEqual(role("instant", "target creature gets -x/-x until end of turn."), "removal");
    assertTrue(role("creature \u2014 human", "when this creature enters, you may pay 2 life. when you do, target creature gets -1/-1 until end of turn.") !== "removal");
    assertTrue(role("instant", "target creature you control gets +2/-2 until end of turn.") !== "removal");
    // bounce an opposing creature, not your own blink
    assertEqual(role("creature \u2014 merfolk", "when this creature enters, return target creature an opponent controls to its owner's hand."), "removal");
    assertEqual(role("instant", "return target creature or vehicle to its owner's hand."), "removal");
    assertTrue(role("instant", "return target creature you control to its owner's hand. draw a card.") !== "removal");
    // tuck
    assertEqual(role("instant", "put target attacking creature on the bottom of its owner's library. its controller gains life equal to its toughness."), "removal");
    assertEqual(removalKind(buCard("Tuck Fixture", "instant", "put target creature into its owner's library second from the top.", 3, ["U"])), "hard");
  },

  "bottomUpRole: blinking a creature and tucking a graveyard card are not removal": () => {
    const role = (type, text) => bottomUpRole(buCard("Fixture", type, text, 3, ["W"]));
    assertTrue(role("instant", "exile target creature you control, then return that card to the battlefield under its owner's control.") !== "removal");
    assertTrue(role("instant", "exile target creature or enchantment, then return it to the battlefield under its owner's control.") !== "removal");
    assertTrue(role("instant", "exile target creature. at the beginning of the next end step, return that card to the battlefield under its owner's control.") !== "removal");
    assertTrue(role("artifact", "{2}: put target card from a graveyard on the bottom of its owner's library. activate only as a sorcery.") !== "removal");
    assertTrue(role("creature \u2014 soldier", "flash\nwhen this creature enters, you may exile target historic permanent you control. if you do, return it to the battlefield under its owner's control.") !== "removal");
    // returning your own permanent to hand is not removal
    assertTrue(role("instant", "return target permanent you control to its owner's hand.") !== "removal");
    assertTrue(role("artifact", "{u}, {t}, discard a card: return target permanent you control to its owner's hand.") !== "removal");
    // real removal beside those shapes still reads as removal
    assertEqual(role("instant", "exile target creature."), "removal");
    assertEqual(role("creature \u2014 spirit", "when this creature enters, exile target creature an opponent controls until this creature leaves the battlefield."), "removal");
  },

  "annotateBottomUpCard: a card with no type or text does not throw": () => {
    const a = annotateBottomUpCard({ name: "Blank" }, BU_ZOMBIE);
    assertEqual(a.standing, "none");
  },

  "scaleSlots: scales role counts to the nonland slot count": () => {
    const scaled = scaleSlots(ARCHETYPES.control.slots, 62);
    assertEqual(scaled.creature, 14);
    assertEqual(scaleSlots(ARCHETYPES.control.slots, 31).creature, 7);
  }
});
