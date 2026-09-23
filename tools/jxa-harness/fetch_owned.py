#!/usr/bin/env python3
"""Fetch Scryfall data for every card in the owned-collection CSV.

Run from the repo root: python3 tools/jxa-harness/fetch_owned.py
Writes tools/jxa-harness/owned_raw.json.
"""
import csv
import json
import time
import urllib.request

CSV_PATH = "card inventory (1).csv"
OUT_PATH = "tools/jxa-harness/owned_raw.json"
CHUNK_SIZE = 75

def read_owned_names(path):
    names = set()
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        name_field = next((c for c in reader.fieldnames if c.strip().lower() == "name"), reader.fieldnames[0])
        for row in reader:
            name = (row.get(name_field) or "").strip()
            if name:
                names.add(name)
    return sorted(names)

def fetch_chunk(names):
    body = json.dumps({"identifiers": [{"name": n} for n in names]}).encode("utf-8")
    req = urllib.request.Request(
        "https://api.scryfall.com/cards/collection",
        data=body,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def main():
    names = read_owned_names(CSV_PATH)
    cards = []
    for i in range(0, len(names), CHUNK_SIZE):
        chunk = names[i:i + CHUNK_SIZE]
        data = fetch_chunk(chunk)
        cards.extend(data.get("data", []))
        if data.get("not_found"):
            print("not found:", [n.get("name") for n in data["not_found"]])
        time.sleep(0.1)

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(cards, f)
    print(f"wrote {len(cards)} cards to {OUT_PATH}")

if __name__ == "__main__":
    main()
