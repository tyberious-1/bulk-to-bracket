# Plan-first deck prototyping (draft spec)

Status: draft from the 2026-10-13 interview. Step 1 (coverage measure) is in
`dev/tools/jxa-harness/plan_coverage.py`; step 2 (plan options UI + build against a
chosen plan) is in `js/analysis/plans.js` and `js/ui/plans.js`.

## Goal

Bulk to Bracket is a quick prototyping aid. It turns a collection into a
playable, synergistic Commander deck idea that the player then refines with
physical cards. It is not trying to produce the best or most competitive list.
Commander is a casual, friendly format: funny and interesting plays sometimes
matter more than winning, so the builder must leave room for flavorful cards.

## How the user actually builds (source of the requirements)

1. Sort/scan the collection, notice a pattern (Samurai/Warrior + equipment/auras).
2. Fill support buckets (ramp, draw, removal, wipes) from a template, counting them.
   Roles are loose: bounce, counterspells and pacifism-style auras all counted as removal.
3. Add theme cards; prefer role cards that also serve the plan.
4. The commander came last, or was not essential. The 99 matters more.

Failure case (mono-blue Callaphe): clear plan (devotion -> big flying voltron) but a bad
curve, expensive cards, and "looks interesting" picks with no shared plan.
Success case (white Samurai): synergy was built into the cards.

## Requirements

1. **Plan options.** For a chosen commander, offer 2-3 plans built from its EDHREC
   themes (a plan is 1-3 related themes, e.g. Devotion + Auras + Voltron for Callaphe).
   Each option shows example owned cards and honest coverage ("you own 24 of ~35
   cards this plan wants"). The user picks one.
2. **Thin plans.** Build the chosen plan anyway, fill the rest with generic cards, and
   say plainly that it is light and which other plan the collection supports better.
3. **Commander discovery.** Show what the collection supports best and which owned
   commanders fit it, so a fun commander is not missed. Commander-first stays as
   the other entry point.
4. **Broader role definition.** A "deals with a threat" role should accept bounce,
   counterspells and pacifism-style auras when the colors lack hard removal.
5. **Curve discipline.** Keep Curve First (already shipped) so the plan is not buried
   under expensive cards.
6. **Room for fun.** Allow a small number of flavor picks (a "fun slots" count) that
   are exempt from synergy/score floors, so favorites like Fleet Swallower can stay
   without diluting the plan.
7. **Sparse collections stay the main case.** All of the above must work when EDHREC
   matches are low (collection-fallback path).

## Open questions

- How to combine themes into a plan (EDHREC theme co-occurrence vs. rules-text engine terms).
- How to compute coverage: count of owned cards matching the plan's engine terms vs.
  a target number of plan cards.
- Size of the fun-slots allowance (suggest 3-5, user adjustable).
- Whether commander ranking reuses the synergy-density measure.

## Suggested order

1. Coverage measure per theme/plan (builds on `dev/tools/jxa-harness/synergy_measure.py`).
2. Plan options UI + build against a chosen plan.
3. Broader role tagging.
4. Fun slots.
5. Commander ranking by collection support.

## Step 1 findings (2026-10-14, plan_coverage.py)

- Theme pages mostly repeat the commander's general list: Callaphe's four main
  themes share 76-86% of their wanted cards. So a theme is identified by its
  *distinctive* cards (inclusion at least 15 points above the commander's main
  page), and coverage is reported twice: core staples owned, and plan-specific
  cards owned. That answers the combine-themes question: merge themes whose
  distinctive sets overlap (Jaccard >= 0.10), up to 3.
- Coverage is owned wanted cards over wanted cards, not a fixed target. Sample
  on the user's collection: Callaphe Auras+Voltron+Devotion owns 17 of 48
  plan-specific; Kaza's best plan owns 29 of 134; Norika has one plan only
  because the fixtures lack her Samurai theme page (prefetch gap, not a design issue).
- Commanders with few popular themes (Callaphe) give near-duplicate plans; the UI
  should show fewer plans rather than pad. New commanders with no theme pages
  (Yuriko) need the rules-text engine-term fallback from `synergy_measure.py`.

## User-chosen plans (2026-10-14)

The user is considering Ivy, Gleeful Spellthief as a Merfolk deck: her colors fit
the collection (104 owned U/G Merfolk cards) and her copy ability works in many
shells, but Merfolk is not among her EDHREC themes. So a plan must also be
user-nameable (a creature type or theme word) with coverage computed from the
collection's type lines and rules text, not only offered from EDHREC themes.
Generic-effect commanders like Ivy are the case where the 99 matters most.

**Principle:** EDHREC not listing a theme does not mean the plan is unworkable.
EDHREC reflects what popular decks do, not what a collection can support. The UI
must never present EDHREC themes as the complete set of options, and a
collection-supported plan with no EDHREC theme (Merfolk on Ivy) should be offered
and judged on its own coverage.

## Step 3: broader role tagging (2026-10-14)

Counterspells and "return target creature" bounce were already removal. Added
pacifism/freeze auras ("can't attack or block", "doesn't untap"), "loses all
abilities", permanent theft (not threaten effects), tucking, and "return target
nonland permanent". Across the user's collection, removal-role cards went from
856 to 949 (draw 882 to 868, as removal outranks draw).

## Step 4: fun slots (2026-10-14)

Chosen design: the player names the cards (a "Fun picks" box, one per line, up to
5; the user agreed 3-5). The builder adds them first (Phase -2), they never
count against score or synergy floors, and eviction skips them. A pick that is
not owned or is outside the commander's colors is skipped and the UI says so.
Minimal Build skips them. Checked offline: Fleet Swallower lands in an Ivy
(U/G) build; an off-color pick is skipped.

## Step 5: commander discovery (2026-10-14)

Built on the Theme/Typal tab rather than a new tab: a "What does my collection
support?" button reads the whole collection's card data (cached from earlier
builds), counts owned nonland cards per catalog theme/tribe, and shows the best
supported tribes and themes. Picking one runs the tab's existing lookup of owned
commanders for it, then Build. Open question resolved: this does not reuse the
synergy-density measure (that scores a finished deck); it counts cards per
theme, dropping themes under 12 cards or over 15% of the collection (generic).
On the user's collection the top tribes are Warriors (383), Soldiers (345),
Wizards (326) and Zombies (250). Counting 8,000 cards takes about 3 seconds
under JXA.

## Plan measurement (2026-10-14)

Built every offered plan for 14 commanders (27 plans) on the user's collection and
counted signature cards in the deck against the default build.

- A build holds about as many signature cards as the collection has, up to ~10,
  then levels off. "Light" is therefore fewer than 10 signature cards owned; the
  cards decks of the plan commonly play are mostly staples and no longer rescue it.
- Before: a plan build held +0.3 signature cards over the default, because only
  text-tag matches steered it. Now an offered plan's signature cards get a lift by
  name (20 + 20 x inclusion): +3.7 on average (10 + 10 x inclusion gave +2.6).
- Not checked: whether the larger lift crowds out ramp or removal; some builds
  still leave owned signature cards out (Ivy Infect: 17 owned, 11 built).
- Discovery counts now match plurals in rules text ("Elves you control").
- Cards in other ManaBox decks are excluded by default (tick box to include).
