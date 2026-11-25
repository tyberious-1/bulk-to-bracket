<!-- Condensed from the Magic Comprehensive Rules effective 2026-11-06 by reading agents (see dev/docs/mtg-rules-primer.md). Rule numbers are the source's. Lines marked outside range or verify were not read: check them in the full text (bash dev/tools/jxa-harness/fetch_comp_rules.sh). -->
# CR 702 (second half, 702.90e-702.196): keyword notes

Legend: S=static, T=triggered, A=activated, R=replacement, AC=alternative cost, ADD=additional cost, SA=special action.
Generic traps: every "alternative cost" keyword can't combine with another alternative cost (one per spell), but additional costs stack. Keywords "functioning on the stack" do nothing from hand/battlefield. Multiple instances: triggered ones usually trigger separately; evasion/static ones are redundant.

## Combat / counters / triggers on the battlefield
- **Infect 702.90e-f**: damage rules apply from any zone; instances redundant. (Infect = -1/-1 counters on creatures, poison on players; toxic is different, see below.)
- **Battle cry 702.91 (T)**: on attack, each OTHER attacker +1/+0. Needs other attackers; multiple instances each trigger. Does not buff itself.
- **Living weapon 702.92 (T)**: Equipment ETB makes a 0/0 black Phyrexian Germ token, then attaches. Token maker (Germ); counts as ETB/token-creating. Equipment can be moved later; Germ dies to SBA if equipment leaves.
- **Undying 702.93 (T)**: dies with NO +1/+1 counters -> returns with one. Trap: checks last-known state; a permanent with any +1/+1 counter (even one placed by proliferate, evolve, etc.) won't return. Returning a creature with a +1/+1 counter makes it a "dies" then "enters" engine (sac/ETB fodder). Gets blanked by a -1/-1 counter? No: +1/+1 and -1/-1 annihilate (SBA) so a creature with both ends with none and undying works again.
- **Miracle 702.94**: S linked to T. Reveal as you draw the FIRST card of the turn; cast for miracle cost. Trap: extra draws on your own turn don't miracle; draw effects on opponent's turns can (first card drawn that turn).
- **Soulbond 702.95 (T x2)**: pair two unpaired creatures you control on ETB of either. Pair breaks on leaving/control change/stopping being a creature. Pairing is optional; only one partner each.
- **Overload 702.96 (AC)**: replace "target" with "each"; spell has no targets (702.96b), so hexproof/shroud/ward don't stop it and "becomes the target" triggers don't fire. Protection still stops damage/enchant/etc. effects.
- **Scavenge 702.97 (A, graveyard)**: exile it, put +1/+1 counters equal to its power on target creature; sorcery speed. Graveyard-exile cost (hurts recursion, helps +1/+1 counters / proliferate).
- **Unleash 702.98 (S, replacement-like)**: may enter with +1/+1 counter; can't block while it has a +1/+1 counter. Counter-removal re-enables blocking.
- **Cipher 702.99**: exiled "encoded" on a creature; copies and casts free when that creature deals combat damage to a player. Remains while the creature is on the battlefield (even if it changes control or stops being a creature). Needs evasion/unblockable; copy is a "cast" (storm/cast triggers fire).
- **Evolve 702.100 (T)**: whenever a creature enters under your control, if its power or toughness is greater, +1/+1 counter. Compares to the entering creature's stats as it enters (counts tokens). Noncreature permanents can't outclass. Each instance triggers.
- **Extort 702.101 (T)**: whenever you cast a spell, may pay {W/B}: drain 1. Each instance triggers separately and costs separately. Cast-trigger (not ETB; copies don't trigger).
- **Fuse 702.102 (S, from hand only)**: cast both halves of a split card; combined cost and characteristics. Doesn't work from graveyard/exile.
- **Bestow 702.103 (AC)**: cast as an Aura with enchant creature; if target becomes illegal on resolution it resolves as a creature instead; if the creature it enchants leaves, it becomes a creature (not graveyarded). On the stack it is an Aura spell, not a creature spell (creature-spell restrictions/counters don't see it).
- **Tribute 702.104 (S as enters)**: opponent chooses whether it gets N extra +1/+1 counters; "if tribute wasn't paid" triggers key off it.
- **Dethrone 702.105 (T)**: attacks the player with most life (or tied) -> +1/+1 counter. Each instance triggers.
- **Hidden agenda / double agenda 702.106**: Conspiracy only; command zone; not relevant for deck-building in normal Commander.
- **Outlast 702.107 (A)**: {cost},{T}: +1/+1 counter, sorcery speed. Summoning sick creatures can't use it ({T}); counter source for proliferate/undying checks.
- **Prowess 702.108 (T)**: whenever you cast a NONcreature spell, +1/+1 until EOT. Triggers on cast, not on resolution; each instance triggers; counterspells don't stop it. Lands are not spells.
- **Dash 702.109 (AC)**: haste, returns to hand at next end step. Each cast is a fresh ETB (flicker-like value); returns only if still on battlefield. Dash is cast from hand only.
- **Exploit 702.110 (T)**: ETB, may sacrifice a creature (can sacrifice itself). Sac outlet on a body; feeds death triggers.
- **Menace 702.111**: needs 2+ blockers. Redundant instances.
- **Renown 702.112 (T)**: first combat damage to a player -> N +1/+1 counters, becomes renowned (designation, not copied).
- **Awaken 702.113 (AC)**: instant/sorcery; target land becomes 0/0 Elemental with haste and gets N counters; still a land. Targets only if awaken cost paid.
- **Devoid 702.114 (S, CDA)**: colorless in all zones (including hand/library). Color identity (from rule 903.4, outside my range, from general knowledge) comes from mana symbols/indicators, so a devoid card still has its colored identity. Hits "colorless" cards/effects and "nonwhite" matters.
- **Ingest 702.115 (T)**: combat damage to a player -> that player exiles top card of library. Exile, not mill: no graveyard trigger.
- **Myriad 702.116 (T)**: on attack, token copy tapped and attacking each other opponent; exiled at end of combat. Token copies = ETB triggers, "creature entered" triggers; not "attacks" triggers (they weren't declared as attackers). Multiplayer only.
- **Surge 702.117 (AC)**: cheaper if you or a teammate cast another spell this turn.
- **Skulk 702.118**: can't be blocked by creatures with greater power.
- **Emerge 702.119 (AC + sacrifice)**: total cost reduced by sacrificed creature's mana value; sacrificing is part of the cost (so a death trigger/sac payoff fires; sacrifice a token MV 0 = no discount). Emerge from [quality] variants use other permanents.
- **Escalate 702.120 (ADD)**: pay extra per mode beyond the first.
- **Melee 702.121 (T)**: on attack, +1/+1 per opponent you attacked this combat (counted on resolution).
- **Crew 702.122 (A)**: tap untapped creatures with total power N or more: Vehicle becomes an artifact creature until EOT. Summoning-sick creatures CAN crew (it's not a {T} cost of the creature's own ability). Toughness/other-stat crew effects exist via other cards. "Becomes crewed" triggers when the ability resolves. Vehicle is not a creature otherwise: dodges sorcery-speed creature removal, can't be targeted by creature-only effects at other times. A Vehicle that is a creature is also affected by "creature" wipes only if crewed at that time. Tapped crew can't attack (tapping creatures that wanted to attack is a cost).
- **Fabricate 702.123 (T)**: N counters on itself OR N 1/1 Servo tokens, chosen on resolution. Can be a token maker and a counter source; each instance triggers.

## Partner / Commander rules (702.124) -- critical for deck builder
- Partner abilities are deck-construction rules, functioning before the game; two commanders max, ever. Deck is exactly 100 including both. Color identity is the union of both.
- Variants are mutually distinct and cannot be mixed: **partner** (both have plain partner), **partner-[text]** (same text: Character select, Father & son, Friends forever, Survivors), **partner with [name]** (each names the other; also ETB tutor trigger for the named card), **choose a Background** (this card + a legendary Background enchantment; a Background can be commander only alongside such a card; the commander with it need not be a creature), **Doctor's companion** (legendary creature + legendary Time Lord Doctor with NO other creature types).
- A card with several partner abilities may use only one at a time (e.g. a card with Partner plus Choose a Background can pair either way but not both).
- Two commanders function independently: separate commander tax and separate 21-damage tracking. "Your commander" in effects means either one, chosen on application.
- References to "partner" in rules text mean plain partner, partner-[text], partner with only; NOT Background or Doctor's companion.

## Cost and cast-from-elsewhere keywords
- **Undaunted 702.125 (S)**: costs {1} less per opponent (Commander: usually 3 in a 4-pod; players who left don't count). Instances stack.
- **Improvise 702.126 (S)**: tap artifacts to pay GENERIC mana only; applies after total cost; not an alt/additional cost, so it combos with alternatives. Needs artifacts (including tapped-out mana rocks; artifact creatures with summoning sickness still tap fine since not a {T} ability).
- **Aftermath 702.127**: cast the half from graveyard only; exiled afterward. Graveyard fuel; second half can't be cast from hand.
- **Embalm 702.128 / Eternalize 702.129 (A, graveyard)**: exile from graveyard, token copy (white Zombie / black 4/4 Zombie), sorcery speed, no mana cost on token. Token = ETB triggers; the 4/4 version changes P/T from copy; both are Zombies (tribal). Graveyard hate answers them in response.
- **Afflict 702.130 (T)**: becomes blocked -> defending player loses N.
- **Ascend 702.131**: 10+ permanents -> city's blessing permanently (any count of permanents including lands and tokens). Instances/designation, many players can have it.
- **Assist 702.132**: another player may pay generic mana of the cost (multiplayer).
- **Jump-start 702.133 (ADD, graveyard)**: cast from graveyard by discarding a card; exiled after. Discard synergy; works only for instants/sorceries.
- **Mentor 702.134 (T)**: attack: +1/+1 counter on target attacking creature with lesser power.
- **Afterlife 702.135 (T)**: dies -> N 1/1 white-black flying Spirit tokens.
- **Riot 702.136 (S/R)**: choose +1/+1 counter or haste on entering. Counter => interacts with undying (blocks it).
- **Spectacle 702.137 (AC)**: if an opponent lost life this turn.
- **Escape 702.138 (AC, graveyard)**: cast from graveyard paying cost (usually includes exiling other cards from graveyard); "escapes with" gives counters/abilities only if it escaped. Graveyard-fill/recursion theme.
- **Companion 702.139**: outside-the-game card, condition checked against the starting deck; in Commander that is evaluated BEFORE the commander is set aside (702.139b), so the commander counts. Pay {3} to put in hand (special action, sorcery timing); it then stays in game. Not in the 99 count.
- **Mutate 702.140 (AC)**: cast onto a non-Human creature you own; merged permanent has all abilities; topmost card gives characteristics; "mutates" triggers when merge happens. If target illegal it resolves as a normal creature. A token creature can be the base.
- **Encore 702.141 (A, graveyard)**: sorcery; token copy for each opponent attacking that opponent, haste, sacrificed at next end step. Token ETBs. Doesn't affect commander requirement for players.
- **Boast 702.142**: activated ability only if this creature attacked this turn, once per turn.
- **Foretell 702.143**: SA, pay {2}, exile face down; cast later turn for foretell cost. The exile is face-down (not a cast; doesn't trigger cast effects until actually cast). Foretold status persists even if cast for another cost.
- **Demonstrate 702.144 (T)**: when cast, copy it and give an opponent a copy. A cast trigger; copies are not cast.

## Day/night, transformation, designation keywords
- **Daybound/Nightbound 702.145**: first daybound permanent makes it day; transforms happen immediately (not SBA). Day/night is a game-wide state; some cards cause day to become night.
- **Disturb 702.146 (AC)**: cast transformed from graveyard; if it would leave, it's exiled (face-up back face typically has that clause).
- **Decayed 702.147 (S+T)**: can't block; sacrifice at end of combat after attacking. Zombie token fodder.
- **Cleave 702.148 (AC)**: remove bracketed text. Cast alternative cost.
- **Training 702.149 (T)**: attacks with a creature of greater power -> +1/+1 counter.
- **Compleated 702.150**: Phyrexian-mana planeswalker enters with 2 fewer loyalty per life-paid symbol.
- **Reconfigure 702.151 (A x2)**: sorcery-speed attach/unattach; while attached it stops being a creature. An unattached one is a creature again (Equipment Creature, so creature-type-based effects count it).

## Alt-cost / additional-cost keywords
- **Blitz 702.152 (AC)**: haste, draws on death, sacrificed at next end step. Sacrifice = death trigger fodder and a "dies" draw.
- **Casualty 702.153 (ADD)**: sacrifice a creature with power N+, copy the spell. Copy is not cast (no cast triggers, e.g. storm/prowess do fire on the original).
- **Enlist 702.154**: attack cost: tap a non-attacking creature with haste or that has been under your control since turn start; this creature gets +X/+0 equal to its power. Can't enlist itself.
- **Read ahead 702.155**: Saga enters with chosen lore count; chapters for lower numbers skipped the turn it entered.
- **Ravenous 702.156 (R + T)**: enters with X +1/+1 counters; X>=5 draws. Blocks undying.
- **Squad 702.157 (ADD + T)**: pay any number of times; token copies on ETB (copies are tokens: ETB triggers, legendary rule applies if legendary).
- **Space sculptor 702.158, Visit 702.159, hidden agenda**: single-card / Attraction mechanics; ignore for Commander synergy.
- **Prototype 702.160**: cast with alternative P/T/mana cost; on battlefield only prototyped characteristics. Mana value is the prototyped one only when cast prototyped; in other zones it is the full one.
- **Living metal 702.161**: Vehicle that's a creature on your turn only; can attack without crew; creature on your turn only.
- **More Than Meets the Eye 702.162 (AC)**: cast converted (back face up).
- **For Mirrodin! 702.163 (T)**: Equipment ETB makes a 2/2 red Rebel token and attaches. Token maker.
- **Toxic 702.164 (S)**: combat damage to a player also gives poison counters equal to total toxic value; extra to normal damage (still deals damage / lifelink / commander damage). Unlike infect, damage still removes life. Stacks additive.
- **Backup 702.165 (T)**: ETB: N counters on target creature; if another, it gets the printed abilities below backup until EOT. Only printed abilities, not granted ones. Counter source.
- **Bargain 702.166 (ADD)**: sacrifice an artifact, enchantment, or token (tokens/Treasures/Food are fodder).
- **Craft 702.167 (A)**: exile this + materials (from permanents and/or graveyard); returns transformed; sorcery speed. Graveyard cards count only if specified by "card".
- **Disguise 702.168 (AC)**: cast face down 2/2 with ward {2} for {3}; turn up for disguise cost (special action, no ETB trigger on flip). Face-down is colorless, nameless, no types except creature.
- **Solved 702.169**: Case-only.
- **Plot 702.170 (SA)**: exile at sorcery timing paying cost, cast free later at sorcery speed on a later turn. Plotted card can't be cast on the same turn.
- **Saddle 702.171 (A)**: Mount: tap creatures with total power N, becomes saddled until EOT; sorcery speed. Saddlers can be summoning sick. Mount is itself the creature (no type change).
- **Spree 702.172 / Tiered 702.183**: modal additional costs (spree: choose one or more; tiered: choose one).
- **Freerunning 702.173 (AC)**: needs an Assassin or your commander to have dealt combat damage to a player this turn. Commander-specific.
- **Gift 702.174**: may choose an opponent to give the gift (Food, Treasure, card, tapped Fish, Octopus, extra turn); gift effect happens first. "Gives a gift" triggers on resolution of the spell or gift trigger. Gift to an opponent: the opponent gets the token (not you).
- **Offspring 702.175**: pay extra; token copy is 1/1 (not 1/1 base; copy with set P/T). Legendary token copies cause the legend rule problem for the same player: it can't remain with the original.
- **Impending 702.176 (AC)**: enters with N time counters, not a creature while it has one; counter removed each end step; after that it becomes a creature. Counts as an artifact/enchantment (non-creature) while impending.
- **Exhaust 702.177**: activated ability only once per game per object.
- **Max speed 702.178 / Start your engines! 702.179**: speed (0-4) set by effects; increases once per turn when an opponent loses life on your turn. Max speed is speed 4.
- **Harmonize 702.180 (AC, graveyard)**: tap a creature to reduce cost by its power; exiled after.
- **Mobilize 702.181 (T)**: attacks -> N 1/1 red Warrior tokens tapped and attacking, sacrificed at next end step. Token maker (not "attacks" triggers for tokens; they were never declared). ETB and sacrifice fodder; each instance triggers.
- **Job select 702.182 (T)**: Equipment ETB makes a 1/1 Hero token and attaches.
- **Station 702.184 (A)**: tap ANOTHER untapped creature you control: add charge counters equal to its power; sorcery speed. Spacecraft cards need counters at thresholds. Power of tapped creature is the number; alternatives may use toughness. Summoning-sick creatures can be tapped for it (cost isn't their own {T}).
- **Warp 702.185 (AC)**: cast from hand for warp cost; exiled at next end step; can be cast from exile later normally. Each cast triggers ETB. Warped permanents count as having entered each time.
- **Infinity 702.186**: Infinity cards, "harnessed".
- **Mayhem 702.187 (AC, graveyard)**: if you discarded it this turn, cast from graveyard.
- **Web-slinging 702.188 (AC)**: return a tapped creature to hand.
- **Firebending 702.189 (T)**: attack: add N {R}, kept through combat.
- **Sneak 702.190 (AC)**: during declare blockers, return an unblocked creature; the new permanent enters tapped and attacking the same defender (not declared as attacker: no attack triggers). Needs unblocked creatures; bounce enables ETB reuse.
- **Increment 702.191 (T)**: whenever you cast a spell with more mana spent than power or toughness, +1/+1 counter. Mana spent, not mana value.
- **Paradigm 702.192**: first resolution exiles it; each of your precombat main phases create a free castable copy.
- **Power-up 702.193**: activated ability cost reduced by this permanent's mana cost the turn it enters; once only.
- **Teamwork 702.194 (ADD)**: tap creatures with total power N or more as an additional cost.
- **Storied 702.195**: three or more permanents that are artifacts, Sagas and/or legendary -> enduring story designation. Legendary counts.
- **Beam me up 702.196 (AC, graveyard)**: instant/sorcery cast from graveyard returning a creature you control to hand; exiled after.

Last keyword covered: Beam me up (702.196b); read lines 4700-5487 (788 lines).
