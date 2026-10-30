function discCard(name, type, text) {
  return { name, type, text };
}

function discBulk(n, type, text, prefix) {
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(discCard(`${prefix} ${i}`, type, text));
  return out;
}

const DISC_TRIBAL = { kind: "tribal", tag: "merfolk", label: "Merfolk" };
const DISC_TRIBE_FOR = (entry) => (entry.tag === "merfolk" ? "merfolk" : null);

runSuite("discovery", {
  "rankCollectionSupport: counts a tribe's creatures and ranks by count": function () {
    const cards = [
      ...discBulk(15, "creature — merfolk", "", "Merfolk"),
      ...discBulk(100, "creature — bear", "", "Bear")
    ];
    const rows = rankCollectionSupport(cards, [DISC_TRIBAL], DISC_TRIBE_FOR);
    assertEqual(rows.length, 1);
    assertEqual(rows[0].count, 15);
  },

  "rankCollectionSupport: counts payoffs that say the plural, not just creatures": function () {
    const elves = { kind: "tribal", tag: "elves", label: "Elves" };
    const cards = [
      ...discBulk(6, "creature — elf druid", "", "Elf"),
      ...discBulk(4, "enchantment", "Elves you control get +1/+1.", "Anthem"),
      ...discBulk(3, "instant", "Create a 1/1 green Elf Warrior creature token.", "Trick"),
      ...discBulk(100, "creature — bear", "", "Bear")
    ];
    const rows = rankCollectionSupport(cards, [elves], () => "elf");
    assertEqual(rows[0].count, 13);
  },

  "rankCollectionSupport: drops a theme with too few cards": function () {
    const cards = [...discBulk(5, "creature — merfolk", "", "Merfolk"), ...discBulk(100, "creature — bear", "", "Bear")];
    assertEqual(rankCollectionSupport(cards, [DISC_TRIBAL], DISC_TRIBE_FOR).length, 0);
  },

  "rankCollectionSupport: drops a theme that is most of the collection": function () {
    const cards = [...discBulk(40, "creature — merfolk", "", "Merfolk"), ...discBulk(40, "creature — bear", "", "Bear")];
    assertEqual(rankCollectionSupport(cards, [DISC_TRIBAL], DISC_TRIBE_FOR).length, 0);
  },

  "rankCollectionSupport: ignores lands and counts a repeated card once": function () {
    const dup = discCard("Same Merfolk", "creature — merfolk", "");
    const cards = [...discBulk(12, "land", "merfolk", "Land"), dup, dup, ...discBulk(100, "creature — bear", "", "Bear")];
    assertEqual(rankCollectionSupport(cards, [DISC_TRIBAL], DISC_TRIBE_FOR).length, 0);
  },

  "rankCollectionSupport: a detected theme tag counts its cards": function () {
    const entry = { kind: "theme", tag: "tokens", label: "Tokens" };
    const cards = [
      ...discBulk(14, "sorcery", "create two 1/1 white soldier creature tokens.", "Token Maker"),
      ...discBulk(100, "creature — bear", "", "Bear")
    ];
    const rows = rankCollectionSupport(cards, [entry], DISC_TRIBE_FOR);
    assertEqual(rows.length, 1);
    assertEqual(rows[0].count, 14);
  }
});

runSuite("discovery: type lines", {
  "classifyPrimaryType: plain and modified single types": function () {
    assertEqual(classifyPrimaryType("Legendary Creature — Human Wizard"), "creature");
    assertEqual(classifyPrimaryType("Basic Land — Forest"), "land");
    assertEqual(classifyPrimaryType("Snow Instant"), "instant");
    assertEqual(classifyPrimaryType("Kindred Sorcery — Goblin"), "sorcery");
    assertEqual(classifyPrimaryType("Enchantment — Aura"), "enchantment");
  },

  "classifyPrimaryType: multi-type cards take creature, then land, then artifact": function () {
    assertEqual(classifyPrimaryType("Artifact Creature — Golem"), "creature");
    assertEqual(classifyPrimaryType("Enchantment Creature — Spirit"), "creature");
    assertEqual(classifyPrimaryType("Artifact Land"), "land");
    assertEqual(classifyPrimaryType("Legendary Artifact — Equipment"), "artifact");
  },

  "classifyPrimaryType: a two-faced card is classified by its front face": function () {
    assertEqual(classifyPrimaryType("Instant // Sorcery"), "instant");
    assertEqual(classifyPrimaryType("Sorcery // Land"), "sorcery");
    assertEqual(classifyPrimaryType("Creature — Human // Creature — Werewolf"), "creature");
  },

  "classifyPrimaryType: unknown types are null": function () {
    assertEqual(classifyPrimaryType("Conspiracy"), null);
  },

  "getTypeLineSubtypes: returns every subtype of the front face only": function () {
    assertEqual(getTypeLineSubtypes("Creature — Human Warrior").join(","), "human,warrior");
    assertEqual(getTypeLineSubtypes("Creature — Human Peasant // Creature — Wolf").join(","), "human,peasant");
    assertEqual(getTypeLineSubtypes("Instant").length, 0);
  },

  "legendary and artifact-creature flags read the front face": function () {
    assertTrue(isLegendaryTypeLine("Legendary Artifact Creature — Golem"));
    assertTrue(!isLegendaryTypeLine("Artifact Creature — Golem"));
    assertTrue(isArtifactCreatureTypeLine("Legendary Artifact Creature — Golem"));
    assertTrue(!isArtifactCreatureTypeLine("Creature — Golem"));
  }
});
