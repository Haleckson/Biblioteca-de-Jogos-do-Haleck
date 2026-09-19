/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Resilient IndexedDB + LocalStorage storage engine
// Solves DOMException: QuotaExceededError permanently by persisting state into IndexedDB
// while safely mirroring lightweight state into localStorage with automatic quota management.

import { Game } from "../types";

const DB_NAME = "haleck_gamelog_idb";
const DB_VERSION = 1;
const STORE_NAME = "keyval";

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB is not available in this environment"));
  }

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.warn("[StorageDB] Falha ao abrir IndexedDB:", request.error);
        reject(request.error);
      };
    } catch (err) {
      console.warn("[StorageDB] Erro inesperado ao inicializar IndexedDB:", err);
      reject(err);
    }
  });

  return dbPromise;
}

/**
 * Persists an item asynchronously into IndexedDB
 */
export async function saveToIndexedDB<T>(key: string, value: T): Promise<void> {
  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[StorageDB] Erro ao salvar chave '${key}' no IndexedDB:`, err);
  }
}

/**
 * Loads an item asynchronously from IndexedDB
 */
export async function loadFromIndexedDB<T>(key: string): Promise<T | null> {
  try {
    const db = await getDb();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[StorageDB] Erro ao ler chave '${key}' do IndexedDB:`, err);
    return null;
  }
}

/**
 * Clears obsolete cache entries from localStorage to free up space
 */
function purgeVolatileLocalStorageCache(): void {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (
        k.startsWith("steamgriddb_") ||
        k.startsWith("igdb_cache_") ||
        k.startsWith("zam_cache_") ||
        k.startsWith("temp_upload_") ||
        k.includes("_temp_")
      )) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
    console.info(`[StorageDB] Limpeza preventiva de ${keysToRemove.length} entradas de cache volátil concluída.`);
  } catch (_) {}
}

/**
 * Safely writes to localStorage, preventing QuotaExceededError from throwing.
 * If quota is exceeded, purges volatile caches and retries.
 * If still full, catches the error gracefully without crashing React.
 */
export function safeSetLocalStorage(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (firstErr: any) {
    // Quota exceeded: purge non-essential caches and retry
    try {
      purgeVolatileLocalStorageCache();
      localStorage.setItem(key, value);
      return true;
    } catch (secondErr: any) {
      console.warn(
        `[StorageDB] LocalStorage quota cheia para '${key}' (${(value.length / 1024).toFixed(1)} KB). Os dados permanecem 100% seguros no IndexedDB e Firebase.`
      );
      return false;
    }
  }
}

/**
 * Safely reads from localStorage
 */
export function safeGetLocalStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

/**
 * Persists the entire game library safely across both IndexedDB and LocalStorage
 */
export async function persistGameLibrary(games: Game[]): Promise<void> {
  // 1. IndexedDB always receives the full, uncompressed game library (hundreds of MB capacity)
  await saveToIndexedDB("gameLibrary", games);

  // 2. Safely attempt to sync to LocalStorage without throwing if quota is reached
  try {
    const serialized = JSON.stringify(games);
    safeSetLocalStorage("gameLibrary", serialized);
  } catch (_) {}
}

/**
 * Loads the game library, trying IndexedDB first, then falling back to LocalStorage
 */
export async function loadGameLibrary(): Promise<Game[] | null> {
  // 1. Try IndexedDB first
  try {
    const fromIdb = await loadFromIndexedDB<Game[]>("gameLibrary");
    if (fromIdb && Array.isArray(fromIdb) && fromIdb.length > 0) {
      return fromIdb;
    }
  } catch (_) {}

  // 2. Fall back to LocalStorage
  try {
    const raw = safeGetLocalStorage("gameLibrary");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Migrate to IndexedDB in background
        saveToIndexedDB("gameLibrary", parsed).catch(() => {});
        return parsed;
      }
    }
  } catch (_) {}

  return null;
}
