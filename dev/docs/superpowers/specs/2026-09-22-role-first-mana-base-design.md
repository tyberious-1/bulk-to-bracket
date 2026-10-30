# Role-First Type Planning & Pip-Based Mana Base

Date: 2026-09-22
Status: Draft for review

## Motivation

The deck builder currently derives land count, curve shape, and per-type
card quotas from EDHREC's population averages for the commander
(`js/build/type-plan.js`), and balances the mana base by color-identity
membership only (`js/build/manabase.js`). Both are population/identity
heuristics rather than computations from this specific deck's actual mana
requirements:

- Land count is `edhrecTypeAverages.Land`, clamped to 38-42 because EDHREC's
  raw average is known to run land-light (`type-plan.js:14-17`).
- The land *count* used before that clamp check, `recommendLandCount`
  (`js/build/manabase.js:200-205`), is a flat lookup on color count alone
  (36/37/38) — no curve, ramp, or pip data.
- Nonbasic land scoring (`evaluateNonbasicLand`, `manabase.js:207-295`) and
  basic land balancing (`buildBasicManaBase`, `manabase.js:334-379`) both
  weight colors by identity membership only — a card with a double-black
  pip and a card with a single splashed-white pip are treated identically
  by the mana base.
- Type buckets (Creature/Instant/Sorcery/Artifact/Enchantment/Planeswalker)
  are the *hard* constraint on card picking (`buildTypeTargetPlan`,
  `chooseBestFlexibleCard`), and role targets (ramp/draw/removal/wipe) are
  only a scoring nudge layered on top — which is backwards, since role
  (what a card *does* for the deck) is the functional requirement and type
  (how it's implemented) is incidental. This already caused one bug
  (roles sharing a type bucket with an active theme got starved of slots,
  fixed by eviction logic in e17690c) because type quotas and role quotas
  compete for the same slots without either being primary.

This spec computes land count, mana-base color distribution, curve shape,
and card-type mix from the deck's actual candidate pool and picked cards,
instead of from EDHREC population averages and color identity alone.

## Non-goals

- No new roles (recursion/protection/wincon). `ramp/draw/removal/wipe` plus
  a `synergy` catch-all stay the role set. `detectRole`/`getRoleContributions`
  (`js/analysis/scoring.js`) are unchanged.
- No two-phase pick/reconcile loop. Land count stays a single up-front
  estimate from the candidate pool, computed once, same as today's
  single-pass flow — just from a better formula.
- No change to how EDHREC role targets are derived (`js/api/edhrec.js:439-521`
  stays as-is: EDHREC-derived when available, defaulted/clamped otherwise).
- No change to fixing-land quality scoring beyond feeding it per-color
  targets (the existing owned-collection-only constraint is unchanged —
  this never suggests buying cards).

## Design

### A. Land count estimate (pre-pick)

New function `estimateLandCount(candidatePool, commanderColors, roleTargets, deckSize)`
in `js/build/manabase.js`, called from `deck.js` before `buildTypeTargetPlan`.

1. Take the top `min(160, candidatePool.length)` candidates by `score`
   from the combined theme + generic pools (built earlier than they are
   today — see Data Flow below).
2. Parse each candidate's `manaCost` pip string (new helper `parsePips`,
   e.g. `"{2}{G}{G}"` → `{G: 2}`) into per-color pip counts. Hybrid
   symbols (`{W/U}`) count as 0.5 pips toward each color; Phyrexian
   (`{G/P}`) counts as a full pip for that color (it's normally paid
   that way); `{X}` contributes no colored pips.
3. Compute `pipIntensity` = average total colored pips per candidate
   card across the sample.
4. `landCount = clamp(recommendLandCount(commanderColors) + round(pipIntensity * 2) - round((roleTargets.ramp - 10) / 3), 35, 42)`
   — the existing color-count floor, nudged up for a pip-hungry curve
   and down for a ramp-heavy plan.
5. `recommendLandCount` itself is unchanged (it remains a sane floor
   input, not the final answer).
6. **Erratum (post-implementation ruling):** the pip estimate above is
   the *primary* land count, not a fallback behind EDHREC's own
   reported average the way step 4 alone might read. A first shipped
   version preferred `edhrecTypeAverages.Land` whenever EDHREC reported
   one — which is nearly always — leaving this pip estimate almost
   inert in practice; the user ruled that backwards once the harness
   comparison surfaced it. The shipped behavior (`resolveLandCount` in
   `manabase.js`) is: take the pip estimate from step 4, and if EDHREC
   reported a `Land` average, clamp it to `[38, 42]` the same way step 4
   already floors/ceilings the raw EDHREC number elsewhere, then bound
   the pip estimate to within ±2 of that clamped average — a sanity
   check on the estimate, not an override of it.

### B. Per-color source distribution (post-pick, real data)

Replaces the identity-only balance in `evaluateNonbasicLand` and
`buildBasicManaBase`.

1. New function `computeColorSourceTargets(nonlandDeckCards, commanderColors, landCount)`
   in `manabase.js`, called from `deck.js` right before the existing
   `buildNonbasicManaBase`/`buildBasicManaBase` call (`deck.js:569`),
   using the **actual final nonland card list** — no estimation needed,
   the deck is already built at this point.
2. Tally total colored pips per color (same `parsePips` helper, same
   hybrid/Phyrexian handling as A) across every nonland card in the deck.
3. `rawShare[color] = pips[color] / totalPips`. Apply a splash floor:
   any color in `commanderColors` with `rawShare > 0` gets at least
   `max(8, round(0.12 * landCount), round(landCount / (commanderColors.length + 0.5)))`
   sources before the remainder is distributed proportionally to the
   other colors by `rawShare`. Renormalize so targets sum to exactly
   `landCount`.
   **Erratum (post-implementation ruling):** the third term above was
   added after the harness comparison (see Testing, item 4) caught a
   real regression the flat `max(8, round(0.12 * landCount))` floor
   alone allowed: a 2-color commander whose own casting cost needs
   both colors early can still have one color's sources pushed down
   toward that flat minimum if the rest of the deck's spells happen to
   skew toward the other color, even though neither color is a genuine
   splash. The added term strengthens the floor for small identities
   (2-3 colors) while leaving it unchanged for larger ones (4-5 colors,
   where the flat term already dominates at realistic land counts).
4. `evaluateNonbasicLand` takes an added `colorTargets` argument and adds
   a bonus proportional to how far below target each color it produces
   currently sits (same shape as the existing identity bonus, just
   weighted by target-deficit instead of flat membership).
5. `buildBasicManaBase`'s greedy loop (`manabase.js:359-376`) changes its
   selection rule from "color with fewest current sources" to "color
   with the largest `(target[color] - currentSources[color])`" — same
   loop structure, different comparator.

### C. Curve shares (bounded adjustment)

`buildCurvePlan` keeps `DEFAULT_CURVE_SHARES` as its base table. A new
`adjustCurveShares(shares, roleTargets, strategyProfile)` shifts weight
between the low bands (`{1,2}`) and high bands (`{5,6,7}`):

```
rampShift = clamp((roleTargets.ramp - 10) * 0.01, -0.02, 0.05)
curveShift = rampShift - (strategyProfile.wantsGoWide || strategyProfile.wantsTribal
             || strategyProfile.wantsCantrips ? 0.02 : 0)
```

`curveShift` (positive = skew higher) is redistributed proportionally
across `{1,2}` vs `{5,6,7}` before `buildCurvePlan` turns shares into
per-band caps. Bands `{3,4}` are untouched — they're the stable middle
of the curve regardless of strategy. This is a ~±5%-of-shares nudge, not
a new curve model.

### D. Role-first target plan

`buildTypeTargetPlan` is replaced by `buildRoleTargetPlan` in
`type-plan.js`:

1. `roleTargets` (`ramp/draw/removal/wipe`, already computed via
   `normalizeRoleTargets`) each get `{target, min, max}` the same way
   type buckets do today (`min = max(floor, target - 2)`,
   `max = target + 2`).
2. A 5th bucket, `synergy`, gets
   `target = targetNonlandCount - (ramp.target + draw.target + removal.target + wipe.target)`,
   `min/max` following the same ±2 pattern. This is the "everything
   else" bucket — creatures, payoffs, tribal synergy, win conditions —
   getting an explicit budget instead of being whatever the type quotas
   left over.
3. Type buckets (Creature/Instant/Sorcery/Artifact/Enchantment/
   Planeswalker) drop their hard `max`. They keep a soft `min` of 1 when
   `edhrecTypeAverages[bucket] > 0` (so a deck doesn't end up with zero
   artifacts when the pool has good ones) and contribute a *minor*
   scoring term instead of a gate.
4. `chooseBestFlexibleCard`'s scoring swaps weight: role deficit becomes
   the dominant term (`deficit * 30`, was `* 12`), type deficit becomes
   the minor tiebreaker (`deficit * 8`, was `* 30`). `pickBestCardForBucket`
   gets a role-keyed sibling, `pickBestCardForRole`, using `card.role`
   instead of `getDeckTypeBucket(...)`.
5. `getCardsNeededForTypeMinimums` / `getTypePlanBucketNeed` get role-keyed
   equivalents operating over the new role buckets; the type-keyed
   versions stay for the soft diversity floor.

### E. Data flow changes in `deck.js`

Candidate pool construction (`themeFallbackPool`/`genericFallbackPool`,
currently built at `deck.js:213-256`, *after* `buildTypeTargetPlan` at
`deck.js:202`) moves earlier, before both `estimateLandCount` and
`buildRoleTargetPlan` are called — neither pool-building loop consults
`typePlan`, so this reordering has no other effect. Sequence becomes:

1. Build `themeFallbackPool` / `genericFallbackPool` (candidate scoring,
   unchanged logic).
2. `estimateLandCount(pools, commanderColors, roleTargets, deckSize)` → `landCount`.
3. `buildRoleTargetPlan(roleTargets, edhrecTypeAverages, landCount, ...)` → `plan`.
4. `adjustCurveShares(...)` → `buildCurvePlan(...)`.
5. Existing pick loop, using role buckets as the hard constraint.
6. Existing land selection (`buildNonbasicManaBase`/`buildBasicManaBase`),
   now preceded by `computeColorSourceTargets` on the real final nonland list.

## Testing

1. **Unit tests for `parsePips`**: hybrid (`{W/U}`), Phyrexian (`{G/P}`),
   generic (`{2}`), X-cost (`{X}`), and split/adventure cards (two mana
   costs) parse to the expected per-color pip maps.
2. **Unit tests for `estimateLandCount` / `computeColorSourceTargets`**:
   fixed synthetic candidate pools with known pip distributions produce
   the expected land count and source targets, including the splash-floor
   and clamp edges.
3. **Harness comparison**: using the existing offline JXA measurement rig
   (see memory `deck-builder-harness-data`), rebuild the same set of
   sample commanders (spanning mono/two-color/five-color, ramp-heavy vs
   ramp-light, tribal vs non-tribal) under the old and new logic, and
   diff land count, per-color source counts, curve histogram, and
   role/type fill rates side by side.
4. **Opening-hand simulation**: for each rebuilt sample deck, shuffle and
   draw a batch of simulated opening hands (7-card, plus one mulligan-to-6
   pass) and report, per color the deck needs, the fraction of hands that
   have an on-color source by turn 2-3. Compare old vs new mana base
   output on the same decklist composition so the hand-quality
   improvement (or regression) from part B is visible directly, not just
   inferred from aggregate source counts. This is the check the user
   explicitly wants before trusting the change.

## Files touched

- `js/build/manabase.js` — add `parsePips`, `estimateLandCount`,
  `computeColorSourceTargets`; change `evaluateNonbasicLand` and
  `buildBasicManaBase` comparators.
- `js/build/type-plan.js` — replace `buildTypeTargetPlan` with
  `buildRoleTargetPlan`; add `adjustCurveShares`; update
  `chooseBestFlexibleCard`/`pickBestCardForBucket` weighting; add
  role-keyed need-check siblings.
- `js/build/deck.js` — reorder candidate-pool construction ahead of
  land/role plan calls; wire new function calls through the existing
  build sequence.
- New test file(s) alongside the existing test harness for `parsePips`,
  `estimateLandCount`, `computeColorSourceTargets`, and the hand
  simulation comparison script.
