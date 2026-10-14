// Commander discovery: what does this collection support best?
//
// The usual path starts from a commander. This one starts from the pile -- the
// way the player found their first deck ("lots of Samurai and Warrior cards") --
// and ranks themes and tribes by how many owned cards serve them, so a fun
// commander is not missed just because nobody thought to look for it.
//
// Entries come from the Theme/Typal tab's catalog ({kind, tag, label, slug}).
// Counting is per card, once: a card's tags are detected a single time rather
// than once per catalog entry.
//
// Depends on: cards.js (getCardType/getCardText), scoring.js (detectCardTags)

// Below this a theme is a coincidence, not a plan.
const SUPPORT_MIN_CARDS = 12;
// Above this share of the collection a theme is generic (every deck has ramp)
// and says nothing about what makes this pile distinctive.
const SUPPORT_MAX_SHARE = 0.15;

// cards: iterable of card records (nonland counted only). entries: catalog
// entries. tribeFor(entry): the singular creature type for a tribal entry.
// Returns [{entry, count}] best-supported first.
function rankCollectionSupport(cards, entries, tribeFor) {
  const tribeMatchers = new Map();
  for (const entry of entries) {
    if (entry.kind !== "tribal") continue;
    const tribe = tribeFor(entry);
    // Rules text says "Elves you control" as often as "Elf", so the plural
    // (the entry's own tag) counts too: support is not only the creatures.
    if (tribe) {
      const plural = String(entry.tag || "").toLowerCase();
      const forms = plural && plural !== tribe ? `${tribe}|${plural}` : tribe;
      tribeMatchers.set(entry, new RegExp(`\\b(?:${forms})\\b`));
    }
  }

  const counts = new Map(entries.map((entry) => [entry, 0]));
  let total = 0;
  // The card cache indexes two-faced cards under their front face as well, so
  // the same card can arrive twice.
  const seen = new Set();

  for (const card of cards) {
    if (!card || getCardType(card).includes("land")) continue;
    if (seen.has(card.name)) continue;
    seen.add(card.name);
    total += 1;

    const tags = new Set(detectCardTags(card));
    const typeAndText = `${getCardType(card)} ${getCardText(card)}`;

    for (const entry of entries) {
      const hit = entry.kind === "tribal"
        ? tribeMatchers.has(entry) && tribeMatchers.get(entry).test(typeAndText)
        : tags.has(entry.tag);
      if (hit) counts.set(entry, counts.get(entry) + 1);
    }
  }

  return entries
    .map((entry) => ({ entry, count: counts.get(entry) }))
    .filter((row) => row.count >= SUPPORT_MIN_CARDS && row.count / Math.max(total, 1) <= SUPPORT_MAX_SHARE)
    .sort((a, b) => b.count - a.count);
}


// Type-line helpers for the Analytics tab.
//
// The tab used to read the type line as one string, which broke on every card
// whose line carries two faces ("Instant // Sorcery", an MDFC "Sorcery // Land"),
// on modifiers it did not know ("Basic Land", "Snow Instant", "Kindred Sorcery"),
// and filed every Human Warrior under Human alone. Cards are classified by
// their front face, and a card with several creature types counts under each.

function getFrontFaceTypeLine(typeLine) {
  return String(typeLine || "").toLowerCase().split("//")[0].trim();
}

// One of creature, planeswalker, battle, land, artifact, enchantment, instant,
// sorcery -- or null. A card with several types takes the first in that order,
// so an Artifact Creature is a creature and an Artifact Land is a land.
function classifyPrimaryType(typeLine) {
  const words = getFrontFaceTypeLine(typeLine).split("—")[0].split(/\s+/).filter(Boolean);
  for (const type of ["creature", "planeswalker", "battle", "land", "artifact", "enchantment", "instant", "sorcery"]) {
    if (words.includes(type)) return type;
  }
  return null;
}

function isLegendaryTypeLine(typeLine) {
  return getFrontFaceTypeLine(typeLine).split("—")[0].split(/\s+/).includes("legendary");
}

function isArtifactCreatureTypeLine(typeLine) {
  const words = getFrontFaceTypeLine(typeLine).split("—")[0].split(/\s+/);
  return words.includes("artifact") && words.includes("creature");
}

// Every subtype on the front face: "creature — human warrior" -> ["human", "warrior"].
function getTypeLineSubtypes(typeLine) {
  const parts = getFrontFaceTypeLine(typeLine).split("—");
  return parts.length > 1 ? parts[1].split(/\s+/).filter(Boolean) : [];
}
