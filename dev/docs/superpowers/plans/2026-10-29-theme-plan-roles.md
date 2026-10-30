# Theme-plan roles and shared-term synergy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give bottom-up theme plans the same roles tribal plans have (members, payoffs, amplifiers), guarantee a payoff minimum with a new reservation step, fix tribal conditional payoff wording, and measure all of it on 22 plans with an audit that is independent of the builder.

**Architecture:** A new pure module `js/analysis/terms.js` reads each card's words as terms it makes and need clauses it has. `archetypes.js` uses it to derive a theme plan's terms and to return `payoff` (and `member` + `engine`) standing for themes. `bottom-up-deck.js` gets a reservation step after the role loop. The scoreboard is a separate node tool in `dev/tools/jxa-harness/` that has its own copy of the reading and never imports `terms.js`.

**Tech Stack:** Plain global-scope browser JS (no modules, no build); JXA test suites via `dev/tests/jxa/run.sh`; node for the offline audit tools (loads app files in a `vm`, like `ability_eval.js`).

**Spec:** `dev/docs/superpowers/specs/2026-10-29-theme-plan-roles-design.md` (read it first; this plan only records decisions the spec leaves to the implementer). Reference scripts for the measure: `dev/tools/jxa-harness/spike-shared-terms/` (`spike.js` = reading + check set, `spike2.js` = measure + floor, `resv.js` = the reservation prototype that patches a copy of `buildDeckBottomUp` in a vm, `why.js` = why Wizard payoffs were not swapped, `tribepay.js` = the tribal pattern gap count).

## Global Constraints

- Static client-side app, no build step, plain global scripts, load order matters. Every new `js/` file is added to BOTH `index.html` and `pauper.html` in the same position AND to the script list in `dev/tools/jxa-harness/build_harness.sh` (the same position in all three). `terms.js` goes immediately before `js/analysis/archetypes.js`.
- Do not switch the JXA test runner; suites live in `dev/tests/jxa/*.test.js` and use `runSuite({...})`, `assertEqual`, `assertTrue`, and the `buCard(name, type, text, cmc, colors, rarity)` fixture helper from `archetypes.test.js`. A fixture card's own name must not occur as a word in its text.
- Do not touch `js/analysis/scoring.js`, `deck.js`, `engines.js` (commander-first path). The 13-build diff must come out unchanged.
- No new scoring weights: the existing `BOTTOM_UP_WEIGHT.payoff` applies to theme payoffs.
- Constants (spec values): `TERM_CLAUSE_MIN = 1.5` (natural log of nonland cards / (1 + cards making any term in the clause)); `PLAN_PAYOFF_MIN = 5`; plan terms are the terms at least 40% of a plan's members make; theme override table starts with `infect~deathtouch` only.
- Commit with explicit paths, never `git add -A` (the repo root holds untracked personal files). Never commit `ManaBox_Collection(mine).csv`, `owned_raw.friend.json`, or the precon cache. Use the owner's collection (`dev/tools/jxa-harness/owned_raw.json`) only; the friend's is not used in this plan.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Deviation from the spec, recorded: the spec says `bottom_up_audit.js` prints the three measures. `bottom_up_audit.js` is JXA and the measure is node, so the measures live in a new node script `dev/tools/jxa-harness/shared_terms.js`. `bottom_up_audit.js` is not modified.

## Review Focus

Inputs the spec implies but no task would otherwise test, each pinned in the task named:
1. A vanilla card (empty text) and a double-faced card (`card_faces`, "A // B" name) must not crash or invent terms (Task 3).
2. A tiny or sparse collection (under 200 nonland cards, or a Pauper collection of commons) must not invent payoffs: with too little supply every clause is "not counted" and the build equals today's (Tasks 3, 4, 5).
3. A theme tag with no members, or a plan whose derived terms are empty, builds exactly as before (Task 4).
4. Owned payoffs fewer than `PLAN_PAYOFF_MIN` must produce a report note, not filler padding and not an error (Task 5).
5. A card whose own text names the plan term as a target, not a need (removal "destroy target artifact" in an artifacts plan) must not become a payoff (Task 3, Task 4).

## File Structure

- Create `js/analysis/terms.js`: the term reading (needs from conditions, makes from types, keywords, effects) and the supply weighting. Pure functions over cards.
- Modify `js/analysis/archetypes.js`: tribal conditional payoff forms; `derivePlanTerms`; theme branch of `subtypeStanding`; theme `engine` flag.
- Modify `js/build/bottom-up-deck.js`: attach plan terms to the subtype; payoff reservation step; report fields.
- Modify `js/ui/bottom-up-tab.js`: one note line when payoffs available are fewer than the minimum.
- Create `dev/tools/jxa-harness/shared_terms.js`, `fetch_precons.js`, `precon_floor.json`, `baselines/2026-10-29-terms-before.json`: the independent audit.
- Create `dev/tools/jxa-harness/placeholder_diagnosis.js`.
- Create `dev/tests/jxa/terms.test.js`; extend `archetypes.test.js` and `bottom-up-deck.test.js`.
- Modify `index.html`, `pauper.html`, `dev/tools/jxa-harness/build_harness.sh`, `AGENTS.md`, `.gitignore`.

---

### Task 0: Housekeeping commits and the existing-suite baseline

**Files:**
- Modify: `.gitignore` (add `dev/tools/jxa-harness/precon_full.json`)
- Commit: `dev/tools/jxa-harness/connections.js`; `dev/docs/superpowers/specs/2026-10-29-theme-plan-roles-design.md`; `dev/docs/superpowers/plans/2026-10-29-theme-plan-roles.md`; `dev/tools/jxa-harness/spike-shared-terms/`

**Interfaces:** Produces: a clean working tree for tracked files, and `/tmp`-free baseline text in `dev/tools/jxa-harness/baselines/2026-10-29-suites-before.txt` (the output of `run_all.sh`).

- [ ] **Step 1: Run the existing suites and save the output.** Run `bash dev/tests/jxa/run_all.sh > dev/tools/jxa-harness/baselines/2026-10-29-suites-before.txt 2>&1`. Expected: one line per suite; read it and note any suite that already fails (a pre-existing failure is recorded, not fixed here).
- [ ] **Step 2: Syntax-check and commit `connections.js` alone.** `node --check dev/tools/jxa-harness/connections.js`, then `git add dev/tools/jxa-harness/connections.js` and commit `Extend the connection reader: kinds of spell, attack, tribe subjects, poison, deathtouch; supply sac-outlet and discard-fodder`.
- [ ] **Step 3: Add the `.gitignore` line, then commit the spec, this plan, the spike folder and the suite baseline** in one commit `Add theme-plan roles design, plan and the shared-term spike reference`.
- [ ] **Step 4: Verify.** `git status --short` shows only the two known untracked personal/doc files.

### Task 1: Independent audit tool, check set, precon floor, frozen baseline

**Files:**
- Create: `dev/tools/jxa-harness/fetch_precons.js`, `dev/tools/jxa-harness/shared_terms.js`, `dev/tools/jxa-harness/precon_floor.json`, `dev/tools/jxa-harness/baselines/2026-10-29-terms-before.json`

**Interfaces:**
- Produces `node dev/tools/jxa-harness/fetch_precons.js` → writes `dev/tools/jxa-harness/precon_full.json` (git-ignored; MTGJSON Commander decks 2022+, Collector editions dropped; same shape as the spike's `precon_full.json`).
- Produces `node dev/tools/jxa-harness/shared_terms.js <mode>` with modes `checks` (prints PASS/FAIL per pair, exit code 1 on any failure), `floor` (recomputes and writes `precon_floor.json`: p10/p50/p90 of linked share, payoff cards, engines over the precons), `audit` (builds the 22 plans at midrange from the app's own `js/` loaded in a vm, prints linked %, payoff cards, engines, placeholders, builder payoffs, creature count, role counts, and writes the same as JSON when given `--out <file>`), `compare <baseline.json>` (prints the acceptance verdict per plan; see Task 6).
- Exports (for tests of the tool itself, optional): `readTerms(card)`, `measure(cards)`, `CHECKS`, `PLANS`.
- **Independence rule:** this file has its own copy of the reading (from `spike.js`) and must never call `js/analysis/terms.js`. It loads the app's files only to build decks.

- [ ] **Step 1: Write `fetch_precons.js`** from `spike-shared-terms/fetchpre.js`, writing to the repo path above. Run it; expected: `129 decks` (or the current count) and the file exists.
- [ ] **Step 2: Write `shared_terms.js`** by promoting `spike.js` (reading, weights, check set, lift) and `spike2.js` (measure, floor, 22-plan builds). `PLANS` is the 12 sample plans plus the 10 held-out plans with these fixed colors: warrior RG, soldier WR, rogue UB, elf GB, zombie BU (tribal); tokens WR, counters GW, lifegain BW, blink GB, voltron UW (themes). Sample plans are the 12 in `bottom_up_audit.js`. Measure definitions are exactly the spec's: linked, payoff (need clause counted and met by at least 2 other deck cards), engine (term with at least 2 payoffs and at least 3 makers).
- [ ] **Step 3: Extend `CHECKS` to at least 20 pairs** (the spike's 12 plus 8 more drawn from colors the 12 do not cover: at least one each from white, green, black-only strategies; at least 4 additional negatives: opponent-scoped wording, "non-X", removal target, self-trigger). Resolve card names against the owner's collection; a name not owned is reported SKIP and replaced, not ignored.
- [ ] **Step 4: Run `node dev/tools/jxa-harness/shared_terms.js checks`.** Expected: every pair PASS, exit 0. If any fail, fix the reading in this file (or the test pair if it is mislabeled and say so in the commit), not by loosening a threshold.
- [ ] **Step 5: Run `floor`, then `audit --out dev/tools/jxa-harness/baselines/2026-10-29-terms-before.json`.** This is the frozen baseline; it is produced before any builder change and is never re-taken (if this tool's reading changes later, re-run both before and after with the new version and log it in the commit).
- [ ] **Step 6: Commit** `shared_terms.js`, `fetch_precons.js`, `precon_floor.json`, the baseline JSON.

### Task 2: Tribal conditional payoff forms

**Files:**
- Modify: `js/analysis/archetypes.js` (`tribePayoffPattern`, ~line 368)
- Test: `dev/tests/jxa/archetypes.test.js`

**Interfaces:** Consumes `tribeFormsPattern(subtype)`. Produces: `subtypeStanding(card, tribalSubtype)` returns `"payoff"` for the forms below. `tribePayoffPattern(forms: string) -> RegExp` keeps its signature.

- [ ] **Step 1: Write the failing test** `"subtypeStanding: conditional wording is a payoff"` with `BU_WIZARD = { kind: "tribal", tag: "wizards", label: "Wizards", tribe: "wizard" }` and assertions `"payoff"` for: `"this spell costs {2} less to cast if you control a wizard."`; `"as long as you control a wizard, creatures you control get +1/+0."`; `"for each wizard you control, draw a card."`; `"wizard spells you cast cost {1} less."`; `"when this enters, put a +1/+1 counter on it for each wizard you control."`. Assert `"none"` for `"destroy target non-wizard creature."` and `"mention"` for `"exile target wizard."` (unchanged behavior).
- [ ] **Step 2: Run** `dev/tests/jxa/run.sh <full harness list> dev/tests/jxa/archetypes.test.js` (the list from `build_harness.sh`; or `bash dev/tests/jxa/run_all.sh archetypes`). Expected: the new test FAILS.
- [ ] **Step 3: Extend `tribePayoffPattern`** with the five forms: `(?:if|as long as|unless) you control (?:an? |another |at least \w+ )?FORMS`, `less to cast if you control (?:an? )?FORMS`, `for each FORMS you control`, `number of FORMS you control`, `FORMS spells? you cast`. Keep the existing alternatives.
- [ ] **Step 4: Run the archetypes suite.** Expected: all pass. Then `node dev/tools/jxa-harness/shared_terms.js audit --out /tmp/after2.json` is NOT required here; Task 6 runs the gate. Commit `Recognize conditional wording as a tribal payoff`.

### Task 3: `js/analysis/terms.js`

**Files:**
- Create: `js/analysis/terms.js`
- Modify: `index.html`, `pauper.html`, `dev/tools/jxa-harness/build_harness.sh` (add `js/analysis/terms.js` immediately before `js/analysis/archetypes.js`)
- Test: `dev/tests/jxa/terms.test.js` (new; run with the full harness list)

**Interfaces:**
- Constant `TERM_CLAUSE_MIN = 1.5`.
- `buildTermVocab(cards: Card[]) -> { subs: Set<string>, keywords: Set<string>, keywordMakes: Map<string, Set<string>> }` (lowercase; subtypes from type lines, keywords from `card.raw.keywords` when present else from keyword-only text lines; `keywordMakes` from each keyword's reminder text, counter kinds only).
- `getCardTerms(card: Card, vocab: Vocab) -> { makes: Set<string>, clauses: Array<Set<string>> }`, cached per card in a `WeakMap`. Terms are lowercase: types, subtypes, keywords, `"<kind> counter"` and `"counter"`, and `"ev:sacrifice" | "ev:token" | "ev:draw" | "ev:lifegain" | "ev:landfall" | "ev:counter" | "ev:graveyard" | "ev:discard" | "ev:cycle" | "ev:enter" | "ev:attack" | "ev:cast" | "ev:enter-trigger"`.
- `createTermSupply(cards: Card[], vocab: Vocab) -> { size: number, clauseWeight(clause: Set<string>) -> number, isCounted(clause: Set<string>) -> boolean, suppliers(clause: Set<string>) -> number }`. `size` is the nonland card count. `clauseWeight = ln(size / (1 + suppliers(clause)))`; `isCounted` is `clauseWeight >= TERM_CLAUSE_MIN` and `size >= 200`.
- `cardMakesAny(card: Card, clause: Set<string>, vocab: Vocab) -> boolean`.

- [ ] **Step 1: Write the failing tests** (suite `terms`; fixtures via `buCard`), each with the assertions named:
  - `"needs come from conditions: a trigger subject, 'if you control', 'for each', 'costs less if you control', 'X spells you cast'"` (a clause for `wizard` from `"this spell costs {2} less to cast if you control a wizard."`; `instant`+`sorcery` as ONE clause from `"whenever you cast an instant or sorcery spell, ..."`).
  - `"needs never come from an effect target"`: `"destroy target artifact or enchantment."` has `clauses.length === 0`; `"return target creature card from your graveyard to the battlefield."` has a clause containing `creature`; `"search your library for a vehicle card."` has a clause containing `vehicle`.
  - `"opponent scope, self triggers and non-X give no need"`: `"whenever an opponent casts a spell, draw a card."` and `"when this creature enters, draw a card."` have no clauses; `"whenever this artifact or another artifact you control enters, ..."` has an `artifact` clause; `"destroy target non-wizard creature."` has no `wizard` need.
  - `"keywords make their reminder terms"`: a card `infect (this creature deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters.)` makes `infect`, `poison counter`, `-1/-1 counter` and `counter`; a card with `"proliferate (choose any number of permanents and/or players, then give each another counter of each kind already there.)"` has a clause containing `counter`.
  - `"a union is one clause"`: `"whenever you cast a noncreature spell, ..."` has exactly one clause and it contains `artifact`, `enchantment`, `instant`, `sorcery`.
  - `"clauseWeight: common clauses are not counted, rare ones are"` over a 300-card synthetic pool where 150 make `artifact` and 3 make `wizard` (`isCounted({wizard})` true, `isCounted({artifact})` false); and `"a pool under 200 cards counts no clause"`.
  - `"vanilla and double-faced cards do not crash"`: a card with `text: ""`, and a card named `"Front // Back"` with faces text in `raw.card_faces`, return a result with empty or valid sets.
- [ ] **Step 2: Run** `bash dev/tests/jxa/run_all.sh terms`. Expected: FAIL (functions undefined).
- [ ] **Step 3: Implement `terms.js`** from `spike.js`'s `termsIn` / `read`: use `getCardAbilities` (so triggers, conditions and effect labels come from the app's own labels); needs from conditions only; each clause is one `Set` with alternatives; makes per the Interfaces list. The reading for `ev:dies` supply comes only from sacrifice-outlet costs and edict effects (spec call 4), not from destroy/damage effects. Effect-object needs per the spec: keyword-action reminder text (proliferate), exile-and-return of a creature you control (needs `ev:enter-trigger`, which creatures with a non-self enters ability make), "equipped/enchanted creature gets" adds no clause.
- [ ] **Step 4: Add the script tag to `index.html` and `pauper.html` and the path to `build_harness.sh`**, all immediately before `js/analysis/archetypes.js`. Run `bash dev/tests/jxa/run_all.sh` for `terms` and `smoke`. Expected: both pass.
- [ ] **Step 5: Re-run `node dev/tools/jxa-harness/shared_terms.js checks`** (unchanged; sanity that nothing in the audit depends on the new file). Commit `Add the shared-term reading (terms.js)`.

### Task 4: Theme-plan roles in `archetypes.js`

**Files:**
- Modify: `js/analysis/archetypes.js` (`subtypeStanding`, `isTribeEngine` neighborhood, new `derivePlanTerms`, `THEME_PLAN_TERM_OVERRIDES`)
- Test: `dev/tests/jxa/archetypes.test.js`

**Interfaces:**
- Consumes `buildTermVocab`, `getCardTerms`, `createTermSupply`, `cardMakesAny` (Task 3).
- Produces `derivePlanTerms(cards: Card[], subtype: Subtype, vocab: Vocab, supply: Supply) -> Set<string>`: members are cards whose `bottomUpTags` include one of the subtype's `~`-joined tags; a term is a plan term when at least 40% of members make it and `supply.isCounted(new Set([term]))`; plus `THEME_PLAN_TERM_OVERRIDES[subtype.tag]` (initially `{ "infect~deathtouch": ["poison counter", "counter"] }`).
- `subtypeStanding(card, subtype)` for a theme subtype that carries `subtype.planTerms` (a `Set`), `subtype.termVocab` and `subtype.termSupply`: returns `"member"` if the card has a tag or makes a plan term; `"payoff"` if it is not a member and has a counted need clause intersecting `planTerms` that at least 2 pool cards satisfy (`supply.suppliers(clause) >= 2`); `"mention"` if it has a clause intersecting `planTerms` that is not counted; else `"none"`. When `planTerms` is absent or empty the function behaves exactly as today.
- `isThemeEngine(card, subtype) -> boolean`: a card that is standing `member` or `payoff`, has a counted need clause intersecting `planTerms`, and makes a term in that clause (an amplifier, e.g. proliferate). `annotateBottomUpCard` sets `engine` for themes with it, alongside the tribal flag.

- [ ] **Step 1: Write the failing tests** (names and assertions):
  - `"derivePlanTerms: terms most members make, not common ones"`: a synthetic pool of 300 cards, 20 tagged `tokens` of which 14 make `treasure`, 3 make `artifact` of 150 artifacts overall; result contains `treasure`, not `artifact`.
  - `"theme standing: a payoff that needs a plan term is a payoff, a removal that targets it is not"`: plan `artifacts`; `"whenever an artifact you control enters, draw a card."` is `"payoff"`; `"destroy target artifact."` is `"none"`.
  - `"theme standing: an amplifier is a member with the engine flag"`: plan `infect~deathtouch` over a pool with infect creatures; a `proliferate` card gets standing `"member"` and `annotateBottomUpCard(...).engine === true`.
  - `"theme standing: no plan terms means today's behavior"`: subtype without `planTerms` returns `"member"` for a tagged card and `"none"` otherwise, identical to the existing tests.
  - `"theme standing: a pool under 200 cards invents no payoffs"`.
- [ ] **Step 2: Run** `bash dev/tests/jxa/run_all.sh archetypes`. Expected: new tests FAIL.
- [ ] **Step 3: Implement** `derivePlanTerms`, the theme branch of `subtypeStanding`, and `isThemeEngine`. The annotation cache key in `annotateBottomUpCard` must include whether `planTerms` is present (`${kind}:${tag}:${planTerms ? "t" : ""}`).
- [ ] **Step 4: Run the archetypes and terms suites.** Expected: all pass, and the existing tests are unchanged. Commit `Give theme plans payoff and amplifier standing from the shared-term reading`.

### Task 5: Payoff reservation in `buildDeckBottomUp`

**Files:**
- Modify: `js/build/bottom-up-deck.js`; `js/ui/bottom-up-tab.js`
- Test: `dev/tests/jxa/bottom-up-deck.test.js`

**Interfaces:**
- Consumes `derivePlanTerms`, `buildTermVocab`, `createTermSupply` (Tasks 3, 4).
- Constant `PLAN_PAYOFF_MIN = 5`; `options.payoffMin` (number, optional) overrides it for a build, so a test can disable the step with `0`.
- At the start of `buildDeckBottomUp`, for a theme subtype build `vocab`, `supply` and `planTerms` once from `cards` and pass an enriched copy of the subtype (`{ ...subtype, planTerms, termVocab, termSupply }`) to every `annotateBottomUpCard` / `archetypeScore` call in the build. Tribal subtypes are passed through unchanged.
- A new step runs after the role loop and before the creature fill (immediately before the comment `// Creatures up to the archetype's count`): reserve up to `min(available, PLAN_PAYOFF_MIN) - alreadyInDeck` rows that count as payoffs (`standing === "payoff"`, or `standing === "member"` with `engine`) and satisfy `canTake(row) && roleOpen(row)`, best score first, never past `nonlandSlots`. It displaces only creature-fill and filler slots because the role loop has already run.
- `report` gains `payoffReservation: { minimum, available, reserved }` and `payoffs` now counts standing `payoff` plus `member` with `engine`.
- `bottom-up-tab.js`: where the result notes are rendered, add the line `Only N payoff cards in your collection for this plan (a deck usually has about 5).` when `available < minimum`.

- [ ] **Step 1: Write the failing tests** (suite `bottom-up-deck`): (a) `"reservation: a theme plan with 8 owned payoffs gets at least 5"` — a synthetic pool, assert `report.payoffs >= 5` and `report.roleCounts` equals what it was without the step; (b) `"reservation: fewer owned payoffs than the minimum reports it and pads nothing"` — 2 owned payoffs, assert `report.payoffReservation` equals `{ minimum: 5, available: 2, reserved: <taken> }` and the deck still has no fewer than `nonlandSlots` cards from the normal fill; (c) `"reservation: a tribal build is unchanged when its payoffs already meet the minimum"` — assert the deck name list equals the one built with the step disabled (`buildDeckBottomUp(cards, { ..., payoffMin: 0 })`); (d) `"reservation: a pool under 200 cards changes nothing"`.
- [ ] **Step 2: Run** `bash dev/tests/jxa/run_all.sh bottom-up-deck`. Expected: new tests FAIL.
- [ ] **Step 3: Implement** the enrichment, the step and the report fields; add the note line in the tab.
- [ ] **Step 4: Run the bottom-up-deck, archetypes, bottom-up suites.** Expected: all pass. Run `python3 dev/tools/jxa-harness/bottom_up_smoke.py` if Chrome is available. Commit `Reserve a minimum of payoff cards for bottom-up plans`.

### Task 6: Acceptance gates on all 22 plans

**Files:**
- Modify: `dev/tools/jxa-harness/shared_terms.js` (the `compare` mode)
- Create: `dev/tools/jxa-harness/baselines/2026-10-29-terms-after.json`

**Interfaces:** `compare <baseline.json>` prints, per plan, PASS or FAIL for: linked share not lower by more than 3 points; payoff cards not lower; placeholders not higher; and for the weak class (artifacts, blink, voltron, infect~deathtouch, tokens, vehicles) payoff cards at least `min(owned legal payoffs, 5)` and at least 1 engine. A plan the reading cannot express is printed `UNMEASURED` and listed by name; it must still pass the no-regression rules. Exit code 1 on any FAIL.

- [ ] **Step 1: Implement `compare`** per the Interfaces text.
- [ ] **Step 2: Run** `node dev/tools/jxa-harness/shared_terms.js checks` (must still pass) then `audit --out dev/tools/jxa-harness/baselines/2026-10-29-terms-after.json` then `compare dev/tools/jxa-harness/baselines/2026-10-29-terms-before.json`.
- [ ] **Step 3: If a plan FAILs**, find the cause in the builder, not the measure: read that plan's deck against its owned payoffs, fix the root cause in Tasks 4/5 code, and re-run. Do not loosen the thresholds or edit the baseline. If a tribal plan regresses because of the reservation, restrict the reservation to theme plans (an `if (subtype.kind !== "tribal")` guard) and record that in the commit message.
- [ ] **Step 4: Run every other gate.** `bash dev/tests/jxa/run_all.sh` (compare with `baselines/2026-10-29-suites-before.txt`: no suite that passed may fail); the 13-build diff (`build_harness.sh`, `dump_decks.js` through `osascript`, `engine_compare.py` against `baselines/2026-10-29-13-builds-events-on.json`; expected: no differences); `osascript` run of `bottom_up_audit.js` (no new range flags); `python3 dev/tools/jxa-harness/browser_smoke.py` for `index.html` and for `pauper.html`.
- [ ] **Step 5: Commit** the after-baseline and any gate-driven fixes with a message that lists the 22 verdicts' summary (counts of PASS / UNMEASURED).

### Task 7: Placeholder diagnosis

**Files:**
- Create: `dev/tools/jxa-harness/placeholder_diagnosis.js`

**Interfaces:** `node dev/tools/jxa-harness/placeholder_diagnosis.js` builds the 7 placeholder plans (warrior, rogue, elf, vehicles, enchantments, vampire, insect; midrange) and prints, per plan: legal members owned, members taken, role caps reached, mention cap use, slots left unfilled by each fill step, and the cause category (not enough legal members / role caps / mention cap / color / other).

- [ ] **Step 1: Write the script** (reuse the vm loading from `shared_terms.js`; count each fill step's contribution by instrumenting a copy of `buildDeckBottomUp` as the spike did, without modifying `js/`).
- [ ] **Step 2: Run it** and record the printed table plus a short written diagnosis in the "Results" section at the end of this plan file.
- [ ] **Step 3: Authorization check (spec):** build a fix only if one cause is shared by at least 3 of the 7 plans and the fix passes every Task 6 gate; otherwise stop at the written diagnosis and report it to the owner. Commit the script and the results.

### Task 8: Documentation

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Correct the claim** "Plan cards (members, payoffs) are reserved before the role fill" to describe the real fill order (role loop, creature fill, plan-card fills) and the new reservation step with `PLAN_PAYOFF_MIN`.
- [ ] **Step 2: Add** `terms.js` to the architecture list (and its load position), the theme standing and amplifier rule, the audit tools (`shared_terms.js` modes, `fetch_precons.js`, `precon_floor.json`, the frozen baselines, `placeholder_diagnosis.js`), the measure definitions, the precon floor numbers, the measure's known blind spots (instants and sorceries, generic hub cards, effect-only themes), and the 22-plan list; add `terms` to the suite list.
- [ ] **Step 3: Commit** `Document the term reading, theme-plan roles and the audit in AGENTS.md`.

## Results

(Filled in by Tasks 6 and 7.)
