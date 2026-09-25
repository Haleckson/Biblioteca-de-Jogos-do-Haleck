/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BlizzardProfileData,
  BlizzardCharacterSummary,
  BlizzardGearItem,
  BlizzardCollectionMount,
  BlizzardCollectionPet,
  BlizzardReputation,
} from "../types";
import { getWoWClassIcon, getWoWRaceIcon, getWoWFactionIcon } from "./blizzardIcons";

export interface ParsedAddonResult {
  activeProfile: BlizzardProfileData;
  allCharacters: BlizzardCharacterSummary[];
  detectedVersion: string;
  detectedVersionLabel: string;
  isForever: boolean;
  ruleset?: string;
  rawPayload?: any;
}

/**
 * Converts Lua SavedVariables table string to a JSON-compatible string
 */
function convertLuaToJson(luaStr: string): string {
  // Strip Lua comments --[[ ... ]]-- and -- ...
  let clean = luaStr
    .replace(/--\[\[[\s\S]*?\]\]--/g, "")
    .replace(/--.*$/gm, "")
    .trim();

  // If there's an assignment like HaleckAccountImporterDB = { ... }, extract the table
  const match = clean.match(/(?:HaleckAccountImporterDB|HaloWoWExporterDB|MyCharDataDB)\s*=\s*(\{[\s\S]*\})/);
  if (match && match[1]) {
    clean = match[1];
  }

  // Convert Lua table syntax to JSON
  // 1. Convert ["key"] = to "key":
  clean = clean.replace(/\[\s*"([^"]+)"\s*\]\s*=/g, '"$1":');

  // 2. Convert [123] = to "123":
  clean = clean.replace(/\[\s*([0-9]+)\s*\]\s*=/g, '"$1":');

  // 3. Convert identifier = to "identifier":
  clean = clean.replace(/([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g, '"$1":');

  // 4. Convert Lua nil to null
  clean = clean.replace(/:\s*nil\b/g, ": null");

  // 5. Remove trailing commas before } or ]
  clean = clean.replace(/,\s*([}\]])/g, "$1");

  return clean;
}

/**
 * Parses raw text (JSON or Lua SavedVariables) from Addon into a structured ParsedAddonResult
 */
export function parseAddonData(input: string | any): ParsedAddonResult {
  let root: any = null;

  if (typeof input === "object" && input !== null) {
    root = input;
  } else if (typeof input === "string") {
    const trimmed = input.trim();
    // Try standard JSON parse first
    try {
      root = JSON.parse(trimmed);
    } catch (_) {
      // Try Lua table conversion
      try {
        const jsonStr = convertLuaToJson(trimmed);
        root = JSON.parse(jsonStr);
      } catch (e) {
        // Last attempt: try regex match for any enclosed JSON-like object
        const objMatch = trimmed.match(/\{[\s\S]*\}/);
        if (objMatch) {
          try {
            root = JSON.parse(convertLuaToJson(objMatch[0]));
          } catch (e2) {
            throw new Error("Não foi possível processar o formato dos dados. Verifique se o conteúdo do arquivo Lua ou JSON está completo.");
          }
        } else {
          throw new Error("Formato não reconhecido. Cole o conteúdo de HaleckAccountImporter.lua ou o JSON exportado.");
        }
      }
    }
  }

  if (!root) {
    throw new Error("Dados vazios ou inválidos recebidos do Addon.");
  }

  // Extract inner snapshot if wrapped in lastExport or payload
  const snapshot = root.lastExport || root.payload || root;
  const char = snapshot.character || snapshot;
  const game = snapshot.game || {};

  const name = char.name || char.characterName || "Personagem Importado";
  const realm = char.realm || char.realmName || game.realm || "Azralon";
  const realmSlug = char.realmSlug || realm.toLowerCase().replace(/['\s]+/g, "-");
  const ruleset = char.ruleset || game.ruleset || (game.isForever ? realm : undefined);

  // Version detection
  let detectedVersion = (game.version || char.wow_version || "retail").toLowerCase();
  let isForever = false;

  if (
    ruleset ||
    game.isForever ||
    detectedVersion.includes("forever") ||
    realm.toLowerCase().includes("forever") ||
    realm.toLowerCase().includes("16001")
  ) {
    detectedVersion = "forever";
    isForever = true;
  } else if (detectedVersion.includes("classic") || detectedVersion === "era") {
    detectedVersion = "classic";
  } else if (detectedVersion.includes("mop") || detectedVersion.includes("pandaria")) {
    detectedVersion = "mop";
  } else if (detectedVersion.includes("tbc") || detectedVersion.includes("crusade")) {
    detectedVersion = "tbc";
  } else {
    detectedVersion = "retail";
  }

  const versionLabels: Record<string, string> = {
    retail: "WoW Retail (The War Within)",
    classic: "WoW Classic Era",
    forever: "WoW Forever (Beta 16001)",
    mop: "Mists of Pandaria",
    tbc: "The Burning Crusade",
  };
  const detectedVersionLabel = versionLabels[detectedVersion] || "World of Warcraft";

  const charClass = char.characterClass || char.class || "Warrior";
  const charRace = char.race || "Orc";
  const charGender = (char.gender || "MALE").toUpperCase();
  const charFaction = (char.faction || "HORDE").toUpperCase();
  const charLevel = Number(char.level) || 80;
  const equippedItemLevel = Number(char.equippedItemLevel || char.itemLevel) || 0;
  const averageItemLevel = Number(char.averageItemLevel || equippedItemLevel) || equippedItemLevel;
  const achievementPoints = Number(char.achievementPoints ?? snapshot.achievementPoints) || 0;

  // Process equipped items
  const rawEquipped = snapshot.equippedItems || snapshot.gear || [];
  const equippedItems: BlizzardGearItem[] = [];

  if (Array.isArray(rawEquipped)) {
    for (const item of rawEquipped) {
      if (item && (item.id || item.itemId)) {
        equippedItems.push({
          id: Number(item.id || item.itemId),
          itemId: Number(item.itemId || item.id),
          slot: item.slot || "UNKNOWN",
          name: item.name || `Item #${item.id || item.itemId}`,
          quality: String(item.quality || "EPIC").toUpperCase(),
          itemLevel: Number(item.itemLevel) || equippedItemLevel,
          iconUrl: item.iconUrl || item.icon || "",
          inventoryType: item.itemType || item.inventoryType || "Armor",
          transmog: item.transmog,
          enchantment: item.enchantment,
          stats: Array.isArray(item.stats) ? item.stats : [],
        });
      }
    }
  }

  // Process inventory
  const inventory = snapshot.inventory || {
    backpack: { id: 0, name: "Backpack", iconUrl: "", slotCount: 16, bagSlotIndex: 0, items: [] },
    bags: [],
    currencies: [],
    gold: 0,
    silver: 0,
    copper: 0,
  };

  // Process collections (mounts, pets)
  const collectionsMounts: BlizzardCollectionMount[] = [];
  const rawMounts = snapshot.collections?.mounts || snapshot.mounts || [];
  if (Array.isArray(rawMounts)) {
    for (const m of rawMounts) {
      if (m && (m.id || m.name)) {
        collectionsMounts.push({
          id: Number(m.id || m.spellId || Date.now()),
          name: m.name || "Mount",
          iconUrl: m.iconUrl || m.icon || "",
          spellId: m.spellId ? Number(m.spellId) : undefined,
          itemId: m.itemId ? Number(m.itemId) : undefined,
          mountType: m.mountType || "ground",
          source: m.source || "Addon Sync",
          description: m.description || "",
          isCollected: true,
        });
      }
    }
  }

  const collectionsPets: BlizzardCollectionPet[] = [];
  const rawPets = snapshot.collections?.pets || snapshot.pets || [];
  if (Array.isArray(rawPets)) {
    for (const p of rawPets) {
      if (p && (p.id || p.speciesId || p.name)) {
        collectionsPets.push({
          id: Number(p.id || p.speciesId || Date.now()),
          speciesId: p.speciesId ? Number(p.speciesId) : Number(p.id),
          name: p.name || "Pet",
          iconUrl: p.iconUrl || p.icon || "",
          family: p.family || "Beast",
          level: Number(p.level) || 1,
          quality: String(p.quality || "RARE").toUpperCase(),
          source: p.source || "Addon Sync",
          isCollected: true,
          isFavorite: !!p.isFavorite,
        });
      }
    }
  }

  // Process reputations
  const rawReps = snapshot.reputations || [];
  const parsedReputations: BlizzardReputation[] = [];
  if (Array.isArray(rawReps)) {
    const standingPtBRMap: Record<string, string> = {
      Exalted: "Exaltado",
      Revered: "Reverenciado",
      Honored: "Honrado",
      Friendly: "Respeitado",
      Neutral: "Neutro",
      Unfriendly: "Inamistoso",
      Hostile: "Hostil",
      Hated: "Odiado",
    };
    const tierColorMap: Record<string, string> = {
      Exalted: "text-cyan-400 bg-cyan-950/80 border-cyan-500/40",
      Revered: "text-blue-400 bg-blue-950/80 border-blue-500/40",
      Honored: "text-emerald-400 bg-emerald-950/80 border-emerald-500/40",
      Friendly: "text-green-400 bg-green-950/80 border-green-500/40",
      Neutral: "text-amber-400 bg-amber-950/80 border-amber-500/40",
      Unfriendly: "text-orange-400 bg-orange-950/80 border-orange-500/40",
      Hostile: "text-red-400 bg-red-950/80 border-red-500/40",
      Hated: "text-rose-500 bg-rose-950/80 border-rose-500/40",
    };
    for (const r of rawReps) {
      if (r && (r.factionName || r.name)) {
        const repName = r.factionName || r.name;
        const standing = r.standing || "Neutral";
        const current = Number(r.value ?? r.current ?? 0);
        const max = Number(r.max ?? 1) || 1;
        const percent = Math.min(100, Math.max(0, Math.round((current / max) * 100)));
        parsedReputations.push({
          id: Number(r.factionId || r.id || Date.now() + Math.random()),
          name: repName,
          standing,
          standingPtBR: standingPtBRMap[standing] || standing,
          current,
          max,
          percent,
          tierColor: tierColorMap[standing] || "text-zinc-400 bg-zinc-900 border-zinc-800",
          category: r.category || (detectedVersion === "retail" ? "The War Within" : "Azeroth"),
        });
      }
    }
  }

  // Process professions
  const rawProfessions = snapshot.professions || { primary: [], secondary: [] };
  const professions = {
    primary: Array.isArray(rawProfessions.primary) ? rawProfessions.primary : [],
    secondary: Array.isArray(rawProfessions.secondary) ? rawProfessions.secondary : [],
  };

  // Process PvP
  const rawPvp = snapshot.pvp || {};
  const pvp = {
    lifetimeHK: Number(rawPvp.lifetimeHK || 0),
    honorPoints: Number(rawPvp.honorPoints || 0),
    rankName: rawPvp.rankName || (charLevel >= 60 ? "Centurion" : "Soldier"),
    rankNumber: Number(rawPvp.rankNumber || 0),
    arenaRating: Number(rawPvp.arenaRating || 0),
  };

  // Process Lockouts
  const rawLockouts = snapshot.lockouts || [];
  const lockouts = Array.isArray(rawLockouts) ? rawLockouts : [];

  // Process Hardcore
  const rawHardcore = snapshot.hardcore || {};
  const isHardcore = !!(rawHardcore.isHardcore || isForever || realm.toLowerCase().includes("hardcore"));
  const isDead = !!rawHardcore.isDead;
  const hardcore = {
    isHardcore,
    isDead,
    survivalStatus: isDead ? "DEAD" : "ALIVE",
    snapshotTime: rawHardcore.snapshotTime || Date.now(),
    deathCertificate: snapshot.hardcoreDeathCertificate || rawHardcore.deathCertificate || undefined,
  };

  // Build active profile
  const activeProfile: BlizzardProfileData = {
    name,
    realm,
    realmSlug,
    ruleset,
    level: charLevel,
    characterClass: charClass,
    race: charRace,
    gender: charGender,
    faction: charFaction,
    equippedItemLevel,
    averageItemLevel,
    activeSpec: char.activeSpec || "Primary Spec",
    achievementPoints,
    achievementPointsTotal: achievementPoints,
    guild: char.guild,
    gameMode: detectedVersion,
    wow_version: detectedVersion,
    classIconUrl: getWoWClassIcon(charClass),
    raceIconUrl: getWoWRaceIcon(charRace, charGender),
    factionIconUrl: getWoWFactionIcon(charFaction),
    avatarUrl: getWoWRaceIcon(charRace, charGender),
    equippedItems,
    inventory,
    collections: {
      mounts: collectionsMounts,
      pets: collectionsPets,
      toys: snapshot.collections?.toys || [],
      titles: snapshot.collections?.titles || [],
      totalMountsCount: collectionsMounts.length,
      totalPetsCount: collectionsPets.length,
      totalToysCount: (snapshot.collections?.toys || []).length,
    },
    achievements: snapshot.achievements || [],
    reputations: parsedReputations.length > 0 ? parsedReputations : (snapshot.reputations || []),
    professions,
    pvp,
    lockouts,
    hardcore,
    hardcoreDeathCertificate: hardcore.deathCertificate,
    bank: snapshot.bank || {
      mainBank: [],
      reagentBank: [],
      warbandBank: [],
      lastBankVisit: undefined,
    },
    accountEconomy: snapshot.accountEconomy || {
      totalGold: 0,
      charactersGold: [],
      sessionDeltaGold: 0,
    },
    mythicPlus: snapshot.mythicPlus || {
      rating: 0,
      currentKeystone: undefined,
      runHistory: [],
      greatVault: [],
    },
    worldBosses: snapshot.worldBosses || [],
    stats: snapshot.stats || {
      health: charLevel <= 60 ? 5200 : 6400000,
      power: 100,
      armor: 8500,
    },
  };

  // Build character summary entry
  const summary: BlizzardCharacterSummary = {
    id: Date.now(),
    name,
    realm,
    realmSlug,
    ruleset,
    level: charLevel,
    characterClass: charClass,
    race: charRace,
    faction: charFaction,
    gender: charGender,
    equippedItemLevel,
    averageItemLevel,
    activeSpec: char.activeSpec || "Primary Spec",
    achievementPoints,
    gameMode: detectedVersion,
    wow_version: detectedVersion,
    guild: char.guild,
    classIconUrl: getWoWClassIcon(charClass),
    raceIconUrl: getWoWRaceIcon(charRace, charGender),
    factionIconUrl: getWoWFactionIcon(charFaction),
    avatarUrl: getWoWRaceIcon(charRace, charGender),
  };

  // Handle multi-character history if available
  const allCharacters: BlizzardCharacterSummary[] = [summary];

  return {
    activeProfile,
    allCharacters,
    detectedVersion,
    detectedVersionLabel,
    isForever,
    ruleset,
    rawPayload: snapshot,
  };
}
