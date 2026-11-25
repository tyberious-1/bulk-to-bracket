# Magic rules primer: what a card reader must know (read this before designing a reader or link)

Source: the Magic Comprehensive Rules effective 2026-11-06 (Wizards, free text). Read by agents on 2026-11-10 at the user's request ("you need to read the rules and
we need for you to be able to understand them between chats") and condensed into `dev/docs/mtg-rules/` (eight files, about 23,000 words, by chapter). This
primer is the short version, about the rules that decide whether two cards actually work together. Rule numbers are the source's; look a rule up with
`bash dev/tools/jxa-harness/fetch_comp_rules.sh` (writes `dev/tools/jxa-harness/rules/cr.txt`, git-ignored) and `grep -n "^603.3 " cr.txt`. The notes were
condensed by model readers: a line marked "outside range" or "verify" was not read, and every claim here that matters should be checked against the
text before it becomes code. Checked against the text on 2026-11-10: 601.2f, 603.2g, 605.1a, 614.5, 400.7, 700.4, 702.108a, 702.124a, 903.4.

Related: AGENTS.md "How to think about a deck" (the word problem plus the math problem), and the memory entry `read-the-card-word-and-math-problems`.

## 1. What a card is, in rules terms

- **A card is a small program whose parts have different kinds** (112, 113): spells, static abilities, activated abilities (`cost: effect`, 602), triggered
  abilities (`When/Whenever/At`, 603), and mana abilities (605). Spells, activated abilities and triggered abilities use the stack; static abilities and mana abilities do not (405.6).
- **Ability words and reminder text carry no rules** (207.2, 702 intro): "Landfall", "Heroic", "Parley" label a trigger; the rules are in the sentence after the dash.
  Keywords like prowess are real rules with an implied trigger (702.108a: "whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn").
- **Owner vs controller** (108, 109): a stolen creature that dies goes to its owner's graveyard (400.3). "Your graveyard" counts cards you own.
- **Mana value** is fixed on the card (202); cost reductions change mana paid, not mana value (601.2f). Hybrid takes the largest half, Phyrexian counts 1, X is 0 off the stack.
- **Only the word "target" targets** (115). Auras and Equipment that give a bonus do not target.
- **Tokens are not cards** (111) and cease to exist outside the battlefield; "create" and "put onto the battlefield" are different verbs for different cards.

## 2. Timing: when things can happen (5xx, 601-603)

Inside a turn, for a card reading its own trigger: untap (nobody gets priority, 502) > upkeep triggers > draw (the draw is not on the stack, then draw-step
triggers) > main 1 (sorcery speed: your main phase, stack empty, 505) > beginning of combat (the last window to crew or animate before attackers, 507) >
declare attackers (attack triggers stack and **resolve before blockers are declared**, 508.2) > declare blockers (509) > combat damage (two steps if any first
or double strike, 510.4) > damage and dies triggers > end of combat > main 2 > end step (513) > cleanup (discard, damage wears off, "until end of turn" ends
at the same moment, 514.2).

- **Attack-trigger evasion works**: a creature that gains evasion on attack (Eluge's flood counter making an Island for islandwalk) has it before blocks. Evasion gained after blocks do nothing (509.1b). A blocked creature stays blocked even if every blocker is removed (509.1h).
- **A creature put onto the battlefield attacking never "attacked"** (508.3a): no attack triggers, no attack requirements.
- **Summoning sickness is about the tap symbol** (302.6, 602.5a): a creature you have not controlled since your turn began cannot use `{T}` abilities or attack; sacrifice and mana costs work at once, and "tap an untapped creature you control" (crew, convoke) is not `{T}`, so a sick creature can crew. A Vehicle you have held since last turn can attack the turn you crew it.
- **Mana empties at the end of every step and phase** (500.5): mana from main 1 does not reach combat.
- **Sorcery speed** needs the active player's main phase, empty stack and priority; a flash card does not escape an ability that says "only as a sorcery" (505, 307.5).
- **Lands are played, not cast** (305.1): no stack, not a spell, no cast triggers (landfall sees it enter). "Put onto the battlefield" (ramp, fetch) is not a land play and uses no land drop (305.4).
- **State-based actions** (704) are checked before anyone gets priority and before triggers are put on the stack; never between steps (500.12).

## 3. The stack and triggers (405, 601-603, 608)

- **Casting** (601.2): moves the card to the stack, then choose modes, alternative/additional costs, X, targets, then total cost, pay, and only then is it "cast" and **cast triggers fire**. So a cast trigger resolves before the spell that caused it (601.2i).
- **Total cost** (601.2f) = mana cost or one alternative cost, plus additional costs and increases, minus reductions; floors at 0; reductions only reduce generic mana; locked before payment. "The first spell each turn" is a game-history test at that moment; casting from any zone counts, and a commander cast from the command zone is a cast. Only one alternative cost can apply per spell (601.2b).
- **Triggers go on the stack the next time a player would get priority** (603.3), not mid-resolution. With several, the **active player's go on first and resolve last** (APNAP, 603.3b, 405.3).
- **Optional ("may") triggers always go on the stack**; the choice is made on resolution (603.5). **Intervening "if"** (`When X, if Y,`) is checked at trigger and at resolution; "You may X. If you do, Y" is not intervening; "When you do" makes a **reflexive trigger** with its own stack entry and fresh targets (603.12).
- **ETB looks forward, dies/leaves looks back** (603.6a/c, 603.10): a death payoff sees creatures dying at the same time as it (Blood Artist triggers for itself). An ETB trigger sees permanents entering together with it.
- **A prevented or replaced event triggers nothing** (603.2g): a creature exiled instead of dying did not die; "whenever you dies" payoffs never see it.
- **"Enters with", "as enters", "enters tapped" are replacement effects, not triggers** (603.6d, 614.1). They happen before any enters trigger sees the permanent, and cannot be responded to. A counters doubler that says "if an effect would put counters" can apply to them.
- **An ability on the stack resolves without its source**: kill a creature in response to its activated ability and the ability still resolves (608.2h, last known information). A sacrifice cost cannot be responded to, so an outlet beats removal.
- **Mana abilities never use the stack** (605): cannot be countered or responded to; a Treasure sacrifice is instant and unrespondable. An activated ability is a mana ability only if it has no target, could add mana, is not a loyalty ability, and its cost and effect move no card to or from a library (605.1a, checked): Selvala's parley draws a card, so it is NOT a mana ability and uses the stack.
- **Fizzle**: if every target is illegal on resolution, the whole spell does nothing, including its untargeted parts (608.2b).
- **An instant or sorcery goes to the graveyard last** (608.2n): a spell that mills or counts the graveyard does not see itself.

## 4. Continuous effects (611-613)

- **A static ability is live** (611.3a): a lord covers creatures that arrive later and stops when the lord leaves.
- **A resolving spell that changes characteristics or control locks its set at resolution** (611.2c): "creatures you control get +1/+1 until end of turn" does not touch creatures that enter afterwards. One that changes rules (cost reduction this turn, "can't") applies to later objects.
- **No stated duration means until the end of the game** (611.2a).
- **Layers** (613): copy, control, text, type, color, abilities, then power/toughness (CDAs, set values, modifiers and counters, switch). Counters and pump apply after "becomes X/Y" effects regardless of order. Timestamp order, except dependency.
- **A zone change makes a new object with no memory** (400.7): a blinked or bounced creature loses counters, attachments and damage, becomes summoning sick again, re-triggers its enters abilities, forgets "exiled with ~" links (406.6, 607), and a delayed trigger that was waiting for the old object does nothing (603.7c). A spell targeting it fizzles.
- **Replacement vs trigger**: "would ... instead" rewrites the event, uses no stack, cannot be responded to, must exist before the event, and each one applies once (614.5). The affected player or permanent's controller chooses the order, not the controller of the replacement (616.1).

## 5. Zones (400-408)

- Abilities work from the battlefield unless the text names another zone (403.2); "creatures you control" never counts cards in hand or graveyard. Graveyard abilities (flashback, escape, unearth) work only from the graveyard, so self-mill and discard fill their input.
- **"Dies" means "is put into a graveyard from the battlefield"** (700.4, checked): discard, mill and exile are not dying.
- A spell going to the graveyard is an instant or sorcery's last step; an instant or sorcery can never enter the battlefield (304.4, 307.4), so blink and reanimation on them do nothing.
- Hand size is enforced only in cleanup (402.2, 514.1). Library effects need cards in library; milling is not drawing.

## 6. Commander (903)

- **Color identity** (903.4) is the colors of the mana symbols in a card's mana cost **and rules text**, plus color indicators and characteristic-defining abilities, established before the game; Scryfall's `color_identity` follows it.
- **Partner abilities** (702.124a): partner, partner--[text], partner with [name], choose a Background, Doctor's companion. Each lets you designate two legendary cards as commander under its own pairing rule (Gut + a Background: "choose a Background" plus a Background enchantment). See `08-commander-multiplayer.md` and `07-keyword-abilities-second-half.md` for each variant, commander tax per commander, and commander damage tracked per commander.
- In multiplayer, "each opponent" and "target opponent" differ; the active player's triggers resolve last (APNAP).

## 7. What this means for the reader (known gaps and checks)

Each is a place where words alone mislead. Add a rule here when a card is misread.

1. **Cast discount "first X spell each turn"** (Radagast, Eluge): reduces generic mana only, floors at 0; only the first spell; applies at cast time. Link dear spells (cost 4-6), not cheap ones; a discount does not make a spell castable earlier by mana value.
2. **Cast triggers vs ETB**: "whenever you cast" never sees a land or a token; resolves before the spell. A payoff that says "creature enters" is not a creature-cast payoff (the Radagast bug: "this creature becomes the target of a spell" matched a cast regex).
3. **Dies payoffs vs exile/discard/mill**: a sacrificed permanent goes to the graveyard, so it feeds death payoffs; exile, discard, mill and a replaced death do not. Fodder that exiles itself does not feed them.
4. **Evasion on attack triggers works** (Eluge islandwalk, Gut's attacking tokens); evasion after blocks does not.
5. **Tokens created "tapped and attacking"** (Gut's Skeleton) never attacked: no attack triggers, they dodge attack costs.
6. **Crew and convoke use tap costs, not `{T}`** (sick creatures crew).
7. **Static vs resolving effects**: a lord is live; a one-shot anthem is not. Rank a lord above an equivalent spell for a deck that keeps making creatures.
8. **Linked abilities** (607): "exiled with this" counts only that object's own exile; blink resets it.
9. **Symmetrical effects** (Selvala's draw, wraths, Winter Orb): the rule text does not say who benefits; the reader must name the payoff on the controller's side (see "group hug" Selvala work, commit 6dee4bb).
10. **Prowess and similar keywords** are triggers: a keyword line like "Flying, vigilance, prowess, prowess" carries a spell trigger (fixed in 6dee4bb; see `abilities.js` `KEYWORD_SPELL_TRIGGERS`).
11. **Commander tax and partners**: commander tax is an additional cost; "casting your commander" counts as a cast for cast triggers and "first spell" limits.

## 8. How to keep this useful

- The condensed notes may be wrong in places. When the reader depends on a rule, grep `cr.txt` and read the rule itself.
- After a rules release (new set), run `fetch_comp_rules.sh`, diff `source.txt`, and re-read the changed chapters (701 keyword actions and 702 keyword abilities change every set).
- Keep this file short: it is the thing a future chat can load. Details live in `dev/docs/mtg-rules/`.
