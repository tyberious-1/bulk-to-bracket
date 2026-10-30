# Ability Labels, Phase 2b (event scoring and the Event Engines switch) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make event producers (Plan 2a) score a little in a build, show them in the report, and add an "Event Engines" switch (on by default) that turns the whole thing off so a build runs exactly as it did before.

**Architecture:** `getEngineClassDetails` adds one `event:<id>` class per event a card causes; `getEngineBonus` adds a flat 6 (strong) or 3 (weak) for it. Event classes are excluded from theme-tier injection and from the graveyard-enabler list, because some event lists run to hundreds of cards. A new `applyEventSwitch(needs, modePrefs)` empties `needs.events` when the `noEvents` build-mode token is present, and every other function already ignores a commander with no events. The switch is a build-mode toggle like Minimal Build and Curve First.

**Tech Stack:** Plain global-scope browser JS, no modules, no build step. Tests run under JXA (`dev/tests/jxa/run.sh`); `node` and Chrome are for ad-hoc checks only.

**Spec:** `dev/docs/superpowers/specs/2026-10-15-ability-labels.md`, requirement 17 (the same weight rules, the report line) and requirement 16's use of producers. Plan 2a (`2026-10-15-ability-labels-phase2a.md`) built the events and producers this plan scores.

## Global Constraints

- No module system, bundler or npm. This plan adds no `js/` file, so no `<script>` change is needed; both HTML pages get the same new button.
- Run suites with `bash dev/tests/jxa/run_all.sh [name]`. zsh does not word-split `$VAR`.
- Commit style: short imperative subjects, no `feat:`/`fix:` prefixes, each ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Commit with explicit paths, never `git add -A` (an untracked `ManaBox_Collection(mine).csv` sits at the repo root and holds purchase prices).
- **Don't over-tune for one commander.** The only commanders whose builds may change with the switch on are those with an event; the switch off must change none.
- Say "typal", not "tribal", in visible text. Never use Rosheen as a sample commander.
- **Ask when unsure; Haiku only for bounded read-only lookups; native execution.** Never leave a stray stdin-reading command in a shell call.
- Work on a new branch `event-engines-2b` cut from `event-engines`. Task 4 merges it into local `main` (fast-forward only); the player asked for this so the build can be tested on a phone from a zip. Do not push.

## Rulings made while planning

- **Scoring is a bonus only, never injection.** Producer lists are wide (Kuja about 590 strong producers, the Council about 480), so injecting them into the theme tier would flood a build. The bonus only reorders cards the builder already considers. Cost if wrong: events nudge rankings and nothing more; the switch removes it.
- **Weights: 6 strong, 3 weak, once per card.** A card that causes two events gets the larger weight once; flaws are not charged. These are first-guess numbers set against the existing class weights (discard 14, payload 4). The player tunes them by reading builds. Cost if wrong: too weak to notice or too strong against role cards; the shared bonus cap (36) still holds.
- **Switch on by default.** The player wants to test on a phone and turn it off if a build looks odd.
- **Deferred to a later plan (2c), on purpose:** the typal reshaping (requirement 13 and the player's calls on token makers), the mill-direction recursion rule, the Kuja amplifier class, Denry/Perrie variety, and the Plan 2a deferred minors. The player is away and cannot adjust anything, so this plan ships the smallest change that makes the events matter and can be switched off.
- **The report line shows at most 12 producers** ("+N more"), so a wide event cannot swamp the breakdown on a phone.

## Review Focus

1. With the switch **off**, all 56 sample builds are identical to the pre-2b baseline (`2026-10-15-after-graveyard-exile-role.json`). (Task 4)
2. With the switch on, a commander with no event is unchanged, in particular Kaza, Zodiark, Fynn, Kardur, Greasefang and Callaphe. (Task 4)
3. Event producers are never injected into the theme tier and never listed as graveyard enablers. (Task 1)
4. A needs object from before events existed (no `events` field) and a commander with only events (no payload or devotion) both work. (Task 1)
5. The switch rebuilds the deck and the report line renders in the real page. (Task 4, browser smoke)

## File Structure

- Modify `js/analysis/engines.js`: event weights, `hasEventNeeds`, `isEventClass`, `applyEventSwitch`, event classes in `getEngineClassDetails`, event bonus in `getEngineBonus`, exclusions, `describeEventProducers`.
- Modify `js/state.js`, `js/ui/status.js`, `js/analysis/themes.js`, `js/dom.js`, `js/main.js`, `js/ui/report.js`, `index.html`, `pauper.html`, `dev/tools/jxa-harness/dump_decks.js`, `dev/tools/jxa-harness/browser_smoke.py`.
- Modify `dev/tests/jxa/engines.test.js`, `dev/tests/jxa/mode-prefs.test.js`; add a "Phase 2b result" section to the spec and a baseline `dev/tools/jxa-harness/baselines/2026-10-15-after-events.json`.

---
### Task 1: Score event producers and add the switch function

**Files:**
- Modify: `js/analysis/engines.js`
- Test: `dev/tests/jxa/engines.test.js`

**Interfaces:**
- Consumes: Plan 2a's `getEventProducers`, `parseCommanderNeeds` (`needs.events`).
- Produces: `hasEventNeeds(needs)`, `isEventClass(cls)`, `applyEventSwitch(needs, modePrefs) -> needs`, `ENGINE_EVENT_WEIGHT` (6), `ENGINE_EVENT_WEAK_WEIGHT` (3); `getEngineClassDetails` gains `event:<id>` classes; `getEngineBonus` adds the event weight once; event classes are excluded from `addEngineCandidates` and `describeEngineEnablers`.

- [ ] **Step 1: Write the failing tests**

Append inside the object of `dev/tests/jxa/engines.test.js` (add the leading comma shown):

```js
  ,
  "applyEventSwitch: off drops every event, on or no mode keeps them": function () {
    const text = "Landfall — Whenever a land you control enters, create a 5/5 red and green Elemental creature token.";
    assertEqual(applyEventSwitch(parseCommanderNeeds([text]), { eventEngines: false }).events, []);
    assertEqual(applyEventSwitch(parseCommanderNeeds([text]), { eventEngines: true }).events.length, 1);
    assertEqual(applyEventSwitch(parseCommanderNeeds([text]), undefined).events.length, 1);
    assertEqual(applyEventSwitch(null, { eventEngines: false }), null);
  },
  "getEngineBonus: an event producer scores 6, a weak one 3, a bystander 0, and none with the switch off": function () {
    const text = "Landfall — Whenever a land you control enters, create a 5/5 red and green Elemental creature token.";
    const needs = parseCommanderNeeds([text]);
    const make = (name, type, body, cmc) => ({ name: name, type: type, text: body, cmc: cmc, manaCost: "" });
    const cultivate = make("Cultivate-shaped", "sorcery", "search your library for up to two basic land cards, put one onto the battlefield tapped and the other into your hand.", 3);
    const costly = make("Costly Fetch", "sorcery", "search your library for a basic land card, put it onto the battlefield tapped.", 5);
    const bear = make("Bear", "creature — bear", "trample", 2);
    assertEqual(getEngineBonus(cultivate, needs), ENGINE_EVENT_WEIGHT);
    assertEqual(getEngineBonus(costly, needs), ENGINE_EVENT_WEAK_WEIGHT);
    assertEqual(getEngineBonus(bear, needs), 0);
    assertEqual(getEngineBonus(cultivate, applyEventSwitch(parseCommanderNeeds([text]), { eventEngines: false })), 0);
  },
  "getEngineBonus: an event bonus adds to nothing else, so a commander with no event scores as before": function () {
    const vehicle = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [], events: [] };
    const copter = { name: "Copter-shaped", type: "artifact — vehicle", text: "flying\nwhenever this vehicle attacks or blocks, you may draw a card. if you do, discard a card.\ncrew 1", cmc: 2 };
    const noEventsField = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    assertEqual(getEngineBonus(copter, vehicle), getEngineBonus(copter, noEventsField));
    assertTrue(getEngineBonus(copter, vehicle) > 0, "the payload and discard classes still score");
  },
  "event producers are scored but never injected into the theme tier or listed as graveyard enablers": function () {
    const needs = parseCommanderNeeds(["Landfall — Whenever a land you control enters, create a 5/5 red and green Elemental creature token."]);
    const owned = new Map([[normalizeCardName("Cultivate-shaped"), { name: "Cultivate-shaped", type: "sorcery", text: "search your library for up to two basic land cards, put one onto the battlefield tapped and the other into your hand.", cmc: 3, colors: [], manaCost: "" }]]);
    assertEqual(addEngineCandidates(new Map(), needs, owned, []).size, 0);
    assertEqual(describeEngineEnablers([{ name: "Cultivate-shaped", role: "ramp" }], owned, needs), []);
    assertEqual(getEngineClasses(owned.get(normalizeCardName("Cultivate-shaped")), needs), ["event:landfall"]);
  }
```

- [ ] **Step 2: Run to verify they fail**

Run: `bash dev/tests/jxa/run_all.sh engines`
Expected: the four new tests FAIL (`applyEventSwitch` is not defined; the bonus is 0); the 84 existing pass; `SUITE FAILED`.

- [ ] **Step 3: Make the changes**

In `js/analysis/engines.js`, add directly above the `// "Crew 3" -> 3.` comment (above `getCrewCost`):

```js
// Event producers score a little: a card that causes one of the commander's events gets a flat bonus
// (6 strong, 3 weak, the larger one if it causes several). They are never injected into the theme tier:
// some event lists run to hundreds of cards, so the bonus only ranks cards already in play.
const ENGINE_EVENT_WEIGHT = 6;
const ENGINE_EVENT_WEAK_WEIGHT = 3;

function hasEventNeeds(needs) {
  return Boolean(needs && Array.isArray(needs.events) && needs.events.length);
}

function isEventClass(cls) {
  return String(cls).startsWith("event:");
}

// The "Event Engines" switch (a build mode): off drops every event, so the builder runs exactly as it
// did before events existed. `modePrefs.eventEngines` is undefined when no mode was parsed, which keeps events.
function applyEventSwitch(needs, modePrefs) {
  if (needs && modePrefs && modePrefs.eventEngines === false) needs.events = [];
  return needs;
}
```

In `js/analysis/engines.js`, replace:

```js
function getEngineClassDetails(card, needs) {
  if (!card || !isEngineActive(needs)) return [];
```

with:

```js
function getEngineClassDetails(card, needs) {
  if (!card || (!isEngineActive(needs) && !hasEventNeeds(needs))) return [];
```

In `js/analysis/engines.js`, replace:

```js
    add("devotionPayoff", false, []);
  }
  return Array.from(found.values());
```

with:

```js
    add("devotionPayoff", false, []);
  }

  // One class per event the card causes ("event:landfall"), scored separately and never injected.
  for (const p of getEventProducers(card, needs)) add("event:" + p.event, p.weak, []);
  return Array.from(found.values());
```

In `js/analysis/engines.js`, replace:

```js
function getEngineBonus(card, needs) {
  if (!card || !isEngineActive(needs)) return 0;
  const type = getCardType(card);
  if (type.split("—")[0].includes("land")) return 0;

  const details = getEngineClassDetails(card, needs);
```

with:

```js
function getEngineBonus(card, needs) {
  if (!card || (!isEngineActive(needs) && !hasEventNeeds(needs))) return 0;
  const type = getCardType(card);
  if (type.split("—")[0].includes("land")) return 0;

  const allDetails = getEngineClassDetails(card, needs);
  const eventDetails = allDetails.filter((d) => isEventClass(d.cls));
  const details = allDetails.filter((d) => !isEventClass(d.cls));
```

In `js/analysis/engines.js`, replace:

```js
  if (classes.length > 1) bonus += ENGINE_MULTI_HIT_BONUS * (classes.length - 1);
```

with:

```js
  if (classes.length > 1) bonus += ENGINE_MULTI_HIT_BONUS * (classes.length - 1);
  // An event producer adds its weight once, whatever number of events it causes (the larger if it causes several).
  if (eventDetails.length) bonus += eventDetails.some((d) => !d.weak) ? ENGINE_EVENT_WEIGHT : ENGINE_EVENT_WEAK_WEIGHT;
```

In `js/analysis/engines.js`, replace:

```js
    const strong = getEngineClassDetails(card, needs).filter((d) => !d.weak);
    let hits = strong.length;
```

with:

```js
    const strong = getEngineClassDetails(card, needs).filter((d) => !d.weak && !isEventClass(d.cls));
    let hits = strong.length;
```

In `js/analysis/engines.js`, replace:

```js
    const strong = getEngineClassDetails(card, needs).filter((d) => !d.weak);
    if (!strong.length) continue;
    strong.sort(
```

with:

```js
    const strong = getEngineClassDetails(card, needs).filter((d) => !d.weak && !isEventClass(d.cls));
    if (!strong.length) continue;
    strong.sort(
```

- [ ] **Step 4: Run to verify they pass**

Run: `bash dev/tests/jxa/run_all.sh`
Expected: every suite `SUITE OK`; `engines` 88 passed (84 + 4).

- [ ] **Step 5: Commit**

```bash
git add js/analysis/engines.js dev/tests/jxa/engines.test.js && git commit -m "Score event producers and add the Event Engines switch function

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---
### Task 2: Show event producers in the report

**Files:**
- Modify: `js/analysis/engines.js`, `js/main.js`, `js/ui/report.js`
- Test: `dev/tests/jxa/engines.test.js`

**Interfaces:**
- Consumes: Task 1's `hasEventNeeds`, Plan 2a's `getEventProducers`, Phase 1's `describeEngineEnablerItem`.
- Produces: `describeEventProducers(deck, allOwnedCardData, needs, limit) -> { label, items[], more } | null` (strong producers only, at most `limit`, default 12); `displayBuildBreakdown(deck, engineNote, eventNote)` renders it.

- [ ] **Step 1: Write the failing tests**

Append inside the object of `dev/tests/jxa/engines.test.js` (add the leading comma shown):

```js
  ,
  "describeEventProducers: strong producers in the deck with their reason, capped, and null when there are none": function () {
    const needs = parseCommanderNeeds(["Landfall — Whenever a land you control enters, create a 5/5 red and green Elemental creature token."]);
    const fetch = (name) => ({ name: name, type: "sorcery", text: "search your library for a basic land card, put it onto the battlefield tapped.", cmc: 2, colors: [], manaCost: "" });
    const owned = new Map([[normalizeCardName("Fetch One"), fetch("Fetch One")], [normalizeCardName("Fetch Two"), fetch("Fetch Two")], [normalizeCardName("Fetch Three"), fetch("Fetch Three")],
      [normalizeCardName("Bear"), { name: "Bear", type: "creature — bear", text: "trample", cmc: 2, colors: [], manaCost: "" }]]);
    const deck = [{ name: "Fetch One", role: "ramp" }, { name: "Fetch Two", role: "ramp" }, { name: "Fetch Three", role: "ramp" }, { name: "Bear", role: "creature" }, { name: "Forest", role: "land" }];
    const note = describeEventProducers(deck, owned, needs, 2);
    assertEqual(note.label, "Event engines (landfall)");
    assertEqual(note.items.map((i) => i.name), ["Fetch One", "Fetch Two"]);
    assertEqual(note.items[0].reason, "puts a land onto the battlefield");
    assertEqual(note.more, 1);
    assertEqual(describeEventProducers([{ name: "Bear", role: "creature" }], owned, needs), null);
    assertEqual(describeEventProducers(deck, owned, parseCommanderNeeds(["Flying"])), null);
    assertEqual(describeEventProducers(deck, owned, applyEventSwitch(parseCommanderNeeds(["Landfall — Whenever a land you control enters, create a token."]), { eventEngines: false })), null);
  }
```

- [ ] **Step 2: Run to verify they fail**

Run: `bash dev/tests/jxa/run_all.sh engines`
Expected: the new test FAILS with `Can't find variable: describeEventProducers`; the 88 existing pass; `SUITE FAILED`.

- [ ] **Step 3: Make the changes**

In `js/analysis/engines.js`, add directly above the `// "Crew 3" -> 3.` comment (above `getCrewCost`):

```js
const EVENT_LABELS = {
  landfall: "landfall",
  draw: "cards drawn",
  "draw-second": "a second card drawn each turn",
  cast: "spells cast",
  "cast-noncreature": "noncreature spells",
  "cast-second": "a second spell each turn",
  "cast-bigger": "bigger spells",
  mill: "mill",
  "leave-graveyard": "cards leaving the graveyard",
  "counter-placed": "counters",
  "graveyard-fill": "graveyard fill"
};

// The report line for event engines: the strong producers in the deck, each with what it does, at most
// `limit` of them. Returns null when the commander has no event or the deck holds no producer.
function describeEventProducers(deck, allOwnedCardData, needs, limit) {
  if (!hasEventNeeds(needs)) return null;
  const max = limit || 12;
  const items = [];
  for (const entry of deck || []) {
    if (entry.role === "land") continue;
    const card = allOwnedCardData.get(normalizeCardName(entry.name));
    if (!card) continue;
    const strong = getEventProducers(card, needs).filter((p) => !p.weak);
    if (!strong.length) continue;
    items.push({ name: entry.name, reason: strong[0].via, flaws: strong[0].flaws });
  }
  if (!items.length) return null;
  const label = `Event engines (${needs.events.map((e) => EVENT_LABELS[e.event] || e.event).join(", ")})`;
  return { label, items: items.slice(0, max), more: Math.max(0, items.length - max) };
}
```

In `js/main.js`, replace:

```js
  displayBuildBreakdown(
    sanitizedFinalDeck,
    engineItems.length ? { label: describeEngineNeeds(modePrefs.engineNeeds), items: engineItems } : null
  );
```

with:

```js
  displayBuildBreakdown(
    sanitizedFinalDeck,
    engineItems.length ? { label: describeEngineNeeds(modePrefs.engineNeeds), items: engineItems } : null,
    describeEventProducers(sanitizedFinalDeck, allOwnedCardData, modePrefs.engineNeeds)
  );
```

In `js/ui/report.js`, replace:

```js
function displayBuildBreakdown(deck, engineNote) {
```

with:

```js
function displayBuildBreakdown(deck, engineNote, eventNote = null) {
```

In `js/ui/report.js`, replace:

```js
    : "";

  el.innerHTML = `
```

with:

```js
    : "";
  const eventHtml = eventNote && eventNote.items.length
    ? `<div class="build-breakdown-note"><strong>${escapeHtml(eventNote.label)}:</strong> ${eventNote.items.map((item) => escapeHtml(describeEngineEnablerItem(item))).join(", ")}${eventNote.more ? `, +${eventNote.more} more` : ""}</div>`
    : "";

  el.innerHTML = `
```

In `js/ui/report.js`, replace:

```js
      ${engineHtml}
```

with:

```js
      ${engineHtml}
      ${eventHtml}
```

- [ ] **Step 4: Run to verify they pass**

Run: `bash dev/tests/jxa/run_all.sh` and `node --check js/main.js && node --check js/ui/report.js`
Expected: every suite `SUITE OK`; `engines` 89 passed; no output from the checks. (The report line has no unit test in the page; Task 4's browser smoke covers it.)

- [ ] **Step 5: Commit**

```bash
git add js/analysis/engines.js js/main.js js/ui/report.js dev/tests/jxa/engines.test.js && git commit -m "Show event producers in the build report

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---
### Task 3: The Event Engines switch

**Files:**
- Modify: `js/state.js`, `js/ui/status.js`, `js/analysis/themes.js`, `js/dom.js`, `js/main.js`, `index.html`, `pauper.html`, `dev/tools/jxa-harness/dump_decks.js`
- Test: `dev/tests/jxa/mode-prefs.test.js`

**Interfaces:**
- Consumes: Task 1's `applyEventSwitch`.
- Produces: build-mode token `noEvents`; `getModePreferences(...).eventEngines` (true unless the token is present); `getEventEnginesEnabled()` / `setEventEnginesEnabled(bool)` in `state.js` (default true); an "Event Engines" button in the Build Mode panel of both pages; the harness honors `MODE_OVERRIDE = "noEvents"`.

- [ ] **Step 1: Write the failing tests**

Append inside the object of `dev/tests/jxa/mode-prefs.test.js` (add the leading comma shown):

```js
  ,
  "getModePreferences: event engines are on by default and the noEvents token turns them off": function () {
    assertEqual(getModePreferences("", { wantsCreatures: false }).eventEngines, true);
    assertEqual(getModePreferences("theme:elves", { wantsCreatures: false }).eventEngines, true);
    assertEqual(getModePreferences("noEvents", { wantsCreatures: false }).eventEngines, false);
    const both = getModePreferences("theme:elves|curveFirst|noEvents", { wantsCreatures: false });
    assertEqual(both.eventEngines, false);
    assertEqual(both.curveFirst, true);
    assertEqual(both.themeFocus, "elves");
  }
```

- [ ] **Step 2: Run to verify they fail**

Run: `bash dev/tests/jxa/run_all.sh mode-prefs`
Expected: the new test FAILS (`eventEngines` is undefined); the existing 3 pass; `SUITE FAILED`.

- [ ] **Step 3: Make the changes**

In `js/state.js`, replace:

```js
let curveFirstEnabled = false;
```

with:

```js
let curveFirstEnabled = false;

// Event engines: cards that cause the events a commander's own abilities run on score a little.
// On by default; the build-mode switch turns it off, and a build then runs without any event.
let eventEnginesEnabled = true;

function getEventEnginesEnabled() {
  return eventEnginesEnabled;
}

function setEventEnginesEnabled(enabled) {
  eventEnginesEnabled = Boolean(enabled);
}
```

In `js/ui/status.js`, replace:

```js
    if (part === "minimal") return "Minimal Build";
```

with:

```js
    if (part === "minimal") return "Minimal Build";
    if (part === "noEvents") return "Event Engines off";
```

In `js/ui/status.js`, replace:

```js
  if (getCurveFirstEnabled()) parts.push("curveFirst");
```

with:

```js
  if (getCurveFirstEnabled()) parts.push("curveFirst");
  if (!getEventEnginesEnabled()) parts.push("noEvents");
```

In `js/ui/status.js`, replace:

```js
  if (curveFirstToggle) curveFirstToggle.classList.toggle("active", getCurveFirstEnabled());
}
```

with:

```js
  if (curveFirstToggle) curveFirstToggle.classList.toggle("active", getCurveFirstEnabled());
  const eventEnginesToggle = document.getElementById("eventEnginesToggle");
  if (eventEnginesToggle) eventEnginesToggle.classList.toggle("active", getEventEnginesEnabled());
}
```

In `js/analysis/themes.js`, replace:

```js
    curveFirst: modeParts.includes("curveFirst"),
```

with:

```js
    curveFirst: modeParts.includes("curveFirst"),
    eventEngines: !modeParts.includes("noEvents"),
```

In `js/dom.js`, replace:

```js
const curveFirstToggle = document.getElementById("curveFirstToggle");
```

with:

```js
const curveFirstToggle = document.getElementById("curveFirstToggle");
const eventEnginesToggle = document.getElementById("eventEnginesToggle");
```

In `js/main.js`, replace:

```js
async function performBuildFromContext() {
```

with:

```js
async function toggleEventEngines() {
  if (!currentRunContext) return;
  setEventEnginesEnabled(!getEventEnginesEnabled());
  await runRegeneration();
}

async function performBuildFromContext() {
```

In `js/main.js`, replace:

```js
  modePrefs.engineNeeds = parseCommanderNeeds([commanders.primary?.text, commanders.partner?.text]);
```

with:

```js
  modePrefs.engineNeeds = applyEventSwitch(parseCommanderNeeds([commanders.primary?.text, commanders.partner?.text]), modePrefs);
```

In `js/main.js`, replace:

```js
if (curveFirstToggle) {
  curveFirstToggle.addEventListener("click", () => {
    toggleCurveFirst();
  });
}
```

with:

```js
if (curveFirstToggle) {
  curveFirstToggle.addEventListener("click", () => {
    toggleCurveFirst();
  });
}

if (eventEnginesToggle) {
  eventEnginesToggle.addEventListener("click", () => {
    toggleEventEngines();
  });
}
```

In `index.html`, replace:

```html
        <button id="curveFirstToggle" type="button" class="mode-toggle-btn">Curve First</button>
```

with:

```html
        <button id="curveFirstToggle" type="button" class="mode-toggle-btn">Curve First</button>
        <button id="eventEnginesToggle" type="button" class="mode-toggle-btn active" title="Score cards that cause the events a commander runs on. Turn off if a build looks odd.">Event Engines</button>
```

In `pauper.html`, replace:

```html
        <button id="curveFirstToggle" type="button" class="mode-toggle-btn">Curve First</button>
```

with:

```html
        <button id="curveFirstToggle" type="button" class="mode-toggle-btn">Curve First</button>
        <button id="eventEnginesToggle" type="button" class="mode-toggle-btn active" title="Score cards that cause the events a commander runs on. Turn off if a build looks odd.">Event Engines</button>
```

In `dev/tools/jxa-harness/dump_decks.js`, replace:

```js
  modePrefs.engineNeeds = parseCommanderNeeds([commanderCard.text, partnerCard?.text]);
```

with:

```js
  modePrefs.engineNeeds = applyEventSwitch(parseCommanderNeeds([commanderCard.text, partnerCard?.text]), modePrefs);
```

- [ ] **Step 4: Run to verify they pass**

Run: `bash dev/tests/jxa/run_all.sh` and `for f in js/main.js js/state.js js/ui/status.js js/dom.js js/analysis/themes.js; do node --check $f; done`
Expected: every suite `SUITE OK`; `mode-prefs` 4 passed; no output from the checks.

- [ ] **Step 5: Commit**

```bash
git add js/state.js js/ui/status.js js/analysis/themes.js js/dom.js js/main.js index.html pauper.html dev/tools/jxa-harness/dump_decks.js dev/tests/jxa/mode-prefs.test.js && git commit -m "Add an Event Engines switch to the build modes

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---
### Task 4: Measure, check in the browser, record, and merge to `main`

**Files:**
- Modify: `dev/tools/jxa-harness/browser_smoke.py` (an optional switch check)
- Create: `dev/tools/jxa-harness/baselines/2026-10-15-after-events.json`
- Modify: `dev/docs/superpowers/specs/2026-10-15-ability-labels.md` (a "Phase 2b result" section)

**Interfaces:**
- Consumes: everything above. Produces: the measured result, a browser check of the real page including the switch, and local `main` updated for the zip.

- [ ] **Step 1: Full suite**

Run: `bash dev/tests/jxa/run_all.sh`
Expected: every suite `SUITE OK`; `engines` 89, `mode-prefs` 4.

- [ ] **Step 2: Switch OFF changes nothing (all 56 builds)**

Run (about 2 minutes each; any scratch directory for `$SP`):

```bash
bash dev/tools/jxa-harness/build_harness.sh $SP/combined.js
{ printf 'const MODE_OVERRIDE = "noEvents";\n'; cat $SP/combined.js dev/tools/jxa-harness/dump_decks.js; } > $SP/run_off.js
osascript -l JavaScript $SP/run_off.js | grep '^DECKS ' | sed 's/^DECKS //' > $SP/off.json
python3 dev/tools/jxa-harness/engine_compare.py dev/tools/jxa-harness/baselines/2026-10-15-after-graveyard-exile-role.json $SP/off.json | head -3
```

Expected: `unchanged (56): ...` and no `==` lines. Any difference is a bug: the switch must restore the pre-2b builds exactly.

- [ ] **Step 3: Switch ON moves only commanders with an event**

```bash
cat $SP/combined.js dev/tools/jxa-harness/dump_decks.js | osascript -l JavaScript | grep '^DECKS ' | sed 's/^DECKS //' > dev/tools/jxa-harness/baselines/2026-10-15-after-events.json
python3 dev/tools/jxa-harness/engine_compare.py dev/tools/jxa-harness/baselines/2026-10-15-after-graveyard-exile-role.json dev/tools/jxa-harness/baselines/2026-10-15-after-events.json | grep -E '^==|^unchanged' | cut -c1-110
```

Expected: `==` lines only for commanders that read an event (13 in the planning run: Old Rutstein, Klothys, Berta, Firja, Gyruda, Kuja, Longshot, Omnath, Tannuk, The Astonishing Ant-Man, The Council of Four, Vanille, Tormod + Ghost), one to ten swapped cards each, and `unchanged (43)` including Kaza, Zodiark, Fynn, Kardur, Greasefang and Callaphe. A moved commander that reads no event is a bug.

- [ ] **Step 4: Check the real page, including the switch**

In `dev/tools/jxa-harness/browser_smoke.py`, inside the injected script, replace the `done({` call (the one that reports the first build) with the version below, so a third argument `--toggle` clicks the switch and reports the rebuilt report line:

```js
    const first = {
      ok: true,
      errors,
      exportLines: exportText.split("\n").filter(Boolean).length,
      breakdown: document.getElementById("buildBreakdown").innerText,
      engineNote: (document.querySelector(".build-breakdown-note") || {}).innerText || null,
      eventNotes: [...document.querySelectorAll(".build-breakdown-note")].map((n) => n.innerText)
    };
    if (window.__SMOKE_TOGGLE) {
      const toggle = document.getElementById("eventEnginesToggle");
      first.toggleFound = Boolean(toggle);
      first.toggleActiveBefore = toggle ? toggle.classList.contains("active") : null;
      if (toggle) toggle.click();
      await new Promise((r) => setTimeout(r, 12000));
      first.toggleActiveAfter = toggle ? toggle.classList.contains("active") : null;
      first.notesAfterToggle = [...document.querySelectorAll(".build-breakdown-note")].map((n) => n.innerText);
      first.errorsAfterToggle = errors.slice();
    }
    done(first);
```

and make the Python side set `window.__SMOKE_TOGGLE` from a `--toggle` flag (add `if "--toggle" in sys.argv: ...` that prepends `<script>window.__SMOKE_TOGGLE = true;</script>` to the injected block, and drop `--toggle` from the positional arguments), then print `eventNotes`, `toggleActiveBefore/After` and `notesAfterToggle`.

Run: `python3 dev/tools/jxa-harness/browser_smoke.py index.html "Omnath, Locus of Rage" --toggle`
Expected: no JavaScript errors; before the toggle a note starting `Event engines (landfall):` listing producers such as `Skyclave Pick-Axe` with reasons; `toggleActiveBefore` true and `toggleActiveAfter` false; after the toggle no `Event engines` note. Also run it for `"Greasefang, Okiba Boss"` (no event note, engine note as before) and `pauper.html` with any uncommon creature you own.

- [ ] **Step 5: Record, commit, and merge to `main`**

Add a short "Phase 2b result" section to the end of the spec: suite counts, the switch-off result (56 unchanged), the switch-on moves per commander (swapped-in cards from the diff), the browser check, and what is deferred (see Rulings). Then:

```bash
git add tests dev/tools/jxa-harness/browser_smoke.py dev/tools/jxa-harness/baselines/2026-10-15-after-events.json dev/docs/superpowers/specs/2026-10-15-ability-labels.md && git commit -m "Record the event scoring result and add a switch check to the browser smoke test

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git checkout main && git merge --ff-only event-engines-2b && git log --oneline | head -3 && git status --short
```

Expected: the merge is a fast-forward and `git status` shows only the untracked `ManaBox_Collection(mine).csv`. Do not push. Then run `bash dev/tests/jxa/run_all.sh` once more on `main`: every suite `SUITE OK`.

**Stop here** and report to the player: the switch-off and switch-on results, the browser check, the exact steps to turn the switch off (Build Mode panel, "Event Engines" button; it rebuilds the deck), and the deferred list.

---

## Self-review (spec coverage)

- Req 17: the existing multi-hit, cap and weak-class rules still apply (event weights are added before the shared cap of 36; weak producers score 3 and are never injected). The report lists producers with the reason, as the graveyard enablers are (Task 2).
- Req 14/15/16 consumption: producers from Plan 2a now score for the eight event commanders and the other event commanders in the sample set (Task 1, measured in Task 4).
- Not covered, on purpose (Rulings): requirement 13 and the player's typal calls, the mill-direction recursion rule, amplifiers, Tormod's separate leaves-graveyard class (its producers score as an event instead), Klothys's devotion (already scored by Phase 1's devotion bonus).
- Placeholder scan: every code step shows the code or the exact replacement; commands show expected output. The soft spot is Task 4 step 4's edit to the smoke script, described in prose plus the JS to insert.
- Type consistency: `applyEventSwitch(needs, modePrefs)` is used identically in Tasks 1 and 3 and in `dump_decks.js`; the event class id is `"event:" + event` in `getEngineClassDetails` and tested by `isEventClass`; the report note is `{ label, items, more }` in Tasks 2 and 3.
