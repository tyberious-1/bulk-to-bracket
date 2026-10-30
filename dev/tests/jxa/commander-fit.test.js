
function cfCard(name, type, text, colors) {
  return { name, type, text: text || "", cmc: 3, colors: colors || [], rarity: "rare", manaCost: "" };
}
const CF_ZOMBIE = { kind: "tribal", tag: "zombies", label: "Zombies", tribe: "zombie" };
const CF_DECK = [
  cfCard("Zombie A", "creature — zombie", "", ["B"]),
  cfCard("Zombie B", "creature — zombie", "", ["B"]),
  cfCard("Island Spell", "instant", "draw a card.", ["U"])
];

runSuite("commander-fit", {
  "a commander covering the deck's colors has no cuts": () => {
    const rows = rankCommanderFits(CF_DECK, [{ card: cfCard("Ub Lord", "legendary creature — zombie noble", "", ["U", "B"]), owned: true }], CF_ZOMBIE);
    assertEqual(rows.length, 1);
    assertEqual(rows[0].cuts, []);
  },

  "a commander narrower than the deck lists the cards it forces out": () => {
    const rows = rankCommanderFits(CF_DECK, [{ card: cfCard("Mono B Lord", "legendary creature — zombie noble", "", ["B"]), owned: true }], CF_ZOMBIE);
    assertEqual(rows[0].cuts, ["Island Spell"]);
  },

  "fewer cuts rank first, then a tribe commander over a stranger": () => {
    const rows = rankCommanderFits(CF_DECK, [
      { card: cfCard("Mono B Lord", "legendary creature — zombie noble", "", ["B"]), owned: true },
      { card: cfCard("Ub Stranger", "legendary creature — human wizard", "", ["U", "B"]), owned: true },
      { card: cfCard("Ub Lord", "legendary creature — zombie noble", "", ["U", "B"]), owned: true }
    ], CF_ZOMBIE);
    assertEqual(rows.map((r) => r.card.name), ["Ub Lord", "Ub Stranger", "Mono B Lord"]);
  },

  "a card that cannot be a commander is skipped": () => {
    const rows = rankCommanderFits(CF_DECK, [{ card: cfCard("Plain Bear", "creature — bear", "", ["B"]), owned: true }], CF_ZOMBIE);
    assertEqual(rows, []);
  },

  "a commander that would cut more than the limit is dropped": () => {
    const deck = [];
    for (let i = 0; i < COMMANDER_FIT_MAX_CUTS + 1; i += 1) deck.push(cfCard(`Blue ${i}`, "instant", "draw a card.", ["U"]));
    const rows = rankCommanderFits(deck, [{ card: cfCard("Mono B Lord", "legendary creature — zombie noble", "", ["B"]), owned: true }], CF_ZOMBIE);
    assertEqual(rows, []);
  },

  "buildCommanderCandidates: singles for commanders, pairs for legal partners, Backgrounds only as a pair": () => {
    const partnerA = cfCard("Partner A", "legendary creature — human", "partner", ["R"]);
    const partnerB = cfCard("Partner B", "legendary creature — elf", "partner", ["G"]);
    const chooser = cfCard("Chooser", "legendary creature — human", "choose a background", ["B"]);
    const background = cfCard("Cult Background", "legendary enchantment — background", "commander creatures you own have menace.", ["B"]);
    const plain = cfCard("Plain Lord", "legendary creature — zombie", "", ["B"]);
    const entries = [partnerA, partnerB, chooser, background, plain].map((card) => ({ card, owned: true }));
    const out = buildCommanderCandidates(entries);
    const names = out.map((c) => c.cards.map((card) => card.name).join(" + "));
    assertTrue(names.includes("Partner A") && names.includes("Plain Lord"), "singles missing");
    assertTrue(!names.includes("Cult Background"), "a Background is not a commander on its own");
    assertTrue(names.includes("Partner A + Partner B"), "partner pair missing");
    assertTrue(names.includes("Chooser + Cult Background"), "background pair missing");
    assertTrue(!names.includes("Partner A + Plain Lord"), "illegal pair offered");
  },

  "buildCommanderCandidates: a commander you do not own is never paired": () => {
    const a = cfCard("Partner A", "legendary creature — human", "partner", ["R"]);
    const b = cfCard("Partner B", "legendary creature — elf", "partner", ["G"]);
    const out = buildCommanderCandidates([{ card: a, owned: true }, { card: b, owned: false }]);
    assertEqual(out.map((c) => c.cards.length), [1, 1]);
  },

  "rankCommanderFits: a pair uses the combined colors and says so in its row": () => {
    const deck = [cfCard("Red Spell", "instant", "draw a card.", ["R"]), cfCard("Green Spell", "instant", "draw a card.", ["G"]), cfCard("Blue Spell", "instant", "draw a card.", ["U"])];
    const a = cfCard("Partner A", "legendary creature — human", "partner", ["R"]);
    const b = cfCard("Partner B", "legendary creature — elf", "partner", ["G"]);
    const rows = rankCommanderFits(deck, [{ cards: [a, b], owned: true }], CF_ZOMBIE);
    assertEqual(rows[0].colors, ["R", "G"]);
    assertEqual(rows[0].cuts, ["Blue Spell"]);
    assertEqual(rows[0].cards.length, 2);
    assertEqual(rows[0].card.name, "Partner A");
  },

  "commanderIdentity and narrowDeckColors: the deck keeps only the colors the commander has": () => {
    assertEqual(commanderIdentity([cfCard("x", "creature", "", ["G"]), cfCard("y", "creature", "", ["W", "G"])]), ["W", "G"]);
    assertEqual(narrowDeckColors(["U", "B"], ["B", "G"]), ["B"]);
    assertEqual(narrowDeckColors(["U", "B"], []), []);
    assertEqual(narrowDeckColors(["B"], ["W", "U", "B", "R", "G"]), ["B"]);
  },

  "the owned flag is carried through so the UI can mark commanders not in the collection": () => {
    const rows = rankCommanderFits(CF_DECK, [{ card: cfCard("Ub Lord", "legendary creature — zombie noble", "", ["U", "B"]), owned: false }], CF_ZOMBIE);
    assertEqual(rows[0].owned, false);
  }
});
