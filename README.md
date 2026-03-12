# Legacy Cross Play
## Any questions, need help? [Join the server!](https://discord.gg/cb9rs9yfDm)
## CURRENTLY, THE ORIGINAL LEGACY CLIENT IS BROKEN, USE [THIS ONE](https://github.com/DeveloperExotic/LegacyCrossPlay/releases)

**This project allows Legacy Console Edition clients to join a vanilla 1.8 Java Edition server!**
![](https://raw.githubusercontent.com/DeveloperExotic/LegacyCrossPlay/refs/heads/main/.assets/lce1.png)
![](https://raw.githubusercontent.com/DeveloperExotic/LegacyCrossPlay/refs/heads/main/.assets/lce2.png)

# How to Install

**Code modifications, or server plugins ARE NOT required!**

- Install [NodeJS](https://nodejs.org/en/download), you may need to restart your computer after
- Start a localhost Java Edition server running on port 25564, and in offline mode (you can edit these in `server.properties`)
- Run the file `install_dependencies.bat`, - you only need to run this file one time.
- Run `start.bat`, the Java Edition server will appear in the join tab on Legacy Console Edition! You can configure the server IP / PORT in `constants.js`.

# Known issues, will be fixed

- Chunk lighting is always based on sky light (no lighting data)
- You're unable to accept villager trades

---

# TODO

## Chunks

- [x] Java → LCE chunks
  - [x] Blocks
  - [x] Metadata
  - [x] Lighting
  - [x] Biomes

## Inventory Syncing

- [x] Held item
- [x] Item dropping
- [x] Creative items
- [x] Creative clear
- [x] Moved items

## Sync Gamemode / XP / Health / Hunger

- [x] Damage knockback / sound

## Respawn

- [x] Death animation
- [x] Respawn handling

## Environment

### Time

- [x] Sync Time
- [x] DoDaylightCycle fix

### Weather

- [x] Sync Weather

## Sound

- [x] Sound effects

---

# Entities

## Base Entities

- [x] Java edition players
- [x] Items
- [x] Mobs

### Mob Features

- [x] Ageable entities
- [x] Entity metadata (e.g. size, type)
- [x] Nametags
- [x] Mob inventory
- [x] Animations (e.g. bats)

## Entity Attachments

- [x] Attach to entities (e.g. riding pig, minecart, boat)

### Damage Translation

#### LCE Damage → Java Entity

- [x] Entity
- [x] Player

#### Java Damage → LCE Entity

- [x] Mobs
- [x] Players
- [x] Hurt sound
- [x] Entity velocity knockback

### Critical Hits

- [x] Normal critical
- [x] Magical critical

### Other Entity Systems

- [x] Fix minecart metadata (e.g. tnt minecart)
- [x] Arrows
  - [x] Fix arrow bug when colliding with player / low bow pull
- [x] Falling block entities (e.g. sand, gravel, anvil)
- [x] Fireball
- [x] Custom Java Edition skins

---

# Server

## Chat

- [x] Receive server chat
  - [x] Finter server colors
- [x] Send server chat
- [x] Fix chat commands (e.g. /say, /tellraw)
- [x] Java edition english chat translations

## Disconnections

- [x] Our LCE client disconnects
- [x] Our java player disconnects

---

# Player Animations

## LCE → Java

- [x] Crouch
- [x] Sprint
- [x] Attack (swing)
- [x] Riding
- [x] Sword blocking

## Java → LCE

- [x] Crouch
- [x] Sprint
- [x] Attack
  - [x] Entity
  - [x] Player
- [x] Eating
- [x] Sleeping

---

# Block Updates

## Java → LCE

- [x] Creative
- [x] Survival
- [x] Explosions

## LCE → Java

- [x] Creative
- [x] Survival

---

# World

- [x] Particles
- [x] Nether and End dimensions

---

# UI

- [x] Crafting
- [x] Brewing stand
- [x] Furnace
- [x] Villager trading
  - [ ] Accept trade _(Hard to implement, coming soon)_
- [x] Anvils
- [x] Chests
