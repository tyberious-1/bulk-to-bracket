function tCard(name, type, text, cmc, colors) {
  return { name, type, text, cmc: cmc || 0, colors: colors || [], rarity: "common", manaCost: "" };
}

// A pool that knows the subtypes and types the fixtures name.
const T_POOL = [
  tCard("Pool Wizard", "creature — human wizard", "", 2, ["U"]),
  tCard("Pool Insect", "creature — insect", "", 2, ["G"]),
  tCard("Pool Vehicle", "artifact — vehicle", "crew 2", 3, []),
  tCard("Pool Blood", "artifact — blood", "", 0, []),
  tCard("Pool Snake", "creature — snake", "", 2, ["G"]),
  tCard("Pool Bear", "creature — bear", "", 2, ["G"])
];
const T_VOCAB = buildTermVocab(T_POOL);
const termsOf = (card) => getCardTerms(card, T_VOCAB);
const hasClause = (card, ...terms) => termsOf(card).clauses.some((cl) => terms.every((t) => cl.has(t)));

runSuite("terms", {
  "needs come from conditions: if you control, for each, X spells you cast, a trigger's spell kind": () => {
    assertTrue(hasClause(tCard("Bolt Caster", "instant", "this spell costs {2} less to cast if you control a wizard.\nit deals 3 damage to any target."), "wizard"), "if you control");
    assertTrue(hasClause(tCard("Counter Cat", "creature — bear", "when this creature enters, draw a card for each wizard you control."), "wizard"), "for each");
    assertTrue(hasClause(tCard("Discount Idol", "artifact", "wizard spells you cast cost {1} less to cast."), "wizard"), "spells you cast");
    const watcher = tCard("Cast Watcher", "creature — human wizard", "whenever you cast an instant or sorcery spell, creatures you control get +1/+0 until end of turn.");
    assertTrue(hasClause(watcher, "instant", "sorcery"), "instant and sorcery are one clause");
  },

  "needs never come from an effect target, except graveyard return and library search": () => {
    assertEqual(termsOf(tCard("Rust Wave", "instant", "destroy target artifact or enchantment.")).clauses.length, 0);
    assertTrue(hasClause(tCard("Grave Caller", "sorcery", "return target creature card from your graveyard to the battlefield."), "creature"));
    assertTrue(hasClause(tCard("Road Finder", "sorcery", "search your library for a vehicle card, reveal it, put it into your hand."), "vehicle"));
  },

  "opponent scope, self triggers and non-X give no need; this-or-another does": () => {
    assertEqual(termsOf(tCard("Tax Collector", "enchantment", "whenever an opponent casts a spell, you draw a card.")).clauses.length, 0);
    assertEqual(termsOf(tCard("Greeter", "creature — bear", "when this creature enters, draw a card.")).clauses.length, 0);
    assertTrue(hasClause(tCard("Twin Forge", "artifact", "whenever this artifact or another artifact you control enters, put a charge counter on this artifact."), "artifact"));
    assertEqual(termsOf(tCard("Culler", "instant", "destroy target non-wizard creature.")).clauses.length, 0);
  },

  "keywords make the counters their reminder text names; proliferate needs counters": () => {
    const vocab = buildTermVocab(T_POOL.concat([tCard("Venom Fang", "creature — snake", "infect (this creature deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters.)")]));
    const fang = getCardTerms(tCard("Venom Fang", "creature — snake", "infect (this creature deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters.)"), vocab);
    for (const t of ["infect", "poison counter", "-1/-1 counter", "counter"]) assertTrue(fang.makes.has(t), "makes " + t);
    assertTrue(hasClause(tCard("Spread Seed", "artifact", "{4}, {t}: proliferate. (choose any number of permanents and/or players, then give each another counter of each kind already there.)"), "counter"));
    assertTrue(termsOf(tCard("Spread Seed", "artifact", "{4}, {t}: proliferate.")).makes.has("counter"), "proliferate creates counters, so it makes them too");
  },

  "token wording: a sacrifice of a Blood token is not a token-creation need": () => {
    assertTrue(!hasClause(tCard("Blood Sipper", "creature — snake", "whenever you sacrifice a blood token, you gain 1 life."), "ev:token"), "no token need");
    assertTrue(hasClause(tCard("Blood Sipper", "creature — snake", "whenever you sacrifice a blood token, you gain 1 life."), "ev:sacrifice"), "sacrifice need");
    assertTrue(hasClause(tCard("Token Fan", "enchantment", "whenever you create a token, draw a card."), "ev:token"), "creating a token is a token need");
  },

  "a union like noncreature is one clause, not one per type": () => {
    const card = tCard("Odd Fan", "creature — bear", "whenever you cast a noncreature spell, create a 1/1 white spirit creature token.");
    const withUnion = termsOf(card).clauses.filter((cl) => cl.has("artifact") && cl.has("enchantment") && cl.has("instant") && cl.has("sorcery"));
    assertEqual(withUnion.length, 1);
    assertEqual(termsOf(card).clauses.filter((cl) => cl.has("artifact")).length, 1);
  },

  "makes: types, subtypes, enters-trigger creatures; ev:dies only from sacrifice outlets and edicts": () => {
    const bear = termsOf(tCard("Entry Bear", "creature — bear", "when this creature enters, draw a card."));
    assertTrue(bear.makes.has("creature") && bear.makes.has("bear") && bear.makes.has("ev:enter-trigger") && bear.makes.has("ev:draw"));
    assertTrue(!termsOf(tCard("Plain Murder", "instant", "destroy target creature.")).makes.has("ev:dies"), "removal is not a death supplier");
    assertTrue(termsOf(tCard("Cruel Outlet", "artifact", "{1}, sacrifice another creature: draw a card.")).makes.has("ev:dies"), "an outlet is");
    assertTrue(termsOf(tCard("Plain Edict", "sorcery", "each opponent sacrifices a creature.")).makes.has("ev:dies"), "an edict is");
  },

  "blink needs creatures that have enters triggers": () => {
    assertTrue(hasClause(tCard("Flicker Mage", "sorcery", "exile target creature you control, then return it to the battlefield under your control."), "ev:enter-trigger"));
  },

  "vanilla and double-faced cards do not crash": () => {
    const vanilla = termsOf(tCard("Vanilla Bear", "creature — bear", ""));
    assertEqual(vanilla.clauses.length, 0);
    assertTrue(vanilla.makes.has("bear"));
    const dfc = { ...tCard("Moon Front // Moon Back", "creature — human werewolf", "when this creature enters, draw a card.", 2, ["R"]), raw: { card_faces: [{ name: "Moon Front" }, { name: "Moon Back" }] } };
    assertTrue(termsOf(dfc).makes.has("creature"));
  },

  "clauseWeight: rare clauses count, common ones do not, and a small pool counts nothing": () => {
    const big = [];
    for (let i = 0; i < 150; i++) big.push(tCard("Rock " + i, "artifact", "", 1));
    for (let i = 0; i < 3; i++) big.push(tCard("Mage " + i, "creature — human wizard", "", 2));
    for (let i = 0; i < 147; i++) big.push(tCard("Spell " + i, "sorcery", "", 2));
    const vocab = buildTermVocab(big);
    const supply = createTermSupply(big, vocab);
    assertEqual(supply.size, 300);
    assertTrue(supply.isCounted(new Set(["wizard"])), "3 of 300 make wizard");
    assertTrue(!supply.isCounted(new Set(["artifact"])), "150 of 300 make artifact");
    assertEqual(supply.suppliers(new Set(["artifact", "wizard"])), 153);
    const small = createTermSupply(big.slice(0, 100), vocab);
    assertTrue(!small.isCounted(new Set(["wizard"])), "a pool under 200 counts no clause");
  },

  "cardMakesAny: a card that makes any term in the clause": () => {
    const wizard = tCard("Pool Wizard 2", "creature — human wizard", "", 2, ["U"]);
    assertTrue(cardMakesAny(wizard, new Set(["wizard", "insect"]), T_VOCAB));
    assertTrue(!cardMakesAny(wizard, new Set(["insect", "vehicle"]), T_VOCAB));
  }
});
