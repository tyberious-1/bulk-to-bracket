# Collection Analytics Readability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Collection Analytics tab readable and useful: a color legend, one merged row per subtype, a top-30 subtype list, a "what your collection is good for" summary (strongest tribes, color depth, support roles against deck targets).

**Architecture:** Pure data functions go in a new `js/analysis/collection-summary.js` (testable under JXA, no DOM). `js/ui/collection-analytics.js` only renders what they return. CSS goes in `style.css`. The first fix (clipped scrolling in `.type-detail-panel` / `.section-content`) is already done and uncommitted.

**Tech Stack:** Plain global-scope JS, JXA test suites, no build step.

**Spec:** None written; the design is the conversation of 2026-10-26: legend, merged subtypes, top 30 with "show all", summary section with tribes (10), color depth, role coverage vs targets.

## Global Constraints

- New `js/` file must get a `<script>` tag in BOTH `index.html` and `pauper.html` (after `js/analysis/discovery.js`, before `js/ui/collection-analytics.js`) AND be added to `dev/tools/jxa-harness/build_harness.sh` after `js/analysis/discovery.js`.
- No modules, bundler or npm. Match surrounding style (this file uses semicolons, `const`/`let`, string-concat HTML in the detail panel).
- Role targets come from `normalizeRoleTargets({})` in `js/utils/deck-stats.js` (ramp 10, draw 10, removal 8, wipe 3). Do not hardcode a second copy.
- Subtype list shows top 30 (`SUBTYPE_TOP_N = 30`); strongest-tribes summary shows top 10 (`TRIBE_SUMMARY_N = 10`), tribes with fewer than 2 owned cards are omitted.
- Colorless is `colorId === ""` (what `getCardColorIdentity` returns), never `"C"`. Multicolor is `colorId.length > 1`.
- Never commit `ManaBox_Collection(mine).csv`; commit with explicit paths.

## Review Focus

- Colorless subtype cards (Golems, Equipment) were counted as "multicolor" by the old bars (`distribution.C` is always 0): colorless must be its own segment and not inflate multicolor.
- A creature with no subtype (type line `creature`) must show as "No subtype", not "base" or blank.
- A collection with zero cards in a role must show that role as "Missing", not disappear (the old loop skipped empty roles).
- A multi-type creature (Human Warrior) is counted once in each subtype but the summary total must not exceed the creature total claims: the note explaining overlap must show wherever subtype counts are listed.
- Fewer than 30 subtypes: no "show all" button.
- Legendary-only tribes (a tribe of 1 legendary card): counted, shown with the legendary badge, but dropped from the tribe summary by the 2-card floor.

---

### Task 1: Pure summary functions

**Files:**
- Create: `js/analysis/collection-summary.js`
- Create: `dev/tests/jxa/collection-summary.test.js`
- Modify: `index.html`, `pauper.html` (script tag), `dev/tools/jxa-harness/build_harness.sh` (script list)

**Interfaces:**
- Consumes: `classifyPrimaryType`, `isLegendaryTypeLine`, `getTypeLineSubtypes` (discovery.js), `normalizeRoleTargets` (deck-stats.js). Entries are the `byTypeSubtype` values from `buildCardData`: `{ type, colorId, count, cards }`.
- Produces:
  - `const SUBTYPE_TOP_N = 30; const TRIBE_SUMMARY_N = 10;`
  - `colorBucket(colorId) -> "W"|"U"|"B"|"R"|"G"|"C"|"M"` (C colorless, M multicolor)
  - `aggregateSubtypes(entries, typeKey) -> [{ name, count, legendary, colors: {W,U,B,R,G,C,M} }]` sorted by count desc, then name; `name` is `"No subtype"` when the type line has none.
  - `buildTribeSummary(byTypeSubtype) -> same row shape`, creatures only, `count >= 2`, first `TRIBE_SUMMARY_N`.
  - `buildRoleCoverage(bySupportRole) -> [{ role, total, target, status, byColor: {W,U,B,R,G} }]` for ramp, draw, removal, wipe in that order. `status` is `"missing"` (total 0), `"thin"` (< target), `"ok"` (>= target), `"deep"` (>= 2 x target). `byColor[c]` = cards castable in a mono-`c` deck: colorless plus mono-`c`.

- [ ] **Step 1: Write the failing tests**

```js
function csEntry(type, colorId, count) {
  return { type, colorId, count, cards: [] };
}

runSuite("collection-summary", {
  "colorBucket: empty is colorless, two colors is multicolor": () => {
    assertEqual(colorBucket(""), "C");
    assertEqual(colorBucket("G"), "G");
    assertEqual(colorBucket("WU"), "M");
  },

  "aggregateSubtypes: a Human Warrior counts under both, legendary tallied": () => {
    const rows = aggregateSubtypes([
      csEntry("creature — human warrior", "W", 2),
      csEntry("legendary creature — human", "WU", 1)
    ], "creature");
    const human = rows.find((r) => r.name === "Human");
    assertEqual(human.count, 3);
    assertEqual(human.legendary, 1);
    assertEqual(human.colors.W, 2);
    assertEqual(human.colors.M, 1);
    assertEqual(rows.find((r) => r.name === "Warrior").count, 2);
  },

  "aggregateSubtypes: colorless goes in C, not M": () => {
    const rows = aggregateSubtypes([csEntry("artifact creature — golem", "", 3)], "creature");
    assertEqual(rows[0].colors.C, 3);
    assertEqual(rows[0].colors.M, 0);
  },

  "aggregateSubtypes: no subtype is labeled No subtype": () => {
    const rows = aggregateSubtypes([csEntry("creature", "R", 1)], "creature");
    assertEqual(rows[0].name, "No subtype");
  },

  "aggregateSubtypes: ignores other primary types": () => {
    const rows = aggregateSubtypes([csEntry("instant", "U", 4)], "creature");
    assertEqual(rows.length, 0);
  },

  "buildTribeSummary: drops one-card tribes and caps at ten": () => {
    const m = new Map();
    for (let i = 0; i < 12; i += 1) m.set("t" + i, csEntry("creature — tribe" + i, "G", 5 + i));
    m.set("solo", csEntry("creature — loner", "G", 1));
    const rows = buildTribeSummary(m);
    assertEqual(rows.length, 10);
    assertTrue(!rows.some((r) => r.name === "Loner"));
    assertEqual(rows[0].name, "Tribe11");
  },

  "buildRoleCoverage: empty role is missing, listed in fixed order": () => {
    const rows = buildRoleCoverage(new Map());
    assertEqual(rows.map((r) => r.role).join(","), "ramp,draw,removal,wipe");
    assertEqual(rows[0].status, "missing");
    assertEqual(rows[0].target, 10);
  },

  "buildRoleCoverage: status thresholds and castable-by-color": () => {
    const m = new Map();
    m.set("removal|", { role: "removal", colorId: "", count: 3, cards: [] });
    m.set("removal|R", { role: "removal", colorId: "R", count: 6, cards: [] });
    m.set("removal|RG", { role: "removal", colorId: "RG", count: 20, cards: [] });
    const removal = buildRoleCoverage(m).find((r) => r.role === "removal");
    assertEqual(removal.total, 29);
    assertEqual(removal.status, "deep");
    assertEqual(removal.byColor.R, 9);
    assertEqual(removal.byColor.W, 3);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
bash -c 'files=(js/constants.js js/utils/text.js js/utils/cards.js js/format.js js/analysis/discovery.js js/utils/deck-stats.js js/analysis/collection-summary.js); dev/tests/jxa/run.sh "${files[@]}" dev/tests/jxa/collection-summary.test.js'
```
Expected: FAIL (`Can't find variable: colorBucket` or the file is missing). If the failure is a different missing variable, add the missing dependency from `build_harness.sh` ahead of it; the full list always works.

- [ ] **Step 3: Implement `js/analysis/collection-summary.js`**

```js
// Pure summaries behind the Collection Analytics tab: merged subtype rows, the
// strongest-tribes list and support-role coverage against deck targets.
// Depends on: discovery.js, deck-stats.js

const SUBTYPE_TOP_N = 30;
const TRIBE_SUMMARY_N = 10;

function colorBucket(colorId) {
  if (!colorId) return "C";
  return colorId.length > 1 ? "M" : colorId;
}

function emptyColorCounts() {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, M: 0 };
}

// One row per subtype. A card with several subtypes is counted under each.
function aggregateSubtypes(entries, typeKey) {
  const rows = new Map();
  for (const entry of entries) {
    if (classifyPrimaryType(entry.type) !== typeKey) continue;
    const legendary = isLegendaryTypeLine(entry.type);
    const subtypes = getTypeLineSubtypes(entry.type);
    for (const raw of subtypes.length ? subtypes : [null]) {
      const name = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "No subtype";
      if (!rows.has(name)) rows.set(name, { name, count: 0, legendary: 0, colors: emptyColorCounts() });
      const row = rows.get(name);
      row.count += entry.count;
      if (legendary) row.legendary += entry.count;
      row.colors[colorBucket(entry.colorId)] += entry.count;
    }
  }
  return Array.from(rows.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function buildTribeSummary(byTypeSubtype) {
  return aggregateSubtypes(Array.from(byTypeSubtype.values()), "creature")
    .filter((row) => row.name !== "No subtype" && row.count >= 2)
    .slice(0, TRIBE_SUMMARY_N);
}

function buildRoleCoverage(bySupportRole) {
  const targets = normalizeRoleTargets({});
  return ["ramp", "draw", "removal", "wipe"].map((role) => {
    const byColor = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    let total = 0;
    let colorless = 0;
    for (const entry of bySupportRole.values()) {
      if (entry.role !== role) continue;
      total += entry.count;
      if (!entry.colorId) colorless += entry.count;
      else if (entry.colorId.length === 1) byColor[entry.colorId] += entry.count;
    }
    for (const c of Object.keys(byColor)) byColor[c] += colorless;
    const target = targets[role];
    const status = total === 0 ? "missing" : total >= target * 2 ? "deep" : total >= target ? "ok" : "thin";
    return { role, total, target, status, byColor };
  });
}
```

- [ ] **Step 4: Add the script to all three places, then run the test**

Add `<script src="js/analysis/collection-summary.js"></script>` after the `discovery.js` line in `index.html` and `pauper.html`, and `  js/analysis/collection-summary.js` after `js/analysis/discovery.js` in `build_harness.sh`. Re-run the Step 2 command. Expected: all pass.

- [ ] **Step 5: Run the whole suite set for regressions, then commit**

```bash
bash dev/tests/jxa/run_all.sh
git add js/analysis/collection-summary.js dev/tests/jxa/collection-summary.test.js index.html pauper.html dev/tools/jxa-harness/build_harness.sh
git commit -m "Add pure summary functions for the analytics tab"
```

---

### Task 2: Merged, legend-backed subtype detail panel

**Files:**
- Modify: `js/ui/collection-analytics.js` (`buildTypeDetailPanel` lines ~259-500, click handler ~862)
- Modify: `style.css` (analytics block near line 1905)

**Interfaces:**
- Consumes: `aggregateSubtypes`, `SUBTYPE_TOP_N` from Task 1.
- Produces: `renderColorLegend() -> html string` and `renderColorBar(colors, total) -> html string`, reused by Task 3. `COLOR_SEGMENTS`: ordered list `[{key,label,bg,fg}]` for W, U, B, R, G, C (Colorless), M (Multicolor, gold `#f59e0b`).

- [ ] **Step 1: Replace the three Legendary / Other / Artifact sections** in `buildTypeDetailPanel` with one list built from `aggregateSubtypes(Array.from(byTypeSubtype.values()), typeKey)`. Row: name, total, a `★ n` badge when `legendary > 0`, `renderColorBar`. Rows past index `SUBTYPE_TOP_N` get class `subtype-row extra`; when there are more than `SUBTYPE_TOP_N` rows, add `<button class="show-all-btn" type="button">Show all N</button>`. Put the overlap note (`detail-note`) above the list for every type that can have several subtypes, not only creatures. Show `renderColorLegend()` once under the header.
- [ ] **Step 2: Delete the dead code**: the `.section-title` toggle handler branch (~862-877), `isArtifactCreatureTypeLine` use here, and the `.section-content`/`.section-toggle-icon` CSS added for it (keep `.collapsible-*`, which other sections use). Check with `grep -n "section-content\|section-title\|section-toggle" js style.css` that nothing else uses them.
- [ ] **Step 3: Handle the button** in the click handler: toggle class `show-all` on `.detail-content`, flip the label between `Show all N` and `Show top 30`. CSS: `.detail-content:not(.show-all) .subtype-row.extra { display: none; }`.
- [ ] **Step 4: Color bar and legend CSS.** Each segment gets inline `background` and `color` from `COLOR_SEGMENTS` (white text on Black). Legend is a flex-wrap row of swatch + label. Every segment keeps a `title` ("White: 12 cards").
- [ ] **Step 5: Verify in a browser**

```bash
python3 dev/tools/jxa-harness/browser_smoke.py --help
```
Use `browser_smoke.py` (or open `index.html` with the sample CSV) to confirm no JS errors, then open Collection Analytics, click Creature: the list ends at 30 rows, "Show all" reveals the rest and scrolls to the true end, colorless rows are grey, multicolor rows gold.
- [ ] **Step 6: Commit** `git add js/ui/collection-analytics.js style.css` with message "Merge subtype rows, add a color legend and a top-30 limit".

---

### Task 3: "What your collection is good for" summary

**Files:**
- Modify: `js/ui/collection-analytics.js` (`renderAnalyticsPanel`, new `renderCollectionSummary`)
- Modify: `style.css`

**Interfaces:**
- Consumes: `buildTribeSummary`, `buildRoleCoverage`, `renderColorBar`, `renderColorLegend`, `buildMonoColorDistribution` (existing, returns Map color -> count, `"C"` for colorless).
- Produces: `renderCollectionSummary(byTypeSubtype, bySupportRole, monoColorDist) -> html`.

- [ ] **Step 1:** In `renderAnalyticsPanel`, put the summary first, always visible (not collapsible), before the Color Identity section. Three blocks:
  1. **Strongest tribes**: ordered list of the top 10 from `buildTribeSummary`: name, count, `★ n legendary`, color bar.
  2. **Color depth**: one line per WUBRG color plus colorless using `monoColorDist` counts, with the text "mono-color cards only; multicolor cards are in the charts below".
  3. **Support roles vs a typical deck**: one row per `buildRoleCoverage` result: `Removal 6 / 8  Thin`, a status chip (`missing` red, `thin` amber, `ok` green, `deep` green with "plenty"), then the five `byColor` counts labeled "castable in a mono-W deck: 9". Add one sentence: "Targets are typical EDHREC averages (ramp 10, draw 10, removal 8, wipes 3)."
- [ ] **Step 2:** Role sections below the summary keep their card lists but their titles now read `Removal (6 of ~8)`; show them even when empty (remove the `if (!entries.length) return;` skip, render "No cards found").
- [ ] **Step 3:** CSS for `.collection-summary`, `.tribe-row`, `.role-row`, `.status-chip.{missing,thin,ok,deep}`. Reuse the existing dark palette (`#374151`, `#f3f4f6`, `#fbbf24`).
- [ ] **Step 4: Verify** with the friend's collection locally (testing only, never commit) and the user's: the sparse collection must show "Missing"/"Thin" honestly and no JS errors in `browser_smoke.py`. Check at narrow width that rows wrap rather than scroll the page.
- [ ] **Step 5: Run `bash dev/tests/jxa/run_all.sh`, then commit** `git add js/ui/collection-analytics.js style.css` with message "Add a collection summary: strongest tribes, color depth, role coverage".

---

### Task 4: Wrap-up

- [ ] Commit the earlier scroll fix if not already included: `git add style.css` (message "Stop clipping the analytics detail panel").
- [ ] Update `AGENTS.md`: add `js/analysis/collection-summary.js` to the Architecture list and the `collection-summary` suite to the Suites line.
- [ ] Final `bash dev/tests/jxa/run_all.sh`; report any failure with its output.

## Self-Review

- **Coverage:** legend (T2), merged subtypes (T2), top 30 (T2), summary with tribes top 10 / color depth / role targets (T1, T3). Each is mapped.
- **Placeholders:** none; Task 2 and 3 describe rendering in prose because the markup is straightforward string building around the Task 1 data. Say so if you want the full markup written out.
- **Types:** `aggregateSubtypes`, `buildTribeSummary`, `buildRoleCoverage`, `renderColorBar`, `renderColorLegend` names match across tasks.
- **Assumption to confirm:** "strongest tribe should be more" was read as showing more tribes (10), not a different ranking.
