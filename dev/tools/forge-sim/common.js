// Shared by parse.js and gamesum.js. Commander decks are named after their commander (the .dck `Name=` line, which
// to_dck.js sets and the precon copies must set), and Forge prints that name as the player: "Ai(2)-Quintorius, History Chaser".
// A mirror pod (the same list four times) needs different names, so it adds a one-character suffix (" A", " #2"); that suffix
// is stripped here. An older mirror log used a short name with no comma ("Quintorius A"): it matches the card's first segment.
const playerName = (p) => p.replace(/^Ai\(\d+\)-/, "");
const baseName = (p) => playerName(p).replace(/\s+#?[A-Z0-9]$/, "");
// True when `card` (the name after "cast ") is that player's commander. The comma-less fallback only applies to short names,
// so "Saheeli, Sublime Artificer" in the Saheeli deck is not mistaken for the commander.
function isCommanderCast(player, card) {
  const b = baseName(player);
  return card === b || (!b.includes(",") && card.split(",")[0] === b);
}
module.exports = { playerName, baseName, isCommanderCast };
