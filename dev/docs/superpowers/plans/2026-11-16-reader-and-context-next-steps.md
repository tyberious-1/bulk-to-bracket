# Handoff: where the builder work stands (2026-11-16, end of day)

Read this first in a new chat. Companion spec: `dev/docs/superpowers/specs/2026-11-16-plan-context-cases.md` (rules, the Ashling,
Pia and Fynn cases, probe results, the EDHREC check). Memory entry: `good-is-relative-to-the-plan`.

## Decisions the user made today (do not re-litigate)

- A deck or card is good **relative to the commander's plan** (needs, produces, how it wins), never against a template of typical
  counts. Role counts, curve shape, average mana value, 5+ mana counts, goldfish mana used and the 13-build diff are NOT evidence of
  quality. They can show that something changed.
- **EDHREC is guilty until proven helpful.** It is a candidate source to read, not a score. Connections between the commander's
  text and the cards lead. On Ashling's page EDHREC covers 2% of the owned pool.
- Fix by category, not per commander. Do not tune on **Teysa, Envoy of Ghosts** or **Tori D'Avenant, Fury Rider**: they are the hold-out
  and are checked last, after the bugs from the cases are worked out, because the user wants to build and play them.
- The tool should save the user effort: ask little of them, and no long label-these-cards tasks.
- Wanted later, maybe: a one-sentence "how it wins" per build (win kinds: finish them, everyone loses and I am last, outlast,
  kingmaker, commander damage). Not designed.

## State of the repo

- main: Step A merged (`d4df638`): the keyword center pattern reads singular wordings ("a creature you control with deathtouch")
  and `getPlanFodderCostBonus` gives cheap carriers a small bonus. Correctness fix plus an unproven heuristic. Also the `btb-mtg-rules`
  skill, the spec above, and `dev/tests/jxa/context-cases.probe.js`.
- Branch `exp/soft-roles` (worktree `.claude/worktrees/soft-roles`, commit `6c2aab1`): support roles as a floor (`ROLE_FLOORS` 3/3/3/1)
  instead of EDHREC quotas, with a category test. UNMERGED. Its verdict was drawn from template numbers (mana value went 2.66 to 2.84,
  5+ mana cards 4 to 7 on Fynn), so treat it as unsupported either way. Revisit only after the reader work gives a way to judge it.
- Branch `exp/ashling-reader` (worktree `.claude/worktrees/ashling-reader`): created from main, no commits, clean. The next job.
- Nothing is pushed or can be. All suites pass on main (28 JXA suites via `bash dev/tests/jxa/run_all.sh`).

## Probe findings that set the work (run it: see the header of `context-cases.probe.js`)

Four category gaps; none of Ashling's plan cards link today and generic role-tagged cards (+3/+4 in `scoreFallbackCard`) outscore them:
1. Commanders built on a mana-only repeatable ability (Ashling) or symmetric damage are not read as such. Her center reads only `self-power`, `term`.
2. A commander that tutors "an X" (Pia) reads only as `enters`. Which X is right depends on the deck.
3. The deck's own composition is not an input (Lost in the Woods scores 6 under Pia and under an unrelated commander).
4. Cards that grant the keyword a commander names (Vial of Poison-like granters for Fynn) do not link.

## Next job: gap 1, Ashling's reading (in `exp/ashling-reader`)

Reader structure (`js/analysis/engines.js`): `getCommanderCenter(texts)` (line ~159) builds records `{kind, ...}` per ability using
`tagTextAbilities`; `getCenterLinks(card, needs)` (line ~747) adds named links per record kind; weights are in `CENTER_LINK_WEIGHTS`
(line ~732); `getEngineBonus` adds the center bonus and `getPlanFodderCostBonus`.

Facts checked today:
- `tagTextAbilities` gives an activated ability a `cost` array. `{1}{R}: ...` is `["mana"]`; `{2}{R}, {T}: ...` is `["mana","tap"]`;
  `{3}, Sacrifice a creature: ...` is `["mana","sacrifice-other"]`; `{T}: Add {G}.` is `["tap"]`. So "mana only" is `cost` equal to `["mana"]`.
- Ashling's effects come back as `["pump","counters"]`; her damage-to-each-creature line is not an effect label.
- An existing `mana-scale` record has links `mana-sink` and `mana-doubler` (lines ~229 and ~880-884), but its regex `add (?:an additional|twice)`
  misses "adds an additional" (Gauntlet of Might's wording).
- `protects` is only added under the `evasive` record (line ~963). A mana-sink or engine creature does not get it.

Proposed design (a proposal, not built):
- New record kind `sink`: an activated ability whose cost is only mana, with no "activate only once" wording. Links for cards that serve a
  mana sink: ability discounts ("activated abilities ... cost {N} less to activate", weight about 10); mana doublers and untappers (fix the
  "adds" wording); extra land drops and "put a land card from your hand onto the battlefield"; mana sources that make 2 or more per tap
  (a small weight, 2-4); and `protects` (hexproof, shroud, indestructible) because the commander is the engine.
- New record kind `sweep`: a commander ability dealing damage to each creature. Links: payoffs for being dealt damage or for creatures dying
  (Red Hulk's enrage, weight about 6-10), survivors and protection. A separate board wipe should NOT link (she is the wipe).
- Tests first: add a case to `engines.test.js` using negatives too: `{T}: Add {G}.`, `{2}{R}, {T}: ...` and `{3}, Sacrifice ...: ...` must not read as
  sinks; an ordinary pump ability like `{R}: This creature gets +1/+0 until end of turn.` is a sink. Then rerun the probe; the Ashling cards
  should score above the best control (13 in the first run) and the controls should not link.

## How to work here

- JXA suites: `bash dev/tests/jxa/run_all.sh [name]`; one suite: build the file list with `base=($(sed -n '/^scripts=(/,/^)/p' dev/tools/jxa-harness/build_harness.sh | grep 'js/'))`
  then `dev/tests/jxa/run.sh "${base[@]}" dev/tests/jxa/<file>`. zsh does not word-split a bare `$VAR`.
- Experiments go in a git worktree on a throwaway branch; keep by local merge to main, then remove the worktree and branch.
  Create it from local HEAD (`git worktree add -q .claude/worktrees/NAME -b exp/NAME HEAD`), because EnterWorktree's default base is origin/main.
- A worktree-isolated session refuses compound shell commands that touch git; keep each git command plain and separate.
- Harness builds use `dev/tools/jxa-harness/owned_raw.json` (the 2026-10-29 collection) and `prefetch_data.json`, which lacks theme pages.
  Run harness scripts from the worktree root; they read data files by relative path.
- Card text: read it (Scryfall by exact name, or `owned_raw.json`). I misremembered Heartstone and missed Red Hulk by working from memory.
- Commit with explicit paths. Never commit the friend's collection or the ManaBox and inventory files.

## Update 2026-11-17: expert lists, and what changed the plan

The user supplied a reference of expert-built (non-precon) decks (`manapool.com/lists/by/commanderathome`). Six lists were read and compared to the reader
with `dev/tools/jxa-harness/expert_recall.js`; the findings, with a retracted false alarm, are in
`dev/docs/superpowers/specs/2026-11-17-expert-list-blindspots.md`. Short version: five reader blind spots by category (trigger doublers read as nothing;
changelings and chosen-type cards not counted as tribe members; per-attacker commanders and the mana-sink reader; ownership and control-change plans;
the commander's own types and counters) and one false link (every artifact links when the commander counts artifact tokens).
Also found: Thorin Oakenshield's ward ends when he leaves the battlefield while the enduring story stays (rules 702.195a, 113.6, 611.3b, read from
`cr.txt`); tempo (how fast the plan's milestones arrive) is a measure we had not named; the web has no ground-truth card rating for Commander.
Order now: fix by category with tests first (changelings, then trigger doublers, then the mana-sink reader, then the artifact-token precision fix). Teysa and Tori are not in those lists and stay held out.
The `exp/ashling-reader` worktree is still empty; the mana-sink work (gap 1) is shared with Ingris and can be built there.

### Later on 2026-11-17: the direct test (Shelob, Sethron) changed the order

The user asked "what are you trying to fix?" The answer is the owned plan cards the builder leaves out. Building Shelob and Sethron from the collection
(`dev/docs/superpowers/specs/2026-11-17-owned-plan-cards-shelob-sethron.md`): with no EDHREC tags the builder used 1 of 41 Spiders and 0 of 42
Minotaurs; with the EDHREC page 19 and 20. Two code causes: fallback themes come from the first 80 pool cards, not the commander
(`themes.js` ~252), and center-linked cards are never added as candidates (`engines.js` ~1144). A scratch override of the second lifted Sethron
from 0 to 20 Minotaurs. This now comes BEFORE the blind-spot list (trigger doublers, changelings and the rest). Next: fix both in a worktree
with tests, rerun the two builds, read the picks. The user's second pick commander is Sethron, Hurloon General (done); Ashling stays the mana-sink case.

**DONE later the same day (main e19e3d7, spec updated 94a0d72):** fallback themes now come from the commander's own text (`deriveCommanderThemes`), unlisted creature
types get a tribal alias, and a build starts on the first plan the collection supports (`pickDefaultPlanFocus`). No EDHREC page: Shelob 1 -> 23 Spiders, Sethron 0 -> 16
Minotaurs; 13-build diff 0 swaps. The candidate-injection idea was tried and dropped (Fynn lost cheap carriers). Next is the filler problem (broad `etb-body` link, collection-order
ties, no role slots); see the spec's "Still wrong after the fix".

## Open questions for the user

- Whether to print a "how it wins" line per build.
- The soft-roles floor (wipe 1, others 3) and whether role slots should be a floor at all; decided only after the reader work.
- A few finished decks the user stands behind, for a reconstruction test (build from the same pool and compare card by card).
