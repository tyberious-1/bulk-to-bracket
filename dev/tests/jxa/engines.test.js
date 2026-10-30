runSuite("engines", {
  "parseCommanderNeeds: Greasefang needs Vehicles in the graveyard": function () {
    const needs = parseCommanderNeeds([
      "At the beginning of combat on your turn, return target Vehicle card from your graveyard to the battlefield. It gains haste. Return it to its owner's hand at the beginning of your next end step."
    ]);
    assertEqual(needs.payloadType, "vehicle");
    assertTrue(needs.graveyard, "graveyard zone expected");
    assertEqual(needs.devotionColors, []);
  },
  "parseCommanderNeeds: Tormod's Zombie tokens and graveyard trigger give a Zombie need": function () {
    const needs = parseCommanderNeeds([
      "Whenever one or more cards leave your graveyard, create a tapped 2/2 black Zombie creature token."
    ]);
    assertEqual(needs.payloadType, "zombie");
    assertTrue(needs.graveyard);
  },
  "parseCommanderNeeds: Callaphe's devotion to blue": function () {
    const needs = parseCommanderNeeds([
      "Callaphe's power is equal to your devotion to blue. (Each {U} in the mana costs of permanents you control counts toward your devotion to blue.)"
    ]);
    assertEqual(needs.devotionColors, ["U"]);
    assertEqual(needs.payloadType, null);
  },
  "parseCommanderNeeds: devotion to two colors": function () {
    const needs = parseCommanderNeeds(["Add mana equal to your devotion to white and black."]);
    assertEqual(needs.devotionColors, ["W", "B"]);
  },
  "parseCommanderNeeds: a solo commander passes an undefined partner text": function () {
    const needs = parseCommanderNeeds(["Flying", undefined]);
    assertEqual(needs, { payloadType: null, payloadTypes: [], graveyard: false, returnsFromGraveyard: false, devotionColors: [], events: [] });
    assertTrue(!isEngineActive(needs), "no need, not active");
  },
  "parseCommanderNeeds: a partner pair reads both texts": function () {
    const needs = parseCommanderNeeds([
      "Whenever one or more cards leave your graveyard, create a tapped 2/2 black Zombie creature token.",
      "Add mana equal to your devotion to blue."
    ]);
    assertEqual(needs.payloadType, "zombie");
    assertEqual(needs.devotionColors, ["U"]);
  },
  "parseCommanderNeeds: Kaza-shaped spell text has no need": function () {
    const needs = parseCommanderNeeds([
      "Flash. Whenever you cast an instant or sorcery spell, you may pay {X}. If you do, copy that spell and the copy costs {X} less to cast."
    ]);
    assertTrue(!isEngineActive(needs), "spell text with no payload or devotion must not activate");
  },
  "parseCommanderNeeds: a generic creature-card reanimator has no payload type": function () {
    const needs = parseCommanderNeeds(["Return target creature card from your graveyard to the battlefield."]);
    assertEqual(needs.payloadType, null);
    assertTrue(!isEngineActive(needs));
  },
  "parseCommanderNeeds: a color word is never a payload type": function () {
    const needs = parseCommanderNeeds(["Create a 1/1 white creature token."]);
    assertEqual(needs.payloadType, null);
  },
  "getEngineClasses: a Vehicle is payload for a Vehicle need": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const card = { name: "Test Copter", type: "artifact — vehicle", text: "flying. crew 1", cmc: 2, manaCost: "{2}" };
    assertTrue(getEngineClasses(card, needs).includes("payload"), "type line subtype match");
  },
  "getEngineClasses: a repeatable discard outlet and a looter": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const outlet = { name: "Outlet", type: "artifact", text: "{1}, discard a card: draw a card.", cmc: 2 };
    const looter = { name: "Looter", type: "creature — human", text: "whenever this creature attacks, draw a card, then discard a card.", cmc: 2 };
    assertTrue(getEngineClasses(outlet, needs).includes("discard"));
    assertTrue(getEngineClasses(looter, needs).includes("discard"));
  },
  "getEngineClasses: self-mill counts, opponent-only mill does not": function () {
    const needs = { payloadType: "zombie", graveyard: true, devotionColors: [] };
    const self = { name: "Self", type: "sorcery", text: "mill three cards, then return a creature card from your graveyard to your hand.", cmc: 2 };
    const opp = { name: "Opp", type: "creature — wizard", text: "when this creature enters, each opponent mills three cards.", cmc: 3 };
    assertTrue(getEngineClasses(self, needs).includes("selfMill"));
    assertTrue(!getEngineClasses(opp, needs).includes("selfMill"), "opponent-only mill is not an enabler");
  },
  "getEngineClasses: surveil is its own low class, not self-mill": function () {
    const needs = { payloadType: "zombie", graveyard: true, devotionColors: [] };
    const card = { name: "Seer", type: "creature — human", text: "when this creature enters, surveil 2.", cmc: 2 };
    const classes = getEngineClasses(card, needs);
    assertTrue(classes.includes("surveil"));
    assertTrue(!classes.includes("selfMill"));
  },
  "getEngineClasses: type-specific recursion vs generic recursion": function () {
    const needs = { payloadType: "zombie", graveyard: true, devotionColors: [] };
    const specific = { name: "Specific", type: "sorcery", text: "return target zombie card from your graveyard to the battlefield.", cmc: 4 };
    const generic = { name: "Generic", type: "sorcery", text: "return target creature card from your graveyard to the battlefield.", cmc: 4 };
    assertTrue(getEngineClasses(specific, needs).includes("recursion"));
    assertTrue(!getEngineClasses(specific, needs).includes("recursionGeneric"));
    assertTrue(getEngineClasses(generic, needs).includes("recursionGeneric"));
    assertTrue(!getEngineClasses(generic, needs).includes("recursion"));
  },
  "getEngineClasses: lords and anthems name the type with other / you control": function () {
    const needs = { payloadType: "zombie", graveyard: true, devotionColors: [] };
    const lord = { name: "Lord", type: "creature — zombie", text: "other zombies you control get +1/+1.", cmc: 3 };
    const plain = { name: "Plain", type: "creature — zombie", text: "this creature enters tapped.", cmc: 2 };
    assertTrue(getEngineClasses(lord, needs).includes("lord"));
    assertTrue(!getEngineClasses(plain, needs).includes("lord"));
  },
  "getEngineClasses: crew classes only apply to Vehicle needs": function () {
    const vehicle = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const zombie = { payloadType: "zombie", graveyard: true, devotionColors: [] };
    const trigger = { name: "Ace", type: "creature — human", text: "whenever ace crews a vehicle, scry 1.", cmc: 2 };
    const body = { name: "Body", type: "creature — human", text: "vigilance", cmc: 2, raw: { power: "3" } };
    assertTrue(getEngineClasses(trigger, vehicle).includes("crewTap"));
    assertTrue(getEngineClasses(body, vehicle).includes("crewBody"));
    assertTrue(!getEngineClasses(trigger, zombie).includes("crewTap"));
    assertTrue(!getEngineClasses(body, zombie).includes("crewBody"));
  },
  "getEngineClasses: a bare land-tap trigger is not a crew-tap payoff": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const land = { name: "Aura", type: "enchantment — aura", text: "whenever enchanted land becomes tapped for mana, its controller loses 1 life.", cmc: 2 };
    const self = { name: "Healer", type: "creature — human cleric", text: "whenever healer becomes tapped, you gain 1 life.", cmc: 1 };
    assertTrue(!getEngineClasses(land, needs).includes("crewTap"));
    assertTrue(getEngineClasses(self, needs).includes("crewTap"));
  },
  "getEngineClasses: empty or missing text never throws": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: ["U"] };
    assertEqual(getEngineClasses({ name: "Forest", type: "basic land — forest", text: "" }, needs), []);
    assertEqual(getEngineClasses({ name: "Bare" }, needs), []);
    assertEqual(getEngineClasses(null, needs), []);
  },
  "getEngineClasses: no active need means no classes": function () {
    const none = { payloadType: null, graveyard: false, devotionColors: [] };
    const card = { name: "Outlet", type: "artifact", text: "{1}, discard a card: draw a card.", cmc: 2 };
    assertEqual(getEngineClasses(card, none), []);
  },
  "getEngineClasses: devotion payoffs are found by their text": function () {
    const needs = { payloadType: null, graveyard: false, devotionColors: ["U"] };
    const payoff = { name: "Oracle", type: "creature — merfolk wizard", text: "when this creature enters, look at the top x cards, where x is your devotion to blue.", cmc: 2 };
    assertTrue(getEngineClasses(payoff, needs).includes("devotionPayoff"));
  },
  "getEngineClasses: a third-person mill aimed at another player is not self-mill": function () {
    const needs = { payloadType: "zombie", graveyard: true, devotionColors: [] };
    const counter = { name: "Countermand-shaped", type: "instant", text: "counter target spell. its controller mills four cards.", cmc: 4 };
    const thenMill = { name: "Then-mill", type: "creature — zombie", text: "when this creature enters, you may mill two cards.", cmc: 3 };
    const youMill = { name: "You-mill", type: "creature — zombie", text: "at the beginning of your upkeep, you mill a card.", cmc: 3 };
    assertTrue(!getEngineClasses(counter, needs).includes("selfMill"), "its controller mills is not self-mill");
    assertTrue(getEngineClasses(thenMill, needs).includes("selfMill"));
    assertTrue(getEngineClasses(youMill, needs).includes("selfMill"));
  },
  "getEngineClasses: target player mills can be you, target opponent mills cannot": function () {
    const needs = { payloadType: "zombie", graveyard: true, devotionColors: [] };
    const anyPlayer = { name: "Any", type: "sorcery", text: "target player mills three cards.", cmc: 2 };
    const opp = { name: "Opp", type: "sorcery", text: "target opponent mills three cards.", cmc: 2 };
    assertTrue(getEngineClasses(anyPlayer, needs).includes("selfMill"), "you can target yourself");
    assertTrue(!getEngineClasses(opp, needs).includes("selfMill"));
  },
  "getEngineClasses: crew helpers speed up crewing, anti-crew text does not": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const ox = { name: "Ox-shaped", type: "creature — ox", text: "this creature crews vehicles using its toughness rather than its power.", cmc: 3 };
    const mechanic = { name: "Mechanic-shaped", type: "artifact creature — fox pilot", text: "this creature crews vehicles as though its power were 2 greater.", cmc: 2 };
    const aura = { name: "Aura-shaped", type: "enchantment — aura", text: "enchant permanent. enchanted permanent can't attack, block, or crew vehicles.", cmc: 2 };
    const maker = { name: "Pilot-maker", type: "enchantment — aura", text: "enchant creature or vehicle. when this aura enters, create a 1/1 colorless pilot creature token with \"this token crews vehicles as though its power were 2 greater.\"", cmc: 1 };
    assertTrue(getEngineClasses(ox, needs).includes("crewHelper"));
    assertTrue(getEngineClasses(mechanic, needs).includes("crewHelper"));
    assertTrue(!getEngineClasses(aura, needs).includes("crewHelper"), "can't crew is the opposite of a helper");
    assertTrue(getEngineClasses(maker, needs).includes("crewHelper"));
    const zombie = { payloadType: "zombie", graveyard: true, devotionColors: [] };
    assertTrue(!getEngineClasses(ox, zombie).includes("crewHelper"), "crew only matters for Vehicle needs");
  },
  "getEngineClasses: a tap trigger on an enchanted land is not a crew-tap payoff": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const aura = { name: "Ground-shaped", type: "enchantment — aura", text: "enchant land. whenever enchanted land becomes tapped, its controller loses 1 life.", cmc: 2 };
    assertTrue(!getEngineClasses(aura, needs).includes("crewTap"));
  },
  "getEngineClasses: artifact recursion counts for a Vehicle need, as generic recursion": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const card = { name: "Salvage-shaped", type: "sorcery", text: "return target artifact card from your graveyard to the battlefield.", cmc: 4 };
    assertTrue(getEngineClasses(card, needs).includes("recursionGeneric"));
    const zombie = { payloadType: "zombie", graveyard: true, devotionColors: [] };
    assertTrue(!getEngineClasses(card, zombie).includes("recursionGeneric"), "artifact recursion only helps Vehicles");
  },
  "getEngineClasses: crewBody needs real power on a cheap body": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const strong = { name: "Strong", type: "creature — human", text: "", cmc: 2, raw: { power: "3" } };
    const weak = { name: "Weak", type: "creature — human", text: "", cmc: 2, raw: { power: "2" } };
    const dear = { name: "Dear", type: "creature — human", text: "", cmc: 4, raw: { power: "4" } };
    assertTrue(getEngineClasses(strong, needs).includes("crewBody"));
    assertTrue(!getEngineClasses(weak, needs).includes("crewBody"));
    assertTrue(!getEngineClasses(dear, needs).includes("crewBody"));
  },
  "getEngineBonus: zero when no need is active": function () {
    const none = { payloadType: null, graveyard: false, devotionColors: [] };
    const card = { name: "Outlet", type: "artifact", text: "{1}, discard a card: draw a card.", cmc: 2 };
    assertEqual(getEngineBonus(card, none), 0);
    assertEqual(getEngineBonus(card, undefined), 0);
    assertEqual(getEngineBonus(null, none), 0);
  },
  "getEngineBonus: a discard outlet outranks a surveil card for a graveyard need": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const outlet = { name: "Outlet", type: "artifact", text: "{1}, discard a card: draw a card.", cmc: 2 };
    const seer = { name: "Seer", type: "creature — human", text: "when this creature enters, surveil 2.", cmc: 2 };
    assertTrue(getEngineBonus(outlet, needs) > getEngineBonus(seer, needs), "discard must rank above surveil");
  },
  "getEngineBonus: surveil outranks a sacrifice outlet, crew helper outranks crew body": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const seer = { name: "Seer", type: "creature — human", text: "when this creature enters, surveil 2.", cmc: 2 };
    const sac = { name: "Sac", type: "artifact", text: "sacrifice a creature: draw a card.", cmc: 2 };
    const helper = { name: "Helper", type: "creature — pilot", text: "this creature crews vehicles as though its power were 2 greater.", cmc: 2, raw: { power: "1" } };
    const body = { name: "Body", type: "creature — human", text: "", cmc: 2, raw: { power: "3" } };
    assertTrue(getEngineBonus(seer, needs) > getEngineBonus(sac, needs), "surveil above sacrifice");
    assertTrue(getEngineBonus(helper, needs) > getEngineBonus(body, needs), "crew helper above crew body");
  },
  "getEngineBonus: a card serving two classes ranks above one serving a single class": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const single = { name: "Single", type: "artifact", text: "{1}, discard a card: draw a card.", cmc: 2 };
    const both = { name: "Both", type: "creature — human", text: "whenever both crews a vehicle, scry 1. {1}, discard a card: draw a card.", cmc: 2, raw: { power: "2" } };
    assertTrue(getEngineBonus(both, needs) > getEngineBonus(single, needs), "multi-hit must rank higher");
  },
  "getEngineBonus: capped so one card cannot swamp roles and curve": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const everything = {
      name: "Everything", type: "artifact — vehicle creature",
      text: "{1}, discard a card: draw a card. mill three cards. return target vehicle card from your graveyard to the battlefield. other vehicles you control get +1/+1. whenever everything crews a vehicle, scry 1. surveil 2. sacrifice a creature: draw a card. crew 1",
      cmc: 2, raw: { power: "3" }
    };
    assertTrue(getEngineBonus(everything, needs) <= ENGINE_BONUS_CAP, "bonus must not exceed the cap");
    assertEqual(getEngineBonus(everything, needs), ENGINE_BONUS_CAP);
  },
  "getEngineBonus: lower crew cost ranks a Vehicle higher": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const cheap = { name: "Cheap", type: "artifact — vehicle", text: "crew 1", cmc: 2 };
    const dear = { name: "Dear", type: "artifact — vehicle", text: "crew 5", cmc: 2 };
    assertTrue(getEngineBonus(cheap, needs) > getEngineBonus(dear, needs));
  },
  "getEngineBonus: devotion rewards pip-heavy permanents, not spells or lands": function () {
    const needs = { payloadType: null, graveyard: false, devotionColors: ["U"] };
    const creature = { name: "Heavy", type: "creature — merfolk", text: "flying", cmc: 2, manaCost: "{U}{U}" };
    const spell = { name: "Spell", type: "instant", text: "counter target spell.", cmc: 2, manaCost: "{U}{U}" };
    const light = { name: "Light", type: "creature — merfolk", text: "flying", cmc: 5, manaCost: "{4}{U}" };
    const land = { name: "Island", type: "basic land — island", text: "", cmc: 0, manaCost: "" };
    assertTrue(getEngineBonus(creature, needs) > getEngineBonus(light, needs), "more pips beats fewer");
    assertEqual(getEngineBonus(spell, needs), 0);
    assertEqual(getEngineBonus(land, needs), 0);
  },
  "scoreCard and scoreFallbackCard: an engine enabler scores higher than with no active need": function () {
    const card = { name: "Outlet", type: "artifact", text: "{1}, discard a card: draw a card.", cmc: 2, colors: [] };
    const profile = getCommanderStrategyProfile("Test Commander", [], []);
    const base = getModePreferences("", profile);
    const edhrec = { synergy: 0, decks: 0, potential_decks: 0, label: "Collection Fallback", labels: ["Collection Fallback"] };
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const off = scoreFallbackCard(card, [], profile, [], Object.assign({}, base));
    const on = scoreFallbackCard(card, [], profile, [], Object.assign({}, base, { engineNeeds: needs }));
    assertTrue(on > off, "bonus must reach the fallback score outside theme focus");
    const offCard = scoreCard(card, edhrec, [], profile, [], Object.assign({}, base));
    const onCard = scoreCard(card, edhrec, [], profile, [], Object.assign({}, base, { engineNeeds: needs }));
    assertTrue(onCard > offCard, "bonus must reach the EDHREC score outside theme focus");
  },
  "addEngineCandidates: adds enabler cards to the theme tier, skips lands and illegal colors": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const outlet = { name: "Outlet", type: "artifact", text: "{1}, discard a card: draw a card.", cmc: 2, colors: [] };
    const redOutlet = { name: "Red Outlet", type: "artifact", text: "{1}, discard a card: draw a card.", cmc: 2, colors: ["R"] };
    const land = { name: "Cavern", type: "land", text: "{t}, discard a card: add {c}.", cmc: 0, colors: [] };
    const filler = { name: "Filler", type: "creature — bear", text: "", cmc: 2, colors: ["W"] };
    const owned = new Map([
      [normalizeCardName("Outlet"), outlet],
      [normalizeCardName("Red Outlet"), redOutlet],
      [normalizeCardName("Cavern"), land],
      [normalizeCardName("Filler"), filler]
    ]);
    const names = addEngineCandidates(new Map(), needs, owned, ["W", "B"]);
    assertTrue(names.has(normalizeCardName("Outlet")), "legal enabler added");
    assertTrue(!names.has(normalizeCardName("Red Outlet")), "off-color enabler skipped");
    assertTrue(!names.has(normalizeCardName("Cavern")), "lands skipped");
    assertTrue(!names.has(normalizeCardName("Filler")), "non-enabler skipped");
    assertEqual(names.get(normalizeCardName("Outlet")), { rank: 0, hits: 1 });
  },
  "addEngineCandidates: an existing theme match keeps a top rank and gains hits": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const outlet = { name: "Outlet", type: "artifact", text: "{1}, discard a card: draw a card.", cmc: 2, colors: [] };
    const owned = new Map([[normalizeCardName("Outlet"), outlet]]);
    const existing = new Map([[normalizeCardName("Outlet"), { rank: 2, hits: 1 }]]);
    addEngineCandidates(existing, needs, owned, ["W", "B"]);
    assertEqual(existing.get(normalizeCardName("Outlet")), { rank: 0, hits: 2 });
  },
  "addEngineCandidates: surveil-only, sacrifice-only and crewBody-only cards are not injected": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const seer = { name: "Seer", type: "creature — human", text: "when this creature enters, surveil 2.", cmc: 2, colors: [] };
    const sac = { name: "Sac", type: "artifact", text: "sacrifice a creature: draw a card.", cmc: 2, colors: [] };
    const body = { name: "Body", type: "creature — human", text: "", cmc: 2, colors: [], raw: { power: "3" } };
    const outlet = { name: "Outlet", type: "artifact", text: "{1}, discard a card: draw a card.", cmc: 2, colors: [] };
    const owned = new Map([
      [normalizeCardName("Seer"), seer], [normalizeCardName("Sac"), sac],
      [normalizeCardName("Body"), body], [normalizeCardName("Outlet"), outlet]
    ]);
    const names = addEngineCandidates(new Map(), needs, owned, ["W"]);
    assertTrue(!names.has(normalizeCardName("Seer")), "surveil-only stays out");
    assertTrue(!names.has(normalizeCardName("Sac")), "sacrifice-only stays out");
    assertTrue(!names.has(normalizeCardName("Body")), "crewBody-only stays out");
    assertTrue(names.has(normalizeCardName("Outlet")), "discard still goes in");
  },
  "addEngineCandidates: devotion only pulls in cards with two or more pips": function () {
    const needs = { payloadType: null, graveyard: false, devotionColors: ["U"] };
    const heavy = { name: "Heavy", type: "creature — merfolk", text: "flying", cmc: 2, colors: ["U"], manaCost: "{U}{U}" };
    const light = { name: "Light", type: "creature — merfolk", text: "flying", cmc: 2, colors: ["U"], manaCost: "{1}{U}" };
    const owned = new Map([[normalizeCardName("Heavy"), heavy], [normalizeCardName("Light"), light]]);
    const names = addEngineCandidates(new Map(), needs, owned, ["U"]);
    assertTrue(names.has(normalizeCardName("Heavy")));
    assertTrue(!names.has(normalizeCardName("Light")));
  },
  "addEngineCandidates: no active need leaves the map untouched": function () {
    const none = { payloadType: null, graveyard: false, devotionColors: [] };
    const outlet = { name: "Outlet", type: "artifact", text: "{1}, discard a card: draw a card.", cmc: 2, colors: [] };
    const names = addEngineCandidates(new Map(), none, new Map([[normalizeCardName("Outlet"), outlet]]), ["W"]);
    assertEqual(names.size, 0);
  },
  "listEngineEnablers: names deck cards that carry an engine class": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const outlet = { name: "Outlet", type: "artifact", text: "{1}, discard a card: draw a card.", cmc: 2, colors: [] };
    const filler = { name: "Filler", type: "creature — bear", text: "", cmc: 2, colors: [] };
    const owned = new Map([[normalizeCardName("Outlet"), outlet], [normalizeCardName("Filler"), filler]]);
    const deck = [{ name: "Outlet", role: "synergy" }, { name: "Filler", role: "synergy" }, { name: "Plains", role: "land" }];
    assertEqual(listEngineEnablers(deck, owned, needs), ["Outlet"]);
    assertEqual(listEngineEnablers(deck, owned, { payloadType: null, graveyard: false, devotionColors: [] }), []);
  },
  "getEngineLandBonus: a land that names the payload type gets a lift, others do not": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const roads = { name: "Foul Roads", type: "land", text: "this land enters tapped unless you control a mount or vehicle. {t}: add {b}.", cmc: 0 };
    const plain = { name: "Swamp-ish", type: "land", text: "{t}: add {b}.", cmc: 0 };
    const spell = { name: "Spell", type: "sorcery", text: "vehicle vehicle vehicle.", cmc: 2 };
    assertEqual(getEngineLandBonus(roads, needs), ENGINE_LAND_BONUS);
    assertEqual(getEngineLandBonus(plain, needs), 0);
    assertEqual(getEngineLandBonus(spell, needs), 0, "only lands");
    assertEqual(getEngineLandBonus(roads, { payloadType: null, graveyard: false, devotionColors: [] }), 0);
    assertEqual(getEngineLandBonus(roads, undefined), 0);
    assertEqual(getEngineLandBonus(null, needs), 0);
  },
  "describeEngineNeeds: a readable label per need": function () {
    assertEqual(describeEngineNeeds({ payloadType: "vehicle", graveyard: true, devotionColors: [] }), "Engine enablers for Vehicle in the graveyard");
    assertEqual(describeEngineNeeds({ payloadType: "zombie", graveyard: false, devotionColors: [] }), "Engine enablers for Zombie");
    assertEqual(describeEngineNeeds({ payloadType: null, graveyard: false, devotionColors: ["U", "B"] }), "Engine enablers for devotion to U/B");
    assertEqual(describeEngineNeeds({ payloadType: "vehicle", graveyard: true, devotionColors: ["U"] }), "Engine enablers for Vehicle in the graveyard, devotion to U");
    assertEqual(describeEngineNeeds({ payloadType: null, graveyard: false, devotionColors: [] }), "");
  },
  "parseCommanderNeeds: a type-specific reanimator that says '<Type> creature card'": function () {
    const needs = parseCommanderNeeds(["Return target Knight creature card from your graveyard to the battlefield."]);
    assertEqual(needs.payloadType, "knight");
    assertTrue(needs.graveyard);
    const generic = parseCommanderNeeds(["Return target creature card from your graveyard to the battlefield."]);
    assertEqual(generic.payloadType, null);
  },
  "listEngineEnablers: weak-class-only cards are not listed as enablers": function () {
    const needs = { payloadType: "vehicle", graveyard: true, devotionColors: [] };
    const seer = { name: "Seer", type: "creature — human", text: "when this creature enters, surveil 2.", cmc: 2, colors: [] };
    const body = { name: "Body", type: "creature — human", text: "", cmc: 2, colors: [], raw: { power: "3" } };
    const outlet = { name: "Outlet", type: "artifact", text: "{1}, discard a card: draw a card.", cmc: 2, colors: [] };
    const owned = new Map([[normalizeCardName("Seer"), seer], [normalizeCardName("Body"), body], [normalizeCardName("Outlet"), outlet]]);
    const deck = [{ name: "Seer", role: "synergy" }, { name: "Body", role: "synergy" }, { name: "Outlet", role: "synergy" }];
    assertEqual(listEngineEnablers(deck, owned, needs), ["Outlet"]);
  },
  "parseCommanderNeeds: returnsFromGraveyard is set for Greasefang, not for Tormod": function () {
    assertTrue(parseCommanderNeeds(["Return target Vehicle card from your graveyard to the battlefield."]).returnsFromGraveyard);
    assertTrue(!parseCommanderNeeds(["Whenever one or more cards leave your graveyard, create a tapped 2/2 black Zombie creature token."]).returnsFromGraveyard);
  },
  "getEngineClasses: a discard outlet that exiles the discarded card is anti-synergy for a returning engine": function () {
    const bag = {
      name: "Bag-shaped", type: "artifact",
      text: "whenever you discard a card, exile that card from your graveyard.\n{2}, {t}: draw a card, then discard a card.\n{4}, {t}, sacrifice this artifact: return all cards exiled with this artifact to their owner's hand.",
      cmc: 1
    };
    const returning = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    const leaving = { payloadType: "zombie", graveyard: true, returnsFromGraveyard: false, devotionColors: [] };
    assertEqual(getEngineClasses(bag, returning), [], "exiling the discarded Vehicle defeats Greasefang");
    assertTrue(getEngineClasses(bag, leaving).includes("discard"), "exile-on-discard does not hurt a leaves-the-graveyard engine");
  },
  "getEngineClasses: creature-card recursion cannot return a Vehicle": function () {
    const needs = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    const creatureOnly = { name: "Raise-shaped", type: "instant", text: "return target creature card from your graveyard to your hand.", cmc: 2 };
    const permanentOk = { name: "Permanent-shaped", type: "sorcery", text: "return target permanent card from your graveyard to the battlefield.", cmc: 4 };
    assertTrue(!getEngineClasses(creatureOnly, needs).includes("recursionGeneric"), "a Vehicle card is not a creature card in the graveyard");
    assertTrue(getEngineClasses(permanentOk, needs).includes("recursionGeneric"));
    const zombie = { payloadType: "zombie", graveyard: true, returnsFromGraveyard: false, devotionColors: [] };
    assertTrue(getEngineClasses(creatureOnly, zombie).includes("recursionGeneric"), "creature recursion still helps a Zombie deck");
  },
  "getCrewCost: reads the crew number": function () {
    assertEqual(getCrewCost({ text: "flying. crew 3" }), 3);
    assertEqual(getCrewCost({ text: "no crew here" }), null);
    assertEqual(getCrewCost({}), null);
  },
  "countDevotionPips: counts plain and hybrid pips of one color": function () {
    assertEqual(countDevotionPips({ manaCost: "{1}{U}{U}" }, "U"), 2);
    assertEqual(countDevotionPips({ manaCost: "{U/R}{U/R}" }, "U"), 2);
    assertEqual(countDevotionPips({ manaCost: "{2/U}" }, "U"), 1);
    assertEqual(countDevotionPips({ manaCost: "{X}{R}" }, "U"), 0);
    assertEqual(countDevotionPips({}, "U"), 0);
  }
  ,
  "isGraveyardHostile: exiling the discarded card or a whole graveyard is hostile": function () {
    const bag = { name: "Bag-shaped", type: "artifact", text: "whenever you discard a card, exile that card from your graveyard.\n{2}, {t}: draw a card, then discard a card." };
    const construct = { name: "Construct-shaped", type: "artifact", text: "whenever you discard a card, you may exile that card from your graveyard. if you do, you may play that card this turn." };
    const lantern = { name: "Lantern-shaped", type: "artifact", text: "when this artifact enters, exile target card from a graveyard.\n{1}, {t}, exile this artifact: exile all cards from all graveyards, then draw a card." };
    assertTrue(isGraveyardHostile(bag), "Bag of Holding");
    assertTrue(isGraveyardHostile(construct), "Containment Construct");
    assertTrue(isGraveyardHostile(lantern), "Lantern of the Lost");
  },
  "isGraveyardHostile: spending graveyard cards as fuel is not a veto": function () {
    const drake = { name: "Drake-shaped", type: "creature — drake", text: "as an additional cost to cast this spell, exile a creature card from your graveyard.\nflying" };
    const argument = { name: "Argument-shaped", type: "instant", text: "this spell deals 6 damage to target creature. you may exile a card from your graveyard. if you do, this spell also deals 2 damage to that creature's controller." };
    const looter = { name: "Looter-shaped", type: "creature — human", text: "whenever this creature attacks, draw a card, then discard a card." };
    assertTrue(!isGraveyardHostile(drake), "Stitched Drake");
    assertTrue(!isGraveyardHostile(argument), "Heated Argument");
    assertTrue(!isGraveyardHostile(looter), "a plain looter");
  },
  "parseCommanderNeeds: a put-onto-the-battlefield reanimator reads its type and zone": function () {
    const needs = parseCommanderNeeds(["Whenever a creature dies, put target Zombie card from your graveyard onto the battlefield."]);
    assertEqual(needs.payloadType, "zombie");
    assertTrue(needs.returnsFromGraveyard, "it returns cards from your graveyard");
  },
  "parseCommanderNeeds: a return clause naming two types reads no payload": function () {
    const needs = parseCommanderNeeds(["Return target creature or Vehicle card from your graveyard to your hand."]);
    assertEqual(needs.payloadType, null);
    assertTrue(needs.returnsFromGraveyard);
  },
  "parseCommanderNeeds: a bare text with a comma in a name still parses": function () {
    const needs = parseCommanderNeeds(["Whenever Greasefang, Okiba Boss attacks, return target Vehicle card from your graveyard to the battlefield."]);
    assertEqual(needs.payloadType, "vehicle");
  }
  ,
  "getEngineClasses: a discard limited to creature cards is no outlet for a Vehicle but is for a Zombie": function () {
    const maggots = { name: "Maggots-shaped", type: "creature — insect", text: "when this creature enters, discard any number of creature cards. for each card discarded this way, put two +1/+1 counters on this creature.", cmc: 4 };
    const vehicle = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    const zombie = { payloadType: "zombie", graveyard: true, returnsFromGraveyard: false, devotionColors: [] };
    assertTrue(getEngineClasses(maggots, vehicle).indexOf("discard") === -1, "a Vehicle is not a creature card");
    assertTrue(getEngineClasses(maggots, zombie).indexOf("discard") !== -1, "a Zombie is a creature card");
  },
  "getEngineClasses: a looter that says 'you may draw a card. if you do, discard a card' is a discard outlet": function () {
    const copter = { name: "Copter-shaped", type: "artifact — vehicle", text: "flying\nwhenever this vehicle attacks or blocks, you may draw a card. if you do, discard a card.\ncrew 1", cmc: 2 };
    const needs = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    assertTrue(getEngineClasses(copter, needs).indexOf("discard") !== -1);
  },
  "getEngineClasses: dredge returns a card from the graveyard, it is not self-mill": function () {
    const darkblast = { name: "Darkblast-shaped", type: "instant", text: "target creature gets -1/-1 until end of turn.\ndredge 3", cmc: 1 };
    const needs = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    assertTrue(getEngineClasses(darkblast, needs).indexOf("selfMill") === -1);
  },
  "getEngineClasses: a mill-then-return-either-type card is specific recursion plus self-mill": function () {
    const cruiser = { name: "Cruiser-shaped", type: "artifact — vehicle", text: "when this vehicle enters, mill two cards. then return a creature or vehicle card from your graveyard to your hand.\ncrew 1", cmc: 3 };
    const needs = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    const classes = getEngineClasses(cruiser, needs);
    assertTrue(classes.indexOf("recursion") !== -1 && classes.indexOf("selfMill") !== -1 && classes.indexOf("payload") !== -1);
  },
  "getEngineClasses: recursion counts by what it can return": function () {
    const vehicle = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    const zombie = { payloadType: "zombie", graveyard: true, returnsFromGraveyard: false, devotionColors: [] };
    const reclaimer = { name: "Reclaimer-shaped", type: "creature — angel", text: "when this creature enters, return target noncreature, nonland permanent card with mana value x or less from your graveyard to the battlefield, where x is the amount of mana spent to cast this creature.", cmc: 3 };
    const anyCard = { name: "Regrowth-shaped", type: "sorcery", text: "return target card from your graveyard to your hand.", cmc: 2 };
    const topOfLibrary = { name: "Thug-shaped", type: "creature — human", text: "when this creature dies, put target creature card from your graveyard on top of your library.", cmc: 3 };
    assertTrue(getEngineClasses(reclaimer, vehicle).indexOf("recursionGeneric") !== -1, "noncreature permanents include Vehicles");
    assertTrue(getEngineClasses(reclaimer, zombie).indexOf("recursionGeneric") === -1, "noncreature permanents never include Zombies");
    assertTrue(getEngineClasses(anyCard, vehicle).indexOf("recursionGeneric") !== -1, "an unrestricted card includes Vehicles");
    assertTrue(getEngineClasses(topOfLibrary, zombie).indexOf("recursionGeneric") === -1, "to the library is not returned to hand or battlefield");
  },
  "getEngineClassDetails: 'target player discards' is a weak discard, a plain loot is not": function () {
    const needs = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    const burglar = { name: "Burglar-shaped", type: "creature — rogue", text: "{2}{b}, {t}: target player discards a card. activate only as a sorcery.", cmc: 2 };
    const looter = { name: "Looter-shaped", type: "creature — human", text: "whenever this creature attacks, draw a card, then discard a card.", cmc: 2 };
    const burgled = getEngineClassDetails(burglar, needs).find((d) => d.cls === "discard");
    const looted = getEngineClassDetails(looter, needs).find((d) => d.cls === "discard");
    assertTrue(burgled && burgled.weak, "can hit an opponent, so weak");
    assertTrue(looted && !looted.weak, "repeatable and free");
  },
  "getAbilityStrength: cost per use decides weak, not just whether it repeats": function () {
    const card = (text, type, cmc) => ({ name: "Test Card", type: type, text: text, cmc: cmc });
    const strength = (c) => getAbilityStrength(getCardAbilities(c)[0], c);
    assertTrue(!strength(card("{1}, {t}: draw a card, then discard a card.", "artifact", 2)).weak, "{1} repeatable");
    assertTrue(!strength(card("{2}, {t}: draw a card, then discard a card.", "artifact", 2)).weak, "{2} repeatable");
    assertTrue(strength(card("{3}, {t}: draw a card, then discard a card.", "artifact", 2)).weak, "{3} repeatable");
    assertTrue(!strength(card("mill three cards.", "sorcery", 2)).weak, "cheap one-shot");
    assertTrue(!strength(card("mill three cards.", "sorcery", 3)).weak, "mana value 3 one-shot");
    assertTrue(strength(card("mill three cards.", "sorcery", 5)).weak, "expensive one-shot");
    assertTrue(!strength(card("{2}{b}, sacrifice this creature: mill four cards.", "creature — thrull", 3)).weak, "cheap self-sacrifice one-shot");
  }
  ,
  "getEngineBonus: a flaw costs three points, never more than half the weight": function () {
    const needs = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    const clean = { name: "Clean", type: "artifact", text: "{3}, {t}: draw a card, then discard a card.", cmc: 2 };
    const slow = { name: "Slow", type: "artifact", text: "{3}, {t}: draw a card, then discard a card. activate only as a sorcery.", cmc: 2 };
    const awful = { name: "Awful", type: "artifact", text: "{3}, {t}, tap an untapped creature you control, discard two cards: draw a card, then discard a card. activate only as a sorcery.", cmc: 2 };
    assertEqual(getEngineBonus(clean, needs) - getEngineBonus(slow, needs), 3);
    assertEqual(getEngineBonus(awful, needs), ENGINE_CLASS_WEIGHTS.discard / 2, "floor at half the weight");
  },
  "getEngineBonus: black's life payment and sorcery speed on a cheap repeatable outlet cost nothing": function () {
    const needs = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    const plain = { name: "Plain", type: "artifact", text: "{1}, {t}, discard a card: draw a card, mill a card.", cmc: 2 };
    const mirror = { name: "Mirror", type: "artifact", text: "{1}, {t}, pay 1 life, discard a card: draw a card, mill a card. activate only as a sorcery.", cmc: 2 };
    assertEqual(getEngineClassDetails(mirror, needs).map((d) => d.flaws.length), [0, 0]);
    assertEqual(getEngineBonus(mirror, needs), getEngineBonus(plain, needs));
  },
  "getEngineBonus: a flaw shared by two classes is charged once": function () {
    const needs = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    const base = "{3}, {t}, discard a card: draw a card, mill a card.";
    const clean = { name: "Clean", type: "artifact", text: base, cmc: 2 };
    const slow = { name: "Slow", type: "artifact", text: base + " activate only as a sorcery.", cmc: 2 };
    assertEqual(getEngineClassDetails(slow, needs).length, 2);
    assertEqual(getEngineBonus(clean, needs) - getEngineBonus(slow, needs), 3);
  },
  "addEngineCandidates: an expensive repeatable outlet and a pricey one-shot are scored but not injected": function () {
    const needs = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    const make = (name, type, text, cmc) => [normalizeCardName(name), { name: name, type: type, text: text, cmc: cmc, colors: [] }];
    const owned = new Map([
      make("Cheap Outlet", "artifact", "{1}, {t}: draw a card, then discard a card.", 2),
      make("Costly Outlet", "artifact", "{3}, {t}: draw a card, then discard a card.", 2),
      make("Cheap Mill", "sorcery", "mill three cards.", 2),
      make("Costly Mill", "sorcery", "mill three cards.", 5),
      make("Burglar", "creature — rogue", "{2}{b}, {t}: target player discards a card.", 2)
    ]);
    const tier = addEngineCandidates(new Map(), needs, owned, []);
    assertTrue(tier.has("cheap outlet") && tier.has("cheap mill"), "cheap ones are injected");
    assertTrue(!tier.has("costly outlet") && !tier.has("costly mill") && !tier.has("burglar"), "weak ones are not");
    assertTrue(getEngineBonus(owned.get("costly mill"), needs) > 0, "but a weak enabler still scores");
  },
  "listEngineEnablers: a weak enabler is not listed as the reason a card is in the deck": function () {
    const needs = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    const owned = new Map([
      [normalizeCardName("Costly Mill"), { name: "Costly Mill", type: "sorcery", text: "mill three cards.", cmc: 5, colors: [] }],
      [normalizeCardName("Cheap Mill"), { name: "Cheap Mill", type: "sorcery", text: "mill three cards.", cmc: 2, colors: [] }]
    ]);
    const deck = [{ name: "Costly Mill", role: "spell" }, { name: "Cheap Mill", role: "spell" }];
    assertEqual(listEngineEnablers(deck, owned, needs), ["Cheap Mill"]);
  }
  ,
  "describeEngineEnablers: each enabler comes with the reason it earned a place": function () {
    const needs = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    const owned = new Map([
      [normalizeCardName("Looter"), { name: "Looter", type: "creature — human", text: "whenever this creature attacks, draw a card, then discard a card.", cmc: 2, colors: [] }],
      [normalizeCardName("Mirror"), { name: "Mirror", type: "artifact", text: "{1}, {t}, pay 1 life, discard a card: draw a card, mill a card. activate only as a sorcery.", cmc: 2, colors: [] }],
      [normalizeCardName("Copter"), { name: "Copter", type: "artifact — vehicle", text: "flying\ncrew 1", cmc: 2, colors: [] }]
    ]);
    const deck = [{ name: "Looter", role: "creature" }, { name: "Mirror", role: "artifact" }, { name: "Copter", role: "artifact" }, { name: "Swamp", role: "land" }];
    const items = describeEngineEnablers(deck, owned, needs);
    assertEqual(items.map((i) => i.name), ["Looter", "Mirror", "Copter"]);
    assertEqual(items[0].reason, "discard outlet");
    assertEqual(items[1].flaws, [], "sorcery speed and a life payment on a cheap repeatable are not flaws");
    assertEqual(items[2].reason, "is a Vehicle");
  },
  "describeEngineEnablerItem: a clean card shows its reason, a flawed one shows the flaws": function () {
    assertEqual(describeEngineEnablerItem({ name: "Looter", reason: "discard outlet", flaws: [] }), "Looter (discard outlet)");
    assertEqual(describeEngineEnablerItem({ name: "Mirror", reason: "self-mill", flaws: ["sorcery-speed", "pays life"] }), "Mirror (self-mill; flawed: sorcery-speed, pays life)");
  }
  ,
  "getEngineClasses: a Vehicle that also taps for mana is a payload that ramps, and out-scores a plain Vehicle": function () {
    const needs = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    const caravan = { name: "Caravan-shaped", type: "artifact — vehicle", text: "{t}: add one mana of any color.\ncrew 3", cmc: 3 };
    const plain = { name: "Plain Vehicle", type: "artifact — vehicle", text: "trample, haste\ncrew 2", cmc: 3 };
    const rock = { name: "Rock", type: "artifact", text: "{t}: add one mana of any color.", cmc: 3 };
    assertTrue(getEngineClasses(caravan, needs).indexOf("payloadRamp") !== -1);
    assertTrue(getEngineClasses(plain, needs).indexOf("payloadRamp") === -1, "no mana, no ramp");
    assertTrue(getEngineClasses(rock, needs).indexOf("payloadRamp") === -1, "a rock is not a Vehicle");
    const insectNeeds = { payloadType: "insect", graveyard: false, returnsFromGraveyard: false, devotionColors: [] };
    const manaInsect = { name: "Mana Insect", type: "creature — insect", text: "{t}: add {g}.", cmc: 2 };
    assertTrue(getEngineClasses(manaInsect, insectNeeds).indexOf("payloadRamp") === -1, "typal creature payloads are Phase 2's typal rework");
    assertTrue(getEngineBonus(caravan, needs) > getEngineBonus(plain, needs));
    assertEqual(describeEngineEnablers([{ name: "Caravan-shaped", role: "artifact" }], new Map([[normalizeCardName("Caravan-shaped"), caravan]]), needs)[0].reason, "is a Vehicle that ramps");
  }
  ,
  "parseCommanderNeeds events: the seven commanders and Tormod each read their own event": function () {
    const events = (texts) => parseCommanderNeeds(texts).events.map((e) => e.event + (e.direction ? ":" + e.direction : ""));
    assertEqual(events(["When Old Rutstein enters and at the beginning of your upkeep, mill a card. If a land card is milled this way, create a Treasure token."]), ["mill:self"]);
    assertEqual(events(["Landfall — Whenever a land you control enters, create a 5/5 red and green Elemental creature token.\nWhenever Omnath or another Elemental you control dies, Omnath deals 3 damage to any target."]), ["landfall"]);
    assertEqual(events(["At the beginning of your end step, create a tapped 0/1 black Wizard creature token with \"Whenever you cast a noncreature spell, this creature deals 1 damage to each opponent.\""]), ["cast-noncreature"]);
    assertEqual(events(["Whenever a player draws their second card during their turn, you draw a card.\nWhenever a player casts their second spell during their turn, you create a 2/2 white Knight creature token."]), ["draw-second", "cast-second"]);
    assertEqual(events(["Increment\nWhenever one or more +1/+1 counters are put on Berta, add one mana of any color."]), ["cast-bigger", "counter-placed"]);
    assertEqual(events(["Whenever you draw a card, put a +1/+1 counter on The Astonishing Ant-Man."]), ["draw"]);
    assertEqual(events(["At the beginning of your first main phase, exile target card from a graveyard. If it was a land card, add {R} or {G}."]), ["graveyard-fill"]);
    assertEqual(events(["Whenever one or more cards leave your graveyard, create a tapped 2/2 black Zombie creature token."]), ["leave-graveyard"]);
  },
  "parseCommanderNeeds events: Greasefang runs on no event, and a solo commander's missing partner text is fine": function () {
    const needs = parseCommanderNeeds(["Whenever Greasefang, Okiba Boss attacks, return target Vehicle card from your graveyard to the battlefield.", undefined]);
    assertEqual(needs.events, []);
    assertEqual(needs.payloadType, "vehicle");
    assertEqual(parseCommanderNeeds([]).events, []);
  },
  "parseCommanderNeeds events: whose library a mill hits decides its direction": function () {
    const dir = (text) => parseCommanderNeeds([text]).events[0].direction;
    assertEqual(dir("At the beginning of your upkeep, mill a card."), "self");
    assertEqual(dir("Whenever this creature attacks, each opponent mills two cards."), "opponent");
    assertEqual(dir("At the beginning of your upkeep, target player mills three cards."), "any");
  },
  "parseCommanderNeeds: devotion colors come from the labels, one color or two": function () {
    assertEqual(parseCommanderNeeds(["As long as your devotion to red and green is less than seven, this permanent isn't a creature."]).devotionColors, ["R", "G"]);
    assertEqual(parseCommanderNeeds(["Whenever you cast a spell, if your devotion to blue is five or more, draw a card."]).devotionColors, ["U"]);
  }
  ,
  "getEventProducers: landfall is extra land drops, land fetch and ramp, and landfall cards": function () {
    const needs = parseCommanderNeeds(["Landfall — Whenever a land you control enters, create a 5/5 red and green Elemental creature token."]);
    const make = (name, type, text, cmc) => ({ name: name, type: type, text: text, cmc: cmc, manaCost: "" });
    const via = (c) => getEventProducers(c, needs).map((p) => p.event + ":" + p.via);
    assertEqual(via(make("Cultivate", "sorcery", "search your library for up to two basic land cards, put one onto the battlefield tapped and the other into your hand, then shuffle.", 3)), ["landfall:puts a land onto the battlefield"]);
    assertEqual(via(make("Explore-shaped", "sorcery", "you may play an additional land this turn.\ndraw a card.", 2)), ["landfall:puts a land onto the battlefield"]);
    assertEqual(via(make("Hellkite-shaped", "creature — dragon", "landfall — whenever a land you control enters, this creature gets +2/+0 until end of turn.", 5)), ["landfall:landfall card"]);
    assertEqual(via(make("Vanilla", "creature — bear", "trample", 2)), []);
    assertEqual(via(make("Wilds", "land", "{t}, sacrifice this land: search your library for a basic land card, put it onto the battlefield tapped.", 0)), []);
  },
  "getEventProducers: draws feed a draw event, cost per use decides weak": function () {
    const needs = parseCommanderNeeds(["Whenever you draw a card, put a +1/+1 counter on this creature."]);
    const make = (name, type, text, cmc) => ({ name: name, type: type, text: text, cmc: cmc, manaCost: "" });
    const cantrip = getEventProducers(make("Cantrip", "instant", "draw a card.", 1), needs)[0];
    assertEqual(cantrip.event, "draw");
    assertTrue(!cantrip.weak, "a cheap cantrip is full strength");
    assertTrue(getEventProducers(make("Big Draw", "sorcery", "draw three cards.", 5), needs)[0].weak, "a mana value 5 one-shot is weak");
    assertTrue(!getEventProducers(make("Looter", "creature — human", "whenever this creature attacks, draw a card, then discard a card.", 2), needs)[0].weak, "a repeatable loot");
    assertEqual(getEventProducers(make("Bear", "creature — bear", "trample", 2), needs), []);
  },
  "getEventProducers: a mill hits the library the commander wants hit": function () {
    const self = parseCommanderNeeds(["At the beginning of your upkeep, mill a card."]);
    const opp = parseCommanderNeeds(["Whenever this creature attacks, each opponent mills two cards."]);
    const make = (name, text) => ({ name: name, type: "sorcery", text: text, cmc: 2, manaCost: "" });
    const selfMill = make("Self Mill", "mill three cards.");
    const oppMill = make("Opp Mill", "target opponent mills three cards.");
    const either = make("Either", "target player mills three cards.");
    const count = (card, needs) => getEventProducers(card, needs).length;
    assertEqual([count(selfMill, self), count(oppMill, self), count(either, self)], [1, 0, 1]);
    assertEqual([count(selfMill, opp), count(oppMill, opp), count(either, opp)], [0, 1, 1]);
  },
  "getEventProducers: instants and sorceries are noncreature spells, permanents only weakly": function () {
    const needs = parseCommanderNeeds(["At the beginning of your end step, create a tapped 0/1 black Wizard creature token with \"Whenever you cast a noncreature spell, this creature deals 1 damage to each opponent.\""]);
    const make = (name, type, cmc) => ({ name: name, type: type, text: "", cmc: cmc, manaCost: "" });
    const one = (card) => getEventProducers(card, needs)[0];
    assertTrue(!one(make("Bolt", "instant", 1)).weak);
    assertTrue(one(make("Big Sorcery", "sorcery", 5)).weak, "mana value 5 one-shot");
    assertEqual(one(make("Rock", "artifact", 2)).via, "noncreature permanent");
    assertTrue(one(make("Rock", "artifact", 2)).weak);
    assertEqual(getEventProducers(make("Bear", "creature — bear", 2), needs), []);
    assertEqual(getEventProducers(make("Forest", "basic land — forest", 0), needs), []);
  },
  "getEventProducers: graveyard leavers include dredge and flashback keywords": function () {
    const needs = parseCommanderNeeds(["Whenever one or more cards leave your graveyard, create a tapped 2/2 black Zombie creature token."]);
    const make = (name, type, text, cmc) => ({ name: name, type: type, text: text, cmc: cmc, manaCost: "" });
    const via = (c) => getEventProducers(c, needs).map((p) => p.via);
    assertEqual(via(make("Thug", "creature — beast", "dredge 4", 4)), ["dredge"]);
    assertEqual(via(make("Burn Twice", "instant", "deal 3 damage to any target.\nflashback {4}{r}", 2)), ["flashback"]);
    assertEqual(via(make("Raise", "sorcery", "return target creature card from your graveyard to your hand.", 2)), ["returns a card from your graveyard"]);
    assertEqual(via(make("Bear", "creature — bear", "trample", 2)), []);
  },
  "getEventProducers: counters, graveyard fill, X spells and cheap second spells": function () {
    const make = (name, type, text, cmc, cost) => ({ name: name, type: type, text: text, cmc: cmc, manaCost: cost || "" });
    const counters = parseCommanderNeeds(["Whenever one or more +1/+1 counters are put on Berta, add one mana of any color."]);
    assertEqual(getEventProducers(make("Grow", "instant", "put a +1/+1 counter on target creature.", 1), counters)[0].via, "puts counters on a creature");
    const fill = parseCommanderNeeds(["At the beginning of your first main phase, exile target card from a graveyard."]);
    assertEqual(getEventProducers(make("Digger", "sorcery", "mill three cards.", 2), fill)[0].via, "fills a graveyard");
    assertEqual(getEventProducers(make("Surveil Two", "sorcery", "surveil 2.", 2), fill)[0].weak, true);
    const bigger = parseCommanderNeeds(["Increment"]);
    const xSpell = getEventProducers(make("Fireball", "sorcery", "deal x damage to any target.", 1, "{X}{R}"), bigger)[0];
    assertEqual(xSpell.via, "X spell");
    assertTrue(xSpell.weak, "you choose X, so an X spell is a flexible producer, not a solid one");
    const titan = getEventProducers(make("Titan", "creature — giant", "trample", 6), bigger)[0];
    assertEqual(titan.via, "big spell");
    assertTrue(!titan.weak, "a base cost of 5 or more is solid");
    assertEqual(getEventProducers(make("Small", "instant", "draw a card.", 3), bigger), []);
    const second = parseCommanderNeeds(["Whenever a player casts their second spell during their turn, you create a 2/2 white Knight creature token."]);
    assertEqual(getEventProducers(make("Cheap", "instant", "draw a card.", 1), second)[0].via, "cheap spell");
    assertEqual(getEventProducers(make("Dear", "sorcery", "draw a card.", 4), second), []);
  }
  ,
  "getEventProducers: no events, no needs, no card, or a needs object from before events existed all give nothing": function () {
    const card = { name: "Cantrip", type: "instant", text: "draw a card.", cmc: 1, manaCost: "" };
    assertEqual(getEventProducers(card, { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] }), []);
    assertEqual(getEventProducers(card, { events: [] }), []);
    assertEqual(getEventProducers(card, null), []);
    assertEqual(getEventProducers(null, parseCommanderNeeds(["Whenever you draw a card, put a +1/+1 counter on this creature."])), []);
  }
  ,
  "counter events: Berta wants +1/+1 counters, Denry Klin wants counters of any kind": function () {
    const berta = parseCommanderNeeds(["Whenever one or more +1/+1 counters are put on Berta, add one mana of any color."]);
    assertEqual(berta.events, [{ event: "counter-placed", counter: "+1/+1" }]);
    const denry = parseCommanderNeeds(["Denry Klin enters with your choice of a +1/+1, first strike, or vigilance counter on it.\nWhenever a nontoken creature you control enters, if Denry Klin has counters on it, put the same number of each kind of counter on that creature."]);
    assertEqual(denry.events, [{ event: "counter-placed", counter: "any" }]);
  },
  "getEventProducers: a counter producer must put the counter kind the commander wants": function () {
    const make = (name, type, text, cmc) => ({ name: name, type: type, text: text, cmc: cmc, manaCost: "" });
    const berta = parseCommanderNeeds(["Whenever one or more +1/+1 counters are put on Berta, add one mana of any color."]);
    const denry = parseCommanderNeeds(["Denry Klin enters with your choice of a +1/+1, first strike, or vigilance counter on it.\nWhenever a nontoken creature you control enters, if Denry Klin has counters on it, put the same number of each kind of counter on that creature."]);
    const grow = make("Grow", "instant", "put a +1/+1 counter on target creature.", 1);
    const strike = make("Strike Boost", "instant", "put a first strike counter on target creature.", 1);
    const chalice = make("Chalice-shaped", "artifact", "this artifact enters with a charge counter on it for each {1} spent to cast it.", 2);
    assertEqual([getEventProducers(grow, berta).length, getEventProducers(strike, berta).length, getEventProducers(chalice, berta).length], [1, 0, 0]);
    assertEqual([getEventProducers(grow, denry).length, getEventProducers(strike, denry).length, getEventProducers(chalice, denry).length], [1, 1, 0], "a charge counter on an artifact is not a counter on a creature");
  }
  ,
  "counter events: Perrie counts the different kinds of counters, so she wants counters of any kind": function () {
    const perrie = parseCommanderNeeds(["When Perrie enters, put a shield counter on target creature.\nWhenever Perrie attacks, target creature you control gains trample and gets +X/+X until end of turn, where X is the number of different kinds of counters among permanents you control."]);
    assertEqual(perrie.events, [{ event: "counter-placed", counter: "any" }]);
  }
  ,
  "getEventProducers: proliferate produces counters, a counter payoff does not": function () {
    const make = (name, type, text, cmc) => ({ name: name, type: type, text: text, cmc: cmc, manaCost: "" });
    const berta = parseCommanderNeeds(["Whenever one or more +1/+1 counters are put on Berta, add one mana of any color."]);
    const denry = parseCommanderNeeds(["Denry Klin enters with your choice of a +1/+1, first strike, or vigilance counter on it.\nWhenever a nontoken creature you control enters, if Denry Klin has counters on it, put the same number of each kind of counter on that creature."]);
    const sage = make("Sage-shaped", "creature — human druid", "whenever a land you control enters, proliferate.", 3);
    const hoplite = make("Hoplite-shaped", "creature — human", "whenever a +1/+1 counter is put on this creature, remove a +1/+1 counter from target creature an opponent controls.", 2);
    assertEqual(getEventProducers(sage, berta).map((p) => p.via), ["proliferates"]);
    assertEqual(getEventProducers(sage, denry).map((p) => p.via), ["proliferates"]);
    assertEqual(getEventProducers(hoplite, berta), [], "a card that reacts to counters is not one that makes them");
    assertEqual(getEventProducers(hoplite, denry), []);
  }
  ,
  "applyEventSwitch: off drops every event, on or no mode keeps them": function () {
    const text = "Landfall — Whenever a land you control enters, create a 5/5 red and green Elemental creature token.";
    assertEqual(applyEventSwitch(parseCommanderNeeds([text]), { eventEngines: false }).events, []);
    assertEqual(applyEventSwitch(parseCommanderNeeds([text]), { eventEngines: true }).events.length, 1);
    assertEqual(applyEventSwitch(parseCommanderNeeds([text]), undefined).events.length, 1);
    assertEqual(applyEventSwitch(null, { eventEngines: false }), null);
  },
  "getEngineBonus: an event producer scores 6, a weak one 3, a bystander 0, and none with the switch off": function () {
    const text = "Landfall — Whenever a land you control enters, create a 5/5 red and green Elemental creature token.";
    const needs = parseCommanderNeeds([text]);
    const make = (name, type, body, cmc) => ({ name: name, type: type, text: body, cmc: cmc, manaCost: "" });
    const cultivate = make("Cultivate-shaped", "sorcery", "search your library for up to two basic land cards, put one onto the battlefield tapped and the other into your hand.", 3);
    const costly = make("Costly Fetch", "sorcery", "search your library for a basic land card, put it onto the battlefield tapped.", 5);
    const bear = make("Bear", "creature — bear", "trample", 2);
    assertEqual(getEngineBonus(cultivate, needs), ENGINE_EVENT_WEIGHT);
    assertEqual(getEngineBonus(costly, needs), ENGINE_EVENT_WEAK_WEIGHT);
    assertEqual(getEngineBonus(bear, needs), 0);
    assertEqual(getEngineBonus(cultivate, applyEventSwitch(parseCommanderNeeds([text]), { eventEngines: false })), 0);
  },
  "getEngineBonus: an event bonus adds to nothing else, so a commander with no event scores as before": function () {
    const vehicle = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [], events: [] };
    const copter = { name: "Copter-shaped", type: "artifact — vehicle", text: "flying\nwhenever this vehicle attacks or blocks, you may draw a card. if you do, discard a card.\ncrew 1", cmc: 2 };
    const noEventsField = { payloadType: "vehicle", graveyard: true, returnsFromGraveyard: true, devotionColors: [] };
    assertEqual(getEngineBonus(copter, vehicle), getEngineBonus(copter, noEventsField));
    assertTrue(getEngineBonus(copter, vehicle) > 0, "the payload and discard classes still score");
  },
  "event producers are scored but never injected into the theme tier or listed as graveyard enablers": function () {
    const needs = parseCommanderNeeds(["Landfall — Whenever a land you control enters, create a 5/5 red and green Elemental creature token."]);
    const owned = new Map([[normalizeCardName("Cultivate-shaped"), { name: "Cultivate-shaped", type: "sorcery", text: "search your library for up to two basic land cards, put one onto the battlefield tapped and the other into your hand.", cmc: 3, colors: [], manaCost: "" }]]);
    assertEqual(addEngineCandidates(new Map(), needs, owned, []).size, 0);
    assertEqual(describeEngineEnablers([{ name: "Cultivate-shaped", role: "ramp" }], owned, needs), []);
    assertEqual(getEngineClasses(owned.get(normalizeCardName("Cultivate-shaped")), needs), ["event:landfall"]);
  }
  ,
  "describeEventProducers: strong producers in the deck with their reason, capped, and null when there are none": function () {
    const needs = parseCommanderNeeds(["Landfall — Whenever a land you control enters, create a 5/5 red and green Elemental creature token."]);
    const fetch = (name) => ({ name: name, type: "sorcery", text: "search your library for a basic land card, put it onto the battlefield tapped.", cmc: 2, colors: [], manaCost: "" });
    const owned = new Map([[normalizeCardName("Fetch One"), fetch("Fetch One")], [normalizeCardName("Fetch Two"), fetch("Fetch Two")], [normalizeCardName("Fetch Three"), fetch("Fetch Three")],
      [normalizeCardName("Bear"), { name: "Bear", type: "creature — bear", text: "trample", cmc: 2, colors: [], manaCost: "" }]]);
    const deck = [{ name: "Fetch One", role: "ramp" }, { name: "Fetch Two", role: "ramp" }, { name: "Fetch Three", role: "ramp" }, { name: "Bear", role: "creature" }, { name: "Forest", role: "land" }];
    const note = describeEventProducers(deck, owned, needs, 2);
    assertEqual(note.label, "Event engines (landfall)");
    assertEqual(note.items.map((i) => i.name), ["Fetch One", "Fetch Two"]);
    assertEqual(note.items[0].reason, "puts a land onto the battlefield");
    assertEqual(note.more, 1);
    assertEqual(describeEventProducers([{ name: "Bear", role: "creature" }], owned, needs), null);
    assertEqual(describeEventProducers(deck, owned, parseCommanderNeeds(["Flying"])), null);
    assertEqual(describeEventProducers(deck, owned, applyEventSwitch(parseCommanderNeeds(["Landfall — Whenever a land you control enters, create a token."]), { eventEngines: false })), null);
  },
  "planPayloadVehicles: lifts the creature target and returns how many vehicles it can crew": function () {
    const needs = parseCommanderNeeds(["return target Vehicle card from your graveyard to the battlefield."]);
    const bucket = { target: 15, min: 15 };
    const ceiling = planPayloadVehicles(bucket, needs);
    assertEqual(bucket.target, ENGINE_VEHICLE_PLAN_CREATURES);
    assertEqual(ceiling, Math.floor(ENGINE_VEHICLE_PLAN_CREATURES / ENGINE_CREATURES_PER_VEHICLE));
    const both = { target: 30, min: 15 };
    assertEqual(planPayloadVehicles(both, parseCommanderNeeds(["Mounts and Vehicles you control have hexproof."])), Math.floor(30 / ENGINE_CREATURES_PER_VEHICLE));
    assertEqual(both.target, 30);
  },
  "planPayloadVehicles: lifts the artifact target so the average list does not cut the best vehicles": function () {
    const needs = parseCommanderNeeds(["Mounts and Vehicles you control have hexproof."]);
    const art = { target: 12, min: 1 };
    planPayloadVehicles({ target: 29, min: 20 }, needs, art);
    assertEqual(art.target, ENGINE_VEHICLE_PLAN_ARTIFACTS);
    const big = { target: 20, min: 1 };
    planPayloadVehicles({ target: 29, min: 20 }, needs, big);
    assertEqual(big.target, 20);
    const none = { target: 12, min: 1 };
    planPayloadVehicles({ target: 29, min: 20 }, parseCommanderNeeds(["Flying"]), none);
    assertEqual(none.target, 12);
  },
  "dropSpareVehicles: removes non-creature vehicles from every pool and nothing else": function () {
    const mk = () => [{ name: "Hull", type: "artifact — vehicle" }, { name: "Bear", type: "creature — bear" }, { name: "Walker", type: "artifact creature — vehicle" }];
    const a = mk();
    const b = mk();
    dropSpareVehicles([a, b]);
    assertEqual(a.map((c) => c.name), ["Bear", "Walker"]);
    assertEqual(b.map((c) => c.name), ["Bear", "Walker"]);
  },
  "getEngineBonus: a crew 5+ vehicle is nudged down, not excluded": function () {
    const needs = parseCommanderNeeds(["return target Vehicle card from your graveyard to the battlefield."]);
    const mk = (crew) => ({ name: `Hull ${crew}`, type_line: "artifact — vehicle", type: "artifact — vehicle", oracle_text: `Crew ${crew}`, cmc: 3, colors: [] });
    assertTrue(getEngineBonus(mk(2), needs) > getEngineBonus(mk(4), needs), "crew 2 should outscore crew 4");
    assertTrue(getEngineBonus(mk(4), needs) > getEngineBonus(mk(6), needs), "crew 4 should outscore crew 6");
    assertTrue(getEngineBonus(mk(6), needs) > 0, "crew 6 should still score as a payload");
  },
  "parseCommanderNeeds: Miriam names Mounts and Vehicles, so both are payloads": function () {
    const needs = parseCommanderNeeds(["During your turn, Mounts and Vehicles you control have hexproof. Whenever a Mount or Vehicle you control attacks, put a +1/+1 counter on it."]);
    assertEqual(needs.payloadType, "vehicle");
    assertEqual(needs.payloadTypes, ["vehicle", "mount"]);
    assertEqual(describeEngineNeeds(needs), "Engine enablers for Vehicle and Mount");
  },
  "parseCommanderNeeds: a commander that names neither has no payload types": function () {
    assertEqual(parseCommanderNeeds(["Flying. Whenever this attacks, you gain an amount of life equal to its power."]).payloadTypes, []);
    assertEqual(parseCommanderNeeds(["return target Vehicle card from your graveyard to the battlefield."]).payloadTypes, ["vehicle"]);
  },
  "engines: a Mount scores as a payload for a Mount-and-Vehicle commander and the Roads land gets the land bonus": function () {
    const needs = parseCommanderNeeds(["Mounts and Vehicles you control have hexproof."]);
    const mount = { name: "Steed", type: "creature — horse mount", text: "Saddle 1", oracle_text: "Saddle 1", cmc: 3, colors: ["W"] };
    assertTrue(getEngineClassDetails(mount, needs).some((d) => d.cls === "payload"), "a Mount should read as the payload");
    const road = { name: "Wild Roads", type: "land", text: "This land enters tapped unless you control a Mount or Vehicle. {T}: Add {G}.", oracle_text: "This land enters tapped unless you control a Mount or Vehicle. {T}: Add {G}.", cmc: 0, colors: ["G"] };
    assertTrue(getEngineLandBonus(road, needs) > 0, "Roads land should get the payload land bonus");
    const mountOnly = parseCommanderNeeds(["Whenever a Mount you control attacks, draw a card."]);
    assertEqual(mountOnly.payloadTypes, ["mount"]);
    assertEqual(mountOnly.payloadType, "mount");
  },
  "getCrewPower: power, toughness-crew and boosted-crew creatures": function () {
    const mk = (power, toughness, text) => ({ name: "Crewmate", oracle_text: text, raw: { power: String(power), toughness: String(toughness) } });
    assertEqual(getCrewPower(mk(2, 2, "")), 2);
    assertEqual(getCrewPower(mk(0, 6, "This creature crews Vehicles using its toughness rather than its power.")), 6);
    assertEqual(getCrewPower(mk(2, 1, "This creature crews Vehicles as though its power were 2 greater.")), 4);
    assertEqual(getCrewPower(mk(1, 1, "When this enters, create a Pilot token with \"This token crews Vehicles as though its power were 2 greater.\"")), 1);
    assertTrue(Number.isNaN(getCrewPower({ name: "Fixture", oracle_text: "" })), "unknown power should read NaN");
  },
  "planPayloadVehicles: a commander with no vehicle payload is untouched": function () {
    const bucket = { target: 15, min: 15 };
    assertEqual(planPayloadVehicles(bucket, parseCommanderNeeds(["Flying"])), 0);
    assertEqual(planPayloadVehicles(bucket, parseCommanderNeeds(["Whenever a Mount you control attacks, draw a card."])), 0);
    assertEqual(bucket.target, 15);
  },
});
