// Fetches the Commander precon decklists (2022 onward, Collector editions dropped) from MTGJSON and writes
// dev/tools/jxa-harness/precon_full.json, the reference decks shared_terms.js measures the floor from.
// The file is git-ignored (several MB); rerun this to regenerate it.
// Usage: node dev/tools/jxa-harness/fetch_precons.js
const fs = require("fs");
const path = require("path");
const HEADERS = { headers: { "User-Agent": "bulk-to-bracket-test" } };

(async () => {
  const list = (await (await fetch("https://mtgjson.com/api/v5/DeckList.json", HEADERS)).json()).data
    .filter((x) => x.type === "Commander Deck" && x.releaseDate >= "2022-01-01" && !/Collector/.test(x.name));
  const out = [];
  for (const x of list) {
    try {
      const d = (await (await fetch(`https://mtgjson.com/api/v5/decks/${x.fileName}.json`, HEADERS)).json()).data;
      const slim = (c) => ({ name: c.name, count: c.count || 1, type: c.type, types: c.types, subtypes: c.subtypes, text: c.text || "", manaValue: c.manaValue, colorIdentity: c.colorIdentity, layout: c.layout, faceName: c.faceName });
      out.push({ name: x.name, year: x.releaseDate.slice(0, 4), commander: (d.commander || []).map(slim), main: (d.mainBoard || []).map(slim) });
    } catch (e) { /* a deck that fails to fetch is skipped */ }
  }
  fs.writeFileSync(path.join(__dirname, "precon_full.json"), JSON.stringify(out));
  console.log(out.length, "decks");
})();
