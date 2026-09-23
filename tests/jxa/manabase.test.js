runSuite("manabase", {
  "parsePips: simple double green": function () {
    assertEqual(parsePips("{2}{G}{G}"), { W: 0, U: 0, B: 0, R: 0, G: 2 });
  },
  "parsePips: hybrid splits between colors": function () {
    const pips = parsePips("{1}{W/U}");
    assertClose(pips.W, 0.5, 0.001);
    assertClose(pips.U, 0.5, 0.001);
  },
  "parsePips: phyrexian counts as a full pip": function () {
    const pips = parsePips("{G/P}");
    assertEqual(pips.G, 1);
  },
  "parsePips: X and generic contribute no colored pips": function () {
    assertEqual(parsePips("{X}{X}{2}"), { W: 0, U: 0, B: 0, R: 0, G: 0 });
  },
  "parsePips: empty or missing mana cost is all zero": function () {
    assertEqual(parsePips(""), { W: 0, U: 0, B: 0, R: 0, G: 0 });
    assertEqual(parsePips(undefined), { W: 0, U: 0, B: 0, R: 0, G: 0 });
  },
  "parsePips: multicolor cost sums each color separately": function () {
    assertEqual(parsePips("{1}{B}{B}{R}"), { W: 0, U: 0, B: 2, R: 1, G: 0 });
  },
  "parsePips: split cost only counts the first half": function () {
    const pips = parsePips("{2}{R} // {1}{R}");
    assertEqual(pips.R, 1);
    assertEqual(pips.W, 0);
  },
  "parsePips: a mana cost with no // separator is unaffected": function () {
    assertEqual(parsePips("{1}{U}{U}"), { W: 0, U: 2, B: 0, R: 0, G: 0 });
  },
  "estimateLandCount: pip-light two-color pool lands near the color-count floor": function () {
    const pool = [
      { score: 10, manaCost: "{1}{G}" },
      { score: 9, manaCost: "{1}{U}" },
      { score: 8, manaCost: "{2}" },
      { score: 7, manaCost: "{3}" }
    ];
    const count = estimateLandCount(pool, ["G", "U"], { ramp: 10, draw: 10, removal: 8, wipe: 3 });
    assertTrue(count >= 35 && count <= 39, "expected a modest count, got " + count);
  },
  "estimateLandCount: pip-heavy pool lands higher than a pip-light pool": function () {
    const lightPool = [
      { score: 10, manaCost: "{2}" },
      { score: 9, manaCost: "{3}" }
    ];
    const heavyPool = [
      { score: 10, manaCost: "{G}{G}{G}" },
      { score: 9, manaCost: "{U}{U}{U}" }
    ];
    const light = estimateLandCount(lightPool, ["G", "U"], { ramp: 10 });
    const heavy = estimateLandCount(heavyPool, ["G", "U"], { ramp: 10 });
    assertTrue(heavy > light, "expected pip-heavy (" + heavy + ") > pip-light (" + light + ")");
  },
  "estimateLandCount: more ramp than default lowers the count": function () {
    const pool = [{ score: 10, manaCost: "{2}{G}" }];
    const lowRamp = estimateLandCount(pool, ["G"], { ramp: 10 });
    const highRamp = estimateLandCount(pool, ["G"], { ramp: 16 });
    assertTrue(highRamp <= lowRamp, "expected high-ramp (" + highRamp + ") <= low-ramp (" + lowRamp + ")");
  },
  "estimateLandCount: always clamps to [35, 42]": function () {
    const extreme = [{ score: 1, manaCost: "{W}{W}{W}{W}{W}{W}" }];
    const count = estimateLandCount(extreme, ["W"], { ramp: 0 });
    assertTrue(count >= 35 && count <= 42, "expected clamp to hold, got " + count);
  },
  "computeColorSourceTargets: sums to landCount": function () {
    const cards = [{ manaCost: "{1}{G}{G}" }, { manaCost: "{1}{B}" }, { manaCost: "{2}" }];
    const targets = computeColorSourceTargets(cards, ["B", "G"], 37);
    assertEqual(targets.B + targets.G, 37);
  },
  "computeColorSourceTargets: heavier pip color gets more sources": function () {
    const cards = [
      { manaCost: "{G}{G}{G}" },
      { manaCost: "{G}{G}" },
      { manaCost: "{B}" }
    ];
    const targets = computeColorSourceTargets(cards, ["B", "G"], 37);
    assertTrue(targets.G > targets.B, "expected G (" + targets.G + ") > B (" + targets.B + ")");
  },
  "computeColorSourceTargets: a splashed color still gets a usable floor": function () {
    const cards = [
      { manaCost: "{G}{G}{G}{G}{G}{G}{G}{G}" },
      { manaCost: "{1}{B}" }
    ];
    const targets = computeColorSourceTargets(cards, ["B", "G"], 37);
    // Only two colors share this identity, so the floor is landCount/2.5 (15
    // here), not the flat 12%-of-landCount minimum (8) -- see the next test.
    assertTrue(targets.B >= 15, "expected a two-color floor of at least 15, got " + targets.B);
  },
  "computeColorSourceTargets: a two-color deck floors the lighter color well above the flat splash minimum": function () {
    // A lopsided pip split (8 R pips vs 1 B pip) that would otherwise starve
    // black down toward the flat 8-source minimum -- but a commander needing
    // both colors of a 2-color identity reliably (e.g. a {1}{B}{R} cost)
    // can't survive that thin a floor, even though black is a real color
    // here, not a one-card splash. See tools/jxa-harness/compare_report.md
    // for the real deck (Rivaz of the Claw) that caught this.
    const cards = [
      { manaCost: "{R}" }, { manaCost: "{R}" }, { manaCost: "{R}" }, { manaCost: "{R}" },
      { manaCost: "{R}" }, { manaCost: "{R}" }, { manaCost: "{R}" }, { manaCost: "{R}" },
      { manaCost: "{B}" }
    ];
    const targets = computeColorSourceTargets(cards, ["B", "R"], 39);
    assertEqual(targets.B + targets.R, 39);
    assertTrue(targets.B >= 16, "expected B's floor to scale with color count (39/2.5=16), got " + targets.B);
  },
  "computeColorSourceTargets: no pip data splits evenly": function () {
    const cards = [{ manaCost: "{2}" }, { manaCost: "{3}" }];
    const targets = computeColorSourceTargets(cards, ["U", "R"], 37);
    assertEqual(targets.U + targets.R, 37);
    assertTrue(Math.abs(targets.U - targets.R) <= 1, "expected an even split, got U=" + targets.U + " R=" + targets.R);
  },
  "computeColorSourceTargets: five colors at a low land count still sums to landCount": function () {
    // 5 colors x the 8-source splash floor = 40, which overflows a 35-land
    // count -- the floors themselves have to scale down to fit.
    const cards = [
      { manaCost: "{W}" },
      { manaCost: "{U}" },
      { manaCost: "{B}" },
      { manaCost: "{R}" },
      { manaCost: "{G}" }
    ];
    const targets = computeColorSourceTargets(cards, ["W", "U", "B", "R", "G"], 35);
    const sum = targets.W + targets.U + targets.B + targets.R + targets.G;
    assertEqual(sum, 35);
    for (const color of ["W", "U", "B", "R", "G"]) {
      assertTrue(targets[color] >= 1, color + " should still get at least 1 source, got " + targets[color]);
    }
  },
  "buildBasicManaBase: with colorTargets, tops up the color furthest below its own target": function () {
    // No nonbasics played, so both colors start at 0 sources. Without
    // colorTargets this would alternate evenly; with a 30/7 target split it
    // should heavily favor G.
    const lands = buildBasicManaBase(["B", "G"], 10, [], { B: 7, G: 30 });
    const gCount = lands.filter((land) => land.colors.includes("G")).length;
    const bCount = lands.filter((land) => land.colors.includes("B")).length;
    assertTrue(gCount > bCount, "expected G (" + gCount + ") > B (" + bCount + ") when G's target is far higher");
  },
  "buildBasicManaBase: colorTargets omitted behaves exactly as before": function () {
    const lands = buildBasicManaBase(["U", "R"], 4, []);
    assertEqual(lands.length, 4);
  },
  "resolveLandCount: no EDHREC average returns the pip estimate unchanged": function () {
    assertEqual(resolveLandCount(35, null), 35);
    assertEqual(resolveLandCount(40, {}), 40);
  },
  "resolveLandCount: EDHREC average clamps a wildly different pip estimate": function () {
    // EDHREC says 40 (already in [38,42]) -- a pip estimate of 35 is 5 away,
    // so it gets pulled up to 38 (40 - 2), not overridden to exactly 40.
    assertEqual(resolveLandCount(35, { Land: 40 }), 38);
  },
  "resolveLandCount: a pip estimate already within the sanity band passes through": function () {
    // EDHREC says 40 -- a pip estimate of 39 is within +/-2, so it wins.
    assertEqual(resolveLandCount(39, { Land: 40 }), 39);
  },
  "resolveLandCount: EDHREC's raw average still gets the 38-42 floor/ceiling correction": function () {
    // EDHREC reports 34 (land-light, as the design doc says it runs) -- the
    // sanity bound corrects that to [38,42] before applying, same as before.
    assertEqual(resolveLandCount(42, { Land: 34 }), 40);
  }
});
