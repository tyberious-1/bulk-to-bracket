const catalogCard = (name, type, text, keywords) => ({ name, type, text, raw: keywords ? { keywords } : undefined });

runSuite("catalog-themes", {
  "resolveCatalogTheme: a plural creature type and a keyword resolve, an unknown theme does not": function () {
    assertEqual(resolveCatalogTheme("eldrazi").kind, "type");
    assertEqual(resolveCatalogTheme("werewolves").term, "werewolf");
    assertEqual(resolveCatalogTheme("flying").kind, "keyword");
    assertTrue(resolveCatalogTheme("aggro") === null, "a strategy label has no catalog entry");
  },

  "resolveCatalogTheme: eggs stays on the text pass (EDHREC means cheap artifacts)": function () {
    assertTrue(resolveCatalogTheme("eggs") === null);
  },

  "cardMatchesThemeText: flying is matched by the keyword, not by a mention in the text": function () {
    const flyer = catalogCard("Sky Drake", "creature — drake", "flying", ["Flying"]);
    const hoser = catalogCard("Skyweaver Bane", "creature — human", "destroy target creature with flying.", []);
    assertTrue(cardMatchesThemeText(flyer, "flying"));
    assertTrue(!cardMatchesThemeText(hoser, "flying"), "a card that only names flying is not a flyer");
  },

  "cardMatchesThemeText: a granted keyword counts": function () {
    const lord = catalogCard("Wind Caller", "creature — human", "other creatures you control have flying.", []);
    assertTrue(cardMatchesThemeText(lord, "flying"));
  },

  "cardMatchesThemeText: a creature type is matched by the subtype": function () {
    const myr = catalogCard("Little Myr", "artifact creature — myr", "", undefined);
    assertTrue(cardMatchesThemeText(myr, "myr"));
    assertTrue(!cardMatchesThemeText(catalogCard("Myrtle", "creature — elf", "", undefined), "myr"));
  },

  "cardMatchesThemeText: a card with no Scryfall keywords falls back to the text pass": function () {
    const bare = catalogCard("Plain Flyer", "creature — bird", "flying", undefined);
    assertTrue(cardMatchesThemeText(bare, "flying"));
  }
});
