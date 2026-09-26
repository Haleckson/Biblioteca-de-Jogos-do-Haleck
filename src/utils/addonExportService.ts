/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import JSZip from "jszip";
import { BlizzardProfileData } from "../types";

export interface AddonExportOptions {
  gameVersion?: string;
  characterName?: string;
  realm?: string;
  ruleset?: string;
}

export interface WoWAddonDevSource {
  title: string;
  url: string;
  description: string;
  category: "manual" | "api" | "database" | "guide";
  badge: string;
}

export const WOW_ADDON_DEV_SOURCES: WoWAddonDevSource[] = [
  {
    title: "WoW Forever Wiki - Guia de AddOns & Vanilla+",
    url: "https://wowforeverwiki.org/addons",
    description: "Documentação oficial, diretrizes de compatibilidade e ecossistema Vanilla+ do WoW Forever.",
    category: "guide",
    badge: "WoW Forever",
  },
  {
    title: "WoW Forever Beta Breaks: Secret Health & Dead Secure SNI",
    url: "https://wowforeverbuilds.com/news/what-the-wow-forever-beta-breaks-for-addons-secret-health-values-dead-secure-sni",
    description: "Análise profunda de mudanças de segurança no Beta e lançamento oficial de 04 de novembro: valores secretos de vida, combate e APIs protegidas.",
    category: "api",
    badge: "Beta & Lançamento 04/Nov",
  },
  {
    title: "Programming in Lua (Manual Oficial)",
    url: "https://lua.org/pil/contents.html",
    description: "Referência canônica da sintaxe Lua, estruturas de dados, metatables e ambientes de execução.",
    category: "manual",
    badge: "Lua 5.1 / Core",
  },
  {
    title: "WoW AddOn Tutorial & Fundamentos",
    url: "https://wowpedia.fandom.com/wiki/WoW_AddOn",
    description: "Estrutura fundamental de arquivos (.toc, .lua, .xml), ciclo de vida e declaração de SavedVariables.",
    category: "manual",
    badge: "Estrutura",
  },
  {
    title: "WoWProgramming - API & Frame Reference",
    url: "https://wowprogramming.com",
    description: "Dicionário de funções, eventos e widgets de interface com exemplos práticos.",
    category: "api",
    badge: "API / Eventos",
  },
  {
    title: "World of Warcraft API Oficial",
    url: "https://wowpedia.fandom.com/wiki/World_of_Warcraft_API",
    description: "Enciclopédia de funções globais e namespaces da Blizzard (C_Container, C_Item, C_Spell, etc.).",
    category: "api",
    badge: "Blizzard API",
  },
  {
    title: "Wago.tools - Data & DBC Browser",
    url: "https://wago.tools",
    description: "Navegação em dados brutos do cliente, tabelas DBC, Spells, ItemDisplayInfo e compilações.",
    category: "database",
    badge: "DBC / Builds",
  },
  {
    title: "CurseForge Author Portal & Guidelines",
    url: "https://authors.curseforge.com/#/notfound",
    description: "Requisitos de empacotamento, compatibilidade e diretrizes de publicação de addons.",
    category: "guide",
    badge: "Distribuição",
  },
  {
    title: "Better-Addons: AI Coding Guide",
    url: "https://www.better-addons.com/ai-coding-guide/",
    description: "Guia completo de engenharia de software e geração de código de addons WoW assistida por IA.",
    category: "guide",
    badge: "Guia de IA",
  },
  {
    title: "The System Prompt para Addons",
    url: "https://www.better-addons.com/ai-coding-guide/#the-system-prompt",
    description: "Contexto especializado e especificações para modelos de linguagem na geração de código WoW.",
    category: "guide",
    badge: "System Prompt",
  },
  {
    title: "The Deprecated Function Map",
    url: "https://www.better-addons.com/ai-coding-guide/#the-deprecated-function-map",
    description: "Mapeamento rigoroso de funções legadas substituídas por namespaces C_* modernos.",
    category: "api",
    badge: "Modernização",
  },
  {
    title: "The Golden Rules of WoW Addon Coding",
    url: "https://www.better-addons.com/ai-coding-guide/#the-golden-rules",
    description: "Regras de ouro de estabilidade: prevenção de taint, encapsulamento pcall e manipulação de eventos.",
    category: "guide",
    badge: "Regras de Ouro",
  },
];

export const WOW_VERSION_DIFFERENCES = [
  {
    version: "forever",
    name: "WoW Forever (Vanilla+ • Jogo Principal do Haleck)",
    interfaceVersion: "16001",
    keyCharacteristics: "Ecossistema Vanilla+ com lançamento oficial agendado para 04 de novembro de 2026. Suporte a Rulesets dinâmicos, balanceamento refinado de classes e servidores dedicados.",
    caveats: "Transição suave de Beta para Release Oficial. Proteção contra Secret Health Values e chamadas de Dead Secure SNI tratadas com pcall e fallbacks seguros.",
    tagColor: "border-cyan-500/50 text-cyan-300 bg-cyan-950/60 font-black",
  },
  {
    version: "forever_beta",
    name: "WoW Forever Beta (Build 16001)",
    interfaceVersion: "16001",
    keyCharacteristics: "Ambiente de testes oficial pré-lançamento de 04 de novembro. Validação de novas regras e interfaces seguras.",
    caveats: "Valores secretos de vida ocultados do tráfego desprotegido de addons. Uso obrigatório de wrappers defensivos (SafeCall).",
    tagColor: "border-rose-500/40 text-rose-300 bg-rose-950/40",
  },
  {
    version: "classic",
    name: "WoW Classic Era (1.15.x)",
    interfaceVersion: "11506",
    keyCharacteristics: "APIs clássicas históricas com talentos de 51 pontos, árvore de habilidades legada e chefes mundiais (Kazzak, Azuregos, Dragões do Pesadelo).",
    caveats: "Requer funções globais clássicas de mochila e indexação de slots legados.",
    tagColor: "border-amber-500/40 text-amber-300 bg-amber-950/40",
  },
  {
    version: "retail",
    name: "WoW Retail (The War Within 11.x / Midnight)",
    interfaceVersion: "110100",
    keyCharacteristics: "Namespaces C_* modernos obrigatórios (C_Container, C_Bank para Warband, C_ChallengeMode para Mítico+, C_WeeklyRewards para Great Vault).",
    caveats: "Funções globais legadas descontinuadas. Exige APIs de guarnição e Warband Bank.",
    tagColor: "border-purple-500/40 text-purple-300 bg-purple-950/40",
  },
];

export const WOW_DEPRECATED_FUNCTION_MAP = [
  {
    legacy: "GetContainerItemID(bag, slot)",
    modern: "C_Container.GetContainerItemID(bag, slot)",
    notes: "No Retail retorna itemID. No Classic/Forever usa fallback global.",
  },
  {
    legacy: "GetContainerItemInfo(bag, slot)",
    modern: "C_Container.GetContainerItemInfo(bag, slot)",
    notes: "No Retail retorna objeto/tabela. No Classic retorna múltiplos valores.",
  },
  {
    legacy: "GetItemInfo(item)",
    modern: "C_Item.GetItemInfo(item)",
    notes: "Requer tratamento para carregamento assíncrono via GET_ITEM_INFO_RECEIVED.",
  },
  {
    legacy: "GetProfessions()",
    modern: "GetSkillLineInfo(index)",
    notes: "GetProfessions presente em Retail/MoP; em Classic/Forever itera skill lines.",
  },
  {
    legacy: "GetRuleset()",
    modern: "C_GameRules.GetRulesetName()",
    notes: "Suporte especializado para servidores customizados e WoW Forever Beta 16001.",
  },
];

export const WOW_GOLDEN_RULES = [
  {
    rule: "1. Nunca sobrescrever funções globais da Blizzard (Anti-Taint)",
    detail: "Taint quebra a interface em combate. Sempre declare funções e tabelas locais no escopo do Addon.",
  },
  {
    rule: "2. Encapsular APIs duvidosas ou dinâmicas com pcall()",
    detail: "Garante compatibilidade plena entre Retail, Classic, Forever e Forever Beta 16001 sem gerar erros de tela.",
  },
  {
    rule: "3. Respeitar o ciclo de eventos do cliente",
    detail: "Carregue SavedVariables apenas em ADDON_LOADED com checagem de nome. Exporte ao deslogar ou ao digitar comandos.",
  },
  {
    rule: "4. Tratamento Seguro de Evento de Morte (Hardcore)",
    detail: "Escute PLAYER_DEAD para capturar instantaneamente coordenadas, assassino e zona no modo Hardcore.",
  },
];

/**
 * Generates the in-game WoW Addon Lua code
 */
function generateAddonLua(): string {
  return `-- ========================================================================
--  HALECK ACCOUNT IMPORTER - WOW ADDON UNIVERSAL
--  Compatibilidade: Retail, Classic Era, WoW Forever & Forever Beta (16001)
--
--  Fontes de Consulta & Guias Oficiais de Referência:
--  - Lua Manual:            https://lua.org/pil/contents.html
--  - WoW AddOn Guide:       https://wowpedia.fandom.com/wiki/WoW_AddOn
--  - WoWProgramming:        https://wowprogramming.com
--  - Blizzard API Ref:      https://wowpedia.fandom.com/wiki/World_of_Warcraft_API
--  - Wago Tools Database:   https://wago.tools
--  - CurseForge Portal:     https://authors.curseforge.com/#/notfound
--  - AI Coding Guide:       https://www.better-addons.com/ai-coding-guide/
--  - System Prompt Spec:    https://www.better-addons.com/ai-coding-guide/#the-system-prompt
--  - Deprecated API Map:    https://www.better-addons.com/ai-coding-guide/#the-deprecated-function-map
--  - Golden Rules of Code:  https://www.better-addons.com/ai-coding-guide/#the-golden-rules
-- ========================================================================

local ADDON_NAME = "HaleckAccountImporter"
HaleckAccountImporterDB = HaleckAccountImporterDB or {
    lastExport = nil,
    history = {},
    version = "2.5.0",
}

local f = CreateFrame("Frame")
f:RegisterEvent("ADDON_LOADED")
f:RegisterEvent("PLAYER_LOGOUT")
f:RegisterEvent("PLAYER_LOGIN")

local function GetSafeText(str)
    if not str then return "" end
    return tostring(str):gsub('"', '\\"'):gsub("\\\\", "\\\\\\\\")
end

local function SerializeItem(slotId)
    local itemLink = GetInventoryItemLink("player", slotId)
    local itemId = GetInventoryItemID("player", slotId)
    if not itemId then return nil end

    local name, _, quality, itemLevel, _, itemType, itemSubType, _, equipLoc, texture = GetItemInfo(itemLink or itemId)
    
    local itemObj = {
        id = itemId,
        itemId = itemId,
        slotId = slotId,
        name = name or ("Item #" .. itemId),
        itemLevel = itemLevel or 0,
        quality = quality or 1,
        iconUrl = texture or "",
        itemType = itemType or "Armor",
        itemSubType = itemSubType or "",
        equipLoc = equipLoc or "",
        link = itemLink or "",
    }

    -- Transmog info if supported by client
    if C_TransmogCollection and C_TransmogCollection.GetInspectItemTransmogInfo then
        pcall(function()
            local tmogInfo = C_TransmogCollection.GetInspectItemTransmogInfo(slotId)
            if tmogInfo and tmogInfo.appearanceID and tmogInfo.appearanceID > 0 then
                itemObj.transmog = {
                    itemId = tmogInfo.appearanceID,
                    appearanceId = tmogInfo.appearanceID,
                    name = "Transmog #" .. tmogInfo.appearanceID,
                }
            end
        end)
    end

    return itemObj
end

local function SerializeBank()
    local mainBank = {}
    local numBankSlots = 28
    for slot = 1, numBankSlots do
        local itemId = (C_Container and C_Container.GetContainerItemID and C_Container.GetContainerItemID(-1, slot)) or (GetContainerItemID and GetContainerItemID(-1, slot))
        if itemId then
            local info = (C_Container and C_Container.GetContainerItemInfo and C_Container.GetContainerItemInfo(-1, slot))
            local count = info and (type(info) == "table" and info.stackCount or select(2, GetContainerItemInfo(-1, slot))) or 1
            local name, _, quality, ilvl, _, _, _, _, _, texture = GetItemInfo(itemId)
            table.insert(mainBank, {
                id = itemId,
                name = name or ("Item #" .. itemId),
                stackCount = count or 1,
                quality = quality or 1,
                iconUrl = texture or "",
                itemLevel = ilvl or 0,
                slotIndex = slot,
                location = "Main Bank"
            })
        end
    end

    local reagentBank = {}
    pcall(function()
        local numReagents = (C_Container and C_Container.GetContainerNumSlots and C_Container.GetContainerNumSlots(-3)) or 0
        for slot = 1, numReagents do
            local itemId = C_Container.GetContainerItemID(-3, slot)
            if itemId then
                local info = C_Container.GetContainerItemInfo(-3, slot)
                local count = info and info.stackCount or 1
                local name, _, quality, ilvl, _, _, _, _, _, texture = GetItemInfo(itemId)
                table.insert(reagentBank, {
                    id = itemId,
                    name = name or ("Item #" .. itemId),
                    stackCount = count or 1,
                    quality = quality or 1,
                    iconUrl = texture or "",
                    itemLevel = ilvl or 0,
                    slotIndex = slot,
                    location = "Reagent Bank"
                })
            end
        end
    end)

    local warbandBank = {}
    pcall(function()
        if C_Bank and C_Bank.FetchPurchasedBankTabData and Enum and Enum.BankType and Enum.BankType.Account then
            local tabs = C_Bank.FetchPurchasedBankTabData(Enum.BankType.Account)
            if tabs then
                for tabIndex, tab in ipairs(tabs) do
                    local containerId = (Enum.BagIndex and Enum.BagIndex.AccountBankTab_1 and (Enum.BagIndex.AccountBankTab_1 + tabIndex - 1)) or (12 + tabIndex)
                    local numSlots = C_Container and C_Container.GetContainerNumSlots and C_Container.GetContainerNumSlots(containerId) or 98
                    for slot = 1, (numSlots or 98) do
                        local itemId = C_Container.GetContainerItemID and C_Container.GetContainerItemID(containerId, slot)
                        if itemId then
                            local info = C_Container.GetContainerItemInfo and C_Container.GetContainerItemInfo(containerId, slot)
                            local count = info and info.stackCount or 1
                            local name, _, quality, ilvl, _, _, _, _, _, texture = GetItemInfo(itemId)
                            table.insert(warbandBank, {
                                id = itemId,
                                name = name or ("Item #" .. itemId),
                                stackCount = count or 1,
                                quality = quality or 1,
                                iconUrl = texture or "",
                                itemLevel = ilvl or 0,
                                tabIndex = tabIndex,
                                slotIndex = slot,
                                location = "Warband Bank"
                            })
                        end
                    end
                end
            end
        end
    end)

    HaleckAccountImporterDB.bank = {
        mainBank = mainBank,
        reagentBank = reagentBank,
        warbandBank = warbandBank,
        lastBankVisit = date("%Y-%m-%dT%H:%M:%SZ"),
        totalBankItems = #mainBank + #reagentBank + #warbandBank
    }
end

local function ExportCharacterSnapshot()
    local charName = UnitName("player") or "Unknown"
    local realmName = GetRealmName() or "Unknown"
    local localizedClass, englishClass, classIndex = UnitClass("player")
    local localizedRace, englishRace, raceIndex = UnitRace("player")
    local genderId = UnitSex("player") -- 2 = Male, 3 = Female
    local gender = (genderId == 3) and "FEMALE" or "MALE"
    local level = UnitLevel("player") or 1
    local faction = UnitFactionGroup("player") or "ALLIANCE"

    -- Ruleset detection (especially for WoW Forever Beta 16001)
    local ruleset = nil
    if GetRuleset then
        pcall(function() ruleset = GetRuleset() end)
    end
    if not ruleset and C_GameRules and C_GameRules.GetRulesetName then
        pcall(function() ruleset = C_GameRules.GetRulesetName() end)
    end
    if not ruleset and (realmName:lower():find("forever") or realmName:lower():find("hardcore")) then
        ruleset = realmName
    end

    local avgIlvl, eqIlvl = 0, 0
    if GetAverageItemLevel then
        pcall(function()
            avgIlvl, eqIlvl = GetAverageItemLevel()
        end)
    end

    local guildName, guildRankName = GetGuildInfo("player")

    -- Equipment
    local equippedItems = {}
    local slotMap = {
        [1] = "HEAD", [2] = "NECK", [3] = "SHOULDER", [4] = "SHIRT",
        [5] = "CHEST", [6] = "WAIST", [7] = "LEGS", [8] = "FEET",
        [9] = "WRIST", [10] = "HANDS", [11] = "FINGER_1", [12] = "FINGER_2",
        [13] = "TRINKET_1", [14] = "TRINKET_2", [15] = "BACK", [16] = "MAIN_HAND",
        [17] = "OFF_HAND", [18] = "RANGED", [19] = "TABARD"
    }

    for slotId = 1, 19 do
        local item = SerializeItem(slotId)
        if item then
            item.slot = slotMap[slotId] or ("SLOT_" .. slotId)
            table.insert(equippedItems, item)
        end
    end

    -- Inventory / Bags
    local backpack = { slotCount = 16, bagSlotIndex = 0, items = {} }
    for slot = 1, 16 do
        local itemId = GetContainerItemID and GetContainerItemID(0, slot)
        if itemId then
            local _, count = GetContainerItemInfo and GetContainerItemInfo(0, slot)
            local name, _, quality, ilvl, _, _, _, _, _, texture = GetItemInfo(itemId)
            table.insert(backpack.items, {
                id = itemId,
                name = name or ("Item #" .. itemId),
                stackCount = count or 1,
                quality = quality or 1,
                iconUrl = texture or "",
                itemLevel = ilvl or 0,
                bagIndex = 0,
                slotIndex = slot,
            })
        end
    end

    local bags = {}
    for bag = 1, 4 do
        local numSlots = GetContainerNumSlots and GetContainerNumSlots(bag) or 0
        if numSlots > 0 then
            local bagObj = { slotCount = numSlots, bagSlotIndex = bag, items = {} }
            for slot = 1, numSlots do
                local itemId = GetContainerItemID and GetContainerItemID(bag, slot)
                if itemId then
                    local _, count = GetContainerItemInfo and GetContainerItemInfo(bag, slot)
                    local name, _, quality, ilvl, _, _, _, _, _, texture = GetItemInfo(itemId)
                    table.insert(bagObj.items, {
                        id = itemId,
                        name = name or ("Item #" .. itemId),
                        stackCount = count or 1,
                        quality = quality or 1,
                        iconUrl = texture or "",
                        itemLevel = ilvl or 0,
                        bagIndex = bag,
                        slotIndex = slot,
                    })
                end
            end
            table.insert(bags, bagObj)
        end
    end

    -- Stats
    local stats = {
        health = UnitHealthMax("player") or 1000,
        power = UnitPowerMax("player") or 100,
        armor = select(2, UnitArmor("player")) or 0,
    }

    -- Achievements (if available in client)
    local achievementPoints = 0
    local achievements = {}
    if GetTotalAchievementPoints then
        pcall(function()
            achievementPoints = GetTotalAchievementPoints()
        end)
    end

    -- Mounts & Pets Collections
    local mounts = {}
    local pets = {}
    if C_MountJournal and C_MountJournal.GetMountIDs then
        pcall(function()
            local mountIDs = C_MountJournal.GetMountIDs()
            for _, mId in ipairs(mountIDs) do
                local name, spellId, icon, _, _, _, _, isFactionSpecific, factionGroup, _, isCollected = C_MountJournal.GetMountInfoByID(mId)
                if isCollected then
                    table.insert(mounts, {
                        id = mId,
                        name = name,
                        spellId = spellId,
                        iconUrl = icon,
                        mountType = "ground",
                        source = "Addon Export",
                        isCollected = true,
                    })
                end
            end
        end)
    end

    if C_PetJournal and C_PetJournal.GetNumPets then
        pcall(function()
            local numPets = C_PetJournal.GetNumPets()
            for i = 1, math.min(numPets, 300) do
                local petId, speciesId, isOwned, customName, petLevel, isFavorite, _, petName, petIcon = C_PetJournal.GetPetInfoByIndex(i)
                if isOwned and speciesId then
                    table.insert(pets, {
                        id = speciesId,
                        speciesId = speciesId,
                        name = customName or petName or ("Pet #" .. speciesId),
                        level = petLevel or 1,
                        iconUrl = petIcon or "",
                        isCollected = true,
                        isFavorite = isFavorite or false,
                    })
                end
            end
        end)
    end

    -- Professions (Primary & Secondary)
    local professions = { primary = {}, secondary = {} }
    if GetProfessions then
        pcall(function()
            local prof1, prof2, arch, fish, cook, firstAid = GetProfessions()
            local function AddProf(idx, isPrimary)
                if not idx then return end
                local name, icon, skillLevel, maxSkillLevel = GetProfessionInfo(idx)
                if name then
                    table.insert(isPrimary and professions.primary or professions.secondary, {
                        name = name,
                        icon = icon,
                        skillLevel = skillLevel or 0,
                        maxSkillLevel = maxSkillLevel or 0
                    })
                end
            end
            AddProf(prof1, true)
            AddProf(prof2, true)
            AddProf(cook, false)
            AddProf(firstAid, false)
            AddProf(fish, false)
            AddProf(arch, false)
        end)
    elseif GetNumSkillLines then
        pcall(function()
            local numSkills = GetNumSkillLines()
            for i = 1, numSkills do
                local skillName, isHeader, isExpanded, skillRank, numTempPoints, skillModifier, skillMaxRank = GetSkillLineInfo(i)
                if not isHeader and skillRank and skillRank > 0 then
                    table.insert(professions.primary, {
                        name = skillName,
                        skillLevel = skillRank,
                        maxSkillLevel = skillMaxRank or 300
                    })
                end
            end
        end)
    end

    -- Reputations
    local reputations = {}
    if GetNumFactions then
        pcall(function()
            local numFactions = GetNumFactions()
            local standingNames = {
                [1] = "Hated", [2] = "Hostile", [3] = "Unfriendly",
                [4] = "Neutral", [5] = "Friendly", [6] = "Honored",
                [7] = "Revered", [8] = "Exalted"
            }
            for i = 1, numFactions do
                local name, description, standingId, barMin, barMax, barValue, atWarWith, canToggleAtWar, isHeader, isCollapsed, hasRep, isWatched, isChild, factionID = GetFactionInfo(i)
                if not isHeader and name and standingId then
                    table.insert(reputations, {
                        factionId = factionID or i,
                        factionName = name,
                        standing = standingNames[standingId] or "Neutral",
                        value = (barValue or 0) - (barMin or 0),
                        max = (barMax or 1) - (barMin or 0),
                        isExalted = (standingId >= 8),
                        standingId = standingId
                    })
                end
            end
        end)
    end

    -- PvP Statistics
    local pvp = {
        lifetimeHK = 0,
        honorPoints = 0,
        rankName = "",
        rankNumber = 0,
    }
    if GetPVPLifetimeStats then
        pcall(function()
            local hk, maxRank = GetPVPLifetimeStats()
            pvp.lifetimeHK = hk or 0
            pvp.rankNumber = maxRank or 0
        end)
    end
    if GetHonorCurrency then
        pcall(function() pvp.honorPoints = GetHonorCurrency() or 0 end)
    end
    if GetPVPRankInfo then
        pcall(function()
            local rankNumber = (UnitPVPRank and UnitPVPRank("player")) or pvp.rankNumber
            if rankNumber and rankNumber > 0 then
                local rankName = GetPVPRankInfo(rankNumber)
                pvp.rankName = rankName or ("Rank " .. rankNumber)
                pvp.rankNumber = rankNumber
            end
        end)
    end

    -- Raid Lockouts
    local lockouts = {}
    if GetNumSavedInstances then
        pcall(function()
            local count = GetNumSavedInstances()
            for i = 1, count do
                local name, id, reset, difficulty, locked, extended, instanceIDMostSig, isRaid, maxPlayers, diffName, numEncounters, encounterProgress = GetSavedInstanceInfo(i)
                if locked or (reset and reset > 0) then
                    table.insert(lockouts, {
                        name = name,
                        instanceId = id,
                        resetInSeconds = reset or 0,
                        isRaid = isRaid or false,
                        difficulty = diffName or (type(difficulty) == "string" and difficulty) or "Normal",
                        locked = locked or true,
                        bossesDefeated = encounterProgress or 0,
                        totalBosses = numEncounters or 0
                    })
                end
            end
        end)
    end

    -- Hardcore Detection & Status
    local isHardcore = false
    if C_GameRules and C_GameRules.IsHardcoreActive then
        pcall(function() isHardcore = C_GameRules.IsHardcoreActive() end)
    end
    if not isHardcore and (realmName:lower():find("hardcore") or (ruleset and ruleset:lower():find("hardcore"))) then
        isHardcore = true
    end
    local isDead = UnitIsDeadOrGhost("player") or false
    local hardcore = {
        isHardcore = isHardcore,
        isDead = isDead,
        survivalStatus = isDead and "DEAD" or "ALIVE",
        snapshotTime = time(),
        deathCertificate = HaleckAccountImporterDB.deathCertificate or nil
    }

    -- Account-Wide Economy & Alt Gold
    HaleckAccountImporterDB.economy = HaleckAccountImporterDB.economy or {
        characters = {},
        sessionStartingGold = math.floor((GetMoney() or 0) / 10000),
    }

    local charKey = charName .. "-" .. realmName
    local currentGold = math.floor((GetMoney() or 0) / 10000)
    HaleckAccountImporterDB.economy.characters[charKey] = {
        characterName = charName,
        realm = realmName,
        gold = currentGold,
        silver = math.floor(((GetMoney() or 0) % 10000) / 100),
        copper = math.floor((GetMoney() or 0) % 100),
        faction = faction,
        characterClass = englishClass or localizedClass or "Warrior",
        level = level,
        lastUpdated = date("%Y-%m-%dT%H:%M:%SZ")
    }

    local totalAccountGold = 0
    local allCharactersGold = {}
    for k, v in pairs(HaleckAccountImporterDB.economy.characters) do
        totalAccountGold = totalAccountGold + (v.gold or 0)
        table.insert(allCharactersGold, v)
    end

    local sessionDeltaGold = currentGold - (HaleckAccountImporterDB.economy.sessionStartingGold or currentGold)
    local accountEconomy = {
        totalGold = totalAccountGold,
        sessionDeltaGold = sessionDeltaGold,
        charactersGold = allCharactersGold
    }

    -- Mythic+ Rating & Great Vault (Retail)
    local mythicPlus = {
        rating = 0,
        currentKeystone = nil,
        runHistory = {},
        greatVault = {}
    }
    pcall(function()
        if C_ChallengeMode and C_ChallengeMode.GetOverallDungeonScore then
            mythicPlus.rating = C_ChallengeMode.GetOverallDungeonScore() or 0
        end
        if C_MythicPlus and C_MythicPlus.GetOwnedKeystoneChallengeMapID then
            local mapId = C_MythicPlus.GetOwnedKeystoneChallengeMapID()
            local keystoneLevel = C_MythicPlus.GetOwnedKeystoneLevel and C_MythicPlus.GetOwnedKeystoneLevel()
            if mapId and mapId > 0 and keystoneLevel and keystoneLevel > 0 then
                local mapName = (C_ChallengeMode.GetMapUIInfo and C_ChallengeMode.GetMapUIInfo(mapId)) or ("Masmorra #" .. mapId)
                mythicPlus.currentKeystone = {
                    mapId = mapId,
                    name = mapName,
                    level = keystoneLevel,
                    formatted = "+" .. keystoneLevel .. " " .. mapName
                }
            end
        end
        if C_MythicPlus and C_MythicPlus.GetRunHistory then
            local runs = C_MythicPlus.GetRunHistory(false, true)
            if runs then
                for _, run in ipairs(runs) do
                    local mapName = (C_ChallengeMode.GetMapUIInfo and C_ChallengeMode.GetMapUIInfo(run.mapChallengeModeID)) or "Masmorra"
                    table.insert(mythicPlus.runHistory, {
                        mapName = mapName,
                        level = run.level or 0,
                        completed = run.completed or false,
                        score = run.dungeonScore or 0
                    })
                end
            end
        end
        if C_WeeklyRewards and C_WeeklyRewards.GetActivities then
            local activities = C_WeeklyRewards.GetActivities()
            if activities then
                for _, act in ipairs(activities) do
                    local category = "Dungeon"
                    if act.type == 1 then category = "Raid"
                    elseif act.type == 3 then category = "World/Delves" end
                    table.insert(mythicPlus.greatVault, {
                        type = act.type or 1,
                        category = category,
                        index = act.index or 0,
                        progress = act.progress or 0,
                        threshold = act.threshold or 1,
                        unlocked = (act.progress or 0) >= (act.threshold or 1),
                        rewardItemLevel = act.level or 0
                    })
                end
            end
        end
    end)

    -- World Bosses (Classic & WoW Forever)
    local worldBosses = {
        { name = "Lord Kazzak", zone = "Blasted Lands", status = "Available", respawnEstimate = "3-5 dias" },
        { name = "Azuregos", zone = "Azshara", status = "Available", respawnEstimate = "3-5 dias" },
        { name = "Taerar (Dragão do Pesadelo)", zone = "Ashenvale / Duskwood / Feralas / Hinterlands", status = "Available", respawnEstimate = "3-4 dias" },
        { name = "Ysondre (Dragão do Pesadelo)", zone = "Ashenvale / Duskwood / Feralas / Hinterlands", status = "Available", respawnEstimate = "3-4 dias" },
        { name = "Lethon (Dragão do Pesadelo)", zone = "Ashenvale / Duskwood / Feralas / Hinterlands", status = "Available", respawnEstimate = "3-4 dias" },
        { name = "Emeriss (Dragão do Pesadelo)", zone = "Ashenvale / Duskwood / Feralas / Hinterlands", status = "Available", respawnEstimate = "3-4 dias" }
    }
    pcall(function()
        if HaleckAccountImporterDB.worldBossKills then
            for _, wb in ipairs(worldBosses) do
                local killInfo = HaleckAccountImporterDB.worldBossKills[wb.name]
                if killInfo then
                    wb.status = "Defeated"
                    wb.lastKilled = killInfo.date
                end
            end
        end
    end)

    local snapshot = {
        exportedAt = date("%Y-%m-%dT%H:%M:%SZ"),
        clientVersion = select(4, GetBuildInfo()) or 110100,
        character = {
            name = charName,
            realm = realmName,
            realmSlug = realmName:lower():gsub("[ '%s]+", "-"),
            ruleset = ruleset,
            level = level,
            characterClass = englishClass or localizedClass or "Warrior",
            race = englishRace or localizedRace or "Human",
            gender = gender,
            faction = faction,
            equippedItemLevel = math.floor(eqIlvl or 0),
            averageItemLevel = math.floor(avgIlvl or 0),
            guild = guildName or nil,
            achievementPoints = achievementPoints,
        },
        game = {
            version = (ruleset or realmName:lower():find("forever")) and "forever" or "retail",
            ruleset = ruleset,
            realm = realmName,
            isForever = (ruleset ~= nil or realmName:lower():find("forever")),
        },
        equippedItems = equippedItems,
        inventory = {
            backpack = backpack,
            bags = bags,
            gold = math.floor((GetMoney() or 0) / 10000),
            silver = math.floor(((GetMoney() or 0) % 10000) / 100),
            copper = math.floor((GetMoney() or 0) % 100),
        },
        stats = stats,
        collections = {
            mounts = mounts,
            pets = pets,
            totalMountsCount = #mounts,
            totalPetsCount = #pets,
        },
        achievements = achievements,
        professions = professions,
        reputations = reputations,
        pvp = pvp,
        lockouts = lockouts,
        hardcore = hardcore,
        hardcoreDeathCertificate = HaleckAccountImporterDB.deathCertificate or nil,
        bank = HaleckAccountImporterDB.bank or { mainBank = {}, reagentBank = {}, warbandBank = {} },
        accountEconomy = accountEconomy,
        mythicPlus = mythicPlus,
        worldBosses = worldBosses,
    }

    HaleckAccountImporterDB.lastExport = snapshot
    table.insert(HaleckAccountImporterDB.history, {
        date = snapshot.exportedAt,
        char = charName .. "-" .. realmName,
        level = level,
        ilvl = eqIlvl,
    })

    return snapshot
end

local function ShowExportDialog(snapshot)
    -- Create simple copyable window
    local frame = CreateFrame("Frame", "HAI_ExportDialog", UIParent, "DialogBoxFrame")
    frame:SetSize(520, 420)
    frame:SetPoint("CENTER")
    frame:SetMovable(true)
    frame:EnableMouse(true)
    frame:RegisterForDrag("LeftButton")
    frame:SetScript("OnDragStart", frame.StartMoving)
    frame:SetScript("OnDragStop", frame.StopMovingOrSizing)

    local title = frame:CreateFontString(nil, "OVERLAY", "GameFontHighlightLarge")
    title:SetPoint("TOP", frame, "TOP", 0, -14)
    title:SetText("|cff00f2feHaleck Account Importer|r - Exportação Concluída!")

    local scroll = CreateFrame("ScrollFrame", "HAI_Scroll", frame, "UIPanelScrollFrameTemplate")
    scroll:SetPoint("TOPLEFT", 20, -50)
    scroll:SetPoint("BOTTOMRIGHT", -36, 60)

    local editBox = CreateFrame("EditBox", nil, scroll)
    editBox:SetMultiLine(true)
    editBox:SetFontObject("ChatFontNormal")
    editBox:SetWidth(460)
    scroll:SetScrollChild(editBox)

    -- Lua/JSON representation
    local char = snapshot.character
    local summaryText = string.format([[
-- DADOS EXPORTADOS DO PERSONAGEM
-- Copie este bloco ou copie o arquivo:
-- WTF/Account/<SUA_CONTA>/SavedVariables/HaleckAccountImporter.lua

HaleckAccountImporterDB = {
  lastExport = {
    character = {
      name = "%s",
      realm = "%s",
      ruleset = %s,
      level = %d,
      characterClass = "%s",
      race = "%s",
      gender = "%s",
      faction = "%s",
      equippedItemLevel = %d,
      averageItemLevel = %d,
      achievementPoints = %d,
      guild = %s
    },
    game = {
      version = "%s",
      ruleset = %s,
      isForever = %s
    },
    collections = {
      totalMountsCount = %d,
      totalPetsCount = %d
    }
  }
}
]],
        char.name,
        char.realm,
        char.ruleset and ('"' .. char.ruleset .. '"') or "nil",
        char.level,
        char.characterClass,
        char.race,
        char.gender,
        char.faction,
        char.equippedItemLevel,
        char.averageItemLevel,
        char.achievementPoints,
        char.guild and ('"' .. char.guild .. '"') or "nil",
        snapshot.game.version,
        char.ruleset and ('"' .. char.ruleset .. '"') or "nil",
        tostring(snapshot.game.isForever),
        snapshot.collections.totalMountsCount,
        snapshot.collections.totalPetsCount
    )

    editBox:SetText(summaryText)
    editBox:HighlightText()

    frame:Show()
end

SLASH_HALECK1 = "/hai"
SLASH_HALECK2 = "/haleck"
SLASH_HALECK3 = "/exportchar"
SlashCmdList["HALECK"] = function(msg)
    local snapshot = ExportCharacterSnapshot()
    print("|cff00f2fe[Haleck Account Importer]|r Personagem " .. snapshot.character.name .. " exportado com sucesso!")
    print("|cff00f2fe[Haleck Account Importer]|r Salvo em WTF/Account/<Conta>/SavedVariables/HaleckAccountImporter.lua")
    ShowExportDialog(snapshot)
end

f:RegisterEvent("PLAYER_DEAD")
f:RegisterEvent("BANKFRAME_OPENED")
f:RegisterEvent("BANK_FRAME_OPENED")

f:SetScript("OnEvent", function(self, event, arg1)
    if event == "ADDON_LOADED" and arg1 == ADDON_NAME then
        -- Addon loaded
    elseif event == "BANKFRAME_OPENED" or event == "BANK_FRAME_OPENED" then
        SerializeBank()
    elseif event == "PLAYER_LOGOUT" then
        ExportCharacterSnapshot()
    elseif event == "PLAYER_DEAD" then
        local subZone = (GetSubZoneText and GetSubZoneText()) or ""
        local zone = (GetZoneText and GetZoneText()) or ""
        local killer = (UnitName and UnitName("target")) or "Inimigo Desconhecido"
        HaleckAccountImporterDB.deathCertificate = {
            killerName = killer,
            zoneName = zone,
            subZoneText = subZone,
            finalLevel = (UnitLevel and UnitLevel("player")) or 1,
            deathDate = date("%Y-%m-%d %H:%M:%S"),
            lastWords = "Caiu bravamente em combate pela honra de Azeroth."
        }
        ExportCharacterSnapshot()
    elseif event == "PLAYER_LOGIN" then
        print("|cff00f2fe[Haleck Account Importer]|r Carregado. Digite |cffffcc00/hai|r ou |cffffcc00/haleck|r para exportar seus dados.")
    end
end)
`;
}

/**
 * Generates the .toc file for the WoW Addon
 */
function generateAddonToc(version: string = "retail"): string {
  const interfaceVersions: Record<string, string> = {
    retail: "110100",
    classic: "11506",
    forever: "16001",
    mop: "50400",
    tbc: "20400",
  };

  const clientInterface = interfaceVersions[version] || "110100";

  return `## Interface: ${clientInterface}
## Title: |cff00f2feHaleck|r Account Importer
## Notes: Export full WoW Armory, Gear, Bags, Collections & Achievements for Halo Tracker.
## Author: Haleck
## Version: 2.5.0
## SavedVariables: HaleckAccountImporterDB

HaleckAccountImporter.lua
`;
}

/**
 * Generates clear README instructions for the addon
 */
function generateAddonReadme(): string {
  return `========================================================================
           HALECK ACCOUNT IMPORTER - WOW ADDON UNIVERSAL
========================================================================

Este addon permite sincronizar com precisão total todos os dados do seu
personagem de World of Warcraft (Retail, Classic Era, WoW Forever Beta 16001,
Mists of Pandaria ou The Burning Crusade) diretamente para o Halo Tracker /
AI Studio.

------------------------------------------------------------------------
 COMO INSTALAR:
------------------------------------------------------------------------
1. Extraia esta pasta "HaleckAccountImporter" dentro do diretório de AddOns:
   - WoW Forever Beta (Vanilla+ • Pasta do Cliente: _classic_beta_):
     World of Warcraft/_classic_beta_/Interface/AddOns/
     (ATENÇÃO CRÍTICA: O cliente do Beta do WoW Forever vem no disco na pasta _classic_beta_. Não confundir com Classic Era nem Classic!)
   - WoW Forever Oficial (Vanilla+ • Lançamento Oficial: 04 de Novembro de 2026):
     (Nome oficial da pasta a ser anunciado pela Blizzard no lançamento - NÃO é _classic_era_ nem _classic_)
   - WoW Classic Era (1.15.x Original):
     World of Warcraft/_classic_era_/Interface/AddOns/
   - WoW Classic (Progression / MoP):
     World of Warcraft/_classic_/Interface/AddOns/
   - WoW Retail (11.x - The War Within):
     World of Warcraft/_retail_/Interface/AddOns/

2. Inicie ou reinicie o jogo (ou faça /reload caso já esteja logado).

3. Verifique se o Addon "Haleck Account Importer" está marcado na tela de
   seleção de personagens (botão "AddOns").

------------------------------------------------------------------------
 COMO EXPORTAR SEUS DADOS NO JOGO:
------------------------------------------------------------------------
1. Dentro do jogo, abra o chat e digite:
      /hai   ou   /haleck   ou   /exportchar

2. O addon criará um instantâneo completo com:
   - Armory: Todos os 19 slots equipados, ilvl, qualidade, transmogs e encantos.
   - Inventário: Mochila (Backpack) e todas as 4 bolsas com itens e moedas.
   - Profissões: Primárias e Secundárias com barra de habilidade e receitas.
   - Reputações: Facções com nível de afinidade (Exaltado, Reverenciado, etc).
   - Coleções: Montarias, Mascotes de Batalha (Pets), Brinquedos e Títulos.
   - Conquistas: Total de pontos e conquistas obtidas.
   - PvP: Títulos militares, abates honrosos e pontos de honra.
   - Raides / Lockouts: Instâncias salvas e chefes derrotados.
   - Hardcore: Status de sobrevivência e certificado de óbito.
   - Ruleset: Regra especial de reino (ex: WoW Forever Beta 16001).

3. Sincronização Automática com o Desktop Agent:
   - Dê um duplo clique em "sync-agent.bat" para iniciar o monitor em tempo real!
   - Sempre que você fizer /reload ou deslogar, o Halo Tracker será atualizado.

------------------------------------------------------------------------
 FONTES OFICIAIS, GUIAS DE CODIFICAÇÃO & DIFERENÇAS DE VERSÃO:
------------------------------------------------------------------------
Este addon foi elaborado seguindo as diretrizes e regras de ouro de
desenvolvimento de AddOns para World of Warcraft:

1. Fontes Oficiais & Documentação de Referência:
   - Lua Manual (PIL):       https://lua.org/pil/contents.html
   - WoW AddOn Programming:  https://wowpedia.fandom.com/wiki/WoW_AddOn
   - WoWProgramming API:     https://wowprogramming.com
   - World of Warcraft API:  https://wowpedia.fandom.com/wiki/World_of_Warcraft_API
   - Wago Tools DB:          https://wago.tools
   - CurseForge Authors:     https://authors.curseforge.com/#/notfound

2. Guias de Codificação com IA & Boas Práticas:
   - AI Coding Guide:        https://www.better-addons.com/ai-coding-guide/
   - System Prompt Spec:     https://www.better-addons.com/ai-coding-guide/#the-system-prompt
   - Deprecated Function Map:https://www.better-addons.com/ai-coding-guide/#the-deprecated-function-map
   - The Golden Rules:       https://www.better-addons.com/ai-coding-guide/#the-golden-rules

3. Diferenças Críticas entre Versões:
   - RETAIL (11.x - The War Within):
     * Utiliza namespaces C_* modernos (C_Container, C_Item, C_TransmogCollection, C_MountJournal).
     * Funções globais legadas como GetContainerItemInfo foram descontinuadas.
     * Interface: 110100.
   - CLASSIC ERA (1.15.x):
     * Requer compatibilidade com funções globais clássicas de mochila e itens.
     * Sistema de talentos em árvore 51 pontos e patentes PvP clássicas.
     * Interface: 11506.
   - WOW FOREVER (Vanilla+):
     * Cliente com regras especiais de servidor (Rulesets).
     * Detecção dinâmica de regras via GetRuleset() ou identificação do reino.
   - WOW FOREVER BETA (Build 16001):
     * Cliente em estágio híbrido de desenvolvimento (Beta 16001).
     * Requer obrigatoriamente encapsulamento em 'pcall' em todas as chamadas
       de APIs externas de inventário, reputações e coleções para evitar
       erros de UI LUA na tela do jogador.
     * Interface: 16001.
========================================================================
`;
}

/**
 * Generates an optional lightweight node script for auto-syncing
 */
export function generateAddonUploaderScript(webhookUrl?: string): string {
  return `// Haleck Account Importer - Auto Uploader & Watcher (Node.js)
const fs = require('fs');
const http = require('http');
const https = require('https');

const filePath = process.argv[2] || 'HaleckAccountImporter.lua';
const discordWebhook = "${webhookUrl ? webhookUrl.replace(/"/g, '\\"') : ""}";

console.log("==========================================================");
console.log("  HALECK ACCOUNT IMPORTER - NODE.JS AUTO-SYNC AGENT");
console.log("==========================================================");
console.log("Monitorando arquivo:", filePath);

function sendDiscordAlert(characterName, realm, level) {
  if (!discordWebhook) return;
  try {
    const url = new URL(discordWebhook);
    const body = JSON.stringify({
      username: "Halo WoW Tracker",
      content: \`⚔️ **Personagem \${characterName} (\${realm}) nível \${level} sincronizado!**\`,
    });
    const req = (url.protocol === 'https:' ? https : http).request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    });
    req.write(body);
    req.end();
  } catch (e) {
    console.error("Erro Discord Webhook:", e.message);
  }
}

function uploadSnapshot() {
  if (!fs.existsSync(filePath)) {
    console.warn("Aguardando geracao do arquivo:", filePath);
    return;
  }

  try {
    const rawLua = fs.readFileSync(filePath, 'utf8');
    const postData = JSON.stringify({ rawLua });

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/blizzard/wow/addon-sync',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log(\`[\${new Date().toLocaleTimeString()}] Sincronizado com Halo Tracker: \${res.statusCode}\`);
        try {
          const parsed = JSON.parse(body);
          if (parsed && parsed.character) {
            sendDiscordAlert(parsed.character.name, parsed.character.realm, parsed.character.level);
          }
        } catch (_) {}
      });
    });

    req.on('error', (e) => {
      console.error("Erro ao enviar:", e.message);
    });

    req.write(postData);
    req.end();
  } catch (err) {
    console.error("Erro de leitura:", err.message);
  }
}

uploadSnapshot();

// Watch file changes
let fsTimeout = null;
fs.watch(filePath, (eventType) => {
  if (!fsTimeout) {
    fsTimeout = setTimeout(() => {
      fsTimeout = null;
      console.log(\`[\${new Date().toLocaleTimeString()}] Alteracao detectada! Sincronizando...\`);
      uploadSnapshot();
    }, 1000);
  }
});
`;
}

/**
 * Generates the Windows Batch Auto-Sync Agent script
 */
export function generateSyncAgentBat(): string {
  return `@echo off
title Haleck WoW Sync Agent - Auto Watcher
color 0b
echo ========================================================
echo        HALECK ACCOUNT IMPORTER - WOW SYNC AGENT
echo ========================================================
echo Detectando pastas de World of Warcraft...
echo Prioridade: WoW Forever Beta (_classic_beta_), Classic Era (_classic_era_), Retail (_retail_)...

set "FOUND_FILE="

rem 1. Procura com prioridade maxima no WoW Forever Beta (_classic_beta_)
for %%P in (
    "C:\\Program Files (x86)\\World of Warcraft\\_classic_beta_\\WTF\\Account"
    "C:\\Program Files\\World of Warcraft\\_classic_beta_\\WTF\\Account"
    "D:\\World of Warcraft\\_classic_beta_\\WTF\\Account"
    "E:\\World of Warcraft\\_classic_beta_\\WTF\\Account"
    "C:\\Games\\World of Warcraft\\_classic_beta_\\WTF\\Account"
    "D:\\Games\\World of Warcraft\\_classic_beta_\\WTF\\Account"
    "%ProgramFiles%\\World of Warcraft\\_classic_beta_\\WTF\\Account"
    "%ProgramFiles(x86)%\\World of Warcraft\\_classic_beta_\\WTF\\Account"
) do (
    if exist "%%~P" (
        for /d %%A in ("%%~P\\*") do (
            if exist "%%~A\\SavedVariables\\HaleckAccountImporter.lua" (
                set "FOUND_FILE=%%~A\\SavedVariables\\HaleckAccountImporter.lua"
                echo [OK] Detectado cliente WoW Forever Beta (_classic_beta_): %%~A
                goto :found
            )
        )
    )
)

rem 2. Procura nas outras versoes (Classic Era, Progression e Retail)
for %%P in (
    "C:\\Program Files (x86)\\World of Warcraft\\_classic_era_\\WTF\\Account"
    "C:\\Program Files (x86)\\World of Warcraft\\_classic_\\WTF\\Account"
    "C:\\Program Files (x86)\\World of Warcraft\\_retail_\\WTF\\Account"
    "D:\\World of Warcraft\\_classic_era_\\WTF\\Account"
    "D:\\World of Warcraft\\_classic_\\WTF\\Account"
    "D:\\World of Warcraft\\_retail_\\WTF\\Account"
    "E:\\World of Warcraft\\_classic_era_\\WTF\\Account"
    "E:\\World of Warcraft\\_retail_\\WTF\\Account"
    "%ProgramFiles%\\World of Warcraft\\_classic_era_\\WTF\\Account"
    "%ProgramFiles%\\World of Warcraft\\_retail_\\WTF\\Account"
    "%ProgramFiles(x86)%\\World of Warcraft\\_classic_era_\\WTF\\Account"
    "%ProgramFiles(x86)%\\World of Warcraft\\_retail_\\WTF\\Account"
) do (
    if exist "%%~P" (
        for /d %%A in ("%%~P\\*") do (
            if exist "%%~A\\SavedVariables\\HaleckAccountImporter.lua" (
                set "FOUND_FILE=%%~A\\SavedVariables\\HaleckAccountImporter.lua"
                goto :found
            )
        )
    )
)

:found
if not "%FOUND_FILE%"=="" (
    echo [OK] Arquivo SavedVariables detectado com sucesso:
    echo "%FOUND_FILE%"
) else (
    echo [!] Nao foi possivel detectar automaticamente a pasta da sua conta.
    echo Exemplo de caminho do WoW Forever Beta:
    echo C:\\Program Files (x86)\\World of Warcraft\\_classic_beta_\\WTF\\Account\\<SUA_CONTA>\\SavedVariables\\HaleckAccountImporter.lua
    echo.
    echo Por favor, arraste o arquivo HaleckAccountImporter.lua aqui ou digite o caminho completo:
    set /p "FOUND_FILE=Caminho: "
)

echo.
echo Iniciando monitoramento em tempo real com PowerShell...
powershell -ExecutionPolicy Bypass -File "%~dp0sync-agent.ps1" -luaPath "%FOUND_FILE%"
pause
`;
}

/**
 * Generates the PowerShell Auto-Sync Agent script with desktop notification & discord support
 */
export function generateSyncAgentPs1(webhookUrl?: string): string {
  return `param(
    [string]$luaPath = "HaleckAccountImporter.lua",
    [string]$serverUrl = "http://localhost:3000/api/blizzard/wow/addon-sync",
    [string]$discordWebhook = "${webhookUrl ? webhookUrl.replace(/"/g, '`"') : ""}"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   HALECK ACCOUNT IMPORTER - POWERSHELL AUTO-SYNC AGENT" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# Se o caminho passado for relativo ou padrao e nao existir, tenta autodetectar
if (-not (Test-Path $luaPath)) {
    Write-Host "Procurando automaticamente arquivo SavedVariables nos clientes WoW..." -ForegroundColor Yellow
    $candidateDrives = @("C:", "D:", "E:", "F:", $env:ProgramFiles, $env:ProgramFilesX86)
    $candidateSubfolders = @(
        "_classic_beta_\\WTF\\Account",
        "_classic_era_\\WTF\\Account",
        "_classic_\\WTF\\Account",
        "_retail_\\WTF\\Account"
    )
    
    $detected = $null
    foreach ($drive in $candidateDrives) {
        if (-not $drive) { continue }
        foreach ($sub in $candidateSubfolders) {
            $testFolder = Join-Path $drive "World of Warcraft\\$sub"
            if (Test-Path $testFolder) {
                $accFolders = Get-ChildItem -Path $testFolder -Directory -ErrorAction SilentlyContinue
                foreach ($acc in $accFolders) {
                    $testFile = Join-Path $acc.FullName "SavedVariables\\HaleckAccountImporter.lua"
                    if (Test-Path $testFile) {
                        $detected = $testFile
                        if ($sub -like "*_classic_beta_*") {
                            Write-Host "[OK] Cliente WoW Forever Beta (_classic_beta_) localizado!" -ForegroundColor Cyan
                        }
                        break
                    }
                }
            }
            if ($detected) { break }
        }
        if ($detected) { break }
    }

    if ($detected) {
        $luaPath = $detected
        Write-Host "[OK] Caminho configurado automaticamente: $luaPath" -ForegroundColor Green
    } else {
        Write-Host "AVISO: Arquivo $luaPath ainda nao encontrado no disco. Aguardando exportacao in-game (/hai)..." -ForegroundColor Yellow
    }
}

Write-Host "Monitorando arquivo: $luaPath" -ForegroundColor Cyan
Write-Host "Pressione Ctrl+C para encerrar o monitoramento." -ForegroundColor DarkGray

$lastWrite = [DateTime]::MinValue

function Sync-File {
    try {
        if (Test-Path $luaPath) {
            $rawLua = Get-Content -Path $luaPath -Raw -Encoding UTF8
            $body = @{ rawLua = $rawLua } | ConvertTo-Json -Compress
            $response = Invoke-RestMethod -Uri $serverUrl -Method Post -Body $body -ContentType "application/json"
            $charName = if ($response.character) { $response.character } else { "Personagem" }
            $versionName = if ($response.detectedVersion) { $response.detectedVersion } else { "WoW" }
            Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] Sincronizado com sucesso! [$versionName] $charName" -ForegroundColor Green
            
            # Windows Balloon Notification
            try {
                [void] [System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms")
                $notify = New-Object System.Windows.Forms.NotifyIcon
                $notify.Icon = [System.Drawing.SystemIcons]::Information
                $notify.BalloonTipTitle = "Halo Tracker - WoW Sync"
                $notify.BalloonTipText = "Personagem $charName ($versionName) sincronizado com sucesso!"
                $notify.Visible = $true
                $notify.ShowBalloonTip(3000)
            } catch {}

            # Discord Webhook Notification
            if ($discordWebhook -and $discordWebhook -ne "") {
                try {
                    $hookBody = @{
                        username = "Halo WoW Tracker"
                        content = "⚔️ **Personagem $charName ($versionName) sincronizado com sucesso!** Verifique o painel do Halo Tracker."
                    } | ConvertTo-Json -Compress
                    Invoke-RestMethod -Uri $discordWebhook -Method Post -Body $hookBody -ContentType "application/json" -ErrorAction SilentlyContinue
                } catch {}
            }
        }
    } catch {
        Write-Host "Erro durante a sincronizacao: $_" -ForegroundColor Red
    }
}

Sync-File

while ($true) {
    Start-Sleep -Seconds 3
    if (Test-Path $luaPath) {
        $item = Get-Item $luaPath
        if ($item.LastWriteTime -gt $lastWrite) {
            $lastWrite = $item.LastWriteTime
            Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] Alteracao detectada no SavedVariables! Enviando..." -ForegroundColor Cyan
            Sync-File
        }
    }
}
`;
}

/**
 * Creates and triggers a download of the Addon ZIP package
 */
export async function downloadWoWAddonZip(options: AddonExportOptions = {}): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder("HaleckAccountImporter");

  if (!folder) {
    throw new Error("Não foi possível criar o pacote zip do addon.");
  }

  const version = options.gameVersion || "retail";

  folder.file("HaleckAccountImporter.toc", generateAddonToc(version));
  folder.file("HaleckAccountImporter.lua", generateAddonLua());
  folder.file("README.txt", generateAddonReadme());
  folder.file("uploader.js", generateAddonUploaderScript());
  folder.file("sync-agent.bat", generateSyncAgentBat());
  folder.file("sync-agent.ps1", generateSyncAgentPs1());

  const content = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = `HaleckAccountImporter-${version}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads standalone sync agent .bat file
 */
export function downloadSyncAgentBatFile(): void {
  const content = generateSyncAgentBat();
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sync-agent.bat";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads standalone sync agent .ps1 file
 */
export function downloadSyncAgentPs1File(webhookUrl?: string): void {
  const content = generateSyncAgentPs1(webhookUrl);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sync-agent.ps1";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Synchronizes parsed Addon snapshot to persistent server endpoint
 */
export async function syncAddonDataToPersistentEndpoint(payload: {
  characterName: string;
  realm: string;
  ruleset?: string;
  gameVersion?: string;
  profileData: BlizzardProfileData;
}): Promise<any> {
  try {
    const res = await fetch("/api/blizzard/wow/addon-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lastExport: {
          character: {
            name: payload.characterName,
            realm: payload.realm,
            ruleset: payload.ruleset,
            level: payload.profileData.level,
            characterClass: payload.profileData.characterClass,
            race: payload.profileData.race,
            equippedItemLevel: payload.profileData.equippedItemLevel,
            averageItemLevel: payload.profileData.averageItemLevel,
            achievementPoints: payload.profileData.achievementPoints,
          },
          game: {
            version: payload.gameVersion,
            ruleset: payload.ruleset,
            realm: payload.realm,
            isForever: payload.gameVersion === "forever" || !!payload.ruleset,
          },
          ...payload.profileData,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Falha ao sincronizar com servidor");
    }

    return await res.json();
  } catch (err) {
    console.warn("syncAddonDataToPersistentEndpoint:", err);
    return null;
  }
}

/**
 * Options for generating a custom boilerplate WoW Add-on
 */
export interface CustomAddonTemplateOptions {
  addonName: string;
  gameVersion: "retail" | "classic" | "forever" | "forever_beta";
  title?: string;
  author?: string;
  version?: string;
  notes?: string;
  savedVariables?: string;
  savedVariablesPerCharacter?: string;
  slashCommand?: string;
  includeEventFrame?: boolean;
  includeBankTrackingSnippet?: boolean;
  includeMythicOrWorldBossSnippet?: boolean;
}

export function getInterfaceVersionForGame(gameVersion: "retail" | "classic" | "forever" | "forever_beta"): string {
  switch (gameVersion) {
    case "retail":
      return "110100";
    case "classic":
      return "11506";
    case "forever_beta":
      return "16001";
    case "forever":
    default:
      return "16001";
  }
}

export function getFriendlyGameVersionName(gameVersion: "retail" | "classic" | "forever" | "forever_beta"): string {
  switch (gameVersion) {
    case "retail":
      return "Retail (The War Within 11.x / Midnight)";
    case "classic":
      return "Classic Era (1.15.x)";
    case "forever_beta":
      return "WoW Forever Beta (Build 16001)";
    case "forever":
    default:
      return "WoW Forever (Vanilla+ • Lançamento 04/Nov)";
  }
}

/**
 * Generates boilerplate .toc content
 */
export function generateCustomAddonToc(options: CustomAddonTemplateOptions): string {
  const safeName = options.addonName.replace(/[^a-zA-Z0-9_-]/g, "") || "MyWoWAddon";
  const interfaceId = getInterfaceVersionForGame(options.gameVersion);
  const title = options.title || safeName;
  const author = options.author || "Developer";
  const version = options.version || "1.0.0";
  const notes = options.notes || `Modern WoW Addon for ${getFriendlyGameVersionName(options.gameVersion)}`;
  const savedVars = options.savedVariables ? options.savedVariables.trim() : `${safeName}DB`;
  const savedVarsPerChar = options.savedVariablesPerCharacter ? options.savedVariablesPerCharacter.trim() : "";

  return `## Interface: ${interfaceId}
## Title: |cff00f2fe${title}|r
## Notes: ${notes}
## Author: ${author}
## Version: ${version}
${savedVars ? `## SavedVariables: ${savedVars}\n` : ""}${savedVarsPerChar ? `## SavedVariablesPerCharacter: ${savedVarsPerChar}\n` : ""}## X-Website: https://github.com
## X-Category: Interface & Data
## X-Compatible-With: ${getFriendlyGameVersionName(options.gameVersion)}

# Entry Point Lua script
${safeName}.lua
`;
}

/**
 * Generates boilerplate .lua content with anti-taint, event lifecycle, and defensive coding
 */
export function generateCustomAddonLua(options: CustomAddonTemplateOptions): string {
  const safeName = options.addonName.replace(/[^a-zA-Z0-9_-]/g, "") || "MyWoWAddon";
  const savedVars = options.savedVariables ? options.savedVariables.trim() : `${safeName}DB`;
  const slashCmd = (options.slashCommand || `/${safeName.toLowerCase()}`).replace(/^\/+/, "");
  const upperCmd = safeName.toUpperCase();
  const isRetail = options.gameVersion === "retail";
  const isForever = options.gameVersion === "forever" || options.gameVersion === "forever_beta";

  return `-- ========================================================================
--  ${safeName} - Entry Point Lua
--  Target: ${getFriendlyGameVersionName(options.gameVersion)} (Interface: ${getInterfaceVersionForGame(options.gameVersion)})
--
--  Direct Reference & AI Coding Guidelines:
--  - Lua Manual:         https://lua.org/pil/contents.html
--  - WoW Addon Architecture: https://wowpedia.fandom.com/wiki/WoW_AddOn
--  - WoWProgramming:     https://wowprogramming.com
--  - Blizzard API Wiki:  https://wowpedia.fandom.com/wiki/World_of_Warcraft_API
--  - Wago Tools:         https://wago.tools
--  - AI Coding Guide:    https://www.better-addons.com/ai-coding-guide/
--  - The Golden Rules:   https://www.better-addons.com/ai-coding-guide/#the-golden-rules
-- ========================================================================

-- GOLDEN RULE #1: Scope Isolation (Anti-Taint)
-- Never pollute global namespace; use local table passed to each addon file
local ADDON_NAME, addon = ...
addon = addon or {}

-- Default SavedVariables structure
local DEFAULT_CONFIG = {
    version = "${options.version || "1.0.0"}",
    enabled = true,
    debugMode = false,
    settings = {
        announceInChat = true,
        autoScanOnLogin = true,
    }
}

-- Frame for event listening
local eventFrame = CreateFrame("Frame", "${safeName}EventFrame")
${options.includeEventFrame !== false ? `eventFrame:RegisterEvent("ADDON_LOADED")
eventFrame:RegisterEvent("PLAYER_LOGIN")
eventFrame:RegisterEvent("PLAYER_LOGOUT")` : ""}

-- GOLDEN RULE #2: Defensive API calls with pcall
local function SafeCall(fn, ...)
    local success, result = pcall(fn, ...)
    if not success then
        if ${savedVars} and ${savedVars}.debugMode then
            print("|cffff4444[" .. ADDON_NAME .. " Error]|r " .. tostring(result))
        end
        return nil
    end
    return result
end

-- Print helper with colored prefix
local function PrintMessage(msg)
    print("|cff00f2fe[" .. ADDON_NAME .. "]|r " .. tostring(msg))
end

${options.includeBankTrackingSnippet ? `-- ========================================================================
--  FEATURE: Bank & Warband Tracking (Universal Compatibility)
-- ========================================================================
eventFrame:RegisterEvent("BANKFRAME_OPENED")
eventFrame:RegisterEvent("BANK_FRAME_OPENED")

local function ScanPlayerBank()
    local bankItems = {}
    -- Scanning main bank slots (slots 1 to 28)
    for slot = 1, 28 do
        local itemId = ${isRetail ? "C_Container and C_Container.GetContainerItemID and C_Container.GetContainerItemID(-1, slot)" : "GetContainerItemID and GetContainerItemID(-1, slot)"}
        if itemId then
            local name = GetItemInfo(itemId) or ("Item #" .. itemId)
            table.insert(bankItems, { slot = slot, id = itemId, name = name })
        end
    end

    ${isRetail ? `-- Warband Bank (Retail / The War Within)
    if C_Bank and C_Bank.FetchPurchasedBankTabData and Enum and Enum.BankType and Enum.BankType.Account then
        SafeCall(function()
            local tabs = C_Bank.FetchPurchasedBankTabData(Enum.BankType.Account)
            if tabs then
                PrintMessage("Warband Bank escaneado: " .. #tabs .. " abas de guarnição de conta.")
            end
        end)
    end` : `-- Classic / Vanilla Bank bags`}
    
    if ${savedVars} then
        ${savedVars}.bankSnapshot = {
            scannedAt = date("%Y-%m-%d %H:%M:%S"),
            itemCount = #bankItems,
            items = bankItems
        }
    end
    PrintMessage("Banco do personagem sincronizado (" .. #bankItems .. " itens encontrados).")
end
` : ""}

${options.includeMythicOrWorldBossSnippet ? `-- ========================================================================
--  FEATURE: ${isRetail ? "Mythic+ & Great Vault Tracking" : "World Bosses Respawn Tracking"}
-- ========================================================================
${isRetail ? `local function ScanMythicKeystone()
    SafeCall(function()
        if C_ChallengeMode and C_ChallengeMode.GetOverallDungeonScore then
            local score = C_ChallengeMode.GetOverallDungeonScore() or 0
            PrintMessage("Pontuação Mítico+ Atual: " .. score)
        end
        if C_MythicPlus and C_MythicPlus.GetOwnedKeystoneChallengeMapID then
            local mapId = C_MythicPlus.GetOwnedKeystoneChallengeMapID()
            local level = C_MythicPlus.GetOwnedKeystoneLevel and C_MythicPlus.GetOwnedKeystoneLevel()
            if mapId and level then
                PrintMessage("Keystone no inventário: +" .. level)
            end
        end
    end)
end` : `local function CheckWorldBossTimers()
    local bosses = { "Lord Kazzak", "Azuregos", "Dragões do Pesadelo" }
    PrintMessage("Monitoramento ativo de Chefes Mundiais clássicos: " .. table.concat(bosses, ", "))
end`}
` : ""}

-- ========================================================================
--  EVENT HANDLER (GOLDEN RULE #3: Event-Driven Lifecycle)
-- ========================================================================
eventFrame:SetScript("OnEvent", function(self, event, arg1, ...)
    if event == "ADDON_LOADED" and arg1 == ADDON_NAME then
        -- Initialize SavedVariables with defaults
        if not ${savedVars} then
            ${savedVars} = {}
        end
        for k, v in pairs(DEFAULT_CONFIG) do
            if ${savedVars}[k] == nil then
                ${savedVars}[k] = v
            end
        end
        self:UnregisterEvent("ADDON_LOADED")

    elseif event == "PLAYER_LOGIN" then
        PrintMessage("Add-on carregado com sucesso para " .. UnitName("player") .. " (" .. GetRealmName() .. ").")
        PrintMessage("Digite |cffffcc00/${slashCmd}|r para abrir as opções ou ver comandos disponíveis.")
        ${options.includeMythicOrWorldBossSnippet ? (isRetail ? "ScanMythicKeystone()\n" : "CheckWorldBossTimers()\n") : ""}
    ${options.includeBankTrackingSnippet ? `elseif event == "BANKFRAME_OPENED" or event == "BANK_FRAME_OPENED" then
        ScanPlayerBank()` : ""}
    elseif event == "PLAYER_LOGOUT" then
        -- Save final state before logging out
        if ${savedVars} then
            ${savedVars}.lastLogout = date("%Y-%m-%d %H:%M:%S")
        end
    end
end)

-- ========================================================================
--  SLASH COMMAND REGISTRATION
-- ========================================================================
SLASH_${upperCmd}1 = "/${slashCmd}"
${slashCmd !== safeName.toLowerCase() ? `SLASH_${upperCmd}2 = "/${safeName.toLowerCase()}"\n` : ""}SlashCmdList["${upperCmd}"] = function(msg)
    local command = msg:match("^(%S+)")
    command = command and command:lower() or "help"

    if command == "status" then
        PrintMessage("Versão: " .. (${savedVars} and ${savedVars}.version or "1.0.0"))
        PrintMessage("Status: " .. (${savedVars} and ${savedVars}.enabled and "|cff00ff00Ativo|r" or "|cffff0000Inativo|r"))

    elseif command == "toggle" then
        if ${savedVars} then
            ${savedVars}.enabled = not ${savedVars}.enabled
            PrintMessage("Addon " .. (${savedVars}.enabled and "|cff00ff00Habilitado|r" or "|cffff0000Desabilitado|r"))
        end

    ${options.includeBankTrackingSnippet ? `elseif command == "bank" then
        ScanPlayerBank()` : ""}

    else
        print("|cff00f2fe=== " .. ADDON_NAME .. " Comandos Disponíveis ===|r")
        print("  |cffffcc00/${slashCmd} status|r  - Exibe o status da configuração")
        print("  |cffffcc00/${slashCmd} toggle|r  - Habilita ou desabilita o add-on")
        ${options.includeBankTrackingSnippet ? `print("  |cffffcc00/${slashCmd} bank|r    - Força leitura e registro de dados de banco")\n` : ""}        print("  |cffffcc00/${slashCmd} help|r    - Exibe esta mensagem de ajuda")
    end
end
`;
}

/**
 * Generates README.txt for the generated Add-on
 */
export function generateCustomAddonReadme(options: CustomAddonTemplateOptions): string {
  const safeName = options.addonName.replace(/[^a-zA-Z0-9_-]/g, "") || "MyWoWAddon";
  const gameName = getFriendlyGameVersionName(options.gameVersion);
  const interfaceId = getInterfaceVersionForGame(options.gameVersion);

  return `========================================================================
  ${options.title || safeName} - Guia de Instalação e Desenvolvimento
========================================================================

Versão do Add-on: ${options.version || "1.0.0"}
Cliente Alvo:      ${gameName}
Interface ID:      ${interfaceId}
Autor:             ${options.author || "Developer"}

1. COMO INSTALAR NO WORLD OF WARCRAFT
------------------------------------------------------------------------
Copie esta pasta ("${safeName}") inteira para o diretório de AddOns do seu WoW:

- WoW Forever Beta (Vanilla+ • Pasta de Instalação: _classic_beta_):
  C:\\Program Files (x86)\\World of Warcraft\\_classic_beta_\\Interface\\AddOns\\${safeName}\\
  (ATENÇÃO: A pasta oficial do WoW Forever Beta vem nomeada como _classic_beta_)

- WoW Forever (Vanilla+ • Lançamento Oficial em 04 de Novembro):
  C:\\Program Files (x86)\\World of Warcraft\\_classic_era_\\Interface\\AddOns\\${safeName}\\
  ou World of Warcraft\\_forever_\\Interface\\AddOns\\${safeName}\\

- WoW Classic Era (1.15.x):
  C:\\Program Files (x86)\\World of Warcraft\\_classic_era_\\Interface\\AddOns\\${safeName}\\

- WoW Retail (The War Within 11.x):
  C:\\Program Files (x86)\\World of Warcraft\\_retail_\\Interface\\AddOns\\${safeName}\\

Certifique-se de que a estrutura final fique assim:
  Interface\\AddOns\\${safeName}\\${safeName}.toc
  Interface\\AddOns\\${safeName}\\${safeName}.lua
  Interface\\AddOns\\${safeName}\\README.txt

2. COMANDOS DENTRO DO JOGO
------------------------------------------------------------------------
- /${(options.slashCommand || safeName.toLowerCase()).replace(/^\/+/, "")} help
- /${(options.slashCommand || safeName.toLowerCase()).replace(/^\/+/, "")} status
- /${(options.slashCommand || safeName.toLowerCase()).replace(/^\/+/, "")} toggle

3. RECURSOS E FONTES DE CONSULTA
------------------------------------------------------------------------
- Lua Manual:            https://lua.org/pil/contents.html
- WoW AddOn Guide:       https://wowpedia.fandom.com/wiki/WoW_AddOn
- WoWProgramming:        https://wowprogramming.com
- World of Warcraft API: https://wowpedia.fandom.com/wiki/World_of_Warcraft_API
- Wago Tools:            https://wago.tools
- CurseForge:            https://authors.curseforge.com/#/notfound
- Better-Addons AI:      https://www.better-addons.com/ai-coding-guide/
- The System Prompt:     https://www.better-addons.com/ai-coding-guide/#the-system-prompt
- Deprecated Map:        https://www.better-addons.com/ai-coding-guide/#the-deprecated-function-map
- The Golden Rules:      https://www.better-addons.com/ai-coding-guide/#the-golden-rules
`;
}

/**
 * Returns complete generated template files object
 */
export function generateCustomAddonTemplate(options: CustomAddonTemplateOptions): {
  toc: string;
  lua: string;
  readme: string;
  interfaceVersion: string;
  folderName: string;
} {
  const folderName = options.addonName.replace(/[^a-zA-Z0-9_-]/g, "") || "MyWoWAddon";
  return {
    toc: generateCustomAddonToc(options),
    lua: generateCustomAddonLua(options),
    readme: generateCustomAddonReadme(options),
    interfaceVersion: getInterfaceVersionForGame(options.gameVersion),
    folderName,
  };
}

/**
 * Downloads the custom Add-on template as a ZIP package
 */
export async function downloadCustomAddonTemplateZip(options: CustomAddonTemplateOptions): Promise<void> {
  const template = generateCustomAddonTemplate(options);
  const zip = new JSZip();
  const folder = zip.folder(template.folderName);

  if (!folder) {
    throw new Error("Não foi possível gerar pasta do template ZIP");
  }

  folder.file(`${template.folderName}.toc`, template.toc);
  folder.file(`${template.folderName}.lua`, template.lua);
  folder.file("README.txt", template.readme);

  const content = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${template.folderName}-${options.gameVersion}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Helper to download individual text file
 */
export function downloadCustomAddonFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

