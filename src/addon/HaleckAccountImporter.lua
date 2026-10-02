-- ========================================================================
--  HALECK ACCOUNT IMPORTER - WOW ADDON UNIVERSAL (ATT-GRADE ENGINE)
--  Compatibilidade Canônica: WoW Forever Beta/Release (16001), Classic Era (11506) & Retail (110100/110200)
--
--  Motor de Extração Ultra-Robusto (AllTheThings Grade):
--  - Equipamentos, Transmogs, Ilusões & Mapeamento de Display IDs
--  - Quests Concluídas, Ativas, Falhadas & Histórico de Entregas
--  - Grimório Completo de Magias Aprendidas & Pontos de Voo (Taxi Nodes)
--  - Árvores de Talentos Clássicas (51 pts) & Loadouts Modernos
--  - Contador de Passos em Tempo Real & Quilometragem Percorrida
--  - Zonas & Regiões Descobertas com Timestamps
--  - Caçadas: 1ª Vez que Derrotou Cada Chefe & Raro
--  - Companheiros de Jornada: Histórico de Grupos e Raides
--  - Livro dos Caídos: Registro Detalhado de Cada Morte (Hardcore Safe)
--  - Estatísticas Nativas Consolidadas do WoW
--  - Proteção Especial WoW Forever: Secret Health Values & Dead Secure SNI via pcall
-- ========================================================================

local ADDON_NAME, addon = ...
ADDON_NAME = ADDON_NAME or "HaleckAccountImporter"
addon = addon or {}
local ADDON_VERSION = "4.3.0"
addon.Version = ADDON_VERSION

-- Opções Padrão de Extração
local DEFAULT_OPTIONS = {
    charInfo = true,
    appearance = true,
    equippedGear = true,
    allItemIds = true,
    transmogs = true,
    questsCompleted = true,
    questsActive = true,
    spells = true,
    flightPaths = true,
    talents = true,
    inventory = true,
    bank = true,
    economy = true,
    mounts = true,
    pets = true,
    toys = true,
    titles = true,
    achievements = true,
    professions = true,
    reputations = true,
    pvp = true,
    lockouts = true,
    worldBosses = true,
    bossesAndRares = true,
    companions = true,
    stepCounter = true,
    exploration = true,
    nativeStats = true,
    deathLog = true,
    playtime = true,
    otherAddons = true,
}

-- ========================================================================
-- BANCO DE DADOS PERSISTENTE (SAVEDVARIABLES) - RESOLVER DINÂMICO SEGURO
-- O WoW Forever (16001) pode restaurar SavedVariables após a carga inicial de Lua.
-- O EnsureDB() garante que nunca mantemos uma referência de tabela obsoleta (stale).
-- ========================================================================
local DB
local function EnsureDB()
    if type(_G.HaleckAccountImporterDB) ~= "table" then
        _G.HaleckAccountImporterDB = {}
    end
    DB = _G.HaleckAccountImporterDB
    DB.version = ADDON_VERSION
    if type(DB.options) ~= "table" then DB.options = {} end
    for k, v in pairs(DEFAULT_OPTIONS) do
        if DB.options[k] == nil then
            DB.options[k] = v
        end
    end

    if type(DB.characters) ~= "table" then DB.characters = {} end
    if type(DB.profiles) ~= "table" then DB.profiles = {} end
    if type(DB.wealthHistory) ~= "table" then DB.wealthHistory = {} end
    if type(DB.tradeHistory) ~= "table" then DB.tradeHistory = {} end
    if type(DB.settings) ~= "table" then DB.settings = {} end
    if type(DB.versionCheck) ~= "table" then DB.versionCheck = {} end

    -- Estrutura do Diário de Aventura
    if type(DB.journal) ~= "table" then DB.journal = {} end
    if type(DB.journal.timeline) ~= "table" then DB.journal.timeline = {} end
    if type(DB.journal.bosses) ~= "table" then DB.journal.bosses = {} end
    if type(DB.journal.companions) ~= "table" then DB.journal.companions = {} end
    if type(DB.journal.exploration) ~= "table" then DB.journal.exploration = {} end
    if type(DB.journal.deaths) ~= "table" then DB.journal.deaths = {} end
    if type(DB.journal.statistics) ~= "table" then
        DB.journal.statistics = {
            steps = 0,
            distanceYards = 0,
            totalQuestsCompleted = 0,
            totalBossesDefeated = 0,
            totalCompanionsMet = 0,
            totalDeaths = 0,
        }
    end

    if type(DB.history) ~= "table" then DB.history = {} end
    if type(DB.worldBosses) ~= "table" then DB.worldBosses = {} end
    if type(DB.pendingChanges) ~= "table" then DB.pendingChanges = {} end
    if type(DB.sessionStats) ~= "table" then
        DB.sessionStats = {
            eventsRecorded = 0,
            startTime = date("%Y-%m-%d %H:%M:%S"),
        }
    end

    return DB
end
EnsureDB()

-- Frame Principal de Eventos do Addon com Registro Seguro (Anti-Crash Cross-Version)
local fCore = CreateFrame("Frame", "HaleckImporterCoreFrame")

local function SafeRegisterEvent(frame, eventName)
    if not frame or not eventName then return end
    -- Whitelist/Blacklist de segurança: impede eventos obsoletos ou desconhecidos no WoW Forever (16001 / Classic Vanilla+)
    if eventName == "LEARNED_SPELL_IN_TAB" then return end
    pcall(function() frame:RegisterEvent(eventName) end)
end

-- Eventos Essenciais do Ciclo de Vida
SafeRegisterEvent(fCore, "ADDON_LOADED")
SafeRegisterEvent(fCore, "PLAYER_LOGIN")
SafeRegisterEvent(fCore, "PLAYER_LOGOUT")
SafeRegisterEvent(fCore, "PLAYER_DEAD")
SafeRegisterEvent(fCore, "PLAYER_LEVEL_UP")

-- Missões & Quests (Suporte Universal)
SafeRegisterEvent(fCore, "QUEST_ACCEPTED")
SafeRegisterEvent(fCore, "QUEST_TURNED_IN")
SafeRegisterEvent(fCore, "QUEST_LOG_UPDATE")

-- Magias & Grimório (Protegido para WoW Forever 1.60 / Vanilla / Retail)
SafeRegisterEvent(fCore, "SPELLS_CHANGED")

-- Combate & Instâncias
SafeRegisterEvent(fCore, "BOSS_KILL")
SafeRegisterEvent(fCore, "ENCOUNTER_END")
SafeRegisterEvent(fCore, "COMBAT_LOG_EVENT_UNFILTERED")
SafeRegisterEvent(fCore, "GROUP_ROSTER_UPDATE")

-- Zonas & Exploração
SafeRegisterEvent(fCore, "ZONE_CHANGED_NEW_AREA")
SafeRegisterEvent(fCore, "ZONE_CHANGED")
SafeRegisterEvent(fCore, "MINIMAP_ZONE_CHANGED")

-- Banco & Inventário (Suporte Classic e Retail)
SafeRegisterEvent(fCore, "BANKFRAME_OPENED")
SafeRegisterEvent(fCore, "BANK_FRAME_OPENED")
SafeRegisterEvent(fCore, "BAG_UPDATE")
SafeRegisterEvent(fCore, "BAG_UPDATE_DELAYED")

-- Comércio & Economia entre Jogadores (WoW Forever Trade Network)
SafeRegisterEvent(fCore, "TRADE_SHOW")
SafeRegisterEvent(fCore, "TRADE_UPDATE")
SafeRegisterEvent(fCore, "TRADE_TARGET_ITEM_CHANGED")
SafeRegisterEvent(fCore, "TRADE_PLAYER_ITEM_CHANGED")
SafeRegisterEvent(fCore, "TRADE_MONEY_CHANGED")
SafeRegisterEvent(fCore, "TRADE_ACCEPT_UPDATE")
SafeRegisterEvent(fCore, "TRADE_CLOSED")
SafeRegisterEvent(fCore, "PLAYER_MONEY")

-- Sincronização & Notificação de Versão Peer-to-Peer
SafeRegisterEvent(fCore, "CHAT_MSG_ADDON")
SafeRegisterEvent(fCore, "CHAT_MSG_ADDON_LOGGED")

-- Tempo de Jogo & Rastreamento
SafeRegisterEvent(fCore, "TIME_PLAYED_MSG")
SafeRegisterEvent(fCore, "PLAYER_REGEN_DISABLED")
SafeRegisterEvent(fCore, "PLAYER_REGEN_ENABLED")
SafeRegisterEvent(fCore, "CHAT_MSG_MONSTER_YELL")
SafeRegisterEvent(fCore, "CHAT_MSG_MONSTER_EMOTE")
SafeRegisterEvent(fCore, "PLAYER_TARGET_CHANGED")
SafeRegisterEvent(fCore, "UPDATE_MOUSEOVER_UNIT")

-- ========================================================================
-- UTILITÁRIOS & HELPERS SEGUROS (CROSS-VERSION WRAPPERS)
-- ========================================================================
local function SafeCall(fn, ...)
    local ok, res = pcall(fn, ...)
    if ok then return res end
    return nil
end

local function GetSafeText(str)
    if not str then return "" end
    return tostring(str):gsub('"', '\\"'):gsub("\\\\", "\\\\\\\\")
end

local function GetCurrentTimestamp()
    return date("%Y-%m-%d %H:%M:%S")
end

local function GetCurrentISODate()
    return date("%Y-%m-%dT%H:%M:%SZ")
end

-- ========================================================================
-- MELHORIA 3: BUFFERIZAÇÃO & BLOQUEIO EM COMBATE (INCOMBATLOCKDOWN RESILIENTE)
-- ========================================================================
local isInCombat = false
local queuedCombatActions = {}
local queuedUIRequest = nil

local function RunSafeCombat(action)
    if (InCombatLockdown and InCombatLockdown()) or isInCombat then
        table.insert(queuedCombatActions, action)
    else
        pcall(action)
    end
end

-- ========================================================================
-- MELHORIA 1: RASTREADOR DE SINCRONIZAÇÃO DELTA / INCREMENTAL
-- ========================================================================
local function RecordDelta(category, action, payload)
    if not HaleckAccountImporterDB.pendingChanges then HaleckAccountImporterDB.pendingChanges = {} end
    local entry = {
        timestamp = GetCurrentTimestamp(),
        epoch = time(),
        category = category,
        action = action,
        zone = (GetZoneText and GetZoneText()) or "",
        level = (UnitLevel and UnitLevel("player")) or 1,
        data = payload,
    }
    table.insert(HaleckAccountImporterDB.pendingChanges, entry)
    if #HaleckAccountImporterDB.pendingChanges > 1000 then
        table.remove(HaleckAccountImporterDB.pendingChanges, 1)
    end
    if HaleckAccountImporterDB.sessionStats then
        HaleckAccountImporterDB.sessionStats.eventsRecorded = (HaleckAccountImporterDB.sessionStats.eventsRecorded or 0) + 1
    end
    return entry
end

-- ========================================================================
-- CONTROLE DE VERSÃO, BUILD & ATUALIZAÇÕES CONTÍNUAS (WOW FOREVER ENGINE)
-- ========================================================================
local CURRENT_ADDON_VERSION = "4.3.0"
local CURRENT_SCHEMA_VERSION = 430

-- ========================================================================
-- CORREÇÕES DE ERROS NATIVOS DA INTERFACE BLIZZARD NO WOW FOREVER (16001)
-- Identificado na análise de ForeverStatistics:
-- 1. AchievementShield_SetPoints pode receber nil points durante comparação
-- 2. AchievementFrameComparison_UpdateStatusBars recebe a string "summary"
-- 3. AchievementFrameSummary_UpdateAchievements pode ter points e flags nulos
-- ========================================================================
local achievementShieldPatched = false
local function PatchAchievementShield()
    if achievementShieldPatched then return true end
    if type(AchievementShield_SetPoints) ~= "function" then return false end
    local original = AchievementShield_SetPoints
    AchievementShield_SetPoints = function(points, pointString, normalFont, smallFont)
        if points == nil then
            if pointString and pointString.SetText then pointString:SetText("") end
            return
        end
        return original(points, pointString, normalFont, smallFont)
    end
    achievementShieldPatched = true
    return true
end

local achievementComparisonStatusBarsPatched = false
local function PatchAchievementComparisonStatusBars()
    if achievementComparisonStatusBarsPatched then return true end
    if type(AchievementFrameComparison_UpdateStatusBars) ~= "function" then return false end
    local originalStatusBars = AchievementFrameComparison_UpdateStatusBars
    AchievementFrameComparison_UpdateStatusBars = function(id)
        if id == "summary" or id == nil then return end
        return originalStatusBars(id)
    end
    achievementComparisonStatusBarsPatched = true
    return true
end

local achievementSummaryPatched = false
local function PatchAchievementSummary()
    if achievementSummaryPatched then return true end
    if type(AchievementFrameSummary_UpdateAchievements) ~= "function" then return false end
    local originalSummaryUpdate = AchievementFrameSummary_UpdateAchievements
    AchievementFrameSummary_UpdateAchievements = function(...)
        local originalGetAchievementInfo = GetAchievementInfo
        if type(originalGetAchievementInfo) == "function" then
            GetAchievementInfo = function(...)
                local id, name, points, completed, month, day, year, description, flags, icon, rewardText, isGuild, wasEarnedByMe, earnedBy = originalGetAchievementInfo(...)
                if points == nil then points = 0 end
                if flags == nil then flags = 0 end
                return id, name, points, completed, month, day, year, description, flags, icon, rewardText, isGuild, wasEarnedByMe, earnedBy
            end
        end
        local ok, err = pcall(originalSummaryUpdate, ...)
        GetAchievementInfo = originalGetAchievementInfo
        if not ok then error(err, 0) end
    end
    achievementSummaryPatched = true
    return true
end

local function EnsureAchievementUI()
    if C_AddOns and C_AddOns.LoadAddOn then
        pcall(C_AddOns.LoadAddOn, "Blizzard_AchievementUI")
    elseif LoadAddOn then
        pcall(LoadAddOn, "Blizzard_AchievementUI")
    end
    PatchAchievementShield()
    PatchAchievementSummary()
    PatchAchievementComparisonStatusBars()
end

-- ========================================================================
-- SISTEMA DE HISTÓRICO DE TROCAS & ECONOMIA (TRADE & WEALTH LEDGER)
-- Inspirado na engenharia de ForeverStatistics e adaptado ao Diário de Bordo
-- ========================================================================
local tradeSession = nil

local function RecordWealthSnapshot()
    EnsureDB()
    local money = (GetMoney and GetMoney()) or 0
    local charKey = UnitName("player") or "Player"
    if GetFullCharacterName then charKey = GetFullCharacterName() end
    HaleckAccountImporterDB.wealthHistory = HaleckAccountImporterDB.wealthHistory or {}
    HaleckAccountImporterDB.wealthHistory[charKey] = HaleckAccountImporterDB.wealthHistory[charKey] or {}
    local hist = HaleckAccountImporterDB.wealthHistory[charKey]
    table.insert(hist, 1, {
        timestamp = time(),
        date = GetCurrentTimestamp(),
        money = money,
        formatted = string.format("%dg %ds %dc", math.floor(money / 10000), math.floor((money % 10000) / 100), money % 100)
    })
    while #hist > 60 do table.remove(hist) end
end

local function UpdateTradeSnapshot()
    if not tradeSession then return end
    tradeSession.playerMoney = (GetPlayerTradeMoney and GetPlayerTradeMoney()) or 0
    tradeSession.targetMoney = (GetTargetTradeMoney and GetTargetTradeMoney()) or 0
    tradeSession.playerItems = {}
    tradeSession.targetItems = {}
    local maxTrade = MAX_TRADE_ITEMS or 7
    for i = 1, maxTrade do
        local pName, _, pCount = nil, nil, nil
        if GetTradePlayerItemInfo then pName, _, pCount = GetTradePlayerItemInfo(i) end
        local pLink = GetTradePlayerItemLink and GetTradePlayerItemLink(i)
        if pName or pLink then
            local itemName = pName or (pLink and pLink:match("%[(.-)%]")) or "Item"
            table.insert(tradeSession.playerItems, {
                name = itemName,
                link = pLink or itemName,
                count = pCount or 1,
            })
        end

        local tName, _, tCount = nil, nil, nil
        if GetTradeTargetItemInfo then tName, _, tCount = GetTradeTargetItemInfo(i) end
        local tLink = GetTradeTargetItemLink and GetTradeTargetItemLink(i)
        if tName or tLink then
            local itemName = tName or (tLink and tLink:match("%[(.-)%]")) or "Item"
            table.insert(tradeSession.targetItems, {
                name = itemName,
                link = tLink or itemName,
                count = tCount or 1,
            })
        end
    end
end

local function StartTradeSession()
    local partner = nil
    if GetFullCharacterName then
        partner = GetFullCharacterName("NPC")
    end
    if not partner or partner == "" or partner == "Unknown" then
        partner = UnitName("NPC") or "Jogador"
    end
    tradeSession = {
        partner = partner,
        started = time(),
        playerAccepted = 0,
        targetAccepted = 0,
        playerMoney = 0,
        targetMoney = 0,
        playerItems = {},
        targetItems = {},
    }
    UpdateTradeSnapshot()
end

local function SaveCompletedTrade()
    EnsureDB()
    if not tradeSession or tradeSession.playerAccepted ~= 1 or tradeSession.targetAccepted ~= 1 then
        tradeSession = nil
        return
    end
    UpdateTradeSnapshot()
    local partner = tradeSession.partner or "Jogador"
    local entry = {
        timestamp = time(),
        date = GetCurrentTimestamp(),
        partner = partner,
        playerMoney = tradeSession.playerMoney or 0,
        targetMoney = tradeSession.targetMoney or 0,
        playerItems = tradeSession.playerItems or {},
        targetItems = tradeSession.targetItems or {},
    }
    HaleckAccountImporterDB.tradeHistory = HaleckAccountImporterDB.tradeHistory or {}
    table.insert(HaleckAccountImporterDB.tradeHistory, 1, entry)
    while #HaleckAccountImporterDB.tradeHistory > 100 do
        table.remove(HaleckAccountImporterDB.tradeHistory)
    end

    -- Registra no Diário de Aventura
    if AddJournalTimelineEntry then
        local gGiven = math.floor((entry.playerMoney or 0) / 10000)
        local gReceived = math.floor((entry.targetMoney or 0) / 10000)
        AddJournalTimelineEntry("trade", "Troca com " .. partner,
            string.format("Negociação concluída. Ouro transferido: %dg | Ouro recebido: %dg | Itens dados: %d | Itens recebidos: %d",
                gGiven, gReceived, #(entry.playerItems or {}), #(entry.targetItems or {})),
            "Interface\\Icons\\INV_Misc_Coin_01", entry
        )
    end

    RecordWealthSnapshot()
    tradeSession = nil
end

-- ========================================================================
-- PROTOCOLO PEER-TO-PEER DE CHECAGEM DE VERSÃO DO ADDON (HAIVER PROTOCOL)
-- Permite que grupos e guildas avisem automaticamente se há nova versão
-- ========================================================================
local VERSION_PREFIX = "HAIVER"
local PROTOCOL_MSG = "HAI1"
local pendingNewestVersion = nil

local function RegisterVersionPrefix()
    if C_ChatInfo and type(C_ChatInfo.RegisterAddonMessagePrefix) == "function" then
        pcall(C_ChatInfo.RegisterAddonMessagePrefix, VERSION_PREFIX)
    elseif type(RegisterAddonMessagePrefix) == "function" then
        pcall(RegisterAddonMessagePrefix, VERSION_PREFIX)
    end
end

local function ParseVersion(val)
    local nums = {}
    for p in tostring(val or ""):gmatch("%d+") do
        table.insert(nums, tonumber(p) or 0)
        if #nums >= 4 then break end
    end
    while #nums < 4 do table.insert(nums, 0) end
    return nums
end

local function CompareVersions(a, b)
    local av, bv = ParseVersion(a), ParseVersion(b)
    for i = 1, 4 do
        if av[i] < bv[i] then return -1 end
        if av[i] > bv[i] then return 1 end
    end
    return 0
end

local function SendVersionMsg(kind, channel, target)
    if not C_ChatInfo or type(C_ChatInfo.SendAddonMessage) ~= "function" then return false end
    local msg = PROTOCOL_MSG .. "|" .. kind .. "|" .. CURRENT_ADDON_VERSION
    return pcall(C_ChatInfo.SendAddonMessage, VERSION_PREFIX, msg, channel, target)
end

local function BroadcastAddonVersion()
    if isInCombat or (InCombatLockdown and InCombatLockdown()) then return end
    RegisterVersionPrefix()
    if IsInGuild and IsInGuild() then SendVersionMsg("H", "GUILD") end
    if IsInGroup and IsInGroup() then
        if IsInRaid and IsInRaid() then
            SendVersionMsg("H", "RAID")
        else
            SendVersionMsg("H", "PARTY")
        end
    end
end

-- ========================================================================
-- MELHORIA 2: BANCO DINÂMICO DE WORLD BOSSES & CONTEÚDO WOW FOREVER (VANILLA+)
-- ========================================================================
local VANILLA_WORLD_BOSSES = {
    kazzak = { id = 12397, name = "Lord Kazzak", zone = "Barreira do Inferno (Blasted Lands)", minRespawn = 72 * 3600, maxRespawn = 96 * 3600, key = "kazzak" },
    azuregos = { id = 6109, name = "Azuregos", zone = "Azshara", minRespawn = 72 * 3600, maxRespawn = 96 * 3600, key = "azuregos" },
    taerar = { id = 14890, name = "Taerar", zone = "Vale Gris (Ashenvale - Bough Shadow)", minRespawn = 72 * 3600, maxRespawn = 96 * 3600, key = "taerar" },
    ysondre = { id = 14887, name = "Ysondre", zone = "Feralas (Dream Bough)", minRespawn = 72 * 3600, maxRespawn = 96 * 3600, key = "ysondre" },
    lethon = { id = 14888, name = "Lethon", zone = "Terras Altas dos Guarus (The Hinterlands)", minRespawn = 72 * 3600, maxRespawn = 96 * 3600, key = "lethon" },
    emeriss = { id = 14889, name = "Emeriss", zone = "Floresta do Crepúsculo (Duskwood - Twilight Grove)", minRespawn = 72 * 3600, maxRespawn = 96 * 3600, key = "emeriss" },
}

-- Injetor Dinâmico de Definições de Conteúdo (Novos chefes e missões de WoW Forever)
local function Haleck_UpdateDynamicDefinitions(customDefs)
    if not customDefs or type(customDefs) ~= "table" then return end
    if customDefs.worldBosses and type(customDefs.worldBosses) == "table" then
        for k, v in pairs(customDefs.worldBosses) do
            if v and v.name then
                VANILLA_WORLD_BOSSES[k] = v
            end
        end
    end
    if HaleckAccountImporterDB then
        HaleckAccountImporterDB.definitionsCache = HaleckAccountImporterDB.definitionsCache or {}
        HaleckAccountImporterDB.definitionsCache.lastUpdated = GetCurrentTimestamp()
        HaleckAccountImporterDB.definitionsCache.customBossCount = 0
        for _ in pairs(VANILLA_WORLD_BOSSES) do
            HaleckAccountImporterDB.definitionsCache.customBossCount = HaleckAccountImporterDB.definitionsCache.customBossCount + 1
        end
    end
end

-- ========================================================================
-- CAMADA DE COMPATIBILIDADE ADAPTATIVA DE APIS (RESILIENTE A NOVAS BUILDS)
-- ========================================================================
local function Haleck_SafeGetQuestLogTitle(idx)
    if C_QuestLog and C_QuestLog.GetInfo then
        local ok, info = pcall(C_QuestLog.GetInfo, idx)
        if ok and info then
            return info.title, info.level, info.suggestedGroup, info.isHeader, info.isCollapsed, info.isComplete, info.frequency, info.questID
        end
    end
    if GetQuestLogTitle then
        local ok, title, lvl, tag, header, collapsed, complete, freq, qId = pcall(GetQuestLogTitle, idx)
        if ok then
            return title, lvl, tag, header, collapsed, complete, freq, qId
        end
    end
    return nil
end

local function Haleck_SafeGetSpellInfo(spellId)
    if C_Spell and C_Spell.GetSpellInfo then
        local ok, sInfo = pcall(C_Spell.GetSpellInfo, spellId)
        if ok and sInfo then
            return sInfo.name, sInfo.iconID or sInfo.originalIconID, sInfo.castTime
        end
    end
    if GetSpellInfo then
        local ok, name, rank, icon, castTime = pcall(GetSpellInfo, spellId)
        if ok and name then
            return name, icon, castTime
        end
    end
    return nil
end

local function Haleck_SafeGetContainerItemInfo(bag, slot)
    if C_Container and C_Container.GetContainerItemInfo then
        local ok, info = pcall(C_Container.GetContainerItemInfo, bag, slot)
        if ok and info then
            return info.iconFileID, info.stackCount, info.isLocked, info.quality, info.isReadable, info.hasLoot, info.hyperlink, info.isFiltered, info.hasNoValue, info.itemID
        end
    end
    if GetContainerItemInfo then
        local ok, texture, count, locked, quality, readable, loot, link, filtered, noValue, itemId = pcall(GetContainerItemInfo, bag, slot)
        if ok then
            return texture, count, locked, quality, readable, loot, link, filtered, noValue, itemId
        end
    end
    return nil
end

-- ========================================================================
-- PIPELINE DE MIGRAÇÃO AUTOMÁTICA DE SAVEDVARIABLES
-- ========================================================================
local function Haleck_RunMigrations()
    if not HaleckAccountImporterDB then return end
    local currentVer = HaleckAccountImporterDB.schemaVersion or 400

    if currentVer < 410 then
        -- Migração v4.0.0 -> v4.1.0
        HaleckAccountImporterDB.definitionsCache = HaleckAccountImporterDB.definitionsCache or {
            version = CURRENT_ADDON_VERSION,
            lastUpdated = GetCurrentTimestamp(),
            customBossCount = 6,
        }
        HaleckAccountImporterDB.compatibilityWarnings = HaleckAccountImporterDB.compatibilityWarnings or {}
        HaleckAccountImporterDB.buildInfo = HaleckAccountImporterDB.buildInfo or {}

        -- Leitura da build real do cliente em tempo de execução
        if GetBuildInfo then
            local ok, v, b, d, toc = pcall(GetBuildInfo)
            if ok then
                HaleckAccountImporterDB.buildInfo = {
                    version = tostring(v),
                    build = tostring(b),
                    releaseDate = tostring(d),
                    tocVersion = tostring(toc),
                    isForeverBeta = (tostring(b) == "16001" or tostring(toc):find("1600")),
                }
            end
        end

        HaleckAccountImporterDB.schemaVersion = CURRENT_SCHEMA_VERSION
        HaleckAccountImporterDB.addonVersion = CURRENT_ADDON_VERSION
    end

    -- Se existirem definições cacheadas de uma sessão anterior, mescla na tabela
    if HaleckAccountImporterDB.definitionsCache and HaleckAccountImporterDB.definitionsCache.worldBosses then
        Haleck_UpdateDynamicDefinitions({ worldBosses = HaleckAccountImporterDB.definitionsCache.worldBosses })
    end
end

-- ========================================================================
-- MELHORIA 4: MOTOR DE COMPRESSÃO LIBDEFLATE / LZ77 + BASE64 (PURO LUA 5.1)
-- ========================================================================
local B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
local B64_LOOKUP = {}
for i = 1, #B64_CHARS do
    B64_LOOKUP[i - 1] = B64_CHARS:sub(i, i)
end

local function Haleck_Base64Encode(data)
    if not data or #data == 0 then return "" end
    local bytes = { string.byte(data, 1, #data) }
    local len = #bytes
    local out = {}
    local i = 1
    while i <= len do
        local b1 = bytes[i]
        local b2 = bytes[i + 1]
        local b3 = bytes[i + 2]

        local c1 = math.floor(b1 / 4)
        local c2 = (b1 % 4) * 16 + (b2 and math.floor(b2 / 16) or 0)
        local c3 = b2 and ((b2 % 16) * 4 + (b3 and math.floor(b3 / 64) or 0)) or nil
        local c4 = b3 and (b3 % 64) or nil

        table.insert(out, B64_LOOKUP[c1])
        table.insert(out, B64_LOOKUP[c2])
        table.insert(out, c3 and B64_LOOKUP[c3] or "=")
        table.insert(out, c4 and B64_LOOKUP[c4] or "=")

        i = i + 3
    end
    return table.concat(out)
end

local LENGTH_CODES = {
    {3, 3, 257, 0}, {4, 4, 258, 0}, {5, 5, 259, 0}, {6, 6, 260, 0}, {7, 7, 261, 0},
    {8, 8, 262, 0}, {9, 9, 263, 0}, {10, 10, 264, 0}, {11, 12, 265, 1}, {13, 14, 266, 1},
    {15, 16, 267, 1}, {17, 18, 268, 1}, {19, 22, 269, 2}, {23, 26, 270, 2}, {27, 30, 271, 2},
    {31, 34, 272, 2}, {35, 42, 273, 3}, {43, 50, 274, 3}, {51, 58, 275, 3}, {59, 66, 276, 3},
    {67, 82, 277, 4}, {83, 98, 278, 4}, {99, 114, 279, 4}, {115, 130, 280, 4}, {131, 162, 281, 5},
    {163, 194, 282, 5}, {195, 226, 283, 5}, {227, 257, 284, 5}, {258, 258, 285, 0}
}

local DIST_CODES = {
    {1, 1, 0, 0}, {2, 2, 1, 0}, {3, 3, 2, 0}, {4, 4, 3, 0},
    {5, 6, 4, 1}, {7, 8, 5, 1}, {9, 12, 6, 2}, {13, 16, 7, 2},
    {17, 24, 8, 3}, {25, 32, 9, 3}, {33, 48, 10, 4}, {49, 64, 11, 4},
    {65, 96, 12, 5}, {97, 128, 13, 5}, {129, 192, 14, 6}, {193, 256, 15, 6},
    {257, 384, 16, 7}, {385, 512, 17, 7}, {513, 768, 18, 8}, {769, 1024, 19, 8},
    {1025, 1536, 20, 9}, {1537, 2048, 21, 9}, {2049, 3072, 22, 10}, {3073, 4096, 23, 10},
    {4097, 6144, 24, 11}, {6145, 8192, 25, 11}, {8193, 12288, 26, 12}, {12289, 16384, 27, 12},
    {16385, 24576, 28, 13}, {24577, 32768, 29, 13}
}

local function CreateBitStream()
    local bs = { buffer = {}, current = 0, bitLen = 0 }
    function bs:write(val, bits)
        for i = 0, bits - 1 do
            local bit = math.floor(val / (2 ^ i)) % 2
            self.current = self.current + bit * (2 ^ self.bitLen)
            self.bitLen = self.bitLen + 1
            if self.bitLen == 8 then
                table.insert(self.buffer, string.char(self.current))
                self.current = 0
                self.bitLen = 0
            end
        end
    end
    function bs:finish()
        if self.bitLen > 0 then
            table.insert(self.buffer, string.char(self.current))
            self.current = 0
            self.bitLen = 0
        end
        return table.concat(self.buffer)
    end
    return bs
end

local function WriteFixedLiteral(bs, lit)
    local code, len
    if lit <= 143 then
        code = 0x30 + lit; len = 8
    elseif lit <= 255 then
        code = 0x190 + (lit - 144); len = 9
    elseif lit == 256 then
        code = 0x000; len = 7
    elseif lit <= 279 then
        code = 0x000 + (lit - 256); len = 7
    else
        code = 0x0c0 + (lit - 280); len = 8
    end
    local rev = 0
    for i = 0, len - 1 do
        local b = math.floor(code / (2 ^ i)) % 2
        rev = rev * 2 + b
    end
    bs:write(rev, len)
end

local function WriteFixedDistance(bs, distCode)
    local rev = 0
    for i = 0, 4 do
        local b = math.floor(distCode / (2 ^ i)) % 2
        rev = rev * 2 + b
    end
    bs:write(rev, 5)
end

local function Haleck_CompressDeflateRaw(inputStr)
    if not inputStr or #inputStr == 0 then return "" end
    local bytes = { string.byte(inputStr, 1, #inputStr) }
    local len = #bytes
    local bs = CreateBitStream()
    bs:write(1, 1)
    bs:write(1, 2)

    local head = {}
    local prev = {}
    local i = 1

    while i <= len do
        local matchLen = 0
        local matchDist = 0

        if i + 2 <= len then
            local b1 = bytes[i]
            local b2 = bytes[i + 1]
            local b3 = bytes[i + 2]
            local h = (b1 * 256 + b2 * 16 + b3) % 4096
            local p = head[h]
            head[h] = i
            prev[i] = p

            local chain = 24
            while p and chain > 0 and (i - p) <= 32768 do
                chain = chain - 1
                if bytes[p] == b1 and bytes[p + 1] == b2 and bytes[p + 2] == b3 then
                    local k = 3
                    while (k < 258) and (i + k <= len) and (bytes[p + k] == bytes[i + k]) do
                        k = k + 1
                    end
                    if k > matchLen then
                        matchLen = k
                        matchDist = i - p
                        if k == 258 then break end
                    end
                end
                p = prev[p]
            end
        end

        if matchLen >= 3 then
            local lcEntry
            for _, e in ipairs(LENGTH_CODES) do
                if matchLen >= e[1] and matchLen <= e[2] then lcEntry = e; break end
            end
            if lcEntry then
                WriteFixedLiteral(bs, lcEntry[3])
                if lcEntry[4] > 0 then
                    bs:write(matchLen - lcEntry[1], lcEntry[4])
                end
                local dcEntry
                for _, d in ipairs(DIST_CODES) do
                    if matchDist >= d[1] and matchDist <= d[2] then dcEntry = d; break end
                end
                if dcEntry then
                    WriteFixedDistance(bs, dcEntry[3])
                    if dcEntry[4] > 0 then
                        bs:write(matchDist - dcEntry[1], dcEntry[4])
                    end
                end
            end
            for j = 1, matchLen - 1 do
                if i + j + 2 <= len then
                    local b1 = bytes[i + j]
                    local b2 = bytes[i + j + 1]
                    local b3 = bytes[i + j + 2]
                    local h2 = (b1 * 256 + b2 * 16 + b3) % 4096
                    prev[i + j] = head[h2]
                    head[h2] = i + j
                end
            end
            i = i + matchLen
        else
            WriteFixedLiteral(bs, bytes[i])
            i = i + 1
        end
    end

    WriteFixedLiteral(bs, 256)
    return bs:finish()
end

local function Haleck_ExportCompressed(str)
    if not str or #str == 0 then return "" end
    local def = Haleck_CompressDeflateRaw(str)
    return "!HAI4:DEF:" .. Haleck_Base64Encode(def)
end

_G["HaleckAccountImporter_Base64Encode"] = Haleck_Base64Encode
_G["HaleckAccountImporter_CompressDeflate"] = Haleck_CompressDeflateRaw
_G["HaleckAccountImporter_ExportCompressed"] = Haleck_ExportCompressed

-- Wrapper Universal para Acesso a Containers (Mochilas, Bolsas e Banco)
-- Suporta Dragonflight/The War Within (C_Container) e Classic Era/Vanilla/Forever (GetContainer*)
local function Haleck_GetContainerItemDetails(bag, slot)
    local itemId, count, icon, quality, link
    if C_Container and C_Container.GetContainerItemInfo then
        local ok, info = pcall(C_Container.GetContainerItemInfo, bag, slot)
        if ok and info then
            if type(info) == "table" then
                itemId = info.itemID
                count = info.stackCount
                icon = info.iconFileID
                quality = info.quality
                link = info.hyperlink
            end
        end
    end
    if not itemId and GetContainerItemInfo then
        local ok, texture, stack, _, q, _, _, itemLink, _, _, id = pcall(GetContainerItemInfo, bag, slot)
        if ok then
            icon = texture
            count = stack
            quality = q
            link = itemLink
            itemId = id
        end
    end
    if not itemId then
        if C_Container and C_Container.GetContainerItemID then
            local ok, id = pcall(C_Container.GetContainerItemID, bag, slot)
            if ok and id then itemId = id end
        elseif GetContainerItemID then
            local ok, id = pcall(GetContainerItemID, bag, slot)
            if ok and id then itemId = id end
        end
    end
    return itemId, count or 1, icon, quality, link
end

local function Haleck_GetContainerNumSlots(bag)
    if C_Container and C_Container.GetContainerNumSlots then
        local ok, slots = pcall(C_Container.GetContainerNumSlots, bag)
        if ok and slots then return slots end
    end
    if GetContainerNumSlots then
        local ok, slots = pcall(GetContainerNumSlots, bag)
        if ok and slots then return slots end
    end
    return 0
end

-- ========================================================================
-- SISTEMA 1: DIÁRIO DE AVENTURA - GERENCIADOR DE LINHA DO TEMPO
-- ========================================================================
local function AddJournalTimelineEntry(entryType, title, desc, icon, extraDetails)
    if not HaleckAccountImporterDB.journal then HaleckAccountImporterDB.journal = {} end
    if not HaleckAccountImporterDB.journal.timeline then HaleckAccountImporterDB.journal.timeline = {} end

    local currentZone = (GetZoneText and GetZoneText()) or ""
    local currentSubZone = (GetSubZoneText and GetSubZoneText()) or ""
    local playerLevel = (UnitLevel and UnitLevel("player")) or 1

    local fullZone = currentZone
    if currentSubZone ~= "" and currentSubZone ~= currentZone then
        fullZone = currentZone .. " (" .. currentSubZone .. ")"
    end

    local entry = {
        id = tostring(time()) .. "_" .. tostring(math.random(1000, 9999)),
        timestamp = GetCurrentTimestamp(),
        type = entryType or "milestone", -- 'level', 'boss', 'quest', 'death', 'discovery', 'group', 'spell', 'milestone'
        title = title or "Marco da Jornada",
        desc = desc or "",
        icon = icon or "Interface\\Icons\\INV_Misc_Book_09",
        zone = fullZone,
        level = playerLevel,
        details = extraDetails or nil,
    }

    table.insert(HaleckAccountImporterDB.journal.timeline, 1, entry)

    -- Manter um histórico generoso sem estourar a memória (máximo 500 eventos mais recentes)
    if #HaleckAccountImporterDB.journal.timeline > 500 then
        table.remove(HaleckAccountImporterDB.journal.timeline)
    end

    return entry
end

_G["HaleckAccountImporter_AddJournalEntry"] = AddJournalTimelineEntry

-- ========================================================================
-- SISTEMA 2: RASTREADOR DE PASSOS & DISTÂNCIA EM TEMPO REAL
-- ========================================================================
local stepTrackerFrame = CreateFrame("Frame", "HaleckStepTrackerFrame")
local lastMapID = nil
local lastPlayerX = nil
local lastPlayerY = nil
local stepAccumulatorTimer = 0

local function GetPlayerCoordinates()
    if C_Map and C_Map.GetBestMapForUnit and C_Map.GetPlayerMapPosition then
        local mapID = C_Map.GetBestMapForUnit("player")
        if mapID then
            local pos = C_Map.GetPlayerMapPosition(mapID, "player")
            if pos then
                local x, y = pos:GetXY()
                if x and y and (x > 0 or y > 0) then
                    return mapID, x, y
                end
            end
        end
    end
    if SetMapToCurrentZone then
        pcall(SetMapToCurrentZone)
    end
    if GetPlayerMapPosition then
        local x, y = GetPlayerMapPosition("player")
        if x and y and (x > 0 or y > 0) then
            local mapID = (GetCurrentMapAreaID and GetCurrentMapAreaID()) or (GetCurrentMapZone and GetCurrentMapZone()) or 1
            return mapID, x, y
        end
    end
    return nil, nil, nil
end

stepTrackerFrame:SetScript("OnUpdate", function(self, elapsed)
    if HaleckAccountImporterDB.options and HaleckAccountImporterDB.options.stepCounter == false then return end

    stepAccumulatorTimer = stepAccumulatorTimer + elapsed
    if stepAccumulatorTimer < 0.35 then return end -- Amostragem a cada 350ms
    stepAccumulatorTimer = 0

    local mapID, curX, curY = GetPlayerCoordinates()
    if not curX or not curY or curX == 0 or curY == 0 then return end

    if lastMapID == mapID and lastPlayerX and lastPlayerY then
        local dx = curX - lastPlayerX
        local dy = curY - lastPlayerY
        local distNorm = math.sqrt(dx * dx + dy * dy)

        -- Filtro anti-teleporte / carregamento de tela
        -- Movimentos humanos dentro de 0.35s ficam abaixo de 0.05 normalizado no mapa
        if distNorm > 0.0001 and distNorm < 0.04 then
            -- Aproximação canônica de distância em Azeroth:
            -- 1 unidade inteira de mapa ~ 15.000 jardas em zonas médias
            local approxYards = distNorm * 12500
            local approxSteps = approxYards * 1.33 -- Cada jarda equivale a ~1.33 passos humanos

            local stats = HaleckAccountImporterDB.journal.statistics
            stats.steps = (stats.steps or 0) + math.floor(approxSteps + 0.5)
            stats.distanceYards = (stats.distanceYards or 0) + math.floor(approxYards + 0.5)
        end
    end

    lastMapID = mapID
    lastPlayerX = curX
    lastPlayerY = curY
end)

-- ========================================================================
-- SISTEMA 3: SCANNER COMPLETO DE QUESTS (ALLTHETHINGS GRADE)
-- ========================================================================
local function HarvestQuestData()
    local result = {
        completedCount = 0,
        completedQuests = {},
        activeQuests = {},
        recentHistory = {},
    }

    -- 1. Quests Concluídas (Scan Robusto)
    pcall(function()
        if C_QuestLog and C_QuestLog.GetAllCompletedQuests then
            local completed = C_QuestLog.GetAllCompletedQuests()
            if completed then
                result.completedQuests = completed
                result.completedCount = #completed
            end
        elseif GetQuestsCompleted then
            local completedTable = {}
            GetQuestsCompleted(completedTable)
            for qId, isDone in pairs(completedTable) do
                if isDone then
                    table.insert(result.completedQuests, qId)
                end
            end
            result.completedCount = #result.completedQuests
        end
    end)

    -- Atualiza estatística agregada
    if HaleckAccountImporterDB.journal and HaleckAccountImporterDB.journal.statistics then
        HaleckAccountImporterDB.journal.statistics.totalQuestsCompleted = math.max(
            HaleckAccountImporterDB.journal.statistics.totalQuestsCompleted or 0,
            result.completedCount or 0
        )
    end

    -- 2. Quests Ativas no Quest Log
    pcall(function()
        local numEntries = 0
        if C_QuestLog and C_QuestLog.GetNumQuestLogEntries then
            numEntries = C_QuestLog.GetNumQuestLogEntries()
        elseif GetNumQuestLogEntries then
            numEntries = GetNumQuestLogEntries()
        end

        local currentZoneHeader = "Mundo"
        for i = 1, numEntries do
            local title, level, suggestedGroup, isHeader, isCollapsed, isComplete, frequency, questID = nil
            if C_QuestLog and C_QuestLog.GetInfo then
                local qInfo = C_QuestLog.GetInfo(i)
                if qInfo then
                    title = qInfo.title
                    level = qInfo.level
                    isHeader = qInfo.isHeader
                    isComplete = (qInfo.isComplete and 1 or 0)
                    questID = qInfo.questID
                end
            elseif GetQuestLogTitle then
                title, level, suggestedGroup, isHeader, isCollapsed, isComplete, frequency, questID = GetQuestLogTitle(i)
            end

            if isHeader then
                currentZoneHeader = title or "Mundo"
            elseif title and questID and questID > 0 then
                table.insert(result.activeQuests, {
                    id = questID,
                    title = title,
                    level = level or 1,
                    isComplete = (isComplete == 1 or isComplete == true),
                    zone = currentZoneHeader,
                })
            end
        end
    end)

    return result
end

-- ========================================================================
-- SISTEMA 4: SCANNER DE MAGIAS, HABILIDADES & PONTOS DE VOO
-- ========================================================================
local function HarvestSpellbookAndFlights()
    local result = {
        totalSpells = 0,
        spells = {},
        flightPaths = {},
        flightPathsCount = 0,
    }

    -- 1. Scan do Grimório (Spellbook)
    pcall(function()
        local numTabs = (GetNumSpellTabs and GetNumSpellTabs()) or 1
        for tab = 1, numTabs do
            local tabName, tabTexture, offset, numSpells = GetSpellTabInfo(tab)
            if numSpells and numSpells > 0 then
                for s = offset + 1, offset + numSpells do
                    local spellName, subSpellName, spellId = nil
                    if C_SpellBook and C_SpellBook.GetSpellBookItemName and Enum and Enum.SpellBookSpellBank then
                        spellName, subSpellName = C_SpellBook.GetSpellBookItemName(s, Enum.SpellBookSpellBank.Player)
                        spellId = C_SpellBook.GetSpellBookItemType and select(2, C_SpellBook.GetSpellBookItemType(s, Enum.SpellBookSpellBank.Player))
                    elseif GetSpellBookItemName then
                        local bookType = BOOKTYPE_SPELL or "spell"
                        spellName, subSpellName = GetSpellBookItemName(s, bookType)
                        spellId = select(2, GetSpellBookItemInfo(s, bookType))
                    end

                    if spellName and spellId then
                        local icon = (GetSpellTexture and GetSpellTexture(spellId)) or ""
                        local isPassive = (IsPassiveSpell and IsPassiveSpell(spellId)) or false
                        table.insert(result.spells, {
                            id = spellId,
                            name = spellName,
                            rank = subSpellName or "",
                            icon = icon,
                            tab = tabName or "Geral",
                            isPassive = isPassive,
                        })
                    end
                end
            end
        end
        result.totalSpells = #result.spells
    end)

    -- 2. Pontos de Voo (Taxi Nodes Desbloqueados)
    pcall(function()
        if NumTaxiNodes and NumTaxiNodes() > 0 then
            for i = 1, NumTaxiNodes() do
                local nodeType = TaxiNodeGetType and TaxiNodeGetType(i)
                local nodeName = TaxiNodeName and TaxiNodeName(i)
                -- "CURRENT", "REACHABLE", "DISTANT"
                if nodeName and (nodeType == "CURRENT" or nodeType == "REACHABLE") then
                    table.insert(result.flightPaths, {
                        id = i,
                        name = nodeName,
                        type = nodeType
                    })
                end
            end
            result.flightPathsCount = #result.flightPaths
        end
    end)

    return result
end

-- ========================================================================
-- SISTEMA 5: CAÇADAS, CHEFES & RAROS (FIRST KILLS & HUNTER'S LOG)
-- ========================================================================
local function RecordBossOrRareDefeat(bossName, isRare, extraId)
    if not bossName or bossName == "" or bossName == "Unknown" then return end
    if not HaleckAccountImporterDB.journal then HaleckAccountImporterDB.journal = {} end
    if not HaleckAccountImporterDB.journal.bosses then HaleckAccountImporterDB.journal.bosses = {} end

    local currentZone = (GetZoneText and GetZoneText()) or ""
    local playerLevel = (UnitLevel and UnitLevel("player")) or 1
    local now = GetCurrentTimestamp()

    local existing = HaleckAccountImporterDB.journal.bosses[bossName]
    if existing then
        existing.killCount = (existing.killCount or 1) + 1
        existing.lastKillDate = now
    else
        -- Primeira Vitória Histórica!
        local isWorldBoss = (bossName:find("Kazzak") or bossName:find("Azuregos") or bossName:find("Taerar") or bossName:find("Lethon") or bossName:find("Emeriss") or bossName:find("Ysondre") or bossName:find("Doomwalker")) ~= nil
        HaleckAccountImporterDB.journal.bosses[bossName] = {
            id = extraId or time(),
            name = bossName,
            firstKillDate = now,
            lastKillDate = now,
            killCount = 1,
            zone = currentZone,
            level = playerLevel,
            isRare = isRare or false,
            isWorldBoss = isWorldBoss
        }

        local title = isRare and ("Raro Caçado: " .. bossName) or (isWorldBoss and ("Chefe Mundial: " .. bossName) or ("Primeira Vitória: " .. bossName))
        local desc = string.format("Derrotou %s pela primeira vez em %s no nível %d.", bossName, currentZone, playerLevel)
        local icon = isRare and "Interface\\Icons\\INV_Misc_MonsterClaw_04" or (isWorldBoss and "Interface\\Icons\\Spell_Fire_Elemental_Totem" or "Interface\\Icons\\INV_Misc_Head_Dragon_01")

        AddJournalTimelineEntry("boss", title, desc, icon, {
            boss = bossName,
            zone = currentZone,
            level = playerLevel,
            killCount = 1,
            isWorldBoss = isWorldBoss
        })

        -- Incrementa contador geral
        local stats = HaleckAccountImporterDB.journal.statistics
        stats.totalBossesDefeated = (stats.totalBossesDefeated or 0) + 1

        print(string.format("|cff00f2fe[Diário de Aventura]|r Nova vitória histórica gravada: |cffffcc00%s|r abatido pela 1ª vez!", bossName))
    end
end

-- ========================================================================
-- SISTEMA 6: COMPANHEIROS DE JORNADA (PARTY & RAID SOCIAL HISTORY)
-- ========================================================================
local function ScanPartyAndRaidMembers()
    if HaleckAccountImporterDB.options and HaleckAccountImporterDB.options.companions == false then return end
    if not HaleckAccountImporterDB.journal then HaleckAccountImporterDB.journal = {} end
    if not HaleckAccountImporterDB.journal.companions then HaleckAccountImporterDB.journal.companions = {} end

    local currentZone = (GetZoneText and GetZoneText()) or ""
    local now = GetCurrentTimestamp()
    local currentRealm = GetRealmName() or ""

    local numGroup = GetNumGroupMembers and GetNumGroupMembers() or 0
    if numGroup <= 1 then return end

    local isRaid = IsInRaid and IsInRaid()
    local prefix = isRaid and "raid" or "party"
    local maxLoop = isRaid and numGroup or (numGroup - 1)

    for i = 1, maxLoop do
        local unit = prefix .. i
        if UnitExists(unit) and not UnitIsUnit(unit, "player") then
            local uName, uRealm = UnitName(unit)
            if uName then
                uRealm = (uRealm and uRealm ~= "") and uRealm or currentRealm
                local fullKey = uName .. "-" .. uRealm
                local _, uClass = UnitClass(unit)
                local uLevel = UnitLevel(unit) or 1

                local comp = HaleckAccountImporterDB.journal.companions[fullKey]
                if comp then
                    comp.timesGrouped = (comp.timesGrouped or 1) + 1
                    comp.lastMetDate = now
                    comp.level = uLevel
                else
                    HaleckAccountImporterDB.journal.companions[fullKey] = {
                        name = uName,
                        realm = uRealm,
                        class = uClass or "Warrior",
                        level = uLevel,
                        firstMetDate = now,
                        lastMetDate = now,
                        zone = currentZone,
                        timesGrouped = 1
                    }

                    AddJournalTimelineEntry("group", "Novo Companheiro: " .. uName, 
                        string.format("Formou grupo com %s (%s nv. %d de %s) em %s.", uName, uClass or "Aventureiro", uLevel, uRealm, currentZone),
                        "Interface\\Icons\\Spell_Holy_PrayerOfFortitude", {
                            name = uName,
                            realm = uRealm,
                            class = uClass,
                            level = uLevel,
                            zone = currentZone
                        }
                    )

                    local stats = HaleckAccountImporterDB.journal.statistics
                    stats.totalCompanionsMet = (stats.totalCompanionsMet or 0) + 1
                end
            end
        end
    end
end

-- ========================================================================
-- SISTEMA 7: EXPLORAÇÃO & CARTOGRAFIA COM TIMESTAMPS
-- ========================================================================
local function RecordExplorationVisit()
    if HaleckAccountImporterDB.options and HaleckAccountImporterDB.options.exploration == false then return end
    local zone = (GetZoneText and GetZoneText()) or ""
    local subZone = (GetSubZoneText and GetSubZoneText()) or ""
    if zone == "" then return end

    if not HaleckAccountImporterDB.journal then HaleckAccountImporterDB.journal = {} end
    if not HaleckAccountImporterDB.journal.exploration then HaleckAccountImporterDB.journal.exploration = {} end

    local now = GetCurrentTimestamp()
    local exp = HaleckAccountImporterDB.journal.exploration[zone]
    if exp then
        exp.visitCount = (exp.visitCount or 1) + 1
        exp.lastVisited = now
        if subZone ~= "" and not exp.subZones[subZone] then
            exp.subZones[subZone] = now
        end
    else
        HaleckAccountImporterDB.journal.exploration[zone] = {
            zone = zone,
            firstVisited = now,
            lastVisited = now,
            visitCount = 1,
            subZones = subZone ~= "" and { [subZone] = now } or {}
        }

        AddJournalTimelineEntry("discovery", "Descobriu a Região: " .. zone,
            string.format("Desbravou pela primeira vez os limites de %s.", zone),
            "Interface\\Icons\\INV_Misc_Map02", { zone = zone }
        )
    end
end

-- ========================================================================
-- SISTEMA 8: ESTATÍSTICAS NATIVAS DO WOW HARVESTER
-- ========================================================================
local function HarvestNativeGameStatistics()
    local statsCatalog = {}

    -- 1. Atributos Canônicos de Personagem (WoW Forever / Classic Vanilla+ / Retail)
    pcall(function()
        local str = (UnitStat and UnitStat("player", 1)) or 0
        local agi = (UnitStat and UnitStat("player", 2)) or 0
        local sta = (UnitStat and UnitStat("player", 3)) or 0
        local int = (UnitStat and UnitStat("player", 4)) or 0
        local spi = (UnitStat and UnitStat("player", 5)) or 0

        statsCatalog["stat_strength"] = tostring(math.floor(str))
        statsCatalog["stat_agility"] = tostring(math.floor(agi))
        statsCatalog["stat_stamina"] = tostring(math.floor(sta))
        statsCatalog["stat_intellect"] = tostring(math.floor(int))
        statsCatalog["stat_spirit"] = tostring(math.floor(spi))

        -- Vida & Recurso
        local maxHp = (UnitHealthMax and UnitHealthMax("player")) or 0
        local maxPower = (UnitPowerMax and UnitPowerMax("player")) or 0
        statsCatalog["stat_max_hp"] = tostring(maxHp)
        statsCatalog["stat_max_power"] = tostring(maxPower)

        -- Armadura & Mitigação
        if UnitArmor then
            local _, effArmor = UnitArmor("player")
            statsCatalog["stat_armor"] = tostring(math.floor(effArmor or 0))
        end

        -- Poder de Ataque
        if UnitAttackPower then
            local baseAP, posBuff, negBuff = UnitAttackPower("player")
            statsCatalog["stat_attack_power"] = tostring(math.floor((baseAP or 0) + (posBuff or 0) + (negBuff or 0)))
        end

        -- Chance de Crítico
        if GetCritChance then
            statsCatalog["stat_crit_chance"] = string.format("%.2f%%", GetCritChance() or 0)
        end

        -- Dano Mágico / Cura
        if GetSpellBonusDamage then
            local maxDmg = 0
            for i = 1, 7 do
                local dmg = GetSpellBonusDamage(i) or 0
                if dmg > maxDmg then maxDmg = dmg end
            end
            statsCatalog["stat_spell_power"] = tostring(math.floor(maxDmg))
        end
        if GetSpellBonusHealing then
            statsCatalog["stat_spell_healing"] = tostring(math.floor(GetSpellBonusHealing() or 0))
        end

        -- Esquiva, Bloqueio, Aparo
        if GetDodgeChance then statsCatalog["stat_dodge"] = string.format("%.2f%%", GetDodgeChance() or 0) end
        if GetParryChance then statsCatalog["stat_parry"] = string.format("%.2f%%", GetParryChance() or 0) end
        if GetBlockChance then statsCatalog["stat_block"] = string.format("%.2f%%", GetBlockChance() or 0) end

        -- Moedas
        if GetMoney then
            local copper = GetMoney() or 0
            local g = math.floor(copper / 10000)
            local s = math.floor((copper % 10000) / 100)
            local c = copper % 100
            statsCatalog["stat_money"] = string.format("%dg %ds %dc", g, s, c)
        end

        -- Estatísticas do Diário
        local jStats = (HaleckAccountImporterDB and HaleckAccountImporterDB.journal and HaleckAccountImporterDB.journal.statistics) or {}
        statsCatalog["stat_total_steps"] = tostring(jStats.steps or 0)
        statsCatalog["stat_total_quests"] = tostring(jStats.totalQuestsCompleted or 0)
        statsCatalog["stat_total_bosses"] = tostring(jStats.totalBossesDefeated or 0)
        statsCatalog["stat_total_deaths"] = tostring(jStats.totalDeaths or 0)
        statsCatalog["stat_total_companions"] = tostring(jStats.totalCompanionsMet or 0)

        -- Aliases para IDs clássicos do GetStatistic
        statsCatalog["stat_1487"] = statsCatalog["stat_crit_chance"] or "0.00%"
        statsCatalog["stat_1488"] = statsCatalog["stat_attack_power"] or "0"
        statsCatalog["stat_1489"] = statsCatalog["stat_spell_healing"] or statsCatalog["stat_spell_power"] or "0"
        statsCatalog["stat_60"] = statsCatalog["stat_total_deaths"] or "0"
        statsCatalog["stat_61"] = "0"
        statsCatalog["stat_62"] = "0"
        statsCatalog["stat_97"] = "0"
        statsCatalog["stat_98"] = "0"
        statsCatalog["stat_107"] = statsCatalog["stat_money"] or "0g 0s 0c"
        statsCatalog["stat_338"] = tostring(jStats.steps or 0) .. " passos"
        statsCatalog["stat_339"] = tostring(jStats.totalBossesDefeated or 0) .. " chefes"
        statsCatalog["stat_319"] = tostring(jStats.totalCompanionsMet or 0) .. " companheiros"
    end)

    -- 2. Suporte canônico para WoW Forever (16001) e clients com Achievement/Statistics System
    pcall(function()
        if not GetStatisticsCategoryList or not GetStatistic then return end
        EnsureAchievementUI()
        local catList = SafeCall(GetStatisticsCategoryList)
        if type(catList) ~= "table" then return end

        for _, catId in ipairs(catList) do
            local catName = SafeCall(GetCategoryInfo, catId) or ("Category " .. tostring(catId))
            local count = SafeCall(GetCategoryNumAchievements, catId) or 0
            if count and count > 0 then
                for sIndex = 1, count do
                    local statId, statName = SafeCall(GetAchievementInfo, catId, sIndex)
                    if statId then
                        local statVal = SafeCall(GetStatistic, statId)
                        if statVal and statVal ~= "" and statVal ~= "--" then
                            statsCatalog["stat_" .. tostring(statId)] = statVal
                            if statName and statName ~= "" then
                                statsCatalog[statName] = statVal
                            end
                        end
                    end
                end
            end
        end
    end)
    return statsCatalog
end

-- ========================================================================
-- SISTEMA 9: SERIALIZAÇÃO DE ITENS, BANCO & EQUIPAMENTOS
-- ========================================================================
local function SerializeItem(slotId, includeAllIds)
    local itemLink = GetInventoryItemLink("player", slotId)
    local itemId = GetInventoryItemID("player", slotId)
    if not itemId then return nil end

    local name, _, quality, itemLevel, _, itemType, itemSubType, _, equipLoc, texture = GetItemInfo(itemLink or itemId)
    
    -- Fallback robusto usando C_Item.GetItemInfoInstant para itens ainda não carregados no cache
    if not texture or texture == "" then
        if C_Item and C_Item.GetItemInfoInstant then
            local ok, _, _, _, _, instantIcon = pcall(C_Item.GetItemInfoInstant, itemId)
            if ok and instantIcon then texture = instantIcon end
        end
        if not texture or texture == "" then
            texture = (GetItemIcon and GetItemIcon(itemId)) or (C_Item and C_Item.GetItemIconByID and C_Item.GetItemIconByID(itemId)) or ""
        end
    end

    if (not itemLevel or itemLevel == 0) and itemLink and GetDetailedItemLevelInfo then
        local ok, dIlvl = pcall(GetDetailedItemLevelInfo, itemLink)
        if ok and dIlvl and dIlvl > 0 then itemLevel = dIlvl end
    end

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

    if includeAllIds ~= false then
        local displayId = 0
        if C_TransmogCollection and C_TransmogCollection.GetInspectItemTransmogInfo then
            pcall(function()
                local tmogInfo = C_TransmogCollection.GetInspectItemTransmogInfo(slotId)
                if tmogInfo and tmogInfo.appearanceID and tmogInfo.appearanceID > 0 then
                    displayId = tmogInfo.appearanceID
                    itemObj.transmog = {
                        itemId = tmogInfo.appearanceID,
                        displayId = tmogInfo.appearanceID,
                        appearanceId = tmogInfo.appearanceID,
                        name = "Transmog #" .. tmogInfo.appearanceID,
                    }
                end
            end)
        end

        if displayId == 0 and C_Item and C_Item.GetItemAppearance then
            pcall(function()
                displayId = C_Item.GetItemAppearance(itemId) or 0
            end)
        end

        itemObj.displayId = displayId > 0 and displayId or nil

        if GetItemSpell then
            pcall(function()
                local spName, spId = GetItemSpell(itemLink or itemId)
                if spId and spId > 0 then
                    itemObj.spellId = spId
                    itemObj.spellName = spName
                end
            end)
        end
    end

    if GetInventoryItemDurability then
        pcall(function()
            local cur, maxD = GetInventoryItemDurability(slotId)
            if maxD and maxD > 0 then
                itemObj.durability = string.format("Durability %d / %d", cur or maxD, maxD)
            end
        end)
    end

    return itemObj
end

local function SerializeBank()
    local mainBank = {}
    local numBankSlots = 28
    for slot = 1, numBankSlots do
        local itemId, count, icon, quality, link = Haleck_GetContainerItemDetails(-1, slot)
        if itemId then
            local name, _, q, ilvl, _, _, _, _, _, texture = GetItemInfo(itemId)
            table.insert(mainBank, {
                id = itemId,
                name = name or ("Item #" .. itemId),
                stackCount = count or 1,
                quality = quality or q or 1,
                iconUrl = texture or icon or "",
                itemLevel = ilvl or 0,
                slotIndex = slot,
                location = "Main Bank"
            })
        end
    end

    -- Bolsas do Banco (slots de bolsas extras do banco)
    local bankBags = {}
    local firstBankBag = (NUM_BAG_SLOTS and NUM_BAG_SLOTS + 1) or 5
    local lastBankBag = (NUM_BAG_SLOTS and NUM_BANKBAGSLOTS and (NUM_BAG_SLOTS + NUM_BANKBAGSLOTS)) or 11
    for b = firstBankBag, lastBankBag do
        local numSlots = Haleck_GetContainerNumSlots(b)
        if numSlots > 0 then
            for slot = 1, numSlots do
                local itemId, count, icon, quality, link = Haleck_GetContainerItemDetails(b, slot)
                if itemId then
                    local name, _, q, ilvl, _, _, _, _, _, texture = GetItemInfo(itemId)
                    table.insert(mainBank, {
                        id = itemId,
                        name = name or ("Item #" .. itemId),
                        stackCount = count or 1,
                        quality = quality or q or 1,
                        iconUrl = texture or icon or "",
                        itemLevel = ilvl or 0,
                        bagIndex = b,
                        slotIndex = slot,
                        location = "Bank Bag " .. b
                    })
                end
            end
        end
    end

    local reagentBank = {}
    pcall(function()
        local numReagents = Haleck_GetContainerNumSlots(-3)
        if numReagents and numReagents > 0 then
            for slot = 1, numReagents do
                local itemId, count, icon, quality, link = Haleck_GetContainerItemDetails(-3, slot)
                if itemId then
                    local name, _, q, ilvl, _, _, _, _, _, texture = GetItemInfo(itemId)
                    table.insert(reagentBank, {
                        id = itemId,
                        name = name or ("Item #" .. itemId),
                        stackCount = count or 1,
                        quality = quality or q or 1,
                        iconUrl = texture or icon or "",
                        itemLevel = ilvl or 0,
                        slotIndex = slot,
                        location = "Reagent Bank"
                    })
                end
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
                    local numSlots = Haleck_GetContainerNumSlots(containerId)
                    for slot = 1, (numSlots > 0 and numSlots or 98) do
                        local itemId, count, icon, quality, link = Haleck_GetContainerItemDetails(containerId, slot)
                        if itemId then
                            local name, _, q, ilvl, _, _, _, _, _, texture = GetItemInfo(itemId)
                            table.insert(warbandBank, {
                                id = itemId,
                                name = name or ("Item #" .. itemId),
                                stackCount = count or 1,
                                quality = quality or q or 1,
                                iconUrl = texture or icon or "",
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
        lastBankVisit = GetCurrentISODate(),
        totalBankItems = #mainBank + #reagentBank + #warbandBank
    }
end

-- ========================================================================
-- RESOLUÇÃO DE NOME COMPLETO DO PERSONAGEM (SUPORTE WOW FOREVER VANILLA+)
-- O WoW Forever (16001 / 1.60.1) introduziu sobrenomes (Surnames) e a API UnitNameUnmodified.
-- Chamadas diretas de addons podem causar 'Secret Unit Name' taint.
-- O padrão canônico utiliza securecall(UnitNameUnmodified, unit) para execução segura.
-- ========================================================================
local function GetFullCharacterName(unit)
    unit = unit or "player"
    local firstName, surname

    if securecall then
        if UnitNameUnmodified then
            firstName, surname = securecall(UnitNameUnmodified, unit)
        elseif UnitName then
            firstName, surname = securecall(UnitName, unit)
        end
    else
        if UnitNameUnmodified then
            firstName, surname = UnitNameUnmodified(unit)
        elseif UnitName then
            firstName, surname = UnitName(unit)
        end
    end

    if not firstName or firstName == "" then
        firstName = (UnitName and UnitName(unit)) or "Herói"
    end

    if not surname or surname == "" then
        if UnitSurname then pcall(function() surname = UnitSurname(unit) end) end
        if not surname and UnitLastName then pcall(function() surname = UnitLastName(unit) end) end
        if not surname and GetSurname then pcall(function() surname = GetSurname(unit) end) end
        if not surname and GetPlayerSurname and (unit == "player") then pcall(function() surname = GetPlayerSurname() end) end
        if not surname and C_Character and C_Character.GetSurname and (unit == "player") then
            pcall(function() surname = C_Character.GetSurname() end)
        end
    end

    if surname and surname ~= "" and surname ~= firstName then
        return firstName .. " " .. surname
    end

    if unit == "player" and HaleckAccountImporterDB and HaleckAccountImporterDB.latestCharacter and HaleckAccountImporterDB.latestCharacter:find("%s+") and HaleckAccountImporterDB.latestCharacter:find(firstName) then
        return HaleckAccountImporterDB.latestCharacter
    end

    return firstName
end
_G["HaleckAccountImporter_GetFullCharacterName"] = GetFullCharacterName

-- ========================================================================
-- SISTEMA 10: GERADOR DO SNAPSHOT COMPLETO (ALLTHETHINGS GRADE)
-- ========================================================================
local function ExportCharacterSnapshot(userOpts)
    local opts = userOpts or HaleckAccountImporterDB.options or {}

    local charName = GetFullCharacterName()
    local realmName = GetRealmName() or "Unknown"
    local localizedClass, englishClass, classIndex = UnitClass("player")
    local localizedRace, englishRace, raceIndex = UnitRace("player")
    local genderId = UnitSex("player")
    local gender = (genderId == 3) and "FEMALE" or "MALE"
    local level = UnitLevel("player") or 1
    local faction = UnitFactionGroup("player") or "ALLIANCE"

    -- Ruleset detection (especialmente WoW Forever Beta Build 16001)
    local ruleset = nil
    if GetRuleset then pcall(function() ruleset = GetRuleset() end) end
    if not ruleset and C_GameRules and C_GameRules.GetRulesetName then
        pcall(function() ruleset = C_GameRules.GetRulesetName() end)
    end
    if not ruleset and (realmName:lower():find("forever") or realmName:lower():find("hardcore")) then
        ruleset = realmName
    end

    local avgIlvl, eqIlvl = 0, 0
    if GetAverageItemLevel then
        pcall(function() avgIlvl, eqIlvl = GetAverageItemLevel() end)
    end

    local guildName, guildRankName = GetGuildInfo("player")

    -- 1. Equipamentos Ativos
    local equippedItems = {}
    local slotMap = {
        [1] = "HEAD", [2] = "NECK", [3] = "SHOULDER", [4] = "SHIRT",
        [5] = "CHEST", [6] = "WAIST", [7] = "LEGS", [8] = "FEET",
        [9] = "WRIST", [10] = "HANDS", [11] = "FINGER_1", [12] = "FINGER_2",
        [13] = "TRINKET_1", [14] = "TRINKET_2", [15] = "BACK", [16] = "MAIN_HAND",
        [17] = "OFF_HAND", [18] = "RANGED", [19] = "TABARD"
    }

    if opts.equippedGear ~= false then
        for slotId = 1, 19 do
            local item = SerializeItem(slotId, opts.allItemIds ~= false)
            if item then
                item.slot = slotMap[slotId] or ("SLOT_" .. slotId)
                table.insert(equippedItems, item)
            end
        end
    end

    -- 2. Inventário & Bolsas (Suporte Robusto Multi-Versão)
    local backpack = { slotCount = 16, bagSlotIndex = 0, items = {} }
    local bags = {}
    if opts.inventory ~= false then
        for slot = 1, 16 do
            local itemId, count, icon, quality, link = Haleck_GetContainerItemDetails(0, slot)
            if itemId then
                local name, _, q, ilvl, _, _, _, _, _, texture = GetItemInfo(itemId)
                table.insert(backpack.items, {
                    id = itemId,
                    name = name or ("Item #" .. itemId),
                    stackCount = count or 1,
                    quality = quality or q or 1,
                    iconUrl = texture or icon or "",
                    itemLevel = ilvl or 0,
                    bagIndex = 0,
                    slotIndex = slot,
                })
            end
        end

        for bag = 1, 4 do
            local numSlots = Haleck_GetContainerNumSlots(bag)
            if numSlots > 0 then
                local bagObj = { slotCount = numSlots, bagSlotIndex = bag, items = {} }
                for slot = 1, numSlots do
                    local itemId, count, icon, quality, link = Haleck_GetContainerItemDetails(bag, slot)
                    if itemId then
                        local name, _, q, ilvl, _, _, _, _, _, texture = GetItemInfo(itemId)
                        table.insert(bagObj.items, {
                            id = itemId,
                            name = name or ("Item #" .. itemId),
                            stackCount = count or 1,
                            quality = quality or q or 1,
                            iconUrl = texture or icon or "",
                            itemLevel = ilvl or 0,
                            bagIndex = bag,
                            slotIndex = slot,
                        })
                    end
                end
                table.insert(bags, bagObj)
            end
        end
    end

    -- 3. Quests & Missões (ATT Grade)
    local questData = (opts.questsCompleted ~= false or opts.questsActive ~= false) and HarvestQuestData() or { completedCount = 0, completedQuests = {}, activeQuests = {} }

    -- 4. Magias & Grimório (ATT Grade)
    local spellData = (opts.spells ~= false or opts.flightPaths ~= false) and HarvestSpellbookAndFlights() or { totalSpells = 0, spells = {}, flightPaths = {} }

    -- 5. Montarias, Pets, Toys, Títulos
    local mounts = {}
    local pets = {}
    local toys = {}
    local titles = {}

    if opts.mounts ~= false then
        pcall(function()
            if C_MountJournal and C_MountJournal.GetMountIDs then
                local mountIDs = C_MountJournal.GetMountIDs()
                for _, mId in ipairs(mountIDs) do
                    local name, spellId, icon, _, isUsable, _, _, isFactionSpecific, factionGroup, _, isCollected = C_MountJournal.GetMountInfoByID(mId)
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
            end
        end)
    end

    if opts.pets ~= false then
        pcall(function()
            if C_PetJournal and C_PetJournal.GetNumPets then
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
                        })
                    end
                end
            end
        end)
    end

    if opts.toys ~= false then
        pcall(function()
            if C_ToyBox and C_ToyBox.GetNumLearnedDisplayedToys then
                local numToys = C_ToyBox.GetNumLearnedDisplayedToys() or 0
                for i = 1, math.min(numToys, 500) do
                    local itemId = C_ToyBox.GetToyFromIndex(i)
                    if itemId and itemId > 0 and (not PlayerHasToy or PlayerHasToy(itemId)) then
                        local _, toyName, icon = C_ToyBox.GetToyInfo(itemId)
                        table.insert(toys, {
                            id = itemId,
                            itemId = itemId,
                            name = toyName or ("Toy #" .. itemId),
                            iconUrl = icon or "",
                            isCollected = true,
                        })
                    end
                end
            end
        end)
    end

    if opts.titles ~= false then
        pcall(function()
            if GetNumTitles then
                local numTitles = GetNumTitles()
                local currentTitleId = GetCurrentTitle and GetCurrentTitle()
                for t = 1, numTitles do
                    if IsTitleKnown and IsTitleKnown(t) then
                        local titleName = GetTitleName(t)
                        if titleName then
                            table.insert(titles, {
                                id = t,
                                name = titleName:gsub("^%s+", ""):gsub("%s+$", ""),
                                isCurrent = (t == currentTitleId)
                            })
                        end
                    end
                end
            end
        end)
    end

    -- 6. Aparência 3D & Barbearia
    local appearance = nil
    if opts.appearance ~= false then
        appearance = {
            race = englishRace or localizedRace or "Human",
            raceId = raceIndex or 1,
            gender = gender,
            genderId = genderId,
            characterClass = englishClass or localizedClass or "Warrior",
            classId = classIndex or 1,
            customizations = {},
        }
        pcall(function()
            if C_Barbershop and C_Barbershop.GetCurrentCharacterData then
                local barberData = C_Barbershop.GetCurrentCharacterData()
                if barberData and barberData.customizationChoices then
                    for _, choice in ipairs(barberData.customizationChoices) do
                        table.insert(appearance.customizations, {
                            optionId = choice.optionID,
                            choiceId = choice.choiceID,
                        })
                    end
                end
            end
        end)
    end

    -- 7. Talentos (Árvores 51 pontos Clássicas/Vanilla/Forever & Specs Modernas)
    local talents = { specs = {}, activeSpec = "Primary Spec" }
    if opts.talents ~= false then
        pcall(function()
            if GetNumSpecializations and GetSpecialization then
                local currentSpec = GetSpecialization()
                if currentSpec then
                    local id, name, desc, icon = GetSpecializationInfo(currentSpec)
                    talents.activeSpec = name or "Primary Spec"
                    talents.activeSpecIcon = icon
                end
            elseif GetNumTalentTabs then
                local numTabs = GetNumTalentTabs()
                local highestPoints, bestTabName = -1, "General"
                for tab = 1, numTabs do
                    local name, iconTexture, pointsSpent = GetTalentTabInfo(tab)
                    table.insert(talents.specs, {
                        name = name or ("Tree " .. tab),
                        icon = iconTexture or "",
                        points = pointsSpent or 0,
                    })
                    if (pointsSpent or 0) > highestPoints then
                        highestPoints = pointsSpent or 0
                        bestTabName = name or "General"
                    end
                end
                talents.activeSpec = bestTabName
            end
        end)
    end

    -- 8. Profissões
    local professions = { primary = {}, secondary = {} }
    if opts.professions ~= false then
        pcall(function()
            if GetProfessions then
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
            end
        end)
    end

    -- 9. Reputações
    local reputations = {}
    if opts.reputations ~= false then
        pcall(function()
            if GetNumFactions then
                local numFactions = GetNumFactions()
                local standingNames = { [1]="Hated",[2]="Hostile",[3]="Unfriendly",[4]="Neutral",[5]="Friendly",[6]="Honored",[7]="Revered",[8]="Exalted" }
                for i = 1, numFactions do
                    local name, description, standingId, barMin, barMax, barValue, _, _, isHeader, _, _, _, _, factionID = GetFactionInfo(i)
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
            end
        end)
    end

    -- 10. Conquistas
    local achievementPoints = 0
    if opts.achievements ~= false and GetTotalAchievementPoints then
        pcall(function() achievementPoints = GetTotalAchievementPoints() or 0 end)
    end

    -- 11. Estatísticas Nativas
    local nativeStats = (opts.nativeStats ~= false) and HarvestNativeGameStatistics() or {}

    -- 12. Diário de Aventura Consolidado
    local journalExport = {
        timeline = HaleckAccountImporterDB.journal.timeline or {},
        bosses = HaleckAccountImporterDB.journal.bosses or {},
        companions = HaleckAccountImporterDB.journal.companions or {},
        exploration = HaleckAccountImporterDB.journal.exploration or {},
        deaths = HaleckAccountImporterDB.journal.deaths or {},
        statistics = HaleckAccountImporterDB.journal.statistics or {},
    }

    -- 13. Economia de Conta & Alts
    local accountEconomy = { totalGold = 0, sessionDeltaGold = 0, charactersGold = {} }
    if opts.economy ~= false then
        HaleckAccountImporterDB.economy = HaleckAccountImporterDB.economy or { characters = {}, sessionStartingGold = math.floor((GetMoney() or 0) / 10000) }
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
            lastSeen = GetCurrentISODate(),
        }
        for _, c in pairs(HaleckAccountImporterDB.economy.characters) do
            accountEconomy.totalGold = accountEconomy.totalGold + (c.gold or 0)
            table.insert(accountEconomy.charactersGold, c)
        end
        accountEconomy.sessionDeltaGold = currentGold - (HaleckAccountImporterDB.economy.sessionStartingGold or currentGold)
    end

    -- Proteção Especial WoW Forever Beta 16001: Secret Health Values & Dead Secure SNI via pcall
    local charHp = 5000
    local charPower = 100
    local charArmor = 0
    pcall(function()
        charHp = UnitHealthMax("player") or 5000
        charPower = UnitPowerMax("player") or 100
        charArmor = select(2, UnitArmor("player")) or 0
    end)

    -- Snapshot Completo
    local snapshot = {
        exportedAt = GetCurrentISODate(),
        clientVersion = select(4, GetBuildInfo()) or 16001,
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
        inventory = { backpack = backpack, bags = bags },
        stats = {
            health = charHp,
            power = charPower,
            armor = charArmor,
        },
        appearance = appearance,
        collections = {
            mounts = mounts,
            pets = pets,
            toys = toys,
            titles = titles,
            totalMountsCount = #mounts,
            totalPetsCount = #pets,
            totalToysCount = #toys,
            totalTitlesCount = #titles,
        },
        talents = talents,
        professions = professions,
        reputations = reputations,
        bank = HaleckAccountImporterDB.bank or { mainBank = {}, reagentBank = {}, warbandBank = {} },
        accountEconomy = accountEconomy,
        playtime = HaleckAccountImporterDB.playedTime or { totalSeconds = 0, levelSeconds = 0 },
        -- ALLTHETHINGS & DIÁRIO DE AVENTURA CAMPOS NATIVOS
        quests = questData,
        spells = spellData,
        adventureJournal = journalExport,
        nativeStatistics = nativeStats,
        stepCounter = {
            steps = journalExport.statistics.steps or 0,
            distanceYards = journalExport.statistics.distanceYards or 0,
        },
        tradeHistory = HaleckAccountImporterDB.tradeHistory or {},
        wealthHistory = HaleckAccountImporterDB.wealthHistory or {},
        worldBosses = HaleckAccountImporterDB.worldBosses or {},
        pendingChangesCount = #(HaleckAccountImporterDB.pendingChanges or {}),
        sessionStats = HaleckAccountImporterDB.sessionStats or {},
    }

    HaleckAccountImporterDB.lastExport = snapshot
    HaleckAccountImporterDB.snapshot = snapshot
    HaleckAccountImporterDB.character = snapshot.character
    HaleckAccountImporterDB.latestCharacter = charName
    HaleckAccountImporterDB.latestRealm = realmName

    -- Tabela de múltiplos personagens para suporte robusto a alts no mesmo SavedVariables
    HaleckAccountImporterDB.characters = HaleckAccountImporterDB.characters or {}
    local charKey = charName .. "-" .. realmName
    HaleckAccountImporterDB.characters[charKey] = snapshot

    -- Suporte a SavedVariablesPerCharacter
    if type(HaleckAccountImporterCharDB) == "table" then
        HaleckAccountImporterCharDB.lastExport = snapshot
        HaleckAccountImporterCharDB.character = snapshot.character
    end

    table.insert(HaleckAccountImporterDB.history, {
        date = snapshot.exportedAt,
        char = charName .. "-" .. realmName,
        level = level,
        ilvl = eqIlvl,
        steps = journalExport.statistics.steps or 0,
        bosses = journalExport.statistics.totalBossesDefeated or 0,
    })

    return snapshot
end

-- ========================================================================
-- SISTEMA 11: DETECTORES DE WORLD BOSSES DO WOW FOREVER (VANILLA+)
-- ========================================================================
local function CheckWorldBossYell(sender, text)
    if not text then return end
    local lowText = text:lower()
    local lowSender = (sender or ""):lower()

    for key, boss in pairs(VANILLA_WORLD_BOSSES) do
        local matched = false
        if lowSender:find(boss.key) or lowText:find(boss.key) then
            matched = true
        elseif key == "kazzak" and (lowText:find("supreme commander") or lowText:find("mortals will perish") or lowText:find("legion")) then
            matched = true
        elseif key == "azuregos" and (lowText:find("malygos") or lowText:find("arcane secrets") or lowText:find("blue dragonflight")) then
            matched = true
        end

        if matched then
            local currentEpoch = time()
            HaleckAccountImporterDB.worldBosses[key] = {
                id = boss.id,
                name = boss.name,
                zone = boss.zone,
                status = "active",
                spottedAt = GetCurrentTimestamp(),
                spottedEpoch = currentEpoch,
                lastYell = text,
                spottedBy = UnitName("player") or "Player",
            }

            pcall(function() PlaySound(SOUNDKIT and SOUNDKIT.RAID_WARNING or 8959) end)
            print(string.format("|cffff0055[Haleck World Boss Alerta]|r |cffffd100%s|r RUGIU em %s! Chefe de Mundo ativo!", boss.name, boss.zone))

            AddJournalTimelineEntry("boss", "World Boss Ativo: " .. boss.name,
                string.format("%s foi avistado/rugiu em %s!", boss.name, boss.zone),
                "Interface\\Icons\\Spell_Fire_Felfire", HaleckAccountImporterDB.worldBosses[key]
            )

            RecordDelta("world_boss", "spawn_or_yell", HaleckAccountImporterDB.worldBosses[key])
            break
        end
    end
end

local function CheckWorldBossDeath(creatureName)
    if not creatureName then return end
    local lowName = creatureName:lower()

    for key, boss in pairs(VANILLA_WORLD_BOSSES) do
        if lowName:find(boss.key) then
            local currentEpoch = time()
            local minRespawn = currentEpoch + boss.minRespawn
            local maxRespawn = currentEpoch + boss.maxRespawn

            HaleckAccountImporterDB.worldBosses[key] = {
                id = boss.id,
                name = boss.name,
                zone = boss.zone,
                status = "killed",
                killedAt = GetCurrentTimestamp(),
                killedEpoch = currentEpoch,
                respawnMinEpoch = minRespawn,
                respawnMaxEpoch = maxRespawn,
                respawnMinDate = date("%Y-%m-%d %H:%M:%S", minRespawn),
                respawnMaxDate = date("%Y-%m-%d %H:%M:%S", maxRespawn),
                killer = UnitName("player") or "Azeroth Champions",
            }

            pcall(function() PlaySound(SOUNDKIT and SOUNDKIT.UI_BONUS_LOOT_ROLL_END or 841) end)
            print(string.format("|cff00f2fe[Haleck World Boss]|r |cffffd100%s|r foi DERROTADO! Janela de Respawn (72h a 96h) iniciada.", boss.name))

            AddJournalTimelineEntry("boss", "World Boss Derrotado: " .. boss.name,
                string.format("%s foi derrotado em %s! Janela de respawn iniciada.", boss.name, boss.zone),
                "Interface\\Icons\\Spell_Fire_Elemental_Totem", HaleckAccountImporterDB.worldBosses[key]
            )

            RecordDelta("world_boss", "killed", HaleckAccountImporterDB.worldBosses[key])
            break
        end
    end
end

local function CheckTargetWorldBoss(unit)
    if not UnitExists(unit) or UnitIsDead(unit) then return end
    local name = UnitName(unit)
    if not name then return end
    local lowName = name:lower()

    for key, boss in pairs(VANILLA_WORLD_BOSSES) do
        if lowName:find(boss.key) then
            local currentEpoch = time()
            local existing = HaleckAccountImporterDB.worldBosses[key]
            if not existing or existing.status ~= "active" or (currentEpoch - (existing.spottedEpoch or 0)) > 600 then
                HaleckAccountImporterDB.worldBosses[key] = {
                    id = boss.id,
                    name = boss.name,
                    zone = boss.zone,
                    status = "active",
                    spottedAt = GetCurrentTimestamp(),
                    spottedEpoch = currentEpoch,
                    spottedBy = UnitName("player") or "Player",
                }
                print(string.format("|cffff0055[Haleck World Boss]|r |cffffd100%s|r no ALVO em %s!", boss.name, boss.zone))
                RecordDelta("world_boss", "target_spotted", HaleckAccountImporterDB.worldBosses[key])
            end
            break
        end
    end
end

-- ========================================================================
-- SISTEMA 12: DISPATCHER DE EVENTOS DO JOGO (ANTI-TAINT & SECURE SNI)
-- ========================================================================
fCore:SetScript("OnEvent", function(self, event, arg1, arg2, arg3, arg4, arg5)
    if event == "ADDON_LOADED" and arg1 == ADDON_NAME then
        -- Migração de Esquema & Inicialização dos Dados Persistentes
        HaleckAccountImporterDB = HaleckAccountImporterDB or {}
        HaleckAccountImporterDB.version = ADDON_VERSION
        HaleckAccountImporterDB.options = HaleckAccountImporterDB.options or {}
        for k, v in pairs(DEFAULT_OPTIONS) do
            if HaleckAccountImporterDB.options[k] == nil then
                HaleckAccountImporterDB.options[k] = v
            end
        end
        HaleckAccountImporterDB.journal = HaleckAccountImporterDB.journal or {}
        HaleckAccountImporterDB.journal.timeline = HaleckAccountImporterDB.journal.timeline or {}
        HaleckAccountImporterDB.journal.bosses = HaleckAccountImporterDB.journal.bosses or {}
        HaleckAccountImporterDB.journal.companions = HaleckAccountImporterDB.journal.companions or {}
        HaleckAccountImporterDB.journal.exploration = HaleckAccountImporterDB.journal.exploration or {}
        HaleckAccountImporterDB.journal.deaths = HaleckAccountImporterDB.journal.deaths or {}
        HaleckAccountImporterDB.journal.statistics = HaleckAccountImporterDB.journal.statistics or {}
        local s = HaleckAccountImporterDB.journal.statistics
        s.steps = s.steps or 0
        s.distanceYards = s.distanceYards or 0
        s.totalQuestsCompleted = s.totalQuestsCompleted or 0
        s.totalBossesDefeated = s.totalBossesDefeated or 0
        s.totalCompanionsMet = s.totalCompanionsMet or 0
        s.totalDeaths = s.totalDeaths or 0
        HaleckAccountImporterDB.history = HaleckAccountImporterDB.history or {}
        HaleckAccountImporterDB.worldBosses = HaleckAccountImporterDB.worldBosses or {}
        HaleckAccountImporterDB.pendingChanges = HaleckAccountImporterDB.pendingChanges or {}

        -- Executa pipeline de migrações automáticas
        Haleck_RunMigrations()
    elseif event == "PLAYER_LOGIN" then
        EnsureDB()
        EnsureAchievementUI()
        RecordExplorationVisit()
        ScanPartyAndRaidMembers()
        RecordWealthSnapshot()
        BroadcastAddonVersion()
        -- Gera snapshot inicial do personagem na entrada para SavedVariables já conter dados
        pcall(function()
            if C_Timer and C_Timer.After then
                C_Timer.After(2, function() ExportCharacterSnapshot() end)
            else
                ExportCharacterSnapshot()
            end
        end)
        print("|cff00f2fe[Haleck Account Importer v4.3.0]|r Motor ATT, Camada Adaptativa WoW Forever & Diário de Aventura ativos! Digite |cffffcc00/hai|r ou |cffffcc00/diario|r para abrir.")
    elseif event == "PLAYER_LOGOUT" then
        -- No logout, gera o snapshot completo consolidando todos os deltas da sessão
        ExportCharacterSnapshot()
    elseif event == "PLAYER_REGEN_DISABLED" then
        -- Jogador entrou em combate: ativa bloqueio anti-taint
        isInCombat = true
    elseif event == "PLAYER_REGEN_ENABLED" then
        -- Jogador saiu de combate: descarrega buffer de ações represadas com segurança
        isInCombat = false
        while #queuedCombatActions > 0 do
            local action = table.remove(queuedCombatActions, 1)
            pcall(action)
        end
        if queuedUIRequest then
            local req = queuedUIRequest
            queuedUIRequest = nil
            if req == "journal" and _G["HaleckAccountImporter_OpenJournal"] then
                _G["HaleckAccountImporter_OpenJournal"]()
            elseif _G["HaleckAccountImporter_ToggleUI"] then
                _G["HaleckAccountImporter_ToggleUI"]()
            end
        end
    elseif event == "CHAT_MSG_MONSTER_YELL" or event == "CHAT_MSG_MONSTER_EMOTE" then
        local msg, sender = arg1, arg2
        CheckWorldBossYell(sender, msg)
    elseif event == "PLAYER_TARGET_CHANGED" then
        CheckTargetWorldBoss("target")
    elseif event == "UPDATE_MOUSEOVER_UNIT" then
        CheckTargetWorldBoss("mouseover")
    elseif event == "BAG_UPDATE_DELAYED" then
        RecordDelta("inventory", "bags_updated", { timestamp = GetCurrentTimestamp() })
    elseif event == "PLAYER_LEVEL_UP" then
        local newLevel = arg1 or (UnitLevel and UnitLevel("player")) or 1
        local zone = (GetZoneText and GetZoneText()) or ""
        AddJournalTimelineEntry("level", string.format("Alcançou o Nível %d!", newLevel),
            string.format("Ascendeu ao nível %d em %s.", newLevel, zone),
            "Interface\\Icons\\Spell_Holy_InnerFire", { level = newLevel, zone = zone }
        )
        RecordDelta("character", "level_up", { level = newLevel, zone = zone })
    elseif event == "QUEST_ACCEPTED" then
        local qTitle = arg2 or "Nova Missão"
        AddJournalTimelineEntry("quest", "Missão Aceita: " .. tostring(qTitle),
            "Aceitou os termos da jornada.", "Interface\\Icons\\INV_Misc_Book_07"
        )
        RecordDelta("quest", "accepted", { title = qTitle, questId = arg1 })
    elseif event == "QUEST_TURNED_IN" then
        local qId = arg1
        local qTitle = (GetQuestLogTitle and select(1, GetQuestLogTitle(qId))) or ("Missão #" .. tostring(qId or ""))
        local zone = (GetZoneText and GetZoneText()) or ""
        AddJournalTimelineEntry("quest", "Missão Concluída!",
            string.format("Completou com êxito a missão em %s.", zone),
            "Interface\\Icons\\INV_Misc_QuestionMark"
        )
        RecordDelta("quest", "turned_in", { questId = qId, title = qTitle, zone = zone })
    elseif event == "SPELLS_CHANGED" then
        local spellId = arg1
        local sName = (spellId and GetSpellInfo and GetSpellInfo(spellId)) or "Nova Habilidade"
        AddJournalTimelineEntry("spell", "Aprendeu Habilidade: " .. sName,
            "Desbloqueou novos poderes em seu grimório de classe.",
            "Interface\\Icons\\Spell_Holy_MagicalSentry"
        )
        RecordDelta("spell", "learned", { spellId = spellId, name = sName })
    elseif event == "BOSS_KILL" then
        local encounterId = arg1
        local encounterName = arg2 or "Chefe de Raide"
        RecordBossOrRareDefeat(encounterName, false, encounterId)
        CheckWorldBossDeath(encounterName)
        RecordDelta("boss", "killed", { id = encounterId, name = encounterName })
    elseif event == "ENCOUNTER_END" then
        local encounterId, encounterName, difficultyID, groupSize, success = arg1, arg2, arg3, arg4, arg5
        if success == 1 and encounterName then
            RecordBossOrRareDefeat(encounterName, false, encounterId)
            CheckWorldBossDeath(encounterName)
            RecordDelta("encounter", "won", { id = encounterId, name = encounterName })
        end
    elseif event == "COMBAT_LOG_EVENT_UNFILTERED" then
        -- Detecção de Raros e Chefes de Mundo com Verificação de Segurança
        pcall(function()
            if not CombatLogGetCurrentEventInfo then return end
            local timestamp, subevent, hideCaster, sourceGUID, sourceName, sourceFlags, sourceRaidFlags, destGUID, destName, destFlags, destRaidFlags = CombatLogGetCurrentEventInfo()
            if subevent == "UNIT_DIED" and destName then
                CheckWorldBossDeath(destName)
                if UnitExists("target") and UnitName("target") == destName then
                    local classification = UnitClassification("target")
                    if classification == "rare" or classification == "rareelite" then
                        RecordBossOrRareDefeat(destName, true)
                        RecordDelta("rare", "killed", { name = destName, guid = destGUID })
                    end
                end
            end
        end)
    elseif event == "GROUP_ROSTER_UPDATE" then
        ScanPartyAndRaidMembers()
    elseif event == "ZONE_CHANGED_NEW_AREA" or event == "ZONE_CHANGED" then
        RecordExplorationVisit()
        RecordDelta("exploration", "zone_changed", { zone = (GetZoneText and GetZoneText()) or "" })
    elseif event == "PLAYER_DEAD" then
        local subZone = (GetSubZoneText and GetSubZoneText()) or ""
        local zone = (GetZoneText and GetZoneText()) or ""
        local killer = (UnitName and UnitName("target")) or "Inimigo Desconhecido"
        local playerLvl = (UnitLevel and UnitLevel("player")) or 1
        local deathTime = GetCurrentTimestamp()

        local fullZone = zone
        if subZone ~= "" and subZone ~= zone then fullZone = zone .. " (" .. subZone .. ")" end

        local deathObj = {
            id = tostring(time()),
            timestamp = deathTime,
            killerName = killer,
            zone = zone,
            subZone = subZone,
            level = playerLvl,
            lastWords = "Caiu bravamente em combate pela honra de Azeroth."
        }

        table.insert(HaleckAccountImporterDB.journal.deaths, 1, deathObj)
        HaleckAccountImporterDB.journal.statistics.totalDeaths = (HaleckAccountImporterDB.journal.statistics.totalDeaths or 0) + 1

        HaleckAccountImporterDB.deathCertificate = {
            killerName = killer,
            zoneName = zone,
            subZoneText = subZone,
            finalLevel = playerLvl,
            deathDate = deathTime,
            lastWords = deathObj.lastWords
        }

        AddJournalTimelineEntry("death", "Caiu em Combate!",
            string.format("Derrotado por %s em %s no nível %d.", killer, fullZone, playerLvl),
            "Interface\\Icons\\Spell_Shadow_DeathScream", deathObj
        )

        RecordDelta("death", "player_died", deathObj)
        ExportCharacterSnapshot()
    elseif event == "BANKFRAME_OPENED" or event == "BANK_FRAME_OPENED" then
        SerializeBank()
        RecordDelta("bank", "bank_opened", { timestamp = GetCurrentTimestamp() })
    elseif event == "TIME_PLAYED_MSG" then
        local total, level = arg1, arg2
        if total then
            local function FormatTimeStr(secs)
                local d = math.floor(secs / 86400)
                local h = math.floor((secs % 86400) / 3600)
                local m = math.floor((secs % 3600) / 60)
                if d > 0 then return string.format("%dd %dh %dm", d, h, m) end
                return string.format("%dh %dm", h, m)
            end
            HaleckAccountImporterDB.playedTime = {
                totalSeconds = total,
                levelSeconds = level or 0,
                totalFormatted = FormatTimeStr(total),
                levelFormatted = FormatTimeStr(level or 0)
            }
        end
    elseif event == "TRADE_SHOW" then
        StartTradeSession()
    elseif event == "TRADE_UPDATE" or event == "TRADE_TARGET_ITEM_CHANGED" or event == "TRADE_PLAYER_ITEM_CHANGED" or event == "TRADE_MONEY_CHANGED" then
        if not tradeSession then StartTradeSession() end
        UpdateTradeSnapshot()
    elseif event == "TRADE_ACCEPT_UPDATE" then
        if not tradeSession then StartTradeSession() end
        local pAcc, tAcc = arg1, arg2
        tradeSession.playerAccepted = pAcc or 0
        tradeSession.targetAccepted = tAcc or 0
    elseif event == "TRADE_CLOSED" then
        SaveCompletedTrade()
    elseif event == "PLAYER_MONEY" then
        RecordWealthSnapshot()
    elseif event == "CHAT_MSG_ADDON" or event == "CHAT_MSG_ADDON_LOGGED" then
        local prefix, message, channel, sender = arg1, arg2, arg3, arg4
        if prefix == VERSION_PREFIX and message then
            local pToken, kind, remoteVer = tostring(message):match("^(HAI1)|([HR])|(.+)$")
            if pToken == PROTOCOL_MSG and remoteVer and sender ~= UnitName("player") then
                if CompareVersions(CURRENT_ADDON_VERSION, remoteVer) == -1 then
                    if not pendingNewestVersion or CompareVersions(pendingNewestVersion, remoteVer) == -1 then
                        pendingNewestVersion = remoteVer
                        if not isInCombat then
                            print(string.format("|cff00f2fe[Haleck Importer]|r Nova versão disponível! Você usa |cffffcc00v%s|r, e |cff00ff00%s|r possui |cffffd100v%s|r.", CURRENT_ADDON_VERSION, sender, remoteVer))
                        end
                    end
                elseif kind == "H" then
                    if channel == "GUILD" and IsInGuild and IsInGuild() then
                        SendVersionMsg("R", "WHISPER", sender)
                    elseif channel == "PARTY" or channel == "RAID" then
                        SendVersionMsg("R", "WHISPER", sender)
                    end
                end
            end
        end
    end
end)

-- ========================================================================
-- INTERFACE GLOBAL EXPORTADA (FRAMEXML NAMESPACE & GLOBAL ENVIRONMENT)
-- ========================================================================
addon.GenerateSnapshot = ExportCharacterSnapshot
addon.GetJournal = function() return HaleckAccountImporterDB.journal end
addon.GetQuickStats = function()
    local journal = HaleckAccountImporterDB.journal or {}
    local stats = journal.statistics or {}
    return {
        steps = stats.steps or 0,
        distanceYards = stats.distanceYards or 0,
        bosses = stats.totalBossesDefeated or (journal.bosses and (function() local c = 0; for _ in pairs(journal.bosses) do c = c + 1 end return c end)() or 0),
        companions = stats.totalCompanionsMet or (journal.companions and (function() local c = 0; for _ in pairs(journal.companions) do c = c + 1 end return c end)() or 0),
        quests = stats.totalQuestsCompleted or 0,
        deaths = stats.totalDeaths or #(journal.deaths or {}),
        timelineEntries = #(journal.timeline or {}),
        worldBosses = HaleckAccountImporterDB.worldBosses or {},
        pendingChanges = #(HaleckAccountImporterDB.pendingChanges or {}),
    }
end
addon.AddJournalEntry = AddJournalTimelineEntry
addon.RecordDelta = RecordDelta
addon.ExportCompressed = Haleck_ExportCompressed

_G["HaleckAccountImporter_GenerateSnapshot"] = ExportCharacterSnapshot
_G["HaleckAccountImporter_GetJournal"] = addon.GetJournal
_G["HaleckAccountImporter_GetQuickStats"] = addon.GetQuickStats
_G["HaleckAccountImporter_AddJournalEntry"] = AddJournalTimelineEntry
_G["HaleckAccountImporter_RecordDelta"] = RecordDelta
_G["HaleckAccountImporter_UpdateDefinitions"] = Haleck_UpdateDynamicDefinitions
_G["HaleckAccountImporter_RunMigrations"] = Haleck_RunMigrations
_G["HaleckAccountImporter_IsInCombat"] = function() return isInCombat or (InCombatLockdown and InCombatLockdown()) end
_G["HaleckAccountImporter_RunSafeCombat"] = RunSafeCombat

-- Comandos Slash de Inicialização Segura (Fallback Core com InCombatLockdown)
if not SlashCmdList["HALECK"] then
    SLASH_HALECK1 = "/hai"
    SLASH_HALECK2 = "/haleck"
    SLASH_HALECK3 = "/diario"
    SLASH_HALECK4 = "/adventure"
    SLASH_HALECK5 = "/journal"
    SlashCmdList["HALECK"] = function(msg)
        if (InCombatLockdown and InCombatLockdown()) or isInCombat then
            print("|cffff9900[Haleck Importer]|r Você está em combate! A interface abrirá automaticamente assim que o combate terminar.")
            queuedUIRequest = (msg and (msg:lower():find("diario") or msg:lower():find("journal"))) and "journal" or "main"
            return
        end
        if _G["HaleckAccountImporter_ToggleUI"] then
            _G["HaleckAccountImporter_ToggleUI"]()
        else
            local snapshot = ExportCharacterSnapshot()
            print("|cff00f2fe[Haleck Importer]|r Snapshot gerado e salvo em SavedVariables com sucesso!")
        end
    end
end
