/* --------------------------------------------------------------- */
/*                            mappers.js                           */
/* --------------------------------------------------------------- */
function mapJavaBlockToLCE(javaBlockId, javaBlockMapping) {
  if (javaBlockMapping[javaBlockId] !== undefined) {
    return javaBlockMapping[javaBlockId];
  }
  return 1;
}

function mapJavaParticleToLCE(particleId) {
  const particleMap = {
    0: "explode",
    1: "largeexplode",
    2: "hugeexplosion",
    3: "fireworksSpark",
    4: "bubble",
    5: "splash",
    6: "wake",
    7: "suspended",
    8: "depthsuspend",
    9: "crit",
    10: "magicCrit",
    11: "smoke",
    12: "largesmoke",
    13: "spell",
    14: "instantSpell",
    15: "mobSpell",
    16: "mobSpellAmbient",
    17: "witchMagic",
    18: "dripWater",
    19: "dripLava",
    20: "angryVillager",
    21: "happyVillager",
    22: "townaura",
    23: "note",
    24: "portal",
    25: "enchantmenttable",
    26: "flame",
    27: "lava",
    28: "footstep",
    29: "cloud",
    30: "reddust",
    31: "snowballpoof",
    32: "snowshovel",
    33: "slime",
    34: "heart",
    35: "barrier",
    36: "iconcrack",
    37: "blockcrack",
    38: "blockdust",
    39: "droplet",
    40: "take",
    41: "mobappearance",
    42: "dragonbreath",
    43: "endrod",
    44: "damageindicator",
    45: "sweepattack",
  };

  return particleMap[particleId] || null;
}

function mapJavaItemToLCE(javaItemId) {
  if (javaItemId >= 0 && javaItemId <= 255) {
    return this.mapJavaBlockToLCE(javaItemId);
  }

  if (this.javaItemMapping[javaItemId] !== undefined) {
    return this.javaItemMapping[javaItemId];
  }

  if (
    (javaItemId >= 256 && javaItemId <= 421) ||
    (javaItemId >= 2256 && javaItemId <= 2267)
  ) {
    return javaItemId;
  }

  return 1;
}

function mapLCEItemToJava(lceItemId) {
  if (lceItemId >= 0 && lceItemId <= 255) {
    return this.mapLCEBlockToJava(lceItemId);
  }

  if (
    (lceItemId >= 256 && lceItemId <= 421) ||
    (lceItemId >= 2256 && lceItemId <= 2267)
  ) {
    for (const [javaId, lceId] of Object.entries(this.javaItemMapping)) {
      if (lceId === lceItemId) {
        return parseInt(javaId);
      }
    }

    return lceItemId;
  }

  return null;
}

function mapLCEBlockToJava(lceBlockId) {
  for (const [javaId, lceId] of Object.entries(this.javaBlockMapping)) {
    if (lceId === lceBlockId) {
      return parseInt(javaId);
    }
  }

  if (lceBlockId >= 0 && lceBlockId <= 174) {
    return lceBlockId;
  }

  return null;
}

module.exports = {
  mapJavaBlockToLCE,
  mapJavaParticleToLCE,
  mapJavaItemToLCE,
  mapLCEItemToJava,
  mapLCEBlockToJava,
};
/* --------------------------------------------------------------- */
