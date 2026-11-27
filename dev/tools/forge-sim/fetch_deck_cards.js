// Fetch Scryfall type, power and rules text for every card in the given Forge .dck files that the owned collection dump lacks
// (the Forge precons), so board.js and removal_targets.js can read them. Replaces fetch_deck_cards.py (2026-11-26: it kept
// no text, and work/precon_cards.json had gone stale: Admiral Brass's and Zinnia's decks were missing, so their creatures
// read as noncreatures).
//
// Usage (repo root): node dev/tools/forge-sim/fetch_deck_cards.js <out.json> <deck.dck> [<deck.dck> ...]
// Sends card names only. Needs the explicit Accept header (Scryfall 400s the collection endpoint without it).
const fs = require("fs");
const path = require("path");

const [, , out, ...decks] = process.argv;
if (!out || !decks.length) { console.error("usage: fetch_deck_cards.js <out.json> <deck.dck>..."); process.exit(1); }
const ROOT = path.resolve(__dirname, "..", "..", "..");
const owned = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, "dev", "tools", "jxa-harness", "owned_raw.json"), "utf8")).map((c) => String(c.name).split(" // ")[0]));
const names = new Set();
for (const d of decks) {
  for (const line of fs.readFileSync(d, "utf8").split("\n")) {
    const m = line.match(/^\d+ (.+?)\s*$/);
    if (m) names.add(m[1].split("|")[0].split(" // ")[0]); // Forge precons write "Name|SET|n"
  }
}
const want = [...names].filter((n) => !owned.has(n)).sort();

(async () => {
  const cards = [];
  const missing = [];
  for (let i = 0; i < want.length; i += 75) {
    const chunk = want.slice(i, i + 75);
    const res = await fetch("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "btb-forge-sim/1.0" },
      body: JSON.stringify({ identifiers: chunk.map((name) => ({ name })) }),
    });
    if (!res.ok) throw new Error(`Scryfall ${res.status}`);
    const data = await res.json();
    for (const c of data.data || []) {
      const face = (c.card_faces || [])[0] || {};
      cards.push({
        name: c.name,
        power: c.power ?? face.power ?? null,
        type_line: c.type_line || face.type_line || "",
        oracle_text: [c.oracle_text, ...(c.card_faces || []).map((f) => f.oracle_text)].filter(Boolean).join("\n"),
      });
    }
    missing.push(...(data.not_found || []).map((x) => x.name));
    await new Promise((r) => setTimeout(r, 100));
  }
  fs.writeFileSync(out, JSON.stringify(cards));
  console.log(`wrote ${cards.length} cards from ${want.length} names not in the collection; not found: ${missing.length} ${missing.slice(0, 10).join(", ")}`);
})();
