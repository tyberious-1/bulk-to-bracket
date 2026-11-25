// fetch_manapool.js <manapool list url> "<commander>" <out.dck>: a public Mana Pool deck list as a Forge .dck.
// Reads the "Nx Card Name" rows the page renders; the commander row is matched by name. Name= is the commander's name.
const fs = require("fs");
const [url, commander, out] = process.argv.slice(2);
if (!url || !commander || !out) { console.error('usage: node fetch_manapool.js <url> "<commander>" <out.dck>'); process.exit(1); }
(async () => {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (deck-list reader)" } });
  if (!res.ok) { console.error(`HTTP ${res.status} for ${url}`); process.exit(1); }
  const html = await res.text();
  const rows = [...html.matchAll(/>(\d+)x<\/span>\s*<button[^>]*>(?:<!--[^>]*-->)*([^<]+?)(?:<!--|<)/g)]
    .map((m) => [Number(m[1]), m[2].replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').split(" // ")[0].trim()])
    // An alternate printing name carries the real one in brackets: "Hope's Aero Magic (Cyclonic Rift)" is Cyclonic Rift.
    .map(([q, name]) => { const m = /\(([^()]+)\)$/.exec(name); return [q, m ? m[1] : name]; });
  // The same card can sit on two rows (two printings of Swamp): add the counts.
  const counts = new Map();
  let commanderFound = false;
  for (const [q, name] of rows) {
    if (name === commander) { commanderFound = true; continue; }
    counts.set(name, (counts.get(name) || 0) + q);
  }
  const main = [...counts].map(([name, q]) => `${q} ${name}`);
  const count = main.reduce((s, l) => s + Number(l.split(" ")[0]), 0);
  fs.writeFileSync(out, `[metadata]\nName=${commander}\n[commander]\n1 ${commander}\n[main]\n${main.join("\n")}\n`);
  console.log(`wrote ${out}: ${count} cards + commander (commander row found: ${commanderFound})`);
})();
