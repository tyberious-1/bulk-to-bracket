// Card classification and scoring.
//
// detectRole / detectCardTags read oracle text to decide what a card *does*;
// scoreCard and scoreFallbackCard turn that plus commander themes, EDHREC
// synergy and the active mode preferences into a single sortable number.
//
// Depends on: cards.js, constants.js, edhrec.js, text.js, themes.js

// Weights for the two EDHREC signals in scoreCard, sized against the theme/tag
// term, which spans roughly 25 points. Inclusion rate is the broad "do decks
// for this commander play this" measure; synergy is narrower but sharper, and
// tops out near 0.5 on a theme page against 0.3 on a commander page.
const EDHREC_CARD_INCLUSION_WEIGHT = 18;
const EDHREC_CARD_SYNERGY_WEIGHT = 12;

function isCreatureCard(card) {
  return getCardType(card).includes("creature");
}

function hasTribalType(card, tribe) {
  const pattern = new RegExp(`\\b${tribe}\\b`);
  return pattern.test(`${getCardType(card)} ${getCardText(card)}`);
}

function isTokenMaker(card) {
  return getCardText(card).includes("create") && getCardText(card).includes("token");
}

function isSacrificeCard(card) {
  return getCardText(card).includes("sacrifice");
}

function isSynergisticMonoColorLand(card, commanderColors, profile) {
  const name = normalizeCardName(card.name);
  const text = getCardText(card);

  if (commanderColors.length !== 1) return true;

  if (name === "path of ancestry" && profile.wantsTribal) return true;
  if (name === "secluded courtyard" && profile.wantsTribal) return true;
  if (name === "unclaimed territory" && profile.wantsTribal) return true;
  if (name === "dwarven mine" && commanderColors[0] === "R") return true;
  if (name === "mines of moria" && profile.wantsTokens) return true;
  if (text.includes("create") && text.includes("token")) return true;
  if (text.includes("sacrifice") || text.includes("whenever a creature dies")) return true;

  return false;
}

function isLowPriorityMonoColorFixer(card, commanderColors) {
  if (commanderColors.length !== 1) return false;

  const name = normalizeCardName(card.name);
  const lowPriorityNames = new Set([
    "command tower",
    "exotic orchard",
    "rupture spire",
    "gateway plaza",
    "transguild promenade",
    "unclaimed territory",
    "secluded courtyard",
    "path of ancestry",
    "thriving bluff",
    "public thoroughfare",
    "vibrant cityscape",
    "tendo ice bridge",
    "uncharted haven",
    "command bridge",
    "crossroads village",
    "capital city",
    "gallifrey council chamber",
    "opal palace",
    "corrupted crossroads",
    "cascading cataracts",
    "secluded starforge"
  ]);

  return lowPriorityNames.has(name);
}

function isLowPriorityMonoColorRock(card, commanderColors, profile) {
  if (commanderColors.length !== 1) return false;
  if (!getCardType(card).includes("artifact")) return false;

  const name = normalizeCardName(card.name);
  if (name === "arcane signet") return true;
  if (name === "commander's sphere") return true;
  if (name === "heraldic banner") return false;
  if (name === "sol ring") return false;
  if (name === "mind stone") return false;
  if (name === "skullclamp") return false;
  if (name === "idol of oblivion" && profile.wantsTokens) return false;

  return false;
}

function isGenericStaple(card) {
  const staples = new Set([
    "sol ring",
    "arcane signet",
    "command tower",
    "swiftfoot boots",
    "skullclamp",
    "swords to plowshares",
    "path to exile",
    "cyclonic rift",
    "rhystic study",
    "smothering tithe",
    "demonic tutor",
    "vampiric tutor",
    "teferi's protection"
  ]);
  return staples.has(normalizeCardName(card.name));
}

// The oracle text that marks a card as doing one of the four support jobs.
// Shared by detectRole and getRoleContributions so the two can never disagree
// about what counts as ramp.
const ROLE_TEXT_PATTERNS = {
  // "Add {" catches mana rocks/dorks and the land-search trigger below catches
  // fetch effects, and neither matches an extra-land-drop effect -- Exploration,
  // Azusa's Many Journeys, Ghirapur Orrery -- which ramps by a different
  // mechanism (more lands per turn, not more mana per land). None of this
  // collection's 6 owned extra-land-drop cards were reaching any pattern here;
  // two (Ghirapur Orrery, Beanstalk Wurm) got no role at all.
  //
  // "search your library for" is a trigger phrase here, not a literal match on
  // its own -- cardMatchesRole narrows it with searchesLibraryForLand below.
  // The old literal pattern was "search your library for a land", which only
  // matches that exact untyped wording. Nearly every real land tutor is typed
  // differently: "for a basic land card", "for a basic Forest card", "for a
  // Mountain card" (a cycling reminder). Enumerating every basic-type
  // combination as flat substrings isn't tenable -- six types times
  // basic/untyped times singular/plural -- so this collection's 127 owned land
  // tutors were caught 3 different ways and missed the other 124, Cultivate and
  // Rampant Growth included.
  // "less to cast" is a trigger for cost reduction ("Spells you cast cost {1}
  // less to cast", "This spell costs {2} less to cast if..."), and covers every
  // magnitude with one substring rather than enumerating {1} through {5} --
  // MTG's templating always ends the clause with that exact phrase regardless
  // of the number. "convoke" and "affinity for" are their own fixed reminder
  // text, no magnitude to worry about. All three accelerate the game plan the
  // same way a mana rock does; they were previously invisible to ramp
  // entirely. 113 owned cards carry one of the three.
  ramp: [
    "add {", "create a treasure", "create treasure", "search your library for",
    "play an additional land", "play two additional lands",
    "less to cast", "convoke", "affinity for"
  ],
  draw: ["draw a card", "draw two cards", "draw three cards", "whenever you draw"],
  // Green rarely gets "destroy target creature" and answers a board almost
  // entirely through fight and power-damage effects instead -- across this
  // collection's 48 owned mono-green fight/power-damage cards, exactly none
  // were reaching any of these four patterns. Every fight/power-damage removal
  // slot in every green deck was falling through to no role at all, which the
  // support-package phase reads as "the collection owns 8 fewer removal cards
  // than it does," pushing generic backfill in to make up a gap that wasn't
  // really there.
  //
  // Both the "fights"/"fight" verb forms are needed: MTG templates them
  // differently depending on the sentence's grammatical subject ("it fights
  // target creature" vs. "you may have it fight target creature"). "fight
  // each other" covers the "choose target creature you control and target
  // creature you don't control ... fight each other" template, which refers
  // back to two already-named creatures rather than repeating "target".
  // "damage to target creature" catches fixed-amount burn removal the same
  // way "damage equal to its power to" above catches fight-adjacent burn --
  // one substring covers every magnitude ("deals 2 damage...", "deals 5
  // damage...") since the amount sits before the phrase, not inside it.
  // "target opponent/player sacrifices" is the edict this file's own comment
  // on the wipe list below already says is removal, not a wipe -- it just was
  // never added. "return target creature to its owner's hand" is bounce,
  // template-fixed the same way. None of the three have a numeral to worry
  // about; "gets -" does (see hasLethalStatDrop below).
  removal: [
    "destroy target", "exile target", "counter target spell", "return target permanent",
    "fights target creature", "fight target creature",
    "fights up to one target creature", "fight up to one target creature",
    "fights another target creature", "fight another target creature",
    "fight each other",
    "damage equal to its power to",
    "damage to target creature",
    "target opponent sacrifices", "target player sacrifices",
    "return target creature to its owner's hand",
    "gets -"
  ],
  // Sweepers are written a dozen ways and this list used to know three of them,
  // one of which ("each creature gets") matches no card ever printed -- the
  // wording is "all creatures get -X/-X". Across 6,056 owned nonland cards the
  // old list found 10 while missing 67, including every damage-based sweeper:
  // Savage Twister, Storm's Wrath, Gale Force, Needle Storm.
  //
  // Kept deliberately literal rather than reaching for "destroy all", which
  // also catches "destroy all Equipment attached to that creature" and "destroy
  // all Auras attached to target land". Single-target edicts are left out for
  // the same reason -- "target opponent sacrifices a creature" is removal, not
  // a wipe -- while "each player" and "each opponent" forms are counted, since
  // at a four-player table they clear three bodies.
  wipe: [
    "destroy all creatures",
    "destroy all other creatures",
    "destroy all non",
    "destroy all permanents",
    "exile all creatures",
    "all creatures get -",
    "damage to each creature",
    "each player sacrifices",
    "each opponent sacrifices"
  ]
};

const SUPPORT_ROLES = ["ramp", "draw", "removal", "wipe"];

// A sweeper pattern can be narrowed by the words that follow it, and the
// widened wipe list above matches on the prefix alone. "Deals 4 damage to each
// creature with flying" is an anti-flier card, not a board wipe.
//
// This is not a rare edge. Green has almost no real sweepers, so the false
// positives were the *only* wipes it had: all six cards this collection offered
// a mono-green deck -- Needle Storm, Silklash Spider, Gale Force, Canopy Surge,
// Howling Gale, Clip Wings -- clear nothing but fliers. The support phase runs
// before anything else and has a wipe target to hit, so every green build spent
// two or three slots on the same handful of them. Silklash Spider turned up in
// 11 of 12 green decks and Needle Storm in 10, every one a generic backfill.
//
// One-sided sweepers stay sweepers on purpose: "each creature your opponents
// control" clears three boards at a four-player table, which is the job.
const WIPE_EVASION_QUALIFIER = /\b(?:with|without)\s+(?:flying|reach|defender|shadow|horsemanship|protection)\b/;

// True when every occurrence of the pattern is narrowed to a slice of the board
// rather than the whole of it. Bounded to the sentence the match sits in, so a
// later clause like "Creatures with flying can't block" cannot disqualify a
// genuine sweeper.
function wipeMatchIsNarrowed(text, pattern) {
  let from = 0;

  for (;;) {
    const at = text.indexOf(pattern, from);
    if (at === -1) return true;

    const sentence = text.slice(at + pattern.length).split(".")[0];
    if (!WIPE_EVASION_QUALIFIER.test(sentence)) return false;

    from = at + pattern.length;
  }
}

// "search your library for" alone would also match a creature tutor, an
// artifact tutor, any tutor at all -- it only counts as ramp if the same
// sentence names something land-shaped. Inverted from wipeMatchIsNarrowed:
// that one disqualifies a match unless every occurrence is narrowed; this one
// counts the card as soon as one occurrence is broadened by a nearby land
// word, since a card with several search modes only needs one of them to
// fetch land. Checked against every owned card that searches the library for
// anything (180 total): 127 of 127 real land tutors caught, 0 of 53 true
// non-land tutors (creature/artifact/etc. searches) false-matched.
const LAND_SEARCH_KEYWORD = /\b(?:basic|lands?|forest|plains|island|swamp|mountain|wastes)\b/;

function searchesLibraryForLand(text, pattern) {
  let from = 0;

  for (;;) {
    const at = text.indexOf(pattern, from);
    if (at === -1) return false;

    const periodAt = text.indexOf(".", at);
    const sentence = text.slice(at, periodAt === -1 ? text.length : periodAt + 1);
    if (LAND_SEARCH_KEYWORD.test(sentence)) return true;

    from = at + pattern.length;
  }
}

// A -X/-X effect below this magnitude is a combat trick -- it shrinks a
// blocker, it doesn't kill one -- while at or above it, it's lethal to nearly
// anything played in Commander. The threshold is a judgment call, not a rules
// number: picked so Grasp of Darkness and Lash of the Whip (-4/-4) count while
// Rookie Mistake (-2/-0) and Waker of Waves (a static -1/-0) don't. It also
// sits on a real gap in this collection's numbers: 47 cards read -1/-1, 30
// read -2/-2, 8 read -3/-3, then only 9 read -4/-4 -- the population thins out
// exactly where "kills most things" starts being true, rather than splitting a
// dense curve in the middle.
const LETHAL_STAT_DROP_MINIMUM = 4;

function hasLethalStatDrop(text) {
  const match = text.match(/gets? -(\d+)\/-\1\b/);
  return Boolean(match) && Number(match[1]) >= LETHAL_STAT_DROP_MINIMUM;
}

function cardMatchesRole(card, role) {
  const text = getCardText(card);

  return (ROLE_TEXT_PATTERNS[role] || []).some((pattern) => {
    if (role === "ramp" && pattern === "search your library for") {
      return searchesLibraryForLand(text, pattern);
    }
    if (role === "removal" && pattern === "gets -") {
      return hasLethalStatDrop(text);
    }
    if (!text.includes(pattern)) return false;
    if (role === "wipe" && wipeMatchIsNarrowed(text, pattern)) return false;
    return true;
  });
}

// One role per card, first match winning, which is what the builder's role
// targets and the curve planner are written against.
function detectRole(card) {
  if (getCardType(card).includes("land")) return "land";

  for (const role of SUPPORT_ROLES) {
    if (cardMatchesRole(card, role)) return role;
  }

  return "synergy";
}

// Every job a card does, rather than the first one detectRole stops at. A
// removal spell that also draws is both, and a board wipe that draws is
// reported as a wipe here where detectRole would only ever call it draw.
function getRoleContributions(card) {
  if (getCardType(card).includes("land")) return [];
  return SUPPORT_ROLES.filter((role) => cardMatchesRole(card, role));
}

function detectCardTags(card) {
  const tags = [];
  const text = getCardText(card);
  const type = getCardType(card);
  const combined = `${type} ${text}`;

  if (text.includes("graveyard")) tags.push("graveyard");
  if (text.includes("token")) {
    tags.push("tokens");
    tags.push("gowide");
  }
  if (type.includes("artifact")) tags.push("artifacts");
  if (type.includes("enchantment")) tags.push("enchantments");
  if (text.includes("landfall") || text.includes("search your library for a land")) tags.push("lands");
  if (type.includes("instant") || type.includes("sorcery")) tags.push("spellslinger");
  if (text.includes("sacrifice")) tags.push("sacrifice");

  if (text.includes("+1/+1 counter") || text.includes("put a counter on") || text.includes("put counters on")) {
    tags.push("counters");
    tags.push("countersmatter");
  }

  if (text.includes("gain life") || text.includes("life total")) tags.push("lifegain");
  if (text.includes("return target creature card from your graveyard")) tags.push("reanimator");

  if (
    text.includes("each player draws") ||
    text.includes("each opponent draws") ||
    text.includes("target opponent draws") ||
    text.includes("an opponent draws")
  ) {
    tags.push("group hug");
    tags.push("opponent draw");
  }

  if (
    text.includes("draw a card") &&
    (type.includes("instant") || type.includes("sorcery")) &&
    card.cmc <= 2
  ) {
    tags.push("cantrips");
  }

  if (
    text.includes("each player discards") ||
    text.includes("then draws") ||
    text.includes("discard their hand")
  ) {
    tags.push("wheels");
  }

  if (
    text.includes("exile another target") ||
    text.includes("return it to the battlefield")
  ) {
    tags.push("blink");
  }

  // Themes below here exist in EDHREC's vocabulary but had no detector, so
  // focusing on them used to match nothing and left the deck unchanged.

  if (
    type.includes("equipment") ||
    type.includes("aura") ||
    text.includes("equipped creature") ||
    text.includes("enchanted creature") ||
    text.includes("attach")
  ) {
    tags.push("voltron");
  }

  if (
    text.includes("can't be blocked") ||
    text.includes("cannot be blocked") ||
    text.includes("unblockable")
  ) {
    tags.push("unblockable");
  }

  if (text.includes("infect") || text.includes("toxic") || text.includes("poison counter")) {
    tags.push("infect");
  }

  if (text.includes("ninjutsu")) tags.push("ninjutsu");

  // Taking someone else's permanent, whether it stays taken or not.
  if (
    text.includes("gain control of") ||
    text.includes("gains control of") ||
    text.includes("exile target creature an opponent controls") ||
    text.includes("you may cast it") ||
    text.includes("from an opponent's")
  ) {
    tags.push("theft");
  }

  if (
    text.includes("counter target spell") ||
    text.includes("counter that spell") ||
    text.includes("counter target activated")
  ) {
    tags.push("control");
  }

  if (
    text.includes("copy target instant") ||
    text.includes("copy target sorcery") ||
    text.includes("copy that spell") ||
    text.includes("when you cast your second spell")
  ) {
    tags.push("spell copy");
  }

  // Broader than "cantrips", which only counts cheap instants and sorceries.
  if (text.includes("draw a card") || text.includes("draw two cards") || text.includes("draw three cards")) {
    tags.push("card draw");
  }

  if (
    text.includes("spells cost") && text.includes("more to cast") ||
    text.includes("can't attack") ||
    text.includes("players can't") ||
    text.includes("each opponent can't")
  ) {
    tags.push("hatebears");
  }

  for (const tribalType of TRIBAL_TYPES) {
    const pattern = new RegExp(`\\b${tribalType}\\b`);
    if (pattern.test(combined)) tags.push(`${tribalType} tribal`);
  }

  return tags;
}

function getThemeFocusAdjustment(card, tags, modePrefs) {
  if (!modePrefs.themeFocus) return 0;

  const focusAliases = new Set((modePrefs.themeFocusAliases || []).map((alias) => normalizeThemeName(alias)));
  const normalizedTags = tags.map((tag) => normalizeThemeName(tag));
  const matchedFocusedTag = normalizedTags.some((tag) => focusAliases.has(tag));
  let adjustment = matchedFocusedTag ? 18 : -5;

  if (modePrefs.focusedThemeSignal === "artifacts" && getCardType(card).includes("artifact")) adjustment += 8;
  if (modePrefs.focusedThemeSignal === "enchantments" && getCardType(card).includes("enchantment")) adjustment += 8;
  if (["spellslinger", "cantrips"].includes(modePrefs.focusedThemeSignal) && (getCardType(card).includes("instant") || getCardType(card).includes("sorcery"))) adjustment += 9;
  if (["tokens", "gowide"].includes(modePrefs.focusedThemeSignal) && (isTokenMaker(card) || isCreatureCard(card))) adjustment += 9;
  if (["sacrifice", "aristocrats"].includes(modePrefs.focusedThemeSignal) && isSacrificeCard(card)) adjustment += 8;
  if (["counters", "countersmatter"].includes(modePrefs.focusedThemeSignal) && normalizedTags.includes("counters")) adjustment += 8;
  if (["graveyard", "reanimator"].includes(modePrefs.focusedThemeSignal) && (normalizedTags.includes("graveyard") || normalizedTags.includes("reanimator"))) adjustment += 9;

  for (const tribe of modePrefs.focusedTribalTypes || []) {
    if (hasTribalType(card, tribe)) adjustment += 12;
  }

  return adjustment;
}

function edhrecLabelMatchesTheme(label, modePrefs) {
  if (!modePrefs.themeFocus) return true;
  const normalizedLabel = normalizeThemeName(label);
  return (modePrefs.themeFocusAliases || []).some((alias) => normalizedLabel.includes(alias));
}

function getEdhrecReferenceBonus(edhrecCard, modePrefs) {
  if (!edhrecCard) return 0;
  const labels = Array.isArray(edhrecCard.labels) && edhrecCard.labels.length
    ? edhrecCard.labels
    : [edhrecCard.label || ""];
  const normalizedLabels = labels.map((label) => normalizeThemeName(label)).filter(Boolean);
  if (!normalizedLabels.length) return 0;

  let themeMatch = false;
  let averageDeckSection = false;

  for (const label of normalizedLabels) {
    if (!themeMatch && edhrecLabelMatchesTheme(label, modePrefs)) themeMatch = true;

    if (label.includes("average deck") || label.includes("average decks")) {
      averageDeckSection = true;
    }
  }

  let bonus = 0;
  if (modePrefs.themeFocus) bonus += themeMatch ? 12 : -10;
  if (averageDeckSection) bonus += 6;

  return bonus;
}

function cardMatchesThemeFocus(card, modePrefs) {
  if (!modePrefs.themeFocus) return true;

  const tags = detectCardTags(card).map((tag) => normalizeThemeName(tag));
  const aliases = new Set((modePrefs.themeFocusAliases || []).map((alias) => normalizeThemeName(alias)));
  if (tags.some((tag) => aliases.has(tag))) return true;

  for (const tribe of modePrefs.focusedTribalTypes || []) {
    if (hasTribalType(card, tribe)) return true;
  }

  return false;
}

// Which of these themes could actually steer this collection. Mirrors the
// alias/tribal matching cardMatchesThemeFocus does, over the whole pool rather
// than one card, so the UI can mark a theme unavailable instead of offering a
// button that quietly rebuilds the same deck.
//
// Scores every theme in one pass: detectCardTags is the expensive part, and
// checking themes one at a time re-derived the tags for each of them.
function getSupportedThemes(themes, allOwnedCardData) {
  const list = Array.from(new Set((themes || []).filter(Boolean)));
  // No collection to judge against yet -- assume usable rather than grey
  // everything out.
  if (!allOwnedCardData) return new Set(list);

  const specs = list.map((theme) => ({
    theme,
    aliases: new Set(getThemeAliases(theme).map((alias) => normalizeThemeName(alias))),
    tribes: getCommanderTribalThemes([theme]).map((t) => t.replace(" tribal", ""))
  }));

  const supported = new Set();

  for (const card of allOwnedCardData.values()) {
    if (supported.size === specs.length) break;
    if (!card) continue;

    const tags = detectCardTags(card).map((tag) => normalizeThemeName(tag));

    for (const spec of specs) {
      if (supported.has(spec.theme)) continue;
      if (tags.some((tag) => spec.aliases.has(tag))) {
        supported.add(spec.theme);
        continue;
      }
      if (spec.tribes.some((tribe) => hasTribalType(card, tribe))) supported.add(spec.theme);
    }
  }

  return supported;
}

function classifyBackfillModeFit(card, modePrefs) {
  const themeMatch = cardMatchesThemeFocus(card, modePrefs);
  const role = detectRole(card);
  const supportRole = ["ramp", "draw", "removal", "wipe"].includes(role);

  const strict = themeMatch;
  const relaxed = supportRole;
  return {
    strict,
    relaxed,
    tier: strict ? 0 : relaxed ? 1 : 2
  };
}

function scoreCard(card, edhrecCard, commanderThemes, strategyProfile, commanderColors, modePrefs) {
  // Both EDHREC terms used to contribute almost nothing. decks/1200 spanned a
  // third of a point for a commander with a few hundred decks and pinned at
  // the cap for one with tens of thousands, so it carried no ordering either
  // way; the rate fixes that the same way it did for lands. Synergy at x6 was
  // a +-2 nudge against a ~25 point theme term, which is far too quiet for the
  // one number that measures "played more with *this* commander than usual".
  const inclusionRate = getEdhrecInclusionRate(edhrecCard);
  const popularityScore = inclusionRate === null ? 0 : inclusionRate * EDHREC_CARD_INCLUSION_WEIGHT;
  const synergyScore = Number(edhrecCard.synergy || 0) * EDHREC_CARD_SYNERGY_WEIGHT;

  let roleBonus = 0;
  const role = detectRole(card);

  if (role === "ramp") roleBonus = 4;
  else if (role === "draw") roleBonus = 4;
  else if (role === "removal") roleBonus = 4;
  else if (role === "wipe") roleBonus = 3;

  let curveBonus = 0;
  if (card.cmc <= 2) curveBonus = 3;
  else if (card.cmc <= 4) curveBonus = 4;
  else if (card.cmc <= 6) curveBonus = 1;

  const tags = detectCardTags(card);
  const themeSignals = buildThemeSignalSet(commanderThemes);
  let themeBonus = 0;

  for (const tag of tags) {
    if (themeSignals.has(normalizeThemeName(tag))) themeBonus += 5;
  }

  if (strategyProfile.wantsCreatures && isCreatureCard(card)) themeBonus += 5 * modePrefs.creatureBias;
  if (strategyProfile.wantsTokens && isTokenMaker(card)) themeBonus += 7 * modePrefs.synergyBias;
  if (strategyProfile.wantsSacrifice && isSacrificeCard(card)) themeBonus += 6 * modePrefs.synergyBias;
  if (strategyProfile.wantsGoWide && isCreatureCard(card)) themeBonus += 3 * modePrefs.creatureBias;

  if (strategyProfile.wantsTribal) {
    for (const tribe of strategyProfile.tribalTypes) {
      if (hasTribalType(card, tribe)) themeBonus += 10 * modePrefs.tribalBias;
    }
  }

  if (themeSignals.has("group hug") && tags.includes("opponent draw")) themeBonus += 4;
  if (themeSignals.has("counters") && tags.includes("counters")) themeBonus += 4;
  if (themeSignals.has("cantrips") && tags.includes("cantrips")) themeBonus += 3;
  themeBonus += getThemeFocusAdjustment(card, tags, modePrefs);
  themeBonus += getEdhrecReferenceBonus(edhrecCard, modePrefs);

  let penalty = 0;
  if (isLowPriorityMonoColorRock(card, commanderColors, strategyProfile)) penalty += 8;
  if (modePrefs.casualBias > 1 && isGameChanger(card.name)) penalty += 10 * modePrefs.casualBias;
  if (modePrefs.fewerStaplesBias > 1 && isGenericStaple(card)) penalty += 6 * modePrefs.fewerStaplesBias;

  return synergyScore * modePrefs.synergyBias + popularityScore + roleBonus + curveBonus + themeBonus - penalty;
}

function scoreFallbackCard(card, commanderThemes, strategyProfile, commanderColors, modePrefs) {
  let score = 5;

  const role = detectRole(card);
  if (role === "ramp") score += 4;
  else if (role === "draw") score += 4;
  else if (role === "removal") score += 4;
  else if (role === "wipe") score += 3;

  if (card.cmc <= 2) score += 3;
  else if (card.cmc <= 4) score += 4;
  else if (card.cmc <= 6) score += 1;

  const tags = detectCardTags(card);
  const themeSignals = buildThemeSignalSet(commanderThemes);
  for (const tag of tags) {
    if (themeSignals.has(normalizeThemeName(tag))) score += 4 * modePrefs.synergyBias;
  }

  score += getThemeFocusAdjustment(card, tags, modePrefs);

  if (strategyProfile.wantsCreatures && isCreatureCard(card)) score += 6 * modePrefs.creatureBias;
  if (strategyProfile.wantsTokens && isTokenMaker(card)) score += 8 * modePrefs.synergyBias;
  if (strategyProfile.wantsSacrifice && isSacrificeCard(card)) score += 7 * modePrefs.synergyBias;
  if (strategyProfile.wantsGoWide && isCreatureCard(card)) score += 3 * modePrefs.creatureBias;

  if (strategyProfile.wantsTribal) {
    for (const tribe of strategyProfile.tribalTypes) {
      if (hasTribalType(card, tribe)) score += 12 * modePrefs.tribalBias;
    }
  }

  if (isLowPriorityMonoColorRock(card, commanderColors, strategyProfile)) score -= 8;
  if (modePrefs.casualBias > 1 && isGameChanger(card.name)) score -= 10 * modePrefs.casualBias;
  if (modePrefs.fewerStaplesBias > 1 && isGenericStaple(card)) score -= 6 * modePrefs.fewerStaplesBias;

  return score;
}
