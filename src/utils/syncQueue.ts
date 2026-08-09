import { showToast } from "./toast";

export interface SyncQueueItem {
  id: string;
  type: "FIREBASE_SAVE";
  payload: {
    games: any[];
    globalTags: string[];
    globalGenres: string[];
  };
  timestamp: string;
  attempts: number;
  lastError?: string;
}

const STORAGE_KEY = "app_sync_queue";
const SYNC_EVENT_NAME = "SYNC_QUEUE_CHANGED";

let isProcessing = false;
let currentExecutor: ((item: SyncQueueItem) => Promise<boolean>) | null = null;

/**
 * Loads the current pending items from localStorage sync queue.
 */
export function getSyncQueue(): SyncQueueItem[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error("Erro ao carregar fila de sincronização:", err);
    return [];
  }
}

/**
 * Recursively strips data: and blob: URIs from payloads to prevent localStorage QuotaExceededError.
 */
function sanitizePayload(val: any): any {
  if (val === undefined) return null;
  if (typeof val === "string") {
    if (val.startsWith("data:") || val.startsWith("blob:")) {
      return "";
    }
    return val;
  }
  if (Array.isArray(val)) {
    return val.map((item) => sanitizePayload(item));
  }
  if (val !== null && typeof val === "object") {
    const obj: Record<string, any> = {};
    for (const key of Object.keys(val)) {
      if (val[key] !== undefined) {
        obj[key] = sanitizePayload(val[key]);
      }
    }
    return obj;
  }
  return val;
}

/**
 * Saves items to localStorage sync queue and notifies components.
 */
function saveSyncQueue(items: SyncQueueItem[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    if (items.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      const sanitized = items.map((item) => ({
        ...item,
        payload: sanitizePayload(item.payload),
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    }
    window.dispatchEvent(new CustomEvent(SYNC_EVENT_NAME, { detail: { count: items.length } }));
  } catch (err) {
    console.error("Erro ao persistir fila de sincronização:", err);
  }
}

/**
 * Returns the count of pending items in the sync queue.
 */
export function getSyncQueueCount(): number {
  return getSyncQueue().length;
}

/**
 * Clears the sync queue.
 */
export function clearSyncQueue(): void {
  saveSyncQueue([]);
}

/**
 * Adds or updates a pending save action to the sync queue.
 * For full-library state updates (FIREBASE_SAVE), it replaces existing queued state to maintain latest snapshot.
 */
export function addToSyncQueue(
  action: {
    type: "FIREBASE_SAVE";
    payload: { games: any[]; globalTags: string[]; globalGenres: string[] };
    lastError?: string;
  },
  quiet = false
): void {
  const currentQueue = getSyncQueue();
  const timestamp = new Date().toISOString();

  // If there's already a pending full save, update its payload with the newest library state
  const existingIdx = currentQueue.findIndex((item) => item.type === action.type);

  if (existingIdx >= 0) {
    currentQueue[existingIdx] = {
      ...currentQueue[existingIdx],
      payload: action.payload,
      timestamp,
      lastError: action.lastError || currentQueue[existingIdx].lastError,
    };
  } else {
    currentQueue.push({
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: action.type,
      payload: action.payload,
      timestamp,
      attempts: 0,
      lastError: action.lastError,
    });
  }

  saveSyncQueue(currentQueue);

  if (!quiet) {
    showToast({
      title: "Salvo Offline (Fila de Sincronização)",
      message: "Modificações salvas localmente. Serão sincronizadas na nuvem assim que a conexão for estabelecida.",
      type: "warning",
    });
  }
}

/**
 * Attempts to process all items currently in the sync queue.
 */
export async function processSyncQueue(
  executor?: (item: SyncQueueItem) => Promise<boolean>
): Promise<boolean> {
  const exec = executor || currentExecutor;
  if (!exec) return false;
  
  if (isProcessing) return false;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return false;
  }

  const queue = getSyncQueue();
  if (queue.length === 0) return true;

  isProcessing = true;
  let allSuccess = true;
  const remainingQueue: SyncQueueItem[] = [];

  for (const item of queue) {
    try {
      item.attempts += 1;
      const success = await exec(item);

      if (success) {
        showToast({
          title: "Sincronização Concluída",
          message: "Alterações pendentes foram salvas na nuvem com sucesso!",
          type: "success",
        });
      } else {
        allSuccess = false;
        item.lastError = "Falha na execução de sincronização.";
        remainingQueue.push(item);
      }
    } catch (err: any) {
      allSuccess = false;
      item.lastError = err?.message || String(err);
      remainingQueue.push(item);
    }
  }

  saveSyncQueue(remainingQueue);
  isProcessing = false;
  return allSuccess;
}

/**
 * Registers an executor and sets up global listeners for 'online' event and periodic retry checks.
 */
export function initSyncQueueListener(
  executor: (item: SyncQueueItem) => Promise<boolean>
): () => void {
  currentExecutor = executor;

  const handleOnline = () => {
    console.log("[SyncQueue] Conexão restabelecida. Processando fila de sincronização...");
    showToast({
      title: "Conexão Restabelecida",
      message: "Reconectado à internet. Sincronizando dados pendentes...",
      type: "info",
    });
    processSyncQueue(executor);
  };

  if (typeof window !== "undefined") {
    window.addEventListener("online", handleOnline);
    
    // Initial check if online and items exist in queue
    if (navigator.onLine && getSyncQueue().length > 0) {
      setTimeout(() => processSyncQueue(executor), 1000);
    }

    // Interval check every 45 seconds if connection returned without event
    const intervalId = setInterval(() => {
      if (navigator.onLine && getSyncQueue().length > 0 && !isProcessing) {
        processSyncQueue(executor);
      }
    }, 45000);

    return () => {
      window.removeEventListener("online", handleOnline);
      clearInterval(intervalId);
    };
  }

  return () => {};
}
