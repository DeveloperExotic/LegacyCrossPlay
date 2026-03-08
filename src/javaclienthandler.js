/* --------------------------------------------------------------- */
/*                      javaclienthandler.js                       */
/* --------------------------------------------------------------- */
const mc = require("minecraft-protocol");
const {
  JAVA_SERVER_HOST,
  JAVA_SERVER_PORT,
  USE_LEGACY_USERNAME,
  CUSTOM_USERNAME,
} = require("../constants");
const PacketWriter = require("./packetwriter");
const { mapJavaItemToLCE, mapJavaBlockToLCE } = require("./mappings");
const { mapJavaSoundToLCE } = require("./mappings/soundmapping");
const { parseChatComponent } = require("./utils/chat");
const { countSetBits, compressRLE } = require("./utils/chunk");
const zlib = require("zlib");

function connectToJavaServer(proxy, client) {
  const javaClient = mc.createClient({
    host: JAVA_SERVER_HOST,
    port: JAVA_SERVER_PORT,
    username: !USE_LEGACY_USERNAME
      ? CUSTOM_USERNAME
      : client.username || "undefined",
    auth: "offline",
    version: "1.8.9",
  });

  client.javaClient = javaClient;
  client._lastJavaPackets = [];

  javaClient.on("error", (err) => {
    if (!client._removing) {
      client._removing = true;
      const index = proxy.clients.indexOf(client);
      if (index > -1) {
        proxy.clients.splice(index, 1);
      }
      if (client.smallId) {
        proxy.usedSmallIds.delete(client.smallId);
      }
      client.javaClient = null;
      if (client.socket && !client.socket.destroyed) {
        try {
          client.socket.destroy();
        } catch (err) {
          /* do nothing */
        }
      }
    }
  });

  javaClient.on("end", () => {
    if (proxy.clients.indexOf(client) > -1 && !client._removing) {
      proxy.removeClient(client);
    }
  });

  javaClient.on("login", (packet) => {
    client.javaGameMode = packet.gameMode;
    client.gameMode = packet.gameMode;
    client.javaDimension = packet.dimension;
    client.javaPlayerEntityId = packet.entityId;

    if (client.javaClient && client.javaClient.write) {
      try {
        client.javaClient.write("settings", {
          locale: "en_US",
          viewDistance: 10,
          chatFlags: 0,
          chatColors: true,
          skinParts: 127,
        });

        const brandData = Buffer.concat([
          Buffer.from([0x0e]),
          Buffer.from("LCE Cross Play", "utf8"),
        ]);
        client.javaClient.write("custom_payload", {
          channel: "MC|Brand",
          data: brandData,
        });

        client.javaClient.write("held_item_slot", {
          slotId: 0,
        });
      } catch (err) {
        /* do nothing */
      }
    }
  });

  javaClient.on("chat", (packet) => {
    if (client.state === "play") {
      try {
        let chatText = "";

        chatText = parseChatComponent(packet.message);

        if (chatText && chatText.length > 0) {
          if (chatText.length > 100) {
            chatText = chatText.substring(0, 97) + "...";
          }

          const chatWriter = new PacketWriter();
          chatWriter.writeShort(0);
          chatWriter.writeShort(0x10);
          chatWriter.writeString(chatText);

          const buffer = chatWriter.toBuffer();
          proxy.sendPacket(client, 0x03, buffer);
        }
      } catch (err) {
        /* do nothing */
      }
    }
  });

  javaClient.on("game_state_change", (packet) => {
    if (client.state === "play") {
      if (packet.reason === 1) {
        const gameEventWriter = new PacketWriter();
        gameEventWriter.writeByte(1); //start rain
        gameEventWriter.writeByte(0);
        proxy.sendPacket(client, 0x46, gameEventWriter.toBuffer());
      } else if (packet.reason === 2) {
        const gameEventWriter = new PacketWriter();
        gameEventWriter.writeByte(2); //stop rain (why tf does it rain so much on 1.8 lol)
        gameEventWriter.writeByte(0);
        proxy.sendPacket(client, 0x46, gameEventWriter.toBuffer());
      } else if (packet.reason === 3) {
        const newGameMode = packet.gameMode;
        client.javaGameMode = newGameMode;
        client.gameMode = newGameMode;

        const gameEventWriter = new PacketWriter();
        gameEventWriter.writeByte(3); //change gamemode
        gameEventWriter.writeByte(newGameMode); //0=survival, 1=creative, 2=adventure
        proxy.sendPacket(client, 0x46, gameEventWriter.toBuffer());
      }
    }
  });

  javaClient.on("abilities", (packet) => {
    if (client.state === "play") {
      const flags = packet.flags;
      const invulnerable = (flags & 0x01) !== 0;
      const flying = (flags & 0x02) !== 0;
      const canFly = (flags & 0x04) !== 0;
      const instabuild = client.gameMode === 1; //for some reason this controls if you're able to shoot bows without an arrow

      if (!client.abilities) client.abilities = {};
      client.abilities.invulnerable = invulnerable;
      client.abilities.flying = flying;
      client.abilities.canFly = canFly;
      client.abilities.instabuild = instabuild;

      const abilitiesWriter = new PacketWriter();
      let bitfield = 0;
      if (invulnerable) bitfield |= 1;
      if (flying) bitfield |= 2;
      if (canFly) bitfield |= 4;
      if (instabuild) bitfield |= 8;
      abilitiesWriter.writeByte(bitfield);
      abilitiesWriter.writeFloat(packet.flyingSpeed || 0.05);
      abilitiesWriter.writeFloat(packet.walkingSpeed || 0.1);
      proxy.sendPacket(client, 202, abilitiesWriter.toBuffer());
    }
  });

  javaClient.on("window_items", (packet) => {
    if (client.state === "play") {
      if (packet.windowId < 0) {
        return;
      }

      if (packet.windowId === 0) {
        if (!client.inventory) client.inventory = {};
        for (let i = 0; i < packet.items.length; i++) {
          client.inventory[i] = packet.items[i];
        }
      }

      let isNetworkedChest = false;
      let chestData = null;
      if (
        client._currentChest &&
        client._currentChest.windowId === packet.windowId
      ) {
        const posKey = client._currentChest.posKey;
        chestData = proxy.openChests.get(posKey);
        if (chestData && chestData.clients.size > 1) {
          isNetworkedChest = true;
          chestData.items = packet.items.slice();
        }
      }

      const invWriter = new PacketWriter();
      invWriter.writeByte(packet.windowId);
      invWriter.writeShort(packet.items.length);

      for (let i = 0; i < packet.items.length; i++) {
        proxy.writeItem(invWriter, packet.items[i]);
      }

      const payload = invWriter.toBuffer();

      if (isNetworkedChest && chestData) {
        for (const otherClient of chestData.clients) {
          if (
            otherClient._currentChest &&
            otherClient._currentChest.posKey === client._currentChest.posKey
          ) {
            proxy.sendPacket(otherClient, 0x68, payload);
          }
        }
      } else {
        proxy.sendPacket(client, 0x68, payload);
      }
    }
  });

  javaClient.on("craft_progress_bar", (packet) => {
    if (client.state === "play") {
      const windowId = packet.windowId;
      const property = packet.property;
      const value = packet.value;

      const writer = new PacketWriter();
      writer.writeByte(windowId & 0xff);
      writer.writeShort(property);
      writer.writeShort(value);

      proxy.sendPacket(client, 0x69, writer.toBuffer());
    }
  });

  javaClient.on("set_slot", (packet) => {
    if (client.state === "play") {
      //idk why LCE sends negative window ids
      if (packet.windowId < 0) {
        return;
      }

      if (packet.windowId >= 0) {
        if (!client._windowInventories) {
          client._windowInventories = {};
        }
        if (!client._windowInventories[packet.windowId]) {
          client._windowInventories[packet.windowId] = {};
        }
        client._windowInventories[packet.windowId][packet.slot] = packet.item;
      }

      if (packet.windowId === 0) {
        if (!client.inventory) client.inventory = {};
        client.inventory[packet.slot] = packet.item;
      }

      let isNetworkedChest = false;
      let chestData = null;
      if (
        client._currentChest &&
        client._currentChest.windowId === packet.windowId
      ) {
        const posKey = client._currentChest.posKey;
        chestData = proxy.openChests.get(posKey);
        if (chestData && chestData.clients.size > 1) {
          isNetworkedChest = true;
          if (packet.slot < chestData.items.length) {
            chestData.items[packet.slot] = packet.item;
          }
        }
      }

      const slotWriter = new PacketWriter();
      slotWriter.writeByte(packet.windowId);
      slotWriter.writeShort(packet.slot);
      proxy.writeItem(slotWriter, packet.item);

      const payload = slotWriter.toBuffer();

      if (isNetworkedChest && chestData) {
        for (const otherClient of chestData.clients) {
          if (
            otherClient._currentChest &&
            otherClient._currentChest.posKey === client._currentChest.posKey
          ) {
            proxy.sendPacket(otherClient, 0x67, payload);
          }
        }
      } else {
        proxy.sendPacket(client, 0x67, payload);
      }
    }
  });

  javaClient.on("update_time", (packet) => {
    if (client.state === "play") {
      //fucking java edition sends a negative time value when doDayLightCycle is false
      const timeWriter = new PacketWriter();
      timeWriter.writeLong(packet.age);
      const dayTime = packet.time < 0n ? -packet.time : packet.time;
      timeWriter.writeLong(dayTime);
      proxy.sendPacket(client, 0x04, timeWriter.toBuffer());

      const timeNum = Number(packet.time);
      if (
        !client.lastTimeUpdate ||
        Math.abs(timeNum - client.lastTimeUpdate) > 100
      ) {
        client.lastTimeUpdate = timeNum;
      }
    }
  });

  javaClient.on("experience", (packet) => {
    if (client.state === "play") {
      const xpWriter = new PacketWriter();
      xpWriter.writeFloat(packet.experienceBar);
      xpWriter.writeShort(packet.level);
      xpWriter.writeShort(packet.totalExperience);
      proxy.sendPacket(client, 0x2b, xpWriter.toBuffer());
    }
  });

  javaClient.on("update_health", (packet) => {
    if (client.state === "play") {
      const healthWriter = new PacketWriter();
      healthWriter.writeFloat(packet.health);
      healthWriter.writeShort(packet.food);
      healthWriter.writeFloat(packet.foodSaturation);
      healthWriter.writeByte(0);
      proxy.sendPacket(client, 0x08, healthWriter.toBuffer());
    }
  });

  javaClient.on("respawn", (packet) => {
    if (client.state === "play") {
      client.javaDimension = packet.dimension;

      if (client.loadedChunks) {
        client.loadedChunks.clear();
      }

      if (client.javaPlayers) {
        for (const [uuid, player] of client.javaPlayers) {
          player.spawned = false;
        }
      }

      if (client.javaEntities) {
        const entityIdsToRemove = [];
        for (const [javaEntityId, entity] of client.javaEntities) {
          if (entity.lceEntityId) {
            entityIdsToRemove.push(entity.lceEntityId);
          }
        }

        if (entityIdsToRemove.length > 0) {
          const maxPerPacket = 255;
          for (let i = 0; i < entityIdsToRemove.length; i += maxPerPacket) {
            const batch = entityIdsToRemove.slice(i, i + maxPerPacket);
            const removeWriter = new PacketWriter();
            removeWriter.writeByte(batch.length);
            for (const id of batch) {
              removeWriter.writeInt(id);
            }
            proxy.sendPacket(client, 0x1d, removeWriter.toBuffer());
          }
        }

        client.javaEntities.clear();
      }

      const respawnWriter = new PacketWriter();
      respawnWriter.writeByte(packet.dimension & 0xff);
      const currentGameMode = client.javaGameMode || 0;
      respawnWriter.writeByte(currentGameMode);
      //nether/end uses 128 height, whilst the overworld uses 256
      const mapHeight = packet.dimension === 0 ? 256 : 128;
      respawnWriter.writeShort(mapHeight); //mapHeight
      respawnWriter.writeString(packet.levelType || "default"); //levelType
      respawnWriter.writeLong(0); //mapSeed
      respawnWriter.writeByte(packet.difficulty || client.javaDifficulty || 1); //difficulty
      respawnWriter.writeBoolean(false); //newSeaLevel
      respawnWriter.writeShort(0); //newEntityId
      respawnWriter.writeShort(864); //xzSize
      respawnWriter.writeByte(8); //hellScale
      proxy.sendPacket(client, 0x09, respawnWriter.toBuffer());

      //we need to update the gamemode after respawn
      //otherwise the game puts you in survival
      //unfortunately on LCE this shows an annoying gamemode change message
      const gameEventWriter = new PacketWriter();
      gameEventWriter.writeByte(3);
      gameEventWriter.writeByte(currentGameMode);
      proxy.sendPacket(client, 0x46, gameEventWriter.toBuffer());

      const abilitiesWriter = new PacketWriter();
      const invulnerable = client.abilities?.invulnerable || false;
      const flying = client.abilities?.flying || false;
      const canFly =
        client.abilities?.canFly ||
        currentGameMode === 1 ||
        currentGameMode === 3;
      const instabuild = currentGameMode === 1;
      let bitfield = 0;
      if (invulnerable) bitfield |= 1;
      if (flying) bitfield |= 2;
      if (canFly) bitfield |= 4;
      if (instabuild) bitfield |= 8;
      abilitiesWriter.writeByte(bitfield);
      abilitiesWriter.writeFloat(0.05); //flySpeed
      abilitiesWriter.writeFloat(0.1); //walkSpeed
      proxy.sendPacket(client, 202, abilitiesWriter.toBuffer());
    }
  });

  javaClient.on("player_info", (packet) => {
    if (true) {
      if (packet.action === 0 || packet.action === "add_player") {
        if (packet.data && packet.data.length > 0) {
          for (const playerData of packet.data) {
            const uuid = playerData.UUID || playerData.uuid;
            if (uuid) {
              const existingPlayer = client.javaPlayers.get(uuid);
              const wasAlreadySpawned =
                existingPlayer && existingPlayer.spawned;

              const updatedPlayer = {
                name: playerData.name || "Player",
                gamemode: playerData.gamemode || 0,
                ping: playerData.ping || 0,
                entityId: existingPlayer ? existingPlayer.entityId : null,
                javaEntityId: existingPlayer
                  ? existingPlayer.javaEntityId
                  : null,
                x: existingPlayer ? existingPlayer.x : 0,
                y: existingPlayer ? existingPlayer.y : 0,
                z: existingPlayer ? existingPlayer.z : 0,
                yaw: existingPlayer ? existingPlayer.yaw : 0,
                pitch: existingPlayer ? existingPlayer.pitch : 0,
                spawned: existingPlayer ? existingPlayer.spawned : false,
                readyToSpawn: existingPlayer
                  ? existingPlayer.readyToSpawn
                  : false,
                needsSpawn: wasAlreadySpawned,
              };

              client.javaPlayers.set(uuid, updatedPlayer);

              if (
                updatedPlayer.readyToSpawn &&
                !updatedPlayer.spawned &&
                updatedPlayer.entityId
              ) {
                updatedPlayer.spawned = true;
                proxy.sendAddPlayerPacket(client, updatedPlayer);
              }
            }
          }
        }
      } else if (packet.action === 4 || packet.action === "remove_player") {
        if (packet.data && packet.data.length > 0) {
          for (const playerData of packet.data) {
            const uuid = playerData.UUID || playerData.uuid;
            if (uuid && client.javaPlayers.has(uuid)) {
              const player = client.javaPlayers.get(uuid);
              if (player.spawned && player.entityId) {
                const removeWriter = new PacketWriter();
                removeWriter.writeByte(1);
                removeWriter.writeInt(player.entityId);
                proxy.sendPacket(client, 0x1d, removeWriter.toBuffer());
              }
              client.javaPlayers.delete(uuid);
            }
          }
        }
      }
    }
  });

  javaClient.on("named_entity_spawn", (packet) => {
    if (client.state === "play") {
      const uuid = packet.playerUUID;
      let playerInfo = client.javaPlayers.get(uuid);

      let playerName = "Player";
      if (packet.metadata && Array.isArray(packet.metadata)) {
        const nameEntry = packet.metadata.find(
          (m) => m.key === 2 && m.type === 4,
        );
        if (nameEntry && nameEntry.value) {
          playerName = nameEntry.value;
        }
      }

      if (!playerInfo) {
        playerInfo = {
          name: playerName,
          gamemode: 0,
          ping: 0,
          entityId: packet.entityId,
          spawned: false,
        };
        client.javaPlayers.set(uuid, playerInfo);
      } else {
        if (playerName !== "Player") {
          playerInfo.name = playerName;
        }
      }

      const lceEntityId = proxy.mapJavaEntityIdToLce(client, packet.entityId);

      playerInfo.entityId = lceEntityId;
      playerInfo.javaEntityId = packet.entityId;
      playerInfo.x = packet.x / 32;
      playerInfo.y = packet.y / 32;
      playerInfo.z = packet.z / 32;
      playerInfo.yaw = (packet.yaw / 256) * 360;
      playerInfo.pitch = (packet.pitch / 256) * 360;

      if (playerInfo.name && playerInfo.name !== "Player") {
        playerInfo.spawned = true;
        try {
          proxy.sendAddPlayerPacket(client, playerInfo);
        } catch (err) {
          /* do nothing */
        }
      } else {
        playerInfo.spawned = false;
        playerInfo.readyToSpawn = true;
      }
    }
  });

  javaClient.on("open_window", (packet) => {
    if (client.state === "play") {
      const windowType = packet.inventoryType || packet.windowType;

      proxy.sendContainerOpenPacket(client, packet);
      client.openWindowId = packet.windowId;
      client.openWindowType = windowType;

      const isChest =
        windowType === "minecraft:chest" ||
        windowType === "minecraft:container";

      if (isChest && client._lastBlockClicked) {
        const pos = client._lastBlockClicked;
        const posKey = `${pos.x},${pos.y},${pos.z}`;

        if (!proxy.openChests.has(posKey)) {
          proxy.openChests.set(posKey, {
            clients: new Set(),
            items: new Array(27).fill(null),
            windowId: packet.windowId,
            position: pos,
          });
        }

        const chestData = proxy.openChests.get(posKey);
        chestData.clients.add(client);

        if (!proxy.clientChests.has(client)) {
          proxy.clientChests.set(client, new Set());
        }
        proxy.clientChests.get(client).add(posKey);

        client._currentChest = { posKey, windowId: packet.windowId };
      }
    }
  });

  javaClient.on("custom_payload", (packet) => {
    if (client.state === "play" && packet.channel === "MC|TrList") {
      const windowId = client.openWindowId || 1;
      proxy.sendVillagerTrades(client, windowId, packet.data);
    }
  });

  javaClient.on("close_window", (packet) => {
    if (client.state === "play") {
      if (
        client._currentChest &&
        client._currentChest.windowId === packet.windowId
      ) {
        const posKey = client._currentChest.posKey;
        const chestData = proxy.openChests.get(posKey);

        if (chestData) {
          chestData.clients.delete(client);

          if (chestData.clients.size === 0) {
            proxy.openChests.delete(posKey);
          }
        }

        if (proxy.clientChests.has(client)) {
          proxy.clientChests.get(client).delete(posKey);
        }

        delete client._currentChest;
      }

      const writer = new PacketWriter();
      writer.writeByte(packet.windowId & 0xff);
      proxy.sendPacket(client, 0x65, writer.toBuffer());
    }
  });

  javaClient.on("transaction", (packet) => {
    if (client.state === "play") {
      const writer = new PacketWriter();
      writer.writeByte(packet.windowId & 0xff);
      writer.writeShort(packet.action);
      writer.writeBoolean(packet.accepted);
      proxy.sendPacket(client, 0x6a, writer.toBuffer());
    }
  });

  javaClient.on("block_change", (packet) => {
    if (client.state === "play") {
      if (!packet.location) {
        return;
      }

      const x = packet.location.x;
      const y = packet.location.y;
      const z = packet.location.z;

      const blockStateId = packet.type;
      const javaBlockId = blockStateId >> 4;
      const metadata = blockStateId & 0xf;

      let lceBlockId = proxy.mapJavaBlockToLCE(javaBlockId);
      let lceMetadata = metadata;

      if (javaBlockId === 162 || javaBlockId === 163) {
        lceBlockId = 17;
        lceMetadata = metadata & 0x3;
      } else if (
        javaBlockId === 31 ||
        javaBlockId === 175 ||
        javaBlockId === 32
      ) {
        lceBlockId = 31;
        lceMetadata = 1;
      }

      if (lceBlockId < 0 || lceBlockId > 170) {
        lceBlockId = 0;
        lceMetadata = 0;
      }

      proxy.sendTileUpdatePacket(client, x, y, z, lceBlockId, lceMetadata);
    }
  });

  javaClient.on("block_action", (packet) => {
    if (client.state === "play") {
      if (!packet.location) {
        return;
      }

      const x = packet.location.x;
      const y = packet.location.y;
      const z = packet.location.z;
      const actionType = packet.byte1; //b0 in LCE
      const actionParam = packet.byte2; //b1 in LCE
      const blockId = packet.blockId;

      const lceBlockId = proxy.mapJavaBlockToLCE(blockId);

      const writer = new PacketWriter();
      writer.writeInt(x);
      writer.writeShort(y & 0xffff);
      writer.writeInt(z);
      writer.writeByte(actionType & 0xff);
      writer.writeByte(actionParam & 0xff);
      writer.writeShort(lceBlockId & 0xffff);
      const tileEventPacket = writer.toBuffer();

      if (
        actionType === 1 &&
        (blockId === 54 || blockId === 130 || blockId === 146)
      ) {
        //chest, ender chest, trapped chest
        const posKey = `${x},${y},${z}`;
        const chestData = proxy.openChests.get(posKey);

        if (chestData && chestData.clients.size > 0) {
          for (const otherClient of chestData.clients) {
            proxy.sendPacket(otherClient, 0x36, tileEventPacket);
          }
        } else {
          proxy.sendPacket(client, 0x36, tileEventPacket);
        }
      } else {
        proxy.sendPacket(client, 0x36, tileEventPacket); //TileEventPacket
      }
    }
  });

  javaClient.on("world_event", (packet) => {
    if (client.state === "play") {
      if (packet.effectId === 2001 && packet.location) {
        const blockId = packet.data & 0xfff;
        const metadata = (packet.data >> 12) & 0xf;
        const x = packet.location.x;
        const y = packet.location.y;
        const z = packet.location.z;

        if (blockId <= 0 || blockId > 255) {
          return;
        }

        //const particleName = `blockcrack_${blockId}_${metadata}`;
        //proxy.sendLevelParticlesPacket(
        //  client,
        //  particleName,
        //  x + 0.5,
        //  y + 0.5,
        //  z + 0.5,
        //  0.4,
        //  0.4,
        //  0.4,
        //  0.0,
        //  30,
        //);
      }
    }
  });

  javaClient.on("world_particles", (packet) => {
    if (client.state === "play") {
      const particleName = proxy.mapJavaParticleToLCE(packet.particleId);
      if (!particleName) {
        return;
      }

      if (!particleName || particleName.trim().length === 0) {
        return;
      }

      if (
        particleName.startsWith("blockcrack_") ||
        particleName.startsWith("iconcrack_")
      ) {
        const parts = particleName.split("_");
        if (parts.length >= 3) {
          const id = parseInt(parts[1]);
          if (isNaN(id) || id < 0 || id > 255) {
            return;
          }
        }
      }

      //proxy.sendLevelParticlesPacket(
      //  client,
      //  particleName,
      //  packet.x,
      //  packet.y,
      //  packet.z,
      //  packet.offsetX,
      //  packet.offsetY,
      //  packet.offsetZ,
      //  packet.particleData,
      //  packet.particleCount,
      //);
    }
  });

  javaClient.on("multi_block_change", (packet) => {
    if (client.state === "play") {
      if (!packet.records || packet.records.length === 0) {
        return;
      }

      for (const record of packet.records) {
        const horizontalPos = record.horizontalPos;
        const localX = (horizontalPos >> 4) & 0xf;
        const localZ = horizontalPos & 0xf;
        const x = (packet.chunkX << 4) + localX;
        const z = (packet.chunkZ << 4) + localZ;
        const y = record.y;

        const blockStateId = record.blockId;
        const javaBlockId = blockStateId >> 4;
        const metadata = blockStateId & 0xf;

        let lceBlockId = proxy.mapJavaBlockToLCE(javaBlockId);
        let lceMetadata = metadata;

        if (javaBlockId === 162 || javaBlockId === 163) {
          lceBlockId = 17;
          lceMetadata = metadata & 0x3;
        } else if (
          javaBlockId === 31 ||
          javaBlockId === 175 ||
          javaBlockId === 32
        ) {
          lceBlockId = 31;
          lceMetadata = 1;
        }

        if (lceBlockId < 0 || lceBlockId > 170) {
          lceBlockId = 0;
          lceMetadata = 0;
        }

        proxy.sendTileUpdatePacket(client, x, y, z, lceBlockId, lceMetadata);
      }
    }
  });

  //who tf doesn't like explosions??
  javaClient.on("explosion", (packet) => {
    if (client.state === "play") {
      const writer = new PacketWriter(60);

      writer.writeBoolean(false);

      writer.writeDouble(packet.x);
      writer.writeDouble(packet.y);
      writer.writeDouble(packet.z);

      writer.writeFloat(packet.radius);

      writer.writeInt(packet.affectedBlockOffsets.length);

      for (const offset of packet.affectedBlockOffsets) {
        writer.writeSignedByte(offset.x);
        writer.writeSignedByte(offset.y);
        writer.writeSignedByte(offset.z);
      }

      writer.writeFloat(packet.playerMotionX);
      writer.writeFloat(packet.playerMotionY);
      writer.writeFloat(packet.playerMotionZ);

      proxy.sendPacket(client, 60, writer.toBuffer());
    }
  });

  javaClient.on("spawn_entity_living", (packet) => {
    if (client.state === "play") {
      const javaType = proxy.getJavaEntityType(packet.type);
      const lceEntityType = proxy.javaEntityTypeMapping[javaType];

      if (!lceEntityType) {
        return;
      }

      if (lceEntityType < 0 || lceEntityType > 200) {
        return;
      }

      const lceEntityId = proxy.mapJavaEntityIdToLce(client, packet.entityId);

      const entityInfo = {
        entityId: lceEntityId,
        javaEntityId: packet.entityId,
        type: lceEntityType,
        javaType: javaType,
        x: packet.x / 32,
        y: packet.y / 32,
        z: packet.z / 32,
        yaw: (packet.yaw / 256) * 360,
        pitch: (packet.pitch / 256) * 360,
        headYaw: (packet.headPitch / 256) * 360,
        prevYaw: (packet.yaw / 256) * 360,
        prevPitch: (packet.pitch / 256) * 360,
        velocityX: packet.velocityX / 8000,
        velocityY: packet.velocityY / 8000,
        velocityZ: packet.velocityZ / 8000,
        metadata: packet.metadata || [],
      };

      entityInfo.spawnTime = Date.now();

      client.javaEntities.set(packet.entityId, entityInfo);

      try {
        proxy.sendAddMobPacket(client, entityInfo);
      } catch (err) {
        return;
      }

      const relevantMetadata = entityInfo.metadata.filter((m) => {
        return [12, 13, 16].includes(m.key) && m.type !== 5;
      });

      if (relevantMetadata.length > 0) {
        try {
          proxy.sendEntityMetadataPacket(client, entityInfo, relevantMetadata);
        } catch (err) {
          /* do nothing */
        }
      }
    }
  });

  javaClient.on("spawn_entity", (packet) => {
    if (client.state === "play") {
      let lceEntityType = packet.type;

      if (packet.type === 10) {
        lceEntityType = 10;
        const minecartSubtype = packet.intField || 0;
        const minecartTypes = [
          "Rideable",
          "Chest",
          "Furnace",
          "TNT",
          "Spawner",
          "Hopper",
        ];
        const minecartType = minecartTypes[minecartSubtype] || "Unknown";
      }

      let fallingBlockData = null;
      if (packet.type === 70) {
        const javaBlockId = packet.intField & 0xfff;
        const metadata = (packet.intField >> 12) & 0xf;

        const lceBlockId = proxy.mapJavaBlockToLCE(javaBlockId);

        fallingBlockData = lceBlockId | (metadata << 16);
      }

      if (lceEntityType < 0 || lceEntityType > 200) {
        return;
      }

      const lceEntityId = proxy.mapJavaEntityIdToLce(client, packet.entityId);

      let velocityX = 0,
        velocityY = 0,
        velocityZ = 0;
      if (packet.objectData) {
        velocityX = packet.objectData.velocityX || 0;
        velocityY = packet.objectData.velocityY || 0;
        velocityZ = packet.objectData.velocityZ || 0;
      }

      let arrowData = -1;
      if (lceEntityType === 60) {
        arrowData = lceEntityId;
        const javaYaw = (packet.yaw / 256) * 360;
        const javaPitch = (packet.pitch / 256) * 360;
      }

      let fishingHookData = -1;
      if (lceEntityType === 90) {
        const javaOwnerId = packet.intField || packet.entityId;

        if (javaOwnerId === client.javaPlayerEntityId) {
          fishingHookData = client.lcePlayerEntityId || 1;
        } else {
          fishingHookData =
            proxy.mapJavaEntityIdToLce(client, javaOwnerId) || lceEntityId;
        }
      }

      const entityInfo = {
        entityId: lceEntityId,
        javaEntityId: packet.entityId,
        type: lceEntityType,
        x: packet.x / 32,
        y: packet.y / 32,
        z: packet.z / 32,
        yaw: lceEntityType === 60 ? 0 : (packet.yaw / 256) * 360,
        pitch: lceEntityType === 60 ? 0 : (packet.pitch / 256) * 360,
        data:
          lceEntityType === 2
            ? 1
            : lceEntityType === 60
              ? arrowData
              : lceEntityType === 90
                ? fishingHookData
                : lceEntityType === 63 || lceEntityType === 64
                  ? 0
                  : lceEntityType === 70
                    ? fallingBlockData
                    : lceEntityType === 10
                      ? packet.intField || 0
                      : packet.objectData?.intField || -1,
        velocityX: velocityX,
        velocityY: velocityY,
        velocityZ: velocityZ,
      };

      entityInfo.spawnTime = Date.now();

      client.javaEntities.set(packet.entityId, entityInfo);

      try {
        proxy.sendAddEntityPacket(client, entityInfo);
      } catch (err) {
        return;
      }

      if (lceEntityType === 2) {
        entityInfo.waitingForItemData = true;
      }

      if (lceEntityType === 10) {
        const minecartMetadata = [];
        const minecartSubtype = packet.intField || 0;
        let displayBlockId = 0;
        switch (minecartSubtype) {
          case 1:
            displayBlockId = 54;
            break; //chest
          case 2:
            displayBlockId = 61;
            break; //furnace
          case 3:
            displayBlockId = 46;
            break; //tNT
          case 5:
            displayBlockId = 154;
            break; //hopper
          case 4:
            displayBlockId = 52;
            break; //spawner
          default:
            displayBlockId = 0;
            break; //no display
        }
        if (displayBlockId > 0) {
          minecartMetadata.push({ key: 20, type: 2, value: displayBlockId });
          minecartMetadata.push({ key: 21, type: 2, value: 6 });
          minecartMetadata.push({ key: 22, type: 0, value: 1 });
          proxy.sendEntityMetadataPacket(client, entityInfo, minecartMetadata);
          const minecartTypes = [
            "Rideable",
            "Chest",
            "Furnace",
            "TNT",
            "Spawner",
            "Hopper",
          ];
          const cartType = minecartTypes[minecartSubtype] || "Unknown";
        }
      }
    }
  });

  javaClient.on("rel_entity_move", (packet) => {
    if (client.state === "play") {
      let isPlayer = false;
      for (const [uuid, player] of client.javaPlayers) {
        if (player.javaEntityId === packet.entityId && player.spawned) {
          player.x += packet.dX / 32;
          player.y += packet.dY / 32;
          player.z += packet.dZ / 32;

          proxy.sendMoveEntityPacket(client, player);
          isPlayer = true;
          break;
        }
      }

      if (!isPlayer && client.javaEntities.has(packet.entityId)) {
        const entity = client.javaEntities.get(packet.entityId);
        entity.x += packet.dX / 32;
        entity.y += packet.dY / 32;
        entity.z += packet.dZ / 32;

        proxy.sendMoveEntityPacketForEntity(
          client,
          entity,
          packet.dX,
          packet.dY,
          packet.dZ,
        );
      }
    }
  });

  javaClient.on("entity_move_look", (packet) => {
    if (client.state === "play") {
      let isPlayer = false;
      for (const [uuid, player] of client.javaPlayers) {
        if (player.javaEntityId === packet.entityId && player.spawned) {
          player.x += packet.dX / 32;
          player.y += packet.dY / 32;
          player.z += packet.dZ / 32;
          player.yaw = (packet.yaw / 256) * 360;
          player.pitch = (packet.pitch / 256) * 360;

          proxy.sendMoveEntityPacket(client, player);
          isPlayer = true;
          break;
        }
      }

      if (!isPlayer && client.javaEntities.has(packet.entityId)) {
        const entity = client.javaEntities.get(packet.entityId);
        entity.x += packet.dX / 32;
        entity.y += packet.dY / 32;
        entity.z += packet.dZ / 32;
        entity.yaw = (packet.yaw / 256) * 360;
        entity.pitch = (packet.pitch / 256) * 360;

        proxy.sendMoveEntityPacketForEntity(
          client,
          entity,
          packet.dX,
          packet.dY,
          packet.dZ,
          true,
        );
        proxy.sendRotateHeadPacketForEntity(client, entity);
      }
    }
  });

  javaClient.on("entity_head_rotation", (packet) => {
    if (client.state === "play" && client.javaEntities.has(packet.entityId)) {
      const entity = client.javaEntities.get(packet.entityId);
      entity.headYaw = (packet.headYaw / 256) * 360;

      proxy.sendRotateHeadPacketForEntity(client, entity);
    }
  });

  javaClient.on("entity_look", (packet) => {
    if (client.state === "play") {
      let isPlayer = false;
      for (const [uuid, player] of client.javaPlayers) {
        if (player.javaEntityId === packet.entityId && player.spawned) {
          player.yaw = (packet.yaw / 256) * 360;
          player.pitch = (packet.pitch / 256) * 360;

          proxy.sendMoveEntityPacket(client, player);
          isPlayer = true;
          break;
        }
      }

      if (!isPlayer && client.javaEntities.has(packet.entityId)) {
        const entity = client.javaEntities.get(packet.entityId);
        entity.yaw = (packet.yaw / 256) * 360;
        entity.pitch = (packet.pitch / 256) * 360;
        if (entity.headYaw === undefined) {
          entity.headYaw = entity.yaw;
        }

        proxy.sendRotateEntityPacketForEntity(client, entity);
        proxy.sendRotateHeadPacketForEntity(client, entity);
      }
    }
  });

  javaClient.on("entity_teleport", (packet) => {
    if (client.state === "play") {
      let isPlayer = false;
      for (const [uuid, player] of client.javaPlayers) {
        if (player.javaEntityId === packet.entityId) {
          player.x = packet.x / 32;
          player.y = packet.y / 32;
          player.z = packet.z / 32;
          player.yaw = (packet.yaw / 256) * 360;
          player.pitch = (packet.pitch / 256) * 360;

          if (!player.spawned) {
            if (player.name && player.name !== "undefined") {
              const lceEntityId = proxy.mapJavaEntityIdToLce(
                client,
                packet.entityId,
              );
              player.entityId = lceEntityId;

              player.spawned = true;
              proxy.sendAddPlayerPacket(client, player);
            }
          } else {
            proxy.sendTeleportEntityPacket(client, player);
          }
          isPlayer = true;
          break;
        }
      }

      if (!isPlayer && client.javaEntities.has(packet.entityId)) {
        const entity = client.javaEntities.get(packet.entityId);
        entity.x = packet.x / 32;
        entity.y = packet.y / 32;
        entity.z = packet.z / 32;
        entity.yaw = (packet.yaw / 256) * 360;
        entity.pitch = (packet.pitch / 256) * 360;

        proxy.sendTeleportEntityPacketForEntity(client, entity);
      }
    }
  });

  javaClient.on("bed", (packet) => {
    if (client.state === "play") {
      for (const [uuid, player] of client.javaPlayers) {
        if (player.javaEntityId === packet.entityId && player.spawned) {
          player.sleeping = true;
          player.bedX = packet.location.x;
          player.bedY = packet.location.y;
          player.bedZ = packet.location.z;

          const sleepWriter = new PacketWriter();
          sleepWriter.writeInt(player.entityId);
          sleepWriter.writeByte(0); //0=start sleep
          sleepWriter.writeInt(packet.location.x);
          sleepWriter.writeByte(packet.location.y & 0xff);
          sleepWriter.writeInt(packet.location.z);
          proxy.sendPacket(client, 0x11, sleepWriter.toBuffer());

          break;
        }
      }
    }
  });

  javaClient.on("use_bed", (packet) => {
    if (client.state === "play") {
      for (const [uuid, player] of client.javaPlayers) {
        if (player.javaEntityId === packet.entityId && player.spawned) {
          player.sleeping = true;
          player.bedX = packet.location.x;
          player.bedY = packet.location.y;
          player.bedZ = packet.location.z;

          const metaWriter = new PacketWriter();
          metaWriter.writeInt(player.entityId);

          metaWriter.writeByte((0 << 5) | 0);
          metaWriter.writeByte(0x04);

          metaWriter.writeByte(0x7f);
          proxy.sendPacket(client, 0x28, metaWriter.toBuffer());

          break;
        }
      }
    }
  });

  javaClient.on("entity_status", (packet) => {
    if (client.state === "play") {
      if (packet.entityId === client.javaPlayerEntityId) {
        if (packet.entityStatus === 2 || packet.entityStatus === 3) {
          const eventWriter = new PacketWriter();
          eventWriter.writeInt(client.smallId);
          eventWriter.writeByte(packet.entityStatus);
          proxy.sendPacket(client, 0x26, eventWriter.toBuffer());
        }
        return;
      }

      if (client.javaEntities.has(packet.entityId)) {
        const entity = client.javaEntities.get(packet.entityId);

        if (packet.entityStatus === 3) {
          if (!client._deadEntities) client._deadEntities = new Set();
          if (!client._destroyedEntities) client._destroyedEntities = new Set();
          client._deadEntities.add(packet.entityId);
          client._destroyedEntities.add(entity.entityId);
        }

        proxy.sendEntityEventPacket(client, entity, packet.entityStatus);
      }

      let foundPlayer = false;
      for (const [uuid, player] of client.javaPlayers) {
        if (player.javaEntityId === packet.entityId && player.spawned) {
          foundPlayer = true;
          const fakeEntity = { entityId: player.entityId };
          proxy.sendEntityEventPacket(client, fakeEntity, packet.entityStatus);

          if (packet.entityStatus === 3) {
            if (!client._dyingPlayers) client._dyingPlayers = new Map();
            client._dyingPlayers.set(player.javaEntityId, Date.now());
          }
          break;
        }
      }

      //if (!foundPlayer && packet.entityStatus === 3) {
      //    console.log(`wtf?? a fucking ghost just died ${packet.entityId}`);
      //}
    }
  });

  javaClient.on("animation", (packet) => {
    if (client.state === "play") {
      for (const [uuid, player] of client.javaPlayers) {
        if (player.javaEntityId === packet.entityId && player.spawned) {
          //LCE: 1=SWING, 2=HURT, 3=WAKE_UP, 4=CRITICAL_HIT, 5=MAGIC_CRITICAL_HIT
          //java: 0=swing, 1=damage, 2=leave_bed, 3=offhand, 4=critical, 5=magic_critical

          let lceAnimation;
          switch (packet.animation) {
            case 0:
              lceAnimation = 1;
              break;
            case 1:
              lceAnimation = 2;
              break;
            case 2:
              lceAnimation = 3;
              if (player.sleeping) {
                player.sleeping = false;
              }
              break;
            case 3:
              lceAnimation = 1;
              break;
            case 4:
              lceAnimation = 6;
              break;
            case 5:
              lceAnimation = 7;
              break;
            default:
              lceAnimation = 1;
              break;
          }

          const animWriter = new PacketWriter();
          animWriter.writeInt(player.entityId);
          animWriter.writeByte(lceAnimation);
          proxy.sendPacket(client, 0x12, animWriter.toBuffer());
          break;
        }
      }

      if (client.javaEntities.has(packet.entityId)) {
        const entity = client.javaEntities.get(packet.entityId);

        let lceAnimation;
        switch (packet.animation) {
          case 0:
            lceAnimation = 1;
            break;
          case 1:
            lceAnimation = 2;
            break;
          case 2:
            lceAnimation = 3;
            break;
          case 3:
            lceAnimation = 1;
            break;
          case 4:
            lceAnimation = 6;
            break;
          case 5:
            lceAnimation = 7;
            break;
          default:
            lceAnimation = 1;
            break;
        }

        const animWriter = new PacketWriter();
        animWriter.writeInt(entity.entityId);
        animWriter.writeByte(lceAnimation);
        proxy.sendPacket(client, 0x12, animWriter.toBuffer());
      }
    }
  });

  javaClient.on("entity_equipment", (packet) => {
    if (client.state === "play") {
      let handled = false;
      for (const [uuid, player] of client.javaPlayers) {
        if (player.javaEntityId === packet.entityId && player.spawned) {
          if (
            packet.item &&
            packet.item.blockId !== undefined &&
            packet.item.blockId !== -1
          ) {
            proxy.sendSetEquippedItemPacket(
              client,
              player,
              packet.slot,
              packet.item,
            );
          } else {
            proxy.sendSetEquippedItemPacket(client, player, packet.slot, {
              blockId: -1,
            });
          }
          handled = true;
          break;
        }
      }

      if (!handled && client.javaEntities.has(packet.entityId)) {
        const entity = client.javaEntities.get(packet.entityId);

        if (
          packet.item &&
          packet.item.blockId !== undefined &&
          packet.item.blockId !== -1
        ) {
          proxy.sendSetEquippedItemPacket(
            client,
            entity,
            packet.slot,
            packet.item,
          );
        }
      }
    }
  });

  javaClient.on("entity_metadata", (packet) => {
    if (client.state === "play") {
      let isPlayer = false;
      for (const [uuid, player] of client.javaPlayers) {
        if (player.javaEntityId === packet.entityId && player.spawned) {
          //0x01=on fire, 0x02=sneaking, 0x04=unused, 0x08=sprinting, 0x10=eating, 0x20=invisible
          if (packet.metadata && packet.metadata.length > 0) {
            const sharedFlags = packet.metadata.find(
              (m) => m.key === 0 && m.type === 0,
            );
            if (sharedFlags !== undefined) {
              const flags = sharedFlags.value & 0xff;

              const metaWriter = new PacketWriter();
              metaWriter.writeInt(player.entityId);
              metaWriter.writeByte((0 << 5) | 0);
              metaWriter.writeByte(flags);
              metaWriter.writeByte(0x7f);
              proxy.sendPacket(client, 0x28, metaWriter.toBuffer());
            }
          }
          isPlayer = true;
          break;
        }
      }

      if (!isPlayer && client.javaEntities.has(packet.entityId)) {
        const entity = client.javaEntities.get(packet.entityId);
        entity.metadata = packet.metadata || [];

        if (entity.type === 90 && packet.metadata) {
          const hookedEntityMeta = packet.metadata.find((m) => m.key === 6);
          if (hookedEntityMeta) {
            if (hookedEntityMeta.value > 0) {
              const hookedJavaEntityId = hookedEntityMeta.value;
              const hookedLceEntityId = proxy.mapJavaEntityIdToLce(
                client,
                hookedJavaEntityId,
              );
              entity.hookedEntityId = hookedLceEntityId;
            }
          }
        }

        //if (entity.type === 10) {
        //    console.log('minecart', entity.type, entity.entityId, JSON.stringify(packet.metadata));
        //}

        if (
          entity.type === 2 &&
          entity.waitingForItemData &&
          packet.metadata &&
          packet.metadata.length > 0
        ) {
          const itemMetadata = packet.metadata.find(
            (m) => m.key === 10 && m.type === 5,
          );
          if (itemMetadata && itemMetadata.value) {
            proxy.sendSetItemDataPacket(client, entity, itemMetadata.value);
            entity.waitingForItemData = false;
          }
        }

        const customNameMeta = packet.metadata.find(
          (m) => m.key === 2 && m.type === 4,
        );
        const customNameVisibleMeta = packet.metadata.find(
          (m) => m.key === 3 && m.type === 0,
        );

        const lceMetadata = [];

        if (customNameMeta && customNameMeta.value) {
          lceMetadata.push({
            key: 10,
            type: 4,
            value: customNameMeta.value,
          });
        }

        if (customNameVisibleMeta !== undefined) {
          lceMetadata.push({
            key: 11,
            type: 0,
            value: customNameVisibleMeta.value,
          });
        }

        const relevantMetadata = packet.metadata.filter((m) => {
          if (entity.type === 10) {
            if ([20, 21, 22].includes(m.key)) {
              return false;
            }
          }

          //0=shared flags (e.g. on fire, sneaking, sprinting)
          //12=age
          //13=skeleton type
          //16=villager profession or slime/magma size
          //17=batman hanging flag - 0x01 = hanging
          return [0, 12, 13, 16, 17].includes(m.key) && m.type !== 5;
        });

        const allMetadata = [...lceMetadata, ...relevantMetadata];

        if (allMetadata.length > 0 && entity.type !== 2) {
          proxy.sendEntityMetadataPacket(client, entity, allMetadata);
        }
      }
    }
  });

  javaClient.on("entity_velocity", (packet) => {
    try {
      if (client.state === "play") {
        if (!packet || packet.entityId === undefined) {
          return;
        }

        if (packet.entityId === client.javaPlayerEntityId) {
          const localPlayerEntity = {
            entityId: client.smallId,
            velocityX: packet.velocityX,
            velocityY: packet.velocityY,
            velocityZ: packet.velocityZ,
          };
          proxy.sendSetEntityMotionPacket(client, localPlayerEntity);
          return;
        }

        if (client.javaEntities.has(packet.entityId)) {
          const entity = client.javaEntities.get(packet.entityId);
          entity.velocityX = packet.velocityX;
          entity.velocityY = packet.velocityY;
          entity.velocityZ = packet.velocityZ;

          proxy.sendSetEntityMotionPacket(client, entity);
          return;
        }

        for (const [uuid, player] of client.javaPlayers) {
          if (
            player.javaEntityId === packet.entityId &&
            player.spawned &&
            player.entityId !== undefined
          ) {
            const playerEntity = {
              entityId: player.entityId,
              velocityX: packet.velocityX,
              velocityY: packet.velocityY,
              velocityZ: packet.velocityZ,
            };
            proxy.sendSetEntityMotionPacket(client, playerEntity);
            return;
          }
        }
      }
    } catch (err) {
      /* do nothing */
    }
  });

  javaClient.on("attach_entity", (packet) => {
    if (client.state === "play") {
      const riderJavaId = packet.entityId;
      const vehicleJavaId = packet.vehicleId;

      let riderId = -1;
      let riddenId = -1;

      if (riderJavaId === client.javaPlayerEntityId) {
        riderId = client.lcePlayerEntityId || client.smallId;
      } else {
        for (const [uuid, player] of client.javaPlayers) {
          if (player.javaEntityId === riderJavaId && player.spawned) {
            riderId = player.entityId;
            break;
          }
        }

        if (riderId === -1 && client.javaEntities.has(riderJavaId)) {
          riderId = client.javaEntities.get(riderJavaId).entityId;
        }
      }

      if (vehicleJavaId !== -1) {
        if (client.javaEntities.has(vehicleJavaId)) {
          riddenId = client.javaEntities.get(vehicleJavaId).entityId;
        }
      } else {
        riddenId = -1;
      }

      if (riderId !== -1) {
        const RIDING = 0;
        const LEASH = 1;
        const linkType = packet.leash ? LEASH : RIDING;
        proxy.sendSetEntityLinkPacket(client, riderId, riddenId, linkType);
      }
    }
  });

  javaClient.on("entity_destroy", (packet) => {
    if (client.state === "play") {
      const entityIds = packet.entityIds || [];
      const idsToRemove = [];

      if (!client._destroyedEntities) client._destroyedEntities = new Set();

      for (const entityId of entityIds) {
        let isPlayer = false;
        for (const [uuid, player] of client.javaPlayers) {
          if (player.javaEntityId === entityId && player.spawned) {
            const deathEvent = { entityId: player.entityId };
            proxy.sendEntityEventPacket(client, deathEvent, 3);

            const lceEntityId = player.entityId;
            const javaEntityId = entityId;

            player.spawned = false;
            client._destroyedEntities.add(lceEntityId);

            if (client.javaEntities.has(javaEntityId)) {
              client.javaEntities.delete(javaEntityId);
            }
            if (client.javaToLceEntityId.has(javaEntityId)) {
              client.javaToLceEntityId.delete(javaEntityId);
            }

            setTimeout(() => {
              if (
                client._destroyedEntities &&
                client._destroyedEntities.has(lceEntityId)
              ) {
                const removeWriter = new PacketWriter();
                removeWriter.writeByte(1);
                removeWriter.writeInt(lceEntityId);
                proxy.sendPacket(client, 0x1d, removeWriter.toBuffer());

                client._destroyedEntities.delete(lceEntityId);
              }
            }, 1050);

            isPlayer = true;
            break;
          }
        }

        if (!isPlayer && client.javaEntities.has(entityId)) {
          const entity = client.javaEntities.get(entityId);
          idsToRemove.push(entity.entityId);
          client._destroyedEntities.add(entity.entityId);

          if (client._lastAttacks) {
            client._lastAttacks.delete(entity.entityId);
          }

          if (client._pendingAttacks) {
            client._pendingAttacks.delete(entityId);
          }

          client.javaEntities.delete(entityId);
        }
      }

      if (idsToRemove.length > 0) {
        const maxPerPacket = 255;
        for (let i = 0; i < idsToRemove.length; i += maxPerPacket) {
          const batch = idsToRemove.slice(i, i + maxPerPacket);
          const removeWriter = new PacketWriter();
          removeWriter.writeByte(batch.length);
          for (const id of batch) {
            removeWriter.writeInt(id);
          }
          proxy.sendPacket(client, 0x1d, removeWriter.toBuffer());
        }
      }
    }
  });

  javaClient.on("named_sound_effect", (packet) => {
    try {
      if (client.state === "play") {
        const lceSoundId = mapJavaSoundToLCE(packet.soundName);

        if (lceSoundId !== -1) {
          const x = packet.x / 8;
          const y = packet.y / 8;
          const z = packet.z / 8;
          const volume = packet.volume;
          const pitch = packet.pitch / 63.0;

          proxy.sendLevelSoundPacket(
            client,
            lceSoundId,
            x,
            y,
            z,
            volume,
            pitch,
          );
        }
      }
    } catch (err) {
      /* do nothing */
    }
  });

  javaClient.on("position", (packet) => {
    client.javaSpawnX = packet.x;
    client.javaSpawnY = packet.y;
    client.javaSpawnZ = packet.z;
    client.javaYaw = packet.yaw;
    client.javaPitch = packet.pitch;

    if (client.state === "login") {
      client.state = "play";
      client.loadedChunks = new Set();
      client.heldSlot = 0;
      client.inventory = {};
      proxy.sendLCELoginResponse(client);
    } else if (client.state === "play") {
      const lceY = packet.y + 1.65;
      const moveWriter = new PacketWriter();
      moveWriter.writeDouble(packet.x);
      moveWriter.writeDouble(lceY);
      moveWriter.writeDouble(lceY + 1.62);
      moveWriter.writeDouble(packet.z);
      moveWriter.writeFloat(packet.yaw);
      moveWriter.writeFloat(packet.pitch);
      moveWriter.writeByte(0x01);
      proxy.sendPacket(client, 0x0d, moveWriter.toBuffer());

      if (client.javaClient && client.javaClient.write) {
        try {
          client.javaClient.write("position_look", {
            x: packet.x,
            y: packet.y,
            z: packet.z,
            yaw: packet.yaw,
            pitch: packet.pitch,
            onGround: true,
          });
        } catch (err) {}
      }
    }
  });

  javaClient.on("map_chunk", (packet) => {
    if (!client.isViaVersion) {
      client.isViaVersion = true;
    }

    const chunkData = packet.chunkData || packet.data;
    if (!chunkData || chunkData.length === 0) {
      return;
    }

    convertAndSendJavaChunk(proxy, client, {
      x: packet.x,
      z: packet.z,
      bitMap: packet.bitMap,
      data: chunkData,
      groundUp: packet.groundUp,
    });
  });

  javaClient.on("map_chunk_bulk", (packet) => {
    if (!packet.meta || !packet.data) {
      return;
    }

    let decompressed = packet.data;

    let offset = 0;
    for (let i = 0; i < packet.meta.length; i++) {
      const chunkMeta = packet.meta[i];
      const chunkX = chunkMeta.x;
      const chunkZ = chunkMeta.z;
      const bitMap = chunkMeta.bitMap;

      //overworld: 4096 blocks * 2 bytes + 2048 block light + 2048 sky light = 12288
      //nether/end: 4096 blocks * 2 bytes + 2048 block light (no sky light) = 10240
      const sectionsCount = countSetBits(bitMap);
      const hasSkyLight = client.javaDimension === 0;
      const bytesPerSection = hasSkyLight ? 12288 : 10240;
      const chunkDataSize = sectionsCount * bytesPerSection;
      const biomeSize = 256;
      const totalSize = chunkDataSize + biomeSize;

      if (offset + totalSize > decompressed.length) {
        break;
      }

      const chunkData = decompressed.slice(offset, offset + totalSize);
      offset += totalSize;

      convertAndSendJavaChunk(proxy, client, {
        x: chunkX,
        z: chunkZ,
        bitMap: bitMap,
        data: chunkData,
        groundUp: true,
      });
      //proxy.sendFlatChunk(client, chunkX, chunkZ);
    }
  });
}

function convertAndSendJavaChunk(proxy, client, javaChunk) {
  if (!javaChunk || !javaChunk.data || javaChunk.data.length === 0) {
    return;
  }

  if (!Number.isFinite(javaChunk.x) || !Number.isFinite(javaChunk.z)) {
    return;
  }

  if (Math.abs(javaChunk.x) > 1875000 || Math.abs(javaChunk.z) > 1875000) {
    return;
  }

  const visWriter = new PacketWriter();
  visWriter.writeInt(javaChunk.x);
  visWriter.writeInt(javaChunk.z);
  visWriter.writeByte(1);
  proxy.sendPacket(client, 0x32, visWriter.toBuffer());

  //nether/end uses 128 height, whilst the overworld uses 256
  const chunkHeight = client.javaDimension === 0 ? 256 : 128;
  const blockCount = 16 * chunkHeight * 16;
  const halfBlockCount = blockCount / 2;
  const biomeSize = 16 * 16;
  const rawSize = blockCount + 3 * halfBlockCount + biomeSize;
  const rawData = Buffer.alloc(rawSize);

  let totalBlocksConverted = 0;
  let nonAirBlocks = 0;

  let offset = 0;

  if (javaChunk.bitMap && javaChunk.data) {
    const javaData = javaChunk.data;
    const bitMap = javaChunk.bitMap;

    let sectionCount = 0;
    for (let i = 0; i < 16; i++) {
      if (bitMap & (1 << i)) sectionCount++;
    }

    const BLOCKS_PER_SECTION = 16 * 16 * 16;
    const BYTES_PER_SECTION = BLOCKS_PER_SECTION * 2;

    let dataOffset = 0;

    const lceSections = chunkHeight / 16;
    for (let sectionY = 0; sectionY < 16; sectionY++) {
      const sectionBit = 1 << sectionY;

      if ((bitMap & sectionBit) === 0) {
        continue;
      }

      const baseY = sectionY * 16;

      let blocksRead = 0;
      const firstBlocksInSection = [];
      for (let sy = 0; sy < 16; sy++) {
        for (let sz = 0; sz < 16; sz++) {
          for (let sx = 0; sx < 16; sx++) {
            if (dataOffset + 1 < javaData.length) {
              const blockStateId = javaData.readUInt16LE(dataOffset);
              const javaBlockId = blockStateId >> 4;
              const metadata = blockStateId & 0x0f;
              dataOffset += 2;

              if (
                client.javaDimension === -1 &&
                javaChunk.x === 0 &&
                javaChunk.z === 0 &&
                (sectionY === 0 || sectionY === 8) &&
                blocksRead < 20
              ) {
                firstBlocksInSection.push(javaBlockId);
              }
              blocksRead++;

              let lceBlockId = proxy.mapJavaBlockToLCE(javaBlockId);
              let lceMetadata = metadata;

              if (lceBlockId > 170 || lceBlockId < 0) {
                lceBlockId = 0;
                lceMetadata = 0;
              }

              if (javaBlockId === 162 || javaBlockId === 163) {
                const orientation = metadata & 0x0c;
                lceMetadata = orientation;
              }

              if (javaBlockId === 31) {
                lceBlockId = 31;
                lceMetadata = 1;
              } else if (javaBlockId === 175) {
                lceBlockId = 31;
                lceMetadata = 1;
              } else if (javaBlockId === 32) {
                lceBlockId = 31;
                lceMetadata = 1;
              }

              if (lceBlockId < 0 || lceBlockId > 174) {
                lceBlockId = 0;
              }
              if (lceMetadata < 0 || lceMetadata > 15) {
                lceMetadata = 0;
              }

              totalBlocksConverted++;
              if (lceBlockId !== 0) {
                nonAirBlocks++;
              }

              const absoluteY = baseY + sy;

              if (absoluteY < chunkHeight) {
                const blockIdx = (absoluteY * 16 + sz) * 16 + sx;
                if (blockIdx < 0 || blockIdx >= blockCount) {
                  continue;
                }
                if (lceBlockId < 0 || lceBlockId > 255) {
                  lceBlockId = 0;
                }
                rawData[blockIdx] = lceBlockId;

                const metadataOffset = blockCount;
                const sectionHeight = 128;
                const yEven = absoluteY & 0xfffffffe;

                let nibbleOffset;
                if (chunkHeight <= 128 || absoluteY < sectionHeight) {
                  nibbleOffset =
                    sx * ((16 * sectionHeight) / 2) +
                    sz * (sectionHeight / 2) +
                    yEven / 2;
                } else {
                  const lowerNibbleCount = 16 * 16 * (sectionHeight / 2);
                  const upperY = absoluteY - sectionHeight;
                  const upperYEven = upperY & 0xfffffffe;
                  const upperSectionHeight = chunkHeight - sectionHeight;
                  nibbleOffset =
                    lowerNibbleCount +
                    sx * ((16 * upperSectionHeight) / 2) +
                    sz * (upperSectionHeight / 2) +
                    upperYEven / 2;
                }

                if (
                  metadataOffset + nibbleOffset >=
                  blockCount + halfBlockCount
                ) {
                  continue;
                }

                if (lceMetadata < 0 || lceMetadata > 15) {
                  lceMetadata = 0;
                }

                const isUpperNibble = (absoluteY & 1) === 1;

                if (isUpperNibble) {
                  rawData[metadataOffset + nibbleOffset] =
                    (rawData[metadataOffset + nibbleOffset] & 0x0f) |
                    (lceMetadata << 4);
                } else {
                  rawData[metadataOffset + nibbleOffset] =
                    (rawData[metadataOffset + nibbleOffset] & 0xf0) |
                    lceMetadata;
                }
              }
            }
          }
        }
      }
    }

    //biome fix!
    const biomeOffset = blockCount + 3 * halfBlockCount;
    const hasSky = client.javaDimension === 0;
    const javaBiomeOffset = sectionCount * (hasSky ? 12288 : 10240);

    if (javaChunk.x === 0 && javaChunk.z === 0) {
      const hasSky = client.javaDimension === 0;
      const expectedOffset = sectionCount * (hasSky ? 12288 : 10240);
    }

    if (javaBiomeOffset + 256 <= javaData.length) {
      for (let i = 0; i < biomeSize; i++) {
        rawData[biomeOffset + i] = javaData[javaBiomeOffset + i];
      }

      if (javaChunk.x === 0 && javaChunk.z === 0) {
        const biomeData = rawData.slice(biomeOffset, biomeOffset + biomeSize);
        const uniqueBiomes = new Set(biomeData);
      }
    } else {
      for (let i = 0; i < biomeSize; i++) {
        rawData[biomeOffset + i] = 1;
      }
    }
  }

  const skyLightOffset = blockCount + halfBlockCount + halfBlockCount;
  for (let i = 0; i < halfBlockCount; i++) {
    rawData[skyLightOffset + i] = 0xff;
  }

  if (rawData.length !== rawSize) {
    return;
  }

  const rleCompressed = compressRLE(rawData);
  if (!rleCompressed || rleCompressed.length === 0) {
    return;
  }

  const compressed = zlib.deflateSync(rleCompressed, { level: 6 });
  if (!compressed || compressed.length === 0 || compressed.length > 1000000) {
    return;
  }

  const writer = new PacketWriter();
  writer.writeByte(0x01);

  const worldX = javaChunk.x * 16;
  const worldZ = javaChunk.z * 16;

  writer.writeInt(worldX);
  writer.writeShort(0);
  writer.writeInt(worldZ);

  writer.writeByte(15);
  writer.writeByte(chunkHeight - 1);
  writer.writeByte(15);

  const levelIdx =
    client.javaDimension === -1 ? 1 : client.javaDimension === 1 ? 2 : 0;
  const sizeAndLevel = compressed.length | (levelIdx << 30);
  writer.writeInt(sizeAndLevel);

  const payload = writer.toBuffer();
  const fullPayload = Buffer.concat([payload, compressed]);

  const chunkKey = `${javaChunk.x},${javaChunk.z}`;
  if (client.loadedChunks) {
    client.loadedChunks.add(chunkKey);
  }

  proxy.sendPacket(client, 0x33, fullPayload);
}

module.exports = connectToJavaServer;
/* --------------------------------------------------------------- */
