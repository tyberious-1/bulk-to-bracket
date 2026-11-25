<!-- Condensed from the Magic Comprehensive Rules effective 2026-11-06 by reading agents (see dev/docs/mtg-rules-primer.md). Rule numbers are the source's. Lines marked outside range or verify were not read: check them in the full text (bash dev/tools/jxa-harness/fetch_comp_rules.sh). -->
# CR notes 1: Game Concepts (100-123) and Parts of a Card (200-213)

Oracle wording is the source of truth (108.1).

## 101-104 Basics
- 101.2 "Can't" beats "can" (exception 101.2a: adding/removing abilities go by timestamp). 101.3 Impossible parts of an instruction are skipped; the rest happens.
- 102 "Opponent" = every player not on your team; in Commander, "each opponent" = every other player.

## 105-106 Colors and mana
- 105.2/202.2 Color comes only from mana symbols in the cost (or a color indicator, 204), never frame, art or text. No colored symbols = colorless; lands (no cost) are colorless.
- 105.4 "Multicolored" and "colorless" are not colors. Mana has six types (106.1b); {C} colorless mana is a type, not a color.
- 106.3 Mana comes from mana abilities or spells. Its source = that spell or ability's source.
- 106.8-106.11 Adding mana "represented by" a hybrid symbol: pick a half; Phyrexian: that color; generic/snow: colorless.
- 106.12 "Tapped for mana" = a mana ability with {T}; mana abilities skip the stack (605), so no responses.

## 107 Numbers and symbols
- 107.1b Power/toughness may go negative; negative results used for damage, mana or counts count as 0 (a -2/4 deals 0; +3 then gives 1). Doubling/setting P/T or life is exempt.
- 107.2 An undeterminable number is 0.
- 107.3 X:
  - undefined X in a cost is chosen by the controller on cast/activation and holds while on the stack (107.3a);
  - off the stack X in a mana cost = 0 (107.3g), even if text defines X;
  - an ETB trigger/replacement effect sees the spell's X though the permanent's own X is 0 (107.3m);
  - each activated ability's X is independent (107.3k); a granted ability's X is its own, else 0 (107.3j);
  - cast without paying: X must be 0; cost reduction to zero doesn't force that (107.3b).
- 107.4 Symbols: colored, generic {N}/{X}, colorless {C}, hybrid {W/U}, monocolored hybrid {2/W} (one W or two of any mana) and {C/W}, Phyrexian {W/P} (one W or 2 life), hybrid Phyrexian, snow {S}.
  - 107.4e/f Hybrid and Phyrexian symbols are colored symbols: the card has every component color. A {G/W} card is both green and white.
  - {C} needs real colorless mana (Wastes, Sol Ring). {S} needs mana from a snow source; generic reducers can't touch it.
- 107.5 A creature's {T}/{Q} ability needs control since your turn began (summoning sickness; haste skips it); tapped permanents can't pay {T}.

## 108-109 Cards, owner, controller, objects
- 108.3 Owner = whoever started the game with it (commander: who put it in the command zone); fixed. Cards return to the owner's zones.
- 108.4a Only spells and permanents have controllers; elsewhere "controller" = owner.
- 109.1 Object = ability on the stack, card, copy of a card, token, spell, permanent, emblem. A static ability is not an object.
- 109.2 KEY reading rules:
  - bare type/subtype ("Zombie", "artifact you control") = permanent on the battlefield;
  - "creature card" + zone = card in that zone (109.2a);
  - "creature spell" = on the stack (109.2b): "Vehicles you control" ignores spells, "cast a Vehicle spell" ignores permanents;
  - "source" = any object in any zone that is a source of an ability, damage or mana (109.2c);
  - tokens are permanents but not cards: "Treasure you control" counts them, "artifact card" doesn't.
- 109.3 Characteristics: name, cost, color, indicator, types, subtypes, supertypes, text, abilities, P/T, loyalty, defense. NOT characteristics: tapped, targets, owner, controller, counters, what an Aura enchants (so copies don't copy counters or tapped state, 707).
- 109.5 "You/your": static = current controller; activated = the activator; triggered = controller when it triggered (a later steal doesn't change it); no controller = owner.

## 110-111 Permanents and tokens
- 110.1/110.4 Permanent = card or token on the battlefield; types artifact, battle, creature, enchantment, land, planeswalker. Instants/sorceries never are. "Permanent card" (110.4a) can enter; "permanent spell" (110.4b) will. A permanent that loses all types is still one (110.4c).
- 110.2 Controller = whoever it entered under; gain-control changes controller only.
- 108.2b/111.3/111.7 Tokens aren't cards and cease to exist outside the battlefield. A token has only the characteristics its creator defines: "1/1 Saproling" has no cost (mana value 0), no abilities. Owner = creator. 111.4 name defaults to subtype + "Token"; subtypes still feed tribal counts.
- 111.10 Predefined tokens: Treasure (sac: any color), Food, Gold, Clue, Blood, Powerstone (can't pay nonartifact spells), Map, Junk, Lander, Mutagen, Shard, Walker, Incubator, Roles (Aura enchantments); artifact ones count as artifacts.

## 112-114 Spells, abilities, emblems
- 112.1 A spell is a card or copy on the stack; casting moves the card there first. Copies are spells but not "cast" (no cast triggers). Land plays are special actions (116.2a): no stack, never "cast".
- 113.3 Four categories: spell ability; activated "[Cost]: [Effect]" (the colon decides); triggered (when/whenever/at); static (plain statement). Quoted abilities belong to the receiver.
- 113.6 Abilities work on the battlefield (instants/sorceries: stack) EXCEPT characteristic-defining abilities (everywhere), abilities naming a zone, an object's own cost-modifying/alternative-cost/cast-restriction text (works from hand: "this spell costs {2} less"), "can't be countered" (stack), "enters with/tapped" (as it enters), and abilities that move the object out of a zone (only there). Trap: a graveyard card has no abilities unless they are about the graveyard; a cost reducer on a permanent affects other spells only from the battlefield.
- 113.7 Source = object that generated the ability. 113.7a Once on the stack it's independent of its source (last known information), so "when this dies, it deals damage" works. 113.8 Triggered controller = source's controller at trigger time.
- 113.9 Abilities on the stack aren't spells: "counter target spell" can't hit them; statics can't be countered.
- 113.10-113.12 "gains/has" abilities can be removed; "is [type/color]" and "can't be blocked" are qualities, not abilities. 113.11 "Can't have X" beats "gains X".

## 115 Targets
- 115.1/115.10 Only the word "target" targets, chosen on cast/activation/stack and then fixed. Not targets: each, all, choose-on-resolution, sacrifice, edicts, "you". Hexproof, ward and protection don't stop them.
- 115.1b An Aura spell targets (enchant); the Aura permanent doesn't. 115.1e Equip, modular, mutate target via the keyword rule.
- 115.2 Default legal targets are permanents; cards in other zones, spells and players need the text to say so.
- 115.3 One object can't fill the same "target" twice; "another target" needs a different one.
- 115.4 "Any target" = creature, player, planeswalker, battle (not artifacts/lands/spells). 115.5 A spell/ability can't target itself.

## 118 Costs
- 118.3 You can't pay without the resources (tapped permanent can't pay {T}; life up to your total; 0 always payable).
- 118.7 Reducers cut generic only (118.7a), never below colored pips (118.7b/c).
- 118.8 ADDITIONAL costs (kicker, "additional cost: sacrifice") add on and don't change mana value. 118.9 ALTERNATIVE costs (flashback, evoke, "rather than pay") replace the mana cost, one per spell, increases/reductions still apply, mana value unchanged.
- 118.12 "Do X. If you do, Y": X is a cost paid on resolution; "if you do" checks you chose to pay, even if a replacement changed the result. "Unless" = may do X, otherwise Y.

## 119-122 Life, damage, draw, counters
- 122.1 Counters aren't objects or tokens. 122.1b Keyword counters grant their keyword. Shield/stun/finality counters are replacement effects. 122.2 Counters vanish on zone change. 122.3 +1/+1 and -1/-1 annihilate in pairs. 122.6 "Enters with counters" counts as put on.

## 201 Name

## 202 Mana cost, color, mana value
- 202.1b Lands, symbolless cards, tokens: no mana cost (unpayable). 202.3a No cost = mana value 0, except non-modal DFC back faces and melded permanents.
- 202.3 MANA VALUE = total mana in the cost:
  - {X} = 0 off the stack, chosen value on the stack (202.3e);
  - hybrid counts the LARGEST half ({2/B}x3 = 6; {1}{W/U}{W/U} = 3) (202.3f);
  - Phyrexian counts 1 (202.3g);
  - split card: combined halves off the stack, only the cast half on it (202.3d);
  - non-modal DFC back face uses the FRONT cost (Ravager of the Fells = 4); a copy of that back face = 0 (202.3b);
  - additional/alternative costs never change it (202.4).
- 202.2d Hybrid/Phyrexian symbols make the object all their colors.

## 203-206 Illustration, indicator, type line, expansion
- 205.1a Setting a card type replaces types (instants/sorceries keep theirs); 205.1b "in addition" and "still a land" retain. 205.2b Multi-typed objects satisfy criteria of every type; tokens and copies have types (205.2c).
- 205.3 Subtypes correlate with card types; can't gain a subtype for a type it lacks (205.3d). 205.3e "Choose a creature type" is one real type.
  - 205.3m Creatures and kindred share creature types; kindred with a type is not a creature. Time Lord is the only two-word type. Mount and Pilot are creature types.
  - Artifact types include Blood, Clue, Food, Gold, Equipment, Vehicle, Treasure, Map, Powerstone, Junk; enchantment types Aura, Background, Class, Role, Saga, Shrine; land types the five basics plus Cave, Desert, Gate, Town, Tower, Urza's; spell types Adventure, Arcane, Lesson, Omen, Trap (205.3g-k).

## 207 Text box
- 207.2a Reminder text (italic parenthetical) summarizes only; keyword rules live in 702.
- 207.2b Flavor text: no effect.
- 207.2c ABILITY WORDS: italic label starting an ability, no rules meaning, no CR entry: landfall, delirium, threshold, constellation, magecraft, raid, revolt, morbid, metalcraft, domain, heroic, enrage, descend, void, eerie, valiant, channel, bloodrush, renew, strive, imprint, and about 50 more. Parse the clause after the dash; the label is only a theme hint. Channel, bloodrush and renew work from non-battlefield zones because their text says so (113.6b); eminence works from the command zone.
- 207.2d Flavor words: italic, unique to one card, not in the CR, no rules.
- 207.5 Cryptic Spires' circled colors count for color identity (903.4). Color IDENTITY itself is defined in 903.4 (also reads symbols in rules text; verify in the Commander notes).

- 205.4c Basic = has the "basic" supertype; nonbasic lands with basic types (Breeding Pool) aren't found by "basic land card" searches. Legendary instants/sorceries need a legendary creature/planeswalker (205.4e).
- 201.2a Same name = one shared name (each face counts); 201.2b "different names" needs every object named.

## 208-213 P/T, loyalty, misc
- 208.3 Only creature cards print P/T; a noncreature permanent has none (Vehicles aren't creatures until crewed), yet effects modifying it are still created and apply once it becomes a creature (208.3a).
- 208.2a `*` P/T is a characteristic-defining ability working everywhere; an undeterminable part is 0 (Lost Order of Jarkeld is 1/1 elsewhere). 208.2b "As this enters, choose P/T" cards are 0/0 elsewhere.
- 208.4 Base P/T is after set/CDA effects, before counters and pumps; counters still stack on a base-setting effect.
- 209-213 Loyalty/defense = starting counters; collector number, rarity letter, set code: no game effect.

Lines read: 1389 (lines 183-1571).
