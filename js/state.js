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

// Minimal Build mode: skip theme-based collection backfill and fill leftover
// slots straight from EDHREC's own ranking instead. Opt-in only, toggled from
// its own control rather than folded into the theme-focus buttons above.
let minimalBuildEnabled = false;

function getMinimalBuildEnabled() {
  return minimalBuildEnabled;
}

function setMinimalBuildEnabled(enabled) {
  minimalBuildEnabled = Boolean(enabled);
}

// Curve First mode: a personal preference toggle (not a public format) that
// caps ramp and board wipes and boosts draw/removal targets. See
// dev/docs/superpowers/specs/2026-10-12-curve-first-build-mode-theorycraft.md.
let curveFirstEnabled = false;

// Event engines: cards that cause the events a commander's own abilities run on score a little.
// On by default; the build-mode switch turns it off, and a build then runs without any event.
let eventEnginesEnabled = true;

function getEventEnginesEnabled() {
  return eventEnginesEnabled;
}

function setEventEnginesEnabled(enabled) {
  eventEnginesEnabled = Boolean(enabled);
}

function getCurveFirstEnabled() {
  return curveFirstEnabled;
}

function setCurveFirstEnabled(enabled) {
  curveFirstEnabled = Boolean(enabled);
}

// Set by the Theme/Typal tab before handing a commander to the build flow,
// so the very first generateDeck() run already focuses that theme instead of
// requiring a manual click on a priority button after the fact. Consumed
// once (takePendingThemeFocus clears it) so a later plain rebuild -- typing a
// new commander by hand -- doesn't inherit a stale focus.
let pendingThemeFocus = null;

function setPendingThemeFocus(theme) {
  pendingThemeFocus = theme || null;
}

function takePendingThemeFocus() {
  const theme = pendingThemeFocus;
  pendingThemeFocus = null;
  return theme;
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

// The uploaded collection, parsed once when the file is chosen so the build
// flow and the commanders tab read the same object rather than each parsing the
// file again.
let ownedCollection = null;

function getOwnedCollection() {
  return ownedCollection;
}

function setOwnedCollection(collection) {
  ownedCollection = collection || null;
}
