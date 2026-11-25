#!/usr/bin/env python3
"""Build owned commanders through the real builder, with quota switches (the 2026-11-04 owned-commander tests).

Usage (from the repo root): python3 dev/tools/jxa-harness/precon_research/owned_commanders.py OUTDIR "Sai, Master Thopterist" "Whisper, Blood Liturgist" ...
Writes into OUTDIR (not committed):
  prefetch.json   EDHREC commander page plus up to 12 theme pages (20+ decks) and the Scryfall card, per commander
  combined_ph.js  the harness with a per-pick phase label (P-2, P-1, P0, P1, P1b, P2, P3, P4)
  dump_own.js     dump_decks.js pointed at owned_raw.json and OUTDIR/prefetch.json; prints per-pick entries
                  (name, role, source, phase, score, mana value), the scored EDHREC pool and the role/type plan
Run: (echo 'const ONLY_COMMANDERS=["Sai, Master Thopterist"];'; cat OUTDIR/combined_ph.js OUTDIR/dump_own.js) > run.js
     osascript -l JavaScript run.js > out.txt      (a line starting "DECKS " holds the JSON; ignore the Scryfall 404 retries)
Switches, declared with const before the cat (all optional): ENCH = n (enchantment type target), SYN = n (plan-card
role target, max n+3), CURVE_OFF = true (curve band caps off), ROLE_MIN = true (each support role at its minimum).
Relaxing one quota at a time showed none frees a web card alone; the combination did (see the findings doc).
"""
import json
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
OUT = Path(sys.argv[1]).resolve()
CMDS = sys.argv[2:]
OUT.mkdir(parents=True, exist_ok=True)
EDHREC_BASE = "https://json.edhrec.com/pages/commanders/"
HDR = {"Accept": "application/json", "User-Agent": "bulk-to-bracket-harness/1.0"}


def get(url):
    return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=HDR)).read())


def slug(n):
    s = re.sub(r"[^a-z0-9\s-]", "", n.lower().replace("'", "").replace(",", ""))
    return re.sub(r"-+", "-", re.sub(r"\s+", "-", s)).strip("-")


pages, cards = {}, {}
cached = json.load(open(OUT / "prefetch.json")) if (OUT / "prefetch.json").exists() else None
if cached and all(c in cached["commanderCards"] for c in CMDS):
    pages, cards = cached["edhrecPages"], cached["commanderCards"]   # reuse: rebuild the harness only, no network
    print("reusing", OUT / "prefetch.json")
    CMDS = []
for cmd in CMDS:
    url = f"{EDHREC_BASE}{slug(cmd)}.json"
    data = get(url)
    pages[url] = data
    tags = [t for t in (data.get("panels") or {}).get("taglinks") or [] if t.get("slug") and int(t.get("count") or 0) >= 20]
    for t in sorted(tags, key=lambda t: -int(t["count"]))[:12]:
        u = f"{EDHREC_BASE}{slug(cmd)}/{t['slug']}.json"
        try:
            pages[u] = get(u)
        except Exception as exc:
            print("theme page missing:", u, exc)
        time.sleep(0.2)
    cards[cmd] = get("https://api.scryfall.com/cards/named?exact=" + urllib.parse.quote(cmd))
    print(cmd, "done")
    time.sleep(0.25)
if CMDS or not cached:
    json.dump({"edhrecPages": pages, "commanderCards": cards, "pairs": []}, open(OUT / "prefetch.json", "w"))

subprocess.run(["bash", "dev/tools/jxa-harness/build_harness.sh", str(OUT / "combined.js")], cwd=REPO, check=True)
s = (OUT / "combined.js").read_text()
for marker, label in (("  // Phase -2:", "P-2"), ("  // Phase -1:", "P-1"), ("  // Phase 0:", "P0"), ("    // Phase 1:", "P1"),
                      ("    // Phase 1b:", "P1b"), ("    // Phase 2:", "P2"), ("    // Phase 3:", "P3"), ("    // Phase 4:", "P4")):
    assert s.count(marker) == 1, marker
    s = s.replace(marker, f'{marker[:len(marker) - len(marker.lstrip())]}globalThis.__ph = "{label}";\n{marker}', 1)
push = "deck.push({ ...card, source, roles, supportOnly });"
assert s.count(push) == 1
(OUT / "combined_ph.js").write_text(s.replace(push, "deck.push({ ...card, source, roles, supportOnly, phase: globalThis.__ph });"))

d = (REPO / "dev/tools/jxa-harness/dump_decks.js").read_text()
d = d.replace("dev/tools/jxa-harness/prefetch_data.json", str(OUT / "prefetch.json"))
d = d.replace('"dev/tools/jxa-harness/owned_raw.json"', f'"{REPO}/dev/tools/jxa-harness/owned_raw.json"')
anchor = "  return buildDeckFromScoredPool("
assert d.count(anchor) == 1
d = d.replace(anchor, '  globalThis.__dbg = globalThis.__dbg || {}; globalThis.__dbg[key] = { scored: scoredNonlands.map((c) => ({ n: c.name, s: c.score, r: c.role, cmc: c.cmc })), edhrecN: edhrecCards.length, themeN: themeCardNames.size };\n' + anchor, 1)
old_out = 'out[name] = { current: deck.filter((c) => c.role !== "land").map((c) => c.name) };'
assert d.count(old_out) == 1
d = d.replace(old_out, 'out[name] = { dbg: globalThis.__dbg[name], plan: JSON.parse(JSON.stringify(globalThis.__plan || null)), entries: deck.filter((c) => c.role !== "land").map((c) => { const o = {}; for (const k of Object.keys(c)) { const v = c[k]; if (v === null || ["string","number","boolean"].includes(typeof v)) o[k] = v; } return o; }) };')
pre = ("const __o1 = buildRoleTargetPlan; buildRoleTargetPlan = function () { const r = __o1.apply(null, arguments); globalThis.__plan = r;\n"
       " if (typeof ENCH !== \"undefined\" && r.typeBuckets.Enchantment) r.typeBuckets.Enchantment.target = ENCH;\n"
       " if (typeof SYN !== \"undefined\" && r.roleBuckets.synergy) { r.roleBuckets.synergy.target = SYN; r.roleBuckets.synergy.max = SYN + 3; }\n"
       " if (typeof ROLE_MIN !== \"undefined\" && ROLE_MIN) { for (const k of [\"ramp\", \"draw\", \"removal\", \"wipe\"]) if (r.roleBuckets[k]) r.roleBuckets[k].target = r.roleBuckets[k].min; }\n"
       " return r; };\n"
       "const __o2 = buildCurvePlan; buildCurvePlan = function (n, shares) { if (typeof CURVE_OFF !== \"undefined\" && CURVE_OFF) { const caps = {}; for (const b of Object.keys(shares)) caps[b] = 99; return { caps, counts: {} }; } return __o2.apply(null, arguments); };\n")
assert d.count("async function main() {") == 1
(OUT / "dump_own.js").write_text(d.replace("async function main() {", pre + "async function main() {", 1))
print("wrote prefetch.json, combined_ph.js, dump_own.js in", OUT)
