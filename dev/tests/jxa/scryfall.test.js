runSuite("scryfall", {
  "convertScryfallCard: captures rarity, lowercased": function () {
    const card = convertScryfallCard({ name: "Llanowar Elves", type_line: "Creature — Elf Druid", rarity: "Common", cmc: 1, color_identity: ["G"] });
    assertEqual(card.rarity, "common");
  },

  "convertScryfallCard: missing rarity falls back to empty string, not undefined": function () {
    const card = convertScryfallCard({ name: "Test Card", type_line: "Sorcery", cmc: 1, color_identity: [] });
    assertEqual(card.rarity, "");
  }
});
