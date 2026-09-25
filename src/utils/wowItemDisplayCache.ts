/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Dedicated IndexedDB Cache Engine for World of Warcraft Item ID <-> Display ID Mappings.
// Guarantees 0ms synchronous retrieval during 3D character/item rendering,
// eliminates redundant Blizzard API calls, and enforces model appearance integrity.

import { saveToIndexedDB, loadFromIndexedDB } from "./storageDb";

export interface WoWItemDisplayMapping {
  itemId: number;
  displayId: number;
  slotId: number;
  inventoryType: string;
  name: string;
  iconUrl?: string;
  timestamp: number;
  source?: "seed" | "blizzard_api" | "wowhead";
}

const IDB_ITEM_KEY_PREFIX = "wow_item_display_v1_";
const l1ItemMemoryCache = new Map<number, WoWItemDisplayMapping>();

/**
 * Curated authoritative dictionary of common WoW equipment, weapons, and transmogs
 * seeded directly into IndexedDB on app startup.
 */
export const SEED_ITEM_DISPLAYS: Record<
  number,
  { displayId: number; slotId: number; inventoryType: string; name: string; iconUrl?: string }
> = {
  // Cloth / Priest Curate Set
  157632: { displayId: 127184, slotId: 21, inventoryType: "TWOHWEAPON", name: "Staff of Interwoven Power", iconUrl: "https://render.worldofwarcraft.com/us/icons/56/801012.jpg" },
  157710: { displayId: 117298, slotId: 20, inventoryType: "ROBE", name: "Curate's Robe", iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_chest_cloth_17.jpg" },
  157709: { displayId: 139244, slotId: 6, inventoryType: "WAIST", name: "Curate's Cord", iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_belt_cloth_17.jpg" },
  157711: { displayId: 66904, slotId: 7, inventoryType: "LEGS", name: "Curate's Leggings", iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_pants_cloth_14.jpg" },
  157712: { displayId: 117300, slotId: 8, inventoryType: "FEET", name: "Curate's Boots", iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_boots_cloth_16.jpg" },
  157713: { displayId: 66395, slotId: 9, inventoryType: "WRIST", name: "Curate's Bracers", iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_bracer_cloth_14.jpg" },
  157714: { displayId: 66376, slotId: 10, inventoryType: "HANDS", name: "Curate's Gloves", iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_gauntlets_cloth_14.jpg" },
  157708: { displayId: 40075, slotId: 16, inventoryType: "CLOAK", name: "Curate's Cloak", iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_misc_cape_18.jpg" },

  // Iconic Weapons & Artifacts
  19019: { displayId: 31260, slotId: 21, inventoryType: "TWOHWEAPON", name: "Thunderfury, Blessed Blade of the Windseeker" },
  17182: { displayId: 28438, slotId: 21, inventoryType: "TWOHWEAPON", name: "Sulfuras, Hand of Ragnaros" },
  22589: { displayId: 39597, slotId: 21, inventoryType: "TWOHWEAPON", name: "Atiesh, Greatstaff of the Guardian" },
  32837: { displayId: 45233, slotId: 21, inventoryType: "WEAPONMAINHAND", name: "Warglaive of Azzinoth (Main Hand)" },
  32838: { displayId: 45233, slotId: 22, inventoryType: "WEAPONOFFHAND", name: "Warglaive of Azzinoth (Off Hand)" },
  46017: { displayId: 60232, slotId: 21, inventoryType: "WEAPONMAINHAND", name: "Val'anyr, Hammer of Ancient Kings" },
  49623: { displayId: 65377, slotId: 21, inventoryType: "TWOHWEAPON", name: "Shadowmourne" },
  71086: { displayId: 96350, slotId: 21, inventoryType: "TWOHWEAPON", name: "Dragonwrath, Tarecgosa's Rest" },
  77949: { displayId: 106367, slotId: 21, inventoryType: "WEAPONMAINHAND", name: "Golad, Twilight of Aspects" },
  77950: { displayId: 106367, slotId: 22, inventoryType: "WEAPONOFFHAND", name: "Tiriosh, Nightmare of Ages" },
  128935: { displayId: 147576, slotId: 21, inventoryType: "TWOHWEAPON", name: "Strom'kar, the Warbreaker" },
  128910: { displayId: 147610, slotId: 21, inventoryType: "TWOHWEAPON", name: "Warswords of the Valarjar (Main)" },
  128289: { displayId: 147610, slotId: 22, inventoryType: "WEAPONOFFHAND", name: "Warswords of the Valarjar (Off)" },
  120978: { displayId: 133202, slotId: 21, inventoryType: "TWOHWEAPON", name: "Ashbringer" },
  128860: { displayId: 147522, slotId: 21, inventoryType: "TWOHWEAPON", name: "The Silver Hand" },
  128821: { displayId: 147551, slotId: 21, inventoryType: "TWOHWEAPON", name: "Doomhammer" },
  128868: { displayId: 147573, slotId: 21, inventoryType: "TWOHWEAPON", name: "Felo'melorn" },
  128826: { displayId: 147555, slotId: 21, inventoryType: "TWOHWEAPON", name: "Aluneth, Greatstaff of the Magna" },
  128942: { displayId: 147582, slotId: 21, inventoryType: "TWOHWEAPON", name: "Ebonchill" },
  128937: { displayId: 147578, slotId: 21, inventoryType: "TWOHWEAPON", name: "Ulthalesh, the Deadwind Harvester" },
  128938: { displayId: 147579, slotId: 21, inventoryType: "TWOHWEAPON", name: "Skull of the Man'ari" },
  128940: { displayId: 147581, slotId: 21, inventoryType: "TWOHWEAPON", name: "Scepter of Sargeras" },
  128858: { displayId: 147520, slotId: 21, inventoryType: "TWOHWEAPON", name: "Talonclaw, Spear of the Wild Gods" },
  128808: { displayId: 147539, slotId: 21, inventoryType: "TWOHWEAPON", name: "Titanstrike" },
  128820: { displayId: 147550, slotId: 21, inventoryType: "TWOHWEAPON", name: "Thas'dorah, Legacy of the Windrunners" },
  128872: { displayId: 147575, slotId: 21, inventoryType: "TWOHWEAPON", name: "The Kingslayers" },
  128476: { displayId: 147502, slotId: 21, inventoryType: "TWOHWEAPON", name: "The Dreadblades" },
  128870: { displayId: 147574, slotId: 21, inventoryType: "TWOHWEAPON", name: "Fangs of the Devourer" },
  128933: { displayId: 147577, slotId: 21, inventoryType: "TWOHWEAPON", name: "Maw of the Damned" },
  128292: { displayId: 147501, slotId: 21, inventoryType: "TWOHWEAPON", name: "Blades of the Fallen Prince" },
  128402: { displayId: 147503, slotId: 21, inventoryType: "TWOHWEAPON", name: "Apocalypse" },
  128861: { displayId: 147523, slotId: 21, inventoryType: "TWOHWEAPON", name: "Fu Zan, the Wanderer's Companion" },
  128934: { displayId: 147578, slotId: 21, inventoryType: "TWOHWEAPON", name: "Sheilun, Staff of the Mists" },
  128941: { displayId: 147580, slotId: 21, inventoryType: "TWOHWEAPON", name: "Fists of the Heavens" },
  128857: { displayId: 147519, slotId: 21, inventoryType: "TWOHWEAPON", name: "Scythe of Elune" },
  128822: { displayId: 147552, slotId: 21, inventoryType: "TWOHWEAPON", name: "Fangs of Ashamane" },
  128862: { displayId: 147524, slotId: 21, inventoryType: "TWOHWEAPON", name: "Claws of Ursoc" },
  128306: { displayId: 147504, slotId: 21, inventoryType: "TWOHWEAPON", name: "G'Hanir, the Mother Tree" },
  127829: { displayId: 147499, slotId: 21, inventoryType: "TWOHWEAPON", name: "Twinblades of the Deceiver" },
  128832: { displayId: 147557, slotId: 21, inventoryType: "TWOHWEAPON", name: "Aldrachi Warblades" },

  // Classic Judgment Armor (Paladin T2)
  16955: { displayId: 32266, slotId: 1, inventoryType: "HEAD", name: "Judgement Crown" },
  16953: { displayId: 32274, slotId: 3, inventoryType: "SHOULDER", name: "Judgement Spaulders" },
  16958: { displayId: 32269, slotId: 5, inventoryType: "CHEST", name: "Judgement Breastplate" },
  16952: { displayId: 32273, slotId: 6, inventoryType: "WAIST", name: "Judgement Belt" },
  16954: { displayId: 32267, slotId: 7, inventoryType: "LEGS", name: "Judgement Legplates" },
  16956: { displayId: 32268, slotId: 8, inventoryType: "FEET", name: "Judgement Sabatons" },
  16951: { displayId: 32272, slotId: 9, inventoryType: "WRIST", name: "Judgement Bindings" },
  16957: { displayId: 32271, slotId: 10, inventoryType: "HANDS", name: "Judgement Gauntlets" },

  // Classic Bloodfang Armor (Rogue T2)
  16908: { displayId: 32303, slotId: 1, inventoryType: "HEAD", name: "Bloodfang Hood" },
  16832: { displayId: 32305, slotId: 3, inventoryType: "SHOULDER", name: "Bloodfang Spaulders" },
  16905: { displayId: 32302, slotId: 5, inventoryType: "CHEST", name: "Bloodfang Chestpiece" },
  16910: { displayId: 32301, slotId: 6, inventoryType: "WAIST", name: "Bloodfang Belt" },
  16909: { displayId: 32304, slotId: 7, inventoryType: "LEGS", name: "Bloodfang Pants" },
  16906: { displayId: 32300, slotId: 8, inventoryType: "FEET", name: "Bloodfang Boots" },
  16911: { displayId: 32306, slotId: 9, inventoryType: "WRIST", name: "Bloodfang Bracers" },
  16907: { displayId: 32299, slotId: 10, inventoryType: "HANDS", name: "Bloodfang Gloves" },

  // Classic Nemesis Raiment (Warlock T2)
  16929: { displayId: 32313, slotId: 1, inventoryType: "HEAD", name: "Nemesis Skullcap" },
  16932: { displayId: 32315, slotId: 3, inventoryType: "SHOULDER", name: "Nemesis Spaulders" },
  16931: { displayId: 32312, slotId: 20, inventoryType: "ROBE", name: "Nemesis Robes" },
  16933: { displayId: 32311, slotId: 6, inventoryType: "WAIST", name: "Nemesis Belt" },
  16930: { displayId: 32314, slotId: 7, inventoryType: "LEGS", name: "Nemesis Leggings" },
  16927: { displayId: 32310, slotId: 8, inventoryType: "FEET", name: "Nemesis Boots" },
  16934: { displayId: 32316, slotId: 9, inventoryType: "WRIST", name: "Nemesis Bracers" },
  16928: { displayId: 32309, slotId: 10, inventoryType: "HANDS", name: "Nemesis Gloves" },
};

// Immediately pre-populate in-memory cache with known seeds
for (const [key, val] of Object.entries(SEED_ITEM_DISPLAYS)) {
  const itemId = Number(key);
  l1ItemMemoryCache.set(itemId, {
    itemId,
    displayId: val.displayId,
    slotId: val.slotId,
    inventoryType: val.inventoryType,
    name: val.name,
    iconUrl: val.iconUrl,
    timestamp: Date.now(),
    source: "seed",
  });
}

/**
 * Returns synchronous 0ms item display mapping from L1 memory if available
 */
export function getItemDisplayMappingSync(itemId: number): WoWItemDisplayMapping | null {
  if (!itemId || itemId <= 0) return null;
  return l1ItemMemoryCache.get(itemId) || null;
}

/**
 * Returns synchronous 0ms display ID from L1 memory if available
 */
export function getItemDisplayIdSync(itemId: number): number | null {
  const mapping = getItemDisplayMappingSync(itemId);
  return mapping ? mapping.displayId : null;
}

/**
 * Retrieves item display mapping from L1 memory or persistent IndexedDB
 */
export async function getItemDisplayMapping(itemId: number): Promise<WoWItemDisplayMapping | null> {
  if (!itemId || itemId <= 0) return null;

  // 1. Check fast L1 memory
  const inMem = l1ItemMemoryCache.get(itemId);
  if (inMem && inMem.displayId > 0) {
    return inMem;
  }

  // 2. Check persistent IndexedDB
  const key = `${IDB_ITEM_KEY_PREFIX}${itemId}`;
  try {
    const fromDb = await loadFromIndexedDB<WoWItemDisplayMapping>(key);
    if (fromDb && fromDb.displayId > 0) {
      l1ItemMemoryCache.set(itemId, fromDb);
      return fromDb;
    }
  } catch (err) {
    console.warn(`[WoWItemDisplayCache] Failed reading ${key} from IndexedDB:`, err);
  }

  // 3. Fallback to seed dictionary
  const seed = SEED_ITEM_DISPLAYS[itemId];
  if (seed) {
    const entry: WoWItemDisplayMapping = {
      itemId,
      displayId: seed.displayId,
      slotId: seed.slotId,
      inventoryType: seed.inventoryType,
      name: seed.name,
      iconUrl: seed.iconUrl,
      timestamp: Date.now(),
      source: "seed",
    };
    l1ItemMemoryCache.set(itemId, entry);
    // Asynchronously save to IndexedDB
    saveItemDisplayMapping(entry).catch(() => {});
    return entry;
  }

  return null;
}

/**
 * Persists an item display mapping into both L1 memory and IndexedDB
 */
export async function saveItemDisplayMapping(data: WoWItemDisplayMapping): Promise<void> {
  if (!data || !data.itemId || !data.displayId) return;

  // 1. Update L1
  l1ItemMemoryCache.set(data.itemId, data);

  // 2. Persist to IndexedDB
  const key = `${IDB_ITEM_KEY_PREFIX}${data.itemId}`;
  try {
    await saveToIndexedDB(key, data);
  } catch (err) {
    console.warn(`[WoWItemDisplayCache] Failed saving ${key} to IndexedDB:`, err);
  }
}

/**
 * Persists multiple item display mappings in batch
 */
export async function batchSaveItemDisplayMappings(items: WoWItemDisplayMapping[]): Promise<void> {
  if (!Array.isArray(items) || items.length === 0) return;
  for (const item of items) {
    await saveItemDisplayMapping(item);
  }
}

/**
 * Preloads all known items into IndexedDB cache in the background
 */
export async function preloadKnownItemsToIndexedDB(): Promise<void> {
  const entries: WoWItemDisplayMapping[] = [];
  const now = Date.now();
  for (const [key, val] of Object.entries(SEED_ITEM_DISPLAYS)) {
    entries.push({
      itemId: Number(key),
      displayId: val.displayId,
      slotId: val.slotId,
      inventoryType: val.inventoryType,
      name: val.name,
      iconUrl: val.iconUrl,
      timestamp: now,
      source: "seed",
    });
  }
  await batchSaveItemDisplayMappings(entries);
}

/**
 * Resolves a WoW Item ID to its authoritative 3D Display ID:
 * 1. Checks L1 memory (0ms)
 * 2. Checks IndexedDB (0-2ms)
 * 3. Checks Authoritative Seed Dictionary
 * 4. Calls server proxy /api/blizzard/item-display/:id
 * 5. Caches the result in both L1 and IndexedDB for instant future rendering
 */
export async function resolveWoWItemDisplay(
  itemId: number,
  region = "us"
): Promise<WoWItemDisplayMapping | null> {
  if (!itemId || itemId <= 0) return null;

  // 1 & 2 & 3: L1 + IndexedDB + Seed
  const cached = await getItemDisplayMapping(itemId);
  if (cached && cached.displayId > 0) {
    return cached;
  }

  // 4: Fetch from server Blizzard Item Display proxy
  try {
    const res = await fetch(`/api/blizzard/item-display/${itemId}?region=${encodeURIComponent(region)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.displayId > 0) {
        const entry: WoWItemDisplayMapping = {
          itemId,
          displayId: data.displayId,
          slotId: data.slotId || 0,
          inventoryType: data.inventoryType || "",
          name: data.name || `Item #${itemId}`,
          iconUrl: data.iconUrl,
          timestamp: Date.now(),
          source: "blizzard_api",
        };
        await saveItemDisplayMapping(entry);
        return entry;
      }
    }
  } catch (err) {
    console.warn(`[WoWItemDisplayCache] Network error resolving item display for #${itemId}:`, err);
  }

  return null;
}
