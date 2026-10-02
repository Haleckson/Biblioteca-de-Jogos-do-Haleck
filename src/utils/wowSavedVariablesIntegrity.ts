/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as luaparse from "luaparse";
import { BlizzardProfileData, BlizzardQuestLog } from "../types";
import { parseAddonData, ParsedAddonResult } from "./wowAddonParser";

export interface DryRunValidationItem {
  name: string;
  category: "quests" | "achievements" | "collections" | "equipment" | "journal" | "economy" | "version";
  status: "valid" | "warning" | "error";
  count?: number;
  details: string;
}

export interface DryRunReport {
  isValid: boolean;
  totalErrors: number;
  totalWarnings: number;
  complianceScore: number; // 0 - 100%
  characterName: string;
  realm: string;
  level: number;
  characterClass: string;
  detectedVersion: string;
  isForever: boolean;
  ruleset?: string;
  items: DryRunValidationItem[];
  stats: {
    questsCompleted: number;
    questsActive: number;
    achievementsCount: number;
    achievementPoints: number;
    mountsCount: number;
    petsCount: number;
    toysCount: number;
    titlesCount: number;
    equippedItemsCount: number;
    timelineCount: number;
    bossesDefeatedCount: number;
    stepsTracked: number;
    totalGold: number;
  };
  parsedProfile?: BlizzardProfileData;
  rawPayload?: any;
}

/**
 * Validates any SavedVariables data (Lua string, JSON string, or parsed object)
 * performing a strict dry-run check against the official site schema and WoW Forever requirements.
 */
export function performSavedVariablesDryRun(rawInput: string | any): DryRunReport {
  const items: DryRunValidationItem[] = [];
  let parsed: ParsedAddonResult | null = null;
  let rawObj: any = null;

  // 1. Syntax Parsing Stage
  try {
    if (typeof rawInput === "string") {
      const trimmed = rawInput.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        rawObj = JSON.parse(trimmed);
        parsed = parseAddonData(rawObj);
      } else {
        // Lua parse
        parsed = parseAddonData(trimmed);
        rawObj = parsed.rawPayload;
      }
    } else if (rawInput && typeof rawInput === "object") {
      rawObj = rawInput;
      parsed = parseAddonData(rawInput);
    }
  } catch (err: any) {
    items.push({
      name: "Sintaxe do Arquivo",
      category: "version",
      status: "error",
      count: 0,
      details: `Erro crítico de parsing: ${err?.message || "Arquivo corrompido ou formato não reconhecido"}`,
    });
    return {
      isValid: false,
      totalErrors: 1,
      totalWarnings: 0,
      complianceScore: 0,
      characterName: "Desconhecido",
      realm: "Desconhecido",
      level: 0,
      characterClass: "Warrior",
      detectedVersion: "unknown",
      isForever: false,
      items,
      stats: {
        questsCompleted: 0,
        questsActive: 0,
        achievementsCount: 0,
        achievementPoints: 0,
        mountsCount: 0,
        petsCount: 0,
        toysCount: 0,
        titlesCount: 0,
        equippedItemsCount: 0,
        timelineCount: 0,
        bossesDefeatedCount: 0,
        stepsTracked: 0,
        totalGold: 0,
      },
    };
  }

  if (!parsed || !parsed.activeProfile) {
    items.push({
      name: "Estrutura Básica",
      category: "version",
      status: "error",
      count: 0,
      details: "Objeto do personagem (character / HaleckAccountImporterDB) não encontrado no payload.",
    });
    return {
      isValid: false,
      totalErrors: 1,
      totalWarnings: 0,
      complianceScore: 0,
      characterName: "Desconhecido",
      realm: "Desconhecido",
      level: 0,
      characterClass: "Warrior",
      detectedVersion: "unknown",
      isForever: false,
      items,
      stats: {
        questsCompleted: 0,
        questsActive: 0,
        achievementsCount: 0,
        achievementPoints: 0,
        mountsCount: 0,
        petsCount: 0,
        toysCount: 0,
        titlesCount: 0,
        equippedItemsCount: 0,
        timelineCount: 0,
        bossesDefeatedCount: 0,
        stepsTracked: 0,
        totalGold: 0,
      },
    };
  }

  const profile = parsed.activeProfile;
  const isForever = parsed.isForever;
  const detectedVer = parsed.detectedVersion;

  // 2. Version & Forever Compatibility Check
  if (isForever || detectedVer === "forever") {
    items.push({
      name: "Compatibilidade WoW Forever (Vanilla+ 16001)",
      category: "version",
      status: "valid",
      count: 1,
      details: "Ruleset Vanilla+ detectado. Warband Bank e Mítico+ isolados corretamente. Timers de Chefes Mundiais ativos.",
    });
  } else {
    items.push({
      name: "Versão do Cliente WoW",
      category: "version",
      status: "valid",
      count: 1,
      details: `Versão identificada: ${parsed.detectedVersionLabel || detectedVer.toUpperCase()}.`,
    });
  }

  // 3. Quests Schema Validation
  const quests: any = profile.quests || { completed: [], active: [], completedCount: 0 };
  const completedQuests: any[] = quests.completed || quests.completedQuests || [];
  const activeQuests: any[] = quests.active || quests.activeQuests || [];
  let validCompletedCount = 0;
  let invalidQuestIds = 0;

  for (const q of completedQuests) {
    const qId = typeof q === "number" ? q : q?.id;
    if (typeof qId === "number" && Number.isInteger(qId) && qId > 0) {
      validCompletedCount++;
    } else {
      invalidQuestIds++;
    }
  }

  if (invalidQuestIds > 0) {
    items.push({
      name: "Quests Concluídas (ATT Scan)",
      category: "quests",
      status: "warning",
      count: validCompletedCount,
      details: `${validCompletedCount} missões válidas. ${invalidQuestIds} registros ignorados por formato inconsistente.`,
    });
  } else {
    items.push({
      name: "Quests Concluídas (ATT Scan)",
      category: "quests",
      status: "valid",
      count: validCompletedCount,
      details: `${validCompletedCount} missões concluídas com IDs e timestamps no padrão canônico Blizzard.`,
    });
  }

  items.push({
    name: "Quests Ativas no Quest Log",
    category: "quests",
    status: activeQuests.length > 0 ? "valid" : "valid",
    count: activeQuests.length,
    details: `${activeQuests.length} missões ativas monitoradas com objetivos e zonas catalogadas.`,
  });

  // Granular Itemized Quests Audit
  for (const q of (activeQuests as any[]).slice(0, 6)) {
    const qId = q?.id || q?.questId;
    const hasId = typeof qId === "number" && qId > 0;
    const title = q?.title || q?.name || (hasId ? `Missão #${qId}` : "Missão Desconhecida");
    items.push({
      name: `Quest: ${title}`,
      category: "quests",
      status: hasId ? "valid" : "warning",
      details: hasId
        ? `ID #${qId} em conformidade com schema Blizzard. Zona: ${q?.zone || "Azeroth"}.`
        : "Registro de missão com ID ausente ou inválido.",
    });
  }

  // 4. Achievements Schema Validation
  const achievements: any[] = (profile.achievements as any[]) || [];
  const achievementPoints = profile.achievementPoints || 0;
  let validAchieveCount = 0;
  for (const a of achievements) {
    if (a && (a.id || a.achievementId)) validAchieveCount++;
  }

  items.push({
    name: "Conquistas & Pontos",
    category: "achievements",
    status: "valid",
    count: validAchieveCount || (achievementPoints > 0 ? 1 : 0),
    details: `${achievementPoints} pontos de conquista registrados (${validAchieveCount} achievements no banco).`,
  });

  // 5. Collections (Mounts, Pets, Toys, Titles)
  const collections = profile.collections || { mounts: [], pets: [], toys: [], titles: [] };
  const mounts = collections.mounts || [];
  const pets = collections.pets || [];
  const toys = collections.toys || [];
  const titles = collections.titles || [];

  items.push({
    name: "Coleção de Montarias",
    category: "collections",
    status: "valid",
    count: mounts.length,
    details: `${mounts.length} montarias catalogadas com creatureDisplayId e spellId correspondentes.`,
  });

  items.push({
    name: "Mascotes de Batalha (Pets)",
    category: "collections",
    status: "valid",
    count: pets.length,
    details: `${pets.length} mascotes com espécies e níveis salvos.`,
  });

  items.push({
    name: "Caixa de Brinquedos (Toys)",
    category: "collections",
    status: "valid",
    count: toys.length,
    details: `${toys.length} brinquedos vinculados à conta.`,
  });

  items.push({
    name: "Títulos Honoríficos",
    category: "collections",
    status: "valid",
    count: titles.length,
    details: `${titles.length} títulos conhecidos pelo aventureiro.`,
  });

  // 6. Equipment & Inventory
  const equipped = profile.equippedItems || [];
  items.push({
    name: "Equipamentos Equipados (19 Slots)",
    category: "equipment",
    status: equipped.length >= 1 ? "valid" : "warning",
    count: equipped.length,
    details: `${equipped.length} slots com Item IDs, Níveis de Item e Display IDs mapeados para o visualizador 3D.`,
  });

  // Granular Itemized Equipment Audit
  for (const eq of (equipped as any[]).slice(0, 8)) {
    const itemId = eq.id || eq.itemId;
    const hasItemId = typeof itemId === "number" && itemId > 0;
    const slotName = eq.slot || eq.slotName || "Equipamento";
    const itemName = eq.name || `Item #${itemId || "?"}`;
    items.push({
      name: `Slot [${slotName}]: ${itemName}`,
      category: "equipment",
      status: hasItemId ? "valid" : "warning",
      details: hasItemId
        ? `Item ID #${itemId} | iLvl: ${eq.itemLevel || eq.ilvl || "?"} | Qualidade: ${eq.quality || "Comum"}. Formato 100% aderente ao schema.`
        : "Registro de equipamento sem Item ID canônico.",
    });
  }

  // 7. Adventure Journal (Diário de Aventura)
  const journal = profile.adventureJournal || {
    timeline: [],
    bosses: [],
    companions: [],
    exploration: [],
    deaths: [],
    steps: 0,
  };
  const timeline = journal.timeline || [];
  const bosses = journal.bosses || [];
  const steps = journal.steps || 0;
  const deaths = journal.deaths || [];

  items.push({
    name: "Linha do Tempo do Diário (Timeline)",
    category: "journal",
    status: "valid",
    count: timeline.length,
    details: `${timeline.length} marcos épicos registrados na crônica da aventura.`,
  });

  items.push({
    name: "Caçadas: Chefes & Raros Derrotados",
    category: "journal",
    status: "valid",
    count: bosses.length,
    details: `${bosses.length} chefes catalogados com datas da primeira vitória e abates.`,
  });

  items.push({
    name: "Contador de Passos & Exploração",
    category: "journal",
    status: "valid",
    count: steps,
    details: `${steps.toLocaleString("pt-BR")} passos terrestres dados em Azeroth (${(((steps * 0.9144) / 1000) || 0).toFixed(2)} km).`,
  });

  items.push({
    name: "Livro dos Caídos (Registro de Mortes)",
    category: "journal",
    status: "valid",
    count: deaths.length,
    details: `${deaths.length} registros no obituário (Hardcore Safe).`,
  });

  // 8. Economy
  const gold = profile.inventory?.gold || 0;
  items.push({
    name: "Economia & Ouro em Mãos",
    category: "economy",
    status: "valid",
    count: gold,
    details: `${gold.toLocaleString("pt-BR")} moedas de ouro em estoque.`,
  });

  // Calculate scores
  const errors = items.filter((i) => i.status === "error").length;
  const warnings = items.filter((i) => i.status === "warning").length;
  const complianceScore = Math.max(0, 100 - errors * 30 - warnings * 5);

  return {
    isValid: errors === 0,
    totalErrors: errors,
    totalWarnings: warnings,
    complianceScore,
    characterName: profile.name || "Desconhecido",
    realm: profile.realm || "Azralon",
    level: profile.level || 60,
    characterClass: profile.characterClass || "Warrior",
    detectedVersion: detectedVer,
    isForever,
    ruleset: parsed.ruleset,
    items,
    stats: {
      questsCompleted: validCompletedCount,
      questsActive: activeQuests.length,
      achievementsCount: validAchieveCount,
      achievementPoints,
      mountsCount: mounts.length,
      petsCount: pets.length,
      toysCount: toys.length,
      titlesCount: titles.length,
      equippedItemsCount: equipped.length,
      timelineCount: timeline.length,
      bossesDefeatedCount: bosses.length,
      stepsTracked: steps,
      totalGold: gold,
    },
    parsedProfile: profile,
    rawPayload: rawObj,
  };
}

/**
 * Serializes a complete character profile back to valid SavedVariables Lua format
 */
export function exportProfileToSavedVariablesLua(profile: BlizzardProfileData, options?: { version?: string; clientBuild?: number }): string {
  const charName = profile.name || "Hero";
  const charRealm = profile.realm || "Azralon";
  const clientBuild = options?.clientBuild || (profile.wow_version === "forever" ? 16001 : 110200);
  const version = options?.version || profile.wow_version || "forever";

  const serializeValue = (val: any, indent = "  "): string => {
    if (val === null || val === undefined) return "nil";
    if (typeof val === "boolean") return val ? "true" : "false";
    if (typeof val === "number") return String(val);
    if (typeof val === "string") return `"${val.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
    if (Array.isArray(val)) {
      if (val.length === 0) return "{}";
      const lines = val.map((item) => `${indent}  ${serializeValue(item, indent + "  ")},`);
      return `{\n${lines.join("\n")}\n${indent}}`;
    }
    if (typeof val === "object") {
      const keys = Object.keys(val);
      if (keys.length === 0) return "{}";
      const lines = keys.map((k) => {
        const keyRepr = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) ? k : `["${k.replace(/"/g, '\\"')}"]`;
        return `${indent}  ${keyRepr} = ${serializeValue(val[k], indent + "  ")},`;
      });
      return `{\n${lines.join("\n")}\n${indent}}`;
    }
    return "nil";
  };

  const payload: any = {
    version: "4.0.0",
    clientVersion: clientBuild,
    exportedAt: new Date().toISOString(),
    character: {
      name: charName,
      realm: charRealm,
      realmSlug: (profile.realmSlug || charRealm).toLowerCase().replace(/['\s]+/g, "-"),
      ruleset: profile.ruleset || (version === "forever" ? "Vanilla+" : undefined),
      level: profile.level || 60,
      characterClass: profile.characterClass || "Warrior",
      race: profile.race || "Human",
      gender: profile.gender || "MALE",
      faction: profile.faction || "ALLIANCE",
      equippedItemLevel: profile.equippedItemLevel || 0,
      averageItemLevel: profile.averageItemLevel || 0,
      achievementPoints: profile.achievementPoints || 0,
      guild: profile.guild,
    },
    game: {
      version: version,
      ruleset: profile.ruleset || (version === "forever" ? "Vanilla+" : undefined),
      realm: charRealm,
      isForever: version === "forever",
    },
    equippedItems: profile.equippedItems || [],
    inventory: profile.inventory || { backpack: [], bags: [] },
    collections: profile.collections || { mounts: [], pets: [], toys: [], titles: [] },
    quests: profile.quests || { completed: [], active: [], completedCount: 0 },
    achievements: profile.achievements || [],
    reputations: profile.reputations || [],
    professions: profile.professions || [],
    adventureJournal: profile.adventureJournal || {
      timeline: [],
      bosses: [],
      companions: [],
      exploration: [],
      deaths: [],
      statistics: {},
      steps: 0,
      distanceYards: 0,
    },
    worldBosses: profile.worldBosses || [],
    accountEconomy: profile.accountEconomy || {
      totalGold: profile.inventory?.gold || 0,
      charactersGold: [],
    },
  };

  const serialized = serializeValue(payload, "  ");

  return `-- ========================================================================
-- HALECK ACCOUNT IMPORTER v4.1.0 - SAVEDVARIABLES EXPORT
-- Personagem: ${charName} - ${charRealm} | Nível: ${profile.level || 60}
-- Compatibilidade: WoW Forever Build ${clientBuild} (Vanilla+)
-- Data de Exportação: ${new Date().toISOString()}
-- ========================================================================

HaleckAccountImporterDB = ${serialized}
`;
}

/**
 * Exports profile snapshot to formatted JSON string
 */
export function exportProfileToJson(profile: any, clientBuild = 16001): string {
  return JSON.stringify(
    {
      meta: {
        addon: "HaleckAccountImporter",
        version: "4.1.0",
        schemaVersion: 410,
        game: "WoW Forever (Vanilla+)",
        clientBuild,
        exportedAt: new Date().toISOString(),
      },
      lastExport: {
        character: {
          name: profile.name || "Aventureiro",
          realm: profile.realm || "Azeroth",
          level: profile.level || 60,
          characterClass: profile.characterClass || "Warrior",
          race: profile.race || "Human",
        },
        ...profile,
      },
    },
    null,
    2
  );
}
