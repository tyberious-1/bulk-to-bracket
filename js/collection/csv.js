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

function hasOwnedCard(collectionData, cardName) {
  const normalized = normalizeCardName(cardName);
  return collectionData.byNormalized.has(normalized) || isBasicLand(cardName);
}

function getCollectionEntries(collectionData) {
  if (Array.isArray(collectionData?.entries)) return collectionData.entries;
  return Array.isArray(collectionData?.originals) ? collectionData.originals : [];
}

async function parseCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = String(event.target.result || "");
        const lines = text.split(/\r?\n/).filter(Boolean);

        if (lines.length < 2) throw new Error("CSV file appears to be empty.");

        const header = splitCsvLine(lines[0]).map((x) => x.trim().toLowerCase());
        const nameIndex = header.findIndex((h) => h === "name");
        const qtyIndex = header.findIndex((h) => h === "quantity");

        if (nameIndex === -1 || qtyIndex === -1) {
          throw new Error("CSV must contain Name and Quantity columns.");
        }

        const byNormalized = new Map();
        const firstSeenName = new Map();

        for (let i = 1; i < lines.length; i++) {
          const cols = splitCsvLine(lines[i]);
          if (!cols.length) continue;

          const rawName = (cols[nameIndex] || "").trim();
          const rawQty = (cols[qtyIndex] || "").trim();
          if (!rawName) continue;

          const quantity = Number.parseInt(rawQty, 10);
          if (!Number.isFinite(quantity) || quantity <= 0) continue;

          const normalizedName = normalizeCardName(rawName);
          byNormalized.set(normalizedName, (byNormalized.get(normalizedName) || 0) + quantity);
          if (!firstSeenName.has(normalizedName)) firstSeenName.set(normalizedName, rawName);
        }

        const entries = Array.from(byNormalized.entries()).map(([normalizedName, quantity]) => ({
          rawName: firstSeenName.get(normalizedName) || normalizedName,
          normalizedName,
          quantity
        }));

        resolve({
          byNormalized,
          entries,
          originals: entries,
          uniqueRawNames: entries.map((entry) => entry.rawName)
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read CSV file."));
    reader.readAsText(file);
  });
}
