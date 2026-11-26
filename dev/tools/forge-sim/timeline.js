// Usage: node timeline.js <log> <deck name fragment> [maxOwnTurns=7]   -- per game: what that deck did on each of its own turns
// (land played, spells cast; triggers and activations left out), plus when it died and whose turn that was.
// Reads only what the log states. Own turn k = that player's k-th Turn line in the game.
const fs = require("fs");
const { clockMs } = require("./common");
const [, , file, frag, maxArg] = process.argv;
const maxT = Number(maxArg || 7);
const strip = (s) => s.replace(/Ai\(\d\)-/g, "");
let g = 0, cur = null, own = {}, game = null;
const games = [];
const logText = fs.readFileSync(file, "utf8");
const CLOCK_MS = clockMs(logText);
for (const l of logText.split("\n")) {
  let m;
  if (/^Turn: Turn 1 \(/.test(l)) { game = { n: ++g, per: {}, dead: {}, winner: null, timeout: false }; games.push(game); own = {}; }
  if (!game) continue;
  if ((m = l.match(/^Turn: Turn (\d+) \(Ai\(\d\)-(.+)\)$/))) { cur = m[2]; own[cur] = (own[cur] || 0) + 1; (game.per[cur] = game.per[cur] || {})[own[cur]] = { land: null, spells: [], t: +m[1] }; continue; }
  if (!cur) continue;
  const slot = () => game.per[cur][own[cur]];
  if ((m = l.match(/^Land: Ai\(\d\)-(.+?) played (.+?) \(\d+\)$/))) { if (slot()) slot().land = m[2]; continue; }
  if ((m = l.match(/^Add To Stack: Ai\(\d\)-(.+?) cast (.+?)( targeting \[(.+)\])?$/))) { if (m[1] === cur && slot()) slot().spells.push(m[2] + (m[4] ? " ->" + strip(m[4]).replace(/ \(\d+\)/, "") : "")); else if (slot()) slot().spells.push("(" + m[1].split(",")[0] + " cast " + m[2] + ")"); continue; }
  if ((m = l.match(/^Life: Life: Ai\(\d\)-(.+?) (-?\d+) > (-?\d+)$/)) && +m[3] <= 0 && !game.dead[m[1]]) game.dead[m[1]] = { turn: own[m[1]] || 0, on: cur.split(",")[0], gturn: slot() && slot().t };
  if ((m = l.match(/^Game Result: .*? in (\d+) ms\. (.+?) has won!/))) { game.timeout = +m[1] >= CLOCK_MS; game.winner = game.timeout ? "TIMEOUT" : strip(m[2]).split(",")[0]; }
}
for (const gm of games) {
  const key = Object.keys(gm.per).find((k) => k.includes(frag));
  if (!key) continue;
  const d = gm.dead[key];
  console.log(`\n== game ${gm.n}: ${key.split(",")[0]} | winner ${gm.winner} | ${d ? "died after its own turn " + d.turn + ", during " + d.on + "'s turn" : "survived"}`);
  for (let k = 1; k <= Math.min(maxT, Object.keys(gm.per[key]).length); k++) { const s = gm.per[key][k]; console.log(`  t${k}: ${s.land ? "land " + s.land : "NO LAND"}${s.spells.length ? " | " + s.spells.join("; ") : ""}`); }
}
