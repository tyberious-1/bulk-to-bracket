# Ability Labels, Phase 2a (events and producers, read-only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach the ability tagger to read the seven event commanders' own abilities (landfall, quoted token abilities, "second card/spell", increment, devotion), record the events a commander runs on, say which owned cards produce each event, and print those lists for the player to read. Nothing scores from events yet.

**Architecture:** `abilities.js` gains the missing labels and a `quoted` list on each ability record. `engines.js` gains `getCommanderEvents` (called from `parseCommanderNeeds`, which gets an `events` field and reads devotion from labels) and `getEventProducers(card, needs)`. A new node tool prints producer lists. Because no scoring reads `events`, all 56 sample builds must stay identical. Phase 2b (a separate plan, written after the player reads the lists) adds the typal rule, event scoring, the mill-direction recursion rule and the report line.

**Tech Stack:** Plain global-scope browser JS, no modules, no build step. Tests run under JXA (`dev/tests/jxa/run.sh`); `node` is for ad-hoc scripts only.

**Spec:** `dev/docs/superpowers/specs/2026-10-15-ability-labels.md`, Phase 2 (requirements 13-17) and Verification 10. This plan covers requirements 14 and 15, and the producer part of 16. It deliberately stops before 13 (typal) and 17 (weights); see "Why two plans". Read the spec first.

## Global Constraints

- No module system, bundler or npm. This plan adds no `js/` file, so no `<script>` change is needed; a new tool goes under `dev/tools/jxa-harness/`.
- Run suites with `bash dev/tests/jxa/run_all.sh [name]` (it reads the file list from `build_harness.sh`). zsh does not word-split `$VAR`.
- The user's collection deliberately omits flex staples (Sol Ring etc.); never report that as a gap. Never use Rosheen as a sample commander. The friend's collection files are never committed.
- Say "typal", not "tribal", in visible text.
- Commit style: short imperative subjects, no `feat:`/`fix:` prefixes, each ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- **Don't over-tune for one commander.** Any scoring-adjacent change must leave all 56 sample builds unchanged unless the plan says otherwise (memory: `dont-overtune-for-one-commander`).
- **Ask when unsure.** If a printed list or a result surprises you, say so and ask; do not present a guess as a cause (memory: `ask-when-unsure`).
- **Spend:** native execution, no subagents unless the user asks; use Haiku only for bounded read-only lookups (memory: `use-haiku-when-safe`). Use direct Read/Grep/Bash.
- Work on a new branch `event-engines` cut from `main` (Phase 1 is merged there). Do not merge it; the player signs off first (Task 5).
- Never leave a stray `cat` or other stdin-reading command in a shell call: it hangs.

## Why two plans

Spec Verification 10: "no card-level expectations are written until the player has read the printed lists." The producer rules in this plan are definitions, not tuned numbers, and several are provisional (see "Rulings"). So this plan builds the tagger and the producers, prints the lists, and stops. The typal rule (13) and the weights (17) are written as Plan 2b after the player reads the lists, because the typal rule (13) has one open question for the four commanders whose tokens are not their own type, and the event weights (17) should be set while reading the producer lists, not before.

## Rulings made while planning

- **Producers are definitions, and the lists are the review.** Four lists will be very wide (Kuja about 1,400 owned cards, Council of Four about 480, Ant-Man about 500, Berta's counters about 415). That is expected; Plan 2b narrows by strength. Cost if wrong: none in 2a, nothing scores.
- **Noncreature spell producers.** The spec says "being an instant or sorcery". Artifacts, enchantments and planeswalkers are also noncreature spells, so they count as weak producers ("noncreature permanent"); the player chose this (option A, 2026-10-15). Cost if wrong: a weak producer is scored but not injected in 2b; one condition to remove.
- **Amplifiers are a Plan 2b class, not a producer.** The player's call: a permanent that raises the damage of the next noncreature spell (for Kuja, damage doubling or +1) is worth more than a plain producer. That is a payoff-amplifier label and a bonus, so it is written in 2b after the lists are read.
- **Provisional producer rules** (the player corrects these when reading the lists): `cast-second` = a spell or a card that draws, at mana value 2 or less; `cast-bigger` = a base cost of 5+ is a solid producer, and an X spell is a weak (flexible) one because the player chooses X (player's note, 2026-10-15: X can be 1, 2 or large); `graveyard-fill` includes loot, rummage, discard and surveil (weak); `landfall` includes landfall cards themselves (spec line) and land fetch, ramp and extra land drops.
- **`cast` (any spell) has no producer list.** Every spell is one, so it carries no information. Commanders: Ivy, Katara, Raff, Balmor, Vega, Verazol.
- **A commander that makes tokens of its own type keeps that type as a need (the pattern the player spotted, 2026-10-15).** Tormod is a Zombie that makes Zombies; Suki, Kyoshi Warrior is an Ally that makes Allies; Omnath (Elemental) and Kuja (Wizard) do the same. Spec requirement 13 clause (a) ("the commander is that type on any face") already keeps all four, so no exception is needed and nothing in 2a touches typal. Correction: an earlier message in this planning session said requirement 13 would remove Tormod's Zombie need; that was wrong, because Tormod's type line is Zombie Wizard. The four whose tokens are not their own type (player's context, 2026-10-15), for Plan 2b: **Old Rutstein** and **Ant-Man** keep a small Insect bonus as a secondary outcome of their event (the Insects come out of the mill and the draw engine), below the event bonus. **The Council of Four** gets no Knight bonus unless the player picks a Knight plan; its trigger is "whenever a player ... their second card/spell", so it fires on every player's turn, which means producers include effects that make each player draw or cast, not only the commander's own. **Berta** is a Frog, so a Frog deck is a typal plan the player can pick (spec clause (d)); the Fractals are an output. (Berta is currently in Ivy's 99, not a commander in the player's decks.)
- **Card names are replaced as whole words.** Phase 1 replaced a card's own name anywhere in its text, so a card named "Flash" turned "flashback" into "~back". Task 1 fixes this (a Phase 1 bug found while testing producers).
- **Quoted abilities.** An ability that hands out a quoted ability keeps its own labels and gains `quoted[]`, one record per quote (not recursive). Needs read the quote too (Kuja).

## Review Focus

Failure modes the plan's tests must pin (each has a test in the task named):

1. A card named like a word in its own text ("Flash" and "flashback") must keep its keywords. (Task 1)
2. A "landfall" trigger repeats; it must not read as a one-shot enters trigger. (Task 1)
3. A solo commander passing `undefined` as the partner text, and `parseCommanderNeeds([])`, still work and give no events. (Task 2)
4. Old needs objects without an `events` field (many existing tests build them by hand), a missing card, and a land never produce anything. (Task 3)
5. All 56 sample builds are identical after the change, because nothing scores from events yet. (Task 5)

## File Structure

- Modify `js/analysis/abilities.js`: name replacement, trigger labels, `land-to-battlefield`, `devotion-condition`, `quoted`, `increment`.
- Modify `js/analysis/engines.js`: `getCommanderEvents`, `parseCommanderNeeds` (events, devotion from labels), `getEventProducers`.
- Modify `dev/tests/jxa/abilities.test.js`, `dev/tests/jxa/engines.test.js`.
- Create `dev/tools/jxa-harness/event_producers.js`; modify `AGENTS.md`.
- Add `dev/tools/jxa-harness/baselines/2026-10-15-event-producers.txt` (the printed lists) and a "Phase 2a result" section in the spec.

---

### Task 1: Tagger gaps the event engines need

**Files:**
- Modify: `js/analysis/abilities.js`
- Test: `dev/tests/jxa/abilities.test.js`

**Interfaces:**
- Consumes: Phase 1's `getCardAbilities`, `tagTextAbilities`, `isOneShotAbility`.
- Produces: trigger labels `landfall` (now also "a land you control enters"), `cast-noncreature`, `cast-second`, `draw-second`, `counter-placed`; effect labels `land-to-battlefield`, `devotion-condition` (`{ colors: ["red", "green"] }`); keyword `increment` (effect label `keyword:increment`); every ability record gains `quoted: []` (tagged records of any quoted text).

- [ ] **Step 1: Write the failing tests**

Append inside the `runSuite("abilities", { ... })` object of `dev/tests/jxa/abilities.test.js` (add the leading comma shown):

```js
  ,
  "landfall: a land you control entering is a landfall trigger": function () {
    const omnath = getCardAbilities({ name: "Omnath, Locus of Rage", type: "legendary creature — elemental", text: "landfall — whenever a land you control enters, create a 5/5 red and green elemental creature token." })[0];
    assertTrue(omnath.trigger.indexOf("landfall") !== -1, "landfall label");
    assertTrue(!isOneShotAbility(omnath), "a landfall trigger repeats");
    const plain = getCardAbilities({ name: "Plain", type: "creature", text: "when this creature enters, draw a card." })[0];
    assertTrue(plain.trigger.indexOf("landfall") === -1);
  },
  "an ability that hands out a quoted ability tags the quote separately": function () {
    const kuja = getCardAbilities({ name: "Kuja, Genome Sorcerer", type: "legendary creature — human wizard", text: "at the beginning of your end step, create a tapped 0/1 black wizard creature token with \"whenever you cast a noncreature spell, this creature deals 1 damage to each opponent.\"" })[0];
    assertEqual(kuja.quoted.length, 1);
    assertTrue(kuja.quoted[0].trigger.indexOf("cast-noncreature") !== -1, "the token's trigger");
    assertEqual(getCardAbilities({ name: "No Quote", type: "sorcery", text: "draw a card." })[0].quoted, []);
  },
  "trigger qualifiers: second card, second spell, noncreature spell, counter put on": function () {
    const trig = (text) => getCardAbilities({ name: "T", type: "creature", text: text })[0].trigger;
    assertTrue(trig("whenever a player draws their second card during their turn, you draw a card.").indexOf("draw-second") !== -1, "Council draw");
    assertTrue(trig("whenever a player casts their second spell during their turn, you create a 2/2 white knight creature token.").indexOf("cast-second") !== -1, "Council cast");
    assertTrue(trig("whenever you draw a card, put a +1/+1 counter on this creature.").indexOf("draw-second") === -1, "plain draw is not second");
    assertTrue(trig("whenever one or more +1/+1 counters are put on this creature, add one mana of any color.").indexOf("counter-placed") !== -1, "Berta");
    assertTrue(trig("whenever you cast a creature spell, draw a card.").indexOf("cast-noncreature") === -1, "creature spell is not noncreature");
  },
  "increment is a keyword ability": function () {
    const ab = getCardAbilities({ name: "Berta", type: "legendary creature — frog druid", text: "increment (whenever you cast a spell, if the amount of mana you spent is greater than this creature's power or toughness, put a +1/+1 counter on this creature.)" })[0];
    assertEqual(ab.kind, "keyword");
    assertEqual(ab.effects[0].label, "keyword:increment");
  },
  "a devotion condition carries its colors": function () {
    const klothys = getCardAbilities({ name: "Klothys", type: "legendary enchantment creature — god", text: "as long as your devotion to red and green is less than seven, this permanent isn't a creature." })[0];
    assertEqual(klothys.effects.find((e) => e.label === "devotion-condition").colors, ["red", "green"]);
    const one = getCardAbilities({ name: "One", type: "enchantment", text: "as long as your devotion to blue is five or more, draw a card each upkeep." })[0];
    assertEqual(one.effects.find((e) => e.label === "devotion-condition").colors, ["blue"]);
  }
  ,
  "land-to-battlefield: fetch, ramp and extra land drops, but not other tutors": function () {
    const has = (text) => getCardAbilities({ name: "T", type: "sorcery", text: text })[0].effects.some((e) => e.label === "land-to-battlefield");
    assertTrue(has("search your library for a basic land card, put that card onto the battlefield tapped, then shuffle."), "Rampant Growth");
    assertTrue(has("you may put a land card from your hand onto the battlefield."), "Oracle of Mul Daya shape");
    assertTrue(has("you may play an additional land this turn."), "Explore shape");
    assertTrue(!has("search your library for a creature card, reveal it, put it into your hand."), "creature tutor");
    assertTrue(!has("search your library for a basic land card, reveal it, put it into your hand."), "land to hand is not the battlefield");
  },
  "a card's own name only becomes a tilde as a whole word": function () {
    const ab = getCardAbilities({ name: "Flash", type: "instant", text: "deal 3 damage to any target.\nflashback {4}{r}" });
    assertEqual(ab[1].effects[0].label, "keyword:flashback");
    assertEqual(getCardAbilities({ name: "Bolt", type: "instant", text: "bolt deals 3 damage to any target." })[0].line, "~ deals 3 damage to any target.");
  }
```

- [ ] **Step 2: Run to verify they fail**

Run: `bash dev/tests/jxa/run_all.sh abilities`
Expected: the seven new tests FAIL (no `landfall` label for "a land you control enters", `quoted` is undefined, no `draw-second`, no `keyword:increment`, no `devotion-condition`, no `land-to-battlefield`, and "Flash" turns "flashback" into "~back"); the existing 13 pass; `SUITE FAILED`.

- [ ] **Step 3: Make the changes in `abilities.js`**

1. In the header comment, change the record shape line to end `..., keyword, quoted[] }]`.
2. In `TAG_KEYWORDS`, append `"increment"` after `"backup"`.
3. In `oracleLinesFromSources`, replace the line `for (const n of [full, short]) if (n.length > 2) text = text.split(n).join("~");` with:

```js
    // The card's own name, as a whole word only: a card named "Flash" must not turn "flashback" into "~back".
    for (const n of [full, short]) {
      if (n.length > 2) text = text.replace(new RegExp(`(^|[^a-z0-9])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`, "g"), "$1~");
    }
```

4. In `tagTriggerLabels`, replace the line `["landfall", /land enters/], ["sacrifice-event", /sacrifices?\b/], ["token-event", /\btokens?\b/]` with:

```js
    ["landfall", /\bland(?: you control)? enters/], ["sacrifice-event", /sacrifices?\b/], ["token-event", /\btokens?\b/],
    ["cast-noncreature", /\bcasts? (?:a|an) noncreature spell/], ["cast-second", /\bcasts? (?:their|your|his or her) second spell/],
    ["draw-second", /\bdraws? (?:their|your|his or her) second card/], ["counter-placed", /\bcounters? (?:are|is) put on\b/]
```

5. In `tagEffects`, after the line `if (/\bsearch your library\b/.test(text)) add("tutor");` add:

```js
  // Lands that reach the battlefield without being your normal land drop (fetch, ramp, extra drops).
  if (/(?:search your library for|put) [^.]*\bland cards?\b[^.]*onto the battlefield|play (?:an )?additional lands?|additional lands? (?:on|each|this) /.test(text)) add("land-to-battlefield");
```

and after the `conditional-static` line (`if (/(?:^|\s)(?:if|unless|as long as)\b/.test(text) && out.length === 0) add("conditional-static");`) add:

```js
  // "your devotion to red and green": the colors a devotion condition counts.
  const devotionColors = [];
  for (const d of text.matchAll(/devotion to (white|blue|black|red|green)(?: and (white|blue|black|red|green))?/g)) {
    for (const color of [d[1], d[2]]) if (color && !devotionColors.includes(color)) devotionColors.push(color);
  }
  if (devotionColors.length) add("devotion-condition", { colors: devotionColors });
```

6. Replace the first two lines of `tagLine` (`function tagLine(line) {` and the `const ab = { ... };` line) with a wrapper plus the renamed body:

```js
// An ability's own text may quote the abilities it hands out ("create a 0/1 Wizard token with
// \"whenever you cast a noncreature spell, ...\""). Those are tagged into `quoted`.
function tagLine(line) {
  const ab = tagLineBody(line);
  for (const m of line.matchAll(/"([^"]+)"/g)) ab.quoted.push(tagLineBody(m[1]));
  return ab;
}

function tagLineBody(line) {
  const ab = { line, kind: "static", trigger: [], cost: [], costText: "", effects: [], restrictions: tagRestrictions(line), keyword: false, quoted: [] };
```

(The rest of the old `tagLine` body, from `const stripped = ...` on, stays as the body of `tagLineBody`.)

- [ ] **Step 4: Run to verify they pass**

Run: `bash dev/tests/jxa/run_all.sh`
Expected: every suite `SUITE OK`; `abilities` 20 passed (13 + 7).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Tag landfall, quoted abilities, second-per-turn triggers, increment and devotion conditions

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Events in a commander's needs

**Files:**
- Modify: `js/analysis/engines.js`
- Test: `dev/tests/jxa/engines.test.js`

**Interfaces:**
- Consumes: Task 1's labels, `tagTextAbilities`.
- Produces: `getCommanderEvents(commanderTexts) -> [{ event, direction? }]`; `parseCommanderNeeds` result gains `events` (same list) and now reads `devotionColors` from `devotion-condition` labels (same output as before). Event ids: `landfall`, `draw`, `draw-second`, `cast`, `cast-noncreature`, `cast-second`, `cast-bigger`, `mill` (with `direction`: `self` | `opponent` | `any`), `leave-graveyard`, `counter-placed`, `graveyard-fill`.

- [ ] **Step 1: Write the failing tests**

In `dev/tests/jxa/engines.test.js`, first update the existing test `"parseCommanderNeeds: a solo commander passes an undefined partner text"`: its expected object becomes `{ payloadType: null, graveyard: false, returnsFromGraveyard: false, devotionColors: [], events: [] }`. Then append inside the object (add the comma):

```js
  ,
  "parseCommanderNeeds events: the seven commanders and Tormod each read their own event": function () {
    const events = (texts) => parseCommanderNeeds(texts).events.map((e) => e.event + (e.direction ? ":" + e.direction : ""));
    assertEqual(events(["When Old Rutstein enters and at the beginning of your upkeep, mill a card. If a land card is milled this way, create a Treasure token."]), ["mill:self"]);
    assertEqual(events(["Landfall — Whenever a land you control enters, create a 5/5 red and green Elemental creature token.\nWhenever Omnath or another Elemental you control dies, Omnath deals 3 damage to any target."]), ["landfall"]);
    assertEqual(events(["At the beginning of your end step, create a tapped 0/1 black Wizard creature token with \"Whenever you cast a noncreature spell, this creature deals 1 damage to each opponent.\""]), ["cast-noncreature"]);
    assertEqual(events(["Whenever a player draws their second card during their turn, you draw a card.\nWhenever a player casts their second spell during their turn, you create a 2/2 white Knight creature token."]), ["draw-second", "cast-second"]);
    assertEqual(events(["Increment\nWhenever one or more +1/+1 counters are put on Berta, add one mana of any color."]), ["cast-bigger", "counter-placed"]);
    assertEqual(events(["Whenever you draw a card, put a +1/+1 counter on The Astonishing Ant-Man."]), ["draw"]);
    assertEqual(events(["At the beginning of your first main phase, exile target card from a graveyard. If it was a land card, add {R} or {G}."]), ["graveyard-fill"]);
    assertEqual(events(["Whenever one or more cards leave your graveyard, create a tapped 2/2 black Zombie creature token."]), ["leave-graveyard"]);
  },
  "parseCommanderNeeds events: Greasefang runs on no event, and a solo commander's missing partner text is fine": function () {
    const needs = parseCommanderNeeds(["Whenever Greasefang, Okiba Boss attacks, return target Vehicle card from your graveyard to the battlefield.", undefined]);
    assertEqual(needs.events, []);
    assertEqual(needs.payloadType, "vehicle");
    assertEqual(parseCommanderNeeds([]).events, []);
  },
  "parseCommanderNeeds events: whose library a mill hits decides its direction": function () {
    const dir = (text) => parseCommanderNeeds([text]).events[0].direction;
    assertEqual(dir("At the beginning of your upkeep, mill a card."), "self");
    assertEqual(dir("Whenever this creature attacks, each opponent mills two cards."), "opponent");
    assertEqual(dir("At the beginning of your upkeep, target player mills three cards."), "any");
  },
  "parseCommanderNeeds: devotion colors come from the labels, one color or two": function () {
    assertEqual(parseCommanderNeeds(["As long as your devotion to red and green is less than seven, this permanent isn't a creature."]).devotionColors, ["R", "G"]);
    assertEqual(parseCommanderNeeds(["Whenever you cast a spell, if your devotion to blue is five or more, draw a card."]).devotionColors, ["U"]);
  }
```

- [ ] **Step 2: Run to verify they fail**

Run: `bash dev/tests/jxa/run_all.sh engines`
Expected: the four new tests FAIL (`events` is undefined) and the updated solo-commander test FAILS; the other existing tests pass; `SUITE FAILED`.

- [ ] **Step 3: Implement**

In `js/analysis/engines.js`, add above `parseCommanderNeeds`:

```js
// What a commander's own abilities run on, read from its tagged triggers (and the abilities it
// hands out in quotes). Each event is { event, direction? }; `direction` only matters for mill:
// "self" mills you, "opponent" mills them, "any" ("target player mills") can be either.
// Nothing scores from these yet; getEventProducers says which owned cards cause each event.
function getCommanderEvents(commanderTexts) {
  const events = [];
  const add = (event, extra) => {
    if (!events.some((e) => e.event === event)) events.push(Object.assign({ event }, extra || {}));
  };
  const directions = new Set();
  const abilities = (commanderTexts || [])
    .filter((t) => typeof t === "string" && t.trim())
    .flatMap((t) => tagTextAbilities(t, ""));
  for (const top of abilities) {
    for (const ab of [top].concat(top.quoted)) {
      const t = ab.trigger;
      if (ab.kind === "triggered") {
        if (t.includes("landfall")) add("landfall");
        if (t.includes("draw-second")) add("draw-second");
        else if (t.includes("draw-event")) add("draw");
        if (t.includes("cast-second")) add("cast-second");
        else if (t.includes("cast-noncreature")) add("cast-noncreature");
        else if (t.includes("cast-spell")) add("cast");
        if (t.includes("counter-placed")) add("counter-placed");
        if (t.includes("leave-graveyard")) add("leave-graveyard");
      }
      if (ab.effects.some((e) => e.label === "keyword:increment")) add("cast-bigger");
      if (ab.kind !== "triggered" && ab.kind !== "activated") continue;
      for (const e of ab.effects) {
        if (e.label === "mill-other") directions.add("opponent");
        if (e.label === "mill-self") directions.add(/(?:each|target) player mills/.test(ab.line) ? "any" : "self");
        if (e.label === "exile-from-graveyard" && e.from !== "your" && (e.kind === "target" || e.kind === "all")) add("graveyard-fill");
      }
    }
  }
  if (directions.size) add("mill", { direction: directions.size === 1 ? Array.from(directions)[0] : "any" });
  return events;
}
```

Change the `needs` literal at the top of `parseCommanderNeeds` to `const needs = { payloadType: null, graveyard: false, returnsFromGraveyard: false, devotionColors: [], events: [] };`.

Replace the `const returns = (commanderTexts || []) ... .filter((e) => e.label === "return-from-graveyard" && e.from === "your");` statement with a shared `abilities` list and the same filter:

```js
  const abilities = (commanderTexts || [])
    .filter((t) => typeof t === "string" && t.trim())
    .flatMap((t) => tagTextAbilities(t, ""));
  const returns = abilities
    .flatMap((ab) => ab.effects)
    .filter((e) => e.label === "return-from-graveyard" && e.from === "your");
```

Replace the whole devotion block (from `const devotion = /devotion to ...` through its closing `}` of the `while` loop, just before `return needs;`) with:

```js
  // Devotion conditions, read from the labels (a quoted ability counts too).
  for (const ab of abilities) {
    for (const effect of ab.effects.concat(...ab.quoted.map((q) => q.effects))) {
      if (effect.label !== "devotion-condition") continue;
      for (const word of effect.colors) {
        const letter = ENGINE_COLOR_LETTERS[word];
        if (letter && !needs.devotionColors.includes(letter)) needs.devotionColors.push(letter);
      }
    }
  }
  needs.events = getCommanderEvents(commanderTexts);
```

- [ ] **Step 4: Run to verify they pass**

Run: `bash dev/tests/jxa/run_all.sh`
Expected: every suite `SUITE OK`; `engines` 73 passed (69 + 4). The existing Callaphe and two-color devotion tests are the regression net for the devotion move: if one fails, fix the label read, not the test.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Record the events a commander's own abilities run on and read devotion from labels

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Event producers

**Files:**
- Modify: `js/analysis/engines.js`
- Test: `dev/tests/jxa/engines.test.js`

**Interfaces:**
- Consumes: `getCommanderEvents` events on `needs.events` (Task 2); Phase 1's `getAbilityStrength`, `getAbilityFlaws`, `ENGINE_ONE_SHOT_WEAK_CMC`.
- Produces: `getEventProducers(card, needs) -> [{ event, via, weak, flaws[] }]`, one entry per event the card produces, never for lands; `[]` when the card, the needs or `needs.events` is missing or empty. `millDirection(effectLabel, line)`; `GRAVEYARD_LEAVE_KEYWORDS`.

- [ ] **Step 1: Write the failing tests**

Append inside the object of `dev/tests/jxa/engines.test.js` (add the comma):

```js
  ,
  "getEventProducers: landfall is extra land drops, land fetch and ramp, and landfall cards": function () {
    const needs = parseCommanderNeeds(["Landfall — Whenever a land you control enters, create a 5/5 red and green Elemental creature token."]);
    const make = (name, type, text, cmc) => ({ name: name, type: type, text: text, cmc: cmc, manaCost: "" });
    const via = (c) => getEventProducers(c, needs).map((p) => p.event + ":" + p.via);
    assertEqual(via(make("Cultivate", "sorcery", "search your library for up to two basic land cards, put one onto the battlefield tapped and the other into your hand, then shuffle.", 3)), ["landfall:puts a land onto the battlefield"]);
    assertEqual(via(make("Explore-shaped", "sorcery", "you may play an additional land this turn.\ndraw a card.", 2)), ["landfall:puts a land onto the battlefield"]);
    assertEqual(via(make("Hellkite-shaped", "creature — dragon", "landfall — whenever a land you control enters, this creature gets +2/+0 until end of turn.", 5)), ["landfall:landfall card"]);
    assertEqual(via(make("Vanilla", "creature — bear", "trample", 2)), []);
    assertEqual(via(make("Wilds", "land", "{t}, sacrifice this land: search your library for a basic land card, put it onto the battlefield tapped.", 0)), []);
  },
  "getEventProducers: draws feed a draw event, cost per use decides weak": function () {
    const needs = parseCommanderNeeds(["Whenever you draw a card, put a +1/+1 counter on this creature."]);
    const make = (name, type, text, cmc) => ({ name: name, type: type, text: text, cmc: cmc, manaCost: "" });
    const cantrip = getEventProducers(make("Cantrip", "instant", "draw a card.", 1), needs)[0];
    assertEqual(cantrip.event, "draw");
    assertTrue(!cantrip.weak, "a cheap cantrip is full strength");
    assertTrue(getEventProducers(make("Big Draw", "sorcery", "draw three cards.", 5), needs)[0].weak, "a mana value 5 one-shot is weak");
    assertTrue(!getEventProducers(make("Looter", "creature — human", "whenever this creature attacks, draw a card, then discard a card.", 2), needs)[0].weak, "a repeatable loot");
    assertEqual(getEventProducers(make("Bear", "creature — bear", "trample", 2), needs), []);
  },
  "getEventProducers: a mill hits the library the commander wants hit": function () {
    const self = parseCommanderNeeds(["At the beginning of your upkeep, mill a card."]);
    const opp = parseCommanderNeeds(["Whenever this creature attacks, each opponent mills two cards."]);
    const make = (name, text) => ({ name: name, type: "sorcery", text: text, cmc: 2, manaCost: "" });
    const selfMill = make("Self Mill", "mill three cards.");
    const oppMill = make("Opp Mill", "target opponent mills three cards.");
    const either = make("Either", "target player mills three cards.");
    const count = (card, needs) => getEventProducers(card, needs).length;
    assertEqual([count(selfMill, self), count(oppMill, self), count(either, self)], [1, 0, 1]);
    assertEqual([count(selfMill, opp), count(oppMill, opp), count(either, opp)], [0, 1, 1]);
  },
  "getEventProducers: instants and sorceries are noncreature spells, permanents only weakly": function () {
    const needs = parseCommanderNeeds(["At the beginning of your end step, create a tapped 0/1 black Wizard creature token with \"Whenever you cast a noncreature spell, this creature deals 1 damage to each opponent.\""]);
    const make = (name, type, cmc) => ({ name: name, type: type, text: "", cmc: cmc, manaCost: "" });
    const one = (card) => getEventProducers(card, needs)[0];
    assertTrue(!one(make("Bolt", "instant", 1)).weak);
    assertTrue(one(make("Big Sorcery", "sorcery", 5)).weak, "mana value 5 one-shot");
    assertEqual(one(make("Rock", "artifact", 2)).via, "noncreature permanent");
    assertTrue(one(make("Rock", "artifact", 2)).weak);
    assertEqual(getEventProducers(make("Bear", "creature — bear", 2), needs), []);
    assertEqual(getEventProducers(make("Forest", "basic land — forest", 0), needs), []);
  },
  "getEventProducers: graveyard leavers include dredge and flashback keywords": function () {
    const needs = parseCommanderNeeds(["Whenever one or more cards leave your graveyard, create a tapped 2/2 black Zombie creature token."]);
    const make = (name, type, text, cmc) => ({ name: name, type: type, text: text, cmc: cmc, manaCost: "" });
    const via = (c) => getEventProducers(c, needs).map((p) => p.via);
    assertEqual(via(make("Thug", "creature — beast", "dredge 4", 4)), ["dredge"]);
    assertEqual(via(make("Burn Twice", "instant", "deal 3 damage to any target.\nflashback {4}{r}", 2)), ["flashback"]);
    assertEqual(via(make("Raise", "sorcery", "return target creature card from your graveyard to your hand.", 2)), ["returns a card from your graveyard"]);
    assertEqual(via(make("Bear", "creature — bear", "trample", 2)), []);
  },
  "getEventProducers: counters, graveyard fill, X spells and cheap second spells": function () {
    const make = (name, type, text, cmc, cost) => ({ name: name, type: type, text: text, cmc: cmc, manaCost: cost || "" });
    const counters = parseCommanderNeeds(["Whenever one or more +1/+1 counters are put on Berta, add one mana of any color."]);
    assertEqual(getEventProducers(make("Grow", "instant", "put a +1/+1 counter on target creature.", 1), counters)[0].via, "puts counters");
    const fill = parseCommanderNeeds(["At the beginning of your first main phase, exile target card from a graveyard."]);
    assertEqual(getEventProducers(make("Digger", "sorcery", "mill three cards.", 2), fill)[0].via, "fills a graveyard");
    assertEqual(getEventProducers(make("Surveil Two", "sorcery", "surveil 2.", 2), fill)[0].weak, true);
    const bigger = parseCommanderNeeds(["Increment"]);
    const xSpell = getEventProducers(make("Fireball", "sorcery", "deal x damage to any target.", 1, "{X}{R}"), bigger)[0];
    assertEqual(xSpell.via, "X spell");
    assertTrue(xSpell.weak, "you choose X, so an X spell is a flexible producer, not a solid one");
    const titan = getEventProducers(make("Titan", "creature — giant", "trample", 6), bigger)[0];
    assertEqual(titan.via, "big spell");
    assertTrue(!titan.weak, "a base cost of 5 or more is solid");
    assertEqual(getEventProducers(make("Small", "instant", "draw a card.", 3), bigger), []);
    const second = parseCommanderNeeds(["Whenever a player casts their second spell during their turn, you create a 2/2 white Knight creature token."]);
    assertEqual(getEventProducers(make("Cheap", "instant", "draw a card.", 1), second)[0].via, "cheap spell");
    assertEqual(getEventProducers(make("Dear", "sorcery", "draw a card.", 4), second), []);
  }
  ,
  "getEventProducers: no events, no needs, no card, or a needs object from before events existed all give nothing": function () {
    const card = { name: "Cantrip", type: "instant", text: "draw a card.", cmc: 1, manaCost: "" };
    assertEqual(getEventProducers(card, { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] }), []);
    assertEqual(getEventProducers(card, { events: [] }), []);
    assertEqual(getEventProducers(card, null), []);
    assertEqual(getEventProducers(null, parseCommanderNeeds(["Whenever you draw a card, put a +1/+1 counter on this creature."])), []);
  }
```

- [ ] **Step 2: Run to verify they fail**

Run: `bash dev/tests/jxa/run_all.sh engines`
Expected: all seven new tests FAIL with `Can't find variable: getEventProducers`; the 73 existing pass; `SUITE FAILED`.

- [ ] **Step 3: Implement**

In `js/analysis/engines.js`, add directly above the `// "Crew 3" -> 3.` comment (above `getCrewCost`):

```js
// Which events an owned card causes, read from its labels. Returns one entry per event the card
// produces: { event, via, weak, flaws }. `via` is the reason shown in the report; `weak` follows the
// same cost-per-use rule as the graveyard classes (getAbilityStrength). A card that produces an event
// only through its type (an instant or sorcery is a noncreature spell) is weak at mana value 4+.
const GRAVEYARD_LEAVE_KEYWORDS = new Set(["flashback", "escape", "unearth", "embalm", "eternalize", "disturb", "jump-start", "aftermath", "retrace", "scavenge", "dredge"]);

// Mill produced by one effect, as a direction: "target player mills" can be either.
function millDirection(effectLabel, line) {
  if (effectLabel === "mill-other") return "opponent";
  return /(?:each|target) player mills/.test(line) ? "any" : "self";
}

function getEventProducers(card, needs) {
  if (!card || !needs || !Array.isArray(needs.events) || !needs.events.length) return [];
  if (getCardType(card).split("—")[0].includes("land")) return [];
  const found = new Map();
  const add = (event, via, weak, flaws) => {
    const prev = found.get(event);
    if (!prev || (prev.weak && !weak) || (prev.weak === weak && flaws.length < prev.flaws.length)) {
      found.set(event, { event, via, weak, flaws });
    }
  };
  const wanted = new Map(needs.events.map((e) => [e.event, e]));
  const type = getCardType(card);
  const cmc = Number(card.cmc) || 0;
  const hasX = /\{x\}/i.test(String(card.manaCost || ""));

  for (const ab of getCardAbilities(card)) {
    const strength = getAbilityStrength(ab, card);
    const flaws = getAbilityFlaws(ab, true, strength);
    const labels = ab.effects.map((e) => e.label);
    const has = (label) => labels.includes(label);

    if (wanted.has("landfall")) {
      if (has("land-to-battlefield")) add("landfall", "puts a land onto the battlefield", strength.weak, flaws);
      else if (ab.trigger.includes("landfall")) add("landfall", "landfall card", false, flaws);
    }
    for (const event of ["draw", "draw-second"]) {
      if (wanted.has(event) && (has("draw") || has("loot") || has("rummage"))) add(event, "draws a card", strength.weak, flaws);
    }
    if (wanted.has("counter-placed") && has("counters")) add("counter-placed", "puts counters", strength.weak, flaws);
    if (wanted.has("mill")) {
      const want = wanted.get("mill").direction;
      for (const e of ab.effects) {
        if (e.label !== "mill-self" && e.label !== "mill-other") continue;
        const dir = millDirection(e.label, ab.line);
        if (dir === want || dir === "any" || want === "any") add("mill", dir === "opponent" ? "mills an opponent" : "mills a library", strength.weak, flaws);
      }
    }
    if (wanted.has("leave-graveyard")) {
      const kw = ab.effects.map((e) => e.label).find((l) => l.startsWith("keyword:") && GRAVEYARD_LEAVE_KEYWORDS.has(l.slice(8)));
      if (kw) add("leave-graveyard", kw.slice(8), false, []);
      else if (ab.effects.some((e) => e.label === "return-from-graveyard" && e.from === "your" && e.object !== "self")) add("leave-graveyard", "returns a card from your graveyard", strength.weak, flaws);
      else if (ab.effects.some((e) => e.label === "exile-from-graveyard" && e.kind === "own-cards")) add("leave-graveyard", "exiles cards from your graveyard", strength.weak, flaws);
    }
    if (wanted.has("graveyard-fill")) {
      const fills = ["mill-self", "mill-other", "discard-self", "discard-opponent", "discard-any-player", "loot", "rummage", "put-into-graveyard"];
      if (labels.some((l) => fills.includes(l)) || ab.cost.includes("discard-card")) add("graveyard-fill", "fills a graveyard", strength.weak, flaws);
      else if (has("surveil")) add("graveyard-fill", "surveils", true, flaws);
    }
  }

  // Types and costs: a noncreature spell, a second spell in a turn, a bigger spell.
  const spell = /\b(?:instant|sorcery)\b/.test(type);
  if (wanted.has("cast-noncreature")) {
    if (spell) add("cast-noncreature", "instant or sorcery", cmc >= ENGINE_ONE_SHOT_WEAK_CMC, []);
    else if (!type.includes("creature")) add("cast-noncreature", "noncreature permanent", true, []);
  }
  if (wanted.has("cast-second") && cmc <= 2 && (spell || getCardAbilities(card).some((ab) => ab.effects.some((e) => e.label === "draw")))) {
    add("cast-second", "cheap spell", false, []);
  }
  // An X spell is whatever size you pay for, so it is a weak (flexible) producer; a base cost of 5+ is a solid one.
  if (wanted.has("cast-bigger") && (hasX || cmc >= 5)) add("cast-bigger", cmc >= 5 ? "big spell" : "X spell", cmc < 5, []);
  return Array.from(found.values());
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `bash dev/tests/jxa/run_all.sh`
Expected: every suite `SUITE OK`; `engines` 80 passed (73 + 7). Note the new tests use fixture card names that do not occur inside their own text ("Burn Twice", "Digger"): a name that appears as a whole word in the text becomes `~`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Say which owned cards produce each of a commander's events

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The producer list tool

**Files:**
- Create: `dev/tools/jxa-harness/event_producers.js`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: `parseCommanderNeeds`, `getEventProducers`, the harness fixtures `owned_raw.json` and `prefetch_data.json`.
- Produces: `node dev/tools/jxa-harness/event_producers.js [--limit N] "<commander>" ...` printing each commander's events and its producers (strong first, cheap first), `*` marking weak producers.

- [ ] **Step 1: Write the tool**

Create `dev/tools/jxa-harness/event_producers.js` with exactly:

```js
// Prints, for a commander, the events its own abilities run on and the owned in-color cards that
// produce each event, so a person can read the lists. A trailing * marks a weak producer (expensive
// per use); "flawed" lists what costs a card points.
// Usage: node dev/tools/jxa-harness/event_producers.js "Omnath, Locus of Rage" [more commanders...]
//        node dev/tools/jxa-harness/event_producers.js --limit 60 "Kuja, Genome Sorcerer"
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const root = path.join(__dirname, "../..");
for (const file of ["js/constants.js", "js/utils/text.js", "js/utils/cards.js", "js/format.js", "js/analysis/abilities.js", "js/analysis/engines.js"]) {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
}
const owned = JSON.parse(fs.readFileSync(path.join(__dirname, "owned_raw.json"), "utf8"));
const prefetch = JSON.parse(fs.readFileSync(path.join(__dirname, "prefetch_data.json"), "utf8"));

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

const args = process.argv.slice(2);
let limit = 40;
if (args[0] === "--limit") { limit = Number(args[1]); args.splice(0, 2); }
if (!args.length) throw new Error("pass one or more commander names (keys of prefetch_data.json commanderCards, or 'A + B' for a pair)");

const seen = new Set();
const pool = [];
for (const raw of owned) {
  if (seen.has(raw.name)) continue;
  seen.add(raw.name);
  pool.push(toCard(raw));
}

for (const key of args) {
  const cards = key.split(" + ").map((n) => {
    const raw = prefetch.commanderCards[n];
    if (!raw) throw new Error(`no fixture for ${n}`);
    return toCard(raw);
  });
  const colors = new Set(cards.flatMap((c) => c.colors));
  const needs = parseCommanderNeeds(cards.map((c) => c.text));
  console.log(`== ${key} | events: ${JSON.stringify(needs.events)}`);
  if (!needs.events.length) { console.log("   no events"); continue; }
  const byEvent = new Map();
  for (const card of pool) {
    if (!card.colors.every((c) => colors.has(c))) continue;
    if (cards.some((c) => c.name === card.name)) continue;
    for (const p of getEventProducers(card, needs)) {
      if (!byEvent.has(p.event)) byEvent.set(p.event, []);
      byEvent.get(p.event).push({ card, p });
    }
  }
  for (const [event, rows] of byEvent) {
    // Strong producers first, then cheaper, so the head of the list is what a build would reach for.
    rows.sort((a, b) => (a.p.weak - b.p.weak) || (a.card.cmc - b.card.cmc) || a.card.name.localeCompare(b.card.name));
    const strong = rows.filter((r) => !r.p.weak).length;
    console.log(`   ${event}: ${rows.length} producers (${strong} strong), first ${Math.min(limit, rows.length)}:`);
    for (const { card, p } of rows.slice(0, limit)) {
      const flawed = p.flaws.length ? `; flawed: ${p.flaws.join(", ")}` : "";
      console.log(`     ${card.name}${p.weak ? "*" : ""} [cmc ${card.cmc}] (${p.via}${flawed})`);
    }
  }
}
```

- [ ] **Step 2: Run it**

Run: `node dev/tools/jxa-harness/event_producers.js --limit 4 "Omnath, Locus of Rage" "Greasefang, Okiba Boss"`
Expected: Omnath prints `events: [{"event":"landfall"}]` and `landfall: 85 producers (69 strong), first 4:` with four cards (numbers may differ by one or two if the fixture changed); Greasefang prints `events: []` and `no events`.

- [ ] **Step 3: Update AGENTS.md and commit**

In `AGENTS.md`, in the paragraph that mentions `ability_eval.js`, add: `event_producers.js prints a commander's events and the owned cards that produce each one (the lists the player reads before event scoring is written).` Then:

```bash
git add -A && git commit -m "Add a tool that prints a commander's events and their producers

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Check nothing moved, print the lists, and stop for the player

**Files:**
- Create: `dev/tools/jxa-harness/baselines/2026-10-15-event-producers.txt`
- Modify: `dev/docs/superpowers/specs/2026-10-15-ability-labels.md` (a "Phase 2a result" section)

**Interfaces:**
- Consumes: everything above. Produces: the printed lists, the 56-build check and the questions for the player.

- [ ] **Step 1: Full suite**

Run: `bash dev/tests/jxa/run_all.sh`
Expected: every suite `SUITE OK`; `abilities` 20, `engines` 80.

- [ ] **Step 2: All 56 builds are unchanged**

Run (about 2 minutes; pick any scratch directory for `$SP`):

```bash
bash dev/tools/jxa-harness/build_harness.sh $SP/combined.js
cat $SP/combined.js dev/tools/jxa-harness/dump_decks.js | osascript -l JavaScript | grep '^DECKS ' | sed 's/^DECKS //' > $SP/after-2a.json
python3 dev/tools/jxa-harness/engine_compare.py dev/tools/jxa-harness/baselines/2026-10-15-after-graveyard-exile-role.json $SP/after-2a.json | head -3
```

Expected: `unchanged (56): ...` and no `==` lines. Nothing scores from events yet, so any moved commander is a bug: find which label change reached a score (most likely the whole-word name change or the `landfall` trigger now repeating) and fix it before going on.

- [ ] **Step 3: Print the lists the player reads**

Run:

```bash
node dev/tools/jxa-harness/event_producers.js --limit 40 "Old Rutstein" "Omnath, Locus of Rage" "Kuja, Genome Sorcerer" "The Council of Four" "Berta, Wise Extrapolator" "The Astonishing Ant-Man" "Klothys, God of Destiny" "Tormod, the Desecrator + Ghost of Ramirez DePietro" "Greasefang, Okiba Boss" > dev/tools/jxa-harness/baselines/2026-10-15-event-producers.txt
```

Read the file. Note, for each event, anything that looks like a card that is not a real producer (for example a mill card that mills a library that is not a player's) and anything obviously missing. Do not fix producers from your own read; the player decides what a good producer is.

- [ ] **Step 4: Record and commit, then stop**

Add a short "Phase 2a result" section to the end of `dev/docs/superpowers/specs/2026-10-15-ability-labels.md`: suite counts, the 56-build result, the event each of the eight commanders reads (the seven plus Tormod), the producer counts per event from the printout, and the open questions below. Then:

```bash
git add -A && git commit -m "Print the event producer lists for the player to read

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

**Stop here.** Print for the player, in the final message: the events read for each commander, the producer count per event with the first ten of each list, anything in the lists that looked wrong, and the full list of rulings from this plan plus any made while executing. Ask: (1) are the provisional producer rules (second spell, bigger spell, graveyard fill, landfall cards) right; (2) is the Insect bonus for Old Rutstein and Ant-Man, no Knight bonus for the Council of Four, and a Frog plan for Berta what the player wants (Tormod, Suki, Omnath and Kuja already keep their own types); (3) any amplifier cards to list for Kuja-style commanders. Do not merge, push, or start Plan 2b; ask which of merge / PR / keep applies.

---

## Self-review (spec coverage)

- Req 14 (events read from the commander's own triggers): Tasks 1-2 (labels, `getCommanderEvents`, quoted abilities, devotion from labels). The "a counter is put on a creature" and "cards are milled / leave a graveyard" events are included; "a spell is cast: a bigger spell than before" is `cast-bigger` via increment.
- Req 15 (producers, cost per use decides strength): Task 3 (`getEventProducers` with `getAbilityStrength` and flaws).
- Req 16 (the starting events): Old Rutstein (mill and direction), Omnath (landfall), Kuja (noncreature spell, quoted), Council (draw-second, cast-second), Berta (cast-bigger, counter-placed), Ant-Man (draw), Klothys (graveyard-fill plus devotion): Tasks 1-3. The mill-direction recursion rule (a self-milling commander wants recursion) and Klothys's devotion scoring are consumption, so they belong to Plan 2b.
- Req 13 (typal) and req 17 (weights, report): Plan 2b, written after the player reads the lists; see "Why two plans".
- Verification 10 (printed lists): Task 5. Verification 7 (collateral): Task 5 step 2.
- Placeholder scan: every code step shows code; commands show expected output. The soft spot is Task 5 step 3, a judgment read of printed lists, not a pass/fail number.
- Type consistency: the event record is `{ event, direction? }` in Tasks 2 and 3; the producer record is `{ event, via, weak, flaws }` in Tasks 3 and 4; `needs.events` is the only new needs field.
