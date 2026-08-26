// String transforms: card-name normalization for lookups and cache keys,
// theme-name normalization and display formatting, HTML escaping.

function normalizeCardName(name) {
  return String(name || "").trim().toLowerCase();
}

function getPrimaryCardName(name) {
  return String(name || "").split("//")[0].trim();
}

function normalizeUnicodeName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function cleanCardNameForLookup(name) {
  return normalizeUnicodeName(getPrimaryCardName(name))
    .replace(/’/g, "'")
    .replace(/‘/g, "'")
    .replace(/—/g, "-")
    .replace(/–/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function encodeCardNameForScryfall(name) {
  return encodeURIComponent(cleanCardNameForLookup(name));
}

function slugifyForEdhrec(name) {
  return cleanCardNameForLookup(name)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/,/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatThemeLabel(theme) {
  if (!theme) return "";
  return String(theme)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeThemeName(theme) {
  return String(theme || "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[\/_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
