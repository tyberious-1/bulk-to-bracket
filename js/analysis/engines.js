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
      if (ab.kind === "triggered" || (ab.kind === "keyword" && t.length)) {
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

// A commander's center (design: dev/docs/superpowers/specs/2026-11-05-commander-center-reader-design.md):
// the number, event or exchange its own words run on. Read only, nothing scores from it yet. Kinds:
//   quantity: { measure: total-power | greatest-power | count, filter?, uses: cost-reduction | scaling }
//   event:    { event: cast | enter, filter }  (a type filter the plain event list drops)
//   exchange: { pays, count, gets }            (a sacrifice cost and what it buys)
//   event:    { event: cast, filter, discount, thin }  (discount: the first spell of the type each turn is cheaper) | { event: draw-each, thin }  (every player draws); thin: names few cards, the shared-terms fallback still speaks
//   land-type: { land }                        (makes lands basic type X in addition; island, swamp...)
//   delivery: { keyword }                      (trample, flying given or held)
// The types a commander's own words name as the thing it cares about ("other Heroes you control", "whenever you cast a
// Lesson, Saga, or Shrine spell", "Dragon spells from the top of your library"). Creature types come from the catalog the
// theme reader already uses; the noncreature ones are listed here. Returns lowercase singular forms.
const CENTER_EXTRA_TYPES = new Set(["lesson", "saga", "shrine", "class", "curse", "trap", "room", "case", "legendary", "instant", "sorcery", "artifact"]);
const CENTER_TYPE_FILLER = new Set(["or", "and", "another", "other", "creature", "creatures", "spell", "spells", "card", "cards", "token", "tokens", "nontoken", "a", "an", "the", "your", "team"]);
const CENTER_TYPE_IRREGULAR = { elves: "elf", wolves: "wolf", dwarves: "dwarf", werewolves: "werewolf", thieves: "thief", mice: "mouse", fungi: "fungus", oxen: "ox", cyclopes: "cyclops", halflings: "halfling" };
function centerTypeWord(word) {
  const known = (w) => CENTER_EXTRA_TYPES.has(w) || (typeof CATALOG_CREATURE_TYPES !== "undefined" && CATALOG_CREATURE_TYPES.has(w));
  if (known(word)) return word;
  if (CENTER_TYPE_IRREGULAR[word]) return CENTER_TYPE_IRREGULAR[word];
  for (const cand of [word.replace(/ies$/, "y"), word.replace(/es$/, ""), word.replace(/s$/, ""), word.replace(/i$/, "us")]) if (cand !== word && known(cand)) return cand;
  return null;
}
function readCenterTypes(line) {
  const found = [];
  const words = line.replace(/\([^)]*\)/g, " ").match(/[a-z][a-z'-]*|[,.:;—]/g) || [];
  const castAt = words.findIndex((w, i) => (w === "cast" || w === "reveal" || (w === "for" && words[i - 1] === "library")) );
  for (let i = 0; i < words.length; i++) {
    const t = centerTypeWord(words[i]);
    if (!t || t === "legendary" && words[i - 1] === "non") continue;
    if (words[i + 1] === "-" ) continue;
    // After the type: only filler or more types until a "you control"-style ending.
    let j = i + 1;
    while (j < words.length && (CENTER_TYPE_FILLER.has(words[j]) || words[j] === "," || centerTypeWord(words[j]))) j++;
    const tail = words.slice(j, j + 3).join(" ");
    const after = /^(?:you control|controls|you cast|you own|in your|from your|your team)/.test(tail);
    let k = i - 1;
    while (k >= 0 && (words[k] === "," || words[k] === "or" || words[k] === "and" || centerTypeWord(words[k]))) k--;
    const thatIs = ((words[k] === "a" || words[k] === "an") && (words[k - 1] === "that's" || words[k - 1] === "that")) || (words[i - 1] === "target" && t !== "legendary") || (words[i - 1] === "target" && t === "legendary" && words[i + 1] === "creature");
    const before = castAt !== -1 && i > castAt && !words.slice(castAt, i).some((w) => w === "." || w === ":");
    if (after || before || thatIs) if (!found.includes(t)) found.push(t);
  }
  return found;
}

// Game terms the rules define that a commander can run on (Comprehensive Rules: the Ring 701.54, initiative 725 and
// dungeons 309, experience and stun counters, +1/+1 counters, and the token kinds). `free` terms define the plan wherever they
// appear; a token term counts only when the commander's own condition or cost runs on it ("whenever you sacrifice a Clue"),
// because one Treasure made on enter is not a Treasure deck (Gonti).
const CENTER_TERMS = [
  { term: "ring", re: /\bthe ring tempts you\b|\bring-bearer\b/, free: true },
  { term: "initiative", re: /\binitiative\b|\bventure into the dungeon\b|\bcompleted a dungeon\b|\bdungeons?\b/, free: true },
  { term: "dice", re: /\broll(?:s)? (?:one or more |a |two |x )?(?:d\d+|dice|die)\b|\broll(?:s)? a d\d+/, free: true },
  { term: "experience", re: /\bexperience counters?\b/, free: true },
  { term: "stun", re: /\bstun counters?\b/, free: true },
  { term: "counters", re: /\+1\/\+1 counters?|\bproliferate\b|\bkind of counter\b/, free: true },
  { term: "blood", re: /\bblood tokens?\b/ },
  { term: "clue", re: /\bclues?\b|\binvestigate\b/ },
  { term: "food", re: /\bfoods?\b/ },
  { term: "treasure", re: /\btreasures?\b/ }
];
function readCenterTerms(line) {
  const out = [];
  for (const t of CENTER_TERMS) {
    if (!t.re.test(line)) continue;
    // A repeated maker whose very first effect is the token ("Whenever ... attack a player, create a Food token") is a plan too.
    const repeatedMaker = /^(?:whenever|at the beginning)[^,]*,\s*(?:if [^,]*,\s*)?(?:you may )?(?:create|investigate)\b/.test(line);
    if (t.free || repeatedMaker || new RegExp("(?:whenever|for each|number of|sacrifice|tap|pay|if you control)(?![^.:,]*\\bcreate)[^.:,]*(?:" + t.re.source + ")").test(line)) out.push(t.term);
  }
  return out;
}

// New-set mechanics a commander can run on, defined by their reminder text (read from the cards, 2026-11-11):
// earthbend N (a land you control becomes a 0/0 haste creature with N +1/+1 counters, back tapped if it dies), firebending N
// (when it attacks, add N red mana until end of combat), waterbend (tap your artifacts and creatures to pay), airbend (exile a
// permanent, its owner may cast it for {2}), Storied (three or more artifacts, legendaries and/or Sagas make an enduring story),
// prepared (a creature with a prepare spell), speed (starts at 1, rises when an opponent loses life, max speed 4).
const CENTER_MECHANICS = [
  { name: "earthbend", re: /\bearthbend\b/ },
  { name: "firebending", re: /\bfirebending\b/ },
  { name: "waterbend", re: /\bwaterbend\b/ },
  { name: "airbend", re: /\bairbend\b/ },
  { name: "storied", re: /\bstoried\b|enduring story/ },
  { name: "prepared", re: /\bprepared\b|\bprepare spell/ },
  { name: "speed", re: /start your engines|\bmax speed\b/ },
  { name: "ninjutsu", re: /\bninjutsu\b/ }
];

function getCommanderCenter(commanderTexts) {
  const out = [];
  const add = (rec) => {
    if (!out.some((r) => JSON.stringify(r) === JSON.stringify(rec))) out.push(rec);
  };
  const clean = (w) => String(w || "").replace(/\b(?:other|another|nontoken|non-token|already)\b/g, "").replace(/s$/, "").trim();
  const COUNTS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4 };
  const texts = (commanderTexts || []).filter((t) => typeof t === "string" && t.trim());
  for (const raw of texts) {
    let etbSeen = false, otherActive = false;
    for (const ab of tagTextAbilities(raw, "")) {
      for (const a of [ab].concat(ab.quoted || [])) {
        const line = String(a.line || "").toLowerCase();
        // The commander's own words, no name needed: a bare "<subject> can't be blocked" static is evasion the commander has
        // (a lord's "creatures you control can't be blocked" or a targeted grant has another subject and reads as a delivery).
        // "Leaves the battlefield" on the commander itself, and "its power" as the number an effect reads (Ukkima).
        const bare = line.replace(/^[a-z' -]+ — /, "");   // an ability word ("Intangibility — ") is not part of the clause
        if (a.kind === "static" && /^[a-z][a-z',-]*(?: [a-z',-]+){0,3} can't be blocked(?: unless [a-z ]+)?\.?$/.test(bare) && !/^(?:creatures?|target|each|other|all|enchanted|equipped|this|it|you)\b/.test(bare)) add({ kind: "evasive" });
        if (a.kind === "triggered" && a.trigger.includes("leaves-battlefield") && /^(?:when|whenever) (?!another\b|a\b|an\b|one or more\b|each\b|target\b|nontoken\b)/.test(line)) add({ kind: "leaves" });
        if (/\b(?:where x is|equal to) (?:its|this creature's|[a-z', -]{2,40}?'s) power\b/.test(line)) add({ kind: "self-power" });
        if (a.kind !== "keyword") for (const ty of readCenterTypes(bare)) add({ kind: "type", type: ty });
        // Shapes a commander runs on that name no card type: what it does when it attacks or enters, the gear it carries,
        // the top of the library, mana that scales, a sacrifice it makes, and tapping.
        const selfSubject = /^(?:when|whenever) (?!another\b|a\b|an\b|one or more\b|each\b|target\b|nontoken\b|you\b|your\b)/.test(bare);
        // A legend's name with a comma ("Sophina, Spearsage Deserter") hides the trigger from the label reader.
        const trigLine = line.replace(/^(when(?:ever)?) [a-z'-]+(?: [a-z'-]+){0,2}, [a-z' -]{3,30}? (attacks?|enters?|dies|deals|becomes|leaves)\b/, "$1 ~ $2");
        const atkTrigger = a.kind === "triggered" && (a.trigger.includes("attacks") || /^(?:when|whenever) [^,.]*\battacks?\b/.test(trigLine)) || /^boast\b/.test(line);
        // Falthis gives the commander evasion; Esior taxes what targets it: both are about the commander's body.
        if (/^commanders you control (?:have|gain) [a-z, ]*(?:menace|flying|trample|can't be blocked)/.test(bare)) add({ kind: "evasive" });
        if (/spells your opponents cast that target [^.]*commanders? you control/.test(bare)) add({ kind: "evasive" });
        if (/(?:enter|enters) as a copy of (?:a|an|another) (?:permanent|creature|artifact) you control/.test(bare)) add({ kind: "copy" });
        if (/\bfights?\b/.test(bare) && a.kind !== "keyword") add({ kind: "fight" });
        if (/search your library for a creature card with mana value equal to the number of [a-z]+ counters/.test(bare)) add({ kind: "ladder" });
        if (/creatures your opponents control [^.]*can't block creatures with power \d or less/.test(bare)) add({ kind: "small-evasion" });
        if (/^creatures you control have haste/.test(bare)) add({ kind: "static-haste" });
        if (/put (?:a|that|those) lands? cards?[^.]*onto the battlefield/.test(bare) && a.kind !== "static") add({ kind: "event", event: "enter", filter: "land" });
        if (/\bfull party\b|\bparty\b/.test(bare)) for (const pt of ["cleric", "rogue", "warrior", "wizard"]) add({ kind: "type", type: pt });
        if (atkTrigger && !/attacks? you\b|attacking you\b/.test(line)) add({ kind: "attacks" });
        // A commander that grows itself ("put a +1/+1 counter on him", power-up, exhaust) is a body that wants to be kept alive and
        // connect: the same reads as a number it holds (Ukkima).
        if (/put (?:a|an|one|two|three|x|\w+) \+1\/\+1 counters? on (?!target|each|another|up to|that|a |an |any |one |two |the |creatures|all |it enters|them\b)[a-z'-]+/.test(bare) && !/ each other | other /.test(bare.split(" counter")[0] || "")) add({ kind: "self-power" });
        const watch = /whenever (?:[^,]{0,24}? or )?(?:another |one or more |an? |a nontoken |nontoken )*(?:other )?(?:nontoken |artifact )?(creature|artifact|enchantment|permanent)s?(?: or (creature|artifact|enchantment))? (?:you control )?enters?/.exec(bare);
        if (a.kind === "triggered" && watch && a.trigger.includes("etb")) for (const of of [watch[1], watch[2]].filter(Boolean)) add({ kind: "enter-watch", of });
        if (/spells? you cast[^.]*(?:cost[^.]*less|have |as though)|first [a-z]+ spell you cast each turn|cast [a-z ]*spells? as though (?:it|they) had flash|noncreature spells you cast/.test(bare)) add(/mana value [4-9] or greater/.test(bare) ? { kind: "cast-any", big: true } : { kind: "cast-any" });
        if (/whenever you (?:scry|surveil)/.test(bare)) add({ kind: "scry" });
        if ((a.cost || []).some((c) => /^discard-(?:card|multiple)$/.test(c)) || (a.kind === "triggered" && a.trigger.includes("discard-event"))) add({ kind: "discard" });
        for (const mech of CENTER_MECHANICS) if (mech.re.test(bare)) add({ kind: "mechanic", name: mech.name });
        if (/\bfirebending\b/.test(bare)) add({ kind: "attacks" });
        // A {T} ability that is the commander's engine (not mana): what it wants is to untap and to start without summoning sickness.
        if (a.kind === "activated" && (a.cost || []).some((c2) => c2 === "tap-self" || c2 === "tap") && !/\badd \{|\badd (?:one|two|an) /.test(bare.split(":").slice(1).join(":")) && /^(?:\{[^}]+\})+(?:, (?:\{[^}]+\})+)*(?:, [a-z ]+)?: /.test(line) && /\{t\}/.test(line.split(":")[0])) add({ kind: "tap-engine" });
        if (/copy target (?:activated or triggered )?abilit|create a token that's a copy of another target (creature|artifact)/.test(bare)) add({ kind: "copy" });
        if (/^(?:creatures|each creature) can't attack you|^creatures can't attack you or planeswalkers you control unless/.test(bare)) add({ kind: "pillowfort" });
        if (/seven or more cards in hand|no maximum hand size|cards in your hand/.test(bare)) add({ kind: "hand" });
        const kwm = /creatures? you control with (flying|first strike|deathtouch|haste|trample|menace|vigilance|lifelink|reach|hexproof|indestructible)/.exec(bare);
        if (kwm) add({ kind: "keyword", kw: kwm[1] });
        if (/\btokens? you control\b|tokens? would be created/.test(bare)) add({ kind: "event", event: "token-created" });
        if (/(?:if|when(?:ever)?) (?:a|one or more) (?:creatures?|permanents?)[^,.]*?(?:died|dies?|left the battlefield|leaves? the battlefield)(?: this turn)?|creature died (?:this turn|under)/.test(bare) && a.kind === "triggered") add({ kind: "exchange", pays: "creature", count: 1, gets: "value" });
        if (/return (?:another )?(?:target )?(?:nonland )?(?:permanent|creature)[^.]*you control to (?:its|their) owner's hand/.test(bare)) add({ kind: "enters" });
        if (a.kind === "triggered" && a.trigger.includes("combat-damage")) add({ kind: "hits" });
        if (a.kind === "triggered" && a.trigger.includes("dies")) {
          if (selfSubject) add({ kind: "leaves" });
          else add({ kind: "exchange", pays: "creature", count: 1, gets: "value" });
        }
        if (a.kind === "triggered" && (a.trigger.includes("cast-spell") || a.trigger.includes("cast-second") || a.trigger.includes("cast-noncreature")) && !/\bwhenever you cast an? [a-z]+ spell\b/.test(line)) add({ kind: "cast-any" });
        // An enter trigger is the commander's plan only when it is its one active ability (Rutstein's mill on enter and upkeep, Kardur's
        // forced attack are not: blinking them adds little); anything else it runs on is read by its own kind.
        if (a.kind === "triggered" && a.trigger.includes("etb") && selfSubject && a.trigger.every((t) => t === "etb")) etbSeen = true;
        else if (a.kind === "triggered" || a.kind === "activated") otherActive = true;
        if (/\bequipment\b|\bequipped\b|\baura\b|\benchanted\b|\battached\b|\bequip\b/.test(bare)) add({ kind: "attach" });
        if (/from the top of your library|cast (?:any number of |a |an |up to \w+ )?(?:[a-z]+ )?spells? from among|exile the top (?:\w+ )?cards? of your library|top card of your library any time/.test(bare)) add({ kind: "top" });
        if (/\badd (?:an amount|that much|six|two mana|one mana of any type that land produced|an additional)|twice that much mana|doubles? (?:the )?mana|create [^.]*token[^.]*"\{t\}: add/.test(bare)) add({ kind: "mana-scale" });
        const sacM = /\bsacrifice (?:up to (?:\w+) |another |an? |one or more |x |any number of )(creature|artifact|permanent|enchantment|land|food|treasure|clue|equipment)s?\b/.exec(bare);
        if (sacM && !/sacrifice (?:this|it)\b/.test(bare.slice(sacM.index, sacM.index + 14))) add({ kind: "exchange", pays: sacM[1], count: 1, gets: "value" });
        if ((a.kind === "triggered" && a.trigger.includes("becomes-tapped")) || /\buntap (?:target|another|up to|two|all)\b/.test(bare) && a.kind !== "triggered") add({ kind: "tap" });
        if (a.kind !== "keyword") for (const tm of readCenterTerms(bare)) add(tm === "counters" ? { kind: "term", term: tm, thin: true } : { kind: "term", term: tm });
        let m = /costs \{[xm]\} less to cast, where x is the (total|greatest) power (?:of|among) creatures you control/.exec(line);
        if (m) add({ kind: "quantity", measure: m[1] + "-power", uses: "cost-reduction" });
        // Ghalta the Immovable / Rasaad: the number is toughness (cost reduction, or combat damage dealt equal to toughness).
        if (/costs \{[xm]\} less to cast, where x is the (?:total|greatest) toughness|assigns? combat damage equal to (?:its|their) toughness/.test(line)) add({ kind: "quantity", measure: "greatest-toughness", uses: "cost-reduction" });
        m = /for each ([a-z' -]+?) you (?:already )?control/.exec(line) || /the number of ([a-z' -]+?) you control/.exec(line);
        if (m && !/^(?:creature|permanent)s?$/.test(clean(m[1])) || (m && /creature/.test(m[1]))) add({ kind: "quantity", measure: "count", filter: clean(m[1]), uses: a.kind === "static" ? "scaling" : "scaling" });
        // Thalisse: every token made this turn (Treasure, Clue and the rest too) is counted at an end step.
        if (/number of tokens you created this turn/.test(line)) add({ kind: "event", event: "token-created" });
        // Eluge: a flood counter turns any land (an opponent's too) into an Island, which switches on islandwalk.
        m = /\b(?:it's|it is|becomes?|is) an? (island|swamp|forest|mountain|plains)\b[^.]*in addition to its other types|target lands? (?:becomes?|is) an? (island|swamp|forest|mountain|plains)\b|\blands (?:your opponents control |you don't control )?are (island|swamp|forest|mountain|plain)s?\b/.exec(line);
        if (m) add({ kind: "land-type", land: m[1] || m[2] || m[3] });
        // Radagast, Eluge: "the first creature spell you cast each turn costs {2} less": one spell a turn is cheaper, so the
        // types it names are the event, and a dear spell of that type is the one worth the discount.
        m = /the first ([a-z]+(?: or [a-z]+)?) spell you cast each turn costs?\b/.exec(line);
        if (m) for (const f of m[1].split(" or ")) add({ kind: "event", event: "cast", filter: f, discount: true, thin: true });
        // Selvala: every activation makes every player draw, so a card that triggers on draws is the payoff.
        if (/\b(?:each|every) player draws? (?:a|an|one|two|\d+) cards?|then each player draws/.test(line)) add({ kind: "event", event: "draw-each", thin: true });
        // Gut: "you may sacrifice another creature or an artifact. If you do, create ...": an exchange paid with either type.
        m = /you may sacrifice (?:a |an |another |one )?([a-z]+?)(?: or (?:a |an |another )?([a-z]+?))?\. if you do, (create|draw|return)\b/.exec(line);
        if (m) for (const kind of [m[1], m[2]].filter(Boolean)) add({ kind: "exchange", pays: clean(kind), count: 1, gets: m[3] === "create" ? "tokens" : m[3] === "draw" ? "draw" : "return a card from the graveyard" });
        if (a.kind === "triggered") {
          m = /whenever you cast an? ([a-z]+) spell/.exec(line);
          if (m) add({ kind: "event", event: "cast", filter: m[1] });
          if (/whenever you gain life/.test(line)) add({ kind: "event", event: "gain-life" });
          m = /whenever (?:another |one or more |an? )?(?:nontoken )?([a-z]+?)s? (?:you control )?enters?/.exec(line);
          if (m && !/^(?:creature|permanent|land)$/.test(m[1])) add({ kind: "event", event: "enter", filter: m[1] });
        }
        if (a.kind === "activated" && a.cost.includes("sacrifice-other")) {
          const cost = line.split(":")[0];
          const sac = /sacrifice (a|an|one|two|three|four|another) ([a-z]+?)s?(?:,|$| )/.exec(cost);
          const kinds = a.effects.map((e) => e.label);
          let gets = null;
          if (/where x is the sacrificed creature's power/.test(line)) gets = "tokens equal to its power";
          else if (kinds.includes("return-from-graveyard")) gets = "return a card from the graveyard";
          else if (kinds.includes("draw")) gets = "draw";
          else if (kinds.includes("create-token")) gets = "tokens";
          if (sac && gets) add({ kind: "exchange", pays: clean(sac[2]), count: COUNTS[sac[1]] || 1, gets });
        }
        for (const e of a.effects) {
          if (e.label === "grant-keyword" || e.label.startsWith("keyword:")) {
            const k = /\b(trample|flying|menace|unblockable|haste)\b/.exec(line);
            if (k) add({ kind: "delivery", keyword: k[1] });
          }
        }
      }
    }
    if (etbSeen && !otherActive) add({ kind: "enters" });
  }
  return out;
}

function parseCommanderNeeds(commanderTexts) {
  const text = (commanderTexts || [])
    .filter((t) => typeof t === "string" && t.trim())
    .map((t) => t.toLowerCase())
    .join("\n");
  const needs = { payloadType: null, payloadTypes: [], graveyard: false, returnsFromGraveyard: false, devotionColors: [], events: [], center: [] };
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

  // A commander that names Mounts and/or Vehicles (Miriam, Lagorin, Caradora) is for either or both:
  // each named type is a payload, Vehicle first as the primary one.
  needs.payloadTypes = needs.payloadType ? [needs.payloadType] : [];
  // A return clause that names two types stays unread (it is ambiguous), so only a commander without one is scanned.
  for (const word of needs.returnsFromGraveyard ? [] : ["vehicle", "mount"]) {
    if (new RegExp(`\\b${word}s?\\b`).test(text.replace(/\([^)]*\)/g, " ")) && !needs.payloadTypes.includes(word)) needs.payloadTypes.push(word);
  }
  if (!needs.payloadType && needs.payloadTypes.length) needs.payloadType = needs.payloadTypes[0];

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
  needs.center = getCommanderCenter(commanderTexts);
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

// Every payload type a commander names (payloadType alone for needs built without the list).
function getPayloadTypes(needs) {
  if (!needs) return [];
  if (needs.payloadTypes && needs.payloadTypes.length) return needs.payloadTypes;
  return needs.payloadType ? [needs.payloadType] : [];
}

function getPayloadNames(needs) {
  return getPayloadTypes(needs).map((t) => t.charAt(0).toUpperCase() + t.slice(1));
}

// With two payload types a card is read once per type and the strongest reading of each class kept.
function getEngineClassDetails(card, needs) {
  const types = getPayloadTypes(needs);
  if (types.length < 2) return getEngineClassDetailsForType(card, needs);
  const merged = new Map();
  for (const t of types) {
    for (const d of getEngineClassDetailsForType(card, { ...needs, payloadType: t })) {
      const prev = merged.get(d.cls);
      if (!prev || (prev.weak && !d.weak) || (prev.weak === d.weak && d.flaws.length < prev.flaws.length)) merged.set(d.cls, d);
    }
  }
  return Array.from(merged.values());
}

function getEngineClassDetailsForType(card, needs) {
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
      if (getCardType(card).includes("creature") && Number(card.cmc || 0) <= 2 && getCrewPower(card) >= 3) add("crewBody", false, []);
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

function hasCenterNeeds(needs) {
  return Boolean(needs && Array.isArray(needs.center) && needs.center.some((c) => c.kind !== "delivery"));
}

function isEventClass(cls) {
  return String(cls).startsWith("event:");
}

// The "Event Engines" switch (a build mode): off drops every event, so the builder runs exactly as it
// did before events existed. `modePrefs.eventEngines` is undefined when no mode was parsed, which keeps events.
function applyEventSwitch(needs, modePrefs) {
  if (needs && modePrefs && modePrefs.eventEngines === false) { needs.events = []; needs.center = []; needs.sharedTerms = null; }
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

// A Vehicle deck carries about one vehicle per this many creatures (a 19-crew-creature, 15-vehicle
// list is typical): a vehicle with no one to crew it is a dead card.
const ENGINE_CREATURES_PER_VEHICLE = 1.25;
// A Vehicle deck is built with at least this many creatures, however few the average EDHREC list runs.
const ENGINE_VEHICLE_PLAN_CREATURES = 24;
// The artifact target a Vehicle deck gets at least (an average list runs about 15 vehicles).
const ENGINE_VEHICLE_PLAN_ARTIFACTS = 15;

function isNoncreatureVehicle(card) {
  const type = getCardType(card);
  return type.includes("vehicle") && !type.split("—")[0].includes("creature");
}

// When a commander's payload includes Vehicles: lifts the creature bucket to the plan minimum and returns
// how many vehicles the creature target can crew (0 when there is no vehicle payload). The build then
// picks vehicles as usual and drops the rest from its pools once it holds that many, so the cap trims
// the spares, not the best.
function planPayloadVehicles(creatureBucket, needs, artifactBucket = null) {
  if (!getPayloadTypes(needs).includes("vehicle")) return 0;
  creatureBucket.target = Math.max(creatureBucket.target, ENGINE_VEHICLE_PLAN_CREATURES);
  creatureBucket.min = Math.max(creatureBucket.min, ENGINE_VEHICLE_PLAN_CREATURES - 4);
  const ceiling = Math.max(1, Math.floor(creatureBucket.target / ENGINE_CREATURES_PER_VEHICLE));
  // Vehicles are artifacts, so an average list's artifact target would otherwise cut the best vehicles.
  if (artifactBucket) artifactBucket.target = Math.max(artifactBucket.target, Math.min(ceiling, ENGINE_VEHICLE_PLAN_ARTIFACTS));
  return ceiling;
}

// Removes every non-creature vehicle from the score-sorted pools, in place.
function dropSpareVehicles(pools) {
  for (const pool of pools) {
    for (let i = pool.length - 1; i >= 0; i -= 1) {
      if (isNoncreatureVehicle(pool[i])) pool.splice(i, 1);
    }
  }
}

// What a creature adds toward crewing, which is its power unless its own text says otherwise: "crews
// Vehicles using its toughness rather than its power" (Giant Ox) or "as though its power were 2
// greater" (Hotshot Mechanic). A token maker's quoted text is not the creature's own. Unknown power
// reads NaN, as in a test fixture with no Scryfall record.
function getCrewPower(card) {
  const raw = card.raw || card;
  const power = Number(raw.power);
  const text = getCardText(card).replace(/"[^"]*"/g, " ").replace(/\([^)]*\)/g, " ");
  if (/\bcrews vehicles using its toughness rather than its power/.test(text)) return Number(raw.toughness);
  const boost = text.match(/\bcrews vehicles as though its power were (\d+) greater/);
  return boost ? power + Number(boost[1]) : power;
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

// What a card does for the commander's center: one link per way it feeds, reads or delivers the number,
// event or exchange (design spec, section 3). Weights are first guesses, meant to be measured.
const CENTER_BONUS_CAP = 20;
const CENTER_LINK_WEIGHTS = {
  "protects": 6, "damage-payoff": 6, "grants-evasion": 3, "makes-leave": 10, "comes-back-on-leave": 8, "leave-payoff": 8, "raises-power": 8,
  "supplies-power": 8, "big-power": 10, "multiplies-power": 10, "ramps-at-power": 10, "reads-power": 8, "grants-delivery": 3,
  "counts-type": 5, "boosts-type": 8, "reads-count": 8, "mech-same": 8, "fight-source": 6, "fight-body": 4, "ladder-step": 2, "ladder-etb": 6, "small-evasion": 2, "haste-body": 4, "mana-token": 4, "ninja-enabler": 6, "tap-untap": 5, "tap-haste": 4, "copy-target": 6, "pillow-piece": 8, "draw-for-hand": 5, "kw-member": 5, "big-toughness": 10, "supplies-toughness": 6, "land-matters": 6, "combat-sink": 4, "bend-fodder": 6, "story-member": 5, "life-loss": 8, "enter-member": 5, "enter-maker": 6, "scry-source": 6, "discard-source": 6, "discard-payoff": 6, "big-spell": 5, "cheap-spell": 3, "spell-copy": 8, "double-strike": 6, "extra-combat": 10, "attack-payoff": 6, "haste-giver": 4, "blink": 10, "etb-doubler": 12, "bounce-own": 6, "etb-body": 3, "attach-member": 5, "attach-helper": 8, "attach-tutor": 6, "attach-payoff": 6, "top-setup": 6, "free-cast": 6, "mana-sink": 6, "mana-doubler": 10, "untaps": 8, "tap-payoff": 6, "term-link": 6, "term-link-common": 2, "term-doubler": 10, "type-member": 5, "type-payoff": 8, "type-lord": 8, "type-maker": 6,
  "makes-event": 6, "makes-event-once": 2, "makes-type": 6, "makes-type-weak": 3, "event-payoff": 10, "cheaper-casts": 8,
  "landwalk": 14, "makes-land-type": 10, "discount-target": 4, "draw-payoff-all": 14, "draw-payoff": 8, "group-draw": 6, "hand-room": 4, "makes-tokens-burst": 14, "makes-tokens-repeat": 10, "makes-token": 4, "doubles-tokens": 14, "token-payoff": 4,
  fodder: 2, "fodder-dies": 3, "graveyard-leave-payoff": 8, outlet: 6, "death-payoff": 6, "return-target": 6, "return-target-small": 3, reanimates: 8, "comes-back": 4, "graveyard-fill": 6, "power-fodder": 6
};

function centerTypeHas(card, type) {
  if (!type) return false;
  const line = getCardType(card);
  return line.split("—")[0].split(/\s+/).includes(type) || (line.split("—")[1] || "").split(/\s+/).includes(type);
}

function getCenterLinks(card, needs) {
  if (!card || !needs || !Array.isArray(needs.center) || !needs.center.length) return [];
  const type = getCardType(card);
  if (type.split("—")[0].includes("land")) return [];
  const text = getCardText(card).replace(/\([^)]*\)/g, " ");
  const cmc = Number(card.cmc) || 0;
  const isCreature = type.includes("creature");
  const power = parseInt((card.raw && card.raw.power) != null ? card.raw.power : card.power, 10) || 0;
  const abilities = getCardAbilities(card);
  const found = new Map();
  const add = (name, via) => { if (!found.has(name)) found.set(name, { link: name, via, weight: CENTER_LINK_WEIGHTS[name] || 0 }); };
  const mentions = (word) => new RegExp("\\b" + word + "s?\\b").test(text);
  const usesLabel = (label) => abilities.some((ab) => ab.effects.some((e) => e.label === label));

  for (const c of needs.center) {
    if (c.kind === "quantity" && /power$/.test(c.measure)) {
      if (isCreature && power >= 6) add("big-power", "power " + power);
      else if (isCreature && power >= 4) add("supplies-power", "power " + power);
      if (abilities.some((ab) => ab.effects.some((e) => e.label === "counters" && e.counter === "+1/+1") && /\b(?:put|enters with)\b/.test(ab.line))) add("supplies-power", "puts +1/+1 counters");
      if (/\bdoubles? (?:the |its |their )?power|twice (?:its|their) power|power and toughness (?:are|is) doubled/.test(text) || /(?:x \+1\/\+1 counters|\+x\/\+x|x damage|draw x cards)[^.]*where x is [^.]*\bpower\b|x is (?:its|that creature's|the greatest) power/.test(text)) add("multiplies-power", "doubles or scales power");
      if (usesLabel("add-mana") && /\bpower\b/.test(text)) add("ramps-at-power", "mana that reads power");
      if (/\b(?:greatest|total) power\b|power \d+ or greater/.test(text)) add("reads-power", "reads power");
      if (/(?:other )?creatures you control (?:have|gain) trample|trample to/.test(text)) add("grants-delivery", "grants trample");
    }
    if (c.kind === "quantity" && /toughness$/.test(c.measure)) {
      const tough = parseInt((card.raw && card.raw.toughness) != null ? card.raw.toughness : card.toughness, 10) || 0;
      if (isCreature && tough >= 7) add("big-toughness", "toughness " + tough);
      else if (isCreature && tough >= 4) add("supplies-toughness", "toughness " + tough);
      if (/\+\d\/\+\d|doubles? (?:the )?toughness|toughness (?:is|are) doubled/.test(text) && /toughness|creatures you control get/.test(text)) add("multiplies-power", "pumps toughness");
    }
    if (c.kind === "quantity" && c.measure === "count" && c.filter) {
      if (centerTypeHas(card, c.filter)) add("counts-type", "is a " + c.filter);
      if (new RegExp("(?:for each|number of|affinity for) [^.]*\\b" + c.filter + "s?\\b").test(text)) add("reads-count", "reads the " + c.filter + " count");
      if (abilities.some((ab) => ab.effects.some((e) => ["anthem-lord", "counters", "pump"].includes(e.label)) && new RegExp("\\b" + c.filter + "s? (?:creatures? )?you control|each " + c.filter).test(ab.line))) add("boosts-type", "grows " + c.filter + "s");
    }
    if (c.kind === "type" && c.type) {
      const tword = c.type.replace(/[^a-z']/g, "");
      const isIt = centerTypeHas(card, tword);
      if (isIt) add("type-member", "is a " + tword);
      const re = new RegExp("\\b" + tword + "(?:s|es)?\\b");
      if (!isIt && re.test(text)) add("type-payoff", "names " + tword);
      if (abilities.some((ab) => ab.effects.some((e) => ["anthem-lord", "counters", "pump"].includes(e.label)) && new RegExp("\\b" + tword + "s? (?:creatures? )?you control|each " + tword).test(ab.line))) add("type-lord", "grows " + tword + "s");
      if (new RegExp("create[^.]*\\b" + tword + "\\b[^.]*token").test(text) || new RegExp("create[^.]*token[^.]*\\b" + tword + "\\b").test(text)) add("type-maker", "makes " + tword + "s");
    }
    if (c.kind === "term" && c.term) {
      const def = CENTER_TERMS.find((t) => t.term === c.term);
      if (def && (def.re.test(text) || (!def.free && centerTypeHas(card, c.term)))) add(c.term === "counters" ? "term-link-common" : "term-link", "uses " + c.term);
      if (c.term === "counters" && /(?:twice|double) that many|one or more [^.]*counters? would be put|doubles? the number of (?:each kind of )?counters|\bproliferate\b/.test(text)) add("term-doubler", "multiplies counters");
    }
    if (c.kind === "enter-watch") {
      if (c.of !== "creature" && c.of !== "permanent" && centerTypeHas(card, c.of)) add("enter-member", "is an " + c.of);
      const makes = c.of === "creature" ? /create[^.]*creature token|creates? [^.]*tokens?/ : c.of === "artifact" ? /create[^.]*(?:artifact|treasure|clue|food|blood|powerstone|map)/ : c.of === "enchantment" ? /create[^.]*enchantment|\bsaga\b/ : /create[^.]*token/;
      if (makes.test(text)) add("enter-maker", "makes " + c.of + "s");
      if (/exile (?:target|another|up to \w+ target)[^.]*you control[^.]*return (?:it|that card|them)|flicker/.test(text)) add("blink", "flickers a permanent");
      if (/trigger an additional time/.test(text)) add("etb-doubler", "enter triggers fire again");
    }
    if (c.kind === "scry" && /\bscry\b|surveil/.test(text)) add("scry-source", "scries or surveils");
    if (c.kind === "discard") {
      if (/discard (?:a|two|three|x|your hand)|rummage|\bloot\b|draw[^.]*then discard/.test(text)) add("discard-source", "discards");
      if (/whenever (?:you|a player|an opponent) discards?/.test(text)) add("discard-payoff", "discard payoff");
    }
    if (c.kind === "mechanic") {
      const def = CENTER_MECHANICS.find((m) => m.name === c.name);
      if (def && def.re.test(text)) add("mech-same", "uses " + c.name);
      if (c.name === "earthbend" && /lands? you control (?:are|become|is)|creature lands?|animate|target land you control/.test(text)) add("land-matters", "cares about land creatures");
      if (c.name === "firebending") {
        if (/additional combat phase/.test(text)) add("extra-combat", "extra combat doubles the mana");
        if (/instant/.test(type) && /\bgets? \+\d\/\+\d|\bdeals? \d+ damage|\bdouble strike\b/.test(text)) add("combat-sink", "spends combat mana");
        if (/creatures you control (?:have|gain) haste/.test(text)) add("haste-giver", "team haste");
      }
      if (c.name === "waterbend") {
        if (/create[^.]*token/.test(text)) add("bend-fodder", "makes bodies to tap");
        if (/untap (?:target|another|all|up to|two|each)/.test(text)) add("untaps", "untaps");
      }
      if (c.name === "airbend" && /exile (?:target|another|up to \w+ target)[^.]*you control[^.]*return (?:it|that card|them)|flicker/.test(text)) add("blink", "flickers a permanent");
      if (c.name === "storied" && cmc <= 3 && (/\b(?:artifact|saga)\b/.test(type) || /^legendary\b|\blegendary\b/.test(type.split("\u2014")[0]))) add("story-member", "counts toward the story");
      if (c.name === "ninjutsu" && isCreature && cmc <= 3 && /can't be blocked|\bflying\b|\bmenace\b|\bshadow\b|\bfear\b/.test(text + " " + (card.raw && card.raw.keywords ? card.raw.keywords.join(" ").toLowerCase() : ""))) add("ninja-enabler", "an evasive body to swap");
      if (c.name === "speed" && /each opponent loses \d+ life|each opponent loses x life|deals (?:\d+|x) damage to each opponent|drain/.test(text)) add("life-loss", "an opponent loses life");
    }
    if (c.kind === "tap-engine") {
      if (/untap (?:target|another|all|up to|two|each)/.test(text)) add("tap-untap", "untaps the engine");
      if (/creatures you control (?:have|gain) haste/.test(text)) add("tap-haste", "no summoning sickness");
    }
    if (c.kind === "copy" && (isCreature || /artifact/.test(type)) && abilities.some((ab) => (ab.trigger.includes("etb") || ab.kind === "activated" || ab.kind === "triggered") && ab.effects.some((e) => ["draw", "create-token", "counters", "return-from-graveyard", "destroy", "damage", "search"].includes(e.label)))) add("copy-target", "an ability worth copying");
    if (c.kind === "pillowfort" && /can't attack you|attack you[^.]*unless|prevent all combat damage that would be dealt to you/.test(text)) add("pillow-piece", "keeps attackers off");
    if (c.kind === "hand" && /draw (?:a|two|three|x|\w+) cards?|\bdraws? /.test(text)) add("draw-for-hand", "fills the hand");
    if (c.kind === "keyword" && c.kw && isCreature && (new RegExp("\\b" + c.kw + "\\b").test(text) || ((card.raw && card.raw.keywords) || []).map((k) => String(k).toLowerCase()).includes(c.kw))) add("kw-member", "has " + c.kw);
    if (c.kind === "evasive" || c.kind === "commander-body") {
      if (/\b(?:equipped|enchanted) creature (?:has|gains?) (?:hexproof|indestructible|protection)|\bhexproof\b[^.]*(?:until end of turn|target)|protection from/.test(text) && !found.has("protects")) add("protects", "protects the commander");
    }
    if (c.kind === "fight") {
      if (/\bfights?\b|deals damage equal to its power to target creature|\bbite\b/.test(text) && !isCreature) add("fight-source", "fights or bites");
      else if (isCreature && (power >= 5 || /deathtouch/.test(text + " " + (((card.raw && card.raw.keywords) || []).join(" ")).toLowerCase()))) add("fight-body", "wins a fight");
    }
    if (c.kind === "ladder" && isCreature && cmc >= 1 && cmc <= 7) {
      add("ladder-step", "a step at mana value " + cmc);
      if (abilities.some((ab) => ab.trigger.includes("etb") && ab.effects.length)) add("ladder-etb", "value when it arrives");
    }
    if (c.kind === "small-evasion" && isCreature && power <= 2 && cmc <= 3) add("small-evasion", "a small creature that gets through");
    if (c.kind === "static-haste" && isCreature && cmc >= 5 && power >= 5) add("haste-body", "a big creature that can hit at once");
    if (c.kind === "hits") {
      if (/additional combat phase/.test(text)) add("extra-combat", "extra combat");
      if (/(?:has|have|gains?) (?:flying|menace|trample|can't be blocked|double strike|shadow)|can't be blocked/.test(text)) add("grants-evasion", "evasion");
      if (/double strike/.test(text) && /creatures? you control|equipped creature/.test(text)) add("double-strike", "double strike");
      if (/whenever [^.,]*deals combat damage to a (?:player|opponent)/.test(text)) add("damage-payoff", "combat damage payoff");
    }
    if (c.kind === "cast-any") {
      if (/spells? (?:you cast )?costs? (?:\{[^}]+\})+ less|costs? (?:\{[^}]+\})+ less to cast/.test(text)) add("cheaper-casts", "cheaper spells");
      if (/copy target (?:instant|sorcery|spell)|copy (?:that|the) spell/.test(text)) add("spell-copy", "copies spells");
      if (/instant|sorcery/.test(type) && cmc <= 2) add("cheap-spell", "cheap spell");
      if (c.big && cmc >= 5 && !/land/.test(type)) add("big-spell", "a spell worth the discount");
    }
    if (c.kind === "attacks") {
      if (/additional combat phase|untap all creatures that attacked/.test(text)) add("extra-combat", "extra combat");
      if (/whenever (?:you attack|(?:a|another|one or more)[^.,]* attacks?)/.test(text)) add("attack-payoff", "attack trigger");
      if (/creatures you control (?:have|gain) haste/.test(text)) add("haste-giver", "team haste");
      if (/creatures you control (?:have|gain) (?:flying|menace|trample)|can't be blocked/.test(text)) add("grants-evasion", "team evasion");
    }
    if (c.kind === "enters") {
      if (/exile (?:target|another|up to \w+ target)[^.]*you control[^.]*return (?:it|that card|them)|flicker|exile[^.]*then return (?:it|that card|them) to the battlefield/.test(text)) add("blink", "flickers a permanent");
      if (/trigger an additional time|triggers? (?:one )?additional time/.test(text)) add("etb-doubler", "enter triggers fire again");
      if (/return (?:target|another|up to \w+ target) (?:nonland permanent|creature|permanent) you control to (?:its|their) owner's hand/.test(text)) add("bounce-own", "returns your own permanent");
      if (isCreature && cmc >= 2 && abilities.some((ab) => ab.trigger.includes("etb") && ab.effects.length)) add("etb-body", "enters trigger");
    }
    if (c.kind === "attach") {
      if (/\b(?:equipment|aura)\b/.test(type)) add("attach-member", "is gear");
      else if (/equip (?:abilities|costs?)|equipment[^.]*(?:cost|enters)|attach (?:target |an? )?equipment|aura and equipment/.test(text)) add("attach-helper", "helps gear");
      if (/search your library for an? (?:aura|equipment)/.test(text)) add("attach-tutor", "finds gear");
      else if (!/\b(?:equipment|aura)\b/.test(type) && /equipped creature|enchanted creature|attached to/.test(text)) add("attach-payoff", "pays off gear");
    }
    if (c.kind === "top") {
      if (/\bscry\b|surveil|look at the top|on top of your library|rearrange/.test(text)) add("top-setup", "sets up the top");
      if (/without paying (?:its|their) mana cost|\bcascade\b|\bdiscover\b/.test(text)) add("free-cast", "casts for free");
    }
    if (c.kind === "mana-scale") {
      if (/\{x\}/.test(String(card.manaCost || card.mana_cost || "").toLowerCase() + text) || cmc >= 7) add("mana-sink", "spends big mana");
      if (/untap (?:target|all|up to \w+) lands?|add (?:an additional|twice)|doubles? (?:the )?mana/.test(text)) add("mana-doubler", "adds more mana");
    }
    if (c.kind === "tap") {
      if (/untap (?:target|another|all|up to|two|each)/.test(text)) add("untaps", "untaps");
      if (/whenever (?:this creature|[a-z',]+) becomes tapped|whenever you tap/.test(text)) add("tap-payoff", "tap trigger");
    }
    if (c.kind === "land-type") {
      // The commander makes lands of this type, so "defending player controls an X" is true on demand: a card with
      // or giving X-walk, or that can only attack into an X, is unblockable or able to attack; a card that makes
      // an X land or reads the X count feeds or reads the same number.
      const L = c.land;
      if (new RegExp("\\b" + L + "walk\\b|can't attack unless defending player controls an? " + L).test(text)) add("landwalk", L + "walk or needs a defending " + L);
      if (new RegExp("\\bland[^.]*(?:becomes?|is) an? " + L + "\\b|flood counter on target land").test(text)) add("makes-land-type", "makes a land " + (L.charAt(0).toUpperCase() + L.slice(1)));
    }
    if (c.kind === "event" && c.event === "token-created") {
      // The number is the tokens made in one turn, so a card that makes several at once (or twice, with flashback) counts
      // for more than one that makes a single token, and a maker that keeps going adds to either.
      const makes = [];
      // "create" is the commander's side; an opponent "creates" the token (Wanted Scoundrels), which does not count.
      const makeRx = /\bcreate\s+(an?|one|two|three|four|five|six|x|\d+|that many|a number of)\b[^.]*?\btokens?\b[^.]*/g;
      let mk;
      while ((mk = makeRx.exec(text))) makes.push({ n: { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }[mk[1]] || (/^\d+$/.test(mk[1]) ? Number(mk[1]) : 3), clause: mk[0] });
      const doubles = /would create one or more tokens|twice that many (?:of those )?tokens|double the number of tokens/.test(text);
      if (doubles) add("doubles-tokens", "doubles the tokens you make");
      else if (makes.length) {
        const biggest = Math.max(...makes.map((x) => x.n));
        // "For each Equipment attached" or "for each Shrine" can be zero, and a d20 table pays out rarely, so neither is a
        // sure burst. They stay a single-token link.
        const perEach = makes.some((x) => /\bfor each\b/.test(x.clause));
        const rolled = /\broll a d\d+/.test(text);
        if (!perEach && !rolled && (biggest >= 2 || /\bflashback\b/.test(text))) add("makes-tokens-burst", "makes " + biggest + " tokens at once");
        // A one-time cost from hand or graveyard (channel, a graveyard exile) is not an engine that keeps going.
        const oneTimeCost = (line) => /(?:sacrifice|exile|discard) (?:~|this (?:card|creature|enchantment|artifact|permanent))/.test(line);
        const repeats = abilities.some((ab) => ab.effects.some((e) => e.label === "create-token")
          && ((ab.kind === "triggered" && !ab.trigger.every((t) => t === "etb" || t === "dies"))
            || (ab.kind === "activated" && !oneTimeCost(String(ab.line).split(":")[0]))));
        if (repeats) add("makes-tokens-repeat", "keeps making tokens");
        if (!found.has("makes-tokens-burst") && !found.has("makes-tokens-repeat")) add("makes-token", "makes a token");
      }
      if (/tokens? you control (?:get|have|gain)|whenever (?:one or more |a |another )?(?:creature )?tokens? (?:you control )?(?:enters?|dies?|are created)|for each token you control|whenever you create (?:a|one or more) tokens?/.test(text)) add("token-payoff", "pays off tokens");
    }
    if (c.kind === "event" && c.event === "gain-life") {
      // Dina: every life gain is a trigger, so a card that gains life (lifelink, a drain, an enters gain) makes the event,
      // another "whenever you gain life" card pays off the same event, and Food makes it later (weak).
      // Only a source that keeps gaining life (lifelink, a recurring trigger, an ability that does not use the card up) is a real
      // engine; one gain from a spell, an enters trigger or a sacrifice is one drain and ranks low.
      const gains = abilities.filter((ab) => ab.effects.some((e) => e.label === "gain-life"));
      const repeats = gains.some((ab) => (ab.kind === "triggered" && !ab.trigger.some((t) => t === "etb" || t === "dies"))
        || (ab.kind === "activated" && !/(?:sacrifice|exile) ~/.test(String(ab.line).split(":")[0])));
      if (/\blifelink\b/.test(text) || repeats) add("makes-event", "keeps gaining life");
      else if (gains.length) add("makes-event-once", "gains life once");
      if (/whenever you gain life|whenever you gain or lose life/.test(text)) add("event-payoff", "triggers on life gain");
      if (/create (?:an? |\w+ )?food token/.test(text)) add("makes-type-weak", "makes Food");
    }
    if (c.kind === "event" && c.event === "draw-each") {
      if (/whenever (?:an opponent|a player|each opponent|another player|each player)[^.,]*\bdraws?\b/.test(text)) add("draw-payoff-all", "triggers on opponents' draws");
      else if (/whenever you draw\b/.test(text)) add("draw-payoff", "triggers on your draws");
      if (/each player draws? (?:a|an|one|two|three|\d+) cards?/.test(text)) add("group-draw", "more draws for everyone");
      if (/no maximum hand size/.test(text)) add("hand-room", "no maximum hand size");
    }
    if (c.kind === "event" && c.filter) {
      const f = c.filter;
      if (c.event === "cast" && centerTypeHas(card, f)) {
        if (!c.discount) add("makes-event", "a " + f + " spell");
        else if (cmc >= 4 && cmc <= 6) add("discount-target", "a " + f + " spell worth the discount");   // a flat discount brings a 4-6 drop a turn or two sooner; a 7+ stays dear
      }
      if (c.event === "enter" && centerTypeHas(card, f)) add("makes-event", "a " + f + " entering");
      if (!c.discount && abilities.some((ab) => ab.effects.some((e) => e.label === "create-token") && new RegExp("\\b" + f + "\\b").test(ab.line))) add(c.event === "cast" ? "makes-type-weak" : "makes-type", "makes " + f + " tokens");
      // The number behind a typed event is the count of that type (Sai: artifacts), so cards that scale with it link too.
      // A discount event names a broad type (every creature, every instant), so only the discount links, not the type's count or boosts.
      if (!c.discount && new RegExp("(?:for each|number of|affinity for) [^.]*\\b" + f + "s?\\b").test(text)) add("reads-count", "reads the " + f + " count");
      // A discount event is a cast, so only a cast trigger pays it off ("this creature becomes the target of a spell" and enters triggers do not).
      const payoff = c.discount ? "whenever (?:you|a player|an opponent) casts? (?:an? |another |your )?[^.,]*\\b" + f + "s?\\b[^.,]*spell" : "whenever (?:you cast an? |another |one or more |an? )?[^.,]*\\b" + f + "s?\\b[^.,]*(?:spell|enters?)";
      if (new RegExp(payoff).test(text)) add("event-payoff", "triggers on " + f);
      if (new RegExp("\\b" + f + " spells you cast cost").test(text)) add("cheaper-casts", f + " spells cost less");
      if (!c.discount && abilities.some((ab) => ab.effects.some((e) => ["anthem-lord", "counters", "pump"].includes(e.label)) && new RegExp("\\b" + f + "s? (?:creatures? )?you control|each " + f).test(ab.line))) add("boosts-type", "grows " + f + "s");
    }
    if (c.kind === "evasive") {
      // The commander cannot be blocked, so commander damage connects. What helps: protecting it, paying off damage to a
      // player, and (a small link) other creatures that get through too.
      if (/(?:equipped|enchanted) creature (?:has|gains?|gets)[^.]*\b(?:hexproof|indestructible|shroud)\b|target creature you control (?:gains?|gets)[^.]*\b(?:hexproof|indestructible|shroud)\b|creatures you control (?:have|gain)[^.]*\b(?:hexproof|indestructible)\b/.test(text)) add("protects", "hexproof or indestructible for it");
      if (/whenever (?:a |one or more |another |any )?(?:other )?(?:creatures? (?:you control )?|equipped creature |enchanted creature )(?:deals?|dealt) combat damage to (?:a player|an opponent|one or more players)/.test(text) || /enchanted creature has "whenever this creature deals combat damage to a player/.test(text) || /equipped creature has "whenever this creature deals combat damage to a player/.test(text)) add("damage-payoff", "pays when a creature connects");
      if (/(?:target creature|creatures you control|equipped creature|enchanted creature|another target attacking creature)[^.]*can't be blocked/.test(text)) add("grants-evasion", "gives another creature evasion");
    }
    if (c.kind === "leaves") {
      // The commander has an ability on leaving the battlefield (Ukkima), so a card that makes it leave on demand, one that
      // brings it back after removal, or a watcher of creatures leaving all link. Repeating them is insurance, not waste.
      if (/exile (?:up to (?:one|two) )?(?:another )?target (?:creature|nonland permanent|permanent|artifact or creature)s?(?: you control| you own)?[^.]*,? then return|exile (?:up to (?:one|two) )?target creatures? you control[^.]*return|return (?:up to one )?target (?:another )?creature you control to (?:its owner's|your) hand|\bphases? out\b|flicker/.test(text)) add("makes-leave", "makes a creature leave and return");
      else if (abilities.some((ab) => ab.kind === "activated" && ab.cost.includes("sacrifice-other"))) add("makes-leave", "sacrifice outlet");
      if (/when (?:this creature|it) dies, return (?:it|that card)|when (?:this creature|it) dies[^.]*return it to the battlefield|dies[^.]*return it to the battlefield/.test(text)) add("comes-back-on-leave", "returns it after it dies");
      if (/whenever (?:your commander|a creature you control|another creature you control|one or more creatures you control)[^.,]*\bleaves? the battlefield|commander creatures you own have "when this creature enters or leaves/.test(text) || /whenever one or more other creatures you control leave the battlefield/.test(text)) add("leave-payoff", "pays when a creature leaves");
    }
    if (c.kind === "self-power") {
      // An effect reads the commander's own power, so a card that raises one creature's power adds to it.
      if (/(?:equipped|enchanted) creature gets? \+(?:[1-9]\d*|x)\/[+-]?(?:[0-9x]+)|target creature gets? \+(?:[1-9]\d*|x)\/[+-]?(?:[0-9x]+)|put (?:a|an|one|two|three|four|x|\d+) \+1\/\+1 counters? on (?:target|up to one target) creature|put (?:a|an|one|two|three|four|x|\d+) \+1\/\+1 counters? on (?:it|that creature)|equipped creature gets \+x\/\+/.test(text)) add("raises-power", "raises one creature's power");
    }
    if (c.kind === "exchange") {
      const fodderType = c.pays;
      if (centerTypeHas(card, fodderType) && (usesLabel("create-token") || abilities.some((ab) => ab.trigger.includes("etb") || ab.trigger.includes("dies")))) add("fodder", "sacrifice fodder with value");
      // Fodder that pays you back for dying (Doomed Dissenter's Zombie) is worth more than a body with some other trigger.
      if (isCreature && abilities.some((ab) => /\bwhen(?:ever)? ~ dies\b/.test(ab.line) && ab.effects.some((e) => ["create-token", "draw", "return-from-graveyard"].includes(e.label)))) add("fodder-dies", "pays you back when it dies");
      if (abilities.some((ab) => ab.kind === "activated" && ab.cost.includes("sacrifice-other"))) add("outlet", "sacrifice outlet");
      if (/whenever (?:another |a |an |one or more |a nontoken )?[^.,]*\b(?:dies|die)\b|whenever you sacrifice/.test(text)) add("death-payoff", "death or sacrifice payoff");
      // The commander returns cards from the graveyard, so "whenever cards leave your graveyard" triggers on every use (Tormod).
      if (/return/.test(c.gets) && /whenever (?:one or more |a |another )?(?:other )?cards? leaves? your graveyard/.test(text)) add("graveyard-leave-payoff", "triggers when cards leave the graveyard");
      if (/return/.test(c.gets)) {
        // A second way to put a creature back (insurance), or fodder that returns itself.
        const back = abilities.flatMap((ab) => ab.effects).filter((e) => e.label === "return-from-graveyard" && e.from === "your");
        if (back.some((e) => e.object !== "self" && /creature/.test(String(e.object || "creature")))) add("reanimates", "returns a creature from the graveyard");
        else if (back.some((e) => e.object === "self") && isCreature) add("comes-back", "returns itself");
      }
      if (/return/.test(c.gets) && isCreature) {
        // "Better than what was sacrificed": a big body, or an enters trigger that fires again (a smaller link).
        if (cmc >= 5) add("return-target", "big return target");
        else if (cmc >= 3 && abilities.some((ab) => ab.trigger.includes("etb"))) add("return-target-small", "enters trigger returns again");
      }
      if (/return/.test(c.gets) && abilities.some((ab) => ab.effects.some((e) => ["mill-self", "discard-self", "loot", "rummage", "put-into-graveyard"].includes(e.label)))) add("graveyard-fill", "fills the graveyard");
      if (/power/.test(c.gets) && isCreature && power >= 4) add("power-fodder", "power " + power);
    }
  }
  return Array.from(found.values());
}

// Shared rare terms (2026-11-09): a fallback for a commander nothing else reads. The commander's words and each owned card's
// words become sets of terms (single words and word pairs, no mana costs, reminder text or common game words); a card that
// shares terms only a few owned cards use links to the commander, weighted by how rare the shared terms are (ln of
// pool size over card count). Islandwalk reads as "island walk", so Eluge's Islands and the islandwalkers meet.
// Measured offline on four known webs (Eluge, Edgar, Koth, Rilsa): 60-96% of the web inside the top 40 cards.
const SHARED_TERM_MAX_SHARE = 0.03;   // a term used by more than 3% of the pool is too common to link
const SHARED_TERM_MIN_WEIGHT = 3;     // below this the link is noise
const SHARED_TERM_MIN_POOL = 200;     // a smaller collection cannot say which terms are rare
const SHARED_TERM_WEIGHT_CAP = 8;     // never a strong link (CENTER_STRONG_LINK 14): a nudge, not a pull
const SHARED_TERM_STOP_WORDS = "a an the of to and or in on at it its is are be as if you your each target other another that this then with from for by can may not no all any up one two three four x more less than when whenever until end turn turns card cards player players opponent opponents control controls controlled creature creatures spell spells permanent permanents put onto battlefield enters enter into instead has have get gets gain gains deal deals damage cast which who whose where only first additional same also those them they their his her he she type addition toughness power it's you've take until sacrifice return exile top library graveyard hand name chosen choose number amount didn't don't doesn't isn't".split(" ");
const SHARED_TERM_STOP = new Set(SHARED_TERM_STOP_WORDS.concat(SHARED_TERM_STOP_WORDS.map((w) => w.replace(/([a-z])s$/, "$1"))));
const SHARED_TERM_LANDS = ["island", "swamp", "mountain", "forest", "plains"];

function getSharedTerms(card) {
  let t = getCardText(card).replace(/\([^)]*\)/g, " ").replace(/\{[^}]*\}/g, " ");
  const name = String(card.name || "").toLowerCase();
  for (const part of [name, name.split(",")[0]]) if (part) t = t.split(part).join("~");
  for (const land of SHARED_TERM_LANDS) t = t.split(land + "walk").join(land + " walk");
  const words = t.replace(/[^a-z0-9+\/' -]/g, " ").split(/\s+/).filter(Boolean).map((w) => w.replace(/([a-z])s$/, "$1"));
  const out = new Set();
  for (const w of words) if (w.length > 2 && !SHARED_TERM_STOP.has(w)) out.add(w);
  for (let i = 0; i + 1 < words.length; i++) {
    if (SHARED_TERM_STOP.has(words[i]) || SHARED_TERM_STOP.has(words[i + 1])) continue;
    out.add(words[i] + " " + words[i + 1]);
  }
  const kw = (card.raw && card.raw.keywords) || card.keywords || [];
  for (const k of kw) out.add(String(k).toLowerCase());
  return out;
}

// True when nothing else reads the commander (no payload, devotion, event or center), so the fallback may speak.
// A thin center (a first-spell discount, an each-player-draws engine) names few cards, so the fallback keeps speaking beside it.
function isCommanderUnread(needs) {
  const center = needs && Array.isArray(needs.center) ? needs.center : [];
  return !isEngineActive(needs) && !hasEventNeeds(needs) && !center.some((c) => c.kind !== "delivery" && !c.thin) && !(needs && (needs.graveyard || needs.returnsFromGraveyard));
}

// Builds { byName: { cardName: weight } } for an unread commander, or null. cards: iterable of owned card objects.
function buildSharedTerms(commanderTexts, cards) {
  const own = [];
  const pool = [];
  for (const card of cards) {
    if (getCardType(card).split("—")[0].includes("land")) continue;
    pool.push({ card, terms: getSharedTerms(card) });
  }
  if (pool.length < SHARED_TERM_MIN_POOL) return null;
  const df = new Map();
  for (const p of pool) for (const w of p.terms) df.set(w, (df.get(w) || 0) + 1);
  const commanderTerms = new Set();
  for (const text of commanderTexts || []) if (typeof text === "string" && text.trim()) for (const w of getSharedTerms({ name: "", text })) commanderTerms.add(w);
  if (!commanderTerms.size) return null;
  const byName = {};
  const maxDf = SHARED_TERM_MAX_SHARE * pool.length;
  for (const p of pool) {
    let score = 0;
    for (const w of p.terms) if (commanderTerms.has(w) && df.get(w) <= maxDf) score += Math.log(pool.length / df.get(w));
    const weight = Math.min(SHARED_TERM_WEIGHT_CAP, Math.round(score));
    if (weight >= SHARED_TERM_MIN_WEIGHT) byName[p.card.name] = weight;
  }
  return Object.keys(byName).length ? { byName } : null;
}

// Called right after parseCommanderNeeds/applyEventSwitch: an unread commander gets the fallback, unless Event Engines is off.
function attachSharedTerms(needs, commanderTexts, allOwnedCardData, modePrefs) {
  if (!needs || (modePrefs && modePrefs.eventEngines === false) || !isCommanderUnread(needs) || !allOwnedCardData) return needs;
  needs.sharedTerms = buildSharedTerms(commanderTexts, allOwnedCardData.values ? Array.from(allOwnedCardData.values()) : allOwnedCardData);
  return needs;
}

function getSharedTermBonus(card, needs) {
  return (needs && needs.sharedTerms && card && needs.sharedTerms.byName[card.name]) || 0;
}

function getCenterBonus(card, needs) {
  const links = getCenterLinks(card, needs);
  return Math.min(CENTER_BONUS_CAP, links.reduce((sum, l) => sum + l.weight, 0) + getSharedTermBonus(card, needs));
}

// Fodder is cheap by design: when the commander's trigger names a keyword ("a creature you control with deathtouch"),
// a 1-mana carrier does the job a 5-mana one does, a turn sooner and with the mana left for the rest of the deck. The
// fallback score already pays a flat bonus for any card at 3-4 mana, which this has to outweigh. Payoffs and engines
// are not charged for cost: only the carriers (kw-member) are touched, so this stays a nudge, never a gate.
const PLAN_FODDER_LINKS = new Set(["kw-member"]);
const PLAN_FODDER_COST_BONUS = [6, 6, 4, 2, 1];  // indexed by mana value; 5 and up earn nothing

function getPlanFodderCostBonus(card, needs) {
  if (!needs || !Array.isArray(needs.center) || !needs.center.some((c) => c.kind === "keyword")) return 0;
  if (!getCenterLinks(card, needs).some((l) => PLAN_FODDER_LINKS.has(l.link))) return 0;
  const cmc = Math.max(0, Math.round(Number(card.cmc) || 0));
  return PLAN_FODDER_COST_BONUS[cmc] || 0;
}

function getEngineBonus(card, needs) {
  if (!card || (!isEngineActive(needs) && !hasEventNeeds(needs) && !hasCenterNeeds(needs) && !(needs && needs.sharedTerms))) return 0;
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
    else if (crew !== null && crew >= 5) bonus -= Math.min(3, crew - 4);  // a nudge, not a cap: crew is met by several creatures
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
  bonus += getCenterBonus(card, needs) + getPlanFodderCostBonus(card, needs);
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
  payloadRamp: (needs) => `is a ${getPayloadNames(needs).join(" or ")} that ramps`,
  payload: (needs) => `is a ${getPayloadNames(needs).join(" or ")}`
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
  const types = getPayloadTypes(needs);
  if (!card || !types.length) return 0;
  if (!getCardType(card).split("—")[0].includes("land")) return 0;
  const text = getCardText(card);
  return types.some((t) => new RegExp(`\\b${engineTypePattern(t)}s?\\b`).test(text)) ? ENGINE_LAND_BONUS : 0;
}

function describeEngineNeeds(needs) {
  if (!isEngineActive(needs)) return "";
  const parts = [];
  if (needs.payloadType) {
    const name = getPayloadNames(needs).join(" and ");
    parts.push(needs.graveyard ? `${name} in the graveyard` : name);
  }
  if (needs.devotionColors && needs.devotionColors.length) parts.push(`devotion to ${needs.devotionColors.join("/")}`);
  return `Engine enablers for ${parts.join(", ")}`;
}
