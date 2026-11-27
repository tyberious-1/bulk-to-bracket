// Usage: node dev/tools/forge-sim/board.js <log> [<log>...] [--deck <fragment[,fragment]>] [--per-game] [--pool <label>]
//
// Answers "how much damage was still sitting on the board when the deck died?" - the unused
// potential that `win_cards.js` / the turns-still-needed measure cannot see, because they only
// count damage actually dealt.
//
// WHAT THE LOG DOES AND DOES NOT GIVE (checked 2026-11-18, Forge 2.0.16):
//   - There is NO "entered the battlefield" event. The only battlefield lines are exits
//     ("<card> (id) was put into Graveyard|Exile from Battlefield"). So the board is reconstructed
//     as: permanents the player CAST, minus permanents seen leaving the battlefield.
//   - `Add To Stack: Ai(N)-<player> cast <card>` carries the player but no card id.
//   - `Zone Change: <card> (id) ... from Battlefield` carries the id but NO player, so an exit is
//     attributed to whichever player is known to have cast that card name in this game.
//   - `Combat: Ai(N)-<player> assigned <card> (id) and <card> (id) to attack ...` gives attackers.
//
// THEREFORE THIS IS A LOWER BOUND, and these are missed or wrong:
//   - TOKENS are excluded entirely. Tokens are never "cast", so they never appear as entries.
//     That matters most for the decks that go wide (Shelob's Spiders, Sethron's Minotaurs).
//   - Static buffs are ignored (Rageblood Shaman's +1/+0, equipment, auras). Printed power only.
//   - Tapped/untapped is never logged, so a "live" creature may have been tapped and unable to attack.
//   - A countered spell still counts as an entry (cast lines cannot be joined to their resolution).
//   - Creatures that entered without being cast (reanimation, copy effects) are missed.
//   - Creatures cast on the dying turn are excluded from "could have attacked": summoning sickness.
//
// Power comes from dev/tools/jxa-harness/owned_raw.json plus work/precon_cards.json (built by
// fetch_deck_cards.js from the precon .dck files). A cast card with no data at all is COUNTED and printed
// ("cast cards with NO card data"); an earlier draft skipped them silently, which made every precon
// look like it had an empty board. Check that count is ~0 before trusting any row.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const WORK = path.join(ROOT, "dev", "tools", "forge-sim", "work");

// ---------- card data ----------
function loadCards() {
  const p = path.join(ROOT, "dev", "tools", "jxa-harness", "owned_raw.json");
  const byName = new Map();
  const sources = [JSON.parse(fs.readFileSync(p, "utf8"))];
  // precon cards are not in the collection dump: fetch_deck_cards.py writes them here (git-ignored work dir)
  const extra = path.join(WORK, "precon_cards.json");
  if (fs.existsSync(extra)) sources.push(JSON.parse(fs.readFileSync(extra, "utf8")));
  for (const c of sources.flat()) {
    if (!c || !c.name) continue;
    const front = String(c.name).split(" // ")[0];
    if (byName.has(front)) continue;
    byName.set(front, {
      power: c.power,
      type: c.type_line || "",
      creature: /Creature/.test(c.type_line || ""),
    });
  }
  return byName;
}
function powerOf(info) {
  if (!info || info.power === undefined || info.power === null) return null;
  const n = parseInt(String(info.power), 10);
  return Number.isFinite(n) ? n : 0; // "*" and similar -> 0
}

// ---------- log parsing ----------
const RE = {
  turn: /^Turn: Turn (\d+)/,
  cast: /^Add To Stack: (Ai\(\d\)-.*?) cast (.+?)(?: targeting .*)?$/,
  exit: /^Zone Change: (.+?) \((\d+)\) was put into (?:Graveyard|Exile|Hand|Library) from Battlefield\./,
  attack: /^Combat: (Ai\(\d\)-.*?) assigned (.+?) to attack/,
  result: /^Game Result: Game (\d+) ended in \d+ ms\. (Ai\(\d\)-.*?) has won!/,
};

function* parseGames(file) {
  let turn = 0;
  let cast = new Map(); // player -> Map(name -> [turns])
  let exits = new Map(); // name -> count
  let attacked = new Map(); // player -> Set(name)
  const reset = () => {
    turn = 0;
    cast = new Map();
    exits = new Map();
    attacked = new Map();
  };
  for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
    const line = raw.trimEnd();
    let m = RE.turn.exec(line);
    if (m) { turn = parseInt(m[1], 10); continue; }

    m = RE.cast.exec(line);
    if (m) {
      const [, player, nameRaw] = m;
      const name = nameRaw.replace(/ \(\d+\)$/, "").trim();
      if (!cast.has(player)) cast.set(player, new Map());
      const byName = cast.get(player);
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(turn);
      continue;
    }

    m = RE.exit.exec(line);
    if (m) { const n = m[1].trim(); exits.set(n, (exits.get(n) || 0) + 1); continue; }

    m = RE.attack.exec(line);
    if (m) {
      const [, player, list] = m;
      if (!attacked.has(player)) attacked.set(player, new Set());
      for (const piece of list.split(/ and |, /)) {
        const n = piece.replace(/ \(\d+\)$/, "").trim();
        if (n) attacked.get(player).add(n);
      }
      continue;
    }

    m = RE.result.exec(line);
    if (m) {
      yield { game: parseInt(m[1], 10), winner: m[2], lastTurn: turn, cast, exits, attacked };
      reset();
    }
  }
}

// ---------- board reconstruction ----------
function boardOf(player, g, cards) {
  const byName = g.cast.get(player) || new Map();
  const attackedSet = g.attacked.get(player) || new Set();
  // attribute an exit to this player only if this player cast that name
  const out = { alive: [], unknown: [], missing: [], power: 0, idlePower: 0, idle: [] };
  for (const [name, turns] of byName) {
    const info = cards.get(name);
    if (!info) { out.missing.push(name); continue; }   // no card data at all: report it, do not drop it silently
    if (!info.creature) continue;                       // only creatures carry attack damage
    const exits = g.exits.get(name) || 0;
    const live = Math.max(0, turns.length - exits);
    if (live === 0) continue;
    const p = powerOf(info);
    // the copies most likely still alive are the ones cast latest
    const liveTurns = turns.slice(-live);
    for (const t of liveTurns) {
      if (p === null) { out.unknown.push(name); continue; }
      out.alive.push({ name, power: p, turn: t });
      out.power += p;
      // could it have attacked next turn? not if it was cast on the final turn (summoning sick)
      const sick = t >= g.lastTurn - 1;
      if (!attackedSet.has(name) && !sick) { out.idle.push({ name, power: p }); out.idlePower += p; }
    }
  }
  return out;
}

// ---------- report ----------
function main() {
  const args = process.argv.slice(2);
  let deckFrag = null;
  let perGame = false;
  let pool = null;
  const files = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--deck") { deckFrag = args[++i]; continue; }
    if (args[i] === "--per-game") { perGame = true; continue; }
    if (args[i] === "--pool") { pool = args[++i]; continue; } // merge every matched deck into one row with this label
    files.push(args[i]);
  }
  if (!files.length) {
    console.error("usage: node board.js <log> [<log>...] [--deck <name fragment>]");
    process.exit(1);
  }
  const cards = loadCards();

  const per = new Map(); // player -> stats
  for (const f of files) {
    const file = fs.existsSync(f) ? f : path.join(WORK, f);
    for (const g of parseGames(file)) {
      const players = new Set([...g.cast.keys(), ...g.attacked.keys()]);
      for (const p of players) {
        if (p === g.winner) continue;            // only the deck that LOST
        if (deckFrag && !deckFrag.split(",").some((f) => p.toLowerCase().includes(f.trim().toLowerCase()))) continue;
        const b = boardOf(p, g, cards);
        if (perGame) {
          const list = b.alive.map((c) => `${c.name} ${c.power}p(t${c.turn})`).join(", ") || "(empty)";
          const idle = b.idle.map((c) => c.name).join(", ") || "none";
          console.log(`game ${g.game} [${path.basename(file)}] ${p} lost on global turn ${g.lastTurn}`);
          console.log(`   alive: ${list}`);
          console.log(`   total power ${b.power}; never attacked: ${idle} (${b.idlePower} power)`);
          if (b.unknown.length) console.log(`   unresolved: ${b.unknown.join(", ")}`);
        }
        const key = pool || p.replace(/^Ai\(\d\)-/, ""); // pool the two seat orders (or everything with --pool)
        if (!per.has(key)) per.set(key, { n: 0, power: [], idlePower: [], count: [], idle: [], unknown: 0, missing: 0 });
        const s = per.get(key);
        s.n++;
        s.power.push(b.power);
        s.idlePower.push(b.idlePower);
        s.count.push(b.alive.length);
        s.idle.push(b.idle.length);
        s.unknown += b.unknown.length;
        s.missing += b.missing.length;
      }
    }
  }

  const med = (a) => { if (!a.length) return 0; const s=[...a].sort((x,y)=>x-y); const i=s.length>>1; return s.length%2?s[i]:(s[i-1]+s[i])/2; };
  const mean = (a) => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0;

  console.log("Board still standing when the deck DIED (nontoken creatures only - a LOWER BOUND; see header)\n");
  for (const [player, s] of [...per.entries()].sort((a,b)=>b[1].n-a[1].n)) {
    console.log(`${player}  (${s.n} losses)`);
    console.log(`   creatures alive at death : median ${med(s.count)}  mean ${mean(s.count).toFixed(1)}`);
    console.log(`   their total power        : median ${med(s.power)}  mean ${mean(s.power).toFixed(1)}`);
    console.log(`   of that, NEVER attacked  : median ${med(s.idle)} creatures, ${med(s.idlePower)} power (mean ${mean(s.idlePower).toFixed(1)})`);
    console.log(`   died with an empty board : ${s.count.filter(x=>x===0).length}/${s.n}`);
    console.log(`   cast cards with NO card data: ${s.missing}; power unknown (e.g. "*"): ${s.unknown}  (must be ~0 for the numbers to be trusted)\n`);
  }
}

main();
