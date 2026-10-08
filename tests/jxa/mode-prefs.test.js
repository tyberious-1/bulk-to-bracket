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
  }
});
