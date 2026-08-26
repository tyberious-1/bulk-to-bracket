// The Deck Report panel: skeletons, empty/error states, stat cards, bracket
// badge, game changers, build breakdown, and warnings.
//
// Depends on: deck-stats.js, dom.js, text.js

function renderLoadingState() {
  const preview = document.getElementById("exportPreview");

  if (deckStats) {
    deckStats.innerHTML = `
      <div class="stat-skeleton-row">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-pill"></div>
      </div>
      <div class="stat-grid">
        <div class="skeleton skeleton-stat"></div>
        <div class="skeleton skeleton-stat"></div>
        <div class="skeleton skeleton-stat"></div>
        <div class="skeleton skeleton-stat"></div>
      </div>
    `;
  }

  if (preview) {
    preview.innerHTML = `
      <div class="preview-section fade-up">
        <div class="skeleton skeleton-section-title"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line short"></div>
      </div>
      <div class="preview-section fade-up">
        <div class="skeleton skeleton-section-title"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line short"></div>
      </div>
    `;
  }
}

function renderPreviewEmptyState(message = "Build a deck to see the grouped preview.") {
  const preview = document.getElementById("exportPreview");
  if (!preview) return;
  preview.innerHTML = `
    <div class="empty-state-card fade-up">
      <div class="empty-state-icon">🃏</div>
      <div class="empty-state-title">Nothing to preview yet</div>
      <div class="empty-state-copy">${escapeHtml(message)}</div>
    </div>
  `;
}

function renderPreviewErrorState(message = "Something went wrong while preparing the preview.") {
  const preview = document.getElementById("exportPreview");
  if (!preview) return;
  preview.innerHTML = `
    <div class="error-state-card fade-up">
      <div class="empty-state-icon">⚠️</div>
      <div class="empty-state-title">Preview failed</div>
      <div class="empty-state-copy">${escapeHtml(message)}</div>
    </div>
  `;
}

function renderDeckStats(deck, commanderName, bracketInfo) {
  if (!deckStats) return;

  const typeCounts = countByType(deck);
  const total = deck?.length || 0;

  deckStats.innerHTML = `
    <div class="stat-panel-header fade-up">
      <div>
        <div class="eyebrow">Deck Snapshot</div>
        <div class="stat-panel-title">${escapeHtml(commanderName || "Commander Deck")}</div>
      </div>
      <div class="mini-badge">Bracket ${escapeHtml(String(bracketInfo?.bracket ?? "-"))}</div>
    </div>
    <div class="stat-grid">
      <div class="stat-card fade-up"><div class="stat-label">Cards</div><div class="stat-value">${total}</div></div>
      <div class="stat-card fade-up"><div class="stat-label">Lands</div><div class="stat-value">${typeCounts.Land}</div></div>
      <div class="stat-card fade-up"><div class="stat-label">Creatures</div><div class="stat-value">${typeCounts.Creature}</div></div>
      <div class="stat-card fade-up"><div class="stat-label">Avg MV</div><div class="stat-value">${averageManaValue(deck)}</div></div>
    </div>
  `;
}

function displayDeckSummary(deck, commanderName, commanderColors) {
  const summary = document.getElementById("deckSummary");
  if (summary) summary.innerHTML = "";
}

function displayDeckBracket(bracketInfo) {
  const el = document.getElementById("deckBracket");
  const badgeClass =
    bracketInfo.bracket === 1 ? "badge-b1" :
    bracketInfo.bracket === 2 ? "badge-b2" :
    bracketInfo.bracket === 3 ? "badge-b3" :
    bracketInfo.bracket === 4 ? "badge-b4" :
    "badge-b5";

  el.innerHTML = `
    <div class="power-card fade-up">
      <div class="power-card-copy">
        <div class="power-card-label">Deck Bracket</div>
        <div class="power-card-subtitle">A quick strength estimate based on your final list.</div>
      </div>
      <div class="badge ${badgeClass}">${escapeHtml(bracketInfo.label)}</div>
    </div>
  `;
}

function displayGameChangers(bracketInfo) {
  const el = document.getElementById("deckGameChangers");
  if (!bracketInfo.gameChangers.length) {
    el.innerHTML = `
      <div class="info-card fade-up">
        <div class="info-card-title">Game Changers</div>
        <div class="info-card-copy">None detected in this build.</div>
      </div>
    `;
    return;
  }

  el.innerHTML = `
    <div class="info-card fade-up">
      <div class="info-card-title">Game Changers (${bracketInfo.gameChangers.length})</div>
      <div class="info-card-copy">${escapeHtml(bracketInfo.gameChangers.join(", "))}</div>
    </div>
  `;
}

function displayBuildBreakdown(deck) {
  const el = document.getElementById("buildBreakdown");

  const edhrecCount = deck.filter((c) => c.source === "edhrec").length;
  const fallbackCreatureCount = deck.filter((c) => c.source === "fallback-creature").length;
  const fallbackCount = deck.filter((c) => c.source === "fallback").length;
  const nonbasicCount = deck.filter((c) => c.source === "nonbasic-land").length;
  const basicCount = deck.filter((c) => c.source === "basic-land").length;

  el.innerHTML = `
    <div class="info-card fade-up">
      <div class="info-card-title">Build Breakdown</div>
      <div class="build-breakdown-grid">
        <div class="build-breakdown-item"><span>EDHREC Matches</span><strong>${edhrecCount}</strong></div>
        <div class="build-breakdown-item"><span>Fallback Creatures</span><strong>${fallbackCreatureCount}</strong></div>
        <div class="build-breakdown-item"><span>Other Fallbacks</span><strong>${fallbackCount}</strong></div>
        <div class="build-breakdown-item"><span>Nonbasic Lands</span><strong>${nonbasicCount}</strong></div>
        <div class="build-breakdown-item"><span>Basic Lands</span><strong>${basicCount}</strong></div>
      </div>
    </div>
  `;
}

function displayWarnings(warnings) {
  const el = document.getElementById("warningsPanel");
  el.innerHTML = "";

  const title = document.createElement("div");
  title.className = "info-card-title";
  title.textContent = "Warnings / Confidence Notes";

  const card = document.createElement("div");
  card.className = "info-card fade-up";
  card.appendChild(title);

  if (!warnings.length) {
    const copy = document.createElement("div");
    copy.className = "info-card-copy";
    copy.textContent = "No major structural issues detected.";
    card.appendChild(copy);
    el.appendChild(card);
    return;
  }

  warnings.forEach((warning) => {
    const line = document.createElement("div");
    line.className = "warning-line";
    line.textContent = `• ${warning}`;
    card.appendChild(line);
  });

  el.appendChild(card);
}
