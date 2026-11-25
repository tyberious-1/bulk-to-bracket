# Plan-aware builder: design (2026-11-16)

Status: DESIGN, nothing built. Written after a session measuring why default builds "feel bad when goldfished"
(the user built 6 over a weekend). Companion to `dev/docs/superpowers/plans/2026-11-12-default-build-quality.md`
(findings on score scales, generic gate, role tags); this doc covers the structural change behind them.

## Problem

The user's read: the builder is "a camel" (committee-designed), too rigid, and quotas force bad picks.

What the measurements show (13 sample builds, owned_raw.json from 2026-10-29):

- Phase 0 support roles take 22-32 of ~60 slots (about 43% on average) at low scores.
- Loosening role minimums and curve caps (`ROLE_MIN`, `CURVE_OFF`) changed every build (9-23 cards) but moved
  goldfish numbers only a little: mana used T1-6 79.2% -> 80.6%, plan online by T6 59% -> 62%. Some swaps
  were worse (Lightning Bolt, Vindicate out; Swiftfoot Boots, Auramancer in). So quotas bind everywhere but are not
  the whole cause, and removing them is not the fix.
- Fynn, the Fangbearer (mono-G, wants deathtouch creatures to connect): 42 owned deathtouch creatures, 19 in the
  deck. The deck includes six at 4-5 mana (Acidic Slime, Greater Basilisk, Hoarding/Kessig Recluse, Luminollusk,
  Ornery Dilophosaur) and leaves out sixteen at 2 mana or less (Attercop, Heir of the Wilds, Death-Hood Cobra,
  Narnam Cobra, Poison Dart Frog...). A 1/1 deathtouch trades with a much stronger creature, so for this commander
  cheap is better. The builder scored the 4-drops about 31 and several 1-drops 24-25: no term rewards cheap
  carriers of the keyword the commander cares about.
- The center reader linked only 4 of Fynn's cards to the commander while 22 carry deathtouch, so link counts
  undercount plans like it.

Root cause (hypothesis, supported by Fynn and by the quota-stack result, not yet shown across all 13):
the builder has role tags and mana value but no general term for "what does this card do for this commander's
plan", and no stage judges the finished 99. Each stage fills its own quota, then later stages take what is left.
Fixes so far were one category at a time (ties, wording, center links, scales) and each exposed the next.

Not claimed: that a different design is better. That is what the test below decides.

## Goals

1. Plan cards (what the commander's text rewards) are found generally, not per commander.
2. A plan card scores higher when being cheap is the point (fodder), not when it is a payoff.
3. All sources score on one scale; roles, types and curve are soft targets that cost points, not gates.
4. A final pass judges the whole deck and swaps weak cards for better left-out ones.
5. Works on sparse collections; EDHREC stays a weak prior, never the planner (the user: correlation without causation).

Non-goals: optimizing for winning; a model or server (the app stays static, no build step); per-commander special cases.

## Design

### 1. Read the commander into a plan (reuse, extend)

Reuse the Bottom-Up fodder / enablers / payoffs model and the center reader. Generalize one rule: anything the
commander's trigger or cost depends on (a keyword, a type, a counter, a token, a spell type) is plan fodder.
Fynn: "a creature you control with deathtouch" -> deathtouch creatures are fodder, deathtouch granters are enablers.
Fix the reader gap first: the reader must report commanders it cannot read (it already tracks unread commanders)
and a card that carries the keyword the commander's trigger names must link (Fynn: 22 deathtouch cards, 4 linked).

### 2. Cost-aware plan score

For fodder: score falls as mana value rises, floored so a strong body is not ignored. For payoffs and engines:
mana value matters little. Applied through one new term in the shared scoring path (`js/analysis/scoring.js`),
used by every tier. Keep the term small and named so it can be read and tuned; no per-commander constants.

### 3. One score scale, soft quotas

Normalize theme, EDHREC and generic scores per build before comparing (the plan doc's finding 1). Roles, type
mix and curve become penalties on the objective in step 4, not a phase order. Phase 0 stops buying slots before
the plan is known; support roles are filled by best marginal value against the role's target.

### 4. Whole-deck pass

After the build, loop: take the lowest-contribution card, take the best left-out card, swap if a deck metric
improves, stop when none does. Deck metric (all computable offline, no model):
- plan cards in the deck and cheap plan cards castable by T3
- role coverage against soft targets (ramp, draw, removal, wipes), as penalties
- curve smoothness and 5+ mana count
- goldfish early plays and mana used (from the simulator below)
Protected cards (commander dependence, fun slots, support a role still needs) are never swapped out, as today.

## The test (build this first)

Without a test a rebuild cannot be judged. The build is judged by:

1. **Goldfish simulator upgrades** (`dev/tools/jxa-harness/precon_research/goldfish.js` exists; known limits:
   ignores colors, commander tax, tapped lands, link score comes from the builder's own reader). Add: colored
   sources and costs, tapped lands, commander tax, and two direct metrics: castable nonland plays on T2-T4 and
   dead cards in hand at T4. Seed 3000 games, deterministic seed, report noise (about +-1-2 points at 2000 games).
2. **Category regression tests** (JXA, `dev/tests/jxa/`): assert a general property, not a commander:
   - when the commander's text names a keyword, more cheap carriers of it make the deck than expensive ones
     (Fynn is the first case, mono-U or other keyword commanders are the second)
   - one score scale: no tier's picks are all above another's best for no reason (the scale trace from the plan doc)
   - the reader links cards carrying the keyword the commander's trigger names
3. **13-build diff**: before/after swaps per deck, read for meaning, not just counts (AGENTS.md rule).
4. **The user's ratings** (ground truth): about 30 cards from one deck, mixed builder picks and left-out owned cards,
   rated good / filler / dead. Check which automatic measure agrees with the user: builder score, EDHREC rank, text
   efficiency, simulator contribution. Build around the one that agrees. If none does, say so and do not pretend
   cards can be ranked automatically.

Pass condition (proposed, the user to confirm): on the 13 builds, plan-online by T6 and mana used T1-6 do not fall in
any build, improve on average by more than the noise, and the user prefers the rebuilt Fynn and one more deck when
the user goldfishes them.

## Rollout (small steps, each testable, worktree on a throwaway branch)

1. Simulator upgrades and the Fynn category test (read-only baseline of the current builder).
2. Reader fix: keyword the commander names links its carriers; report unread commanders.
3. Cost-aware plan term (step 2 above); run the 13-build diff and the simulator.
4. Normalized scores and soft quotas; run again.
5. Whole-deck pass; run again.
Keep a step only if the numbers and a read of the swaps say it helped; otherwise drop it. Merge to main locally.

## Risks and open questions

- Fodder cost term could crowd out expensive payoffs: guard by exempting payoffs and capping the term.
- The whole-deck metric can be gamed by the simulator's blind spots (no card power, no interaction).
  Mitigation: the user's ratings and a human read of every diff.
- Reader coverage: an unusual trigger is still misread until its pattern is added. This reduces misses, not removes them.
- Cost: simulator and diffs are mechanical (Haiku); scoring and reader logic stay on the main model.
- Open: should the wipe target depend on the plan (aggro low, control high)? Design call for the user.
- Open: owned_raw.json is from 2026-10-29; refresh deliberately when the baselines move.
