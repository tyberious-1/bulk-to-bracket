
// Ad-hoc driver (not part of the committed suites): archetype separation (measure 1) and
// collection coverage on thinner collections (measure 2) for a few subtype/color picks.
// Usage: see the top of dump_decks.js; this file runs after combined.js.

function jxaPrint(s) {
  $.NSFileHandle.fileHandleWithStandardOutput.writeData(
    $.NSString.alloc.initWithUTF8String(s + "\n").dataUsingEncoding($.NSUTF8StringEncoding));
}
function readJsonFile(path) {
  const data = $.NSData.dataWithContentsOfFile($.NSString.alloc.initWithString(path).stringByStandardizingPath.js);
  return JSON.parse($.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding).js);
}
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const PICKS = [
  { subtype: { kind: "tribal", tag: "zombies", label: "Zombies", tribe: "zombie" }, colors: ["B"] },
  { subtype: { kind: "tribal", tag: "zombies", label: "Zombies", tribe: "zombie" }, colors: ["U", "B"] },
  { subtype: { kind: "tribal", tag: "elves", label: "Elves", tribe: "elf" }, colors: ["G"] }
];
const FRACTIONS = [1, 0.5, 0.25];
const ownedAll = readJsonFile("dev/tools/jxa-harness/owned_raw.json");

for (const fraction of FRACTIONS) {
  const rng = mulberry32(12345);
  const cards = (fraction >= 1 ? ownedAll : ownedAll.filter(() => rng() < fraction)).map(convertScryfallCard);
  for (const pick of PICKS) {
    for (const archetype of ARCHETYPE_ORDER) {
      const { report } = buildDeckBottomUp(cards, { archetype, subtype: pick.subtype, colors: pick.colors });
      jxaPrint("BU " + JSON.stringify({
        fraction, subtype: pick.subtype.tag, colors: pick.colors.join(""), archetype,
        creatures: report.creatures, avgCmc: report.avgCmc, roles: report.roleCounts,
        members: report.members, payoffs: report.payoffs, mentions: report.mentions,
        fallback: report.fallbackCount, shortfalls: report.shortfalls
      }));
    }
  }
}
