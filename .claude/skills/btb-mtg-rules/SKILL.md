---
name: btb-mtg-rules
description: Use when a card interaction depends on Magic rules in the bulk-to-bracket repo: the stack, timing, triggers vs replacement effects, new objects on zone change, summoning sickness and crew, color identity, partners, commander tax, or before designing a reader, link or weight that assumes how two cards work together.
---

# Magic rules for card readers

> **Summary:** `dev/docs/mtg-rules-primer.md` (95 lines) is the single source: the rules that decide whether two cards really work together, each with what it means for the reader. Read it first; do not copy it here. Chapter notes are in `dev/docs/mtg-rules/` (01-08). They were condensed by a model, so check any rule that becomes code against the real text.
> **STOP here unless** you are designing a reader, link or weight, or judging whether an interaction works.

## Where things are

- Primer: `dev/docs/mtg-rules-primer.md` (timing, the stack, triggers vs replacements, zone-change new objects, tokens, linked abilities, reader implications).
- Condensed chapters: `dev/docs/mtg-rules/01-concepts-and-card-parts.md` through `08-commander-multiplayer.md`.
- Real text (not stored, git-ignored): `bash dev/tools/jxa-harness/fetch_comp_rules.sh` writes `dev/tools/jxa-harness/rules/cr.txt` from Wizards' site. Then `grep -n "^603.3 " dev/tools/jxa-harness/rules/cr.txt`.

## Habits

- Read the card's own text first (`btb-deck-thinking`); the rules say what that text does.
- Before a rule becomes code, grep the rule in `cr.txt` and read it. Chapter notes marked "outside range" or "verify" were not read.
- When a card is misread, add one line to the primer's reader-implications list.
- After each set release, re-run the fetch script and re-read chapters 701 (keyword actions) and 702 (keyword abilities); they change every set.
- Keep the primer short: it is what a future chat loads.
