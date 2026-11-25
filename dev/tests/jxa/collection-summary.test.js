// `count` is copies owned; `unique` is different cards (defaults to one).
function csEntry(type, colorId, count, unique) {
  return { type, colorId, count, unique: unique === undefined ? 1 : unique, cards: [] };
}

runSuite("collection-summary", {
  "colorBucket: empty is colorless, two colors is multicolor": () => {
    assertEqual(colorBucket(""), "C");
    assertEqual(colorBucket("G"), "G");
    assertEqual(colorBucket("WU"), "M");
  },

  "aggregateSubtypes: a Human Warrior counts under both, legendary tallied": () => {
    const rows = aggregateSubtypes([
      csEntry("creature — human warrior", "W", 5, 2),
      csEntry("legendary creature — human", "WU", 3, 1)
    ], "creature");
    const human = rows.find((r) => r.name === "Human");
    assertEqual(human.count, 3);
    assertEqual(human.legendary, 1);
    assertEqual(human.colors.W, 2);
    assertEqual(human.colors.M, 1);
    assertEqual(rows.find((r) => r.name === "Warrior").count, 2);
  },

  "aggregateSubtypes: colorless goes in C, not M": () => {
    const rows = aggregateSubtypes([csEntry("artifact creature — golem", "", 6, 3)], "creature");
    assertEqual(rows[0].colors.C, 3);
    assertEqual(rows[0].colors.M, 0);
  },

  "aggregateSubtypes: no subtype is labeled No subtype": () => {
    const rows = aggregateSubtypes([csEntry("creature", "R", 1)], "creature");
    assertEqual(rows[0].name, "No subtype");
  },

  "aggregateSubtypes: ignores other primary types": () => {
    const rows = aggregateSubtypes([csEntry("instant", "U", 4, 4)], "creature");
    assertEqual(rows.length, 0);
  },

  "buildTribeSummary: drops one-card tribes and caps at ten": () => {
    const m = new Map();
    for (let i = 0; i < 12; i += 1) m.set("t" + i, csEntry("creature — tribe" + i, "G", 9, 5 + i));
    m.set("solo", csEntry("creature — loner", "G", 1));
    const rows = buildTribeSummary(m);
    assertEqual(rows.length, 10);
    assertTrue(!rows.some((r) => r.name === "Loner"));
    assertEqual(rows[0].name, "Tribe11");
  },

  "buildRoleCoverage: empty role is missing, listed in fixed order": () => {
    const rows = buildRoleCoverage(new Map());
    assertEqual(rows.map((r) => r.role).join(","), "ramp,draw,removal,wipe");
    assertEqual(rows[0].status, "missing");
    assertEqual(rows[0].target, 10);
  },

  "buildRoleCoverage: status thresholds and castable-by-color": () => {
    const m = new Map();
    m.set("removal|", { role: "removal", colorId: "", count: 3, unique: 3, cards: [] });
    m.set("removal|R", { role: "removal", colorId: "R", count: 6, unique: 6, cards: [] });
    m.set("removal|RG", { role: "removal", colorId: "RG", count: 20, unique: 20, cards: [] });
    const removal = buildRoleCoverage(m).find((r) => r.role === "removal");
    assertEqual(removal.total, 29);
    assertEqual(removal.unique, 29);
    assertEqual(removal.status, "deep");
    assertEqual(removal.byColor.R, 9);
    assertEqual(removal.byColor.W, 3);
  },

  "buildRoleCoverage: status reads different cards, totals and colors read copies": () => {
    const m = new Map();
    m.set("ramp|", { role: "ramp", colorId: "", count: 12, unique: 2, cards: [] });
    m.set("ramp|W", { role: "ramp", colorId: "W", count: 4, unique: 1, cards: [] });
    const ramp = buildRoleCoverage(m).find((r) => r.role === "ramp");
    assertEqual(ramp.unique, 3);
    assertEqual(ramp.total, 16);
    assertEqual(ramp.status, "thin");
    assertEqual(ramp.byColor.W, 16);
    assertEqual(ramp.byColor.U, 12);
  }
});
