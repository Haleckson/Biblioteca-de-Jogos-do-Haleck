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
import { getWoWClassInfo, getWoWRaceInfo } from "./blizzardIcons";

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
  const rawFaction = (
    options.faction ||
    (rawRace.includes("night") ||
    rawRace.includes("human") ||
    rawRace.includes("dwarf") ||
    rawRace.includes("gnome") ||
    rawRace.includes("draenei") ||
    rawRace.includes("worgen")
      ? "ALLIANCE"
      : "HORDE")
  ).toUpperCase();
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

  gear.push({
    slot: "HEAD",
    name: isLowLevel ? `Headband ${classItemNamePrefix}` : isHighLevel ? `Crown ${classItemNamePrefix}` : `Helmet ${classItemNamePrefix}`,
    itemLevel: itemLevelBase,
    quality: isLowLevel ? "RARE" : qualityDefault,
    armor: Math.round(armorVal * 0.12),
    armorType,
    stats: [`+${statBonus(1.2)} ${primaryStat}`, `+${statBonus(1.4)} Stamina`],
    binding: "Binds when picked up",
    durability: `${isLowLevel ? "60 / 60" : "100 / 100"}`,
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_helmet_09.jpg",
  });

  gear.push({
    slot: "NECK",
    name: isLowLevel ? `Elune's Amulet ${classItemNamePrefix}` : `Gemmed Pendant ${classItemNamePrefix}`,
    itemLevel: Math.max(1, itemLevelBase - 1),
    quality: isLowLevel ? "UNCOMMON" : qualityDefault,
    stats: [`+${statBonus(1.0)} ${primaryStat}`, `+${statBonus(1.1)} Stamina`],
    binding: "Binds when picked up",
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_jewelry_necklace_07.jpg",
  });

  gear.push({
    slot: "SHOULDER",
    name: isLowLevel ? `Mantle of Leaves ${classItemNamePrefix}` : `Pauldrons ${classItemNamePrefix}`,
    itemLevel: itemLevelBase,
    quality: qualityDefault,
    armor: Math.round(armorVal * 0.11),
    armorType,
    stats: [`+${statBonus(1.1)} ${primaryStat}`, `+${statBonus(1.2)} Stamina`],
    binding: "Binds when picked up",
    durability: `${isLowLevel ? "55 / 55" : "90 / 90"}`,
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_shoulder_02.jpg",
  });

  gear.push({
    slot: "BACK",
    name: isLowLevel ? `Ashenvale Cloak ${classItemNamePrefix}` : `Drape of Twilight ${classItemNamePrefix}`,
    itemLevel: Math.max(1, itemLevelBase - 2),
    quality: "UNCOMMON",
    armor: Math.round(armorVal * 0.05),
    armorType: "Back",
    stats: [`+${statBonus(0.9)} ${primaryStat}`, `+${statBonus(1.0)} Stamina`],
    binding: "Binds when equipped",
    durability: "45 / 45",
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_cape_16.jpg",
  });

  gear.push({
    slot: "CHEST",
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
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_chest_plate06.jpg",
  });

  gear.push({
    slot: "SHIRT",
    name: "White Linen Shirt",
    itemLevel: 1,
    quality: "COMMON",
    binding: "Binds when equipped",
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_shirt_white_01.jpg",
  });

  gear.push({
    slot: "TABARD",
    name: rawFaction === "ALLIANCE" ? "Tabard of Darnassus" : "Tabard of Orgrimmar",
    itemLevel: 1,
    quality: "UNCOMMON",
    binding: "Binds when picked up",
    slotId: 19,
    displayId: rawFaction === "ALLIANCE" ? 11440 : 11441,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_shirt_guildtabard_01.jpg",
  });

  gear.push({
    slot: "WRIST",
    name: isLowLevel ? `Pathfinder Wristguards ${classItemNamePrefix}` : `Bracers ${classItemNamePrefix}`,
    itemLevel: Math.max(1, itemLevelBase - 2),
    quality: "UNCOMMON",
    armor: Math.round(armorVal * 0.08),
    armorType,
    stats: [`+${statBonus(0.8)} ${primaryStat}`, `+${statBonus(0.9)} Stamina`],
    binding: "Binds when picked up",
    durability: "40 / 40",
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_bracer_07.jpg",
  });

  gear.push({
    slot: "HANDS",
    name: isLowLevel ? `Claw Gloves ${classItemNamePrefix}` : `Gauntlets ${classItemNamePrefix}`,
    itemLevel: itemLevelBase,
    quality: qualityDefault,
    armor: Math.round(armorVal * 0.12),
    armorType,
    stats: [`+${statBonus(1.1)} ${primaryStat}`, `+${statBonus(1.2)} Stamina`],
    binding: "Binds when picked up",
    durability: "50 / 50",
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_gauntlets_04.jpg",
  });

  gear.push({
    slot: "WAIST",
    name: isLowLevel ? `Root Belt ${classItemNamePrefix}` : `War Girdle ${classItemNamePrefix}`,
    itemLevel: itemLevelBase,
    quality: qualityDefault,
    armor: Math.round(armorVal * 0.1),
    armorType,
    stats: [`+${statBonus(1.0)} ${primaryStat}`, `+${statBonus(1.1)} Stamina`],
    binding: "Binds when picked up",
    durability: "45 / 45",
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_belt_12.jpg",
  });

  gear.push({
    slot: "LEGS",
    name: isLowLevel ? `Wild Pants ${classItemNamePrefix}` : `Legplates ${classItemNamePrefix}`,
    itemLevel: itemLevelBase + 1,
    quality: isLowLevel ? "RARE" : qualityDefault,
    armor: Math.round(armorVal * 0.18),
    armorType,
    stats: [`+${statBonus(1.4)} ${primaryStat}`, `+${statBonus(1.5)} Stamina`, `+${statBonus(0.5)} Critical Strike`],
    binding: "Binds when picked up",
    durability: "75 / 75",
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_pants_03.jpg",
  });

  gear.push({
    slot: "FEET",
    name: isLowLevel ? `Trail Boots ${classItemNamePrefix}` : `Sabatons ${classItemNamePrefix}`,
    itemLevel: itemLevelBase,
    quality: qualityDefault,
    armor: Math.round(armorVal * 0.11),
    armorType,
    stats: [`+${statBonus(1.0)} ${primaryStat}`, `+${statBonus(1.2)} Stamina`],
    binding: "Binds when picked up",
    durability: "55 / 55",
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_boots_01.jpg",
  });

  gear.push({
    slot: "RING_1",
    name: isLowLevel ? `Silver Ring ${classItemNamePrefix}` : `Band of Eternity ${classItemNamePrefix}`,
    itemLevel: itemLevelBase,
    quality: isLowLevel ? "RARE" : qualityDefault,
    stats: [`+${statBonus(0.9)} ${primaryStat}`, `+${statBonus(1.0)} Stamina`],
    binding: "Binds when picked up",
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_jewelry_ring_03.jpg",
  });

  gear.push({
    slot: "RING_2",
    name: isLowLevel ? `Signet of the Sylvan Lake` : `Warband Ring ${classItemNamePrefix}`,
    itemLevel: Math.max(1, itemLevelBase - 2),
    quality: "UNCOMMON",
    stats: [`+${statBonus(0.8)} ${primaryStat}`, `+${statBonus(0.9)} Stamina`],
    binding: "Binds when picked up",
    requiredLevel: level,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_jewelry_ring_07.jpg",
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
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_jewelry_talisman_01.jpg",
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
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_gem_bloodstone_01.jpg",
  });

  // Weapon
  const dmgMin = isLowLevel ? Math.round(level * 1.4) : isHighLevel ? 1850 : 85;
  const dmgMax = isLowLevel ? Math.round(level * 2.2 + 8) : isHighLevel ? 3200 : 160;
  const dpsVal = (dmgMin + dmgMax) / 2 / 2.6;

  gear.push({
    slot: "MAIN_HAND",
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
    iconUrl: normalizedClass === "Druid" ? "https://wow.zamimg.com/images/wow/icons/large/inv_staff_08.jpg" : "https://wow.zamimg.com/images/wow/icons/large/inv_sword_39.jpg",
  });

  // Authentic Inventory Generation (Backpack + 4 Bags + Currencies + Gold/Silver/Copper)
  const backpackItems: (BlizzardInventoryItem | null)[] = [
    {
      id: 6948,
      name: "Hearthstone",
      quality: "COMMON",
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_rune_01.jpg",
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
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_potion_51.jpg",
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
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_potion_76.jpg",
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
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_food_03.jpg",
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
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_drink_07.jpg",
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
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_fabric_wool_01.jpg",
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
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_weapon_shortblade_01.jpg",
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
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_pick_02.jpg",
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
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_drink_10.jpg",
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
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_food_14.jpg",
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
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_ore_copper_01.jpg",
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
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_gem_pearl_01.jpg",
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
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_potion_76.jpg",
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
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_potion_53.jpg",
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
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_leatherscrap_02.jpg",
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
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_herb_blacklotus.jpg",
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
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/spell_shadow_requiem.jpg",
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
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_sword_39.jpg",
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
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_bag_08.jpg",
      slotCount: 14,
      bagSlotIndex: 1,
      items: bag1Items,
    },
    {
      id: 10002,
      name: "Mageweave Bag",
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_bag_10_blue.jpg",
      slotCount: 16,
      bagSlotIndex: 2,
      items: bag2Items,
    },
    {
      id: 10003,
      name: "Mooncloth Bag",
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_bag_10_red.jpg",
      slotCount: 16,
      bagSlotIndex: 3,
      items: bag3Items,
    },
    {
      id: 10004,
      name: "Netherweave Bag",
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_bag_20.jpg",
      slotCount: 18,
      bagSlotIndex: 4,
      items: bag4Items,
    },
  ];

  const inventory: BlizzardCharacterInventory = {
    backpack: {
      id: 0,
      name: "Backpack",
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_bag_08.jpg",
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
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/pvecurrency-justice.jpg",
        category: "Dungeon & Raid",
      },
      {
        id: 390,
        name: "Conquest Points",
        count: 780,
        max: 1800,
        iconUrl: rawFaction === "ALLIANCE" 
          ? "https://wow.zamimg.com/images/wow/icons/large/pvpcurrency-conquest-alliance.jpg"
          : "https://wow.zamimg.com/images/wow/icons/large/pvpcurrency-conquest-horde.jpg",
        category: "Player vs. Player",
      },
      {
        id: 392,
        name: "Honor Points",
        count: 3250,
        max: 4000,
        iconUrl: rawFaction === "ALLIANCE"
          ? "https://wow.zamimg.com/images/wow/icons/large/pvpcurrency-honor-alliance.jpg"
          : "https://wow.zamimg.com/images/wow/icons/large/pvpcurrency-honor-horde.jpg",
        category: "Player vs. Player",
      },
      {
        id: 1166,
        name: "Timewarped Badge",
        count: 620,
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/timelesscoin.jpg",
        category: "Timewalking",
      },
      {
        id: 515,
        name: "Darkmoon Prize Ticket",
        count: 45,
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_ticket_darkmoon_01.jpg",
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
    mounts: [
      {
        id: 54811,
        name: "Invincible's Reins",
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/ability_mount_pegasus.jpg",
        creatureDisplayId: 31505,
        mountType: "flying",
        source: "Drop: The Lich King (Heroic 25-man Icecrown Citadel)",
        description: "The beloved steed of Prince Arthas Menethil, resurrected in undeath.",
        isCollected: true,
        isFavorite: true,
        speedBonus: "+310% Flight Speed",
      },
      {
        id: 32458,
        name: "Ashes of Al'ar",
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_summerfest_braziergreen.jpg",
        creatureDisplayId: 21108,
        mountType: "flying",
        source: "Drop: Kael'thas Sunstrider (The Eye - Tempest Keep)",
        description: "Reborn from the holy fire of the Sun King.",
        isCollected: true,
        isFavorite: true,
        speedBonus: "+310% Flight Speed",
      },
      {
        id: 49284,
        name: "Swift Spectral Tiger",
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/ability_mount_spectraltiger.jpg",
        creatureDisplayId: 21974,
        mountType: "ground",
        source: "TCG: Fires of Outland / World Event",
        description: "A translucent feline stalker bound to the astral planes.",
        isCollected: true,
        isFavorite: true,
        speedBonus: "+100% Ground Speed",
      },
      {
        id: 45693,
        name: "Mimiron's Head",
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_enggizmos_03.jpg",
        creatureDisplayId: 28887,
        mountType: "flying",
        source: "Drop: Yogg-Saron (Alone in the Darkness 25-man Ulduar)",
        description: "The mechanical aerial marvel engineered by the Grand Architect.",
        isCollected: false,
        isFavorite: false,
        speedBonus: "+310% Flight Speed",
      },
      {
        id: 32768,
        name: "Reins of the Raven Lord",
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/ability_mount_cockatricemountelite_black.jpg",
        creatureDisplayId: 23149,
        mountType: "ground",
        source: "Drop: Anzu (Heroic Sethekk Halls)",
        description: "Tamed from the shadowy clutches of Terokk's inner sanctum.",
        isCollected: true,
        speedBonus: "+100% Ground Speed",
      },
      {
        id: 44151,
        name: "Time-Lost Proto-Drake",
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/ability_mount_drake_proto.jpg",
        creatureDisplayId: 26738,
        mountType: "flying",
        source: "Rare Spawn: Time-Lost Proto-Drake (The Storm Peaks)",
        description: "A beast displaced from time itself, soaring through Northrend.",
        isCollected: false,
        speedBonus: "+280% Flight Speed",
      },
      {
        id: 33809,
        name: "Amani War Bear",
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/ability_mount_polarbear_black.jpg",
        creatureDisplayId: 23537,
        mountType: "ground",
        source: "Timed Quest Reward: Zul'Aman (Level 70 Classic)",
        description: "A fierce battle bear adorned in the ceremonial armor of the forest trolls.",
        isCollected: true,
        speedBonus: "+100% Ground Speed",
      },
      {
        id: 35513,
        name: "Swift White Hawkstrider",
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/ability_mount_cockatricemountelite_white.jpg",
        creatureDisplayId: 25412,
        mountType: "ground",
        source: "Drop: Kael'thas Sunstrider (Magisters' Terrace)",
        description: "The pristine personal mount bred in the Sunstrider grounds.",
        isCollected: false,
        speedBonus: "+100% Ground Speed",
      },
      {
        id: 87771,
        name: "Reins of the Onyx Cloud Serpent",
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_pandarenserpentmount_blue.jpg",
        creatureDisplayId: 44249,
        mountType: "flying",
        source: "Quest: Surprise Attack! (Shado-Pan Exalted - Pandaria)",
        description: "Trained under the watchful discipline of the Shado-Pan masters.",
        isCollected: true,
        speedBonus: "+310% Flight Speed",
      },
      {
        id: 196883,
        name: "Highland Drake",
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_drakemount_red.jpg",
        creatureDisplayId: 104231,
        mountType: "dragonriding",
        source: "Dragon Isles: Ohn'ahran Plains",
        description: "A stalwart companion adapted for dynamic Dragonriding aerial maneuvers.",
        isCollected: false,
        speedBonus: "+830% Dragonriding Speed",
      },
    ],
    toys: [
      {
        id: 19970,
        name: "Super Simian Sphere",
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_monsterclaw_04.jpg",
        source: "World Drop: Northrend",
        description: "Encase yourself in a glowing purple bubble as an armored gorilla.",
        cooldown: "1 hr cooldown",
        isCollected: true,
        isFavorite: true,
      },
      {
        id: 35275,
        name: "Orb of the Sin'dorei",
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_gem_bloodstone_02.jpg",
        source: "Drop: Magisters' Terrace Bosses",
        description: "Transforms the user into a Blood Elf for 5 min.",
        cooldown: "30 min cooldown",
        isCollected: true,
        isFavorite: true,
      },
      {
        id: 43499,
        name: "Iron Boot Flask",
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_potion_14.jpg",
        source: "Vendor: Olrun the Scribe (Storm Peaks)",
        description: "Transforms you into an Iron Dwarf for 10 min.",
        cooldown: "1 hr cooldown",
        isCollected: true,
      },
      {
        id: 65357,
        name: "Rainbow Generator",
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_gem_opal_03.jpg",
        source: "Quest: Open Their Eyes (Felwood)",
        description: "Shoot a vibrant beam of pure rainbow light toward your target.",
        cooldown: "10 min cooldown",
        isCollected: false,
      },
      {
        id: 119215,
        name: "Hearthstone Game Board",
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_rune_01.jpg",
        source: "Promotion: Hearthstone",
        description: "Place an interactive wooden tavern gaming board on the ground.",
        cooldown: "15 min cooldown",
        isCollected: false,
      },
    ],
    pets: [
      {
        id: 844,
        name: "Lil' Ragnaros",
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_head_dragon_bronze.jpg",
        family: "Elemental",
        level: 25,
        quality: "RARE",
        source: "Blizzard Pet Store",
        abilities: ["Magma Wave", "Conflagrate", "Sons of the Flame"],
        isCollected: true,
        isFavorite: true,
        creatureDisplayId: 35122,
      },
      {
        id: 722,
        name: "Celestial Dragon",
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/ability_mount_celestialhorse.jpg",
        family: "Dragonkin",
        level: 25,
        quality: "RARE",
        source: "Achievement: Menagerie Mogul",
        abilities: ["Flamethrower", "Roar", "Ancient Blessing"],
        isCollected: false,
        isFavorite: true,
        creatureDisplayId: 30880,
      },
      {
        id: 1152,
        name: "Anubisath Idol",
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_idol_01.jpg",
        family: "Humanoid",
        level: 25,
        quality: "RARE",
        source: "Drop: Twin Emperors (Temple of Ahn'Qiraj)",
        abilities: ["Crush", "Sandstorm", "Deflection"],
        isCollected: true,
        isFavorite: true,
        creatureDisplayId: 21975,
      },
      {
        id: 1153,
        name: "Chrominius",
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_head_dragon_black.jpg",
        family: "Dragonkin",
        level: 25,
        quality: "RARE",
        source: "Drop: Chromaggus (Blackwing Lair)",
        abilities: ["Bite", "Howl", "Surge of Power"],
        isCollected: false,
        creatureDisplayId: 19445,
      },
      {
        id: 345,
        name: "Phoenix Hatchling",
        iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_egg_03.jpg",
        family: "Flying",
        level: 25,
        quality: "RARE",
        source: "Drop: Kael'thas Sunstrider (Magisters' Terrace)",
        abilities: ["Peck", "Immolate", "Cauterize"],
        isCollected: false,
        creatureDisplayId: 23146,
      },
    ],
    titles: [
      {
        id: 144,
        name: "the Kingslayer",
        titleFormat: "%s the Kingslayer",
        source: "Achievement: The Frozen Throne (Defeat the Lich King)",
        isCurrent: true,
        isCollected: true,
      },
      {
        id: 53,
        name: "Champion of the Naaru",
        titleFormat: "Champion of the Naaru %s",
        source: "Legacy Quest: The Key to the Tempest Keep (Burning Crusade)",
        isCollected: true,
      },
      {
        id: 64,
        name: "Hand of A'dal",
        titleFormat: "Hand of A'dal %s",
        source: "Legacy Quest: The Vials of Eternity (Black Temple Attunement)",
        isCollected: true,
      },
      {
        id: 140,
        name: "the Undying",
        titleFormat: "%s the Undying",
        source: "Achievement: The Undying (Naxxramas without a single death)",
        isCollected: false,
      },
      {
        id: 141,
        name: "the Lightbringer",
        titleFormat: "%s the Lightbringer",
        source: "Order Hall / Argent Crusade",
        isCollected: false,
      },
      {
        id: 168,
        name: "Herald of the Titans",
        titleFormat: "Herald of the Titans %s",
        source: "Achievement: Defeat Algalon the Observer in era gear",
        isCollected: false,
      },
      {
        id: 133,
        name: "Starcaller",
        titleFormat: "Starcaller %s",
        source: "Achievement: Defeat Algalon in 10-player Ulduar",
        isCollected: false,
      },
      {
        id: 169,
        name: "Grand Crusader",
        titleFormat: "Grand Crusader %s",
        source: "Achievement: Trial of the Grand Crusader 50 attempts remaining",
      },
    ],
    totalMountsCount: 382,
    totalToysCount: 164,
    totalPetsCount: 512,
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
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/achievement_level_10.jpg",
    });
  }

  if (level >= 60) {
    achievements.push({
      id: 11,
      title: "Level 60",
      description: "Reach level 60 and triumph over the ancient trials of Azeroth.",
      points: 10,
      completedTimestamp: nowSec - 86400 * 45,
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/achievement_level_60.jpg",
    });
  }

  if (level >= 70) {
    achievements.push({
      id: 12,
      title: "Level 70",
      description: "Reach level 70 amid the shattered lands of Outland.",
      points: 10,
      completedTimestamp: nowSec - 86400 * 60,
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/achievement_level_70.jpg",
    });
  }

  if (level >= 90) {
    achievements.push({
      id: 14,
      title: "Level 90",
      description: "Reach level 90 across the mists of Pandaria.",
      points: 10,
      completedTimestamp: nowSec - 86400 * 80,
      iconUrl: "https://wow.zamimg.com/images/wow/icons/large/achievement_level_90.jpg",
    });
  }

  achievements.push({
    id: 628,
    title: "Classic Dungeonmaster",
    description: "Complete the classic dungeons of Azeroth.",
    points: 15,
    completedTimestamp: nowSec - 86400 * 8,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/achievement_dungeon_classicdungeonmaster.jpg",
  });

  achievements.push({
    id: 844,
    title: rawFaction === "ALLIANCE" ? "Explore Kalimdor & Teldrassil" : "Explore Kalimdor & Durotar",
    description: "Explore all areas and outposts of your race's starting lands.",
    points: 10,
    completedTimestamp: nowSec - 86400 * 20,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/achievement_zone_kalimdor_01.jpg",
  });

  achievements.push({
    id: 504,
    title: "50 Quests Completed",
    description: "Complete 50 quests aiding the people of Azeroth.",
    points: 10,
    completedTimestamp: nowSec - 86400 * 3,
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/achievement_quests_completed_01.jpg",
  });

  const totalAchievePts =
    achievements.reduce((sum, a) => sum + (a.points || 0), 0) +
    (level <= 20 ? 120 : level <= 60 ? 2450 : level <= 70 ? 5800 : level <= 90 ? 12500 : 18500);

  const raceInfo = getWoWRaceInfo(options.race || (rawFaction === "ALLIANCE" ? "Night Elf" : "Orc"), gender);
  const classInfo = getWoWClassInfo(normalizedClass);
  const finalAvatar = options.avatarUrl || options.characterSummary?.avatarUrl || raceInfo.iconUrl || classInfo.iconUrl;
  const finalRender = options.renderUrl || options.characterSummary?.renderUrl || "";

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
    lastSyncedAt: new Date().toISOString(),
  };
}
