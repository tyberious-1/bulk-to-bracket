const fs=require("fs"),vm=require("vm"),path=require("path");
// Usage: node dev/tools/jxa-harness/precon_research/center_report.js DIR "Commander" ... (DIR holds prefetch.json with commanderCards)
const root=path.join(__dirname,"../../../..");
const ctx=vm.createContext({});
for(const f of ["js/constants.js","js/utils/text.js","js/utils/cards.js","js/format.js","js/analysis/abilities.js","js/analysis/engines.js"]) vm.runInContext(fs.readFileSync(path.join(root,f),"utf8"),ctx);
const pc=JSON.parse(fs.readFileSync(process.argv[2]+"/prefetch.json","utf8")).commanderCards;
const names=process.argv.slice(3);
ctx.names=names;ctx.pc=pc;
for(const n of names){const c=pc[n];if(!c){console.log("no",n);continue;}
 const t=c.oracle_text||c.card_faces.map(f=>f.oracle_text).join("\n");
 ctx.t=t;ctx.n=n;
 console.log("\n=== "+n+"\n"+t);
 console.log(vm.runInContext(`JSON.stringify(tagTextAbilities(t,n.split(",")[0]).map(a=>({k:a.kind,trig:a.trigger,cost:a.cost,eff:a.effects.map(e=>e.label+(e.object?":"+e.object:""))})))`,ctx));
 console.log("center:",vm.runInContext(`JSON.stringify(getCommanderCenter([t]))`,ctx));
}
