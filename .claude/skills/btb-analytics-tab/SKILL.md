---
name: btb-analytics-tab
description: Use when editing js/analysis/collection-summary.js, role-reading.js, connections.js (tab version) or js/ui/collection-analytics.js in the bulk-to-bracket repo.
---

# Collection Analytics tab data layer

> **Summary:** The pure data behind the Analytics tab (subtypes, tribes, role coverage, connections), unique-vs-copies counting, and how the tab-only role reader was measured against Scryfall otags.
> **STOP here unless** you are changing what the Analytics tab counts or how it reads roles and connections.
> Everything below is detail moved verbatim from the old AGENTS.md; skip it if the summary answers your question.

- `js/analysis/collection-summary.js` — pure data behind the Collection Analytics tab: `aggregateSubtypes`
  (one merged row per subtype, colorless kept apart from multicolor), `buildTribeSummary` (top 10),
  `buildRoleCoverage` (ramp/draw/removal/wipe vs `normalizeRoleTargets`). `js/ui/collection-analytics.js` only renders them.
  Counts: type and subtype numbers are different cards (`unique`); role rows show different cards against the target and copies
  beside it (copies per color = how many decks that color could fill). `js/analysis/role-reading.js` (`getCollectionRoles`, tab only,
  the builder never calls it) adds ability-by-ability readings to `getRoleContributions`: any-color and restricted mana, land from
  the library, chip damage, -N/-N on a target, "up to one target", edicts as removal (not wipes), mass toughness drops and mass
  exile as wipes. Measured against Scryfall otags on 2026-11-06 (`role_vs_otags.js`, `fetch_otags.py` in `dev/tools/jxa-harness/`;
  `otags.json` is git-ignored): builder reader removal 65% recall / 88% precision, wipe 23/60, ramp 62/62, draw 95/80; tab reader
  81/86, 46/95, 85/75, 95/80. Draw is unchanged (the extras are looters, counted on purpose). The tags are a rough yardstick.
  `js/analysis/connections.js` (`buildCollectionConnections`, tab only) is the web of connected cards across the whole pile: the
  same gives/wants channel reading as `dev/tools/jxa-harness/connections.js` (a copy under other names, so both load together),
  one row per channel some card needs, with how many different cards need it and make it; depth is the smaller side (Enough 6,
  Deep 15, guesses). Measured 2026-11-09 on the 8,619 owned nonland cards (0.5 s): 16 of 24 channels read Deep, so a big
  collection does not separate engines; a fed-or-starved flag was tried first and read "fed" everywhere. The "dies" supply counts
  every destroy and damage effect, so it runs high. `byColor` gives the depth in a deck of one color (that color's single-color cards plus colorless; gold cards are left out, as in the role rows), and that is where engines separate: landfall G 28 against W 6, graveyard B 155. It reads each card alone, not card-to-card pairs.

