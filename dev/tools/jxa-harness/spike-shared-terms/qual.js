const fs=require("fs"),vm=require("vm"),path=require("path");
const root="/Users/seth_burns/xpwd/p_projects/bulk-to-bracket";
const ctx=vm.createContext({console});
for(const f of ["js/constants.js","js/utils/text.js","js/utils/cards.js","js/format.js","js/analysis/themes.js","js/analysis/abilities.js","js/analysis/scoring.js","js/analysis/engines.js"])
  vm.runInContext(fs.readFileSync(path.join(root,f),"utf8"),ctx,{filename:f});
vm.runInContext(fs.readFileSync(path.join(root,"dev/tools/jxa-harness/connections.js"),"utf8")+"\nthis.linkOf=linkOf;this.CHANNEL_UNIVERSAL=CHANNEL_UNIVERSAL;",ctx,{filename:"connections.js"});
const {linkOf,CHANNEL_UNIVERSAL}=ctx;
const getAbs=vm.runInContext("getCardAbilities",ctx);

// normalise any source card to {name,type_line,oracle_text,subs[]}
function norm(c,src){
  if(src==="scry"){
    const faces=c.card_faces&&!c.oracle_text?c.card_faces:[c];
    return {name:c.name,type_line:c.type_line,oracle_text:faces.map(f=>f.oracle_text||"").join("\n"),colors:c.color_identity};
  }
  return {name:c.name,type_line:c.type,oracle_text:c.text||"",colors:c.colorIdentity};
}
const subsOf=c=>{const t=(c.type_line||"").split(" // ")[0];const p=t.split("—");return (p[1]||"").trim().toLowerCase().split(/\s+/).filter(Boolean)};
const isCreature=c=>/creature/i.test((c.type_line||"").split(" // ")[0]);
const isLand=c=>/\bland\b/i.test((c.type_line||"").split(" // ")[0])&&!/creature/i.test(c.type_line);

function singular(w){const o=[w];if(w.endsWith("s"))o.push(w.slice(0,-1));if(w.endsWith("ves"))o.push(w.slice(0,-3)+"f",w.slice(0,-3)+"fe");if(w.endsWith("ies"))o.push(w.slice(0,-3)+"y");if(w.endsWith("men"))o.push(w.slice(0,-3)+"man");return o}
const STOP=new Set(["creature","artifact","enchantment","land","player","spell","card","token","permanent","source","opponent","aura","equipment","vehicle","you","control","another","other","one","more","or","and","a","an","the","each","that","this","is","are","dies","die","enters","attacks","attack","alone","cast","with","nontoken","creatures","wizard"].filter(x=>x!=="wizard"));
let CTYPES=new Set();
function filtersOf(clause){
  const f=[];const w=clause.toLowerCase();
  if(/\bnontoken\b/.test(w))f.push("nontoken");
  if(/attacks? alone/.test(w))f.push("alone");
  if(/\+1\/\+1 counter|with a counter|modified/.test(w))f.push("counter");
  if(/an opponent|opponent controls|opponents? control/.test(w))f.push("opp");
  if(/second|first time each turn|third/.test(w))f.push("nth");
  const words=w.replace(/[^a-z' -]/g," ").split(/\s+/).filter(Boolean);
  const tribes=new Set();
  for(const x of words){ if(STOP.has(x))continue; for(const v of singular(x)) if(CTYPES.has(v)){tribes.add(v);break} }
  for(const t of tribes)f.push("tribe:"+t);
  return f;
}
// whole-card gives/wants (base), plus wants carrying their trigger filters
function readCard(c){
  const base=linkOf(c,CTYPES_ALL);
  const wantsQ=[];const covered=new Set();
  for(const ab of getAbs(c)){
    if(ab.kind!=="triggered")continue;
    const clause=ab.line.replace(/^[A-Za-z' ]+ — /,"").split(",")[0];
    const pseudo={name:c.name+"#"+Math.random().toString(36).slice(2,7),type_line:c.type_line,oracle_text:ab.line.replace(/~/g,c.name.split(",")[0])};
    let l;try{l=linkOf(pseudo,CTYPES_ALL)}catch(e){continue}
    for(const w of l.wants){ if(w.startsWith("type:")||CHANNEL_UNIVERSAL.has(w))continue; covered.add(w); wantsQ.push({ch:w,f:/^(?:when|whenever) (?:this |~)/i.test(clause)?[]:filtersOf(clause)}) }
  }
  for(const w of base.wants) if(!covered.has(w)) wantsQ.push({ch:w,f:[]});
  return {gives:base.gives,wants:base.wants,wantsQ};
}
let CTYPES_ALL=new Set();
function setTypes(cards){CTYPES=new Set();CTYPES_ALL=new Set();for(const c of cards){const s=subsOf(c);for(const x of s){CTYPES_ALL.add(x); if(isCreature(c))CTYPES.add(x)}}}
module.exports={norm,subsOf,isCreature,isLand,readCard,setTypes,CHANNEL_UNIVERSAL,getCtypes:()=>CTYPES};
module.exports.abs=c=>getAbs(c);
module.exports.pseudoRead=(c,a)=>{const p={name:c.name+"#"+Math.random().toString(36).slice(2,7),type_line:c.type_line,oracle_text:a.line.replace(/~/g,c.name.split(",")[0])};try{return linkOf(p,CTYPES_ALL)}catch(e){return {gives:new Set(),wants:new Set()}}};
