// The commander column: card image, meta lines, color pips, theme chips.
//
// Depends on: cards.js, dom.js, pairing.js, state.js, text.js

function renderColorPips(colors) {
  colorPips.innerHTML = "";
  const orderedColors = sortColorsWubrg(colors);
  const displayColors = orderedColors.length ? orderedColors : ["C"];

  for (const color of displayColors) {
    const span = document.createElement("span");
    span.className = `color-pip pip-${color}`;
    span.textContent = color;
    colorPips.appendChild(span);
  }
}

// Card images and meta for one commander or a legal pair.
function displayCommanderCard(primaryData, partnerData) {
  commanderImage.classList.add("hidden");
  commanderImageSkeleton.classList.remove("hidden");

  if (primaryData?.imageUrl) {
    commanderImage.onload = () => {
      commanderImageSkeleton.classList.add("hidden");
      commanderImage.classList.remove("hidden");
    };
    commanderImage.onerror = () => {
      commanderImageSkeleton.classList.add("hidden");
      commanderImage.classList.add("hidden");
    };
    commanderImage.src = primaryData.imageUrl;
  } else {
    commanderImage.src = "";
    commanderImage.classList.add("hidden");
    commanderImageSkeleton.classList.add("hidden");
  }

  if (partnerData?.imageUrl) {
    partnerImage.src = partnerData.imageUrl;
    partnerImage.classList.remove("hidden");
    commanderImageWrap.classList.add("has-partner");
  } else {
    partnerImage.src = "";
    partnerImage.classList.add("hidden");
    commanderImageWrap.classList.remove("has-partner");
  }

  // Color identity is the union of both commanders.
  const orderedIdentity = sortColorsWubrg([
    ...(primaryData?.colors || []),
    ...(partnerData?.colors || [])
  ]);
  const colorIdentity = orderedIdentity.join("") || "Colorless";

  const metaLines = [];
  for (const card of [primaryData, partnerData]) {
    if (!card) continue;
    metaLines.push(card.name || "");
    metaLines.push(card.rawType || "Unknown type");
    metaLines.push(card.manaCost ? `Mana Cost: ${card.manaCost}` : "Mana Cost: N/A");
  }
  metaLines.push(`Color Identity: ${colorIdentity}`);

  commanderMeta.textContent = metaLines.filter(Boolean).join("\n");
  renderColorPips(orderedIdentity);
}

function clearCommanderCard() {
  commanderImage.onload = null;
  commanderImage.onerror = null;
  commanderImage.src = "";
  commanderImage.classList.add("hidden");
  commanderImageSkeleton.classList.add("hidden");
  partnerImage.src = "";
  partnerImage.classList.add("hidden");
  commanderImageWrap.classList.remove("has-partner");
  commanderMeta.textContent = "";
  colorPips.innerHTML = "";
}

function displayThemeChips(themes) {
  const wrap = document.getElementById("themeChips");
  wrap.innerHTML = "";

  if (!themes.length) {
    const chip = document.createElement("div");
    chip.className = "theme-chip theme-chip-muted";
    chip.textContent = "No Clear Themes";
    wrap.appendChild(chip);
    return;
  }

  themes.forEach((theme) => {
    const chip = document.createElement("div");
    chip.className = "theme-chip";
    chip.textContent = formatThemeLabel(theme);
    wrap.appendChild(chip);
  });
}

function displayThemes(themes) {
  displayThemeChips(themes);
}

// Reveal the partner field once the chosen commander turns out to have a
// pairing ability, and label it with the mechanic actually in play
// ("Background" for Choose a Background, "Companion" for a Doctor, ...).
function refreshPartnerField(primaryCard) {
  if (!partnerRow) return "";

  const label = getCommanderPartnerLabel(primaryCard);

  if (!primaryCard || !label) {
    partnerRow.classList.add("hidden");
    partnerInput.value = "";
    setPartnerCard(null);
    return "";
  }

  partnerLabel.textContent = label;
  partnerInput.placeholder = `Start typing a ${label.toLowerCase()} name...`;
  partnerRow.classList.remove("hidden");
  return label;
}
