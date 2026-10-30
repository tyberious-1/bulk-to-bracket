# Curve-First Build Mode (Theorycraft)

Date: 2026-10-12
Status: Theorycraft / future consideration — not scheduled, no app changes yet

## Motivation

Curiosity-driven exploration of an alternate deckbuilding philosophy: build
toward playing on-curve each turn rather than toward a ramp-enabled top end,
and rebalance interaction/draw/wipe weighting around treating mana as a
strict per-turn budget. Best suited to mono/dual-color decks, where color
fixing is rarely needed and a predictable per-turn mana budget is easiest to
deliver.

**Framing, revised from the original draft:** this is a personal preference
set, not a general-purpose ruleset like Pauper Commander's legality rules.
Other users of the builder would likely prefer the generalized builder's
behavior — this isn't meant to be a second discoverable mode advertised via
a banner link. It's a toggle for the deck owner's own use: easy to flip on
for themselves, not surfaced to other users as "try this."

This document records the philosophy and a rough work estimate. It is not an
implementation spec — no approach has been chosen, no plan has been written.

## The four pillars

1. **Curve to schedule, not to ramp.** Build around having a relevant play
   each turn using that turn's natural mana, instead of building toward a
   top end that requires acceleration to reach on schedule. Ramp becomes
   optional upside (a rock/dork that's also incidentally useful), never a
   load-bearing assumption. Tradeoff: more consistent, lower power ceiling
   than a deck that successfully ramps into an oversized early threat.

2. **Draw offsets attrition.** A deck nets roughly -1 card/turn (1 draw vs.
   ~2 cards played: land + spell). Weight draw/card-advantage by *net* cards
   gained (draw total minus cards spent to get it), with a bonus for draw
   attached to another effect (a removal spell that cantrips, an ETB-draw
   creature), since those don't cost a turn's tempo to fix the deficit.

3. **Removal as fractional mana cost.** Mana is a per-turn budget; cheap
   interaction that leaves mana free to develop the board or hold up a
   second response is strictly better than interaction that eats the whole
   turn, all else equal. Score removal by effect-per-mana (Karsten-style
   efficiency), with a secondary axis for unconditional vs. conditional.

4. **Targeted removal over board wipes, by default.** A wipe is a reset
   reached for when behind, and in 1v1 framing it's symmetric — it only pays
   off with a strong follow-up, otherwise it just draws the game out. In true
   multiplayer Commander this is more nuanced: a wipe is closer to a 3-for-1
   when you're behind the *combined* board of the whole table, not just one
   opponent, which is the textbook correct wipe trigger. Refined rule: gate
   wipe inclusion on (a) being behind the table as a whole, not one player,
   and (b) having a concrete rebuild/follow-up already in the deck — not a
   flat "fewer wipes" count. One-sided wipes (the version that dodges the
   symmetry problem) are rare and hard to build around, so they're not a
   reliable fallback either way. Targeted removal on a key threat/combo
   piece slows the opponent asymmetrically without resetting your own board.

**Known blind spot:** this whole philosophy assumes threats are
creatures/permanents on a board. It says nothing about fast combo or stax
plans, where removal and wipes do little and counterspells/disruption matter
more. Not a reason to reject the philosophy as a default — just not a
universal answer to every deck type.

## Sketch of what it would change (not a spec)

- **Curve shape:** target distribution across CMC 1-6 with a floor at each
  bucket (not just 1s and 5s), hard cap on ramp slots (2-4, incidental-value
  only), slightly higher land count to compensate for not accelerating.
- **Draw scoring:** net-cards-gained weighting with a bonus multiplier for
  draw bundled with another effect; target density sized to roughly cover
  the -1/turn attrition over an expected game length.
- **Removal scoring:** effect-per-mana ranking, with cheap-conditional still
  ranking above expensive-unconditional in most cases.
- **Wipe inclusion:** gated on table-wide board deficit + an existing
  rebuild payoff, rather than a flat slot count; targeted removal absorbs
  the slot otherwise.

## Work estimate

Investigated the existing codebase (no module system — every file is a
global `<script>` include, functions call each other by bare global name).

**Toggle surface — small, and no banner needed.** Since this is a
for-the-owner preference rather than a discoverable format like Pauper
Commander, it doesn't need a second static HTML page or a banner link at
all. An easy personal toggle — e.g. a checkbox in the existing build
controls, or a URL param/local setting — reusing the same `modePrefs`
mechanism "Minimal Build" already uses is enough. This part is cheap
regardless of which approach below is taken for the scoring logic.

**Approach for the scoring/role layer — two options, different cost
shapes:**

1. **Shared, `modePrefs`-branched (the "Minimal Build" precedent).** Add a
   `curveFirst` flag and thread more branches through the existing
   `scoreCard`/`scoreFallbackCard`/`buildRoleTargetPlan`/
   `buildDeckFromScoredPool` (`js/analysis/scoring.js`,
   `js/build/type-plan.js`, `js/build/deck.js`). Cheapest to keep in sync
   with future fixes to the shared assembly mechanics (land base, eviction,
   type-minimum backfill), since there's only one copy — but every branch is
   a regression risk against the normal Commander and Pauper Commander
   modes, which share those exact functions. Validating "no regression in
   the other two modes" needs the offline JXA harness run before/after each
   change, not just the new mode's own output.

2. **Net-new functions, copying the hard-won bits (recommended).** Write a
   separate curve-first scoring/phase pipeline rather than branching the
   shared one. Copy over the parts that are genuinely hard-won rather than
   philosophy-specific — the oracle-text/keyword role-matching logic in
   `detectRole`/`cardMatchesRole` (what counts as "removal," "draw," "ramp"
   in card text) and CMC/curve bucket math — plus the phase-loop assembly
   mechanics (land-base construction, type-minimum backfill, eviction
   logic) that aren't worth reinventing. Upstream plumbing (CSV/collection
   loading, EDHREC fetch, theme detection, mana-base building) is called
   directly either way — no copy needed there, it's not role-scoring logic.
   **Trade:** zero regression risk to the two existing modes (nothing
   shared is touched), and a simpler mental model, at the cost of
   maintaining two similar assembly pipelines — a future bug fix to the
   shared mechanics (e.g. eviction logic) won't propagate automatically and
   would need manual porting. Favored here because this mode is
   explicitly a personal, exploratory preference rather than a path other
   users or future generalized-builder work depend on — isolating blast
   radius matters more than avoiding the duplication.

## Open questions for when this gets picked up

- Does the hard ramp cap apply even when the commander's strategy profile
  wants ramp (e.g. a landfall or big-mana theme) — i.e. does this mode
  override theme-driven role targets, or only adjust the generic default?
- Is mono/dual-color enforced (reject 3+ color commanders) or just a
  personal guideline the owner applies when picking a commander?
- Where does the toggle live — a checkbox in the existing build controls,
  a URL param, or a local setting read once per session?

## Harness verification (implemented 2026-10-12)

Ran `dev/tools/jxa-harness/compare_curve_first.js` against Ivy, Gleeful
Spellthief (default mode vs. `curveFirst`): removal rose 10→14, exactly
matching the +4 boost; wipe dropped 2→1, within the cap; draw rose 12→15
(+3, not the full +4 boost); average mana value held steady at 3. Ramp
dropped 10→5 rather than to the capped target of 4. Both the draw and ramp
misses are within the existing ±2 soft-flex band every role bucket already
carries (`buildRoleTargetPlan`'s `min`/`max`, scored as deficit/overflow
rather than a hard wall), the same mechanism every other mode's role
targets already tolerate — not a bug specific to Curve First, no code
change made for it. (An earlier run used Rosheen Meanderer as the sample
commander; re-run against Ivy, Gleeful Spellthief per the user's
preference — see the harness's `prefetch_data.json`, which now carries
both commanders' offline fixture data.)

## Known caveat: "ramp" role counts can overcount synergy payoffs

Spot-checked a real Kardur, Doomscourge curveFirst build (an
aristocrats/sacrifice deck) and found its "ramp" role count (8) landed well
above the cap for a different reason than the ±2 soft-flex band above: all
8 were death-trigger/sacrifice-value cards (Deadly Dispute, Seize the
Spoils, Gadrak the Crown-Scourge, Mahadi Emporium Master, Skullport
Merchant, Ticket Tortoise, Shambling Ghast) whose real job is draw or
removal, filed under `ramp` because `detectRole`'s shared pattern list
treats "create a treasure" as a ramp signal and checks `ramp` before `draw`
in `SUPPORT_ROLES`. The deck had zero dedicated ramp pieces (no rocks,
dorks, or land-ramp) — Pillar 1 held in spirit; the role-bucket number
just isn't a reliable proxy for "how much does this deck lean on
acceleration" in a treasure-heavy aristocrats shell. Pre-existing
shared-engine behavior (affects every mode), not something Curve First
caused or can see around — no code change made.
