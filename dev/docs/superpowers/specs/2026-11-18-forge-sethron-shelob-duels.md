# Forge duels: Sethron vs Shelob (builder output, 2026-11-18)

Both decks built from the user's collection by the current builder on main (d1a8eef, EDHREC pages present for both): `ShelobNew.dck`, `SethronNew.dck` in the git-ignored
`dev/tools/forge-sim/work/decks/`. 20 duels, `-mc on -c 900`, 10 per seat order (logs `work/duelNew_A.txt`, `duelNew_B.txt`). Readers: `parse.js`, `pace.js`,
`plan_turns.js` (per own turn spells, attackers, commander triggers), `win_cards.js` (cards cast in wins vs losses, combat-hit sources).

## Results (what the logs show)

- Shelob 11 wins, Sethron 9. This is inside chance for 20 games; it is NOT evidence that one deck is better. The first-listed deck won 13 of 20, also inside chance.
- Commander cast in 19 of 20 (Shelob, mv 6, first on own turn about 6.2) and 18 of 20 (Sethron, mv 5, own turn 4.8 and 6.0). Both about on curve, as the precons were.
- Spells in the first 5 own turns 2.8 to 3.8, at or below the lowest of the Lorehold mirror's spread (3.5 to 6.3); 10 games per batch, not a finding yet.
- Plan triggers fired about 4 times a game: Sethron's Minotaur token trigger 82 lines, Shelob's Food-copy trigger 76 lines over 20 games.
- 3+ attackers on some turn: Shelob 12 of 20 games, Sethron 11 of 20 (own turn 5 at the earliest).
- Forge cast or played 70 of Shelob's 73 and 65 of Sethron's 73 distinct non-basic cards at least once, so it knows nearly all of them.

## Key cards in each deck's wins (small samples: 11 and 9 wins)

- Shelob wins: cards cast in wins and rarely in losses were Jaheira, Friend of the Forest (5 of 11 wins, 0 of 9 losses), Rewrite Regrets (4/11, 0/9), Viridian Longbow (5/11, 1/9),
  Heaped Harvest (4/11, 1/9), The Serpent Society (4/11, 1/9), Bushwhack (4/11, 2/9). Shelob herself was cast in all 11 wins and 8 of 9 losses, so she does not separate them.
  Combat-hit sources in its wins: Shelob (17 hits), tokens (Spider 14, Assassin 8, Zombie 6, Sliver 22), The Serpent Society (10), Silklash Spider (7), Jaheira (6), Sporeweb Weaver (6).
- Sethron wins: Terminate (4/9 wins, 0/11 losses); Sethron cast in all 9 wins and 9 of 11 losses. Hits: Minotaur tokens (27), Sethron (20), Felhide Petrifier (8), Burning-Fist
  Minotaur (7), Tether Technician (6), Troop of Ponies (6), Rageblood Shaman (6), Universal Automaton (6).
- These are counts of how often a card appeared, not proof that it caused a win.

## RESOLVED 2026-11-18: Shelob's Minotaur tokens were real, made by a Food copy of Sethron (my Forge-bug guess was wrong)

Shelob's trigger copies a creature that died after a Spider hit it, "except it's a Food artifact ... and it loses all other card types", so a copy cannot attack. Forge's script
(`shelob_child_of_ungoliant.txt`) has `AddTypes$ Artifact & Food | RemoveCardTypes$ True | RemoveSubTypes$ True`. In the logs Shelob's player declared Minotaur Tokens (a token only Sethron's
deck makes) as attackers 20 times, and a Minotaur Token (370) tapped for {G} (Night of the Sweets' Revenge gives Foods that ability). No card in Shelob's deck makes Foods creatures
(checked the card text). Shelob attacked with a Sethron-only Minotaur Token in 4 games and won all 4; it won 7 of the other 16. NOT established: whether Forge leaves the Creature type on
these copies (a Forge implementation problem), or something else explains it. If it is Forge, Shelob's engine is stronger in the sim than the printed card. (Superseded, see the resolution below.)

### Scryfall rulings on Shelob (read 2026-11-18, https://api.scryfall.com/cards/a14c4b29-3363-45ce-9190-0f79e1a0ef7f/rulings)

- "Since the token is a Food artifact and not a creature, it can't attack or block unless it becomes a creature somehow." (WotC, 2023-06-16)
- "Food is an artifact type. Even though it appears on some creatures, it's never a creature type." (2024-11-08)
- If the copied creature is a token, the new token copies that token's original characteristics (so a copy of a Minotaur token is a Food named for it, not a 2/3 creature).
- Enters-the-battlefield abilities of the copied creature DO trigger when the copy enters (that part is legitimate value for Shelob).

So an attacking Food copy contradicts the rulings. Together with the log (Sethron-only Minotaur Tokens declared as Shelob's attackers 20 times; none of Shelob's cards animate Foods) this points to Forge not
removing the Creature type from these copies, but that is still an inference: I did not trace one specific token from creation to attack. A web search found no existing Forge issue for it (not proof there is none).
(Superseded by the resolution below: the user asked whether Shelob had copied Sethron.)

### Resolution (the user's hypothesis: Shelob copied Sethron, and the copy made the tokens)

Sethron's ability is "Whenever Sethron or another nontoken Minotaur you control enters, create a 2/3 red Minotaur creature token." A Food copy keeps the printed abilities, and the ruling says the copied
creature's enters abilities trigger, so the Food copy of Sethron entering triggers itself and makes a real 2/3 Minotaur creature token under Shelob's control. Log check over the 20 duels: Shelob's side
triggered Sethron's own ability in 9 games (games 3, 5, 6, 8, 9, 12, 14, 16, 17; 1 to 4 times each). In every game where Shelob attacked with Minotaur tokens (3, 9, 14, 17) that trigger had fired for Shelob;
Shelob won all four. So the tokens are legitimate and nothing here shows a Forge bug. The Food-copies-attack suspicion is withdrawn. Not traced: where Shelob's Horror tokens came from, and the Sliver tokens
(very likely Shelob's own Thrumming Hivepool, whose upkeep trigger makes two 1/1 Slivers; not confirmed in the log).

What it does show: Shelob's trigger can take Sethron's engine, which helps explain why Sethron's commander and Minotaur-heavy deck feed Shelob in this matchup. That is a property of this pairing, not of the builder.
The earlier caution about using Shelob results is lifted. 11 to 9 is still inside chance.

## Gauntlet trial: Shelob (builder output) vs 3 Foundations precons, 1v1 (2026-11-18)

Opponents (Forge precons, FDC 2026; no published bracket or salt score found): Reign of Dragons (Lathliss), Keen Engineering (Sai), Wretched Ranks (Gisa). 10 duels per seat order
per opponent, default AI (Monte Carlo off), 60 duels, no draws. Logs `work/gaunt_Shelob_<opp>_A.txt` / `_B.txt`. Runner script was `gauntlet.sh` (scratch, not committed).

- Shelob won 16 of 60 (27%, 95% range 17 to 39%): vs Reign of Dragons 4/20, vs Keen Engineering 4/20, vs Wretched Ranks 8/20 (each 95% range about 8 to 42%, 22 to 61% for Gisa).
  The overall range excludes 50%, so against these three precons this build is weaker. Per-opponent differences are not established.
- Same games, her numbers against the precons': spells in own first 5 turns 2.6 (precons 4.5, 4.8, 4.5); nothing cast by own turn 3 in 9 of 60 games (precons 1 of 20 each);
  mulligans 26 of 60 games (precons 2, 3 and 4 of 20); games missing 2+ of 6 land drops 24 of 60 (Gisa 10 of 20, Lathliss 3 of 20, Sai 4 of 20); commander cast in 46 of 60 games, first on own
  turn 7.0 (Lathliss 6.2, Sai 4.7). Parser shows Gisa's commander cast as 0/20: likely a name-match problem, not checked.
- Shelob's nonland mana values (current main): 17 cards at 1 to 2, 27 at 3 to 4, 16 at 5 or more; commander costs 6; 39 lands. These are facts about the list, not shown to be the cause.
- Not established: why she starts slowly (curve, mulligans, the AI's keep decisions, mana colours, tapped lands, or chance in part). One commander only.


## Gauntlet trial: Sethron (builder output) vs the same 3 Foundations precons, 1v1 (2026-11-18)

Same method as the Shelob gauntlet (default AI, Monte Carlo off), but 30 duels: 5 per seat order per opponent. `SethronNew.dck` against `GauntLathliss`, `GauntSai`, `GauntGisa`. Logs
`work/gaunt_Sethron_<opp>_A.txt` / `_B.txt` (git-ignored). No stalls, no draws.

- Sethron won 6 of 30 (20%, 95% range about 10 to 37%): Lathliss 3/10, Sai 1/10, Gisa 2/10 (10 duels per opponent is too few to compare opponents). The range excludes 50%.
- Same pattern as Shelob: spells in own first 5 turns 2.9 (precons about 4.5 in the Shelob runs); commander cast in 29 of 30 games, first on own turn about 6; nothing cast by own turn 3 in 3 of 30;
  mulligans 9 of 30 (clustered: 4 of 5 in one batch, 0 of 5 in another); games missing 2+ of 6 land drops 7 of 30 (about what 39 lands predicts).
- Reading: both builder decks win under half their games against these precons and start slowly. Two commanders on one builder version, so it does not separate a builder problem from commander fit.
  The earlier mulligan guess (builder decks mulligan more than precons) is weaker than first stated: Sethron's rate is 30% and swings between batches.
- Caveats unchanged: Forge's AI is heuristic and favors aggro, and the precons are tuned 100-card decks. Not tested: opening-hand shape (cheap plays per kept hand) from simulated deals.

## Four more builds vs the same 3 precons, and the pooled picture (2026-11-18)

Built in a throwaway worktree (`exp/four-new-commanders`, NOT merged) from `dev/card inventory (1).csv` (Nov 18 export, 9111 cards): Oviya Pashiri Sage Lifecrafter, Whiplash Vengeful Engineer,
One Borg Evolved, Sheoldred the Apocalypse. The worktree's refreshed `owned_raw.json` / `prefetch_data.json` are deliberately NOT on main: merging them would move the 13-build baseline.
Decks copied to the git-ignored `work/decks/` (`Oviya_Pashiri.dck`, `Whiplash.dck`, `One.dck`, `Sheoldred.dck`). 30 duels each, 5 per seat order per opponent, default AI. Logs `work/gaunt_<deck>_<opp>_[AB].txt`.

| build | wins | vs Lathliss | vs Sai | vs Gisa | vs Lath+Sai only |
|---|---|---|---|---|---|
| Whiplash | 18/30 (60%) | 4/10 | 4/10 | 10/10 | 8/20 (40%) |
| One, Borg Evolved | 15/30 (50%) | 3/10 | 5/10 | 7/10 | 8/20 (40%) |
| Oviya Pashiri | 9/30 (30%) | 2/10 | 3/10 | 4/10 | 5/20 (25%) |
| Sheoldred | 8/30 (27%) | 3/10 | 2/10 | 3/10 | 5/20 (25%) |
| Sethron (earlier) | 6/30 (20%) | 3/10 | 1/10 | 2/10 | 4/20 (20%) |
| Shelob (earlier) | 16/60 (27%) | 4/20 | 4/20 | 8/20 | 8/40 (20%) |

- **Pooled, 6 builds, 210 duels: 72 wins (34.3%, 95% 27.9-40.7%).** Excludes 50%.
- **The Gisa matchup is the odd one.** Pooled by opponent: Lathliss 19/70 (27.1%), Sai 19/70 (27.1%), Gisa 34/70 (48.6%). Against Lathliss+Sai only, pooled 38/140 = 27.1% (95% 19.8-34.5%).
- **Against Lathliss+Sai the six builds are statistically homogeneous**: heterogeneity chi-square 4.98, df 5 (critical 11.07). They all sit at 20-40%. So this is a builder-wide result, not one bad commander.
  The full-set heterogeneity (chi-square 17.37, df 5) comes almost entirely from the Gisa column, above all Whiplash's 10/10 (p = 0.0007 under the pooled 48.6% Gisa rate) - a real outlier, cause NOT investigated.
- **RETRACTED: "slow starts explain the losses."** It does not survive the wider sample. Spells in own first 5 turns vs win rate against Lathliss+Sai: Oviya 5.0 spells -> 25%; One 3.4 -> 40%;
  Whiplash 5.9 -> 40%; Sheoldred 3.2 -> 25%; Shelob 2.6 -> 20%; Sethron 2.9 -> 20%. Faster builds did not win more. Earlier notes in this file steered toward curve/mulligans as the cause; that steer is withdrawn.
- **Game closeness:** of 120 games across the four new builds, the winner finished at 10 or less life in only 10. Winner's average ending life in our losses: Oviya 28.4, Sheoldred 29.2, One 29.0, Whiplash 20.8
  (Whiplash's losses were the closest). Games ran about 18 turn lines (about 9 turns each). The measure is the last `Life:` value for the winner, a rough proxy only; One's 64.8 in wins is unexplained and may be a reader fault.
- **Sheoldred** (the strongest card on paper of the four) came last: 8/30, 11 mulligans of 30, 13 of 30 games missing 2+ of 6 land drops (worst of the four), commander cast 27/30 on own turn 5.2.

### The gap in this conclusion (control running, result not in yet)

Nothing above measures what a NON-builder deck scores against Lathliss and Sai. Forge's own `AI.md` says its AI is best with aggro/midrange: Lathliss (dragon aggro) and Sai (go-wide thopters) are shapes it pilots
well, Gisa (sacrifice) less so. "Builder decks are weak" and "the AI is unusually strong with those two precons" both fit the data equally. Control started 2026-11-18: Gisa, Lorehold (Quintorius), Living Energy
(Saheeli) and Bello, each 10 duels vs Lathliss and 10 vs Sai, same settings (logs `work/ctrl_*`). If the precons pool near 50%, the builder is genuinely below precon level; if they pool near 30%, the gauntlet is
simply hard and the "not good" verdict does not follow.

## CONTROL RESULT (2026-11-18): the gauntlet is hard for everyone, so the "builder makes bad decks" verdict does NOT follow

Four Forge precons run against the same two benchmark precons, same settings, 10 duels each (5 per seat order), 80 duels. Logs `work/ctrl_*`. No stalls, no draws.

| control deck (a Forge precon) | vs Lathliss | vs Sai | total |
|---|---|---|---|
| Quintorius (Lorehold Spirit) | 5/10 | 5/10 | 10/20 (50%) |
| Saheeli (Living Energy) | 4/10 | 3/10 | 7/20 (35%) |
| Bello (Animated Army) | 5/10 | 2/10 | 7/20 (35%) |
| Ghoulcaller Gisa (Wretched Ranks) | 2/10 | 3/10 | 5/20 (25%) |

- **Precon control pooled: 29/80 = 36.2%** (95% 25.7-46.8%). **Builder builds: 38/140 = 27.1%** (95% 19.8-34.5%).
- **Difference +9.1 points, z = 1.41, two-sided p = 0.158. NOT significant.** The builder's decks are directionally below the precons and statistically indistinguishable from them at this sample size.
- The four control precons are homogeneous among themselves (chi-square 2.76, df 3, critical 7.81). **No precon beat 50% against Lathliss and Sai.** Those two beat everything, including four other retail precons.
- **Therefore: the earlier 27.1% does NOT by itself show the builder is weak.** The decision rule set before the control ran was: precons near 50% -> builder genuinely below precon level; precons near 30% -> the gauntlet
  is simply hard. The answer came back 36.2%, much nearer the second. The user's reading on 2026-11-18 ("we have enough results to determine the builder is not making good decks") is not supported by this data.
- **Why Lathliss and Sai dominate is NOT established.** Forge's `AI.md` says its AI is best with aggro/midrange; Lathliss (dragon aggro) and Sai (go-wide thopters) are those shapes. So they may be strong lists, strong
  AI fit, or both. Consequence: **they are poor benchmarks.** A fairer gauntlet would be a round robin over many decks, or would calibrate each opponent by its own head-to-head record first.
- To resolve the +9.1-point gap at 80% power would need roughly 430 duels per arm (about 860 total). That is hours of runtime, not minutes.

### Closeness of games (the user's suggestion, 2026-11-18): a better-powered measure, and it says the same thing

Measure: the winner's LOWEST life at any point in a game our deck lost (40 = the opponent was never touched). Final life is a poor proxy because Magic games end abruptly; lowest life shows how close the loser came.
Computed from existing logs, Lathliss and Sai matchups only.

| | n | median | got winner under 20 |
|---|---|---|---|
| Whiplash | 12 | 16.5 | 75% |
| Oviya Pashiri | 15 | 25.0 | 7% |
| Sheoldred | 15 | 27.0 | 20% |
| Sethron | 16 | 32.0 | 6% |
| One, Borg Evolved | 12 | 33.5 | 25% |
| Shelob | 32 | 39.0 | 12% |
| **pooled builder** | **102** | **32.0** | **21%** |
| **pooled precon control** | **46** | **30.0** | **24%** |

- **When builder decks lose, they lose the same way precons lose** (median 32 vs 30; under-20 21% vs 24%). Second independent line of evidence against the "bad decks" verdict.
- **Closeness and win rate disagree, so closeness is a complement, not a replacement.** Quintorius has the best win rate (50-60%) and the worst closeness in loss (median 32, never got either opponent under 20):
  go-wide aggro is bimodal, it wins fast or dies flat. Whiplash is the reverse: best closeness by far, 40% wins. Closeness measures HOW a deck fails, not how often.
- **Shelob (median 39 over 32 losses) is the real outlier** - she barely touches the opponent. That is a problem with that one build, not a builder-wide one. Best single lead to chase next.
- Caveat: opponents damage themselves (lands, their own effects, and Sheoldred's drain hits on every opponent draw). Combat vs self-inflicted damage is NOT separated, so under-20 is generous to every deck equally.

### "How close to winning were they?" - turns still needed (the user's point, 2026-11-18)

The user: lowest-life misses the damage a deck could have done with one more turn. Measured instead, from existing logs (Lathliss/Sai matchups, games our side lost): the losing deck's BEST single-turn combat damage
output, and `winner's final life / that rate` = turns it still needed. In a duel, combat damage dealt TO the winner is the loser's output, so no card-ownership mapping is needed.

| | builder builds | precon control |
|---|---|---|
| losses measured | 102 | 51 |
| best single-turn damage (median) | 4 | 4 |
| needed 1 more turn | 6% | 10% |
| needed <=2 more turns | 17% | 16% |
| needed <=3 more turns | 26% | 27% |
| median turns still needed | 6 | 6 |
| never dealt any combat damage | 24% | 16% |

- **Third independent measure, same verdict: builder decks were no further from winning than precons were.** Both groups needed a median of 6 more turns. Few losses on either side were near-misses.
- Per build: Whiplash best-turn damage median 6, 33% needed <=2 more turns, 8% never connected. Then Sethron and One (4, 25%, 19-25%), Oviya (5, 13%, 0%), Sheoldred (4, 7%, 27%).
  **Shelob worst by far: median 2 damage, and 41% of her 32 losses had her dealing ZERO combat damage.** That is a defect in one build.
- **LIMIT, not yet closed:** this is damage DEALT, not damage AVAILABLE. A deck holding a lethal board that was chump-blocked or kept home on defense scores the same as one with an empty board. True potential damage
  needs board state (summed power of untapped creatures at the moment of death); the log has `Zone Change` lines but no power/toughness, so it would have to be joined against card data. NOT built.

## Where this leaves the project (2026-11-18, end of session)

1. **The "builder makes bad decks" verdict is NOT supported.** Three independent measures (win rate vs a precon control, winner's lowest life, turns-still-needed) all put builder decks level with retail precons
   against this gauntlet. The builder is directionally 9 points behind on win rate, p = 0.158.
2. **The benchmark is the problem.** Lathliss and Sai beat all four control precons too; nothing reached 50%. Likely Forge AI fit for aggro. Replace them: round robin over many decks, or calibrate each opponent
   by head-to-head first. Do NOT run more builds against Lathliss/Sai expecting a clean read.
3. **Shelob is the one real defect found** (zero combat damage in 41% of losses, median best turn 2). Chase that build specifically, not the builder as a whole.
4. Not merged: `exp/four-new-commanders` (refreshed `owned_raw.json` / `prefetch_data.json` from the Nov 18 export, 9111 cards). Merging moves the 13-build baseline - the user's call.

### Potential damage on the board at death (the user's question, 2026-11-18): built, `dev/tools/forge-sim/board.js`

Question: damage DEALT undercounts a deck that died holding a strong board. `board.js` rebuilds the creature board when a deck lost and splits out power that never attacked.
**Method limits (the log has no battlefield-entry event):** board = nontoken creatures CAST minus creatures seen leaving the battlefield. Tokens are excluded, static buffs ignored, tapped state unknown,
countered spells still count as entries, and a creature cast in the last two global turns is not counted as able to attack. It is a LOWER BOUND, and it undercounts go-wide decks most (every precon in the control
and Shelob/Sethron are token-heavy). Validated by hand on game 1 of `gaunt_Shelob_Lathliss_A` (5 creatures cast, 4 exited, Shelob alone left and never attacked; script agreed).

**A bug that nearly produced a wrong result, kept here as a warning.** The first version dropped any creature whose card was missing from `owned_raw.json` WITHOUT counting it. Every precon card is missing, so it
reported 26 of 51 precon losses as an empty board; the true figure is 7 of 51. The builder side was also short (28 uncounted casts: `owned_raw.json` is the Oct 29 dump and lacks the newer cards). Both were fixed by
fetching card data for every decklist (`fetch_deck_cards.py` -> git-ignored `work/precon_cards.json`) and printing "cast cards with NO card data" (now 1 builder, 0 precon; 3 builder cards have `*` power, scored 0).

| losses to Lathliss/Sai | n | creatures alive | board power (median / mean) | power that NEVER attacked (median / mean) | empty board |
|---|---|---|---|---|---|
| **pooled builder** | 102 | median 1 | 4 / 5.6 | 2 / 3.5 | 20 (20%) |
| **pooled precon control** | 51 | median 2 | 5 / 6.8 | 2 / 3.6 | 7 (14%) |
| Shelob | 32 | 1 | 8 / 7.0 | 2 / 4.1 | 5 |
| Sethron | 16 | 2.5 | 7.5 / 6.9 | 4.5 / 4.4 | 4 |
| Oviya Pashiri | 15 | 3 | 6 / 5.5 | 4 / 3.6 | 1 |
| Whiplash | 12 | 1.5 | 4 / 4.3 | 2 / 2.5 | 2 |
| One, Borg Evolved | 12 | 1 | 2 / 3.3 | 0 / 1.8 | 4 |
| Sheoldred | 15 | 1 | 4 / 4.6 | 4 / 3.1 | 4 |
| Gisa / Quintorius / Saheeli / Bello (precons) | 15/10/13/13 | 2 | 4-6 / 6.4-7.7 | 0-1 / 2.3-5.2 | 1-3 each |

- **Builder boards at death are a little smaller than the precons' (median power 4 vs 5, empty board 20% vs 14%) but the gap is small and not tested for significance** (the empty-board difference is 20/102 vs 7/51).
  The unused power is the same (mean 3.5 vs 3.6). On this measure, as on the other three, the builder is not separated from the precons.
- Most losing decks, builder and precon alike, died holding about 2 to 4 power that never attacked. That is usable damage left behind (blockers held home, or too new to attack), not an empty board.
- **Two build-specific signals:** One and Sheoldred die with the smallest boards (median power 2 and 4, 4 of 12 and 4 of 15 empty), and Oviya/Sethron leave the most idle power (median 4 and 4.5).
- **Shelob needs a second look.** The earlier finding was "zero combat damage in 41% of losses". Here she dies holding a board of median power 8, which is mostly Shelob herself (8 power), cast late. So the defect is not "nothing on the board":
  a big commander sits there without connecting. Why (kept home as a blocker, targeted removal, cast too late to swing) is NOT established.

## The user's hand-built Rosheen deck (2026-11-18): a separate category, NOT pooled with the builder numbers

Deck: the user's own list from their ManaBox page (commander plus 99; 18 Forest, 11 Mountain; heavy on X spells and hydras), written to `work/decks/Rosheen.dck` (git-ignored). Hand-built, so it says nothing about the builder, and the pooled builder
and precon numbers above exclude it on purpose. Method as before: default AI, seat-swapped, 10 duels per opponent. Logs `work/rosh_*` (6 precons) and `work/rvb_*` (the 6 builder decks). The user reports 0 wins in 8 four-player games with it.

- **vs the six precons: 12/60 (20%)** (Quintorius 2, Saheeli 2, Bello 2, Gisa 1, Lathliss 2, Sai 3, each of 10). **vs the six builder decks: 18/60 (30%)** (One 5, Sethron 4, Shelob 3, Whiplash 3, Sheoldred 2, Oviya 1). The 20% vs 30% gap is not significant (z about 1.3).
  The builder decks beat her 42 of 60 (70%), the precons 48 of 60 (80%). **Do not read that as "the builder beats hand-built decks": the AI is probably under-piloting this deck (Forge's AI.md says it is poor with this kind of deck), so the result cannot rank the builder against a human.**
- **She is not slow.** Commander cast in 112 of 120 games (own turn 4.0 vs precons, 4.5 vs builders); about 2.5 to 2.7 nonland spells by turn 4 vs the opponents' 2.8 to 3.1; her life and the opponent's life through her turn 5 look the same in wins and losses.
- **The games are decided on turns 6 to 8.** In her losses her life falls about 32 -> 26 -> 21 over her turns 6 to 8 while the opponent's goes about 37 -> 36 -> 34; in her wins the opponent falls 34.5 -> 29 -> 24. She declares about 14 attackers a game in wins and 4.6 in losses (never attacked in 16 of 90 losses); effect and cause are tangled, because a winning deck attacks more.
- **Unspent mana is not the reason.** Counting only lands she played, she taps about 86 to 89% of them on her turns in both wins and losses. (An earlier count was contaminated: the `Mana:` lines carry no player, so the opponent's taps were mixed in.)
- **The payoff arrives late.** X spells resolved 414 times in 120 games (3.45 a game; a floor, one line shape such as Mana Bloom's is not matched), median X 3, 39 at X=10 or more, largest Contortionist Troupe X=21. Hydras reached 16 (Wren's Run twice), 18 (Wren's Run) and 19 (Steelbane).
  Games with an X=16+ spell were won 5 of 7 (71%) vs 22% without, but that is 7 games and winners live longer. **The median own turn for an X=10+ spell is 10, and 28 of 39 came after her turn 8**, when the games are mostly decided. Fireball was cast in the builder run but not the precon run; Bag of Holding and Serene Sunset were never cast.
- **Oviya beat her 9 of 10.** Oviya had the most spells out by her own turn 4 (4.7) and first attacked on turn 2. Across all 12 opponents the link between opponent speed and Rosheen's win rate is only -0.46 (not significant at n=12), and Whiplash is as fast and hits her harder (she was at 23.2 life by her turn 6 vs 29.5 against Oviya) but she beat him 3 of 10.
  Oviya's text turns spare mana into permanent board (`{2}{G},{T}`: a Servo; `{4}{G},{T}`: an X/X Construct, X = creatures she controls), which fits the user's "better mana sync into herself". It is a reading of the card text; construct sizes were not measured.
- **Board at death** (corrected card data): median 2 creatures, power 4, 6 of 42 losses on an empty board.
- **Blocks and removal (all 120 duels, rough):** the AI declared 81 blocks for Rosheen vs 576 "didn't block" lines (about 12% of combat events) and 71 vs 365 for the opponents (about 16%); targeted spells 1.4 a game for Rosheen and 0.8 for the opponents, a targeted permanent left play right after in about two thirds of them.
  It blocks rarely and removes things; whether either choice was good is not measured.
- **Whiplash** (best of the six builder decks, 18/30 = 60%, overlapping One's 50%): his `Whenever Whiplash attacks, if he's equipped` drain resolved in 35 of 40 games (mean 4.1 a game). The drain amount X is not printed in the log, so the total was not measured. In duels it hits one opponent, not a table.

### Corrections made during this analysis (kept so they are not repeated)

- First X count pattern skipped creature spells whose log line has no card id (`Resolve Stack: Wren's Run Hydra - Creature 0 / 0 (X=16)`), so I reported about 85 X spells and "no hydra near 16". Corrected above. Always match `Resolve Stack: <name>(?: \(\d+\))? - ... (X=n)`.
- A first mana count mixed in the opponent's taps; a first opponent-life column read 40.0 every turn (name looked up with the seat prefix). Both fixed.
- "Stream of Life targeted its own commander" was wrong: the target is the player, who is named after the commander.
- "Speed explains the losses" is not supported (Whiplash and Gisa show it does not line up), and "the AI casts X too small" is weaker than first said: it does build 16/16+ hydras, late.
