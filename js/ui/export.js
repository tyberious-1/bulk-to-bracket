// Deck export: the plain-text Moxfield list, the grouped visual preview,
// and the copy-to-clipboard button.
//
// Depends on: cards.js, constants.js, deck.js, hover-preview.js, report.js,
//   status.js, text.js

function scryfallCardUrl(cardName) {
  return `${SCRYFALL_CARD_SEARCH}${encodeURIComponent(`"${cardName}"`)}`;
}

// Decklists name a two-faced card by its front face. Scryfall hands us
// "Front // Back", so trim to the front face here -- the grouped preview above
// still shows the full name.
function generateMoxfieldExport(deck, commanderNames) {
  const leaders = Array.isArray(commanderNames) ? commanderNames : [commanderNames];
  const merged = mergeDeckCounts(deck);
  const lines = leaders
    .filter(Boolean)
    .map((name) => `1 ${getPrimaryCardName(name)}`);
  for (const item of merged) {
    lines.push(`${item.count} ${getPrimaryCardName(item.name)}`);
  }
  return lines.join("\n");
}

function displayExportPreview(deck, commanderName, commanderThemes, strategyProfile, commanderColors) {
  const preview = document.getElementById("exportPreview");
  preview.innerHTML = "";

  if (!deck?.length) {
    bindPreviewHoverImages();
    renderPreviewEmptyState();
    return;
  }

  const leaders = (Array.isArray(commanderName) ? commanderName : [commanderName]).filter(Boolean);
  const commanderSection = document.createElement("div");
  commanderSection.className = "preview-section fade-up";
  commanderSection.innerHTML = `<div class="preview-section-title">${leaders.length > 1 ? "Commanders" : "Commander"}</div>`;
  for (const leaderName of leaders) {
    const commanderLine = document.createElement("div");
    commanderLine.className = "preview-line";
    const commanderSourceCard = deck.find((card) => normalizeCardName(card.name) === normalizeCardName(leaderName));
    commanderLine.innerHTML = `<span class="preview-qty">1</span> ${renderPreviewCardLink(
      leaderName,
      scryfallCardUrl(leaderName),
      getCardImageUrl(commanderSourceCard)
    )}`;
    commanderSection.appendChild(commanderLine);
  }
  preview.appendChild(commanderSection);

  const merged = mergeDeckCounts(deck);
  const sections = new Map();

  for (const item of merged) {
    const section = getCardSection(item.type);
    if (!sections.has(section)) sections.set(section, []);
    sections.get(section).push(item);
  }

  const sectionOrder = ["Creatures", "Artifacts", "Enchantments", "Planeswalkers", "Instants", "Sorceries", "Lands", "Other"];
  let renderedSections = 0;

  for (const sectionName of sectionOrder) {
    const items = sections.get(sectionName);
    if (!items || !items.length) continue;

    renderedSections += 1;
    const section = document.createElement("div");
    section.className = "preview-section fade-up";
    section.innerHTML = `<div class="preview-section-title">${escapeHtml(sectionName)} <span class="preview-count">${items.reduce((sum, item) => sum + item.count, 0)}</span></div>`;

    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "preview-row";

      const line = document.createElement("div");
      line.className = "preview-line";

      const sourceCard = deck.find((c) => normalizeCardName(c.name) === normalizeCardName(item.name));
      line.innerHTML = `<span class="preview-qty">${item.count}</span> ${renderPreviewCardLink(
        item.name,
        scryfallCardUrl(item.name),
        getCardImageUrl(sourceCard)
      )}`;
      row.appendChild(line);

      const reasons = sourceCard
        ? generateCardReasons(sourceCard, commanderThemes, strategyProfile, commanderColors).map(formatThemeLabel)
        : (item.reasons || []).map(formatThemeLabel);

      if (reasons.length) {
        const badges = document.createElement("div");
        badges.className = "reason-badges";
        reasons.forEach((reason) => {
          const badge = document.createElement("span");
          badge.className = "reason-badge";
          badge.textContent = reason;
          badges.appendChild(badge);
        });
        row.appendChild(badges);
      }

      section.appendChild(row);
    });

    preview.appendChild(section);
  }

  if (renderedSections === 0) {
    renderPreviewErrorState("The deck preview did not contain any grouped cards.");
    return;
  }

  bindPreviewHoverImages();
}

function displayMoxfieldExport(deck, commanderName, commanderThemes, strategyProfile, commanderColors) {
  document.getElementById("moxfieldExport").value = generateMoxfieldExport(deck, commanderName);
  displayExportPreview(deck, commanderName, commanderThemes, strategyProfile, commanderColors);
}

async function copyMoxfieldExport() {
  const box = document.getElementById("moxfieldExport");
  if (!box.value.trim()) return;

  try {
    await navigator.clipboard.writeText(box.value);
    showToast("Decklist copied.");
  } catch (error) {
    box.select();
    document.execCommand("copy");
    showToast("Decklist copied.");
  }
}
