const fs=require("fs");
const H={headers:{"User-Agent":"bulk-to-bracket-test"}};
(async()=>{
  const list=(await (await fetch("https://mtgjson.com/api/v5/DeckList.json",H)).json()).data
    .filter(x=>x.type==="Commander Deck"&&x.releaseDate>="2022-01-01");
  const out=[];
  for(const x of list){
    try{
      const d=(await (await fetch(`https://mtgjson.com/api/v5/decks/${x.fileName}.json`,H)).json()).data;
      const slim=c=>({name:c.name,count:c.count||1,type:c.type,types:c.types,subtypes:c.subtypes,text:c.text||"",manaValue:c.manaValue,colorIdentity:c.colorIdentity,layout:c.layout,faceName:c.faceName});
      out.push({name:x.name,year:x.releaseDate.slice(0,4),commander:(d.commander||[]).map(slim),main:(d.mainBoard||[]).map(slim)});
    }catch(e){}
  }
  fs.writeFileSync("precon_full.json",JSON.stringify(out));
  console.log(out.length,"decks");
})();
