// node plan_turns.js <log>  -- per deck, per own turn: spells, attackers, cards drawn, commander triggers, named token creations, energy events (Saheeli only)
const fs=require("fs");const file=process.argv[2];
const {shortName:short}=require("./common");
const M=["spells","attackers","drawn","cmdTrig","tokens","energy","cmdCast"];
let game=null,own={},cur=null;const games=[];
const slot=(p)=>{ if(!game.per[p])game.per[p]={}; const k=own[p]||0; if(!k) return null; return game.per[p][k]||(game.per[p][k]=Object.fromEntries(M.map(m=>[m,0]))); };
for(const l of fs.readFileSync(file,"utf8").split("\n")){
  let m;
  if(/^Turn: Turn 1 \(/.test(l)){game={per:{},dead:{}};games.push(game);own={};cur=null;}
  if(!game)continue;
  if((m=l.match(/^Turn: Turn \d+ \(Ai\(\d\)-(.+)\)$/))){cur=short(m[1]);own[cur]=(own[cur]||0)+1;slot(cur);continue;}
  if(!cur)continue;
  if((m=l.match(/^Add To Stack: Ai\(\d\)-(.+?) cast /))){const s=slot(short(m[1]));if(s){s.spells++; if(/^Add To Stack: Ai\(\d\)-(.+?) cast \1( |$)/.test(l)) s.cmdCast++;}continue;}
  if((m=l.match(/^Add To Stack: Ai\(\d\)-(.+?) triggered (.+?)( targeting.*)?$/))){ if(m[1]===m[2]){const s=slot(short(m[1]));if(s)s.cmdTrig++;} continue;}
  if((m=l.match(/^Combat: Ai\(\d\)-(.+?) assigned (.+) to attack/))){const s=slot(short(m[1]));if(s)s.attackers+=(m[2].match(/\(\d+\)/g)||[]).length;continue;}
  if((m=l.match(/^Resolve Stack: .*Ai\(\d\)-(.+?) (draws (a|two|three|\d+) cards?|creates )/))){const s=slot(short(m[1]));if(s){ if(m[2].startsWith("draws")) s.drawn+=({a:1,two:2,three:3}[m[3]]||+m[3]); else s.tokens++; }continue;}
  if(/^Resolve Stack:.*\{E\}.*you get|^Resolve Stack:.*get.*\{E\}/.test(l)&&/you get|get \w+ \{E\}|you get an amount/.test(l)){const s=slot("Saheeli");if(s)s.energy++;continue;}
  if((m=l.match(/^Life: Life: Ai\(\d\)-(.+?) (-?\d+) > (-?\d+)$/))&&+m[3]<=0&&!game.dead[short(m[1])])game.dead[short(m[1])]=own[short(m[1])];
}
const decks=[...new Set(games.flatMap(g=>Object.keys(g.per)))];
for(const d of decks){
  console.log("\n### "+d+"   (avg over games still alive on that own turn; n in last row)");
  console.log("turn  "+M.map(x=>x.padEnd(9)).join("")+" n");
  for(let t=1;t<=10;t++){
    const rows=games.map(g=>g.per[d]&&g.per[d][t]).filter(Boolean);
    if(!rows.length)break;
    console.log(String(t).padEnd(6)+M.map(x=>(rows.reduce((a,r)=>a+r[x],0)/rows.length).toFixed(1).padEnd(9)).join("")+" "+rows.length);
  }
  const first=games.map(g=>{const p=g.per[d]||{};const t=Object.keys(p).find(k=>p[k].attackers>=3);return t?+t:null;});
  console.log("first own turn with 3+ attackers per game:",JSON.stringify(first));
  console.log("own turns survived per game:",JSON.stringify(games.map(g=>g.dead[d]||"won/alive")));
}
