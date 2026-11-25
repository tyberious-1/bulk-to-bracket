// Commander plan rules for plan_check.js. One entry per commander (full card name): the game events that show its plan
// running. Add a commander here; plan_check.js itself does not change. A commander with no entry still gets the generic
// checks (its own triggers, casts of creature types its text names), and so does every commander: do not repeat those here.
//
// A rule: { label, on, when(e, h), amount?(e) }. `on` is the event kind:
//   cast    { card }                       a spell the deck cast
//   attack  { card, id }                   one attacker the deck declared
//   damage  { card, id, amount }           combat damage to a player by the deck's creature
//   resolve { text }                       a resolving ability on the deck's turn (or its phase tag)
//   trigger { source }                     "X triggered <source>" on the stack
//   attach  { card, target, id, ownTarget } an Aura or Equipment attached on the deck's turn
//   putIn   { card, id }                   a creature that showed up in combat without being declared (put in attacking)
// h: typeOf(name), cmcOf(name), suited(id) (wears an Aura/Equipment the deck attached).
const has = (re) => (name, h) => re.test(h.typeOf(name));
const belloAnimates = (name, h) => {
  const t = h.typeOf(name);
  return /Artifact|Enchantment/.test(t) && !/Creature|Equipment|Aura/.test(t) && h.cmcOf(name) >= 4;
};

module.exports = {
  "Bello, Bard of the Brambles": [
    { label: "4+ MV noncreature artifacts/enchantments cast", on: "cast", when: (e, h) => belloAnimates(e.card, h) },
    { label: "Bello-animated attackers", on: "attack", when: (e, h) => belloAnimates(e.card, h) },
    { label: "combat damage by Bello-animated permanents", on: "damage", when: (e, h) => belloAnimates(e.card, h), amount: (e) => e.amount },
    { label: "small crewed Vehicles attacking", on: "attack", when: (e, h) => has(/Vehicle/)(e.card, h) && !belloAnimates(e.card, h) },
  ],
  "Strefan, Maurer Progenitor": [
    { label: "end-step Blood triggers", on: "resolve", when: (e) => /^At the beginning of your end step, create a Blood token for each player/.test(e.text) },
    { label: "Strefan attack triggers", on: "resolve", when: (e) => /^Whenever Strefan attacks/.test(e.text) },
    { label: "Vampires put in attacking (any effect; Strefan's is the usual one)", on: "putIn", when: (e, h) => has(/Vampire/)(e.card, h) },
  ],
  "Galea, Kindler of Hope": [
    { label: "Auras/Equipment cast", on: "cast", when: (e, h) => has(/Aura|Equipment/)(e.card, h) },
    { label: "attachments onto own creatures", on: "attach", when: (e) => e.ownTarget },
    { label: "attachments onto opponents' creatures (removal Auras)", on: "attach", when: (e) => !e.ownTarget },
    { label: "attackers wearing Auras/Equipment", on: "attack", when: (e, h) => h.suited(e.id) },
    { label: "combat damage by suited creatures", on: "damage", when: (e, h) => h.suited(e.id), amount: (e) => e.amount },
  ],
  "Lathril, Blade of the Elves": [
    { label: "Elf tokens from Lathril hits", on: "damage", when: (e) => e.card === "Lathril, Blade of the Elves", amount: (e) => e.amount },
    { label: "ten-Elf drains", on: "resolve", when: (e) => /Each opponent loses 10 life and you gain 10 life/.test(e.text) },
  ],
};
