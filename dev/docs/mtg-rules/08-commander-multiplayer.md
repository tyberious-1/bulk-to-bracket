<!-- Condensed from the Magic Comprehensive Rules effective 2026-11-06 by reading agents (see dev/docs/mtg-rules-primer.md). Rule numbers are the source's. Lines marked outside range or verify were not read: check them in the full text (bash dev/tools/jxa-harness/fetch_comp_rules.sh). -->
# CR notes: ch. 8 Multiplayer (800-802) and 903 Commander

Scope note: I read 6456-6600 (800-802 only: left-game rules, limited range of influence, attack-multiple-players) and 6963-7070 (903). Free-for-All (806), APNAP basics (101.4) and partner (702.124) are NOT in these ranges; items marked [outside range] are from general knowledge, verify before relying on them.

## 1. Color identity (903.4)

- Identity = colors of ANY mana symbol in the mana cost OR rules text, plus colors from characteristic-defining abilities (604.3) and color indicators (204).
- Rules text counts: Bosh, Iron Golem ({8}, colorless) is red because of "{3}{R}" in its ability (903.4 example).
- Hybrid: each hybrid symbol contributes BOTH colors. Wort ({R/G}{R/G}) is R and G, and every card in its deck must fit within R+G (903.5c example). A card is legal when its identity is a SUBSET of the commander's.
- Reminder text is ignored (903.4c). Trap: reminder-text symbols (e.g. a basic-land-style reminder) do not add colors; ability text proper does.
- Back face of a double-faced card is included (903.4d), including its color indicator. Civilized Scholar {2}{U} + red-indicator back = U and R. This is an explicit exception to 712.6a.
- Other alternative characteristics (adventure half, etc.) are included (903.4e). A card's identity is the union over all faces/halves.
- Identity is fixed before the game (903.4a). In-game color changes (Painter's Servant, etc.) do not change it. A "choose a color" commander (903.4b) fixes its choice at deck construction and keeps it in all zones.
- No commander: color-count-of-identity quantities are undefined, costs unpayable (903.4f).
- Trap: a land's mana ability symbol ("{T}: Add {G}") is rules text, so it gives identity G. Colorless-looking lands with colored symbols in text are not colorless identity.
- Trap: color identity is not "color". A colorless artifact with {R} in text is red identity; a card with no symbols and no indicator is colorless identity (fits anywhere).

## 2. Deck contents (903.5)

- Exactly 100 cards including the commander (903.5a). No sideboard (903.5f).
- Singleton by English name except basic lands (903.5b); interchangeable names count as same.
- Every color in a card's identity must be in the commander's identity (903.5c).
- Basic-land-type rule (903.5d): a card with a basic land type is legal only if every color of mana it could produce (from the basic types) is in the commander identity. Wort (RG) may use Mountain/Forest-typed lands, not Plains/Island/Swamp-typed ones. Trap: a dual with types Island Swamp is illegal in a U-only deck even if its text has no colored symbol.
- Commander-only deck-construction exceptions (903.5e/903.3a): Seluma ("Angel cards of any color identity and any basic lands") works only when it IS the commander, and only for deck construction (before the game). Seluma's deck still cannot hold nonbasic lands outside identity or off-color basic-typed lands.
- "Can be your commander" abilities (903.3a) modify deck construction only.
- Commander must be legendary AND (creature, Vehicle, or Spacecraft with P/T box) (903.3). Planeswalkers are legal commanders only via their own "can be your commander" text (or Brawl, 903.12c).
- Brawl (903.12): 60 cards, planeswalker commanders allowed, 25/30 life, no commander-damage SBA, colorless commander may run basics of one chosen type. Mention only as variant.

## 3. Commander designation (903.3)

- "Commander" is an attribute of the CARD, not a characteristic of the object. Persists across zones (903.3).
- Still a commander when face down or copying something (Ixidron, Cytoshape). A permanent copying a commander (Body Double) is NOT a commander.
- Melded or merged permanent containing the commander is the commander (903.3b/c).
- Wording (903.3d): "control a commander" = a commander permanent on the battlefield; "cast a commander" = a spell that is a commander; "commander in zone X" = a card in that zone that is a commander.
- Trap: "your commander" wording (903.3e) finds YOUR commander's current characteristics in ALL zones, including library and hand. It refers to the one the player designated, not any legendary creature they control. A stolen opposing commander is still "a commander" (so it matches "commander creatures you control") but is not "your commander" (903.3e) and you may not cast it from the command zone (903.8 says a commander "they own"). Ownership = the player whose deck it started in.
- Partner pairs: each is "your commander"; text like "your commander" is ambiguous with two, effects apply to each/either per their wording [outside range].
- Commander enters the game in the command zone, face up (903.6), library is the rest (99 cards).

## 4. Commander tax and casting (903.8)

- You may cast a commander YOU OWN from the command zone. Cost +{2} for each PREVIOUS time the casting player has cast it from the command zone this game.
- Casting from the command zone is a cast (spell on the stack): counts for "cast" triggers, storm count, "whenever you cast a ..." payoffs. Counted ONLY for casts from the command zone.
- Trap: tax counts casts, not deaths or zone changes. A countered spell still raised the tax. Putting it into the command zone does NOT add tax; moving it to hand then casting from hand does NOT count and does NOT pay tax (903.8 says "from the command zone").
- Trap: tax counts times cast "by the player casting it". Tax is an additional cost, so cost reducers apply to the base, tax stays on top; commander tax is not a cost reduction target of "less to cast" beyond normal ordering rules (601.2f, outside range).
- Trap: effects that put it onto the battlefield (reanimate, Sneak Attack) do not count as casts and add no tax.

## 5. Zone changes (903.9)

- 903.9a (SBA): if the commander is in a graveyard or exile and was put there since the last SBA check, its owner MAY move it to the command zone. Trap: it is a state-based action, so it happens before any player can respond or use graveyard/exile-based effects that were not already on the stack; a commander that arrived earlier than the last check (stayed through a check) cannot be moved this way. An effect that exiles then returns in the same resolution (blink) is not caught by the SBA. Optional choice by owner, not controller.
- 903.9b (replacement effect): if it would go to hand or library from ANYWHERE, owner may put it into the command zone instead. This may apply multiple times to one event, an exception to 614.5.
- Trap: nothing replaces graveyard/exile/battlefield-to-graveyard moves; only hand/library are replacement. Graveyard and exile are handled by the SBA, so "dies" triggers and "exile" triggers still happen when it goes there first.
- Trap: tuck effects (to library) and bounce (to hand) can always be redirected by its owner; opponents cannot stop it except by exiling or by effects with "can't be replaced".
- Melded/merged commander (903.9c): the commander card goes to the command zone, non-commander components go to the zone the effect named.

## 6. Commander damage (903.10a)

- A player who has been dealt 21 or more combat damage BY THE SAME commander over the game loses (SBA). Combat damage only. Tracked per commander (per card, not per controller). Two partners track separately.
- Trap: the damage persists across the commander changing zones in the game (it is tracked per commander, "over the course of the game"). Life gain does not reduce it. A copy of a commander is not a commander and its damage does not count.
- Trap: it is damage by the commander, regardless of who controls it. Damage dealt by a stolen opposing commander counts toward that commander's total.
- Brawl disables this SBA (903.12h).
- Start life is 40 (903.7) with 7-card hand.

## 7. Partner variants [outside range except where noted]

Within this range only 903.3a/903.5e are relevant: abilities that say a card can be your commander or modify deck construction work before the game. Commander Masters draft (903.13f) gives mono-or-less-colored commanders that "can be a commander by itself" partner for deckbuilding in a Commander Draft only.
From general knowledge (702.124 and related, not read): Partner (two cards both with Partner); Partner with [name] (exactly that pair); Friends forever; Choose a Background (one commander has it, the other must be a Background enchantment, which may not be the main commander); Doctor's companion (paired with a Time Lord Doctor creature). Two commanders: deck is 100 cards including both, color identity = union, each commander has its own tax, commander damage tracked separately.

## 8. Free-for-all, opponent wording, multiplayer

- Default Commander multiplayer: free-for-all with attack multiple players, without limited range of influence (903.2).
- Attack multiple players (802): all opponents of the active player are defending players; each attacker picks its own defending player, planeswalker or battle (802.2, 802.3). "Defending player" in a card means the one defending player that creature is attacking (802.2a); if the creature left combat, the player it was attacking before. For effects touching several attackers it is determined per creature, and if ambiguous the controller chooses. Example: a creature with mountainwalk checks only the Mountain control of the player it attacks.
- Blocks: each defending player declares blocks in APNAP order (802.4); a defender blocks only creatures attacking that player, their planeswalker, or their battle (802.4a).
- Trap: "target opponent" picks one; "each opponent" hits every opponent; "an opponent" in a "when an opponent..." trigger fires for each. "Defending player" is one specific attacked player, NOT "the opponent". "That player" and "that opponent" refer back.
- Trap: "opponent" = any other player (non-team), not just one person. Commander-count and "an opponent controls" conditions are existential across the table; "each opponent" counts scale with player count (so drain/ping/Treasure payoffs scale at 4 players).
- A player leaving the game (800.4): all objects they OWN leave, control-change effects from them end, objects they controlled but do not own are exiled afterward (800.4a). Consequences: stolen cards vanish or return depending on who leaves; tokens made under their control by others' effects (Genesis Chamber) stay or leave by who controlled them. Their triggered abilities cannot be put on stack (800.4d); costs requiring them are unpaid (800.4f). An eliminated commander's owner leaving removes the commander too.
- Limited range of influence (801) is optional and NOT default Commander: range is seat distance; you can't target, attack, activate, trigger or see events outside it; "each opponent" only affects those in range (801.10); win effects make only in-range opponents lose (801.14). Information effects (Coat of Arms) count only in-range objects (801.11).
- Trap: in default Commander (no range of influence) every effect sees the whole table, which is why "for each opponent/creature on the battlefield" counts scale with player count.
- APNAP: active player then others in turn order, used for simultaneous triggers and block declaration (802.4). With four players the order is active, then the next three clockwise. [Base rule 101.4 outside range.]
- First mulligan is free in multiplayer (800.6); starting player draws on turn 1 in multiplayer (800.7) (not in Two-Headed Giant).
- Bring-from-outside-the-game (903.11): only if rules/effects specifically allow; a card brought in (wishes) cannot duplicate a name from the starting deck, a card owned in the game, or have off-identity colors (903.11a). Trap: wish-style effects are mostly unusable in Commander.

## Quick engineering checklist

1. Identity = union of colors over all symbols in cost, text (not reminder), indicator, CDA, all faces; hybrid contributes both colors.
2. Legality = identity subset of commander identity; singleton; basic-land-type check (903.5d); exceptions only from commander-only deck-construction text.
3. "Commander" tracked per card; "your commander" is player-specific and zone-agnostic; copies are not commanders.
4. Tax = +2 per prior cast from the command zone; counts only casts; casting from command zone is a normal cast.
5. Zone moves: hand/library are replaceable by owner; graveyard/exile via SBA only if arrived since last check.
6. Commander damage is per commander, combat only, 21 threshold, ignores copies.
7. Opponent wording scales with table size; "defending player" is per attacker.

Lines read: 145 (6456-6600) + 108 (6963-7070) = 253 lines.
