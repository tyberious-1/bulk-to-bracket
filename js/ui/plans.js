// Plan options panel: the 2-3 plans a commander could be built around, each with
// example owned cards and honest coverage, plus a box to name a plan EDHREC does
// not list. Clicking a plan rebuilds with its themes as the focus.
//
// Depends on: dom.js, state.js, text.js, analysis/plans.js

function describePlanCoverage(plan) {
  if (plan.custom || plan.fromCollection) {
    return `You own ${plan.owned} matching cards in this commander's colors.`;
  }
  return `You own ${plan.fullOwned} of the ${plan.fullWanted} cards decks of this plan commonly play; ${plan.owned} of ${plan.wanted} are signature to the plan.`;
}

function describePlanCaveat(plan) {
  if (!plan.light) return "";
  const other = plan.betterPlan ? ` ${plan.betterPlan} is better supported by your collection.` : "";
  return `Light on your collection: the build will fill the rest with generic cards.${other}`;
}

function renderPlanOptions(plans, customPlan = null) {
  const wrap = document.getElementById("planOptions");
  const panel = document.getElementById("planOptionsPanel");
  if (!wrap || !panel) return;

  const cards = [...(plans || []), ...(customPlan ? [customPlan] : [])];
  const cardHtml = cards.map((plan) => {
    const caveat = describePlanCaveat(plan);
    return `
      <div class="plan-card" data-focus="${escapeHtml(planFocusMode(plan))}">
        <div class="plan-card-title">${escapeHtml(plan.label)}${plan.custom ? ' <span class="plan-tag">your plan</span>' : ""}${plan.fromCollection ? ' <span class="plan-tag">from your collection</span>' : ""}</div>
        <div class="plan-card-coverage">${escapeHtml(describePlanCoverage(plan))}</div>
        ${plan.examples.length ? `<div class="plan-card-examples">e.g. ${plan.examples.map(escapeHtml).join(", ")}</div>` : ""}
        ${caveat ? `<div class="plan-card-caveat">${escapeHtml(caveat)}</div>` : ""}
        <button class="plan-btn" type="button" data-focus="${escapeHtml(planFocusMode(plan))}">Build this plan</button>
      </div>`;
  }).join("");

  const emptyNote = plans && plans.length
    ? ""
    : '<p class="plan-empty">No distinct themes found for this commander. That does not mean nothing works: name a plan below.</p>';

  wrap.innerHTML = `
    ${emptyNote}
    <div class="plan-cards">${cardHtml}</div>
    <form id="customPlanForm" class="plan-custom">
      <label for="customPlanInput">Name your own plan (a creature type or theme, e.g. Merfolk)</label>
      <input id="customPlanInput" type="text" placeholder="Merfolk" autocomplete="off" />
      <button type="submit">Check my collection</button>
    </form>`;
  panel.classList.remove("hidden");
  updatePlanOptions();
}

// Combo picker (Single / Combo toggle in the theme panel): keep the three selects from picking the same theme twice, show how
// many owned cards the stack matches, and enable the build button once two themes are picked. `context` is the run context
// (collection card data and commanders); without one, only the selects and button are refreshed.
function refreshComboControls(context) {
  const selects = Array.from(document.querySelectorAll("#priorityButtons .combo-select"));
  if (!selects.length) return;
  const ctx = context || (typeof currentRunContext !== "undefined" ? currentRunContext : null);
  const picks = selects.map((select) => select.value).filter(Boolean);
  selects.forEach((select) => {
    Array.from(select.options).forEach((opt) => {
      if (!opt.value) return;
      opt.disabled = opt.dataset.unsupported === "1" || (picks.includes(opt.value) && select.value !== opt.value);
    });
  });
  const button = document.getElementById("comboBuildBtn");
  if (button) button.disabled = picks.length < 2;
  const coverage = document.getElementById("comboCoverage");
  if (!coverage) return;
  if (!picks.length) {
    coverage.textContent = "Pick two or three themes to stack.";
    return;
  }
  const plan = ctx ? buildComboPlan(picks, ctx.allOwnedCardData, ctx.commanders.colors, ctx.commanders.primary.name) : null;
  if (!plan) {
    coverage.textContent = "";
    return;
  }
  const caveat = describePlanCaveat(plan);
  coverage.textContent = `${describePlanCoverage(plan)}${caveat ? ` ${caveat}` : ""}`;
}

function updatePlanOptions() {
  const focus = getCurrentThemeFocus();
  document.querySelectorAll("#planOptions .plan-card").forEach((card) => {
    card.classList.toggle("active", Boolean(focus) && card.dataset.focus === focus);
  });
}

// Fun picks: names typed one per line (card names contain commas, so lines, not
// commas, separate them). The builder caps them at FUN_PICK_MAX.
function getFunPickNames() {
  const input = document.getElementById("funPicksInput");
  return String(input?.value || "").split("\n").map((line) => line.trim()).filter(Boolean);
}

// Say which fun picks made it in and why the rest did not.
function updateFunPicksNote(requested, deck, minimalBuild) {
  const note = document.getElementById("funPicksNote");
  if (!note) return;
  if (!requested.length) { note.textContent = ""; return; }
  if (minimalBuild) { note.textContent = "Minimal Build skips fun picks."; return; }
  const inDeck = new Set(deck.filter((c) => c.source === "fun-pick").map((c) => normalizeCardName(c.name)));
  const missed = requested.slice(0, FUN_PICK_MAX).filter((name) => !inDeck.has(normalizeCardName(name)) && !inDeck.has(normalizeCardName(getPrimaryCardName(name))));
  const extra = requested.length > FUN_PICK_MAX ? ` Only the first ${FUN_PICK_MAX} count.` : "";
  note.textContent = missed.length
    ? `Added ${inDeck.size} fun pick${inDeck.size === 1 ? "" : "s"}. Skipped (not in your collection or outside the commander's colors): ${missed.join(", ")}.${extra}`
    : `Added ${inDeck.size} fun pick${inDeck.size === 1 ? "" : "s"}.${extra}`;
}

function hidePlanOptions() {
  document.getElementById("planOptionsPanel")?.classList.add("hidden");
}

// Deck Colors panel: shown only for a hybrid commander that can be built in fewer colors (getHybridColorOptions). One
// button per color set that still casts it, the one being built marked active; main.js rebuilds on a click.
const DECK_COLOR_NAMES = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green" };
function renderDeckColorOptions(commanders) {
  const panel = document.getElementById("deckColorsPanel");
  const wrap = document.getElementById("deckColorOptions");
  if (!panel || !wrap) return;
  const options = (commanders && commanders.colorOptions) || [];
  if (!options.length) { panel.classList.add("hidden"); wrap.innerHTML = ""; return; }
  const current = sortColorsWubrg(commanders.colors || []).join("");
  wrap.innerHTML = options.map((set) => {
    const key = set.join("");
    const pips = set.map((c) => `<span class="color-pip pip-${escapeHtml(c)}">${escapeHtml(c)}</span>`).join("");
    const label = set.map((c) => DECK_COLOR_NAMES[c] || c).join(" + ");
    return `<button type="button" class="mode-toggle-btn deck-color-btn${key === current ? " active" : ""}" data-colors="${escapeHtml(key)}" title="${escapeHtml(label)}">${pips} ${escapeHtml(label)}</button>`;
  }).join("");
  panel.classList.remove("hidden");
}

function hideDeckColorOptions() {
  document.getElementById("deckColorsPanel")?.classList.add("hidden");
}
