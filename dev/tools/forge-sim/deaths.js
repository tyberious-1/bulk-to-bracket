// Usage: node deaths.js <log> [deck fragment]   -- for each elimination: whose turn, the attackers assigned that turn, whether the
// victim blocked, the victim's life going into that turn, and creatures the killer had cast so far (casts only; tokens not counted).
const fs = require("fs");
const [, , file, frag] = process.argv;
const L = fs.readFileSync(file, "utf8").split("\n");
const { shortName: short } = require("./common");
let g = 0, cur = null, atk = [], blocks = 0, noblocks = 0, life = {}, lifeAtTurnStart = {}, cast = {}, dead = {}, own = {};
for (const l of L) {
  let m;
  if (/^Turn: Turn 1 \(/.test(l)) { g++; life = {}; dead = {}; cast = {}; own = {}; }
  if ((m = l.match(/^Turn: Turn \d+ \(Ai\(\d\)-(.+)\)$/))) { cur = short(m[1]); atk = []; blocks = 0; noblocks = 0; lifeAtTurnStart = { ...life }; own[cur] = (own[cur] || 0) + 1; continue; }
  if ((m = l.match(/^Combat: Ai\(\d\)-(.+?) assigned (.+?) \(\d+\)(?: and (.+?) \(\d+\))* to attack/))) { atk.push(l.replace(/^Combat: Ai\(\d\)-.+? assigned /, "").replace(/ to attack.*/, "").replace(/ \(\d+\)/g, "")); continue; }
  if (/^Combat: .*didn't block/.test(l)) noblocks++;
  else if (/^Combat: .* to block /.test(l)) blocks++;
  if ((m = l.match(/^Resolve Stack: (.+?) - Creature /)) && cur) { (cast[cur] = cast[cur] || []).push(m[1]); }
  if ((m = l.match(/^Life: Life: Ai\(\d\)-(.+?) (-?\d+) > (-?\d+)$/))) {
    const p = short(m[1]); life[p] = +m[3];
    if (+m[3] <= 0 && !dead[p] && (!frag || p.includes(frag))) {
      dead[p] = 1;
      console.log(`g${g} ${p} out on ${cur}'s turn ${own[cur]} | victim life going into that turn: ${lifeAtTurnStart[p] ?? 40} | victim blocked ${blocks}x, did not block ${noblocks}x | attackers: ${atk.join("; ").slice(0, 150)} | killer's creatures cast so far: ${(cast[cur] || []).length}`);
    }
  }
}
