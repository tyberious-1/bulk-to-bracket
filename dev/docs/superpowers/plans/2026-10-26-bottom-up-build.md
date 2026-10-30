# Bottom-up build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bottom-up build mode: pick (or accept a suggested) archetype × subtype × colors, build the 99 from the collection, then choose a commander last.

**Architecture:** Pure, JXA-testable modules do the work (`archetypes.js` scoring and role fixes, `bottom-up-deck.js` the builder, `bottom-up.js` suggestions, `commander-fit.js` commander ranking). One UI file renders a new tab. The commander-first builder and shared role tags are untouched. Two harness scripts measure the three test-plan metrics.

**Tech Stack:** Plain global-scope JS (no modules), JXA test suites, `node` for ad-hoc checks, the existing offline harness.

**Spec:** `dev/docs/superpowers/specs/2026-10-26-bottom-up-build-design.md`

## Global Constraints

- All JS is plain global-scope script files; no ES modules, bundler or npm.
- Every new `js/` file needs a `<script>` tag in BOTH `index.html` and `pauper.html` (same position) AND an entry in `dev/tools/jxa-harness/build_harness.sh`'s `scripts=(...)` list. `run_all.sh` reads that list, so tests only see a file once it is listed.
- No regex lookbehind (`(?<!...)`): the live site must run on older Safari. Strip "non-X" text instead.
- Do not edit `js/analysis/scoring.js`, `js/analysis/abilities.js`, `js/build/deck.js`: shared with commander-first; changing them moves the 56 baseline builds.
- Commit with explicit paths, never `git add -A`. Never commit `ManaBox_Collection(mine).csv`, `card inventory.csv` at the repo root, or the friend's collection.
- Commit subjects: short, imperative. End every commit message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- The shell is zsh: run word-split loops under `bash -c` or use `bash dev/tests/jxa/run_all.sh <name>`.
- Test command for one suite: `bash dev/tests/jxa/run_all.sh <suite-name-substring>`; expected last line `SUITE OK`.

## Review Focus

- A pool with no cards of a role (no wipes in green): the build must still finish, report the shortfall, and substitute draw up to the cap.
- A subtype with very few members (a collection with 3 Elves): the build fills with generic cards and the report says so, it does not throw.
- A card with two faces or an empty `type`/`text`: scoring must not throw.
- Colorless cards and an empty color set (`[]`): colorless cards stay legal; no crash.
- A commander narrower than the deck's colors: cuts are listed, not silently dropped.

---

### Task 1: Archetypes, role fixes and subtype scoring (`js/analysis/archetypes.js`)

**Files:**
- Create: `js/analysis/archetypes.js`
- Create: `dev/tests/jxa/archetypes.test.js`
- Modify: `dev/tools/jxa-harness/build_harness.sh` (add `js/analysis/archetypes.js` after `js/analysis/collection-summary.js`)
- Modify: `index.html`, `pauper.html` (same `<script>` line after the `collection-summary.js` tag)

**Interfaces:**
- Produces: `ARCHETYPES`, `ARCHETYPE_ORDER`, `BOTTOM_UP_NONLAND_SLOTS`, `scaleSlots(slots, nonland)`, `isEdict(text)`, `isFalseRamp(card)`, `bottomUpRole(card)`, `removalKind(card)`, `REMOVAL_QUALITY`, `subtypeStanding(card, subtype)` -> `"member"|"payoff"|"mention"|"none"`, `sparesSubtype(card, subtype, role)`, `annotateBottomUpCard(card, subtype)`, `archetypeScore(card, {archetype, subtype})`.
- A `subtype` is `{ kind: "tribal"|"theme", tag, label, tribe? }`; `tribe` is the singular type ("zombie") and `tag` the plural catalog tag ("zombies").
- Consumes: `getCardText`, `getCardType`, `getCardSubtypes` (cards.js), `detectRole`, `getRoleContributions`, `detectCardTags` (scoring.js).

- [ ] **Step 1: Register the file** in `build_harness.sh`, `index.html`, `pauper.html` as above (no code yet; a missing file would break every suite).

Create an empty placeholder so suites keep running: `printf '// bottom-up archetypes\n' > js/analysis/archetypes.js`.

- [ ] **Step 2: Write the failing tests** — `dev/tests/jxa/archetypes.test.js`:

```js
function buCard(name, type, text, cmc, colors, rarity) {
  return { name, type, text, cmc: cmc || 0, colors: colors || [], rarity: rarity || "common", manaCost: "" };
}
const BU_ZOMBIE = { kind: "tribal", tag: "zombies", label: "Zombies", tribe: "zombie" };

runSuite("archetypes", {
  "isEdict: each player sacrifices a creature is an edict, a mass sacrifice is not": () => {
    assertTrue(isEdict("each player sacrifices a creature of their choice."));
    assertTrue(isEdict("when this creature exploits a creature, each opponent sacrifices a creature of their choice."));
    assertTrue(!isEdict("each player sacrifices all creatures they control."));
    assertTrue(!isEdict("destroy all creatures. each player sacrifices a land."));
  },

  "bottomUpRole: edicts are removal, real sweepers stay wipes": () => {
    const innocent = buCard("Innocent Blood", "sorcery", "each player sacrifices a creature of their choice.", 1, ["B"]);
    assertEqual(bottomUpRole(innocent), "removal");
    const wrath = buCard("Sweep Away", "sorcery", "destroy all creatures.", 4, ["W"]);
    assertEqual(bottomUpRole(wrath), "wipe");
  },

  "bottomUpRole: a cost reducer and a one-shot sacrifice are not ramp": () => {
    const granGran = buCard("Gran-Gran", "legendary creature — human peasant ally",
      "whenever gran-gran becomes tapped, draw a card, then discard a card.\nnoncreature spells you cast cost {1} less to cast as long as there are three or more lesson cards in your graveyard.", 1, ["B"]);
    assertEqual(bottomUpRole(granGran), "draw");
    const bloodPet = buCard("Blood Pet", "creature — thrull", "sacrifice this creature: add {b}.", 1, ["B"]);
    assertEqual(bottomUpRole(bloodPet), "synergy");
    const paladin = buCard("Forsworn Paladin", "creature — human knight",
      "menace\n{1}{b}, {t}, pay 1 life: create a treasure token.", 1, ["B"]);
    assertEqual(bottomUpRole(paladin), "synergy");
  },

  "bottomUpRole: real ramp stays ramp": () => {
    const elf = buCard("Llanowar Elves", "creature — elf druid", "{t}: add {g}.", 1, ["G"]);
    assertEqual(bottomUpRole(elf), "ramp");
    const growth = buCard("Rampant Growth", "sorcery", "search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.", 2, ["G"]);
    assertEqual(bottomUpRole(growth), "ramp");
  },

  "removalKind: hard, counter, bounce and aura are told apart": () => {
    assertEqual(removalKind(buCard("a", "instant", "destroy target creature.")), "hard");
    assertEqual(removalKind(buCard("b", "instant", "counter target spell.")), "counter");
    assertEqual(removalKind(buCard("c", "instant", "return target nonland permanent to its owner's hand.")), "bounce");
    assertEqual(removalKind(buCard("d", "enchantment — aura", "enchant creature\nwhen this aura enters, tap enchanted creature.")), "other");
  },

  "subtypeStanding: member, payoff, mention and a card that spares the tribe": () => {
    assertEqual(subtypeStanding(buCard("m", "creature — zombie warrior", ""), BU_ZOMBIE), "member");
    assertEqual(subtypeStanding(buCard("p", "enchantment", "zombies you control get +1/+1."), BU_ZOMBIE), "payoff");
    assertEqual(subtypeStanding(buCard("h", "sorcery", "exile target zombie."), BU_ZOMBIE), "mention");
    assertEqual(subtypeStanding(buCard("v", "instant", "destroy target non-vampire, non-werewolf, non-zombie creature."), BU_ZOMBIE), "none");
  },

  "subtypeStanding: a theme subtype matches on the detected tag": () => {
    const tokens = { kind: "theme", tag: "tokens", label: "Tokens" };
    assertEqual(subtypeStanding(buCard("t", "sorcery", "create two 1/1 white soldier creature tokens."), tokens), "member");
    assertEqual(subtypeStanding(buCard("x", "sorcery", "draw a card."), tokens), "none");
  },

  "sparesSubtype: except / non- phrasing on removal and wipes only": () => {
    const sweep = "all creatures except zombies get -1/-1 until end of turn.";
    assertTrue(sparesSubtype(buCard("s", "sorcery", sweep), BU_ZOMBIE, "wipe"));
    assertTrue(sparesSubtype(buCard("v", "instant", "destroy target non-zombie creature."), BU_ZOMBIE, "removal"));
    assertTrue(!sparesSubtype(buCard("v", "instant", "destroy target non-zombie creature."), BU_ZOMBIE, "draw"));
    assertTrue(!sparesSubtype(buCard("w", "sorcery", "destroy all creatures."), BU_ZOMBIE, "wipe"));
  },

  "archetypeScore: aggro prefers a cheap creature, control prefers hard removal over an aura": () => {
    const cheap = buCard("Cheap", "creature — zombie", "haste", 1, ["B"]);
    const dear = buCard("Dear", "creature — zombie", "", 5, ["B"]);
    assertTrue(archetypeScore(cheap, { archetype: "aggro", subtype: BU_ZOMBIE }) > archetypeScore(dear, { archetype: "aggro", subtype: BU_ZOMBIE }));
    const hard = buCard("Hard", "instant", "destroy target creature.", 2, ["B"]);
    const aura = buCard("Aura", "enchantment — aura", "enchant creature\nwhen this aura enters, tap enchanted creature.\nenchanted creature doesn't untap during its controller's untap step.", 2, ["U"]);
    assertTrue(archetypeScore(hard, { archetype: "control", subtype: BU_ZOMBIE }) > archetypeScore(aura, { archetype: "control", subtype: BU_ZOMBIE }));
  },

  "archetypeScore: a symmetrical sweeper scores lower in aggro than in control, and a sparing one higher": () => {
    const wrath = buCard("Wrath Thing", "sorcery", "destroy all creatures.", 4, ["B"]);
    assertTrue(archetypeScore(wrath, { archetype: "control", subtype: BU_ZOMBIE }) > archetypeScore(wrath, { archetype: "aggro", subtype: BU_ZOMBIE }));
    const spare = buCard("Spare Thing", "sorcery", "destroy all creatures except zombies.", 4, ["B"]);
    assertTrue(archetypeScore(spare, { archetype: "control", subtype: BU_ZOMBIE }) > archetypeScore(wrath, { archetype: "control", subtype: BU_ZOMBIE }));
  },

  "annotateBottomUpCard: a card with no type or text does not throw": () => {
    const a = annotateBottomUpCard({ name: "Blank" }, BU_ZOMBIE);
    assertEqual(a.standing, "none");
  },

  "scaleSlots: scales role counts to the nonland slot count": () => {
    const scaled = scaleSlots(ARCHETYPES.control.slots, 62);
    assertEqual(scaled.creature, 14);
    assertEqual(scaleSlots(ARCHETYPES.control.slots, 31).creature, 7);
  }
});
```

- [ ] **Step 3: Run and confirm failure**: `bash dev/tests/jxa/run_all.sh archetypes` — expected `FAIL ... is not defined` lines.

- [ ] **Step 4: Implement** `js/analysis/archetypes.js`:

```js
// Bottom-up builds: what an archetype asks of a deck, and how one card reads for a subtype.
//
// detectRole/getRoleContributions (scoring.js) are shared with the commander-first builder, so
// their mistakes are corrected here (bottomUpRole) and not in scoring.js, where a change would
// move all 56 baseline builds.
//
// Depends on: cards.js (getCardText, getCardType, getCardSubtypes),
//   scoring.js (detectRole, getRoleContributions, detectCardTags)

// A 100-card deck without the commander is 99 cards; about 37 are lands.
const BOTTOM_UP_NONLAND_SLOTS = 62;

// Slot targets are for BOTTOM_UP_NONLAND_SLOTS. avgCmc is the curve the scorer pulls toward;
// removalQuality weights hard removal over counters, bounce and auras.
const ARCHETYPES = {
  aggro: {
    label: "Aggro",
    slots: { creature: 28, ramp: 6, draw: 6, removal: 6, wipe: 0 },
    avgCmc: 2.2, cheapCreatures: 0.8, haste: 1.5, removalQuality: 0.4
  },
  midrange: {
    label: "Midrange",
    slots: { creature: 24, ramp: 9, draw: 8, removal: 8, wipe: 2 },
    avgCmc: 2.5, cheapCreatures: 0, haste: 0, removalQuality: 0.5
  },
  control: {
    label: "Control",
    slots: { creature: 14, ramp: 8, draw: 11, removal: 11, wipe: 4 },
    avgCmc: 2.7, cheapCreatures: 0, haste: 0, removalQuality: 0.8
  }
};
const ARCHETYPE_ORDER = ["aggro", "midrange", "control"];

const REMOVAL_QUALITY = { hard: 3, counter: 2, bounce: 1, other: 0 };

const BOTTOM_UP_WEIGHT = {
  member: 6, payoff: 5, mention: 2, spares: 4,
  symmetricWipeTribal: -3, symmetricWipeAggro: -4,
  roleBase: 1, curve: 0.35
};

function scaleSlots(slots, nonlandSlots) {
  const factor = nonlandSlots / BOTTOM_UP_NONLAND_SLOTS;
  const scaled = {};
  for (const [role, count] of Object.entries(slots)) scaled[role] = Math.round(count * factor);
  return scaled;
}

function escapeBottomUpRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// "each player sacrifices a creature of their choice" is one-for-one removal, not a sweeper.
function isEdict(text) {
  if (/\b(?:destroy|exile) all\b|\ball creatures\b|\beach creature\b/.test(text)) return false;
  return /\b(?:each|target) (?:player|opponent) sacrifices an? /.test(text);
}

// detectRole files a card under ramp on weak evidence. Real acceleration is a land search, a
// mana ability, or a Treasure that costs no mana. Not real: a one-shot "sacrifice this: add",
// a Treasure maker that costs mana, or a cost reducer.
function isFalseRamp(card) {
  const text = getCardText(card);
  if (/search your library for [^.]*\bland\b|put [^.]*\bland\b[^.]*onto the battlefield/.test(text)) return false;
  const lines = text.split("\n");
  const addLines = lines.filter((line) => /\badd (?:\{|one |two |three |x )/.test(line));
  if (addLines.length) return addLines.every((line) => /^sacrifice (?:this|~)[^:]*:/.test(line));
  const treasureLines = lines.filter((line) => /create (?:a|one|two|three|x) treasure/.test(line));
  if (treasureLines.length) return treasureLines.every((line) => /^[^:]*\{(?:\d+|[wubrgxsc])\}[^:]*:/.test(line));
  return /costs? (?:\{\d+\}|\{[^}]+\}) less/.test(text);
}

function bottomUpRole(card) {
  const base = detectRole(card, true);
  if (base === "wipe" && isEdict(getCardText(card))) return "removal";
  if (base === "ramp" && isFalseRamp(card)) {
    return getRoleContributions(card, true).find((role) => role !== "ramp") || "synergy";
  }
  return base;
}

function removalKind(card) {
  const text = getCardText(card);
  if (/counter target/.test(text)) return "counter";
  if (/return (?:target|up to)[^.]*to (?:its|their) owner/.test(text)) return "bounce";
  if (/destroy target|exile target|sacrifices? an? creature|deals? \d+ damage|damage to target|gets? -\d+\/-\d+|-x\/-x/.test(text)) return "hard";
  return "other";
}

function tribeFormsPattern(subtype) {
  const tribe = String(subtype.tribe || "").toLowerCase();
  const plural = String(subtype.tag || "").toLowerCase();
  if (!tribe) return "";
  return plural && plural !== tribe
    ? `${escapeBottomUpRegex(tribe)}|${escapeBottomUpRegex(plural)}`
    : escapeBottomUpRegex(tribe);
}

// member: a creature of the tribe (or, for a theme, a card the detector tags with it).
// payoff: rewards the tribe. mention: names it without rewarding it ("exile target Zombie").
function subtypeStanding(card, subtype) {
  if (!subtype) return "none";
  if (subtype.kind !== "tribal") return detectCardTags(card).includes(subtype.tag) ? "member" : "none";

  const tribe = String(subtype.tribe || "").toLowerCase();
  if (!tribe) return "none";
  if (getCardSubtypes(card).includes(tribe)) return "member";

  const forms = tribeFormsPattern(subtype);
  // "non-Zombie" names the tribe only to leave it out.
  const text = getCardText(card).replace(new RegExp(`\\bnon-?(?:${forms})\\b`, "g"), " ");
  if (!new RegExp(`\\b(?:${forms})\\b`).test(text)) return "none";

  const payoff = new RegExp(
    `\\b(?:${forms}) you control|\\bother (?:${forms})\\b|\\b(?:${forms}) (?:get|gain|have)\\b|` +
    `whenever (?:a|an|one or more) (?:other )?(?:${forms})\\b|create[^.]*\\b(?:${forms})\\b|amass (?:${forms})\\b`
  );
  return payoff.test(text) ? "payoff" : "mention";
}

// A removal spell or sweeper that leaves the tribe alone ("except Zombies", "non-Zombie").
function sparesSubtype(card, subtype, role) {
  if (!subtype || subtype.kind !== "tribal" || !subtype.tribe) return false;
  if (role !== "removal" && role !== "wipe") return false;
  const forms = tribeFormsPattern(subtype);
  return new RegExp(
    `\\bnon-?(?:${forms})\\b|\\bexcept (?:for )?(?:\\w+ )?(?:${forms})\\b|` +
    `\\bother than (?:an? )?(?:\\w+ )?(?:${forms})\\b|\\bcreatures? that (?:isn't|aren't) (?:an? )?(?:${forms})\\b`
  ).test(getCardText(card));
}

// Role and standing are looked up once per card: suggestions run dozens of builds over one pool.
const bottomUpAnnotations = new WeakMap();

function annotateBottomUpCard(card, subtype) {
  let base = bottomUpAnnotations.get(card);
  if (!base) {
    const role = bottomUpRole(card);
    base = {
      role,
      isCreature: getCardType(card).split("—")[0].includes("creature"),
      removalKind: role === "removal" ? removalKind(card) : "",
      haste: /\bhaste\b/.test(getCardText(card)),
      standing: new Map()
    };
    bottomUpAnnotations.set(card, base);
  }
  const key = subtype ? `${subtype.kind}:${subtype.tag}` : "";
  if (!base.standing.has(key)) {
    base.standing.set(key, {
      standing: subtypeStanding(card, subtype),
      spares: sparesSubtype(card, subtype, base.role)
    });
  }
  return { ...base, ...base.standing.get(key) };
}

function archetypeScore(card, ctx) {
  const arch = ARCHETYPES[ctx.archetype];
  const a = annotateBottomUpCard(card, ctx.subtype);
  const cmc = Number(card.cmc) || 0;
  let score = 0;

  if (a.standing === "member") score += BOTTOM_UP_WEIGHT.member;
  else if (a.standing === "payoff") score += BOTTOM_UP_WEIGHT.payoff;
  else if (a.standing === "mention") score += BOTTOM_UP_WEIGHT.mention;

  if (a.role !== "synergy" && a.role !== "land") score += BOTTOM_UP_WEIGHT.roleBase;
  if (a.spares) score += BOTTOM_UP_WEIGHT.spares;
  if (a.role === "removal") score += REMOVAL_QUALITY[a.removalKind] * arch.removalQuality;

  if (a.role === "wipe" && !a.spares) {
    if (ctx.subtype && ctx.subtype.kind === "tribal") score += BOTTOM_UP_WEIGHT.symmetricWipeTribal;
    if (ctx.archetype === "aggro") score += BOTTOM_UP_WEIGHT.symmetricWipeAggro;
  }

  if (a.isCreature) score += Math.max(0, 4 - cmc) * arch.cheapCreatures;
  if (a.haste) score += arch.haste;
  if (ctx.archetype === "control" && (a.role === "draw" || a.role === "wipe")) score += 1;

  // Distance from the archetype's target, not a plain cost penalty: control reaches for 3s over 1s.
  return score - Math.abs(cmc - arch.avgCmc) * BOTTOM_UP_WEIGHT.curve;
}
```

- [ ] **Step 5: Run** `bash dev/tests/jxa/run_all.sh archetypes` — expected `SUITE OK`. If a fixture's role is not what its name claims (the sweeper or ramp texts), print `detectRole` for it and fix the fixture text, not the production code. Also run `node --check js/analysis/archetypes.js`.

- [ ] **Step 6: Run all suites** (`bash dev/tests/jxa/run_all.sh`) — expected no suite reports `FAILED`.

- [ ] **Step 7: Commit**

```bash
git add js/analysis/archetypes.js dev/tests/jxa/archetypes.test.js dev/tools/jxa-harness/build_harness.sh index.html pauper.html
git commit -m "Add archetype definitions and subtype-aware scoring for bottom-up builds

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The bottom-up builder (`js/build/bottom-up-deck.js`)

**Files:**
- Create: `js/build/bottom-up-deck.js`
- Create: `dev/tests/jxa/bottom-up-deck.test.js`
- Modify: `build_harness.sh`, `index.html`, `pauper.html` (add `js/build/bottom-up-deck.js` after `js/analysis/archetypes.js`)

**Interfaces:**
- Consumes: everything from Task 1; `legalForCommander(cardColors, commanderColors, card)` (cards.js), `recommendLandCount`, `computeColorSourceTargets`, `buildNonbasicManaBase`, `buildBasicManaBase` (manabase.js), `getCommanderStrategyProfile`, `getModePreferences` (themes.js).
- Produces: `buildDeckBottomUp(cards, {archetype, subtype, colors, nonlandSlots?})` -> `{ deck, report }`; `buildBottomUpManaBase(nonlandDeck, colors, collection, cardData, landCount)`; `bottomUpDecklistText(entries)`; constants `BOTTOM_UP_MENTION_CAP` (6), `BOTTOM_UP_DRAW_SUBSTITUTION_CAP` (4).
- `report`: `{ nonlandSlots, slots, roleCounts, creatures, members, payoffs, mentions, fallbackCount, shortfalls, substitutions, avgCmc, curve, supportRarity: {bulk, rare}, overflow }`.
- `deck` entries: the card plus `{ bottomUpRole, standing }`.

- [ ] **Step 1: Register the file**, placeholder `printf '// bottom-up builder\n' > js/build/bottom-up-deck.js`.

- [ ] **Step 2: Write the failing tests** — `dev/tests/jxa/bottom-up-deck.test.js`:

```js
function budCard(name, type, text, cmc, colors, rarity) {
  return { name, type, text, cmc, colors: colors || ["B"], rarity: rarity || "common", manaCost: "" };
}

// A pool with every role, three creature tiers, and some off-color cards.
function budPool(options) {
  const opts = options || {};
  const pool = [];
  for (let i = 0; i < 40; i += 1) pool.push(budCard(`Zombie ${i}`, "creature — zombie", "", 1 + (i % 5), ["B"]));
  for (let i = 0; i < 12; i += 1) pool.push(budCard(`Bear ${i}`, "creature — bear", "", 2 + (i % 3), ["B"]));
  for (let i = 0; i < 20; i += 1) pool.push(budCard(`Kill ${i}`, "instant", "destroy target creature.", 2 + (i % 3), ["B"]));
  for (let i = 0; i < 20; i += 1) pool.push(budCard(`Study ${i}`, "sorcery", "draw two cards.", 2 + (i % 3), ["B"]));
  for (let i = 0; i < 12; i += 1) pool.push(budCard(`Rock ${i}`, "artifact", "{t}: add {c}.", 2, []));
  if (!opts.noWipes) for (let i = 0; i < 6; i += 1) pool.push(budCard(`Wrath ${i}`, "sorcery", "destroy all creatures.", 4 + (i % 2), ["B"]));
  for (let i = 0; i < 20; i += 1) pool.push(budCard(`Filler ${i}`, "enchantment", "", 3, ["B"]));
  for (let i = 0; i < 10; i += 1) pool.push(budCard(`Red ${i}`, "instant", "destroy target creature.", 2, ["R"]));
  return pool;
}

const BUD_ZOMBIE = { kind: "tribal", tag: "zombies", label: "Zombies", tribe: "zombie" };
function budBuild(archetype, pool, subtype) {
  return buildDeckBottomUp(pool || budPool(), { archetype, subtype: subtype || BUD_ZOMBIE, colors: ["B"] });
}

runSuite("bottom-up-deck", {
  "fixtures read as the roles they claim": () => {
    assertEqual(bottomUpRole(budCard("k", "instant", "destroy target creature.", 2)), "removal");
    assertEqual(bottomUpRole(budCard("d", "sorcery", "draw two cards.", 2)), "draw");
    assertEqual(bottomUpRole(budCard("r", "artifact", "{t}: add {c}.", 2, [])), "ramp");
    assertEqual(bottomUpRole(budCard("w", "sorcery", "destroy all creatures.", 4)), "wipe");
  },

  "fills the nonland slots with unique, on-color cards": () => {
    const { deck, report } = budBuild("midrange");
    assertEqual(deck.length, 62);
    assertEqual(new Set(deck.map((c) => c.name)).size, 62);
    assertTrue(deck.every((c) => !c.name.startsWith("Red")), "off-color card in the deck");
    assertEqual(report.nonlandSlots, 62);
  },

  "archetypes separate: aggro runs more creatures, control more removal and draw, a higher curve": () => {
    const aggro = budBuild("aggro").report;
    const control = budBuild("control").report;
    assertTrue(aggro.creatures > control.creatures, `creatures ${aggro.creatures} vs ${control.creatures}`);
    assertTrue(control.roleCounts.removal > aggro.roleCounts.removal, "removal");
    assertTrue(control.roleCounts.draw > aggro.roleCounts.draw, "draw");
    assertTrue(control.avgCmc > aggro.avgCmc, `avgCmc ${aggro.avgCmc} vs ${control.avgCmc}`);
  },

  "role counts do not exceed their caps": () => {
    const { report } = budBuild("control");
    assertTrue(report.roleCounts.removal <= ARCHETYPES.control.slots.removal);
    assertTrue(report.roleCounts.wipe <= ARCHETYPES.control.slots.wipe);
    assertTrue(report.roleCounts.ramp <= ARCHETYPES.control.slots.ramp);
  },

  "aggro takes no wipes while other cards are available": () => {
    assertEqual(budBuild("aggro").report.roleCounts.wipe, 0);
  },

  "no wipes in the pool: shortfall is reported and draw covers up to the cap": () => {
    const { report } = budBuild("control", budPool({ noWipes: true }));
    assertEqual(report.shortfalls.wipe, ARCHETYPES.control.slots.wipe);
    assertEqual(report.substitutions.length, 1);
    assertEqual(report.substitutions[0].extraDraw, BOTTOM_UP_DRAW_SUBSTITUTION_CAP);
    assertEqual(report.roleCounts.draw, ARCHETYPES.control.slots.draw + BOTTOM_UP_DRAW_SUBSTITUTION_CAP);
  },

  "mentions of the tribe are capped": () => {
    const pool = budPool();
    for (let i = 0; i < 30; i += 1) pool.push(budCard(`Hate ${i}`, "sorcery", "exile target zombie.", 2, ["B"]));
    const { report } = budBuild("midrange", pool);
    assertTrue(report.mentions <= BOTTOM_UP_MENTION_CAP, `mentions ${report.mentions}`);
  },

  "a thin subtype still builds a full deck and reports the generic fallback": () => {
    const pool = budPool().filter((c) => !c.name.startsWith("Zombie")).concat([budCard("Zombie Only", "creature — zombie", "", 2, ["B"])]);
    const { deck, report } = budBuild("midrange", pool);
    assertEqual(deck.length, 62);
    assertEqual(report.members, 1);
    assertTrue(report.fallbackCount > 0);
  },

  "an empty color set keeps only colorless cards": () => {
    const { deck } = buildDeckBottomUp(budPool(), { archetype: "midrange", subtype: BUD_ZOMBIE, colors: [] });
    assertTrue(deck.length > 0 && deck.every((c) => c.colors.length === 0));
  },

  "a pool smaller than the slots returns what it has": () => {
    const { deck } = buildDeckBottomUp(budPool().slice(0, 10), { archetype: "midrange", subtype: BUD_ZOMBIE, colors: ["B"] });
    assertEqual(deck.length, 10);
  },

  "buildBottomUpManaBase: with no owned lands it returns basics split across the colors": () => {
    const lands = buildBottomUpManaBase([budCard("a", "creature", "", 2, ["U"]), budCard("b", "creature", "", 2, ["B"])],
      ["U", "B"], { entries: [] }, new Map(), 37);
    assertEqual(lands.length, 37);
    const blue = lands.filter((l) => l.name === "Island").length;
    const black = lands.filter((l) => l.name === "Swamp").length;
    assertEqual(blue + black, 37);
    assertTrue(blue >= 15 && black >= 15, `blue ${blue} black ${black}`);
  },

  "bottomUpDecklistText: counts repeats of the same card": () => {
    const text = bottomUpDecklistText([{ name: "Swamp" }, { name: "Swamp" }, { name: "Island" }]);
    assertEqual(text, "2 Swamp\n1 Island");
  }
});
```

- [ ] **Step 3: Run and confirm failure**: `bash dev/tests/jxa/run_all.sh bottom-up-deck`.

- [ ] **Step 4: Implement** `js/build/bottom-up-deck.js`:

```js
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
```

- [ ] **Step 5: Run** `bash dev/tests/jxa/run_all.sh bottom-up-deck`. Expected `SUITE OK`. If the separation test fails on curve, check that `archetypeScore` uses the distance from the archetype's target (`Math.abs(cmc - arch.avgCmc)`), not a plain cost penalty (a linear penalty made every archetype pull cheap and the weight changed nothing); do not weaken the test. If a mana base test fails because `buildBasicManaBase` returns objects with different names, print one and adjust the test, not the production code.

- [ ] **Step 6: Run all suites** and `node --check js/build/bottom-up-deck.js`.

- [ ] **Step 7: Commit**

```bash
git add js/build/bottom-up-deck.js dev/tests/jxa/bottom-up-deck.test.js dev/tools/jxa-harness/build_harness.sh index.html pauper.html
git commit -m "Add the bottom-up deck builder

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Suggestions (`js/analysis/bottom-up.js`)

**Files:**
- Create: `js/analysis/bottom-up.js`, `dev/tests/jxa/bottom-up.test.js`
- Modify: `build_harness.sh`, `index.html`, `pauper.html` (after `js/build/bottom-up-deck.js`)

**Interfaces:**
- Consumes: `rankCollectionSupport(cards, entries, tribeFor)` (discovery.js), `buildDeckBottomUp`, `ARCHETYPE_ORDER`, `ARCHETYPES`, `legalForCommander`.
- Produces: `toBottomUpSubtype(entry, tribeFor)`, `candidateColorSets(cards, subtype)` -> up to 2 color arrays, `rateBuild(report)` -> `"Strong"|"OK"|"Thin"`, `describeBuild(report)` -> `{ support, quality, roles: [string] }`, `rankBottomUpSuggestions(cards, catalog, tribeFor)` -> `[{ subtype, colors, archetype, report, rating, support, quality, roles }]`.

- [ ] **Step 1: Register the file**, placeholder `printf '// bottom-up suggestions\n' > js/analysis/bottom-up.js`.

- [ ] **Step 2: Write the failing tests** — `dev/tests/jxa/bottom-up.test.js`:

```js
function bupCard(name, type, text, cmc, colors, rarity) {
  return { name, type, text, cmc: cmc || 2, colors: colors || ["B"], rarity: rarity || "common", manaCost: "" };
}
const BUP_ENTRY = { kind: "tribal", tag: "zombies", label: "Zombies" };
const BUP_TRIBE_FOR = (entry) => (entry.tag === "zombies" ? "zombie" : null);

function bupCollection() {
  const cards = [];
  for (let i = 0; i < 20; i += 1) cards.push(bupCard(`Zombie B ${i}`, "creature — zombie", "", 1 + (i % 4), ["B"]));
  for (let i = 0; i < 6; i += 1) cards.push(bupCard(`Zombie U ${i}`, "creature — zombie", "", 2, ["U"]));
  for (let i = 0; i < 20; i += 1) cards.push(bupCard(`Kill ${i}`, "instant", "destroy target creature.", 2, ["B"]));
  for (let i = 0; i < 20; i += 1) cards.push(bupCard(`Study ${i}`, "sorcery", "draw two cards.", 2, ["B"]));
  for (let i = 0; i < 12; i += 1) cards.push(bupCard(`Rock ${i}`, "artifact", "{t}: add {c}.", 2, []));
  for (let i = 0; i < 400; i += 1) cards.push(bupCard(`Bulk ${i}`, "creature — bear", "", 2, ["G"]));
  return cards;
}

runSuite("bottom-up", {
  "toBottomUpSubtype: a tribal entry carries its singular tribe": () => {
    const subtype = toBottomUpSubtype(BUP_ENTRY, BUP_TRIBE_FOR);
    assertEqual(subtype, { kind: "tribal", tag: "zombies", label: "Zombies", tribe: "zombie" });
  },

  "candidateColorSets: the best single color, and a pair only when it adds three or more": () => {
    const subtype = toBottomUpSubtype(BUP_ENTRY, BUP_TRIBE_FOR);
    const sets = candidateColorSets(bupCollection(), subtype);
    assertEqual(sets[0], ["B"]);
    assertEqual(sets[1], ["U", "B"]);
  },

  "rateBuild: Strong needs deep support and few shortfalls, Thin is the default": () => {
    const strong = { nonlandSlots: 62, members: 25, payoffs: 0, shortfalls: { wipe: 0, removal: 0, ramp: 1, draw: 0 } };
    const thin = { nonlandSlots: 62, members: 3, payoffs: 0, shortfalls: { wipe: 4, removal: 5, ramp: 5, draw: 5 } };
    assertEqual(rateBuild(strong), "Strong");
    assertEqual(rateBuild(thin), "Thin");
  },

  "describeBuild: names bulk quality and the thin roles": () => {
    const report = {
      nonlandSlots: 62, members: 10, payoffs: 2, mentions: 1, shortfalls: { wipe: 4, removal: 0, ramp: 0, draw: 0 },
      roleCounts: { wipe: 0, removal: 8, ramp: 9, draw: 8 }, slots: { wipe: 4, removal: 8, ramp: 9, draw: 8 },
      substitutions: [{ role: "removal+wipe", shortfall: 4, extraDraw: 4 }], supportRarity: { bulk: 11, rare: 1 }
    };
    const d = describeBuild(report);
    assertTrue(/bulk/i.test(d.quality));
    assertTrue(d.roles.some((line) => /wipe/i.test(line)));
    assertTrue(d.roles.some((line) => /draw/i.test(line)));
  },

  "rankBottomUpSuggestions: three archetypes per subtype and color set, best support first": () => {
    const rows = rankBottomUpSuggestions(bupCollection(), [BUP_ENTRY], BUP_TRIBE_FOR);
    assertTrue(rows.length >= 3);
    assertEqual(new Set(rows.map((r) => r.archetype)).size, 3);
    assertTrue(rows.every((r) => r.subtype.tag === "zombies"));
    const rank = { Strong: 0, OK: 1, Thin: 2 };
    for (let i = 1; i < rows.length; i += 1) assertTrue(rank[rows[i - 1].rating] <= rank[rows[i].rating], "not sorted by rating");
  },

  "rankBottomUpSuggestions: an empty collection gives no suggestions": () => {
    assertEqual(rankBottomUpSuggestions([], [BUP_ENTRY], BUP_TRIBE_FOR), []);
  }
});
```

- [ ] **Step 3: Run and confirm failure**: `bash dev/tests/jxa/run_all.sh bottom-up.test` (the substring `bottom-up.test` avoids also matching `bottom-up-deck`).

- [ ] **Step 4: Implement** `js/analysis/bottom-up.js`:

```js
// Bottom-up suggestions: which archetype x subtype x colors does this collection support?
//
// Starts from rankCollectionSupport (discovery.js) for the subtypes, tries the best single color
// and the best pair for each, builds all three archetypes, and rates each build by how much of
// it the pile fills without falling back to generic cards.
//
// Depends on: discovery.js, archetypes.js, bottom-up-deck.js, cards.js

const SUGGESTION_SUBTYPES = 8;
const SUGGESTION_MAX_ROWS = 12;
const SUGGESTION_COLORS = ["W", "U", "B", "R", "G"];
// A second color must bring at least this many more supporting cards to be worth offering.
const SUGGESTION_PAIR_GAIN = 3;
const RATING_RANK = { Strong: 0, OK: 1, Thin: 2 };

function toBottomUpSubtype(entry, tribeFor) {
  const subtype = { kind: entry.kind, tag: entry.tag, label: entry.label };
  if (entry.kind === "tribal") subtype.tribe = tribeFor(entry);
  return subtype;
}

function candidateColorSets(cards, subtype) {
  const singles = SUGGESTION_COLORS.map((c) => [c]);
  const pairs = [];
  for (let i = 0; i < SUGGESTION_COLORS.length; i += 1) {
    for (let j = i + 1; j < SUGGESTION_COLORS.length; j += 1) pairs.push([SUGGESTION_COLORS[i], SUGGESTION_COLORS[j]]);
  }

  const support = cards.filter((card) => {
    const standing = annotateBottomUpCard(card, subtype).standing;
    return standing === "member" || standing === "payoff";
  });
  const countFor = (set) => support.filter((card) => legalForCommander(card.colors || [], set, card)).length;
  const best = (sets) => sets.map((set) => ({ set, n: countFor(set) })).sort((a, b) => b.n - a.n)[0];

  const bestSingle = best(singles);
  const bestPair = best(pairs);
  const out = [];
  if (bestSingle && bestSingle.n > 0) out.push(bestSingle.set);
  if (bestPair && bestSingle && bestPair.n >= bestSingle.n + SUGGESTION_PAIR_GAIN) out.push(bestPair.set);
  return out;
}

function rateBuild(report) {
  const support = (report.members + report.payoffs) / Math.max(report.nonlandSlots, 1);
  const shortfall = Object.values(report.shortfalls).reduce((sum, n) => sum + n, 0);
  if (support >= 0.35 && shortfall <= 2) return "Strong";
  if (support >= 0.2 && shortfall <= 8) return "OK";
  return "Thin";
}

function describeBuild(report) {
  const supportCount = report.members + report.payoffs;
  const bulk = report.supportRarity.bulk;
  const rare = report.supportRarity.rare;
  const quality = supportCount === 0
    ? "no cards of this subtype"
    : bulk / Math.max(bulk + rare, 1) >= 0.75
      ? "mostly bulk-quality (commons and uncommons)"
      : "includes rares and mythics";

  const roles = [];
  for (const [role, missing] of Object.entries(report.shortfalls)) {
    if (missing > 0) roles.push(`${role}: ${report.roleCounts[role]} of ${report.slots[role]}`);
  }
  for (const sub of report.substitutions) roles.push(`draw covers ${sub.extraDraw} of ${sub.shortfall} missing ${sub.role} slots`);

  return { support: `${report.members} members, ${report.payoffs} payoffs, ${report.mentions} mentions`, quality, roles };
}

function rankBottomUpSuggestions(cards, catalog, tribeFor) {
  const seen = new Set();
  const nonland = [];
  for (const card of cards) {
    if (!card || seen.has(card.name) || getCardType(card).includes("land")) continue;
    seen.add(card.name);
    nonland.push(card);
  }
  if (!nonland.length) return [];

  const rows = [];
  for (const supported of rankCollectionSupport(nonland, catalog, tribeFor).slice(0, SUGGESTION_SUBTYPES)) {
    const subtype = toBottomUpSubtype(supported.entry, tribeFor);
    for (const colors of candidateColorSets(nonland, subtype)) {
      for (const archetype of ARCHETYPE_ORDER) {
        const { report } = buildDeckBottomUp(nonland, { archetype, subtype, colors });
        rows.push({ subtype, colors, archetype, report, rating: rateBuild(report), ...describeBuild(report) });
      }
    }
  }

  const share = (row) => (row.report.members + row.report.payoffs) / Math.max(row.report.nonlandSlots, 1);
  rows.sort((a, b) => RATING_RANK[a.rating] - RATING_RANK[b.rating] || share(b) - share(a));
  return rows.slice(0, SUGGESTION_MAX_ROWS);
}
```

- [ ] **Step 5: Run** `bash dev/tests/jxa/run_all.sh bottom-up.test`. Expected `SUITE OK`. The fixture has 26 Zombies in a 466-card pool; `rankCollectionSupport` needs at least 12 and at most 15% of the pool (26/466 is 5.6%), so it qualifies. If `rankCollectionSupport` returns nothing for the fixture, adjust fixture counts, not the thresholds.

- [ ] **Step 6: Time it.** In a node check (vm, like the earlier probe) or the harness, run `rankBottomUpSuggestions` over the full fixture collection (about 8,000 cards) and note the seconds. If it is over 3 seconds, stop and report it to the user before the UI task: the fix (a shared pre-filtered pool per subtype) changes this task's interface.

- [ ] **Step 7: Run all suites; commit**

```bash
git add js/analysis/bottom-up.js dev/tests/jxa/bottom-up.test.js dev/tools/jxa-harness/build_harness.sh index.html pauper.html
git commit -m "Add bottom-up suggestions ranked by collection support

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Commander fit (`js/analysis/commander-fit.js`)

**Files:**
- Create: `js/analysis/commander-fit.js`, `dev/tests/jxa/commander-fit.test.js`
- Modify: `build_harness.sh`, `index.html`, `pauper.html` (after `js/analysis/bottom-up.js`)

**Interfaces:**
- Consumes: `canBeActiveCommander(card)` (format.js), `legalForCommander`, `subtypeStanding`, `annotateBottomUpCard`.
- Produces: `COMMANDER_FIT_MAX_CUTS` (8), `rankCommanderFits(deck, candidates, subtype)` where `candidates` is `[{ card, owned }]`, returning `[{ card, owned, cuts: [names], reward }]` sorted by fewest cuts, then reward, then name.

- [ ] **Step 1: Register the file**, placeholder `printf '// commander fit\n' > js/analysis/commander-fit.js`.

- [ ] **Step 2: Write the failing tests** — `dev/tests/jxa/commander-fit.test.js` (the suite's source chain includes `js/format.js` via the harness list):

```js
function cfCard(name, type, text, colors) {
  return { name, type, text: text || "", cmc: 3, colors: colors || [], rarity: "rare", manaCost: "" };
}
const CF_ZOMBIE = { kind: "tribal", tag: "zombies", label: "Zombies", tribe: "zombie" };
const CF_DECK = [
  cfCard("Zombie A", "creature — zombie", "", ["B"]),
  cfCard("Zombie B", "creature — zombie", "", ["B"]),
  cfCard("Island Spell", "instant", "draw a card.", ["U"])
];

runSuite("commander-fit", {
  "a commander covering the deck's colors has no cuts": () => {
    const rows = rankCommanderFits(CF_DECK, [{ card: cfCard("Ub Lord", "legendary creature — zombie noble", "", ["U", "B"]), owned: true }], CF_ZOMBIE);
    assertEqual(rows.length, 1);
    assertEqual(rows[0].cuts, []);
  },

  "a commander narrower than the deck lists the cards it forces out": () => {
    const rows = rankCommanderFits(CF_DECK, [{ card: cfCard("Mono B Lord", "legendary creature — zombie noble", "", ["B"]), owned: true }], CF_ZOMBIE);
    assertEqual(rows[0].cuts, ["Island Spell"]);
  },

  "fewer cuts rank first, then a tribe commander over a stranger": () => {
    const rows = rankCommanderFits(CF_DECK, [
      { card: cfCard("Mono B Lord", "legendary creature — zombie noble", "", ["B"]), owned: true },
      { card: cfCard("Ub Stranger", "legendary creature — human wizard", "", ["U", "B"]), owned: true },
      { card: cfCard("Ub Lord", "legendary creature — zombie noble", "", ["U", "B"]), owned: true }
    ], CF_ZOMBIE);
    assertEqual(rows.map((r) => r.card.name), ["Ub Lord", "Ub Stranger", "Mono B Lord"]);
  },

  "a card that cannot be a commander is skipped": () => {
    const rows = rankCommanderFits(CF_DECK, [{ card: cfCard("Plain Bear", "creature — bear", "", ["B"]), owned: true }], CF_ZOMBIE);
    assertEqual(rows, []);
  },

  "a commander that would cut more than the limit is dropped": () => {
    const deck = [];
    for (let i = 0; i < COMMANDER_FIT_MAX_CUTS + 1; i += 1) deck.push(cfCard(`Blue ${i}`, "instant", "draw a card.", ["U"]));
    const rows = rankCommanderFits(deck, [{ card: cfCard("Mono B Lord", "legendary creature — zombie noble", "", ["B"]), owned: true }], CF_ZOMBIE);
    assertEqual(rows, []);
  },

  "the owned flag is carried through so the UI can mark commanders not in the collection": () => {
    const rows = rankCommanderFits(CF_DECK, [{ card: cfCard("Ub Lord", "legendary creature — zombie noble", "", ["U", "B"]), owned: false }], CF_ZOMBIE);
    assertEqual(rows[0].owned, false);
  }
});
```

- [ ] **Step 3: Run and confirm failure**: `bash dev/tests/jxa/run_all.sh commander-fit`.

- [ ] **Step 4: Implement** `js/analysis/commander-fit.js`:

```js
// Which commander suits a finished bottom-up deck?
//
// Candidates are owned commanders and, when EDHREC can name them, commanders that are not in the
// collection. A commander narrower than the deck's colors forces cards out (the cuts), so the
// fewest cuts rank first; among those, a commander that is or rewards the subtype ranks higher.
//
// Depends on: format.js (canBeActiveCommander), cards.js (legalForCommander), archetypes.js

const COMMANDER_FIT_MAX_CUTS = 8;

function commanderReward(card, subtype) {
  const standing = annotateBottomUpCard(card, subtype).standing;
  return standing === "member" ? 3 : standing === "payoff" ? 3 : standing === "mention" ? 1 : 0;
}

function rankCommanderFits(deck, candidates, subtype) {
  const rows = [];
  for (const candidate of candidates) {
    const card = candidate.card;
    if (!card || !canBeActiveCommander(card)) continue;
    const cuts = deck.filter((c) => !legalForCommander(c.colors || [], card.colors || [], c)).map((c) => c.name);
    if (cuts.length > COMMANDER_FIT_MAX_CUTS) continue;
    rows.push({ card, owned: Boolean(candidate.owned), cuts, reward: commanderReward(card, subtype) });
  }
  return rows.sort((a, b) =>
    a.cuts.length - b.cuts.length || b.reward - a.reward || String(a.card.name).localeCompare(String(b.card.name)));
}
```

- [ ] **Step 5: Run** `bash dev/tests/jxa/run_all.sh commander-fit`. Expected `SUITE OK`. If `canBeActiveCommander` rejects the fixtures, the type line needs "legendary creature" (it does above); print `canBeCommander(card)` for one fixture and adjust the fixture text, not the code.

- [ ] **Step 6: Run all suites; commit**

```bash
git add js/analysis/commander-fit.js dev/tests/jxa/commander-fit.test.js dev/tools/jxa-harness/build_harness.sh index.html pauper.html
git commit -m "Add commander fit ranking for bottom-up decks

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The Bottom-Up tab (`js/ui/bottom-up-tab.js`)

**Files:**
- Create: `js/ui/bottom-up-tab.js`
- Modify: `index.html`, `pauper.html` (tab button, tab panel, script tag after `js/ui/theme-tab.js`), `js/ui/commanders-tab.js` (`activateTab`), `js/main.js` (bind and reset), `style.css`
- Not in the harness list (UI files are not in `build_harness.sh`; `run_all.sh` adds a UI file only for named suites)

**Interfaces:**
- Consumes: `getOwnedCollection`, `fetchCardDataBatchWithProgress`, `getCollectionEntries`, `hasOwnedCard`, `normalizeCardName`, `updateProgress`, `showToast`, `escapeHtml`, `getThemeTabCatalog`, `themeTabTribeFor` (theme-tab.js), `fetchEdhrecTagCommanders`, `getCommander`, `isPauperFormat`, `canBeActiveCommander`, and Tasks 1-4.
- Produces: `renderBottomUpTab()`, `bindBottomUpTab()`, `resetBottomUpTab()`.

- [ ] **Step 1: Markup.** In both `index.html` and `pauper.html`:
  - Add after the Theme/Typal tab button: `<button class="tab-btn" type="button" data-tab="bottomup">Bottom-Up Build</button>`
  - Add after the theme tab panel:
```html
    <div class="tab-panel hidden" data-tab="bottomup">
      <div class="panel">
        <h2>Build From the Bottom Up</h2>
        <div id="bottomUpPanel"></div>
      </div>
    </div>
```
  - Add `<script src="js/ui/bottom-up-tab.js"></script>` right after the `js/ui/theme-tab.js` tag.

- [ ] **Step 2: Wire it.**
  - `js/ui/commanders-tab.js`, in `activateTab`, add `if (tabName === "bottomup") renderBottomUpTab();` beside the other tab branches.
  - `js/main.js`: next to `bindThemeTab();` (line ~721) add `bindBottomUpTab();`. Find where a new upload clears the theme tab (`grep -n resetThemeTabSupport js/main.js js/ui/*.js`) and call `resetBottomUpTab();` right beside it.

- [ ] **Step 3: Implement** `js/ui/bottom-up-tab.js`:

```js
// The Bottom-Up Build tab: pick (or accept) an archetype, a subtype and colors, build the 99 from
// the collection, then see which commanders fit. The commander-first flow is untouched.
//
// Depends on: archetypes.js, bottom-up-deck.js, bottom-up.js, commander-fit.js, theme-tab.js
//   (getThemeTabCatalog, themeTabTribeFor), edhrec.js, scryfall.js, csv.js, status.js, dom.js, state.js

const BOTTOM_UP_COLOR_LETTERS = ["W", "U", "B", "R", "G"];
const BOTTOM_UP_UNOWNED_LOOKUPS = 15;
const BOTTOM_UP_UNOWNED_SHOWN = 5;

let bottomUpCardData = null;
let bottomUpSuggestions = null;
let bottomUpBusy = false;
let bottomUpError = "";
let bottomUpResult = null;
let bottomUpPicks = { archetype: "midrange", subtypeKey: "", colors: new Set() };

function resetBottomUpTab() {
  bottomUpCardData = null;
  bottomUpSuggestions = null;
  bottomUpBusy = false;
  bottomUpError = "";
  bottomUpResult = null;
}

function bottomUpColorsLabel(colors) {
  return colors.length ? colors.join("") : "Colorless";
}

function bottomUpSubtypeKey(subtype) {
  return `${subtype.kind}:${subtype.tag}`;
}

function findBottomUpEntry(key) {
  return getThemeTabCatalog().find((entry) => `${entry.kind}:${entry.tag}` === key) || null;
}

async function loadBottomUpCardData() {
  if (bottomUpCardData) return bottomUpCardData;
  const collection = getOwnedCollection();
  bottomUpCardData = await fetchCardDataBatchWithProgress(collection.uniqueRawNames, (done, total) => {
    updateProgress(5 + Math.floor((done / Math.max(total, 1)) * 90), "Reading your collection...", `${done} / ${total}`);
  });
  updateProgress(100, "Collection read", "");
  return bottomUpCardData;
}

function bottomUpOwnedCards() {
  const collection = getOwnedCollection();
  const seen = new Set();
  const cards = [];
  for (const entry of getCollectionEntries(collection)) {
    const card = bottomUpCardData.get(entry.normalizedName)
      || bottomUpCardData.get(normalizeCardName(getPrimaryCardName(entry.normalizedName)));
    if (!card || seen.has(card.name)) continue;
    seen.add(card.name);
    cards.push(card);
  }
  return cards;
}

async function findBottomUpSuggestions() {
  if (!getOwnedCollection() || bottomUpBusy) return;
  bottomUpBusy = true;
  bottomUpError = "";
  renderBottomUpTab();
  try {
    await loadBottomUpCardData();
    bottomUpSuggestions = rankBottomUpSuggestions(bottomUpOwnedCards(), getThemeTabCatalog(), themeTabTribeFor);
  } catch (error) {
    console.error(error);
    bottomUpError = error.message || "Unable to read the collection.";
  } finally {
    bottomUpBusy = false;
    renderBottomUpTab();
  }
}

async function buildBottomUpDeck(archetype, subtype, colors) {
  if (!getOwnedCollection() || bottomUpBusy) return;
  bottomUpBusy = true;
  bottomUpError = "";
  bottomUpResult = null;
  renderBottomUpTab();
  try {
    await loadBottomUpCardData();
    const owned = bottomUpOwnedCards();
    const landCount = recommendLandCount(colors);
    const { deck, report } = buildDeckBottomUp(owned, { archetype, subtype, colors, nonlandSlots: 99 - landCount });
    const lands = buildBottomUpManaBase(deck, colors, getOwnedCollection(), bottomUpCardData, landCount);

    const ownedKeys = new Set(owned.map((card) => normalizeCardName(card.name)));
    const candidates = owned.filter((card) => canBeActiveCommander(card)).map((card) => ({ card, owned: true }));
    const entry = findBottomUpEntry(bottomUpSubtypeKey(subtype));
    if (entry && !isPauperFormat()) {
      const listed = (await fetchEdhrecTagCommanders(entry.slug))
        .filter((c) => !ownedKeys.has(normalizeCardName(c.name)))
        .slice(0, BOTTOM_UP_UNOWNED_LOOKUPS);
      for (const item of listed) {
        const card = await getCommander(item.name);
        if (card) candidates.push({ card, owned: false });
      }
    }
    const fits = rankCommanderFits(deck, candidates, subtype);
    bottomUpResult = {
      archetype, subtype, colors, deck, lands, report,
      ownedFits: fits.filter((f) => f.owned).slice(0, 10),
      unownedFits: fits.filter((f) => !f.owned).slice(0, BOTTOM_UP_UNOWNED_SHOWN)
    };
  } catch (error) {
    console.error(error);
    bottomUpError = error.message || "Unable to build the deck.";
  } finally {
    bottomUpBusy = false;
    renderBottomUpTab();
  }
}

function renderBottomUpSuggestions() {
  if (bottomUpBusy && !bottomUpSuggestions) return '<p class="theme-tab-status">Reading your collection...</p>';
  if (!bottomUpSuggestions) {
    return `
      <p class="theme-tab-status">Start from your pile instead of a commander: see which deck types your collection supports best.</p>
      <button id="bottomUpSuggestBtn" type="button">Suggest decks from my collection</button>`;
  }
  if (!bottomUpSuggestions.length) return '<p class="theme-tab-status">No subtype stands out in this collection yet. Pick one yourself below.</p>';
  return `
    <div class="bu-suggestions">
      ${bottomUpSuggestions.map((row, index) => `
        <button type="button" class="bu-suggestion" data-bu-suggestion="${index}">
          <span class="bu-suggestion-title">${escapeHtml(ARCHETYPES[row.archetype].label)} ${escapeHtml(row.subtype.label)}
            <span class="plan-tag">${escapeHtml(bottomUpColorsLabel(row.colors))}</span>
            <span class="status-chip status-${row.rating === "Strong" ? "deep" : row.rating === "OK" ? "ok" : "thin"}">${row.rating}</span></span>
          <span class="bu-suggestion-note">${escapeHtml(row.support)}; ${escapeHtml(row.quality)}${row.roles.length ? `; ${escapeHtml(row.roles.join("; "))}` : ""}</span>
        </button>`).join("")}
    </div>`;
}

function renderBottomUpPickers() {
  const subtypeOptions = getThemeTabCatalog().map((entry) => {
    const key = `${entry.kind}:${entry.tag}`;
    return `<option value="${escapeHtml(key)}"${key === bottomUpPicks.subtypeKey ? " selected" : ""}>${escapeHtml(entry.label)} (${entry.kind === "tribal" ? "tribe" : "theme"})</option>`;
  }).join("");
  const archetypeOptions = ARCHETYPE_ORDER.map((id) =>
    `<option value="${id}"${id === bottomUpPicks.archetype ? " selected" : ""}>${ARCHETYPES[id].label}</option>`).join("");
  const colorButtons = BOTTOM_UP_COLOR_LETTERS.map((c) =>
    `<button type="button" class="mode-toggle-btn${bottomUpPicks.colors.has(c) ? " active" : ""}" data-bu-color="${c}">${c}</button>`).join("");
  return `
    <div class="priority-section-label">Or pick your own</div>
    <div class="bu-pickers">
      <select id="buArchetype">${archetypeOptions}</select>
      <select id="buSubtype"><option value="">Choose a subtype</option>${subtypeOptions}</select>
      <span class="bu-colors">${colorButtons}</span>
      <button id="buBuildBtn" type="button">Build this deck</button>
    </div>`;
}

function renderBottomUpResult() {
  const r = bottomUpResult;
  if (!r) return "";
  const groups = {};
  for (const card of r.deck) (groups[card.bottomUpRole] = groups[card.bottomUpRole] || []).push(card);
  const order = ["wipe", "removal", "ramp", "draw", "synergy"];
  const sections = order.filter((role) => groups[role]).map((role) => `
    <div class="priority-section-label">${role === "synergy" ? "Creatures and synergy" : role} (${groups[role].length})</div>
    <ul class="bu-list">${groups[role].map((c) => `<li>${escapeHtml(c.name)}${c.standing === "member" || c.standing === "payoff" ? ` <span class="plan-tag">${c.standing}</span>` : ""}</li>`).join("")}</ul>`).join("");
  const d = describeBuild(r.report);
  const fitRow = (f) => `<li>${escapeHtml(f.card.name)}${f.owned ? "" : ' <span class="plan-tag">not in your collection</span>'}
    ${f.cuts.length ? `<span class="detail-note">cuts ${f.cuts.length}: ${escapeHtml(f.cuts.slice(0, 5).join(", "))}${f.cuts.length > 5 ? ", ..." : ""}</span>` : '<span class="detail-note">no cuts</span>'}</li>`;
  return `
    <div class="bu-result">
      <h3>${escapeHtml(ARCHETYPES[r.archetype].label)} ${escapeHtml(r.subtype.label)} <span class="plan-tag">${escapeHtml(bottomUpColorsLabel(r.colors))}</span></h3>
      <p class="detail-note">${escapeHtml(d.support)}; ${escapeHtml(d.quality)}; average mana value ${r.report.avgCmc}; ${r.lands.length} lands.${d.roles.length ? ` ${escapeHtml(d.roles.join("; "))}.` : ""}</p>
      <button id="buCopyBtn" type="button">Copy decklist</button>
      <div class="priority-section-label">Commanders you own that fit</div>
      <ul class="bu-list">${r.ownedFits.length ? r.ownedFits.map(fitRow).join("") : '<li class="detail-note">None of your commanders fit these colors well.</li>'}</ul>
      ${r.unownedFits.length ? `<div class="priority-section-label">Commanders that would suit it</div><ul class="bu-list">${r.unownedFits.map(fitRow).join("")}</ul>` : ""}
      ${sections}
    </div>`;
}

function renderBottomUpTab() {
  const panel = document.getElementById("bottomUpPanel");
  if (!panel) return;
  if (!getOwnedCollection()) {
    panel.innerHTML = '<p class="theme-tab-status">Upload your collection on the Build a Deck tab first.</p>';
    return;
  }
  panel.innerHTML = `
    ${bottomUpError ? `<p class="theme-tab-status">${escapeHtml(bottomUpError)}</p>` : ""}
    ${renderBottomUpSuggestions()}
    ${renderBottomUpPickers()}
    ${bottomUpBusy && bottomUpSuggestions ? '<p class="theme-tab-status">Building...</p>' : ""}
    ${renderBottomUpResult()}`;
}

function bindBottomUpTab() {
  const panel = document.getElementById("bottomUpPanel");
  if (!panel) return;

  panel.addEventListener("change", (event) => {
    if (event.target.id === "buArchetype") bottomUpPicks.archetype = event.target.value;
    if (event.target.id === "buSubtype") bottomUpPicks.subtypeKey = event.target.value;
  });

  panel.addEventListener("click", (event) => {
    const target = event.target;
    if (target.id === "bottomUpSuggestBtn") { findBottomUpSuggestions(); return; }

    const color = target.dataset?.buColor;
    if (color) {
      if (bottomUpPicks.colors.has(color)) bottomUpPicks.colors.delete(color); else bottomUpPicks.colors.add(color);
      renderBottomUpTab();
      return;
    }

    const suggestion = target.closest?.("[data-bu-suggestion]");
    if (suggestion && bottomUpSuggestions) {
      const row = bottomUpSuggestions[Number(suggestion.dataset.buSuggestion)];
      if (row) buildBottomUpDeck(row.archetype, row.subtype, row.colors);
      return;
    }

    if (target.id === "buBuildBtn") {
      const entry = findBottomUpEntry(bottomUpPicks.subtypeKey);
      if (!entry) { showToast("Choose a subtype first."); return; }
      const colors = BOTTOM_UP_COLOR_LETTERS.filter((c) => bottomUpPicks.colors.has(c));
      buildBottomUpDeck(bottomUpPicks.archetype, toBottomUpSubtype(entry, themeTabTribeFor), colors);
      return;
    }

    if (target.id === "buCopyBtn" && bottomUpResult) {
      const text = bottomUpDecklistText([...bottomUpResult.deck, ...bottomUpResult.lands]);
      navigator.clipboard.writeText(text).then(() => showToast("Decklist copied."), () => showToast("Copy failed."));
    }
  });
}
```

- [ ] **Step 4: Styles.** Append to `style.css`:

```css
.bu-suggestions { display: grid; gap: 8px; margin: 8px 0 16px; }
.bu-suggestion { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; padding: 8px 12px; }
.bu-suggestion-title { font-weight: 600; }
.bu-suggestion-note { font-size: 0.85em; opacity: 0.8; }
.bu-pickers { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0 16px; }
.bu-colors { display: inline-flex; gap: 4px; }
.bu-list { margin: 4px 0 12px; padding-left: 18px; columns: 2 220px; }
.bu-result h3 { margin: 16px 0 4px; }
```

- [ ] **Step 5: Check.** `node --check js/ui/bottom-up-tab.js`. Then run `python3 dev/tools/jxa-harness/browser_smoke.py` for both pages as AGENTS.md describes (it must print no JavaScript errors). It does not open the new tab, so also do a vm render check like the one used for the analytics tab: load the scripts into a node `vm` context with stub `document`, call `renderBottomUpTab()` with no collection (expects the "Upload your collection" text) and with a stub collection (expects suggestion button and pickers markup). Save that script in the scratchpad, not the repo.

- [ ] **Step 6: Run all suites; commit**

```bash
git add js/ui/bottom-up-tab.js js/ui/commanders-tab.js js/main.js index.html pauper.html style.css
git commit -m "Add the Bottom-Up Build tab

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Ask the user to open `index.html`, upload their CSV, and click through the tab** (suggest, build, copy decklist, commander lists). Layout was never browser-checked in earlier work either; say so.

---

### Task 6: Measures in the harness, then the user's decision

**Files:**
- Create: `dev/tools/jxa-harness/bottom_up_measure.js` (measures 1 and 2), `dev/tools/jxa-harness/bottom_up_compare.js` (measure 3)
- Modify: `AGENTS.md` (architecture bullets, Suites line)

**Interfaces:**
- Consumes: the built harness (`bash dev/tools/jxa-harness/build_harness.sh dev/tools/jxa-harness/combined.js`), `owned_raw.json`, `prefetch_data.json`, `baselines/2026-10-15-after-events.json` (56 commanders, each `{ current: [nonland names] }`).

- [ ] **Step 1: Measures 1 and 2** — `bottom_up_measure.js`, run like `dump_decks.js`: `cat dev/tools/jxa-harness/combined.js dev/tools/jxa-harness/bottom_up_measure.js > /tmp/run.js && osascript -l JavaScript /tmp/run.js`.

```js
// Ad-hoc driver (not part of the committed suites): archetype separation (measure 1) and
// collection coverage on thinner collections (measure 2) for a few subtype/color picks.
// Usage: see the top of dump_decks.js; this file runs after combined.js.

function jxaPrint(s) {
  $.NSFileHandle.fileHandleWithStandardOutput.writeData(
    $.NSString.alloc.initWithUTF8String(s + "\n").dataUsingEncoding($.NSUTF8StringEncoding));
}
function readJsonFile(path) {
  const data = $.NSData.dataWithContentsOfFile($.NSString.alloc.initWithString(path).stringByStandardizingPath.js);
  return JSON.parse($.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding).js);
}
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const PICKS = [
  { subtype: { kind: "tribal", tag: "zombies", label: "Zombies", tribe: "zombie" }, colors: ["B"] },
  { subtype: { kind: "tribal", tag: "zombies", label: "Zombies", tribe: "zombie" }, colors: ["U", "B"] },
  { subtype: { kind: "tribal", tag: "elves", label: "Elves", tribe: "elf" }, colors: ["G"] }
];
const FRACTIONS = [1, 0.5, 0.25];
const ownedAll = readJsonFile("dev/tools/jxa-harness/owned_raw.json");

for (const fraction of FRACTIONS) {
  const rng = mulberry32(12345);
  const cards = (fraction >= 1 ? ownedAll : ownedAll.filter(() => rng() < fraction)).map(convertScryfallCard);
  for (const pick of PICKS) {
    for (const archetype of ARCHETYPE_ORDER) {
      const { report } = buildDeckBottomUp(cards, { archetype, subtype: pick.subtype, colors: pick.colors });
      jxaPrint("BU " + JSON.stringify({
        fraction, subtype: pick.subtype.tag, colors: pick.colors.join(""), archetype,
        creatures: report.creatures, avgCmc: report.avgCmc, roles: report.roleCounts,
        members: report.members, payoffs: report.payoffs, mentions: report.mentions,
        fallback: report.fallbackCount, shortfalls: report.shortfalls
      }));
    }
  }
}
```
Run it, then check: (1) across the three archetypes of each pick, creature count, removal/draw counts and `avgCmc` differ in the expected direction; (2) at 25% sampling the builds still fill (fallback grows, nothing throws). Report the table to the user.

- [ ] **Step 2: Measure 3** — `bottom_up_compare.js`: for each baseline commander whose Scryfall card (in `prefetch.commanderCards`) has a creature subtype that appears in the tribal catalog with at least 10 owned members, build a midrange bottom-up deck in the commander's colors and print the overlap with the baseline deck.

```js
// Measure 3: bottom-up midrange vs the commander-first baseline for the same tribe and colors.
// Overlap is the share of the baseline's nonland cards that the bottom-up deck also picked.

function jxaPrint(s) {
  $.NSFileHandle.fileHandleWithStandardOutput.writeData(
    $.NSString.alloc.initWithUTF8String(s + "\n").dataUsingEncoding($.NSUTF8StringEncoding));
}
function readJsonFile(path) {
  const data = $.NSData.dataWithContentsOfFile($.NSString.alloc.initWithString(path).stringByStandardizingPath.js);
  return JSON.parse($.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding).js);
}

const owned = readJsonFile("dev/tools/jxa-harness/owned_raw.json").map(convertScryfallCard);
const prefetch = readJsonFile("dev/tools/jxa-harness/prefetch_data.json");
const baseline = readJsonFile("dev/tools/jxa-harness/baselines/2026-10-15-after-events.json");

for (const key of Object.keys(baseline)) {
  const commanderRaw = prefetch.commanderCards[key.split(" + ")[0]];
  if (!commanderRaw) continue;
  const commander = convertScryfallCard(commanderRaw);
  const tribes = getCardSubtypes(commander);
  const colors = commanderRaw.color_identity || [];
  for (const tribe of tribes) {
    const members = owned.filter((c) => getCardSubtypes(c).includes(tribe) && legalForCommander(c.colors || [], colors, c));
    if (members.length < 10) continue;
    const subtype = { kind: "tribal", tag: tribe + "s", label: tribe, tribe };
    const { deck, report } = buildDeckBottomUp(owned, { archetype: "midrange", subtype, colors });
    const names = new Set(deck.map((c) => c.name));
    const base = baseline[key].current.filter((n) => owned.some((c) => c.name === n && !getCardType(c).includes("land")));
    const shared = base.filter((n) => names.has(n)).length;
    jxaPrint("CMP " + JSON.stringify({
      commander: key, tribe, colors: colors.join(""), baselineNonland: base.length,
      overlap: base.length ? +(shared / base.length).toFixed(2) : 0,
      bottomUpCreatures: report.creatures, avgCmc: report.avgCmc, fallback: report.fallbackCount
    }));
  }
}
```
Run it. Report each commander's overlap and creature counts. Treat a very low overlap (under about 0.3) on a commander whose baseline is clearly tribal as a finding to investigate, not something to tune around; do not change shared builder code to chase it.

- [ ] **Step 3: Update `AGENTS.md`.** In Architecture add bullets for `js/analysis/archetypes.js`, `js/build/bottom-up-deck.js`, `js/analysis/bottom-up.js`, `js/analysis/commander-fit.js` and `js/ui/bottom-up-tab.js` (one or two lines each: what it does and that commander-first is untouched), and add `archetypes`, `bottom-up-deck`, `bottom-up` and `commander-fit` to the Suites line. Mention `bottom_up_measure.js` and `bottom_up_compare.js` beside the other harness scripts.

- [ ] **Step 4: Run all suites** — no suite reports `FAILED`. Commit:

```bash
git add dev/tools/jxa-harness/bottom_up_measure.js dev/tools/jxa-harness/bottom_up_compare.js AGENTS.md
git commit -m "Add bottom-up measures to the harness and document the feature

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Stop and hand the results to the user.** Present the three measures and the open decision from the spec: promote bottom-up to the default, keep it alongside commander-first, or drop it. Do not change the default flow in this plan.

---

## Self-review

- **Spec coverage:** archetypes with explicit curve targets (Task 1 `avgCmc`, scored through the curve term) and hard role caps (Task 2); draw substitution capped at 4 with a report entry (Task 2); mention cap (Task 2); subtype-aware synergy, sparing sweepers and symmetrical-wipe penalty (Task 1); removal quality order, edicts, false ramp (Task 1); tribe member/payoff/mention split (Task 1); suggestions with support, quality note, thin roles and rating (Task 3); manual override, colors picked separately, colors come with each suggestion (Task 5); owned commanders then named not-owned ones, with cuts listed (Tasks 4 and 5); additive mode, commander-first untouched (all tasks); three test-plan measures (Task 6); the promote/keep/drop decision left to the user (Task 6 step 5). Counterspell sub-slot for control: covered by the removal-quality order (counters rank second); a dedicated slot is not built, which matches the spec's "removal quality order" and is the one place the spec's "control gets a counterspell sub-slot" is read loosely. Say so when reporting.
- **Placeholders:** none; every code step carries code. Starting numbers (slot mix, curve, caps, weights) are real values, flagged in the spec as tunable.
- **Type consistency:** `subtype` is `{kind, tag, label, tribe?}` everywhere; `report` fields (`members`, `payoffs`, `mentions`, `shortfalls`, `roleCounts`, `slots`, `substitutions`, `supportRarity`, `avgCmc`, `fallbackCount`, `nonlandSlots`) match between Tasks 2, 3, 5 and 6; `rankCommanderFits(deck, candidates, subtype)` matches its call in Task 5.
- **Checked in node:** the tests and code of Tasks 1-4 as written here were run together in a node `vm` (same load order as the harness) and pass: 12, 12, 6 and 6 tests. That run found the linear curve penalty, now fixed above. Task 5's UI and Task 6's harness scripts were not run.
- **Known risks flagged in-plan:** suggestion timing (Task 3 step 6); the tab's layout is unverified in a browser (Task 5 step 7); EDHREC tag pages for tribes confirmed to list commanders (the Zombies page returned commander names with deck counts) but `extractEdhrecTagCommanders` itself was not run against it.
