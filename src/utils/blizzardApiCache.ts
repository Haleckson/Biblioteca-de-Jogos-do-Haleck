/**
 * Blizzard API Dedicated Local Cache Layer (IndexedDB / LocalStorage)
 *
 * Exclusively caches raw API response payloads from Blizzard services
 * (such as /api/blizzard/wow/character-profile) with a strict TTL of 24h.
 * Prevents redundant network calls, mitigates rate limits, and enables
 * immediate offline-capable and high-speed retrieval of character data.
 */

export interface BlizzardCacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt: number;
  ttlMs: number;
  endpoint: string;
  sizeBytes?: number;
}

export interface BlizzardCacheLookupResult<T = any> {
  data: T;
  timestamp: number;
  ageMs: number;
  isFresh: boolean;
  ttlRemainingMs: number;
}

export const BLIZZARD_CACHE_TTL_24H = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const DB_NAME = "BlizzardApiCacheDB";
const STORE_NAME = "raw_responses";
const DB_VERSION = 1;
const LOCAL_STORAGE_PREFIX = "blizzard_raw_cache:";

// In-memory fallback if IndexedDB and localStorage are both restricted or unavailable
const inMemoryCache = new Map<string, BlizzardCacheEntry>();

let dbPromise: Promise<IDBDatabase | null> | null = null;
let idbAvailable: boolean | null = null;

/**
 * Initializes and retrieves the IndexedDB instance for raw Blizzard responses
 */
function getIndexedDB(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) {
    idbAvailable = false;
    return Promise.resolve(null);
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
          store.createIndex("timestamp", "timestamp", { unique: false });
          store.createIndex("expiresAt", "expiresAt", { unique: false });
          store.createIndex("endpoint", "endpoint", { unique: false });
        }
      };

      request.onsuccess = (event: Event) => {
        idbAvailable = true;
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event: Event) => {
        console.warn("[BlizzardApiCache] IndexedDB error, falling back to LocalStorage:", event);
        idbAvailable = false;
        resolve(null);
      };

      request.onblocked = () => {
        console.warn("[BlizzardApiCache] IndexedDB blocked, falling back to LocalStorage");
        idbAvailable = false;
        resolve(null);
      };
    } catch (err) {
      console.warn("[BlizzardApiCache] Exception opening IndexedDB, falling back:", err);
      idbAvailable = false;
      resolve(null);
    }
  });

  return dbPromise;
}

/**
 * Checks if a cache entry has exceeded its TTL
 */
function isExpired(entry: BlizzardCacheEntry): boolean {
  if (!entry || !entry.expiresAt) return true;
  return Date.now() > entry.expiresAt;
}

/**
 * Generates an authoritative cache key for character profile raw responses
 */
export function buildBlizzardProfileCacheKey(
  characterName: string,
  realmSlug: string,
  region: string = "us",
  gameId: string = "wow-retail",
  version: string = "retail"
): string {
  const normChar = (characterName || "").trim().toLowerCase();
  const normRealm = (realmSlug || "").trim().toLowerCase().replace(/['\s_]+/g, "-");
  const normRegion = (region || "us").trim().toLowerCase();
  const normGameId = (gameId || "wow-retail").trim().toLowerCase();
  const normVersion = (version || "retail").trim().toLowerCase();

  return `raw_profile:${normRegion}:${normGameId}:${normChar}#${normRealm}#${normVersion}`;
}

/**
 * Retrieves a fresh raw API response from the local cache (IndexedDB or LocalStorage fallback).
 * Returns null if the record is missing or expired (> 24h TTL).
 */
export async function getBlizzardRawCache<T = any>(
  key: string
): Promise<BlizzardCacheLookupResult<T> | null> {
  if (!key) return null;

  try {
    const db = await getIndexedDB();
    if (db) {
      return new Promise<BlizzardCacheLookupResult<T> | null>((resolve) => {
        try {
          const transaction = db.transaction([STORE_NAME], "readonly");
          const store = transaction.objectStore(STORE_NAME);
          const request = store.get(key);

          request.onsuccess = () => {
            const entry: BlizzardCacheEntry<T> | undefined = request.result;
            if (!entry) {
              resolve(null);
              return;
            }

            if (isExpired(entry)) {
              // Stale record: schedule eviction and return null
              invalidateBlizzardRawCache(key).catch(() => {});
              resolve(null);
              return;
            }

            const now = Date.now();
            resolve({
              data: entry.data,
              timestamp: entry.timestamp,
              ageMs: now - entry.timestamp,
              isFresh: true,
              ttlRemainingMs: entry.expiresAt - now,
            });
          };

          request.onerror = () => {
            resolve(getFromLocalStorageFallback<T>(key));
          };
        } catch {
          resolve(getFromLocalStorageFallback<T>(key));
        }
      });
    }

    return getFromLocalStorageFallback<T>(key);
  } catch (err) {
    console.warn("[BlizzardApiCache] Erro ao ler cache local:", err);
    return getFromLocalStorageFallback<T>(key);
  }
}

/**
 * Stores a raw Blizzard API response in the local cache with specified TTL (default: 24 hours).
 */
export async function setBlizzardRawCache<T = any>(
  key: string,
  data: T,
  ttlMs: number = BLIZZARD_CACHE_TTL_24H,
  endpoint: string = ""
): Promise<void> {
  if (!key || data === undefined || data === null) return;

  const now = Date.now();
  const expiresAt = now + ttlMs;
  let sizeBytes = 0;

  try {
    const serialized = JSON.stringify(data);
    sizeBytes = serialized.length * 2; // rough UTF-16 byte estimate
  } catch {
    // If not serializable, skip size calculation
  }

  const entry: BlizzardCacheEntry<T> = {
    key,
    data,
    timestamp: now,
    expiresAt,
    ttlMs,
    endpoint,
    sizeBytes,
  };

  try {
    const db = await getIndexedDB();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        try {
          const transaction = db.transaction([STORE_NAME], "readwrite");
          const store = transaction.objectStore(STORE_NAME);
          const request = store.put(entry);

          request.onsuccess = () => resolve();
          request.onerror = (e) => reject(e);
        } catch (e) {
          reject(e);
        }
      });
      // Also update in-memory as backup
      inMemoryCache.set(key, entry);
      return;
    }
  } catch (err) {
    console.warn("[BlizzardApiCache] Falha ao persistir em IndexedDB, usando fallback LocalStorage:", err);
  }

  // Fallback to localStorage or in-memory
  saveToLocalStorageFallback(key, entry);
}

/**
 * Invalidates and removes a specific cached item
 */
export async function invalidateBlizzardRawCache(key: string): Promise<void> {
  if (!key) return;

  inMemoryCache.delete(key);

  try {
    const db = await getIndexedDB();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const transaction = db.transaction([STORE_NAME], "readwrite");
          const store = transaction.objectStore(STORE_NAME);
          const request = store.delete(key);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch {}

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${key}`);
    }
  } catch {}
}

/**
 * Wipes all raw Blizzard responses from the local cache
 */
export async function clearAllBlizzardRawCache(): Promise<void> {
  inMemoryCache.clear();

  try {
    const db = await getIndexedDB();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const transaction = db.transaction([STORE_NAME], "readwrite");
          const store = transaction.objectStore(STORE_NAME);
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch {}

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(LOCAL_STORAGE_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
    }
  } catch {}
}

/**
 * Provides diagnostic statistics about cached raw Blizzard API items
 */
export async function getBlizzardCacheStats(): Promise<{
  count: number;
  keys: string[];
  totalSizeBytes: number;
  storageType: "indexeddb" | "localstorage" | "memory";
}> {
  try {
    const db = await getIndexedDB();
    if (db) {
      return new Promise((resolve) => {
        try {
          const transaction = db.transaction([STORE_NAME], "readonly");
          const store = transaction.objectStore(STORE_NAME);
          const request = store.getAll();

          request.onsuccess = () => {
            const list: BlizzardCacheEntry[] = request.result || [];
            const valid = list.filter((item) => !isExpired(item));
            const totalSize = valid.reduce((sum, item) => sum + (item.sizeBytes || 0), 0);
            resolve({
              count: valid.length,
              keys: valid.map((item) => item.key),
              totalSizeBytes: totalSize,
              storageType: "indexeddb",
            });
          };
          request.onerror = () => resolve(getLocalStorageStats());
        } catch {
          resolve(getLocalStorageStats());
        }
      });
    }
  } catch {}

  return getLocalStorageStats();
}

// ----------------- Fallback Helpers -----------------

function getFromLocalStorageFallback<T = any>(key: string): BlizzardCacheLookupResult<T> | null {
  // 1. Check in-memory map first
  if (inMemoryCache.has(key)) {
    const entry = inMemoryCache.get(key)!;
    if (!isExpired(entry)) {
      const now = Date.now();
      return {
        data: entry.data as T,
        timestamp: entry.timestamp,
        ageMs: now - entry.timestamp,
        isFresh: true,
        ttlRemainingMs: entry.expiresAt - now,
      };
    }
    inMemoryCache.delete(key);
  }

  // 2. Check localStorage
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${key}`);
    if (!raw) return null;

    const entry: BlizzardCacheEntry<T> = JSON.parse(raw);
    if (!entry || isExpired(entry)) {
      window.localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${key}`);
      return null;
    }

    const now = Date.now();
    return {
      data: entry.data,
      timestamp: entry.timestamp,
      ageMs: now - entry.timestamp,
      isFresh: true,
      ttlRemainingMs: entry.expiresAt - now,
    };
  } catch (err) {
    return null;
  }
}

function saveToLocalStorageFallback(key: string, entry: BlizzardCacheEntry): void {
  inMemoryCache.set(key, entry);

  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const serialized = JSON.stringify(entry);
    window.localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${key}`, serialized);
  } catch (quotaError) {
    // If quota exceeded in localStorage, evict oldest items with our prefix
    evictOldestLocalStorageItems();
    try {
      window.localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${key}`, JSON.stringify(entry));
    } catch {
      // In-memory will still hold it
    }
  }
}

function evictOldestLocalStorageItems(): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const items: { key: string; timestamp: number }[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(LOCAL_STORAGE_PREFIX)) {
        try {
          const raw = window.localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            items.push({ key: k, timestamp: parsed.timestamp || 0 });
          }
        } catch {
          items.push({ key: k, timestamp: 0 });
        }
      }
    }
    items.sort((a, b) => a.timestamp - b.timestamp);
    // Remove oldest half
    const removeCount = Math.max(1, Math.ceil(items.length / 2));
    for (let i = 0; i < removeCount && i < items.length; i++) {
      window.localStorage.removeItem(items[i].key);
    }
  } catch {}
}

function getLocalStorageStats(): {
  count: number;
  keys: string[];
  totalSizeBytes: number;
  storageType: "indexeddb" | "localstorage" | "memory";
} {
  const keys: string[] = [];
  let totalSize = 0;

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(LOCAL_STORAGE_PREFIX)) {
          const actualKey = k.replace(LOCAL_STORAGE_PREFIX, "");
          const val = window.localStorage.getItem(k) || "";
          totalSize += (k.length + val.length) * 2;
          keys.push(actualKey);
        }
      }
      return {
        count: keys.length,
        keys,
        totalSizeBytes: totalSize,
        storageType: "localstorage",
      };
    }
  } catch {}

  return {
    count: inMemoryCache.size,
    keys: Array.from(inMemoryCache.keys()),
    totalSizeBytes: 0,
    storageType: "memory",
  };
}
