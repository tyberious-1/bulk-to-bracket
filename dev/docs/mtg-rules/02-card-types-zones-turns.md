<!-- Condensed from the Magic Comprehensive Rules effective 2026-11-06 by reading agents (see dev/docs/mtg-rules-primer.md). Rule numbers are the source's. Lines marked outside range or verify were not read: check them in the full text (bash dev/tools/jxa-harness/fetch_comp_rules.sh). -->
# CR notes 2: card types (3xx), zones (4xx), turn structure (5xx)

## 300 General
- 300.2: multi-type objects (artifact creature) are hit by effects for ANY of their types. 300.2a/305.9: any card that is a land plus another type is only played, never cast, so "cast a creature spell" payoffs never see it.
- 300.2b/308: Kindred is paired with another type, cast and resolved as that type, and shares creature subtypes (tribal payoffs see "Kindred Enchantment - Elf").

## 301-307, 310 Spell timing by type
- 301.1/302.1/303.1/306.1/307.1/310.1: artifact, creature, enchantment, planeswalker, sorcery and battle spells: cast only in YOUR main phase, stack empty, with priority (flash overrides). 304.1: instants whenever you have priority.
- 304.5/307.5: "any time you could cast an instant" needs only priority; "only as a sorcery" needs priority + your main phase + empty stack. This applies to abilities too (equip, level up). A flash card does not escape an ability that says sorcery speed.
- 304.4/307.4/400.4a: instants and sorceries cannot enter the battlefield; blink/reanimate on them does nothing. They reach the graveyard only after resolving (304.2/307.2): flashback and graveyard payoffs see them after that.
- 305.1: playing a land is a special action: no stack, not a spell, cannot be countered or responded to, and "cast" triggers ignore it (landfall does see it enter). 305.2: one land per turn by default. 305.4: "put onto the battlefield" (ramp, fetch) is NOT a land play and uses no land drop. 305.3: no land plays on others' turns.
- 305.6-305.8: basic land types carry an intrinsic "{T}: Add". Setting a land's type to a basic type removes its old types and rules-text abilities (not granted ones). A nonbasic land with a basic type is still nonbasic.
- 301.5: Equipment enters unattached; equip is a separate sorcery-speed ability. Equipment controller can differ from the creature's controller (301.5d). An Equipment creature cannot equip unless it has reconfigure. Unattaches as an SBA when illegal.
- 301.7: a Vehicle has P/T only while it is a creature. Crew makes it a creature "immediately" with printed P/T; other effects modify it.
- 302.6 SUMMONING SICKNESS: a creature can't attack or use abilities with {T}/{Q} in the cost unless it has been continuously under your control since your most recent turn BEGAN. Haste skips it (508.1a). Mana creatures cast this turn cannot tap; abilities without a tap symbol (sacrifice, pay mana) work at once. Keyed to time controlled, not time as a creature: a Vehicle you've held since last turn can attack the turn you crew it. A permanent whose control changes is sick again for the new controller.
- 302.4/302.7: power is combat damage dealt, toughness is damage needed to destroy; P/T exist only on creatures. Marked damage >= toughness is lethal (SBA). Wither/infect damage is not marked.
- 303.4: an Aura cast as a spell targets; put onto the battlefield any other way (reanimation), you choose what it enchants as it enters, and with no legal object it stays in its zone (303.4g). 303.4c/d: Aura on an illegal object, or a creature-Aura, goes to graveyard as SBA. Aura/enchanted-permanent controllers are independent (303.4e); a granted ability is activated by the enchanted creature's controller. 301.5f/303.4m: "enchanted/equipped creature" means whatever the permanent is attached to.
- 303.5 Saga: lore counter added as a turn-based action at the start of YOUR precombat main (505.4), before priority; chapter trigger then stacks. 303.7a: extra Roles from one controller: all but newest die.
- 306.5: planeswalker enters with loyalty counters (replacement effect). 306.5d: loyalty abilities only main phase, empty stack, one per planeswalker per turn. 306.8: damage removes loyalty; 306.9: 0 loyalty is an SBA. Can be attacked.
- 310: battle has defense counters; protector may block for it and cannot attack it; 0 defense is an SBA; Siege exiled and cast transformed when last counter removed (310.12b).
- 309, 311-315 (Dungeon, Plane, Phenomenon, Vanguard, Scheme, Conspiracy): nontraditional, command zone, never permanents, ignorable for deck-building.

## 400 Zones (general)
- 400.1: seven zones: library, hand, battlefield, graveyard, stack, exile, command. Library/hand/graveyard are per player. 400.2: public = graveyard, battlefield, stack, exile, command; hidden = library, hand.
- 400.3: an object going to a library, graveyard, or hand goes to its OWNER's. A stolen creature dying goes to its owner's graveyard; "your graveyard" payoffs count cards you own.
- 400.7 (KEY): an object that changes zones is a NEW object with no memory of its past. Resets counters, attachments, damage, tapped state, summoning-sickness clock, existing targets, effects on it, and "exiled with ~" links. Blink/bounce re-triggers ETB, strips counters, drops Auras and Equipment, makes it sick again. A spell targeting the old object fizzles even if the same card is back.
  - Exceptions: effects/info on a permanent SPELL carry to the permanent (400.7a-d: X, kicker, mana spent, "if cast from hand" checks); leaves-battlefield triggers can find the new object in a public zone (400.7e; Aura case 400.7f); a single effect or cost that moves an object to a public zone can follow it (400.7j); effects that let you cast/play a card from a zone can follow the new object (400.7g-i).
  - Exile an already-exiled object, or put a command-zone object into the command zone: new object, same zone (400.8, 400.10, 406.7).
- 400.6: replacement effects apply to the move before it happens ("enters tapped", "enters with counters" are replacements, so they are never triggers).
- 400.11: "outside the game" is not a zone; such cards can't be affected except by effects that bring them in. 400.12: an instruction on a zone acts on every card in it.

## 401-408 Individual zones
- 401: library is face-down, order hidden. "Nth from top" with fewer than N cards goes to bottom (401.7). A top card that stops being revealed becomes a new object (401.6). Draw, mill and impulse effects need cards in library; milling is not drawing.
- 402.2: hand size limit (7) is enforced only in cleanup (514.1); you can hold more all turn.
- 403.2: spells and abilities look only at the battlefield unless they name another zone or a player. "Creatures you control" never counts hand or graveyard. 403.3: only permanents exist there.
- 404.1: countered, discarded, destroyed, sacrificed objects and resolved instants/sorceries land on top of the owner's graveyard. Graveyard abilities (flashback, escape, unearth, "return from your graveyard") work only from that zone, so self-mill/discard fills the input. "Dies" means battlefield to graveyard, so discard or mill is not dying.
- 405.1: a cast spell is the card on the stack; abilities on the stack have only their text. 405.2: LIFO. 405.3: simultaneous triggers: active player's go on first (resolve last), nonactive in turn order; each controller orders their own. 405.4: triggered ability's controller is the source's controller at trigger time. 405.5: top resolves when all pass; if the stack is empty when all pass, the step ends.
- 405.6 NOT on the stack: effects themselves, static abilities, mana abilities (instant, unrespondable), special actions (land play, face-down flip), turn-based actions, SBAs, conceding. So lands and mana can't be countered, and SBAs happen before anyone gets priority.
- 406: exile is face up by default; "exiled face down" cards have no characteristics and may be played only as the effect allows (406.3a). 406.6: "cards exiled with this" is linked to that source's exiling ability only; a source that left and returned is a new object and loses the link (cards stay exiled).
- 408.1: command zone holds commanders, emblems and nontraditional cards; not permanents, can't be destroyed. Emblem abilities are permanent.

## 500 General turn structure
- 500.1: phases: beginning (untap, upkeep, draw), precombat main, combat (beginning of combat, declare attackers, declare blockers, combat damage, end of combat), postcombat main, ending (end step, cleanup). Each occurs every turn.
- 500.2: a step/phase ends only when the stack is empty AND all players pass in succession; each resolution gives everyone priority again.
- 500.4/500.5: "until [step]" effects expire as it begins; "until end of [step/phase]" as it ends, then unspent mana empties. Mana empties at the end of EVERY step and phase, so mana from main 1 can't be used in combat. 500.5a: "until end of combat" expires when the combat phase ends, not at the start of the end of combat step.
- 500.6: "at the beginning of X" triggers fire as X begins and are put on the stack the next time a player would receive priority. 500.12: nothing happens between steps.
- 500.7-500.11: extra turns, phases and steps are added right after the named point, newest first; an extra combat phase gets its own beginning of combat, attackers, etc. Skipping a step proceeds as if it didn't exist.

## 501-504 Beginning phase
- 502 untap: no priority. Order: phasing, day/night, then the active player untaps everything simultaneously (unless an effect stops it). Triggers from the untap step wait until upkeep (502.4); nobody can cast or respond during it. Untap-restrictions like "doesn't untap" apply to that single untap action.
- 503 upkeep: first priority of the turn. Untap-step triggers and "beginning of upkeep" triggers go on the stack before priority (503.1a).
- 504 draw: the draw itself is a turn-based action (no stack), THEN "beginning of draw step" triggers stack and priority arrives. Skipping the draw step skips the draw only; upkeep still happens.

## 505 Main phase
- 505.1: only the first main phase is "precombat"; all later main phases (even with combat skipped) are postcombat.
- 505.4: Saga lore counters at the start of precombat main, before priority (chapter I enters with the counter instead). A Saga cast in main 2 gets its next counter next turn.
- 505.6a: main phase is the normal window for artifact, creature, enchantment, planeswalker, sorcery spells. 505.6b: land play in either main phase, special action.
- Consequence: sorcery-speed effects need the active player's main phase with an empty stack, so they can't be done in response or on an opponent's turn without flash/instant permission.

## 506-507 Combat general, beginning of combat
- 506.1: five combat steps. Declare blockers and combat damage are SKIPPED if no creature is declared attacking or put onto the battlefield attacking (508.8). Beginning of combat and end of combat still happen even if you attack with nothing, so "at the beginning of combat" triggers fire every combat.
- 506.3: only creatures attack/block; only players, planeswalkers, battles are attacked. A noncreature put "attacking" never counts as attacking (506.3a); a creature put onto the battlefield attacking during declare blockers or later enters UNBLOCKED (506.3d).
- 506.4: a permanent leaves combat if it leaves the battlefield, changes controller, phases out, stops being a creature, regenerates, etc. Once declared, "can't attack/block" effects don't remove it (506.4a). Tapping or untapping a declared attacker/blocker neither removes it nor stops its damage (506.4b). If the planeswalker it attacked leaves, the attacker stays attacking, can be blocked, and deals no combat damage if unblocked (506.4c).
- 506.8: "cast only before/after attackers (blockers) are declared" refers to the declaration action, even if none declared.
- 507.1/507.2: multiplayer defender choice (non-all-opponent variants), then priority. Beginning of combat is the last window before attackers are chosen: crew a Vehicle, animate, grant haste or flying, or cast flash creatures here so they count at declaration. It is not a main phase: sorcery-speed things are unavailable.

## 508 Declare attackers
- 508.1: declaration is a turn-based action with no priority or stack, in order: choose untapped attackers with haste or continuous control since turn began (508.1a); choose each one's target (508.1b); check restrictions then requirements (508.1c/d: "attacks if able"; "can't attack alone"); tap them (508.1f, tapping is not a cost; vigilance prevents it); pay attack costs (taxes; not required, 508.1d); they become attackers (508.1k); attack triggers trigger (508.1m). Then triggers are stacked and the active player gets priority (508.2).
- 508.2a: "whenever a [quality] creature attacks" checks quality at declaration only.
- 508.3a: "whenever ~ attacks" triggers only for creatures DECLARED as attackers. Creatures put onto the battlefield tapped and attacking never "attacked": no attack triggers, and they ignore attack requirements/restrictions (508.4, 508.4c). 508.3b-e: "whenever [player] is attacked" once per combat per target; "attacks [a player]" excludes attacks on that player's planeswalkers.
- 508.3f/509.3g: "attacks and isn't blocked" triggers in the declare blockers step, not declare attackers.
- Ordering trap: all attack triggers resolve BEFORE blockers are declared, so removal, tokens, evasion or pump from attack triggers shape the blocks. But evasion gained after a legal block does nothing (509.1b).
- 508.5: "defending player" in an attacker's abilities means the player (or planeswalker controller / battle protector) it attacks; in multiplayer it's per attacking creature (508.5a).

## 509 Declare blockers
- 509.1: turn-based, defending player: untapped creatures only (tapped creatures can't block, but tapping a declared blocker doesn't undo it); legal under restrictions (flying, menace) and requirements; pay block costs; they become blockers; each attacker becomes blocked or unblocked (509.1h). Then block triggers, stacked before the active player gets priority (509.2a).
- Trap 509.1h: a creature that was blocked STAYS blocked even if all blockers are removed; it deals no damage to the player (absent trample). Removal after blocks doesn't make it unblocked.
- 509.3: "whenever ~ blocks" once per combat; "becomes blocked" once; "becomes blocked by a creature" once per blocker; none (except by-a-creature, 509.3d) trigger for creatures put onto the battlefield blocking. Characteristics are checked at blocking time only (509.3f).

## 510-511 Combat damage, end of combat
- 510.1: assignment is a turn-based action: each attacker/blocker assigns damage equal to its power (0 or less assigns nothing). Unblocked assigns to what it attacks; blocked divides among its blockers as its controller chooses (any split; no ordering); with no blockers left, assigns none (unless trample, elsewhere).
- 510.2: all assigned combat damage is dealt SIMULTANEOUSLY with no priority in between. Protective responses must come in the declare blockers step or earlier.
- 510.3: afterwards SBAs run, then "deals damage" and "dies" triggers stack (510.3a), then priority. A trade has already happened when its triggers go on the stack.
- 510.4 FIRST/DOUBLE STRIKE: if any attacker or blocker has first strike or double strike when the damage step begins, there are TWO damage steps. Step 1: only first/double strikers deal damage. Step 2: creatures that had neither at the start of step 1, plus current double strikers. Traps: a creature that gains first strike or double strike after step 1 starts deals no extra damage in step 1; it deals damage in step 2 (if it gains double strike it still deals only in step 2). A creature killed in step 1 never deals its step 2 damage. Double strikers trigger "deals combat damage" twice. Gaining first strike after step 1 has dealt damage doesn't let a creature deal damage "first".
- 511.2: "at end of combat" triggers as the end of combat step begins. 511.3: all creatures and planeswalkers leave combat when it ends. A creature put attacking at end of combat deals no damage (no step left, barring an extra combat).

## 512-514 Ending phase
- 513.1: "at the beginning of the (next) end step" triggers fire in the end step. 513.2: a permanent or delayed trigger created DURING the end step waits for the next turn's end step. Applies to triggers only.
- 514 cleanup: no priority normally. 514.1 active player discards to max hand size. 514.2 simultaneously ALL damage is removed AND all "until end of turn"/"this turn" effects end (so a creature surviving on pump + damage doesn't die when the pump ends). 514.3a: if SBAs apply or triggers are waiting (discards, "next cleanup step" triggers), they resolve, players get priority, and another cleanup step follows; new "until end of turn" effects made then last through the next cleanup pass.

## Quick timing cheat sheet
- Sorcery speed: your main phase, empty stack (creatures, equip, Sagas' counters, planeswalker abilities, land drops).
- Order inside a turn for a card reading its trigger: untap (no actions) > upkeep triggers > draw > main 1 > beginning of combat triggers (last window to crew/animate) > attack triggers (before blocks) > block triggers > combat damage (first strike step then regular) > damage/dies triggers > end of combat > main 2 > end step triggers > cleanup (discard, damage wears off).
- Zone matters: abilities work from the zone they name; default battlefield (403.2). Any zone change makes a new object (400.7).
- SBAs and trigger placement: before any player would receive priority; never between steps (500.12).

Read lines 1572-2455 (884 lines).
