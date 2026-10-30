# Commander engine enablers (draft spec)

Status: draft from the 2026-10-15 interview, not yet built. Follows the plan-first
work in `2026-10-13-plan-first-prototyping.md`.

## Goal

Find owned cards that serve a commander's actual engine, even when EDHREC does not
list them. The builder should recognize what a commander needs and favor the
cards that supply it.

Motivating cases:
- **Greasefang, Okiba Boss** returns a Vehicle card from the graveyard each combat.
  Vehicles must get into the graveyard fast. Sacrifice is too slow, so discard
  (loot, rummage, discard outlets) and self-mill are the good routes.
- **A Zombie deck** (e.g. Tormod, the Desecrator) wants Zombie support plus
  recursion of those Zombies from the graveyard.

## What the 2026-10-15 measurement showed

An offline script (text patterns over `dev/tools/jxa-harness/owned_raw.json`, cards
inside the commander's colors) found, for Greasefang: 62 Vehicles, 11 recursion,
41 self-mill/surveil, 28 repeatable discard cards owned. Most were not on
EDHREC's Greasefang page (about 9 of 11 recursion, 38 of 41 self-mill, 25 of 28
discard, 36 of 62 Vehicles). Payload detection (type line) is clean. Self-mill and
discard patterns are noisy: surveil is a weak graveyard route, and one-shot ETB
loots are not the repeatable outlets the engine wants.

## Requirements

1. **Read the commander's needs from its rules text.** Extract a *payload type*
   (the card type or subtype the commander cares about: Vehicle, Zombie) and a
   *zone* (graveyard) from phrases like "return target Vehicle card from your
   graveyard". Commanders with no recognized need produce no enablers and behave
   exactly as today.
2. **Enabler classes.** For a recognized need, classify owned in-color cards:
   - payload: the type appears in the card's type line;
   - recursion: returns that type (or any creature/permanent, ranked lower) from
     the graveyard to the battlefield or hand;
   - repeatable discard: "Discard a card:" outlets and draw-then-discard looters;
   - self-mill: "mill N" aimed at yourself, "put the top N cards of your library
     into your graveyard"; surveil counts but ranks last;
   - sacrifice outlets: included but ranked last, because they are slow.
3. **Rank, do not just match.** Class order for graveyard engines: repeatable
   discard and direct self-mill, then recursion, then payload, then surveil, then
   sacrifice. Prefer cheaper cards. A type-specific recursion card outranks a
   generic one.
4. **Steer the build by name**, through the same mechanism as plan signature cards
   (`modePrefs.planSignature`, `PLAN_SIGNATURE_BONUS` in `scoring.js`), but a
   separate map so the two bonuses stay distinct. The enabler bonus is
   commander-driven and must apply whether or not a theme focus is active
   (`getThemeFocusAdjustment` returns early without `themeFocus`, so the new
   bonus lives outside it).
5. **Respect build discipline.** Enablers go through the normal role, type-target
   and curve logic. They are scoring lifts, never forced slots, and a Minimal
   Build still stops at its support package.
6. **Say so in the report.** When enablers steered the build, list them as such
   ("engine enablers for Vehicle in the graveyard") so the player can see why a
   discard outlet is in the deck.

## Crew support (Greasefang's Vehicles must also be crewed)

A Vehicle that comes back from the graveyard is not a creature until crewed, so
getting it into the graveyard is only half the engine. Greasefang's trigger runs
at the beginning of combat and the Vehicle returns with haste, so the deck needs
creatures to crew it that turn (summoning-sick creatures can crew).

11. **Crew class.** When the payload type is Vehicle, add a *crew support* class:
    creatures with enough power to crew cheaply (many Vehicles are Crew 2-4),
    cheap bodies the deck does not mind tapping, and cards that crew or reduce
    crew costs. Greasefang itself can crew. Read each Vehicle's crew number from
    its text and prefer Vehicles with a low crew cost, and among those prefer
    ones with enter-the-battlefield or attack triggers, since the Vehicle only
    stays until the end step.
12. **Crew-tap payoffs get a bonus.** Crewing taps creatures, so a creature or
    permanent with a trigger on that tap or crew is extra good in a Vehicle deck.
    Match rules text such as "crews a Vehicle", "becomes crewed", "becomes
    tapped" and "tap an untapped creature you control" (the crew cost taps
    creatures, so effects keyed to tapping can fire). Rank these above plain
    crew bodies. Check how the player's own Vehicle decks use them; this is a
    judgment call from the 2026-10-15 interview ("bonus points if something
    happens when the creature is tapped to crew"), not something the harness
    measured.
13. **Balance.** Crew support competes with the creature target, so it steers
    which creatures fill the creature slots and does not raise their count.

14. **Crew patterns are unvalidated.** A first pass on the owned collection found
    19 WB cards for crew-tap triggers (some real, such as Gearshift Ace, Sanwell
    and Ghost Ark; others false positives from the bare "becomes tapped" phrase)
    and 0 crew helpers (almost certainly a too-narrow pattern). The first
    implementation step is to build and tune these patterns against the owned
    collection by reading the matches, before any scoring depends on them.

### Findings from the pattern read (2026-10-15, with the player's corrections)

- **Crew helpers exist** (the first pass found 0 because the wording was guessed):
  "crews Vehicles as though its power were 2 greater", "crews Vehicles using its
  toughness", and Pilot-token makers (Giant Ox, Cloudspire Captain, Hotshot
  Mechanic, Deathless Pilot, Interface Ace, Roadside Assistance, ...). Class
  `crewHelper`, weight 10. Text that says a permanent *can't* crew is excluded.
- **Self-mill** counts "target player mills N" (the player can target themselves)
  but not "target opponent mills" or "its controller mills" (aimed at someone else).
- **Graveyard-route order** (player's call): discard and direct self-mill first,
  then surveil (slow but real), then sacrifice last. The player's WB Vehicles
  average mana value 3.5 (median 3, crew mostly 1-3), so sacrificing one is a real
  mana investment, not a cheap trade; sacrifice stays last.
- **Engine lands.** Lands that name the payload type (Foul Roads, Country Roads,
  Mech Hangar for Vehicles) are chosen by `evaluateNonbasicLand` in
  `js/build/manabase.js`, not the nonland pool, so the nonland path never sees
  them. Requirement 17.
- **Injection ruling:** cards whose only classes are surveil, sacrifice or crewBody
  get the score bonus but are not added to the theme tier (they would add ~100
  weak cards per commander). Requirement 18.
- **Deferred:** Tormod's trigger fires when cards *leave* the graveyard (recursion,
  flashback, eternalize, unearth, exiling from your graveyard), not when they
  enter; discard and mill only feed it. Recursion classes already cover part of
  that; a dedicated "leaves the graveyard" class is a follow-up, not built here.

17. **Engine lands.** For a payload need, a nonbasic land whose rules text names
    the payload type gets a small lift in `evaluateNonbasicLand`, and a
    restricted-mana land ("spend this mana only to cast a ... Vehicle spell")
    counts as usable when the type is the commander's payload.
18. **Injection skips weak classes.** `addEngineCandidates` ignores cards whose
    classes are all in {surveil, sacrifice, crewBody}.

## Multi-hit ranking (capitalize on a single play)

Synergy here means one action paying off several times: crewing taps a creature
(tap trigger), turns the Vehicle into an attacker (attack trigger); a discard
outlet also feeds the graveyard (and, in a Tormod + Ghost of Ramirez DePietro
deck, triggers Ghost and Tormod's token trigger). EDHREC's co-occurrence scores
do not capture this.

15. **Multi-hit bonus.** A card that serves two or more engine classes (discard
    outlet plus crew body, tap trigger plus lord, and so on) ranks above a card
    that serves one. This is a ranking rule on top of the classes above, not a
    new class.
16. **Follow-up spec, not this one:** score a whole build by how many of its cards
    respond to each key event (a creature taps, a card is discarded, a creature
    dies, a spell is cast), which also gives a way to compare builds. It needs
    the general producer/consumer card tagging.

## Second engine: devotion (structural, no text parsing)

Devotion counts one color's mana symbols in the costs of permanents you control,
so the resource is pips and the producers are pip-heavy permanents. The data is
structured (`card.manaCost`), unlike the graveyard case. The code today parses
pips only for the mana base (`parsePips` in `js/build/manabase.js`) and detects
devotion only as an EDHREC theme tag, so no card scoring counts pips.

7. **Detect a devotion need** from the commander's rules text ("devotion to")
   or an active Devotion plan theme, and take the color from the text or the
   plan.
8. **Score pip-heavy permanents.** Bonus grows with the card's pips in that color
   (hybrid counts for both colors, {X} and generic do not). Permanents only:
   instants and sorceries get no bonus, since they are not on the battlefield.
   Prefer pips per mana value, so a cheap {U}{U} permanent beats a costly card
   with one blue pip.
9. **Devotion payoffs by name** (Nykthos, Shrine to Nyx; Thassa's Oracle; the
   Gods; Gray Merchant of Asphodel and the like) are found by "devotion to" in
   rules text and get the normal engine bonus.

## Lord and anthem support (typal payloads)

10. For a recognized payload type, add a *support* class separate from the
    payload itself: cards whose rules text names the type with "other" or "you
    control" (lords and anthems, e.g. "Other Merfolk you control get +1/+1"),
    plus type-specific draw and token makers. Ranked high for typal engines. The
    first measurement mixed support into the payload bucket; this splits them.

## Non-goals

- A hand-curated table of commanders (rejected in the interview in favor of
  reading commander text).
- Engines beyond graveyard payloads, devotion and typal support (counters,
  tokens, spells matter). Each would need its own extractor.
- A general producer/consumer tagging of every card (what each card makes and
  what it cares about). That is the likely next spec if this one proves out; the
  explicit engines here are its first cases.
- Using EDHREC's average deck as a card source: measured on 9 sample commanders,
  every owned average-deck card was already on the commander page.

## Open questions

- How much weight beats the existing 20-40 point plan signature bonus without
  crowding out roles? Tune on Greasefang and one Zombie commander.
- Surveil: include at low rank, or drop? The measurement showed it is the main
  source of false positives.
- Whether bracket-sliced EDHREC pages (more owned candidates, but tiny samples at
  the low brackets) deserve a separate spec. Not decided here.

## Verification

The harness counts things; only the player can judge whether a deck is better.
So measurement catches regressions and shows whether the engine landed, and the
player's read of the printed card lists is the sign-off.

1. **Baseline first.** Before any change, save today's builds for the sample set
   (Kaza, Zodiark, Fynn, Strefan, Greasefang, Vnwxt, Kardur, Ivy, Callaphe, plus a
   Zombie commander) with `dump_decks.js`. Every change gets a before/after diff.
2. Unit tests (`dev/tests/jxa/`) for the needs-extractor and each class (payload,
   recursion, discard, self-mill, support, devotion pips), with Greasefang, a
   Zombie commander and Callaphe as fixtures.
3. **Engine presence.** For engine commanders, count enablers in the deck by class
   (Greasefang: discard and self-mill outlets, Vehicle recursion, Vehicles;
   Callaphe: blue devotion pips on permanents). The baseline is probably near
   zero, so the change is visible.
4. **Structural health.** Creature count against the EDHREC average, role counts,
   curve shape and land count stay within a set range of the baseline.
5. **Collateral.** Commanders with no recognized need (Kaza, Zodiark, Fynn,
   Kardur) build identically or nearly so.
6. **Sparse.** Repeat on a seeded thinned collection to confirm the fallback path
   still completes decks.
7. **Overfit check.** Tune on Greasefang, one Zombie commander and Callaphe; hold
   out one commander not used for tuning and check it too.
8. **Player sign-off.** Print the enablers each build picked and the full lists;
   the player reads them and decides.
