// The Theme/Tribal tab: pick a theme or tribal type, then pick an owned
// commander EDHREC ranks highly for it, then jump into the Build tab with
// that theme already focused.
//
// The catalog is derived from DETECTABLE_CARD_TAGS (scoring.js) and
// TRIBAL_PLURAL_ALIASES (themes.js) rather than hand-maintained separately --
// every entry shown here is guaranteed to have real scoring behavior behind
// it (see getSupportedThemes' "no detector" gap this same guarantee grew
// out of), and a future detector addition shows up here automatically with
// no second list to keep in sync.
//
// Depends on: constants.js, text.js, format.js, themes.js, scoring.js,
//   edhrec.js, commander-match.js, commanders-tab.js, csv.js, dom.js, state.js

// Internal detector tags that aren't real standalone EDHREC tag pages --
// either 403 outright (confirmed against json.edhrec.com/pages/tags/) or
// duplicate another entry's real name.
const THEME_TAB_EXCLUDED_TAGS = new Set(["gowide", "opponent draw", "countersmatter"]);

// A handful of internal tags are proxies for a differently-named real EDHREC
// tag page -- confirmed one at a time against the live site rather than
// guessed from the tag string.
const THEME_TAB_TAG_OVERRIDES = {
  enchantments: { label: "Enchantress", slug: "enchantress" },
  counters: { label: "+1/+1 Counters", slug: "plus-1-plus-1-counters" },
  hatebears: { label: "Stax", slug: "stax" },
  "the ring tempts you": { label: "The Ring", slug: "the-ring" },
  // toEdhrecSlug("lands") is "lands", which 403s -- the detector's "lands" tag
  // covers both landfall and land-tutoring text (see detectCardTags), and
  // EDHREC's real page for that is "lands-matter".
  lands: { label: "Lands Matter", slug: "lands-matter" },
  etb: { label: "ETB", slug: "etb" }
};

// Tribal types with no EDHREC tag page of their own (too rare to track) --
// still valid for in-deck detection, just not offered as a pick here.
const THEME_TAB_EXCLUDED_TRIBAL_SINGULARS = new Set(["warlock", "artifact creature"]);

// artificers/golems/thopters/constructs live only in getThemeAliases'
// directAliases table -- they carry bonus non-tribal aliases alongside their
// tribal one, so they were never folded into TRIBAL_PLURAL_ALIASES. Listed
// once here so the catalog can include them without duplicating that table.
const THEME_TAB_EXTRA_TRIBAL_PLURALS = {
  artificers: "artificer tribal",
  golems: "golem tribal",
  thopters: "thopter tribal",
  constructs: "construct tribal"
};

let themeTabCatalog = null;
let themeTabQuery = "";
let themeTabSelected = null;
let themeTabResults = null;
let themeTabBusy = false;
let themeTabError = "";

function buildThemeTabCatalog() {
  const entries = [];

  for (const tag of DETECTABLE_CARD_TAGS) {
    if (THEME_TAB_EXCLUDED_TAGS.has(tag)) continue;
    const override = THEME_TAB_TAG_OVERRIDES[tag];
    entries.push({
      kind: "theme",
      tag,
      label: override ? override.label : formatThemeLabel(tag),
      slug: override ? override.slug : toEdhrecSlug(tag)
    });
  }

  const tribalPlurals = { ...TRIBAL_PLURAL_ALIASES, ...THEME_TAB_EXTRA_TRIBAL_PLURALS };
  for (const [plural, tribalAlias] of Object.entries(tribalPlurals)) {
    const singular = tribalAlias.replace(" tribal", "");
    if (THEME_TAB_EXCLUDED_TRIBAL_SINGULARS.has(singular)) continue;
    entries.push({
      kind: "tribal",
      tag: plural,
      label: formatThemeLabel(plural),
      slug: toEdhrecSlug(plural)
    });
  }

  entries.sort((a, b) => a.label.localeCompare(b.label));
  return entries;
}

function getThemeTabCatalog() {
  if (!themeTabCatalog) themeTabCatalog = buildThemeTabCatalog();
  return themeTabCatalog;
}

function getFilteredThemeTabCatalog() {
  const catalog = getThemeTabCatalog();
  const query = themeTabQuery.trim().toLowerCase();
  if (!query) return catalog;
  return catalog.filter((entry) => entry.label.toLowerCase().includes(query));
}

function findThemeTabCatalogEntry(kind, tag) {
  return getThemeTabCatalog().find((entry) => entry.kind === kind && entry.tag === tag) || null;
}

function renderThemeTabCatalogList() {
  const container = document.getElementById("themeTabCatalog");
  if (!container) return;

  const entries = getFilteredThemeTabCatalog();
  container.innerHTML = entries.length
    ? entries.map((entry) => `
        <button
          class="theme-tab-pick ${themeTabSelected && themeTabSelected.kind === entry.kind && themeTabSelected.tag === entry.tag ? "active" : ""}"
          type="button"
          data-theme-kind="${escapeHtml(entry.kind)}"
          data-theme-tag="${escapeHtml(entry.tag)}"
        >${escapeHtml(entry.label)}</button>
      `).join("")
    : `<p class="theme-tab-empty">No themes match "${escapeHtml(themeTabQuery)}".</p>`;
}

function renderThemeTabResultsList() {
  const container = document.getElementById("themeTabResults");
  if (!container) return;

  if (!themeTabSelected) {
    container.innerHTML = "";
    return;
  }

  if (themeTabBusy) {
    container.innerHTML = `<p class="theme-tab-status">Loading commanders for ${escapeHtml(themeTabSelected.label)}...</p>`;
    return;
  }

  if (themeTabError) {
    container.innerHTML = `<p class="theme-tab-status">${escapeHtml(themeTabError)}</p>`;
    return;
  }

  const results = themeTabResults || [];
  if (!results.length) {
    container.innerHTML = `
      <p class="theme-tab-status">
        ${isPauperFormat()
          ? `None of your owned uncommon creatures match ${escapeHtml(themeTabSelected.label)}.`
          : `None of your owned commanders show up in EDHREC's top commanders for ${escapeHtml(themeTabSelected.label)}.`}
      </p>
    `;
    return;
  }

  container.innerHTML = `
    <table class="commanders-table">
      <thead>
        <tr>
          <th class="col-rank">#</th>
          <th>Commander</th>
          <th class="col-decks">EDHREC decks</th>
          <th class="col-build"></th>
        </tr>
      </thead>
      <tbody>
        ${results.map((commander, index) => `
          <tr>
            <td class="col-rank">${index + 1}</td>
            <td>
              <span class="commander-name">${escapeHtml(commander.name)}</span>
              ${commander.isPair ? `<span class="commander-tag">partners</span>` : ""}
              ${commander.unranked ? `<span class="commander-tag">not on EDHREC's top list</span>` : ""}
            </td>
            <td class="col-decks">${commander.unranked ? "&mdash;" : commander.decks.toLocaleString()}</td>
            <td class="col-build">
              <button class="build-btn" type="button" data-theme-build-slug="${escapeHtml(commander.slug)}">Build</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderThemeTab() {
  const panel = document.getElementById("themePanel");
  if (!panel) return;

  const collection = getOwnedCollection();
  if (!collection) {
    panel.innerHTML = `
      <div class="empty-state">
        <p>Upload a ManaBox CSV on the Build a Deck tab first -- this tab
        matches theme picks against what you own.</p>
      </div>
    `;
    return;
  }

  panel.innerHTML = `
    <input
      id="themeTabSearch"
      type="text"
      class="theme-tab-search"
      placeholder="Search themes and tribal types..."
      autocomplete="off"
      value="${escapeHtml(themeTabQuery)}"
    >
    <div id="themeTabCatalog" class="theme-tab-catalog"></div>
    <div id="themeTabResults" class="theme-tab-results"></div>
  `;

  renderThemeTabCatalogList();
  renderThemeTabResultsList();
}

// EDHREC's tag page hard-caps its commander list at 24 Top Commanders + 5 New
// Commanders regardless of theme, so a personal collection routinely owns
// only one or two of those 29 names -- looking sparse even when the matching
// itself is correct. For a tribal pick this can be supplemented for free:
// hasTribalType reads the same card type/text detectCardTags already scores
// with, so any owned legendary creature of that type is a real candidate
// whether or not EDHREC's top-29 list happened to include it.
//
// Best effort only, from whatever the local card cache already has (warmed by
// a previous build or by "scan unranked commanders" on the Commanders tab) --
// this must stay instant, so it never triggers a fresh Scryfall fetch.
//
// Under pauper format this is the *only* source (see selectThemeTabEntry):
// EDHREC's tag pages are full-Commander data with no PDH equivalent, same
// reasoning as findOwnedUnrankedCommanders on the Commanders tab, so a theme
// pick needs a non-tribal path here too, not just the tribal one this
// originally covered.
function cardMatchesThemeTabEntry(card, entry) {
  if (entry.kind === "tribal") {
    const tribalAlias = TRIBAL_PLURAL_ALIASES[entry.tag] || THEME_TAB_EXTRA_TRIBAL_PLURALS[entry.tag];
    const tribe = tribalAlias ? tribalAlias.replace(" tribal", "") : null;
    return tribe ? hasTribalType(card, tribe) : false;
  }
  return detectCardTags(card).includes(entry.tag);
}

function findOwnedThemeTabCommandersFromCache(collection, entry, alreadyFound) {
  const seen = new Set();
  for (const commander of alreadyFound) {
    for (const name of commander.names) seen.add(normalizeCardName(name));
  }

  const found = [];
  for (const collectionEntry of getCollectionEntries(collection)) {
    if (seen.has(collectionEntry.normalizedName)) continue;

    const card = cardCache.get(collectionEntry.normalizedName)
      || cardCache.get(normalizeCardName(getPrimaryCardName(collectionEntry.normalizedName)));
    if (!card) continue;
    if (!canBeActiveCommander(card)) continue;
    if (!cardMatchesThemeTabEntry(card, entry)) continue;

    seen.add(collectionEntry.normalizedName);
    found.push({
      name: card.name,
      slug: toEdhrecSlug(getPrimaryCardName(card.name)),
      decks: 0,
      names: [card.name],
      isPair: false,
      deckSize: 99,
      unranked: true
    });
  }

  return found.sort((a, b) => a.name.localeCompare(b.name));
}

async function selectThemeTabEntry(entry) {
  themeTabSelected = entry;
  themeTabResults = null;
  themeTabError = "";
  themeTabBusy = true;
  renderThemeTabCatalogList();
  renderThemeTabResultsList();

  try {
    const collection = getOwnedCollection();
    const pauper = isPauperFormat();

    // EDHREC's tag pages are full-Commander data (any rarity) with no PDH
    // equivalent -- under pauper format they're the wrong card pool
    // entirely, so skip the fetch and rely on the cache scan alone, the same
    // way main.js and the Commanders tab skip EDHREC under this format.
    const ranked = pauper
      ? []
      : (await fetchEdhrecTagCommanders(entry.slug))
          .map((candidate) => resolveOwnedCommanderEntry(collection, candidate))
          .filter(Boolean);

    const supplemental = pauper || entry.kind === "tribal"
      ? findOwnedThemeTabCommandersFromCache(collection, entry, ranked)
      : [];

    themeTabResults = [...ranked, ...supplemental].sort((a, b) => b.decks - a.decks);
  } catch (error) {
    console.error(error);
    themeTabError = error.message || `Unable to load commanders for ${entry.label}.`;
  } finally {
    themeTabBusy = false;
    renderThemeTabResultsList();
  }
}

function bindThemeTab() {
  const panel = document.getElementById("themePanel");
  if (!panel) return;

  panel.addEventListener("input", (event) => {
    if (event.target.id !== "themeTabSearch") return;
    themeTabQuery = event.target.value;
    renderThemeTabCatalogList();
  });

  panel.addEventListener("click", (event) => {
    const pick = event.target.closest(".theme-tab-pick");
    if (pick) {
      const entry = findThemeTabCatalogEntry(pick.dataset.themeKind, pick.dataset.themeTag);
      if (entry) selectThemeTabEntry(entry);
      return;
    }

    const buildSlug = event.target.dataset?.themeBuildSlug;
    if (buildSlug && themeTabResults) {
      const commander = themeTabResults.find((c) => c.slug === buildSlug);
      if (commander && themeTabSelected) {
        setPendingThemeFocus(themeTabSelected.tag);
        buildFromCommander(commander);
      }
    }
  });
}
