/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ExternalLink } from "lucide-react";
import {
  WOW_PET_CREATURE_TO_SPECIES as LEGACY_PET_CREATURE_TO_SPECIES,
  WOW_PET_NAME_TO_DISPLAY,
  WOW_MOUNT_NAME_TO_DISPLAY,
} from "./blizzardMountDb";
import {
  WOW_MOUNT_ID_TO_SPELL as OFFICIAL_MOUNT_ID_TO_SPELL,
  WOW_MOUNT_NAME_TO_SPELL as OFFICIAL_MOUNT_NAME_TO_SPELL,
} from "./blizzardMountSpellDb";
import {
  WOW_PET_SPECIES_TO_CREATURE as OFFICIAL_PET_SPECIES_TO_CREATURE,
  WOW_PET_CREATURE_TO_SPECIES as OFFICIAL_PET_CREATURE_TO_SPECIES,
  WOW_PET_SPECIES_TO_SPELL as OFFICIAL_PET_SPECIES_TO_SPELL,
} from "./blizzardPetSpeciesDb";

export type WoWEntityKind =
  | "item"
  | "gear"
  | "weapon"
  | "armor"
  | "mount"
  | "pet"
  | "battle-pet"
  | "species"
  | "spell"
  | "ability"
  | "pet-ability"
  | "achievement"
  | "quest"
  | "npc"
  | "creature"
  | "faction"
  | "reputation"
  | "toy"
  | "title"
  | "currency"
  | "zone"
  | "dressing-room"
  | "auto"
  | string;

export type WoWVersionSlug = "retail" | "forever" | "classic" | "tbc" | "mop" | "wotlk" | string;

export interface WoWEntityContext {
  id?: number | string;
  kind?: WoWEntityKind;
  version?: WoWVersionSlug;
  itemId?: number;
  spellId?: number;
  speciesId?: number;
  creatureId?: number;
  npcId?: number;
  creatureDisplayId?: number;
  displayId?: number;
  name?: string;
  transmogItemId?: number;
  source?: string;
  [key: string]: any;
}

/**
 * Builds a SEO & Wowhead canonical friendly slug from an entity title.
 * Examples:
 *   "Invincible" -> "/invincible"
 *   "DNT - Storm Pet Boss (Legendary)" -> "/dnt-storm-pet-boss-legendary"
 *   "Lil' Tarecgosa" -> "/lil-tarecgosa"
 */
export function toWowheadSlug(name?: string): string {
  if (!name) return "";
  const clean = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean ? `/${clean}` : "";
}

/**
 * Inverted Species ID -> Creature ID (NPC ID) map for Battle Pets.
 * Wowhead organizes Battle Pets under /npc=<creatureId>, NEVER /battle-pet=.
 */
export const WOW_PET_SPECIES_TO_CREATURE: Record<number, number> = {
  ...OFFICIAL_PET_SPECIES_TO_CREATURE,
};

export const WOW_PET_CREATURE_TO_SPECIES: Record<number, number> = {
  ...LEGACY_PET_CREATURE_TO_SPECIES,
  ...OFFICIAL_PET_CREATURE_TO_SPECIES,
};

export const WOW_PET_SPECIES_TO_SPELL: Record<number, number> = {
  ...OFFICIAL_PET_SPECIES_TO_SPELL,
};

for (const [creatureIdStr, speciesId] of Object.entries(WOW_PET_CREATURE_TO_SPECIES)) {
  const cId = parseInt(creatureIdStr, 10);
  const sId = Number(speciesId);
  if (cId > 0 && sId > 0 && !WOW_PET_SPECIES_TO_CREATURE[sId]) {
    WOW_PET_SPECIES_TO_CREATURE[sId] = cId;
  }
}

/**
 * Authoritative Mount ID (Blizzard Mount.db2) to Summon Spell ID
 * Wowhead organizes Mounts strictly under /spell=<spellId> and /spells/mounts!
 */
export const WOW_MOUNT_ID_TO_SPELL: Record<number, number> = {
  ...OFFICIAL_MOUNT_ID_TO_SPELL,
  363: 72286,   // Invincible
  449: 118089,  // Azure Water Strider (SourceSpellID 118089 / 127271)
  488: 127272,  // Crimson Water Strider
  183: 34090,   // Ashes of Al'ar
  197: 42777,   // Swift Spectral Tiger
  196: 42776,   // Spectral Tiger
  304: 63956,   // Mimiron's Head
  185: 41252,   // Reins of the Raven Lord
  265: 60002,   // Time-Lost Proto-Drake
  199: 43688,   // Amani War Bear
  213: 46628,   // Swift White Hawkstrider
  469: 127170,  // Reins of the Onyx Cloud Serpent
  478: 127170,  // Astral Cloud Serpent
  1589: 368896, // Highland Drake
  168: 36702,   // Fiery Warhorse
  69: 17481,    // Deathcharger's Reins / Rivendare's Deathcharger
  243: 59567,   // Azure Drake
  247: 59568,   // Blue Drake
  248: 59569,   // Bronze Drake
  249: 59570,   // Red Drake
  250: 59571,   // Twilight Drake
  253: 59650,   // Black Drake
  328: 65917,   // Magic Rooster
  219: 48025,   // The Headless Horseman's Mount
  306: 63958,   // Ironbound Proto-Drake
  307: 63963,   // Rusted Proto-Drake
  264: 59996,   // Blue Proto-Drake
  278: 61294,   // Green Proto-Drake
  262: 59961,   // Red Proto-Drake
  267: 60025,   // Violet Proto-Drake
  266: 60021,   // Plagued Proto-Drake
  263: 59976,   // Black Proto-Drake
  415: 97493,   // Pureblood Firehawk
  416: 97494,   // Felfire Hawk
  417: 97495,   // Corrupted Firehawk
  423: 98718,   // Flametalon of Alysrazor
  460: 122708,  // Grand Expedition Yak
  522: 134359,  // Sky Golem
  530: 136400,  // Armored Skyscreamer
  531: 136471,  // Spawn of Horridon
  542: 139442,  // Thundering Cobalt Cloud Serpent
  543: 139448,  // Clutch of Ji-Kun
  550: 148417,  // Kor'kron Juggernaut
  548: 148396,  // Kor'kron War Wolf
  551: 148428,  // Thundering Onyx Cloud Serpent
  517: 130086,  // Thundering Ruby Cloud Serpent
  606: 170430,  // Core Hound
  613: 171827,  // Ironhoof Destroyer
  634: 171828,  // Solar Spirehawk
  663: 188849,  // Bloodfang Widow
  678: 179244,  // Chauffeured Mechanohog
  682: 179478,  // Voidtalon of the Dark Star
  751: 183828,  // Felsteel Annihilator
  779: 213348,  // Spirit of Eche'ro
  780: 200175,  // Felsaber
  781: 213115,  // Infinite Timereaver
  845: 214791,  // Mechanized Lumber Extractor
  874: 229499,  // Midnight (Legion)
  882: 231428,  // Smoldering Ember Wyrm
  899: 239770,  // Abyss Worm
  905: 239766,  // Leywoven Flying Carpet
  932: 246949,  // Lightforged Warframe
  948: 242898,  // Riddler's Mind-Worm
  954: 253088,  // Shackled Ur'zul
  961: 247400,  // Lucid Nightmare
  971: 253087,  // Antoran Charhound
  972: 253106,  // Antoran Gloomhound
  995: 269016,  // Sharkbait
  1040: 273540, // Tomb Stalker
  1053: 273541, // Underrot Crawg
  1217: 288495, // G.M.O.D.
  1219: 288497, // Glacial Tidestorm
  1269: 308940, // Uncorrupted Voidwing
  1293: 306432, // Ny'alotha Allseer
  1315: 310860, // Mail Muncher
  1414: 334380, // Sinrunner Blanchy
  1416: 339588, // Hand of Hrestimorak
  1446: 346554, // Tazavesh Gearglider
  1471: 352237, // Vengeance
  1504: 354350, // Fallen Charger
  1838: 424475, // Anu'relos, Flame's Guidance
  6: 458,       // Brown Horse
  18: 472,      // Chestnut Mare
  11: 470,      // Pinto
  9: 468,       // Black Stallion
  8: 466,       // White Stallion
  52: 6648,     // Palomino
  434: 103080,  // Mountain Horse
  435: 103081,  // Swift Mountain Horse
  14: 580,      // Brown Wolf
  15: 581,      // Timber Wolf
  20: 584,      // Dire Wolf
  13: 579,      // Red Wolf
  12: 578,      // Black Wolf
  25: 6899,     // Brown Ram
  21: 6898,     // Gray Ram
  24: 6777,     // White Ram
  72: 18989,    // Brown Kodo
  71: 18990,    // Gray Kodo
  309: 64657,   // White Kodo
  40: 10969,    // Blue Mechanostrider
  39: 10873,    // Red Mechanostrider
  57: 10970,    // Green Mechanostrider
  27: 8395,     // Emerald Raptor
  36: 10796,    // Turquoise Raptor
  38: 10799,    // Violet Raptor
  34: 8394,     // Striped Nightsaber
  26: 8392,     // Striped Frostsaber
  31: 10789,    // Spotted Frostsaber
  65: 17463,    // Red Skeletal Horse
  66: 17464,    // Blue Skeletal Horse
  67: 17462,    // Brown Skeletal Horse
  129: 32235,   // Golden Gryphon
  130: 32239,   // Ebon Gryphon
  131: 32240,   // Snowy Gryphon
  133: 32243,   // Tawny Wind Rider
  134: 32244,   // Blue Wind Rider
  135: 32245,   // Green Wind Rider
  147: 34406,   // Brown Elekk
  163: 35710,   // Gray Elekk
  164: 35711,   // Purple Elekk
  152: 35018,   // Red Hawkstrider
  158: 35020,   // Blue Hawkstrider
  157: 35022,   // Purple Hawkstrider
  159: 35025,   // Black Hawkstrider
};

/**
 * Item ID (reins/egg/item) to Summon Spell ID mapping for mounts
 */
export const WOW_MOUNT_ITEM_TO_SPELL: Record<number, number> = {
  54811: 72286,   // Invincible's Reins
  87791: 127271,  // Reins of the Azure Water Strider
  87792: 127272,  // Reins of the Crimson Water Strider
  32458: 34090,   // Ashes of Al'ar
  49284: 42777,   // Swift Spectral Tiger
  49283: 42776,   // Spectral Tiger
  45693: 63956,   // Mimiron's Head
  32768: 41252,   // Reins of the Raven Lord
  44151: 60002,   // Time-Lost Proto-Drake
  33809: 43688,   // Amani War Bear
  35513: 46628,   // Swift White Hawkstrider
  87771: 127170,  // Reins of the Onyx Cloud Serpent
  87777: 127170,  // Astral Cloud Serpent
  196883: 368896, // Highland Drake
  30480: 36702,   // Fiery Warhorse's Reins
  13335: 17481,   // Deathcharger's Reins
  43952: 59567,   // Reins of the Azure Drake
  43953: 59568,   // Reins of the Blue Drake
  43951: 59569,   // Reins of the Bronze Drake
  43955: 59570,   // Reins of the Red Drake
  43954: 59571,   // Reins of the Twilight Drake
  43986: 59650,   // Reins of the Black Drake
  49290: 65917,   // Magic Rooster Egg
  37012: 48025,   // The Headless Horseman's Mount
  44177: 63958,   // Ironbound Proto-Drake
  44178: 63963,   // Rusted Proto-Drake
  44152: 59996,   // Blue Proto-Drake
  44707: 61294,   // Green Proto-Drake
  44160: 59961,   // Red Proto-Drake
  44164: 60025,   // Violet Proto-Drake
  44168: 59976,   // Black Proto-Drake
  69224: 97493,   // Smoldering Egg of Millagazor (Pureblood Firehawk)
  69225: 97494,   // Felfire Hawk
  69226: 97495,   // Corrupted Firehawk
  71665: 98718,   // Flametalon of Alysrazor
  84101: 122708,  // Reins of the Grand Expedition Yak
  95416: 134359,  // Sky Golem
  104246: 148417, // Kor'kron Juggernaut
  104249: 148396, // Kor'kron War Wolf
  116660: 171827, // Ironhoof Destroyer
  123890: 183828, // Felsteel Annihilator
  121815: 179478, // Voidtalon of the Dark Star
  116771: 171828, // Solar Spirehawk
  137570: 188849, // Bloodfang Widow
  142236: 229499, // Midnight (Legion)
  142552: 231428, // Smoldering Ember Wyrm
  151623: 247400, // Lucid Nightmare
  152789: 253088, // Shackled Ur'zul
  152788: 253087, // Antoran Charhound
  152814: 253106, // Antoran Gloomhound
  147835: 239770, // Abyss Worm
  147837: 242898, // Riddler's Mind-Worm
  166518: 288495, // G.M.O.D.
  166520: 288497, // Glacial Tidestorm
  174872: 306432, // Ny'alotha Allseer
  174862: 308940, // Uncorrupted Voidwing
  174653: 310860, // Mail Muncher
  182650: 334380, // Sinrunner Blanchy
  186641: 346554, // Tazavesh Gearglider
  186658: 354350, // Fallen Charger
  186644: 352237, // Vengeance
  183800: 339588, // Hand of Hrestimorak
  210061: 424475, // Feather of Anu'relos (Flame's Guidance)
};

/**
 * Normalized name to Summon Spell ID lookup for mounts
 */
export const WOW_MOUNT_NAME_TO_SPELL: Record<string, number> = {
  ...OFFICIAL_MOUNT_NAME_TO_SPELL,
  invincible: 72286,
  invinciblesreins: 72286,
  invencivel: 72286,
  redeasdeinvencivel: 72286,
  azurewaterstrider: 127271,
  reinsoftheazurewaterstrider: 127271,
  crimsonwaterstrider: 127272,
  reinsofthecrimsonwaterstrider: 127272,
  ashesofalar: 34090,
  cinzasdealar: 34090,
  swiftspectraltiger: 42777,
  spectraltiger: 42776,
  mimironshead: 63956,
  cabecademimiron: 63956,
  ravenlord: 41252,
  reinsoftheravenlord: 41252,
  senhordoscorvos: 41252,
  timelostprotodrake: 60002,
  protodracoperdidonotempo: 60002,
  amaniwarbear: 43688,
  ursodeguerraamani: 43688,
  swiftwhitehawkstrider: 46628,
  falcostruzbrancoveloz: 46628,
  onyxcloudserpent: 127170,
  reinsoftheonyxcloudserpent: 127170,
  highlanddrake: 368896,
  dracodasaltiplanaluras: 368896,
  fierywarhorse: 36702,
  fierywarhorsesreins: 36702,
  deathchargersreins: 17481,
  rivendaresdeathcharger: 17481,
  azuredrake: 59567,
  bluedrake: 59568,
  bronzedrake: 59569,
  reddrake: 59570,
  twilightdrake: 59571,
  blackdrake: 59650,
  magicrooster: 65917,
  headlesshorsemansmount: 48025,
  theheadlesshorsemansmount: 48025,
  ironboundprotodrake: 63958,
  rustedprotodrake: 63963,
  blueprotodrake: 59996,
  greenprotodrake: 61294,
  redprotodrake: 59961,
  violetprotodrake: 60025,
  plaguedprotodrake: 60021,
  blackprotodrake: 59976,
  purebloodfirehawk: 97493,
  felfirehawk: 97494,
  corruptedfirehawk: 97495,
  flametalonofalysrazor: 98718,
  astralcloudserpent: 127170,
  grandexpeditionyak: 122708,
  skygolem: 134359,
  korkronjuggernaut: 148417,
  korkronwarwolf: 148396,
  ironhoofdestroyer: 171827,
  felsteelannihilator: 183828,
  voidtalonofthedarkstar: 179478,
  solarspirehawk: 171828,
  bloodfangwidow: 188849,
  midnight: 229499,
  smolderingemberwyrm: 231428,
  lucidnightmare: 247400,
  shackledurzul: 253088,
  antorancharhound: 253087,
  antorangloomhound: 253106,
  abyssworm: 239770,
  riddlersmindworm: 242898,
  gmod: 288495,
  glacialtidestorm: 288497,
  nyalothaallseer: 306432,
  uncorruptedvoidwing: 308940,
  mailmuncher: 310860,
  sinrunnerblanchy: 334380,
  tazaveshgearglider: 346554,
  fallencharger: 354350,
  vengeance: 352237,
  handofhrestimorak: 339588,
  anurelosflamesguidance: 424475,
};

/**
 * Normalizes input WoW version string to one of Wowhead's supported database subdomains/paths.
 * - retail: https://www.wowhead.com
 * - forever: https://www.wowhead.com/classic (Classic Era / Vanilla 1.12)
 * - classic: https://www.wowhead.com/cata (Progression / Cataclysm Classic)
 * - tbc: https://www.wowhead.com/tbc (The Burning Crusade Classic)
 * - mop: https://www.wowhead.com/mop-classic (Mists of Pandaria Classic)
 * - wotlk: https://www.wowhead.com/wotlk (Wrath of the Lich King Classic)
 */
export function normalizeWoWVersion(rawVersion?: string): "retail" | "forever" | "classic" | "tbc" | "mop" | "wotlk" {
  if (!rawVersion) return "retail";
  const v = rawVersion.toLowerCase().trim().replace(/^wow-/, "");
  if (v === "forever" || v === "classic-era" || v === "era" || v === "vanilla") return "forever";
  if (v === "mop" || v === "pandaria" || v.includes("mop")) return "mop";
  if (v === "tbc" || v.includes("burning") || v === "crusade") return "tbc";
  if (v === "wotlk" || v.includes("wrath") || v.includes("lich")) return "wotlk";
  if (v === "classic" || v.includes("cata") || v.includes("cataclysm") || v === "progression") return "classic";
  return "retail";
}

/**
 * Returns the exact base URL for the targeted WoW expansion database on Wowhead.
 */
export function getWowheadBaseUrl(version?: string): string {
  const norm = normalizeWoWVersion(version);
  switch (norm) {
    case "forever":
      return "https://www.wowhead.com/classic"; // Classic Era
    case "classic":
      return "https://www.wowhead.com/cata";    // Cataclysm Classic
    case "tbc":
      return "https://www.wowhead.com/tbc";
    case "mop":
      return "https://www.wowhead.com/mop-classic";
    case "wotlk":
      return "https://www.wowhead.com/wotlk";
    case "retail":
    default:
      return "https://www.wowhead.com";
  }
}

/**
 * Resolves the spellId and itemId for any Mount through multiple authoritative strategies:
 * 1. Direct spellId in context
 * 2. Blizzard Mount ID lookup (WOW_MOUNT_ID_TO_SPELL)
 * 3. Item ID lookup (WOW_MOUNT_ITEM_TO_SPELL)
 * 4. Normalized name exact/fuzzy match (WOW_MOUNT_NAME_TO_SPELL)
 */
export function resolveMountIds(ctx: WoWEntityContext): { spellId?: number; itemId?: number } {
  let spellId = ctx.spellId && ctx.spellId > 0 ? ctx.spellId : undefined;
  let itemId = ctx.itemId && ctx.itemId > 0 ? ctx.itemId : undefined;

  const rawId = ctx.id;
  const numId = typeof rawId === "number" ? rawId : parseInt(String(rawId || "0"), 10) || 0;

  // 1. Direct Mount ID match (e.g. 449 -> 127271, 363 -> 72286)
  if (!spellId && numId > 0 && WOW_MOUNT_ID_TO_SPELL[numId]) {
    spellId = WOW_MOUNT_ID_TO_SPELL[numId];
  }

  // 2. Direct Item ID match (e.g. 54811 -> 72286, 32458 -> 34090)
  if (!spellId && numId > 0 && WOW_MOUNT_ITEM_TO_SPELL[numId]) {
    spellId = WOW_MOUNT_ITEM_TO_SPELL[numId];
    if (!itemId) itemId = numId;
  }
  if (!spellId && itemId && WOW_MOUNT_ITEM_TO_SPELL[itemId]) {
    spellId = WOW_MOUNT_ITEM_TO_SPELL[itemId];
  }

  // 3. Name-based match
  if (ctx.name) {
    const norm = ctx.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!spellId && WOW_MOUNT_NAME_TO_SPELL[norm]) {
      spellId = WOW_MOUNT_NAME_TO_SPELL[norm];
    }
    // Substring fallback for common mounts
    if (!spellId) {
      if (norm.includes("invincible") || norm.includes("invencivel")) {
        spellId = 72286;
        if (!itemId) itemId = 54811;
      } else if (norm.includes("ashes") || norm.includes("alar")) {
        spellId = 34090;
        if (!itemId) itemId = 32458;
      } else if (norm.includes("spectral") && norm.includes("tiger")) {
        spellId = 42777;
        if (!itemId) itemId = 49284;
      } else if (norm.includes("mimiron")) {
        spellId = 63956;
        if (!itemId) itemId = 45693;
      } else if (norm.includes("raven") && norm.includes("lord")) {
        spellId = 41252;
        if (!itemId) itemId = 32768;
      } else if (norm.includes("timelost") || norm.includes("perdidonotempo")) {
        spellId = 60002;
        if (!itemId) itemId = 44151;
      } else if (norm.includes("waterstrider") || norm.includes("azurewater")) {
        spellId = 127271;
        if (!itemId) itemId = 87791;
      } else if (norm.includes("highlanddrake")) {
        spellId = 368896;
        if (!itemId) itemId = 196883;
      } else if (norm.includes("fierywarhorse")) {
        spellId = 36702;
        if (!itemId) itemId = 30480;
      } else if (norm.includes("deathcharger") || norm.includes("rivendare")) {
        spellId = 17481;
        if (!itemId) itemId = 13335;
      }
    }
  }

  return { spellId, itemId };
}

/**
 * Resolves the creatureId (NPC ID) for any Battle Pet or Companion through multiple authoritative strategies:
 * 1. Direct creatureId or npcId in context
 * 2. Species ID reverse lookup (WOW_PET_SPECIES_TO_CREATURE)
 * 3. Direct ID is creature ID in WOW_PET_CREATURE_TO_SPECIES
 */
export function resolvePetCreatureId(ctx: WoWEntityContext): number | undefined {
  if (ctx.creatureId && ctx.creatureId > 0) return ctx.creatureId;
  if (ctx.npcId && ctx.npcId > 0) return ctx.npcId;

  const rawId = ctx.id;
  const numId = typeof rawId === "number" ? rawId : parseInt(String(rawId || "0"), 10) || 0;
  const speciesId = ctx.speciesId && ctx.speciesId > 0 ? ctx.speciesId : (numId > 0 && numId < 100000 ? numId : 0);

  // 1. Inverted species to creature ID lookup (e.g. species 320 -> creature 54027)
  if (speciesId > 0 && WOW_PET_SPECIES_TO_CREATURE[speciesId]) {
    return WOW_PET_SPECIES_TO_CREATURE[speciesId];
  }

  // 2. If numId itself is already a creature ID (exists in WOW_PET_CREATURE_TO_SPECIES keys, e.g. 199938)
  if (numId > 0 && WOW_PET_CREATURE_TO_SPECIES[numId]) {
    return numId;
  }

  // 3. If numId > 0, check if numId is in WOW_PET_SPECIES_TO_CREATURE
  if (numId > 0 && WOW_PET_SPECIES_TO_CREATURE[numId]) {
    return WOW_PET_SPECIES_TO_CREATURE[numId];
  }

  return undefined;
}

/**
 * Master Wowhead URL resolver:
 * Intelligently analyzes the entity ID and context (mount, pet, item, spell, achievement, version)
 * to build precise, direct Wowhead database links and prevent "Item #XXXX doesn't exist" or 404 errors.
 *
 * Guaranteed correctness:
 * - Mounts are ALWAYS mapped to /spell=<spellId>/<slug> or /spells/mounts, NEVER /mount=ID.
 * - Pets are ALWAYS mapped to /npc=<creatureId>/<slug> or /spells/companions, NEVER /battle-pet=ID.
 */
export function resolveWowheadUrl(
  target: number | string | WoWEntityContext,
  explicitKind?: WoWEntityKind,
  explicitVersion?: WoWVersionSlug,
  extra?: any
): string {
  let ctx: WoWEntityContext;
  if (typeof target === "object" && target !== null) {
    ctx = { ...target };
    if (explicitKind) ctx.kind = explicitKind;
    if (explicitVersion) ctx.version = explicitVersion;
  } else {
    ctx = {
      id: target,
      kind: explicitKind || "auto",
      version: explicitVersion,
      ...(typeof extra === "object" ? extra : {}),
    };
  }

  const normVersion = normalizeWoWVersion(ctx.version);
  const base = getWowheadBaseUrl(normVersion);
  const slug = toWowheadSlug(ctx.name);

  // Auto-detect entity kind from context characteristics if set to 'auto' or omitted
  let kind = (ctx.kind || "auto").toLowerCase();
  if (kind === "auto") {
    if (ctx.speciesId || ctx.abilities || (ctx.family && !ctx.slot)) {
      kind = "pet";
    } else if (ctx.mountType || ctx.speedBonus) {
      kind = "mount";
    } else if (ctx.points !== undefined || ctx.completedTimestamp !== undefined) {
      kind = "achievement";
    } else if (ctx.slot || ctx.itemLevel || ctx.stats || ctx.durability || ctx.sellPrice) {
      kind = "item";
    } else if (ctx.spellCost || ctx.castTime || ctx.cooldown || ctx.talentTree) {
      kind = "spell";
    } else {
      kind = "item";
    }
  }

  const rawId = ctx.id;
  const numId = typeof rawId === "number" ? rawId : parseInt(String(rawId || "0"), 10) || 0;

  // 1. MOUNTS
  // Wowhead DOES NOT HAVE a /mount=ID route. Mounts on Wowhead are Spells (or Items / Directory)!
  if (kind === "mount") {
    const { spellId, itemId } = resolveMountIds(ctx);

    if (spellId && spellId > 0) {
      return `${base}/spell=${spellId}${slug}`;
    }
    if (itemId && itemId > 0) {
      return `${base}/item=${itemId}${slug}`;
    }
    if (ctx.name) {
      return `${base}/spells/mounts?filter=na=${encodeURIComponent(ctx.name)}`;
    }
    return `${base}/spells/mounts`;
  }

  // 2. PETS & BATTLE PETS & COMPANIONS
  // Wowhead DOES NOT HAVE a /battle-pet=ID route. Pets on Wowhead are NPCs (/npc=creatureId) or Companions!
  if (kind === "pet" || kind === "battle-pet" || kind === "species" || kind === "companion") {
    const creatureId = resolvePetCreatureId(ctx);

    if (creatureId && creatureId > 0) {
      return `${base}/npc=${creatureId}${slug}`;
    }
    const speciesId = ctx.speciesId || (numId > 0 && numId < 100000 ? numId : 0);
    const spellFromSpecies = speciesId > 0 ? WOW_PET_SPECIES_TO_SPELL[speciesId] : 0;
    const effSpellId = ctx.spellId || spellFromSpecies;
    if (effSpellId && effSpellId > 0) {
      return `${base}/spell=${effSpellId}${slug}`;
    }
    if (ctx.itemId && ctx.itemId > 0) {
      return `${base}/item=${ctx.itemId}${slug}`;
    }
    if (numId > 1000 && normVersion !== "retail") {
      // In Classic / Vanilla, companions are taught by items
      return `${base}/item=${numId}${slug}`;
    }
    if (ctx.name) {
      return `${base}/spells/companions?filter=na=${encodeURIComponent(ctx.name)}`;
    }
    return `${base}/spells/companions`;
  }

  // 3. PET ABILITIES
  if (kind === "pet-ability" || kind === "ability") {
    if (typeof rawId === "number" && rawId > 0) {
      return `https://www.wowhead.com/pet-ability=${rawId}${slug}`;
    }
    const query = ctx.name || String(rawId || "");
    if (query) {
      return `https://www.wowhead.com/pet-abilities?filter=na=${encodeURIComponent(query)}`;
    }
    return `https://www.wowhead.com/pet-abilities`;
  }

  // 4. SPELLS & TALENTS
  if (kind === "spell") {
    const spellId = ctx.spellId || numId;
    if (spellId > 0) {
      return `${base}/spell=${spellId}${slug}`;
    }
    if (ctx.name) {
      return `${base}/search?q=${encodeURIComponent(ctx.name)}#spells`;
    }
    return `${base}/database#spells`;
  }

  // 5. ACHIEVEMENTS
  if (kind === "achievement") {
    if (numId > 0) {
      return `${base}/achievement=${numId}${slug}`;
    }
    if (ctx.name) {
      return `${base}/search?q=${encodeURIComponent(ctx.name)}#achievements`;
    }
    return `${base}/database#achievements`;
  }

  // 6. QUESTS
  if (kind === "quest") {
    if (numId > 0) return `${base}/quest=${numId}${slug}`;
    return `${base}/database#quests`;
  }

  // 7. NPCS & CREATURES
  if (kind === "npc" || kind === "creature") {
    const npcId = ctx.npcId || ctx.creatureId || numId;
    if (npcId > 0) return `${base}/npc=${npcId}${slug}`;
    return `${base}/database#npcs`;
  }

  // 8. TOYS
  if (kind === "toy") {
    const effId = ctx.itemId || numId;
    if (effId > 0) return `${base}/item=${effId}${slug}`;
    return `${base}/database#toys`;
  }

  // 9. TITLES
  if (kind === "title") {
    if (numId > 0) return `${base}/title=${numId}${slug}`;
    return `${base}/database#titles`;
  }

  // 10. CURRENCY
  if (kind === "currency") {
    if (numId > 0) return `${base}/currency=${numId}${slug}`;
    return `${base}/database#currencies`;
  }

  // 11. FACTIONS & REPUTATIONS
  if (kind === "faction" || kind === "reputation") {
    if (numId > 0) return `${base}/faction=${numId}${slug}`;
    return `${base}/database#factions`;
  }

  // 12. DRESSING ROOM
  if (kind === "dressing-room") {
    return `${base}/dressing-room#${rawId || ""}`;
  }

  // DEFAULT: ITEMS / GEAR / WEAPONS / ARMOR / TRANSMOG
  const effectiveItemId = ctx.itemId || numId;
  if (effectiveItemId > 0) {
    return `${base}/item=${effectiveItemId}${slug}`;
  }
  if (ctx.name) {
    return `${base}/search?q=${encodeURIComponent(ctx.name)}#items`;
  }
  return `${base}/database#items`;
}

/** Canonical alias for resolveWowheadUrl */
export const buildWowheadUrl = resolveWowheadUrl;

/**
 * Backward-compatible helper builders with version awareness
 */
export function getWowheadItemUrl(itemId: number | string, version?: string, name?: string): string {
  return resolveWowheadUrl({ kind: "item", id: itemId, version, name });
}

export function getWowheadSpellUrl(spellId: number | string, version?: string, name?: string): string {
  return resolveWowheadUrl({ kind: "spell", id: spellId, version, name });
}

export function getWowheadAchievementUrl(achievementId: number | string, version?: string, name?: string): string {
  return resolveWowheadUrl({ kind: "achievement", id: achievementId, version, name });
}

export function getWowheadMountUrl(
  mountId: number | string,
  itemId?: number,
  version?: string,
  spellId?: number,
  name?: string
): string {
  return resolveWowheadUrl({ kind: "mount", id: mountId, itemId, spellId, version, name });
}

export function getWowheadPetUrl(
  petId: number | string,
  speciesId?: number,
  version?: string,
  itemId?: number,
  name?: string,
  creatureId?: number,
  spellId?: number
): string {
  return resolveWowheadUrl({
    kind: "pet",
    id: petId,
    speciesId,
    itemId,
    version,
    name,
    creatureId,
    spellId,
  });
}

export function getWowheadPetAbilityUrl(abilityIdOrName: number | string, version?: string): string {
  return resolveWowheadUrl({
    kind: "pet-ability",
    id: abilityIdOrName,
    name: typeof abilityIdOrName === "string" ? abilityIdOrName : undefined,
    version,
  });
}

export function getWowheadToyUrl(toyId: number | string, itemId?: number, version?: string, name?: string): string {
  return resolveWowheadUrl({ kind: "toy", id: toyId, itemId, version, name });
}

export function getWowheadCurrencyUrl(currencyId: number | string, version?: string, name?: string): string {
  return resolveWowheadUrl({ kind: "currency", id: currencyId, version, name });
}

export function getWowheadFactionUrl(factionId: number | string, version?: string, name?: string): string {
  return resolveWowheadUrl({ kind: "faction", id: factionId, version, name });
}

export function getWowheadTitleUrl(titleId: number | string, version?: string, name?: string): string {
  return resolveWowheadUrl({ kind: "title", id: titleId, version, name });
}

export function getWowheadQuestUrl(questId: number | string, version?: string, name?: string): string {
  return resolveWowheadUrl({ kind: "quest", id: questId, version, name });
}

export function getWowheadNpcUrl(npcId: number | string, version?: string, name?: string): string {
  return resolveWowheadUrl({ kind: "npc", id: npcId, version, name });
}

export interface WowheadBadgeLinkProps {
  url?: string;
  context?: WoWEntityContext;
  label?: string;
  className?: string;
  compact?: boolean;
}

/**
 * Reusable Wowhead Shortcut Button for Tooltips and Cards
 */
export const WowheadBadgeLink: React.FC<WowheadBadgeLinkProps> = ({
  url,
  context,
  label = "Wowhead",
  className = "",
  compact = false,
}) => {
  const resolvedUrl = url || (context ? resolveWowheadUrl(context) : "https://www.wowhead.com");

  return (
    <a
      href={resolvedUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Abrir página oficial no Wowhead em nova aba"
      className={`inline-flex items-center gap-1 font-bold text-cyan-400 hover:text-cyan-300 hover:underline transition-all cursor-pointer select-none group shrink-0 ${
        compact
          ? "text-[10px] px-1.5 py-0.5 rounded bg-zinc-900/90 border border-cyan-500/30 hover:border-cyan-400"
          : "text-[11px] px-2 py-0.5 rounded-lg bg-cyan-950/40 border border-cyan-500/40 hover:bg-cyan-900/50 shadow-sm"
      } ${className}`}
    >
      <span className="w-2 h-2 rounded-full bg-amber-400 group-hover:scale-110 transition-transform shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
      <span>{label}</span>
      <ExternalLink className="w-2.5 h-2.5 opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
    </a>
  );
};
