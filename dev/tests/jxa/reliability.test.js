
function relCard(role, extra) {
  return Object.assign({ name: `${role} ${Math.random()}`, bottomUpRole: role, standing: "none", bottomUpRampKind: "reliable" }, extra || {});
}
function relDeck(counts) {
  const deck = [];
  for (const [role, n] of Object.entries(counts)) for (let i = 0; i < n; i += 1) deck.push(relCard(role));
  return deck;
}
function relLands(perColor, total) {
  const lands = [];
  for (const [color, n] of Object.entries(perColor)) for (let i = 0; i < n; i += 1) lands.push({ name: `${color} land`, colors: [color] });
  while (lands.length < total) lands.push({ name: "Wastes", colors: [] });
  return lands;
}
function relLine(report, id) {
  return report.lines.find((line) => line.id === id);
}
function near(actual, expected, message) {
  assertTrue(Math.abs(actual - expected) < 0.005, `${message || ""} expected ${expected}, got ${actual}`);
}

runSuite("reliability", {
  "hypergeometricAtLeast: matches hand-computed odds": () => {
    // 37 lands in 99: at least 3 in the 9 cards seen by turn 3 on the play
    near(hypergeometricAtLeast(99, 37, 9, 3), 0.73);
    // 9 ramp pieces: at least one in 9 cards
    near(hypergeometricAtLeast(99, 9, 9, 1), 0.59);
    assertEqual(hypergeometricAtLeast(99, 0, 9, 1), 0);
    assertEqual(hypergeometricAtLeast(99, 99, 9, 9), 1);
    assertEqual(hypergeometricAtLeast(99, 10, 9, 0), 1);
  },

  "deckReliability: land and ramp odds follow the deck's counts": () => {
    const deck = relDeck({ ramp: 9, draw: 8, removal: 8, wipe: 0, synergy: 37 });
    const lands = relLands({ B: 37 }, 37);
    const report = deckReliability(deck, lands, ["B"]);
    near(relLine(report, "lands-t3").odds, 0.73);
    near(relLine(report, "ramp-t3").odds, 0.59);
    near(relLine(report, "draw-t3").odds, 0.55);
    near(relLine(report, "removal-t5").odds, 0.62);
    // the share of openers with 0-1 lands is a bad outcome, so lower is better
    near(relLine(report, "lands-opener").odds, 0.19);
  },

  "deckReliability: one-shot ramp does not count as reliable ramp": () => {
    const deck = relDeck({ ramp: 9, synergy: 53 });
    for (const card of deck.slice(0, 9)) card.bottomUpRampKind = "oneshot";
    const report = deckReliability(deck, relLands({ B: 37 }, 37), ["B"]);
    assertEqual(relLine(report, "ramp-t3").odds, 0);
    assertEqual(relLine(report, "ramp-t3").rating, "weak");
  },

  "deckReliability: cantrips and loots count half as card draw": () => {
    // 8 draw cards, all cantrips, read as 4 draws; 4 engines plus 4 cantrips read as 6
    const cantrips = relDeck({ draw: 8, synergy: 54 });
    for (const card of cantrips.filter((c) => c.bottomUpRole === "draw")) card.bottomUpDrawKind = "cantrip";
    const a = deckReliability(cantrips, relLands({ B: 37 }, 37), ["B"]);
    near(relLine(a, "draw-t3").odds, hypergeometricAtLeast(99, 4, 9, 1));
    const mixed = relDeck({ draw: 8, synergy: 54 });
    mixed.filter((c) => c.bottomUpRole === "draw").forEach((card, i) => { card.bottomUpDrawKind = i < 4 ? "engine" : "filter"; });
    const b = deckReliability(mixed, relLands({ B: 37 }, 37), ["B"]);
    near(relLine(b, "draw-t3").odds, hypergeometricAtLeast(99, 6, 9, 1));
    assertEqual(relLine(b, "draw-t3").count, 6);
    // a draw card with no recorded kind counts in full
    const plain = deckReliability(relDeck({ draw: 8, synergy: 54 }), relLands({ B: 37 }, 37), ["B"]);
    near(relLine(plain, "draw-t3").odds, hypergeometricAtLeast(99, 8, 9, 1));
  },

  "deckReliability: wipes count with removal": () => {
    const deck = relDeck({ removal: 4, wipe: 4, synergy: 54 });
    const report = deckReliability(deck, relLands({ B: 37 }, 37), ["B"]);
    near(relLine(report, "removal-t3").odds, 0.55);
  },

  "deckReliability: every color gets its own source lines, counted from the lands": () => {
    const deck = relDeck({ synergy: 62 });
    const lands = relLands({ B: 22, U: 5, G: 0 }, 37);
    const report = deckReliability(deck, lands, ["B", "U", "G"]);
    assertTrue(relLine(report, "source-B-t3").odds > relLine(report, "source-U-t3").odds);
    assertEqual(relLine(report, "source-G-t3").odds, 0);
    assertEqual(relLine(report, "source-G-t3").rating, "weak");
    assertEqual(relLine(report, "source-B-t3").rating, "good");
  },

  "deckReliability: a multi-color land counts for each of its colors": () => {
    const deck = relDeck({ synergy: 62 });
    const lands = [];
    for (let i = 0; i < 14; i += 1) lands.push({ name: `Dual ${i}`, colors: ["W", "R"] });
    while (lands.length < 37) lands.push({ name: "Wastes", colors: [] });
    const report = deckReliability(deck, lands, ["W", "R"]);
    assertEqual(relLine(report, "source-W-t3").odds, relLine(report, "source-R-t3").odds);
    assertTrue(relLine(report, "source-W-t3").odds > 0.7);
  },

  "deckReliability: ratings turn weak as the counts drop": () => {
    const rich = deckReliability(relDeck({ ramp: 10, draw: 10, removal: 10, synergy: 32 }), relLands({ B: 37 }, 37), ["B"]);
    const poor = deckReliability(relDeck({ ramp: 1, draw: 1, removal: 1, synergy: 59 }), relLands({ B: 37 }, 37), ["B"]);
    assertEqual(relLine(rich, "ramp-t5").rating, "good");
    assertEqual(relLine(poor, "ramp-t5").rating, "weak");
    assertEqual(relLine(poor, "draw-t3").rating, "weak");
  },

  "deckReliability: too few lands is flagged by the opener line": () => {
    const deck = relDeck({ synergy: 70 });
    const report = deckReliability(deck, relLands({ B: 29 }, 29), ["B"]);
    assertEqual(relLine(report, "lands-opener").rating, "weak");
    assertEqual(relLine(report, "lands-t4").rating, "weak");
  },

  "deckReliability: a member line appears only when the deck has subtype cards": () => {
    const withMembers = relDeck({ synergy: 62 });
    for (const card of withMembers.slice(0, 25)) card.standing = "member";
    const a = deckReliability(withMembers, relLands({ B: 37 }, 37), ["B"]);
    near(relLine(a, "member-opener").odds, 0.88);
    assertEqual(relLine(a, "member-opener").rating, "OK");
    const b = deckReliability(relDeck({ synergy: 62 }), relLands({ B: 37 }, 37), ["B"]);
    assertEqual(relLine(b, "member-opener"), undefined);
  },

  "deckReliability: the summary counts ratings and names the weakest line": () => {
    const poor = deckReliability(relDeck({ ramp: 1, draw: 8, removal: 8, synergy: 45 }), relLands({ B: 37 }, 37), ["B"]);
    assertEqual(poor.summary.good + poor.summary.ok + poor.summary.weak, poor.lines.length);
    assertTrue(poor.summary.weak > 0);
    assertTrue(/ramp/i.test(poor.summary.weakest.label));
  },

  "deckReliability: a rebuild line appears only with wipes and is rated against how many wipes there are": () => {
    const deckWith = (wipes, rebuild) => {
      const deck = relDeck({ wipe: wipes, synergy: 62 - wipes });
      deck.filter((c) => c.bottomUpRole === "synergy").slice(0, rebuild).forEach((c) => { c.bottomUpRebuild = "tokens"; });
      return deck;
    };
    const lands = relLands({ W: 37 }, 37);
    const thin = deckReliability(deckWith(4, 3), lands, ["W"]);
    assertEqual(relLine(thin, "rebuild-t5").rating, "weak");
    assertEqual(relLine(thin, "rebuild-t5").count, 3);
    const rich = deckReliability(deckWith(4, 15), lands, ["W"]);
    assertEqual(relLine(rich, "rebuild-t5").rating, "good");
    near(relLine(rich, "rebuild-t5").odds, hypergeometricAtLeast(99, 15, 11, 1));
    const middling = deckReliability(deckWith(4, 8), lands, ["W"]);
    assertEqual(relLine(middling, "rebuild-t5").rating, "OK");
    assertEqual(relLine(deckReliability(deckWith(0, 15), lands, ["W"]), "rebuild-t5"), undefined);
  },

  "deckReliability: notes name the wipes that hit your own subtype and the cards that protect the board": () => {
    const deck = relDeck({ wipe: 4, synergy: 58 });
    deck.filter((c) => c.bottomUpRole === "wipe")[0].bottomUpSpares = true;
    deck.filter((c) => c.bottomUpRole === "synergy").slice(0, 2).forEach((c) => { c.bottomUpProtects = true; });
    const report = deckReliability(deck, relLands({ W: 37 }, 37), ["W"], { subtypeLabel: "Soldiers" });
    assertTrue(report.notes.some((n) => /3 of 4 wipes/.test(n) && /Soldiers/.test(n)));
    assertTrue(report.notes.some((n) => /2 cards/.test(n) && /protect|survive/i.test(n)));
    const one = relDeck({ wipe: 2, synergy: 60 });
    one.find((c) => c.bottomUpRole === "synergy").bottomUpProtects = true;
    assertTrue(deckReliability(one, relLands({ W: 37 }, 37), ["W"]).notes.some((n) => /^1 card protects your board/.test(n)));
    // no subtype label, no wipes hit the subtype, no protection: nothing to say
    assertEqual(deckReliability(relDeck({ wipe: 4, synergy: 58 }), relLands({ W: 37 }, 37), ["W"]).notes, []);
    const allSpared = relDeck({ wipe: 2, synergy: 60 });
    allSpared.filter((c) => c.bottomUpRole === "wipe").forEach((c) => { c.bottomUpSpares = true; });
    assertEqual(deckReliability(allSpared, relLands({ W: 37 }, 37), ["W"], { subtypeLabel: "Soldiers" }).notes, []);
  },

  "deckReliability: an empty deck gives no lines instead of throwing": () => {
    const report = deckReliability([], [], ["B"]);
    assertEqual(report.lines, []);
    assertEqual(report.summary.weakest, null);
  }
});
