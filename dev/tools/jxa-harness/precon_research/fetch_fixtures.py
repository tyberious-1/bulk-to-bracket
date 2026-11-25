#!/usr/bin/env python3
"""Fetch the data the precon research builds need, into an output directory (not committed).

Usage (from the repo root): python3 dev/tools/jxa-harness/precon_research/fetch_fixtures.py OUTDIR

Reads dev/tools/jxa-harness/precon_foundations_2026.json (the five Foundations Commander precons) and writes:
  OUTDIR/owned_with_fdn.json  owned_raw.json plus Scryfall data for every precon card it lacks
  OUTDIR/prefetch.json        EDHREC commander pages plus up to 12 theme pages each (the app merges the
                              theme pages into its pool; the harness fixtures lack them), and the five
                              commanders' Scryfall cards, in the shape dump_decks.js reads
Public GET/POST requests to Scryfall and EDHREC only, like prefetch.py. About 70 requests.
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
HDR = {"Accept": "application/json", "User-Agent": "bulk-to-bracket-harness/1.0"}
EDHREC_BASE = "https://json.edhrec.com/pages/commanders/"  # js/constants.js
THEME_PAGE_LIMIT = 12   # js/api/edhrec.js EDHREC_THEME_PAGE_LIMIT
THEME_MIN_DECKS = 20    # js/api/edhrec.js EDHREC_THEME_MIN_DECKS


def get(url, data=None):
    headers = dict(HDR)
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if data is not None else "GET")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def slug(name):
    s = name.lower().replace("'", "").replace('"', "").replace(",", "")
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    return re.sub(r"-+", "-", s).strip("-")


decks = json.load(open(REPO / "dev/tools/jxa-harness/precon_foundations_2026.json"))["decks"]
names = set()
for v in decks.values():
    names |= set(v["cards"]) | {v["commander"]}
names = sorted(names)

cards, missing = [], []
for i in range(0, len(names), 75):
    d = get("https://api.scryfall.com/cards/collection",
            json.dumps({"identifiers": [{"name": n} for n in names[i:i + 75]]}).encode())
    cards += d.get("data", [])
    missing += [x.get("name") for x in d.get("not_found", [])]
    time.sleep(0.15)
if missing:
    sys.exit("Scryfall could not find: %s" % missing)

owned = json.load(open(REPO / "dev/tools/jxa-harness/owned_raw.json"))
have = {c["name"] for c in owned}
json.dump(owned + [c for c in cards if c["name"] not in have], open(OUT / "owned_with_fdn.json", "w"))

pages, commander_cards = {}, {}
for v in decks.values():
    cmd = v["commander"]
    url = f"{EDHREC_BASE}{slug(cmd)}.json"
    data = get(url)
    if not (data.get("container") or {}).get("json_dict", {}).get("cardlists"):
        sys.exit("EDHREC page for %s has no card lists" % cmd)
    pages[url] = data
    tags = [t for t in (data.get("panels") or {}).get("taglinks") or [] if t.get("slug") and int(t.get("count") or 0) >= THEME_MIN_DECKS]
    tags = sorted(tags, key=lambda t: -int(t.get("count") or 0))[:THEME_PAGE_LIMIT]
    got = 0
    for t in tags:
        u = f"{EDHREC_BASE}{slug(cmd)}/{t['slug']}.json"
        try:
            pages[u] = get(u)
            got += 1
        except Exception as exc:
            print("  theme page missing:", u, exc)
        time.sleep(0.2)
    commander_cards[cmd] = get("https://api.scryfall.com/cards/named?exact=" + urllib.parse.quote(cmd))
    print(f"{cmd}: commander page + {got} theme pages")
    time.sleep(0.25)

json.dump({"edhrecPages": pages, "commanderCards": commander_cards, "pairs": []}, open(OUT / "prefetch.json", "w"))
print("wrote", OUT / "owned_with_fdn.json", "and", OUT / "prefetch.json")
