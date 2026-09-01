// In-memory card cache, backed by localStorage so repeat visits skip most
// Scryfall traffic. Persisted entries are trimmed to the fields the builder
// actually reads and capped so the quota is never the failure mode.
//
// Depends on: text.js

// Bumped to v2: entries no longer carry `legalities`, so a v1 payload would
// waste most of the quota until it aged out.
const CARD_CACHE_STORAGE_KEY = "mtg_commander_builder_card_cache_v2";
const LEGACY_CARD_CACHE_STORAGE_KEYS = ["mtg_commander_builder_card_cache_v1"];
const MAX_PERSISTED_CACHE_ENTRIES = 8000;

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

// Reads the current payload, falling back to an older key so a version bump
// doesn't force a full re-fetch. Superseded payloads are always removed --
// left in place they would occupy quota the current key needs.
function readPersistedCachePayload() {
  const raw = localStorage.getItem(CARD_CACHE_STORAGE_KEY);

  let legacyRaw = null;
  for (const key of LEGACY_CARD_CACHE_STORAGE_KEYS) {
    if (!legacyRaw) legacyRaw = localStorage.getItem(key);
    localStorage.removeItem(key);
  }

  // Older entries carry fields the current shape drops; the restore below
  // reads by name, so the extras are simply ignored.
  return raw || legacyRaw;
}

function hydrateCardCacheFromStorage() {
  try {
    const raw = readPersistedCachePayload();
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

    // Freshest first, so whatever gets dropped below is the stalest.
    cards.sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0));

    // The quota is nominally ~5MB but varies by browser and by whatever else
    // this origin has stored, so rather than guess an entry count that always
    // fits, write as many as we can and halve on rejection.
    let count = Math.min(cards.length, MAX_PERSISTED_CACHE_ENTRIES);
    while (count > 0) {
      try {
        localStorage.setItem(CARD_CACHE_STORAGE_KEY, JSON.stringify(cards.slice(0, count)));
        return;
      } catch (error) {
        count = Math.floor(count / 2);
      }
    }

    // Nothing fit. Drop any previous payload rather than leaving a stale one.
    localStorage.removeItem(CARD_CACHE_STORAGE_KEY);
  } catch (error) {
    console.warn("Unable to persist local card cache.", error);
  }
}

// EDHREC's commander rankings are the same for everybody and change only as
// the site's deck counts move, so they are worth keeping across visits. Stored
// apart from the card cache: a different shape, a different lifetime, and a
// quota failure here must not cost the card data.
const COMMANDER_RANKINGS_STORAGE_KEY = "mtg_commander_builder_commander_ranks_v1";
const COMMANDER_RANKINGS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function readPersistedCommanderRankings() {
  try {
    const raw = localStorage.getItem(COMMANDER_RANKINGS_STORAGE_KEY);
    if (!raw) return null;

    const payload = JSON.parse(raw);
    if (!Array.isArray(payload?.rankings) || !payload.rankings.length) return null;
    if (Date.now() - Number(payload.savedAt || 0) > COMMANDER_RANKINGS_MAX_AGE_MS) {
      localStorage.removeItem(COMMANDER_RANKINGS_STORAGE_KEY);
      return null;
    }

    return payload.rankings;
  } catch (error) {
    console.warn("Unable to read cached commander rankings.", error);
    return null;
  }
}

function persistCommanderRankings(rankings) {
  try {
    localStorage.setItem(
      COMMANDER_RANKINGS_STORAGE_KEY,
      JSON.stringify({ savedAt: Date.now(), rankings })
    );
  } catch (error) {
    // Rankings are cheap to refetch; the card cache is not. Leave its quota
    // alone rather than trimming to make these fit.
    console.warn("Unable to persist commander rankings.", error);
  }
}
