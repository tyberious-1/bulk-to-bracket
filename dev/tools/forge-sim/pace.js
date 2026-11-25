// Usage: node pace.js <log> [<log> ...]   -- per deck, per own turn 1..8: average spells cast that turn (own casts only, no triggers or
// activations), the share of turns with no spell, and how many games reached that turn. Pools the logs given.
// Spells cast on a player's own turn only (instants on other players' turns are not counted).
const fs = require("fs");
const agg = {};
for (const file of process.argv.slice(2)) {
  let own = {}, started = false, visit = null;
  const close = () => { if (visit && visit.k <= 8) { const s = ((agg[visit.p] = agg[visit.p] || {})[visit.k] = (agg[visit.p][visit.k] || { n: 0, sp: 0, none: 0 })); s.n++; s.sp += visit.c; if (!visit.c) s.none++; } visit = null; };
  for (const l of fs.readFileSync(file, "utf8").split("\n")) {
    let m;
    if (/^Turn: Turn 1 \(/.test(l)) { close(); own = {}; started = true; }
    if (!started) continue;
    if ((m = l.match(/^Turn: Turn \d+ \(Ai\(\d\)-(.+)\)$/))) { close(); const p = m[1].split(",")[0]; own[p] = (own[p] || 0) + 1; visit = { p, k: own[p], c: 0 }; continue; }
    if ((m = l.match(/^Add To Stack: Ai\(\d\)-(.+?) cast /)) && visit && m[1].split(",")[0] === visit.p) visit.c++;
    if (/^Game Result/.test(l)) { close(); started = false; }
  }
}
const pad = (s, n) => String(s).padEnd(n);
console.log("each cell: average spells cast on that own turn / % of those turns with no spell / games that reached the turn");
console.log(pad("deck", 22) + [1, 2, 3, 4, 5, 6, 7, 8].map((k) => pad("t" + k, 15)).join(""));
for (const [d, a] of Object.entries(agg)) console.log(pad(d, 22) + [1, 2, 3, 4, 5, 6, 7, 8].map((k) => { const s = a[k]; return pad(s ? (s.sp / s.n).toFixed(1) + " / " + Math.round((100 * s.none) / s.n) + "% / " + s.n : "-", 15); }).join(""));
