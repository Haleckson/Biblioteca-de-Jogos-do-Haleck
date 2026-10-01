/**
 * World of Warcraft Forever (Vanilla+) - Official Battle.net REST API Adapter
 * 
 * Target Official Launch: November 04, 2026 (Transition from Beta Build 16001)
 * Primary Client Folder: _classic_beta_ (Pre-launch Beta) / Official Folder (Post-launch)
 * 
 * This adapter prepares the application for Blizzard's official WoW Forever REST endpoints
 * on the Battle.net Developer Portal, while seamlessly fusing client-exclusive data
 * collected by the in-game Addon (Haleck Account Importer):
 * - Real-time step counter & distance (yards / km)
 * - Hardcore death certificates & solemn journal
 * - Adventure Journal ("Meu Diário de Aventura" timeline, companions, boss encounters)
 * - Detailed personal bank slot contents & bags
 * - Incremental delta changes (pendingChanges log)
 * - Local World Boss yells & combat timestamps (Lord Kazzak, Azuregos, 4 Nightmare Dragons)
 */

import { BlizzardProfileData } from "../types";

export interface WoWForeverApiStatus {
  service: "WoW Forever (Vanilla+) Battle.net API Adapter";
  version: "4.0.0-forever-ready";
  officialLaunchDate: string; // "2026-11-04T00:00:00Z"
  isOfficialLaunched: boolean;
  daysUntilLaunch: number;
  currentPhase: "Beta Build 16001 (Client-First & Pre-Launch)" | "Official Battle.net REST (Live)";
  clientFolderCanonical: "_classic_beta_";
  defaultRuleset: "Vanilla+ Normal / Hardcore";
  supportedNamespaces: {
    gameData: string; // "dynamic-forever" | "static-forever"
    profile: string;  // "profile-forever"
  };
  endpoints: {
    characterSummary: string;
    characterEquipment: string;
    characterSpecializations: string;
    characterStatistics: string;
    worldBossTimers: string;
  };
  features: {
    deltaSyncSupported: boolean;
    worldBossTrackingSupported: boolean;
    combatLockdownShieldSupported: boolean;
    libDeflateCompressionSupported: boolean;
    hybridAddonMergeEngine: boolean;
  };
}

export interface WoWForeverWorldBossStatus {
  id: number;
  key: "kazzak" | "azuregos" | "taerar" | "ysondre" | "lethon" | "emeriss";
  name: string;
  zone: string;
  status: "Available" | "Defeated" | "Spawning Soon";
  minRespawnHours: number;
  maxRespawnHours: number;
  lastKilledAt?: string;
  respawnMinEpoch?: number;
  respawnMaxEpoch?: number;
  respawnWindowFormatted?: string;
  source: "addon_local_detection" | "official_rest_api" | "hybrid_projection";
  iconUrl: string;
}

const LAUNCH_DATE_EPOCH = new Date("2026-11-04T00:00:00Z").getTime();

/**
 * Returns current status, countdown, and active specs for WoW Forever
 */
export function getWoWForeverApiStatus(): WoWForeverApiStatus {
  const now = Date.now();
  const isLaunched = now >= LAUNCH_DATE_EPOCH;
  const daysDiff = Math.max(0, Math.ceil((LAUNCH_DATE_EPOCH - now) / (1000 * 60 * 60 * 24)));

  return {
    service: "WoW Forever (Vanilla+) Battle.net API Adapter",
    version: "4.0.0-forever-ready",
    officialLaunchDate: "2026-11-04T00:00:00Z",
    isOfficialLaunched: isLaunched,
    daysUntilLaunch: daysDiff,
    currentPhase: isLaunched
      ? "Official Battle.net REST (Live)"
      : "Beta Build 16001 (Client-First & Pre-Launch)",
    clientFolderCanonical: "_classic_beta_",
    defaultRuleset: "Vanilla+ Normal / Hardcore",
    supportedNamespaces: {
      gameData: "dynamic-forever",
      profile: "profile-forever",
    },
    endpoints: {
      characterSummary: "/profile/wow/character/{realmSlug}/{characterName}?namespace=profile-forever",
      characterEquipment: "/profile/wow/character/{realmSlug}/{characterName}/equipment?namespace=profile-forever",
      characterSpecializations: "/profile/wow/character/{realmSlug}/{characterName}/specializations?namespace=profile-forever",
      characterStatistics: "/profile/wow/character/{realmSlug}/{characterName}/character-media?namespace=profile-forever",
      worldBossTimers: "/data/wow/world-bosses?namespace=dynamic-forever",
    },
    features: {
      deltaSyncSupported: true,
      worldBossTrackingSupported: true,
      combatLockdownShieldSupported: true,
      libDeflateCompressionSupported: true,
      hybridAddonMergeEngine: true,
    },
  };
}

/**
 * Canonical list of Vanilla+ World Bosses monitored for WoW Forever
 */
export const WOW_FOREVER_WORLD_BOSSES: Record<string, WoWForeverWorldBossStatus> = {
  kazzak: {
    id: 12397,
    key: "kazzak",
    name: "Lord Kazzak",
    zone: "Barreira do Inferno (Blasted Lands)",
    status: "Spawning Soon",
    minRespawnHours: 72,
    maxRespawnHours: 96,
    source: "hybrid_projection",
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/spell_shadow_summoninfernal.jpg",
  },
  azuregos: {
    id: 6109,
    key: "azuregos",
    name: "Azuregos",
    zone: "Azshara",
    status: "Spawning Soon",
    minRespawnHours: 72,
    maxRespawnHours: 96,
    source: "hybrid_projection",
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/spell_frost_glacier.jpg",
  },
  taerar: {
    id: 14890,
    key: "taerar",
    name: "Taerar (Pesadelo)",
    zone: "Vale Gris (Bough Shadow)",
    status: "Spawning Soon",
    minRespawnHours: 72,
    maxRespawnHours: 96,
    source: "hybrid_projection",
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_abolishpoison.jpg",
  },
  ysondre: {
    id: 14887,
    key: "ysondre",
    name: "Ysondre (Pesadelo)",
    zone: "Feralas (Dream Bough)",
    status: "Spawning Soon",
    minRespawnHours: 72,
    maxRespawnHours: 96,
    source: "hybrid_projection",
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_abolishpoison.jpg",
  },
  lethon: {
    id: 14888,
    key: "lethon",
    name: "Lethon (Pesadelo)",
    zone: "Terras Altas dos Guarus (The Hinterlands)",
    status: "Spawning Soon",
    minRespawnHours: 72,
    maxRespawnHours: 96,
    source: "hybrid_projection",
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_abolishpoison.jpg",
  },
  emeriss: {
    id: 14889,
    key: "emeriss",
    name: "Emeriss (Pesadelo)",
    zone: "Floresta do Crepúsculo (Twilight Grove)",
    status: "Spawning Soon",
    minRespawnHours: 72,
    maxRespawnHours: 96,
    source: "hybrid_projection",
    iconUrl: "https://wow.zamimg.com/images/wow/icons/large/spell_nature_abolishpoison.jpg",
  },
};

/**
 * Calculates unified World Bosses status combining in-game Addon events and official API
 */
export function calculateWoWForeverWorldBosses(addonWorldBosses?: Record<string, any>): WoWForeverWorldBossStatus[] {
  const result: WoWForeverWorldBossStatus[] = [];
  const now = Math.floor(Date.now() / 1000);

  for (const [key, defaultBoss] of Object.entries(WOW_FOREVER_WORLD_BOSSES)) {
    const addonEntry = addonWorldBosses && addonWorldBosses[key];
    if (addonEntry) {
      const isKilled = addonEntry.status === "killed";
      const isActive = addonEntry.status === "active";
      let status: "Available" | "Defeated" | "Spawning Soon" = "Spawning Soon";

      if (isActive) {
        status = "Available";
      } else if (isKilled) {
        const respawnMin = addonEntry.respawnMinEpoch || (addonEntry.killedEpoch ? addonEntry.killedEpoch + 72 * 3600 : undefined);
        const respawnMax = addonEntry.respawnMaxEpoch || (addonEntry.killedEpoch ? addonEntry.killedEpoch + 96 * 3600 : undefined);

        if (respawnMin && now >= respawnMin && respawnMax && now <= respawnMax) {
          status = "Available"; // Within respawn window
        } else if (respawnMax && now > respawnMax) {
          status = "Available"; // Overdue window
        } else {
          status = "Defeated";
        }
      }

      result.push({
        ...defaultBoss,
        status,
        lastKilledAt: addonEntry.killedAt || addonEntry.lastKilled,
        respawnMinEpoch: addonEntry.respawnMinEpoch,
        respawnMaxEpoch: addonEntry.respawnMaxEpoch,
        respawnWindowFormatted: addonEntry.respawnMinDate
          ? `${addonEntry.respawnMinDate} até ${addonEntry.respawnMaxDate || ""}`
          : undefined,
        source: "addon_local_detection",
      });
    } else {
      result.push({ ...defaultBoss });
    }
  }

  return result;
}

/**
 * Fuses official Battle.net REST API profile with client-exclusive In-Game Addon data
 * 
 * Rules:
 * 1. Server-authoritative data (Official item level, character level, guild rank) from REST API
 * 2. Client-exclusive data (Steps, Hardcore details, bags, personal bank, journal timeline) from Addon
 * 3. Enforces strict Vanilla+ rules (no Warband Bank, no Mythic+ Great Vault)
 */
export function mergeWoWForeverHybridData(
  officialRestProfile: Partial<BlizzardProfileData>,
  addonClientProfile: BlizzardProfileData
): BlizzardProfileData {
  const merged: BlizzardProfileData = {
    ...addonClientProfile,
    ...officialRestProfile,

    // Server canonical markers
    gameMode: "forever",
    wow_version: "forever",
    ruleset: officialRestProfile.ruleset || addonClientProfile.ruleset || "Vanilla+",

    // Client-exclusive: Adventure Journal ("Meu Diário de Aventura")
    adventureJournal: addonClientProfile.adventureJournal,

    // Client-exclusive: Hardcore Death Certificate & survival logs
    hardcore: addonClientProfile.hardcore || {
      isHardcore: true,
      isDead: false,
      survivalStatus: "ALIVE",
      snapshotTime: Date.now(),
    },
    hardcoreDeathCertificate: addonClientProfile.hardcoreDeathCertificate,

    // Client-exclusive: In-Game Inventory bags & Personal Bank
    inventory: addonClientProfile.inventory || officialRestProfile.inventory,
    bank: {
      mainBank: addonClientProfile.bank?.mainBank || [],
      reagentBank: [],
      warbandBank: undefined, // Never present in WoW Forever
      lastBankVisit: addonClientProfile.bank?.lastBankVisit,
    },

    // Client-exclusive: Account Economy and pending deltas
    accountEconomy: addonClientProfile.accountEconomy,
    pendingChangesCount: addonClientProfile.pendingChangesCount,

    // World Bosses merged
    worldBosses: addonClientProfile.worldBosses || calculateWoWForeverWorldBosses().map((b) => ({
      name: b.name,
      zone: b.zone,
      status: b.status,
      bossId: b.id,
      lastKilled: b.lastKilledAt,
      respawnEstimate: b.respawnWindowFormatted,
      respawnMinEpoch: b.respawnMinEpoch,
      respawnMaxEpoch: b.respawnMaxEpoch,
      iconUrl: b.iconUrl,
    })),

    // Retail-exclusive items explicitly stripped
    mythicPlus: undefined,
  };

  return merged;
}
