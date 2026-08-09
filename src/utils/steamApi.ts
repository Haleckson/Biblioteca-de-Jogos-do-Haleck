/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const STEAM_KEY_STORAGE = "halo_steam_api_key";
const STEAM_ID_STORAGE = "halo_steam_id64";

// Defaults provided by the user
export const DEFAULT_STEAM_KEY = "AE886B79CDBCCE021188A42F2263D210";
export const DEFAULT_STEAM_ID64 = "76561198066251037";

export function getStoredSteamApiKey(): string {
  if (typeof window === "undefined") return DEFAULT_STEAM_KEY;
  return localStorage.getItem(STEAM_KEY_STORAGE) || DEFAULT_STEAM_KEY;
}

export function setStoredSteamApiKey(key: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STEAM_KEY_STORAGE, key.trim());
  }
}

export function getStoredSteamId64(): string {
  if (typeof window === "undefined") return DEFAULT_STEAM_ID64;
  return localStorage.getItem(STEAM_ID_STORAGE) || DEFAULT_STEAM_ID64;
}

export function setStoredSteamId64(id64: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STEAM_ID_STORAGE, id64.trim());
  }
}

export interface SteamPlayerSummary {
  steamid: string;
  personaname: string;
  profileurl: string;
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
  personastate: number; // 0 Offline, 1 Online, 2 Busy, 3 Away, 4 Snooze, 5 Looking to trade, 6 Looking to play
  gameextrainfo?: string; // Currently playing game title
  gameid?: string; // Currently playing appid
  loccountrycode?: string;
  timecreated?: number;
}

export interface SteamOwnedGame {
  appid: number;
  name: string;
  playtime_forever: number; // In minutes
  playtime_2weeks?: number; // In minutes
  img_icon_url?: string;
  img_logo_url?: string;
  has_community_visible_stats?: boolean;
  rtime_last_played?: number; // Epoch timestamp
}

export interface SteamAchievement {
  apiname: string;
  achieved: number; // 1 or 0
  unlocktime: number;
  name?: string;
  description?: string;
  icon?: string;
  icongray?: string;
  globalPercent?: number;
  isUltraRare?: boolean;
}

export interface SteamAchievementsResult {
  gameName?: string;
  achievements?: SteamAchievement[];
  unlockedCount: number;
  totalCount: number;
  percentage: number;
}

/**
 * Fetches Steam User Profile Summary via backend proxy
 */
export async function fetchSteamProfile(apiKey?: string, steamId?: string): Promise<SteamPlayerSummary | null> {
  try {
    const key = apiKey || getStoredSteamApiKey();
    const id = steamId || getStoredSteamId64();
    if (!key || !id) return null;

    const res = await fetch(`/api/steam/profile?key=${encodeURIComponent(key)}&steamid=${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.profile || null;
  } catch (err) {
    console.warn("Erro ao buscar perfil da Steam:", err);
    return null;
  }
}

/**
 * Fetches list of all owned games from Steam via backend proxy
 */
export async function fetchSteamOwnedGames(apiKey?: string, steamId?: string): Promise<SteamOwnedGame[]> {
  try {
    const key = apiKey || getStoredSteamApiKey();
    const id = steamId || getStoredSteamId64();
    if (!key || !id) return [];

    const res = await fetch(`/api/steam/owned-games?key=${encodeURIComponent(key)}&steamid=${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.games || [];
  } catch (err) {
    console.warn("Erro ao buscar jogos da Steam:", err);
    return [];
  }
}

/**
 * Fetches list of recently played games from Steam via backend proxy
 */
export async function fetchSteamRecentGames(apiKey?: string, steamId?: string): Promise<SteamOwnedGame[]> {
  try {
    const key = apiKey || getStoredSteamApiKey();
    const id = steamId || getStoredSteamId64();
    if (!key || !id) return [];

    const res = await fetch(`/api/steam/recent-games?key=${encodeURIComponent(key)}&steamid=${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.games || [];
  } catch (err) {
    console.warn("Erro ao buscar jogos recentes da Steam:", err);
    return [];
  }
}

/**
 * Fetches user achievements for a specific Steam game
 */
export async function fetchSteamAchievements(
  appid: number | string,
  apiKey?: string,
  steamId?: string
): Promise<SteamAchievementsResult | null> {
  try {
    const key = apiKey || getStoredSteamApiKey();
    const id = steamId || getStoredSteamId64();
    if (!key || !id || !appid) return null;

    const res = await fetch(
      `/api/steam/achievements?key=${encodeURIComponent(key)}&steamid=${encodeURIComponent(id)}&appid=${encodeURIComponent(appid)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success) return null;
    return {
      gameName: data.gameName,
      achievements: data.achievements,
      unlockedCount: data.unlockedCount || 0,
      totalCount: data.totalCount || 0,
      percentage: data.percentage || 0,
    };
  } catch (err) {
    console.warn(`Erro ao buscar conquistas da Steam para appid ${appid}:`, err);
    return null;
  }
}

/**
 * Converts Steam playtime minutes into formatted string (e.g., "48h 30m" or "48.5h")
 */
export function formatSteamPlaytime(minutes: number): string {
  if (!minutes || minutes <= 0) return "0h";
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (hours === 0) return `${remainingMins}m`;
  if (remainingMins === 0) return `${hours}h`;
  return `${hours}h ${remainingMins}m`;
}

/**
 * Constructs the Steam header capsule image URL for a given appid
 */
export function getSteamHeaderImageUrl(appid: number | string): string {
  return `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

/**
 * Checks whether a platform string represents PC / Steam / Windows / Desktop platform
 */
export function isPcPlatform(platformStr?: string): boolean {
  if (!platformStr) return false;
  const p = platformStr.toLowerCase();
  return (
    p.includes("pc") ||
    p.includes("steam") ||
    p.includes("epic") ||
    p.includes("gog") ||
    p.includes("windows") ||
    p.includes("mac") ||
    p.includes("computer") ||
    p.includes("desktop")
  );
}
