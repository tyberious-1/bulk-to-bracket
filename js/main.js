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
  if (!canBeActiveCommander(primary)) throw new Error("Selected card does not appear to be a legal commander.");

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
  if (!canBeActiveCommander(partner) && !isBackgroundCard(partner)) {
    throw new Error(`"${partner.name}" does not appear to be a legal commander.`);
  }
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
  setCurrentThemeFocus(takePendingThemeFocus() || "");
  setMinimalBuildEnabled(false);
  document.getElementById("postBuildControls").classList.add("hidden");
  document.getElementById("buildModeControls").classList.add("hidden");

  clearLog();
  clearCommanderCard();
  updateProgress(0, "Starting...");
  displayThemes([]);
  renderLoadingState();
  document.getElementById("deckSummary").textContent = "";
  document.getElementById("deckBracket").textContent = "";
  document.getElementById("deckGameChangers").textContent = "";
  document.getElementById("buildBreakdown").textContent = "";
  document.getElementById("supportPackage").textContent = "";
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
    // Already parsed when the file was chosen, unless that parse failed.
    const collection = getOwnedCollection() || await parseCSV(file);
    setOwnedCollection(collection);
    logMessage(`Parsed ${collection.byNormalized.size} unique cards from CSV.`);

    updateProgress(10, "Validating commander...");
    logMessage(`Fetching commander info for "${commanderName}" from Scryfall.`);
    const commanders = await resolveCommanders(commanderName, partnerName);

    displayCommanderCard(commanders.primary, commanders.partner);
    logMessage(`Commander found: ${commanders.names.join(" + ")} | Color identity: ${commanders.colors.join("") || "Colorless"}`);

    let edhrecData = { cards: [], tags: [], allTags: [], typeAverages: null, roleTargets: null, themeCardLists: {} };

    if (!isPauperFormat()) {
      updateProgress(18, "Fetching EDHREC synergy data...");
      logMessage("Loading commander recommendations from EDHREC.");
      edhrecData = await getEDHREC(commanders.names);
      if (edhrecData?.unavailable) {
        logMessage("EDHREC could not be reached. Continuing with Scryfall + collection-based build logic.");
      }
    } else {
      logMessage("Pauper Commander mode: EDHREC has no data for uncommon commanders — building entirely from Scryfall and your collection.");
    }

    const edhrecCards = Array.isArray(edhrecData?.cards) ? edhrecData.cards : [];
    const edhrecTags = Array.isArray(edhrecData?.tags) ? edhrecData.tags : [];
    const edhrecAllTags = Array.isArray(edhrecData?.allTags) ? edhrecData.allTags : [];
    if (!edhrecCards.length) {
      if (!isPauperFormat()) {
        logMessage("No EDHREC card data available. Falling back to collection/theme-based build logic.");
      }
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
    renderPriorityButtons(commanderThemes, allOwnedCardData, edhrecAllTags);
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
      edhrecAllTags,
      typeAverages: edhrecData?.typeAverages || null,
      roleTargets: edhrecData?.roleTargets || null,
      themeCardLists: edhrecData?.themeCardLists || {}
    };

    await performBuildFromContext();
    document.getElementById("postBuildControls").classList.remove("hidden");
    document.getElementById("buildModeControls").classList.remove("hidden");
  } catch (error) {
    console.error(error);
    currentRunContext = null;
    document.getElementById("postBuildControls").classList.add("hidden");
    document.getElementById("buildModeControls").classList.add("hidden");
    updateProgress(0, "Error");
    renderPreviewErrorState(error?.message || "Unable to render deck preview.");
    logMessage(`ERROR: ${error.message}`);
    showToast(error.message);
  } finally {
    setGenerateEnabled(true);
  }
}

// Shared by every control that rebuilds from currentRunContext without
// re-fetching (theme-priority buttons, the Minimal Build toggle). The mode
// string itself always comes fresh from getCurrentBuildMode() rather than
// being passed in, so a caller only needs to update state first.
async function runRegeneration() {
  updatePriorityButtons();
  updateBuildModeToggle();
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

async function regenerateWithMode(mode) {
  if (!currentRunContext) return;
  if (mode.startsWith("theme:")) {
    const pickedTheme = mode.slice(6);
    setCurrentThemeFocus(getCurrentThemeFocus() === pickedTheme ? "" : pickedTheme);
  }
  await runRegeneration();
}

async function toggleMinimalBuild() {
  if (!currentRunContext) return;
  setMinimalBuildEnabled(!getMinimalBuildEnabled());
  await runRegeneration();
}

async function performBuildFromContext() {
  const {
    commanders,
    collection,
    edhrecCards,
    ownedCardData,
    allOwnedCardData,
    commanderThemes,
    edhrecAllTags,
    typeAverages,
    roleTargets
  } = currentRunContext;


  const strategyProfile = getCommanderStrategyProfile(
    commanders.primary.name,
    commanderThemes,
    commanders.colors
  );

  const modePrefs = getModePreferences(getCurrentBuildMode(), strategyProfile);
  const isTribalDeck = isActiveBuildTribal(strategyProfile, modePrefs);

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

  // A manually focused theme (the "Other Themes" dropdown) is often outside
  // this commander's own EDHREC page -- Vehicles for Saheeli, say -- so an
  // owned card can match the theme perfectly and never appear in edhrecCards.
  // pickBestCardForBucket draws from scoredNonlands almost exclusively (the
  // fallback pool is only reached once it runs dry), so a card that never
  // gets scored here never gets picked no matter how large its theme bonus
  // would be. Widen the pool to the full collection for theme matches only
  // when a theme is actually focused, so the bonus in scoreCard has cards to
  // apply to.
  if (modePrefs.themeFocus) {
    const alreadyIncluded = new Set(ownedCandidates.map((c) => normalizeCardName(c.name)));

    // "Matches the focused theme" is, for almost any tribal focus, nearly the
    // same test as "is a creature of that type" -- the tribe's own creature
    // type dominates real card templating far more than its noncreature
    // support does. Left unbounded, that widens the pool to ~75% creatures
    // (measured: Lathril, Blade of the Elves with Elves focused -- 124 of the
    // 127 cards this step added were creatures), flooding Phase 2's flexible
    // fill with far more creature candidates than the deck's own type target
    // and overshooting it by double digits. Capping each bucket at its
    // EDHREC-reported average -- not a multiple of it -- keeps the widening
    // step from ever growing a type past what the deck is actually trying to
    // hit. A looser 1.5x cap still landed Lathril, Blade of the Elves 11
    // creatures over its own target (45 vs. 34); landing on the target
    // itself got that down to 2 over (36 vs. 34), with no quality cost since
    // sorting (below) keeps the strongest matches regardless of cap size.
    const bucketCounts = countByType(
      ownedCandidates
        .map((c) => allOwnedCardData.get(normalizeCardName(c.name)))
        .filter(Boolean)
    );
    const bucketCaps = {
      Creature: Number(typeAverages?.Creature) || 20,
      Instant: Number(typeAverages?.Instant) || 10,
      Sorcery: Number(typeAverages?.Sorcery) || 10,
      Artifact: Number(typeAverages?.Artifact) || 8,
      Enchantment: Number(typeAverages?.Enchantment) || 8,
      Planeswalker: Number(typeAverages?.Planeswalker) || 2,
      Other: 15
    };

    // Collected and ranked before the cap is applied -- "matches the theme"
    // is a yes/no filter with no notion of quality, so taking the first N
    // encountered in the collection Map's iteration order let a vanilla Elf
    // common fill a slot a genuine payoff could have had. Scored the same way
    // the fallback tiers already are, so the cards that make it through the
    // cap are the strongest matches, not an arbitrary subset of them.
    const widenedMatches = [];
    for (const [normalizedName, card] of allOwnedCardData) {
      if (alreadyIncluded.has(normalizedName) || !card) continue;
      if (getCardType(card).includes("land")) continue;
      if (!legalForCommander(card.colors, commanders.colors, card)) continue;
      if (!cardMatchesThemeFocus(card, modePrefs)) continue;
      widenedMatches.push({
        normalizedName,
        card,
        score: scoreFallbackCard(card, commanderThemes, strategyProfile, commanders.colors, modePrefs)
      });
    }
    widenedMatches.sort((a, b) => b.score - a.score);

    for (const { normalizedName, card } of widenedMatches) {
      const bucket = getDeckTypeBucket(getCardType(card));
      if ((bucketCounts[bucket] || 0) >= (bucketCaps[bucket] ?? 15)) continue;
      bucketCounts[bucket] = (bucketCounts[bucket] || 0) + 1;

      alreadyIncluded.add(normalizedName);
      ownedCandidates.push({ name: card.name, synergy: 0, decks: 0, label: "", labels: [] });
      ownedCardData.set(normalizedName, card);
    }
  }

  const totalToScore = ownedCandidates.length;
  // A user who explicitly focuses a Snow theme is choosing to build toward
  // snow mana on purpose -- EDHREC has no working theme-focus wiring for
  // "snow" yet (no tag detector, no alias table entry) and the land builder
  // never seeks out snow lands on its own, so refusing every {S} card here
  // would make picking Snow as a theme permanently self-defeating. Treat an
  // explicit snow focus as if a source were already owned.
  const isSnowFocused = modePrefs.focusedThemeSignal.includes("snow");
  const hasSnowSource = isSnowFocused || collectionHasSnowManaSource(allOwnedCardData, commanders.colors);

  for (const edhrecCard of ownedCandidates) {
    processed += 1;
    const normalizedName = normalizeCardName(edhrecCard.name);
    const card = ownedCardData.get(normalizedName);

    if (!card || getCardType(card).includes("land") || !legalForCommander(card.colors, commanders.colors, card)) {
      maybeUpdateScoringProgress(processed, totalToScore);
      continue;
    }

    if (requiresUnavailableSnowMana(card, hasSnowSource)) {
      maybeUpdateScoringProgress(processed, totalToScore);
      continue;
    }

    const referenceBonus = getEdhrecReferenceBonus(edhrecCard, modePrefs);
    if (modePrefs.themeFocus && referenceBonus <= -16) {
      maybeUpdateScoringProgress(processed, totalToScore);
      continue;
    }

    const role = detectRole(card, isTribalDeck);
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
  renderPriorityButtons(commanderThemes, allOwnedCardData, edhrecAllTags);

  updateProgress(88, "Finding collection cards that fit the themes...");
  // Minimal Build skips this entirely: it's the keyword/tag/fingerprint
  // guessing layer that can produce unconvincing fallback-generic picks when
  // a theme isn't modeled well (e.g. Rosheen Meanderer's X-cost payoff,
  // which no detector here recognizes). An empty map here means every
  // leftover slot falls straight to EDHREC-ranked candidates, then plain
  // generic-score fallback -- see buildDeckFromScoredPool's phase order.
  //
  // Otherwise: resolved here rather than inside the builder, since local text
  // matching answers most themes, but the ones it cannot need a Scryfall
  // lookup, and the builder is synchronous.
  const themeCardNames = modePrefs.minimalBuild
    ? new Map()
    : await buildThemeCandidateNames(
        commanderThemes,
        collection,
        allOwnedCardData,
        commanders.colors,
        currentRunContext.themeCardLists
      );
  logMessage(
    modePrefs.minimalBuild
      ? "Minimal Build mode: skipping theme-based collection backfill."
      : `${themeCardNames.size} owned cards match the detected themes.`
  );

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
    { commanderNames: commanders.names, deckSize: commanders.deckSize, themeCardNames }
  );

  logMessage(`Built final deck with ${finalDeck.length} cards.`);
  logMessage(`Final deck breakdown: ${finalDeck.filter(c => c.role !== "land").length} nonlands, ${finalDeck.filter(c => c.role === "land").length} lands.`);
  if (modePrefs.minimalBuild) {
    logMessage(`Minimal Build mode: list stops at ${finalDeck.length} cards (commander + mana base + support package only) — not a full, legal ${commanders.deckSize}-card list.`);
  }

  const sanitizedFinalDeck = sanitizeDeckCards(finalDeck);

  const bracketInfo = estimateDeckBracket(
    sanitizedFinalDeck,
    commanderThemes,
    commanders.colors,
    commanders.names
  );

  const { warnings, fallbackGenericRatio } = generateWarnings(sanitizedFinalDeck, commanderThemes, bracketInfo);

  updateProgress(97, "Rendering results...");
  displayDeckSummary(sanitizedFinalDeck, commanders.primary.name, commanders.colors);
  renderDeckStats(sanitizedFinalDeck, commanders.names.join(" + "), bracketInfo);
  displayDeckBracket(bracketInfo);
  displayGameChangers(bracketInfo);
  displayBuildBreakdown(sanitizedFinalDeck);
  displaySupportPackage(sanitizedFinalDeck, roleTargets);
  displayMinimalBuildHint(fallbackGenericRatio, modePrefs.minimalBuild);
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
copyPreviewBtn.addEventListener("click", copyPreviewText);

// Parse on selection rather than at build time, so the commanders tab has a
// collection to work from without waiting for a deck to be built.
csvFileInput.addEventListener("change", async () => {
  setOwnedCollection(null);
  updateGenerateButtonState();

  const file = csvFileInput?.files?.[0];
  if (file) {
    try {
      setOwnedCollection(await parseCSV(file));
    } catch (error) {
      showToast(error.message);
    }
  }

  resetCommanderScan();
  renderCommandersTab();
});

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
  isEligible: canBeActiveCommander,
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

if (minimalBuildToggle) {
  minimalBuildToggle.addEventListener("click", () => {
    toggleMinimalBuild();
  });
}

bindPreviewHoverImages();
bindCommandersTab();
bindThemeTab();
hydrateCardCacheFromStorage();
renderPreviewEmptyState();
renderCommandersTab();
updateGenerateButtonState();
