
// Bottom-up builds: what an archetype asks of a deck, and how one card reads for a subtype.
//
// detectRole/getRoleContributions (scoring.js) are shared with the commander-first builder, so
// their mistakes are corrected here (bottomUpRole) and not in scoring.js, where a change would
// move all 56 baseline builds.
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
    avgCmc: 2.2, cheapCreatures: 0.8, haste: 1.5, removalQuality: 0.4
  },
  midrange: {
    label: "Midrange",
    slots: { creature: 24, ramp: 9, draw: 8, removal: 8, wipe: 2 },
    avgCmc: 2.5, cheapCreatures: 0, haste: 0, removalQuality: 0.5
  },
  control: {
    label: "Control",
    slots: { creature: 14, ramp: 8, draw: 11, removal: 11, wipe: 4 },
    avgCmc: 2.7, cheapCreatures: 0, haste: 0, removalQuality: 0.8
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

const REMOVAL_QUALITY = { hard: 3, permanent: 3, counter: 2, softcounter: 1.5, bounce: 1, conditional: 1, other: 0 };

// Counterspells reserved inside the removal slots, as [blue with other colors, mono-blue].
// Control leans on them most; aggro does not run them.
const COUNTER_FLOOR = { aggro: [0, 0], midrange: [3, 5], control: [5, 7] };
function counterFloor(archetype, colors, nonlandSlots) {
  if (!(colors || []).includes("U") || !COUNTER_FLOOR[archetype]) return 0;
  const base = COUNTER_FLOOR[archetype][colors.length === 1 ? 1 : 0];
  const scaled = scaleSlots({ floor: base, removal: ARCHETYPES[archetype].slots.removal }, nonlandSlots || BOTTOM_UP_NONLAND_SLOTS);
  return Math.min(scaled.floor, scaled.removal);
}
function isCounterKind(kind) { return kind === "counter" || kind === "softcounter"; }

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
  member: 6, payoff: 5, mention: 2, spares: 4,
  symmetricWipeTribal: -3, symmetricWipeAggro: -4,
  roleBase: 1, curve: 0.35,
  rampReliable: 1.5, drawQuality: 2, drawTrigger: 4
};

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
  if (base !== "removal" && base !== "wipe" && (isUpToExileRemoval(getCardText(card)) || isExtraRemoval(getCardText(card)))) return "removal";
  if (base === "removal" && (isLandRemoval(getCardText(card)) || isFaceDamageOnly(getCardText(card)) || isBlink(getCardText(card)) || isSelfBounce(getCardText(card)))) return fallbackRole("removal");
  // A creature that sweeps through an activated ability (Ashling) is not a one-shot wipe; one that sweeps on entering is.
  if (base === "wipe" && getCardType(card).split("\u2014")[0].includes("creature") && !/\b(?:when|whenever)\b[^.]*\benters\b/.test(getCardText(card))) return fallbackRole("wipe");
  if (base === "ramp" && isFalseRamp(card)) {
    return getRoleContributions(card, true).find((role) => role !== "ramp") || "synergy";
  }
  return base;
}

function removalKind(card) {
  const text = getCardText(card);
  if (/counter target/.test(text)) return /unless (?:its controller|that player|they) pays?/.test(text) ? "softcounter" : "counter";
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
  if (!tags) { tags = new Set(detectCardTags(card)); bottomUpTagCache.set(card, tags); }
  return tags;
}

function subtypeStanding(card, subtype) {
  if (!subtype) return "none";
  if (subtype.kind !== "tribal") return bottomUpTags(card).has(subtype.tag) ? "member" : "none";

  const tribe = String(subtype.tribe || "").toLowerCase();
  if (!tribe) return "none";
  if (getCardSubtypes(card).includes(tribe)) return "member";

  const forms = tribeFormsPattern(subtype);
  // "non-Zombie" names the tribe only to leave it out.
  const text = getCardText(card).replace(new RegExp(`\\bnon-?(?:${forms})\\b`, "g"), " ");
  if (!new RegExp(`\\b(?:${forms})\\b`).test(text)) return "none";

  const payoff = new RegExp(
    `\\b(?:${forms}) you control|\\bother (?:${forms})\\b|\\b(?:${forms}) (?:get|gain|have)\\b|` +
    `whenever (?:a|an|one or more) (?:other )?(?:${forms})\\b|create[^.]*\\b(?:${forms})\\b|amass (?:${forms})\\b`
  );
  return payoff.test(text) ? "payoff" : "mention";
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
      rampKind: role === "ramp" ? rampKind(card) : "",
      drawKind: role === "draw" ? drawKind(card) : "",
      haste: /\bhaste\b/.test(getCardText(card)),
      protects: protectsBoard(card),
      standing: new Map()
    };
    bottomUpAnnotations.set(card, base);
  }
  const key = subtype ? `${subtype.kind}:${subtype.tag}` : "";
  if (!base.standing.has(key)) {
    base.standing.set(key, {
      standing: subtypeStanding(card, subtype),
      spares: sparesSubtype(card, subtype, base.role),
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
  else if (a.standing === "payoff") score += BOTTOM_UP_WEIGHT.payoff;
  else if (a.standing === "mention") score += BOTTOM_UP_WEIGHT.mention;

  if (a.role !== "synergy" && a.role !== "land") score += BOTTOM_UP_WEIGHT.roleBase;
  if (a.spares) score += BOTTOM_UP_WEIGHT.spares;
  if (a.role === "removal") score += REMOVAL_QUALITY[a.removalKind] * arch.removalQuality;
  if (a.role === "ramp" && a.rampKind === "reliable") score += BOTTOM_UP_WEIGHT.rampReliable;
  if (a.role === "draw") score += DRAW_QUALITY[a.drawKind] * BOTTOM_UP_WEIGHT.drawQuality;
  if (a.drawTrigger) score += BOTTOM_UP_WEIGHT.drawTrigger;

  if (a.role === "wipe" && !a.spares) {
    if (ctx.subtype && ctx.subtype.kind === "tribal") score += BOTTOM_UP_WEIGHT.symmetricWipeTribal;
    if (ctx.archetype === "aggro") score += BOTTOM_UP_WEIGHT.symmetricWipeAggro;
  }

  if (a.isCreature) score += Math.max(0, 4 - cmc) * arch.cheapCreatures;
  if (a.haste) score += arch.haste;
  if (ctx.archetype === "control" && (a.role === "draw" || a.role === "wipe")) score += 1;

  // Distance from the archetype's target, not a plain cost penalty: control reaches for 3s over 1s.
  return score - Math.abs(cmc - arch.avgCmc) * BOTTOM_UP_WEIGHT.curve;
}
