function readSlot(reader) {
  const id = reader.readShort();
  if (id === -1 || id === 0) {
    return null;
  }
  const count = reader.readUnsignedByte();
  const damage = reader.readShort();

  const nbtLength = reader.readShort();
  if (nbtLength > 0) {
    reader.skip(nbtLength);
  }

  return {
    blockId: id,
    itemCount: count & 0xff,
    itemDamage: damage,
  };
}

function readItemInstance(reader) {
  const id = reader.readShort();
  if (id === -1 || id === 0) {
    return null;
  }
  const count = reader.readByte();
  const damage = reader.readShort();

  const nbtPresent = reader.readByte();
  if (nbtPresent !== 0) {
    //for now, just ignore NBT because lazy
  }

  return {
    blockId: id,
    itemCount: count & 0xff,
    itemDamage: damage,
  };
}

function readItem(reader) {
  const itemId = reader.readShort();

  if (itemId === -1) {
    return null;
  }

  const count = reader.readByte();
  const damage = reader.readShort();

  return {
    blockId: itemId,
    itemCount: count,
    itemDamage: damage,
  };
}

function writeItemNBT(writer, item) {
  const PacketWriter = require("../PacketWriter");

  let customName = null;

  if (item.nbtData && item.nbtData.value && item.nbtData.value.display) {
    const display = item.nbtData.value.display.value;
    if (display.Name) {
      customName = display.Name.value;
      try {
        const parsed = JSON.parse(customName);
        if (parsed.text) {
          customName = parsed.text;
        } else if (typeof parsed === "string") {
          customName = parsed;
        }
      } catch (err) {
        /* do nothing */
      }
    }
  }

  if (!customName) {
    writer.writeShort(-1);
    return;
  }

  const nbtWriter = new PacketWriter();

  nbtWriter.writeByte(10);
  nbtWriter.writeUTF("");

  nbtWriter.writeByte(10);
  nbtWriter.writeUTF("display");

  nbtWriter.writeByte(8);
  nbtWriter.writeUTF("Name");
  nbtWriter.writeUTF(customName);

  nbtWriter.writeByte(0);

  nbtWriter.writeByte(0);

  const nbtData = nbtWriter.toBuffer();
  writer.writeShort(nbtData.length);
  writer.writeBytes(nbtData);
}

function writeItem(writer, item, mapJavaItemToLCE) {
  if (!item || item.blockId === -1 || item.itemId === -1 || item === null) {
    writer.writeShort(-1);
    return;
  }

  let javaItemId =
    item.itemId !== undefined
      ? item.itemId
      : item.blockId !== undefined
        ? item.blockId
        : -1;

  if (javaItemId === -1 || javaItemId === undefined) {
    writer.writeShort(-1);
    return;
  }

  let lceItemId = mapJavaItemToLCE(javaItemId);
  let auxValue =
    item.itemDamage !== undefined ? item.itemDamage : item.metadata || 0;

  if (
    lceItemId === undefined ||
    lceItemId === null ||
    lceItemId === -1 ||
    lceItemId === 0
  ) {
    lceItemId = 1;
    auxValue = 0;
  }

  if (lceItemId < 0 || lceItemId > 2267) {
    lceItemId = 1;
    auxValue = 0;
  }

  writer.writeShort(lceItemId);

  const count = item.itemCount || item.count || 1;
  writer.writeByte(Math.max(1, Math.min(255, count)));

  writer.writeShort(Math.max(0, Math.min(32767, auxValue)));

  writeItemNBT(writer, item);
}

module.exports = {
  readSlot,
  readItemInstance,
  readItem,
  writeItemNBT,
  writeItem,
};