// Deck-shape counting. Shared by the build planner (which needs to know how
// full each type bucket is) and the report/chart renderers.

function getDeckTypeBucket(typeLine) {
  const type = String(typeLine || "").toLowerCase();
  if (type.includes("land")) return "Land";
  if (type.includes("creature")) return "Creature";
  if (type.includes("instant")) return "Instant";
  if (type.includes("sorcery")) return "Sorcery";
  if (type.includes("planeswalker")) return "Planeswalker";
  if (type.includes("battle")) return "Other";
  if (type.includes("enchantment")) return "Enchantment";
  if (type.includes("artifact")) return "Artifact";
  return "Other";
}

function countByType(deck) {
  const counts = {
    Land: 0,
    Creature: 0,
    Instant: 0,
    Sorcery: 0,
    Artifact: 0,
    Enchantment: 0,
    Planeswalker: 0,
    Other: 0
  };

  for (const card of deck || []) {
    const bucket = getDeckTypeBucket(card.type || card.type_line || "");
    counts[bucket] += 1;
  }

  return counts;
}

function averageManaValue(deck) {
  const spells = (deck || []).filter((card) => !String(card.type || card.type_line || "").toLowerCase().includes("land"));
  if (!spells.length) return "0";
  const total = spells.reduce((sum, card) => sum + (Number(card.cmc) || Number(card.mana_value) || 0), 0);
  return String(Math.round(total / spells.length));
}
