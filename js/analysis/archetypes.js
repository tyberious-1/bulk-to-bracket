
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

const REMOVAL_QUALITY = { hard: 3, counter: 2, softcounter: 1.5, bounce: 1, conditional: 1, other: 0 };

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

// "destroy target land" (Polluted Dead, Stone Rain) is land destruction, not creature removal.
function isLandRemoval(text) {
  return /\b(?:destroy|exile) target [^.]*\bland\b/.test(text)
    && !/\btarget (?:\w+ )?(?:creature|permanent|planeswalker|artifact|enchantment)\b/.test(text);
}

// detectRole files a card under ramp on weak evidence. Real acceleration is a land search, a
// mana ability, or a Treasure that costs no mana. Not real: a one-shot "sacrifice this: add",
// a Treasure maker that costs mana, or a cost reducer.
function isFalseRamp(card) {
  const text = getCardText(card);
  if (/search your library for [^.]*\bland\b|put [^.]*\bland\b[^.]*onto the battlefield/.test(text)) return false;
  const lines = text.split("\n");
  const addLines = lines.filter((line) => /\badd (?:\{|one |two |three |x )/.test(line));
  // Any sacrifice in the cost makes the mana a one-off (Blood Pet, Transmogrant Altar).
  if (addLines.length) {
    if (addLines.every((line) => /^[^:]*\bsacrifice\b[^:]*:/.test(line))) return true;
    // Mana that only appears inside reminder text ("firebending", "until end of combat") is not a mana ability.
    const withoutReminders = text.replace(/\([^)]*\)/g, " ");
    if (!/\badd (?:\{|one |two |three |x )/.test(withoutReminders)) return true;
    return false;
  }
  const treasureLines = lines.filter((line) => /create (?:a|one|two|three|x) treasure/.test(line));
  if (treasureLines.length) return treasureLines.every((line) => /^[^:]*\{(?:\d+|[wubrgxsc])\}[^:]*:/.test(line));
  return /costs? (?:\{\d+\}|\{[^}]+\}) less/.test(text);
}

function bottomUpRole(card) {
  const base = detectRole(card, true);
  if (base === "wipe" && isEdict(getCardText(card))) return "removal";
  if (base === "removal" && isLandRemoval(getCardText(card))) {
    return getRoleContributions(card, true).find((role) => role !== "removal") || "synergy";
  }
  if (base === "ramp" && isFalseRamp(card)) {
    return getRoleContributions(card, true).find((role) => role !== "ramp") || "synergy";
  }
  return base;
}

function removalKind(card) {
  const text = getCardText(card);
  if (/counter target/.test(text)) return /unless (?:its controller|that player|they) pays?/.test(text) ? "softcounter" : "counter";
  if (/return (?:target|up to)[^.]*to (?:its|their) owner/.test(text)) return "bounce";
  if (/destroy target|exile target/.test(text) && /that was dealt damage/.test(text)) return "conditional";
  if (/destroy target|exile target|sacrifices? an? creature|deals? \d+ damage|damage to target|gets? -\d+\/-\d+|-x\/-x/.test(text)) return "hard";
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
      standing: new Map()
    };
    bottomUpAnnotations.set(card, base);
  }
  const key = subtype ? `${subtype.kind}:${subtype.tag}` : "";
  if (!base.standing.has(key)) {
    base.standing.set(key, {
      standing: subtypeStanding(card, subtype),
      spares: sparesSubtype(card, subtype, base.role),
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
