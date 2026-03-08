/* --------------------------------------------------------------- */
/*                          constants.js                           */
/* --------------------------------------------------------------- */
const GAME_PORT = 25565;                                           //
const WIN64_LAN_DISCOVERY_PORT = 25566;                            //
const MINECRAFT_NET_VERSION = 560;                                 //
const JAVA_SERVER_HOST = "localhost";                              // The java edition server host that the proxy will connect to.
const JAVA_SERVER_PORT = 25564;                                    // The java edition server port that the proxy will connect to (default is 25565).
const PROXY_NAME = JAVA_SERVER_HOST + ":" + JAVA_SERVER_PORT;      //
module.exports = {                                                 //
  GAME_PORT,                                                       //
  WIN64_LAN_DISCOVERY_PORT,                                        //
  MINECRAFT_NET_VERSION,                                           //  
  USE_LEGACY_USERNAME: false,                                      // You can use your legacy edition username, or a custom username below.
  CUSTOM_USERNAME: "LCE_Player",                                   // The custom username used if USE_LEGACY_USERNAME is false. Ensure it's UNDER 16 characters.
  JAVA_SERVER_HOST,                                                //
  JAVA_SERVER_PORT,                                                //
  PROXY_NAME,                                                      //
};                                                                 //
/* --------------------------------------------------------------- */