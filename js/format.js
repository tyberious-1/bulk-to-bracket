// The active deck format. Everything else in the pipeline that gates card
// or commander legality consults this flag rather than knowing about
// formats itself -- index.html never calls setActiveFormat, so it stays
// "commander" and every format-aware check below is a no-op for the
// existing app.
//
// Depends on: cards.js

let activeFormat = "commander"; // or "pauperCommander"

function setActiveFormat(format) {
  activeFormat = format;
}

function isPauperFormat() {
  return activeFormat === "pauperCommander";
}

function canBeActiveCommander(card) {
  return isPauperFormat() ? canBePauperCommander(card) : canBeCommander(card);
}
