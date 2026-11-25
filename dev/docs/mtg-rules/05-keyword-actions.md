<!-- Condensed from the Magic Comprehensive Rules effective 2026-11-06 by reading agents (see dev/docs/mtg-rules-primer.md). Rule numbers are the source's. Lines marked outside range or verify were not read: check them in the full text (bash dev/tools/jxa-harness/fetch_comp_rules.sh). -->
# CR 701 Keyword Actions: primer for oracle-text reading

General principle: a "whenever you [action]" trigger fires only on that exact action. Zone-change words are NOT interchangeable: destroy, sacrifice, discard, exile, mill, counter, "dies" (battlefield to graveyard by any route) each differ. Many actions end "after the process is complete, even if parts were impossible" (scry, surveil, connive, explore, discover, amass, manifest dread, blight, Ring): the trigger still fires.

## Zone-change verbs (the big trap group)
- **Destroy 701.8**: battlefield to graveyard, but ONLY via the word "destroy" or SBA (lethal damage 704.5g, deathtouch 704.5h). Sacrifice, -X/-X toughness 0, legend rule, and "put into graveyard" are not destroy. Regeneration (701.19) and indestructible stop destroy only. "Dies" triggers fire on all battlefield-to-graveyard routes; "destroyed" triggers only on true destroy.
- **Sacrifice 701.21**: controller moves own permanent to owner's graveyard. Not destroy (no regen/indestructible help). Can't sacrifice what you don't control or non-permanents. Counts as dies. Edicts ("each player sacrifices") bypass hexproof/indestructible.
- **Discard 701.9**: hand to graveyard, owner chooses unless random/other-chooses. Not sacrifice, not mill, not dies. Cards discarded then replaced to a hidden zone have undefined characteristics (701.9c), and cost payment can be illegal.
- **Exile 701.13**: any zone to exile. Not dies, not graveyard; defeats graveyard recursion and death triggers. Many "collect evidence"/"forage"/"airbend" costs are exile.
- **Mill 701.17**: top of library to graveyard (N cards; can't mill more than library size, and "mill N" as a cost is impossible if library is short). Feeds graveyard but is not discard or "put into graveyard from battlefield." Surveil is NOT mill (see below). "Milled card" can be referenced in public zone (701.17c).
- **Counter 701.6**: cancel a spell or ability on the stack; countered spell goes to graveyard (not "dies", not discarded). No refund of costs. "Counter" the verb is unrelated to counters (markers).
- **Create 701.7** (tokens): put tokens onto the battlefield. "Create" and "put onto the battlefield" are equivalent for tokens post-errata (701.7c). Replacement effects on creation (e.g. token-doubling) apply before characteristic changes. A token creation triggers "enters" triggers, but a "whenever you create a token" payoff cares about the create action only.
- **Tap/Untap 701.26**: only untapped can be tapped and vice versa. "Becomes tapped" payoffs differ from tap costs.

## Cast vs play (701.5, 701.18)
- **Cast** = put a spell on the stack and pay costs; a card cast is a spell (701.5b). Lands are never cast. Triggers on "cast" fire as you pay, before resolution, and see only spells.
- **Play** = play a land (special action, no stack, only your main phase with empty stack, once per land drop) OR cast a spell, as appropriate (701.18b). "You may play lands from your graveyard" permissions do not let you cast spells, and "play cards" wording covers both. Putting a land onto the battlefield by effect is NOT playing it, so does not use the land drop and does not trigger "whenever you play a land." Landfall is an "enters" trigger, so it fires for both. Old cards that said "play" a spell are errata'd to "cast" (701.18d); "play" in "play with the top card revealed" means playing the game (701.18c).
- **Activate 701.2**: put an activated ability on the stack and pay costs. Not a cast; "whenever you cast" ignores abilities.

## Counters (markers) and counter-placing actions
- **Proliferate 701.34**: choose any number of permanents/players that have counters; each gets ONE more of each kind it already has. Needs an existing counter; hits poison, loyalty, charge, -1/-1, +1/+1 etc. Can target opponents' (for poison or to skip). Chooser picks, so it's selective; non-counter permanents are unaffected.
- **Double 701.10**: doubling power/toughness is a continuous +X/+0 or +0/+X based on value at resolution (not a set), negatives handled (701.10c). Doubling counters (701.10e) gives as many again of each kind. Doubling life total gain/loss to reach 2x; doubling damage is a replacement effect (701.10g); doubling mana adds same again. **Triple 701.11**: gives +X where X is twice the value. Counter doublers (replacement) are a different thing from "double the number of counters" (action).
- **Monstrosity 701.37**: if not monstrous, put N +1/+1 counters and become monstrous. Once only per permanent (marker designation, lost on leaving battlefield). Counters trigger "+1/+1 counter put" payoffs; "becomes monstrous" triggers separately.
- **Adapt 701.46**: put N +1/+1 counters only if it has NONE; with any +1/+1 counters it does nothing (but still counts as having adapted). With counter-doublers or proliferate synergy this is conditional.
- **Bolster 701.39**: N +1/+1 counters on your creature with the LEAST toughness (ties: you choose). Not targeted; can't be aimed at your best creature.
- **Support 701.41**: +1/+1 counter on each of up to N OTHER targets (permanent version excludes itself; spell version doesn't). Targeted.
- **Explore 701.44**: reveal top card; land goes to hand; nonland gives +1/+1 counter on the explorer and you may bin the card to graveyard. Fills graveyard optionally, draws lands (card in hand but not "draw"), counter only if nonland. Explore triggers still fire if the permanent is gone (last known info).
- **Connive 701.50**: draw then discard (N for connive N); +1/+1 counter per NONLAND card discarded. Draw and discard are real actions, so it triggers "whenever you draw" and "whenever you discard". Lands discarded give no counter. Connive 0 does nothing. Fuels graveyard.
- **Recruit 701.70** (recent): draw then discard; if nonland discarded create a 1/1 white Human Soldier token. Same draw+discard trigger profile as connive but makes a token, not a counter.
- **Amass 701.47**: if you control no Army, create a 0/0 black [subtype] Army token; then put N +1/+1 counters on an Army you control (one Army, grows). Produces a token only the first time; counters thereafter. Can add subtype (Zombies/Orcs). Triggers "amassed" even if impossible.
- **Endure 701.63** (recent): your choice per resolution: create an N/N white Spirit token OR put N +1/+1 counters on the permanent. Endure 0 does nothing.
- **Blight 701.68** (recent): put N -1/-1 counters on a creature YOU control (a cost-like choice; impossible with no creatures). Self-shrinking, feeds -1/-1 counter payoffs and persist/undying-style interactions; "blighted creature" refers to the chosen one.
- **Incubate 701.53**: create an Incubator artifact token with N +1/+1 counters; {2}: transform into a 0/0 Phyrexian artifact creature token. Token plus counters, a mana sink; counters are present on the artifact (matter for proliferate/doublers).
- **Empower Jace 701.71** (recent): if no Jace token, create one (0 loyalty, -1 surveil 1, -3 draw); then add N loyalty counters. Planeswalker token with loyalty counters.
- **Assimilate 701.72** (recent): gain control of permanent (or put a card from other zone onto battlefield under your control), +1/+1 counter, it becomes a Borg artifact creature. Control change plus counter; works from graveyard/exile too.
- **Earthbend 701.66** (recent): target land you control becomes a 0/0 haste land creature with N +1/+1 counters; if it dies or is exiled, it returns tapped. Land that is a creature (dies triggers, creature-count and land-count payoffs both apply). Earthbend trigger fires when the delayed trigger is created.

## Tokens and copies
- **Investigate 701.16**: create a Clue token (artifact; {2}, sac: draw a card). Triggers both "create a token" and later "sacrifice an artifact/Clue" and "draw". It is not drawing itself.
- **Populate 701.36**: copy a creature token you control (nothing if you control none; you choose which). Copies keep token status and copiable values, so it duplicates ETB creators.
- **Manifest 701.40 / Cloak 701.58 (ward {2}) / Manifest dread 701.62**: put a card face down as a 2/2 creature (name-less, no types). Can be turned up for its mana cost only if it is a creature card (special action, no stack). Instants/sorceries can't be turned up. Manifest dread: look at top two, manifest one, other goes to graveyard (a mill-like fill). Manifested cards from the library are not "cast" and not "drawn"; they are face-down permanents, not tokens.
- **Suspect 701.60**: a creature gets menace and "can't block" as a designation; can't be re-suspected. Not an ability, not copied.
- **Harness 701.64** (recent): self-designation "harnessed", once per permanent; enables later abilities. Monstrous-like marker.

## Library and hand manipulation
- **Search 701.23**: look at all cards in a zone. A search for a quality may find nothing even if cards exist (hidden zone, 701.23b); "a card" or "three cards" with no quality must find them (701.23d). Not revealed unless the text says reveal (701.23e). Search is not draw and not reveal; a search that puts a card in hand does not trigger "draw". "Whenever a library is searched" triggers can fire even if replaced by a partial search (701.23f). Search with unrestricted description can always fail by choice only for stated qualities.
- **Reveal 701.20**: show to all; the card stays in its zone (701.20b). Reveal does not move or cast anything. Hand-reveal costs (e.g. behold) leave the card in hand. Revealing is distinct from "look at" (private).
- **Shuffle 701.24**: triggers even with 0 or 1 card in the library (701.24e) and if nothing was shuffled in (701.24d); found cards from "search, shuffle, then put" are excluded from the shuffle (701.24b). Multiple simultaneous shuffles trigger multiple times.
- **Scry 701.22**: look at top N; any to bottom, rest top, any order. No cards leave the library, no graveyard. Scry 0 doesn't happen, no trigger. Trigger resolves after completion.
- **Surveil 701.25**: like scry but "to graveyard" instead of bottom. DOES put cards in the graveyard, but is not mill and does not count as "milled" or "discarded"; graveyard-count payoffs still see them. Surveil 0 doesn't happen.
- **Fateseal 701.29**: scry on an opponent's library (bottom or top).
- **Clash 701.30**: reveal top; may put on bottom; higher mana value wins.
- **Learn 701.48**: may discard a card, if so draw; if not discarded, may fetch a Lesson from outside the game (sideboard; irrelevant in Commander). Rummage, with discard and draw triggers only if you choose discard.
- **Discover 701.57**: exile from top until a nonland card with MV N or less; may cast it free (the exiled card's MV must be <= N, so cast-from-exile triggers); otherwise put into hand. Other exiled cards go to library bottom randomly. Fires "cast" triggers if cast, "exile" payoffs, not "draw". Discovered card = final exiled card, even if lands were skipped (701.57c).
- **Collect evidence 701.59**: exile cards from your graveyard with total MV >= N (cost). Consumes graveyard; doesn't use a single card. Linked to "if evidence was collected".
- **Forage 701.61** (recent): exile three cards from your graveyard OR sacrifice a Food. Either is a cost option; sacrificing a Food triggers sacrifice/Food payoffs and gain-life if Food is used, the graveyard route does neither.
- **Behold 701.4** (recent): reveal a [quality] card from hand OR choose a [quality] permanent you control; the quality is checked when beheld (701.4b). Does not tap/sacrifice/move anything.
- **Time travel 701.56**: add or remove a time counter on each of any chosen objects (permanents or suspended cards). Counts as counter addition/removal.

## Combat/control and state actions
- **Fight 701.14**: each deals damage equal to its power to the other. Not combat damage (701.14d), so combat-damage triggers don't fire; deathtouch and lifelink still work as damage. Both must be legal or neither deals damage. Self-fight deals twice its power. Sources that "fight" are not attacking.
- **Goad 701.15**: until your next turn the creature attacks each combat if able and must attack a player other than the goader if able. Goading is a designation; multi-goad stacks per player.
- **Detain 701.35**: until your next turn, can't attack/block and its activated abilities can't be activated (static abilities and triggers still work).
- **Exert 701.43**: choose as it attacks; it won't untap in your next untap step. Optional attack cost, usually with a "when you do" trigger (linked). Can be exerted when untapped.
- **Attach 701.3**: move Aura/Equipment/Fortification onto a legal object or player; it gets a new timestamp when moved. Reattaching to the same object does nothing. Equip is an activated ability that attaches; "whenever attached" triggers care about the action/state.
- **Exchange 701.12**: all or nothing (control, life, zones, values). Same-controller control exchange does nothing. Life exchange counts as gain/loss and fires lifegain/lifeloss triggers.
- **Regenerate 701.19**: replacement shield against destroy only (not sacrifice, not -X/-X, not exile). Taps the permanent, removes damage and removes from combat. Activating a regeneration ability is not regenerating (701.19c).
- **Transform 701.27 / Convert 701.28**: flip a double-faced permanent; same object, counters and effects persist. Does nothing to non-DFC permanents or instant/sorcery faces. Not "turned face up/down" (different action). A transform is ignored if it already flipped after the ability was put on the stack (701.27g).
- **Meld 701.42**: exile or otherwise bring both halves of a meld pair together; only a true pair works, else they stay in place (tokens won't).
- **Vote 701.38**: players choose in turn order; only effects saying "vote" count; multiple votes happen together.
- **Venture 701.49**: advance a dungeon marker (initiative-like, ability-based); no dungeon in zone means pick one. Triggers "venture" payoffs, with completion tracked separately.
- **Ring tempts you 701.54**: choose a Ring-bearer (a designation, legendary, can't be blocked by greater power); emblem grows with the number of times tempted. Triggers on "whenever the Ring tempts you" even if impossible. The emblem is not copied.
- **Face a villainous choice 701.55**: opponent picks one of two options; impossible/illegal options are allowed (do as much as possible).
- **Airbend 701.65** (recent): exile the objects; each exiled card can be cast for {2} by its OWNER for as long as it remains in exile. Exile (not destroy/dies/graveyard), can include spells on the stack; payoff "whenever you airbend" fires on the exile instruction. Not a counter in the 701.6 sense but removes a spell from the stack.
- **Waterbend 701.67** (recent): pay the cost, and for each generic mana in the waterbend cost you may tap an untapped artifact or creature instead (summoning sickness doesn't block, since it's not a {T} ability cost). Only the waterbend portion gets this (701.67b). "Whenever you waterbend" fires on any payment.
- **Heal 701.69** (recent): remove marked damage from a permanent. Not lifegain.

## Non-Commander / ignorable
Planeswalk 701.31 (Planechase), Set in Motion 701.32 and Abandon 701.33 (Archenemy), Assemble 701.45 (Unstable, silver-border), Open an Attraction 701.51 and Roll to Visit 701.52 (Attractions deck, not legal in standard Commander), Learn's outside-the-game part, Fateseal rarely.

## Interaction cheat-sheet
- Death triggers ("dies") = battlefield to graveyard: destroy, sacrifice, lethal damage, -X/-X (SBA) all qualify; exile, bounce, counter (spell never was a permanent), discard, mill do not.
- Graveyard-filling and what they fire: discard (discard triggers), mill (mill triggers; "milled"), surveil (surveil triggers; NOT mill, NOT discard), explore (optional bin; no named trigger on the bin), connive/learn/recruit (discard + draw), manifest dread (other card to graveyard).
- Draw-like but not "draw": explore (land to hand), search to hand, discover's "put into hand", learn's Lesson fetch.
- Card-leaves-graveyard payoffs: collect evidence, forage, flashback, escape, airbend (from exile, not graveyard).
- Token creators: create (investigate, incubate, amass first time, endure Spirit, recruit, populate, empower Jace). Counter placers: bolster, support, adapt, monstrosity, explore, connive, amass (later), endure (counter branch), earthbend, assimilate, proliferate (multiplier).
- Conditionals: adapt only with zero +1/+1 counters; amass token only with no Army; empower Jace token only with no Jace; harness/monstrosity once; proliferate needs counters already; bolster hits the smallest creature.
- Designations that aren't abilities or copiable: goaded, monstrous, harnessed, suspected, Ring-bearer. Clones of these permanents don't inherit them.
- Playing/casting: lands are played, never cast; spells are cast, never "played" in rules usage except as part of "play a card." Cast triggers need a spell on the stack; discover and cascade casts count, free casts still count as cast.

Lines read: 3285-3910 (626 lines, from the requested range 3285-3911).
