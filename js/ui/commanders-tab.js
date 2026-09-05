// The "Your Commanders" tab: every commander the uploaded collection owns,
// ranked by how many decks EDHREC has for it, with a match percentage fetched
// one commander at a time.
//
// Ranking is deliberately separate from matching. The ranking costs 32 requests
// for the whole list and caches for a week; a match costs one request per
// commander, so it happens only when asked for.
//
// Depends on: cache.js, commander-match.js, commander.js, csv.js, dom.js,
//   edhrec.js, scryfall.js, state.js, status.js, text.js

let ownedCommanders = [];
let commanderMatches = new Map();
let commanderSortMode = "decks";
let commanderScanBusy = false;

// Empty means no filter. "C" stands in for the colorless identity, which is the
// empty set of colors and so has no pip of its own to toggle.
let commanderColorFilter = new Set();

function activateTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.tab !== tabName);
  });

  if (tabName === "commanders") renderCommandersTab();
}

// A new collection invalidates everything derived from the old one: which
// commanders are owned, and every percentage measured against it. Without this
// the tab keeps rendering the previous upload's list, and the button that would
// rank the new one is hidden because that stale list is not empty.
//
// The rankings themselves are the same for every collection, so a cached copy
// rebuilds the list on the spot rather than asking to rank again.
function resetCommanderScan() {
  ownedCommanders = [];
  commanderMatches = new Map();

  const collection = getOwnedCollection();
  if (!collection) return;

  const cached = readPersistedCommanderRankings();
  if (cached) ownedCommanders = findOwnedRankedCommanders(collection, cached);
}

function setCommanderScanBusy(busy) {
  commanderScanBusy = busy;
  document.querySelectorAll("#commandersPanel button").forEach((btn) => {
    btn.disabled = busy;
  });
}

function renderCommanderPips(colors) {
  const displayColors = sortColorsWubrg(colors);
  const pips = displayColors.length ? displayColors : ["C"];
  return pips
    .map((color) => `<span class="color-pip pip-${escapeHtml(color)}">${escapeHtml(color)}</span>`)
    .join("");
}

// A commander EDHREC has no page for is recorded so the row stops offering a
// button, but it has no percentage -- it is not a scored row.
function getCommanderMatchResult(commander) {
  const match = commanderMatches.get(commander.slug);
  return match && match !== "unavailable" ? match : null;
}

// An exact identity match: picking U and B offers the commanders of a Dimir
// deck, not every commander a Dimir deck could run.
function matchesColorFilter(commander) {
  if (!commanderColorFilter.size) return true;

  const colors = commander.colors || [];
  if (commanderColorFilter.has("C")) return colors.length === 0;
  if (colors.length !== commanderColorFilter.size) return false;
  return colors.every((color) => commanderColorFilter.has(color));
}

// Checked rows sort by match, and anything unchecked sinks below them -- an
// unchecked row is an unknown percentage, not a zero.
function getSortedCommanders() {
  const rows = ownedCommanders.filter(matchesColorFilter);
  if (commanderSortMode !== "match") return rows;

  return rows.sort((a, b) => {
    const left = getCommanderMatchResult(a);
    const right = getCommanderMatchResult(b);
    // Coverage caps at 100, so a raw candidate count separates the commanders
    // the collection can more than fill.
    if (left && right) {
      return right.percent - left.percent || right.usable - left.usable || b.decks - a.decks;
    }
    if (left) return -1;
    if (right) return 1;
    return b.decks - a.decks;
  });
}

function renderMatchCell(commander) {
  const match = commanderMatches.get(commander.slug);

  if (match === "unavailable") {
    return `<span class="match-empty">no EDHREC page</span>`;
  }

  if (!match) {
    return `<button class="match-btn" type="button" data-check-slug="${escapeHtml(commander.slug)}">Check</button>`;
  }

  return `
    <div class="match-value">${match.percent}%</div>
    <div class="match-detail">${match.usable} candidates / ${match.slots} slots</div>
  `;
}

function renderCommandersTab() {
  const panel = document.getElementById("commandersPanel");
  if (!panel) return;

  const collection = getOwnedCollection();
  if (!collection) {
    panel.innerHTML = `
      <div class="empty-state">
        <p>Upload a ManaBox CSV on the Build a Deck tab, and every commander you
        own shows up here ranked by how many decks EDHREC has for it.</p>
      </div>
    `;
    return;
  }

  if (!ownedCommanders.length) {
    panel.innerHTML = `
      <div class="empty-state">
        <p>Rank the commanders in your collection against EDHREC's most-played
        lists. This reads 32 pages once and caches them for a week.</p>
        <button id="rankCommandersBtn" type="button">Rank my commanders</button>
      </div>
    `;
    return;
  }

  const rows = getSortedCommanders();
  const checkedCount = rows.filter(getCommanderMatchResult).length;
  const filtered = commanderColorFilter.size > 0;

  panel.innerHTML = `
    <div class="color-filter">
      ${["C", "W", "U", "B", "R", "G"].map((color) => `
        <button
          class="color-pip pip-${color} color-pip-btn ${commanderColorFilter.has(color) ? "active" : ""}"
          type="button"
          data-filter-color="${color}"
          title="${color === "C" ? "Colorless commanders" : `Commanders whose identity is exactly this${commanderColorFilter.size ? " combination" : ""}`}"
        >${color}</button>
      `).join("")}
      ${filtered ? `<button id="clearColorFilterBtn" class="clear-filter-btn" type="button">Clear</button>` : ""}
    </div>

    <div class="commanders-toolbar">
      <div class="commanders-count">
        ${filtered
          ? `${rows.length} of ${ownedCommanders.length} commanders shown`
          : `${rows.length} commanders owned`} &middot; ${checkedCount} checked
      </div>
      <div class="commanders-actions">
        <button id="sortCommandersBtn" type="button">
          Sort by ${commanderSortMode === "match" ? "EDHREC decks" : "match"}
        </button>
        <button id="checkTopCommandersBtn" type="button">Check top 10</button>
      </div>
    </div>

    <table class="commanders-table">
      <thead>
        <tr>
          <th class="col-rank">#</th>
          <th>Commander</th>
          <th class="col-colors">Colors</th>
          <th class="col-decks">EDHREC decks</th>
          <th class="col-match">Match</th>
          <th class="col-build"></th>
        </tr>
      </thead>
      <tbody>
        ${rows.length ? "" : `
          <tr>
            <td colspan="6" class="commanders-empty">
              You own no commander of exactly that color identity.
            </td>
          </tr>
        `}
        ${rows.map((commander, index) => `
          <tr>
            <td class="col-rank">${index + 1}</td>
            <td>
              <span class="commander-name">${escapeHtml(commander.name)}</span>
              ${commander.isPair ? `<span class="commander-tag">partners</span>` : ""}
            </td>
            <td class="col-colors">${renderCommanderPips(commander.colors)}</td>
            <td class="col-decks">${commander.decks.toLocaleString()}</td>
            <td class="col-match">${renderMatchCell(commander)}</td>
            <td class="col-build">
              <button class="build-btn" type="button" data-build-slug="${escapeHtml(commander.slug)}">Build</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  if (commanderScanBusy) setCommanderScanBusy(true);
}

async function rankOwnedCommanders() {
  const collection = getOwnedCollection();
  if (!collection || commanderScanBusy) return;

  setCommanderScanBusy(true);
  try {
    let rankings = readPersistedCommanderRankings();

    if (!rankings) {
      updateProgress(10, "Reading EDHREC commander rankings...");
      rankings = await getEdhrecCommanderRankings((done, total) => {
        updateProgress(
          10 + Math.floor((done / Math.max(total, 1)) * 80),
          "Reading EDHREC commander rankings...",
          `${done} / ${total} color pages`
        );
      });
      if (rankings.length) persistCommanderRankings(rankings);
    }

    ownedCommanders = findOwnedRankedCommanders(collection, rankings);

    if (!ownedCommanders.length) {
      showToast("No EDHREC-ranked commanders found in this collection.");
      updateProgress(0, "Idle");
      return;
    }

    updateProgress(100, "Commanders ranked", `${ownedCommanders.length} owned`);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Unable to read EDHREC commander rankings.");
    updateProgress(0, "Error");
  } finally {
    setCommanderScanBusy(false);
    renderCommandersTab();
  }
}

// One commander: its recommendation pool from EDHREC, then card data for just
// the owned slice of that pool. The card cache is shared with the build flow,
// so a commander checked after a build costs no Scryfall traffic at all.
async function checkCommanderMatch(commander) {
  const collection = getOwnedCollection();
  if (!collection) return;

  const pool = await getEdhrecCommanderPool(commander.slug);
  if (!pool || !pool.cards.length) {
    commanderMatches.set(commander.slug, "unavailable");
    return;
  }

  const ownedPoolNames = pool.cards
    .map((entry) => entry.name)
    .filter((name) => hasOwnedCard(collection, name));

  const cardData = await fetchCardDataBatchWithProgress(
    [...ownedPoolNames, ...commander.names],
    null
  );

  commanderMatches.set(commander.slug, computeCommanderMatch(commander, pool, collection, cardData));
}

async function checkCommanderMatches(commanders) {
  if (commanderScanBusy) return;

  const pending = commanders.filter((commander) => !commanderMatches.get(commander.slug));
  if (!pending.length) return;

  setCommanderScanBusy(true);
  try {
    let done = 0;
    for (const commander of pending) {
      updateProgress(
        Math.floor((done / pending.length) * 100),
        "Checking collection match...",
        commander.name
      );
      await checkCommanderMatch(commander);
      done += 1;
      renderCommandersTab();
    }
    updateProgress(100, "Match check complete", `${done} checked`);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Unable to check that commander.");
    updateProgress(0, "Error");
  } finally {
    setCommanderScanBusy(false);
    renderCommandersTab();
  }
}

// Hand a commander to the build flow: fill the fields the same way picking it
// from the autocomplete would, so the partner row and button state follow.
async function buildFromCommander(commander) {
  activateTab("build");

  commanderInput.value = commander.names[0];
  const card = await getCommander(commander.names[0]);
  setCommanderCard(card);
  refreshPartnerField(card);

  if (commander.isPair && commander.names[1]) {
    partnerInput.value = commander.names[1];
    setPartnerCard(await getCommander(commander.names[1]));
  }

  updateGenerateButtonState();
  showToast(`${commander.name} loaded. Upload is already set -- hit Generate Deck.`);
}

function findOwnedCommanderBySlug(slug) {
  return ownedCommanders.find((commander) => commander.slug === slug) || null;
}

function bindCommandersTab() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
  });

  const panel = document.getElementById("commandersPanel");
  if (!panel) return;

  panel.addEventListener("click", (event) => {
    if (event.target.id === "rankCommandersBtn") {
      rankOwnedCommanders();
      return;
    }

    // Colorless is the empty identity, so it cannot be held alongside a color.
    const filterColor = event.target.dataset?.filterColor;
    if (filterColor) {
      if (commanderColorFilter.has(filterColor)) commanderColorFilter.delete(filterColor);
      else if (filterColor === "C") commanderColorFilter = new Set(["C"]);
      else {
        commanderColorFilter.delete("C");
        commanderColorFilter.add(filterColor);
      }
      renderCommandersTab();
      return;
    }

    if (event.target.id === "clearColorFilterBtn") {
      commanderColorFilter = new Set();
      renderCommandersTab();
      return;
    }

    if (event.target.id === "sortCommandersBtn") {
      commanderSortMode = commanderSortMode === "match" ? "decks" : "match";
      renderCommandersTab();
      return;
    }

    if (event.target.id === "checkTopCommandersBtn") {
      checkCommanderMatches(getSortedCommanders().slice(0, 10));
      return;
    }

    const checkSlug = event.target.dataset?.checkSlug;
    if (checkSlug) {
      const commander = findOwnedCommanderBySlug(checkSlug);
      if (commander) checkCommanderMatches([commander]);
      return;
    }

    const buildSlug = event.target.dataset?.buildSlug;
    if (buildSlug) {
      const commander = findOwnedCommanderBySlug(buildSlug);
      if (commander) buildFromCommander(commander);
    }
  });
}
