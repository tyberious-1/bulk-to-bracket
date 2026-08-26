// Card-level accessors and predicates. Everything here takes a single card
// (either a raw Scryfall payload or our converted shape) and reads it
// defensively, since the two shapes name the same fields differently.
//
// Depends on: constants.js, text.js

const COMMANDER_PERMITTED_SUBTYPES = ["creature", "vehicle", "spacecraft"];

function getCardText(card) {
  return String(card?.text ?? card?.oracle_text ?? card?.rawText ?? "").toLowerCase();
}

function getCardType(card) {
  return String(card?.type ?? card?.type_line ?? card?.rawType ?? "").toLowerCase();
}

function sanitizeCard(card) {
  if (!card) return null;
  const type = getCardType(card);
  const text = getCardText(card);
  return {
    ...card,
    type,
    text,
    rawType: card.rawType ?? card.type_line ?? card.type ?? "",
    rawText: card.rawText ?? card.oracle_text ?? card.text ?? ""
  };
}

function sanitizeDeckCards(deck) {
  return (deck || []).map(sanitizeCard).filter(Boolean);
}

function getCardImageUrl(card) {
  if (!card) return "";

  if (card.imageUrl) return String(card.imageUrl);
  if (card.image_uris?.normal) return String(card.image_uris.normal);
  if (card.image_uris?.large) return String(card.image_uris.large);

  if (Array.isArray(card.card_faces)) {
    for (const face of card.card_faces) {
      if (face?.image_uris?.normal) return String(face.image_uris.normal);
      if (face?.image_uris?.large) return String(face.image_uris.large);
    }
  }

  if (card.image) return String(card.image);

  return "";
}

function sortColorsWubrg(colors = []) {
  const unique = Array.from(new Set((colors || []).filter(Boolean).map((color) => String(color).toUpperCase())));
  const weight = (color) => {
    const index = WUBRG_ORDER.indexOf(String(color || "").toUpperCase());
    return index === -1 ? 99 : index;
  };
  return unique.sort((a, b) => weight(a) - weight(b));
}

function isBasicLand(name) {
  const normalized = normalizeCardName(name);
  return BASIC_LANDS.some((land) => normalizeCardName(land.name) === normalized);
}

// GAME_CHANGERS stores single-face names, but Scryfall reports a modal
// double-faced card as "Front // Back" -- so "Tergrid, God of Fright" arrives
// as "Tergrid, God of Fright // Tergrid's Lantern". Try the front face too.
function isGameChanger(cardName) {
  if (GAME_CHANGERS.has(normalizeCardName(cardName))) return true;
  return GAME_CHANGERS.has(normalizeCardName(getPrimaryCardName(cardName)));
}

function legalForCommander(cardColors, commanderColors) {
  for (const color of cardColors) {
    if (!commanderColors.includes(color)) return false;
  }
  return true;
}

function canBeCommander(card) {
  const type = getCardType(card);
  const text = getCardText(card);

  // Backgrounds, planeswalker commanders and similar opt in by rules text.
  if (text.includes("can be your commander")) return true;

  // Only the front face can be the commander, so ignore anything after "//".
  const frontType = type.split("//")[0];
  if (!frontType.includes("legendary")) return false;

  // Never match on the bare phrase "legendary creature": real type lines
  // interleave supertypes ("Legendary Enchantment Creature", "Legendary
  // Artifact Creature", "Legendary Snow Creature"). Legendary Vehicles and
  // Spacecraft are also legal commanders even though they aren't creatures.
  return COMMANDER_PERMITTED_SUBTYPES.some((subtype) => frontType.includes(subtype));
}
