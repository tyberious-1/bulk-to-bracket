// Plan options: 1-3 related themes a commander could be built around, each with
// honest coverage of what the collection can fill.
//
// Port of dev/tools/jxa-harness/plan_coverage.py (see
// dev/docs/superpowers/specs/2026-10-13-plan-first-prototyping.md). Most of an
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
// A theme that defines the commander has no distinctive cards: every deck plays its cards, so they are the
// commander's core list and cannot beat it by PLAN_MIN_LIFT (Sai, Master Thopterist: Artifacts, its top theme by
// 8x, had 0 distinctive cards while Combo had 59, so the default plan was Combo + Historic + Aggro). Among the
// PLAN_DOMINANT_TOP most-played themes, one whose distinctive cards are under PLAN_DOMINANT_SHARE of what its
// page recommends is described by everything its page recommends instead.
const PLAN_DOMINANT_SHARE = 0.25;
const PLAN_DOMINANT_TOP = 3;
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
// One word of a theme name in a form that matches across plural and adjective ("elves"/"elf", "legends"/"legendary").
function themeWordStem(word) {
  if (word === "legendary") return "legend";
  return word.replace(/ies$/, "y").replace(/ves$/, "f").replace(/s$/, "");
}

// How many of a plan's themes the commander's own words name (getCommanderTextThemes): through a theme alias
// ("elves" ~ "elf tribal", "proliferate" ~ "counters") or a one-word signal inside the theme's name ("counters" in
// "minus 1 minus 1 counters").
function planTextMatches(themes, textThemes) {
  const signals = (textThemes || []).map(normalizeThemeName).filter(Boolean);
  if (!signals.length) return 0;
  const signalWords = new Set(signals.filter((s) => !s.includes(" ")).map(themeWordStem));
  return (themes || []).filter((theme) => {
    const name = normalizeThemeName(theme);
    const aliases = getThemeAliases(theme).map(normalizeThemeName);
    if (signals.some((s) => aliases.includes(s) || getThemeAliases(s).map(normalizeThemeName).includes(name))) return true;
    return name.split(" ").some((word) => signalWords.has(themeWordStem(word)));
  }).length;
}

// A theme named for a kind of land (Guildgates) lives in its page's land section: its lands carry the theme's
// name. Plans steer nonland picks and the manabase chooses lands (Gates enter tapped, so the land rule keeps them
// out), so such a theme's nonland cards are only the commander's general list and its name would mislabel the plan
// (Codie, Vociferous Codex: "Spellslinger + Cascade + Guildgates", 10 Guildgates on the page, none in the deck).
// Snow-covered lands are basics the builder does play, so they don't count.
const PLAN_LAND_NAMED_MIN = 5;
function planThemeIsLands(slug, entries) {
  const words = normalizeThemeName(slug).split(" ").map(themeWordStem).filter((w) => w.length > 3);
  if (!words.length) return false;
  const named = (entries || []).filter((e) => e?.name && /\bland/i.test(e.label || "") && !/^snow-covered /i.test(e.name) &&
    words.some((w) => e.name.toLowerCase().includes(w)));
  return named.length >= PLAN_LAND_NAMED_MIN;
}

function buildPlanOptions(themeCardStats, coreCards, isOwned, textThemes = []) {
  const core = planWantedCards(coreCards);
  const themes = [];
  // A theme page's potentialDecks is the number of decks behind it, so the largest value ranks themes by play.
  const themeDecks = (entries) => (entries || []).reduce((top, e) => Math.max(top, Number(e?.potentialDecks || 0)), 0);
  const mostPlayed = new Set(
    Object.entries(themeCardStats || {})
      .map(([slug, entries]) => [slug, themeDecks(entries)])
      .sort((a, b) => b[1] - a[1])
      .slice(0, PLAN_DOMINANT_TOP)
      .map(([slug]) => slug)
  );
  for (const [slug, entries] of Object.entries(themeCardStats || {})) {
    if (planThemeIsLands(slug, entries) && !planTextMatches([slug], textThemes)) continue;
    const wanted = planWantedCards(entries);
    const distinctive = new Map();
    for (const [name, v] of wanted) {
      const lift = v.inc - (core.get(name)?.inc || 0);
      if (lift >= PLAN_MIN_LIFT) distinctive.set(name, v);
    }
    const dominant = mostPlayed.has(slug) && wanted.size && distinctive.size < wanted.size * PLAN_DOMINANT_SHARE;
    if (dominant) {
      themes.push({ slug, wanted, full: wanted, size: entries.length });
    } else if (distinctive.size) {
      themes.push({ slug, wanted: distinctive, full: wanted, size: entries.length });
    }
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

  // Plans the commander's own words name first, then best coverage (2026-11-26: coverage alone made High Perfect
  // Morcant, whose text is about Elves entering and -1/-1 counters, default to Reanimator + Graveyard + Elves on 56
  // owned cards over -1/-1 Counters + Tokens + Elves on 34; Sisay, who fetches legends, defaulted to Enchantress).
  // Each option must be a real alternative: it may share at most PLAN_MAX_SHARED_THEMES themes with a plan already
  // chosen. Without this Kardur offered Aristocrats+Tokens+Clones next to Lifegain+Aristocrats+Tokens.
  // A light plan (under PLAN_LIGHT_OWNED owned) gets no lift: naming it does not fill it (Bello's Elementals, 2 owned).
  for (const plan of plans) plan.textMatches = plan.owned >= PLAN_LIGHT_OWNED ? planTextMatches(plan.themes, textThemes) : 0;
  plans.sort((a, b) => b.textMatches - a.textMatches || b.owned - a.owned);
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

// Names of the owned, color-legal cards whose tags or tribal type match one theme (the matching buildCustomPlan and
// buildComboPlan share).
function matchOwnedForTheme(theme, allOwnedCardData, commanderColors, commanderName = "") {
  const text = String(theme || "").trim();
  if (!text) return [];
  const aliases = new Set(getThemeAliases(text).map((alias) => normalizeThemeName(alias)));
  const tribes = getCommanderTribalThemes([text]).map((t) => t.replace(" tribal", ""));
  // An unrecognised word still works as a creature type or rules-text word.
  const word = normalizeThemeName(text);
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
  return matches;
}

// A plan the player names (a tribe or theme). Coverage is every owned,
// color-legal card whose tags or tribal type match, with no EDHREC input.
// allOwnedCardData: Map of normalized name -> Scryfall-style card data.
function buildCustomPlan(text, allOwnedCardData, commanderColors, commanderName = "") {
  const theme = String(text || "").trim();
  if (!theme) return null;
  const matches = matchOwnedForTheme(theme, allOwnedCardData, commanderColors, commanderName);
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

// Combo builder (the Single / Combo toggle): the player stacks up to PLAN_COMBO_MAX themes. The focus string is the same
// "a~b~c" a plan uses, so the builder needs nothing new.
const PLAN_COMBO_MAX = 3;

// Picks in the order given, blanks and repeats dropped, at most PLAN_COMBO_MAX, joined for the theme: mode.
function buildComboFocus(themes) {
  const seen = new Set();
  const kept = [];
  for (const theme of themes || []) {
    const text = String(theme || "").trim();
    const key = normalizeThemeName(text);
    if (!text || seen.has(key)) continue;
    seen.add(key);
    kept.push(text);
    if (kept.length >= PLAN_COMBO_MAX) break;
  }
  return kept.join(PLAN_THEME_SEPARATOR);
}

// Coverage for a combo: owned cards that match any picked theme, each counted once. Same shape as a custom plan so the
// plan panel's coverage and "light" wording apply unchanged.
function buildComboPlan(themes, allOwnedCardData, commanderColors, commanderName = "") {
  const focus = buildComboFocus(themes);
  if (!focus) return null;
  const picked = focus.split(PLAN_THEME_SEPARATOR);
  const names = new Set();
  for (const theme of picked) {
    for (const name of matchOwnedForTheme(theme, allOwnedCardData, commanderColors, commanderName)) names.add(name);
  }
  const matches = Array.from(names);
  return {
    themes: picked,
    label: picked.map(formatThemeLabel).join(" + "),
    wanted: 0,
    owned: matches.length,
    examples: matches.slice(0, 6),
    custom: true,
    combo: true,
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

// keepOrder: the themes came ranked (the commander reading puts a named creature type first), so a build's default plan is the
// first, not the one with the most owned cards. Themes counted from the pool have no ranking worth keeping and sort by owned.
function addCollectionPlans(plans, detectedThemes, allOwnedCardData, commanderColors, commanderName = "", keepOrder = false) {
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
  if (!keepOrder) extra.sort((a, b) => b.owned - a.owned);
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

// The plan a build starts on when the player has not chosen one (2026-11-17): the first offered plan the collection supports
// (not "light"), in the order the plans were ranked. With no tags for the commander the first plan is the best-read one. A blend
// of every theme builds a deck that serves no plan. When every plan is light the best supported wins, unless even that is thin
// (fewer than PLAN_MIN_FILL_OWNED owned): then there is no default and the blend stands.
function pickDefaultPlanFocus(plans) {
  const list = Array.isArray(plans) ? plans : [];
  const supported = list.find((plan) => !plan.light);
  const best = supported || list.reduce((top, plan) => (!top || plan.owned > top.owned ? plan : top), null);
  if (!best || (best.light && best.owned < PLAN_MIN_FILL_OWNED)) return "";
  return planFocusMode(best);
}
