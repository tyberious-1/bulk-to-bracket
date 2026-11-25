// node win_cards.js <log> -- per deck: for games it won vs lost, which cards cast, which damaged the opponent player, what its plan triggers did
const fs=require("fs");
const {shortName:short}=require("./common");
let games=[],g=null;
for(const l of fs.readFileSync(process.argv[2],"utf8").split("\n")){
  let m;
  if(/^Turn: Turn 1 \(/.test(l)&&(!g||g.done)){g={cast:{},dmg:{},done:false,winner:null,kills:{}};games.push(g);}
  if(!g||g.done)continue;
  if((m=l.match(/^Game Result: .*? in \d+ ms\. (.+?) has won/))){g.winner=short(m[1]);g.done=true;continue;}
  if((m=l.match(/^Add To Stack: (Ai\(\d\)-.+?) cast (.+?)(?: targeting \[.*\])?$/))){const p=short(m[1]);(g.cast[p]=g.cast[p]||{});g.cast[p][m[2]]=(g.cast[p][m[2]]||0)+1;}
  // combat damage to a player: the source card belongs to the OTHER player; we attribute by who the target is not
  if((m=l.match(/^Damage: (.+?) \(\d+\) deals (\d+) combat damage to Ai\(\d\)-(.+?)\.$/))){const tgt=short(m[3]);(g.dmg[tgt]=g.dmg[tgt]||{});g.dmg[tgt][m[1]]=(g.dmg[tgt][m[1]]||0)+1;}
}
games=games.filter(x=>x.done);
const decks=["Shelob","Sethron"];
for(const d of decks){
  const other=decks.find(x=>x!==d);
  const W=games.filter(x=>x.winner===d),L=games.filter(x=>x.winner===other);
  console.log(`\n######## ${d}: won ${W.length}, lost ${L.length}`);
  // cards cast in wins vs losses: number of games (of that group) with >=1 cast
  const cnt=(G)=>{const c={};for(const x of G){for(const k of Object.keys((x.cast[d]||{})))c[k]=(c[k]||0)+1;}return c;};
  const cw=cnt(W),cl=cnt(L);
  const rows=Object.keys({...cw,...cl}).map(k=>({k,w:(cw[k]||0)/Math.max(1,W.length),l:(cl[k]||0)/Math.max(1,L.length),wn:cw[k]||0,ln:cl[k]||0}));
  console.log("cards cast more often in wins than losses (share of games; need to have been cast in >=4 wins):");
  rows.filter(r=>r.wn>=4).sort((a,b)=>(b.w-b.l)-(a.w-a.l)).slice(0,10).forEach(r=>console.log(`  ${r.k.padEnd(34)} wins ${r.wn}/${W.length}  losses ${r.ln}/${L.length}`));
  // damage dealt TO the other deck's player, by source card, in this deck's wins
  const dm={};for(const x of W){for(const [k,v] of Object.entries(x.dmg[other]||{}))dm[k]=(dm[k]||0)+v;}
  console.log("combat-damage events dealt to the opponent in its wins, by source (counts of hits, not amounts):");
  Object.entries(dm).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([k,v])=>console.log(`  ${k.padEnd(34)} ${v}`));
}
