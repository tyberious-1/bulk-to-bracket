#!/usr/bin/env python3
"""Generate the JXA drivers for the precon research builds. No tracked file is modified.

Usage (from the repo root): python3 dev/tools/jxa-harness/precon_research/make_drivers.py OUTDIR
(OUTDIR is the directory fetch_fixtures.py wrote.) Writes:
  OUTDIR/combined_ph.js  the harness (build_harness.sh output) with a per-pick phase label (P-2, P-1, P0,
                         P1, P1b, P2, P3, P4) stored on each deck entry
  OUTDIR/dump_precon.js  dump_decks.js pointed at OUTDIR's fixtures, printing per-pick entries (name, role,
                         source, phase, score, mana value), the scored pool and the role/type plan
  OUTDIR/quotas.json     each precon's own curve caps and type-bucket targets
The driver reads two globals set before it: OVERRIDE (true = use the precon's own curve caps and type
targets, the "oracle" build) and optionally ROLE_MIN (true = cap each support role at its minimum) and
ONLY_COMMANDERS. Asserts fail loudly if dump_decks.js or deck.js changed shape.
"""
import collections
import json
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
OUT = Path(sys.argv[1]).resolve()
subprocess.run(["bash", "dev/tools/jxa-harness/build_harness.sh", str(OUT / "combined.js")], cwd=REPO, check=True)

# 1. phase trace
s = (OUT / "combined.js").read_text()
for marker, label in (("  // Phase -2:", "P-2"), ("  // Phase -1:", "P-1"), ("  // Phase 0:", "P0"),
                      ("    // Phase 1:", "P1"), ("    // Phase 1b:", "P1b"), ("    // Phase 2:", "P2"),
                      ("    // Phase 3:", "P3"), ("    // Phase 4:", "P4")):
    assert s.count(marker) == 1, marker
    indent = marker[:len(marker) - len(marker.lstrip())]
    s = s.replace(marker, f'{indent}globalThis.__ph = "{label}";\n{marker}', 1)
push = "deck.push({ ...card, source, roles });"
assert s.count(push) == 1
s = s.replace(push, "deck.push({ ...card, source, roles, phase: globalThis.__ph });")
(OUT / "combined_ph.js").write_text(s)

# 2. each precon's own quotas (builder bands: mana value <=1 -> 1, >=7 -> 7; builder type buckets)
def bucket(type_line):
    t = type_line.lower()
    for key, name in (("land", "Land"), ("creature", "Creature"), ("instant", "Instant"), ("sorcery", "Sorcery"),
                      ("planeswalker", "Planeswalker"), ("battle", "Other"), ("enchantment", "Enchantment"),
                      ("artifact", "Artifact")):
        if key in t:
            return name
    return "Other"

decks = json.load(open(REPO / "dev/tools/jxa-harness/precon_foundations_2026.json"))["decks"]
cards = {c["name"]: c for c in json.load(open(OUT / "owned_with_fdn.json"))}
caps, types = {}, {}
for v in decks.values():
    bands, kinds = collections.Counter(), collections.Counter()
    for n in v["cards"]:
        if n == v["commander"] or "Land" in cards[n]["type_line"]:
            continue
        mv = int(cards[n]["cmc"])
        bands[1 if mv <= 1 else 7 if mv >= 7 else mv] += 1
        kinds[bucket(cards[n]["type_line"])] += 1
    caps[v["commander"]] = {str(k): bands.get(k, 0) + 1 for k in range(1, 8)}  # precon count + 1 slack
    types[v["commander"]] = dict(kinds)
(OUT / "quotas.json").write_text(json.dumps({"caps": caps, "types": types}))

# 3. driver
d = (REPO / "dev/tools/jxa-harness/dump_decks.js").read_text()
d = d.replace("dev/tools/jxa-harness/owned_raw.json", str(OUT / "owned_with_fdn.json"))
d = d.replace("dev/tools/jxa-harness/prefetch_data.json", str(OUT / "prefetch.json"))
anchor = "  return buildDeckFromScoredPool("
assert d.count(anchor) == 1
d = d.replace(anchor, '  globalThis.__dbg = globalThis.__dbg || {}; globalThis.__dbg[key] = { scored: scoredNonlands.map((c) => ({ n: c.name, s: c.score, r: c.role, cmc: c.cmc })), edhrecN: edhrecCards.length, themeN: themeCardNames.size };\n' + anchor, 1)
old_out = 'out[name] = { current: deck.filter((c) => c.role !== "land").map((c) => c.name) };'
assert d.count(old_out) == 1
d = d.replace(old_out, 'out[name] = { dbg: globalThis.__dbg[name], plan: JSON.parse(JSON.stringify(globalThis.__plan || null)), entries: deck.filter((c) => c.role !== "land").map((c) => { const o = {}; for (const k of Object.keys(c)) { const v = c[k]; if (v === null || ["string","number","boolean"].includes(typeof v)) o[k] = v; } return o; }) };')
pre = ("const Q = " + json.dumps({"caps": caps, "types": types}) + ";\n"
       "const __o1 = buildRoleTargetPlan; buildRoleTargetPlan = function () { const r = __o1.apply(null, arguments); globalThis.__plan = r;"
       " if (globalThis.__override && Q.types[globalThis.__cmd]) { for (const b of Object.keys(r.typeBuckets)) r.typeBuckets[b].target = Q.types[globalThis.__cmd][b] || r.typeBuckets[b].min; }"
       " if (typeof ROLE_MIN !== \"undefined\" && ROLE_MIN) { for (const k of [\"ramp\", \"draw\", \"removal\", \"wipe\"]) if (r.roleBuckets[k]) r.roleBuckets[k].target = r.roleBuckets[k].min; }"
       " return r; };\n"
       "buildCurvePlan = function (n, shares) { const c = globalThis.__override ? Q.caps[globalThis.__cmd] : null; if (!c) { const caps = {}; for (const b of Object.keys(shares)) caps[b] = Math.max(1, Math.round(shares[b] * n)); return { caps, counts: {} }; } return { caps: Object.assign({}, c), counts: {} }; };\n")
assert d.count("async function main() {") == 1
d = d.replace("async function main() {", pre + "async function main() {", 1)
call = "const deck = await buildForCommander("
assert d.count(call) == 1
d = d.replace(call, 'globalThis.__cmd = name; globalThis.__override = typeof OVERRIDE !== "undefined" && OVERRIDE; ' + call, 1)
(OUT / "dump_precon.js").write_text(d)
print("wrote combined_ph.js, quotas.json, dump_precon.js in", OUT)
