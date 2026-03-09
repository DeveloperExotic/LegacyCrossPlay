/* --------------------------------------------------------------- */
/*                          constants.js                           */
/* --------------------------------------------------------------- */
const GAME_PORT = 25565;
const WIN64_LAN_DISCOVERY_PORT = 25566;
const MINECRAFT_NET_VERSION = 560;
const JAVA_SERVER_HOST = "hypixel.net"; // The java edition server host that the proxy will connect to.
const JAVA_SERVER_PORT = 25565; // The java edition server port that the proxy will connect to.
const PROXY_NAME = JAVA_SERVER_HOST + ":" + JAVA_SERVER_PORT;
module.exports = {
  GAME_PORT,
  WIN64_LAN_DISCOVERY_PORT,
  MINECRAFT_NET_VERSION,
  USE_JAVA_ACCOUNT: true, // Allows use of a microsoft java account for online servers. (Disable this if you don't own java - you'll only be able to connect to cracked/offline servers.)
  USE_LEGACY_USERNAME: false, // You can use your legacy edition username, or a custom username below. (offline servers only)
  CUSTOM_USERNAME: "LCE_Player", // The custom username used if USE_LEGACY_USERNAME is false. Ensure it's UNDER 16 characters. (offline servers only)
  JAVA_SERVER_HOST,
  JAVA_SERVER_PORT,
  PROXY_NAME,
};
/* --------------------------------------------------------------- */
