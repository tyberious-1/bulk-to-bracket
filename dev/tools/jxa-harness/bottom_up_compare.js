
// Measure 3: bottom-up midrange vs the commander-first baseline for the same tribe and colors.
// Overlap is the share of the baseline's nonland cards that the bottom-up deck also picked.

function jxaPrint(s) {
  $.NSFileHandle.fileHandleWithStandardOutput.writeData(
    $.NSString.alloc.initWithUTF8String(s + "\n").dataUsingEncoding($.NSUTF8StringEncoding));
}
function readJsonFile(path) {
  const data = $.NSData.dataWithContentsOfFile($.NSString.alloc.initWithString(path).stringByStandardizingPath.js);
  return JSON.parse($.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding).js);
}

const owned = readJsonFile("dev/tools/jxa-harness/owned_raw.json").map(convertScryfallCard);
const prefetch = readJsonFile("dev/tools/jxa-harness/prefetch_data.json");
const baseline = readJsonFile("dev/tools/jxa-harness/baselines/2026-10-15-after-events.json");

for (const key of Object.keys(baseline)) {
  const commanderRaw = prefetch.commanderCards[key.split(" + ")[0]];
  if (!commanderRaw) continue;
  const commander = convertScryfallCard(commanderRaw);
  const tribes = getCardSubtypes(commander);
  const colors = commanderRaw.color_identity || [];
  for (const tribe of tribes) {
    const members = owned.filter((c) => getCardSubtypes(c).includes(tribe) && legalForCommander(c.colors || [], colors, c));
    if (members.length < 10) continue;
    const subtype = { kind: "tribal", tag: tribe + "s", label: tribe, tribe };
    const { deck, report } = buildDeckBottomUp(owned, { archetype: "midrange", subtype, colors });
    const names = new Set(deck.map((c) => c.name));
    const base = baseline[key].current.filter((n) => owned.some((c) => c.name === n && !getCardType(c).includes("land")));
    const shared = base.filter((n) => names.has(n)).length;
    jxaPrint("CMP " + JSON.stringify({
      commander: key, tribe, colors: colors.join(""), baselineNonland: base.length,
      overlap: base.length ? +(shared / base.length).toFixed(2) : 0,
      bottomUpCreatures: report.creatures, avgCmc: report.avgCmc, fallback: report.fallbackCount
    }));
  }
}
