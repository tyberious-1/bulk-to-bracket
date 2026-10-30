process.env.QUIET = "1";
const { vm, ctx } = require("./setup.js");
const S = require("./spike.js");
const q = require("./qual.js");
const T = (t, p) => ({ kind: "tribal", tag: p || t + "s", label: t, tribe: t }), H = (t) => ({ kind: "theme", tag: t, label: t });
ctx.__T = T; ctx.__H = H;
const out = vm.runInContext(`(function(){
  const sample=[["vehicles",__H("vehicles"),["W","B"]],["enchantments",__H("enchantments"),["U"]],["wizard",__T("wizard"),["U","R"]],["sacrifice",__H("sacrifice"),["B","R"]],["infect~deathtouch",__H("infect~deathtouch"),["G"]],["vampire",__T("vampire"),["B","R"]],["artifacts",__H("artifacts"),["R","W"]],["spellslinger",__H("spellslinger"),["U","R"]],["insect",__T("insect"),["B","G"]],["lands",__H("lands"),["G","R"]],["knight",__T("knight"),["U","W"]],["graveyard",__H("graveyard"),["U","B"]]];
  const sampleTribes=new Set(["wizard","vampire","insect","knight"]);
  const top2=(cards)=>{const n={};for(const c of cards)for(const x of (c.colors||[]))n[x]=(n[x]||0)+1;return Object.entries(n).sort((a,b)=>b[1]-a[1]).slice(0,2).map(e=>e[0])};
  const tribeCount=new Map();
  for(const c of __cards){if(!getCardType(c).split("—")[0].includes("creature"))continue;for(const s of getCardSubtypes(c))tribeCount.set(s,(tribeCount.get(s)||0)+1)}
  const extra=[];
  for(const [t,n] of [...tribeCount].sort((a,b)=>b[1]-a[1])){ if(extra.filter(e=>e[1].kind==="tribal").length>=5)break; if(sampleTribes.has(t)||n<30||["human","creature","spirit"].includes(t))continue;
    const mem=__cards.filter(c=>getCardType(c).split("—")[0].includes("creature")&&getCardSubtypes(c).includes(t)); extra.push(["x:"+t,__T(t),top2(mem)]) }
  for(const tag of ["tokens","counters","lifegain","blink","voltron"]){ const mem=__cards.filter(c=>bottomUpTags(c).has(tag)); if(mem.length>=40)extra.push(["x:"+tag,__H(tag),top2(mem)]) }
  const res=[];
  for(const [k,s,c] of sample.concat(extra)){ try{ const r=buildDeckBottomUp(__cards,{archetype:"midrange",subtype:s,colors:c}); res.push({k,colors:c,sample:!k.startsWith("x:"),deck:r.deck.map(x=>x.name),fb:r.report.fallbackCount}) }catch(e){ res.push({k,err:String(e)}) } }
  return JSON.stringify(res)})()`, ctx);
const builds = JSON.parse(out);


const med = (a) => { a = a.slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
const pct = (a, p) => { a = a.slice().sort((x, y) => x - y); return a[Math.floor(a.length * p)]; };

// re-run the check set with the final filter (lift + clause weights)
let cp = 0, cn = 0;
for (const k of S.checks) { if (!k.a || !k.b) continue; cn++; const st = S.strongLinks(k.a, k.b).length > 0; if (st === k.want) cp++; else console.log("  CHECK FAIL under final filter:", k.a.name, "x", k.b.name); }
console.log("check set under the final filter:", cp, "of", cn);

// measure: linked = >=1 strong link; payoff = a strong need clause met by >=2 other deck cards;
// engine = a term with >=2 payoffs needing it and >=3 makers in the deck
function measure(cards) {
  const n = cards.length, linked = new Array(n).fill(false), payoff = new Array(n).fill(false);
  const needT = new Map(), makeT = new Map();
  const add = (m, t, i) => { if (!m.has(t)) m.set(t, new Set()); m.get(t).add(i); };
  for (let i = 0; i < n; i++) {
    for (const cl of S.rd(cards[i]).clauses) {
      if (!S.okClause(cl)) continue;
      const sup = new Set();
      for (let j = 0; j < n; j++) if (j !== i) for (const t of cl) if (S.rd(cards[j]).makes.has(t)) { sup.add(j); add(makeT, t, j); }
      if (sup.size) { linked[i] = true; sup.forEach((j) => (linked[j] = true)); }
      if (sup.size >= 2) { payoff[i] = true; for (const t of cl) add(needT, t, i); }
    }
  }
  const engines = [...needT].filter(([t, s]) => s.size >= 2 && (makeT.get(t) || new Set()).size >= 3).map(([t, s]) => [t, s.size, makeT.get(t).size]).sort((a, b) => b[1] + b[2] - a[1] - a[2]);
  return { n, linked: linked.filter(Boolean).length / n, payoffs: payoff.filter(Boolean).length, engines };
}
const pre = S.decks.map((cs) => measure(cs));
const f = (a) => pct(a, .1) + "/" + pct(a, .5) + "/" + pct(a, .9);
const fp = (a) => [pct(a, .1), pct(a, .5), pct(a, .9)].map((x) => x.toFixed(2)).join("/");
console.log("\nPRECON FLOOR (" + pre.length + " decks, p10/p50/p90): linked " + fp(pre.map((m) => m.linked)) + " | payoff cards " + f(pre.map((m) => m.payoffs)) + " | engines " + f(pre.map((m) => m.engines.length)));
console.log("\nBUILDS (midrange, your collection)           cards linked payoffs engines placeholders  engines (term: payoffs/makers)");
const rows = [];
for (const b of builds) {
  if (b.err) { console.log(b.k.padEnd(28), "ERROR", b.err.slice(0, 80)); continue; }
  const cards = b.deck.map((nm) => S.byName.get(nm)).filter((c) => c && !q.isLand(c));
  const m = measure(cards); rows.push({ b, cards, m });
  console.log((b.sample ? "  " : "* ") + b.k.padEnd(26) + b.colors.join("").padEnd(4) + String(cards.length).padStart(5) + (Math.round(m.linked * 100) + "%").padStart(7) + String(m.payoffs).padStart(8) + String(m.engines.length).padStart(8) + String(b.fb).padStart(12) + "   " + m.engines.slice(0, 4).map(([t, a, c]) => t + ":" + a + "/" + c).join(" "));
}
console.log("  (* = strategies outside your 12 sample plans, picked by data)");

// left out: owned cards in the plan's colors that add the most. Reward supplying under-served needs and
// meeting the deck's supply; weights are clause weights, so broad unions no longer swamp the list.
console.log("\nLEFT OUT: top 5 owned cards (plan colors) by the links they would add");
for (const { b, cards } of rows) {
  const inDeck = new Set(b.deck), pool = S.ownedNL.filter((c) => !inDeck.has(c.name) && (c.colors || []).every((x) => b.colors.includes(x)));
  const supply = (cl) => cards.filter((d) => [...cl].some((t) => S.rd(d).makes.has(t))).length;
  const need = cards.map((d) => S.rd(d).clauses.filter((cl) => S.okClause(cl)).map((cl) => ({ cl, m: supply(cl) })));
  const sc = pool.map((c) => {
    let s = 0; const why = new Set();
    for (const cl of S.rd(c).clauses) { if (!S.okClause(cl)) continue; const m = supply(cl); if (m) { s += S.clauseIdf(cl) * Math.log(1 + m); [...cl].filter((t) => cards.some((d) => S.rd(d).makes.has(t))).forEach((t) => why.add(t)); } }
    cards.forEach((d, i) => need[i].forEach(({ cl, m }) => { if (m <= 3 && [...cl].some((t) => S.rd(c).makes.has(t))) { s += S.clauseIdf(cl); [...cl].filter((t) => S.rd(c).makes.has(t)).forEach((t) => why.add(t)); } }));
    return { c, s, why: [...why].slice(0, 3).join("/") };
  }).sort((x, y) => y.s - x.s);
  console.log("  " + b.k.padEnd(20) + sc.slice(0, 5).map((x) => x.c.name.slice(0, 22) + "[" + x.why + "]").join("; "));
}
