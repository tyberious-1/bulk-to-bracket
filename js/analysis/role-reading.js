// What a card does for a deck (ramp, draw, removal, wipe), read ability by ability.
// Used by the Collection Analytics tab. It starts from getRoleContributions (the
// builder's reader) and adds jobs that reader's one-clause patterns miss: mana
// abilities with a restriction or "any color", chip damage and -N/-N on a target,
// "up to one target", mass exile, one-sided sweepers. The builder never calls it,
// so deck builds are unchanged.
// Depends on: abilities.js, scoring.js

const ROLE_READING_ROLES = ["ramp", "draw", "removal", "wipe"];

// Every ability of a card as text, quoted abilities included (a token's trigger).
function roleReadingLines(card) {
  const lines = [];
  for (const ab of getCardAbilities(card)) {
    if (ab.kind === "keyword" || ab.kind === "structural") {
      lines.push({ ab, text: ab.line });
      continue;
    }
    lines.push({ ab, text: ab.line });
    for (const q of ab.quoted) lines.push({ ab: q, text: q.line });
  }
  return lines;
}

const OWN_SIDE = /\byou control\b|\byou own\b|\byour\b/;

// Removal an ability does to something that is not ours.
function abilityRemoves(text) {
  const t = text.replace(/\([^)]*\)/g, " ");
  if (/\bdestroy (?:up to \w+ )?target (?:\w+ )*?(?:creature|artifact|enchantment|permanent|planeswalker|land|battle)/.test(t) && !/target [^.]*you control/.test(t)) return true;
  if (/\bexile (?:up to \w+ )?target (?:\w+ )*?(?:creature|artifact|enchantment|permanent|planeswalker|battle)/.test(t) && !/target [^.]*(?:you control|graveyard)/.test(t)) return true;
  if (/\bairbend\b/.test(t) && !/airbend (?:up to one )?(?:target )?[^.]*you control/.test(t)) return true;
  // Damage to a creature, planeswalker or any target, including from our own creature (bite, fight).
  if (/deals? (?:\w+|x) damage (?:divided as you choose )?(?:among|to) [^.]*?(?:any target|target (?:\w+ )*?(?:creature|planeswalker|battle)|up to \w+ target)/.test(t)) return true;
  if (/deals? damage equal to [^.]*?power to (?:another )?target (?:\w+ )*?(?:creature|planeswalker)/.test(t)) return true;
  if (/\bfights? (?:up to one )?(?:another )?target\b/.test(t) || /\bfights? (?:up to one )?(?:target )?creature (?:an opponent|you don't)/.test(t)) return true;
  if (/target (?:\w+ )*?creature(?:s)? (?:an opponent controls |you don't control )?(?:gets?|get) [+-]?[0-9x]+\/-[0-9x]+/.test(t) && !/creatures? you control/.test(t.split(/gets?|get/)[0])) return true;
  if (/put (?:a|an|two|three|x|\d+) -1\/-1 counters? on target (?:\w+ )*?creature/.test(t) && !/target [^.]*you control/.test(t)) return true;
  // An edict: the opponent picks the creature.
  if (/(?:each opponent|each player|target (?:player|opponent)|defending player) sacrifices (?:a|an|one|two|three|x|\w+) (?:\w+ )?(?:or \w+ )?(?:creatures?|artifacts?|enchantments?|permanents?|planeswalkers?|vehicles?)/.test(t)) return true;
  if (/(?:target opponent|each opponent) exiles a (?:\w+ )?creature/.test(t)) return true;
  if (/return (?:up to \w+ |\w+ )?target (?:\w+ )*?(?:nonland )?permanents? to (?:its|their) owners?'? hands?/.test(t) && !/target [^.]*you control/.test(t)) return true;
  if (/tap target creature[^.]*\. (?:it|that creature) doesn't untap/.test(t) || /(?:enchanted creature|enchanted permanent) (?:can't become untapped|doesn't untap)/.test(t)) return true;
  return false;
}

// A sweeper: hits every creature (or every one an opponent controls), hard enough to kill.
function abilitySweeps(text) {
  const t = text.replace(/\([^)]*\)/g, " ");
  const oneSided = /creatures? (?:target player|your opponents|an opponent|each opponent|defending player)s? controls?|creatures your opponents control/.test(t);
  const onlyOurs = /(?:all |each )?(?:other )?creatures? you control/.test(t) && !oneSided && !/all (?:other )?creatures(?! you control)|each creature(?! you control)/.test(t);
  if (onlyOurs) return false;
  if (/\b(?:destroy|exile) all (?:other )?(?:non[a-z]+ )?(?:creatures|nonland permanents|permanents|artifacts and creatures|creatures and \w+)/.test(t) && !/all (?:other )?creatures you control/.test(t)) return true;
  if (/\bairbend all other creatures\b/.test(t)) return true;
  if (/each creature[^.]*(?:with mana value|with power|without)[^.]*\bdestroy those creatures\b|destroy those creatures/.test(t)) return true;
  if (/(?:destroy|exile) all other creatures that were dealt damage/.test(t)) return true;
  const dmg = /deals? (\d+|x) damage to each (?:non-?\w+ )?creature/.exec(t);
  if (dmg && (dmg[1] === "x" || +dmg[1] >= 2)) return true;
  // A mass toughness drop: "all creatures get -2/-2", "creatures your opponents control get -3/-3".
  const stat = /(?:\ball |\beach other |\ball other |^|[.:•] ?)(?:non-?\w+ )?creatures (?:(?:your opponents|target player|an opponent|each opponent) controls? |you don't control )?(?:get|gets) [+-]?(?:\d+|x)\/-(\d+|x)/.exec(t);
  if (stat && (stat[1] === "x" || +stat[1] >= 2)) return true;
  if (/put (?:two|three|x|\d+) -1\/-1 counters? on each (?:\w+ )?creature/.test(t)) return true;
  if (/-1\/-1 counter on each creature (?:your opponents control|you don't control)/.test(t)) return true;
  if (/\boverload\b/.test(t) && /\b(?:destroy|exile) target creature/.test(t)) return true;
  if (/(?:each|all) players? sacrifices? (?:all|two|three|x) creatures|sacrifices all other creatures/.test(t)) return true;
  if (/each player chooses [^.]*then sacrifices all other creatures/.test(t)) return true;
  return false;
}

// Mana, or land, that the deck would not have had on its own.
function abilityRamps(ab) {
  const text = ab.line.replace(/\([^)]*\)/g, " ");
  if (ab.effects.some((e) => e.label === "land-to-battlefield")) return true;
  // "Reveal cards until you reveal a land card. Put that card onto the battlefield" runs over two sentences.
  if (/until you reveal a land card[^.]*\.[^.]*put that card onto the battlefield/.test(text)) return true;
  if (ab.kind === "spell") {
    return /\badd (?:\{m\}|[a-z ]*mana)/.test(text) && /\badd [^.]*(?:three|four|five|six|seven|ten|x|\{m\}\{m\}\{m\})/.test(text);
  }
  if (ab.kind === "static" && /have "\{t\}: add/.test(ab.line)) return true;
  if (!ab.effects.some((e) => e.label === "add-mana")) return false;
  // Mana that appears and goes away with the turn (firebending) is combat mana, not a rock.
  if (/\bfirebending\b|until end of combat/.test(text)) return false;
  // Paying mana to get mana back ({2}: add one mana of any color) filters colors, it does not ramp.
  if (ab.kind === "activated" && ab.cost.includes("mana")) return false;
  return ab.kind === "activated" || ab.kind === "triggered";
}

function abilityUntapsLand(text) {
  return /\buntap (?:target|all|up to \w+) lands?\b|\buntap target land\b/.test(text);
}

function getCollectionRoles(card) {
  if (getCardType(card).includes("land")) return [];
  const roles = new Set(getRoleContributions(card));
  const lines = roleReadingLines(card);

  let sweeps = false;
  for (const { ab, text } of lines) {
    if (abilityRamps(ab) || abilityUntapsLand(text)) roles.add("ramp");
    if (abilityRemoves(text)) roles.add("removal");
    if (abilitySweeps(text)) { roles.add("wipe"); sweeps = true; }
  }
  // Convoke and affinity only make this one spell cheaper; the builder's ramp pattern counts them.
  if (roles.has("ramp") && /\b(?:convoke|affinity for)\b/.test(getCardText(card).replace(/\([^)]*\)/g, " "))) {
    const rest = getCardText(card).replace(/\([^)]*\)/g, " ").replace(/\b(?:convoke|affinity for [a-z]+)\b/g, " ");
    const other = /\badd \{|treasure|search your library for [^.]*land|additional lands?|spells? you cast cost|less to cast/.test(rest) || lines.some(({ ab }) => abilityRamps(ab));
    if (!other) roles.delete("ramp");
  }
  // The builder files "each player sacrifices a creature" as a wipe on purpose. Here a
  // one-creature edict is removal: it takes one creature, not the board.
  const full = getCardText(card);
  if (!sweeps && roles.has("wipe") && /sacrifices? (?:a|an) (?:nontoken )?(?:creature|artifact|enchantment|permanent|planeswalker|vehicle)/.test(full) && !/\b(?:all|each) (?:other )?(?:non-?\w+ )?creatures?\b/.test(full)) {
    roles.delete("wipe");
    roles.add("removal");
  }
  return ROLE_READING_ROLES.filter((r) => roles.has(r));
}
