// Pure summaries behind the Collection Analytics tab: merged subtype rows, the
// strongest-tribes list and support-role coverage against deck targets.
// Depends on: discovery.js, deck-stats.js

const SUBTYPE_TOP_N = 30;
const TRIBE_SUMMARY_N = 10;

function colorBucket(colorId) {
  if (!colorId) return "C";
  return colorId.length > 1 ? "M" : colorId;
}

function emptyColorCounts() {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, M: 0 };
}

// One row per subtype. A card with several subtypes is counted under each.
function aggregateSubtypes(entries, typeKey) {
  const rows = new Map();
  for (const entry of entries) {
    if (classifyPrimaryType(entry.type) !== typeKey) continue;
    const legendary = isLegendaryTypeLine(entry.type);
    const subtypes = getTypeLineSubtypes(entry.type);
    for (const raw of subtypes.length ? subtypes : [null]) {
      const name = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "No subtype";
      if (!rows.has(name)) rows.set(name, { name, count: 0, legendary: 0, colors: emptyColorCounts() });
      const row = rows.get(name);
      row.count += entry.count;
      if (legendary) row.legendary += entry.count;
      row.colors[colorBucket(entry.colorId)] += entry.count;
    }
  }
  return Array.from(rows.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function buildTribeSummary(byTypeSubtype) {
  return aggregateSubtypes(Array.from(byTypeSubtype.values()), "creature")
    .filter((row) => row.name !== "No subtype" && row.count >= 2)
    .slice(0, TRIBE_SUMMARY_N);
}

function buildRoleCoverage(bySupportRole) {
  const targets = normalizeRoleTargets({});
  return ["ramp", "draw", "removal", "wipe"].map((role) => {
    const byColor = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    let total = 0;
    let colorless = 0;
    for (const entry of bySupportRole.values()) {
      if (entry.role !== role) continue;
      total += entry.count;
      if (!entry.colorId) colorless += entry.count;
      else if (entry.colorId.length === 1) byColor[entry.colorId] += entry.count;
    }
    for (const c of Object.keys(byColor)) byColor[c] += colorless;
    const target = targets[role];
    const status = total === 0 ? "missing" : total >= target * 2 ? "deep" : total >= target ? "ok" : "thin";
    return { role, total, target, status, byColor };
  });
}
