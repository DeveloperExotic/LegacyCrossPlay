const { createEntityTypeMapping } = require("./entityMapping");
const { createItemMapping } = require("./itemMapping");
const { createBlockMapping } = require("./blockMapping");
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