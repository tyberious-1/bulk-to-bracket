// Progress bar, toast, generate-button gating, and the theme priority buttons.
//
// clearLog/logMessage are intentional no-ops: the on-page log panel was
// removed but the ~25 call sites that narrate the build are still useful as
// documentation of the pipeline, so the calls stay and do nothing.
//
// Depends on: dom.js, state.js, text.js

let toastTimer = null;
let forceGenerateDisabled = false;

function updatePriorityButtons() {
  document.querySelectorAll(".priority-btn").forEach((btn) => {
    const mode = String(btn.dataset.mode || "");
    if (mode.startsWith("theme:")) {
      btn.classList.toggle("active", mode.slice(6) === getCurrentThemeFocus());
      return;
    }
    btn.classList.remove("active");
  });

  // The focused theme may live in the dropdown rather than the button row
  // (a long-tail EDHREC tag) -- reflect it there too, so a rebuild doesn't
  // silently reset the select to its placeholder while focus is still active.
  const dropdown = document.getElementById("themeDropdown");
  if (dropdown) {
    const currentFocus = getCurrentThemeFocus();
    const focusMode = currentFocus ? `theme:${currentFocus}` : "";
    dropdown.value = Array.from(dropdown.options).some((opt) => opt.value === focusMode) ? focusMode : "";
  }
}

function renderPriorityButtons(commanderThemes = [], allOwnedCardData = null, edhrecAllTags = []) {
  const wrap = document.getElementById("priorityButtons");
  if (!wrap) return;

  const detectedThemes = Array.from(new Set((commanderThemes || []).filter(Boolean)));
  const topThemes = detectedThemes.slice(0, 5);

  // The dropdown pulls from EDHREC's full taglink list (its "more tags"
  // section), not just the curated commanderThemes set -- that curation
  // exists to keep noise out of the build's default scoring, but a dropdown
  // pick is opt-in, so the long tail belongs here even when it didn't clear
  // the bar that keeps it out of the automatic top-N. Anything detected but
  // bumped past the top 5 falls in here too, rather than being dropped.
  const topThemeSet = new Set(topThemes);
  const otherThemes = Array.from(new Set([...detectedThemes.slice(5), ...(edhrecAllTags || [])].filter(Boolean)))
    .filter((theme) => !topThemeSet.has(theme));

  const allThemes = Array.from(new Set([...topThemes, ...otherThemes]));

  // EDHREC names strategy-level themes ("Aggro", "Combo") that no card carries
  // a signal for, and any collection can simply lack a theme's cards. Either
  // way the rebuild returns the same deck, so say so up front rather than let
  // the click look broken.
  const supportedThemes = getSupportedThemes(allThemes, allOwnedCardData);

  const topButtons = topThemes.map((theme) => {
    const supported = supportedThemes.has(theme);
    return {
      mode: `theme:${theme}`,
      label: formatThemeLabel(theme),
      disabled: !supported,
      title: supported ? "" : "No cards in your collection match this theme"
    };
  });

  const otherOptions = otherThemes.map((theme) => {
    const supported = supportedThemes.has(theme);
    return {
      mode: `theme:${theme}`,
      label: formatThemeLabel(theme),
      disabled: !supported
    };
  });

  let html = "";

  if (topButtons.length) {
    html += `
      <div class="priority-section">
        <div class="priority-section-label">Top 5</div>
        <div class="priority-section-buttons">
          ${topButtons.map((btn) => `
            <button class="priority-btn" data-mode="${escapeHtml(btn.mode)}" type="button" title="${escapeHtml(btn.title || "")}" ${btn.disabled ? "disabled" : ""}>${escapeHtml(btn.label)}</button>
          `).join("")}
        </div>
      </div>
    `;
  }

  if (otherOptions.length) {
    html += `
      <div class="priority-section">
        <div class="priority-section-label">Other Themes</div>
        <select id="themeDropdown" class="theme-dropdown">
          <option value="">Select a theme...</option>
          ${otherOptions.map((opt) => `
            <option value="${escapeHtml(opt.mode)}" ${opt.disabled ? "disabled" : ""}>${escapeHtml(opt.label)}</option>
          `).join("")}
        </select>
      </div>
    `;
  }

  wrap.innerHTML = html || '<div class="priority-section"><div class="priority-section-label">No themes detected</div></div>';

  updatePriorityButtons();

  // Wire up dropdown
  const dropdown = document.getElementById("themeDropdown");
  if (dropdown) {
    dropdown.addEventListener("change", (e) => {
      if (e.target.value) {
        regenerateWithMode(e.target.value);
      }
    });
  }
}

function getCurrentBuildMode() {
  const parts = [];
  const currentThemeFocus = getCurrentThemeFocus();
  if (currentThemeFocus) parts.push(`theme:${currentThemeFocus}`);
  return parts.join("|");
}

function updateProgress(percent, statusText, subStatus = "") {
  document.getElementById("progressBar").style.width = `${Math.max(0, Math.min(100, percent))}%`;
  document.getElementById("statusText").textContent = statusText;
  document.getElementById("subStatusText").textContent = subStatus;
}

function clearLog() {
  return;
}

function logMessage(message) {
  return;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 1800);
}

function setGenerateEnabled(enabled) {
  forceGenerateDisabled = !enabled;
  updateGenerateButtonState();
}

function updateGenerateButtonState() {
  const commanderName = commanderInput.value.trim();
  const file = csvFileInput?.files?.[0];
  generateBtn.disabled = forceGenerateDisabled || !commanderName || !file;
}
