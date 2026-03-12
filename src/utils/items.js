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
  if (!item || (!item.displayName && !item.enchanted)) {
    writer.writeShort(-1);
    return;
  }

  try {
    const nbt = require("prismarine-nbt");

    const nbtValue = {};

    if (item.displayName && item.displayName.length > 0) {
      const cleanedName = item.displayName.replace(/§[0-9a-fk-or]/gi, "");
      nbtValue.display = {
        type: "compound",
        value: {
          Name: {
            type: "string",
            value: cleanedName,
          },
        },
      };
    }

    if (item.enchanted) {
      nbtValue.ench = {
        type: "list",
        value: {
          type: "compound",
          value: [],
        },
      };
    }

    const nbtData = {
      type: "compound",
      name: "",
      value: nbtValue,
    };

    const nbtBuffer = nbt.writeUncompressed(nbtData, "big");

    writer.writeShort(nbtBuffer.length);
    writer.writeBytes(nbtBuffer);
  } catch (err) {
    writer.writeShort(-1);
  }
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

    let auxValue =
      item.itemDamage !== undefined ? item.itemDamage : item.metadata || 0;

    if (javaItemId === 162) {
      javaItemId = 35;
      auxValue = 1;
      if (!item.displayName) {
        item.displayName = "Acacia Wood";
      }
    }

    let lceItemId = mapJavaItemToLCE(javaItemId);

    if (javaItemId === 5 && auxValue === 4) {
      auxValue = 0;
      if (!item.displayName) {
        item.displayName = "Acacia Wood Planks";
      }
    }

    if (javaItemId === 5 && auxValue === 5) {
      auxValue = 0;
      if (!item.displayName) {
        item.displayName = "Dark Oak Wood Planks";
      }
    }

    if (javaItemId === 383 && auxValue === 101) {
      auxValue = 93;
      if (!item.displayName) {
        item.displayName = "Rabbit Spawn Egg";
      }
    }

    const customItemNames = {
      386: "Book and Quill",
      427: "Spruce Door",
      428: "Birch Door",
      429: "Jungle Door",
      430: "Acacia Door",
      431: "Dark Oak Door",
      423: "Raw Mutton",
      424: "Cooked Mutton",
      411: "Raw Rabbit",
      412: "Cooked Rabbit",
      413: "Rabbit Stew",
      414: "Rabbit Foot",
      415: "Rabbit Hide",
      165: "Slime Block",
    };

    if (customItemNames[javaItemId] && !item.displayName) {
      item.displayName = customItemNames[javaItemId];
    }

    if (javaItemId === 165) {
      auxValue = 5;
    }

    if (javaItemId === 387) {
      let authorName = "Unknown";
      if (item.nbtData && item.nbtData.value && item.nbtData.value.author) {
        authorName = item.nbtData.value.author.value || "Unknown";
      }
      if (!item.displayName) {
        item.displayName = `Written Book (by ${authorName})`;
      }
      item.enchanted = true;
    }

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
