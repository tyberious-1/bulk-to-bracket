function planEntry(name, decks, potentialDecks, synergy = 0, label = "Top Cards") {
  return { name, decks, potentialDecks, synergy, label };
}

// n distinct filler cards a theme page plays at a given rate.
function planCards(prefix, n, decks, potentialDecks) {
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(planEntry(`${prefix} ${i}`, decks, potentialDecks));
  return out;
}

runSuite("plans", {
  "planWantedCards: drops lands, thin pages and rarely played cards": function () {
    const wanted = planWantedCards([
      planEntry("Common Card", 50, 100),
      planEntry("Rare Card", 5, 100),
      planEntry("Tiny Page", 1, 2),
      planEntry("Forest Thing", 90, 100, 0, "Lands")
    ]);
    assertEqual(Array.from(wanted.keys()).join(","), "Common Card");
  },

  "buildPlanOptions: a theme is identified by cards beyond the commander's staples": function () {
    // Both themes replay the same staples, so only their own cards define them.
    const staples = planCards("Staple", 20, 60, 100);
    const core = staples;
    const stats = {
      auras: [...staples, ...planCards("Aura", 10, 60, 100)],
      mill: [...staples, ...planCards("Mill", 10, 60, 100)]
    };
    const plans = buildPlanOptions(stats, core, () => true);
    // Disjoint distinctive sets never merge, so each theme is its own plan.
    assertEqual(plans.length, 2);
    assertEqual(plans[0].wanted, 10);
  },

  "buildPlanOptions: overlapping themes merge into one plan": function () {
    const staples = planCards("Staple", 10, 60, 100);
    const shared = planCards("Shared", 8, 70, 100);
    const stats = {
      auras: [...staples, ...shared, ...planCards("Aura", 4, 70, 100)],
      voltron: [...staples, ...shared, ...planCards("Volt", 4, 70, 100)]
    };
    const plans = buildPlanOptions(stats, staples, () => true);
    assertEqual(plans.length, 1);
    assertEqual(plans[0].themes.length, 2);
  },

  "buildPlanOptions: coverage counts only owned cards": function () {
    const staples = planCards("Staple", 10, 60, 100);
    const stats = { auras: [...staples, ...planCards("Aura", 20, 70, 100)] };
    const plans = buildPlanOptions(stats, staples, (name) => name.startsWith("Aura 1"));
    // Aura 1 plus Aura 10..19
    assertEqual(plans[0].owned, 11);
    assertEqual(plans[0].fullOwned, 11);
    assertTrue(plans[0].fullWanted >= plans[0].wanted);
    assertEqual(plans[0].wanted, 20);
    assertEqual(plans[0].coreOwned, 0);
  },

  "buildPlanOptions: a light plan names the better-supported one": function () {
    const staples = planCards("Staple", 10, 60, 100);
    const stats = {
      auras: [...staples, ...planCards("Aura", 30, 70, 100)],
      mill: [...staples, ...planCards("Mill", 30, 70, 100)]
    };
    const plans = buildPlanOptions(stats, staples, (name) => name.startsWith("Aura") || name === "Mill 1");
    const mill = plans.find((p) => p.label === "Mill");
    assertTrue(mill.light);
    assertEqual(mill.betterPlan, "Auras");
    assertEqual(plans.find((p) => p.label === "Auras").light, false);
  },

  "buildPlanOptions: owning the staples does not rescue a plan with few signature cards": function () {
    const staples = planCards("Staple", 40, 60, 100);
    const stats = { mill: [...staples, ...planCards("Mill", 20, 70, 100)] };
    const plans = buildPlanOptions(stats, staples, (name) => name.startsWith("Staple") || name === "Mill 1");
    assertTrue(plans[0].fullOwned >= 30);
    assertTrue(plans[0].light);
  },

  "getActivePlanSignature: reads the signature of the plan being built": function () {
    const staples = planCards("Staple", 10, 60, 100);
    const stats = { auras: [...staples, ...planCards("Aura", 12, 70, 100)] };
    const plans = buildPlanOptions(stats, staples, () => true);
    const sig = getActivePlanSignature(planFocusMode(plans[0]), plans);
    assertTrue(sig.has(normalizeCardName("Aura 3")));
    assertTrue(!sig.has(normalizeCardName("Staple 3")));
    assertEqual(getActivePlanSignature("something else", plans).size, 0);
  },

  "buildPlanOptions: no theme data gives no plans": function () {
    assertEqual(buildPlanOptions({}, [], () => true).length, 0);
    assertEqual(buildPlanOptions(undefined, undefined, () => true).length, 0);
  },

  "buildCustomPlan: counts owned legal tribe members the commander's EDHREC page never mentions": function () {
    const owned = new Map([
      ["coral merfolk", { name: "Coral Merfolk", type_line: "Creature — Merfolk", text: "", colors: ["U"] }],
      ["quiet seer", { name: "Quiet Seer", type_line: "Creature — Merfolk Wizard", text: "", colors: ["U"] }],
      ["red merfolk", { name: "Red Merfolk", type_line: "Creature — Merfolk", text: "", colors: ["R"] }],
      ["bear", { name: "Bear", type_line: "Creature — Bear", text: "", colors: ["G"] }]
    ]);
    const plan = buildCustomPlan("Merfolk", owned, ["U", "G"], "Ivy, Gleeful Spellthief");
    assertEqual(plan.owned, 2);
    assertTrue(plan.custom);
    assertEqual(plan.light, true);
  },

  "buildCustomPlan: empty text gives no plan": function () {
    assertEqual(buildCustomPlan("  ", new Map(), ["U"]), null);
  },

  "planFocusMode: joins themes with the plan separator": function () {
    assertEqual(planFocusMode({ themes: ["auras", "voltron"] }), "auras~voltron");
  }
});

runSuite("plans: collection-filled options", {
  "addCollectionPlans: fills open slots from detected themes, skipping covered ones": function () {
    const owned = new Map();
    for (let i = 0; i < 8; i += 1) {
      owned.set(`golem ${i}`, { name: `Golem ${i}`, type_line: "Artifact Creature — Golem", text: "", colors: [] });
      owned.set(`elf ${i}`, { name: `Elf ${i}`, type_line: "Creature — Elf", text: "", colors: ["G"] });
    }
    const existing = [{ themes: ["artifacts"], label: "Artifacts", owned: 30, wanted: 40, examples: [], light: false }];
    const plans = addCollectionPlans(existing, ["artifacts", "elves", "aggro"], owned, ["G"], "Oviya");
    // artifacts is already covered; aggro matches nothing; elves has 8 owned.
    assertEqual(plans.length, 2);
    assertEqual(plans[1].label, "Elves");
    assertTrue(plans[1].fromCollection);
  },

  "addCollectionPlans: leaves a full list alone": function () {
    const full = [1, 2, 3].map((n) => ({ themes: ["t" + n], label: "T" + n, owned: 5, examples: [] }));
    assertEqual(addCollectionPlans(full, ["elves"], new Map(), ["G"]).length, 3);
  }
});

runSuite("plans: distinct options", {
  "buildPlanOptions: drops a plan that mostly repeats a chosen one": function () {
    const staples = planCards("Staple", 10, 60, 100);
    // a, b, c each overlap enough to merge into one {a,b,c} plan; d is separate.
    const shared = planCards("Shared", 8, 70, 100);
    const stats = {
      a: [...staples, ...shared, ...planCards("A", 3, 70, 100)],
      b: [...staples, ...shared, ...planCards("B", 3, 70, 100)],
      c: [...staples, ...shared, ...planCards("C", 3, 70, 100)],
      d: [...staples, ...planCards("D", 10, 70, 100)]
    };
    const plans = buildPlanOptions(stats, staples, () => true);
    for (let i = 0; i < plans.length; i += 1) {
      for (let j = i + 1; j < plans.length; j += 1) {
        const common = plans[i].themes.filter((t) => plans[j].themes.includes(t)).length;
        assertTrue(common <= 1);
      }
    }
  }
});
