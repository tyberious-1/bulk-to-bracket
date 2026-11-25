---
name: btb-build-pipeline
description: Use when changing js/build/deck.js, type-plan.js, the phase order (Phase -1 to 5), tie-breaks, role reading in scoring.js, or the Minimal Build / Event Engines / Curve First modes in the bulk-to-bracket repo.
---

# Commander-first deck builder: phases, ties and build modes

> **Summary:** The build order (cheap theme seeds, support roles, type minimums, type targets, flexible fill, eviction, center upgrades), why Phase 1b exists, how ties are broken by edhrec_rank, and what each build mode changes.
> **STOP here unless** you are editing the deck builder's fill order, scoring ties, role wording or a build mode.
> Everything below is detail moved verbatim from the old AGENTS.md; skip it if the summary answers your question.

Build pipeline, at a glance (see README.md for the user-facing version):
EDHREC average type mix → target buckets per type → fill from owned
EDHREC-synergy matches → theme-score backfill from the rest of the owned
collection → ±2 variance when the collection can't hit the exact average.

Inside `buildDeckFromScoredPool` (`js/build/deck.js`) the order is: Phase -1
cheap theme seeds → Phase 0 support roles (ramp/draw/removal/wipe) → Phase 1
type *minimums* (Creature 15, everything else 1 -- they sum to only ~19 of ~60
slots) → **Phase 1b** type *targets* for every bucket → Phase 2
flexible fill (`chooseBestFlexibleCard`) → eviction/emergency phases → **Phase 5
center upgrades** (2026-11-05: after Phase 4, up to `CENTER_UPGRADE_MAX` cards with a
strong link into the commander's center, `centerWeight` 14+, replace the lowest-scoring
card with a center bonus under `CENTER_LINK_KEEP`; never a fun pick, equipment or a card a
support role still needs; a victim with no link at all is replaced even if it outscores the
candidate, because scores from different sources are not on one scale: a Dinosaur theme card
beat a power-6 card with an 18-point link; a weakly linked victim must lose on score). Phase 1b
exists because Phase 2 asks the theme tier first and stops at the first tier
that returns any card: a creature-rich theme tier never let the generic tier's
spells in (Kaza, Roil Chaser built 36 creatures against EDHREC's 24). Phase 1b
asks theme-then-generic *per bucket* instead (since 2026-11-03 the generic tier is asked only for the
Instant and Sorcery buckets; creature, artifact and enchantment buckets take the theme tier only and
leave a dry bucket to Phase 2, because generic padding there was arbitrary: Omnath's Apes of Rath, Arms
Race, Altar of the Pantheon; measured on the 13 builds with theme pages and Scryfall tags replayed,
generic filler 71 -> 26, the rest instants and sorceries in spell-heavy builds; baselines
`2026-11-03-13-builds-phase1b-generic-events-on.json` and `-events-off.json`; the reference builds after the role-wording and tie-break work below are `2026-11-03-13-builds-roles-tiebreak-events-on.json` and `-events-off.json`), with two guards: a card must
clear `clearsTypeTargetFloor` (≥60% of the average score of deck cards from
the same source -- edhrec / fallback-theme / fallback-generic score on
different scales), and it must fit its support role's target
(`roomInRole`), since spells carry role tags and ignoring that pushed removal
from ~10 to 13-17. A bucket stops filling the first time its best candidate
fails the floor; Phase 2 takes the slot. Phase 2 is live code: measured 2026-11-03 on the 13 builds,
`chooseBestFlexibleCard` returned a card on 6 (Kardur 14 picks, Council of Four 12, Omnath 10, Tormod 3,
Fynn 2, Strefan 1) and on none of the other 7.

**Ties and role reading (2026-11-03).** `scoreFallbackCard` has no term for what a card does beyond its role
tag and mana value, so groups of fallback cards score alike, and every picker keeps the first of equal scores.
Measured over the 13 live-like builds: 0 of 552 EDHREC picks were decided by a tie, 18% of theme-fallback picks
and 22 of 25 generic picks were, with about 7 equal rivals each, so collection order (the alphabet in the
fixture) chose. Two fixes: `cardMatchesRole` now also reads wordings the literal `ROLE_TEXT_PATTERNS` lists
cannot hold (`drawsByWording`, `removesByWording` in `scoring.js`: "target player draws two cards", "draw X
cards", burn of 2+ to any target, "exile up to one target", tucking, bounce of a target that is not yours,
auras that stop a permanent untapping; each checked against Scryfall otags, 88-100% agreement on the cards it
added; removal misses against the otags 673 -> 472 of 1,520, draw 82 -> 40 of 919), and both fallback tiers are
sorted by score then `raw.edhrec_rank` (`popularityOf` in `deck.js`). Result: role counts per build did not move,
73 swaps from the wording and 44 more from the tie-break across 13 builds, generic picks 26 -> 24, Kaza unchanged
on the plain fixtures. The tie-break removes the alphabet. Still missing from the roles
(otag misses): chip burn and small -N/-N, ramp 212 of 564, wipes 100 of 130, counterspell wordings.

**Fallback themes and the default plan (2026-11-17).** With no EDHREC tags `detectCommanderThemes` calls `deriveCommanderThemes` (`themes.js`): the center reader's
creature types, keywords and non-thin terms, kept when the collection owns 5+ matches (`findLocalThemeMatches`), types first, at most 5; only if that is empty does it
fall back to the old count over the first 80 pool cards (which ignores the commander: Shelob and Sethron both got "human tribal"). A creature type outside the fixed tribal
table gets a tribal alias in `getThemeAliases`. `main.js` starts a build on `pickDefaultPlanFocus(planOptions)` (the first plan not "light") unless a focus is already set.
Do not add center-linked cards to `addEngineCandidates`: tried, it cost Fynn cheap carriers (a test records it). Spec: `dev/docs/superpowers/specs/2026-11-17-owned-plan-cards-shelob-sethron.md`.

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


