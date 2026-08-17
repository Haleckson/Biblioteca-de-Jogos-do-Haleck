/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IgdbGameCandidate, IgdbMediaItem } from "../types";

const IGDB_CLIENT_ID_KEY = "haleck_igdb_client_id";
const IGDB_CLIENT_SECRET_KEY = "haleck_igdb_client_secret";
const IGDB_CACHE_PREFIX = "haleck_igdb_cache_v1_";
const IGDB_RATELIMIT_KEY = "haleck_igdb_ratelimit_state";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

export interface IgdbRateLimitState {
  remaining: number;
  limit: number;
  resetSeconds: number;
  requestsUsed: number;
  lastUpdated: number;
}

export function getStoredIgdbClientId(): string {
  try {
    return localStorage.getItem(IGDB_CLIENT_ID_KEY) || "";
  } catch {
    return "";
  }
}

export function setStoredIgdbClientId(val: string): void {
  try {
    if (!val) {
      localStorage.removeItem(IGDB_CLIENT_ID_KEY);
    } else {
      localStorage.setItem(IGDB_CLIENT_ID_KEY, val.trim());
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function getStoredIgdbClientSecret(): string {
  try {
    return localStorage.getItem(IGDB_CLIENT_SECRET_KEY) || "";
  } catch {
    return "";
  }
}

export function setStoredIgdbClientSecret(val: string): void {
  try {
    if (!val) {
      localStorage.removeItem(IGDB_CLIENT_SECRET_KEY);
    } else {
      localStorage.setItem(IGDB_CLIENT_SECRET_KEY, val.trim());
    }
  } catch {
    // Ignore storage quota errors
  }
}

function getAuthParams(): string {
  const customId = getStoredIgdbClientId();
  const customSecret = getStoredIgdbClientSecret();
  let params = "";
  if (customId) params += `&clientId=${encodeURIComponent(customId)}`;
  if (customSecret) params += `&clientSecret=${encodeURIComponent(customSecret)}`;
  return params;
}

// -------------------------------------------------------------
// RATE LIMIT TELEMETRY MANAGEMENT
// -------------------------------------------------------------

export function getStoredRateLimitInfo(): IgdbRateLimitState {
  try {
    const raw = localStorage.getItem(IGDB_RATELIMIT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const now = Date.now();
      const elapsedSec = Math.floor((now - (parsed.lastUpdated || now)) / 1000);
      const remainingReset = Math.max(0, (parsed.resetSeconds || 60) - elapsedSec);
      
      return {
        remaining: remainingReset === 0 ? parsed.limit || 800 : parsed.remaining,
        limit: parsed.limit || 800,
        resetSeconds: remainingReset === 0 ? 60 : remainingReset,
        requestsUsed: parsed.requestsUsed || 0,
        lastUpdated: parsed.lastUpdated || now,
      };
    }
  } catch {
    // ignore
  }

  return {
    remaining: 800,
    limit: 800,
    resetSeconds: 60,
    requestsUsed: 0,
    lastUpdated: Date.now(),
  };
}

export function saveRateLimitFromResponse(rateLimit?: Partial<IgdbRateLimitState>): IgdbRateLimitState {
  const current = getStoredRateLimitInfo();
  const updated: IgdbRateLimitState = {
    remaining: typeof rateLimit?.remaining === "number" ? rateLimit.remaining : Math.max(0, current.remaining - 1),
    limit: typeof rateLimit?.limit === "number" ? rateLimit.limit : current.limit || 800,
    resetSeconds: typeof rateLimit?.resetSeconds === "number" ? rateLimit.resetSeconds : 60,
    requestsUsed: typeof rateLimit?.requestsUsed === "number" ? rateLimit.requestsUsed : current.requestsUsed + 1,
    lastUpdated: Date.now(),
  };

  try {
    localStorage.setItem(IGDB_RATELIMIT_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("igdb_ratelimit_updated", { detail: updated }));
  } catch {
    // Ignore storage quota
  }

  return updated;
}

// -------------------------------------------------------------
// LOCAL CACHING STRATEGY (LOCALSTORAGE)
// -------------------------------------------------------------

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

function getFromLocalCache<T>(cacheKey: string): T | null {
  try {
    const raw = localStorage.getItem(IGDB_CACHE_PREFIX + cacheKey);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    const now = Date.now();
    if (now - entry.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(IGDB_CACHE_PREFIX + cacheKey);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function saveToLocalCache<T>(cacheKey: string, data: T): void {
  try {
    const entry: CacheEntry<T> = {
      timestamp: Date.now(),
      data,
    };
    localStorage.setItem(IGDB_CACHE_PREFIX + cacheKey, JSON.stringify(entry));
  } catch (e) {
    // If storage is full, prune old IGDB cache keys
    pruneOldCache();
  }
}

function pruneOldCache(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(IGDB_CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    // Remove oldest half
    keysToRemove.slice(0, Math.ceil(keysToRemove.length / 2)).forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore
  }
}

export function getIgdbCacheStats(): { totalEntries: number; estimatedSizeKb: number } {
  try {
    let count = 0;
    let totalChars = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(IGDB_CACHE_PREFIX)) {
        count++;
        const val = localStorage.getItem(key) || "";
        totalChars += key.length + val.length;
      }
    }
    return {
      totalEntries: count,
      estimatedSizeKb: Math.round((totalChars * 2) / 1024),
    };
  } catch {
    return { totalEntries: 0, estimatedSizeKb: 0 };
  }
}

export function clearIgdbLocalCache(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(IGDB_CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore
  }
}

export interface IgdbStatusResult {
  connected: boolean;
  message: string;
  clientIdMasked?: string;
  isCustomKey?: boolean;
  rateLimit?: IgdbRateLimitState;
}

/**
 * Checks connection and validity of IGDB / Twitch credentials
 */
export async function checkIgdbStatus(customId?: string, customSecret?: string): Promise<IgdbStatusResult> {
  try {
    const idParam = customId !== undefined ? customId : getStoredIgdbClientId();
    const secretParam = customSecret !== undefined ? customSecret : getStoredIgdbClientSecret();

    let url = "/api/igdb/status";
    const queryParts: string[] = [];
    if (idParam) queryParts.push(`clientId=${encodeURIComponent(idParam)}`);
    if (secretParam) queryParts.push(`clientSecret=${encodeURIComponent(secretParam)}`);
    if (queryParts.length > 0) url += `?${queryParts.join("&")}`;

    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        connected: false,
        message: err.error || `Erro de conexão HTTP ${res.status}`,
        rateLimit: getStoredRateLimitInfo(),
      };
    }
    const data = await res.json();
    if (data.rateLimit) {
      saveRateLimitFromResponse(data.rateLimit);
    }
    return {
      ...data,
      rateLimit: data.rateLimit || getStoredRateLimitInfo(),
    };
  } catch (err: any) {
    return {
      connected: false,
      message: err?.message || "Não foi possível conectar ao servidor IGDB.",
      rateLimit: getStoredRateLimitInfo(),
    };
  }
}

/**
 * Searches IGDB for games matching a query string (with localStorage caching)
 */
export async function searchIgdbGames(query: string, limit = 8): Promise<IgdbGameCandidate[]> {
  const clean = query.trim();
  if (!clean) return [];

  const cacheKey = `search_${clean.toLowerCase()}_${limit}`;
  const cachedGames = getFromLocalCache<IgdbGameCandidate[]>(cacheKey);
  if (cachedGames) {
    console.log(`[IGDB Cache Hit] Busca por "${clean}" recuperada do localStorage (${cachedGames.length} resultados).`);
    return cachedGames;
  }

  const authParams = getAuthParams();
  const url = `/api/igdb/search?q=${encodeURIComponent(clean)}&limit=${limit}${authParams}`;

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Falha ao buscar no IGDB (${res.status})`);
  }

  const data = await res.json();
  if (data.rateLimit) {
    saveRateLimitFromResponse(data.rateLimit);
  }

  if (data && Array.isArray(data.games)) {
    saveToLocalCache(cacheKey, data.games);
    return data.games;
  }
  return [];
}

/**
 * Fetches details for a specific IGDB game (with localStorage caching)
 */
export async function fetchIgdbGameDetails(gameId: number): Promise<IgdbGameCandidate | null> {
  if (!gameId) return null;

  const cacheKey = `game_${gameId}`;
  const cachedGame = getFromLocalCache<IgdbGameCandidate>(cacheKey);
  if (cachedGame) {
    console.log(`[IGDB Cache Hit] Detalhes do jogo ID ${gameId} recuperados do localStorage.`);
    return cachedGame;
  }

  const authParams = getAuthParams();
  const url = `/api/igdb/game-details?id=${gameId}${authParams}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  if (data.rateLimit) {
    saveRateLimitFromResponse(data.rateLimit);
  }

  if (data && data.game) {
    saveToLocalCache(cacheKey, data.game);
    return data.game;
  }
  return null;
}

/**
 * Fetches all available covers, artworks and screenshots for a game (with localStorage caching)
 */
export async function fetchIgdbMediaGallery(queryOrId: string | number): Promise<IgdbMediaItem[]> {
  if (!queryOrId) return [];

  const cacheKey = `media_${String(queryOrId).toLowerCase().trim()}`;
  const cachedMedia = getFromLocalCache<IgdbMediaItem[]>(cacheKey);
  if (cachedMedia) {
    console.log(`[IGDB Cache Hit] Galeria de mídias de "${queryOrId}" recuperada do localStorage (${cachedMedia.length} itens).`);
    return cachedMedia;
  }

  const authParams = getAuthParams();
  const param = typeof queryOrId === "number" ? `id=${queryOrId}` : `q=${encodeURIComponent(queryOrId)}`;
  const url = `/api/igdb/covers?${param}${authParams}`;

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Falha ao obter galeria do IGDB (${res.status})`);
  }

  const data = await res.json();
  if (data.rateLimit) {
    saveRateLimitFromResponse(data.rateLimit);
  }

  if (data && Array.isArray(data.media)) {
    saveToLocalCache(cacheKey, data.media);
    return data.media;
  }
  return [];
}
