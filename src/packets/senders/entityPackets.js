const PacketWriter = require("../../PacketWriter");

function sendAddMobPacket(proxy, client, entityInfo) {
  const entityKey = `${entityInfo.javaEntityId}`;
  if (client._sentEntities && client._sentEntities.has(entityKey)) {
    return;
  }
  if (!client._sentEntities) {
    client._sentEntities = new Set();
  }
  client._sentEntities.add(entityKey);

  const writer = new PacketWriter();
  writer.writeShort(entityInfo.entityId);
  writer.writeByte(entityInfo.type & 0xff);

  writer.writeInt(Math.floor(entityInfo.x * 32));
  writer.writeInt(Math.floor(entityInfo.y * 32));
  writer.writeInt(Math.floor(entityInfo.z * 32));

  const yRotByte = Math.floor(((entityInfo.yaw % 360) / 360) * 256) & 0xff;
  const xRotByte = Math.floor(((entityInfo.pitch % 360) / 360) * 256) & 0xff;
  const yHeadRotByte =
    Math.floor(((entityInfo.headYaw % 360) / 360) * 256) & 0xff;
  writer.writeByte(yRotByte);
  writer.writeByte(xRotByte);
  writer.writeByte(yHeadRotByte);

  let velX = entityInfo.velocityX || 0;
  let velY = entityInfo.velocityY || 0;
  let velZ = entityInfo.velocityZ || 0;
  velX = Math.max(-3.9, Math.min(3.9, velX));
  velY = Math.max(-3.9, Math.min(3.9, velY));
  velZ = Math.max(-3.9, Math.min(3.9, velZ));
  const velocityX = Math.floor(velX * 8000);
  const velocityY = Math.floor(velY * 8000);
  const velocityZ = Math.floor(velZ * 8000);
  writer.writeShort(velocityX);
  writer.writeShort(velocityY);
  writer.writeShort(velocityZ);

  writer.writeByte((0 << 5) | 0);
  writer.writeByte(0);

  writer.writeByte((1 << 5) | 1);
  writer.writeShort(300);

  const agableMobTypes = [92, 91, 90, 93, 120];
  if (agableMobTypes.includes(entityInfo.type)) {
    const ageMetadata = entityInfo.metadata
      ? entityInfo.metadata.find((m) => m.key === 12)
      : null;
    if (ageMetadata && ageMetadata.value !== undefined) {
      writer.writeByte((2 << 5) | 12);
      writer.writeInt(ageMetadata.value);
    }
  }

  if (entityInfo.type === 120) {
    const professionMetadata = entityInfo.metadata
      ? entityInfo.metadata.find((m) => m.key === 16 && m.type === 2)
      : null;
    if (professionMetadata && professionMetadata.value !== undefined) {
      writer.writeByte((2 << 5) | 16);
      writer.writeInt(professionMetadata.value);
    }
  }

  const customNameMeta = entityInfo.metadata
    ? entityInfo.metadata.find((m) => m.key === 2 && m.type === 4)
    : null;
  if (customNameMeta && customNameMeta.value) {
    writer.writeByte((4 << 5) | 10);
    writer.writeUtf(customNameMeta.value);
  }

  const customNameVisibleMeta = entityInfo.metadata
    ? entityInfo.metadata.find((m) => m.key === 3 && m.type === 0)
    : null;
  if (customNameVisibleMeta && customNameVisibleMeta.value !== undefined) {
    writer.writeByte((0 << 5) | 11);
    writer.writeByte(customNameVisibleMeta.value & 0xff);
  }

  if (entityInfo.type === 55 || entityInfo.type === 62) {
    const sizeMetadata = entityInfo.metadata
      ? entityInfo.metadata.find((m) => m.key === 16 && m.type === 0)
      : null;
    if (sizeMetadata && sizeMetadata.value !== undefined) {
      writer.writeByte((0 << 5) | 16);
      writer.writeByte(sizeMetadata.value & 0xff);
    }
  }

  if (entityInfo.type === 51) {
    const typeMetadata = entityInfo.metadata
      ? entityInfo.metadata.find((m) => m.key === 13 && m.type === 0)
      : null;
    if (typeMetadata && typeMetadata.value !== undefined) {
      writer.writeByte((0 << 5) | 13);
      writer.writeByte(typeMetadata.value & 0xff);
    }
  }

  writer.writeByte(0x7f);

  const payload = writer.toBuffer();
  proxy.sendPacket(client, 0x18, payload);
}

function sendAddEntityPacket(proxy, client, entityInfo) {
  const writer = new PacketWriter();
  writer.writeShort(entityInfo.entityId);
  writer.writeByte(entityInfo.type);

  writer.writeInt(Math.floor(entityInfo.x * 32));
  writer.writeInt(Math.floor(entityInfo.y * 32));
  writer.writeInt(Math.floor(entityInfo.z * 32));

  const yRotByte = Math.floor(((entityInfo.yaw % 360) / 360) * 256) & 0xff;
  const xRotByte = Math.floor(((entityInfo.pitch % 360) / 360) * 256) & 0xff;

  writer.writeByte(yRotByte);
  writer.writeByte(xRotByte);

  const data = entityInfo.data !== undefined ? entityInfo.data : -1;
  writer.writeInt(data);

  if (data > -1) {
    const velocityX = entityInfo.velocityX || 0;
    const velocityY = entityInfo.velocityY || 0;
    const velocityZ = entityInfo.velocityZ || 0;

    writer.writeShort(Math.max(-32768, Math.min(32767, velocityX)));
    writer.writeShort(Math.max(-32768, Math.min(32767, velocityY)));
    writer.writeShort(Math.max(-32768, Math.min(32767, velocityZ)));
  }

  proxy.sendPacket(client, 0x17, writer.toBuffer());
}

function sendMoveEntityPacketForEntity(
  proxy,
  client,
  entity,
  dX,
  dY,
  dZ,
  includeRotation = false,
) {
  if (Math.abs(dX) <= 127 && Math.abs(dY) <= 127 && Math.abs(dZ) <= 127) {
    const writer = new PacketWriter();
    writer.writeShort(entity.entityId);
    writer.writeByte(dX & 0xff);
    writer.writeByte(dY & 0xff);
    writer.writeByte(dZ & 0xff);

    if (includeRotation) {
      const prevYaw =
        entity.prevYaw !== undefined ? entity.prevYaw : entity.yaw;
      const prevPitch =
        entity.prevPitch !== undefined ? entity.prevPitch : entity.pitch;

      let deltaYaw = entity.yaw - prevYaw;
      let deltaPitch = entity.pitch - prevPitch;

      while (deltaYaw > 180) deltaYaw -= 360;
      while (deltaYaw < -180) deltaYaw += 360;
      while (deltaPitch > 180) deltaPitch -= 360;
      while (deltaPitch < -180) deltaPitch += 360;

      const dYawByte = Math.floor((deltaYaw / 360) * 256) & 0xff;
      const dPitchByte = Math.floor((deltaPitch / 360) * 256) & 0xff;

      writer.writeByte(dYawByte);
      writer.writeByte(dPitchByte);

      entity.prevYaw = entity.yaw;
      entity.prevPitch = entity.pitch;

      proxy.sendPacket(client, 0x21, writer.toBuffer());
    } else {
      proxy.sendPacket(client, 0x1f, writer.toBuffer());
    }
  } else {
    sendTeleportEntityPacketForEntity(proxy, client, entity);
  }
}

function sendTeleportEntityPacketForEntity(proxy, client, entity) {
  const writer = new PacketWriter();
  writer.writeShort(entity.entityId);

  writer.writeInt(Math.floor(entity.x * 32));
  writer.writeInt(Math.floor(entity.y * 32));
  writer.writeInt(Math.floor(entity.z * 32));

  const yRotByte = Math.floor(((entity.yaw % 360) / 360) * 256) & 0xff;
  const xRotByte = Math.floor(((entity.pitch % 360) / 360) * 256) & 0xff;
  writer.writeByte(yRotByte);
  writer.writeByte(xRotByte);

  proxy.sendPacket(client, 34, writer.toBuffer());
}

function sendRotateEntityPacketForEntity(proxy, client, entity) {
  const writer = new PacketWriter();
  writer.writeShort(entity.entityId);

  const prevYaw = entity.prevYaw !== undefined ? entity.prevYaw : entity.yaw;
  const prevPitch =
    entity.prevPitch !== undefined ? entity.prevPitch : entity.pitch;

  let deltaYaw = entity.yaw - prevYaw;
  let deltaPitch = entity.pitch - prevPitch;

  while (deltaYaw > 180) deltaYaw -= 360;
  while (deltaYaw < -180) deltaYaw += 360;
  while (deltaPitch > 180) deltaPitch -= 360;
  while (deltaPitch < -180) deltaPitch += 360;

  const dYawByte = Math.floor((deltaYaw / 360) * 256) & 0xff;
  const dPitchByte = Math.floor((deltaPitch / 360) * 256) & 0xff;

  writer.writeByte(dYawByte);
  writer.writeByte(dPitchByte);

  entity.prevYaw = entity.yaw;
  entity.prevPitch = entity.pitch;

  proxy.sendPacket(client, 0x20, writer.toBuffer());
}

function sendRotateHeadPacketForEntity(proxy, client, entity) {
  const writer = new PacketWriter();
  writer.writeInt(entity.entityId);

  const yHeadRotByte = Math.floor(((entity.headYaw % 360) / 360) * 256) & 0xff;
  writer.writeByte(yHeadRotByte);

  proxy.sendPacket(client, 35, writer.toBuffer());
}

function sendEntityMetadataPacket(proxy, client, entity, metadata) {
  const writer = new PacketWriter();
  writer.writeInt(entity.entityId);
  for (const item of metadata) {
    if (item.key === 12 && item.type === 0) {
      const ageableMobTypes = [
        "Pig",
        "Cow",
        "Sheep",
        "Chicken",
        "Wolf",
        "Ocelot",
        "MushroomCow",
      ];
      const isAgeableMob = ageableMobTypes.includes(entity.javaType);

      if (isAgeableMob && item.value === -1) {
        const header = (2 << 5) | 12;
        writer.writeByte(header);
        writer.writeInt(-24000);
        continue;
      } else if (isAgeableMob && item.value === 0) {
        const header = (2 << 5) | 12;
        writer.writeByte(header);
        writer.writeInt(0);
        continue;
      }
    }
    const header = (item.type << 5) | item.key;
    writer.writeByte(header);

    switch (item.type) {
      case 0:
        writer.writeByte(item.value & 0xff);
        break;
      case 1:
        writer.writeShort(item.value);
        break;
      case 2:
        writer.writeInt(item.value);
        break;
      case 3:
        writer.writeFloat(item.value);
        break;
      case 4:
        writer.writeUtf(item.value);
        break;
      case 5:
        continue;
      default:
        continue;
    }
  }
  writer.writeByte(0x7f);

  proxy.sendPacket(client, 0x28, writer.toBuffer());
}

function sendSetEntityMotionPacket(proxy, client, entity) {
  if (!entity || entity.entityId === undefined || entity.entityId < 0) {
    return;
  }

  let xa = entity.velocityX || 0;
  let ya = entity.velocityY || 0;
  let za = entity.velocityZ || 0;

  const maxVel = 31200;
  xa = Math.max(-maxVel, Math.min(maxVel, xa));
  ya = Math.max(-maxVel, Math.min(maxVel, ya));
  za = Math.max(-maxVel, Math.min(maxVel, za));

  const writer = new PacketWriter();

  try {
    const useBytes =
      xa >= -2048 &&
      xa < 2048 &&
      ya >= -2048 &&
      ya < 2048 &&
      za >= -2048 &&
      za < 2048;
    if (useBytes) {
      writer.writeShort((entity.entityId & 0x07ff) | 0x800);

      const xByte = Math.floor(xa / 16);
      const yByte = Math.floor(ya / 16);
      const zByte = Math.floor(za / 16);

      writer.writeSignedByte(xByte);
      writer.writeSignedByte(yByte);
      writer.writeSignedByte(zByte);
    } else {
      writer.writeShort(entity.entityId & 0x07ff);

      writer.writeShort(xa);
      writer.writeShort(ya);
      writer.writeShort(za);
    }
    const payload = writer.toBuffer();
    proxy.sendPacket(client, 0x1c, payload);
  } catch (err) {
    /* do nothing */
  }
}

function sendEntityEventPacket(proxy, client, entity, eventId) {
  const writer = new PacketWriter();
  writer.writeInt(entity.entityId);
  writer.writeByte(eventId & 0xff);

  proxy.sendPacket(client, 0x26, writer.toBuffer());
}

function sendSetEquippedItemPacket(proxy, client, entity, slot, item) {
  const writer = new PacketWriter();
  writer.writeInt(entity.entityId);
  writer.writeShort(slot);

  if (!item || item.blockId === undefined || item.blockId === -1) {
    writer.writeShort(-1);
    proxy.sendPacket(client, 0x05, writer.toBuffer());

    return;
  }

  const javaItemId = item.blockId;
  const count = item.itemCount || 1;
  let damage = item.itemDamage || 0;

  const lceItemId = proxy.mapJavaItemToLCE(javaItemId);

  if (lceItemId === 1 && javaItemId !== 1) {
    damage = 0;
  }

  if (lceItemId === -1 || lceItemId === 0) {
    writer.writeShort(-1);
    proxy.sendPacket(client, 0x05, writer.toBuffer());

    return;
  }

  if (
    (lceItemId >= 1 && lceItemId <= 174) ||
    (lceItemId >= 256 && lceItemId <= 421) ||
    (lceItemId >= 2256 && lceItemId <= 2267)
  ) {
    writer.writeShort(lceItemId);
    writer.writeByte(count);
    writer.writeShort(damage);
  } else {
    writer.writeShort(-1);
    proxy.sendPacket(client, 0x05, writer.toBuffer());
    return;
  }

  writer.writeShort(-1);

  proxy.sendPacket(client, 0x05, writer.toBuffer());
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

function sendSetItemDataPacket(proxy, client, entity, itemData) {
  const lceItemId = proxy.mapJavaItemToLCE(itemData.blockId);

  if (lceItemId === -1 || lceItemId === 0) {
    return;
  }

  const writer = new PacketWriter();
  writer.writeInt(entity.entityId);

  writer.writeByte((5 << 5) | 10);

  writer.writeShort(lceItemId);
  writer.writeByte(itemData.itemCount);
  writer.writeShort(itemData.itemDamage);

  writer.writeShort(-1);

  writer.writeByte(0x7f);

  const payload = writer.toBuffer();

  proxy.sendPacket(client, 0x28, payload);
}

function sendSetEntityDataPacket(proxy, client, entity) {
  const writer = new PacketWriter();
  writer.writeInt(entity.entityId);

  const sharedFlagsHeader = (0 << 5) | 0;
  writer.writeByte(sharedFlagsHeader);
  writer.writeByte(0);

  writer.writeByte(0x7f);

  proxy.sendPacket(client, 0x27, writer.toBuffer());
}

function sendUpdateAttributesPacket(proxy, client, entity) {
  const writer = new PacketWriter();
  writer.writeInt(entity.entityId);

  const attributes = [];

  attributes.push({ id: 0, base: 20.0, modifiers: [] });

  if (entity.type !== 94) {
    attributes.push({ id: 3, base: 0.25, modifiers: [] });
  }

  if (entity.type >= 50 && entity.type <= 66) {
    attributes.push({ id: 1, base: 32.0, modifiers: [] });
    attributes.push({ id: 4, base: 2.0, modifiers: [] });
  }

  writer.writeInt(attributes.length);

  for (const attr of attributes) {
    writer.writeShort(attr.id);
    writer.writeDouble(attr.base);
    writer.writeShort(attr.modifiers.length);
  }

  const payload = writer.toBuffer();

  proxy.sendPacket(client, 0x2c, payload);
}

function sendSetEntityLinkPacket(proxy, client, sourceId, destId, linkType) {
  const writer = new PacketWriter();
  writer.writeInt(sourceId);
  writer.writeInt(destId);
  writer.writeByte(linkType);
  const buffer = writer.toBuffer();
  proxy.sendPacket(client, 0x27, buffer);
}

module.exports = {
  sendAddMobPacket,
  sendAddEntityPacket,
  sendMoveEntityPacketForEntity,
  sendTeleportEntityPacketForEntity,
  sendRotateEntityPacketForEntity,
  sendRotateHeadPacketForEntity,
  sendEntityMetadataPacket,
  sendSetEntityMotionPacket,
  sendEntityEventPacket,
  sendSetEquippedItemPacket,
  sendSetItemDataPacket,
  sendSetEntityDataPacket,
  sendUpdateAttributesPacket,
  sendSetEntityLinkPacket,
};