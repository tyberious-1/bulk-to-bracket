// Usage: node dev/tools/forge-sim/removal_targets.js <log> [<log>...] [--deck <fragment>] [--list]
//
// Answers "does a deck's removal hit the right threats?" (2026-11-26). For every spell or ability a player casts that targets
// another player's permanent, it records what the target was: the opponent's commander, a creature (and whether it was the
// biggest creature that opponent had out), a noncreature permanent, a land, or a token. Its own permanents and players are
// counted apart (a "targeting" line is also a pump, an aura or a burn to the face).
//
// WHAT COUNTS AS REMOVAL: a cast whose card text (owned_raw.json, the builder's cards) reads as removal, OR whose target left
// the battlefield before the next turn began (precon cards carry no text, so for them the outcome decides). Activated
// abilities are left out: Forge's AI rarely activates them, and a "targeting" ability line is mostly Map tokens and pumps.
//
// LIMITS (same log as board.js): the board is "cast minus left the battlefield"; tokens are never cast, so a token target has
// no owner and no power and is reported as "token/unknown". Static buffs are ignored: power is printed power. A creature that
// entered without being cast (reanimated, copied) is unknown to the board.
const fs = require("fs");
const path = require("path");
const { shortName, baseName } = require("./common");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const WORK = path.join(ROOT, "dev", "tools", "forge-sim", "work");

function loadCards() {
  const byName = new Map();
  const sources = [JSON.parse(fs.readFileSync(path.join(ROOT, "dev", "tools", "jxa-harness", "owned_raw.json"), "utf8"))];
  const extra = path.join(WORK, "precon_cards.json");
  if (fs.existsSync(extra)) sources.push(JSON.parse(fs.readFileSync(extra, "utf8")));
  for (const c of sources.flat()) {
    if (!c || !c.name) continue;
    const front = String(c.name).split(" // ")[0];
    const text = [c.oracle_text, ...(c.card_faces || []).map((f) => f.oracle_text)].filter(Boolean).join("\n").toLowerCase();
    const prev = byName.get(front);
    if (prev && prev.text) continue;
    const p = parseInt(String(c.power ?? (c.card_faces && c.card_faces[0] && c.card_faces[0].power)), 10);
    byName.set(front, { type: c.type_line || (c.card_faces && c.card_faces[0] && c.card_faces[0].type_line) || "", power: Number.isFinite(p) ? p : null, text });
  }
  return byName;
}
const REMOVAL_TEXT = /\b(?:destroy|exile) (?:up to \w+ )?(?:another )?target\b|return (?:up to \w+ )?target (?:nonland )?(?:creature|permanent|artifact|enchantment|nonland permanent)[^.]*to (?:its|their) owner'?s? hand|deals? (?:\d+|x) damage to (?:any target|target creature|target planeswalker)|target creature (?:an opponent controls )?gets -\d|-x\/-x|\bfights?\b|put target [^.]*on (?:the )?(?:top|bottom) of (?:its|their) owner'?s? library|enchanted creature can't attack|counter target/;

const args = process.argv.slice(2);
const deckFrag = args.includes("--deck") ? args[args.indexOf("--deck") + 1] : null;
const list = args.includes("--list");
const files = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--deck");
const cards = loadCards();

const stats = new Map(); // caster -> counts
const rows = [];
const bump = (who, key) => { const s = stats.get(who) || {}; s[key] = (s[key] || 0) + 1; stats.set(who, s); };

for (const file of files) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  let game = 0;
  let cast, gone, pending, players, idOwner;
  const reset = () => { cast = new Map(); gone = new Set(); pending = []; players = new Set(); idOwner = new Map(); };
  reset();
  // The owner of a card name this game: the player who cast it (first caster), or the player whose commander it is.
  // An id seen in a "played" or "assigned ... to attack" line names its controller exactly. Otherwise the name decides, and a
  // name more than one player cast this game (a mirror pod) is ambiguous: null, reported as token/unknown.
  const ownerOf = (name, id) => {
    if (id && idOwner.has(id)) return idOwner.get(id);
    for (const p of players) if (baseName(p) === name) return p;
    const casters = [...cast].filter(([, names]) => names.has(name)).map(([p]) => p);
    return casters.length === 1 ? casters[0] : null;
  };
  // A player's creatures still on the battlefield: cast minus seen leaving (by name, a lower bound like board.js).
  const liveCreatures = (p) => [...(cast.get(p) || new Map())].filter(([n, k]) => k > 0 && /creature/i.test((cards.get(n) || {}).type || "")).map(([n]) => n);
  const settle = () => {
    for (const r of pending) {
      r.removed = gone.has(r.targetId);
      const isRemoval = r.removalText || r.removed;
      if (!isRemoval) continue;
      rows.push(r);
      bump(r.caster, "removal");
      bump(r.caster, r.kind);
      if (r.kind === "creature") bump(r.caster, r.biggest ? "biggest" : "notBiggest");
      if (r.removed) bump(r.caster, "removed");
    }
    pending = [];
  };
  for (const l of lines) {
    let m;
    if (/^Turn: Turn 1 \(/.test(l)) { settle(); game += 1; reset(); }
    if ((m = l.match(/^Turn: Turn \d+ \((Ai\(\d\)-.+)\)$/))) { settle(); players.add(m[1].replace(/^Ai\(\d\)-/, "")); continue; }
    if ((m = l.match(/^Add To Stack: Ai\(\d\)-(.+?) cast (.+?)(?: targeting \[(.+)\])?$/))) {
      const caster = m[1], card = m[2];
      players.add(caster);
      const names = cast.get(caster) || new Map();
      names.set(card, (names.get(card) || 0) + 1);
      cast.set(caster, names);
      if (!m[3] || (deckFrag && !caster.includes(deckFrag))) continue;
      const t = m[3].match(/^(.+?) \((\d+)\)/);
      if (!t) continue; // a player target (burn to the face, "target player draws")
      const [, target, targetId] = t;
      const owner = ownerOf(target, targetId);
      const info = cards.get(target) || {};
      // "Exile target card from a graveyard" (Psionic Ritual) is not removal: drop graveyard targets before reading.
      const removalText = REMOVAL_TEXT.test(((cards.get(card) || {}).text || "").replace(/target [^.]*?cards? from (?:a|an opponent's|your|their|its owner's) graveyards?/g, ""));
      if (owner === caster) { bump(caster, "ownTarget"); continue; }
      let kind;
      if (!owner) kind = "token/unknown";
      else if (baseName(owner) === target) kind = "commander";
      else if (!info.type) kind = "token/unknown";
      else if (/\b(?:instant|sorcery)\b/i.test(info.type)) kind = "spell";
      else if (/\bland\b/i.test(info.type || "") && !/creature/i.test(info.type || "")) kind = "land";
      else if (/creature/i.test(info.type || "")) kind = "creature";
      else kind = "noncreature";
      let biggest = false;
      if (kind === "creature" || kind === "commander") {
        const pows = liveCreatures(owner).map((n) => (cards.get(n) || {}).power ?? 0);
        biggest = (info.power ?? 0) >= Math.max(0, ...pows);
      }
      pending.push({ game, caster, card, target, targetId, owner, kind, biggest, power: info.power, removalText });
      continue;
    }
    if ((m = l.match(/^Land: Ai\(\d\)-(.+?) played .+? \((\d+)\)/))) idOwner.set(m[2], m[1]);
    if ((m = l.match(/^Combat: Ai\(\d\)-(.+?) assigned (.+?) to attack/))) for (const a of m[2].matchAll(/\((\d+)\)/g)) idOwner.set(a[1], m[1]);
    if ((m = l.match(/^Zone Change: (.+?) \((\d+)\) was put into (?:Graveyard|Exile|Hand|Library) from Battlefield\./))) {
      gone.add(m[2]);
      const owner = ownerOf(m[1]);
      const names = owner && cast.get(owner);
      if (names && names.get(m[1]) > 0) names.set(m[1], names.get(m[1]) - 1);
    }
  }
  settle();
}

const pct = (a, b) => (b ? Math.round((100 * a) / b) + "%" : "-");
console.log("caster | removal casts | at commander | creature (biggest / not) | noncreature | land | token/unknown | spell on the stack | target left play | own-target casts");
for (const [who, s] of [...stats].sort((a, b) => (b[1].removal || 0) - (a[1].removal || 0))) {
  const n = s.removal || 0;
  console.log(`${shortName(who)} | ${n} | ${s.commander || 0} (${pct(s.commander || 0, n)}) | ${s.creature || 0} (${s.biggest || 0} / ${s.notBiggest || 0}) | ${s.noncreature || 0} | ${s.land || 0} | ${s["token/unknown"] || 0} | ${s.spell || 0} | ${pct(s.removed || 0, n)} | ${s.ownTarget || 0}`);
}
if (list) for (const r of rows) console.log(`g${r.game} ${shortName(r.caster)}: ${r.card} -> ${r.target} [${r.kind}${r.kind === "creature" ? (r.biggest ? ", biggest" : ", not biggest") + ", power " + r.power : ""}]${r.removed ? " (left play)" : ""}`);
