---
name: btb-gotchas
description: Use when something behaves oddly in the bulk-to-bracket repo (wrong card, odd role tag, a lost ability text, tapped-land choices, bottom-up ranking, export format) before concluding it is a bug, or before changing role tags.
---

# Hard-won gotchas

> **Summary:** Known traps: Scryfall and EDHREC name quirks, role tags that look wrong but must not be fixed by reasoning alone, the card-name ~ replacement, land rule, export limits, bottom-up ranking pitfalls.
> **STOP here unless** a result looks wrong, you are about to change a role tag or reader, or you hit a fixture or format surprise.
> Everything below is detail moved verbatim from the old AGENTS.md; skip it if the summary answers your question.

## Common gotchas (learned the hard way — verify against current code, don't assume these are still exactly true)

- Scryfall's card-collection endpoint rejects "Front // Back" style double-faced
  names — look up the front face name instead.
- EDHREC's own "A // B" naming means a *partner commander pair*, not a
  double-faced card — same separator, opposite meaning, don't conflate them.
- A card name can belong to two Scryfall cards: No Way Out is a black Midnight Hunt sorcery and a colorless Planechase plane, and the
  name lookup returned the plane, so it fit every deck and Moxfield flagged it. `fetchChunk` in `scryfall.js` now re-searches when a
  lookup lands on a non-deck layout (`NON_DECK_LAYOUTS`), `legalForCommander` rejects plane/scheme/token types, and the card cache
  key was bumped to v4 to drop stale entries. `owned_raw.json` still holds the plane (fixtures are not re-fetched), so the harness
  cannot show this card; the ManaBox CSV carries a Scryfall ID that the app does not use.
- `terms.js` reads a counter trigger by kind: a need on -1/-1, charge, poison or other non-+1/+1 counters no longer adds the generic
  "counter" term, so Wickersmith's Tools (-1/-1 trigger) stopped reading as a +1/+1 counters payoff; the infect plan declares
  `-1/-1 counter` in `THEME_PLAN_TERM_OVERRIDES` so Flourishing Defenses still counts there. Known leftover: a card that puts a
  charge counter on itself (Wickersmith's Tools again) still reads as a counters-plan member through the generic "counter" make.
  Tried and dropped: treating "counters are put on this ..." triggers as self triggers (it cost Herd Baloth and did not bring
  Claim the Kingdom back).
- Control + a tribe with no second layer builds a creature-heavy list (Wizards UR: 36 creatures, 35 Wizards, about 11 instants and
  sorceries), because the tribe is the only plan signal and leftover slots go to plan creatures up to `BOTTOM_UP_PLAN_CREATURES_MAX`.
  Capping control's tribe fill near 14 + 6/10 only swapped Wizards for no-signal filler (placeholders 3 -> 11, other tribes up to 15),
  so it was reverted. The "Instants and sorceries" layer fixes it (Wizards UR control: 31 creatures, 22 instants and sorceries,
  0 placeholders). Idea not built: show only the second layers that fit the chosen tribe and colors (the select lists all six
  always), then add counters and tokens as theme layers after measuring.
- Export: Moxfield's text import has no commander marker we could confirm. `1x Name (set) [Commander{top}]` was tried on the commander
  line and did not work in Moxfield (reverted). ManaBox's docs mention no marker either; the player sets the commander after import.
- Deck list entries carry no oracle text by themselves — if you need card
  text for scoring/role detection, you must join against the Scryfall data,
  not assume it's already on the deck entry.
- Theme cutoffs for "is this theme worth backfilling toward" are relative
  (floor + % of the top theme's count), not a flat number — a flat cutoff
  reintroduces the bug where niche themes either never qualify or always do.
- Generic backfill only kicks in once theme-tier backfill runs dry for a
  slot — don't make generic backfill compete with theme fit by default.
- Phase 0 (`deck.js`'s support-role fill) never looks at a theme-match card
  that carries no ramp/draw/removal/wipe tag, no matter its CMC — left alone
  it spends the entire cheap end of the curve on generic role cards before
  later phases ever reach the theme tier. `pickCheapThemeSeeds` reserves a
  few of the cheapest curve bands for theme cards before Phase 0 runs, so a
  commander's actual strategy doesn't start at CMC 4+.
- `detectRole`'s shared `ROLE_TEXT_PATTERNS.wipe` list matches on pattern
  text alone, so scope (a flier-only sweeper, a single-player-scoped combat
  trigger) and magnitude (1-2 damage, `-1/-1`) both need their own checks —
  text matching a "wipe" pattern isn't the same as the card actually
  clearing a board. See `wipeMatchIsNarrowed`/`hasLethalMassDamage`/
  `hasLethalMassStatDrop`/`massSacrificeHitsCreatures` in `scoring.js`.
- `SUPPORT_ROLES` checks `ramp` before `draw`, and "create a Treasure" reads
  as a ramp signal — a treasure-making aristocrats payoff (Deadly Dispute,
  Seize the Spoils, Gadrak the Crown-Scourge, ...) whose real job is card
  draw or sac-value still files under `ramp`. Confirmed in a real Kardur,
  Doomscourge build with zero dedicated ramp pieces reporting a ramp count
  of 8. Not Curve-First-specific, and no fix is scheduled — the role-bucket
  count just isn't a reliable "how much does this deck accelerate" proxy for
  a treasure-heavy shell.

- Role tags that look wrong were tested on 2026-11-05 and are NOT to be "fixed" on reasoning alone: `ramp` counts "less to cast" cost
  reducers (taking it off moved 12 of 13 builds and made Whisper and Ghalta worse: those cards keep the ramp slots out of generic
  filler) and `wipe` counts "each player/opponent sacrifices" edicts (making a self-hitting edict not a wipe was neutral and
  gave Tormod's build a true wrath). Both tags are documented reasoning from 2026-09, never measured before that test; measure a
  change on the owned-commander builds and the 13-build diff, then read the picks. Artifact and enchantment removal counts as strong
  removal (the user, 2026-11-05: breaking a web piece is like removing a commander); do not tag it weak. `WIPE_SCOPE_NARROWER` also
  reads `^\s*you control\b`, so "exile all creatures you control" (Day of the Dragons) is not a wipe.
- A card's own name (and the part before its comma) is replaced by `~` as a whole
  word in `abilities.js`. A test fixture whose name appears as a word in its own text
  (a card named "Mill" saying "mill three cards") silently loses that text; give
  fixtures names that do not occur in their text.
- The harness fixtures (`owned_raw.json`, `prefetch_data.json`) are only as new as the
  last `fetch_owned.py` run against `dev/card inventory.csv` (regenerated 2026-10-29), so a
  card bought since is missing from `event_producers.js` and the 13-build runs. The
  inventory deliberately leaves out every card of three or more colors (Perrie, the
  Pulverizer is one), so its absence is not a stale export. `prefetch_data.json` holds only the 13
  sample builds (12 commanders plus the Tormod + Ghost pair, cut from 54 on 2026-10-29);
  `prefetch.py` merges and never prunes, so shrinking the set is a manual edit of the file.
- Headless Chrome has a minimum window width, so `--window-size=390,...` screenshots
  are cropped desktop layouts, not a phone viewport. `browser_smoke.py` checks the page
  runs and renders, not phone layout.
- Never leave a stdin-reading command (a bare `cat`) in a shell call: it hangs.

- Bottom-up measuring: put the build in `buildDeckBottomUp` and read members, payoffs, placeholders (`fallbackCount`),
  role counts and creature count for a few tribes at all three archetypes (UR Wizards, WU Knights, BG Insects, BR Goblins
  is a good set, or `bottom_up_audit.js` for all 12 strategies); compare against a hand-built deck by card name. Do not run all 13 commander-first builds for a
  bottom-up change: nothing in that path reads `archetypes.js` or `bottom-up-deck.js`. A change to shared scoring
  (`scoring.js`) does need the 13-build diff, so correct role mistakes locally in `bottomUpRole` instead.
- `convertScryfallCard` keeps the whole Scryfall record as `card.raw`, so `raw.keywords` and `raw.edhrec_rank` (popularity,
  1 is most played, present on almost every owned card) are available without touching `scryfall.js`. Test fixtures have no
  `raw`: read them with a fallback.
- Bottom-up ranking pitfalls: cards with equal scores fell to the alphabet (A-names won), so check ties before judging a
  pick. Using the commander-first generic card score as a tie-break backfired (role-tagged non-tribe creatures outranked
  members); `edhrec_rank` is the safe tie-break because it never reorders different scores. A keyword bonus must apply only
  to the deck's own creatures, or a flying card-drawer outranks the spells competing for its role slot. A card listing
  (first 40 sorted by mana value) biases a hand-built deck toward one-drops: rank or filter before reading.
- Land rule (player preference): untapped lands first; a tapped land only for plan-relevant utility (surveil, recursion, a
  manland tied to the plan); skip "choose a color, enters tapped" and "{1},{t}: add any color" lands. Creature-type lands
  (Secluded Courtyard set to the tribe, Lupinflower Village) suit a tribe. The rule is `landRuleAllows` in `manabase.js`; `buildBottomUpManaBase` (through `bottomUpLandAllowed`, which passes the tribe) and the commander-first build in `deck.js` both filter a copy of the card data before calling `buildNonbasicManaBase` (a BR Vampire deck's nonbasics went from 7 of 12 tapped to 1, a manland; the 13 commander-first builds went from 3-9 tapped nonbasics to 0-3, nonland cards unchanged, 2-5 fewer sources per color but 18+ in every deck; Path of Ancestry stays for a tribal commander).
- Fetching: YouTube pages and Commander Template deck folders cannot be read by a plain fetch (JavaScript-rendered or 403), and
  caption tools that cycle client identities to get around YouTube's block are refused as bot-check circumvention. Ask the
  player to paste the text instead.


