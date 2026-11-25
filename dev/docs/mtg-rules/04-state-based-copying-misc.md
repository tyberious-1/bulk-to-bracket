<!-- Condensed from the Magic Comprehensive Rules effective 2026-11-06 by reading agents (see dev/docs/mtg-rules-primer.md). Rule numbers are the source's. Lines marked outside range or verify were not read: check them in the full text (bash dev/tools/jxa-harness/fetch_comp_rules.sh). -->
# CR notes 4: general terms, SBAs, copying, special card types, shared designations

## 700 General
- 700.1 Events: one happening can be one event for one ability and several for another ("becomes blocked" vs "becomes blocked by a creature"). Count-based triggers must read their own wording.
- 700.2 Modal: modes chosen on cast/put on stack; an illegal mode (no target) cannot be chosen. A copy keeps the chosen modes (700.2g); copy controller cannot re-pick. Same mode twice only if the card says so (700.2d). Pawprint "worth of modes" is a budget (700.2i).
- 700.4 **Dies = put into a graveyard from the battlefield.** Not "destroyed", not "sacrificed". A token that is exiled does not die; a token sacrificed does die (it hits the graveyard briefly, then 704.5d removes it).
- 700.5 Devotion counts mana symbols in costs of permanents you control (hybrid counts for both colors). Computed after copy/control/text changes but before other characteristic effects (700.5a), so a permanent that loses its color still counts. Tokens have no mana cost, so contribute 0. Altar of the Pantheon-style effects add flat devotion.
- 700.6 Historic = legendary, artifact or Saga. 700.7 "this [something]" tracks the object even if it stops being that thing.
- 700.8 Party: up to one each of Cleric, Rogue, Warrior, Wizard, count 0-4, best assignment chosen automatically (a creature with several party types counts once). Changelings do count.
- 700.9 **Modified** = has a counter, is Equipment-equipped, or is enchanted by an Aura its controller controls. An opponent's Aura on it does NOT modify it.
- 700.11 Descended = a permanent card went to your graveyard from anywhere this turn (including from hand or library, and a card that has since left). 700.12 Outlaw = Assassin, Mercenary, Pirate, Rogue, Warlock.
- 700.13 Crime = you target an opponent, an opponent's permanent/spell/ability, or a card in an opponent's graveyard.
- 700.14 Expend N = total mana spent on spells this turn crosses N (triggers once, on the spell that crosses).
- 700.15 "Enters" = enters the battlefield. 700.17 Dilemma = choosing modes.

## 703 Turn-based actions
- 703.1/703.3 Do not use the stack; happen first at step start, before SBAs and before triggers go on the stack. Untap, draw, attack/block declaration, damage dealing, cleanup discard.
- 703.1a "At the beginning of X" abilities are triggers, not turn-based actions. Phasing, day/night check, untap come in that order during untap (703.4a-c); nothing is cast in untap step.
- 703.4f/715.3c Saga lore counters are added as the precombat main phase begins (turn-based), before triggers: chapter abilities then trigger and use the stack.
- 703.4q Mana empties at the end of every step and phase (no mana carry between steps).
- Trap: a "draw" in the draw step (turn-based) happens before anything can respond; "beginning of draw step" triggers go on the stack after.

## 704 State-based actions (SBAs)
- 704.3 Checked whenever a player would get priority. All applicable SBAs happen simultaneously as one event, then rechecked repeatedly; only when none apply do waiting triggers go on the stack, then check again. So SBAs always resolve before any trigger is put on the stack.
- 704.4 SBAs ignore mid-resolution states. A creature at 0 toughness halfway through a spell's resolution survives if it is fine when the spell finishes. A trigger watching the state would trigger mid-resolution, but SBAs do not.
- 704.1a Anything that "watches" a state with "whenever/when" is a trigger, not an SBA.
- Key SBAs (704.5):
  - a: life 0 or less loses. b: drew from an empty library since last check loses (not "has an empty library"). c: 10+ poison loses.
  - d: **token not on the battlefield ceases to exist** (so tokens still trigger leaves-battlefield/dies abilities; they briefly exist in the graveyard; but a token cannot be returned from graveyard or exile).
  - e: copy of a spell off the stack, or copy of a card off stack/battlefield, ceases to exist.
  - f: toughness 0 or less -> graveyard; **no regeneration, indestructible irrelevant**. g: lethal damage -> destroyed (indestructible and regeneration matter). h: any damage from a deathtouch source -> destroyed.
  - i: planeswalker with 0 loyalty dies.
  - j: **legend rule**: same controller, same name, you keep one, rest go to graveyard (it is "put", not destroyed: indestructible does not help; each goes to graveyard so dies triggers happen). Different controllers do not conflict. Name-based, so two different legendary creatures of the same name is the only trigger; a legendary token copy with the same name counts.
  - m: Aura illegally attached or unattached goes to graveyard (dies-triggers? No, it is not a creature). n: illegal Equipment just unattaches and stays. p: attached creature/non-Aura becomes unattached.
  - **q: +1/+1 and -1/-1 counters annihilate in pairs, N = the smaller count.** Done as an SBA, so both can be on a permanent momentarily; triggers that care ("whenever a +1/+1 counter is put on") still fire at the put, and proliferate/doublers see both kinds. Last-known-info is taken before SBAs (704.8): Young Wolf with one +1/+1 and three -1/-1 counters dies with its +1/+1 counter, so undying does not trigger.
  - r: "can't have more than N counters" removes the excess.
  - s: Saga sacrificed when lore counters >= final chapter and no chapter ability of it is still on the stack/triggered. Trap: the Saga stays until the last chapter ability leaves the stack; blinking or copying matters.
  - v/w battle defense 0; z multiple Roles from same controller, newest stays.
- 704.6c Commander: **21+ combat damage from the same commander** loses (counts per commander, includes partner as separate; damage only, not from copies of the commander, since "commander" is the card). 704.6d Commander in graveyard or exile **since last SBA check**: owner may move it to the command zone (an option, not forced; applies only if it arrived since last check, so a commander exiled and you decline stays there until it moves again). Hand/library are replacement-effect territory, not this SBA.
- 704.7 Several SBAs with the same result (two losses) can be replaced by one replacement effect.
- 704.8 If SBAs remove permanents together, last-known information is from before any SBA ran (the undying example).
- Interaction notes: counters kill Persist/undying logic; a -1/-1 counter on a creature with a +1/+1 counter shrinks the permanent permanently only after cancelation; death-trigger engines and token engines see tokens die via 704.5d ordering.

## 705-706 Coin and die (skimmed)
- 705.2 "Win/lose" the flip only matters when the player calls; effects that say a flip is won override results. 706.2 Natural result vs final result; modifiers apply after; reroll effects are applied before add/subtract (706.2b). 706.6 Ignored roll never happened.

## 707 Copying
- 707.2 **Copiable values** = printed name, mana cost, color indicator, types, subtypes, supertypes, rules text, P/T, loyalty, defense, as changed by other copy effects, face-down status, and "as enters / turned face up" P/T setters. **Not copied**: counters, stickers, status (tapped, flipped), Auras/Equipment attached, type or text changing effects, pump effects, "becomes a creature until end of turn" effects. Clone copying an animated manland or Chimeric Staff gets the noncreature version. Copy of a +1/+1-countered creature has no counters. A copy of a copy copies the copy's copiable values (707.3), including exception abilities granted (707.9a).
- 707.2a Color comes from mana cost or indicator, so copies keep the copied color. 707.2b Later changes to the original do not change an existing copy.
- 707.5 A permanent that enters as a copy is a copy as it enters: it triggers the copied enters triggers and uses copied "enters with" replacement effects (Clone of Skyshroud Behemoth enters tapped with fade counters; Clone of Wall of Omens draws).
- 707.6 **Choices are not copied.** "As this enters, choose a type" is chosen anew by the copy's controller. Linked abilities stay linked within the copy (707.7).
- 707.8 Copy a DFC: uses the face currently up. 707.8a A token copy of a DFC is a double-faced token with both faces, entering back-face-up if the original was. Trap: a token copying a Clone is not DFC.
- 707.9 Exceptions: gained abilities and modified characteristics become part of copiable values (707.9a/b). 707.9d: a characteristic-defining ability that defines a characteristic the copy sets differently is not copied (Quicksilver Gargantuan copying Tarmogoyf is 7/7 with no CDA), except "in addition to its other types" exceptions keep CDAs. 707.9e/g: extra enters-with counters or linked triggers do not happen if another copy effect is applied afterwards.
- 707.10 **Copying a spell or ability** puts a copy on the stack; it is NOT cast or activated (no cast triggers, no activation triggers) but is a spell/ability. Copies the modes, targets, X, kickers, additional and alternative costs (but "choices made on resolution" are not copied). Info about objects used to pay costs uses the original's (Fling copy uses the original sacrificed creature); mana spent is not an object, so "if {G} was spent" gives nothing on a copy. 707.10f a copied permanent spell becomes a token on resolution. 707.10a a copy of a spell elsewhere than the stack ceases to exist. 707.10c new targets for a copy are optional per target, legal needed only for changed ones. 707.10b copy of an ability has the same source.
- 707.11 Effects that name a permanent keep tracking it through name changes/copy changes.
- 707.12 "Cast a copy of a card" creates it in the zone where the object is, then casts it, following normal casting, so it is cast and triggers cast triggers. Difference from 707.10 matters for storm/cascade-like cast triggers: copying a spell triggers none, casting a copy does.
- 707.4 A permanent that changes what it is copying (shapeshifter) does not retrigger enters/leaves, and keeps non-copy effects.
- Traps: a token copy of a creature has no counters; a copy of a legendary permanent hits the legend rule; Clone-based tokens' own copiability does not make them DFCs; copying a permanent that was "enchanted" does not copy the Aura.

## 709 Split cards (incl. Rooms)
- 709.2 One card. Cast one half; on the stack only that half exists (709.3b). Everywhere else (hand, graveyard, library, battlefield for non-Rooms) it has both halves combined: both names, both costs combined, mana value = sum, both colors, both types (709.4). Fuse on the stack is the combined version (709.4d).
- Trap: a split card in the graveyard is both colors and has combined mana value, so "mana value 3 or less" tutors and reanimation read the sum. Cast as a half, the spell has only that half's mana value.
- 709.4a Name choice: pick one of the names.
- 709.5 Room cards (shared type line): doors "unlocked" as cast; unlock via special action paying the locked half's cost at sorcery speed; unlock/lock designations are part of copiable values. Triggers: unlocking a half, fully unlocking (709.5h/i). A locked half has no name, cost or text.

## 710-711 Flip and Leveler
- 710 Flip cards: only the battlefield flipped permanent uses the bottom characteristics; flipping is one way; color and mana cost never change. 710.2 Elsewhere and before flipping, only normal characteristics.
- 711 Level up: level counters grant abilities and base P/T at ranges; level up ability is always available. Level counters are unrelated to Class levels (711.7, 717.4).

## 712 Double-faced cards
- Two kinds: nonmodal (transforming, front/back) and modal (MDFC, choose a face).
- 712.6a Outside battlefield/stack, a DFC has **only front-face characteristics** (hand, library, graveyard, exile). So a graveyard Delver-type back-face creature card is the front face; searching "creature" for a front-face noncreature DFC fails.
- 712.6b/d Mana value of a back face is the **front face's mana cost** (202.3b); a permanent copying a back face of a nonmodal DFC has mana value 0 (a Clone of a transformed werewolf is MV 0).
- 712.8 Cast with front up by default; if an effect lets you cast it "transformed", it goes on stack back-face-up (the front's ability counts when judging castability, 712.8d). 712.8b MDFC: choose face before casting; only that face is evaluated. 712.9 MDFC played as land: choose a land face; the other face cannot be lands in front if not a land. A back face that is an instant/sorcery cannot enter the battlefield (712.11b: stays where it is, or goes to graveyard from the stack).
- 712.10 A resolving DFC spell enters with the face that was up on the stack. 712.11 Put onto battlefield from other zones: front face up unless "transformed". 712.11a a non-DFC cannot be put onto the battlefield transformed; it stays put.
- 712.15 **Transforming does not create a new object**: counters, Auras, effects stay; no leaves/enters triggers (but "when this transforms" triggers exist). 712.7 Only DFC permanents/tokens can transform. 712.12/13 Face-down DFCs cannot transform; DFC permanents cannot be turned face down (nothing happens).
- 712.16 Name choice: either face name, not both.
- Commander consequence: the commander's color identity uses both faces (Commander rules elsewhere); in hand/library/graveyard only front characteristics matter for type-counting.
- Trap: copying a transformed DFC creates a DFC token that can transform back; a Clone-style copy of the back face is not a DFC.

## 713 Meld
- Meld cards are not DFCs and cannot transform (713.1c). Melded permanent = one object from two cards, MV = sum of front-face MVs (713.5c; MV 0 if copied). 713.8: when it leaves, one permanent left but two cards moved: "whenever a creature dies" triggers once, "whenever a card is put into a graveyard" triggers twice. Replacement effects applied to one card apply to both. In other zones a meld card has only its front face.

## 714 Substitute cards: only physical-play bookkeeping.

## 715 Sagas
- Chapter abilities are triggers: when lore counters are put on and the count crosses from below N to at least N. Enters with 1 lore counter (or read-ahead choice), +1 at the beginning of each precombat main phase (turn-based). Sacrificed (SBA) when counters >= final chapter and none of its chapter abilities are still on the stack. Adding two lore counters at once triggers every chapter whose threshold was crossed. Blinking resets it to chapter I.

## 716 Adventurer cards
- One card with an Adventure half (instant/sorcery). 716.3: choose normal or Adventure when casting; on the stack as an Adventure only the Adventure characteristics exist (its color, MV and type are the Adventure's). **716.3d: when an Adventure spell resolves, it is exiled instead of going to the graveyard, and its owner may cast the creature half from exile later** (not as an Adventure again, unless another effect allows). Consequences: the creature half is castable from exile but cannot be "played" as a land; if the Adventure spell is countered or fizzles it goes to the graveyard (no exile), and "if the Adventure was cast" is not the same as "it resolved". Copies of an Adventure spell are also Adventures but are not cards, so they never go to exile as cards. 716.4 Everywhere else only the creature characteristics apply. Cards "that have an Adventure" are identified by the alternative characteristics existing (716.2a). Cast triggers on the Adventure side see an instant/sorcery spell, not a creature spell.

## 717 Classes
- Class level is a designation, not a counter; levels advance only one at a time (activate Level N only when at N-1) at sorcery speed; abilities of a level apply while level >= N. Class retains level if it stops being a Class; no level = level 1. Not related to level counters.

## 718 Attractions (Astrotorium) are non-deck cards, no relevance for Commander deck building. 719 Prototype
- Choose normal or prototyped when casting; prototyped spell and the permanent have the alternative P/T, cost and **colors derived from that alternative cost**; mana value is the prototype's while it is the spell/permanent (not the card's). In other zones normal characteristics. Copies of a prototyped permanent keep the prototyped values.
- 720 Cases: "To solve" is an end-step trigger with an intervening if; solved is a designation (not copiable). "Solved —" abilities only work after solved.
- 721 Omen cards: like Adventures but the Omen spell is **shuffled into its owner's library on resolution** (721.3d), not exiled, so nothing is cast from exile; it goes to the graveyard if countered. 721.2a: "has an Omen" refers to existing alternative characteristics.
- 722 Stations: static ability at N or more charge counters; permanent becomes an artifact creature with base P/T only at the threshold, and has no P/T off the battlefield.
- 723 Preparation: the inset spell cannot be cast directly from the card; when a permanent gains "prepared" a copy of the prepare spell is created in exile and can be cast while it remains prepared and on battlefield. Prepared designation is lost when the copy becomes cast. Exempt from 704.5e.

## 724-725 Controlling another player; ending turns
- 724 Controls decisions only (not objects); controlled player is still the active player; cost resources are theirs; they can still concede.
- 725 Ending a turn/combat: triggers that had triggered but not yet gone to the stack are removed; stack exiled (including the resolving spell); SBAs checked; end step skipped, so "at the beginning of the end step" triggers do not happen; triggers produced by the process go on the stack in cleanup, giving priority, then another cleanup. Mandate of Peace only ends combat; end-of-combat triggers skipped.

## 726 The monarch
- A game designation held by one player, shared across all cards. Two inherent triggers: draw a card at the beginning of the monarch's end step (ability controller is the monarch at trigger time); whenever a creature deals **combat damage** to the monarch, the creature's controller becomes monarch (not noncombat damage, not damage to a planeswalker). Only one monarch; becoming monarch removes it from the current one. Becoming monarch when already monarch does nothing new. If the monarch leaves the game, the active player becomes monarch (or the next player in turn order if the active player is leaving). Triggers on "becomes the monarch" fire on each change. Traps: there is no monarch until some effect makes one; "as long as you're the monarch" effects do nothing with no monarch (726.5); an opponent stealing it makes your Monarch-linked draw support theirs, so a monarch card is a shared resource, not private card advantage; evasive or fast creatures are needed to keep it.

## 727 The initiative
- Designation like monarch. Three triggers: venture into Undercity at the beginning of the initiative holder's upkeep; venture when a player takes the initiative; combat damage from creatures to the holder transfers it. One holder at a time. Taking the initiative while you already hold it still triggers the venture but does not create a second designation (727.5). Leaving player -> active player gets it. Ventures use a dungeon (701.49), so a venture can trigger on the stack twice per turn cycle (upkeep plus on gaining).

## 728 Restart (Karn Liberated only), 730 Subgames (Shahrazad only), 731 merge (mutate)
- Mutate (731): merged permanent has only topmost component's characteristics; is the same object (no enter triggers, no summoning sickness reset); it is a token only if the top component is a token; leaves as one permanent, many cards (like meld). Characteristics are the top component's "unless otherwise specified" (the mutate keyword itself, in rule 702.140 outside my range, is what keeps lower components' abilities; verify there).

## 729 Rad counters
- Counter kind on players. At the beginning of each player's precombat main phase, that player mills equal to their rad counters; each nonland milled loses 1 life and removes one rad counter. Mill-based decks interact (cards milled go to the graveyard, triggers for mill fire).

## 732 Day and night
- Designation of the game, starts with neither. A daybound/nightbound permanent (or an effect) makes it day. Checked in the untap step (before untapping): if it is day and the previous turn's active player cast **zero spells** it becomes night; if it is night and the previous turn's active player cast **two or more** it becomes day. A card cast by someone other than the active player does not count. A player doing nothing on their turn flips it to night; a spell-heavy player flips it back. If neither, never starts. Traps: it depends on the previous turn's active player only; copies of spells are not cast, so they do not count; Mutate/transform side effects belong to daybound/nightbound rules (702.145), not here.

## 733-734 Shortcuts and illegal actions
- Loops: shortcuts proposed as a fixed sequence with no conditional choices, can cross turns; each player can shorten it. A loop containing only mandatory actions is a draw (733.4). No player can be forced to break a loop by performing an optional action; a "unless" cost does not have to be paid (733.6). A fragmented loop: active player must break it first. Illegal actions are reversed, with no triggers.

Lines read: 1018 (3204-3284, 5488-5750, 5782-6455), of which roughly 700 were relevant and the rest skimmed.
