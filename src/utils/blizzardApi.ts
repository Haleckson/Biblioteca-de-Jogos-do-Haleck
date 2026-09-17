/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BlizzardOfficialGame,
  BlizzardCharacterSummary,
  BlizzardGearItem,
  BlizzardProfileData,
} from "../types";
import { saveBlizzardAuthToFirebase, removeBlizzardAuthFromFirebase } from "./firebase";

// Official Blizzard Game Catalog with focus on WoW and major franchises
export const BLIZZARD_OFFICIAL_GAMES: BlizzardOfficialGame[] = [
  {
    id: "wow-retail",
    name: "World of Warcraft (The War Within / Retail)",
    category: "warcraft",
    icon: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=200",
    hasCharacterArmory: true,
    isWow: true,
    wowVersion: "retail",
  },
  {
    id: "wow-forever",
    name: "World of Warcraft Forever (Classic 2026+ / Beta)",
    category: "warcraft",
    icon: "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=200",
    hasCharacterArmory: true,
    isWow: true,
    wowVersion: "forever",
  },
  {
    id: "wow-classic",
    name: "World of Warcraft Classic Era",
    category: "warcraft",
    icon: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=200",
    hasCharacterArmory: true,
    isWow: true,
    wowVersion: "classic",
  },
  {
    id: "wow-tbc",
    name: "World of Warcraft Burning Crusade / Progression",
    category: "warcraft",
    icon: "https://images.unsplash.com/photo-1501854140801-50d01698950b?q=80&w=200",
    hasCharacterArmory: true,
    isWow: true,
    wowVersion: "tbc",
  },
  {
    id: "warcraft-3",
    name: "Warcraft III: Reforged",
    category: "warcraft",
    icon: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=200",
    hasCharacterArmory: false,
    isWow: false,
  },
  {
    id: "diablo-4",
    name: "Diablo IV",
    category: "diablo",
    icon: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=200",
    hasCharacterArmory: false,
    isWow: false,
  },
  {
    id: "diablo-2-resurrected",
    name: "Diablo II: Resurrected",
    category: "diablo",
    icon: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=200",
    hasCharacterArmory: false,
    isWow: false,
  },
  {
    id: "overwatch-2",
    name: "Overwatch 2",
    category: "overwatch",
    icon: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=200",
    hasCharacterArmory: false,
    isWow: false,
  },
  {
    id: "hearthstone",
    name: "Hearthstone",
    category: "hearthstone",
    icon: "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=200",
    hasCharacterArmory: false,
    isWow: false,
  },
  {
    id: "starcraft-2",
    name: "StarCraft II",
    category: "starcraft",
    icon: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=200",
    hasCharacterArmory: false,
    isWow: false,
  },
  {
    id: "starcraft-remastered",
    name: "StarCraft: Remastered",
    category: "starcraft",
    icon: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=200",
    hasCharacterArmory: false,
    isWow: false,
  },
];

// LocalStorage Keys
const BLIZZARD_BATTLE_TAG_STORAGE = "halo_blizzard_battletag";
const BLIZZARD_ACCOUNT_ID_STORAGE = "halo_blizzard_account_id";
const BLIZZARD_OAUTH_TOKEN_STORAGE = "halo_blizzard_oauth_token";
const BLIZZARD_REFRESH_TOKEN_STORAGE = "halo_blizzard_refresh_token";
const BLIZZARD_OAUTH_EXPIRES_STORAGE = "halo_blizzard_oauth_expires";
const BLIZZARD_REGION_STORAGE = "halo_blizzard_region";
const BLIZZARD_CUSTOM_CLIENT_ID_STORAGE = "halo_blizzard_client_id";
const BLIZZARD_CUSTOM_CLIENT_SECRET_STORAGE = "halo_blizzard_client_secret";

export function getStoredBlizzardBattleTag(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(BLIZZARD_BATTLE_TAG_STORAGE) || "";
}

export function setStoredBlizzardBattleTag(val: string, skipCloudSync = false): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(BLIZZARD_BATTLE_TAG_STORAGE, val.trim());
    if (!skipCloudSync && val.trim()) {
      saveBlizzardAuthToFirebase({
        battleTag: val.trim(),
        accountId: getStoredBlizzardAccountId(),
        token: getStoredBlizzardOAuthToken(),
        refreshToken: getStoredBlizzardRefreshToken(),
        expiresAt: getBlizzardOAuthExpires() || undefined,
        region: getStoredBlizzardRegion(),
      });
    }
  }
}

export function getStoredBlizzardAccountId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(BLIZZARD_ACCOUNT_ID_STORAGE) || "";
}

export function setStoredBlizzardAccountId(val: string, skipCloudSync = false): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(BLIZZARD_ACCOUNT_ID_STORAGE, val.trim());
    if (!skipCloudSync && val.trim()) {
      saveBlizzardAuthToFirebase({
        battleTag: getStoredBlizzardBattleTag(),
        accountId: val.trim(),
        token: getStoredBlizzardOAuthToken(),
        refreshToken: getStoredBlizzardRefreshToken(),
        expiresAt: getBlizzardOAuthExpires() || undefined,
        region: getStoredBlizzardRegion(),
      });
    }
  }
}

export function getStoredBlizzardOAuthToken(): string {
  if (typeof window === "undefined") return "";
  const token = localStorage.getItem(BLIZZARD_OAUTH_TOKEN_STORAGE) || "";
  if (token.length < 10) return "";
  return token;
}

export function getStoredBlizzardRefreshToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(BLIZZARD_REFRESH_TOKEN_STORAGE) || "";
}

export function getBlizzardOAuthExpires(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(BLIZZARD_OAUTH_EXPIRES_STORAGE);
  return raw ? parseInt(raw, 10) : null;
}

export function getStoredBlizzardRegion(): "us" | "eu" | "kr" | "tw" {
  if (typeof window === "undefined") return "us";
  const r = (localStorage.getItem(BLIZZARD_REGION_STORAGE) || "us").toLowerCase();
  if (["us", "eu", "kr", "tw"].includes(r)) return r as any;
  return "us";
}

export function setStoredBlizzardRegion(region: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(BLIZZARD_REGION_STORAGE, region.toLowerCase().trim());
  }
}

export function getStoredBlizzardClientId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(BLIZZARD_CUSTOM_CLIENT_ID_STORAGE) || "";
}

export function setStoredBlizzardClientId(val: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(BLIZZARD_CUSTOM_CLIENT_ID_STORAGE, val.trim());
  }
}

export function getStoredBlizzardClientSecret(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(BLIZZARD_CUSTOM_CLIENT_SECRET_STORAGE) || "";
}

export function setStoredBlizzardClientSecret(val: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(BLIZZARD_CUSTOM_CLIENT_SECRET_STORAGE, val.trim());
  }
}

export function setStoredBlizzardOAuthToken(
  token: string,
  expiresTimestamp?: number,
  refreshToken?: string,
  skipCloudSync = false
): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(BLIZZARD_OAUTH_TOKEN_STORAGE, token.trim());
    if (expiresTimestamp) {
      localStorage.setItem(BLIZZARD_OAUTH_EXPIRES_STORAGE, expiresTimestamp.toString());
    }
    if (refreshToken) {
      localStorage.setItem(BLIZZARD_REFRESH_TOKEN_STORAGE, refreshToken.trim());
    }

    if (!skipCloudSync && token.trim()) {
      saveBlizzardAuthToFirebase({
        token: token.trim(),
        refreshToken: refreshToken || getStoredBlizzardRefreshToken(),
        expiresAt: expiresTimestamp || getBlizzardOAuthExpires() || undefined,
        battleTag: getStoredBlizzardBattleTag(),
        accountId: getStoredBlizzardAccountId(),
        region: getStoredBlizzardRegion(),
      });
    }
  }
}

export function clearBlizzardOAuthSession(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(BLIZZARD_OAUTH_TOKEN_STORAGE);
    localStorage.removeItem(BLIZZARD_REFRESH_TOKEN_STORAGE);
    localStorage.removeItem(BLIZZARD_OAUTH_EXPIRES_STORAGE);
    localStorage.removeItem(BLIZZARD_BATTLE_TAG_STORAGE);
    localStorage.removeItem(BLIZZARD_ACCOUNT_ID_STORAGE);
    removeBlizzardAuthFromFirebase();
  }
}

export function isBlizzardAuthenticated(): boolean {
  const token = getStoredBlizzardOAuthToken();
  const battleTag = getStoredBlizzardBattleTag();
  return Boolean(token || battleTag);
}

export const BLIZZARD_CUSTOM_REDIRECT_URI_STORAGE = "bnet_custom_redirect_uri";

export function getStoredBlizzardRedirectUri(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(BLIZZARD_CUSTOM_REDIRECT_URI_STORAGE) || "";
  } catch {
    return "";
  }
}

export function setStoredBlizzardRedirectUri(uri: string): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = uri.trim();
    if (trimmed) {
      localStorage.setItem(BLIZZARD_CUSTOM_REDIRECT_URI_STORAGE, trimmed);
    } else {
      localStorage.removeItem(BLIZZARD_CUSTOM_REDIRECT_URI_STORAGE);
    }
  } catch {}
}

export function getEffectiveBlizzardRedirectUri(): string {
  const custom = getStoredBlizzardRedirectUri();
  if (custom) return custom;
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/blizzard/callback`;
  }
  return "";
}

export async function verifyAndSaveManualToken(
  token: string,
  battleTag?: string
): Promise<{ success: boolean; battleTag?: string; error?: string }> {
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    return { success: false, error: "O token de acesso não pode estar vazio." };
  }
  // Store permanent token (30 days default)
  const expires = Date.now() + 30 * 24 * 60 * 60 * 1000;
  setStoredBlizzardOAuthToken(trimmedToken, expires);
  if (battleTag && battleTag.trim()) {
    setStoredBlizzardBattleTag(battleTag.trim());
  }
  return { success: true, battleTag: battleTag?.trim() || "Jogador Autenticado" };
}

// Generates the Blizzard OAuth login URL for the popup
export function getBlizzardAuthUrl(region = "us", redirectUri?: string): string {
  const customClientId = getStoredBlizzardClientId();
  const effRedirectUri = redirectUri || getEffectiveBlizzardRedirectUri();
  const params = new URLSearchParams({
    region: region || getStoredBlizzardRegion(),
    ...(customClientId ? { clientId: customClientId } : {}),
    ...(effRedirectUri ? { redirectUri: effRedirectUri } : {}),
  });
  return `/api/blizzard/auth-url?${params.toString()}`;
}

// Exchange code obtained from popup callback
export async function exchangeBlizzardCode(code: string, redirectUri?: string): Promise<{
  success: boolean;
  token?: string;
  battleTag?: string;
  accountId?: string;
  error?: string;
}> {
  try {
    const res = await fetch("/api/blizzard/oauth-exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        redirectUri,
        region: getStoredBlizzardRegion(),
        clientId: getStoredBlizzardClientId() || undefined,
        clientSecret: getStoredBlizzardClientSecret() || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Falha na troca de código da Blizzard");
    }

    if (data.token) {
      const expires = Date.now() + (data.expiresIn || 86400) * 1000;
      setStoredBlizzardOAuthToken(data.token, expires, data.refreshToken);
    }
    if (data.battleTag) {
      setStoredBlizzardBattleTag(data.battleTag);
    }
    if (data.accountId) {
      setStoredBlizzardAccountId(data.accountId);
    }

    return {
      success: true,
      token: data.token,
      battleTag: data.battleTag,
      accountId: data.accountId,
    };
  } catch (err: any) {
    console.error("Erro em exchangeBlizzardCode:", err);
    return { success: false, error: err.message || String(err) };
  }
}

// Direct BattleTag manual connect (allows users who want quick sync via API Key / Client Credentials)
export async function verifyAndSaveBattleTag(
  battleTag: string,
  region: "us" | "eu" | "kr" | "tw" = "us"
): Promise<{ success: boolean; battleTag?: string; error?: string }> {
  const trimmed = battleTag.trim();
  if (!trimmed) {
    return { success: false, error: "BattleTag não pode estar vazia" };
  }
  setStoredBlizzardBattleTag(trimmed);
  setStoredBlizzardRegion(region);
  return { success: true, battleTag: trimmed };
}

export type WoWVersionType = "retail" | "classic" | "forever" | "tbc" | "all";

export interface FetchWoWCharactersOptions {
  version?: WoWVersionType;
  wowVersion?: WoWVersionType;
  gameId?: string; // "wow-retail", "wow-classic", "wow-forever", "wow-tbc"
  region?: "us" | "eu" | "kr" | "tw" | string;
  token?: string;
  battleTag?: string;
}

// Check if a game is mapped to Battlenet
export function isBattlenetGame(game?: {
  platform?: string;
  integrationPlatform?: string;
  blizzardGameId?: string;
} | null): boolean {
  if (!game) return false;
  if (game.integrationPlatform === "battlenet") return true;
  if (Boolean(game.blizzardGameId)) return true;
  const plat = (game.platform || "").toLowerCase();
  return (
    plat.includes("battlenet") ||
    plat.includes("battle.net") ||
    plat.includes("bnet") ||
    plat.includes("blizzard")
  );
}

// Group characters by their WoW version (retail, classic, forever, tbc)
export function groupCharactersByVersion(
  characters: BlizzardCharacterSummary[]
): Record<string, BlizzardCharacterSummary[]> {
  const groups: Record<string, BlizzardCharacterSummary[]> = {
    retail: [],
    classic: [],
    forever: [],
    tbc: [],
  };

  characters.forEach((char) => {
    const rawVersion = (char.wow_version || char.gameMode || "retail").toLowerCase();
    let key = "retail";
    if (rawVersion.includes("classic") || rawVersion === "era") key = "classic";
    else if (rawVersion.includes("forever") || rawVersion.includes("vanilla+")) key = "forever";
    else if (rawVersion.includes("tbc") || rawVersion.includes("crusade")) key = "tbc";
    else key = "retail";

    if (!groups[key]) groups[key] = [];
    groups[key].push({
      ...char,
      wow_version: key as any,
    });
  });

  return groups;
}

// Fetch user's WoW characters from Blizzard Profile API (/wow/user/characters)
// Supports sub-endpoint filters for retail, classic, forever, and tbc
export async function fetchWoWUserCharacters(
  options?: FetchWoWCharactersOptions
): Promise<BlizzardCharacterSummary[]> {
  const region = options?.region || getStoredBlizzardRegion();
  const token = options?.token || getStoredBlizzardOAuthToken();
  const battleTag = options?.battleTag || getStoredBlizzardBattleTag();

  const selectedVer = options?.version || options?.wowVersion;
  let gameId = options?.gameId;
  if (!gameId && selectedVer) {
    if (selectedVer === "all") gameId = "all";
    else gameId = `wow-${selectedVer}`;
  } else if (!gameId) {
    gameId = "all"; // Default to all so user can see their full character roster across versions
  }

  const params = new URLSearchParams({
    region,
    gameId,
    ...(selectedVer ? { version: selectedVer } : {}),
    ...(token ? { token } : {}),
    ...(battleTag ? { battleTag } : {}),
    ...(getStoredBlizzardClientId() ? { clientId: getStoredBlizzardClientId() } : {}),
    ...(getStoredBlizzardClientSecret() ? { clientSecret: getStoredBlizzardClientSecret() } : {}),
  });

  // Call the centralized backend proxy endpoint for /wow/user/characters
  const res = await fetch(`/api/blizzard/wow/user/characters?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ao buscar perfil de personagens WoW (${res.status})`);
  }

  const data = await res.json();
  const chars: BlizzardCharacterSummary[] = data.characters || [];

  // Guarantee wow_version is explicitly populated on every character
  return chars.map((c) => ({
    ...c,
    wow_version: c.wow_version || c.gameMode || "retail",
  }));
}

// Backward-compatible alias for existing components
export async function fetchBlizzardWoWCharacters(options?: {
  region?: string;
  token?: string;
  gameId?: string; // "wow-retail", "wow-classic", "wow-forever", "wow-tbc"
}): Promise<BlizzardCharacterSummary[]> {
  return fetchWoWUserCharacters(options);
}

// Fetch character details: gear, stats, achievements, talents, reputations
export async function fetchBlizzardCharacterProfile(
  characterName: string,
  realmSlug: string,
  options?: {
    region?: string;
    gameId?: string;
    characterSummary?: BlizzardCharacterSummary;
    characterClass?: string;
    race?: string;
    level?: number;
    gender?: string;
    faction?: string;
    activeSpec?: string;
    equippedItemLevel?: number;
    version?: string;
  }
): Promise<BlizzardProfileData> {
  const region = options?.region || getStoredBlizzardRegion();
  const token = getStoredBlizzardOAuthToken();
  const gameId = options?.gameId || "wow-retail";
  const summary = options?.characterSummary;

  const charClass = options?.characterClass || summary?.characterClass;
  const race = options?.race || summary?.race;
  const level = options?.level !== undefined ? options.level : summary?.level;
  const gender = options?.gender || summary?.gender;
  const faction = options?.faction || summary?.faction;
  const activeSpec = options?.activeSpec || summary?.activeSpec;
  const equippedItemLevel = options?.equippedItemLevel !== undefined ? options.equippedItemLevel : summary?.equippedItemLevel;
  const version = options?.version || summary?.wow_version || summary?.gameMode;

  const params = new URLSearchParams({
    character: characterName,
    realm: realmSlug,
    region,
    gameId,
    ...(charClass ? { characterClass: charClass } : {}),
    ...(race ? { race } : {}),
    ...(level !== undefined ? { level: String(level) } : {}),
    ...(gender ? { gender } : {}),
    ...(faction ? { faction } : {}),
    ...(activeSpec ? { activeSpec } : {}),
    ...(equippedItemLevel !== undefined ? { equippedItemLevel: String(equippedItemLevel) } : {}),
    ...(version ? { version } : {}),
    ...(token ? { token } : {}),
    ...(getStoredBlizzardClientId() ? { clientId: getStoredBlizzardClientId() } : {}),
    ...(getStoredBlizzardClientSecret() ? { clientSecret: getStoredBlizzardClientSecret() } : {}),
  });

  const res = await fetch(`/api/blizzard/wow/character-profile?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ao buscar perfil do personagem (${res.status})`);
  }

  return await res.json();
}
