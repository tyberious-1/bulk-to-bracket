#!/usr/bin/env python3
"""Fetch EDHREC average decks and the Scryfall card data they need, for goldfish.js.

Usage (from the repo root): python3 -I dev/tools/jxa-harness/precon_research/fetch_average_decks.py REF_DIR slug [slug ...]
  slug like koth-the-geomancer (a partner pair joins both: gut-true-soul-zealot-agent-of-the-shadow-thieves)
Writes REF_DIR/<slug>.json (json.edhrec.com/pages/average-decks/<slug>.json) and REF_DIR/cards.json (name -> Scryfall card;
owned_raw.json first, the rest from Scryfall's collection endpoint, 75 names a call). Public, read-only requests.
"""
import json, sys, time, urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
HDR = {"User-Agent": "bulk-to-bracket-measure/1.0", "Accept": "application/json"}


def get(url, body=None):
    h = dict(HDR)
    if body is not None:
        h["Content-Type"] = "application/json"
    return json.loads(urllib.request.urlopen(urllib.request.Request(url, data=body, headers=h), timeout=30).read())


def main():
    ref = Path(sys.argv[1]); ref.mkdir(parents=True, exist_ok=True)
    need = set()
    for slug in sys.argv[2:]:
        d = get("https://json.edhrec.com/pages/average-decks/%s.json" % slug)
        (ref / (slug + ".json")).write_text(json.dumps(d))
        deck = d["deck"]
        need.update(deck["commander"])
        for k, v in deck["cards"].items():
            if k != "Land":
                need.update(nm for nm, _ in v)
        time.sleep(0.3)
    owned = {c["name"]: c for c in json.loads((REPO / "dev/tools/jxa-harness/owned_raw.json").read_text())}
    out, ask = {}, []
    for n in sorted(need):
        (out.__setitem__(n, owned[n]) if n in owned else ask.append(n))
    for i in range(0, len(ask), 75):
        r = get("https://api.scryfall.com/cards/collection", json.dumps({"identifiers": [{"name": n} for n in ask[i:i + 75]]}).encode())
        for c in r["data"]:
            out[c["name"]] = out[c["name"].split(" // ")[0]] = c
        for nf in r.get("not_found", []):
            print("not found", nf)
        time.sleep(0.2)
    (ref / "cards.json").write_text(json.dumps(out))
    print(len(sys.argv) - 2, "decks;", len(out), "cards")


main()
