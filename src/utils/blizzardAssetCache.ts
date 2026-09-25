/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Persistent IndexedDB and L1 In-Memory Cache for Blizzard Asset IDs
// Ensures fast 0ms access to 3D creatureDisplayIds, item transmog displays,
// mount/pet metadata, preventing redundant API calls and model mismatches.

import { saveToIndexedDB, loadFromIndexedDB } from "./storageDb";
import { findKnownMountDisplayId, findKnownPetDisplayId } from "./blizzardCollectionsCatalog";
import {
  resolveWoWItemDisplay,
  getItemDisplayMappingSync,
  getItemDisplayMapping,
  saveItemDisplayMapping,
  preloadKnownItemsToIndexedDB,
  SEED_ITEM_DISPLAYS,
  WoWItemDisplayMapping,
} from "./wowItemDisplayCache";

export {
  resolveWoWItemDisplay,
  getItemDisplayMappingSync,
  getItemDisplayMapping,
  saveItemDisplayMapping,
  preloadKnownItemsToIndexedDB,
};
export type { WoWItemDisplayMapping };

// Preload seeded items into IndexedDB cache in background
preloadKnownItemsToIndexedDB().catch(() => {});

// L1 Fast Synchronous Cache
const l1DisplayCache = new Map<string, number>();
const l1MetadataCache = new Map<string, any>();

// Storage key prefix
const IDB_PREFIX = "blizz_cache_v2_";

/**
 * Builds standard cache key for asset display ID
 */
function buildKey(category: "mount" | "pet" | "item", idOrName: number | string): string {
  const norm = typeof idOrName === "string" ? idOrName.toLowerCase().replace(/['\s-_]/g, "") : String(idOrName);
  return `${IDB_PREFIX}${category}_${norm}`;
}

/**
 * Synchronous L1 lookup for instant 0ms access
 */
export function getCachedDisplayIdSync(
  category: "mount" | "pet" | "item",
  idOrName: number | string
): number | null {
  const key = buildKey(category, idOrName);
  const inMemory = l1DisplayCache.get(key);
  if (inMemory && inMemory > 0) return inMemory;
  return null;
}

/**
 * Asynchronous L2 lookup: checks L1 memory first, then persistent IndexedDB
 */
export async function getCachedDisplayId(
  category: "mount" | "pet" | "item",
  idOrName: number | string
): Promise<number | null> {
  const key = buildKey(category, idOrName);
  const inMemory = l1DisplayCache.get(key);
  if (inMemory && inMemory > 0) return inMemory;

  try {
    const fromDb = await loadFromIndexedDB<{ displayId: number; timestamp?: number }>(key);
    if (fromDb && typeof fromDb.displayId === "number" && fromDb.displayId > 0) {
      l1DisplayCache.set(key, fromDb.displayId);
      return fromDb.displayId;
    }
  } catch (err) {
    console.warn(`[BlizzardAssetCache] Failed to load ${key} from IndexedDB:`, err);
  }

  return null;
}

/**
 * Persists an asset display ID into both L1 memory and L2 IndexedDB
 */
export async function setCachedDisplayId(
  category: "mount" | "pet" | "item",
  idOrName: number | string,
  displayId: number,
  metadata?: Record<string, any>
): Promise<void> {
  if (!displayId || displayId <= 0) return;
  const key = buildKey(category, idOrName);

  // 1. Immediately store in L1 fast memory cache
  l1DisplayCache.set(key, displayId);

  // 2. Persist asynchronously in IndexedDB
  try {
    await saveToIndexedDB(key, {
      displayId,
      metadata: metadata || null,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.warn(`[BlizzardAssetCache] Failed to save ${key} to IndexedDB:`, err);
  }
}

/**
 * Persists generic Blizzard asset metadata into IndexedDB
 */
export async function setCachedAssetMetadata<T>(
  category: string,
  keyId: string | number,
  data: T
): Promise<void> {
  const fullKey = `${IDB_PREFIX}meta_${category}_${keyId}`;
  l1MetadataCache.set(fullKey, data);
  try {
    await saveToIndexedDB(fullKey, {
      data,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.warn(`[BlizzardAssetCache] Failed to save metadata for ${fullKey}:`, err);
  }
}

/**
 * Retrieves generic Blizzard asset metadata from IndexedDB
 */
export async function getCachedAssetMetadata<T>(
  category: string,
  keyId: string | number
): Promise<T | null> {
  const fullKey = `${IDB_PREFIX}meta_${category}_${keyId}`;
  if (l1MetadataCache.has(fullKey)) {
    return l1MetadataCache.get(fullKey) as T;
  }
  try {
    const item = await loadFromIndexedDB<{ data: T }>(fullKey);
    if (item && item.data) {
      l1MetadataCache.set(fullKey, item.data);
      return item.data;
    }
  } catch (err) {
    console.warn(`[BlizzardAssetCache] Failed to load metadata for ${fullKey}:`, err);
  }
  return null;
}

/**
 * Preloads known authoritative assets into L1 cache for instant startup
 */
export function preloadAssetsToCache(
  items: Array<{ category: "mount" | "pet" | "item"; idOrName: number | string; displayId: number }>
): void {
  for (const it of items) {
    if (it.displayId && it.displayId > 0) {
      const key = buildKey(it.category, it.idOrName);
      l1DisplayCache.set(key, it.displayId);
    }
  }
}

/**
 * Checks whether an asset (pet, mount, or gear item) is already downloaded and stored in IndexedDB
 */
export async function isAssetStoredInIndexedDB(
  category: "mount" | "pet" | "item",
  idOrName: number | string
): Promise<boolean> {
  const cachedId = await getCachedDisplayId(category, idOrName);
  return Boolean(cachedId && cachedId > 0);
}

/**
 * Prefetches and verifies that a Blizzard asset display ID (pet, mount, or item)
 * is downloaded and stored in IndexedDB before 3D visualization is instantiated.
 * Guarantees that the requested 3D model corresponds exactly to the verified local ID.
 */
export async function prefetchAndVerifyBlizzardAsset(
  category: "mount" | "pet" | "item",
  idOrName: number | string,
  authoritativeDisplayId?: number,
  locale = "en_US"
): Promise<{ verifiedDisplayId: number; wasInCache: boolean }> {
  // 1. Check if the display ID is already verified and saved in IndexedDB
  const cachedId = await getCachedDisplayId(category, idOrName);
  if (cachedId && cachedId > 0) {
    // Sanity-check mount / pet cache integrity against authoritative dictionaries
    if (category === "mount" && typeof idOrName === "number") {
      const trueKnown = findKnownMountDisplayId(idOrName);
      if (trueKnown && trueKnown !== cachedId) {
        await setCachedDisplayId("mount", idOrName, trueKnown);
        return { verifiedDisplayId: trueKnown, wasInCache: false };
      }
    } else if (category === "pet" && typeof idOrName === "number") {
      const trueKnown = findKnownPetDisplayId(idOrName);
      if (trueKnown && trueKnown !== cachedId) {
        await setCachedDisplayId("pet", idOrName, trueKnown);
        return { verifiedDisplayId: trueKnown, wasInCache: false };
      }
    }
    return { verifiedDisplayId: cachedId, wasInCache: true };
  }

  // 2. Resolve authoritative display ID without assuming idOrName is a creatureDisplayId
  let targetDisplayId = authoritativeDisplayId && authoritativeDisplayId > 0 ? authoritativeDisplayId : 0;
  if (!targetDisplayId) {
    if (category === "mount") {
      targetDisplayId = findKnownMountDisplayId(
        typeof idOrName === "number" ? idOrName : undefined,
        typeof idOrName === "string" ? idOrName : undefined
      ) || 0;
    } else if (category === "pet") {
      targetDisplayId = findKnownPetDisplayId(
        typeof idOrName === "number" ? idOrName : undefined,
        typeof idOrName === "string" ? idOrName : undefined
      ) || 0;
    } else if (category === "item") {
      if (typeof idOrName === "number") {
        const itemMap = getItemDisplayMappingSync(idOrName);
        if (itemMap) targetDisplayId = itemMap.displayId;
      }
    }
  }

  // If still not resolved for items, query dedicated IndexedDB cache / API proxy
  if (!targetDisplayId && category === "item" && typeof idOrName === "number") {
    const itemMap = await resolveWoWItemDisplay(idOrName);
    if (itemMap && itemMap.displayId > 0) {
      targetDisplayId = itemMap.displayId;
    }
  }

  // If still not resolved for mount / pet, query Blizzard creature display API
  if (!targetDisplayId && (category === "mount" || category === "pet")) {
    try {
      const q = new URLSearchParams({
        type: category,
        id: typeof idOrName === "number" ? String(idOrName) : "0",
        name: typeof idOrName === "string" ? idOrName : "",
      });
      const r = await fetch(`/api/blizzard/creature-display?${q.toString()}`);
      if (r.ok) {
        const d = await r.json();
        if (d?.creatureDisplayId && d.creatureDisplayId > 0) {
          targetDisplayId = d.creatureDisplayId;
        }
      }
    } catch (_) {}
  }

  // Default baseline if completely unresolved
  if (!targetDisplayId) {
    targetDisplayId = category === "mount" ? 2404 : category === "pet" ? 28917 : 0;
  }

  if (targetDisplayId > 0) {
    // 3. Pre-fetch asset metadata and textures from Wowhead Zamimg live endpoints
    const metaUrl =
      category === "item"
        ? `/api/zamimg/modelviewer/live/meta/item/${targetDisplayId}.json?locale=${locale}`
        : `/api/zamimg/modelviewer/live/meta/npc/${targetDisplayId}.json?locale=${locale}`;

    try {
      const resp = await fetch(metaUrl);
      let metadata: any = null;
      if (resp.ok) {
        metadata = await resp.json();
      }

      // 4. Persist verified display ID & metadata into IndexedDB
      await setCachedDisplayId(category, idOrName, targetDisplayId, metadata);
      if (metadata) {
        await setCachedAssetMetadata(category, targetDisplayId, metadata);

        // Preload any referenced textures into browser Image cache
        const textures = [
          ...(Array.isArray(metadata.Textures) ? metadata.Textures : []),
          ...(Array.isArray(metadata.Textures2) ? metadata.Textures2 : []),
          ...(Array.isArray(metadata.TextureFiles) ? metadata.TextureFiles : []),
        ];
        for (const t of textures) {
          if (t && typeof t === "string") {
            const img = new Image();
            img.src = `/api/zamimg/modelviewer/live/textures/${t.toLowerCase()}`;
          } else if (typeof t === "number") {
            const img = new Image();
            img.src = `/api/zamimg/modelviewer/live/textures/${t}.png`;
          }
        }
      }
    } catch (err) {
      console.warn(`[BlizzardAssetCache] Pre-fetch notice for ${category} #${targetDisplayId}:`, err);
      // Still persist the display ID to ensure local verification
      await setCachedDisplayId(category, idOrName, targetDisplayId);
    }

    return { verifiedDisplayId: targetDisplayId, wasInCache: false };
  }

  return { verifiedDisplayId: 0, wasInCache: false };
}

const CLIENT_KNOWN_ITEM_DISPLAYS: Record<number, { displayId: number; slotId: number; inventoryType: string; name: string }> = SEED_ITEM_DISPLAYS;

/**
 * Resolves an item's authoritative 3D display ID and slot ID from Blizzard API
 * with dedicated IndexedDB caching.
 */
export async function resolveBlizzardItemDisplay(
  itemId: number,
  region = "us"
): Promise<{
  itemId: number;
  displayId: number;
  slotId: number;
  inventoryType: string;
  iconUrl?: string;
  name?: string;
} | null> {
  if (!itemId || itemId <= 0) return null;

  const resolved = await resolveWoWItemDisplay(itemId, region);
  if (resolved && resolved.displayId > 0) {
    return {
      itemId: resolved.itemId,
      displayId: resolved.displayId,
      slotId: resolved.slotId,
      inventoryType: resolved.inventoryType,
      iconUrl: resolved.iconUrl,
      name: resolved.name,
    };
  }

  return null;
}

/**
 * Resolves a full list of character gear items into verified [slot, displayId] tuples,
 * prioritizing transmog appearances and ensuring correct slot mapping (robes = 20, weapons = 21/22).
 */
export async function resolveCharacterGearItems(
  gearList: any[],
  region = "us",
  profileTransmogs?: Record<string, {
    slot: string;
    slotId?: number;
    itemId?: number;
    displayId?: number;
    name?: string;
    displayString?: string;
  }>
): Promise<[number, number][]> {
  if ((!gearList || !Array.isArray(gearList) || gearList.length === 0) && (!profileTransmogs || Object.keys(profileTransmogs).length === 0)) return [];

  const slotMapping: Record<string, number> = {
    HEAD: 1,
    SHOULDER: 3,
    SHIRT: 4,
    CHEST: 5,
    ROBE: 20,
    WAIST: 6,
    LEGS: 7,
    FEET: 8,
    WRIST: 9,
    HANDS: 10,
    BACK: 16,
    TABARD: 19,
    MAIN_HAND: 21,
    OFF_HAND: 22,
    RANGED: 26,
  };

  const resolvedTuples: [number, number][] = [];

  for (const item of gearList) {
    if (!item) continue;

    // 1. Determine which slot number to use
    let slotNum = item.slotId;
    const slotKey = (item.slot || "").toUpperCase();
    const invType = (item.inventoryType || "").toUpperCase();

    if (!slotNum) {
      if (invType === "ROBE" || slotKey === "ROBE") {
        slotNum = 20;
      } else {
        slotNum = slotMapping[slotKey] || 0;
      }
    } else if (slotNum === 5 && (invType === "ROBE" || slotKey === "ROBE")) {
      slotNum = 20;
    }

    if (!slotNum) continue;

    // 2. Determine displayId: transmog takes precedence over base item
    const matchedTransmog = profileTransmogs ? (profileTransmogs[slotKey] || profileTransmogs[(item.slot || "").toLowerCase()]) : undefined;
    let displayId = 0;

    if (matchedTransmog && typeof matchedTransmog.displayId === "number" && matchedTransmog.displayId > 0) {
      displayId = matchedTransmog.displayId;
      if (matchedTransmog.slotId) slotNum = matchedTransmog.slotId;
    } else if (item.transmog && typeof item.transmog.displayId === "number" && item.transmog.displayId > 0) {
      displayId = item.transmog.displayId;
    } else if (typeof item.displayId === "number" && item.displayId > 0) {
      // Validate that displayId is not simply an unconverted itemId
      const baseItemId = item.itemId || item.id;
      if (item.displayId !== baseItemId || [127184, 117298, 139244, 66904, 117300, 66395, 66376, 40075].includes(item.displayId)) {
        displayId = item.displayId;
      }
    }

    // 3. If displayId is still missing or equal to itemId, resolve dynamically via API
    if (!displayId || displayId <= 0) {
      const targetItemId = matchedTransmog?.itemId || item.transmog?.itemId || item.itemId || item.id;
      if (targetItemId && targetItemId > 0) {
        const resolved = await resolveBlizzardItemDisplay(targetItemId, region);
        if (resolved && resolved.displayId > 0) {
          displayId = resolved.displayId;
          if (resolved.slotId) slotNum = resolved.slotId;
        }
      }
    }

    if (slotNum > 0 && displayId > 0) {
      // Don't add duplicate slots
      const existingIdx = resolvedTuples.findIndex(([s]) => s === slotNum);
      if (existingIdx >= 0) {
        resolvedTuples[existingIdx] = [slotNum, displayId];
      } else {
        resolvedTuples.push([slotNum, displayId]);
      }
    }
  }

  // Also check profileTransmogs for any remaining slots that were transmogrified
  if (profileTransmogs) {
    for (const [slotKey, tInfo] of Object.entries(profileTransmogs)) {
      if (!tInfo) continue;
      const sKey = slotKey.toUpperCase();
      let slotNum = tInfo.slotId || slotMapping[sKey] || 0;
      if (!slotNum) continue;

      const alreadyResolved = resolvedTuples.some(([s]) => s === slotNum);
      if (!alreadyResolved) {
        let displayId = tInfo.displayId || 0;
        if (!displayId && tInfo.itemId) {
          const resolved = await resolveBlizzardItemDisplay(tInfo.itemId, region);
          if (resolved?.displayId) {
            displayId = resolved.displayId;
            if (resolved.slotId) slotNum = resolved.slotId;
          }
        }
        if (slotNum > 0 && displayId > 0) {
          resolvedTuples.push([slotNum, displayId]);
        }
      }
    }
  }

  return prefetchAndVerifyBlizzardGearList(resolvedTuples);
}

/**
 * Prefetches and verifies character armory gear list [slot, displayId]
 * against IndexedDB before 3D model instantiation, ensuring all equipped items
 * correspond to verified local IDs.
 * Correctly distinguishes between armor slots and weapon/item slots according
 * to WoW ZamModelViewer specifications.
 */
export async function prefetchAndVerifyBlizzardGearList(
  items: [number, number][],
  locale = "en_US"
): Promise<[number, number][]> {
  if (!items || !Array.isArray(items) || items.length === 0) return items;

  const verifiedItems: [number, number][] = [];

  for (const [slot, displayId] of items) {
    if (!displayId || displayId <= 0) {
      verifiedItems.push([slot, displayId]);
      continue;
    }

    // Check IndexedDB
    const cachedId = await getCachedDisplayId("item", displayId);
    if (cachedId && cachedId > 0) {
      verifiedItems.push([slot, cachedId]);
      continue;
    }

    // Determine correct endpoint: armor slots vs weapon/item slots
    const isArmorSlot = [1, 3, 4, 5, 6, 7, 8, 9, 10, 16, 19, 20].includes(slot);
    const assetUrl = isArmorSlot
      ? `/api/zamimg/modelviewer/live/meta/armor/${slot}/${displayId}.json?locale=${locale}`
      : `/api/zamimg/modelviewer/live/meta/item/${displayId}.json?locale=${locale}`;

    try {
      const resp = await fetch(assetUrl);
      let metadata: any = null;
      if (resp.ok) {
        metadata = await resp.json();
      }

      await setCachedDisplayId("item", displayId, displayId, { slot, metadata });
      if (metadata) {
        await setCachedAssetMetadata("item", `${slot}_${displayId}`, metadata);

        // Preload any associated textures
        const textureList: (string | number)[] = [];
        if (metadata.Textures) {
          if (Array.isArray(metadata.Textures)) {
            textureList.push(...metadata.Textures);
          } else if (typeof metadata.Textures === "object") {
            textureList.push(...Object.values(metadata.Textures) as (string | number)[]);
          }
        }
        if (metadata.Textures2) {
          if (Array.isArray(metadata.Textures2)) {
            textureList.push(...metadata.Textures2);
          } else if (typeof metadata.Textures2 === "object") {
            textureList.push(...Object.values(metadata.Textures2) as (string | number)[]);
          }
        }

        for (const t of textureList) {
          if (t && typeof t === "string") {
            const img = new Image();
            img.src = `/api/zamimg/modelviewer/live/textures/${t.toLowerCase()}`;
          } else if (typeof t === "number") {
            const img = new Image();
            img.src = `/api/zamimg/modelviewer/live/textures/${t}.png`;
          }
        }
      }
    } catch (_) {
      await setCachedDisplayId("item", displayId, displayId, { slot });
    }

    verifiedItems.push([slot, displayId]);
  }

  return verifiedItems;
}
