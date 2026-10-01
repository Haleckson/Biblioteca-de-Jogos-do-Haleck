-- ========================================================================
--  HALECK ACCOUNT IMPORTER - INTERFACE GRÁFICA IN-GAME (UI DUAL-CATEGORY)
--  Arquivo: AddonInterface.lua
--  Versão: 4.0.0 (ATT-Grade Engine & Meu Diário de Aventura)
--  Compatibilidade Universal: WoW Forever (16001), Classic Era (11506) & Retail
--
--  Identidade Visual Autêntica de World of Warcraft:
--  - Moldura com Chanfro Dourado e FundoArdósia Clássico
--  - Botão de Fechar Canônico Blizzard ("UIPanelCloseButton")
--  - Sons de Interface Oficiais (SOUNDKIT.IG_MAINMENU_OPTION_CHECKBOX_ON)
--  - Botão de Minimapa com Rotação Radial 360°
--  - Duas Categorias Principais:
--    1. Central de Extração & Parâmetros (Seleção Granular & Snapshot)
--    2. Meu Diário de Aventura (Linha do Tempo, Chefes, Passos, Grupos, Mortes, Feitos e Estatísticas do Jogo)
-- ========================================================================

local ADDON_NAME, addon = ...
ADDON_NAME = ADDON_NAME or "HaleckAccountImporter"
addon = addon or {}
local MainWindow = nil
local CurrentTab = 1 -- 1 = Central de Extração, 2 = Diário de Aventura
local CurrentJournalSubcat = 1 -- 1 = Timeline, 2 = Chefes, 3 = Exploração, 4 = Companheiros, 5 = Resumo, 6 = Mortes, 7 = Feitos, 8 = Stats do Jogo
local JournalSearchQuery = ""

-- Suporte Multi-Versão Seguro para BackdropTemplate
-- Evita crashes em clientes legados onde BackdropTemplateMixin não existe
local BACKDROP_TEMPLATE = (BackdropTemplateMixin and "BackdropTemplate") or nil

-- Definição dos Parâmetros Granulares Disponíveis para Extração
local PARAMETERS = {
    -- 1. Identidade & Visual 3D
    { key = "charInfo", cat = "IDENTIDADE", title = "Informações Básicas & Nível", desc = "Nome, Reino, Nível, Classe, Raça, Gênero, Facção e Guilda." },
    { key = "appearance", cat = "VISUAL 3D", title = "Aparência 3D & Barbearia", desc = "Rosto, Cabelo, Barba, Pele e Customizações para o Visualizador 3D." },
    { key = "equippedGear", cat = "EQUIPAMENTO", title = "Itens Equipados (19 Slots)", desc = "Equipamento ativo, Nível de Item (iLvl), Durabilidade e Encantamentos." },
    { key = "allItemIds", cat = "BANCO DE IDs", title = "Mapeamento Universal de Display IDs", desc = "Relação canônica de Item ID <-> 3D Display ID para o banco DB2." },
    { key = "transmogs", cat = "VISUAL 3D", title = "Aparências de Transmog & Ilusões", desc = "Transmogs conhecidos, armas, ombreiras e ilusões visuais ativas." },

    -- 2. Quests & Missões (ATT Grade)
    { key = "questsCompleted", cat = "MISSÕES", title = "Quests Concluídas (ATT Scan)", desc = "Scan completo de todas as missões finalizadas na história do personagem." },
    { key = "questsActive", cat = "MISSÕES", title = "Quests Ativas no Quest Log", desc = "Missões em andamento nas diversas zonas de Azeroth e status de objetivos." },

    -- 3. Grimório, Magias & Voos (ATT Grade)
    { key = "spells", cat = "MAGIAS", title = "Grimório de Habilidades Conhecidas", desc = "Todas as magias e técnicas aprendidas em todas as abas do Spellbook." },
    { key = "flightPaths", cat = "MUNDO", title = "Pontos de Voo (Taxi Nodes)", desc = "Mestres de voo e rotas aéreas desbloqueadas pelo aventureiro." },
    { key = "talents", cat = "TALENTOS", title = "Árvores de Especialização & Talentos", desc = "Build clássica de 51 pontos ou árvores modernas de classe e herói." },

    -- 4. Inventário, Banco & Economia
    { key = "inventory", cat = "INVENTÁRIO", title = "Inventário, Mochila & Bolsas", desc = "Todos os itens nas 4 bolsas e mochila principal com contagem de stacks." },
    { key = "bank", cat = "BANCO", title = "Banco Pessoal & Reagentes", desc = "Banco principal de 28 slots, bolsa de reagentes e Warband Bank." },
    { key = "economy", cat = "ECONOMIA", title = "Economia de Conta & Ouro de Alts", desc = "Ouro consolidado de todos os personagens e balanço financeiro da sessão." },

    -- 5. Coleções & Cosméticos
    { key = "mounts", cat = "COLEÇÃO", title = "Coleção de Montarias", desc = "Montarias aprendidas, Creature Display IDs, Spell IDs e velocidade." },
    { key = "pets", cat = "COLEÇÃO", title = "Mascotes de Batalha (Pets)", desc = "Companheiros e mascotes colecionados com Species IDs e níveis." },
    { key = "toys", cat = "COLEÇÃO", title = "Caixa de Brinquedos (Toys)", desc = "Brinquedos colecionados catalogados na conta com Item IDs." },
    { key = "titles", cat = "TÍTULOS", title = "Títulos do Personagem", desc = "Títulos honoríficos conhecidos e título exibido atualmente." },
    { key = "achievements", cat = "CONQUISTAS", title = "Conquistas Concluídas & Pontos", desc = "Pontos de conquista totais e lista de achievements desbloqueados." },

    -- 6. Mundo, Exploração & Passos
    { key = "stepCounter", cat = "JORNADA", title = "Contador de Passos em Tempo Real", desc = "Passos dados na aventura e distância percorrida em quilômetros." },
    { key = "exploration", cat = "MUNDO", title = "Zonas & Regiões Descobertas", desc = "Histórico de mapas e subzonas desbravadas com data da primeira visita." },

    -- 7. Caçadas, Chefes & Raros
    { key = "bossesAndRares", cat = "CAÇADAS", title = "Chefes & Raros Derrotados", desc = "Primeira vitória em cada chefe de raide/masmorra e monstros raros caçados." },
    { key = "worldBosses", cat = "CHEFES", title = "Chefes Mundiais (World Bosses)", desc = "Status de Lord Kazzak, Azuregos e os Quatro Dragões do Pesadelo." },
    { key = "lockouts", cat = "RAIDES", title = "Bloqueios de Instâncias Ativos", desc = "Salvas de masmorras e raides da semana, progresso e tempo para reinício." },

    -- 8. Social, Companheiros & PvP
    { key = "companions", cat = "SOCIAL", title = "Companheiros de Grupo & Raide", desc = "Histórico de aventureiros com quem você formou grupo pelo mundo." },
    { key = "pvp", cat = "PVP", title = "Estatísticas de PvP & Honra", desc = "Mortes com Honra (HKs), Patente Militar Clássica e Pontuação de Arena." },
    { key = "nativeStats", cat = "ESTATÍSTICAS", title = "Estatísticas Nativas do WoW", desc = "Dano causado, cura, mortes sofridas, monstros abatidos do painel do jogo." },

    -- 9. Livro dos Caídos & Tempo
    { key = "deathLog", cat = "MORTES", title = "Livro dos Caídos (Registro de Mortes)", desc = "Histórico de mortes com assassino, zona, coordenadas e nível do óbito." },
    { key = "playtime", cat = "TEMPO", title = "Tempo de Jogo (/played)", desc = "Horas jogadas no nível atual e tempo total de vida do personagem." },
    { key = "otherAddons", cat = "ADDONS", title = "Configurações de Outros Addons", desc = "Perfis salvos de Details, DBM, BigWigs, Plater, ElvUI e WeakAuras." },
}

-- Cores Oficiais das Classes de World of Warcraft
local CLASS_COLORS = {
    WARRIOR     = "cffc79c6e",
    PALADIN     = "cfff58cba",
    HUNTER      = "cffabd473",
    ROGUE       = "cfffff569",
    PRIEST      = "cffffffff",
    DEATHKNIGHT = "cffc41f3b",
    SHAMAN      = "cff0070de",
    MAGE        = "cff69ccf0",
    WARLOCK     = "cff9482c9",
    MONK        = "cff00ff96",
    DRUID       = "cffff7d0a",
    DEMONHUNTER = "cffa330c9",
    EVOKER      = "cff33937f",
}

local function GetClassColoredName(name, className)
    if not className then return name end
    local color = CLASS_COLORS[className:upper()] or "cff00f2fe"
    return "|c" .. color .. name .. "|r"
end

-- ========================================================================
-- MODAL DE VISUALIZAÇÃO / CÓPIA DO SNAPSHOT (EXPORT DIALOG)
-- ========================================================================
local function ShowExportDialog(snapshot)
    local frame = HAI_ExportDialog or CreateFrame("Frame", "HAI_ExportDialog", UIParent, BACKDROP_TEMPLATE)
    frame:SetSize(760, 570)
    frame:SetPoint("CENTER")
    frame:SetMovable(true)
    frame:EnableMouse(true)
    frame:RegisterForDrag("LeftButton")
    frame:SetScript("OnDragStart", frame.StartMoving)
    frame:SetScript("OnDragStop", frame.StopMovingOrSizing)
    frame:SetFrameStrata("DIALOG")

    if frame.SetBackdrop then
        frame:SetBackdrop({
            bgFile = "Interface\\Buttons\\WHITE8X8",
            edgeFile = "Interface\\Tooltips\\UI-Tooltip-Border",
            edgeSize = 16,
            insets = { left = 4, right = 4, top = 4, bottom = 4 }
        })
        frame:SetBackdropColor(0.04, 0.05, 0.08, 0.98)
        frame:SetBackdropBorderColor(0.78, 0.61, 0.24, 0.9) -- Ouro clássico Blizzard
    end

    if not frame.styled then
        local title = frame:CreateFontString(nil, "OVERLAY", "GameFontHighlightLarge")
        title:SetPoint("TOPLEFT", frame, "TOPLEFT", 22, -18)
        title:SetText("|cffffd100Haleck Account Importer|r - |cff00f2feVariáveis Salvas com Sucesso!|r")

        local subTip = frame:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
        subTip:SetPoint("TOPLEFT", title, "BOTTOMLEFT", 0, -4)
        subTip:SetText("|cff00ff00✔ Snapshot gerado na memória!|r Para gravar no disco agora: clique em |cff00f2fe[Recarregar UI (/reload)]|r ou copie com Ctrl+C.")
        frame.subTip = subTip

        local scroll = CreateFrame("ScrollFrame", "HAI_ExportScroll", frame, "UIPanelScrollFrameTemplate")
        scroll:SetPoint("TOPLEFT", 22, -72)
        scroll:SetPoint("BOTTOMRIGHT", -38, 68)

        local editBox = CreateFrame("EditBox", nil, scroll)
        editBox:SetMultiLine(true)
        editBox:SetFontObject("ChatFontNormal")
        editBox:SetWidth(680)
        scroll:SetScrollChild(editBox)
        frame.editBox = editBox

        local btnCopy = CreateFrame("Button", nil, frame, "UIPanelButtonTemplate")
        btnCopy:SetSize(190, 32)
        btnCopy:SetPoint("BOTTOMLEFT", frame, "BOTTOMLEFT", 22, 16)
        btnCopy:SetText("📋 Selecionar Texto (Ctrl+C)")
        btnCopy:SetScript("OnClick", function()
            frame.editBox:SetFocus()
            frame.editBox:HighlightText()
            pcall(function() PlaySound(SOUNDKIT and SOUNDKIT.IG_MAINMENU_OPTION_CHECKBOX_ON or 856) end)
            print("|cff00f2fe[Haleck Importer]|r Texto selecionado! Pressione Ctrl+C para copiar.")
        end)

        local btnClose = CreateFrame("Button", nil, frame, "UIPanelButtonTemplate")
        btnClose:SetSize(90, 32)
        btnClose:SetPoint("LEFT", btnCopy, "RIGHT", 8, 0)
        btnClose:SetText("Fechar")
        btnClose:SetScript("OnClick", function() frame:Hide() end)

        local btnReload = CreateFrame("Button", nil, frame, "UIPanelButtonTemplate")
        btnReload:SetSize(220, 32)
        btnReload:SetPoint("BOTTOMRIGHT", frame, "BOTTOMRIGHT", -22, 16)
        btnReload:SetText("|cff00f2fe⚡ Recarregar UI (/reload)|r")
        btnReload:SetScript("OnClick", function()
            pcall(function() PlaySound(SOUNDKIT and SOUNDKIT.IG_MAINMENU_CLOSE or 840) end)
            print("|cff00ff00[Haleck Importer]|r Gravando SavedVariables no disco e recarregando...")
            ReloadUI()
        end)

        local chkCompress = CreateFrame("CheckButton", "HAI_ExportCompressChk", frame, "UICheckButtonTemplate")
        chkCompress:SetPoint("LEFT", btnClose, "RIGHT", 10, 0)
        chkCompress:SetChecked(true)
        local chkTxt = chkCompress:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
        chkTxt:SetPoint("LEFT", chkCompress, "RIGHT", 4, 0)
        chkTxt:SetText("|cff00f2feBase64 LibDeflate|r")
        frame.chkCompress = chkCompress

        if UISpecialFrames and not tContains(UISpecialFrames, "HAI_ExportDialog") then
            tinsert(UISpecialFrames, "HAI_ExportDialog")
        end

        frame.styled = true
    end

    local function SerializeTable(val, indent)
        indent = indent or ""
        local t = type(val)
        if t == "number" or t == "boolean" then return tostring(val)
        elseif t == "string" then return string.format("%q", val)
        elseif t == "table" then
            local parts = {}
            local isArray = (#val > 0)
            table.insert(parts, "{\n")
            local nextIndent = indent .. "  "
            if isArray then
                for _, v in ipairs(val) do
                    table.insert(parts, nextIndent .. SerializeTable(v, nextIndent) .. ",\n")
                end
            else
                for k, v in pairs(val) do
                    local keyStr = (type(k) == "string" and k:match("^[%a_][%w_]*$")) and k or ("[" .. SerializeTable(k) .. "]")
                    table.insert(parts, nextIndent .. keyStr .. " = " .. SerializeTable(v, nextIndent) .. ",\n")
                end
            end
            table.insert(parts, indent .. "}")
            return table.concat(parts)
        else return "nil" end
    end

    local serialized = SerializeTable(snapshot, "  ")
    local rawOutput = "-- ========================================================================\n"
        .. "-- HALECK ACCOUNT IMPORTER v4.0.0 - SNAPSHOT ATT & DIÁRIO DE AVENTURA\n"
        .. "-- ========================================================================\n\n"
        .. "HaleckAccountImporterDB = HaleckAccountImporterDB or {}\n"
        .. "HaleckAccountImporterDB.lastExport = " .. serialized .. "\n"

    local function UpdateTextDisplay()
        if frame.chkCompress and frame.chkCompress:GetChecked() then
            if _G["HaleckAccountImporter_ExportCompressed"] then
                local comp = _G["HaleckAccountImporter_ExportCompressed"](rawOutput)
                frame.editBox:SetText(comp)
            else
                frame.editBox:SetText(rawOutput)
            end
        else
            frame.editBox:SetText(rawOutput)
        end
        frame.editBox:HighlightText()
    end

    if frame.chkCompress then
        frame.chkCompress:SetScript("OnClick", function()
            pcall(function() PlaySound(SOUNDKIT and SOUNDKIT.IG_MAINMENU_OPTION_CHECKBOX_ON or 856) end)
            UpdateTextDisplay()
        end)
    end

    UpdateTextDisplay()
    frame:Show()
end

-- ========================================================================
-- CRIAÇÃO DA JANELA PRINCIPAL COM DUAL-CATEGORY
-- ========================================================================
function HaleckAccountImporter_CreateUI()
    if MainWindow then return MainWindow end

    local win = CreateFrame("Frame", "HaleckMainWindow", UIParent, BACKDROP_TEMPLATE)
    win:SetSize(840, 700)
    win:SetPoint("CENTER")
    win:SetMovable(true)
    win:EnableMouse(true)
    win:RegisterForDrag("LeftButton")
    win:SetScript("OnDragStart", win.StartMoving)
    win:SetScript("OnDragStop", win.StopMovingOrSizing)
    win:SetFrameStrata("DIALOG")

    if win.SetBackdrop then
        win:SetBackdrop({
            bgFile = "Interface\\Buttons\\WHITE8X8",
            edgeFile = "Interface\\Tooltips\\UI-Tooltip-Border",
            edgeSize = 16,
            insets = { left = 4, right = 4, top = 4, bottom = 4 }
        })
        win:SetBackdropColor(0.04, 0.05, 0.08, 0.98)
        win:SetBackdropBorderColor(0.78, 0.61, 0.24, 0.95) -- Moldura dourada clássica de WoW
    end

    -- Header Superior com Identidade WoW Forever
    local headerTitle = win:CreateFontString(nil, "OVERLAY", "GameFontHighlightLarge")
    headerTitle:SetPoint("TOPLEFT", win, "TOPLEFT", 22, -16)
    headerTitle:SetText("|cffffd100Haleck|r Account Importer & |cff00f2feMeu Diário de Aventura|r")

    local headerSub = win:CreateFontString(nil, "OVERLAY", "GameFontDisableSmall")
    headerSub:SetPoint("TOPLEFT", headerTitle, "BOTTOMLEFT", 0, -3)
    headerSub:SetText("v4.0.0 • Motor ATT-Grade de Extração Universal & Crônica Permanente do Personagem")

    -- Botão Fechar Canônico Blizzard ("UIPanelCloseButton")
    local closeBtn = CreateFrame("Button", nil, win, "UIPanelCloseButton")
    if not closeBtn then
        closeBtn = CreateFrame("Button", nil, win)
        closeBtn:SetSize(28, 28)
        local closeText = closeBtn:CreateFontString(nil, "OVERLAY", "GameFontHighlightLarge")
        closeText:SetPoint("CENTER")
        closeText:SetText("|cffff5555✕|r")
    end
    closeBtn:SetPoint("TOPRIGHT", win, "TOPRIGHT", -4, -4)
    closeBtn:SetScript("OnClick", function()
        pcall(function() PlaySound(SOUNDKIT and SOUNDKIT.IG_MAINMENU_CLOSE or 840) end)
        win:Hide()
    end)

    -- Banner de Resumo do Personagem & Estatísticas Rápidas
    local banner = CreateFrame("Frame", nil, win, BACKDROP_TEMPLATE)
    banner:SetSize(796, 42)
    banner:SetPoint("TOPLEFT", win, "TOPLEFT", 22, -58)
    if banner.SetBackdrop then
        banner:SetBackdrop({
            bgFile = "Interface\\Buttons\\WHITE8X8",
            edgeFile = "Interface\\Buttons\\WHITE8X8",
            edgeSize = 1,
            insets = { left = 1, right = 1, top = 1, bottom = 1 }
        })
        banner:SetBackdropColor(0.06, 0.09, 0.14, 0.95)
        banner:SetBackdropBorderColor(0.18, 0.26, 0.38, 0.8)
    end

    local bannerText = banner:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
    bannerText:SetPoint("LEFT", banner, "LEFT", 12, 0)
    win.bannerText = bannerText

    -- ========================================================================
    -- ABAS DE NAVEGAÇÃO SUPERIOR (DUAS CATEGORIAS PRINCIPAIS)
    -- ========================================================================
    local tabExtraction = CreateFrame("Button", "HAI_Tab1", win, BACKDROP_TEMPLATE)
    tabExtraction:SetSize(250, 34)
    tabExtraction:SetPoint("TOPLEFT", banner, "BOTTOMLEFT", 0, -10)

    local tabJournal = CreateFrame("Button", "HAI_Tab2", win, BACKDROP_TEMPLATE)
    tabJournal:SetSize(250, 34)
    tabJournal:SetPoint("LEFT", tabExtraction, "RIGHT", 8, 0)

    local function StyleTab(tab, label, isActive)
        if tab.SetBackdrop then
            tab:SetBackdrop({
                bgFile = "Interface\\Buttons\\WHITE8X8",
                edgeFile = "Interface\\Buttons\\WHITE8X8",
                edgeSize = 1,
                insets = { left = 1, right = 1, top = 1, bottom = 1 }
            })
            if isActive then
                tab:SetBackdropColor(0.0, 0.55, 0.75, 0.95)
                tab:SetBackdropBorderColor(0.78, 0.61, 0.24, 1.0) -- Realce dourado
            else
                tab:SetBackdropColor(0.08, 0.1, 0.15, 0.6)
                tab:SetBackdropBorderColor(0.18, 0.22, 0.3, 0.5)
            end
        end
        if not tab.label then
            tab.label = tab:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
            tab.label:SetPoint("CENTER")
        end
        tab.label:SetText(isActive and ("|cffffffff" .. label .. "|r") or ("|cff88aacc" .. label .. "|r"))
    end

    -- Containers das duas telas
    local viewExtraction = CreateFrame("Frame", nil, win)
    viewExtraction:SetPoint("TOPLEFT", tabExtraction, "BOTTOMLEFT", 0, -8)
    viewExtraction:SetPoint("BOTTOMRIGHT", win, "BOTTOMRIGHT", -22, 60)

    local viewJournal = CreateFrame("Frame", nil, win)
    viewJournal:SetPoint("TOPLEFT", tabExtraction, "BOTTOMLEFT", 0, -8)
    viewJournal:SetPoint("BOTTOMRIGHT", win, "BOTTOMRIGHT", -22, 20)
    viewJournal:Hide()

    local function SwitchToCategory(catId)
        CurrentTab = catId
        StyleTab(tabExtraction, "⚙️ Central de Extração", catId == 1)
        StyleTab(tabJournal, "📖 Meu Diário de Aventura", catId == 2)
        pcall(function() PlaySound(SOUNDKIT and SOUNDKIT.IG_MAINMENU_OPTION_CHECKBOX_ON or 856) end)
        if catId == 1 then
            viewJournal:Hide()
            viewExtraction:Show()
            if win.bottomBarExtraction then win.bottomBarExtraction:Show() end
        else
            viewExtraction:Hide()
            viewJournal:Show()
            if win.bottomBarExtraction then win.bottomBarExtraction:Hide() end
            if win.RefreshJournalView then win.RefreshJournalView() end
        end
    end

    tabExtraction:SetScript("OnClick", function() SwitchToCategory(1) end)
    tabJournal:SetScript("OnClick", function() SwitchToCategory(2) end)

    -- ========================================================================
    -- CATEGORIA 1: CENTRAL DE EXTRAÇÃO & PARÂMETROS
    -- ========================================================================
    local scrollExtraction = CreateFrame("ScrollFrame", "HAI_ExtScroll", viewExtraction, "UIPanelScrollFrameTemplate")
    scrollExtraction:SetPoint("TOPLEFT", viewExtraction, "TOPLEFT", 0, 0)
    scrollExtraction:SetPoint("BOTTOMRIGHT", viewExtraction, "BOTTOMRIGHT", -20, 0)

    local contentExtraction = CreateFrame("Frame", nil, scrollExtraction)
    contentExtraction:SetSize(776, #PARAMETERS * 38)
    scrollExtraction:SetScrollChild(contentExtraction)

    win.paramCheckboxes = {}

    local function UpdateExtractionCounter()
        local count = 0
        for _, p in ipairs(PARAMETERS) do
            if HaleckAccountImporterDB.options and HaleckAccountImporterDB.options[p.key] ~= false then
                count = count + 1
            end
        end
        if win.counterLabel then
            win.counterLabel:SetText(string.format("|cff00f2fe%d de %d|r parâmetros ativos para extração", count, #PARAMETERS))
        end
    end

    for i, param in ipairs(PARAMETERS) do
        local yPos = -((i - 1) * 38)
        local row = CreateFrame("Button", nil, contentExtraction, BACKDROP_TEMPLATE)
        row:SetSize(766, 34)
        row:SetPoint("TOPLEFT", contentExtraction, "TOPLEFT", 0, yPos)
        if row.SetBackdrop then
            row:SetBackdrop({
                bgFile = "Interface\\Buttons\\WHITE8X8",
                edgeFile = "Interface\\Buttons\\WHITE8X8",
                edgeSize = 1,
                insets = { left = 1, right = 1, top = 1, bottom = 1 }
            })
            row:SetBackdropColor(0.06, 0.08, 0.12, 0.6)
            row:SetBackdropBorderColor(0.14, 0.18, 0.25, 0.5)
        end

        local checkText = row:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
        checkText:SetPoint("LEFT", row, "LEFT", 10, 0)

        local catTag = row:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
        catTag:SetPoint("LEFT", checkText, "RIGHT", 8, 6)
        catTag:SetText("|cff00f2fe[" .. param.cat .. "]|r")

        local titleLabel = row:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
        titleLabel:SetPoint("LEFT", catTag, "RIGHT", 6, 0)
        titleLabel:SetText(param.title)

        local descLabel = row:CreateFontString(nil, "OVERLAY", "GameFontDisableSmall")
        descLabel:SetPoint("LEFT", checkText, "RIGHT", 8, -8)
        descLabel:SetText(param.desc)

        local function RefreshRow()
            local isChecked = HaleckAccountImporterDB.options and HaleckAccountImporterDB.options[param.key]
            if isChecked == nil then isChecked = true end
            if isChecked then
                checkText:SetText("|cff00f2fe[✓]|r")
                if row.SetBackdropColor then row:SetBackdropColor(0.05, 0.16, 0.25, 0.85) end
                if row.SetBackdropBorderColor then row:SetBackdropBorderColor(0.0, 0.8, 1.0, 0.75) end
            else
                checkText:SetText("|cff555555[ ]|r")
                if row.SetBackdropColor then row:SetBackdropColor(0.06, 0.07, 0.1, 0.35) end
                if row.SetBackdropBorderColor then row:SetBackdropBorderColor(0.12, 0.15, 0.22, 0.3) end
            end
        end

        row:SetScript("OnClick", function()
            local cur = HaleckAccountImporterDB.options[param.key]
            if cur == nil then cur = true end
            HaleckAccountImporterDB.options[param.key] = not cur
            pcall(function() PlaySound(SOUNDKIT and SOUNDKIT.IG_MAINMENU_OPTION_CHECKBOX_ON or 856) end)
            RefreshRow()
            UpdateExtractionCounter()
        end)

        win.paramCheckboxes[param.key] = RefreshRow
        RefreshRow()
    end

    -- Barra Inferior da Categoria 1
    local bottomBar = CreateFrame("Frame", nil, win)
    bottomBar:SetPoint("BOTTOMLEFT", win, "BOTTOMLEFT", 22, 14)
    bottomBar:SetPoint("BOTTOMRIGHT", win, "BOTTOMRIGHT", -22, 14)
    bottomBar:SetHeight(40)
    win.bottomBarExtraction = bottomBar

    local btnSelectAll = CreateFrame("Button", nil, bottomBar, "UIPanelButtonTemplate")
    btnSelectAll:SetSize(110, 28)
    btnSelectAll:SetPoint("LEFT", bottomBar, "LEFT", 0, 6)
    btnSelectAll:SetText("Marcar Todos")
    btnSelectAll:SetScript("OnClick", function()
        for _, p in ipairs(PARAMETERS) do HaleckAccountImporterDB.options[p.key] = true end
        for _, ref in pairs(win.paramCheckboxes) do ref() end
        UpdateExtractionCounter()
    end)

    local btnDeselectAll = CreateFrame("Button", nil, bottomBar, "UIPanelButtonTemplate")
    btnDeselectAll:SetSize(110, 28)
    btnDeselectAll:SetPoint("LEFT", btnSelectAll, "RIGHT", 6, 0)
    btnDeselectAll:SetText("Desmarcar Todos")
    btnDeselectAll:SetScript("OnClick", function()
        for _, p in ipairs(PARAMETERS) do HaleckAccountImporterDB.options[p.key] = false end
        for _, ref in pairs(win.paramCheckboxes) do ref() end
        UpdateExtractionCounter()
    end)

    local counterLabel = bottomBar:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
    counterLabel:SetPoint("LEFT", btnDeselectAll, "RIGHT", 14, 0)
    win.counterLabel = counterLabel
    UpdateExtractionCounter()

    local btnSaveExport = CreateFrame("Button", nil, bottomBar, "UIPanelButtonTemplate")
    btnSaveExport:SetSize(190, 34)
    btnSaveExport:SetPoint("RIGHT", bottomBar, "RIGHT", 0, 4)
    btnSaveExport:SetText("|cffffd100💾 Salvar Dados|r")
    btnSaveExport:SetScript("OnClick", function()
        if _G["HaleckAccountImporter_GenerateSnapshot"] then
            local snapshot = _G["HaleckAccountImporter_GenerateSnapshot"]()
            pcall(function() PlaySound(SOUNDKIT and SOUNDKIT.UI_BONUS_LOOT_ROLL_END or 841) end)
            print("|cff00ff00[Haleck Importer]|r Snapshot gerado e salvo na memória com sucesso!")
            print("|cffffcc00[Atenção]|r Para gravar no arquivo SavedVariables no disco agora mesmo, clique no botão |cff00f2fe[⚡ Recarregar UI]|r ou copie o código!")
            ShowExportDialog(snapshot)
        end
    end)

    local btnReloadUI = CreateFrame("Button", nil, bottomBar, "UIPanelButtonTemplate")
    btnReloadUI:SetSize(160, 34)
    btnReloadUI:SetPoint("RIGHT", btnSaveExport, "LEFT", -6, 0)
    btnReloadUI:SetText("|cff00f2fe⚡ Recarregar UI|r")
    btnReloadUI:SetScript("OnClick", function()
        pcall(function() PlaySound(SOUNDKIT and SOUNDKIT.IG_MAINMENU_CLOSE or 840) end)
        print("|cff00ff00[Haleck Importer]|r Gravando SavedVariables no disco e recarregando a interface...")
        ReloadUI()
    end)

    local btnViewJson = CreateFrame("Button", nil, bottomBar, "UIPanelButtonTemplate")
    btnViewJson:SetSize(120, 34)
    btnViewJson:SetPoint("RIGHT", btnReloadUI, "LEFT", -6, 0)
    btnViewJson:SetText("📋 Ver Código")
    btnViewJson:SetScript("OnClick", function()
        if HaleckAccountImporterDB.lastExport then
            ShowExportDialog(HaleckAccountImporterDB.lastExport)
        elseif _G["HaleckAccountImporter_GenerateSnapshot"] then
            local snapshot = _G["HaleckAccountImporter_GenerateSnapshot"]()
            ShowExportDialog(snapshot)
        end
    end)

    -- ========================================================================
    -- CATEGORIA 2: MEU DIÁRIO DE AVENTURA
    -- ========================================================================
    local journalSidebar = CreateFrame("Frame", nil, viewJournal, BACKDROP_TEMPLATE)
    journalSidebar:SetSize(220, 530)
    journalSidebar:SetPoint("TOPLEFT", viewJournal, "TOPLEFT", 0, 0)
    if journalSidebar.SetBackdrop then
        journalSidebar:SetBackdrop({
            bgFile = "Interface\\Buttons\\WHITE8X8",
            edgeFile = "Interface\\Buttons\\WHITE8X8",
            edgeSize = 1,
            insets = { left = 1, right = 1, top = 1, bottom = 1 }
        })
        journalSidebar:SetBackdropColor(0.04, 0.05, 0.08, 0.75)
        journalSidebar:SetBackdropBorderColor(0.14, 0.18, 0.26, 0.7)
    end

    local journalMainArea = CreateFrame("Frame", nil, viewJournal, BACKDROP_TEMPLATE)
    journalMainArea:SetPoint("TOPLEFT", journalSidebar, "TOPRIGHT", 10, 0)
    journalMainArea:SetPoint("BOTTOMRIGHT", viewJournal, "BOTTOMRIGHT", 0, 0)
    if journalMainArea.SetBackdrop then
        journalMainArea:SetBackdrop({
            bgFile = "Interface\\Buttons\\WHITE8X8",
            edgeFile = "Interface\\Buttons\\WHITE8X8",
            edgeSize = 1,
            insets = { left = 1, right = 1, top = 1, bottom = 1 }
        })
        journalMainArea:SetBackdropColor(0.04, 0.05, 0.08, 0.9)
        journalMainArea:SetBackdropBorderColor(0.14, 0.18, 0.28, 0.8)
    end

    -- Barra de Busca do Diário com Botão de Limpar
    local searchBox = CreateFrame("EditBox", "HAI_JournalSearchBox", journalMainArea, BACKDROP_TEMPLATE)
    searchBox:SetSize(520, 30)
    searchBox:SetPoint("TOPLEFT", journalMainArea, "TOPLEFT", 12, -10)
    searchBox:SetAutoFocus(false)
    searchBox:SetFontObject("ChatFontNormal")
    if searchBox.SetBackdrop then
        searchBox:SetBackdrop({
            bgFile = "Interface\\Buttons\\WHITE8X8",
            edgeFile = "Interface\\Buttons\\WHITE8X8",
            edgeSize = 1,
            insets = { left = 1, right = 1, top = 1, bottom = 1 }
        })
        searchBox:SetBackdropColor(0.06, 0.08, 0.12, 0.95)
        searchBox:SetBackdropBorderColor(0.22, 0.28, 0.4, 0.85)
    end

    local searchPlaceholder = searchBox:CreateFontString(nil, "OVERLAY", "GameFontDisableSmall")
    searchPlaceholder:SetPoint("LEFT", searchBox, "LEFT", 8, 0)
    searchPlaceholder:SetText("🔍 Digite para filtrar memórias, chefes, amigos...")

    local searchClearBtn = CreateFrame("Button", nil, searchBox)
    searchClearBtn:SetSize(20, 20)
    searchClearBtn:SetPoint("RIGHT", searchBox, "RIGHT", -6, 0)
    local clearTxt = searchClearBtn:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
    clearTxt:SetPoint("CENTER")
    clearTxt:SetText("|cff888888✕|r")
    searchClearBtn:Hide()

    searchClearBtn:SetScript("OnClick", function()
        searchBox:SetText("")
        searchBox:ClearFocus()
        JournalSearchQuery = ""
        searchPlaceholder:Show()
        searchClearBtn:Hide()
        if win.RefreshJournalView then win.RefreshJournalView() end
    end)

    searchBox:SetScript("OnTextChanged", function(self)
        local txt = self:GetText()
        if txt == "" then
            searchPlaceholder:Show()
            searchClearBtn:Hide()
            JournalSearchQuery = ""
        else
            searchPlaceholder:Hide()
            searchClearBtn:Show()
            JournalSearchQuery = txt:lower()
        end
        if win.RefreshJournalView then win.RefreshJournalView() end
    end)

    -- Scroll do Conteúdo do Diário
    local scrollJournal = CreateFrame("ScrollFrame", "HAI_JournalScroll", journalMainArea, "UIPanelScrollFrameTemplate")
    scrollJournal:SetPoint("TOPLEFT", searchBox, "BOTTOMLEFT", 0, -8)
    scrollJournal:SetPoint("BOTTOMRIGHT", journalMainArea, "BOTTOMRIGHT", -28, 12)

    local contentJournal = CreateFrame("Frame", nil, scrollJournal)
    contentJournal:SetSize(526, 600)
    scrollJournal:SetScrollChild(contentJournal)

    -- Subcategorias do Diário (Menu Lateral com 8 Abas Especializadas)
    local SUBCATS = {
        { id = 1, label = "📜 Linha do Tempo", desc = "Crônica e eventos da jornada" },
        { id = 2, label = "⚔️ Caçadas & Chefes", desc = "1ª vitória em chefes & raros" },
        { id = 3, label = "🗺️ Exploração & Passos", desc = "Passos, km e zonas desbravadas" },
        { id = 4, label = "👥 Companheiros", desc = "Aventureiros que jogaram com você" },
        { id = 5, label = "📊 Estatísticas Gerais", desc = "Resumo do diário e progresso" },
        { id = 6, label = "💀 Livro dos Caídos", desc = "Registro solene de mortes" },
        { id = 7, label = "🏆 Grandes Feitos", desc = "Conquistas e títulos honrados" },
        { id = 8, label = "📈 Estatísticas do Jogo", desc = "Combat, Gold, Kills & Consumíveis" },
        { id = 9, label = "🐉 World Bosses (Forever)", desc = "Kazzak, Azuregos e Pesadelo" },
    }

    local subcatButtons = {}
    for i, sc in ipairs(SUBCATS) do
        local btn = CreateFrame("Button", nil, journalSidebar, BACKDROP_TEMPLATE)
        btn:SetSize(204, 38)
        btn:SetPoint("TOPLEFT", journalSidebar, "TOPLEFT", 8, -8 - ((i - 1) * 44))
        if btn.SetBackdrop then
            btn:SetBackdrop({
                bgFile = "Interface\\Buttons\\WHITE8X8",
                edgeFile = "Interface\\Buttons\\WHITE8X8",
                edgeSize = 1,
                insets = { left = 1, right = 1, top = 1, bottom = 1 }
            })
        end

        local bTitle = btn:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
        bTitle:SetPoint("TOPLEFT", btn, "TOPLEFT", 10, -6)
        bTitle:SetText(sc.label)

        local bDesc = btn:CreateFontString(nil, "OVERLAY", "GameFontDisableSmall")
        bDesc:SetPoint("TOPLEFT", bTitle, "BOTTOMLEFT", 0, -2)
        bDesc:SetText(sc.desc)

        local function RefreshSubcatBtn()
            local isActive = (CurrentJournalSubcat == sc.id)
            if btn.SetBackdropColor then
                if isActive then
                    btn:SetBackdropColor(0.0, 0.45, 0.65, 0.95)
                    btn:SetBackdropBorderColor(0.78, 0.61, 0.24, 1.0)
                    bTitle:SetText("|cffffffff" .. sc.label .. "|r")
                else
                    btn:SetBackdropColor(0.06, 0.07, 0.1, 0.6)
                    btn:SetBackdropBorderColor(0.14, 0.18, 0.25, 0.5)
                    bTitle:SetText("|cffbbddff" .. sc.label .. "|r")
                end
            end
        end

        btn:SetScript("OnClick", function()
            CurrentJournalSubcat = sc.id
            pcall(function() PlaySound(SOUNDKIT and SOUNDKIT.IG_MAINMENU_OPTION_CHECKBOX_ON or 856) end)
            for _, ref in ipairs(subcatButtons) do ref() end
            if win.RefreshJournalView then win.RefreshJournalView() end
        end)

        table.insert(subcatButtons, RefreshSubcatBtn)
        RefreshSubcatBtn()
    end

    -- ========================================================================
    -- RENDERIZADOR DO CONTEÚDO DO DIÁRIO (DINÂMICO)
    -- ========================================================================
    win.journalCardPool = {}

    local function ClearJournalContent()
        for _, card in ipairs(win.journalCardPool) do card:Hide() end
    end

    local function SafeSetTexture(texObj, path, fallback)
        if not texObj then return end
        fallback = fallback or "Interface\\Icons\\INV_Misc_Book_09"
        local p = path
        if not p or p == "" then
            p = fallback
        end
        if type(p) == "string" and not p:find("^Interface") and not tonumber(p) then
            p = "Interface\\Icons\\" .. p
        end
        local ok = pcall(function() texObj:SetTexture(p) end)
        if not ok then
            pcall(function() texObj:SetTexture(fallback) end)
        end
        if texObj.SetTexCoord then
            texObj:SetTexCoord(0.08, 0.92, 0.08, 0.92)
        end
    end

    local function GetJournalCard(idx)
        if win.journalCardPool[idx] then
            win.journalCardPool[idx]:Show()
            return win.journalCardPool[idx]
        end
        local c = CreateFrame("Frame", nil, contentJournal, BACKDROP_TEMPLATE)
        c:SetSize(520, 52)
        if c.SetBackdrop then
            c:SetBackdrop({
                bgFile = "Interface\\Buttons\\WHITE8X8",
                edgeFile = "Interface\\Buttons\\WHITE8X8",
                edgeSize = 1,
                insets = { left = 1, right = 1, top = 1, bottom = 1 }
            })
            c:SetBackdropColor(0.06, 0.08, 0.12, 0.75)
            c:SetBackdropBorderColor(0.16, 0.22, 0.32, 0.6)
        end

        -- Borda estilizada dourada para o ícone
        c.iconBorder = c:CreateTexture(nil, "BACKGROUND")
        c.iconBorder:SetSize(38, 38)
        c.iconBorder:SetPoint("LEFT", c, "LEFT", 7, 0)
        if c.iconBorder.SetColorTexture then
            c.iconBorder:SetColorTexture(0.78, 0.61, 0.24, 0.7)
        else
            c.iconBorder:SetTexture("Interface\\Buttons\\WHITE8X8")
        end

        c.icon = c:CreateTexture(nil, "ARTWORK")
        c.icon:SetSize(34, 34)
        c.icon:SetPoint("CENTER", c.iconBorder, "CENTER", 0, 0)

        c.title = c:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
        c.title:SetPoint("TOPLEFT", c.icon, "TOPRIGHT", 10, 0)

        c.desc = c:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
        c.desc:SetPoint("TOPLEFT", c.title, "BOTTOMLEFT", 0, -3)

        c.time = c:CreateFontString(nil, "OVERLAY", "GameFontDisableSmall")
        c.time:SetPoint("TOPRIGHT", c, "TOPRIGHT", -10, -6)

        c.tag = c:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
        c.tag:SetPoint("BOTTOMRIGHT", c, "BOTTOMRIGHT", -10, 6)

        win.journalCardPool[idx] = c
        return c
    end

    win.RefreshJournalView = function()
        ClearJournalContent()
        local journal = HaleckAccountImporterDB.journal or {}
        local yOffset = 0
        local renderedCount = 0

        if CurrentJournalSubcat == 1 then
            -- 📜 Linha do Tempo
            local timeline = journal.timeline or {}
            for _, entry in ipairs(timeline) do
                local match = true
                if JournalSearchQuery ~= "" then
                    local haystack = ((entry.title or "") .. " " .. (entry.desc or "") .. " " .. (entry.zone or "")):lower()
                    if not haystack:find(JournalSearchQuery) then match = false end
                end

                if match then
                    renderedCount = renderedCount + 1
                    local card = GetJournalCard(renderedCount)
                    card:SetPoint("TOPLEFT", contentJournal, "TOPLEFT", 0, yOffset)
                    SafeSetTexture(card.icon, entry.icon, "Interface\\Icons\\INV_Misc_Book_09")
                    card.title:SetText(entry.title or "Marco")
                    card.desc:SetText(entry.desc or "")
                    card.time:SetText(entry.timestamp or "")
                    card.tag:SetText("|cff00f2fe" .. (entry.zone or "") .. "|r")
                    yOffset = yOffset - 58
                end
            end
        elseif CurrentJournalSubcat == 2 then
            -- ⚔️ Caçadas & Chefes
            local bosses = journal.bosses or {}
            for bName, bData in pairs(bosses) do
                local match = true
                if JournalSearchQuery ~= "" then
                    local haystack = (bName .. " " .. (bData.zone or "")):lower()
                    if not haystack:find(JournalSearchQuery) then match = false end
                end

                if match then
                    renderedCount = renderedCount + 1
                    local card = GetJournalCard(renderedCount)
                    card:SetPoint("TOPLEFT", contentJournal, "TOPLEFT", 0, yOffset)
                    local bIcon = bData.isWorldBoss and "Spell_Shadow_SummonInfernal" or (bData.isRare and "INV_Misc_Head_Dragon_01" or "INV_Misc_MonsterClaw_04")
                    SafeSetTexture(card.icon, bIcon, "Interface\\Icons\\INV_Misc_MonsterClaw_04")
                    card.title:SetText("|cffffcc00" .. bName .. "|r" .. (bData.isWorldBoss and " |cffff5555[WORLD BOSS]|r" or ""))
                    card.desc:SetText(string.format("1ª Vitória em %s (Nv. %d) • Abates totais: |cff00ff00%d|r", bData.zone or "Azeroth", bData.level or 1, bData.killCount or 1))
                    card.time:SetText(bData.firstKillDate or "")
                    card.tag:SetText(string.format("|cff00f2fe%d abates|r", bData.killCount or 1))
                    yOffset = yOffset - 58
                end
            end
        elseif CurrentJournalSubcat == 3 then
            -- 🗺️ Exploração & Passos
            local stats = journal.statistics or {}
            local exploration = journal.exploration or {}

            -- Card 1: Passos & Quilometragem
            renderedCount = renderedCount + 1
            local stepCard = GetJournalCard(renderedCount)
            stepCard:SetPoint("TOPLEFT", contentJournal, "TOPLEFT", 0, yOffset)
            SafeSetTexture(stepCard.icon, "Ability_Rogue_Sprint", "Interface\\Icons\\Ability_Rogue_Sprint")
            local km = ((stats.distanceYards or 0) * 0.9144) / 1000
            stepCard.title:SetText(string.format("|cff00f2fe%s Passos|r • %.2f km Percorridos", tostring(stats.steps or 0), km))
            stepCard.desc:SetText("Rastreamento contínuo de passos terrestres em Azeroth.")
            stepCard.time:SetText("Tempo Real")
            stepCard.tag:SetText("|cff00ff00Ativo|r")
            yOffset = yOffset - 58

            -- Lista de Zonas
            for zName, zData in pairs(exploration) do
                local match = true
                if JournalSearchQuery ~= "" and not zName:lower():find(JournalSearchQuery) then match = false end
                if match then
                    renderedCount = renderedCount + 1
                    local card = GetJournalCard(renderedCount)
                    card:SetPoint("TOPLEFT", contentJournal, "TOPLEFT", 0, yOffset)
                    SafeSetTexture(card.icon, "INV_Misc_Map01", "Interface\\Icons\\INV_Misc_Map01")
                    card.title:SetText("|cffffffff" .. zName .. "|r")
                    card.desc:SetText(string.format("Descoberta em %s • Visitas registradas: %d", zData.firstVisited or "Início", zData.visitCount or 1))
                    card.time:SetText(zData.firstVisited or "")
                    card.tag:SetText(string.format("|cff00f2fe%d visitas|r", zData.visitCount or 1))
                    yOffset = yOffset - 58
                end
            end
        elseif CurrentJournalSubcat == 4 then
            -- 👥 Companheiros de Grupo
            local comps = journal.companions or {}
            for fullKey, cData in pairs(comps) do
                local match = true
                if JournalSearchQuery ~= "" then
                    local haystack = (cData.name .. " " .. (cData.realm or "") .. " " .. (cData.class or "") .. " " .. (cData.zone or "")):lower()
                    if not haystack:find(JournalSearchQuery) then match = false end
                end

                if match then
                    renderedCount = renderedCount + 1
                    local card = GetJournalCard(renderedCount)
                    card:SetPoint("TOPLEFT", contentJournal, "TOPLEFT", 0, yOffset)
                    SafeSetTexture(card.icon, "Spell_Holy_PrayerOfFortitude", "Interface\\Icons\\INV_Letter_15")
                    card.title:SetText(GetClassColoredName(cData.name, cData.class) .. " - " .. (cData.realm or GetRealmName()))
                    card.desc:SetText(string.format("%s Nível %d • Conhecido em %s", cData.class or "Aventureiro", cData.level or 1, cData.zone or "Mundo"))
                    card.time:SetText(cData.firstMetDate or "")
                    card.tag:SetText(string.format("|cff00ff00%d grupos juntos|r", cData.timesGrouped or 1))
                    yOffset = yOffset - 58
                end
            end
        elseif CurrentJournalSubcat == 5 then
            -- 📊 Estatísticas Gerais (Resumo)
            local stats = journal.statistics or {}
            local statRows = {
                { icon = "Ability_Rogue_Sprint", title = "Passos Dados na Aventura", val = tostring(stats.steps or 0) .. " passos" },
                { icon = "INV_Misc_Coin_01", title = "Quests Concluídas no Histórico", val = tostring(stats.totalQuestsCompleted or 0) .. " missões" },
                { icon = "INV_Misc_Head_Dragon_01", title = "Chefes e Raros Derrotados", val = tostring(stats.totalBossesDefeated or 0) .. " abates" },
                { icon = "Spell_Holy_PrayerOfFortitude", title = "Companheiros Conhecidos em Grupo", val = tostring(stats.totalCompanionsMet or 0) .. " jogadores" },
                { icon = "Ability_Creature_Cursed_02", title = "Total de Mortes Sofridas", val = tostring(stats.totalDeaths or 0) .. " vezes" },
                { icon = "Spell_Holy_MagicalSentry", title = "Nível Atual do Personagem", val = "Nível " .. tostring(UnitLevel("player") or 1) },
            }

            for _, sr in ipairs(statRows) do
                renderedCount = renderedCount + 1
                local card = GetJournalCard(renderedCount)
                card:SetPoint("TOPLEFT", contentJournal, "TOPLEFT", 0, yOffset)
                SafeSetTexture(card.icon, sr.icon, "Interface\\Icons\\INV_Misc_Book_09")
                card.title:SetText(sr.title)
                card.desc:SetText("Estatística registrada de forma imutável pelo diário de bordo.")
                card.time:SetText("")
                card.tag:SetText("|cff00f2fe" .. sr.val .. "|r")
                yOffset = yOffset - 58
            end
        elseif CurrentJournalSubcat == 6 then
            -- 💀 Livro dos Caídos
            local deaths = journal.deaths or {}
            for _, d in ipairs(deaths) do
                renderedCount = renderedCount + 1
                local card = GetJournalCard(renderedCount)
                card:SetPoint("TOPLEFT", contentJournal, "TOPLEFT", 0, yOffset)
                SafeSetTexture(card.icon, "Ability_Creature_Cursed_02", "Interface\\Icons\\Ability_Creature_Cursed_02")
                card.title:SetText("|cffff5555Caiu perante:|r |cffffcc00" .. (d.killerName or "Inimigo") .. "|r")
                card.desc:SetText(string.format("Local: %s • Nível no óbito: %d", d.zone or "Azeroth", d.level or 1))
                card.time:SetText(d.timestamp or "")
                card.tag:SetText("|cffff4444[MORTE]|r")
                yOffset = yOffset - 58
            end
        elseif CurrentJournalSubcat == 7 then
            -- 🏆 Grandes Feitos
            local pts = (GetTotalAchievementPoints and GetTotalAchievementPoints()) or 0
            local curTitle = (GetCurrentTitle and GetCurrentTitle() and GetTitleName(GetCurrentTitle())) or "Nenhum"
            local featRows = {
                { icon = "INV_Misc_Ribbon_01", title = "Pontos de Conquista Totais", val = tostring(pts) .. " pontos" },
                { icon = "INV_Jewelry_Talisman_07", title = "Título em Uso", val = tostring(curTitle):gsub("^%s+", ""):gsub("%s+$", "") },
                { icon = "INV_Misc_Key_14", title = "Marcos Registrados na Linha do Tempo", val = tostring(#(journal.timeline or {})) .. " eventos" },
            }
            for _, fr in ipairs(featRows) do
                renderedCount = renderedCount + 1
                local card = GetJournalCard(renderedCount)
                card:SetPoint("TOPLEFT", contentJournal, "TOPLEFT", 0, yOffset)
                SafeSetTexture(card.icon, fr.icon, "Interface\\Icons\\INV_Misc_Ribbon_01")
                card.title:SetText(fr.title)
                card.desc:SetText("Conquista máxima reconhecida no registro histórico de Azeroth.")
                card.time:SetText("")
                card.tag:SetText("|cff00f2fe" .. fr.val .. "|r")
                yOffset = yOffset - 58
            end
        elseif CurrentJournalSubcat == 8 then
            -- 📈 Estatísticas Reais do Personagem (WoW Forever & Classic Vanilla+)
            local stats = (HaleckAccountImporterDB.lastExport and HaleckAccountImporterDB.lastExport.nativeStatistics) or {}
            if not next(stats) and _G["HaleckAccountImporter_GenerateSnapshot"] then
                local snap = _G["HaleckAccountImporter_GenerateSnapshot"]()
                if snap and snap.nativeStatistics then stats = snap.nativeStatistics end
            end

            local statDisplayList = {
                { icon = "Spell_Holy_SealOfSacrifice", title = "Pontos de Vida Máximos (Max HP)", val = stats["stat_max_hp"] or tostring(UnitHealthMax and UnitHealthMax("player") or 100), def = "Vitalidade Vital" },
                { icon = "Spell_Frost_ManaRecharge", title = "Energia / Mana / Fúria Máxima", val = stats["stat_max_power"] or tostring(UnitPowerMax and UnitPowerMax("player") or 100), def = "Recurso de Combate" },
                { icon = "Spell_Nature_Strength", title = "Força (Strength)", val = stats["stat_strength"] or tostring(UnitStat and math.floor(UnitStat("player", 1) or 0) or 0), def = "Atributo Primário" },
                { icon = "Spell_Holy_BlessingOfAgility", title = "Agilidade (Agility)", val = stats["stat_agility"] or tostring(UnitStat and math.floor(UnitStat("player", 2) or 0) or 0), def = "Atributo Primário" },
                { icon = "Spell_Nature_StrengthOfEarthTotem02", title = "Vigor (Stamina)", val = stats["stat_stamina"] or tostring(UnitStat and math.floor(UnitStat("player", 3) or 0) or 0), def = "Atributo Primário" },
                { icon = "Spell_Holy_MagicalSentry", title = "Intelecto (Intellect)", val = stats["stat_intellect"] or tostring(UnitStat and math.floor(UnitStat("player", 4) or 0) or 0), def = "Atributo Primário" },
                { icon = "Spell_Holy_PrayerOfSpirit", title = "Espírito (Spirit)", val = stats["stat_spirit"] or tostring(UnitStat and math.floor(UnitStat("player", 5) or 0) or 0), def = "Atributo Primário" },
                { icon = "INV_Shield_04", title = "Armadura Total Efetiva", val = stats["stat_armor"] or tostring(select(2, UnitArmor("player")) or 0), def = "Mitigação de Dano Físico" },
                { icon = "INV_Sword_04", title = "Poder de Ataque (Attack Power)", val = stats["stat_attack_power"] or tostring(UnitAttackPower and select(1, UnitAttackPower("player")) or 0), def = "Dano Físico Melee/Ranged" },
                { icon = "Ability_DualWield", title = "Chance de Golpe Crítico", val = stats["stat_crit_chance"] or (GetCritChance and string.format("%.2f%%", GetCritChance()) or "0.00%"), def = "Crítico em Combate" },
                { icon = "Spell_Fire_Fireball02", title = "Poder Mágico (Spell Power)", val = stats["stat_spell_power"] or "0", def = "Dano Mágico com Feitiços" },
                { icon = "Spell_Holy_HolyBolt", title = "Poder de Cura (Healing Power)", val = stats["stat_spell_healing"] or "0", def = "Bônus de Cura com Feitiços" },
                { icon = "Spell_Nature_Invisibilty", title = "Chance de Esquiva (Dodge)", val = stats["stat_dodge"] or (GetDodgeChance and string.format("%.2f%%", GetDodgeChance()) or "0.00%"), def = "Evasão de Golpes" },
                { icon = "Ability_Parry", title = "Chance de Aparo (Parry)", val = stats["stat_parry"] or (GetParryChance and string.format("%.2f%%", GetParryChance()) or "0.00%"), def = "Defesa com Armas" },
                { icon = "INV_Shield_06", title = "Chance de Bloqueio (Block)", val = stats["stat_block"] or (GetBlockChance and string.format("%.2f%%", GetBlockChance()) or "0.00%"), def = "Bloqueio com Escudo" },
                { icon = "INV_Misc_Coin_01", title = "Ouro & Fortuna em Mãos", val = stats["stat_money"] or (function() local c = GetMoney and GetMoney() or 0 return string.format("%dg %ds %dc", math.floor(c/10000), math.floor((c%10000)/100), c%100) end)(), def = "Economia Atual" },
                { icon = "Ability_Creature_Cursed_02", title = "Total de Mortes em Combate", val = stats["stat_total_deaths"] or tostring((HaleckAccountImporterDB.journal and HaleckAccountImporterDB.journal.statistics and HaleckAccountImporterDB.journal.statistics.totalDeaths) or 0), def = "Histórico de Sobrevivência" },
                { icon = "Ability_Rogue_Sprint", title = "Distância & Passos Rastreados", val = tostring((HaleckAccountImporterDB.journal and HaleckAccountImporterDB.journal.statistics and HaleckAccountImporterDB.journal.statistics.steps) or 0) .. " passos", def = "Exploração de Mundo" },
                { icon = "INV_Misc_Head_Dragon_01", title = "Chefes e Raros Derrotados", val = tostring((HaleckAccountImporterDB.journal and HaleckAccountImporterDB.journal.statistics and HaleckAccountImporterDB.journal.statistics.totalBossesDefeated) or 0) .. " abates", def = "Conquistas de Combate" },
                { icon = "INV_Misc_QuestionMark", title = "Missões Finalizadas", val = tostring((HaleckAccountImporterDB.journal and HaleckAccountImporterDB.journal.statistics and HaleckAccountImporterDB.journal.statistics.totalQuestsCompleted) or 0) .. " missões", def = "Histórico de Quests" },
            }

            for _, sd in ipairs(statDisplayList) do
                local val = sd.val or sd.def
                if val == "" or val == "--" then val = sd.def end
                
                local match = true
                if JournalSearchQuery ~= "" then
                    local haystack = (sd.title .. " " .. tostring(val)):lower()
                    if not haystack:find(JournalSearchQuery) then match = false end
                end

                if match then
                    renderedCount = renderedCount + 1
                    local card = GetJournalCard(renderedCount)
                    card:SetPoint("TOPLEFT", contentJournal, "TOPLEFT", 0, yOffset)
                    SafeSetTexture(card.icon, sd.icon, "Interface\\Icons\\INV_Misc_Book_09")
                    card.title:SetText(sd.title)
                    card.desc:SetText(sd.def or "Estatística autêntica do personagem no WoW.")
                    card.time:SetText("")
                    card.tag:SetText("|cffffd100" .. tostring(val) .. "|r")
                    yOffset = yOffset - 58
                end
            end
        elseif CurrentJournalSubcat == 9 then
            -- 🐉 World Bosses (WoW Forever & Vanilla+)
            local worldBosses = (HaleckAccountImporterDB and HaleckAccountImporterDB.worldBosses) or {}
            local now = time()
            local BOSS_LIST = {
                { key = "kazzak", name = "Lord Kazzak", zone = "Barreira do Inferno (Blasted Lands)", icon = "Spell_Shadow_SummonInfernal" },
                { key = "azuregos", name = "Azuregos", zone = "Azshara", icon = "Spell_Frost_Glacier" },
                { key = "taerar", name = "Taerar (Pesadelo)", zone = "Vale Gris (Bough Shadow)", icon = "Spell_Nature_AbolishPoison" },
                { key = "ysondre", name = "Ysondre (Pesadelo)", zone = "Feralas (Dream Bough)", icon = "Spell_Nature_AbolishPoison" },
                { key = "lethon", name = "Lethon (Pesadelo)", zone = "Terras Altas dos Guarus (Seradane)", icon = "Spell_Nature_AbolishPoison" },
                { key = "emeriss", name = "Emeriss (Pesadelo)", zone = "Floresta do Crepúsculo (Twilight Grove)", icon = "Spell_Nature_AbolishPoison" },
            }

            for _, b in ipairs(BOSS_LIST) do
                local rec = worldBosses[b.key]
                local match = true
                if JournalSearchQuery ~= "" then
                    local haystack = (b.name .. " " .. b.zone):lower()
                    if not haystack:find(JournalSearchQuery) then match = false end
                end

                if match then
                    renderedCount = renderedCount + 1
                    local card = GetJournalCard(renderedCount)
                    card:SetPoint("TOPLEFT", contentJournal, "TOPLEFT", 0, yOffset)
                    SafeSetTexture(card.icon, b.icon, "Interface\\Icons\\Spell_Shadow_SummonInfernal")

                    if rec and rec.status == "active" then
                        card.title:SetText(string.format("|cffff0055⚔️ %s|r |cff00ff00[VIVO / ATIVO AGORA]|r", b.name))
                        card.desc:SetText(string.format("Local: |cffffffff%s|r • Avistado/Rugiu em: %s", b.zone, rec.spottedAt or "Recente"))
                        card.time:SetText("|cff00ff00ATIVO|r")
                        card.tag:SetText("|cffff0055ATACAR!|r")
                    elseif rec and rec.status == "killed" then
                        local remSecs = (rec.respawnMinEpoch or 0) - now
                        local statusTxt = ""
                        if remSecs > 0 then
                            local h = math.floor(remSecs / 3600)
                            local m = math.floor((remSecs % 3600) / 60)
                            statusTxt = string.format("Janela abre em ~%dh %dm", h, m)
                        else
                            statusTxt = "|cffffcc00Janela de Respawn ABERTA!|r"
                        end
                        card.title:SetText(string.format("|cffffd100%s|r • %s", b.name, statusTxt))
                        card.desc:SetText(string.format("Local: %s • Derrotado: %s", b.zone, rec.killedAt or "Hoje"))
                        card.time:SetText(rec.respawnMinDate or "")
                        card.tag:SetText("|cff88888872h-96h|r")
                    else
                        card.title:SetText(string.format("|cffbbddff%s|r", b.name))
                        card.desc:SetText(string.format("Local: %s • Respawn clássico: 72h a 96h", b.zone))
                        card.time:SetText("Sem registro recente")
                        card.tag:SetText("|cff888888Aguardando|r")
                    end
                    yOffset = yOffset - 58
                end
            end
        end

        contentJournal:SetHeight(math.max(520, math.abs(yOffset) + 20))
    end

    -- Inicializa na Categoria 1
    SwitchToCategory(1)

    if UISpecialFrames and not tContains(UISpecialFrames, "HaleckMainWindow") then
        tinsert(UISpecialFrames, "HaleckMainWindow")
    end

    MainWindow = win
    return win
end

-- ========================================================================
-- ATUALIZAÇÃO DO BANNER DO TOPO
-- ========================================================================
local function GetFullCharacterName()
    if _G["HaleckAccountImporter_GetFullCharacterName"] then
        return _G["HaleckAccountImporter_GetFullCharacterName"]()
    end
    local name = (UnitName and UnitName("player")) or "Herói"
    if name:find("%s+") then return name end
    if HaleckAccountImporterDB and HaleckAccountImporterDB.latestCharacter and HaleckAccountImporterDB.latestCharacter:find("%s+") then
        return HaleckAccountImporterDB.latestCharacter
    end
    return name
end

local function UpdateTopBanner(win)
    if not win or not win.bannerText then return end
    local cName = GetFullCharacterName()
    local cRealm = GetRealmName() or "Azralon"
    local cLevel = UnitLevel("player") or 1
    local _, cClass = UnitClass("player")
    local isForever = (cRealm:lower():find("forever") ~= nil) or (GetRuleset ~= nil)
    local vLabel = isForever and "|cff00f2feWoW Forever (16001)|r" or "|cffffd100World of Warcraft|r"

    local stats = (HaleckAccountImporterDB.journal and HaleckAccountImporterDB.journal.statistics) or {}
    local steps = stats.steps or 0
    local bosses = stats.totalBossesDefeated or 0
    local companions = stats.totalCompanionsMet or 0

    win.bannerText:SetText(string.format(
        "|cffffffff%s|r - |cffffcc00%s|r (%s Nv. %d) • %s  |  |cff00f2fe👣 %d Passos|r  |  |cffffcc00⚔️ %d Chefes|r  |  |cff00ff00👥 %d Amigos|r",
        GetClassColoredName(cName, cClass), cRealm, cClass or "", cLevel, vLabel, steps, bosses, companions
    ))
end

-- ========================================================================
-- COMANDOS SLASH UNIFICADOS COM SUB-COMANDOS
-- ========================================================================
SLASH_HALECK1 = "/hai"
SLASH_HALECK2 = "/haleck"
SLASH_HALECK3 = "/diario"
SLASH_HALECK4 = "/adventure"
SLASH_HALECK5 = "/journal"

SlashCmdList["HALECK"] = function(msg)
    if (InCombatLockdown and InCombatLockdown()) or (_G["HaleckAccountImporter_IsInCombat"] and _G["HaleckAccountImporter_IsInCombat"]()) then
        print("|cffff9900[Haleck Importer]|r Você está em combate! Ações de interface protegidas estão bloqueadas temporariamente.")
        return
    end
    local win = HaleckAccountImporter_CreateUI()
    UpdateTopBanner(win)
    local param = msg and msg:lower():match("^%s*(%S+)")

    if param == "save" or param == "export" then
        if _G["HaleckAccountImporter_GenerateSnapshot"] then
            local snapshot = _G["HaleckAccountImporter_GenerateSnapshot"]()
            pcall(function() PlaySound(SOUNDKIT and SOUNDKIT.IG_MAINMENU_OPEN or 841) end)
            print("|cff00f2fe[Haleck Importer]|r Snapshot manual gerado e salvo em SavedVariables com sucesso!")
            ShowExportDialog(snapshot)
        end
        return
    elseif param == "help" then
        print("|cffffd100[Haleck Account Importer v4.0.0]|r Comandos disponíveis:")
        print("  |cff00f2fe/hai|r ou |cff00f2fe/haleck|r - Abrir janela principal (Central de Extração)")
        print("  |cff00f2fe/diario|r ou |cff00f2fe/journal|r - Abrir diretamente Meu Diário de Aventura")
        print("  |cff00f2fe/hai save|r - Gerar snapshot manual imediato e exibir janela de exportação")
        return
    end

    if msg and (msg:lower():find("diario") or msg:lower():find("journal") or msg:lower():find("adventure")) then
        if _G["HAI_Tab2"] then _G["HAI_Tab2"]:Click() end
    end
    if win:IsShown() then win:Hide() else win:Show() end
end

-- ========================================================================
-- BOTÃO DE MINIMAPA COM ROTAÇÃO RADIAL 360° E POSIÇÃO SALVA
-- ========================================================================
local function CreateMinimapButton()
    if HaleckMinimapButton then return end
    local btn = CreateFrame("Button", "HaleckMinimapButton", Minimap)
    btn:SetSize(32, 32)
    btn:SetFrameStrata("MEDIUM")

    local savedAngle = (HaleckAccountImporterDB and HaleckAccountImporterDB.minimapPos) or 220
    local rad = math.rad(savedAngle)
    local radius = 80
    btn:SetPoint("CENTER", Minimap, "CENTER", math.cos(rad) * radius, math.sin(rad) * radius)

    local icon = btn:CreateTexture(nil, "BACKGROUND")
    icon:SetSize(20, 20)
    icon:SetPoint("CENTER", 0, 0)
    icon:SetTexture("Interface\\Icons\\INV_Misc_Book_09")
    btn.icon = icon

    local border = btn:CreateTexture(nil, "OVERLAY")
    border:SetSize(54, 54)
    border:SetPoint("TOPLEFT", 0, 0)
    border:SetTexture("Interface\\Minimap\\MiniMap-TrackingBorder")

    btn:SetHighlightTexture("Interface\\Minimap\\UI-Minimap-ZoomButton-Highlight")
    btn:RegisterForClicks("LeftButtonUp", "RightButtonUp")

    -- Suporte a arrasto radial ao redor do minimapa com persistência de ângulo
    btn:RegisterForDrag("LeftButton")
    btn:SetScript("OnDragStart", function(self) self.isDragging = true end)
    btn:SetScript("OnDragStop", function(self)
        self.isDragging = false
        if HaleckAccountImporterDB and self.currentAngle then
            HaleckAccountImporterDB.minimapPos = self.currentAngle
        end
    end)
    btn:SetScript("OnUpdate", function(self)
        if self.isDragging then
            local mx, my = Minimap:GetCenter()
            local cx, cy = GetCursorPosition()
            local scale = UIParent:GetEffectiveScale()
            cx, cy = cx / scale, cy / scale
            local angle = math.deg(math.atan2(cy - my, cx - mx))
            self.currentAngle = angle
            local curRad = math.rad(angle)
            self:ClearAllPoints()
            self:SetPoint("CENTER", Minimap, "CENTER", math.cos(curRad) * radius, math.sin(curRad) * radius)
        end
    end)

    btn:SetScript("OnClick", function(self, button)
        local win = HaleckAccountImporter_CreateUI()
        UpdateTopBanner(win)
        if button == "RightButton" then
            _G["HAI_Tab2"]:Click()
        else
            _G["HAI_Tab1"]:Click()
        end
        if win:IsShown() then win:Hide() else win:Show() end
    end)

    btn:SetScript("OnEnter", function(self)
        GameTooltip:SetOwner(self, "ANCHOR_LEFT")
        GameTooltip:AddLine("|cffffd100Haleck|r |cff00f2feAccount Importer & Diário|r")
        GameTooltip:AddLine("|cffffffffClique Esquerdo:|r Abrir Central de Extração e Parâmetros", 0.9, 0.9, 0.9)
        GameTooltip:AddLine("|cffffcc00Clique Direito:|r Abrir Meu Diário de Aventura", 0.9, 0.9, 0.9)
        GameTooltip:AddLine("|cff888888Arrastar:|r Reposicionar botão ao redor do Minimapa", 0.7, 0.7, 0.7)
        GameTooltip:AddLine("Comandos: |cff00f2fe/hai|r ou |cff00f2fe/diario|r", 0.7, 0.7, 0.7)
        GameTooltip:Show()
    end)
    btn:SetScript("OnLeave", function() GameTooltip:Hide() end)
end

-- ========================================================================
-- API PÚBLICA PARA MACROS IN-GAME (/script & /run) E OUTROS ADDONS
-- ========================================================================
_G["HaleckAccountImporter_ToggleUI"] = function()
    if (InCombatLockdown and InCombatLockdown()) or (_G["HaleckAccountImporter_IsInCombat"] and _G["HaleckAccountImporter_IsInCombat"]()) then
        print("|cffff9900[Haleck Importer]|r Você está em combate! Ações de interface protegidas estão bloqueadas temporariamente.")
        return
    end
    local win = HaleckAccountImporter_CreateUI()
    UpdateTopBanner(win)
    if win:IsShown() then win:Hide() else win:Show() end
end

_G["HaleckAccountImporter_OpenJournal"] = function()
    if (InCombatLockdown and InCombatLockdown()) or (_G["HaleckAccountImporter_IsInCombat"] and _G["HaleckAccountImporter_IsInCombat"]()) then
        print("|cffff9900[Haleck Importer]|r Você está em combate! Ações de interface protegidas estão bloqueadas temporariamente.")
        return
    end
    local win = HaleckAccountImporter_CreateUI()
    UpdateTopBanner(win)
    if not win:IsShown() then win:Show() end
    if _G["HAI_Tab2"] then _G["HAI_Tab2"]:Click() end
end

_G["HaleckAccountImporter_OpenExtraction"] = function()
    if (InCombatLockdown and InCombatLockdown()) or (_G["HaleckAccountImporter_IsInCombat"] and _G["HaleckAccountImporter_IsInCombat"]()) then
        print("|cffff9900[Haleck Importer]|r Você está em combate! Ações de interface protegidas estão bloqueadas temporariamente.")
        return
    end
    local win = HaleckAccountImporter_CreateUI()
    UpdateTopBanner(win)
    if not win:IsShown() then win:Show() end
    if _G["HAI_Tab1"] then _G["HAI_Tab1"]:Click() end
end

_G["HaleckAccountImporter_SaveSnapshot"] = function()
    if _G["HaleckAccountImporter_GenerateSnapshot"] then
        local snapshot = _G["HaleckAccountImporter_GenerateSnapshot"]()
        pcall(function() PlaySound(SOUNDKIT and SOUNDKIT.IG_MAINMENU_OPEN or 841) end)
        print("|cff00f2fe[Haleck Importer]|r Snapshot manual gerado e salvo em SavedVariables com sucesso!")
        ShowExportDialog(snapshot)
    end
end

addon.ToggleUI = _G["HaleckAccountImporter_ToggleUI"]
addon.OpenJournal = _G["HaleckAccountImporter_OpenJournal"]
addon.OpenExtraction = _G["HaleckAccountImporter_OpenExtraction"]
addon.SaveSnapshot = _G["HaleckAccountImporter_SaveSnapshot"]

-- Registrador de Inicialização
local loader = CreateFrame("Frame")
loader:RegisterEvent("PLAYER_LOGIN")
loader:SetScript("OnEvent", function(self, event)
    CreateMinimapButton()
end)
