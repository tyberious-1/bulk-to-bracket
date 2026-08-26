// Mutable state shared across module boundaries. Accessor functions rather
// than an exported binding, because imported `let` bindings are read-only
// for the importing module.
//
// State used by only one module (autocomplete timers, chart instances, the
// active run context) stays private to that module.

let currentThemeFocus = "";

function getCurrentThemeFocus() {
  return currentThemeFocus;
}

function setCurrentThemeFocus(theme) {
  currentThemeFocus = String(theme || "");
}

// The resolved commander cards, kept here because the partner field's
// legality filter has to consult the current primary pick on every keystroke.
let commanderCard = null;
let partnerCard = null;

function getCommanderCard() {
  return commanderCard;
}

function setCommanderCard(card) {
  commanderCard = card || null;
}

function getPartnerCard() {
  return partnerCard;
}

function setPartnerCard(card) {
  partnerCard = card || null;
}
