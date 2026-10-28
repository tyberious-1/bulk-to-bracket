
// Reliability of a built deck: how often the opening hands and early draws give you what the
// deck needs. Pure -- a deck and its lands in, hypergeometric odds out -- so the Bottom-Up tab
// and the tests read the same numbers.
//
// Model: 99-card library, on the play (no draw on turn 1), no mulligans, so by turn t a player
// has seen 7 + (t - 1) cards. This measures consistency (how often the deck does nothing), not
// power or win rate.
//
// Depends on nothing.

// P(at least `k` successes) when drawing `draws` cards from `population` holding `successes`.
function hypergeometricAtLeast(population, successes, draws, k) {
  if (k <= 0) return 1;
  const n = Math.min(draws, population);
  const maxHits = Math.min(successes, n);
  if (maxHits < k) return 0;
  // P(X = i) = C(K, i) * C(N - K, n - i) / C(N, n), built from log-factorials so 99 choose 9 cannot overflow.
  const logFact = [0];
  for (let i = 1; i <= population; i += 1) logFact[i] = logFact[i - 1] + Math.log(i);
  const logChoose = (a, b) => (b < 0 || b > a ? -Infinity : logFact[a] - logFact[b] - logFact[a - b]);
  let below = 0;
  for (let i = 0; i < k; i += 1) {
    below += Math.exp(logChoose(successes, i) + logChoose(population - successes, n - i) - logChoose(population, n));
  }
  return Math.min(1, Math.max(0, 1 - below));
}

function cardsSeenByTurn(turn) {
  return 7 + (turn - 1);
}

// [good at or above, OK at or above]; "low" lines flip it: [good at or below, OK at or below].
// Rebuild cards per wipe: [good at or above, OK at or above].
const RELIABILITY_REBUILD_PER_WIPE = [3, 1.5];

const RELIABILITY_THRESHOLDS = {
  landsT3: [0.70, 0.60],
  landsT4: [0.55, 0.45],
  landsOpener: [0.20, 0.28],
  supportT3: [0.55, 0.40],
  supportT5: [0.60, 0.48],
  colorT3: [0.80, 0.65],
  colorT5: [0.55, 0.40],
  memberOpener: [0.90, 0.80]
};

function rateReliability(odds, [good, ok], lowIsGood) {
  if (lowIsGood) return odds <= good ? "good" : odds <= ok ? "OK" : "weak";
  return odds >= good ? "good" : odds >= ok ? "OK" : "weak";
}

function deckReliability(deck, lands, colors, options) {
  const total = deck.length + lands.length;
  const lines = [];
  const notes = [];
  if (!total) return { library: 0, lines, notes, summary: { good: 0, ok: 0, weak: 0, weakest: null } };

  const add = (id, label, count, turnOrDraws, need, thresholds, lowIsGood) => {
    const draws = turnOrDraws;
    const odds = lowIsGood
      ? 1 - hypergeometricAtLeast(total, count, draws, need)
      : hypergeometricAtLeast(total, count, draws, need);
    lines.push({ id, label, count, odds, rating: rateReliability(odds, thresholds, lowIsGood) });
  };

  const landCount = lands.length;
  add("lands-t3", "3 lands by turn 3", landCount, cardsSeenByTurn(3), 3, RELIABILITY_THRESHOLDS.landsT3);
  add("lands-t4", "4 lands by turn 4", landCount, cardsSeenByTurn(4), 4, RELIABILITY_THRESHOLDS.landsT4);
  // Two or more lands in the seven is the keepable hand; the odds of missing it are the bad outcome.
  add("lands-opener", "opening hand with 0 or 1 lands", landCount, 7, 2, RELIABILITY_THRESHOLDS.landsOpener, true);

  const role = (...names) => deck.filter((card) => names.includes(card.bottomUpRole));
  // A cantrip or a loot replaces itself instead of drawing ahead, so two of them count as one draw.
  // A draw card with no recorded kind counts in full.
  const drawAll = role("draw");
  const halfDraws = drawAll.filter((card) => card.bottomUpDrawKind === "cantrip" || card.bottomUpDrawKind === "filter");
  const drawCards = drawAll.filter((card) => !halfDraws.includes(card)).concat(halfDraws.slice(0, Math.floor(halfDraws.length / 2)));
  const groups = [
    ["ramp", "ramp", role("ramp").filter((card) => card.bottomUpRampKind !== "oneshot")],
    ["draw", "card draw", drawCards],
    ["removal", "removal or a wipe", role("removal", "wipe")]
  ];
  for (const [id, name, cards] of groups) {
    add(`${id}-t3`, `${name} by turn 3`, cards.length, cardsSeenByTurn(3), 1, RELIABILITY_THRESHOLDS.supportT3);
    add(`${id}-t5`, `${name} by turn 5`, cards.length, cardsSeenByTurn(5), 1, RELIABILITY_THRESHOLDS.supportT5);
  }

  for (const color of colors || []) {
    const sources = lands.filter((land) => (land.colors || []).includes(color)).length;
    add(`source-${color}-t3`, `a ${color} source by turn 3`, sources, cardsSeenByTurn(3), 1, RELIABILITY_THRESHOLDS.colorT3);
    add(`source-${color}-t5`, `two ${color} sources by turn 5`, sources, cardsSeenByTurn(5), 2, RELIABILITY_THRESHOLDS.colorT5);
  }

  const members = deck.filter((card) => card.standing === "member" || card.standing === "payoff").length;
  if (members) add("member-opener", "a subtype card in the opening hand", members, 7, 1, RELIABILITY_THRESHOLDS.memberOpener);

  // After a wipe the deck has to put a board back. Rebuild cards are token makers, boosts for the
  // tribe and mass returns; enough of them is a few per wipe, so the rating also weighs the ratio.
  const wipes = role("wipe");
  if (wipes.length) {
    const rebuild = deck.filter((card) => card.bottomUpRebuild);
    const perWipe = rebuild.length / wipes.length;
    const ratioRating = perWipe >= RELIABILITY_REBUILD_PER_WIPE[0] ? "good" : perWipe >= RELIABILITY_REBUILD_PER_WIPE[1] ? "OK" : "weak";
    const odds = hypergeometricAtLeast(total, rebuild.length, cardsSeenByTurn(5), 1);
    const rank = { weak: 0, OK: 1, good: 2 };
    const oddsRating = rateReliability(odds, RELIABILITY_THRESHOLDS.supportT5);
    lines.push({ id: "rebuild-t5", label: `a rebuild card by turn 5 (${rebuild.length} for ${wipes.length} wipes)`, count: rebuild.length, odds, rating: rank[ratioRating] <= rank[oddsRating] ? ratioRating : oddsRating });
    const label = options && options.subtypeLabel;
    const hitting = wipes.filter((card) => !card.bottomUpSpares).length;
    if (label && hitting) notes.push(`${hitting} of ${wipes.length} wipes also hit your ${label}`);
  }
  const protectors = deck.filter((card) => card.bottomUpProtects).length;
  if (protectors && wipes.length) notes.push(`${protectors} ${protectors === 1 ? "card protects" : "cards protect"} your board through a wipe`);

  const summary = { good: 0, ok: 0, weak: 0, weakest: null };
  const rank = { weak: 0, OK: 1, good: 2 };
  for (const line of lines) {
    summary[line.rating === "OK" ? "ok" : line.rating] += 1;
    if (!summary.weakest || rank[line.rating] < rank[summary.weakest.rating]) summary.weakest = line;
  }
  return { library: total, lines, notes, summary };
}
