#!/usr/bin/env python3
"""Fetch Scryfall power/type data for every card in the given Forge .dck files, so board.js can read
cards that are not in the owned collection (the Forge precons).

Usage (repo root): python3 dev/tools/forge-sim/fetch_deck_cards.py <out.json> <deck.dck> [<deck.dck> ...]
Sends card names only. Needs the explicit Accept header (Scryfall 400s the collection endpoint without it).
"""
import json, re, sys, time, urllib.request

out, decks = sys.argv[1], sys.argv[2:]
names = set()
for d in decks:
    for line in open(d, encoding="utf-8"):
        m = re.match(r"^\d+ (.+?)\s*$", line)
        if m:
            names.add(m.group(1).split("|")[0].split(" // ")[0])  # Forge precons write "Name|SET|n"
names = sorted(names)
cards, missing = [], []
for i in range(0, len(names), 75):
    chunk = names[i:i + 75]
    req = urllib.request.Request(
        "https://api.scryfall.com/cards/collection",
        data=json.dumps({"identifiers": [{"name": n} for n in chunk]}).encode(),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        data = json.loads(r.read().decode())
    for c in data.get("data", []):
        cards.append({"name": c["name"], "power": c.get("power"), "type_line": c.get("type_line", "")})
    missing += [x.get("name") for x in data.get("not_found", [])]
    time.sleep(0.1)
json.dump(cards, open(out, "w"))
print(f"wrote {len(cards)} cards from {len(names)} names; not found: {len(missing)} {missing[:10]}")
