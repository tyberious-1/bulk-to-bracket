// Connection report (not part of the committed dev/tests/jxa suite): reads each card's words as
// outputs ("gives") and inputs ("wants") on named channels, then checks how a build's cards connect.
// A synergy is one card's output meeting another card's input: a Pilot-token maker gives "power",
// a Vehicle wants it; a sacrifice outlet gives "dies", a death payoff wants it.
//
// Loaded by plan_audit.js (cat OUT/h.js dev/tools/jxa-harness/connections.js dev/tools/jxa-harness/plan_audit.js).
// Needs the harness globals (getCardAbilities, getCardType, getCardText, getCrewPower, legalForCommander).
// Channels are a first pass: read a "starved" or "orphan" line as a lead, not a verdict.

const CHANNEL_GENERIC_TYPES = new Set(["creature", "artifact", "enchantment", "land", "planeswalker", "instant", "sorcery", "battle"]);

function linkType(card) {
  const type = getCardType(card);
  const split = type.split("—");
  return { front: split[0], subs: (split[1] || "").trim().split(/\s+/).filter(Boolean) };
}

// What a card gives and wants, as { gives: Set, wants: Set } of channel names.
function linkOf(card, knownTypes) {
  const gives = new Set();
  const wants = new Set();
  const { front, subs } = linkType(card);
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
          for (const w of channelSingular(word)) {
            if (CHANNEL_TYPE_STOP.has(w)) continue;
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
          if (word && (knownTypes.has(word) || CHANNEL_GENERIC_TYPES.has(word)) && word !== "creature") wants.add("type:" + word);
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
  return { gives, wants };
}

// A link through a channel nearly every card sits on says little; a specific channel says a lot.
const CHANNEL_UNIVERSAL = new Set(["power", "fodder-body", "creature-spell", "noncreature-spell", "attack-event", "cheap-spell"]);

// Words a watcher's clause can contain that are never a tribe or permanent type.
const CHANNEL_TYPE_STOP = new Set(["creature", "spell", "token", "permanent", "player", "opponent", "card", "source", "land", "you", "control", "another", "other", "with", "power", "toughness", "counter", "mana", "value", "turn", "first", "second", "kicked", "target", "enchanted", "equipped"]);
function channelSingular(word) {
  return [word, word.replace(/s$/, ""), word.replace(/ves$/, "f"), word.replace(/ies$/, "y"), word.replace(/men$/, "man")];
}
function channelWeight(ch) { return CHANNEL_UNIVERSAL.has(ch) ? 0.25 : 1; }

function isSupportRole(role) { return role === "ramp" || role === "draw" || role === "removal" || role === "wipe"; }

// deck: [{ card, role }] (commander included with role "commander"); owned: Map normalized -> card.
function connectionReport(deck, owned, colors, commanderNames) {
  const knownTypes = new Set();
  for (const card of owned.values()) for (const s of linkType(card).subs) knownTypes.add(s);
  const lines = [];
  const say = (s) => lines.push(s);

  const rows = deck.map((d) => Object.assign({ name: d.card.name, role: d.role, card: d.card }, linkOf(d.card, knownTypes)));
  const giveIndex = new Map();
  const wantIndex = new Map();
  for (const r of rows) {
    for (const g of r.gives) { if (!giveIndex.has(g)) giveIndex.set(g, []); giveIndex.get(g).push(r.name); }
    for (const w of r.wants) { if (!wantIndex.has(w)) wantIndex.set(w, []); wantIndex.get(w).push(r.name); }
  }
  const supply = (channel, self) => (giveIndex.get(channel) || []).filter((n) => n !== self);
  const demand = (channel, self) => (wantIndex.get(channel) || []).filter((n) => n !== self);
  // Plain types and the universal channels are always supplied or never scarce: they show up as links only when wanted.
  // Score: the channels a card connects through, each counted once, universal ones at a quarter.
  const scoreOf = (link, name) => {
    let total = 0;
    for (const w of link.wants) if (supply(w, name).length) total += channelWeight(w);
    for (const g of link.gives) if (demand(g, name).length) total += channelWeight(g);
    return total;
  };

  say("");
  say("-- connections (outputs meeting inputs) --");
  const channels = Array.from(wantIndex.keys()).sort();
  for (const ch of channels) {
    const w = wantIndex.get(ch);
    const g = giveIndex.get(ch) || [];
    const flag = g.length === 0 ? " STARVED (nothing in the deck gives it)" : (g.length < Math.ceil(w.length / 3) ? " thin" : "");
    say("  " + ch + ": wanted by " + w.length + " (" + w.slice(0, 4).join(", ") + (w.length > 4 ? ", ..." : "") + "), given by " + g.length + (g.length ? " (" + g.slice(0, 4).join(", ") + (g.length > 4 ? ", ..." : "") + ")" : "") + flag);
  }

  say("");
  say("-- orphans: plan cards that connect to nothing --");
  const orphans = [];
  const unread = [];
  const counts = [];
  const scoreOfRow = (r) => scoreOf(r, r.name);
  for (const r of rows) {
    if (r.role === "commander" || r.role === "land") continue;
    const links = scoreOf(r, r.name);
    if (!isSupportRole(r.role)) counts.push(links);
    const channels = Array.from(r.gives).filter((g) => !g.startsWith("type:") && !CHANNEL_UNIVERSAL.has(g)).length + r.wants.size;
    if (!isSupportRole(r.role) && links === 0) orphans.push(r.name + (r.wants.size ? " [wants " + Array.from(r.wants).join(", ") + "]" : ""));
    if (!isSupportRole(r.role) && channels === 0) unread.push(r);
  }
  say("  " + orphans.length + " of " + rows.filter((r) => !isSupportRole(r.role) && r.role !== "commander" && r.role !== "land").length + " non-support cards: " + (orphans.join("; ") || "none"));
  counts.sort((a, b) => a - b);
  const median = counts.length ? counts[Math.floor(counts.length / 2)] : 0;
  say("  median score per non-support card: " + median);

  say("");
  say("-- missed connections: owned cards left out that would link to the deck --");
  const inDeck = new Set(rows.map((r) => r.name));
  const cand = [];
  for (const card of owned.values()) {
    if (inDeck.has(card.name)) continue;
    const front = linkType(card).front;
    if (front.includes("land")) continue;
    if (!legalForCommander(card.colors, colors, card) || deadForColors(card, colors)) continue;
    const link = linkOf(card, knownTypes);
    const connected = Array.from(link.wants).filter((w) => supply(w, card.name).length).concat(Array.from(link.gives).filter((g) => demand(g, card.name).length && !g.startsWith("type:")));
    cand.push({ name: card.name, links: scoreOf(link, card.name), via: connected.join(",") });
  }
  cand.sort((a, b) => b.links - a.links);
  for (const c of cand.slice(0, 15)) say("  " + c.name + ": score " + c.links + " via " + (c.via || "-"));
  say("  (median score of a deck's non-support card: " + median + "; owned cards that beat it: " + cand.filter((c) => c.links > median).length + ")");

  say("");
  say("-- unread words: plan cards with no specific output or input found --");
  say("  " + unread.length + ": " + (unread.slice(0, 20).map((r) => r.name + " <" + (getCardAbilities(r.card).map((a) => a.line).join(" / ").slice(0, 70)) + ">").join("; ") || "none"));
  const allOwnedNonland = Array.from(owned.values()).filter((c) => !linkType(c).front.includes("land") && legalForCommander(c.colors, colors, c) && !deadForColors(c, colors) && !commanderNames.includes(c.name));
  const silent = allOwnedNonland.filter((c) => { const l = linkOf(c, knownTypes); return l.wants.size === 0 && Array.from(l.gives).every((g) => g.startsWith("type:") || CHANNEL_UNIVERSAL.has(g)); });
  say("  owned legal nonland cards with no specific output or input read: " + silent.length + " of " + allOwnedNonland.length + " (plain creatures and spells land here too)");
  return lines.join("\n");
}
