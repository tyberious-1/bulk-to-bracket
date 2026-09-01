// EDHREC access and payload mining.
//
// EDHREC's commander JSON has no stable schema for the numbers we want, so
// the extractors here walk the payload defensively and score several
// candidate shapes rather than trusting one path.
//
// Depends on: constants.js, http.js, text.js, themes.js

// A commander page alone rarely lists enough cards a given collection owns to
// fill a deck -- for a niche commander it can be a third of what's needed, and
// the builder then backfills the rest with no commander-specific signal at
// all. Each detected theme has its own page with a different card list, so
// pulling the top few multiplies the candidate pool for a few extra requests.
const EDHREC_THEME_PAGE_LIMIT = 5;

// Below this many decks a theme page's inclusion rates are noise -- EDHREC
// serves pages built from as few as four decks, where one deck is 25%.
const EDHREC_THEME_MIN_DECKS = 20;

function toEdhrecSlug(name) {
  return slugifyForEdhrec(name);
}

// The share of decks that could have played this card and did. EDHREC's raw
// num_decks is not comparable across commanders -- a niche commander's most
// played card sits near 400 decks where a popular one's clears 40,000 -- so
// dividing by potential_decks is what lets one weight work for both.
//
// Returns null when EDHREC has no usable numbers, which means "no opinion" --
// distinct from a real rate of 0.
function getEdhrecInclusionRate(edhrecEntry) {
  if (!edhrecEntry) return null;

  const decks = Number(edhrecEntry.decks || 0);
  const potential = Number(edhrecEntry.potentialDecks || 0);
  if (!(decks > 0) || !(potential > 0)) return null;

  return Math.min(1, decks / potential);
}

// EDHREC serves a partnered deck under a combined slug, but only in one
// ordering -- the other returns HTTP 200 with an empty payload. The ordering is
// not consistently alphabetical, so try both, then fall back to the primary
// commander's own page.
function buildEdhrecSlugCandidates(commanderNames) {
  const slugs = (Array.isArray(commanderNames) ? commanderNames : [commanderNames])
    .filter(Boolean)
    .map((name) => toEdhrecSlug(getPrimaryCardName(name)))
    .filter(Boolean);

  if (!slugs.length) return [];
  if (slugs.length === 1) return [slugs[0]];
  return [`${slugs[0]}-${slugs[1]}`, `${slugs[1]}-${slugs[0]}`, slugs[0]];
}

// A 200 carrying no cardlists is a miss, not a hit: EDHREC answers unknown
// pair slugs that way. Retrying will not help, so move to the next candidate.
function edhrecPayloadHasCards(data) {
  const cardlists = data?.container?.json_dict?.cardlists;
  return Array.isArray(cardlists) && cardlists.length > 0;
}

// Returns { data, slug } so theme sub-page URLs can be built from the slug
// that actually resolved, rather than guessing it again.
async function fetchEdhrecCommanderJson(commanderNames) {
  const candidates = buildEdhrecSlugCandidates(commanderNames);
  let lastError = null;

  for (const slug of candidates) {
    const urls = [
      `${EDHREC_BASE}${slug}.json`,
      `${EDHREC_BASE}${slug}/${slug}.json`
    ];

    for (const url of urls) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const data = await fetchJsonWithTimeout(url, {}, 12000);
          if (edhrecPayloadHasCards(data)) return { data, slug };
          break;
        } catch (error) {
          lastError = error;
          console.warn(`EDHREC fetch failed (attempt ${attempt})`, url, error);
          await sleep(300 * attempt);
        }
      }
    }
  }

  console.warn(`Failed to fetch EDHREC commander data for ${commanderNames}.`, lastError);
  return null;
}

// Themes worth pulling a page for: the most-played ones, and only where enough
// decks back them to make the numbers mean something.
function pickEdhrecThemeSlugs(data) {
  const taglinks = data?.panels?.taglinks;
  if (!Array.isArray(taglinks)) return [];

  return taglinks
    .filter((tag) => tag?.slug && Number(tag.count || 0) >= EDHREC_THEME_MIN_DECKS)
    .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
    .slice(0, EDHREC_THEME_PAGE_LIMIT)
    .map((tag) => String(tag.slug));
}

// A missing or broken theme page is not worth failing the build over -- the
// commander page already gave us a usable pool.
async function fetchEdhrecThemePage(commanderSlug, themeSlug) {
  try {
    const data = await fetchJsonWithTimeout(`${EDHREC_BASE}${commanderSlug}/${themeSlug}.json`, {}, 12000);
    return edhrecPayloadHasCards(data) ? data : null;
  } catch (error) {
    console.warn(`EDHREC theme page unavailable: ${commanderSlug}/${themeSlug}`, error);
    return null;
  }
}

function extractLikelyTags(value, weights) {
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === "string")) {
      value.forEach((tag, index) => {
        if (!isLikelyEdhrecTagCandidate(tag)) return;
        const key = normalizeThemeName(tag);
        weights.set(key, Math.max(weights.get(key) || 0, value.length - index));
      });
      return;
    }

    value.forEach((item) => extractLikelyTags(item, weights));
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const [key, nested] of Object.entries(value)) {
    const lowerKey = normalizeThemeName(key);

    if (lowerKey.includes("tag") && typeof nested === "string" && isLikelyEdhrecTagCandidate(nested)) {
      const tagKey = normalizeThemeName(nested);
      weights.set(tagKey, Math.max(weights.get(tagKey) || 0, 6));
      continue;
    }

    if (lowerKey.includes("tag") && Array.isArray(nested) && nested.every((item) => typeof item === "string")) {
      nested.forEach((tag, index) => {
        if (!isLikelyEdhrecTagCandidate(tag)) return;
        const tagKey = normalizeThemeName(tag);
        weights.set(tagKey, Math.max(weights.get(tagKey) || 0, nested.length - index + 2));
      });
      continue;
    }

    if (lowerKey.includes("tag") && Array.isArray(nested)) {
      nested.forEach((item, index) => {
        if (!item || typeof item !== "object") return;
        const label = item.name || item.label || item.tag || item.value || item.header;
        if (!isLikelyEdhrecTagCandidate(label)) return;
        const count = Number(item.count || item.num_decks || item.decks || item.value_count || 0);
        const score = count > 0 ? count : Math.max(1, nested.length - index + 1);
        const tagKey = normalizeThemeName(label);
        weights.set(tagKey, Math.max(weights.get(tagKey) || 0, score));
      });
    }

    extractLikelyTags(nested, weights);
  }
}

function extractEdhrecTagsFromData(data) {
  const weights = new Map();
  extractLikelyTags(data, weights);
  return Array.from(weights.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
    .slice(0, 5);
}

function parseEdhrecSectionAverage(section) {
  const numericCandidates = [
    section?.avg,
    section?.average,
    section?.count,
    section?.total,
    section?.num_cards,
    section?.numCards,
    section?.cards,
    section?.amount
  ];

  for (const candidate of numericCandidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      return Math.round(candidate);
    }
  }

  const textCandidates = [section?.header, section?.value, section?.title, section?.label, section?.tag]
    .filter(Boolean)
    .map(String);

  for (const candidate of textCandidates) {
    const match = candidate.match(/(\d{1,2})/);
    if (match) return Number(match[1]);
  }

  return null;
}

function extractEdhrecTypeAverages(data) {
  const typeKeyMap = {
    creature: "Creature",
    creatures: "Creature",
    instant: "Instant",
    instants: "Instant",
    sorcery: "Sorcery",
    sorceries: "Sorcery",
    artifact: "Artifact",
    artifacts: "Artifact",
    enchantment: "Enchantment",
    enchantments: "Enchantment",
    planeswalker: "Planeswalker",
    planeswalkers: "Planeswalker",
    land: "Land",
    lands: "Land"
  };

  const counts = {};
  const maxReasonableTypeCount = 40;
  const buckets = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Land"];

  function mapTypeBucket(label) {
    const normalized = normalizeThemeName(label);
    if (typeKeyMap[normalized]) return typeKeyMap[normalized];
    if (normalized.includes("creature")) return "Creature";
    if (normalized.includes("instant")) return "Instant";
    if (normalized.includes("sorcer")) return "Sorcery";
    if (normalized.includes("artifact")) return "Artifact";
    if (normalized.includes("enchantment")) return "Enchantment";
    if (normalized.includes("planeswalker")) return "Planeswalker";
    if (normalized.includes("land")) return "Land";
    return null;
  }

  function addCount(key, value, allowOverride = true) {
    const bucket = mapTypeBucket(key);
    const numeric = Number(value);
    if (!bucket || !Number.isFinite(numeric) || numeric < 0) return;
    const bounded = Math.max(0, Math.min(maxReasonableTypeCount, Math.round(numeric)));
    if (allowOverride) {
      counts[bucket] = Math.max(counts[bucket] || 0, bounded);
    } else if (counts[bucket] === undefined) {
      counts[bucket] = bounded;
    }
  }

  function readDirectTypeCounts(source) {
    if (!source || typeof source !== "object" || Array.isArray(source)) return null;
    const out = {};
    for (const [key, value] of Object.entries(source)) {
      const bucket = mapTypeBucket(key);
      const numeric = Number(value);
      if (!bucket || !Number.isFinite(numeric) || numeric < 0) continue;
      out[bucket] = Math.max(0, Math.min(maxReasonableTypeCount, Math.round(numeric)));
    }

    const populated = Object.keys(out).length;
    if (populated < 3) return null;
    if (!out.Land || !out.Creature) return null;
    return out;
  }

  function scoreDirectCounts(typeCounts) {
    if (!typeCounts) return -1;
    const coverage = buckets.filter((bucket) => Number.isFinite(typeCounts[bucket])).length;
    const total = buckets.reduce((sum, bucket) => sum + (Number(typeCounts[bucket]) || 0), 0);
    const closeness = Math.max(0, 100 - Math.abs(99 - total));
    return coverage * 100 + closeness;
  }

  const explicitCandidates = [
    readDirectTypeCounts(data),
    readDirectTypeCounts(data?.container?.json_dict),
    readDirectTypeCounts(data?.container?.json_dict?.stats),
    readDirectTypeCounts(data?.container?.json_dict?.meta),
    readDirectTypeCounts(data?.meta)
  ].filter(Boolean);

  const preferredDirectCounts = explicitCandidates
    .sort((a, b) => scoreDirectCounts(b) - scoreDirectCounts(a))[0] || null;

  if (preferredDirectCounts) {
    for (const [bucket, value] of Object.entries(preferredDirectCounts)) {
      counts[bucket] = value;
    }
  }

  function visit(node, depth = 0, allowOverride = true) {
    if (!node || depth > 6) return;

    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1, allowOverride);
      return;
    }

    if (typeof node !== "object") return;

    const keys = Object.keys(node);
    const hasTypeShape = keys.some((key) => typeKeyMap[normalizeThemeName(key)]);
    if (hasTypeShape) {
      for (const [key, value] of Object.entries(node)) addCount(key, value, allowOverride);
    }

    for (const value of Object.values(node)) {
      if (value && typeof value === "object") visit(value, depth + 1, allowOverride);
    }
  }

  visit(data, 0, !preferredDirectCounts);
  if (data?.container?.json_dict && data.container.json_dict !== data) {
    visit(data.container.json_dict, 0, !preferredDirectCounts);
  }

  const cardlists = data?.container?.json_dict?.cardlists;
  if (Array.isArray(cardlists)) {
    for (const section of cardlists) {
      const labelCandidates = [section?.header, section?.value, section?.title, section?.label, section?.tag]
        .filter(Boolean)
        .map((value) => normalizeThemeName(String(value)));

      let bucket = null;
      for (const label of labelCandidates) {
        const mapped = mapTypeBucket(label);
        if (mapped) {
          bucket = mapped;
          break;
        }
      }
      if (!bucket) continue;

      const average = parseEdhrecSectionAverage(section);
      if (!average && average !== 0) continue;
      const bounded = Math.max(0, Math.min(maxReasonableTypeCount, Math.round(average)));
      if (!preferredDirectCounts || counts[bucket] === undefined) {
        counts[bucket] = Math.max(counts[bucket] || 0, bounded);
      }
    }
  }

  return Object.keys(counts).length ? counts : null;
}

function extractEdhrecRoleTargets(data, edhrecTags = []) {
  const cardlists = data?.container?.json_dict?.cardlists;
  const roleMatchers = {
    ramp: ["ramp", "mana ramp", "mana rocks", "mana dorks", "acceleration", "treasure"],
    draw: ["card draw", "draw", "advantage", "cantrips", "wheel", "wheels"],
    removal: ["removal", "spot removal", "interaction", "counterspells", "counterspells", "control"],
    wipe: ["board wipes", "board wipe", "sweepers", "sweeper", "wraths", "wrath"]
  };

  const counts = {};

  if (Array.isArray(cardlists)) {
    for (const section of cardlists) {
      const labelCandidates = [section?.header, section?.value, section?.title, section?.label, section?.tag]
        .filter(Boolean)
        .map((value) => normalizeThemeName(String(value)));

      let matchedRole = null;
      for (const label of labelCandidates) {
        for (const [role, patterns] of Object.entries(roleMatchers)) {
          if (patterns.some((pattern) => label.includes(pattern))) {
            matchedRole = role;
            break;
          }
        }
        if (matchedRole) break;
      }
      if (!matchedRole) continue;

      const average = parseEdhrecSectionAverage(section);
      if (!average) continue;
      if (!counts[matchedRole] || average > counts[matchedRole]) counts[matchedRole] = average;
    }
  }

  const themeSignals = buildThemeSignalSet(edhrecTags);
  const defaults = {
    ramp: 10,
    draw: 10,
    removal: 8,
    wipe: 3
  };

  const adjusted = {
    ramp: counts.ramp ?? defaults.ramp,
    draw: counts.draw ?? defaults.draw,
    removal: counts.removal ?? defaults.removal,
    wipe: counts.wipe ?? defaults.wipe
  };

  if (themeSignals.has("spellslinger") || themeSignals.has("cantrips")) {
    adjusted.draw += 2;
    adjusted.removal += 1;
  }
  if (themeSignals.has("group hug") || themeSignals.has("opponent draw") || themeSignals.has("wheels")) {
    adjusted.draw += 2;
  }
  if (themeSignals.has("artifacts") || themeSignals.has("treasure") || themeSignals.has("lands") || themeSignals.has("landfall")) {
    adjusted.ramp += 1;
  }
  if (themeSignals.has("sacrifice") || themeSignals.has("aristocrats") || themeSignals.has("graveyard") || themeSignals.has("reanimator")) {
    adjusted.draw += 1;
    adjusted.removal += 1;
  }
  if (themeSignals.has("tokens") || themeSignals.has("gowide") || themeSignals.has("voltron")) {
    adjusted.removal += 1;
    adjusted.wipe = Math.max(adjusted.wipe - 1, 2);
  }
  if (themeSignals.has("counters") || themeSignals.has("countersmatter") || themeSignals.has("lifegain")) {
    adjusted.draw += 1;
  }

  return Object.fromEntries(
    Object.entries(adjusted).map(([role, value]) => {
      const minimum = role === "wipe" ? 2 : role === "removal" ? 6 : 8;
      const maximum = role === "wipe" ? 5 : 14;
      return [role, Math.max(minimum, Math.min(maximum, Math.round(Number(value) || defaults[role])))];
    })
  );
}

// Folds one EDHREC payload's card lists into `deduped`, which may already hold
// entries from another page for the same commander.
function collectEdhrecCards(data, deduped) {
  const cardlists = data?.container?.json_dict?.cardlists;
  if (!Array.isArray(cardlists)) return;

  for (const section of cardlists) {
    const cards = Array.isArray(section.cardviews) ? section.cardviews : [];
    for (const card of cards) {
      if (!card?.name) continue;

      const key = normalizeCardName(card.name);
      const decks = Number(card.num_decks || 0);
      // How many decks *could* have played it -- the denominator that turns a
      // raw count into a rate comparable across commanders and themes.
      const potentialDecks = Number(card.potential_decks || 0);
      const header = section.header ? String(section.header) : "";

      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, {
          name: card.name,
          synergy: Number(card.synergy || 0),
          decks,
          potentialDecks,
          label: header,
          labels: header ? [header] : []
        });
        continue;
      }

      existing.synergy = Math.max(Number(existing.synergy || 0), Number(card.synergy || 0));

      // decks and potentialDecks only mean anything as a pair. Taking the max
      // of each independently would staple a theme page's numerator to the
      // commander page's much larger denominator and understate the card.
      // Keep whichever pair reads as the stronger rate instead.
      const existingRate = existing.potentialDecks > 0 ? existing.decks / existing.potentialDecks : 0;
      const incomingRate = potentialDecks > 0 ? decks / potentialDecks : 0;
      if (incomingRate > existingRate) {
        existing.decks = decks;
        existing.potentialDecks = potentialDecks;
      }

      if (header && !existing.labels.includes(header)) existing.labels.push(header);
    }
  }
}

async function getEDHREC(commanderNames) {
  const fetched = await fetchEdhrecCommanderJson(commanderNames);
  const data = fetched?.data || null;
  const commanderSlug = fetched?.slug || "";

  if (!data) {
    return {
      cards: [],
      tags: [],
      typeAverages: null,
      roleTargets: null,
      unavailable: true
    };
  }

  const cardlists = data?.container?.json_dict?.cardlists;
  if (!Array.isArray(cardlists)) {
    return {
      cards: [],
      tags: [],
      typeAverages: null,
      roleTargets: null,
      unavailable: true
    };
  }

  const deduped = new Map();
  collectEdhrecCards(data, deduped);

  // Theme pages are still this commander's decks, just sliced by archetype, so
  // their cards belong in the same pool. They also carry much stronger signal:
  // a card is 18% of all Krydle decks but 55% of Krydle Mill decks.
  const themeSlugs = pickEdhrecThemeSlugs(data);
  for (const themeSlug of themeSlugs) {
    const themeData = await fetchEdhrecThemePage(commanderSlug, themeSlug);
    if (themeData) collectEdhrecCards(themeData, deduped);
    await sleep(120);
  }

  const tags = extractEdhrecTagsFromData(data);
  const typeAverages = extractEdhrecTypeAverages(data);
  const roleTargets = extractEdhrecRoleTargets(data, tags);

  return {
    cards: Array.from(deduped.values()),
    tags,
    typeAverages,
    roleTargets,
    unavailable: false
  };
}
