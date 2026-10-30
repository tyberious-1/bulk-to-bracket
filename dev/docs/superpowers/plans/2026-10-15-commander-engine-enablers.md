# Commander Engine Enablers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read what a commander's engine needs (a payload type in the graveyard, or devotion to a color) and steer the build toward owned cards that supply it, even when EDHREC does not list them.

**Architecture:** One new file, `js/analysis/engines.js`, holds pure functions: a needs parser, per-card class detection, and a bonus function. `scoreCard`/`scoreFallbackCard` add the bonus outside the theme-focus gate, and enabler cards are added to the theme-tier candidate set (`themeCardNames`) so they are considered before generic backfill. Commanders with no recognized need get a bonus of 0 and an unchanged candidate set.

**Tech Stack:** Plain global-scope browser JS (no modules, no build step). Tests run under JXA via `dev/tests/jxa/run.sh`; `node` is available for ad-hoc scripts only.

**Spec:** `dev/docs/superpowers/specs/2026-10-15-commander-engine-enablers.md`. Read it first; this plan implements requirements 1-16 and its verification section.

## Global Constraints

- All JS is plain global-scope script files. No ES modules, no bundler, no npm dependency, no `package.json`.
- A new `js/` file's `<script>` tag goes in BOTH `index.html` and `pauper.html` in the same position, and in `dev/tools/jxa-harness/build_harness.sh`'s script list.
- Tests live in `dev/tests/jxa/*.test.js`, use `runSuite({...})` with `assertEqual`/`assertTrue`/`assertClose` from `dev/tests/jxa/helpers.js`, and run under `osascript -l JavaScript` via `dev/tests/jxa/run.sh`. Do not switch the runner to node.
- Any test chain that includes `js/utils/cards.js` must also include `js/format.js`.
- zsh does not word-split an unquoted `$VAR`; keep file lists literal in the command, as shown in each step.
- Card objects in the pipeline carry lowercased `text` and `type`, plus `manaCost`, `cmc`, `colors`, `raw`. Deck entries carry no oracle text; join against `allOwnedCardData` (keyed by `normalizeCardName(name)`) when text is needed.
- Enabler bonuses are scoring lifts only, never forced slots. A commander with no recognized need must build exactly as before. Minimal Build must still skip theme-based backfill entirely.
- The user's collection deliberately omits flex staples (Sol Ring etc.); never report that as a gap. Never use Rosheen as a sample commander. Never commit the friend's collection files.
- Commit style: short, imperative subject, no `feat:`/`fix:` prefixes. End commit messages with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Test command shared by Tasks 1-6 (the `ENGINE_CHAIN` below is the harness script order up to `engines.js`, minus files these tests do not need):

```
dev/tests/jxa/run.sh js/constants.js js/utils/text.js js/utils/cards.js js/format.js js/analysis/pairing.js js/analysis/themes.js js/analysis/scoring.js js/analysis/engines.js dev/tests/jxa/engines.test.js
```

## Review Focus

Failure modes the spec implies but the task tests would not otherwise hit; each has a named test in the owning task.

1. A commander with no recognized need (Kaza-shaped text) must score every card with bonus 0 and add no candidates. Task 1 and Task 4 tests.
2. `commanderTexts` arrives as `[primaryText, undefined]` for a solo commander (`main.js` passes `partner?.text`); the parser must not throw or match "undefined". Task 1 test.
3. Cards with empty or missing `text`, `type`, or `manaCost` (basic lands, tokens, DFC faces) must classify to `[]` and score 0, never throw. Task 2 and Task 4 tests.
4. A partner pair reads both texts: the payload type from one and devotion from the other must both register. Task 1 test.
5. Opponent-only mill ("each opponent mills") and bare land-tap triggers must not count as enablers. Task 2 test.
6. A card hitting many classes must not exceed the bonus cap and swamp roles and curve. Task 4 test.

---

## Amendments (after the Task 3 pattern read; spec requirements 17-18)

These override the matching text in Tasks 4-5 below.

- **Task 4 weights:** add `crewHelper: 10` and raise `surveil` from 3 to 5 in `ENGINE_CLASS_WEIGHTS`. `sacrifice` stays 2 (the player's Vehicles average mana value 3.5, so sacrifice is a real investment). Add a test that `crewHelper` outweighs `crewBody` and that `surveil` outweighs `sacrifice`.
- **Task 5 injection:** `addEngineCandidates` skips a card whose classes are all in `{surveil, sacrifice, crewBody}` (they keep the score bonus). Add a test: a surveil-only card and a crewBody-only card are not added; a discard card still is.
- **Task 5b (new): engine lands.** In `js/build/manabase.js`, `evaluateNonbasicLand` gets `score += getEngineLandBonus(card, modePrefs.engineNeeds);` directly before `score *= modePrefs.manaBaseBias;`, and `landConditionMatchesStrategy` returns true when the tag equals `modePrefs.engineNeeds?.payloadType`. `getEngineLandBonus(card, needs)` lives in `js/analysis/engines.js`: `ENGINE_LAND_BONUS = 4` when the card is a land, the need has a payload type, and the card text matches `\b<type>s?\b`; otherwise 0. Tests in `dev/tests/jxa/engines.test.js`: Foul Roads-shaped text with a Vehicle need gets 4, a plain land gets 0, no need gets 0. `manabase.js` loads after `engines.js` in the script lists, so no order change is needed; add `js/build/manabase.js` to the test chain when testing the `evaluateNonbasicLand` wiring.

---

## File Structure

- Create: `js/analysis/engines.js` — needs parser, class detection, devotion pips, bonus, candidate injection, enabler listing. One responsibility: "what does this commander's engine need, and which owned cards supply it". Pure functions on card objects; no DOM, no fetch.
- Create: `dev/tests/jxa/engines.test.js` — suite `engines`.
- Create: `dev/tools/jxa-harness/engine_matches.js` — node script that prints which owned cards fall in each class, for pattern tuning by eye (Task 3).
- Create: `dev/tools/jxa-harness/engine_compare.py` — before/after comparison against the saved baseline (Task 7).
- Modify: `js/analysis/scoring.js` (`scoreCard` ~line 1014, `scoreFallbackCard` ~line 1055) — add the bonus.
- Modify: `js/main.js` (~line 304 and ~line 473) — set `modePrefs.engineNeeds`, inject candidates, pass enabler names to the report.
- Modify: `js/ui/report.js` (`displayBuildBreakdown`, line 184) — list enablers.
- Modify: `index.html`, `pauper.html`, `dev/tools/jxa-harness/build_harness.sh` — script tag/list entry after `scoring.js`.
- Modify: `dev/tools/jxa-harness/dump_decks.js` — same needs + injection as `main.js`.
- Modify: `AGENTS.md` — document the new file, hook points and build order (Task 7).

---

### Task 1: Needs parser and script wiring

**Files:**
- Create: `js/analysis/engines.js`
- Create: `dev/tests/jxa/engines.test.js`
- Modify: `index.html` (after line 185), `pauper.html` (after line 186), `dev/tools/jxa-harness/build_harness.sh` (after `js/analysis/scoring.js`)

**Interfaces:**
- Produces: `parseCommanderNeeds(commanderTexts: Array<string|undefined>) -> { payloadType: string|null, graveyard: boolean, devotionColors: string[] }` (`payloadType` lowercase, e.g. `"vehicle"`; `devotionColors` are letters `"W"|"U"|"B"|"R"|"G"`); `isEngineActive(needs) -> boolean`.

- [ ] **Step 1: Write the failing tests**

Create `dev/tests/jxa/engines.test.js`:

```js
runSuite("engines", {
  "parseCommanderNeeds: Greasefang needs Vehicles in the graveyard": function () {
    const needs = parseCommanderNeeds([
      "At the beginning of combat on your turn, return target Vehicle card from your graveyard to the battlefield. It gains haste. Return it to its owner's hand at the beginning of your next end step."
    ]);
    assertEqual(needs.payloadType, "vehicle");
    assertTrue(needs.graveyard, "graveyard zone expected");
    assertEqual(needs.devotionColors, []);
  },
  "parseCommanderNeeds: Tormod's Zombie tokens and graveyard trigger give a Zombie need": function () {
    const needs = parseCommanderNeeds([
      "Whenever one or more cards leave your graveyard, create a tapped 2/2 black Zombie creature token."
    ]);
    assertEqual(needs.payloadType, "zombie");
    assertTrue(needs.graveyard);
  },
  "parseCommanderNeeds: Callaphe's devotion to blue": function () {
    const needs = parseCommanderNeeds([
      "Callaphe's power is equal to your devotion to blue. (Each {U} in the mana costs of permanents you control counts toward your devotion to blue.)"
    ]);
    assertEqual(needs.devotionColors, ["U"]);
    assertEqual(needs.payloadType, null);
  },
  "parseCommanderNeeds: devotion to two colors": function () {
    const needs = parseCommanderNeeds(["Add mana equal to your devotion to white and black."]);
    assertEqual(needs.devotionColors, ["W", "B"]);
  },
  "parseCommanderNeeds: a solo commander passes an undefined partner text": function () {
    const needs = parseCommanderNeeds(["Flying", undefined]);
    assertEqual(needs, { payloadType: null, graveyard: false, devotionColors: [] });
    assertTrue(!isEngineActive(needs), "no need, not active");
  },
  "parseCommanderNeeds: a partner pair reads both texts": function () {
    const needs = parseCommanderNeeds([
      "Whenever one or more cards leave your graveyard, create a tapped 2/2 black Zombie creature token.",
      "Add mana equal to your devotion to blue."
    ]);
    assertEqual(needs.payloadType, "zombie");
    assertEqual(needs.devotionColors, ["U"]);
  },
  "parseCommanderNeeds: Kaza-shaped spell text has no need": function () {
    const needs = parseCommanderNeeds([
      "Flash. Whenever you cast an instant or sorcery spell, you may pay {X}. If you do, copy that spell and the copy costs {X} less to cast."
    ]);
    assertTrue(!isEngineActive(needs), "spell text with no payload or devotion must not activate");
  },
  "parseCommanderNeeds: a generic creature-card reanimator has no payload type": function () {
    const needs = parseCommanderNeeds(["Return target creature card from your graveyard to the battlefield."]);
    assertEqual(needs.payloadType, null);
    assertTrue(!isEngineActive(needs));
  },
  "parseCommanderNeeds: a color word is never a payload type": function () {
    const needs = parseCommanderNeeds(["Create a 1/1 white creature token."]);
    assertEqual(needs.payloadType, null);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run the shared test command from Global Constraints (it will fail on a missing `js/analysis/engines.js`; first create an empty file so the run reaches the tests: `: > js/analysis/engines.js`).
Expected: FAIL with `Can't find variable: parseCommanderNeeds`.

- [ ] **Step 3: Write the implementation**

Write `js/analysis/engines.js`:

```js
// Commander engine enablers: what a commander's engine needs (a payload type
// in the graveyard, or devotion to a color) and which owned cards supply it.
// Pure functions on card objects (lowercased `text`/`type`, `manaCost`, `cmc`).
// Spec: dev/docs/superpowers/specs/2026-10-15-commander-engine-enablers.md

const ENGINE_COLOR_LETTERS = { white: "W", blue: "U", black: "B", red: "R", green: "G" };

// Words that can precede "creature token" or follow "return target" without
// being a creature type. Core card types stay out of payloadType on purpose:
// a generic "return target creature card" commander is not a typal engine.
const ENGINE_NON_PAYLOAD_WORDS = new Set([
  "white", "blue", "black", "red", "green", "colorless", "tapped", "untapped",
  "creature", "artifact", "enchantment", "land", "instant", "sorcery", "permanent",
  "nonland", "planeswalker", "legendary", "token", "nontoken", "other", "another"
]);

function parseCommanderNeeds(commanderTexts) {
  const text = (commanderTexts || [])
    .filter((t) => typeof t === "string" && t.trim())
    .map((t) => t.toLowerCase())
    .join("\n");
  const needs = { payloadType: null, graveyard: false, devotionColors: [] };
  if (!text) return needs;

  needs.graveyard = /\bgraveyard\b/.test(text);

  const candidates = [];
  const returned = text.match(/return (?:target |up to \w+ target |each )?([a-z][a-z-]*) cards? from your graveyard/);
  if (returned) candidates.push(returned[1]);
  const token = text.match(/create [^.]*?\b([a-z]+) creature tokens?/);
  if (token) candidates.push(token[1]);
  needs.payloadType = candidates.find((word) => !ENGINE_NON_PAYLOAD_WORDS.has(word)) || null;

  const devotion = /devotion to (white|blue|black|red|green)(?: and (white|blue|black|red|green))?/g;
  let match;
  while ((match = devotion.exec(text)) !== null) {
    for (const word of [match[1], match[2]]) {
      const letter = word && ENGINE_COLOR_LETTERS[word];
      if (letter && !needs.devotionColors.includes(letter)) needs.devotionColors.push(letter);
    }
  }
  return needs;
}

// The graveyard flag alone does not activate anything: plenty of commanders
// mention the graveyard without a payload to enable.
function isEngineActive(needs) {
  return Boolean(needs && (needs.payloadType || (needs.devotionColors && needs.devotionColors.length)));
}
```

Add the script tag after `scoring.js` in both HTML files:

```html
  <script src="js/analysis/engines.js"></script>
```

(`index.html`: after the `js/analysis/scoring.js` line; `pauper.html`: same.) In `dev/tools/jxa-harness/build_harness.sh`, add `  js/analysis/engines.js` on the line after `  js/analysis/scoring.js`.

- [ ] **Step 4: Run the test to verify it passes**

Run the shared test command. Expected: 9 `PASS engines > ...` lines, no `FAIL`.

- [ ] **Step 5: Commit**

```bash
node --check js/analysis/engines.js
git add js/analysis/engines.js dev/tests/jxa/engines.test.js index.html pauper.html dev/tools/jxa-harness/build_harness.sh
git commit -m "Parse a commander's engine needs from its rules text" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Enabler class detection

**Files:**
- Modify: `js/analysis/engines.js`
- Modify: `dev/tests/jxa/engines.test.js`

**Interfaces:**
- Consumes: `parseCommanderNeeds`, `isEngineActive` (Task 1); `getCardText`, `getCardType`, `getCardSubtypes` (`js/utils/cards.js`).
- Produces: `getEngineClasses(card, needs) -> string[]` with class names drawn from `payload`, `recursion`, `recursionGeneric`, `discard`, `selfMill`, `surveil`, `sacrifice`, `lord`, `crewTap`, `crewBody`, `devotionPayoff`; `getCrewCost(card) -> number|null`; `countDevotionPips(card, colorLetter) -> number`.

- [ ] **Step 1: Write the failing tests**

Append inside the `runSuite("engines", {...})` object in `dev/tests/jxa/engines.test.js` (add a comma after the previous last entry):

```js
  ,
  "getEngineClasses: a Vehicle is payload for a Vehicle need": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const card = { name: "Test Copter", type: "artifact — vehicle", text: "flying. crew 1", cmc: 2, manaCost: "{2}" };
    assertTrue(getEngineClasses(card, needs).includes("payload"), "type line subtype match");
  },
  "getEngineClasses: a repeatable discard outlet and a looter": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const outlet = { name: "Outlet", type: "artifact", text: "{1}, discard a card: draw a card.", cmc: 2 };
    const looter = { name: "Looter", type: "creature — human", text: "whenever this creature attacks, draw a card, then discard a card.", cmc: 2 };
    assertTrue(getEngineClasses(outlet, needs).includes("discard"));
    assertTrue(getEngineClasses(looter, needs).includes("discard"));
  },
  "getEngineClasses: self-mill counts, opponent-only mill does not": function () {
    const needs = { payloadType: "zombie", graveyard: true, devotionColors: [] };
    const self = { name: "Self", type: "sorcery", text: "mill three cards, then return a creature card from your graveyard to your hand.", cmc: 2 };
    const opp = { name: "Opp", type: "creature — wizard", text: "when this creature enters, each opponent mills three cards.", cmc: 3 };
    assertTrue(getEngineClasses(self, needs).includes("selfMill"));
    assertTrue(!getEngineClasses(opp, needs).includes("selfMill"), "opponent-only mill is not an enabler");
  },
  "getEngineClasses: surveil is its own low class, not self-mill": function () {
    const needs = { payloadType: "zombie", graveyard: true, devotionColors: [] };
    const card = { name: "Seer", type: "creature — human", text: "when this creature enters, surveil 2.", cmc: 2 };
    const classes = getEngineClasses(card, needs);
    assertTrue(classes.includes("surveil"));
    assertTrue(!classes.includes("selfMill"));
  },
  "getEngineClasses: type-specific recursion vs generic recursion": function () {
    const needs = { payloadType: "zombie", graveyard: true, devotionColors: [] };
    const specific = { name: "Specific", type: "sorcery", text: "return target zombie card from your graveyard to the battlefield.", cmc: 4 };
    const generic = { name: "Generic", type: "sorcery", text: "return target creature card from your graveyard to the battlefield.", cmc: 4 };
    assertTrue(getEngineClasses(specific, needs).includes("recursion"));
    assertTrue(!getEngineClasses(specific, needs).includes("recursionGeneric"));
    assertTrue(getEngineClasses(generic, needs).includes("recursionGeneric"));
    assertTrue(!getEngineClasses(generic, needs).includes("recursion"));
  },
  "getEngineClasses: lords and anthems name the type with other / you control": function () {
    const needs = { payloadType: "zombie", graveyard: true, devotionColors: [] };
    const lord = { name: "Lord", type: "creature — zombie", text: "other zombies you control get +1/+1.", cmc: 3 };
    const plain = { name: "Plain", type: "creature — zombie", text: "this creature enters tapped.", cmc: 2 };
    assertTrue(getEngineClasses(lord, needs).includes("lord"));
    assertTrue(!getEngineClasses(plain, needs).includes("lord"));
  },
  "getEngineClasses: crew classes only apply to Vehicle needs": function () {
    const vehicle = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const zombie = { payloadType: "zombie", graveyard: true, devotionColors: [] };
    const trigger = { name: "Ace", type: "creature — human", text: "whenever ace crews a vehicle, scry 1.", cmc: 2 };
    const body = { name: "Body", type: "creature — human", text: "vigilance", cmc: 2, raw: { power: "3" } };
    assertTrue(getEngineClasses(trigger, vehicle).includes("crewTap"));
    assertTrue(getEngineClasses(body, vehicle).includes("crewBody"));
    assertTrue(!getEngineClasses(trigger, zombie).includes("crewTap"));
    assertTrue(!getEngineClasses(body, zombie).includes("crewBody"));
  },
  "getEngineClasses: a bare land-tap trigger is not a crew-tap payoff": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const land = { name: "Aura", type: "enchantment — aura", text: "whenever enchanted land becomes tapped for mana, its controller loses 1 life.", cmc: 2 };
    const self = { name: "Healer", type: "creature — human cleric", text: "whenever healer becomes tapped, you gain 1 life.", cmc: 1 };
    assertTrue(!getEngineClasses(land, needs).includes("crewTap"));
    assertTrue(getEngineClasses(self, needs).includes("crewTap"));
  },
  "getEngineClasses: empty or missing text never throws": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: ["U"] };
    assertEqual(getEngineClasses({ name: "Forest", type: "basic land — forest", text: "" }, needs), []);
    assertEqual(getEngineClasses({ name: "Bare" }, needs), []);
    assertEqual(getEngineClasses(null, needs), []);
  },
  "getEngineClasses: no active need means no classes": function () {
    const none = { payloadType: null, graveyard: false, devotionColors: [] };
    const card = { name: "Outlet", type: "artifact", text: "{1}, discard a card: draw a card.", cmc: 2 };
    assertEqual(getEngineClasses(card, none), []);
  },
  "getEngineClasses: devotion payoffs are found by their text": function () {
    const needs = { payloadType: null, graveyard: false, devotionColors: ["U"] };
    const payoff = { name: "Oracle", type: "creature — merfolk wizard", text: "when this creature enters, look at the top x cards, where x is your devotion to blue.", cmc: 2 };
    assertTrue(getEngineClasses(payoff, needs).includes("devotionPayoff"));
  },
  "getCrewCost: reads the crew number": function () {
    assertEqual(getCrewCost({ text: "flying. crew 3" }), 3);
    assertEqual(getCrewCost({ text: "no crew here" }), null);
    assertEqual(getCrewCost({}), null);
  },
  "countDevotionPips: counts plain and hybrid pips of one color": function () {
    assertEqual(countDevotionPips({ manaCost: "{1}{U}{U}" }, "U"), 2);
    assertEqual(countDevotionPips({ manaCost: "{U/R}{U/R}" }, "U"), 2);
    assertEqual(countDevotionPips({ manaCost: "{2/U}" }, "U"), 1);
    assertEqual(countDevotionPips({ manaCost: "{X}{R}" }, "U"), 0);
    assertEqual(countDevotionPips({}, "U"), 0);
  }
```

- [ ] **Step 2: Run the test to verify it fails**

Run the shared test command. Expected: the new tests FAIL with `Can't find variable: getEngineClasses`.

- [ ] **Step 3: Write the implementation**

Append to `js/analysis/engines.js`:

```js
// Patterns run against lowercased rules text. These are first-pass guesses;
// Task 3 tunes them against the owned collection by reading the matches.
const ENGINE_DISCARD_PATTERN = /discard (?:a|one|two) cards?\s*:|draw (?:a|two|three) cards?,? then discard (?:a|two|three) cards?|you may discard (?:a|two|three) cards?\. if you do, draw|\bconnive\b|\brummage\b/;
const ENGINE_SELF_MILL_PATTERN = /\bmills? (?:a|one|two|three|four|five|six|seven|x|\d+) cards?\b|put the top (?:a|one|two|three|four|five|x|\w+) cards? of your library into your graveyard/;
const ENGINE_OPPONENT_MILL_PATTERN = /(?:each|target) opponents? mills?\b/;
const ENGINE_SURVEIL_PATTERN = /\bsurveil (?:\d+|x)\b/;
const ENGINE_SACRIFICE_PATTERN = /sacrifice (?:a|an|another) [^:.]*:/;
const ENGINE_GENERIC_RECURSION_PATTERN = /return [^.]*\b(?:creature|permanent) cards? from your graveyard to (?:the battlefield|your hand)/;
const ENGINE_CREW_TAP_PATTERN = /crews? a vehicle|becomes? crewed|whenever [^.,]*\bcrews?\b|whenever [^.,]*? becomes tapped(?! for mana)(?![^.,]*\bland\b)/;
const ENGINE_DEVOTION_PAYOFF_PATTERN = /devotion to/;

function engineTypePattern(type) {
  return type.replace(/[^a-z-]/g, "");
}

function getEngineClasses(card, needs) {
  if (!card || !isEngineActive(needs)) return [];
  const text = getCardText(card);
  const classes = [];

  const type = needs.payloadType ? engineTypePattern(needs.payloadType) : "";
  if (type) {
    if (getCardSubtypes(card).includes(type)) classes.push("payload");

    if (needs.graveyard) {
      const specific = new RegExp(`return [^.]*\\b${type}s?\\b[^.]*cards? from your graveyard to (?:the battlefield|your hand)`);
      if (specific.test(text)) classes.push("recursion");
      else if (ENGINE_GENERIC_RECURSION_PATTERN.test(text)) classes.push("recursionGeneric");
      if (ENGINE_DISCARD_PATTERN.test(text)) classes.push("discard");
      if (ENGINE_SELF_MILL_PATTERN.test(text) && !ENGINE_OPPONENT_MILL_PATTERN.test(text)) classes.push("selfMill");
      if (ENGINE_SURVEIL_PATTERN.test(text)) classes.push("surveil");
      if (ENGINE_SACRIFICE_PATTERN.test(text)) classes.push("sacrifice");
    }

    if (new RegExp(`\\bother ${type}s?\\b|\\b${type}s? you control\\b`).test(text)) classes.push("lord");

    if (type === "vehicle") {
      if (ENGINE_CREW_TAP_PATTERN.test(text)) classes.push("crewTap");
      const power = Number(card.raw && card.raw.power);
      if (getCardType(card).includes("creature") && Number(card.cmc || 0) <= 3 && power >= 2) classes.push("crewBody");
    }
  }

  if (needs.devotionColors && needs.devotionColors.length && ENGINE_DEVOTION_PAYOFF_PATTERN.test(text)) {
    classes.push("devotionPayoff");
  }
  return classes;
}

// "Crew 3" -> 3. Vehicles with a low crew number are easier to use.
function getCrewCost(card) {
  const match = getCardText(card).match(/\bcrew (\d+)\b/);
  return match ? Number(match[1]) : null;
}

// Pips of one color in a card's mana cost: {U}, hybrid {U/R} and {2/U} count,
// generic and {X} do not.
function countDevotionPips(card, colorLetter) {
  const cost = String((card && card.manaCost) || "").toUpperCase();
  let pips = 0;
  for (const symbol of cost.match(/\{[^}]+\}/g) || []) {
    if (symbol.slice(1, -1).split("/").includes(colorLetter)) pips += 1;
  }
  return pips;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run the shared test command. Expected: all `engines` tests PASS. If a pattern test fails, adjust the pattern, not the test (the tests encode the spec).

- [ ] **Step 5: Commit**

```bash
node --check js/analysis/engines.js
git add js/analysis/engines.js dev/tests/jxa/engines.test.js
git commit -m "Classify owned cards by the engine need they supply" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Tune the patterns against the collection (checkpoint with the user)

The spec flags the crew patterns as unvalidated (requirement 14) and the graveyard patterns as noisy. This task prints what the patterns match in the user's collection so the matches can be read, then fixes the patterns. It ends in a user checkpoint.

**Files:**
- Create: `dev/tools/jxa-harness/engine_matches.js`
- Modify: `js/analysis/engines.js` (pattern constants only)
- Modify: `dev/tests/jxa/engines.test.js` (add one regression test per pattern fix)

**Interfaces:**
- Consumes: `parseCommanderNeeds`, `getEngineClasses`.

- [ ] **Step 1: Write the matches script**

Create `dev/tools/jxa-harness/engine_matches.js`:

```js
// Prints which owned cards fall into each engine class for a commander, so the
// patterns in js/analysis/engines.js can be tuned by reading the matches.
//
// Usage: node dev/tools/jxa-harness/engine_matches.js "Greasefang, Okiba Boss"
//        node dev/tools/jxa-harness/engine_matches.js "Tormod, the Desecrator + Ghost of Ramirez DePietro"
const fs = require("fs");
const vm = require("vm");

for (const file of ["js/constants.js", "js/utils/text.js", "js/utils/cards.js", "js/format.js", "js/analysis/engines.js"]) {
  vm.runInThisContext(fs.readFileSync(file, "utf8"), { filename: file });
}

const owned = JSON.parse(fs.readFileSync("dev/tools/jxa-harness/owned_raw.json", "utf8"));
const prefetch = JSON.parse(fs.readFileSync("dev/tools/jxa-harness/prefetch_data.json", "utf8"));

function toCard(raw) {
  const faces = Array.isArray(raw.card_faces) ? raw.card_faces : [];
  const text = raw.oracle_text || faces.map((f) => f.oracle_text || "").join("\n");
  return {
    name: raw.name,
    type: String(raw.type_line || "").toLowerCase(),
    text: text.toLowerCase(),
    cmc: Number(raw.cmc || 0),
    colors: raw.color_identity || [],
    manaCost: raw.mana_cost || (faces[0] && faces[0].mana_cost) || "",
    raw
  };
}

const key = process.argv[2];
if (!key) throw new Error("pass a commander name or 'A + B' pair");
const names = key.split(" + ");
const cmdCards = names.map((n) => {
  const raw = prefetch.commanderCards[n];
  if (!raw) throw new Error(`no fixture for ${n}; run dev/tools/jxa-harness/prefetch.py`);
  return toCard(raw);
});
const colors = new Set(cmdCards.flatMap((c) => c.colors));
const needs = parseCommanderNeeds(cmdCards.map((c) => c.text));
console.log("needs:", JSON.stringify(needs), "colors:", Array.from(colors).join(""));

const byClass = {};
const seen = new Set();
for (const raw of owned) {
  if (seen.has(raw.name)) continue;
  seen.add(raw.name);
  const card = toCard(raw);
  if (card.type.split("—")[0].includes("land")) continue;
  if (!card.colors.every((c) => colors.has(c))) continue;
  for (const cls of getEngineClasses(card, needs)) (byClass[cls] = byClass[cls] || []).push(card.name);
}
for (const [cls, list] of Object.entries(byClass)) {
  console.log(`\n${cls} (${list.length}): ${list.slice(0, 60).join(", ")}${list.length > 60 ? ", ..." : ""}`);
}
```

- [ ] **Step 2: Run it for the three engine commanders**

```bash
node dev/tools/jxa-harness/engine_matches.js "Greasefang, Okiba Boss"
node dev/tools/jxa-harness/engine_matches.js "Tormod, the Desecrator + Ghost of Ramirez DePietro"
node dev/tools/jxa-harness/engine_matches.js "Callaphe, Beloved of the Sea"
```

Expected: each prints `needs:` (Greasefang vehicle/graveyard, Tormod zombie/graveyard, Callaphe devotion `["U"]`) and one list per class. If a `ReferenceError` appears while loading a source file, add the missing dependency file to the `for` list at the top.

- [ ] **Step 3: Read the matches and fix the patterns**

For every class list, read the card names and look up the text of any you cannot place. Known problems to check first (from the 2026-10-15 measurement):
- `crewTap`: confirm Gearshift Ace, Sanwell, Ghost Ark, Turtle Van and Mighty Servant of Leuk-o appear, and that no bare land-tap card (Contaminated Ground-shaped) does.
- Crew helpers ("crews as though...", reduced crew costs) matched 0 before. Search the owned Oracle text for the real phrasing (e.g. `node -e` over `owned_raw.json` for `crew`) and add a `crewHelper` class only if real cards exist; otherwise record in the commit message that none were found.
- `selfMill`: the first measurement's opponent-mill exclusion accidentally excluded every plain "mill N" card. Confirm cards with plain "Mill three cards." now appear.
- `lord`: confirm real lords appear and "zombie"-mentioning non-lords do not.

For each fix, add a regression test to `dev/tests/jxa/engines.test.js` using a card text that actually matched wrongly (or failed to match), then change the pattern constant in `js/analysis/engines.js` until the shared test command passes.

- [ ] **Step 4: Checkpoint: show the user the class lists**

Post the printed lists for Greasefang, Tormod + Ghost and Callaphe in the conversation and ask the user to read them: which are real enablers, which are noise, what is missing. Do not start Task 4 until the user answers. Apply their corrections as further pattern changes with tests.

- [ ] **Step 5: Commit**

```bash
node --check js/analysis/engines.js
git add dev/tools/jxa-harness/engine_matches.js js/analysis/engines.js dev/tests/jxa/engines.test.js
git commit -m "Tune engine class patterns against the owned collection" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Bonus function and scoring hook

**Files:**
- Modify: `js/analysis/engines.js`
- Modify: `js/analysis/scoring.js` (`scoreCard`, `scoreFallbackCard`)
- Modify: `dev/tests/jxa/engines.test.js`

**Interfaces:**
- Consumes: `getEngineClasses`, `getCrewCost`, `countDevotionPips`, `isEngineActive`.
- Produces: `getEngineBonus(card, needs) -> number` (0 when no active need, never negative, never above `ENGINE_BONUS_CAP`); constants `ENGINE_CLASS_WEIGHTS`, `ENGINE_MULTI_HIT_BONUS`, `ENGINE_BONUS_CAP`, `ENGINE_DEVOTION_PIP_BONUS`. `modePrefs.engineNeeds` is the needs object read by `scoreCard`/`scoreFallbackCard`.

- [ ] **Step 1: Write the failing tests**

Append to the suite (comma-separated):

```js
  ,
  "getEngineBonus: zero when no need is active": function () {
    const none = { payloadType: null, graveyard: false, devotionColors: [] };
    const card = { name: "Outlet", type: "artifact", text: "{1}, discard a card: draw a card.", cmc: 2 };
    assertEqual(getEngineBonus(card, none), 0);
    assertEqual(getEngineBonus(card, undefined), 0);
    assertEqual(getEngineBonus(null, none), 0);
  },
  "getEngineBonus: a discard outlet outranks a surveil card for a graveyard need": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const outlet = { name: "Outlet", type: "artifact", text: "{1}, discard a card: draw a card.", cmc: 2 };
    const seer = { name: "Seer", type: "creature — human", text: "when this creature enters, surveil 2.", cmc: 2 };
    assertTrue(getEngineBonus(outlet, needs) > getEngineBonus(seer, needs), "discard must rank above surveil");
  },
  "getEngineBonus: a card serving two classes ranks above one serving a single class": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const single = { name: "Single", type: "artifact", text: "{1}, discard a card: draw a card.", cmc: 2 };
    const both = { name: "Both", type: "creature — human", text: "whenever both crews a vehicle, scry 1. {1}, discard a card: draw a card.", cmc: 2, raw: { power: "2" } };
    assertTrue(getEngineBonus(both, needs) > getEngineBonus(single, needs), "multi-hit must rank higher");
  },
  "getEngineBonus: capped so one card cannot swamp roles and curve": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const everything = {
      name: "Everything", type: "artifact — vehicle creature",
      text: "{1}, discard a card: draw a card. mill three cards. return target vehicle card from your graveyard to the battlefield. other vehicles you control get +1/+1. whenever everything crews a vehicle, scry 1. surveil 2. sacrifice a creature: draw a card. crew 1",
      cmc: 2, raw: { power: "3" }
    };
    assertTrue(getEngineBonus(everything, needs) <= ENGINE_BONUS_CAP, "bonus must not exceed the cap");
    assertEqual(getEngineBonus(everything, needs), ENGINE_BONUS_CAP);
  },
  "getEngineBonus: lower crew cost ranks a Vehicle higher": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const cheap = { name: "Cheap", type: "artifact — vehicle", text: "crew 1", cmc: 2 };
    const dear = { name: "Dear", type: "artifact — vehicle", text: "crew 5", cmc: 2 };
    assertTrue(getEngineBonus(cheap, needs) > getEngineBonus(dear, needs));
  },
  "getEngineBonus: devotion rewards pip-heavy permanents, not spells or lands": function () {
    const needs = { payloadType: null, graveyard: false, devotionColors: ["U"] };
    const creature = { name: "Heavy", type: "creature — merfolk", text: "flying", cmc: 2, manaCost: "{U}{U}" };
    const spell = { name: "Spell", type: "instant", text: "counter target spell.", cmc: 2, manaCost: "{U}{U}" };
    const light = { name: "Light", type: "creature — merfolk", text: "flying", cmc: 5, manaCost: "{4}{U}" };
    const land = { name: "Island", type: "basic land — island", text: "", cmc: 0, manaCost: "" };
    assertTrue(getEngineBonus(creature, needs) > getEngineBonus(light, needs), "more pips beats fewer");
    assertEqual(getEngineBonus(spell, needs), 0);
    assertEqual(getEngineBonus(land, needs), 0);
  },
  "scoreCard: an engine enabler scores higher than the same card with no active need": function () {
    const card = { name: "Outlet", type: "artifact", text: "{1}, discard a card: draw a card.", cmc: 2, colors: [] };
    const profile = { wantsCreatures: false, wantsTokens: false, wantsSacrifice: false, wantsGoWide: false, wantsTribal: false, tribalTypes: [] };
    const base = { synergyBias: 1, creatureBias: 1, tribalBias: 1, casualBias: 1, fewerStaplesBias: 1, themeFocus: "", minimalBuild: false, curveFirst: false };
    const edhrec = { synergy: 0, decks: 0, potential_decks: 0, label: "Collection Fallback", labels: ["Collection Fallback"] };
    const off = scoreFallbackCard(card, [], profile, [], Object.assign({}, base));
    const on = scoreFallbackCard(card, [], profile, [], Object.assign({}, base, { engineNeeds: { payloadType: "vehicle", graveyard: true, devotionColors: [] } }));
    assertTrue(on > off, "bonus must reach the fallback score outside theme focus");
    const onCard = scoreCard(card, edhrec, [], profile, [], Object.assign({}, base, { engineNeeds: { payloadType: "vehicle", graveyard: true, devotionColors: [] } }));
    const offCard = scoreCard(card, edhrec, [], profile, [], Object.assign({}, base));
    assertTrue(onCard > offCard, "bonus must reach the EDHREC score outside theme focus");
  }
```

The last test passes hand-built `profile` and `base` objects to `scoreCard`/`scoreFallbackCard`. If either function throws on a field the fixture lacks (for example in `isActiveBuildTribal`), build the fixtures from the real helpers instead: `const profile = getCommanderStrategyProfile("Test", [], [])` and `const base = getModePreferences("", profile)`. Keep the assertions unchanged.

- [ ] **Step 2: Run the test to verify it fails**

Run the shared test command. Expected: FAIL with `Can't find variable: getEngineBonus` (or `ENGINE_BONUS_CAP`).

- [ ] **Step 3: Write the implementation**

Append to `js/analysis/engines.js`:

```js
// Initial weights, in the same point scale as scoreCard's theme bonuses (a
// plan signature card gets 20-40). Tuned against the baseline in Task 7.
// Repeatable discard and direct self-mill rank first for graveyard engines,
// then recursion, then payload, then surveil, with slow sacrifice outlets last.
const ENGINE_CLASS_WEIGHTS = {
  discard: 14,
  selfMill: 12,
  recursion: 12,
  lord: 12,
  crewTap: 14,
  devotionPayoff: 10,
  recursionGeneric: 5,
  crewBody: 5,
  payload: 4,
  surveil: 3,
  sacrifice: 2
};
const ENGINE_MULTI_HIT_BONUS = 6;      // per class beyond the first
const ENGINE_BONUS_CAP = 36;           // keep one card from swamping roles and curve
const ENGINE_DEVOTION_PIP_BONUS = 4;   // per pip of the devotion color on a permanent
const ENGINE_DEVOTION_PIP_CAP = 12;

function getEngineBonus(card, needs) {
  if (!card || !isEngineActive(needs)) return 0;
  const type = getCardType(card);
  if (type.split("—")[0].includes("land")) return 0;

  const classes = getEngineClasses(card, needs);
  let bonus = 0;
  for (const cls of classes) bonus += ENGINE_CLASS_WEIGHTS[cls] || 0;
  if (classes.length > 1) bonus += ENGINE_MULTI_HIT_BONUS * (classes.length - 1);

  if (needs.payloadType === "vehicle" && classes.includes("payload")) {
    const crew = getCrewCost(card);
    if (crew !== null && crew <= 2) bonus += 4;
    else if (crew !== null && crew <= 3) bonus += 2;
    if (/when(?:ever)? [^.]*(?:enters|attacks)/.test(getCardText(card))) bonus += 2;
  }

  // Devotion counts permanents only: an instant or sorcery is never on the battlefield.
  if (needs.devotionColors && needs.devotionColors.length && !type.includes("instant") && !type.includes("sorcery")) {
    const pips = needs.devotionColors.reduce((sum, color) => sum + countDevotionPips(card, color), 0);
    if (pips > 0) {
      bonus += Math.min(ENGINE_DEVOTION_PIP_CAP, ENGINE_DEVOTION_PIP_BONUS * pips);
      if (Number(card.cmc || 0) <= 3 && pips >= 2) bonus += 2;
    }
  }
  return Math.min(ENGINE_BONUS_CAP, bonus);
}
```

In `js/analysis/scoring.js`, `scoreCard`, directly after `themeBonus += getThemeFocusAdjustment(card, tags, modePrefs);` (line ~1014) add:

```js
  // Commander-driven, so it sits outside the theme-focus gate: the engine a
  // commander needs does not depend on which plan the player picked.
  themeBonus += getEngineBonus(card, modePrefs.engineNeeds);
```

In `scoreFallbackCard`, directly after `score += getThemeFocusAdjustment(card, tags, modePrefs);` (line ~1055) add:

```js
  score += getEngineBonus(card, modePrefs.engineNeeds);
```

- [ ] **Step 4: Run the test to verify it passes**

Run the shared test command. Expected: all `engines` tests PASS. Also run the existing scoring suite to confirm nothing else moved:

```
dev/tests/jxa/run.sh js/constants.js js/utils/text.js js/utils/cards.js js/format.js js/analysis/pairing.js js/analysis/themes.js js/analysis/scoring.js js/analysis/engines.js dev/tests/jxa/scoring.test.js
```

Expected: no `FAIL`. (`engines.js` is loaded in the chain because `scoring.js` now calls `getEngineBonus` at runtime.)

- [ ] **Step 5: Commit**

```bash
node --check js/analysis/engines.js js/analysis/scoring.js
git add js/analysis/engines.js js/analysis/scoring.js dev/tests/jxa/engines.test.js
git commit -m "Score engine enablers outside the theme-focus gate" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Candidate injection and pipeline wiring

Enabler cards that no theme matches would only be reached by generic backfill, after the theme tier runs dry. This task puts them in the theme-tier set and sets `modePrefs.engineNeeds` in the real app and the harness.

**Files:**
- Modify: `js/analysis/engines.js`
- Modify: `js/main.js` (~line 304 and ~line 473)
- Modify: `dev/tools/jxa-harness/dump_decks.js`
- Modify: `dev/tests/jxa/engines.test.js`

**Interfaces:**
- Consumes: `getEngineClasses`, `countDevotionPips`, `isEngineActive`, `legalForCommander(cardColors, commanderColors, card)`, `normalizeCardName`.
- Produces: `addEngineCandidates(themeCardNames: Map, needs, allOwnedCardData: Map<normalizedName, card>, commanderColors: string[]) -> Map` (mutates and returns the same Map; entries are `{ rank: 0, hits: number }`).

- [ ] **Step 1: Write the failing tests**

Append to the suite (comma-separated):

```js
  ,
  "addEngineCandidates: adds enabler cards to the theme tier, skips lands and illegal colors": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const outlet = { name: "Outlet", type: "artifact", text: "{1}, discard a card: draw a card.", cmc: 2, colors: [] };
    const redOutlet = { name: "Red Outlet", type: "artifact", text: "{1}, discard a card: draw a card.", cmc: 2, colors: ["R"] };
    const land = { name: "Cavern", type: "land", text: "{t}, discard a card: add {c}.", cmc: 0, colors: [] };
    const filler = { name: "Filler", type: "creature — bear", text: "", cmc: 2, colors: ["W"] };
    const owned = new Map([
      [normalizeCardName("Outlet"), outlet],
      [normalizeCardName("Red Outlet"), redOutlet],
      [normalizeCardName("Cavern"), land],
      [normalizeCardName("Filler"), filler]
    ]);
    const names = addEngineCandidates(new Map(), needs, owned, ["W", "B"]);
    assertTrue(names.has(normalizeCardName("Outlet")), "legal enabler added");
    assertTrue(!names.has(normalizeCardName("Red Outlet")), "off-color enabler skipped");
    assertTrue(!names.has(normalizeCardName("Cavern")), "lands skipped");
    assertTrue(!names.has(normalizeCardName("Filler")), "non-enabler skipped");
    assertEqual(names.get(normalizeCardName("Outlet")), { rank: 0, hits: 1 });
  },
  "addEngineCandidates: an existing theme match keeps its rank and gains hits": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const outlet = { name: "Outlet", type: "artifact", text: "{1}, discard a card: draw a card.", cmc: 2, colors: [] };
    const owned = new Map([[normalizeCardName("Outlet"), outlet]]);
    const existing = new Map([[normalizeCardName("Outlet"), { rank: 2, hits: 1 }]]);
    addEngineCandidates(existing, needs, owned, ["W", "B"]);
    assertEqual(existing.get(normalizeCardName("Outlet")), { rank: 0, hits: 2 });
  },
  "addEngineCandidates: devotion only pulls in cards with two or more pips": function () {
    const needs = { payloadType: null, graveyard: false, devotionColors: ["U"] };
    const heavy = { name: "Heavy", type: "creature — merfolk", text: "flying", cmc: 2, colors: ["U"], manaCost: "{U}{U}" };
    const light = { name: "Light", type: "creature — merfolk", text: "flying", cmc: 2, colors: ["U"], manaCost: "{1}{U}" };
    const owned = new Map([[normalizeCardName("Heavy"), heavy], [normalizeCardName("Light"), light]]);
    const names = addEngineCandidates(new Map(), needs, owned, ["U"]);
    assertTrue(names.has(normalizeCardName("Heavy")));
    assertTrue(!names.has(normalizeCardName("Light")));
  },
  "addEngineCandidates: no active need leaves the map untouched": function () {
    const none = { payloadType: null, graveyard: false, devotionColors: [] };
    const outlet = { name: "Outlet", type: "artifact", text: "{1}, discard a card: draw a card.", cmc: 2, colors: [] };
    const names = addEngineCandidates(new Map(), none, new Map([[normalizeCardName("Outlet"), outlet]]), ["W"]);
    assertEqual(names.size, 0);
  },
  "listEngineEnablers: names deck cards that carry an engine class": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const outlet = { name: "Outlet", type: "artifact", text: "{1}, discard a card: draw a card.", cmc: 2, colors: [] };
    const filler = { name: "Filler", type: "creature — bear", text: "", cmc: 2, colors: [] };
    const owned = new Map([[normalizeCardName("Outlet"), outlet], [normalizeCardName("Filler"), filler]]);
    const deck = [{ name: "Outlet", role: "synergy" }, { name: "Filler", role: "synergy" }, { name: "Plains", role: "land" }];
    assertEqual(listEngineEnablers(deck, owned, needs), ["Outlet"]);
    assertEqual(listEngineEnablers(deck, owned, { payloadType: null, graveyard: false, devotionColors: [] }), []);
  }
```

- [ ] **Step 2: Run the test to verify it fails**

Run the shared test command. Expected: FAIL with `Can't find variable: addEngineCandidates`.

- [ ] **Step 3: Write the implementation**

Append to `js/analysis/engines.js`:

```js
// Puts owned enabler cards into the theme-tier candidate set. Without this an
// enabler that matches no EDHREC theme is only reached by generic backfill,
// after the theme tier runs dry, and the score bonus never gets a say.
function addEngineCandidates(themeCardNames, needs, allOwnedCardData, commanderColors) {
  if (!isEngineActive(needs)) return themeCardNames;
  for (const [normalizedName, card] of allOwnedCardData) {
    if (getCardType(card).split("—")[0].includes("land")) continue;
    if (!legalForCommander(card.colors || [], commanderColors, card)) continue;

    let hits = getEngineClasses(card, needs).length;
    if (!hits && needs.devotionColors.length) {
      const heavy = needs.devotionColors.some((color) => countDevotionPips(card, color) >= 2);
      const type = getCardType(card);
      if (heavy && !type.includes("instant") && !type.includes("sorcery")) hits = 1;
    }
    if (!hits) continue;

    const existing = themeCardNames.get(normalizedName);
    if (existing) {
      existing.rank = 0;
      existing.hits += hits;
    } else {
      themeCardNames.set(normalizedName, { rank: 0, hits });
    }
  }
  return themeCardNames;
}
```

An engine match is a top-tier fit, so an existing theme match is moved to `rank: 0` and its `hits` grow by the classes served.

Also append the deck-listing helper used by Task 6:

```js
// Names of nonland deck cards that carry an engine class. Deck entries have no
// oracle text, so the text comes from allOwnedCardData.
function listEngineEnablers(deck, allOwnedCardData, needs) {
  if (!isEngineActive(needs)) return [];
  const names = [];
  for (const entry of deck || []) {
    if (entry.role === "land") continue;
    const card = allOwnedCardData.get(normalizeCardName(entry.name));
    if (card && getEngineClasses(card, needs).length) names.push(entry.name);
  }
  return names;
}
```

In `js/main.js`, directly after `modePrefs.planSignature = getActivePlanSignature(...)` (line ~304):

```js
  modePrefs.engineNeeds = parseCommanderNeeds([commanders.primary?.text, commanders.partner?.text]);
```

In `js/main.js`, directly after the `themeCardNames` ternary (after the `: await buildThemeCandidateNames(...);` statement ending ~line 481) and before the `logMessage(` call:

```js
  if (!modePrefs.minimalBuild) {
    addEngineCandidates(themeCardNames, modePrefs.engineNeeds, allOwnedCardData, commanders.colors);
  }
```

In `dev/tools/jxa-harness/dump_decks.js`, after `const modePrefs = getModePreferences(mode, strategyProfile);` add:

```js
  modePrefs.engineNeeds = parseCommanderNeeds([commanderCard.text, partnerCard?.text]);
```

and after the `const themeCardNames = modePrefs.minimalBuild ? new Map() : await buildThemeCandidateNames(...)` statement (before `return buildDeckFromScoredPool(`) add:

```js
  if (!modePrefs.minimalBuild) {
    addEngineCandidates(themeCardNames, modePrefs.engineNeeds, allOwnedCardData, commanders.colors);
  }
```

(`themeCardNames` is a `const` Map; mutating it is fine.)

- [ ] **Step 4: Run the tests to verify they pass**

Run the shared test command. Expected: all `engines` tests PASS. Then syntax-check and run the existing deck suite with the full harness chain ahead of it:

```
node --check js/main.js js/analysis/engines.js dev/tools/jxa-harness/dump_decks.js
dev/tests/jxa/run.sh js/constants.js js/utils/text.js js/utils/cards.js js/format.js js/analysis/pairing.js js/collection/csv.js js/analysis/themes.js js/analysis/scoring.js js/analysis/engines.js js/api/http.js js/api/edhrec.js js/cache.js js/api/scryfall.js js/utils/deck-stats.js js/build/bracket.js js/build/manabase.js js/build/type-plan.js js/build/deck.js dev/tests/jxa/deck.test.js
```

Expected: no `FAIL`.

- [ ] **Step 5: Commit**

```bash
git add js/analysis/engines.js js/main.js dev/tools/jxa-harness/dump_decks.js dev/tests/jxa/engines.test.js
git commit -m "Put owned engine enablers in the theme tier and set the commander's needs" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Say so in the report

**Files:**
- Modify: `js/ui/report.js` (`displayBuildBreakdown`, line 184)
- Modify: `js/main.js` (the `displayBuildBreakdown(sanitizedFinalDeck)` call, ~line 532)

**Interfaces:**
- Consumes: `listEngineEnablers(deck, allOwnedCardData, needs)` (Task 5), `modePrefs.engineNeeds`.
- Produces: `displayBuildBreakdown(deck, engineNote)` where `engineNote` is `{ label: string, names: string[] }` or `null`.

- [ ] **Step 1: Write the test for the label text**

Add to `js/analysis/engines.js` a pure helper and test it (the DOM function itself is not unit-tested in this repo). Append to the suite:

```js
  ,
  "describeEngineNeeds: a readable label per need": function () {
    assertEqual(describeEngineNeeds({ payloadType: "vehicle", graveyard: true, devotionColors: [] }), "Engine enablers for Vehicle in the graveyard");
    assertEqual(describeEngineNeeds({ payloadType: "zombie", graveyard: false, devotionColors: [] }), "Engine enablers for Zombie");
    assertEqual(describeEngineNeeds({ payloadType: null, graveyard: false, devotionColors: ["U", "B"] }), "Engine enablers for devotion to U/B");
    assertEqual(describeEngineNeeds({ payloadType: "vehicle", graveyard: true, devotionColors: ["U"] }), "Engine enablers for Vehicle in the graveyard, devotion to U");
    assertEqual(describeEngineNeeds({ payloadType: null, graveyard: false, devotionColors: [] }), "");
  }
```

Run the shared test command. Expected: FAIL with `Can't find variable: describeEngineNeeds`.

- [ ] **Step 2: Implement the helper**

Append to `js/analysis/engines.js`:

```js
function describeEngineNeeds(needs) {
  if (!isEngineActive(needs)) return "";
  const parts = [];
  if (needs.payloadType) {
    const name = needs.payloadType.charAt(0).toUpperCase() + needs.payloadType.slice(1);
    parts.push(needs.graveyard ? `${name} in the graveyard` : name);
  }
  if (needs.devotionColors && needs.devotionColors.length) parts.push(`devotion to ${needs.devotionColors.join("/")}`);
  return `Engine enablers for ${parts.join(", ")}`;
}
```

Run the shared test command again. Expected: PASS.

- [ ] **Step 3: Show it in the breakdown**

In `js/ui/report.js`, change the signature and template of `displayBuildBreakdown`:

```js
function displayBuildBreakdown(deck, engineNote) {
```

Add, after the `basicCount` line:

```js
  const engineHtml = engineNote && engineNote.names.length
    ? `<div class="build-breakdown-note"><strong>${engineNote.label}:</strong> ${engineNote.names.join(", ")}</div>`
    : "";
```

and put `${engineHtml}` on the line directly before the closing `</div>` of the `info-card` in the template (after the `build-breakdown-grid` `</div>`).

In `js/main.js`, replace `displayBuildBreakdown(sanitizedFinalDeck);` with:

```js
  const engineNames = listEngineEnablers(sanitizedFinalDeck, allOwnedCardData, modePrefs.engineNeeds);
  displayBuildBreakdown(
    sanitizedFinalDeck,
    engineNames.length ? { label: describeEngineNeeds(modePrefs.engineNeeds), names: engineNames } : null
  );
```

- [ ] **Step 4: Check it renders**

`node --check js/ui/report.js js/main.js`, then open `index.html` in a browser, load the user's ManaBox CSV, build Greasefang, and confirm the Build Breakdown card shows the "Engine enablers for Vehicle in the graveyard" line with card names, and that a Kaza build shows no such line. Do the same on `pauper.html`. If a browser run is not possible in this session, say so in the report rather than claiming it works.

- [ ] **Step 5: Commit**

```bash
git add js/analysis/engines.js js/ui/report.js js/main.js dev/tests/jxa/engines.test.js
git commit -m "List the engine enablers that steered a build" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Measure against the baseline, tune, document

**Files:**
- Create: `dev/tools/jxa-harness/engine_compare.py`
- Modify: `js/analysis/engines.js` (constants only, if tuning is needed)
- Modify: `AGENTS.md`
- Create: `dev/tools/jxa-harness/baselines/2026-10-15-after-enablers.json`

- [ ] **Step 1: Write the comparison script**

Create `dev/tools/jxa-harness/engine_compare.py`:

```python
#!/usr/bin/env python3
"""Compare two dump_decks.js outputs (baseline vs after) for the engine-enablers work.

Prints, per commander: cards added/removed, creature count before/after, and
whether the deck is unchanged. Engine commanders also get class counts from
engine_matches-style patterns passed in via --classes (name list files are not
needed: the script just diffs card names and reports creature counts using the
owned collection's type lines).

Usage:
  python3 dev/tools/jxa-harness/engine_compare.py BEFORE.json AFTER.json [--only "A|B"]
"""
import argparse
import json

OWNED = "dev/tools/jxa-harness/owned_raw.json"


def load_types():
    types = {}
    for card in json.load(open(OWNED)):
        types.setdefault(card["name"], card.get("type_line", ""))
    return types


def creatures(names, types):
    return sum(1 for n in names if "Creature" in types.get(n, "").split("—")[0])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("before")
    parser.add_argument("after")
    parser.add_argument("--only", default="")
    args = parser.parse_args()
    before = json.load(open(args.before))
    after = json.load(open(args.after))
    only = set(args.only.split("|")) if args.only else None
    types = load_types()

    unchanged = []
    for key in before:
        if only and key not in only:
            continue
        if key not in after:
            continue
        b, a = before[key]["current"], after[key]["current"]
        added, removed = sorted(set(a) - set(b)), sorted(set(b) - set(a))
        if not added and not removed:
            unchanged.append(key)
            continue
        print(f"\n== {key}: {len(b)} -> {len(a)} cards, creatures {creatures(b, types)} -> {creatures(a, types)}")
        print(f"   added   ({len(added)}): {', '.join(added)}")
        print(f"   removed ({len(removed)}): {', '.join(removed)}")
    print(f"\nunchanged ({len(unchanged)}): {', '.join(unchanged)}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Build the after set**

```bash
bash dev/tools/jxa-harness/build_harness.sh dev/tools/jxa-harness/combined.js
cat dev/tools/jxa-harness/combined.js dev/tools/jxa-harness/dump_decks.js > /private/tmp/engine_run.js
osascript -l JavaScript /private/tmp/engine_run.js 2>/dev/null | grep '^DECKS ' | sed 's/^DECKS //' > dev/tools/jxa-harness/baselines/2026-10-15-after-enablers.json
```

(Prefer the session scratchpad directory over `/tmp` for `engine_run.js` if one is set.) Expected: a JSON file with the same 55 keys as the baseline; the run takes about 2 minutes. `combined.js` is a build artifact: check `git status` and do not commit it unless it was already tracked.

- [ ] **Step 3: Diff and check the spec's verification list**

```bash
python3 dev/tools/jxa-harness/engine_compare.py dev/tools/jxa-harness/baselines/2026-10-15-before-enablers.json dev/tools/jxa-harness/baselines/2026-10-15-after-enablers.json
```

Check each against the spec's Verification section and report the numbers:
1. **Engine presence:** run `node dev/tools/jxa-harness/engine_matches.js` for Greasefang, the Tormod + Ghost pair and Callaphe, then count how many deck cards (after) fall in each class versus before. Greasefang started at 3 discard, 0 self-mill; Callaphe at 59 blue pips on 50 permanents.
2. **Structural health:** creature count, roles and curve stay close to baseline (Greasefang 17 creatures, Tormod pair 25, Callaphe 17).
3. **Collateral:** Kaza, Zodiark, Fynn and Kardur should be unchanged. If any is not, `parseCommanderNeeds` found a need in its text; print its needs with `engine_matches.js`, and report it to the user instead of forcing it unchanged.
4. **Sparse:** set `SAMPLE_FRACTION = 0.3` at the top of `dump_decks.js` for one run on Greasefang and the pair, confirm full decks, then set it back to `1`.
5. **Overfit:** pick one commander not used for tuning that has a need (run `engine_matches.js` over a few fixture commanders to find one) and check its diff by eye.

- [ ] **Step 4: Tune weights if the diff shows a problem**

If enablers crowd out roles or the creature count drops, lower `ENGINE_BONUS_CAP` or the class weights in `js/analysis/engines.js`; if enablers barely appear, raise them. After each change rerun Steps 2-3 and the shared test command. This answers the spec's open question about bonus size; record the final numbers and the reasoning in the commit message.

- [ ] **Step 5: Player sign-off**

Print the full after-deck lists and the enablers picked for Greasefang, Tormod + Ghost and Callaphe, and ask the user to read them and decide whether the builds are better. Apply their notes before the final commit.

- [ ] **Step 6: Document and commit**

In `AGENTS.md`, under the Layout list, add after the `js/analysis/` line:

```
- `js/analysis/engines.js` — commander engine enablers: `parseCommanderNeeds` reads a
  payload type (Vehicle, Zombie) and devotion color from the commander's text,
  `getEngineClasses`/`getEngineBonus` classify and score owned cards (discard, self-mill,
  recursion, lords, crew, devotion pips), `addEngineCandidates` puts them in the theme
  tier, `modePrefs.engineNeeds` carries the needs. Loaded right after `scoring.js`. Spec:
  `dev/docs/superpowers/specs/2026-10-15-commander-engine-enablers.md`.
```

and under "Testing", add `engines` to the suite list. Also note in the Testing section that `dev/tools/jxa-harness/baselines/` holds saved `dump_decks.js` outputs and `engine_compare.py` diffs two of them.

```bash
git add dev/tools/jxa-harness/engine_compare.py dev/tools/jxa-harness/baselines/2026-10-15-after-enablers.json js/analysis/engines.js AGENTS.md
git commit -m "Measure engine enablers against the baseline and document them" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** req 1 -> Task 1; 2 and 3 -> Tasks 2 and 4; 4 -> Task 4 (outside the theme-focus gate) and Task 5 (theme-tier injection, which the spec did not name but the pipeline needs); 5 -> Task 5 skips injection under Minimal Build and the bonus is a scoring lift only; 6 -> Task 6; 7-9 (devotion) -> Tasks 1, 2, 4, 5; 10 (lords) -> Task 2; 11-13 (crew, crew-tap payoffs, balance) -> Tasks 2 and 4; 14 (validate crew patterns) -> Task 3; 15 (multi-hit) -> Task 4; 16 (follow-up spec) -> not built, by design. Verification section -> Task 7.
- **Known gaps:** crew helpers ("crews as though...") may not exist in the collection; Task 3 decides. The weights are first guesses; Task 7 tunes them. The report line in Task 6 is not unit-tested (DOM); it is checked in a browser or reported as unchecked.
- **Type consistency:** `parseCommanderNeeds`/`isEngineActive`/`getEngineClasses`/`getCrewCost`/`countDevotionPips`/`getEngineBonus`/`addEngineCandidates`/`listEngineEnablers`/`describeEngineNeeds` and `modePrefs.engineNeeds` are used with the same names in every task.
