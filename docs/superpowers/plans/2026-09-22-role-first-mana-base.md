# Role-First Type Planning & Pip-Based Mana Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace EDHREC-population-average and color-identity heuristics for land count, mana-base color balance, curve shape, and card-type mix with computations from this specific deck's actual mana-cost pips and functional role requirements.

**Architecture:** Two new pure-function modules of math (`parsePips`/`estimateLandCount`/`computeColorSourceTargets` in `js/build/manabase.js`; `adjustCurveShares`/`buildRoleTargetPlan` in `js/build/type-plan.js`) feed into a reordered `js/build/deck.js` pick loop where role targets (ramp/draw/removal/wipe/synergy) become the hard constraint and card-type buckets become a soft diversity floor — the inverse of today's priority.

**Tech Stack:** Plain global-scope browser JS (no build step, no npm). This machine has no Node/Deno/Bun — all verification runs through `osascript -l JavaScript` via a small JXA test harness built in Task 1.

**Spec:** `docs/superpowers/specs/2026-09-22-role-first-mana-base-design.md`

## Global Constraints

- No new roles: the role set stays `ramp`, `draw`, `removal`, `wipe`, plus the `synergy` catch-all. `detectRole`/`getRoleContributions` (`js/analysis/scoring.js`) are not modified.
- Land count is a single up-front estimate from the candidate pool — no two-phase pick/reconcile loop.
- `js/api/edhrec.js`'s EDHREC-role-target derivation is unchanged.
- Never touch the mana base's owned-collection-only constraint — this plan never suggests buying cards.
- Every task's verification runs via `tests/jxa/run.sh` (built in Task 1), which concatenates plain script files and executes them with `osascript -l JavaScript` — there is no `npm test`/`pytest` in this project.
- Work happens on a dedicated branch, not `main` — the branch/worktree should already exist per `superpowers:using-git-worktrees` before Task 1 starts.

---

## Task 1: JXA unit-test harness

**Files:**
- Create: `tests/jxa/helpers.js`
- Create: `tests/jxa/run.sh`
- Create: `tests/jxa/smoke.test.js`

**Interfaces:**
- Produces: `jxaPrint(s)`, `assertEqual(actual, expected, message)`, `assertClose(actual, expected, tolerance, message)`, `assertTrue(value, message)`, `runSuite(name, testsObject)` — every later task's test files call these.
- Produces: `tests/jxa/run.sh <sourceFile1> [<sourceFile2> ...] <testFile>` — concatenates the given source files with `helpers.js` in front and the test file behind, then runs `osascript -l JavaScript` on the result.

- [ ] **Step 1: Write `tests/jxa/helpers.js`**

```js
function jxaPrint(s) {
  $.NSFileHandle.fileHandleWithStandardOutput.writeData(
    $.NSString.alloc.initWithUTF8String(s + "\n").dataUsingEncoding($.NSUTF8StringEncoding)
  );
}

function assertEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error((message || "assertEqual failed") + ": expected " + e + " but got " + a);
}

function assertClose(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error((message || "assertClose failed") + ": expected ~" + expected + " (tolerance " + tolerance + ") but got " + actual);
  }
}

function assertTrue(value, message) {
  if (!value) throw new Error(message || "assertTrue failed");
}

function runSuite(name, tests) {
  let passed = 0;
  let failed = 0;
  for (const testName of Object.keys(tests)) {
    try {
      tests[testName]();
      passed += 1;
      jxaPrint("PASS " + name + " > " + testName);
    } catch (err) {
      failed += 1;
      jxaPrint("FAIL " + name + " > " + testName + ": " + err.message);
    }
  }
  jxaPrint(name + ": " + passed + " passed, " + failed + " failed");
  jxaPrint(failed > 0 ? "SUITE FAILED" : "SUITE OK");
}
```

- [ ] **Step 2: Write `tests/jxa/run.sh` and make it executable**

```bash
#!/bin/bash
# Usage: tests/jxa/run.sh <source files...> <test file>
# Concatenates helpers.js + the given source files + the test file, and
# runs the result under osascript, since this machine has no Node/Deno/Bun.
files=("$@")
count=${#files[@]}
test_file="${files[$((count-1))]}"
src_files=("${files[@]:0:$((count-1))}")

tmp=$(mktemp /tmp/jxa-test-XXXXXX.js)
cat tests/jxa/helpers.js "${src_files[@]}" "$test_file" > "$tmp"
osascript -l JavaScript "$tmp"
rm -f "$tmp"
```

Run: `chmod +x tests/jxa/run.sh`

- [ ] **Step 3: Write `tests/jxa/smoke.test.js`**

```js
runSuite("smoke", {
  "true is true": function () {
    assertTrue(true, "should be true");
  },
  "1 plus 1": function () {
    assertEqual(1 + 1, 2);
  },
  "assertClose tolerates small drift": function () {
    assertClose(1.001, 1, 0.01);
  }
});
```

- [ ] **Step 4: Run the smoke test**

Run: `bash tests/jxa/run.sh tests/jxa/smoke.test.js`

Expected output:
```
PASS smoke > true is true
PASS smoke > 1 plus 1
PASS smoke > assertClose tolerates small drift
smoke: 3 passed, 0 failed
SUITE OK
```

- [ ] **Step 5: Commit**

```bash
git add tests/jxa/helpers.js tests/jxa/run.sh tests/jxa/smoke.test.js
git commit -m "Add JXA unit-test harness (no Node on this machine)"
```

---

## Task 2: `parsePips` mana-cost parser

**Files:**
- Modify: `js/build/manabase.js` (add `parsePips`, above `recommendLandCount`)
- Test: `tests/jxa/manabase.test.js` (new file)

**Interfaces:**
- Produces: `parsePips(manaCost)` — takes a Scryfall mana-cost string (e.g. `"{2}{G}{G}"`) and returns `{ W: number, U: number, B: number, R: number, G: number }`, always with all five keys present. Hybrid symbols (`{W/U}`) split 0.5 to each named color; Phyrexian symbols (`{G/P}`) count as a full pip for the named color; `{X}` and generic numbers contribute 0. Used by `estimateLandCount` (Task 3) and `computeColorSourceTargets` (Task 4).

- [ ] **Step 1: Write the failing tests in `tests/jxa/manabase.test.js`**

```js
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
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bash tests/jxa/run.sh js/build/manabase.js tests/jxa/manabase.test.js`
Expected: every test fails with `ReferenceError: Can't find variable: parsePips`.

- [ ] **Step 3: Implement `parsePips` in `js/build/manabase.js`, immediately before `function recommendLandCount(commanderColors) {`**

```js
// Pip counting for the mana-base math below. Generic numbers and {X} are
// deliberately excluded -- they never force a specific color, so they carry
// no color requirement to plan a land base around.
function parsePips(manaCost) {
  const pips = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const symbols = String(manaCost || "").match(/\{[^}]+\}/g) || [];

  for (const symbol of symbols) {
    const inner = symbol.slice(1, -1);
    if (!inner.includes("/")) {
      if (Object.prototype.hasOwnProperty.call(pips, inner)) pips[inner] += 1;
      continue;
    }

    const parts = inner.split("/");
    const isPhyrexian = parts.includes("P");
    const colorParts = parts.filter((part) => Object.prototype.hasOwnProperty.call(pips, part));
    if (colorParts.length === 0) continue;

    if (isPhyrexian) {
      for (const color of colorParts) pips[color] += 1;
    } else {
      for (const color of colorParts) pips[color] += 1 / colorParts.length;
    }
  }

  return pips;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bash tests/jxa/run.sh js/build/manabase.js tests/jxa/manabase.test.js`
Expected: all 6 tests PASS, `SUITE OK`.

- [ ] **Step 5: Commit**

```bash
git add js/build/manabase.js tests/jxa/manabase.test.js
git commit -m "Add parsePips mana-cost parser"
```

---

## Task 3: `estimateLandCount`

**Files:**
- Modify: `js/build/manabase.js` (add `estimateLandCount`, below `parsePips`, above `recommendLandCount`)
- Test: `tests/jxa/manabase.test.js` (append to the existing `manabase` suite)

**Interfaces:**
- Consumes: `parsePips(manaCost)` (Task 2), `recommendLandCount(commanderColors)` (existing, `manabase.js:200-205`).
- Produces: `estimateLandCount(candidatePool, commanderColors, roleTargets)` — `candidatePool` is an array of `{score: number, manaCost: string}` objects, `commanderColors` is an array like `["G","U"]`, `roleTargets` is `{ramp, draw, removal, wipe}`. Returns an integer land count clamped to `[35, 42]`. Consumed by `deck.js` in Task 9.

- [ ] **Step 1: Add the failing tests — append these keys into the existing `tests` object in `tests/jxa/manabase.test.js`, before its closing `});`**

```js
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
  }
```

- [ ] **Step 2: Run to verify it fails**

Run: `bash tests/jxa/run.sh js/build/manabase.js tests/jxa/manabase.test.js`
Expected: the 4 new tests fail with `ReferenceError: Can't find variable: estimateLandCount`; the 6 Task 2 tests still PASS.

- [ ] **Step 3: Implement `estimateLandCount` in `js/build/manabase.js`, below `parsePips`**

```js
// Land count, estimated once before any card is picked. The estimate has to
// come from the candidate pool rather than the deck itself, because the
// nonland slot count (deckSize - landCount) has to exist before picking can
// start -- see the design doc's "Non-goals" for why this stays single-pass.
function estimateLandCount(candidatePool, commanderColors, roleTargets) {
  const sorted = [...candidatePool].sort((a, b) => (b.score || 0) - (a.score || 0));
  const sample = sorted.slice(0, Math.min(160, sorted.length));

  let totalPips = 0;
  for (const card of sample) {
    const pips = parsePips(card.manaCost);
    for (const color of commanderColors) totalPips += pips[color] || 0;
  }
  const pipIntensity = sample.length ? totalPips / sample.length : 0;

  const rampTarget = Number(roleTargets?.ramp) || 10;
  const baseline = recommendLandCount(commanderColors);
  const raw = baseline + Math.round(pipIntensity * 2) - Math.round((rampTarget - 10) / 3);

  return Math.max(35, Math.min(42, raw));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bash tests/jxa/run.sh js/build/manabase.js tests/jxa/manabase.test.js`
Expected: all 10 tests PASS, `SUITE OK`.

- [ ] **Step 5: Commit**

```bash
git add js/build/manabase.js tests/jxa/manabase.test.js
git commit -m "Add estimateLandCount: pip-weighted, ramp-adjusted land count estimate"
```

---

## Task 4: `computeColorSourceTargets`

**Files:**
- Modify: `js/build/manabase.js` (add `computeColorSourceTargets`, below `estimateLandCount`)
- Test: `tests/jxa/manabase.test.js` (append to the existing suite)

**Interfaces:**
- Consumes: `parsePips(manaCost)` (Task 2).
- Produces: `computeColorSourceTargets(nonlandDeckCards, commanderColors, landCount)` — `nonlandDeckCards` is an array of `{manaCost: string}` objects (the deck's actual picked nonland cards, resolved to full card records — see Task 9), `commanderColors` an array like `["B","G"]`. Returns an object keyed by each color in `commanderColors`, values summing to exactly `landCount`. Consumed by `evaluateNonbasicLand`/`buildBasicManaBase` (Task 5) and wired in `deck.js` (Task 9).

- [ ] **Step 1: Add the failing tests — append into the existing `tests` object**

```js
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
    assertTrue(targets.B >= 8, "expected splash floor of at least 8, got " + targets.B);
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
  }
```

- [ ] **Step 2: Run to verify it fails**

Run: `bash tests/jxa/run.sh js/build/manabase.js tests/jxa/manabase.test.js`
Expected: the 4 new tests fail with `ReferenceError: Can't find variable: computeColorSourceTargets`; the 10 earlier tests still PASS.

- [ ] **Step 3: Implement `computeColorSourceTargets` in `js/build/manabase.js`, below `estimateLandCount`**

```js
// Per-color land-source targets, computed from the deck's actual picked
// nonland cards (not an estimate -- by the time this runs, the deck is
// already built). Replaces buildBasicManaBase's old "fewest sources so far"
// identity-only balance with one weighted by real pip counts.
function computeColorSourceTargets(nonlandDeckCards, commanderColors, landCount) {
  const targets = {};
  if (commanderColors.length === 0) return targets;

  const pipTotals = {};
  for (const color of commanderColors) pipTotals[color] = 0;

  for (const card of nonlandDeckCards) {
    const pips = parsePips(card.manaCost);
    for (const color of commanderColors) pipTotals[color] += pips[color] || 0;
  }

  const grandTotal = commanderColors.reduce((sum, color) => sum + pipTotals[color], 0);

  if (grandTotal <= 0) {
    const even = Math.floor(landCount / commanderColors.length);
    let assigned = 0;
    for (const color of commanderColors) {
      targets[color] = even;
      assigned += even;
    }
    let i = 0;
    while (assigned < landCount) {
      targets[commanderColors[i % commanderColors.length]] += 1;
      assigned += 1;
      i += 1;
    }
    return targets;
  }

  // Any color that appears at all is guaranteed enough sources to actually
  // be castable, even if its pip share is small (a one-card splash).
  const splashFloor = Math.max(8, Math.round(0.12 * landCount));
  const floored = {};
  let flooredTotal = 0;
  for (const color of commanderColors) {
    floored[color] = pipTotals[color] > 0 ? splashFloor : 0;
    flooredTotal += floored[color];
  }

  // Enough colors can each demand the splash floor that the floors alone
  // overflow landCount (a 5-color deck at a 35-land count: 5 x 8 = 40 > 35).
  // The fixup loop below only ever reduces a target back down to its own
  // floor, never below it, so if the floors themselves don't fit, nothing
  // after this point could recover -- scale every floor down proportionally
  // right here instead, using a largest-remainder fixup to land on exactly
  // landCount.
  if (flooredTotal > landCount) {
    const scale = landCount / flooredTotal;
    const scaled = {};
    let scaledTotal = 0;
    for (const color of commanderColors) {
      scaled[color] = floored[color] > 0 ? Math.max(1, Math.floor(floored[color] * scale)) : 0;
      scaledTotal += scaled[color];
    }

    const scaledOrder = commanderColors
      .filter((color) => floored[color] > 0)
      .sort((a, b) => pipTotals[b] - pipTotals[a]);
    let j = 0;
    while (scaledTotal < landCount && scaledOrder.length) {
      scaled[scaledOrder[j % scaledOrder.length]] += 1;
      scaledTotal += 1;
      j += 1;
    }
    j = 0;
    while (scaledTotal > landCount && scaledOrder.length) {
      const color = scaledOrder[j % scaledOrder.length];
      if (scaled[color] > 1) {
        scaled[color] -= 1;
        scaledTotal -= 1;
      }
      j += 1;
    }

    return scaled;
  }

  const remaining = Math.max(0, landCount - flooredTotal);
  let assigned = 0;
  for (const color of commanderColors) {
    const share = pipTotals[color] / grandTotal;
    targets[color] = floored[color] + Math.round(share * remaining);
    assigned += targets[color];
  }

  // Rounding fixups so targets always sum to exactly landCount. Adjust the
  // heaviest-pip colors first -- they have the most room above their floor.
  const order = [...commanderColors].sort((a, b) => pipTotals[b] - pipTotals[a]);
  let guard = landCount * 4;
  let i = 0;
  while (assigned > landCount && guard-- > 0) {
    const color = order[i % order.length];
    if (targets[color] > floored[color]) {
      targets[color] -= 1;
      assigned -= 1;
    }
    i += 1;
  }
  i = 0;
  while (assigned < landCount) {
    targets[order[i % order.length]] += 1;
    assigned += 1;
    i += 1;
  }

  return targets;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bash tests/jxa/run.sh js/build/manabase.js tests/jxa/manabase.test.js`
Expected: all 15 tests PASS, `SUITE OK`.

- [ ] **Step 5: Commit**

```bash
git add js/build/manabase.js tests/jxa/manabase.test.js
git commit -m "Add computeColorSourceTargets: pip-weighted per-color land targets"
```

---

## Task 5: Wire color targets into land selection

**Files:**
- Modify: `js/build/manabase.js:207-295` (`evaluateNonbasicLand`), `:297-332` (`buildNonbasicManaBase`), `:334-379` (`buildBasicManaBase`)
- Test: `tests/jxa/manabase.test.js` (append)

**Interfaces:**
- Consumes: `computeColorSourceTargets`'s output shape (Task 4): `{[color]: number}`.
- Produces: `evaluateNonbasicLand(card, commanderColors, strategyProfile, modePrefs, edhrecCardLookup, colorTargets)`, `buildNonbasicManaBase(collectionData, allOwnedCardData, commanderColors, targetLandCount, strategyProfile, modePrefs, edhrecCardLookup, colorTargets)`, `buildBasicManaBase(commanderColors, landCountNeeded, selectedNonbasics, colorTargets)` — all with a new trailing `colorTargets = null` parameter. Passing `null` (or omitting it) reproduces today's exact identity-only behavior, so every existing call site keeps working unchanged until Task 9 threads the real value through.

- [ ] **Step 1: Add the failing test — append into the existing `tests` object**

```js
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
  }
```

- [ ] **Step 2: Run to verify it fails**

Run: `bash tests/jxa/run.sh js/build/manabase.js tests/jxa/manabase.test.js`
Expected: `"colorTargets, tops up..."` FAILs (falls back to the old even-alternation behavior since `colorTargets` isn't read yet, so `gCount > bCount` is false); the "omitted" test PASSes already (it doesn't exercise the new behavior). 13 old tests still PASS.

- [ ] **Step 3: Update `buildBasicManaBase`'s greedy comparator (`manabase.js:334-379`)**

Change the signature line:
```js
function buildBasicManaBase(commanderColors, landCountNeeded, selectedNonbasics = [], colorTargets = null) {
```

Change the two sort comparators (currently `sourceCounts[a] - sourceCounts[b]`) to rank by deficit against target instead of raw count — when `colorTargets` is `null`, `colorTargets?.[a] ?? 0` is `0` for every color, so the comparator reduces to the original behavior exactly:

```js
  const deficit = (color) => sourceCounts[color] - (colorTargets?.[color] ?? 0);
  const lands = [];
  const colorsSorted = [...commanderColors].sort((a, b) => deficit(a) - deficit(b));

  for (let i = 0; i < landCountNeeded; i++) {
    colorsSorted.sort((a, b) => deficit(a) - deficit(b));
    const color = colorsSorted[0];
    sourceCounts[color] += 1;
```

(Leave the rest of the function, including the `commanderColors.length === 0` early return and the pushed land objects, unchanged.)

- [ ] **Step 4: Update `evaluateNonbasicLand` (`manabase.js:207-295`) to weight reliable/conditional sources by target share**

Change the signature line:
```js
function evaluateNonbasicLand(card, commanderColors, strategyProfile, modePrefs, edhrecCardLookup = null, colorTargets = null) {
```

Replace the two lines
```js
  score += reliableSources * 6;
  score += relevantConditional.length * 1.5;
```
with:
```js
  const totalColorTargets = commanderColors.reduce((sum, color) => sum + (colorTargets?.[color] || 0), 0);
  const avgColorTarget = totalColorTargets > 0 ? totalColorTargets / commanderColors.length : 1;
  const targetWeight = (color) => (colorTargets ? (colorTargets[color] || 0) / avgColorTarget : 1);

  // A flexible source (relevantReliable didn't already cover it) is weighted
  // like the rest of the deck's colors on average, since it isn't tied to one.
  score += relevantReliable.reduce((sum, color) => sum + 6 * targetWeight(color), 0) + flexibleSources * 6;
  score += relevantConditional.reduce((sum, color) => sum + 1.5 * targetWeight(color), 0);
```

- [ ] **Step 5: Thread `colorTargets` through `buildNonbasicManaBase` (`manabase.js:297-332`)**

Change the signature line:
```js
function buildNonbasicManaBase(collectionData, allOwnedCardData, commanderColors, targetLandCount, strategyProfile, modePrefs, edhrecCardLookup = null, colorTargets = null) {
```

Change the one call site inside it:
```js
    const landCandidate = evaluateNonbasicLand(card, commanderColors, strategyProfile, modePrefs, edhrecCardLookup, colorTargets);
```

- [ ] **Step 6: Run to verify it passes**

Run: `bash tests/jxa/run.sh js/build/manabase.js tests/jxa/manabase.test.js`
Expected: all 16 tests PASS, `SUITE OK`.

- [ ] **Step 7: Commit**

```bash
git add js/build/manabase.js tests/jxa/manabase.test.js
git commit -m "Weight land selection by pip-based color targets instead of identity only"
```

---

## Task 6: `adjustCurveShares`

**Files:**
- Modify: `js/build/type-plan.js:153-164` (above `buildCurvePlan`)
- Test: `tests/jxa/type-plan.test.js` (new file)

**Interfaces:**
- Consumes: `DEFAULT_CURVE_SHARES` (existing, `type-plan.js:156`).
- Produces: `adjustCurveShares(shares, roleTargets, strategyProfile)` — returns a new shares object (same `{1..7}` keys as `DEFAULT_CURVE_SHARES`, values still summing to 1). Consumed by `deck.js` (Task 9), which will call `buildCurvePlan(targetNonlandCount, adjustCurveShares(DEFAULT_CURVE_SHARES, roleTargets, strategyProfile))`.

- [ ] **Step 1: Write the failing tests in `tests/jxa/type-plan.test.js`**

```js
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
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bash tests/jxa/run.sh js/build/type-plan.js tests/jxa/type-plan.test.js`
Expected: all 5 tests fail with `ReferenceError: Can't find variable: adjustCurveShares`.

- [ ] **Step 3: Implement `adjustCurveShares` in `js/build/type-plan.js`, immediately above `function buildCurvePlan(...)`**

```js
// Curve shares, nudged by how ramp-heavy the plan is and whether the
// strategy wants a low, wide curve. Bounded (+/-0.02 to +/-0.05 of total
// share) so this stays a nudge, not a new curve model.
function adjustCurveShares(shares, roleTargets, strategyProfile) {
  const rampTarget = Number(roleTargets?.ramp) || 10;
  const rampShift = Math.max(-0.02, Math.min(0.05, (rampTarget - 10) * 0.01));
  const lowCurveFlag = Boolean(
    strategyProfile?.wantsGoWide || strategyProfile?.wantsTribal || strategyProfile?.wantsCantrips
  );
  const curveShift = rampShift - (lowCurveFlag ? 0.02 : 0);

  const lowBands = ["1", "2"];
  const highBands = ["5", "6", "7"];
  const adjusted = { ...shares };

  if (curveShift === 0) return adjusted;

  // Positive curveShift: move weight from low bands into high bands.
  // Negative: the reverse. Each side's shift is split proportionally to its
  // members' existing share of that side's total.
  const fromBands = curveShift > 0 ? lowBands : highBands;
  const toBands = curveShift > 0 ? highBands : lowBands;
  const magnitude = Math.abs(curveShift);

  const fromTotal = fromBands.reduce((sum, band) => sum + shares[band], 0);
  const toTotal = toBands.reduce((sum, band) => sum + shares[band], 0);

  for (const band of fromBands) {
    const share = fromTotal > 0 ? shares[band] / fromTotal : 1 / fromBands.length;
    adjusted[band] = Math.max(0, shares[band] - magnitude * share);
  }
  for (const band of toBands) {
    const share = toTotal > 0 ? shares[band] / toTotal : 1 / toBands.length;
    adjusted[band] = shares[band] + magnitude * share;
  }

  return adjusted;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bash tests/jxa/run.sh js/build/type-plan.js tests/jxa/type-plan.test.js`
Expected: all 5 tests PASS, `SUITE OK`.

- [ ] **Step 5: Commit**

```bash
git add js/build/type-plan.js tests/jxa/type-plan.test.js
git commit -m "Add adjustCurveShares: shift curve by ramp density and strategy"
```

---

## Task 7: `buildRoleTargetPlan`

**Files:**
- Modify: `js/build/type-plan.js:1-134` (replace `buildTypeTargetPlan` and delete the unused `canAddCardForTypePlan`)
- Test: `tests/jxa/type-plan.test.js` (append)

**Interfaces:**
- Consumes: nothing new — same inputs `buildTypeTargetPlan` took (`edhrecTypeAverages`, `strategyProfile`, `targetLandCount`, `commanderThemes`, `deckSize`, `modePrefs`), plus a new `roleTargets` argument.
- Produces: `buildRoleTargetPlan(edhrecTypeAverages, strategyProfile, targetLandCount, roleTargets, commanderThemes = [], deckSize = 99, modePrefs = {})` returning:
  ```
  {
    landCount: number,
    nonlandCount: number,
    roleBuckets: { ramp: {target,min,max}, draw: {...}, removal: {...}, wipe: {...}, synergy: {...} },
    typeBuckets: { Creature: {target,min}, Instant: {...}, Sorcery: {...}, Artifact: {...}, Enchantment: {...}, Planeswalker: {...} }
  }
  ```
  `typeBuckets` entries have no `max` — they're a soft floor now, not a hard cap. Consumed by `deck.js` (Task 9) and by Task 8's scoring/need-check updates.

- [ ] **Step 1: Add the failing tests — append into the existing `tests` object in `tests/jxa/type-plan.test.js`**

```js
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
  "buildRoleTargetPlan: Creature keeps its floor of 8": function () {
    const plan = buildRoleTargetPlan(null, { wantsCreatures: false }, 37, { ramp: 10, draw: 10, removal: 8, wipe: 3 }, [], 99, {});
    assertTrue(plan.typeBuckets.Creature.min >= 8, "expected Creature min >= 8, got " + plan.typeBuckets.Creature.min);
  },
  "buildRoleTargetPlan: landCount and nonlandCount still sum to deckSize": function () {
    const plan = buildRoleTargetPlan(null, { wantsCreatures: true }, 37, { ramp: 10, draw: 10, removal: 8, wipe: 3 }, [], 99, {});
    assertEqual(plan.landCount + plan.nonlandCount, 99);
  }
```

- [ ] **Step 2: Run to verify it fails**

Run: `bash tests/jxa/run.sh js/build/type-plan.js tests/jxa/type-plan.test.js`
Expected: the 5 new tests fail with `ReferenceError: Can't find variable: buildRoleTargetPlan`; the 5 Task 6 tests still PASS.

- [ ] **Step 3: Replace `buildTypeTargetPlan` (`type-plan.js:12-134`) with `buildRoleTargetPlan`, and delete `canAddCardForTypePlan` (`type-plan.js:184-192`, marked "No current caller")**

The type-bucket scaling math (theme-signal widening, EDHREC-average-or-defaults, scale-to-sum, rebalancing) is unchanged from today's `buildTypeTargetPlan` — only its output shape changes (drop `max`, keep `target`/`min`) and it's now a piece of a larger function that also builds role buckets:

```js
// deckSize is the number of cards besides the commanders: 99 for a single
// commander, 98 when a partner or Background takes the second slot.
//
// Role targets (ramp/draw/removal/wipe, plus a synergy catch-all) are now the
// hard constraint the deck is built against; type buckets (Creature/Instant/
// etc.) are a soft diversity floor layered on top, not a competing quota. See
// the design doc for why this flips today's priority.
function buildRoleTargetPlan(edhrecTypeAverages, strategyProfile, targetLandCount, roleTargets, commanderThemes = [], deckSize = 99, modePrefs = {}) {
  const themeSignals = buildThemeSignalSet(commanderThemes);
  // EDHREC's raw average needs the 38-42 floor/ceiling correction (it runs
  // land-light in practice, see manabase.js's estimateLandCount comment) --
  // but targetLandCount, when EDHREC had no average to give, already IS the
  // corrected number (estimateLandCount clamps to [35, 42] itself). Re-clamping
  // it here to a 38 floor would silently overrule Task 3's whole point: a
  // pip-light, ramp-heavy deck is allowed to run as few as 35 lands.
  const requestedLandCount = Number(edhrecTypeAverages?.Land)
    ? Math.max(38, Math.min(42, Math.round(Number(edhrecTypeAverages.Land))))
    : Math.round(targetLandCount);
  const targetNonlandCount = deckSize - requestedLandCount;

  const wantsVoltron = themeSignals.has("voltron") || modePrefs?.focusedThemeSignal === "voltron";

  const defaults = {
    Creature: strategyProfile.wantsCreatures
      ? (strategyProfile.wantsTribal || strategyProfile.wantsGoWide ? 26 : 20)
      : 15,
    Instant: strategyProfile.wantsCantrips ? 10 : 7,
    Sorcery: strategyProfile.wantsCantrips ? 11 : 8,
    Artifact: themeSignals?.has?.("artifacts") || modePrefs?.focusedThemeSignal === "artifacts" || wantsVoltron ? 11 : 7,
    Enchantment: themeSignals?.has?.("enchantments") || modePrefs?.focusedThemeSignal === "enchantments" || wantsVoltron ? 10 : 5,
    Planeswalker: 1
  };

  const typeKeys = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker"];
  const raw = Object.fromEntries(
    typeKeys.map((bucket) => {
      const value = Number(edhrecTypeAverages?.[bucket]);
      return [bucket, Number.isFinite(value) && value >= 0 ? value : defaults[bucket]];
    })
  );

  let totalRaw = typeKeys.reduce((sum, bucket) => sum + (raw[bucket] || 0), 0);
  if (totalRaw <= 0) totalRaw = typeKeys.reduce((sum, bucket) => sum + defaults[bucket], 0);

  // Scaled purely to inform the soft target/min below -- type buckets no
  // longer have to sum to targetNonlandCount, since role buckets do that job.
  const typeBuckets = {};
  for (const bucket of typeKeys) {
    const exact = ((raw[bucket] || defaults[bucket]) / totalRaw) * targetNonlandCount;
    const target = Math.max(bucket === "Planeswalker" ? 0 : 1, Math.round(exact));
    const minimumFloor = bucket === "Creature" ? 8 : bucket === "Planeswalker" ? 0 : 1;
    typeBuckets[bucket] = { target: Math.max(target, minimumFloor), min: minimumFloor };
  }

  const roleKeys = ["ramp", "draw", "removal", "wipe"];
  const roleBuckets = {};
  let roleTotal = 0;
  for (const role of roleKeys) {
    const target = Math.max(0, Math.round(Number(roleTargets?.[role]) || 0));
    roleBuckets[role] = { target, min: Math.max(0, target - 2), max: target + 2 };
    roleTotal += target;
  }

  const synergyTarget = Math.max(0, targetNonlandCount - roleTotal);
  roleBuckets.synergy = {
    target: synergyTarget,
    min: Math.max(0, synergyTarget - 3),
    max: synergyTarget + 3
  };

  // Rounding fixup: if role targets (unusual EDHREC data) overshoot
  // targetNonlandCount, trim synergy first since it's the most elastic
  // bucket, down to its own floor of 0.
  let assignedTotal = roleTotal + roleBuckets.synergy.target;
  if (assignedTotal > targetNonlandCount) {
    const overflow = assignedTotal - targetNonlandCount;
    const trim = Math.min(overflow, roleBuckets.synergy.target);
    roleBuckets.synergy.target -= trim;
    roleBuckets.synergy.min = Math.max(0, roleBuckets.synergy.target - 3);
    roleBuckets.synergy.max = roleBuckets.synergy.target + 3;
  }

  return {
    landCount: requestedLandCount,
    nonlandCount: targetNonlandCount,
    roleBuckets,
    typeBuckets
  };
}
```

Delete the old `canAddCardForTypePlan` function (`type-plan.js:184-192` in the original file) — it had no caller before this change and has none after.

- [ ] **Step 4: Run to verify it passes**

Run: `bash tests/jxa/run.sh js/build/type-plan.js tests/jxa/type-plan.test.js`
Expected: all 10 tests PASS, `SUITE OK`.

- [ ] **Step 5: Commit**

```bash
git add js/build/type-plan.js tests/jxa/type-plan.test.js
git commit -m "Replace buildTypeTargetPlan with buildRoleTargetPlan (role-first)"
```

---

## Task 8: Update scoring and type-minimum helpers for the new plan shape

**Files:**
- Modify: `js/build/type-plan.js` (`getRoleCounts`, `chooseBestFlexibleCard`, `getCardsNeededForTypeMinimums`, `getTypePlanBucketNeed`)
- Test: `tests/jxa/type-plan.test.js` (append)

**Interfaces:**
- Consumes: `buildRoleTargetPlan`'s output shape (Task 7): `{roleBuckets, typeBuckets}`.
- Produces: `getRoleCounts(deck)` now returns a `synergy` key alongside `ramp`/`draw`/`removal`/`wipe`. `chooseBestFlexibleCard(pool, deck, plan, usedNames, excludedKeys)` — `plan` is now the full `{roleBuckets, typeBuckets}` object (was `typePlan` alone before); role deficit is now the dominant scoring term, type deficit a minor one. `getCardsNeededForTypeMinimums(deck, typeBuckets)` and `getTypePlanBucketNeed(deck, typeBuckets, bucket)` now take the `typeBuckets` sub-object directly (not a wrapper with `.buckets`). Consumed by `deck.js` (Task 9).

- [ ] **Step 1: Add the failing tests — append into the existing `tests` object**

```js
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
  "getTypePlanBucketNeed: gap between current count and target": function () {
    const typeBuckets = { Creature: { target: 20, min: 8 } };
    const deck = [{ type: "Creature" }, { type: "Creature" }];
    assertEqual(getTypePlanBucketNeed(deck, typeBuckets, "Creature"), 18);
  }
```

- [ ] **Step 2: Run to verify it fails**

Run: `bash tests/jxa/run.sh js/build/type-plan.js tests/jxa/type-plan.test.js`
Expected: the 5 new tests fail — `getRoleCounts` doesn't have a `synergy` key yet (its test fails on `assertEqual(counts.synergy, 2)`, reading `undefined`); `chooseBestFlexibleCard` still reads `plan.buckets` which is `undefined`, so `rule` is always falsy and it falls back to pure score (both of its tests fail); `getCardsNeededForTypeMinimums`/`getTypePlanBucketNeed` similarly read `typePlan?.buckets || typePlan` — passing `typeBuckets` directly happens to still work for these two by the `|| typePlan` fallback, so those two may already pass. Confirm by reading actual output, and fix `getRoleCounts`/`chooseBestFlexibleCard` regardless since those are guaranteed to fail.

- [ ] **Step 3: Add a `synergy` tally to `getRoleCounts`**

Without this, `chooseBestFlexibleCard`'s synergy-deficit calculation (Step 5 below) would read `roleCounts.synergy` as `undefined` forever, no matter how many synergy cards are already in the deck — the deficit would never shrink and synergy cards would keep outscoring everything else indefinitely. Change:
```js
function getRoleCounts(deck) {
  return {
    ramp: deck.filter((card) => card.role === "ramp").length,
    draw: deck.filter((card) => card.role === "draw").length,
    removal: deck.filter((card) => card.role === "removal").length,
    wipe: deck.filter((card) => card.role === "wipe").length
  };
}
```
to:
```js
function getRoleCounts(deck) {
  return {
    ramp: deck.filter((card) => card.role === "ramp").length,
    draw: deck.filter((card) => card.role === "draw").length,
    removal: deck.filter((card) => card.role === "removal").length,
    wipe: deck.filter((card) => card.role === "wipe").length,
    synergy: deck.filter((card) => card.role === "synergy").length
  };
}
```

- [ ] **Step 4: Update `getCardsNeededForTypeMinimums` and `getTypePlanBucketNeed`**

Replace:
```js
function getCardsNeededForTypeMinimums(deck, typePlan) {
  const planBuckets = typePlan?.buckets || typePlan || {};
  const counts = countByType(deck);
  const needed = [];
  for (const [bucket, rule] of Object.entries(planBuckets)) {
    const deficit = Math.max(0, (rule?.min || 0) - (counts[bucket] || 0));
    for (let i = 0; i < deficit; i++) needed.push(bucket);
  }
  return needed;
}

function getTypePlanBucketNeed(deck, typePlan, bucket) {
  const planBuckets = typePlan?.buckets || typePlan || {};
  const counts = countByType(deck);
  const rule = planBuckets[bucket];
  if (!rule) return 0;
  return Math.max(0, (rule.target || 0) - (counts[bucket] || 0));
}
```
with:
```js
function getCardsNeededForTypeMinimums(deck, typeBuckets) {
  const counts = countByType(deck);
  const needed = [];
  for (const [bucket, rule] of Object.entries(typeBuckets || {})) {
    const deficit = Math.max(0, (rule?.min || 0) - (counts[bucket] || 0));
    for (let i = 0; i < deficit; i++) needed.push(bucket);
  }
  return needed;
}

function getTypePlanBucketNeed(deck, typeBuckets, bucket) {
  const counts = countByType(deck);
  const rule = (typeBuckets || {})[bucket];
  if (!rule) return 0;
  return Math.max(0, (rule.target || 0) - (counts[bucket] || 0));
}
```

- [ ] **Step 5: Update `chooseBestFlexibleCard` to take the combined plan and swap scoring weights**

Replace the whole function:
```js
function chooseBestFlexibleCard(pool, deck, typePlan, roleTargets, usedNames, excludedKeys) {
  const counts = countByType(deck);
  const roleCounts = getRoleCounts(deck);
  const planBuckets = typePlan?.buckets || typePlan || {};

  let best = null;
  let bestScore = -Infinity;

  for (const card of pool) {
    const key = normalizeCardName(card.name);
    if (usedNames.has(key) || excludedKeys.has(key)) continue;

    const bucket = getDeckTypeBucket(card.type || card.type_line || "");
    const rule = planBuckets[bucket];
    const bucketCount = counts[bucket] || 0;
    if (rule && bucketCount >= rule.max + 2) continue;

    let adjustedScore = Number(card.score || 0);

    if (rule) {
      const target = Number(rule.target || 0);
      const deficit = Math.max(0, target - bucketCount);
      const overflow = Math.max(0, bucketCount - target);
      adjustedScore += deficit * 30;
      adjustedScore -= overflow * 18;
      if (bucketCount < (rule.min || 0)) adjustedScore += 35;
      if (bucketCount >= (rule.max || 999)) adjustedScore -= 28;
    }

    if (roleTargets && roleTargets[card.role]) {
      const roleDeficit = Math.max(0, Number(roleTargets[card.role]) - Number(roleCounts[card.role] || 0));
      adjustedScore += roleDeficit * 12;
    }

    if (bucket === "Creature") adjustedScore += 4;

    if (adjustedScore > bestScore) {
      best = card;
      bestScore = adjustedScore;
    }
  }

  return best;
}
```
with:
```js
function chooseBestFlexibleCard(pool, deck, plan, usedNames, excludedKeys) {
  const typeCounts = countByType(deck);
  const roleCounts = getRoleCounts(deck);
  const roleBuckets = plan?.roleBuckets || {};
  const typeBuckets = plan?.typeBuckets || {};

  let best = null;
  let bestScore = -Infinity;

  for (const card of pool) {
    const key = normalizeCardName(card.name);
    if (usedNames.has(key) || excludedKeys.has(key)) continue;

    const roleRule = roleBuckets[card.role];
    const roleCount = roleCounts[card.role] || 0;
    if (roleRule && roleCount >= roleRule.max + 2) continue;

    let adjustedScore = Number(card.score || 0);

    // Role deficit is the dominant term now -- this is the hard constraint.
    if (roleRule) {
      const target = Number(roleRule.target || 0);
      const deficit = Math.max(0, target - roleCount);
      const overflow = Math.max(0, roleCount - target);
      adjustedScore += deficit * 30;
      adjustedScore -= overflow * 18;
      if (roleCount < (roleRule.min || 0)) adjustedScore += 35;
      if (roleCount >= (roleRule.max || 999)) adjustedScore -= 28;
    }

    // Type deficit is a minor tiebreaker -- soft diversity, not a gate.
    const bucket = getDeckTypeBucket(card.type || card.type_line || "");
    const typeRule = typeBuckets[bucket];
    if (typeRule) {
      const typeDeficit = Math.max(0, Number(typeRule.target || 0) - (typeCounts[bucket] || 0));
      adjustedScore += typeDeficit * 8;
    }

    if (bucket === "Creature") adjustedScore += 4;

    if (adjustedScore > bestScore) {
      best = card;
      bestScore = adjustedScore;
    }
  }

  return best;
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `bash tests/jxa/run.sh js/build/type-plan.js tests/jxa/type-plan.test.js`
Expected: all 15 tests PASS, `SUITE OK`.

- [ ] **Step 7: Commit**

```bash
git add js/build/type-plan.js tests/jxa/type-plan.test.js
git commit -m "Flip chooseBestFlexibleCard scoring: role deficit dominant, type deficit minor; fix getRoleCounts synergy tally"
```

---

## Task 9: Wire it all together in `deck.js`

This is the integration task: it reorders setup, restructures the pick-loop phases, and connects the land build to the new color-target math. It cannot be split further without leaving the file in a non-building intermediate state.

**Files:**
- Modify: `js/build/deck.js`

**Interfaces:**
- Consumes: `estimateLandCount` (Task 3), `computeColorSourceTargets` (Task 4), the updated `buildNonbasicManaBase`/`buildBasicManaBase` signatures (Task 5), `adjustCurveShares` (Task 6), `buildRoleTargetPlan` (Task 7), the updated `chooseBestFlexibleCard`/`getCardsNeededForTypeMinimums`/`getTypePlanBucketNeed` (Task 8).
- Produces: `buildDeckFromScoredPool(...)` keeps its existing external signature and return shape — this task changes internals only, so nothing outside `deck.js` needs to change.

- [ ] **Step 1: Move candidate-pool construction ahead of the land/role plan setup**

Today, `deck.js` computes `typePlan`/`curvePlan` (today's lines ~201-211) *before* building `themeFallbackPool`/`genericFallbackPool` (today's lines ~213-256). `estimateLandCount` needs the pools, so cut the block:

```js
  const recommendedLandCount = recommendLandCount(commanderColors);
  const typePlan = buildTypeTargetPlan(edhrecTypeAverages, strategyProfile, recommendedLandCount, commanderThemes, deckSize, modePrefs);
  const targetLandCount = typePlan.landCount;
  const targetNonlandCount = typePlan.nonlandCount;
  const edhrecCardLookup = new Map(
    (Array.isArray(edhrecCards) ? edhrecCards : []).map((entry) => [normalizeCardName(entry.name), entry])
  );

  const roleTargets = normalizeRoleTargets(edhrecRoleTargets);

  const curvePlan = buildCurvePlan(targetNonlandCount);
```

and move only the pieces that don't depend on the pools — `edhrecCardLookup` and `roleTargets` — ahead of pool construction; the rest is rebuilt after the pools exist (Step 2).

- [ ] **Step 2: Build the pools, then the plan, then the curve — in that order**

Immediately after the (now-earlier) `edhrecCardLookup`/`roleTargets` lines, keep the existing pool-building loop (`themeFallbackPool`/`genericFallbackPool`, unchanged internals) verbatim. Immediately after that loop, and after the existing `scoredNonlands.sort(...)` / `fallbackTiers.map(...).sort(...)` lines, add:

```js
  const recommendedLandCount = recommendLandCount(commanderColors);
  const combinedPool = [...themeFallbackPool, ...genericFallbackPool];
  const targetLandCount = edhrecTypeAverages?.Land
    ? Math.max(38, Math.min(42, Math.round(Number(edhrecTypeAverages.Land))))
    : estimateLandCount(combinedPool, commanderColors, roleTargets) || recommendedLandCount;
  const targetNonlandCount = deckSize - targetLandCount;

  const plan = buildRoleTargetPlan(edhrecTypeAverages, strategyProfile, targetLandCount, roleTargets, commanderThemes, deckSize, modePrefs);
  const typePlan = { landCount: plan.landCount, nonlandCount: plan.nonlandCount, buckets: plan.typeBuckets };

  const curvePlan = buildCurvePlan(targetNonlandCount, adjustCurveShares(DEFAULT_CURVE_SHARES, roleTargets, strategyProfile));
```

`typePlan` is kept as a thin compatibility view (`{buckets: plan.typeBuckets}`) so Phase 1/Phase 4's existing `typePlan?.buckets?.[bucket]` reads (Step 4 below) don't need touching — only the *hard-gate* uses of it are being removed, not every read.

Note the land count now prefers `edhrecTypeAverages.Land` when EDHREC actually reported one (matching today's trusted-when-present behavior), and only falls back to the new pip-based estimate when it didn't — this preserves the existing clamp behavior for the common case where EDHREC has data, and only changes behavior for the case the design doc identified as unreliable (no EDHREC average to lean on).

- [ ] **Step 3: Add `manaCost` to the candidate object literal**

In the pool-building loop, the candidate object literal (today's lines ~238-252) reads:
```js
    const candidate = {
      name: card.name,
      role: detectRole(card),
      score: scoreFallbackCard(card, commanderThemes, strategyProfile, commanderColors, modePrefs)
        + modeFitAdjustment
        + getThemeFitBonus(themeMatch),
      type: getCardType(card),
      cmc: card.cmc,
      colors: card.colors,
      modeFitTier: fit.tier,
      themeMatch,
      redundancyKeys: getCardRedundancyKeys(card, planTraits),
      roles: getRoleContributions(card)
    };
```
Add one field:
```js
    const candidate = {
      name: card.name,
      role: detectRole(card),
      manaCost: card.manaCost,
      score: scoreFallbackCard(card, commanderThemes, strategyProfile, commanderColors, modePrefs)
        + modeFitAdjustment
        + getThemeFitBonus(themeMatch),
      type: getCardType(card),
      cmc: card.cmc,
      colors: card.colors,
      modeFitTier: fit.tier,
      themeMatch,
      redundancyKeys: getCardRedundancyKeys(card, planTraits),
      roles: getRoleContributions(card)
    };
```
This is what `estimateLandCount`'s sample in Step 2 reads.

- [ ] **Step 4: Restructure the pick loop — role-primary first, type-diversity floor second**

Today's phases, in order, are: Phase 0 (type mix via `pickBestCardForBucket`), Phase 1 (role fill gated by `bucketHasRoomForRole`), Phase 2 (type minimums), Phase 3 (flexible fill), Phase 3.5 (role eviction), Phase 4 (creature backfill). Reorder so role fill runs first and drop its type-room hard gate:

Delete the current Phase 0 block entirely (the `for (const bucket of buckets) { ... pickBestCardForBucket ... }` loop that today runs first).

Change `bucketHasRoomForRole` from a hard gate into nothing — delete the function and its one call site inside `pickBestForRole`:
```js
  function pickBestForRole(pool, role, chargeRedundancy) {
    let best = null;
    let bestScore = -Infinity;

    for (const card of pool) {
      const key = normalizeCardName(card.name);
      if (usedNames.has(key) || commanderKeys.has(key)) continue;

      const roles = card.roles || getRoleContributions(getRedundancySource(card) || card);
      if (!roles.includes(role)) continue;
      if (!bucketHasRoomForRole(getDeckTypeBucket(card.type || card.type_line || ""))) continue;

      let adjusted = Number(card.score || 0);
      if (chargeRedundancy) adjusted -= getRedundancyPenalty(card.redundancyKeys, redundancyCounts);
      if (!curveHasRoom(curvePlan, card.cmc)) adjusted -= 8;

      if (adjusted > bestScore) {
        best = card;
        bestScore = adjusted;
      }
    }

    return best;
  }
```
becomes (drop the hard gate, add a soft penalty when the card's type is already over its soft target):
```js
  function pickBestForRole(pool, role, chargeRedundancy) {
    let best = null;
    let bestScore = -Infinity;
    const typeCounts = countByType(deck);

    for (const card of pool) {
      const key = normalizeCardName(card.name);
      if (usedNames.has(key) || commanderKeys.has(key)) continue;

      const roles = card.roles || getRoleContributions(getRedundancySource(card) || card);
      if (!roles.includes(role)) continue;

      let adjusted = Number(card.score || 0);
      if (chargeRedundancy) adjusted -= getRedundancyPenalty(card.redundancyKeys, redundancyCounts);
      if (!curveHasRoom(curvePlan, card.cmc)) adjusted -= 8;

      const bucket = getDeckTypeBucket(card.type || card.type_line || "");
      const typeRule = typePlan?.buckets?.[bucket];
      if (typeRule && (typeCounts[bucket] || 0) > Number(typeRule.target || 0)) adjusted -= 6;

      if (adjusted > bestScore) {
        best = card;
        bestScore = adjusted;
      }
    }

    return best;
  }
```

Leave `supportRoles` exactly as `["ramp", "draw", "removal", "wipe"]` — do NOT add `"synergy"` to it. `pickBestForRole` matches via `roles.includes(role)` against `getRoleContributions(...)`'s plural output, which only ever contains `ramp`/`draw`/`removal`/`wipe` (a card with none of those returns `[]`, never `["synergy"]`) — so a `"synergy"` entry in `supportRoles` could never be found by this lookup and would just self-exhaust on its first attempt every build, for no benefit. Synergy's target is enforced differently: entirely through Phase 2's `chooseBestFlexibleCard` scoring (Task 8), which reads the singular `card.role` field (where `"synergy"` is a real, matchable value from `detectRole`'s fallthrough) rather than the plural `.roles` list. `getDeckRoleCounts` (below) also needs no change for this reason — nothing reads a `.synergy` key from it.

Change the gap-finding loop's target lookup from flat `roleTargets` to `plan.roleBuckets`:
```js
  while (deck.length < targetNonlandCount) {
    const counts = getDeckRoleCounts();

    let neediestRole = null;
    let largestGap = 0;
    for (const role of supportRoles) {
      if (exhaustedRoles.has(role)) continue;
      const gap = roleTargets[role] - counts[role];
      if (gap > largestGap) {
        neediestRole = role;
        largestGap = gap;
      }
    }
    if (!neediestRole) break;
```
becomes:
```js
  while (deck.length < targetNonlandCount) {
    const counts = getDeckRoleCounts();

    let neediestRole = null;
    let largestGap = 0;
    for (const role of supportRoles) {
      if (exhaustedRoles.has(role)) continue;
      const gap = (plan.roleBuckets[role]?.target || 0) - counts[role];
      if (gap > largestGap) {
        neediestRole = role;
        largestGap = gap;
      }
    }
    if (!neediestRole) break;
```

This role-fill loop (now unindented/renumbered as **Phase 0**) runs immediately after the pool-building/plan setup and before what were Phases 2-4 (renumber their comments to Phase 1/2/3). Phase 3.5/4 (eviction, creature backfill) need no change beyond Step 6 below — they already read `typePlan?.buckets?.[bucket]?.min`/`typePlan?.buckets?.Creature` for protection, drilling into `.buckets` explicitly, which is untouched.

Phase 2 ("type minimums") is the one real exception: Task 8 changed `getCardsNeededForTypeMinimums` to take the `typeBuckets` sub-object directly (no more internal `.buckets` unwrapping), but its call site still passes the whole wrapper. Left alone, `Object.entries(typePlan)` would iterate `landCount`/`nonlandCount`/`buckets` as if they were type buckets — no crash, just silently wrong (every "bucket" has `rule?.min` of `undefined`, so the loop never finds a real deficit). Change:
```js
  for (const neededBucket of getCardsNeededForTypeMinimums(deck, typePlan)) {
```
to:
```js
  for (const neededBucket of getCardsNeededForTypeMinimums(deck, typePlan.buckets)) {
```

- [ ] **Step 5: Update the Phase 3 (flexible fill) call site for the new `chooseBestFlexibleCard` signature**

Change:
```js
  const flexibleTiers = fallbackTiers.map((tier) => [...scoredNonlands, ...tier]);
  while (deck.length < targetNonlandCount) {
    const best = pickFromTiers(flexibleTiers, (tier) =>
      chooseBestFlexibleCard(tier, deck, typePlan, roleTargets, usedNames, commanderKeys));
    if (!best) break;

    addCard(best, scoredNonlands.includes(best) ? "edhrec" : getFallbackSource(best));
  }
```
to:
```js
  const flexibleTiers = fallbackTiers.map((tier) => [...scoredNonlands, ...tier]);
  while (deck.length < targetNonlandCount) {
    const best = pickFromTiers(flexibleTiers, (tier) =>
      chooseBestFlexibleCard(tier, deck, plan, usedNames, commanderKeys));
    if (!best) break;

    addCard(best, scoredNonlands.includes(best) ? "edhrec" : getFallbackSource(best));
  }
```

- [ ] **Step 6: Update the role-eviction phase to read `plan.roleBuckets` instead of flat `roleTargets`**

Change:
```js
  for (const role of supportRoles) {
    let guard = Number(roleTargets[role] || 0) * 2;
    while (getDeckRoleCounts()[role] < Number(roleTargets[role] || 0) && guard-- > 0) {
```
to:
```js
  for (const role of supportRoles) {
    let guard = Number(plan.roleBuckets[role]?.target || 0) * 2;
    while (getDeckRoleCounts()[role] < Number(plan.roleBuckets[role]?.target || 0) && guard-- > 0) {
```
(the rest of that block, including the "don't rob a role still needed" check that reads `roleTargets[r]`, needs the same swap — change `Number(roleTargets[r] || 0)` to `Number(plan.roleBuckets[r]?.target || 0)` in the `stillNeeded` line.)

- [ ] **Step 7: Compute real color source targets from the finished deck before land selection**

Change:
```js
  const selectedNonbasicLands = buildNonbasicManaBase(
    collectionData,
    allOwnedCardData,
    commanderColors,
    targetLandCount,
    strategyProfile,
    modePrefs,
    edhrecCardLookup
  );

  let remainingLandCount = targetLandCount - selectedNonbasicLands.length;
  if (remainingLandCount < 0) remainingLandCount = 0;

  const basicLands = buildBasicManaBase(
    commanderColors,
    remainingLandCount,
    selectedNonbasicLands
  );
```
to:
```js
  // Resolve every deck entry back to its full record (candidates only carry
  // name/type/cmc/score/etc, same reason getRedundancySource exists above)
  // so pip-counting sees real manaCost strings, not undefined.
  const resolvedNonlandCards = deck.map((card) => getRedundancySource(card) || card);
  const colorTargets = computeColorSourceTargets(resolvedNonlandCards, commanderColors, targetLandCount);

  const selectedNonbasicLands = buildNonbasicManaBase(
    collectionData,
    allOwnedCardData,
    commanderColors,
    targetLandCount,
    strategyProfile,
    modePrefs,
    edhrecCardLookup,
    colorTargets
  );

  let remainingLandCount = targetLandCount - selectedNonbasicLands.length;
  if (remainingLandCount < 0) remainingLandCount = 0;

  const basicLands = buildBasicManaBase(
    commanderColors,
    remainingLandCount,
    selectedNonbasicLands,
    colorTargets
  );
```

- [ ] **Step 8: Manually verify the file still loads under the JXA harness**

Run:
```bash
osascript -l JavaScript -e "
$(cat js/constants.js js/utils/text.js js/utils/cards.js js/analysis/pairing.js js/collection/csv.js js/analysis/themes.js js/analysis/scoring.js js/api/http.js js/api/edhrec.js js/cache.js js/api/scryfall.js js/utils/deck-stats.js js/build/bracket.js js/build/manabase.js js/build/type-plan.js js/build/deck.js js/analysis/commander-match.js)
'loaded ok'
"
```
Expected: prints `loaded ok` with no thrown error (this only checks the concatenated scripts parse and execute top-level without a ReferenceError/SyntaxError — it does not call `buildDeckFromScoredPool`, which needs real collection/EDHREC data supplied in Task 10).

- [ ] **Step 9: Commit**

```bash
git add js/build/deck.js
git commit -m "Reorder deck.js: role targets fill first, type buckets are a soft floor"
```

---

## Task 10: Rebuild the offline end-to-end harness

This rebuilds the rig described in the `deck-builder-harness-data` memory (previously scratchpad-only, now committed so Task 11 and future sessions don't have to redo it). It uses the repo's own `card inventory (1).csv` as the real owned collection, and the project's real EDHREC fetch pattern confirmed below rather than a guessed one.

Two facts this task depends on, confirmed by reading the source directly:
- `EDHREC_BASE = "https://json.edhrec.com/pages/commanders/"` (`js/constants.js:6`). `fetchEdhrecCommanderJson` (`js/api/edhrec.js:65-92`) tries, per candidate slug, both `${EDHREC_BASE}${slug}.json` and `${EDHREC_BASE}${slug}/${slug}.json`.
- `js/cache.js:13` exposes a plain module-level `const cardCache = new Map()`. `fetchCardDataBatchWithProgress` (`js/api/scryfall.js:99`) checks this cache before ever calling `fetch` on Scryfall's collection endpoint. Pre-seeding `cardCache` from `owned_raw.json` means the harness never needs to fake Scryfall's POST `/cards/collection` request-body-matching at all — every owned card is already "cached".

**Files:**
- Create: `tools/jxa-harness/fetch_owned.py`
- Create: `tools/jxa-harness/prefetch.py`
- Create: `tools/jxa-harness/prelude.js`
- Create: `tools/jxa-harness/build_harness.sh`

**Interfaces:**
- Produces: `tools/jxa-harness/owned_raw.json` (git-ignored — large, regenerated on demand) via `fetch_owned.py`, an array of raw Scryfall card objects for every card in the CSV.
- Produces: `tools/jxa-harness/prefetch_data.json` (git-ignored) via `prefetch.py`, shaped `{ edhrecPages: { [url]: <json> }, commanderCards: { [name]: <raw Scryfall card> } }`.
- Produces: `tools/jxa-harness/build_harness.sh <output.js>` — concatenates `prelude.js` + the project's `<script src="...">` files (in `index.html`'s order) into one runnable script.

- [ ] **Step 1: Write `tools/jxa-harness/fetch_owned.py`**

```python
#!/usr/bin/env python3
"""Fetch Scryfall data for every card in the owned-collection CSV.

Run from the repo root: python3 tools/jxa-harness/fetch_owned.py
Writes tools/jxa-harness/owned_raw.json.
"""
import csv
import json
import time
import urllib.request

CSV_PATH = "card inventory (1).csv"
OUT_PATH = "tools/jxa-harness/owned_raw.json"
CHUNK_SIZE = 75

def read_owned_names(path):
    names = set()
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        name_field = next((c for c in reader.fieldnames if c.strip().lower() == "name"), reader.fieldnames[0])
        for row in reader:
            name = (row.get(name_field) or "").strip()
            if name:
                names.add(name)
    return sorted(names)

def fetch_chunk(names):
    body = json.dumps({"identifiers": [{"name": n} for n in names]}).encode("utf-8")
    req = urllib.request.Request(
        "https://api.scryfall.com/cards/collection",
        data=body,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def main():
    names = read_owned_names(CSV_PATH)
    cards = []
    for i in range(0, len(names), CHUNK_SIZE):
        chunk = names[i:i + CHUNK_SIZE]
        data = fetch_chunk(chunk)
        cards.extend(data.get("data", []))
        if data.get("not_found"):
            print("not found:", [n.get("name") for n in data["not_found"]])
        time.sleep(0.1)

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(cards, f)
    print(f"wrote {len(cards)} cards to {OUT_PATH}")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Write `tools/jxa-harness/prelude.js`**

```js
// Stubs so the project's browser-scoped code runs unmodified under
// osascript -l JavaScript. setTimeout runs its callback immediately, which
// is enough for the project's async/await code to resolve correctly.
function setTimeout(fn, _delay) { fn(); return 0; }
function clearTimeout(_id) {}

class AbortController {
  constructor() { this.signal = {}; }
  abort() {}
}

const localStorage = (function () {
  const store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; }
  };
})();

// fetch is overridden per-harness-run (compare.js defines it against
// prefetch_data.json before calling any project code that needs it), so this
// is only a safety-net default.
function fetch(_url, _opts) {
  return Promise.reject(new Error("fetch stub not configured for this harness run"));
}
```

- [ ] **Step 3: Write `tools/jxa-harness/prefetch.py`, using the confirmed EDHREC URL pattern and fetching the sample commanders' own Scryfall data**

```python
#!/usr/bin/env python3
"""Fetch EDHREC commander pages and Scryfall commander-card data for a fixed
list of sample commanders, so compare.js can run the project's real
getEDHREC()/resolveCommanders() logic offline.

Run from the repo root: python3 tools/jxa-harness/prefetch.py
Writes tools/jxa-harness/prefetch_data.json.
"""
import json
import re
import time
import urllib.parse
import urllib.request

OUT_PATH = "tools/jxa-harness/prefetch_data.json"
EDHREC_BASE = "https://json.edhrec.com/pages/commanders/"

# One sample commander per axis this plan's design doc cares about: color
# count, ramp density, tribal vs non-tribal. Extend this list to widen the
# comparison in Task 11.
SAMPLE_COMMANDERS = [
    "Rivaz of the Claw",
    "Krydle of Baldur's Gate",
]

def slugify_for_edhrec(name):
    # Mirrors js/utils/text.js's slugifyForEdhrec exactly enough for plain
    # commander names (no special characters beyond apostrophes/commas).
    s = name.lower()
    s = s.replace("'", "").replace('"', "").replace(",", "")
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s.strip("-")

def fetch_json(url):
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def fetch_edhrec_page(name):
    slug = slugify_for_edhrec(name)
    for url in (f"{EDHREC_BASE}{slug}.json", f"{EDHREC_BASE}{slug}/{slug}.json"):
        try:
            data = fetch_json(url)
            cardlists = (data.get("container") or {}).get("json_dict", {}).get("cardlists")
            if cardlists:
                return url, data
        except Exception as exc:
            print(f"  miss: {url} ({exc})")
        time.sleep(0.2)
    return None, None

def fetch_commander_card(name):
    url = "https://api.scryfall.com/cards/named?exact=" + urllib.parse.quote(name)
    return fetch_json(url)

def main():
    edhrec_pages = {}
    commander_cards = {}

    for name in SAMPLE_COMMANDERS:
        print(f"fetching {name}...")
        url, data = fetch_edhrec_page(name)
        if url:
            edhrec_pages[url] = data
        else:
            print(f"  WARNING: no EDHREC page found for {name}")
        commander_cards[name] = fetch_commander_card(name)
        time.sleep(0.2)

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump({"edhrecPages": edhrec_pages, "commanderCards": commander_cards}, f)
    print(f"wrote {len(edhrec_pages)} EDHREC pages and {len(commander_cards)} commander cards to {OUT_PATH}")

if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Write `tools/jxa-harness/build_harness.sh`**

```bash
#!/bin/bash
# Usage: tools/jxa-harness/build_harness.sh <output.js>
# Concatenates prelude.js + the project's <script> files (index.html's
# order) into one runnable JXA script.
set -e
out="${1:-tools/jxa-harness/combined.js}"

scripts=(
  js/constants.js
  js/utils/text.js
  js/utils/cards.js
  js/analysis/pairing.js
  js/collection/csv.js
  js/analysis/themes.js
  js/analysis/scoring.js
  js/api/http.js
  js/api/edhrec.js
  js/cache.js
  js/api/scryfall.js
  js/utils/deck-stats.js
  js/build/bracket.js
  js/build/manabase.js
  js/build/type-plan.js
  js/build/deck.js
  js/analysis/commander-match.js
)

cat tools/jxa-harness/prelude.js "${scripts[@]}" > "$out"
echo "wrote $out"
```

- [ ] **Step 5: Add the harness's generated data files to `.gitignore`**

Append to `.gitignore` (create it if it doesn't exist):
```
tools/jxa-harness/owned_raw.json
tools/jxa-harness/prefetch_data.json
tools/jxa-harness/combined.js
tools/jxa-harness/combined_before.js
```

- [ ] **Step 6: Run the fetch scripts and confirm they produce data**

Run: `python3 tools/jxa-harness/fetch_owned.py`
Expected: prints `wrote N cards to tools/jxa-harness/owned_raw.json` with N in the thousands (the CSV has ~6,250 owned cards per the harness-data memory).

Run: `python3 tools/jxa-harness/prefetch.py`
Expected: prints `fetching Rivaz of the Claw...`, `fetching Krydle of Baldur's Gate...`, then `wrote 2 EDHREC pages and 2 commander cards to tools/jxa-harness/prefetch_data.json`. If either commander logs `WARNING: no EDHREC page found`, swap it for a different sample commander with an active EDHREC page before continuing — Task 11 needs real EDHREC data for both.

Run: `bash tools/jxa-harness/build_harness.sh tools/jxa-harness/combined.js`
Expected: prints `wrote tools/jxa-harness/combined.js`.

- [ ] **Step 7: Commit**

```bash
git add tools/jxa-harness/fetch_owned.py tools/jxa-harness/prefetch.py tools/jxa-harness/prelude.js tools/jxa-harness/build_harness.sh .gitignore
git commit -m "Commit the offline JXA end-to-end harness (was scratchpad-only)"
```

---

## Task 11: Before/after comparison and opening-hand simulation

**Files:**
- Create: `tools/jxa-harness/compare.js`
- Create: `tools/jxa-harness/compare_report.md` (generated output, committed so the comparison is visible in the PR — regenerate and overwrite on any future rerun)

**Interfaces:**
- Consumes: `tools/jxa-harness/combined.js` (Task 10), `owned_raw.json`/`prefetch_data.json` (Task 10). Calls the project's real, unmodified `getEDHREC`, `detectCommanderThemes`, `buildThemeCandidateNames`, `getCommanderStrategyProfile`, `getModePreferences`, `detectRole`, `scoreCard`, `buildDeckFromScoredPool` — the same functions `js/main.js:81-360` calls, minus its DOM/progress-callback plumbing.
- Produces: a printed comparison (land count, per-color source counts, curve histogram, role/type fill rates, and simulated opening-hand color availability) for each sample commander, old logic vs. new logic.

- [ ] **Step 1: Write `tools/jxa-harness/compare.js`**

This file is concatenated after `combined.js` (`cat tools/jxa-harness/combined.js tools/jxa-harness/compare.js > run.js`, same pattern as `tests/jxa/run.sh`), so it can call any function `combined.js` defines directly.

```js
function readJsonFile(path) {
  const standardized = $.NSString.alloc.initWithString(path).stringByStandardizingPath.js;
  const data = $.NSData.dataWithContentsOfFile(standardized);
  const str = $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding).js;
  return JSON.parse(str);
}

const ownedRaw = readJsonFile("tools/jxa-harness/owned_raw.json");
const prefetch = readJsonFile("tools/jxa-harness/prefetch_data.json");

// Real getEDHREC() calls fetchEdhrecCommanderJson (EDHREC_BASE URLs) and may
// also try theme sub-pages this harness never prefetched -- those simply
// come back "not found" here, same as they would against a live EDHREC that
// has no page for that theme. That's fine: both the "before" and "after" run
// see the same missing data, so the comparison stays fair.
fetch = function (url) {
  const body = prefetch.edhrecPages[url];
  if (body === undefined) {
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
  }
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
};

// Seeds js/cache.js's module-level cardCache so fetchCardDataBatchWithProgress
// finds every owned card already cached and never calls fetch for Scryfall's
// collection endpoint at all.
for (const raw of ownedRaw) {
  const card = convertScryfallCard(raw);
  cardCache.set(normalizeCardName(card.name), card);
  indexCardByFrontFace(cardCache, card);
}

function simulateOpeningHands(finalDeck, commanderColors, trials) {
  const results = {};
  for (const color of commanderColors) results[color] = 0;

  for (let t = 0; t < trials; t++) {
    const shuffled = [...finalDeck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    let hand = shuffled.slice(0, 7);
    const hasAnyLand = hand.some((c) => c.role === "land");
    if (!hasAnyLand) hand = shuffled.slice(0, 6); // one mulligan-to-6, keep the new 6

    for (const color of commanderColors) {
      const hasSource = hand.some((c) => c.role === "land" && Array.isArray(c.colors) && c.colors.includes(color));
      if (hasSource) results[color] += 1;
    }
  }

  const rates = {};
  for (const color of commanderColors) rates[color] = results[color] / trials;
  return rates;
}

function summarize(label, finalDeck, commanderColors) {
  const lands = finalDeck.filter((c) => c.role === "land");
  const nonlands = finalDeck.filter((c) => c.role !== "land");
  const typeCounts = countByType(nonlands);
  const roleCounts = { ramp: 0, draw: 0, removal: 0, wipe: 0, synergy: 0 };
  for (const card of nonlands) {
    const roles = getRoleContributions(card);
    if (roles.length === 0) roleCounts.synergy += 1;
    for (const role of roles) if (roleCounts[role] !== undefined) roleCounts[role] += 1;
  }
  const sourceCounts = {};
  for (const color of commanderColors) sourceCounts[color] = 0;
  for (const land of lands) {
    for (const color of (land.colors || [])) if (sourceCounts[color] !== undefined) sourceCounts[color] += 1;
  }
  const handRates = simulateOpeningHands(finalDeck, commanderColors, 2000);

  jxaPrint("--- " + label + " ---");
  jxaPrint("Lands: " + lands.length);
  jxaPrint("Sources: " + JSON.stringify(sourceCounts));
  jxaPrint("Types: " + JSON.stringify(typeCounts));
  jxaPrint("Roles: " + JSON.stringify(roleCounts));
  jxaPrint("Opening-hand on-color rate (2000 trials): " + JSON.stringify(handRates));
}

// Mirrors js/main.js's real build path (lines ~90-360): resolveCommanders +
// getEDHREC + fetchCardDataBatchWithProgress + detectCommanderThemes +
// the candidate-scoring loop + buildThemeCandidateNames + buildDeckFromScoredPool.
// resolveCommanders itself is skipped -- it always calls Scryfall's single-card
// endpoint with no cache check, which this harness has no stub for -- and its
// job (turn a name into a card + color identity) is done directly below from
// the commander card prefetch.py already fetched.
async function buildForCommander(name) {
  const commanderRaw = prefetch.commanderCards[name];
  const commanderCard = convertScryfallCard(commanderRaw);
  const commanders = {
    primary: commanderCard,
    partner: null,
    names: [name],
    colors: commanderRaw.color_identity || []
  };

  const edhrecData = await getEDHREC(commanders.names);
  const edhrecCards = Array.isArray(edhrecData?.cards) ? edhrecData.cards : [];
  const edhrecTags = Array.isArray(edhrecData?.tags) ? edhrecData.tags : [];

  const collection = {
    entries: ownedRaw.map((raw) => ({ normalizedName: normalizeCardName(raw.name), rawName: raw.name }))
  };
  const allOwnedNames = ownedRaw.map((raw) => raw.name);
  const allOwnedCardData = await fetchCardDataBatchWithProgress(allOwnedNames, () => {});

  const commanderThemes = await detectCommanderThemes(
    edhrecCards,
    edhrecTags,
    collection,
    allOwnedCardData,
    commanders.colors
  );

  const strategyProfile = getCommanderStrategyProfile(commanders.primary.name, commanderThemes, commanders.colors);
  const modePrefs = getModePreferences("", strategyProfile);

  const ownedCandidates = edhrecCards.length
    ? edhrecCards.filter((c) => hasOwnedCard(collection, c.name))
    : getCollectionEntries(collection).map((entry) => ({ name: entry.rawName, synergy: 0, decks: 0, label: "Collection Fallback", labels: ["Collection Fallback"] }));

  const ownedCardData = new Map();
  for (const candidate of ownedCandidates) {
    const normalizedName = normalizeCardName(candidate.name);
    if (allOwnedCardData.has(normalizedName)) ownedCardData.set(normalizedName, allOwnedCardData.get(normalizedName));
  }

  const scoredNonlands = [];
  for (const edhrecCard of ownedCandidates) {
    const normalizedName = normalizeCardName(edhrecCard.name);
    const card = ownedCardData.get(normalizedName);
    if (!card || getCardType(card).includes("land") || !legalForCommander(card.colors, commanders.colors)) continue;

    scoredNonlands.push({
      name: card.name,
      role: detectRole(card),
      score: scoreCard(card, edhrecCard, commanderThemes, strategyProfile, commanders.colors, modePrefs),
      type: getCardType(card),
      cmc: card.cmc,
      colors: card.colors
    });
  }

  const themeCardNames = await buildThemeCandidateNames(
    commanderThemes,
    collection,
    allOwnedCardData,
    commanders.colors,
    edhrecData?.themeCardLists || {}
  );

  return buildDeckFromScoredPool(
    scoredNonlands,
    commanders.colors,
    collection,
    allOwnedCardData,
    commanderThemes,
    commanders.primary.name,
    modePrefs,
    edhrecData?.typeAverages || null,
    edhrecData?.roleTargets || null,
    edhrecCards,
    { themeCardNames, deckSize: 99 }
  );
}

async function main() {
  const names = Object.keys(prefetch.commanderCards);
  for (const name of names) {
    const finalDeck = await buildForCommander(name);
    summarize(name, finalDeck, prefetch.commanderCards[name].color_identity || []);
  }
}

main();
```

- [ ] **Step 2: Run the comparison against the current (post-Task-9) code**

```bash
cat tools/jxa-harness/combined.js tools/jxa-harness/compare.js > /tmp/compare_after.js
osascript -l JavaScript /tmp/compare_after.js | tee /tmp/after_output.txt
```
Expected: one `--- <commander name> ---` block per sample commander, each with Lands/Sources/Types/Roles/opening-hand lines, and no thrown errors.

- [ ] **Step 3: Run the same comparison against the pre-Task-2 code, to get a "before" baseline**

```bash
git log --oneline -- js/build/manabase.js js/build/type-plan.js js/build/deck.js
```
Find the commit hash immediately before Task 2's first commit (the one that added `parsePips`), then:
```bash
git worktree add /tmp/before-worktree <hash-before-task-2>
(cd /tmp/before-worktree && bash tools/jxa-harness/build_harness.sh /tmp/combined_before.js)
cat /tmp/combined_before.js tools/jxa-harness/compare.js > /tmp/compare_before.js
osascript -l JavaScript /tmp/compare_before.js | tee /tmp/before_output.txt
git worktree remove /tmp/before-worktree
```
(Using a worktree rather than `git stash` avoids disturbing the working tree the rest of this plan's commits live in.)

- [ ] **Step 4: Diff before vs. after**

```bash
diff /tmp/before_output.txt /tmp/after_output.txt
```

- [ ] **Step 5: Write `tools/jxa-harness/compare_report.md` summarizing the diff**

Include, for each sample commander: land count before vs. after, per-color source counts before vs. after, and the opening-hand on-color rate before vs. after. This is the concrete evidence the user asked for before trusting the change — call out explicitly if any color's opening-hand rate regresses, since that's the one metric a land-count/curve tweak could make worse even while "looking more correct" on paper.

- [ ] **Step 6: Commit**

```bash
git add tools/jxa-harness/compare.js tools/jxa-harness/compare_report.md
git commit -m "Add before/after comparison harness with opening-hand simulation"
```

