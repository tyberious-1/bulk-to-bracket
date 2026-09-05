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

// EDHREC's support-package numbers, with the defaults the builder falls back to
// when a commander's page does not report one. Shared with buildDeckFromScoredPool
// so the report shows the targets the deck was actually built against.
function normalizeRoleTargets(edhrecRoleTargets) {
  return {
    ramp: Math.round(Number(edhrecRoleTargets?.ramp) || 10),
    draw: Math.round(Number(edhrecRoleTargets?.draw) || 10),
    removal: Math.round(Number(edhrecRoleTargets?.removal) || 8),
    wipe: Math.round(Number(edhrecRoleTargets?.wipe) || 3)
  };
}

// Two readings of the same deck.
//
// `primary` is the role the builder assigned each card, one apiece, so the four
// numbers are exclusive and add up. `total` credits every job a card does, so
// the numbers overlap: a removal spell that draws appears under both, and a
// board wipe that draws is counted as a wipe here where its primary role is
// draw. The gap between the two is the deck's double duty.
function getSupportPackageCounts(deck) {
  const counts = {};
  for (const role of SUPPORT_ROLES) counts[role] = { primary: 0, total: 0 };

  for (const card of deck || []) {
    if (card.role === "land") continue;
    if (counts[card.role]) counts[card.role].primary += 1;
    for (const role of getRoleContributions(card)) counts[role].total += 1;
  }

  return counts;
}
