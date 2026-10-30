
function bupCard(name, type, text, cmc, colors, rarity) {
  return { name, type, text, cmc: cmc || 2, colors: colors || ["B"], rarity: rarity || "common", manaCost: "" };
}
const BUP_ENTRY = { kind: "tribal", tag: "zombies", label: "Zombies" };
const BUP_TRIBE_FOR = (entry) => (entry.tag === "zombies" ? "zombie" : null);

function bupCollection() {
  const cards = [];
  for (let i = 0; i < 20; i += 1) cards.push(bupCard(`Zombie B ${i}`, "creature — zombie", "", 1 + (i % 4), ["B"]));
  for (let i = 0; i < 6; i += 1) cards.push(bupCard(`Zombie U ${i}`, "creature — zombie", "", 2, ["U"]));
  for (let i = 0; i < 20; i += 1) cards.push(bupCard(`Kill ${i}`, "instant", "destroy target creature.", 2, ["B"]));
  for (let i = 0; i < 20; i += 1) cards.push(bupCard(`Study ${i}`, "sorcery", "draw two cards.", 2, ["B"]));
  for (let i = 0; i < 12; i += 1) cards.push(bupCard(`Rock ${i}`, "artifact", "{t}: add {c}.", 2, []));
  for (let i = 0; i < 400; i += 1) cards.push(bupCard(`Bulk ${i}`, "creature — bear", "", 2, ["G"]));
  return cards;
}

runSuite("bottom-up", {
  "toBottomUpSubtype: a tribal entry carries its singular tribe": () => {
    const subtype = toBottomUpSubtype(BUP_ENTRY, BUP_TRIBE_FOR);
    assertEqual(subtype, { kind: "tribal", tag: "zombies", label: "Zombies", tribe: "zombie" });
  },

  "candidateColorSets: the best single color, and a pair only when it adds three or more": () => {
    const subtype = toBottomUpSubtype(BUP_ENTRY, BUP_TRIBE_FOR);
    const sets = candidateColorSets(bupCollection(), subtype);
    assertEqual(sets[0], ["B"]);
    assertEqual(sets[1], ["U", "B"]);
  },

  "rateBuild: Strong needs deep support and few shortfalls, Thin is the default": () => {
    const strong = { nonlandSlots: 62, members: 25, payoffs: 0, shortfalls: { wipe: 0, removal: 0, ramp: 1, draw: 0 } };
    const thin = { nonlandSlots: 62, members: 3, payoffs: 0, shortfalls: { wipe: 4, removal: 5, ramp: 5, draw: 5 } };
    assertEqual(rateBuild(strong), "Strong");
    assertEqual(rateBuild(thin), "Thin");
  },

  "describeBuild: names bulk quality and the thin roles": () => {
    const report = {
      nonlandSlots: 62, members: 10, payoffs: 2, mentions: 1, shortfalls: { wipe: 4, removal: 0, ramp: 0, draw: 0 },
      roleCounts: { wipe: 0, removal: 8, ramp: 9, draw: 8 }, slots: { wipe: 4, removal: 8, ramp: 9, draw: 8 },
      substitutions: [{ role: "removal+wipe", shortfall: 4, extraDraw: 4 }], supportRarity: { bulk: 11, rare: 1 }
    };
    const d = describeBuild(report);
    assertTrue(/bulk/i.test(d.quality));
    assertTrue(d.roles.some((line) => /wipe/i.test(line)));
    assertTrue(d.roles.some((line) => /draw/i.test(line)));
  },

  "describeBuild: names the placeholder slots, and stays quiet when there are none": () => {
    const base = {
      nonlandSlots: 62, members: 10, payoffs: 2, mentions: 1, shortfalls: { wipe: 0, removal: 0, ramp: 0, draw: 0 },
      roleCounts: { wipe: 4, removal: 11, ramp: 8, draw: 11 }, slots: { wipe: 4, removal: 11, ramp: 8, draw: 11 },
      substitutions: [], supportRarity: { bulk: 11, rare: 1 }
    };
    const some = describeBuild({ ...base, fallbackCount: 7 });
    assertTrue(some.notes.some((line) => /7 placeholder/i.test(line)), "placeholder note missing");
    assertTrue(!describeBuild({ ...base, fallbackCount: 0 }).notes.some((line) => /placeholder/i.test(line)));
    assertTrue(!describeBuild(base).notes.some((line) => /placeholder/i.test(line)));
  },

  "describeBuild: says when the counterspell floor was not met, and stays quiet when it was": () => {
    const base = {
      nonlandSlots: 62, members: 10, payoffs: 2, mentions: 1, shortfalls: { wipe: 0, removal: 0, ramp: 0, draw: 0 },
      roleCounts: { wipe: 4, removal: 11, ramp: 8, draw: 11 }, slots: { wipe: 4, removal: 11, ramp: 8, draw: 11 },
      substitutions: [], supportRarity: { bulk: 11, rare: 1 }
    };
    const short = describeBuild({ ...base, counters: { floor: 5, count: 2, shortfall: 3 } });
    assertTrue(short.roles.some((line) => /counterspell/i.test(line) && /2 of 5/.test(line)));
    const met = describeBuild({ ...base, counters: { floor: 5, count: 5, shortfall: 0 } });
    assertTrue(!met.roles.some((line) => /counterspell/i.test(line)));
    const noAnswers = describeBuild({ ...base, answers: { floor: 2, count: 0, shortfall: 2 } });
    assertTrue(noAnswers.roles.some((line) => /artifact and enchantment/i.test(line) && /0 of 2/.test(line)));
    const haveAnswers = describeBuild({ ...base, answers: { floor: 2, count: 2, shortfall: 0 } });
    assertTrue(!haveAnswers.roles.some((line) => /artifact and enchantment/i.test(line)));
  },

  "extractEdhrecBudgetInclusion: rate per card, the best section wins, commanders and empty pages are skipped": () => {
    const view = (name, decks, potential) => ({ name, num_decks: decks, potential_decks: potential });
    const payload = { container: { json_dict: { cardlists: [
      { header: "Top Commanders", cardviews: [view("Some Commander", 49, 347)] },
      { header: "Top Cards", cardviews: [view("Lord of the Accursed", 29, 40)] },
      { header: "Creatures", cardviews: [view("Lord of the Accursed", 20, 40), view("Cabal Archon", 10, 40), view("Never Played", 0, 0)] }
    ] } } };
    const map = extractEdhrecBudgetInclusion(payload);
    assertEqual(map.get("lord of the accursed"), 29 / 40);
    assertEqual(map.get("cabal archon"), 0.25);
    assertTrue(!map.has("some commander"));
    assertTrue(!map.has("never played"));
    assertEqual(extractEdhrecBudgetInclusion({}).size, 0);
    assertEqual(extractEdhrecBudgetInclusion(null).size, 0);
  },

  "describeBuild: notes the budget tiebreak only when it was applied": () => {
    const base = {
      nonlandSlots: 62, members: 10, payoffs: 2, mentions: 1, shortfalls: { wipe: 0, removal: 0, ramp: 0, draw: 0 },
      roleCounts: { wipe: 4, removal: 11, ramp: 8, draw: 11 }, slots: { wipe: 4, removal: 11, ramp: 8, draw: 11 },
      substitutions: [], supportRarity: { bulk: 11, rare: 1 }
    };
    const applied = describeBuild({ ...base, budget: { applied: true, matched: 14 } });
    assertTrue(applied.notes.some((line) => /EDHREC budget/i.test(line) && /14/.test(line)));
    assertEqual(describeBuild({ ...base, budget: { applied: false, matched: 0 } }).notes, []);
    assertEqual(describeBuild(base).notes, []);
  },

  "rankBottomUpSuggestions: three archetypes per subtype and color set, best support first": () => {
    const rows = rankBottomUpSuggestions(bupCollection(), [BUP_ENTRY], BUP_TRIBE_FOR);
    assertTrue(rows.length >= 3);
    assertEqual(new Set(rows.map((r) => r.archetype)).size, 3);
    assertTrue(rows.every((r) => r.subtype.tag === "zombies"));
    const rank = { Strong: 0, OK: 1, Thin: 2 };
    for (const archetype of ["aggro", "midrange", "control"]) {
      const own = rows.filter((r) => r.archetype === archetype);
      for (let i = 1; i < own.length; i += 1) assertTrue(rank[own[i - 1].rating] <= rank[own[i].rating], `${archetype} not sorted by rating`);
    }
  },

  "rankBottomUpSuggestions: tribes are listed first and a broad theme cannot crowd them out": () => {
    const cards = bupCollection();
    for (let i = 0; i < 60; i += 1) cards.push(bupCard(`Soldier Maker ${i}`, "sorcery", "create a 1/1 white soldier creature token.", 2, ["B"]));
    const tokens = { kind: "theme", tag: "tokens", label: "Tokens" };
    const rows = rankBottomUpSuggestions(cards, [tokens, BUP_ENTRY], BUP_TRIBE_FOR);
    assertEqual(rows[0].subtype.kind, "tribal");
    assertTrue(rows.some((r) => r.subtype.kind === "theme"), "no theme row");
    const firstTheme = rows.findIndex((r) => r.subtype.kind === "theme");
    assertTrue(rows.slice(firstTheme).every((r) => r.subtype.kind === "theme"), "tribes and themes are interleaved");
  },

  "rankBottomUpSuggestions: every archetype gets its own full list, not what the others left over": () => {
    const tribes = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet"];
    const cards = [];
    tribes.forEach((tribe, t) => {
      for (let i = 0; i < 14 + t; i += 1) cards.push(bupCard(`${tribe} ${i}`, `creature \u2014 ${tribe}`, "", 1 + (i % 4), ["B"]));
    });
    for (let i = 0; i < 20; i += 1) cards.push(bupCard(`Kill ${i}`, "instant", "destroy target creature.", 2, ["B"]));
    for (let i = 0; i < 20; i += 1) cards.push(bupCard(`Study ${i}`, "sorcery", "draw two cards.", 2, ["B"]));
    for (let i = 0; i < 12; i += 1) cards.push(bupCard(`Rock ${i}`, "artifact", "{t}: add {c}.", 2, []));
    const catalog = tribes.map((tribe) => ({ kind: "tribal", tag: `${tribe}s`, label: `${tribe}s` }));
    const tribeFor = (entry) => entry.label.replace(/s$/, "");
    const groups = groupBottomUpSuggestions(rankBottomUpSuggestions(cards, catalog, tribeFor));
    for (const group of groups) assertTrue(group.items.length >= 8, `${group.id} has only ${group.items.length} rows`);
    const subtypes = new Set(groups.flatMap((g) => g.items.map((i) => i.row.subtype.tag)));
    assertTrue(subtypes.size >= 8, `only ${subtypes.size} distinct subtypes`);
  },

  "groupBottomUpSuggestions: one group per archetype, rating first, then tribes before themes, then support": () => {
    const row = (archetype, rating, kind, members) => ({ archetype, rating, subtype: { kind, tag: `${kind}${members}` }, report: { members, payoffs: 0, nonlandSlots: 62 } });
    const rows = [
      row("control", "Thin", "tribal", 30),
      row("aggro", "OK", "theme", 40),
      row("control", "Strong", "theme", 62),
      row("control", "Strong", "tribal", 20),
      row("control", "Strong", "tribal", 25),
      row("aggro", "Strong", "tribal", 10)
    ];
    const groups = groupBottomUpSuggestions(rows);
    assertEqual(groups.map((g) => g.id), ["aggro", "midrange", "control"]);
    assertEqual(groups[1].items, []);
    assertEqual(groups[0].items.map((i) => i.index), [5, 1]);
    // control: Strong tribal 25, Strong tribal 20, Strong theme, then the Thin tribe
    assertEqual(groups[2].items.map((i) => i.index), [4, 3, 2, 0]);
  },

  "rankBottomUpSuggestions: an empty collection gives no suggestions": () => {
    assertEqual(rankBottomUpSuggestions([], [BUP_ENTRY], BUP_TRIBE_FOR), []);
  }
});
