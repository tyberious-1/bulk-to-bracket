# AGENTS.md

Context for AI coding agents working in this repo. See README.md for the
user-facing project description.

> **This file is the always-loaded core.** Detail lives in project skills under `.claude/skills/`
> (tracked in git through a `.gitignore` exception; your global ignore hides `.claude`, so keep
> that exception). Each skill opens with a short summary and a STOP line: stop there unless you
> need the detail. Agents that do not load skills can read the same files by path (index below).

## Hard rules (these break things if missed)

- All JS is plain global-scope scripts, loaded by `<script>` tags in dependency order. A new `js/` file needs its tag in BOTH
  `index.html` and `pauper.html` and in `dev/tools/jxa-harness/build_harness.sh`.
- Run suites with `bash dev/tests/jxa/run_all.sh` (or `run.sh`): osascript (JXA) on macOS, node where osascript is absent (Linux). `node --check` is for syntax checks. zsh does not
  word-split an unquoted `$VAR`: use a bash array or `bash -c`. Never leave a bare `cat` in a shell call (it hangs).
- A change to `js/build/` or `js/analysis/` needs the relevant suites; a change to shared scoring needs the 13-build diff.
- Read the card's own text before judging a pick or blaming the pool (see `btb-deck-thinking`). Fix by category, not for one commander.
- Never commit the friend's collection, `ManaBox_Collection*.csv` or `dev/card inventory.csv`; commit with explicit paths.

## Index: touching X? Read Y first

| If you are touching | Read |
|---|---|
| a `js/` file's place, load order, legality, format switch, tabs, API, CSV | `.claude/skills/btb-architecture/SKILL.md` |
| `js/build/deck.js`, `type-plan.js`, phase order, ties, build modes | `.claude/skills/btb-build-pipeline/SKILL.md` |
| `engines.js`, `abilities.js`, center links or weights, events, vehicles | `.claude/skills/btb-center-reader/SKILL.md` |
| `archetypes.js`, `terms.js`, `bottom-up-deck.js`, Bottom-Up tab | `.claude/skills/btb-bottom-up/SKILL.md` |
| Collection Analytics tab, `collection-summary.js`, `role-reading.js` | `.claude/skills/btb-analytics-tab/SKILL.md` |
| running suites, harness tools, baselines, audits | `.claude/skills/btb-testing-harness/SKILL.md` |
| playing built decks against each other (Forge in Docker), `dev/tools/forge-sim/`, game-based checks | `.claude/skills/btb-forge-sim/SKILL.md` |
| something looks wrong, role tags, land rule, export, name quirks | `.claude/skills/btb-gotchas/SKILL.md` |
| judging a build, designing a reader, link or weight | `.claude/skills/btb-deck-thinking/SKILL.md` |
| a rules question (stack, triggers, timing) | `.claude/skills/btb-mtg-rules/SKILL.md` |

## Autonomy in this repo

This directory is a local, static hobby app with no ripple effects, so agents get more freedom
here:

- Read files, run harness builds and tests, and investigate without asking first.
- Commit without confirmation (explicit paths, see Commit / PR guidelines).
- Ask only about what the repo, this file, specs and fixtures cannot settle (a design choice,
  which commander to target when it matters).
- The freedom stops at the repo boundary: other directories and anything
  outward-facing still need a check-in. Confirm before deletes or sharing anything outside the repo.
- Do not merge or push without the user's review.

## Model and effort

Spending is watched, so match the model to the task:

- **Higher effort, main model:** reader logic (`engines.js`, `abilities.js`), scoring weights, builder phases and anything
  that needs a card read in full. Mistakes here are quiet and hit many builds.
- **Cheaper model (Haiku) for mechanical work:** renames, fixture or baseline regeneration, running the 13-build diff and
  summarizing it, doc moves, file listings. If a subagent only reports counts or diffs, use Haiku.
- **Judgment stays on the main model:** reading the diff for what it means, deciding if a change helps or hurts a build.
- Flag a token-heavy action (a full 13-build dump, a wide fan-out) before running it.
- **Experiments you may drop** (reader or weight tuning, scoring trials) go in a git worktree on a throwaway branch, so
  main stays clean and abandoning is a delete. Merge what works only after the user's review; remove the worktree either way.

## Project overview

Bulk to Bracket is a static, client-side web app (no server, no build step).
It turns a ManaBox CSV collection export into a synergistic Commander deck
using EDHREC synergy/average data and Scryfall card data, then exports to
Moxfield format. There are two entry points, both opened directly in a
browser or served as static files — there is nothing to compile:

- `index.html` — the main app, default Commander format.
- `pauper.html` — Pauper Commander (PDH): commander must be an uncommon
  creature, every other nonland card must be common. Shares every `js/`
  file with `index.html`; the only difference is one inline
  `setActiveFormat("pauperCommander")` script tag (see `js/format.js` under
  `btb-architecture`) and page-specific copy/placeholders.

## Product goal

The app is a quick, casual prototyping aid: it turns a collection into a
functional deck with synergy that the player refines with physical cards.
Commander is a casual format where funny or interesting plays can matter more than winning. Key points:

- The 99 matters more than the commander; people often pick a commander because
  it sounds fun, or after spotting a pattern in their pile.
- Sparse collections with few EDHREC matches are the main case; the
  collection-fallback path is the product.
- Support roles are loose job descriptions: bounce, counterspells and
  pacifism-style auras can count as removal when the colors lack hard removal.
- Plan-first prototyping (built, see below): 2-3 plan options per commander
  with example owned cards and honest coverage, build-anyway on thin plans while
  flagging a better-supported plan, commander discovery from collection
  support, and a few exempt "fun slots". Spec:
  `dev/docs/superpowers/specs/2026-10-13-plan-first-prototyping.md`. Built:
  the coverage measure (`dev/tools/jxa-harness/plan_coverage.py`) and plan options
  UI (`js/analysis/plans.js`, `js/ui/plans.js`); a plan is a multi-theme focus
  joined with `~` in the `theme:` mode string. Also built: broader removal
  tagging and fun slots (`options.funPicks` in `buildDeckFromScoredPool`, source
  `fun-pick`, max `FUN_PICK_MAX` = 5, never evicted). Commander discovery is built
  as a "What does my collection support?" section on the Theme/Typal tab
  (`js/analysis/discovery.js`), feeding the tab's existing owned-commander lookup.
  A plan is "light" when fewer than `PLAN_LIGHT_OWNED` (10) of its signature cards
  are owned. An offered plan's signature cards steer the build by name
  (`modePrefs.planSignature`, `PLAN_SIGNATURE_BONUS` in `scoring.js`).
- Testing rules: the friend's collection (`ManaBox_Collection-1.csv` when it is on disk; as of 2026-11-03 only
  `owned_raw.friend.json`) is for local testing only and is never committed;
  don't use Rosheen as a sample commander; the user's collection deliberately
  omits flex staples (Sol Ring etc.), so don't report that as a gap.


## Magic rules reference (2026-11-10)

The user asked that the rules be understood between chats. Detail is in `.claude/skills/btb-mtg-rules/SKILL.md`
(primer `dev/docs/mtg-rules-primer.md`, chapters `dev/docs/mtg-rules/`, real text via `fetch_comp_rules.sh`).

## Repository layout

The repo root is the app plus its README: `index.html`, `pauper.html`, `style.css`, `js/`,
`README.md` (and `AGENTS.md`/`CLAUDE.md`, which agents read from the root). Everything that is
not the app lives under `dev/`: `dev/tools/` (the offline harness, fixtures, baselines, the
zip script), `dev/tests/` (the JXA suites), `dev/docs/` (specs and plans) and
`dev/card inventory.csv`. Scripts that need the repo root compute it from their own location
(three levels up from `dev/tools/jxa-harness/`); run suites and harness commands from the repo
root.


## Setup / running it

No install step. To work on it:
```bash
open index.html                 # default Commander format
open pauper.html                # Pauper Commander (PDH) format
# or serve the directory with any static server
```
`node` is available on this machine (via nvm) for ad-hoc checks — prefer it
over anything else for quick validation:
```bash
node --check js/build/deck.js   # syntax check a single file
```
Run the test suites with `bash dev/tests/jxa/run_all.sh` (or `run.sh`): osascript on macOS, node where osascript is absent (Linux).
There's no `package.json` and no npm scripts.


## Code style

- No semicolons-only convention enforced either way — match the surrounding
  file.
- No TypeScript, no JSX — plain ES (functions are global, loaded via
  `<script>` tags; see Hard rules above).
- Don't introduce a module system, bundler, or npm dependency to solve a
  local problem — it breaks the load-order model every other file relies on.
- Keep new JS files inside the existing `js/<category>/` layout rather than
  adding new top-level folders.


## Sharing the app

The app itself is `index.html`, `pauper.html`, `style.css` and `js/` (about 0.6 MB), plus
`README.md`, which ships with it. Everything else lives under `dev/` (`dev/tools/` is about
87 MB of fixtures; `dev/tests/`, `dev/docs/`), and `.git` can be tens of MB of loose objects
(`git gc` shrinks it). For a copy to open on a phone, run `bash dev/tools/make-app-zip.sh`
(writes `../bulk-to-bracket-app.zip`, about 170 KB, only those files). The live site is served
from the repo root through GitHub Pages (`tyberious-1.github.io/bulk-to-bracket`), so
`index.html`, `pauper.html`, `style.css` and `js/` must stay at the root. Do not move the app.
`dev/tools/jxa-harness/owned_raw.friend.json` is a friend's collection (local testing only,
kept out of git through `.git/info/exclude`; that line must follow the file if it moves) and
`ManaBox_Collection(mine).csv` holds purchase prices: keep both out of anything shared.

## Commit / PR guidelines

- Conventional, short, imperative commit subjects (see `git log` for style:
  e.g. "Fix focused-theme builds over-drafting creatures for typal
  commanders"). No enforced prefix convention (no `feat:`/`fix:` tags in use).
- No CI configured in this repo — there's nothing to wait on before pushing;
  run the relevant `dev/tests/jxa/*.test.js` suites manually for anything you
  touched in `js/build/` or `js/analysis/`.
- Commit with explicit paths, not `git add -A`: the repo root can hold untracked personal
  files (`ManaBox_Collection(mine).csv`).

