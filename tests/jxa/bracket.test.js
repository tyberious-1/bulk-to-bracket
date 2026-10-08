runSuite("bracket", {
  "generateWarnings returns fallbackGenericRatio of 0 with no fallback-generic cards": function () {
    const deck = [
      { name: "Sol Ring", type: "Artifact", source: "edhrec", role: "ramp" },
      { name: "Forest", type: "Basic Land - Forest", source: "basic-land", role: "land" }
    ];
    const bracketInfo = {
      bracket: 2,
      gameChangers: [],
      roleCounts: {
        ramp: { total: 10 }, draw: { total: 10 }, removal: { total: 10 }, wipe: { total: 3 }
      }
    };
    const result = generateWarnings(deck, [], bracketInfo);
    assertEqual(result.fallbackGenericRatio, 0);
  },

  "generateWarnings flags a nonzero fallbackGenericRatio when any fallback-generic card is present": function () {
    // Mirrors the real Rosheen Meanderer case that motivated this signal: just
    // two fallback-generic picks out of ~60 nonland slots (~3%) -- far below
    // any flat ratio threshold worth picking, so the signal has to fire on
    // any presence at all, not a proportion.
    const deck = [
      { name: "Human Torch, Johnny Storm", type: "Creature", source: "fallback-generic", role: "synergy" },
      { name: "Iron Spider, Stark Upgrade", type: "Creature", source: "fallback-generic", role: "synergy" },
      ...Array.from({ length: 58 }, (_, i) => ({ name: `Edhrec Pick ${i}`, type: "Creature", source: "edhrec", role: "synergy" })),
      { name: "Forest", type: "Basic Land - Forest", source: "basic-land", role: "land" }
    ];
    const bracketInfo = {
      bracket: 2,
      gameChangers: [],
      roleCounts: {
        ramp: { total: 10 }, draw: { total: 10 }, removal: { total: 10 }, wipe: { total: 3 }
      }
    };
    const result = generateWarnings(deck, [], bracketInfo);
    assertTrue(result.fallbackGenericRatio > 0, "expected a nonzero ratio when a fallback-generic card is present");
    assertTrue(result.fallbackGenericRatio < 0.1, "expected the ratio to still be small, matching the real motivating case");
  },

  "generateWarnings still returns a warnings array under the new return shape": function () {
    const deck = [];
    const bracketInfo = {
      bracket: 2,
      gameChangers: [],
      roleCounts: {
        ramp: { total: 0 }, draw: { total: 0 }, removal: { total: 0 }, wipe: { total: 0 }
      }
    };
    const result = generateWarnings(deck, [], bracketInfo);
    assertTrue(Array.isArray(result.warnings), "expected warnings to be an array");
    assertTrue(result.warnings.includes("Ramp count is on the low side."), "expected the pre-existing ramp warning to still fire");
  }
});
