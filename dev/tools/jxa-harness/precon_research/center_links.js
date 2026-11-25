// Which owned cards link into a commander's center, and how. Usage:
//   node dev/tools/jxa-harness/precon_research/center_links.js PREFETCH_DIR "Commander" COLORS [limit]
// COLORS like "U" or "BG": only owned cards inside those colors are listed. Reads owned_raw.json.
const fs = require("fs"), vm = require("vm"), path = require("path");
const root = path.join(__dirname, "../../../..");
const ctx = vm.createContext({ window: {}, localStorage: { getItem() { return null; }, setItem() {} } });
for (const f of ["js/constants.js", "js/utils/text.js", "js/utils/cards.js", "js/format.js", "js/analysis/abilities.js", "js/cache.js", "js/api/scryfall.js", "js/analysis/engines.js"]) {
  try { vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f }); } catch (e) { console.error(f, e.message); }
}
const [dir, name, colors, limit] = process.argv.slice(2);
const cmd = JSON.parse(fs.readFileSync(path.join(dir, "prefetch.json"), "utf8")).commanderCards[name];
ctx.cmdText = cmd.oracle_text || cmd.card_faces.map((f) => f.oracle_text).join("\n");
ctx.raws = JSON.parse(fs.readFileSync(process.env.OWNED || path.join(__dirname, "../owned_raw.json"), "utf8"));
ctx.colors = colors.split("");
const rows = vm.runInContext(`(function () {
  const needs = parseCommanderNeeds([cmdText]);
  const out = [];
  for (const raw of raws) {
    const ci = raw.color_identity || [];
    if (!ci.every((c) => colors.includes(c))) continue;
    const card = convertScryfallCard(raw);
    const links = getCenterLinks(card, needs);
    if (links.length) out.push({ n: raw.name, w: Math.min(CENTER_BONUS_CAP, links.reduce((s, l) => s + l.weight, 0)), l: links.map((x) => x.link + "(" + x.via + ")").join("; ") });
  }
  return JSON.stringify({ center: needs.center, rows: out });
})()`, ctx);
const { center, rows: list } = JSON.parse(rows);
console.log(JSON.stringify(center));
list.sort((a, b) => b.w - a.w);
console.log("cards with links:", list.length);
for (const r of list.slice(0, Number(limit) || 40)) console.log(String(r.w).padStart(3), r.n.padEnd(34), r.l);
