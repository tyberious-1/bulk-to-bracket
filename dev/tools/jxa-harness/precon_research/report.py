#!/usr/bin/env python3
"""Compare the default and oracle builds with each precon.

Usage (from the repo root): python3 dev/tools/jxa-harness/precon_research/report.py OUTDIR
Reads OUTDIR/out_default.txt and OUTDIR/out_oracle.txt (the osascript output, see README.md) and prints, per deck:
overlap with the precon's nonland cards, cards at 5+ mana not in the precon, fallback-tier picks, mean score,
role counts, and which phase filled each cheap mana-value band. Overlap with a precon is a probe, not quality.
"""
import collections
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
OUT = Path(sys.argv[1])
decks = json.load(open(REPO / "dev/tools/jxa-harness/precon_foundations_2026.json"))["decks"]
cards = {c["name"]: c for c in json.load(open(OUT / "owned_with_fdn.json"))}


def load(name):
    for line in open(OUT / name):
        if line.startswith("DECKS "):
            return json.loads(line[6:])
        if line.startswith("ERROR"):
            sys.exit(line[:400])
    sys.exit("no DECKS line in " + name)


runs = {"default": load("out_default.txt"), "oracle": load("out_oracle.txt")}
for deck_name, v in decks.items():
    cmd = v["commander"]
    precon = {n for n in v["cards"] if n != cmd and "Land" not in cards[n]["type_line"]}
    print(f"\n## {deck_name} ({cmd}), precon nonland {len(precon)}, EDHREC pool {runs['default'][cmd]['dbg']['edhrecN']}")
    for label, data in runs.items():
        entries = data[cmd]["entries"]
        top = [e for e in entries if e["cmc"] >= 5]
        roles = collections.Counter(e["role"] for e in entries)
        print(f"  {label:7s} overlap {sum(1 for e in entries if e['name'] in precon):2d}/{len(precon)}  "
              f"5+ not in precon {sum(1 for e in top if e['name'] not in precon):2d}  "
              f"fallback {sum(1 for e in entries if e['source'] != 'edhrec'):2d}  "
              f"mean score {sum(e['score'] for e in entries) / len(entries):4.1f}  "
              f"roles {dict(roles)}")
    entries = runs["default"][cmd]["entries"]
    by_phase = collections.defaultdict(list)
    for e in entries:
        by_phase[e.get("phase")].append(e["score"])
    print("  default by phase: " + "  ".join(f"{p}: n={len(x)} mean={sum(x) / len(x):.0f}" for p, x in sorted(by_phase.items(), key=lambda kv: str(kv[0]))))
    bands = []
    for lo, hi, label in ((0, 1, "mv<=1"), (2, 2, "mv2"), (3, 3, "mv3")):
        band = [e for e in entries if lo <= e["cmc"] <= hi]
        p0 = sum(1 for e in band if e.get("phase") == "P0")
        bands.append(f"{label}: {len(band)} cards, {p0} from Phase 0")
    print("  cheap bands: " + " | ".join(bands))
