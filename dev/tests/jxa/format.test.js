runSuite("format", {
  "canBePauperCommander: accepts an uncommon creature": function () {
    assertTrue(canBePauperCommander({ type: "creature — elf", rarity: "uncommon" }));
  },

  "canBePauperCommander: rejects a common creature": function () {
    assertTrue(!canBePauperCommander({ type: "creature — elf", rarity: "common" }));
  },

  "canBePauperCommander: rejects an uncommon non-creature": function () {
    assertTrue(!canBePauperCommander({ type: "sorcery", rarity: "uncommon" }));
  },

  "canBePauperCommander: a legendary creature is still eligible if uncommon": function () {
    assertTrue(canBePauperCommander({ type: "legendary creature — elf wizard", rarity: "uncommon" }));
  },

  "canBePauperCommander: double-faced card judged on the front face only (creature front)": function () {
    assertTrue(canBePauperCommander({ type: "creature — human // land", rarity: "uncommon" }));
  },

  "canBePauperCommander: double-faced card judged on the front face only (non-creature front)": function () {
    assertTrue(!canBePauperCommander({ type: "land // creature — human", rarity: "uncommon" }));
  },

  "legalForCommander: commander format ignores rarity entirely": function () {
    setActiveFormat("commander");
    assertTrue(legalForCommander(["G"], ["G"], { rarity: "mythic" }));
  },

  "legalForCommander: pauper format accepts a common card": function () {
    setActiveFormat("pauperCommander");
    assertTrue(legalForCommander(["G"], ["G"], { rarity: "common" }));
    setActiveFormat("commander");
  },

  "legalForCommander: pauper format rejects uncommon/rare/mythic": function () {
    setActiveFormat("pauperCommander");
    assertTrue(!legalForCommander(["G"], ["G"], { rarity: "uncommon" }));
    assertTrue(!legalForCommander(["G"], ["G"], { rarity: "rare" }));
    assertTrue(!legalForCommander(["G"], ["G"], { rarity: "mythic" }));
    setActiveFormat("commander");
  },

  "legalForCommander: pauper format fails closed on a missing rarity field": function () {
    setActiveFormat("pauperCommander");
    assertTrue(!legalForCommander(["G"], ["G"], {}));
    setActiveFormat("commander");
  },

  "legalForCommander: color identity is still checked under pauper format": function () {
    setActiveFormat("pauperCommander");
    assertTrue(!legalForCommander(["U"], ["G"], { rarity: "common" }));
    setActiveFormat("commander");
  },

  "canBeActiveCommander: delegates to canBeCommander under the default format": function () {
    setActiveFormat("commander");
    assertTrue(canBeActiveCommander({ type: "legendary creature — elf wizard", rarity: "rare" }));
    assertTrue(!canBeActiveCommander({ type: "creature — elf", rarity: "uncommon" }));
  },

  "canBeActiveCommander: delegates to canBePauperCommander under pauper format": function () {
    setActiveFormat("pauperCommander");
    assertTrue(canBeActiveCommander({ type: "creature — elf", rarity: "uncommon" }));
    assertTrue(!canBeActiveCommander({ type: "legendary creature — elf wizard", rarity: "rare" }));
    setActiveFormat("commander");
  },
  "legalForCommander: a plane, scheme or token is never legal, a planeswalker still is": function () {
    const colorless = [];
    assertTrue(!legalForCommander(colorless, ["W", "G"], { name: "No Way Out", type: "plane — duskmourn" }), "plane");
    assertTrue(!legalForCommander(colorless, ["W", "G"], { name: "Sample", type: "ongoing scheme" }), "scheme");
    assertTrue(!legalForCommander(colorless, ["W", "G"], { name: "Sample", type: "token creature — soldier" }), "token");
    assertTrue(legalForCommander(colorless, ["W", "G"], { name: "Sample", type: "legendary planeswalker — sample" }), "planeswalker");
    assertTrue(legalForCommander(["W"], ["W", "G"], { name: "No Way Out", type: "instant" }), "the Midnight Hunt instant");
  },

  "legalForCommander: a commander's \"you can't cast permanent spells\" leaves only lands, instants and sorceries": function () {
    const all = ["W", "U", "B", "R", "G"];
    const block = readCommanderCastBlock(["You can't cast permanent spells.\n{4}, {T}: Add {W}{U}{B}{R}{G}."], ["Codie, Vociferous Codex"]);
    assertTrue(Boolean(block), "Codie's line is read");
    setCommanderCastBlock(block);
    try {
      assertTrue(!legalForCommander(["R"], all, { name: "Guttersnipe", type: "creature — goblin shaman" }), "creature");
      assertTrue(!legalForCommander([], all, { name: "Sol Ring", type: "artifact" }), "artifact");
      assertTrue(legalForCommander(["R"], all, { name: "Lightning Bolt", type: "instant" }), "instant");
      assertTrue(legalForCommander([], all, { name: "Forest", type: "basic land — forest" }), "land");
      assertTrue(legalForCommander(["R"], all, { name: "Bonecrusher Giant", type: "creature — giant // instant — adventure",
        raw: { card_faces: [{ type_line: "Creature — Giant" }, { type_line: "Instant — Adventure" }] } }), "a card with an instant face");
      assertTrue(legalForCommander([], all, { name: "Codie, Vociferous Codex", type: "legendary artifact creature — book construct" }), "the commander itself");
    } finally {
      setCommanderCastBlock(null);
    }
    assertTrue(legalForCommander(["R"], ["R"], { name: "Guttersnipe", type: "creature — goblin shaman" }), "no block outside a build");
    assertTrue(!readCommanderCastBlock(["Your opponents can't cast spells during your turn."]), "an opponent restriction is not ours");
    assertTrue(!readCommanderCastBlock(["You can't cast spells during combat."]), "a conditional restriction is not read");
  },

  "getHybridColorOptions: the color sets that still cast a hybrid commander": function () {
    const sets = (card) => getHybridColorOptions([card]).map((s) => s.join("")).join(" ");
    // Evelyn, the Covetous: {B} is required, each hybrid needs one of its colors.
    assertEqual(sets({ colors: ["U", "B", "R"], manaCost: "{2}{U/B}{B}{B/R}", text: "flash" }), "B UB BR UBR");
    // A hybrid in rules text counts (Tatsunari, Toad Rider: {2}{B} with a {G/U} ability), so mono black is out.
    assertEqual(sets({ colors: ["U", "B", "G"], manaCost: "{2}{B}", text: "{1}{g/u}: target frog can't be blocked" }), "UB BG UBG");
    // Reminder text is not a cost (Sethron, Hurloon General).
    assertEqual(sets({ colors: ["B", "R"], manaCost: "{3}{R}{R}", text: "{2}{b/r}: minotaurs get +1/+0. ({b/r} can be paid with either {b} or {r}.)" }), "R BR");
    // No hybrid, Phyrexian or twobrid only, or mono color: no choice to offer.
    assertEqual(sets({ colors: ["W", "B"], manaCost: "{1}{W}{B}", text: "extort" }), "");
    assertEqual(sets({ colors: ["B"], manaCost: "{4}{B}{B/P}", text: "" }), "");
    assertEqual(sets({ colors: ["B"], manaCost: "{2}{B/R}", text: "" }), "");
    // A partner pair is read together.
    assertEqual(getHybridColorOptions([{ colors: ["B", "R"], manaCost: "{2}{B/R}", text: "" }, { colors: ["G"], manaCost: "{1}{G}", text: "" }]).map((s) => s.join("")).join(" "), "BG RG BRG");
  }
});
