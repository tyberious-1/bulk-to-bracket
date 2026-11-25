// Covers the bug where the Commanders tab showed every EDHREC-ranked
// commander regardless of format: getSortedCommanders() must read from the
// format-aware collection scan (unrankedCommanders) under pauper, not the
// EDHREC-ranked list (ownedCommanders), and getFilteredUnrankedCommanders()
// must not duplicate those rows under a second heading.

function makeCommander(name, colors) {
  return { name, slug: name.toLowerCase(), decks: 0, colors, names: [name], isPair: false, deckSize: 99, unranked: true };
}

runSuite("commanders-tab", {
  "getSortedCommanders reads unrankedCommanders under pauper format, ignoring ownedCommanders": () => {
    setActiveFormat("pauperCommander");
    ownedCommanders = [makeCommander("Rare Legend", ["U"])];
    unrankedCommanders = [makeCommander("Common Creature", ["G"])];
    commanderColorFilter = new Set();
    commanderColorCountFilter = new Set();

    const rows = getSortedCommanders();
    assertEqual(rows.map((c) => c.name), ["Common Creature"], "pauper list must be the scanned pool, not the EDHREC ranking");
  },

  "getSortedCommanders reads ownedCommanders under default commander format": () => {
    setActiveFormat("commander");
    ownedCommanders = [makeCommander("Rare Legend", ["U"])];
    unrankedCommanders = [makeCommander("Common Creature", ["G"])];
    commanderColorFilter = new Set();
    commanderColorCountFilter = new Set();

    const rows = getSortedCommanders();
    assertEqual(rows.map((c) => c.name), ["Rare Legend"], "default format must keep using the EDHREC-ranked list");
  },

  "getFilteredUnrankedCommanders never duplicates rows under pauper format": () => {
    setActiveFormat("pauperCommander");
    unrankedCommanders = [makeCommander("Common Creature", ["G"])];
    commanderColorFilter = new Set(["G"]);

    assertEqual(getFilteredUnrankedCommanders(), [], "pauper has no separate unranked tail -- getSortedCommanders already covers it");
  },

  "findOwnedCommanderPairings lists every owned legal pair, by lead, with combined colors and EDHREC counts when ranked": () => {
    setActiveFormat("commander");
    const card = (name, type, text, colors) => ({ name, type: type.toLowerCase(), rawType: type, text: text.toLowerCase(), rawText: text, colors, rarity: "rare", layout: "normal", cmc: 3 });
    const cards = [
      card("Viconia, Drow Apostate", "Legendary Creature — Elf Cleric", "Choose a Background (You can have a Background as a second commander.)", ["B"]),
      card("Scion of Halaster", "Legendary Enchantment — Background", "Commander creatures you own have ...", ["B"]),
      card("Cloakwood Hermit", "Legendary Enchantment — Background", "Commander creatures you own have ...", ["G"]),
      card("Tana, the Bloodsower", "Legendary Creature — Elf Druid", "Trample. Partner", ["G"]),
      card("Tymna the Weaver", "Legendary Creature — Human Cleric", "Lifelink. Partner", ["W", "B"]),
      card("Sakashima of a Thousand Faces", "Legendary Creature — Human Rogue", "Partner", ["U"]),
      card("Grizzly Bears", "Creature — Bear", "", ["G"])
    ];
    const cardData = new Map(cards.map((c) => [normalizeCardName(c.name), c]));
    const collection = { entries: cards.map((c) => ({ rawName: c.name, normalizedName: normalizeCardName(c.name), quantity: 1 })) };
    const ranked = [{ name: "Tana + Tymna", names: ["Tana, the Bloodsower", "Tymna the Weaver"], isPair: true, decks: 1200, colors: ["W", "B", "G"] }];

    const groups = findOwnedCommanderPairings(collection, cardData, ranked);
    assertEqual(groups.map((g) => g.name), ["Sakashima of a Thousand Faces", "Tana, the Bloodsower", "Tymna the Weaver", "Viconia, Drow Apostate"], "leads by name; Backgrounds and plain creatures never lead");
    const viconia = groups.find((g) => g.name.startsWith("Viconia"));
    assertEqual(viconia.mates.map((m) => m.name), ["Cloakwood Hermit", "Scion of Halaster"], "a Background commander pairs with every owned Background, not with Partner cards");
    assertEqual(viconia.mates[0].colors, ["B", "G"], "the pair's colors are the combined identity");
    const tana = groups.find((g) => g.name.startsWith("Tana"));
    assertEqual(tana.mates.map((m) => [m.name, m.decks]), [["Tymna the Weaver", 1200], ["Sakashima of a Thousand Faces", 0]], "a ranked pair carries its EDHREC count and sorts first");
    assertEqual(viconia.mates[0].names, ["Viconia, Drow Apostate", "Cloakwood Hermit"], "names hand the pair to the build flow");
  }
});
