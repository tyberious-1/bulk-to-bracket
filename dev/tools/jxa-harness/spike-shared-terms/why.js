const { vm, ctx } = require("./setup.js");
ctx.__T = (t) => ({ kind: "tribal", tag: t + "s", label: t, tribe: t });
const out = vm.runInContext(`(function(){
  const s=__T("wizard"), cols=["U","R"];
  const r=buildDeckBottomUp(__cards,{archetype:"midrange",subtype:s,colors:cols});
  const inDeck=new Set(r.deck.map(x=>x.name));
  const rows=[];
  for(const c of __cards){ if(getCardType(c).includes("land"))continue; if(!legalForCommander(c.colors||[],cols,c)||deadForColors(c,cols))continue;
    const a=annotateBottomUpCard(c,s); if(a.standing!=="payoff"&&!(a.standing==="member"&&a.engine))continue;
    rows.push({name:c.name,standing:a.standing,engine:a.engine,role:a.role,isCreature:a.isCreature,cmc:c.cmc,inDeck:inDeck.has(c.name),colors:(c.colors||[]).join("")}) }
  return JSON.stringify({caps:r.report.slots,roles:r.report.roleCounts,rows})})()`, ctx);
const j = JSON.parse(out);
console.log("wizard plan: role caps", JSON.stringify(j.caps), "| role counts", JSON.stringify(j.roles));
for (const r of j.rows) console.log((r.inDeck ? "IN  " : "OUT ") + r.name.padEnd(28) + r.standing.padEnd(8) + ("engine=" + r.engine).padEnd(13) + "role=" + r.role.padEnd(9) + "cmc " + r.cmc + "  " + r.colors);
