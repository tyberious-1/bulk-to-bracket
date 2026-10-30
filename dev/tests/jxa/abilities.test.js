runSuite("abilities", {
  "getCardAbilities reads an app card ability by ability": function () {
    const bag = {
      name: "Bag of Holding", type: "artifact",
      text: "whenever you discard a card, exile that card from your graveyard.\n{2}, {t}: draw a card, then discard a card."
    };
    const abs = getCardAbilities(bag);
    assertEqual(abs.length, 2);
    assertEqual(abs[0].kind, "triggered");
    assertEqual(abs[0].trigger, ["discard-event"]);
    assertEqual(abs[0].effects[0].label, "exile-from-graveyard");
    assertEqual(abs[0].effects[0].kind, "that-card");
    assertEqual(abs[1].kind, "activated");
    assertEqual(abs[1].cost, ["mana", "tap"]);
    assertTrue(abs[1].effects.some((e) => e.label === "loot"), "loot effect");
  },
  "a generic mana symbol keeps its amount so mana can be counted": function () {
    const ab = getCardAbilities({ name: "Test Engine", type: "artifact", text: "{3}{u}, {t}: draw a card." })[0];
    assertEqual(getAbilityManaCost(ab), 4);
    const free = getCardAbilities({ name: "Test Free", type: "artifact", text: "{t}: add one mana of any color." })[0];
    assertEqual(getAbilityManaCost(free), 0);
  },
  "the card's own name, with or without its title, becomes a tilde": function () {
    const line = getCardAbilities({ name: "Greasefang, Okiba Boss", type: "legendary creature — rat", text: "whenever greasefang attacks, draw a card." })[0].line;
    assertEqual(line, "whenever ~ attacks, draw a card.");
    const apostrophe = getCardAbilities({ name: "Gaea's Cradle", type: "land", text: "{t}: add {g} for each creature you control. gaea's cradle is a land." })[0].line;
    assertTrue(apostrophe.indexOf("gaea") === -1, "apostrophe name replaced");
  },
  "a two-faced card is read face by face, each face's own name becoming a tilde": function () {
    const card = {
      name: "Front Face // Back Side", type: "creature // creature", text: "front face deals 2 damage to any target.\nback side gains flying.",
      raw: { card_faces: [
        { name: "Front Face", oracle_text: "Front Face deals 2 damage to any target." },
        { name: "Back Side", oracle_text: "Back Side gains flying." }
      ] }
    };
    assertEqual(getCardAbilities(card).map((a) => a.line), ["~ deals 2 damage to any target.", "~ gains flying."]);
  },
  "empty, missing and undefined text never throw": function () {
    assertEqual(getCardAbilities({ name: "Vanilla", type: "creature", text: "" }), []);
    assertEqual(getCardAbilities({ name: "No text field", type: "creature" }), []);
    assertEqual(getCardAbilities(null), []);
    assertEqual(tagTextAbilities(undefined, "x"), []);
  },
  "the cache is keyed by name and text, so same-named cards stay apart": function () {
    const a = getCardAbilities({ name: "Same Name", type: "sorcery", text: "mill three cards." });
    const b = getCardAbilities({ name: "Same Name", type: "sorcery", text: "draw two cards." });
    assertEqual(a[0].effects.map((e) => e.label), ["mill-self"]);
    assertEqual(b[0].effects.map((e) => e.label), ["draw"]);
    assertTrue(getCardAbilities({ name: "Same Name", type: "sorcery", text: "mill three cards." }) === a, "same card returns the cached list");
  },
  "an instant or sorcery's lines are marked as spells": function () {
    assertEqual(getCardAbilities({ name: "Spell", type: "instant", text: "mill three cards." })[0].kind, "spell");
    assertEqual(getCardAbilities({ name: "Permanent", type: "artifact", text: "mill three cards." })[0].kind, "static");
  },
  "tagTextAbilities reads a bare commander text": function () {
    const abs = tagTextAbilities("at the beginning of combat on your turn, return target vehicle card from your graveyard to the battlefield.", "");
    const ret = abs[0].effects.find((e) => e.label === "return-from-graveyard");
    assertEqual(ret.object, "vehicle");
    assertEqual(ret.from, "your");
    assertEqual(ret.to, "battlefield");
  }
  ,
  "a Pilot-token maker counts as a crew helper": function () {
    const card = { name: "Pilot Maker", type: "enchantment — aura", text: "when this aura enters, create a 1/1 colorless pilot creature token with \"this token crews vehicles as though its power were 2 greater.\"" };
    assertTrue(getCardAbilities(card)[0].effects.some((e) => e.label === "crew-helper"));
  },
  "a land becoming tapped is not a creature tap trigger": function () {
    const land = getCardAbilities({ name: "Curse", type: "enchantment — aura", text: "whenever enchanted land becomes tapped, its controller loses 2 life." })[0];
    assertTrue(land.trigger.indexOf("becomes-tapped") === -1, "land tap is not a crew-style tap");
    const creature = getCardAbilities({ name: "Tapper", type: "enchantment", text: "whenever a creature you control becomes tapped, draw a card." })[0];
    assertEqual(creature.trigger, ["becomes-tapped"]);
    const mana = getCardAbilities({ name: "Mana Tap", type: "enchantment", text: "whenever a permanent you control becomes tapped for mana, draw a card." })[0];
    assertTrue(mana.trigger.indexOf("becomes-tapped") === -1, "tapped for mana is excluded");
  },
  "destroying or unattaching attachments is hose-attachment, attaching is attach-effect": function () {
    const label = (text) => getCardAbilities({ name: "T", type: "creature", text: text })[0].effects.map((e) => e.label);
    assertTrue(label("whenever this creature attacks, destroy all auras attached to target land.").indexOf("hose-attachment") !== -1, "Street Sweeper");
    assertTrue(label("whenever this creature attacks, destroy all auras attached to target land.").indexOf("attach-effect") === -1);
    assertTrue(label("unattach all equipment from target creature.").indexOf("hose-attachment") !== -1, "Disarm");
    assertTrue(label("choose target creature you control and target equipment. gain control of that equipment until end of turn. attach it to the chosen creature.").indexOf("attach-effect") !== -1, "Stolen Uniform");
    assertTrue(label("attach target aura attached to a creature or land to another permanent of that type.").indexOf("attach-effect") !== -1, "Enchantment Alteration");
  },
  "hasAttachmentSignal ignores attachment hosers but keeps attachment payoffs": function () {
    const sig = (text) => hasAttachmentSignal({ name: "Test Card", type: "creature", text: text });
    assertTrue(!sig("whenever this creature attacks, destroy all auras attached to target land."), "Street Sweeper");
    assertTrue(!sig("unattach all equipment from target creature."), "Disarm");
    assertTrue(!sig("destroy all equipment attached to that creature."), "Blastfire Bolt shape");
    assertTrue(sig("attach target aura attached to a creature or land to another permanent of that type."), "Enchantment Alteration");
    assertTrue(sig("whenever an aura becomes attached to this creature, create a 2/2 red dragon creature token with flying."), "Brood Keeper");
    assertTrue(sig("this creature gets +2/+2 for each aura and equipment attached to it."), "Champion of the Flame");
  },
  "isOneShotAbility: spells, enters and dies triggers, and self-sacrifice are one-shot": function () {
    const one = (text, type) => isOneShotAbility(getCardAbilities({ name: "Test Card", type: type, text: text })[0]);
    assertTrue(one("mill three cards.", "sorcery"), "spell");
    assertTrue(one("when this creature enters, discard a card.", "creature"), "enters");
    assertTrue(one("when this creature dies, each opponent loses 1 life.", "creature"), "dies");
    assertTrue(one("{2}{b}, sacrifice this creature: mill four cards.", "creature"), "sacrifice self");
    assertTrue(!one("whenever this creature attacks, discard a card.", "creature"), "attack trigger repeats");
    assertTrue(!one("{3}, {t}: draw a card, then discard a card.", "artifact"), "tap ability repeats");
  }
  ,
  "landfall: a land you control entering is a landfall trigger": function () {
    const omnath = getCardAbilities({ name: "Omnath, Locus of Rage", type: "legendary creature — elemental", text: "landfall — whenever a land you control enters, create a 5/5 red and green elemental creature token." })[0];
    assertTrue(omnath.trigger.indexOf("landfall") !== -1, "landfall label");
    assertTrue(!isOneShotAbility(omnath), "a landfall trigger repeats");
    const plain = getCardAbilities({ name: "Plain", type: "creature", text: "when this creature enters, draw a card." })[0];
    assertTrue(plain.trigger.indexOf("landfall") === -1);
  },
  "an ability that hands out a quoted ability tags the quote separately": function () {
    const kuja = getCardAbilities({ name: "Kuja, Genome Sorcerer", type: "legendary creature — human wizard", text: "at the beginning of your end step, create a tapped 0/1 black wizard creature token with \"whenever you cast a noncreature spell, this creature deals 1 damage to each opponent.\"" })[0];
    assertEqual(kuja.quoted.length, 1);
    assertTrue(kuja.quoted[0].trigger.indexOf("cast-noncreature") !== -1, "the token's trigger");
    assertEqual(getCardAbilities({ name: "No Quote", type: "sorcery", text: "draw a card." })[0].quoted, []);
  },
  "trigger qualifiers: second card, second spell, noncreature spell, counter put on": function () {
    const trig = (text) => getCardAbilities({ name: "T", type: "creature", text: text })[0].trigger;
    assertTrue(trig("whenever a player draws their second card during their turn, you draw a card.").indexOf("draw-second") !== -1, "Council draw");
    assertTrue(trig("whenever a player casts their second spell during their turn, you create a 2/2 white knight creature token.").indexOf("cast-second") !== -1, "Council cast");
    assertTrue(trig("whenever you draw a card, put a +1/+1 counter on this creature.").indexOf("draw-second") === -1, "plain draw is not second");
    assertTrue(trig("whenever one or more +1/+1 counters are put on this creature, add one mana of any color.").indexOf("counter-placed") !== -1, "Berta");
    assertTrue(trig("whenever you cast a creature spell, draw a card.").indexOf("cast-noncreature") === -1, "creature spell is not noncreature");
  },
  "increment is a keyword ability": function () {
    const ab = getCardAbilities({ name: "Berta", type: "legendary creature — frog druid", text: "increment (whenever you cast a spell, if the amount of mana you spent is greater than this creature's power or toughness, put a +1/+1 counter on this creature.)" })[0];
    assertEqual(ab.kind, "keyword");
    assertEqual(ab.effects[0].label, "keyword:increment");
  },
  "a devotion condition carries its colors": function () {
    const klothys = getCardAbilities({ name: "Klothys", type: "legendary enchantment creature — god", text: "as long as your devotion to red and green is less than seven, this permanent isn't a creature." })[0];
    assertEqual(klothys.effects.find((e) => e.label === "devotion-condition").colors, ["red", "green"]);
    const one = getCardAbilities({ name: "One", type: "enchantment", text: "as long as your devotion to blue is five or more, draw a card each upkeep." })[0];
    assertEqual(one.effects.find((e) => e.label === "devotion-condition").colors, ["blue"]);
  }
  ,
  "land-to-battlefield: fetch, ramp and extra land drops, but not other tutors": function () {
    const has = (text) => getCardAbilities({ name: "T", type: "sorcery", text: text })[0].effects.some((e) => e.label === "land-to-battlefield");
    assertTrue(has("search your library for a basic land card, put that card onto the battlefield tapped, then shuffle."), "Rampant Growth");
    assertTrue(has("you may put a land card from your hand onto the battlefield."), "Oracle of Mul Daya shape");
    assertTrue(has("you may play an additional land this turn."), "Explore shape");
    assertTrue(!has("search your library for a creature card, reveal it, put it into your hand."), "creature tutor");
    assertTrue(!has("search your library for a basic land card, reveal it, put it into your hand."), "land to hand is not the battlefield");
  },
  "a card's own name only becomes a tilde as a whole word": function () {
    const ab = getCardAbilities({ name: "Flash", type: "instant", text: "deal 3 damage to any target.\nflashback {4}{r}" });
    assertEqual(ab[1].effects[0].label, "keyword:flashback");
    assertEqual(getCardAbilities({ name: "Bolt", type: "instant", text: "bolt deals 3 damage to any target." })[0].line, "~ deals 3 damage to any target.");
  }
  ,
  "counters carry their kind: +1/+1 or another kind": function () {
    const kind = (text) => getCardAbilities({ name: "T", type: "sorcery", text: text })[0].effects.find((e) => e.label === "counters").counter;
    assertEqual(kind("put a +1/+1 counter on target creature."), "+1/+1");
    assertEqual(kind("put a first strike counter on target creature."), "other");
    assertEqual(kind("this artifact enters with a charge counter on it."), "other");
  }
});
