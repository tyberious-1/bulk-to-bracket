# Reader blind spots found with expert-built lists (2026-11-17)

Status: FINDINGS, nothing fixed yet. Method for the user's question "how do we tell good from bad": use decks built by skilled
players as a reference for what a plan needs, and see what our center reader can and cannot see. This measures the **reader**,
not whether any deck is good.

Source tags: **(read)** from the card text on Scryfall; **(output)** from the tool's output, code not yet read; **(mine)** my reasoning.

## Method

- Lists: `manapool.com/lists/by/commanderathome` (98 public lists; the user says some are precons and most are by well-known Commander
  YouTubers; the page itself says neither). Precons avoided. Six lists read on 2026-11-17: Thorin, King of Durin's Folk (the Hobbit
  commander, not the user's Thorin Oakenshield), Ingris Stingerquill, Isshin, Prime Speaker Vannifar, Beorn the Fierce, Blim.
  Chosen so each stands for a different plan kind. Teysa and Tori are not among the commanders on that page, so the hold-out is untouched.
- Tool: `dev/tools/jxa-harness/expert_recall.js` (usage in its header). Reads the commander with the repo's reader
  (`getCommanderCenter`, `parseCommanderNeeds`), then for every non-land pick calls `getCenterLinks` and `getEngineBonus`.
  The lists live in git-ignored `dev/tools/jxa-harness/expert_lists/decks.js` (other people's work).
- Scryfall received only card names.

## Measuring trap (found and fixed in the tool)

My first run loaded the reader files by hand and left out `js/analysis/catalog-data.js`, which defines `CATALOG_CREATURE_TYPES`.
Without it, tribe lines read as nothing except a few (elves, dwarves), so Beorn's "Other Bears you control get +2/+2" read as
no type and I wrongly reported a reader bug. With the real load order it reads `type/bear`. The tool now takes its file list
from `build_harness.sh`. `dev/tools/jxa-harness/ability_eval.js` still has a hand-written list without `catalog-data.js`; its
effect on its output is not checked.

## Results: picks linked to the commander by the reader

| Commander | reader center | linked / non-land picks |
|---|---|---|
| Thorin, King of Durin's Folk | type/dwarf, term, enters, type/artifact, event, quantity | 54 / 63 |
| Beorn the Fierce | delivery, type/bear | 23 / 64 |
| Prime Speaker Vannifar | tap-engine, exchange | 15 / 67 |
| Ingris Stingerquill | delivery, attacks | 9 / 65 |
| Blim, Comedic Genius | delivery, hits | 5 / 64 |
| Isshin, Two Heavens as One | (nothing) | 0 / 67 |

Low numbers are not all misses: each list holds 10-20 generic role cards (rocks, removal, wipes, draw) that should not link.
High numbers can be false links (below). Read the cards, not the counts.

## Blind spots, by category

**A. Trigger doublers read as nothing (Isshin).** (output + read) Isshin: "If a creature attacking causes a triggered ability of a
permanent you control to trigger, that ability triggers an additional time." The center is empty, so 0 of 67 picks link. The expert's
picks are permanents with attack triggers and ways to attack more: Hellrider, Brutal Hordechief, Mardu Ascendancy, Anim Pakal,
Etali, Aggravated Assault (extra combat) (all read). Same category among the 75 commander texts read: Yarok, Katara, Wayta;
Bifur, which the user owns, appears to double triggers once you have an enduring story (my read of its text was cut off; the
CoolStuffInc Thorin article says the same). Fix by category: read what the doubler is conditioned on
(attacking, entering, an Ally...) and link cards whose triggers match.

**B. Changelings and chosen-type cards are not counted as tribe members.** (output; the code is not read yet) Thorin's list:
Mirror Entity and Taurean Mauler are unlinked while the Dwarf cards link. Beorn's list: Woodland Changeling, Chomping Changeling,
Chameleon Colossus, Mutable Explorer, Realmwalker, Metallic Mimic (it chooses one type; it is not a changeling) and Springleaf Parade (it makes changeling tokens; the card itself is not a member) are unlinked while the
Bears link. Changeling is a characteristic-defining ability, "This object is every creature type" (702.73a, read from cr.txt), so a card that prints it is a member of any tribe; the code has no handling of it (grep, 2026-11-17). Chosen-type and type-changing cards (Metallic Mimic, Mirror Entity's temporary types, Beorn's "becomes a Bear") are different mechanisms, so the real need is one reading of "what types does this card count as", not a changeling special case. Test first with a card text and a tribal commander.

**C. A repeatable mana-only ability, and per-attacker commanders (Ingris).** (read) Ingris has "{4}: create a 2/2 ... creatures you control
gain haste" and "whenever a creature you control attacks, it deals 1 damage to each opponent". Only 9 attack-payoff cards link.
Unlinked and plan-shaped: body producers (Goblin Rabblemaster, Legion Warboss, Siege-Gang Lieutenant, Bitterblossom), stacking
damage (Impact Tremors, Purphoros, Goblin Bombardment, Zulaport Cutthroat, Fated Firepower), haste (Lightning Greaves).
This confirms gap 1 from the handoff doc (the mana-sink reader) with a second commander, and adds: the commander wants many cheap attackers.

**D. Ownership and control-change plans (Blim).** (read) "That player gains control of target permanent you control. Then each player loses
life and discards cards equal to the number of permanents they control but don't own." The center reads only flying and a hit trigger. Unlinked
and plan-shaped: Sleeper Agent, Humble Defector, Bazaar Trader, Harmless Offering, Fateful Handoff, Jinxed Choker, Captive Audience (donate
effects), Treasure Nabber (steals). Same category among the 75 commanders read: Dack Fayden, Jon Irenicus, Edea.

**E. The commander's own creature types and counters (Vannifar).** (read + mine, one deck, lower confidence) The text never names Oozes; the expert
built Ooze and +1/+1-counter cards (Experiment One, Evolution Witness, Hardened Scales, The Ozolith, Incubation Druid). Oozes link
only through token fodder. The ability also reads "1 plus the sacrificed creature's mana value", so the creature curve matters as
a ladder: the deck's composition is an input, which is gap 3 in the handoff doc.

**F. A false link (Thorin, the one place the high count misleads).** (output) The commander counts artifact *tokens*; the reader
links every artifact as a type member with a bonus of 5. At least four mana rocks (Sol Ring, Arcane Signet, Boros Signet, Talisman of
Conviction) link although none makes a token. Precision matters as much as recall.

## What this does not show

- That the expert decks are good. They are one builder's choices, for content or fun as much as for winning, and from the whole card pool.
- That a fixed reader would improve a build from the user's collection; the reader can see a pick that the user does not own.
- Anything about Teysa or Tori.

## Next steps (not started; the user approved the investigation, not the fixes)

1. Fix by category with tests first, one category at a time, checked against a card text and a negative: B (changelings) is the cheapest and
   most certain; A (doublers) and the mana-sink reader (gap 1, with C) next; F (artifact token versus artifact) a precision fix; D after.
2. After each fix, rerun `expert_recall.js` and the Ashling/Pia/Fynn probe, and read the changed links by hand.
3. Decide with the user whether a build should print a "why this card" line (see the handoff doc).
