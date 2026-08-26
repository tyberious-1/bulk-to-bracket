// Theme vocabulary and detection.
//
// EDHREC tag names, our own internal theme signals, and tribal names all
// describe the same ideas with different words. getThemeAliases is the
// translation layer; everything downstream compares normalized alias sets
// rather than raw strings.
//
// Depends on: cards.js, constants.js, csv.js, text.js

function isLikelyEdhrecTagCandidate(tag) {
  const value = normalizeThemeName(tag);
  if (!value || value.length < 2 || value.length > 40) return false;
  if (/^[-+]?\d+$/.test(value)) return false;
  if (["creatures","instants","sorceries","artifacts","enchantments","planeswalkers","lands","utility artifacts","utility lands","mana artifacts","top cards","high synergy cards","new cards","game changers","similar commanders","budget","expensive","salt","price","bracket","theme","tribe"].includes(value)) return false;
  return /[a-z]/.test(value);
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
    "card draw": ["cantrips"],
    "reanimator": ["reanimator", "graveyard"],
    "graveyard": ["graveyard", "reanimator"],
    "self mill": ["graveyard", "reanimator"],
    "mill": ["graveyard"],
    "blink": ["blink"],
    "voltron": ["voltron"],
    "equipment": ["voltron"],
    "auras": ["voltron"],
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
  const cleanedTags = Array.from(new Set((edhrecTags || []).map(normalizeThemeName).filter(Boolean)));
  if (cleanedTags.length) {
    return cleanedTags.slice(0, 5);
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
