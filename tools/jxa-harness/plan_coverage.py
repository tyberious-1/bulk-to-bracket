#!/usr/bin/env python3
"""Plan coverage: how much of each candidate plan the collection can fill.

A commander's EDHREC theme pages (…/<commander>/<theme>.json) list the cards
decks in that theme play. A theme's "wanted" set is its nonland cards played in
at least MIN_INCLUSION of that theme's decks. Most of a theme's list is the commander's general
staples, so a theme is identified by its *distinctive* cards: wanted cards whose
inclusion beats the commander's main page by MIN_LIFT. A plan is 1-3 themes
whose distinctive sets overlap; its coverage is how many of the commander's
core cards and of the plan's distinctive cards the collection owns inside the
commander's colors.

Prototype for the plan-first spec (docs/superpowers/specs/2026-10-13-plan-first-prototyping.md).

Usage:
  python3 tools/jxa-harness/plan_coverage.py FIXTURES.json "Commander Name" [...]
              [--owned tools/jxa-harness/owned_raw.json] [--slice 1.0]
FIXTURES.json holds {edhrecPages, commanderCards} with theme pages fetched
(the repo's prefetch_data.json has commander pages only).
"""
import argparse
import json
import re

MIN_INCLUSION = 0.15   # share of a theme's decks that must play a card for it to be "wanted"
MIN_DECKS = 3          # ignore themes too small to mean anything
MIN_LIFT = 0.15        # inclusion a card gains over the commander's main page to count as distinctive
OVERLAP_TO_MERGE = 0.10  # Jaccard overlap of distinctive sets needed to combine two themes
MAX_THEMES = 3
MAX_PLANS = 3

def slugify(name):
    s = name.lower().split(' // ')[0]
    s = re.sub(r"[',]", "", s)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

def wanted_cards(page):
    """{card name: (inclusion, synergy)} for nonland cards a theme page recommends."""
    out = {}
    lists = page.get("container", {}).get("json_dict", {}).get("cardlists", [])
    for lst in lists:
        if lst.get("header") in ("Lands", "Basic Lands", "Utility Lands"):
            continue
        for cv in lst.get("cardviews", []):
            pot = cv.get("potential_decks") or 0
            if not pot:
                continue
            inc = (cv.get("num_decks") or 0) / pot
            if inc >= MIN_INCLUSION and (cv.get("potential_decks") or 0) >= MIN_DECKS:
                prev = out.get(cv["name"])
                if prev is None or inc > prev[0]:
                    out[cv["name"]] = (inc, cv.get("synergy") or 0)
    return out

def load_themes(edhrec_pages, commander):
    slug = slugify(commander)
    base = "https://json.edhrec.com/pages/commanders/" + slug
    main = edhrec_pages.get(base + ".json")
    if not main:
        return {}, []
    tags = main.get("panels", {}).get("taglinks", [])
    core = wanted_cards(main)
    themes = {}
    for t in tags:
        page = edhrec_pages.get("%s/%s.json" % (base, t["slug"]))
        if not page:
            continue
        w = wanted_cards(page)
        dist = {n: v for n, v in w.items() if v[0] - core.get(n, (0, 0))[0] >= MIN_LIFT}
        if dist:
            themes[t["slug"]] = {"label": t["value"], "count": t["count"], "wanted": dist}
    return themes, core

def jaccard(a, b):
    u = len(a | b)
    return len(a & b) / u if u else 0.0

def build_plans(themes):
    """Seed a plan at each theme, grow it with its best-overlapping partners, dedupe."""
    slugs = sorted(themes, key=lambda s: -themes[s]["count"])
    plans = []
    for seed in slugs:
        members = [seed]
        pool = set(themes[seed]["wanted"])
        while len(members) < MAX_THEMES:
            best = max(((jaccard(pool, set(themes[o]["wanted"])), o) for o in slugs if o not in members),
                       default=(0, None))
            if best[1] is None or best[0] < OVERLAP_TO_MERGE:
                break
            members.append(best[1])
            pool |= set(themes[best[1]]["wanted"])
        key = frozenset(members)
        if not any(key == p[0] for p in plans):
            plans.append((key, members))
    return [m for _, m in plans]

def plan_report(themes, members, core, owned_names):
    wanted = {}
    for s in members:
        for n, (inc, syn) in themes[s]["wanted"].items():
            if n not in wanted or inc > wanted[n][0]:
                wanted[n] = (inc, syn)
    owned = sorted((n for n in wanted if n in owned_names), key=lambda n: -(wanted[n][0] + wanted[n][1]))
    return {
        "themes": [themes[s]["label"] for s in members],
        "wanted": len(wanted),
        "owned": len(owned),
        "examples": owned[:6],
        "core_owned": sum(1 for n in core if n in owned_names),
        "core_wanted": len(core),
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("fixtures")
    ap.add_argument("commanders", nargs="+")
    ap.add_argument("--owned", default="tools/jxa-harness/owned_raw.json")
    args = ap.parse_args()
    fx = json.load(open(args.fixtures))
    owned_raw = json.load(open(args.owned))
    for commander in args.commanders:
        card = fx["commanderCards"].get(commander)
        if not card:
            print("\n%s: not in fixtures" % commander)
            continue
        colors = set(card.get("color_identity", []))
        legal = [c for c in owned_raw if set(c.get("color_identity", [])) <= colors and c["name"] != commander]
        names = {c["name"] for c in legal} | {c["name"].split(" // ")[0] for c in legal}
        themes, core = load_themes(fx["edhrecPages"], commander)
        print("\n== %s  (%d owned cards in colors)" % (commander, len(legal)))
        if not themes:
            print("   no theme pages with data")
            continue
        reports = [plan_report(themes, m, core, names) for m in build_plans(themes)]
        reports.sort(key=lambda r: -r["owned"])
        if reports:
            print("   core staples: own %d of %d" % (reports[0]["core_owned"], reports[0]["core_wanted"]))
        for r in reports[:MAX_PLANS]:
            print("   %-34s plan-specific: own %2d of %3d  e.g. %s" % (
                " + ".join(r["themes"]), r["owned"], r["wanted"], ", ".join(r["examples"][:4])))

if __name__ == "__main__":
    main()
