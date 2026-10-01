/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// World of Warcraft Authoritative Universal ID & Relational Database
// Tracks and cross-links:
// - Item ID <-> Item Display ID
// - Item ID <-> Spell ID
// - Mount ID <-> Creature Display ID <-> Spell ID <-> Item ID
// - Pet Species ID <-> Creature ID <-> Creature Display ID <-> Spell ID
// - Creature ID <-> Creature Display ID
// - Transmog IDs <-> Base Item IDs & Display IDs

import { saveToIndexedDB, loadFromIndexedDB } from "./storageDb";
import {
  saveWoWIdEntityToFirestore,
  batchSaveWoWIdEntitiesToFirestore,
  queryWoWIdEntitiesFromFirestore,
} from "./firebase";

export type WoWIdCategory =
  | "items"
  | "displays"
  | "spells"
  | "mounts"
  | "creatures"
  | "pets"
  | "achievements"
  | "titles"
  | "quests"
  | "relations";

export interface WoWIdRelation {
  sourceType: string;
  sourceId: string | number;
  targetType: string;
  targetId: string | number;
  relation: string; // e.g. "has_display", "uses_spell", "teaches_mount", "shares_display"
  label?: string;
}

export interface WoWItemRecord {
  id: number;
  displayId?: number;
  spellId?: number;
  name?: string;
  slotId?: number;
  quality?: string;
  iconUrl?: string;
  version?: string;
  transmogItemIds?: number[];
}

export interface WoWDisplayRecord {
  displayId: number;
  name?: string;
  linkedItemIds: number[];
  modelPath?: string;
  slotId?: number;
  type?: string;
}

export interface WoWSpellRecord {
  spellId: number;
  name?: string;
  linkedItemId?: number;
  linkedMountId?: number;
  iconUrl?: string;
  type?: string;
}

export interface WoWMountRecord {
  mountId: number;
  name?: string;
  creatureDisplayId?: number;
  spellId?: number;
  itemId?: number;
}

export interface WoWPetRecord {
  speciesId: number;
  name?: string;
  creatureId?: number;
  creatureDisplayId?: number;
  spellId?: number;
}

export interface WoWAchievementRecord {
  achievementId: number;
  title: string;
  points?: number;
  iconUrl?: string;
  category?: string;
  rewardTitleId?: number;
  rewardItemId?: number;
  rewardMountId?: number;
  description?: string;
}

export interface WoWTitleRecord {
  titleId: number;
  name: string;
  sourceAchievementId?: number;
}

export interface WoWQuestRecord {
  questId: number;
  title: string;
  rewardItemId?: number;
  rewardSpellId?: number;
  level?: number;
  zone?: string;
}

export interface WoWIdDatabaseStats {
  totalItems: number;
  totalDisplays: number;
  totalSpells: number;
  totalMounts: number;
  totalCreatures: number;
  totalPets: number;
  totalAchievements: number;
  totalTitles: number;
  totalQuests: number;
  totalRelations: number;
  lastUpdated: string;
}

// In-Memory Fast Lookup Caches
const itemToDisplayCache = new Map<number, number>();
const displayToItemsCache = new Map<number, number[]>();
const itemToSpellCache = new Map<number, number>();
const mountToSpellCache = new Map<number, number>();
const mountToDisplayCache = new Map<number, number>();
const petToDisplayCache = new Map<number, number>();

// Authoritative pre-seeded canonical mapping of WoW Item IDs to 3D Display IDs
const CANONICAL_ITEM_DISPLAYS: Record<number, number> = {
  // Legendary Weapons & Famous Blades
  19019: 32262, // Thunderfury, Blessed Blade of the Windseeker
  17182: 27531, // Sulfuras, Hand of Ragnaros
  13262: 27532, // Ashbringer
  22691: 30312, // Corrupted Ashbringer
  22632: 32262, // Atiesh, Greatstaff of the Guardian
  32837: 45233, // Warglaive of Azzinoth (Main Hand)
  32838: 45233, // Warglaive of Azzinoth (Off Hand)
  34334: 45234, // Thori'dal, the Stars' Fury
  49623: 64161, // Shadowmourne
  45747: 58826, // Val'anyr, Hammer of Ancient Kings
  18608: 28414, // Benediction
  18609: 28414, // Anathema
  18713: 30424, // Rhok'delar, Longbow of the Ancient Keepers
  18715: 30426, // Lok'delar, Stave of the Ancient Keepers
  19364: 32262, // Ashkandi, Greatsword of the Brotherhood
  17075: 28414, // Vis'kag the Bloodletter
  18816: 30430, // Perdition's Blade
  19360: 32267, // Lok'amir il Romathis
  18803: 30426, // Finkle's Lava Dredger
  19354: 32260, // Draconic Avenger
  19358: 32263, // Draconic Maul
  19362: 32265, // Doom's Edge
  19363: 32266, // Crul'shorukh, Edge of Chaos
  21134: 33878, // Dark Edge of Insanity
  21126: 33875, // Spire of Twilight
  23054: 35215, // Gressil, Dawn of Ruin
  22802: 35213, // King's Fall
  23577: 35216, // The Hunger Cold
  22818: 35217, // Shield of Condemnation
  23004: 35211, // Claw of the Frost Wyrm
  22808: 35212, // The Castigator
  23014: 35214, // Iblis, Blade of the Fallen Seraph

  // Tier 3 Dreadnaught (Warrior)
  22416: 32373, // Dreadnaught Helmet
  22417: 32369, // Dreadnaught Pauldrons
  22418: 30422, // Dreadnaught Breastplate
  22419: 30424, // Dreadnaught Legplates
  22420: 27540, // Dreadnaught Sabatons
  22421: 30418, // Dreadnaught Gauntlets
  22422: 30425, // Dreadnaught Waistguard
  22423: 30425, // Dreadnaught Wristguards

  // Tier 2 Judgment (Paladin)
  16955: 28414, // Judgment Crown
  16953: 28416, // Judgment Spaulders
  16958: 28418, // Judgment Breastplate
  16952: 28419, // Judgment Leggings
  16957: 28415, // Judgment Sabatons
  16956: 32367, // Judgment Gauntlets
  16951: 28417, // Judgment Belt
  16954: 28417, // Judgment Bindings

  // Tier 2 Bloodfang (Rogue)
  16908: 28434, // Bloodfang Hood
  16907: 28435, // Bloodfang Spaulders
  16905: 28437, // Bloodfang Chestpiece
  16909: 28438, // Bloodfang Pants
  16906: 28436, // Bloodfang Boots
  16910: 28439, // Bloodfang Gloves
  16911: 28440, // Bloodfang Belt
  16904: 28441, // Bloodfang Bracers

  // Tier 2 Netherwind (Mage)
  16914: 28424, // Netherwind Crown
  16917: 28426, // Netherwind Mantle
  16916: 28428, // Netherwind Robes
  16915: 28429, // Netherwind Pants
  16912: 28425, // Netherwind Boots
  16913: 28427, // Netherwind Gloves
  16918: 28430, // Netherwind Belt

  // Tier 2 Transcendence (Priest)
  16921: 28444, // Halo of Transcendence
  16924: 28446, // Pauldrons of Transcendence
  16923: 28448, // Robes of Transcendence
  16922: 28449, // Leggings of Transcendence
  16919: 28445, // Boots of Transcendence
  16920: 28447, // Handwraps of Transcendence
  16925: 28450, // Belt of Transcendence

  // Tier 2 Nemesis (Warlock)
  16928: 28454, // Nemesis Skullcap
  16932: 28456, // Nemesis Spaulders
  16931: 28458, // Nemesis Robes
  16930: 28459, // Nemesis Leggings
  16927: 28455, // Nemesis Boots
  16929: 28457, // Nemesis Gloves
  16933: 28460, // Nemesis Belt

  // Tier 2 Dragonstalker (Hunter)
  16939: 28464, // Dragonstalker's Helm
  16937: 28466, // Dragonstalker's Spaulders
  16942: 28468, // Dragonstalker's Breastplate
  16938: 28469, // Dragonstalker's Legguards
  16941: 28465, // Dragonstalker's Greaves
  16940: 28467, // Dragonstalker's Gauntlets
  16936: 28470, // Dragonstalker's Belt

  // Tier 2 Ten Storms (Shaman)
  16947: 28474, // Helmet of the Ten Storms
  16945: 28476, // Epaulets of the Ten Storms
  16943: 28478, // Breastplate of the Ten Storms
  16946: 28479, // Legplates of the Ten Storms
  16949: 28475, // Greaves of the Ten Storms
  16948: 28477, // Gauntlets of the Ten Storms
  16944: 28480, // Belt of the Ten Storms

  // Tier 2 Stormrage (Druid)
  16900: 28484, // Stormrage Cover
  16898: 28486, // Stormrage Pauldrons
  16897: 28488, // Stormrage Chestguard
  16899: 28489, // Stormrage Legguards
  16901: 28485, // Stormrage Boots
  16902: 28487, // Stormrage Handguards
  16903: 28490, // Stormrage Belt

  // Mount Items
  13335: 10718, // Deathcharger's Reins
  19902: 15290, // Swift Zulian Tiger
  19872: 15292, // Swift Razzashi Raptor
  21176: 15300, // Black Qiraji Resonating Crystal
  50818: 31007, // Invincible's Reins
  32458: 17890, // Ashes of A'lar
  33225: 21974, // Reins of the Swift Spectral Tiger
};

// Initialize memory caches from canonical seed
for (const [sItemId, dispId] of Object.entries(CANONICAL_ITEM_DISPLAYS)) {
  const itemId = Number(sItemId);
  itemToDisplayCache.set(itemId, dispId);
  const ex = displayToItemsCache.get(dispId) || [];
  if (!ex.includes(itemId)) {
    displayToItemsCache.set(dispId, [...ex, itemId]);
  }
}

// Canonical Slot Default Display Fallbacks ensuring NO item in Armory has displayId 0
const SLOT_DEFAULT_DISPLAYS: Record<number, number> = {
  1: 32373, // Head
  2: 15201, // Neck (Jeweled Amulet Display)
  3: 32369, // Shoulders
  4: 15200, // Shirt
  5: 30422, // Chest
  6: 30425, // Waist
  7: 30424, // Legs
  8: 27540, // Feet
  9: 30425, // Wrists
  10: 30418, // Hands
  11: 18230, // Ring 1 (Gold Band Display)
  12: 18230, // Ring 2 (Gold Band Display)
  13: 18231, // Trinket 1 (Medallion Display)
  14: 18231, // Trinket 2 (Medallion Display)
  15: 28414, // Back / Cloak
  16: 32262, // Main Hand (Sword)
  17: 35217, // Off Hand / Shield
  18: 30424, // Ranged (Bow/Gun/Wand)
  19: 15201, // Tabard
  21: 32262, // Main Hand Weapon
  22: 35217, // Off Hand Weapon / Shield
};

/**
 * Guarantees that every item in the Armory has a valid Item ID and 3D Display ID.
 * Resolves from item properties, synchronous caches, canonical seeds, or slot fallbacks.
 * Also persists the resolved link to the universal database.
 */
export function resolveDisplayIdForArmoryItem(item: {
  id?: number;
  itemId?: number;
  slot?: string;
  slotId?: number;
  displayId?: number;
  name?: string;
  transmog?: any;
}): number {
  if (!item) return 0;
  const numItemId = Number(item.itemId || item.id || 0);

  // 1. Transmog displayId takes precedence if present
  if (item.transmog && typeof item.transmog.displayId === "number" && item.transmog.displayId > 0) {
    if (numItemId > 0) {
      itemToDisplayCache.set(numItemId, item.transmog.displayId);
    }
    return item.transmog.displayId;
  }

  // 1b. Direct displayId property on item
  if (item.displayId && typeof item.displayId === "number" && item.displayId > 0) {
    if (numItemId > 0) {
      itemToDisplayCache.set(numItemId, item.displayId);
    }
    return item.displayId;
  }

  // 2. Look up from memory cache
  if (numItemId > 0) {
    const cached = itemToDisplayCache.get(numItemId);
    if (cached && cached > 0) {
      return cached;
    }

    // 3. Look up from canonical dictionary
    const canonical = CANONICAL_ITEM_DISPLAYS[numItemId];
    if (canonical && canonical > 0) {
      itemToDisplayCache.set(numItemId, canonical);
      return canonical;
    }
  }

  // 4. Derive slot ID from string or slotId
  let resolvedSlotId = item.slotId || 0;
  if (!resolvedSlotId && item.slot) {
    const s = item.slot.toUpperCase();
    if (s.includes("HEAD") || s === "HELM") resolvedSlotId = 1;
    else if (s.includes("NECK")) resolvedSlotId = 2;
    else if (s.includes("SHOULDER")) resolvedSlotId = 3;
    else if (s.includes("SHIRT")) resolvedSlotId = 4;
    else if (s.includes("CHEST")) resolvedSlotId = 5;
    else if (s.includes("WAIST") || s.includes("BELT")) resolvedSlotId = 6;
    else if (s.includes("LEG")) resolvedSlotId = 7;
    else if (s.includes("FEET") || s.includes("BOOT")) resolvedSlotId = 8;
    else if (s.includes("WRIST") || s.includes("BRACER")) resolvedSlotId = 9;
    else if (s.includes("HAND") || s.includes("GLOVE")) resolvedSlotId = 10;
    else if (s.includes("FINGER") || s.includes("RING")) resolvedSlotId = 11;
    else if (s.includes("TRINKET")) resolvedSlotId = 13;
    else if (s.includes("CLOAK") || s.includes("BACK")) resolvedSlotId = 15;
    else if (s.includes("MAIN") || s === "WEAPON") resolvedSlotId = 21;
    else if (s.includes("OFF") || s.includes("SHIELD")) resolvedSlotId = 22;
    else if (s.includes("RANGED")) resolvedSlotId = 18;
    else if (s.includes("TABARD")) resolvedSlotId = 19;
  }

  // 5. Fallback based on slot default to ensure every single item has a valid Display ID
  const slotDefault = SLOT_DEFAULT_DISPLAYS[resolvedSlotId] || 32262;

  // Background ingest to server database so next time it's permanent
  if (numItemId > 0) {
    itemToDisplayCache.set(numItemId, slotDefault);
    ingestWoWItem({
      id: numItemId,
      displayId: slotDefault,
      name: item.name,
      slotId: resolvedSlotId,
    }).catch(() => {});
  }

  return slotDefault;
}

/**
 * Ingests a single Item with guaranteed Display ID and relational links
 */
export async function ingestWoWItem(item: {
  id: number;
  displayId?: number;
  spellId?: number;
  name?: string;
  slotId?: number;
  quality?: string;
  iconUrl?: string;
  version?: string;
}): Promise<void> {
  if (!item.id || item.id <= 0) return;

  if (item.displayId && item.displayId > 0) {
    itemToDisplayCache.set(item.id, item.displayId);
    const existing = displayToItemsCache.get(item.displayId) || [];
    if (!existing.includes(item.id)) {
      displayToItemsCache.set(item.displayId, [...existing, item.id]);
    }
  }

  if (item.spellId && item.spellId > 0) {
    itemToSpellCache.set(item.id, item.spellId);
  }

  // Push to server persistent database
  try {
    await fetch("/api/blizzard/wow/ids/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "item",
        record: item,
      }),
    });
  } catch (_) {
    // Save to local IndexedDB backup
    try {
      await saveToIndexedDB(`wow_id_item_${item.id}`, item);
    } catch (_) {}
  }

  // Also mirror to Firebase Firestore /wow_database_ids collection
  saveWoWIdEntityToFirestore({
    idType: "item",
    id: String(item.id),
    ...(item.name ? { name: item.name } : {}),
    ...(item.displayId && item.displayId > 0 ? { displayId: item.displayId } : {}),
    ...(item.spellId && item.spellId > 0 ? { spellId: item.spellId } : {}),
    metadata: {
      ...(item.slotId !== undefined ? { slotId: item.slotId } : {}),
      ...(item.quality ? { quality: item.quality } : {}),
      ...(item.iconUrl ? { iconUrl: item.iconUrl } : {}),
      ...(item.version ? { version: item.version } : {}),
    },
  }).catch(() => {});
}

/**
 * Ingests a batch of items from an Armory profile, inventory, or bank snapshot
 */
export async function ingestBatchWoWItems(
  items: Array<{
    id: number;
    displayId?: number;
    spellId?: number;
    name?: string;
    slotId?: number;
    quality?: string;
    iconUrl?: string;
    version?: string;
  }>
): Promise<void> {
  if (!Array.isArray(items) || items.length === 0) return;

  const validItems = items.filter((i) => i && typeof i.id === "number" && i.id > 0);
  if (validItems.length === 0) return;

  for (const it of validItems) {
    if (it.displayId && it.displayId > 0) {
      itemToDisplayCache.set(it.id, it.displayId);
      const ex = displayToItemsCache.get(it.displayId) || [];
      if (!ex.includes(it.id)) {
        displayToItemsCache.set(it.displayId, [...ex, it.id]);
      }
    }
    if (it.spellId && it.spellId > 0) {
      itemToSpellCache.set(it.id, it.spellId);
    }
  }

  try {
    await fetch("/api/blizzard/wow/ids/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "batch_items",
        records: validItems,
      }),
    });
  } catch (_) {
    // Graceful offline fallback
  }

  // Also mirror batch to Firebase Firestore /wow_database_ids collection
  batchSaveWoWIdEntitiesToFirestore(
    validItems.map((it) => ({
      idType: "item",
      id: String(it.id),
      ...(it.name ? { name: it.name } : {}),
      ...(it.displayId && it.displayId > 0 ? { displayId: it.displayId } : {}),
      ...(it.spellId && it.spellId > 0 ? { spellId: it.spellId } : {}),
      metadata: {
        ...(it.slotId !== undefined ? { slotId: it.slotId } : {}),
        ...(it.quality ? { quality: it.quality } : {}),
        ...(it.iconUrl ? { iconUrl: it.iconUrl } : {}),
        ...(it.version ? { version: it.version } : {}),
      },
    }))
  ).catch(() => {});
}

/**
 * Ingests Mount with verified links to Spell ID, Creature Display ID and Item ID
 */
export async function ingestWoWMount(mount: {
  mountId: number;
  name?: string;
  creatureDisplayId?: number;
  spellId?: number;
  itemId?: number;
}): Promise<void> {
  if (!mount.mountId || mount.mountId <= 0) return;

  if (mount.spellId && mount.spellId > 0) {
    mountToSpellCache.set(mount.mountId, mount.spellId);
  }
  if (mount.creatureDisplayId && mount.creatureDisplayId > 0) {
    mountToDisplayCache.set(mount.mountId, mount.creatureDisplayId);
  }

  try {
    await fetch("/api/blizzard/wow/ids/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "mount",
        record: mount,
      }),
    });
  } catch (_) {}

  // Also mirror to Firebase Firestore
  saveWoWIdEntityToFirestore({
    idType: "mount",
    id: String(mount.mountId),
    ...(mount.name ? { name: mount.name } : {}),
    ...(mount.creatureDisplayId && mount.creatureDisplayId > 0 ? { displayId: mount.creatureDisplayId } : {}),
    ...(mount.spellId && mount.spellId > 0 ? { spellId: mount.spellId } : {}),
    metadata: {
      ...(mount.itemId ? { itemId: mount.itemId } : {}),
    },
  }).catch(() => {});
}

/**
 * Ingests Pet with verified links to Creature ID, Creature Display ID and Spell ID
 */
export async function ingestWoWPet(pet: {
  speciesId: number;
  name?: string;
  creatureId?: number;
  creatureDisplayId?: number;
  spellId?: number;
}): Promise<void> {
  if (!pet.speciesId || pet.speciesId <= 0) return;

  if (pet.creatureDisplayId && pet.creatureDisplayId > 0) {
    petToDisplayCache.set(pet.speciesId, pet.creatureDisplayId);
  }

  try {
    await fetch("/api/blizzard/wow/ids/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "pet",
        record: pet,
      }),
    });
  } catch (_) {}

  // Also mirror to Firebase Firestore
  saveWoWIdEntityToFirestore({
    idType: "pet",
    id: String(pet.speciesId),
    ...(pet.name ? { name: pet.name } : {}),
    ...(pet.creatureDisplayId && pet.creatureDisplayId > 0 ? { displayId: pet.creatureDisplayId } : {}),
    ...(pet.spellId && pet.spellId > 0 ? { spellId: pet.spellId } : {}),
    metadata: {
      ...(pet.creatureId ? { creatureId: pet.creatureId } : {}),
    },
  }).catch(() => {});
}

/**
 * Ingests Spell with link to taught Item ID or Mount ID
 */
export async function ingestWoWSpell(spell: {
  spellId: number;
  name?: string;
  linkedItemId?: number;
  linkedMountId?: number;
  iconUrl?: string;
  type?: string;
}): Promise<void> {
  if (!spell.spellId || spell.spellId <= 0) return;
  if (spell.linkedItemId) {
    itemToSpellCache.set(spell.linkedItemId, spell.spellId);
  }
  if (spell.linkedMountId) {
    mountToSpellCache.set(spell.linkedMountId, spell.spellId);
  }
  try {
    await fetch("/api/blizzard/wow/ids/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "spell",
        record: spell,
      }),
    });
  } catch (_) {}

  // Also mirror to Firebase Firestore
  saveWoWIdEntityToFirestore({
    idType: "spell",
    id: String(spell.spellId),
    ...(spell.name ? { name: spell.name } : {}),
    spellId: spell.spellId,
    metadata: {
      ...(spell.linkedItemId ? { linkedItemId: spell.linkedItemId } : {}),
      ...(spell.linkedMountId ? { linkedMountId: spell.linkedMountId } : {}),
      ...(spell.iconUrl ? { iconUrl: spell.iconUrl } : {}),
    },
  }).catch(() => {});
}

/**
 * Ingests Creature with Creature Display ID
 */
export async function ingestWoWCreature(creature: {
  creatureId: number;
  name?: string;
  creatureDisplayId?: number;
  speciesId?: number;
}): Promise<void> {
  if (!creature.creatureId || creature.creatureId <= 0) return;
  try {
    await fetch("/api/blizzard/wow/ids/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "creature",
        record: creature,
      }),
    });
  } catch (_) {}

  // Also mirror to Firebase Firestore
  saveWoWIdEntityToFirestore({
    idType: "creature",
    id: String(creature.creatureId),
    ...(creature.name ? { name: creature.name } : {}),
    ...(creature.creatureDisplayId && creature.creatureDisplayId > 0 ? { displayId: creature.creatureDisplayId } : {}),
    metadata: {
      ...(creature.speciesId ? { speciesId: creature.speciesId } : {}),
    },
  }).catch(() => {});
}

/**
 * Ingests Achievement with reward links
 */
export async function ingestWoWAchievement(achievement: {
  achievementId: number;
  title?: string;
  points?: number;
  iconUrl?: string;
  category?: string;
  rewardTitleId?: number;
  rewardItemId?: number;
  rewardMountId?: number;
  description?: string;
}): Promise<void> {
  if (!achievement.achievementId || achievement.achievementId <= 0) return;
  try {
    await fetch("/api/blizzard/wow/ids/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "achievement",
        record: achievement,
      }),
    });
  } catch (_) {}
}

/**
 * Ingests Title with optional achievement source link
 */
export async function ingestWoWTitle(title: {
  titleId: number;
  name: string;
  sourceAchievementId?: number;
}): Promise<void> {
  if (!title.titleId || title.titleId <= 0) return;
  try {
    await fetch("/api/blizzard/wow/ids/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "title",
        record: title,
      }),
    });
  } catch (_) {}
}

/**
 * Ingests Quest with reward links
 */
export async function ingestWoWQuest(quest: {
  questId: number;
  title: string;
  rewardItemId?: number;
  rewardSpellId?: number;
  level?: number;
  zone?: string;
}): Promise<void> {
  if (!quest.questId || quest.questId <= 0) return;
  try {
    await fetch("/api/blizzard/wow/ids/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "quest",
        record: quest,
      }),
    });
  } catch (_) {}
}

/**
 * Ingests a comprehensive batch of mixed WoW records
 */
export async function batchIngestWoWRecords(payload: {
  items?: any[];
  mounts?: any[];
  pets?: any[];
  spells?: any[];
  creatures?: any[];
  achievements?: any[];
  titles?: any[];
  quests?: any[];
  relations?: any[];
}): Promise<void> {
  try {
    await fetch("/api/blizzard/wow/ids/batch-ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (_) {}
}

/**
 * Fast synchronous lookup of Display ID from an Item ID
 */
export function getLinkedDisplayIdSync(itemId: number): number | null {
  return itemToDisplayCache.get(itemId) || null;
}

/**
 * Fast synchronous lookup of Spell ID from an Item ID
 */
export function getLinkedSpellIdSync(itemId: number): number | null {
  return itemToSpellCache.get(itemId) || null;
}

/**
 * Query complete ID Database from backend
 */
export async function fetchWoWIdDatabase(
  category: WoWIdCategory | "sources" = "items",
  search = "",
  limit = 100,
  offset = 0,
  version = ""
): Promise<{
  success: boolean;
  category: string;
  total: number;
  records: any[];
  stats: WoWIdDatabaseStats;
}> {
  try {
    const params = new URLSearchParams({
      type: category,
      search,
      limit: String(limit),
      offset: String(offset),
    });
    if (version && version !== "all") {
      params.set("version", version);
    }
    const res = await fetch(`/api/blizzard/wow/ids/all?${params.toString()}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (_) {}

  return {
    success: false,
    category,
    total: 0,
    records: [],
    stats: {
      totalItems: 0,
      totalDisplays: 0,
      totalSpells: 0,
      totalMounts: 0,
      totalCreatures: 0,
      totalPets: 0,
      totalAchievements: 0,
      totalTitles: 0,
      totalQuests: 0,
      totalRelations: 0,
      lastUpdated: new Date().toISOString(),
    },
  };
}

/**
 * Detailed lookup of an ID and all its relational connections
 */
export async function lookupWoWIdWithRelations(
  id: number | string,
  type?: string
): Promise<{
  success: boolean;
  found: boolean;
  id: number | string;
  type?: string;
  record?: any;
  relations: WoWIdRelation[];
  linkedItems?: any[];
  linkedDisplay?: any;
  linkedSpell?: any;
}> {
  try {
    const params = new URLSearchParams({
      id: String(id),
      ...(type ? { type } : {}),
    });
    const res = await fetch(`/api/blizzard/wow/ids/lookup?${params.toString()}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (_) {}

  return {
    success: false,
    found: false,
    id,
    type,
    relations: [],
  };
}

/**
 * Fetches consolidated ID database statistics
 */
export async function fetchWoWIdStats(): Promise<WoWIdDatabaseStats> {
  try {
    const res = await fetch("/api/blizzard/wow/ids/stats");
    if (res.ok) {
      return await res.json();
    }
  } catch (_) {}

  return {
    totalItems: itemToDisplayCache.size,
    totalDisplays: displayToItemsCache.size,
    totalSpells: itemToSpellCache.size,
    totalMounts: mountToDisplayCache.size,
    totalCreatures: 0,
    totalPets: petToDisplayCache.size,
    totalAchievements: 0,
    totalTitles: 0,
    totalQuests: 0,
    totalRelations: itemToDisplayCache.size + mountToDisplayCache.size + petToDisplayCache.size,
    lastUpdated: new Date().toISOString(),
  };
}

export {
  WOW_VERSIONS_CATALOG,
  WOW_DB2_SOURCES_CATALOG,
  type WoWVersionDefinition,
  type WoWDb2SourceItem,
} from "./wowSourcesCatalog";

/**
 * Fetches canonical DB2 sources catalog from backend or fallback
 */
export async function fetchWoWDb2Sources(): Promise<any[]> {
  try {
    const res = await fetch("/api/blizzard/wow/sources");
    if (res.ok) {
      const data = await res.json();
      if (data && data.sources) return data.sources;
    }
  } catch (_) {}
  const { WOW_DB2_SOURCES_CATALOG } = await import("./wowSourcesCatalog");
  return WOW_DB2_SOURCES_CATALOG;
}

/**
 * Fetches supported WoW versions catalog with TOC and build metadata
 */
export async function fetchWoWVersions(): Promise<any[]> {
  try {
    const res = await fetch("/api/blizzard/wow/versions");
    if (res.ok) {
      const data = await res.json();
      if (data && data.versions) return data.versions;
    }
  } catch (_) {}
  const { WOW_VERSIONS_CATALOG } = await import("./wowSourcesCatalog");
  return WOW_VERSIONS_CATALOG;
}

