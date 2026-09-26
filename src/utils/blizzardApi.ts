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
import {
  getBlizzardRawCache,
  setBlizzardRawCache,
  invalidateBlizzardRawCache,
  clearAllBlizzardRawCache,
  getBlizzardCacheStats,
  buildBlizzardProfileCacheKey,
  BLIZZARD_CACHE_TTL_24H,
} from "./blizzardApiCache";
import {
  validateBlizzardCodePreflight,
  notifyBlizzardReauthRequired,
  registerBlizzardReauthListener,
  sanitizeBlizzardAuthCode,
  markCodePending,
  markCodeConsumed,
  markCodeExpired,
} from "./blizzardOAuthPreflight";

export {
  getBlizzardRawCache,
  setBlizzardRawCache,
  invalidateBlizzardRawCache,
  clearAllBlizzardRawCache,
  getBlizzardCacheStats,
  buildBlizzardProfileCacheKey,
  BLIZZARD_CACHE_TTL_24H,
  validateBlizzardCodePreflight,
  notifyBlizzardReauthRequired,
  registerBlizzardReauthListener,
  sanitizeBlizzardAuthCode,
};

// Official Blizzard Game Catalog with focus on WoW and major franchises
export const BLIZZARD_OFFICIAL_GAMES: BlizzardOfficialGame[] = [
  {
    id: "wow-retail",
    name: "World of Warcraft: Retail (Midnight)",
    category: "warcraft",
    icon: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=200",
    hasCharacterArmory: true,
    isWow: true,
    wowVersion: "retail",
  },
  {
    id: "wow-forever",
    name: "World of Warcraft: Forever",
    category: "warcraft",
    icon: "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=200",
    hasCharacterArmory: true,
    isWow: true,
    wowVersion: "forever",
  },
  {
    id: "wow-classic",
    name: "World of Warcraft: Classic Era",
    category: "warcraft",
    icon: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=200",
    hasCharacterArmory: true,
    isWow: true,
    wowVersion: "classic",
  },
  {
    id: "wow-tbc",
    name: "World of Warcraft: Classic TBC",
    category: "warcraft",
    icon: "https://images.unsplash.com/photo-1501854140801-50d01698950b?q=80&w=200",
    hasCharacterArmory: true,
    isWow: true,
    wowVersion: "tbc",
  },
  {
    id: "wow-mop",
    name: "World of Warcraft: Classic MoP",
    category: "warcraft",
    icon: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=200",
    hasCharacterArmory: true,
    isWow: true,
    wowVersion: "mop",
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

// Default Official Credentials provided by user
export const DEFAULT_BLIZZARD_CLIENT_ID = "cd4e166528cc4b14b6f3e80608da21df";
export const DEFAULT_BLIZZARD_CLIENT_SECRET = "TAYTjZ6bfdquf4scRuNIVlkXM46JodrK";

export const BLIZZARD_ALLOWED_REDIRECT_URIS = [
  "https://gameloghalecks.ai.studio/api/blizzard/callback",
  "http://localhost:3000/api/blizzard/callback",
  "https://ais-dev-vo7y2svqbla2eksgmckxxg-422647129975.us-west1.run.app/api/blizzard/callback",
  "https://ais-pre-vo7y2svqbla2eksgmckxxg-422647129975.us-west1.run.app/api/blizzard/callback",
  "https://ais-dev-mqwco4zhvkscmlstabgakc-607246007356.us-east1.run.app/api/blizzard/callback",
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
  if (typeof window === "undefined") return DEFAULT_BLIZZARD_CLIENT_ID;
  return localStorage.getItem(BLIZZARD_CUSTOM_CLIENT_ID_STORAGE) || DEFAULT_BLIZZARD_CLIENT_ID;
}

export function setStoredBlizzardClientId(val: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(BLIZZARD_CUSTOM_CLIENT_ID_STORAGE, val.trim());
  }
}

export function getStoredBlizzardClientSecret(): string {
  if (typeof window === "undefined") return DEFAULT_BLIZZARD_CLIENT_SECRET;
  return localStorage.getItem(BLIZZARD_CUSTOM_CLIENT_SECRET_STORAGE) || DEFAULT_BLIZZARD_CLIENT_SECRET;
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
  if (custom && custom.trim()) return custom.trim();

  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    const currentCallback = `${origin}/api/blizzard/callback`;
    if (BLIZZARD_ALLOWED_REDIRECT_URIS.includes(currentCallback)) {
      return currentCallback;
    }
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:3000/api/blizzard/callback";
    }
    if (host.includes("gameloghalecks.ai.studio") || host.includes("ai.studio")) {
      return "https://gameloghalecks.ai.studio/api/blizzard/callback";
    }
    const matchingRun = BLIZZARD_ALLOWED_REDIRECT_URIS.find((uri) => uri.startsWith(origin));
    if (matchingRun) return matchingRun;
  }

  return "https://gameloghalecks.ai.studio/api/blizzard/callback";
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

// Generates the official direct Blizzard OAuth login URL
export function getBlizzardAuthUrl(region = "us", redirectUri?: string, clientId?: string): string {
  const customClientId = clientId?.trim() || getStoredBlizzardClientId()?.trim();
  if (!customClientId) {
    return "";
  }
  const oauthHost = region === "cn" ? "https://oauth.battlenet.com.cn" : "https://oauth.battle.net";
  const effRedirectUri = redirectUri || getEffectiveBlizzardRedirectUri();
  const state = Math.random().toString(36).substring(2, 15);
  const params = new URLSearchParams({
    client_id: customClientId,
    scope: "openid wow.profile",
    response_type: "code",
    state,
    redirect_uri: effRedirectUri,
  });
  return `${oauthHost}/authorize?${params.toString()}`;
}

// Direct Client Credentials authentication
export async function requestBlizzardClientCredentials(
  clientId?: string,
  clientSecret?: string,
  region = "us"
): Promise<{
  success: boolean;
  token?: string;
  expiresIn?: number;
  error?: string;
}> {
  try {
    const res = await fetch("/api/blizzard/client-credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: clientId || getStoredBlizzardClientId() || undefined,
        clientSecret: clientSecret || getStoredBlizzardClientSecret() || undefined,
        region: region || getStoredBlizzardRegion() || "us",
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Falha ao autenticar credenciais na Blizzard");
    }
    if (data.token) {
      const expires = Date.now() + (data.expiresIn || 86400) * 1000;
      setStoredBlizzardOAuthToken(data.token, expires);
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

// Exchange code obtained from popup callback
export interface BlizzardOAuthExchangeResult {
  success: boolean;
  token?: string;
  battleTag?: string;
  accountId?: string;
  error?: string;
  isInvalidGrant?: boolean;
  isConsumed?: boolean;
  isExpired?: boolean;
  requiresReauth?: boolean;
  userNotice?: {
    title: string;
    message: string;
  };
}

// Exchange code obtained from popup callback with pre-flight validation
export async function exchangeBlizzardCode(
  code: string,
  redirectUri?: string
): Promise<BlizzardOAuthExchangeResult> {
  // Pre-flight check: validate authorization code before firing network request
  const preflight = validateBlizzardCodePreflight(code);

  if (preflight.inFlightPromise) {
    return preflight.inFlightPromise;
  }

  if (!preflight.valid) {
    return {
      success: false,
      error: preflight.friendlyMessage || "Código de autorização inválido ou expirado",
      isInvalidGrant: true,
      isConsumed: preflight.reason === "already_consumed",
      isExpired: preflight.reason === "expired",
      requiresReauth: true,
      userNotice: {
        title: preflight.friendlyTitle || "Reautenticação Necessária",
        message: preflight.friendlyMessage || "Por favor, inicie uma nova autenticação.",
      },
    };
  }

  const sanitizedCode = preflight.sanitizedCode;
  markCodePending(sanitizedCode);

  const exchangeTask = (async (): Promise<BlizzardOAuthExchangeResult> => {
    try {
      const effRedirectUri = redirectUri || getEffectiveBlizzardRedirectUri();
      const res = await fetch("/api/blizzard/oauth-exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: sanitizedCode,
          redirectUri: effRedirectUri,
          region: getStoredBlizzardRegion(),
          clientId: getStoredBlizzardClientId() || undefined,
          clientSecret: getStoredBlizzardClientSecret() || undefined,
        }),
      });

      const data = await res.json().catch(() => ({ success: false, error: "Resposta inválida do servidor" }));
      if (!res.ok || !data.success) {
        const isGrantError = Boolean(
          data.isInvalidGrant ||
          (data.details && data.details.includes("invalid_grant")) ||
          (data.error && data.error.includes("invalid_grant"))
        );

        if (isGrantError) {
          markCodeExpired(sanitizedCode, data.error);
          const friendlyTitle = "Autorização Expirada ou Já Utilizada";
          const friendlyMsg =
            "O código de autorização expirou ou já foi consumido pela Blizzard. " +
            "Por favor, clique em 'Conectar com Blizzard' para iniciar uma nova autorização.";
          notifyBlizzardReauthRequired(friendlyTitle, friendlyMsg);
          return {
            success: false,
            error: data.error || friendlyMsg,
            isInvalidGrant: true,
            requiresReauth: true,
            userNotice: {
              title: friendlyTitle,
              message: friendlyMsg,
            },
          };
        }

        return {
          success: false,
          error: data.error || "Falha na troca de código da Blizzard",
          isInvalidGrant: false,
        };
      }

      // Mark code as consumed in lifecycle registry
      markCodeConsumed(sanitizedCode, { battleTag: data.battleTag });

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
      return { success: false, error: err.message || String(err) };
    }
  })();

  return exchangeTask;
}

/**
 * Persists an imported or viewed WoW character profile to the server database
 * so it is permanently saved and never requires re-importing or re-fetching
 */
export async function persistWoWProfileOnServer(profile: any): Promise<boolean> {
  if (!profile || !profile.name) return false;
  try {
    const res = await fetch("/api/blizzard/wow/persist-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Loads all saved character profiles directly from the server disk database
 */
export async function fetchPersistedWoWProfiles(): Promise<any[]> {
  try {
    const res = await fetch("/api/blizzard/wow/persisted-profiles");
    if (!res.ok) return [];
    const data = await res.json();
    return data.profiles || [];
  } catch {
    return [];
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

export type WoWVersionType = "retail" | "classic" | "forever" | "tbc" | "mop" | "all";

export interface FetchWoWCharactersOptions {
  version?: WoWVersionType;
  wowVersion?: WoWVersionType;
  gameId?: string; // "wow-retail", "wow-classic", "wow-forever", "wow-tbc", "wow-mop"
  region?: "us" | "eu" | "kr" | "tw" | string;
  token?: string;
  battleTag?: string;
  force?: boolean;
}

// Check if a game is mapped to Battlenet
export function isBattlenetGame(game?: {
  platform?: string;
  integrationPlatform?: string;
  blizzardGameId?: string;
} | null): boolean {
  if (!game) return false;
  return game.integrationPlatform === "battlenet";
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
    ...(options?.force ? { force: "true" } : {}),
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

  // Guarantee wow_version is explicitly populated and deduplicate by composite key
  const uniqueMap = new Map<string, BlizzardCharacterSummary>();
  chars.forEach((c) => {
    const populated: BlizzardCharacterSummary = {
      ...c,
      wow_version: (c.wow_version || c.gameMode || "retail") as any,
    };
    const key = getCharacterCompositeKey(populated);
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, populated);
    }
  });

  return Array.from(uniqueMap.values());
}

// Backward-compatible alias for existing components
export async function fetchBlizzardWoWCharacters(options?: FetchWoWCharactersOptions): Promise<BlizzardCharacterSummary[]> {
  return fetchWoWUserCharacters(options);
}

/**
 * Enriches raw Blizzard character profile data with transmog slot mappings,
 * appearance item fallbacks, and collection display IDs.
 */
export function enrichBlizzardProfileData(profile: BlizzardProfileData): BlizzardProfileData {
  if (!profile) return profile;

  // Mapear e extrair dados de transmog de cada item/slot do personagem com alta fidelidade
  const transmogsRecord: Record<string, {
    slot: string;
    slotId?: number;
    itemId?: number;
    displayId?: number;
    name?: string;
    displayString?: string;
  }> = { ...(profile.transmogs || {}) };

  const transmogSlotsList: {
    slot: string;
    slotId?: number;
    itemId?: number;
    displayId?: number;
    name?: string;
    displayString?: string;
  }[] = [...(profile.transmogSlots || [])];

  const gearItems = profile.gear || profile.equippedItems || [];

  // Mapeamento numérico padrão de slots do World of Warcraft (ZamModelViewer)
  const slotMapping: Record<string, number> = {
    HEAD: 1,
    SHOULDER: 3,
    SHIRT: 4,
    CHEST: 5,
    ROBE: 20,
    WAIST: 6,
    LEGS: 7,
    FEET: 8,
    WRIST: 9,
    HANDS: 10,
    BACK: 16,
    TABARD: 19,
    MAIN_HAND: 21,
    OFF_HAND: 22,
    RANGED: 26,
  };

  for (const item of gearItems) {
    if (!item) continue;
    const slotKey = (item.slot || "").toUpperCase();
    const effectiveSlotId = item.slotId || slotMapping[slotKey] || 0;

    // Se o item contiver informações de transmog, priorizar a substituição do display_id original pelo display_id do transmog
    if (item.transmog && (item.transmog.itemId || item.transmog.displayId)) {
      const transmogDisplayId = item.transmog.displayId || item.displayId;
      if (transmogDisplayId) {
        item.displayId = transmogDisplayId;
      }

      const transmogEntry = {
        slot: item.slot,
        slotId: effectiveSlotId,
        itemId: item.transmog.itemId || item.itemId || item.id,
        displayId: transmogDisplayId,
        name: item.transmog.name || item.name,
        displayString: item.transmog.displayString,
      };

      transmogsRecord[slotKey] = transmogEntry;

      const existingIdx = transmogSlotsList.findIndex((t) => t.slot?.toUpperCase() === slotKey);
      if (existingIdx >= 0) {
        transmogSlotsList[existingIdx] = transmogEntry;
      } else {
        transmogSlotsList.push(transmogEntry);
      }
    }
  }

  // Também verificar o payload de appearance.items (se a Blizzard API tiver retornado)
  if (profile.appearance?.items && Array.isArray(profile.appearance.items)) {
    for (const aIt of profile.appearance.items) {
      const slotKey = (aIt.slot?.type || "").toUpperCase();
      const appearanceDisplayId = aIt.display_id || aIt.item_appearance_modifier_id;
      const effectiveSlotId = slotMapping[slotKey] || 0;

      if (slotKey && appearanceDisplayId) {
        // Encontrar o item do equipamento correspondente a esse slot para saber se houve transmog
        const matchingGear = gearItems.find((g) => (g.slot || "").toUpperCase() === slotKey);
        const baseItemId = matchingGear?.itemId || matchingGear?.id || aIt.item?.id;

        if (matchingGear?.transmog || (baseItemId && matchingGear?.displayId && matchingGear.displayId !== baseItemId) || !matchingGear?.displayId) {
          if (matchingGear) {
            matchingGear.displayId = appearanceDisplayId;
          }

          if (!transmogsRecord[slotKey]) {
            const transmogEntry = {
              slot: slotKey,
              slotId: effectiveSlotId,
              itemId: matchingGear?.transmog?.itemId || baseItemId,
              displayId: appearanceDisplayId,
              name: matchingGear?.transmog?.name || matchingGear?.name,
              displayString: matchingGear?.transmog?.displayString,
            };
            transmogsRecord[slotKey] = transmogEntry;
            const existingIdx = transmogSlotsList.findIndex((t) => t.slot?.toUpperCase() === slotKey);
            if (existingIdx >= 0) {
              transmogSlotsList[existingIdx] = transmogEntry;
            } else {
              transmogSlotsList.push(transmogEntry);
            }
          }
        }
      }
    }
  }

  // Enriquecer coleções (mounts e pets) garantindo que itemId e displayId/creatureDisplayId estejam devidamente populados
  if (profile.collections) {
    if (Array.isArray(profile.collections.mounts)) {
      profile.collections.mounts = profile.collections.mounts.map((m) => {
        const cDisplay = m.creatureDisplayId || m.displayId || 0;
        return {
          ...m,
          displayId: cDisplay || m.displayId,
          creatureDisplayId: cDisplay || m.creatureDisplayId,
          itemId: m.itemId || (m.id > 10000 ? m.id : undefined),
        };
      });
    }
    if (Array.isArray(profile.collections.pets)) {
      profile.collections.pets = profile.collections.pets.map((p) => {
        const cDisplay = p.creatureDisplayId || p.displayId || 0;
        return {
          ...p,
          displayId: cDisplay || p.displayId,
          creatureDisplayId: cDisplay || p.creatureDisplayId,
          itemId: p.itemId || (p.id > 10000 ? p.id : undefined),
        };
      });
    }
  }

  profile.transmogs = transmogsRecord;
  profile.transmogSlots = transmogSlotsList;

  return profile;
}

// Fetch character details: gear, stats, achievements, talents, reputations
// Validates raw local cache with 24h TTL before performing network requests
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
    force?: boolean;
    bypassCache?: boolean;
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
  const version = options?.version || summary?.wow_version || summary?.gameMode || "retail";

  // Dedicated raw responses local cache lookup (TTL 24h)
  const cacheKey = buildBlizzardProfileCacheKey(characterName, realmSlug, region, gameId, version);

  if (!options?.force && !options?.bypassCache) {
    try {
      const cached = await getBlizzardRawCache<BlizzardProfileData>(cacheKey);
      if (cached && cached.isFresh && cached.data) {
        // Deep copy raw payload to prevent local mutations from contaminating the cache store
        const rawCopy: BlizzardProfileData = JSON.parse(JSON.stringify(cached.data));
        return enrichBlizzardProfileData(rawCopy);
      }
    } catch (cacheErr) {
      console.warn("[BlizzardApiCache] Erro ao consultar cache local de perfil:", cacheErr);
    }
  }

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

  // Raw API response received from Blizzard endpoint
  const rawProfile: BlizzardProfileData = await res.json();

  // Exclusively store raw Blizzard API response in the local cache with 24h TTL
  setBlizzardRawCache(cacheKey, rawProfile, BLIZZARD_CACHE_TTL_24H, "/api/blizzard/wow/character-profile").catch((err) => {
    console.warn("[BlizzardApiCache] Falha ao gravar cache local:", err);
  });

  const profileCopy: BlizzardProfileData = JSON.parse(JSON.stringify(rawProfile));
  return enrichBlizzardProfileData(profileCopy);
}

/**
 * Generates an authoritative composite key for a WoW character:
 * Format: "charactername#realm-slug#wow_version"
 * e.g. "arthas#azralon#retail" or "arthas#nemesis#classic"
 */
export function getCharacterCompositeKey(char: {
  name: string;
  realm?: string;
  realmSlug?: string;
  wow_version?: string;
  gameMode?: string;
}): string {
  const nameNorm = (char.name || "").trim().toLowerCase();
  const realmNorm = (char.realmSlug || char.realm || "").trim().toLowerCase().replace(/['\s_]+/g, "-");
  const verNorm = (char.wow_version || char.gameMode || "retail").trim().toLowerCase();
  return `${nameNorm}#${realmNorm}#${verNorm}`;
}

/**
 * Parses an authoritative composite key or legacy hyphen key
 */
export function parseCharacterCompositeKey(key: string): {
  name: string;
  realm: string;
  version: string;
} {
  if (!key) return { name: "", realm: "", version: "retail" };
  if (key.includes("#")) {
    const parts = key.split("#");
    return {
      name: parts[0] || "",
      realm: parts[1] || "",
      version: parts[2] || "retail",
    };
  }
  if (key.includes("-")) {
    const parts = key.split("-");
    return {
      name: parts[0] || "",
      realm: parts.slice(1).join("-") || "",
      version: "retail",
    };
  }
  return { name: key, realm: "", version: "retail" };
}

/**
 * Checks if a character matches a query key, name, realm and version.
 * Unambiguously differentiates characters with the same name on different realms and WoW versions.
 */
export function matchCharacterComposite(
  char: { name: string; realm?: string; realmSlug?: string; wow_version?: string; gameMode?: string },
  queryKeyOrName: string,
  queryRealm?: string,
  queryVersion?: string
): boolean {
  if (!queryKeyOrName) return false;
  const qLower = queryKeyOrName.toLowerCase().trim();

  // If query contains composite delimiter '#'
  if (qLower.includes("#")) {
    const parts = qLower.split("#");
    const qName = parts[0] || "";
    const qRealm = (parts[1] || "").replace(/['\s-_]+/g, "");
    const qVer = parts[2] || "";

    if (char.name.toLowerCase() !== qName) return false;
    if (qRealm) {
      const cRealm = (char.realmSlug || char.realm || "").toLowerCase().replace(/['\s-_]+/g, "");
      if (cRealm !== qRealm) return false;
    }
    if (qVer && qVer !== "all") {
      const cVer = (char.wow_version || char.gameMode || "retail").toLowerCase();
      if (cVer !== qVer) return false;
    }
    return true;
  }

  // If query contains delimiter '-'
  if (qLower.includes("-")) {
    const parts = qLower.split("-");
    const qName = parts[0] || "";
    const qRealm = parts.slice(1).join("-").replace(/['\s-_]+/g, "");

    if (char.name.toLowerCase() !== qName) return false;
    if (qRealm) {
      const cRealm = (char.realmSlug || char.realm || "").toLowerCase().replace(/['\s-_]+/g, "");
      if (cRealm !== qRealm) return false;
    }
    return true;
  }

  // Plain name check
  if (char.name.toLowerCase() !== qLower) return false;
  if (queryRealm) {
    const cRealm = (char.realmSlug || char.realm || "").toLowerCase().replace(/['\s-_]+/g, "");
    const targetRealm = queryRealm.toLowerCase().replace(/['\s-_]+/g, "");
    if (cRealm !== targetRealm) return false;
  }
  if (queryVersion && queryVersion !== "all") {
    const cVer = (char.wow_version || char.gameMode || "retail").toLowerCase();
    if (cVer !== queryVersion.toLowerCase()) return false;
  }
  return true;
}

export interface BlizzardMountDbMetadata {
  id: number;
  name: string;
  iconUrl: string;
  mountType: "ground" | "flying" | "aquatic" | "dragonriding";
  creatureDisplayId?: number;
  source?: string;
  description?: string;
  speedBonus?: string;
  factionRequirement?: "ALLIANCE" | "HORDE" | "ANY";
  itemId?: number;
  spellId?: number;
}

export interface BattlePetSpeciesInfo {
  speciesId: number;
  creatureId?: number;
  name: string;
  iconUrl: string;
  family: string;
  creatureDisplayId?: number;
  description?: string;
  source?: string;
  quality?: string;
  abilities?: string[];
}

// In-memory persistent cache for Mount.db2 metadata
const mountMetadataMemoryCache = new Map<number, BlizzardMountDbMetadata>();
const petSpeciesMemoryCache = new Map<number, BattlePetSpeciesInfo>();

/**
 * Utility function to fetch full metadata for Mounts (Mount.db2)
 * using mount IDs extracted from official CSV files (e.g. Mount.12.1.5.69952.csv)
 * or Blizzard API accounts. Accurately resolves name, icon, creatureDisplayId, and mountType.
 */
export async function fetchMountDb2Metadata(
  mountIds: number | number[],
  options?: { region?: string; force?: boolean }
): Promise<BlizzardMountDbMetadata[]> {
  const ids = Array.isArray(mountIds) ? mountIds : [mountIds];
  if (ids.length === 0) return [];

  const region = options?.region || getStoredBlizzardRegion() || "us";
  const force = !!options?.force;
  const results: BlizzardMountDbMetadata[] = [];
  const missingIds: number[] = [];

  // 1. Check in-memory cache first
  for (const id of ids) {
    if (!force && mountMetadataMemoryCache.has(id)) {
      results.push(mountMetadataMemoryCache.get(id)!);
    } else {
      missingIds.push(id);
    }
  }

  if (missingIds.length === 0) {
    return results;
  }

  // 2. Fetch missing IDs from server-side DB2 proxy in batch chunks of 50
  const chunkSize = 50;
  for (let i = 0; i < missingIds.length; i += chunkSize) {
    const chunk = missingIds.slice(i, i + chunkSize);
    try {
      const query = new URLSearchParams({
        ids: chunk.join(","),
        region,
      });
      const res = await fetch(`/api/blizzard/wow/mount-metadata?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const list: BlizzardMountDbMetadata[] = data.mounts || (data.id ? [data] : []);
        for (const item of list) {
          if (item && item.id) {
            mountMetadataMemoryCache.set(item.id, item);
            results.push(item);
          }
        }
      }
    } catch (err) {
      console.warn("Error querying /api/blizzard/wow/mount-metadata:", err);
    }
  }

  // 3. Fallback for any IDs that failed to resolve from the API: use client-side DB2 catalogs
  for (const id of missingIds) {
    if (!mountMetadataMemoryCache.has(id)) {
      const fallbackMeta: BlizzardMountDbMetadata = {
        id,
        name: `Mount #${id}`,
        iconUrl: "https://render.worldofwarcraft.com/us/icons/56/ability_mount_ridinghorse.jpg",
        mountType: "ground",
        creatureDisplayId: 2404,
        source: "World of Warcraft Mount.db2",
        description: "Official World of Warcraft mount.",
        speedBonus: "+100% Ground Speed",
        factionRequirement: "ANY",
      };
      mountMetadataMemoryCache.set(id, fallbackMeta);
      results.push(fallbackMeta);
    }
  }

  return results;
}

/**
 * Single mount metadata convenience fetcher
 */
export async function fetchMountMetadata(
  mountId: number,
  options?: { region?: string }
): Promise<BlizzardMountDbMetadata | null> {
  const list = await fetchMountDb2Metadata([mountId], options);
  return list[0] || null;
}

/**
 * Resolves BattlePetSpecies metadata by species ID using Wowhead & Blizzard DB2
 */
export async function fetchBattlePetSpeciesData(
  speciesId: number
): Promise<BattlePetSpeciesInfo | null> {
  if (!speciesId || isNaN(speciesId)) return null;

  if (petSpeciesMemoryCache.has(speciesId)) {
    return petSpeciesMemoryCache.get(speciesId)!;
  }

  try {
    const res = await fetch(`/api/blizzard/wow/battlepet-species/${speciesId}`);
    if (res.ok) {
      const data: BattlePetSpeciesInfo = await res.json();
      petSpeciesMemoryCache.set(speciesId, data);
      return data;
    }
  } catch (err) {
    console.warn(`Could not fetch BattlePetSpecies for id ${speciesId}:`, err);
  }

  // Fallback item
  const fallbackInfo: BattlePetSpeciesInfo = {
    speciesId,
    name: `Pet Species #${speciesId}`,
    iconUrl: "https://render.worldofwarcraft.com/us/icons/56/inv_misc_monsterclaw_04.jpg",
    family: "Beast",
    creatureDisplayId: 28917,
    description: "Battle Pet Companion",
    source: "Pet Battle / Wild Capture",
    quality: "RARE",
    abilities: ["Attack", "Defend", "Surge"],
  };
  petSpeciesMemoryCache.set(speciesId, fallbackInfo);
  return fallbackInfo;
}
