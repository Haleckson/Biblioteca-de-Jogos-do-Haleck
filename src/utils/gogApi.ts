/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const GOG_USERNAME_STORAGE = "halo_gog_username";
const GOG_USER_ID_STORAGE = "halo_gog_user_id";
const GOG_API_KEY_STORAGE = "halo_gog_api_key";
const GOG_OAUTH_TOKEN_STORAGE = "halo_gog_oauth_token";
const GOG_OAUTH_EXPIRES_STORAGE = "halo_gog_oauth_expires";

export function getStoredGogUsername(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(GOG_USERNAME_STORAGE) || "";
}

export function setStoredGogUsername(val: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(GOG_USERNAME_STORAGE, val.trim());
  }
}

export function getStoredGogUserId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(GOG_USER_ID_STORAGE) || "";
}

export function setStoredGogUserId(val: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(GOG_USER_ID_STORAGE, val.trim());
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
  return localStorage.getItem(GOG_OAUTH_TOKEN_STORAGE) || "";
}

export function setStoredGogOAuthToken(token: string, expiresTimestamp?: number): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(GOG_OAUTH_TOKEN_STORAGE, token.trim());
    if (expiresTimestamp) {
      localStorage.setItem(GOG_OAUTH_EXPIRES_STORAGE, expiresTimestamp.toString());
    } else {
      // Default token expiry to 1 year for permanent login simulation unless revoked
      const oneYear = Date.now() + 365 * 24 * 60 * 60 * 1000;
      localStorage.setItem(GOG_OAUTH_EXPIRES_STORAGE, oneYear.toString());
    }
  }
}

export function getGogOAuthExpires(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(GOG_OAUTH_EXPIRES_STORAGE);
  return raw ? parseInt(raw, 10) : null;
}

export function clearGogOAuthSession(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(GOG_OAUTH_TOKEN_STORAGE);
    localStorage.removeItem(GOG_OAUTH_EXPIRES_STORAGE);
    localStorage.removeItem(GOG_USERNAME_STORAGE);
    localStorage.removeItem(GOG_USER_ID_STORAGE);
    localStorage.removeItem(GOG_API_KEY_STORAGE);
  }
}

export function isGogOAuthConnected(): boolean {
  if (typeof window === "undefined") return false;
  const token = getStoredGogOAuthToken();
  const username = getStoredGogUsername();
  const userId = getStoredGogUserId();
  const expires = getGogOAuthExpires();

  if (!username && !userId && !token) return false;
  if (expires && Date.now() > expires) return false;

  return true;
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
  playtime_minutes: number;
  last_played_timestamp?: number;
  img_icon_url?: string;
}

export interface GogAchievement {
  id: string;
  name: string;
  description?: string;
  achieved: boolean;
  unlockTime?: number;
  icon?: string;
}

export interface GogAchievementsResult {
  gameName?: string;
  achievements?: GogAchievement[];
  unlockedCount: number;
  totalCount: number;
  percentage: number;
}

/**
 * Fetches GOG Profile via backend proxy
 */
export async function fetchGogProfile(username?: string, userId?: string): Promise<GogPlayerSummary | null> {
  try {
    const user = username || getStoredGogUsername();
    const id = userId || getStoredGogUserId();
    if (!user && !id) return null;

    const res = await fetch(`/api/gog/profile?username=${encodeURIComponent(user)}&userId=${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.profile || null;
  } catch (err) {
    console.warn("Erro ao buscar perfil da GOG:", err);
    return null;
  }
}

/**
 * Fetches list of owned games from GOG via backend proxy
 */
export async function fetchGogOwnedGames(username?: string, userId?: string): Promise<GogOwnedGame[]> {
  try {
    const user = username || getStoredGogUsername();
    const id = userId || getStoredGogUserId();
    if (!user && !id) return [];

    const res = await fetch(`/api/gog/owned-games?username=${encodeURIComponent(user)}&userId=${encodeURIComponent(id)}`);
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
    const user = username || getStoredGogUsername();
    const id = userId || getStoredGogUserId();
    if (!gameId) return null;

    const res = await fetch(
      `/api/gog/achievements?username=${encodeURIComponent(user)}&userId=${encodeURIComponent(id)}&gameId=${encodeURIComponent(gameId)}`
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
    console.warn(`Erro ao buscar conquistas da GOG para o jogo ${gameId}:`, err);
    return null;
  }
}

/**
 * Formats GOG playtime in minutes to readable string (e.g. "42h 15m")
 */
export function formatGogPlaytime(minutes: number): string {
  if (!minutes || minutes <= 0) return "0h";
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (hours === 0) return `${remainingMins}m`;
  if (remainingMins === 0) return `${hours}h`;
  return `${hours}h ${remainingMins}m`;
}
