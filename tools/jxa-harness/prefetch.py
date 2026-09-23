#!/usr/bin/env python3
"""Fetch EDHREC commander pages and Scryfall commander-card data for a fixed
list of sample commanders, so compare.js can run the project's real
getEDHREC()/resolveCommanders() logic offline.

Run from the repo root: python3 tools/jxa-harness/prefetch.py
Writes tools/jxa-harness/prefetch_data.json.
"""
import json
import re
import time
import urllib.parse
import urllib.request

OUT_PATH = "tools/jxa-harness/prefetch_data.json"
EDHREC_BASE = "https://json.edhrec.com/pages/commanders/"

# One sample commander per axis this plan's design doc cares about: color
# count, ramp density, tribal vs non-tribal. Extend this list to widen the
# comparison in Task 11.
SAMPLE_COMMANDERS = [
    "Rivaz of the Claw",
    "Krydle of Baldur's Gate",
]

def slugify_for_edhrec(name):
    # Mirrors js/utils/text.js's slugifyForEdhrec exactly enough for plain
    # commander names (no special characters beyond apostrophes/commas).
    s = name.lower()
    s = s.replace("'", "").replace('"', "").replace(",", "")
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s.strip("-")

def fetch_json(url):
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def fetch_edhrec_page(name):
    slug = slugify_for_edhrec(name)
    for url in (f"{EDHREC_BASE}{slug}.json", f"{EDHREC_BASE}{slug}/{slug}.json"):
        try:
            data = fetch_json(url)
            cardlists = (data.get("container") or {}).get("json_dict", {}).get("cardlists")
            if cardlists:
                return url, data
        except Exception as exc:
            print(f"  miss: {url} ({exc})")
        time.sleep(0.2)
    return None, None

def fetch_commander_card(name):
    url = "https://api.scryfall.com/cards/named?exact=" + urllib.parse.quote(name)
    return fetch_json(url)

def main():
    edhrec_pages = {}
    commander_cards = {}

    for name in SAMPLE_COMMANDERS:
        print(f"fetching {name}...")
        url, data = fetch_edhrec_page(name)
        if url:
            edhrec_pages[url] = data
        else:
            print(f"  WARNING: no EDHREC page found for {name}")
        commander_cards[name] = fetch_commander_card(name)
        time.sleep(0.2)

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump({"edhrecPages": edhrec_pages, "commanderCards": commander_cards}, f)
    print(f"wrote {len(edhrec_pages)} EDHREC pages and {len(commander_cards)} commander cards to {OUT_PATH}")

if __name__ == "__main__":
    main()
