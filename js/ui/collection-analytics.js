// Collection analytics tab: displays card counts by type/subtype, color identity,
// support packages (ramp, draw, removal, wipes), and overall color distribution.
//
// Depends on: cache.js, csv.js, dom.js, scoring.js, state.js, status.js, text.js

let monoColorChartInstance = null;
let multiColorChartInstance = null;
// Snapshot from the last renderAnalyticsPanel() call, reused by the type-card
// click handler so it doesn't re-walk the whole collection on every click.
let cachedByTypeSubtype = null;

// sortColorsWubrg returns a new array, so this never mutates the cached
// card's own `colors` array -- and it orders WUBRG instead of alphabetically.
function getCardColorIdentity(card) {
  if (!card || !card.colors) return "";
  return sortColorsWubrg(card.colors).join("");
}

// getCardType() lowercases the whole type line, so subtype names parsed out
// of it (e.g. "human" from "legendary creature — human wizard") need this
// before they're displayed.
function capitalizeWord(word) {
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

function sortColorIdentities(identities) {
  const order = { "": 0, W: 1, U: 2, B: 3, R: 4, G: 5 };
  return identities.slice().sort((a, b) => {
    let aVal = 0, bVal = 0;
    for (let i = 0; i < a.length; i++) aVal += (order[a[i]] || 6) * Math.pow(10, 5 - i);
    for (let i = 0; i < b.length; i++) bVal += (order[b[i]] || 6) * Math.pow(10, 5 - i);
    return aVal - bVal;
  });
}

function buildCardData(collection) {
  if (!collection) return { byTypeSubtype: new Map(), bySupportRole: new Map() };

  if (!cardCache || !cardCache.size) {
    return { byTypeSubtype: new Map(), bySupportRole: new Map() };
  }

  const byTypeSubtype = new Map();
  const bySupportRole = new Map();

  const entries = getCollectionEntries(collection);
  for (const entry of entries) {
    const card = cardCache.get(entry.normalizedName);
    if (!card) continue;

    const colorId = getCardColorIdentity(card);
    const type = getCardType(card);

    // Extract base type and subtype
    const typeParts = type.split("—");
    const baseType = (typeParts[0] || "").trim();
    const subType = (typeParts[1] || "").trim();

    const typeKey = `${baseType}${subType ? ` — ${subType}` : ""}`;
    const byTypeKey = `${typeKey}|${colorId}`;

    if (!byTypeSubtype.has(byTypeKey)) {
      byTypeSubtype.set(byTypeKey, {
        type: typeKey,
        colorId,
        count: 0,
        cards: []
      });
    }
    const typeEntry = byTypeSubtype.get(byTypeKey);
    typeEntry.count += entry.quantity;
    typeEntry.cards.push({ name: entry.rawName, quantity: entry.quantity });

    // Support roles
    const role = detectRole(card);
    if (role !== "land" && role !== "synergy") {
      const roleKey = `${role}|${colorId}`;
      if (!bySupportRole.has(roleKey)) {
        bySupportRole.set(roleKey, {
          role,
          colorId,
          count: 0,
          cards: []
        });
      }
      const roleEntry = bySupportRole.get(roleKey);
      roleEntry.count += entry.quantity;
      roleEntry.cards.push({ name: entry.rawName, quantity: entry.quantity, imageUrl: getCardImageUrl(card) });
    }
  }

  return { byTypeSubtype, bySupportRole };
}

function buildMonoColorDistribution(collection) {
  if (!collection) return new Map();

  if (!cardCache || !cardCache.size) return new Map();

  const distribution = new Map();
  const entries = getCollectionEntries(collection);

  for (const entry of entries) {
    const card = cardCache.get(entry.normalizedName);
    if (!card) continue;

    const colorId = getCardColorIdentity(card);
    if (colorId.length <= 1) {
      const label = colorId || "C";
      distribution.set(label, (distribution.get(label) || 0) + entry.quantity);
    }
  }

  return distribution;
}

function buildMultiColorDistribution(collection) {
  if (!collection) return new Map();

  if (!cardCache || !cardCache.size) return new Map();

  const distribution = new Map();
  const entries = getCollectionEntries(collection);

  for (const entry of entries) {
    const card = cardCache.get(entry.normalizedName);
    if (!card) continue;

    const colorId = getCardColorIdentity(card);
    if (colorId.length > 1) {
      distribution.set(colorId, (distribution.get(colorId) || 0) + entry.quantity);
    }
  }

  return distribution;
}

function renderCollapsible(id, title, content) {
  return `
    <div class="collapsible-section">
      <button class="collapsible-btn" type="button" data-toggle="${id}">
        <span class="toggle-icon">▶</span> ${title}
      </button>
      <div id="${id}" class="collapsible-content hidden">
        ${content}
      </div>
    </div>
  `;
}

function buildTypeSummary(byTypeSubtype) {
  const primaryTypes = ['creature', 'enchantment', 'artifact', 'instant', 'sorcery', 'planeswalker', 'land', 'battle'];
  const summary = {};

  for (const type of primaryTypes) {
    summary[type] = {
      totalCount: 0,
      hasLegendary: false,
      legendaryCount: 0,
      colors: new Set()
    };
  }

  for (const entry of byTypeSubtype.values()) {
    const fullType = entry.type.split('—')[0].trim();
    const isLegendary = fullType.toLowerCase().startsWith('legendary');
    const primaryType = fullType.replace(/^legendary\s+/i, '').toLowerCase().trim();

    let typeKey = null;
    if (primaryType.includes('creature')) {
      typeKey = 'creature';
    } else if (primaryType === 'enchantment') {
      typeKey = 'enchantment';
    } else if (primaryType.includes('artifact')) {
      typeKey = 'artifact';
    } else if (primaryType === 'instant') {
      typeKey = 'instant';
    } else if (primaryType === 'sorcery') {
      typeKey = 'sorcery';
    } else if (primaryType === 'planeswalker') {
      typeKey = 'planeswalker';
    } else if (primaryType === 'land') {
      typeKey = 'land';
    } else if (primaryType === 'battle') {
      typeKey = 'battle';
    }

    if (!typeKey || !summary[typeKey]) continue;

    summary[typeKey].totalCount += entry.count;
    if (isLegendary) {
      summary[typeKey].hasLegendary = true;
      summary[typeKey].legendaryCount += entry.count;
    }
    summary[typeKey].colors.add(entry.colorId);
  }

  for (const type of primaryTypes) {
    summary[type].colors = sortColorIdentities(Array.from(summary[type].colors));
  }

  return summary;
}

function getColorDistribution(subtypeEntries) {
  const distribution = {};
  const allColors = ['W', 'U', 'B', 'R', 'G', 'C'];

  for (const color of allColors) {
    distribution[color] = 0;
  }

  for (const entry of subtypeEntries) {
    distribution[entry.colorId] = (distribution[entry.colorId] || 0) + entry.count;
  }

  return distribution;
}

function buildTypeCardsGrid(summary) {
  const colorMap = {
    '': '#9ca3af',
    'W': '#fef3c7',
    'U': '#a3e4d7',
    'B': '#7c3aed',
    'R': '#fb7185',
    'G': '#86efac'
  };

  const colorLabels = {
    'W': 'White',
    'U': 'Blue',
    'B': 'Black',
    'R': 'Red',
    'G': 'Green',
    '': 'Colorless'
  };

  let html = '<div class="type-cards-grid">';

  const typeOrder = ['creature', 'enchantment', 'artifact', 'instant', 'sorcery', 'planeswalker', 'land', 'battle'];

  for (const typeKey of typeOrder) {
    const typeData = summary[typeKey];
    if (!typeData || typeData.totalCount === 0) continue;

    const typeLabel = typeKey.charAt(0).toUpperCase() + typeKey.slice(1);

    html += `<div class="type-card" data-type="${typeKey}">`;
    html += `<div class="type-card-header">`;
    html += `<h3 class="type-name">${typeLabel}</h3>`;
    html += `<span class="type-count">${typeData.totalCount}</span>`;
    html += `</div>`;

    html += `<div class="type-card-body">`;
    if (typeData.hasLegendary) {
      html += `<span class="legendary-badge" title="Legendary ${typeLabel}s">★ ${typeData.legendaryCount}</span>`;
    }
    html += `</div>`;

    html += `<div class="type-card-footer">`;
    html += `<div class="color-pips">`;
    for (const color of typeData.colors) {
      const isMultiColor = color.length > 1;
      const bgColor = isMultiColor ? '#9ca3af' : (colorMap[color] || colorMap['']);
      const label = isMultiColor ? 'Multi-color' : (colorLabels[color] || 'Unknown');
      html += `<span class="color-pip" style="background: ${bgColor};" title="${label}">●</span>`;
    }
    html += `</div>`;
    html += `</div>`;

    html += `</div>`;
  }

  html += '</div>';
  return html;
}

function buildTypeDetailPanel(typeKey, byTypeSubtype, summary) {
  const colorMap = {
    'W': '#fef3c7',
    'U': '#a3e4d7',
    'B': '#7c3aed',
    'R': '#fb7185',
    'G': '#86efac',
    'C': '#9ca3af'
  };

  const typeLabel = typeKey.charAt(0).toUpperCase() + typeKey.slice(1);
  const typeData = summary[typeKey];

  const legendaryEntries = [];
  const otherEntries = [];
  const artifactCreatureEntries = [];

  for (const entry of byTypeSubtype.values()) {
    const fullType = entry.type.split('—')[0].trim();
    const isLegendary = fullType.toLowerCase().startsWith('legendary');
    const primaryType = fullType.replace(/^legendary\s+/i, '').toLowerCase().trim();
    const isArtifactCreature = primaryType.includes('artifact') && primaryType.includes('creature');

    let entryTypeKey = null;
    if (primaryType.includes('creature')) entryTypeKey = 'creature';
    else if (primaryType === 'enchantment') entryTypeKey = 'enchantment';
    else if (primaryType.includes('artifact')) entryTypeKey = 'artifact';
    else if (primaryType === 'instant') entryTypeKey = 'instant';
    else if (primaryType === 'sorcery') entryTypeKey = 'sorcery';
    else if (primaryType === 'planeswalker') entryTypeKey = 'planeswalker';
    else if (primaryType === 'land') entryTypeKey = 'land';
    else if (primaryType === 'battle') entryTypeKey = 'battle';

    if (entryTypeKey === typeKey) {
      if (isArtifactCreature && typeKey === 'creature') {
        artifactCreatureEntries.push(entry);
      } else if (isLegendary) {
        legendaryEntries.push(entry);
      } else {
        otherEntries.push(entry);
      }
    }
  }

  const groupBySubtype = (entries) => {
    const grouped = new Map();
    for (const entry of entries) {
      const creatureType = entry.type.includes('—') ? entry.type.split('—')[1].trim() : 'Base';
      const primarySubtype = capitalizeWord(creatureType.split(/\s+/)[0] || 'Base');

      if (!grouped.has(primarySubtype)) {
        grouped.set(primarySubtype, []);
      }
      grouped.get(primarySubtype).push(entry);
    }
    return grouped;
  };

  const legendaryBySubtype = groupBySubtype(legendaryEntries);
  const otherBySubtype = groupBySubtype(otherEntries);

  const sortSubtypes = (subtypeMap) => {
    const sorted = Array.from(subtypeMap.entries())
      .map(([name, entries]) => ({
        name,
        entries,
        count: entries.reduce((sum, e) => sum + e.count, 0)
      }))
      .sort((a, b) => b.count - a.count);
    return sorted;
  };

  const legendarySorted = sortSubtypes(legendaryBySubtype);
  const otherSorted = sortSubtypes(otherBySubtype);

  let html = '<div class="type-detail-panel open" data-type="' + typeKey + '">';

  html += '<div class="detail-header">';
  html += '<button class="close-btn" type="button">✕</button>';
  html += '<h2>' + typeLabel + '</h2>';
  html += '<span class="total-count">' + typeData.totalCount + ' total</span>';
  html += '</div>';

  html += '<div class="detail-content">';

  if (legendarySorted.length > 0) {
    html += '<div class="legendary-section">';
    html += '<h3 class="section-title" data-section="legendary-' + typeKey + '"><span class="section-toggle-icon">▼</span> Legendary ' + typeLabel + 's (' + typeData.legendaryCount + ')</h3>';

    html += '<div class="section-content" data-section="legendary-' + typeKey + '">';
    for (const subtype of legendarySorted) {
      const distribution = getColorDistribution(subtype.entries);
      const total = subtype.count;

      html += '<div class="subtype-row">';
      html += '<span class="subtype-name">' + subtype.name + '</span>';
      html += '<span class="subtype-count">' + total + '</span>';

      html += '<div class="color-breakdown">';

      // Single-color cards
      let singleColorTotal = 0;
      for (const color of ['W', 'U', 'B', 'R', 'G', 'C']) {
        const count = distribution[color] || 0;
        singleColorTotal += count;
      }

      for (const color of ['W', 'U', 'B', 'R', 'G', 'C']) {
        const count = distribution[color] || 0;
        if (count > 0) {
          const percentage = (count / total * 100).toFixed(0);
          const bgColor = colorMap[color];
          html += '<span class="color-bar" style="width: ' + percentage + '%; background: ' + bgColor + ';" title="' + color + ': ' + count + '">' + count + '</span>';
        }
      }

      // Multi-color cards
      const multiColorCount = total - singleColorTotal;
      if (multiColorCount > 0) {
        const percentage = (multiColorCount / total * 100).toFixed(0);
        html += '<span class="color-bar" style="width: ' + percentage + '%; background: #9ca3af;" title="Multi-color: ' + multiColorCount + '">' + multiColorCount + '</span>';
      }

      html += '</div>';

      html += '</div>';
    }
    html += '</div>';

    html += '</div>';
  }

  if (otherSorted.length > 0) {
    html += '<div class="other-section">';
    const otherCount = typeData.totalCount - typeData.legendaryCount;
    html += '<h3 class="section-title" data-section="other-' + typeKey + '"><span class="section-toggle-icon">▼</span> Other ' + typeLabel + 's (' + otherCount + ')</h3>';

    html += '<div class="section-content" data-section="other-' + typeKey + '">';
    for (const subtype of otherSorted) {
      const distribution = getColorDistribution(subtype.entries);
      const total = subtype.count;

      html += '<div class="subtype-row">';
      html += '<span class="subtype-name">' + subtype.name + '</span>';
      html += '<span class="subtype-count">' + total + '</span>';

      html += '<div class="color-breakdown">';

      // Single-color cards
      let singleColorTotal = 0;
      for (const color of ['W', 'U', 'B', 'R', 'G', 'C']) {
        const count = distribution[color] || 0;
        singleColorTotal += count;
      }

      for (const color of ['W', 'U', 'B', 'R', 'G', 'C']) {
        const count = distribution[color] || 0;
        if (count > 0) {
          const percentage = (count / total * 100).toFixed(0);
          const bgColor = colorMap[color];
          html += '<span class="color-bar" style="width: ' + percentage + '%; background: ' + bgColor + ';" title="' + color + ': ' + count + '">' + count + '</span>';
        }
      }

      // Multi-color cards
      const multiColorCount = total - singleColorTotal;
      if (multiColorCount > 0) {
        const percentage = (multiColorCount / total * 100).toFixed(0);
        html += '<span class="color-bar" style="width: ' + percentage + '%; background: #9ca3af;" title="Multi-color: ' + multiColorCount + '">' + multiColorCount + '</span>';
      }

      html += '</div>';

      html += '</div>';
    }
    html += '</div>';

    html += '</div>';
  }

  // Artifact creatures section (creatures only)
  if (typeKey === 'creature' && artifactCreatureEntries.length > 0) {
    const artifactBySubtype = new Map();
    for (const entry of artifactCreatureEntries) {
      const creatureType = entry.type.includes('—') ? entry.type.split('—')[1].trim() : 'Base';
      const primarySubtype = capitalizeWord(creatureType.split(/\s+/)[0] || 'Base');

      if (!artifactBySubtype.has(primarySubtype)) {
        artifactBySubtype.set(primarySubtype, []);
      }
      artifactBySubtype.get(primarySubtype).push(entry);
    }

    const artifactSorted = Array.from(artifactBySubtype.entries())
      .map(([name, entries]) => ({
        name,
        entries,
        count: entries.reduce((sum, e) => sum + e.count, 0)
      }))
      .sort((a, b) => b.count - a.count);

    const artifactTotal = artifactCreatureEntries.reduce((sum, e) => sum + e.count, 0);

    html += '<div class="artifact-creatures-section">';
    html += '<h3 class="section-title" data-section="artifact-creatures"><span class="section-toggle-icon">▼</span> Artifact Creatures (' + artifactTotal + ')</h3>';

    html += '<div class="section-content" data-section="artifact-creatures">';
    for (const subtype of artifactSorted) {
      const distribution = getColorDistribution(subtype.entries);
      const total = subtype.count;

      html += '<div class="subtype-row">';
      html += '<span class="subtype-name">' + subtype.name + '</span>';
      html += '<span class="subtype-count">' + total + '</span>';

      html += '<div class="color-breakdown">';

      let singleColorTotal = 0;
      for (const color of ['W', 'U', 'B', 'R', 'G', 'C']) {
        const count = distribution[color] || 0;
        singleColorTotal += count;
      }

      for (const color of ['W', 'U', 'B', 'R', 'G', 'C']) {
        const count = distribution[color] || 0;
        if (count > 0) {
          const percentage = (count / total * 100).toFixed(0);
          const bgColor = colorMap[color];
          html += '<span class="color-bar" style="width: ' + percentage + '%; background: ' + bgColor + ';" title="' + color + ': ' + count + '">' + count + '</span>';
        }
      }

      const multiColorCount = total - singleColorTotal;
      if (multiColorCount > 0) {
        const percentage = (multiColorCount / total * 100).toFixed(0);
        html += '<span class="color-bar" style="width: ' + percentage + '%; background: #9ca3af;" title="Multi-color: ' + multiColorCount + '">' + multiColorCount + '</span>';
      }

      html += '</div>';
      html += '</div>';
    }
    html += '</div>';
    html += '</div>';
  }

  html += '</div>';
  html += '</div>';

  return html;
}

function renderTypeBreakdownTable(byTypeSubtype) {
  const summary = buildTypeSummary(byTypeSubtype);
  let html = buildTypeCardsGrid(summary);
  html += '<div id="typeDetailPanelContainer"></div>';
  return html;
}

function renderSupportPackageSection(role, entries) {
  if (!entries.length) return '';

  const groupedByColor = new Map();
  entries.forEach(entry => {
    if (!groupedByColor.has(entry.colorId)) {
      groupedByColor.set(entry.colorId, []);
    }
    groupedByColor.get(entry.colorId).push(entry);
  });

  const sortedColors = sortColorIdentities(Array.from(groupedByColor.keys()));

  let html = '<div class="support-package-breakdown">';

  sortedColors.forEach(colorId => {
    const colorEntries = groupedByColor.get(colorId);
    const totalCount = colorEntries.reduce((sum, e) => sum + e.count, 0);
    const colorLabel = colorId || "Colorless";
    const collapsibleId = `${role}-${colorId || "C"}-cards`;

    html += `
      <div class="color-group">
        <div class="color-group-header">
          ${colorLabel}: <span class="count-badge">${totalCount}</span>
        </div>
        ${renderCollapsible(collapsibleId, 'View cards', renderCardsList(colorEntries))}
      </div>
    `;
  });

  html += '</div>';
  return html;
}

function renderCardsList(entries) {
  let html = '<ul class="cards-list">';
  const allCards = [];
  entries.forEach(e => {
    e.cards.forEach(card => {
      allCards.push(card);
    });
  });

  allCards.sort((a, b) => a.name.localeCompare(b.name));

  allCards.forEach(card => {
    const link = renderPreviewCardLink(card.name, scryfallCardUrl(card.name), card.imageUrl);
    html += `<li>${link}${card.quantity > 1 ? ` ×${card.quantity}` : ''}</li>`;
  });
  html += '</ul>';
  return html;
}

function renderColorDistributionChart() {
  return `
    <div class="color-charts-wrapper">
      <div class="color-chart-group">
        <h4>Mono-Color Distribution</h4>
        <div class="color-distribution-chart-container">
          <canvas id="monoColorChart"></canvas>
        </div>
      </div>
      <div class="color-chart-group">
        <h4>Multi-Color Distribution</h4>
        <div class="color-distribution-chart-container">
          <canvas id="multiColorChart"></canvas>
        </div>
      </div>
    </div>
  `;
}

function createMonoColorChart(distribution) {
  const canvas = document.getElementById('monoColorChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const colorOrder = ['W', 'U', 'B', 'R', 'G', 'C'];
  const colorMap = {
    'W': '#fef3c7',
    'U': '#a3e4d7',
    'B': '#7c3aed',
    'R': '#fb7185',
    'G': '#86efac',
    'C': '#9ca3af'
  };

  const labels = [];
  const data = [];
  const bgColors = [];

  for (const color of colorOrder) {
    const count = distribution.get(color) || 0;
    if (count > 0) {
      const colorLabel = color === 'C' ? 'Colorless' : color;
      labels.push(`${colorLabel}: ${count}`);
      data.push(count);
      bgColors.push(colorMap[color]);
    }
  }

  if (monoColorChartInstance) monoColorChartInstance.destroy();

  monoColorChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: bgColors,
        borderColor: '#1f2937',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#f3f4f6',
            font: { size: 13 },
            padding: 15,
            usePointStyle: true,
          }
        }
      }
    }
  });
}

function createMultiColorChart(distribution) {
  const canvas = document.getElementById('multiColorChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const sortedIdentities = sortColorIdentities(Array.from(distribution.keys()));
  const colorMap = {
    '': '#9ca3af',
    'W': '#fef3c7',
    'U': '#a3e4d7',
    'B': '#7c3aed',
    'R': '#fb7185',
    'G': '#86efac'
  };

  const labels = sortedIdentities.map(id => {
    const count = distribution.get(id) || 0;
    return `${id}: ${count}`;
  });
  const data = sortedIdentities.map(id => distribution.get(id) || 0);
  const bgColors = sortedIdentities.map(id => {
    const colors = id.split('');
    if (colors.length === 1) return colorMap[colors[0]] || colorMap[''];
    // For multi-color, blend the first color as base
    return colorMap[colors[0]] || colorMap[''];
  });

  if (multiColorChartInstance) multiColorChartInstance.destroy();

  multiColorChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: bgColors,
        borderColor: '#1f2937',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#f3f4f6',
            font: { size: 13 },
            padding: 15,
            usePointStyle: true,
          }
        }
      }
    }
  });
}

function renderAnalyticsPanel() {
  const panel = document.getElementById("analyticsPanel");
  if (!panel) return;

  const collection = getOwnedCollection();
  if (!collection) {
    cachedByTypeSubtype = null;
    panel.innerHTML = `
      <div class="empty-state">
        <p>Upload a ManaBox CSV on the Build a Deck tab to see collection analytics.</p>
      </div>
    `;
    bindAnalyticsTab();
    return;
  }

  if (!cardCache || !cardCache.size) {
    cachedByTypeSubtype = null;
    panel.innerHTML = `
      <div class="empty-state">
        <p>Collection analytics require card data from Scryfall. Click the button below to fetch data for all your cards.</p>
        <button id="fetchCardDataBtn" type="button">Fetch Card Data</button>
      </div>
    `;
    bindAnalyticsTab();
    return;
  }

  const { byTypeSubtype, bySupportRole } = buildCardData(collection);
  cachedByTypeSubtype = byTypeSubtype;
  const monoColorDist = buildMonoColorDistribution(collection);
  const multiColorDist = buildMultiColorDistribution(collection);

  const roleGroups = new Map();
  bySupportRole.forEach(entry => {
    if (!roleGroups.has(entry.role)) {
      roleGroups.set(entry.role, []);
    }
    roleGroups.get(entry.role).push(entry);
  });

  let html = '';

  // Color distribution
  html += '<div class="analytics-section">';
  html += renderCollapsible(
    'color-distribution',
    'Color Identity Distribution',
    renderColorDistributionChart()
  );
  html += '</div>';

  // Type/Subtype breakdown
  html += '<div class="analytics-section">';
  html += renderCollapsible(
    'type-breakdown',
    'Card Type & Subtype Breakdown',
    renderTypeBreakdownTable(byTypeSubtype)
  );
  html += '</div>';

  // Support packages
  const roles = ['ramp', 'draw', 'removal', 'wipe'];
  roles.forEach(role => {
    const entries = roleGroups.get(role) || [];
    if (!entries.length) return;

    const totalCount = entries.reduce((sum, e) => sum + e.count, 0);
    html += '<div class="analytics-section">';
    html += renderCollapsible(
      `support-${role}`,
      `${role.charAt(0).toUpperCase() + role.slice(1)} (${totalCount})`,
      renderSupportPackageSection(role, entries)
    );
    html += '</div>';
  });

  panel.innerHTML = html;
  bindAnalyticsTab();
  bindPreviewHoverImages("analyticsPanel");
  createMonoColorChart(monoColorDist);
  createMultiColorChart(multiColorDist);
}

async function fetchCollectionCardData() {
  const collection = getOwnedCollection();
  if (!collection) return;

  try {
    updateProgress(5, "Fetching card data...");
    await fetchCardDataBatchWithProgress(
      collection.uniqueRawNames,
      (done, total) => {
        updateProgress(
          5 + Math.floor((done / Math.max(total, 1)) * 90),
          "Fetching card data...",
          `${done} / ${total}`
        );
      }
    );
    updateProgress(100, "Card data loaded", `${collection.uniqueRawNames.length} cards`);
    renderAnalyticsPanel();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Unable to fetch card data.");
    updateProgress(0, "Error");
  }
}

function bindAnalyticsTab() {
  const panel = document.getElementById("analyticsPanel");
  if (!panel) return;

  panel.addEventListener("click", (event) => {
    if (event.target.id === "fetchCardDataBtn") {
      fetchCollectionCardData();
      return;
    }

    const btn = event.target.closest(".collapsible-btn");
    if (btn) {
      const toggleId = btn.dataset.toggle;
      const content = document.getElementById(toggleId);
      if (!content) return;

      content.classList.toggle("hidden");
      const icon = btn.querySelector(".toggle-icon");
      if (icon) {
        icon.textContent = content.classList.contains("hidden") ? "▶" : "▼";
      }
      return;
    }

    // Type card click
    const typeCard = event.target.closest(".type-card");
    if (typeCard) {
      const typeKey = typeCard.dataset.type;
      const container = panel.querySelector("#typeDetailPanelContainer");

      const existingPanel = container.querySelector(".type-detail-panel.open");
      if (existingPanel && existingPanel.dataset.type !== typeKey) {
        existingPanel.classList.remove("open");
        panel.querySelectorAll(".type-card.active").forEach(card => card.classList.remove("active"));
      }

      if (cachedByTypeSubtype) {
        const summary = buildTypeSummary(cachedByTypeSubtype);

        const detailHtml = buildTypeDetailPanel(typeKey, cachedByTypeSubtype, summary);
        container.innerHTML = detailHtml;

        typeCard.classList.add("active");
      }
      return;
    }

    // Section title toggle (Legendary/Other)
    const sectionTitle = event.target.closest(".section-title");
    if (sectionTitle) {
      const sectionId = sectionTitle.dataset.section;
      const content = panel.querySelector(`.section-content[data-section="${sectionId}"]`);
      const icon = sectionTitle.querySelector(".section-toggle-icon");

      if (content && icon) {
        content.classList.toggle("collapsed");
        icon.classList.toggle("collapsed");
      }
      return;
    }

    // Close button handler
    const closeBtn = event.target.closest(".close-btn");
    if (closeBtn) {
      const panel = closeBtn.closest(".type-detail-panel");
      if (panel) {
        panel.classList.remove("open");
        const typeKey = panel.dataset.type;
        const typeCard = event.currentTarget.querySelector(`[data-type="${typeKey}"]`);
        if (typeCard) typeCard.classList.remove("active");
      }
      return;
    }

  });
}

function resetAnalyticsCache() {
  cachedByTypeSubtype = null;
  const panel = document.getElementById("analyticsPanel");
  if (panel) {
    panel.innerHTML = '';
  }
}

function activateAnalyticsTab() {
  renderAnalyticsPanel();
}
