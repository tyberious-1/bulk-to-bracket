runSuite("type-plan", {
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
