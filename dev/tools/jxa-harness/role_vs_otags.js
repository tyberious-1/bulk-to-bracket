// Compares a role reader with Scryfall's role tags (otags) over the owned collection.
// Usage: python3 -I dev/tools/jxa-harness/fetch_otags.py dev/tools/jxa-harness/otags.json   (once; about 100 requests)
//        node dev/tools/jxa-harness/role_vs_otags.js                      recall and precision per role
//        node dev/tools/jxa-harness/role_vs_otags.js list wipe missed 40  the cards behind a number (missed|extra)
// READER picks the reader (default: the Analytics tab's getCollectionRoles; READER="getRoleContributions(card)"
// measures the builder's). The tags are a rough yardstick, not the truth: they differ from our rules on purpose.
const fs = require("fs"), vm = require("vm"), path = require("path");
const root = path.join(__dirname, "../../..");
const S = __dirname;
const ctx = vm.createContext({ localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, console });
const files = (process.env.FILES || "js/constants.js js/utils/text.js js/utils/cards.js js/format.js js/analysis/themes.js js/analysis/abilities.js js/analysis/scoring.js js/analysis/role-reading.js js/api/http.js js/cache.js js/api/scryfall.js").split(" ");
for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
const reader = process.env.READER || "getCollectionRoles(card)";
const fn = vm.runInContext(`(function(raw){ const card = convertScryfallCard(raw); return ${reader}; })`, ctx);
const owned = JSON.parse(fs.readFileSync(path.join(root, "dev/tools/jxa-harness/owned_raw.json"), "utf8"));
const otags = JSON.parse(fs.readFileSync(path.join(S, "otags.json"), "utf8"));
const sets = Object.fromEntries(Object.entries(otags).map(([r, n]) => [r, new Set(n)]));
const seen = new Set(), rows = [];
for (const raw of owned) {
  if (seen.has(raw.name) || /\bland\b/i.test((raw.type_line || "").split("—")[0])) continue;
  seen.add(raw.name);
  let roles; try { roles = fn(raw); } catch (e) { continue; }
  rows.push({ name: raw.name, roles: new Set(roles), text: raw.oracle_text || (raw.card_faces || []).map(f => f.oracle_text).join(" // "), type: raw.type_line });
}
const [mode, role, kind, n] = process.argv.slice(2);
if (mode === "list") {
  const sel = rows.filter(r => kind === "missed" ? sets[role].has(r.name) && !r.roles.has(role) : r.roles.has(role) && !sets[role].has(r.name));
  console.log(sel.length, "cards");
  for (const r of sel.slice(0, +n || 40)) console.log(`- ${r.name} [${r.type}]: ${r.text.replace(/\n/g, " / ").slice(0, 260)}`);
} else {
  console.log("cards", rows.length);
  for (const role of Object.keys(sets)) {
    const tag = rows.filter(r => sets[role].has(r.name)).length;
    const ours = rows.filter(r => r.roles.has(role)).length;
    const both = rows.filter(r => r.roles.has(role) && sets[role].has(r.name)).length;
    console.log(role.padEnd(8), "ours", ours, "otag", tag, "both", both, "recall", (100 * both / tag).toFixed(0) + "%", "precision", (100 * both / ours).toFixed(0) + "%");
  }
}
