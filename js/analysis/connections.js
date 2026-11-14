// How cards connect across the whole collection (Collection Analytics tab). Each card's words are
// read as outputs ("gives") and inputs ("wants") on named channels: a sacrifice outlet gives "dies",
// a death payoff wants it. A channel that cards want but few or none give is a payoff with no feeder.
// Same reading as dev/tools/jxa-harness/connections.js (the build audit); the channel vocabulary is
// a first pass, so read "no feeders" as a lead, not a verdict. The builder never calls this.
// Depends on: abilities.js, utils/cards.js (getCardType, getCardText)

const LINK_GENERIC_TYPES = new Set(["creature", "artifact", "enchantment", "land", "planeswalker", "instant", "sorcery", "battle"]);

function readLinkType(card) {
  const type = getCardType(card);
  const split = type.split("—");
  return { front: split[0], subs: (split[1] || "").trim().split(/\s+/).filter(Boolean) };
}

// What a card gives and wants, as { gives: Set, wants: Set } of channel names.
function readCardLinks(card, knownTypes) {
  const gives = new Set();
  const wants = new Set();
  const { front, subs } = readLinkType(card);
  const text = String(getCardText(card) || "").toLowerCase();
  const isCreature = front.includes("creature");
  const isSupportSpell = !isCreature && !front.includes("land");

  for (const w of front.split(/\s+/)) if (w && !["legendary", "snow", "basic", "world", "tribal"].includes(w)) gives.add("type:" + w);
  for (const s of subs) gives.add("type:" + s);
  if (isCreature) { gives.add("power"); gives.add("fodder-body"); gives.add("creature-spell"); }
  if (isSupportSpell) gives.add("noncreature-spell");
  if (/\b(?:instant|sorcery)\b/.test(front)) gives.add("instsorc-spell");
  // Crew and saddle want power; crew-boost is only ever given, never wanted, so it cannot read as starved.
  if (/\bcrew \d+|\bsaddle \d+/.test(text)) wants.add("power");
  // "crews vehicles as though its power were 2 greater", "saddles mounts using its toughness"
  if (/\b(?:crews?|saddles?) (?:vehicles?|mounts?)|crews? [^.]*(?:toughness|power were)/.test(text) || /\bpilot\b[^.]*token/.test(text)) gives.add("crew-boost");
  if (/\bcrew \d+/.test(text)) gives.add("vehicle-crewed");

  // Kinds of spell a watcher can name: cheap (second spell each turn), big (mana value N or greater),
  // instant speed (cast on an opponent's turn), historic, kicked, and one that targets a creature of yours.
  const cmc = Number(card.cmc ?? card.manaValue ?? 0) || 0;
  if (!front.includes("land")) {
    if (cmc <= 2) gives.add("cheap-spell");
    if (cmc >= 5) gives.add("big-spell");
    if (/\binstant\b/.test(front) || /\bflash\b/.test(text)) gives.add("instant-speed");
    if (/\b(?:artifact|saga)\b|\blegendary\b/.test(front)) gives.add("historic");
    if (/\b(?:multi)?kicker\b/.test(text)) gives.add("kicker");
    if (isSupportSpell && /target creature(?! an opponent controls| you don't control)|target (?:permanent|nonland permanent)|\benchant creature\b/.test(text)) gives.add("targets-self");
  }
  if (isCreature) gives.add("attack-event");
  // Poison: infect and toxic creatures (and "that player gets a poison counter") give it; proliferate and
  // "is poisoned" payoffs want it. Deathtouch is given by the keyword or a grant and wanted by "a creature with deathtouch".
  if (/(?:^|\n|, )(?:infect|toxic \d)|gets? (?:a|an|two|three|\d+) poison counters?|has (?:toxic|infect)|gains? (?:toxic|infect)/.test(text)) gives.add("poison");
  if (/\bproliferate\b|\bis poisoned\b|each poison counter|poison counters? (?:on|than)/.test(text)) wants.add("poison");
  if (/\bproliferate\b/.test(text)) wants.add("counters");
  if (/(?:^|\n|, )deathtouch\b|(?:has|gains?|have) deathtouch/.test(text)) gives.add("deathtouch");
  if (/creatures? (?:you control )?with deathtouch|deathtouch (?:blocks|deals)/.test(text)) wants.add("deathtouch");
  // A card worth discarding: it does something from the graveyard or when discarded.
  if (/\b(?:madness|flashback|escape|unearth|dredge|cycling|embalm|eternalize)\b/.test(text)) gives.add("discard-fodder");

  for (const ab of getCardAbilities(card)) {
    const line = ab.line;
    const labels = ab.effects.map((e) => e.label);
    const has = (l) => labels.includes(l);
    if (ab.kind === "triggered") {
      const selfOnly = /^(?:when|whenever) ~ (?:enters|dies|attacks|deals|becomes)/.test(line) && !/\banother\b|\bother\b/.test(line.split(",")[0]);
      for (const t of ab.trigger) {
        if (t === "dies") { if (selfOnly) wants.add("sac-outlet"); else wants.add("dies"); }
        else if (t === "sacrifice-event") wants.add("sacrifice-event");
        else if (t === "token-event") wants.add("token-event");
        else if (t === "draw-event" || t === "draw-second") wants.add("draw-event");
        else if (t === "life-event") wants.add("life-event");
        else if (t === "discard-event") wants.add("discard-event");
        else if (t === "cycle-event") wants.add("cycle-event");
        else if (t === "landfall") wants.add("landfall");
        else if (t === "counter-placed") wants.add("counters");
        else if (t === "crews") wants.add("vehicle-crewed");
        else if (t === "cast-noncreature") wants.add("noncreature-spell");
        else if (t === "cast-spell" || t === "cast-second") {
          // an unqualified "whenever you cast a spell" is met by every card, so it names no channel
          if (/instant or sorcery/.test(line.split(",")[0])) wants.add("instsorc-spell");
          else if (/noncreature/.test(line.split(",")[0])) wants.add("noncreature-spell");
          else if (/creature spell/.test(line.split(",")[0])) wants.add("creature-spell");
        }
        else if (t === "etb" && !selfOnly && /\bcreature\b/.test(line.split(",")[0])) wants.add("creature-spell");
      }
      // What a watcher names in its own clause (not a self trigger, not a timing trigger): a tribe or permanent
      // type in the subject ("another insect you control dies" wants Insects as well as deaths), a kind of spell,
      // an attack, a creature leaving, a scry. Each is an input on its own channel.
      const clause = line.replace(/^[a-z' ]+ — /, "").split(",")[0];
      if (!/^(?:when|whenever|at) (?:~|this )/.test(clause) && !/beginning of|end step/.test(clause)) {
        for (const word of clause.replace(/[^a-z' -]/g, " ").split(/\s+/)) {
          for (const w of linkSingular(word)) {
            if (LINK_TYPE_STOP.has(w)) continue;
            if (knownTypes.has(w) || w === "artifact" || w === "enchantment") { wants.add("type:" + w); break; }
          }
        }
        if (/\bsecond spell\b/.test(clause)) wants.add("cheap-spell");
        if (/mana value \d+ or greater/.test(clause)) wants.add("big-spell");
        if (/spell that targets|targets only/.test(clause)) wants.add("targets-self");
        if (/\bcast/.test(clause) && /opponent'?s turn/.test(clause)) wants.add("instant-speed");
        if (/\bkicked\b/.test(clause)) wants.add("kicker");
        if (/\bhistoric\b/.test(clause)) wants.add("historic");
        if (/\battacks?\b|you attack|is attacked|combat damage/.test(clause)) wants.add("attack-event");
        if (/leaves the battlefield/.test(clause)) wants.add("dies");
        if (/cards? (?:are put into|leave) your graveyard/.test(clause)) wants.add("graveyard");
        if (/\byou scry\b|scry or surveil|\bsurveil\b/.test(clause)) wants.add("scry-event");
        // Equipment and Auras trigger on the creature they sit on, so they want a body.
        if (/\b(?:equipped|enchanted) creature\b/.test(clause)) wants.add("creature-spell");
      }
    }
    if (ab.kind === "activated") {
      if (ab.cost.includes("sacrifice-other")) { wants.add("fodder-body"); gives.add("dies"); gives.add("sacrifice-event"); gives.add("sac-outlet"); }
      if (ab.cost.includes("tap-other")) wants.add("power");
      if (ab.cost.includes("discard-card") || ab.cost.includes("discard-multiple")) { wants.add("discard-fodder"); gives.add("discard-event"); }
    }
    if (ab.kind === "spell" && has("sacrifice")) gives.add("sacrifice-event");
    for (const e of ab.effects) {
      switch (e.label) {
        case "create-token":
          gives.add("token-event"); gives.add("fodder-body");
          if (!/\btreasure|clue|food|blood|map|powerstone|junk|gold|incubator\b/.test(line) || /creature token|\d+\/\d+/.test(line)) { gives.add("power"); gives.add("creature-spell"); }
          if (/pilot/.test(line)) gives.add("power");
          // A token of a named kind is a card of that kind: Treasure for "artifacts you control", Soldier for a Soldier lord.
          for (const m of line.matchAll(/\b(treasure|clue|food|blood|map|powerstone|junk|gold|incubator|shard)s?\b/g)) gives.add("type:" + m[1]);
          for (const m of line.matchAll(/\b([a-z]+) (?:[a-z]+ )?creature tokens?\b/g)) if (knownTypes.has(m[1])) gives.add("type:" + m[1]);
          break;
        case "crew-helper": gives.add("power"); break;
        case "draw": case "loot": case "rummage": gives.add("draw-event"); if (e.label !== "draw") gives.add("discard-event"); break;
        case "discard-self": case "discard-opponent": gives.add("discard-event"); gives.add("graveyard"); break;
        case "mill-self": case "put-into-graveyard": gives.add("graveyard"); break;
        case "surveil": gives.add("graveyard"); gives.add("scry-event"); break;
        case "scry": gives.add("scry-event"); break;
        case "return-from-graveyard": wants.add("graveyard"); break;
        case "counters": if (e.counter === "+1/+1") gives.add("counters"); break;
        case "gain-life": case "lose-life": gives.add("life-event"); break;
        case "land-to-battlefield": gives.add("landfall"); break;
        case "destroy": case "damage": gives.add("dies"); break;
        case "sacrifice": gives.add("sacrifice-event"); break;
        case "anthem-lord": {
          const word = String(e.type || "").replace(/ves$/, "f").replace(/s$/, "");
          if (word && (knownTypes.has(word) || LINK_GENERIC_TYPES.has(word)) && word !== "creature") wants.add("type:" + word);
          break;
        }
        default: break;
      }
    }
    if (/each creature (?:gets|dies)|destroy all|all creatures get -/.test(line) && has("destroy")) gives.add("dies");
    if (/\bcycling\b/.test(line)) gives.add("cycle-event");
    if (/\b(?:flashback|escape|unearth|embalm|eternalize|dredge)\b/.test(line)) wants.add("graveyard");
    if (/(?:for each|number of) [^.]*\+1\/\+1 counters?|\+1\/\+1 counter on (?:it|~)(?: for each| if)/.test(line)) wants.add("counters");
  }
  // "Vehicles you control have hexproof" and the like name a type outside any labeled ability.
  const named = /\b(artifact|enchantment|vehicle|mount|equipment|aura|saga)s? you control\b/.exec(text);
  if (named) wants.add("type:" + named[1]);
  // Energy: "you get {E}" supplies it; paying or counting it needs it. The ability labels flatten {E} to
  // {m}, so this reads the raw text.
  if (/\byou get [^.\n]*\{e\}/.test(text)) gives.add("energy");
  if (/\b(?:pay|spend) [^.\n]*\{e\}|\beach \{e\}|\{e\} you have/.test(text)) wants.add("energy");
  // X spells: a card with {X} in its cost supplies one; a watcher of "spells with {X} in their mana cost" needs one.
  if (!front.includes("land") && /\{x\}/i.test(String(card.manaCost ?? card.mana_cost ?? ""))) gives.add("x-spell");
  if (/\{x\} in (?:its|their) mana costs?|spells? with \{x\}|with \{x\} in/.test(text)) wants.add("x-spell");
  return { gives, wants };
}

// A link through a channel nearly every card sits on says little; a specific channel says a lot.
const LINK_UNIVERSAL = new Set(["power", "fodder-body", "creature-spell", "noncreature-spell", "attack-event", "cheap-spell"]);

// Words a watcher's clause can contain that are never a tribe or permanent type.
const LINK_TYPE_STOP = new Set(["creature", "spell", "token", "permanent", "player", "opponent", "card", "source", "land", "you", "control", "another", "other", "with", "power", "toughness", "counter", "mana", "value", "turn", "first", "second", "kicked", "target", "enchanted", "equipped"]);
function linkSingular(word) {
  return [word, word.replace(/s$/, ""), word.replace(/ves$/, "f"), word.replace(/ies$/, "y"), word.replace(/men$/, "man")];
}
function linkWeight(ch) { return LINK_UNIVERSAL.has(ch) ? 0.25 : 1; }


const CONNECTION_LABELS = {
  "dies": "A creature dies", "sac-outlet": "Sacrifice outlet", "sacrifice-event": "Something is sacrificed",
  "token-event": "Tokens are made", "draw-event": "You draw", "life-event": "Life is gained or lost",
  "discard-event": "You discard", "cycle-event": "You cycle", "landfall": "A land enters", "counters": "+1/+1 counters",
  "vehicle-crewed": "A Vehicle is crewed", "crew-boost": "Crew helpers", "graveyard": "Cards in the graveyard",
  "scry-event": "You scry or surveil", "instsorc-spell": "Instants and sorceries", "instant-speed": "Instant-speed spells",
  "big-spell": "Big spells (value 5+)", "targets-self": "Spells that target your creature", "historic": "Historic spells",
  "kicker": "Kicked spells", "poison": "Poison", "deathtouch": "Deathtouch", "discard-fodder": "Cards worth discarding",
  "energy": "Energy", "x-spell": "X spells"
};

// The channels nearly every card sits on say little; only specific ones are listed.
function connectionChannelListed(ch) {
  return !ch.startsWith("type:") && !LINK_UNIVERSAL.has(ch);
}

// How deep an engine runs: a deck needs both sides, so depth is the smaller of how many cards need
// the channel and how many make it. The cut-offs are first guesses (a deck holds roughly 6-15 of each).
const CONNECTION_DEPTH_DEEP = 15;
const CONNECTION_DEPTH_OK = 6;

function connectionDepthStatus(depth) {
  if (depth <= 0) return "missing";
  if (depth >= CONNECTION_DEPTH_DEEP) return "deep";
  if (depth >= CONNECTION_DEPTH_OK) return "ok";
  return "thin";
}

// cards: [{ name, card, colorId }] (different cards; lands skipped; colorId is the color identity, "" for colorless). Returns
//   channels: one row per specific channel some card needs { channel, label, wanters, givers, depth, status, wantNames, giveNames }
//   sorted deepest first. A card that both makes and needs a channel counts on each side.
//   byColor[W|U|B|R|G]: { wanters, givers, depth } among that color's single-color cards plus colorless ones,
//   the cards a deck of only that color could play.
function buildCollectionConnections(cards) {
  const knownTypes = new Set();
  for (const { card } of cards) for (const s of readLinkType(card).subs) knownTypes.add(s);
  const giveIndex = new Map();
  const wantIndex = new Map();
  const colorCount = new Map();
  const bump = (kind, ch, colorId) => {
    const key = kind + "|" + ch + "|" + colorId;
    colorCount.set(key, (colorCount.get(key) || 0) + 1);
  };
  let cardCount = 0;
  for (const { name, card, colorId } of cards) {
    if (readLinkType(card).front.includes("land")) continue;
    cardCount += 1;
    const link = readCardLinks(card, knownTypes);
    const cid = colorId || "";
    for (const g of link.gives) { if (!giveIndex.has(g)) giveIndex.set(g, []); giveIndex.get(g).push(name); bump("g", g, cid); }
    for (const w of link.wants) { if (!wantIndex.has(w)) wantIndex.set(w, []); wantIndex.get(w).push(name); bump("w", w, cid); }
  }
  const channels = [];
  for (const [ch, w] of wantIndex) {
    if (!connectionChannelListed(ch)) continue;
    const g = giveIndex.get(ch) || [];
    const depth = Math.min(w.length, g.length);
    const byColor = {};
    for (const c of ["W", "U", "B", "R", "G"]) {
      const count = (kind) => (colorCount.get(kind + "|" + ch + "|") || 0) + (colorCount.get(kind + "|" + ch + "|" + c) || 0);
      byColor[c] = { wanters: count("w"), givers: count("g"), depth: Math.min(count("w"), count("g")) };
    }
    channels.push({ channel: ch, label: CONNECTION_LABELS[ch] || ch, wanters: w.length, givers: g.length, depth, byColor, status: connectionDepthStatus(depth), wantNames: w.slice().sort(), giveNames: g.slice().sort() });
  }
  channels.sort((a, b) => b.depth - a.depth || b.wanters - a.wanters || a.channel.localeCompare(b.channel));
  return { channels, cardCount };
}
