---
name: btb-testing-harness
description: Use when running or writing JXA test suites (dev/tests/jxa), choosing a suite's source file list, using the offline harness in dev/tools/jxa-harness (dump_decks, plan_audit, baselines, audits), or diffing the 13 sample builds.
---

# Testing and the offline harness

> **Summary:** How to run suites (run.sh with dependency-ordered files, run_all.sh), the zsh word-splitting trap, which baselines are current, and what each harness tool measures.
> **STOP here unless** you are running or writing a suite, measuring a builder change, or need a harness tool's usage.
> Everything below is detail moved verbatim from the old AGENTS.md; skip it if the summary answers your question.

## Testing

Tests live in `dev/tests/jxa/*.test.js` and run via `dev/tests/jxa/run.sh`, which concatenates `helpers.js` + source files
+ test file and runs the result under `osascript -l JavaScript` on macOS. On Linux (no osascript) it falls back to
`node dev/tests/jxa/run-node.js` with the same files: the node path replaces helpers.js's JXA-only `jxaPrint` with a
`process.stdout` one, runs the files in `vm`, and exits 1 on `SUITE FAILED` or a thrown error. Keep the JXA path as the
macOS default; `run_all.sh` prints `CRASHED (exit N)` for a suite that exits nonzero without a SUITE line:
```bash
dev/tests/jxa/run.sh js/constants.js js/utils/text.js js/utils/cards.js js/format.js js/analysis/themes.js js/analysis/abilities.js js/analysis/scoring.js js/analysis/engines.js dev/tests/jxa/scoring.test.js
```
First args are the source file(s) the test needs, **in the same dependency
order `dev/tools/jxa-harness/build_harness.sh` loads them in** — a file must
come after everything it calls at parse time or top level, the same rule
that governs `<script>` tag order in `index.html`/`pauper.html`. Passing
only the one file that defines the function under test is usually not
enough; `Can't find variable: X` means a transitive dependency is missing
from the list, not that `X` doesn't exist. Last arg is the test file. Look
at an existing `*.test.js` file for the `runSuite({ "name": fn, ... })` /
`assertEqual` / `assertTrue` pattern before writing a new one.

Suites: `smoke`, `collection-summary`, `archetypes`, `terms`, `bottom-up-deck`, `bottom-up`, `commander-fit`, `abilities`, `engines`, `export` (the Scryfall deck-search link), `scoring`, `manabase`, `type-plan`, `bracket`, `deck-stats`,
`mode-prefs`, `deck`, `deck:pickCheapThemeSeeds`, `scryfall`, `format`, `csv`, `discovery`, `plans`, `reliability`,
`commanders-tab`, `theme-tab` (the last two cover the Pauper Commander
rarity/format-switch logic and its two tab-rendering call sites — both also
need `js/analysis/scoring.js` in the chain, since `theme-tab.js` calls
`detectCardTags`/`hasTribalType`, which live there). `cards.js` tests
(`canBePauperCommander`, `legalForCommander`'s rarity gate) live in
`format.test.js` alongside `format.js`'s own tests, not in a separate
`cards.test.js`. Any test suite whose source chain includes
`js/utils/cards.js` must also include `js/format.js` in the file list, since
`cards.js` calls `isPauperFormat()` at runtime.

`bash dev/tests/jxa/run_all.sh [name]` runs every suite (or those matching `name`) with the full harness list.

The shell on this machine is zsh, which does not word-split an unquoted
`$VAR`: keep the file list in a bash array or run the loop under `bash -c`,
or every suite fails with "Can't find variable" for every function.

When in doubt about a suite's full dependency chain, just pass the complete
`dev/tools/jxa-harness/build_harness.sh` script list ahead of the test file —
slower to run, never wrong.

`engines` needs `js/api/http.js` and `js/api/edhrec.js` in its chain too (its `scoreCard`
test calls `getEdhrecInclusionRate`); run it under `bash -c` so the file list word-splits.
`dev/tools/jxa-harness/baselines/` holds saved `dump_decks.js` outputs (the current
reference builds are `2026-11-11-13-builds-center-kinds-events-on.json` and `-events-off.json`, saved after the center-kinds
coverage work merged to main (`7f44318`); the `-events-off` file is what the Event Engines switch off must reproduce. Against the
2026-11-05 pair, 10 of 13 builds move with events on (Kaza, Ragost, Rielle, Omnath and Strefan most); with events off only Kaza moves
(+7/-7), and that comes from `09be01b` (themes named for a keyword match by catalog), not the center kinds. The 2026-11-05 pair is the
step before. The
`2026-11-03-13-builds-roles-tiebreak-*` pair before it differs from it in 1 build with the switch off (Callaphe: Starlit Mantle in,
Day of the Dragons out, from the wipe-tag fix) and in several builds with it on (Kaza, Eriette, Callaphe and others, the center reader). Both run the 13-build
sample set on the 2026-10-29 collection. Each dated 13-build pair before it is a step in the history:
`2026-11-03-...-phase1b-generic` (generic tier dropped from three buckets), `2026-10-30-...-land-draw`
(land rule in the commander-first mana base, draw role stopped counting Blood, dredge, learn, gift and
Jace-token reminder text) and `2026-10-30-...-events` and `2026-10-29-...` (earlier `abilities.js`
wordings). The `2026-10-15-*` files are the older 56-build set on the old collection) and
`engine_compare.py` diffs two of them; `dump_decks.js` builds partner pairs from
`"A + B"` keys in `prefetch.pairs`, and `engine_matches.js` prints a commander's
engine classes over the owned collection for pattern tuning. `ability_eval.js` prints
label coverage over the owned collection (`coverage`, `vocab`), how single cards read
(`case`), and the graveyard-veto list (`vetoes`). `event_producers.js` prints a commander's events and the owned cards that produce
each one (the lists the player reads before event scoring is written). `bottom_up_measure.js` (archetype separation and thin-collection coverage) and `bottom_up_compare.js` (bottom-up midrange vs a commander-first baseline) run like `dump_decks.js`. `browser_smoke.py` builds one deck through the real `index.html` or `pauper.html` in headless Firefox (Linux, on PATH; Google Chrome on macOS if Firefox is absent) with the network served from the harness fixtures, and prints any JavaScript errors and the rendered engine report line. `bottom_up_smoke.py` does the same for the Bottom-Up tab (both use `smoke_browser.py`: a 127.0.0.1 http server with an allowlist of app files and the two fixtures, a throwaway profile, and the page POSTs its result back): it clicks the suggestion scan, builds a Control deck, reads the Reliability panel and the result notes, and uses an owned commander (EDHREC budget pages are mocked from owned cards).

`expert_recall.js` (2026-11-17) reads a commander with the reader and reports which of an expert-built list's picks link and which do not (usage in its header; lists in git-ignored `expert_lists/decks.js`; findings in `dev/docs/superpowers/specs/2026-11-17-expert-list-blindspots.md`). Trap: any ad-hoc node `vm` loader must take its file list from `build_harness.sh` up to `engines.js`, never by hand. Leaving out `js/analysis/catalog-data.js` (it defines `CATALOG_CREATURE_TYPES`) makes tribe lines like "Other Bears you control get +2/+2" read as nothing, silently; `ability_eval.js` still has a hand-written list.

`precon_research/` (README there) holds the owned-commander and precon measurements behind the center reader: `owned_commanders.py`
builds owned commanders through the real builder with quota switches (it reuses `prefetch.json` when the commanders are already in it),
`center_report.js` prints a commander's text, labels and `needs.center`, `center_links.js` lists owned cards (inside given colors)
that link into the center with bonus and link names, `web_ledger.py` and `report.py` as before. The method that worked (2026-11-05): build
the commander, group the 60 nonland cards by link strength, read the cards, compare against the last build and the 13-build diff; link
counts come from the same reader, so they cannot prove a deck is better -- the user's playtests (Dina, Iron Man) are the real check.
`plan_audit.js` audits one commander-first build: per engine class (payload, crewHelper, lord...) the owned cards, which were picked and a heuristic reason for each one left out, the deck's composition, mechanic checks (vehicle count against creatures, crew coverage, payload lands) and owned cards whose text names the mechanic but fall in no class (usage in its header). Run it before reading a build by hand.
`connections.js` adds a connection report to `plan_audit.js` when loaded between the harness and it (`cat h.js connections.js plan_audit.js`): each card's words become outputs ("gives") and inputs ("wants") on named channels (power for crew and saddle, dies, sacrifice-event, counters, graveyard, landfall, type:vehicle...), then it lists which channels are starved, which plan cards connect to nothing (orphans), which owned cards left out would connect most, and cards whose wording is read as no specific channel. The channel vocabulary is a first pass; extend it when the unread list shows a pattern.
`shared_terms.js` is the independent shared-term audit (own reader, never calls `terms.js`): `checks` (20 known card pairs, must be 20 of 20), `floor` (the Commander-precon reference from `precon_full.json`, git-ignored, fetched by `fetch_precons.js`; written to `precon_floor.json`: linked share 11%/54%/78% and payoffs 1/5/13 at p10/p50/p90), `audit [--out f.json]` (builds the 22 plans -- the 12 sample strategies plus 10 held-out ones chosen by rule -- and measures linked share, payoffs, engines, placeholders), `compare <baseline.json>` (PASS/FAIL per plan against a frozen baseline, exit 1 on FAIL; `baselines/2026-10-29-terms-before.json` is the frozen before, `-after.json` the state at the end of the theme-plan-roles work), `plan <key>` (the plan's derived terms and every owned payoff) and `who-needs <term>` (owned cards whose counted clause names a term). Blind spots: the reading is of oracle text, so an instants-and-sorceries (spellslinger) or blink plan can read as thin when the collection has few cards that need those terms; the weak-class payoff floor only counts clauses on terms at least 40% of the deck makes, so it is vacuous for a plan with no dominant term. Run `bash dev/tests/jxa/run_all.sh` and read the output: it always exits 0, so count the "SUITE OK" lines.
`bottom_up_audit.js` does the same for the bottom-up builder: it builds the 12 sample strategies at all three archetypes and checks each against the reference ranges in `plan_targets.json` (EDHREC average decks, EDHREC budget decks and Commander precons 2022-2026, measured 2026-10-29; the file's `_notes` say what each range means and where none was found), plus placeholders left, vehicle count against creatures and crew coverage. Ranges are sanity checks: EDHREC averages can include junk, so a flag is a lead to read, not a failure.

`dev/tools/jxa-harness/` is a separate, heavier offline rig (prefetched EDHREC +
Scryfall + ManaBox fixture data) used for measuring full-build behavior
without hitting live APIs — see the `deck-builder-harness-data` memory/notes
if you need to regenerate its fixtures.


