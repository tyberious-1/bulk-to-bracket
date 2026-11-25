function cnCard(name, type, text, cmc) {
  return { name, type, text, cmc: cmc || 0 };
}
function cnWeb(cards) {
  return buildCollectionConnections(cards.map((card) => ({ name: card.name, card, colorId: card.colorId || "" })));
}
function cnRow(web, channel) {
  return web.channels.find((r) => r.channel === channel);
}

runSuite("connections", {
  "a death payoff and a sacrifice outlet make a one-deep engine": () => {
    const web = cnWeb([
      cnCard("Blood Altar", "artifact", "{T}, Sacrifice another creature: Draw a card."),
      cnCard("Grave Tithe", "enchantment", "Whenever another creature you control dies, each opponent loses 1 life.")
    ]);
    const dies = cnRow(web, "dies");
    assertEqual(dies.wanters, 1);
    assertEqual(dies.givers, 1);
    assertEqual(dies.depth, 1);
    assertEqual(dies.status, "thin");
  },

  "a payoff nothing feeds has depth zero": () => {
    const web = cnWeb([
      cnCard("Lone Payoff", "enchantment", "Whenever a land enters the battlefield under your control, you gain 1 life.")
    ]);
    assertEqual(cnRow(web, "landfall").depth, 0);
    assertEqual(cnRow(web, "landfall").status, "missing");
  },

  "lands are skipped and universal channels are not listed": () => {
    const web = cnWeb([
      cnCard("Forest Plot", "basic land — forest", "{T}: Add {G}."),
      cnCard("Plain Bear", "creature — bear", "")
    ]);
    assertEqual(web.cardCount, 1);
    assertEqual(web.channels.length, 0);
  },

  "depth is the smaller side, and rows run deepest first": () => {
    const cards = [];
    for (let i = 0; i < 7; i += 1) cards.push(cnCard("Watcher" + i, "enchantment", "Whenever another creature you control dies, you gain 1 life."));
    for (let i = 0; i < 3; i += 1) cards.push(cnCard("Outlet" + i, "artifact", "{T}, Sacrifice another creature: Scry 1."));
    const web = cnWeb(cards);
    assertEqual(web.channels[0].channel, "dies");
    assertEqual(web.channels[0].depth, 3);
    assertEqual(connectionDepthStatus(6), "ok");
    assertEqual(connectionDepthStatus(15), "deep");
  },

  "by color: a deck of one color reads that color's cards plus colorless": () => {
    const watcher = (n, colorId) => Object.assign(cnCard(n, "enchantment", "Whenever another creature you control dies, you gain 1 life."), { colorId });
    const outlet = (n, colorId) => Object.assign(cnCard(n, "artifact", "{T}, Sacrifice another creature: Scry 1."), { colorId });
    const web = cnWeb([watcher("W1", "W"), watcher("B1", "B"), watcher("Gold1", "WB"), outlet("Out0", ""), outlet("OutW", "W")]);
    const dies = cnRow(web, "dies");
    assertEqual(dies.byColor.W.wanters, 1);
    assertEqual(dies.byColor.W.givers, 2);
    assertEqual(dies.byColor.W.depth, 1);
    assertEqual(dies.byColor.B.givers, 1);
    assertEqual(dies.byColor.R.wanters, 0);
    assertEqual(dies.byColor.R.depth, 0);
  }
});
