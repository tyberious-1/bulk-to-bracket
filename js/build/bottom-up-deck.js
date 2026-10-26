
// The bottom-up builder: archetype and subtype first, commander last.
//
// buildDeckBottomUp is pure -- cards in, deck and report out -- so the same function serves the
// UI, the suggestions (dozens of builds over one pool) and the harness. It does not touch lands;
// buildBottomUpManaBase adds them with the shared manabase.js helpers.
//
// Depends on: archetypes.js, cards.js (legalForCommander), manabase.js, themes.js

const BOTTOM_UP_MENTION_CAP = 6;
const BOTTOM_UP_DRAW_SUBSTITUTION_CAP = 4;
const BOTTOM_UP_ROLE_ORDER = ["wipe", "removal", "ramp", "draw"];

function buildDeckBottomUp(cards, options) {
  const archetype = options.archetype;
  const subtype = options.subtype || null;
  const colors = options.colors || [];
  const nonlandSlots = options.nonlandSlots || BOTTOM_UP_NONLAND_SLOTS;
  const slots = scaleSlots(ARCHETYPES[archetype].slots, nonlandSlots);
  const counterSlots = counterFloor(archetype, colors, nonlandSlots);
  const caps = { ...slots };
  const ctx = { archetype, subtype };

  const seen = new Set();
  const pool = [];
  for (const card of cards) {
    if (!card || seen.has(card.name)) continue;
    seen.add(card.name);
    if (getCardType(card).includes("land")) continue;
    if (!legalForCommander(card.colors || [], colors, card)) continue;
    pool.push({ card, a: annotateBottomUpCard(card, subtype), score: archetypeScore(card, ctx) });
  }
  pool.sort((x, y) => y.score - x.score || String(x.card.name).localeCompare(String(y.card.name)));

  const picked = new Set();
  const deck = [];
  const roleCounts = { ramp: 0, draw: 0, removal: 0, wipe: 0 };
  const substitutions = [];
  let mentions = 0;
  let overflow = 0;

  const canTake = (row) => !picked.has(row) && !(row.a.standing === "mention" && mentions >= BOTTOM_UP_MENTION_CAP);
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
    for (const row of pool) {
      if (roleCounts[role] >= caps[role]) break;
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

  // Creatures up to the archetype's count, then everything else, then whatever is left.
  for (const row of pool) {
    if (deck.filter((r) => r.a.isCreature).length >= slots.creature) break;
    if (row.a.isCreature && canTake(row) && roleOpen(row) && deck.length < nonlandSlots) take(row);
  }
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
  const counterCount = count((r) => r.a.role === "removal" && isCounterKind(r.a.removalKind));
  const shortfalls = {};
  for (const role of BOTTOM_UP_ROLE_ORDER) shortfalls[role] = Math.max(0, slots[role] - roleCounts[role]);

  return {
    deck: deck.map((row) => ({ ...row.card, bottomUpRole: row.a.role, standing: row.a.standing })),
    report: {
      nonlandSlots,
      slots,
      roleCounts,
      creatures: count((r) => r.a.isCreature),
      members: count((r) => r.a.standing === "member"),
      payoffs: count((r) => r.a.standing === "payoff"),
      mentions,
      fallbackCount: count((r) => r.a.standing === "none" && r.a.role === "synergy"),
      shortfalls,
      substitutions,
      counters: { floor: counterSlots, count: counterCount, shortfall: Math.max(0, counterSlots - counterCount) },
      overflow,
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
function buildBottomUpManaBase(nonlandDeck, colors, collection, cardData, landCount) {
  const strategyProfile = getCommanderStrategyProfile("", [], colors);
  const modePrefs = getModePreferences("", strategyProfile);
  const colorTargets = computeColorSourceTargets(nonlandDeck, colors, landCount);
  const nonbasics = buildNonbasicManaBase(collection, cardData, colors, landCount, strategyProfile, modePrefs, null, colorTargets);
  const basics = buildBasicManaBase(colors, Math.max(0, landCount - nonbasics.length), nonbasics, colorTargets);
  return [...nonbasics, ...basics];
}

function bottomUpDecklistText(entries) {
  const counts = new Map();
  for (const entry of entries) counts.set(entry.name, (counts.get(entry.name) || 0) + 1);
  return Array.from(counts, ([name, n]) => `${n} ${name}`).join("\n");
}
