# Ability Labels, Phase 1 (the port) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the ability tagger prototype into `js/analysis/abilities.js` and make the engine code (`engines.js`, plus the `voltron` tag in `scoring.js`) decide from per-ability labels instead of one-clause regexes, with the spec's quality penalties, cost-based weakness and report reasons.

**Architecture:** `abilities.js` turns a card's text into a list of ability records (trigger, cost, effects, restrictions) and caches them. `engines.js` keeps its public functions and class names but computes classes from those records. The new `getEngineClassDetails` returns `{ cls, weak, flaws }` per class; `getEngineClasses` is its names-only view, so `scoring.js`, `main.js` and `manabase.js` change only where the spec says. Commanders with no recognized need still get bonus 0.

**Tech Stack:** Plain global-scope browser JS, no modules, no build step. Tests run under JXA (`dev/tests/jxa/run.sh`); `node` is for ad-hoc scripts only.

**Spec:** `dev/docs/superpowers/specs/2026-10-15-ability-labels.md`. This plan implements requirements 1-12 (Phase 1). Phase 2 (requirements 13-17, event engines) is a separate plan, written after this one is signed off. Read the spec first.

## Global Constraints

- No module system, bundler or npm. A new `js/` file gets its `<script>` tag in BOTH `index.html` and `pauper.html` (same position) and in `dev/tools/jxa-harness/build_harness.sh`.
- zsh does not word-split `$VAR`: run multi-file test commands through `bash dev/tests/jxa/run_all.sh` (Task 1 creates it) or `bash -c`.
- Any test chain that includes `js/utils/cards.js` also needs `js/format.js`. After Task 1, any chain that includes `js/analysis/scoring.js` also needs `js/analysis/abilities.js` before it.
- The user's collection deliberately omits flex staples (Sol Ring etc.); never report that as a gap. Never use Rosheen as a sample commander. The friend's collection files are never committed.
- Say "typal", not "tribal", in visible text.
- Commit style: short imperative subjects, no `feat:`/`fix:` prefixes, each ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- **Spend:** no subagents, no Workflows, no review/verification subagent without asking the user first. Use direct Read/Grep/Bash.
- Work happens on branch `ability-labels` (it already holds the prototype and the spec). Do not merge to `main`; the user signs off first (Task 9).

## Rulings made while planning

- **Thresholds.** Repeatable ability: up to {2} per use is full strength, {3}+ is weak. One-shot (spell, enters/dies trigger, self-sacrifice or self-exile ability): mana value 3 or less is full strength, 4+ is weak. (Spec requirement 9 now says this.) Cost if wrong: a card moves between "injected" and "scored only"; tune in Task 9.
- **Unrestricted "card" recursion counts** as `recursionGeneric` (spec requirement 7). Old regexes did not count it. Cost if wrong: more recursion spells enter the theme tier; Task 9's diff will show it, and the fix is one condition.
- **`lord`, `devotionPayoff` and `crewBody` stay text/type based** in Phase 1. Labels add nothing for them yet; Phase 2 reworks the typal rule.
- **`put-into-graveyard` (tutor-to-graveyard) is not a class** in Phase 1, to keep builds close to the baseline.
- **`parseCommanderNeeds` keeps exactly its current four fields.** Only `returnsFromGraveyard` and the type read from a return clause move onto labels.
- **Crew-tap from a trigger only.** The old pattern also matched "crews a vehicle" anywhere in text; the label version reads triggers. No owned card is known to differ; Task 9's diff would show it.

## Review Focus

Failure modes the plan's tests must pin (each has a test in the task named):

1. Two-faced cards read face by face from `card.raw.card_faces`; the joined `card.text` would leave the back face's own name un-replaced. (Task 1)
2. Empty, missing or `undefined` text never throws, including a solo commander passing `undefined` as the partner text. (Task 1, Task 3)
3. The cache key includes the text, so two cards sharing a name cannot return each other's labels. (Task 1)
4. Names with commas or apostrophes still become `~`, and bare commander text (no name) parses. (Task 1, Task 3)
5. Commanders with no engine need (Kaza, Zodiark, Fynn, Kardur) build identically after the port. (Task 9)

## File Structure

- Create `js/analysis/abilities.js`: tagger (moved from `dev/tools/jxa-harness/ability_tagger.js`), cache, `getCardAbilities`, `tagTextAbilities`, `isOneShotAbility`, `getAbilityManaCost`, `hasAttachmentSignal`.
- Create `dev/tests/jxa/abilities.test.js`, `dev/tests/jxa/run_all.sh`.
- Modify `js/analysis/engines.js`: needs, veto, class details, flaws, weakness, enabler descriptions.
- Modify `js/analysis/scoring.js`: the `voltron` tag.
- Modify `js/main.js`, `js/ui/report.js`: enabler reasons.
- Modify `index.html`, `pauper.html`, `dev/tools/jxa-harness/build_harness.sh`, `AGENTS.md`.
- Rewrite `dev/tools/jxa-harness/ability_eval.js` (coverage, vocab, case, vetoes); delete `dev/tools/jxa-harness/ability_tagger.js`.
- Add `dev/tools/jxa-harness/baselines/2026-10-15-after-labels-phase1.json`.

---

### Task 1: The abilities module, test runner and load order

**Files:**
- Create: `js/analysis/abilities.js` (via `git mv dev/tools/jxa-harness/ability_tagger.js js/analysis/abilities.js`)
- Create: `dev/tests/jxa/abilities.test.js`, `dev/tests/jxa/run_all.sh`
- Modify: `index.html`, `pauper.html`, `dev/tools/jxa-harness/build_harness.sh`, `dev/tools/jxa-harness/ability_eval.js` (loader only), `AGENTS.md`

**Interfaces:**
- Consumes: `getCardText(card)`, `getCardType(card)` from `js/utils/cards.js`.
- Produces: `getCardAbilities(card) -> ability[]`; `tagTextAbilities(text, name) -> ability[]`; `isOneShotAbility(ab) -> boolean`; `getAbilityManaCost(ab) -> number`; `hasAttachmentSignal(card) -> boolean`. An ability is `{ line, kind, trigger[], cost[], costText, effects[], restrictions[], keyword }`; `kind` is one of `keyword`, `structural`, `activated`, `triggered`, `spell`, `static`.

- [ ] **Step 1: Create the all-suites runner**

`dev/tests/jxa/run_all.sh`:

```bash
#!/bin/bash
# Usage: bash dev/tests/jxa/run_all.sh [substring of a test file name]
# Runs every dev/tests/jxa/*.test.js with the full harness script list ahead of it (read from
# build_harness.sh, so the two cannot drift), plus the one ui file the commanders-tab,
# theme-tab and export suites need. Prints one line per suite.
base=($(sed -n '/^scripts=(/,/^)/p' dev/tools/jxa-harness/build_harness.sh | grep 'js/'))
for t in dev/tests/jxa/*.test.js; do
  if [ -n "$1" ] && [[ "$t" != *"$1"* ]]; then continue; fi
  case "$t" in
    *commanders-tab*) extra=(js/ui/commanders-tab.js);;
    *theme-tab*) extra=(js/ui/theme-tab.js);;
    *export*) extra=(js/ui/export.js);;
    *) extra=();;
  esac
  out=$(dev/tests/jxa/run.sh "${base[@]}" "${extra[@]}" "$t" 2>&1)
  echo "$(basename "$t"): $(echo "$out" | tail -2 | tr '\n' ' ')"
done
```

Run: `bash dev/tests/jxa/run_all.sh`
Expected: one line per existing suite, every line ending `SUITE OK` (17 suites; `export` is included).

- [ ] **Step 2: Write the failing tests**

`dev/tests/jxa/abilities.test.js`:

```js
runSuite("abilities", {
  "getCardAbilities reads an app card ability by ability": function () {
    const bag = {
      name: "Bag of Holding", type: "artifact",
      text: "whenever you discard a card, exile that card from your graveyard.\n{2}, {t}: draw a card, then discard a card."
    };
    const abs = getCardAbilities(bag);
    assertEqual(abs.length, 2);
    assertEqual(abs[0].kind, "triggered");
    assertEqual(abs[0].trigger, ["discard-event"]);
    assertEqual(abs[0].effects[0].label, "exile-from-graveyard");
    assertEqual(abs[0].effects[0].kind, "that-card");
    assertEqual(abs[1].kind, "activated");
    assertEqual(abs[1].cost, ["mana", "tap"]);
    assertTrue(abs[1].effects.some((e) => e.label === "loot"), "loot effect");
  },
  "a generic mana symbol keeps its amount so mana can be counted": function () {
    const ab = getCardAbilities({ name: "Test Engine", type: "artifact", text: "{3}{u}, {t}: draw a card." })[0];
    assertEqual(getAbilityManaCost(ab), 4);
    const free = getCardAbilities({ name: "Test Free", type: "artifact", text: "{t}: add one mana of any color." })[0];
    assertEqual(getAbilityManaCost(free), 0);
  },
  "the card's own name, with or without its title, becomes a tilde": function () {
    const line = getCardAbilities({ name: "Greasefang, Okiba Boss", type: "legendary creature — rat", text: "whenever greasefang attacks, draw a card." })[0].line;
    assertEqual(line, "whenever ~ attacks, draw a card.");
    const apostrophe = getCardAbilities({ name: "Gaea's Cradle", type: "land", text: "{t}: add {g} for each creature you control. gaea's cradle is a land." })[0].line;
    assertTrue(apostrophe.indexOf("gaea") === -1, "apostrophe name replaced");
  },
  "a two-faced card is read face by face, each face's own name becoming a tilde": function () {
    const card = {
      name: "Front Face // Back Side", type: "creature // creature", text: "front face deals 2 damage to any target.\nback side gains flying.",
      raw: { card_faces: [
        { name: "Front Face", oracle_text: "Front Face deals 2 damage to any target." },
        { name: "Back Side", oracle_text: "Back Side gains flying." }
      ] }
    };
    assertEqual(getCardAbilities(card).map((a) => a.line), ["~ deals 2 damage to any target.", "~ gains flying."]);
  },
  "empty, missing and undefined text never throw": function () {
    assertEqual(getCardAbilities({ name: "Vanilla", type: "creature", text: "" }), []);
    assertEqual(getCardAbilities({ name: "No text field", type: "creature" }), []);
    assertEqual(getCardAbilities(null), []);
    assertEqual(tagTextAbilities(undefined, "x"), []);
  },
  "the cache is keyed by name and text, so same-named cards stay apart": function () {
    const a = getCardAbilities({ name: "Same Name", type: "sorcery", text: "mill three cards." });
    const b = getCardAbilities({ name: "Same Name", type: "sorcery", text: "draw two cards." });
    assertEqual(a[0].effects.map((e) => e.label), ["mill-self"]);
    assertEqual(b[0].effects.map((e) => e.label), ["draw"]);
    assertTrue(getCardAbilities({ name: "Same Name", type: "sorcery", text: "mill three cards." }) === a, "same card returns the cached list");
  },
  "an instant or sorcery's lines are marked as spells": function () {
    assertEqual(getCardAbilities({ name: "Spell", type: "instant", text: "mill three cards." })[0].kind, "spell");
    assertEqual(getCardAbilities({ name: "Permanent", type: "artifact", text: "mill three cards." })[0].kind, "static");
  },
  "tagTextAbilities reads a bare commander text": function () {
    const abs = tagTextAbilities("at the beginning of combat on your turn, return target vehicle card from your graveyard to the battlefield.", "");
    const ret = abs[0].effects.find((e) => e.label === "return-from-graveyard");
    assertEqual(ret.object, "vehicle");
    assertEqual(ret.from, "your");
    assertEqual(ret.to, "battlefield");
  }
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `bash dev/tests/jxa/run_all.sh abilities`
Expected: every test FAILS with `Can't find variable: getCardAbilities` (or `tagTextAbilities`), `SUITE FAILED`.

- [ ] **Step 4: Move the prototype and turn it into the module**

Run: `git mv dev/tools/jxa-harness/ability_tagger.js js/analysis/abilities.js`

In `js/analysis/abilities.js`, replace the header comment (the 5 lines before `const TAG_KEYWORDS`) with:

```js
// Ability labels: reads each ability of a card (trigger, cost, effect, restriction) so a
// card is judged by its whole text instead of one matching clause. Plain globals, no DOM.
// Spec: dev/docs/superpowers/specs/2026-10-15-ability-labels.md
//
// getCardAbilities(card) -> [{ line, kind, trigger[], cost[], costText, effects[], restrictions[], keyword }]
// Accepts an app card ({ name, text, type, raw }) or a raw Scryfall object.
```

Replace the whole `tagOracleLines` function with:

```js
// The pieces of text to read: a two-faced card face by face (each face's own name
// becomes "~"), anything else as one piece.
function abilitySources(card) {
  const raw = card && card.raw ? card.raw : card;
  const faces = raw && Array.isArray(raw.card_faces) ? raw.card_faces.filter((f) => f && f.oracle_text) : [];
  if (faces.length > 1 && !raw.oracle_text) return faces.map((f) => ({ name: f.name || card.name, text: f.oracle_text }));
  return [{ name: card && card.name, text: getCardText(card) }];
}

function oracleLinesFromSources(sources) {
  const lines = [];
  for (const part of sources) {
    const full = String(part.name || "").toLowerCase();
    const short = full.split(",")[0];
    let text = String(part.text || "").toLowerCase().replace(/\([^)]*\)/g, "");
    for (const n of [full, short]) if (n.length > 2) text = text.split(n).join("~");
    text = text.replace(/\bthis (?:creature|artifact|enchantment|land|aura|equipment|vehicle|card|permanent|token|saga|class|siege|battle|spell|planeswalker)\b/g, "~");
    // Every mana symbol becomes {m}, and a generic {3} becomes three of them, so counting {m} counts mana.
    text = text.replace(/\{(?!t\}|q\})([^}]+)\}/g, (match, symbol) => (/^\d+$/.test(symbol) ? "{m}".repeat(Number(symbol)) : "{m}"));
    for (const line of text.split("\n")) {
      const clean = line.trim().replace(/^[•\s]+/, "");
      if (clean) lines.push(clean);
    }
  }
  return lines;
}
```

Replace the whole `tagCard` function at the end of the file with:

```js
function tagCard(card) {
  const oneShot = /\b(?:instant|sorcery)\b/.test(getCardType(card));
  return oracleLinesFromSources(abilitySources(card)).map((line) => {
    const ab = tagLine(line);
    if (oneShot && ab.kind === "static") ab.kind = "spell";
    return ab;
  });
}

// A bare rules text (a commander's), with no card around it.
function tagTextAbilities(text, name) {
  return oracleLinesFromSources([{ name: name || "", text }]).map(tagLine);
}

const ABILITY_CACHE = new Map();

// Tagging is pure, so it is memoized. The key carries the text as well as the name:
// a test card or a re-printed card can share a name with different text.
function getCardAbilities(card) {
  if (!card) return [];
  const key = `${card.name}\u0000${getCardText(card)}`;
  let abilities = ABILITY_CACHE.get(key);
  if (!abilities) {
    abilities = tagCard(card);
    ABILITY_CACHE.set(key, abilities);
  }
  return abilities;
}

// One-shot abilities happen once per card played: a spell, an enters or dies trigger, or an
// activated ability that sacrifices or exiles its own card as the cost.
function isOneShotAbility(ab) {
  if (ab.kind === "spell") return true;
  if (ab.kind === "triggered") return ab.trigger.length > 0 && ab.trigger.every((t) => t === "etb" || t === "dies");
  if (ab.kind === "activated") return ab.cost.includes("sacrifice-self") || ab.cost.includes("exile-self-from-graveyard");
  return false;
}

// Mana paid to use an activated ability once: the {m} symbols in its cost.
function getAbilityManaCost(ab) {
  return (String(ab.costText || "").match(/\{m\}/g) || []).length;
}

// True when some ability mentions attaching without being about destroying or removing
// attachments. This is what the voltron tag reads instead of the bare word "attach".
function hasAttachmentSignal(card) {
  return getCardAbilities(card).some((ab) => /attach/.test(ab.line) && !ab.effects.some((e) => e.label === "hose-attachment"));
}
```

In `tagLine`, add `costText: ""` to the record and record it for activated abilities:

```js
  const ab = { line, kind: "static", trigger: [], cost: [], costText: "", effects: [], restrictions: tagRestrictions(line), keyword: false };
```

```js
    ab.kind = "activated";
    ab.costText = stripped.slice(0, colon);
    ab.cost = tagCostLabels(ab.costText);
    ab.effects = tagEffects(stripped.slice(colon + 1));
```

(The trigger, crew-helper and attachment corrections are Task 2; this task is the move.)

- [ ] **Step 5: Wire the load order**

In `index.html` and `pauper.html`, insert directly before the `<script src="js/analysis/scoring.js"></script>` line:

```html
  <script src="js/analysis/abilities.js"></script>
```

In `dev/tools/jxa-harness/build_harness.sh`, insert `  js/analysis/abilities.js` on the line before `  js/analysis/scoring.js`.

In `dev/tools/jxa-harness/ability_eval.js`, replace the two loader lines (`const src = ...` and `const T = ...`) with:

```js
const root = path.join(__dirname, "../..");
const ctx = vm.createContext({});
for (const file of ["js/constants.js", "js/utils/text.js", "js/utils/cards.js", "js/format.js", "js/analysis/abilities.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), ctx, { filename: file });
}
const T = vm.runInContext("({ tagCard: getCardAbilities, tagLine, tagOracleLines: (c) => oracleLinesFromSources(abilitySources(c)) })", ctx);
```

- [ ] **Step 6: Run to verify they pass, and nothing else moved**

Run: `bash dev/tests/jxa/run_all.sh`
Expected: every suite `SUITE OK`, including `abilities.test.js: abilities: 8 passed, 0 failed`.

Run: `node dev/tools/jxa-harness/ability_eval.js check | tail -1`
Expected: `15/15 known cases hold` (the prototype's checks still pass through the moved module).

- [ ] **Step 7: Document and commit**

In `AGENTS.md` Layout, after the `js/analysis/engines.js` entry, add:

```
- `js/analysis/abilities.js` — per-ability labels: `getCardAbilities(card)` splits a card's text into
  abilities (trigger, cost, effects with their object and zone, restrictions) and caches them;
  `engines.js` and the `voltron` tag read these labels instead of matching one clause. Loaded right
  before `scoring.js`. Spec: `dev/docs/superpowers/specs/2026-10-15-ability-labels.md`.
```

In the Testing section, replace the `dev/tests/jxa/run.sh js/constants.js ... scoring.test.js` example's file list so `js/analysis/abilities.js` sits before `js/analysis/scoring.js`, add `abilities` to the `Suites:` list, and add the sentence: `bash dev/tests/jxa/run_all.sh [name]` runs every suite (or those matching `name`) with the full harness list.

```bash
git add -A && git commit -m "Move the ability tagger into js/analysis and add a run-all-suites script

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Tagger corrections the port needs

**Files:**
- Modify: `js/analysis/abilities.js`
- Test: `dev/tests/jxa/abilities.test.js`

**Interfaces:**
- Consumes: Task 1's module.
- Produces: effect label `hose-attachment` (new); `attach-effect` now means a real attach verb; trigger label `becomes-tapped` excludes land subjects and "for mana"; effect `crew-helper` also covers Pilot-token makers.

- [ ] **Step 1: Write the failing tests**

Append inside the `runSuite("abilities", { ... })` object of `dev/tests/jxa/abilities.test.js` (add a comma after the previous last entry):

```js
  ,
  "a Pilot-token maker counts as a crew helper": function () {
    const card = { name: "Pilot Maker", type: "enchantment — aura", text: "when this aura enters, create a 1/1 colorless pilot creature token with \"this token crews vehicles as though its power were 2 greater.\"" };
    assertTrue(getCardAbilities(card)[0].effects.some((e) => e.label === "crew-helper"));
  },
  "a land becoming tapped is not a creature tap trigger": function () {
    const land = getCardAbilities({ name: "Curse", type: "enchantment — aura", text: "whenever enchanted land becomes tapped, its controller loses 2 life." })[0];
    assertTrue(land.trigger.indexOf("becomes-tapped") === -1, "land tap is not a crew-style tap");
    const creature = getCardAbilities({ name: "Tapper", type: "enchantment", text: "whenever a creature you control becomes tapped, draw a card." })[0];
    assertEqual(creature.trigger, ["becomes-tapped"]);
    const mana = getCardAbilities({ name: "Mana Tap", type: "enchantment", text: "whenever a permanent you control becomes tapped for mana, draw a card." })[0];
    assertTrue(mana.trigger.indexOf("becomes-tapped") === -1, "tapped for mana is excluded");
  },
  "destroying or unattaching attachments is hose-attachment, attaching is attach-effect": function () {
    const label = (text) => getCardAbilities({ name: "T", type: "creature", text: text })[0].effects.map((e) => e.label);
    assertTrue(label("whenever this creature attacks, destroy all auras attached to target land.").indexOf("hose-attachment") !== -1, "Street Sweeper");
    assertTrue(label("whenever this creature attacks, destroy all auras attached to target land.").indexOf("attach-effect") === -1);
    assertTrue(label("unattach all equipment from target creature.").indexOf("hose-attachment") !== -1, "Disarm");
    assertTrue(label("choose target creature you control and target equipment. gain control of that equipment until end of turn. attach it to the chosen creature.").indexOf("attach-effect") !== -1, "Stolen Uniform");
    assertTrue(label("attach target aura attached to a creature or land to another permanent of that type.").indexOf("attach-effect") !== -1, "Enchantment Alteration");
  },
  "hasAttachmentSignal ignores attachment hosers but keeps attachment payoffs": function () {
    const sig = (text) => hasAttachmentSignal({ name: "Test Card", type: "creature", text: text });
    assertTrue(!sig("whenever this creature attacks, destroy all auras attached to target land."), "Street Sweeper");
    assertTrue(!sig("unattach all equipment from target creature."), "Disarm");
    assertTrue(!sig("destroy all equipment attached to that creature."), "Blastfire Bolt shape");
    assertTrue(sig("attach target aura attached to a creature or land to another permanent of that type."), "Enchantment Alteration");
    assertTrue(sig("whenever an aura becomes attached to this creature, create a 2/2 red dragon creature token with flying."), "Brood Keeper");
    assertTrue(sig("this creature gets +2/+2 for each aura and equipment attached to it."), "Champion of the Flame");
  },
  "isOneShotAbility: spells, enters and dies triggers, and self-sacrifice are one-shot": function () {
    const one = (text, type) => isOneShotAbility(getCardAbilities({ name: "Test Card", type: type, text: text })[0]);
    assertTrue(one("mill three cards.", "sorcery"), "spell");
    assertTrue(one("when this creature enters, discard a card.", "creature"), "enters");
    assertTrue(one("when this creature dies, each opponent loses 1 life.", "creature"), "dies");
    assertTrue(one("{2}{b}, sacrifice this creature: mill four cards.", "creature"), "sacrifice self");
    assertTrue(!one("whenever this creature attacks, discard a card.", "creature"), "attack trigger repeats");
    assertTrue(!one("{3}, {t}: draw a card, then discard a card.", "artifact"), "tap ability repeats");
  }
```

- [ ] **Step 2: Run to verify they fail**

Run: `bash dev/tests/jxa/run_all.sh abilities`
Expected: the Pilot, land-tap, attach and `hasAttachmentSignal` tests FAIL; the `isOneShotAbility` test passes (Task 1 already added it); `SUITE FAILED`.

- [ ] **Step 3: Make the corrections in `abilities.js`**

In `tagTriggerLabels`, replace the `becomes-tapped` rule and the loop. The rule line becomes `["becomes-tapped", /becomes tapped(?! for mana)/]`, and the loop becomes:

```js
  for (const [label, re] of rules) {
    if (label === "becomes-tapped" && /\bland\b/.test(trigger)) continue; // a land tapping is not a creature crewing
    if (re.test(trigger)) labels.push(label);
  }
```

In `tagEffects`, replace the `crew-helper` line with:

```js
  if (/crews? (?:vehicles?|a vehicle) (?:as though|using its toughness)|(?:saddles|crews) [^.]*as though its power|create an? [^.]*\bpilot creature token/.test(text)) add("crew-helper");
```

and replace the `attach-effect` line (`if (/\battach\b|\bequipped\b|\benchanted\b/.test(text)) add("attach-effect");`) with:

```js
  // Attachment: destroying or unattaching Auras and Equipment is the opposite of caring about them.
  if (/\b(?:destroy|exile|unattach|sacrifice)\b[^.]*\b(?:auras?|equipment)\b|\bunattach\b/.test(text)) add("hose-attachment");
  else if (/\battach(?:es|ed)?\b/.test(text)) add("attach-effect");
```

- [ ] **Step 4: Run to verify they pass**

Run: `bash dev/tests/jxa/run_all.sh`
Expected: every suite `SUITE OK`; `abilities` now 13 passed.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Split attachment hosers from attachers and tighten crew and tap labels

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Needs and the graveyard veto from labels

**Files:**
- Modify: `js/analysis/engines.js`
- Test: `dev/tests/jxa/engines.test.js`

**Interfaces:**
- Consumes: `tagTextAbilities`, `getCardAbilities` from Task 1.
- Produces: `isGraveyardHostile(card) -> boolean`; `parseCommanderNeeds` unchanged in shape (`{ payloadType, graveyard, returnsFromGraveyard, devotionColors }`).

- [ ] **Step 1: Write the failing tests**

Append to the object in `dev/tests/jxa/engines.test.js` (comma after the last entry):

```js
  ,
  "isGraveyardHostile: exiling the discarded card or a whole graveyard is hostile": function () {
    const bag = { name: "Bag-shaped", type: "artifact", text: "whenever you discard a card, exile that card from your graveyard.\n{2}, {t}: draw a card, then discard a card." };
    const construct = { name: "Construct-shaped", type: "artifact", text: "whenever you discard a card, you may exile that card from your graveyard. if you do, you may play that card this turn." };
    const lantern = { name: "Lantern-shaped", type: "artifact", text: "when this artifact enters, exile target card from a graveyard.\n{1}, {t}, exile this artifact: exile all cards from all graveyards, then draw a card." };
    assertTrue(isGraveyardHostile(bag), "Bag of Holding");
    assertTrue(isGraveyardHostile(construct), "Containment Construct");
    assertTrue(isGraveyardHostile(lantern), "Lantern of the Lost");
  },
  "isGraveyardHostile: spending graveyard cards as fuel is not a veto": function () {
    const drake = { name: "Drake-shaped", type: "creature — drake", text: "as an additional cost to cast this spell, exile a creature card from your graveyard.\nflying" };
    const argument = { name: "Argument-shaped", type: "instant", text: "this spell deals 6 damage to target creature. you may exile a card from your graveyard. if you do, this spell also deals 2 damage to that creature's controller." };
    const looter = { name: "Looter-shaped", type: "creature — human", text: "whenever this creature attacks, draw a card, then discard a card." };
    assertTrue(!isGraveyardHostile(drake), "Stitched Drake");
    assertTrue(!isGraveyardHostile(argument), "Heated Argument");
    assertTrue(!isGraveyardHostile(looter), "a plain looter");
  },
  "parseCommanderNeeds: a put-onto-the-battlefield reanimator reads its type and zone": function () {
    const needs = parseCommanderNeeds(["Whenever a creature dies, put target Zombie card from your graveyard onto the battlefield."]);
    assertEqual(needs.payloadType, "zombie");
    assertTrue(needs.returnsFromGraveyard, "it returns cards from your graveyard");
  },
  "parseCommanderNeeds: a return clause naming two types reads no payload": function () {
    const needs = parseCommanderNeeds(["Return target creature or Vehicle card from your graveyard to your hand."]);
    assertEqual(needs.payloadType, null);
    assertTrue(needs.returnsFromGraveyard);
  },
  "parseCommanderNeeds: a bare text with a comma in a name still parses": function () {
    const needs = parseCommanderNeeds(["Whenever Greasefang, Okiba Boss attacks, return target Vehicle card from your graveyard to the battlefield."]);
    assertEqual(needs.payloadType, "vehicle");
  }
```

- [ ] **Step 2: Run to verify they fail**

Run: `bash dev/tests/jxa/run_all.sh engines`
Expected: `isGraveyardHostile` tests FAIL (`Can't find variable`), the put-onto-the-battlefield test FAILS (old regex does not read "put ... onto the battlefield"); the existing 49 still pass.

- [ ] **Step 3: Implement**

In `js/analysis/engines.js`, add above `parseCommanderNeeds`:

```js
// A card that exiles what you discard or mill, or empties a graveyard, works against an engine
// that needs those cards to stay so it can return them (Bag of Holding, Containment Construct,
// Lantern of the Lost). Exiling a creature card as a cost or a rider is fuel, not hostile.
function isGraveyardHostile(card) {
  for (const ab of getCardAbilities(card)) {
    for (const e of ab.effects) {
      if (e.label !== "exile-from-graveyard") continue;
      if (e.kind === "all") return true;
      if (e.kind === "that-card" && e.from === "your") return true;
    }
  }
  return false;
}
```

Replace the body of `parseCommanderNeeds` from `needs.graveyard = ...` through the `token` candidate with:

```js
  needs.graveyard = /\bgraveyard\b/.test(text);

  // Greasefang-style engines bring cards back; Tormod-style engines care when cards leave. Only
  // the first is hurt by something that exiles your graveyard. Read from the commander's own
  // abilities, one text at a time, so a partner's text cannot merge into the first.
  const returns = (commanderTexts || [])
    .filter((t) => typeof t === "string" && t.trim())
    .flatMap((t) => tagTextAbilities(t, ""))
    .flatMap((ab) => ab.effects)
    .filter((e) => e.label === "return-from-graveyard" && e.from === "your");
  needs.returnsFromGraveyard = returns.length > 0;

  const candidates = [];
  for (const e of returns) {
    const typed = /^([a-z][a-z-]*)(?: creature| artifact| enchantment)?$/.exec(String(e.object || ""));
    if (typed) candidates.push(typed[1]);
  }
  const token = text.match(/create [^.]*?\b([a-z]+) creature tokens?/);
  if (token) candidates.push(token[1]);
```

(Keep the `needs.payloadType = candidates.find(...)` line and the devotion loop below unchanged.) In `getEngineClasses`, replace `ENGINE_GRAVEYARD_HOSTILE_PATTERN.test(text)` with `isGraveyardHostile(card)` and delete the `ENGINE_GRAVEYARD_HOSTILE_PATTERN` constant and its comment.

- [ ] **Step 4: Run to verify they pass**

Run: `bash dev/tests/jxa/run_all.sh engines`
Expected: `engines: 54 passed, 0 failed SUITE OK` (49 old + 5 new). If an old parse test fails, the label read of the return clause differs from the old regex: fix `parseCommanderNeeds`, not the test.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Read a commander's return clause and the graveyard veto from ability labels

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Engine classes from labels

**Files:**
- Modify: `js/analysis/engines.js`
- Test: `dev/tests/jxa/engines.test.js`

**Interfaces:**
- Consumes: `getCardAbilities`, `isOneShotAbility`, `getAbilityManaCost` (Task 1), `isGraveyardHostile` (Task 3).
- Produces: `getEngineClassDetails(card, needs) -> [{ cls, weak, flaws[] }]`; `getEngineClasses(card, needs) -> string[]` (names of the details). Class names unchanged: `payload`, `recursion`, `recursionGeneric`, `discard`, `selfMill`, `surveil`, `sacrifice`, `lord`, `crewTap`, `crewHelper`, `crewBody`, `devotionPayoff`. `ENGINE_WEAK_CLASSES` stays. `getAbilityStrength(ab, card) -> { oneShot, mana, weak }`.

- [ ] **Step 1: Write the failing tests**

Append to the object in `dev/tests/jxa/engines.test.js`:

```js
  ,
  "getEngineClasses: a discard limited to creature cards is no outlet for a Vehicle but is for a Zombie": function () {
    const maggots = { name: "Maggots-shaped", type: "creature — insect", text: "when this creature enters, discard any number of creature cards. for each card discarded this way, put two +1/+1 counters on this creature.", cmc: 4 };
    const vehicle = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    const zombie = { payloadType: "zombie", graveyard: true, returnsFromGraveyard: false, devotionColors: [] };
    assertTrue(getEngineClasses(maggots, vehicle).indexOf("discard") === -1, "a Vehicle is not a creature card");
    assertTrue(getEngineClasses(maggots, zombie).indexOf("discard") !== -1, "a Zombie is a creature card");
  },
  "getEngineClasses: a looter that says 'you may draw a card. if you do, discard a card' is a discard outlet": function () {
    const copter = { name: "Copter-shaped", type: "artifact — vehicle", text: "flying\nwhenever this vehicle attacks or blocks, you may draw a card. if you do, discard a card.\ncrew 1", cmc: 2 };
    const needs = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    assertTrue(getEngineClasses(copter, needs).indexOf("discard") !== -1);
  },
  "getEngineClasses: dredge returns a card from the graveyard, it is not self-mill": function () {
    const darkblast = { name: "Darkblast-shaped", type: "instant", text: "target creature gets -1/-1 until end of turn.\ndredge 3", cmc: 1 };
    const needs = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    assertTrue(getEngineClasses(darkblast, needs).indexOf("selfMill") === -1);
  },
  "getEngineClasses: a mill-then-return-either-type card is specific recursion plus self-mill": function () {
    const cruiser = { name: "Cruiser-shaped", type: "artifact — vehicle", text: "when this vehicle enters, mill two cards. then return a creature or vehicle card from your graveyard to your hand.\ncrew 1", cmc: 3 };
    const needs = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    const classes = getEngineClasses(cruiser, needs);
    assertTrue(classes.indexOf("recursion") !== -1 && classes.indexOf("selfMill") !== -1 && classes.indexOf("payload") !== -1);
  },
  "getEngineClasses: recursion counts by what it can return": function () {
    const vehicle = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    const zombie = { payloadType: "zombie", graveyard: true, returnsFromGraveyard: false, devotionColors: [] };
    const reclaimer = { name: "Reclaimer-shaped", type: "creature — angel", text: "when this creature enters, return target noncreature, nonland permanent card with mana value x or less from your graveyard to the battlefield, where x is the amount of mana spent to cast this creature.", cmc: 3 };
    const anyCard = { name: "Regrowth-shaped", type: "sorcery", text: "return target card from your graveyard to your hand.", cmc: 2 };
    const topOfLibrary = { name: "Thug-shaped", type: "creature — human", text: "when this creature dies, put target creature card from your graveyard on top of your library.", cmc: 3 };
    assertTrue(getEngineClasses(reclaimer, vehicle).indexOf("recursionGeneric") !== -1, "noncreature permanents include Vehicles");
    assertTrue(getEngineClasses(reclaimer, zombie).indexOf("recursionGeneric") === -1, "noncreature permanents never include Zombies");
    assertTrue(getEngineClasses(anyCard, vehicle).indexOf("recursionGeneric") !== -1, "an unrestricted card includes Vehicles");
    assertTrue(getEngineClasses(topOfLibrary, zombie).indexOf("recursionGeneric") === -1, "to the library is not returned to hand or battlefield");
  },
  "getEngineClassDetails: 'target player discards' is a weak discard, a plain loot is not": function () {
    const needs = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    const burglar = { name: "Burglar-shaped", type: "creature — rogue", text: "{2}{b}, {t}: target player discards a card. activate only as a sorcery.", cmc: 2 };
    const looter = { name: "Looter-shaped", type: "creature — human", text: "whenever this creature attacks, draw a card, then discard a card.", cmc: 2 };
    const burgled = getEngineClassDetails(burglar, needs).find((d) => d.cls === "discard");
    const looted = getEngineClassDetails(looter, needs).find((d) => d.cls === "discard");
    assertTrue(burgled && burgled.weak, "can hit an opponent, so weak");
    assertTrue(looted && !looted.weak, "repeatable and free");
  },
  "getAbilityStrength: cost per use decides weak, not just whether it repeats": function () {
    const card = (text, type, cmc) => ({ name: "Test Card", type: type, text: text, cmc: cmc });
    const strength = (c) => getAbilityStrength(getCardAbilities(c)[0], c);
    assertTrue(!strength(card("{1}, {t}: draw a card, then discard a card.", "artifact", 2)).weak, "{1} repeatable");
    assertTrue(!strength(card("{2}, {t}: draw a card, then discard a card.", "artifact", 2)).weak, "{2} repeatable");
    assertTrue(strength(card("{3}, {t}: draw a card, then discard a card.", "artifact", 2)).weak, "{3} repeatable");
    assertTrue(!strength(card("mill three cards.", "sorcery", 2)).weak, "cheap one-shot");
    assertTrue(!strength(card("mill three cards.", "sorcery", 3)).weak, "mana value 3 one-shot");
    assertTrue(strength(card("mill three cards.", "sorcery", 5)).weak, "expensive one-shot");
    assertTrue(!strength(card("{2}{b}, sacrifice this creature: mill four cards.", "creature — thrull", 3)).weak, "cheap self-sacrifice one-shot");
  }
```

- [ ] **Step 2: Run to verify they fail**

Run: `bash dev/tests/jxa/run_all.sh engines`
Expected: the new tests FAIL (`getEngineClassDetails` / `getAbilityStrength` not defined, plus the Maggots and dredge expectations); the old 54 still pass.

- [ ] **Step 3: Implement**

In `js/analysis/engines.js`, delete these constants (they are replaced by labels): `ENGINE_DISCARD_PATTERN`, `ENGINE_MILL_COUNT`, `ENGINE_SELF_MILL_PATTERN`, `ENGINE_OPPONENT_MILL_PATTERN`, `ENGINE_SURVEIL_PATTERN`, `ENGINE_SACRIFICE_PATTERN`, `ENGINE_CREW_TAP_PATTERN`, `ENGINE_CREW_HELPER_PATTERN`, and the comments above them. Keep `ENGINE_DEVOTION_PAYOFF_PATTERN`.

Replace the whole `getEngineClasses` function with:

```js
// Payload types that are not creatures: a "creature card" in the graveyard is never one.
const ENGINE_NONCREATURE_PAYLOADS = new Set(["vehicle", "equipment", "aura", "saga", "food", "clue", "treasure"]);

// Cost per use decides whether a graveyard enabler is strong (spec requirement 9): a repeatable
// ability is weak at {3} or more, a one-shot at mana value 4 or more.
const ENGINE_REPEATABLE_WEAK_MANA = 3;
const ENGINE_ONE_SHOT_WEAK_CMC = 4;

function getAbilityStrength(ab, card) {
  const oneShot = isOneShotAbility(ab);
  const mana = getAbilityManaCost(ab);
  const cmc = Number(card && card.cmc) || 0;
  return { oneShot, mana, weak: oneShot ? cmc >= ENGINE_ONE_SHOT_WEAK_CMC : mana >= ENGINE_REPEATABLE_WEAK_MANA };
}

// A real enabler can still be a worse one: these flaws cost a few points and are shown in the report.
function getAbilityFlaws(ab, creaturePayload) {
  const flaws = [];
  if (ab.restrictions.includes("sorcery-speed")) flaws.push("sorcery-speed");
  if (ab.cost.includes("pay-life")) flaws.push("pays life");
  if (ab.cost.includes("discard-multiple")) flaws.push("discards two or more");
  if (ab.cost.includes("tap-other")) flaws.push("taps another permanent");
  const fuel = ab.effects.find((e) => e.label === "exile-from-graveyard" && e.kind === "own-cards" && e.from === "your");
  if (fuel && !(/\bcreature\b/.test(fuel.object) && !creaturePayload)) flaws.push("spends graveyard cards");
  return flaws;
}

function engineObjectNamesType(object, type) {
  return new RegExp(`\\b${type}s?\\b`).test(String(object || ""));
}

// Can a return-from-graveyard object be the payload without naming it? A Vehicle is an artifact
// and a permanent but never a "creature card"; a creature type is a creature and a permanent.
function engineObjectFitsGeneric(object, creaturePayload) {
  const o = String(object || "");
  if (o === "any") return true;
  if (creaturePayload) return !/\bnoncreature\b/.test(o) && /\b(?:creature|permanent)\b/.test(o);
  return /\b(?:permanent|artifact)\b/.test(o);
}

// Can a discard filter ("a creature card", "an artifact card") discard the payload?
function engineDiscardFits(object, type, creaturePayload) {
  const o = String(object || "");
  if (!o || o === "any" || engineObjectNamesType(o, type)) return true;
  if (/\b(?:nonland|permanent)\b/.test(o)) return true;
  return creaturePayload ? /\bcreature\b/.test(o) : /\b(?:artifact|noncreature)\b/.test(o);
}

function getEngineClassDetails(card, needs) {
  if (!card || !isEngineActive(needs)) return [];
  const text = getCardText(card);
  const abilities = getCardAbilities(card);
  const found = new Map();
  // Keep the strongest reading of a class: not weak beats weak, then fewer flaws.
  const add = (cls, weak, flaws) => {
    const isWeak = weak || ENGINE_WEAK_CLASSES.has(cls);
    const prev = found.get(cls);
    if (!prev || (prev.weak && !isWeak) || (prev.weak === isWeak && flaws.length < prev.flaws.length)) {
      found.set(cls, { cls, weak: isWeak, flaws });
    }
  };

  const type = needs.payloadType ? engineTypePattern(needs.payloadType) : "";
  if (type) {
    const creaturePayload = !ENGINE_NONCREATURE_PAYLOADS.has(type);
    if (getCardSubtypes(card).includes(type)) add("payload", false, []);

    if (needs.graveyard && !(needs.returnsFromGraveyard && isGraveyardHostile(card))) {
      for (const ab of abilities) {
        const flaws = getAbilityFlaws(ab, creaturePayload);
        const weak = getAbilityStrength(ab, card).weak;
        for (const e of ab.effects) {
          if (e.label === "return-from-graveyard" && e.from === "your" && e.object !== "self" && (e.to === "battlefield" || e.to === "hand")) {
            if (engineObjectNamesType(e.object, type)) add("recursion", false, flaws);
            else if (engineObjectFitsGeneric(e.object, creaturePayload)) add("recursionGeneric", false, flaws);
          }
          if (e.label === "loot" || e.label === "rummage") add("discard", weak, flaws);
          if (e.label === "discard-self" && engineDiscardFits(e.object, type, creaturePayload)) add("discard", weak, flaws);
          if (e.label === "discard-any-player") add("discard", true, flaws);
          if (e.label === "mill-self" && !ab.effects.some((x) => x.label === "mill-other")) add("selfMill", weak, flaws);
          if (e.label === "surveil") add("surveil", true, flaws);
        }
        if (ab.kind === "activated") {
          if (ab.cost.includes("discard-card") || ab.cost.includes("discard-multiple")) add("discard", weak, flaws);
          if (ab.cost.includes("sacrifice-other")) add("sacrifice", true, flaws);
        }
      }
    }

    if (new RegExp(`\\bother ${type}s?\\b|\\b${type}s? you control\\b`).test(text)) add("lord", false, []);

    if (type === "vehicle") {
      for (const ab of abilities) {
        if (ab.trigger.includes("crews") || ab.trigger.includes("becomes-tapped")) add("crewTap", false, []);
        if (ab.effects.some((e) => e.label === "crew-helper")) add("crewHelper", false, []);
      }
      const power = Number(card.raw && card.raw.power);
      if (getCardType(card).includes("creature") && Number(card.cmc || 0) <= 2 && power >= 3) add("crewBody", false, []);
    }
  }

  if (needs.devotionColors && needs.devotionColors.length && ENGINE_DEVOTION_PAYOFF_PATTERN.test(text)) {
    add("devotionPayoff", false, []);
  }
  return Array.from(found.values());
}

function getEngineClasses(card, needs) {
  return getEngineClassDetails(card, needs).map((d) => d.cls);
}
```

`ENGINE_WEAK_CLASSES` is declared further down the file with `const`; since `getEngineClassDetails` only runs after the whole file has loaded, no reorder is needed.

- [ ] **Step 4: Run to verify they pass**

Run: `bash dev/tests/jxa/run_all.sh`
Expected: every suite `SUITE OK`; `engines` now 61 passed (54 + 7). The original 49 engine tests are the regression net for this port: if one fails, the label rule is wrong or a tagger label is missing, so fix the tagger or the rule, never the old test (unless the old test encodes one of the spec's listed fixes, in which case say so in the commit message).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Decide engine classes from ability labels instead of text patterns

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Flaw penalties and cost-based injection

**Files:**
- Modify: `js/analysis/engines.js`
- Test: `dev/tests/jxa/engines.test.js`

**Interfaces:**
- Consumes: `getEngineClassDetails` (Task 4).
- Produces: `getEngineBonus` subtracts `ENGINE_FLAW_PENALTY` (3) per flaw from a class's weight, never below half the weight; `addEngineCandidates` and `listEngineEnablers` use `!detail.weak`.

- [ ] **Step 1: Write the failing tests**

Append to the object in `dev/tests/jxa/engines.test.js`:

```js
  ,
  "getEngineBonus: a flaw costs three points, never more than half the class weight": function () {
    const needs = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    const clean = { name: "Clean", type: "artifact", text: "{1}, {t}: draw a card, then discard a card.", cmc: 2 };
    const slow = { name: "Slow", type: "artifact", text: "{1}, {t}: draw a card, then discard a card. activate only as a sorcery.", cmc: 2 };
    const awful = { name: "Awful", type: "artifact", text: "{1}, {t}, pay 1 life, discard two cards: draw a card, then discard a card. activate only as a sorcery.", cmc: 2 };
    assertEqual(getEngineBonus(clean, needs) - getEngineBonus(slow, needs), 3);
    assertEqual(getEngineBonus(awful, needs), ENGINE_CLASS_WEIGHTS.discard / 2, "floor at half the weight");
  },
  "addEngineCandidates: an expensive repeatable outlet and a pricey one-shot are scored but not injected": function () {
    const needs = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    const make = (name, type, text, cmc) => [normalizeCardName(name), { name: name, type: type, text: text, cmc: cmc, colors: [] }];
    const owned = new Map([
      make("Cheap Outlet", "artifact", "{1}, {t}: draw a card, then discard a card.", 2),
      make("Costly Outlet", "artifact", "{3}, {t}: draw a card, then discard a card.", 2),
      make("Cheap Mill", "sorcery", "mill three cards.", 2),
      make("Costly Mill", "sorcery", "mill three cards.", 5),
      make("Burglar", "creature — rogue", "{2}{b}, {t}: target player discards a card.", 2)
    ]);
    const tier = addEngineCandidates(new Map(), needs, owned, []);
    assertTrue(tier.has("cheap outlet") && tier.has("cheap mill"), "cheap ones are injected");
    assertTrue(!tier.has("costly outlet") && !tier.has("costly mill") && !tier.has("burglar"), "weak ones are not");
    assertTrue(getEngineBonus(owned.get("costly mill"), needs) > 0, "but a weak enabler still scores");
  },
  "listEngineEnablers: a weak enabler is not listed as the reason a card is in the deck": function () {
    const needs = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    const owned = new Map([
      [normalizeCardName("Costly Mill"), { name: "Costly Mill", type: "sorcery", text: "mill three cards.", cmc: 5, colors: [] }],
      [normalizeCardName("Cheap Mill"), { name: "Cheap Mill", type: "sorcery", text: "mill three cards.", cmc: 2, colors: [] }]
    ]);
    const deck = [{ name: "Costly Mill", role: "spell" }, { name: "Cheap Mill", role: "spell" }];
    assertEqual(listEngineEnablers(deck, owned, needs), ["Cheap Mill"]);
  }
```

- [ ] **Step 2: Run to verify they fail**

Run: `bash dev/tests/jxa/run_all.sh engines`
Expected: all three FAIL (no penalty yet; weak enablers still injected and listed).

- [ ] **Step 3: Implement**

Add next to `ENGINE_MULTI_HIT_BONUS`:

```js
const ENGINE_FLAW_PENALTY = 3;         // per flaw on the ability that earned the class
```

In `getEngineBonus`, replace the first three lines of the class loop (from `const classes = getEngineClasses(card, needs);` through the multi-hit line) with:

```js
  const details = getEngineClassDetails(card, needs);
  const classes = details.map((d) => d.cls);
  let bonus = 0;
  for (const d of details) {
    const weight = ENGINE_CLASS_WEIGHTS[d.cls] || 0;
    bonus += Math.max(weight / 2, weight - ENGINE_FLAW_PENALTY * d.flaws.length);
  }
  if (classes.length > 1) bonus += ENGINE_MULTI_HIT_BONUS * (classes.length - 1);
```

(The lines after it that use `classes.includes("payload")` keep working.) In `addEngineCandidates`, replace the `strong` line with:

```js
    const strong = getEngineClassDetails(card, needs).filter((d) => !d.weak);
```

and update the comment above `ENGINE_WEAK_CLASSES` to end: `A single ability can also be weak by cost per use (spec requirement 9), which getEngineClassDetails marks.` In `listEngineEnablers`, replace the `getEngineClasses(card, needs).some(...)` condition with `getEngineClassDetails(card, needs).some((d) => !d.weak)`.

- [ ] **Step 4: Run to verify they pass**

Run: `bash dev/tests/jxa/run_all.sh`
Expected: every suite `SUITE OK`; `engines` 64 passed.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Charge flaws against an enabler and keep expensive ones out of the theme tier

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The voltron tag stops reading "attach" as a substring

**Files:**
- Modify: `js/analysis/scoring.js` (the `voltron` tag in `detectCardTags`, near line 700-710)
- Test: `dev/tests/jxa/scoring.test.js`

**Interfaces:**
- Consumes: `hasAttachmentSignal(card)` (Task 1/2).
- Produces: `detectCardTags(card)` no longer tags `voltron` for attachment hosers.

- [ ] **Step 1: Write the failing test**

Append to the object in `dev/tests/jxa/scoring.test.js` (comma after the last entry):

```js
  ,
  "detectCardTags: attachment hosers are not voltron, attachment payoffs and movers are": function () {
    const card = (name, type, text) => ({ name: name, type: type, text: text, cmc: 3 });
    const tags = (c) => detectCardTags(c);
    assertTrue(tags(card("Street Sweeper", "artifact creature — construct", "whenever this creature attacks, destroy all auras attached to target land.")).indexOf("voltron") === -1, "Street Sweeper destroys Auras");
    assertTrue(tags(card("Disarm", "instant", "unattach all equipment from target creature.")).indexOf("voltron") === -1, "Disarm removes Equipment");
    assertTrue(tags(card("Stolen Uniform", "instant", "choose target creature you control and target equipment. gain control of that equipment until end of turn. attach it to the chosen creature.")).indexOf("voltron") !== -1, "Stolen Uniform moves Equipment");
    assertTrue(tags(card("Enchantment Alteration", "instant", "attach target aura attached to a creature or land to another permanent of that type.")).indexOf("voltron") !== -1, "Enchantment Alteration moves an Aura");
    assertTrue(tags(card("Brood Keeper", "creature — dragon", "flying\nwhenever an aura becomes attached to this creature, create a 2/2 red dragon creature token with flying.")).indexOf("voltron") !== -1, "Brood Keeper");
    assertTrue(tags(card("Plain Equipment", "artifact — equipment", "equipped creature gets +1/+1.\nequip {1}")).indexOf("voltron") !== -1, "an Equipment still counts");
  }
```

- [ ] **Step 2: Run to verify it fails**

Run: `bash dev/tests/jxa/run_all.sh scoring`
Expected: the new test FAILS on Street Sweeper (the substring match still tags it voltron).

- [ ] **Step 3: Implement**

In `js/analysis/scoring.js`, in the `voltron` block of `detectCardTags`, replace the line `text.includes("attach")` with `hasAttachmentSignal(card)`:

```js
  if (
    type.includes("equipment") ||
    type.includes("aura") ||
    text.includes("equipped creature") ||
    text.includes("enchanted creature") ||
    hasAttachmentSignal(card)
  ) {
    tags.push("voltron");
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `bash dev/tests/jxa/run_all.sh`
Expected: every suite `SUITE OK`, `scoring` one more passing than before. If `theme-tab` or `commanders-tab` fail with `Can't find variable: hasAttachmentSignal`, their chain lacks `abilities.js`; `run_all.sh` reads the list from `build_harness.sh`, so check Task 1's insertion landed in that list.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Stop tagging attachment hosers as voltron cards

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Show why each enabler was picked

**Files:**
- Modify: `js/analysis/engines.js`, `js/main.js` (near line 536), `js/ui/report.js` (`displayBuildBreakdown`)
- Test: `dev/tests/jxa/engines.test.js`

**Interfaces:**
- Consumes: `getEngineClassDetails` (Task 4).
- Produces: `describeEngineEnablers(deck, allOwnedCardData, needs) -> [{ name, reason, flaws[] }]`; `describeEngineEnablerItem(item) -> string`, e.g. `Heirloom Mirror (self-mill; flawed: sorcery-speed, pays life)`. `listEngineEnablers` keeps returning names only. `engineNote` passed to `displayBuildBreakdown` becomes `{ label, items }`.

- [ ] **Step 1: Write the failing tests**

Append to the object in `dev/tests/jxa/engines.test.js`:

```js
  ,
  "describeEngineEnablers: each enabler comes with the reason it earned a place": function () {
    const needs = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    const owned = new Map([
      [normalizeCardName("Looter"), { name: "Looter", type: "creature — human", text: "whenever this creature attacks, draw a card, then discard a card.", cmc: 2, colors: [] }],
      [normalizeCardName("Mirror"), { name: "Mirror", type: "artifact", text: "{1}, {t}, pay 1 life, discard a card: draw a card, mill a card. activate only as a sorcery.", cmc: 2, colors: [] }],
      [normalizeCardName("Copter"), { name: "Copter", type: "artifact — vehicle", text: "flying\ncrew 1", cmc: 2, colors: [] }]
    ]);
    const deck = [{ name: "Looter", role: "creature" }, { name: "Mirror", role: "artifact" }, { name: "Copter", role: "artifact" }, { name: "Swamp", role: "land" }];
    const items = describeEngineEnablers(deck, owned, needs);
    assertEqual(items.map((i) => i.name), ["Looter", "Mirror", "Copter"]);
    assertEqual(items[0].reason, "discard outlet");
    assertEqual(items[1].flaws, ["sorcery-speed", "pays life"]);
    assertEqual(items[2].reason, "is a Vehicle");
  },
  "describeEngineEnablerItem: a clean card shows its reason, a flawed one shows the flaws": function () {
    assertEqual(describeEngineEnablerItem({ name: "Looter", reason: "discard outlet", flaws: [] }), "Looter (discard outlet)");
    assertEqual(describeEngineEnablerItem({ name: "Mirror", reason: "self-mill", flaws: ["sorcery-speed", "pays life"] }), "Mirror (self-mill; flawed: sorcery-speed, pays life)");
  }
```

- [ ] **Step 2: Run to verify they fail**

Run: `bash dev/tests/jxa/run_all.sh engines`
Expected: both FAIL with `Can't find variable: describeEngineEnablers`.

- [ ] **Step 3: Implement**

In `js/analysis/engines.js`, after `listEngineEnablers`, add:

```js
const ENGINE_CLASS_REASONS = {
  discard: () => "discard outlet",
  selfMill: () => "self-mill",
  recursion: (needs) => `returns ${needs.payloadType}s`,
  recursionGeneric: () => "recursion",
  surveil: () => "surveil",
  sacrifice: () => "sacrifice outlet",
  lord: () => "lord",
  crewTap: () => "pays off crewing",
  crewHelper: () => "crew helper",
  crewBody: () => "crew body",
  devotionPayoff: () => "devotion payoff",
  payload: (needs) => `is a ${needs.payloadType.charAt(0).toUpperCase()}${needs.payloadType.slice(1)}`
};

// Why each nonland deck card is an enabler: its strongest class, and the flaws on that class.
function describeEngineEnablers(deck, allOwnedCardData, needs) {
  if (!isEngineActive(needs)) return [];
  const items = [];
  for (const entry of deck || []) {
    if (entry.role === "land") continue;
    const card = allOwnedCardData.get(normalizeCardName(entry.name));
    if (!card) continue;
    const strong = getEngineClassDetails(card, needs).filter((d) => !d.weak);
    if (!strong.length) continue;
    strong.sort((a, b) => (ENGINE_CLASS_WEIGHTS[b.cls] || 0) - (ENGINE_CLASS_WEIGHTS[a.cls] || 0));
    items.push({ name: entry.name, reason: ENGINE_CLASS_REASONS[strong[0].cls](needs), flaws: strong[0].flaws });
  }
  return items;
}

function describeEngineEnablerItem(item) {
  return item.flaws && item.flaws.length ? `${item.name} (${item.reason}; flawed: ${item.flaws.join(", ")})` : `${item.name} (${item.reason})`;
}
```

and make `listEngineEnablers` a thin view: replace its whole body with `return describeEngineEnablers(deck, allOwnedCardData, needs).map((item) => item.name);`.

In `js/main.js`, replace the two lines around 536-539 with:

```js
  const engineItems = describeEngineEnablers(sanitizedFinalDeck, allOwnedCardData, modePrefs.engineNeeds);
  displayBuildBreakdown(
    sanitizedFinalDeck,
    engineItems.length ? { label: describeEngineNeeds(modePrefs.engineNeeds), items: engineItems } : null
  );
```

In `js/ui/report.js`, replace the `engineHtml` expression with:

```js
  const engineHtml = engineNote && engineNote.items.length
    ? `<div class="build-breakdown-note"><strong>${escapeHtml(engineNote.label)}:</strong> ${engineNote.items.map((item) => escapeHtml(describeEngineEnablerItem(item))).join(", ")}</div>`
    : "";
```

- [ ] **Step 4: Run to verify they pass**

Run: `bash dev/tests/jxa/run_all.sh`
Expected: every suite `SUITE OK`; `engines` 66 passed (the old `listEngineEnablers` tests still pass through the thin view).

Run: `node --check js/main.js && node --check js/ui/report.js && node --check js/analysis/engines.js`
Expected: no output. (The report line has no browser test; Task 9 records that.)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Say why each engine enabler was picked and mark the flawed ones

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Retire the prototype's judge and trim the eval tool

**Files:**
- Modify (rewrite): `dev/tools/jxa-harness/ability_eval.js`
- Delete: nothing else (the tagger already moved in Task 1)
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: `getCardAbilities`, `isGraveyardHostile` from the modules.
- Produces: `node dev/tools/jxa-harness/ability_eval.js <coverage|vocab [n]|case <names...>|vetoes>`.

The prototype's `judge`/`verdict`/`compare`/`check`/`deck` modes duplicate what `engines.js` now does and what the unit tests now pin; keeping two implementations would let them drift.

- [ ] **Step 1: Rewrite the tool**

Replace the whole file with:

```js
// Measures the ability labels over the owned collection and prints how single cards read.
// Usage: node dev/tools/jxa-harness/ability_eval.js coverage
//        node dev/tools/jxa-harness/ability_eval.js vocab [n]
//        node dev/tools/jxa-harness/ability_eval.js case "Bag of Holding" "Street Sweeper"
//        node dev/tools/jxa-harness/ability_eval.js vetoes
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const root = path.join(__dirname, "../..");
const ctx = vm.createContext({});
for (const file of ["js/constants.js", "js/utils/text.js", "js/utils/cards.js", "js/format.js", "js/analysis/abilities.js", "js/analysis/engines.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), ctx, { filename: file });
}
const T = vm.runInContext("({ tagCard: getCardAbilities, isGraveyardHostile })", ctx);
const owned = JSON.parse(fs.readFileSync(path.join(__dirname, "owned_raw.json"), "utf8"));
const byName = new Map();
for (const c of owned) {
  byName.set(c.name.toLowerCase(), c);
  const front = c.name.split(" // ")[0].toLowerCase();
  if (!byName.has(front)) byName.set(front, c);
}

function isLabeled(ab) {
  return ab.kind === "keyword" || ab.kind === "structural" || ab.effects.length > 0;
}

function coverage() {
  let cards = 0, cardsFull = 0, lines = 0, labeled = 0;
  const unlabeled = new Map();
  for (const raw of owned) {
    if (/^(?:basic )?land/i.test(raw.type_line) && !raw.oracle_text) continue;
    const abs = T.tagCard(raw);
    if (!abs.length) continue;
    cards++;
    let all = true;
    for (const ab of abs) {
      lines++;
      if (isLabeled(ab)) labeled++;
      else {
        all = false;
        const key = ab.line.replace(/\d+/g, "N").slice(0, 110);
        unlabeled.set(key, (unlabeled.get(key) || 0) + 1);
      }
    }
    if (all) cardsFull++;
  }
  console.log(`cards with rules text: ${cards}`);
  console.log(`cards where every line got a label: ${cardsFull} (${(100 * cardsFull / cards).toFixed(1)}%)`);
  console.log(`lines: ${lines}, labeled: ${labeled} (${(100 * labeled / lines).toFixed(1)}%)`);
  console.log("most common unlabeled lines:");
  [...unlabeled.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).forEach(([k, n]) => console.log(String(n).padStart(4), k));
}

function vocab(limit) {
  const wordRe = /graveyard|discard|\bmills?\b|surveil|\bcrews?\b|vehicle|connive|explore/;
  const labelRe = /^(?:return-from-graveyard|exile-from-graveyard|put-into-graveyard|mill-self|mill-other|surveil|loot|rummage|discard-self|discard-opponent|discard-any-player|crew-helper|explore-or-learn|keyword:(?:flashback|escape|unearth|embalm|eternalize|disturb|jump-start|aftermath|retrace|scavenge|dredge|crew|cycling))$/;
  let lines = 0, hit = 0;
  const miss = new Map();
  const seen = new Set();
  for (const raw of owned) {
    if (seen.has(raw.name)) continue;
    seen.add(raw.name);
    for (const ab of T.tagCard(raw)) {
      if (!wordRe.test(ab.line)) continue;
      lines++;
      const ok = ab.effects.some((e) => labelRe.test(e.label)) || ab.cost.some((c) => /discard|exile-self-from-graveyard/.test(c)) || ab.trigger.some((t) => /crews|discard-event|leave-graveyard|cycle-event/.test(t));
      if (ok) hit++;
      else {
        const key = ab.line.replace(/\d+/g, "N").slice(0, 120);
        miss.set(key, (miss.get(key) || 0) + 1);
      }
    }
  }
  console.log(`graveyard/discard/mill/crew-vocabulary lines: ${lines}, with a matching label: ${hit} (${(100 * hit / lines).toFixed(1)}%)`);
  [...miss.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit || 45).forEach(([k, n]) => console.log(String(n).padStart(4), k));
}

function showCase(name) {
  const raw = byName.get(name.toLowerCase());
  if (!raw) { console.log("not owned:", name); return; }
  console.log("==", raw.name, "|", raw.type_line);
  for (const ab of T.tagCard(raw)) {
    const eff = ab.effects.map((e) => e.label + (e.object ? `(${e.object}${e.to ? "->" + e.to : ""}${e.kind ? "/" + e.kind : ""})` : "")).join(" ");
    console.log(`  [${ab.kind}] trig=${ab.trigger.join("+") || "-"} cost=${ab.cost.join("+") || "-"} eff=${eff || "-"} restr=${ab.restrictions.join("+") || "-"}`);
    console.log("     ", ab.line.slice(0, 140));
  }
}

// Every owned card the graveyard veto fires on: it should be rare and each one defensible.
function vetoes() {
  const seen = new Set();
  for (const raw of owned) {
    if (seen.has(raw.name)) continue;
    seen.add(raw.name);
    if (T.isGraveyardHostile(raw)) console.log(raw.name, "|", (raw.oracle_text || "").replace(/\n/g, " / ").slice(0, 150));
  }
}

const [mode, ...rest] = process.argv.slice(2);
if (mode === "coverage") coverage();
else if (mode === "vocab") vocab(+rest[0]);
else if (mode === "case") rest.forEach(showCase);
else if (mode === "vetoes") vetoes();
else console.log("modes: coverage | vocab [n] | case <names...> | vetoes");
```

- [ ] **Step 2: Check it still measures what the spec quotes**

Run: `node dev/tools/jxa-harness/ability_eval.js vetoes`
Expected: exactly three lines: Bag of Holding, Containment Construct, Lantern of the Lost. (This is the held-out check; a fourth line is a review item, not something to hide.)

Run: `node dev/tools/jxa-harness/ability_eval.js coverage | head -4`
Expected: lines roughly `87%` labeled and `79%` of cards fully labeled, within a point or two of the spec's figures.

Run: `node dev/tools/jxa-harness/ability_eval.js case "Street Sweeper" "Disarm" "Smuggler's Copter"`
Expected: Street Sweeper and Disarm show `hose-attachment`; Smuggler's Copter shows `discard-self`.

- [ ] **Step 3: Update AGENTS.md and commit**

In `AGENTS.md`, in the paragraph that mentions `dev/tools/jxa-harness/engine_matches.js`, add: `ability_eval.js prints label coverage over the owned collection (coverage, vocab), how single cards read (case), and the graveyard-veto list (vetoes).`

```bash
git add -A && git commit -m "Trim the ability eval tool to coverage, vocab, single-card and veto views

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Measure against the baseline and stop for the player

**Files:**
- Create: `dev/tools/jxa-harness/baselines/2026-10-15-after-labels-phase1.json`
- Modify: `dev/docs/superpowers/specs/2026-10-15-ability-labels.md` (record the measured result)

**Interfaces:**
- Consumes: everything above. Produces: the after baseline, the diff reading, and the Callaphe recheck.

- [ ] **Step 1: Full suite on the finished tree**

Run: `bash dev/tests/jxa/run_all.sh`
Expected: every suite `SUITE OK`. Record the passing counts in the commit message of step 6.

- [ ] **Step 2: Build all 56 and save the after baseline**

Run (about 2 minutes):

```bash
SP=/private/tmp/claude-502/-Users-seth-burns-xpwd-p-projects-bulk-to-bracket/9941358e-5bc4-47a7-9492-d43a0f7aafe3/scratchpad
bash dev/tools/jxa-harness/build_harness.sh $SP/combined.js
cat $SP/combined.js dev/tools/jxa-harness/dump_decks.js | osascript -l JavaScript | grep '^DECKS ' | sed 's/^DECKS //' > dev/tools/jxa-harness/baselines/2026-10-15-after-labels-phase1.json
node -e "console.log(Object.keys(require('./dev/tools/jxa-harness/baselines/2026-10-15-after-labels-phase1.json')).length + ' entries')"
```

Expected: `56 entries`. If an `ERROR:` line appears instead, the harness chain is missing a file or a function; fix the cause, do not edit the baseline.

- [ ] **Step 3: Diff against the engine-enablers baseline**

Run: `python3 dev/tools/jxa-harness/engine_compare.py dev/tools/jxa-harness/baselines/2026-10-15-after-enablers.json dev/tools/jxa-harness/baselines/2026-10-15-after-labels-phase1.json`

Read the output against the expected moves (spec, Verification 5):
- **Must be unchanged:** Kaza, Zodiark, Fynn, Kardur (no engine need). Any change here is a bug: find which label fired and fix it before going on.
- **Expected on Greasefang:** gains Smuggler's Copter-style loots and discard-for-value cards (Miasma Demon, Armix, Azula if not already in); Zombie Infestation and Heirloom Mirror stay eligible but are marked flawed; creature-card recursion that is not a Vehicle mover no longer counts as an enabler (Foul Renewal, Miraculous Recovery); dredge cards (Golgari Thug, Stinkweed Imp, Darkblast) leave its self-mill; Bag of Holding is absent.
- **Expected on Tormod + Ghost:** dredge cards still help (leaving the graveyard needs no class change in Phase 1); little else moves.
- **Expected elsewhere:** the seven commanders from the first spec build as in the baseline except where the changed `voltron` tag or label reads move a card; record any move you cannot explain.
- **Creature counts** stay within the first spec's ranges (Greasefang 15, Tormod pair 25, Callaphe 17 in the enablers baseline).

Write what moved, per commander, in a short list. Unexplained moves are findings, not noise.

- [ ] **Step 4: Callaphe under the plan the player used**

Run (this reproduces the build where Street Sweeper appeared):

```bash
SP=/private/tmp/claude-502/-Users-seth-burns-xpwd-p-projects-bulk-to-bracket/9941358e-5bc4-47a7-9492-d43a0f7aafe3/scratchpad
{ printf 'const ONLY_COMMANDERS = ["Callaphe, Beloved of the Sea"];\nconst MODE_OVERRIDE = "theme:auras~voltron~devotion";\n'; cat $SP/combined.js dev/tools/jxa-harness/dump_decks.js; } > $SP/run_callaphe.js
osascript -l JavaScript $SP/run_callaphe.js | grep '^DECKS ' | sed 's/^DECKS //' > $SP/callaphe_after.json
node -e "const l=require('$SP/callaphe_after.json')['Callaphe, Beloved of the Sea'].current; for (const n of ['Street Sweeper','Disarm','Enchantment Alteration','Stolen Uniform']) console.log(n, l.includes(n) ? 'IN' : 'out');"
```

Expected: `Street Sweeper out`, `Disarm out`; Enchantment Alteration and Stolen Uniform may be `IN` or `out`: report which.

- [ ] **Step 5: Collateral and speed**

Sparse check: `grep -n "sparse\|thin" dev/tools/jxa-harness/*.js | head` to find how the thinned collection was run earlier; run the same on Greasefang and confirm a full deck completes (about 99 cards with lands). If no thinned-run script exists, say so and run the engines on a collection filtered to every third card with `node` by hand, reporting what you did.

Speed: `node -e` time `getCardAbilities` over the in-color pool for one commander (reuse `engine_matches.js`'s loader pattern); expected well under a second. Report the number.

- [ ] **Step 6: Record and commit, then stop**

Add a short "Phase 1 result" section to the end of `dev/docs/superpowers/specs/2026-10-15-ability-labels.md` with: suite counts, the baseline path, the per-commander list of moves from step 3, the Callaphe result from step 4, the speed number, and the line `The browser rendering of the report line is untested (no browser in this environment); the player checks it.`

```bash
git add -A && git commit -m "Record the labels port against the engine-enablers baseline

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

**Stop here.** Print for the player, in the final message: the per-commander moves, the full Greasefang list with each card's `describeEngineEnablerItem` reason, the Callaphe result, and the full list of rulings from this plan plus any made while executing. The player's read is the sign-off. Do not merge, push, or start Phase 2; ask which of merge / PR / keep applies.

---

## Self-review (spec coverage)

- Req 1 (module, load order): Task 1. Req 2 (cache): Task 1 (`getCardAbilities`, tested). Req 3 (record shape): Task 1. Req 4 (vocabulary, attachment split, crew trigger): Tasks 1-2. Req 5 (needs from labels): Task 3 (`returnsFromGraveyard` and return-clause type; token and devotion reads stay text-based, per the rulings). Req 6 (classes read labels, regexes deleted): Task 4. Req 7 (whole-ability judgments): Tasks 3-4 (veto, typed discard, recursion objects, fuel flaw in Task 4). Req 8 (flaws): Tasks 4-5. Req 9 (cost per use): Tasks 4-5. Req 10 (voltron): Task 6. Req 11 (report reasons): Task 7. Req 12 (no change without a need): Task 9 step 3. Verification 1-10: Tasks 1-9 (unit tests, held-out veto check in Task 8, diff in Task 9, Callaphe in Task 9, sparse and speed in Task 9 step 5, sign-off at the end).
- Not in this plan on purpose: Phase 2 (requirements 13-17), the `leavesGraveyard` class (requirement 6 mentions it; it belongs with Tormod's event in Phase 2), the wording-gap fixes (Aberrant Return, "defending player discards"), and relabeling roles.
- Placeholder scan: every code step shows code; commands show expected output. The two soft spots are Task 9 step 5 (the sparse-run script's location is looked up, not assumed) and the diff reading in step 3, which is a judgment against listed expectations, not a pass/fail number.
- Type consistency: `getEngineClassDetails` returns `{ cls, weak, flaws }` everywhere it is used (Tasks 4, 5, 7); `getAbilityStrength` returns `{ oneShot, mana, weak }`; the report note changes from `names` to `items` in `main.js` and `report.js` together in Task 7.
