
// Bottom-up builds: what an archetype asks of a deck, and how one card reads for a subtype.
//
// detectRole/getRoleContributions (scoring.js) are shared with the commander-first builder, so
// their mistakes are corrected here (bottomUpRole) and not in scoring.js, where a change would
// move all 13 baseline builds.
//
// Depends on: cards.js (getCardText, getCardType, getCardSubtypes),
//   scoring.js (detectRole, getRoleContributions, detectCardTags)

// A 100-card deck without the commander is 99 cards; about 37 are lands.
const BOTTOM_UP_NONLAND_SLOTS = 62;

// Slot targets are for BOTTOM_UP_NONLAND_SLOTS. avgCmc is the curve the scorer pulls toward;
// removalQuality weights hard removal over counters, bounce and auras.
const ARCHETYPES = {
  aggro: {
    label: "Aggro",
    slots: { creature: 28, ramp: 6, draw: 6, removal: 6, wipe: 0 },
    avgCmc: 2.2, cheapCreatures: 0.8, removalQuality: 0.4, keywordFactor: 1.2
  },
  midrange: {
    label: "Midrange",
    slots: { creature: 24, ramp: 9, draw: 8, removal: 8, wipe: 2 },
    avgCmc: 2.5, cheapCreatures: 0, removalQuality: 0.5, keywordFactor: 1
  },
  control: {
    label: "Control",
    slots: { creature: 14, ramp: 8, draw: 11, removal: 11, wipe: 4 },
    avgCmc: 2.7, cheapCreatures: 0, removalQuality: 0.8, keywordFactor: 0.7
  }
};
const ARCHETYPE_ORDER = ["aggro", "midrange", "control"];

// Lands, from the colors' baseline (manabase.js recommendLandCount): a low curve needs fewer, a slower
// deck with more card draw wants to hit every drop. Clamped to the 35-38 range the baseline lives in.
const BOTTOM_UP_LAND_ADJUST = { aggro: -1, midrange: 0, control: 1 };
function bottomUpLandCount(archetype, colors) {
  const adjusted = recommendLandCount(colors || []) + (BOTTOM_UP_LAND_ADJUST[archetype] || 0);
  return Math.min(38, Math.max(35, adjusted));
}

const REMOVAL_QUALITY = { hard: 3, permanent: 3, counter: 2, softcounter: 1.5, narrowcounter: 1.5, bounce: 1, conditional: 1, other: 0 };

// Counterspells reserved inside the removal slots, as [blue with other colors, mono-blue].
// Control leans on them most; aggro does not run them.
const COUNTER_FLOOR = { aggro: [0, 0], midrange: [3, 5], control: [5, 7] };
function counterFloor(archetype, colors, nonlandSlots) {
  if (!(colors || []).includes("U") || !COUNTER_FLOOR[archetype]) return 0;
  const base = COUNTER_FLOOR[archetype][colors.length === 1 ? 1 : 0];
  const scaled = scaleSlots({ floor: base, removal: ARCHETYPES[archetype].slots.removal }, nonlandSlots || BOTTOM_UP_NONLAND_SLOTS);
  return Math.min(scaled.floor, scaled.removal);
}
function isCounterKind(kind) { return kind === "counter" || kind === "softcounter" || kind === "narrowcounter"; }

// Artifact and enchantment answers (Rhystic Study is a bigger problem than most creatures) are reserved
// inside the removal slots, and capped so they cannot crowd out answers to creatures.
const ANSWER_FLOOR = { aggro: 1, midrange: 2, control: 2 };
const BOTTOM_UP_ANSWER_CAP = 3;
function answerFloor(archetype, nonlandSlots) {
  const scaled = scaleSlots({ floor: ANSWER_FLOOR[archetype] || 0, removal: ARCHETYPES[archetype].slots.removal }, nonlandSlots || BOTTOM_UP_NONLAND_SLOTS);
  return Math.min(scaled.floor, scaled.removal);
}

// Quality inside a support role, like REMOVAL_QUALITY: a card that keeps working beats one that
// fires once. Land search counts as reliable ramp (it cannot be removed and it fixes colors).
const DRAW_QUALITY = { engine: 3, pure: 2, cantrip: 1, filter: 0 };

const BOTTOM_UP_WEIGHT = {
  member: 6, payoff: 5, mention: 2, spares: 4, engine: 2, primaryTag: 1.5, crewPower: 0.25, crewEase: 0.4,
  symmetricWipeTribal: -3, symmetricWipeAggro: -4, wipeFloor: -1,
  roleBase: 1, curve: 0.35,
  rampReliable: 1.5, drawQuality: 2, drawTrigger: 4
};

// Combat keywords that make a body better at its job. Every plain member of a tribe scores the same
// otherwise, and ties fell to the alphabet, so a flying double striker lost to a vanilla 2/2. The
// weights stay under a curve step or two: they order bodies inside the member tier, never lift a card
// past it. Haste is left out on purpose (it does not make a deck aggro).
const BOTTOM_UP_KEYWORD_WEIGHT = {
  flying: 0.5, "first strike": 0.4, "double strike": 0.7, menace: 0.3,
  trample: 0.2, vigilance: 0.2, lifelink: 0.2, deathtouch: 0.3
};
const BOTTOM_UP_KEYWORD_CAP = 1.4;

// Scryfall's own keyword list when the card carries it, else the lines of rules text that are nothing
// but keywords ("flying, first strike"), so a line like "target creature gains flying" is not read.
function cardKeywords(card) {
  const found = new Set();
  const listed = card && card.raw && Array.isArray(card.raw.keywords) ? card.raw.keywords : null;
  if (listed) {
    for (const word of listed) {
      const key = String(word).toLowerCase();
      if (BOTTOM_UP_KEYWORD_WEIGHT[key] !== undefined) found.add(key);
    }
    return found;
  }
  for (const line of getCardText(card).replace(/\([^)]*\)/g, " ").split("\n")) {
    const parts = line.split(/[,;]| and /).map((part) => part.trim()).filter(Boolean);
    if (parts.length && parts.every((part) => BOTTOM_UP_KEYWORD_WEIGHT[part] !== undefined)) parts.forEach((part) => found.add(part));
  }
  return found;
}

function keywordScore(card) {
  let total = 0;
  for (const key of cardKeywords(card)) total += BOTTOM_UP_KEYWORD_WEIGHT[key];
  return Math.min(BOTTOM_UP_KEYWORD_CAP, total);
}

// Scryfall's popularity rank for a card (1 is the most played; EDHREC's own ranking). It breaks ties
// between cards the scorer cannot tell apart -- 118 blue counterspells score alike -- where the
// alphabet used to choose. A card without one (a test fixture, a very new card) ranks last.
const BOTTOM_UP_UNRANKED = 1e9;
function popularityRank(card) {
  const rank = card && card.raw ? Number(card.raw.edhrec_rank) : NaN;
  return Number.isFinite(rank) && rank > 0 ? rank : BOTTOM_UP_UNRANKED;
}

function scaleSlots(slots, nonlandSlots) {
  const factor = nonlandSlots / BOTTOM_UP_NONLAND_SLOTS;
  const scaled = {};
  for (const [role, count] of Object.entries(slots)) scaled[role] = Math.round(count * factor);
  return scaled;
}

function escapeBottomUpRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// "each player sacrifices a creature of their choice" is one-for-one removal, not a sweeper.
function isEdict(text) {
  // "for each creature card in your graveyard" counts cards, it does not name a sweep.
  const scoped = text.replace(/\bfor each [^.\n]*/g, " ");
  if (/\b(?:destroy|exile) all\b|\ball creatures\b|\beach creature\b/.test(scoped)) return false;
  return /\b(?:each|target) (?:player|opponent) sacrifices (?:an?|two|three) /.test(scoped);
}

// "destroy target land" (Polluted Dead, Stone Rain) answers no threat.
function isLandRemoval(text) {
  if (!/\b(?:destroy|exile) target [^.]*\bland\b/.test(text)) return false;
  return !/\btarget [^.]*\b(?:creature|permanent|planeswalker|artifact|enchantment)\b|\bany target\b/.test(text);
}

// "destroy target artifact or enchantment" (Disenchant, Cathar Commando): an answer to the permanents
// a creature spell cannot touch. A card that can also hit a creature or any permanent is ordinary removal.
function isPermanentAnswer(text) {
  if (!/\b(?:destroy|exile) target [^.]*\b(?:artifact|enchantment)\b/.test(text)) return false;
  return !/\btarget [^.]*\b(?:creature|permanent|planeswalker)\b|\bany target\b|\bdeals? \d+ damage\b|-\d+\/-\d+/.test(text);
}

// "exile up to one target nonland permanent" (Aang's Iceberg, Celebrate the Mountain-king): the shared
// "exile target" pattern misses the "up to one" wording. Your own creature (blink) and a graveyard card answer nothing.
function isUpToExileRemoval(text) {
  const phrases = text.match(/\b(?:destroy|exile) up to \w+ (?:other |another )?target [^.;\n]*/g) || [];
  return phrases.some((phrase) => /\b(?:creature|permanent|planeswalker|artifact|enchantment)\b/.test(phrase) && !/\byou control\b|\bgraveyards?\b/.test(phrase));
}

// Removal the shared "destroy target / damage to target creature" patterns do not reach: burn at any
// target, a shrink that kills (-2/-2 or worse; the shared bar of -4/-4 is for whole-deck builds),
// bouncing an opposing creature, and tucking it into a library. A ping of 1, a hit that reaches only
// players, a shrink on your own creature, and your own blink all stay out.
function isExtraRemoval(text) {
  const burn = text.match(/\bdeals? (\d+|x) damage (?:divided as you choose )?(?:to|among) (?:up to \w+ )?(?:any target|(?:another )?target creature|(?:another )?target (?:attacking|blocking|nonland)|one or two target|each of up to \w+ target)/);
  if (burn && (burn[1] === "x" || Number(burn[1]) >= 2)) return true;
  const shrink = text.match(/\btarget creature(?! you control)[^.]*\bgets? -(\d+|x)\/-(\d+|x)/);
  if (shrink && (shrink[2] === "x" || Number(shrink[2]) >= 2)) return true;
  const bounce = text.match(/\breturn (?:up to \w+ )?(?:other |another )?target (?:nonland permanent|creature(?: or \w+)?)[^.]*to (?:its|their) owner's hand/);
  if (bounce && !/\byou control\b/.test(bounce[0])) return true;
  const tuck = text.match(/\bput target ([^.]*)\b(?:on the bottom of|on top of|into|second from the top of) its owner's library/);
  return Boolean(tuck) && !/\bcards?\b|\bgraveyards?\b/.test(tuck[1]);
}

// Exile then return ("exile target creature you control, then return it"; Momentary Blink, Otherworldly
// Journey) saves a creature or resets it: no threat is answered.
function isBlink(text) {
  return /\bexile (?:up to \w+ )?(?:another |other )?target [^.]*(?:, then return\b|\. (?:(?:at the beginning of [^,]*|if you do), )?return (?:it|that card|them)\b|\. if you do, return\b)/.test(text);
}

// "return target permanent you control to its owner's hand" saves your own card (Rescue).
function isSelfBounce(text) {
  const bounce = text.match(/\breturn (?:up to \w+ )?(?:other |another )?target [^.]*to (?:its|their) owner's hand/);
  return Boolean(bounce) && /\byou control\b/.test(bounce[0]) && !/\b(?:destroy|exile) target|\bdeals? (?:\d+|x) damage|\bgets? -\d/.test(text);
}

// "destroy target Vampire, Werewolf, or Zombie" (Slayer of the Wicked) hits a creature type, not a creature:
// dead cards against most decks. Every target it names must lack a general noun to count.
function namesOnlyCreatureTypes(text) {
  const phrases = text.match(/\b(?:destroy|exile) (?:up to \w+ )?(?:other |another )?target [^.;:\n]*/g) || [];
  return phrases.length > 0 && phrases.every((phrase) => !/\b(?:creature|permanent|planeswalker|artifact|enchantment|land|spell|card|player|opponent|battle|token)s?\b/.test(phrase));
}

// Damage that only reaches players ("it deals damage equal to its power to each opponent") is not removal.
function isFaceDamageOnly(text) {
  if (!/\bdeals? [^.]*damage[^.]*\bto (?:each|target) (?:opponent|player)\b/.test(text)) return false;
  return !/\bany target\b|\btarget creature\b|\bcreature or\b|\bplaneswalker\b|\b(?:destroy|exile|sacrifices?)\b|-\d+\/-\d+|\bto each creature\b/.test(text);
}

// detectRole files a card under ramp on weak evidence. Real acceleration is a land search, a
// mana ability, or a Treasure that costs no mana. Not real: a one-shot "sacrifice this: add",
// a Treasure maker that costs mana, or a cost reducer.
function isFalseRamp(card) {
  const text = getCardText(card);
  if (/search your library for [^.]*\blands?\b|put [^.]*\bland\b[^.]*onto the battlefield/.test(text)) return false;
  // Reminder text ("(It's an artifact with '{T}, Sacrifice this token: Add ...')") is not the card's own ability.
  const bare = text.replace(/\([^)]*\)/g, " ");
  const lines = bare.split("\n");
  const addLines = lines.filter((line) => /\badd (?:\{|one |two |three |x )/.test(line));
  // Any sacrifice in the cost makes the mana a one-off (Blood Pet, Transmogrant Altar).
  // Mana that only comes when the creature attacks (Brazen Collector) is not dependable ramp either.
  if (addLines.length) return addLines.every((line) => /^[^:]*\bsacrifice\b[^:]*:/.test(line) || /^whenever [^,]*\battacks?\b/.test(line));
  const treasureLines = lines.filter((line) => /create (?:a|one|two|three|x) treasure/.test(line));
  if (treasureLines.length) return treasureLines.every((line) => /^[^:]*\{(?:\d+|[wubrgxsc])\}[^:]*:/.test(line));
  // Mana that appears only in reminder text ("firebending", "until end of combat") is not a mana ability.
  if (/\badd (?:\{|one |two |three |x )/.test(text)) return true;
  return /costs? (?:\{\d+\}|\{[^}]+\}) less/.test(text);
}

function bottomUpRole(card) {
  const base = detectRole(card, true);
  if (base === "wipe" && isEdict(getCardText(card))) return "removal";
  const fallbackRole = (skip) => getRoleContributions(card, true).find((role) => role !== skip) || "synergy";
  if (base !== "removal" && base !== "wipe" && (isUpToExileRemoval(getCardText(card)) || isExtraRemoval(getCardText(card)) || isNarrowCounterSpell(getCardText(card)))) return "removal";
  if (base === "removal" && (isLandRemoval(getCardText(card)) || isFaceDamageOnly(getCardText(card)) || isBlink(getCardText(card)) || isSelfBounce(getCardText(card)))) return fallbackRole("removal");
  // A creature that sweeps through an activated ability (Ashling) is not a one-shot wipe; one that sweeps on entering is.
  if (base === "wipe" && getCardType(card).split("\u2014")[0].includes("creature") && !/\b(?:when|whenever)\b[^.]*\benters\b/.test(getCardText(card))) return fallbackRole("wipe");
  if (base === "ramp" && isFalseRamp(card)) {
    return getRoleContributions(card, true).find((role) => role !== "ramp") || "synergy";
  }
  return base;
}

// "counter target noncreature spell" and "counter target creature spell" are counterspells the shared
// role pattern ("counter target spell") never matches; they answer only part of what a deck faces.
function isNarrowCounterSpell(text) {
  return /\bcounter target (?!spell\b)(?:[a-z-]+ )+?spell\b/.test(text);
}

// Small adjustments that order removal spells of the same kind (two "destroy target" cards tied, and the
// alphabet chose): instant speed and a flexible target are worth a little, an extra cost, a narrow
// target or a gift to the opponent cost a little. They stay under a quarter of a removal kind's weight.
function removalFinesse(card) {
  const text = getCardText(card).replace(/\([^)]*\)/g, " ");
  let fine = 0;
  if (getCardType(card).includes("instant") || /\bflash\b/.test(text)) fine += 0.3;
  if (/\btarget (?:nonland )?permanent\b|creature or planeswalker|creature, planeswalker/.test(text)) fine += 0.3;
  if (/as an additional cost to cast this spell, (?:sacrifice|discard|exile|pay)/.test(text)) fine -= 0.5;
  if (/\btarget (?:artifact|enchantment|tapped|attacking|blocking|legendary|flying|monocolored|multicolored) creature|with (?:power|toughness|mana value) \d+ or (?:less|greater)/.test(text)) fine -= 0.5;
  else if (/\btarget non[a-z]+ creature/.test(text)) fine -= 0.15;
  if (/\bits controller (?:creates|investigates)|\bgift an?\b/.test(text)) fine -= 0.2;
  return fine;
}

function removalKind(card) {
  const text = getCardText(card);
  if (/counter target/.test(text)) {
    if (/unless (?:its controller|that player|they) pays?/.test(text)) return "softcounter";
    return isNarrowCounterSpell(text) ? "narrowcounter" : "counter";
  }
  if (/return (?:target|up to)[^.]*to (?:its|their) owner/.test(text)) return "bounce";
  if (isPermanentAnswer(text)) return "permanent";
  if (/destroy target|exile target/.test(text) && /that was dealt damage/.test(text)) return "conditional";
  if (namesOnlyCreatureTypes(text) && !/\bfights?\b|damage to|\bdeals? (?:\d+|x) damage|gets? -\d+\/-\d+|-x\/-x|sacrifices? an? creature/.test(text)) return "conditional";
  if (/destroy target|exile target|(?:destroy|exile) up to \w+ (?:other |another )?target|put target [^.]*owner's library|sacrifices? an? creature|deals? \d+ damage|damage to target|gets? -\d+\/-\d+|-x\/-x/.test(text)) return "hard";
  return "other";
}

// reliable: a mana ability, a mana rock or a land search. oneshot: a Treasure that arrives once.
function rampKind(card) {
  const text = getCardText(card);
  if (/search your library for [^.]*\blands?\b|put [^.]*\bland\b[^.]*onto the battlefield/.test(text)) return "reliable";
  if (text.split("\n").some((line) => /\badd (?:\{|one |two |three |x )/.test(line.replace(/\([^)]*\)/g, " ")))) return "reliable";
  return "oneshot";
}

// engine: draws again and again. pure: draws and does nothing else. cantrip: a draw riding on
// another effect. filter: a draw paid for with a discard.
function drawKind(card) {
  const text = getCardText(card).replace(/\([^)]*\)/g, " ");
  const lines = text.split("\n");
  if (/discard[^.:]*:[^.]*\bdraw\b|\bdraw\b[^.]*[,.]\s*(?:then |if you do, )discard|discard [^.]*\.\s*if you do, draw\b/.test(text)) return "filter";
  // A trigger may open with an ability word ("ferocious \u2014 whenever ...") and may pay first
  // ("you may pay {1}. if you do, draw a card"), so the draw is looked for anywhere in the line.
  if (lines.some((line) => /^(?:[\w' ]+ \u2014 )?(?:whenever|at the beginning of)\b/.test(line) && /\bdraws? (?:a|an|one|two|three|x|that many|cards?)\b/.test(line)
    || /^\{t\}[^:]*:[^.]*\bdraws? /.test(line))) return "engine";
  if (/\bdraws? (?:two|three|four|x) cards\b/.test(text)) return "pure";
  return "cantrip";
}

// What a card does for a board that a wipe just cleared: tokens (more creatures), boost (bigger ones,
// by an anthem, a lord or a mass pump for the tribe or all your creatures), recursion (a mass return
// from the graveyard). A spot trick, one creature coming back, or a Treasure does not rebuild.
function rebuildKind(card, subtype) {
  const text = getCardText(card);
  if (/\bcreate [^.]*\bcreature tokens?\b/.test(text)) return "tokens";
  const forms = subtype && subtype.kind === "tribal" && subtype.tribe ? tribeFormsPattern(subtype) : "";
  const tribeBoost = forms && new RegExp(`\\b(?:${forms})(?: creatures?)? you control (?:get|have) \\+\\d+`).test(text);
  if (tribeBoost || /(?:^|[\n.,:;] ?|\bother |\ball )creatures you control (?:get|have) \+\d+|each (?:other )?creature you control gets? \+|\+1\/\+1 counter on each (?:other )?creature you control/.test(text)) return "boost";
  if (/\breturn (?:all|each|up to \w+|any number of|two|three|x|that many)[^.]*creature cards?[^.]*from your graveyard to the battlefield/.test(text)) return "recursion";
  return "";
}

// A spell that keeps your whole board through a wipe (not a rebuild: it is the other way to survive one).
function protectsBoard(card) {
  return /\b(?:creatures|permanents) you control (?:gain|have)[^.]*\b(?:indestructible|hexproof|protection from)\b|\beach creature you control gains[^.]*\bindestructible\b/.test(getCardText(card));
}

// The best draw for a subtype: a trigger that names the tribe ("whenever another Zombie enters,
// draw a card") or, in a Zombie deck, one that pays on cards leaving the graveyard.
function drawTrigger(card, subtype) {
  if (!subtype || subtype.kind !== "tribal" || !subtype.tribe) return "";
  const lines = getCardText(card).replace(/\([^)]*\)/g, " ").split("\n");
  const triggers = lines.filter((line) => /^(?:whenever|at the beginning of)\b/.test(line) && /\bdraws? /.test(line));
  const forms = tribeFormsPattern(subtype);
  const named = new RegExp(`\\b(?:${forms})\\b`);
  if (triggers.some((line) => named.test(line.replace(new RegExp(`\\bnon-?(?:${forms})\\b`, "g"), " ")))) return "tribe";
  if (String(subtype.tribe).toLowerCase() === "zombie"
    && triggers.some((line) => /\bleaves? your graveyard\b|\bfrom your graveyard\b/.test(line))) return "graveyard";
  return "";
}

function tribeFormsPattern(subtype) {
  const tribe = String(subtype.tribe || "").toLowerCase();
  const plural = String(subtype.tag || "").toLowerCase();
  if (!tribe) return "";
  return plural && plural !== tribe
    ? `${escapeBottomUpRegex(tribe)}|${escapeBottomUpRegex(plural)}`
    : escapeBottomUpRegex(tribe);
}

// member: a creature of the tribe (or, for a theme, a card the detector tags with it).
// payoff: rewards the tribe. mention: names it without rewarding it ("exile target Zombie").
// detectCardTags is the costliest call in a suggestion run; a card's tags never change.
const bottomUpTagCache = new WeakMap();
function bottomUpTags(card) {
  let tags = bottomUpTagCache.get(card);
  if (!tags) {
    tags = new Set(detectCardTags(card));
    // Local to the bottom-up build (scoring.js is shared): a deathtouch creature is fodder for a poison plan.
    const keywords = (card.raw && card.raw.keywords) || [];
    if (keywords.includes("Deathtouch") || /\bdeathtouch\b/.test(getCardText(card).replace(/\([^)]*\)/g, " "))) tags.add("deathtouch");
    bottomUpTagCache.set(card, tags);
  }
  return tags;
}

// Theme plans read the shared terms (terms.js). planMakeTerms are what a plan's own cards make, found from the pool;
// planTerms adds what the plan is known to feed on (proliferate feeds a poison plan). A plan card that needs a plan term
// and does not make it is a payoff; one that needs and makes it is an amplifier (member with the engine flag).
const THEME_PLAN_TERM_OVERRIDES = { "infect~deathtouch": ["poison counter", "-1/-1 counter", "counter"] };
const THEME_PLAN_TERM_SHARE = 0.4;

function derivePlanTerms(cards, subtype, vocab, supply) {
  const tags = subtype.tag.split("~");
  const members = (cards || []).filter((card) => tags.some((tag) => bottomUpTags(card).has(tag)));
  const found = new Set();
  if (!members.length) return found;
  const counts = new Map();
  for (const card of members) for (const t of getCardTerms(card, vocab).makes) counts.set(t, (counts.get(t) || 0) + 1);
  for (const [t, n] of counts) if (n / members.length >= THEME_PLAN_TERM_SHARE && supply.isCounted(new Set([t]))) found.add(t);
  return found;
}

const planTermCache = new WeakMap();
// A theme plan with the terms attached; a tribal plan, or a theme with no terms, comes back unchanged.
function withPlanTerms(subtype, cards) {
  if (!subtype || subtype.kind === "tribal" || subtype.kind === "roles" || !Array.isArray(cards) || !cards.length) return subtype;
  let byTag = planTermCache.get(cards);
  if (!byTag) { byTag = new Map(); planTermCache.set(cards, byTag); }
  if (!byTag.has(subtype.tag)) {
    const vocab = buildTermVocab(cards);
    const supply = createTermSupply(cards, vocab);
    const planMakeTerms = derivePlanTerms(cards, subtype, vocab, supply);
    const planTerms = new Set([...planMakeTerms, ...(THEME_PLAN_TERM_OVERRIDES[subtype.tag] || [])]);
    byTag.set(subtype.tag, planTerms.size ? { planMakeTerms, planTerms, termVocab: vocab, termSupply: supply } : null);
  }
  const terms = byTag.get(subtype.tag);
  return terms ? { ...subtype, ...terms } : subtype;
}

// The counted need clauses of a card that touch the plan, each with whether the card itself makes a term in it.
function themeNeeds(card, subtype) {
  const supply = subtype.termSupply;
  const out = [];
  for (const clause of getCardTerms(card, subtype.termVocab).clauses) {
    if (![...clause].some((t) => subtype.planTerms.has(t))) continue;
    const makes = cardMakesAny(card, clause, subtype.termVocab);
    out.push({ clause, makes, counted: supply.isCounted(clause) && supply.suppliers(clause) - (makes ? 1 : 0) >= 2 });
  }
  return out;
}

function themeStanding(card, subtype) {
  const tags = subtype.tag.split("~");
  const tagged = tags.some((tag) => bottomUpTags(card).has(tag)) || (tags.includes("vehicles") && isCrewHelper(card));
  if (!subtype.planTerms || !subtype.planTerms.size) return tagged ? "member" : "none";
  const needs = themeNeeds(card, subtype);
  const counted = needs.filter((n) => n.counted);
  if (counted.length) return counted.some((n) => n.makes) ? "member" : "payoff";
  if (tagged || [...subtype.planMakeTerms].some((t) => getCardTerms(card, subtype.termVocab).makes.has(t))) return "member";
  return needs.length ? "mention" : "none";
}

function isThemeEngine(card, subtype) {
  if (!subtype || subtype.kind === "tribal" || !subtype.planTerms || !subtype.planTerms.size) return false;
  return themeNeeds(card, subtype).some((n) => n.counted && n.makes);
}

// A "roles" plan is built on what cards do rather than a tag: { kind: "roles", tag, label, roles: ["outlet", "death", "mill"] }.
// Outlets and mill cards make the events (members); death-trigger cards want them (payoffs). A card that does both is an engine.
function cardEngineRoles(card) {
  const abs = getCardAbilities(card);
  return {
    outlet: abs.some((ab) => (ab.kind === "activated" && ab.cost.includes("sacrifice-other")) || ab.cost.includes("sacrifice-additional") || ab.effects.some((e) => e.label === "sacrifice-choice")),
    death: abs.some((ab) => (ab.trigger || []).includes("dies")),
    mill: abs.some((ab) => ab.effects.some((e) => e.label === "mill-self" || e.label === "mill-other"))
  };
}

function rolesStanding(card, subtype) {
  const r = cardEngineRoles(card);
  const wanted = subtype.roles || [];
  const makes = (wanted.includes("outlet") && r.outlet) || (wanted.includes("mill") && r.mill);
  const wants = wanted.includes("death") && r.death;
  if (makes) return "member";
  return wants ? "payoff" : "none";
}

function isRolesEngine(card, subtype) {
  if (!subtype || subtype.kind !== "roles") return false;
  const r = cardEngineRoles(card);
  return rolesStanding(card, subtype) === "member" && r.death && (subtype.roles || []).includes("death");
}

// A tribal plan may carry a second layer, a roles plan its own members point to (Vampire + sacrifice and death):
// { kind: "tribal", ..., layer: { kind: "roles", roles: ["outlet", "death"] } }. A layer card that is not a tribe
// member or payoff is a payoff (an enabler or a death trigger the tribe's bodies feed), so it counts as a plan card.
function subtypeStanding(card, subtype) {
  const own = ownSubtypeStanding(card, subtype);
  if (subtype && subtype.kind === "tribal" && subtype.layer && own !== "member" && own !== "payoff") {
    if (layerStanding(card, subtype.layer) !== "none") return "payoff";
  }
  return own;
}

// A layer is a roles plan or a theme tag ({ kind: "theme", tag: "spellslinger" }, tags joined with "~").
function layerStanding(card, layer) {
  if (layer.kind === "roles") return rolesStanding(card, layer);
  if (layer.kind === "pair") return pairStanding(card, layer);
  const tags = bottomUpTags(card);
  return layer.tag.split("~").some((tag) => tags.has(tag)) ? "member" : "none";
}

// A "pair" layer is one output matched to one input, read from the card text: { kind: "pair", pair: "blood" }.
// `makes` cards produce the event and `wants` cards run on it. A card that wants it always counts; a maker counts
// only when the pair says makers are plan cards (Blood tokens: yes; lifelink: no, the tribe already has plenty).
const BOTTOM_UP_PAIRS = {
  blood: {
    makes: (t) => /create[^.]*\bblood token/.test(t),
    wants: (t) => /\bblood tokens?\b|sacrifice a blood|\bblood\b[^.]*you control/.test(t) && !/create[^.]*\bblood token/.test(t),
    makersCount: true
  },
  lifegain: {
    makes: (t) => /\blifelink\b|\byou gain \d+ life|gain life equal/.test(t),
    wants: (t) => /whenever you gain life|if you gained life|you gained life this turn|for each (?:1 )?life you gained|life you(?:'ve)? gained/.test(t),
    makersCount: false
  },
  landfall: {
    makes: (t) => !/landfall/.test(t) && /(?:put|onto the battlefield)[^.]*\bland\b|search your library for[^.]*\bland\b[^.]*onto the battlefield|play an additional land|create[^.]*\bland\b/.test(t),
    wants: (t) => /landfall|whenever a land (?:you control )?enters/.test(t),
    makersCount: true
  }
};

function pairText(card) {
  return getCardText(card).replace(/\([^)]*\)/g, " ");
}

// Direction: a pair suits a tribe when the tribe already runs on one side of it. Enough members make the output
// (Vampires make Blood and lifelink) or enough of the tribe's own cards want it (Insects with landfall). Insects
// make no Blood and want none, so a Blood layer is never offered for them.
const PAIR_MAKER_SHARE = 0.25;
const PAIR_OWN_WANTS_MIN = 3;
function pairFitsTribe(tribeCards, layer) {
  if (layer.kind !== "pair") return true;
  const def = BOTTOM_UP_PAIRS[layer.pair];
  if (!def || !tribeCards.length) return false;
  const texts = tribeCards.map(pairText);
  const makers = texts.filter((t) => def.makes(t)).length;
  const wants = texts.filter((t) => def.wants(t)).length;
  return makers / texts.length >= PAIR_MAKER_SHARE || wants >= PAIR_OWN_WANTS_MIN;
}

function pairStanding(card, layer) {
  const def = BOTTOM_UP_PAIRS[layer.pair];
  if (!def) return "none";
  const t = pairText(card);
  if (def.wants(t)) return "payoff";
  return def.makersCount && def.makes(t) ? "member" : "none";
}

// The second layers a tribe can be offered (the Bottom-Up tab's "Second layer" choice). Which tribes suit which layer
// came from reading the pool and what Vampire, Insect and Wizard decks run (see AGENTS.md).
const BOTTOM_UP_LAYERS = [
  { key: "aristocrats", label: "Sacrifice and death triggers", layer: { kind: "roles", roles: ["outlet", "death"] } },
  { key: "mill", label: "Mill, sacrifice and death triggers", layer: { kind: "roles", roles: ["outlet", "death", "mill"] } },
  { key: "spells", label: "Instants and sorceries", layer: { kind: "theme", tag: "spellslinger" } },
  { key: "blood", label: "Blood tokens", layer: { kind: "pair", pair: "blood" } },
  { key: "lifegain", label: "Lifegain payoffs", layer: { kind: "pair", pair: "lifegain" } },
  { key: "landfall", label: "Landfall", layer: { kind: "pair", pair: "landfall" } }
];

function bottomUpLayerKey(layer) {
  return layer ? `${layer.kind}:${layer.tag || layer.pair || (layer.roles || []).join(",")}` : "";
}

function ownSubtypeStanding(card, subtype) {
  if (!subtype) return "none";
  if (subtype.kind === "roles") return rolesStanding(card, subtype);
  // A theme may join tags with "~" (a plan with two parts, as in the theme: mode string).
  if (subtype.kind !== "tribal") return themeStanding(card, subtype);

  const tribe = String(subtype.tribe || "").toLowerCase();
  if (!tribe) return "none";
  if (getCardSubtypes(card).includes(tribe)) return "member";

  const forms = tribeFormsPattern(subtype);
  // "non-Zombie" names the tribe only to leave it out.
  const text = getCardText(card).replace(new RegExp(`\\bnon-?(?:${forms})\\b`, "g"), " ");
  if (!new RegExp(`\\b(?:${forms})\\b`).test(text)) return "none";

  return tribePayoffPattern(forms).test(text) ? "payoff" : "mention";
}

function tribePayoffPattern(forms) {
  return new RegExp(
    // A list of types before "you control" ("skeletons, vampires, and zombies you control get +1/+1") and "Vampire creatures you control".
    `\\b(?:${forms})\\b(?:,? (?:and |or )?\\w+s?){0,3}(?: creatures?)? you control|\\bother (?:${forms})\\b|` +
    // An aura or equipment that favors the tribe, a card that makes something one, a spell that turns a body into one.
    `as long as (?:it's|it is|that creature is) an? (?:${forms})\\b|\\bis an? (?:${forms}) in addition|\\bequip [^.{]*\\b(?:${forms})\\b|\\bbecomes? an? [^.]*?\\b(?:${forms})\\b|` +
    `\\b(?:${forms}) (?:get|gain|have)\\b|` +
    `whenever (?:a|an|one or more) (?:other )?(?:${forms})\\b|create[^.]*\\b(?:${forms})\\b|amass (?:${forms})\\b|` +
    // Conditional wording: "if you control a Wizard", "costs {1} less if you control a Wizard", "for each Wizard you control",
    // "the number of Wizards you control", "Wizard spells you cast".
    `\\b(?:if|as long as|unless) you control (?:an? |another |at least \\w+ )?(?:${forms})\\b|less to cast if you control (?:an? )?(?:${forms})\\b|` +
    `for each (?:${forms}) you control|number of (?:${forms}) you control|\\b(?:${forms}) spells? you cast`
  );
}

// A tribe member whose own text makes or pumps the tribe (a token maker, a lord, a count of the
// tribe). Standing stays "member"; this is the extra the payoff reading used to throw away.
// Reminder text is not an ability, and a token the opponent creates is not yours.
function isTribeEngine(card, subtype) {
  if (!subtype || subtype.kind !== "tribal" || !subtype.tribe) return false;
  const forms = tribeFormsPattern(subtype);
  const text = getCardText(card)
    .replace(/\([^)]*\)/g, " ")
    .replace(new RegExp(`\\bnon-?(?:${forms})\\b`, "g"), " ")
    .replace(/\b(?:that player|an opponent|each opponent|target opponent|defending player) creates?\b[^.]*/g, " ");
  return tribePayoffPattern(forms).test(text);
}

// A removal spell or sweeper that leaves the tribe alone ("except Zombies", "non-Zombie").
function sparesSubtype(card, subtype, role) {
  if (!subtype || subtype.kind !== "tribal" || !subtype.tribe) return false;
  if (role !== "removal" && role !== "wipe") return false;
  const forms = tribeFormsPattern(subtype);
  return new RegExp(
    `\\bnon-?(?:${forms})\\b|\\bexcept (?:for )?(?:\\w+ )?(?:${forms})\\b|` +
    `\\bother than (?:an? )?(?:\\w+ )?(?:${forms})\\b|\\bcreatures? that (?:isn't|aren't) (?:an? )?(?:${forms})\\b`
  ).test(getCardText(card));
}

// A card that crews Vehicles better than its numbers say (Hotshot Mechanic) or makes a Pilot token that
// does (Born to Drive, Back on Track): the plan's enabler, which the vehicle tag alone does not see.
function isCrewHelper(card) {
  return getCardAbilities(card).some((ab) => ab.effects.some((e) => e.label === "crew-helper"));
}

// Role and standing are looked up once per card: suggestions run dozens of builds over one pool.
const bottomUpAnnotations = new WeakMap();

function annotateBottomUpCard(card, subtype) {
  let base = bottomUpAnnotations.get(card);
  if (!base) {
    const role = bottomUpRole(card);
    base = {
      role,
      isCreature: getCardType(card).split("—")[0].includes("creature"),
      removalKind: role === "removal" ? removalKind(card) : "",
      removalFinesse: role === "removal" ? removalFinesse(card) : 0,
      rampKind: role === "ramp" ? rampKind(card) : "",
      drawKind: role === "draw" ? drawKind(card) : "",
      protects: protectsBoard(card),
      crewHelper: isCrewHelper(card),
      keywordScore: keywordScore(card),
      standing: new Map()
    };
    bottomUpAnnotations.set(card, base);
  }
  const key = subtype ? `${subtype.kind}:${subtype.tag}:${subtype.planTerms ? "t" : ""}:${bottomUpLayerKey(subtype.layer)}` : "";
  if (!base.standing.has(key)) {
    base.standing.set(key, {
      standing: subtypeStanding(card, subtype),
      spares: sparesSubtype(card, subtype, base.role),
      engine: subtype && subtype.kind === "roles" ? isRolesEngine(card, subtype) : subtype && subtype.kind !== "tribal" ? isThemeEngine(card, subtype) : isTribeEngine(card, subtype) && getCardSubtypes(card).includes(String(subtype.tribe).toLowerCase()),
      rebuild: rebuildKind(card, subtype),
      drawTrigger: base.role === "draw" ? drawTrigger(card, subtype) : ""
    });
  }
  return { ...base, ...base.standing.get(key) };
}

function archetypeScore(card, ctx) {
  const arch = ARCHETYPES[ctx.archetype];
  const a = annotateBottomUpCard(card, ctx.subtype);
  const cmc = Number(card.cmc) || 0;
  let score = 0;

  if (a.standing === "member") score += BOTTOM_UP_WEIGHT.member;
  // In a theme plan the sources are many and the payoffs few, so a payoff ranks above a source (as an amplifier does) or the sources crowd it out.
  else if (a.standing === "payoff") score += ctx.subtype && ctx.subtype.kind !== "tribal" && ctx.subtype.planTerms ? BOTTOM_UP_WEIGHT.member + BOTTOM_UP_WEIGHT.engine : BOTTOM_UP_WEIGHT.payoff;
  else if (a.standing === "mention") score += BOTTOM_UP_WEIGHT.mention;
  // A vehicle plan wants powerful creatures: crew N needs power N, and one 3-power body crews most vehicles.
  if (a.isCreature && ctx.subtype && ctx.subtype.kind !== "tribal" && ctx.subtype.tag.split("~").includes("vehicles")) {
    const power = getCrewPower(card);
    if (power > 0) score += Math.min(power, 4) * BOTTOM_UP_WEIGHT.crewPower;
  }
  // An easy-to-crew vehicle ranks ahead (as engines.js scores a payload Vehicle), crew 1 most.
  if (!a.isCreature && a.standing === "member" && ctx.subtype && ctx.subtype.kind !== "tribal" && ctx.subtype.tag.split("~").includes("vehicles")) {
    const crew = (getCardText(card).match(/\bcrew (\d+)/) || [])[1];
    if (crew) score += Math.max(0, 4 - Number(crew)) * BOTTOM_UP_WEIGHT.crewEase;
  }
  // A plan of two tags ("infect~deathtouch") ranks cards of the first, the plan's own, ahead of fodder.
  if (a.standing === "member" && ctx.subtype && ctx.subtype.kind !== "tribal" && ctx.subtype.tag.includes("~") &&
    bottomUpTags(card).has(ctx.subtype.tag.split("~")[0])) score += BOTTOM_UP_WEIGHT.primaryTag;

  if (a.role !== "synergy" && a.role !== "land") score += BOTTOM_UP_WEIGHT.roleBase;
  if (a.spares) score += BOTTOM_UP_WEIGHT.spares;
  if (a.engine) score += BOTTOM_UP_WEIGHT.engine;
  if (a.role === "removal") score += REMOVAL_QUALITY[a.removalKind] * arch.removalQuality;
  if (a.role === "removal" && (a.removalKind === "hard" || a.removalKind === "permanent")) score += a.removalFinesse;
  if (a.role === "ramp" && a.rampKind === "reliable") score += BOTTOM_UP_WEIGHT.rampReliable;
  if (a.role === "draw") score += DRAW_QUALITY[a.drawKind] * BOTTOM_UP_WEIGHT.drawQuality;
  if (a.drawTrigger) score += BOTTOM_UP_WEIGHT.drawTrigger;

  if (a.role === "wipe" && !a.spares) {
    if (ctx.subtype && ctx.subtype.kind === "tribal") score += BOTTOM_UP_WEIGHT.symmetricWipeTribal;
    if (ctx.archetype === "aggro") score += BOTTOM_UP_WEIGHT.symmetricWipeAggro;
  }

  if (a.isCreature) score += Math.max(0, 4 - cmc) * arch.cheapCreatures;
  // Body quality orders the deck's own creatures. A creature that is only here for its support role
  // (a flying card-drawer) would otherwise outrank the spells competing for the same slot.
  if (a.isCreature && a.standing !== "none") score += a.keywordScore * arch.keywordFactor;
  if (ctx.archetype === "control" && (a.role === "draw" || a.role === "wipe")) score += 1;

  // Distance from the archetype's target, not a plain cost penalty: control reaches for 3s over 1s.
  return score - Math.abs(cmc - arch.avgCmc) * BOTTOM_UP_WEIGHT.curve;
}
