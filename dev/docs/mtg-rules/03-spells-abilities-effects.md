<!-- Condensed from the Magic Comprehensive Rules effective 2026-11-06 by reading agents (see dev/docs/mtg-rules-primer.md). Rule numbers are the source's. Lines marked outside range or verify were not read: check them in the full text (bash dev/tools/jxa-harness/fetch_comp_rules.sh). -->
# CR chapter 6 notes (rules 601-616), for reading oracle text as programs

## 601 Casting spells
- 601.2 Order: (a) card moves to stack, you become controller; (b) announce modes, alternative/additional costs (kicker, buyback), X value, hybrid/Phyrexian choices; (c) targets; (d) divisions; (e) legality check; (f) determine total cost; (g) activate mana abilities; (h) pay; (i) spell becomes "cast", cast triggers fire.
- Cast triggers ("whenever you cast") fire AFTER costs are paid (601.2i), with the spell still on the stack under them, so they resolve first. A targeted trigger ("becomes the target of") also waits until casting finishes (601.2c).
- 601.2b: only ONE alternative cost per spell (no two alternatives at once). Additional costs (kicker, commander tax, "as an additional cost") stack freely on top.
- 601.2f total cost = (mana cost OR alternative cost) + additional costs + increases - reductions. Reductions apply in any order the caster likes. Mana component floors at {0}. Reductions can't touch colored requirements beyond generic: they only reduce generic mana (rule 118 elsewhere), so a {1}{G} spell reduced by 2 costs {G}. Total cost is then locked in; later changes do nothing.
- Trap: sacrificing a cost reducer to pay an additional cost still gets the discount, because cost is locked before payment (601.2h Altar's Reap example).
- Trap: "first spell each turn" cost reducers/limiters are static effects checked at the moment cost is determined. Whether a spell is "the first" is a game-history fact.
- Cost reducers do not make a card castable earlier by mana value: mana value never changes (still on the card); only mana paid changes. Ramp and reducers both bring a plan online sooner, differently.
- 601.2h: costs paid all at once, partial payment illegal; unpayable cost = can't cast.
- 601.2a: continuous effects granting abilities to a spell begin when it hits the stack (storm-like or "spells you cast have X"). 611.2f: "next spell you cast this turn" effects apply when that spell is put on the stack.
- 601.3: you may begin to cast only if allowed; 601.3a-d: effects that restrict by spell quality can be sidestepped if a choice (X, alternative cost) could change the quality.
- 601.8 / 602.4: cost-altering effects do not affect spells/abilities already on the stack.
- Casting vs "playing": "play" a card = land drop OR cast. A land is never cast; "whenever you cast a spell" does not see lands, and playing a land does not use the stack.
- Casting from other zones (top of library, graveyard, exile) is "cast"; it triggers cast effects and counts as casting for "first spell" wording just like from hand. Commander cast from the command zone is a cast too.

## 602 Activated abilities
- Form "[Cost]: [Effect]". Everything before the colon is the cost; text after it is restrictions/instructions that apply always (not part of effect). Only activated abilities are "activated".
- 602.2: activating = put on stack as an ability object (not a card, no characteristics except text), choose targets, pay costs. Same steps as 601.2b-i (so costs can be reduced/increased, X chosen, etc).
- 602.5a: {T}/{Q} cost on a creature needs it to have been under your control since your most recent turn began (summoning sickness), unless haste. Not applicable to non-creature permanents (artifacts like mana rocks can tap immediately). Applies only to the tap SYMBOL cost; "tap an untapped creature you control" costs (crew, convoke) are not {T} so summoning-sick creatures CAN pay them.
- 602.5b: "Activate only once each turn" stays on the object even if control changes. 602.5d: "activate only as a sorcery" = timing only.
- Responses: the ability is on the stack; it resolves independently of its source. If the source dies in response, the ability still resolves (using last known information, 608.2h).
- Costs are paid on activation; sacrifice/discard costs can't be responded to (a "sacrifice as a cost" outlet beats removal). Effects that happen on resolution can.

## 603 Triggered abilities
- Form "When/Whenever/At [event], [effect]". 603.2: the ability triggers automatically when event occurs, can trigger even when spells can't be cast. Nothing happens until it is put on the stack.
- 603.3: a triggered ability goes on the stack the next time a player would receive priority (so after the current spell/ability finishes resolving, or after the step begins). It does NOT interrupt the thing that caused it. The causing spell resolves fully (608.2p: "when this resolves" triggers happen after all steps), then triggers stack, then players get priority.
- 603.3b APNAP: if several abilities triggered, the active player puts theirs on the stack first (in any order they choose), then each other player in turn order. So the nonactive players' triggers end up on TOP and RESOLVE FIRST. Trap: the active player's triggers resolve last. State-based actions are checked before triggers are put on stack.
- 603.2c: triggers once per event, but once per occurrence if one event has many occurrences (Wrath of lands: once per land).
- 603.2d: "triggers an additional time" (Panharmonicon-type) multiplies a given object's own triggers only, not delayed/reflexive ones it creates.
- 603.2e: "becomes" triggers (tapped, blocked) only on the change, not when something enters in that state.
- 603.2g: prevented or replaced events never happened, so they trigger nothing (e.g., damage prevented to 0 does not trigger "whenever dealt damage"; a replaced "dies" event doesn't trigger death payoffs). Traps: a creature exiled instead of dying does not die; a token or card replaced from graveyard to exile does not "go to graveyard".
- 603.4 Intervening "if": "When X, if Y, do Z" checks Y on trigger AND again on resolution. Any other "if" later in the sentence is just English, checked only on resolution. Wording "When X, you may Y. If you do, Z" is NOT intervening.
- 603.5 Optional triggers ("you may") ALWAYS go on the stack; the choice is made on resolution. Hence "may" triggers still count as triggering for other cards ("whenever an ability triggers") and are not a cost. "Unless" clauses likewise resolve on resolution.
- 603.6a ETB: "When X enters" triggers for each permanent entering, including the source itself and permanents entering simultaneously with others (all permanents on battlefield checked, newcomers included).
- 603.6d: "enters with", "as enters", "enters tapped" are static/replacement, NOT triggers. Counters from "enters with" are there before any enters trigger sees the permanent; an "as enters" choice happens before it's on battlefield and can't be responded to.
- 603.6b/611.3c: continuous effects apply as the permanent enters, so a permanent entering as a creature (e.g., via "all lands are creatures") triggers "creature enters". Effects that remove abilities can stop its own ETB from triggering.
- 603.6c/603.10a "Look back in time": leaves-the-battlefield, dies, sacrifice, leave-graveyard abilities and "put into a hand/library" triggers check the game as it was just BEFORE the event. So a death-payoff sees creatures dying simultaneously with it (Blood Artist dies together with others: triggers for all, including itself). Contrast ETB: sees the state after.
- 603.10 other look-back: phase out, becomes unattached, loses control, spell countered, player loses game.
- Trap: a leaves-battlefield trigger that wants to act on the card finds it only in the FIRST zone it went to (603.6c). A creature that dies and is then exiled in response can't be returned by "return it from graveyard".
- 603.7 Delayed triggers: created during resolution ("at the beginning of the next end step, sacrifice it"); trigger once unless duration stated; won't fire if created after the event already passed (603.7a). 603.7c: affects the object only if still in the zone expected (a blinked or bounced object is a new object and is not affected, 400.7).
- 603.7d-e: delayed trigger controller is the controller of the spell/ability that created it.
- 603.8 State triggers ("whenever you have no cards in hand"): trigger when state is true; do not retrigger until the first leaves the stack.
- 603.12 Reflexive triggers: "You may sacrifice X. When you do, [effect]" creates a trigger immediately, inside resolution, that only fires if the action happened as part of THIS resolution. Differs from "if you do" (a single effect, no separate stack object, no new targets chosen). Reflexive trigger can pick targets fresh and can be responded to; "if you do" cannot.
- 603.11/607.2h: static ability + triggered abilities in one paragraph (e.g., "Reveal the first card you draw each turn. Whenever you reveal a basic land this way, draw") are linked.

## 604 Static abilities
- 604.1: just true all the time; no stack, can't be responded to; effects follow the permanent's presence.
- 604.2: active while the permanent is on the battlefield (or object in the right zone, see 113.6). Cards like "Spells you cast cost less" only apply while the permanent is on the battlefield.
- 604.3: characteristic-defining abilities (CDA) function in ALL zones (e.g., "this card's power is the number of cards in your graveyard" works in hand/library). They define color, subtypes, P/T only, apply first within their layer.
- 604.5: abilities on the stack: additional costs, "rather than pay mana cost", "without paying its mana cost" work on stack. 604.6: "You may cast this from your graveyard" style functions from that zone.
- 604.7: static abilities use current information, not last known information.
- 604.4: Auras/Equipment statics modify the attached object without targeting.

## 605 Mana abilities
- 605.1a: an ACTIVATED mana ability = no target, could add mana, not a loyalty ability, doesn't move cards to/from library. 605.1b: a TRIGGERED mana ability = no target, triggers from a mana ability activation or from mana being added, and could add mana (Mirari's Wake type "whenever you tap a land for mana, add one more").
- They never use the stack: can't be responded to, countered or targeted; resolve immediately (605.3b, 605.4a). They can be activated mid-casting to pay costs (605.3a).
- Traps: a spell is never a mana ability (605.5b; Dark Ritual is a spell and uses the stack). An ability with a target isn't a mana ability. Treasures: sacrificing is a cost and "add one mana" is a mana ability, so it's instant-speed and cannot be responded to. A mana ability that also makes tokens/draws (Treasure-type extras) is still a mana ability as long as criteria hold (605.1 "regardless of other effects").
- Ability that adds mana but also searches library for a land (moves cards from library) is NOT a mana ability, uses the stack.
- 605.2: remains a mana ability even if it produces nothing now.

## 606 Loyalty abilities
- Cost is adding/removing loyalty counters. Once per turn per planeswalker, sorcery timing, only when stack empty (606.3). Negative cost needs enough counters (606.6). Cost modification possible (606.4-5). Extra loyalty activations are granted by effects (Oath of Teferi).

## 607 Linked abilities
- Two abilities on the same object are linked when one performs an action and the other refers to "the exiled cards", "chosen [value]", "noted information", "put onto the battlefield with this", "cost paid as it entered", "whether kicked" (607.2a-q).
- The second refers ONLY to things done by the first (607.1). Cards exiled with Card A by an unrelated effect do not count. Three-ability cards can be linked pairwise (607.4: choose a color + trigger + mana ability).
- 607.5: copying only one half of a linked pair gives an "undefined choice" and the second does nothing (607.5a).
- Consequence: "exiled with ~" lists are per-object; a flickered or re-entered source is a new object and forgets its exile pile (400.7).

## 608 Resolving
- 608.1: when all players pass in succession, TOP of the stack resolves. LIFO.
- 608.2a-b: intervening-if rechecked first, then targets rechecked. If ALL targets are illegal, the whole spell/ability fizzles (does nothing, including non-targeted parts, e.g. Sorin's Thirst lifegain doesn't happen). If at least one target is still legal, it resolves and does what it can to legal targets only.
- 608.2c: instructions are followed in written order; replacement effects can modify; later text can modify earlier ("Destroy target creature. It can't be regenerated"). Read as English.
- 608.2d: choices made during resolution are made then, and must be legal; "you may sacrifice a creature. If you don't, ..." can't be chosen if you control none (so the penalty applies).
- 608.2e-f: multi-player actions: choices in APNAP order, processed simultaneously where possible.
- 608.2g: casting during resolution (cascade, "cast it without paying"): spells cast that way go on the stack above the resolving one but the original keeps resolving first; no priority until it finishes.
- 608.2h: information from the game is determined ONCE when the effect applies (X, "the number of creatures you control"); information about a specific object uses its current state if still in the expected public zone, else last known information.
- 608.2i: "this turn" look-backs (e.g., "for each creature you attacked with this turn") don't require the objects to still be in that state.
- 608.2k: a specific object named by cost or trigger condition is still affected even if it changed characteristics.
- 608.2m: once a legally resolving spell starts, it finishes even if it leaves the stack.
- 608.2n-p: instant/sorcery goes to the graveyard LAST; "when this resolves" triggers fire after all steps. So a spell that mills or discards doesn't see itself in the graveyard during resolution (graveyard-count X on the spell itself excludes it).
- 608.3: permanent spells resolve by entering the battlefield; illegal-target Aura goes to the graveyard (not battlefield). An ETB trigger triggers after the spell has resolved and the permanent is on the battlefield.

## 609 Effects
- 609.1: text is never an effect; resolving spells/abilities create one-shot or continuous effects; statics create continuous effects.
- 609.2: effects apply only to permanents unless stated otherwise ("creatures you control" doesn't affect creature cards in hand/graveyard, but "spells cost less" affects spells on the stack).
- 609.3: do as much as possible ("discard two" with one card discards one; "mill/exile top N" does as many as exist). Trap: a cost can't be partially paid, but an EFFECT can be partially done.
- 609.4: "as though" effects apply only to the stated thing; both can combine (609.4a); "spend mana as though any color" changes payment only, not the cost (609.4b), so color-requirement "was colored mana spent" checks still see the real mana.
- 609.7: damage-source shields.

## 610 One-shot effects
- Do something once, no duration (damage, destroy, create token, move zones). 610.3: "until" zone-change effects (O-Ring style): second one-shot returns the object when the event happens; if the event already happened before the first would apply, nothing moves; returns under owner's control. Banisher Priest exiled cards return simultaneously if the priests die simultaneously (610.3d). Return is a new object (ETB triggers again).
- 610.5: one-shot effects that give spells abilities as cast apply upon stack entry.

## 611 Continuous effects
- 611.2a: from a resolving spell/ability: lasts as stated; with no duration, lasts until the end of the game (so "target creature gets +1/+1" with no duration is permanent).
- 611.2b: "for as long as" ending before the effect starts = does nothing.
- 611.2c KEY TRAP: a continuous effect from a RESOLVING spell/ability that changes characteristics or control locks its affected set at resolution ("creatures you control get +1/+1 until end of turn" will NOT affect creatures entering later). But one that changes game rules (can't, must, damage prevention, "spells cost less this turn") applies to objects arriving later.
- 611.2d: X in a resolving effect fixed on resolution.
- 611.3a: a STATIC ability's effect is NOT locked in: applies live to whatever matches ("creatures you control get +1/+1" lord covers newcomers, loses effect when the lord leaves).
- 611.2e: "is/has [characteristic]" applies as the permanent enters; "becomes"/"gains" applies after it's on battlefield (so a "becomes a creature" effect doesn't make it enter as a creature for ETB purposes).
- 611.2f next-spell effects: apply when the spell is put on the stack.

## 612 Text-changing
- Changes only words used correctly (color word as color, creature type as type). Cannot change card names (612.2) or abilities granted to an object (612.3). Tokens' subtypes/text can change.

## 613 Layers (overview)
1 copiable values (copy effects, face-down); 2 control; 3 text; 4 types/subtypes/supertypes; 5 color; 6 abilities added/removed (including keyword counters; "can't have" abilities); 7 power/toughness: 7a CDAs, 7b set to a value (also "base P/T"), 7c modifiers and +1/+1 counters, 7d switch.
- Within a layer: CDAs first, then timestamp order (613.3), but dependency overrides timestamp (613.8). 613.7: timestamp = when the object entered the zone or effect was created; Equipment/Aura get a new timestamp each time attached.
- Consequences: counters and +N/+N pump apply after "becomes X/Y" set effects regardless of order (so a base-set effect doesn't erase counters). Doubling effects ("double its power") are one-shot or ongoing effects that compute a value at that moment and apply in 7c; an effect resolving later in time wins ties inside a layer.
- Static effects always layer-applied continuously; "lose all abilities" (layer 6) vs "gains haste" (layer 6) resolved by timestamp, later wins. Type change (layer 4) happens before abilities (6) and P/T (7), so "becomes a creature" and then pump works.
- 613.11: effects on game rules and cost effects apply last; cost effects follow 601.2f.

## 614 Replacement effects
- Rewrite an event as it WOULD happen; no stack; can't be responded to; the original event never happens (614.6). Markers: "instead", "skip", "enters with/as/tapped" (614.1a-e), "if X would, Y instead", regeneration (614.8), redirection.
- vs TRIGGERS: replacement = "If/As ... would ... instead"; trigger = "When/Whenever/At". A replaced event can't trigger anything (603.2g); the replacement's new event can.
- Must exist BEFORE the event (614.4) — can't be added afterwards. Cast the shield in response.
- 614.5: a given replacement effect applies only once to a given event (Furnace of Rath x2 gives 4x, not infinite).
- 614.7a: 0 damage is no damage and has nothing to replace.
- 614.12: ETB replacements (enter tapped, with counters, as a copy) examine the permanent as it will exist on the battlefield, including its own static abilities and existing continuous effects. A permanent's own "enters with N counters" works regardless of source zone.
- 614.15: self-replacement effects (a spell's own "instead" within its text, e.g. "if kicked, instead...") apply before other replacements.
- 614.16: "if an effect would create tokens / put counters" doubling (Doubling Season, Hardened Scales) applies to effects of resolving spells/abilities and to results of other replacements. An "enters with counters" is a replacement, so those counter doublers DO apply there if their wording says "effect would put" (rules text decides). "Would" wording = replacement; "whenever" wording = trigger.
- 614.17 "Can't" effects: not replacements but behave similarly; cannot be replaced except by self-replacement; "can't" beats "can/may/instead".
- 614.11: replacing draws applies even with an empty library.

## 615 Prevention effects
- Use "prevent"; apply only to damage; shields. Must exist before damage (615.4). Prevented damage never happens, so no damage triggers fire (603.2g), but "whenever damage is prevented" can trigger (615.13).
- 615.7: "prevent the next N damage" shields count amount; 615.8 "next time a source would deal damage" prevents one instance of any size. 615.10: static "prevent 1 of that damage" applies to each damage event separately.
- 615.12: "can't be prevented" damage still lets prevention effects apply for their side effects.
- Lifelink/infect etc. interplay: damage prevented to 0 gives no lifegain (not dealt).

## 616 Ordering replacement and prevention effects
- 616.1: the affected object's controller (or owner), or the affected player, chooses the order of applicable effects. Priority steps: (a) self-replacement effects first, (b) control-changing ETB, (c) copy-as-enters, (d) enters back-face up, (e) any of the rest. After applying one, repeat with those still applicable (616.1f).
- 616.2: an effect can become applicable because of another's modification (lifegain -> draw -> return from graveyard chain).
- 616.1g: when one effect applies to an event contained in another (token creation contains entering), the outer applies first (Doubling Season before the token's "as enters").
- Trap: the chooser is the affected player/object controller, not the controller of the replacement. So an opponent's replacement effect applying to your permanent is ordered by YOU.
- Trap: only ONE of two competing "instead" effects usually applies fully; the other may then find nothing to replace (graveyard exile vs shuffle example).

## Cross-cutting traps (quick list)
- Cast triggers resolve before the spell they came from; ETB triggers resolve after the permanent is on battlefield; "dies" triggers see the pre-death board.
- Cost changes: additional costs/increases then reductions, all computed before payment; mana value never changes.
- Lands are played, not cast; no cast triggers, no stack.
- Mana abilities and special actions skip the stack; Treasure sacrifice cannot be responded to.
- Optional "may" triggers always go on the stack (decision at resolution).
- "If you do" / "when you do" / "unless": the first is part of the same effect; "when you do" makes a reflexive trigger with its own stack entry and fresh targets.
- Static lords are live; resolving pump spells are locked to what existed on resolution (characteristic changes only).
- Replacement ("would ... instead", "enters with") bypass triggers and the stack; "Whenever" cannot stop an event.
- Zone change = new object (400.7); delayed triggers and "exiled with" links forget it.
- APNAP: active player's triggers go on stack first, so they resolve last.

Read 748 lines (2456-3203).
