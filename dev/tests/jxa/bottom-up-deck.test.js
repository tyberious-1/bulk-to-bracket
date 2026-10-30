
function budCard(name, type, text, cmc, colors, rarity) {
  return { name, type, text, cmc, colors: colors || ["B"], rarity: rarity || "common", manaCost: "" };
}

// A pool with every role, three creature tiers, and some off-color cards.
function budPool(options) {
  const opts = options || {};
  const pool = [];
  for (let i = 0; i < 40; i += 1) pool.push(budCard(`Zombie ${i}`, "creature — zombie", "", 1 + (i % 5), ["B"]));
  for (let i = 0; i < 12; i += 1) pool.push(budCard(`Bear ${i}`, "creature — bear", "", 2 + (i % 3), ["B"]));
  for (let i = 0; i < 20; i += 1) pool.push(budCard(`Kill ${i}`, "instant", "destroy target creature.", 2 + (i % 3), ["B"]));
  for (let i = 0; i < 20; i += 1) pool.push(budCard(`Study ${i}`, "sorcery", "draw two cards.", 2 + (i % 3), ["B"]));
  for (let i = 0; i < 12; i += 1) pool.push(budCard(`Rock ${i}`, "artifact", "{t}: add {c}.", 2, []));
  if (!opts.noWipes) for (let i = 0; i < 6; i += 1) pool.push(budCard(`Wrath ${i}`, "sorcery", "destroy all creatures.", 4 + (i % 2), ["B"]));
  for (let i = 0; i < 20; i += 1) pool.push(budCard(`Filler ${i}`, "enchantment", "", 3, ["B"]));
  for (let i = 0; i < 10; i += 1) pool.push(budCard(`Red ${i}`, "instant", "destroy target creature.", 2, ["R"]));
  return pool;
}


// budPool plus blue counterspells. mono: only blue cards (and colorless rocks), for a one-color build.
function budBluePool(mono, hard, soft) {
  let pool;
  if (mono) {
    pool = [];
    for (let i = 0; i < 40; i += 1) pool.push(budCard(`Drake ${i}`, "creature — drake", "", 1 + (i % 5), ["U"]));
    for (let i = 0; i < 20; i += 1) pool.push(budCard(`Study ${i}`, "sorcery", "draw two cards.", 2 + (i % 3), ["U"]));
    for (let i = 0; i < 12; i += 1) pool.push(budCard(`Rock ${i}`, "artifact", "{t}: add {c}.", 2, []));
    for (let i = 0; i < 15; i += 1) pool.push(budCard(`Bounce ${i}`, "instant", "return target creature to its owner's hand.", 2 + (i % 3), ["U"]));
    for (let i = 0; i < 20; i += 1) pool.push(budCard(`Filler ${i}`, "enchantment", "", 3, ["U"]));
  } else {
    pool = budPool();
  }
  for (let i = 0; i < hard; i += 1) pool.push(budCard(`Counter ${i}`, "instant", "counter target spell.", 2 + (i % 3), ["U"]));
  for (let i = 0; i < soft; i += 1) pool.push(budCard(`Soft Counter ${i}`, "instant", "counter target spell unless its controller pays {2}.", 2 + (i % 3), ["U"]));
  return pool;
}

const BUD_ZOMBIE = { kind: "tribal", tag: "zombies", label: "Zombies", tribe: "zombie" };
function budBuild(archetype, pool, subtype) {
  return buildDeckBottomUp(pool || budPool(), { archetype, subtype: subtype || BUD_ZOMBIE, colors: ["B"] });
}

// budPool plus a token theme: 30 token makers (members), `payoffs` cards that need soldiers, and padding to 200+ nonland cards.
function budThemePool(payoffs, pad) {
  const pool = budPool();
  for (let i = 0; i < (pad === undefined ? 60 : pad); i += 1) pool.push(budCard(`Pad ${i}`, "enchantment", "", 3, ["B"]));
  for (let i = 0; i < 30; i += 1) pool.push(budCard(`Muster ${i}`, "sorcery", "create two 1/1 white soldier creature tokens.", 3, ["B"]));
  // The vocabulary learns "soldier" from a type line, as it would from a real collection.
  for (let i = 0; i < 3; i += 1) pool.push(budCard(`Recruit ${i}`, "creature — soldier", "", 2, ["B"]));
  for (let i = 0; i < payoffs; i += 1) pool.push(budCard(`Banner ${i}`, "enchantment", "whenever a soldier you control attacks, you gain 1 life.", 3, ["B"]));
  return pool;
}
const BUD_TOKENS = { kind: "theme", tag: "tokens", label: "Tokens" };
const budThemeBuild = (pool, extra) => buildDeckBottomUp(pool, { archetype: "midrange", subtype: BUD_TOKENS, colors: ["B"], ...(extra || {}) });

runSuite("bottom-up-deck", {
  "reservation: a theme plan with 8 owned payoffs gets at least 5": () => {
    const pool = budThemePool(8);
    const on = budThemeBuild(pool).report;
    const off = budThemeBuild(pool, { payoffMin: 0 }).report;
    assertTrue(on.payoffCards >= 5, "payoff cards: " + on.payoffCards + " (without the step: " + off.payoffCards + ")");
    assertEqual(on.roleCounts, off.roleCounts);
    assertEqual(on.payoffReservation.minimum, 5);
    assertTrue(on.payoffReservation.available >= 8);
  },

  "reservation: fewer owned payoffs than the minimum reports it and pads nothing": () => {
    const pool = budThemePool(2);
    const r = budThemeBuild(pool);
    assertEqual(r.report.payoffReservation.minimum, 5);
    assertEqual(r.report.payoffReservation.available, 2);
    assertTrue(r.report.payoffCards >= 2 && r.report.payoffCards <= 2 + 3, "no padding: " + r.report.payoffCards);
    assertEqual(r.deck.length, r.report.nonlandSlots);
  },

  "reservation: a tribal build is unchanged when its payoffs already meet the minimum": () => {
    const pool = budPool();
    for (let i = 0; i < 6; i += 1) pool.push(budCard(`Lord ${i}`, "enchantment", "other zombies you control get +1/+1.", 3, ["B"]));
    const names = (opts) => buildDeckBottomUp(pool, { archetype: "midrange", subtype: BUD_ZOMBIE, colors: ["B"], ...opts }).deck.map((c) => c.name).sort();
    assertEqual(names({}), names({ payoffMin: 0 }));
  },

  "reservation: a pool under 200 cards changes nothing": () => {
    const pool = budPool();
    for (let i = 0; i < 8; i += 1) pool.push(budCard(`Banner ${i}`, "enchantment", "whenever a soldier you control attacks, you gain 1 life.", 3, ["B"]));
    for (let i = 0; i < 30; i += 1) pool.push(budCard(`Muster ${i}`, "sorcery", "create two 1/1 white soldier creature tokens.", 3, ["B"]));
    pool.push(budCard("Recruit", "creature — soldier", "", 2, ["B"]));
    assertTrue(pool.length < 200, "pool " + pool.length);
    const names = (opts) => budThemeBuild(pool, opts).deck.map((c) => c.name).sort();
    assertEqual(names({}), names({ payoffMin: 0 }));
  },

  "fixtures read as the roles they claim": () => {
    assertEqual(bottomUpRole(budCard("k", "instant", "destroy target creature.", 2)), "removal");
    assertEqual(bottomUpRole(budCard("d", "sorcery", "draw two cards.", 2)), "draw");
    assertEqual(bottomUpRole(budCard("r", "artifact", "{t}: add {c}.", 2, [])), "ramp");
    assertEqual(bottomUpRole(budCard("w", "sorcery", "destroy all creatures.", 4)), "wipe");
  },

  "role overflow: slots left over take real support a little past its role cap, never a wipe, before no-signal filler": () => {
    const { deck, report } = budBuild("aggro");
    assertTrue(report.roleCounts.draw > report.slots.draw, "draw did not overflow: " + report.roleCounts.draw);
    assertTrue(report.roleCounts.draw <= report.slots.draw + BOTTOM_UP_ROLE_OVERFLOW, "draw overflowed too far");
    assertTrue(report.roleCounts.removal <= report.slots.removal + BOTTOM_UP_ROLE_OVERFLOW, "removal overflowed too far");
    assertEqual(report.roleCounts.wipe, 0);
    assertEqual(deck.length, 62);
  },

  "wipe floor: a tribal deck leaves out a sweeper that kills its own tribe, and reports the empty slots": () => {
    const { deck, report } = budBuild("midrange");
    assertTrue(deck.every((c) => !c.name.startsWith("Wrath")), "a symmetric wipe was taken in a tribal deck");
    assertEqual(report.roleCounts.wipe, 0);
    assertEqual(report.shortfalls.wipe, report.slots.wipe);
    const spared = budPool();
    for (let i = 0; i < 3; i += 1) spared.push(budCard(`Purge ${i}`, "sorcery", "destroy all non-zombie creatures.", 4, ["B"]));
    assertEqual(budBuild("midrange", spared).report.roleCounts.wipe, 2);
  },

  "popularity rank breaks a score tie before the alphabet, and never moves a higher score": () => {
    const ranked = (name, rank, text) => ({ ...budCard(name, "instant", text || "destroy target creature.", 2), raw: { edhrec_rank: rank } });
    const pool = budPool();
    pool.push(ranked("Aaa Obscure Kill", 90000), ranked("Zzz Popular Kill", 12));
    const { deck } = budBuild("midrange", pool);
    const names = deck.map((c) => c.name);
    assertTrue(names.includes("Zzz Popular Kill"), "the popular tie-winner was left out");
    assertEqual(popularityRank(budCard("Plain", "instant", "", 1)), BOTTOM_UP_UNRANKED);
    assertEqual(popularityRank(ranked("Ranked", 56)), 56);
  },

  "fills the nonland slots with unique, on-color cards": () => {
    const { deck, report } = budBuild("midrange");
    assertEqual(deck.length, 62);
    assertEqual(new Set(deck.map((c) => c.name)).size, 62);
    assertTrue(deck.every((c) => !c.name.startsWith("Red")), "off-color card in the deck");
    assertEqual(report.nonlandSlots, 62);
  },

  "ramp cards in the deck carry their ramp kind for the reliability read": () => {
    const pool = budPool();
    pool.push(budCard("Treasure Spell", "sorcery", "create a treasure token. (it's an artifact with \"{t}, sacrifice this artifact: add one mana of any color.\")", 2, ["B"]));
    const { deck } = budBuild("midrange", pool);
    const ramp = deck.filter((c) => c.bottomUpRole === "ramp");
    assertTrue(ramp.length > 0);
    assertTrue(ramp.every((c) => c.bottomUpRampKind === "reliable" || c.bottomUpRampKind === "oneshot"));
    assertEqual(deck.find((c) => c.name.startsWith("Rock")).bottomUpRampKind, "reliable");
    assertEqual(deck.filter((c) => c.bottomUpRole !== "ramp").every((c) => !c.bottomUpRampKind), true);
  },

  "deck entries carry what they do for a rebuild, a protected board and sparing the subtype": () => {
    const pool = [budCard("Zombie A", "creature \u2014 zombie", "", 2, ["B"]), budCard("Wrath A", "sorcery", "destroy all creatures.", 4, ["B"])];
    pool.push(budCard("Raise Fixture", "instant", "create two 1/1 black zombie creature tokens.", 2, ["B"]));
    pool.push(budCard("Shield Fixture", "instant", "creatures you control gain indestructible until end of turn.", 2, ["B"]));
    pool.push(budCard("Sweep Fixture", "sorcery", "destroy all creatures except zombies.", 4, ["B"]));
    const { deck } = budBuild("control", pool);
    const by = (name) => deck.find((c) => c.name === name);
    assertEqual(by("Raise Fixture") && by("Raise Fixture").bottomUpRebuild, "tokens");
    assertEqual(by("Shield Fixture") && by("Shield Fixture").bottomUpProtects, true);
    assertEqual(by("Sweep Fixture") && by("Sweep Fixture").bottomUpSpares, true);
    assertTrue(deck.filter((c) => c.name.startsWith("Wrath")).every((c) => !c.bottomUpSpares));
  },

  "draw cards in the deck carry their draw kind for the reliability read": () => {
    const { deck } = budBuild("control");
    const draw = deck.filter((c) => c.bottomUpRole === "draw");
    assertTrue(draw.length > 0);
    assertEqual(draw[0].bottomUpDrawKind, "pure");
    assertEqual(deck.filter((c) => c.bottomUpRole !== "draw").every((c) => !c.bottomUpDrawKind), true);
  },

  "budget inclusion breaks ties between equal scores and nothing else": () => {
    const pool = budPool();
    const plain = budBuild("midrange", pool);
    // Zombies tie on score within a mana value. Creatures stop at the typal count, so one mana value
    // is only partly in the deck: the alphabetical tie leaves some of that tier out.
    const plainNames = new Set(plain.deck.map((c) => c.name));
    const zombies = pool.filter((c) => c.name.startsWith("Zombie "));
    const tiers = [1, 2, 3, 4, 5].map((cmc) => zombies.filter((c) => c.cmc === cmc).map((c) => c.name));
    const split = tiers.find((names) => names.some((n) => plainNames.has(n)) && names.some((n) => !plainNames.has(n)));
    assertTrue(!!split, "fixture: one mana value should be partly in the deck");
    const lastOfTier = split.filter((n) => !plainNames.has(n));
    const inclusion = new Map(lastOfTier.map((n) => [n.toLowerCase(), 0.9]));
    const boosted = buildDeckBottomUp(pool, { archetype: "midrange", subtype: BUD_ZOMBIE, colors: ["B"], budgetInclusion: inclusion });
    assertEqual(boosted.deck.length, 62);
    const gained = boosted.deck.filter((c) => lastOfTier.includes(c.name) && !plainNames.has(c.name));
    assertTrue(gained.length > 0, "inclusion did not win any tie");
    // Ties only: a card that scores lower is not lifted by a high inclusion rate (bears are not members).
    const withBear = buildDeckBottomUp(pool, { archetype: "midrange", subtype: BUD_ZOMBIE, colors: ["B"], budgetInclusion: new Map([["bear 0", 1]]) });
    assertEqual(withBear.deck.map((c) => c.name).sort(), plain.deck.map((c) => c.name).sort());
  },

  "budget inclusion: the report says how many deck cards matched, and an absent map changes nothing": () => {
    const pool = budPool();
    const plain = budBuild("midrange", pool);
    assertEqual(plain.report.budget, { applied: false, matched: 0 });
    const none = buildDeckBottomUp(pool, { archetype: "midrange", subtype: BUD_ZOMBIE, colors: ["B"], budgetInclusion: new Map() });
    assertEqual(none.deck.map((c) => c.name), plain.deck.map((c) => c.name));
    assertEqual(none.report.budget, { applied: false, matched: 0 });
    const names = ["Zombie 35", "Zombie 36", "Zombie 37", "Zombie 38", "Zombie 39"];
    const some = buildDeckBottomUp(pool, { archetype: "midrange", subtype: BUD_ZOMBIE, colors: ["B"], budgetInclusion: new Map(names.map((n) => [n.toLowerCase(), 0.9])) });
    const inDeck = some.deck.filter((c) => names.includes(c.name)).length;
    assertTrue(inDeck > 0);
    assertEqual(some.report.budget, { applied: true, matched: inDeck });
  },

  "archetypes separate: aggro runs more creatures, control more removal and draw, a higher curve": () => {
    const aggro = budBuild("aggro").report;
    const control = budBuild("control").report;
    assertTrue(aggro.creatures > control.creatures, `creatures ${aggro.creatures} vs ${control.creatures}`);
    assertTrue(control.roleCounts.removal > aggro.roleCounts.removal, "removal");
    assertTrue(control.roleCounts.draw > aggro.roleCounts.draw, "draw");
    assertTrue(control.avgCmc > aggro.avgCmc, `avgCmc ${aggro.avgCmc} vs ${control.avgCmc}`);
  },

  "role counts do not exceed their caps": () => {
    const { report } = budBuild("control");
    assertTrue(report.roleCounts.removal <= ARCHETYPES.control.slots.removal);
    assertTrue(report.roleCounts.wipe <= ARCHETYPES.control.slots.wipe);
    assertTrue(report.roleCounts.ramp <= ARCHETYPES.control.slots.ramp);
  },

  "aggro takes no wipes while other cards are available": () => {
    assertEqual(budBuild("aggro").report.roleCounts.wipe, 0);
  },

  "no wipes in the pool: shortfall is reported and draw covers up to the cap": () => {
    const { report } = budBuild("control", budPool({ noWipes: true }));
    assertEqual(report.shortfalls.wipe, ARCHETYPES.control.slots.wipe);
    assertEqual(report.substitutions.length, 1);
    assertEqual(report.substitutions[0].extraDraw, BOTTOM_UP_DRAW_SUBSTITUTION_CAP);
    assertEqual(report.roleCounts.draw, ARCHETYPES.control.slots.draw + BOTTOM_UP_DRAW_SUBSTITUTION_CAP);
  },

  "a blue control build reserves its counterspell floor, and mono-blue reserves more": () => {
    const multi = buildDeckBottomUp(budBluePool(false, 20, 0), { archetype: "control", subtype: BUD_ZOMBIE, colors: ["U", "B"] });
    assertEqual(multi.report.counters.floor, 5);
    assertTrue(multi.report.counters.count >= 5);
    assertEqual(multi.report.counters.shortfall, 0);
    const mono = buildDeckBottomUp(budBluePool(true, 20, 0), { archetype: "control", subtype: BUD_ZOMBIE, colors: ["U"] });
    assertEqual(mono.report.counters.floor, 7);
    assertTrue(mono.report.counters.count >= 7);
    const mid = buildDeckBottomUp(budBluePool(false, 20, 0), { archetype: "midrange", subtype: BUD_ZOMBIE, colors: ["U", "B"] });
    assertTrue(mid.report.counters.count >= 3);
  },

  "no blue and aggro reserve nothing": () => {
    const aggro = buildDeckBottomUp(budBluePool(false, 20, 0), { archetype: "aggro", subtype: BUD_ZOMBIE, colors: ["U", "B"] });
    assertEqual(aggro.report.counters.floor, 0);
    const black = buildDeckBottomUp(budBluePool(false, 20, 0), { archetype: "control", subtype: BUD_ZOMBIE, colors: ["B"] });
    assertEqual(black.report.counters.floor, 0);
    assertEqual(black.report.counters.count, 0);
  },

  "too few counterspells: the floor is reported short and removal still fills its slots": () => {
    const r = buildDeckBottomUp(budBluePool(false, 2, 0), { archetype: "control", subtype: BUD_ZOMBIE, colors: ["U", "B"] });
    assertEqual(r.report.counters.count, 2);
    assertEqual(r.report.counters.shortfall, 3);
    assertEqual(r.report.roleCounts.removal, r.report.slots.removal);
  },

  "the counterspell floor takes hard counters before soft ones": () => {
    const r = buildDeckBottomUp(budBluePool(false, 5, 8), { archetype: "control", subtype: BUD_ZOMBIE, colors: ["U", "B"] });
    const names = r.deck.filter((c) => /^Counter/.test(c.name)).map((c) => c.name);
    for (let i = 0; i < 5; i += 1) assertTrue(names.includes(`Counter ${i}`));
  },

  "artifact and enchantment answers: reserved up to the floor, capped, and reported short when the pool has none": () => {
    const make = (answers) => {
      const pool = [];
      for (let i = 0; i < 30; i += 1) pool.push(budCard(`Knight ${i}`, "creature \u2014 human knight", "", 2 + (i % 3), ["W"]));
      for (let i = 0; i < 12; i += 1) pool.push(budCard(`Smite ${i}`, "instant", "destroy target creature.", 5, ["W"]));
      for (let i = 0; i < 12; i += 1) pool.push(budCard(`Study ${i}`, "sorcery", "draw two cards.", 3, ["W"]));
      for (let i = 0; i < 10; i += 1) pool.push(budCard(`Rock ${i}`, "artifact", "{t}: add {c}.", 2, []));
      for (let i = 0; i < 20; i += 1) pool.push(budCard(`Filler ${i}`, "enchantment", "", 3, ["W"]));
      for (let i = 0; i < answers; i += 1) pool.push(budCard(`Cleanse ${i}`, "instant", "destroy target artifact or enchantment.", 2, ["W"]));
      return pool;
    };
    const many = buildDeckBottomUp(make(10), { archetype: "midrange", subtype: null, colors: ["W"] });
    assertTrue(many.report.answers.count >= 2);
    assertTrue(many.report.answers.count <= 3);
    assertEqual(many.report.answers.shortfall, 0);
    const none = buildDeckBottomUp(make(0), { archetype: "midrange", subtype: null, colors: ["W"] });
    assertEqual(none.report.answers.count, 0);
    assertEqual(none.report.answers.shortfall, 2);
    assertTrue(none.report.roleCounts.removal >= none.report.slots.removal, "removal slots left unfilled");
    assertTrue(none.report.roleCounts.removal <= none.report.slots.removal + BOTTOM_UP_ROLE_OVERFLOW, "removal overflowed past the allowance");
    const aggro = buildDeckBottomUp(make(10), { archetype: "aggro", subtype: null, colors: ["W"] });
    assertEqual(aggro.report.answers.floor, 1);
    assertTrue(aggro.report.answers.count >= 1);
  },

  "mentions of the tribe are capped": () => {
    const pool = budPool();
    for (let i = 0; i < 30; i += 1) pool.push(budCard(`Hate ${i}`, "sorcery", "exile target zombie.", 2, ["B"]));
    const { report } = budBuild("midrange", pool);
    assertTrue(report.mentions <= BOTTOM_UP_MENTION_CAP, `mentions ${report.mentions}`);
  },

  "a thin subtype still builds a full deck and reports the generic fallback": () => {
    const pool = budPool().filter((c) => !c.name.startsWith("Zombie")).concat([budCard("Zombie Only", "creature — zombie", "", 2, ["B"])]);
    const { deck, report } = budBuild("midrange", pool);
    assertEqual(deck.length, 62);
    assertEqual(report.members, 1);
    assertTrue(report.fallbackCount > 0);
  },

  "an empty color set keeps only colorless cards": () => {
    const { deck } = buildDeckBottomUp(budPool(), { archetype: "midrange", subtype: BUD_ZOMBIE, colors: [] });
    assertTrue(deck.length > 0 && deck.every((c) => c.colors.length === 0));
  },

  "a pool smaller than the slots returns what it has": () => {
    const { deck } = buildDeckBottomUp(budPool().slice(0, 10), { archetype: "midrange", subtype: BUD_ZOMBIE, colors: ["B"] });
    assertEqual(deck.length, 10);
  },

  "bottomUpLandNeeds: a vehicle plan or a Mount tribe names its payload, nothing else does": () => {
    assertEqual(bottomUpLandNeeds({ kind: "theme", tag: "vehicles", label: "vehicles" }), { payloadType: "vehicle" });
    assertEqual(bottomUpLandNeeds({ kind: "theme", tag: "infect~vehicles", label: "x" }), { payloadType: "vehicle" });
    assertEqual(bottomUpLandNeeds({ kind: "tribal", tag: "mounts", label: "Mount", tribe: "mount" }), { payloadType: "mount" });
    assertEqual(bottomUpLandNeeds({ kind: "theme", tag: "graveyard", label: "graveyard" }), null);
    assertEqual(bottomUpLandNeeds(null), null);
  },

  "buildBottomUpManaBase: a vehicle plan keeps an owned Roads land that a plain build leaves out": () => {
    const road = { name: "Wild Roads", type: "land", text: "This land enters tapped unless you control a Mount or Vehicle. {T}: Add {G}. {1}{G}, {T}, Sacrifice this land: Create a 1/1 colorless Pilot creature token.", cmc: 0, colors: ["G"], rarity: "common", manaCost: "" };
    const filler = [];
    for (let i = 0; i < 14; i += 1) filler.push({ name: `Grove ${i}`, type: "land", text: "{T}: Add {G}. Draw a card.", cmc: 0, colors: ["G"], rarity: "common", manaCost: "" });
    const data = new Map();
    const entries = [road, ...filler].map((c) => { data.set(normalizeCardName(c.name), c); return { rawName: c.name, normalizedName: normalizeCardName(c.name), quantity: 1 }; });
    const collection = { entries, originals: entries, byNormalized: new Map(entries.map((e) => [e.normalizedName, 1])), byFrontFace: new Map(), uniqueRawNames: entries.map((e) => e.rawName) };
    const deck = [budCard("a", "creature", "", 2, ["G"])];
    const withPlan = buildBottomUpManaBase(deck, ["G"], collection, data, 37, { kind: "theme", tag: "vehicles", label: "vehicles" });
    assertTrue(withPlan.some((l) => l.name === "Wild Roads"), "Roads land missing from a vehicle plan's mana base");
  },

  "buildBottomUpManaBase: with no owned lands it returns basics split across the colors": () => {
    const lands = buildBottomUpManaBase([budCard("a", "creature", "", 2, ["U"]), budCard("b", "creature", "", 2, ["B"])],
      ["U", "B"], { entries: [] }, new Map(), 37);
    assertEqual(lands.length, 37);
    const blue = lands.filter((l) => l.name === "Island").length;
    const black = lands.filter((l) => l.name === "Swamp").length;
    assertEqual(blue + black, 37);
    assertTrue(blue >= 15 && black >= 15, `blue ${blue} black ${black}`);
  },

  "filler with no signal prefers an on-color card over a colorless one, not the alphabet": () => {
    const pool = [];
    for (let i = 0; i < 3; i += 1) pool.push(budCard(`Zombie ${i}`, "creature — zombie", "", 2, ["B"]));
    pool.push(budCard("Aaa Gadget", "artifact", "flying", 3, []));
    pool.push(budCard("Zzz Idol", "enchantment", "", 3, ["B"]));
    const { deck } = buildDeckBottomUp(pool, { archetype: "midrange", subtype: BUD_ZOMBIE, colors: ["B"], nonlandSlots: 4 });
    const names = deck.map((c) => c.name);
    assertTrue(names.includes("Zzz Idol"), "the on-color filler card was passed over");
    assertTrue(!names.includes("Aaa Gadget") || names.indexOf("Zzz Idol") < names.indexOf("Aaa Gadget"), "the colorless card was taken first, on alphabet");
  },

  "tribe members go ahead of no-signal spells past the creature count, up to the plan creature ceiling": () => {
    const pool = [];
    for (let i = 0; i < 70; i += 1) pool.push(budCard(`Zombie ${i}`, "creature — zombie", "", 1 + (i % 3), ["B"]));
    for (let i = 0; i < 40; i += 1) pool.push(budCard(`Aaa Idle ${i}`, "enchantment", "", 2, ["B"]));
    const { deck } = buildDeckBottomUp(pool, { archetype: "aggro", subtype: BUD_ZOMBIE, colors: ["B"], nonlandSlots: 62 });
    const creatures = deck.filter((c) => c.name.startsWith("Zombie")).length;
    assertEqual(deck.length, 62);
    assertTrue(creatures > 28, "creatures stopped at the archetype count while Zombies were left out: " + creatures);
    assertEqual(creatures, BOTTOM_UP_PLAN_CREATURES_MAX);
  },

  "a vehicle plan keeps about one vehicle per 1.25 creatures": () => {
    const pool = [];
    for (let i = 0; i < 40; i += 1) pool.push(budCard(`Ship ${i}`, "artifact — vehicle", "Crew 2", 2 + (i % 3), []));
    for (let i = 0; i < 40; i += 1) pool.push(budCard(`Pilot ${i}`, "creature — human", "", 1 + (i % 3), ["W"]));
    const { deck } = buildDeckBottomUp(pool, { archetype: "midrange", subtype: { kind: "theme", tag: "vehicles", label: "vehicles" }, colors: ["W"], nonlandSlots: 62 });
    const ships = deck.filter((c) => c.name.startsWith("Ship")).length;
    const pilots = deck.filter((c) => c.name.startsWith("Pilot")).length;
    assertTrue(ships > 0, "no vehicles");
    assertTrue(ships <= pilots / BOTTOM_UP_CREATURES_PER_VEHICLE, "more vehicles than the creatures can carry: " + ships + " vs " + pilots);
  },

  "a vehicle needs enough creatures with the power to crew it alone": () => {
    const weak = (i) => ({ ...budCard(`Pilot ${i}`, "creature — human", "", 2, ["W"]), raw: { power: "1" } });
    const strong = (i) => ({ ...budCard(`Brute ${i}`, "creature — giant", "", 3, ["W"]), raw: { power: "5" } });
    const ship = (name, crew) => budCard(name, "artifact — vehicle", `Crew ${crew}`, 3, []);
    const pool = [ship("Light Ship", 1), ship("Heavy Ship", 5)];
    for (let i = 0; i < 30; i += 1) pool.push(weak(i));
    const sub = { kind: "theme", tag: "vehicles", label: "vehicles" };
    const weakOnly = buildDeckBottomUp(pool, { archetype: "midrange", subtype: sub, colors: ["W"], nonlandSlots: 62 }).deck.map((c) => c.name);
    assertTrue(weakOnly.includes("Light Ship"), "crew 1 vehicle left out");
    assertTrue(!weakOnly.includes("Heavy Ship"), "crew 5 vehicle taken with no creature able to crew it");
    for (let i = 0; i < 10; i += 1) pool.push(strong(i));
    const withBrutes = buildDeckBottomUp(pool, { archetype: "midrange", subtype: sub, colors: ["W"], nonlandSlots: 62 }).deck.map((c) => c.name);
    assertTrue(withBrutes.includes("Heavy Ship"), "crew 5 vehicle left out with ten 5-power creatures");
  },

  "a vehicle that also draws is not locked out by a full draw role": () => {
    const pool = [];
    for (let i = 0; i < 12; i += 1) pool.push(budCard(`Aaa Cantrip ${i}`, "sorcery", "Draw two cards.", 2, ["W"]));
    pool.push(budCard("Zzz Looter", "artifact — vehicle", "Whenever this attacks, draw a card, then discard a card. Crew 1", 2, []));
    for (let i = 0; i < 40; i += 1) pool.push(budCard(`Pilot ${i}`, "creature — human", "", 1 + (i % 3), ["W"]));
    const { deck } = buildDeckBottomUp(pool, { archetype: "midrange", subtype: { kind: "theme", tag: "vehicles", label: "vehicles" }, colors: ["W"], nonlandSlots: 62 });
    assertTrue(deck.some((c) => c.name === "Zzz Looter"), "plan vehicle left out because draw slots were full");
  },

  "a Pilot-token maker is a member of a vehicle plan": () => {
    const maker = budCard("Zzz Roadmaker", "enchantment — aura", "When this Aura enters, create a 1/1 colorless Pilot creature token with \"This token crews Vehicles as though its power were 2 greater.\"", 2, ["W"]);
    const sub = { kind: "theme", tag: "vehicles", label: "vehicles" };
    assertEqual(subtypeStanding(maker, sub), "member");
    assertEqual(subtypeStanding(maker, { kind: "theme", tag: "graveyard", label: "graveyard" }), "none");
    const pool = [maker];
    for (let i = 0; i < 40; i += 1) pool.push(budCard(`Pilot ${i}`, "creature — human", "", 1 + (i % 3), ["W"]));
    const { deck } = buildDeckBottomUp(pool, { archetype: "midrange", subtype: sub, colors: ["W"], nonlandSlots: 62 });
    assertTrue(deck.some((c) => c.name === "Zzz Roadmaker"), "Pilot-token maker left out of the vehicle plan");
  },

  "a two-tag theme takes both tags and ranks the first tag's cards ahead": () => {
    const pool = [];
    for (let i = 0; i < 12; i += 1) pool.push(budCard(`Zzz Venom ${i}`, "instant", "Target player gets two poison counters.", 2, ["G"]));
    for (let i = 0; i < 30; i += 1) pool.push(budCard(`Aaa Fang ${i}`, "creature — snake", "Deathtouch", 2, ["G"]));
    const sub = { kind: "theme", tag: "infect~deathtouch", label: "infect~deathtouch" };
    assertEqual(subtypeStanding(pool[0], sub), "member");
    assertEqual(subtypeStanding(pool[12], sub), "member");
    const { deck } = buildDeckBottomUp(pool, { archetype: "midrange", subtype: sub, colors: ["G"], nonlandSlots: 62 });
    assertEqual(deck.filter((c) => c.name.startsWith("Zzz Venom")).length, 12);
    assertTrue(deck.filter((c) => c.name.startsWith("Aaa Fang")).length >= 20, "deathtouch fodder missing");
  },

  "a card that keys on a color the deck lacks is left out": () => {
    const monument = budCard("Aaa Monument", "legendary artifact", "Black creature spells you cast cost {1} less to cast.", 3, []);
    const pool = [...budPool(), monument];
    const blue = buildDeckBottomUp(pool, { archetype: "midrange", subtype: null, colors: ["U"], nonlandSlots: 62 });
    assertTrue(!blue.deck.some((c) => c.name === "Aaa Monument"), "dead-color card in a non-black deck");
    assertTrue(!deadForColors(monument, ["B"]), "card flagged dead in a black deck");
    assertTrue(!deadForColors(monument, ["W", "B"]), "card flagged dead in a deck that includes black");
  },

  "removal that names a color is not treated as dead": () => {
    assertTrue(!deadForColors(budCard("Smite", "instant", "destroy target black creature.", 2, ["W"]), ["W"]), "removal flagged dead");
    assertTrue(!deadForColors(budCard("Plain", "artifact", "", 2, []), ["U"]), "vanilla flagged dead");
    assertTrue(deadForColors(budCard("Mon", "artifact", "Black creature spells you cast cost {1} less to cast.", 3, []), ["U"]), "dead card not flagged");
  },

  "bottomUpDecklistText: counts repeats of the same card": () => {
    const text = bottomUpDecklistText([{ name: "Swamp" }, { name: "Swamp" }, { name: "Island" }]);
    assertEqual(text, "2 Swamp\n1 Island");
  }
});
