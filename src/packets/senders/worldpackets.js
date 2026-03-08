/* --------------------------------------------------------------- */
/*                        worldpackets.js                          */
/* --------------------------------------------------------------- */
const PacketWriter = require("../../packetwriter");

function sendLevelSoundPacket(proxy, client, soundId, x, y, z, volume, pitch) {
  const safeX = x !== undefined && x !== null && !isNaN(x) ? x : 0;
  const safeY = y !== undefined && y !== null && !isNaN(y) ? y : 0;
  const safeZ = z !== undefined && z !== null && !isNaN(z) ? z : 0;
  const safeVolume =
    volume !== undefined && volume !== null && !isNaN(volume) ? volume : 1.0;
  const safePitch =
    pitch !== undefined && pitch !== null && !isNaN(pitch) ? pitch : 1.0;

  const writer = new PacketWriter();
  writer.writeInt(soundId);
  writer.writeInt(Math.floor(safeX * 8.0));
  writer.writeInt(Math.floor(safeY * 8.0));
  writer.writeInt(Math.floor(safeZ * 8.0));
  writer.writeFloat(safeVolume);
  writer.writeFloat(safePitch);

  proxy.sendPacket(client, 0x3e, writer.toBuffer());
}

function sendLevelParticlesPacket(
  proxy,
  client,
  name,
  x,
  y,
  z,
  xDist,
  yDist,
  zDist,
  maxSpeed,
  count,
) {
  const writer = new PacketWriter();

  writer.writeString(name);
  writer.writeFloat(x);
  writer.writeFloat(y);
  writer.writeFloat(z);
  writer.writeFloat(xDist);
  writer.writeFloat(yDist);
  writer.writeFloat(zDist);
  writer.writeFloat(maxSpeed);
  writer.writeInt(count);

  const buffer = writer.toBuffer();
  proxy.sendPacket(client, 63, buffer);
}

function sendTileUpdatePacket(proxy, client, x, y, z, blockId, metadata) {
  const writer = new PacketWriter();

  writer.writeInt(x);
  writer.writeByte(y & 0xff);
  writer.writeInt(z);
  writer.writeShort(blockId & 0xffff);
  const levelIdx =
    client.javaDimension === -1 ? 1 : client.javaDimension === 1 ? 2 : 0;
  const dataLevel = ((levelIdx & 0xf) << 4) | (metadata & 0xf);
  writer.writeByte(dataLevel);

  const buffer = writer.toBuffer();
  proxy.sendPacket(client, 53, buffer);
}

module.exports = {
  sendLevelSoundPacket,
  sendLevelParticlesPacket,
  sendTileUpdatePacket,
};
/* --------------------------------------------------------------- */
