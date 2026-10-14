// ManaBox CSV parsing and lookups over the parsed collection.
//
// parseCSV resolves to a collection object shaped as:
//   { byNormalized: Map<string, number>, entries, originals, uniqueRawNames }
// where `originals` is an alias of `entries` kept for older callers.
//
// Depends on: cards.js, text.js

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

// EDHREC names a two-faced card by its front face, while the CSV lists it as
// "Front // Back", so an exact-name check alone reports those cards unowned
// and drops them from the EDHREC candidate pool.
function hasOwnedCard(collectionData, cardName) {
  const normalized = normalizeCardName(cardName);
  if (collectionData.byNormalized.has(normalized)) return true;
  if (collectionData.byFrontFace?.has(normalized)) return true;
  return isBasicLand(cardName);
}

function getCollectionEntries(collectionData) {
  if (Array.isArray(collectionData?.entries)) return collectionData.entries;
  return Array.isArray(collectionData?.originals) ? collectionData.originals : [];
}

// ManaBox's full export adds Binder Name and Binder Type columns: every row is a
// card in a binder, in a deck, or on a wish list ("list"). A single-binder export
// has neither column. Wish-list rows are cards the player does not own, so they
// are never counted; deck rows are owned but already built into a deck, so
// whether to count them is the player's call (includeDecks, off by default).
//
// Rows keep their binder type so that choice can change without re-reading the
// file.
function parseCsvText(text) {
  const lines = String(text || "").split(/\r?\n/).filter(Boolean);

  if (lines.length < 2) throw new Error("CSV file appears to be empty.");

  const header = splitCsvLine(lines[0]).map((x) => x.trim().toLowerCase());
  const nameIndex = header.findIndex((h) => h === "name");
  const qtyIndex = header.findIndex((h) => h === "quantity");
  const typeIndex = header.findIndex((h) => h === "binder type");

  if (nameIndex === -1 || qtyIndex === -1) {
    throw new Error("CSV must contain Name and Quantity columns.");
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (!cols.length) continue;

    const rawName = (cols[nameIndex] || "").trim();
    if (!rawName) continue;

    const quantity = Number.parseInt((cols[qtyIndex] || "").trim(), 10);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;

    // No column, or an unrecognised value, means a plain binder row.
    const type = typeIndex === -1 ? "binder" : String(cols[typeIndex] || "").trim().toLowerCase();
    rows.push({ rawName, quantity, binderType: type === "deck" || type === "list" ? type : "binder" });
  }

  return rows;
}

function buildCollectionFromRows(rows, options = {}) {
  const includeDecks = options.includeDecks === true;
  const summary = { binder: 0, deck: 0, list: 0 };
  const byNormalized = new Map();
  const firstSeenName = new Map();

  for (const row of rows) {
    summary[row.binderType] += row.quantity;
    if (row.binderType === "list") continue;
    if (row.binderType === "deck" && !includeDecks) continue;

    const normalizedName = normalizeCardName(row.rawName);
    byNormalized.set(normalizedName, (byNormalized.get(normalizedName) || 0) + row.quantity);
    if (!firstSeenName.has(normalizedName)) firstSeenName.set(normalizedName, row.rawName);
  }

  const entries = Array.from(byNormalized.entries()).map(([normalizedName, quantity]) => ({
    rawName: firstSeenName.get(normalizedName) || normalizedName,
    normalizedName,
    quantity
  }));

  // Front-face aliases for the two-faced cards, kept in their own map so
  // a real single-faced card of the same name always wins the lookup.
  const byFrontFace = new Map();
  for (const entry of entries) {
    const front = normalizeCardName(getPrimaryCardName(entry.normalizedName));
    if (!front || front === entry.normalizedName) continue;
    if (byNormalized.has(front) || byFrontFace.has(front)) continue;
    byFrontFace.set(front, entry.quantity);
  }

  return {
    byNormalized,
    byFrontFace,
    entries,
    originals: entries,
    uniqueRawNames: entries.map((entry) => entry.rawName),
    // For the "count my decks" choice: the rows to rebuild from, and what the
    // export held.
    sourceRows: rows,
    binderSummary: summary,
    includesDecks: includeDecks
  };
}

async function parseCSV(file, options = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        resolve(buildCollectionFromRows(parseCsvText(String(event.target.result || "")), options));
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read CSV file."));
    reader.readAsText(file);
  });
}
