/* --------------------------------------------------------------- */
/*                       containerpackets.js                       */
/* --------------------------------------------------------------- */
const PacketWriter = require("../../packetwriter");

function sendContainerOpenPacket(proxy, client, packet) {
  const windowTypeMapping = {
    "minecraft:container": 0, //container
    "minecraft:chest": 0, //container
    "minecraft:crafting_table": 1, //workbench
    "minecraft:furnace": 2, //furnace
    "minecraft:dispenser": 3, //trap
    "minecraft:enchanting_table": 4, //enchantment
    "minecraft:brewing_stand": 5, //brewing_stand
    "minecraft:villager": 6, //trader npc
    "minecraft:beacon": 7, //beacon
    "minecraft:anvil": 8, //repair table
    "minecraft:hopper": 9, //hopper
    "minecraft:dropper": 10, //dropper
    "minecraft:horse": 11, //horse
  };

  const windowType = packet.inventoryType || packet.windowType;
  const lceType = windowTypeMapping[windowType] || 0;
  const containerId = packet.windowId;
  const title = packet.windowTitle
    ? JSON.parse(packet.windowTitle).text || ""
    : "";
  const size = packet.slotCount || 27;
  const customName = title.length > 0;

  const writer = new PacketWriter();
  writer.writeByte(containerId & 0xff);
  writer.writeByte(lceType & 0xff);
  writer.writeByte(size & 0xff);
  writer.writeBoolean(customName);

  if (lceType === 11) {
    //horse
    writer.writeInt(packet.entityId || 0);
  }

  if (customName) {
    writer.writeUtf(title);
  }

  proxy.sendPacket(client, 0x64, writer.toBuffer());
}

function sendVillagerTrades(proxy, client, windowId, packetData) {
  const PacketReader = require("../../packetreader");
  const reader = new PacketReader(packetData);
  reader.readInt();
  const numTrades = reader.readByte();

  const trades = [];
  for (let i = 0; i < numTrades; i++) {
    const trade = {};
    trade.input1 = readTradeItem(reader);
    trade.output = readTradeItem(reader);
    const hasSecondItem = reader.readByte() !== 0;
    if (hasSecondItem) {
      trade.input2 = readTradeItem(reader);
    }
    reader.readByte();
    trade.uses = reader.readInt();
    trade.maxUses = reader.readInt();
    trades.push(trade);
  }

  const payloadWriter = new PacketWriter();
  payloadWriter.writeInt(windowId);
  payloadWriter.writeByte(trades.length & 0xff);

  for (const trade of trades) {
    writeItemToBuffer(payloadWriter, trade.input1);
    writeItemToBuffer(payloadWriter, trade.output);
    payloadWriter.writeBoolean(
      trade.input2 !== null && trade.input2 !== undefined,
    );
    if (trade.input2) {
      writeItemToBuffer(payloadWriter, trade.input2);
    }
    payloadWriter.writeBoolean(trade.disabled || false);
    payloadWriter.writeInt(trade.uses || 0);
    payloadWriter.writeInt(trade.maxUses || 7);
  }

  const customWriter = new PacketWriter();
  customWriter.writeUtf("MC|TrList");
  customWriter.writeShort(payloadWriter.toBuffer().length);
  customWriter.writeBytes(payloadWriter.toBuffer());

  proxy.sendPacket(client, 0xfa, customWriter.toBuffer());
}

function readTradeItem(reader) {
  const id = reader.readShort();
  if (id === -1) {
    return null;
  }
  const count = reader.readByte();
  const damage = reader.readShort();
  const tagType = reader.readByte();
  if (tagType !== 0) {
    skipNBT(reader, tagType);
  }
  return { blockId: id, itemCount: count, itemDamage: damage };
}

function skipNBT(reader, tagType) {
  switch (tagType) {
    case 0:
      return;
    case 1:
      reader.readByte();
      return;
    case 2:
      reader.readShort();
      return;
    case 3:
      reader.readInt();
      return;
    case 4:
      reader.readInt();
      reader.readInt();
      return;
    case 5:
      reader.readFloat();
      return;
    case 6:
      reader.readDouble();
      return;
    case 7:
      const byteArrLen = reader.readInt();
      reader.offset += byteArrLen;
      return;
    case 8:
      const strLen = reader.readShort();
      reader.offset += strLen;
      return;
    case 9:
      const childType = reader.readByte();
      const listLen = reader.readInt();
      for (let i = 0; i < listLen; i++) {
        skipNBT(reader, childType);
      }
      return;
    case 10:
      while (true) {
        const type = reader.readByte();
        if (type === 0) break;
        const nameLen = reader.readShort();
        reader.offset += nameLen;
        skipNBT(reader, type);
      }
      return;
    case 11:
      const arrLen = reader.readInt();
      reader.offset += arrLen * 4;
      return;
  }
}

function writeItemToBuffer(writer, item) {
  if (!item) {
    writer.writeShort(-1);
    return;
  }
  writer.writeShort(item.blockId);
  writer.writeByte(item.itemCount & 0xff);
  writer.writeShort(item.itemDamage || 0);
  writer.writeShort(-1);
}

module.exports = {
  sendContainerOpenPacket,
  sendVillagerTrades,
};
/* --------------------------------------------------------------- */
