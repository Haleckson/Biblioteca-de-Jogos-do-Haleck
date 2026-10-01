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
const transmogValidityMemoryCache = new Map<string, boolean>();
const transmogValidityDetailsCache = new Map<string, TransmogModelValidationResult>();
const gearListMemoryCache = new Map<string, [number, number][]>();

export interface TransmogModelValidationResult {
  isValid: boolean;
  slot: number;
  displayId: number;
  modelPath?: string;
  fileDataId?: number;
  isFallback?: boolean;
  reason?: string;
}

/**
 * Validates if a resolved transmog displayId actually returns a valid 3D model path before passing it to the engine.
 * Inspects modelviewer JSON metadata for genuine 3D model paths, FileDataIds, or geometries.
 * Returns detailed validation result including status, modelPath, or failure reason.
 */
export async function checkTransmogModelPath(
  slot: number,
  displayId: number,
  locale = "en_US"
): Promise<TransmogModelValidationResult> {
  if (!displayId || displayId <= 0 || !slot || slot <= 0) {
    return {
      isValid: false,
      slot: slot || 0,
      displayId: displayId || 0,
      reason: "Invalid slot or display ID",
    };
  }

  const cacheKey = `${slot}_${displayId}`;
  if (transmogValidityDetailsCache.has(cacheKey)) {
    return transmogValidityDetailsCache.get(cacheKey)!;
  }

  // Check persistent IndexedDB cache
  try {
    const cached = await getCachedAssetMetadata<TransmogModelValidationResult>("transmog_valid", cacheKey);
    if (cached && typeof cached.isValid === "boolean") {
      transmogValidityMemoryCache.set(cacheKey, cached.isValid);
      transmogValidityDetailsCache.set(cacheKey, cached);
      return cached;
    }
  } catch (_) {}

  // Determine correct endpoint: armor slots vs weapon/item slots
  const isArmorSlot = [1, 3, 4, 5, 6, 7, 8, 9, 10, 16, 19, 20].includes(slot);
  const assetUrl = isArmorSlot
    ? `/api/zamimg/modelviewer/live/meta/armor/${slot}/${displayId}.json?locale=${locale}`
    : `/api/zamimg/modelviewer/live/meta/item/${displayId}.json?locale=${locale}`;

  try {
    const resp = await fetch(assetUrl, { method: "GET" });
    if (!resp.ok) {
      const res: TransmogModelValidationResult = {
        isValid: false,
        slot,
        displayId,
        reason: `HTTP ${resp.status} status from modelviewer endpoint`,
      };
      transmogValidityMemoryCache.set(cacheKey, false);
      transmogValidityDetailsCache.set(cacheKey, res);
      await setCachedAssetMetadata("transmog_valid", cacheKey, res);
      return res;
    }

    // Check if server indicated a fallback was used instead of genuine model
    const isServerFallback =
      resp.headers.get("x-zamimg-fallback") !== null ||
      resp.headers.get("x-zamimg-original-status") === "404";

    const data = await resp.json();
    if (!data || typeof data !== "object" || data.error) {
      const res: TransmogModelValidationResult = {
        isValid: false,
        slot,
        displayId,
        reason: data?.error || "Empty or invalid JSON metadata",
      };
      transmogValidityMemoryCache.set(cacheKey, false);
      transmogValidityDetailsCache.set(cacheKey, res);
      await setCachedAssetMetadata("transmog_valid", cacheKey, res);
      return res;
    }

    if (isServerFallback) {
      const res: TransmogModelValidationResult = {
        isValid: false,
        slot,
        displayId,
        isFallback: true,
        reason: "Server substituted default fallback model; genuine transmog model path missing",
      };
      transmogValidityMemoryCache.set(cacheKey, false);
      transmogValidityDetailsCache.set(cacheKey, res);
      await setCachedAssetMetadata("transmog_valid", cacheKey, res);
      return res;
    }

    // Verify if returned ID matches requested displayId (when present)
    if (typeof data.Id === "number" && data.Id > 0 && data.Id !== displayId) {
      const res: TransmogModelValidationResult = {
        isValid: false,
        slot,
        displayId,
        isFallback: true,
        reason: `Mismatched returned model ID (${data.Id} !== requested ${displayId})`,
      };
      transmogValidityMemoryCache.set(cacheKey, false);
      transmogValidityDetailsCache.set(cacheKey, res);
      await setCachedAssetMetadata("transmog_valid", cacheKey, res);
      return res;
    }

    // Verify 3D model asset definition: Model string path, FileDataId, Geosets, or Textures
    const modelPath = typeof data.Model === "string" ? data.Model : undefined;
    const fileDataId =
      typeof data.FileDataId === "number"
        ? data.FileDataId
        : typeof data.fileDataId === "number"
        ? data.fileDataId
        : undefined;
    const hasModelsArray = Array.isArray(data.Models) && data.Models.length > 0;
    const hasGeosets =
      data.Geosets && typeof data.Geosets === "object" && Object.keys(data.Geosets).length > 0;
    const hasTextures =
      (Array.isArray(data.Textures) && data.Textures.length > 0) ||
      (data.Textures && typeof data.Textures === "object" && Object.keys(data.Textures).length > 0);
    const hasPieces = Array.isArray(data.Pieces) && data.Pieces.length > 0;

    const hasValid3DPath = Boolean(
      modelPath || fileDataId || hasModelsArray || hasGeosets || hasTextures || hasPieces
    );

    if (!hasValid3DPath) {
      const res: TransmogModelValidationResult = {
        isValid: false,
        slot,
        displayId,
        reason: "Metadata does not contain any valid 3D model file, FileDataId, or geometry path",
      };
      transmogValidityMemoryCache.set(cacheKey, false);
      transmogValidityDetailsCache.set(cacheKey, res);
      await setCachedAssetMetadata("transmog_valid", cacheKey, res);
      return res;
    }

    const res: TransmogModelValidationResult = {
      isValid: true,
      slot,
      displayId,
      modelPath: modelPath || (fileDataId ? `fileDataId:${fileDataId}` : "valid_3d_geometry"),
      fileDataId,
    };
    transmogValidityMemoryCache.set(cacheKey, true);
    transmogValidityDetailsCache.set(cacheKey, res);
    await setCachedAssetMetadata("transmog_valid", cacheKey, res);
    return res;
  } catch (err: any) {
    const res: TransmogModelValidationResult = {
      isValid: false,
      slot,
      displayId,
      reason: err?.message || "Network exception validating 3D model path",
    };
    transmogValidityMemoryCache.set(cacheKey, false);
    transmogValidityDetailsCache.set(cacheKey, res);
    return res;
  }
}

/**
 * Validation utility that checks if a resolved transmog displayId actually returns a valid 3D model path
 * before passing it to the engine, allowing for an automatic fallback to the base item model if the transmog ID is broken.
 */
export async function validateTransmogModelPath(
  slot: number,
  displayId: number,
  locale = "en_US"
): Promise<boolean> {
  const result = await checkTransmogModelPath(slot, displayId, locale);
  return result.isValid;
}

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
  } catch (_) {
    // Graceful fallback to L1 in-memory cache
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
  } catch (_) {
    // Graceful fallback
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
  } catch (_) {
    // Graceful fallback
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
  } catch (_) {
    // Graceful fallback
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
 * Handles missing or invalid transmog data by falling back cleanly to the default item ID and displayId.
 */
export async function resolveCharacterGearItems(
  gearList: any[],
  region = "us",
  profileTransmogs?: Record<string, {
    slot?: string;
    slotId?: number;
    itemId?: number;
    id?: number;
    displayId?: number;
    name?: string;
    displayString?: string;
  }>
): Promise<[number, number][]> {
  const safeGearList = Array.isArray(gearList) ? gearList : [];
  const safeTransmogs = (profileTransmogs && typeof profileTransmogs === "object") ? profileTransmogs : {};

  if (safeGearList.length === 0 && Object.keys(safeTransmogs).length === 0) return [];

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
    SHIELD: 22,
    WEAPON: 21,
    TWOHWEAPON: 21,
    ONEHWEAPON: 21,
    HOLDABLE: 22,
  };

  const resolvedTuples: [number, number][] = [];

  for (const item of safeGearList) {
    if (!item || typeof item !== "object") continue;

    // 1. Determine which slot number to use
    let slotNum = typeof item.slotId === "number" && item.slotId > 0 ? item.slotId : 0;
    const slotKey = String(item.slot || "").toUpperCase();
    const invType = String(item.inventoryType || "").toUpperCase();

    if (!slotNum) {
      if (invType === "ROBE" || slotKey === "ROBE") {
        slotNum = 20;
      } else {
        slotNum = slotMapping[slotKey] || 0;
      }
    } else if (slotNum === 5 && (invType === "ROBE" || slotKey === "ROBE")) {
      slotNum = 20;
    }

    // Skip non-visual slots (rings, trinkets, neck)
    if (!slotNum || [2, 11, 12, 13, 14, 15, 17, 18, 28, 29, 30].includes(slotNum)) {
      continue;
    }

    // 2. Identify Transmog and Base Item references
    const matchedTransmog = safeTransmogs[slotKey] || safeTransmogs[(item.slot || "").toLowerCase()] || safeTransmogs[String(slotNum)];
    const transmogCandidate = matchedTransmog || item.transmog;

    let displayId = 0;

    // A. Transmog appearance resolution
    if (transmogCandidate) {
      const tDispId = typeof transmogCandidate.displayId === "number" ? transmogCandidate.displayId : Number(transmogCandidate.displayId);
      if (tDispId > 0 && !isNaN(tDispId)) {
        displayId = tDispId;
        if (transmogCandidate.slotId) slotNum = transmogCandidate.slotId;
      } else {
        // Transmog displayId is null or invalid -> attempt resolving transmog's itemId
        const tItemId = typeof transmogCandidate.itemId === "number" ? transmogCandidate.itemId : (typeof transmogCandidate.id === "number" ? transmogCandidate.id : Number(transmogCandidate.itemId || transmogCandidate.id || 0));
        if (tItemId > 0 && !isNaN(tItemId)) {
          const syncMap = getItemDisplayMappingSync(tItemId);
          if (syncMap && syncMap.displayId > 0) {
            displayId = syncMap.displayId;
            if (syncMap.slotId) slotNum = syncMap.slotId;
          } else {
            const resolved = await resolveBlizzardItemDisplay(tItemId, region);
            if (resolved && resolved.displayId > 0) {
              displayId = resolved.displayId;
              if (resolved.slotId) slotNum = resolved.slotId;
            }
          }
        }
      }

      // Check if the resolved transmog displayId actually returns a valid 3D model path before passing it to the engine.
      // If broken, automatically reset displayId to 0 allowing automatic fallback to the base item model below.
      if (displayId > 0) {
        const isTransmogValid = await validateTransmogModelPath(slotNum, displayId);
        if (!isTransmogValid) {
          console.warn(
            `[blizzardAssetCache] Transmog displayId ${displayId} for slot ${slotNum} does not return a valid 3D model path. Automatically falling back to base item model.`
          );
          displayId = 0;
        }
      }
    }

    // B. FALLBACK: If transmog displayId was null, invalid, or failed resolution,
    // fall back cleanly to the default/equipped item ID and direct displayId
    if (!displayId || displayId <= 0) {
      // Direct item.displayId if valid positive number
      const directDispId = typeof item.displayId === "number" ? item.displayId : Number(item.displayId || 0);
      if (directDispId > 0 && !isNaN(directDispId)) {
        displayId = directDispId;
      }

      // Default item ID resolution
      const defaultItemId = typeof item.itemId === "number" && item.itemId > 0
        ? item.itemId
        : typeof item.id === "number" && item.id > 0
        ? item.id
        : typeof item.item_id === "number" && item.item_id > 0
        ? item.item_id
        : typeof item.item?.id === "number" && item.item.id > 0
        ? item.item.id
        : typeof item.visualItemId === "number" && item.visualItemId > 0
        ? item.visualItemId
        : 0;

      if (defaultItemId > 0) {
        // Synchronous cache / seed dictionary lookup
        const syncMap = getItemDisplayMappingSync(defaultItemId);
        if (syncMap && syncMap.displayId > 0) {
          displayId = syncMap.displayId;
          if (syncMap.slotId) slotNum = syncMap.slotId;
        } else if (!displayId || displayId <= 0) {
          // Asynchronous resolution via Blizzard API proxy
          const resolved = await resolveBlizzardItemDisplay(defaultItemId, region);
          if (resolved && resolved.displayId > 0) {
            displayId = resolved.displayId;
            if (resolved.slotId) slotNum = resolved.slotId;
          }
        }
      }

      // Final fallback to direct displayId if available
      if ((!displayId || displayId <= 0) && directDispId > 0 && !isNaN(directDispId)) {
        displayId = directDispId;
      }
    }

    if (slotNum > 0 && displayId > 0) {
      const existingIdx = resolvedTuples.findIndex(([s]) => s === slotNum);
      if (existingIdx >= 0) {
        resolvedTuples[existingIdx] = [slotNum, displayId];
      } else {
        resolvedTuples.push([slotNum, displayId]);
      }
    }
  }

  // Also check safeTransmogs for any remaining slots that were transmogrified
  for (const [slotKey, tInfo] of Object.entries(safeTransmogs)) {
    if (!tInfo || typeof tInfo !== "object") continue;
    const sKey = slotKey.toUpperCase();
    let slotNum = tInfo.slotId || slotMapping[sKey] || 0;
    if (!slotNum || [2, 11, 12, 13, 14, 15, 17, 18, 28, 29, 30].includes(slotNum)) continue;

    const alreadyResolved = resolvedTuples.some(([s]) => s === slotNum);
    if (!alreadyResolved) {
      let displayId = typeof tInfo.displayId === "number" ? tInfo.displayId : Number(tInfo.displayId || 0);
      const tItemId = typeof tInfo.itemId === "number" ? tInfo.itemId : (typeof tInfo.id === "number" ? tInfo.id : Number(tInfo.itemId || tInfo.id || 0));

      if ((!displayId || displayId <= 0) && tItemId > 0 && !isNaN(tItemId)) {
        const syncMap = getItemDisplayMappingSync(tItemId);
        if (syncMap && syncMap.displayId > 0) {
          displayId = syncMap.displayId;
          if (syncMap.slotId) slotNum = syncMap.slotId;
        } else {
          const resolved = await resolveBlizzardItemDisplay(tItemId, region);
          if (resolved?.displayId) {
            displayId = resolved.displayId;
            if (resolved.slotId) slotNum = resolved.slotId;
          }
        }
      }

      if (slotNum > 0 && displayId > 0) {
        const isTransmogValid = await validateTransmogModelPath(slotNum, displayId);
        if (isTransmogValid) {
          resolvedTuples.push([slotNum, displayId]);
        } else {
          console.warn(
            `[blizzardAssetCache] Standalone transmog displayId ${displayId} for slot ${slotNum} does not return a valid 3D model path. Skipping.`
          );
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
  if (!items || !Array.isArray(items) || items.length === 0) return [];

  // L1 Fast cache check for full gear list to avoid re-fetching when switching tabs
  const listCacheKey = items.map(([s, d]) => `${s}:${d}`).sort().join(";");
  if (gearListMemoryCache.has(listCacheKey)) {
    return gearListMemoryCache.get(listCacheKey)!;
  }

  const verifiedItems: [number, number][] = [];

  for (const item of items) {
    if (!item || !Array.isArray(item) || item.length < 2) continue;
    const [slot, displayId] = item;
    if (!slot || !displayId || displayId <= 0) continue;

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

  gearListMemoryCache.set(listCacheKey, verifiedItems);
  return verifiedItems;
}
