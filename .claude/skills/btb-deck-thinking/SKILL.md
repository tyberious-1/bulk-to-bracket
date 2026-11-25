---
name: btb-deck-thinking
description: Use before judging a pick, designing a reader, link or scoring weight, or explaining why a build is good or bad in the bulk-to-bracket repo: reading the card, how cards connect, voltron means commander damage.
---

# How to think about a deck (word problem + math problem)

> **Summary:** A deck is a word problem (cards' outputs meeting inputs) plus a math problem (counts, curve, odds). Read the card's own text first; judge a card by its links into the web, not alone; voltron means commander damage.
> **STOP here unless** you are about to judge a build, design a reader or change a weight.
> Rules questions (stack, triggers, timing): see `btb-mtg-rules`.
> Everything below is detail moved verbatim from the old AGENTS.md; skip it if the summary answers your question.

## How to think about a deck (agreed 2026-10-29)

A classic Magic saying: **reading the card explains the card, and reading the card tells you how it
works.** The card's own text is the source of truth for what it does, what it makes and what it
needs, so read it before judging a pick, tuning a score or blaming the pool. Card names, tags and
average-deck statistics come second to the words on the card. (the user, 2026-10-30; it is also in
memory as `read-the-card-word-and-math-problems`.)

A deck runs like a random program, but it is still a program. Building one is two kinds of
problem, a word problem plus a math problem, and a good build needs both:

- **Math problems (counting):** the mana base and curve, the odds of drawing lands, ramp and removal, and
  whether a vehicle can be crewed. These have right answers and the tests can check them.
- **Word problems (reading):** every card says what it makes and what it needs. A synergy is one card's
  output matching another card's input. Examples:
  - A card that makes Pilot tokens feeds a vehicle that wants crew.
  - A creature that dies feeds a payoff that triggers on death.
  - Saddle wants a power total, and a creature with high power supplies it.

Judge a build by whether its cards connect (outputs meeting inputs, no orphans, no strong
connecting card left out for a weak one), not by matching average card counts. Reference ranges
from EDHREC averages and precons (`dev/tools/jxa-harness/plan_targets.json`) are only a smell
test: averages can include junk, and a tribal deck should be creature-heavy. When a card's words are
not read (no engine class, no ability label), the fix is to teach the builder to read them.

**How cards connect (the user, 2026-11-04; the Ghalta + Unnatural Growth walkthrough):** a card is a small
program, judged by where it fits in the web of cards the deck already has (the commander plus the cards
chosen), never alone. Ask four things of it: what number it reads or changes (Ghalta reads the total
power you control; Unnatural Growth doubles it), what threshold that number must cross (Ghalta costs
{10}{G}{G}, so 10 total power makes it {G}{G}; 5/5 doubled, or 2/2 plus 3/3 doubled, gets there),
what state it needs (Ghalta in hand wants the discount, on the battlefield it wants 21 commander damage,
and 24 after doubling), and when it acts (at the beginning of combat, so cast Ghalta after it) and when it
can first be cast (Unnatural Growth is mana value 5, so turn 5 at the earliest without ramp; ramp is what
brings a plan online sooner). Then
whether it pays off when it enters (once) or while it stays (ongoing). A card with a strong link into
the web beats one that looks good alone. The keyword reader (`connections.js`, theme tags) sees words,
not these numbers; see `dev/docs/superpowers/specs/2026-11-04-precon-reference-findings.md`, whose section
"The Tramplesaurus Rex web" is the best worked example (read it before designing a reader or a scoring change).
Plan for the best case and add redundancy: two draw engines of the same kind double the benefit, so
repeating an engine effect is insurance, not waste.

**Voltron means commander damage (the user, 2026-11-10; the Ukkima, Stalking Shadow build).** A voltron deck is built
around the commander as the one body that wins by commander damage (21). Its jobs: get the commander out early, raise
its power, make it evasive or unblockable, protect it (or punish removal), pay off each hit, and still do something if
it is gone. Read the commander for the plan (a self "can't be blocked", an effect that reads its own power, a leave
trigger); equipment and auras are supplies for it, not the definition. Today `voltron` is only a card tag
(`detectCardTags`, attachment text) and a theme count, so a commander-damage plan is not built from the commander's own
words: the Ukkima build came from EDHREC themes (equipment, ninjutsu, blink) while `getCommanderCenter` returned nothing.
Repeating protection or recursion is insurance, not filler. Memory: `voltron-means-commander-damage-body`.


