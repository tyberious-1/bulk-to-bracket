runSuite("type-plan", {
  "landDropHitChance: falls off as the turn number rises": function () {
    const t2 = landDropHitChance(2, 38);
    const t4 = landDropHitChance(4, 38);
    const t6 = landDropHitChance(6, 38);
    assertTrue(t2 > t4 && t4 > t6, "expected " + t2 + " > " + t4 + " > " + t6);
    assertTrue(t4 > 0.55 && t4 < 0.62, "turn-4 odds at 38 lands should be near 58%, got " + t4);
  },
  "landDropHitChance: more lands raises the odds": function () {
    assertTrue(landDropHitChance(5, 40) > landDropHitChance(5, 36));
  },
  "buildLandDropCurveShares: sums to 1 and tapers toward the top end": function () {
    const shares = buildLandDropCurveShares(38);
    const total = Object.values(shares).reduce((a, b) => a + b, 0);
    assertTrue(Math.abs(total - 1) < 1e-9, "shares sum to " + total);
    assertTrue(shares[4] > shares[5] && shares[5] > shares[6] && shares[6] >= shares[7]);
  },
  "buildLandDropCurveShares: top end is smaller than the default but never zero": function () {
    const shares = buildLandDropCurveShares(38);
    const top = shares[6] + shares[7];
    assertTrue(top < DEFAULT_CURVE_SHARES[6] + DEFAULT_CURVE_SHARES[7], "top end " + top);
    assertTrue(shares[6] >= 0.03 && shares[7] >= 0.03, "floor held");
  },
  "buildLandDropCurveShares: shifts weight into bands 2 and 3": function () {
    const shares = buildLandDropCurveShares(38);
    assertTrue(shares[2] > DEFAULT_CURVE_SHARES[2] && shares[3] > DEFAULT_CURVE_SHARES[3]);
  },
  "getCommanderCostReduction: reads Kaza's instant-or-sorcery reducer, variable X counted as 1": function () {
    const text = "Flying, haste\n{T}: The next instant or sorcery spell you cast this turn costs {X} less to cast, where X is the number of Wizards you control as this ability resolves.";
    const reduction = getCommanderCostReduction([text]);
    assertEqual(reduction.amount, 1);
    assertEqual(reduction.types, ["instant", "sorcery"]);
  },
  "getCommanderCostReduction: a numeric reducer is taken as written, capped at 2": function () {
    assertEqual(getCommanderCostReduction(["Creature spells you cast cost {1} less to cast."]).amount, 1);
    assertEqual(getCommanderCostReduction(["Artifact spells you cast cost {3} less to cast."]).amount, 2);
  },
  "getCommanderCostReduction: untyped reducers and unrelated text return null": function () {
    assertEqual(getCommanderCostReduction(["Spells you cast cost {1} less to cast."]), null);
    assertEqual(getCommanderCostReduction(["Flying. Whenever you cast a spell, draw a card."]), null);
    assertEqual(getCommanderCostReduction([undefined, null]), null);
  },
  "getEffectiveCurveCmc: discounts only the named types": function () {
    const reduction = { types: ["instant", "sorcery"], amount: 1 };
    assertEqual(getEffectiveCurveCmc({ cmc: 5, type: "sorcery" }, { manaCost: "{3}{U}{R}" }, reduction), 4);
    assertEqual(getEffectiveCurveCmc({ cmc: 5, type: "creature - dragon" }, { manaCost: "{3}{U}{R}" }, reduction), 5);
    assertEqual(getEffectiveCurveCmc({ cmc: 5, type: "sorcery" }, { manaCost: "{3}{U}{R}" }, null), 5);
  },
  "getEffectiveCurveCmc: colored pips are a floor": function () {
    const reduction = { types: ["instant"], amount: 2 };
    assertEqual(getEffectiveCurveCmc({ cmc: 2, type: "instant" }, { manaCost: "{U}{U}" }, reduction), 2);
    assertEqual(getEffectiveCurveCmc({ cmc: 4, type: "instant" }, { manaCost: "{2}{U}{U}" }, reduction), 2);
    assertEqual(getEffectiveCurveCmc({ cmc: 6, type: "instant" }, { manaCost: "{4}{U}{R}" }, reduction), 4);
  },
  "curveCmcOf: prefers the effective cost, falls back to printed": function () {
    assertEqual(curveCmcOf({ cmc: 5, curveCmc: 4 }), 4);
    assertEqual(curveCmcOf({ cmc: 5 }), 5);
  },
  "getCardsNeededForTypeTargets: counts each bucket's shortfall, neediest bucket first": function () {
    const deck = [{ type: "creature" }, { type: "instant" }];
    const buckets = {
      Creature: { target: 30, min: 15 },
      Instant: { target: 4, min: 1 },
      Sorcery: { target: 2, min: 1 },
      Artifact: { target: 1, min: 1 }
    };
    const needed = getCardsNeededForTypeTargets(deck, buckets);
    assertEqual(needed.filter((b) => b === "Creature").length, 29);
    assertEqual(needed.filter((b) => b === "Instant").length, 3);
    assertEqual(needed.filter((b) => b === "Sorcery").length, 2);
    assertEqual(needed.filter((b) => b === "Artifact").length, 1);
    assertEqual(needed[0], "Creature");
  },
  "getCardsNeededForTypeTargets: a bucket at or over target contributes nothing": function () {
    const deck = [{ type: "instant" }, { type: "instant" }];
    assertEqual(getCardsNeededForTypeTargets(deck, { Instant: { target: 2 }, Sorcery: { target: 0 } }), []);
  },
  "clearsTypeTargetFloor: a source with nothing in the deck yet always clears": function () {
    assertTrue(clearsTypeTargetFloor({ score: 1 }, "edhrec", [{ source: "fb-theme", score: 50 }]));
    assertTrue(clearsTypeTargetFloor({ score: 1 }, "edhrec", []));
  },
  "clearsTypeTargetFloor: compares only against the same source's average": function () {
    const deck = [
      { source: "edhrec", score: 20 }, { source: "edhrec", score: 24 },
      { source: "fb-theme", score: 60 }
    ];
    assertTrue(clearsTypeTargetFloor({ score: 14 }, "edhrec", deck), "14 >= 0.6 * 22");
    assertTrue(!clearsTypeTargetFloor({ score: 12 }, "edhrec", deck), "12 < 0.6 * 22");
    assertTrue(clearsTypeTargetFloor({ score: 14 }, "fb-generic", deck), "no generic peers yet");
  },
  "adjustCurveShares: default ramp and no strategy flags leaves shares unchanged": function () {
    const shares = adjustCurveShares(DEFAULT_CURVE_SHARES, { ramp: 10 }, {});
    for (const band of Object.keys(DEFAULT_CURVE_SHARES)) {
      assertClose(shares[band], DEFAULT_CURVE_SHARES[band], 0.0001, "band " + band);
    }
  },
  "adjustCurveShares: high ramp target shifts weight from low bands to high bands": function () {
    const shares = adjustCurveShares(DEFAULT_CURVE_SHARES, { ramp: 16 }, {});
    assertTrue(shares[1] < DEFAULT_CURVE_SHARES[1], "expected band 1 share to shrink");
    assertTrue(shares[7] > DEFAULT_CURVE_SHARES[7], "expected band 7 share to grow");
  },
  "adjustCurveShares: go-wide strategy shifts weight from high bands to low bands": function () {
    const shares = adjustCurveShares(DEFAULT_CURVE_SHARES, { ramp: 10 }, { wantsGoWide: true });
    assertTrue(shares[1] > DEFAULT_CURVE_SHARES[1], "expected band 1 share to grow");
    assertTrue(shares[7] < DEFAULT_CURVE_SHARES[7], "expected band 7 share to shrink");
  },
  "adjustCurveShares: shares still sum to 1": function () {
    const shares = adjustCurveShares(DEFAULT_CURVE_SHARES, { ramp: 16 }, { wantsGoWide: true });
    const total = Object.values(shares).reduce((sum, v) => sum + v, 0);
    assertClose(total, 1, 0.0001);
  },
  "adjustCurveShares: bands 3 and 4 are never touched": function () {
    const shares = adjustCurveShares(DEFAULT_CURVE_SHARES, { ramp: 16 }, { wantsGoWide: true });
    assertClose(shares[3], DEFAULT_CURVE_SHARES[3], 0.0001);
    assertClose(shares[4], DEFAULT_CURVE_SHARES[4], 0.0001);
  },
  "buildRoleTargetPlan: role buckets plus synergy sum to nonlandCount": function () {
    const plan = buildRoleTargetPlan(null, { wantsCreatures: true }, 37, { ramp: 10, draw: 10, removal: 8, wipe: 3 }, [], 99, {});
    const sum = plan.roleBuckets.ramp.target + plan.roleBuckets.draw.target
      + plan.roleBuckets.removal.target + plan.roleBuckets.wipe.target
      + plan.roleBuckets.synergy.target;
    assertEqual(sum, plan.nonlandCount);
  },
  "buildRoleTargetPlan: role bucket targets match the supplied roleTargets": function () {
    const plan = buildRoleTargetPlan(null, { wantsCreatures: true }, 37, { ramp: 12, draw: 9, removal: 7, wipe: 2 }, [], 99, {});
    assertEqual(plan.roleBuckets.ramp.target, 12);
    assertEqual(plan.roleBuckets.draw.target, 9);
    assertEqual(plan.roleBuckets.removal.target, 7);
    assertEqual(plan.roleBuckets.wipe.target, 2);
  },
  "buildRoleTargetPlan: typeBuckets have no max, only target and min": function () {
    const plan = buildRoleTargetPlan(null, { wantsCreatures: true }, 37, { ramp: 10, draw: 10, removal: 8, wipe: 3 }, [], 99, {});
    for (const bucket of Object.keys(plan.typeBuckets)) {
      assertTrue(plan.typeBuckets[bucket].max === undefined, bucket + " should have no max");
      assertTrue(typeof plan.typeBuckets[bucket].target === "number", bucket + " should have a target");
    }
  },
  "buildRoleTargetPlan: Creature keeps its floor of 15": function () {
    const plan = buildRoleTargetPlan(null, { wantsCreatures: false }, 37, { ramp: 10, draw: 10, removal: 8, wipe: 3 }, [], 99, {});
    assertTrue(plan.typeBuckets.Creature.min >= 15, "expected Creature min >= 15, got " + plan.typeBuckets.Creature.min);
  },
  "buildRoleTargetPlan: landCount and nonlandCount still sum to deckSize": function () {
    const plan = buildRoleTargetPlan(null, { wantsCreatures: true }, 37, { ramp: 10, draw: 10, removal: 8, wipe: 3 }, [], 99, {});
    assertEqual(plan.landCount + plan.nonlandCount, 99);
  },
  "getRoleCounts: tallies synergy alongside the four support roles": function () {
    const deck = [
      { role: "ramp" },
      { role: "synergy" },
      { role: "synergy" }
    ];
    const counts = getRoleCounts(deck);
    assertEqual(counts.ramp, 1);
    assertEqual(counts.synergy, 2);
  },
  "chooseBestFlexibleCard: prefers a card whose role is short over one whose type is short": function () {
    const plan = {
      roleBuckets: { ramp: { target: 10, min: 8, max: 12 }, draw: { target: 10, min: 8, max: 12 }, removal: { target: 8, min: 6, max: 10 }, wipe: { target: 3, min: 1, max: 5 }, synergy: { target: 2, min: 0, max: 5 } },
      typeBuckets: { Creature: { target: 20, min: 8 }, Instant: { target: 7, min: 1 }, Sorcery: { target: 8, min: 1 }, Artifact: { target: 7, min: 1 }, Enchantment: { target: 5, min: 1 }, Planeswalker: { target: 1, min: 0 } }
    };
    // deck already meets the synergy target (2/2) but is nowhere near the
    // Creature type target (2/20) -- this isolates the two scoring terms:
    // "Overfull Type" has a satisfied role (deficit 0) and a badly short
    // type; "Needs Ramp" has a badly short role and a short-but-lesser type.
    const deck = [
      { name: "Synergy A", role: "synergy", type: "Creature", cmc: 2 },
      { name: "Synergy B", role: "synergy", type: "Creature", cmc: 2 }
    ];
    const pool = [
      { name: "Needs Ramp", score: 10, role: "ramp", type: "Artifact", cmc: 2 },
      { name: "Overfull Type", score: 10, role: "synergy", type: "Creature", cmc: 2 }
    ];
    const best = chooseBestFlexibleCard(pool, deck, plan, new Set(), new Set());
    assertEqual(best.name, "Needs Ramp");
  },
  "chooseBestFlexibleCard: a type bucket already past its target loses to an equal card in a bucket under it": function () {
    const plan = {
      roleBuckets: { synergy: { target: 10, min: 0, max: 13 } },
      typeBuckets: { Creature: { target: 5, min: 1 }, Instant: { target: 1, min: 1 } }
    };
    // Instant is over target (3/1), Creature is under it (1/5). Same score and
    // same (satisfied) role, so only the type terms can separate them.
    const deck = [
      { name: "I1", role: "synergy", type: "Instant", cmc: 2 },
      { name: "I2", role: "synergy", type: "Instant", cmc: 2 },
      { name: "I3", role: "synergy", type: "Instant", cmc: 2 },
      { name: "C1", role: "synergy", type: "Creature", cmc: 2 }
    ];
    const pool = [
      { name: "Another Instant", score: 20, role: "synergy", type: "Instant", cmc: 2 },
      { name: "Another Creature", score: 20, role: "synergy", type: "Creature", cmc: 2 }
    ];
    assertEqual(chooseBestFlexibleCard(pool, deck, plan, new Set(), new Set()).name, "Another Creature");
  },
  "chooseBestFlexibleCard: a satisfied synergy target stops outscoring other roles": function () {
    // Regression check for the bug this task's Step 3a fixes: before it,
    // getRoleCounts had no synergy key, so roleCounts.synergy was always
    // undefined -> 0, and synergy's deficit (target - 0) never shrank no
    // matter how many synergy cards were already in the deck.
    const plan = {
      roleBuckets: { ramp: { target: 10, min: 8, max: 12 }, draw: { target: 10, min: 8, max: 12 }, removal: { target: 8, min: 6, max: 10 }, wipe: { target: 3, min: 1, max: 5 }, synergy: { target: 2, min: 0, max: 5 } },
      typeBuckets: { Creature: { target: 20, min: 8 }, Instant: { target: 7, min: 1 }, Sorcery: { target: 8, min: 1 }, Artifact: { target: 7, min: 1 }, Enchantment: { target: 5, min: 1 }, Planeswalker: { target: 1, min: 0 } }
    };
    const deck = [
      { name: "Already In", role: "synergy", type: "Creature", cmc: 2 },
      { name: "Also In", role: "synergy", type: "Creature", cmc: 2 }
    ];
    const pool = [
      { name: "Needs Draw", score: 5, role: "draw", type: "Instant", cmc: 2 },
      { name: "More Synergy", score: 5, role: "synergy", type: "Creature", cmc: 2 }
    ];
    const best = chooseBestFlexibleCard(pool, deck, plan, new Set(), new Set());
    assertEqual(best.name, "Needs Draw");
  },
  "chooseBestFlexibleCard: prefers an in-budget card once the curve plan's band is full": function () {
    // Phase 2 fills most of a full build's nonland slots and, unlike Phase 0
    // and Phase 1, never consulted the curve plan at all -- a CMC-3 card
    // could always outscore an in-budget alternative on role/type deficit
    // terms alone, however full band 3 already was.
    const plan = {
      roleBuckets: { synergy: { target: 10, min: 0, max: 12 } },
      typeBuckets: { Creature: { target: 20, min: 8 } }
    };
    const deck = [];
    const curvePlan = { caps: { 1: 5, 3: 1 }, counts: { 1: 0, 3: 1 } };
    const pool = [
      { name: "CMC3 High Score", score: 50, role: "synergy", type: "Creature", cmc: 3 },
      { name: "CMC1 Low Score", score: 10, role: "synergy", type: "Creature", cmc: 1 }
    ];
    const best = chooseBestFlexibleCard(pool, deck, plan, new Set(), new Set(), curvePlan);
    assertEqual(best.name, "CMC1 Low Score");
  },
  "getCardsNeededForTypeMinimums: reports one entry per unmet type minimum": function () {
    const typeBuckets = { Creature: { target: 20, min: 8 }, Instant: { target: 7, min: 1 } };
    const deck = [];
    const needed = getCardsNeededForTypeMinimums(deck, typeBuckets);
    assertEqual(needed.filter((b) => b === "Creature").length, 8);
    assertEqual(needed.filter((b) => b === "Instant").length, 1);
  },
  "buildRoleTargetPlan: trusts targetLandCount verbatim, even when edhrecTypeAverages.Land disagrees": function () {
    const plan = buildRoleTargetPlan({ Land: 42 }, { wantsCreatures: true }, 35, { ramp: 10, draw: 10, removal: 8, wipe: 3 }, [], 99, {});
    assertEqual(plan.landCount, 35);
    assertEqual(plan.nonlandCount, 64);
  }
});
