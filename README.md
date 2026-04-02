# Legacy Cross Play

## Any questions or need help?
Join the server: https://discord.gg/cb9rs9yfDm

---

**This project allows Legacy Console Edition clients to join a vanilla 1.8 Java Edition server.**

![](https://raw.githubusercontent.com/DeveloperExotic/LegacyCrossPlay/refs/heads/main/.assets/lce1.png)
![](https://raw.githubusercontent.com/DeveloperExotic/LegacyCrossPlay/refs/heads/main/.assets/lce2.png)

---

## How to Install

**Client modifications or server plugins are not required.**

- Install Node.js  
  https://nodejs.org/en/download  
  (you may need to restart your computer)

- Run `install_dependencies.bat`  
  (only required once)

- Run `start.bat`  

The proxy will appear in the join tab on Legacy Console Edition.

---

## How to Use

Use `/lce` commands to manage your connection.

- `/lce connect <ip>`  
  Connect to a Java Edition server.

- `/lce disconnect`  
  Disconnect from the server.

- `/lce link`  
  Link your Java Edition account.

- `/lce unlink`  
  Unlink your account.

- `/lce uselink <true/false>`  
  Enable or disable the linked account when connecting.

---

## TODO

### Known Issues

- Crafting is buggy / not fully implemented  
- Villager trades cannot be accepted  
- Lighting has minor dimension related issues

---

## Chunks

- [x] Java -> LCE chunks  
  - [x] Blocks  
  - [x] Metadata  
  - [x] Lighting  
  - [x] Biomes  

---

## Inventory Sync

- [x] Held item  
- [x] Item dropping  
- [x] Creative items  
- [x] Inventory movement  

---

## Game State

- [x] Gamemode / XP / Health / Hunger  
- [x] Damage knockback and sounds  

---

## Respawn

- [x] Death animation  
- [x] Respawn handling  

---

## Environment

### Time

- [x] Time synchronization  
- [x] Daylight cycle fixes  

### Weather

- [x] Weather synchronization  

---

## Sound

- [x] Sound effects  

---

## Entities

### Base Entities

- [x] Java edition players  
- [x] Items  
- [x] Mobs  

---

### Mob Features

- [x] Ageable entities  
- [x] Metadata (size, type)  
- [x] Nametags  
- [x] Mob inventory  
- [x] Animations  

---

### Entity Attachments

- [x] Riding (boats, minecarts, etc.)  

---

### Damage Translation

- [x] LCE -> Java  
  - [x] Entities  
  - [x] Players  

- [x] Java -> LCE  
  - [x] Mobs  
  - [x] Players  
  - [x] Knockback  
  - [x] Hurt sounds  

---

### Combat

- [x] Critical hits (normal and magical)  

---

### Misc Entities

- [x] Minecart fixes  
- [x] Arrows  
  - [x] Collision and behavior fixes  
- [x] Falling blocks (sand, gravel, anvils)  
- [x] Fireballs  
- [x] Custom Java skins  

---

## Server

### Chat

- [x] Receive and send chat  
- [x] Color handling  
- [x] Command support (/say, /tellraw)  
- [x] Translation support  

---

### Disconnections

- [x] LCE client disconnect handling  
- [x] Java player disconnect handling  

---

## Player Animations

### LCE -> Java

- [x] Crouch  
- [x] Sprint  
- [x] Attack  
- [x] Riding  
- [x] Blocking  

---

### Java -> LCE

- [x] Crouch  
- [x] Sprint  
- [x] Attack  
  - [x] Player  
  - [x] Entity  
- [x] Eating  
- [x] Sleeping  

---

## Block Updates

### Java -> LCE

- [x] Creative  
- [x] Survival  
- [x] Explosions  

---

### LCE -> Java

- [x] Creative  
- [x] Survival  

---

## World

- [x] Particles  
- [x] Nether and End support  

---

## UI

- [x] Crafting  
- [x] Brewing stand  
- [x] Furnace  
- [x] Villager trading  
  - [ ] Accepting trades
- [x] Anvils  
- [x] Chests  