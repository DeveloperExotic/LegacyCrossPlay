const GAME_PORT = 25565;
const WIN64_LAN_DISCOVERY_PORT = 25566;
const MINECRAFT_NET_VERSION = 560;
const JAVA_SERVER_HOST = "localhost";
const JAVA_SERVER_PORT = 25564;
const PROXY_NAME = JAVA_SERVER_HOST + ":" + JAVA_SERVER_PORT;

module.exports = {
  GAME_PORT,
  WIN64_LAN_DISCOVERY_PORT,
  MINECRAFT_NET_VERSION,
  USE_LEGACY_USERNAME: false, // you can use your legacy edition username, or a custom username below.
  CUSTOM_USERNAME: "LCE_Player",
  JAVA_SERVER_HOST,
  JAVA_SERVER_PORT,
  PROXY_NAME,
};