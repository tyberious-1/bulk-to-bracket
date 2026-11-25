// Usage: node to_dck.js <deck.json from the harness dump> <outdir>   -- writes a Forge Commander .dck per commander.
const fs = require("fs");
const [, , file, outDir] = process.argv;
const decks = JSON.parse(fs.readFileSync(file, "utf8"));
for (const [name, d] of Object.entries(decks)) {
  const counts = new Map();
  for (const c of d.cards) counts.set(c, (counts.get(c) || 0) + 1);
  const lines = ["[metadata]", "Name=" + name, "[Commander]", "1 " + name, "[Main]"];
  for (const [card, n] of counts) lines.push(n + " " + card.split(" // ")[0]);
  const safe = name.split(",")[0].replace(/[^A-Za-z0-9]+/g, "_");
  fs.writeFileSync(outDir + "/" + safe + ".dck", lines.join("\n") + "\n");
  console.log(safe + ".dck", d.cards.length + " cards + commander");
}
