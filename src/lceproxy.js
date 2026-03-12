/* --------------------------------------------------------------- */
/*                          lceproxy.js                            */
/* --------------------------------------------------------------- */

//beware that there are a lot of magic numbers, need to do a refractor soon.

const dgram = require("dgram");
const net = require("net");
const mc = require("minecraft-protocol");
const {
  GAME_PORT,
  WIN64_LAN_DISCOVERY_PORT,
  MINECRAFT_NET_VERSION,
  USE_LEGACY_USERNAME,
  CUSTOM_USERNAME,
  SERVERS,
} = require("../constants");

const PacketWriter = require("./packetwriter");
const PacketReader = require("./packetreader");
const LANBroadcast = require("./lanbroadcast");
const recipeData = require("./mappings/recipemapping");
const {
  createEntityTypeMapping,
  createItemMapping,
  createBlockMapping,
} = require("./mappings");
const { compressRLE } = require("./utils/chunk");
const { encodeVarInt } = require("./utils");
const { normalizeYaw } = require("./utils/rotation");
const { readItemInstance } = require("./utils/items");
const { readItem, writeItem, writeItemNBT } = require("./utils/items");
const packetSenders = require("./packets/senders");
const connectToJavaServerFunc = require("./javaclienthandler");

//please stfu node
process.removeAllListeners("warning");
process.on("warning", (warning) => {
  if (warning.name === "DeprecationWarning") return;
  console.warn(warning.name, warning.message);
});

const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

class LCEProxy {
  constructor() {
    this.clients = [];
    this.udpSocket = null;
    this.tcpServers = [];
    this.broadcastInterval = null;
    this.broadcasts = [];
    this.serverConfigs = [];
    this.nextSmallId = 1;
    this.usedSmallIds = new Set();

    this.openChests = new Map();
    this.clientChests = new Map();

    this.javaBlockMapping = createBlockMapping();
    this.javaItemMapping = createItemMapping();
    this.javaEntityTypeMapping = createEntityTypeMapping();

    this.validLCEPackets = new Set([
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
      0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
      0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20, 0x21, 0x22, 0x23,
      0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f,
      0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x3c, 0x3d, 0x3e, 0x46, 0x64,
      0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x6b, 0x6c, 0x6d, 0x82, 0x83, 0x85,
      0x96, 0x97, 0x98, 0x9a, 0x9d, 0xc8, 0xc9, 0xca, 0xcb, 0xcc, 0xcd, 0xce,
      0xcf, 0xd0, 0xd1, 0xfa, 0xfc, 0xfd, 0xfe, 0xff,
    ]);
  }

  mapJavaBlockToLCE(javaBlockId) {
    if (this.javaBlockMapping[javaBlockId] !== undefined) {
      return this.javaBlockMapping[javaBlockId];
    }
    return 1;
  }

  mapJavaParticleToLCE(particleId) {
    const particleMap = {
      0: "explode",
      1: "largeexplode",
      2: "hugeexplosion",
      3: "fireworksSpark",
      4: "bubble",
      5: "splash",
      6: "wake",
      7: "suspended",
      8: "depthsuspend",
      9: "crit",
      10: "magicCrit",
      11: "smoke",
      12: "largesmoke",
      13: "spell",
      14: "instantSpell",
      15: "mobSpell",
      16: "mobSpellAmbient",
      17: "witchMagic",
      18: "dripWater",
      19: "dripLava",
      20: "angryVillager",
      21: "happyVillager",
      22: "townaura",
      23: "note",
      24: "portal",
      25: "enchantmenttable",
      26: "flame",
      27: "lava",
      28: "footstep",
      29: "cloud",
      30: "reddust",
      31: "snowballpoof",
      32: "snowshovel",
      33: "slime",
      34: "heart",
      35: "barrier",
      36: "iconcrack",
      37: "blockcrack",
      38: "blockdust",
      39: "droplet",
      40: "take",
      41: "mobappearance",
      42: "dragonbreath",
      43: "endrod",
      44: "damageindicator",
      45: "sweepattack",
    };

    return particleMap[particleId] || null;
  }

  mapJavaItemToLCE(javaItemId) {
    if (javaItemId >= 0 && javaItemId <= 255) {
      return this.mapJavaBlockToLCE(javaItemId);
    }

    if (this.javaItemMapping[javaItemId] !== undefined) {
      return this.javaItemMapping[javaItemId];
    }

    return 1;
  }

  mapLCEItemToJava(lceItemId) {
    if (lceItemId >= 0 && lceItemId <= 255) {
      return this.mapLCEBlockToJava(lceItemId);
    }

    if (
      (lceItemId >= 256 && lceItemId <= 421) ||
      (lceItemId >= 2256 && lceItemId <= 2267)
    ) {
      for (const [javaId, lceId] of Object.entries(this.javaItemMapping)) {
        if (lceId === lceItemId) {
          return parseInt(javaId);
        }
      }
      return lceItemId;
    }

    return null;
  }

  mapLCEBlockToJava(lceBlockId) {
    for (const [javaId, lceId] of Object.entries(this.javaBlockMapping)) {
      if (lceId === lceBlockId) {
        return parseInt(javaId);
      }
    }

    if (lceBlockId >= 0 && lceBlockId <= 174) {
      return lceBlockId;
    }

    return null;
  }

  async start() {
    this.startBroadcasting();
    this.startTCPServer();

    console.log("\nProxy is now running!");
    console.log(
      `Broadcasting ${SERVERS.length} server(s) as LAN games on Minecraft Legacy Edition.`,
    );
    SERVERS.forEach((server, index) => {
      const serverStr = typeof server === 'string' ? server : server.server;
      console.log(`  - ${serverStr} on port ${GAME_PORT + index}`);
    });
    console.log("Press Ctrl+C to stop.\n");
  }

  startBroadcasting() {
    this.udpSocket = dgram.createSocket("udp4");
    this.udpSocket.bind(() => {
      this.udpSocket.setBroadcast(true);
    });

    this.broadcasts = SERVERS.map((server, index) => {
      const gamePort = GAME_PORT + index;
      const serverStr = typeof server === 'string' ? server : server.server;
      const parts = serverStr.split(':');
      this.serverConfigs[index] = {
        host: parts[0],
        port: parts[1] ? parseInt(parts[1]) : 25565,
        name: serverStr,
        cracked: typeof server === 'object' ? server.cracked : false,
        gamePort: gamePort,
      };
      return new LANBroadcast(serverStr, gamePort);
    });

    this.broadcastInterval = setInterval(() => {
      this.broadcasts.forEach((broadcast) => {
        this.udpSocket.send(
          broadcast.buffer,
          0,
          broadcast.buffer.length,
          WIN64_LAN_DISCOVERY_PORT,
          "255.255.255.255",
        );
      });
    }, 1000);
  }

  startTCPServer() {
    this.serverConfigs.forEach((serverConfig, index) => {
      const tcpServer = net.createServer((socket) => {
        socket.setNoDelay(true);

        let smallId = 1;
        while (this.usedSmallIds.has(smallId) && smallId <= 8) {
          smallId++;
        }

        if (smallId > 8) {
          socket.destroy();
          return;
        }

        this.usedSmallIds.add(smallId);

        const client = {
          socket: socket,
          smallId: smallId,
          buffer: Buffer.alloc(0),
          state: "prelogin",
          javaClient: null,
          breakingBlock: null,
          javaPlayers: new Map(),
          nextLceEntityId: 100,
          javaToLceEntityId: new Map(),
          javaEntities: new Map(),
          serverConfig: serverConfig,
        };

        this.clients.push(client);

        const smallIdBuffer = Buffer.from([smallId]);
        socket.write(smallIdBuffer);

        socket.on("data", (data) => {
          this.handleClientData(client, data);
        });

        socket.on("end", () => {
          this.removeClient(client);
        });

        socket.on("error", (err) => {
          this.removeClient(client);
        });

        socket.on("close", () => {
          if (this.clients.indexOf(client) > -1) {
            this.removeClient(client);
          }
        });
      });

      tcpServer.listen(serverConfig.gamePort, () => {
        console.log(
          `Server ${serverConfig.name} should now be visible on LCE.`,
        );
      });

      this.tcpServers.push(tcpServer);
    });
  }

  getPacketDataSize(packetId, data, offset) {
    switch (packetId) {
      case 0x00:
        return 0;

      case 0x0a:
        return 10;

      case 0x0b:
        let size = 4 + 1 + 4 + 1;
        if (offset + size + 2 <= data.length) {
          const itemId = data.readInt16BE(offset + size);
          size += 2;
          if (itemId !== -1) {
            size += 1 + 2;
          }
          size += 4 + 4 + 4;
        }
        return size;

      case 0x0c:
        return data.length - offset >= 7 + 2 ? 7 : 7;

      case 0x0d:
        const remaining = data.length - offset;
        if (remaining >= 41) return 41;
        if (remaining >= 33) return 33;
        if (remaining >= 9) return 9;
        return remaining;

      case 0x0e:
        return 12;

      case 0x07:
        return 9;

      //this retarded packet wasted hours of my life because it was being bundled with others...
      //for some reason we don't receive this packet if the player is doing nothing besides hitting - 4J what the fuck did you do to this poor packet.
      case 0x12:
        return 5;

      default:
        return null;
    }
  }

  //thanks 0x12
  calculatePacketSize(packetId, data, offset) {
    try {
      switch (packetId) {
        case 0x00:
          return 0;

        case 0x0a:
          return 1 + 1;

        case 0x0b:
          return 1 + 33;

        case 0x0c:
          return 1 + 9;

        case 0x0d:
          if (offset >= data.length) return null;
          const remainingInBundle = data.length - offset;
          if (remainingInBundle < 42) return remainingInBundle;
          return 42;

        case 0x0e:
          return 1 + 1 + 4 + 1 + 4 + 1;

        case 0x07:
          return 1 + 4 + 4 + 1;

        case 0x12:
          return 1 + 4 + 1;

        case 0x0f:
          let useItemSize = 1 + 4 + 1 + 4 + 1;
          if (offset + useItemSize + 2 <= data.length) {
            const itemId = data.readInt16BE(offset + useItemSize);
            useItemSize += 2;
            if (itemId !== -1) {
              useItemSize += 1;
              useItemSize += 2;
            }
          }
          useItemSize += 1 + 1 + 1;
          return useItemSize;

        case 0x10:
          return 1 + 2;

        case 0x13:
          return 1 + 9;

        case 0x1b:
          return 1 + 10;

        case 0x66:
          let containerClickSize = 1 + 1 + 2 + 1 + 2 + 1;
          if (offset + containerClickSize + 2 <= data.length) {
            const itemId = data.readInt16BE(offset + containerClickSize);
            containerClickSize += 2;
            if (itemId !== -1) {
              containerClickSize += 1;
              containerClickSize += 2;
            }
          }
          return containerClickSize;

        case 0x6a:
          return 1 + 4;

        case 0x6b:
          return 1 + 8;

        case 0x65:
          return 1 + 1;

        case 0xcd:
          return 1 + 1;

        case 0x98:
          return 1 + 4;

        case 0x82:
          try {
            let signSize = 1 + 4 + 2 + 4 + 1 + 1;
            let pos = offset + 1 + 4 + 2 + 4 + 1 + 1;
            for (let i = 0; i < 4; i++) {
              if (pos + 2 > data.length) return null;
              const strLen = data.readInt16BE(pos);
              pos += 2;
              signSize += 2 + strLen * 2;
              pos += strLen * 2;
            }
            return signSize;
          } catch (err) {
            return null;
          }

        case 0x85:
          return 1 + 1 + 4 + 4 + 4;

        default:
          return null;
      }
    } catch (err) {
      return null;
    }
  }

  handleClientData(client, data) {
    try {
      client.buffer = Buffer.concat([client.buffer, data]);

      while (client.buffer.length >= 4) {
        const packetLength = client.buffer.readUInt32BE(0);

        if (client.buffer.length < 4 + packetLength) {
          break;
        }

        const packetData = client.buffer.slice(4, 4 + packetLength);
        client.buffer = client.buffer.slice(4 + packetLength);

        const packetId = packetData[0];

        const expectedSize = this.calculatePacketSize(packetId, packetData, 0);
        if (expectedSize > 0 && packetData.length > expectedSize) {
          let offset = 0;
          while (offset < packetData.length) {
            const bundledPacketId = packetData[offset];
            const bundledSize = this.calculatePacketSize(
              bundledPacketId,
              packetData,
              offset,
            );
            if (bundledSize <= 0 || offset + bundledSize > packetData.length) {
              break;
            }

            const singlePacket = packetData.slice(offset, offset + bundledSize);
            this.processPacket(
              client,
              bundledPacketId,
              singlePacket,
              offset > 0,
            );
            offset += bundledSize;
          }
        } else {
          this.processPacket(client, packetId, packetData, false);
        }
      }
    } catch (err) {
      /* do nothing */
    }
  }

  processPacket(client, packetId, packetData, isBundled = false) {
    switch (packetId) {
      case 0x02: //PreLoginPacket
        this.handlePreLogin(client, packetData);
        break;
      case 0x01: //LoginPacket
        this.handleLogin(client, packetData);
        break;
      case 0x00: //KeepAlive
        if (client.state === "prelogin") {
          this.handleKeepAlive(client, packetData);
        }
        break;
      case 0x07: //InteractPacket - 7
        if (client.state === "play") {
          this.handleInteract(client, packetData);
        }
        break;
      case 0x12: //AnimatePacket - 18
        if (client.state === "play") {
          this.handleAnimate(client, packetData, isBundled);
        }
        break;
      case 0x0d: //MovePlayerPacket (pos & rot)
        if (client.state === "play") {
          this.handleMovePlayer(client, packetData);
        }
        break;
      case 0x0a: //base (onGround/isFlying)
      case 0x0b: //pos
      case 0x0c: //rot
        if (client.state === "play") {
          this.handlePlayerMovement(client, packetId, packetData);
        }
        break;
      case 0x03:
        if (client.state === "play") {
          this.handleChat(client, packetData);
        }
        break;
      case 0x0e:
        if (client.state === "play") {
          this.handlePlayerAction(client, packetData, isBundled);
        }
        break;
      case 0x0f: //UseItemPacket - 15
        if (client.state === "play") {
          this.handleUseItem(client, packetData);
        }
        break;
      case 0x10: //SetCarriedItemPacket - 16
        if (client.state === "play") {
          this.handleSetCarriedItem(client, packetData);
        }
        break;
      case 0x13: //PlayerCommandPacket - 19
        if (client.state === "play") {
          this.handlePlayerCommand(client, packetData);
        }
        break;
      case 0x1b: //PlayerInputPacket - 27
        if (client.state === "play") {
          this.handlePlayerInput(client, packetData);
        }
        break;
      case 0x65: //ContainerClosePacket - 101
        if (client.state === "play") {
          this.handleContainerClose(client, packetData);
        }
        break;
      case 0x66: //ContainerClickPacket - 102
        if (client.state === "play") {
          this.handleContainerClick(client, packetData);
        }
        break;
      case 0x6a: //ContainerAckPacket - 106
        if (client.state === "play") {
          this.handleContainerAck(client, packetData);
        }
        break;
      case 0x96:
        if (client.state === "play") {
          this.handleCraftItem(client, packetData);
        }
        break;
      case 0x97: //TradeItemPacket - 151
        if (client.state === "play") {
          this.handleTradeItem(client, packetData);
        }
        break;
      case 0x98:
        break;
      //case 0x9E: //JavaCraftingPacket - 158
      //    if (client.state === 'play') {
      //        this.handleJavaCrafting(client, packetData);
      //    }
      //    break;
      case 0xfa: //CustomPayloadPacket - 250
        if (client.state === "play") {
          this.handleCustomPayload(client, packetData);
        }
        break;
      case 0x82:
        if (client.state === "play") {
          this.handleSignUpdate(client, packetData);
        }
        break;
      case 0x6b: //SetCreativeModeSlotPacket - 107
        if (client.state === "play") {
          this.handleSetCreativeModeSlot(client, packetData);
        }
        break;
      case 0xcd: //ClientCommandPacket - 205
        if (client.state === "play") {
          this.handleClientCommand(client, packetData);
        }
        break;
      case 0xff: //DisconnectPacket - 255
        this.handleDisconnect(client, packetData);
        break;
      default:
        break;
    }
  }

  handlePreLogin(client, data) {
    const reader = new PacketReader(data.slice(1));
    const netcodeVersion = reader.readShort();
    const loginKey = reader.readString();

    client.state = "login";

    const writer = new PacketWriter();
    writer.writeShort(MINECRAFT_NET_VERSION);
    writer.writeString("SESSION_ID_" + client.smallId);
    writer.writeByte(0); //friendsOnly
    writer.writeInt(0); //ugcPlayersVersion
    writer.writeByte(0); //playerCount

    for (let i = 0; i < 14; i++) writer.writeByte(0); //uniqueSaveName

    let serverSettings = 0;

    //difficulty
    //0=Peaceful, 1=Easy, 2=Normal, 3=Hard
    serverSettings |= 1;

    //friends of friends (off)
    //serverSettings |= 0x00000004;

    //gamertags (on)
    serverSettings |= 0x00000008;

    //0=Survival, 1=Creative, 2=Adventure
    //survival=leave bits clear (0)
    //creative=serverSettings |= 0x00000010;

    //level type (OFF=Default, ON=Flat)
    //serverSettings |= 0x00000040; //uncomment for flat

    //structures (on)
    serverSettings |= 0x00000080;

    //bonus chest (off)
    //serverSettings |= 0x00000100;

    //pvp (on)
    serverSettings |= 0x00000400;

    //trust players (on)
    serverSettings |= 0x00000800;

    //tnt (on)
    serverSettings |= 0x00001000;

    //spread fire (on)
    serverSettings |= 0x00002000;

    writer.writeInt(serverSettings);
    writer.writeByte(0); //hostIndex
    writer.writeInt(0); //texturePackId

    this.sendPacket(client, 0x02, writer.toBuffer());
  }

  handleLogin(client, data) {
    const reader = new PacketReader(data.slice(1));
    const clientVersion = reader.readInt();
    const username = reader.readString();

    client.state = "login";
    client.username = !USE_LEGACY_USERNAME ? CUSTOM_USERNAME : username;

    if (client.javaClient) {
      const oldJavaClient = client.javaClient;
      client.javaClient = null;

      oldJavaClient.removeAllListeners();
      oldJavaClient.on("error", () => {
        /* do nothing */
      });
      try {
        oldJavaClient.end();
      } catch (err) {
        /* do nothing */
      }
    }

    this.connectToJavaServer(client);
  }

  sendLCELoginResponse(client) {
    const writer = new PacketWriter();
    writer.writeInt(client.smallId); //entityId

    //we use these later
    client.lcePlayerEntityId = client.smallId;
    writer.writeString(""); //username
    writer.writeString("default"); //levelTypeName
    writer.writeLong(0); //seed
    writer.writeInt(client.javaGameMode || 0); //gamemode (synced from java server)
    const dimension = client.javaDimension || 0;
    writer.writeByte(dimension & 0xff); //dimension
    //nether/end use 128 height, overworld uses 256
    const loginMapHeight = dimension === 0 ? 256 : 128;
    writer.writeByte(loginMapHeight - 1); //mapHeight sent as (height - 1)
    writer.writeByte(8); //maxPlayers
    writer.writeLong(0); //offlineXuid
    writer.writeLong(0); //onlineXuid
    writer.writeBoolean(false); //friendsOnlyUGC
    writer.writeInt(0); //ugcPlayersVersion
    writer.writeByte(1); //difficulty (hardcoded to Easy)
    writer.writeInt(0); //multiplayerInstanceId
    writer.writeByte(0); //playerIndex
    writer.writeInt(0); //playerSkinId
    writer.writeInt(0); //playerCapeId
    writer.writeBoolean(false); //isGuest
    writer.writeBoolean(false); //newSeaLevel
    writer.writeInt(0); //uiGamePrivileges
    writer.writeShort(864); //xzSize
    writer.writeByte(8); //hellScale

    this.sendPacket(client, 0x01, writer.toBuffer());
    this.sendPostLoginPackets(client);
  }

  sendPostLoginPackets(client) {
    const spawnX = Math.floor(client.javaSpawnX || 0);
    const spawnY = Math.floor(client.javaSpawnY || 65);
    const spawnZ = Math.floor(client.javaSpawnZ || 0);

    const spawnWriter = new PacketWriter();
    spawnWriter.writeInt(spawnX);
    spawnWriter.writeInt(spawnY);
    spawnWriter.writeInt(spawnZ);
    this.sendPacket(client, 6, spawnWriter.toBuffer());

    const abilitiesWriter = new PacketWriter();
    const invulnerable = client.abilities?.invulnerable || false;
    const flying = client.abilities?.flying || false;
    const canFly =
      client.abilities?.canFly ||
      client.gameMode === 1 ||
      client.gameMode === 3;
    const instabuild = client.gameMode === 1; //dunno why this controls the bow requiring arrows on LCE, but it does
    let bitfield = 0;
    if (invulnerable) bitfield |= 1;
    if (flying) bitfield |= 2;
    if (canFly) bitfield |= 4;
    if (instabuild) bitfield |= 8;
    abilitiesWriter.writeByte(bitfield);
    abilitiesWriter.writeFloat(0.05); //flySpeed
    abilitiesWriter.writeFloat(0.1); //walkSpeed
    this.sendPacket(client, 202, abilitiesWriter.toBuffer());

    const carriedWriter = new PacketWriter();
    carriedWriter.writeShort(0); //selectedSlot
    this.sendPacket(client, 16, carriedWriter.toBuffer());

    const lceSpawnY = (client.javaSpawnY || 65.0) + 1.65; //lce has an eye offset of 1.62, added 3 so we don't spawn in the ground
    const moveWriter = new PacketWriter();
    moveWriter.writeDouble(client.javaSpawnX || 0.5);
    moveWriter.writeDouble(lceSpawnY); //feet position with offset
    moveWriter.writeDouble(lceSpawnY + 1.62); //eye height above feet
    moveWriter.writeDouble(client.javaSpawnZ || 0.5);
    moveWriter.writeFloat(client.javaYaw || 0.0);
    moveWriter.writeFloat(client.javaPitch || 0.0);
    moveWriter.writeByte(0x01); //onGround
    const movePayload = moveWriter.toBuffer();

    this.sendPacket(client, 0x0d, movePayload);

    //translating between 1.8 and 1.9+ servers for viaversion requires a position packet from the
    //client to generate the TeleportConfirm packet that 1.9+ servers expect before accepting movement.
    if (client.javaClient && client.javaClient.write) {
      try {
        client.javaClient.write("position_look", {
          x: client.javaSpawnX || 0.5,
          y: client.javaSpawnY || 65.0,
          z: client.javaSpawnZ || 0.5,
          yaw: client.javaYaw || 0.0,
          pitch: client.javaPitch || 0.0,
          onGround: true,
        });
      } catch (err) {
        /* do nothing */
      }
    }

    const timeWriter = new PacketWriter();
    timeWriter.writeLong(1000); //gameTime (world age)
    timeWriter.writeLong(6000); //dayTime
    this.sendPacket(client, 4, timeWriter.toBuffer());
    //console.log("YEEEEEEEEEEEEEEEEEEE");
  }

  mapJavaEntityIdToLce(client, javaEntityId) {
    if (!client.javaToLceEntityId.has(javaEntityId)) {
      const lceEntityId = client.nextLceEntityId++;
      if (lceEntityId > 32767) {
        return 100;
      }
      client.javaToLceEntityId.set(javaEntityId, lceEntityId);
    }
    return client.javaToLceEntityId.get(javaEntityId);
  }

  sendMovePlayerPacket(client, x, y, z, yaw, pitch) {
    const lceY = y + 1.65;
    const moveWriter = new PacketWriter();
    moveWriter.writeDouble(x);
    moveWriter.writeDouble(lceY); //feet position with offset
    moveWriter.writeDouble(lceY + 1.62); //eye height above feet
    moveWriter.writeDouble(z);
    moveWriter.writeFloat(yaw);
    moveWriter.writeFloat(pitch);
    moveWriter.writeByte(0x01); //onGround
    this.sendPacket(client, 0x0d, moveWriter.toBuffer());
  }

  sendTexturePacket(client, textureName, textureData) {
    if (!client || !client.socket || client.socket.destroyed) {
      return;
    }
    const writer = new PacketWriter();
    writer.writeUTF(textureName);
    writer.writeShort(textureData.length);
    writer.writeBytes(textureData);

    this.sendPacket(client, 0x9a, writer.toBuffer());
  }

  sendTextureChangePacket(client, entityId, textureName, textureType = 0) {
    if (!client || !client.socket || client.socket.destroyed) {
      return;
    }
    const writer = new PacketWriter();
    writer.writeInt(entityId);
    writer.writeByte(textureType);
    writer.writeUTF(textureName);

    this.sendPacket(client, 0x9d, writer.toBuffer());
  }

  sendAddPlayerPacket(client, playerInfo) {
    let playerName = playerInfo.name || "undefined";
    if (playerInfo.isNPC) {
      playerName = "";
    }
    if (playerName.length > 20) {
      playerName = playerName.substring(0, 20);
    }
    if (playerName.length === 0 && !playerInfo.isNPC) {
      playerName = "undefined";
    }

    const writer = new PacketWriter();
    writer.writeInt(playerInfo.entityId);
    writer.writeString(playerName);

    //pos
    writer.writeInt(Math.floor(playerInfo.x * 32));
    writer.writeInt(Math.floor(playerInfo.y * 32));
    writer.writeInt(Math.floor(playerInfo.z * 32));

    //rot
    const yRotByte = Math.floor(((playerInfo.yaw % 360) / 360) * 256) & 0xff;
    const xRotByte = Math.floor(((playerInfo.pitch % 360) / 360) * 256) & 0xff;
    writer.writeByte(yRotByte);
    writer.writeByte(xRotByte);
    writer.writeByte(yRotByte); //yHeadRot

    writer.writeShort(0); //carriedItem
    writer.writeLong(0); //xuid
    writer.writeLong(0); //OnlineXuid
    writer.writeByte(0); //playerIndex
    const skinIdToSend = playerInfo.skinId || 0;

    writer.writeInt(skinIdToSend); //skinId
    writer.writeInt(0); //capeId
    writer.writeInt(0); //uiGamePrivileges

    const sharedFlagsHeader = (0 << 5) | 0;
    writer.writeByte(sharedFlagsHeader);
    writer.writeByte(0);

    const airSupplyHeader = (1 << 5) | 1;
    writer.writeByte(airSupplyHeader);
    writer.writeShort(300);

    const healthHeader = (3 << 5) | 6;
    writer.writeByte(healthHeader);
    writer.writeFloat(20.0);

    const effectColorHeader = (2 << 5) | 7;
    writer.writeByte(effectColorHeader);
    writer.writeInt(0);

    const effectAmbienceHeader = (0 << 5) | 8;
    writer.writeByte(effectAmbienceHeader);
    writer.writeByte(0);

    const arrowCountHeader = (0 << 5) | 9;
    writer.writeByte(arrowCountHeader);
    writer.writeByte(0);

    const playerFlagsHeader = (0 << 5) | 16;
    writer.writeByte(playerFlagsHeader);
    writer.writeByte(0);

    const absorptionHeader = (3 << 5) | 17;
    writer.writeByte(absorptionHeader);
    writer.writeFloat(0.0);

    const scoreHeader = (2 << 5) | 18;
    writer.writeByte(scoreHeader);
    writer.writeInt(0);

    writer.writeByte(0x7f);

    this.sendPacket(client, 0x14, writer.toBuffer());

    if (playerInfo.customTextureName) {
      this.sendTextureChangePacket(
        client,
        playerInfo.entityId,
        playerInfo.customTextureName,
      );
    }
  }

  sendMoveEntityPacket(client, playerInfo) {
    //MoveEntityPacket can only handle movements of ~4 blocks
    //just teleport for simplicity
    this.sendTeleportEntityPacket(client, playerInfo);
  }

  sendTeleportEntityPacket(client, playerInfo) {
    const writer = new PacketWriter();
    writer.writeShort(playerInfo.entityId);

    //pos
    writer.writeInt(Math.floor(playerInfo.x * 32));
    writer.writeInt(Math.floor(playerInfo.y * 32));
    writer.writeInt(Math.floor(playerInfo.z * 32));

    //rot
    const yRotByte = Math.floor(((playerInfo.yaw % 360) / 360) * 256) & 0xff;
    const xRotByte = Math.floor(((playerInfo.pitch % 360) / 360) * 256) & 0xff;
    writer.writeByte(yRotByte);
    writer.writeByte(xRotByte);

    this.sendPacket(client, 34, writer.toBuffer()); //TeleportEntityPacket

    this.sendRotateHeadPacket(client, playerInfo);
  }

  sendRotateHeadPacket(client, playerInfo) {
    const writer = new PacketWriter();
    writer.writeInt(playerInfo.entityId);

    const yHeadRotByte =
      Math.floor(((playerInfo.yaw % 360) / 360) * 256) & 0xff;
    writer.writeByte(yHeadRotByte);

    this.sendPacket(client, 35, writer.toBuffer()); //RotateHeadPacket
  }

  getJavaEntityType(typeId) {
    const typeMap = {
      50: "Creeper",
      51: "Skeleton",
      52: "Spider",
      53: "Giant",
      54: "Zombie",
      55: "Slime",
      56: "Ghast",
      57: "PigZombie",
      58: "Enderman",
      59: "CaveSpider",
      60: "Silverfish",
      61: "Blaze",
      62: "LavaSlime",
      63: "EnderDragon",
      64: "WitherBoss",
      65: "Bat",
      66: "Witch",
      90: "Pig",
      91: "Sheep",
      92: "Cow",
      93: "Chicken",
      94: "Squid",
      101: "Rabbit",
      95: "Wolf",
      96: "MushroomCow",
      97: "SnowMan",
      98: "Ozelot",
      99: "VillagerGolem",
      100: "EntityHorse",
      120: "Villager",
      71: "ItemFrame",
    };
    return typeMap[typeId] || "Unknown";
  }

  sendAddMobPacket(client, entityInfo) {
    return packetSenders.sendAddMobPacket(this, client, entityInfo);
  }
  sendAddEntityPacket(client, entityInfo) {
    return packetSenders.sendAddEntityPacket(this, client, entityInfo);
  }
  sendMoveEntityPacketForEntity(client, entity, dX, dY, dZ, includeRotation) {
    return packetSenders.sendMoveEntityPacketForEntity(
      this,
      client,
      entity,
      dX,
      dY,
      dZ,
      includeRotation,
    );
  }
  sendTeleportEntityPacketForEntity(client, entity) {
    return packetSenders.sendTeleportEntityPacketForEntity(
      this,
      client,
      entity,
    );
  }
  sendRotateEntityPacketForEntity(client, entity) {
    return packetSenders.sendRotateEntityPacketForEntity(this, client, entity);
  }
  sendRotateHeadPacketForEntity(client, entity) {
    return packetSenders.sendRotateHeadPacketForEntity(this, client, entity);
  }
  sendEntityMetadataPacket(client, entity, metadata) {
    return packetSenders.sendEntityMetadataPacket(
      this,
      client,
      entity,
      metadata,
    );
  }
  sendSetEntityMotionPacket(client, entity) {
    return packetSenders.sendSetEntityMotionPacket(this, client, entity);
  }
  sendEntityEventPacket(client, entity, eventId) {
    return packetSenders.sendEntityEventPacket(this, client, entity, eventId);
  }
  sendSetEquippedItemPacket(client, entity, slot, item) {
    return packetSenders.sendSetEquippedItemPacket(
      this,
      client,
      entity,
      slot,
      item,
    );
  }
  sendSetItemDataPacket(client, entity, itemData) {
    return packetSenders.sendSetItemDataPacket(this, client, entity, itemData);
  }
  sendSetItemFrameDataPacket(client, entity, itemData, rotation) {
    return packetSenders.sendSetItemFrameDataPacket(
      this,
      client,
      entity,
      itemData,
      rotation,
    );
  }
  sendSetEntityDataPacket(client, entity) {
    return packetSenders.sendSetEntityDataPacket(this, client, entity);
  }
  sendUpdateAttributesPacket(client, entity) {
    return packetSenders.sendUpdateAttributesPacket(this, client, entity);
  }
  sendSetEntityLinkPacket(client, sourceId, destId, linkType) {
    return packetSenders.sendSetEntityLinkPacket(
      this,
      client,
      sourceId,
      destId,
      linkType,
    );
  }

  sendLevelSoundPacket(client, soundId, x, y, z, volume, pitch) {
    return packetSenders.sendLevelSoundPacket(
      this,
      client,
      soundId,
      x,
      y,
      z,
      volume,
      pitch,
    );
  }
  sendLevelParticlesPacket(
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
    return packetSenders.sendLevelParticlesPacket(
      this,
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
    );
  }
  sendTileUpdatePacket(client, x, y, z, blockId, metadata) {
    return packetSenders.sendTileUpdatePacket(
      this,
      client,
      x,
      y,
      z,
      blockId,
      metadata,
    );
  }

  sendContainerOpenPacket(client, packet) {
    return packetSenders.sendContainerOpenPacket(this, client, packet);
  }

  sendVillagerTrades(client, windowId, packetData) {
    return packetSenders.sendVillagerTrades(this, client, windowId, packetData);
  }

  sendBookAsChestGUI(client, bookItem) {
    if (!bookItem.nbt) {
      return;
    }

    let bookTitle = "Book";
    if (bookItem.nbt.value && bookItem.nbt.value.title) {
      bookTitle = bookItem.nbt.value.title.value || "Book";
    }

    let pages = [];
    if (bookItem.nbt.value && bookItem.nbt.value.pages) {
      if (
        bookItem.nbt.value.pages.value &&
        bookItem.nbt.value.pages.value.value
      ) {
        pages = bookItem.nbt.value.pages.value.value;
      } else if (Array.isArray(bookItem.nbt.value.pages)) {
        pages = bookItem.nbt.value.pages;
      }
    }

    if (pages.length === 0) {
      return;
    }

    if (!client._bookGUI) {
      client._bookGUI = {
        pages: pages,
        currentPage: 0,
        clickActions: {},
        bookTitle: bookTitle,
      };
    } else {
      client._bookGUI.clickActions = {};
      client._bookGUI.bookTitle = bookTitle;
    }

    const windowId = 1;
    client.openWindowId = windowId;
    client.openWindowType = "minecraft:chest";

    const fakeOpenPacket = {
      windowId: windowId,
      inventoryType: "minecraft:chest",
      slotCount: 54,
      windowTitle: JSON.stringify({
        text: `Written Book (${bookTitle})`,
        extra: [],
      }),
    };

    this.sendContainerOpenPacket(client, fakeOpenPacket);

    this.updateBookGUIContents(client, windowId);
  }

  updateBookGUIContents(client, windowId) {
    if (!client._bookGUI) return;

    const currentPage = client._bookGUI.currentPage;
    const pages = client._bookGUI.pages;
    const pageContent = pages[currentPage];

    const items = [];
    for (let i = 0; i < 54; i++) {
      items.push({ blockId: -1 });
    }

    if (currentPage > 0) {
      items[48] = {
        blockId: 35,
        itemCount: 1,
        itemDamage: 14,
        displayName: "Previous Page",
      };
    }

    if (currentPage < pages.length - 1) {
      items[50] = {
        blockId: 35,
        itemCount: 1,
        itemDamage: 5,
        displayName: "Next Page",
      };
    }

    try {
      const pageText = JSON.parse(pageContent);

      let lines = [];
      if (Array.isArray(pageText)) {
        lines = pageText;
      } else if (pageText.extra) {
        lines = pageText.extra;
      } else {
        lines = [pageText];
      }

      let slotIndex = 0;
      for (let i = 0; i < lines.length && slotIndex < 36; i++) {
        const line = lines[i];
        let text = "";
        let clickAction = null;

        if (typeof line === "string") {
          text = line;
        } else if (line && typeof line === "object") {
          if (line.text) {
            text = line.text;
          }
          if (line.extra && Array.isArray(line.extra)) {
            for (const extraPart of line.extra) {
              if (typeof extraPart === "string") {
                text += extraPart;
              } else if (extraPart.text) {
                text += extraPart.text;
              }

              if (extraPart.clickEvent) {
                clickAction = {
                  type: extraPart.clickEvent.action,
                  value: extraPart.clickEvent.value,
                };
              }
            }
          }
        }

        text = text.replace(/§[0-9a-fk-or]/gi, "").replace(/\\n/g, "\n");

        const textLines = text
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && l !== " ");

        for (const textLine of textLines) {
          if (slotIndex >= 36) break;

          if (textLine.length > 0 && textLine !== " ") {
            let itemId = 339;
            let itemDamage = 0;
            let isEnchanted = false;

            if (clickAction) {
              if (clickAction.type === "open_url") {
                itemId = 345;
                itemDamage = 0;
              } else if (clickAction.type === "run_command") {
                itemId = 340;
                itemDamage = 0;
              }
              isEnchanted = true;
            }

            const chunks = [];
            for (let pos = 0; pos < textLine.length; pos += 32) {
              chunks.push(textLine.substring(pos, pos + 32));
            }

            for (const chunk of chunks) {
              if (slotIndex >= 36) break;

              items[slotIndex] = {
                blockId: itemId,
                itemCount: 1,
                itemDamage: itemDamage,
                displayName: chunk,
                enchanted: isEnchanted,
              };

              if (clickAction) {
                client._bookGUI.clickActions[slotIndex] = clickAction;
              }

              slotIndex++;
            }
          }
        }
      }
    } catch (err) {
      items[0] = {
        blockId: 339,
        itemCount: 1,
        itemDamage: 0,
        displayName: "Error loading page",
      };
    }

    let itemCount = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].blockId !== -1) {
        itemCount++;
      }
    }

    const PacketWriter = require("./packetwriter");
    const invWriter = new PacketWriter();
    invWriter.writeByte(windowId);
    invWriter.writeShort(items.length);

    for (const item of items) {
      this.writeItem(invWriter, item);
    }

    this.sendPacket(client, 0x68, invWriter.toBuffer());
  }

  //debug
  sendFlatChunk(client, chunkX, chunkZ) {
    const xs = 16;
    const ys = 256;
    const zs = 16;
    const blockCount = xs * ys * zs;
    const halfBlockCount = blockCount / 2;
    const biomeSize = xs * zs;
    const rawSize = blockCount + 3 * halfBlockCount + biomeSize;

    const rawData = Buffer.alloc(rawSize);
    let offset = 0;

    for (let y = 0; y < ys; y++) {
      for (let z = 0; z < zs; z++) {
        for (let x = 0; x < xs; x++) {
          let blockId = 0;

          if (y < 65) {
            blockId = 1;
          }
          if (y === 64) {
            blockId = 2;
          }
          rawData[offset++] = blockId;
        }
      }
    }

    const metadataOffset = offset;
    for (let x = 0; x < xs; x++) {
      for (let z = 0; z < zs; z++) {
        for (let yPair = 0; yPair < ys / 2; yPair++) {
          rawData[offset++] = 0;
        }
      }
    }

    for (let x = 0; x < xs; x++) {
      for (let z = 0; z < zs; z++) {
        for (let yPair = 0; yPair < ys / 2; yPair++) {
          rawData[offset++] = 0;
        }
      }
    }

    for (let x = 0; x < xs; x++) {
      for (let z = 0; z < zs; z++) {
        for (let yPair = 0; yPair < ys / 2; yPair++) {
          rawData[offset++] = 0xff;
        }
      }
    }
    for (let i = 0; i < biomeSize; i++) {
      rawData[offset++] = 1;
    }

    const rleCompressed = compressRLE(rawData);
    const compressed = zlib.deflateSync(rleCompressed, { level: 6 });

    const writer = new PacketWriter();

    writer.writeByte(0x01);

    const worldX = chunkX * 16;
    const worldY = 0;
    const worldZ = chunkZ * 16;

    writer.writeInt(worldX);
    writer.writeShort(worldY);
    writer.writeInt(worldZ);

    writer.writeByte(xs - 1);
    writer.writeByte(ys - 1);
    writer.writeByte(zs - 1);

    const levelIdx = 0;
    const sizeAndLevel = compressed.length | (levelIdx << 30);
    writer.writeInt(sizeAndLevel);

    const payload = writer.toBuffer();
    const fullPayload = Buffer.concat([payload, compressed]);

    const visWriter = new PacketWriter();
    visWriter.writeInt(chunkX);
    visWriter.writeInt(chunkZ);
    visWriter.writeByte(1);
    this.sendPacket(client, 0x32, visWriter.toBuffer());

    const chunkKey = `${chunkX},${chunkZ}`;
    if (client.loadedChunks) {
      client.loadedChunks.add(chunkKey);
    }

    this.sendPacket(client, 0x33, fullPayload);
  }

  handleKeepAlive(client, data) {
    const reader = new PacketReader(data.slice(1));
    const keepAliveId = reader.readInt();

    const writer = new PacketWriter();
    writer.writeInt(keepAliveId);
    this.sendPacket(client, 0x00, writer.toBuffer());
  }

  handleInteract(client, packetData) {
    const reader = new PacketReader(packetData.slice(1));
    const sourceId = reader.readInt();
    const targetId = reader.readInt();
    const action = reader.readByte();

    if (action === 0) {
      const heldSlot = client.heldSlot || 0;
      const heldItem = client.inventory
        ? client.inventory[36 + heldSlot]
        : null;
      const heldItemId = heldItem ? heldItem.blockId : -1;

      const nonInteractiveItems = [
        346, //fishing rod
        261, //bow
        //foods
        260,
        297,
        282,
        350,
        349,
        360,
        363,
        365,
        366,
        320,
        357,
        391,
        392,
        393,
        394,
        //potions
        373,
        438,
        //buckets (except milk)
        326,
        327,
        //ender pearl, snowball, egg
        368,
        332,
        344,
      ];

      if (nonInteractiveItems.includes(heldItemId)) {
        return;
      }
    }

    if (client._destroyedEntities && client._destroyedEntities.has(targetId)) {
      return;
    }

    if (action === 1) {
      const now = Date.now();
      if (!client._lastAttacks) client._lastAttacks = new Map();

      const lastAttackTime = client._lastAttacks.get(targetId) || 0;
      if (now - lastAttackTime < 500) {
        return;
      }
      client._lastAttacks.set(targetId, now);

      if (client._lastAttacks.size > 100) {
        const oldestEntry = Array.from(client._lastAttacks.entries()).sort(
          (a, b) => a[1] - b[1],
        )[0];
        client._lastAttacks.delete(oldestEntry[0]);
      }
    }

    const targetEntity = Array.from(client.javaEntities.values()).find(
      (e) => e.entityId === targetId,
    );
    const entityType = targetEntity
      ? `${targetEntity.javaType}(${targetEntity.type})`
      : "UNKNOWN";

    let targetJavaId = -1;

    for (const [javaId, entity] of client.javaEntities) {
      if (entity.entityId === targetId) {
        if (client._deadEntities && client._deadEntities.has(javaId)) {
          return;
        }
        targetJavaId = javaId;
        break;
      }
    }

    for (const [uuid, player] of client.javaPlayers) {
      if (player.entityId === targetId && player.spawned) {
        targetJavaId = player.javaEntityId;
        break;
      }
    }

    if (targetJavaId !== -1 && client.javaClient) {
      let entityExists = client.javaEntities.has(targetJavaId);
      if (!entityExists) {
        for (const [uuid, player] of client.javaPlayers) {
          if (player.javaEntityId === targetJavaId && player.spawned) {
            entityExists = true;
            break;
          }
        }
      }

      if (!entityExists) {
        return;
      }

      if (action === 1) {
        if (!client._pendingAttacks) client._pendingAttacks = new Set();

        if (client._pendingAttacks.has(targetJavaId)) {
          return;
        }

        client._pendingAttacks.add(targetJavaId);

        setTimeout(() => {
          if (client._pendingAttacks) {
            client._pendingAttacks.delete(targetJavaId);
          }
        }, 150);

        client.javaClient.write("use_entity", {
          target: targetJavaId,
          mouse: 1,
          sneaking: false,
        });
      } else {
        client.javaClient.write("use_entity", {
          target: targetJavaId,
          mouse: 0,
          sneaking: false,
        });
      }
    } else {
      const allEntities = Array.from(client.javaEntities.values()).map(
        (e) => `LCE:${e.entityId}=Java:${e.javaEntityId}(${e.javaType})`,
      );
    }
  }

  handleAnimate(client, packetData, isBundled = false) {
    try {
      const reader = new PacketReader(packetData.slice(1));
      const entityId = reader.readInt();
      const action = reader.readByte();

      if (client.javaClient && action === 1) {
        client.javaClient.write("arm_animation", {
          hand: 0,
        });

        const targetEntity = this.raycastEntity(client);
        if (targetEntity) {
          const heldSlot = client.heldSlot || 0;
          const heldItem = client.inventory
            ? client.inventory[36 + heldSlot]
            : null;
          const heldItemId = heldItem ? heldItem.blockId : -1;

          const useItems = [
            346, //fishing rod
            261, //bow
          ];

          if (useItems.includes(heldItemId)) {
            return;
          }
          const entity = client.javaEntities.get(targetEntity);
          let isPlayer = false;

          if (!entity) {
            for (const [uuid, player] of client.javaPlayers) {
              if (player.javaEntityId === targetEntity && player.spawned) {
                isPlayer = true;
                break;
              }
            }

            if (!isPlayer) {
              return;
            }
          } else {
            if (!entity.spawnTime) {
              return;
            }

            const now = Date.now();
            const timeSinceSpawn = now - entity.spawnTime;
            if (timeSinceSpawn < 500) {
              return;
            }
          }

          if (client._deadEntities && client._deadEntities.has(targetEntity)) {
            return;
          }

          if (!client._pendingAttacks) client._pendingAttacks = new Set();
          if (client._pendingAttacks.has(targetEntity)) {
            return;
          }

          client._pendingAttacks.add(targetEntity);
          setTimeout(() => {
            if (client._pendingAttacks) {
              client._pendingAttacks.delete(targetEntity);
            }
          }, 150);

          client.javaClient.write("use_entity", {
            target: targetEntity,
            mouse: 1,
            sneaking: false,
          });
        }
      }
    } catch (err) {
      /* do nothing */
    }
  }

  raycastEntity(client) {
    if (!client.playerX || !client.playerYaw || !client.playerPitch) {
      return null;
    }

    const playerX = client.playerX;
    const playerY = client.playerY + 1.62; //eye height
    const playerZ = client.playerZ;
    const yaw = client.playerYaw;
    const pitch = client.playerPitch;

    const yawRad = ((yaw + 90) * Math.PI) / 180;
    const pitchRad = (pitch * Math.PI) / 180;

    const dirX = Math.cos(pitchRad) * Math.cos(yawRad);
    const dirY = -Math.sin(pitchRad);
    const dirZ = Math.cos(pitchRad) * Math.sin(yawRad);

    //max hit distance
    const maxDistance = 10.0;
    let closestEntity = null;
    let closestDistance = maxDistance;

    for (const [javaId, entity] of client.javaEntities) {
      if (!entity.x || !entity.y || !entity.z) continue;

      const isLivingEntity =
        (entity.type >= 48 && entity.type <= 66) || //monsters
        (entity.type >= 90 && entity.type <= 100) || //animals
        entity.type === 120; //villagers
      if (!isLivingEntity) continue;

      const entityX = entity.x;
      const entityY = entity.y + 1.0; //probably the center
      const entityZ = entity.z;

      const toEntityX = entityX - playerX;
      const toEntityY = entityY - playerY;
      const toEntityZ = entityZ - playerZ;

      const distance = Math.sqrt(
        toEntityX * toEntityX + toEntityY * toEntityY + toEntityZ * toEntityZ,
      );

      if (distance > maxDistance || distance > closestDistance) continue;

      const dot =
        (toEntityX * dirX + toEntityY * dirY + toEntityZ * dirZ) / distance;

      //hit fov
      if (dot > 0.97) {
        closestEntity = javaId;
        closestDistance = distance;
      }
    }

    for (const [uuid, player] of client.javaPlayers) {
      if (!player.spawned || !player.x || !player.y || !player.z) continue;
      if (!player.javaEntityId) continue;

      const playerEntityX = player.x;
      const playerEntityY = player.y + 1.0; //probably the center
      const playerEntityZ = player.z;

      const toPlayerX = playerEntityX - playerX;
      const toPlayerY = playerEntityY - playerY;
      const toPlayerZ = playerEntityZ - playerZ;

      const distance = Math.sqrt(
        toPlayerX * toPlayerX + toPlayerY * toPlayerY + toPlayerZ * toPlayerZ,
      );

      if (distance > maxDistance || distance > closestDistance) continue;

      const dot =
        (toPlayerX * dirX + toPlayerY * dirY + toPlayerZ * dirZ) / distance;

      //hit fov
      if (dot > 0.97) {
        closestEntity = player.javaEntityId;
        closestDistance = distance;
      }
    }

    return closestEntity;
  }

  handleMovePlayer(client, data) {
    const reader = new PacketReader(data.slice(1));
    const dataSize = data.length - 1;

    let x, y, yView, z, yRot, xRot, onGround;

    if (dataSize >= 33) {
      x = reader.readDouble();
      y = reader.readDouble();
      yView = reader.readDouble();
      z = reader.readDouble();

      if (dataSize >= 41) {
        yRot = reader.readFloat();
        xRot = reader.readFloat();
      } else {
        yRot = client.lastYaw || 0;
        xRot = client.lastPitch || 0;
      }
      onGround = reader.readByte();
    } else if (dataSize >= 9) {
      yRot = reader.readFloat();
      xRot = reader.readFloat();
      onGround = reader.readByte();

      x = client.playerX || 0;
      y = client.playerY || 0;
      yView = y;
      z = client.playerZ || 0;
    } else {
      return;
    }

    const normalizedYaw = normalizeYaw(yRot);

    client.playerX = x;
    client.playerY = y;
    client.playerZ = z;
    client.playerYaw = normalizedYaw;
    client.playerPitch = xRot;

    client.lastYaw = normalizedYaw;
    client.lastPitch = xRot;

    if (client.javaClient && client.javaClient.write) {
      try {
        client.javaClient.write("position_look", {
          x: x,
          y: y,
          z: z,
          yaw: normalizedYaw,
          pitch: xRot,
          onGround: onGround !== 0,
        });
      } catch (err) {
        /* do nothing */
      }
    }
  }

  handleUseItem(client, data) {
    const reader = new PacketReader(data.slice(1));
    const x = reader.readInt();
    const y = reader.readByte();
    const z = reader.readInt();
    const face = reader.readByte();

    const itemId = reader.readShort();

    let itemCount = 0;
    let itemAux = 0;
    if (itemId !== -1) {
      itemCount = reader.readByte();
      itemAux = reader.readShort();
    }

    const clickX = reader.readByte() / 32.0;
    const clickY = reader.readByte() / 32.0;
    const clickZ = reader.readByte() / 32.0;

    if (x !== -1 && y !== -1 && z !== -1 && face >= 0 && face <= 5) {
      client._lastBlockClicked = { x, y, z };

      if (client.javaClient && client.javaClient.write) {
        try {
          let javaItemId = -1;
          if (itemId !== -1) {
            javaItemId = this.mapLCEItemToJava(itemId);
          }

          let heldItem;
          if (javaItemId !== -1 && javaItemId !== 0) {
            heldItem = {
              blockId: javaItemId,
              itemCount: itemCount || 1,
              itemDamage: itemAux || 0,
            };
          } else {
            heldItem = {
              blockId: -1,
              itemCount: 0,
              itemDamage: 0,
            };
          }

          const javaFace = face;

          const cursorX = Math.floor(clickX * 16);
          const cursorY = Math.floor(clickY * 16);
          const cursorZ = Math.floor(clickZ * 16);

          client.javaClient.write("block_place", {
            location: { x: x, y: y, z: z },
            direction: javaFace,
            heldItem: heldItem,
            cursorX: cursorX,
            cursorY: cursorY,
            cursorZ: cursorZ,
          });
        } catch (err) {
          /* do nothing */
        }
      }
    } else {
      //LCE also sends InteractPacket separately for entity interaction, so we ignore that
      if (client.javaClient) {
        if (itemId !== -1) {
          client._lastHeldItem = {
            itemId: itemId,
            itemCount: itemCount,
            itemAux: itemAux,
          };
        }

        const useItemId =
          itemId !== -1
            ? itemId
            : client._lastHeldItem
              ? client._lastHeldItem.itemId
              : -1;
        const useItemCount =
          itemId !== -1
            ? itemCount
            : client._lastHeldItem
              ? client._lastHeldItem.itemCount
              : 0;
        const useItemAux =
          itemId !== -1
            ? itemAux
            : client._lastHeldItem
              ? client._lastHeldItem.itemAux
              : 0;

        if (useItemId !== -1) {
          const javaItemId = this.mapLCEItemToJava(useItemId);

          if (javaItemId !== -1 && javaItemId !== 0) {
            const continuousUseItems = { 261: "bow", 346: "fishing_rod" };
            const itemName = continuousUseItems[javaItemId];

            if (itemName) {
              if (!client._itemUseState) client._itemUseState = {};
              const now = Date.now();
              const lastUse = client._itemUseState[javaItemId] || 0;

              if (now - lastUse > 100) {
                const heldItem = {
                  blockId: javaItemId,
                  itemCount: useItemCount || 1,
                  itemDamage: useItemAux || 0,
                };

                client.javaClient.write("block_place", {
                  location: { x: -1, y: 255, z: -1 },
                  direction: -1,
                  heldItem: heldItem,
                  cursorX: 0,
                  cursorY: 0,
                  cursorZ: 0,
                });

                client._itemUseState[javaItemId] = now;
              }
            } else {
              const heldItem = {
                blockId: javaItemId,
                itemCount: useItemCount || 1,
                itemDamage: useItemAux || 0,
              };

              try {
                const blockPlacePacket = {
                  location: { x: -1, y: 255, z: -1 },
                  direction: -1,
                  heldItem: heldItem,
                  cursorX: 0,
                  cursorY: 0,
                  cursorZ: 0,
                };
                client.javaClient.write("block_place", blockPlacePacket);
              } catch (err) {
                /* do nothing */
              }
            }
          }
        }
      }
    }
  }

  handleChat(client, data) {
    const reader = new PacketReader(data.slice(1));
    const messageType = reader.readShort();
    const packedCounts = reader.readShort();

    const stringCount = (packedCounts >> 4) & 0xf;
    const intCount = (packedCounts >> 0) & 0xf;

    if (stringCount > 0) {
      const message = reader.readString();

      if (
        client.javaClient &&
        client.javaClient.write &&
        message &&
        message.length > 0
      ) {
        try {
          client.javaClient.write("chat", {
            message: message,
          });
        } catch (err) {
          /* do nothing */
        }
      }
    }
  }

  handlePlayerAction(client, data, isBundled = false) {
    const reader = new PacketReader(data.slice(1));
    const action = reader.readByte();
    const x = reader.readInt();
    const y = reader.readByte();
    const z = reader.readInt();
    const face = reader.readByte();

    //0=START_DESTROY_BLOCK
    //1=ABORT_DESTROY_BLOCK
    //2=STOP_DESTROY_BLOCK
    //3=DROP_ALL_ITEMS
    //4=DROP_ITEM
    //5=RELEASE_USE_ITEM

    if (action === 0) {
      if (client.javaClient && client.javaClient.write) {
        try {
          client.javaClient.write("block_dig", {
            status: 0,
            location: { x: x, y: y, z: z },
            face: face >= 0 ? face : 1,
          });
        } catch (err) {
          /* do nothing */
        }
      }
    } else if (action === 1) {
      if (client.javaClient && client.javaClient.write) {
        try {
          client.javaClient.write("block_dig", {
            status: 1,
            location: { x: x, y: y, z: z },
            face: face >= 0 ? face : 1,
          });
        } catch (err) {
          /* do nothing */
        }
      }
    } else if (action === 2) {
      if (client.javaClient && client.javaClient.write) {
        try {
          client.javaClient.write("block_dig", {
            status: 2,
            location: { x: x, y: y, z: z },
            face: face >= 0 ? face : 1,
          });
        } catch (err) {
          /* do nothing */
        }
      }
    } else if (action === 3 || action === 4) {
      if (client.javaClient && client.javaClient.write) {
        try {
          const javaStatus = action === 4 ? 4 : 3;
          const packet = {
            status: javaStatus,
            location: { x: 0, y: 0, z: 0 },
            face: 0,
          };
          client.javaClient.write("block_dig", packet);
        } catch (err) {
          /* do nothing */
        }
      }
    } else if (action === 5) {
      if (client.javaClient && client.javaClient.write) {
        try {
          client.javaClient.write("block_dig", {
            status: 5,
            location: { x: x, y: y, z: z },
            face: face,
          });
        } catch (err) {
          /* do nothing */
        }
      }
    }
  }

  handleSetCarriedItem(client, data) {
    const reader = new PacketReader(data.slice(1));
    const slot = reader.readShort();

    if (slot < 0 || slot > 8) {
      return;
    }

    client.heldSlot = slot;

    if (client.javaClient && client.javaClient.write) {
      try {
        client.javaClient.write("held_item_slot", {
          slotId: slot,
        });
      } catch (err) {
        /* do nothing */
      }
    }
  }

  handlePlayerInput(client, data) {
    const reader = new PacketReader(data.slice(1));
    const xxa = reader.readFloat();
    const yya = reader.readFloat();
    const isJumping = reader.readBoolean();
    const isSneaking = reader.readBoolean();

    client.isSneaking = isSneaking;

    //broken
    if (isSneaking && client.javaClient && client.javaClient.write) {
      try {
        client.javaClient.write("steer_vehicle", {
          sideways: 0,
          forward: 0,
          jump: false,
          unmount: true,
        });
      } catch (err) {
        /* do nothing */
      }
    }
  }

  handlePlayerCommand(client, data) {
    const reader = new PacketReader(data.slice(1));
    const entityId = reader.readInt();
    const action = reader.readByte();
    const actionData = reader.readInt();

    if (client.javaClient && client.javaClient.write) {
      try {
        let javaAction = -1;

        if (action === 1) {
          javaAction = 0;
          if (client.isRiding) {
            client.javaClient.write("steer_vehicle", {
              sideways: 0,
              forward: 0,
              jump: false,
              unmount: true,
            });
          }
        } else if (action === 2) {
          javaAction = 1; //java: STOP_SNEAKING
        } else if (action === 3) {
          javaAction = 2; //java: LEAVE_BED
        } else if (action === 4) {
          javaAction = 3; //java: START_SPRINTING
        } else if (action === 5) {
          javaAction = 4; //java: STOP_SPRINTING
        } else if (action === 8) {
          javaAction = 5; //java: RIDING_JUMP (open horse inventory)
        } else if (action === 9) {
          javaAction = 6; //java: OPEN_INVENTORY
        }

        if (javaAction !== -1) {
          client.javaClient.write("entity_action", {
            entityId: entityId,
            actionId: javaAction,
            jumpBoost: actionData || 0,
          });
        }
      } catch (err) {
        /* do nothing */
      }
    }
  }

  handlePlayerInput(client, data) {
    const reader = new PacketReader(data.slice(1));
    const xxa = reader.readFloat();
    const yya = reader.readFloat();
    const isJumping = reader.readBoolean();
    const isSneaking = reader.readBoolean();

    if (client.javaClient && client.javaClient.write) {
      try {
        if (client.isRiding) {
          if (isSneaking && !client.sentSneak) {
            client.sentSneak = true;
            client.javaClient.write("entity_action", {
              entityId: client.javaPlayerEntityId,
              actionId: 0,
              jumpBoost: 0,
            });
            return;
          }

          if (!isSneaking) {
            client.sentSneak = false;
          }

          if (xxa !== 0 || yya !== 0 || isJumping) {
            client.javaClient.write("steer_vehicle", {
              sideways: xxa,
              forward: yya,
              jump: isJumping,
              unmount: false,
            });
          }
        }
      } catch (err) {
        /* do nothing */
      }
    }
  }

  handleContainerClose(client, data) {
    const reader = new PacketReader(data.slice(1));
    const containerId = reader.readByte();

    if (client.openWindowId === containerId) {
      client.openWindowType = null;
      client.openWindowId = null;
    }

    if (client._currentChest && client._currentChest.windowId === containerId) {
      const posKey = client._currentChest.posKey;
      const chestData = this.openChests.get(posKey);

      if (chestData) {
        chestData.clients.delete(client);

        if (chestData.clients.size === 0) {
          this.openChests.delete(posKey);
        }
      }

      if (this.clientChests.has(client)) {
        this.clientChests.get(client).delete(posKey);
      }

      delete client._currentChest;
    }

    if (client._bookGUI && containerId === client.openWindowId) {
      delete client._bookGUI;
      return;
    }

    //LCE uses special window IDs
    //-1=crafting table in inventory
    //-2=creative inventory
    //java doesn't send close packets for these, so we'll just skip them
    if (containerId < 0) {
      return;
    }

    if (client.javaClient && client.javaClient.write) {
      try {
        client.javaClient.write("close_window", {
          windowId: containerId,
        });
      } catch (err) {
        /* do nothing */
      }
    }
  }

  handleCustomPayload(client, data) {
    const reader = new PacketReader(data.slice(1));
    const identifier = reader.readString();
    const length = reader.readShort();

    const stringByteLength = identifier.length * 2;
    const offset = 1 + 2 + stringByteLength + 2;
    const payloadData = data.slice(offset, offset + length);

    if (identifier === "MC|ItemName") {
      const nameLength = payloadData.readUInt16BE(0);
      const nameData = payloadData.slice(2, 2 + nameLength);
      const itemName = nameData.toString("utf8");

      if (client.javaClient && client.javaClient.write) {
        try {
          const stringBytes = Buffer.from(itemName, "utf8");

          const varintLength = encodeVarInt(stringBytes.length);
          const stringBuffer = Buffer.concat([varintLength, stringBytes]);

          client._anvilItemName = itemName;

          try {
            const payloadPacket = {
              channel: "MC|ItemName",
              data: stringBuffer,
            };
            client.javaClient.write("custom_payload", payloadPacket);
          } catch (writeErr) {
            throw writeErr;
          }
        } catch (err) {
          /* do nothing */
        }
      }
    } else if (identifier === "MC|TrSel") {
      if (client.javaClient && client.javaClient.write) {
        try {
          client.javaClient.write("custom_payload", {
            channel: "MC|TrSel",
            data: payloadData,
          });
        } catch (err) {
          /* do nothing */
        }
      }
    } else if (identifier === "MC|BEdit" || identifier === "MC|BSign") {
      if (client.javaClient && client.javaClient.write) {
        try {
          client.javaClient.write("custom_payload", {
            channel: identifier,
            data: payloadData,
          });
        } catch (err) {
          /* do nothing */
        }
      }
    }
  }

  placeTradeItems(client, windowId, tradeInfo, offerIndex) {
    //very broken, java requires you to send clicks with the current item in the slot
    //we have to track inventory and update it after each click, but this is complicated
    if (!client.javaClient) return;

    if (!client._windowInventories || !client._windowInventories[windowId]) {
      return;
    }

    const inventory = client._windowInventories[windowId];

    const findItem = (requiredItem) => {
      for (let slot = 3; slot <= 38; slot++) {
        const item = inventory[slot];
        if (item && item.blockId === requiredItem.blockId) {
          if (item.itemCount >= requiredItem.itemCount) {
            return slot;
          }
        }
      }
      return null;
    };

    const input1Slot = tradeInfo.input1 ? findItem(tradeInfo.input1) : null;
    const input2Slot = tradeInfo.input2 ? findItem(tradeInfo.input2) : null;

    if (tradeInfo.input1 && !input1Slot) {
      console.error(0);
      return;
    }

    if (tradeInfo.input2 && !input2Slot) {
      console.error(1);
      return;
    }

    const clickSequence = [];

    if (input1Slot) {
      const item1 = inventory[input1Slot];
      const hasRemainder = item1.itemCount > tradeInfo.input1.itemCount;

      clickSequence.push(
        {
          slot: input1Slot,
          item: item1,
          mode: 0,
          desc: `pickup ${item1.itemCount} from slot ${input1Slot}`,
        },
        {
          slot: 0,
          item: null,
          mode: 0,
          desc: `place ${tradeInfo.input1.itemCount} in trade slot 0`,
        },
      );

      if (hasRemainder) {
        clickSequence.push({
          slot: input1Slot,
          item: null,
          mode: 0,
          desc: `return extra to slot ${input1Slot}`,
        });
      }

      clickSequence._updateSlot = input1Slot;
      clickSequence._updateItem = item1;
      clickSequence._usedCount = tradeInfo.input1.itemCount;
    }

    let targetSlot = null;
    for (let slot = 30; slot <= 38; slot++) {
      if (!inventory[slot] || inventory[slot].blockId === -1) {
        targetSlot = slot;
        break;
      }
    }
    if (!targetSlot) {
      for (let slot = 3; slot <= 29; slot++) {
        if (!inventory[slot] || inventory[slot].blockId === -1) {
          targetSlot = slot;
          break;
        }
      }
    }

    if (targetSlot) {
      clickSequence.push(
        {
          slot: 2,
          item: tradeInfo.output,
          mode: 0,
          desc: `pick up trade result from slot 2`,
        },
        {
          slot: targetSlot,
          item: null,
          mode: 0,
          desc: `place trade result in slot ${targetSlot}`,
        },
      );
    }

    let delay = 0;
    clickSequence.forEach((click) => {
      setTimeout(() => {
        const action = client.windowClickAction++;

        try {
          let itemParam;
          if (click.item) {
            itemParam = {
              blockId: click.item.blockId,
              itemCount: click.item.itemCount,
              itemDamage: click.item.itemDamage || 0,
            };
          } else {
            itemParam = { blockId: -1 };
          }

          const clickMode = click.mode !== undefined ? click.mode : 0;

          client.javaClient.write("window_click", {
            windowId: windowId,
            slot: click.slot,
            mouseButton: 0,
            action: action,
            mode: clickMode,
            item: itemParam,
          });
        } catch (err) {
          /* do nothing */
        }
      }, delay);
      delay += 75;
    });

    if (clickSequence._updateSlot) {
      const remainingCount =
        clickSequence._updateItem.itemCount - clickSequence._usedCount;
      if (remainingCount > 0) {
        inventory[clickSequence._updateSlot] = {
          blockId: clickSequence._updateItem.blockId,
          itemCount: remainingCount,
          itemDamage: clickSequence._updateItem.itemDamage,
        };
      } else {
        delete inventory[clickSequence._updateSlot];
      }
    }

    const totalDelay = delay;
    setTimeout(() => {
      if (client.javaClient && client.javaClient.write) {
        try {
          client.javaClient.write("window_click", {
            windowId: windowId,
            slot: -999,
            mouseButton: 0,
            action: client.windowClickAction++,
            mode: 0,
            item: { blockId: -1 },
          });
        } catch (err) {
          /* do nothing */
        }
      }

      setTimeout(() => {
        client._tradeInProgress = false;
      }, 200);
    }, totalDelay + 100);
  }

  handleCraftItem(client, data) {
    const debugLog = true;
    if (client._craftingInProgress) {
      if (debugLog) console.log("craft already in progress ignoring");
      return;
    }

    const reader = new PacketReader(data.slice(1));
    const uid = reader.readShort();
    const recipeId = reader.readInt();
    //console.log(recipeId);

    const grid = recipeData[recipeId] || [
      "none",
      "none",
      "none",
      "none",
      "none",
      "none",
      "none",
      "none",
      "none",
    ];

    if (!client.inventory) {
      if (debugLog) console.log("no inventory");
      client._craftingInProgress = false;
      return;
    }

    if (debugLog) console.log("id", recipeId);
    client._craftingInProgress = true;
    this.tryPlaceItemsInCraftingGrid(client, grid, recipeId);
  }
  handleJavaCrafting(client, data) {
    /* do nothing */
  }

  getCraftingResult(grid) {
    const craftingResults = {
      0: { resultItemId: 5, resultCount: 4 },
      1: { resultItemId: 5, resultCount: 4 },
      2: { resultItemId: 5, resultCount: 4 },
      3: { resultItemId: 5, resultCount: 4 },
      4: { resultItemId: 280, resultCount: 4 },
      44: { resultItemId: 58, resultCount: 1 },
      46: { resultItemId: 54, resultCount: 1 },
    };

    const recipeStr = grid.join(",");
    for (const [recipeId, recipe] of Object.entries(recipeData)) {
      if (recipe.join(",") === recipeStr) {
        return craftingResults[recipeId];
      }
    }
    return null;
  }

  craftItemDirectly(client, grid, recipeId) {
    if (!client.javaClient || !client.javaClient.write) {
      return;
    }

    const craftingResults = this.getCraftingResult(grid);
    if (!craftingResults) {
      return;
    }

    const { resultItemId, resultCount } = craftingResults;

    const requiredItems = this.findRequiredItems(client, grid);
    if (!requiredItems) {
      return;
    }

    requiredItems.forEach((req) => {
      if (!req) return;
      const slot = req.sourceSlot;
      const item = client.inventory[slot];
      if (item && item.itemCount > 1) {
        item.itemCount--;
        client.inventory[slot] = item;
      } else {
        client.inventory[slot] = { blockId: -1, itemCount: 0, itemDamage: 0 };
      }
    });

    let addedToExisting = false;
    for (let slot = 9; slot < 45; slot++) {
      const item = client.inventory[slot];
      if (item && item.blockId === resultItemId && item.itemCount < 64) {
        item.itemCount = Math.min(64, (item.itemCount || 0) + resultCount);
        client.inventory[slot] = item;
        addedToExisting = true;
        break;
      }
    }

    if (!addedToExisting) {
      for (let slot = 9; slot < 45; slot++) {
        const item = client.inventory[slot];
        if (!item || item.blockId === -1) {
          client.inventory[slot] = {
            blockId: resultItemId,
            itemCount: resultCount,
            itemDamage: 0,
          };
          break;
        }
      }
    }

    for (let i = 0; i < 45; i++) {
      const item = client.inventory[i] || {
        blockId: -1,
        itemCount: 0,
        itemDamage: 0,
      };
      try {
        client.javaClient.write("set_slot", {
          windowId: 0,
          slot: i,
          item: item,
        });
      } catch (err) {
        /* do nothing */
      }
    }
  }

  tryPlaceItemsInCraftingGrid(client, grid, recipeId) {
    const debugLog = true;
    if (debugLog) console.log("placing items");
    const itemNameToDamage = {
      wool: 0,
      orange_wool: 1,
      magenta_wool: 2,
      light_blue_wool: 3,
      yellow_wool: 4,
      lime_wool: 5,
      pink_wool: 6,
      gray_wool: 7,
      light_gray_wool: 8,
      cyan_wool: 9,
      purple_wool: 10,
      blue_wool: 11,
      brown_wool: 12,
      green_wool: 13,
      red_wool: 14,
      black_wool: 15,
    };

    const itemNameToJavaId = {
      oak_log: 17,
      birch_log: 17,
      spruce_log: 17,
      jungle_log: 17,
      acacia_log: 162,
      dark_oak_log: 162,
      any_log: [17, 162],
      any_plank: 5,
      oak_plank: 5,
      birch_planks: 5,
      spruce_planks: 5,
      jungle_planks: 5,
      stick: 280,
      cobblestone: 4,
      iron_ingot: 265,
      diamond: 264,
      gold_ingot: 266,
      any_wool: 35,
      wool: 35,
      sand: 12,
      sandstone: 24,
      sandstone_slab: 44,
      quartz_slab: 44,
      quartz_block: 155,
      stone: 1,
      nether_brick: 112,
      snowball: 332,
      clay: 337,
      brick: 336,
      nether_quartz: 406,
      book: 340,
      obsidian: 49,
      iron_block: 42,
      blaze_rod: 369,
      chest: 54,
      tripwire_hook: 131,
      ender_eye: 381,
      mossy_cobblestone: 48,
      stonebrick: 98,
      brick_block: 45,
      charcoal: 263,
      coal: 263,
      glowstone: 348,
      gunpowder: 289,
      blaze_powder: 377,
      pumpkin: 86,
      torch: 50,
      redstone: 331,
      ender_pearl: 368,
      slime_ball: 341,
      paper: 339,
      compass: 345,
      apple: 260,
      gold_block: 41,
      gold_nugget: 371,
      melon: 360,
      carrot: 391,
      brown_mushroom: 39,
      red_mushroom: 40,
      bowl: 281,
      wheat: 296,
      cocoa_beans: 351,
      flint: 318,
      string: 287,
      fishing_rod: 346,
      feather: 288,
      glass: 20,
      any_slab: 44,
      inc_sac: 351,
      red_dye: 351,
      green_dye: 351,
      lapis: 351,
      purple_dye: 351,
      cyan_dye: 351,
      light_gray_dye: 351,
      gray_dye: 351,
      pink_dye: 351,
      lime_dye: 351,
      yellow_dye: 351,
      light_blue_dye: 351,
      magenta_dye: 351,
      orange_dye: 351,
      bone_meal: 351,
      dandelion: 37,
      rose: 38,
      orange_wool: 35,
      magenta_wool: 35,
      light_blue_wool: 35,
      yellow_wool: 35,
      lime_wool: 35,
      pink_wool: 35,
      gray_wool: 35,
      light_gray_wool: 35,
      cyan_wool: 35,
      purple_wool: 35,
      blue_wool: 35,
      brown_wool: 35,
      green_wool: 35,
      red_wool: 35,
      black_wool: 35,
    };

    const requiredItems = [];
    let allItemsFound = true;
    const slotUsageCount = new Map();

    for (let i = 0; i < 9; i++) {
      const requiredItem = grid[i];
      if (requiredItem === "none") {
        requiredItems[i] = null;
        continue;
      }

      const javaItemId = itemNameToJavaId[requiredItem];
      if (!javaItemId) {
        if (debugLog) console.log("could not find item for", requiredItem);
        allItemsFound = false;
        continue;
      }

      const acceptedIds = Array.isArray(javaItemId) ? javaItemId : [javaItemId];
      if (debugLog)
        console.log("looking for", requiredItem, "with id(s)", acceptedIds);

      let foundSlot = null;
      const windowId = client.openWindowId || 0;
      const isCraftingTable =
        client.openWindowType === "minecraft:crafting_table";

      const inventoryToSearch =
        isCraftingTable &&
        client._windowInventories &&
        client._windowInventories[windowId]
          ? client._windowInventories[windowId]
          : client.inventory;

      const startSlot = isCraftingTable ? 10 : 9;
      const endSlot = isCraftingTable ? 46 : 45;

      for (let slot = startSlot; slot < endSlot; slot++) {
        const item = inventoryToSearch[slot];
        if (item && acceptedIds.includes(item.blockId)) {
          const requiredDamage = itemNameToDamage[requiredItem];
          if (
            requiredDamage !== undefined &&
            item.itemDamage !== requiredDamage
          ) {
            if (debugLog)
              console.log(
                "found item at slot",
                slot,
                "but damage does not match. need",
                requiredDamage,
                "got",
                item.itemDamage,
              );
            continue;
          }
          if (debugLog) console.log("found", requiredItem, "at slot", slot);

          const itemCount = item.itemCount || 1;
          const usedCount = slotUsageCount.get(slot) || 0;

          if (usedCount < itemCount) {
            foundSlot = slot;
            let gridSlot;
            if (isCraftingTable) {
              gridSlot = i + 1;
            } else {
              const slot2x2Map = { 0: 1, 1: 2, 3: 3, 4: 4 };
              gridSlot = slot2x2Map[i] || i + 1;
            }

            requiredItems[i] = {
              sourceSlot: slot,
              itemId: item.blockId,
              gridSlot: gridSlot,
            };
            slotUsageCount.set(slot, usedCount + 1);
            break;
          }
        }
      }

      if (!foundSlot) {
        if (debugLog)
          console.log("could not find", requiredItem, "in inventory");
        allItemsFound = false;
      }
    }

    if (!allItemsFound) {
      if (debugLog) console.log("not all items found");
      client._craftingInProgress = false;
      return;
    }

    if (debugLog) console.log("all items found, placing");
    this.placeItemsInGrid(client, requiredItems);
  }

  placeItemsInGrid(client, requiredItems) {
    const debugLog = true;
    if (!client.javaClient || !client.javaClient.write) {
      client._craftingInProgress = false;
      return;
    }
    if (debugLog) console.log("placing", requiredItems.length, "items");

    if (!client.windowClickAction) {
      client.windowClickAction = 1;
    }

    const clicks = [];
    const slotGroups = new Map();

    for (let i = 0; i < requiredItems.length; i++) {
      if (!requiredItems[i]) continue;
      const { sourceSlot, gridSlot, itemId } = requiredItems[i];

      if (!slotGroups.has(sourceSlot)) {
        slotGroups.set(sourceSlot, []);
      }
      slotGroups.get(sourceSlot).push({ gridSlot, itemId });
    }

    let lastSourceSlot = null;
    let lastSourceItem = null;

    for (const [sourceSlot, gridSlots] of slotGroups) {
      const windowId = client.openWindowId || 0;
      const isCraftingTable =
        client.openWindowType === "minecraft:crafting_table";

      const inventoryToUse =
        isCraftingTable &&
        client._windowInventories &&
        client._windowInventories[windowId]
          ? client._windowInventories[windowId]
          : client.inventory;

      const sourceItem = inventoryToUse[sourceSlot];
      if (!sourceItem) continue;

      lastSourceSlot = sourceSlot;
      lastSourceItem = sourceItem;

      clicks.push({
        windowId: windowId,
        slot: sourceSlot,
        mouseButton: 0,
        action: client.windowClickAction++,
        mode: 0,
        item: sourceItem,
      });

      for (const { gridSlot, itemId } of gridSlots) {
        clicks.push({
          windowId: windowId,
          slot: gridSlot,
          mouseButton: 1,
          action: client.windowClickAction++,
          mode: 0,
          item: { blockId: -1, itemCount: 0, itemDamage: 0 },
        });
      }

      if (gridSlots.length < sourceItem.itemCount) {
        clicks.push({
          windowId: windowId,
          slot: sourceSlot,
          mouseButton: 0,
          action: client.windowClickAction++,
          mode: 0,
          item: { blockId: -1, itemCount: 0, itemDamage: 0 },
        });
      }
    }

    let cursorState = { blockId: -1, itemCount: 0 };

    const tempListener = (packet) => {
      if (packet.windowId === 0) {
        const slotName =
          packet.slot === 0
            ? "RESULT"
            : packet.slot >= 1 && packet.slot <= 9
              ? `GRID ${packet.slot}`
              : `INV ${packet.slot}`;
      }
      if (packet.windowId === -1 && packet.slot === -1) {
        const oldCursor = `${cursorState.blockId}:${cursorState.itemCount}`;
        cursorState = packet.item || { blockId: -1, itemCount: 0 };
        const newCursor = `${cursorState.blockId}:${cursorState.itemCount}`;
      }
    };
    client.javaClient.on("set_slot", tempListener);

    setTimeout(() => {
      client.javaClient.removeListener("set_slot", tempListener);
    }, 100);

    let delay = 0;
    clicks.forEach((click, index) => {
      setTimeout(() => {
        try {
          client.javaClient.write("window_click", click);
        } catch (err) {
          /* do nothing */
        }
      }, delay);
      delay += 1;
    });

    const usedGridSlots = requiredItems.filter((r) => r).map((r) => r.gridSlot);

    setTimeout(() => {
      this.checkCraftingResult(client, usedGridSlots);
    }, delay + 50);
  }

  checkCraftingResult(client, usedGridSlots) {
    const debugLog = true;
    if (debugLog) console.log("checking crafting result");
    const windowId = client.openWindowId || 0;

    const checkForResult = () => {
      const inventoryToCheck =
        windowId !== 0 &&
        client._windowInventories &&
        client._windowInventories[windowId]
          ? client._windowInventories[windowId]
          : client.inventory;

      if (debugLog) console.log("slot 0 content", inventoryToCheck[0]);

      if (!inventoryToCheck || !inventoryToCheck[0]) {
        if (debugLog) console.log("no result slot found");
        return null;
      }

      const resultItem = inventoryToCheck[0];
      const itemId = resultItem.blockId;

      if (itemId === -1 || itemId === null || itemId === undefined) {
        if (debugLog) console.log("no valid result item");
        return null;
      }

      if (debugLog) console.log("found result item:", itemId);
      return resultItem;
    };

    const resultItem = checkForResult();
    if (resultItem) {
      this.takeCraftedItemAndClear(client, usedGridSlots);
      return;
    }

    let handledResult = false;
    const resultListener = (packet) => {
      if (packet.windowId === windowId && packet.slot === 0) {
        if (packet.item && packet.item.blockId !== -1) {
          if (client.javaClient) {
            client.javaClient.removeListener("set_slot", resultListener);
          }

          if (!handledResult) {
            handledResult = true;
            if (debugLog)
              console.log("received set_slot for result, taking item");
            setTimeout(() => {
              this.takeCraftedItemAndClear(client, usedGridSlots);
            }, 50);
          }
        }
      }
    };

    if (client.javaClient) {
      client.javaClient.on("set_slot", resultListener);

      setTimeout(() => {
        if (client.javaClient) {
          client.javaClient.removeListener("set_slot", resultListener);
        }

        if (!handledResult) {
          const finalCheck = checkForResult();
          if (finalCheck) {
            handledResult = true;
            this.takeCraftedItemAndClear(client, usedGridSlots);
          } else {
            client._craftingInProgress = false;
          }
        }
      }, 150);
    }
  }

  takeCraftedItemAndClear(client, usedGridSlots) {
    const debugLog = true;
    if (debugLog) console.log("taking crafted item and clearing grid");
    if (!client.javaClient || !client.javaClient.write) {
      if (debugLog) console.log("no java client available");
      client._craftingInProgress = false;
      return;
    }

    if (!client.windowClickAction) {
      client.windowClickAction = 1;
    }

    const windowId = client.openWindowId || 0;
    const isCraftingTable = windowId !== 0;
    const inventoryToCheck =
      isCraftingTable &&
      client._windowInventories &&
      client._windowInventories[windowId]
        ? client._windowInventories[windowId]
        : client.inventory;

    const resultItem = inventoryToCheck[0];
    if (!resultItem || resultItem.blockId === -1) {
      return;
    }

    const resultItemId = resultItem.blockId;
    const resultCount = resultItem.itemCount || 1;

    const slotsWithSameItem = [];
    const slotRange = isCraftingTable ? [10, 46] : [9, 45];
    for (let slot = slotRange[0]; slot < slotRange[1]; slot++) {
      const item = inventoryToCheck[slot];
      if (item && item.blockId === resultItemId) {
        slotsWithSameItem.push({
          slot: slot,
          count: item.itemCount || 1,
          hasSpace: (item.itemCount || 1) < 64,
        });
      }
    }

    const targetSlots = [];
    let remainingCount = resultCount;

    for (const slotInfo of slotsWithSameItem) {
      if (slotInfo.hasSpace && remainingCount > 0) {
        const spaceAvailable = 64 - slotInfo.count;
        const amountToPlace = Math.min(spaceAvailable, remainingCount);
        targetSlots.push({ slot: slotInfo.slot, amount: amountToPlace });
        remainingCount -= amountToPlace;
      }
    }

    if (remainingCount > 0) {
      const hotbarSlots = isCraftingTable
        ? [37, 38, 39, 40, 41, 42, 43, 44, 45]
        : [36, 37, 38, 39, 40, 41, 42, 43, 44];
      for (const slot of hotbarSlots) {
        if (remainingCount <= 0) break;
        const item = inventoryToCheck[slot];
        if (!item || item.blockId === -1) {
          const amountToPlace = Math.min(64, remainingCount);
          targetSlots.push({ slot: slot, amount: amountToPlace });
          remainingCount -= amountToPlace;
        }
      }
    }

    if (remainingCount > 0) {
      const mainInvSlots = isCraftingTable
        ? [
            10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26,
            27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
          ]
        : [
            9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
            26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
          ];
      for (const slot of mainInvSlots) {
        if (remainingCount <= 0) break;
        const item = inventoryToCheck[slot];
        if (!item || item.blockId === -1) {
          const amountToPlace = Math.min(64, remainingCount);
          targetSlots.push({ slot: slot, amount: amountToPlace });
          remainingCount -= amountToPlace;
        }
      }
    }

    setTimeout(() => {
      try {
        client.javaClient.write("window_click", {
          windowId: windowId,
          slot: -999,
          mouseButton: 0,
          action: client.windowClickAction++,
          mode: 0,
          item: { blockId: -1, itemCount: 0, itemDamage: 0 },
        });
        if (debugLog) console.log("clicked slot -999");
      } catch (err) {}

      setTimeout(() => {
        try {
          client.javaClient.write("window_click", {
            windowId: windowId,
            slot: 0,
            mouseButton: 0,
            action: client.windowClickAction++,
            mode: 1,
            item: resultItem,
          });
          if (debugLog) console.log("shift clicked result");
        } catch (err) {
          /* do nothing */
        }
      }, 1);
    }, 1);

    setTimeout(() => {
      setTimeout(() => {
        let foundPlanks = false;
        for (let i = 9; i < 45; i++) {
          const item = client.inventory[i];
          if (item && item.blockId === 5) {
            foundPlanks = true;
          }
        }

        const inventoryToCheck =
          windowId !== 0 &&
          client._windowInventories &&
          client._windowInventories[windowId]
            ? client._windowInventories[windowId]
            : client.inventory;

        if (debugLog) console.log("clearing grid slots", usedGridSlots);
        usedGridSlots.forEach((gridSlot, index) => {
          setTimeout(() => {
            const gridItem = inventoryToCheck[gridSlot];
            if (gridItem && gridItem.blockId !== -1) {
              try {
                client.javaClient.write("window_click", {
                  windowId: windowId,
                  slot: gridSlot,
                  mouseButton: 0,
                  action: client.windowClickAction++,
                  mode: 1,
                  item: gridItem,
                });
                if (debugLog) console.log("shift clicked grid", gridSlot);
              } catch (err) {
                /* do nothing */
              }
            } else {
              if (debugLog) console.log("grid slot", gridSlot, "already empty");
            }
          }, index * 1);
        });
      }, 1);
    }, 1);

    setTimeout(() => {
      if (debugLog) console.log("craft complete clearing flag");
      client._craftingInProgress = false;
    }, 200);
  }

  placeCraftingItems(
    client,
    windowId,
    itemsToPlace,
    inventoryWindow,
    startAction,
  ) {
    /* do nothing - but keep this here so nothing breaks */
  }

  sendInventoryUpdate(client) {
    if (!client.inventory || !client.javaClient) {
      return;
    }

    for (let i = 0; i < 45; i++) {
      const item = client.inventory[i];
      const PacketWriter = require("./packetwriter");
      const slotWriter = new PacketWriter();
      slotWriter.writeByte(0);
      slotWriter.writeShort(i);
      this.writeItem(slotWriter, item);
      this.sendPacket(client, 0x67, slotWriter.toBuffer());
    }
  }

  //LCE automatically accepts a trade, whilst java requires items in specific slots
  //we should write a server plugin that handles this because lazy
  handleTradeItem(client, data) {
    /* do nothing */
  }

  handleContainerAck(client, data) {
    const reader = new PacketReader(data.slice(1));
    const windowId = reader.readByte();
    const action = reader.readShort();
    const accepted = reader.readBoolean();

    if (client.javaClient && client.javaClient.write) {
      try {
        client.javaClient.write("transaction", {
          windowId: windowId,
          action: action,
          accepted: accepted,
        });
      } catch (err) {
        /* do nothing */
      }
    }
  }

  handleContainerClick(client, data) {
    const reader = new PacketReader(data.slice(1));
    const containerId = reader.readByte();
    const slotNum = reader.readShort();
    const buttonNum = reader.readByte();
    const uid = reader.readShort();
    const clickType = reader.readByte();

    const item = this.readItemWithNBT(reader);

    if (client._bookGUI && containerId === client.openWindowId) {
      if (slotNum === 48 && client._bookGUI.currentPage > 0) {
        client._bookGUI.currentPage--;
        this.updateBookGUIContents(client, containerId);
        return;
      }

      if (
        slotNum === 50 &&
        client._bookGUI.currentPage < client._bookGUI.pages.length - 1
      ) {
        client._bookGUI.currentPage++;
        this.updateBookGUIContents(client, containerId);
        return;
      }

      if (
        client._bookGUI.clickActions &&
        client._bookGUI.clickActions[slotNum]
      ) {
        const action = client._bookGUI.clickActions[slotNum];

        if (action.type === "run_command" && action.value) {
          if (client.javaClient && client.javaClient.write) {
            try {
              client.javaClient.write("chat", { message: action.value });
            } catch (err) {
              /* do nothing */
            }
          }

          const PacketWriter = require("./packetwriter");
          const writer = new PacketWriter();
          writer.writeByte(containerId & 0xff);
          this.sendPacket(client, 0x65, writer.toBuffer());
          delete client._bookGUI;
        }
      }

      const PacketWriter = require("./packetwriter");
      const rejectWriter = new PacketWriter();
      rejectWriter.writeByte(containerId & 0xff);
      rejectWriter.writeShort(uid);
      rejectWriter.writeBoolean(false);
      this.sendPacket(client, 0x6a, rejectWriter.toBuffer());
      return;
    }

    //0=Normal click
    //1=Shift click
    //2=Number key (hotbar swap)
    //3=Middle click (creative)
    //4=Drop
    //5=Drag
    //6=Double click

    let javaItem = null;
    if (item) {
      const javaItemId = this.mapLCEItemToJava(item.blockId);
      if (javaItemId !== null) {
        javaItem = {
          blockId: javaItemId,
          itemCount: item.itemCount,
          itemDamage: item.itemDamage,
        };
        if (item.nbt) {
          javaItem.nbtData = this.convertLCENBTToJava(item.nbt);
        }
      }
    }

    if (client.javaClient && client.javaClient.write) {
      try {
        //luckily both LCE and java use slot -999 for dropping items outside inventory window
        let finalMode = clickType;
        let finalButton = buttonNum;

        const clickPacket = {
          windowId: containerId,
          slot: slotNum,
          mouseButton: finalButton,
          action: uid,
          mode: finalMode,
          item: javaItem || { blockId: -1 },
        };
        client.javaClient.write("window_click", clickPacket);
      } catch (err) {
        /* do nothing */
      }
    }
  }

  handleSignUpdate(client, data) {
    const reader = new PacketReader(data.slice(1));
    const x = reader.readInt();
    const y = reader.readShort();
    const z = reader.readInt();
    const verified = reader.readBoolean();
    const censored = reader.readBoolean();

    const text1 = reader.readUtf();
    const text2 = reader.readUtf();
    const text3 = reader.readUtf();
    const text4 = reader.readUtf();

    if (client.javaClient && client.javaClient.write) {
      try {
        client.javaClient.write("update_sign", {
          location: { x: x, y: y, z: z },
          text1: JSON.stringify({ text: text1 }),
          text2: JSON.stringify({ text: text2 }),
          text3: JSON.stringify({ text: text3 }),
          text4: JSON.stringify({ text: text4 }),
        });
      } catch (err) {
        /* do nothing */
      }
    }
  }

  handleSetCreativeModeSlot(client, data) {
    const reader = new PacketReader(data.slice(1));
    const slotNum = reader.readShort();
    const item = this.readItemWithNBT(reader);

    let javaItem = null;
    if (item) {
      const javaItemId = this.mapLCEItemToJava(item.blockId);
      if (javaItemId !== null) {
        javaItem = {
          blockId: javaItemId,
          itemCount: item.itemCount,
          itemDamage: item.itemDamage || 0,
        };
        if (item.nbt) {
          javaItem.nbtData = this.convertLCENBTToJava(item.nbt);
        }
      }
    }

    if (client.javaClient && client.javaClient.write) {
      try {
        client.javaClient.write("set_creative_slot", {
          slot: slotNum,
          item: javaItem || { blockId: -1 },
        });
      } catch (err) {
        /* do nothing */
      }
    }
  }

  handleClientCommand(client, data) {
    const reader = new PacketReader(data.slice(1));
    const action = reader.readByte();

    if (action === 1) {
      if (client.javaClient && client.javaClient.write) {
        try {
          client.javaClient.write("client_command", {
            payload: 0,
          });
        } catch (err) {
          /* do nothing */
        }
      }
    }
  }

  handleDisconnect(client, data) {
    const reader = new PacketReader(data.slice(1));
    const reason = reader.readInt();

    if (this.clientChests.has(client)) {
      const openChestKeys = this.clientChests.get(client);
      for (const posKey of openChestKeys) {
        const chestData = this.openChests.get(posKey);
        if (chestData) {
          chestData.clients.delete(client);

          if (chestData.clients.size === 0) {
            this.openChests.delete(posKey);
          }
        }
      }
      this.clientChests.delete(client);
    }

    this.removeClient(client);

    if (client.socket && !client.socket.destroyed) {
      client.socket.destroy();
    }
  }

  handlePlayerMovement(client, packetId, data) {
    const reader = new PacketReader(data.slice(1));
    const dataSize = data.length - 1;

    let x, y, yView, z, yRot, xRot, onGround;

    switch (packetId) {
      case 0x0b: //MovePlayerPacket (pos)
        if (dataSize < 33) {
          return;
        }
        x = reader.readDouble();
        y = reader.readDouble();
        yView = reader.readDouble();
        z = reader.readDouble();
        onGround = reader.readByte();

        client.playerX = x;
        client.playerY = y;
        client.playerZ = z;

        if (client.javaClient && client.javaClient.write) {
          try {
            client.javaClient.write("position_look", {
              x: x,
              y: y,
              z: z,
              yaw: client.lastYaw || 0,
              pitch: client.lastPitch || 0,
              onGround: onGround !== 0,
            });
          } catch (err) {
            /* do nothing */
          }
        }
        break;

      case 0x0c: //MovePlayerPacket (rot)
        if (dataSize < 9) {
          return;
        }
        yRot = reader.readFloat();
        xRot = reader.readFloat();
        onGround = reader.readByte();

        const normalizedYaw = normalizeYaw(yRot);

        client.playerYaw = normalizedYaw;
        client.playerPitch = xRot;

        client.lastYaw = normalizedYaw;
        client.lastPitch = xRot;

        if (client.javaClient && client.javaClient.write) {
          try {
            client.javaClient.write("look", {
              yaw: normalizedYaw,
              pitch: xRot,
              onGround: onGround !== 0,
            });
          } catch (err) {
            /* do nothing */
          }
        }
        break;
    }
  }

  readItem(reader) {
    return readItem(reader);
  }

  readItemWithNBT(reader) {
    const itemId = reader.readShort();
    if (itemId === -1) {
      return null;
    }
    const count = reader.readByte();
    const damage = reader.readShort();

    if (reader.offset + 2 > reader.buffer.length) {
      return {
        blockId: itemId,
        itemCount: count,
        itemDamage: damage,
        nbt: null,
      };
    }

    const nbtLength = reader.readShort();

    let nbt = null;
    if (nbtLength > 0 && reader.offset + nbtLength <= reader.buffer.length) {
      const nbtBytes = reader.readBytes(nbtLength);
      nbt = nbtBytes;
    }

    return {
      blockId: itemId,
      itemCount: count,
      itemDamage: damage,
      nbt: nbt,
    };
  }

  convertLCENBTToJava(nbtBytes) {
    try {
      const zlib = require("zlib");
      const decompressed = zlib.gunzipSync(nbtBytes);
      const nbtReader = new PacketReader(decompressed);
      const rootTag = this.readNBTTag(nbtReader);
      return rootTag;
    } catch (err) {
      return null;
    }
  }

  readNBTTag(reader) {
    const type = reader.readByte();
    if (type === 0) return null;
    const name = reader.readUTF();
    return this.readNBTPayload(reader, type, name);
  }

  readNBTPayload(reader, type, name) {
    switch (type) {
      case 1:
        return { type: "byte", name, value: reader.readByte() };
      case 2:
        return { type: "short", name, value: reader.readShort() };
      case 3:
        return { type: "int", name, value: reader.readInt() };
      case 8:
        return { type: "string", name, value: reader.readUTF() };
      case 9:
        const listType = reader.readByte();
        const listSize = reader.readInt();
        const listItems = [];
        for (let i = 0; i < listSize; i++) {
          listItems.push(this.readNBTPayload(reader, listType, ""));
        }
        return {
          type: "list",
          name,
          value: { type: listType, value: listItems },
        };
      case 10:
        const compound = {};
        while (true) {
          const tagType = reader.readByte();
          if (tagType === 0) break;
          const tagName = reader.readUTF();
          compound[tagName] = this.readNBTPayload(reader, tagType, tagName);
        }
        return { type: "compound", name, value: compound };
      default:
        return null;
    }
  }

  writeItemNBT(writer, item) {
    return writeItemNBT(writer, item);
  }

  writeItem(writer, item) {
    return writeItem(writer, item, this.mapJavaItemToLCE.bind(this));
  }

  sendPacket(client, packetId, payload) {
    if (!this.validLCEPackets.has(packetId)) {
      return;
    }

    if (!payload || !Buffer.isBuffer(payload)) {
      return;
    }

    if (client.socket.destroyed) {
      return;
    }

    try {
      const packetData = Buffer.concat([Buffer.from([packetId]), payload]);
      const lengthPrefix = Buffer.allocUnsafe(4);
      lengthPrefix.writeUInt32BE(packetData.length, 0);

      const fullPacket = Buffer.concat([lengthPrefix, packetData]);

      if (fullPacket.length > 1000000) {
        return;
      }

      if (!client._packetQueue) {
        client._packetQueue = [];
        client._sending = false;
      }

      client._packetQueue.push(fullPacket);

      if (!client._sending) {
        client._sending = true;
        setImmediate(() => {
          while (client._packetQueue.length > 0 && !client.socket.destroyed) {
            const pkt = client._packetQueue.shift();
            client.socket.write(pkt);
          }
          client._sending = false;
        });
      }
    } catch (err) {
      /* do nothing */
    }
  }

  disconnectClient(client, reason = 0) {
    const reasonMap = {
      0: "Generic disconnect",
      2: "Connection lost",
      10: "Kicked/Banned",
      20: "Timeout",
      23: "Server full",
    };
    const reasonText = reasonMap[reason] || `Unknown (${reason})`;
    console.log(`DISCONNECTED: ${reasonText}`);

    if (client.socket && !client.socket.destroyed) {
      try {
        const writer = new PacketWriter();
        writer.writeInt(reason);
        this.sendPacket(client, 0xff, writer.toBuffer());
        setTimeout(() => {
          this.removeClient(client);
        }, 100);
        return;
      } catch (err) {
        /* do nothing */
      }
    }
    this.removeClient(client);
  }

  removeClient(client) {
    if (client._removing) {
      return;
    }
    client._removing = true;

    if (this.clientChests.has(client)) {
      const openChestKeys = this.clientChests.get(client);
      for (const posKey of openChestKeys) {
        const chestData = this.openChests.get(posKey);
        if (chestData) {
          chestData.clients.delete(client);

          if (chestData.clients.size === 0) {
            this.openChests.delete(posKey);
          }
        }
      }
      this.clientChests.delete(client);
    }

    const index = this.clients.indexOf(client);
    if (index > -1) {
      this.clients.splice(index, 1);
    }

    if (client.smallId) {
      this.usedSmallIds.delete(client.smallId);
    }

    if (client.javaClient) {
      const oldJavaClient = client.javaClient;
      client.javaClient = null;

      oldJavaClient.removeAllListeners();
      oldJavaClient.on("error", () => {
        /* do nothing */
      });
      try {
        oldJavaClient.end();
      } catch (err) {
        /* do nothing */
      }
    }

    if (client.socket && !client.socket.destroyed) {
      try {
        client.socket.destroy();
      } catch (err) {
        /* do nothing */
      }
    }
  }

  async connectToJavaServer(client) {
    try {
      return await connectToJavaServerFunc(this, client);
    } catch (err) {
      console.log(`DISCONNECTED: ${err}`);
    }
  }

  stop() {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
    }

    if (this.udpSocket) {
      this.udpSocket.close();
    }

    if (this.tcpServers && this.tcpServers.length > 0) {
      this.tcpServers.forEach((server) => server.close());
    }

    this.clients.forEach((client) => {
      this.disconnectClient(client, 2);
    });
  }
}

module.exports = LCEProxy;
/* --------------------------------------------------------------- */
