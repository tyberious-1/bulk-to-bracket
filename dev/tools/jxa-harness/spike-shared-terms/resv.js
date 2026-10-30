process.env.QUIET = "1";
const fs = require("fs");
const { vm, ctx } = require("./setup.js");
const S = require("./spike.js");
const q = require("./qual.js");
const root = "/Users/seth_burns/xpwd/p_projects/bulk-to-bracket";
// prototype copy of the builder with a payoff reservation after the role loop, before the creature fill
let src = fs.readFileSync(root + "/js/build/bottom-up-deck.js", "utf8");
const anchor = "  // Creatures up to the archetype's count, then theme cards of any type";
if (!src.includes(anchor)) throw new Error("anchor not found");
const patch = `  {
    const isPayoff = (r) => r.a.standing === "payoff" || (r.a.standing === "member" && r.a.engine);
    const payoffRows = pool.filter((row) => isPayoff(row) && canTake(row) && roleOpen(row));
    let want = Math.min(payoffRows.length, PROTO_PAYOFF_MIN) - deck.filter(isPayoff).length;
    for (const row of payoffRows) { if (want <= 0 || deck.length >= nonlandSlots) break; if (canTake(row)) { take(row); want--; } }
  }
`;
src = src.replace(anchor, patch + anchor).replace("function buildDeckBottomUp(", "function buildDeckBottomUpProto(");
ctx.__src = src;
vm.runInContext("var PROTO_PAYOFF_MIN = 5;", ctx);
vm.runInContext("(0,eval)(__src)", ctx); // defines buildDeckBottomUpProto in the same global scope
const T = (t) => ({ kind: "tribal", tag: t + "s", label: t, tribe: t });
ctx.__T = T;
const out = vm.runInContext(`(function(){
  const tribes=[["wizard",["U","R"],"sample"],["vampire",["B","R"],"sample"],["insect",["B","G"],"sample"],["knight",["U","W"],"sample"],["warrior",["R","G"],"held-out"],["soldier",["W","R"],"held-out"],["rogue",["U","B"],"held-out"],["elf",["G","B"],"held-out"],["zombie",["B","U"],"held-out"]];
  const rows=[];
  for(const [t,c,kind] of tribes){ const s=__T(t); const one={};
    for(const [name,fn] of [["before",buildDeckBottomUp],["after",buildDeckBottomUpProto]]){ const r=fn(__cards,{archetype:"midrange",subtype:s,colors:c});
      one[name]={deck:r.deck.map(x=>x.name),fb:r.report.fallbackCount,payoffs:r.report.payoffs,members:r.report.members,creatures:r.report.creatures,roles:r.report.roleCounts} }
    rows.push({t,kind,colors:c,one}) } return JSON.stringify(rows)})()`, ctx);
const rows = JSON.parse(out);

// independent audit measure (same definition as spike2)
function measure(cards) {
  const n = cards.length, linked = new Array(n).fill(false), payoff = new Array(n).fill(false);
  for (let i = 0; i < n; i++) for (const cl of S.rd(cards[i]).clauses) {
    if (!S.okClause(cl)) continue;
    const sup = new Set();
    for (let j = 0; j < n; j++) if (j !== i) for (const t of cl) if (S.rd(cards[j]).makes.has(t)) sup.add(j);
    if (sup.size) { linked[i] = true; sup.forEach((j) => (linked[j] = true)); }
    if (sup.size >= 2) payoff[i] = true;
  }
  return { linked: Math.round(100 * linked.filter(Boolean).length / n), payoffs: payoff.filter(Boolean).length };
}
const R = (r) => `${r.roles.ramp}/${r.roles.draw}/${r.roles.removal}/${r.roles.wipe}`;
console.log("TRIBAL PLANS, midrange. before -> after the payoff reservation (prototype, js/ untouched)");
console.log("plan        kind      linked%     audit-payoffs  builder-payoffs  creatures   placeholders  ramp/draw/removal/wipe");
let worse = 0, better = 0;
for (const { t, kind, one } of rows) {
  const mk = (x) => measure(x.deck.map((nm) => S.byName.get(nm)).filter((c) => c && !q.isLand(c)));
  const b = mk(one.before), a = mk(one.after);
  const dl = a.linked - b.linked, dp = a.payoffs - b.payoffs, df = one.after.fb - one.before.fb;
  const bad = dl < -3 || dp < 0 || df > 0;
  if (bad) worse++; else if (dl > 0 || dp > 0 || df < 0) better++;
  const changed = one.before.deck.filter((x) => !one.after.deck.includes(x)).length;
  console.log(t.padEnd(11), kind.padEnd(9), `${b.linked}->${a.linked}`.padStart(8), `${b.payoffs}->${a.payoffs}`.padStart(13), `${one.before.payoffs}->${one.after.payoffs}`.padStart(17), `${one.before.creatures}->${one.after.creatures}`.padStart(12), `${one.before.fb}->${one.after.fb}`.padStart(11), "   ", R(one.before), "->", R(one.after), bad ? "  <-- REGRESSION" : "", `(${changed} cards swapped)`);
}
console.log("\nplans worse under the design's rule (linked -3+, fewer payoffs, or more placeholders):", worse, "| plans improved:", better, "| of", rows.length);
