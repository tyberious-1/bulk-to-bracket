# Theme-plan roles and shared-term synergy (design)

Status: draft for approval, 2026-10-29. Nothing in `js/` changes until this is approved.

## Intent

The player's goal is a deck whose cards connect: one card's output meets another's input (see "How to think about a deck" in AGENTS.md). The bottom-up builder (`js/build/bottom-up-deck.js`) knows two kinds of plan, a tribe and a theme. For a tribe it separates members, payoffs and mentions (`subtypeStanding`, `js/analysis/archetypes.js`). For a theme it knows only "member" (the card carries the theme's tag) or "none". So a theme plan is a pile of tagged cards, and its real payoffs, amplifiers and enablers compete with filler.

The owner's requirement, stated mid-session: the builder must work well on **all** decks it builds, not on the two or three we happened to study. Every acceptance check below is therefore run on the 12 sample plans and on 10 held-out plans nobody tuned against.

## What the evidence says (2026-10-29, the owner's 8,912-card collection)

All numbers come from a throwaway spike (scripts were in the session scratchpad, not committed): each card's words are read as the terms it **needs** (from conditions: "whenever you cast...", "if you control a...", "for each... you control", "return target X from your graveyard") and the terms it **makes** (types, subtypes, keywords, effects). A link is one card's make meeting another's need.

- The reading works on pairs: 12 of 12 known pairs behave correctly (for example Kaza and Wizard's Lightning link on Wizard; Contagion Clasp and Blightwidow link on counters; Naturalize and Dragonspark Reactor do not link). Two real bugs and one mislabeled test were fixed after the first run, so this is a sanity check, not proof.
- Reference ranges from 113 Commander precons (2022-2026, MTGJSON), same measure, p10/p50/p90: cards linked 11%/54%/78%; payoff cards 1/5/13; engines 0/1/2.
- Weak builds that held across both versions of the measure, all theme plans whose engine is an effect and not a noun:

| Plan | Linked | Payoffs | Engines | Notes |
|---|---|---|---|---|
| artifacts | 16% | 1 | 0 | owned unused payoffs include Bronze Guardian |
| blink | 19% | 2 | 0 | not in the sample set |
| voltron | 29% | 3 | 0 | not in the sample set |
| infect~deathtouch | 29% | 1 | 0 | 9 owned proliferate cards, 0 in the deck |
| tokens | 48% | 4 | 1 | not in the sample set |
| vehicles | 45% | 2 | 1 | 8 placeholders; Caught in the Brights, Kitsune Ace, Surgehacker Mech unused |

- Tribes score inside the range but leave placeholders: warrior 10, rogue 8, elf 8, vampire 6, insect 5 (cause not yet diagnosed).
- The tribal payoff pattern (`tribePayoffPattern`) misses conditional wording ("if you control a Wizard", "costs {1} less if you control a Wizard", "as long as you control", "for each X you control", "X spells you cast"). Measured across 16 tribes in this collection it affects about 15 cards (Wizard 3, Villain 3, Zombie 2, Dragon 2, Vampire 1, Merfolk 1, Pirate 1). Real, general, small.
- Wizard, which started this, is at 71% linked / 4 payoffs / 1 engine: inside the precon range. It is not a special case.

Known limits of the measure (they shape the design):
- Instants and sorceries are about 25% of the collection, so a "cast an instant or sorcery" payoff is discounted as common. Spellslinger reads 11% linked, which is a measure artifact. The spike did not fix this.
- A few generic cards (Magnetic Snuffler, Claim the Kingdom) appear in many "would add the most links" lists. Treat the list as a lead, not a verdict.
- "Dies" is noise as a supply: every removal spell makes it, and precon decks that need it do not hold more of it (lift 0.9).

## Goals

1. A theme plan gets the same roles a tribal plan has: sources (members), payoffs, and amplifiers (a card that both needs and makes the plan's term, such as proliferate). Payoffs are guaranteed a minimum by a **new** reservation step (see Design 2). Note: AGENTS.md says plan cards are "reserved before the role fill"; the code does not do that. Today (`bottom-up-deck.js`) the order is the role loop, then creatures up to the archetype count, then the plan-card fills, and a payoff only earns a score weight (`BOTTOM_UP_WEIGHT.payoff`). Nothing enforces a minimum, for tribes or themes. AGENTS.md is corrected in Phase 6.
2. The tribal payoff pattern recognizes the conditional wording above.
3. A repeatable audit measures linked share, payoff cards and engines against the precon ranges, for the 12 sample plans and 10 held-out plans, and runs before and after every builder change.
4. No plan gets worse: linked share, payoff count and placeholder count never regress on any of the 22 plans (limits in "Acceptance").

## Non-goals

- The commander-first builder (`deck.js`, `scoring.js`, `engines.js`). It has its own commander-anchored engine reading and a known gap (no dies / sacrifice / token / attack events), recorded as follow-up work only.
- A second axis for tribes (tribe plus theme). The Wizard case that motivated it is inside the precon range. Revisit if the held-out results show tribes that need it.
- An LLM in the app or a shipped card-label file. Extraction is deterministic and runs in the browser on any collection.
- Shipping precon data in the app. Precon decks are an offline reference only.
- Using the friend's collection. Per the owner, this work uses their own collection only.
- Changing `scoring.js` (that would force the 13-build diff and the bottom-up role corrections are meant to stay local, per AGENTS.md).

## Anti-goals (a pass that is still a failure)

- A change that lifts blink and lowers any other plan on linked share, payoffs or placeholders.
- Rules written so a named card shows up (Kaza, Proliferate). Every rule must read a wording pattern, and the check set must include pairs from colors and strategies other than the ones we discussed.
- Fitting the plan-to-term table to the 12 sample plans. The held-out set exists to catch this.
- Reporting an improvement the measure cannot see. Spellslinger-style blind spots are listed, not hidden.

## Constraints

- Static client-side app, no build step, plain global scripts, load order matters. A new `js/` file is added to BOTH `index.html` and `pauper.html` in the same position and to `dev/tools/jxa-harness/build_harness.sh`. New file: `js/analysis/terms.js`, loaded after `abilities.js` and before `archetypes.js`.
- Tests are JXA suites under `dev/tests/jxa/` run through `run.sh` / `run_all.sh`; do not switch the runner.
- Pauper format must keep working (`pauper.html` shares every `js/` file).
- The 13-build commander-first baseline must not change (nothing in this design touches that path; the diff proves it).
- The `connections.js` edits made in this session (new channels, poison/deathtouch, two supply fixes) are uncommitted. They are committed first, on their own, so the audit tool and this work stay separable.

## Design

### 1. Term reading (`js/analysis/terms.js`)

A pure module: cards in, terms out. Built on `getCardAbilities`, so anything kept later plugs into the app's own labels.

- `buildTermVocab(cards)`: subtypes, keywords, and keyword-to-terms from reminder text (infect's reminder names poison counters and -1/-1 counters). All derived from the collection; no mechanic names are written in code.
- `getCardTerms(card, vocab)` returns `{ makes: Set, clauses: Array<Set> }`.
  - **Makes:** card types and subtypes; keywords (and the counter kinds their reminder text names); effect labels mapped to event terms (`ev:sacrifice`, `ev:token`, `ev:draw`, `ev:lifegain`, `ev:landfall`, `ev:counter`, `ev:graveyard`, `ev:discard`); the kind named in a "create ... token" clause; counter kinds put or given.
  - **Needs (conditions only, one clause = one need):** the subject of a non-self trigger; "if you control a ...", "as long as you control ...", "for each ... you control", "number of ... you control", "costs {N} less if you control ...", "... you control get/have", "X spells you cast"; and, as the only effect-object exceptions, "return ... from your graveyard" and "search your library for ...". Never from the target of removal, never from opponent-scoped clauses, never from self triggers ("when this enters"), except "this or another" wording.
  - A union ("noncreature", "historic", "instant or sorcery") is one clause with alternatives, not several needs.
  - **Effect-object needs belong in the reading, not in the override table** (four of the six weak plans depend on them). Added with their own trap tests: a keyword action's need comes from its reminder text (proliferate: "give each another counter of each kind already there" needs counters); an effect that exiles and returns a creature you control needs creatures with enters triggers (blink; the maker side is a new `ev:enter-trigger` term on creatures with a non-self enters ability); "equipped/enchanted creature gets" needs a creature body, which is universal, so it carries no signal. Voltron may therefore stay unreadable. If the reading cannot express a plan, that plan is reported "unmeasured" (see Acceptance 3), never "passing".
- `clauseWeight(clause, supply)`: the natural log of (nonland cards in the collection / (1 + cards that make any term in the clause)). A clause counts as a link when that weight is at least 1.5, which means at most about 22% of the collection makes any term in it (call). The threshold is a share, so it does not move with collection size; it moves only with composition. Supply is the collection being built from, so a sparse collection weighs terms by its own supply. The precon ranges above were measured with the owner's collection as the supply.
- `ev:dies` is supplied only by sacrifice outlets and edicts, not by every destroy or damage effect (my call, from the lift result; to be validated on the check set before it stays).

### 2. Theme-plan roles (`archetypes.js`, `bottom-up-deck.js`)

- A theme plan gets **plan terms**: the terms its member cards make most (data-driven: terms whose weight clears the threshold and that at least 40% of the members make), with a small override table for the tags where the member tag is not the engine (my call; for example `infect~deathtouch` adds the poison and counter terms). The table is reviewed against the held-out plans, not fitted to the sample.
- `subtypeStanding` for a theme returns:
  - `member`: carries the tag, or makes a plan term (source);
  - `payoff`: has a counted need clause on a plan term, and at least 2 owned cards make that term (otherwise it is a mention);
  - an amplifier is a payoff whose own makes also include the term it needs (proliferate: needs counters, makes counter events). It counts toward the payoff minimum.
- **Standing keeps one value.** A card that is both a source and a payoff (an amplifier) follows the existing tribal convention: standing `member` with the `engine` flag set (`isTribeEngine` today; a theme equivalent is added). The report's payoff count, and the payoff minimum, count standing `payoff` plus `member` with `engine`. No change to the shape `annotateBottomUpCard` returns.
- **Payoff reservation (new mechanism, not in the code today).** A step runs after the role loop (ramp, draw, removal, wipe keep their slots) and before the creature fill. It takes up to `min(owned legal payoffs, PLAN_PAYOFF_MIN)` cards counted as payoffs above, best score first, and may displace only creature-fill and filler slots, never a role slot. `PLAN_PAYOFF_MIN = 5` (the precon median). If owned supply is below the minimum, the report says so ("only 2 payoffs in your collection") and does not pad with filler.
- **Scope of the reservation (decided by test, 2026-10-29):** it applies to tribal plans too, so both plan kinds work the same way (goal 1). A prototype (a patched copy of `buildDeckBottomUp` in the test harness, `js/` untouched) ran it on 9 tribal plans at midrange: the 4 sample tribes (Wizard, Vampire, Insect, Knight) and the 5 held-out tribes (warrior, soldier, rogue, elf, zombie). Result: 0 cards swapped in all 9, so linked share, payoff cards, placeholders, creature count and role counts are identical before and after. The minimum of 5 is already met for tribes (Wizard holds 6 of the 8 payoff-or-engine cards it owns, counting engine members), so the step is a no-op there. Applying it to both is safe; its effect comes from theme plans, which the prototype could not test because themes have no payoff standing until Design 1 and 2 exist. Acceptance 2 still gates the real change.

### 3. Tribal conditional payoff forms

Add to `tribePayoffPattern`: "if/as long as/unless you control (a|another|at least N) FORM", "costs {N} less to cast if you control (a) FORM", "for each FORM you control", "number of FORMs you control", "FORM spells you cast". Respect the existing "non-FORM" and "except" handling.

### 4. Placeholder diagnosis (before any fix)

Warrior (10), rogue (8), elf (8), vehicles (8), enchantments (6), vampire (6), insect (5) leave placeholder slots although the collection holds many members. First deliverable is a diagnosis for each: not enough legal members, role caps, the mention cap, color pairing, or something else. No behavior change is made on a guess. **Authorization (call):** the fix may be built in this plan, without another approval round, only if the diagnosis finds one cause shared by at least 3 of the 7 placeholder plans and the fix passes every gate in Acceptance. Otherwise the plan stops at the written diagnosis and returns to the owner, and vehicles' placeholders (8) are reported as outside this plan's pass.

### 5. Audit tooling (`dev/tools/jxa-harness/`)

- **Independence (call).** The builder reads cards with `js/analysis/terms.js`. The audit measures them with `shared_terms.js`, which is separate code in `dev/tools/` (promoted from the spike, reference copy in `dev/tools/jxa-harness/spike-shared-terms/`) and is the authoritative scoreboard. The builder must never import it. Otherwise the builder is graded by the code it selects with and linked share rises by construction. Two further signals the builder does not optimize are reported next to it: the older channel reader in `connections.js` (hand-written, independent code), and precon co-occurrence per plan term (do decks built around this term hold more of its makers).
- **Frozen baseline.** Phase 1 records the "before" numbers for all 22 plans as `dev/tools/jxa-harness/baselines/` JSON, produced by `shared_terms.js` before any builder change, and they are not re-taken when `terms.js` changes. If `shared_terms.js` itself must change, both before and after are re-run with the new version and the change is logged.
- Promote the spike to `shared_terms.js`: measures linked share, payoff cards and engines per build; prints the precon ranges; runs the check set first.
- Precon reference: `precon_floor.json` (the p10/p50/p90 above) plus a `fetch_precons.js` that regenerates it from MTGJSON, so the floor is reproducible and not a number in a note.
- `bottom_up_audit.js` prints these three measures per plan next to the existing type ranges, for the 12 sample plans and the held-out set.
- Measure definitions (fixed): a card is **linked** if one of its counted need clauses is met by another deck card, or it meets another card's; a **payoff** has a counted need clause met by at least 2 other deck cards; an **engine** is a term with at least 2 payoffs needing it and at least 3 makers in the deck.

## Held-out plans

Chosen by rule from the collection on 2026-10-29, not by hand: the 5 most-populated tribes with at least 30 members outside Wizard/Vampire/Insect/Knight, and each of tokens, counters, lifegain, blink, voltron with at least 40 tagged cards. Today that is: warrior (RG), soldier (WR), rogue (UB), elf (GB), zombie (BU), tokens (WR), counters (GW), lifegain (BW), blink (GB), voltron (UW). They are fixed in the audit so they cannot be swapped after seeing results. Plan colors come from the members' two most common colors.

## Acceptance

Everything is measured at midrange (archetype shifts mix on purpose), before versus after, on all 22 plans.

1. **Check set:** at least 20 known pairs, positives and negatives, across colors and strategies (the current 12 plus 8 more from colors not yet covered, at least 4 negatives). 100% pass before builder work starts; any later miss blocks.
2. **No regression** on any of the 22 plans: linked share not lower than before by more than 3 points; payoff count not lower; placeholders not higher.
3. **The weak class improves where supply allows:** artifacts, blink, voltron, infect, tokens, vehicles reach at least `min(owned legal payoffs, 5)` payoff cards and at least 1 engine. Where supply does not allow, the build report says why. Failing to improve because the collection has nothing to offer is acceptable; failing to improve because the builder skipped owned payoffs is not. **A plan the reading cannot express (possibly voltron) is recorded as "unmeasured": it must still pass check 2 (no regression) and is listed by name in the final report, but it does not count toward check 3 either way.** Unmeasured is never reported as a pass.
4. **Existing gates:** all suites in `dev/tests/jxa/` pass; `bottom_up_audit.js` shows no new range flags; the 13-build commander-first diff is unchanged (it should be, nothing in that path changes); `bottom_up_smoke.py` and `browser_smoke.py` pass, including `pauper.html`.
5. **New tests:** a `terms` suite (needs/makes for the wording patterns, including the traps: opponent scope, removal target, "non-X", "this or another"), a theme `subtypeStanding` suite, and the tribal conditional forms.
6. **Docs:** AGENTS.md updated (new file, new tools, new measures and the floor), including a correction of its claim that plan cards are "reserved before the role fill" (they are not today; this plan adds the first reservation).

## Risks

- The measure was built and corrected in one session; its blind spots (instants and sorceries, generic hub cards, effect-only themes such as blink) may hide or invent problems. The held-out set and the check set are the guard; a plan the measure cannot see is reported as unmeasured, not as passing.
- Plan-term derivation from members could pick a common term and make every card a payoff. The weight threshold and the 40% rule are the guard; the audit prints each plan's terms.
- A new `js/` file in the wrong load position breaks one page only (the pauper page is the usual casualty). Both pages are in the smoke run.
- Reserved payoffs could crowd out role cards (removal, ramp) in thin collections. The existing role overflow caps stay as they are, and the placeholder check catches it.

## Calls I made (to check while reading)

1. Plan terms are derived from members with a small override table, not a hand-written table for every tag.
2. `PLAN_PAYOFF_MIN = 5`, the precon median payoff-card count.
3. Clause weight threshold 1.5.
4. `ev:dies` supplied only by sacrifice outlets and edicts.
5. The commander-first builder and the second axis are out of scope for this pass.
6. Held-out plans are chosen by rule and fixed in the audit.
7. Amplifiers are not a separate reserved role; they count toward the payoff minimum (standing `member` plus the `engine` flag).
8. The payoff reservation is a new step after the role loop and before the creature fill, displacing only creature-fill and filler slots (found by a fresh reader: it does not exist today).
9. The reservation applies to tribal plans too. Tested on 9 tribal plans: a no-op (0 cards swapped), so it is safe. It stays gated by the no-regression check.
10. Effect-object needs (proliferate, blink) are in the reading itself; a plan the reading cannot express is "unmeasured", not a pass.
11. The audit measure (`shared_terms.js`) and the builder reading (`terms.js`) are separate code; the baseline is frozen before builder changes; precon co-occurrence and the `connections.js` reader are reported as independent signals.
12. Clause weight is the natural log, threshold 1.5 (at most about 22% of the collection makes the clause), supply is the collection being built from.
13. Phase 5 may build its fix only if one cause is shared by at least 3 placeholder plans and all gates pass; otherwise it stops at a diagnosis.

## Left to the builder

File and function names beyond the ones given; the exact override-table entries (reviewed on held-out results); how the audit prints; internal caching; the order of phases within the plan, provided the check set runs before any behavior change.

## Phases (for the plan)

0. Commit the `connections.js` edits on their own (the spike scripts sit untracked in `dev/tools/jxa-harness/spike-shared-terms/` as the reference until Phase 1 replaces them). 1. Promote the audit (`shared_terms.js`, precon floor, `bottom_up_audit.js` additions), extend the check set, and freeze the 22-plan baseline before any builder change. 2. Tribal conditional forms. 3. `terms.js` and its suite. 4. Theme-plan roles. 5. Placeholder diagnosis, then fixes only if justified. 6. Run all gates, update AGENTS.md.
