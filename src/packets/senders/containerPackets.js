const PacketWriter = require("../../PacketWriter");

function sendContainerOpenPacket(proxy, client, packet) {
  const windowTypeMapping = {
    "minecraft:container": 0,          //container
    "minecraft:chest": 0,              //container
    "minecraft:crafting_table": 1,     //workbench
    "minecraft:furnace": 2,            //furnace
    "minecraft:dispenser": 3,          //trap
    "minecraft:enchanting_table": 4,   //enchantment
    "minecraft:brewing_stand": 5,      //brewing_stand
    "minecraft:villager": 6,           //trader npc
    "minecraft:beacon": 7,             //beacon
    "minecraft:anvil": 8,              //repair table
    "minecraft:hopper": 9,             //hopper
    "minecraft:dropper": 10,           //dropper
    "minecraft:horse": 11,             //horse
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

  if (lceType === 11) { //horse
    writer.writeInt(packet.entityId || 0);
  }

  if (customName) {
    writer.writeUtf(title);
  }

  proxy.sendPacket(client, 0x64, writer.toBuffer());
}

module.exports = {
  sendContainerOpenPacket,
};