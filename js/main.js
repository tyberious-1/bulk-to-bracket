// Entry point: event wiring, the top-level build pipeline, and startup.
//
// generateDeck does the one-time work (parse CSV, resolve commander, fetch
// EDHREC, hydrate every owned card, detect themes) and stashes the result in
// currentRunContext. performBuildFromContext then scores and assembles from
// that context, so the priority buttons can rebuild without re-fetching.
//
// Depends on: autocomplete.js, bracket.js, cache.js, cards.js, charts.js,
//   commander.js, csv.js, deck.js, dom.js, edhrec.js, export.js,
//   hover-preview.js, pairing.js, report.js, scoring.js, scryfall.js,
//   state.js, status.js, text.js, themes.js

let currentRunContext = null;

// Resolves the entered name(s) into the commanders of the deck. A pair runs
// 98 cards plus two commanders and uses the union of both color identities.
async function resolveCommanders(primaryName, partnerName) {
  const primary = await getCommander(primaryName);
  if (!primary) throw new Error("Commander not found on Scryfall.");
  if (!canBeCommander(primary)) throw new Error("Selected card does not appear to be a legal commander.");

  if (!partnerName) {
    return {
      primary,
      partner: null,
      names: [primary.name],
      colors: primary.colors || [],
      deckSize: 99
    };
  }

  const partner = await getCommander(partnerName);
  if (!partner) throw new Error(`Second commander "${partnerName}" was not found on Scryfall.`);
  if (!isLegalCommanderPair(primary, partner)) {
    throw new Error(`${primary.name} and ${partner.name} cannot be commanders together.`);
  }

  return {
    primary,
    partner,
    names: [primary.name, partner.name],
    colors: sortColorsWubrg([...(primary.colors || []), ...(partner.colors || [])]),
    deckSize: 98
  };
}

async function generateDeck() {
  const commanderName = commanderInput.value.trim();
  const partnerName = partnerRow && !partnerRow.classList.contains("hidden")
    ? partnerInput.value.trim()
    : "";
  const file = csvFileInput?.files?.[0];

  currentRunContext = null;
  setCurrentThemeFocus("");
  document.getElementById("postBuildControls").classList.add("hidden");

  clearLog();
  clearCommanderCard();
  updateProgress(0, "Starting...");
  displayThemes([]);
  renderLoadingState();
  document.getElementById("deckSummary").textContent = "";
  document.getElementById("deckBracket").textContent = "";
  document.getElementById("deckGameChangers").textContent = "";
  document.getElementById("buildBreakdown").textContent = "";
  document.getElementById("warningsPanel").textContent = "";
  document.getElementById("moxfieldExport").value = "";

  if (!commanderName || !file) {
    renderPreviewEmptyState("Enter a commander and upload a CSV to build a deck.");
    showToast("Enter a commander and upload a CSV.");
    updateProgress(0, "Idle");
    return;
  }

  document.getElementById("emptyState").classList.add("hidden");
  setGenerateEnabled(false);

  try {
    logMessage("Parsing uploaded CSV.");
    updateProgress(5, "Parsing CSV...");
    const collection = await parseCSV(file);
    logMessage(`Parsed ${collection.byNormalized.size} unique cards from CSV.`);

    updateProgress(10, "Validating commander...");
    logMessage(`Fetching commander info for "${commanderName}" from Scryfall.`);
    const commanders = await resolveCommanders(commanderName, partnerName);

    displayCommanderCard(commanders.primary, commanders.partner);
    logMessage(`Commander found: ${commanders.names.join(" + ")} | Color identity: ${commanders.colors.join("") || "Colorless"}`);

    updateProgress(18, "Fetching EDHREC synergy data...");
    logMessage("Loading commander recommendations from EDHREC.");
    const edhrecData = await getEDHREC(commanders.names);
    const edhrecCards = Array.isArray(edhrecData?.cards) ? edhrecData.cards : [];
    const edhrecTags = Array.isArray(edhrecData?.tags) ? edhrecData.tags : [];
    if (edhrecData?.unavailable) {
      logMessage("EDHREC could not be reached. Continuing with Scryfall + collection-based build logic.");
    }
    if (!edhrecCards.length) {
      logMessage("No EDHREC card data available. Falling back to collection/theme-based build logic.");
    } else {
      logMessage(`EDHREC returned ${edhrecCards.length} candidate cards.`);
    }
    if (edhrecTags.length) {
      logMessage(`Using EDHREC tags: ${edhrecTags.map(formatThemeLabel).join(", ")}`);
    }
    if (edhrecData.typeAverages) {
      const typeSummary = Object.entries(edhrecData.typeAverages)
        .filter(([, count]) => Number.isFinite(count) && count > 0)
        .map(([type, count]) => `${type}: ${count}`)
        .join(", ");
      if (typeSummary) logMessage(`Using EDHREC type targets: ${typeSummary}`);
    }
    if (edhrecData.roleTargets) {
      const roleSummary = Object.entries(edhrecData.roleTargets)
        .filter(([, count]) => Number.isFinite(count) && count > 0)
        .map(([role, count]) => `${role}: ${count}`)
        .join(", ");
      if (roleSummary) logMessage(`Using EDHREC support package targets: ${roleSummary}`);
    }

    updateProgress(30, "Analyzing all cards in collection...");
    const allOwnedNames = Array.isArray(collection.uniqueRawNames)
      ? collection.uniqueRawNames
      : getCollectionEntries(collection).map((x) => x.rawName);
    const allOwnedCardData = await fetchCardDataBatchWithProgress(
      allOwnedNames,
      (done, total) => {
        const pct = 30 + Math.floor((done / Math.max(total, 1)) * 18);
        updateProgress(pct, "Analyzing all cards in collection...", `Fetched ${done} / ${total}`);
      }
    );

    updateProgress(50, "Detecting commander themes...");
    logMessage("Analyzing EDHREC and your fetched collection metadata to infer deck themes.");
    const commanderThemes = await detectCommanderThemes(
      edhrecCards,
      edhrecTags,
      collection,
      allOwnedCardData,
      commanders.colors
    );
    displayThemes(commanderThemes);
    renderPriorityButtons(commanderThemes);
    logMessage(`Detected themes: ${commanderThemes.join(", ") || "none"}`);

    updateProgress(58, "Matching your collection...");
    const ownedCandidates = edhrecCards.length
      ? edhrecCards.filter((c) => hasOwnedCard(collection, c.name))
      : getCollectionEntries(collection).map((entry) => ({
          name: entry.rawName,
          synergy: 0,
          decks: 0,
          label: "Collection Fallback",
          labels: ["Collection Fallback"]
        }));

    if (edhrecCards.length) {
      logMessage(`${ownedCandidates.length} EDHREC cards overlap with your collection or basic lands.`);
    } else {
      logMessage(`${ownedCandidates.length} owned cards available for collection-based fallback scoring.`);
    }

    updateProgress(66, "Reusing fetched collection metadata for candidate scoring...");
    const ownedCardData = new Map();
    for (const candidate of ownedCandidates) {
      const normalizedName = normalizeCardName(candidate.name);
      if (!allOwnedCardData.has(normalizedName)) continue;
      ownedCardData.set(normalizedName, allOwnedCardData.get(normalizedName));
    }

    logMessage(`Reused cached metadata for ${ownedCardData.size} candidate cards for scoring.`);

    currentRunContext = {
      commanders,
      collection,
      edhrecCards,
      ownedCardData,
      allOwnedCardData,
      commanderThemes,
      typeAverages: edhrecData?.typeAverages || null,
      roleTargets: edhrecData?.roleTargets || null
    };

    await performBuildFromContext();
    document.getElementById("postBuildControls").classList.remove("hidden");
  } catch (error) {
    console.error(error);
    currentRunContext = null;
    document.getElementById("postBuildControls").classList.add("hidden");
    updateProgress(0, "Error");
    renderPreviewErrorState(error?.message || "Unable to render deck preview.");
    logMessage(`ERROR: ${error.message}`);
    showToast(error.message);
  } finally {
    setGenerateEnabled(true);
  }
}

async function regenerateWithMode(mode) {
  if (!currentRunContext) return;
  if (mode.startsWith("theme:")) {
    const pickedTheme = mode.slice(6);
    setCurrentThemeFocus(getCurrentThemeFocus() === pickedTheme ? "" : pickedTheme);
  }
  updatePriorityButtons();
  setGenerateEnabled(false);
  try {
    const modeLabel = getCurrentBuildMode() || "default";
    logMessage(`Regenerating with priority mode: ${modeLabel}.`);
    updateProgress(90, "Regenerating deck...", modeLabel);
    await performBuildFromContext();
    updateProgress(100, "Deck complete!", `${modeLabel}`);
  } catch (error) {
    console.error(error);
    renderPreviewErrorState(error?.message || "Unable to regenerate deck preview.");
    showToast(error.message);
    logMessage(`ERROR: ${error.message}`);
  } finally {
    setGenerateEnabled(true);
  }
}

async function performBuildFromContext() {
  const {
    commanders,
    collection,
    edhrecCards,
    ownedCardData,
    allOwnedCardData,
    commanderThemes,
    typeAverages,
    roleTargets
  } = currentRunContext;

  const strategyProfile = getCommanderStrategyProfile(
    commanders.primary.name,
    commanderThemes,
    commanders.colors
  );

  const modePrefs = getModePreferences(getCurrentBuildMode(), strategyProfile);

  updateProgress(78, "Checking legality and scoring cards...");
  const scoredNonlands = [];
  let processed = 0;
  const ownedCandidates = Array.isArray(edhrecCards) && edhrecCards.length
    ? edhrecCards.filter((c) => hasOwnedCard(collection, c.name))
    : getCollectionEntries(collection).map((entry) => ({
        name: entry.rawName,
        synergy: 0,
        decks: 0,
        label: "Collection Fallback",
        labels: ["Collection Fallback"]
      }));
  const totalToScore = ownedCandidates.length;

  for (const edhrecCard of ownedCandidates) {
    processed += 1;
    const normalizedName = normalizeCardName(edhrecCard.name);
    const card = ownedCardData.get(normalizedName);

    if (!card || getCardType(card).includes("land") || !legalForCommander(card.colors, commanders.colors)) {
      maybeUpdateScoringProgress(processed, totalToScore);
      continue;
    }

    const referenceBonus = getEdhrecReferenceBonus(edhrecCard, modePrefs);
    if (modePrefs.themeFocus && referenceBonus <= -16) {
      maybeUpdateScoringProgress(processed, totalToScore);
      continue;
    }

    const role = detectRole(card);
    const score = scoreCard(
      card,
      edhrecCard,
      commanderThemes,
      strategyProfile,
      commanders.colors,
      modePrefs
    );

    scoredNonlands.push({
      name: card.name,
      role,
      score,
      type: getCardType(card),
      cmc: card.cmc,
      colors: card.colors
    });

    maybeUpdateScoringProgress(processed, totalToScore);
  }

  function maybeUpdateScoringProgress(done, total) {
    if (done % 20 === 0 || done === total) {
      updateProgress(
        78 + Math.floor((done / Math.max(total, 1)) * 8),
        "Checking legality and scoring cards...",
        `Processed ${done} / ${total}`
      );
    }
  }

  logMessage(
    Array.isArray(edhrecCards) && edhrecCards.length
      ? `After legality checks, ${scoredNonlands.length} nonland cards remain in the EDHREC candidate pool.`
      : `After legality checks, ${scoredNonlands.length} nonland cards remain in the collection fallback pool.`
  );
  renderPriorityButtons(commanderThemes);

  updateProgress(90, "Building deck structure and mana base...");
  const finalDeck = buildDeckFromScoredPool(
    scoredNonlands,
    commanders.colors,
    collection,
    allOwnedCardData,
    commanderThemes,
    commanders.primary.name,
    modePrefs,
    typeAverages,
    roleTargets,
    edhrecCards,
    { commanderNames: commanders.names, deckSize: commanders.deckSize }
  );

  logMessage(`Built final deck with ${finalDeck.length} cards.`);
  logMessage(`Final deck breakdown: ${finalDeck.filter(c => c.role !== "land").length} nonlands, ${finalDeck.filter(c => c.role === "land").length} lands.`);

  const sanitizedFinalDeck = sanitizeDeckCards(finalDeck);

  const bracketInfo = estimateDeckBracket(
    sanitizedFinalDeck,
    commanderThemes,
    commanders.colors,
    commanders.names
  );

  const warnings = generateWarnings(sanitizedFinalDeck, commanderThemes, bracketInfo);

  updateProgress(97, "Rendering results...");
  displayDeckSummary(sanitizedFinalDeck, commanders.primary.name, commanders.colors);
  renderDeckStats(sanitizedFinalDeck, commanders.names.join(" + "), bracketInfo);
  displayDeckBracket(bracketInfo);
  displayGameChangers(bracketInfo);
  displayBuildBreakdown(sanitizedFinalDeck);
  displayWarnings(warnings);
  displayMoxfieldExport(sanitizedFinalDeck, commanders.names, commanderThemes, strategyProfile, commanders.colors);
  renderManaCurve(sanitizedFinalDeck);
  renderTypeBreakdown(sanitizedFinalDeck);

  logMessage(`Estimated ${bracketInfo.label} (score ${bracketInfo.score}).`);
  updateProgress(100, "Deck complete!", `${finalDeck.length} cards selected`);
  logMessage("Finished.");
}

generateBtn.addEventListener("click", generateDeck);
copyExportBtn.addEventListener("click", copyMoxfieldExport);
csvFileInput.addEventListener("change", updateGenerateButtonState);

// The partner field's eligibility filter reads the current primary pick on
// every keystroke, so it is a live lookup rather than a captured value.
const partnerAutocomplete = createNameAutocomplete({
  input: partnerInput,
  list: partnerAutocompleteList,
  isEligible: (card) => isLegalCommanderPair(getCommanderCard(), card),
  loadingLabel: "Searching...",
  emptyLabel: "No legal partners found",
  onSelect: async (name) => {
    updateGenerateButtonState();
    setPartnerCard(await getCommander(name));
  }
});

const commanderAutocomplete = createNameAutocomplete({
  input: commanderInput,
  list: autocompleteList,
  isEligible: canBeCommander,
  onSelect: async (name) => {
    updateGenerateButtonState();
    const card = await getCommander(name);
    setCommanderCard(card);
    refreshPartnerField(card);

    // "Partner with X" names its mate, so offer it already filled in.
    const namedMate = getNamedCommanderPartner(card);
    if (namedMate && !partnerInput.value.trim()) {
      const mate = await getCommander(namedMate);
      if (mate) {
        partnerInput.value = mate.name;
        setPartnerCard(mate);
      }
    }
  }
});

document.addEventListener("click", (event) => {
  if (!commanderAutocomplete.ownsEvent(event.target)) commanderAutocomplete.hide();
  if (!partnerAutocomplete.ownsEvent(event.target)) partnerAutocomplete.hide();
});

if (priorityButtonsWrap) {
  priorityButtonsWrap.addEventListener("click", (event) => {
    const button = event.target.closest(".priority-btn");
    if (!button) return;
    if (button.disabled) return;
    regenerateWithMode(button.dataset.mode);
  });
}

bindPreviewHoverImages();
hydrateCardCacheFromStorage();
renderPreviewEmptyState();
updateGenerateButtonState();
