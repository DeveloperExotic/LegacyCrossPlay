/* --------------------------------------------------------------- */
/*                          constants.js                           */
/* --------------------------------------------------------------- */
const USE_LEGACY_USERNAME = false;
const CUSTOM_USERNAME = "LCE_Player";

const SERVERS = [
  { server: "us-1.creepernation.net:25568", cracked: true },
  { server: "hypixel.net", cracked: false },
  { server: "localhost:25564", cracked: true },
];

/* DONT TOUCH THESE BELOW THINGS UNLESS YOU KNOW WHAT YOURE DOING! */

const GAME_PORT = 25565;
const WIN64_LAN_DISCOVERY_PORT = 25566;
const MINECRAFT_NET_VERSION = 560;

module.exports = {
  GAME_PORT,
  WIN64_LAN_DISCOVERY_PORT,
  MINECRAFT_NET_VERSION,
  USE_LEGACY_USERNAME,
  CUSTOM_USERNAME,
  SERVERS,
};
/* --------------------------------------------------------------- */
