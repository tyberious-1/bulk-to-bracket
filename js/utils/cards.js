// Card-level accessors and predicates. Everything here takes a single card
// (either a raw Scryfall payload or our converted shape) and reads it
// defensively, since the two shapes name the same fields differently.
//
// Depends on: constants.js, text.js, format.js

const COMMANDER_PERMITTED_SUBTYPES = ["creature", "vehicle", "spacecraft"];

function getCardText(card) {
  return String(card?.text ?? card?.oracle_text ?? card?.rawText ?? "").toLowerCase();
}

function getCardType(card) {
  return String(card?.type ?? card?.type_line ?? card?.rawType ?? "").toLowerCase();
}

// The subtypes a card carries -- creature types, but also Equipment, Aura and
// the rest. Everything after the em dash, on both faces of a two-faced card.
// detectCardTags only names a handful of tribes, so this is what sees that
// seven different creatures are all Rogues.
function getCardSubtypes(card) {
  return getCardType(card)
    .split("//")
    .flatMap((face) => {
      const dash = face.indexOf("—");
      return dash === -1 ? [] : face.slice(dash + 1).trim().split(/\s+/);
    })
    .filter(Boolean);
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

// A commander that says "you can't cast <kind> spells" (Codie, Vociferous Codex: "You can't cast permanent spells.") makes
// those cards dead in its deck: they can't be cast while it is out (2026-11-26: the builder gave Codie 13 creatures and
// artifacts). Read once per build (performBuildFromContext) and checked in legalForCommander; null outside a build so other
// tabs are unaffected. Only an unconditional sentence counts ("...spells during combat" does not). Lands are played, not
// cast, and tokens a spell makes are not cast, so neither is blocked.
let activeCommanderCastBlock = null;
const CAST_BLOCK_PERMANENT_TYPES = ["artifact", "creature", "enchantment", "planeswalker", "battle"];

function readCommanderCastBlock(commanderTexts, commanderNames = []) {
  const kinds = [];
  for (const text of commanderTexts || []) {
    const lowered = String(text || "").toLowerCase().replace(/\([^)]*\)/g, "");
    const re = /(?:^|[.\n]\s*)you can't cast ((?:non)?[a-z]+(?:(?:,| or| and) (?:non)?[a-z]+)*) spells(?=\s*(?:[.\n]|$))/g;
    for (const m of lowered.matchAll(re)) kinds.push(...m[1].split(/,| or | and /).map((w) => w.trim()).filter(Boolean));
  }
  if (!kinds.length) return null;
  return { kinds, commanders: new Set((commanderNames || []).map((n) => normalizeCardName(n))) };
}

function setCommanderCastBlock(block) {
  activeCommanderCastBlock = block || null;
}

function faceCastBlocked(faceType, kinds) {
  const type = String(faceType || "").toLowerCase();
  if (/\bland\b/.test(type)) return false;
  const isPermanent = CAST_BLOCK_PERMANENT_TYPES.some((t) => new RegExp("\\b" + t + "\\b").test(type));
  return kinds.some((kind) => {
    if (kind === "permanent") return isPermanent;
    if (kind === "nonpermanent") return !isPermanent;
    if (kind.startsWith("non")) return !new RegExp("\\b" + kind.slice(3) + "\\b").test(type);
    return new RegExp("\\b" + kind.replace(/s$/, "") + "\\b").test(type);
  });
}

// True when the active commander forbids casting every face of this card.
function castBlockedByCommander(card) {
  const block = activeCommanderCastBlock;
  if (!block || !card) return false;
  if (block.commanders.has(normalizeCardName(card.name || ""))) return false;
  const faces = (card.raw && Array.isArray(card.raw.card_faces) && card.raw.card_faces.length)
    ? card.raw.card_faces.map((f) => f.type_line)
    : [card.typeLine || (card.raw && card.raw.type_line) || getCardType(card)];
  return faces.every((face) => faceCastBlocked(face, block.kinds));
}

function legalForCommander(cardColors, commanderColors, card) {
  if (card && castBlockedByCommander(card)) return false;
  // A plane, scheme, vanguard or token has no place in a deck whatever its colors (an old cached lookup can still hold one).
  if (card && /^(?:plane|phenomenon|scheme|ongoing scheme|vanguard|conspiracy|dungeon|emblem|token)\b/.test(getCardType(card).replace(/^(?:legendary|basic|snow|world)\s+/g, ""))) return false;
  for (const color of cardColors) {
    if (!commanderColors.includes(color)) return false;
  }
  if (isPauperFormat() && card && card.rarity !== "common") return false;
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

// Pauper Commander (PDH): any uncommon creature, legendary or not. No
// COMMANDER_PERMITTED_SUBTYPES escape hatch and no "can be your commander"
// text rule -- PDH's own rule is literally "any uncommon creature."
function canBePauperCommander(card) {
  const frontType = getCardType(card).split("//")[0];
  return card?.rarity === "uncommon" && frontType.includes("creature");
}

// A card whose own ability keys on a color the deck lacks ("Black creature spells you cast cost
// {1} less" in a blue deck). Colorless identity lets it past legalForCommander, but the ability
// never fires. Only "you cast / you control" phrasing counts: "destroy target black creature" is
// removal and works anywhere. A sentence naming several colors ("black or red") is dead only when
// the deck has none of them.
const DEAD_COLOR_WORDS = { white: "W", blue: "U", black: "B", red: "R", green: "G" };
const DEAD_COLOR_KEYED = /\b(?:white|blue|black|red|green) (?:\w+ )?(?:spells?|permanents?|creatures?)(?: cards?)? you (?:cast|control)\b/;

function deadForColors(card, colors) {
  for (const sentence of getCardText(card).split(/[.\n]/)) {
    if (!DEAD_COLOR_KEYED.test(sentence)) continue;
    const named = Object.keys(DEAD_COLOR_WORDS).filter((word) => new RegExp(`\\b${word}\\b`).test(sentence));
    if (!named.some((word) => colors.includes(DEAD_COLOR_WORDS[word]))) return true;
  }
  return false;
}
