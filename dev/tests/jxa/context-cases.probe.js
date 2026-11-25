// Context probes (2026-11-16): does the current reader and scoring see what each case in
// dev/docs/superpowers/specs/2026-11-16-plan-context-cases.md says matters? Not a suite: it reports OK or GAP and never fails,
// and the filename keeps run_all.sh (which globs *.test.js) from picking it up.
// Run from the repo root:
//   base=($(sed -n '/^scripts=(/,/^)/p' dev/tools/jxa-harness/build_harness.sh | grep 'js/'))
//   dev/tests/jxa/run.sh "${base[@]}" dev/tests/jxa/context-cases.probe.js
// Card texts are the oracle text read from Scryfall on 2026-11-16 (see the spec).

function pc(name, type, text, cmc, extra) {
  return Object.assign({ name, type, text, cmc, manaCost: "{" + cmc + "}", rawType: type, rawText: text, rarity: "common", colors: [] }, extra || {});
}

function planOf(texts) {
  return { center: getCommanderCenter(texts), needs: parseCommanderNeeds(texts) };
}

function scoreIn(card, commanderTexts, colors) {
  const needs = parseCommanderNeeds(commanderTexts);
  const profile = getCommanderStrategyProfile("Probe Commander", [], colors);
  const prefs = getModePreferences("", profile);
  prefs.engineNeeds = needs;
  return {
    bonus: getEngineBonus(card, needs),
    links: getCenterLinks(card, needs).map((l) => l.link + ":" + l.weight).join(","),
    fallback: Math.round(scoreFallbackCard(Object.assign({ text: "" }, card), [], profile, colors, prefs) * 10) / 10
  };
}

function report(title, commanderTexts, colors, wanted, controls) {
  jxaPrint("\n== " + title);
  const center = getCommanderCenter(commanderTexts).map((c) => c.kind + (c.measure ? "/" + c.measure : "") + (c.kw ? "/" + c.kw : "")).join(", ");
  jxaPrint("   commander center reads as: " + (center || "(nothing)"));
  const wantedScores = wanted.map((c) => ({ c, s: scoreIn(c, commanderTexts, colors) }));
  const controlScores = controls.map((c) => ({ c, s: scoreIn(c, commanderTexts, colors) }));
  const bestControl = controlScores.reduce((m, x) => Math.max(m, x.s.fallback), -Infinity);
  for (const { c, s } of wantedScores) {
    const ok = s.fallback > bestControl;
    jxaPrint("   " + (ok ? "OK  " : "GAP ") + c.name + ": score " + s.fallback + ", engine bonus " + s.bonus + (s.links ? ", links " + s.links : ", no links"));
  }
  for (const { c, s } of controlScores) jxaPrint("   control " + c.name + ": score " + s.fallback + ", engine bonus " + s.bonus);
  jxaPrint("   (OK = scores above the best control, " + bestControl + ")");
}

const CONTROL_BOLT = pc("Control Bolt", "instant", "control bolt deals 3 damage to any target.", 2, { colors: ["R"] });
const CONTROL_WIPE = pc("Control Wipe", "sorcery", "destroy all creatures.", 4, { colors: ["R"] });
const CONTROL_VANILLA = pc("Control Big Vanilla", "creature — giant", "", 5, { colors: ["R"], power: "5", toughness: "5" });
const CONTROL_DRAW = pc("Control Draw", "sorcery", "draw two cards.", 3, { colors: ["R"] });
const CONTROL_ROCK = pc("Control Rock", "artifact", "{t}: add {c}.", 2);

// ---- Case 1: Ashling the Pilgrim ----
const ASHLING = ["{1}{R}: Put a +1/+1 counter on Ashling. If this is the third time this ability has resolved this turn, remove all +1/+1 counters from Ashling, and it deals that much damage to each creature and each player."];
report("Ashling the Pilgrim: cards the spec says serve her plan", ASHLING, ["R"], [
  pc("Heartstone", "artifact", "Activated abilities of creatures cost {1} less to activate. This effect can't reduce the mana in that cost to less than one mana.", 3),
  pc("Gauntlet of Might", "artifact", "Red creatures get +1/+1. Whenever a Mountain is tapped for mana, its controller adds an additional {R}.", 4),
  pc("Darksteel Plate", "artifact — equipment", "Indestructible. Equipped creature has indestructible. Equip {2}", 3),
  pc("Mithril Coat", "legendary artifact — equipment", "Flash. Indestructible. When Mithril Coat enters, attach it to target legendary creature you control. Equipped creature has indestructible. Equip {3}", 3),
  pc("Swiftfoot Boots", "artifact — equipment", "Equipped creature has hexproof and haste. Equip {1}", 2),
  pc("Red Hulk", "legendary creature — gamma berserker villain", "Reach, trample. Enrage — Whenever Red Hulk is dealt damage, put a +1/+1 counter on him. When you do, he deals damage equal to the number of +1/+1 counters on him to any other target.", 6, { colors: ["R"], power: "6", toughness: "7" }),
  pc("Palladium Myr", "artifact creature — myr", "{T}: Add {C}{C}.", 3, { power: "2", toughness: "2" }),
  pc("PuPu UFO", "artifact creature — construct alien", "Flying. {T}: You may put a land card from your hand onto the battlefield.", 2, { power: "0", toughness: "2" })
], [CONTROL_BOLT, CONTROL_WIPE, CONTROL_VANILLA, CONTROL_DRAW, CONTROL_ROCK]);

// ---- Case 2: Pia, Aether Ascetic ----
const PIA = ["When Pia enters, you may discard a card. If you do, search your library for an enchantment card, reveal it, put it into your hand, then shuffle."];
const SAPLING_NURSERY = pc("Sapling Nursery", "enchantment", "Affinity for Forests. Landfall — Whenever a land you control enters, create a 3/4 green Treefolk creature token with reach. {1}{G}, Exile this enchantment: Treefolk and Forests you control gain indestructible until end of turn.", 8, { colors: ["G"] });
const LOST_IN_THE_WOODS = pc("Lost in the Woods", "enchantment", "Whenever a creature attacks you or a planeswalker you control, reveal the top card of your library. If it's a Forest card, remove that creature from combat. Then put the revealed card on the bottom of your library.", 5, { colors: ["G"] });
report("Pia, Aether Ascetic: the enchantment the deck exists to find", PIA, ["G"], [SAPLING_NURSERY, LOST_IN_THE_WOODS], [
  pc("Control Lifegift", "enchantment", "Whenever a land enters, you may gain 1 life.", 3, { colors: ["G"] }),
  pc("Control Bear", "creature — bear", "", 2, { colors: ["G"], power: "2", toughness: "2" }),
  pc("Control Growth", "instant", "target creature gets +2/+2 until end of turn.", 1, { colors: ["G"] })
]);

// Value depends on the deck: the same card under two commanders whose decks are built differently.
jxaPrint("\n== Context: Lost in the Woods under Pia (all-Forest library) vs under an unrelated commander (ordinary library)");
const under = (texts, colors) => scoreIn(LOST_IN_THE_WOODS, texts, colors);
const a = under(PIA, ["G"]);
const b = under(["Flying. Whenever this creature attacks, draw a card."], ["G"]);
jxaPrint("   under Pia: score " + a.fallback + ", bonus " + a.bonus + "; under an unrelated commander: score " + b.fallback + ", bonus " + b.bonus);
jxaPrint("   " + (a.fallback > b.fallback ? "OK  the score differs by deck" : "GAP the score does not change with the deck's makeup (no input for it exists)"));

// ---- Case 3: Fynn, the Fangbearer ----
const FYNN = ["Deathtouch. Whenever a creature you control with deathtouch deals combat damage to a player, that player gets two poison counters."];
report("Fynn: cheap carriers of the named keyword", FYNN, ["G"], [
  pc("Cheap Deathtouch One-Drop", "creature — snake", "Deathtouch", 1, { colors: ["G"], power: "1", toughness: "1" }),
  pc("Cheap Deathtouch Two-Drop", "creature — snake", "Deathtouch", 2, { colors: ["G"], power: "1", toughness: "2" }),
  pc("Vial-like Granter", "artifact", "{1}, Sacrifice this artifact: Target creature gains deathtouch until end of turn.", 1)
], [
  pc("Control Big Deathtouch", "creature — beast", "Deathtouch", 5, { colors: ["G"], power: "5", toughness: "5" }),
  pc("Control Green Vanilla", "creature — bear", "", 3, { colors: ["G"], power: "3", toughness: "3" }),
  pc("Control Growth", "instant", "target creature gets +2/+2 until end of turn.", 1, { colors: ["G"] })
]);
