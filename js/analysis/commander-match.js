// Which commanders does a collection own, and how much of each one's deck
// could it actually build?
//
// findOwnedRankedCommanders answers the first question from EDHREC's color
// pages alone -- no Scryfall traffic, because a name in the collection that
// EDHREC lists as a commander is an owned commander. computeCommanderMatch
// answers the second for one commander at a time, since that needs its
// recommendation pool.
//
// Depends on: cards.js, csv.js, deck-stats.js, edhrec.js, manabase.js,
//   scryfall.js, text.js, themes.js, type-plan.js

// EDHREC writes a partner pair as "A // B", the very separator a two-faced
// card's own name uses. A CSV lists a two-faced card under the whole name, so
// checking the entry as written settles that case first; only then is it worth
// reading the "//" as a pair, which needs both halves owned.
function resolveOwnedCommanderEntry(collection, entry) {
  if (!entry?.name) return null;

  if (hasOwnedCard(collection, entry.name)) {
    return { ...entry, names: [entry.name], isPair: false, deckSize: 99 };
  }

  const parts = String(entry.name).split("//").map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1 && parts.every((part) => hasOwnedCard(collection, part))) {
    return { ...entry, names: parts, isPair: true, deckSize: 98 };
  }

  return null;
}

function findOwnedRankedCommanders(collection, rankings) {
  if (!collection) return [];

  const owned = [];
  for (const entry of Array.isArray(rankings) ? rankings : []) {
    const resolved = resolveOwnedCommanderEntry(collection, entry);
    if (resolved) owned.push(resolved);
  }

  return owned.sort((a, b) => b.decks - a.decks);
}

// Owned commanders EDHREC's color pages never listed.
//
// findOwnedRankedCommanders reads names alone, which is why it costs no
// Scryfall traffic -- but it can only see commanders EDHREC ranks, and those
// pages carry the most-played ones. A collection's obscure or very new legends
// are absent entirely, so filtering to a color identity showed a shorter list
// than the collection can actually offer.
//
// Answering "what else could head a deck of these colors" needs the card
// itself: whether it can be a commander at all, and what its identity is. That
// is why this takes hydrated card data where the ranked scan does not.
//
// Backgrounds are excluded for free: canBeCommander's text rule looks for "can
// be your commander", which a planeswalker commander says and a Background --
// "Commander creatures you own have ..." -- does not.
function findOwnedUnrankedCommanders(collection, cardData, rankedCommanders) {
  const ranked = new Set();
  for (const commander of rankedCommanders || []) {
    for (const name of commander.names || []) {
      ranked.add(normalizeCardName(name));
      ranked.add(normalizeCardName(getPrimaryCardName(name)));
    }
  }

  const unranked = [];
  const seen = new Set();

  for (const entry of getCollectionEntries(collection)) {
    const normalizedName = entry.normalizedName;
    if (ranked.has(normalizedName) || seen.has(normalizedName)) continue;

    const card = cardData.get(normalizedName)
      || cardData.get(normalizeCardName(getPrimaryCardName(normalizedName)));
    if (!card) continue;
    if (!canBeCommander(card)) continue;

    seen.add(normalizedName);
    unranked.push({
      name: card.name,
      // EDHREC often has a page for a commander its color pages do not rank,
      // so derive the slug rather than give up on the match check.
      slug: toEdhrecSlug(getPrimaryCardName(card.name)),
      decks: 0,
      colors: Array.isArray(card.colors) ? card.colors : [],
      names: [card.name],
      isPair: false,
      deckSize: 99,
      unranked: true
    });
  }

  // No deck count to rank these by, so name order is the only one that means
  // anything.
  return unranked.sort((a, b) => a.name.localeCompare(b.name));
}

// Every card of this commander's pool the collection can actually play: owned,
// hydrated, nonland, and inside the color identity.
function collectUsablePoolCards(commander, pool, collection, cardData) {
  const commanderKeys = new Set();
  for (const name of commander.names) {
    commanderKeys.add(normalizeCardName(name));
    commanderKeys.add(normalizeCardName(getPrimaryCardName(name)));
  }

  const usable = [];
  for (const entry of Array.isArray(pool?.cards) ? pool.cards : []) {
    const key = normalizeCardName(entry.name);
    if (commanderKeys.has(key)) continue;
    if (!hasOwnedCard(collection, entry.name)) continue;

    const card = cardData.get(key) || cardData.get(normalizeCardName(getPrimaryCardName(entry.name)));
    if (!card) continue;
    if (getCardType(card).includes("land")) continue;
    if (!legalForCommander(card.colors, commander.colors)) continue;

    usable.push(card);
  }

  return usable;
}

// The share of this commander's deck the collection can fill from EDHREC's own
// recommendations, which is the same quantity that decides how much of a real
// build falls through to generic collection scoring. Capped at 100: owning
// more candidates than there are slots is a full deck, not a 140% one.
function computeCommanderMatch(commander, pool, collection, cardData) {
  const usable = collectUsablePoolCards(commander, pool, collection, cardData);

  const byBucket = {};
  for (const card of usable) {
    const bucket = getDeckTypeBucket(getCardType(card));
    byBucket[bucket] = (byBucket[bucket] || 0) + 1;
  }

  // No themes to hand it: the type mix comes from EDHREC's own averages here,
  // and the profile only fills in where those are missing.
  const strategyProfile = getCommanderStrategyProfile(commander.names[0], [], commander.colors);
  const typePlan = buildTypeTargetPlan(
    pool?.typeAverages,
    strategyProfile,
    recommendLandCount(commander.colors),
    [],
    commander.deckSize
  );

  const slots = Math.max(1, typePlan.nonlandCount);

  return {
    usable: usable.length,
    slots,
    percent: Math.min(100, Math.round((usable.length / slots) * 100)),
    byBucket
  };
}
