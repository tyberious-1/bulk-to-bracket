# Pauper Commander (PDH) Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a second static entry point, `pauper.html`, that builds Pauper Commander (PDH) decks — commander is any uncommon creature, every other card must be common rarity — reusing the existing build pipeline's EDHREC-less fallback path, with a banner link between it and `index.html`.

**Architecture:** A single mutable format flag (`js/format.js`) that `index.html` never touches (stays `"commander"`) and `pauper.html` sets once at load. Every place in the shared pipeline that already gates "is this card legal" or "can this card be the commander" is made to consult that flag; nothing else changes. `main.js` stays one shared file — its EDHREC fetch becomes conditional, falling through to the "Collection Fallback" path that already exists for any commander EDHREC has no data for.

**Tech Stack:** Plain global-scope JS, no build step, no modules (see `AGENTS.md`). Tests run under `osascript -l JavaScript` via `dev/tests/jxa/run.sh`.

**Spec:** `dev/docs/superpowers/specs/2026-10-06-pauper-commander-page-design.md`

## Global Constraints

- No PDHREC data integration of any kind (API or scraping) — Scryfall + local collection heuristics only.
- No new scoring/theme-detection logic — `detectCommanderThemes`'s existing local-keyword fallback path is reused verbatim.
- No change to deck size (99+1 / 98+2), Minimal Build, bracket estimation, or any other build-mode mechanic — format only gates commander eligibility, card-pool legality, and whether EDHREC is fetched at all.
- Same ManaBox CSV upload and `js/cache.js` localStorage cache — no new collection format.
- `canBePauperCommander` checks rarity `"uncommon"` AND front-face type line includes `"creature"` only — no `COMMANDER_PERMITTED_SUBTYPES` (vehicle/spacecraft), no `"can be your commander"` text escape hatch.
- `legalForCommander`'s rarity check applies only when the pauper format is active; default format (`"commander"`) must be byte-identical to current behavior — the entire existing JXA suite must keep passing unmodified throughout this plan.
- Full 4-tab parity (Build, Your Commanders, Theme/Tribal, Collection Analytics) and partner-commander support are both in scope for `pauper.html`.

## Review Focus

- A card with no `rarity` field at all (stale pre-migration cache entry, incomplete payload) must be treated as pauper-illegal, not silently legal — fail closed, not open.
- A legendary creature that is also uncommon must still be accepted as a pauper commander — legendary-ness is irrelevant to PDH's rule; `canBePauperCommander` must not key off "legendary" anywhere.
- A double-faced card whose back face says "creature" but front face doesn't (or vice versa) must be judged on the front face only, matching `canBeCommander`'s existing DFC handling.
- A commons-only fallback pool that runs dry for a role (sparse pauper-legal collection) must degrade the same way the existing exhaustion path does — stop asking, no crash, no accidental non-common slipping through.
- A partner pair where the primary passes `canBeActiveCommander` but the partner does not (common rarity, or not a creature) must be rejected — today `resolveCommanders` only calls `isLegalCommanderPair(primary, partner)` for the second commander, never an eligibility check on the partner itself.

---

### Task 1: Capture card rarity in Scryfall conversion

**Files:**
- Modify: `js/api/scryfall.js:40-63` (`convertScryfallCard`)
- Test: `dev/tests/jxa/scryfall.test.js` (new)

**Interfaces:**
- Produces: converted card objects now carry `rarity` (lowercased string, e.g. `"common"`, `"uncommon"`, `"rare"`, `"mythic"`), consumed by Task 2's `canBePauperCommander`/`legalForCommander`.

- [ ] **Step 1: Write the failing test**

Create `dev/tests/jxa/scryfall.test.js`:

```js
runSuite("scryfall", {
  "convertScryfallCard: captures rarity, lowercased": function () {
    const card = convertScryfallCard({ name: "Llanowar Elves", type_line: "Creature — Elf Druid", rarity: "Common", cmc: 1, color_identity: ["G"] });
    assertEqual(card.rarity, "common");
  },

  "convertScryfallCard: missing rarity falls back to empty string, not undefined": function () {
    const card = convertScryfallCard({ name: "Test Card", type_line: "Sorcery", cmc: 1, color_identity: [] });
    assertEqual(card.rarity, "");
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dev/tests/jxa/run.sh js/constants.js js/utils/text.js js/utils/cards.js js/api/scryfall.js dev/tests/jxa/scryfall.test.js`
Expected: FAIL — `card.rarity` is `undefined`, not `"common"`/`""`.

- [ ] **Step 3: Write minimal implementation**

In `js/api/scryfall.js`, inside `convertScryfallCard`'s returned object (after the `colors` field):

```js
    colors: Array.isArray(data.color_identity) ? data.color_identity : [],
    rarity: String(data.rarity || "").toLowerCase(),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `dev/tests/jxa/run.sh js/constants.js js/utils/text.js js/utils/cards.js js/api/scryfall.js dev/tests/jxa/scryfall.test.js`
Expected: PASS, 2 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add js/api/scryfall.js dev/tests/jxa/scryfall.test.js
git commit -m "Capture card rarity when converting Scryfall payloads"
```

---

### Task 2: Format switch, pauper commander eligibility, rarity-aware legality

**Files:**
- Create: `js/format.js`
- Modify: `js/utils/cards.js:89-112` (`legalForCommander`, add `canBePauperCommander`)
- Test: `dev/tests/jxa/format.test.js` (new)

**Interfaces:**
- Consumes: nothing new (uses `getCardType` from `js/utils/cards.js`, already loaded).
- Produces: `setActiveFormat(format)`, `isPauperFormat()`, `canBeActiveCommander(card)` (all in `js/format.js`); `canBePauperCommander(card)` and the updated `legalForCommander(cardColors, commanderColors, card)` (3rd param optional) in `js/utils/cards.js`. Task 4 depends on the new `legalForCommander` signature; Task 6 depends on `canBeActiveCommander`; Task 9 depends on `setActiveFormat`.

- [ ] **Step 1: Write the failing tests**

Create `dev/tests/jxa/format.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dev/tests/jxa/run.sh js/constants.js js/utils/text.js js/utils/cards.js js/format.js dev/tests/jxa/format.test.js`
Expected: FAIL — `js/format.js` doesn't exist yet (concatenation will error), and `canBePauperCommander`/`setActiveFormat`/`canBeActiveCommander` are undefined.

- [ ] **Step 3: Write minimal implementation**

Create `js/format.js`:

```js
// The active deck format. Everything else in the pipeline that gates card
// or commander legality consults this flag rather than knowing about
// formats itself -- index.html never calls setActiveFormat, so it stays
// "commander" and every format-aware check below is a no-op for the
// existing app.
//
// Depends on: cards.js

let activeFormat = "commander"; // or "pauperCommander"

function setActiveFormat(format) {
  activeFormat = format;
}

function isPauperFormat() {
  return activeFormat === "pauperCommander";
}

function canBeActiveCommander(card) {
  return isPauperFormat() ? canBePauperCommander(card) : canBeCommander(card);
}
```

In `js/utils/cards.js`, replace the existing `legalForCommander` and add `canBePauperCommander` right after `canBeCommander`:

```js
function legalForCommander(cardColors, commanderColors, card) {
  for (const color of cardColors) {
    if (!commanderColors.includes(color)) return false;
  }
  if (isPauperFormat() && card && card.rarity !== "common") return false;
  return true;
}
```

```js
// Pauper Commander (PDH): any uncommon creature, legendary or not. No
// COMMANDER_PERMITTED_SUBTYPES escape hatch and no "can be your commander"
// text rule -- PDH's own rule is literally "any uncommon creature."
function canBePauperCommander(card) {
  const frontType = getCardType(card).split("//")[0];
  return card?.rarity === "uncommon" && frontType.includes("creature");
}
```

Update the file's header dependency comment (`// Depends on: constants.js, text.js`) to add `format.js` — `legalForCommander` now calls `isPauperFormat()` at runtime, so `format.js` must have executed (any point before a build runs, not before `cards.js` parses) before this is called.

- [ ] **Step 4: Run test to verify it passes**

Run: `dev/tests/jxa/run.sh js/constants.js js/utils/text.js js/utils/cards.js js/format.js dev/tests/jxa/format.test.js`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add js/format.js js/utils/cards.js dev/tests/jxa/format.test.js
git commit -m "Add format switch, Pauper Commander eligibility, and rarity-aware legality"
```

---

### Task 3: Wire the format switch into the real app's load order

**Files:**
- Modify: `index.html:161-163` (script list)
- Modify: `dev/tools/jxa-harness/build_harness.sh` (script list, so the offline harness stays representative)

**Interfaces:**
- Consumes: `js/format.js` from Task 2.
- Produces: nothing new — this task only makes the existing app load the file Task 2 created, with zero behavior change (format stays `"commander"`).

- [ ] **Step 1: Add the script tag**

In `index.html`, after `<script src="js/utils/cards.js"></script>`:

```html
  <script src="js/constants.js"></script>
  <script src="js/utils/text.js"></script>
  <script src="js/utils/cards.js"></script>
  <script src="js/format.js"></script>
  <script src="js/analysis/pairing.js"></script>
```

- [ ] **Step 2: Regenerate the offline harness**

In `dev/tools/jxa-harness/build_harness.sh`, add `js/format.js` to the `scripts` array in the same position (after `js/utils/cards.js`):

```bash
scripts=(
  js/constants.js
  js/utils/text.js
  js/utils/cards.js
  js/format.js
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
```

Run: `bash dev/tools/jxa-harness/build_harness.sh`
Expected: `wrote dev/tools/jxa-harness/combined.js` with no errors.

- [ ] **Step 3: Run the full existing JXA suite to confirm zero regression**

Run each (all must still report `SUITE OK`, identical pass counts to before this plan started):

```bash
dev/tests/jxa/run.sh js/constants.js js/utils/text.js js/utils/cards.js js/analysis/themes.js js/analysis/scoring.js dev/tests/jxa/scoring.test.js
dev/tests/jxa/run.sh js/constants.js js/utils/text.js js/utils/cards.js js/collection/csv.js js/analysis/themes.js js/analysis/scoring.js js/build/manabase.js dev/tests/jxa/manabase.test.js
dev/tests/jxa/run.sh js/utils/deck-stats.js js/utils/text.js js/analysis/themes.js js/build/type-plan.js dev/tests/jxa/type-plan.test.js
dev/tests/jxa/run.sh js/utils/cards.js js/utils/deck-stats.js js/utils/text.js js/analysis/themes.js js/build/bracket.js dev/tests/jxa/bracket.test.js
dev/tests/jxa/run.sh js/utils/text.js js/analysis/themes.js dev/tests/jxa/mode-prefs.test.js
dev/tests/jxa/run.sh dev/tests/jxa/smoke.test.js
```

Expected: every suite's pass/fail counts match what they reported before Task 1 (no file in this list was touched in a way that changes their behavior — `js/utils/cards.js` gained `canBePauperCommander` and a new 3rd param on `legalForCommander` that nothing in these suites exercises yet).

Note: `dev/tests/jxa/deck.test.js` is NOT run through the standalone `js/build/deck.js` dependency list here because Task 4 hasn't wired `card` through its call site yet — run it too, same expectation (no change):

```bash
dev/tests/jxa/run.sh js/constants.js js/utils/text.js js/utils/cards.js js/collection/csv.js js/api/http.js js/api/edhrec.js js/analysis/themes.js js/analysis/scoring.js js/utils/deck-stats.js js/build/manabase.js js/build/type-plan.js js/build/deck.js dev/tests/jxa/deck.test.js
```

- [ ] **Step 4: Commit**

```bash
git add index.html dev/tools/jxa-harness/build_harness.sh dev/tools/jxa-harness/combined.js
git commit -m "Load the format switch in the real app and offline harness"
```

---

### Task 4: Thread card rarity through every legality check site

**Files:**
- Modify: `js/main.js:338,366`
- Modify: `js/analysis/commander-match.js:118`
- Modify: `js/build/deck.js:218`
- Modify: `js/build/manabase.js:639`
- Modify: `js/analysis/themes.js:267,604,645,827`

**Interfaces:**
- Consumes: `legalForCommander(cardColors, commanderColors, card)` from Task 2.
- Produces: nothing new — every existing caller of `legalForCommander` now passes its already-in-scope `card`, so the rarity gate from Task 2 actually applies everywhere a card's deck-legality is decided. No caller's behavior changes under the default `"commander"` format.

- [ ] **Step 1: Update `js/main.js`**

Two distinct call sites (not identical text, two separate edits):

```js
      if (!legalForCommander(card.colors, commanders.colors)) continue;
```
→
```js
      if (!legalForCommander(card.colors, commanders.colors, card)) continue;
```

and

```js
    if (!card || getCardType(card).includes("land") || !legalForCommander(card.colors, commanders.colors)) {
```
→
```js
    if (!card || getCardType(card).includes("land") || !legalForCommander(card.colors, commanders.colors, card)) {
```

- [ ] **Step 2: Update `js/analysis/commander-match.js`**

```js
    if (!legalForCommander(card.colors, commander.colors)) continue;
```
→
```js
    if (!legalForCommander(card.colors, commander.colors, card)) continue;
```

- [ ] **Step 3: Update `js/build/deck.js`**

```js
    if (!legalForCommander(card.colors, commanderColors)) continue;
```
→
```js
    if (!legalForCommander(card.colors, commanderColors, card)) continue;
```

- [ ] **Step 4: Update `js/build/manabase.js`**

```js
    if (!legalForCommander(card.colors, commanderColors)) continue;
```
→
```js
    if (!legalForCommander(card.colors, commanderColors, card)) continue;
```

- [ ] **Step 5: Update `js/analysis/themes.js` (all 4 occurrences at once)**

This file has the identical line `if (!legalForCommander(card.colors, commanderColors)) continue;` in four places (`detectCommanderThemes`, `findLocalThemeMatches`, `findThemeCandidates`'s Scryfall-tag pass, and the fingerprint-match pass) — every occurrence has a `card` variable in scope right above it, built by the same `allOwnedCardData.get(...)` pattern. Use a single find-and-replace-all across the file:

```js
    if (!legalForCommander(card.colors, commanderColors)) continue;
```
→ (all 4 occurrences)
```js
    if (!legalForCommander(card.colors, commanderColors, card)) continue;
```

- [ ] **Step 6: Syntax-check every modified file**

Run: `node --check js/main.js && node --check js/analysis/commander-match.js && node --check js/build/deck.js && node --check js/build/manabase.js && node --check js/analysis/themes.js`
Expected: no output, exit code 0.

- [ ] **Step 7: Run the full existing JXA suite again to confirm zero regression**

Same commands as Task 3 Step 3. Expected: identical pass/fail counts — every call site now passes `card`, but `isPauperFormat()` is false in every one of these tests (none of them call `setActiveFormat`), so `legalForCommander`'s new rarity branch never triggers.

- [ ] **Step 8: Regenerate the offline harness and commit**

```bash
bash dev/tools/jxa-harness/build_harness.sh
git add js/main.js js/analysis/commander-match.js js/build/deck.js js/build/manabase.js js/analysis/themes.js dev/tools/jxa-harness/combined.js
git commit -m "Thread card rarity through every legalForCommander call site"
```

---

### Task 5: Integration test — pauper format only ever drafts commons

**Files:**
- Modify: `dev/tests/jxa/deck.test.js`

**Interfaces:**
- Consumes: `setActiveFormat`/`isPauperFormat` (Task 2), rarity-aware `legalForCommander` reachable through `buildDeckFromScoredPool` (Task 4).
- Produces: nothing new — this is a pure test addition pinning Review Focus items 1 (fails closed on missing rarity doesn't apply here, already covered by Task 2) and 4 (sparse commons pool exhausts gracefully) at the integration level, through the real builder rather than the unit-level `legalForCommander` test from Task 2.

- [ ] **Step 1: Write the failing tests**

Extend `dev/tests/jxa/deck.test.js`. First, widen `makeCard` with an optional `rarity` parameter defaulting to `"common"` (every existing call site stays unchanged, since the new parameter is optional and defaults to the rarity all current fixture cards implicitly need):

```js
function makeCard(name, type, text, cmc, colors, rarity) {
  return { name, type, text, cmc, colors, manaCost: "", rawType: type, rawText: text, rarity: rarity || "common" };
}
```

Add two new fixture cards and a new test block at the end of the `runSuite("deck", {...})` call (add a trailing comma after the existing last test, `"buildDeckFromScoredPool: default build pads all the way to deckSize"`):

```js
const TEST_RARE_BOMB_CARD = makeCard("Test Rare Bomb", "creature — dragon", "destroy target creature. draw a card.", 5, ["G"], "rare");

function buildPauperFixture() {
  const commanderCard = makeCard(TEST_COMMANDER_NAME, "creature — treefolk", "", 4, ["G"], "uncommon");
  const ownedCards = [TEST_RAMP_CARD, TEST_DRAW_CARD, TEST_WIPE_CARD, TEST_RARE_BOMB_CARD, ...TEST_FILLER_CARDS];

  const allOwnedCardData = new Map();
  allOwnedCardData.set(normalizeCardName(commanderCard.name), commanderCard);
  for (const card of ownedCards) allOwnedCardData.set(normalizeCardName(card.name), card);

  const entries = ownedCards.map((card) => ({
    normalizedName: normalizeCardName(card.name),
    rawName: card.name,
    quantity: 1
  }));
  const collectionData = { entries };

  const commanderThemes = [];
  const strategyProfile = getCommanderStrategyProfile(TEST_COMMANDER_NAME, commanderThemes, ["G"]);
  const modePrefs = getModePreferences("minimal", strategyProfile);
  // removal's only owned candidate (TEST_RARE_BOMB_CARD) is rare, not common --
  // the pauper-format pool must exhaust rather than draft it.
  const roleTargets = { ramp: 1, draw: 1, removal: 1, wipe: 1 };

  setActiveFormat("pauperCommander");
  try {
    return buildDeckFromScoredPool(
      [],
      ["G"],
      collectionData,
      allOwnedCardData,
      commanderThemes,
      TEST_COMMANDER_NAME,
      modePrefs,
      null,
      roleTargets,
      [],
      { deckSize: 99, themeCardNames: new Map() }
    );
  } finally {
    setActiveFormat("commander");
  }
}
```

Then add the test cases:

```js
  "buildDeckFromScoredPool: pauper format never drafts a non-common card": function () {
    const finalDeck = buildPauperFixture();
    const nonCommons = finalDeck.filter((c) => c.role !== "land" && c.name === TEST_RARE_BOMB_CARD.name);
    assertEqual(nonCommons.length, 0);
  },

  "buildDeckFromScoredPool: pauper format exhausts gracefully when the only candidate for a role is non-common": function () {
    const finalDeck = buildPauperFixture();
    const hasRemoval = finalDeck.some((c) => (c.roles || []).includes("removal"));
    assertTrue(!hasRemoval, "expected no removal card -- the only owned removal candidate is rare, not common");
  }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dev/tests/jxa/run.sh js/constants.js js/utils/text.js js/utils/cards.js js/format.js js/collection/csv.js js/api/http.js js/api/edhrec.js js/analysis/themes.js js/analysis/scoring.js js/utils/deck-stats.js js/build/manabase.js js/build/type-plan.js js/build/deck.js dev/tests/jxa/deck.test.js`

Expected: FAIL on both new tests — `setActiveFormat`/`isPauperFormat` are undefined before this task includes `js/format.js` in the run command... wait, `js/format.js` IS in this command already (Task 2/3 created and wired it), so instead the failure should be: `TEST_RARE_BOMB_CARD` gets drafted (since Task 4's rarity threading isn't done — no, Task 4 already ran before this task). Re-check: if Tasks 1-4 are already complete when this task starts, the rarity gate is already live, so this test might pass immediately rather than fail. **Resolve this by running Step 2 before Task 4 lands the fix at this specific call site** — actually Task 4 precedes this task in the plan, so the gate is already wired by the time this test is written. Treat this as a regression-pinning test instead: run it once to confirm it's green (proving Task 4's wiring actually works end-to-end through the real builder, not just in Task 2's unit-level test), and if it's unexpectedly RED, that means Task 4 missed a call site — go back and find which one.

Expected outcome in practice: PASS immediately. If either test FAILS, `js/build/deck.js:218`'s `legalForCommander` call (Task 4 Step 3) isn't actually being reached for this fixture — re-check `TEST_RARE_BOMB_CARD`'s rarity field is being read (confirm `makeCard`'s new 6th parameter is wired correctly) before assuming Task 4 itself is wrong.

- [ ] **Step 3: Confirm it passes (and stays passing)**

Run the same command as Step 2.
Expected: PASS, all tests in the `deck` suite green, including the two new ones.

- [ ] **Step 4: Run the full existing JXA suite once more for final confirmation**

Same commands as Task 3 Step 3, plus the `deck.test.js` command above. Expected: all green, same counts as before this task.

- [ ] **Step 5: Commit**

```bash
git add dev/tests/jxa/deck.test.js
git commit -m "Add integration coverage: pauper format never drafts a non-common card"
```

---

### Task 6: Switch shared commander-eligibility checks to the format-aware wrapper

**Files:**
- Modify: `js/ui/theme-tab.js:238`
- Modify: `js/analysis/commander-match.js:78`
- Modify: `js/main.js` (`commanderAutocomplete`'s `isEligible`, `resolveCommanders`)

**Interfaces:**
- Consumes: `canBeActiveCommander` (Task 2).
- Produces: nothing new — `js/ui/theme-tab.js` and `js/analysis/commander-match.js` are shared between both pages (power the "Theme / Tribal" and "Your Commanders" tabs), so this is what makes those two tabs format-aware without any file split. `resolveCommanders` also gains a direct eligibility check on the partner commander (Review Focus item 5), tightening existing behavior for both formats.

- [ ] **Step 1: Update `js/ui/theme-tab.js`**

```js
    if (!card) continue;
    if (!canBeCommander(card)) continue;
    if (!hasTribalType(card, tribe)) continue;
```
→
```js
    if (!card) continue;
    if (!canBeActiveCommander(card)) continue;
    if (!hasTribalType(card, tribe)) continue;
```

- [ ] **Step 2: Update `js/analysis/commander-match.js`**

```js
    if (!card) continue;
    if (!canBeCommander(card)) continue;

    seen.add(normalizedName);
```
→
```js
    if (!card) continue;
    if (!canBeActiveCommander(card)) continue;

    seen.add(normalizedName);
```

- [ ] **Step 3: Update `js/main.js`'s `commanderAutocomplete`**

```js
const commanderAutocomplete = createNameAutocomplete({
  input: commanderInput,
  list: autocompleteList,
  isEligible: canBeCommander,
```
→
```js
const commanderAutocomplete = createNameAutocomplete({
  input: commanderInput,
  list: autocompleteList,
  isEligible: canBeActiveCommander,
```

- [ ] **Step 4: Update `js/main.js`'s `resolveCommanders`**

```js
async function resolveCommanders(primaryName, partnerName) {
  const primary = await getCommander(primaryName);
  if (!primary) throw new Error("Commander not found on Scryfall.");
  if (!canBeCommander(primary)) throw new Error("Selected card does not appear to be a legal commander.");

  if (!partnerName) {
    return {
      primary,
      partner: null,
      names: [primary.name],
      colors: primary.colors || [],
      deckSize: 99
    };
  }

  const partner = await getCommander(partnerName);
  if (!partner) throw new Error(`Second commander "${partnerName}" was not found on Scryfall.`);
  if (!isLegalCommanderPair(primary, partner)) {
    throw new Error(`${primary.name} and ${partner.name} cannot be commanders together.`);
  }
```
→
```js
async function resolveCommanders(primaryName, partnerName) {
  const primary = await getCommander(primaryName);
  if (!primary) throw new Error("Commander not found on Scryfall.");
  if (!canBeActiveCommander(primary)) throw new Error("Selected card does not appear to be a legal commander.");

  if (!partnerName) {
    return {
      primary,
      partner: null,
      names: [primary.name],
      colors: primary.colors || [],
      deckSize: 99
    };
  }

  const partner = await getCommander(partnerName);
  if (!partner) throw new Error(`Second commander "${partnerName}" was not found on Scryfall.`);
  if (!canBeActiveCommander(partner)) {
    throw new Error(`"${partner.name}" does not appear to be a legal commander.`);
  }
  if (!isLegalCommanderPair(primary, partner)) {
    throw new Error(`${primary.name} and ${partner.name} cannot be commanders together.`);
  }
```

- [ ] **Step 5: Syntax-check**

Run: `node --check js/ui/theme-tab.js && node --check js/analysis/commander-match.js && node --check js/main.js`
Expected: no output, exit code 0.

- [ ] **Step 6: Run the full existing JXA suite to confirm zero regression**

Same commands as Task 3 Step 3 (plus Task 5's `deck.test.js` command). None of these files are covered by the JXA suite (`theme-tab.js`, `commander-match.js`, and `main.js` are DOM-wired and have no existing `*.test.js` — consistent with this project's existing test coverage, which doesn't test UI-wiring files). Expected: all unaffected suites still green; this task's correctness is verified manually in Task 9's browser check instead, same as the rest of `main.js` already is.

- [ ] **Step 7: Regenerate the offline harness and commit**

```bash
bash dev/tools/jxa-harness/build_harness.sh
git add js/ui/theme-tab.js js/analysis/commander-match.js js/main.js dev/tools/jxa-harness/combined.js
git commit -m "Make commander eligibility checks format-aware; validate partner eligibility directly"
```

---

### Task 7: Skip the EDHREC fetch entirely under Pauper format

**Files:**
- Modify: `js/main.js` (the EDHREC-fetch block inside `generateDeck`)

**Interfaces:**
- Consumes: `isPauperFormat()` (Task 2).
- Produces: nothing new — with `edhrecData` defaulted to an empty shape under pauper format, every downstream consumer already on the existing "Collection Fallback" path (confirmed in the spec: `ownedCandidates` building, `detectCommanderThemes`'s local-keyword fallback, `buildRoleTargetPlan`'s non-EDHREC defaults) runs unmodified.

- [ ] **Step 1: Replace the EDHREC-fetch block**

In `js/main.js`, inside `generateDeck`, replace:

```js
    updateProgress(18, "Fetching EDHREC synergy data...");
    logMessage("Loading commander recommendations from EDHREC.");
    const edhrecData = await getEDHREC(commanders.names);
    const edhrecCards = Array.isArray(edhrecData?.cards) ? edhrecData.cards : [];
    const edhrecTags = Array.isArray(edhrecData?.tags) ? edhrecData.tags : [];
    const edhrecAllTags = Array.isArray(edhrecData?.allTags) ? edhrecData.allTags : [];
    if (edhrecData?.unavailable) {
      logMessage("EDHREC could not be reached. Continuing with Scryfall + collection-based build logic.");
    }
    if (!edhrecCards.length) {
      logMessage("No EDHREC card data available. Falling back to collection/theme-based build logic.");
    } else {
      logMessage(`EDHREC returned ${edhrecCards.length} candidate cards.`);
    }
    if (edhrecTags.length) {
      logMessage(`Using EDHREC tags: ${edhrecTags.map(formatThemeLabel).join(", ")}`);
    }
    if (edhrecData.typeAverages) {
      const typeSummary = Object.entries(edhrecData.typeAverages)
        .filter(([, count]) => Number.isFinite(count) && count > 0)
        .map(([type, count]) => `${type}: ${count}`)
        .join(", ");
      if (typeSummary) logMessage(`Using EDHREC type targets: ${typeSummary}`);
    }
    if (edhrecData.roleTargets) {
      const roleSummary = Object.entries(edhrecData.roleTargets)
        .filter(([, count]) => Number.isFinite(count) && count > 0)
        .map(([role, count]) => `${role}: ${count}`)
        .join(", ");
      if (roleSummary) logMessage(`Using EDHREC support package targets: ${roleSummary}`);
    }
```

with:

```js
    let edhrecData = { cards: [], tags: [], allTags: [], typeAverages: null, roleTargets: null, themeCardLists: {} };

    if (!isPauperFormat()) {
      updateProgress(18, "Fetching EDHREC synergy data...");
      logMessage("Loading commander recommendations from EDHREC.");
      edhrecData = await getEDHREC(commanders.names);
      if (edhrecData?.unavailable) {
        logMessage("EDHREC could not be reached. Continuing with Scryfall + collection-based build logic.");
      }
    } else {
      logMessage("Pauper Commander mode: EDHREC has no data for uncommon commanders — building entirely from Scryfall and your collection.");
    }

    const edhrecCards = Array.isArray(edhrecData?.cards) ? edhrecData.cards : [];
    const edhrecTags = Array.isArray(edhrecData?.tags) ? edhrecData.tags : [];
    const edhrecAllTags = Array.isArray(edhrecData?.allTags) ? edhrecData.allTags : [];
    if (!edhrecCards.length) {
      if (!isPauperFormat()) {
        logMessage("No EDHREC card data available. Falling back to collection/theme-based build logic.");
      }
    } else {
      logMessage(`EDHREC returned ${edhrecCards.length} candidate cards.`);
    }
    if (edhrecTags.length) {
      logMessage(`Using EDHREC tags: ${edhrecTags.map(formatThemeLabel).join(", ")}`);
    }
    if (edhrecData.typeAverages) {
      const typeSummary = Object.entries(edhrecData.typeAverages)
        .filter(([, count]) => Number.isFinite(count) && count > 0)
        .map(([type, count]) => `${type}: ${count}`)
        .join(", ");
      if (typeSummary) logMessage(`Using EDHREC type targets: ${typeSummary}`);
    }
    if (edhrecData.roleTargets) {
      const roleSummary = Object.entries(edhrecData.roleTargets)
        .filter(([, count]) => Number.isFinite(count) && count > 0)
        .map(([role, count]) => `${role}: ${count}`)
        .join(", ");
      if (roleSummary) logMessage(`Using EDHREC support package targets: ${roleSummary}`);
    }
```

- [ ] **Step 2: Syntax-check**

Run: `node --check js/main.js`
Expected: no output, exit code 0.

- [ ] **Step 3: Run the full existing JXA suite to confirm zero regression**

Same commands as Task 3 Step 3 (plus Task 5's `deck.test.js` command). `main.js` has no dedicated JXA test (DOM-wired, consistent with existing coverage) — this task's correctness is verified in Task 9's manual browser check, where the pauper page's log panel should show the new "Pauper Commander mode: ..." message and never "Loading commander recommendations from EDHREC."

- [ ] **Step 4: Regenerate the offline harness and commit**

```bash
bash dev/tools/jxa-harness/build_harness.sh
git add js/main.js dev/tools/jxa-harness/combined.js
git commit -m "Skip the EDHREC fetch entirely under Pauper Commander format"
```

---

### Task 8: Create `pauper.html` and the banner links

**Files:**
- Create: `pauper.html`
- Modify: `index.html` (banner link near `<h1>`)
- Modify: `style.css` (one small rule for the banner link)

**Interfaces:**
- Consumes: `setActiveFormat` (Task 2), the full script list wired in Tasks 3/4/6/7.
- Produces: the user-visible deliverable — a working Pauper Commander page, linked from and linking back to the main app.

- [ ] **Step 1: Add the banner link to `index.html`**

Immediately after `<h1>MTG Commander Deck Builder</h1>`:

```html
    <h1>MTG Commander Deck Builder</h1>
    <p class="format-banner"><a href="pauper.html">Try Pauper Commander (PDH) →</a></p>
```

- [ ] **Step 2: Add the shared CSS rule**

In `style.css`, after the `a:hover` rule:

```css
.format-banner {
  margin: -8px 0 16px;
  font-size: 0.95rem;
}
```

- [ ] **Step 3: Create `pauper.html`**

Copy `index.html` to `pauper.html`, then apply these changes:

- `<title>`: `MTG Pauper Commander ("PDH") Deck Builder`
- `<h1>`: `MTG Pauper Commander Deck Builder`
- Banner link (replaces the one added in Step 1, pointing the other direction):
  ```html
  <p class="format-banner"><a href="index.html">← Full Commander Deck Builder</a></p>
  ```
- `#commanderInput` placeholder: `Start typing an uncommon creature name...`
- The "How it works" empty-state panel's three `<p>` tags, replaced with:
  ```html
  <p>Choose a legal Pauper Commander (any uncommon creature, legendary or not) and upload a ManaBox CSV of cards you own, and the app will build a 99-card, commons-only Commander deck from your collection.</p>
  <p>Pauper Commander has no EDHREC-equivalent synergy data source here — PDHREC (pdhrec.com) has no CORS-enabled API this static app can call directly, so every pick comes from Scryfall data and your own collection, matched locally.</p>
  <p>Typal/tribal commanders still get the most synergy out of this tool, since creature types are easy to detect reliably from card text alone. Minimal Build is also available here, same as the full app — commander, mana base, and support package only.</p>
  ```
- Script list: identical to `index.html`'s (same files, same order, already updated by Tasks 3/6/7), with one inline script added right after `js/format.js`'s tag:
  ```html
  <script src="js/format.js"></script>
  <script>setActiveFormat("pauperCommander");</script>
  <script src="js/analysis/pairing.js"></script>
  ```

- [ ] **Step 4: Manual verification in a browser**

Run: `open index.html` (or serve the directory with any static server, per `AGENTS.md`).

- From `index.html`, click "Try Pauper Commander (PDH) →" and confirm it opens `pauper.html`.
- From `pauper.html`, click "← Full Commander Deck Builder" and confirm it opens `index.html`.
- On `pauper.html`: type a known rare/mythic legendary commander name (e.g. one normally used in the main app) into the commander field and confirm the autocomplete list does NOT show it as a selectable option (eligibility filter is active).
- On `pauper.html`: type a real uncommon creature name, upload a ManaBox CSV, click "Generate Deck," and confirm:
  - The build log shows "Pauper Commander mode: EDHREC has no data for uncommon commanders..." and never shows "Loading commander recommendations from EDHREC."
  - Every nonland card in the resulting decklist is common rarity (spot-check a handful against Scryfall).
  - The "Your Commanders" tab lists only uncommon creatures from the uploaded collection, not legendary rares.
  - The "Theme / Tribal" tab's commander picker behaves the same way.
- On `pauper.html`: with an eligible uncommon creature entered as the primary commander, reveal the partner field and type the name of a common-rarity card that happens to share a partner-matching mechanic (or, if none is readily available in the test collection, any common card at all) as the partner; confirm deck generation throws `"<name>" does not appear to be a legal commander.` rather than accepting it (Task 6's `canBeActiveCommander(partner)` check).
- On `index.html`: confirm a normal build still works exactly as before (no regression from the format-aware changes), including a real partner-commander pair still building successfully.

- [ ] **Step 5: Commit**

```bash
git add pauper.html index.html style.css
git commit -m "Add the Pauper Commander page and banner links between the two apps"
```
