// Covers the bug where the Theme/Tribal tab showed EDHREC-ranked commanders
// of any rarity under pauper format: selectThemeTabEntry must skip the
// EDHREC tag fetch and cardMatchesThemeTabEntry/findOwnedThemeTabCommandersFromCache
// must be able to match a non-tribal theme tag too, not just tribal ones.

runSuite("theme-tab", {
  "cardMatchesThemeTabEntry: tribal entry matches a creature of that tribe": () => {
    const entry = { kind: "tribal", tag: "elves" };
    const card = { type: "creature — elf warrior", text: "" };
    assertTrue(cardMatchesThemeTabEntry(card, entry));
  },

  "cardMatchesThemeTabEntry: tribal entry rejects a creature of a different tribe": () => {
    const entry = { kind: "tribal", tag: "elves" };
    const card = { type: "creature — goblin warrior", text: "" };
    assertTrue(!cardMatchesThemeTabEntry(card, entry));
  },

  "cardMatchesThemeTabEntry: theme entry matches via detectCardTags, not just tribal types": () => {
    const entry = { kind: "theme", tag: "lifegain" };
    const card = { type: "creature — cleric", text: "whenever you gain life, draw a card." };
    assertTrue(cardMatchesThemeTabEntry(card, entry));
  },

  "cardMatchesThemeTabEntry: theme entry rejects a card without that tag": () => {
    const entry = { kind: "theme", tag: "lifegain" };
    const card = { type: "creature — cleric", text: "flying" };
    assertTrue(!cardMatchesThemeTabEntry(card, entry));
  }
});
