# Curve First Build Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a personal, owner-only "Curve First" toggle that caps ramp, boosts draw and cheap removal, and suppresses board wipes in the deck the builder produces — without a banner link, without touching the two existing modes' default behavior, and with minimal duplicated code.

**Architecture:** Follows the existing "Minimal Build" toggle's exact shape: a boolean in `js/state.js`, folded into the pipe-joined mode string `getCurrentBuildMode()` builds, surfaced as `modePrefs.curveFirst` by `getModePreferences()`, and consulted at two narrow points already proven to carry the deck's shape — the role-target numbers (`js/utils/deck-stats.js`'s `normalizeRoleTargets`, which already single-handedly drives role-bucket sizing, land count, and curve-share shifting downstream) and the two card-scoring functions (`js/analysis/scoring.js`). Investigation during planning found this surface is much narrower than the original brainstorm assumed — no new scoring pipeline or forked files are needed, just a handful of `modePrefs`-gated additions in already-existing extension points. No new mode, no banner, no page.

**Tech Stack:** Plain global-scope JS (no modules/bundler), static HTML, JXA-based test harness (`dev/tests/jxa/run.sh`, runs under `osascript -l JavaScript`, not Node).

**Spec:** `dev/docs/superpowers/specs/2026-10-12-curve-first-build-mode-theorycraft.md`

## Global Constraints

- Personal toggle only — no banner link, no second HTML page, not advertised to other users.
- No module system: add `<script>` tags to both `index.html` and `pauper.html` in the same position if any new file is created (none is, in this plan — all changes land in existing files).
- Favor small `modePrefs`-gated branches inside existing shared functions over forking/duplicating files, since investigation showed the real change surface (role-target numbers, two scoring functions) is narrow.
- Tests for `js/` behavior run via `dev/tests/jxa/run.sh <source files...> <test file>` (JXA), never via `node` directly, per AGENTS.md.
- When a `js/` file is modified, keep its existing `Depends on:` header comment accurate if dependencies change (none of this plan's edits add a new dependency).

## Review Focus

- `modePrefs.curveFirst` is `undefined` for every build that isn't using this toggle (the normal and Pauper Commander paths never set it) — `applyCurveFirstRoleTargets` and the scoring branches must be no-ops in that case, not throw on `undefined`.
- A commander whose EDHREC/default role targets are already at or below the curve-first caps (e.g. `ramp: 2`, `wipe: 0`) must not have those targets raised by the override — it's a cap, not a floor-and-cap.
- Curve First combined with Minimal Build in the same mode string (`"minimal|curveFirst"`) — both flags must read independently off `modeParts.includes(...)` and apply together without one disabling the other.
- The Pauper Commander page (`pauper.html`) shares every `js/` file and has no EDHREC role-target data (its builds run through the Scryfall/collection-only fallback), so `normalizeRoleTargets` is already working from its hardcoded defaults (10/10/8/3) there — Curve First must still cap/boost correctly off those defaults, not only off EDHREC-sourced numbers.
- The toggle button's visual active state (`updateBuildModeToggle`) must reflect `getCurveFirstEnabled()` immediately after a click, the same way the existing Minimal Build button does — a stale class here would make the owner unsure whether the toggle is on.

---

### Task 1: Curve First mode toggle plumbing

**Files:**
- Modify: `js/state.js:18-29` (add alongside the existing Minimal Build state)
- Modify: `js/ui/status.js:121-132` (`getCurrentBuildMode`, `updateBuildModeToggle`)
- Modify: `js/analysis/themes.js:470-486` (`getModePreferences`)
- Modify: `index.html:78`, `pauper.html:78` (new toggle button, same line in both)
- Modify: `js/main.js:257-261` (new `toggleCurveFirst`), `js/main.js:590-594` (click listener)
- Test: `dev/tests/jxa/mode-prefs.test.js`

**Interfaces:**
- Produces: `modePrefs.curveFirst` (boolean), read by Task 2 and Task 3.
- Produces: `getCurveFirstEnabled(): boolean` / `setCurveFirstEnabled(enabled: boolean): void`, used only by `main.js`'s toggle handler.

- [ ] **Step 1: Write the failing tests**

Add to `dev/tests/jxa/mode-prefs.test.js`, inside the existing `runSuite("mode-prefs", { ... })` object (add a comma after the last existing test and insert these before the closing `}`):

```js
  "getModePreferences: curveFirst is false for an empty mode": function () {
    const prefs = getModePreferences("", { wantsCreatures: false });
    assertEqual(prefs.curveFirst, false);
  },

  "getModePreferences: curveFirst is true when mode is exactly \"curveFirst\"": function () {
    const prefs = getModePreferences("curveFirst", { wantsCreatures: false });
    assertEqual(prefs.curveFirst, true);
  },

  "getModePreferences: curveFirst combines with minimalBuild via the pipe-joined mode string": function () {
    const prefs = getModePreferences("minimal|curveFirst", { wantsCreatures: false });
    assertEqual(prefs.minimalBuild, true);
    assertEqual(prefs.curveFirst, true);
  }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dev/tests/jxa/run.sh js/utils/cards.js js/constants.js js/collection/csv.js js/utils/text.js js/format.js js/analysis/themes.js dev/tests/jxa/mode-prefs.test.js`
Expected: FAIL — `prefs.curveFirst` is `undefined`, not `false`/`true`.

- [ ] **Step 3: Implement `getModePreferences`**

In `js/analysis/themes.js`, in the object `getModePreferences` returns (around line 476), add a line next to `minimalBuild`:

```js
    minimalBuild: modeParts.includes("minimal"),
    curveFirst: modeParts.includes("curveFirst"),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `dev/tests/jxa/run.sh js/utils/cards.js js/constants.js js/collection/csv.js js/utils/text.js js/format.js js/analysis/themes.js dev/tests/jxa/mode-prefs.test.js`
Expected: PASS

- [ ] **Step 5: Wire the toggle state, UI, and build-mode string**

In `js/state.js`, immediately after the existing `setMinimalBuildEnabled` function (after line 29):

```js
// Curve First mode: a personal preference toggle (not a public format) that
// caps ramp and board wipes and boosts draw/removal targets. See
// dev/docs/superpowers/specs/2026-10-12-curve-first-build-mode-theorycraft.md.
let curveFirstEnabled = false;

function getCurveFirstEnabled() {
  return curveFirstEnabled;
}

function setCurveFirstEnabled(enabled) {
  curveFirstEnabled = Boolean(enabled);
}
```

In `js/ui/status.js`, replace `getCurrentBuildMode` and `updateBuildModeToggle` (lines 121-132) with:

```js
function getCurrentBuildMode() {
  const parts = [];
  const currentThemeFocus = getCurrentThemeFocus();
  if (currentThemeFocus) parts.push(`theme:${currentThemeFocus}`);
  if (getMinimalBuildEnabled()) parts.push("minimal");
  if (getCurveFirstEnabled()) parts.push("curveFirst");
  return parts.join("|");
}

function updateBuildModeToggle() {
  const toggle = document.getElementById("minimalBuildToggle");
  if (toggle) toggle.classList.toggle("active", getMinimalBuildEnabled());
  const curveFirstToggle = document.getElementById("curveFirstToggle");
  if (curveFirstToggle) curveFirstToggle.classList.toggle("active", getCurveFirstEnabled());
}
```

In both `index.html:78` and `pauper.html:78`, add a second button right after the existing one (same line/position in both files, per AGENTS.md's "add in the same position" rule for shared markup):

```html
        <button id="minimalBuildToggle" type="button" class="mode-toggle-btn">Minimal Build</button>
        <button id="curveFirstToggle" type="button" class="mode-toggle-btn">Curve First</button>
```

In `js/main.js`, immediately after `toggleMinimalBuild` (after line 261):

```js
async function toggleCurveFirst() {
  if (!currentRunContext) return;
  setCurveFirstEnabled(!getCurveFirstEnabled());
  await runRegeneration();
}
```

In `js/main.js`, immediately after the existing `minimalBuildToggle` listener block (after line 594):

```js
const curveFirstToggle = document.getElementById("curveFirstToggle");
if (curveFirstToggle) {
  curveFirstToggle.addEventListener("click", () => {
    toggleCurveFirst();
  });
}
```

- [ ] **Step 6: Manually verify the toggle in-browser**

Open `index.html` (or serve the directory and open it), build any deck, click the new "Curve First" button, and confirm: the button gains the `active` class/highlight the same way "Minimal Build" does, and the deck regenerates (progress bar/status text updates). This step has no automated test — the toggle is pure DOM wiring with no logic yet behind it (Tasks 2-3 add the actual effect).

- [ ] **Step 7: Commit**

```bash
git add js/state.js js/ui/status.js js/analysis/themes.js index.html pauper.html js/main.js dev/tests/jxa/mode-prefs.test.js
git commit -m "Add Curve First mode toggle (plumbing only, no scoring effect yet)"
```

---

### Task 2: Curve First role-target override

**Files:**
- Modify: `js/utils/deck-stats.js:44-54` (add `applyCurveFirstRoleTargets` after `normalizeRoleTargets`)
- Modify: `js/build/deck.js:244`
- Test: Create `dev/tests/jxa/deck-stats.test.js`

**Interfaces:**
- Consumes: `targets: {ramp: number, draw: number, removal: number, wipe: number}` (the shape `normalizeRoleTargets` already returns), `modePrefs: {curveFirst?: boolean}` (from Task 1).
- Produces: `applyCurveFirstRoleTargets(targets, modePrefs): {ramp, draw, removal, wipe}` — same shape, consumed by `buildRoleTargetPlan` and `adjustCurveShares` at `js/build/deck.js:305,308` with no signature change to either.

- [ ] **Step 1: Write the failing tests**

Create `dev/tests/jxa/deck-stats.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dev/tests/jxa/run.sh js/utils/deck-stats.js dev/tests/jxa/deck-stats.test.js`
Expected: FAIL — `applyCurveFirstRoleTargets is not defined`.

- [ ] **Step 3: Implement `applyCurveFirstRoleTargets`**

In `js/utils/deck-stats.js`, immediately after `normalizeRoleTargets` (after line 54):

```js
// Curve First mode (a personal toggle, not a public format -- see
// dev/docs/superpowers/specs/2026-10-12-curve-first-build-mode-theorycraft.md):
// caps ramp and wipes, and redirects that reclaimed deck space into draw
// (to offset the natural -1 card/turn attrition) and removal (cheap,
// targeted interaction over board resets). A cap, not a floor -- a
// commander whose own targets are already lower is left alone.
function applyCurveFirstRoleTargets(targets, modePrefs) {
  if (!modePrefs?.curveFirst) return targets;

  const RAMP_CAP = 4;
  const WIPE_CAP = 1;
  const DRAW_BOOST = 4;
  const REMOVAL_BOOST = 4;

  return {
    ramp: Math.min(targets.ramp, RAMP_CAP),
    draw: targets.draw + DRAW_BOOST,
    removal: targets.removal + REMOVAL_BOOST,
    wipe: Math.min(targets.wipe, WIPE_CAP)
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `dev/tests/jxa/run.sh js/utils/deck-stats.js dev/tests/jxa/deck-stats.test.js`
Expected: PASS

- [ ] **Step 5: Wire it into the build**

In `js/build/deck.js:244`, change:

```js
  const roleTargets = normalizeRoleTargets(edhrecRoleTargets);
```

to:

```js
  const roleTargets = applyCurveFirstRoleTargets(normalizeRoleTargets(edhrecRoleTargets), modePrefs);
```

(`modePrefs` is already a parameter of `buildDeckFromScoredPool`, in scope at this line — no signature change needed.)

- [ ] **Step 6: Run the existing deck.js suite to confirm no regression**

Run: `dev/tests/jxa/run.sh js/utils/cards.js js/constants.js js/collection/csv.js js/utils/text.js js/format.js js/analysis/themes.js js/analysis/scoring.js js/utils/deck-stats.js js/build/type-plan.js js/build/manabase.js js/build/deck.js dev/tests/jxa/deck.test.js`
Expected: PASS (same results as before this task — `modePrefs.curveFirst` is absent/falsy in every existing test, so `applyCurveFirstRoleTargets` is a no-op there).

- [ ] **Step 7: Commit**

```bash
git add js/utils/deck-stats.js js/build/deck.js dev/tests/jxa/deck-stats.test.js
git commit -m "Add Curve First role-target override (ramp/wipe caps, draw/removal boosts)"
```

---

### Task 3: Cheap-removal scoring bonus

**Files:**
- Modify: `js/analysis/scoring.js:858-861` (`scoreCard`'s `roleBonus` block)
- Modify: `js/analysis/scoring.js:905-908` (`scoreFallbackCard`'s `score` role block)
- Test: `dev/tests/jxa/scoring.test.js`

**Interfaces:**
- Consumes: `role: string` (from `detectRole`, already computed in both functions), `card.cmc: number`, `modePrefs.curveFirst: boolean`.
- No new exported interface — this changes the return value of `scoreCard`/`scoreFallbackCard` only when `modePrefs.curveFirst` is true.

- [ ] **Step 1: Write the failing test**

Add to `dev/tests/jxa/scoring.test.js`, inside the existing `runSuite("scoring", { ... })` object (add a comma after the last existing test and insert before the closing `}`):

```js
  "scoreFallbackCard: curveFirst adds a cheap-removal bonus for 2-CMC-or-less removal": function () {
    const cheapRemoval = { type: "Instant", text: "Destroy target creature.", cmc: 1 };
    const strategyProfile = { wantsCreatures: false, wantsTokens: false, wantsSacrifice: false, wantsGoWide: false, wantsTribal: false, tribalTypes: [] };
    const commanderColors = ["W"];
    const commanderThemes = [];

    const normalModePrefs = getModePreferences("", strategyProfile);
    const curveFirstModePrefs = getModePreferences("curveFirst", strategyProfile);

    const normalScore = scoreFallbackCard(cheapRemoval, commanderThemes, strategyProfile, commanderColors, normalModePrefs);
    const curveFirstScore = scoreFallbackCard(cheapRemoval, commanderThemes, strategyProfile, commanderColors, curveFirstModePrefs);

    assertClose(curveFirstScore - normalScore, 4, 0.001, "expected exactly the +4 cheap-removal bonus under curveFirst");
  },

  "scoreFallbackCard: curveFirst does not bonus removal costing more than 2": function () {
    const expensiveRemoval = { type: "Sorcery", text: "Destroy target creature.", cmc: 5 };
    const strategyProfile = { wantsCreatures: false, wantsTokens: false, wantsSacrifice: false, wantsGoWide: false, wantsTribal: false, tribalTypes: [] };
    const commanderColors = ["W"];
    const commanderThemes = [];

    const normalModePrefs = getModePreferences("", strategyProfile);
    const curveFirstModePrefs = getModePreferences("curveFirst", strategyProfile);

    const normalScore = scoreFallbackCard(expensiveRemoval, commanderThemes, strategyProfile, commanderColors, normalModePrefs);
    const curveFirstScore = scoreFallbackCard(expensiveRemoval, commanderThemes, strategyProfile, commanderColors, curveFirstModePrefs);

    assertClose(curveFirstScore - normalScore, 0, 0.001, "expensive removal should score the same under curveFirst");
  }
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `dev/tests/jxa/run.sh js/utils/cards.js js/constants.js js/collection/csv.js js/utils/text.js js/format.js js/analysis/edhrec.js js/analysis/themes.js js/analysis/scoring.js dev/tests/jxa/scoring.test.js`
Expected: FAIL — the first new test's delta is `0`, not `4` (no curveFirst branch exists yet).

- [ ] **Step 3: Implement the bonus in both scoring functions**

In `js/analysis/scoring.js`, in `scoreCard`, change (around line 858-861):

```js
  if (role === "ramp") roleBonus = 4;
  else if (role === "draw") roleBonus = 4;
  else if (role === "removal") roleBonus = 4;
  else if (role === "wipe") roleBonus = 3;
```

to:

```js
  if (role === "ramp") roleBonus = 4;
  else if (role === "draw") roleBonus = 4;
  else if (role === "removal") roleBonus = 4;
  else if (role === "wipe") roleBonus = 3;

  // Curve First mode: cheap removal leaves mana free to develop the board or
  // hold up a second response in the same turn, so it outranks removal that
  // costs the whole turn -- see the spec linked from applyCurveFirstRoleTargets.
  if (modePrefs.curveFirst && role === "removal" && card.cmc <= 2) roleBonus += 4;
```

In `js/analysis/scoring.js`, in `scoreFallbackCard`, change (around line 905-908):

```js
  const role = detectRole(card, isActiveBuildTribal(strategyProfile, modePrefs));
  if (role === "ramp") score += 4;
  else if (role === "draw") score += 4;
  else if (role === "removal") score += 4;
  else if (role === "wipe") score += 3;
```

to:

```js
  const role = detectRole(card, isActiveBuildTribal(strategyProfile, modePrefs));
  if (role === "ramp") score += 4;
  else if (role === "draw") score += 4;
  else if (role === "removal") score += 4;
  else if (role === "wipe") score += 3;

  if (modePrefs.curveFirst && role === "removal" && card.cmc <= 2) score += 4;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `dev/tests/jxa/run.sh js/utils/cards.js js/constants.js js/collection/csv.js js/utils/text.js js/format.js js/analysis/edhrec.js js/analysis/themes.js js/analysis/scoring.js dev/tests/jxa/scoring.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/analysis/scoring.js dev/tests/jxa/scoring.test.js
git commit -m "Add Curve First cheap-removal scoring bonus"
```

---

### Task 4: Offline harness verification

**Files:**
- Create: `dev/tools/jxa-harness/compare_curve_first.js` (adapted from the then-existing `compare_minimal_mode.js`, since removed)

**Interfaces:**
- None — this is a manual/ad-hoc verification driver, not part of the committed `dev/tests/jxa` suite (matching `compare_minimal_mode.js`'s own stated role).

- [ ] **Step 1: Copy and adapt the existing comparison driver**

Copy `dev/tools/jxa-harness/compare_minimal_mode.js` to `dev/tools/jxa-harness/compare_curve_first.js`. Update its header comment to describe the new purpose, and change every place it builds a deck with `mode: "minimal"` (or equivalent) to `mode: "curveFirst"` instead. Change its final report section to print, for both the default-mode and curveFirst-mode builds of the same sample commander: the actual ramp/draw/removal/wipe counts in the finished deck (via `getSupportPackageCounts`, already used elsewhere in the codebase per `js/utils/deck-stats.js`) and the average mana value (via `averageManaValue`, same file).

- [ ] **Step 2: Run it**

Run: `cat dev/tools/jxa-harness/combined.js dev/tools/jxa-harness/compare_curve_first.js > /tmp/run.js && osascript -l JavaScript /tmp/run.js`

- [ ] **Step 3: Confirm the directional expectations hold for at least one real commander**

Check the printed output: curveFirst's ramp count is at or below 4, wipe count is at or below 1, draw and removal counts are higher than the default-mode build, and average mana value is equal or lower. If any of these don't hold for the sample commander tried, note why in a commit message comment or a line in the spec doc's Open Questions section — don't silently treat a surprising result as success.

- [ ] **Step 4: Commit**

```bash
git add dev/tools/jxa-harness/compare_curve_first.js
git commit -m "Add offline harness comparison script for Curve First mode"
```
