/* --------------------------------------------------------------- */
/*                        playerpackets.js                         */
/* --------------------------------------------------------------- */
const PacketWriter = require("../../packetwriter");

function sendMovePlayerPacket(proxy, client, x, y, z, yaw, pitch) {
  const lceY = y + 1.65;
  const moveWriter = new PacketWriter();
  moveWriter.writeDouble(x);
  moveWriter.writeDouble(lceY);
  moveWriter.writeDouble(lceY + 1.62); //eye offset
  moveWriter.writeDouble(z);
  moveWriter.writeFloat(yaw);
  moveWriter.writeFloat(pitch);
  moveWriter.writeByte(0x01);
  proxy.sendPacket(client, 0x0d, moveWriter.toBuffer());
}

function sendAddPlayerPacket(proxy, client, playerInfo) {
  let playerName = playerInfo.name || "undefined";
  if (playerName.length > 16) {
    playerName = playerName.substring(0, 16);
  }
  if (playerName.length === 0) {
    playerName = "undefined";
  }

  const writer = new PacketWriter();
  writer.writeInt(playerInfo.entityId);
  writer.writeString(playerName);

  writer.writeInt(Math.floor(playerInfo.x * 32));
  writer.writeInt(Math.floor(playerInfo.y * 32));
  writer.writeInt(Math.floor(playerInfo.z * 32));

  const yRotByte = Math.floor(((playerInfo.yaw % 360) / 360) * 256) & 0xff;
  const xRotByte = Math.floor(((playerInfo.pitch % 360) / 360) * 256) & 0xff;
  writer.writeByte(yRotByte);
  writer.writeByte(xRotByte);
  writer.writeByte(yRotByte);

  writer.writeShort(0); //carriedItem
  writer.writeLong(0); //xuid
  writer.writeLong(0); //OnlineXuid
  writer.writeByte(0); //playerIndex
  writer.writeInt(0); //skinId
  writer.writeInt(0); //capeId
  writer.writeInt(0); //uiGamePrivileges

  writer.writeByte(0x7f);

  proxy.sendPacket(client, 0x14, writer.toBuffer());
}

function sendMoveEntityPacket(proxy, client, playerInfo) {
  sendTeleportEntityPacket(proxy, client, playerInfo);
}

function sendTeleportEntityPacket(proxy, client, playerInfo) {
  const writer = new PacketWriter();
  writer.writeInt(playerInfo.entityId);

  writer.writeInt(Math.floor(playerInfo.x * 32));
  writer.writeInt(Math.floor(playerInfo.y * 32));
  writer.writeInt(Math.floor(playerInfo.z * 32));

  const yRotByte = Math.floor(((playerInfo.yaw % 360) / 360) * 256) & 0xff;
  const xRotByte = Math.floor(((playerInfo.pitch % 360) / 360) * 256) & 0xff;
  writer.writeByte(yRotByte);
  writer.writeByte(xRotByte);
  writer.writeByte(0x01); //onGround

  proxy.sendPacket(client, 34, writer.toBuffer());

  sendRotateHeadPacket(proxy, client, playerInfo);
}

function sendRotateHeadPacket(proxy, client, playerInfo) {
  const writer = new PacketWriter();
  writer.writeInt(playerInfo.entityId);

  const yHeadRotByte = Math.floor(((playerInfo.yaw % 360) / 360) * 256) & 0xff;
  writer.writeByte(yHeadRotByte);

  proxy.sendPacket(client, 35, writer.toBuffer());
}

function sendChatPacket(
  proxy,
  client,
  message,
  messageType = 0,
  customData = -1,
) {
  const writer = new PacketWriter();

  writer.writeInt(messageType);

  writer.writeInt(1);
  writer.writeString(message);

  writer.writeInt(0);

  if (customData !== -1) {
    writer.writeInt(customData);
  }

  proxy.sendPacket(client, 3, writer.toBuffer());
}

module.exports = {
  sendMovePlayerPacket,
  sendAddPlayerPacket,
  sendMoveEntityPacket,
  sendTeleportEntityPacket,
  sendRotateHeadPacket,
  sendChatPacket,
};
/* --------------------------------------------------------------- */
