// Stubs so the project's browser-scoped code runs unmodified under
// osascript -l JavaScript. setTimeout runs its callback immediately, which
// is enough for the project's async/await code to resolve correctly.
function setTimeout(fn, _delay) { fn(); return 0; }
function clearTimeout(_id) {}

class AbortController {
  constructor() { this.signal = {}; }
  abort() {}
}

// JXA's built-in `console` only implements .log; the project's error paths
// (e.g. js/api/edhrec.js's fetchEdhrecThemePage) call console.warn/.error,
// which would otherwise throw "console.warn is not a function".
if (typeof console.warn !== "function") console.warn = console.log;
if (typeof console.error !== "function") console.error = console.log;

const localStorage = (function () {
  const store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; }
  };
})();

// fetch is overridden per-harness-run (compare.js defines it against
// prefetch_data.json before calling any project code that needs it), so this
// is only a safety-net default.
function fetch(_url, _opts) {
  return Promise.reject(new Error("fetch stub not configured for this harness run"));
}
// Static configuration: external endpoints and Magic-domain lookup tables.

const SCRYFALL_NAMED = "https://api.scryfall.com/cards/named?exact=";
const SCRYFALL_AUTOCOMPLETE = "https://api.scryfall.com/cards/autocomplete?q=";
const SCRYFALL_COLLECTION = "https://api.scryfall.com/cards/collection";
const EDHREC_BASE = "https://json.edhrec.com/pages/commanders/";
const EDHREC_TAGS_BASE = "https://json.edhrec.com/pages/tags/";
const SCRYFALL_CARD_SEARCH = "https://scryfall.com/search?q=!";

const WUBRG_ORDER = ["W", "U", "B", "R", "G", "C"];

const BASIC_LANDS = [
  { name: "Plains", colorsProduced: ["W"] },
  { name: "Island", colorsProduced: ["U"] },
  { name: "Swamp", colorsProduced: ["B"] },
  { name: "Mountain", colorsProduced: ["R"] },
  { name: "Forest", colorsProduced: ["G"] },
  { name: "Wastes", colorsProduced: [] }
];

const COLOR_TO_BASIC = {
  W: "Plains",
  U: "Island",
  B: "Swamp",
  R: "Mountain",
  G: "Forest"
};

// getThemeAliases (themes.js) maps plural EDHREC tribal theme names (e.g.
// "Constructs", "Orcs") to singular entries here via its singularMap/
// directAliases tables -- a plural whose singular is missing from this list
// can never be detected no matter what the collection holds, the same class
// of bug DETECTABLE_CARD_TAGS guards against in scoring.js. Keep this list a
// superset of every singular those tables reference.
const TRIBAL_TYPES = [
  "advisor", "ally", "angel", "archer", "artifact creature", "artificer", "atog",
  "avatar", "bat", "bear", "beast", "bird", "cat", "cleric", "construct",
  "crab", "dalek", "demon", "devil", "dinosaur", "dog", "dragon", "drake",
  "druid", "dwarf", "elemental", "elf", "faerie", "fox", "frog", "giant",
  "god", "goblin", "golem", "griffin", "horse", "human", "hydra", "illusion",
  "insect", "kithkin", "knight", "lizard", "merfolk", "monk", "monkey",
  "mutant", "nightmare", "ninja", "ooze", "orc", "phoenix", "pirate", "plant",
  "praetor", "rabbit", "rat", "rebel", "robot", "rogue", "samurai", "satyr",
  "shaman", "shapeshifter", "sliver", "snake", "soldier", "spider", "spirit",
  "squirrel", "thopter", "treefolk", "turtle", "unicorn", "vampire",
  "warlock", "warrior", "wizard", "wolf", "wurm", "zombie"
];

const GAME_CHANGERS = new Set([
  "ad nauseam",
  "ancient tomb",
  "aura shards",
  "biorhythm",
  "bolas's citadel",
  "braids, cabal minion",
  "chrome mox",
  "coalition victory",
  "consecrated sphinx",
  "crop rotation",
  "cyclonic rift",
  "demonic tutor",
  "drannith magistrate",
  "enlightened tutor",
  "farewell",
  "field of the dead",
  "fierce guardianship",
  "force of will",
  "gaea's cradle",
  "gamble",
  "gifts ungiven",
  "glacial chasm",
  "grand arbiter augustin iv",
  "grim monolith",
  "humility",
  "imperial seal",
  "intuition",
  "jeska's will",
  "lion's eye diamond",
  "mana vault",
  "mishra's workshop",
  "mox diamond",
  "mystical tutor",
  "narset, parter of veils",
  "natural order",
  "necropotence",
  "notion thief",
  "opposition agent",
  "orcish bowmasters",
  "panoptic mirror",
  "rhystic study",
  "seedborn muse",
  "serra's sanctum",
  "smothering tithe",
  "survival of the fittest",
  "teferi's protection",
  "tergrid, god of fright",
  "thassa's oracle",
  "the one ring",
  "the tabernacle at pendrell vale",
  "underworld breach",
  "vampiric tutor",
  "worldly tutor"
]);

// EDHREC publishes its commander rankings as one page per color identity, and
// each page lists exactly the commanders of that identity -- so the page a
// commander appears on names its colors, with no per-commander lookup needed.
// Slugs are EDHREC's own; the four-color ones are the Guildpact Nephilim.
const EDHREC_COMMANDER_COLOR_PAGES = {
  "colorless": [],
  "mono-white": ["W"],
  "mono-blue": ["U"],
  "mono-black": ["B"],
  "mono-red": ["R"],
  "mono-green": ["G"],
  "azorius": ["W", "U"],
  "dimir": ["U", "B"],
  "rakdos": ["B", "R"],
  "gruul": ["R", "G"],
  "selesnya": ["G", "W"],
  "orzhov": ["W", "B"],
  "golgari": ["B", "G"],
  "simic": ["G", "U"],
  "izzet": ["U", "R"],
  "boros": ["R", "W"],
  "bant": ["G", "W", "U"],
  "esper": ["W", "U", "B"],
  "grixis": ["U", "B", "R"],
  "jund": ["B", "R", "G"],
  "naya": ["R", "G", "W"],
  "abzan": ["W", "B", "G"],
  "jeskai": ["U", "R", "W"],
  "mardu": ["R", "W", "B"],
  "sultai": ["B", "G", "U"],
  "temur": ["G", "U", "R"],
  "glint-eye": ["U", "B", "R", "G"],
  "dune-brood": ["B", "R", "G", "W"],
  "ink-treader": ["R", "G", "W", "U"],
  "witch-maw": ["G", "W", "U", "B"],
  "yore-tiller": ["W", "U", "B", "R"],
  "five-color": ["W", "U", "B", "R", "G"]
};
// String transforms: card-name normalization for lookups and cache keys,
// theme-name normalization and display formatting, HTML escaping.

function normalizeCardName(name) {
  return String(name || "").trim().toLowerCase();
}

function getPrimaryCardName(name) {
  return String(name || "").split("//")[0].trim();
}

function normalizeUnicodeName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function cleanCardNameForLookup(name) {
  return normalizeUnicodeName(getPrimaryCardName(name))
    .replace(/’/g, "'")
    .replace(/‘/g, "'")
    .replace(/—/g, "-")
    .replace(/–/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function encodeCardNameForScryfall(name) {
  return encodeURIComponent(cleanCardNameForLookup(name));
}

function slugifyForEdhrec(name) {
  return cleanCardNameForLookup(name)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/,/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatThemeLabel(theme) {
  if (!theme) return "";
  return String(theme)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeThemeName(theme) {
  return String(theme || "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[\/_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
// Card-level accessors and predicates. Everything here takes a single card
// (either a raw Scryfall payload or our converted shape) and reads it
// defensively, since the two shapes name the same fields differently.
//
// Depends on: constants.js, text.js

const COMMANDER_PERMITTED_SUBTYPES = ["creature", "vehicle", "spacecraft"];

function getCardText(card) {
  return String(card?.text ?? card?.oracle_text ?? card?.rawText ?? "").toLowerCase();
}

function getCardType(card) {
  return String(card?.type ?? card?.type_line ?? card?.rawType ?? "").toLowerCase();
}

// The subtypes a card carries -- creature types, but also Equipment, Aura and
// the rest. Everything after the em dash, on both faces of a two-faced card.
// detectCardTags only names a handful of tribes, so this is what sees that
// seven different creatures are all Rogues.
function getCardSubtypes(card) {
  return getCardType(card)
    .split("//")
    .flatMap((face) => {
      const dash = face.indexOf("—");
      return dash === -1 ? [] : face.slice(dash + 1).trim().split(/\s+/);
    })
    .filter(Boolean);
}

function sanitizeCard(card) {
  if (!card) return null;
  const type = getCardType(card);
  const text = getCardText(card);
  return {
    ...card,
    type,
    text,
    rawType: card.rawType ?? card.type_line ?? card.type ?? "",
    rawText: card.rawText ?? card.oracle_text ?? card.text ?? ""
  };
}

function sanitizeDeckCards(deck) {
  return (deck || []).map(sanitizeCard).filter(Boolean);
}

function getCardImageUrl(card) {
  if (!card) return "";

  if (card.imageUrl) return String(card.imageUrl);
  if (card.image_uris?.normal) return String(card.image_uris.normal);
  if (card.image_uris?.large) return String(card.image_uris.large);

  if (Array.isArray(card.card_faces)) {
    for (const face of card.card_faces) {
      if (face?.image_uris?.normal) return String(face.image_uris.normal);
      if (face?.image_uris?.large) return String(face.image_uris.large);
    }
  }

  if (card.image) return String(card.image);

  return "";
}

function sortColorsWubrg(colors = []) {
  const unique = Array.from(new Set((colors || []).filter(Boolean).map((color) => String(color).toUpperCase())));
  const weight = (color) => {
    const index = WUBRG_ORDER.indexOf(String(color || "").toUpperCase());
    return index === -1 ? 99 : index;
  };
  return unique.sort((a, b) => weight(a) - weight(b));
}

function isBasicLand(name) {
  const normalized = normalizeCardName(name);
  return BASIC_LANDS.some((land) => normalizeCardName(land.name) === normalized);
}

// GAME_CHANGERS stores single-face names, but Scryfall reports a modal
// double-faced card as "Front // Back" -- so "Tergrid, God of Fright" arrives
// as "Tergrid, God of Fright // Tergrid's Lantern". Try the front face too.
function isGameChanger(cardName) {
  if (GAME_CHANGERS.has(normalizeCardName(cardName))) return true;
  return GAME_CHANGERS.has(normalizeCardName(getPrimaryCardName(cardName)));
}

function legalForCommander(cardColors, commanderColors) {
  for (const color of cardColors) {
    if (!commanderColors.includes(color)) return false;
  }
  return true;
}

function canBeCommander(card) {
  const type = getCardType(card);
  const text = getCardText(card);

  // Backgrounds, planeswalker commanders and similar opt in by rules text.
  if (text.includes("can be your commander")) return true;

  // Only the front face can be the commander, so ignore anything after "//".
  const frontType = type.split("//")[0];
  if (!frontType.includes("legendary")) return false;

  // Never match on the bare phrase "legendary creature": real type lines
  // interleave supertypes ("Legendary Enchantment Creature", "Legendary
  // Artifact Creature", "Legendary Snow Creature"). Legendary Vehicles and
  // Spacecraft are also legal commanders even though they aren't creatures.
  return COMMANDER_PERMITTED_SUBTYPES.some((subtype) => frontType.includes(subtype));
}
// Commander pairing rules.
//
// Five printed mechanics let a deck have two commanders. Each is detected from
// rules text -- which survives the persistent card cache -- plus the type line
// for the two "is a" checks.
//
// Scryfall's `keywords` array is deliberately NOT used: it tags every Friends
// forever card as "Partner", which would permit illegal pairs.
//
// Ordering matters. Friends forever prints as "Partner-Friends forever", so its
// text contains the word "partner" and it must be recognised first and excluded
// from the plain Partner rule.
//
// Depends on: cards.js, text.js

function isBackgroundCard(card) {
  return /\bbackground\b/.test(getCardType(card));
}

function isTimeLordDoctor(card) {
  return getCardType(card).includes("time lord doctor");
}

function hasFriendsForever(card) {
  return /\bfriends forever\b/.test(getCardText(card));
}

function hasPartnerWith(card) {
  return /\bpartner with\b/.test(getCardText(card));
}

// "Partner with X" also grants plain Partner, so such a card may pair with any
// Partner card, not only its named mate.
function hasPartnerAbility(card) {
  if (hasFriendsForever(card)) return false;
  if (isBackgroundCard(card)) return false;
  return /\bpartner\b/.test(getCardText(card));
}

function hasChooseABackground(card) {
  return /\bchoose a background\b/.test(getCardText(card));
}

// Apostrophe class rather than a literal, since printings vary between ' and .
function hasDoctorsCompanion(card) {
  return /\bdoctor.s companion\b/.test(getCardText(card));
}

function canHaveCommanderPartner(card) {
  if (!card) return false;
  return hasFriendsForever(card) ||
    hasPartnerAbility(card) ||
    hasChooseABackground(card) ||
    isBackgroundCard(card) ||
    isTimeLordDoctor(card) ||
    hasDoctorsCompanion(card);
}

function isLegalCommanderPair(primary, partner) {
  if (!primary || !partner) return false;
  if (normalizeCardName(primary.name) === normalizeCardName(partner.name)) return false;

  if (hasFriendsForever(primary) && hasFriendsForever(partner)) return true;
  if (hasPartnerAbility(primary) && hasPartnerAbility(partner)) return true;
  if (hasChooseABackground(primary) && isBackgroundCard(partner)) return true;
  if (isBackgroundCard(primary) && hasChooseABackground(partner)) return true;
  if (isTimeLordDoctor(primary) && hasDoctorsCompanion(partner)) return true;
  if (hasDoctorsCompanion(primary) && isTimeLordDoctor(partner)) return true;

  return false;
}

// Names the mechanic in play, for the second input's label.
function getCommanderPartnerLabel(card) {
  if (!card) return "";
  if (hasChooseABackground(card)) return "Background";
  if (isBackgroundCard(card)) return "Commander";
  if (isTimeLordDoctor(card)) return "Companion";
  if (hasDoctorsCompanion(card)) return "Doctor";
  if (hasFriendsForever(card)) return "Friends forever partner";
  if (hasPartnerAbility(card)) return "Partner";
  return "";
}

// "Partner with X" names its mate, so the UI can pre-fill it. Returns the name
// lowercased as it appears in rules text; Scryfall lookups are case-insensitive.
function getNamedCommanderPartner(card) {
  if (!card || !hasPartnerWith(card)) return "";
  const match = getCardText(card).match(/\bpartner with ([^(\n]+)/);
  return match ? match[1].trim() : "";
}
// ManaBox CSV parsing and lookups over the parsed collection.
//
// parseCSV resolves to a collection object shaped as:
//   { byNormalized: Map<string, number>, entries, originals, uniqueRawNames }
// where `originals` is an alias of `entries` kept for older callers.
//
// Depends on: cards.js, text.js

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

// EDHREC names a two-faced card by its front face, while the CSV lists it as
// "Front // Back", so an exact-name check alone reports those cards unowned
// and drops them from the EDHREC candidate pool.
function hasOwnedCard(collectionData, cardName) {
  const normalized = normalizeCardName(cardName);
  if (collectionData.byNormalized.has(normalized)) return true;
  if (collectionData.byFrontFace?.has(normalized)) return true;
  return isBasicLand(cardName);
}

function getCollectionEntries(collectionData) {
  if (Array.isArray(collectionData?.entries)) return collectionData.entries;
  return Array.isArray(collectionData?.originals) ? collectionData.originals : [];
}

async function parseCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = String(event.target.result || "");
        const lines = text.split(/\r?\n/).filter(Boolean);

        if (lines.length < 2) throw new Error("CSV file appears to be empty.");

        const header = splitCsvLine(lines[0]).map((x) => x.trim().toLowerCase());
        const nameIndex = header.findIndex((h) => h === "name");
        const qtyIndex = header.findIndex((h) => h === "quantity");

        if (nameIndex === -1 || qtyIndex === -1) {
          throw new Error("CSV must contain Name and Quantity columns.");
        }

        const byNormalized = new Map();
        const firstSeenName = new Map();

        for (let i = 1; i < lines.length; i++) {
          const cols = splitCsvLine(lines[i]);
          if (!cols.length) continue;

          const rawName = (cols[nameIndex] || "").trim();
          const rawQty = (cols[qtyIndex] || "").trim();
          if (!rawName) continue;

          const quantity = Number.parseInt(rawQty, 10);
          if (!Number.isFinite(quantity) || quantity <= 0) continue;

          const normalizedName = normalizeCardName(rawName);
          byNormalized.set(normalizedName, (byNormalized.get(normalizedName) || 0) + quantity);
          if (!firstSeenName.has(normalizedName)) firstSeenName.set(normalizedName, rawName);
        }

        const entries = Array.from(byNormalized.entries()).map(([normalizedName, quantity]) => ({
          rawName: firstSeenName.get(normalizedName) || normalizedName,
          normalizedName,
          quantity
        }));

        // Front-face aliases for the two-faced cards, kept in their own map so
        // a real single-faced card of the same name always wins the lookup.
        const byFrontFace = new Map();
        for (const entry of entries) {
          const front = normalizeCardName(getPrimaryCardName(entry.normalizedName));
          if (!front || front === entry.normalizedName) continue;
          if (byNormalized.has(front) || byFrontFace.has(front)) continue;
          byFrontFace.set(front, entry.quantity);
        }

        resolve({
          byNormalized,
          byFrontFace,
          entries,
          originals: entries,
          uniqueRawNames: entries.map((entry) => entry.rawName)
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read CSV file."));
    reader.readAsText(file);
  });
}
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

// Plural EDHREC tribal theme names mapped to the singular "X tribal" alias
// detectCardTags' tribal loop can actually produce. Module-level so the
// Theme/Tribal tab can enumerate every pickable tribal name without
// duplicating this table.
const TRIBAL_PLURAL_ALIASES = {
  allies: "ally tribal",
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

function getThemeAliases(theme) {
  const normalized = normalizeThemeName(theme);
  const aliases = new Set([normalized]);

  const directAliases = {
    "the ring": ["the ring tempts you"],
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

  if (TRIBAL_PLURAL_ALIASES[normalized]) aliases.add(TRIBAL_PLURAL_ALIASES[normalized]);
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
  return [...normalThemes, ...tribalThemes].slice(0, 12);
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

  // Handle irregular plurals from EDHREC tribals before naive singularization
  const irregularSingulars = {
    allies: "ally",
    dwarves: "dwarf",
    elves: "elf",
    kithkin: "kithkin",
    merfolk: "merfolk",
    phoenixes: "phoenix",
    wolves: "wolf"
  };

  if (irregularSingulars[name]) {
    keywords.push(irregularSingulars[name]);
  } else if (name.endsWith("s")) {
    keywords.push(name.slice(0, -1));
  }

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

// "As this [artifact/creature/enchantment] enters, choose a creature type" is
// the fixed templating for the whole flexible-typal-payoff family (Herald's
// Horn, Kindred Discovery, Adaptive Automaton, Metallic Mimic, Door of
// Destinies, Vanquisher's Banner, ...). Every other clause on these cards --
// a cost reduction, a card-advantage trigger, a +1/+1 anthem -- only does
// anything if the deck actually runs enough of the chosen type, so outside an
// actual tribal deck they read as ramp/draw/etc. to a naive text match while
// functionally doing nothing. `isTribalDeck` restores that condition instead
// of guessing which type would be chosen.
function isFlexibleTribalPayoff(card) {
  return getCardText(card).includes("choose a creature type");
}

// Whether *this build* is actually leaning tribal, for isFlexibleTribalPayoff's
// benefit. strategyProfile.wantsTribal is the commander's own overall
// tendency and applies to the unfocused/default build the same way its other
// archetype bonuses always have -- but once a theme is focused, the active
// build narrows to that theme alone, and a commander that supports a tribal
// path (Charix and crabs, say) while the user is focused on something else
// entirely (Control) is not, right now, building tribal.
function isActiveBuildTribal(strategyProfile, modePrefs) {
  return modePrefs.themeFocus
    ? modePrefs.focusedTribalTypes.length > 0
    : strategyProfile.wantsTribal;
}

function cardMatchesRole(card, role, isTribalDeck = false) {
  if (!isTribalDeck && isFlexibleTribalPayoff(card)) return false;

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
function detectRole(card, isTribalDeck = false) {
  if (getCardType(card).includes("land")) return "land";

  for (const role of SUPPORT_ROLES) {
    if (cardMatchesRole(card, role, isTribalDeck)) return role;
  }

  return "synergy";
}

// Every job a card does, rather than the first one detectRole stops at. A
// removal spell that also draws is both, and a board wipe that draws is
// reported as a wipe here where detectRole would only ever call it draw.
function getRoleContributions(card, isTribalDeck = false) {
  if (getCardType(card).includes("land")) return [];
  return SUPPORT_ROLES.filter((role) => cardMatchesRole(card, role, isTribalDeck));
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
  if (type.includes("vehicle") || /\bcrew\s+\d/.test(text)) tags.push("vehicles");

  // Airbending/Waterbending/Earthbending/Firebending are real keyword
  // abilities (Avatar: The Last Airbender set), not just flavor text -- e.g.
  // Avatar Kyoshi, Earthbender: "earthbend 8, then untap that land." Scryfall
  // doesn't retain `keywords` through convertScryfallCard, so this reads the
  // oracle text the same way the keyword line itself would print it.
  for (const element of ["air", "water", "earth", "fire"]) {
    if (new RegExp(`\\b${element}bend(ing)?\\b`).test(text)) tags.push(`${element}bending`);
  }

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

  if (type.includes("saga")) tags.push("sagas");
  if (text.includes("cascade")) tags.push("cascade");
  if (text.includes("amass")) tags.push("amass");
  if (text.includes("mutate")) tags.push("mutate");
  if (text.includes("discover")) tags.push("discover");
  if (text.includes("affinity for")) tags.push("affinity");
  if (text.includes("populate")) tags.push("populate");
  if (text.includes("the ring tempts you")) tags.push("the ring tempts you");
  if (text.includes("additional combat phase")) tags.push("extra combats");
  if (text.includes("extra turn")) tags.push("extra turns");
  // The reminder text is the only reliable signal -- the bare word "storm"
  // shows up in plenty of unrelated ability and flavor text.
  if (text.includes("copy it for each spell cast before it this turn")) tags.push("storm");
  if (text.includes("venture into the dungeon")) tags.push("dungeon");
  if (/\bdredge\s+\d/.test(text)) tags.push("dredge");
  if (/\bdescend\s+\d/.test(text)) tags.push("descend");
  if (text.includes("explore")) tags.push("explore");

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

// Every literal tag detectCardTags can actually produce (tribal types are
// handled separately, via " tribal" suffix matching in getSupportedThemes).
// A theme whose aliases fall entirely outside this vocabulary can never be
// matched no matter what the collection holds -- getSupportedThemes uses
// this to tell "no detector for this theme" apart from "no support in this
// collection" rather than greying out an option it has no way to check.
const DETECTABLE_CARD_TAGS = new Set([
  "graveyard", "tokens", "gowide", "artifacts", "enchantments", "lands",
  "spellslinger", "sacrifice", "counters", "countersmatter", "lifegain",
  "reanimator", "group hug", "opponent draw", "cantrips", "wheels", "blink",
  "voltron", "unblockable", "infect", "ninjutsu", "theft", "control",
  "spell copy", "card draw", "hatebears", "vehicles",
  "airbending", "waterbending", "earthbending", "firebending",
  "sagas", "cascade", "amass", "mutate", "discover", "affinity", "populate",
  "the ring tempts you", "extra combats", "extra turns", "storm", "dungeon",
  "dredge", "descend", "explore"
]);

// strategyProfile's wants* flags are an ambient signal: what this
// commander's decks look like on EDHREC even if the user picked no focus at
// all. Once the user picks an explicit focus, a *different* natural archetype
// must not keep competing for slots at full strength -- Charix, the Raging
// Isle's own top EDHREC archetype is Crabs (195 decks, ahead of Voltron's
// 154), so wantsTribal/tribalTypes=["crab"] fires regardless of a Voltron
// focus and crabs were outscoring the equipment/auras the focus asked for.
function strategyBonusAllowed(modePrefs, signals) {
  if (!modePrefs.themeFocus) return true;
  return signals.includes(modePrefs.focusedThemeSignal);
}

function tribalBonusAllowed(modePrefs, tribe) {
  if (!modePrefs.themeFocus) return true;
  return (modePrefs.focusedTribalTypes || []).includes(tribe);
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
  if (modePrefs.themeFocus) {
    bonus += themeMatch ? 12 : -10;
    // When a theme is focused, don't boost non-matching cards even if they're
    // from the average deck section. This prevents cards like Cankerbloom (removal)
    // from being picked over focused theme matches like Elves.
    if (!themeMatch) return bonus;
  }
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

  // A theme with no detector coverage can never match a card regardless of
  // what the collection holds -- that's a gap in detectCardTags, not
  // evidence the collection lacks support, so don't grey it out on a check
  // that was never capable of passing.
  for (const spec of specs) {
    const checkable = spec.tribes.length > 0 || Array.from(spec.aliases).some((alias) => DETECTABLE_CARD_TAGS.has(alias));
    if (!checkable) supported.add(spec.theme);
  }

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

function classifyBackfillModeFit(card, modePrefs, isTribalDeck = false) {
  const themeMatch = cardMatchesThemeFocus(card, modePrefs);
  const role = detectRole(card, isTribalDeck);
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
  const role = detectRole(card, isActiveBuildTribal(strategyProfile, modePrefs));

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
  if (strategyProfile.wantsTokens && isTokenMaker(card) && strategyBonusAllowed(modePrefs, ["tokens", "gowide"])) themeBonus += 7 * modePrefs.synergyBias;
  if (strategyProfile.wantsSacrifice && isSacrificeCard(card) && strategyBonusAllowed(modePrefs, ["sacrifice", "aristocrats"])) themeBonus += 6 * modePrefs.synergyBias;
  if (strategyProfile.wantsGoWide && isCreatureCard(card) && strategyBonusAllowed(modePrefs, ["tokens", "gowide"])) themeBonus += 3 * modePrefs.creatureBias;

  if (strategyProfile.wantsTribal) {
    for (const tribe of strategyProfile.tribalTypes) {
      if (hasTribalType(card, tribe) && tribalBonusAllowed(modePrefs, tribe)) themeBonus += 10 * modePrefs.tribalBias;
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

  const role = detectRole(card, isActiveBuildTribal(strategyProfile, modePrefs));
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
  if (strategyProfile.wantsTokens && isTokenMaker(card) && strategyBonusAllowed(modePrefs, ["tokens", "gowide"])) score += 8 * modePrefs.synergyBias;
  if (strategyProfile.wantsSacrifice && isSacrificeCard(card) && strategyBonusAllowed(modePrefs, ["sacrifice", "aristocrats"])) score += 7 * modePrefs.synergyBias;
  if (strategyProfile.wantsGoWide && isCreatureCard(card) && strategyBonusAllowed(modePrefs, ["tokens", "gowide"])) score += 3 * modePrefs.creatureBias;

  if (strategyProfile.wantsTribal) {
    for (const tribe of strategyProfile.tribalTypes) {
      if (hasTribalType(card, tribe) && tribalBonusAllowed(modePrefs, tribe)) score += 12 * modePrefs.tribalBias;
    }
  }

  if (isLowPriorityMonoColorRock(card, commanderColors, strategyProfile)) score -= 8;
  if (modePrefs.casualBias > 1 && isGameChanger(card.name)) score -= 10 * modePrefs.casualBias;
  if (modePrefs.fewerStaplesBias > 1 && isGenericStaple(card)) score -= 6 * modePrefs.fewerStaplesBias;

  return score;
}
// Shared fetch plumbing for the two upstream APIs.

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}
// EDHREC access and payload mining.
//
// EDHREC's commander JSON has no stable schema for the numbers we want, so
// the extractors here walk the payload defensively and score several
// candidate shapes rather than trusting one path.
//
// Depends on: constants.js, http.js, text.js, themes.js

// A commander page alone rarely lists enough cards a given collection owns to
// fill a deck -- for a niche commander it can be a third of what's needed, and
// the builder then backfills the rest with no commander-specific signal at
// all. Each detected theme has its own page with a different card list, so
// pulling the top few multiplies the candidate pool for a few extra requests.
const EDHREC_THEME_PAGE_LIMIT = 12;

// Below this many decks a theme page's inclusion rates are noise -- EDHREC
// serves pages built from as few as four decks, where one deck is 25%.
const EDHREC_THEME_MIN_DECKS = 20;

function toEdhrecSlug(name) {
  return slugifyForEdhrec(name);
}

// The share of decks that could have played this card and did. EDHREC's raw
// num_decks is not comparable across commanders -- a niche commander's most
// played card sits near 400 decks where a popular one's clears 40,000 -- so
// dividing by potential_decks is what lets one weight work for both.
//
// Returns null when EDHREC has no usable numbers, which means "no opinion" --
// distinct from a real rate of 0.
function getEdhrecInclusionRate(edhrecEntry) {
  if (!edhrecEntry) return null;

  const decks = Number(edhrecEntry.decks || 0);
  const potential = Number(edhrecEntry.potentialDecks || 0);
  if (!(decks > 0) || !(potential > 0)) return null;

  return Math.min(1, decks / potential);
}

// EDHREC serves a partnered deck under a combined slug, but only in one
// ordering -- the other returns HTTP 200 with an empty payload. The ordering is
// not consistently alphabetical, so try both, then fall back to the primary
// commander's own page.
function buildEdhrecSlugCandidates(commanderNames) {
  const slugs = (Array.isArray(commanderNames) ? commanderNames : [commanderNames])
    .filter(Boolean)
    .map((name) => toEdhrecSlug(getPrimaryCardName(name)))
    .filter(Boolean);

  if (!slugs.length) return [];
  if (slugs.length === 1) return [slugs[0]];
  return [`${slugs[0]}-${slugs[1]}`, `${slugs[1]}-${slugs[0]}`, slugs[0]];
}

// A 200 carrying no cardlists is a miss, not a hit: EDHREC answers unknown
// pair slugs that way. Retrying will not help, so move to the next candidate.
function edhrecPayloadHasCards(data) {
  const cardlists = data?.container?.json_dict?.cardlists;
  return Array.isArray(cardlists) && cardlists.length > 0;
}

// Returns { data, slug } so theme sub-page URLs can be built from the slug
// that actually resolved, rather than guessing it again.
async function fetchEdhrecCommanderJson(commanderNames) {
  const candidates = buildEdhrecSlugCandidates(commanderNames);
  let lastError = null;

  for (const slug of candidates) {
    const urls = [
      `${EDHREC_BASE}${slug}.json`,
      `${EDHREC_BASE}${slug}/${slug}.json`
    ];

    for (const url of urls) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const data = await fetchJsonWithTimeout(url, {}, 12000);
          if (edhrecPayloadHasCards(data)) return { data, slug };
          break;
        } catch (error) {
          lastError = error;
          console.warn(`EDHREC fetch failed (attempt ${attempt})`, url, error);
          await sleep(300 * attempt);
        }
      }
    }
  }

  console.warn(`Failed to fetch EDHREC commander data for ${commanderNames}.`, lastError);
  return null;
}

// Themes worth pulling a page for: the most-played ones, and only where enough
// decks back them to make the numbers mean something.
function pickEdhrecThemeSlugs(data) {
  const taglinks = data?.panels?.taglinks;
  if (!Array.isArray(taglinks)) return [];

  return taglinks
    .filter((tag) => tag?.slug && Number(tag.count || 0) >= EDHREC_THEME_MIN_DECKS)
    .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
    .slice(0, EDHREC_THEME_PAGE_LIMIT)
    .map((tag) => String(tag.slug));
}

// A missing or broken theme page is not worth failing the build over -- the
// commander page already gave us a usable pool.
async function fetchEdhrecThemePage(commanderSlug, themeSlug) {
  try {
    const data = await fetchJsonWithTimeout(`${EDHREC_BASE}${commanderSlug}/${themeSlug}.json`, {}, 12000);
    return edhrecPayloadHasCards(data) ? data : null;
  } catch (error) {
    console.warn(`EDHREC theme page unavailable: ${commanderSlug}/${themeSlug}`, error);
    return null;
  }
}

function extractLikelyTags(value, weights) {
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === "string")) {
      value.forEach((tag, index) => {
        if (!isLikelyEdhrecTagCandidate(tag)) return;
        const key = normalizeThemeName(tag);
        weights.set(key, Math.max(weights.get(key) || 0, value.length - index));
      });
      return;
    }

    value.forEach((item) => extractLikelyTags(item, weights));
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const [key, nested] of Object.entries(value)) {
    const lowerKey = normalizeThemeName(key);

    if (lowerKey.includes("tag") && typeof nested === "string" && isLikelyEdhrecTagCandidate(nested)) {
      const tagKey = normalizeThemeName(nested);
      weights.set(tagKey, Math.max(weights.get(tagKey) || 0, 6));
      continue;
    }

    if (lowerKey.includes("tag") && Array.isArray(nested) && nested.every((item) => typeof item === "string")) {
      nested.forEach((tag, index) => {
        if (!isLikelyEdhrecTagCandidate(tag)) return;
        const tagKey = normalizeThemeName(tag);
        weights.set(tagKey, Math.max(weights.get(tagKey) || 0, nested.length - index + 2));
      });
      continue;
    }

    if (lowerKey.includes("tag") && Array.isArray(nested)) {
      nested.forEach((item, index) => {
        if (!item || typeof item !== "object") return;
        const label = item.name || item.label || item.tag || item.value || item.header;
        if (!isLikelyEdhrecTagCandidate(label)) return;
        const count = Number(item.count || item.num_decks || item.decks || item.value_count || 0);
        const score = count > 0 ? count : Math.max(1, nested.length - index + 1);
        const tagKey = normalizeThemeName(label);
        weights.set(tagKey, Math.max(weights.get(tagKey) || 0, score));
      });
    }

    extractLikelyTags(nested, weights);
  }
}

// EDHREC's own answer to "what is this commander's deck about", in
// panels.taglinks: theme names with the number of decks behind each.
//
// Preferred over extractLikelyTags below, which walks the whole payload and
// cannot tell a theme from a page section or from the name of a similar
// commander. For a popular commander the walk lands on the right answer by
// weight of numbers; for a niche one the junk outranks the real themes
// entirely. Abdel Adrian's page lists Blink and Tokens, and the walk returned
// "brago, king eternal | newcards | highsynergycards | topcards | gamechangers"
// -- five strings, not one of them a theme, leaving the backfill nothing to
// aim at and the whole deck filled generically.
//
// Only the shape of the name is checked here. The section-label list is not,
// because a taglink is a theme by construction: "Artifacts" in this panel means
// the archetype, where the same word as a cardlist header means a card type.
//
// The top 5 are always kept -- that much was already working. Beyond that, a
// theme is admitted only if it clears both an absolute floor and a share of
// the top theme's count, rather than by a flat rank cutoff.
//
// A flat cutoff cannot tell "a real secondary mechanic" from "one deck that
// happened to get tagged": raising it to a flat 8 pulled in Beasts for
// Quickbeam on a single deck out of seven, and Angels for Daxos on 4 of 146
// (2.7%). The two-part test rejects both while admitting The Earth King's
// actual payoff -- "Power Matters" sits at rank 7, 15 of 91 decks (16.5%),
// which the flat top-5 dropped entirely and left its whole backfill generic.
//
// Both bars are needed together, not either alone: Quickbeam's Beasts clears
// the 12% relative bar (1 of 7) but not the floor, and Anowon's Reanimator (76
// decks) clears the floor easily but not the relative bar (6.3% of 1,211) --
// a real theme, just not this commander's.
const EDHREC_THEME_BASE_COUNT = 5;
const EDHREC_THEME_MAX_COUNT = 12;
const EDHREC_THEME_MIN_ABSOLUTE_DECKS = 10;
const EDHREC_THEME_MIN_RELATIVE_SHARE = 0.12;

function extractEdhrecTaglinkThemes(data) {
  const taglinks = data?.panels?.taglinks;
  if (!Array.isArray(taglinks)) return [];

  const ranked = taglinks
    .map((tag) => ({
      name: normalizeThemeName(tag?.value || tag?.slug || ""),
      count: Number(tag?.count || 0)
    }))
    .filter((tag) => isPlausibleThemeName(tag.name))
    .sort((a, b) => b.count - a.count);

  if (!ranked.length) return [];

  const topCount = ranked[0].count || 1;
  const chosen = ranked.slice(0, EDHREC_THEME_BASE_COUNT);

  for (const tag of ranked.slice(EDHREC_THEME_BASE_COUNT)) {
    if (chosen.length >= EDHREC_THEME_MAX_COUNT) break;
    if (tag.count < EDHREC_THEME_MIN_ABSOLUTE_DECKS) continue;
    if (tag.count < topCount * EDHREC_THEME_MIN_RELATIVE_SHARE) continue;
    chosen.push(tag);
  }

  return chosen.map((tag) => tag.name);
}

// The full taglink list, unfiltered by the relative-share gate above. That
// gate exists to keep noise themes out of the build logic (scoring, type
// targets) -- but the "Other Themes" dropdown is opt-in, a user picking a
// long-tail theme by name is not the same risk as the builder silently
// backfilling on one. So the dropdown gets everything EDHREC's "more tags"
// section shows, and only the curated list feeds the build itself.
function extractAllEdhrecTaglinkNames(data) {
  const taglinks = data?.panels?.taglinks;
  if (!Array.isArray(taglinks)) return [];

  return taglinks
    .map((tag) => ({
      name: normalizeThemeName(tag?.value || tag?.slug || ""),
      count: Number(tag?.count || 0)
    }))
    .filter((tag) => isPlausibleThemeName(tag.name))
    .sort((a, b) => b.count - a.count)
    .map((tag) => tag.name);
}

function extractEdhrecTagsFromData(data) {
  const named = extractEdhrecTaglinkThemes(data);
  if (named.length) return named;

  // No taglinks panel at all -- fall back to reading the payload for anything
  // theme-shaped, section labels and similar commanders filtered out as best
  // they can be.
  const weights = new Map();
  extractLikelyTags(data, weights);
  return Array.from(weights.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
    .slice(0, 12);
}

function parseEdhrecSectionAverage(section) {
  const numericCandidates = [
    section?.avg,
    section?.average,
    section?.count,
    section?.total,
    section?.num_cards,
    section?.numCards,
    section?.cards,
    section?.amount
  ];

  for (const candidate of numericCandidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      return Math.round(candidate);
    }
  }

  const textCandidates = [section?.header, section?.value, section?.title, section?.label, section?.tag]
    .filter(Boolean)
    .map(String);

  for (const candidate of textCandidates) {
    const match = candidate.match(/(\d{1,2})/);
    if (match) return Number(match[1]);
  }

  return null;
}

function extractEdhrecTypeAverages(data) {
  const typeKeyMap = {
    creature: "Creature",
    creatures: "Creature",
    instant: "Instant",
    instants: "Instant",
    sorcery: "Sorcery",
    sorceries: "Sorcery",
    artifact: "Artifact",
    artifacts: "Artifact",
    enchantment: "Enchantment",
    enchantments: "Enchantment",
    planeswalker: "Planeswalker",
    planeswalkers: "Planeswalker",
    land: "Land",
    lands: "Land"
  };

  const counts = {};
  const maxReasonableTypeCount = 40;
  const buckets = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Land"];

  function mapTypeBucket(label) {
    const normalized = normalizeThemeName(label);
    if (typeKeyMap[normalized]) return typeKeyMap[normalized];
    if (normalized.includes("creature")) return "Creature";
    if (normalized.includes("instant")) return "Instant";
    if (normalized.includes("sorcer")) return "Sorcery";
    if (normalized.includes("artifact")) return "Artifact";
    if (normalized.includes("enchantment")) return "Enchantment";
    if (normalized.includes("planeswalker")) return "Planeswalker";
    if (normalized.includes("land")) return "Land";
    return null;
  }

  function addCount(key, value, allowOverride = true) {
    const bucket = mapTypeBucket(key);
    const numeric = Number(value);
    if (!bucket || !Number.isFinite(numeric) || numeric < 0) return;
    const bounded = Math.max(0, Math.min(maxReasonableTypeCount, Math.round(numeric)));
    if (allowOverride) {
      counts[bucket] = Math.max(counts[bucket] || 0, bounded);
    } else if (counts[bucket] === undefined) {
      counts[bucket] = bounded;
    }
  }

  function readDirectTypeCounts(source) {
    if (!source || typeof source !== "object" || Array.isArray(source)) return null;
    const out = {};
    for (const [key, value] of Object.entries(source)) {
      const bucket = mapTypeBucket(key);
      const numeric = Number(value);
      if (!bucket || !Number.isFinite(numeric) || numeric < 0) continue;
      out[bucket] = Math.max(0, Math.min(maxReasonableTypeCount, Math.round(numeric)));
    }

    const populated = Object.keys(out).length;
    if (populated < 3) return null;
    if (!out.Land || !out.Creature) return null;
    return out;
  }

  function scoreDirectCounts(typeCounts) {
    if (!typeCounts) return -1;
    const coverage = buckets.filter((bucket) => Number.isFinite(typeCounts[bucket])).length;
    const total = buckets.reduce((sum, bucket) => sum + (Number(typeCounts[bucket]) || 0), 0);
    const closeness = Math.max(0, 100 - Math.abs(99 - total));
    return coverage * 100 + closeness;
  }

  const explicitCandidates = [
    readDirectTypeCounts(data),
    readDirectTypeCounts(data?.container?.json_dict),
    readDirectTypeCounts(data?.container?.json_dict?.stats),
    readDirectTypeCounts(data?.container?.json_dict?.meta),
    readDirectTypeCounts(data?.meta)
  ].filter(Boolean);

  const preferredDirectCounts = explicitCandidates
    .sort((a, b) => scoreDirectCounts(b) - scoreDirectCounts(a))[0] || null;

  if (preferredDirectCounts) {
    for (const [bucket, value] of Object.entries(preferredDirectCounts)) {
      counts[bucket] = value;
    }
  }

  function visit(node, depth = 0, allowOverride = true) {
    if (!node || depth > 6) return;

    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1, allowOverride);
      return;
    }

    if (typeof node !== "object") return;

    const keys = Object.keys(node);
    const hasTypeShape = keys.some((key) => typeKeyMap[normalizeThemeName(key)]);
    if (hasTypeShape) {
      for (const [key, value] of Object.entries(node)) addCount(key, value, allowOverride);
    }

    for (const value of Object.values(node)) {
      if (value && typeof value === "object") visit(value, depth + 1, allowOverride);
    }
  }

  visit(data, 0, !preferredDirectCounts);
  if (data?.container?.json_dict && data.container.json_dict !== data) {
    visit(data.container.json_dict, 0, !preferredDirectCounts);
  }

  const cardlists = data?.container?.json_dict?.cardlists;
  if (Array.isArray(cardlists)) {
    for (const section of cardlists) {
      const labelCandidates = [section?.header, section?.value, section?.title, section?.label, section?.tag]
        .filter(Boolean)
        .map((value) => normalizeThemeName(String(value)));

      let bucket = null;
      for (const label of labelCandidates) {
        const mapped = mapTypeBucket(label);
        if (mapped) {
          bucket = mapped;
          break;
        }
      }
      if (!bucket) continue;

      const average = parseEdhrecSectionAverage(section);
      if (!average && average !== 0) continue;
      const bounded = Math.max(0, Math.min(maxReasonableTypeCount, Math.round(average)));
      if (!preferredDirectCounts || counts[bucket] === undefined) {
        counts[bucket] = Math.max(counts[bucket] || 0, bounded);
      }
    }
  }

  return Object.keys(counts).length ? counts : null;
}

function extractEdhrecRoleTargets(data, edhrecTags = []) {
  const cardlists = data?.container?.json_dict?.cardlists;
  const roleMatchers = {
    ramp: ["ramp", "mana ramp", "mana rocks", "mana dorks", "acceleration", "treasure"],
    draw: ["card draw", "draw", "advantage", "cantrips", "wheel", "wheels"],
    removal: ["removal", "spot removal", "interaction", "counterspells", "counterspells", "control"],
    wipe: ["board wipes", "board wipe", "sweepers", "sweeper", "wraths", "wrath"]
  };

  const counts = {};

  if (Array.isArray(cardlists)) {
    for (const section of cardlists) {
      const labelCandidates = [section?.header, section?.value, section?.title, section?.label, section?.tag]
        .filter(Boolean)
        .map((value) => normalizeThemeName(String(value)));

      let matchedRole = null;
      for (const label of labelCandidates) {
        for (const [role, patterns] of Object.entries(roleMatchers)) {
          if (patterns.some((pattern) => label.includes(pattern))) {
            matchedRole = role;
            break;
          }
        }
        if (matchedRole) break;
      }
      if (!matchedRole) continue;

      const average = parseEdhrecSectionAverage(section);
      if (!average) continue;
      if (!counts[matchedRole] || average > counts[matchedRole]) counts[matchedRole] = average;
    }
  }

  const themeSignals = buildThemeSignalSet(edhrecTags);
  const defaults = {
    ramp: 10,
    draw: 10,
    removal: 8,
    wipe: 3
  };

  const adjusted = {
    ramp: counts.ramp ?? defaults.ramp,
    draw: counts.draw ?? defaults.draw,
    removal: counts.removal ?? defaults.removal,
    wipe: counts.wipe ?? defaults.wipe
  };

  if (themeSignals.has("spellslinger") || themeSignals.has("cantrips")) {
    adjusted.draw += 2;
    adjusted.removal += 1;
  }
  if (themeSignals.has("group hug") || themeSignals.has("opponent draw") || themeSignals.has("wheels")) {
    adjusted.draw += 2;
  }
  if (themeSignals.has("artifacts") || themeSignals.has("treasure") || themeSignals.has("lands") || themeSignals.has("landfall")) {
    adjusted.ramp += 1;
  }
  if (themeSignals.has("sacrifice") || themeSignals.has("aristocrats") || themeSignals.has("graveyard") || themeSignals.has("reanimator")) {
    adjusted.draw += 1;
    adjusted.removal += 1;
  }
  if (themeSignals.has("tokens") || themeSignals.has("gowide") || themeSignals.has("voltron")) {
    adjusted.removal += 1;
    adjusted.wipe = Math.max(adjusted.wipe - 1, 2);
  }
  if (themeSignals.has("counters") || themeSignals.has("countersmatter") || themeSignals.has("lifegain")) {
    adjusted.draw += 1;
  }

  return Object.fromEntries(
    Object.entries(adjusted).map(([role, value]) => {
      const minimum = role === "wipe" ? 2 : role === "removal" ? 6 : 8;
      const maximum = role === "wipe" ? 5 : 14;
      return [role, Math.max(minimum, Math.min(maximum, Math.round(Number(value) || defaults[role])))];
    })
  );
}

// Folds one EDHREC payload's card lists into `deduped`, which may already hold
// entries from another page for the same commander.
function collectEdhrecCards(data, deduped) {
  const cardlists = data?.container?.json_dict?.cardlists;
  if (!Array.isArray(cardlists)) return;

  for (const section of cardlists) {
    const cards = Array.isArray(section.cardviews) ? section.cardviews : [];
    for (const card of cards) {
      if (!card?.name) continue;

      const key = normalizeCardName(card.name);
      const decks = Number(card.num_decks || 0);
      // How many decks *could* have played it -- the denominator that turns a
      // raw count into a rate comparable across commanders and themes.
      const potentialDecks = Number(card.potential_decks || 0);
      const header = section.header ? String(section.header) : "";

      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, {
          name: card.name,
          synergy: Number(card.synergy || 0),
          decks,
          potentialDecks,
          label: header,
          labels: header ? [header] : []
        });
        continue;
      }

      existing.synergy = Math.max(Number(existing.synergy || 0), Number(card.synergy || 0));

      // decks and potentialDecks only mean anything as a pair. Taking the max
      // of each independently would staple a theme page's numerator to the
      // commander page's much larger denominator and understate the card.
      // Keep whichever pair reads as the stronger rate instead.
      const existingRate = existing.potentialDecks > 0 ? existing.decks / existing.potentialDecks : 0;
      const incomingRate = potentialDecks > 0 ? decks / potentialDecks : 0;
      if (incomingRate > existingRate) {
        existing.decks = decks;
        existing.potentialDecks = potentialDecks;
      }

      if (header && !existing.labels.includes(header)) existing.labels.push(header);
    }
  }
}

async function getEDHREC(commanderNames) {
  const fetched = await fetchEdhrecCommanderJson(commanderNames);
  const data = fetched?.data || null;
  const commanderSlug = fetched?.slug || "";

  if (!data) {
    return {
      cards: [],
      tags: [],
      allTags: [],
      typeAverages: null,
      roleTargets: null,
      themeCardLists: {},
      unavailable: true
    };
  }

  const cardlists = data?.container?.json_dict?.cardlists;
  if (!Array.isArray(cardlists)) {
    return {
      cards: [],
      tags: [],
      allTags: [],
      typeAverages: null,
      roleTargets: null,
      themeCardLists: {},
      unavailable: true
    };
  }

  const deduped = new Map();
  collectEdhrecCards(data, deduped);

  // Theme pages are still this commander's decks, just sliced by archetype, so
  // their cards belong in the same pool. They also carry much stronger signal:
  // a card is 18% of all Krydle decks but 55% of Krydle Mill decks.
  // Kept per theme as well as merged, because which theme a card came from is
  // the only description some themes have. "Toolbox" and "birthing pod" leave
  // no trace in card text and Scryfall has no functional tag for them, but the
  // cards on their pages are what those themes mean.
  const themeCardLists = {};

  const themeSlugs = pickEdhrecThemeSlugs(data);
  for (const themeSlug of themeSlugs) {
    const themeData = await fetchEdhrecThemePage(commanderSlug, themeSlug);
    if (themeData) {
      collectEdhrecCards(themeData, deduped);

      const perTheme = new Map();
      collectEdhrecCards(themeData, perTheme);
      themeCardLists[normalizeThemeName(themeSlug)] =
        Array.from(perTheme.values()).map((entry) => entry.name);
    }
    await sleep(120);
  }

  const tags = extractEdhrecTagsFromData(data);
  const allTags = extractAllEdhrecTaglinkNames(data);
  const typeAverages = extractEdhrecTypeAverages(data);
  const roleTargets = extractEdhrecRoleTargets(data, tags);

  return {
    cards: Array.from(deduped.values()),
    tags,
    allTags,
    typeAverages,
    roleTargets,
    themeCardLists,
    unavailable: false
  };
}

// Commander rankings.
//
// The builder asks EDHREC about one commander at a time, which is the wrong
// shape for "rank every commander I own" -- a bulk collection holds hundreds
// of legal commanders and that many requests is minutes of waiting. The color
// pages answer the same question in 32: each lists its identity's most-played
// commanders with a global deck count, so intersecting them with a collection
// ranks it without touching a single commander page.

// EDHREC writes a partner pair as one entry, "A // B" -- the same separator a
// two-faced card's name uses. Callers have to tell those apart; see
// resolveOwnedCommanderEntry.
function extractEdhrecCommanderList(data, colorPage) {
  const cardlists = data?.container?.json_dict?.cardlists;
  if (!Array.isArray(cardlists)) return [];

  const entries = [];
  for (const section of cardlists) {
    for (const entry of Array.isArray(section.cardviews) ? section.cardviews : []) {
      if (!entry?.name) continue;
      entries.push({
        name: entry.name,
        slug: String(entry.slug || toEdhrecSlug(getPrimaryCardName(entry.name))),
        decks: Number(entry.num_decks || 0),
        colorPage,
        colors: EDHREC_COMMANDER_COLOR_PAGES[colorPage] || []
      });
    }
  }

  return entries;
}

// A tag page (https://json.edhrec.com/pages/tags/<slug>.json) mixes commander
// cardlists in with regular card sections (Creatures, Instants, Mana
// Artifacts, ...) -- only "Top Commanders" and "New Commanders" name actual
// commanders, so filter on the header rather than walking every section the
// way extractEdhrecCommanderList does for color pages.
function extractEdhrecTagCommanders(data) {
  const cardlists = data?.container?.json_dict?.cardlists;
  if (!Array.isArray(cardlists)) return [];

  const entries = [];
  for (const section of cardlists) {
    if (!/commander/i.test(String(section?.header || ""))) continue;
    for (const entry of Array.isArray(section.cardviews) ? section.cardviews : []) {
      if (!entry?.name) continue;
      entries.push({
        name: entry.name,
        slug: String(entry.slug || toEdhrecSlug(getPrimaryCardName(entry.name))),
        decks: Number(entry.num_decks || 0)
      });
    }
  }

  return entries;
}

// A theme's tag page can 403/404 (typo, or EDHREC just doesn't track it) --
// treated the same as a missing color page, an empty result rather than an
// error the caller has to handle.
async function fetchEdhrecTagCommanders(themeSlug) {
  try {
    const data = await fetchJsonWithTimeout(`${EDHREC_TAGS_BASE}${themeSlug}.json`, {}, 12000);
    return edhrecPayloadHasCards(data) ? extractEdhrecTagCommanders(data) : [];
  } catch (error) {
    console.warn(`EDHREC tag page unavailable: ${themeSlug}`, error);
    return [];
  }
}

// A missing color page costs that identity's commanders, not the whole scan.
async function fetchEdhrecColorPage(colorPage) {
  try {
    const data = await fetchJsonWithTimeout(`${EDHREC_BASE}${colorPage}.json`, {}, 12000);
    return edhrecPayloadHasCards(data) ? data : null;
  } catch (error) {
    console.warn(`EDHREC color page unavailable: ${colorPage}`, error);
    return null;
  }
}

async function getEdhrecCommanderRankings(onProgress) {
  const colorPages = Object.keys(EDHREC_COMMANDER_COLOR_PAGES);
  const byName = new Map();
  let done = 0;

  for (const colorPage of colorPages) {
    const data = await fetchEdhrecColorPage(colorPage);
    if (data) {
      for (const entry of extractEdhrecCommanderList(data, colorPage)) {
        const key = normalizeCardName(entry.name);
        const existing = byName.get(key);
        // One identity page per commander, but keep the larger reading rather
        // than trust that.
        if (!existing || entry.decks > existing.decks) byName.set(key, entry);
      }
    }

    done += 1;
    if (onProgress) onProgress(done, colorPages.length);
    await sleep(120);
  }

  return Array.from(byName.values()).sort((a, b) => b.decks - a.decks);
}

// The same pool a build would draw from, theme pages included. Reading only
// the commander page is a request cheaper but measures the wrong thing: it
// found 42 of Krydle's cards in a collection a real build fills 89 from, so
// the tab reported 67% for a deck EDHREC can in fact cover completely. A
// percentage that undercounts by a third is not worth the saved request.
//
// Takes EDHREC's own slug, which the commander lists already carry -- correct
// for partner pairs too, where deriving a slug from names has to guess at the
// ordering.
async function getEdhrecCommanderPool(slug) {
  try {
    const data = await fetchJsonWithTimeout(`${EDHREC_BASE}${slug}.json`, {}, 12000);
    if (!edhrecPayloadHasCards(data)) return null;

    const deduped = new Map();
    collectEdhrecCards(data, deduped);

    for (const themeSlug of pickEdhrecThemeSlugs(data)) {
      const themeData = await fetchEdhrecThemePage(slug, themeSlug);
      if (themeData) collectEdhrecCards(themeData, deduped);
      await sleep(120);
    }

    return {
      cards: Array.from(deduped.values()),
      typeAverages: extractEdhrecTypeAverages(data)
    };
  } catch (error) {
    console.warn(`EDHREC commander page unavailable: ${slug}`, error);
    return null;
  }
}
// In-memory card cache, backed by localStorage so repeat visits skip most
// Scryfall traffic. Persisted entries are trimmed to the fields the builder
// actually reads and capped so the quota is never the failure mode.
//
// Depends on: text.js

// Bumped to v3: DFC/split cards persisted under v2 carry an empty manaCost
// (fixed going forward -- see js/api/scryfall.js's readManaCost and
// js/build/manabase.js's parsePips). A cache hit never re-fetches, so
// falling back to v2 data the way earlier bumps did would keep serving that
// stale, empty manaCost forever for anyone with a warm cache. No fallback to
// v2 (or v1) this time -- a one-time full re-fetch instead.
const CARD_CACHE_STORAGE_KEY = "mtg_commander_builder_card_cache_v3";
const LEGACY_CARD_CACHE_STORAGE_KEYS = [
  "mtg_commander_builder_card_cache_v1",
  "mtg_commander_builder_card_cache_v2"
];
const MAX_PERSISTED_CACHE_ENTRIES = 8000;

const cardCache = new Map();

function trimCardForPersistentCache(card) {
  if (!card || typeof card !== "object") return null;
  return {
    name: card.name || "",
    type: card.type || "",
    rawType: card.rawType || "",
    text: card.text || "",
    rawText: card.rawText || "",
    cmc: Number(card.cmc || 0),
    colors: Array.isArray(card.colors) ? card.colors : [],
    layout: card.layout || "",
    producedMana: Array.isArray(card.producedMana) ? card.producedMana : [],
    imageUrl: card.imageUrl || "",
    manaCost: card.manaCost || "",
    scryfallUrl: card.scryfallUrl || "",
    savedAt: Date.now()
  };
}

function restoreCardFromPersistentCache(value) {
  if (!value || typeof value !== "object") return null;
  if (!value.name) return null;
  return {
    name: String(value.name || ""),
    type: String(value.type || "").toLowerCase(),
    rawType: String(value.rawType || value.type || ""),
    text: String(value.text || value.rawText || "").toLowerCase(),
    rawText: String(value.rawText || value.text || ""),
    cmc: Number(value.cmc || 0),
    colors: Array.isArray(value.colors) ? value.colors : [],
    layout: String(value.layout || "").toLowerCase(),
    producedMana: Array.isArray(value.producedMana) ? value.producedMana : [],
    imageUrl: String(value.imageUrl || ""),
    manaCost: String(value.manaCost || ""),
    scryfallUrl: String(value.scryfallUrl || "")
  };
}

// Scryfall names a two-faced card "Front // Back", but ManaBox CSVs and EDHREC
// both refer to it by its front face alone -- so the card gets cached under a
// key nothing ever looks up, and the front-face key gets marked as a miss.
// Alias the front face too. Covers modal DFCs, transforming cards and
// adventure cards.
//
// Never displaces a genuine single-faced card of the same name: an existing
// truthy entry wins, while a previously-cached miss (null) is replaced.
function indexCardByFrontFace(cache, card) {
  if (!card || !card.name) return;
  const canonical = normalizeCardName(card.name);
  const front = normalizeCardName(getPrimaryCardName(card.name));
  if (!front || front === canonical) return;
  if (cache.get(front)) return;
  cache.set(front, card);
}

// Reads the current payload. Legacy keys are only ever cleaned up here, never
// read as a fallback -- unlike the v1->v2 bump, v2's persisted manaCost for
// DFC/split cards is wrong, not just differently-shaped, so serving it back
// would silently undo the fix that motivated this bump.
function readPersistedCachePayload() {
  for (const key of LEGACY_CARD_CACHE_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }

  return localStorage.getItem(CARD_CACHE_STORAGE_KEY);
}

function hydrateCardCacheFromStorage() {
  try {
    const raw = readPersistedCachePayload();
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    const restored = [];
    for (const entry of parsed) {
      const card = restoreCardFromPersistentCache(entry);
      if (!card) continue;
      restored.push(card);
      cardCache.set(normalizeCardName(card.name), card);
    }

    // Only canonical names are persisted, so re-add the front-face aliases;
    // without this a warm cache would re-fetch every two-faced card.
    for (const card of restored) {
      indexCardByFrontFace(cardCache, card);
    }
  } catch (error) {
    console.warn("Unable to hydrate local card cache.", error);
  }
}

function persistCardCacheToStorage() {
  try {
    const cards = [];
    for (const [, value] of cardCache.entries()) {
      if (!value) continue;
      const trimmed = trimCardForPersistentCache(value);
      if (trimmed) cards.push(trimmed);
    }

    // Freshest first, so whatever gets dropped below is the stalest.
    cards.sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0));

    // The quota is nominally ~5MB but varies by browser and by whatever else
    // this origin has stored, so rather than guess an entry count that always
    // fits, write as many as we can and halve on rejection.
    let count = Math.min(cards.length, MAX_PERSISTED_CACHE_ENTRIES);
    while (count > 0) {
      try {
        localStorage.setItem(CARD_CACHE_STORAGE_KEY, JSON.stringify(cards.slice(0, count)));
        return;
      } catch (error) {
        count = Math.floor(count / 2);
      }
    }

    // Nothing fit. Drop any previous payload rather than leaving a stale one.
    localStorage.removeItem(CARD_CACHE_STORAGE_KEY);
  } catch (error) {
    console.warn("Unable to persist local card cache.", error);
  }
}

// EDHREC's commander rankings are the same for everybody and change only as
// the site's deck counts move, so they are worth keeping across visits. Stored
// apart from the card cache: a different shape, a different lifetime, and a
// quota failure here must not cost the card data.
const COMMANDER_RANKINGS_STORAGE_KEY = "mtg_commander_builder_commander_ranks_v1";
const COMMANDER_RANKINGS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function readPersistedCommanderRankings() {
  try {
    const raw = localStorage.getItem(COMMANDER_RANKINGS_STORAGE_KEY);
    if (!raw) return null;

    const payload = JSON.parse(raw);
    if (!Array.isArray(payload?.rankings) || !payload.rankings.length) return null;
    if (Date.now() - Number(payload.savedAt || 0) > COMMANDER_RANKINGS_MAX_AGE_MS) {
      localStorage.removeItem(COMMANDER_RANKINGS_STORAGE_KEY);
      return null;
    }

    return payload.rankings;
  } catch (error) {
    console.warn("Unable to read cached commander rankings.", error);
    return null;
  }
}

function persistCommanderRankings(rankings) {
  try {
    localStorage.setItem(
      COMMANDER_RANKINGS_STORAGE_KEY,
      JSON.stringify({ savedAt: Date.now(), rankings })
    );
  } catch (error) {
    // Rankings are cheap to refetch; the card cache is not. Leave its quota
    // alone rather than trimming to make these fit.
    console.warn("Unable to persist commander rankings.", error);
  }
}
// Scryfall access: single-card lookups, autocomplete, and the batched
// collection endpoint used to hydrate an entire uploaded CSV.
//
// Depends on: cache.js, constants.js, http.js, text.js, themes.js

function pickCommanderImage(data) {
  if (data.image_uris?.normal) return data.image_uris.normal;
  if (Array.isArray(data.card_faces)) {
    for (const face of data.card_faces) {
      if (face.image_uris?.normal) return face.image_uris.normal;
    }
  }
  return "";
}

// Two-faced cards carry no top-level oracle_text -- the rules text lives on
// each entry of card_faces. Join them so text-based detection (roles, tags,
// themes, commander pairing) sees the whole card rather than nothing at all.
function readOracleText(data) {
  if (data?.oracle_text) return String(data.oracle_text);
  if (!Array.isArray(data?.card_faces)) return "";
  return data.card_faces
    .map((face) => String(face?.oracle_text || ""))
    .filter(Boolean)
    .join("\n");
}

// Transform/modal-DFC layouts carry no top-level mana_cost -- it's on
// card_faces[0] instead (the front face, the one you'd actually list in a
// decklist and cast from hand). Split-layout cards DO have a top-level
// mana_cost, but it's both halves joined with " // " (e.g. "{2}{R} // {1}{R}")
// -- that string is handled by parsePips itself (manabase.js), which only
// reads the first half, since a split card is cast as one side, not both.
function readManaCost(data) {
  if (data?.mana_cost) return String(data.mana_cost);
  if (!Array.isArray(data?.card_faces)) return "";
  return String(data.card_faces[0]?.mana_cost || "");
}

function convertScryfallCard(data) {
  const producedMana =
    Array.isArray(data.produced_mana) ? data.produced_mana :
    Array.isArray(data.color_identity) ? data.color_identity :
    [];

  const oracleText = readOracleText(data);

  return {
    name: data.name,
    type: String(data.type_line || "").toLowerCase(),
    rawType: String(data.type_line || ""),
    text: oracleText.toLowerCase(),
    rawText: oracleText,
    cmc: Number(data.cmc || 0),
    colors: Array.isArray(data.color_identity) ? data.color_identity : [],
    layout: String(data.layout || "").toLowerCase(),
    producedMana,
    imageUrl: pickCommanderImage(data),
    manaCost: readManaCost(data),
    scryfallUrl: data.scryfall_uri || "",
    raw: data
  };
}

async function fetchScryfallCardByName(cardName) {
  const cleaned = cleanCardNameForLookup(cardName);
  if (!cleaned) throw new Error("Missing card name for Scryfall lookup.");

  let response = await fetch(`${SCRYFALL_NAMED}${encodeCardNameForScryfall(cleaned)}`);
  if (response.ok) return await response.json();

  response = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeCardNameForScryfall(cleaned)}`);
  if (response.ok) return await response.json();

  throw new Error(`Scryfall lookup failed for ${cardName}`);
}

async function getCommander(name) {
  try {
    const data = await fetchScryfallCardByName(name);
    return convertScryfallCard(data);
  } catch (error) {
    console.warn("Commander lookup failed", name, error);
    return null;
  }
}

async function fetchCommanderAutocomplete(query) {
  const response = await fetch(`${SCRYFALL_AUTOCOMPLETE}${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error("Autocomplete request failed.");
  const data = await response.json();
  return Array.isArray(data.data) ? data.data.slice(0, 12) : [];
}

// The map callers get back is keyed by the names their CSV used, but EDHREC
// names a two-faced card by its front face alone, so it has to answer to that
// spelling too.
function collectCachedCards(uniqueNames) {
  const results = new Map();

  for (const name of uniqueNames) {
    const cached = cardCache.get(name);
    if (cached) results.set(name, cached);
  }

  for (const card of Array.from(results.values())) indexCardByFrontFace(results, card);

  return results;
}

async function fetchCardDataBatchWithProgress(cardNames, progressCallback) {
  const uniqueNames = Array.from(new Set(cardNames.map(normalizeCardName)));
  const missingNames = uniqueNames.filter((name) => !cardCache.has(name));
  const total = missingNames.length;
  let done = 0;

  if (total === 0) {
    if (progressCallback) progressCallback(0, 0);
    return collectCachedCards(uniqueNames);
  }

  const chunkSize = 75;
  const chunks = [];
  for (let i = 0; i < missingNames.length; i += chunkSize) {
    chunks.push(missingNames.slice(i, i + chunkSize));
  }

  async function fetchChunk(chunk, attempt = 1) {
    // The collection endpoint has no entry under "Front // Back" -- that
    // spelling comes back in not_found, so asking with the name a ManaBox CSV
    // uses drops every two-faced card in the collection. The front face alone
    // resolves to the whole card.
    const identifiers = chunk.map((name) => ({ name: cleanCardNameForLookup(name) }));

    try {
      const response = await fetch(SCRYFALL_COLLECTION, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers })
      });

      if (!response.ok) {
        throw new Error(`Scryfall collection request failed with status ${response.status}.`);
      }

      const data = await response.json();
      const returnedCards = Array.isArray(data.data) ? data.data : [];

      const convertedCards = returnedCards.map((rawCard) => convertScryfallCard(rawCard));

      for (const converted of convertedCards) {
        cardCache.set(normalizeCardName(converted.name), converted);
      }

      // Separate pass, so a genuine single-faced card is always cached before
      // any front-face alias could claim its name.
      for (const converted of convertedCards) {
        indexCardByFrontFace(cardCache, converted);
      }

      for (const requestedName of chunk) {
        if (!cardCache.has(requestedName)) cardCache.set(requestedName, null);
      }
    } catch (error) {
      if (attempt < 4) {
        const waitMs = 300 * attempt;
        console.warn(`Retrying Scryfall chunk (${attempt}) after failure.`, error);
        await sleep(waitMs);
        return fetchChunk(chunk, attempt + 1);
      }

      console.warn("Scryfall chunk failed after retries; marking cards as unavailable.", error);
      for (const requestedName of chunk) {
        if (!cardCache.has(requestedName)) cardCache.set(requestedName, null);
      }
    }
  }

  for (const chunk of chunks) {
    await fetchChunk(chunk);
    done += chunk.length;
    if (progressCallback) progressCallback(done, total);
    await sleep(120);
  }

  persistCardCacheToStorage();

  return collectCachedCards(uniqueNames);
}

// A tag matching more of the format than this is describing Magic rather than
// a deck theme. Measured against a color identity, the two worst offenders --
// triggered-ability and activated-ability -- sit at 6,235 and 4,510, while the
// broadest genuine theme, five-color burn, reaches 3,028. One page of a
// mechanic tag is just the format's most-played staples, which is precisely the
// generic filler the theme gate exists to keep out.
const SCRYFALL_THEME_TAG_MAX_CARDS = 3500;

// Cards carrying one functional tag, within a color identity.
//
// A 404 means Scryfall has no tag by that name. That is the expected answer for
// most candidates getScryfallThemeTags proposes, so it is not worth reporting.
//
// order=edhrec matters: a tag can match thousands of cards, and one page of the
// most-played beats one page of the alphabetically first.
async function fetchScryfallTaggedCardNames(tag, identity) {
  const query = `otag:${tag} identity<=${identity}`;
  const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&order=edhrec&unique=cards`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    if (Number(data.total_cards || 0) > SCRYFALL_THEME_TAG_MAX_CARDS) return [];

    return Array.isArray(data.data) ? data.data.map((card) => card.name).filter(Boolean) : [];
  } catch (error) {
    console.warn(`Scryfall tag lookup failed for "${tag}".`, error);
    return [];
  }
}

// Scryfall's functional tags (otag:) are curated by hand rather than derived
// from card text, so they see what a text search cannot: otag:landfall returns
// 174 Gruul cards where oracle:landfall returns 120, the difference being cards
// that trigger on a land entering without ever using the word.
//
// Only consulted for themes local text matching could not answer. EDHREC's name
// for a theme is rarely Scryfall's name for the tag, so several spellings are
// tried in turn -- see getScryfallThemeTags. The first that returns anything
// wins; a theme Scryfall has no tag for costs a handful of 404s and falls
// through to the EDHREC theme-page fingerprint.
async function fetchScryfallThemeCardNames(theme, commanderColors) {
  const identity = commanderColors.length ? commanderColors.join("") : "c";

  for (const tag of getScryfallThemeTags(theme)) {
    const names = await fetchScryfallTaggedCardNames(tag, identity);
    if (names.length) return names;
  }

  return [];
}
// Deck-shape counting. Shared by the build planner (which needs to know how
// full each type bucket is) and the report/chart renderers.

function getDeckTypeBucket(typeLine) {
  const type = String(typeLine || "").toLowerCase();
  if (type.includes("land")) return "Land";
  if (type.includes("creature")) return "Creature";
  if (type.includes("instant")) return "Instant";
  if (type.includes("sorcery")) return "Sorcery";
  if (type.includes("planeswalker")) return "Planeswalker";
  if (type.includes("battle")) return "Other";
  if (type.includes("enchantment")) return "Enchantment";
  if (type.includes("artifact")) return "Artifact";
  return "Other";
}

function countByType(deck) {
  const counts = {
    Land: 0,
    Creature: 0,
    Instant: 0,
    Sorcery: 0,
    Artifact: 0,
    Enchantment: 0,
    Planeswalker: 0,
    Other: 0
  };

  for (const card of deck || []) {
    const bucket = getDeckTypeBucket(card.type || card.type_line || "");
    counts[bucket] += 1;
  }

  return counts;
}

function averageManaValue(deck) {
  const spells = (deck || []).filter((card) => !String(card.type || card.type_line || "").toLowerCase().includes("land"));
  if (!spells.length) return "0";
  const total = spells.reduce((sum, card) => sum + (Number(card.cmc) || Number(card.mana_value) || 0), 0);
  return String(Math.round(total / spells.length));
}

// EDHREC's support-package numbers, with the defaults the builder falls back to
// when a commander's page does not report one. Shared with buildDeckFromScoredPool
// so the report shows the targets the deck was actually built against.
function normalizeRoleTargets(edhrecRoleTargets) {
  return {
    ramp: Math.round(Number(edhrecRoleTargets?.ramp) || 10),
    draw: Math.round(Number(edhrecRoleTargets?.draw) || 10),
    removal: Math.round(Number(edhrecRoleTargets?.removal) || 8),
    wipe: Math.round(Number(edhrecRoleTargets?.wipe) || 3)
  };
}

// Two readings of the same deck.
//
// `primary` is the role the builder assigned each card, one apiece, so the four
// numbers are exclusive and add up. `total` credits every job a card does, so
// the numbers overlap: a removal spell that draws appears under both, and a
// board wipe that draws is counted as a wipe here where its primary role is
// draw. The gap between the two is the deck's double duty.
//
// Reads the precomputed `roles` field addCard (deck.js) attaches to every
// entry, rather than calling getRoleContributions(card) here. A deck entry
// carries only name/type/cmc/colors/score -- never oracle text -- so that call
// would silently return [] for every card and `total` would sit at zero for
// every role. `roles` is resolved once, against the real collection record, at
// the only point the build still has that record in scope.
function getSupportPackageCounts(deck) {
  const counts = {};
  for (const role of SUPPORT_ROLES) counts[role] = { primary: 0, total: 0 };

  for (const card of deck || []) {
    if (card.role === "land") continue;
    if (counts[card.role]) counts[card.role].primary += 1;
    for (const role of card.roles || []) counts[role].total += 1;
  }

  return counts;
}
// Bracket estimation and structural warnings.
//
// The bracket comes from the criteria the official system names -- Game
// Changers, mass land denial, chained extra turns, two-card combos, heavy
// tutoring -- each acting as a floor on the result. It is not a power score:
// brackets 1 and 2 are defined by what a deck does not do, and summing the
// things a good deck does have cannot express that.
//
// Depends on: cards.js, deck-stats.js, text.js, themes.js

function getBracketLabel(bracket) {
  const labels = {
    1: "Bracket 1 — Exhibition",
    2: "Bracket 2 — Core",
    3: "Bracket 3 — Upgraded",
    4: "Bracket 4 — Optimized",
    5: "Bracket 5 — cEDH"
  };
  return labels[bracket] || "Unknown";
}

// commanderNames accepts a single name or, for a partnered deck, both.
function detectGameChangers(deck, commanderNames) {
  const detected = [];
  const seen = new Set();

  const leaders = Array.isArray(commanderNames) ? commanderNames : [commanderNames];
  const allNames = [...leaders.filter(Boolean), ...deck.map((c) => c.name)];
  for (const name of allNames) {
    const normalized = normalizeCardName(name);
    if (isGameChanger(name) && !seen.has(normalized)) {
      detected.push(name);
      seen.add(normalized);
    }
  }

  return detected.sort((a, b) => a.localeCompare(b));
}

function estimateDeckBracket(deck, commanderThemes, commanderColors, commanderNames) {
  const names = deck.map((c) => normalizeCardName(c.name));
  const nonlands = deck.filter((c) => c.role !== "land");

  // By contribution, not by a card's single primary role -- the same reading
  // Phase 0 itself used to decide the deck was done drafting for each role.
  // A card whose primary role is "draw" still counts here if its text also
  // reads as removal (a counterspell that also cantrips, say), matching what
  // the builder actually built rather than detectRole's first-match label.
  const roleCounts = getSupportPackageCounts(deck);
  const rampCount = roleCounts.ramp.total;
  const drawCount = roleCounts.draw.total;
  const removalCount = roleCounts.removal.total;
  const wipeCount = roleCounts.wipe.total;

  const avgCmc =
    nonlands.length > 0
      ? nonlands.reduce((sum, c) => sum + (c.cmc || 0), 0) / nonlands.length
      : 0;

  const fastManaCards = [
    "sol ring", "mana crypt", "chrome mox", "mox diamond", "jeweled lotus", "mana vault", "grim monolith", "lotus petal"
  ];

  const tutorCards = [
    "demonic tutor", "vampiric tutor", "imperial seal", "worldly tutor", "enlightened tutor",
    "mystical tutor", "gamble", "diabolic intent", "eladamri's call", "green sun's zenith",
    "finale of devastation", "crop rotation"
  ];

  const extraTurnCards = [
    "time warp", "temporal manipulation", "capture of jingzhou", "nexus of fate", "time stretch", "expropriate"
  ];

  const massLandDenialCards = [
    "armageddon", "ravages of war", "ruination", "winter orb", "blood moon", "magus of the moon", "sunder"
  ];

  const compactComboCards = [
    "thassa's oracle", "underworld breach", "ad nauseam", "protean hulk", "bolas's citadel", "dockside extortionist", "food chain"
  ];

  // A Game Changer is counted as a Game Changer and nothing else. Four cards
  // sit on both the official list and one of the lists above -- Vampiric and
  // Worldly Tutor, Thassa's Oracle, Underworld Breach -- and counting them
  // twice overstated the very decks the gates below already catch.
  const gameChangers = detectGameChangers(deck, commanderNames);
  const gameChangerKeys = new Set(gameChangers.map((name) => normalizeCardName(name)));
  const countExcludingGameChangers = (list) =>
    names.filter((n) => list.includes(n) && !gameChangerKeys.has(n)).length;

  const fastManaCount = countExcludingGameChangers(fastManaCards);
  const tutorCount = countExcludingGameChangers(tutorCards);
  const extraTurnCount = countExcludingGameChangers(extraTurnCards);
  const massLandDenialCount = countExcludingGameChangers(massLandDenialCards);
  const compactComboCount = countExcludingGameChangers(compactComboCards);
  const gameChangerCount = gameChangers.length;

  // Brackets are decided by the criteria the official system names, not by a
  // weighted score. Brackets 1 and 2 are defined by what a deck does NOT do,
  // so a sum of desirable-deck qualities can only drift from them: the support
  // package this builder deliberately fills used to contribute 7.45 of a 8.95
  // total, which read every honest Core deck as Optimized.
  const gates = [];
  let bracket = 2;

  function requireAtLeast(minimum, reason) {
    if (bracket < minimum) bracket = minimum;
    gates.push(reason);
  }

  // Nothing below 4 may run mass land denial or chain extra turns, and a
  // two-card infinite combo is allowed at 3 only when it cannot come online
  // early. Nothing in the card data says when a combo assembles, so any pair
  // is treated as the stricter case.
  if (massLandDenialCount > 0) requireAtLeast(4, `mass land denial: ${massLandDenialCount}`);
  if (extraTurnCount >= 2) requireAtLeast(4, `extra turns that can chain: ${extraTurnCount}`);
  if (compactComboCount >= 2) requireAtLeast(4, `two-card combo pieces: ${compactComboCount}`);
  if (gameChangerCount > 3) requireAtLeast(4, `more than three game changers: ${gameChangerCount}`);
  else if (gameChangerCount > 0) requireAtLeast(3, `game changers: ${gameChangerCount}`);

  // Core expects few tutors; past a handful the deck is playing a different
  // game even with no Game Changer in it. Most of the named tutors are
  // themselves Game Changers and were counted above, so in practice this fires
  // only for the handful that are not -- Diabolic Intent, Eladamri's Call,
  // Green Sun's Zenith, Finale of Devastation.
  if (tutorCount >= 3) requireAtLeast(3, `heavy tutoring: ${tutorCount}`);

  // Exhibition is a deliberate choice rather than an accident, so it takes a
  // deck with no acceleration, no selection, no combo, and a curve saying that
  // winning is not the point.
  const powerCardCount =
    fastManaCount + tutorCount + extraTurnCount +
    massLandDenialCount + compactComboCount + gameChangerCount;

  if (powerCardCount === 0 && avgCmc > 3.2 && removalCount + wipeCount < 6) {
    bracket = 1;
    gates.push("no accelerants, tutors or combos, and a slow curve");
  }

  // Bracket 5 is never assigned here: cEDH is a statement about the table a
  // deck is built for, and no card list settles it.

  // Kept for the build log and for ordering two decks that land in the same
  // bracket. It decides nothing, and it ignores the support package.
  const score = Number((
    fastManaCount * 1.5 +
    tutorCount * 1.25 +
    extraTurnCount * 1.5 +
    massLandDenialCount * 2 +
    compactComboCount * 2 +
    gameChangerCount * 2
  ).toFixed(2));

  const reasons = [];
  if (gates.length) reasons.push(...gates);
  else reasons.push("no game changers, mass land denial, extra-turn chain or two-card combo");
  if (fastManaCount) reasons.push(`fast mana: ${fastManaCount}`);
  if (extraTurnCount === 1) reasons.push("one extra-turn spell, which cannot chain");
  if (compactComboCount === 1) reasons.push("one combo piece, no pair");
  reasons.push(`avg CMC: ${avgCmc.toFixed(2)}`);
  reasons.push(`ramp/draw/removal/wipes (by contribution): ${rampCount}/${drawCount}/${removalCount}/${wipeCount}`);

  return {
    bracket,
    label: getBracketLabel(bracket),
    score,
    reasons,
    gameChangers,
    roleCounts
  };
}

function generateWarnings(deck, commanderThemes, bracketInfo) {
  const warnings = [];
  const creatures = deck.filter((c) => getCardType(c).includes("creature")).length;
  // By contribution (estimateDeckBracket already computed this once) rather
  // than a card's single primary role -- see the comment there.
  const ramp = bracketInfo.roleCounts.ramp.total;
  const draw = bracketInfo.roleCounts.draw.total;
  const removal = bracketInfo.roleCounts.removal.total;
  const wipes = bracketInfo.roleCounts.wipe.total;
  const basics = deck.filter((c) => c.source === "basic-land").length;
  const nonbasics = deck.filter((c) => c.source === "nonbasic-land").length;
  const fallbackCards = deck.filter((c) => c.source === "fallback-theme" || c.source === "fallback-generic").length;
  const nonlandCount = deck.filter((c) => c.role !== "land").length;

  // Backfilling from the collection is what this builder is for, so only flag
  // it once it dominates. Measured as a share, because the nonland total moves
  // with the land count.
  const fallbackShare = fallbackCards / Math.max(nonlandCount, 1);

  if (getCommanderTribalThemes(commanderThemes).length && creatures < 22) {
    warnings.push("Low creature count for a tribal deck.");
  }
  if (commanderHasTheme(commanderThemes, "gowide") && creatures < 20) {
    warnings.push("Go-wide strategy may be light on creatures or token bodies.");
  }
  if (ramp < 8) warnings.push("Ramp count is on the low side.");
  if (draw < 8) warnings.push("Card draw count is on the low side.");
  if (removal < 6) warnings.push("Interaction count may be low.");
  if (wipes < 2 && bracketInfo.bracket >= 3) warnings.push("Only a small number of board wipes found.");
  if (nonbasics > basics * 1.5 && basics < 10) warnings.push("Mana base may still be a bit too greedy on nonbasics.");
  if (fallbackShare >= 0.6) warnings.push("Most of this deck came from collection theme-matching rather than EDHREC overlap — your collection has few of this commander's staples.");
  if (bracketInfo.gameChangers.length >= 4) warnings.push("This build contains several Game Changers and may read stronger than expected at casual tables.");

  return warnings;
}
// Mana base construction.
//
// Nonbasics are scored and capped by color count (a mono-color deck gets very
// few, a five-color deck gets many), then basics fill the remainder, always
// topping up whichever color has the fewest sources so far.
//
// Depends on: cards.js, constants.js, csv.js, edhrec.js, scoring.js, text.js

const COLORED_MANA_SYMBOLS = ["W", "U", "B", "R", "G"];

const BASIC_LAND_SUBTYPE_COLORS = {
  plains: "W",
  island: "U",
  swamp: "B",
  mountain: "R",
  forest: "G"
};

// Costs that make a mana ability something you can only reach occasionally:
// an extra payment, a one-shot sacrifice, a counter you run out of. Paying
// life is deliberately absent -- it doesn't limit how often the land fixes,
// and the scorer already docks a little for it.
const GATED_ACTIVATION_MARKERS = ["sacrifice", "discard", "exile", "remove", "reveal", "return", "pay"];

function isFreeManaActivation(cost) {
  const cleaned = cost.replace(/[()]/g, "").replace(/pay \d+ life/g, "");
  if (GATED_ACTIVATION_MARKERS.some((marker) => cleaned.includes(marker))) return false;

  // Anything beyond tapping -- generic mana, energy, a snow symbol -- is a cost.
  const symbols = cleaned.match(/\{[^}]*\}/g) || [];
  return symbols.every((symbol) => symbol === "{t}");
}

function readAddedManaColors(effect) {
  const colors = new Set();

  for (const symbol of effect.match(/\{([wubrg])\}/g) || []) {
    colors.add(symbol.replace(/[{}]/g, "").toUpperCase());
  }

  // Covers "one mana of any color" and "any type that a land you control
  // could produce".
  if (effect.includes("mana of any color") || effect.includes("mana of any type")) {
    for (const color of COLORED_MANA_SYMBOLS) colors.add(color);
  }

  return colors;
}

// Scryfall's produced_mana is the union of every color a card could ever add,
// whatever that costs -- so a land that taps for {C} and converts to any color
// for {1} still reports all five. Reading that union as "colors this land
// makes" ranks slow filter lands above real dual lands, so read the mana
// abilities out of the rules text instead and keep the ones a bare {T} pays
// for apart from the ones sitting behind a cost.
//
// Returns:
//   reliable    -- colors a plain tap produces, every turn
//   conditional -- colors only reachable by paying something extra
//   flexible    -- count of "add one mana of the chosen color" taps, which
//                  make exactly one color but not a knowable one
//   freeAnyColor / freeAnyType -- an untaxed any-color ability, worth a bonus
function getLandManaProfile(card) {
  const text = getCardText(card);
  const reliable = new Set();
  const conditional = new Set();
  let flexible = 0;
  let freeAnyColor = false;
  let freeAnyType = false;
  let sawManaAbility = false;

  // A typed dual ("Land - Plains Island") carries its mana abilities in the
  // type line, and Scryfall renders them only as parenthesized reminder text.
  for (const [subtype, color] of Object.entries(BASIC_LAND_SUBTYPE_COLORS)) {
    if (getCardType(card).includes(subtype)) reliable.add(color);
  }

  for (const line of text.split("\n")) {
    const split = line.indexOf(":");
    if (split === -1) continue;

    const cost = line.slice(0, split);
    const effect = line.slice(split + 1);
    if (!effect.includes("add")) continue;

    sawManaAbility = true;
    const colors = readAddedManaColors(effect);

    // "Spend this mana only to cast artifact spells" is mana the deck mostly
    // can't cast with, so it counts the same as mana behind a cost.
    const free = isFreeManaActivation(cost) && !effect.includes("spend this mana only");

    if (effect.includes("of the chosen color")) {
      if (free) flexible += 1;
    }

    if (free) {
      for (const color of colors) reliable.add(color);
      if (effect.includes("mana of any color")) freeAnyColor = true;
      if (effect.includes("mana of any type")) freeAnyType = true;
    } else {
      for (const color of colors) conditional.add(color);
    }
  }

  // A "sacrifice this land: search your library for a basic Swamp, Mountain,
  // or Forest card" effect (Jund Panorama, Grasslands, Krosan Verge...), or the
  // untyped "search your library for a basic land card" (Evolving Wilds,
  // Terramorphic Expanse, Ash Barrens), never says "add" -- it doesn't produce
  // mana itself, it becomes a different land -- so the loop above never sees
  // it. Scanned separately here, one line at a time to match how the loop
  // above is already scoped, so an unrelated ability elsewhere on the card
  // can't attach a color this clause never named.
  //
  // A typed fetch is filed as reliable, the same as a typed dual, not
  // conditional: "reliable" already means "any one of these colors, your
  // choice" rather than "all of them at once" -- a Land - Forest Island
  // doesn't tap for both simultaneously either. Once one of these cracks it
  // behaves exactly like a basic forever after, which is the same guarantee a
  // dual gives, just decided once at crack time instead of re-decided every
  // turn. An untyped fetch is filed as flexible instead, one slot more
  // permissive than a typed one -- it can become any of the deck's colors, not
  // a fixed subset, the same shape "add one mana of the chosen color" already
  // gets credit for above. What a dual does NOT cost that either of these does
  // is a real activation: mana plus sacrificing the land itself, and usually a
  // tapped basic at the end of it. searchesForBasics flags that, so
  // evaluateNonbasicLand can charge for the setup instead of silently
  // pretending it is free.
  //
  // Measured against this collection: 13 owned nonbasic lands carry one of
  // these two effects (Obscura Storefront, Grasslands, Krosan Verge, Jund
  // Panorama, Naya Panorama, Sheltering Landscape, Riveteers Overlook typed;
  // Ash Barrens, Evolving Wilds, Terramorphic Expanse, Warped Landscape,
  // Myriad Landscape, Blighted Woodland untyped), and every one of them scored
  // zero relevant colors and ate evaluateNonbasicLand's flat -20 no-fixing
  // penalty, regardless of how well the fetched types matched the deck.
  let searchesForBasics = false;
  for (const line of text.split("\n")) {
    if (!line.includes("search your library for")) continue;

    let namedType = false;
    for (const [subtype, color] of Object.entries(BASIC_LAND_SUBTYPE_COLORS)) {
      if (line.includes(subtype)) {
        reliable.add(color);
        namedType = true;
      }
    }
    if (namedType) {
      searchesForBasics = true;
      continue;
    }

    // Evolving Wilds, Terramorphic Expanse, Ash Barrens: "search your library
    // for a basic land card", no type named at all. This is strictly more
    // flexible than a typed fetch -- any of the deck's colors, not a fixed
    // subset -- which is exactly what `flexible` already models for a "mana of
    // the chosen color" tap. Two lands (Myriad Landscape, Blighted Woodland)
    // fetch up to two; Myriad Landscape's must share a type, so it only ever
    // realizes one color despite touching two cards.
    if (line.includes("basic land card")) {
      searchesForBasics = true;
      if (line.includes("two basic land cards") && !line.includes("share a")) flexible += 2;
      else flexible += 1;
    }
  }

  // No parsable ability at all: trust produced_mana rather than call the land
  // colorless. Filter lands always print their ability, so this only catches
  // cards whose mana comes from somewhere the text doesn't spell out.
  if (!sawManaAbility && !reliable.size) {
    const direct = Array.isArray(card?.producedMana) ? card.producedMana : [];
    for (const color of direct) {
      const upper = String(color || "").toUpperCase();
      if (COLORED_MANA_SYMBOLS.includes(upper)) reliable.add(upper);
    }
  }

  for (const color of reliable) conditional.delete(color);

  return {
    reliable: sortColorsWubrg(Array.from(reliable)),
    conditional: sortColorsWubrg(Array.from(conditional)),
    flexible,
    freeAnyColor,
    freeAnyType,
    searchesForBasics
  };
}

// Scaled so a land half of this commander's decks play clearly outranks an
// unranked tapped dual (~10) and a taxed any-color land (~16), while a land
// almost nobody plays adds close to nothing.
//
// The rate itself comes from getEdhrecInclusionRate in edhrec.js. Lands
// deliberately ignore `synergy`: it measures how much *more* than baseline a
// card shows up, and the best lands are baseline by definition, so it reads
// negative for exactly the lands worth playing (Watery Grave -0.21).
const EDHREC_LAND_INCLUSION_WEIGHT = 30;

// Pip counting for the mana-base math below. Generic numbers and {X} are
// deliberately excluded -- they never force a specific color, so they carry
// no color requirement to plan a land base around.
function parsePips(manaCost) {
  const pips = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  // A split card's mana_cost is both halves joined with " // " (you cast one
  // side, not both) -- count only the first half so the two costs don't sum
  // as if the card required both simultaneously.
  const firstCost = String(manaCost || "").split("//")[0];
  const symbols = firstCost.match(/\{[^}]+\}/g) || [];

  for (const symbol of symbols) {
    const inner = symbol.slice(1, -1);
    if (!inner.includes("/")) {
      if (Object.prototype.hasOwnProperty.call(pips, inner)) pips[inner] += 1;
      continue;
    }

    const parts = inner.split("/");
    const isPhyrexian = parts.includes("P");
    const colorParts = parts.filter((part) => Object.prototype.hasOwnProperty.call(pips, part));
    if (colorParts.length === 0) continue;

    if (isPhyrexian) {
      for (const color of colorParts) pips[color] += 1;
    } else {
      for (const color of colorParts) pips[color] += 1 / colorParts.length;
    }
  }

  return pips;
}

// Land count, estimated once before any card is picked. The estimate has to
// come from the candidate pool rather than the deck itself, because the
// nonland slot count (deckSize - landCount) has to exist before picking can
// start -- see the design doc's "Non-goals" for why this stays single-pass.
function estimateLandCount(candidatePool, commanderColors, roleTargets) {
  const sorted = [...candidatePool].sort((a, b) => (b.score || 0) - (a.score || 0));
  const sample = sorted.slice(0, Math.min(160, sorted.length));

  let totalPips = 0;
  for (const card of sample) {
    const pips = parsePips(card.manaCost);
    for (const color of commanderColors) totalPips += pips[color] || 0;
  }
  const pipIntensity = sample.length ? totalPips / sample.length : 0;

  const rampTarget = Number(roleTargets?.ramp) || 10;
  const baseline = recommendLandCount(commanderColors);
  const raw = baseline + Math.round(pipIntensity * 2) - Math.round((rampTarget - 10) / 3);

  return Math.max(35, Math.min(42, raw));
}

// Blends the pip-based estimate with EDHREC's own reported average, when it
// has one. The pip estimate is the primary land-count basis (see the design
// doc); edhrecTypeAverages.Land, floor/ceiling corrected to [38, 42] the same
// way it always needed (EDHREC's raw average runs land-light in practice --
// see the comment on estimateLandCount above), is now only a sanity bound:
// it keeps a wild pip estimate within 2 lands of what real decks for this
// commander run, rather than overriding it outright.
function resolveLandCount(pipEstimate, edhrecTypeAverages) {
  if (!Number(edhrecTypeAverages?.Land)) return pipEstimate;
  const edhrecLand = Math.max(38, Math.min(42, Math.round(Number(edhrecTypeAverages.Land))));
  return Math.max(edhrecLand - 2, Math.min(edhrecLand + 2, pipEstimate));
}

// Per-color land-source targets, computed from the deck's actual picked
// nonland cards (not an estimate -- by the time this runs, the deck is
// already built). Replaces buildBasicManaBase's old "fewest sources so far"
// identity-only balance with one weighted by real pip counts.
function computeColorSourceTargets(nonlandDeckCards, commanderColors, landCount) {
  const targets = {};
  if (commanderColors.length === 0) return targets;

  const pipTotals = {};
  for (const color of commanderColors) pipTotals[color] = 0;

  for (const card of nonlandDeckCards) {
    const pips = parsePips(card.manaCost);
    for (const color of commanderColors) pipTotals[color] += pips[color] || 0;
  }

  const grandTotal = commanderColors.reduce((sum, color) => sum + pipTotals[color], 0);

  if (grandTotal <= 0) {
    const even = Math.floor(landCount / commanderColors.length);
    let assigned = 0;
    for (const color of commanderColors) {
      targets[color] = even;
      assigned += even;
    }
    let i = 0;
    while (assigned < landCount) {
      targets[commanderColors[i % commanderColors.length]] += 1;
      assigned += 1;
      i += 1;
    }
    return targets;
  }

  // Any color that appears at all is guaranteed enough sources to actually
  // be castable, even if its pip share is small (a one-card splash). The
  // flat 12%-of-landCount minimum is thin for a 2- or 3-color identity: a
  // commander that costs, say, {1}{B}{R} needs both colors reliably every
  // game, but a deck whose 60 nonland spells happen to skew hard toward one
  // of them can otherwise starve the other down to that flat minimum even
  // though it's a primary color, not a splash (see the harness comparison
  // that caught this -- tools/jxa-harness/compare_report.md). Scale a second
  // floor down as more colors compete for the same landCount (so a 5-color
  // splash color still gets much less than a primary one, same as before),
  // but up when there are few colors sharing it, and take the stronger of
  // the two.
  const splashFloor = Math.max(
    8,
    Math.round(0.12 * landCount),
    Math.round(landCount / (commanderColors.length + 0.5))
    // (tuned empirically against tools/jxa-harness/compare.js: +1 recovered
    // about half of Rivaz's regression, +0.5 recovered nearly all of it
    // while leaving Krydle's already-clean result unchanged)
  );
  const floored = {};
  let flooredTotal = 0;
  for (const color of commanderColors) {
    floored[color] = pipTotals[color] > 0 ? splashFloor : 0;
    flooredTotal += floored[color];
  }

  // Enough colors can each demand the splash floor that the floors alone
  // overflow landCount (a 5-color deck at a 35-land count: 5 x 8 = 40 > 35).
  // The fixup loop below only ever reduces a target back down to its own
  // floor, never below it, so if the floors themselves don't fit, nothing
  // after this point could recover -- scale every floor down proportionally
  // right here instead, using a largest-remainder fixup to land on exactly
  // landCount.
  if (flooredTotal > landCount) {
    const scale = landCount / flooredTotal;
    const scaled = {};
    let scaledTotal = 0;
    for (const color of commanderColors) {
      scaled[color] = floored[color] > 0 ? Math.max(1, Math.floor(floored[color] * scale)) : 0;
      scaledTotal += scaled[color];
    }

    const scaledOrder = commanderColors
      .filter((color) => floored[color] > 0)
      .sort((a, b) => pipTotals[b] - pipTotals[a]);
    let j = 0;
    while (scaledTotal < landCount && scaledOrder.length) {
      scaled[scaledOrder[j % scaledOrder.length]] += 1;
      scaledTotal += 1;
      j += 1;
    }
    j = 0;
    let downGuard = landCount * 4;
    while (scaledTotal > landCount && scaledOrder.length && downGuard-- > 0) {
      const color = scaledOrder[j % scaledOrder.length];
      if (scaled[color] > 1) {
        scaled[color] -= 1;
        scaledTotal -= 1;
      }
      j += 1;
    }

    return scaled;
  }

  const remaining = Math.max(0, landCount - flooredTotal);
  let assigned = 0;
  for (const color of commanderColors) {
    const share = pipTotals[color] / grandTotal;
    targets[color] = floored[color] + Math.round(share * remaining);
    assigned += targets[color];
  }

  // Rounding fixups so targets always sum to exactly landCount. Adjust the
  // heaviest-pip colors first -- they have the most room above their floor.
  const order = [...commanderColors].sort((a, b) => pipTotals[b] - pipTotals[a]);
  let guard = landCount * 4;
  let i = 0;
  while (assigned > landCount && guard-- > 0) {
    const color = order[i % order.length];
    if (targets[color] > floored[color]) {
      targets[color] -= 1;
      assigned -= 1;
    }
    i += 1;
  }
  i = 0;
  while (assigned < landCount) {
    targets[order[i % order.length]] += 1;
    assigned += 1;
    i += 1;
  }

  return targets;
}

function recommendLandCount(commanderColors) {
  if (commanderColors.length === 0) return 38;
  if (commanderColors.length === 1) return 36;
  if (commanderColors.length === 2) return 37;
  return 38;
}

function evaluateNonbasicLand(card, commanderColors, strategyProfile, modePrefs, edhrecCardLookup = null, colorTargets = null) {
  if (!getCardType(card).includes("land")) return null;
  if (isBasicLand(card.name)) return null;

  const mana = getLandManaProfile(card);
  const relevantReliable = mana.reliable.filter((c) => commanderColors.includes(c));
  const relevantConditional = mana.conditional.filter((c) => commanderColors.includes(c));
  const normalizedName = normalizeCardName(card.name);
  const text = getCardText(card);

  // A "choose a color" tap is one real source, but only for a color the deck
  // still needs -- it can't cover two at once.
  const flexibleSources = Math.min(
    mana.flexible,
    Math.max(0, commanderColors.length - relevantReliable.length)
  );
  const reliableSources = relevantReliable.length + flexibleSources;

  let score = 0;
  const totalColorTargets = commanderColors.reduce((sum, color) => sum + (colorTargets?.[color] || 0), 0);
  const avgColorTarget = totalColorTargets > 0 ? totalColorTargets / commanderColors.length : 1;
  const targetWeight = (color) => (colorTargets ? (colorTargets[color] || 0) / avgColorTarget : 1);

  // A flexible source (relevantReliable didn't already cover it) is weighted
  // like the rest of the deck's colors on average, since it isn't tied to one.
  score += relevantReliable.reduce((sum, color) => sum + 6 * targetWeight(color), 0) + flexibleSources * 6;
  score += relevantConditional.reduce((sum, color) => sum + 1.5 * targetWeight(color), 0);

  if (normalizedName === "command tower") score += 10;
  if (normalizedName === "exotic orchard") score += 7;
  if (normalizedName === "path of ancestry" && strategyProfile.wantsTribal) score += 9;
  if (normalizedName === "secluded courtyard" && strategyProfile.wantsTribal) score += 8;
  if (normalizedName === "unclaimed territory" && strategyProfile.wantsTribal) score += 8;

  if (card.name.toLowerCase().includes("triome")) score += 8;
  if (card.name.toLowerCase().includes("pathway")) score += 6;

  // Only an untaxed any-color tap earns this. Gated versions already had their
  // colors counted at the conditional rate above; paying the bonus too is what
  // used to float filter lands over real duals.
  if (mana.freeAnyColor) score += 6;
  if (mana.freeAnyType) score += 5;

  if (strategyProfile.wantsTokens && text.includes("create") && text.includes("token")) score += 5;
  if (strategyProfile.wantsSacrifice && text.includes("sacrifice")) score += 4;
  if (strategyProfile.wantsGoWide && text.includes("creature")) score += 2;

  // "Enters tapped unless ..." is a land that can come down untapped, which
  // beats one that never can -- so refund part of the tapped penalty rather
  // than stacking a second one on top of it.
  if (text.includes("enters tapped")) score -= 2;
  if (text.includes("enters tapped unless")) score += 1;
  if (text.includes("pay 1 life")) score -= 0.5;

  // A dual gives you either of its colors for free, forever, from the turn it
  // enters. A search-for-a-basic land is charging for the same eventual
  // guarantee: a real activation (mana plus sacrificing the land), and the
  // fetched basic itself usually enters tapped on top of that. Charged once
  // regardless of how many types are named -- the cost is paying the ability,
  // not paying it once per color it could have fetched.
  if (mana.searchesForBasics) score -= 3;

  if (reliableSources === 0 && relevantConditional.length === 0) score -= 20;

  if (strategyProfile.monoColor) {
    if (!isSynergisticMonoColorLand(card, commanderColors, strategyProfile)) score -= 12;
    if (isLowPriorityMonoColorFixer(card, commanderColors)) score -= 12;
  }

  if (modePrefs.themeFocus) {
    if (cardMatchesThemeFocus(card, modePrefs)) score += 5;
    else score -= 6;
  }

  // How often real decks for this commander actually play the land beats any
  // text heuristic at ranking one dual against another, so where EDHREC has an
  // opinion it leads. Lands it has never seen keep their heuristic score --
  // which for an off-meta collection is most of them.
  const inclusionRate = getEdhrecInclusionRate(edhrecCardLookup?.get(normalizedName));
  if (inclusionRate !== null) score += inclusionRate * EDHREC_LAND_INCLUSION_WEIGHT;

  score *= modePrefs.manaBaseBias;

  return {
    name: card.name,
    role: "land",
    score,
    type: getCardType(card),
    cmc: 0,
    // Reliable colors only: buildBasicManaBase counts these as existing
    // sources, and a filter land shouldn't tell it every color is covered.
    colors: mana.reliable,
    source: "nonbasic-land"
  };
}

function buildNonbasicManaBase(collectionData, allOwnedCardData, commanderColors, targetLandCount, strategyProfile, modePrefs, edhrecCardLookup = null, colorTargets = null) {
  const landPool = [];
  const entries = getCollectionEntries(collectionData);

  for (const entry of entries) {
    const normalizedName = entry.normalizedName;

    const card = allOwnedCardData.get(normalizedName);
    if (!card) continue;
    if (!getCardType(card).includes("land")) continue;
    if (isBasicLand(card.name)) continue;
    if (!legalForCommander(card.colors, commanderColors)) continue;

    const landCandidate = evaluateNonbasicLand(card, commanderColors, strategyProfile, modePrefs, edhrecCardLookup, colorTargets);
    if (!landCandidate) continue;
    landPool.push(landCandidate);
  }

  landPool.sort((a, b) => b.score - a.score);

  const threshold =
    commanderColors.length === 1 ? 7 :
    commanderColors.length === 2 ? 4 :
    commanderColors.length === 3 ? 3 :
    2;

  const filtered = landPool.filter((land) => land.score >= threshold);

  const maxNonbasicCount =
    commanderColors.length === 1 ? Math.min(6, targetLandCount) :
    commanderColors.length === 2 ? Math.min(modePrefs.manaBaseBias > 1 ? 15 : 12, targetLandCount) :
    commanderColors.length === 3 ? Math.min(modePrefs.manaBaseBias > 1 ? 18 : 16, targetLandCount) :
    Math.min(modePrefs.manaBaseBias > 1 ? 22 : 20, targetLandCount);

  return filtered.slice(0, maxNonbasicCount);
}

function buildBasicManaBase(commanderColors, landCountNeeded, selectedNonbasics = [], colorTargets = null) {
  if (landCountNeeded <= 0) return [];

  if (commanderColors.length === 0) {
    return Array.from({ length: landCountNeeded }, () => ({
      name: "Wastes",
      role: "land",
      score: 0,
      type: "basic land",
      cmc: 0,
      colors: [],
      source: "basic-land"
    }));
  }

  const sourceCounts = {};
  for (const color of commanderColors) sourceCounts[color] = 0;

  for (const land of selectedNonbasics) {
    const produced = Array.isArray(land.colors) ? land.colors : [];
    for (const color of produced) {
      if (sourceCounts[color] !== undefined) sourceCounts[color] += 1;
    }
  }

  const deficit = (color) => sourceCounts[color] - (colorTargets?.[color] ?? 0);
  const lands = [];
  const colorsSorted = [...commanderColors].sort((a, b) => deficit(a) - deficit(b));

  for (let i = 0; i < landCountNeeded; i++) {
    colorsSorted.sort((a, b) => deficit(a) - deficit(b));
    const color = colorsSorted[0];
    sourceCounts[color] += 1;

    lands.push({
      name: COLOR_TO_BASIC[color],
      role: "land",
      score: 0,
      type: "basic land",
      cmc: 0,
      colors: [color],
      source: "basic-land"
    });
  }

  return lands;
}
// Type-mix planning.
//
// buildRoleTargetPlan turns role targets (ramp/draw/removal/wipe) into the
// hard constraint the deck is built against, with type buckets (Creature/
// Instant/etc.) as a soft diversity floor layered on top. See the design doc
// for why this flips today's priority.
//
// Depends on: deck-stats.js, text.js, themes.js

// deckSize is the number of cards besides the commanders: 99 for a single
// commander, 98 when a partner or Background takes the second slot.
//
// Role targets (ramp/draw/removal/wipe, plus a synergy catch-all) are now the
// hard constraint the deck is built against; type buckets (Creature/Instant/
// etc.) are a soft diversity floor layered on top, not a competing quota. See
// the design doc for why this flips today's priority.
function buildRoleTargetPlan(edhrecTypeAverages, strategyProfile, targetLandCount, roleTargets, commanderThemes = [], deckSize = 99, modePrefs = {}) {
  const themeSignals = buildThemeSignalSet(commanderThemes);
  // targetLandCount is already the final, sanity-bounded number the caller
  // computed (deck.js blends the pip estimate with EDHREC's average itself
  // now, see manabase.js's resolveLandCount) -- trust it rather than
  // re-deriving it here from edhrecTypeAverages.Land, which would silently
  // reintroduce EDHREC-overrides-everything behavior.
  const requestedLandCount = Math.round(targetLandCount);
  const targetNonlandCount = deckSize - requestedLandCount;

  const wantsVoltron = themeSignals.has("voltron") || modePrefs?.focusedThemeSignal === "voltron";

  const defaults = {
    Creature: strategyProfile.wantsCreatures
      ? (strategyProfile.wantsTribal || strategyProfile.wantsGoWide ? 26 : 20)
      : 15,
    Instant: strategyProfile.wantsCantrips ? 10 : 7,
    Sorcery: strategyProfile.wantsCantrips ? 11 : 8,
    Artifact: themeSignals?.has?.("artifacts") || modePrefs?.focusedThemeSignal === "artifacts" || wantsVoltron ? 11 : 7,
    Enchantment: themeSignals?.has?.("enchantments") || modePrefs?.focusedThemeSignal === "enchantments" || wantsVoltron ? 10 : 5,
    Planeswalker: 1
  };

  const typeKeys = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker"];
  const raw = Object.fromEntries(
    typeKeys.map((bucket) => {
      const value = Number(edhrecTypeAverages?.[bucket]);
      return [bucket, Number.isFinite(value) && value >= 0 ? value : defaults[bucket]];
    })
  );

  let totalRaw = typeKeys.reduce((sum, bucket) => sum + (raw[bucket] || 0), 0);
  if (totalRaw <= 0) totalRaw = typeKeys.reduce((sum, bucket) => sum + defaults[bucket], 0);

  // Scaled purely to inform the soft target/min below -- type buckets no
  // longer have to sum to targetNonlandCount, since role buckets do that job.
  const typeBuckets = {};
  for (const bucket of typeKeys) {
    const exact = ((raw[bucket] || defaults[bucket]) / totalRaw) * targetNonlandCount;
    const target = Math.max(bucket === "Planeswalker" ? 0 : 1, Math.round(exact));
    const minimumFloor = bucket === "Creature" ? 8 : bucket === "Planeswalker" ? 0 : 1;
    typeBuckets[bucket] = { target: Math.max(target, minimumFloor), min: minimumFloor };
  }

  const roleKeys = ["ramp", "draw", "removal", "wipe"];
  const roleBuckets = {};
  let roleTotal = 0;
  for (const role of roleKeys) {
    const target = Math.max(0, Math.round(Number(roleTargets?.[role]) || 0));
    roleBuckets[role] = { target, min: Math.max(0, target - 2), max: target + 2 };
    roleTotal += target;
  }

  const synergyTarget = Math.max(0, targetNonlandCount - roleTotal);
  roleBuckets.synergy = {
    target: synergyTarget,
    min: Math.max(0, synergyTarget - 3),
    max: synergyTarget + 3
  };

  // Rounding fixup: if role targets (unusual EDHREC data) overshoot
  // targetNonlandCount, trim synergy first since it's the most elastic
  // bucket, down to its own floor of 0.
  let assignedTotal = roleTotal + roleBuckets.synergy.target;
  if (assignedTotal > targetNonlandCount) {
    const overflow = assignedTotal - targetNonlandCount;
    const trim = Math.min(overflow, roleBuckets.synergy.target);
    roleBuckets.synergy.target -= trim;
    roleBuckets.synergy.min = Math.max(0, roleBuckets.synergy.target - 3);
    roleBuckets.synergy.max = roleBuckets.synergy.target + 3;
  }

  return {
    landCount: requestedLandCount,
    nonlandCount: targetNonlandCount,
    roleBuckets,
    typeBuckets
  };
}

// Mana-value planning.
//
// The type plan alone can't shape a curve: the pickers walk a score-sorted
// pool and take the first card of the right type, so whichever mana value
// scores highest gets drafted until the collection runs out of it. On a bulk
// collection that means every slot goes to one or two mana values. Curve
// bands work like the type buckets above -- each band gets a slot quota, and
// a card is only picked while its band still has room.

// Bands are 1 (zero and one drops), 2..6, and 7 (everything seven and up).
function getCmcBand(cmc) {
  const value = Number(cmc) || 0;
  if (value <= 1) return 1;
  if (value >= 7) return 7;
  return Math.round(value);
}

// Shares of the nonland slots per band. EDHREC's endpoints don't report a
// curve, so these are fixed: a normal descending Commander curve that still
// leaves room for a real top end.
const DEFAULT_CURVE_SHARES = { 1: 0.08, 2: 0.20, 3: 0.22, 4: 0.18, 5: 0.13, 6: 0.10, 7: 0.09 };

// Curve shares, nudged by how ramp-heavy the plan is and whether the
// strategy wants a low, wide curve. Bounded (+/-0.02 to +/-0.05 of total
// share) so this stays a nudge, not a new curve model.
function adjustCurveShares(shares, roleTargets, strategyProfile) {
  const rampTarget = Number(roleTargets?.ramp) || 10;
  const rampShift = Math.max(-0.02, Math.min(0.05, (rampTarget - 10) * 0.01));
  const lowCurveFlag = Boolean(
    strategyProfile?.wantsGoWide || strategyProfile?.wantsTribal || strategyProfile?.wantsCantrips
  );
  const curveShift = rampShift - (lowCurveFlag ? 0.02 : 0);

  const lowBands = ["1", "2"];
  const highBands = ["5", "6", "7"];
  const adjusted = { ...shares };

  if (curveShift === 0) return adjusted;

  // Positive curveShift: move weight from low bands into high bands.
  // Negative: the reverse. Each side's shift is split proportionally to its
  // members' existing share of that side's total.
  const fromBands = curveShift > 0 ? lowBands : highBands;
  const toBands = curveShift > 0 ? highBands : lowBands;
  const magnitude = Math.abs(curveShift);

  const fromTotal = fromBands.reduce((sum, band) => sum + shares[band], 0);
  const toTotal = toBands.reduce((sum, band) => sum + shares[band], 0);

  for (const band of fromBands) {
    const share = fromTotal > 0 ? shares[band] / fromTotal : 1 / fromBands.length;
    adjusted[band] = Math.max(0, shares[band] - magnitude * share);
  }
  for (const band of toBands) {
    const share = toTotal > 0 ? shares[band] / toTotal : 1 / toBands.length;
    adjusted[band] = shares[band] + magnitude * share;
  }

  return adjusted;
}

function buildCurvePlan(nonlandCount, shares = DEFAULT_CURVE_SHARES) {
  const caps = {};
  for (const band of Object.keys(shares)) {
    caps[band] = Math.max(1, Math.round(shares[band] * nonlandCount));
  }
  return { caps, counts: {} };
}

function curveHasRoom(curvePlan, cmc) {
  if (!curvePlan) return true;
  const band = getCmcBand(cmc);
  return (curvePlan.counts[band] || 0) < (curvePlan.caps[band] || 0);
}

function recordCurvePick(curvePlan, cmc) {
  if (!curvePlan) return;
  const band = getCmcBand(cmc);
  curvePlan.counts[band] = (curvePlan.counts[band] || 0) + 1;
}

function releaseCurvePick(curvePlan, cmc) {
  if (!curvePlan) return;
  const band = getCmcBand(cmc);
  curvePlan.counts[band] = Math.max(0, (curvePlan.counts[band] || 0) - 1);
}

function getCardsNeededForTypeMinimums(deck, typeBuckets) {
  const counts = countByType(deck);
  const needed = [];
  for (const [bucket, rule] of Object.entries(typeBuckets || {})) {
    const deficit = Math.max(0, (rule?.min || 0) - (counts[bucket] || 0));
    for (let i = 0; i < deficit; i++) needed.push(bucket);
  }
  return needed;
}

function getRoleCounts(deck) {
  return {
    ramp: deck.filter((card) => card.role === "ramp").length,
    draw: deck.filter((card) => card.role === "draw").length,
    removal: deck.filter((card) => card.role === "removal").length,
    wipe: deck.filter((card) => card.role === "wipe").length,
    synergy: deck.filter((card) => card.role === "synergy").length
  };
}

// excludedKeys holds every commander's normalized name (a deck may have two),
// so a commander is never also drafted into its own deck.
function pickBestCardForBucket(pool, usedNames, excludedKeys, bucket, curvePlan = null) {
  let bestIgnoringCurve = null;

  for (const card of pool) {
    const key = normalizeCardName(card.name);
    if (usedNames.has(key) || excludedKeys.has(key)) continue;
    if (getDeckTypeBucket(card.type || card.type_line || "") !== bucket) continue;

    // The pool is score-sorted, so the first card whose band still has room is
    // the best card we can take without distorting the curve.
    if (curveHasRoom(curvePlan, card.cmc)) return card;
    if (!bestIgnoringCurve) bestIgnoringCurve = card;
  }

  // Every band this bucket can still reach is full -- take the best remaining
  // card rather than leaving the slot empty.
  return bestIgnoringCurve;
}

function chooseBestFlexibleCard(pool, deck, plan, usedNames, excludedKeys) {
  const typeCounts = countByType(deck);
  const roleCounts = getRoleCounts(deck);
  const roleBuckets = plan?.roleBuckets || {};
  const typeBuckets = plan?.typeBuckets || {};

  let best = null;
  let bestScore = -Infinity;

  for (const card of pool) {
    const key = normalizeCardName(card.name);
    if (usedNames.has(key) || excludedKeys.has(key)) continue;

    const roleRule = roleBuckets[card.role];
    const roleCount = roleCounts[card.role] || 0;
    if (roleRule && roleCount >= roleRule.max + 2) continue;

    let adjustedScore = Number(card.score || 0);

    // Role deficit is the dominant term now -- this is the hard constraint.
    if (roleRule) {
      const target = Number(roleRule.target || 0);
      const deficit = Math.max(0, target - roleCount);
      const overflow = Math.max(0, roleCount - target);
      adjustedScore += deficit * 30;
      adjustedScore -= overflow * 18;
      if (roleCount < (roleRule.min || 0)) adjustedScore += 35;
      if (roleCount >= (roleRule.max || 999)) adjustedScore -= 28;
    }

    // Type deficit is a minor tiebreaker -- soft diversity, not a gate.
    const bucket = getDeckTypeBucket(card.type || card.type_line || "");
    const typeRule = typeBuckets[bucket];
    if (typeRule) {
      const typeDeficit = Math.max(0, Number(typeRule.target || 0) - (typeCounts[bucket] || 0));
      adjustedScore += typeDeficit * 8;
    }

    if (bucket === "Creature") adjustedScore += 4;

    if (adjustedScore > bestScore) {
      best = card;
      bestScore = adjustedScore;
    }
  }

  return best;
}
// The deck assembler.
//
// buildDeckFromScoredPool runs six phases: hit the EDHREC type mix from
// EDHREC-owned matches, fill the support package the deck needs (ramp, draw,
// removal, sweepers), satisfy any unmet type minimums, fill the remainder
// with whatever best serves the shortest type and role, evict into a role
// that a type bucket has starved, then force creatures in if the collection
// turned out to be spell-heavy. Lands are added last.
//
// Depends on: cards.js, csv.js, deck-stats.js, manabase.js, scoring.js,
//   text.js, themes.js, type-plan.js

// Backfill redundancy.
//
// scoreFallbackCard's tribal term is +12 against a base of 5, so when EDHREC
// reports a creature-type theme every card of that type outranks everything
// else and the backfill becomes one card seven times: a Krydle build took seven
// Rogues, five of them "unblockable", three contributing no ramp, draw or
// removal at all. The bonus a shared trait earns the first pick should not be
// earned in full by the fifth.
//
// A candidate is charged for its *most* repeated trait rather than the sum over
// all of them -- summing would punish a card for being described in more words
// than its rivals. At this weight the tribal bonus is spent by the fourth copy,
// and the slot goes to something that does a different job.
const FALLBACK_REDUNDANCY_WEIGHT = 4;

// Theme fit, for ordering within the on-theme tier.
//
// This used to be a flat +10 added to every theme match, competing against
// generic bonuses that add up to about the same -- base 5, curve 4, "is a
// creature" 6 -- so a vanilla body in the right colors regularly outbid a card
// doing what the deck was built to do. The tier split below settles that
// contest instead: theme cards are no longer scored against generic ones, only
// against each other. What is left for the score to decide is which theme card,
// and there the answer is the one serving the theme EDHREC ranked highest, or
// the most of them.
//
// Sized to matter against the curve and role terms it now competes with, which
// span about 4 points each.
const FALLBACK_THEME_RANK_BONUS = 12;
const FALLBACK_THEME_RANK_DECAY = 2;
const FALLBACK_THEME_BREADTH_BONUS = 3;

// Floored rather than allowed to reach zero: a fifth-ranked theme is still the
// commander's, and should still beat a card that matches nothing.
function getThemeFitBonus(match) {
  if (!match) return 0;

  const rank = Math.max(0, Number(match.rank) || 0);
  const hits = Math.max(1, Number(match.hits) || 1);

  return Math.max(2, FALLBACK_THEME_RANK_BONUS - rank * FALLBACK_THEME_RANK_DECAY)
    + (hits - 1) * FALLBACK_THEME_BREADTH_BONUS;
}

// exemptTraits holds what the deck is *trying* to repeat. A Dragon tribal
// commander wants its fourth and tenth Dragon as much as its first, so charging
// for them fights the plan: Rivaz of the Claw went from 13 dragons to 8, with
// none of 23 backfilled slots going to a dragon out of the 35 legal ones owned.
// Accidental sameness is what this penalty is for.
function getCardRedundancyKeys(card, exemptTraits) {
  const keys = new Set([...detectCardTags(card), ...getCardSubtypes(card)]);
  if (exemptTraits) {
    for (const trait of exemptTraits) keys.delete(trait);
  }
  return Array.from(keys);
}

function getRedundancyPenalty(keys, redundancyCounts) {
  let mostRepeated = 0;
  for (const key of keys || []) {
    const seen = redundancyCounts.get(key) || 0;
    if (seen > mostRepeated) mostRepeated = seen;
  }
  return mostRepeated * FALLBACK_REDUNDANCY_WEIGHT;
}

// The backfill is gated on theme rather than nudged towards it: the on-theme
// tier is offered to every picker first, and the generic tier is only reached
// once nothing on-theme can fill the slot.
//
// Scoring the two together never worked, because the terms that decide a
// generic card -- curve, "is a creature", role -- are the same for every
// commander sharing a color identity. Whatever weight the theme term carried,
// four Dimir commanders drew nearly half the same backfill. Ordering by tier
// makes theme the first question and leaves score to break ties inside it.
function pickFromTiers(tiers, pick) {
  for (const tier of tiers) {
    const found = pick(tier);
    if (found) return found;
  }
  return null;
}

function isThemeFallback(card) {
  return Boolean(card && card.themeMatch);
}

function getFallbackSource(card) {
  return isThemeFallback(card) ? "fallback-theme" : "fallback-generic";
}

// Same contract as pickBestCardForBucket, but the ranking has to be re-decided
// on every call: the penalty depends on what the deck already holds, so a
// pre-sorted pool cannot answer it.
function pickBestFallbackCard(pool, usedNames, commanderKeys, bucket, curvePlan, redundancyCounts) {
  let best = null;
  let bestScore = -Infinity;
  let bestIgnoringCurve = null;
  let bestIgnoringCurveScore = -Infinity;

  for (const card of pool) {
    const key = normalizeCardName(card.name);
    if (usedNames.has(key) || commanderKeys.has(key)) continue;
    if (getDeckTypeBucket(card.type || card.type_line || "") !== bucket) continue;

    const adjusted = Number(card.score || 0) - getRedundancyPenalty(card.redundancyKeys, redundancyCounts);

    if (curveHasRoom(curvePlan, card.cmc)) {
      if (adjusted > bestScore) {
        best = card;
        bestScore = adjusted;
      }
      continue;
    }

    if (adjusted > bestIgnoringCurveScore) {
      bestIgnoringCurve = card;
      bestIgnoringCurveScore = adjusted;
    }
  }

  // Every band this bucket can still reach is full -- take the best remaining
  // card rather than leaving the slot empty.
  return best || bestIgnoringCurve;
}

function buildDeckFromScoredPool(
  scoredNonlands,
  commanderColors,
  collectionData,
  allOwnedCardData,
  commanderThemes,
  commanderName,
  modePrefs,
  edhrecTypeAverages = null,
  edhrecRoleTargets = null,
  edhrecCards = [],
  options = {}
) {
  const deck = [];
  const usedNames = new Set();

  // A deck may have two commanders (partner, Background, Doctor's companion).
  // Both must be excluded from the 98, under their full name and their front
  // face, since Scryfall reports two-faced cards as "Front // Back".
  const commanderNames = Array.isArray(options.commanderNames) && options.commanderNames.length
    ? options.commanderNames
    : [commanderName];
  const commanderKeys = new Set();
  for (const name of commanderNames) {
    if (!name) continue;
    commanderKeys.add(normalizeCardName(name));
    commanderKeys.add(normalizeCardName(getPrimaryCardName(name)));
  }

  // Cards besides the commanders: 99 alone, 98 for a pair.
  const deckSize = Number(options.deckSize) || 99;

  // Owned cards that serve one of this commander's themes, mapped to the rank
  // of the best theme they serve and how many they serve. Resolved before the
  // build because finding them can require a network lookup.
  const themeCardNames = options.themeCardNames instanceof Map ? options.themeCardNames : new Map();

  const strategyProfile = getCommanderStrategyProfile(commanderName, commanderThemes, commanderColors);
  const isTribalDeck = isActiveBuildTribal(strategyProfile, modePrefs);

  // The traits this deck is built to repeat, which the backfill must not be
  // charged for pursuing -- a Dragon tribal deck wants its tenth Dragon as much
  // as its first.
  //
  // Only the headline tribe counts. EDHREC lists themes by how many decks play
  // them, so the first is what the deck is about: Rivaz of the Claw leads with
  // "dragons" and turns 35 owned dragons into 25 in the deck, while Krydle of
  // Baldur's Gate leads with "mill" and is merely itself a Rogue -- there,
  // seven more Rogues is seven copies of the same card, none of which do
  // anything. Exempting every tribe named anywhere in the themes brought that
  // straight back.
  //
  // A tribe reaches the trait list under two names, "dragon" from the type line
  // and "dragon tribal" from detectCardTags, and exempting one leaves the other
  // charging full price.
  const planTraits = new Set();
  if (strategyProfile.wantsTribal) {
    for (const alias of getCommanderTribalThemes((commanderThemes || []).slice(0, 1))) {
      planTraits.add(alias);
      planTraits.add(alias.replace(" tribal", ""));
    }
  }

  const edhrecCardLookup = new Map(
    (Array.isArray(edhrecCards) ? edhrecCards : []).map((entry) => [normalizeCardName(entry.name), entry])
  );

  const roleTargets = normalizeRoleTargets(edhrecRoleTargets);

  const themeFallbackPool = [];
  const genericFallbackPool = [];
  const collectionEntries = getCollectionEntries(collectionData);
  for (const entry of collectionEntries) {
    const normalizedName = entry.normalizedName;
    if (commanderKeys.has(normalizedName)) continue;

    const card = allOwnedCardData.get(normalizedName);
    if (!card) continue;
    if (getCardType(card).includes("land")) continue;
    if (!legalForCommander(card.colors, commanderColors)) continue;

    const fit = classifyBackfillModeFit(card, modePrefs, isTribalDeck);
    if (fit.tier >= 2) continue;
    const modeFitAdjustment = fit.tier === 0 ? 12 : -10;

    const themeMatch = themeCardNames.get(normalizedName) || null;

    // When a theme is focused, filter to cards matching that specific theme.
    // fit.tier === 0 is exactly cardMatchesThemeFocus (classifyBackfillModeFit
    // computed it above) -- checking tribal types only here missed every
    // non-tribal focused theme (Vehicles, Spellslinger, Aristocrats, ...),
    // silently routing real matches into the generic tier instead.
    const matchesFocusedTheme = !modePrefs.themeFocus || fit.tier === 0;

    const candidate = {
      name: card.name,
      role: detectRole(card, isTribalDeck),
      manaCost: card.manaCost,
      score: scoreFallbackCard(card, commanderThemes, strategyProfile, commanderColors, modePrefs)
        + modeFitAdjustment
        + getThemeFitBonus(themeMatch),
      type: getCardType(card),
      cmc: card.cmc,
      colors: card.colors,
      modeFitTier: fit.tier,
      themeMatch,
      // Precomputed: the pickers read these once per candidate per slot.
      redundancyKeys: getCardRedundancyKeys(card, planTraits),
      roles: getRoleContributions(card, isTribalDeck)
    };

    if (themeMatch && matchesFocusedTheme) themeFallbackPool.push(candidate);
    else genericFallbackPool.push(candidate);
  }

  // Asked in order, so a generic card is only ever reached once the on-theme
  // tier has nothing left that fits the slot.
  const fallbackTiers = [themeFallbackPool, genericFallbackPool];

  scoredNonlands.sort((a, b) => b.score - a.score);
  for (const tier of fallbackTiers) tier.sort((a, b) => b.score - a.score);

  const recommendedLandCount = recommendLandCount(commanderColors);
  const combinedPool = [...themeFallbackPool, ...genericFallbackPool];
  const pipEstimate = estimateLandCount(combinedPool, commanderColors, roleTargets) || recommendedLandCount;
  const targetLandCount = resolveLandCount(pipEstimate, edhrecTypeAverages);
  const targetNonlandCount = deckSize - targetLandCount;

  const plan = buildRoleTargetPlan(edhrecTypeAverages, strategyProfile, targetLandCount, roleTargets, commanderThemes, deckSize, modePrefs);
  const typePlan = { landCount: plan.landCount, nonlandCount: plan.nonlandCount, buckets: plan.typeBuckets };

  const curvePlan = buildCurvePlan(targetNonlandCount, adjustCurveShares(DEFAULT_CURVE_SHARES, roleTargets, strategyProfile));

  // Traits of everything already drafted, EDHREC picks included -- a Rogue
  // taken from the EDHREC pool makes the next Rogue no less of a repeat.
  const redundancyCounts = new Map();

  function getRedundancySource(card) {
    return allOwnedCardData.get(normalizeCardName(card.name))
      || allOwnedCardData.get(normalizeCardName(getPrimaryCardName(card.name)))
      || null;
  }

  function adjustRedundancy(card, delta) {
    const source = getRedundancySource(card);
    if (!source) return;

    for (const key of getCardRedundancyKeys(source, planTraits)) {
      const next = (redundancyCounts.get(key) || 0) + delta;
      if (next > 0) redundancyCounts.set(key, next);
      else redundancyCounts.delete(key);
    }
  }

  function addCard(card, source) {
    if (!card) return false;
    const key = normalizeCardName(card.name);
    if (usedNames.has(key) || commanderKeys.has(key)) return false;

    // Candidate objects (scoredNonlands, both fallback tiers) never carry
    // oracle text -- only name/type/cmc/colors/score -- so getRoleContributions
    // returns [] if called on one directly. Resolved here, once, against the
    // real collection record, and stashed on the deck entry as `roles`: this is
    // the only reliable way anything downstream (getSupportPackageCounts, and
    // through it bracket.js) can read "every job this card does" rather than
    // silently getting nothing back.
    const roles = getRoleContributions(getRedundancySource(card) || card, isTribalDeck);

    deck.push({ ...card, source, roles });
    usedNames.add(key);
    recordCurvePick(curvePlan, card.cmc);
    adjustRedundancy(card, 1);
    return true;
  }

  // Phase 0: fill the support package (ramp, draw, removal, wipe) first.
  // Support roles are the hard constraint; type buckets are a soft diversity
  // floor layered on top, not a competing quota.
  const supportRoles = ["ramp", "draw", "removal", "wipe"];
  const exhaustedRoles = new Set();

  // Counted by contribution, not by primary role: a removal spell that draws is
  // filed as draw, and asking for removal anyway would double up.
  function getDeckRoleCounts() {
    const counts = { ramp: 0, draw: 0, removal: 0, wipe: 0 };

    for (const card of deck) {
      const source = getRedundancySource(card);
      if (!source) continue;
      for (const role of getRoleContributions(source, isTribalDeck)) counts[role] += 1;
    }

    return counts;
  }

  function pickBestForRole(pool, role, chargeRedundancy) {
    let best = null;
    let bestScore = -Infinity;
    const typeCounts = countByType(deck);

    for (const card of pool) {
      const key = normalizeCardName(card.name);
      if (usedNames.has(key) || commanderKeys.has(key)) continue;

      const roles = card.roles || getRoleContributions(getRedundancySource(card) || card, isTribalDeck);
      if (!roles.includes(role)) continue;

      let adjusted = Number(card.score || 0);
      if (chargeRedundancy) adjusted -= getRedundancyPenalty(card.redundancyKeys, redundancyCounts);
      // Out-of-band is discouraged here rather than forbidden: a support hole is
      // worse for the deck than a bump in the curve.
      if (!curveHasRoom(curvePlan, card.cmc)) adjusted -= 8;

      const bucket = getDeckTypeBucket(card.type || card.type_line || "");
      const typeRule = typePlan?.buckets?.[bucket];
      if (typeRule && (typeCounts[bucket] || 0) > Number(typeRule.target || 0)) adjusted -= 6;

      if (adjusted > bestScore) {
        best = card;
        bestScore = adjusted;
      }
    }

    return best;
  }

  while (deck.length < targetNonlandCount) {
    const counts = getDeckRoleCounts();

    let neediestRole = null;
    let largestGap = 0;
    for (const role of supportRoles) {
      if (exhaustedRoles.has(role)) continue;
      const gap = (plan.roleBuckets[role]?.target || 0) - counts[role];
      if (gap > largestGap) {
        neediestRole = role;
        largestGap = gap;
      }
    }
    if (!neediestRole) break;

    const edhrecPick = pickBestForRole(scoredNonlands, neediestRole, false);
    if (edhrecPick) {
      addCard(edhrecPick, "edhrec");
      continue;
    }

    const fallbackPick = pickFromTiers(fallbackTiers, (tier) => pickBestForRole(tier, neediestRole, true));
    if (!fallbackPick) {
      // Nothing owned and legal can serve this role -- a collection with no
      // board wipes in these colors, say. Stop asking rather than spin.
      exhaustedRoles.add(neediestRole);
      continue;
    }

    addCard(fallbackPick, getFallbackSource(fallbackPick));
  }

  // Phase 1: satisfy missing type minimums from the rest of the collection.
  for (const neededBucket of getCardsNeededForTypeMinimums(deck, typePlan.buckets)) {
    if (deck.length >= targetNonlandCount) break;

    const edhrecPick = pickBestCardForBucket(scoredNonlands, usedNames, commanderKeys, neededBucket, curvePlan);
    if (edhrecPick) {
      addCard(edhrecPick, "edhrec");
      continue;
    }

    const fallbackPick = pickFromTiers(fallbackTiers, (tier) =>
      pickBestFallbackCard(tier, usedNames, commanderKeys, neededBucket, curvePlan, redundancyCounts));
    if (fallbackPick) {
      addCard(fallbackPick, getFallbackSource(fallbackPick));
    }
  }

  // Phase 2: fill the remaining slots with the best cards, prioritizing whatever type and role is still short.
  //
  // The EDHREC pool rides along with both tiers rather than sitting in one of
  // them: it is this commander's own card list, so it is on-theme by
  // construction and should never be skipped in favour of a generic backfill.
  const flexibleTiers = fallbackTiers.map((tier) => [...scoredNonlands, ...tier]);
  while (deck.length < targetNonlandCount) {
    const best = pickFromTiers(flexibleTiers, (tier) =>
      chooseBestFlexibleCard(tier, deck, plan, usedNames, commanderKeys));
    if (!best) break;

    addCard(best, scoredNonlands.includes(best) ? "edhrec" : getFallbackSource(best));
  }

  // Phase 3: emergency support-role backfill via eviction.
  //
  // The role loop runs first now (Phase 0), so by the time this phase starts
  // a role is normally already at target or already marked exhausted -- this
  // rarely finds anything left to do. It stays as a safety net for the case
  // that got it written: a theme living in the same type bucket as a role
  // (Equipment in Artifact) can still starve that role if the role loop's own
  // pool was thin and Phase 2's flexible fill then leaned the deck's Artifact
  // slots toward theme picks before the role's target was reached. A Sokka
  // and Suki build left 29 owned, color-legal ramp rocks undrafted while
  // short 5 of its ramp target, purely because Artifact had already hit
  // 28/28.
  //
  // Rather than raise the Artifact bucket's target -- which would let the
  // theme itself balloon -- evict the worst card from a bucket that has room
  // above its floor and spend that slot on the missing role instead. An
  // Equipment is never evicted: growing the deck's Artifact count to make
  // room for ramp is fine, thinning the theme the fix was asked to leave
  // alone is not.
  function isEquipmentCard(card) {
    // getCardSubtypes reads through getCardType, which lowercases -- an
    // uppercase needle here would silently never match and this whole
    // protection would be a no-op.
    return getCardSubtypes(getRedundancySource(card) || card).includes("equipment");
  }

  function pickForRoleIgnoringBucketRoom(pool, role, chargeRedundancy) {
    let best = null;
    let bestScore = -Infinity;

    for (const card of pool) {
      const key = normalizeCardName(card.name);
      if (usedNames.has(key) || commanderKeys.has(key)) continue;

      const roles = card.roles || getRoleContributions(getRedundancySource(card) || card, isTribalDeck);
      if (!roles.includes(role)) continue;

      let adjusted = Number(card.score || 0);
      if (chargeRedundancy) adjusted -= getRedundancyPenalty(card.redundancyKeys, redundancyCounts);
      if (!curveHasRoom(curvePlan, card.cmc)) adjusted -= 8;

      if (adjusted > bestScore) {
        best = card;
        bestScore = adjusted;
      }
    }

    return best;
  }

  for (const role of supportRoles) {
    let guard = Number(plan.roleBuckets[role]?.target || 0) * 2;
    while (getDeckRoleCounts()[role] < Number(plan.roleBuckets[role]?.target || 0) && guard-- > 0) {
      const edhrecPick = pickForRoleIgnoringBucketRoom(scoredNonlands, role, false);
      const pick = edhrecPick || pickFromTiers(fallbackTiers, (tier) => pickForRoleIgnoringBucketRoom(tier, role, true));
      if (!pick) break;

      let replaceIndex = -1;
      let replaceScore = Infinity;
      const counts = countByType(deck);
      const roleCounts = getDeckRoleCounts();
      for (let i = 0; i < deck.length; i++) {
        const existing = deck[i];
        if (isEquipmentCard(existing)) continue;
        const bucket = getDeckTypeBucket(existing.type || existing.type_line || "");
        const rule = typePlan?.buckets?.[bucket];
        if (rule && (counts[bucket] || 0) <= rule.min) continue;

        // Robbing a card another role still needs just moves the shortage
        // around -- only spend a card whose roles are already at or above
        // their own targets (or that carries no support role at all).
        const existingRoles = existing.roles || getRoleContributions(getRedundancySource(existing) || existing, isTribalDeck);
        const stillNeeded = existingRoles.some((r) => roleCounts[r] <= Number(plan.roleBuckets[r]?.target || 0));
        if (stillNeeded) continue;

        if ((existing.score || 0) < replaceScore) {
          replaceScore = existing.score || 0;
          replaceIndex = i;
        }
      }

      if (replaceIndex === -1) break;
      usedNames.delete(normalizeCardName(deck[replaceIndex].name));
      releaseCurvePick(curvePlan, deck[replaceIndex].cmc);
      adjustRedundancy(deck[replaceIndex], -1);
      deck.splice(replaceIndex, 1);
      addCard(pick, edhrecPick ? "edhrec" : getFallbackSource(pick));
    }
  }

  // Phase 4: emergency creature backfill if the collection was extremely spell-heavy.
  const creatureRule = typePlan?.buckets?.Creature;
  if (creatureRule) {
    while ((countByType(deck).Creature || 0) < creatureRule.min && deck.length) {
      const fallbackCreature = pickFromTiers(fallbackTiers, (tier) =>
        pickBestFallbackCard(tier, usedNames, commanderKeys, "Creature", curvePlan, redundancyCounts));
      if (!fallbackCreature) break;

      let replaceIndex = -1;
      let replaceScore = Infinity;
      const counts = countByType(deck);
      for (let i = 0; i < deck.length; i++) {
        const existing = deck[i];
        const bucket = getDeckTypeBucket(existing.type || existing.type_line || "");
        if (bucket === "Creature") continue;
        const rule = typePlan?.buckets?.[bucket];
        if (rule && (counts[bucket] || 0) <= rule.min) continue;
        if ((existing.score || 0) < replaceScore) {
          replaceScore = existing.score || 0;
          replaceIndex = i;
        }
      }

      if (replaceIndex === -1) break;
      usedNames.delete(normalizeCardName(deck[replaceIndex].name));
      releaseCurvePick(curvePlan, deck[replaceIndex].cmc);
      adjustRedundancy(deck[replaceIndex], -1);
      deck.splice(replaceIndex, 1);
      addCard(fallbackCreature, getFallbackSource(fallbackCreature));
    }
  }

  // Resolve every deck entry back to its full record (candidates only carry
  // name/type/cmc/score/etc, same reason getRedundancySource exists above)
  // so pip-counting sees real manaCost strings, not undefined. The commander's
  // own card(s) are prepended too -- otherwise a color that's only in the
  // commander's cost (never in the deck's other spells) gets zero pips and
  // computeColorSourceTargets's splash floor never triggers for it, leaving
  // the mana base with ~0 sources for a color needed to cast the commander.
  const resolvedCommanderCards = commanderNames
    .map((name) => name && (allOwnedCardData.get(normalizeCardName(name))
      || allOwnedCardData.get(normalizeCardName(getPrimaryCardName(name)))))
    .filter(Boolean);
  const resolvedNonlandCards = [
    ...resolvedCommanderCards,
    ...deck.map((card) => getRedundancySource(card) || card)
  ];
  const colorTargets = computeColorSourceTargets(resolvedNonlandCards, commanderColors, targetLandCount);

  const selectedNonbasicLands = buildNonbasicManaBase(
    collectionData,
    allOwnedCardData,
    commanderColors,
    targetLandCount,
    strategyProfile,
    modePrefs,
    edhrecCardLookup,
    colorTargets
  );

  let remainingLandCount = targetLandCount - selectedNonbasicLands.length;
  if (remainingLandCount < 0) remainingLandCount = 0;

  const basicLands = buildBasicManaBase(
    commanderColors,
    remainingLandCount,
    selectedNonbasicLands,
    colorTargets
  );

  let finalDeck = [...deck, ...selectedNonbasicLands, ...basicLands];

  while (finalDeck.length < deckSize) {
    const extra = buildBasicManaBase(
      commanderColors,
      1,
      finalDeck.filter((c) => c.role === "land"),
      colorTargets
    );
    finalDeck.push(...extra);
  }

  if (finalDeck.length > deckSize) {
    finalDeck = finalDeck.slice(0, deckSize);
  }

  return finalDeck;
}

function mergeDeckCounts(deck) {
  const map = new Map();

  for (const card of deck) {
    const key = normalizeCardName(card.name);
    if (!map.has(key)) {
      map.set(key, {
        name: card.name,
        count: 1,
        type: getCardType(card),
        text: getCardText(card),
        role: card.role,
        source: card.source,
        reasons: card.reasons || [],
        scryfallUrl: card.scryfallUrl || card.scryfall_uri || "",
        imageUrl: getCardImageUrl(card)
      });
    } else {
      const existing = map.get(key);
      existing.count += 1;
      existing.reasons = Array.from(new Set([...(existing.reasons || []), ...(card.reasons || [])]));
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function getCardSection(cardType) {
  const type = String(cardType || "").toLowerCase();
  if (type.includes("creature")) return "Creatures";
  if (type.includes("artifact")) return "Artifacts";
  if (type.includes("enchantment")) return "Enchantments";
  if (type.includes("planeswalker")) return "Planeswalkers";
  if (type.includes("instant")) return "Instants";
  if (type.includes("sorcery")) return "Sorceries";
  if (type.includes("land")) return "Lands";
  return "Other";
}

function generateCardReasons(card, commanderThemes, strategyProfile, commanderColors) {
  const reasons = [];
  const tags = detectCardTags(card);
  const role = detectRole(card, strategyProfile.wantsTribal);

  if (role === "ramp") reasons.push("ramp");
  if (role === "draw") reasons.push("draw");
  if (role === "removal") reasons.push("removal");
  if (role === "wipe") reasons.push("wipe");
  if (isTokenMaker(card)) reasons.push("token maker");
  if (isSacrificeCard(card)) reasons.push("sac outlet");
  if (isGameChanger(card.name)) reasons.push("game changer");

  const themeSignals = buildThemeSignalSet(commanderThemes);
  for (const theme of commanderThemes) {
    const aliases = getThemeAliases(theme);
    if (aliases.some((alias) => tags.includes(alias)) || themeSignals.has(normalizeThemeName(theme)) && tags.includes(normalizeThemeName(theme))) {
      reasons.push(theme);
    }
  }

  if (strategyProfile.wantsTribal) {
    for (const tribe of strategyProfile.tribalTypes) {
      if (hasTribalType(card, tribe)) reasons.push(`${tribe} tribal`);
    }
  }

  if (card.role === "land") {
    if (card.source === "basic-land") reasons.push("basic fixing");
    if (card.source === "nonbasic-land") reasons.push("mana land");
  }

  if (card.source === "edhrec") reasons.push("edhrec match");
  if (card.source === "fallback-theme") reasons.push("theme fallback");
  if (card.source === "fallback-generic") reasons.push("collection fallback");

  return Array.from(new Set(reasons)).slice(0, 5);
}
// Which commanders does a collection own, and how much of each one's deck
// could it actually build?
//
// findOwnedRankedCommanders answers the first question from EDHREC's color
// pages alone -- no Scryfall traffic, because a name in the collection that
// EDHREC lists as a commander is an owned commander. computeCommanderMatch
// answers the second for one commander at a time, since that needs its
// recommendation pool.
//
// Depends on: cards.js, csv.js, deck-stats.js, edhrec.js, manabase.js,
//   scryfall.js, text.js, themes.js, type-plan.js

// EDHREC writes a partner pair as "A // B", the very separator a two-faced
// card's own name uses. A CSV lists a two-faced card under the whole name, so
// checking the entry as written settles that case first; only then is it worth
// reading the "//" as a pair, which needs both halves owned.
function resolveOwnedCommanderEntry(collection, entry) {
  if (!entry?.name) return null;

  if (hasOwnedCard(collection, entry.name)) {
    return { ...entry, names: [entry.name], isPair: false, deckSize: 99 };
  }

  const parts = String(entry.name).split("//").map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1 && parts.every((part) => hasOwnedCard(collection, part))) {
    return { ...entry, names: parts, isPair: true, deckSize: 98 };
  }

  return null;
}

function findOwnedRankedCommanders(collection, rankings) {
  if (!collection) return [];

  const owned = [];
  for (const entry of Array.isArray(rankings) ? rankings : []) {
    const resolved = resolveOwnedCommanderEntry(collection, entry);
    if (resolved) owned.push(resolved);
  }

  return owned.sort((a, b) => b.decks - a.decks);
}

// Owned commanders EDHREC's color pages never listed.
//
// findOwnedRankedCommanders reads names alone, which is why it costs no
// Scryfall traffic -- but it can only see commanders EDHREC ranks, and those
// pages carry the most-played ones. A collection's obscure or very new legends
// are absent entirely, so filtering to a color identity showed a shorter list
// than the collection can actually offer.
//
// Answering "what else could head a deck of these colors" needs the card
// itself: whether it can be a commander at all, and what its identity is. That
// is why this takes hydrated card data where the ranked scan does not.
//
// Backgrounds are excluded for free: canBeCommander's text rule looks for "can
// be your commander", which a planeswalker commander says and a Background --
// "Commander creatures you own have ..." -- does not.
function findOwnedUnrankedCommanders(collection, cardData, rankedCommanders) {
  const ranked = new Set();
  for (const commander of rankedCommanders || []) {
    for (const name of commander.names || []) {
      ranked.add(normalizeCardName(name));
      ranked.add(normalizeCardName(getPrimaryCardName(name)));
    }
  }

  const unranked = [];
  const seen = new Set();

  for (const entry of getCollectionEntries(collection)) {
    const normalizedName = entry.normalizedName;
    if (ranked.has(normalizedName) || seen.has(normalizedName)) continue;

    const card = cardData.get(normalizedName)
      || cardData.get(normalizeCardName(getPrimaryCardName(normalizedName)));
    if (!card) continue;
    if (!canBeCommander(card)) continue;

    seen.add(normalizedName);
    unranked.push({
      name: card.name,
      // EDHREC often has a page for a commander its color pages do not rank,
      // so derive the slug rather than give up on the match check.
      slug: toEdhrecSlug(getPrimaryCardName(card.name)),
      decks: 0,
      colors: Array.isArray(card.colors) ? card.colors : [],
      names: [card.name],
      isPair: false,
      deckSize: 99,
      unranked: true
    });
  }

  // No deck count to rank these by, so name order is the only one that means
  // anything.
  return unranked.sort((a, b) => a.name.localeCompare(b.name));
}

// Every card of this commander's pool the collection can actually play: owned,
// hydrated, nonland, and inside the color identity.
function collectUsablePoolCards(commander, pool, collection, cardData) {
  const commanderKeys = new Set();
  for (const name of commander.names) {
    commanderKeys.add(normalizeCardName(name));
    commanderKeys.add(normalizeCardName(getPrimaryCardName(name)));
  }

  const usable = [];
  for (const entry of Array.isArray(pool?.cards) ? pool.cards : []) {
    const key = normalizeCardName(entry.name);
    if (commanderKeys.has(key)) continue;
    if (!hasOwnedCard(collection, entry.name)) continue;

    const card = cardData.get(key) || cardData.get(normalizeCardName(getPrimaryCardName(entry.name)));
    if (!card) continue;
    if (getCardType(card).includes("land")) continue;
    if (!legalForCommander(card.colors, commander.colors)) continue;

    usable.push(card);
  }

  return usable;
}

// The share of this commander's deck the collection can fill from EDHREC's own
// recommendations, which is the same quantity that decides how much of a real
// build falls through to generic collection scoring. Capped at 100: owning
// more candidates than there are slots is a full deck, not a 140% one.
function computeCommanderMatch(commander, pool, collection, cardData) {
  const usable = collectUsablePoolCards(commander, pool, collection, cardData);

  const byBucket = {};
  for (const card of usable) {
    const bucket = getDeckTypeBucket(getCardType(card));
    byBucket[bucket] = (byBucket[bucket] || 0) + 1;
  }

  // No themes or role data to hand it: the type mix comes from EDHREC's own
  // averages here, and the profile/role targets only fill in where those are
  // missing (getEdhrecCommanderPool never fetches role targets, only cards
  // and typeAverages -- this is a slots estimate, not a real build).
  //
  // buildRoleTargetPlan trusts whatever land count it's given verbatim (the
  // real build blends its own pip estimate with EDHREC's average itself, see
  // manabase.js's resolveLandCount) -- so this caller has to do that blend
  // too, or pool.typeAverages.Land would go unused and every slots estimate
  // would silently fall back to the flat color-count number even when EDHREC
  // actually reported a land average for this commander.
  const strategyProfile = getCommanderStrategyProfile(commander.names[0], [], commander.colors);
  const plan = buildRoleTargetPlan(
    pool?.typeAverages,
    strategyProfile,
    resolveLandCount(recommendLandCount(commander.colors), pool?.typeAverages),
    normalizeRoleTargets(null),
    [],
    commander.deckSize
  );

  const slots = Math.max(1, plan.nonlandCount);

  return {
    usable: usable.length,
    slots,
    percent: Math.min(100, Math.round((usable.length / slots) * 100)),
    byBucket
  };
}
