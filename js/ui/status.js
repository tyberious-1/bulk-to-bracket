// Progress bar, toast, generate-button gating, and the theme priority buttons.
//
// clearLog/logMessage are intentional no-ops: the on-page log panel was
// removed but the ~25 call sites that narrate the build are still useful as
// documentation of the pipeline, so the calls stay and do nothing.
//
// Depends on: dom.js, state.js, text.js

let toastTimer = null;
let forceGenerateDisabled = false;

// Theme picking has two modes: "single" (a theme button or the dropdown, one theme per build) and "combo" (up to
// PLAN_COMBO_MAX themes stacked into one focus). The choice survives rebuilds; the args let the toggle redraw the panel.
let themePickMode = "single";
let lastPriorityArgs = null;

function updatePriorityButtons() {
  if (typeof updatePlanOptions === "function") updatePlanOptions();
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

  // Combo selects mirror the current focus (a plan card's themes fill them, so a suggestion can be tweaked into your own).
  const comboSelects = Array.from(document.querySelectorAll("#priorityButtons .combo-select"));
  if (comboSelects.length) {
    const themes = splitFocusThemes(getCurrentThemeFocus());
    comboSelects.forEach((select, index) => {
      const wanted = themes[index] || "";
      select.value = Array.from(select.options).some((opt) => opt.value === wanted) ? wanted : "";
    });
    if (typeof refreshComboControls === "function") refreshComboControls();
  }
}

function renderPriorityButtons(commanderThemes = [], allOwnedCardData = null, edhrecAllTags = []) {
  const wrap = document.getElementById("priorityButtons");
  if (!wrap) return;
  lastPriorityArgs = [commanderThemes, allOwnedCardData, edhrecAllTags];

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

  // Every theme EDHREC lists for the commander can go in a combo, the long tail included; unsupported ones stay greyed out.
  const comboOptions = [...topThemes.map((theme) => ({ theme, supported: supportedThemes.has(theme) })),
    ...otherThemes.map((theme) => ({ theme, supported: supportedThemes.has(theme) }))];

  let html = `
    <div class="priority-section pick-mode-section">
      <div class="priority-section-label">Theme pick</div>
      <div class="priority-section-buttons">
        <button class="mode-toggle-btn pick-mode-btn ${themePickMode === "single" ? "active" : ""}" data-pick-mode="single" type="button">Single theme</button>
        <button class="mode-toggle-btn pick-mode-btn ${themePickMode === "combo" ? "active" : ""}" data-pick-mode="combo" type="button">Combo</button>
      </div>
    </div>
  `;

  if (themePickMode === "combo" && comboOptions.length) {
    const slot = (n) => `
          <select class="theme-dropdown combo-select" data-slot="${n}" aria-label="Combo theme ${n + 1}">
            <option value="">Theme ${n + 1}${n < 2 ? "" : " (optional)"}...</option>
            ${comboOptions.map((opt) => `
              <option value="${escapeHtml(opt.theme)}" data-unsupported="${opt.supported ? "0" : "1"}" ${opt.supported ? "" : "disabled"}>${escapeHtml(formatThemeLabel(opt.theme))}</option>
            `).join("")}
          </select>`;
    html += `
      <div class="priority-section combo-section">
        <div class="priority-section-label">Combo (pick two or three themes)</div>
        <div class="priority-section-buttons">${slot(0)}${slot(1)}${slot(2)}</div>
        <div id="comboCoverage" class="combo-coverage plan-card-coverage"></div>
        <button id="comboBuildBtn" type="button" disabled>Build combo</button>
      </div>
    `;
  }

  if (themePickMode === "single" && topButtons.length) {
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

  if (themePickMode === "single" && otherOptions.length) {
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

  wrap.innerHTML = themePickMode === "single" && !topButtons.length && !otherOptions.length
    ? html + '<div class="priority-section"><div class="priority-section-label">No themes detected</div></div>'
    : html;

  updatePriorityButtons();

  wrap.querySelectorAll(".pick-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const picked = btn.dataset.pickMode === "combo" ? "combo" : "single";
      if (picked === themePickMode || !lastPriorityArgs) return;
      themePickMode = picked;
      renderPriorityButtons(...lastPriorityArgs);
    });
  });

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

// "theme:tokens~artifacts|curveFirst" -> "Tokens + Artifacts, Curve First"
function formatBuildModeLabel(mode) {
  return String(mode || "").split("|").filter(Boolean).map((part) => {
    if (part.startsWith("theme:")) return splitFocusThemes(part.slice(6)).map(formatThemeLabel).join(" + ");
    if (part === "curveFirst") return "Curve First";
    if (part === "minimal") return "Minimal Build";
    if (part === "noEvents") return "Event Engines off";
    return part;
  }).join(", ");
}

function getCurrentBuildMode() {
  const parts = [];
  const currentThemeFocus = getCurrentThemeFocus();
  if (currentThemeFocus) parts.push(`theme:${currentThemeFocus}`);
  if (getMinimalBuildEnabled()) parts.push("minimal");
  if (getCurveFirstEnabled()) parts.push("curveFirst");
  if (!getEventEnginesEnabled()) parts.push("noEvents");
  return parts.join("|");
}

function updateBuildModeToggle() {
  const toggle = document.getElementById("minimalBuildToggle");
  if (toggle) toggle.classList.toggle("active", getMinimalBuildEnabled());
  const curveFirstToggle = document.getElementById("curveFirstToggle");
  if (curveFirstToggle) curveFirstToggle.classList.toggle("active", getCurveFirstEnabled());
  const eventEnginesToggle = document.getElementById("eventEnginesToggle");
  if (eventEnginesToggle) eventEnginesToggle.classList.toggle("active", getEventEnginesEnabled());
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
