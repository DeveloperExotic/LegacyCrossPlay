/* --------------------------------------------------------------- */
/*                           items.js                              */
/* --------------------------------------------------------------- */
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

  const nbtSize = reader.readShort();
  let nbtData = null;
  if (nbtSize > 0) {
    const nbtBytes = reader.readBytes(nbtSize);
    nbtData = { raw: nbtBytes };
  }

  return {
    blockId: itemId,
    itemCount: count,
    itemDamage: damage,
    nbtData: nbtData,
  };
}

function writeItemNBT(writer, item) {
  writer.writeShort(-1);
  return;
}

function writeItem(writer, item, mapJavaItemToLCE) {
  try {
    if (!item || item === null) {
      writer.writeShort(-1);
      return;
    }

    let javaItemId =
      item.itemId !== undefined
        ? item.itemId
        : item.blockId !== undefined
          ? item.blockId
          : -1;

    if (
      javaItemId === -1 ||
      javaItemId === undefined ||
      !Number.isFinite(javaItemId)
    ) {
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
      lceItemId === 0 ||
      !Number.isFinite(lceItemId)
    ) {
      lceItemId = 1;
      auxValue = 0;
    }

    if (lceItemId < 0 || lceItemId > 2267) {
      lceItemId = 1;
      auxValue = 0;
    }

    if (!Number.isFinite(auxValue)) {
      auxValue = 0;
    }

    writer.writeShort(lceItemId);

    const count = item.itemCount || item.count || 1;
    writer.writeByte(Math.max(1, Math.min(255, count)));

    writer.writeShort(Math.max(0, Math.min(32767, auxValue)));

    writeItemNBT(writer, item);
  } catch (err) {
    writer.writeShort(-1);
  }
}

module.exports = {
  readSlot,
  readItemInstance,
  readItem,
  writeItemNBT,
  writeItem,
};
/* --------------------------------------------------------------- */
