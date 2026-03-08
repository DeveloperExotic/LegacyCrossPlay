/* --------------------------------------------------------------- */
/*                            index.js                             */
/* --------------------------------------------------------------- */
const playerPackets = require("./playerpackets");
const entityPackets = require("./entitypackets");
const worldPackets = require("./worldPackets");
const containerPackets = require("./containerpackets");

module.exports = {
  ...playerPackets,
  ...entityPackets,
  ...worldPackets,
  ...containerPackets,
};
/* --------------------------------------------------------------- */
