// Commander pairing rules.
//
// Five printed mechanics let a deck have two commanders. Each is detected from
// rules text -- which survives the persistent card cache -- plus the type line
// for the two "is a" checks.
//
// Scryfall's `keywords` array is deliberately NOT used: it tags every Friends
// forever card as "Partner", which would permit illegal pairs.
//
// Ordering matters. Friends forever prints as "Partner-Friends forever", so its
// text contains the word "partner" and it must be recognised first and excluded
// from the plain Partner rule.
//
// Depends on: cards.js, text.js

function isBackgroundCard(card) {
  return /\bbackground\b/.test(getCardType(card));
}

function isTimeLordDoctor(card) {
  return getCardType(card).includes("time lord doctor");
}

function hasFriendsForever(card) {
  return /\bfriends forever\b/.test(getCardText(card));
}

function hasPartnerWith(card) {
  return /\bpartner with\b/.test(getCardText(card));
}

// "Partner with X" also grants plain Partner, so such a card may pair with any
// Partner card, not only its named mate.
function hasPartnerAbility(card) {
  if (hasFriendsForever(card)) return false;
  if (isBackgroundCard(card)) return false;
  return /\bpartner\b/.test(getCardText(card));
}

function hasChooseABackground(card) {
  return /\bchoose a background\b/.test(getCardText(card));
}

// Apostrophe class rather than a literal, since printings vary between ' and .
function hasDoctorsCompanion(card) {
  return /\bdoctor.s companion\b/.test(getCardText(card));
}

function canHaveCommanderPartner(card) {
  if (!card) return false;
  return hasFriendsForever(card) ||
    hasPartnerAbility(card) ||
    hasChooseABackground(card) ||
    isBackgroundCard(card) ||
    isTimeLordDoctor(card) ||
    hasDoctorsCompanion(card);
}

function isLegalCommanderPair(primary, partner) {
  if (!primary || !partner) return false;
  if (normalizeCardName(primary.name) === normalizeCardName(partner.name)) return false;

  if (hasFriendsForever(primary) && hasFriendsForever(partner)) return true;
  if (hasPartnerAbility(primary) && hasPartnerAbility(partner)) return true;
  if (hasChooseABackground(primary) && isBackgroundCard(partner)) return true;
  if (isBackgroundCard(primary) && hasChooseABackground(partner)) return true;
  if (isTimeLordDoctor(primary) && hasDoctorsCompanion(partner)) return true;
  if (hasDoctorsCompanion(primary) && isTimeLordDoctor(partner)) return true;

  return false;
}

// Names the mechanic in play, for the second input's label.
function getCommanderPartnerLabel(card) {
  if (!card) return "";
  if (hasChooseABackground(card)) return "Background";
  if (isBackgroundCard(card)) return "Commander";
  if (isTimeLordDoctor(card)) return "Companion";
  if (hasDoctorsCompanion(card)) return "Doctor";
  if (hasFriendsForever(card)) return "Friends forever partner";
  if (hasPartnerAbility(card)) return "Partner";
  return "";
}

// "Partner with X" names its mate, so the UI can pre-fill it. Returns the name
// lowercased as it appears in rules text; Scryfall lookups are case-insensitive.
function getNamedCommanderPartner(card) {
  if (!card || !hasPartnerWith(card)) return "";
  const match = getCardText(card).match(/\bpartner with ([^(\n]+)/);
  return match ? match[1].trim() : "";
}
