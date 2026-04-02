/* --------------------------------------------------------------- */
/*                         lanbroadcast.js                         */
/* --------------------------------------------------------------- */
const { MINECRAFT_NET_VERSION } = require("../constants");

class LANBroadcast {
  constructor(serverName, gamePort) {
    this.buffer = Buffer.allocUnsafe(86);
    this.buffer.writeUInt32LE(0x4d434c4e, 0);
    this.buffer.writeUInt16LE(MINECRAFT_NET_VERSION, 4);
    this.buffer.writeUInt16LE(gamePort, 6);

    const hostName = serverName || "Minecraft Server";
    for (let i = 0; i < 32; i++) {
      const char = i < hostName.length ? hostName.charCodeAt(i) : 0;
      this.buffer.writeUInt16LE(char, 8 + i * 2);
    }

    this.buffer.writeUInt8(1, 72); //player count (updated dynamically)
    this.buffer.writeUInt8(8, 73); //max players
    this.buffer.writeUInt32LE(0, 74); //host settings
    this.buffer.writeUInt32LE(0, 78); //texture pack ID
    this.buffer.writeUInt8(0, 82); //sub texture pack ID
    this.buffer.writeUInt8(1, 83); //is joinable
  }

  setPlayerCount(count) {
    this.buffer.writeUInt8(Math.max(1, count), 72);
  }
}

module.exports = LANBroadcast;
/* --------------------------------------------------------------- */
