# Owned plan cards left out: Shelob and Sethron (2026-11-17)

Status: FINDINGS from two experiments; nothing in `js/` changed. The user's question: "what are you trying to fix?" Answer: the 99 should be
cards that work with the commander. The direct test is to build from the user's collection, list the owned cards that serve the commander's
plan, and see how many the builder leaves out. Source tags: **(read)** card text; **(code)** read in `js/`; **(run)** harness output;
**(mine)** my reasoning.

## Method (all in the scratchpad, not committed; rebuild from this description)

1. Scratch prefetch with ONE commander taken from `owned_raw.json` and no EDHREC pages = the pure fallback path (A). A second prefetch adds
   the live EDHREC commander page (`https://json.edhrec.com/pages/commanders/<slug>.json`, only the slug is sent) = the real-app path (B).
   Run through `dump_decks.js` with `ONLY_COMMANDERS` set and the prefetch path sed-replaced. The harness has no EDHREC theme pages.
2. Count the owned cards of the commander's tribe in the build, and read the builder's themes (`commanderThemes`).
3. Experiment (scratch only): a later declaration of `addEngineCandidates` that also adds cards `getCenterLinks` links to the
   commander as theme-tier candidates (engine-class cards already are).

## Cards (read)

- **Shelob, Child of Ungoliant** {4}{B}{G}, 8/8 Spider Demon: deathtouch, ward {2}; other Spiders have deathtouch and ward {2}; when a
  creature dealt damage this turn by a Spider you controlled dies, create a token copy that is a Food artifact and loses its other types.
  Plan (mine): Spiders deal damage to creatures (combat, fight, bite, pingers); each death is a Food and a copy of the dead creature's abilities.
- **Sethron, Hurloon General** {3}{R}{R}, 4/4 Minotaur Warrior: when Sethron or another nontoken Minotaur enters, create a 2/3 Minotaur
  token; {2}{B/R}: Minotaurs get +1/+0, menace, haste. Plan (mine): a Minotaur tribe that makes bodies and attacks wide.

## Results (run)

| | themes the builder chose | owned tribe members in the build |
|---|---|---|
| Shelob, A (no EDHREC) | counters, graveyard, countersmatter, sacrifice, human tribal, artifact creature tribal | 1 of 41 Spiders |
| Shelob, A + center-linked candidates | (same) | 3 of 41 |
| Shelob, B (EDHREC page) | spiders, tokens, deathtouch, food, reach, fight | 19 of 41 |
| Sethron, A (no EDHREC) | graveyard, counters, sacrifice, tokens, human tribal, artifact creature tribal | 0 of 42 Minotaurs |
| Sethron, A + center-linked candidates | (same) | 20 of 42 |
| Sethron, B (EDHREC page) | minotaurs, aggro, tokens, extra combats, discard | 20 of 42 |

Counts show whether the plan cards are in, not whether the deck is good. Neither build's other 40 cards were judged here.

## Causes found

1. **Fallback themes ignore the commander (code + run).** `detectCommanderThemes` (`js/analysis/themes.js` ~line 252) returns EDHREC tags when
   it has them. With none, it counts keywords over the first 80 owned cards (in collection order) that are creatures or mention
   tokens/sacrifice/counters/draw/graveyard/whenever. Both commanders got the same arbitrary list ("human tribal, artifact creature
   tribal" in each). Those themes steer the whole theme tier, so a Spider commander gets artifact and Treasure cards. This happens for any
   commander without EDHREC tags (a new or obscure commander, or the fallback path AGENTS.md calls the product).
2. **A center link does not make a card a candidate (code + run).** `addEngineCandidates` (`js/analysis/engines.js` ~line 1144) adds only cards
   with a strong engine class. Cards the reader links through `getCenterLinks` get a score bonus but are never put in the theme tier, so
   they are not considered unless a theme names them. Experiment: Sethron 0 to 20 Minotaurs, matching the EDHREC-tag build.
3. **A weak link weight loses even as a candidate (run + mine).** Shelob 1 to 3 only. Her Spiders read `type-member` for a bonus of 5; Sethron's
   best Minotaurs read `type-lord` for 35. Shelob's plan (Spiders that deal damage to creatures) is not read at all, only "Spider" and "Food".

## What this says about EDHREC (the user's rule: unproven until it helps)

For both commanders the EDHREC page's TAG NAMES ("spiders", "fight", "minotaurs") did the plan-reading the fallback cannot do, and the
builds were far better on the plan-card count. That is evidence EDHREC helps through its tag vocabulary. It is not evidence about its card ranks,
and it is two commanders on a harness without theme pages. The aim is to get that vocabulary from the commander's text, not to
depend on the page.

## Retracted

My first count (157 owned deathtouch cards, 0 in Shelob's build) was a poor criterion: she gives deathtouch to Spiders, so native deathtouch
matters only on non-Spiders. Do not cite it.

## Fix (merged to main as e19e3d7, 2026-11-17)

Changes: `deriveCommanderThemes` (themes.js) reads the commander with the center reader and keeps the creature types, keywords and non-thin
terms it names when the collection owns 5 or more matches (counted by `findLocalThemeMatches`), types first, at most 5; `detectCommanderThemes`
uses it when EDHREC gave no tags and falls back to the old pool count only if it returns nothing. `getThemeAliases` gives a creature type
missing from the fixed tribal table a tribal alias (Minotaurs). `addCollectionPlans(..., keepOrder)` keeps the commander-read order, and
`pickDefaultPlanFocus` (plans.js) makes a build start on the first plan the collection supports (main.js sets it unless the player or the
Theme tab already chose one). Tests: `dev/tests/jxa/fallback-themes.test.js` (15). All 29 suites pass; the real page builds with no JavaScript errors.

Measured with no EDHREC page (owned tribe cards in the build, before -> after the fix; the new default is the focused build):

| | blend of all themes | default (first plan) |
|---|---|---|
| Shelob, Spiders of 41 | 1 -> 14 | 23 |
| Sethron, Minotaurs of 42 | 0 -> 12 | 16 |

With EDHREC's page: Shelob 19 blend, 27 focused; Sethron 20 blend, 30 focused (harness has no theme pages). 13-build diff against main: 0 swaps (all EDHREC
builds unchanged, as designed).

**Tried and dropped:** adding center-linked cards to the candidate tier (`addEngineCandidates`). It gave the same counts once the themes were derived, and
in the 13-build check it cost Fynn 3 of 19 cheap deathtouch carriers (19 -> 16) by flattening the tier's order. A test records that decision. Whether it
helps when EDHREC tags exist but omit the commander's own type is untested.

## Still wrong after the fix (read from the builds by hand)

- The rest of a no-EDHREC deck is weak. Sethron's other 44 cards were in alphabetical order. CAUSE FOUND AND FIXED (2026-11-17): with no EDHREC page the whole collection is
  the scored pool (labelled "Collection Fallback", reported as source `edhrec`), and `deck.js` sorted that pool by score alone; only the fallback tiers had the popularity
  tie-break. Now `scoredNonlands` carries `popularity` and ties break most-played first (names starting A or B: about 35 -> 6 of 60). The earlier note blaming the
  `etb-body` link and "collection order" was incomplete. STILL OPEN: about 28 slots go to support roles (ramp/draw/removal) taken from that pool at scores of -0.5 to -15,
  before the Minotaurs; the scores themselves, not the order, are the next problem. No ramp, draw or removal slots are planned from the plan, so curves are top-heavy.
- Shelob's `food` theme brings low-power Food makers. Her actual plan (Spiders dealing damage to creatures, each death a Food and a copy of its abilities) is
  not read; only "Spider" and "Food" are. Spider-Slayer, Wild Shape and Grow Extra Arms are in because their text says "Spider".
- "The default is the first tag" is implemented as the first plan the collection supports, in plan order, not literally EDHREC's first tag.
- The Theme tab's tribal list (`TRIBAL_TYPES`, about 80 tribes, no Minotaur) is unchanged; only the builder's alias table was widened.

## Next (not started)

1. The broad `etb-body` link and the collection-order tie-break behind the filler (a category fix, tests first).
2. Roles as part of the plan for a fallback build (`exp/soft-roles` holds an untested floor idea).
3. Read the unread half of Shelob's plan (damage dealt by a Spider), and the trigger-doubler and mana-sink gaps from
   `2026-11-17-expert-list-blindspots.md`.

## Result 2026-11-18: `supportOverhead` for builds that have EDHREC data (tried, rejected)

Question: should `supportOverhead` (main.js passes it only when `edhrecCards` is empty) also be on when EDHREC data exists, so support cards stop using the plan's curve
bands and type targets? Experiment in a throwaway worktree: the harness `dump_decks.js` got a `SUPPORT_OVERHEAD` switch; the 13 sample builds were built with it off and on.
The harness did not pass the option at all before this (it now mirrors the app: on only when there are no EDHREC cards, `SUPPORT_OVERHEAD` overrides).

- Turning it on changed every build: 7 to 22 cards swapped each, 231 in total.
- It took plan cards out. Fynn: 9 of the 16 cards that left carry deathtouch/poison/infect/toxic text, 2 of the 16 that came in do. Strefan: 11 of the 14 cards that left are
  Vampires, 1 of the 14 that came in is. Cards with ramp/draw/removal text went up (Fynn 21 to 22, Strefan 38 to 42, Rutstein 28 to 32, Greasefang 23 to 27).
- Likely reason (not proven): it scales the plan's type targets and curve caps down by the support share (about half), but EDHREC's type averages already include support cards,
  so the overhead is counted twice and the plan buckets shrink. Names like Necron Monolith and Commander's Sphere enter several builds.
- Decision: leave it off for EDHREC builds. The open problem stays open: Phase 0 still fills ramp/draw/removal/wipe by score from template targets (10/10/8/3). `exp/soft-roles`
  (floors 3/3/3/1) is the other attempt and has no judge yet; the user's rule is that removing quotas alone does not help and a plan-contribution score is needed.

**Second try 2026-11-18: exempt support cards from the bands but do not shrink the plan's targets (`supportNoScale`), also rejected.** Same 13 builds, EDHREC data present.
137 cards swapped (against 231 with scaling). Plan cards still fell: Fynn deathtouch/poison cards 31 (main) -> 24 (scaled) -> 29 (no scaling); Strefan Vampires 27 -> 17 -> 25. Support-text cards:
Fynn 21 -> 22 -> 18, Strefan 38 -> 42 -> 40. So the double-counted scaling was part of the damage, not all of it, and the reserved-slot idea does not add plan cards for EDHREC builds.
Reading: on main the EDHREC builds already hold many plan cards (Fynn 31 of 61, Strefan 27 of 60), so "support quotas crowd out the plan" may be mainly a no-EDHREC (fallback) problem, where
`supportOverhead` is already on. Not yet measured: how well that works on Shelob/Sethron-type builds (they are not in `prefetch_data.json`; `precon_research/owned_commanders.py` builds them with fetched pages).

