// Fallback themes (2026-11-17): a commander with no EDHREC tags gets its themes from what the center reader sees in its own text,
// checked against what the collection owns, instead of from the first 80 pool cards in collection order. Cards the reader links
// through a type, keyword or term the commander names also become theme-tier candidates, and a build starts on the first plan the
// collection supports instead of a blend of every theme.
// Cases: Sethron (a named creature type), Shelob (a type and a term), Thorin (a creature type and a card type), the default plan pick.

function ft(name, type, text, colors, cmc) {
  return { name, type, text, cmc: cmc == null ? 3 : cmc, colors: colors || [] };
}

function ownedFixture(cards) {
  const entries = cards.map((c) => ({ rawName: c.name, normalizedName: normalizeCardName(c.name), quantity: 1 }));
  const collection = { entries, byNormalized: new Map(entries.map((e) => [e.normalizedName, e.quantity])) };
  const data = new Map(cards.map((c) => [normalizeCardName(c.name), c]));
  return { collection, data };
}

function many(n, make) {
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(make(i));
  return out;
}

const SETHRON = [
  "whenever sethron or another nontoken minotaur you control enters, create a 2/3 red minotaur creature token.",
  "{2}{b/r}: minotaurs you control get +1/+0 and gain menace and haste until end of turn."
];
const SHELOB = [
  "deathtouch, ward {2}",
  "other spiders you control have deathtouch and ward {2}.",
  "whenever another creature dealt damage this turn by a spider you controlled dies, create a token that's a copy of that creature, except it's a food artifact with \"{2}, {t}, sacrifice this token: you gain 3 life,\" and it loses all other card types."
];
const THORIN_KING = [
  "whenever thorin or another dwarf you control enters, create a treasure token.",
  "other dwarves you control get +1/+0 for each artifact token you control."
];

const minotaur = (i) => ft("Minotaur " + i, "creature — minotaur warrior", "", ["R"]);
const human = (i) => ft("Human " + i, "creature — human", "when this creature enters, create a 1/1 white spirit creature token.", ["R"]);
const spider = (i) => ft("Spider " + i, "creature — spider", "reach", ["G"]);
const foodMaker = (i) => ft("Snack " + i, "artifact — food", "{2}, {t}, sacrifice this artifact: you gain 3 life.", []);
const dwarf = (i) => ft("Dwarf " + i, "creature — dwarf", "", ["R"]);
const rock = (i) => ft("Rock " + i, "artifact", "{t}: add {c}.", []);

runSuite("fallback-themes", {
  "pluralizeCreatureType: regular and irregular plurals in EDHREC's spelling": function () {
    assertEqual(pluralizeCreatureType("minotaur"), "minotaurs");
    assertEqual(pluralizeCreatureType("spider"), "spiders");
    assertEqual(pluralizeCreatureType("elf"), "elves");
    assertEqual(pluralizeCreatureType("wolf"), "wolves");
    assertEqual(pluralizeCreatureType("dwarf"), "dwarves");
    assertEqual(pluralizeCreatureType("ally"), "allies");
    assertEqual(pluralizeCreatureType("sphinx"), "sphinxes");
  },

  "getThemeAliases: a creature type the tribal table lacks gets a tribal alias": function () {
    assertTrue(getThemeAliases("minotaurs").includes("minotaur tribal"), "Minotaurs is not in TRIBAL_TYPES");
    assertTrue(getThemeAliases("Minotaurs").includes("minotaur tribal"), "case does not matter");
    assertTrue(getThemeAliases("spiders").includes("spider tribal"));
  },

  "getThemeAliases: themes that are not creature types, or already mean something else, gain no tribal alias": function () {
    assertTrue(!getThemeAliases("tokens").some((a) => a.endsWith(" tribal")), "tokens");
    assertTrue(!getThemeAliases("clones").some((a) => a.endsWith(" tribal")), "clones has its own alias and keeps it");
    assertTrue(!getThemeAliases("food").some((a) => a.endsWith(" tribal")), "food");
    assertTrue(!getThemeAliases("lands matter").some((a) => a.endsWith(" tribal")), "lands matter");
    assertEqual(getThemeAliases("elves").includes("elf tribal"), true, "an existing table entry still works");
  },

  "deriveCommanderThemes: names the creature type the commander reads when the collection supports it": function () {
    const cards = [...many(8, minotaur), ...many(3, human)];
    const { collection, data } = ownedFixture(cards);
    const themes = deriveCommanderThemes(SETHRON, collection, data, ["R"]);
    assertEqual(themes[0], "minotaurs");
    assertTrue(!themes.includes("humans"), "a type the commander does not name is never a theme");
  },

  "deriveCommanderThemes: a type the collection barely owns is left out, so the caller can fall back": function () {
    const { collection, data } = ownedFixture([...many(3, minotaur), ...many(20, human)]);
    assertEqual(deriveCommanderThemes(SETHRON, collection, data, ["R"]), []);
  },

  "deriveCommanderThemes: a commander the reader cannot read yields nothing": function () {
    const { collection, data } = ownedFixture(many(20, human));
    assertEqual(deriveCommanderThemes(["flying"], collection, data, ["R"]), []);
    assertEqual(deriveCommanderThemes([], collection, data, ["R"]), []);
    assertEqual(deriveCommanderThemes(undefined, collection, data, ["R"]), []);
  },

  "deriveCommanderThemes: Shelob's type comes before her term, whichever the collection owns more of": function () {
    const { collection, data } = ownedFixture([...many(6, spider), ...many(30, foodMaker)]);
    assertEqual(deriveCommanderThemes(SHELOB, collection, data, ["B", "G"]).slice(0, 2), ["spiders", "food"]);
  },

  "deriveCommanderThemes: a card type the commander counts (artifact tokens) is never a theme": function () {
    const { collection, data } = ownedFixture([...many(8, dwarf), ...many(30, rock)]);
    const themes = deriveCommanderThemes(THORIN_KING, collection, data, ["R", "W"]);
    assertEqual(themes[0], "dwarves");
    assertTrue(!themes.some((t) => /artifact/.test(t)), "artifacts are not a theme: every deck has them");
  },

  "deriveCommanderThemes: at most five themes": function () {
    const texts = ["other spiders, minotaurs, dwarves, elves, wolves and goblins you control get +1/+1."];
    const types = [["spider", "creature — spider"], ["minotaur", "creature — minotaur"], ["dwarf", "creature — dwarf"], ["elf", "creature — elf"], ["wolf", "creature — wolf"], ["goblin", "creature — goblin"]];
    const cards = [];
    for (const [t, line] of types) for (let i = 0; i < 6; i += 1) cards.push(ft(t + " " + i, line, "", []));
    const { collection, data } = ownedFixture(cards);
    assertTrue(deriveCommanderThemes(texts, collection, data, []).length <= 5);
  },

  "addEngineCandidates: a card only the center reader links is NOT injected into the theme tier": function () {
    // Tried 2026-11-17 and dropped: injecting every type/keyword/term-linked card at rank 0 flattened the tier's order and cost Fynn
    // 3 of his 19 cheap deathtouch carriers (19 -> 16) in the 13-build check. The derived themes already bring those cards in.
    const needs = parseCommanderNeeds(["whenever a creature you control with deathtouch deals combat damage to a player, that player gets two poison counters."]);
    assertTrue(needs.center.some((c) => c.kind === "keyword"), "the reader reads the keyword plan");
    const rat = ft("Deathtouch Rat", "creature — rat", "deathtouch", ["G"], 1);
    const owned = new Map([[normalizeCardName("Deathtouch Rat"), rat]]);
    assertEqual(addEngineCandidates(new Map(), needs, owned, ["G"]).size, 0);
  },

  "addCollectionPlans: themes the commander reading ranked keep their order; others sort by owned": function () {
    const { data } = ownedFixture([...many(6, spider), ...many(30, foodMaker)]);
    const ranked = addCollectionPlans([], ["spiders", "food"], data, ["B", "G"], "Shelob", true);
    assertEqual(ranked.map((p) => p.themes[0]), ["spiders", "food"]);
    const bySupport = addCollectionPlans([], ["spiders", "food"], data, ["B", "G"], "Shelob");
    assertEqual(bySupport.map((p) => p.themes[0]), ["food", "spiders"]);
  },

  "pickDefaultPlanFocus: the first plan the collection supports, in the order given": function () {
    const plans = [
      { themes: ["a"], owned: 3, light: true },
      { themes: ["b"], owned: 12, light: false },
      { themes: ["c"], owned: 30, light: false }
    ];
    assertEqual(pickDefaultPlanFocus(plans), "b");
  },

  "pickDefaultPlanFocus: a multi-theme plan keeps its joined focus": function () {
    assertEqual(pickDefaultPlanFocus([{ themes: ["auras", "voltron"], owned: 14, light: false }]), "auras~voltron");
  },

  "pickDefaultPlanFocus: when every plan is light the best supported wins, unless even that is thin": function () {
    assertEqual(pickDefaultPlanFocus([{ themes: ["a"], owned: 3, light: true }, { themes: ["b"], owned: 7, light: true }]), "b");
    assertEqual(pickDefaultPlanFocus([{ themes: ["a"], owned: 2, light: true }, { themes: ["b"], owned: 4, light: true }]), "");
  },

  "pickDefaultPlanFocus: no plans means no default": function () {
    assertEqual(pickDefaultPlanFocus([]), "");
    assertEqual(pickDefaultPlanFocus(undefined), "");
  }
});
