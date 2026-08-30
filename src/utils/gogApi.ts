/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { saveGogAuthToFirebase, removeGogAuthFromFirebase } from "./firebase";

const GOG_USERNAME_STORAGE = "halo_gog_username";
const GOG_USER_ID_STORAGE = "halo_gog_user_id";
const GOG_API_KEY_STORAGE = "halo_gog_api_key";
const GOG_OAUTH_TOKEN_STORAGE = "halo_gog_oauth_token";
const GOG_REFRESH_TOKEN_STORAGE = "halo_gog_refresh_token";
const GOG_OAUTH_EXPIRES_STORAGE = "halo_gog_oauth_expires";

export function getStoredGogUsername(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(GOG_USERNAME_STORAGE) || "";
}

export function setStoredGogUsername(val: string, skipCloudSync = false): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(GOG_USERNAME_STORAGE, val.trim());
    if (!skipCloudSync && val.trim()) {
      saveGogAuthToFirebase({
        username: val.trim(),
        userId: getStoredGogUserId(),
        token: getStoredGogOAuthToken(),
        refreshToken: getStoredGogRefreshToken(),
        expiresAt: getGogOAuthExpires() || undefined,
      });
    }
  }
}

export function getStoredGogUserId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(GOG_USER_ID_STORAGE) || "";
}

export function setStoredGogUserId(val: string, skipCloudSync = false): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(GOG_USER_ID_STORAGE, val.trim());
    if (!skipCloudSync && val.trim()) {
      saveGogAuthToFirebase({
        username: getStoredGogUsername(),
        userId: val.trim(),
        token: getStoredGogOAuthToken(),
        refreshToken: getStoredGogRefreshToken(),
        expiresAt: getGogOAuthExpires() || undefined,
      });
    }
  }
}

export function getStoredGogApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(GOG_API_KEY_STORAGE) || "";
}

export function setStoredGogApiKey(val: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(GOG_API_KEY_STORAGE, val.trim());
  }
}

export function getStoredGogOAuthToken(): string {
  if (typeof window === "undefined") return "";
  const token = localStorage.getItem(GOG_OAUTH_TOKEN_STORAGE) || "";
  if (token.startsWith("gog_oauth_") || token.length < 20) return "";
  return token;
}

export function getStoredGogRefreshToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(GOG_REFRESH_TOKEN_STORAGE) || "";
}

export function setStoredGogOAuthToken(
  token: string,
  expiresTimestamp?: number,
  refreshToken?: string,
  skipCloudSync = false
): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(GOG_OAUTH_TOKEN_STORAGE, token.trim());
    if (expiresTimestamp) {
      localStorage.setItem(GOG_OAUTH_EXPIRES_STORAGE, expiresTimestamp.toString());
    }
    if (refreshToken) {
      localStorage.setItem(GOG_REFRESH_TOKEN_STORAGE, refreshToken.trim());
    }

    if (!skipCloudSync && token.trim()) {
      saveGogAuthToFirebase({
        token: token.trim(),
        refreshToken: refreshToken || getStoredGogRefreshToken(),
        expiresAt: expiresTimestamp || getGogOAuthExpires() || undefined,
        username: getStoredGogUsername(),
        userId: getStoredGogUserId(),
      });
    }
  }
}

export function getGogOAuthExpires(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(GOG_OAUTH_EXPIRES_STORAGE);
  return raw ? parseInt(raw, 10) : null;
}

export function clearGogOAuthSession(skipCloudSync = false): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(GOG_OAUTH_TOKEN_STORAGE);
    localStorage.removeItem(GOG_REFRESH_TOKEN_STORAGE);
    localStorage.removeItem(GOG_OAUTH_EXPIRES_STORAGE);
    localStorage.removeItem(GOG_USERNAME_STORAGE);
    localStorage.removeItem(GOG_USER_ID_STORAGE);
    localStorage.removeItem(GOG_API_KEY_STORAGE);

    if (!skipCloudSync) {
      removeGogAuthFromFirebase();
    }
  }
}

export function isGogOAuthConnected(): boolean {
  if (typeof window === "undefined") return false;
  const token = getStoredGogOAuthToken();
  const username = getStoredGogUsername();
  const userId = getStoredGogUserId();

  return !!(username || userId || token);
}

export function getGogOAuthStatus() {
  const isConnected = isGogOAuthConnected();
  const username = getStoredGogUsername();
  const userId = getStoredGogUserId();
  const token = getStoredGogOAuthToken();
  const expiresAt = getGogOAuthExpires();

  return {
    isConnected,
    username,
    userId,
    token,
    expiresAt,
    isPermanent: true,
  };
}


export interface GogPlayerSummary {
  username: string;
  userId: string;
  avatarUrl?: string;
  gamesCount?: number;
}

export interface GogOwnedGame {
  id: string | number;
  title: string;
  slug?: string;
  playtime_minutes: number;
  last_played_timestamp?: number;
  img_icon_url?: string;
}

export interface GogResolvedGame {
  success: boolean;
  gameId: string;
  title: string;
  coverUrl?: string;
  playtime_minutes: number;
  last_played_timestamp?: number;
  isOwned: boolean;
  storeUrl: string;
  achievements?: GogAchievementsResult | null;
}

export interface GogAchievement {
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

export interface GogAchievementsResult {
  gameName?: string;
  achievements?: GogAchievement[];
  unlockedCount: number;
  totalCount: number;
  percentage: number;
  playtime_minutes?: number;
}

/**
 * Exchanges an official GOG Login Code or Redirect URL for full tokens & profile
 */
export async function exchangeGogCode(codeOrUrl: string): Promise<{
  success: boolean;
  username: string;
  userId: string;
  avatarUrl: string;
  gamesCount: number;
  accessToken: string;
  refreshToken: string;
}> {
  const res = await fetch("/api/gog/exchange-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: codeOrUrl }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || `Erro HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data.accessToken) {
    throw new Error("Token de acesso não recebido da GOG.");
  }

  // Save session to localStorage
  setStoredGogOAuthToken(data.accessToken, data.expiresAt, data.refreshToken);
  if (data.username) setStoredGogUsername(data.username);
  if (data.userId) setStoredGogUserId(data.userId);

  return data;
}

/**
 * Refreshes GOG token automatically if expired or nearing expiry
 */
export async function refreshGogTokenIfNeeded(): Promise<string> {
  const token = getStoredGogOAuthToken();
  const refreshToken = getStoredGogRefreshToken();
  const expiresAt = getGogOAuthExpires();

  if (!token) return "";

  // If token is still valid (more than 2 minutes left), return it
  if (expiresAt && expiresAt > Date.now() + 120000) {
    return token;
  }

  if (!refreshToken) return token;

  try {
    const res = await fetch("/api/gog/refresh-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.accessToken) {
        setStoredGogOAuthToken(data.accessToken, data.expiresAt, data.refreshToken);
        if (data.userId) setStoredGogUserId(data.userId);
        return data.accessToken;
      }
    }
  } catch (e) {
    console.warn("Erro ao renovar token da GOG:", e);
  }

  return token;
}

/**
 * Fetches GOG Profile via backend proxy
 */
export async function fetchGogProfile(username?: string, userId?: string): Promise<GogPlayerSummary | null> {
  try {
    const token = await refreshGogTokenIfNeeded();
    const user = username || getStoredGogUsername();
    const id = userId || getStoredGogUserId();
    if (!user && !id && !token) return null;

    const queryParams = new URLSearchParams();
    if (user) queryParams.set("username", user);
    if (id) queryParams.set("userId", id);
    if (token) queryParams.set("token", token);

    const res = await fetch(`/api/gog/profile?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.profile || null;
  } catch (err) {
    console.warn("Erro ao buscar perfil da GOG:", err);
    return null;
  }
}

/**
 * Fetches list of owned games / catalog games from GOG via backend proxy
 */
export async function fetchGogOwnedGames(username?: string, userId?: string, query?: string): Promise<GogOwnedGame[]> {
  try {
    const token = await refreshGogTokenIfNeeded();
    const user = username || getStoredGogUsername();
    const id = userId || getStoredGogUserId();

    const queryParams = new URLSearchParams();
    if (user) queryParams.set("username", user);
    if (id) queryParams.set("userId", id);
    if (token) queryParams.set("token", token);
    if (query) queryParams.set("query", query);

    const res = await fetch(`/api/gog/owned-games?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.games || [];
  } catch (err) {
    console.warn("Erro ao buscar jogos da GOG:", err);
    return [];
  }
}

/**
 * Fetches user achievements for a specific GOG game
 */
export async function fetchGogAchievements(
  gameId: string | number,
  username?: string,
  userId?: string
): Promise<GogAchievementsResult | null> {
  try {
    const token = await refreshGogTokenIfNeeded();
    const user = username || getStoredGogUsername();
    const id = userId || getStoredGogUserId();
    if (!gameId) return null;

    const queryParams = new URLSearchParams({
      gameId: String(gameId),
    });
    if (user) queryParams.set("username", user);
    if (id) queryParams.set("userId", id);
    if (token) queryParams.set("token", token);

    const res = await fetch(`/api/gog/achievements?${queryParams.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success) return null;
    return {
      gameName: data.gameName,
      achievements: data.achievements,
      unlockedCount: data.unlockedCount || 0,
      totalCount: data.totalCount || 0,
      percentage: data.percentage || 0,
      playtime_minutes: data.playtime_minutes || 0,
    };
  } catch (err) {
    console.warn(`Erro ao buscar conquistas da GOG para o jogo ${gameId}:`, err);
    return null;
  }
}

/**
 * Formats GOG playtime in minutes to readable string (e.g. "42h 15m")
 */
export function formatGogPlaytime(minutes: number): string {
  if (!minutes || minutes <= 0 || isNaN(minutes) || minutes > 300000) return "0h";
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (hours === 0) return `${remainingMins}m`;
  if (remainingMins === 0) return `${hours}h`;
  return `${hours}h ${remainingMins}m`;
}

/**
 * Constructs GOG Store Page URL
 */
export function getGogStoreUrl(gameId: string | number): string {
  return `https://www.gog.com/en/game/${gameId}`;
}

/**
 * Constructs GOG Galaxy client protocol URL
 */
export function getGogGalaxyProtocolUrl(gameId: string | number): string {
  return `goggalaxy://openGameView/${gameId}`;
}

/**
 * Resolves any GOG URL, game slug, name or ID and maps against user's owned games and achievements.
 */
export async function resolveGogGame(
  input: string,
  username?: string,
  userId?: string
): Promise<GogResolvedGame | null> {
  try {
    const token = await refreshGogTokenIfNeeded();
    const user = username || getStoredGogUsername();
    const id = userId || getStoredGogUserId();
    if (!input || !input.trim()) return null;

    const queryParams = new URLSearchParams({
      input: input.trim(),
    });
    if (user) queryParams.set("username", user);
    if (id) queryParams.set("userId", id);
    if (token) queryParams.set("token", token);

    const res = await fetch(`/api/gog/resolve-game?${queryParams.toString()}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error || `Erro HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data.success) return null;

    return data as GogResolvedGame;
  } catch (err) {
    console.warn("Erro ao resolver jogo da GOG:", err);
    return null;
  }
}

