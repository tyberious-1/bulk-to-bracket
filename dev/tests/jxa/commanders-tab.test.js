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
  }
});
