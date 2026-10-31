# AGENTS.md

Context for AI coding agents working in this repo. See README.md for the
user-facing project description.

## Project overview

Bulk to Bracket is a static, client-side web app (no server, no build step).
It turns a ManaBox CSV collection export into a synergistic Commander deck
using EDHREC synergy/average data and Scryfall card data, then exports to
Moxfield format. There are two entry points, both opened directly in a
browser or served as static files — there is nothing to compile:

- `index.html` — the main app, default Commander format.
- `pauper.html` — Pauper Commander (PDH): commander must be an uncommon
  creature, every other nonland card must be common. Shares every `js/`
  file with `index.html`; the only difference is one inline
  `setActiveFormat("pauperCommander")` script tag (see `js/format.js` under
  Architecture below) and page-specific copy/placeholders.

## Product goal

The app is a quick, casual prototyping aid: it turns a collection into a
functional deck with synergy that the player refines with physical cards. It is
not an optimizer: decks should be playable, not perfect. Commander is a casual format where funny or interesting
plays can matter more than winning. Key points:

- The 99 matters more than the commander; people often pick a commander because
  it sounds fun, or after spotting a pattern in their pile.
- Sparse collections with few EDHREC matches are the main case; the
  collection-fallback path is the product.
- Support roles are loose job descriptions: bounce, counterspells and
  pacifism-style auras can count as removal when the colors lack hard removal.
- Next planned work ("plan-first prototyping"): 2-3 plan options per commander
  with example owned cards and honest coverage, build-anyway on thin plans while
  flagging a better-supported plan, commander discovery from collection
  support, and a few exempt "fun slots". Draft spec:
  `dev/docs/superpowers/specs/2026-10-13-plan-first-prototyping.md`. Built so far:
  the coverage measure (`dev/tools/jxa-harness/plan_coverage.py`) and plan options
  UI (`js/analysis/plans.js`, `js/ui/plans.js`); a plan is a multi-theme focus
  joined with `~` in the `theme:` mode string. Also built: broader removal
  tagging and fun slots (`options.funPicks` in `buildDeckFromScoredPool`, source
  `fun-pick`, max `FUN_PICK_MAX` = 5, never evicted). Commander discovery is built
  as a "What does my collection support?" section on the Theme/Typal tab
  (`js/analysis/discovery.js`), feeding the tab's existing owned-commander lookup.
  A plan is "light" when fewer than `PLAN_LIGHT_OWNED` (10) of its signature cards
  are owned. An offered plan's signature cards steer the build by name
  (`modePrefs.planSignature`, `PLAN_SIGNATURE_BONUS` in `scoring.js`).
- Testing rules: the friend's collection (`ManaBox_Collection-1.csv`,
  `owned_raw.friend.json`) is for local testing only and is never committed;
  don't use Rosheen as a sample commander; the user's collection deliberately
  omits flex staples (Sol Ring etc.), so don't report that as a gap.

## How to think about a deck (agreed 2026-10-29)

A deck runs like a random program, but it is still a program. Building one is two kinds of
problem:

- **Math problems:** the mana base and curve, the odds of drawing lands, ramp and removal, and
  whether a vehicle can be crewed. These have right answers and the tests can check them.
- **Word problems:** every card says what it makes and what it needs. A synergy is one card's
  output matching another card's input. Examples:
  - A card that makes Pilot tokens feeds a vehicle that wants crew.
  - A creature that dies feeds a payoff that triggers on death.
  - Saddle wants a power total, and a creature with high power supplies it.

Judge a build by whether its cards connect (outputs meeting inputs, no orphans, no strong
connecting card left out for a weak one), not by matching average card counts. Reference ranges
from EDHREC averages and precons (`dev/tools/jxa-harness/plan_targets.json`) are only a smell
test: averages can include junk, and a tribal deck should be creature-heavy. When a card's words are
not read (no engine class, no ability label), the fix is to teach the builder to read them.

## Repository layout

The repo root is the app plus its README: `index.html`, `pauper.html`, `style.css`, `js/`,
`README.md` (and `AGENTS.md`/`CLAUDE.md`, which agents read from the root). Everything that is
not the app lives under `dev/`: `dev/tools/` (the offline harness, fixtures, baselines, the
zip script), `dev/tests/` (the JXA suites), `dev/docs/` (specs and plans) and
`dev/card inventory.csv`. Scripts that need the repo root compute it from their own location
(three levels up from `dev/tools/jxa-harness/`); run suites and harness commands from the repo
root.

## Architecture

All JS is plain global-scope script files (no ES modules, no bundler).
`index.html` and `pauper.html` each load them via `<script>` tags in a
specific dependency order — a file must be loaded *after* every other file
whose functions it calls at parse time or top-level scope. **When you add a
new `js/` file, add its `<script>` tag to BOTH `index.html` and
`pauper.html` in the same position** (and to `dev/tools/jxa-harness/build_harness.sh`'s
script list), or its functions won't exist yet when later scripts run on
one of the two pages.

Layout:
- `js/constants.js`, `js/dom.js`, `js/state.js` — shared config/DOM refs/state
- `js/format.js` — the format switch: `setActiveFormat`/`isPauperFormat`/
  `canBeActiveCommander`. `activeFormat` defaults to `"commander"` and
  `index.html` never calls `setActiveFormat`, so it's a no-op there;
  `pauper.html` sets it once, inline, right after loading this file.
- `js/utils/` — generic helpers (text, cards, deck-stats). `cards.js` holds
  `canBePauperCommander`, the rarity-aware `legalForCommander`, and `deadForColors` (a card whose ability keys on "black creature spells you cast" in a deck with no black; both builders skip it).
- `js/analysis/collection-summary.js` — pure data behind the Collection Analytics tab: `aggregateSubtypes`
  (one merged row per subtype, colorless kept apart from multicolor), `buildTribeSummary` (top 10),
  `buildRoleCoverage` (ramp/draw/removal/wipe vs `normalizeRoleTargets`). `js/ui/collection-analytics.js` only renders them.
- Bottom-up build (a second entry point beside commander-first; nothing in the commander-first path reads these, but the bottom-up builder does read `getCrewPower` and `getPayloadTypes` from `engines.js`, so a change there needs both checks):
  `js/analysis/archetypes.js` (Aggro/Midrange/Control slot mix and curve target; `bottomUpLandCount` (aggro one fewer land, control one more, 35-38); `bottomUpRole` corrects
  `detectRole` locally -- edicts are removal, cost reducers and one-shot sacrifices are not ramp; `subtypeStanding`
  splits tribe members, payoffs and mere mentions; `sparesSubtype` reads "except/non-X"), `js/build/bottom-up-deck.js`
  (`buildDeckBottomUp`, pure; role caps, draw covers up to 4 missing removal/wipe slots, mention cap 6; slots left once creatures reach the typal cap take ramp/draw/removal up to `BOTTOM_UP_ROLE_OVERFLOW` (3) past each role cap before no-signal filler, never wipes; `cardKeywords`/`keywordScore` (flying, first/double strike, menace...) order a plan's own creatures, scaled by archetype, and skip creatures that are only here for a role; `removalFinesse` (instant, flexible target, extra cost, narrow target) orders same-kind removal; `isNarrowCounterSpell` reads Negate/Essence Scatter as counters (locally, `scoring.js` is untouched); a tribal deck's wipe must score over `wipeFloor`, so a sweeper that kills the tribe is left out; ties break on EDHREC budget inclusion, then Scryfall `raw.edhrec_rank` (`popularityRank`), then name; plus
  `buildBottomUpManaBase`), `js/analysis/bottom-up.js` (suggestions: tribes and themes ranked apart, rating
  Strong/OK/Thin), `js/analysis/commander-fit.js` (owned and not-owned commanders ranked by forced cuts),
  `js/analysis/reliability.js` (`deckReliability`: hypergeometric odds for lands, ramp, draw, removal, color sources and subtype density, rated good/OK/weak, shown on the result; pure; with wipes it adds a rebuild line from `rebuildKind` -- token makers, tribe boosts, mass recursion -- and notes which wipes hit your own tribe), `js/ui/bottom-up-tab.js` (the Bottom-Up Build tab; fetches EDHREC budget-page inclusion per subtype and passes it as `options.budgetInclusion`, which only breaks score ties). Spec `dev/docs/superpowers/specs/2026-10-26-bottom-up-build-design.md`;
  plan `dev/docs/superpowers/plans/2026-10-26-bottom-up-build.md`. Whether it becomes the default flow is undecided.
  A subtype is `{kind: "tribal"|"theme", tag, label, tribe?}`; a theme tag joins several themes with `~`
  (`infect~deathtouch`). After the role loop (ramp, draw, removal, wipe) and before the creature fill, the builder reserves `PLAN_PAYOFF_MIN` (5) payoff cards if the collection owns them (`options.payoffMin` overrides; `report.payoffReservation`); the role fills themselves are not reserved for plan cards. A plan's
  own creatures may fill past the role caps up to `BOTTOM_UP_PLAN_CREATURES_MAX` (36). **Vehicle plans:**
  vehicles are held to about `BOTTOM_UP_CREATURES_PER_VEHICLE` (1.25) creatures each and must be crewable
  by pairs (`BOTTOM_UP_CREWERS_MIN` creatures whose power covers half the crew number, read through
  `getCrewPower` so toughness-crew and "as though power were 2 greater" count); Pilot-token makers
  count as members and Roads lands (`bottomUpLandNeeds`, `includePlanLands`, up to `BOTTOM_UP_PLAN_LANDS_MAX`)
  join the mana base for vehicle and Mount plans. **Still open:** a plan is fodder + enablers + payoffs with
  a minimum each, and the builder offers 2-3 plans per tribe; today a tribe is mostly fodder, so Insect
  and Vampire builds still leave 5-6 placeholder slots (vehicles 8, enchantments 6, Wizard 3 as of
  2026-10-29; `bottom_up_audit.js` prints them). Test first whether Scryfall otags cover the engine roles
  (sacrifice outlet, death trigger, mill) before choosing them over text patterns. Equipment/auras that
  buff a tribe's creatures should count as plan parts. Targets: a BG Insect deck (Old Rutstein: mill,
  sacrifice, death payoffs) and a WU Knight deck (The Council of Four), then Goblins and Wizards.
- `js/analysis/terms.js` -- the shared-term reading the bottom-up builder uses for theme plans (loaded before `archetypes.js`;
  independent of the audit's own reader in `shared_terms.js`). `getCardTerms(card, vocab)` gives what a card makes (types, subtypes,
  keywords, counters, token and event terms) and what it needs (condition clauses only: trigger subjects, "if you control", "for each X
  you control", "X spells you cast"; never effect targets, opponent clauses or self triggers). `createTermSupply` says whether a need
  clause is rare enough to count (weight ln(nonland / (1 + suppliers)) >= `TERM_CLAUSE_MIN` 1.5, pool of at least `TERM_MIN_POOL` 200).
  `archetypes.js` `withPlanTerms(subtype, cards)` derives a theme plan's terms (terms >= 40% of its tagged members make, plus
  `THEME_PLAN_TERM_OVERRIDES` such as proliferate feeding poison); `subtypeStanding` then returns payoff for a card that needs a plan
  term and does not make it, member with the `engine` flag (amplifier) when it needs and makes it, mention when the need is not rare
  enough to count. A theme payoff scores `member + engine` so the many sources do not crowd it out. Tribal plans pass through unchanged
  (tribal payoffs also read conditional wording: "if you control a Wizard", "for each Wizard you control", "Wizard spells you cast").
- `js/api/` — `scryfall.js`, `edhrec.js`, `http.js` (fetch wrappers).
  `scryfall.js`'s `convertScryfallCard` captures each card's `rarity`
  (lowercased string), which is what the pauper legality checks key off of.
- `js/collection/csv.js` — ManaBox CSV parsing
- `js/analysis/` — theme detection, scoring/role detection, commander matching, pairing,
  `plans.js` (plan options with owned-card coverage; see the plan-first spec)
- `js/analysis/engines.js` — commander engine enablers: `parseCommanderNeeds` reads
  payload types (`needs.payloadTypes`: Vehicle, Mount, Zombie...; "Mounts and/or Vehicles" text gives both,
  Vehicle first) and devotion color from the commander's rules text,
  `getEngineClasses`/`getEngineBonus` classify and score owned cards (discard, self-mill,
  recursion, lords, crew helpers/tap payoffs, devotion pips), `addEngineCandidates` puts
  them in the theme tier, `getEngineLandBonus` lifts payload-named utility lands (Roads lands for Vehicle or Mount).
  **Vehicle payload:** `getCrewPower` reads a creature's crew value from its text (toughness crew, "as though
  its power were 2 greater"); `planPayloadVehicles` lifts the creature target to 24 and the artifact
  target to 15 and returns a ceiling of one vehicle per 1.25 creatures; `deck.js` picks vehicles freely and
  `dropSpareVehicles` removes the rest from the pools once the ceiling is reached (a pick-time cap: rejecting
  inside `addCard` would loop the pick loops).
  `modePrefs.engineNeeds` carries the needs; `scoreCard`/`scoreFallbackCard` add the bonus
  outside the theme-focus gate. Loaded right after `scoring.js`. A commander with no
  recognized need gets bonus 0 and builds unchanged. `getEngineClassDetails` returns
  `{ cls, weak, flaws }` per class: a flaw (sorcery speed above {2}, discarding two,
  tapping another permanent) costs 3 once per card, and cost per use sets `weak`
  (repeatable {3}+, one-shot mana value 4+); weak classes score but are never injected.
  **Events:** `needs.events` (from `getCommanderEvents`) lists what a commander's own
  abilities run on (landfall, draws, noncreature/second/bigger spells, mill with a
  direction, leaving the graveyard, counters of a kind, graveyard fill);
  `getEventProducers(card, needs)` says which owned cards cause each one, and a
  producer gets a flat bonus (6 strong, 3 weak, once per card) in `getEngineBonus` as
  an `event:<id>` class. Event classes are never injected into the theme tier or
  listed as graveyard enablers (some lists run to hundreds of cards).
  `describeEventProducers` feeds the report line. Specs:
  `dev/docs/superpowers/specs/2026-10-15-commander-engine-enablers.md` and
  `2026-10-15-ability-labels.md`.
- `js/analysis/abilities.js` — per-ability labels: `getCardAbilities(card)` splits a card's text into
  abilities (trigger, cost, effects with their object and zone, restrictions) and caches them;
  `engines.js` and the `voltron` tag read these labels instead of matching one clause. Loaded right
  before `scoring.js`. Each record also carries `quoted[]` (abilities handed out in
  quotes, e.g. a token's trigger). A card's own name becomes `~` as a whole word only.
  Plans: `dev/docs/superpowers/plans/2026-10-15-ability-labels-phase1.md`, `-phase2a.md`
  (events, producers), `-phase2b.md` (event scoring and the switch). Plan 2c (not
  written) holds what was deferred: the typal reshaping, the mill-direction recursion
  rule, a damage-amplifier class for Kuja, Denry/Perrie counter variety, and the
  Phase 2a deferred minors (spec "Phase 2a/2b result" sections).
- `js/build/` — the deck builder itself: `type-plan.js` (target buckets by
  card type), `deck.js` (fill/backfill logic), `manabase.js`, `bracket.js`
- `js/ui/` — tab rendering (`commanders-tab.js`, `theme-tab.js`,
  `collection-analytics.js`, `commander.js`, `report.js`, `status.js`),
  autocomplete, charts, export, hover previews
- `js/cache.js` — localStorage-backed API response caching
- `js/main.js` — wires the above together: CSV upload → commander resolution
  → EDHREC fetch → `buildDeckFromScoredPool` → rendering/export; owns
  `generateDeck()`/`runRegeneration()`, the entry points every rebuild path
  (theme-priority buttons, Minimal Build toggle) calls back into.

Every place in the pipeline that decides "is this card legal" or "can this
card be the commander" goes through `legalForCommander(cardColors,
commanderColors, card)` or `canBeActiveCommander(card)` — both are
format-aware and behave exactly as before under the default `"commander"`
format. Under pauper format, `main.js`'s EDHREC fetch is skipped entirely
(no PDH-equivalent synergy API exists); pauper builds run on Scryfall +
collection data only, through the same "Collection Fallback" path that
already exists for any commander EDHREC has no data for.

Build pipeline, at a glance (see README.md for the user-facing version):
EDHREC average type mix → target buckets per type → fill from owned
EDHREC-synergy matches → theme-score backfill from the rest of the owned
collection → ±2 variance when the collection can't hit the exact average.

Inside `buildDeckFromScoredPool` (`js/build/deck.js`) the order is: Phase -1
cheap theme seeds → Phase 0 support roles (ramp/draw/removal/wipe) → Phase 1
type *minimums* (Creature 15, everything else 1 -- they sum to only ~19 of ~60
slots) → **Phase 1b** type *targets* for every bucket → Phase 2
flexible fill (`chooseBestFlexibleCard`) → eviction/emergency phases. Phase 1b
exists because Phase 2 asks the theme tier first and stops at the first tier
that returns any card: a creature-rich theme tier never let the generic tier's
spells in (Kaza, Roil Chaser built 36 creatures against EDHREC's 24). Phase 1b
asks theme-then-generic *per bucket* instead, with two guards: a card must
clear `clearsTypeTargetFloor` (≥60% of the average score of deck cards from
the same source -- edhrec / fallback-theme / fallback-generic score on
different scales), and it must fit its support role's target
(`roomInRole`), since spells carry role tags and ignoring that pushed removal
from ~10 to 13-17. A bucket stops filling the first time its best candidate
fails the floor; Phase 2 takes the slot.

### Build modes

Three independent toggles in `main.js`/`state.js`/`dom.js` fold into a single
pipe-joined `mode` string (plus an optional `theme:<name>` segment) that
`getModePreferences` (`js/analysis/themes.js`) parses into a `modePrefs`
object read throughout `js/analysis/` and `js/build/`:

- **Minimal Build** (`modePrefs.minimalBuild`) — skips theme-based
  collection backfill entirely and stops the list at commander + mana base
  + support package, rather than padding out to a full, legal deck size.
- **Event Engines** (`modePrefs.eventEngines`, on by default, build-mode token
  `noEvents` when off) — scores event producers (see `engines.js` above). Off empties
  `needs.events` through `applyEventSwitch`, which restores the pre-event builds
  exactly (checked over the sample builds). It is a button in the Build Mode panel,
  shown after a build; clicking rebuilds; the flag survives new commanders in a session
  and resets on reload. The harness honors `MODE_OVERRIDE = "noEvents"`.
- **Curve First** (`modePrefs.curveFirst`) — caps ramp/wipe targets and
  boosts draw/removal targets (`js/utils/deck-stats.js`'s
  `applyCurveFirstRoleTargets`), and adds a scoring bonus for cheap
  (CMC ≤ 2) removal (`js/analysis/scoring.js`). See the
  `curve-first-build-mode-theorycraft` memory/spec doc for the design
  rationale and known caveats.
  Beyond the role targets, Curve First also changes: the land count
  (`estimateLandCount` skips its "low ramp → more lands" adjustment, since
  the mode caps ramp on purpose -- it used to land on 40+); the curve plan's
  band shares (`buildLandDropCurveShares` in `type-plan.js` derives them from
  the odds of making each turn's land drop, so the 6-7 bands shrink and 2-4
  grow, with a 3% floor on 6-7); and an effective-cost layer for commanders
  with a *typed* cost reducer (`getCommanderCostReduction`: Kaza's "next
  instant or sorcery costs {X} less" files those cards one band lower, floored
  at their colored pips; a variable {X} counts as 1, capped at 2). Candidates
  carry `curveCmc`; every curve-plan call reads it through `curveCmcOf(card)`,
  never `card.cmc` directly.

## ManaBox exports

A single-binder export has no `Binder Type` column; a full export has binder /
deck / list rows. `js/collection/csv.js` keeps the type on every row: wish-list
rows are never owned, deck rows are excluded unless the player ticks "Count the cards
in my decks" (the `binderOptions` control under the file input). The friend's
export (see memory) is the multi-binder case for testing.

## Setup / running it

No install step. To work on it:
```bash
open index.html                 # default Commander format
open pauper.html                # Pauper Commander (PDH) format
# or serve the directory with any static server
```
`node` is available on this machine (via nvm) for ad-hoc checks — prefer it
over anything else for quick validation:
```bash
node --check js/build/deck.js   # syntax check a single file
```
The test suites still run under JXA (see Testing below), not node.
There's no `package.json` and no npm scripts.

## Testing

Tests live in `dev/tests/jxa/*.test.js` and run under `osascript -l JavaScript`
(JXA) via `dev/tests/jxa/run.sh`, which concatenates `helpers.js` + source files
+ test file and runs the result — this is wired up regardless of Node being
available on this machine, so keep using it rather than switching the test
runner to `node`:
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
reference builds are `2026-10-29-13-builds-events-on.json`, event scoring on, and
`2026-10-29-13-builds-events-off.json`, which is what the Event Engines switch
off must reproduce; both run the 13-build sample set on the 2026-10-29 collection, and the
`2026-10-15-*` files are the older 56-build set on the old collection) and
`engine_compare.py` diffs two of them; `dump_decks.js` builds partner pairs from
`"A + B"` keys in `prefetch.pairs`, and `engine_matches.js` prints a commander's
engine classes over the owned collection for pattern tuning. `ability_eval.js` prints
label coverage over the owned collection (`coverage`, `vocab`), how single cards read
(`case`), and the graveyard-veto list (`vetoes`). `event_producers.js` prints a commander's events and the owned cards that produce
each one (the lists the player reads before event scoring is written). `bottom_up_measure.js` (archetype separation and thin-collection coverage) and `bottom_up_compare.js` (bottom-up midrange vs a commander-first baseline) run like `dump_decks.js`. `browser_smoke.py` builds one deck through the real `index.html` or `pauper.html` in headless Chrome with the network served from the harness fixtures, and prints any JavaScript errors and the rendered engine report line. `bottom_up_smoke.py` does the same for the Bottom-Up tab: it clicks the suggestion scan, builds a Control deck, reads the Reliability panel and the result notes, and uses an owned commander (EDHREC budget pages are mocked from owned cards).

`plan_audit.js` audits one commander-first build: per engine class (payload, crewHelper, lord...) the owned cards, which were picked and a heuristic reason for each one left out, the deck's composition, mechanic checks (vehicle count against creatures, crew coverage, payload lands) and owned cards whose text names the mechanic but fall in no class (usage in its header). Run it before reading a build by hand.
`connections.js` adds a connection report to `plan_audit.js` when loaded between the harness and it (`cat h.js connections.js plan_audit.js`): each card's words become outputs ("gives") and inputs ("wants") on named channels (power for crew and saddle, dies, sacrifice-event, counters, graveyard, landfall, type:vehicle...), then it lists which channels are starved, which plan cards connect to nothing (orphans), which owned cards left out would connect most, and cards whose wording is read as no specific channel. The channel vocabulary is a first pass; extend it when the unread list shows a pattern.
`shared_terms.js` is the independent shared-term audit (own reader, never calls `terms.js`): `checks` (20 known card pairs, must be 20 of 20), `floor` (the Commander-precon reference from `precon_full.json`, git-ignored, fetched by `fetch_precons.js`; written to `precon_floor.json`: linked share 11%/54%/78% and payoffs 1/5/13 at p10/p50/p90), `audit [--out f.json]` (builds the 22 plans -- the 12 sample strategies plus 10 held-out ones chosen by rule -- and measures linked share, payoffs, engines, placeholders), `compare <baseline.json>` (PASS/FAIL per plan against a frozen baseline, exit 1 on FAIL; `baselines/2026-10-29-terms-before.json` is the frozen before, `-after.json` the state at the end of the theme-plan-roles work), `plan <key>` (the plan's derived terms and every owned payoff) and `who-needs <term>` (owned cards whose counted clause names a term). Blind spots: the reading is of oracle text, so an instants-and-sorceries (spellslinger) or blink plan can read as thin when the collection has few cards that need those terms; the weak-class payoff floor only counts clauses on terms at least 40% of the deck makes, so it is vacuous for a plan with no dominant term. Run `bash dev/tests/jxa/run_all.sh` and read the output: it always exits 0, so count the "SUITE OK" lines.
`bottom_up_audit.js` does the same for the bottom-up builder: it builds the 12 sample strategies at all three archetypes and checks each against the reference ranges in `plan_targets.json` (EDHREC average decks, EDHREC budget decks and Commander precons 2022-2026, measured 2026-10-29; the file's `_notes` say what each range means and where none was found), plus placeholders left, vehicle count against creatures and crew coverage. Ranges are sanity checks: EDHREC averages can include junk, so a flag is a lead to read, not a failure.

`dev/tools/jxa-harness/` is a separate, heavier offline rig (prefetched EDHREC +
Scryfall + ManaBox fixture data) used for measuring full-build behavior
without hitting live APIs — see the `deck-builder-harness-data` memory/notes
if you need to regenerate its fixtures.

## Code style

- No semicolons-only convention enforced either way — match the surrounding
  file.
- No TypeScript, no JSX — plain ES (functions are global, loaded via
  `<script>` tags as described above).
- Don't introduce a module system, bundler, or npm dependency to solve a
  local problem — it breaks the load-order model every other file relies on.
- Keep new JS files inside the existing `js/<category>/` layout rather than
  adding new top-level folders.

## Common gotchas (learned the hard way — verify against current code, don't assume these are still exactly true)

- Scryfall's card-collection endpoint rejects "Front // Back" style double-faced
  names — look up the front face name instead.
- EDHREC's own "A // B" naming means a *partner commander pair*, not a
  double-faced card — same separator, opposite meaning, don't conflate them.
- Deck list entries carry no oracle text by themselves — if you need card
  text for scoring/role detection, you must join against the Scryfall data,
  not assume it's already on the deck entry.
- Theme cutoffs for "is this theme worth backfilling toward" are relative
  (floor + % of the top theme's count), not a flat number — a flat cutoff
  reintroduces the bug where niche themes either never qualify or always do.
- Generic backfill only kicks in once theme-tier backfill runs dry for a
  slot — don't make generic backfill compete with theme fit by default.
- Phase 0 (`deck.js`'s support-role fill) never looks at a theme-match card
  that carries no ramp/draw/removal/wipe tag, no matter its CMC — left alone
  it spends the entire cheap end of the curve on generic role cards before
  later phases ever reach the theme tier. `pickCheapThemeSeeds` reserves a
  few of the cheapest curve bands for theme cards before Phase 0 runs, so a
  commander's actual strategy doesn't start at CMC 4+.
- `detectRole`'s shared `ROLE_TEXT_PATTERNS.wipe` list matches on pattern
  text alone, so scope (a flier-only sweeper, a single-player-scoped combat
  trigger) and magnitude (1-2 damage, `-1/-1`) both need their own checks —
  text matching a "wipe" pattern isn't the same as the card actually
  clearing a board. See `wipeMatchIsNarrowed`/`hasLethalMassDamage`/
  `hasLethalMassStatDrop`/`massSacrificeHitsCreatures` in `scoring.js`.
- `SUPPORT_ROLES` checks `ramp` before `draw`, and "create a Treasure" reads
  as a ramp signal — a treasure-making aristocrats payoff (Deadly Dispute,
  Seize the Spoils, Gadrak the Crown-Scourge, ...) whose real job is card
  draw or sac-value still files under `ramp`. Confirmed in a real Kardur,
  Doomscourge build with zero dedicated ramp pieces reporting a ramp count
  of 8. Not Curve-First-specific, and no fix is scheduled — the role-bucket
  count just isn't a reliable "how much does this deck accelerate" proxy for
  a treasure-heavy shell.

- A card's own name (and the part before its comma) is replaced by `~` as a whole
  word in `abilities.js`. A test fixture whose name appears as a word in its own text
  (a card named "Mill" saying "mill three cards") silently loses that text; give
  fixtures names that do not occur in their text.
- The harness fixtures (`owned_raw.json`, `prefetch_data.json`) are only as new as the
  last `fetch_owned.py` run against `dev/card inventory.csv` (regenerated 2026-10-29), so a
  card bought since is missing from `event_producers.js` and the 13-build runs. The
  inventory deliberately leaves out every card of three or more colors (Perrie, the
  Pulverizer is one), so its absence is not a stale export. `prefetch_data.json` holds only the 13
  sample builds (12 commanders plus the Tormod + Ghost pair, cut from 54 on 2026-10-29);
  `prefetch.py` merges and never prunes, so shrinking the set is a manual edit of the file.
- Headless Chrome has a minimum window width, so `--window-size=390,...` screenshots
  are cropped desktop layouts, not a phone viewport. `browser_smoke.py` checks the page
  runs and renders, not phone layout.
- Never leave a stdin-reading command (a bare `cat`) in a shell call: it hangs.

- Bottom-up measuring: put the build in `buildDeckBottomUp` and read members, payoffs, placeholders (`fallbackCount`),
  role counts and creature count for a few tribes at all three archetypes (UR Wizards, WU Knights, BG Insects, BR Goblins
  is a good set, or `bottom_up_audit.js` for all 12 strategies); compare against a hand-built deck by card name. Do not run all 13 commander-first builds for a
  bottom-up change: nothing in that path reads `archetypes.js` or `bottom-up-deck.js`. A change to shared scoring
  (`scoring.js`) does need the 13-build diff, so correct role mistakes locally in `bottomUpRole` instead.
- `convertScryfallCard` keeps the whole Scryfall record as `card.raw`, so `raw.keywords` and `raw.edhrec_rank` (popularity,
  1 is most played, present on almost every owned card) are available without touching `scryfall.js`. Test fixtures have no
  `raw`: read them with a fallback.
- Bottom-up ranking pitfalls: cards with equal scores fell to the alphabet (A-names won), so check ties before judging a
  pick. Using the commander-first generic card score as a tie-break backfired (role-tagged non-tribe creatures outranked
  members); `edhrec_rank` is the safe tie-break because it never reorders different scores. A keyword bonus must apply only
  to the deck's own creatures, or a flying card-drawer outranks the spells competing for its role slot. A card listing
  (first 40 sorted by mana value) biases a hand-built deck toward one-drops: rank or filter before reading.
- Land rule (player preference): untapped lands first; a tapped land only for plan-relevant utility (surveil, recursion, a
  manland tied to the plan); skip "choose a color, enters tapped" and "{1},{t}: add any color" lands. Creature-type lands
  (Secluded Courtyard set to the tribe, Lupinflower Village) suit a tribe. Not yet applied in `buildBottomUpManaBase`.
- Fetching: YouTube pages and Commander Template deck folders cannot be read by a plain fetch (JavaScript-rendered or 403), and
  caption tools that cycle client identities to get around YouTube's block are refused as bot-check circumvention. Ask the
  player to paste the text instead.

## Sharing the app

The app itself is `index.html`, `pauper.html`, `style.css` and `js/` (about 0.6 MB), plus
`README.md`, which ships with it. Everything else lives under `dev/` (`dev/tools/` is about
87 MB of fixtures; `dev/tests/`, `dev/docs/`), and `.git` can be tens of MB of loose objects
(`git gc` shrinks it). For a copy to open on a phone, run `bash dev/tools/make-app-zip.sh`
(writes `../bulk-to-bracket-app.zip`, about 170 KB, only those files). The live site is served
from the repo root through GitHub Pages (`tyberious-1.github.io/bulk-to-bracket`), so
`index.html`, `pauper.html`, `style.css` and `js/` must stay at the root. Do not move the app.
`dev/tools/jxa-harness/owned_raw.friend.json` is a friend's collection (local testing only,
kept out of git through `.git/info/exclude`; that line must follow the file if it moves) and
`ManaBox_Collection(mine).csv` holds purchase prices: keep both out of anything shared.

## Commit / PR guidelines

- Conventional, short, imperative commit subjects (see `git log` for style:
  e.g. "Fix focused-theme builds over-drafting creatures for typal
  commanders"). No enforced prefix convention (no `feat:`/`fix:` tags in use).
- No CI configured in this repo — there's nothing to wait on before pushing;
  run the relevant `dev/tests/jxa/*.test.js` suites manually for anything you
  touched in `js/build/` or `js/analysis/`.
- Commit with explicit paths, not `git add -A`: the repo root can hold untracked personal
  files (`ManaBox_Collection(mine).csv`).
