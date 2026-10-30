#!/usr/bin/env python3
"""Synergy density: how much of a build concentrates the commander's own engine.

Independent of EDHREC and of the builder's scorer. For each commander it reads
the commander's rules text, extracts the engine terms it names (creature types,
card types, mechanics), drops the commander's own keyword line and terms that
most cards match, then measures the share of the deck's nonland cards that
touch any remaining term -- against the share of a random legal pick from the
same collection ("random pool"). Their ratio is the lift. A lift near 1 means
the deck is no more on-engine than chance; the builder reached about 4x on the
full collection and about 2x on a 10% slice (2026-10-13).

Coarse by design: a term is a word, not a pair of cards that work together, and
commanders whose text names no usable term (about 1 in 5) are skipped.

Usage:
  python3 dev/tools/jxa-harness/synergy_measure.py DECKS.json [--slice 0.1]
              [--fixtures dev/tools/jxa-harness/prefetch_data.json]
              [--owned dev/tools/jxa-harness/owned_raw.json]
DECKS.json is {commander: {variant: [card names]}}, e.g. from dump_decks.js.
--slice must match the SAMPLE_FRACTION the decks were built with (same seeded
random subset), so the random pool is the collection the builder actually saw.
"""
import argparse
import collections
import json
import re
import statistics as st

ap = argparse.ArgumentParser()
ap.add_argument("decks")
ap.add_argument("--slice", type=float, default=1.0)
ap.add_argument("--fixtures", default="dev/tools/jxa-harness/prefetch_data.json")
ap.add_argument("--owned", default="dev/tools/jxa-harness/owned_raw.json")
ARGS = ap.parse_args()
FIXTURES, OWNED = ARGS.fixtures, ARGS.owned

pf=json.load(open(FIXTURES))['commanderCards']
raw_all=json.load(open(OWNED))
friend=[]
def oracle(c):
    if c.get('oracle_text'): return c['oracle_text']
    return "\n".join(f.get('oracle_text','') for f in c.get('card_faces',[]))
def typeline(c): return (c.get('type_line') or '').lower()
subtypes=set()
for c in raw_all+friend:
    tl=typeline(c)
    if '—' in tl: subtypes|={w for w in re.findall(r"[a-z]+",tl.split('—',1)[1])}
CARD_TYPES={'instant','sorcery','artifact','enchantment','planeswalker','battle','legendary','historic','noncreature'}
MECH=["token","counter","+1/+1","sacrifice","graveyard","exile","draw","discard","mill","flying","haste","trample","deathtouch","lifelink","vigilance","menace","reach","first strike","double strike","equip","aura","vehicle","treasure","food","clue","blood","copy","cast","attack","combat","life","landfall","dies","enters","proliferate","amass","investigate","connive","surveil","scry","power","untap","tap","draw a card","goad","monarch","energy","storm","flash","ward","indestructible","regenerate","bounce","return","shuffle","search","library","hand","opponent"]
def singular(w):
    if w.endswith('ves'): return w[:-3]+'f'
    if w.endswith('ies'): return w[:-3]+'y'
    if w.endswith('ses') or w.endswith('xes'): return w[:-2]
    if w.endswith('s') and not w.endswith('ss'): return w[:-1]
    return w
def clean(t): return re.sub(r'\([^)]*\)','',t.lower())
GENERIC={'cast','enters','hand','return','opponent','life','attack','combat','tap','untap','power','search','library','shuffle','draw','draw a card','reach','scry','surveil','copy','counter'}
SELF_KW={'flying','haste','trample','deathtouch','lifelink','vigilance','menace','reach','first strike','double strike','flash','ward','indestructible','hexproof','defender','protection','regenerate'}
def engine_candidates(cmd_text):
    lines=[l for l in cmd_text.lower().split('\n')]
    keep=[]
    selfkw=set()
    for l in lines:
        parts=[p.strip() for p in re.split(r'[,;]',clean(l)) if p.strip()]
        if parts and all(p in SELF_KW or p.split(' ')[0] in SELF_KW for p in parts):
            selfkw|={p for p in parts}|{p.split(' ')[0] for p in parts}
        else: keep.append(l)
    t=clean("\n".join(keep)); words={singular(w) for w in re.findall(r"[a-z]+",t)}
    terms=set()
    for w in words:
        if w in subtypes and w not in ('human','you'): terms.add(w)
        if w in CARD_TYPES: terms.add(w)
    for m in MECH:
        if m in t: terms.add(m)
    return {x for x in terms if x not in GENERIC and x not in selfkw}
def matcher(term):
    rx=re.compile(r'\b'+re.escape(term)+r'(s|es)?\b')
    def f(card_tl,card_tx):
        return bool(rx.search(card_tl)) or bool(rx.search(card_tx))
    return f
def prep(cards):
    return [(typeline(c),clean(oracle(c)),c) for c in cards]
def legal(c,colors): return set(c.get('color_identity',[]))<=set(colors) and 'land' not in typeline(c)
def mulberry(a):
    a&=0xffffffff
    def nxt():
        nonlocal a
        a=(a+0x6D2B79F5)&0xffffffff
        t=a
        t=((t^(t>>15))*(t|1))&0xffffffff
        t=(t^((t+(((t^(t>>7))*(t|61))&0xffffffff))&0xffffffff))&0xffffffff
        return ((t^(t>>14))&0xffffffff)/4294967296
    return nxt
def slice_owned(frac):
    if frac>=1: return raw_all
    r=mulberry(12345); return [c for c in raw_all if r()<frac]

def commander_card(name): return pf[name]
def analyze(frac,decks_by_variant):
    owned=slice_owned(frac); by_name={c['name']:c for c in owned}
    for c in owned: by_name.setdefault(c['name'].split(' // ')[0],c)
    res=collections.defaultdict(list); info={}
    for name,variants in decks_by_variant.items():
        cc=pf[name]; colors=cc.get('color_identity',[])
        cand=engine_candidates(oracle(cc))
        pool=[c for c in owned if legal(c,colors) and c['name']!=name]
        prepped=prep(pool)
        if len(prepped)<30: continue
        kept=[]
        for t in cand:
            m=matcher(t); freq=sum(1 for tl,tx,_ in prepped if m(tl,tx))/len(prepped)
            if 0.003<=freq<=0.20: kept.append((t,m,freq))
        if not kept: continue
        def dens(names):
            cards=[by_name[n] for n in names if n in by_name]
            if not cards: return None
            hit=0
            for c in cards:
                tl,tx=typeline(c),clean(oracle(c))
                if any(m(tl,tx) for _,m,_ in kept): hit+=1
            return hit/len(cards)
        p0=sum(1 for tl,tx,_ in prepped if any(m(tl,tx) for _,m,_ in kept))/len(prepped)
        info[name]=(sorted(t for t,_,_ in kept),p0)
        for v,names in variants.items():
            d=dens(names)
            if d is not None: res[v].append((name,d,p0))
    return res,info
def summary(res,label):
    out=[]
    for v in res:
        R=res[v]; d=st.mean(x[1] for x in R); p0=st.mean(x[2] for x in R)
        lift=st.mean(x[1]/x[2] for x in R if x[2]>0)
        out.append((v,len(R),d,p0,lift,sum(1 for x in R if x[2]>0 and x[1]/x[2]>=2)))
    print("\n%s"%label)
    print("  %-30s %-9s %-14s %-14s %-12s %s"%("variant","commanders","deck density","random pool","avg lift","lift>=2"))
    for v,n,d,p0,l,k in out: print("  %-30s %-9d %-14.2f %-14.2f %-12.2f %d/%d"%(v,n,d,p0,l,k,n))

if __name__ == "__main__":
    decks = json.load(open(ARGS.decks))
    res, info = analyze(ARGS.slice, decks)
    summary(res, "SYNERGY DENSITY (slice %.0f%% of the collection)" % (ARGS.slice * 100))
    skipped = [n for n in decks if n not in info]
    print("\n%d of %d commanders had no usable engine terms and were skipped." % (len(skipped), len(decks)))
