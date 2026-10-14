// Plan options: 1-3 related themes a commander could be built around, each with
// honest coverage of what the collection can fill.
//
// Port of tools/jxa-harness/plan_coverage.py (see
// docs/superpowers/specs/2026-10-13-plan-first-prototyping.md). Most of an
// EDHREC theme page is the commander's general staples, so a theme is
// identified by its *distinctive* cards: ones whose inclusion beats the
// commander's main page by PLAN_MIN_LIFT. Themes whose distinctive sets overlap
// merge into one plan.
//
// EDHREC's themes are not the only plans. A player can name their own (a tribe,
// a mechanic) and buildCustomPlan judges it purely from the collection --
// "EDHREC doesn't list it" never means "it can't be built".
//
// Depends on: text.js, cards.js, themes.js (getThemeAliases, getCommanderTribalThemes),
// scoring.js (detectCardTags, hasTribalType)

const PLAN_MIN_INCLUSION = 0.15;
const PLAN_MIN_DECKS = 3;
const PLAN_MIN_LIFT = 0.15;
const PLAN_OVERLAP_TO_MERGE = 0.10;
const PLAN_MAX_THEMES = 3;
const PLAN_MAX_SHARED_THEMES = 1;
const PLAN_MAX_OPTIONS = 3;
// Plans with fewer owned plan-specific cards than this are called light.
// Measured on 27 plans over 14 commanders (2026-10-14): a build holds about as
// many signature cards as the collection has, up to roughly 10, then levels off.
// The cards decks of the plan commonly play are mostly the commander's staples,
// so a large count there does not rescue a plan with a handful of signature
// cards (Fynn's Infect plan: 2 signature cards owned, 37 common cards owned).
const PLAN_LIGHT_OWNED = 10;

function planInclusion(entry) {
  const potential = Number(entry.potentialDecks || 0);
  return potential > 0 ? Number(entry.decks || 0) / potential : 0;
}

// Cards a page recommends often enough to count as "wanted": {name -> {inc, syn}}.
function planWantedCards(entries) {
  const wanted = new Map();
  for (const entry of entries || []) {
    if (!entry?.name || /\bland/i.test(entry.label || "")) continue;
    if (Number(entry.potentialDecks || 0) < PLAN_MIN_DECKS) continue;
    const inc = planInclusion(entry);
    if (inc < PLAN_MIN_INCLUSION) continue;
    const prev = wanted.get(entry.name);
    if (!prev || inc > prev.inc) wanted.set(entry.name, { inc, syn: Number(entry.synergy || 0) });
  }
  return wanted;
}

function planJaccard(a, b) {
  let shared = 0;
  for (const key of a.keys()) if (b.has(key)) shared += 1;
  const union = a.size + b.size - shared;
  return union ? shared / union : 0;
}

// Plans from the commander's EDHREC theme pages. `isOwned(name)` says whether the
// collection has a card. Returns up to PLAN_MAX_OPTIONS plans, best coverage first.
function buildPlanOptions(themeCardStats, coreCards, isOwned) {
  const core = planWantedCards(coreCards);
  const themes = [];
  for (const [slug, entries] of Object.entries(themeCardStats || {})) {
    const wanted = planWantedCards(entries);
    const distinctive = new Map();
    for (const [name, v] of wanted) {
      const lift = v.inc - (core.get(name)?.inc || 0);
      if (lift >= PLAN_MIN_LIFT) distinctive.set(name, v);
    }
    if (distinctive.size) themes.push({ slug, wanted: distinctive, full: wanted, size: entries.length });
  }
  // Theme pages arrive in deck-count order, so keep that as the seed order.
  const coreOwned = Array.from(core.keys()).filter((name) => isOwned(name)).length;

  const seen = new Set();
  const plans = [];
  for (const seed of themes) {
    const members = [seed];
    const pool = new Map(seed.wanted);
    while (members.length < PLAN_MAX_THEMES) {
      let best = null;
      let bestScore = 0;
      for (const other of themes) {
        if (members.includes(other)) continue;
        const score = planJaccard(pool, other.wanted);
        if (score > bestScore) { best = other; bestScore = score; }
      }
      if (!best || bestScore < PLAN_OVERLAP_TO_MERGE) break;
      members.push(best);
      for (const [name, v] of best.wanted) if (!pool.has(name) || v.inc > pool.get(name).inc) pool.set(name, v);
    }
    const key = members.map((m) => m.slug).sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);

    const owned = Array.from(pool.keys())
      .filter((name) => isOwned(name))
      .sort((a, b) => (pool.get(b).inc + pool.get(b).syn) - (pool.get(a).inc + pool.get(a).syn));

    // Everything decks of this plan commonly play, staples included. The
    // distinctive count alone reads as "you own 3 Group Slug cards" when the
    // collection holds 41 cards that decks of the theme play.
    const full = new Map();
    for (const m of members) for (const [name, v] of m.full) if (!full.has(name) || v.inc > full.get(name).inc) full.set(name, v);
    const fullOwned = Array.from(full.keys())
      .filter((name) => isOwned(name))
      .sort((a, b) => (full.get(b).inc + full.get(b).syn) - (full.get(a).inc + full.get(a).syn));
    const examples = owned.slice(0, 6);
    for (const name of fullOwned) {
      if (examples.length >= 6) break;
      if (!examples.includes(name)) examples.push(name);
    }
    plans.push({
      themes: members.map((m) => m.slug),
      label: members.map((m) => formatThemeLabel(m.slug)).join(" + "),
      wanted: pool.size,
      owned: owned.length,
      examples,
      signature: Array.from(pool, ([name, v]) => [name, v.inc]),
      fullWanted: full.size,
      fullOwned: fullOwned.length,
      coreOwned,
      coreWanted: core.size,
      custom: false
    });
  }

  // Best coverage first, but each option must be a real alternative: it may share
  // at most PLAN_MAX_SHARED_THEMES themes with a plan already chosen. Without
  // this Kardur offered Aristocrats+Tokens+Clones next to Lifegain+Aristocrats+Tokens.
  plans.sort((a, b) => b.owned - a.owned);
  const top = [];
  for (const plan of plans) {
    if (top.length >= PLAN_MAX_OPTIONS) break;
    const distinct = top.every((kept) => plan.themes.filter((t) => kept.themes.includes(t)).length <= PLAN_MAX_SHARED_THEMES);
    if (distinct) top.push(plan);
  }
  const best = top[0];
  for (const plan of top) {
    plan.light = plan.owned < PLAN_LIGHT_OWNED;
    plan.betterPlan = plan.light && best && best !== plan && best.owned > plan.owned ? best.label : "";
  }
  return top;
}

// A plan the player names (a tribe or theme). Coverage is every owned,
// color-legal card whose tags or tribal type match, with no EDHREC input.
// allOwnedCardData: Map of normalized name -> Scryfall-style card data.
function buildCustomPlan(text, allOwnedCardData, commanderColors, commanderName = "") {
  const theme = String(text || "").trim();
  if (!theme) return null;
  const aliases = new Set(getThemeAliases(theme).map((alias) => normalizeThemeName(alias)));
  const tribes = getCommanderTribalThemes([theme]).map((t) => t.replace(" tribal", ""));
  // An unrecognised word still works as a creature type or rules-text word.
  const word = normalizeThemeName(theme);
  const looseTribe = tribes.length || word.includes(" ") ? null : word;
  const commanderKey = normalizeCardName(commanderName);

  const matches = [];
  for (const [key, card] of allOwnedCardData || []) {
    if (!card || key === commanderKey) continue;
    if (!legalForCommander(card.colors || [], commanderColors, card)) continue;
    const tags = detectCardTags(card).map((tag) => normalizeThemeName(tag));
    const hit = tags.some((tag) => aliases.has(tag))
      || tribes.some((tribe) => hasTribalType(card, tribe))
      || (looseTribe && hasTribalType(card, looseTribe));
    if (hit) matches.push(card.name);
  }
  return {
    themes: [theme],
    label: formatThemeLabel(theme),
    wanted: 0,
    owned: matches.length,
    examples: matches.slice(0, 6),
    custom: true,
    light: matches.length < PLAN_LIGHT_OWNED,
    betterPlan: ""
  };
}

// Fill the option list from themes the app detected in the collection when EDHREC
// gave fewer than PLAN_MAX_OPTIONS plans. EDHREC only fetches popular themes, so
// a commander with two big themes (Oviya: Tokens, Artifacts) would otherwise show
// one choice. Themes already inside an EDHREC plan are skipped, as are ones the
// collection barely supports.
const PLAN_MIN_FILL_OWNED = 5;

function addCollectionPlans(plans, detectedThemes, allOwnedCardData, commanderColors, commanderName = "") {
  const out = (plans || []).slice();
  if (out.length >= PLAN_MAX_OPTIONS) return out;
  const covered = new Set(out.flatMap((plan) => plan.themes.map((t) => normalizeThemeName(t))));
  const extra = [];
  for (const theme of detectedThemes || []) {
    if (!theme || covered.has(normalizeThemeName(theme))) continue;
    covered.add(normalizeThemeName(theme));
    const plan = buildCustomPlan(theme, allOwnedCardData, commanderColors, commanderName);
    if (!plan || plan.owned < PLAN_MIN_FILL_OWNED) continue;
    plan.custom = false;
    plan.fromCollection = true;
    extra.push(plan);
  }
  extra.sort((a, b) => b.owned - a.owned);
  return out.concat(extra.slice(0, PLAN_MAX_OPTIONS - out.length));
}

// Signature cards of the plan whose focus string is `themeFocus`: Map of
// normalized name -> inclusion rate. Empty when the focus is not an offered plan
// (a priority button, a custom plan) so only offered plans steer by name.
function getActivePlanSignature(themeFocus, plans) {
  const plan = (plans || []).find((p) => p.signature && planFocusMode(p) === themeFocus);
  return new Map((plan?.signature || []).map(([name, inc]) => [normalizeCardName(name), inc]));
}

function planFocusMode(plan) {
  return (plan?.themes || []).join(PLAN_THEME_SEPARATOR);
}
