# Precon research harness

Reproduces the 2026-11-04 measurements in
`dev/docs/superpowers/specs/2026-11-04-precon-reference-findings.md`: build each of the five Foundations
Commander precon commanders (`../precon_foundations_2026.json`) through the real builder, once with the
builder's normal quotas ("default") and once with the precon's own curve caps and type targets ("oracle"), and
compare with the precon. Nothing here touches `js/` or tracked fixtures; the data goes to an output directory
you choose (not committed: it holds the 53 EDHREC theme pages, several MB).

Run from the repo root, with OUT any directory outside git (for example under the scratchpad):

```bash
OUT=/path/to/precon_run
python3 dev/tools/jxa-harness/precon_research/fetch_fixtures.py $OUT      # network, about a minute
python3 dev/tools/jxa-harness/precon_research/make_drivers.py $OUT
for v in default oracle; do
  ov=false; [ $v = oracle ] && ov=true
  (echo "const OVERRIDE = $ov;"; cat $OUT/combined_ph.js $OUT/dump_precon.js) > $OUT/run_$v.js
  osascript -l JavaScript $OUT/run_$v.js > $OUT/out_$v.txt 2>&1
done
python3 dev/tools/jxa-harness/precon_research/report.py $OUT
```

Extra switches for the driver, set before the `cat`: `const ROLE_MIN = true;` caps each support role at its
minimum (the role-minimum experiment), `const ONLY_COMMANDERS = ["Sai, Master Thopterist"];` limits the run.
Add `globalThis.__meta` capture (themes, strategy profile, engine needs) next to the `__dbg` line in
`make_drivers.py` if you need the builder's reading of a commander.

## What to keep in mind

- The theme pages matter: without them the pool is about half the size and the builds look closer to the
  precons than the app's builds do. `fetch_fixtures.py` includes them.
- Overlap with a precon is a probe (the builder may pick fine alternatives), not a quality score.
- `connections.js` reads power only as crew; do not trust its orphan counts for a deck whose plan is a number
  (see the findings doc).
- The Rosheen deck is not a reference; `Rosheen` stays out of testing.

## Owned commanders (2026-11-04 tests)

`owned_commanders.py OUTDIR "Commander, Name" ...` builds commanders from `owned_raw.json` (the real collection, not
the precon lists) with EDHREC pages and theme pages fetched, and writes `combined_ph.js` and `dump_own.js` (see the
script's header for the run line and the quota switches `ENCH`, `SYN`, `CURVE_OFF`, `ROLE_MIN`). `web_ledger.py
OUT.txt "Commander" COLORS 'label=regex' ...` lists, per web class, the owned cards picked and left out with their
EDHREC score. Verified: re-running Sai reproduces the earlier build exactly. Patterns are rough regexes over oracle
text (modern wording says "this creature", not the card name); read the lists, do not trust the counts.
