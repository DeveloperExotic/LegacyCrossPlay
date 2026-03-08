const playerPackets = require("./playerPackets");
const entityPackets = require("./entityPackets");
const worldPackets = require("./worldPackets");
const containerPackets = require("./containerPackets");

module.exports = {
  ...playerPackets,
  ...entityPackets,
  ...worldPackets,
  ...containerPackets,
};