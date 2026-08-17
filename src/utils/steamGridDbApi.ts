/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  SteamGridAssetType,
  SteamGridGameCandidate,
  SteamGridMediaItem,
  SteamGridStatusResult
} from "../types";

const STEAMGRIDDB_API_KEY_STORAGE = "haleck_steamgriddb_api_key";
const STEAMGRIDDB_CACHE_PREFIX = "haleck_sgdb_cache_v2_";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

export function getStoredSteamGridApiKey(): string {
  try {
    return localStorage.getItem(STEAMGRIDDB_API_KEY_STORAGE) || "";
  } catch {
    return "";
  }
}

export function setStoredSteamGridApiKey(val: string): void {
  try {
    if (!val) {
      localStorage.removeItem(STEAMGRIDDB_API_KEY_STORAGE);
    } else {
      localStorage.setItem(STEAMGRIDDB_API_KEY_STORAGE, val.trim());
    }
  } catch {
    // Ignore quota errors
  }
}

export function clearSteamGridCache(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STEAMGRIDDB_CACHE_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

function getCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(STEAMGRIDDB_CACHE_PREFIX + key);
    if (!raw) return null;
    const item = JSON.parse(raw);
    if (Date.now() - item.ts > CACHE_TTL_MS) {
      localStorage.removeItem(STEAMGRIDDB_CACHE_PREFIX + key);
      return null;
    }
    return item.data as T;
  } catch {
    return null;
  }
}

function setCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(
      STEAMGRIDDB_CACHE_PREFIX + key,
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch {
    // Storage quota exceeded or private mode
  }
}

function buildAuthQuery(customKey?: string): string {
  const key = customKey !== undefined ? customKey : getStoredSteamGridApiKey();
  return key ? `&apiKey=${encodeURIComponent(key)}` : "";
}

/**
 * Verifica se a chave de API do SteamGridDB está configurada e válida
 */
export async function checkSteamGridStatus(customKey?: string): Promise<SteamGridStatusResult> {
  try {
    const authQuery = buildAuthQuery(customKey);
    const res = await fetch(`/api/steamgriddb/status?_t=${Date.now()}${authQuery}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        connected: false,
        isCustomKey: !!customKey || !!getStoredSteamGridApiKey(),
        message: err.error || "Falha ao conectar com SteamGridDB",
      };
    }
    return await res.json();
  } catch (err: any) {
    return {
      connected: false,
      isCustomKey: !!customKey || !!getStoredSteamGridApiKey(),
      message: err?.message || "Erro de conexão de rede com SteamGridDB",
    };
  }
}

/**
 * Autocomplete / Busca de jogos pelo nome no SteamGridDB
 */
export async function searchSteamGridGames(
  query: string,
  customKey?: string
): Promise<SteamGridGameCandidate[]> {
  const clean = query.trim();
  if (!clean) return [];

  const cacheKey = `search_${clean.toLowerCase()}`;
  const cached = getCache<SteamGridGameCandidate[]>(cacheKey);
  if (cached) return cached;

  const authQuery = buildAuthQuery(customKey);
  const res = await fetch(`/api/steamgriddb/search?q=${encodeURIComponent(clean)}${authQuery}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ao buscar jogos no SteamGridDB (HTTP ${res.status})`);
  }

  const json = await res.json();
  const games: SteamGridGameCandidate[] = Array.isArray(json.games) ? json.games : [];
  setCache(cacheKey, games);
  return games;
}

export interface FetchSteamGridMediaOptions {
  gameId?: number | string;
  query?: string;
  steamAppId?: number | string;
  types?: SteamGridAssetType[];
  nsfw?: boolean | "any";
  humor?: boolean | "any";
}

export interface FetchSteamGridMediaResult {
  media: SteamGridMediaItem[];
  game?: { id: number; name: string };
  candidates: SteamGridGameCandidate[];
  count: number;
}

/**
 * Busca todas as disponibilidades de mídia (Grids, Heroes, Logos, Icons) para um jogo
 */
export async function fetchSteamGridMedia(
  options: FetchSteamGridMediaOptions,
  customKey?: string
): Promise<FetchSteamGridMediaResult> {
  const { gameId, query, steamAppId, types = ["grid", "hero", "logo", "icon"], nsfw = false, humor = false } = options;

  if (!gameId && !query && !steamAppId) {
    return { media: [], candidates: [], count: 0 };
  }

  const typesStr = types.join(",");
  const cacheKey = `media_${gameId || (query ? query.trim().toLowerCase() : steamAppId)}_${typesStr}_${nsfw}_${humor}`;
  const cached = getCache<FetchSteamGridMediaResult>(cacheKey);
  if (cached) return cached;

  let url = `/api/steamgriddb/media?types=${encodeURIComponent(typesStr)}&nsfw=${nsfw}&humor=${humor}`;
  if (gameId) url += `&gameId=${encodeURIComponent(gameId)}`;
  if (query) url += `&q=${encodeURIComponent(query.trim())}`;
  if (steamAppId) url += `&steamAppId=${encodeURIComponent(steamAppId)}`;
  url += buildAuthQuery(customKey);

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ao carregar mídias do SteamGridDB (HTTP ${res.status})`);
  }

  const json = await res.json();
  const result: FetchSteamGridMediaResult = {
    media: Array.isArray(json.media) ? json.media : [],
    game: json.game,
    candidates: Array.isArray(json.candidates) ? json.candidates : [],
    count: json.count || 0,
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Busca especificamente ícones de perfil para um jogo no SteamGridDB
 */
export async function fetchSteamGridIcons(
  options: { gameId?: number | string; query?: string; steamAppId?: number | string },
  customKey?: string
): Promise<{ icons: SteamGridMediaItem[]; game?: { id: number; name: string }; candidates: SteamGridGameCandidate[] }> {
  const { gameId, query, steamAppId } = options;
  if (!gameId && !query && !steamAppId) {
    return { icons: [], candidates: [] };
  }

  const cacheKey = `icons_${gameId || (query ? query.trim().toLowerCase() : steamAppId)}`;
  const cached = getCache<{ icons: SteamGridMediaItem[]; game?: { id: number; name: string }; candidates: SteamGridGameCandidate[] }>(cacheKey);
  if (cached) return cached;

  let url = `/api/steamgriddb/icons?`;
  if (gameId) url += `&gameId=${encodeURIComponent(gameId)}`;
  if (query) url += `&q=${encodeURIComponent(query.trim())}`;
  if (steamAppId) url += `&steamAppId=${encodeURIComponent(steamAppId)}`;
  url += buildAuthQuery(customKey);

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ao carregar ícones do SteamGridDB (HTTP ${res.status})`);
  }

  const json = await res.json();
  const result = {
    icons: Array.isArray(json.icons) ? json.icons : [],
    game: json.game,
    candidates: Array.isArray(json.candidates) ? json.candidates : [],
  };

  setCache(cacheKey, result);
  return result;
}
