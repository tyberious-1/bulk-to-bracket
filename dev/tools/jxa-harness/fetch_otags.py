import json, sys, time, urllib.request, urllib.parse
TAGS = {
 "removal": ["spot-removal","removal-creature","multi-removal","edict","removal-exile","removal-destroy"],
 "wipe": ["sweeper"],
 "ramp": ["ramp","mana-dork","mana-rock"],
 "draw": ["pure-draw","draw-engine","cantrip"],
}
out = {}
for role, tags in TAGS.items():
    names = set()
    for tag in tags:
        url = "https://api.scryfall.com/cards/search?" + urllib.parse.urlencode({"q": f"otag:{tag} -t:land game:paper", "unique": "cards"})
        while url:
            req = urllib.request.Request(url, headers={"User-Agent": "bulk-to-bracket-measure/1.0", "Accept": "application/json"})
            d = json.load(urllib.request.urlopen(req, timeout=30))
            for c in d["data"]: names.add(c["name"])
            url = d.get("next_page")
            time.sleep(0.12)
        print(role, tag, len(names), file=sys.stderr, flush=True)
    out[role] = sorted(names)
json.dump(out, open(sys.argv[1], "w"))
