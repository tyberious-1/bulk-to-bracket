# Role Priority Sliders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five 0–10 priority sliders (Ramp, Draw, Removal, Wipes, Synergy) plus a Rebuild button to the deck builder UI, so a user can scale how strongly each role is targeted and scored before re-running the existing no-refetch rebuild pipeline.

**Architecture:** Each slider is a 0–10 value staged in module state (`js/state.js`) and converted to a `0–2.0` multiplier (`value / 5`, so 5 = today's unchanged behavior). Clicking Rebuild feeds that multiplier object into the existing `getModePreferences` → `scoreCard`/`scoreFallbackCard` → `buildRoleTargetPlan` pipeline at the two points that currently hardcode role weight: the flat `roleBonus` added during scoring, and the EDHREC-derived role *count* targets (`ramp`/`draw`/`removal`/`wipe`) that `buildRoleTargetPlan` treats as a hard constraint. Synergy has no independent count (it's whatever nonland slots are left after the other four), so its slider only scales `synergyBias`. No new network calls, no new build phases — this plugs into the same `runRegeneration()` path the theme-priority buttons and Minimal Build toggle already use.

**Tech Stack:** Plain browser JS (no framework, no build step), global-scope `<script>` files loaded in dependency order from `index.html`. Tests run via `dev/tests/jxa/run.sh <source files...> <test file>`, which concatenates `dev/tests/jxa/helpers.js` + the given sources + the test file and runs the result under `osascript -l JavaScript` (this machine has no Node JXA-compatible `$`-bridge substitute — plain `node` cannot run these suites because `helpers.js` uses `$.NSFileHandle`).

**Spec:** No separate spec file — this is a bounded UI change to an existing flow. The approved design is captured above (Goal/Architecture) and was agreed in chat before this plan was written: sliders sit alongside the existing theme-priority buttons and Minimal Build toggle (not replacing them), use a 0–10 priority scale (5 = neutral/default, matching today's output exactly), and rebuild only on an explicit button click (no live/debounced rebuild while dragging).

## Global Constraints

- Default slider value is **5** for every role, and a deck built with all five sliders at 5 must produce byte-for-byte the same result as today (no bias field may default to anything other than a `1.0` multiplier).
- Slider range is **0–10** inclusive, integer steps only (no fractional ticks).
- Dragging a slider must never trigger a rebuild by itself — only the Rebuild button click does.
- Synergy's slider must not introduce a `synergy` key into `roleTargets` (synergy count stays derived as `nonlandCount - roleTotal` inside `buildRoleTargetPlan`, untouched by this feature).
- Every existing call site of `getModePreferences(mode, strategyProfile)` (two positional args) must keep working unchanged — the new `roleBias` parameter is additive and optional.

## Review Focus

- **All sliders left at default (5) produces an identical deck to before this change** — the most likely regression, since every bias multiplier now sits in the hot scoring/target path. Covered by Task 2's and Task 3's "bias of 1 changes nothing" tests and Task 4's existing fixture tests still passing untouched.
- **A slider dragged to 0 actually suppresses that role**, not just "scores it lower" — a user's literal expectation of "0 means none." Covered by Task 4's wipe-bias-zero test.
- **A slider dragged to 10 doesn't runaway/overflow or produce a negative/NaN target** (e.g. rounding a fractional EDHREC-derived count after a 2x multiply). Covered by Task 1's `applyRoleBias` rounding test.
- **Rebuild reuses `currentRunContext` without re-fetching EDHREC data** — a user moving sliders after a build must not trigger a second network round-trip or reset their theme focus / Minimal Build choice. Covered by Task 6's manual end-to-end check, which confirms the existing `runRegeneration()` path (not `generateDeck()`) is what the Rebuild button calls.
- **Clicking Rebuild before any deck has been generated does nothing** (no commander/CSV yet) — same guard `regenerateWithMode`/`toggleMinimalBuild` already use (`if (!currentRunContext) return;`). Covered by Task 6's manual check.

---

## File Structure

- **`js/utils/deck-stats.js`** (modify) — add `applyRoleBias(roleTargets, modePrefs)`, a pure function scaling the four EDHREC-derived role count targets by the matching bias multiplier. Lives next to `normalizeRoleTargets`, which it always wraps.
- **`js/analysis/themes.js`** (modify) — `getModePreferences` gains a third, optional `roleBias` parameter and returns four new fields (`rampBias`, `drawBias`, `removalBias`, `wipeBias`) plus folds a synergy multiplier into the existing `synergyBias` field.
- **`js/analysis/scoring.js`** (modify) — `scoreCard` and `scoreFallbackCard` multiply their flat per-role bonus (today: ramp/draw/removal +4, wipe +3) by the matching `modePrefs.*Bias` field instead of using the flat constant directly.
- **`js/build/deck.js`** (modify) — one line in `buildDeckFromScoredPool`: wrap the existing `normalizeRoleTargets(edhrecRoleTargets)` call in `applyRoleBias(...)` so the scaled counts become the hard constraint `buildRoleTargetPlan` builds against.
- **`js/state.js`** (modify) — add `roleBiasSliderValues` (an object of five 0–10 integers, default 5 each) with `getRoleBiasSliderValues()`, `setRoleBiasSliderValue(role, value)`, and `getRoleBias()` (converts the 0–10 values into the `{ramp, draw, removal, wipe, synergy}` multiplier object `getModePreferences` consumes).
- **`js/dom.js`** (modify) — add element handles for the new panel, its five `<input type="range">` sliders, their five value-label `<span>`s, and the Rebuild button.
- **`js/ui/role-bias.js`** (create) — binds each slider's `input` event to `setRoleBiasSliderValue` + updates its value label; no rebuild logic here (that's `main.js`'s job, same split as `status.js` owning the priority buttons' DOM while `main.js` owns `regenerateWithMode`).
- **`js/main.js`** (modify) — `performBuildFromContext` passes `getRoleBias()` as `getModePreferences`'s third argument; wire `rebuildBtn`'s click to call the existing `runRegeneration()`; show/hide the new panel alongside `postBuildControls`/`buildModeControls` in `generateDeck()`.
- **`index.html`** (modify) — new `<div id="roleBiasControls" class="panel hidden">` panel (sibling of `#buildModeControls`) with the five sliders/labels and the Rebuild button; add `<script src="js/ui/role-bias.js"></script>` after `js/ui/status.js`.
- **`style.css`** (modify) — minimal layout rules for the new panel (`.role-bias-slider` row spacing, `input[type="range"]` sizing — there is currently no range-input styling in the file at all).
- **`dev/tests/jxa/deck-stats.test.js`** (create) — unit tests for `applyRoleBias` (and, since it had none, `normalizeRoleTargets`).
- **`dev/tests/jxa/mode-prefs.test.js`** (modify) — add tests for the new bias fields on `getModePreferences`.
- **`dev/tests/jxa/scoring.test.js`** (modify) — add tests confirming `scoreCard`'s and `scoreFallbackCard`'s role bonus scales with the matching bias field.
- **`dev/tests/jxa/deck.test.js`** (modify) — add one fixture test confirming a `wipe` bias of `0` keeps the owned board wipe out of the deck entirely.

---

### Task 1: `applyRoleBias` in deck-stats.js

**Files:**
- Modify: `js/utils/deck-stats.js` (add function after `normalizeRoleTargets`, around line 54)
- Test: Create `dev/tests/jxa/deck-stats.test.js`

**Interfaces:**
- Consumes: nothing new (pure function over plain objects).
- Produces: `applyRoleBias(roleTargets, modePrefs)` — reads `modePrefs.rampBias`, `modePrefs.drawBias`, `modePrefs.removalBias`, `modePrefs.wipeBias` (each expected to already exist as a number once Task 2 lands; this task's own tests pass literal `modePrefs`-shaped objects directly, since Task 2 hasn't landed yet). Returns `{ ramp, draw, removal, wipe }`, each `Math.round(roleTargets[role] * biasForThatRole)`, floored at 0.

- [ ] **Step 1: Write the failing tests**

Create `dev/tests/jxa/deck-stats.test.js`:

```javascript
runSuite("deck-stats", {
  "normalizeRoleTargets: falls back to defaults when a field is missing": function () {
    const targets = normalizeRoleTargets({ ramp: 14 });
    assertEqual(targets, { ramp: 14, draw: 10, removal: 8, wipe: 3 });
  },
  "normalizeRoleTargets: falls back to all defaults when given null": function () {
    const targets = normalizeRoleTargets(null);
    assertEqual(targets, { ramp: 10, draw: 10, removal: 8, wipe: 3 });
  },
  "applyRoleBias: a bias of 1 on every role leaves targets unchanged": function () {
    const roleTargets = { ramp: 10, draw: 10, removal: 8, wipe: 3 };
    const modePrefs = { rampBias: 1, drawBias: 1, removalBias: 1, wipeBias: 1 };
    assertEqual(applyRoleBias(roleTargets, modePrefs), roleTargets);
  },
  "applyRoleBias: scales each role independently by its own bias": function () {
    const roleTargets = { ramp: 10, draw: 10, removal: 8, wipe: 4 };
    const modePrefs = { rampBias: 2, drawBias: 0.5, removalBias: 1, wipeBias: 1.5 };
    assertEqual(applyRoleBias(roleTargets, modePrefs), { ramp: 20, draw: 5, removal: 8, wipe: 6 });
  },
  "applyRoleBias: a bias of 0 zeroes out that role's target": function () {
    const roleTargets = { ramp: 10, draw: 10, removal: 8, wipe: 3 };
    const modePrefs = { rampBias: 1, drawBias: 1, removalBias: 1, wipeBias: 0 };
    assertEqual(applyRoleBias(roleTargets, modePrefs).wipe, 0);
  },
  "applyRoleBias: rounds to the nearest whole card, never negative": function () {
    const roleTargets = { ramp: 3, draw: 10, removal: 8, wipe: 3 };
    const modePrefs = { rampBias: 0.34, drawBias: 1, removalBias: 1, wipeBias: 1 };
    assertTrue(applyRoleBias(roleTargets, modePrefs).ramp >= 0, "expected a non-negative ramp target");
    assertEqual(applyRoleBias(roleTargets, modePrefs).ramp, 1);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dev/tests/jxa/run.sh js/utils/deck-stats.js dev/tests/jxa/deck-stats.test.js`
Expected: FAIL — `applyRoleBias is not defined` (the `normalizeRoleTargets` tests should already PASS, since that function exists today).

- [ ] **Step 3: Implement `applyRoleBias`**

In `js/utils/deck-stats.js`, immediately after the closing brace of `normalizeRoleTargets` (after line 54):

```javascript
// Lets the role-priority sliders (0-10 UI scale, converted to a 0-2
// multiplier by getRoleBias in state.js) scale the hard role-count
// constraint buildRoleTargetPlan builds against, same as they scale the
// per-card scoring bonus in scoreCard/scoreFallbackCard. Always applied,
// even when every slider sits at its 1.0 default, so this is the only
// place either call site needs to reason about bias.
function applyRoleBias(roleTargets, modePrefs) {
  return {
    ramp: Math.max(0, Math.round(roleTargets.ramp * (modePrefs.rampBias ?? 1))),
    draw: Math.max(0, Math.round(roleTargets.draw * (modePrefs.drawBias ?? 1))),
    removal: Math.max(0, Math.round(roleTargets.removal * (modePrefs.removalBias ?? 1))),
    wipe: Math.max(0, Math.round(roleTargets.wipe * (modePrefs.wipeBias ?? 1)))
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `dev/tests/jxa/run.sh js/utils/deck-stats.js dev/tests/jxa/deck-stats.test.js`
Expected: PASS (all 6 tests), `SUITE OK`.

- [ ] **Step 5: Commit**

```bash
git add js/utils/deck-stats.js dev/tests/jxa/deck-stats.test.js
git commit -m "Add applyRoleBias for scaling role count targets"
```

---

### Task 2: Bias fields on `getModePreferences`

**Files:**
- Modify: `js/analysis/themes.js:459-487` (`getModePreferences`)
- Test: Modify `dev/tests/jxa/mode-prefs.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `getModePreferences(mode, strategyProfile, roleBias = {})` now also returns `rampBias`, `drawBias`, `removalBias`, `wipeBias` (numbers, default `1`), and multiplies the existing `synergyBias` field by `roleBias.synergy` (default `1`). `roleBias` is expected to carry `{ ramp, draw, removal, wipe, synergy }`, each already a multiplier (Task 5's `getRoleBias()` is what actually constructs this at runtime — this task only needs the shape, not that function).

- [ ] **Step 1: Write the failing tests**

Append to `dev/tests/jxa/mode-prefs.test.js` (inside the existing object literal passed to `runSuite`, add a comma after the last existing test and before the closing `}`):

```javascript
  ,
  "getModePreferences: role biases default to 1 when roleBias is omitted": function () {
    const prefs = getModePreferences("", { wantsCreatures: false });
    assertEqual(prefs.rampBias, 1);
    assertEqual(prefs.drawBias, 1);
    assertEqual(prefs.removalBias, 1);
    assertEqual(prefs.wipeBias, 1);
  },

  "getModePreferences: role biases pass through from roleBias": function () {
    const prefs = getModePreferences("", { wantsCreatures: false }, { ramp: 2, draw: 0.5, removal: 1, wipe: 0 });
    assertEqual(prefs.rampBias, 2);
    assertEqual(prefs.drawBias, 0.5);
    assertEqual(prefs.removalBias, 1);
    assertEqual(prefs.wipeBias, 0);
  },

  "getModePreferences: synergy slider multiplies the existing theme-focus synergyBias": function () {
    const withoutFocus = getModePreferences("", { wantsCreatures: false }, { synergy: 2 });
    assertClose(withoutFocus.synergyBias, 2, 0.0001, "expected base 1 * slider 2");

    const withFocus = getModePreferences("theme:elves", { wantsCreatures: false }, { synergy: 2 });
    assertClose(withFocus.synergyBias, 2.9, 0.0001, "expected base 1.45 * slider 2");
  }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dev/tests/jxa/run.sh js/analysis/themes.js dev/tests/jxa/mode-prefs.test.js`
Expected: FAIL — `prefs.rampBias` etc. are `undefined`, failing `assertEqual`.

- [ ] **Step 3: Implement the bias fields**

In `js/analysis/themes.js`, replace the `getModePreferences` function (lines 459-487):

```javascript
function getModePreferences(mode, strategyProfile, roleBias = {}) {
  const modeParts = String(mode || "").split("|").map((part) => part.trim()).filter(Boolean);
  const themePart = modeParts.find((part) => part.startsWith("theme:"));

  const themeFocus = themePart ? themePart.slice(6) : "";
  const focusedThemeSignal = normalizeThemeName(themeFocus);
  const tribalFocus = getCommanderTribalThemes(themeFocus ? [themeFocus] : []).length > 0;
  const focusedTribalTypes = getCommanderTribalThemes(themeFocus ? [themeFocus] : []).map((theme) => theme.replace(" tribal", ""));
  const themeFocusAliases = themeFocus ? getThemeAliases(themeFocus).map((alias) => normalizeThemeName(alias)) : [];
  const creatureFocusedTheme = ["tokens", "blink", "reanimator", "elves", "zombies", "goblins", "humans", "angels", "dragons", "bears"].includes(focusedThemeSignal);

  // The role-priority sliders (index.html's roleBiasControls panel), converted
  // from their 0-10 UI scale to a 0-2 multiplier by getRoleBias in state.js.
  // Defaulted here too, not only at the call site, so every existing caller
  // (tests included) that passes only two arguments keeps getting today's
  // unbiased 1.0 behavior.
  const rampBias = roleBias.ramp ?? 1;
  const drawBias = roleBias.draw ?? 1;
  const removalBias = roleBias.removal ?? 1;
  const wipeBias = roleBias.wipe ?? 1;
  const synergySliderBias = roleBias.synergy ?? 1;

  return {
    mode,
    themeFocus,
    focusedThemeSignal,
    focusedTribalTypes,
    themeFocusAliases,
    minimalBuild: modeParts.includes("minimal"),
    synergyBias:
      (themeFocus ? 1.45 : 1) * synergySliderBias,
    creatureBias:
      tribalFocus || creatureFocusedTheme ? 1.3 :
      strategyProfile.wantsCreatures ? 1.1 : 1,
    casualBias: 1,
    manaBaseBias: 1,
    fewerStaplesBias: 1,
    tribalBias: tribalFocus ? 1.55 : 1,
    rampBias,
    drawBias,
    removalBias,
    wipeBias
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `dev/tests/jxa/run.sh js/analysis/themes.js dev/tests/jxa/mode-prefs.test.js`
Expected: PASS (all tests, old and new), `SUITE OK`.

Also re-run the suites that already call `getModePreferences` with two arguments, to confirm nothing broke:
Run: `dev/tests/jxa/run.sh js/analysis/*.js js/utils/*.js js/constants.js js/collection/csv.js dev/tests/jxa/scoring.test.js`
Expected: PASS, `SUITE OK` (same as before this task — these tests don't touch bias fields yet).

- [ ] **Step 5: Commit**

```bash
git add js/analysis/themes.js dev/tests/jxa/mode-prefs.test.js
git commit -m "Add role-bias fields to getModePreferences"
```

---

### Task 3: Scale `scoreCard`/`scoreFallbackCard` role bonuses

**Files:**
- Modify: `js/analysis/scoring.js:858-861` (`scoreCard`) and `js/analysis/scoring.js:905-908` (`scoreFallbackCard`)
- Test: Modify `dev/tests/jxa/scoring.test.js`

**Interfaces:**
- Consumes: `modePrefs.rampBias`/`drawBias`/`removalBias`/`wipeBias` from Task 2's `getModePreferences`.
- Produces: no new exports — `scoreCard`/`scoreFallbackCard`'s existing return value now reflects the bias.

- [ ] **Step 1: Write the failing tests**

Append to the `runSuite` object literal in `dev/tests/jxa/scoring.test.js` (same comma-before-closing-brace pattern as Task 2):

```javascript
  ,
  "scoreCard: a wipe card's role bonus scales with wipeBias": function () {
    const card = { type: "Sorcery", text: "destroy all creatures.", cmc: 4, colors: ["G"] };
    const edhrecCard = { synergy: 0, decks: 0 };
    const commanderThemes = [];
    const strategyProfile = { wantsCreatures: false, wantsTokens: false, wantsSacrifice: false, wantsGoWide: false, wantsTribal: false, tribalTypes: [] };
    const commanderColors = ["G"];

    const normalPrefs = getModePreferences("", strategyProfile);
    const doublePrefs = getModePreferences("", strategyProfile, { wipe: 2 });

    const normalScore = scoreCard(card, edhrecCard, commanderThemes, strategyProfile, commanderColors, normalPrefs);
    const doubleScore = scoreCard(card, edhrecCard, commanderThemes, strategyProfile, commanderColors, doublePrefs);

    assertClose(doubleScore - normalScore, 3, 0.001, "expected the wipe role bonus (3) to double from +3 to +6, a delta of 3");
  },
  "scoreCard: a wipeBias of 0 removes the wipe role bonus entirely": function () {
    const card = { type: "Sorcery", text: "destroy all creatures.", cmc: 4, colors: ["G"] };
    const edhrecCard = { synergy: 0, decks: 0 };
    const commanderThemes = [];
    const strategyProfile = { wantsCreatures: false, wantsTokens: false, wantsSacrifice: false, wantsGoWide: false, wantsTribal: false, tribalTypes: [] };
    const commanderColors = ["G"];

    const zeroPrefs = getModePreferences("", strategyProfile, { wipe: 0 });
    const score = scoreCard(card, edhrecCard, commanderThemes, strategyProfile, commanderColors, zeroPrefs);
    const curveBonus = 4; // cmc 4 falls in the "<= 4" band (checked before "<= 6"), +4
    assertClose(score, curveBonus, 0.001, "expected only the curve bonus to remain with wipeBias 0");
  },
  "scoreFallbackCard: a ramp card's role bonus scales with rampBias": function () {
    const card = { type: "Artifact", text: "{t}: add {c}{c}.", cmc: 2, colors: [] };
    const commanderThemes = [];
    const strategyProfile = { wantsCreatures: false, wantsTokens: false, wantsSacrifice: false, wantsGoWide: false, wantsTribal: false, tribalTypes: [] };
    const commanderColors = ["G"];

    const normalPrefs = getModePreferences("", strategyProfile);
    const halfPrefs = getModePreferences("", strategyProfile, { ramp: 0.5 });

    const normalScore = scoreFallbackCard(card, commanderThemes, strategyProfile, commanderColors, normalPrefs);
    const halfScore = scoreFallbackCard(card, commanderThemes, strategyProfile, commanderColors, halfPrefs);

    assertClose(normalScore - halfScore, 2, 0.001, "expected the ramp role bonus (4) to halve to 2, a delta of 2");
  }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dev/tests/jxa/run.sh js/analysis/themes.js js/analysis/scoring.js dev/tests/jxa/scoring.test.js`
Expected: FAIL — the three new tests fail (scores don't yet move with bias); existing tests in this file still PASS.

- [ ] **Step 3: Implement the scaling**

In `js/analysis/scoring.js`, replace lines 858-861 (inside `scoreCard`):

```javascript
  if (role === "ramp") roleBonus = 4 * modePrefs.rampBias;
  else if (role === "draw") roleBonus = 4 * modePrefs.drawBias;
  else if (role === "removal") roleBonus = 4 * modePrefs.removalBias;
  else if (role === "wipe") roleBonus = 3 * modePrefs.wipeBias;
```

And replace lines 905-908 (inside `scoreFallbackCard`):

```javascript
  if (role === "ramp") score += 4 * modePrefs.rampBias;
  else if (role === "draw") score += 4 * modePrefs.drawBias;
  else if (role === "removal") score += 4 * modePrefs.removalBias;
  else if (role === "wipe") score += 3 * modePrefs.wipeBias;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `dev/tests/jxa/run.sh js/analysis/themes.js js/analysis/scoring.js dev/tests/jxa/scoring.test.js`
Expected: PASS (all tests, old and new), `SUITE OK`.

- [ ] **Step 5: Commit**

```bash
git add js/analysis/scoring.js dev/tests/jxa/scoring.test.js
git commit -m "Scale role bonuses in scoreCard/scoreFallbackCard by role bias"
```

---

### Task 4: Apply bias to the hard role-count constraint in `deck.js`

**Files:**
- Modify: `js/build/deck.js:206`
- Test: Modify `dev/tests/jxa/deck.test.js`

**Interfaces:**
- Consumes: `applyRoleBias` (Task 1) and `modePrefs.*Bias` fields (Task 2).
- Produces: no new exports — `buildDeckFromScoredPool`'s internal `roleTargets` now reflects bias before `buildRoleTargetPlan` is called.

- [ ] **Step 1: Write the failing test**

Append to `dev/tests/jxa/deck.test.js`'s `runSuite` object literal (check the file's existing closing structure first — add a comma after the last test, before the final `});`):

```javascript
  ,
  "buildDeckFromScoredPool: a wipeBias of 0 keeps an owned board wipe out of the deck": function () {
    const deckWithDefaultBias = buildFixture(false);
    const wipeIncluded = deckWithDefaultBias.some((card) => card.name === "Test Board Wipe");
    assertTrue(wipeIncluded, "sanity check: the default-bias fixture should include the board wipe");

    const commanderThemes = [];
    const strategyProfile = getCommanderStrategyProfile(TEST_COMMANDER_NAME, commanderThemes, ["G"]);
    const zeroWipeModePrefs = getModePreferences("", strategyProfile, { wipe: 0 });

    const ownedCards = [TEST_RAMP_CARD, TEST_DRAW_CARD, TEST_REMOVAL_CARD, TEST_WIPE_CARD, ...TEST_FILLER_CARDS];
    const allOwnedCardData = new Map();
    allOwnedCardData.set(normalizeCardName(TEST_COMMANDER_NAME), makeCard(TEST_COMMANDER_NAME, "legendary creature — treefolk", "", 4, ["G"]));
    for (const card of ownedCards) allOwnedCardData.set(normalizeCardName(card.name), card);
    const entries = ownedCards.map((card) => ({ normalizedName: normalizeCardName(card.name), rawName: card.name, quantity: 1 }));
    const collectionData = { entries };

    const deckWithZeroWipeBias = buildDeckFromScoredPool(
      [],
      ["G"],
      collectionData,
      allOwnedCardData,
      commanderThemes,
      TEST_COMMANDER_NAME,
      zeroWipeModePrefs,
      null,
      { ramp: 1, draw: 1, removal: 1, wipe: 1 },
      [],
      { deckSize: 99, themeCardNames: new Map() }
    );

    const wipeExcluded = !deckWithZeroWipeBias.some((card) => card.name === "Test Board Wipe");
    assertTrue(wipeExcluded, "expected wipeBias 0 to zero the wipe role target and exclude the only owned board wipe");
  }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dev/tests/jxa/run.sh js/constants.js js/utils/text.js js/utils/cards.js js/format.js js/analysis/pairing.js js/collection/csv.js js/analysis/themes.js js/analysis/scoring.js js/utils/deck-stats.js js/build/bracket.js js/build/manabase.js js/build/type-plan.js js/build/deck.js dev/tests/jxa/deck.test.js`
Expected: FAIL — the new test fails because `roleTargets.wipe` isn't yet scaled by `wipeBias` inside `buildDeckFromScoredPool`, so the wipe card still gets drafted (its role bucket target is still 1, not 0). Existing tests in this file still PASS.

- [ ] **Step 3: Implement the fix**

In `js/build/deck.js`, replace line 206:

```javascript
  const roleTargets = normalizeRoleTargets(edhrecRoleTargets);
```

with:

```javascript
  const roleTargets = applyRoleBias(normalizeRoleTargets(edhrecRoleTargets), modePrefs);
```

- [ ] **Step 4: Run tests to verify they pass**

Run the same command as Step 2.
Expected: PASS (all tests, old and new), `SUITE OK`.

- [ ] **Step 5: Commit**

```bash
git add js/build/deck.js dev/tests/jxa/deck.test.js
git commit -m "Scale role count targets by role bias before building the role plan"
```

---

### Task 5: Slider state, markup, and label wiring

**Files:**
- Modify: `js/state.js` (add after the `ownedCollection` block, end of file)
- Modify: `js/dom.js` (add element handles)
- Modify: `index.html` (add the panel markup + new `<script>` tag)
- Modify: `style.css` (add minimal layout rules)
- Create: `js/ui/role-bias.js`

**Interfaces:**
- Consumes: nothing from earlier tasks (this task is pure UI plumbing — no scoring/build code is called yet).
- Produces: `getRoleBiasSliderValues()` (returns `{ ramp, draw, removal, wipe, synergy }`, each `0-10`), `setRoleBiasSliderValue(role, value)`, `getRoleBias()` (returns the same shape converted to `0-2` multipliers via `value / 5`) — all in `js/state.js`, consumed by Task 6's `main.js` changes. DOM handles `roleBiasControls`, `rebuildBtn`, and five `<role>BiasSlider`/`<role>BiasValue` pairs in `js/dom.js`, consumed by `js/ui/role-bias.js` (this task) and `js/main.js` (Task 6).

This task has no JXA-testable logic beyond simple getters/setters (browser DOM wiring isn't covered by the Node-less JXA suite, which only exercises plain-object logic files) — verification is a manual browser check at the end of Task 6, once Rebuild is wired up end-to-end. Implement it directly.

- [ ] **Step 1: Add slider state to `js/state.js`**

Append to the end of `js/state.js`:

```javascript
// The five role-priority sliders (index.html's roleBiasControls panel).
// 0-10 UI scale, 5 = neutral/default (today's unbiased behavior). Staged
// here on every slider drag; only read into a build via getRoleBias() when
// Rebuild is actually clicked (js/main.js), never on the drag itself.
let roleBiasSliderValues = { ramp: 5, draw: 5, removal: 5, wipe: 5, synergy: 5 };

function getRoleBiasSliderValues() {
  return roleBiasSliderValues;
}

function setRoleBiasSliderValue(role, value) {
  roleBiasSliderValues[role] = Number(value);
}

// Converts the 0-10 slider scale to the 0-2 multiplier scoreCard,
// scoreFallbackCard, and applyRoleBias expect (5 -> 1.0, 0 -> 0, 10 -> 2.0).
function getRoleBias() {
  const bias = {};
  for (const role of Object.keys(roleBiasSliderValues)) {
    bias[role] = roleBiasSliderValues[role] / 5;
  }
  return bias;
}
```

- [ ] **Step 2: Add the panel markup to `index.html`**

In `index.html`, immediately after the closing `</div>` of `buildModeControls` (after line 79, i.e. right before the blank line and `<div class="results-grid">` on line 81):

```html
      <div id="roleBiasControls" class="panel hidden">
        <h2>Role Priority</h2>
        <p class="build-mode-copy">0 = exclude this role, 5 = default, 10 = double priority. Drag, then click Rebuild.</p>
        <div class="role-bias-slider">
          <label for="rampBiasSlider">Ramp <span id="rampBiasValue">5</span></label>
          <input id="rampBiasSlider" type="range" min="0" max="10" step="1" value="5" />
        </div>
        <div class="role-bias-slider">
          <label for="drawBiasSlider">Draw <span id="drawBiasValue">5</span></label>
          <input id="drawBiasSlider" type="range" min="0" max="10" step="1" value="5" />
        </div>
        <div class="role-bias-slider">
          <label for="removalBiasSlider">Removal <span id="removalBiasValue">5</span></label>
          <input id="removalBiasSlider" type="range" min="0" max="10" step="1" value="5" />
        </div>
        <div class="role-bias-slider">
          <label for="wipeBiasSlider">Wipes <span id="wipeBiasValue">5</span></label>
          <input id="wipeBiasSlider" type="range" min="0" max="10" step="1" value="5" />
        </div>
        <div class="role-bias-slider">
          <label for="synergyBiasSlider">Synergy <span id="synergyBiasValue">5</span></label>
          <input id="synergyBiasSlider" type="range" min="0" max="10" step="1" value="5" />
        </div>
        <button id="rebuildBtn" type="button">Rebuild</button>
      </div>
```

Then, in the `<script>` block near the bottom of `index.html`, add a new line immediately after `<script src="js/ui/status.js"></script>`:

```html
  <script src="js/ui/role-bias.js"></script>
```

- [ ] **Step 3: Add element handles to `js/dom.js`**

Append to the end of `js/dom.js`:

```javascript
const roleBiasControls = document.getElementById("roleBiasControls");
const rebuildBtn = document.getElementById("rebuildBtn");
const rampBiasSlider = document.getElementById("rampBiasSlider");
const drawBiasSlider = document.getElementById("drawBiasSlider");
const removalBiasSlider = document.getElementById("removalBiasSlider");
const wipeBiasSlider = document.getElementById("wipeBiasSlider");
const synergyBiasSlider = document.getElementById("synergyBiasSlider");
const rampBiasValue = document.getElementById("rampBiasValue");
const drawBiasValue = document.getElementById("drawBiasValue");
const removalBiasValue = document.getElementById("removalBiasValue");
const wipeBiasValue = document.getElementById("wipeBiasValue");
const synergyBiasValue = document.getElementById("synergyBiasValue");
```

- [ ] **Step 4: Create `js/ui/role-bias.js`**

```javascript
// Role-priority slider wiring: keeps state.js's roleBiasSliderValues and
// each slider's on-screen label in sync as the user drags. Never triggers a
// rebuild itself -- js/main.js's rebuildBtn listener owns that, reading
// getRoleBias() only at the moment Rebuild is clicked.
//
// Depends on: dom.js, state.js

const ROLE_BIAS_SLIDERS = [
  { role: "ramp", slider: rampBiasSlider, label: rampBiasValue },
  { role: "draw", slider: drawBiasSlider, label: drawBiasValue },
  { role: "removal", slider: removalBiasSlider, label: removalBiasValue },
  { role: "wipe", slider: wipeBiasSlider, label: wipeBiasValue },
  { role: "synergy", slider: synergyBiasSlider, label: synergyBiasValue }
];

for (const { role, slider, label } of ROLE_BIAS_SLIDERS) {
  if (!slider) continue;
  slider.addEventListener("input", () => {
    setRoleBiasSliderValue(role, slider.value);
    if (label) label.textContent = slider.value;
  });
}
```

- [ ] **Step 5: Add layout rules to `style.css`**

Append to the end of `style.css`:

```css
.role-bias-slider {
  display: flex;
  flex-direction: column;
  margin-bottom: 10px;
}

.role-bias-slider label {
  margin-top: 0;
  margin-bottom: 4px;
  font-weight: 600;
}

input[type="range"] {
  width: 100%;
}
```

- [ ] **Step 6: Manual check (markup only, no behavior yet)**

Open `index.html` directly in a browser (`open index.html` or equivalent). The new "Role Priority" panel will not be visible yet — it's still `hidden` and nothing shows it. This is expected; Task 6 wires visibility. Confirm only that there are no console errors on load (open devtools, check the console is clean) — a typo in any of the new element IDs between `index.html` and `js/dom.js` would otherwise surface silently as `null` dereferences later.

- [ ] **Step 7: Commit**

```bash
git add js/state.js js/dom.js index.html style.css js/ui/role-bias.js
git commit -m "Add role-priority slider UI (not yet wired to the build pipeline)"
```

---

### Task 6: Wire Rebuild and panel visibility into `main.js`

**Files:**
- Modify: `js/main.js` (three spots: `generateDeck`'s reset block, `performBuildFromContext`, and the event-listener block at the bottom)

**Interfaces:**
- Consumes: `getRoleBias()` (Task 5, `state.js`), `applyRoleBias`/bias-aware `getModePreferences`/`scoreCard`/`scoreFallbackCard` (Tasks 1-4), `roleBiasControls`/`rebuildBtn` (Task 5, `dom.js`), and the existing `runRegeneration()` function (already in `main.js`).
- Produces: nothing new — this task only adds call sites.

- [ ] **Step 1: Show/hide the panel alongside the existing post-build panels**

In `js/main.js`, in `generateDeck()`'s reset block (currently lines 60-61):

```javascript
  document.getElementById("postBuildControls").classList.add("hidden");
  document.getElementById("buildModeControls").classList.add("hidden");
```

add a third line directly after:

```javascript
  if (roleBiasControls) roleBiasControls.classList.add("hidden");
```

In the success path (currently lines 208-209, right after `await performBuildFromContext();`):

```javascript
  document.getElementById("postBuildControls").classList.remove("hidden");
  document.getElementById("buildModeControls").classList.remove("hidden");
```

add a third line:

```javascript
  if (roleBiasControls) roleBiasControls.classList.remove("hidden");
```

In the `catch` block (currently lines 213-214):

```javascript
  document.getElementById("postBuildControls").classList.add("hidden");
  document.getElementById("buildModeControls").classList.add("hidden");
```

add a third line:

```javascript
  if (roleBiasControls) roleBiasControls.classList.add("hidden");
```

- [ ] **Step 2: Pass the staged role bias into scoring/building**

In `js/main.js`, inside `performBuildFromContext` (currently line 283):

```javascript
  const modePrefs = getModePreferences(getCurrentBuildMode(), strategyProfile);
```

replace with:

```javascript
  const modePrefs = getModePreferences(getCurrentBuildMode(), strategyProfile, getRoleBias());
```

- [ ] **Step 3: Wire the Rebuild button**

In `js/main.js`, in the event-listener block at the bottom of the file, immediately after the existing `minimalBuildToggle` listener (currently lines 590-594):

```javascript
if (minimalBuildToggle) {
  minimalBuildToggle.addEventListener("click", () => {
    toggleMinimalBuild();
  });
}
```

add:

```javascript
if (rebuildBtn) {
  rebuildBtn.addEventListener("click", () => {
    runRegeneration();
  });
}
```

(No `currentRunContext` guard needed here beyond what `runRegeneration()`/`performBuildFromContext` already assume — the Rebuild button only becomes visible once `roleBiasControls` is un-hidden, which only happens after a successful `generateDeck()` run that set `currentRunContext`.)

- [ ] **Step 4: Manual end-to-end check**

1. Open `index.html` in a browser.
2. Enter a legal commander name and upload a ManaBox CSV (or any CSV the app accepts) — use whatever fixture data is already used for manual checks in this repo (see `dev/tools/jxa-harness/owned_raw.json` / `dev/tools/jxa-harness/prefetch_data.json` for sample data if no real CSV is at hand).
3. Click **Generate Deck**. Confirm the "Role Priority" panel now appears alongside "Regenerate With Different Priorities" and "Build Mode", all five sliders show `5`.
4. Drag the **Wipes** slider to `0`. Confirm the deck does **not** change yet (dragging alone must not rebuild).
5. Click **Rebuild**. Confirm: the deck regenerates (progress bar/status text updates same as clicking a theme-priority button), and the Support Package panel (`displaySupportPackage`) now shows 0 board wipes where it previously showed a nonzero count (assuming the collection owns at least one wipe effect — pick a commander/collection combination known to draft at least one wipe at default settings first, to make the before/after comparison meaningful).
6. Drag **Wipes** back to `10` and click Rebuild again. Confirm the wipe count in the Support Package panel is now higher than the default-settings run (bounded by how many wipe effects are actually owned and legal — if the collection only owns one, the count may still be 1; re-run with a slider at `10` on a role where the collection owns several copies, e.g. **Draw**, if wipes alone don't demonstrate the increase).
7. Click a theme-priority button (or the Minimal Build toggle) after adjusting sliders. Confirm it still works and the slider panel stays visible and keeps its dragged values (regeneration must not reset the sliders).
8. Check the browser console throughout for errors — none expected.

- [ ] **Step 5: Run the full existing JXA suite once more to confirm no regressions**

Run each test file in `dev/tests/jxa/` with its known dependencies (see each file's own history / the commands used in Tasks 1-4 above for the pattern) — at minimum re-run:

```bash
dev/tests/jxa/run.sh js/constants.js js/utils/text.js js/utils/cards.js js/format.js js/analysis/pairing.js js/collection/csv.js js/analysis/themes.js js/analysis/scoring.js js/utils/deck-stats.js js/build/bracket.js js/build/manabase.js js/build/type-plan.js js/build/deck.js dev/tests/jxa/deck.test.js
dev/tests/jxa/run.sh js/analysis/themes.js dev/tests/jxa/mode-prefs.test.js
dev/tests/jxa/run.sh js/analysis/themes.js js/analysis/scoring.js dev/tests/jxa/scoring.test.js
dev/tests/jxa/run.sh js/utils/deck-stats.js dev/tests/jxa/deck-stats.test.js
```

Expected: `SUITE OK` on every line, no `FAIL`.

- [ ] **Step 6: Commit**

```bash
git add js/main.js
git commit -m "Wire role-priority sliders and Rebuild button into the build pipeline"
```
