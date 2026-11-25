# Judging a card or deck in context: cases and rules (2026-11-16)

Status: SPEC, nothing built. Written after a session with the user (the owner) that started from "the builder is not
doing well" and ended by finding that our measurements could not say what good means. This replaces role counts,
mana-value numbers, the 13-build diff and goldfish figures as the arbiter of whether a change helps. Those can show that
something changed; they assume a template of typical counts, and the decks below show a template is wrong.

Source tags: **(user)** the user said it; **(read)** read from the card text on Scryfall or in `owned_raw.json`;
**(mine)** my reasoning, not confirmed by the user. Nothing here was simulated.

## The rule

A deck is good when its cards serve the commander's own plan and the plan runs reliably, not when it resembles a
template (so many ramp, draw, removal, a curve, a type mix). The same card can be great in one deck and dead in another.

A plan has three parts:

1. **What it needs:** mana, a keyword, a resource, a deck made of one thing.
2. **What it produces:** damage, counters, tokens, a wipe. Search both directions: a card can be good because it feeds
   on what the commander produces (Red Hulk for Ashling), not only because it supplies what the commander needs.
3. **How it wins.** Kinds (user): get ahead and finish; everyone loses and I am last; nobody can hurt me and I outlast;
   kingmaker (I decide who wins); commander damage (21 combat damage from one commander to one player; tokens do not
   count). The user finds "how does it win?" hard to answer in conversation. A one-sentence win line per build would help.

A card's value also depends on the rest of the deck: Lost in the Woods and Heartstone are examples below.
So a fixed per-card number cannot say it. Ask how a deck is actually piloted instead of assuming (I assumed Ashling attacks).

## Case 1: Ashling the Pilgrim (mono-R), commander plus 99 Mountains (the user: a common deck)

Card (read): {1}{R} 1/1. "{1}{R}: Put a +1/+1 counter on Ashling. If this is the third time this ability has resolved this turn,
remove all +1/+1 counters from Ashling, and it deals that much damage to each creature and each player."

- **Needs:** every spare red mana (each {1}{R} is a counter). All lands means no dead card and no missed land drop.
- **Produces:** a growing body, and on the third activation a wipe plus damage to every player, her own body included (mine, from the text).
- **Wins (user):** by dealing damage and wiping the board, repeatably. "Everyone loses." Kingmaker is the user's word for it.
  Plays her on turn 2 because the mana has no other use (mine).
- **Good for her (read; the user confirmed the plan, not each card):** Gauntlet of Might (Mountains tap for an extra {R}), Heartstone
  (activated abilities cost {1} less, so {1}{R} becomes {R}), indestructible equipment (Mithril Coat, Darksteel Plate, Hammer of
  Nazahn) so she survives her own wipe, hexproof or shroud (Lightning Greaves, Swiftfoot Boots, Mirror Shield).
  In the user's collection (Oct 29 export): Swiftfoot Boots, Mirror Shield, Palladium Myr, Hedron Archive, Carnelian Orb of
  Dragonkind, Coal Stoker, Red Hulk, and extra-land-drop cards (PuPu UFO, Ghirapur Orrery, H.E.R.B.I.E. Scout Unit, Scaretiller).
- **Red Hulk (read):** "Enrage: whenever he is dealt damage, +1/+1 counter, then he deals damage equal to his counters to any other
  target." Her wipe feeds him. He has 7 toughness, so a detonation with 7 or more counters kills him first (mine).
- **Redundant or dead for her (mine):** a separate board wipe (she is the wipe), generic removal.

## Case 2: Pia, Aether Ascetic (mono-G), commander plus one enchantment plus 98 Forests

Card (read): {2}{G} 2/2. "When Pia enters, you may discard a card. If you do, search your library for an enchantment card,
reveal it, put it into your hand, then shuffle." the user described the deck as Pia, one enchantment, all Forests.

- **Needs:** one enchantment found with one discarded Forest. Every card is a Forest, so effects that count or reveal Forests cannot miss.
- **Wins (the user confirmed):** Sapling Nursery ({6}{G}{G}, affinity for Forests: {1} less per Forest; landfall makes a 3/4 reach Treefolk;
  {1}{G}, exile it: Treefolk and Forests gain indestructible). Turn 3 Pia, turn 4 cast it for four mana, first token turn 5, then
  one per land drop. About 30 damage by turn 9 against one opponent, no interference (mine, rough).
  Second route (user): Pia attacks for commander damage, 21 per opponent, combat damage only. She is a 2/2, so 11 hits (mine);
  the tokens are the faster clock, and each route makes the other harder to stop.
- **Lost in the Woods (read):** "Whenever a creature attacks you, reveal the top card of your library. If it's a Forest card, remove that
  creature from combat." With only Forests in the library it works every time. It keeps you alive and wins nothing. (mine; not confirmed by the user)
  In an ordinary deck it is close to a bad card. This is the clearest example of value depending on the deck.
- **Others considered (read):** Zendikar's Roil, Eusocial Engineering (2/2 per land, smaller and costlier), Living Lands (Forests become 1/1
  creatures; exposes your lands). Arboria backfires: playing a land counts as putting a permanent onto the battlefield, so you stay attackable.

## Case 3: Fynn, the Fangbearer (mono-G)

Card (read): Deathtouch. "Whenever a creature you control with deathtouch deals combat damage to a player, that player gets two poison counters."

- **Needs:** many deathtouch creatures that connect. Cheap carriers are the point (the user, earlier today: a 1/1 deathtouch trades with
  a much stronger creature). Granters of deathtouch also count.
- **Wins:** poison. Ten poison loses (the card's own reminder text), so five connections per opponent (mine).
- **Reader bug found and fixed (commit d4df638):** the keyword pattern only matched the plural "creatures you control with", so Fynn's
  "a creature you control with deathtouch" never read as a keyword plan. This is a correctness fix, not a quality claim.
- The earlier numbers about the deck (19 deathtouch creatures in, 16 cheap ones out) did not reproduce in the offline harness, which has no theme pages.

## Hold-out: do not tune on these

The user wants to build and play **Teysa, Envoy of Ghosts** and **Tori D'Avenant, Fury Rider**. Check them last, after the bugs found
with the cases above are worked out. Teysa and Tori were looked at on 2026-11-12 (`dev/docs/superpowers/plans/2026-11-12-default-build-quality.md`),
so they are not untouched, but no change should be shaped to improve them. A final pass on them is the user's decision on whether the output
is something they would play.

## What is not valid evidence

- Role counts, curve shape, average mana value, 5+ mana counts, goldfish mana used.
- The 13 sample builds as a pass or fail. They may still show that a change did something.
- Any single-commander result, including these cases, as a reason for a per-commander fix (fix by category).

## How a change is judged

1. **Context tests (to write):** the same card scored in two decks must differ in the direction the case says.
   Examples: Lost in the Woods high in a deck whose library is Forests, low in an ordinary deck; Heartstone high for a mana-sink
   commander; a card that feeds what the commander produces (Red Hulk) found as well as one that supplies what it needs.
   Expect today's scoring to fail several; where it fails shows what the builder cannot see.
2. **Correctness tests** for reader bugs (like the singular wording): wrong parsing is wrong anywhere.
3. **Reconstruction (if the user has finished decks they stand behind):** build from the same pool and compare card by card, naming the reason
   for each miss. This needs no new labeling.
4. **The user's glance** at a build, rare and cheap: would they play it. The tool exists to save the user effort, so
   everything here should ask as little of them as possible.

## First probe results (2026-11-16, `dev/tests/jxa/context-cases.probe.js`, current main)

Hand-written cards from the Scryfall texts, scored with `scoreFallbackCard` under each commander's text. "Control" cards are
generic ones that should not outrank plan cards. Not a suite: it reports and never fails.

- **Ashling:** the reader sees "self-power, term" only (a body that grows). None of her plan cards link: Heartstone, Gauntlet of Might,
  Darksteel Plate, Mithril Coat, Swiftfoot Boots, PuPu UFO score 8-9 with no links; Red Hulk gets a 2-point weak term link.
  Generic controls beat them: a draw spell scores 13, a bolt 12, a board wipe 12, a mana rock 12. The role bonus (+3/+4) outweighs the plan.
- **Pia:** the reader sees "enters" only. Sapling Nursery scores 9, the same as a generic life-gain enchantment; Lost in the Woods scores 6.
- **Deck makeup:** Lost in the Woods scores 6 under Pia and 6 under an unrelated commander. No input for the deck's composition exists.
- **Fynn:** cheap deathtouch carriers pass (19 and 17 against a best control of 11), the result of the d4df638 reader fix and cost term.
  A deathtouch granter (Vial of Poison-like) gets nothing, though the case says granters count.

Four gaps, by category: (1) cost-and-sink commanders and symmetric-damage commanders are not read as such (Ashling);
(2) a commander that tutors "an X" does not make X-type cards plan cards, and which X is right depends on the deck (Pia);
(3) the deck's own composition is not an input; (4) enablers that grant the named keyword do not link (Fynn). Until a plan card is
linked, any role-tagged generic card beats it.

## EDHREC: unproven until it earns a role (the user, 2026-11-16)

The user's stance: assume EDHREC is wrong until shown to help. It records one way people built a commander, not which cards work
best together; the best way is to find the cards that work together with the commander (connections first).

One check, same day, public pages by commander slug, looking only for the cards the cases above identified:
- **Ashling (2,521 decks):** Heartstone 1520 (60%), Darksteel Plate 1310 (52%), Swiftfoot Boots 1277, Mithril Coat 1089, Gauntlet of Power 762,
  Hammer of Nazahn 625, Lightning Greaves 523, Gauntlet of Might 223 (9%). Absent: Red Hulk, Sword of Feast and Famine, Lost Jitte. Mountain is in
  2322 decks, but a normal page is a 36-land deck, not 99 Mountains.
- **Pia (935 decks):** Sapling Nursery 139 (15%), Lost in the Woods 151 (16%, filed under "High Lift"). The first cards on the page are
  Hexhaven Invigorator, Roiling Canopy, Verdant Kraken, Ghalta, Llanowar Elves, Eternal Witness, Beast Within: a normal green deck, not Pia plus Forests.

Reading: EDHREC contains most of these cards, so it can surface candidates (recall). It does not rank them by fit: Gauntlet of Might, the card I
rated best for Ashling, sits at 9%, and Pia's two enchantments sit at 15-16% under a page of ramp staples. The cards I tested were ones I had
already chosen, so this is weak evidence either way. Coverage, Ashling's page against the Oct 29 export: 1,807 owned nonland cards are legal in her colors; the page names 247 cards
and 42 of them are owned, 2% of the pool; 98% (1,765) is cards EDHREC says nothing about. A page lists a few hundred cards however
large the collection, so most slots on a large collection are decided without EDHREC, by the fallback path and the reader.
Not shown: that inclusion rate predicts plan fit. Treat EDHREC as a candidate source to be
read, not a score, until a test shows otherwise.

## Open

- Context tests are not written. Unmerged: branch `exp/soft-roles` (roles as a floor of 3/3/3/1); its verdict was drawn from template
  numbers and is unsupported. Step A (`d4df638`, singular keyword wording plus a small cost bonus for keyword carriers) is merged; the cost
  bonus is a heuristic that is not shown to help.
- Whether a "how it wins" line should be printed per build, and what it should say for decks where the answer is "it decides".
- Whether the deck's own composition (a library made of one land type) should feed scoring, and how.
