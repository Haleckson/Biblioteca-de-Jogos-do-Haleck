--[[
  =============================================================================
  Haleck Account Importer Forever (HAIF)
  Versão: 5.0.0-Forever (World of Warcraft: Forever / Vanilla+ Build 16001)
  Autor: Haleck
  
  Coleta e exporta dados completos de conta e personagens para o Haleck GameLog.
  Inspirado na arquitetura modular do DataStore e Forever Companion.
  Totalmente compatível com o ecossistema WoW Forever (Camelot Engine 1.60.x).
  
  Comandos:
    /haif              - Abre o painel de status e exportação
    /haif scan         - Executa varredura completa imediata de todos os dados
    /haif export       - Gera a carga de dados para cópia manual
    /haif minimap      - Alterna visibilidade do botão do minimapa
  =============================================================================
--]]

local ADDON_NAME = "HaleckAccountImporterForever"
local ADDON_VERSION = "5.0.0-Forever"
local CLIENT_BUILD = "16001"

-- Proteção Anti-Taint e Chamadas Seguras
local function safeCall(fn, ...)
    if type(fn) ~= "function" then return nil end
    local ok, res1, res2, res3, res4, res5 = pcall(fn, ...)
    if ok then return res1, res2, res3, res4, res5 end
    return nil
end

local function canAccess(val)
    if _G.canaccessvalue and type(_G.canaccessvalue) == "function" then
        local ok, accessible = pcall(_G.canaccessvalue, val)
        if ok and accessible == false then return false end
    end
    return true
end

-- Tabela Principal do Addon
local HAIF = {
    name = ADDON_NAME,
    version = ADDON_VERSION,
    clientBuild = CLIENT_BUILD,
    events = {},
    db = nil,
    charKey = nil,
    isScanning = false,
}

-- Inicialização da Base de Dados
function HAIF:InitDB()
    if type(_G.HaleckAccountImporterForeverDB) ~= "table" then
        _G.HaleckAccountImporterForeverDB = {}
    end
    self.db = _G.HaleckAccountImporterForeverDB
    self.db.version = ADDON_VERSION
    self.db.clientBuild = CLIENT_BUILD
    self.db.addon = ADDON_NAME
    self.db.characters = self.db.characters or {}
    self.db.flightNodes = self.db.flightNodes or {}
    self.db.worldBosses = self.db.worldBosses or {}
    self.db.minimapPos = self.db.minimapPos or 220
    self.db.minimapHidden = self.db.minimapHidden or false

    local charName = safeCall(_G.UnitName, "player") or "Unknown"
    local realmName = safeCall(_G.GetRealmName) or "UnknownRealm"
    self.charKey = charName .. " - " .. realmName

    if not self.db.characters[self.charKey] then
        self.db.characters[self.charKey] = {
            name = charName,
            realm = realmName,
            created = time(),
        }
    end
end

-- ============================================================================
-- MÓDULOS DE COLETA DE DADOS (DATASTORE & FOREVER COMPANION STANDARD)
-- ============================================================================

-- 1. IDENTIDADE E PERFIL BÁSICO DO PERSONAGEM
function HAIF:ScanIdentity()
    local char = self.db.characters[self.charKey]
    if not char then return end

    local name = safeCall(_G.UnitName, "player") or char.name
    local realm = safeCall(_G.GetRealmName) or char.realm
    local guid = safeCall(_G.UnitGUID, "player")
    local _, classFile, classID = safeCall(_G.UnitClass, "player")
    local raceName, raceFile, raceID = safeCall(_G.UnitRace, "player")
    local sex = safeCall(_G.UnitSex, "player") -- 2 = Masculino, 3 = Feminino
    local level = safeCall(_G.UnitLevel, "player") or 1
    local xp = safeCall(_G.UnitXP, "player") or 0
    local maxXP = safeCall(_G.UnitXPMax, "player") or 0
    local restXP = safeCall(_G.GetXPExhaustion) or 0
    local money = safeCall(_G.GetMoney) or 0
    local guildName, guildRankName, guildRankIndex = safeCall(_G.GetGuildInfo, "player")
    local zone = safeCall(_G.GetRealZoneText) or ""
    local subZone = safeCall(_G.GetSubZoneText) or ""
    local bindLocation = safeCall(_G.GetBindLocation) or ""

    char.name = name
    char.realm = realm
    char.guid = guid
    char.class = classFile
    char.classID = classID
    char.race = raceFile or raceName
    char.raceID = raceID
    char.gender = (sex == 3) and "Female" or "Male"
    char.level = level
    char.xp = xp
    char.maxXP = maxXP
    char.restXP = restXP
    char.money = money
    char.guild = guildName
    char.guildRank = guildRankName
    char.guildRankIndex = guildRankIndex
    char.zone = zone
    char.subZone = subZone
    char.bindLocation = bindLocation
    char.lastUpdate = time()
    char.isForever = true
    char.clientBuild = CLIENT_BUILD
end

-- 2. EQUIPAMENTOS E NÍVEL DE ITEM (GEAR & INVENTORY SLOTS)
function HAIF:ScanEquipment()
    local char = self.db.characters[self.charKey]
    if not char then return end

    local slotNames = {
        [1] = "Head", [2] = "Neck", [3] = "Shoulder", [4] = "Shirt",
        [5] = "Chest", [6] = "Waist", [7] = "Legs", [8] = "Feet",
        [9] = "Wrist", [10] = "Hands", [11] = "Finger0", [12] = "Finger1",
        [13] = "Trinket0", [14] = "Trinket1", [15] = "Back",
        [16] = "MainHand", [17] = "SecondaryHand", [18] = "Ranged", [19] = "Tabard"
    }

    local gear = {}
    local totalIlvl = 0
    local countedSlots = 0

    for slotID, slotName in pairs(slotNames) do
        local link = safeCall(_G.GetInventoryItemLink, "player", slotID)
        local itemID = safeCall(_G.GetInventoryItemID, "player", slotID)
        local icon = safeCall(_G.GetInventoryItemTexture, "player", slotID)
        local curDur, maxDur = safeCall(_G.GetInventoryItemDurability, slotID)

        if link or itemID then
            local itemName, _, quality, ilvl, reqLevel, itemClass, itemSubClass = nil
            if _G.C_Item and _G.C_Item.GetItemInfo then
                itemName, _, quality, ilvl, reqLevel, itemClass, itemSubClass = safeCall(_G.C_Item.GetItemInfo, link or itemID)
            elseif _G.GetItemInfo then
                itemName, _, quality, ilvl, reqLevel, itemClass, itemSubClass = safeCall(_G.GetItemInfo, link or itemID)
            end

            -- Extrair encanto / gemas do link do item
            local enchantID, gem1, gem2, gem3 = nil, nil, nil, nil
            if link and type(link) == "string" then
                local linkData = link:match("item:([%-?%d:]+)")
                if linkData then
                    local parts = { strsplit(":", linkData) }
                    enchantID = tonumber(parts[2])
                    gem1 = tonumber(parts[3])
                    gem2 = tonumber(parts[4])
                    gem3 = tonumber(parts[5])
                end
            end

            ilvl = tonumber(ilvl) or 0
            if slotID ~= 4 and slotID ~= 19 and ilvl > 0 then
                totalIlvl = totalIlvl + ilvl
                countedSlots = countedSlots + 1
            end

            gear[slotName] = {
                slotID = slotID,
                slotName = slotName,
                itemID = itemID or (link and tonumber(link:match("item:(%d+)"))),
                itemLink = link,
                name = itemName or ("Item #" .. tostring(itemID or slotID)),
                icon = icon,
                quality = quality or 1,
                itemLevel = ilvl,
                reqLevel = reqLevel,
                durability = curDur,
                maxDurability = maxDur,
                enchantID = (enchantID and enchantID > 0) and enchantID or nil,
                gems = (gem1 or gem2 or gem3) and { gem1, gem2, gem3 } or nil,
            }
        end
    end

    local avgIlvl = countedSlots > 0 and math.floor((totalIlvl / countedSlots) * 10) / 10 or 0
    if _G.GetAverageItemLevel then
        local overall, equipped = safeCall(_G.GetAverageItemLevel)
        if equipped and equipped > 0 then avgIlvl = equipped end
    end

    char.gear = gear
    char.averageItemLvl = avgIlvl
end

-- 3. BOLSAS E INVENTÁRIO (CONTAINERS & BAGS 0-4)
function HAIF:ScanBags()
    local char = self.db.characters[self.charKey]
    if not char then return end

    local bags = {}
    local totalFreeSlots = 0
    local totalSlots = 0

    for bagID = 0, 4 do
        local numSlots = 0
        if _G.C_Container and _G.C_Container.GetContainerNumSlots then
            numSlots = safeCall(_G.C_Container.GetContainerNumSlots, bagID) or 0
        elseif _G.GetContainerNumSlots then
            numSlots = safeCall(_G.GetContainerNumSlots, bagID) or 0
        end

        local bagItems = {}
        local freeInBag = 0

        for slot = 1, numSlots do
            local link, itemID, count, icon, quality
            if _G.C_Container and _G.C_Container.GetContainerItemInfo then
                local info = safeCall(_G.C_Container.GetContainerItemInfo, bagID, slot)
                if info then
                    link = info.hyperlink
                    itemID = info.itemID
                    count = info.stackCount
                    icon = info.iconFileID
                    quality = info.quality
                end
            elseif _G.GetContainerItemInfo then
                icon, count, _, quality = safeCall(_G.GetContainerItemInfo, bagID, slot)
                link = safeCall(_G.GetContainerItemLink, bagID, slot)
                if link then itemID = tonumber(link:match("item:(%d+)")) end
            end

            if link or itemID then
                local itemName = nil
                if _G.C_Item and _G.C_Item.GetItemInfo then
                    itemName = safeCall(_G.C_Item.GetItemInfo, link or itemID)
                elseif _G.GetItemInfo then
                    itemName = safeCall(_G.GetItemInfo, link or itemID)
                end

                bagItems[slot] = {
                    slot = slot,
                    itemID = itemID or (link and tonumber(link:match("item:(%d+)"))),
                    itemLink = link,
                    name = itemName,
                    count = count or 1,
                    icon = icon,
                    quality = quality or 1,
                }
            else
                freeInBag = freeInBag + 1
            end
        end

        totalSlots = totalSlots + numSlots
        totalFreeSlots = totalFreeSlots + freeInBag

        bags[bagID] = {
            bagID = bagID,
            numSlots = numSlots,
            freeSlots = freeInBag,
            items = bagItems,
        }
    end

    char.bags = bags
    char.bagStats = {
        totalSlots = totalSlots,
        freeSlots = totalFreeSlots,
        usedSlots = totalSlots - totalFreeSlots,
    }
end

-- 4. BANCO PESSOAL (BANK CONTAINER -1 E BOLSAS 5-11)
function HAIF:ScanBank()
    local char = self.db.characters[self.charKey]
    if not char then return end

    local bankContainers = { -1, 5, 6, 7, 8, 9, 10, 11 }
    local bankData = {}
    local bankItemsCount = 0

    for _, bagID in ipairs(bankContainers) do
        local numSlots = 0
        if _G.C_Container and _G.C_Container.GetContainerNumSlots then
            numSlots = safeCall(_G.C_Container.GetContainerNumSlots, bagID) or 0
        elseif _G.GetContainerNumSlots then
            numSlots = safeCall(_G.GetContainerNumSlots, bagID) or 0
        end

        if numSlots > 0 then
            local slots = {}
            for slot = 1, numSlots do
                local link, itemID, count, icon, quality
                if _G.C_Container and _G.C_Container.GetContainerItemInfo then
                    local info = safeCall(_G.C_Container.GetContainerItemInfo, bagID, slot)
                    if info then
                        link = info.hyperlink
                        itemID = info.itemID
                        count = info.stackCount
                        icon = info.iconFileID
                        quality = info.quality
                    end
                elseif _G.GetContainerItemInfo then
                    icon, count, _, quality = safeCall(_G.GetContainerItemInfo, bagID, slot)
                    link = safeCall(_G.GetContainerItemLink, bagID, slot)
                    if link then itemID = tonumber(link:match("item:(%d+)")) end
                end

                if link or itemID then
                    bankItemsCount = bankItemsCount + 1
                    slots[slot] = {
                        slot = slot,
                        itemID = itemID or (link and tonumber(link:match("item:(%d+)"))),
                        itemLink = link,
                        count = count or 1,
                        icon = icon,
                        quality = quality or 1,
                    }
                end
            end

            bankData[bagID] = {
                bagID = bagID,
                numSlots = numSlots,
                items = slots,
            }
        end
    end

    if bankItemsCount > 0 then
        char.bank = bankData
        char.bankLastScanned = time()
        char.bankTotalItems = bankItemsCount
    end
end

-- 5. ESTATÍSTICAS COMPLETAS (ATRIBUTOS, MELEE, DEFESA, MAGIA, RESISTÊNCIAS)
function HAIF:ScanStats()
    local char = self.db.characters[self.charKey]
    if not char then return end

    -- Verificação de Valores Secretos / Secret Health (Patch 11.0 / 1.60.1)
    if not canAccess(safeCall(_G.UnitStat, "player", 1)) then
        return
    end

    local stats = {}

    -- Saúde e Poder
    stats.health = safeCall(_G.UnitHealth, "player") or 0
    stats.maxHealth = safeCall(_G.UnitHealthMax, "player") or 0
    stats.power = safeCall(_G.UnitPower, "player") or 0
    stats.maxPower = safeCall(_G.UnitPowerMax, "player") or 0
    local pType, pToken = safeCall(_G.UnitPowerType, "player")
    stats.powerType = pToken or pType or "MANA"

    -- Atributos Principais: Força, Agilidade, Vigor, Intelecto, Espírito
    local statKeys = { "strength", "agility", "stamina", "intellect", "spirit" }
    stats.attributes = {}
    for i = 1, 5 do
        local base, stat, posBuff, negBuff = safeCall(_G.UnitStat, "player", i)
        stats.attributes[statKeys[i]] = {
            base = base or 0,
            effective = stat or 0,
            buff = posBuff or 0,
            debuff = negBuff or 0,
        }
    end

    -- Armadura
    local armBase, armEff, armArm, armPos, armNeg = safeCall(_G.UnitArmor, "player")
    stats.armor = {
        base = armBase or 0,
        effective = armEff or 0,
        pos = armPos or 0,
        neg = armNeg or 0,
    }

    -- Ataque Corpo a Corpo (Melee)
    local minDmg, maxDmg, minOffDmg, maxOffDmg, physicalBonusPos, physicalBonusNeg, percentMod = safeCall(_G.UnitDamage, "player")
    local mainSpeed, offSpeed = safeCall(_G.UnitAttackSpeed, "player")
    local baseAP, posAP, negAP = safeCall(_G.UnitAttackPower, "player")
    local critChance = safeCall(_G.GetCritChance) or 0
    local hitRating = safeCall(_G.GetCombatRating, _G.CR_HIT_MELEE or 6) or 0
    local expertise = safeCall(_G.GetExpertise) or 0

    stats.melee = {
        minDamage = minDmg and math.floor(minDmg) or 0,
        maxDamage = maxDmg and math.ceil(maxDmg) or 0,
        speed = mainSpeed and (math.floor(mainSpeed * 100) / 100) or 0,
        attackPower = (baseAP or 0) + (posAP or 0) + (negAP or 0),
        critChance = math.floor(critChance * 100) / 100,
        hitRating = hitRating,
        expertise = expertise,
    }

    -- Ataque à Distância (Ranged)
    local rangedSpeed, minRangedDmg, maxRangedDmg = safeCall(_G.UnitRangedDamage, "player")
    local baseRAP, posRAP, negRAP = safeCall(_G.UnitRangedAttackPower, "player")
    local rangedCrit = safeCall(_G.GetRangedCritChance) or 0

    stats.ranged = {
        minDamage = minRangedDmg and math.floor(minRangedDmg) or 0,
        maxDamage = maxRangedDmg and math.ceil(maxRangedDmg) or 0,
        speed = rangedSpeed and (math.floor(rangedSpeed * 100) / 100) or 0,
        attackPower = (baseRAP or 0) + (posRAP or 0) + (negRAP or 0),
        critChance = math.floor(rangedCrit * 100) / 100,
    }

    -- Defesa e Esquiva / Parada / Bloqueio
    local dodge = safeCall(_G.GetDodgeChance) or 0
    local parry = safeCall(_G.GetParryChance) or 0
    local block = safeCall(_G.GetBlockChance) or 0
    local blockValue = safeCall(_G.GetShieldBlock) or 0
    local defSkill = safeCall(_G.GetCombatRating, _G.CR_DEFENSE_SKILL or 2) or 0

    stats.defense = {
        dodgeChance = math.floor(dodge * 100) / 100,
        parryChance = math.floor(parry * 100) / 100,
        blockChance = math.floor(block * 100) / 100,
        blockValue = blockValue,
        defenseSkill = defSkill,
    }

    -- Magias, Poder Mágico e Cura (Spell Schools: 1=Physical, 2=Holy, 3=Fire, 4=Nature, 5=Frost, 6=Shadow, 7=Arcane)
    local spellSchools = { "Holy", "Fire", "Nature", "Frost", "Shadow", "Arcane" }
    local spellBonusDamage = {}
    local spellCritChance = {}
    for i = 1, 6 do
        local bonus = safeCall(_G.GetSpellBonusDamage, i + 1) or 0
        local crit = safeCall(_G.GetSpellCritChance, i + 1) or 0
        spellBonusDamage[spellSchools[i]] = bonus
        spellCritChance[spellSchools[i]] = math.floor(crit * 100) / 100
    end
    local healingBonus = safeCall(_G.GetSpellBonusHealing) or 0
    local manaRegenBase, manaRegenCasting = safeCall(_G.GetManaRegen)

    stats.spell = {
        bonusDamage = spellBonusDamage,
        healingBonus = healingBonus,
        critChance = spellCritChance,
        manaRegenBase = manaRegenBase and math.floor(manaRegenBase) or 0,
        manaRegenCasting = manaRegenCasting and math.floor(manaRegenCasting) or 0,
    }

    -- Resistências (0=Armadura, 1=Holy, 2=Fire, 3=Nature, 4=Frost, 5=Shadow, 6=Arcane)
    local resistances = {}
    for i = 1, 6 do
        local base, total, bonus, minus = safeCall(_G.UnitResistance, "player", i)
        resistances[spellSchools[i]] = {
            base = base or 0,
            total = total or 0,
            bonus = bonus or 0,
            penalty = minus or 0,
        }
    end
    stats.resistances = resistances

    char.stats = stats
end

-- 6. TALENTOS E ÁRVORES DE HABILIDADE (TALENTS & SPEC)
function HAIF:ScanTalents()
    local char = self.db.characters[self.charKey]
    if not char then return end

    local numTabs = safeCall(_G.GetNumTalentTabs) or 3
    local talentTrees = {}
    local pointBreakdown = {}
    local allLearnedTalents = {}

    for tabIndex = 1, numTabs do
        local tabName, tabIcon, pointsSpent, background = safeCall(_G.GetTalentTabInfo, tabIndex)
        pointsSpent = pointsSpent or 0
        table.insert(pointBreakdown, pointsSpent)

        local talentsInTab = {}
        local numTalents = safeCall(_G.GetNumTalents, tabIndex) or 0

        for talentIndex = 1, numTalents do
            local name, icon, tier, column, currentRank, maxRank = safeCall(_G.GetTalentInfo, tabIndex, talentIndex)
            if name and currentRank and currentRank > 0 then
                local talentInfo = {
                    name = name,
                    icon = icon,
                    tier = tier,
                    column = column,
                    rank = currentRank,
                    maxRank = maxRank,
                    tab = tabIndex,
                }
                table.insert(talentsInTab, talentInfo)
                table.insert(allLearnedTalents, talentInfo)
            end
        end

        talentTrees[tabIndex] = {
            name = tabName or ("Tree " .. tabIndex),
            icon = tabIcon,
            pointsSpent = pointsSpent,
            talents = talentsInTab,
        }
    end

    local specString = table.concat(pointBreakdown, "/")
    char.talents = {
        specString = specString,
        trees = talentTrees,
        learnedTalents = allLearnedTalents,
    }
end

-- 7. PROFISSÕES, PERÍCIAS E RECEITAS (SKILLS & CRAFTS)
function HAIF:ScanSkills()
    local char = self.db.characters[self.charKey]
    if not char then return end

    local professions = {}
    local weaponSkills = {}
    local numSkills = safeCall(_G.GetNumSkillLines) or 0

    local currentHeader = nil
    for i = 1, numSkills do
        local skillName, isHeader, isExpanded, skillRank, numTempPoints, skillModifier, skillMaxRank, isAbandonable, stepCost, rankCost, minLevel, skillCostType = safeCall(_G.GetSkillLineInfo, i)
        if skillName then
            if isHeader then
                currentHeader = skillName
            else
                local entry = {
                    name = skillName,
                    rank = skillRank or 0,
                    maxRank = skillMaxRank or 0,
                    category = currentHeader or "Geral",
                }
                if currentHeader == "Profissões" or currentHeader == "Profissões Secundárias" or currentHeader == "Professions" or currentHeader == "Secondary Professions" then
                    table.insert(professions, entry)
                else
                    table.insert(weaponSkills, entry)
                end
            end
        end
    end

    char.skills = {
        professions = professions,
        weaponSkills = weaponSkills,
    }
end

-- 8. MISSÕES COMPLETAS, ATIVAS E PONTOS DE VÔO (QUESTS & FLIGHT PATHS)
function HAIF:ScanQuests()
    local char = self.db.characters[self.charKey]
    if not char then return end

    char.completedQuests = char.completedQuests or {}

    -- Obter lista de missões concluídas da API moderna ou legada
    if _G.C_QuestLog and _G.C_QuestLog.GetAllCompletedQuestIDs then
        local qList = safeCall(_G.C_QuestLog.GetAllCompletedQuestIDs)
        if type(qList) == "table" then
            for _, qID in ipairs(qList) do
                char.completedQuests[qID] = true
            end
        end
    elseif _G.GetQuestsCompleted then
        local qTable = {}
        safeCall(_G.GetQuestsCompleted, qTable)
        if type(qTable) == "table" then
            for qID, status in pairs(qTable) do
                if status == true then char.completedQuests[qID] = true end
            end
        end
    end

    -- Missões ativas no diário de missões (Quest Log)
    local activeQuests = {}
    local numEntries = safeCall(_G.GetNumQuestLogEntries) or 0
    for i = 1, numEntries do
        local title, level, tag, isHeader, isCollapsed, isComplete, frequency, questID = safeCall(_G.GetQuestLogTitle, i)
        if title and not isHeader and questID and questID > 0 then
            local objectives = {}
            local numLeaderBoards = safeCall(_G.GetNumQuestLeaderBoards, i) or 0
            for objIdx = 1, numLeaderBoards do
                local text, objType, finished = safeCall(_G.GetQuestLogLeaderBoard, objIdx, i)
                table.insert(objectives, { text = text, type = objType, finished = finished and true or false })
            end
            table.insert(activeQuests, {
                questID = questID,
                title = title,
                level = level,
                isComplete = isComplete == 1,
                objectives = objectives,
            })
        end
    end
    char.activeQuests = activeQuests

    -- Pontos de Voo (Flight Paths) conhecidos
    char.flightPaths = char.flightPaths or {}
    if _G.GetNumRoutes and _G.GetNumRoutes() > 0 then
        -- Se o mapa de voo estiver aberto, grava todos os nós conectados
        for nodeIndex = 1, 100 do
            local name = safeCall(_G.TaxiNodeName, nodeIndex)
            local nodeType = safeCall(_G.TaxiNodeType, nodeIndex)
            if name and nodeType and nodeType ~= "NONE" then
                char.flightPaths[nodeIndex] = { name = name, type = nodeType }
                self.db.flightNodes[nodeIndex] = name
            end
        end
    end
end

-- 9. CHEFES MUNDIAIS E MARCOS DE PROGRESSÃO (WORLD BOSSES & MILESTONES)
function HAIF:ScanWorldBossesAndMilestones()
    local char = self.db.characters[self.charKey]
    if not char then return end

    -- Chefes Mundiais Canônicos do WoW Forever (Vanilla+)
    -- Lord Kazzak (12397), Azuregos (6109), Dragões do Pesadelo (Lethon 14888, Emeriss 14889, Taerar 14890, Ysondre 14887)
    char.worldBosses = char.worldBosses or {}
    char.rareKills = char.rareKills or {}

    -- Verificar bloqueios de instâncias salvos (Raid & Dungeon Lockouts)
    local lockouts = {}
    local numSaved = safeCall(_G.GetNumSavedInstances) or 0
    for i = 1, numSaved do
        local name, id, reset, difficulty, locked, extended, isRaid, maxPlayers, diffName, numEncounters, encProgress = safeCall(_G.GetSavedInstanceInfo, i)
        if name and locked then
            table.insert(lockouts, {
                name = name,
                instanceID = id,
                reset = reset,
                isRaid = isRaid,
                numEncounters = numEncounters,
                progress = encProgress,
            })
        end
    end
    char.lockouts = lockouts
end

-- 10. REPUTAÇÕES E FACÇÕES
function HAIF:ScanReputations()
    local char = self.db.characters[self.charKey]
    if not char then return end

    local reputations = {}
    local numFactions = safeCall(_G.GetNumFactions) or 0
    local standingLabels = {
        [1] = "Odiado", [2] = "Hostil", [3] = "Inamistoso", [4] = "Neutro",
        [5] = "Tolerado", [6] = "Honrado", [7] = "Reverenciado", [8] = "Exaltado"
    }

    for i = 1, numFactions do
        local name, desc, standingID, barMin, barMax, barVal, atWar, canToggleAtWar, isHeader, isCollapsed, hasRep = safeCall(_G.GetFactionInfo, i)
        if name and not isHeader then
            table.insert(reputations, {
                name = name,
                standingID = standingID or 4,
                standingLabel = standingLabels[standingID] or "Neutro",
                min = barMin or 0,
                max = barMax or 0,
                current = barVal or 0,
            })
        end
    end

    char.reputations = reputations
end

-- 11. COLEÇÕES (MONTARIAS, MASCOTES E TÍTULOS)
function HAIF:ScanCollections()
    local char = self.db.characters[self.charKey]
    if not char then return end

    -- Montarias
    local mounts = {}
    if _G.C_MountJournal and _G.C_MountJournal.GetMountIDs then
        local mountIDs = safeCall(_G.C_MountJournal.GetMountIDs) or {}
        for _, mID in ipairs(mountIDs) do
            local name, spellID, icon, _, isUsable, _, _, isFactionSpecific, faction, _, isCollected = safeCall(_G.C_MountJournal.GetMountInfoByID, mID)
            if isCollected then
                table.insert(mounts, { id = mID, spellID = spellID, name = name, icon = icon })
            end
        end
    end
    char.mounts = mounts

    -- Mascotes
    local pets = {}
    if _G.C_PetJournal and _G.C_PetJournal.GetNumPets then
        local numPets = safeCall(_G.C_PetJournal.GetNumPets) or 0
        for i = 1, math.min(numPets, 200) do
            local petID, speciesID, owned, customName, level, favorite, isRevoked, speciesName, icon = safeCall(_G.C_PetJournal.GetPetInfoByIndex, i)
            if owned and speciesName then
                table.insert(pets, { speciesID = speciesID, name = speciesName, icon = icon, level = level })
            end
        end
    end
    char.pets = pets

    -- Títulos Conhecidos
    local titles = {}
    local numTitles = safeCall(_G.GetNumTitles) or 0
    for i = 1, numTitles do
        local titleName = safeCall(_G.GetTitleName, i)
        local isKnown = safeCall(_G.IsTitleKnown, i)
        if titleName and isKnown then
            table.insert(titles, titleName:trim())
        end
    end
    char.titles = titles
end

-- 12. PVP & ESTATÍSTICAS VITAIS
function HAIF:ScanPvP()
    local char = self.db.characters[self.charKey]
    if not char then return end

    local hk, maxRank = safeCall(_G.GetPVPLifetimeStats)
    local honorPoints = safeCall(_G.GetHonorCurrency) or 0
    local pvpRankName, pvpRankNumber = safeCall(_G.GetPVPRankInfo, maxRank or 0)

    char.pvp = {
        honorableKills = hk or 0,
        lifetimeMaxRank = maxRank or 0,
        rankName = pvpRankName or "Nenhum",
        rankNumber = pvpRankNumber or 0,
        honorPoints = honorPoints,
    }
end

-- 13. APARÊNCIA, CUSTOMIZAÇÃO VISUAL E TRANSMOG (APPEARANCE & VISUALS)
function HAIF:ScanAppearance()
    local char = self.db.characters[self.charKey]
    if not char then return end

    local appearance = {}

    -- Dados do Barber Shop / Customização de Criação de Personagem
    if _G.C_BarberShop and _G.C_BarberShop.GetCurrentCharacterData then
        local bData = safeCall(_G.C_BarberShop.GetCurrentCharacterData)
        if bData then appearance.barberData = bData end
    end

    -- Aparências visuais de transmog por slot de equipamento
    local itemAppearances = {}
    local visualSlots = { 1, 3, 4, 5, 6, 7, 8, 9, 10, 15, 16, 17, 18, 19 }
    for _, slotID in ipairs(visualSlots) do
        if _G.C_Transmog and _G.C_Transmog.GetSlotInfo then
            local isTransmog, _, _, _, _, appearanceID = safeCall(_G.C_Transmog.GetSlotInfo, slotID, 0)
            if appearanceID and appearanceID > 0 then
                itemAppearances[slotID] = {
                    appearanceID = appearanceID,
                    isTransmog = isTransmog and true or false,
                }
            end
        end
    end
    appearance.itemAppearances = itemAppearances
    char.appearance = appearance
end

-- ============================================================================
-- COORDENADOR DE VARREDURA COMPLETA (FULL SCANNER)
-- ============================================================================
function HAIF:ScanAll(silent)
    if self.isScanning then return end
    self.isScanning = true

    self:InitDB()
    self:ScanIdentity()
    self:ScanEquipment()
    self:ScanBags()
    self:ScanBank()
    self:ScanStats()
    self:ScanTalents()
    self:ScanSkills()
    self:ScanQuests()
    self:ScanWorldBossesAndMilestones()
    self:ScanReputations()
    self:ScanCollections()
    self:ScanPvP()
    self:ScanAppearance()

    -- Calcular ouro total da conta somando todos os personagens
    local totalGold = 0
    local charCount = 0
    for _, c in pairs(self.db.characters) do
        if c.money and type(c.money) == "number" then
            totalGold = totalGold + c.money
        end
        charCount = charCount + 1
    end
    self.db.totalAccountGold = totalGold
    self.db.totalCharacters = charCount
    self.db.lastExport = time()

    self.isScanning = false

    if not silent then
        print("|cff00e5ff[HAIF Forever]|r Varredura de dados concluída com sucesso! Personagem: |cffffd100" .. tostring(self.charKey) .. "|r (" .. tostring(charCount) .. " personagem(ns) na conta).")
    end
end

-- ============================================================================
-- GERADOR DE PAYLOAD COMPACTADO PARA EXPORTAÇÃO MANUAL
-- ============================================================================
local function serializeTable(val)
    local t = type(val)
    if t == "number" or t == "boolean" then
        return tostring(val)
    elseif t == "string" then
        return string.format("%q", val)
    elseif t == "table" then
        local parts = {}
        for k, v in pairs(val) do
            local kStr = type(k) == "number" and ("[" .. k .. "]") or ("[" .. string.format("%q", tostring(k)) .. "]")
            table.insert(parts, kStr .. "=" .. serializeTable(v))
        end
        return "{" .. table.concat(parts, ",") .. "}"
    end
    return "nil"
end

function HAIF:GenerateExportPayload()
    self:ScanAll(true)
    local payload = {
        addon = ADDON_NAME,
        version = ADDON_VERSION,
        clientBuild = CLIENT_BUILD,
        exportedAt = time(),
        activeChar = self.charKey,
        characters = self.db.characters,
        totalAccountGold = self.db.totalAccountGold,
    }
    return "HAIF_DATA:" .. serializeTable(payload)
end

-- ============================================================================
-- INTERFACE GRÁFICA IN-GAME (POPUP MODERNO ESCURO/CYAN)
-- ============================================================================
local mainFrame = nil

function HAIF:ToggleUI()
    if mainFrame and mainFrame:IsShown() then
        mainFrame:Hide()
        return
    end

    if not mainFrame then
        local f = CreateFrame("Frame", "HAIF_MainDialog", UIParent, "BackdropTemplate")
        f:SetSize(480, 420)
        f:SetPoint("CENTER")
        f:SetFrameStrata("DIALOG")
        f:SetMovable(true)
        f:EnableMouse(true)
        f:RegisterForDrag("LeftButton")
        f:SetScript("OnDragStart", f.StartMoving)
        f:SetScript("OnDragStop", f.StopMovingOrSizing)

        f:SetBackdrop({
            bgFile = "Interface\\Buttons\\WHITE8X8",
            edgeFile = "Interface\\Buttons\\WHITE8X8",
            edgeSize = 2,
            insets = { left = 2, right = 2, top = 2, bottom = 2 }
        })
        f:SetBackdropColor(0.04, 0.06, 0.12, 0.96)
        f:SetBackdropBorderColor(0, 0.9, 1, 0.8)

        -- Cabeçalho
        local title = f:CreateFontString(nil, "OVERLAY", "GameFontHighlightLarge")
        title:SetPoint("TOPLEFT", 18, -16)
        title:SetText("|cff00e5ffHaleck Account Importer|r |cffd8b25cForever|r")

        local sub = f:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
        sub:SetPoint("TOPLEFT", 18, -38)
        sub:SetText("|cff8899aaWoW Forever (Vanilla+ Build 16001) • v" .. ADDON_VERSION .. "|r")

        -- Resumo do Personagem Ativo
        local statusText = f:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
        statusText:SetPoint("TOPLEFT", 18, -64)
        statusText:SetPoint("TOPRIGHT", -18, -64)
        statusText:SetJustifyH("LEFT")
        f.statusText = statusText

        -- Caixa de Texto de Exportação (EditBox com Scroll)
        local editBoxContainer = CreateFrame("ScrollFrame", "HAIF_ExportScroll", f, "UIPanelScrollFrameTemplate")
        editBoxContainer:SetPoint("TOPLEFT", 18, -120)
        editBoxContainer:SetPoint("BOTTOMRIGHT", -36, 60)

        local editBox = CreateFrame("EditBox", nil, editBoxContainer)
        editBox:SetMultiLine(true)
        editBox:SetFontObject("GameFontHighlightSmall")
        editBox:SetWidth(420)
        editBox:SetAutoFocus(false)
        editBoxContainer:SetScrollChild(editBox)
        f.editBox = editBox

        editBox:SetScript("OnEscapePressed", function() editBox:ClearFocus() end)

        -- Botão: Forçar Varredura (Scan)
        local btnScan = CreateFrame("Button", nil, f, "UIPanelButtonTemplate")
        btnScan:SetSize(130, 30)
        btnScan:SetPoint("BOTTOMLEFT", 18, 16)
        btnScan:SetText("Coletar Dados")
        btnScan:SetScript("OnClick", function()
            HAIF:ScanAll(false)
            HAIF:UpdateUI()
        end)

        -- Botão: Gerar Payload de Exportação
        local btnExport = CreateFrame("Button", nil, f, "UIPanelButtonTemplate")
        btnExport:SetSize(140, 30)
        btnExport:SetPoint("LEFT", btnScan, "RIGHT", 10)
        btnExport:SetText("Gerar Cópia")
        btnExport:SetScript("OnClick", function()
            local payload = HAIF:GenerateExportPayload()
            editBox:SetText(payload)
            editBox:HighlightText()
            editBox:SetFocus()
            print("|cff00e5ff[HAIF Forever]|r Dados gerados na caixa de texto. Pressione Ctrl+C para copiar!")
        end)

        -- Botão: Fechar
        local btnClose = CreateFrame("Button", nil, f, "UIPanelButtonTemplate")
        btnClose:SetSize(90, 30)
        btnClose:SetPoint("BOTTOMRIGHT", -18, 16)
        btnClose:SetText("Fechar")
        btnClose:SetScript("OnClick", function() f:Hide() end)

        mainFrame = f
    end

    self:UpdateUI()
    mainFrame:Show()
end

function HAIF:UpdateUI()
    if not mainFrame then return end
    local char = self.db.characters[self.charKey] or {}
    local gold = math.floor((char.money or 0) / 10000)
    local charCount = self.db.totalCharacters or 1
    local lastTime = self.db.lastExport and date("%d/%m/%Y %H:%M:%S", self.db.lastExport) or "Nunca"

    local summary = string.format(
        "|cffffffffPersonagem:|r |cff00e5ff%s|r (%s - Nível %d)\n|cffffffffOuro:|r |cffffd100%dg|r  •  |cffffffffTotal na Conta:|r |cff00ff88%d herói(s)|r\n|cffffffffÚltima Coleta:|r |cff8899aa%s|r",
        tostring(self.charKey),
        tostring(char.class or "Desconhecido"),
        tonumber(char.level or 1),
        gold,
        charCount,
        lastTime
    )
    mainFrame.statusText:SetText(summary)
    mainFrame.editBox:SetText(
        "-- Clique em [Gerar Cópia] para obter o texto de sincronização manual, ou utilize a importação direta da pasta WTF no site!"
    )
end

-- ============================================================================
-- BOTÃO DO MINIMAPA (COMPATÍVEL COM ELLESMERE UI, GAVETAS E ADDON COMPARTMENT)
-- ============================================================================
local function createMinimapButton()
    local btn = CreateFrame("Button", "HaleckAccountImporterForeverMinimapBtn", Minimap)
    btn:SetSize(31, 31)
    btn:SetFrameStrata("MEDIUM")
    btn:SetFrameLevel(8)
    btn:SetMovable(true)

    -- Textura do ícone
    local icon = btn:CreateTexture(nil, "BACKGROUND")
    icon:SetSize(20, 20)
    icon:SetPoint("CENTER", 0, 0)
    icon:SetTexture("Interface\\Icons\\INV_Misc_Rune_01")
    btn.icon = icon

    -- Borda circular padrão Blizzard
    local border = btn:CreateTexture(nil, "OVERLAY")
    border:SetSize(53, 53)
    border:SetPoint("TOPLEFT", 0, 0)
    border:SetTexture("Interface\\Minimap\\MiniMap-TrackingBorder")
    btn.border = border

    -- Posicionamento angular em volta do Minimapa
    local function updatePosition(angle)
        local rad = math.rad(angle)
        local cos, sin = math.cos(rad), math.sin(rad)
        local cx, cy = Minimap:GetWidth() / 2, Minimap:GetHeight() / 2
        btn:SetPoint("CENTER", Minimap, "CENTER", cos * (cx + 10), sin * (cy + 10))
    end

    btn:RegisterForClicks("LeftButtonUp", "RightButtonUp")
    btn:RegisterForDrag("LeftButton")

    btn:SetScript("OnDragStart", function()
        btn.isDragging = true
        btn:SetScript("OnUpdate", function()
            local mx, my = Minimap:GetCenter()
            local px, py = GetCursorPosition()
            local scale = Minimap:GetEffectiveScale()
            px, py = px / scale, py / scale
            local angle = math.deg(math.atan2(py - my, px - mx))
            if angle < 0 then angle = angle + 360 end
            HAIF.db.minimapPos = angle
            updatePosition(angle)
        end)
    end)

    btn:SetScript("OnDragStop", function()
        btn.isDragging = false
        btn:SetScript("OnUpdate", nil)
    end)

    btn:SetScript("OnClick", function(_, button)
        if button == "RightButton" then
            HAIF:ScanAll(false)
        else
            HAIF:ToggleUI()
        end
    end)

    btn:SetScript("OnEnter", function()
        GameTooltip:SetOwner(btn, "ANCHOR_LEFT")
        GameTooltip:AddLine("|cff00e5ffHaleck Account Importer|r |cffd8b25cForever|r")
        GameTooltip:AddLine("Exportador de conta e personagens para WoW Forever.", 1, 1, 1)
        GameTooltip:AddLine(" ")
        GameTooltip:AddLine("|cff00ff88Clique Esquerdo:|r Abrir Painel de Status e Exportação", 0.8, 0.8, 0.8)
        GameTooltip:AddLine("|cff00ff88Clique Direito:|r Forçar Varredura Completa Imediata", 0.8, 0.8, 0.8)
        GameTooltip:AddLine("|cff888888Arraste para mover pelo minimapa|r", 0.6, 0.6, 0.6)
        GameTooltip:Show()
    end)

    btn:SetScript("OnLeave", function()
        GameTooltip:Hide()
    end)

    updatePosition(HAIF.db.minimapPos or 220)
    if HAIF.db.minimapHidden then btn:Hide() else btn:Show() end
    return btn
end

-- Handlers Oficiais do Addon Compartment (Blizzard 10.0+ e EllesmereUI Drawer)
function _G.HaleckAccountImporterForever_OnAddonCompartmentClick(addonName, button)
    if button == "RightButton" then
        HAIF:ScanAll(false)
    else
        HAIF:ToggleUI()
    end
end

function _G.HaleckAccountImporterForever_OnAddonCompartmentEnter(addonName, menuButton)
    GameTooltip:SetOwner(menuButton, "ANCHOR_RIGHT")
    GameTooltip:AddLine("|cff00e5ffHaleck Account Importer|r |cffd8b25cForever|r")
    GameTooltip:AddLine("Sincronizador e exportador de conta para WoW Forever.", 1, 1, 1)
    GameTooltip:AddLine("|cff00ff88Clique:|r Abrir Painel de Controle e Exportação")
    GameTooltip:Show()
end

function _G.HaleckAccountImporterForever_OnAddonCompartmentLeave(addonName, menuButton)
    GameTooltip:Hide()
end

-- ============================================================================
-- COMANDOS DE BARRA (SLASH COMMANDS)
-- ============================================================================
SLASH_HAIF1 = "/haif"
SLASH_HAIF2 = "/haiforever"
SLASH_HAIF3 = "/foreverimporter"

SlashCmdList["HAIF"] = function(msg)
    local cmd = (msg or ""):trim():lower()
    if cmd == "scan" then
        HAIF:ScanAll(false)
    elseif cmd == "export" then
        HAIF:ToggleUI()
        local payload = HAIF:GenerateExportPayload()
        if mainFrame and mainFrame.editBox then
            mainFrame.editBox:SetText(payload)
            mainFrame.editBox:HighlightText()
            mainFrame.editBox:SetFocus()
        end
    elseif cmd == "minimap" then
        HAIF.db.minimapHidden = not HAIF.db.minimapHidden
        local btn = _G["HaleckAccountImporterForeverMinimapBtn"]
        if btn then
            if HAIF.db.minimapHidden then btn:Hide() else btn:Show() end
        end
        print("|cff00e5ff[HAIF Forever]|r Botão do minimapa: " .. (HAIF.db.minimapHidden and "Oculto" or "Visível"))
    else
        HAIF:ToggleUI()
    end
end

-- ============================================================================
-- EVENTOS DO JOGO (GAME EVENTS)
-- ============================================================================
local eventFrame = CreateFrame("Frame")
eventFrame:RegisterEvent("PLAYER_LOGIN")
eventFrame:RegisterEvent("PLAYER_ENTERING_WORLD")
eventFrame:RegisterEvent("PLAYER_LEAVING_WORLD")
eventFrame:RegisterEvent("PLAYER_LOGOUT")
eventFrame:RegisterEvent("PLAYER_XP_UPDATE")
eventFrame:RegisterEvent("PLAYER_LEVEL_UP")
eventFrame:RegisterEvent("PLAYER_MONEY")
eventFrame:RegisterEvent("BAG_UPDATE_DELAYED")
eventFrame:RegisterEvent("BANKFRAME_OPENED")
eventFrame:RegisterEvent("CHARACTER_POINTS_CHANGED")
eventFrame:RegisterEvent("SKILL_LINES_CHANGED")
eventFrame:RegisterEvent("QUEST_TURNED_IN")
eventFrame:RegisterEvent("QUEST_LOG_UPDATE")
eventFrame:RegisterEvent("UPDATE_FACTION")

local lastBagUpdate = 0
eventFrame:SetScript("OnEvent", function(self, event, ...)
    if event == "PLAYER_LOGIN" then
        HAIF:InitDB()
        createMinimapButton()
        C_Timer.After(3, function()
            HAIF:ScanAll(true)
        end)
    elseif event == "PLAYER_ENTERING_WORLD" then
        HAIF:InitDB()
        C_Timer.After(2, function()
            HAIF:ScanIdentity()
            HAIF:ScanEquipment()
        end)
    elseif event == "BAG_UPDATE_DELAYED" then
        local now = GetTime()
        if now - lastBagUpdate > 1.5 then
            lastBagUpdate = now
            HAIF:ScanBags()
            HAIF:ScanEquipment()
        end
    elseif event == "BANKFRAME_OPENED" then
        HAIF:ScanBank()
    elseif event == "PLAYER_MONEY" or event == "PLAYER_XP_UPDATE" or event == "PLAYER_LEVEL_UP" then
        HAIF:ScanIdentity()
    elseif event == "CHARACTER_POINTS_CHANGED" then
        HAIF:ScanTalents()
    elseif event == "SKILL_LINES_CHANGED" then
        HAIF:ScanSkills()
    elseif event == "QUEST_TURNED_IN" or event == "QUEST_LOG_UPDATE" then
        HAIF:ScanQuests()
    elseif event == "UPDATE_FACTION" then
        HAIF:ScanReputations()
    elseif event == "PLAYER_LOGOUT" or event == "PLAYER_LEAVING_WORLD" then
        HAIF:ScanAll(true)
    end
end)
