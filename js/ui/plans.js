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
