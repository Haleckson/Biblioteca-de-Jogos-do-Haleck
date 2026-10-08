/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * IndexedDB storage for FileSystemDirectoryHandle
 * Allows persisting user-selected WoW Interface/AddOns folder handle across sessions
 * like a native desktop client (CurseForge / WowUp).
 */

const DB_NAME = "HaleckWoWAddonManager";
const STORE_NAME = "handles";
const HANDLE_KEY = "wowAddonsHandle";

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(new Error("IndexedDB não suportado neste navegador."));
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Persists FileSystemDirectoryHandle in IndexedDB
 */
export async function saveStoredDirectoryHandle(handle: any, key: string = HANDLE_KEY): Promise<void> {
  if (!handle) return;
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(handle, key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Aviso ao salvar handle no IndexedDB:", err);
  }
}

/**
 * Retrieves persisted FileSystemDirectoryHandle from IndexedDB
 */
export async function getStoredDirectoryHandle(key: string = HANDLE_KEY): Promise<any | null> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Removes persisted handle from IndexedDB
 */
export async function clearStoredDirectoryHandle(key: string = HANDLE_KEY): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

/**
 * Checks and requests permission for stored handle
 */
export async function verifyHandlePermissions(handle: any, readWrite = true): Promise<boolean> {
  if (!handle) return false;
  try {
    const opts = { mode: readWrite ? "readwrite" : "read" };
    if (typeof handle.queryPermission === "function") {
      const status = await handle.queryPermission(opts);
      if (status === "granted") return true;
    }
    if (typeof handle.requestPermission === "function") {
      const status = await handle.requestPermission(opts);
      return status === "granted";
    }
    return true;
  } catch {
    return false;
  }
}
