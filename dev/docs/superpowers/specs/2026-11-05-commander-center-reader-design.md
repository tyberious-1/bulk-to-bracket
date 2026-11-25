# Reading a commander's center: design proposal (2026-11-05, NOT approved, no `js/` change made)

Context: `2026-11-04-precon-reference-findings.md` (read "The Tramplesaurus Rex web" and "Why the builder does not
build these webs") and AGENTS.md "How cards connect". The user's call: find the commander's center first. This
document says what the reader sees today, what is missing, and a proposed shape. It needs the user's approval
before any `js/` change; branch first.

## 1. What the reader gives today (run on the commanders' real text, `tagTextAbilities` + `getCommanderEvents`)

| Commander | Center (the user's reading) | What the labels say today | Gap |
|---|---|---|---|
| Ghalta, Primal Hunger | total power you control | static with **no effect label**; trample | the cost clause "costs {X} less, X is the total power" is not read at all |
| Ghalta the Unstoppable | greatest power among your creatures | the same unlabeled static; trample; `anthem-lord, grant-keyword` | same; "greatest" vs "total" is not told apart; the trample grant is read (delivery) |
| Sai | artifact spells cast; the artifact count | trigger `cast-spell`, `create-token`; event `cast` (any spell) | the **filter is lost** (artifact spells only); the artifact count is not read; "sacrifice two artifacts" is a cost with no type |
| Ghoulcaller Gisa | exchange: sacrifice a creature, get X 2/2 Zombies, X = its power | activated, cost `sacrifice-other`, effect `create-token` | the loop (output is a creature, which is the next input) and the "X = sacrificed power" link are not read |
| Lathliss | nontoken Dragons entering | `etb` trigger, `create-token` | the type filter "another nontoken Dragon" is read only through the tribe guess (it works, by luck of being a tribe) |
| Giada | the count of Angels, cumulative | static `anthem-lord, pump, counters` | "for each Angel you already control" (a count) and "mana only for Angels" are not read |
| Whisper (owned, black) | sacrifice two creatures, return a creature card (usually bigger) | activated, costs `tap, sacrifice-other`, effect `return-from-graveyard:creature` | the return is read; what it wants around it (fodder, big return targets, enter triggers, graveyard fill) comes only from the generic graveyard enablers |

So the reader already sees verbs. It does not see **which number**, **which type filter**, or **what loops**.

## 2. Proposed: a center record on `needs`

`parseCommanderNeeds` would add `needs.center`, a list (a partner pair has two). Three kinds, matching the five
centers and the three owned commanders. Nothing here is a card list; every field comes from the commander's own words.

- **quantity** `{ kind: "quantity", measure, filter, uses }`
  - `measure`: `total-power`, `greatest-power`, `count` (of a type: artifact, Angel, creature), `devotion` (exists today).
  - `uses`: `cost-reduction` (Ghalta both, affinity-like), `scaling` (Giada's counters), `win` (commander damage is not read from the text; leave out).
  - Read from: "costs {X} less ... where X is the total/greatest power", "for each <type> you control", "the number of <type>".
- **event** `{ kind: "event", event, filter, once|repeatable }`
  - Today's events (`cast`, `landfall`, `draw`...) plus a **type filter**: Sai = `cast` + artifact; Lathliss = `enter` + nontoken Dragon; Gisa's payoffs (cards in the 99) = `enter` + Zombie.
  - Cast and enter stay separate events (Sai web).
- **exchange** `{ kind: "exchange", pays, gets, loop }`
  - Gisa: pays a creature (power read), gets Zombies (creatures), so the output is a new input (`loop: true`).
  - Whisper: pays two creatures, gets one creature card back from the graveyard (a better one). Loop only if the returned creature itself is fodder or an outlet.
- **delivery** (all kinds): flying, trample, evasion the commander gives or the deck needs (Ghalta the Unstoppable grants trample; Sai's Thopters fly).

## 3. What a card's link into the center would be (the "program" questions, as fields)

For a quantity center: **supplies** the number (big or many bodies, counters), **multiplies** it (doubling, "X = its power"),
**ramps at the threshold** (taps for more when the number is high), **reads the same number** (a payoff that scales with it:
draw = greatest power, affinity), **delivers** (trample, evasion). For an event center: **produces** the event (artifact
spells; Zombie makers), **pays off** the event (enter triggers on the type), **repeats** it (untap, extra casts, cost reducers).
For an exchange center: **fodder**, **outlet**, **big return or payoff targets**, **death or enter payoffs**.

Most of these classes already have partial readers (`getEventProducers`, `connections.js` channels, engine classes);
the new part is the quantity channel (power and counts, not only crew) and the type filter on events.

## 4. How the score and the slots would change (to test, not yet decided)

1. A link into the center is a **plan card**: it counts toward the plan-card target (about 27-30) instead of
   competing as an unrelated card, and is exempt from the curve caps and type-bucket targets (the three quotas that
   together kept Efficient Construction out of Sai's deck).
2. The link bonus is larger than today's event bonus (flat 6 / 3) for a card that links to the **number** and
   smaller for a card that merely names the type. Several links on one card add up with a cap, like `getEngineBonus`.
3. Redundancy: a second engine of the same effect is not penalized when it reads the center (the user's insurance rule).
4. Role cards (Phase 0) keep their slots only if their score is not far below a plan card that would take it
   (the user's call 3; tested separately from this design).

## 5. Test plan (no tuning for one commander)

1. Reader only first, no score change: print `needs.center` for the seven commanders above; the user confirms each is his reading. (This is cheap and can happen before any scoring work.)
2. Then the link readers, checked with `web_ledger.py` on Sai, Ghalta the Unstoppable, Whisper: more of the owned web cards picked, filler count not up.
3. The five precons (`precon_research/report.py`) for overlap and the 13-build diff against
   `baselines/2026-11-03-13-builds-roles-tiebreak-events-on.json` / `-off.json`: builds whose commander has no center must not change.
4. Switchable like Event Engines, so "off" reproduces the baseline exactly.

## 6. The user's answers (2026-11-05)

- Kinds (quantity, event, exchange, delivery): good. Step 1 is print-only first: good.
- Sai: a second cast engine is insurance; cost reducers (Etherium Sculptor, Foundry Inspector) and artifact-only mana are plan cards.
- Whisper: "better" means worth more than what was sacrificed. Examples: two 1/1s for a 4/4, or a lord that grants +1/+1 to all Zombies when Zombies are the majority creature type. So a return target is judged by its size and by what it does to the creatures already there (a lord that reads the majority type is a quantity link into the board).

Open (my guess): the "majority creature type" lord reads a count of one type, so the quantity kind covers it (`count` with a type filter).

## 7. First implementation and measurement (2026-11-05, branch `commander-center-reader`)

Built: `getCommanderCenter` (print-only reader, `needs.center`), `getCenterLinks` / `getCenterBonus` (engines.js; weights are
first guesses, cap 20, added inside `getEngineBonus`), and one quota change: a card whose center bonus is 14 or more
(`CENTER_STRONG_LINK`) skips the curve band cap (`curveHasRoom(curvePlan, cmc, card)`, `centerWeight` set in `deck.js`).
The type targets and the plan-card cap are NOT changed yet. The Event Engines switch off also empties the center.

Measured (links read with `precon_research/center_links.js`; "strong" = bonus 14+; owned cards in colors that are strong:
Sai 25, Ghalta the Unstoppable 25, Whisper 41):

| Build | strong-link picks before | after |
|---|---|---|
| Sai (owned) | 7 | 14 |
| Ghalta the Unstoppable | 3 | 5 |
| Whisper | 6 | 9 |

- 13-build diff vs `2026-11-03-13-builds-roles-tiebreak-events-on.json`: 11 unchanged, Kaza (center: Wizard count) and
  Eriette (Aura count) change by 3 cards each. With the switch off: all 13 identical to the events-off baseline.
- Five precons, overlap with the precon's nonland cards: Ghalta (precon) 25 -> 32 of 60; Sai 27, Giada 40, Gisa 37, Lathliss 30 (unchanged).
- Tests: 25 suites OK, one new test.

Known weak spots (not tuned, on purpose): the power reader is noisy (small cards that merely mention power read as
"reads-power"; "doubles or scales power" matches loose "where X is ... power" wording); Ghalta the Unstoppable's build is
already at 34 creatures against a target of 32, so extra bonus only reorders creatures; Whisper's "better than what was
sacrificed" is read only as mana value 5+ or an enters trigger. Next: tighten the power patterns, then test relaxing the
type target for strong-link cards, and judge by reading the picks, not by counts alone.

## 8. Second pass (2026-11-05): reader fixes and Phase 5 center upgrades

- Reading the cards showed the power reader is mostly right (Freelance Muscle, Skanos, Bouncer's Beatdown, Mightform Harmonizer,
  Goreclaw, Raucous Audience, Ambitious Dragonborn all do read power); only "reads-power" on "power is greater" was dropped and
  "multiplies-power" narrowed to X-counters / +X/+X / draw X / damage X where X is a power.
- Whisper: a return target is a creature of mana value 5+ (6) or mana value 3-4 with an enters trigger (3); before, every
  creature with an enters trigger counted equally (40+ cards at the same weight).
- New link `boosts-type` (8): an anthem, pump or counters effect on the center's type (Steel Overseer, Chief of the Foundry).
- Deck.js Phase 5: after Phase 4, up to `CENTER_UPGRADE_MAX` (8) strong-link candidates (bonus 14+) replace the lowest-scoring
  deck card that has a center bonus under `CENTER_LINK_KEEP` (3), is not a fun pick or equipment, and holds no support role that is
  still at or under its target. The candidate must score above the victim.
- Measured (strong-link picks of the owned strong-link cards): Sai 8 -> 25 of 30, Whisper 2 -> 10 of 10, Ghalta the Unstoppable
  3 -> 10 of 20. Curve average moved 3.63 -> 3.58 (Sai), 3.31 -> 3.64 (Whisper), 3.61 -> 3.84 (Ghalta). 13-build diff unchanged
  from section 7 (11 same, Kaza and Eriette by 3 cards each; switch off reproduces the baseline). Precon overlap: Ghalta 25 -> 30,
  Sai 27 -> 25, the other three unchanged.
- Open: the Sai precon lost Whirler Rogue and Myr Battlesphere to stronger links (Whirler Rogue is an enter payoff, a second event of
  the Sai web that the reader does not read from the commander's words); Ghalta the Unstoppable has 10 of 20 strong links picked and
  generic filler 12 -> 16 (victims are chosen by score across sources on different scales); Whisper's lord-for-the-majority-type
  link is not read; weights are untuned.

## 9. Third pass (2026-11-05): reader fixes, role-tag experiments, Phase 5 victim rule and cap

Branch `commander-center-reader`, commits `66d5bfc`, `95b74d7`, `27ae96e`, `39c7ce6`. Not merged to main.

**Reader fixes (`66d5bfc`).** The death-payoff regex had a `\\b` typo and never matched; fixed. New links `reanimates` (a second way to return a creature)
and `comes-back` (fodder that returns itself). `WIPE_SCOPE_NARROWER` gained `^\s*you control\b`, so "exile all creatures you control" (Day of
the Dragons) is not a wipe (Callaphe's reference build changes by that one swap).

**Role-tag experiments (nothing shipped).** The user's call: artifact and enchantment removal is strong removal (breaking a web piece is like removing a commander),
so it is never tagged weak. Two tag changes were tested over the three owned builds and the 13-build diff and not kept:
- Self-hitting edicts ("each player sacrifices a creature", Plaguecrafter) as not-a-wipe: harmless, 2 of 13 builds change, Tormod's build gains The Phasing of
  Zhalfir as its wipe; no clear gain. History: both the edict-as-wipe tag (2026-09-08, "clear three bodies at a four-player table") and the cost-reducer-as-ramp tag
  (2026-09-14) were reasoned, never measured.
- Cost reducers ("less to cast") not counted as ramp: 12 of 13 builds change; Whisper strong links 18 -> 14, Ghalta no-link cards 17 -> 19. The old tag keeps
  useful cards in the ramp slots; rejected.

**Phase 5 victim rule (`95b74d7`).** Tracing Cragplate Baloth (link 18, score 41.6) showed it lost to Reptil, Dinomorpher (no link, score 48.6): the
candidate must out-score the victim, and a Dinosaur theme card outscores a power-6 card with a link, because the commander is still read as a tribe by
the theme tier. Now a victim with no link at all (centerWeight 0) is replaced by any strong-link candidate; a weakly linked victim still has to lose
on score. Ghalta strong links 10 -> 13, no-link 17 -> 14; Sai and Whisper unchanged; 13-build diff unchanged.

**Phase 5 cap (`27ae96e`).** `CENTER_UPGRADE_MAX` 8 -> 12. Cap 16 gave the same decks as 12. Ghalta 13 -> 15 strong links (Bribe Taker, Dread Linnorm in; Grazing
Whiptail, Ravenous Sailback out); Sai +1; Whisper +2; 13-build diff unchanged.

**Whisper readers (`39c7ce6`).** New links `graveyard-leave-payoff` (8: "whenever cards leave your graveyard", for a commander that returns
cards; Tormod) and `fodder-dies` (3: a creature whose own dies trigger makes a token, draws or returns a card; Doomed Dissenter, Girder Goons). Weight 6
for fodder-dies moved 11 Whisper cards and pushed out big return targets, so 3 was kept (untuned). Result on Whisper: Tormod, Doomed Dissenter, Girder Goons,
Bloodcrazed Socialite in; Artisan of Kozilek, Skyclave Shadowcat, Madame Masque, Nyla out: a trade, not a clear win. Sai swaps Pinnacle Kill-Ship for Hulldrifter
(not understood: why a fodder link reaches Sai's artifact creatures is not traced). Ghalta and the 13 builds unchanged.

**Ghalta no-link check.** Of 17 no-link cards: 7 Dinosaur theme bodies (1-3 power), 3 artifact/enchantment removal (valid), 4 ramp, 2 draw, Survey Mechan,
Swiftfoot Boots. Two small reader gaps, not fixed: equipment pump (+N/+0) and trample granted through an attack trigger (Hunter's Axe), and "becomes base power and
toughness N" (Reptil). The power cutoff for `supplies-power` is 4, so three-power Dinosaurs correctly read as no-link.

**Open.** Six strong-link Ghalta cards were still left out at cap 8 (now fewer; recheck). Weights untuned; the Phase 5 victim rule is a stopgap for a theme
bonus that still reads Ghalta the Unstoppable as a Dinosaur tribe. Sai's enter-payoff side and Whisper's majority-type lord are unread. The Phasing of Zhalfir is
still in Sai's deck. Role tags still wrong for plan cards (Cherished Hatchling as removal, Deadly Dispute as ramp). Not rerun since the last fixes: the five-precon
report and the Event Engines off-switch baseline.

## 10. Merge, two-color builds, Dina's second trigger, playtests (2026-11-05 to 06)

**Merged to main** as `5edcabb` (local). Checks before the merge: Event Engines off matches the 2026-11-03 events-off baseline except Callaphe (the
wipe-tag fix, not the center reader). Five precons, overlap with the precon deck (default build), before -> after: Giada 40 -> 40, Sai 27 -> 25, Gisa 37 -> 33,
Lathliss 30 -> 30, Ghalta 25 -> 30. The Gisa drop: five Zombie or graveyard cards (Eternal Taskmaster, Cemetery Recruitment, Mire Triton, Noxious Ghoul, Zombie
Ogre) were replaced by four death payoffs (Nightmare Shepherd, Harvester of Souls, Heirloom Auntie, Skyclave Shadowcat) and others. Gisa's center reads as an exchange
and does not know the tokens are Zombies, so Zombie makers and payoffs have no link (the "Gisa Zombie-enter payoffs" item). Overlap is a probe, not a quality score.

**Two-color commanders.** The 254 owned two-color legendary creatures were scanned; three with a clear center were built on main: Hamza, Guardian of Arashin (GW,
quantity: creatures with +1/+1 counters), Dina, Soul Steeper (BG, exchange plus a lifegain trigger), Iron Man, Master of Machines (UR, artifact count plus an artifact-enters
draw). Mana bases (39 lands) were sound: sources per color 21/21 (UR), 22/20 (GW), 20/18 (BG) against pips 33/20, 47/24, 44/30. Hamza was the cleanest build (10 strong,
40 weak links). Iron Man's plan cards (Sai, Saheeli, Whirler Rogue, Thopter Spy Network, Forensic Gadgeteer) had no link because the "artifact enters" event is not read;
Dina's lifegain drain was not read at all.

**Dina's second trigger (`5dd5c55`).** `getCommanderCenter` now reads "whenever you gain life" as `{kind: "event", event: "gain-life"}`. Links: `event-payoff` (10) for
another "whenever you gain life" card, `makes-event` (6) for lifelink or a source that keeps gaining life (a recurring trigger, an activated ability that does not use
the card up), `makes-event-once` (2) for one gain from a spell, an enters trigger or a sacrifice, `makes-type-weak` (3) for Food. The first version gave every life gain 6
and flooded the build with one-shot spells (Heaped Harvest, Rise of the Ants); splitting repeatable from one-shot fixed that. Result: 25 -> 20 card swaps shrank
to a build with lifegain payoffs (Lurking Roper, Epicure of Blood, Pest Mascot, Titanbones) and engines (Sinister Monolith, Scavenging Ooze, Tablet of the Guilds)
at the cost of seven death payoffs; no other build moved (3 owned builds and the 13-build diff unchanged).

**Playtests (the user, goldfish in the app, live EDHREC data).** Dina "looks pretty good". Iron Man: "the best version yet": Saheeli, Pinnacle Emissary, Thopter Fabricator,
Necron Monolith and Etherium Sculptor on the battlefield with a stream of Thopters; Enraged Giant (Improvise) did fit the deck; the collection-fallback filler spells
(Homesickness, Intrude on the Mind, Practical Research) were the weakest cards in hand. The reader's weights under-ranked cards the deck picked anyway (EDHREC and the theme tier
supplied them), so link counts are a weak signal; the playtests are the real one.

**Baselines.** `baselines/2026-11-05-13-builds-center-reader-events-on.json` and `-events-off.json` replace the 2026-11-03 pair as the reference builds.

**Open.** Iron Man's artifact-enters event; Gisa's Zombie type on the tokens; the Sai enter-payoff side; Whisper's majority-type lord; Hunter's Axe pump and
"becomes base power and toughness N"; filler spells from the collection-fallback tier; link weights untuned (fodder-dies 3, lifegain 6/2, Phase 5 cap 12); a theme tier that
still reads a non-tribal commander as a tribe (Ghalta the Unstoppable as Dinosaurs).

## 11. Coverage work, 2026-11-11 (the user: "fix by category", "reading the card explains the card")

The center reader started the day reading about 83 of 606 owned legendary creatures (most of the 245 that "read" read only a keyword they give). Unread by `isCommanderUnread` (no center, event, engine class or graveyard need, and so the flat shared-terms fallback) went 325 -> 28. The fallback gave weight 8 to 250-600 cards per commander, the commander included, so a read commander now loses it unless its center is thin (counters, "each player draws").

New center kinds, all in `getCommanderCenter` / `getCenterLinks` (`engines.js`), each with tests in `engines.test.js`:
`evasive`, `leaves`, `self-power` (voltron: Ukkima; counters on itself), `type` (named creature or card type, `CATALOG_CREATURE_TYPES` plus Lesson, Saga, Shrine, instant, sorcery, artifact and the party types), `term` (the Ring, initiative and dungeons, experience, stun, dice, counters, and Blood, Clue, Food, Treasure only when the commander's condition, cost or repeated trigger uses them), `attacks`, `hits`, `enters` (only when it is the one active ability), `enter-watch`, `attach`, `top`, `mana-scale`, `tap`, `tap-engine`, `exchange` (generic sacrifice, creature or permanent leaving), `cast-any`, `scry`, `discard`, `copy`, `pillowfort`, `hand`, `keyword`, `fight`, `ladder`, `small-evasion`, `static-haste`, and `mechanic` (earthbend, firebending, waterbend, airbend, Storied, prepared, speed, ninjutsu, defined from the reminder text on the cards).

Method that worked: read a sample of the unread cards in full before writing a pattern; run the 13-build diff after each kind and read the swaps; test a link against a card that should NOT match. What failed and was reverted or tightened: reading every enter trigger (133 commanders), a lower weight for instants and sorceries (Kaza 31 creatures), a flat weight on the +1/+1 counters term (made it thin), a pillowfort pattern that matched any "can't attack", and a combat-sink link that matched every instant. Measuring traps: the script must load `catalog-data.js` (the type kind is silent without it), must join the faces of two-faced commanders, and a legend's comma name hides a trigger from the label reader (normalized as `trigLine`).

Left unread (28): no-text bodies, Partner and Background shells, single-rule statics (Kunoros could instead veto reanimation and flashback), and a few activated or adventure cards. Link weights are first guesses; the user's playtests are the real check (Azula and Avatar Kyoshi, Guru Pathik, Raiyuu and Finneas are good first ones).

