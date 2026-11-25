#!/usr/bin/env python3
"""Ledger for one owned commander's web: for each web class (a regex over oracle text), which owned cards in the
commander's colors the build picked and which it left out (with the EDHREC pool score when it has one).

Usage (from the repo root): python3 dev/tools/jxa-harness/precon_research/web_ledger.py OUT.txt "Sai, Master Thopterist" U \
    'cast payoff=whenever you cast an artifact' 'affinity=affinity for artifacts|improvise' [--types Creature] [--min-mv 5] [--max-mv 3]
OUT.txt is the osascript output of owned_commanders.py; the colors are letters (U, BG). The card's own name is
replaced by ~ and "this creature" is NOT, so write patterns for modern wording. Regexes are rough: read the lists,
do not trust the counts as exact (a class like "pump" matches equipment too).
"""
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
args = [a for a in sys.argv[1:]]
opts = {}
for flag in ("--types", "--min-mv", "--max-mv"):
    if flag in args:
        i = args.index(flag)
        opts[flag] = args[i + 1]
        del args[i:i + 2]
out_file, cmd, colors, classes = args[0], args[1], set(args[2]), args[3:]
for line in open(out_file):
    if line.startswith("DECKS "):
        deck = json.loads(line[6:])[cmd]
        break
else:
    sys.exit("no DECKS line")
picked = {e["name"] for e in deck["entries"]}
scored = {x["n"]: x for x in deck["dbg"]["scored"]}
cards = json.load(open(REPO / "dev/tools/jxa-harness/owned_raw.json"))


def text(c):
    t = c.get("oracle_text") or ""
    for f in c.get("card_faces") or []:
        t += " // " + (f.get("oracle_text") or "")
    return t.replace("\n", " / ").replace(c["name"], "~")


pool = [c for c in cards if set(c.get("color_identity") or []) <= colors and c["name"] != cmd
        and "Land" not in c["type_line"].split("—")[0]
        and ("--types" not in opts or opts["--types"] in c["type_line"])
        and ("--min-mv" not in opts or c["cmc"] >= float(opts["--min-mv"]))
        and ("--max-mv" not in opts or c["cmc"] <= float(opts["--max-mv"]))]
print(f"{cmd}: {len(deck['entries'])} picks, EDHREC pool {deck['dbg']['edhrecN']}, {len(pool)} owned candidates in colors")
for spec in classes:
    label, rx = spec.split("=", 1)
    hit = [c for c in pool if re.search(rx, text(c), re.I)]
    got = [c["name"] for c in hit if c["name"] in picked]
    miss = sorted((c for c in hit if c["name"] not in picked), key=lambda c: -scored.get(c["name"], {}).get("s", 0))
    print(f"\n{label}: owned {len(hit)}, picked {len(got)}: {got}")
    print("  left out:", "; ".join(f"{c['name']}({int(c['cmc'])}" + (f", {scored[c['name']]['s']:.0f}" if c["name"] in scored else "") + ")" for c in miss[:40]))
