
// The bottom-up builder: archetype and subtype first, commander last.
//
// buildDeckBottomUp is pure -- cards in, deck and report out -- so the same function serves the
// UI, the suggestions (dozens of builds over one pool) and the harness. It does not touch lands;
// buildBottomUpManaBase adds them with the shared manabase.js helpers.
//
// Depends on: archetypes.js, cards.js (legalForCommander), manabase.js, themes.js

const BOTTOM_UP_MENTION_CAP = 6;
const BOTTOM_UP_DRAW_SUBSTITUTION_CAP = 4;
// Theme creatures past the archetype's creature count stop at the commander-first builder's typal
// creature target (type-plan.js), so a deep tribe fills out to a tribal deck and no further.
const BOTTOM_UP_TYPAL_CREATURES = 31;
// Leftover slots go to more of the plan's own creatures, up to this ceiling, before cards with no
// signal: a thirty-second Vampire beats Stone Rain.
const BOTTOM_UP_PLAN_CREATURES_MAX = 36;
// A vehicle plan takes about one vehicle per this many creatures (a 19-crew-creature, 15-vehicle list is
// typical). Crew is met by tapping creatures whose powers add up, so any two creatures of power half the
// crew number or more can crew it; a vehicle needs this many such creatures in the deck.
const BOTTOM_UP_CREATURES_PER_VEHICLE = 1.25;
const BOTTOM_UP_CREWERS_MIN = 8;
// A Pilot token is a 1/1 that crews as though its power were 2 greater.
const BOTTOM_UP_PILOT_CREW_POWER = 3;

function vehicleCrew(card) {
  const match = getCardText(card).match(/\bcrew (\d+)/);
  return match ? Number(match[1]) : 0;
}

// How many cards past its role cap each support role may take when slots are left over.
const BOTTOM_UP_ROLE_OVERFLOW = 3;
const BOTTOM_UP_OVERFLOW_ROLES = ["ramp", "draw", "removal"];
const BOTTOM_UP_FILLER_ON_COLOR = 0.5;
// The commander-first builder's generic card score runs from about 8 (a card doing nothing) to 20+;
// filler maps that span onto 0..BOTTOM_UP_FILLER_FIT, so with the on-color bonus it stays under the
// mention weight and only orders cards that have no theme or role signal.
const BOTTOM_UP_FILLER_FIT = 1;
const BOTTOM_UP_FIT_FLOOR = 8;
const BOTTOM_UP_FIT_SPAN = 12;
const BOTTOM_UP_ROLE_ORDER = ["wipe", "removal", "ramp", "draw"];

// The commander-first builder's own card scoring (role, curve, theme tags, tribal), pointed at a
// subtype: a tribe reads as "<tribe> tribal", a theme as its tag. There is no commander, so no
// EDHREC card and no engine needs.
function bottomUpFitContext(subtype, colors) {
  if (!subtype) return null;
  const theme = subtype.kind === "tribal" && subtype.tribe ? `${subtype.tribe} tribal` : subtype.tag;
  if (!theme) return null;
  const themes = subtype.kind === "tribal" ? [theme] : theme.split("~");
  const profile = getCommanderStrategyProfile("", themes, colors);
  return { themes, profile, modePrefs: getModePreferences("", profile), colors };
}

// Score, then EDHREC budget inclusion, then how widely the card is played, then name.
function byBottomUpRank(x, y) {
  return (Math.abs(y.score - x.score) > 1e-9 ? y.score - x.score : 0) || y.inclusion - x.inclusion ||
    popularityRank(x.card) - popularityRank(y.card) || String(x.card.name).localeCompare(String(y.card.name));
}

// A plan's payoffs (and amplifiers) are what make its sources worth playing, and the builder's weights alone leave them
// to chance; after the role loop a plan is guaranteed this many, if the collection owns them.
const PLAN_PAYOFF_MIN = 5;

function buildDeckBottomUp(cards, options) {
  const archetype = options.archetype;
  // A theme plan reads the pool for what its cards make and need; a tribal one passes through unchanged.
  const subtype = withPlanTerms(options.subtype || null, cards);
  const colors = options.colors || [];
  const nonlandSlots = options.nonlandSlots || BOTTOM_UP_NONLAND_SLOTS;
  const slots = scaleSlots(ARCHETYPES[archetype].slots, nonlandSlots);
  const counterSlots = counterFloor(archetype, colors, nonlandSlots);
  const answerSlots = answerFloor(archetype, nonlandSlots);
  const caps = { ...slots };
  const ctx = { archetype, subtype };
  // EDHREC budget-page inclusion (name -> share of decks): it only orders cards whose scores are
  // equal, so a large tier of equal Zombies is not left to the alphabet. It never moves a score.
  const budgetInclusion = options.budgetInclusion instanceof Map ? options.budgetInclusion : new Map();
  const inclusionOf = (card) => budgetInclusion.get(normalizeCardName(card.name)) || budgetInclusion.get(normalizeCardName(getPrimaryCardName(card.name))) || 0;

  const fit = bottomUpFitContext(subtype, colors);
  const seen = new Set();
  const pool = [];
  for (const card of cards) {
    if (!card || seen.has(card.name)) continue;
    seen.add(card.name);
    if (getCardType(card).includes("land")) continue;
    if (!legalForCommander(card.colors || [], colors, card)) continue;
    if (deadForColors(card, colors)) continue;
    const a = annotateBottomUpCard(card, subtype);
    // Filler with no theme or role signal would tie and fall to the alphabet. It is ordered by the
    // commander-first generic score, and a card in the deck's own colors goes ahead of a colorless one.
    let fillerBonus = 0;
    if (a.standing === "none" && a.role === "synergy") {
      if ((card.colors || []).length > 0) fillerBonus += BOTTOM_UP_FILLER_ON_COLOR;
      if (fit) {
        const generic = scoreFallbackCard(card, fit.themes, fit.profile, colors, fit.modePrefs);
        fillerBonus += Math.max(0, Math.min(1, (generic - BOTTOM_UP_FIT_FLOOR) / BOTTOM_UP_FIT_SPAN)) * BOTTOM_UP_FILLER_FIT;
      }
    }
    pool.push({ card, a, score: archetypeScore(card, ctx) + fillerBonus, inclusion: inclusionOf(card) });
  }
  pool.sort(byBottomUpRank);

  const picked = new Set();
  const deck = [];
  const roleCounts = { ramp: 0, draw: 0, removal: 0, wipe: 0 };
  const substitutions = [];
  let mentions = 0;
  let overflow = 0;

  // A sweeper that scores under the floor (it kills the deck's own tribe) is left out even when its slot
  // stays empty: the shortfall is reported, and draw covers part of it.
  const vehiclePlan = Boolean(subtype) && subtype.tag.split("~").includes("vehicles");
  const isVehicle = (row) => !row.a.isCreature && getCardType(row.card).includes("vehicle");
  // One more vehicle fits when creatures cover it by ratio and enough of them could crew it in pairs.
  const vehicleFits = (row) => {
    // A Pilot-token maker is a body too: its token crews as power 3.
    const bodies = deck.filter((r) => r.a.isCreature || r.a.crewHelper);
    if (deck.filter(isVehicle).length + 1 > bodies.length / BOTTOM_UP_CREATURES_PER_VEHICLE) return false;
    const crew = vehicleCrew(row.card);
    if (!crew) return true;
    const powers = bodies.map((r) => (r.a.isCreature ? getCrewPower(r.card) : BOTTOM_UP_PILOT_CREW_POWER));
    if (powers.some(Number.isNaN)) return true;
    return powers.filter((power) => power >= Math.ceil(crew / 2)).length >= BOTTOM_UP_CREWERS_MIN;
  };
  const canTake = (row) => !picked.has(row) && !(row.a.standing === "mention" && mentions >= BOTTOM_UP_MENTION_CAP) &&
    !(vehiclePlan && isVehicle(row) && !vehicleFits(row)) &&
    !(row.a.role === "wipe" && row.score < BOTTOM_UP_WEIGHT.wipeFloor);
  const roleOpen = (row) => roleCounts[row.a.role] === undefined || roleCounts[row.a.role] < caps[row.a.role];
  const take = (row) => {
    picked.add(row);
    deck.push(row);
    if (row.a.standing === "mention") mentions += 1;
    if (roleCounts[row.a.role] !== undefined) roleCounts[row.a.role] += 1;
  };

  for (const role of BOTTOM_UP_ROLE_ORDER) {
    // Blue decks reserve part of their removal for counterspells, best first, before other removal competes.
    if (role === "removal") {
      let reserved = 0;
      for (const row of pool) {
        if (reserved >= counterSlots || roleCounts.removal >= caps.removal) break;
        if (row.a.role === "removal" && isCounterKind(row.a.removalKind) && canTake(row)) { take(row); reserved += 1; }
      }
    }
    if (role === "removal") {
      let reserved = 0;
      for (const row of pool) {
        if (reserved >= answerSlots || roleCounts.removal >= caps.removal) break;
        if (row.a.role === "removal" && row.a.removalKind === "permanent" && canTake(row)) { take(row); reserved += 1; }
      }
    }
    for (const row of pool) {
      if (roleCounts[role] >= caps[role]) break;
      // Past the cap, an artifact or enchantment answer waits: creature answers come first.
      if (role === "removal" && row.a.removalKind === "permanent" && deck.filter((r) => r.a.removalKind === "permanent").length >= BOTTOM_UP_ANSWER_CAP) continue;
      if (row.a.role === role && canTake(row)) take(row);
    }
    // Draw digs for the answers a thin pool lacks: it covers part of a missing removal or wipe slot.
    if (role === "removal") {
      const shortfall = Math.max(0, slots.wipe - roleCounts.wipe) + Math.max(0, slots.removal - roleCounts.removal);
      const extraDraw = Math.min(shortfall, BOTTOM_UP_DRAW_SUBSTITUTION_CAP);
      if (extraDraw > 0) {
        caps.draw = slots.draw + extraDraw;
        substitutions.push({ role: "removal+wipe", shortfall, extraDraw });
      }
    }
  }

  const fill = (predicate) => {
    for (const row of pool) {
      if (deck.length >= nonlandSlots) return;
      if (canTake(row) && predicate(row)) take(row);
    }
  };

  // Reserve the plan's payoffs before creatures fill the slots left, so they displace only creature-fill and filler.
  const isPayoff = (row) => row.a.standing === "payoff" || (row.a.standing === "member" && row.a.engine);
  const payoffMin = options.payoffMin === undefined ? PLAN_PAYOFF_MIN : options.payoffMin;
  const payoffAvailable = subtype ? pool.filter(isPayoff).length : 0;
  let payoffReserved = 0;
  if (subtype && payoffMin > 0) {
    const want = Math.min(payoffAvailable, payoffMin);
    for (const row of pool) {
      if (deck.filter(isPayoff).length >= want || deck.length >= nonlandSlots) break;
      if (isPayoff(row) && canTake(row) && roleOpen(row)) { take(row); payoffReserved += 1; }
    }
  }

  // Creatures up to the archetype's count, then theme cards of any type (members and payoffs the
  // creature count passed over), as the commander-first builder takes its theme tier before generic
  // cards; then everything else, then whatever is left.
  for (const row of pool) {
    if (deck.filter((r) => r.a.isCreature).length >= slots.creature) break;
    if (row.a.isCreature && canTake(row) && roleOpen(row) && deck.length < nonlandSlots) take(row);
  }
  // A vehicle that also loots or kills (Smuggler's Copter, Skysovereign) is plan first: it ignores a full role cap.
  const planOpen = (row) => roleOpen(row) || (vehiclePlan && isVehicle(row) && row.a.standing === "member");
  fill((row) => row.a.standing !== "none" && !row.a.isCreature && planOpen(row));
  fill((row) => row.a.standing !== "none" && row.a.isCreature && roleOpen(row) && deck.filter((r) => r.a.isCreature).length < BOTTOM_UP_TYPAL_CREATURES);
  // Slots left once the creature count is met go to real support past its role cap (a third draw spell
  // beats a card with no signal), a little at a time; wipes never overflow.
  fill((row) => !row.a.isCreature && BOTTOM_UP_OVERFLOW_ROLES.includes(row.a.role) && roleCounts[row.a.role] < caps[row.a.role] + BOTTOM_UP_ROLE_OVERFLOW &&
    !(row.a.removalKind === "permanent" && deck.filter((r) => r.a.removalKind === "permanent").length >= BOTTOM_UP_ANSWER_CAP));
  // In a vehicle plan every creature is crew; more of them also makes room for more vehicles.
  fill((row) => (row.a.standing !== "none" || vehiclePlan) && row.a.isCreature && roleOpen(row) && deck.filter((r) => r.a.isCreature).length < BOTTOM_UP_PLAN_CREATURES_MAX);
  fill((row) => row.a.standing !== "none" && !row.a.isCreature && planOpen(row));
  fill((row) => !row.a.isCreature && roleOpen(row));
  fill((row) => row.a.isCreature && roleOpen(row));
  const before = deck.length;
  fill(() => true);
  overflow = deck.length - before;

  const count = (predicate) => deck.filter(predicate).length;
  const curve = {};
  for (const row of deck) {
    const bucket = Math.min(6, Math.floor(Number(row.card.cmc) || 0));
    curve[bucket] = (curve[bucket] || 0) + 1;
  }
  const support = deck.filter((r) => r.a.standing === "member" || r.a.standing === "payoff");
  const answerCount = count((r) => r.a.role === "removal" && r.a.removalKind === "permanent");
  const counterCount = count((r) => r.a.role === "removal" && isCounterKind(r.a.removalKind));
  const shortfalls = {};
  for (const role of BOTTOM_UP_ROLE_ORDER) shortfalls[role] = Math.max(0, slots[role] - roleCounts[role]);

  return {
    deck: deck.map((row) => ({ ...row.card, bottomUpRole: row.a.role, bottomUpRampKind: row.a.rampKind, bottomUpDrawKind: row.a.drawKind, bottomUpRebuild: row.a.rebuild, bottomUpProtects: row.a.protects, bottomUpSpares: row.a.spares, standing: row.a.standing })),
    report: {
      nonlandSlots,
      slots,
      roleCounts,
      creatures: count((r) => r.a.isCreature),
      members: count((r) => r.a.standing === "member"),
      payoffs: count((r) => r.a.standing === "payoff"),
      payoffCards: count(isPayoff),
      payoffReservation: { minimum: payoffMin, available: payoffAvailable, reserved: payoffReserved },
      mentions,
      fallbackCount: count((r) => r.a.standing === "none" && r.a.role === "synergy"),
      shortfalls,
      substitutions,
      counters: { floor: counterSlots, count: counterCount, shortfall: Math.max(0, counterSlots - counterCount) },
      answers: { floor: answerSlots, count: answerCount, shortfall: Math.max(0, answerSlots - answerCount) },
      overflow,
      budget: { applied: deck.some((r) => r.inclusion > 0), matched: count((r) => r.inclusion > 0) },
      avgCmc: deck.length ? +(deck.reduce((sum, r) => sum + (Number(r.card.cmc) || 0), 0) / deck.length).toFixed(2) : 0,
      curve,
      supportRarity: {
        bulk: support.filter((r) => ["common", "uncommon"].includes(String(r.card.rarity || "").toLowerCase())).length,
        rare: support.filter((r) => ["rare", "mythic"].includes(String(r.card.rarity || "").toLowerCase())).length
      }
    }
  };
}

// Lands, with the same helpers commander-first uses. No commander exists yet, so the colors are
// the deck's own and no theme steers the land choice.
// Lands that name the plan's payload (the Roads lands and Mech Hangar for Vehicles) belong in the deck
// whenever they are owned and playable: up to this many go in, in place of the lowest-scoring nonbasics,
// provided each clears the floor on its own score.
const BOTTOM_UP_PLAN_LANDS_MAX = 4;
const BOTTOM_UP_PLAN_LAND_FLOOR = 7;

function includePlanLands(nonbasics, collection, cardData, colors, strategyProfile, modePrefs, colorTargets) {
  const needs = modePrefs.engineNeeds;
  if (!needs) return;
  const have = new Set(nonbasics.map((land) => normalizeCardName(land.name)));
  const planLands = [];
  for (const entry of getCollectionEntries(collection)) {
    const card = cardData.get(entry.normalizedName);
    if (!card || have.has(entry.normalizedName) || isBasicLand(card.name)) continue;
    if (!getCardType(card).includes("land") || !legalForCommander(card.colors, colors, card)) continue;
    if (getEngineLandBonus(card, needs) <= 0) continue;
    const candidate = evaluateNonbasicLand(card, colors, strategyProfile, modePrefs, null, colorTargets);
    if (candidate && candidate.score >= BOTTOM_UP_PLAN_LAND_FLOOR) planLands.push(candidate);
  }
  planLands.sort((a, b) => b.score - a.score);
  for (const land of planLands.slice(0, BOTTOM_UP_PLAN_LANDS_MAX)) {
    // The lowest-scoring nonbasic that is not itself a plan land makes room.
    let drop = -1;
    for (let i = nonbasics.length - 1; i >= 0; i -= 1) {
      const owned = cardData.get(normalizeCardName(nonbasics[i].name));
      if (!owned || getEngineLandBonus(owned, needs) <= 0) { drop = i; break; }
    }
    if (drop >= 0) nonbasics.splice(drop, 1);
    nonbasics.push(land);
  }
}

// What the plan's lands should name, in the commander-first builder's terms: a vehicle plan or a Mount
// tribe wants the lands that name them (the Roads lands, Mech Hangar), as engines.js scores a payload land.
function bottomUpLandNeeds(subtype) {
  if (!subtype) return null;
  if (subtype.kind !== "tribal") return subtype.tag.split("~").includes("vehicles") ? { payloadType: "vehicle" } : null;
  return String(subtype.tribe || "").toLowerCase() === "mount" ? { payloadType: "mount" } : null;
}

function buildBottomUpManaBase(nonlandDeck, colors, collection, cardData, landCount, subtype = null) {
  const strategyProfile = getCommanderStrategyProfile("", [], colors);
  const modePrefs = getModePreferences("", strategyProfile);
  modePrefs.engineNeeds = bottomUpLandNeeds(subtype);
  const colorTargets = computeColorSourceTargets(nonlandDeck, colors, landCount);
  const nonbasics = buildNonbasicManaBase(collection, cardData, colors, landCount, strategyProfile, modePrefs, null, colorTargets);
  includePlanLands(nonbasics, collection, cardData, colors, strategyProfile, modePrefs, colorTargets);
  const basics = buildBasicManaBase(colors, Math.max(0, landCount - nonbasics.length), nonbasics, colorTargets);
  return [...nonbasics, ...basics];
}

function bottomUpDecklistText(entries) {
  const counts = new Map();
  for (const entry of entries) counts.set(entry.name, (counts.get(entry.name) || 0) + 1);
  return Array.from(counts, ([name, n]) => `${n} ${name}`).join("\n");
}
