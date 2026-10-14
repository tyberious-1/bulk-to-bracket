runSuite("mode-prefs", {
  "getModePreferences: minimalBuild is false when mode carries no minimal token": function () {
    const prefs = getModePreferences("theme:elves", { wantsCreatures: false });
    assertEqual(prefs.minimalBuild, false);
  },

  "getModePreferences: minimalBuild is false for an empty mode": function () {
    const prefs = getModePreferences("", { wantsCreatures: false });
    assertEqual(prefs.minimalBuild, false);
  },

  "getModePreferences: minimalBuild is true when mode is exactly \"minimal\"": function () {
    const prefs = getModePreferences("minimal", { wantsCreatures: false });
    assertEqual(prefs.minimalBuild, true);
  },

  "getModePreferences: minimalBuild combines with a theme focus via the pipe-joined mode string": function () {
    const prefs = getModePreferences("theme:elves|minimal", { wantsCreatures: false });
    assertEqual(prefs.minimalBuild, true);
    assertEqual(prefs.themeFocus, "elves");
  },

  "getModePreferences: curveFirst is false for an empty mode": function () {
    const prefs = getModePreferences("", { wantsCreatures: false });
    assertEqual(prefs.curveFirst, false);
  },

  "getModePreferences: curveFirst is true when mode is exactly \"curveFirst\"": function () {
    const prefs = getModePreferences("curveFirst", { wantsCreatures: false });
    assertEqual(prefs.curveFirst, true);
  },

  "getModePreferences: curveFirst combines with minimalBuild via the pipe-joined mode string": function () {
    const prefs = getModePreferences("minimal|curveFirst", { wantsCreatures: false });
    assertEqual(prefs.minimalBuild, true);
    assertEqual(prefs.curveFirst, true);
  }
});

runSuite("mode-prefs: multi-theme plans", {
  "getModePreferences: a plan focus carries every theme's signal and aliases": function () {
    const prefs = getModePreferences("theme:auras~voltron", { wantsCreatures: false });
    assertEqual(prefs.focusedThemeSignals.join(","), "auras,voltron");
    assertTrue(prefs.themeFocusAliases.includes("voltron"));
    assertTrue(focusHasSignal(prefs, "voltron"));
    assertTrue(focusHasSignal(prefs, "auras"));
  },

  "getModePreferences: a plan focus keeps every tribe": function () {
    const prefs = getModePreferences("theme:merfolk~elves", { wantsCreatures: false });
    assertTrue(prefs.focusedTribalTypes.includes("merfolk"));
    assertTrue(prefs.focusedTribalTypes.includes("elf"));
  },

  "getModePreferences: a single theme behaves as before": function () {
    const prefs = getModePreferences("theme:elves", { wantsCreatures: false });
    assertEqual(prefs.focusedThemeSignal, "elves");
    assertEqual(prefs.focusedThemeSignals.join(","), "elves");
  }
});
