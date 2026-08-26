// Scryfall access: single-card lookups, autocomplete, and the batched
// collection endpoint used to hydrate an entire uploaded CSV.
//
// Depends on: cache.js, constants.js, http.js, text.js

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
    layout: String(data.layout || "").toLowerCase(),
    legalities: data.legalities || {},
    producedMana,
    imageUrl: pickCommanderImage(data),
    manaCost: String(data.mana_cost || ""),
    scryfallUrl: data.scryfall_uri || "",
    raw: data
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

async function fetchCardDataBatchWithProgress(cardNames, progressCallback) {
  const uniqueNames = Array.from(new Set(cardNames.map(normalizeCardName)));
  const missingNames = uniqueNames.filter((name) => !cardCache.has(name));
  const total = missingNames.length;
  let done = 0;

  if (total === 0) {
    if (progressCallback) progressCallback(0, 0);
    return new Map(
      uniqueNames
        .map((name) => [name, cardCache.get(name)])
        .filter(([, value]) => value)
    );
  }

  const chunkSize = 75;
  const chunks = [];
  for (let i = 0; i < missingNames.length; i += chunkSize) {
    chunks.push(missingNames.slice(i, i + chunkSize));
  }

  async function fetchChunk(chunk, attempt = 1) {
    const identifiers = chunk.map((name) => ({ name }));

    try {
      const response = await fetch(SCRYFALL_COLLECTION, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers })
      });

      if (!response.ok) {
        throw new Error(`Scryfall collection request failed with status ${response.status}.`);
      }

      const data = await response.json();
      const returnedCards = Array.isArray(data.data) ? data.data : [];

      const convertedCards = returnedCards.map((rawCard) => convertScryfallCard(rawCard));

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
    } catch (error) {
      if (attempt < 4) {
        const waitMs = 300 * attempt;
        console.warn(`Retrying Scryfall chunk (${attempt}) after failure.`, error);
        await sleep(waitMs);
        return fetchChunk(chunk, attempt + 1);
      }

      console.warn("Scryfall chunk failed after retries; marking cards as unavailable.", error);
      for (const requestedName of chunk) {
        if (!cardCache.has(requestedName)) cardCache.set(requestedName, null);
      }
    }
  }

  for (const chunk of chunks) {
    await fetchChunk(chunk);
    done += chunk.length;
    if (progressCallback) progressCallback(done, total);
    await sleep(120);
  }

  persistCardCacheToStorage();

  const results = new Map();
  for (const name of uniqueNames) {
    const cached = cardCache.get(name);
    if (cached) results.set(name, cached);
  }

  return results;
}
