# Ability labels (draft spec)

Status: draft, not approved, nothing built in `js/`. Follows
`2026-10-15-commander-engine-enablers.md` (merged to `main` as `a65fb21`). The
prototype is `dev/tools/jxa-harness/ability_tagger.js` and `ability_eval.js` on
branch `ability-labels`.

## Goal

Decide what an owned card does by reading each of its abilities separately, turn
that into labels, and let the engine code ask questions of the labels instead of
matching one regular expression against the whole text. The player's rule, from
the 2026-10-15 interview: "the whole text tells the whole story." The app should
work out what cards do, as labels, without a hand-kept card list and without a
runtime call to a model.

## What the player said (to be corrected if wrong)

- The engine-enabler builds are the best yet, and the card-choice text for
  Greasefang "looks really good". Tormod + Ghost "looked pretty good".
- Bag of Holding is wrong for Greasefang because it exiles the discarded card.
  Street Sweeper (Callaphe with an Auras + Voltron + Devotion plan) is wrong
  because it destroys Auras. Devotion counts enchantments and artifacts too.
- Decision on Street Sweeper: do not patch it separately. Fix it in the label
  port, then rebuild Callaphe under that plan and check it again.
- The seven commanders the first spec changed without a graveyard engine each
  run on an *event*, not on the type of token they make (player's descriptions,
  2026-10-15): Old Rutstein is a mill commander with recursion from the
  graveyard; Omnath is a landfall payout; Kuja is a noncreature-spell payoff
  through Wizard tokens that deal damage per noncreature spell; The Council of
  Four is Knight typal or a "cares about drawing cards" deck; Berta pays out for
  casting bigger spells (increment) to make Fractals; The Astonishing Ant-Man pays
  out for drawing a card (counter per draw, removed to make Insects); Klothys is a
  group-slug deck through graveyard exile plus devotion.
- On cost: a card is seen as better when a similar effect costs less mana, and
  repeatable effects are the strongest. The cost-per-use rule below matches that.
- The app is a quick casual prototyping aid. A card that is merely OK is
  acceptable; a card that works against the commander is not.
- Spend: no model calls at runtime, no subagents while building this.

## Two phases

The work splits so each half can be measured and signed off on its own:

- **Phase 1, the port (requirements 1-12).** Labels replace the regexes for the
  engines that exist today (graveyard payloads, crew, devotion, lords). Builds
  should stay close to the 2026-10-15 baseline, with the listed fixes.
- **Phase 2, event engines (requirements 13-17).** A commander's own triggered
  ability names an event; owned cards that cause that event cheaply and often get
  the bonus. This is what the seven commanders above need, and it is the
  producer/consumer idea from the interview ("capitalize as much as possible on
  a single play"). Phase 2 starts after Phase 1 passes its checks.

## Why (what the one-clause matching got wrong)

Each of these was a real card in a real build:

| Case | What matched | What the whole text says |
|---|---|---|
| Bag of Holding in Greasefang | "draw a card, then discard a card" | "whenever you discard a card, exile that card from your graveyard" |
| Creature recursion counted for Vehicles | "return ... card from your graveyard" | the card is "creature", a Vehicle is not |
| Street Sweeper (Auras + Voltron plan) | the substring "attach" | destroys Auras attached to a land |
| Darkblast, Golgari Thug, Stinkweed Imp as self-mill | "dredge" | dredge returns a card from the graveyard; it mills nothing |
| Smuggler's Copter, Miasma Demon, Astelli Reclaimer, Primary Research missed | no pattern | real loot, discard-for-value, and recursion that can return a Vehicle |

## What the prototype measured (2026-10-15, owned collection of 8,126 cards)

- 87% of rules-text lines get a label; 79% of cards have every line labeled.
  Of lines that mention graveyard, discard, mill, crew or Vehicle words, 70% get a
  matching label. The misses are mostly "graveyard as a counting condition"
  (threshold, delirium) rather than engine text. This was read from the top 60 of
  the misses, not all of them.
- Against the regex classes in `engines.js`, for Greasefang's colors: 101 cards
  agree, labels add 31, the regex had 3 wrong (dredge).
- The Greasefang veto (exiles the discarded card, or your whole graveyard) fires
  on 3 of 8,126 cards: Bag of Holding, Containment Construct, Lantern of the Lost.
  A first version fired on 21, because it treated "exile a creature card from
  your graveyard" as a veto; separating "fuel" from "veto" fixed it.
- Tagging the whole collection takes about 130 ms in node.
- 15 of 15 known cases pass, but several were written after seeing the output.
  They show consistency, not correctness. The whole-collection veto list is the
  held-out check.

## Requirements

1. **A production module, `js/analysis/abilities.js`.** The prototype's functions
   (`tagCard`, `tagLine`, `tagEffects`, and so on), moved into the `js/analysis/`
   layout as plain globals. No parse-time dependency on other files. Loaded
   before `engines.js` in `index.html`, `pauper.html` and
   `dev/tools/jxa-harness/build_harness.sh`. `ability_eval.js` loads this file
   instead of a private copy.
2. **Result cache.** `getCardAbilities(card)` memoizes by card name. Tagging runs
   only on cards the engine code asks about (in-color owned nonland cards for an
   active engine), never at load.
3. **Ability record.** Each oracle line becomes `{ line, kind, trigger[], cost[],
   effects[], restrictions[] }`. `kind` is one of keyword, structural, activated,
   triggered, spell, static. An effect is `{ label, object?, from?, to?, kind? }`,
   so a zone move carries what it moves and where: "return target creature card
   from your graveyard to your hand" is `return-from-graveyard` with object
   `creature`, from `your`, to `hand`.
4. **Vocabulary.** Keep the prototype's labels, with these definitions that the
   engine code depends on:
   - Putting cards in your graveyard: `loot`, `rummage`, `discard-self` (object
     `any` or a card filter such as `creature`), `mill-self`, `surveil`,
     `put-into-graveyard`, and a discard or exile-self **cost** on an activated
     ability. `discard-any-player` ("target player discards") and
     `discard-opponent` are separate: the first can hit you, the second cannot.
   - Taking cards out: `return-from-graveyard`, `exile-from-graveyard` (kind
     `self`, `target`, `that-card`, `own-cards`, `all`), and the keywords
     flashback, escape, unearth, embalm, eternalize, disturb, jump-start,
     aftermath, retrace, scavenge, dredge.
   - Crew: `crew-helper`, a trigger on `crews` or on a creature you control
     becoming tapped (not "enchanted land becomes tapped").
   - Attachment: `attach-effect` means putting or moving an Aura or Equipment
     onto your things; `hose-attachment` means destroying or unattaching them.
     This splits the prototype's single `attach-effect`.
5. **Needs in the same vocabulary.** `parseCommanderNeeds` keeps its current
   result fields (`payloadType`, `graveyard`, `returnsFromGraveyard`,
   `devotionColors`) and gains what the commander's own tagged abilities imply:
   a commander with `return-from-graveyard` (object X, from your) needs cards put
   into the graveyard and vetoes `exile-from-graveyard` of kind `that-card` or
   `all` from your graveyard; a commander triggered on `leave-graveyard` needs
   cards that leave it (the Tormod class, deferred in the first spec).
6. **Engine classes read labels.** `getEngineClasses` keeps its class names
   (`payload`, `recursion`, `recursionGeneric`, `discard`, `selfMill`, `surveil`,
   `sacrifice`, `lord`, `crewTap`, `crewBody`, `crewHelper`, `devotionPayoff`) and
   adds `leavesGraveyard`. Each is decided from labels, so `scoring.js`,
   `main.js` and `manabase.js` call the same functions with no change. The
   regular expressions in `engines.js` that the labels replace are deleted, not
   kept beside them.
7. **Whole-ability judgments**, none of which a single clause can make:
   - The Bag of Holding veto comes from the discard-triggered exile, not from
     the loot ability next to it.
   - A discard limited to a card type (Mind Maggots, Dokuchi Silencer: creature
     cards) is not an outlet for a payload that is not that type.
   - Recursion counts only when its object can be the payload (the payload type,
     artifact, permanent, or an unrestricted "card"). Creature-only recursion does
     not count for Vehicles; "creature or vehicle" does.
   - Spending graveyard cards as fuel (exile a card from your graveyard as a cost
     or a rider) is a penalty, not a veto, unless the card type cannot be the
     payload.
8. **Quality penalties.** A card that is a real enabler but carries a flaw loses
   a small amount of its bonus and is marked "flawed" for the report: sorcery-speed
   activation, paying life, discarding two or more cards, tapping another
   permanent, spending graveyard cards as fuel. Initial value: -3 per flaw, no
   lower than half the class bonus. Tuned in the measurement pass, like the
   first-spec weights.
9. **Weak enablers are judged by what one use costs.** Strength is the mana a
   player pays to get one discard or mill, compared with similar abilities: the
   activation cost for a repeatable ability (up to {2} is full strength, {3} or
   more is weak), and the card's mana value for a one-shot (a spell, an
   enters/dies trigger, or an ability that sacrifices or exiles its own card):
   mana value 3 or less is full strength, 4 or more is weak. Other costs the
   ability charges (a card, a creature, life) are flaws under requirement 8, not
   weakness. A weak enabler keeps a score bonus but is
   not added to the theme tier (the same rule as surveil, sacrifice and crew
   bodies in `ENGINE_WEAK_CLASSES`). "Target player discards" is always weak,
   since it can hit an opponent. Initial thresholds are a guess, tuned in the
   measurement pass.
10. **The voltron tag stops reading "attach" as a substring.** `detectCardTags`
    in `scoring.js` tags `voltron` from the type line (Aura, Equipment), from
    "equipped creature" / "enchanted creature", and from an `attach-effect`
    label, but not from `hose-attachment`. Expected effect on the 28 owned cards
    that reached `voltron` only through the word: Street Sweeper and Disarm lose
    it; Enchantment Alteration, Stolen Uniform, Brood Keeper and Champion of the
    Flame are expected to keep it (to be confirmed by a test, since the
    prototype does not yet split `attach-effect`).
11. **Report.** The build breakdown line that lists engine enablers also shows
    why each card was chosen ("discard outlet", "returns Vehicles") and marks
    flawed ones (player's call, 2026-10-15: "give the info for now"). Reasons come
    from the same labels that scored the card, not a second description.
12. **No change for commanders without a recognized need.** They get bonus 0 and
    build as today. The seven commanders that the first spec reported as changing
    (Old Rutstein, Omnath, Kuja, The Council of Four, Berta, Ant-Man, Klothys) are
    handled by Phase 2, not by suppressing them: their change was a wrong reading
    (a token type), and Phase 2 replaces it with the right one. Until Phase 2 they
    build as the 2026-10-15 baseline does.

## Phase 2: event engines

13. **Typal is a need only for a typal commander.** A type counts as a payload only
    when (a) the commander is that type on any face, (b) its text says "other X
    you control" or "another X you control", (c) it has changeling, or (d) the
    player selected a typal plan for it. A token the commander merely makes is an
    output, not a need, and `lord` and `payload` stop scoring for it. Applied to
    the seven (checked against their type lines and text on 2026-10-15):
    - Omnath stays Elemental typal (it is an Elemental and says "another
      Elemental you control"); Kuja stays Wizard typal (a Wizard on both faces,
      and the back face doubles damage from "a Wizard you control").
    - Old Rutstein (Insects), The Council of Four (Knights), Berta (Fractals) and
      Ant-Man (Insects) lose the typal need, and Klothys has none. The Council of
      Four gets Knight lords only if the player picks a Knight typal plan, since
      the player calls it either Knight typal or a draw deck.
    For Omnath and Kuja the typal bonus stays below the event bonus (requirement
    17): the event is their engine, the type is support.
14. **Events from the commander's own triggers.** `parseCommanderNeeds` gains
    `events`, read from the commander's tagged triggered abilities: a land enters
    (landfall), a card is drawn, a spell is cast (any, noncreature, second in a
    turn, a bigger spell than before), cards are milled, cards leave a graveyard,
    a counter is put on a creature. Each event has a list of *producer* labels.
15. **Producers.** A card produces an event when one of its abilities has the
    matching effect: `draw` or `loot` for a card drawn; putting a land onto the
    battlefield, or searching for one, for landfall; being an instant or sorcery
    for a noncreature spell; `mill-self` for cards milled (and `mill-other` for
    Klothys, which exiles from any graveyard); `counters` for a counter put.
    Repeatable producers rank above one-shots, and cost per use decides strength
    as in requirement 9.
16. **Starting events and what the player said about each:**
    - Old Rutstein: cards milled. **Whose library decides the rest.** A commander
      that mills *you* (`mill-self`: "mill a card") wants recursion and graveyard
      payoffs as support, because the milled cards are a resource (reuses the
      Phase 1 graveyard classes). A commander that mills *opponents*
      (`mill-other`) is a win-by-decking plan: it wants more opponent-mill
      producers and no recursion need, and self-mill cards do nothing for it.
      "Target player mills" can be either, so it counts as a producer for both
      and implies no recursion need. The direction comes from the label, not
      from the word "mill".
    - Omnath, Locus of Rage: land enters. Producers are extra land drops,
      fetch and ramp that puts lands onto the battlefield, and landfall cards.
    - Kuja: noncreature spells cast, with Wizard tokens as the payoff.
    - The Council of Four: second card drawn in a turn, or second spell cast in
      a turn, or Knight typal. The player calls this one open.
    - Berta: spells cast above the creature's current size (bigger spells,
      X spells), and counters.
    - The Astonishing Ant-Man: a card drawn; draw engines and cantrips.
    - Klothys: cards in any graveyard (group slug), and devotion in red and
      green. Producers are anything that fills a graveyard, including opponents'.
    **Prototype run on these commanders (2026-10-15).** The tagger already reads
    five of the eight engines straight from the commander's own text: Old Rutstein
    (`mill-self` on enter and upkeep), Ant-Man (`draw-event` trigger, counters),
    The Council of Four (`draw-event` and `cast-spell` triggers), Klothys
    (`exile-from-graveyard`, any graveyard) and Tormod (`leave-graveyard`). It
    misses, and Phase 2 must fix: **landfall** (Omnath's trigger is labeled a
    plain enter trigger because the pattern wants "land enters", not "land you
    control enters"); **abilities quoted inside a token** (Kuja's noncreature-spell
    trigger lives in the Wizard token's text, so a line-level read cannot see
    it); **increment** (Berta); **"second card/spell each turn"** (Council of
    Four; the qualifier is dropped); and **devotion** (Klothys's condition reads
    as a plain condition, so devotion still comes from `parseCommanderNeeds`).
    Old Rutstein's recursion is not in its text at all: the labels show a
    self-mill engine, and the recursion follows from the direction rule below
    (a self-milling commander wants a graveyard worth returning from), which is
    the player's judgment encoded as a rule, not something a label finds.
17. **The same weight rules apply.** Event bonuses use the existing class weights,
    multi-hit bonus, cap and weak-class rule, so no card jumps ahead of roles or
    the curve. The report line lists event producers the same way it lists
    graveyard enablers, with the reason.

## Non-goals

- Runtime model calls, Scryfall `otag:` lookups, or a hand-kept card table. The
  prototype showed `otag` carries breadth but not nuance (Bag of Holding carries
  `discard-outlet`).
- Re-labeling roles (ramp, draw, removal, wipe) in `detectRole`. They stay as
  they are; a later spec can move them onto labels once this proves out.
- Changing the engine weights, the card caps, or the build phases.
- Scoring a whole build by how many cards respond to each event (the first
  spec's follow-up 16). Phase 2 scores single cards against a commander's events;
  it does not grade a finished deck.
- A per-commander "not for this deck" list.

## Open questions

- **Mill direction on real commanders.** Check the rule on the owned commanders
  that mill (self, opponents, or "target player") before relying on it, and read
  the printed lists for one self-mill and one opponent-mill commander.
- **Cost thresholds** (requirement 9): what counts as cheap for one use. The
  player's steer was to compare with the mana cost of a similar ability; the
  numbers are a first guess. Macabre Waltz (return creatures, then discard) is a
  test case for a spell whose discard is a side effect of something else.
- **Wording gaps found in the prototype.** "Put target creature cards from
  graveyards onto the battlefield" (Aberrant Return, no word before
  "graveyards"), "defending player discards", and wheel effects. Fix by tests as
  found, or sweep the remaining unlabeled graveyard lines first?

## Verification

1. **Baseline.** `dev/tools/jxa-harness/baselines/2026-10-15-after-enablers.json` is
   the before. The after is saved next to it.
2. **Unit tests** (`dev/tests/jxa/abilities.test.js`) with real card text as fixtures:
   one test per label, plus the known cases above: Bag of Holding vetoed;
   Containment Construct vetoed; Stitched Drake not vetoed; creature recursion
   rejected for Vehicles, "creature or vehicle" accepted; Mind Maggots not an
   outlet; Smuggler's Copter a loot; Golgari Thug dredge, not self-mill; Street
   Sweeper and Disarm `hose-attachment`; Enchantment Alteration and Stolen
   Uniform `attach-effect`; Contaminated Ground not a crew-tap trigger.
3. **Held-out veto check.** The Greasefang veto over the whole owned collection
   equals the three cards above. A new veto means a review, not a silent change.
4. **Engine tests.** The 49 `engines` tests keep passing; those that assert
   regex behavior change to assert the same outcome through labels.
5. **Before/after diff** on the sample set with `engine_compare.py`. Expected
   moves are listed in advance (Greasefang gains Smuggler's Copter and Miasma
   Demon as outlets; Zombie Infestation and Heirloom Mirror are marked flawed;
   dredge cards leave Greasefang's self-mill; Tormod gains `leavesGraveyard`
   cards); anything else is explained or fixed.
6. **Callaphe recheck.** Build Callaphe with `theme:auras~voltron~devotion`
   (`MODE_OVERRIDE` in `dump_decks.js`) before and after. Street Sweeper and
   Disarm should be gone; Enchantment Alteration and Stolen Uniform may stay.
7. **Collateral.** Kaza, Zodiark, Fynn and Kardur build identically. Creature
   counts, role counts and land counts stay within the first spec's ranges.
8. **Sparse.** Repeat on the seeded 30% collection; decks still complete.
9. **Speed.** Tagging the in-color pool for one build adds well under a second in
   the browser (measured at 130 ms for the whole collection in node).
10. **Phase 2 checks.** Producers are printed per commander (the seven plus
    Greasefang for regression) as a list the player reads, the same way the
    Greasefang card list was read. The player's one-line description of each
    commander (section "What the player said") is the fixture; no card-level
    expectations are written until the player has read the printed lists.
11. **Player sign-off.** Print the full lists and the per-card verdicts for
    Greasefang, Tormod + Ghost and Callaphe. The player reads them and decides.
    The browser rendering of the report line has not been tested (no browser
    here) and is checked by the player.

## Phase 1 result

- Suites: all 18 `SUITE OK` (abilities 13, engines 66, scoring 19, type-plan 32, others unchanged).
- After baseline: `dev/tools/jxa-harness/baselines/2026-10-15-after-labels-phase1.json` (56 entries), diffed against `2026-10-15-after-enablers.json`.
- Unchanged (52 of 56), including Kaza, Zodiark, Fynn and Kardur (no engine need).
- Greasefang: creatures 15 -> 14. Added Brilliant Restoration, Chitin Gravestalker, Cultivator's Caravan, Dark Deal, Dig Up the Body, Momentum Breaker, Ruthless Technomancer, Skybox Ferry, Skyshroud Vampire, Teshar, The Restoration of Eiganjo, Tortured Existence. Removed Aberrant Return, Anointed Deacon, Bound in Gold, Dark Nourishment, Dusk Mangler, Foul Renewal, Heirloom Mirror, Miraculous Recovery, Necromancer's Familiar, Spectral Snatcher, Summon Undead, Voyager Glidecar. Matches the expected direction (creature-card recursion and Heirloom Mirror out; loots and discard outlets in). Miasma Demon did not enter the build.
- Tormod + Ghost: creatures 25 -> 26; 8 swaps (Golgari Thug and other dredge cards among the removals, so dredge no longer counts as self-mill there).
- Rielle (voltron tag): Disarm and Unexpected Request out, Act of Treason and Enchantment Alteration in.
- Callaphe default build: one swap (Slip Out the Back -> Desynchronize), creatures 17 -> 17.
- Callaphe under `theme:auras~voltron~devotion`: Street Sweeper out, Disarm out, Enchantment Alteration IN, Stolen Uniform out.
- Sparse check (Greasefang on a one-third sample of the collection): a full 61-entry list completes, same as the full-collection build.
- Speed: `getEngineClassDetails` over 3159 in-color cards (including label caching) took 90 ms.

The browser rendering of the report line is untested (no browser in this environment); the player checks it.

## Phase 2a result

- Suites: all 18 `SUITE OK` (abilities 21, engines 84). All 56 sample builds are identical to `2026-10-15-after-graveyard-exile-role.json`, as expected (nothing scores from events yet).
- Events read from each commander's own text: Old Rutstein `mill` (direction self); Omnath `landfall`; Kuja `cast-noncreature` (from the Wizard token's quoted ability); The Council of Four `draw-second` and `cast-second`; Berta `cast-bigger` (increment) and `counter-placed`; Ant-Man `draw`; Klothys `graveyard-fill` (devotion R and G still read, now from labels); Tormod `leave-graveyard`; Greasefang none. Printed lists: `dev/tools/jxa-harness/baselines/2026-10-15-event-producers.txt`.
- Producer counts (owned, in color): mill 77; landfall 85; cast-noncreature 1,416 (587 strong); cast-second 486 and draw-second 481; cast-bigger 585 and counter-placed 281; draw 501; graveyard-fill 135; leave-graveyard 182.
- Things that look wrong in the lists, for the player (not fixed in 2a):
  - Berta's `counter-placed` producers counted any counters (charge counters on Everflowing Chalice, Briber's Purse). Fixed after the player's note: the event now carries a counter kind (`+1/+1` for Berta, `any` for Denry Klin, who copies each kind of counter), and a producer must put that kind on a creature (Berta's list went from 414 to 264, then 281 once proliferate counted). The player named Denry Klin, Editor in Chief and Perrie, the Pulverizer as other counter commanders. Both are owned and handled: Denry (copies each kind of counter) and Perrie (counts different kinds of counters) read as `counter-placed` with kind `any`. Perrie is not in the harness fixtures (they predate the player's export), so her producers are untested.
  - The Council's lists are wide (486 and 481). Player's call: the Council is a bonus from normal game actions that opponents take while pursuing their own plans, so its wide lists and the lack of an each-player-draw producer are fine; no change.
- Phase 1 bug fixed on the way: a card's own name is now replaced only as a whole word (a card named "Flash" turned "flashback" into "~back").
- Final review (advisor, Opus, plus a collection-wide check): the whole-word name change alters one owned card's text (Fly: "~ing" became "flying"), nothing throws over 8,126 cards, events read the same through the app's card objects as through the node helper, and both pages' scripts run in order. Two producer bugs found and fixed: proliferate now produces counters, and a card that reacts to counters (a counter-placed trigger) no longer counts as a producer.
- Deferred to Plan 2b: Bag of Holding tops Klothys's graveyard-fill list (apply the graveyard-hostile check); lands are excluded from producers, so fetch lands never appear for Omnath; "each/target player draws" is not tagged `draw` (affects Ant-Man and the Council); delve is not a leave-graveyard producer; Denry (counters on himself) and Perrie (variety of kinds) both map to `any` but want different things; measure `getEventProducers` speed (the 149 ms figure measured the engine classes).

## Phase 2b result

- Event producers now score: 6 for a strong producer, 3 for a weak one, once per card (the larger if it causes several events), added before the shared cap of 36. They are never injected into the theme tier and never listed as graveyard enablers, because some event lists run to hundreds of cards. The build report adds an "Event engines (...)" line listing up to 12 producers with the reason.
- A new build-mode switch, "Event Engines" (on by default), turns it all off: the `noEvents` token empties `needs.events`, and every other function already ignores a commander with no events. The harness honors `MODE_OVERRIDE = "noEvents"`.
- Suites: all 18 `SUITE OK` (engines 89, mode-prefs 4).
- Switch off: all 56 sample builds are identical to `2026-10-15-after-graveyard-exile-role.json`.
- Switch on (`2026-10-15-after-events.json`): 13 commanders move, all of them ones that read an event (Old Rutstein, Klothys, Berta, Firja, Gyruda, Kuja, Longshot, Omnath, Tannuk, The Astonishing Ant-Man, The Council of Four, Vanille, Tormod + Ghost), with one to ten swapped cards each; the other 43 are unchanged, including Kaza, Zodiark, Fynn, Kardur, Greasefang and Callaphe.
- Real page (headless Chrome, network served from the fixtures): Omnath shows "Event engines (landfall): Valakut Predator (landfall card), Icetill Explorer (puts a land onto the battlefield), ...", the switch goes from on to off on click and the rebuilt report has no event line; Greasefang and a pauper build finish with no JavaScript errors.
- Deferred to Plan 2c: the typal reshaping (requirement 13 and the player's calls on token makers), the mill-direction recursion rule, the Kuja amplifier class, Denry/Perrie variety, and the Plan 2a deferred minors. Weights are first guesses; the player tunes them by reading builds.
