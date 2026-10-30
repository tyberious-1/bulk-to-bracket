#!/usr/bin/env python3
"""Fetch EDHREC commander pages and Scryfall commander-card data for a fixed
list of sample commanders, so compare.js can run the project's real
getEDHREC()/resolveCommanders() logic offline.

Run from the repo root: python3 dev/tools/jxa-harness/prefetch.py
Merges into dev/tools/jxa-harness/prefetch_data.json (existing entries are kept).
"""
import json
import re
import time
import urllib.parse
import urllib.request

OUT_PATH = "dev/tools/jxa-harness/prefetch_data.json"
EDHREC_BASE = "https://json.edhrec.com/pages/commanders/"

# The sample set the offline harness builds against: 12 solo commanders plus the
# Tormod + Ghost pair (13 builds), cut down from 54 on 2026-10-29. It spans type-mix
# shapes on purpose: creature-heavy (Fynn, Strefan), artifact-heavy (Greasefang,
# Ragost), spell-heavy (Kaza, Rielle), enchantment-heavy (Eriette); the engine work's
# commanders (Greasefang, Tormod + Ghost, Callaphe); regression cases cited in the code
# (Kaza, Kardur); and the event and bottom-up targets (Old Rutstein, Omnath, The Council
# of Four). The Tormod + Ghost cards and their pair page ("A // B" EDHREC page) are not
# fetched here; they live in the committed fixture and survive because main() merges
# into the file. Pruning the fixture to this set is a manual step: main() keeps old
# entries, so removing a commander from this list does not remove its fixture.
SAMPLE_COMMANDERS = [
    "Greasefang, Okiba Boss",
    "Callaphe, Beloved of the Sea",
    "Kaza, Roil Chaser",
    "Kardur, Doomscourge",
    "Fynn, the Fangbearer",
    "Strefan, Maurer Progenitor",
    "Ragost, Deft Gastronaut",
    "Rielle, the Everwise",
    "Eriette of the Charmed Apple",
    "Old Rutstein",
    "Omnath, Locus of Rage",
    "The Council of Four"
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
    # Merge into the existing file instead of overwriting it: re-running with
    # a shorter list used to silently drop every commander not named here.
    edhrec_pages = {}
    commander_cards = {}
    try:
        with open(OUT_PATH, encoding="utf-8") as f:
            existing = json.load(f)
        edhrec_pages = existing.get("edhrecPages", {})
        commander_cards = existing.get("commanderCards", {})
    except FileNotFoundError:
        pass

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
