// Long-lived element handles. Safe to resolve at module load because
// main.js is a deferred module, so the document has already parsed.

const commanderInput = document.getElementById("commanderInput");
const autocompleteList = document.getElementById("autocompleteList");
const csvFileInput = document.getElementById("csvFile");
const generateBtn = document.getElementById("generateBtn");
const copyExportBtn = document.getElementById("copyExportBtn");

const commanderImage = document.getElementById("commanderImage");
const commanderMeta = document.getElementById("commanderMeta");
const commanderImageSkeleton = document.getElementById("commanderImageSkeleton");
const colorPips = document.getElementById("colorPips");
const toast = document.getElementById("toast");
const deckStats = document.getElementById("deckStats");

const priorityButtonsWrap = document.getElementById("priorityButtons");

// Second commander field: hidden until the first pick turns out to have a
// pairing ability (partner, Background, Doctor's companion, ...).
const partnerRow = document.getElementById("partnerRow");
const partnerLabel = document.getElementById("partnerLabel");
const partnerInput = document.getElementById("partnerInput");
const partnerAutocompleteList = document.getElementById("partnerAutocompleteList");
const commanderImageWrap = document.getElementById("commanderImageWrap");
const partnerImage = document.getElementById("partnerImage");
