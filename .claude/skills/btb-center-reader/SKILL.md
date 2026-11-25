---
name: btb-center-reader
description: Use when editing js/analysis/engines.js or abilities.js, a center link or weight (getCommanderCenter, getCenterLinks, CENTER_LINK_WEIGHTS), event producers, vehicle/crew payload logic, or judging how a commander's own text steers a build.
---

# Engines, ability labels and the commander center reader

> **Summary:** How a commander's words become needs (payload types, events, center kinds like quantity/event/exchange/type/term) and how owned cards link into it with weights; ability labels per card; unread-commander counts. Weights are untuned first guesses.
> **STOP here unless** you are changing a link, weight, center kind, event producer or ability label, or debugging why a card was or was not picked for a commander.
> Everything below is detail moved verbatim from the old AGENTS.md; skip it if the summary answers your question.

- `js/analysis/engines.js` — commander engine enablers: `parseCommanderNeeds` reads
  payload types (`needs.payloadTypes`: Vehicle, Mount, Zombie...; "Mounts and/or Vehicles" text gives both,
  Vehicle first) and devotion color from the commander's rules text,
  `getEngineClasses`/`getEngineBonus` classify and score owned cards (discard, self-mill,
  recursion, lords, crew helpers/tap payoffs, devotion pips), `addEngineCandidates` puts
  them in the theme tier, `getEngineLandBonus` lifts payload-named utility lands (Roads lands for Vehicle or Mount).
  **Vehicle payload:** `getCrewPower` reads a creature's crew value from its text (toughness crew, "as though
  its power were 2 greater"); `planPayloadVehicles` lifts the creature target to 24 and the artifact
  target to 15 and returns a ceiling of one vehicle per 1.25 creatures; `deck.js` picks vehicles freely and
  `dropSpareVehicles` removes the rest from the pools once the ceiling is reached (a pick-time cap: rejecting
  inside `addCard` would loop the pick loops).
  `modePrefs.engineNeeds` carries the needs; `scoreCard`/`scoreFallbackCard` add the bonus
  outside the theme-focus gate. Loaded right after `scoring.js`. A commander with no
  recognized need gets bonus 0 and builds unchanged. `getEngineClassDetails` returns
  `{ cls, weak, flaws }` per class: a flaw (sorcery speed above {2}, discarding two,
  tapping another permanent) costs 3 once per card, and cost per use sets `weak`
  (repeatable {3}+, one-shot mana value 4+); weak classes score but are never injected.
  **Events:** `needs.events` (from `getCommanderEvents`) lists what a commander's own
  abilities run on (landfall, draws, noncreature/second/bigger spells, mill with a
  direction, leaving the graveyard, counters of a kind, graveyard fill);
  `getEventProducers(card, needs)` says which owned cards cause each one, and a
  producer gets a flat bonus (6 strong, 3 weak, once per card) in `getEngineBonus` as
  an `event:<id>` class. Event classes are never injected into the theme tier or
  listed as graveyard enablers (some lists run to hundreds of cards).
  `describeEventProducers` feeds the report line. Specs:
  `dev/docs/superpowers/specs/2026-10-15-commander-engine-enablers.md` and
  `2026-10-15-ability-labels.md`.
  **Center (2026-11-05, merged):** `needs.center` (from `getCommanderCenter`) is the commander's own number, event or
  exchange read from its words: `quantity` (`total-power`/`greatest-power`/`count` of a type), `event` (`cast`/`enter` with a
  type filter, or `gain-life`), `exchange` (pays X, gets Y: Gisa, Whisper, Dina) and `delivery` (a keyword it gives).
  `getCenterLinks(card, needs)` names how an owned card links into it (supplies/multiplies/reads power, boosts or counts the
  type, makes or pays off the event, fodder, outlet, death payoff, return target, reanimates, graveyard-leave payoff...) and
  `getCenterBonus` sums the weights (`CENTER_LINK_WEIGHTS`, capped at `CENTER_BONUS_CAP` 20) inside `getEngineBonus`. A card is a
  small program judged by its links into the commander's web, not by its tags (see "How cards connect"). Switched off with the Event
  Engines switch (`applyEventSwitch` empties `needs.center`). Weights are first guesses, untuned. Spec (read it before changing
  a link or weight): `dev/docs/superpowers/specs/2026-11-05-commander-center-reader-design.md` (sections 7-10 hold the measurements).
  Added 2026-11-11: `type` (the commander names a type it cares about, "Lesson, Saga, or Shrine spell", "Samurai or Warrior you
  control"; creature types come from `CATALOG_CREATURE_TYPES`; links `type-member`, `type-payoff`, `type-lord`, `type-maker`) and
  `term` (a rules term it runs on: the Ring, initiative, experience, stun, +1/+1 counters, and Blood/Clue/Food/Treasure only when its
  own condition or cost, or a repeated maker, uses them; links `term-link`, `term-doubler`; counters are `thin`, so the shared-terms
  fallback keeps speaking). Owned legendary creatures with a real center: about 83 -> 290 of 606. A commander that reads one of these
  no longer gets the shared-terms blob (flat weight 8 on 250-600 cards, the commander itself included), which is why the tribal
  commanders in the 13 builds (Kaza, Strefan, Omnath) moved 5-9 cards. Also added: `attacks` (extra combat, attack payoffs, team haste
  and evasion), `enters` (only when the enter trigger is the commander's one active ability: blink, enter doublers, own-permanent
  bounce), `attach` (gear members, cost helpers, tutors), `top` (top-of-library setup, free casts), `mana-scale` (mana sinks,
  doublers), `tap` (untappers, tap payoffs), a generic sacrifice as an `exchange` paid with the sacrificed type, and instant and
  sorcery as named types. Real-center share of the 606 owned legendary creatures: 83 -> about 370. The 13-build diff against the
  type/term commit moves Kaza 16, Rielle 6, Strefan 6, Eriette 3. Tried and dropped: reading every enter trigger (133 commanders,
  moved Kardur and Rutstein for nothing) and a lower weight for instants and sorceries (Kaza went to 31 creatures).
  Then `hits` (combat damage to a player: evasion, double strike, extra combat), the `dies` trigger (another creature: the sacrifice
  `exchange` links; its own death: `leaves`) and `cast-any` (any spell: cheaper casts, copies, cheap spells). Commanders nothing reads
  at all (no center, event, engine class or graveyard need, `isCommanderUnread`): 325 -> 156 of 606; the rest are mostly static-only
  text, end-step and upkeep triggers, draw events beyond the event list, and seven vanilla bodies. (An earlier count of 156 left
  `catalog-data.js` out of the measuring script, which switched the type kind off: load it, or the numbers are wrong.) Last round:
  self growth (`self-power` from counters on itself), `enter-watch` (another creature, artifact or enchantment entering: makers,
  blink, enter doublers; lands are landfall, not this), static spell help folded into `cast-any` (`big-spell` only when the
  commander names a mana-value threshold), `scry` and `discard`. Unread then 325 -> 105 of 606.
  Then `mechanic` (`CENTER_MECHANICS`, defined from the reminder text on the cards themselves, so check a new mechanic the same way:
  earthbend, firebending (also an attack trigger), waterbend, airbend, Storied, prepared, speed; link `mech-same` plus `land-matters`,
  `combat-sink`, `bend-fodder`, `story-member`, `life-loss`): unread 95 of 606, 13-build diff unchanged. Then `tap-engine` ({T} ability that is not mana: untappers), `copy`, `pillowfort`, `hand`, `keyword` ("creatures you control with flying"), "tokens you control" as the token event, toughness as a quantity, dice and dungeon terms, ninjutsu, a creature dying as a trigger, and own-permanent bounce; the type reader also takes "your team controls" and "that's a Cat, Elemental...". The measuring script must join the faces of two-faced commanders (a blank text read as unread): unread 95 -> about 50 of 606. Last bug round (unread 44): a legend's comma name ("Sophina, Spearsage Deserter attacks") hid the trigger from the label reader, so `engines.js` normalizes it (`trigLine`); the enter label takes the plural "enter" (`abilities.js`); "full party" reads Cleric, Rogue, Warrior and Wizard; a permanent leaving reads like a creature dying; Boast is an attack plan. Then, reading the remaining cards in full (unread 44 -> 28): `tap-engine` takes adjacent mana symbols, an ability-word prefix with a hyphen no longer hides a trigger, conditional unblockable and "commanders you control have menace" read as `evasive`, "nonbasic lands are Mountains" reads as `land-type`, a token that taps for mana and "cast a spell from among them" read as scaling mana and `top`, and new kinds `fight`, `ladder` (Yisan: creatures by mana value), `small-evasion` (Sidar Kondo), `static-haste` (Samut), enter-as-a-copy under `copy`, and `artifact` as a named type (Rebbec; it moved Ragost 19 cards toward artifact makers). A firebending link once appended " flash" to the text and linked every instant: test a link against a card that should NOT match. Left unread: Partner,
  Background and Companion shells, protection and hexproof grants, and one-off rules effects (Ghalta's toughness, Obosh, Graaz).
  Known unread: the Sai enter-payoff side, a majority-type lord (Whisper), an artifact-enters event (Iron Man), equipment pump and
  "becomes base power and toughness N", and a commander's center when its text names two jobs only partly (Dina's lifegain was
  added; check a new two-job commander by reading its build, not by link counts).
- `js/analysis/abilities.js` — per-ability labels: `getCardAbilities(card)` splits a card's text into
  abilities (trigger, cost, effects with their object and zone, restrictions) and caches them;
  `engines.js` and the `voltron` tag read these labels instead of matching one clause. Loaded right
  before `scoring.js`. Each record also carries `quoted[]` (abilities handed out in
  quotes, e.g. a token's trigger). A card's own name becomes `~` as a whole word only.
  Plans: `dev/docs/superpowers/plans/2026-10-15-ability-labels-phase1.md`, `-phase2a.md`
  (events, producers), `-phase2b.md` (event scoring and the switch).

