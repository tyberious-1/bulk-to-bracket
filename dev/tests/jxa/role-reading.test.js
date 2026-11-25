function rrCard(name, type, text) {
  return { name, type, text };
}
function rrRoles(name, type, text) {
  return getCollectionRoles(rrCard(name, type, text)).join(",");
}

runSuite("role-reading", {
  "ramp: any-color and restricted mana abilities count, a mana filter does not": () => {
    assertEqual(rrRoles("Thornbird", "creature — bird", "{T}: Add one mana of any color."), "ramp");
    assertEqual(rrRoles("Pebble Cart", "artifact", "{T}: Add {C}. Spend this mana only to cast artifact spells."), "ramp");
    assertEqual(rrRoles("Colorwheel", "artifact creature — golem", "{2}: Add one mana of any color."), "");
  },

  "ramp: a land onto the battlefield counts, convoke alone does not": () => {
    assertEqual(rrRoles("Lookout", "creature — frog", "When this creature enters, reveal cards from the top of your library until you reveal a land card. Put that card onto the battlefield tapped and the rest on the bottom of your library in a random order."), "ramp");
    assertEqual(rrRoles("Chorus Trick", "instant", "Convoke (Your creatures can help cast this spell.)\nTarget creature gets +2/+2 until end of turn."), "");
  },

  "removal: chip damage, -N/-N on a target, up to one target and airbend count": () => {
    assertEqual(rrRoles("Pinger", "creature — goblin", "Whenever this creature attacks, it deals 1 damage to any target."), "removal");
    assertEqual(rrRoles("Gloom Shade", "creature — shade", "When this creature enters, target creature an opponent controls gets -2/-2 until end of turn."), "removal");
    assertEqual(rrRoles("Sundering Slash", "sorcery", "Destroy up to one target artifact, enchantment, or tapped creature."), "removal");
    assertEqual(rrRoles("Gust Away", "instant", "Airbend target nonland permanent."), "removal");
  },

  "removal: a power drop or your own creature pumped is not removal": () => {
    assertEqual(rrRoles("Dull Aura", "enchantment — aura", "Enchant creature\nEnchanted creature gets -3/-0."), "");
    assertEqual(rrRoles("Growth Spurt", "instant", "Target creature you control gets +2/+2 until end of turn."), "");
  },

  "removal: a one-creature edict is removal, not a wipe": () => {
    assertEqual(rrRoles("Plague Shaman", "creature — human", "When this creature enters, each opponent sacrifices a creature of their choice."), "removal");
  },

  "wipe: mass toughness drop, mass exile and a hard sweep count; -1/-1 and power drops do not": () => {
    assertEqual(rrRoles("Grim Tide", "sorcery", "All creatures get -2/-2 until end of turn."), "wipe");
    assertEqual(rrRoles("Quiet End", "sorcery", "Exile all creatures and Spacecraft."), "wipe");
    assertEqual(rrRoles("Mutual Rain", "sorcery", "Mutual Rain deals 3 damage to each creature."), "wipe");
    assertEqual(rrRoles("Mild Mist", "sorcery", "All creatures get -1/-1 until end of turn."), "");
    assertEqual(rrRoles("Blunt Wave", "instant", "Creatures your opponents control get -4/-0 until end of turn."), "");
  },

  "wipe: one-sided sweepers count, a wipe of only your own creatures does not": () => {
    assertEqual(rrRoles("Foe Fade", "sorcery", "Creatures your opponents control get -3/-3 until end of turn."), "wipe");
    assertEqual(rrRoles("Self Purge", "sorcery", "Destroy all creatures you control."), "");
  },

  "getCollectionRoles: lands have no role, roles come back in a fixed order": () => {
    assertEqual(rrRoles("Mana Pit", "land", "{T}: Add {G}."), "");
    assertEqual(rrRoles("Ravage and Gift", "sorcery", "Ravage and Gift deals 3 damage to each creature.\nDraw two cards."), "draw,wipe");
  }
});
