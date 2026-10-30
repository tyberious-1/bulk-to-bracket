#!/usr/bin/env python3
"""Compare two dump_decks.js outputs (baseline vs after) for the engine-enablers work.

Prints, per commander: cards added/removed and creature count before/after, then
the commanders whose deck did not change. Creature counts come from the owned
collection's type lines.

Usage:
  python3 dev/tools/jxa-harness/engine_compare.py BEFORE.json AFTER.json [--only "A|B"]
"""
import argparse
import json

OWNED = "dev/tools/jxa-harness/owned_raw.json"


def load_types():
    types = {}
    for card in json.load(open(OWNED)):
        types.setdefault(card["name"], card.get("type_line", ""))
    return types


def creatures(names, types):
    return sum(1 for n in names if "Creature" in types.get(n, "").split("—")[0])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("before")
    parser.add_argument("after")
    parser.add_argument("--only", default="")
    args = parser.parse_args()
    before = json.load(open(args.before))
    after = json.load(open(args.after))
    only = set(args.only.split("|")) if args.only else None
    types = load_types()

    unchanged = []
    for key in before:
        if only and key not in only:
            continue
        if key not in after:
            continue
        b, a = before[key]["current"], after[key]["current"]
        added, removed = sorted(set(a) - set(b)), sorted(set(b) - set(a))
        if not added and not removed:
            unchanged.append(key)
            continue
        print(f"\n== {key}: {len(b)} -> {len(a)} cards, creatures {creatures(b, types)} -> {creatures(a, types)}")
        print(f"   added   ({len(added)}): {', '.join(added)}")
        print(f"   removed ({len(removed)}): {', '.join(removed)}")
    print(f"\nunchanged ({len(unchanged)}): {', '.join(unchanged)}")


if __name__ == "__main__":
    main()
