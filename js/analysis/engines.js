// Commander engine enablers: what a commander's engine needs (a payload type
// in the graveyard, or devotion to a color) and which owned cards supply it.
// Pure functions on card objects (lowercased `text`/`type`, `manaCost`, `cmc`).
// Spec: dev/docs/superpowers/specs/2026-10-15-commander-engine-enablers.md

const ENGINE_COLOR_LETTERS = { white: "W", blue: "U", black: "B", red: "R", green: "G" };

// Words that can precede "creature token" or follow "return target" without
// being a creature type. Core card types stay out of payloadType on purpose:
// a generic "return target creature card" commander is not a typal engine.
const ENGINE_NON_PAYLOAD_WORDS = new Set([
  "white", "blue", "black", "red", "green", "colorless", "tapped", "untapped",
  "creature", "artifact", "enchantment", "land", "instant", "sorcery", "permanent",
  "nonland", "planeswalker", "legendary", "token", "nontoken", "other", "another"
]);

// A card that exiles what you discard or mill, or empties a graveyard, works against an engine
// that needs those cards to stay so it can return them (Bag of Holding, Containment Construct,
// Lantern of the Lost). Exiling a creature card as a cost or a rider is fuel, not hostile.
function isGraveyardHostile(card) {
  for (const ab of getCardAbilities(card)) {
    for (const e of ab.effects) {
      if (e.label !== "exile-from-graveyard") continue;
      if (e.kind === "all") return true;
      if (e.kind === "that-card" && e.from === "your") return true;
    }
  }
  return false;
}

// What a commander's own abilities run on, read from its tagged triggers (and the abilities it
// hands out in quotes). Each event is { event, direction? }; `direction` only matters for mill:
// "self" mills you, "opponent" mills them, "any" ("target player mills") can be either.
// Nothing scores from these yet; getEventProducers says which owned cards cause each event.
function getCommanderEvents(commanderTexts) {
  const events = [];
  const add = (event, extra) => {
    if (!events.some((e) => e.event === event)) events.push(Object.assign({ event }, extra || {}));
  };
  const directions = new Set();
  const abilities = (commanderTexts || [])
    .filter((t) => typeof t === "string" && t.trim())
    .flatMap((t) => tagTextAbilities(t, ""));
  for (const top of abilities) {
    for (const ab of [top].concat(top.quoted)) {
      const t = ab.trigger;
      if (ab.kind === "triggered") {
        if (t.includes("landfall")) add("landfall");
        if (t.includes("draw-second")) add("draw-second");
        else if (t.includes("draw-event")) add("draw");
        if (t.includes("cast-second")) add("cast-second");
        else if (t.includes("cast-noncreature")) add("cast-noncreature");
        else if (t.includes("cast-spell")) add("cast");
        if (t.includes("counter-placed")) add("counter-placed", { counter: /\+1\/\+1 counters?/.test(ab.line) ? "+1/+1" : "any" });
        if (t.includes("leave-graveyard")) add("leave-graveyard");
      }
      if (ab.effects.some((e) => e.label === "keyword:increment")) add("cast-bigger");
      // "if Denry Klin has counters on it": a commander that copies or uses the counters it carries wants counters of any kind.
      // Perrie, the Pulverizer counts the different kinds of counters among your permanents: variety is the point.
      if (/\bif [^,.]{1,40}? has (?:any |one or more )?counters? on it|different kinds of counters/.test(ab.line)) add("counter-placed", { counter: "any" });
      if (ab.kind !== "triggered" && ab.kind !== "activated") continue;
      for (const e of ab.effects) {
        if (e.label === "mill-other") directions.add("opponent");
        if (e.label === "mill-self") directions.add(/(?:each|target) player mills/.test(ab.line) ? "any" : "self");
        if (e.label === "exile-from-graveyard" && e.from !== "your" && (e.kind === "target" || e.kind === "all")) add("graveyard-fill");
      }
    }
  }
  if (directions.size) add("mill", { direction: directions.size === 1 ? Array.from(directions)[0] : "any" });
  return events;
}

function parseCommanderNeeds(commanderTexts) {
  const text = (commanderTexts || [])
    .filter((t) => typeof t === "string" && t.trim())
    .map((t) => t.toLowerCase())
    .join("\n");
  const needs = { payloadType: null, graveyard: false, returnsFromGraveyard: false, devotionColors: [], events: [] };
  if (!text) return needs;

  needs.graveyard = /\bgraveyard\b/.test(text);

  // Greasefang-style engines bring cards back; Tormod-style engines care when cards leave. Only
  // the first is hurt by something that exiles your graveyard. Read from the commander's own
  // abilities, one text at a time, so a partner's text cannot merge into the first.
  const abilities = (commanderTexts || [])
    .filter((t) => typeof t === "string" && t.trim())
    .flatMap((t) => tagTextAbilities(t, ""));
  const returns = abilities
    .flatMap((ab) => ab.effects)
    .filter((e) => e.label === "return-from-graveyard" && e.from === "your");
  needs.returnsFromGraveyard = returns.length > 0;

  const candidates = [];
  for (const e of returns) {
    const typed = /^([a-z][a-z-]*)(?: creature| artifact| enchantment)?$/.exec(String(e.object || ""));
    if (typed) candidates.push(typed[1]);
  }
  const token = text.match(/create [^.]*?\b([a-z]+) creature tokens?/);
  if (token) candidates.push(token[1]);
  needs.payloadType = candidates.find((word) => !ENGINE_NON_PAYLOAD_WORDS.has(word)) || null;

  // Devotion conditions, read from the labels (a quoted ability counts too).
  for (const ab of abilities) {
    for (const effect of ab.effects.concat(...ab.quoted.map((q) => q.effects))) {
      if (effect.label !== "devotion-condition") continue;
      for (const word of effect.colors) {
        const letter = ENGINE_COLOR_LETTERS[word];
        if (letter && !needs.devotionColors.includes(letter)) needs.devotionColors.push(letter);
      }
    }
  }
  needs.events = getCommanderEvents(commanderTexts);
  return needs;
}

// The graveyard flag alone does not activate anything: plenty of commanders
// mention the graveyard without a payload to enable.
function isEngineActive(needs) {
  return Boolean(needs && (needs.payloadType || (needs.devotionColors && needs.devotionColors.length)));
}

const ENGINE_DEVOTION_PAYOFF_PATTERN = /devotion to/;

function engineTypePattern(type) {
  return type.replace(/[^a-z-]/g, "");
}

// Payload types that are not creatures: a "creature card" in the graveyard is never one.
const ENGINE_NONCREATURE_PAYLOADS = new Set(["vehicle", "equipment", "aura", "saga", "food", "clue", "treasure"]);

// Cost per use decides whether a graveyard enabler is strong (spec requirement 9): a repeatable
// ability is weak at {3} or more, a one-shot at mana value 4 or more.
const ENGINE_REPEATABLE_WEAK_MANA = 3;
const ENGINE_ONE_SHOT_WEAK_CMC = 4;

function getAbilityStrength(ab, card) {
  const oneShot = isOneShotAbility(ab);
  const mana = getAbilityManaCost(ab);
  const cmc = Number(card && card.cmc) || 0;
  return { oneShot, mana, weak: oneShot ? cmc >= ENGINE_ONE_SHOT_WEAK_CMC : mana >= ENGINE_REPEATABLE_WEAK_MANA };
}

// A real enabler can still be a worse one: these flaws cost a few points and are shown in the report.
// Paying life is how black pays for things, so it is not a flaw. Sorcery speed only matters when
// the ability is not a cheap repeatable one: {2} or less once a turn still feeds a Vehicle each turn.
function getAbilityFlaws(ab, creaturePayload, strength) {
  const flaws = [];
  const cheapRepeatable = !strength.oneShot && strength.mana < ENGINE_REPEATABLE_WEAK_MANA;
  if (ab.restrictions.includes("sorcery-speed") && !cheapRepeatable) flaws.push("sorcery-speed");
  if (ab.cost.includes("discard-multiple")) flaws.push("discards two or more");
  if (ab.cost.includes("tap-other")) flaws.push("taps another permanent");
  const fuel = ab.effects.find((e) => e.label === "exile-from-graveyard" && e.kind === "own-cards" && e.from === "your");
  if (fuel && !(/\bcreature\b/.test(fuel.object) && !creaturePayload)) flaws.push("spends graveyard cards");
  return flaws;
}

function engineObjectNamesType(object, type) {
  return new RegExp(`\\b${type}s?\\b`).test(String(object || ""));
}

// Can a return-from-graveyard object be the payload without naming it? A Vehicle is an artifact
// and a permanent but never a "creature card"; a creature type is a creature and a permanent.
function engineObjectFitsGeneric(object, creaturePayload) {
  const o = String(object || "");
  if (o === "any") return true;
  if (creaturePayload) return !/\bnoncreature\b/.test(o) && /\b(?:creature|permanent)\b/.test(o);
  return /\b(?:permanent|artifact)\b/.test(o);
}

// Can a discard filter ("a creature card", "an artifact card") discard the payload?
function engineDiscardFits(object, type, creaturePayload) {
  const o = String(object || "");
  if (!o || o === "any" || engineObjectNamesType(o, type)) return true;
  if (/\b(?:nonland|permanent)\b/.test(o)) return true;
  return creaturePayload ? /\bcreature\b/.test(o) : /\b(?:artifact|noncreature)\b/.test(o);
}

function getEngineClassDetails(card, needs) {
  if (!card || (!isEngineActive(needs) && !hasEventNeeds(needs))) return [];
  const text = getCardText(card);
  const abilities = getCardAbilities(card);
  const found = new Map();
  // Keep the strongest reading of a class: not weak beats weak, then fewer flaws.
  const add = (cls, weak, flaws) => {
    const isWeak = weak || ENGINE_WEAK_CLASSES.has(cls);
    const prev = found.get(cls);
    if (!prev || (prev.weak && !isWeak) || (prev.weak === isWeak && flaws.length < prev.flaws.length)) {
      found.set(cls, { cls, weak: isWeak, flaws });
    }
  };

  const type = needs.payloadType ? engineTypePattern(needs.payloadType) : "";
  if (type) {
    const creaturePayload = !ENGINE_NONCREATURE_PAYLOADS.has(type);
    if (getCardSubtypes(card).includes(type)) {
      add("payload", false, []);
      // A non-creature payload (a Vehicle) that also makes mana does two jobs in the deck.
      if (!creaturePayload && abilities.some((ab) => ab.effects.some((e) => e.label === "add-mana"))) add("payloadRamp", false, []);
    }

    if (needs.graveyard && !(needs.returnsFromGraveyard && isGraveyardHostile(card))) {
      for (const ab of abilities) {
        const strength = getAbilityStrength(ab, card);
        const flaws = getAbilityFlaws(ab, creaturePayload, strength);
        const weak = strength.weak;
        for (const e of ab.effects) {
          if (e.label === "return-from-graveyard" && e.from === "your" && e.object !== "self" && (e.to === "battlefield" || e.to === "hand")) {
            if (engineObjectNamesType(e.object, type)) add("recursion", false, flaws);
            else if (engineObjectFitsGeneric(e.object, creaturePayload)) add("recursionGeneric", false, flaws);
          }
          if (e.label === "loot" || e.label === "rummage") add("discard", weak, flaws);
          if (e.label === "discard-self" && engineDiscardFits(e.object, type, creaturePayload)) add("discard", weak, flaws);
          if (e.label === "discard-any-player") add("discard", true, flaws);
          if (e.label === "mill-self" && !ab.effects.some((x) => x.label === "mill-other")) add("selfMill", weak, flaws);
          if (e.label === "surveil") add("surveil", true, flaws);
        }
        if (ab.kind === "activated") {
          if (ab.cost.includes("discard-card") || ab.cost.includes("discard-multiple")) add("discard", weak, flaws);
          if (ab.cost.includes("sacrifice-other")) add("sacrifice", true, flaws);
        }
      }
    }

    if (new RegExp(`\\bother ${type}s?\\b|\\b${type}s? you control\\b`).test(text)) add("lord", false, []);

    if (type === "vehicle") {
      for (const ab of abilities) {
        if (ab.trigger.includes("crews") || ab.trigger.includes("becomes-tapped")) add("crewTap", false, []);
        if (ab.effects.some((e) => e.label === "crew-helper")) add("crewHelper", false, []);
      }
      const power = Number(card.raw && card.raw.power);
      if (getCardType(card).includes("creature") && Number(card.cmc || 0) <= 2 && power >= 3) add("crewBody", false, []);
    }
  }

  if (needs.devotionColors && needs.devotionColors.length && ENGINE_DEVOTION_PAYOFF_PATTERN.test(text)) {
    add("devotionPayoff", false, []);
  }

  // One class per event the card causes ("event:landfall"), scored separately and never injected.
  for (const p of getEventProducers(card, needs)) add("event:" + p.event, p.weak, []);
  return Array.from(found.values());
}

function getEngineClasses(card, needs) {
  return getEngineClassDetails(card, needs).map((d) => d.cls);
}

// Which events an owned card causes, read from its labels. Returns one entry per event the card
// produces: { event, via, weak, flaws }. `via` is the reason shown in the report; `weak` follows the
// same cost-per-use rule as the graveyard classes (getAbilityStrength). A card that produces an event
// only through its type (an instant or sorcery is a noncreature spell) is weak at mana value 4+.
const GRAVEYARD_LEAVE_KEYWORDS = new Set(["flashback", "escape", "unearth", "embalm", "eternalize", "disturb", "jump-start", "aftermath", "retrace", "scavenge", "dredge"]);

// Mill produced by one effect, as a direction: "target player mills" can be either.
function millDirection(effectLabel, line) {
  if (effectLabel === "mill-other") return "opponent";
  return /(?:each|target) player mills/.test(line) ? "any" : "self";
}

function getEventProducers(card, needs) {
  if (!card || !needs || !Array.isArray(needs.events) || !needs.events.length) return [];
  if (getCardType(card).split("—")[0].includes("land")) return [];
  const found = new Map();
  const add = (event, via, weak, flaws) => {
    const prev = found.get(event);
    if (!prev || (prev.weak && !weak) || (prev.weak === weak && flaws.length < prev.flaws.length)) {
      found.set(event, { event, via, weak, flaws });
    }
  };
  const wanted = new Map(needs.events.map((e) => [e.event, e]));
  const type = getCardType(card);
  const cmc = Number(card.cmc) || 0;
  const hasX = /\{x\}/i.test(String(card.manaCost || ""));

  for (const ab of getCardAbilities(card)) {
    const strength = getAbilityStrength(ab, card);
    const flaws = getAbilityFlaws(ab, true, strength);
    const labels = ab.effects.map((e) => e.label);
    const has = (label) => labels.includes(label);

    if (wanted.has("landfall")) {
      if (has("land-to-battlefield")) add("landfall", "puts a land onto the battlefield", strength.weak, flaws);
      else if (ab.trigger.includes("landfall")) add("landfall", "landfall card", false, flaws);
    }
    for (const event of ["draw", "draw-second"]) {
      if (wanted.has(event) && (has("draw") || has("loot") || has("rummage"))) add(event, "draws a card", strength.weak, flaws);
    }
    // A card that reacts to counters (a counter-placed trigger) is a payoff, not a producer.
    if (wanted.has("counter-placed") && !ab.trigger.includes("counter-placed")) {
      // Only counters put on a creature, and only the kind the commander wants (Berta: +1/+1; Denry Klin: any).
      const wantsKind = wanted.get("counter-placed").counter;
      const puts = /\b(?:put|puts|enters with|enter with)\b/.test(ab.line) && (type.includes("creature") || /\bcreatures?\b/.test(ab.line));
      if (/\bproliferate\b/.test(ab.line)) add("counter-placed", "proliferates", strength.weak, flaws);
      else if (puts && ab.effects.some((e) => e.label === "counters" && (wantsKind !== "+1/+1" || e.counter === "+1/+1"))) add("counter-placed", "puts counters on a creature", strength.weak, flaws);
    }
    if (wanted.has("mill")) {
      const want = wanted.get("mill").direction;
      for (const e of ab.effects) {
        if (e.label !== "mill-self" && e.label !== "mill-other") continue;
        const dir = millDirection(e.label, ab.line);
        if (dir === want || dir === "any" || want === "any") add("mill", dir === "opponent" ? "mills an opponent" : "mills a library", strength.weak, flaws);
      }
    }
    if (wanted.has("leave-graveyard")) {
      const kw = ab.effects.map((e) => e.label).find((l) => l.startsWith("keyword:") && GRAVEYARD_LEAVE_KEYWORDS.has(l.slice(8)));
      if (kw) add("leave-graveyard", kw.slice(8), false, []);
      else if (ab.effects.some((e) => e.label === "return-from-graveyard" && e.from === "your" && e.object !== "self")) add("leave-graveyard", "returns a card from your graveyard", strength.weak, flaws);
      else if (ab.effects.some((e) => e.label === "exile-from-graveyard" && e.kind === "own-cards")) add("leave-graveyard", "exiles cards from your graveyard", strength.weak, flaws);
    }
    if (wanted.has("graveyard-fill")) {
      const fills = ["mill-self", "mill-other", "discard-self", "discard-opponent", "discard-any-player", "loot", "rummage", "put-into-graveyard"];
      if (labels.some((l) => fills.includes(l)) || ab.cost.includes("discard-card")) add("graveyard-fill", "fills a graveyard", strength.weak, flaws);
      else if (has("surveil")) add("graveyard-fill", "surveils", true, flaws);
    }
  }

  // Types and costs: a noncreature spell, a second spell in a turn, a bigger spell.
  const spell = /\b(?:instant|sorcery)\b/.test(type);
  if (wanted.has("cast-noncreature")) {
    if (spell) add("cast-noncreature", "instant or sorcery", cmc >= ENGINE_ONE_SHOT_WEAK_CMC, []);
    else if (!type.includes("creature")) add("cast-noncreature", "noncreature permanent", true, []);
  }
  if (wanted.has("cast-second") && cmc <= 2 && (spell || getCardAbilities(card).some((ab) => ab.effects.some((e) => e.label === "draw")))) {
    add("cast-second", "cheap spell", false, []);
  }
  // An X spell is whatever size you pay for, so it is a weak (flexible) producer; a base cost of 5+ is a solid one.
  if (wanted.has("cast-bigger") && (hasX || cmc >= 5)) add("cast-bigger", cmc >= 5 ? "big spell" : "X spell", cmc < 5, []);
  return Array.from(found.values());
}

// Event producers score a little: a card that causes one of the commander's events gets a flat bonus
// (6 strong, 3 weak, the larger one if it causes several). They are never injected into the theme tier:
// some event lists run to hundreds of cards, so the bonus only ranks cards already in play.
const ENGINE_EVENT_WEIGHT = 6;
const ENGINE_EVENT_WEAK_WEIGHT = 3;

function hasEventNeeds(needs) {
  return Boolean(needs && Array.isArray(needs.events) && needs.events.length);
}

function isEventClass(cls) {
  return String(cls).startsWith("event:");
}

// The "Event Engines" switch (a build mode): off drops every event, so the builder runs exactly as it
// did before events existed. `modePrefs.eventEngines` is undefined when no mode was parsed, which keeps events.
function applyEventSwitch(needs, modePrefs) {
  if (needs && modePrefs && modePrefs.eventEngines === false) needs.events = [];
  return needs;
}

const EVENT_LABELS = {
  landfall: "landfall",
  draw: "cards drawn",
  "draw-second": "a second card drawn each turn",
  cast: "spells cast",
  "cast-noncreature": "noncreature spells",
  "cast-second": "a second spell each turn",
  "cast-bigger": "bigger spells",
  mill: "mill",
  "leave-graveyard": "cards leaving the graveyard",
  "counter-placed": "counters",
  "graveyard-fill": "graveyard fill"
};

// The report line for event engines: the strong producers in the deck, each with what it does, at most
// `limit` of them. Returns null when the commander has no event or the deck holds no producer.
function describeEventProducers(deck, allOwnedCardData, needs, limit) {
  if (!hasEventNeeds(needs)) return null;
  const max = limit || 12;
  const items = [];
  for (const entry of deck || []) {
    if (entry.role === "land") continue;
    const card = allOwnedCardData.get(normalizeCardName(entry.name));
    if (!card) continue;
    const strong = getEventProducers(card, needs).filter((p) => !p.weak);
    if (!strong.length) continue;
    items.push({ name: entry.name, reason: strong[0].via, flaws: strong[0].flaws });
  }
  if (!items.length) return null;
  const label = `Event engines (${needs.events.map((e) => EVENT_LABELS[e.event] || e.event).join(", ")})`;
  return { label, items: items.slice(0, max), more: Math.max(0, items.length - max) };
}

// "Crew 3" -> 3. Vehicles with a low crew number are easier to use.
function getCrewCost(card) {
  const match = getCardText(card).match(/\bcrew (\d+)\b/);
  return match ? Number(match[1]) : null;
}

// Pips of one color in a card's mana cost: {U}, hybrid {U/R} and {2/U} count,
// generic and {X} do not.
function countDevotionPips(card, colorLetter) {
  const cost = String((card && card.manaCost) || "").toUpperCase();
  let pips = 0;
  for (const symbol of cost.match(/\{[^}]+\}/g) || []) {
    if (symbol.slice(1, -1).split("/").includes(colorLetter)) pips += 1;
  }
  return pips;
}

// Initial weights, in the same point scale as scoreCard's theme bonuses (a
// plan signature card gets 20-40). Tuned against the baseline in the
// measurement pass. Repeatable discard and direct self-mill rank first for
// graveyard engines, then recursion, then payload, then surveil (slow but
// real), with sacrifice outlets last: a sacrificed Vehicle costs real mana.
const ENGINE_CLASS_WEIGHTS = {
  discard: 14,
  selfMill: 12,
  recursion: 12,
  lord: 12,
  crewTap: 14,
  devotionPayoff: 10,
  crewHelper: 10,
  recursionGeneric: 5,
  crewBody: 5,
  payloadRamp: 8,
  surveil: 5,
  payload: 4,
  sacrifice: 2
};
const ENGINE_MULTI_HIT_BONUS = 6;      // per class beyond the first
const ENGINE_FLAW_PENALTY = 3;         // per distinct flaw on the card
const ENGINE_BONUS_CAP = 36;           // keep one card from swamping roles and curve
const ENGINE_DEVOTION_PIP_BONUS = 4;   // per pip of the devotion color on a permanent
const ENGINE_DEVOTION_PIP_CAP = 12;

function getEngineBonus(card, needs) {
  if (!card || (!isEngineActive(needs) && !hasEventNeeds(needs))) return 0;
  const type = getCardType(card);
  if (type.split("—")[0].includes("land")) return 0;

  const allDetails = getEngineClassDetails(card, needs);
  const eventDetails = allDetails.filter((d) => isEventClass(d.cls));
  const details = allDetails.filter((d) => !isEventClass(d.cls));
  const classes = details.map((d) => d.cls);
  // A flaw on the card is charged once, however many classes it earned; the floor is half the class weights.
  const weights = details.reduce((sum, d) => sum + (ENGINE_CLASS_WEIGHTS[d.cls] || 0), 0);
  const flaws = new Set(details.flatMap((d) => d.flaws));
  let bonus = Math.max(weights / 2, weights - ENGINE_FLAW_PENALTY * flaws.size);
  if (classes.length > 1) bonus += ENGINE_MULTI_HIT_BONUS * (classes.length - 1);
  // An event producer adds its weight once, whatever number of events it causes (the larger if it causes several).
  if (eventDetails.length) bonus += eventDetails.some((d) => !d.weak) ? ENGINE_EVENT_WEIGHT : ENGINE_EVENT_WEAK_WEIGHT;

  if (needs.payloadType === "vehicle" && classes.includes("payload")) {
    const crew = getCrewCost(card);
    if (crew !== null && crew <= 2) bonus += 4;
    else if (crew !== null && crew <= 3) bonus += 2;
    if (/when(?:ever)? [^.]*(?:enters|attacks)/.test(getCardText(card))) bonus += 2;
  }

  // Devotion counts permanents only: an instant or sorcery is never on the battlefield.
  if (needs.devotionColors && needs.devotionColors.length && !type.includes("instant") && !type.includes("sorcery")) {
    const pips = needs.devotionColors.reduce((sum, color) => sum + countDevotionPips(card, color), 0);
    if (pips > 0) {
      bonus += Math.min(ENGINE_DEVOTION_PIP_CAP, ENGINE_DEVOTION_PIP_BONUS * pips);
      if (Number(card.cmc || 0) <= 3 && pips >= 2) bonus += 2;
    }
  }
  return Math.min(ENGINE_BONUS_CAP, bonus);
}

// Classes that earn the score bonus but are too loose to pull a card into the
// theme tier: surveil only sometimes fills the graveyard, sacrifice outlets
// cost a card, and crewBody matches dozens of ordinary creatures. A single ability can also be
// weak by cost per use (spec requirement 9), which getEngineClassDetails marks.
const ENGINE_WEAK_CLASSES = new Set(["surveil", "sacrifice", "crewBody"]);

// Puts owned enabler cards into the theme-tier candidate set. Without this an
// enabler that matches no EDHREC theme is only reached by generic backfill,
// after the theme tier runs dry, and the score bonus never gets a say.
function addEngineCandidates(themeCardNames, needs, allOwnedCardData, commanderColors) {
  if (!isEngineActive(needs)) return themeCardNames;
  for (const [normalizedName, card] of allOwnedCardData) {
    if (getCardType(card).split("—")[0].includes("land")) continue;
    if (!legalForCommander(card.colors || [], commanderColors, card)) continue;

    const strong = getEngineClassDetails(card, needs).filter((d) => !d.weak && !isEventClass(d.cls));
    let hits = strong.length;
    if (!hits && needs.devotionColors.length) {
      const heavy = needs.devotionColors.some((color) => countDevotionPips(card, color) >= 2);
      const type = getCardType(card);
      if (heavy && !type.includes("instant") && !type.includes("sorcery")) hits = 1;
    }
    if (!hits) continue;

    // An engine match is a top-tier fit: an existing theme match moves to rank 0.
    const existing = themeCardNames.get(normalizedName);
    if (existing) {
      existing.rank = 0;
      existing.hits += hits;
    } else {
      themeCardNames.set(normalizedName, { rank: 0, hits });
    }
  }
  return themeCardNames;
}

// Names of nonland deck cards that carry a strong engine class (weak classes
// score a little but do not explain why a card is in the deck). Deck entries have no
// oracle text, so the text comes from allOwnedCardData.
const ENGINE_CLASS_REASONS = {
  discard: () => "discard outlet",
  selfMill: () => "self-mill",
  recursion: (needs) => `returns ${needs.payloadType}s`,
  recursionGeneric: () => "recursion",
  surveil: () => "surveil",
  sacrifice: () => "sacrifice outlet",
  lord: () => "lord",
  crewTap: () => "pays off crewing",
  crewHelper: () => "crew helper",
  crewBody: () => "crew body",
  devotionPayoff: () => "devotion payoff",
  payloadRamp: (needs) => `is a ${needs.payloadType.charAt(0).toUpperCase()}${needs.payloadType.slice(1)} that ramps`,
  payload: (needs) => `is a ${needs.payloadType.charAt(0).toUpperCase()}${needs.payloadType.slice(1)}`
};

// Why each nonland deck card is an enabler: its strongest class, and the flaws on that class.
function describeEngineEnablers(deck, allOwnedCardData, needs) {
  if (!isEngineActive(needs)) return [];
  const items = [];
  for (const entry of deck || []) {
    if (entry.role === "land") continue;
    const card = allOwnedCardData.get(normalizeCardName(entry.name));
    if (!card) continue;
    const strong = getEngineClassDetails(card, needs).filter((d) => !d.weak && !isEventClass(d.cls));
    if (!strong.length) continue;
    strong.sort((a, b) => (ENGINE_CLASS_WEIGHTS[b.cls] || 0) - (ENGINE_CLASS_WEIGHTS[a.cls] || 0));
    items.push({ name: entry.name, reason: ENGINE_CLASS_REASONS[strong[0].cls](needs), flaws: strong[0].flaws });
  }
  return items;
}

function describeEngineEnablerItem(item) {
  return item.flaws && item.flaws.length ? `${item.name} (${item.reason}; flawed: ${item.flaws.join(", ")})` : `${item.name} (${item.reason})`;
}

function listEngineEnablers(deck, allOwnedCardData, needs) {
  return describeEngineEnablers(deck, allOwnedCardData, needs).map((item) => item.name);
}

// Utility lands that name the payload type (Foul Roads, Country Roads, Mech
// Hangar for Vehicles) are picked by evaluateNonbasicLand in manabase.js, not
// the nonland pool, so they get their own small lift.
const ENGINE_LAND_BONUS = 4;

function getEngineLandBonus(card, needs) {
  if (!card || !needs || !needs.payloadType) return 0;
  if (!getCardType(card).split("—")[0].includes("land")) return 0;
  return new RegExp(`\\b${engineTypePattern(needs.payloadType)}s?\\b`).test(getCardText(card)) ? ENGINE_LAND_BONUS : 0;
}

function describeEngineNeeds(needs) {
  if (!isEngineActive(needs)) return "";
  const parts = [];
  if (needs.payloadType) {
    const name = needs.payloadType.charAt(0).toUpperCase() + needs.payloadType.slice(1);
    parts.push(needs.graveyard ? `${name} in the graveyard` : name);
  }
  if (needs.devotionColors && needs.devotionColors.length) parts.push(`devotion to ${needs.devotionColors.join("/")}`);
  return `Engine enablers for ${parts.join(", ")}`;
}
