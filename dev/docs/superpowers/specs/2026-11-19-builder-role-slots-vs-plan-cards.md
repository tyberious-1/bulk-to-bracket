# Builder: support-role slots outrank plan cards (Shelob audit, 2026-11-19)

Status: FINDINGS from one harness audit plus Forge duel results; nothing in `js/` changed. Source tags: **(run)** harness or Forge output, **(read)** card text,
**(infer)** my reasoning, **(user)** the user's hypothesis, not tested.

## Context (run)

Pooled 894 Forge duels into one strength rating per deck (win rate against the average deck in the field). Builder decks average 0.40, precons 0.51, hand-built 0.49.
Shelob 0.26, Sethron 0.31, Iroas 0.40 are clearly below average; Whiplash 0.57, One 0.48, Oviya 0.40 are average within error. Evasive creature count tracks rating
(rho +0.67 over 17 decks): builder decks carry about a quarter of the precons' evasive power. Memory: `deck-diagnosis-2026-11-19`.

## The audit (run)

Method: scratch prefetch with Shelob only and no EDHREC page (the pure fallback path, as in `2026-11-17-owned-plan-cards-shelob-sethron.md`), a copy of
`dump_decks.js` that also prints each candidate's score, role tag and whether it made the deck. Default blend build; it is NOT guaranteed identical to the `ShelobNew` list
used in the duels. Themes read: spiders, food. Scored pool 3,214 nonland candidates; the 60th-ranked card scores 26.5, the 100th 25.5.

- **The deck holds 31 support-role cards** (draw 10, ramp 10, removal 8, wipe 3) and several score far below the plan cards left out: Necromantic Selection (wipe, 7 mana, score 3.0),
  Innocent Blood (6.0), Barter in Blood (7.0), Barrels of Blasting Jelly (12.0), Everflowing Chalice (12.0). Three sacrifice or destroy-all wipes sit in a creature-plan deck.
- **Owned plan cards that score well but are out:** eight cheap reach Spiders (Canopy Spider, Copper Longlegs, Netcaster Spider, Ember Weaver, Hitchclaw Recluse, Nyx Weaver,
  Kessig Recluse, Hoarding Recluse) at 28.5 to 29.5 (ranks 30 to 49); Food payoffs Tough Cookie 31.5 (rank 17), Sweettooth Witch, Provisions Merchant and Experimental
  Confectioner at 27.5 (ranks 50 to 53).
- **Cards the reader does not link to her plan:** changelings (Barkform Harvester, Three Tree Mascot, Universal Automaton and others) score 13.5 to 14.5 (ranks 470 to 590)
  against 28.5 to 29.5 for real Spiders; Herald's Horn and Gathering Stone score 13.0. (infer) A changeling is every creature type, so the reader should count it as a
  Spider; the score gap suggests it does not. Code not read.
- Not usable: the audit's `inThemeTier` column printed false for every card including one in the deck (likely a key-normalization mismatch). Ignore it.

## Reading (infer)

Phase 0 fills ramp, draw, removal and wipe to template targets (10/10/8/3) by score before plan cards compete, so low-scoring support cards take slots that
27-to-31-point plan cards never get. This is the "STILL OPEN" item in the 2026-11-17 spec ("about 28 slots go to support roles at scores of -0.5 to -15") and the user's
rule that roles are part of the plan (memory `roles-are-part-of-the-plan`). It also fits Shelob's measured slow start: 3.0 spells by own turn 5 (lowest of any deck).

## Forge evidence so far (run)

- Oviya edit (8 loose cards swapped for 8 owned trample creatures): 23/120 (19.2%) to 38/120 (31.7%) against six precons, +12.5 points (95% range +1.6 to +23.4); below the
  +15 bar set beforehand; gains came against ground decks, not fliers.
- Shelob: baseline (`ShelobNew`) 120 duels done; Food-plan arm (`ShelobF`) and early-reach-Spider arm (`ShelobS`) queued or running. Her reach Spiders did not reduce flying
  damage (Lathliss 39.4 vs 38.0 a game against reach-less decks; Sai 26.9 vs 28.3); fliers died twice as often against her, but only 9 of 49 deaths were on the
  attacker's own turn, so blocks did little. Reach Spiders were cast by turn 4.6 on average, dedicated anti-flier cards at 7.1.

## The user's hypothesis (not tested)

"The builder is broken; we are getting lucky with decks like Whiplash." One audited deck supports the first half for the Shelob path (plan cards outscored by support-role
picks). The second half is untested: I have not checked how Whiplash was built or whether it avoids this pattern.

## Next

1. Run the same audit on Whiplash, Oviya and Sethron: do their support slots also hold lower-scoring cards than the plan cards left out, and does Whiplash escape it?
2. Read why changelings and type-choosers get no Spider link (`getCenterLinks`, `type-member`).
3. Wait for the Shelob Food and early-reach arms before deciding which fix to design.

## Results added later 2026-11-19

**Audit method validated (run).** With the app's default plan focus applied the way `main.js` does it (first plan the collection supports; mode `theme:<focus>`),
the harness reproduces the original tested decks: Sethron build vs tested `Sethron.dck` 60 of 60 cards, Shelob build vs tested `Shelob.dck` 59 of 60. The tested `ShelobNew`,
`ShelobE`, `SethronE`, `SethronNew` decks came from other configurations (40 to 50% overlap). The audit used here is a copy of `dump_decks.js` plus a printout (scratch, not committed).

**Same defect in the focused builds (run).** Deck cards ranking below the pool's 60th card, and higher-ranked cards left out: Whiplash 44 / 54, Oviya 39 / 42, Sethron 33 / 187,
Shelob 29 / 29. Three wipes in the deck for Whiplash, Sethron and Shelob.

**Whiplash (run), the test of "we are lucky with Whiplash".** The fallback-path Whiplash (default plan focus "graveyard", no EDHREC page; only 4 to 7 of 62 cards in common with the
tested deck) won 5 of 60 (8.3%) against the six precons. The tested `Whiplash.dck` won 23 of 60 (38.3%). Difference +30.0 points, 95% range +15.8 to +44.2.
So the fallback pipeline produces a much weaker Whiplash than the deck we tested. The tested Whiplash, Oviya, One and Sheoldred were built in the throwaway `exp/four-new-commanders`
worktree with refreshed `owned_raw.json` / `prefetch_data.json`; (infer) those fixtures probably carried EDHREC pages, whose tag names read the plan (the 2026-11-17 finding), but the worktree
is gone and I did not confirm that. Checking would mean fetching EDHREC's Whiplash page (the slug only is sent); not done without the user's go-ahead.

**What this says about the claim.** "The builder is broken" holds for the fallback path, which AGENTS.md calls the product: the two reproduced fallback builds (Sethron 0.31, Shelob 0.26)
are clearly below average and the fallback Whiplash is far below the tested one. "Lucky with Whiplash" is better stated as: the tested Whiplash came from a route that read its plan,
and the fallback route does not. Not shown: whether that route was EDHREC data.

**Shelob arms (run, 120 duels each against the six precons).** Baseline `ShelobNew` 43 (35.8%). Early reach Spiders (`ShelobS`, 8 cheap reach Spiders in for 8 off-plan cards): 37 (30.8%), -5.0 points
(range -16.9 to +6.9); flying damage taken per game did not fall (Lathliss 27.4 to 30.6, Sai 22.4 to 19.7). Food plan (`ShelobF`): cancelled at 59 games, 17 wins (28.8%) against 23 of 60 (38%)
for the baseline on the same three precons. Neither idea helped; both stay as attempts, not fixes. Shelob remains a note for later: Food needs a way to turn into a win.
