// In-memory card cache, backed by localStorage so repeat visits skip most
// Scryfall traffic. Persisted entries are trimmed to the fields the builder
// actually reads and capped so the quota is never the failure mode.
//
// Depends on: text.js

const CARD_CACHE_STORAGE_KEY = "mtg_commander_builder_card_cache_v1";
const MAX_PERSISTED_CACHE_ENTRIES = 2000;

const cardCache = new Map();

function trimCardForPersistentCache(card) {
  if (!card || typeof card !== "object") return null;
  return {
    name: card.name || "",
    type: card.type || "",
    rawType: card.rawType || "",
    text: card.text || "",
    rawText: card.rawText || "",
    cmc: Number(card.cmc || 0),
    colors: Array.isArray(card.colors) ? card.colors : [],
    layout: card.layout || "",
    legalities: card.legalities || {},
    producedMana: Array.isArray(card.producedMana) ? card.producedMana : [],
    imageUrl: card.imageUrl || "",
    manaCost: card.manaCost || "",
    scryfallUrl: card.scryfallUrl || "",
    savedAt: Date.now()
  };
}

function restoreCardFromPersistentCache(value) {
  if (!value || typeof value !== "object") return null;
  if (!value.name) return null;
  return {
    name: String(value.name || ""),
    type: String(value.type || "").toLowerCase(),
    rawType: String(value.rawType || value.type || ""),
    text: String(value.text || value.rawText || "").toLowerCase(),
    rawText: String(value.rawText || value.text || ""),
    cmc: Number(value.cmc || 0),
    colors: Array.isArray(value.colors) ? value.colors : [],
    layout: String(value.layout || "").toLowerCase(),
    legalities: value.legalities || {},
    producedMana: Array.isArray(value.producedMana) ? value.producedMana : [],
    imageUrl: String(value.imageUrl || ""),
    manaCost: String(value.manaCost || ""),
    scryfallUrl: String(value.scryfallUrl || "")
  };
}

// Scryfall names a two-faced card "Front // Back", but ManaBox CSVs and EDHREC
// both refer to it by its front face alone -- so the card gets cached under a
// key nothing ever looks up, and the front-face key gets marked as a miss.
// Alias the front face too. Covers modal DFCs, transforming cards and
// adventure cards.
//
// Never displaces a genuine single-faced card of the same name: an existing
// truthy entry wins, while a previously-cached miss (null) is replaced.
function indexCardByFrontFace(cache, card) {
  if (!card || !card.name) return;
  const canonical = normalizeCardName(card.name);
  const front = normalizeCardName(getPrimaryCardName(card.name));
  if (!front || front === canonical) return;
  if (cache.get(front)) return;
  cache.set(front, card);
}

function hydrateCardCacheFromStorage() {
  try {
    const raw = localStorage.getItem(CARD_CACHE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    const restored = [];
    for (const entry of parsed) {
      const card = restoreCardFromPersistentCache(entry);
      if (!card) continue;
      restored.push(card);
      cardCache.set(normalizeCardName(card.name), card);
    }

    // Only canonical names are persisted, so re-add the front-face aliases;
    // without this a warm cache would re-fetch every two-faced card.
    for (const card of restored) {
      indexCardByFrontFace(cardCache, card);
    }
  } catch (error) {
    console.warn("Unable to hydrate local card cache.", error);
  }
}

function persistCardCacheToStorage() {
  try {
    const cards = [];
    for (const [, value] of cardCache.entries()) {
      if (!value) continue;
      const trimmed = trimCardForPersistentCache(value);
      if (trimmed) cards.push(trimmed);
    }

    cards.sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0));
    const limited = cards.slice(0, MAX_PERSISTED_CACHE_ENTRIES);
    localStorage.setItem(CARD_CACHE_STORAGE_KEY, JSON.stringify(limited));
  } catch (error) {
    console.warn("Unable to persist local card cache.", error);
  }
}
