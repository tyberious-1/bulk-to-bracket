// Theme vocabulary and detection.
//
// EDHREC tag names, our own internal theme signals, and tribal names all
// describe the same ideas with different words. getThemeAliases is the
// translation layer; everything downstream compares normalized alias sets
// rather than raw strings.
//
// Depends on: cards.js, constants.js, csv.js, text.js

// Labels EDHREC uses for page sections rather than themes. Only consulted when
// a theme has to be guessed from the raw payload -- see extractEdhrecTagsFromData
// -- because several of these ("artifacts", "enchantments", "lands") are real
// themes too, and the only thing separating the two readings is where in the
// payload the string was found.
//
// Compared with spaces stripped. EDHREC sends these as slugs -- "topcards",
// "highsynergycards", "gamechangers" -- so the spaced spellings on this list
// never matched a single one of them, and every commander page contributed its
// own section names to the theme list.
const EDHREC_NON_THEME_LABELS = new Set([
  "creatures", "instants", "sorceries", "artifacts", "enchantments", "planeswalkers",
  "lands", "utilityartifacts", "utilitylands", "manaartifacts", "topcards",
  "highsynergycards", "newcards", "gamechangers", "similarcommanders", "budget",
  "expensive", "salt", "price", "bracket", "theme", "tribe"
].map((label) => label.replace(/\s+/g, "")));

// Could this string be the name of a theme at all? Shape only -- no opinion on
// whether EDHREC meant it as one.
function isPlausibleThemeName(tag) {
  const value = normalizeThemeName(tag);
  if (!value || value.length < 2 || value.length > 40) return false;
  if (/^[-+]?\d+$/.test(value)) return false;
  return /[a-z]/.test(value);
}

function isLikelyEdhrecTagCandidate(tag) {
  if (!isPlausibleThemeName(tag)) return false;

  // The payload is full of other commanders' names -- partner suggestions and
  // the "similar commanders" list -- and they read as themes to a walker that
  // only sees strings. None of EDHREC's 401 theme names contains a comma;
  // "Grazilaxx, Illithid Scholar" and its kind almost always do.
  if (normalizeThemeName(tag).includes(",")) return false;

  return !EDHREC_NON_THEME_LABELS.has(normalizeThemeName(tag).replace(/\s+/g, ""));
}

function getThemeAliases(theme) {
  const normalized = normalizeThemeName(theme);
  const aliases = new Set([normalized]);

  const directAliases = {
    "+1/+1 counters": ["counters", "countersmatter"],
    "counters matter": ["counters", "countersmatter"],
    "-1/-1 counters": ["counters"],
    "tokens": ["tokens", "gowide"],
    "sacrifice": ["sacrifice"],
    "aristocrats": ["sacrifice", "tokens", "gowide"],
    "lifegain": ["lifegain"],
    "artifacts": ["artifacts"],
    "enchantress": ["enchantments"],
    "lands matter": ["lands"],
    "landfall": ["lands"],
    "spellslinger": ["spellslinger", "cantrips"],
    "cantrips": ["cantrips", "spellslinger"],
    "wheels": ["wheels"],
    "group hug": ["group hug", "opponent draw"],
    "card draw": ["card draw", "cantrips"],
    "reanimator": ["reanimator", "graveyard"],
    "graveyard": ["graveyard", "reanimator"],
    "self mill": ["graveyard", "reanimator"],
    "mill": ["graveyard"],
    "blink": ["blink"],
    "voltron": ["voltron"],
    "equipment": ["voltron"],
    "auras": ["voltron"],
    "unblockable": ["unblockable"],
    "infect": ["infect"],
    "poison": ["infect"],
    "toxic": ["infect"],
    "ninjutsu": ["ninjutsu", "unblockable"],
    "theft": ["theft"],
    "steal": ["theft"],
    "control": ["control"],
    "spell copy": ["spell copy", "spellslinger"],
    "storm": ["spellslinger", "spell copy"],
    "stax": ["hatebears"],
    "treasure": ["artifacts", "tokens"],
    "food": ["artifacts", "tokens", "lifegain"],
    "clues": ["artifacts", "tokens"],
    "populate": ["tokens", "gowide"],
    "proliferate": ["counters", "countersmatter"],
    "modified creatures": ["counters", "countersmatter", "voltron"],
    "sagas": ["enchantments"],
    "historic": ["artifacts"],
    "hatebears": ["hatebears"],
    "hydras": ["hydra tribal", "counters"],
    "artificers": ["artificer tribal", "artifacts"],
    "golems": ["golem tribal", "artifacts"],
    "thopters": ["thopter tribal", "artifacts", "tokens"],
    "constructs": ["construct tribal", "artifacts"]
  };

  if (directAliases[normalized]) {
    for (const alias of directAliases[normalized]) aliases.add(alias);
  }

  const singularMap = {
    bears: "bear tribal",
    elves: "elf tribal",
    zombies: "zombie tribal",
    dragons: "dragon tribal",
    vampires: "vampire tribal",
    humans: "human tribal",
    goblins: "goblin tribal",
    angels: "angel tribal",
    cats: "cat tribal",
    merfolk: "merfolk tribal",
    slivers: "sliver tribal",
    demons: "demon tribal",
    faeries: "faerie tribal",
    knights: "knight tribal",
    pirates: "pirate tribal",
    wizards: "wizard tribal",
    spirits: "spirit tribal",
    soldiers: "soldier tribal",
    hydras: "hydra tribal",
    ninjas: "ninja tribal",
    elementals: "elemental tribal",
    shapeshifters: "shapeshifter tribal",
    warriors: "warrior tribal",
    clerics: "cleric tribal",
    dogs: "dog tribal",
    snakes: "snake tribal",
    beasts: "beast tribal",
    wolves: "wolf tribal",
    giants: "giant tribal",
    oozes: "ooze tribal",
    wurms: "wurm tribal",
    frogs: "frog tribal",
    insects: "insect tribal",
    rogues: "rogue tribal",
    spiders: "spider tribal",
    squirrels: "squirrel tribal",
    mutants: "mutant tribal",
    gods: "god tribal",
    dwarves: "dwarf tribal",
    lizards: "lizard tribal",
    rabbits: "rabbit tribal",
    bats: "bat tribal",
    druids: "druid tribal",
    monks: "monk tribal",
    orcs: "orc tribal",
    devils: "devil tribal",
    robots: "robot tribal",
    crabs: "crab tribal",
    phoenixes: "phoenix tribal",
    praetors: "praetor tribal",
    plants: "plant tribal",
    turtles: "turtle tribal",
    archers: "archer tribal",
    illusions: "illusion tribal",
    unicorns: "unicorn tribal",
    monkeys: "monkey tribal",
    avatars: "avatar tribal",
    horses: "horse tribal",
    rebels: "rebel tribal",
    nightmares: "nightmare tribal",
    kithkin: "kithkin tribal",
    griffins: "griffin tribal",
    advisors: "advisor tribal",
    satyrs: "satyr tribal",
    shamans: "shaman tribal",
    foxes: "fox tribal",
    daleks: "dalek tribal",
    atogs: "atog tribal"
  };

  if (singularMap[normalized]) aliases.add(singularMap[normalized]);
  if (normalized.endsWith(" tribal")) aliases.add(normalized);
  return Array.from(aliases);
}

function buildThemeSignalSet(themes) {
  const signals = new Set();
  for (const theme of themes || []) {
    for (const alias of getThemeAliases(theme)) {
      if (alias) signals.add(alias);
    }
  }
  return signals;
}

function commanderHasTheme(commanderThemes, signal) {
  return buildThemeSignalSet(commanderThemes).has(normalizeThemeName(signal));
}

function getCommanderTribalThemes(commanderThemes) {
  const tribal = [];
  const seen = new Set();
  for (const theme of commanderThemes || []) {
    for (const alias of getThemeAliases(theme)) {
      if (alias.endsWith(" tribal") && !seen.has(alias)) {
        seen.add(alias);
        tribal.push(alias);
      }
    }
  }
  return tribal;
}

function detectTribalThemes(cards) {
  const counts = {};
  for (const tribalType of TRIBAL_TYPES) counts[tribalType] = 0;

  for (const card of cards) {
    if (!card) continue;
    const combined = `${getCardType(card)} ${getCardText(card)}`;

    for (const tribalType of TRIBAL_TYPES) {
      const pattern = new RegExp(`\\b${tribalType}\\b`, "g");
      const matches = combined.match(pattern);
      if (matches) counts[tribalType] += matches.length;
    }
  }

  return Object.entries(counts)
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([tribe]) => `${tribe} tribal`);
}

async function detectCommanderThemes(edhrecCards, edhrecTags, collectionData, allOwnedCardData, commanderColors) {
  // edhrecTags already carries extractEdhrecTagsFromData's own count-based
  // selection (see EDHREC_THEME_MAX_COUNT in edhrec.js) -- re-truncating to 5
  // here would throw away exactly the secondary themes that selection was
  // built to keep, "Power Matters" among them.
  const cleanedTags = Array.from(new Set((edhrecTags || []).map(normalizeThemeName).filter(Boolean)));
  if (cleanedTags.length) {
    return cleanedTags;
  }

  const themeCards = [];
  const topSynergy = [...edhrecCards]
    .sort((a, b) => b.synergy - a.synergy)
    .slice(0, 36);

  for (const entry of topSynergy) {
    const card = allOwnedCardData.get(normalizeCardName(entry.name));
    if (card) themeCards.push(card);
  }

  const ownedThemeCandidates = [];
  const collectionEntries = getCollectionEntries(collectionData);
  for (const entry of collectionEntries) {
    if (ownedThemeCandidates.length >= 80) break;

    const card = allOwnedCardData.get(entry.normalizedName);
    if (!card) continue;
    if (!legalForCommander(card.colors, commanderColors)) continue;

    if (
      getCardType(card).includes("creature") ||
      getCardText(card).includes("token") ||
      getCardText(card).includes("sacrifice") ||
      getCardText(card).includes("+1/+1 counter") ||
      getCardText(card).includes("draw") ||
      getCardText(card).includes("graveyard") ||
      getCardText(card).includes("whenever")
    ) {
      ownedThemeCandidates.push(card);
    }
  }

  const combinedCards = [...themeCards, ...ownedThemeCandidates];

  const themeCounts = {
    "group hug": 0,
    counters: 0,
    cantrips: 0,
    wheels: 0,
    "opponent draw": 0,
    graveyard: 0,
    tokens: 0,
    artifacts: 0,
    enchantments: 0,
    lands: 0,
    spellslinger: 0,
    sacrifice: 0,
    countersmatter: 0,
    lifegain: 0,
    reanimator: 0,
    blink: 0,
    gowide: 0,
    voltron: 0
  };

  for (const card of combinedCards) {
    const text = getCardText(card);
    const type = getCardType(card);

    if (text.includes("each player draws") || text.includes("each opponent draws")) {
      themeCounts["group hug"] += 3;
      themeCounts["opponent draw"] += 2;
    }

    if (
      text.includes("target opponent draws") ||
      text.includes("an opponent draws") ||
      text.includes("that player draws")
    ) {
      themeCounts["group hug"] += 2;
      themeCounts["opponent draw"] += 3;
    }

    if (
      text.includes("draw a card") &&
      (type.includes("instant") || type.includes("sorcery")) &&
      card.cmc <= 2
    ) {
      themeCounts.cantrips += 3;
      themeCounts.spellslinger += 1;
    }

    if (
      text.includes("each player discards") ||
      text.includes("then draws") ||
      text.includes("discard their hand") ||
      text.includes("wheel")
    ) {
      themeCounts.wheels += 3;
    }

    if (
      text.includes("+1/+1 counter") ||
      text.includes("put a counter on") ||
      text.includes("put counters on")
    ) {
      themeCounts.counters += 3;
      themeCounts.countersmatter += 2;
    }

    if (text.includes("proliferate") || text.includes("double the number of")) {
      themeCounts.counters += 2;
      themeCounts.countersmatter += 3;
    }

    if (text.includes("graveyard")) themeCounts.graveyard += 2;

    if (text.includes("create") && text.includes("token")) {
      themeCounts.tokens += 2;
      themeCounts.gowide += 2;
    }

    if (type.includes("artifact")) themeCounts.artifacts += 1;
    if (type.includes("enchantment")) themeCounts.enchantments += 1;
    if (text.includes("landfall") || text.includes("search your library for a land")) themeCounts.lands += 2;
    if (type.includes("instant") || type.includes("sorcery")) themeCounts.spellslinger += 1;
    if (text.includes("sacrifice")) themeCounts.sacrifice += 3;
    if (text.includes("gain life") || text.includes("life total")) themeCounts.lifegain += 2;

    if (text.includes("return target creature card from your graveyard") || text.includes("reanimate")) {
      themeCounts.reanimator += 3;
    }

    if (
      text.includes("exile another target") ||
      text.includes("return it to the battlefield") ||
      text.includes("blink")
    ) {
      themeCounts.blink += 3;
    }

    if (
      text.includes("equipped creature") ||
      text.includes("enchanted creature") ||
      text.includes("commander damage")
    ) {
      themeCounts.voltron += 2;
    }
  }

  const normalThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .filter(([, count]) => count > 1)
    .slice(0, 4)
    .map(([theme]) => theme);

  const tribalThemes = detectTribalThemes(combinedCards);
  return [...normalThemes, ...tribalThemes].slice(0, 6);
}

function getCommanderStrategyProfile(commanderName, commanderThemes, commanderColors) {
  const normalizedName = normalizeCardName(commanderName);
  const themeSignals = buildThemeSignalSet(commanderThemes);

  const profile = {
    wantsCreatures: false,
    wantsTokens: false,
    wantsSacrifice: false,
    wantsTribal: false,
    tribalTypes: [],
    wantsCantrips: false,
    wantsCounters: false,
    wantsGroupHug: false,
    wantsGoWide: false,
    monoColor: commanderColors.length === 1
  };

  if (themeSignals.has("tokens")) profile.wantsTokens = true;
  if (themeSignals.has("sacrifice")) profile.wantsSacrifice = true;
  if (themeSignals.has("gowide")) profile.wantsGoWide = true;
  if (themeSignals.has("cantrips") || themeSignals.has("spellslinger")) profile.wantsCantrips = true;
  if (themeSignals.has("counters") || themeSignals.has("countersmatter")) profile.wantsCounters = true;
  if (themeSignals.has("group hug") || themeSignals.has("opponent draw")) profile.wantsGroupHug = true;

  const tribalThemes = getCommanderTribalThemes(commanderThemes);
  if (tribalThemes.length) {
    profile.wantsTribal = true;
    profile.wantsCreatures = true;
    profile.tribalTypes = tribalThemes.map((t) => t.replace(" tribal", ""));
  }

  if (profile.wantsTokens || profile.wantsSacrifice || profile.wantsGoWide) {
    profile.wantsCreatures = true;
  }

  if (normalizedName.includes("ib halfheart")) {
    profile.wantsCreatures = true;
    profile.wantsTokens = true;
    profile.wantsSacrifice = true;
    profile.wantsTribal = true;
    profile.wantsGoWide = true;
    if (!profile.tribalTypes.includes("goblin")) profile.tribalTypes.push("goblin");
  }

  return profile;
}

function getModePreferences(mode, strategyProfile) {
  const modeParts = String(mode || "").split("|").map((part) => part.trim()).filter(Boolean);
  const themePart = modeParts.find((part) => part.startsWith("theme:"));

  const themeFocus = themePart ? themePart.slice(6) : "";
  const focusedThemeSignal = normalizeThemeName(themeFocus);
  const tribalFocus = getCommanderTribalThemes(themeFocus ? [themeFocus] : []).length > 0;
  const focusedTribalTypes = getCommanderTribalThemes(themeFocus ? [themeFocus] : []).map((theme) => theme.replace(" tribal", ""));
  const themeFocusAliases = themeFocus ? getThemeAliases(themeFocus).map((alias) => normalizeThemeName(alias)) : [];
  const creatureFocusedTheme = ["tokens", "blink", "reanimator", "elves", "zombies", "goblins", "humans", "angels", "dragons", "bears"].includes(focusedThemeSignal);

  return {
    mode,
    themeFocus,
    focusedThemeSignal,
    focusedTribalTypes,
    themeFocusAliases,
    synergyBias:
      themeFocus ? 1.45 : 1,
    creatureBias:
      tribalFocus || creatureFocusedTheme ? 1.3 :
      strategyProfile.wantsCreatures ? 1.1 : 1,
    casualBias: 1,
    manaBaseBias: 1,
    fewerStaplesBias: 1,
    tribalBias: tribalFocus ? 1.55 : 1
  };
}

// Theme candidates for the backfill.
//
// scoreFallbackCard's theme term reads detectCardTags, which knows a fixed
// vocabulary of about twenty tags. Most themes EDHREC actually names -- landfall,
// clues, elementals, toolbox -- are not among them, so every owned card scored
// the same zero for theme fit and the backfill filled Yisan's toolbox deck with
// Wary Okapi and Spined Karok. Two commanders sharing a color got the same
// generic bodies: Yisan and Lonis shared 10 of 31 backfilled cards.
//
// So match the theme EDHREC named, rather than a tag we happen to have a
// detector for. Every owned card's oracle text and subtypes are already cached,
// which covers any theme whose name appears on the cards that serve it.

// EDHREC theme names against Scryfall functional tag names.
//
// The two vocabularies describe the same ideas and agree on almost none of the
// spellings: EDHREC names a theme as a plural noun for the deck that plays it,
// Scryfall tags the card with a verb or a singular. Passing EDHREC's name
// straight through as `otag:<name>` therefore missed nearly everything --
// measured across 8 commanders, 24 of 26 lookups returned zero cards, including
// every one of reanimator, clones, tokens, artifacts, sacrifice and equipment.
// The landfall example in fetchScryfallThemeCardNames' comment happens to be
// one of the few names that lines up.
//
// Most of the gap closes mechanically, which getScryfallThemeTags does below:
// singularize, then try Scryfall's "synergy-" and "-matters" prefixes. Checked
// against Scryfall's full tag list, that ladder recovers 57 of the 58 themes
// that resolve to a usable tag at all. The table is for the irregulars it
// cannot reach -- where Scryfall names the action and EDHREC names the deck.
//
// Card counts below are Scryfall's, unfiltered by color, measured 2026-09-10.
const SCRYFALL_THEME_TAGS = {
  "reanimator": "reanimate",              // 1067; "reanimator" matches nothing
  "artifacts": "synergy-artifact",        // 1064; "artifact-matters" is 1 card
  "enchantress": "synergy-enchantment",   // 250
  "card draw": "draw-matters",            // 175; bare "draw" is every cantrip
  "storm": "storm-count-matters",         // 25
  "spell copy": "copy-spell",             // 195
  "lifedrain": "drain-life",              // 423
  "aristocrats": "sacrifice-outlet",      // 1488
  "infect": "poison-mechanics"            // 169; "synergy-infect" is 2 cards
};

// Themes that are a strategy rather than a mechanic -- combo, aggro, midrange,
// cEDH, voltron, stax, toolbox, good stuff, big mana, pillow fort -- have no
// Scryfall tag at all, by design on Scryfall's part. They fall through to the
// EDHREC theme-page fingerprint, which is the pass written for exactly them.
function singularizeThemeSlug(slug) {
  if (slug.endsWith("ies")) return `${slug.slice(0, -3)}y`;
  if (slug.endsWith("s") && !slug.endsWith("ss")) return slug.slice(0, -1);
  return slug;
}

// Tag names to try for this theme, best first. Callers stop at the first that
// returns cards.
function getScryfallThemeTags(theme) {
  const name = normalizeThemeName(theme);
  if (!name) return [];

  // A curated mapping is one we have already verified, so do not dilute it
  // with guesses that could match something broader.
  if (SCRYFALL_THEME_TAGS[name]) return [SCRYFALL_THEME_TAGS[name]];

  const slug = name.replace(/\s+/g, "-");
  const singular = singularizeThemeSlug(slug);

  return Array.from(new Set([
    slug,
    singular,
    `synergy-${singular}`,
    `${singular}-matters`
  ])).filter(Boolean);
}

// EDHREC names themes in the plural where cards read singular ("clues" against
// "sacrifice this Clue"), so try both.
function getThemeKeywords(theme) {
  const name = normalizeThemeName(theme);
  if (!name) return [];

  const keywords = [name];
  if (name.endsWith("s")) keywords.push(name.slice(0, -1));
  return keywords;
}

// Whole words only. A plain substring test makes "ramp" match every trample
// creature, which handed Yisan's toolbox deck Yavimaya Wurm, Craw Giant and
// Elfhame Wurm as theme cards.
function cardMatchesThemeText(card, theme) {
  const keywords = getThemeKeywords(theme);
  if (!keywords.length) return false;

  const text = getCardText(card);
  const subtypes = getCardSubtypes(card);

  return keywords.some((keyword) => {
    if (subtypes.includes(keyword)) return true;
    const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    return pattern.test(text);
  });
}

// Owned cards that read as serving this theme, by name.
function findLocalThemeMatches(theme, collectionData, allOwnedCardData, commanderColors) {
  const matches = new Set();

  for (const entry of getCollectionEntries(collectionData)) {
    const card = allOwnedCardData.get(entry.normalizedName);
    if (!card) continue;
    if (getCardType(card).includes("land")) continue;
    if (!legalForCommander(card.colors, commanderColors)) continue;
    if (cardMatchesThemeText(card, theme)) matches.add(entry.normalizedName);
  }

  return matches;
}

// Below this, a theme has told the backfill almost nothing and is worth a
// Scryfall lookup.
const THEME_LOCAL_MATCH_FLOOR = 8;

// Owned cards serving one theme, by name. Three passes, each only asked when
// the one before it came up short.
//
// Local text matching answers most themes for free. Where it does not -- either
// the theme is named differently on the cards that serve it, or it is a concept
// with no text at all -- Scryfall's functional tags are asked instead: they are
// curated rather than derived, so otag:landfall finds 174 Gruul cards where a
// text search for "landfall" finds 120.
async function findThemeCandidates(
  theme,
  collectionData,
  allOwnedCardData,
  commanderColors,
  themeCardLists,
  corpusCards
) {
  // Pass one: the theme's own name, against text we already hold.
  const matches = findLocalThemeMatches(theme, collectionData, allOwnedCardData, commanderColors);
  if (matches.size >= THEME_LOCAL_MATCH_FLOOR) return matches;

  // Pass two: Scryfall's curated functional tags.
  const tagged = await fetchScryfallThemeCardNames(theme, commanderColors);
  for (const name of tagged) {
    if (!hasOwnedCard(collectionData, name)) continue;

    const normalized = normalizeCardName(name);
    const card = allOwnedCardData.get(normalized)
      || allOwnedCardData.get(normalizeCardName(getPrimaryCardName(name)));
    if (!card) continue;
    if (getCardType(card).includes("land")) continue;
    if (!legalForCommander(card.colors, commanderColors)) continue;

    matches.add(normalized);
  }
  if (matches.size >= THEME_LOCAL_MATCH_FLOOR) return matches;

  // Pass three: what EDHREC's own theme page says the theme is. The only one
  // of the three that can describe a theme with no name in the rules text.
  const exemplarNames = themeCardLists?.[normalizeThemeName(theme)] || [];
  if (exemplarNames.length < 6) return matches;

  const exemplarData = await fetchCardDataBatchWithProgress(
    exemplarNames.slice(0, THEME_EXEMPLAR_LIMIT),
    null
  );
  const phrases = deriveThemeFingerprint(Array.from(exemplarData.values()), corpusCards);
  for (const name of findFingerprintMatches(phrases, collectionData, allOwnedCardData, commanderColors)) {
    matches.add(name);
  }

  return matches;
}

// Every owned card that serves any of this commander's themes, mapped to how
// well it serves them: `rank` is the best-placed theme it matches and `hits` is
// how many it matches at all.
//
// A flat set of names told the backfill only whether a card was on-theme at
// all, which is not the question -- EDHREC orders themes by how many decks play
// them, so the first is what the deck is about and the fifth is a footnote, and
// a card serving three themes at once is more clearly on-plan than one clipping
// a single minor one. Two commanders sharing a color identity used to draw the
// same backfill because rank is the only signal that separates them.
async function buildThemeCandidateNames(
  commanderThemes,
  collectionData,
  allOwnedCardData,
  commanderColors,
  themeCardLists = {}
) {
  const candidates = new Map();
  const corpusCards = Array.from(allOwnedCardData.values());
  const themes = Array.isArray(commanderThemes) ? commanderThemes : [];

  for (let rank = 0; rank < themes.length; rank++) {
    const matches = await findThemeCandidates(
      themes[rank],
      collectionData,
      allOwnedCardData,
      commanderColors,
      themeCardLists,
      corpusCards
    );

    // Counted once per theme however many passes found it, so `hits` measures
    // themes served rather than passes run.
    for (const name of matches) {
      const existing = candidates.get(name);
      if (!existing) {
        candidates.set(name, { rank, hits: 1 });
        continue;
      }
      existing.hits += 1;
      if (rank < existing.rank) existing.rank = rank;
    }
  }

  return candidates;
}

// Theme fingerprints from EDHREC's own theme pages.
//
// Some themes describe an intent rather than a mechanic. "Toolbox", "combo",
// "birthing pod", "midrange" appear nowhere in card text and Scryfall has no
// functional tag for any of them, so neither earlier pass sees anything and the
// backfill goes back to picking whatever creature is cheapest -- Yisan's
// toolbox deck matched zero owned cards on 41 backfilled slots.
//
// EDHREC has already told us what those themes mean, though: the theme page
// lists the cards that define them. Read those cards and keep the phrases that
// are common among them and rare in the collection at large -- "search your
// library for a creature card" for a toolbox -- then match owned cards on those.

const THEME_EXEMPLAR_LIMIT = 60;
const THEME_FINGERPRINT_PHRASES = 12;

// A baseline drawn from the whole collection would mean 6,000 substring scans
// per candidate phrase. A slice is enough to tell "every third card says this"
// from "one in two hundred does".
const THEME_CORPUS_SAMPLE = 1200;

// How much more often a phrase must appear among the exemplars than in the
// collection before it counts as describing the theme rather than describing
// Magic. This is the filter that does the work: "when this creature enters"
// turns up in 11 of 60 toolbox exemplars but 166 of 1,200 owned cards, a lift
// of 1.3, while "your library for a" manages 4.2 on 7 exemplars.
const THEME_MIN_PHRASE_LIFT = 3;

// Support has to stay low for the same reason. A conceptual theme's cards agree
// on very little: a toolbox page is tutor targets, so only about one in eight
// carries the tutoring phrase that actually names the theme. Demanding 20%
// agreement threw that away and derived nothing at all.
const THEME_MIN_PHRASE_SUPPORT = 0.1;

// Ceiling on how many phrases get measured against the collection.
const THEME_PHRASE_SHORTLIST_LIMIT = 120;

// Reminder text is stripped: it restates rules the whole game shares and would
// hand back "you may cast this card from your graveyard" for every theme.
function getThemePhraseCandidates(text) {
  const cleaned = String(text || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];

  const words = cleaned.split(" ");
  const phrases = new Set();

  for (let size = 3; size <= 4; size++) {
    for (let start = 0; start + size <= words.length; start++) {
      phrases.add(words.slice(start, start + size).join(" "));
    }
  }

  return Array.from(phrases);
}

function deriveThemeFingerprint(exemplarCards, corpusCards) {
  const exemplars = (exemplarCards || []).filter(Boolean);
  if (exemplars.length < 6) return [];

  const exemplarHits = new Map();
  for (const card of exemplars) {
    for (const phrase of getThemePhraseCandidates(getCardText(card))) {
      exemplarHits.set(phrase, (exemplarHits.get(phrase) || 0) + 1);
    }
  }

  const minimumHits = Math.max(4, Math.ceil(exemplars.length * THEME_MIN_PHRASE_SUPPORT));
  let shortlist = [];
  for (const [phrase, hits] of exemplarHits) {
    if (hits >= minimumHits) shortlist.push(phrase);
  }
  if (!shortlist.length) return [];

  // Each survivor costs a scan of the corpus sample, so bound the list by the
  // phrases the exemplars agree on most rather than scoring all of them.
  shortlist.sort((a, b) => exemplarHits.get(b) - exemplarHits.get(a));
  shortlist = shortlist.slice(0, THEME_PHRASE_SHORTLIST_LIMIT);

  const sample = (corpusCards || []).slice(0, THEME_CORPUS_SAMPLE);
  const sampleSize = Math.max(sample.length, 1);
  const scored = [];

  for (const phrase of shortlist) {
    let corpusHits = 0;
    for (const card of sample) {
      if (getCardText(card).includes(phrase)) corpusHits += 1;
    }

    const exemplarShare = exemplarHits.get(phrase) / exemplars.length;
    // Floored so a phrase absent from the sample does not divide by zero.
    const corpusShare = Math.max(corpusHits, 1) / sampleSize;
    const lift = exemplarShare / corpusShare;

    if (lift >= THEME_MIN_PHRASE_LIFT) scored.push({ phrase, lift });
  }

  scored.sort((a, b) => b.lift - a.lift);
  return scored.slice(0, THEME_FINGERPRINT_PHRASES).map((entry) => entry.phrase);
}

function findFingerprintMatches(phrases, collectionData, allOwnedCardData, commanderColors) {
  const matches = new Set();
  if (!phrases.length) return matches;

  for (const entry of getCollectionEntries(collectionData)) {
    const card = allOwnedCardData.get(entry.normalizedName);
    if (!card) continue;
    if (getCardType(card).includes("land")) continue;
    if (!legalForCommander(card.colors, commanderColors)) continue;

    const text = getCardText(card);
    if (phrases.some((phrase) => text.includes(phrase))) matches.add(entry.normalizedName);
  }

  return matches;
}
