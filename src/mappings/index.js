/* --------------------------------------------------------------- */
/*                              index.js                           */
/* --------------------------------------------------------------- */
const { createEntityTypeMapping } = require("./entitymapping");
const { createItemMapping } = require("./itemmapping");
const { createBlockMapping } = require("./blockmapping");
const {
  mapJavaBlockToLCE,
  mapJavaParticleToLCE,
  mapJavaItemToLCE,
  mapLCEItemToJava,
  mapLCEBlockToJava,
} = require("./mappers");

module.exports = {
  createEntityTypeMapping,
  createItemMapping,
  createBlockMapping,
  mapJavaBlockToLCE,
  mapJavaParticleToLCE,
  mapJavaItemToLCE,
  mapLCEItemToJava,
  mapLCEBlockToJava,
};
/* --------------------------------------------------------------- */
