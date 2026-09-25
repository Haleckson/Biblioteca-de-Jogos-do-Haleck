/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BlizzardGearItem,
  BlizzardReputation,
  BlizzardProfileData,
  BlizzardCharacterInventory,
  BlizzardCharacterCollections,
  BlizzardBagContainer,
  BlizzardInventoryItem,
  BlizzardCollectionMount,
  BlizzardCollectionToy,
  BlizzardCollectionPet,
  BlizzardCollectionTitle,
} from "../types";
import { getWoWClassInfo, getWoWRaceInfo, getWoWFactionForRace } from "./blizzardIcons";
import {
  OFFICIAL_MOUNTS_CATALOG,
  OFFICIAL_PETS_CATALOG,
  OFFICIAL_TOYS_CATALOG,
  OFFICIAL_TITLES_CATALOG,
} from "./blizzardCollectionsCatalog";

export interface GenerateProfileOptions {
  name: string;
  realm: string;
  realmSlug?: string;
  characterClass?: string;
  race?: string;
  level?: number;
  gender?: string;
  faction?: string;
  activeSpec?: string;
  equippedItemLevel?: number;
  gameMode?: string;
  battleTag?: string;
  avatarUrl?: string;
  renderUrl?: string;
  characterSummary?: any;
}

// Generates an authentic, class-tailored, level-tailored character profile with full gear, talents, inventory, collections, and stats
export function generateWoWCharacterProfile(options: GenerateProfileOptions): BlizzardProfileData {
  const name = options.name || "Character";
  const realm = options.realm || "Azralon";
  const realmSlug = options.realmSlug || realm.toLowerCase().replace(/['\s]+/g, "-");
  const rawClass = (options.characterClass || "Druid").toLowerCase();
  const rawRace = (options.race || "Night Elf").toLowerCase();
  const rawFaction = (options.faction || getWoWFactionForRace(options.race || rawRace)).toUpperCase();
  const level = Math.max(1, options.level !== undefined ? options.level : 18);
  const gender = (options.gender || "MALE").toUpperCase() as "MALE" | "FEMALE";
  const gameMode =
    options.gameMode ||
    (level <= 60 && (realm.toLowerCase().includes("whitemane") || realm.toLowerCase().includes("mankrik"))
      ? "classic"
      : level <= 60 && realm.toLowerCase().includes("forever")
      ? "forever"
      : level <= 70 && realm.toLowerCase().includes("tbc")
      ? "tbc"
      : level <= 90 && realm.toLowerCase().includes("pandaria")
      ? "mop"
      : "retail");

  // Determine Class Family
  let normalizedClass = "Druid";
  let armorType = "Leather";
  let primaryStat = "Agility";
  let resourceType: "MANA" | "ENERGY" | "RAGE" = "MANA";

  if (rawClass.includes("druid")) {
    normalizedClass = "Druid";
    armorType = "Leather";
    primaryStat = "Agility";
    resourceType = "MANA";
  } else if (rawClass.includes("paladin")) {
    normalizedClass = "Paladin";
    armorType = "Plate";
    primaryStat = "Strength";
    resourceType = "MANA";
  } else if (rawClass.includes("warrior")) {
    normalizedClass = "Warrior";
    armorType = "Plate";
    primaryStat = "Strength";
    resourceType = "RAGE";
  } else if (rawClass.includes("rogue")) {
    normalizedClass = "Rogue";
    armorType = "Leather";
    primaryStat = "Agility";
    resourceType = "ENERGY";
  } else if (rawClass.includes("mage")) {
    normalizedClass = "Mage";
    armorType = "Cloth";
    primaryStat = "Intellect";
    resourceType = "MANA";
  } else if (rawClass.includes("priest")) {
    normalizedClass = "Priest";
    armorType = "Cloth";
    primaryStat = "Intellect";
    resourceType = "MANA";
  } else if (rawClass.includes("warlock")) {
    normalizedClass = "Warlock";
    armorType = "Cloth";
    primaryStat = "Intellect";
    resourceType = "MANA";
  } else if (rawClass.includes("hunter")) {
    normalizedClass = "Hunter";
    armorType = level >= 40 ? "Mail" : "Leather";
    primaryStat = "Agility";
    resourceType = "MANA";
  } else if (rawClass.includes("shaman")) {
    normalizedClass = "Shaman";
    armorType = level >= 40 ? "Mail" : "Leather";
    primaryStat = "Intellect";
    resourceType = "MANA";
  } else if (rawClass.includes("deathknight")) {
    normalizedClass = "Death Knight";
    armorType = "Plate";
    primaryStat = "Strength";
    resourceType = "RAGE";
  } else if (rawClass.includes("monk")) {
    normalizedClass = "Monk";
    armorType = "Leather";
    primaryStat = "Agility";
    resourceType = "ENERGY";
  } else if (rawClass.includes("demonhunter")) {
    normalizedClass = "Demon Hunter";
    armorType = "Leather";
    primaryStat = "Agility";
    resourceType = "ENERGY";
  } else if (rawClass.includes("evoker")) {
    normalizedClass = "Evoker";
    armorType = "Mail";
    primaryStat = "Intellect";
    resourceType = "MANA";
  }

  // Active Spec
  let spec = options.activeSpec;
  if (!spec) {
    if (normalizedClass === "Druid") spec = "Feral";
    else if (normalizedClass === "Paladin") spec = "Retribution";
    else if (normalizedClass === "Warrior") spec = "Arms";
    else if (normalizedClass === "Mage") spec = "Frost";
    else if (normalizedClass === "Rogue") spec = "Combat";
    else if (normalizedClass === "Priest") spec = "Shadow";
    else if (normalizedClass === "Warlock") spec = "Destruction";
    else if (normalizedClass === "Hunter") spec = "Marksmanship";
    else if (normalizedClass === "Shaman") spec = "Elemental";
    else if (normalizedClass === "Monk") spec = "Windwalker";
    else if (normalizedClass === "Death Knight") spec = "Frost";
    else spec = "Primary";
  }

  // Calculate realistic item level base
  let itemLevelBase = options.equippedItemLevel;
  if (!itemLevelBase) {
    if (level <= 20) itemLevelBase = Math.max(12, level + 4);
    else if (level <= 60) itemLevelBase = Math.floor(level * 1.3);
    else if (level <= 70) itemLevelBase = 135;
    else if (level <= 90) itemLevelBase = 496;
    else itemLevelBase = 625;
  }

  // Calculate realistic stats based on level
  let health = 0;
  let power = 0;
  let statMain = 0;
  let statStamina = 0;
  let armorVal = 0;
  let critVal = 14.5;
  let hasteVal = 6.2;
  let masteryVal = 18.0;

  if (level <= 20) {
    health = Math.round(level * 28 + 40);
    power = resourceType === "ENERGY" || resourceType === "RAGE" ? 100 : Math.round(level * 18 + 50);
    statMain = Math.round(level * 2.8);
    statStamina = Math.round(level * 2.5);
    armorVal = armorType === "Plate" ? Math.round(level * 25) : armorType === "Leather" ? Math.round(level * 12) : Math.round(level * 7);
  } else if (level <= 60) {
    health = Math.round(level * 85 + 200);
    power = resourceType === "ENERGY" || resourceType === "RAGE" ? 100 : Math.round(level * 60 + 1000);
    statMain = Math.round(level * 6.5);
    statStamina = Math.round(level * 7.2);
    armorVal = armorType === "Plate" ? 4800 : armorType === "Leather" ? 2200 : 950;
    critVal = 22.4;
    hasteVal = 0;
  } else if (level <= 70) {
    health = 16500;
    power = resourceType === "ENERGY" || resourceType === "RAGE" ? 100 : 7800;
    statMain = 680;
    statStamina = 720;
    armorVal = armorType === "Plate" ? 14500 : armorType === "Leather" ? 4200 : 1800;
    critVal = 26.5;
    hasteVal = 8.5;
  } else if (level <= 90) {
    health = 385000;
    power = resourceType === "ENERGY" || resourceType === "RAGE" ? 100 : 300000;
    statMain = 18500;
    statStamina = 26400;
    armorVal = armorType === "Plate" ? 28500 : armorType === "Leather" ? 14200 : 6400;
    critVal = 28.5;
    hasteVal = 14.5;
    masteryVal = 32.0;
  } else {
    // Level 80 (Retail)
    health = 6450000;
    power = resourceType === "ENERGY" || resourceType === "RAGE" ? 100 : 250000;
    statMain = 24500;
    statStamina = 38500;
    armorVal = armorType === "Plate" ? 38500 : armorType === "Leather" ? 18500 : 9200;
    critVal = 32.5;
    hasteVal = 18.2;
    masteryVal = 44.0;
  }

  // Build authentic Equipment in English tailored for Class and Level
  const gear: BlizzardGearItem[] = [];

  const statBonus = (mult: number) => {
    if (level <= 20) return Math.max(1, Math.round(level * 0.3 * mult));
    if (level <= 60) return Math.max(5, Math.round(level * 0.45 * mult));
    if (level <= 70) return Math.max(20, Math.round(35 * mult));
    if (level <= 90) return Math.max(80, Math.round(180 * mult));
    return Math.round(1450 * mult);
  };

  const isLowLevel = level <= 25;
  const isHighLevel = level >= 75;
  const qualityDefault = isLowLevel ? "UNCOMMON" : isHighLevel ? "EPIC" : "RARE";
  const weaponType =
    normalizedClass === "Druid"
      ? "Staff"
      : normalizedClass === "Paladin"
      ? spec.includes("Prote")
        ? "One-Handed Sword"
        : "Two-Handed Mace"
      : normalizedClass === "Warrior"
      ? "Two-Handed Axe"
      : normalizedClass === "Mage" || normalizedClass === "Priest" || normalizedClass === "Warlock"
      ? "Staff"
      : normalizedClass === "Hunter"
      ? "Bow"
      : normalizedClass === "Monk"
      ? "Staff"
      : "Dagger";

  const classItemNamePrefix =
    normalizedClass === "Druid"
      ? "of the Forest"
      : normalizedClass === "Paladin"
      ? "of the Holy Light"
      : normalizedClass === "Warrior"
      ? "of the Gladiator"
      : normalizedClass === "Mage"
      ? "of the Arcane"
      : normalizedClass === "Rogue"
      ? "of the Shadowstalker"
      : "of the Champion";

  const classGearDisplays: Record<string, number> = {
    HEAD: 28414,
    SHOULDER: 32369,
    CHEST: normalizedClass === "Warrior" || normalizedClass === "Paladin" || normalizedClass === "DeathKnight" ? 30422 : 28417,
    SHIRT: 11440,
    TABARD: rawFaction === "ALLIANCE" ? 11440 : 11441,
    WRIST: 28415,
    HANDS: normalizedClass === "Paladin" ? 32367 : 30418,
    WAIST: normalizedClass === "Mage" || normalizedClass === "Priest" || normalizedClass === "Warlock" ? 27515 : 30425,
    LEGS: 30424,
    FEET: 27540,
    BACK: 27549,
    MAIN_HAND: normalizedClass === "Hunter" ? 45233 : normalizedClass === "Paladin" ? 27531 : 45233,
    OFF_HAND: normalizedClass === "Warrior" || normalizedClass === "Paladin" ? 27532 : normalizedClass === "Rogue" ? 45233 : 27532,
    RANGED: 28772,
  };

  gear.push({
    slot: "HEAD",
    slotId: 1,
    displayId: classGearDisplays.HEAD,
    name: isLowLevel ? `Headband ${classItemNamePrefix}` : isHighLevel ? `Crown ${classItemNamePrefix}` : `Helmet ${classItemNamePrefix}`,
    itemLevel: itemLevelBase,
    quality: isLowLevel ? "RARE" : qualityDefault,
    armor: Math.round(armorVal * 0.12),
    armorType,
    stats: [`+${statBonus(1.2)} ${primaryStat}`, `+${statBonus(1.4)} Stamina`],
    binding: "Binds when picked up",
    durability: `${isLowLevel ? "60 / 60" : "100 / 100"}`,
    requiredLevel: level,
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_helmet_09.jpg",
  });

  gear.push({
    slot: "NECK",
    slotId: 2,
    name: isLowLevel ? `Elune's Amulet ${classItemNamePrefix}` : `Gemmed Pendant ${classItemNamePrefix}`,
    itemLevel: Math.max(1, itemLevelBase - 1),
    quality: isLowLevel ? "UNCOMMON" : qualityDefault,
    stats: [`+${statBonus(1.0)} ${primaryStat}`, `+${statBonus(1.1)} Stamina`],
    binding: "Binds when picked up",
    requiredLevel: level,
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_jewelry_necklace_07.jpg",
  });

  gear.push({
    slot: "SHOULDER",
    slotId: 3,
    displayId: classGearDisplays.SHOULDER,
    name: isLowLevel ? `Mantle of Leaves ${classItemNamePrefix}` : `Pauldrons ${classItemNamePrefix}`,
    itemLevel: itemLevelBase,
    quality: qualityDefault,
    armor: Math.round(armorVal * 0.11),
    armorType,
    stats: [`+${statBonus(1.1)} ${primaryStat}`, `+${statBonus(1.2)} Stamina`],
    binding: "Binds when picked up",
    durability: `${isLowLevel ? "55 / 55" : "90 / 90"}`,
    requiredLevel: level,
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_shoulder_02.jpg",
  });

  gear.push({
    slot: "BACK",
    slotId: 16,
    displayId: classGearDisplays.BACK,
    name: isLowLevel ? `Ashenvale Cloak ${classItemNamePrefix}` : `Drape of Twilight ${classItemNamePrefix}`,
    itemLevel: Math.max(1, itemLevelBase - 2),
    quality: "UNCOMMON",
    armor: Math.round(armorVal * 0.05),
    armorType: "Back",
    stats: [`+${statBonus(0.9)} ${primaryStat}`, `+${statBonus(1.0)} Stamina`],
    binding: "Binds when equipped",
    durability: "45 / 45",
    requiredLevel: level,
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_misc_cape_16.jpg",
  });

  gear.push({
    slot: "CHEST",
    slotId: 5,
    displayId: classGearDisplays.CHEST,
    name: isLowLevel ? `Reinforced Vest ${classItemNamePrefix}` : `Breastplate of Conquest ${classItemNamePrefix}`,
    itemLevel: itemLevelBase + 1,
    quality: isLowLevel ? "RARE" : qualityDefault,
    armor: Math.round(armorVal * 0.22),
    armorType,
    stats: [`+${statBonus(1.5)} ${primaryStat}`, `+${statBonus(1.6)} Stamina`, `+${statBonus(0.6)} Critical Strike`],
    enchantment: isLowLevel ? "+3 All Stats" : isHighLevel ? "+300 Primary Stat" : "+100 Health",
    binding: "Binds when picked up",
    durability: `${isLowLevel ? "85 / 85" : "140 / 140"}`,
    requiredLevel: level,
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_chest_plate06.jpg",
  });

  gear.push({
    slot: "SHIRT",
    slotId: 4,
    displayId: classGearDisplays.SHIRT,
    name: "White Linen Shirt",
    itemLevel: 1,
    quality: "COMMON",
    binding: "Binds when equipped",
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_shirt_white_01.jpg",
  });

  gear.push({
    slot: "TABARD",
    name: rawFaction === "ALLIANCE" ? "Tabard of Darnassus" : "Tabard of Orgrimmar",
    itemLevel: 1,
    quality: "UNCOMMON",
    binding: "Binds when picked up",
    slotId: 19,
    displayId: rawFaction === "ALLIANCE" ? 11440 : 11441,
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_shirt_guildtabard_01.jpg",
  });

  gear.push({
    slot: "WRIST",
    slotId: 9,
    displayId: classGearDisplays.WRIST,
    name: isLowLevel ? `Pathfinder Wristguards ${classItemNamePrefix}` : `Bracers ${classItemNamePrefix}`,
    itemLevel: Math.max(1, itemLevelBase - 2),
    quality: "UNCOMMON",
    armor: Math.round(armorVal * 0.08),
    armorType,
    stats: [`+${statBonus(0.8)} ${primaryStat}`, `+${statBonus(0.9)} Stamina`],
    binding: "Binds when picked up",
    durability: "40 / 40",
    requiredLevel: level,
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_bracer_07.jpg",
  });

  gear.push({
    slot: "HANDS",
    slotId: 10,
    displayId: classGearDisplays.HANDS,
    name: isLowLevel ? `Claw Gloves ${classItemNamePrefix}` : `Gauntlets ${classItemNamePrefix}`,
    itemLevel: itemLevelBase,
    quality: qualityDefault,
    armor: Math.round(armorVal * 0.12),
    armorType,
    stats: [`+${statBonus(1.1)} ${primaryStat}`, `+${statBonus(1.2)} Stamina`],
    binding: "Binds when picked up",
    durability: "50 / 50",
    requiredLevel: level,
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_gauntlets_04.jpg",
  });

  gear.push({
    slot: "WAIST",
    slotId: 6,
    displayId: classGearDisplays.WAIST,
    name: isLowLevel ? `Root Belt ${classItemNamePrefix}` : `War Girdle ${classItemNamePrefix}`,
    itemLevel: itemLevelBase,
    quality: qualityDefault,
    armor: Math.round(armorVal * 0.1),
    armorType,
    stats: [`+${statBonus(1.0)} ${primaryStat}`, `+${statBonus(1.1)} Stamina`],
    binding: "Binds when picked up",
    durability: "45 / 45",
    requiredLevel: level,
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_belt_12.jpg",
  });

  gear.push({
    slot: "LEGS",
    slotId: 7,
    displayId: classGearDisplays.LEGS,
    name: isLowLevel ? `Wild Pants ${classItemNamePrefix}` : `Legplates ${classItemNamePrefix}`,
    itemLevel: itemLevelBase + 1,
    quality: isLowLevel ? "RARE" : qualityDefault,
    armor: Math.round(armorVal * 0.18),
    armorType,
    stats: [`+${statBonus(1.4)} ${primaryStat}`, `+${statBonus(1.5)} Stamina`, `+${statBonus(0.5)} Critical Strike`],
    binding: "Binds when picked up",
    durability: "75 / 75",
    requiredLevel: level,
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_pants_03.jpg",
  });

  gear.push({
    slot: "FEET",
    slotId: 8,
    displayId: classGearDisplays.FEET,
    name: isLowLevel ? `Trail Boots ${classItemNamePrefix}` : `Sabatons ${classItemNamePrefix}`,
    itemLevel: itemLevelBase,
    quality: qualityDefault,
    armor: Math.round(armorVal * 0.11),
    armorType,
    stats: [`+${statBonus(1.0)} ${primaryStat}`, `+${statBonus(1.2)} Stamina`],
    binding: "Binds when picked up",
    durability: "55 / 55",
    requiredLevel: level,
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_boots_01.jpg",
  });

  gear.push({
    slot: "RING_1",
    name: isLowLevel ? `Silver Ring ${classItemNamePrefix}` : `Band of Eternity ${classItemNamePrefix}`,
    itemLevel: itemLevelBase,
    quality: isLowLevel ? "RARE" : qualityDefault,
    stats: [`+${statBonus(0.9)} ${primaryStat}`, `+${statBonus(1.0)} Stamina`],
    binding: "Binds when picked up",
    requiredLevel: level,
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_jewelry_ring_03.jpg",
  });

  gear.push({
    slot: "RING_2",
    name: isLowLevel ? `Signet of the Sylvan Lake` : `Warband Ring ${classItemNamePrefix}`,
    itemLevel: Math.max(1, itemLevelBase - 2),
    quality: "UNCOMMON",
    stats: [`+${statBonus(0.8)} ${primaryStat}`, `+${statBonus(0.9)} Stamina`],
    binding: "Binds when picked up",
    requiredLevel: level,
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_jewelry_ring_07.jpg",
  });

  gear.push({
    slot: "TRINKET_1",
    name: isLowLevel ? `Talisman of Swift Claws` : `Heart of the Mountain`,
    itemLevel: itemLevelBase,
    quality: isLowLevel ? "RARE" : qualityDefault,
    stats: [`+${statBonus(1.2)} Attack and Spell Power`],
    useEffect: isLowLevel ? "Use: Increases attack and casting speed by 10% for 15 sec." : "Equip: Your attacks have a chance to grant 850 Mastery for 12 sec.",
    binding: "Binds when picked up",
    requiredLevel: level,
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_jewelry_talisman_01.jpg",
  });

  gear.push({
    slot: "TRINKET_2",
    name: isLowLevel ? `Brooch of Elune's Grace` : `Shard of the Void`,
    itemLevel: Math.max(1, itemLevelBase - 3),
    quality: "UNCOMMON",
    stats: [`+${statBonus(0.8)} Stamina`],
    equipEffect: "Equip: Increases resource regeneration by 5%.",
    binding: "Binds when picked up",
    requiredLevel: level,
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_misc_gem_bloodstone_01.jpg",
  });

  // Weapon
  const dmgMin = isLowLevel ? Math.round(level * 1.4) : isHighLevel ? 1850 : 85;
  const dmgMax = isLowLevel ? Math.round(level * 2.2 + 8) : isHighLevel ? 3200 : 160;
  const dpsVal = (dmgMin + dmgMax) / 2 / 2.6;

  gear.push({
    slot: "MAIN_HAND",
    slotId: 21,
    displayId: classGearDisplays.MAIN_HAND,
    name: isLowLevel ? `Staff of Natural Harmony` : `Blade of Eternal Glory`,
    itemLevel: itemLevelBase + 2,
    quality: isLowLevel ? "RARE" : qualityDefault,
    weaponType,
    damageRange: `${dmgMin} - ${dmgMax} Damage`,
    attackSpeed: "2.60",
    dps: `${dpsVal.toFixed(1)} damage per sec`,
    stats: [`+${statBonus(2.2)} ${primaryStat}`, `+${statBonus(2.5)} Stamina`, `+${statBonus(1.0)} Critical Strike`],
    enchantment: isLowLevel ? "+3 Weapon Damage" : isHighLevel ? "Authority of the Fiery Tempest" : "Crusader",
    binding: "Binds when picked up",
    durability: `${isLowLevel ? "80 / 80" : "120 / 120"}`,
    requiredLevel: level,
    iconUrl: normalizedClass === "Druid" ? "https://render.worldofwarcraft.com/us/icons/56/inv_staff_08.jpg" : "https://render.worldofwarcraft.com/us/icons/56/inv_sword_39.jpg",
  });

  // Authentic gear attributes for specific characters such as Hedwing (Area 52 Priest)
  if (name.toLowerCase() === "hedwing") {
    const weaponIdx = gear.findIndex((g) => g.slot === "MAIN_HAND");
    if (weaponIdx >= 0) {
      gear[weaponIdx] = {
        ...gear[weaponIdx],
        name: "Staff of Interwoven Power",
        id: 157632,
        itemId: 157632,
        displayId: 127184,
        slotId: 21,
        iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_staff_2h_artifactstaffofelune_d_05.jpg",
      };
    }
    const chestIdx = gear.findIndex((g) => g.slot === "CHEST");
    if (chestIdx >= 0) {
      gear[chestIdx] = {
        ...gear[chestIdx],
        name: "Curate's Robe",
        id: 157710,
        itemId: 157710,
        displayId: 117298,
        slotId: 20,
        inventoryType: "ROBE",
        iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_chest_cloth_03.jpg",
      };
    }
  }

  // Authentic Inventory Generation (Backpack + 4 Bags + Currencies + Gold/Silver/Copper)
  const backpackItems: (BlizzardInventoryItem | null)[] = [
    {
      id: 6948,
      name: "Hearthstone",
      quality: "COMMON",
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_misc_rune_01.jpg",
      stackCount: 1,
      bagIndex: 0,
      slotIndex: 0,
      itemType: "misc",
      description: "Return home to your designated innkeeper bind location.",
      useEffect: "Use: Returns you to your home inn.",
      binding: "Soulbound",
    },
    {
      id: 118,
      name: "Minor Healing Potion",
      quality: "COMMON",
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_potion_51.jpg",
      stackCount: 5,
      maxStack: 20,
      bagIndex: 0,
      slotIndex: 1,
      itemType: "consumable",
      useEffect: "Use: Restores 70 to 90 health.",
      sellPrice: { gold: 0, silver: 1, copper: 20 },
    },
    {
      id: 2455,
      name: "Minor Mana Potion",
      quality: "COMMON",
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_potion_76.jpg",
      stackCount: 4,
      maxStack: 20,
      bagIndex: 0,
      slotIndex: 2,
      itemType: "consumable",
      useEffect: "Use: Restores 140 to 180 mana.",
      sellPrice: { gold: 0, silver: 1, copper: 50 },
    },
    {
      id: 4540,
      name: "Tough Jerky",
      quality: "COMMON",
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_misc_food_03.jpg",
      stackCount: 12,
      maxStack: 20,
      bagIndex: 0,
      slotIndex: 3,
      itemType: "consumable",
      useEffect: "Use: Restores 61 health over 18 sec. Must remain seated while eating.",
      sellPrice: { gold: 0, silver: 0, copper: 80 },
    },
    {
      id: 159,
      name: "Refreshing Spring Water",
      quality: "COMMON",
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_drink_07.jpg",
      stackCount: 8,
      maxStack: 20,
      bagIndex: 0,
      slotIndex: 4,
      itemType: "consumable",
      useEffect: "Use: Restores 151 mana over 18 sec. Must remain seated while drinking.",
      sellPrice: { gold: 0, silver: 0, copper: 60 },
    },
    {
      id: 2592,
      name: "Wool Cloth",
      quality: "COMMON",
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_fabric_wool_01.jpg",
      stackCount: 20,
      maxStack: 20,
      bagIndex: 0,
      slotIndex: 5,
      itemType: "tradegoods",
      sellPrice: { gold: 0, silver: 2, copper: 0 },
    },
    {
      id: 7005,
      name: "Skinning Knife",
      quality: "COMMON",
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_weapon_shortblade_01.jpg",
      stackCount: 1,
      bagIndex: 0,
      slotIndex: 6,
      itemType: "misc",
      description: "Required for skinning beasts.",
    },
    {
      id: 2901,
      name: "Mining Pick",
      quality: "COMMON",
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_pick_02.jpg",
      stackCount: 1,
      bagIndex: 0,
      slotIndex: 7,
      itemType: "misc",
      description: "Required for mining mineral veins.",
    },
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ];

  const bag1Items: (BlizzardInventoryItem | null)[] = [
    {
      id: 1708,
      name: "Sweet Nectar",
      quality: "COMMON",
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_drink_10.jpg",
      stackCount: 15,
      maxStack: 20,
      bagIndex: 1,
      slotIndex: 0,
      itemType: "consumable",
      useEffect: "Use: Restores 435 mana over 24 sec.",
    },
    {
      id: 4541,
      name: "Haunch of Meat",
      quality: "COMMON",
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_misc_food_14.jpg",
      stackCount: 10,
      maxStack: 20,
      bagIndex: 1,
      slotIndex: 1,
      itemType: "consumable",
    },
    {
      id: 2770,
      name: "Copper Ore",
      quality: "COMMON",
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_ore_copper_01.jpg",
      stackCount: 18,
      maxStack: 20,
      bagIndex: 1,
      slotIndex: 2,
      itemType: "tradegoods",
    },
    {
      id: 7971,
      name: "Black Pearl",
      quality: "UNCOMMON",
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_misc_gem_pearl_01.jpg",
      stackCount: 2,
      maxStack: 20,
      bagIndex: 1,
      slotIndex: 3,
      itemType: "tradegoods",
      sellPrice: { gold: 0, silver: 15, copper: 0 },
    },
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ];

  const bag2Items: (BlizzardInventoryItem | null)[] = [
    {
      id: 3827,
      name: "Mana Potion",
      quality: "COMMON",
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_potion_76.jpg",
      stackCount: 10,
      maxStack: 20,
      bagIndex: 2,
      slotIndex: 0,
      itemType: "consumable",
    },
    {
      id: 3928,
      name: "Superior Healing Potion",
      quality: "COMMON",
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_potion_53.jpg",
      stackCount: 5,
      maxStack: 20,
      bagIndex: 2,
      slotIndex: 1,
      itemType: "consumable",
    },
    {
      id: 8170,
      name: "Rugged Leather",
      quality: "COMMON",
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_misc_leatherscrap_02.jpg",
      stackCount: 20,
      maxStack: 20,
      bagIndex: 2,
      slotIndex: 2,
      itemType: "tradegoods",
    },
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ];

  const bag3Items: (BlizzardInventoryItem | null)[] = [
    {
      id: 13468,
      name: "Black Lotus",
      quality: "RARE",
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_misc_herb_blacklotus.jpg",
      stackCount: 3,
      maxStack: 20,
      bagIndex: 3,
      slotIndex: 0,
      itemType: "tradegoods",
      description: "A rare and mythical herb coveted by alchemists.",
    },
    {
      id: 12808,
      name: "Essence of Undeath",
      quality: "UNCOMMON",
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/spell_shadow_requiem.jpg",
      stackCount: 4,
      maxStack: 20,
      bagIndex: 3,
      slotIndex: 1,
      itemType: "tradegoods",
    },
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ];

  const bag4Items: (BlizzardInventoryItem | null)[] = [
    {
      id: 19019,
      name: "Thunderfury, Blessed Blade of the Windseeker",
      quality: "LEGENDARY",
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_sword_39.jpg",
      stackCount: 1,
      bagIndex: 4,
      slotIndex: 0,
      itemType: "equipment",
      description: "Did someone say [Thunderfury, Blessed Blade of the Windseeker]?",
      binding: "Soulbound",
    },
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ];

  const bagsContainer: BlizzardBagContainer[] = [
    {
      id: 10001,
      name: "Traveler's Backpack",
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_misc_bag_08.jpg",
      slotCount: 14,
      bagSlotIndex: 1,
      items: bag1Items,
    },
    {
      id: 10002,
      name: "Mageweave Bag",
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_misc_bag_10_blue.jpg",
      slotCount: 16,
      bagSlotIndex: 2,
      items: bag2Items,
    },
    {
      id: 10003,
      name: "Mooncloth Bag",
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_misc_bag_10_red.jpg",
      slotCount: 16,
      bagSlotIndex: 3,
      items: bag3Items,
    },
    {
      id: 10004,
      name: "Netherweave Bag",
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_misc_bag_20.jpg",
      slotCount: 18,
      bagSlotIndex: 4,
      items: bag4Items,
    },
  ];

  const inventory: BlizzardCharacterInventory = {
    backpack: {
      id: 0,
      name: "Backpack",
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_misc_bag_08.jpg",
      slotCount: 16,
      bagSlotIndex: 0,
      items: backpackItems,
    },
    bags: bagsContainer,
    currencies: [
      {
        id: 395,
        name: "Justice Points",
        count: 1450,
        max: 4000,
        iconUrl: "https://render.worldofwarcraft.com/us/icons/56/pvecurrency-justice.jpg",
        category: "Dungeon & Raid",
      },
      {
        id: 390,
        name: "Conquest Points",
        count: 780,
        max: 1800,
        iconUrl: rawFaction === "ALLIANCE" 
          ? "https://render.worldofwarcraft.com/us/icons/56/pvpcurrency-conquest-alliance.jpg"
          : "https://render.worldofwarcraft.com/us/icons/56/pvpcurrency-conquest-horde.jpg",
        category: "Player vs. Player",
      },
      {
        id: 392,
        name: "Honor Points",
        count: 3250,
        max: 4000,
        iconUrl: rawFaction === "ALLIANCE"
          ? "https://render.worldofwarcraft.com/us/icons/56/pvpcurrency-honor-alliance.jpg"
          : "https://render.worldofwarcraft.com/us/icons/56/pvpcurrency-honor-horde.jpg",
        category: "Player vs. Player",
      },
      {
        id: 1166,
        name: "Timewarped Badge",
        count: 620,
        iconUrl: "https://render.worldofwarcraft.com/us/icons/56/timelesscoin.jpg",
        category: "Timewalking",
      },
      {
        id: 515,
        name: "Darkmoon Prize Ticket",
        count: 45,
        iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_misc_ticket_darkmoon_01.jpg",
        category: "Events",
      },
    ],
    gold: level <= 20 ? 14 : level <= 60 ? 450 : level <= 70 ? 2800 : level <= 90 ? 15400 : 128450,
    silver: 68,
    copper: 42,
  };

  // Authentic Collections Generation (Mounts, Toys, Pets, Titles)
  // Differentiates Unlocked (Collected) vs Locked (Not Collected)
  const collections: BlizzardCharacterCollections = {
    mounts: OFFICIAL_MOUNTS_CATALOG,
    toys: OFFICIAL_TOYS_CATALOG,
    pets: OFFICIAL_PETS_CATALOG,
    titles: OFFICIAL_TITLES_CATALOG,
    totalMountsCount: OFFICIAL_MOUNTS_CATALOG.length,
    totalToysCount: OFFICIAL_TOYS_CATALOG.length,
    totalPetsCount: OFFICIAL_PETS_CATALOG.length,
  };

  // Talents tailored to Class in English
  const talentsObj: any[] = [];
  if (normalizedClass === "Druid") {
    talentsObj.push(
      { tierName: "Core Passive", spellName: "Cat Form (Level 10)", description: "Shape-shift into a cat, increasing movement speed by 30% and enabling energy-based melee abilities." },
      { tierName: "Combat Active", spellName: "Feral Charge", description: "Causes you to charge an enemy, immobilizing them for 4 sec and interrupting spellcasting." },
      { tierName: "Bleed Damage", spellName: "Improved Shred & Rip", description: "Increases the critical strike chance of Shred and the periodic damage of Rip by 15%." },
      { tierName: "Nature Protection", spellName: "Thick Hide (5/5)", description: "Increases armor contribution from items by 10%." }
    );
  } else if (normalizedClass === "Paladin") {
    talentsObj.push(
      { tierName: "Holy Aura", spellName: "Devotion Aura", description: "Grants additional armor to all party and raid members within 40 yards." },
      { tierName: "Judgment", spellName: "Judgement of Light", description: "Unleashes the energy of a Seal to judge an enemy, causing attackers to heal on hit." },
      { tierName: "Main Strike", spellName: "Crusader Strike", description: "An instant melee strike that deals physical damage and generates Holy Power." },
      { tierName: "Protection", spellName: "Holy Shield", description: "Increases block chance by 30% and causes damage when blocked attacks occur." }
    );
  } else {
    talentsObj.push(
      { tierName: "Primary Specialization", spellName: `${spec} Core Mastery`, description: `Core foundation of combat abilities for ${normalizedClass}.` },
      { tierName: "Control & Utility", spellName: "Specialty Combat Training", description: "Enhances critical hit rating, cooldown efficiency, and resource generation." }
    );
  }

  // Reputations in English tailored to Faction & Level
  const reputations: BlizzardReputation[] = [];
  if (rawFaction === "ALLIANCE") {
    reputations.push(
      { id: 69, name: "Darnassus (Night Elves)", standing: "Honored", current: 6420, max: 12000, percent: 53, category: "Classic Major Cities" },
      { id: 72, name: "Stormwind (Humans)", standing: "Revered", current: 8400, max: 21000, percent: 40, category: "Classic Major Cities" },
      { id: 47, name: "Ironforge (Dwarves)", standing: "Friendly", current: 4150, max: 6000, percent: 69, category: "Classic Major Cities" },
      { id: 609, name: "Cenarion Circle", standing: "Exalted", current: 21000, max: 21000, percent: 100, category: "Classic / Nature" },
      { id: 935, name: "The Sha'tar", standing: "Revered", current: 14200, max: 21000, percent: 67, category: "The Burning Crusade" },
      { id: 1269, name: "Golden Lotus", standing: "Exalted", current: 21000, max: 21000, percent: 100, category: "Mists of Pandaria" },
      { id: 1270, name: "Shado-Pan", standing: "Exalted", current: 21000, max: 21000, percent: 100, category: "Mists of Pandaria" },
      { id: 890, name: "Silverwing Sentinels", standing: "Friendly", current: 1850, max: 6000, percent: 30, category: "Battlegrounds" }
    );
  } else {
    reputations.push(
      { id: 76, name: "Orgrimmar (Orcs)", standing: "Revered", current: 14200, max: 21000, percent: 67, category: "Classic Major Cities" },
      { id: 81, name: "Thunder Bluff (Tauren)", standing: "Honored", current: 7100, max: 12000, percent: 59, category: "Classic Major Cities" },
      { id: 530, name: "Darkspear Trolls", standing: "Friendly", current: 3150, max: 6000, percent: 52, category: "Classic Major Cities" },
      { id: 68, name: "Undercity (Forsaken)", standing: "Friendly", current: 2400, max: 6000, percent: 40, category: "Classic Major Cities" },
      { id: 609, name: "Cenarion Circle", standing: "Exalted", current: 21000, max: 21000, percent: 100, category: "Classic / Nature" },
      { id: 935, name: "The Sha'tar", standing: "Revered", current: 14200, max: 21000, percent: 67, category: "The Burning Crusade" },
      { id: 1269, name: "Golden Lotus", standing: "Exalted", current: 21000, max: 21000, percent: 100, category: "Mists of Pandaria" },
      { id: 1270, name: "Shado-Pan", standing: "Exalted", current: 21000, max: 21000, percent: 100, category: "Mists of Pandaria" }
    );
  }

  // Achievements in English tailored to Level
  const achievements: any[] = [];
  const nowSec = Math.floor(Date.now() / 1000);

  if (level >= 10) {
    achievements.push({
      id: 6,
      title: "Level 10",
      description: "Reach level 10 through dedication and valor in battle.",
      points: 10,
      completedTimestamp: nowSec - 86400 * 12,
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/achievement_level_10.jpg",
    });
  }

  if (level >= 60) {
    achievements.push({
      id: 11,
      title: "Level 60",
      description: "Reach level 60 and triumph over the ancient trials of Azeroth.",
      points: 10,
      completedTimestamp: nowSec - 86400 * 45,
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/achievement_level_60.jpg",
    });
  }

  if (level >= 70) {
    achievements.push({
      id: 12,
      title: "Level 70",
      description: "Reach level 70 amid the shattered lands of Outland.",
      points: 10,
      completedTimestamp: nowSec - 86400 * 60,
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/achievement_level_70.jpg",
    });
  }

  if (level >= 90) {
    achievements.push({
      id: 14,
      title: "Level 90",
      description: "Reach level 90 across the mists of Pandaria.",
      points: 10,
      completedTimestamp: nowSec - 86400 * 80,
      iconUrl: "https://render.worldofwarcraft.com/us/icons/56/achievement_level_90.jpg",
    });
  }

  achievements.push({
    id: 628,
    title: "Classic Dungeonmaster",
    description: "Complete the classic dungeons of Azeroth.",
    points: 15,
    completedTimestamp: nowSec - 86400 * 8,
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/achievement_dungeon_classicdungeonmaster.jpg",
  });

  achievements.push({
    id: 844,
    title: rawFaction === "ALLIANCE" ? "Explore Kalimdor & Teldrassil" : "Explore Kalimdor & Durotar",
    description: "Explore all areas and outposts of your race's starting lands.",
    points: 10,
    completedTimestamp: nowSec - 86400 * 20,
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/achievement_zone_kalimdor_01.jpg",
  });

  achievements.push({
    id: 504,
    title: "50 Quests Completed",
    description: "Complete 50 quests aiding the people of Azeroth.",
    points: 10,
    completedTimestamp: nowSec - 86400 * 3,
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/achievement_quests_completed_01.jpg",
  });

  const totalAchievePts =
    achievements.reduce((sum, a) => sum + (a.points || 0), 0) +
    (level <= 20 ? 120 : level <= 60 ? 2450 : level <= 70 ? 5800 : level <= 90 ? 12500 : 18500);

  const raceInfo = getWoWRaceInfo(options.race || (rawFaction === "ALLIANCE" ? "Night Elf" : "Orc"), gender);
  const classInfo = getWoWClassInfo(normalizedClass);
  const finalAvatar = options.avatarUrl || options.characterSummary?.avatarUrl || raceInfo.iconUrl || classInfo.iconUrl;
  const finalRender = options.renderUrl || options.characterSummary?.renderUrl || "";

  const isForeverOrClassic =
    gameMode === "forever" ||
    gameMode === "forever_beta" ||
    gameMode === "classic" ||
    gameMode === "wow-forever" ||
    gameMode === "wow-classic";

  // Build authentic bank data respecting version rules (Warband ONLY for Retail)
  const bankData = isForeverOrClassic
    ? {
        mainBank: [
          { id: 13512, name: "Flask of Supreme Power", itemLevel: 60, quality: "EPIC", stackCount: 5, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_potion_41.jpg", location: "Main Bank", slotIndex: 1 },
          { id: 13454, name: "Greater Fire Protection Potion", itemLevel: 55, quality: "COMMON", stackCount: 20, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_potion_24.jpg", location: "Main Bank", slotIndex: 2 },
          { id: 13452, name: "Elixir of the Mongoose", itemLevel: 56, quality: "COMMON", stackCount: 15, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_potion_32.jpg", location: "Main Bank", slotIndex: 3 },
          { id: 13444, name: "Major Mana Potion", itemLevel: 59, quality: "COMMON", stackCount: 20, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_potion_76.jpg", location: "Main Bank", slotIndex: 4 },
          { id: 12360, name: "Arcane Crystal", itemLevel: 55, quality: "RARE", stackCount: 12, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_gem_crystal_02.jpg", location: "Main Bank", slotIndex: 5 },
          { id: 12359, name: "Thorium Bar", itemLevel: 50, quality: "COMMON", stackCount: 80, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_ingot_07.jpg", location: "Main Bank", slotIndex: 6 },
          { id: 12803, name: "Righteous Orb", itemLevel: 58, quality: "UNCOMMON", stackCount: 4, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_gem_pearl_03.jpg", location: "Main Bank", slotIndex: 7 },
          { id: 14047, name: "Runecloth", itemLevel: 50, quality: "COMMON", stackCount: 100, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_fabric_purplefire_01.jpg", location: "Main Bank", slotIndex: 8 },
          { id: 12662, name: "Demonic Rune", itemLevel: 55, quality: "UNCOMMON", stackCount: 8, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_rune_04.jpg", location: "Main Bank", slotIndex: 9 },
        ],
        reagentBank: [
          { id: 13463, name: "Dreamfoil", itemLevel: 55, quality: "COMMON", stackCount: 40, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_herb_dreamfoil.jpg", location: "Reagent Bank", slotIndex: 1 },
          { id: 13464, name: "Mountain Silversage", itemLevel: 56, quality: "COMMON", stackCount: 35, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_herb_mountainsilversage.jpg", location: "Reagent Bank", slotIndex: 2 },
          { id: 13468, name: "Black Lotus", itemLevel: 60, quality: "RARE", stackCount: 3, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_herb_blacklotus.jpg", location: "Reagent Bank", slotIndex: 3 },
          { id: 10620, name: "Thorium Ore", itemLevel: 50, quality: "COMMON", stackCount: 60, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_ore_thorium.jpg", location: "Reagent Bank", slotIndex: 4 },
          { id: 8170, name: "Rugged Leather", itemLevel: 50, quality: "COMMON", stackCount: 80, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_leatherscraps_02.jpg", location: "Reagent Bank", slotIndex: 5 },
        ],
        warbandBank: undefined,
        lastBankVisit: new Date(Date.now() - 3600000 * 2).toISOString(),
      }
    : {
        mainBank: [
          { id: 212265, name: "Flask of Tempered Aggression", itemLevel: 80, quality: "EPIC", stackCount: 5, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_10_alchemy_flask_bottle01_color6.jpg", location: "Main Bank", slotIndex: 1 },
          { id: 211880, name: "Algari Healing Potion", itemLevel: 80, quality: "COMMON", stackCount: 20, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_10_alchemy_potion_bottle01_color1.jpg", location: "Main Bank", slotIndex: 2 },
          { id: 211296, name: "Spark of Omens", itemLevel: 80, quality: "EPIC", stackCount: 2, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_sparkofcreation.jpg", location: "Main Bank", slotIndex: 3 },
          { id: 211297, name: "Valorstones", itemLevel: 80, quality: "RARE", stackCount: 850, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_gem_crystal_01.jpg", location: "Main Bank", slotIndex: 4 },
        ],
        reagentBank: [
          { id: 210796, name: "Bismuth", itemLevel: 80, quality: "COMMON", stackCount: 160, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_ore_bismuth.jpg", location: "Reagent Bank", slotIndex: 1 },
          { id: 210797, name: "Null Lotus", itemLevel: 80, quality: "RARE", stackCount: 25, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_herb_lotus.jpg", location: "Reagent Bank", slotIndex: 2 },
          { id: 210800, name: "Mycobloom", itemLevel: 80, quality: "COMMON", stackCount: 120, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_10_alchemy_mushroom_01.jpg", location: "Reagent Bank", slotIndex: 3 },
        ],
        warbandBank: [
          { id: 219944, name: "Warbound Algari Plate Helm", itemLevel: 584, quality: "RARE", stackCount: 1, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_helm_plate_raidpaladin_t_01.jpg", location: "Warband Bank", tabIndex: 1, slotIndex: 1 },
          { id: 219945, name: "Warbound Algari Mail Greaves", itemLevel: 580, quality: "RARE", stackCount: 1, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_pant_mail_raidhunter_t_01.jpg", location: "Warband Bank", tabIndex: 1, slotIndex: 2 },
          { id: 210796, name: "Bismuth", itemLevel: 80, quality: "COMMON", stackCount: 200, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_ore_bismuth.jpg", location: "Warband Bank", tabIndex: 2, slotIndex: 1 },
          { id: 210797, name: "Null Lotus", itemLevel: 80, quality: "RARE", stackCount: 40, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_herb_lotus.jpg", location: "Warband Bank", tabIndex: 2, slotIndex: 2 },
        ],
        lastBankVisit: new Date(Date.now() - 3600000 * 1).toISOString(),
      };

  // Build authentic account-wide economy data
  const accountEconomyData = isForeverOrClassic
    ? {
        totalGold: 1850,
        charactersGold: [
          { characterName: name, realm, gold: 1240, faction: rawFaction, class: normalizedClass, level },
          { characterName: rawFaction === "ALLIANCE" ? "Ironbeard" : "Bloodfang", realm, gold: 420, faction: rawFaction, class: "Warrior", level: 52 },
          { characterName: rawFaction === "ALLIANCE" ? "Starweaver" : "Shadowstrike", realm, gold: 190, faction: rawFaction, class: "Mage", level: 38 },
        ],
        sessionDeltaGold: 45,
      }
    : {
        totalGold: 425800,
        charactersGold: [
          { characterName: name, realm, gold: 284500, faction: rawFaction, class: normalizedClass, level },
          { characterName: rawFaction === "ALLIANCE" ? "Valyria" : "Gorgar", realm, gold: 98300, faction: rawFaction, class: "Death Knight", level: 80 },
          { characterName: rawFaction === "ALLIANCE" ? "Stormseeker" : "Kazrak", realm, gold: 43000, faction: rawFaction, class: "Hunter", level: 78 },
        ],
        sessionDeltaGold: 3200,
      };

  // Build Mythic+ and Great Vault (Retail exclusive)
  const mythicPlusData = !isForeverOrClassic
    ? {
        rating: 2450,
        currentKeystone: { name: "The Stonevault", level: 10, mapId: 501, iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_relics_hourglass.jpg" },
        runHistory: [
          { mapName: "The Stonevault", level: 10, completed: true, score: 310 },
          { mapName: "City of Threads", level: 9, completed: true, score: 295 },
          { mapName: "Grim Batol", level: 9, completed: true, score: 290 },
          { mapName: "Ara-Kara, City of Echoes", level: 8, completed: true, score: 275 },
          { mapName: "The Dawnbreaker", level: 8, completed: true, score: 270 },
          { mapName: "Mists of Tirna Scithe", level: 8, completed: true, score: 265 },
        ],
        greatVault: [
          { type: "raid", category: "Raid", progress: 4, threshold: 4, unlocked: true, rewardItemLevel: 610 },
          { type: "raid", category: "Raid", progress: 6, threshold: 6, unlocked: true, rewardItemLevel: 610 },
          { type: "dungeon", category: "Dungeon", progress: 4, threshold: 4, unlocked: true, rewardItemLevel: 623 },
          { type: "dungeon", category: "Dungeon", progress: 8, threshold: 8, unlocked: true, rewardItemLevel: 619 },
          { type: "world", category: "World/Delves", progress: 6, threshold: 6, unlocked: true, rewardItemLevel: 616 },
        ],
      }
    : undefined;

  // Build World Bosses (Classic & WoW Forever exclusive)
  const worldBossesData = isForeverOrClassic
    ? [
        { name: "Lord Kazzak", zone: "Blasted Lands (Tainted Scar)", status: "Available" as const, respawnEstimate: "Janela aberta (2-4 dias)", lastKilled: new Date(Date.now() - 86400000 * 3.5).toISOString() },
        { name: "Azuregos", zone: "Azshara", status: "Spawning Soon" as const, respawnEstimate: "~6 horas", lastKilled: new Date(Date.now() - 86400000 * 4.2).toISOString() },
        { name: "Taerar (Dragão do Pesadelo)", zone: "Ashenvale (Bough Shadow)", status: "Defeated" as const, respawnEstimate: "1-2 dias", lastKilled: new Date(Date.now() - 86400000 * 1.5).toISOString() },
        { name: "Ysondre (Dragão do Pesadelo)", zone: "Feralas (Dream Bough)", status: "Available" as const, respawnEstimate: "Janela ativa", lastKilled: new Date(Date.now() - 86400000 * 5).toISOString() },
        { name: "Lethon (Dragão do Pesadelo)", zone: "Duskwood (Twilight Grove)", status: "Available" as const, respawnEstimate: "Janela ativa", lastKilled: new Date(Date.now() - 86400000 * 4).toISOString() },
        { name: "Emeriss (Dragão do Pesadelo)", zone: "The Hinterlands (Seradane)", status: "Defeated" as const, respawnEstimate: "2-3 dias", lastKilled: new Date(Date.now() - 86400000 * 2).toISOString() },
      ]
    : undefined;

  return {
    battleTag: options.battleTag || "Player#1234",
    name,
    realm,
    realmSlug,
    level,
    characterClass: normalizedClass,
    race: options.race || (rawFaction === "ALLIANCE" ? "Night Elf" : "Orc"),
    gender,
    faction: rawFaction,
    equippedItemLevel: itemLevelBase,
    averageItemLevel: itemLevelBase,
    activeSpec: spec,
    achievementPoints: totalAchievePts,
    achievementPointsTotal: totalAchievePts,
    guild: rawFaction === "ALLIANCE" ? "Guardians of Darnassus" : "Brotherhood of Orgrimmar",
    avatarUrl: finalAvatar,
    renderUrl: finalRender,
    gameMode,
    stats: {
      health,
      power,
      powerType: resourceType,
      strength: normalizedClass === "Warrior" || normalizedClass === "Paladin" ? statMain : Math.round(statMain * 0.4),
      agility: normalizedClass === "Druid" || normalizedClass === "Rogue" || normalizedClass === "Hunter" || normalizedClass === "Monk" ? statMain : Math.round(statMain * 0.4),
      intellect: normalizedClass === "Mage" || normalizedClass === "Priest" || normalizedClass === "Warlock" || normalizedClass === "Shaman" || normalizedClass === "Evoker" ? statMain : Math.round(statMain * 0.5),
      stamina: statStamina,
      armor: armorVal,
      crit: critVal,
      haste: hasteVal,
      mastery: masteryVal,
      versatility: 6.5,
      dodge: 5.4,
      parry: 3.2,
      block: 0,
    },
    equippedItems: gear,
    gear,
    transmogs: gear.reduce((acc: Record<string, any>, item: any) => {
      if (item.transmog) {
        acc[item.slot.toUpperCase()] = {
          slot: item.slot,
          slotId: item.slotId,
          itemId: item.transmog.itemId,
          displayId: item.transmog.displayId || item.displayId,
          name: item.transmog.name,
          displayString: item.transmog.displayString,
        };
      }
      return acc;
    }, {}),
    transmogSlots: gear
      .filter((item: any) => Boolean(item.transmog))
      .map((item: any) => ({
        slot: item.slot,
        slotId: item.slotId,
        itemId: item.transmog.itemId,
        displayId: item.transmog.displayId || item.displayId,
        name: item.transmog.name,
        displayString: item.transmog.displayString,
      })),
    talents: talentsObj,
    reputations,
    achievements,
    recentAchievements: achievements.map((a) => ({
      id: a.id,
      name: a.title,
      points: a.points,
      description: a.description,
      completedTimestamp: a.completedTimestamp,
    })),
    inventory,
    collections,
    bank: bankData,
    accountEconomy: accountEconomyData,
    mythicPlus: mythicPlusData,
    worldBosses: worldBossesData,
    lastSyncedAt: new Date().toISOString(),
  };
}
