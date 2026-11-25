#!/usr/bin/env python3
"""Fetch Scryfall data for every card in the owned-collection CSV.

Run from the repo root: python3 dev/tools/jxa-harness/fetch_owned.py [csv path] [output path]
Writes dev/tools/jxa-harness/owned_raw.json unless an output path is given (use that
for anyone else's collection so it never lands in the tracked file).

A full ManaBox export carries a "Binder Type" column. Only "binder" rows are
cards available to build with: "list" rows are want lists (not owned) and
"deck" rows are cards already sitting in a built deck, so both are skipped.
Older exports without that column are read as before.
"""
import csv
import json
import sys
import time
import urllib.request

CSV_PATH = sys.argv[1] if len(sys.argv) > 1 else "dev/card inventory.csv"
AVAILABLE_BINDER_TYPES = {"binder"}
OUT_PATH = sys.argv[2] if len(sys.argv) > 2 else "dev/tools/jxa-harness/owned_raw.json"
CHUNK_SIZE = 75

def read_owned_names(path):
    names = set()
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        name_field = next((c for c in reader.fieldnames if c.strip().lower() == "name"), reader.fieldnames[0])
        binder_field = next((c for c in reader.fieldnames if c.strip().lower() == "binder type"), None)
        for row in reader:
            if binder_field and (row.get(binder_field) or "").strip().lower() not in AVAILABLE_BINDER_TYPES:
                continue
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
    not_found = []
    for i in range(0, len(names), CHUNK_SIZE):
        chunk = names[i:i + CHUNK_SIZE]
        data = fetch_chunk(chunk)
        cards.extend(data.get("data", []))
        not_found.extend(n.get("name") for n in data.get("not_found", []))
        time.sleep(0.1)

    # Scryfall's collection endpoint never resolves the combined "Front //
    # Back" spelling ManaBox exports DFCs/splits/adventures under -- it comes
    # back not_found every time. Sending the front face alone returns the
    # whole card under its canonical combined name (project memory:
    # scryfall-rejects-double-slash-names), so retry those with just the part
    # before " // ".
    retry_names = sorted({n.split(" // ")[0].strip() for n in not_found if " // " in n})
    still_missing = []
    if retry_names:
        for i in range(0, len(retry_names), CHUNK_SIZE):
            chunk = retry_names[i:i + CHUNK_SIZE]
            data = fetch_chunk(chunk)
            cards.extend(data.get("data", []))
            still_missing.extend(n.get("name") for n in data.get("not_found", []))
            time.sleep(0.1)

    truly_missing = [n for n in not_found if " // " not in n] + still_missing
    if truly_missing:
        print(f"not found ({len(truly_missing)}):", truly_missing)

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(cards, f)
    print(f"wrote {len(cards)} cards to {OUT_PATH} ({len(not_found)} front-face retries, {len(truly_missing)} still missing)")

if __name__ == "__main__":
    main()
