const fs=require("fs");const {isCommanderCast}=require("./common");const lines=fs.readFileSync(process.argv[2],"utf8").split("\n");
const strip=n=>n.replace(/^Ai\(\d+\)-/,"").replace(/,.*$/,"").replace(/^High Perfect /,"");
let games=[],g=null;
for(const l of lines){
 if(/^Turn: Turn 1 \(/.test(l)&&(!g||g.done)){g={n:games.length+1,turnLines:0,draws:{},drawSrc:{},trigDraws:{},trigSrc:{},lastTrig:null,ccast:{},cdeath:{},atk:{},cdmg:{},life:{},min:{},casts:{},dmgOut:{},spells:{},targeted:[],cmdByCard:{},done:false};games.push(g);}
 if(!g||g.done)continue;
 let m;
 if(/^Turn: /.test(l))g.turnLines++;
 if((m=l.match(/^Game Result: .*? in (\d+) ms\. Ai\(\d\)-(.+?) has won/))){g.ms=+m[1];g.win=strip(m[2]);g.done=true;}
 if((m=l.match(/^Resolve Stack: (.+?) \(\d+\) - (?:.*?)Ai\(\d\)-([^,]+)(?:, [^ ]+(?: [^ ]+)*?)? draws (\w+) cards?/))){const p=strip("Ai(1)-"+m[2]);const k={a:1,one:1,two:2,three:3,four:4,five:5}[m[3]]||+m[3]||1;g.draws[p]=(g.draws[p]||0)+k;g.drawSrc[p]=g.drawSrc[p]||{};g.drawSrc[p][m[1]]=(g.drawSrc[p][m[1]]||0)+k;}
 // Triggered draws ("When X enters, draw a card") name no player on the Resolve line: attribute them to the controller on the preceding "triggered" line.
 if((m=l.match(/^Add To Stack: Ai\(\d\)-(.+?) triggered /)))g.lastTrig=strip("Ai(1)-"+m[1]);
 else if(/^Resolve Stack: (When|Whenever|At the beginning)/.test(l)&&g.lastTrig){
  const t=l.replace(/\([^)]*\)/g,"").replace(/\[.*$/,"");
  if(!/\bthen if\b|each player|target (player|opponent)|each opponent|an opponent draws|opponent draws/i.test(t)){
   const d=t.match(/\bdraws? (a|one|two|three|four|X|\d+|a card for each[^.,]*|cards equal)\b/i);
   if(d){const k={a:1,one:1,two:2,three:3,four:4}[d[1].toLowerCase()]||(/^\d+$/.test(d[1])?+d[1]:1);const src=(t.match(/^Resolve Stack: (?:When|Whenever|At the beginning of)\s+(.{0,40})/)||[,"?"])[1];
    g.trigDraws[g.lastTrig]=(g.trigDraws[g.lastTrig]||0)+k;g.trigSrc[g.lastTrig]=g.trigSrc[g.lastTrig]||{};g.trigSrc[g.lastTrig][src]=(g.trigSrc[g.lastTrig][src]||0)+k;}
  }
  g.lastTrig=null;
 }
 if((m=l.match(/^Combat: Ai\(\d\)-(.+?) assigned .* to attack Ai\(\d\)-(.+?)\.$/))){const a=strip("Ai(1)-"+m[1]),d=strip("Ai(1)-"+m[2]);const k=a+">"+d;g.atk[k]=(g.atk[k]||0)+1;}
 if((m=l.match(/^Add To Stack: Ai\(\d\)-(.+?) cast (.+?)(?: targeting \[(.+?)\])?$/))){const p=strip("Ai(1)-"+m[1]);g.spells[p]=(g.spells[p]||0)+1;if(m[3])g.targeted.push(p+": "+m[2]+" -> "+m[3].slice(0,60));if(isCommanderCast(m[1],m[2])){g.ccast[p]=(g.ccast[p]||0)+1;(g.cmdByCard[m[2]]=g.cmdByCard[m[2]]||new Set()).add(p);}}
 if((m=l.match(/^Zone Change: (.+?) \(\d+\) was put into (Graveyard|Exile|Command Zone|Hand|Library)\w* from Battlefield/))&&g.cmdByCard[m[1]]){const who=[...g.cmdByCard[m[1]]];const p=who.length===1?who[0]:m[1]+" (shared name)";g.cdeath[p]=(g.cdeath[p]||0)+1;}
 if((m=l.match(/^Life: Life: Ai\(\d\)-(.+?) (-?\d+) > (-?\d+)$/))){const p=strip("Ai(1)-"+m[1]);g.life[p]=+m[3];g.min[p]=Math.min(g.min[p]===undefined?99:g.min[p],+m[3]);}
 if((m=l.match(/^Damage: (.+?) \(\d+\) deals (\d+) (combat |non-combat )?damage to Ai\(\d\)-(.+?)\.$/))){}
}
for(const x of games){
 console.log(`\n=== GAME ${x.n}: winner ${x.win}, ${(x.ms/1000).toFixed(0)} s, ${x.turnLines} turn lines`);
 console.log(" spells cast:",JSON.stringify(x.spells));
 console.log(" commander casts:",JSON.stringify(x.ccast)," commander left battlefield:",JSON.stringify(x.cdeath));
 console.log(" cards drawn by effects:",JSON.stringify(x.draws));
 console.log(" draw triggers resolved (approx: counts the printed amount, not whether a conditional or 'may' draw happened):",JSON.stringify(x.trigDraws));
 for(const p in x.trigSrc)console.log("   ",p,JSON.stringify(x.trigSrc[p]));
 for(const p in x.drawSrc)console.log("   ",p,JSON.stringify(x.drawSrc[p]));
 console.log(" attacks (attacker>defender, creature-declarations):",JSON.stringify(x.atk));
 console.log(" lowest life reached:",JSON.stringify(x.min));
 console.log(" targeted spells:\n   "+x.targeted.join("\n   "));
}
