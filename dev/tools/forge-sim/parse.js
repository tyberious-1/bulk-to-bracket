// Usage: node parse.js <forge sim log>   -- per deck: does it function? (not "does it win")
const fs = require("fs");
const { isCommanderCast, clockMs: logClock } = require("./common");
const logText = fs.readFileSync(process.argv[2], "utf8");
const lines = logText.split("\n");
let games = [];
let g = null, cur = null, pending = {};
for (const line of lines) {
  let mm = line.match(/^Mulligan: (.+?) has mulliganed down to (\d+)/);
  if (mm) { (pending[mm[1]] = pending[mm[1]] || { n: 0, kept: 7 }).n++; }
  mm = line.match(/^Mulligan: (.+?) has kept a hand of (\d+) cards/);
  if (mm) { (pending[mm[1]] = pending[mm[1]] || { n: 0, kept: 7 }).kept = Number(mm[2]); }
  let m = line.match(/^Turn: Turn (\d+) \((.+)\)$/);
  if (m) {
    if (!g || g.done) { g = { players: {}, done: false, turns: 0, winner: null, mull: pending }; pending = {}; games.push(g); }
    const p = (g.players[m[2]] = g.players[m[2]] || { own: 0, lands: [], spells: [], cmdr: null });
    p.own += 1; cur = m[2]; g.turns = Number(m[1]);
    continue;
  }
  if (!g || g.done || !cur) continue;
  m = line.match(/^Land: (.+?) played /);
  if (m && g.players[m[1]]) g.players[m[1]].lands.push(g.players[m[1]].own);
  m = line.match(/^Add To Stack: (.+?) cast (.+)$/);
  if (m && g.players[m[1]]) {
    const p = g.players[m[1]];
    p.spells.push(p.own);
    if (isCommanderCast(m[1], m[2])) p.cmdr = p.cmdr || p.own;
  }
  m = line.match(/^Game Result: .*? in (\d+) ms\. (.+?) has won!/);
  // A game that hits the clock is a draw: every player's Game Outcome line says "has won", but Game Result still names
  // one. Do not count it as a win (found 2026-11-17). The clock is settled after the whole log is read.
  if (m) { g.ms = Number(m[1]); g.named = m[2]; g.done = true; }
}
const clockMs = logClock(logText);
for (const x of games) if (x.done) { x.timeout = x.ms >= clockMs; x.winner = x.timeout ? null : x.named; }
// A run that was stopped (stall watchdog, timeout) can leave a last game with turn lines but no result; drop it so it does not skew the counts.
const unfinished = games.filter((x) => !x.done).length;
games = games.filter((x) => x.done);
if (unfinished) console.log("note: " + unfinished + " unfinished game(s) at the end of the log were left out");
const names = {};
for (const gm of games) for (const k of Object.keys(gm.players)) {
  const deck = k.replace(/^Ai\(\d+\)-/, "");
  const s = (names[deck] = names[deck] || { n: 0, wins: 0, cmdr: [], nocmdr: 0, spells5: [], idle3: 0, lands4: [], lands6: [], mulls: [], kept: [] });
  const p = gm.players[k];
  s.n++; if (gm.winner === k) s.wins++;
  const mu = (gm.mull && gm.mull[k]) || { n: 0, kept: 7 };
  s.mulls.push(mu.n); s.kept.push(mu.kept);
  if (p.cmdr) s.cmdr.push(p.cmdr); else s.nocmdr++;
  s.spells5.push(p.spells.filter((t) => t <= 5).length);
  if (!p.spells.some((t) => t <= 3)) s.idle3++;
  s.lands4.push(p.lands.filter((t) => t <= 4).length);
  s.lands6.push(p.lands.filter((t) => t <= 6).length);
}
const avg = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : "-");
const seatWins = {}; let noWinner = 0;
for (const gm of games) { if (!gm.winner) { noWinner++; continue; } const sm = gm.winner.match(/^Ai\((\d+)\)/); const sk = sm ? sm[1] : "?"; seatWins[sk] = (seatWins[sk] || 0) + 1; }
console.log("games timed out at the " + clockMs / 1000 + " s clock (draws, not wins):", games.filter((x) => x.timeout).length, "| games with no winner:", noWinner, "| wins by seat:", JSON.stringify(seatWins), "| expected per deck at 4 players: " + (games.length / 4).toFixed(1) + " +/- " + Math.sqrt(games.length * 0.25 * 0.75).toFixed(1));
console.log("games:", games.length, " avg game length (turns, all players):", avg(games.map((x) => x.turns)));
for (const [d, s] of Object.entries(names)) {
  console.log("\n" + d);
  console.log("  wins " + s.wins + "/" + s.n + " (win rate is only a sanity check)");
  console.log("  commander cast in " + s.cmdr.length + "/" + s.n + " games, first on own turn " + avg(s.cmdr) + " (avg)");
  console.log("  spells cast in own first 5 turns: " + avg(s.spells5) + " avg; nothing cast by own turn 3 in " + s.idle3 + " games");
  console.log("  mulligans: " + s.mulls.filter((n) => n > 0).length + "/" + s.n + " games, kept hand size " + avg(s.kept) + " avg");
  console.log("  land drops in own first 4 turns: " + avg(s.lands4) + " avg (4 = never missed)");
  console.log("  land drops in own first 6 turns: " + avg(s.lands6) + " avg (6 = never missed); games missing 2+ of 6: " + s.lands6.filter((n) => n <= 4).length);
}
