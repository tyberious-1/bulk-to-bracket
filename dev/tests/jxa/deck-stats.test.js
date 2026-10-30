runSuite("deck-stats", {
  "applyCurveFirstRoleTargets: no-op when modePrefs.curveFirst is falsy": function () {
    const targets = { ramp: 10, draw: 10, removal: 8, wipe: 3 };
    const result = applyCurveFirstRoleTargets(targets, {});
    assertEqual(result.ramp, 10);
    assertEqual(result.draw, 10);
    assertEqual(result.removal, 8);
    assertEqual(result.wipe, 3);
  },

  "applyCurveFirstRoleTargets: no-op when modePrefs is undefined": function () {
    const targets = { ramp: 10, draw: 10, removal: 8, wipe: 3 };
    const result = applyCurveFirstRoleTargets(targets, undefined);
    assertEqual(result.ramp, 10);
    assertEqual(result.wipe, 3);
  },

  "applyCurveFirstRoleTargets: caps ramp at 4 and wipe at 1, boosts draw and removal by 4": function () {
    const targets = { ramp: 10, draw: 10, removal: 8, wipe: 3 };
    const result = applyCurveFirstRoleTargets(targets, { curveFirst: true });
    assertEqual(result.ramp, 4);
    assertEqual(result.draw, 14);
    assertEqual(result.removal, 12);
    assertEqual(result.wipe, 1);
  },

  "applyCurveFirstRoleTargets: a cap never raises a target already below it": function () {
    const targets = { ramp: 2, draw: 10, removal: 8, wipe: 0 };
    const result = applyCurveFirstRoleTargets(targets, { curveFirst: true });
    assertEqual(result.ramp, 2);
    assertEqual(result.wipe, 0);
  }
});
