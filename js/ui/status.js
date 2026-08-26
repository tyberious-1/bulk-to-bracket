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
}

function renderPriorityButtons(commanderThemes = []) {
  const wrap = document.getElementById("priorityButtons");
  if (!wrap) return;

  const uniqueThemes = Array.from(new Set((commanderThemes || []).filter(Boolean))).slice(0, 5);
  const sections = [
    {
      title: "Detected Themes",
      buttons: uniqueThemes.map((theme) => ({
        mode: `theme:${theme}`,
        label: formatThemeLabel(theme)
      }))
    }
  ].filter((section) => section.buttons.length);

  wrap.innerHTML = sections.map((section) => `
    <div class="priority-section">
      <div class="priority-section-label">${escapeHtml(section.title)}</div>
      <div class="priority-section-buttons">
        ${section.buttons.map((btn) => `
          <button class="priority-btn" data-mode="${escapeHtml(btn.mode)}" type="button" ${btn.disabled ? "disabled" : ""}>${escapeHtml(btn.label)}</button>
        `).join("")}
      </div>
    </div>
  `).join("");

  updatePriorityButtons();
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
