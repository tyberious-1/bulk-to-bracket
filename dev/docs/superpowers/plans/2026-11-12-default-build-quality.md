# Default-build quality: findings and plan (2026-11-12)

Status: PLAN ONLY. No code was changed. Written after building Teysa, Envoy of Ghosts and
Tori D'Avenant, Fury Rider from the real collection, then 12 of the 13 sample commanders in default
mode (all with EDHREC theme pages), and an independent Opus review of the findings.

Method note: builds used a refreshed collection copy (9,088 cards; the tracked `owned_raw.json` is from
2026-10-29 and lacks cards added since). Per-pick source and phase came from `precon_research/owned_commanders.py`.
Everything is reproducible from the scratchpad scripts described at the end.

## What was measured (12 default builds)

| | mean (range) |
|---|---|
| cards from EDHREC | 41.5 of 60 (29-53) |
| theme fallback | 15.9 (5-27) |
| generic filler | 2.7 (0-8), present in 9 of 12 |
| Phase 0 support-role cards | 25.8 (22-30) |
| cards at 5+ mana | 11.8 (5-15) |
| high-scoring EDHREC cards left out | 4.7 (0-30; Rielle 30, Greasefang 5, Tori 5, Council 5) |

Left-out count uses the median score of picked synergy EDHREC cards, which inflates Rielle; with an
all-EDHREC median the mean is about 6 and 8 of 12 builds leave 2 or fewer out.

## Findings, ranked by how well they hold

1. **Theme-fallback tier competes with EDHREC on a different score scale (main driver).**
   Theme scores run about 58-99 (theme-fit bonus plus mode-fit adjustment), EDHREC scores top out near 69,
   and Phase 2 (`chooseBestFlexibleCard`) compares them raw. The five Phase -1 theme seeds also claim cheap
   slots before anything else. Evidence: Tori forced to `theme:aggro` ran the same Phase 0 (27 slots) and took
   0 theme or generic cards, got the cheap EDHREC cards, and ended with 8 cards at 5+ (default: 15).
   The comment at `type-plan.js:342-345` already says the scales differ.
2. **The generic tier escapes the quality floor instead of meeting it.** For Instant and Sorcery buckets
   `pickFromTiers` asks the theme tier, and when its best card fails `clearsTypeTargetFloor` the callback returns
   null and the generic tier is asked. A source with no peers in the deck always clears, and later generic cards
   are compared only with earlier generic cards. `bucketsPastFloor` trips only when both tiers fail
   (`deck.js:619-635`, `type-plan.js:350-355`). Seen in Tori (4), Callaphe (8), Kaza (8).
   The theme floor is inflated by the seeds (scores 80-100); that the theme spells failed it is inferred, not traced.
3. **Thin EDHREC pools.** The owned cards from a commander's page number 66-154; after about 26 support-role
   slots, about 16 per build fall to theme fallback. This is the sparse-collection path working as designed; it
   is context for 1 and 2, not a defect by itself.
4. **Curve caps and build order are secondary, and uneven.** Tori: band 3 full (13/13) after Phase 0, which
   blocked Skyknight Legionnaire (60.4); band 2 was not full (plan creatures outscored the 2-drops left out).
   Rielle is the extreme (30 left out, 23 of them cost 3 or less, cause not yet traced). Most other builds
   leave 0-2 out. The caps are soft by design (`bestIgnoringCurve` fallback, `centerWeight >= 14` bypass).
5. **Role-tag errors.** `ramp` matches "affinity for" and "convoke" (`scoring.js:156-159`) but, unlike
   `costReductionIsGeneral` (`scoring.js:419`), never filters self-only discounts, so The Circle of Loyalty
   (an anthem) and Flight of Equenauts (a vanilla 8-mana flier) read as ramp. Sticky Fingers, Sunstar
   Expansionist and creature-cost reducers are defensible ramp.
6. **Center reader false link.** Raiyuu, Storm's Edge scored 16 for Tori: 10 from extra combat (real but weak) and
   6 from an attack-payoff pattern that ignores "alone" (`engines.js:860-861`). His trigger needs a Samurai or
   Warrior attacking alone, which conflicts with a go-wide attack lord.
7. **Wipes ignore the plan.** Farewell and Vanquish the Horde were drafted into wipe slots at very low scores
   (7.5 and 4.8) in an aggro deck.

Claim withdrawn: "build order is the main cause." The aggro comparison contradicts it.
Not a defect: the commander "Teysa" `hits` center label; with weight 0 on 57 of 60 cards it did nothing.

## Plan (ordered; nothing here is started)

Each step: read-only trace first, change in a throwaway worktree, run the relevant suites, run the
13-build diff, read the swaps, keep by local merge to main or delete the worktree.

1. **Trace the cross-source scale (finding 1).** Print, per build, the score range of each source at the
   moment Phase 2 and Phase 1b choose, and the pick each tier would have made alone. Goal: decide between
   normalizing theme scores per build, ranking the EDHREC leftover pool ahead of theme fallback when it
   clears a floor, or reducing the seed count. No code change.
2. **Fix the generic gate (finding 2).** Candidates: compare generic against the deck's overall average
   instead of its own source; or when the theme tier has no spell, take leftover EDHREC cards (they already
   ride along in Phase 2) before generic. Guard: Kaza's creature overdraft was why spells reach the generic tier.
3. **Trace Rielle (finding 4).** Confirm why 30 high scorers were left out (curve cap, role cap or bucket
   floor) before touching caps.
4. **Role wording (finding 5).** Filter self-only convoke and affinity the way `costReductionIsGeneral`
   does; check ramp agreement against Scryfall tags as in `scryfall-role-tags-vs-our-roles`.
5. **Reader link (finding 6).** Make the attack-payoff link respect "alone" and test against a card that
   should NOT match.
6. **Wipes (finding 7), design call for the user:** should the wipe target depend on plan (aggro and tokens
   low, control high)? Not to be decided by the agent.

Model and cost: steps 1-3 and 5 are reader or scoring logic, main model at higher effort. The 13-build diffs
and baseline regeneration can run on Haiku, with the diff read on the main model. Flag the full 13-build
dump before running it.

## Playtest checks (the real test)

Tori under `theme:aggro` versus default; Teysa as control (`theme:control`) versus default, including
whether five-plus wipes is intended; then re-check the earlier list (Azula, Avatar Kyoshi, Guru Pathik,
Raiyuu, Finneas).

## Reproducing the measurements

Scratchpad (session-local): `tori/`, `teysa/`, `set12/` with `out.txt` builds, `trace_*.txt`, and
`fetch_owned_ua.py` (the collection fetch with a User-Agent and retry; the tracked script 503'd
without them). Driver: `dev/tools/jxa-harness/precon_research/owned_commanders.py OUT "Commander"`, then
point `dump_own.js` at a refreshed `owned_raw.json`. Refresh the tracked `owned_raw.json` and baselines
only on purpose; the 13-build baselines were made on the 2026-10-29 collection.
