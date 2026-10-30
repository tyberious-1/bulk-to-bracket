# Bottom-up build: archetype and subtype first, commander last

Status: design approved in conversation 2026-10-26; written spec awaiting review.

## Intent

Today the app builds top-down: the player picks a commander and the 99 is filled
around it. The proposal is a bottom-up build. The deck is defined first by an
**archetype** (Aggro, Midrange, Control) and a **subtype** (a tribe such as
Zombies, or a theme such as tokens), for example "control Zombies". A commander is
chosen last, from what fits the deck's colors and themes.

Why: the product goal (`AGENTS.md`) says the 99 matters more than the commander,
that sparse collections are the main case, and that people often start from a
pattern in their pile. "Bottom-up deckbuilding" is the established name for
theme-or-package first, commander last. The archetype-by-subtype pairing is this
project's own model; the research found no standard framework for it.

## Decisions made

| Topic | Decision |
|---|---|
| Entry | Suggestions first, with a manual override (archetype, subtype, colors). |
| Colors | Each suggestion carries its colors. The player can also pick colors as a separate step. The commander never constrains colors, because it comes last. |
| Archetypes | Aggro, Midrange, Control. Combo is deferred: no win-condition check exists, and combo players are unlikely to use the app. Adding it later is one more entry in `archetypes.js`. |
| What an archetype changes | Slot mix and card scoring, plus subtype-aware synergy. No win-condition check. |
| Subtypes | Tribes and themes, from the existing catalog used by `discovery.js`. |
| Commander step | Owned commanders first, then a few named suggestions marked "not in your collection". The 99 is always delivered as a finished list. |
| Relationship to commander-first | Additive mode. Commander-first is unchanged. Promote, keep alongside or drop is decided after testing. |
| Builder | A new `buildDeckBottomUp` that reuses scoring, role tagging, `type-plan.js` and `manabase.js`, with its own phase order driven by the archetype. |
| Combos / Spellbook | Out of scope. Commander Spellbook's API does not allow browser calls from other origins (CORS), so a lookup would need a proxy or a shipped data file. `bracket.js` keeps its text-based combo guess. |

## Components

New files, loaded after the existing analysis and build files. Each needs a
`<script>` tag in both `index.html` and `pauper.html` and an entry in
`dev/tools/jxa-harness/build_harness.sh`.

- `js/analysis/archetypes.js` — the three archetype definitions as data (slot mix,
  curve target, scoring bias) and the subtype-aware rules (below). Also the local
  role reclassification (below).
- `js/analysis/bottom-up.js` — suggestions: ranked subtype × archetype × color
  sets from the collection, built on `rankCollectionSupport` in `discovery.js`.
- `js/build/bottom-up-deck.js` — `buildDeckBottomUp(pool, archetype, subtype, colors)`.
- `js/analysis/commander-fit.js` — owned commanders that fit a finished 99, then
  named suggestions.
- `js/ui/bottom-up-tab.js` — suggestions, the manual pickers, the result.

Flow: collection → suggestions or manual picks → build the 99 → commander fit → report.

## Archetypes

Each archetype defines, for the 62 nonland slots of a 100-card deck (starting
values taken from the probe; to be checked against a one-time look at typical
Commander decks per archetype during planning):

| | Aggro | Midrange | Control |
|---|---|---|---|
| Creatures | 28 | 24 | 14 |
| Ramp | 6 | 9 | 8 |
| Draw | 6 | 8 | 11 |
| Removal | 6 | 8 | 11 |
| Wipes | 0 | 2 | 4 |
| Target average mana value | about 2.2 | about 2.5 | about 2.7 |

The probe showed curve does not separate on its own in a bulk pile, so each
archetype also sets an explicit curve target, not only role counts. Midrange is
close to what the commander-first builder makes today, which makes it the
regression check.

Role counts are caps as well as targets: the probe overshot role targets when
filler was chosen by score, so the real builder stops a role at its cap.

Draw may stand in for a thin role (for example removal or wipes in colors that
lack them) up to 4 extra draw slots, and the report says when it did. Starting
value; tune with the test plan.

## Subtype-aware synergy

- A sweeper or removal spell that spares the subtype scores up in that subtype's
  deck ("-1/-1 to all creatures except Zombies", "destroy target non-Zombie
  creature").
- A symmetrical sweeper scores down in aggro and in tribal decks.
- A card that buffs or protects only the subtype scores up.
- Cards that only mention the tribe (for example "exile target Zombie") do not
  count as tribe members.

`abilities.js` does not read tribe exclusions today (it labels triggers, costs,
effects and restrictions, not "except X"). The new reader lives in `archetypes.js`,
regex-based, covering "except", "other than", "non-X" and "X creatures you control
get"; it does not touch `abilities.js`, so commander-first builds cannot change.

## Role rules local to bottom-up

Reclassify inside the new code only. Fixing the shared tags would change the 56
baseline builds and is its own task.

- **Removal quality order:** hard removal (destroy, exile, edict) first, then
  counterspells, then bounce, then auras and other. The probe's blue-black pool has
  422 "removal" cards: 170 hard, 90 counters, 74 bounce, 17 damage, 16 shrink, 55
  other (mostly auras). Control gets a counterspell sub-slot.
- **Edicts are removal, not wipes.** "Each player sacrifices a creature" and "each
  opponent sacrifices a creature" (Innocent Blood, Fleshbag Marauder, Rot-Tide
  Gargantua) were tagged as wipes.
- **Ramp mistakes:** a cost reducer (Gran-Gran) and a one-shot sacrifice for mana
  (Blood Pet) are not ramp. A Treasure maker that costs mana, a tap and life
  (Forsworn Paladin) is not real acceleration.
- **Tribe membership:** tribe members (subtype in the type line) and tribe payoffs
  are counted separately from cards that only mention the tribe. Mentions are
  capped, because the probe's theme bonus pulled in every Zombie-mentioning spell,
  weak bulk included.

## Suggestions

For each subtype × archetype × color set the app shows:

- real tribe members owned, payoffs, and cards that only mention the tribe;
- a support-quality note ("mostly bulk-quality", "good depth");
- thin roles and what covers them ("no wipes in these colors, draw covers it").

The fit rating (Strong, OK, Thin) comes from how many of the archetype's slot-mix
targets the pile fills without falling back to generic cards.

## Commander fit

After the 99 is built: owned commanders whose color identity covers the deck's
colors, ranked by how many of the deck's tribe members and payoffs they reward. If
none fit well, name a few real commanders suited to the deck, marked "not in your
collection". The source is EDHREC's tribe and theme pages, which `edhrec.js`
already uses. **Risk:** it is unconfirmed that those pages list commanders by
theme. If they do not, fall back to owned-only and still deliver the finished 99.
A commander whose color identity is narrower than the deck's colors forces cuts;
the report says which cards were cut.

## Test plan

Harness-only, no playtesting.

1. **Archetype separation.** The same subtype built as aggro, midrange and control
   must differ measurably in curve, role counts and creature share.
2. **Collection coverage.** On-theme cards used per build and slots that fell back
   to generic filler, on the full collection and on seeded 25% and 50% samples
   (`SAMPLE_FRACTION` in `dump_decks.js`).
3. **Comparison with commander-first.** For the 12-commander sample set, build
   both ways and diff with `engine_compare.py`. Midrange bottom-up should come out
   close to commander-first.

The result decides whether bottom-up becomes the default, stays alongside, or is
dropped.

## Evidence so far (throwaway probe, not app code)

Black and blue-black Zombies and green Elves, built as three archetypes from the
user's collection plus the newer inventory file. Archetypes separated on creatures,
draw, removal and wipes, but those were set targets. Curve did not separate in
mono-black. Control Zombies had no counterspells only because the probe's theme
bonus outranked them; 118 counterspell-like cards exist in the collection, 94 of
them filed as removal. Green Elves had no board wipes at all, so draw and removal
filled in. The probe ignored the mana base, EDHREC data and real synergy scoring,
and judged the lists from names and tags, not card text.

## Out of scope for the first version

Combo archetype, Commander Spellbook, win-condition checks, changing shared role
tags used by commander-first builds, and changing the default flow.

## Open items for planning

- Source the per-archetype slot mix and curve targets (starting values above).
- Confirm EDHREC pages can list commanders by tribe or theme.
- Decide the tuning of the draw-substitution cap and the cap on tribe mentions.
