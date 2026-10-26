
// Which commander suits a finished bottom-up deck?
//
// Candidates are owned commanders and, when EDHREC can name them, commanders that are not in the
// collection. A commander narrower than the deck's colors forces cards out (the cuts), so the
// fewest cuts rank first; among those, a commander that is or rewards the subtype ranks higher.
//
// A candidate is one commander or a legal pair (Partner, Friends forever, Choose a Background,
// Doctor's companion; the rules are pairing.js). Only commanders you own are paired.
//
// Depends on: format.js (canBeActiveCommander), cards.js (legalForCommander), pairing.js, archetypes.js

const COMMANDER_FIT_MAX_CUTS = 8;

function commanderReward(card, subtype) {
  const standing = annotateBottomUpCard(card, subtype).standing;
  return standing === "member" ? 3 : standing === "payoff" ? 3 : standing === "mention" ? 1 : 0;
}

const COMMANDER_COLOR_ORDER = ["W", "U", "B", "R", "G"];

// The combined color identity of one commander or a pair.
function commanderIdentity(cards) {
  const colors = new Set();
  for (const card of cards) for (const color of card.colors || []) colors.add(color);
  return COMMANDER_COLOR_ORDER.filter((color) => colors.has(color));
}

// A commander with fewer colors than the deck takes only its own; extra commander colors are
// not added, so picking a commander never widens the deck.
function narrowDeckColors(deckColors, identity) {
  return deckColors.filter((color) => identity.includes(color));
}

// entries: [{ card, owned }]. Singles need a card that can be a commander; a pair may include a
// Background, which cannot be one alone.
function buildCommanderCandidates(entries) {
  const pool = entries.filter((e) => e.card && (canBeActiveCommander(e.card) || isBackgroundCard(e.card)));
  const out = [];
  for (const entry of pool) {
    if (canBeActiveCommander(entry.card)) out.push({ cards: [entry.card], owned: Boolean(entry.owned) });
  }
  const owned = pool.filter((e) => e.owned);
  for (let i = 0; i < owned.length; i += 1) {
    for (let j = i + 1; j < owned.length; j += 1) {
      if (isLegalCommanderPair(owned[i].card, owned[j].card)) out.push({ cards: [owned[i].card, owned[j].card], owned: true });
    }
  }
  return out;
}

function rankCommanderFits(deck, candidates, subtype) {
  const rows = [];
  for (const candidate of candidates) {
    const cards = candidate.cards || [candidate.card];
    if (!cards.length || cards.some((card) => !card)) continue;
    if (cards.length === 1 && !canBeActiveCommander(cards[0])) continue;
    const colors = commanderIdentity(cards);
    const cuts = deck.filter((c) => !legalForCommander(c.colors || [], colors, c)).map((c) => c.name);
    if (cuts.length > COMMANDER_FIT_MAX_CUTS) continue;
    const reward = cards.reduce((sum, card) => sum + commanderReward(card, subtype), 0);
    rows.push({ cards, card: cards[0], owned: Boolean(candidate.owned), colors, cuts, reward });
  }
  return rows.sort((a, b) =>
    a.cuts.length - b.cuts.length || b.reward - a.reward || String(a.card.name).localeCompare(String(b.card.name)));
}
