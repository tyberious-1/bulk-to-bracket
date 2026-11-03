// In-memory card cache, backed by IndexedDB (localStorage where IndexedDB is
// missing or fails) so repeat visits skip most Scryfall traffic. Persisted
// entries are trimmed to the fields the builder actually reads. localStorage's
// ~5MB quota held only about half of a large collection in Firefox, so the
// IndexedDB store is the primary home and has no entry cap.
//
// Depends on: text.js

// Bumped to v3: DFC/split cards persisted under v2 carry an empty manaCost
// (fixed going forward -- see js/api/scryfall.js's readManaCost and
// js/build/manabase.js's parsePips). A cache hit never re-fetches, so
// falling back to v2 data the way earlier bumps did would keep serving that
// stale, empty manaCost forever for anyone with a warm cache. No fallback to
// v2 (or v1) this time -- a one-time full re-fetch instead.
// Bumped to v5: persisted cards now keep rarity and a slimmed `raw`, which v4
// entries lack (a warm v4 cache built Pauper decks without rarity and ranked
// ties without keywords or popularity).
const CARD_CACHE_STORAGE_KEY = "mtg_commander_builder_card_cache_v5";
const LEGACY_CARD_CACHE_STORAGE_KEYS = [
  "mtg_commander_builder_card_cache_v1",
  "mtg_commander_builder_card_cache_v2",
  "mtg_commander_builder_card_cache_v3",
  "mtg_commander_builder_card_cache_v4"
];
const CARD_DB_NAME = "mtg_commander_builder_cards_v5";
const CARD_DB_STORE = "cards";
const CARD_DB_TIMEOUT_MS = 8000;
const MAX_PERSISTED_CACHE_ENTRIES = 8000;

const cardCache = new Map();

// Resolves once the IndexedDB copy has been merged into cardCache; the batch
// loader awaits it so a first upload does not refetch what is already stored.
let cardCacheReady = Promise.resolve();

// Scryfall's full record runs about 5KB a card; the builder reads only these
// fields of it (keywords, popularity rank, crew power/toughness, face text).
function slimScryfallRaw(raw) {
  if (!raw || typeof raw !== "object") return undefined;
  const slim = {};
  if (Array.isArray(raw.keywords)) slim.keywords = raw.keywords;
  if (raw.edhrec_rank !== undefined) slim.edhrec_rank = raw.edhrec_rank;
  if (raw.power !== undefined) slim.power = raw.power;
  if (raw.toughness !== undefined) slim.toughness = raw.toughness;
  if (raw.oracle_text) slim.oracle_text = raw.oracle_text;
  if (Array.isArray(raw.card_faces)) {
    slim.card_faces = raw.card_faces.map((face) => ({ name: face && face.name, oracle_text: face && face.oracle_text }));
  }
  return slim;
}

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
    rarity: card.rarity || "",
    layout: card.layout || "",
    producedMana: Array.isArray(card.producedMana) ? card.producedMana : [],
    imageUrl: card.imageUrl || "",
    manaCost: card.manaCost || "",
    scryfallUrl: card.scryfallUrl || "",
    raw: slimScryfallRaw(card.raw),
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
    rarity: String(value.rarity || "").toLowerCase(),
    layout: String(value.layout || "").toLowerCase(),
    producedMana: Array.isArray(value.producedMana) ? value.producedMana : [],
    imageUrl: String(value.imageUrl || ""),
    manaCost: String(value.manaCost || ""),
    scryfallUrl: String(value.scryfallUrl || ""),
    raw: value.raw && typeof value.raw === "object" ? value.raw : undefined
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

// Reads the current payload. Legacy keys are only ever cleaned up here, never
// read as a fallback -- unlike the v1->v2 bump, v2's persisted manaCost for
// DFC/split cards is wrong, not just differently-shaped, so serving it back
// would silently undo the fix that motivated this bump.
function readPersistedCachePayload() {
  for (const key of LEGACY_CARD_CACHE_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }

  return localStorage.getItem(CARD_CACHE_STORAGE_KEY);
}

function hydrateCardCacheFromStorage() {
  // Started first: the localStorage block below returns early when its copy is empty, which is
  // the normal state once IndexedDB holds the cards.
  cardCacheReady = withCardDbTimeout(hydrateCardCacheFromIndexedDb(), false);

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

// IndexedDB side. Every function resolves (never rejects, never hangs past
// CARD_DB_TIMEOUT_MS) so a broken or blocked database can only cost the cache,
// not stall a build.
let cardDbPromise = null;

function withCardDbTimeout(promise, fallbackValue) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallbackValue), CARD_DB_TIMEOUT_MS);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(fallbackValue); }
    );
  });
}

function openCardDb() {
  if (cardDbPromise) return cardDbPromise;
  cardDbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined" || !indexedDB) return resolve(null);
      const request = indexedDB.open(CARD_DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(CARD_DB_STORE)) request.result.createObjectStore(CARD_DB_STORE);
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch (error) {
      resolve(null);
    }
  });
  return cardDbPromise;
}

async function hydrateCardCacheFromIndexedDb() {
  const db = await openCardDb();
  if (!db) return false;

  try {
    const records = await new Promise((resolve, reject) => {
      const request = db.transaction(CARD_DB_STORE, "readonly").objectStore(CARD_DB_STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    const restored = [];
    for (const record of records) {
      const card = restoreCardFromPersistentCache(record);
      if (!card) continue;
      restored.push(card);
      const key = normalizeCardName(card.name);
      if (!cardCache.has(key)) cardCache.set(key, card);
    }
    for (const card of restored) indexCardByFrontFace(cardCache, card);
    return true;
  } catch (error) {
    console.warn("Unable to hydrate card cache from IndexedDB.", error);
    return false;
  }
}

// Writes just these cards (one transaction), so a large collection is saved a
// batch at a time instead of in one rewrite at the end. Falls back to the
// localStorage payload when IndexedDB is unavailable or rejects the write.
async function persistCardsToStorage(cards) {
  const db = await openCardDb();
  if (db) {
    const written = await withCardDbTimeout(new Promise((resolve) => {
      try {
        const transaction = db.transaction(CARD_DB_STORE, "readwrite");
        const store = transaction.objectStore(CARD_DB_STORE);
        for (const card of cards) {
          const trimmed = trimCardForPersistentCache(card);
          if (trimmed) store.put(trimmed, normalizeCardName(trimmed.name));
        }
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => resolve(false);
        transaction.onabort = () => resolve(false);
      } catch (error) {
        resolve(false);
      }
    }), false);

    if (written) {
      // The localStorage copy is now redundant; free its quota.
      try { localStorage.removeItem(CARD_CACHE_STORAGE_KEY); } catch (error) { /* best effort */ }
      return;
    }
  }

  persistCardCacheToStorage();
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
