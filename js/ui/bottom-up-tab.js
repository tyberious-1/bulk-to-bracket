
// The Bottom-Up Build tab: pick (or accept) an archetype, a subtype and colors, build the 99 from
// the collection, then see which commanders fit. The commander-first flow is untouched.
//
// Depends on: archetypes.js, bottom-up-deck.js, bottom-up.js, commander-fit.js, theme-tab.js
//   (getThemeTabCatalog, themeTabTribeFor), edhrec.js, scryfall.js, csv.js, status.js, dom.js, state.js

const BOTTOM_UP_COLOR_LETTERS = ["W", "U", "B", "R", "G"];
const BOTTOM_UP_UNOWNED_LOOKUPS = 15;
const BOTTOM_UP_UNOWNED_SHOWN = 5;
const BOTTOM_UP_PAIRS_SHOWN = 5;

let bottomUpCardData = null;
let bottomUpSuggestions = null;
let bottomUpBusy = false;
let bottomUpError = "";
let bottomUpResult = null;
// Archetype groups the player has opened; every group starts collapsed.
let bottomUpOpenGroups = new Set();
// EDHREC budget inclusion per tag slug, fetched once; an empty map means no budget page (or Pauper).
let bottomUpBudgetCache = new Map();
let bottomUpPicks = { archetype: "midrange", subtypeKey: "", colors: new Set() };

function resetBottomUpTab() {
  bottomUpCardData = null;
  bottomUpSuggestions = null;
  bottomUpBusy = false;
  bottomUpError = "";
  bottomUpResult = null;
  bottomUpOpenGroups = new Set();
  bottomUpBudgetCache = new Map();
}

async function loadBottomUpBudgetInclusion(subtype) {
  const entry = findBottomUpEntry(bottomUpSubtypeKey(subtype));
  if (!entry || !entry.slug || isPauperFormat()) return new Map();
  if (!bottomUpBudgetCache.has(entry.slug)) bottomUpBudgetCache.set(entry.slug, await fetchEdhrecBudgetInclusion(entry.slug));
  return bottomUpBudgetCache.get(entry.slug);
}

function bottomUpColorsLabel(colors) {
  return colors.length ? colors.join("") : "Colorless";
}

function bottomUpSubtypeKey(subtype) {
  return `${subtype.kind}:${subtype.tag}`;
}

function findBottomUpEntry(key) {
  return getThemeTabCatalog().find((entry) => `${entry.kind}:${entry.tag}` === key) || null;
}

async function loadBottomUpCardData() {
  if (bottomUpCardData) return bottomUpCardData;
  const collection = getOwnedCollection();
  bottomUpCardData = await fetchCardDataBatchWithProgress(collection.uniqueRawNames, (done, total) => {
    updateProgress(5 + Math.floor((done / Math.max(total, 1)) * 90), "Reading your collection...", `${done} / ${total}`);
  });
  updateProgress(100, "Collection read", "");
  return bottomUpCardData;
}

function bottomUpOwnedCards() {
  const collection = getOwnedCollection();
  const seen = new Set();
  const cards = [];
  for (const entry of getCollectionEntries(collection)) {
    const card = bottomUpCardData.get(entry.normalizedName)
      || bottomUpCardData.get(normalizeCardName(getPrimaryCardName(entry.normalizedName)));
    if (!card || seen.has(card.name)) continue;
    seen.add(card.name);
    cards.push(card);
  }
  return cards;
}

async function findBottomUpSuggestions() {
  if (!getOwnedCollection() || bottomUpBusy) return;
  bottomUpBusy = true;
  bottomUpError = "";
  renderBottomUpTab();
  try {
    await loadBottomUpCardData();
    bottomUpSuggestions = rankBottomUpSuggestions(bottomUpOwnedCards(), getThemeTabCatalog(), themeTabTribeFor);
  } catch (error) {
    console.error(error);
    bottomUpError = error.message || "Unable to read the collection.";
  } finally {
    bottomUpBusy = false;
    renderBottomUpTab();
  }
}

async function buildBottomUpDeck(archetype, subtype, colors) {
  if (!getOwnedCollection() || bottomUpBusy) return;
  bottomUpBusy = true;
  bottomUpError = "";
  bottomUpResult = null;
  renderBottomUpTab();
  try {
    await loadBottomUpCardData();
    const owned = bottomUpOwnedCards();
    const landCount = bottomUpLandCount(archetype, colors);
    const budgetInclusion = await loadBottomUpBudgetInclusion(subtype);
    const { deck, report } = buildDeckBottomUp(owned, { archetype, subtype, colors, nonlandSlots: 99 - landCount, budgetInclusion });
    const lands = buildBottomUpManaBase(deck, colors, getOwnedCollection(), bottomUpCardData, landCount);

    const ownedKeys = new Set(owned.map((card) => normalizeCardName(card.name)));
    const entries = owned.map((card) => ({ card, owned: true }));
    const entry = findBottomUpEntry(bottomUpSubtypeKey(subtype));
    if (entry && !isPauperFormat()) {
      const listed = (await fetchEdhrecTagCommanders(entry.slug))
        .filter((c) => !ownedKeys.has(normalizeCardName(c.name)))
        .slice(0, BOTTOM_UP_UNOWNED_LOOKUPS);
      for (const item of listed) {
        const card = await getCommander(item.name);
        if (card) entries.push({ card, owned: false });
      }
    }
    const fits = rankCommanderFits(deck, buildCommanderCandidates(entries), subtype);
    bottomUpResult = {
      archetype, subtype, colors, deck, lands, report,
      original: { colors, deck, lands, report },
      commander: null,
      // Solo commanders first, partner pairs after: a pair's reward is the sum of two cards, so
      // mixed in one ranking they push every solo commander out of the top ten.
      ownedFits: [
        ...fits.filter((f) => f.owned && f.cards.length === 1).slice(0, 10),
        ...fits.filter((f) => f.owned && f.cards.length > 1).slice(0, BOTTOM_UP_PAIRS_SHOWN)
      ],
      unownedFits: fits.filter((f) => !f.owned).slice(0, BOTTOM_UP_UNOWNED_SHOWN)
    };
  } catch (error) {
    console.error(error);
    bottomUpError = error.message || "Unable to build the deck.";
  } finally {
    bottomUpBusy = false;
    renderBottomUpTab();
  }
}

function bottomUpCardLink(card) {
  return renderPreviewCardLink(card.name, scryfallCardUrl(card.name), card.imageUrl);
}

// Rebuild the 99 under a commander (or a pair): the deck keeps only the colors the commander
// has, the commander is taken out of the pool, and a pair leaves 98 cards for the deck.
function selectBottomUpCommander(index) {
  const r = bottomUpResult;
  const row = r && r.ownedFits[index];
  if (!row || bottomUpBusy) return;
  try {
    const colors = narrowDeckColors(r.original.colors, commanderIdentity(row.cards));
    const names = new Set(row.cards.map((card) => card.name));
    const pool = bottomUpOwnedCards().filter((card) => !names.has(card.name));
    const landCount = bottomUpLandCount(r.archetype, colors);
    const deckSize = 99 - (row.cards.length - 1);
    const budgetInclusion = bottomUpBudgetCache.get(findBottomUpEntry(bottomUpSubtypeKey(r.subtype))?.slug) || new Map();
    const { deck, report } = buildDeckBottomUp(pool, { archetype: r.archetype, subtype: r.subtype, colors, nonlandSlots: deckSize - landCount, budgetInclusion });
    const lands = buildBottomUpManaBase(deck, colors, getOwnedCollection(), bottomUpCardData, landCount);
    const kept = new Set(deck.map((card) => card.name));
    r.commander = { cards: row.cards, swappedOut: r.original.deck.filter((card) => !kept.has(card.name)).map((card) => card.name) };
    Object.assign(r, { colors, deck, lands, report });
  } catch (error) {
    console.error(error);
    showToast(error.message || "Unable to use that commander.");
  }
  renderBottomUpTab();
}

function clearBottomUpCommander() {
  const r = bottomUpResult;
  if (!r) return;
  r.commander = null;
  Object.assign(r, r.original);
  renderBottomUpTab();
}

function renderBottomUpSuggestions() {
  if (bottomUpBusy && !bottomUpSuggestions) return '<p class="theme-tab-status">Reading your collection...</p>';
  if (!bottomUpSuggestions) {
    return `
      <p class="theme-tab-status">Start from your pile instead of a commander: see which deck types your collection supports best.</p>
      <button id="bottomUpSuggestBtn" type="button">Suggest decks from my collection</button>`;
  }
  if (!bottomUpSuggestions.length) return '<p class="theme-tab-status">No subtype stands out in this collection yet. Pick one yourself below.</p>';
  return `
    <div class="bu-suggestions">
      ${groupBottomUpSuggestions(bottomUpSuggestions).map((group) => `
        <details class="bu-group" data-bu-group="${group.id}"${bottomUpOpenGroups.has(group.id) ? " open" : ""}>
          <summary>${ARCHETYPES[group.id].label} <span class="plan-tag">${group.items.length}</span></summary>
          <div class="bu-group-grid">
            ${group.items.map(({ row, index }) => `
              <button type="button" class="bu-suggestion" data-bu-suggestion="${index}"
                title="${escapeHtml([row.support, row.quality, ...row.roles].join("; "))}">
                ${escapeHtml(row.subtype.label)}
                <span class="plan-tag">${escapeHtml(bottomUpColorsLabel(row.colors))}</span>
                <span class="status-chip status-${row.rating === "Strong" ? "deep" : row.rating === "OK" ? "ok" : "thin"}">${row.rating}</span>
                <span class="bu-suggestion-note">${row.report.members} + ${row.report.payoffs}</span>
              </button>`).join("")}
          </div>
        </details>`).join("")}
    </div>`;
}

function renderBottomUpPickers() {
  const subtypeOptions = getThemeTabCatalog().map((entry) => {
    const key = `${entry.kind}:${entry.tag}`;
    return `<option value="${escapeHtml(key)}"${key === bottomUpPicks.subtypeKey ? " selected" : ""}>${escapeHtml(entry.label)} (${entry.kind === "tribal" ? "tribe" : "theme"})</option>`;
  }).join("");
  const archetypeOptions = ARCHETYPE_ORDER.map((id) =>
    `<option value="${id}"${id === bottomUpPicks.archetype ? " selected" : ""}>${ARCHETYPES[id].label}</option>`).join("");
  const colorButtons = BOTTOM_UP_COLOR_LETTERS.map((c) =>
    `<button type="button" class="mode-toggle-btn${bottomUpPicks.colors.has(c) ? " active" : ""}" data-bu-color="${c}">${c}</button>`).join("");
  return `
    <div class="priority-section-label">Or pick your own</div>
    <div class="bu-pickers">
      <select id="buArchetype">${archetypeOptions}</select>
      <select id="buSubtype"><option value="">Choose a subtype</option>${subtypeOptions}</select>
      <span class="bu-colors">${colorButtons}</span>
      <button id="buBuildBtn" type="button">Build this deck</button>
    </div>`;
}

function renderBottomUpReliability(r) {
  const rel = deckReliability(r.deck, r.lands, r.colors, { subtypeLabel: r.subtype.kind === "tribal" ? r.subtype.label : "" });
  if (!rel.lines.length) return "";
  const chip = (rating) => `<span class="status-chip status-${rating === "good" ? "deep" : rating === "OK" ? "ok" : "thin"}">${rating}</span>`;
  const rows = rel.lines.map((line) => `<li>${escapeHtml(line.label)}: ${Math.round(line.odds * 100)}% ${chip(line.rating)}</li>`).join("");
  const s = rel.summary;
  return `
      <details class="bu-reliability">
        <summary>Reliability: ${s.good} good, ${s.ok} OK, ${s.weak} weak${s.weak ? ` (weakest: ${escapeHtml(s.weakest.label)})` : ""}</summary>
        <ul class="bu-list">${rows}</ul>
        ${rel.notes.length ? `<p class="detail-note">${escapeHtml(rel.notes.join("; "))}.</p>` : ""}
        <p class="detail-note">Odds on the play with no mulligans, from a ${rel.library}-card library. This measures how consistently the deck does something, not how strong it is. Ramp counts reliable mana only, cantrips and loots count half as card draw, color sources count lands only, and a growing mana source such as Cheering Crowd counts as one.</p>
      </details>`;
}

function renderBottomUpResult() {
  const r = bottomUpResult;
  if (!r) return "";
  const groups = {};
  for (const card of r.deck) (groups[card.bottomUpRole] = groups[card.bottomUpRole] || []).push(card);
  const order = ["wipe", "removal", "ramp", "draw", "synergy"];
  const sections = order.filter((role) => groups[role]).map((role) => `
    <div class="priority-section-label">${role === "synergy" ? "Creatures and synergy" : role} (${groups[role].length})</div>
    <ul class="bu-list">${groups[role].map((c) => `<li>${bottomUpCardLink(c)}${c.standing === "member" || c.standing === "payoff" ? ` <span class="plan-tag">${c.standing}</span>` : ""}</li>`).join("")}</ul>`).join("");
  const d = describeBuild(r.report);
  // fitRow's index must stay the position in r.ownedFits, which the click handler reads back.
  const indexed = r.ownedFits.map((fit, index) => Object.assign({ index }, fit));
  const solo = indexed.filter((f) => f.cards.length === 1);
  const pairs = indexed.filter((f) => f.cards.length > 1);
  const chosen = r.commander ? r.commander.cards.map((card) => card.name).join("|") : "";
  const fitRow = (f) => {
    const index = f.index;
    const selected = f.cards.map((card) => card.name).join("|") === chosen;
    return `<li>${f.cards.map(bottomUpCardLink).join(" + ")}${f.cards.length > 1 ? ' <span class="plan-tag">partners</span>' : ""}${f.owned ? "" : ' <span class="plan-tag">not in your collection</span>'}
    ${f.cuts.length ? `<span class="detail-note">cuts ${f.cuts.length}: ${escapeHtml(f.cuts.slice(0, 5).join(", "))}${f.cuts.length > 5 ? ", ..." : ""}</span>` : '<span class="detail-note">no cuts</span>'}
    ${f.owned ? `<button type="button" class="bu-use-commander" data-bu-commander="${index}"${selected ? " disabled" : ""}>${selected ? "Using" : "Use as commander"}</button>` : ""}</li>`;
  };
  const commanderBox = r.commander ? `
      <div class="bu-commander">
        <strong>Commander:</strong> ${r.commander.cards.map(bottomUpCardLink).join(" + ")}${r.commander.cards.length > 1 ? ' <span class="plan-tag">partners</span>' : ""}
        <button id="buClearCommander" type="button" class="bu-use-commander">Remove commander</button>
        ${r.commander.swappedOut.length ? `<p class="detail-note">Swapped out for this commander (${r.commander.swappedOut.length}): ${escapeHtml(r.commander.swappedOut.slice(0, 8).join(", "))}${r.commander.swappedOut.length > 8 ? ", ..." : ""}</p>` : ""}
      </div>` : "";
  return `
    <div class="bu-result">
      <h3>${escapeHtml(ARCHETYPES[r.archetype].label)} ${escapeHtml(r.subtype.label)} <span class="plan-tag">${escapeHtml(bottomUpColorsLabel(r.colors))}</span></h3>
      ${commanderBox}
      <p class="detail-note">${escapeHtml(d.support)}; ${escapeHtml(d.quality)}; average mana value ${r.report.avgCmc}; ${r.lands.length} lands.${d.roles.length ? ` ${escapeHtml(d.roles.join("; "))}.` : ""}${d.notes.length ? ` ${escapeHtml(d.notes.join("; "))}.` : ""}</p>
      ${renderBottomUpReliability(r)}
      <button id="buCopyBtn" type="button">Copy decklist</button>
      <div class="priority-section-label">Commanders you own that fit</div>
      <ul class="bu-list">${solo.length ? solo.map(fitRow).join("") : '<li class="detail-note">None of your commanders fit these colors well.</li>'}</ul>
      ${pairs.length ? `<div class="priority-section-label">Partner pairs you own that fit</div><ul class="bu-list">${pairs.map(fitRow).join("")}</ul>` : ""}
      ${r.unownedFits.length ? `<div class="priority-section-label">Commanders that would suit it</div><ul class="bu-list">${r.unownedFits.map(fitRow).join("")}</ul>` : ""}
      ${sections}
    </div>`;
}

function renderBottomUpTab() {
  const panel = document.getElementById("bottomUpPanel");
  if (!panel) return;
  if (!getOwnedCollection()) {
    panel.innerHTML = '<p class="theme-tab-status">Upload your collection on the Build a Deck tab first.</p>';
    return;
  }
  panel.innerHTML = `
    ${bottomUpError ? `<p class="theme-tab-status">${escapeHtml(bottomUpError)}</p>` : ""}
    ${renderBottomUpSuggestions()}
    ${renderBottomUpPickers()}
    ${bottomUpBusy && bottomUpSuggestions ? '<p class="theme-tab-status">Building...</p>' : ""}
    ${renderBottomUpResult()}`;
}

function bindBottomUpTab() {
  const panel = document.getElementById("bottomUpPanel");
  if (!panel) return;

  // "toggle" does not bubble, so listen in the capture phase; the tab redraws on every pick and
  // would otherwise close the groups again.
  panel.addEventListener("toggle", (event) => {
    const id = event.target.dataset?.buGroup;
    if (!id) return;
    if (event.target.open) bottomUpOpenGroups.add(id); else bottomUpOpenGroups.delete(id);
  }, true);

  panel.addEventListener("change", (event) => {
    if (event.target.id === "buArchetype") bottomUpPicks.archetype = event.target.value;
    if (event.target.id === "buSubtype") bottomUpPicks.subtypeKey = event.target.value;
  });

  bindPreviewHoverImages("bottomUpPanel");

  panel.addEventListener("click", (event) => {
    const target = event.target;
    if (target.id === "buClearCommander") { clearBottomUpCommander(); return; }
    const useBtn = target.closest?.("[data-bu-commander]");
    if (useBtn) { selectBottomUpCommander(Number(useBtn.dataset.buCommander)); return; }
    if (target.id === "bottomUpSuggestBtn") { findBottomUpSuggestions(); return; }

    const color = target.dataset?.buColor;
    if (color) {
      if (bottomUpPicks.colors.has(color)) bottomUpPicks.colors.delete(color); else bottomUpPicks.colors.add(color);
      renderBottomUpTab();
      return;
    }

    const suggestion = target.closest?.("[data-bu-suggestion]");
    if (suggestion && bottomUpSuggestions) {
      const row = bottomUpSuggestions[Number(suggestion.dataset.buSuggestion)];
      if (row) buildBottomUpDeck(row.archetype, row.subtype, row.colors);
      return;
    }

    if (target.id === "buBuildBtn") {
      const entry = findBottomUpEntry(bottomUpPicks.subtypeKey);
      if (!entry) { showToast("Choose a subtype first."); return; }
      const colors = BOTTOM_UP_COLOR_LETTERS.filter((c) => bottomUpPicks.colors.has(c));
      // No color picked would build from colorless cards alone, which is never what was meant.
      if (!colors.length) { showToast("Choose at least one color."); return; }
      buildBottomUpDeck(bottomUpPicks.archetype, toBottomUpSubtype(entry, themeTabTribeFor), colors);
      return;
    }

    if (target.id === "buCopyBtn" && bottomUpResult) {
      const text = bottomUpDecklistText([...(bottomUpResult.commander ? bottomUpResult.commander.cards : []), ...bottomUpResult.deck, ...bottomUpResult.lands]);
      navigator.clipboard.writeText(text).then(() => showToast("Decklist copied."), () => showToast("Copy failed."));
    }
  });
}
