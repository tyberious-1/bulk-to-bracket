#!/usr/bin/env python3
"""Build report: a one-screen scorecard of how a deck is likely to play, read from card text.

Usage (repo root):
  python3 dev/tools/jxa-harness/build_report.py [--ref a.dck,b.dck] deck.dck [deck.dck ...]

Reads Forge .dck files (commander in [Commander], 99 in [Main]; Forge's "Name|SET|n" suffixes are
stripped). Card text comes from Scryfall by card NAME only (no personal data is sent) and is cached in
dev/tools/forge-sim/work/card_text_cache.json (git-ignored). No Forge games are needed.

What it measures (all from oracle text, so it is a property check, not a win predictor):
  creatures / lands / curve        composition
  real ramp                        cards that produce mana or fetch/put lands (not the role tag)
  ways through (2026-11-19)        damage must go around or through blockers:
    around    flying, menace, shadow, fear, "can't be blocked"
    trample   trample (own, creatures only)
    skip      damage or life loss aimed at a player: repeatable (trigger or free ability) vs one-shot
    clear     one-sided mass effects on opponents' creatures (a symmetrical wrath is listed apart)
    grants    cards that give evasion or trample to other creatures
  evasive power                    power on creatures that carry a way through of their own
  go-wide                          creature-token makers (a separate way to win, not a way through)
A card is counted in its strongest category once for 'ways through'. Read the card list printed with
--cards before trusting a count: patterns overcount (a conditional trigger, a 1-damage ping).
"""
import json, os, re, sys, time, urllib.request

CACHE = "dev/tools/forge-sim/work/card_text_cache.json"
AROUND_KW = {"Flying", "Menace", "Shadow", "Fear", "Intimidate", "Horsemanship", "Skulk"}


def load_deck(path):
    out, sec = [], None
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if line.startswith("["):
            sec = line
            continue
        m = re.match(r"^(\d+) (.+)$", line)
        if m and sec in ("[Main]", "[Commander]"):
            name = m.group(2).split("|")[0].split(" // ")[0]
            out += [(name, sec)] * int(m.group(1))
    return out


def fetch_cards(names):
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    need = sorted(n for n in set(names) if n not in cache)
    for i in range(0, len(need), 75):
        req = urllib.request.Request(
            "https://api.scryfall.com/cards/collection",
            data=json.dumps({"identifiers": [{"name": n} for n in need[i:i + 75]]}).encode(),
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        data = json.loads(urllib.request.urlopen(req).read().decode())
        for c in data["data"]:
            faces = c.get("card_faces") or [{}]
            text = c.get("oracle_text") or " // ".join(f.get("oracle_text", "") for f in faces)
            cache[c["name"].split(" // ")[0]] = {
                "name": c["name"], "cmc": c["cmc"], "type": c["type_line"],
                "power": c.get("power") or faces[0].get("power"),
                "kw": c.get("keywords", []), "text": text,
            }
        for nf in data.get("not_found", []):
            print("not found:", nf.get("name"), file=sys.stderr)
        time.sleep(0.1)
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    json.dump(cache, open(CACHE, "w"))
    return cache


def clean(text, name):
    t = re.sub(r"\([^)]*\)", "", text)
    return t.replace(name.split(",")[0], "~").lower()


def real_ramp(c, t):
    ty = c["type"].lower()
    if "land" in ty and "creature" not in ty:
        return False
    if re.search(r"search your library for [^.]*\blands?\b|put [^.]*\bland\b[^.]*onto the battlefield|play an additional land|play two additional lands", t):
        return True
    return any(re.search(r"\badd (?:\{|one |two |three |x )", l) for l in t.split("\n"))


def drain_size(t):
    sizes = [int(m) for m in re.findall(r"(?:loses?|deals?) (\d+)(?: damage)?(?: to| life)", t)]
    return max(sizes) if sizes else 0


def classify(c, key):
    """Return (best way-through category or None, set of extra flags)."""
    t = clean(c["text"], key)
    kw = set(c["kw"])
    cre = "Creature" in c["type"]
    flags = set()
    around = cre and (bool(kw & AROUND_KW) or re.search(r"can't be blocked(?! by| except)", t))
    through = cre and "Trample" in kw
    grants = bool(re.search(r"(?:gain|gains|have|has|get|gets)[^.\n]*(?:flying|menace|can't be blocked|trample)", t)) and not (cre and (around or through) and not re.search(r"(?:other|each|target|creatures?)[^.\n]*(?:gain|gains|have|has)[^.\n]*(?:flying|menace|can't be blocked|trample)", t))
    clear = bool(re.search(r"creatures your opponents control (?:get|gets) -|(?:destroy|exile|tap) all creatures your opponents control|each creature your opponents control|all creatures your opponents control", t))
    wrath = (not clear) and bool(re.search(r"(?:destroy|exile) all (?:nonland )?(?:creatures|permanents)|deals? \w+ damage to each creature(?! your opponents)", t))
    player = bool(re.search(r"each opponent loses|target (?:opponent|player) loses|loses \d+ life|deals? (?:x|\d+) damage to each opponent|deals? \d+ damage to (?:target|each) (?:opponent|player)|deals? (?:x|\d+) damage to any target|damage to each opponent", t))
    if player:
        size = drain_size(t)
        repeat = bool(re.search(r"whenever|at the beginning|\{t\}:|\{\d+\}: ", t)) and not re.search(r"sacrifice [^:]*:", t.split("\n")[0] if "\n" not in t else "")
        flags.add("skip_rep" if (repeat and "sacrifice" not in t.split("loses")[0][-60:]) else "skip_once")
        if size >= 3 and not repeat:
            flags.add("skip_big")
    if "create" in t and re.search(r"create[s]?[^.]*creature token", t):
        flags.add("wide")
    best = "clear" if clear else "around" if around else "through" if through else "skip" if player else "grants" if grants else None
    if clear: flags.add("clear")
    if wrath: flags.add("wrath")
    if grants: flags.add("grants")
    if around: flags.add("around")
    if through: flags.add("through")
    return best, flags


def power_of(c):
    try:
        return int(c["power"])
    except (TypeError, ValueError):
        return 0


def report(path, cache, show_cards=False):
    cards = load_deck(path)
    row = dict(creatures=0, lands=0, nonland=0, c12=0, c34=0, c5=0, ramp=0, around=0, through=0,
               skip_rep=0, skip_once=0, clear=0, wrath=0, grants=0, ways=0, evas=0, crepow=0, wide=0, unknown=0)
    named = {}
    for n, sec in cards:
        c = cache.get(n)
        if not c:
            row["unknown"] += 1
            continue
        ty = c["type"]
        if "Land" in ty and "Creature" not in ty:
            row["lands"] += 1
            continue
        row["nonland"] += 1
        cm = c["cmc"]
        row["c12" if cm <= 2 else "c34" if cm <= 4 else "c5"] += 1
        t = clean(c["text"], n)
        if real_ramp(c, t):
            row["ramp"] += 1
        best, flags = classify(c, n)
        if "Creature" in ty:
            row["creatures"] += 1
            row["crepow"] += power_of(c)
            if flags & {"around", "through"}:
                row["evas"] += power_of(c)
        for f in flags:
            if f in row:
                row[f] += 1
        if "wide" in flags:
            row["wide"] += 1
        if best in ("clear", "around", "through", "skip"):
            row["ways"] += 1
        if best:
            named.setdefault(best, []).append(n)
    return row, named


def main():
    args = sys.argv[1:]
    ref = []
    cards_flag = "--cards" in args
    args = [a for a in args if a != "--cards"]
    if args and args[0] == "--ref":
        ref = args[1].split(",")
        args = args[2:]
    decks = [d for d in args if d.endswith(".dck")]
    names = [n for d in decks + ref for n, _ in load_deck(d)]
    cache = fetch_cards(names)
    head = f"{'deck':24s} {'cre':>3s} {'lnd':>3s} {'1-2':>3s} {'3-4':>3s} {'5+':>3s} {'ramp':>4s} | {'ways':>4s} {'arnd':>4s} {'trmp':>4s} {'drn+':>4s} {'drn1':>4s} {'clr':>3s} {'grnt':>4s} | {'evasP':>9s} {'wide':>4s}"
    print(head)
    for d in decks:
        r, named = report(d, cache)
        label = os.path.basename(d).replace(".dck", "")[:24]
        print(f"{label:24s} {r['creatures']:3d} {r['lands']:3d} {r['c12']:3d} {r['c34']:3d} {r['c5']:3d} {r['ramp']:4d} | {r['ways']:4d} {r['around']:4d} {r['through']:4d} {r['skip_rep']:4d} {r['skip_once']:4d} {r['clear']:3d} {r['grants']:4d} | {str(r['evas'])+'/'+str(r['crepow']):>9s} {r['wide']:4d}"
              + (f"  [unread cards: {r['unknown']}]" if r["unknown"] else ""))
        if cards_flag:
            for k, v in named.items():
                print(f"    {k}: {', '.join(v)}")
    print("\ncolumns: cre creatures | lnd lands | curve 1-2 / 3-4 / 5+ (nonland) | ramp real producers or land fetch |"
          " ways cards with a way through (strongest category) | arnd evasive creatures | trmp trample creatures |"
          " drn+ repeatable player damage or drain | drn1 one-shot | clr one-sided mass effect | grnt gives evasion |"
          " evasP power of evasive creatures / total creature power | wide creature-token makers")


if __name__ == "__main__":
    main()
