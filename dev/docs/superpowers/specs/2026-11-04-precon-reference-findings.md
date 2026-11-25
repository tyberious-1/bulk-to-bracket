# Precon reference findings (2026-11-04)

The user's complaint: builds feel almost right, but the main plan lacks payoff and synergy, and the expensive
slots look like filler. The reference decks are the three precons the user plays and likes: Living Energy
(Saheeli, Radiant Creator), Lorehold Spirit (Quintorius, History Chaser) and Quandrix Unlimited
(Zimone, Infinite Analyst). This is research only: no code in `js/` changed.

## Method

- Static look at each precon (`precon_full.json`): curve, type mix, what sits at 5+ mana.
- Built each commander through the harness (`buildDeckFromScoredPool`, default modes) twice: on the
  2026-10-29 collection fixture, and on that fixture plus the precon's own cards ("recall test": does the
  builder find the cards the precon plays?). EDHREC commander pages and Scryfall data for the three
  commanders were fetched for this; the fixtures and scripts were scratch files, not committed.
- Oracle experiment: rebuilt each deck with every curve band capped at that precon's own count + 1.
- Caveats: the harness has no EDHREC theme pages (the app fetches up to 12), so builds use a smaller
  pool than the live app; one build per commander; overlap with a precon is a probe, not a quality score
  (the builder may pick fine alternatives). Quandrix's low curve is partly X spells counting as low mana
  value.

## 1. The reference curves differ a lot, and the builder's curve is one fixed table

| Nonland cards by mana value | 0-1 | 2 | 3 | 4 | 5 | 6 | 7+ | 5+ total |
|---|---|---|---|---|---|---|---|---|
| Living Energy | 4 | 13 | 15 | 14 | 5 | 6 | 4 | 15 |
| Lorehold Spirit | 5 | 16 | 21 | 6 | 11 | 2 | 1 | 14 |
| Quandrix Unlimited | 15 | 21 | 15 | 6 | 5 | 0 | 0 | 5 |
| Builder caps at 60 nonland | 5 | 12 | 13 | 11 | 8 | 6 | 5 | 19 |

The builder's caps come from `DEFAULT_CURVE_SHARES` in `js/build/type-plan.js`
({1: .08, 2: .20, 3: .22, 4: .18, 5: .13, 6: .10, 7: .09}). The only adjustments are a nudge from the
ramp target and a low-curve flag for go-wide, tribal and cantrip plans. Nothing in it reads the
commander's plan. This answers the parked question: the curve does not bend to the plan.

## 2. Top-end filler comes from that table (verified by experiment)

5+ cards in the default build: Living Energy 15 (8 not in the precon), Lorehold 17 (7 not in the
precon), Quandrix 7 (2 not in the precon). Examples with their scores:

- Zimone: Ghalta the Unstoppable (9 mana, score 0.1), Day of the Dragons (7, generic).
- Quintorius: Necron Monolith (7), Marut (8), Gate Colossus (8).
- Saheeli: Step Through, You Look Upon the Tarrasque, Aether Gale (all 5 mana, generic tier, score 18),
  Necron Monolith (7).

When a cheap band is full, the pickers take the best card in a band that still has room, so the top
bands soak up what is left. Capping each band at the precon's own count + 1 cut the non-precon 5+ cards
to 3, 1 and 1, raised mean pick score (39.0 to 39.8, 51.5 to 52.4, 24.6 to 27.0) and cut generic/theme
fallback picks in the Zimone build from 8 to 4. It barely changed overlap with the precon (37 to 38,
39 to 39, 44 to 48 of about 61), so the curve explains the filler at the top but not the next finding.

## 3. Plan cards that were in the pool and lost

Every precon card the builder skipped was a scored candidate, so none of them were missing from the
collection. The lowest pick in a mana value against the best card left out of it (scores):

- Lorehold, mana value 3: lowest picked 26.4; left out Spirit of Resilience 54.1, Laelia 51.6,
  Lorehold Archivist 51.0, Guardian of Faith 50.8. At 5: Balefire Liege 43.6 and Ao, the Dawn Sky 34.4
  left out, Primary Research 34.9 picked.
- Saheeli, mana value 2-3: lowest picked 17.5-19.9 (Disallow, Reality Shift, Arcane Denial); left out
  Reckless Fireweaver 40.5 and Rogue Refiner 37.0. Energy payoffs left out: Aetherflux Conduit (34.4),
  Aethertide Whale, Aetherwind Basker, Peema Aether-Seer, Rampaging Aetherhood. The event list in
  AGENTS.md has no energy entry, which fits, but I did not check `engines.js`.
- Zimone: X-cost cards left out at 31-37: Primordial, Goldvein and Benevolent Hydra, Stonecoil Serpent
  (29.4), Pull from Tomorrow, Silkguard. Picked instead at mana value 1-3: Elvish Mystic 8.7, Talisman
  of Curiosity 6.9, Rampant Growth 10.4, Cultivate 11.3. The build found no themes (0 theme candidates).

In every type bucket checked, an untagged plan card (role "synergy") scoring 33-54 was left out while a
role-tagged card scoring 7-30 was picked (Lorehold 3-drop creatures: Claim Jumper 28.3 picked, Spirit of
Resilience 54.1 and Laelia 51.6 left; Zimone 2-drops: Talisman of Curiosity 6.9 and Rampant Growth 10.4
picked, Open the Way and Expansion Algorithm 33.5 left).

What was tested, with each build's quotas replaced by the precon's own numbers (curve: each band capped
at the precon count + 1; types: each type bucket's target set to the precon count). Overlap with the
precon's nonland cards, out of 61 / 62 / 62:

| Build | default | curve only | types only | curve + types |
|---|---|---|---|---|
| Saheeli | 37 | 38 | 38 | 38 |
| Quintorius | 39 | 39 | 43 | 44 |
| Zimone | 44 | 48 | 44 | 47 |

So the missing plan cards are not one quota. The type targets (from the EDHREC average mix) look like
the cause for Lorehold (creatures 31 against a target of 29, instants, sorceries and enchantments exactly on
target, and the precon plays 34 creatures; fallback picks fell 13 to 8). The curve helps Zimone (X spells count
as cheap and compete for the full 1-2 bands). Neither moves Saheeli, where every bucket also landed
exactly on its target but relaxing them did not bring the energy cards back.

Not tested, and the next thing to look at: the role targets. They reserve about 33 of 60 slots for
ramp, draw, removal and wipes (for Saheeli ramp 11, draw 10, removal 9, wipe 2, leaving 27 for
everything else), and a plan card that carries a role tag competes in that bucket, not the plan one
(Aetherflux Conduit reads as draw, Rogue Refiner as draw). I did not trace which phase made each pick,
so which quota blocked a given card is still unknown for Saheeli.

## 4. Role slots hold cards that do not do the job (the follow-up the user asked for)

Checked with `cardMatchesRole` and `detectRole` on the real cards:

- Tagged removal but are graveyard recursion or graveyard exile: Sun Titan, Angel of Indemnity,
  Primary Research, Quintorius, Loremaster. Conjurer's Closet (blink) is tagged removal too. Lorehold's
  10 "removal" cards include at least 4 of these (Sevinne's Reclamation, also recursion, looks like a
  fifth; I did not run it).
- Tagged ramp: Marut (8 mana, only copies Treasures that were spent) and Gate Colossus (8 mana, cost
  reduction for Gates). They hold two of the 11 ramp slots in the Lorehold build.
- Causes are literal substrings in `ROLE_TEXT_PATTERNS` (`js/analysis/scoring.js`): "return target
  permanent", "return target nonland permanent" and "exile target" match graveyard text; "create a
  treasure" and "affinity for" match conditional or cost-reduction text.
- The Lorehold build holds no mana rock even though Sol Ring (24.5), Mind Stone, Arcane Signet and
  Fellwar Stone were in the pool. Its ramp slots went to Treasure makers (Seize the Spoils, Monologue
  Tax, Claim Jumper), Marut and Gate Colossus. Role counts look right while the cards are the wrong
  ones, which is why the slots read as fine.
- Mana rocks are missed from the other side: Arcane Signet, Fellwar Stone and Chromatic Lantern read as
  no role at all (`detectRole` returns synergy), because the ramp pattern is the literal "add {" and
  their text says "Add one mana of any color". Sol Ring and Mind Stone are tagged ramp, but they scored
  24.5 and 22.0 and lost the ramp slots to higher-scored Treasure makers.
- Two 8-mana cards holding ramp slots shows mana value is not weighed enough in the role fill. I did
  not read the role picker closely enough to say it is not weighed at all.
- Prior art: `bottomUpRole` in `js/analysis/archetypes.js` already corrects `detectRole` for the
  bottom-up builder (cost reducers and one-shot sacrifices are not ramp). The commander-first path has
  no such correction, so a fix could reuse it. AGENTS.md already lists "create a Treasure reads as
  ramp" as a known gotcha with no fix scheduled; the Lorehold build is the first measured cost of it.
  The "less to cast" and "affinity for" ramp tags are deliberate (see the comment above
  `ROLE_TEXT_PATTERNS`), so Gate Colossus is that design misfiring on a card that only discounts itself.

## Open questions for the user, ordered

1. Is it worth letting the curve follow the plan (for example from the commander's own EDHREC
   average deck, or from counting the plan's best cards per band), or only fix the top-end table?
2. Role tags: tighten the substrings (a "from your graveyard" guard) and cap what mana value a ramp
   or removal card may have, then re-run the 13-build diff?
3. Test the role targets the same way (set them to the precon's own role counts) and add a phase
   label to each pick, so the Saheeli gap gets a cause instead of a guess.
4. Energy and X-spell payoffs (Saheeli, Zimone) look unread by the engine; a commander-needs item
   for plan 2c, to check in `engines.js`.

## Followups recorded

- Role slots: do they get the best card for the mana value? Section 4 says no, in the two decks checked.
- Does the commander-first curve bend to the plan? Answered in section 1: no, only a ramp and low-curve nudge.
- Vehicle decks working "by luck": not tested.

## The user's calls (2026-11-04)

1. Fixed curve table: a real problem, marked to be addressed (the curve should follow the plan).
2. Role tags: tighten them (recursion is not removal, cost reducers are not ramp, "Add one mana of any
   color" rocks are ramp).
3. Role cards exist to get the deck to its plan; the user is not sure they should outrank a strong plan card
   for a slot. Not decided: to be tested, not assumed.
4. Energy and X-spell readings in the engine: to be investigated.

## Connection report on the precons (2026-11-04)

`connections.js` run on each precon, the default build, and the "oracle" build (precon curve and type mix
as targets), with the same `detectRole` tagging on every deck. First pass lacked energy and X-spell
channels (Living Energy's energy cards and Zimone's X spells read as unread), so both were added to
`linkOf` (`energy`: "you get {E}" gives, "pay {E}" wants; `x-spell`: {X} in the cost gives, "{X} in its
mana cost" wants).

| Commander | Deck | Orphans | Median link score | Owned cards that beat the median |
|---|---|---|---|---|
| Saheeli | precon | 0/32 | 3 | 138 |
| | builder | 0/30 | 3.5 | 226 |
| | oracle | 0/31 | 4 | 110 |
| Quintorius | precon | 2/35 | 2.25 | 450 |
| | builder | 3/28 | 3 | 266 |
| | oracle | 2/30 | 2.75 | 276 |
| Zimone | precon | 1/36 | 3 | 52 |
| | builder | 0/27 | 2.5 | 259 |
| | oracle | 0/26 | 3 | 55 |

Read: the median link score does not separate the precons from the builds (the builder is equal or
higher). The count of owned cards that would link better than the deck's median does, in two of three:
Zimone 52 (precon) vs 259 (default build) vs 55 (oracle build), Saheeli 138 vs 226 vs 110. Lorehold is the
reverse (450 vs 266) and its unread list is still 5-6 cards (Naktamun Lorespinner, Drumbellower, Indebted
Spirit, Skyclave Apparition...), so its channels need a pass too. Treat this as a partial signal: the
quota-relaxed builds get close to the precon on Saheeli and Zimone, and the default quotas leave 2-5 times
more connecting cards unused. Channel vocabulary is still a first pass.

## Second reference set: the five Foundations Commander precons (2026-11-04)

Lists saved in `dev/tools/jxa-harness/precon_foundations_2026.json` (transcribed from Wizards' page, all 316
names verified on Scryfall, each deck sums to 100). Same method as above: default build vs an "oracle"
build with that precon's own curve caps and type targets, on the 2026-10-29 collection plus the precon's
cards. One build each; the harness has no theme pages.

| Deck | Overlap default / oracle (of ~60) | Non-precon 5+ cards default / oracle | Fallback picks default / oracle |
|---|---|---|---|
| Calling All Angels | 42 / 42 | 5 / 4 | 14 / 12 |
| Keen Engineering | 35 / 38 | 4 / 5 | 23 / 20 |
| Wretched Ranks | 40 / 49 | 5 / 0 | 13 / 5 |
| Reign of Dragons | 33 / 35 | 6 / 5 | 16 / 16 |
| Tramplesaurus Rex | 34 / 38 | 9 / 5 | 23 / 17 |

What repeated:

- Top-end filler shows up in all five defaults (Necron Monolith again in Keen Engineering and
  Tramplesaurus Rex; five 5-7 mana fallback Zombies in Wretched Ranks).
- Wretched Ranks is the clearest quota case: four 3-drops scoring 74 (Lord of the Undead, Death Baron,
  Lord of the Accursed, Diregraf Colossus) were left out while fallback-theme 5-7 mana creatures scoring
  63-69 went in. With the precon's quotas the overlap went 40 to 49, non-precon 5+ cards 5 to 0, fallback
  picks 13 to 5.
- Ramp slots hold cost reducers and Treasure makers, and the "affinity for" tag puts 5-7 mana cards in
  them: Keen Engineering's ramp has Memory Guardian (5), Thoughtcast (5) and Thought Monitor (7); Reign
  of Dragons' ramp is mostly Treasure makers and Dragon discounters (Sarkhan, Gadrak, Patron of the Arts,
  Seize the Spoils, Swashbuckler Extraordinaire, Dragonspeaker Shaman, Goldlust Triad) while Sol Ring
  (29), Dragonlord's Servant (57), Carnelian Orb of Dragonkind (49) and Nogi (47) were left out; Wretched
  Ranks' ramp has Deadly Dispute, Fake Your Own Death and Undead Warchief.
- Removal slots hold 7-mana cards (Calling All Angels: Emeria Shepherd and Angel of the Ruins, both
  tagged removal).
- The connection report again does not separate precon from build. Orphans (precon / default / oracle):
  Angels 5 / 3 / 5, Keen 3 / 2 / 2, Ranks 4 / 0 / 0, Dragons 0 / 0 / 0, Ghalta 3 / 7 / 6. Owned cards
  that beat the median: Ranks 211 / 232 / 87, Dragons 404 / 143 / 110, Ghalta 388 / 414 / 520. Ghalta is
  the one deck where the builder is clearly worse (7 orphans, 23 fallback picks, mean score 27; 7 of the
  precon's 60 cards are not on the EDHREC list at all).
- Not checked: whether Tramplesaurus Rex's 5+ cards are plan cards. Ghalta's discount scales with creature
  power, so big creatures at the top may be right for that deck.

## Dig-in results (2026-11-04, after the Foundations decks)

### Corrections to the sections above

- The harness had no EDHREC theme pages, and the app merges up to 12 theme pages per commander into the
  pool (EDHREC cards 209-253 became 344-534). Rebuilt for the five Foundations decks with 53 theme pages
  fetched, the builds resemble the precons less, not more (overlap default build, without to with theme
  pages: Angels 42 to 40, Keen 35 to 27, Ranks 40 to 37, Dragons 33 to 30, Ghalta 34 to 25; cards at 5+ mana
  not in the precon: Ghalta 9 to 13, Dragons 6 to 10, Keen 4 to 8). So the real app is likely worse than the
  harness numbers in the earlier sections.
- The connection report's "7 orphans" for the Ghalta build was mostly my reader failing, not the builder.
  `connections.js` knows power only as crew: it does not read "+X/+X where X is...", doubling (Unnatural
  Growth), Earthbend (makes a creature with counters), damage equal to power (Graceful Takedown) or "power 4
  or greater" thresholds as links, though all of those connect to Ghalta's plan (its cost drops by the total
  power of your creatures). Treat the earlier orphan and "owned cards that beat the median" numbers as
  unreliable for any deck whose plan is a number.

### Mechanism found (verified with a per-pick phase trace)

- Phase 0 (the ramp/draw/removal/wipe fill) places 24-27 of about 61 slots before any plan card competes,
  and its picks have the lowest scores: mean 29-47 against 56-106 for the Phase -1 seeds.
- Those picks concentrate in the cheap bands. In the 3-drop band (cap 13), Phase 0 holds 6-11 slots at a
  mean score of 25-42 (Wretched Ranks: 11 of 14, mean 34). The plan's best 3-drops then find the band full.
- Evidence it is the band: Wretched Ranks' default build holds none of Lord of the Undead, Death Baron,
  Lord of the Accursed, Diregraf Colossus or Champion of the Perished (scores 74-77, the highest in the
  pool). With the precon's own curve and type targets, four of the five are in.
- Not the whole story: capping each role at its minimum (ramp 8, draw 8, removal 7, wipe 0) did not help.
  Overlap fell in four of five decks (Angels 40 to 35, Keen 27 to 25, Ranks 37 to 36, Ghalta 25 to 23) and
  fallback picks rose (Angels 15 to 23). The freed slots went to generic fallback cards, not plan cards, so
  something else keeps plan cards out when slots open (candidate: bucket floors and the Phase 1b rules).
  Not yet traced.
- Reign of Dragons: Dragonlord's Servant (57), Carnelian Orb of Dragonkind (52), Nogi (51) and Goddric (42)
  are out even with the precon's quotas, so a different blocker applies there. Not yet traced.

### Where the builder does not read how cards connect

- **Commander text:** Ghalta, Primal Hunger reads "costs {X} less, X = total power of creatures you control".
  The builder took the commander's creature type (`wantsTribal`, tribe dinosaur) and returned empty engine
  needs, although EDHREC lists "power matters" and "stompy". The precon is a power deck with a few
  Dinosaurs. Raw power is not the gap (printed power across creatures 147 builder vs 130 precon; 19 vs 19
  creatures with power 4 or more); what the builder misses are the cards that reward power (Colossal
  Majesty, Shamanic Revelation, Thickest in the Thicket, Challenger Troll, Overwhelming Stampede,
  Monstrous Onslaught; scores 14-23) and the 3-drops that supply it (Steel Leaf Champion, Rhonas).
- **Cards that hurt the plan:** Day of the Dragons (exile all creatures you control) is in the Keen
  Engineering build as its wipe, in a deck of artifact creatures. A "wipe" that does not hit the opponents'
  side is anti-synergy, not a role.
- **A tribe's own lords and cost reducers:** the cards with the highest scores in the pool (Zombie lords,
  Dragon cost reducers, artifact lords such as Master of Etherium and Chief of the Foundry) are the ones
  squeezed out when the cheap bands fill.
- **Numbers on the card:** a card can connect through its printed power or toughness, a threshold, or a
  count (Forests, Dinosaurs), none of which a keyword match sees.

### Next steps (not started)

1. Teach `connections.js` power as a quantity (supply: printed power, pumps, counters, doubling, anthems;
   demand: totals, greatest, thresholds, "equal to its power") and rerun on the 8 precons.
2. Trace why freed slots go to fallback cards (the role-minimum result).
3. Decide, with the user, whether Phase 0 should take cheap-band slots from plan cards of much higher score.

## How the user reads a connection (2026-11-04) -- reference this before designing a reader

The walkthrough that explained why the keyword reader fails. Cards: Ghalta, Primal Hunger ({10}{G}{G}, 12/12,
"costs {X} less, X = total power of creatures you control") and Unnatural Growth ("at the beginning of each
combat, double the power and toughness of each creature you control until end of turn").

- A card is a small program with if-statements. One card (Unnatural Growth) does two jobs depending on state:
  with Ghalta in hand it cuts the cost (a 5/5 becomes 10/10, cost {G}{G}; a 2/2 plus a 3/3 doubled also
  reaches 10; a lone 2/2 without it gives {8}{G}{G}); with Ghalta on the battlefield it takes 12 power to
  24, past the 21 commander-damage line.
- The connection is a number crossing a threshold, not a shared word. Timing matters (beginning of combat,
  so Ghalta is cast after it).
- First question for any card: where does it fit in the web of cards already in mind (commander plus
  chosen cards)? Second: does it pay off when it enters (once) or while it is on the field (ongoing)?
- The builder does the reverse: it scores each card alone (EDHREC, role tag, theme) and checks fit
  afterward, so a card with a strong link into the plan can lose to a good-looking one that links to nothing.

Open question put to the user: does one strong link (Unnatural Growth to Ghalta) justify a card, or should it
link to several things?

## The Tramplesaurus Rex web -- best version of the understanding so far (the user, 2026-11-04)

Built with the user, card by card, from the mono-green Foundations precon. Read this before designing a reader or
a scoring change. The deck's plan is a number (total power) and the cards are the web around it.

**The center:** Ghalta, Primal Hunger ({10}{G}{G}, 12/12 trample, costs {X} less, X = total power you control).
It wants total power >= 10 to cost {G}{G}. In play it threatens 21 commander damage.

**Cards in the web, by what they do for the number**
- *Supply power:* Steel Leaf Champion (mv3 {G}{G}{G}, 5/4; power 5 on turn 3; can't be blocked by power 2 or
  less, so it forces a real chump blocker; the three G pips only work in a nearly mono-green deck).
  Rishkar, Peema Renegade (enters: +1/+1 counter on each of up to two creatures, permanent power; stays:
  creatures with counters tap for {G}). Thickest in the Thicket (enters: X counters on a creature, X = its power,
  i.e. doubles it). The big creatures themselves.
- *Multiply power:* Unnatural Growth ({1}{G}{G}{G}{G}, mv5, so turn 5 at the earliest without ramp; doubles power
  and toughness at the beginning of each combat until end of turn). Cast Ghalta after it. Does NOT feed
  upkeep checks (it is gone by the next upkeep).
- *Ramp that reads the threshold:* Ilysian Caryatid (mv2; taps for 2 if you control power 4+). Turn 2 Caryatid,
  turn 3 Steel Leaf Champion, turn 5: 5 lands + Caryatid's 2 = 7 mana for Unnatural Growth then Ghalta for {G}{G}
  (best case, nothing removed).
- *Draw engines that read power or creatures (ongoing; they stack, two out is double, one out beats none):*
  at a check each turn: Colossal Majesty (upkeep, power 4+), Thickest in the Thicket (end step, greatest power);
  when a big creature enters: Elemental Bond (power 3+), Garruk's Packleader (power 3+), Garruk's Uprising
  (power 4+, also gives trample); from what creatures do: Beast Whisperer (creature cast), Curious Altisaur
  (Dinosaur combat damage), Elder Gargaroth, Ripjaw Raptor. Colossal Majesty keeps cards in hand because a 4/4+
  is usually out at upkeep.
- *One-shot payoffs that read the board:* Rishkar's Expertise (draw = greatest power, free spell mv5 or less),
  Shamanic Revelation (draw per creature), Overwhelming Stampede (+X/+X and trample, X = greatest power;
  pairs with Unnatural Growth or stands alone as a finisher; trample is what pushes damage past blockers).
- *Win routes:* commander damage (21) and any other damage; counters and doubling count for both.

**What this teaches about reading a card (all of these, not only words):**
1. A number the card reads or changes (total, greatest, per creature) and the threshold it must cross.
2. State and zone: in hand versus on the battlefield (Unnatural Growth: cost cut or 24 power).
3. Timing: when it acts (beginning of combat, upkeep, end step) and the first turn it can happen (mana value + ramp).
4. Enters (once) versus stays (ongoing). Many cards do both (Rishkar, Garruk's Uprising).
5. Other jobs beyond the number: forcing chump blocks, trample, evasion.
6. Castability: color pips against the mana base (GGG).
7. Reliability by redundancy: plan for the best case, then add cards that do the same job; one is better than
   none, two doubles the benefit. This reverses the builder's redundancy penalty for engine effects.
8. A card is judged by where it fits in the web already in mind, never alone.

**Not in this deck's own text, to keep in mind:** the builder left out Colossal Majesty, Elemental Bond,
Shamanic Revelation and Thickest in the Thicket in its default Ghalta build.

## The five centers and the Sai web (the user, 2026-11-04; confirmed or corrected card by card)

Foundation for the builder work: each mono-color Foundations precon has a center (what its commander reads),
and the rest of the 99 is a web around it. Read this with "The Tramplesaurus Rex web" above.

| Deck | Center (what the commander reads) | Notes from the user |
|---|---|---|
| Ghalta (Tramplesaurus Rex) | total power you control (cost reduction; 21 commander damage) | see the Tramplesaurus Rex web |
| Gisa (Wretched Ranks) | an exchange: sacrifice a creature, get X 2/2 Zombies (X = its power). A 1/1 becomes a 2/2, a 2/2 becomes two 2/2s, and the new Zombie is the next sacrifice. Black is the color of exchanges. | Untap effects give several activations a turn. Cards in the 99 probably trigger when Zombies enter, and one activation makes X Zombies, so X triggers. |
| Lathliss (Reign of Dragons) | nontoken Dragons entering (each makes a 5/5 flying Dragon token); {1}{R} pumps every Dragon | Confirmed. Dragons fly: they can only be blocked by creatures that can block fliers. |
| Giada (Calling All Angels) | the count of Angels, cumulative (the nth other Angel enters with n counters); her mana only casts Angels | Confirmed: more Angels is better, plus Angel payoffs ("payoff" = the benefits of playing an Angel). The user played against it; the deck has tools for handling fliers, a weak spot of the plan. |
| Sai (Keen Engineering) | artifact spells cast (each makes a Thopter); {1}{U}, sacrifice two artifacts: draw | the user's favorite of the group. See below. |

**Delivery is part of every web:** trample (Ghalta), flying (Lathliss, Giada, Sai's Thopters), evasion and
unblockable (Steel Leaf Champion, Whirler Rogue, Kappa Cannoneer).

**Sai web (cast and enter are different events):**
- *Cast* fires for artifact spells you cast only, and still fires if the spell is countered (rule 601.2i:
  "the spell becomes cast. Any abilities that trigger when a spell is cast ... trigger at this time"; checked
  against a third-party mirror of the Comprehensive Rules, not Wizards' own document). Cast payoffs: Sai,
  Vedalken Archmage.
- *Enter* fires for any artifact arriving however it gets there. Enter payoffs: Kappa Cannoneer, Ichor Wellspring.
- One artifact spell that resolves = one cast + two enters (the spell and its Thopter). Thopters are created,
  never cast, so they feed enter triggers and the artifact count, not Sai or the Archmage. Whirler Rogue (not an
  artifact) = two enters, no cast. Master Transmuter puts an artifact in without a cast: an enter, no Thopter.
- The number is the artifact count: Master of Etherium, Darksteel Juggernaut and Broodstar are as big as it;
  Adaptive Omnitool, Nettlecyst, Tamiyo's Logbook scale with it; affinity cards (Broodstar {8}{U}{U} minus
  artifacts, Memory Guardian, Thoughtcast, Thought Monitor) get cheaper with it. The same shape as Ghalta.
- Ramp and draw are plan cards here: Sol Ring, Mind Stone, Thought Vessel, the Myr, Ornithopter are artifacts
  (each cast makes a Thopter); sacrifice-for-a-card artifacts are fodder for Sai's own exchange. Affinity cards
  are payoffs, not ramp.
- More casts per turn: Etherium Sculptor, Foundry Inspector (artifact spells cost 1 less), Shimmer Myr (flash).
- Growth: Steel Overseer, Master of Etherium, Chief of the Foundry. Wipes: All Is Dust (sacrifices colored
  permanents: spares artifacts, hits Sai and the blue creatures); Nevinyrral's Disk hits your own artifacts.

## Why the builder does not build these webs (2026-11-04, measured on the Foundations decks)

**1. The commander reader makes one guess: a tribe or an EDHREC theme tag.** What the builder concluded for
each commander (full EDHREC data, theme pages included):

| Commander | Builder's strategy profile and engine needs | Matches the user's center? |
|---|---|---|
| Giada | tribal Angel, go-wide, tokens; needs: none | yes (Angel count), but the cumulative counters and Angel-only mana are unread |
| Lathliss | tribal Dragon; payload type dragon | yes |
| Gisa | tribal Zombie, wants sacrifice; payload type zombie | partly: the exchange chain, untaps and Zombie-enter triggers are unread |
| Sai | tribal **Thopter**, go-wide; event "cast" (any spell) | no: his center is artifact spells cast and the artifact count |
| Ghalta | tribal **Dinosaur**; needs: none | no: his center is total power |

The reader fits decks whose center is a creature type (Giada, Lathliss) and misses the decks whose center is a
number or an exchange (Ghalta, Sai, Gisa).

**2. Sai build against the precon (59 nonland cards each):** artifacts 43 precon vs 40 builder (the artifact
theme works); cards that scale with the artifact count (lords, "number of artifacts", affinity) 11 vs 5;
Thopter makers 4 vs 9; cost reducers and enter payoffs 8 vs 6. Left out: Master of Etherium (41), Chief of the
Foundry (40), Darksteel Juggernaut (24), Broodstar (23), Memory Guardian (24), Thoughtcast (25), Shimmer Myr (37),
Mind Stone (28), Hedron Archive (23), Ichor Wellspring (26). The Thopter tribe guess explains the Thopter makers
(Stridehangar Automaton and Etherium Spinner score 88, Retrofitter Foundry 77) while the count payoffs score
23-41.

**3. Each card is scored alone.** Nothing asks whether a card feeds the number the commander reads; fallback-theme
matches (53-88) beat web cards that need the count.

**4. Quotas and role tags crowd the web.** Phase 0 filled removal slots in Sai's deck with blue interaction
scoring 21-28 (Ravenform, Sound the Trumpets, Divert Disaster, Ice Out) and two wipes that hurt the plan (Day of
the Dragons, The Phasing of Zhalfir). The affinity payoffs (Broodstar, Memory Guardian, Thoughtcast) carry the
ramp tag, so they compete in the ramp bucket. Top-end filler again: Necron Monolith, Enchanted Carriage,
Hulldrifter, Skybox Ferry, Koilos Roc, Lost Days (5-7 mana, score 41-66).

**5. Repetition is penalized** (fallback tier), the opposite of how the user stacks engines.

### What a builder that understood the web would need (not started)
1. Read the commander's center from its words, as a quantity or event (total power; artifact spells cast;
   Angels you control; sacrifice for X Zombies), not just a tribe.
2. Read each card as supplying, multiplying or rewarding that center, with cast vs enter kept apart.
3. Score a card by its links into the web (and its first-turn timing), not alone.
4. Let a strong link beat a generic role card, and credit repeating an engine.

## Owned-commander tests: does the build meet the web? (2026-11-04)

Method (the user's idea): instead of matching a precon, build a commander with a similar center from the user's own
inventory (`owned_raw.json`, EDHREC pages plus theme pages fetched), write the web first, then check which owned
web cards the builder picked. The Foundations precons stay as the calibration. Order agreed with the user: Sai (same
card as the precon), Ghalta the Unstoppable (similar but different center), then Whisper, Blood Liturgist
(black, unfamiliar strategy; the user owns no Gisa; Tormod was built first as a stand-in and is set aside).
No `js/` file changed. The drivers are saved: `precon_research/owned_commanders.py` (fetch, drivers, quota switches) and
`precon_research/web_ledger.py` (picked and left-out cards per web class; see the README).

**Sai (blue).** The web exists in the pile and the builder misses most of it.
- Picked: 13 of 77 owned cards that name artifacts as a condition. Left out, by job: a second cast engine
  (Efficient Construction, EDHREC score 58), Patchwork Automaton, Traxos, Lady Octopus; enter payoffs (Rook Turret,
  Skyswimmer Koi, Mechan Assembler, Replication Specialist); count scalers (Chief of the Foundry 40, Filigree
  Attendant, Shambling Suit); affinity and improvise cards (Somber Hoverguard, Steelfin Whale, Gearseeker Serpent,
  Valkyrie Aerial Unit); artifact-only mana (Automated Artificer, Cargo Ship, Guidelight Optimizer, Renowned
  Weaponsmith). Most are not in the EDHREC pool, so only the Thopter theme could bring them in.
- In their place: six generic instants at score 18-21 (Negate, Experimental Augury, Ray of Command, Scattered
  Thoughts, Zimone's Hypothesis, Whirlwind Technique); Day of the Dragons and The Phasing of Zhalfir hold the wipe
  slots (role-tag error); Etherium Sculptor (a real cost reducer) is tagged ramp.
- Why Efficient Construction stays out (relaxing one quota at a time): enchantment target 4 to 9: still out;
  curve caps off: still out (Chief of the Foundry in); plan-card (synergy) cap 30 to 40: still out (Mechan Assembler
  in); all three together: in, along with new filler (Bar the Gate, Essence Anchor, Filter Out, ...). Three
  average-deck quotas each block part of the web, and freed slots also take filler.

**Ghalta the Unstoppable (green).** Center: cost reduced by the greatest power among your creatures; gives
trample. Not a Dinosaur theme (user). EDHREC has about 5 decks, so almost everything comes from the fallback.
- The builder read it as tribal Dinosaur: it picked Ornery Dilophosaur (power 2), Grazing Whiptail (3), Ravenous
  Daggertooth (3) and left out about 50 owned green creatures with power 6 to 9 (Endless Wurm 9/9 for 5, Quilled
  Slagwurm 8/8, Saber-Tooth Moose-Lion 7/7 for 6).
- Left out and in the web: doublers and scalers (Mightform Harmonizer, Flopsie, Peema Aether-Seer, Ambitious
  Dragonborn, Freelance Muscle, Monstrous Onslaught); cards that ask for power 4 or more (Owlbear Shepherd,
  Raucous Audience, Wargling, Heir of the Wilds, Territorial Boar, The Earth King, The Boulder); second trample
  granters (Nylea's Forerunner, Maze Behemoth, Overcome, Storm the Seedcore, Vivien, Arkbow Ranger); about 25
  fight/bite removal spells that scale with power (3 picked).
- In their place: nine generic tricks at score 20-21 (Chatterstorm, Fangs of Kalonia, Gaea's Gift, Regrowth, Wrap
  in Vigor, Blunt the Assault, Fertilid's Favor, Invigorating Surge, Tamiyo's Safekeeping). The generic tier is
  closed to creature slots (2026-11-03 change) but open to instants and sorceries.
- Worked: Unnatural Growth, Colossal Majesty, Garruk's Uprising and Rishkar's Expertise came from EDHREC.

**Whisper, Blood Liturgist (black), first read.** `{T}, sacrifice two creatures:
return target creature card from your graveyard to the battlefield.` the user's reading of the payoff (2026-11-04): send
creatures to the graveyard and put something better back, usually a bigger creature. Web: fodder (two bodies per
activation, better if each pays when it dies), big or valuable creatures worth bringing back (an enters trigger
fires again), outlets and death payoffs, graveyard fill. Build (356 EDHREC cards): about 28 plan cards, rest role cards; of 68 owned creatures at
mana value 5+ with an enters trigger, 7 picked; of 69 owned mana-value-3-or-less creatures with a death trigger,
5 picked; of 40 death payoffs, 4 picked. Same shape as the other two: the commander reads as a theme and the web
cards compete as unrelated cards.

**Common finding across the three:** the owned pile holds the web; the builder reads each commander as a tribe or
theme, the web cards carry no tag, quotas from average decks (curve, type, plan-card cap) hold the slots, and the
slots that are not web cards go to generic filler or role-tagged cards. Open: why relaxing one quota brings in
filler (the role-minimum result again), and how to read a center as a number or event.
