/* --------------------------------------------------------------- */
/*                         entitymapping.js                        */
/* --------------------------------------------------------------- */
/**
 * @returns {Record<string, number>}
 */
function createEntityTypeMapping() {
  return {
    //monsters
    Creeper: 50,
    Skeleton: 51,
    Spider: 52,
    Giant: 53,
    Zombie: 54,
    Slime: 55,
    Ghast: 56,
    PigZombie: 57,
    Enderman: 58,
    CaveSpider: 59,
    Silverfish: 60,
    Blaze: 61,
    LavaSlime: 62,
    EnderDragon: 63,
    WitherBoss: 64,
    Bat: 65,
    Witch: 66,

    //animals
    Pig: 90,
    Sheep: 91,
    Cow: 92,
    Chicken: 93,
    Squid: 94,
    Wolf: 95,
    MushroomCow: 96,
    SnowMan: 97,
    Ozelot: 98,
    VillagerGolem: 99,
    EntityHorse: 100,

    //npcs
    Villager: 120,

    //projectile & entities
    Item: 1,
    XPOrb: 2,
    Painting: 9,
    Arrow: 10,
    Snowball: 11,
    Fireball: 12,
    SmallFireball: 13,
    ThrownEnderpearl: 14,
    EyeOfEnderSignal: 15,
    ThrownPotion: 16,
    ThrownExpBottle: 17,
    ItemFrame: 18,
    WitherSkull: 19,
    PrimedTnt: 20,
    FallingSand: 21,
    FireworksRocketEntity: 22,

    //transport
    Boat: 41,
    MinecartRideable: 42,
    MinecartChest: 43,
    MinecartFurnace: 44,
    MinecartTNT: 45,
    MinecartHopper: 46,
    MinecartSpawner: 47,
  };
}

module.exports = { createEntityTypeMapping };
/* --------------------------------------------------------------- */
