// Shared-term reading: what a card MAKES and what it NEEDS, read from its words.
//
// A synergy is one card's output meeting another card's input. Needs come from conditions only ("whenever you cast
// an instant or sorcery", "if you control a Wizard", "for each Insect you control", "return target creature card from
// your graveyard"), never from the target of an effect ("destroy target artifact" does not need artifacts) and never
// from opponent-scoped or self triggers. Makes come from a card's types, subtypes, keywords and effects.
// A need is a CLAUSE: a set of alternative terms, any one of which satisfies it ("instant or sorcery", "noncreature").
// Terms are lowercase: types, subtypes, keywords, "<kind> counter" and "counter", and "ev:<event>" for things that happen
// ("ev:sacrifice", "ev:token", "ev:landfall", "ev:enter-trigger" ...).
//
// Pure functions over cards: no DOM, no network. The vocabulary (subtypes, keywords) comes from the pool itself.
// The dev audit (dev/tools/jxa-harness/shared_terms.js) has its own copy of this reading on purpose and never calls
// this file, so the builder is not graded by the code it selects with.
//
// Depends on: cards.js (getCardText, getCardType, getCardSubtypes), abilities.js (getCardAbilities)

// A clause counts as a link when ln(pool size / (1 + cards that make any term in it)) is at least this, which means
// about 22% of the pool or fewer make it. It is a share, so it does not move with collection size.
const TERM_CLAUSE_MIN = 1.5;
// Below this many nonland cards the supply says nothing: no clause is counted, so nothing is invented.
const TERM_MIN_POOL = 200;

const TERM_TYPES = new Set(["creature", "artifact", "enchantment", "instant", "sorcery", "planeswalker", "battle", "legendary", "saga"]);
// Words that are subtypes or keywords in some card but never name a tribe, type or keyword in a condition.
const TERM_STOP = new Set(["time", "turn", "first", "second", "power", "toughness", "plan", "cat", "spell", "card", "player", "token", "opponent", "control", "other", "another", "you", "your", "each", "target", "that", "this", "enchant", "equip", "ward", "kicker", "cycling", "flash", "defender", "scry", "mill", "amass", "fabricate", "bolster", "adapt", "learn"]);
const TERM_HISTORIC = ["artifact", "legendary", "saga"];
const TERM_NONCREATURE = ["artifact", "enchantment", "instant", "sorcery", "planeswalker", "battle"];
const TERM_COUNTER_NOT_KIND = ["a", "the", "that", "more", "of", "one", "any", "each", "no", "all"];

// What a trigger watches, and what an effect causes. "dies" is supplied only by sacrifice outlets and edicts
// (see getCardTerms): every removal spell kills, so counting them made "dies" a term every deck already had.
const TERM_EVENT_FROM_TRIGGER = { dies: "ev:dies", "sacrifice-event": "ev:sacrifice", "token-event": "ev:token", "draw-event": "ev:draw", "draw-second": "ev:draw", "life-event": "ev:lifegain", "discard-event": "ev:discard", "cycle-event": "ev:cycle", landfall: "ev:landfall", "counter-placed": "ev:counter", "leave-graveyard": "ev:graveyard", "cast-spell": "ev:cast", "cast-noncreature": "ev:cast", "cast-second": "ev:cast", etb: "ev:enter", attacks: "ev:attack", "combat-damage": "ev:attack" };
const TERM_EVENT_FROM_EFFECT = { sacrifice: "ev:sacrifice", "create-token": "ev:token", draw: "ev:draw", loot: "ev:draw", rummage: "ev:draw", "discard-self": "ev:discard", "discard-opponent": "ev:discard", "mill-self": "ev:graveyard", "put-into-graveyard": "ev:graveyard", surveil: "ev:graveyard", "gain-life": "ev:lifegain", "land-to-battlefield": "ev:landfall", counters: "ev:counter" };
const TERM_NEED_PATTERNS = [
  /\bif you control (?:an? |another |at least \w+ |two or more )?([^,.]+)/, /\bas long as you control (?:an? )?([^,.]+)/,
  /\bfor each ([^,.]+?) you control/, /\bnumber of ([^,.]+?) you control/, /costs? \{[^}]+\} less to cast if you control (?:an? )?([^,.]+)/,
  /\b(?:other )?([a-z ]+?) you control (?:get|gets|have|has)\b/, /\b([a-z ]+?) spells? you cast/,
  /return (?:up to \w+ )?(?:target |another )?([^.]*?)(?: cards?)? from your graveyard/, /search your library for (?:an? |up to \w+ )([^.]*?) card/,
  /\bwith (?:an? |the )?([a-z]+) (?:counters?) on (?:it|them)/
];
const TERM_EDICT = /(?:each|target) (?:other )?(?:player|opponent)s? sacrifices? an? (?:\w+ )?creature|sacrifices? a creature/;
const TERM_BLINK = /exile (?:up to \w+ |another )?(?:target )?(?:nonland )?(?:permanent|creature)s? you control[^.]*?return/;

function termSingular(word) {
  return [word, word.replace(/s$/, ""), word.replace(/ves$/, "f"), word.replace(/ies$/, "y"), word.replace(/men$/, "man")];
}

// "-1/-1 counters", "poison counters": the kind plus the generic "counter".
function termCounterTerms(phrase) {
  const found = new Set();
  for (const m of phrase.matchAll(/([+\-]?\d+\/[+\-]?\d+|[a-z]+) counters?/g)) {
    if (!TERM_COUNTER_NOT_KIND.includes(m[1])) found.add(m[1] + " counter");
    found.add("counter");
  }
  return found;
}

// "infect (reminder text)": a keyword followed by its reminder. Real cards also carry raw.keywords.
function termKeywordLines(card) {
  const out = [];
  for (const line of getCardText(card).split("\n")) {
    const m = /^([a-z][a-z -]*?)(?: [0-9x{}a-z]+)? \(([^)]*)\)/.exec(line);
    if (m) out.push({ keyword: m[1].trim(), reminder: m[2] });
  }
  return out;
}

// Subtypes and keywords seen in the pool, and the counters each keyword's reminder text names.
function buildTermVocab(cards) {
  const subs = new Set(), keywords = new Set(), keywordMakes = new Map();
  for (const card of cards || []) {
    if (!card) continue;
    getCardSubtypes(card).forEach((s) => subs.add(s));
    ((card.raw && card.raw.keywords) || []).forEach((k) => keywords.add(String(k).toLowerCase()));
    for (const { keyword, reminder } of termKeywordLines(card)) {
      keywords.add(keyword);
      if (!keywordMakes.has(keyword)) keywordMakes.set(keyword, termCounterTerms(reminder));
    }
  }
  const patterns = [...keywords].filter((k) => k.length > 3 && !TERM_STOP.has(k)).map((k) => ({ keyword: k, text: new RegExp("\\b" + k.replace(/[^a-z ]/g, "") + "\\b") }));
  return { subs, keywords, keywordMakes, patterns };
}

// The terms a phrase names: tribes and types, counter kinds, keywords, and the unions "historic" and "noncreature".
function termsInPhrase(phrase, vocab) {
  const p = phrase.toLowerCase();
  const found = termCounterTerms(p);
  if (/\bhistoric\b/.test(p)) TERM_HISTORIC.forEach((x) => found.add(x));
  if (/\bnoncreature\b/.test(p)) TERM_NONCREATURE.forEach((x) => found.add(x));
  for (const word of p.replace(/[^a-z' -]/g, " ").split(/\s+/)) {
    if (!word) continue;
    for (const form of termSingular(word)) {
      if (TERM_STOP.has(form)) continue;
      if (vocab.subs.has(form) || TERM_TYPES.has(form)) { found.add(form); break; }
    }
  }
  for (const k of vocab.patterns) if (k.text.test(p)) found.add(k.keyword);
  return found;
}

const termCache = new WeakMap();

// { makes: Set<string>, clauses: Array<Set<string>> }, cached per card (and vocabulary).
function getCardTerms(card, vocab) {
  const hit = termCache.get(card);
  if (hit && hit.vocab === vocab) return hit.result;
  const makes = new Set(), needs = new Set(), clauses = [];
  const addClause = (set) => { if (set && set.size) { clauses.push(set); set.forEach((t) => needs.add(t)); } };
  const front = getCardType(card).split("//")[0].split("—")[0];
  for (const word of front.split(/\s+/)) if (TERM_TYPES.has(word)) makes.add(word);
  getCardSubtypes(card).forEach((s) => makes.add(s));
  const isCreature = front.includes("creature");
  if (isCreature) { makes.add("ev:attack"); makes.add("ev:enter"); }
  if (!front.includes("land")) makes.add("ev:cast");
  const text = getCardText(card);
  for (const k of vocab.patterns) {
    if (new RegExp("(?:^|\\n|, )" + k.keyword.replace(/[^a-z ]/g, "") + "\\b").test(text)) {
      makes.add(k.keyword);
      (vocab.keywordMakes.get(k.keyword) || []).forEach((x) => makes.add(x));
    }
  }
  for (const ab of getCardAbilities(card)) {
    const line = ab.line.replace(/^[a-z' ]+ — /, "");
    if (ab.kind === "triggered") {
      const clause = line.split(",")[0];
      const selfTrigger = /^(?:when|whenever|at) (?:~|this )/.test(clause);
      const self = (selfTrigger && !/\b(?:another|other|or)\b/.test(clause)) || /beginning of|end step/.test(clause);
      // A creature with an enters trigger of its own is what blink gives value to.
      if (isCreature && /^(?:when|whenever) (?:~|this \w+) enters/.test(clause)) makes.add("ev:enter-trigger");
      if (!self && !/opponent/.test(clause)) {
        addClause(termsInPhrase(clause, vocab));
        for (const t of ab.trigger) {
          // abilities.js labels any trigger that says "token" as token-event; "whenever you sacrifice a Blood token" is about
          // a sacrifice, so a token-creation need requires create/enters wording.
          if (t === "token-event" && !/\b(?:creates?|created|enters)\b/.test(clause)) continue;
          if (TERM_EVENT_FROM_TRIGGER[t]) addClause(new Set([TERM_EVENT_FROM_TRIGGER[t]]));
        }
      }
    }
    for (const re of TERM_NEED_PATTERNS) {
      const m = re.exec(line);
      if (m && !/opponent/.test(m[1])) addClause(termsInPhrase(m[1], vocab));
    }
    // Effect objects that really are needs: proliferate wants counters on the board; blink wants creatures with enters triggers.
    if (/\bproliferate\b/.test(line)) addClause(new Set(["counter"]));
    if (TERM_BLINK.test(line)) addClause(new Set(["ev:enter-trigger"]));
    for (const e of ab.effects) if (TERM_EVENT_FROM_EFFECT[e.label]) makes.add(TERM_EVENT_FROM_EFFECT[e.label]);
    if (ab.kind === "activated" && ab.cost.includes("sacrifice-other")) { makes.add("ev:sacrifice"); makes.add("ev:dies"); }
    if (TERM_EDICT.test(line)) makes.add("ev:dies");
    if (/\bproliferate\b/.test(line)) { makes.add("ev:counter"); makes.add("counter"); }
    const made = /\bcreate[sd]? (?:an? |two |three |x |that many |\d+ )?([^.]*?) tokens?/.exec(line);
    if (made) termsInPhrase(made[1], vocab).forEach((x) => makes.add(x));
    for (const m of line.matchAll(/\b(?:put|puts|gets?|enters? with)\b[^.]*?([+\-]?\d+\/[+\-]?\d+|[a-z]+) counters?/g)) {
      if (!TERM_COUNTER_NOT_KIND.includes(m[1])) makes.add(m[1] + " counter");
      makes.add("counter");
      makes.add("ev:counter");
    }
  }
  for (const t of [...makes]) if (/ counter$/.test(t)) makes.add("counter");
  const result = { makes, clauses };
  termCache.set(card, { vocab, result });
  return result;
}

function cardMakesAny(card, clause, vocab) {
  const makes = getCardTerms(card, vocab).makes;
  for (const t of clause) if (makes.has(t)) return true;
  return false;
}

// How rare a clause is in this pool. size is the number of distinct nonland cards; suppliers counts those that make any
// term in the clause. isCounted is false for every clause in a pool smaller than TERM_MIN_POOL.
function createTermSupply(cards, vocab) {
  const seen = new Set();
  const pool = [];
  for (const card of cards || []) {
    if (!card || seen.has(card.name)) continue;
    seen.add(card.name);
    if (getCardType(card).split("//")[0].split("—")[0].includes("land")) continue;
    pool.push(card);
  }
  const memo = new Map();
  const suppliers = (clause) => {
    const key = [...clause].sort().join("|");
    let n = memo.get(key);
    if (n === undefined) { n = pool.filter((card) => cardMakesAny(card, clause, vocab)).length; memo.set(key, n); }
    return n;
  };
  const size = pool.length;
  const clauseWeight = (clause) => Math.log(size / (1 + suppliers(clause)));
  return { size, suppliers, clauseWeight, isCounted: (clause) => size >= TERM_MIN_POOL && clauseWeight(clause) >= TERM_CLAUSE_MIN };
}
