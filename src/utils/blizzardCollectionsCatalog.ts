/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BlizzardCollectionMount,
  BlizzardCollectionPet,
  BlizzardCollectionToy,
  BlizzardCollectionTitle,
} from "../types";
import {
  WOW_MOUNT_ID_TO_DISPLAY,
  WOW_MOUNT_NAME_TO_DISPLAY,
  WOW_PET_ID_TO_DISPLAY,
  WOW_PET_NAME_TO_DISPLAY,
  WOW_PET_CREATURE_TO_SPECIES,
} from "./blizzardMountDb";
import { getCachedDisplayIdSync } from "./blizzardAssetCache";
import { resolveMountIds, resolvePetCreatureId } from "./wowheadUrls";

const WOW_ICON_BASE = "https://render.worldofwarcraft.com/us/icons/56";

export const OFFICIAL_MOUNTS_CATALOG: BlizzardCollectionMount[] = [
  {
    id: 54811,
    name: "Invincible's Reins",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_pegasus.jpg`,
    creatureDisplayId: 31007,
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
    iconUrl: `${WOW_ICON_BASE}/inv_misc_summerfest_brazierorange.jpg`,
    creatureDisplayId: 17890,
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
    iconUrl: `${WOW_ICON_BASE}/ability_mount_spectraltiger.jpg`,
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
    iconUrl: `${WOW_ICON_BASE}/inv_misc_enggizmos_03.jpg`,
    creatureDisplayId: 28890,
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
    iconUrl: `${WOW_ICON_BASE}/ability_mount_cockatricemountelite_black.jpg`,
    creatureDisplayId: 21473,
    mountType: "ground",
    source: "Drop: Anzu (Heroic Sethekk Halls)",
    description: "Tamed from the shadowy clutches of Terokk's inner sanctum.",
    isCollected: true,
    speedBonus: "+100% Ground Speed",
  },
  {
    id: 44151,
    name: "Time-Lost Proto-Drake",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_drake_proto.jpg`,
    creatureDisplayId: 28045,
    mountType: "flying",
    source: "Rare Spawn: Time-Lost Proto-Drake (The Storm Peaks)",
    description: "A beast displaced from time itself, soaring through Northrend.",
    isCollected: false,
    speedBonus: "+280% Flight Speed",
  },
  {
    id: 33809,
    name: "Amani War Bear",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_polarbear_black.jpg`,
    creatureDisplayId: 22464,
    mountType: "ground",
    source: "Timed Quest Reward: Zul'Aman (Level 70 Classic)",
    description: "A fierce battle bear adorned in the ceremonial armor of the forest trolls.",
    isCollected: true,
    speedBonus: "+100% Ground Speed",
  },
  {
    id: 35513,
    name: "Swift White Hawkstrider",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_cockatricemountelite_white.jpg`,
    creatureDisplayId: 19483,
    mountType: "ground",
    source: "Drop: Kael'thas Sunstrider (Magisters' Terrace)",
    description: "The pristine personal mount bred in the Sunstrider grounds.",
    isCollected: false,
    speedBonus: "+100% Ground Speed",
  },
  {
    id: 87771,
    name: "Reins of the Onyx Cloud Serpent",
    iconUrl: `${WOW_ICON_BASE}/inv_pandarenserpentmount_blue.jpg`,
    creatureDisplayId: 41990,
    mountType: "flying",
    source: "Quest: Surprise Attack! (Shado-Pan Exalted - Pandaria)",
    description: "Trained under the watchful discipline of the Shado-Pan masters.",
    isCollected: true,
    speedBonus: "+310% Flight Speed",
  },
  {
    id: 196883,
    name: "Highland Drake",
    iconUrl: `${WOW_ICON_BASE}/inv_drakemount_red.jpg`,
    creatureDisplayId: 112828,
    mountType: "dragonriding",
    source: "Dragon Isles: Ohn'ahran Plains",
    description: "A stalwart companion adapted for dynamic Dragonriding aerial maneuvers.",
    isCollected: false,
    speedBonus: "+830% Dragonriding Speed",
  },
  {
    id: 30480,
    name: "Fiery Warhorse's Reins",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_nightmarehorse.jpg`,
    creatureDisplayId: 19250,
    mountType: "ground",
    source: "Drop: Attumen the Huntsman (Karazhan)",
    description: "Midnight's fierce spectral incarnation.",
    isCollected: true,
    speedBonus: "+100% Ground Speed",
  },
  {
    id: 13335,
    name: "Deathcharger's Reins",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_undeadhorse.jpg`,
    creatureDisplayId: 10718,
    mountType: "ground",
    source: "Drop: Lord Aurius Rivendare (Stratholme)",
    description: "The dread steed of the Baron of Stratholme.",
    isCollected: false,
    speedBonus: "+100% Ground Speed",
  },
  {
    id: 43952,
    name: "Azure Drake",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_drake_azure.jpg`,
    creatureDisplayId: 27785,
    mountType: "flying",
    source: "Drop: Malygos (Eye of Eternity)",
    description: "Infused with the arcane essence of the Blue Dragonflight.",
    isCollected: true,
    speedBonus: "+310% Flight Speed",
  },
  {
    id: 49290,
    name: "Magic Rooster",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_cockatricemount.jpg`,
    creatureDisplayId: 29379,
    mountType: "ground",
    source: "TCG: Fields of Honor",
    description: "A colossal, colorful rooster bred for speed and amusement.",
    isCollected: false,
    speedBonus: "+100% Ground Speed",
  },
  {
    id: 37012,
    name: "The Headless Horseman's Mount",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_nightmarehorse.jpg`,
    creatureDisplayId: 22624,
    mountType: "flying",
    source: "Holiday: Hallow's End (Loot-Filled Pumpkin)",
    description: "Flies through the nocturnal skies leaving a trail of spectral embers.",
    isCollected: true,
    speedBonus: "+310% Flight Speed",
  },
  {
    id: 44177,
    name: "Ironbound Proto-Drake",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_drake_proto.jpg`,
    creatureDisplayId: 28953,
    mountType: "flying",
    source: "Achievement: Glory of the Ulduar Raider (25 player)",
    description: "Reinforced with titan plating from the Forge of Wills.",
    isCollected: true,
    speedBonus: "+310% Flight Speed",
  },
  {
    id: 44178,
    name: "Rusted Proto-Drake",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_drake_proto.jpg`,
    creatureDisplayId: 28954,
    mountType: "flying",
    source: "Achievement: Glory of the Ulduar Raider (10 player)",
    description: "A resilient proto-drake seasoned by centuries in Ulduar.",
    isCollected: true,
    speedBonus: "+310% Flight Speed",
  },
  {
    id: 44164,
    name: "Blue Proto-Drake",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_drake_proto.jpg`,
    creatureDisplayId: 28041,
    mountType: "flying",
    source: "Drop: Skadi the Ruthless (Utgarde Pinnacle Heroic)",
    description: "Bred in the freezing peaks of Utgarde.",
    isCollected: false,
    speedBonus: "+280% Flight Speed",
  },
  // Classic & Standard Racial Mounts
  {
    id: 6,
    name: "Brown Horse",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_ridinghorse.jpg`,
    creatureDisplayId: 2404,
    mountType: "ground",
    source: "Vendor: Katie Hunter (Eastvale Logging Camp, Elwynn Forest)",
    description: "A faithful and hardy steed bred in the hills of Elwynn.",
    isCollected: true,
    speedBonus: "+60% Ground Speed",
  },
  {
    id: 18,
    name: "Chestnut Mare",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_ridinghorse.jpg`,
    creatureDisplayId: 2405,
    mountType: "ground",
    source: "Vendor: Katie Hunter (Eastvale Logging Camp, Elwynn Forest)",
    description: "A swift chestnut-colored mare favored by Stormwind travelers.",
    isCollected: true,
    speedBonus: "+60% Ground Speed",
  },
  {
    id: 11,
    name: "Pinto",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_ridinghorse.jpg`,
    creatureDisplayId: 2409,
    mountType: "ground",
    source: "Vendor: Katie Hunter (Eastvale Logging Camp, Elwynn Forest)",
    description: "A distinctive piebald pinto horse from the farms of Westfall.",
    isCollected: true,
    speedBonus: "+60% Ground Speed",
  },
  {
    id: 9,
    name: "Black Stallion",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_ridinghorse.jpg`,
    creatureDisplayId: 2402,
    mountType: "ground",
    source: "Vendor: Katie Hunter (Eastvale Logging Camp, Elwynn Forest)",
    description: "A sleek, midnight-coated stallion with remarkable stamina.",
    isCollected: true,
    speedBonus: "+60% Ground Speed",
  },
  {
    id: 8,
    name: "White Stallion",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_ridinghorse.jpg`,
    creatureDisplayId: 2410,
    mountType: "ground",
    source: "Vendor: Katie Hunter (Eastvale Logging Camp, Elwynn Forest)",
    description: "A majestic pure-white steed revered across the Alliance.",
    isCollected: true,
    speedBonus: "+60% Ground Speed",
  },
  {
    id: 52,
    name: "Palomino",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_ridinghorse.jpg`,
    creatureDisplayId: 2408,
    mountType: "ground",
    source: "Vendor: Katie Hunter (Eastvale Logging Camp, Elwynn Forest)",
    description: "A golden-coated horse with a brilliant white mane.",
    isCollected: true,
    speedBonus: "+60% Ground Speed",
  },
  {
    id: 435,
    name: "Mountain Horse",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_mountainhorse.jpg`,
    creatureDisplayId: 39096,
    mountType: "ground",
    source: "Vendor: Astrid Langstrump (Darnassus)",
    description: "Bred in the rugged highlands of Gilneas.",
    isCollected: true,
    speedBonus: "+60% Ground Speed",
  },
  {
    id: 65,
    name: "Red Skeletal Horse",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_undeadhorse.jpg`,
    creatureDisplayId: 10670,
    mountType: "ground",
    source: "Vendor: Zachariah Post (Brill, Tirisfal Glades)",
    description: "A reanimated war steed loyal only to the Forsaken.",
    isCollected: true,
    speedBonus: "+60% Ground Speed",
  },
  {
    id: 66,
    name: "Blue Skeletal Horse",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_undeadhorse.jpg`,
    creatureDisplayId: 10671,
    mountType: "ground",
    source: "Vendor: Zachariah Post (Brill, Tirisfal Glades)",
    description: "Infused with cold undeath, traversing the battlefields tirelessly.",
    isCollected: true,
    speedBonus: "+60% Ground Speed",
  },
  {
    id: 20,
    name: "Brown Wolf",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_blackdirewolf.jpg`,
    creatureDisplayId: 2328,
    mountType: "ground",
    source: "Vendor: Ogunaro Wolfrunner (Orgrimmar)",
    description: "The classic mount of the Orcish warriors of Durotar.",
    isCollected: true,
    speedBonus: "+60% Ground Speed",
  },
  {
    id: 19,
    name: "Timber Wolf",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_blackdirewolf.jpg`,
    creatureDisplayId: 247,
    mountType: "ground",
    source: "Vendor: Ogunaro Wolfrunner (Orgrimmar)",
    description: "A ferocious predator trained from birth to battle alongside the Horde.",
    isCollected: true,
    speedBonus: "+60% Ground Speed",
  },
  {
    id: 25,
    name: "Brown Ram",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_mountainram.jpg`,
    creatureDisplayId: 2785,
    mountType: "ground",
    source: "Vendor: Veron Amberstill (Amberstill Ranch, Dun Morogh)",
    description: "The sturdy mountain ram of the Ironforge Dwarves.",
    isCollected: true,
    speedBonus: "+60% Ground Speed",
  },
  {
    id: 26,
    name: "Gray Ram",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_mountainram.jpg`,
    creatureDisplayId: 2736,
    mountType: "ground",
    source: "Vendor: Veron Amberstill (Amberstill Ranch, Dun Morogh)",
    description: "Sure-footed and fearless across the steepest cliffs of Khaz Modan.",
    isCollected: true,
    speedBonus: "+60% Ground Speed",
  },
  {
    id: 15,
    name: "Striped Nightsaber",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_jungletiger.jpg`,
    creatureDisplayId: 6448,
    mountType: "ground",
    source: "Vendor: Lelanai (Darnassus)",
    description: "A silent nocturnal hunter blessed by the goddess Elune.",
    isCollected: true,
    speedBonus: "+60% Ground Speed",
  },
  {
    id: 42,
    name: "Swift Frostsaber",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_whitedirewolf.jpg`,
    creatureDisplayId: 14331,
    mountType: "ground",
    source: "Vendor: Lelanai (Darnassus)",
    description: "A blindingly fast white saber trained in the snows of Winterspring.",
    isCollected: true,
    speedBonus: "+100% Ground Speed",
  },
  {
    id: 72,
    name: "Brown Kodo",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_kodo_01.jpg`,
    creatureDisplayId: 11641,
    mountType: "ground",
    source: "Vendor: Harb Clawhoof (Bloodhoof Village, Mulgore)",
    description: "The massive beast of burden revered by the Tauren tribes.",
    isCollected: true,
    speedBonus: "+60% Ground Speed",
  },
  {
    id: 73,
    name: "Gray Kodo",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_kodo_01.jpg`,
    creatureDisplayId: 12246,
    mountType: "ground",
    source: "Vendor: Harb Clawhoof (Bloodhoof Village, Mulgore)",
    description: "Unstoppable endurance across the great plains of Kalimdor.",
    isCollected: true,
    speedBonus: "+60% Ground Speed",
  },
  {
    id: 34,
    name: "Blue Mechanostrider",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_mecha_blue.jpg`,
    creatureDisplayId: 6569,
    mountType: "ground",
    source: "Vendor: Milli Featherwhistle (Steelgrill's Depot, Dun Morogh)",
    description: "The pinnacle of Gnomish vehicular clockwork engineering.",
    isCollected: true,
    speedBonus: "+60% Ground Speed",
  },
  {
    id: 30,
    name: "Emerald Raptor",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_raptor.jpg`,
    creatureDisplayId: 4806,
    mountType: "ground",
    source: "Vendor: Xar'Ti (Sen'jin Village, Durotar)",
    description: "A cunning jungle raptor trained by Darkspear beastmasters.",
    isCollected: true,
    speedBonus: "+60% Ground Speed",
  },
  {
    id: 153,
    name: "Red Hawkstrider",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_cockatricemount_purple.jpg`,
    creatureDisplayId: 18696,
    mountType: "ground",
    source: "Vendor: Winaestra (Falconwing Square, Eversong Woods)",
    description: "The graceful avian mount of the Sin'dorei.",
    isCollected: true,
    speedBonus: "+60% Ground Speed",
  },
  {
    id: 147,
    name: "Brown Elekk",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_ridingelekk.jpg`,
    creatureDisplayId: 17063,
    mountType: "ground",
    source: "Vendor: Torallius the Pack Handler (Exodar)",
    description: "The mighty companion of the Draenei across worlds.",
    isCollected: true,
    speedBonus: "+60% Ground Speed",
  },
  {
    id: 182,
    name: "Ebon Gryphon",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_gryphon_01.jpg`,
    creatureDisplayId: 17694,
    mountType: "flying",
    source: "Vendor: Brunn Flamebeard (Wildhammer Stronghold, Shadowmoon Valley)",
    description: "The classic flying mount of the Alliance heroes.",
    isCollected: true,
    speedBonus: "+150% Flight Speed",
  },
  {
    id: 181,
    name: "Golden Gryphon",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_gryphon_01.jpg`,
    creatureDisplayId: 17697,
    mountType: "flying",
    source: "Vendor: Brunn Flamebeard (Wildhammer Stronghold, Shadowmoon Valley)",
    description: "Soars through the Outland skies with resolute pride.",
    isCollected: true,
    speedBonus: "+150% Flight Speed",
  },
  {
    id: 183,
    name: "Tawny Wind Rider",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_wyvern_01.jpg`,
    creatureDisplayId: 17699,
    mountType: "flying",
    source: "Vendor: Dama Wildmane (Shadowmoon Village, Shadowmoon Valley)",
    description: "The classic flying wyvern of the Horde vanguard.",
    isCollected: true,
    speedBonus: "+150% Flight Speed",
  },
  {
    id: 184,
    name: "Blue Wind Rider",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_wyvern_01.jpg`,
    creatureDisplayId: 17700,
    mountType: "flying",
    source: "Vendor: Dama Wildmane (Shadowmoon Village, Shadowmoon Valley)",
    description: "Strong wings and razor talons soaring across the fractured realm.",
    isCollected: true,
    speedBonus: "+150% Flight Speed",
  },
  {
    id: 247,
    name: "Bronze Drake",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_drake_bronze.jpg`,
    creatureDisplayId: 25833,
    mountType: "flying",
    source: "Drop: Infinite Corruptor (Culling of Stratholme Heroic)",
    description: "Tamed guardian of the Caverns of Time.",
    isCollected: true,
    speedBonus: "+280% Flight Speed",
  },
  {
    id: 246,
    name: "Red Drake",
    iconUrl: `${WOW_ICON_BASE}/ability_mount_drake_red.jpg`,
    creatureDisplayId: 25835,
    mountType: "flying",
    source: "Vendor: Cielstrasza (Wyrmrest Accord Exalted)",
    description: "Bound by the warmth and life of Alexstrasza's flight.",
    isCollected: true,
    speedBonus: "+280% Flight Speed",
  },
];

export const OFFICIAL_PETS_CATALOG: BlizzardCollectionPet[] = [
  {
    id: 297,
    name: "Lil' Ragnaros",
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/254652.jpg",
    creatureDisplayId: 37541,
    family: "Elemental",
    level: 25,
    quality: "RARE",
    source: "Blizzard Pet Store",
    abilities: ["Magma Wave", "Conflagrate", "Sons of the Flame"],
    isCollected: true,
    isFavorite: true,
  },
  {
    id: 722,
    name: "Celestial Dragon",
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/368365.jpg",
    creatureDisplayId: 30880,
    family: "Dragonkin",
    level: 25,
    quality: "RARE",
    source: "Achievement: Menagerie Mogul",
    abilities: ["Flamethrower", "Roar", "Ancient Blessing"],
    isCollected: false,
    isFavorite: true,
  },
  {
    id: 1155,
    name: "Anubisath Idol",
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/134908.jpg",
    creatureDisplayId: 46922,
    family: "Humanoid",
    level: 25,
    quality: "RARE",
    source: "Drop: Twin Emperors (Temple of Ahn'Qiraj)",
    abilities: ["Crush", "Sandstorm", "Deflection"],
    isCollected: true,
    isFavorite: true,
  },
  {
    id: 1152,
    name: "Chrominius",
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/377270.jpg",
    creatureDisplayId: 46925,
    family: "Dragonkin",
    level: 25,
    quality: "RARE",
    source: "Drop: Chromaggus (Blackwing Lair)",
    abilities: ["Bite", "Howl", "Surge of Power"],
    isCollected: false,
  },
  {
    id: 175,
    name: "Phoenix Hatchling",
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/134373.jpg",
    creatureDisplayId: 23574,
    family: "Flying",
    level: 25,
    quality: "RARE",
    source: "Drop: Kael'thas Sunstrider (Magisters' Terrace)",
    abilities: ["Peck", "Immolate", "Cauterize"],
    isCollected: false,
  },
  {
    id: 1451,
    name: "Molten Corgi",
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/1044792.jpg",
    creatureDisplayId: 58570,
    family: "Beast",
    level: 25,
    quality: "RARE",
    source: "10th Anniversary Event",
    abilities: ["Bark", "Puppy Love", "Flamethrower"],
    isCollected: true,
    isFavorite: true,
  },
  {
    id: 18,
    name: "Murky",
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/656556.jpg",
    creatureDisplayId: 16183,
    family: "Humanoid",
    level: 25,
    quality: "RARE",
    source: "BlizzCon Event",
    abilities: ["Punch", "Acid Touch", "Stampede"],
    isCollected: true,
  },
  {
    id: 855,
    name: "Pandaren Water Spirit",
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/656560.jpg",
    creatureDisplayId: 45195,
    family: "Elemental",
    level: 25,
    quality: "RARE",
    source: "Quest: Pandaren Spirit Tamer",
    abilities: ["Water Jet", "Healing Wave", "Whirlpool"],
    isCollected: true,
  },
  {
    id: 1387,
    name: "Iron Starlette",
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/892829.jpg",
    creatureDisplayId: 53748,
    family: "Mechanical",
    level: 25,
    quality: "RARE",
    source: "Quest: Iron Horde Invasion",
    abilities: ["Wind-Up", "Powerball", "Supercharge"],
    isCollected: true,
  },
  {
    id: 1238,
    name: "Unborn Val'kyr",
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/851119.jpg",
    creatureDisplayId: 48650,
    family: "Undead",
    level: 25,
    quality: "RARE",
    source: "Wild Pet: Northrend",
    abilities: ["Shadow Slash", "Curse of Doom", "Haunt"],
    isCollected: true,
  },
  {
    id: 1148,
    name: "Soul of the Aspects",
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/574806.jpg",
    creatureDisplayId: 39597,
    family: "Dragonkin",
    level: 25,
    quality: "RARE",
    source: "Blizzard Pet Store",
    abilities: ["Claw", "Deflection", "Surge of Light"],
    isCollected: true,
  },
  {
    id: 1950,
    name: "Mischief",
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/1411879.jpg",
    creatureDisplayId: 74211,
    family: "Beast",
    level: 25,
    quality: "RARE",
    source: "Blizzard Shop / Make-A-Wish",
    abilities: ["Fel Breath", "Prowl", "Chaos Blaze"],
    isCollected: true,
  },
  {
    id: 39,
    name: "Mechanical Squirrel",
    iconUrl: `${WOW_ICON_BASE}/inv_misc_pet_squirrel_mechanical.jpg`,
    creatureDisplayId: 7937,
    family: "Mechanical",
    level: 25,
    quality: "RARE",
    source: "Engineering: Schematic: Mechanical Squirrel",
    abilities: ["Metal Fist", "Overtune", "Wind-Up"],
    isCollected: true,
  },
  {
    id: 258,
    name: "Mini Thor",
    iconUrl: `${WOW_ICON_BASE}/inv_misc_monsterclaw_04.jpg`,
    creatureDisplayId: 32670,
    family: "Mechanical",
    level: 25,
    quality: "RARE",
    source: "Promotion: StarCraft II: Wings of Liberty Collector's Edition",
    abilities: ["Missile Barrage", "Minefield", "Launch"],
    isCollected: true,
    isFavorite: true,
  },
  {
    id: 844,
    name: "Mechanical Pandaren Dragonling",
    iconUrl: `${WOW_ICON_BASE}/inv_pet_pandarendragon.jpg`,
    creatureDisplayId: 45386,
    family: "Mechanical",
    level: 25,
    quality: "RARE",
    source: "Engineering: Pandaria",
    abilities: ["Breath", "Bombing Run", "Decoy"],
    isCollected: true,
    isFavorite: true,
  },
];

export const OFFICIAL_TOYS_CATALOG: BlizzardCollectionToy[] = [
  {
    id: 19970,
    name: "Super Simian Sphere",
    iconUrl: `${WOW_ICON_BASE}/inv_misc_monsterclaw_04.jpg`,
    source: "World Drop: Northrend",
    description: "Encase yourself in a glowing purple bubble as an armored gorilla.",
    cooldown: "1 hr cooldown",
    isCollected: true,
    isFavorite: true,
  },
  {
    id: 35275,
    name: "Orb of the Sin'dorei",
    iconUrl: `${WOW_ICON_BASE}/inv_misc_gem_bloodstone_02.jpg`,
    source: "Drop: Magisters' Terrace Bosses",
    description: "Transforms the user into a Blood Elf for 5 min.",
    cooldown: "30 min cooldown",
    isCollected: true,
    isFavorite: true,
  },
  {
    id: 43499,
    name: "Iron Boot Flask",
    iconUrl: `${WOW_ICON_BASE}/inv_potion_14.jpg`,
    source: "Vendor: Olrun the Scribe (Storm Peaks)",
    description: "Transforms you into an Iron Dwarf for 10 min.",
    cooldown: "1 hr cooldown",
    isCollected: true,
  },
  {
    id: 65357,
    name: "Rainbow Generator",
    iconUrl: `${WOW_ICON_BASE}/inv_misc_gem_opal_03.jpg`,
    source: "Quest: Open Their Eyes (Felwood)",
    description: "Shoot a vibrant beam of pure rainbow light toward your target.",
    cooldown: "10 min cooldown",
    isCollected: false,
  },
  {
    id: 119215,
    name: "Hearthstone Game Board",
    iconUrl: `${WOW_ICON_BASE}/inv_misc_rune_01.jpg`,
    source: "Promotion: Hearthstone",
    description: "Place an interactive wooden tavern gaming board on the ground.",
    cooldown: "15 min cooldown",
    isCollected: false,
  },
];

export const OFFICIAL_TITLES_CATALOG: BlizzardCollectionTitle[] = [
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
];

/**
 * Intelligently resolves official icon, 3D creatureDisplayId, and metadata for ANY mount
 */
export function resolveMountInfo(mount: Partial<BlizzardCollectionMount>): BlizzardCollectionMount {
  const name = mount.name || "Official Mount";
  const normName = name.toLowerCase().replace(/[^a-z0-9]/g, "");

  // 1. Authoritative ID-First Match from Blizzard DB2
  let resolvedDisplayId = 0;
  if (mount.id && WOW_MOUNT_ID_TO_DISPLAY[mount.id]) {
    resolvedDisplayId = WOW_MOUNT_ID_TO_DISPLAY[mount.id];
  }
  if (!resolvedDisplayId && WOW_MOUNT_NAME_TO_DISPLAY[normName]) {
    resolvedDisplayId = WOW_MOUNT_NAME_TO_DISPLAY[normName];
  }

  // 2. Direct match in catalogue
  const exact = OFFICIAL_MOUNTS_CATALOG.find(
    (m) =>
      (mount.id && m.id === mount.id) ||
      m.name.toLowerCase().replace(/['\s-_]/g, "") === normName
  );

  const mountSpellAndItem = resolveMountIds({
    id: mount.id,
    name: mount.name,
    itemId: mount.itemId,
    spellId: mount.spellId,
  });

  if (exact) {
    return {
      ...exact,
      ...mount,
      spellId: mount.spellId || exact.spellId || mountSpellAndItem.spellId,
      itemId: mount.itemId || exact.itemId || mountSpellAndItem.itemId || exact.id,
      iconUrl: exact.iconUrl,
      creatureDisplayId: resolvedDisplayId || exact.creatureDisplayId,
      mountType: exact.mountType,
      speedBonus: exact.speedBonus,
      description: mount.description || exact.description,
      source: mount.source || exact.source,
      isCollected: mount.isCollected !== undefined ? mount.isCollected : exact.isCollected,
      isFavorite: mount.isFavorite !== undefined ? mount.isFavorite : exact.isFavorite,
      isCharacterSpecific: mount.isCharacterSpecific,
      characterName: mount.characterName,
      characterRealm: mount.characterRealm,
      characterId: mount.characterId,
      unlockedAt: mount.unlockedAt,
      unlockOrder: mount.unlockOrder,
      rarity: mount.rarity,
    };
  }

  if (!resolvedDisplayId && mount.creatureDisplayId && mount.creatureDisplayId > 0) {
    resolvedDisplayId = mount.creatureDisplayId;
  }

  // 3. Keyword-based matching to official 3D creatureDisplayIds and authentic icons
  let resolvedIcon = mount.iconUrl && !mount.iconUrl.includes("ability_mount_ridinghorse") ? mount.iconUrl : `${WOW_ICON_BASE}/ability_mount_ridinghorse.jpg`;
  let resolvedType: "ground" | "flying" | "dragonriding" = (mount.mountType as any) || "ground";
  let speed = mount.speedBonus || "+100% Ground Speed";

  if (normName.includes("invincible") || normName.includes("invencivel")) {
    if (!resolvedDisplayId) resolvedDisplayId = 31505;
    resolvedIcon = `${WOW_ICON_BASE}/ability_mount_pegasus.jpg`;
    resolvedType = "flying";
    speed = "+310% Flight Speed";
  } else if (normName.includes("ashes") || normName.includes("cinzas") || normName.includes("alar")) {
    if (!resolvedDisplayId) resolvedDisplayId = 21108;
    resolvedIcon = `${WOW_ICON_BASE}/inv_misc_summerfest_brazierorange.jpg`;
    resolvedType = "flying";
    speed = "+310% Flight Speed";
  } else if (normName.includes("spectral") || normName.includes("espectral")) {
    if (!resolvedDisplayId) resolvedDisplayId = 21974;
    resolvedIcon = `${WOW_ICON_BASE}/ability_mount_spectraltiger.jpg`;
    resolvedType = "ground";
  } else if (normName.includes("mimiron") || normName.includes("head") || normName.includes("cabeca")) {
    if (!resolvedDisplayId) resolvedDisplayId = 28887;
    resolvedIcon = `${WOW_ICON_BASE}/inv_misc_enggizmos_03.jpg`;
    resolvedType = "flying";
    speed = "+310% Flight Speed";
  } else if (normName.includes("raven") || normName.includes("corvo") || normName.includes("anzu")) {
    if (!resolvedDisplayId) resolvedDisplayId = 23149;
    resolvedIcon = `${WOW_ICON_BASE}/ability_mount_cockatricemountelite_black.jpg`;
    resolvedType = "ground";
  } else if (normName.includes("proto") || normName.includes("timelost") || normName.includes("perdidonotempo")) {
    if (!resolvedDisplayId) resolvedDisplayId = 26738;
    resolvedIcon = `${WOW_ICON_BASE}/ability_mount_drake_proto.jpg`;
    resolvedType = "flying";
    speed = "+310% Flight Speed";
  } else if (normName.includes("bear") || normName.includes("urso") || normName.includes("amani")) {
    if (!resolvedDisplayId) resolvedDisplayId = 23537;
    resolvedIcon = `${WOW_ICON_BASE}/ability_mount_polarbear_black.jpg`;
    resolvedType = "ground";
  } else if (normName.includes("hawkstrider") || normName.includes("falcostruz")) {
    if (!resolvedDisplayId) resolvedDisplayId = 19472;
    resolvedIcon = `${WOW_ICON_BASE}/ability_mount_cockatricemount_purple.jpg`;
    resolvedType = "ground";
  } else if (normName.includes("serpent") || normName.includes("serpente")) {
    if (!resolvedDisplayId) resolvedDisplayId = 44249;
    resolvedIcon = `${WOW_ICON_BASE}/inv_pandarenserpentmount_blue.jpg`;
    resolvedType = "flying";
    speed = "+310% Flight Speed";
  } else if (normName.includes("dragonriding") || normName.includes("highland")) {
    if (!resolvedDisplayId) resolvedDisplayId = 104231;
    resolvedIcon = `${WOW_ICON_BASE}/inv_drakemount_red.jpg`;
    resolvedType = "dragonriding";
    speed = "+830% Dragonriding Speed";
  } else if (normName.includes("drake") || normName.includes("draco") || normName.includes("dragon") || normName.includes("dragao")) {
    if (!resolvedDisplayId) resolvedDisplayId = 24967;
    resolvedIcon = `${WOW_ICON_BASE}/ability_mount_drake_bronze.jpg`;
    resolvedType = "flying";
    speed = "+280% Flight Speed";
  } else if (normName.includes("warhorse") || normName.includes("attumen") || normName.includes("midnight") || normName.includes("meianoite")) {
    if (!resolvedDisplayId) resolvedDisplayId = 18174;
    resolvedIcon = `${WOW_ICON_BASE}/ability_mount_nightmarehorse.jpg`;
    resolvedType = "ground";
  } else if (normName.includes("deathcharger") || normName.includes("rivendare") || normName.includes("morte")) {
    if (!resolvedDisplayId) resolvedDisplayId = 10718;
    resolvedIcon = `${WOW_ICON_BASE}/ability_mount_undeadhorse.jpg`;
    resolvedType = "ground";
  } else if (normName.includes("rooster") || normName.includes("galo")) {
    if (!resolvedDisplayId) resolvedDisplayId = 28246;
    resolvedIcon = `${WOW_ICON_BASE}/ability_mount_cockatricemount.jpg`;
    resolvedType = "ground";
  } else if (normName.includes("wolf") || normName.includes("lobo") || normName.includes("howler")) {
    if (!resolvedDisplayId) resolvedDisplayId = 168;
    resolvedIcon = `${WOW_ICON_BASE}/ability_mount_blackdirewolf.jpg`;
    resolvedType = "ground";
  } else if (normName.includes("ram") || normName.includes("carneiro")) {
    if (!resolvedDisplayId) resolvedDisplayId = 2784;
    resolvedIcon = `${WOW_ICON_BASE}/ability_mount_mountainram.jpg`;
    resolvedType = "ground";
  } else if (normName.includes("tiger") || normName.includes("saber") || normName.includes("panther") || normName.includes("nightsaber") || normName.includes("leopard")) {
    if (!resolvedDisplayId) resolvedDisplayId = 14582;
    resolvedIcon = `${WOW_ICON_BASE}/ability_mount_jungletiger.jpg`;
    resolvedType = "ground";
  } else if (normName.includes("kodo")) {
    if (!resolvedDisplayId) resolvedDisplayId = 11641;
    resolvedIcon = `${WOW_ICON_BASE}/ability_mount_kodo_01.jpg`;
    resolvedType = "ground";
  } else if (normName.includes("mecha") || normName.includes("strider") || normName.includes("mechanostrider")) {
    if (!resolvedDisplayId) resolvedDisplayId = 6569;
    resolvedIcon = `${WOW_ICON_BASE}/ability_mount_mecha_blue.jpg`;
    resolvedType = "ground";
  } else if (normName.includes("raptor")) {
    if (!resolvedDisplayId) resolvedDisplayId = 6470;
    resolvedIcon = `${WOW_ICON_BASE}/ability_mount_raptor.jpg`;
    resolvedType = "ground";
  } else if (normName.includes("elekk")) {
    if (!resolvedDisplayId) resolvedDisplayId = 20023;
    resolvedIcon = `${WOW_ICON_BASE}/ability_mount_ridingelekk.jpg`;
    resolvedType = "ground";
  } else if (normName.includes("gryphon") || normName.includes("grifo")) {
    if (!resolvedDisplayId) resolvedDisplayId = 17696;
    resolvedIcon = `${WOW_ICON_BASE}/ability_mount_gryphon_01.jpg`;
    resolvedType = "flying";
    speed = "+150% Flight Speed";
  } else if (normName.includes("windrider") || normName.includes("wyvern") || normName.includes("mantico")) {
    if (!resolvedDisplayId) resolvedDisplayId = 17705;
    resolvedIcon = `${WOW_ICON_BASE}/ability_mount_wyvern_01.jpg`;
    resolvedType = "flying";
    speed = "+150% Flight Speed";
  } else if (
    normName.includes("horse") ||
    normName.includes("cavalo") ||
    normName.includes("steed") ||
    normName.includes("corcel") ||
    normName.includes("mare") ||
    normName.includes("stallion") ||
    normName.includes("palomino") ||
    normName.includes("pinto")
  ) {
    if (!resolvedDisplayId) {
      if (normName.includes("skeletal") || normName.includes("undead") || normName.includes("esqueleto")) {
        resolvedDisplayId = 10670;
        resolvedIcon = `${WOW_ICON_BASE}/ability_mount_undeadhorse.jpg`;
      } else if (normName.includes("pinto") || normName.includes("dapple")) {
        resolvedDisplayId = 2408;
        resolvedIcon = `${WOW_ICON_BASE}/ability_mount_ridinghorse.jpg`;
      } else if (normName.includes("black")) {
        resolvedDisplayId = 2409;
        resolvedIcon = `${WOW_ICON_BASE}/ability_mount_ridinghorse.jpg`;
      } else if (normName.includes("white")) {
        resolvedDisplayId = 2405;
        resolvedIcon = `${WOW_ICON_BASE}/ability_mount_ridinghorse.jpg`;
      } else if (normName.includes("palomino")) {
        resolvedDisplayId = 2402;
        resolvedIcon = `${WOW_ICON_BASE}/ability_mount_ridinghorse.jpg`;
      } else if (normName.includes("mountain")) {
        resolvedDisplayId = 38435;
        resolvedIcon = `${WOW_ICON_BASE}/ability_mount_mountainhorse.jpg`;
      } else {
        resolvedDisplayId = 2404;
        resolvedIcon = `${WOW_ICON_BASE}/ability_mount_ridinghorse.jpg`;
      }
    }
    resolvedType = "ground";
    speed = "+100% Ground Speed";
  }

  const finalCreatureDisplayId = resolvedDisplayId || 2404;

  return {
    id: mount.id || mountSpellAndItem.itemId || 54811,
    name: mount.name || "Official Mount",
    iconUrl: resolvedIcon,
    spellId: mount.spellId || mountSpellAndItem.spellId,
    itemId: mount.itemId || mountSpellAndItem.itemId || mount.id || 54811,
    displayId: finalCreatureDisplayId,
    creatureDisplayId: finalCreatureDisplayId,
    mountType: resolvedType,
    source: mount.source || "Battle.net Collection",
    description: mount.description || "Official World of Warcraft collection mount.",
    isCollected: mount.isCollected !== undefined ? mount.isCollected : true,
    isFavorite: !!mount.isFavorite,
    speedBonus: speed,
    isCharacterSpecific: mount.isCharacterSpecific,
    characterName: mount.characterName,
    characterRealm: mount.characterRealm,
    characterId: mount.characterId,
    unlockedAt: mount.unlockedAt,
    unlockOrder: mount.unlockOrder,
    rarity: mount.rarity,
  };
}

/**
 * Intelligently resolves official icon, 3D creatureDisplayId, and combat stats for ANY Battle Pet
 */
export function resolvePetInfo(pet: Partial<BlizzardCollectionPet>): BlizzardCollectionPet {
  const name = pet.name || "Battle Pet";
  const normName = name.toLowerCase().replace(/[^a-z0-9]/g, "");

  // 1. Authoritative ID-First Match from Blizzard DB2
  let resolvedDisplayId = 0;
  if (pet.id && WOW_PET_ID_TO_DISPLAY[pet.id]) {
    resolvedDisplayId = WOW_PET_ID_TO_DISPLAY[pet.id];
  }
  if (!resolvedDisplayId && WOW_PET_NAME_TO_DISPLAY[normName]) {
    resolvedDisplayId = WOW_PET_NAME_TO_DISPLAY[normName];
  }

  // 2. Direct match in catalogue
  const exact = OFFICIAL_PETS_CATALOG.find(
    (p) =>
      (pet.id && p.id === pet.id) ||
      p.name.toLowerCase().replace(/['\s-_]/g, "") === normName
  );

  const resolvedCreatureId = resolvePetCreatureId({
    id: pet.id,
    speciesId: pet.speciesId || (exact as any)?.speciesId,
    creatureId: pet.creatureId,
    npcId: pet.npcId,
  });

  if (exact) {
    return {
      ...exact,
      ...pet,
      creatureId: resolvedCreatureId || pet.creatureId || (exact as any).creatureId,
      iconUrl: pet.iconUrl && !pet.iconUrl.includes("254652.jpg") ? pet.iconUrl : exact.iconUrl,
      creatureDisplayId: resolvedDisplayId || exact.creatureDisplayId,
      family: exact.family,
      abilities: pet.abilities || exact.abilities,
      source: pet.source || exact.source,
      isCollected: pet.isCollected !== undefined ? pet.isCollected : exact.isCollected,
      isFavorite: pet.isFavorite !== undefined ? pet.isFavorite : exact.isFavorite,
      speciesId: pet.speciesId || (exact as any).speciesId,
      isCharacterSpecific: pet.isCharacterSpecific,
      characterName: pet.characterName,
      characterRealm: pet.characterRealm,
      characterId: pet.characterId,
      unlockedAt: pet.unlockedAt,
      unlockOrder: pet.unlockOrder,
      stats: pet.stats,
    };
  }

  if (!resolvedDisplayId && pet.creatureDisplayId && pet.creatureDisplayId > 0) {
    resolvedDisplayId = pet.creatureDisplayId;
  }

  // 3. Keyword-based matching to official 3D creatureDisplayIds and authentic icons
  let resolvedIcon = pet.iconUrl && !pet.iconUrl.includes("254652.jpg") && !pet.iconUrl.includes("inv_misc_pet_pandaren_elemental_earth") ? pet.iconUrl : "";
  let resolvedFamily: BlizzardCollectionPet["family"] = (pet.family as BlizzardCollectionPet["family"]) || "Beast";
  let abilities = pet.abilities || ["Quick Attack", "Superior Defense", "Ultimate Power"];

  if (normName.includes("ragnaros")) {
    if (!resolvedDisplayId) resolvedDisplayId = 33814;
    resolvedIcon = "https://render.worldofwarcraft.com/us/icons/56/254652.jpg";
    resolvedFamily = "Elemental";
    abilities = ["Magma Wave", "Conflagrate", "Sons of the Flame"];
  } else if (normName.includes("celestial") || normName.includes("dragon") || normName.includes("dragao") || normName.includes("drake") || normName.includes("whelp") || normName.includes("dragonete")) {
    if (!resolvedDisplayId) resolvedDisplayId = 30880;
    resolvedIcon = "https://render.worldofwarcraft.com/us/icons/56/368365.jpg";
    resolvedFamily = "Dragonkin";
    abilities = ["Flamethrower", "Roar", "Ancient Blessing"];
  } else if (normName.includes("anubisath") || normName.includes("idol") || normName.includes("idolo")) {
    if (!resolvedDisplayId) resolvedDisplayId = 21975;
    resolvedIcon = "https://render.worldofwarcraft.com/us/icons/56/134908.jpg";
    resolvedFamily = "Humanoid";
    abilities = ["Crush", "Sandstorm", "Deflection"];
  } else if (normName.includes("chrominius") || normName.includes("crominius")) {
    if (!resolvedDisplayId) resolvedDisplayId = 19445;
    resolvedIcon = "https://render.worldofwarcraft.com/us/icons/56/377270.jpg";
    resolvedFamily = "Dragonkin";
    abilities = ["Bite", "Howl", "Surge of Power"];
  } else if (normName.includes("phoenix") || normName.includes("fenix") || normName.includes("hatchling")) {
    if (!resolvedDisplayId) resolvedDisplayId = 22442;
    resolvedIcon = "https://render.worldofwarcraft.com/us/icons/56/134373.jpg";
    resolvedFamily = "Flying";
    abilities = ["Peck", "Immolate", "Cauterize"];
  } else if (normName.includes("corgi") || normName.includes("dog") || normName.includes("cao") || normName.includes("puppy") || normName.includes("cachorro")) {
    if (!resolvedDisplayId) resolvedDisplayId = 58511;
    resolvedIcon = "https://render.worldofwarcraft.com/us/icons/56/1044792.jpg";
    resolvedFamily = "Beast";
    abilities = ["Bark", "Puppy Love", "Flamethrower"];
  } else if (normName.includes("wolf") || normName.includes("lobo") || normName.includes("worg") || normName.includes("fox") || normName.includes("raposa")) {
    if (!resolvedDisplayId) resolvedDisplayId = 58511;
    resolvedIcon = "https://render.worldofwarcraft.com/us/icons/56/inv_misc_monsterclaw_04.jpg";
    resolvedFamily = "Beast";
    abilities = ["Bite", "Howl", "Dodge"];
  } else if (normName.includes("cat") || normName.includes("gato") || normName.includes("feline") || normName.includes("felino") || normName.includes("tiger") || normName.includes("tigre") || normName.includes("panther") || normName.includes("pantera") || normName.includes("mischief")) {
    if (!resolvedDisplayId) resolvedDisplayId = 74211;
    resolvedIcon = "https://render.worldofwarcraft.com/us/icons/56/1411879.jpg";
    resolvedFamily = "Beast";
    abilities = ["Fel Breath", "Prowl", "Chaos Blaze"];
  } else if (normName.includes("owl") || normName.includes("coruja") || normName.includes("falcon") || normName.includes("falcao") || normName.includes("hawk") || normName.includes("eagle") || normName.includes("aguia") || normName.includes("bird") || normName.includes("passaro") || normName.includes("raven") || normName.includes("corvo")) {
    if (!resolvedDisplayId) resolvedDisplayId = 22442;
    resolvedIcon = "https://render.worldofwarcraft.com/us/icons/56/ability_hunter_pet_owl.jpg";
    resolvedFamily = "Flying";
    abilities = ["Peck", "Screech", "Predatory Strike"];
  } else if (normName.includes("bat") || normName.includes("morcego")) {
    if (!resolvedDisplayId) resolvedDisplayId = 22442;
    resolvedIcon = "https://render.worldofwarcraft.com/us/icons/56/ability_hunter_pet_bat.jpg";
    resolvedFamily = "Flying";
    abilities = ["Bite", "Sonic Blast", "Leech Life"];
  } else if (normName.includes("murky") || normName.includes("murloc")) {
    if (!resolvedDisplayId) resolvedDisplayId = 16183;
    resolvedIcon = "https://render.worldofwarcraft.com/us/icons/56/656556.jpg";
    resolvedFamily = "Humanoid";
    abilities = ["Punch", "Acid Touch", "Stampede"];
  } else if (normName.includes("water") || normName.includes("agua") || normName.includes("spirit") || normName.includes("pandaren")) {
    if (!resolvedDisplayId) resolvedDisplayId = 44256;
    resolvedIcon = "https://render.worldofwarcraft.com/us/icons/56/656560.jpg";
    resolvedFamily = "Elemental";
    abilities = ["Water Jet", "Healing Wave", "Whirlpool"];
  } else if (normName.includes("starlette") || normName.includes("star") || normName.includes("estrela") || normName.includes("iron") || normName.includes("ferro") || normName.includes("mech") || normName.includes("robot") || normName.includes("robo") || normName.includes("clockwork") || normName.includes("golem")) {
    if (!resolvedDisplayId) resolvedDisplayId = 56942;
    resolvedIcon = "https://render.worldofwarcraft.com/us/icons/56/892829.jpg";
    resolvedFamily = "Mechanical";
    abilities = ["Wind-Up", "Powerball", "Supercharge"];
  } else if (normName.includes("valkyr") || normName.includes("unborn") || normName.includes("ghost") || normName.includes("fantasma") || normName.includes("skull") || normName.includes("caveira") || normName.includes("ghoul") || normName.includes("undead") || normName.includes("morto")) {
    if (!resolvedDisplayId) resolvedDisplayId = 44784;
    resolvedIcon = "https://render.worldofwarcraft.com/us/icons/56/851119.jpg";
    resolvedFamily = "Undead";
    abilities = ["Shadow Slash", "Curse of Doom", "Haunt"];
  } else if (normName.includes("fish") || normName.includes("peixe") || normName.includes("crab") || normName.includes("caranguejo") || normName.includes("turtle") || normName.includes("tartaruga")) {
    if (!resolvedDisplayId) resolvedDisplayId = 39100;
    resolvedIcon = "https://render.worldofwarcraft.com/us/icons/56/inv_misc_fish_52.jpg";
    resolvedFamily = "Aquatic";
    abilities = ["Surge", "Shell Shield", "Headbutt"];
  } else if (normName.includes("frog") || normName.includes("sapo") || normName.includes("toad")) {
    if (!resolvedDisplayId) resolvedDisplayId = 15303;
    resolvedIcon = "https://render.worldofwarcraft.com/us/icons/56/inv_misc_fish_52.jpg";
    resolvedFamily = "Aquatic";
    abilities = ["Frog Kiss", "Healing Wave", "Swarm"];
  } else if (normName.includes("rabbit") || normName.includes("coelho") || normName.includes("hare")) {
    if (!resolvedDisplayId) resolvedDisplayId = 29343;
    resolvedIcon = "https://render.worldofwarcraft.com/us/icons/56/inv_misc_rabbit.jpg";
    resolvedFamily = "Critter";
    abilities = ["Scratch", "Adrenaline Rush", "Burrow"];
  } else if (normName.includes("squirrel") || normName.includes("esquilo")) {
    if (!resolvedDisplayId) resolvedDisplayId = 7937;
    resolvedIcon = "https://render.worldofwarcraft.com/us/icons/56/inv_misc_pet_squirrel_mechanical.jpg";
    resolvedFamily = "Mechanical";
    abilities = ["Woodchipper", "Nut Barrage", "Crouch"];
  } else if (normName.includes("rat") || normName.includes("rato") || normName.includes("mouse")) {
    if (!resolvedDisplayId) resolvedDisplayId = 14697;
    resolvedIcon = "https://render.worldofwarcraft.com/us/icons/56/inv_misc_monsterclaw_04.jpg";
    resolvedFamily = "Critter";
    abilities = ["Sneak", "Survival", "Flurry"];
  } else if (normName.includes("broom") || normName.includes("vassoura") || normName.includes("magic") || normName.includes("magia") || normName.includes("arcane") || normName.includes("arcano") || normName.includes("lantern") || normName.includes("lanterna")) {
    if (!resolvedDisplayId) resolvedDisplayId = 23083;
    resolvedIcon = "https://render.worldofwarcraft.com/us/icons/56/inv_pet_broom.jpg";
    resolvedFamily = "Magic";
    abilities = ["Arcane Blast", "Amplify Magic", "Mana Surge"];
  } else {
    // Authentic family-based Blizzard icon fallback
    switch (resolvedFamily) {
      case "Dragonkin":
        resolvedIcon = resolvedIcon || "https://render.worldofwarcraft.com/us/icons/56/368365.jpg";
        resolvedDisplayId = resolvedDisplayId || 30880;
        break;
      case "Flying":
        resolvedIcon = resolvedIcon || "https://render.worldofwarcraft.com/us/icons/56/ability_hunter_pet_owl.jpg";
        resolvedDisplayId = resolvedDisplayId || 22442;
        break;
      case "Humanoid":
        resolvedIcon = resolvedIcon || "https://render.worldofwarcraft.com/us/icons/56/134908.jpg";
        resolvedDisplayId = resolvedDisplayId || 31738;
        break;
      case "Mechanical":
        resolvedIcon = resolvedIcon || "https://render.worldofwarcraft.com/us/icons/56/892829.jpg";
        resolvedDisplayId = resolvedDisplayId || 56942;
        break;
      case "Undead":
        resolvedIcon = resolvedIcon || "https://render.worldofwarcraft.com/us/icons/56/851119.jpg";
        resolvedDisplayId = resolvedDisplayId || 44784;
        break;
      case "Elemental":
        resolvedIcon = resolvedIcon || "https://render.worldofwarcraft.com/us/icons/56/inv_elemental_primal_fire.jpg";
        resolvedDisplayId = resolvedDisplayId || 33814;
        break;
      case "Aquatic":
        resolvedIcon = resolvedIcon || "https://render.worldofwarcraft.com/us/icons/56/inv_misc_fish_52.jpg";
        resolvedDisplayId = resolvedDisplayId || 44256;
        break;
      case "Critter":
        resolvedIcon = resolvedIcon || "https://render.worldofwarcraft.com/us/icons/56/inv_misc_rabbit.jpg";
        resolvedDisplayId = resolvedDisplayId || 29343;
        break;
      case "Magic":
        resolvedIcon = resolvedIcon || "https://render.worldofwarcraft.com/us/icons/56/inv_pet_broom.jpg";
        resolvedDisplayId = resolvedDisplayId || 23083;
        break;
      case "Beast":
      default:
        resolvedIcon = resolvedIcon || "https://render.worldofwarcraft.com/us/icons/56/inv_misc_monsterclaw_04.jpg";
        resolvedDisplayId = resolvedDisplayId || 28917;
        break;
    }
  }

  const finalPetDisplayId = resolvedDisplayId || 28917;

  return {
    id: pet.id || 844,
    name: pet.name || "Battle Pet",
    iconUrl: resolvedIcon,
    itemId: pet.id || 844,
    creatureId: resolvedCreatureId || pet.creatureId,
    displayId: finalPetDisplayId,
    creatureDisplayId: finalPetDisplayId,
    family: resolvedFamily,
    level: pet.level || 25,
    quality: pet.quality || "RARE",
    source: pet.source || "Battle.net Pet Journal",
    abilities,
    isCollected: pet.isCollected !== undefined ? pet.isCollected : true,
    isFavorite: !!pet.isFavorite,
    speciesId: pet.speciesId,
    isCharacterSpecific: pet.isCharacterSpecific,
    characterName: pet.characterName,
    characterRealm: pet.characterRealm,
    characterId: pet.characterId,
    unlockedAt: pet.unlockedAt,
    unlockOrder: pet.unlockOrder,
    stats: pet.stats,
  };
}

// Aliases for standard enrichment
export const enrichMountWithBlizzardMetadata = resolveMountInfo;
export const enrichPetWithBlizzardMetadata = resolvePetInfo;

/**
 * Returns a guaranteed valid creatureDisplayId for a Mount, falling back to smart name matching
 */
/**
 * Looks up known mount display ID from authoritative sources without defaulting
 */
export function findKnownMountDisplayId(id?: number, name?: string): number | null {
  if (id && id > 0) {
    if (WOW_MOUNT_ID_TO_DISPLAY[id]) return WOW_MOUNT_ID_TO_DISPLAY[id];
    const found = OFFICIAL_MOUNTS_CATALOG.find((m) => m.id === id);
    if (found?.creatureDisplayId) return found.creatureDisplayId;
    const fromL1 = getCachedDisplayIdSync("mount", id);
    if (fromL1 && fromL1 !== id) return fromL1;
  }
  if (name) {
    const norm = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (WOW_MOUNT_NAME_TO_DISPLAY[norm]) return WOW_MOUNT_NAME_TO_DISPLAY[norm];
    const found = OFFICIAL_MOUNTS_CATALOG.find(
      (m) => m.name.toLowerCase().replace(/[^a-z0-9]/g, "") === norm
    );
    if (found?.creatureDisplayId) return found.creatureDisplayId;
    const fromL1 = getCachedDisplayIdSync("mount", name);
    if (fromL1) return fromL1;
  }
  return null;
}

/**
 * Looks up known pet display ID from authoritative sources without defaulting
 */
export function findKnownPetDisplayId(id?: number, name?: string): number | null {
  if (id && id > 0) {
    if (WOW_PET_ID_TO_DISPLAY[id]) return WOW_PET_ID_TO_DISPLAY[id];
    // Check if id is a CreatureID rather than SpeciesID
    const speciesId = WOW_PET_CREATURE_TO_SPECIES[id];
    if (speciesId && WOW_PET_ID_TO_DISPLAY[speciesId]) return WOW_PET_ID_TO_DISPLAY[speciesId];
    const found = OFFICIAL_PETS_CATALOG.find((p) => p.id === id);
    if (found?.creatureDisplayId) return found.creatureDisplayId;
    const fromL1 = getCachedDisplayIdSync("pet", id);
    if (fromL1 && fromL1 !== id) return fromL1;
  }
  if (name) {
    const norm = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (WOW_PET_NAME_TO_DISPLAY[norm]) return WOW_PET_NAME_TO_DISPLAY[norm];
    const found = OFFICIAL_PETS_CATALOG.find(
      (p) => p.name.toLowerCase().replace(/[^a-z0-9]/g, "") === norm
    );
    if (found?.creatureDisplayId) return found.creatureDisplayId;
    const fromL1 = getCachedDisplayIdSync("pet", name);
    if (fromL1) return fromL1;
  }
  return null;
}

/**
 * Returns a guaranteed valid creatureDisplayId for a Mount, prioritizing Blizzard API creatureDisplayId
 */
export function getMountDisplayId(mount?: Partial<BlizzardCollectionMount> | number | string | null): number {
  if (!mount) return 2404;
  if (typeof mount === "number") {
    return findKnownMountDisplayId(mount) || 2404;
  }
  if (typeof mount === "string") {
    return findKnownMountDisplayId(undefined, mount) || resolveMountInfo({ name: mount }).creatureDisplayId || 2404;
  }
  // Priority 1: Exact creatureDisplayId from Blizzard API
  if (mount.creatureDisplayId && mount.creatureDisplayId > 0) return mount.creatureDisplayId;
  // Priority 2: Authoritative ID or Name match
  const known = findKnownMountDisplayId(mount.id, mount.name);
  if (known) return known;
  const enriched = resolveMountInfo(mount);
  return enriched.creatureDisplayId || 2404;
}

/**
 * Returns a guaranteed valid creatureDisplayId for a Pet, prioritizing Blizzard API creatureDisplayId
 */
export function getPetDisplayId(pet?: Partial<BlizzardCollectionPet> | number | string | null): number {
  if (!pet) return 28917;
  if (typeof pet === "number") {
    return findKnownPetDisplayId(pet) || 28917;
  }
  if (typeof pet === "string") {
    return findKnownPetDisplayId(undefined, pet) || resolvePetInfo({ name: pet }).creatureDisplayId || 28917;
  }
  // Priority 1: Exact creatureDisplayId from Blizzard API
  if (pet.creatureDisplayId && pet.creatureDisplayId > 0) return pet.creatureDisplayId;
  // Priority 2: Authoritative ID or Name match
  const known = findKnownPetDisplayId(pet.id, pet.name);
  if (known) return known;
  const enriched = resolvePetInfo(pet);
  return enriched.creatureDisplayId || 28917;
}
