# Pauper Commander (PDH) Page

Date: 2026-10-06
Status: Draft for review

## Motivation

A banner link was requested pointing to "a copy of the app for Pauper EDH /
Pauper Commander," referencing pdhrec.com. Investigation found PDHREC has no
CORS-enabled JSON API the way `json.edhrec.com` does (confirmed: EDHREC sends
`access-control-allow-origin: *`, PDHREC sends no CORS header at all, and its
pages are server-rendered HTML with synergy/popularity baked into element
attributes, not a documented JSON schema). A real PDHREC integration would
require HTML-scraping through a third-party CORS proxy — fragile, adds an
external runtime dependency this app has never had, and carries scraping-ToS
risk that hasn't been cleared.

Decision: build the Pauper Commander variant on Scryfall + local collection
heuristics only, the same way this app already handles any commander EDHREC
has no data for (`main.js`'s existing "Collection Fallback" path). No PDHREC
dependency at all.

Pauper Commander (PDH) rules, per pdhrec.com/about: 100-card deck (99 + the
commander, same total as standard Commander), commander must be **any
uncommon creature** (not necessarily legendary), every other card must be
**common** rarity, color identity rules unchanged.

## Non-goals

- No PDHREC data integration (scraping or otherwise) — see Motivation.
- No new scoring/theme-detection logic. Reuses `detectCommanderThemes`'s
  existing local-keyword fallback path verbatim.
- No change to deck size, Minimal Build, bracket estimation mechanics, or any
  other build-mode behavior — format only gates *legality* (which cards can
  be the commander, which cards can be in the 99) and *whether EDHREC is
  fetched at all*.
- No separate collection file, cache, or CSV format — same ManaBox CSV
  upload, same `js/cache.js` localStorage cache.

## Design

### A. The format switch

New file `js/format.js`, loaded immediately after `js/utils/cards.js` (needs
`getCardType`, added there alongside `canBeCommander`/`legalForCommander`'s
new rarity awareness — see below):

```js
let activeFormat = "commander"; // or "pauperCommander"

function setActiveFormat(format) { activeFormat = format; }
function isPauperFormat() { return activeFormat === "pauperCommander"; }

function canBeActiveCommander(card) {
  return isPauperFormat() ? canBePauperCommander(card) : canBeCommander(card);
}
```

`index.html` never calls `setActiveFormat`, so `activeFormat` stays
`"commander"` and every format-aware function below is a no-op change for
the existing app — provable by the existing test suite passing unmodified.
`pauper.html` calls `setActiveFormat("pauperCommander")` in a one-line inline
`<script>` placed after `js/format.js`'s `<script src>` and before
`js/main.js`'s.

### B. Commander eligibility

New function in `js/utils/cards.js`, next to `canBeCommander`:

```js
function canBePauperCommander(card) {
  const frontType = getCardType(card).split("//")[0];
  return card?.rarity === "uncommon" && frontType.includes("creature");
}
```

Mirrors `canBeCommander`'s front-face-only handling for double-faced cards.
Deliberately does not reuse `COMMANDER_PERMITTED_SUBTYPES` (vehicle/spacecraft)
or the `"can be your commander"` text escape hatch `canBeCommander` has —
PDH's own rule is literally "any uncommon creature," nothing else.

Call sites that hardcode `canBeCommander` today and need to go through
`canBeActiveCommander` instead, because they're shared between both pages:

- `js/analysis/commander-match.js:78` (the owned-collection commander scan
  behind the "Your Commanders" tab)
- `js/ui/theme-tab.js:238` (the commander picker behind the "Theme / Tribal"
  tab)
- `js/main.js`'s `commanderAutocomplete` (`isEligible: canBeCommander` →
  `isEligible: canBeActiveCommander`) and `resolveCommanders`'s
  `canBeCommander(primary)` check — `main.js` is shared between both pages
  (see section D), so this also goes through the indirection rather than a
  per-page hardcoded choice.

`js/analysis/pairing.js` (partner/background pairing) needs no change: it's
pure oracle-text matching with no legendary or rarity assumption baked in,
so partner support (kept per requirements) works unmodified for both formats
as-is — a pauper pairing is vanishingly rare in practice (two uncommon
creatures both printed with Partner) but the existing logic already handles
it correctly if it ever comes up.

### C. Card-pool legality (commons only)

`legalForCommander(cardColors, commanderColors)` gets an optional third
parameter:

```js
function legalForCommander(cardColors, commanderColors, card) {
  for (const color of cardColors) {
    if (!commanderColors.includes(color)) return false;
  }
  if (isPauperFormat() && card && card.rarity !== "common") return false;
  return true;
}
```

Every one of this function's 9 call sites already has a `card` variable in
scope right next to the `card.colors` it passes today (confirmed by reading
each): `main.js` (×2), `js/analysis/commander-match.js`, `js/build/deck.js`,
`js/analysis/themes.js` (×4), `js/build/manabase.js`. Each becomes
`legalForCommander(card.colors, commanderColors, card)` — a one-token change
per site, no restructuring. This is deliberately a single-function fix rather
than threading a separate `isCardFormatLegal` predicate through 9 call
sites individually: every one of those sites already asks "is this card
allowed in this deck," which is exactly what rarity legality also answers,
so it belongs in the same gate rather than a second parallel one.

Rarity has to actually exist on card objects for this to do anything.
`js/api/scryfall.js`'s `convertScryfallCard` doesn't capture it today — add
one field:

```js
rarity: String(data.rarity || "").toLowerCase(),
```

This flows automatically to every owned card (collection batch fetch) and
every commander/partner lookup, since they all funnel through
`convertScryfallCard`.

### D. `main.js`: skip EDHREC entirely for Pauper

`main.js` stays a single shared file (not duplicated) — its EDHREC fetch
becomes conditional:

```js
let edhrecData = { cards: [], tags: [], allTags: [], typeAverages: null, roleTargets: null, themeCardLists: {} };

if (!isPauperFormat()) {
  updateProgress(18, "Fetching EDHREC synergy data...");
  logMessage("Loading commander recommendations from EDHREC.");
  edhrecData = await getEDHREC(commanders.names);
  // ...existing EDHREC logging unchanged...
} else {
  logMessage("Pauper Commander mode: EDHREC has no data for uncommon commanders — building entirely from Scryfall and your collection.");
}
```

No network call is attempted for Pauper commanders at all (not "call it and
discard the result") — most uncommon creatures have no EDHREC commander page,
and attempting the fetch would either 404 noisily or, worse, occasionally
collide with an unrelated EDHREC page if the name happens to match something
else EDHREC indexes under a different context.

With `edhrecCards = []` downstream, every remaining step already takes its
existing "Collection Fallback" branch verbatim — `ownedCandidates` built from
`getCollectionEntries`, `detectCommanderThemes` falls through to its local
keyword-count heuristic over the owned collection, `typeAverages`/
`roleTargets` passed as `null` so `buildRoleTargetPlan` and `resolveLandCount`
use their existing non-EDHREC defaults. No changes needed in `deck.js`,
`type-plan.js`, `manabase.js`, or `themes.js`'s theme-detection logic beyond
the legality threading in section C.

### E. Pages, copy, and the banner link

`pauper.html`: new file, same `<script>` list and order as `index.html` plus
`js/format.js` (new) and the one-line format-setting inline script. Distinct
copy only:
- `<title>` and `<h1>`: "MTG Pauper Commander Deck Builder"
- Empty-state panel: explains uncommon-creature commander / commons-only deck
  rules, and that this build has no EDHREC-equivalent synergy source (local
  collection + Scryfall only) rather than claiming a data source it doesn't
  have
- `#commanderInput` placeholder: "Start typing an uncommon creature name..."
- Banner link to `index.html`: "← Full Commander Deck Builder"

`index.html`: one addition — a banner link next to the `<h1>`: "Try Pauper
Commander →" pointing to `pauper.html`.

Tabs: "Your Commanders" and "Theme / Tribal" work unmodified once section B's
indirection is in place (they already go through `commander-match.js` and
`theme-tab.js`, now format-aware). "Collection Analytics" needs no new logic
either — anything it reports by iterating owned cards with
`legalForCommander` (section C) automatically reflects commons-only once that
gate is format-aware.

## Error handling

No new error paths. Commander validation already throws
`"Selected card does not appear to be a legal commander."` when
`canBeActiveCommander` (nee `canBeCommander`) returns false — unchanged
message, now correctly gating on the active format's rule.

## Testing

- `dev/tests/jxa/format.test.js` (new): `canBePauperCommander` accepts an
  uncommon creature, rejects a common creature, rejects an uncommon
  non-creature (e.g. an uncommon sorcery), rejects a legendary-but-common
  creature; `legalForCommander` with a pauper format active rejects an
  uncommon/rare/mythic card and accepts a common one, and is unaffected
  (rarity ignored) when the format is `"commander"`.
- No new `mode-prefs.test.js`-style coverage needed — `modePrefs` and format
  are orthogonal (Minimal Build still works the same under either format).
- Manual verification: open `pauper.html`, build a deck for a real uncommon
  creature owned in the test ManaBox fixture, confirm every nonland card in
  the result is common rarity, and confirm the commander input rejects a
  legendary rare as ineligible.
