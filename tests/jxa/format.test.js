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
  }
});
