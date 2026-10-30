// Bottom-up audit (not part of the committed dev/tests/jxa suite): builds the bottom-up deck for each
// sample strategy at each archetype and checks it against the reference ranges in plan_targets.json
// (measured from EDHREC average decks and Commander precons; see its _notes), plus mechanic checks that
// need no reference: placeholders left, vehicle count against creatures, crew coverage, payload lands.
// Ranges are judged on midrange; aggro and control are printed for reading, since their mix shifts on purpose.
//
// Usage: bash dev/tools/jxa-harness/build_harness.sh OUT/h.js
//        cat OUT/h.js dev/tools/jxa-harness/bottom_up_audit.js > OUT/run.js && osascript -l JavaScript OUT/run.js
// Optional global before the script: ONLY_STRATEGIES = ["vehicles", "vampire"] limits the run.

function jxaPrint(s) {
  $.NSFileHandle.fileHandleWithStandardOutput.writeData(
    $.NSString.alloc.initWithUTF8String(s + "\n").dataUsingEncoding($.NSUTF8StringEncoding));
}
function readJsonFile(path) {
  const data = $.NSData.dataWithContentsOfFile($.NSString.alloc.initWithString(path).stringByStandardizingPath.js);
  return JSON.parse($.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding).js);
}
const T = (tribe, plural) => ({ kind: "tribal", tag: (plural || tribe + "s"), label: tribe, tribe });
const H = (tag) => ({ kind: "theme", tag, label: tag });
// [target key, subtype, colors] -- the strategies of the sample commanders
const PLANS = [
  ["vehicles", H("vehicles"), ["W", "B"]],
  ["enchantments", H("enchantments"), ["U"]],
  ["wizard", T("wizard"), ["U", "R"]],
  ["sacrifice", H("sacrifice"), ["B", "R"]],
  ["infect~deathtouch", H("infect~deathtouch"), ["G"]],
  ["vampire", T("vampire"), ["B", "R"]],
  ["artifacts", H("artifacts"), ["R", "W"]],
  ["spellslinger", H("spellslinger"), ["U", "R"]],
  ["insect", T("insect"), ["B", "G"]],
  ["lands", H("lands"), ["G", "R"]],
  ["knight", T("knight"), ["U", "W"]],
  ["graveyard", H("graveyard"), ["U", "B"]]
];
const targets = readJsonFile("dev/tools/jxa-harness/plan_targets.json").bottomUp;
const cards = readJsonFile("dev/tools/jxa-harness/owned_raw.json").map(convertScryfallCard);

function frontOf(card) { return getCardType(card).split("—")[0]; }

function measure(deck, report, archetype, colors) {
  const nonlands = deck.filter((c) => !frontOf(c).includes("land"));
  const noncreature = (kind) => nonlands.filter((c) => frontOf(c).includes(kind) && !frontOf(c).includes("creature")).length;
  return {
    creatures: nonlands.filter((c) => frontOf(c).includes("creature")).length,
    members: report.members,
    vehicles: nonlands.filter((c) => getCardType(c).includes("vehicle") && !frontOf(c).includes("creature")).length,
    enchantments: noncreature("enchantment"),
    artifacts: noncreature("artifact"),
    instSorc: nonlands.filter((c) => /instant|sorcery/.test(frontOf(c))).length,
    lands: bottomUpLandCount(archetype, colors),
    placeholders: report.fallbackCount
  };
}

function rangeFlag(value, range) {
  if (!range) return "";
  if (value < range[0]) return " LOW(" + range[0] + "-" + range[1] + ")";
  if (value > range[1]) return " HIGH(" + range[0] + "-" + range[1] + ")";
  return " ok";
}

function mechanicChecks(deck, subtype) {
  const out = [];
  if (subtype.tag !== "vehicles") return out;
  const nonlands = deck.filter((c) => !frontOf(c).includes("land"));
  const creatures = nonlands.filter((c) => frontOf(c).includes("creature"));
  const vehicles = nonlands.filter((c) => getCardType(c).includes("vehicle") && !frontOf(c).includes("creature"));
  const limit = Math.floor(creatures.length / BOTTOM_UP_CREATURES_PER_VEHICLE);
  out.push("vehicles " + vehicles.length + " vs creatures " + creatures.length + " (ceiling " + limit + "): " + (vehicles.length <= limit ? "ok" : "OVER"));
  const crewers = creatures.map((c) => getCrewPower(c)).filter((p) => !(p < 0));
  const bad = vehicles.filter((v) => {
    const m = /crew (\d+)/.exec(String(v.text || "").toLowerCase());
    return m && crewers.filter((p) => p >= Math.ceil(Number(m[1]) / 2)).length < 2;
  });
  out.push("crew coverage: " + (bad.length ? "no crewing pair for " + bad.map((v) => v.name).join(", ") : "every vehicle has a crewing pair"));
  return out;
}

const only = typeof ONLY_STRATEGIES !== "undefined" ? ONLY_STRATEGIES : null;
for (const [key, subtype, colors] of PLANS) {
  if (only && !only.includes(key)) continue;
  const target = targets[key] || {};
  jxaPrint("=== " + key + " (" + colors.join("") + ") | reference: " + (target.source || "none") + " ===");
  for (const archetype of ARCHETYPE_ORDER) {
    const { deck, report } = buildDeckBottomUp(cards, { archetype, subtype, colors });
    const m = measure(deck, report, archetype, colors);
    const judge = archetype === "midrange";
    const parts = ["creatures", "members", "vehicles", "enchantments", "artifacts", "instSorc", "lands"].map((k) => {
      if (k === "members" && subtype.kind !== "tribal") return null;
      if (["vehicles", "enchantments", "artifacts"].includes(k) && !target[k]) return null;
      return k + " " + m[k] + (judge ? rangeFlag(m[k], target[k]) : "");
    }).filter(Boolean);
    parts.push("placeholders " + m.placeholders + (judge ? (m.placeholders === 0 ? " ok" : " FLAG") : ""));
    jxaPrint("  " + archetype.padEnd(9) + parts.join(" | "));
    if (judge) for (const line of mechanicChecks(deck, subtype)) jxaPrint("    check " + line);
  }
}
