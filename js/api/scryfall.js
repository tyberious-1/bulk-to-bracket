// Scryfall access: single-card lookups, autocomplete, and the batched
// collection endpoint used to hydrate an entire uploaded CSV.
//
// Depends on: cache.js, constants.js, http.js, text.js, themes.js

function pickCommanderImage(data) {
  if (data.image_uris?.normal) return data.image_uris.normal;
  if (Array.isArray(data.card_faces)) {
    for (const face of data.card_faces) {
      if (face.image_uris?.normal) return face.image_uris.normal;
    }
  }
  return "";
}

// Two-faced cards carry no top-level oracle_text -- the rules text lives on
// each entry of card_faces. Join them so text-based detection (roles, tags,
// themes, commander pairing) sees the whole card rather than nothing at all.
function readOracleText(data) {
  if (data?.oracle_text) return String(data.oracle_text);
  if (!Array.isArray(data?.card_faces)) return "";
  return data.card_faces
    .map((face) => String(face?.oracle_text || ""))
    .filter(Boolean)
    .join("\n");
}

// Transform/modal-DFC layouts carry no top-level mana_cost -- it's on
// card_faces[0] instead (the front face, the one you'd actually list in a
// decklist and cast from hand). Split-layout cards DO have a top-level
// mana_cost, but it's both halves joined with " // " (e.g. "{2}{R} // {1}{R}")
// -- that string is handled by parsePips itself (manabase.js), which only
// reads the first half, since a split card is cast as one side, not both.
function readManaCost(data) {
  if (data?.mana_cost) return String(data.mana_cost);
  if (!Array.isArray(data?.card_faces)) return "";
  return String(data.card_faces[0]?.mana_cost || "");
}

function convertScryfallCard(data) {
  const producedMana =
    Array.isArray(data.produced_mana) ? data.produced_mana :
    Array.isArray(data.color_identity) ? data.color_identity :
    [];

  const oracleText = readOracleText(data);

  return {
    name: data.name,
    type: String(data.type_line || "").toLowerCase(),
    rawType: String(data.type_line || ""),
    text: oracleText.toLowerCase(),
    rawText: oracleText,
    cmc: Number(data.cmc || 0),
    colors: Array.isArray(data.color_identity) ? data.color_identity : [],
    rarity: String(data.rarity || "").toLowerCase(),
    layout: String(data.layout || "").toLowerCase(),
    producedMana,
    imageUrl: pickCommanderImage(data),
    manaCost: readManaCost(data),
    scryfallUrl: data.scryfall_uri || "",
    raw: slimScryfallRaw(data)
  };
}

async function fetchScryfallCardByName(cardName) {
  const cleaned = cleanCardNameForLookup(cardName);
  if (!cleaned) throw new Error("Missing card name for Scryfall lookup.");

  let response = await fetch(`${SCRYFALL_NAMED}${encodeCardNameForScryfall(cleaned)}`);
  if (response.ok) return await response.json();

  response = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeCardNameForScryfall(cleaned)}`);
  if (response.ok) return await response.json();

  throw new Error(`Scryfall lookup failed for ${cardName}`);
}

async function getCommander(name) {
  try {
    const data = await fetchScryfallCardByName(name);
    return convertScryfallCard(data);
  } catch (error) {
    console.warn("Commander lookup failed", name, error);
    return null;
  }
}

async function fetchCommanderAutocomplete(query) {
  const response = await fetch(`${SCRYFALL_AUTOCOMPLETE}${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error("Autocomplete request failed.");
  const data = await response.json();
  return Array.isArray(data.data) ? data.data.slice(0, 12) : [];
}

// The map callers get back is keyed by the names their CSV used, but EDHREC
// names a two-faced card by its front face alone, so it has to answer to that
// spelling too.
function collectCachedCards(uniqueNames) {
  const results = new Map();

  for (const name of uniqueNames) {
    const cached = cardCache.get(name);
    if (cached) results.set(name, cached);
  }

  for (const card of Array.from(results.values())) indexCardByFrontFace(results, card);

  return results;
}

// Layouts that are never part of a deck. A name lookup can land on one when a real card shares its name (No Way Out is both an
// Innistrad: Midnight Hunt instant and a Planechase plane); the plane is colorless, so it fit every deck and Moxfield then
// flagged the black instant.
const NON_DECK_LAYOUTS = new Set(["planar", "scheme", "vanguard", "token", "double_faced_token", "emblem", "art_series", "augment", "host"]);

function isNonDeckLayout(card) {
  return NON_DECK_LAYOUTS.has(String(card?.layout || "").toLowerCase());
}

// The deck-legal card behind a name whose first answer was not one, or null when Scryfall has none.
async function fetchPlayableCardByName(cardName, signal) {
  const query = `!"${cleanCardNameForLookup(cardName)}" -layout:planar -layout:scheme -layout:vanguard -layout:token -layout:double_faced_token -layout:emblem -layout:art_series -layout:augment -layout:host`;
  try {
    const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`, { signal });
    if (!response.ok) return null;
    const data = await response.json();
    const found = Array.isArray(data.data) && data.data[0];
    return found ? convertScryfallCard(found) : null;
  } catch (error) {
    return null;
  }
}

// Collection requests: 75 names is the endpoint's maximum. A request that never answers used to hold the whole load (and the
// "Reading your collection..." message) forever, so each gets a deadline, a couple run at once, and the cache is saved every few
// requests rather than once at the end -- a stall, reload or killed tab then costs one batch, not the whole read.
const SCRYFALL_CHUNK_SIZE = 75;
const SCRYFALL_CHUNK_TIMEOUT_MS = 20000;
const SCRYFALL_CHUNK_ATTEMPTS = 4;
const SCRYFALL_CONCURRENCY = 2;
const SCRYFALL_CHUNK_GAP_MS = 120;
const SCRYFALL_PERSIST_EVERY_CHUNKS = 8;
const SCRYFALL_RATE_LIMIT_WAIT_MS = 3000;
const SCRYFALL_RATE_LIMIT_WAIT_MAX_MS = 15000;

async function fetchCardDataBatchWithProgress(cardNames, progressCallback) {
  await cardCacheReady;

  const uniqueNames = Array.from(new Set(cardNames.map(normalizeCardName)));
  const missingNames = uniqueNames.filter((name) => !cardCache.has(name));
  const total = missingNames.length;
  let done = 0;

  if (total === 0) {
    if (progressCallback) progressCallback(0, 0);
    return collectCachedCards(uniqueNames);
  }

  const chunks = [];
  for (let i = 0; i < missingNames.length; i += SCRYFALL_CHUNK_SIZE) {
    chunks.push(missingNames.slice(i, i + SCRYFALL_CHUNK_SIZE));
  }

  // Resolves to the cards this chunk added to the cache (the ones worth saving).
  async function fetchChunk(chunk, attempt = 1) {
    // The collection endpoint has no entry under "Front // Back" -- that
    // spelling comes back in not_found, so asking with the name a ManaBox CSV
    // uses drops every two-faced card in the collection. The front face alone
    // resolves to the whole card.
    const identifiers = chunk.map((name) => ({ name: cleanCardNameForLookup(name) }));

    // One deadline covers the headers and the body read, and the playable-card re-searches below.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SCRYFALL_CHUNK_TIMEOUT_MS);

    try {
      const response = await fetch(SCRYFALL_COLLECTION, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers }),
        signal: controller.signal
      });

      if (!response.ok) {
        const failure = new Error(`Scryfall collection request failed with status ${response.status}.`);
        if (response.status === 429) {
          const retryAfter = Number(response.headers && response.headers.get && response.headers.get("Retry-After"));
          failure.rateLimitWaitMs = Math.min(
            SCRYFALL_RATE_LIMIT_WAIT_MAX_MS,
            Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : SCRYFALL_RATE_LIMIT_WAIT_MS * attempt
          );
        }
        throw failure;
      }

      const data = await response.json();
      const returnedCards = Array.isArray(data.data) ? data.data : [];

      const convertedCards = [];
      for (const rawCard of returnedCards) {
        let converted = convertScryfallCard(rawCard);
        if (isNonDeckLayout(converted)) {
          const playable = await fetchPlayableCardByName(converted.name, controller.signal);
          if (playable) converted = playable;
        }
        convertedCards.push(converted);
      }

      for (const converted of convertedCards) {
        cardCache.set(normalizeCardName(converted.name), converted);
      }

      // Separate pass, so a genuine single-faced card is always cached before
      // any front-face alias could claim its name.
      for (const converted of convertedCards) {
        indexCardByFrontFace(cardCache, converted);
      }

      for (const requestedName of chunk) {
        if (!cardCache.has(requestedName)) cardCache.set(requestedName, null);
      }

      return convertedCards;
    } catch (error) {
      if (attempt < SCRYFALL_CHUNK_ATTEMPTS) {
        const waitMs = error && error.rateLimitWaitMs ? error.rateLimitWaitMs : 300 * attempt;
        console.warn(`Retrying Scryfall chunk (${attempt}) after failure.`, error);
        await sleep(waitMs);
        return fetchChunk(chunk, attempt + 1);
      }

      console.warn("Scryfall chunk failed after retries; marking cards as unavailable.", error);
      for (const requestedName of chunk) {
        if (!cardCache.has(requestedName)) cardCache.set(requestedName, null);
      }
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  let nextChunk = 0;
  let pendingSave = [];
  let chunksSinceSave = 0;

  async function savePending() {
    if (!pendingSave.length) return;
    const cards = pendingSave;
    pendingSave = [];
    await persistCardsToStorage(cards);
  }

  async function worker() {
    while (nextChunk < chunks.length) {
      const chunk = chunks[nextChunk++];
      const cards = await fetchChunk(chunk);
      for (const card of cards) pendingSave.push(card);
      done += chunk.length;
      if (progressCallback) progressCallback(done, total);

      chunksSinceSave += 1;
      if (chunksSinceSave >= SCRYFALL_PERSIST_EVERY_CHUNKS) {
        chunksSinceSave = 0;
        await savePending();
      }
      await sleep(SCRYFALL_CHUNK_GAP_MS);
    }
  }

  await Promise.all(Array.from({ length: Math.min(SCRYFALL_CONCURRENCY, chunks.length) }, worker));
  await savePending();

  return collectCachedCards(uniqueNames);
}

// A tag matching more of the format than this is describing Magic rather than
// a deck theme. Measured against a color identity, the two worst offenders --
// triggered-ability and activated-ability -- sit at 6,235 and 4,510, while the
// broadest genuine theme, five-color burn, reaches 3,028. One page of a
// mechanic tag is just the format's most-played staples, which is precisely the
// generic filler the theme gate exists to keep out.
const SCRYFALL_THEME_TAG_MAX_CARDS = 3500;

// Cards carrying one functional tag, within a color identity.
//
// A 404 means Scryfall has no tag by that name. That is the expected answer for
// most candidates getScryfallThemeTags proposes, so it is not worth reporting.
//
// order=edhrec matters: a tag can match thousands of cards, and one page of the
// most-played beats one page of the alphabetically first.
async function fetchScryfallTaggedCardNames(tag, identity) {
  const query = `otag:${tag} identity<=${identity}`;
  const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&order=edhrec&unique=cards`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    if (Number(data.total_cards || 0) > SCRYFALL_THEME_TAG_MAX_CARDS) return [];

    return Array.isArray(data.data) ? data.data.map((card) => card.name).filter(Boolean) : [];
  } catch (error) {
    console.warn(`Scryfall tag lookup failed for "${tag}".`, error);
    return [];
  }
}

// Scryfall's functional tags (otag:) are curated by hand rather than derived
// from card text, so they see what a text search cannot: otag:landfall returns
// 174 Gruul cards where oracle:landfall returns 120, the difference being cards
// that trigger on a land entering without ever using the word.
//
// Only consulted for themes local text matching could not answer. EDHREC's name
// for a theme is rarely Scryfall's name for the tag, so several spellings are
// tried in turn -- see getScryfallThemeTags. The first that returns anything
// wins; a theme Scryfall has no tag for costs a handful of 404s and falls
// through to the EDHREC theme-page fingerprint.
async function fetchScryfallThemeCardNames(theme, commanderColors) {
  const identity = commanderColors.length ? commanderColors.join("") : "c";

  for (const tag of getScryfallThemeTags(theme)) {
    const names = await fetchScryfallTaggedCardNames(tag, identity);
    if (names.length) return names;
  }

  return [];
}
