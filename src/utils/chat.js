/* --------------------------------------------------------------- */
/*                            chat.js                              */
/* --------------------------------------------------------------- */
function getTranslation(key, args = []) {
  const translations = {
    "chat.type.text": (args) => `<${args[0]}> ${args[1]}`,
    "chat.type.announcement": (args) => `[${args[0]}] ${args[1]}`,
    "chat.type.admin": (args) => `[${args[0]}] ${args[1]}`,
    "chat.type.emote": (args) => `* ${args[0]} ${args[1]}`,

    "multiplayer.player.joined": (args) => `${args[0]} joined the game`,
    "multiplayer.player.left": (args) => `${args[0]} left the game`,

    "death.attack.mob": (args) => `${args[0]} was slain by ${args[1]}`,
    "death.attack.player": (args) => `${args[0]} was slain by ${args[1]}`,
    "death.attack.player.item": (args) =>
      `${args[0]} was slain by ${args[1]} using ${args[2]}`,
    "death.attack.arrow": (args) => `${args[0]} was shot by ${args[1]}`,
    "death.attack.arrow.item": (args) =>
      `${args[0]} was shot by ${args[1]} using ${args[2]}`,
    "death.attack.fireball": (args) =>
      `${args[0]} was fireballed by ${args[1]}`,
    "death.attack.fireball.item": (args) =>
      `${args[0]} was fireballed by ${args[1]} using ${args[2]}`,
    "death.attack.thrown": (args) => `${args[0]} was pummeled by ${args[1]}`,
    "death.attack.thrown.item": (args) =>
      `${args[0]} was pummeled by ${args[1]} using ${args[2]}`,
    "death.attack.indirectMagic": (args) =>
      `${args[0]} was killed by ${args[1]} using magic`,
    "death.attack.indirectMagic.item": (args) =>
      `${args[0]} was killed by ${args[1]} using ${args[2]}`,
    "death.attack.thorns": (args) =>
      `${args[0]} was killed trying to hurt ${args[1]}`,
    "death.attack.fall": (args) => `${args[0]} hit the ground too hard`,
    "death.attack.outOfWorld": (args) => `${args[0]} fell out of the world`,
    "death.fell.accident.ladder": (args) => `${args[0]} fell off a ladder`,
    "death.fell.accident.vines": (args) => `${args[0]} fell off some vines`,
    "death.fell.accident.water": (args) => `${args[0]} fell out of the water`,
    "death.fell.accident.generic": (args) =>
      `${args[0]} fell from a high place`,
    "death.fell.killer": (args) => `${args[0]} was doomed to fall`,
    "death.fell.assist": (args) =>
      `${args[0]} was doomed to fall by ${args[1]}`,
    "death.fell.assist.item": (args) =>
      `${args[0]} was doomed to fall by ${args[1]} using ${args[2]}`,
    "death.fell.finish": (args) =>
      `${args[0]} fell too far and was finished by ${args[1]}`,
    "death.fell.finish.item": (args) =>
      `${args[0]} fell too far and was finished by ${args[1]} using ${args[2]}`,
    "death.attack.lightningBolt": (args) =>
      `${args[0]} was struck by lightning`,
    "death.attack.inFire": (args) => `${args[0]} went up in flames`,
    "death.attack.inFire.player": (args) =>
      `${args[0]} walked into fire whilst fighting ${args[1]}`,
    "death.attack.onFire": (args) => `${args[0]} burned to death`,
    "death.attack.onFire.player": (args) =>
      `${args[0]} was burnt to a crisp whilst fighting ${args[1]}`,
    "death.attack.lava": (args) => `${args[0]} tried to swim in lava`,
    "death.attack.lava.player": (args) =>
      `${args[0]} tried to swim in lava to escape ${args[1]}`,
    "death.attack.inWall": (args) => `${args[0]} suffocated in a wall`,
    "death.attack.drown": (args) => `${args[0]} drowned`,
    "death.attack.drown.player": (args) =>
      `${args[0]} drowned whilst trying to escape ${args[1]}`,
    "death.attack.starve": (args) => `${args[0]} starved to death`,
    "death.attack.cactus": (args) => `${args[0]} was pricked to death`,
    "death.attack.cactus.player": (args) =>
      `${args[0]} walked into a cactus whilst trying to escape ${args[1]}`,
    "death.attack.generic": (args) => `${args[0]} died`,
    "death.attack.explosion": (args) => `${args[0]} blew up`,
    "death.attack.explosion.player": (args) =>
      `${args[0]} was blown up by ${args[1]}`,
    "death.attack.magic": (args) => `${args[0]} was killed by magic`,
    "death.attack.wither": (args) => `${args[0]} withered away`,
    "death.attack.anvil": (args) =>
      `${args[0]} was squashed by a falling anvil`,
    "death.attack.fallingBlock": (args) =>
      `${args[0]} was squashed by a falling block`,

    "commands.gamemode.success.self": (args) =>
      `Set own game mode to ${args[0]}`,
    "commands.gamemode.success.other": (args) =>
      `Set ${args[0]}'s game mode to ${args[1]}`,
    "gameMode.survival": () => "Survival Mode",
    "gameMode.creative": () => "Creative Mode",
    "gameMode.adventure": () => "Adventure Mode",
    "gameMode.spectator": () => "Spectator Mode",
    "gameMode.changed": () => "Your game mode has been updated",

    "commands.time.set": (args) =>
      args[0] ? `Set time to ${args[0]}` : "Set the time",
    "commands.time.added": (args) =>
      args[0] ? `Added ${args[0]} to the time` : "Added to the time",
    "commands.time.query": (args) =>
      args[0] ? `The time is ${args[0]}` : "Queried the time",

    "commands.weather.clear": () => "Changed weather to clear",
    "commands.weather.rain": () => "Changed weather to rain",
    "commands.weather.thunder": () => "Changed weather to thunder",

    "commands.tp.success": (args) => `Teleported ${args[0]} to ${args[1]}`,
    "commands.tp.success.coordinates": (args) =>
      `Teleported ${args[0]} to ${args[1]}, ${args[2]}, ${args[3]}`,

    "commands.give.success": (args) => `Gave ${args[0]} ${args[1]} ${args[2]}`,

    "commands.clear.success": (args) =>
      `Cleared inventory of ${args[0]}, removing ${args[1]} items`,

    "commands.kill.successful": (args) => `Killed ${args[0]}`,

    "commands.xp.success": (args) => `Gave ${args[0]} experience to ${args[1]}`,
    "commands.xp.success.levels": (args) =>
      `Gave ${args[0]} levels to ${args[1]}`,

    "commands.effect.success": (args) =>
      `Given ${args[0]} to ${args[1]} for ${args[2]} seconds`,
    "commands.effect.success.removed": (args) =>
      `Took ${args[0]} from ${args[1]}`,
    "commands.effect.success.removed.all": (args) =>
      `Took all effects from ${args[0]}`,

    "commands.difficulty.success": (args) => `Set difficulty to ${args[0]}`,

    "options.difficulty.peaceful": () => "Peaceful",
    "options.difficulty.easy": () => "Easy",
    "options.difficulty.normal": () => "Normal",
    "options.difficulty.hard": () => "Hard",

    "commands.seed.success": (args) => `Seed: ${args[0]}`,

    "commands.setworldspawn.success": (args) =>
      `Set world spawn to ${args[0]}, ${args[1]}, ${args[2]}`,

    "commands.spawnpoint.success": (args) =>
      `Set ${args[0]}'s spawn point to ${args[1]}, ${args[2]}, ${args[3]}`,

    "commands.gamerule.success": () => "Game rule has been updated",

    "commands.op.success": (args) => `Made ${args[0]} a server operator`,
    "commands.deop.success": (args) =>
      `Made ${args[0]} no longer a server operator`,

    "commands.ban.success": (args) => `Banned ${args[0]}`,
    "commands.unban.success": (args) => `Unbanned ${args[0]}`,
    "commands.banip.success": (args) => `Banned IP ${args[0]}`,

    "commands.kick.success": (args) => `Kicked ${args[0]} from the game`,

    "commands.say.usage": () => "Usage: /say <message>",

    "commands.message.display.incoming": (args) =>
      `${args[0]} whispers to you: ${args[1]}`,
    "commands.message.display.outgoing": (args) =>
      `You whisper to ${args[0]}: ${args[1]}`,

    "achievement.get": () => "Achievement get!",
    "achievement.taken": () => "Taken!",
    "achievement.unknown": () => "???",
    "achievement.requires": (args) => `Requires '${args[0]}'`,
    "achievement.openInventory": () => "Taking Inventory",
    "achievement.openInventory.desc": (args) =>
      `Press '${args[0]}' to open your inventory.`,
    "achievement.mineWood": () => "Getting Wood",
    "achievement.mineWood.desc": () =>
      "Attack a tree until a block of wood pops out",
    "achievement.buildWorkBench": () => "Benchmarking",
    "achievement.buildWorkBench.desc": () =>
      "Craft a workbench with four blocks of planks",
    "achievement.buildPickaxe": () => "Time to Mine!",
    "achievement.buildPickaxe.desc": () =>
      "Use planks and sticks to make a pickaxe",
    "achievement.buildFurnace": () => "Hot Topic",
    "achievement.buildFurnace.desc": () =>
      "Construct a furnace out of eight stone blocks",
    "achievement.acquireIron": () => "Acquire Hardware",
    "achievement.acquireIron.desc": () => "Smelt an iron ingot",
    "achievement.buildHoe": () => "Time to Farm!",
    "achievement.buildHoe.desc": () => "Use planks and sticks to make a hoe",
    "achievement.makeBread": () => "Bake Bread",
    "achievement.makeBread.desc": () => "Turn wheat into bread",
    "achievement.bakeCake": () => "The Lie",
    "achievement.bakeCake.desc": () => "Wheat, sugar, milk and eggs!",
    "achievement.buildBetterPickaxe": () => "Getting an Upgrade",
    "achievement.buildBetterPickaxe.desc": () => "Construct a better pickaxe",
    "achievement.overpowered": () => "Overpowered",
    "achievement.overpowered.desc": () => "Build a Notch apple",
    "achievement.cookFish": () => "Delicious Fish",
    "achievement.cookFish.desc": () => "Catch and cook fish!",
    "achievement.onARail": () => "On A Rail",
    "achievement.onARail.desc": () =>
      "Travel by minecart at least 1 km from where you started",
    "achievement.buildSword": () => "Time to Strike!",
    "achievement.buildSword.desc": () =>
      "Use planks and sticks to make a sword",
    "achievement.killEnemy": () => "Monster Hunter",
    "achievement.killEnemy.desc": () => "Attack and destroy a monster",
    "achievement.killCow": () => "Cow Tipper",
    "achievement.killCow.desc": () => "Harvest some leather",
    "achievement.breedCow": () => "Repopulation",
    "achievement.breedCow.desc": () => "Breed two cows with wheat",
    "achievement.flyPig": () => "When Pigs Fly",
    "achievement.flyPig.desc": () => "Fly a pig off a cliff",
    "achievement.snipeSkeleton": () => "Sniper Duel",
    "achievement.snipeSkeleton.desc": () =>
      "Kill a skeleton with an arrow from more than 50 meters",
    "achievement.diamonds": () => "DIAMONDS!",
    "achievement.diamonds.desc": () => "Acquire diamonds with your iron tools",
    "achievement.diamondsToYou": () => "Diamonds to you!",
    "achievement.diamondsToYou.desc": () => "Throw diamonds at another player.",
    "achievement.portal": () => "We Need to Go Deeper",
    "achievement.portal.desc": () => "Build a portal to the Nether",
    "achievement.ghast": () => "Return to Sender",
    "achievement.ghast.desc": () => "Destroy a Ghast with a fireball",
    "achievement.blazeRod": () => "Into Fire",
    "achievement.blazeRod.desc": () => "Relieve a Blaze of its rod",
    "achievement.potion": () => "Local Brewery",
    "achievement.potion.desc": () => "Brew a potion",
    "achievement.theEnd": () => "The End?",
    "achievement.theEnd.desc": () => "Locate the End",
    "achievement.theEnd2": () => "The End.",
    "achievement.theEnd2.desc": () => "Defeat the Ender Dragon",
    "achievement.spawnWither": () => "The Beginning?",
    "achievement.spawnWither.desc": () => "Spawn the Wither",
    "achievement.killWither": () => "The Beginning.",
    "achievement.killWither.desc": () => "Kill the Wither",
    "achievement.fullBeacon": () => "Beaconator",
    "achievement.fullBeacon.desc": () => "Create a full beacon",
    "achievement.exploreAllBiomes": () => "Adventuring Time",
    "achievement.exploreAllBiomes.desc": () => "Discover all biomes",
    "achievement.enchantments": () => "Enchanter",
    "achievement.enchantments.desc": () =>
      "Use a book, obsidian and diamonds to construct an enchantment table",
    "achievement.overkill": () => "Overkill",
    "achievement.overkill.desc": () =>
      "Deal nine hearts of damage in a single hit",
    "achievement.bookcase": () => "Librarian",
    "achievement.bookcase.desc": () =>
      "Build some bookshelves to improve your enchantment table",

    "commands.whitelist.add.success": (args) =>
      `Added ${args[0]} to the whitelist`,
    "commands.whitelist.remove.success": (args) =>
      `Removed ${args[0]} from the whitelist`,
    "commands.whitelist.enabled": () => "Whitelist is now turned on",
    "commands.whitelist.disabled": () => "Whitelist is now turned off",

    "commands.stop.start": () => "Stopping the server",

    "commands.save.enabled": () => "Turned on world auto-saving",
    "commands.save.disabled": () => "Turned off world auto-saving",
    "commands.save.success": () => "Saved the world",

    "commands.defaultgamemode.success": (args) =>
      `Default game mode is now ${args[0]}`,

    "commands.setblock.success": () => "Block placed",

    "commands.fill.success": (args) => `Successfully filled ${args[0]} blocks`,

    "commands.summon.success": () => "Object successfully summoned",
    "commands.summon.failed": () => "Unable to summon object",
    "commands.summon.outOfWorld": () =>
      "Cannot summon the object out of the world",

    "commands.me.usage": () => "/me <action>",

    "commands.help.header": (args) =>
      `--- Showing help page ${args[0]} of ${args[1]} (/help <page>) ---`,
    "commands.help.footer": () =>
      "Tip: Use the <tab> key while typing a command to auto-complete the command or its arguments",

    "commands.players.list": (args) =>
      `There are ${args[0]}/${args[1]} players online:`,

    "commands.publish.started": (args) =>
      `Local game hosted on port ${args[0]}`,
    "commands.publish.failed": () => "Unable to host local game",

    "commands.debug.start": () => "Started debug profiling",
    "commands.debug.stop": (args) =>
      `Stopped debug profiling after ${args[0]} seconds (${args[1]} ticks)`,

    "commands.tellraw.jsonException": (args) => `Invalid json: ${args[0]}`,

    "commands.message.sameTarget": () =>
      "You can't send a private message to yourself!",

    "commands.playsound.success": (args) =>
      `Played sound '${args[0]}' to ${args[1]}`,

    "commands.particle.success": (args) => `Playing effect ${args[0]}`,
    "commands.particle.notFound": (args) => `Unknown effect name (${args[0]})`,

    "commands.generic.exception": () =>
      "An unknown error occurred while attempting to perform this command",
    "commands.generic.permission": () =>
      "You do not have permission to use this command",
    "commands.generic.syntax": () => "Invalid command syntax",
    "commands.generic.player.notFound": () => "That player cannot be found",
    "commands.generic.entity.notFound": () => "That entity cannot be found",
    "commands.generic.notFound": () =>
      "Unknown command. Try /help for a list of commands",
    "commands.generic.num.invalid": (args) =>
      `'${args[0]}' is not a valid number`,
    "commands.generic.num.tooSmall": (args) =>
      `The number you have entered (${args[0]}) is too small, it must be at least ${args[1]}`,
    "commands.generic.num.tooBig": (args) =>
      `The number you have entered (${args[0]}) is too big, it must be at most ${args[1]}`,
    "commands.generic.usage": (args) => `Usage: ${args[0]}`,

    "commands.achievement.unknownAchievement": (args) =>
      `Unknown achievement or statistic '${args[0]}'`,
    "commands.achievement.alreadyHave": (args) =>
      `Player ${args[0]} already has achievement ${args[1]}`,
    "commands.achievement.give.success.one": (args) =>
      `Successfully given ${args[0]} the stat ${args[1]}`,
    "commands.achievement.give.success.all": (args) =>
      `Successfully given all achievements to ${args[0]}`,

    "commands.testfor.success": (args) => `Found ${args[0]}`,
    "commands.testfor.failure": (args) =>
      `${args[0]} did not match the required data structure`,

    "commands.scoreboard.objectives.add.success": (args) =>
      `Added new objective '${args[0]}' successfully`,
    "commands.scoreboard.objectives.remove.success": (args) =>
      `Removed objective '${args[0]}' successfully`,
    "commands.scoreboard.objectives.setdisplay.successSet": (args) =>
      `Set the display objective in slot '${args[0]}' to '${args[1]}'`,
    "commands.scoreboard.players.set.success": (args) =>
      `Set score of ${args[1]} for player ${args[0]} to ${args[2]}`,
    "commands.scoreboard.players.add.success": (args) =>
      `Added ${args[2]} to ${args[1]} for ${args[0]} (now ${args[3]})`,
    "commands.scoreboard.players.reset.success": (args) =>
      `Reset scores of player ${args[0]}`,
    "commands.scoreboard.teams.add.success": (args) =>
      `Added new team '${args[0]}' successfully`,
    "commands.scoreboard.teams.remove.success": (args) =>
      `Removed team ${args[0]}`,
    "commands.scoreboard.teams.join.success": (args) =>
      `Added ${args[0]} player(s) to team ${args[1]}: ${args[2]}`,

    "commands.execute.failed": (args) =>
      `Failed to execute '${args[0]}' as ${args[1]}`,

    "commands.testforblock.success": (args) =>
      `Successfully found the block at ${args[0]},${args[1]},${args[2]}.`,
    "commands.testforblock.failed.tile": (args) =>
      `The block at ${args[0]},${args[1]},${args[2]} is ${args[3]} (expected: ${args[4]}).`,

    "commands.setblock.success": () => "Block placed",
    "commands.setblock.failed": () => "Unable to place block",

    "commands.fill.success": (args) => `Successfully filled ${args[0]} blocks`,
    "commands.fill.failed": () => "No blocks filled",

    "commands.clone.success": (args) => `Successfully cloned ${args[0]} blocks`,
    "commands.clone.failed": () => "No blocks cloned",

    "commands.blockdata.success": (args) => `Block data updated to: ${args[0]}`,

    "commands.entitydata.success": (args) =>
      `Entity data updated to: ${args[0]}`,

    "commands.enchant.success": () => "Enchanting succeeded",
    "commands.enchant.notFound": (args) =>
      `There is no such enchantment with ID ${args[0]}`,

    "commands.replaceitem.success": (args) =>
      `Replaced slot ${args[0]} with ${args[1]} * ${args[2]}`,
    "commands.replaceitem.failed": (args) =>
      `Could not replace slot ${args[0]} with ${args[1]} * ${args[2]}`,

    "commands.stats.success": (args) =>
      `Storing ${args[0]} stats in ${args[1]} on ${args[2]}`,

    "commands.trigger.success": (args) =>
      `Trigger ${args[0]} changed with ${args[1]} ${args[2]}`,

    "commands.spreadplayers.success.teams": (args) =>
      `Successfully spread ${args[0]} teams around ${args[1]},${args[2]}`,
    "commands.spreadplayers.success.players": (args) =>
      `Successfully spread ${args[0]} players around ${args[1]},${args[2]}`,

    "commands.worldborder.set.success": (args) =>
      `Set world border to ${args[0]} blocks wide (from ${args[1]} blocks)`,
    "commands.worldborder.center.success": (args) =>
      `Set world border center to ${args[0]},${args[1]}`,

    "commands.title.success": () => "Title command successfully executed",

    "entity.Item.name": () => "Item",
    "entity.XPOrb.name": () => "Experience Orb",
    "entity.SmallFireball.name": () => "Small Fireball",
    "entity.Fireball.name": () => "Fireball",
    "entity.Arrow.name": () => "Arrow",
    "entity.Snowball.name": () => "Snowball",
    "entity.Painting.name": () => "Painting",
    "entity.ArmorStand.name": () => "Armor Stand",
    "entity.Mob.name": () => "Mob",
    "entity.Monster.name": () => "Monster",
    "entity.Creeper.name": () => "Creeper",
    "entity.Skeleton.name": () => "Skeleton",
    "entity.Spider.name": () => "Spider",
    "entity.Giant.name": () => "Giant",
    "entity.Zombie.name": () => "Zombie",
    "entity.Slime.name": () => "Slime",
    "entity.Ghast.name": () => "Ghast",
    "entity.PigZombie.name": () => "Zombie Pigman",
    "entity.Enderman.name": () => "Enderman",
    "entity.Endermite.name": () => "Endermite",
    "entity.Silverfish.name": () => "Silverfish",
    "entity.CaveSpider.name": () => "Cave Spider",
    "entity.Blaze.name": () => "Blaze",
    "entity.LavaSlime.name": () => "Magma Cube",
    "entity.MushroomCow.name": () => "Mooshroom",
    "entity.Villager.name": () => "Villager",
    "entity.VillagerGolem.name": () => "Iron Golem",
    "entity.SnowMan.name": () => "Snow Golem",
    "entity.EnderDragon.name": () => "Ender Dragon",
    "entity.WitherBoss.name": () => "Wither",
    "entity.Witch.name": () => "Witch",
    "entity.Guardian.name": () => "Guardian",
    "entity.Pig.name": () => "Pig",
    "entity.Sheep.name": () => "Sheep",
    "entity.Cow.name": () => "Cow",
    "entity.Chicken.name": () => "Chicken",
    "entity.Squid.name": () => "Squid",
    "entity.Wolf.name": () => "Wolf",
    "entity.Ozelot.name": () => "Ocelot",
    "entity.Cat.name": () => "Cat",
    "entity.Bat.name": () => "Bat",
    "entity.EntityHorse.name": () => "Horse",
    "entity.horse.name": () => "Horse",
    "entity.donkey.name": () => "Donkey",
    "entity.mule.name": () => "Mule",
    "entity.skeletonhorse.name": () => "Skeleton Horse",
    "entity.zombiehorse.name": () => "Zombie Horse",
    "entity.Rabbit.name": () => "Rabbit",
    "entity.KillerBunny.name": () => "The Killer Bunny",
    "entity.PrimedTnt.name": () => "Block of TNT",
    "entity.FallingSand.name": () => "Falling Block",
    "entity.Minecart.name": () => "Minecart",
    "entity.Boat.name": () => "Boat",
    "entity.generic.name": () => "unknown",

    "entity.Villager.farmer": () => "Farmer",
    "entity.Villager.fisherman": () => "Fisherman",
    "entity.Villager.shepherd": () => "Shepherd",
    "entity.Villager.fletcher": () => "Fletcher",
    "entity.Villager.librarian": () => "Librarian",
    "entity.Villager.cleric": () => "Cleric",
    "entity.Villager.armor": () => "Armorer",
    "entity.Villager.weapon": () => "Weapon Smith",
    "entity.Villager.tool": () => "Tool Smith",
    "entity.Villager.butcher": () => "Butcher",
    "entity.Villager.leather": () => "Leatherworker",
  };

  const translationFunc = translations[key];
  if (translationFunc) {
    return translationFunc(args);
  }

  if (args.length > 0) {
    return `${key}: ${args.join(" ")}`;
  }
  return key;
}

function parseChatComponent(component) {
  if (!component) return "";

  if (typeof component === "string") {
    try {
      component = JSON.parse(component);
    } catch (err) {
      try {
        const relaxedJson = component.replace(
          /([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,
          '$1"$2":',
        );
        component = JSON.parse(relaxedJson);
      } catch (err2) {
        return component.replace(/^"|"$/g, "");
      }
    }
  }

  let result = "";

  if (component.translate) {
    const args = component.with
      ? component.with.map((w) => {
          if (typeof w === "string" || typeof w === "number") {
            return String(w);
          }
          return parseChatComponent(w);
        })
      : [];

    const translated = getTranslation(component.translate, args);
    return translated;
  }

  if (component.text !== undefined && component.text !== null) {
    result += String(component.text);
  }

  if (component.score) {
    result += String(component.score.value || "");
  }

  if (component.selector) {
    result += component.selector;
  }

  if (component.extra && Array.isArray(component.extra)) {
    result += component.extra.map((e) => parseChatComponent(e)).join("");
  }

  return result;
}

module.exports = { getTranslation, parseChatComponent };
/* --------------------------------------------------------------- */
