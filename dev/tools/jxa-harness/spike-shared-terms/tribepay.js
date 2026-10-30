const { vm, ctx } = require("./setup.js");
const out = vm.runInContext(`(function(){
  const tribes=["wizard","vampire","insect","knight","warrior","soldier","rogue","elf","zombie","goblin","dragon","merfolk","samurai","villain","pirate","hero"];
  const rows=[];
  for(const t of tribes){
    const sub={kind:"tribal",tag:t+"s",label:t,tribe:t};
    const forms=tribeFormsPattern(sub);
    const extra=new RegExp("\\\\b(?:if|as long as|unless) you control (?:an? |another |at least \\\\w+ )?(?:"+forms+")\\\\b|less to cast if you control (?:an? )?(?:"+forms+")|for each (?:"+forms+") you control|number of (?:"+forms+")s? you control|\\\\b(?:"+forms+") spells? you (?:cast|control)");
    let payoff=0, missed=[];
    for(const c of __cards){ if(getCardType(c).includes("land"))continue;
      const st=subtypeStanding(c,sub);
      if(st==="payoff")payoff++;
      else if(st!=="member"){ const text=getCardText(c).replace(new RegExp("\\\\bnon-?(?:"+forms+")\\\\b","g")," ").replace(/\\([^)]*\\)/g," ");
        if(extra.test(text))missed.push(c.name+"["+st+"]") } }
    rows.push({t,payoff,missed:missed.length,ex:missed.slice(0,4)});
  } return JSON.stringify(rows)})()`, ctx);
console.log("tribe       payoffs found now | payoffs the builder's pattern misses (if/as long as you control, costs less if, for each, X spells you cast)");
for (const r of JSON.parse(out)) console.log(r.t.padEnd(10), String(r.payoff).padStart(6), "|", String(r.missed).padStart(4), "  e.g.", r.ex.join("; "));
