const CSV_FULL = [
  "Binder Name,Binder Type,Name,Quantity",
  "Main,binder,Llanowar Elves,2",
  "Main,binder,Island,5",
  "Elves Deck,deck,Elvish Mystic,1",
  "Elves Deck,deck,Llanowar Elves,1",
  "Wishes,list,Black Lotus,1"
].join("\n");

const CSV_PLAIN = [
  "Name,Set code,Quantity",
  "Llanowar Elves,M19,1",
  "Elvish Mystic,M19,3"
].join("\n");

runSuite("csv", {
  "parseCsvText: a single-binder export has no binder columns and every row is a binder row": function () {
    const rows = parseCsvText(CSV_PLAIN);
    assertEqual(rows.length, 2);
    assertTrue(rows.every((r) => r.binderType === "binder"));
  },

  "buildCollectionFromRows: wish-list cards are never owned": function () {
    const collection = buildCollectionFromRows(parseCsvText(CSV_FULL));
    assertTrue(!collection.byNormalized.has(normalizeCardName("Black Lotus")));
    assertEqual(collection.binderSummary.list, 1);
  },

  "buildCollectionFromRows: counting decks adds deck-only cards and deck copies": function () {
    const collection = buildCollectionFromRows(parseCsvText(CSV_FULL), { includeDecks: true });
    assertEqual(collection.byNormalized.get(normalizeCardName("Llanowar Elves")), 3);
    assertTrue(collection.byNormalized.has(normalizeCardName("Elvish Mystic")));
    assertTrue(collection.includesDecks);
  },

  "buildCollectionFromRows: decks are left out by default": function () {
    const collection = buildCollectionFromRows(parseCsvText(CSV_FULL));
    assertTrue(!collection.byNormalized.has(normalizeCardName("Elvish Mystic")));
    assertEqual(collection.byNormalized.get(normalizeCardName("Llanowar Elves")), 2);
    assertEqual(collection.binderSummary.deck, 2);
  },

  "buildCollectionFromRows: a single-binder export reports no decks or lists": function () {
    const collection = buildCollectionFromRows(parseCsvText(CSV_PLAIN));
    assertEqual(collection.binderSummary.deck, 0);
    assertEqual(collection.binderSummary.list, 0);
    assertEqual(collection.entries.length, 2);
  },

  "parseCsvText: rejects a file without Name and Quantity": function () {
    let message = "";
    try { parseCsvText("Foo,Bar\n1,2"); } catch (error) { message = error.message; }
    assertTrue(message.includes("Name and Quantity"));
  }
});
