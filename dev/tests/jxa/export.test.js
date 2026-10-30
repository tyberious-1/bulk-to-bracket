function deckEntry(name, type) {
  return { name: name, type_line: type };
}

function searchQuery(url) {
  return decodeURIComponent(url.split("?q=")[1].split("&")[0]);
}

runSuite("export", {
  "builds one exact-name search covering the commander and every nonland card": function () {
    const deck = [deckEntry("Smuggler's Copter", "Artifact — Vehicle"), deckEntry("Deadly Dispute", "Instant")];
    const urls = scryfallDeckSearchUrls(deck, ["Greasefang, Okiba Boss"]);
    assertEqual(urls.length, 1);
    assertTrue(urls[0].indexOf("https://scryfall.com/search?q=") === 0, "scryfall search url");
    assertEqual(searchQuery(urls[0]), '!"Greasefang, Okiba Boss" or !"Deadly Dispute" or !"Smuggler\'s Copter"');
  },
  "leaves out every land, basic or not": function () {
    const deck = [
      deckEntry("Swamp", "Basic Land — Swamp"),
      deckEntry("Foul Roads", "Land"),
      deckEntry("Seat of the Synod", "Artifact Land"),
      deckEntry("Dryad Arbor", "Land Creature — Forest Dryad"),
      deckEntry("Deadly Dispute", "Instant")
    ];
    assertEqual(searchQuery(scryfallDeckSearchUrls(deck, ["Greasefang, Okiba Boss"])[0]), '!"Greasefang, Okiba Boss" or !"Deadly Dispute"');
  },
  "names a partner pair once each, even when the pair is also in the deck list": function () {
    const deck = [deckEntry("Tormod, the Desecrator", "Legendary Creature — Vampire Wizard"), deckEntry("Graf Harvest", "Enchantment")];
    const q = searchQuery(scryfallDeckSearchUrls(deck, ["Tormod, the Desecrator", "Ghost of Ramirez DePietro"])[0]);
    assertEqual(q, '!"Tormod, the Desecrator" or !"Ghost of Ramirez DePietro" or !"Graf Harvest"');
  },
  "searches a two-faced card by its front face": function () {
    const deck = [deckEntry("Heirloom Mirror // Inherited Fiend", "Artifact // Creature — Demon")];
    assertEqual(searchQuery(scryfallDeckSearchUrls(deck, ["Greasefang, Okiba Boss"])[0]), '!"Greasefang, Okiba Boss" or !"Heirloom Mirror"');
  },
  "lists a card once however many copies the deck holds": function () {
    const deck = [deckEntry("Deadly Dispute", "Instant"), deckEntry("Deadly Dispute", "Instant")];
    assertEqual(searchQuery(scryfallDeckSearchUrls(deck, ["Greasefang, Okiba Boss"])[0]), '!"Greasefang, Okiba Boss" or !"Deadly Dispute"');
  },
  "keeps accents and commas intact through the url": function () {
    const deck = [deckEntry("Troll of Khazad-dûm", "Creature — Troll")];
    const url = scryfallDeckSearchUrls(deck, ["Greasefang, Okiba Boss"])[0];
    assertTrue(url.indexOf(" ") === -1 && url.indexOf('"') === -1, "url is fully encoded");
    assertEqual(searchQuery(url), '!"Greasefang, Okiba Boss" or !"Troll of Khazad-dûm"');
  },
  "gives no link for an empty deck": function () {
    assertEqual(scryfallDeckSearchUrls([], ["Greasefang, Okiba Boss"]), []);
    assertEqual(scryfallDeckSearchUrls(null, []), []);
  },
  "splits a big deck into searches Scryfall will not cut off, covering every card once": function () {
    const deck = [];
    for (let i = 0; i < 90; i++) deck.push(deckEntry("Card Number " + (1000 + i) + " of the Long Name", "Creature — Elf"));
    const urls = scryfallDeckSearchUrls(deck, ["Greasefang, Okiba Boss"]);
    assertTrue(urls.length > 1, "needs more than one search");
    const seen = [];
    for (const url of urls) {
      const q = searchQuery(url);
      assertTrue(q.length <= SCRYFALL_QUERY_LIMIT, "query of " + q.length + " chars is over the limit");
      q.split(" or ").forEach((term) => seen.push(term));
    }
    assertEqual(seen.length, 91);
    assertEqual(new Set(seen).size, 91);
    assertEqual(seen[0], '!"Greasefang, Okiba Boss"');
  }
});
