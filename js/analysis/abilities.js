// Ability labels: reads each ability of a card (trigger, cost, effect, restriction) so a
// card is judged by its whole text instead of one matching clause. Plain globals, no DOM.
// Spec: dev/docs/superpowers/specs/2026-10-15-ability-labels.md
//
// getCardAbilities(card) -> [{ line, kind, trigger[], cost[], costText, effects[], restrictions[], keyword, quoted[] }]
// Accepts an app card ({ name, text, type, raw }) or a raw Scryfall object.

const TAG_KEYWORDS = new Set([
  "flying", "first strike", "double strike", "deathtouch", "vigilance", "haste", "trample", "lifelink",
  "reach", "menace", "defender", "flash", "indestructible", "hexproof", "ward", "prowess", "fear",
  "intimidate", "shroud", "skulk", "infect", "undying", "persist", "changeling", "partner", "convoke",
  "delve", "cascade", "storm", "banding", "horsemanship", "flanking", "exalted", "evolve", "riot",
  "afterlife", "extort", "ninjutsu", "mentor", "training", "toxic", "cycling", "equip", "crew", "kicker",
  "flashback", "unearth", "escape", "madness", "eternalize", "embalm", "channel", "bestow", "enchant",
  "level up", "affinity", "surge", "dash", "evoke", "emerge", "miracle", "morph", "megamorph", "disturb",
  "jump-start", "aftermath", "retrace", "scavenge", "boast", "reconfigure", "fabricate", "squad", "offspring", "saddle", "station", "warp", "backup", "increment"
]);

// The pieces of text to read: a two-faced card face by face (each face's own name
// becomes "~"), anything else as one piece.
function abilitySources(card) {
  const raw = card && card.raw ? card.raw : card;
  const faces = raw && Array.isArray(raw.card_faces) ? raw.card_faces.filter((f) => f && f.oracle_text) : [];
  if (faces.length > 1 && !raw.oracle_text) return faces.map((f) => ({ name: f.name || card.name, text: f.oracle_text }));
  return [{ name: card && card.name, text: getCardText(card) }];
}

function oracleLinesFromSources(sources) {
  const lines = [];
  for (const part of sources) {
    const full = String(part.name || "").toLowerCase();
    const short = full.split(",")[0];
    let text = String(part.text || "").toLowerCase().replace(/\([^)]*\)/g, "");
    // The card's own name, as a whole word only: a card named "Flash" must not turn "flashback" into "~back".
    for (const n of [full, short]) {
      if (n.length > 2) text = text.replace(new RegExp(`(^|[^a-z0-9])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`, "g"), "$1~");
    }
    text = text.replace(/\bthis (?:creature|artifact|enchantment|land|aura|equipment|vehicle|card|permanent|token|saga|class|siege|battle|spell|planeswalker)\b/g, "~");
    // Every mana symbol becomes {m}, and a generic {3} becomes three of them, so counting {m} counts mana.
    text = text.replace(/\{(?!t\}|q\})([^}]+)\}/g, (match, symbol) => (/^\d+$/.test(symbol) ? "{m}".repeat(Number(symbol)) : "{m}"));
    for (const line of text.split("\n")) {
      const clean = line.trim().replace(/^[•\s]+/, "");
      if (clean) lines.push(clean);
    }
  }
  return lines;
}

function tagCostLabels(costText) {
  const labels = [];
  for (const part of costText.split(/,\s*/)) {
    const p = part.trim();
    if (!p) continue;
    if (p === "{t}") labels.push("tap");
    else if (/^(?:\{m\})+$/.test(p) || p === "{m}") labels.push("mana");
    else if (/^sacrifice ~/.test(p)) labels.push("sacrifice-self");
    else if (/^sacrifice /.test(p)) labels.push("sacrifice-other");
    else if (/^discard ~/.test(p)) labels.push("discard-self");
    else if (/^discard (?:two|three|\d+) cards?/.test(p)) labels.push("discard-multiple");
    else if (/^discard (?:a|one) cards?|^discard an? /.test(p)) labels.push("discard-card");
    else if (/^exile ~ from your graveyard/.test(p)) labels.push("exile-self-from-graveyard");
    else if (/^exile /.test(p)) labels.push("exile-other");
    else if (/^pay \w+ life/.test(p)) labels.push("pay-life");
    else if (/^tap (?:another|an|two|three|\w+) /.test(p)) labels.push("tap-other");
    else if (/^remove /.test(p)) labels.push("remove-counter");
    else if (/^return /.test(p)) labels.push("return-cost");
    else labels.push("other-cost");
  }
  return labels;
}

function tagTriggerLabels(trigger) {
  const labels = [];
  const rules = [
    ["etb", /\benters\b/], ["attacks", /\battacks?\b/], ["dies", /\bdies\b|\b(?:is|are) put into (?:a|an|your|its owner's|their owner's)\b[^,]*graveyard from the battlefield/], ["leaves-battlefield", /leaves the battlefield/],
    ["upkeep", /beginning of (?:your|each|the) upkeep/], ["end-step", /end step/], ["combat-begin", /beginning of combat/],
    ["main-phase", /main phase/], ["cast-spell", /\bcasts?\b/], ["discard-event", /\bdiscards?\b/], ["cycle-event", /\bcycles?\b/],
    ["leave-graveyard", /leave your graveyard/], ["becomes-tapped", /becomes tapped(?! for mana)/], ["crews", /\bcrews?\b|becomes crewed/],
    ["draw-event", /\bdraws?\b/], ["life-event", /gain(?:s)? life|lose(?:s)? life/], ["combat-damage", /combat damage/],
    ["landfall", /\bland(?: you control)? enters/], ["sacrifice-event", /sacrifices?\b/], ["token-event", /\btokens?\b/],
    ["cast-noncreature", /\bcasts? (?:a|an) noncreature spell/], ["cast-second", /\bcasts? (?:their|your|his or her) second spell/],
    ["draw-second", /\bdraws? (?:their|your|his or her) second card/], ["counter-placed", /\bcounters? (?:are|is) put on\b/]
  ];
  for (const [label, re] of rules) {
    if (label === "becomes-tapped" && /\bland\b/.test(trigger)) continue; // a land tapping is not a creature crewing
    if (re.test(trigger)) labels.push(label);
  }
  return labels.length ? labels : ["other-trigger"];
}

// Zone-moving effects carry their object: "return target creature card from your
// graveyard to your hand" -> { label: "return-from-graveyard", object: "creature", to: "hand" }.
function tagEffects(text) {
  const out = [];
  const add = (label, extra) => out.push(Object.assign({ label }, extra || {}));
  let m;

  if (/draw (?:a|two|three|x|\d+) cards?,? then discard (?:a|two|three|x|\d+) cards?/.test(text)) add("loot");
  else if (/discard (?:a|two|three|x|\d+) cards?[^.]*?,? then draw|you may discard a card\. if you do, draw|\brummage\b/.test(text)) add("rummage");
  else if (/\bconnives?\b/.test(text)) add("loot");
  if (/\bexplores?\b|\blearn\b/.test(text)) add("explore-or-learn");
  // discard as an effect (costs are tagged separately). who discards decides whether it fuels us or them;
  // the card filter ("a creature card") decides whether it can discard a given card at all.
  if (/(?:each|target) opponents? discards?|each other player discards|that player discards/.test(text)) add("discard-opponent");
  if (/target player discards|each player discards/.test(text)) add("discard-any-player", { each: /each player discards/.test(text) });
  if (!/^as an additional cost/.test(text) && (m = /(?:\byou discard|(?:^|[:.,;]\s*|\bthen |\bmay )discard) (a|an|one|two|three|x|\d+|any number of|up to \w+|your hand|that many|all)(?: ([a-z, ]+?))? ?(cards?|hand)\b/.exec(text))) {
    const filt = (m[2] || "").replace(/,? or /g, "|").trim();
    add("discard-self", { object: /card/.test(filt) || !filt ? "any" : filt.replace(/ cards?$/, "") });
  }
  if (/\bdraw (?:a|an|two|three|four|x|\d+|that many) cards?/.test(text) && !out.some((e) => e.label === "loot" || e.label === "rummage")) add("draw");

  if (/(?:^|[\s.,;:])mill (?:a|one|two|three|four|five|six|seven|x|\d+) cards?\b|\byou mill\b|\b(?:each|target) player mills\b|put the top (?:a|one|two|three|four|five|x|\w+) cards? of your library into your graveyard/.test(text)) add("mill-self");
  if (/(?:each|target) opponents? mills|its controller mills|that player mills|mills? that many/.test(text)) add("mill-other");
  // "look at the top N cards of your library, put one into your hand and the rest into your graveyard" fills the graveyard.
  const dig = /(?:look at|reveal) the top [^.]*?library[.,](?:[^.]*\.){0,2}[^.]*?\binto (?:your|their|its owner's) graveyard/.exec(text);
  if (dig) {
    const others = /(?:target player's|an opponent's|each opponent's) library/.test(dig[0]) || /\binto their graveyard/.test(dig[0]);
    const label = others ? "mill-other" : "mill-self";
    if (!out.some((e) => e.label === label)) add(label);
  }
  if (/\bsurveil (?:\d+|x)\b/.test(text)) add("surveil");
  if (/\bscry (?:\d+|x)\b/.test(text)) add("scry");

  const ret = /return ((?:(?:up to \w+ |target |each |all |another )*)[^.;]*?) (?:cards? )?from (your|a|an opponent's|target player's) graveyards? to (the battlefield|your hand|its owner's hand|their hand|their owner's hand)/;
  if ((m = ret.exec(text))) {
    let obj = m[1].replace(/^(?:(?:up to \w+ |target |each |all |another )*)/, "").replace(/\bcards?\b/g, "").replace(/\s+/g, " ").trim();
    if (obj === "~") obj = "self";
    add("return-from-graveyard", { object: obj || "any", to: /battlefield/.test(m[3]) ? "battlefield" : "hand", from: m[2] });
  } else if (/return ~ from your graveyard/.test(text)) add("return-from-graveyard", { object: "self", to: /battlefield/.test(text) ? "battlefield" : "hand" });

  const toTop = /put ((?:up to \w+ )?(?:target )?[^.;]*?) cards? from your graveyard (?:on top of your library|into your hand|on the bottom of your library)/.exec(text);
  if (toTop && !out.some((e) => e.label === "return-from-graveyard")) add("return-from-graveyard", { object: toTop[1].replace(/^(?:up to \w+ )?(?:target )?/, "").trim() || "any", to: /hand/.test(toTop[0]) ? "hand" : "library", from: "your" });
  const reanimate = /put ((?:up to \w+ |one, two, or three )?(?:target |each |all )?[^.;]*?) cards? from (your|a|an opponent's|target player's|\w+) graveyards? onto the battlefield/.exec(text);
  if (reanimate && !out.some((e) => e.label === "return-from-graveyard")) {
    add("return-from-graveyard", { object: reanimate[1].replace(/^(?:up to \w+ |one, two, or three )?(?:target |each |all )?/, "").replace(/\s+/g, " ").trim() || "any", to: "battlefield", from: /^(?:a|an opponent's|target player's)$|graveyards$/.test(reanimate[2]) || reanimate[2] !== "your" ? "any" : "your" });
  }
  const exile = /exile ((?:up to \w+ )?(?:target |each |all |another |that |those |a |an |\w+ other )?[^.;]*?) (?:cards? )?from (your|a|an opponent's|target player's|each|all)(?: players'| opponents')? graveyards?/.exec(text);
  if (exile) {
    const o = exile[1].trim();
    let kind = "target";
    if (/^~$/.test(o)) kind = "self";
    else if (/^(?:that|those)\b/.test(o)) kind = "that-card";
    else if (/^(?:all|each)\b/.test(o)) kind = "all";
    else if (/^(?:a|an|\w+ other|\w+)\b.*\bfrom your\b/.test(o) || exile[2] === "your") kind = /^(?:target|up to)/.test(o) ? "target" : "own-cards";
    add("exile-from-graveyard", { object: o, kind, from: exile[2] });
  }
  if (/exile your graveyard/.test(text)) add("exile-from-graveyard", { object: "all", kind: "all", from: "your" });
  if (/put[^.]*into (?:your|their|its owner's) graveyard/.test(text) && !out.some((e) => e.label === "mill-self")) add("put-into-graveyard");

  if (/create [^.]*?\btokens?\b/.test(text)) add("create-token", { crew: /crews? vehicles?/.test(text) });
  if ((m = /\b([a-z]+)s? you control (?:get|have|gain)\b|other ([a-z]+)s? you control/.exec(text))) add("anthem-lord", { type: m[1] || m[2] });
  if (/crews? (?:vehicles?|a vehicle) (?:as though|using its toughness)|(?:saddles|crews) [^.]*as though its power|create an? [^.]*\bpilot creature token/.test(text)) add("crew-helper");
  if (/\bdestroy\b/.test(text)) add("destroy");
  if (/deals? (?:\w+|x) damage/.test(text)) add("damage");
  if (/counter target/.test(text)) add("counterspell");
  if (/[+-](?:\d+|x)\/[+-](?:\d+|x)/.test(text)) add("pump");
  if (/\b(?:\+1\/\+1|-1\/-1|\w+) counters?\b/.test(text)) add("counters", { counter: /\+1\/\+1 counters?/.test(text) ? "+1/+1" : "other" });
  if (/\badd (?:\{m\}|one mana|[a-z ]*mana)/.test(text)) add("add-mana");
  if (/\bsearch your library\b/.test(text)) add("tutor");
  // Lands that reach the battlefield without being your normal land drop (fetch, ramp, extra drops).
  if (/(?:search your library for|put) [^.]*\bland cards?\b[^.]*onto the battlefield|play (?:an )?additional lands?|additional lands? (?:on|each|this) /.test(text)) add("land-to-battlefield");
  if (/\b(?:gain|gains) (?:\d+|x) life|you gain life/.test(text)) add("gain-life");
  if (/\blose (?:\d+|x) life|loses (?:\d+|x) life/.test(text)) add("lose-life");
  if (/\btap (?:target|up to|all|each)|\buntap\b/.test(text)) add("tap-untap");
  if (/\bsacrifice\b/.test(text)) add("sacrifice");
  // An optional sacrifice of your own permanent ("at the beginning of your upkeep, you may sacrifice a creature") is an outlet of a kind.
  if (/\byou may sacrifice (?:a|an|another|one or more|any number of|up to \w+|x|two|three)\b/.test(text)) add("sacrifice-choice");
  if (/\bexile\b/.test(text) && !out.some((e) => e.label === "exile-from-graveyard")) add("exile");
  if (/return [^.]*to (?:its owner's|their owner's|your) hand/.test(text) && !out.some((e) => e.label === "return-from-graveyard")) add("bounce");
  if (/\b(?:copy|copies)\b/.test(text)) add("copy");
  if (/\btransform\b/.test(text)) add("transform");
  if (/\bgains? (?:flying|first strike|deathtouch|haste|trample|vigilance|lifelink|menace|reach|hexproof|indestructible|protection)|have (?:flying|haste|trample)/.test(text)) add("grant-keyword");
  // Attachment: destroying or unattaching Auras and Equipment is the opposite of caring about them.
  if (/\b(?:destroy|exile|unattach|sacrifice)\b[^.]*\b(?:auras?|equipment)\b|\bunattach\b/.test(text)) add("hose-attachment");
  else if (/\battach(?:es|ed)?\b/.test(text)) add("attach-effect");
  if (/can't (?:attack|block|be blocked|be activated|crew)|doesn't untap/.test(text)) add("restrict-effect", { crewHose: /can't[^.]*\bcrew\b/.test(text) });
  if (/\binvestigate\b|\bproliferate\b|\bexplore\b|\bamass\b|\bfight\b|\bgoad\b|\bmonstrosity\b|\bpopulate\b|\bsupport\b|\bmanifest\b|\bincubate\b/.test(text)) add("keyword-action");
  if (/(?:^|\s)(?:if|unless|as long as)\b/.test(text) && out.length === 0) add("conditional-static");
  // "your devotion to red and green": the colors a devotion condition counts.
  const devotionColors = [];
  for (const d of text.matchAll(/devotion to (white|blue|black|red|green)(?: and (white|blue|black|red|green))?/g)) {
    for (const color of [d[1], d[2]]) if (color && !devotionColors.includes(color)) devotionColors.push(color);
  }
  if (devotionColors.length) add("devotion-condition", { colors: devotionColors });
  return out;
}

function tagRestrictions(text) {
  const r = [];
  if (/activate only as a sorcery/.test(text)) r.push("sorcery-speed");
  if (/activate only once each turn|activate only once\b/.test(text)) r.push("once-per-turn");
  if (/activate only during your turn/.test(text)) r.push("your-turn-only");
  if (/activate only if/.test(text)) r.push("conditional-activation");
  return r;
}

// An ability's own text may quote the abilities it hands out ("create a 0/1 Wizard token with
// \"whenever you cast a noncreature spell, ...\""). Those are tagged into `quoted`.
function tagLine(line) {
  const ab = tagLineBody(line);
  for (const m of line.matchAll(/"([^"]+)"/g)) ab.quoted.push(tagLineBody(m[1]));
  return ab;
}

function tagLineBody(line) {
  const ab = { line, kind: "static", trigger: [], cost: [], costText: "", effects: [], restrictions: tagRestrictions(line), keyword: false, quoted: [] };
  const stripped = line.replace(/^[^—:]{1,40} — /, ""); // ability words: "channel — ", "landfall — "
  if (/^(?:~ enters (?:the battlefield )?tapped|choose (?:one|two|three|one or both|one or more)(?: —)?|choose a background|daybound|nightbound|devoid|~ can't be countered|start your engines!|~ enters prepared|\d+\/\d+|\d+\+ \|.*)\.?$/.test(stripped)) {
    ab.kind = "structural";
    return ab;
  }
  const gyKw = /^(flashback|escape|unearth|embalm|eternalize|disturb|jump-start|aftermath|retrace|scavenge|dredge)\b/.exec(stripped);
  if (gyKw) { ab.kind = "keyword"; ab.effects = [{ label: "keyword:" + gyKw[1] }]; return ab; }
  // Keywords whose reminder text (stripped above) is a death trigger or an optional sacrifice.
  const deathKw = /^(undying|persist|afterlife|modular)\b/.exec(stripped);
  if (deathKw) { ab.kind = "keyword"; ab.keyword = true; ab.trigger = ["dies"]; ab.effects = [{ label: "keyword:" + deathKw[1] }]; return ab; }
  const sacKw = /^(casualty|bargain|devour|exploit|emerge)\b/.exec(stripped);
  if (sacKw) { ab.kind = "keyword"; ab.keyword = true; ab.effects = [{ label: "keyword:" + sacKw[1] }, { label: "sacrifice-choice" }]; return ab; }
  const isKw = (w) => TAG_KEYWORDS.has(w) || TAG_KEYWORDS.has(w.replace(/\s+(?:\{m\}.*|\d+.*|—.*)$/, "")) || TAG_KEYWORDS.has(w.split(" ")[0]);
  const words = stripped.split(/,\s*/).map((w) => w.trim());
  if (words.length && words.every(isKw)) {
    ab.keyword = true;
    ab.kind = "keyword";
    ab.effects = [{ label: "keyword:" + stripped.split(/[ ,]/)[0] }];
    if (words.some((w) => /^(?:undying|persist|afterlife)\b/.test(w))) ab.trigger = ["dies"];
    return ab;
  }
  const colon = stripped.indexOf(":");
  const firstStop = stripped.search(/\.(?:\s|$)/);
  if (colon > 0 && (firstStop === -1 || colon < firstStop) && /\{t\}|\{m\}|sacrifice|discard|pay |tap |exile|remove|return/.test(stripped.slice(0, colon))) {
    ab.kind = "activated";
    ab.costText = stripped.slice(0, colon);
    ab.cost = tagCostLabels(ab.costText);
    ab.effects = tagEffects(stripped.slice(colon + 1));
  } else if (/^(?:when|whenever|at the beginning of|at the end of|at end of)\b/.test(stripped)) {
    ab.kind = "triggered";
    const comma = stripped.indexOf(", ");
    ab.trigger = tagTriggerLabels(comma > 0 ? stripped.slice(0, comma) : stripped);
    ab.effects = tagEffects(comma > 0 ? stripped.slice(comma + 2) : "");
  } else {
    ab.effects = tagEffects(stripped);
  }
  if (/^as an additional cost to cast (?:this spell|~), (?:you may )?sacrifice /.test(stripped)) ab.cost.push("sacrifice-additional");
  return ab;
}

function tagCard(card) {
  const oneShot = /\b(?:instant|sorcery)\b/.test(getCardType(card));
  return oracleLinesFromSources(abilitySources(card)).map((line) => {
    const ab = tagLine(line);
    if (oneShot && ab.kind === "static") ab.kind = "spell";
    return ab;
  });
}

// A bare rules text (a commander's), with no card around it.
function tagTextAbilities(text, name) {
  return oracleLinesFromSources([{ name: name || "", text }]).map(tagLine);
}

const ABILITY_CACHE = new Map();

// Tagging is pure, so it is memoized. The key carries the text as well as the name:
// a test card or a re-printed card can share a name with different text.
function getCardAbilities(card) {
  if (!card) return [];
  const key = `${card.name}\u0000${getCardText(card)}`;
  let abilities = ABILITY_CACHE.get(key);
  if (!abilities) {
    abilities = tagCard(card);
    ABILITY_CACHE.set(key, abilities);
  }
  return abilities;
}

// One-shot abilities happen once per card played: a spell, an enters or dies trigger, or an
// activated ability that sacrifices or exiles its own card as the cost.
function isOneShotAbility(ab) {
  if (ab.kind === "spell") return true;
  if (ab.kind === "triggered") return ab.trigger.length > 0 && ab.trigger.every((t) => t === "etb" || t === "dies");
  if (ab.kind === "activated") return ab.cost.includes("sacrifice-self") || ab.cost.includes("exile-self-from-graveyard");
  return false;
}

// Mana paid to use an activated ability once: the {m} symbols in its cost.
function getAbilityManaCost(ab) {
  return (String(ab.costText || "").match(/\{m\}/g) || []).length;
}

// True when some ability mentions attaching without being about destroying or removing
// attachments. This is what the voltron tag reads instead of the bare word "attach".
function hasAttachmentSignal(card) {
  return getCardAbilities(card).some((ab) => /attach/.test(ab.line) && !ab.effects.some((e) => e.label === "hose-attachment"));
}
