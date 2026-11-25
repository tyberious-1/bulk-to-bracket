---
name: btb-architecture
description: Use when adding or moving a js/ file, touching script load order, legalForCommander/canBeActiveCommander, the format switch, the API wrappers, the UI tabs, or ManaBox CSV parsing in the bulk-to-bracket repo.
---

# Bulk to Bracket: architecture map

> **Summary:** Where each js/ file lives and what it owns, the global-script load-order rule (new file = script tag in BOTH index.html and pauper.html plus build_harness.sh), the format-aware legality functions, and ManaBox export handling.
> **STOP here unless** you are adding, moving or wiring a js/ file, changing legality or the pauper format switch, or need to know which file owns something.
> Everything below is detail moved verbatim from the old AGENTS.md; skip it if the summary answers your question.

## Architecture

All JS is plain global-scope script files (no ES modules, no bundler).
`index.html` and `pauper.html` each load them via `<script>` tags in a
specific dependency order — a file must be loaded *after* every other file
whose functions it calls at parse time or top-level scope. **When you add a
new `js/` file, add its `<script>` tag to BOTH `index.html` and
`pauper.html` in the same position** (and to `dev/tools/jxa-harness/build_harness.sh`'s
script list), or its functions won't exist yet when later scripts run on
one of the two pages.

Layout:
- `js/constants.js`, `js/dom.js`, `js/state.js` — shared config/DOM refs/state
- `js/format.js` — the format switch: `setActiveFormat`/`isPauperFormat`/
  `canBeActiveCommander`. `activeFormat` defaults to `"commander"` and
  `index.html` never calls `setActiveFormat`, so it's a no-op there;
  `pauper.html` sets it once, inline, right after loading this file.
- `js/utils/` — generic helpers (text, cards, deck-stats). `cards.js` holds
  `canBePauperCommander`, the rarity-aware `legalForCommander`, and `deadForColors` (a card whose ability keys on "black creature spells you cast" in a deck with no black; both builders skip it).

- `js/api/` — `scryfall.js`, `edhrec.js`, `http.js` (fetch wrappers).
  `scryfall.js`'s `convertScryfallCard` captures each card's `rarity`
  (lowercased string), which is what the pauper legality checks key off of.
- `js/collection/csv.js` — ManaBox CSV parsing
- `js/analysis/` — theme detection, scoring/role detection, commander matching, pairing,
  `plans.js` (plan options with owned-card coverage; see the plan-first spec)

- `js/build/` — the deck builder itself: `type-plan.js` (target buckets by
  card type; also `CENTER_UPGRADE_MAX` 12, `CENTER_LINK_KEEP` 3, `CENTER_STRONG_LINK` 14 and `curveHasRoom(curvePlan, cmc, card)`,
  which lets a card with `centerWeight` of 14 or more skip the curve band cap), `deck.js` (fill/backfill logic),
  `manabase.js`, `bracket.js`
- `js/ui/` — tab rendering (`commanders-tab.js`, `theme-tab.js`,
  `collection-analytics.js`, `commander.js`, `report.js`, `status.js`),
  autocomplete, charts, export, hover previews
- `js/cache.js` — localStorage-backed API response caching
- `js/main.js` — wires the above together: CSV upload → commander resolution
  → EDHREC fetch → `buildDeckFromScoredPool` → rendering/export; owns
  `generateDeck()`/`runRegeneration()`, the entry points every rebuild path
  (theme-priority buttons, Minimal Build toggle) calls back into.

Every place in the pipeline that decides "is this card legal" or "can this
card be the commander" goes through `legalForCommander(cardColors,
commanderColors, card)` or `canBeActiveCommander(card)` — both are
format-aware and behave exactly as before under the default `"commander"`
format. Under pauper format, `main.js`'s EDHREC fetch is skipped entirely
(no PDH-equivalent synergy API exists); pauper builds run on Scryfall +
collection data only, through the same "Collection Fallback" path that
already exists for any commander EDHREC has no data for.


## ManaBox exports

A single-binder export has no `Binder Type` column; a full export has binder /
deck / list rows. `js/collection/csv.js` keeps the type on every row: wish-list
rows are never owned, deck rows are excluded unless the player ticks "Count the cards
in my decks" (the `binderOptions` control under the file input). The friend's
export (see memory) is the multi-binder case for testing.


