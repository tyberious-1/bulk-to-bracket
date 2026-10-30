
// Bottom-up suggestions: which archetype x subtype x colors does this collection support?
//
// Starts from rankCollectionSupport (discovery.js) for the subtypes, tries the best single color
// and the best pair for each, builds all three archetypes, and rates each build by how much of
// it the pile fills without falling back to generic cards.
//
// Depends on: discovery.js, archetypes.js, bottom-up-deck.js, cards.js

// Tribes and themes are ranked apart: a theme such as Graveyard matches most of a collection, so it
// would otherwise always outrank a concrete tribe (the same reason discovery.js groups them).
const SUGGESTION_TRIBES = 10;
const SUGGESTION_THEMES = 6;
// Rows kept per archetype, so Control is not left with what Aggro and Midrange did not take.
const SUGGESTION_ROWS_PER_ARCHETYPE = { tribal: 8, theme: 4 };
const SUGGESTION_COLORS = ["W", "U", "B", "R", "G"];
// A second color must bring at least this many more supporting cards to be worth offering.
const SUGGESTION_PAIR_GAIN = 3;
const RATING_RANK = { Strong: 0, OK: 1, Thin: 2 };

function toBottomUpSubtype(entry, tribeFor) {
  const subtype = { kind: entry.kind, tag: entry.tag, label: entry.label };
  if (entry.kind === "tribal") subtype.tribe = tribeFor(entry);
  return subtype;
}

function candidateColorSets(cards, subtype) {
  const singles = SUGGESTION_COLORS.map((c) => [c]);
  const pairs = [];
  for (let i = 0; i < SUGGESTION_COLORS.length; i += 1) {
    for (let j = i + 1; j < SUGGESTION_COLORS.length; j += 1) pairs.push([SUGGESTION_COLORS[i], SUGGESTION_COLORS[j]]);
  }

  const support = cards.filter((card) => {
    const standing = annotateBottomUpCard(card, subtype).standing;
    return standing === "member" || standing === "payoff";
  });
  const countFor = (set) => support.filter((card) => legalForCommander(card.colors || [], set, card)).length;
  const best = (sets) => sets.map((set) => ({ set, n: countFor(set) })).sort((a, b) => b.n - a.n)[0];

  const bestSingle = best(singles);
  const bestPair = best(pairs);
  const out = [];
  if (bestSingle && bestSingle.n > 0) out.push(bestSingle.set);
  if (bestPair && bestSingle && bestPair.n >= bestSingle.n + SUGGESTION_PAIR_GAIN) out.push(bestPair.set);
  return out;
}

function rateBuild(report) {
  const support = (report.members + report.payoffs) / Math.max(report.nonlandSlots, 1);
  const shortfall = Object.values(report.shortfalls).reduce((sum, n) => sum + n, 0);
  if (support >= 0.35 && shortfall <= 2) return "Strong";
  if (support >= 0.2 && shortfall <= 8) return "OK";
  return "Thin";
}

function describeBuild(report) {
  const supportCount = report.members + report.payoffs;
  const bulk = report.supportRarity.bulk;
  const rare = report.supportRarity.rare;
  const quality = supportCount === 0
    ? "no cards of this subtype"
    : bulk / Math.max(bulk + rare, 1) >= 0.75
      ? "mostly bulk-quality (commons and uncommons)"
      : "includes rares and mythics";

  const roles = [];
  for (const [role, missing] of Object.entries(report.shortfalls)) {
    if (missing > 0) roles.push(`${role}: ${report.roleCounts[role]} of ${report.slots[role]}`);
  }
  if (report.answers && report.answers.shortfall > 0) roles.push(`artifact and enchantment answers: ${report.answers.count} of ${report.answers.floor}`);
  if (report.counters && report.counters.shortfall > 0) roles.push(`counterspells: ${report.counters.count} of ${report.counters.floor}`);
  for (const sub of report.substitutions) roles.push(`draw covers ${sub.extraDraw} of ${sub.shortfall} missing ${sub.role} slots`);

  const notes = [];
  if (report.budget && report.budget.applied) notes.push(`ties between equal cards broken by EDHREC budget inclusion (${report.budget.matched} cards matched)`);

  const res = report.payoffReservation;
  if (res && res.minimum > 0 && res.available < res.minimum) notes.push(`only ${res.available} payoff card${res.available === 1 ? "" : "s"} in your collection for this plan (a deck usually has about ${res.minimum})`);
  if (report.fallbackCount > 0) notes.push(`${report.fallbackCount} placeholder slots with no tie to the theme, so swap in cards you own that fit`);

  return { support: `${report.members} members, ${report.payoffs} payoffs, ${report.mentions} mentions`, quality, roles, notes };
}

function rankBottomUpSuggestions(cards, catalog, tribeFor) {
  const seen = new Set();
  const nonland = [];
  for (const card of cards) {
    if (!card || seen.has(card.name) || getCardType(card).includes("land")) continue;
    seen.add(card.name);
    nonland.push(card);
  }
  if (!nonland.length) return [];

  const ranked = rankCollectionSupport(nonland, catalog, tribeFor);
  const share = (row) => (row.report.members + row.report.payoffs) / Math.max(row.report.nonlandSlots, 1);
  const rowsFor = (supportedRows, perArchetype) => {
    const rows = [];
    for (const supported of supportedRows) {
      const subtype = toBottomUpSubtype(supported.entry, tribeFor);
      for (const colors of candidateColorSets(nonland, subtype)) {
        for (const archetype of ARCHETYPE_ORDER) {
          const { report } = buildDeckBottomUp(nonland, { archetype, subtype, colors });
          rows.push({ subtype, colors, archetype, report, rating: rateBuild(report), ...describeBuild(report) });
        }
      }
    }
    rows.sort((a, b) => RATING_RANK[a.rating] - RATING_RANK[b.rating] || share(b) - share(a));
    return ARCHETYPE_ORDER.flatMap((archetype) => rows.filter((row) => row.archetype === archetype).slice(0, perArchetype));
  };

  return [
    ...rowsFor(ranked.filter((r) => r.entry.kind === "tribal").slice(0, SUGGESTION_TRIBES), SUGGESTION_ROWS_PER_ARCHETYPE.tribal),
    ...rowsFor(ranked.filter((r) => r.entry.kind !== "tribal").slice(0, SUGGESTION_THEMES), SUGGESTION_ROWS_PER_ARCHETYPE.theme)
  ];
}

// The tab shows suggestions under one collapsible group per archetype. Within a group: rating
// first, then tribes before themes (a broad theme rates Strong on almost any collection), then
// the share of the build that is subtype cards. `index` points back into the original list.
function groupBottomUpSuggestions(rows) {
  const share = (row) => (row.report.members + row.report.payoffs) / Math.max(row.report.nonlandSlots, 1);
  const kindRank = (row) => (row.subtype.kind === "tribal" ? 0 : 1);
  return ARCHETYPE_ORDER.map((id) => ({
    id,
    items: rows
      .map((row, index) => ({ row, index }))
      .filter((item) => item.row.archetype === id)
      .sort((a, b) =>
        RATING_RANK[a.row.rating] - RATING_RANK[b.row.rating] || kindRank(a.row) - kindRank(b.row) || share(b.row) - share(a.row))
  }));
}
