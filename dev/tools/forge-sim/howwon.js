// Usage: node howwon.js <forge sim log>   -- how each player was eliminated, and what dealt the final blow.
// Reads only what the log states: "Damage:" lines (source card, combat or non-combat, target player) and "Life:" lines.
// A final blow = the last damage line to that player before their life first reached 0 or less. If the life change has no
// damage line right before it, it is reported as "life loss (no damage line)", which is not the same as saying what caused it.
const fs = require("fs");
const { clockMs } = require("./common");
const logText = fs.readFileSync(process.argv[2], "utf8");
const lines = logText.split("\n");
const CLOCK_MS = clockMs(logText);
const strip = (n) => n.replace(/^Ai\(\d+\)-/, "");
const p0 = strip;
const games = [];
let g = null;
for (const line of lines) {
  if (/^Turn: Turn 1 \(/.test(line) && (!g || g.done)) { g = { pend: {}, dead: {}, done: false, winner: null }; games.push(g); }
  if (!g || g.done) continue;
  let m = line.match(/^Damage: (.+?) \(\d+\) deals (\d+) (combat |non-combat )?damage to (Ai\(\d+\)-.+?)\.$/);
  if (m) {
    const target = strip(m[4]);
    (g.pend[target] = g.pend[target] || []).push({ source: m[1], amount: Number(m[2]), kind: (m[3] || "").trim() || "damage" });
    continue;
  }
  m = line.match(/^Life: Life: (Ai\(\d+\)-.+?) (-?\d+) > (-?\d+)$/);
  if (m) {
    const p = strip(m[1]);
    if (Number(m[3]) <= 0 && !g.dead[p]) {
      const parts = g.pend[p] || [];
      const sum = parts.reduce((t, x) => t + x.amount, 0);
      g.dead[p] = { parts, matched: parts.length > 0 && sum === Number(m[2]) - Number(m[3]), delta: Number(m[2]) - Number(m[3]) };
    }
    g.pend[p0(m[1])] = [];
    continue;
  }
  m = line.match(/^Game Result: .*? in (\d+) ms\. (.+?) has won!/);
  if (m) { g.winner = Number(m[1]) >= CLOCK_MS ? "(timed out, no winner)" : strip(m[2]); g.done = true; }
}
const tally = {};
const rows = [];
games.forEach((gm, i) => {
  for (const [p, d] of Object.entries(gm.dead)) {
    const kinds = new Set(d.parts.map((x) => x.kind));
    const kind = !d.parts.length ? "life loss (no damage line)" : kinds.size > 1 ? "mixed damage" : [...kinds][0] + " damage";
    const detail = d.parts.length ? d.parts.map((x) => x.source + " " + x.amount).join(", ") + (d.matched ? "" : " [damage lines do not add up to the life change of " + d.delta + "]") : "life went " + d.delta + " lower with no damage line";
    rows.push({ game: i + 1, winner: gm.winner, died: p, kind, detail });
    tally[kind] = (tally[kind] || 0) + 1;
  }
});
console.log("how players were eliminated (kind of the damage in the hit that took them to 0 or below):", JSON.stringify(tally));
console.log("\nper elimination:");
for (const r of rows) console.log("  game " + r.game + " (won by " + r.winner + "): " + r.died + " <- " + r.kind + ": " + r.detail);
