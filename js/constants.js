// Static configuration: external endpoints and Magic-domain lookup tables.

const SCRYFALL_NAMED = "https://api.scryfall.com/cards/named?exact=";
const SCRYFALL_AUTOCOMPLETE = "https://api.scryfall.com/cards/autocomplete?q=";
const SCRYFALL_COLLECTION = "https://api.scryfall.com/cards/collection";
const EDHREC_BASE = "https://json.edhrec.com/pages/commanders/";
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

const TRIBAL_TYPES = [
  "angel", "artifact creature", "bear", "bird", "cat", "cleric", "demon", "devil",
  "dinosaur", "dragon", "drake", "druid", "elf", "faerie", "goblin", "human",
  "hydra", "knight", "merfolk", "pirate", "rat", "samurai", "shaman", "sliver",
  "snake", "soldier", "spirit", "treefolk", "vampire", "warlock", "warrior",
  "wizard", "wolf", "zombie"
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
