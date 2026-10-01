/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Dedicated raw responses local cache with 24h TTL
// Prevents redundant requests to Blizzard API endpoints

import { saveToIndexedDB, loadFromIndexedDB } from "./storageDb";

export const BLIZZARD_CACHE_TTL_24H = 24 * 60 * 60 * 1000; // 24 hours in ms

const L1_RAW_CACHE = new Map<string, { data: any; timestamp: number; ttl: number; endpoint?: string }>();
const DB_PREFIX = "blizz_raw_cache_";

export interface BlizzardRawCacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
  endpoint?: string;
  isFresh: boolean;
}

export function buildBlizzardProfileCacheKey(
  characterName: string,
  realmSlug: string,
  region = "us",
  gameId = "wow",
  version = "retail"
): string {
  const c = characterName.toLowerCase().trim();
  const r = realmSlug.toLowerCase().trim().replace(/['\s_]+/g, "-");
  return `${DB_PREFIX}profile_${region}_${gameId}_${version}_${r}_${c}`;
}

export async function getBlizzardRawCache<T>(cacheKey: string): Promise<BlizzardRawCacheItem<T> | null> {
  const now = Date.now();

  // 1. Check L1 Memory Cache
  if (L1_RAW_CACHE.has(cacheKey)) {
    const mem = L1_RAW_CACHE.get(cacheKey)!;
    const isFresh = now - mem.timestamp < mem.ttl;
    return {
      data: mem.data as T,
      timestamp: mem.timestamp,
      ttl: mem.ttl,
      endpoint: mem.endpoint,
      isFresh,
    };
  }

  // 2. Check IndexedDB
  try {
    const dbItem = await loadFromIndexedDB<{ data: T; timestamp: number; ttl: number; endpoint?: string }>(cacheKey);
    if (dbItem && dbItem.data) {
      const isFresh = now - dbItem.timestamp < (dbItem.ttl || BLIZZARD_CACHE_TTL_24H);
      L1_RAW_CACHE.set(cacheKey, dbItem);
      return {
        data: dbItem.data,
        timestamp: dbItem.timestamp,
        ttl: dbItem.ttl,
        endpoint: dbItem.endpoint,
        isFresh,
      };
    }
  } catch (_) {}

  return null;
}

export async function setBlizzardRawCache<T>(
  cacheKey: string,
  data: T,
  ttl: number = BLIZZARD_CACHE_TTL_24H,
  endpoint?: string
): Promise<void> {
  const item = {
    data,
    timestamp: Date.now(),
    ttl,
    endpoint,
  };

  L1_RAW_CACHE.set(cacheKey, item);

  try {
    await saveToIndexedDB(cacheKey, item);
  } catch (_) {}
}

export async function invalidateBlizzardRawCache(cacheKey: string): Promise<void> {
  L1_RAW_CACHE.delete(cacheKey);
  try {
    await saveToIndexedDB(cacheKey, null);
  } catch (_) {}
}

export async function clearAllBlizzardRawCache(): Promise<void> {
  L1_RAW_CACHE.clear();
}

export async function getBlizzardCacheStats(): Promise<{ count: number; keys: string[]; storageType: string }> {
  return {
    count: L1_RAW_CACHE.size,
    keys: Array.from(L1_RAW_CACHE.keys()),
    storageType: "indexeddb",
  };
}
