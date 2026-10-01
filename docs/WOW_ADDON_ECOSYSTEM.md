# Ecossistema World of Warcraft, Addons & Diretrizes Blizzard API

Este documento técnico consolida toda a arquitetura de integração, fontes oficiais, compatibilidade de versões (Retail vs. Classic vs. WoW Forever) e as diretrizes de desenvolvimento de Addons em Lua.
**Objetivo:** Servir como base de conhecimento perene para qualquer ambiente de programação, vibe-coding, agentes autônomos ou desenvolvedores que trabalhem no site ou no Addon universal.

> 📘 **Manual Complementar de Engenharia de Addons:** Consulte também o arquivo [`/docs/WOW_ADDON_ENGINEERING_GUIDE.md`](./WOW_ADDON_ENGINEERING_GUIDE.md) para a análise exaustiva da arquitetura de 19 addons consagrados (Azeroth Fieldbook, ATT, Ace3, Horizon-Suite, DataStore, AtlasLoot, BugSack, etc.), receitas prontas de código e o modelo mental de engenharia.

---

## 🧭 Fontes de Documentação & Referências Oficiais Obrigatórias

1. **WoW Forever Wiki - Guia de AddOns & Vanilla+**:  
   [https://wowforeverwiki.org/addons](https://wowforeverwiki.org/addons)  
   Documentação oficial, diretrizes de compatibilidade e ecossistema Vanilla+ do WoW Forever.

2. **WoW Forever Beta Breaks: Secret Health Values & Dead Secure SNI**:  
   [https://wowforeverbuilds.com/news/what-the-wow-forever-beta-breaks-for-addons-secret-health-values-dead-secure-sni](https://wowforeverbuilds.com/news/what-the-wow-forever-beta-breaks-for-addons-secret-health-values-dead-secure-sni)  
   Análise profunda de mudanças de segurança no Beta e lançamento oficial de **04 de novembro de 2026**: proteção contra valores secretos de vida (`Secret Health Values`) e chamadas seguras (`Dead Secure SNI`).

3. **Programming in Lua (Manual Oficial)**:  
   [https://lua.org/pil/contents.html](https://lua.org/pil/contents.html)  
   Referência canônica de sintaxe Lua (5.1), estruturas de dados, metatables e ambientes de execução do WoW.

4. **WoW AddOn Tutorial & Fundamentos**:  
   [https://wowpedia.fandom.com/wiki/WoW_AddOn](https://wowpedia.fandom.com/wiki/WoW_AddOn)  
   Estrutura fundamental de arquivos (`.toc`, `.lua`, `.xml`), ciclo de vida e declaração de `SavedVariables`.

5. **WoWProgramming - API & Frame Reference**:  
   [https://wowprogramming.com](https://wowprogramming.com)  
   Dicionário de funções, eventos e widgets de interface com exemplos práticos.

6. **World of Warcraft API Oficial**:  
   [https://wowpedia.fandom.com/wiki/World_of_Warcraft_API](https://wowpedia.fandom.com/wiki/World_of_Warcraft_API)  
   Enciclopédia de funções globais e namespaces da Blizzard (`C_Container`, `C_Item`, `C_Spell`, `C_Bank`, etc.).

7. **Wago.tools - Data & DBC Browser**:  
   [https://wago.tools](https://wago.tools)  
   Navegação em dados brutos do cliente, tabelas DBC, Spells, ItemDisplayInfo e compilações.

8. **CurseForge Author Portal & Guidelines**:  
   [https://authors.curseforge.com/#/notfound](https://authors.curseforge.com/#/notfound)  
   Requisitos de empacotamento, compatibilidade e diretrizes de publicação de addons.

9. **Better-Addons: AI Coding Guide**:  
   [https://www.better-addons.com/ai-coding-guide/](https://www.better-addons.com/ai-coding-guide/)  
   Guia de engenharia de software e geração de código de addons WoW assistida por IA.

10. **The System Prompt para Addons**:  
    [https://www.better-addons.com/ai-coding-guide/#the-system-prompt](https://www.better-addons.com/ai-coding-guide/#the-system-prompt)  
    Contexto especializado e especificações para modelos de linguagem na geração de código WoW.

11. **The Deprecated Function Map**:  
    [https://www.better-addons.com/ai-coding-guide/#the-deprecated-function-map](https://www.better-addons.com/ai-coding-guide/#the-deprecated-function-map)  
    Mapeamento de funções legadas substituídas por namespaces `C_*` modernos.

12. **The Golden Rules of WoW Addon Coding**:  
    [https://www.better-addons.com/ai-coding-guide/#the-golden-rules](https://www.better-addons.com/ai-coding-guide/#the-golden-rules)  
    Regras de ouro de estabilidade: prevenção de taint, encapsulamento `pcall` e manipulação de eventos.

13. **Battle.net Game Data APIs (Blizzard Oficial - Retail)**:  
    [https://community.developer.battle.net/documentation/world-of-warcraft/game-data-apis](https://community.developer.battle.net/documentation/world-of-warcraft/game-data-apis)  
    Especificações oficiais de esquemas de dados da Blizzard para itens, equipamentos, criaturas, reinos, raças, classes, talentos e profissões no WoW Retail.

14. **Battle.net Profile APIs (Blizzard Oficial - Retail)**:  
    [https://community.developer.battle.net/documentation/world-of-warcraft/profile-apis](https://community.developer.battle.net/documentation/world-of-warcraft/profile-apis)  
    Documentação oficial das APIs de perfil de personagens no WoW Retail: Armory, estatísticas de combate, itens equipados com display IDs, transmogrificações, coleções de montarias e mascotes, reputações e dados semanais do The Great Vault / Mítico+.

15. **Battle.net Classic Game Data APIs (Blizzard Oficial - Classic)**:  
    [https://community.developer.battle.net/documentation/world-of-warcraft-classic/game-data-apis](https://community.developer.battle.net/documentation/world-of-warcraft-classic/game-data-apis)  
    Especificações oficiais das APIs REST dedicadas ao ecossistema Classic e Classic Era (World of Warcraft Classic), contendo esquemas de itens clássicos, índices de reinos e árvores de talentos originais.

16. **Battle.net Classic Profile APIs (Blizzard Oficial - Classic)**:  
    [https://community.developer.battle.net/documentation/world-of-warcraft-classic/profile-apis](https://community.developer.battle.net/documentation/world-of-warcraft-classic/profile-apis)  
    APIs oficiais de perfil para World of Warcraft Classic & Classic Era: Armory clássico de personagens, inventário de equipamentos equipados, reputações e status da guilda clássica.

17. **Warcraft Wiki - World of Warcraft API**:  
    [https://warcraft.wiki.gg/wiki/World_of_Warcraft_API](https://warcraft.wiki.gg/wiki/World_of_Warcraft_API)  
    Referência completa e mantida pela comunidade de funções globais, namespaces modernos C_ e eventos do cliente.

18. **Warcraft Wiki - Lua no World of Warcraft**:  
    [https://warcraft.wiki.gg/wiki/Lua](https://warcraft.wiki.gg/wiki/Lua)  
    Particularidades do ambiente de execução Lua 5.1 no WoW, sandbox, manipulação de tabelas e escopo de arquivos.

19. **Warcraft Wiki - Arquitetura FrameXML**:  
    [https://warcraft.wiki.gg/wiki/FrameXML](https://warcraft.wiki.gg/wiki/FrameXML)  
    Hierarquia de frames do WoW, templates de interface, camadas de desenho (strata) e renderização visual autêntica.

20. **Blizzard APIDocumentationGenerated (Gethe UI Source)**:  
    [https://github.com/Gethe/wow-ui-source/tree/live/Interface/AddOns/Blizzard_APIDocumentationGenerated](https://github.com/Gethe/wow-ui-source/tree/live/Interface/AddOns/Blizzard_APIDocumentationGenerated)  
    Repositório do código-fonte oficial gerado da Blizzard com definições exatas de APIs, estruturas e enums do FrameXML.

21. **Warcraft Wiki - Guia Canônico de AddOns**:  
    [https://warcraft.wiki.gg/wiki/AddOn](https://warcraft.wiki.gg/wiki/AddOn)  
    Estrutura de diretórios, carregamento de SavedVariables, eventos de ciclo de vida (`ADDON_LOADED`, `PLAYER_LOGIN`) e fechamento via ESC (`UISpecialFrames`).

22. **Warcraft Wiki - Scripts e Comandos de Macro (/script & /run)**:  
    [https://warcraft.wiki.gg/wiki/MACRO_script](https://warcraft.wiki.gg/wiki/MACRO_script)  
    Execução de código Lua via chat e macros, registro de comandos na `SlashCmdList`, limites de execução e exposição de funções de macro.

---

## 👑 Prioridade Absoluta: WoW Forever (Vanilla+)
- **Lançamento Oficial:** 04 de Novembro de 2026.
- **Papel:** Jogo principal do usuário. Todo o ecossistema deve priorizar funcionalidades e experiência impecáveis para o WoW Forever.
- **Ambiente Beta (Build 16001):** Embora ainda esteja em beta, o ambiente do site e do Addon já está 100% preparado para a transição para o lançamento oficial.
- **Proteções Críticas do Beta/Release:**
  - `Secret Health Values`: O cliente protege valores exatos de vida em combate. Addons não devem presumir números inteiros brutos sem `pcall` e checagens defensivas.
  - `Dead Secure SNI`: Comunicação e hooks de addons devem respeitar o sandbox de segurança sem disparar taints de execução.
  - `Rulesets Dinâmicos`: Detecção automática através de `GetRuleset()` ou `C_GameRules.GetRulesetName()` para aplicar balanceamento específico de servidor.

---

## ⚖️ Distinção Estrita de Versões do WoW no Site e no Addon

**Regra Inviolável:** A versão selecionada na ficha de edição do jogo (`wowVersion` / `blizzardGameId`) dita com precisão cirúrgica quais abas e dados são exibidos no Drawer e no Armory. Não misturar recursos exclusivos do Retail com versões Classic/Forever.

| Versão | Interface TOC | Banco & Economia | Endgame / PVE | Coleções & Modelos |
|---|---|---|---|---|
| **WoW Forever (Principal)** | `16001` | Banco Pessoal (28 slots), Reagentes, Economia de Alts. *(Sem Warband Bank)* | **Chefes Mundiais** (Lord Kazzak, Azuregos, Dragões do Pesadelo: Taerar, Ysondre, Lethon, Emeriss) + Timers de Respawn | Modelos 3D Vanilla+, Montarias clássicas, Títulos |
| **WoW Forever Beta** | `16001` | Banco Pessoal, Reagentes, Economia de Alts + `SafeCall` em todos os slots | Chefes Mundiais com cronômetros de respawn | Modelos 3D com fallback seguro |
| **WoW Classic Era** | `11506` | Banco Pessoal, Bolsas clássicas, Economia de Alts | **Chefes Mundiais** (Kazzak, Azuregos, Dragões do Pesadelo) | Modelos 3D Vanilla |
| **WoW Retail (The War Within / Midnight)** | `110100` | Banco Pessoal, Reagentes, **Cofre de Guerra (Warband Bank)** com abas de conta | **Mítico+ (Mythic Score, Keystone)** e **The Great Vault** (Raids, Dungeons, Delves) | Coleções completas (Montarias, Pets, Brinquedos, Transmogs) |
| **Classic MoP** | `50400` | Banco Pessoal e Reagentes | Raides de Pandaria & World Bosses (Sha of Anger, Galleon) | Coleções de MoP |
| **Classic TBC** | `20504` | Banco Pessoal e Reagentes | Raides de Outland & World Bosses (Doomwalker, Kazzak) | Modelos TBC |

---

## 📦 Arquitetura do Addon Universal (`HaleckAccountImporter`)

### 1. Prevenção de Taint (Regra de Ouro #1)
Nunca declarar variáveis ou funções utilitárias no escopo global `_G`. Todo o código vive dentro do escopo local injetado pelo FrameXML:
```lua
local ADDON_NAME, addon = ...
```

### 2. Chamadas Defensivas com `pcall` (Regra de Ouro #2)
Toda consulta a namespaces que variam entre versões deve ser envolvida em `pcall` ou checagem de existência:
```lua
local function SafeCall(fn, ...)
    local ok, res = pcall(fn, ...)
    if ok then return res end
    return nil
end
```

### 3. Ciclo de Vida dos Eventos
- `ADDON_LOADED`: Inicializa a tabela de `SavedVariables` (`HaleckAccountImporterDB`) apenas quando `arg1 == ADDON_NAME`.
- `BANK_FRAME_OPENED` / `BANKFRAME_OPENED`: Dispara varredura automática do banco do jogador (slots 1 a 28) e do Warband Bank (quando presente no Retail).
- `PLAYER_LOGOUT`: Salva o snapshot final da sessão com o ouro atualizado de todos os alts.
- `PLAYER_DEAD`: No modo Hardcore, salva instantaneamente o certificado de óbito com assassino, coordenadas e tempo de sobrevivência.

### 4. Sincronização Automática com o Site & Endpoints do Backend
- **Endpoint de Ingestão:** `POST /api/blizzard/wow/addon-sync` (aceita JSON estruturado ou código puro `rawLua` de `HaleckAccountImporter.lua`).
- **Endpoint de Todos os Personagens:** `GET /api/blizzard/wow/addon-sync/all` (retorna o somatório de ouro, todos os alts sincronizados e total de itens guardados).
- **Endpoint de Detecção de Caminhos:** `GET /api/blizzard/wow/addon-sync/detect-paths` (retorna a lista de diretórios padrão de instalação de cada versão, com destaque para `_classic_beta_`).
- **Endpoint de Economia Global:** `GET /api/blizzard/wow/addon-sync/account-economy` (fluxo de caixa, saldo por alt e delta de sessão).
- **Script de automação PowerShell:** `sync-agent.ps1` monitora o arquivo `.lua` em `WTF/Account/<NomeDaConta>/SavedVariables/HaleckAccountImporter.lua` e envia via HTTP para o site (`http://localhost:3000`).
- **Script de inicialização Batch:** `sync-agent.bat` localiza com prioridade máxima a pasta do WoW Forever Beta (`_classic_beta_`) e inicia o watcher.

---

## 📂 Diretórios Oficiais de Instalação e Caminhos por Versão do WoW

Um ponto crucial para automação e importação de dados é o mapeamento correto do diretório de cada versão:

| Versão do WoW | Pasta do Cliente | Caminho de AddOns | Caminho do SavedVariables |
|---|---|---|---|
| **WoW Forever Beta (Vanilla+ • Principal)** | `_classic_beta_` | `World of Warcraft/_classic_beta_/Interface/AddOns/` | `World of Warcraft/_classic_beta_/WTF/Account/<CONTA>/SavedVariables/HaleckAccountImporter.lua` |
| **WoW Forever Oficial (04/Nov/2026)** | `_classic_era_` ou `_forever_` | `World of Warcraft/_classic_era_/Interface/AddOns/` | `World of Warcraft/_classic_era_/WTF/Account/<CONTA>/SavedVariables/HaleckAccountImporter.lua` |
| **WoW Classic Era (1.15.x)** | `_classic_era_` | `World of Warcraft/_classic_era_/Interface/AddOns/` | `World of Warcraft/_classic_era_/WTF/Account/<CONTA>/SavedVariables/HaleckAccountImporter.lua` |
| **WoW Classic Progression (MoP/Cataclysm)** | `_classic_` | `World of Warcraft/_classic_/Interface/AddOns/` | `World of Warcraft/_classic_/WTF/Account/<CONTA>/SavedVariables/HaleckAccountImporter.lua` |
| **WoW Retail (The War Within 11.x)** | `_retail_` | `World of Warcraft/_retail_/Interface/AddOns/` | `World of Warcraft/_retail_/WTF/Account/<CONTA>/SavedVariables/HaleckAccountImporter.lua` |

> ⚠️ **Atenção Crítica de Desenvolvimento:** No instalador oficial e nos builds do WoW Forever Beta, o nome da pasta do jogo no disco vem escrito como **`_classic_beta_`** (por exemplo: `World of Warcraft/_classic_beta_/`). Todos os scripts de detecção, watchers e documentação devem sempre checar `_classic_beta_` como prioridade máxima para o WoW Forever.

---

## 📚 Catálogo Canônico de Fontes DB2, APIs & Versões do World of Warcraft

Para popular exaustivamente todas as entidades de ID do ecossistema, os vínculos relacionais entre eles e suportar a numeração específica de cada versão/expansão do jogo (como **WoW Forever 1.60** e **Retail 12.1**), o sistema adota as seguintes fontes canônicas:

### 1. Mapeamento de Versões do Cliente, Numerações TOC & Builds
Cada expansão e branch do World of Warcraft possui numeração de compilação, TOC e base de dados DB2 isolada:

| Versão / Expansão | Versão do Cliente | Build Canônico | Interface TOC | Diretório no Disco | DB2 Build Primário |
|---|---|---|---|---|---|
| **WoW Forever (Vanilla+ Prioritário)** | `1.60.x` | `1.60.1.70009` / `16001` | `160000` / `160001` | `_classic_beta_` | [wago.tools/db2?build=1.60.1.70009](https://wago.tools/db2?build=1.60.1.70009) |
| **WoW Classic Era** | `1.15.x` | `1.15.6.58238` | `11505` / `11506` | `_classic_era_` | [wago.tools/db2?build=1.15.6.58238](https://wago.tools/db2) |
| **Classic Progression (MoP/Cata)** | `4.4.x` / `5.4.x` | `4.4.1.57943` | `40400` / `50400` | `_classic_` | [wago.tools/db2?build=4.4.1.57943](https://wago.tools/db2) |
| **WotLK Classic** | `3.4.x` | `3.4.3.51699` | `30403` | `_classic_` | [wago.tools/db2](https://wago.tools/db2) |
| **TBC Classic** | `2.5.x` | `2.5.4.44833` | `20504` | `_classic_` | [wago.tools/db2](https://wago.tools/db2) |
| **Retail Atual (The War Within)** | `11.0.x` - `11.2.x` | `11.1.0.59340` | `110100` / `110200` | `_retail_` | [wago.tools/db2](https://wago.tools/db2) |
| **Retail Futuro (Midnight)** | `12.0.x` - `12.1.x` | `12.1.0.xxxxx` | `120000` / `120100` | `_retail_` | [wago.tools/db2](https://wago.tools/db2) |

---

### 2. Fontes Canônicas Oficiais por Categoria de ID

#### A. Arquitetura Global, FrameXML & Especificação TOC
- **Catálogo Geral DB2 ID:** [https://warcraft.wiki.gg/wiki/Category:DB2_ID](https://warcraft.wiki.gg/wiki/Category:DB2_ID)
- **World of Warcraft API Oficial:** [https://warcraft.wiki.gg/wiki/World_of_Warcraft_API](https://warcraft.wiki.gg/wiki/World_of_Warcraft_API)
- **Estrutura FrameXML:** [https://warcraft.wiki.gg/wiki/FrameXML](https://warcraft.wiki.gg/wiki/FrameXML)
- **Formato TOC & Numeração de Interface:** [https://warcraft.wiki.gg/wiki/TOC_format#Interface_version](https://warcraft.wiki.gg/wiki/TOC_format#Interface_version)
- **Repositório Código-fonte UI Oficial (Gethe):** [https://github.com/Gethe/wow-ui-source](https://github.com/Gethe/wow-ui-source)
- **Blizzard APIDocumentationGenerated:** [https://github.com/Gethe/wow-ui-source/tree/live/Interface/AddOns/Blizzard_APIDocumentationGenerated](https://github.com/Gethe/wow-ui-source/tree/live/Interface/AddOns/Blizzard_APIDocumentationGenerated)
- **Constantes FrameXML Base (Townlong Yak):** [https://www.townlong-yak.com/framexml/live/Blizzard_FrameXMLBase/Constants.lua#183](https://www.townlong-yak.com/framexml/live/Blizzard_FrameXMLBase/Constants.lua#183)
- **Wago.tools Central DB2:** [https://wago.tools/db2](https://wago.tools/db2)
- **Wago.tools WoW Forever Build 1.60.1:** [https://wago.tools/db2?build=1.60.1.70009](https://wago.tools/db2?build=1.60.1.70009)

#### B. Conquistas (Achievement ID)
- **Wiki Oficial:** [https://warcraft.wiki.gg/wiki/AchievementID](https://warcraft.wiki.gg/wiki/AchievementID)
- **Wowhead Character Achievements:** [https://www.wowhead.com/achievements/character-achievements](https://www.wowhead.com/achievements/character-achievements)
- **WoWDB Achievements:** [https://www.wowdb.com/achievements](https://www.wowdb.com/achievements)
- **DB2 Achievement (Geral):** [https://wago.tools/db2/Achievement](https://wago.tools/db2/Achievement)
- **DB2 Achievement Category:** [https://wago.tools/db2/Achievement_Category](https://wago.tools/db2/Achievement_Category)
- **DB2 Achievement (WoW Forever 1.60.1):** [https://wago.tools/db2/Achievement?build=1.60.1.70009](https://wago.tools/db2/Achievement?build=1.60.1.70009)

#### C. Itens, Display IDs, Transmogs & Encantamentos Visuais
- **DB2 Item (WoW Forever 1.60.1):** [https://wago.tools/db2/Item?build=1.60.1.70009](https://wago.tools/db2/Item?build=1.60.1.70009)
- **DB2 ItemAppearance (WoW Forever 1.60.1):** [https://wago.tools/db2/ItemAppearance?build=1.60.1.70009](https://wago.tools/db2/ItemAppearance?build=1.60.1.70009)
- **DB2 ItemModifiedAppearance:** [https://wow.tools/dbc/?dbc=itemmodifiedappearance.db2](https://wow.tools/dbc/?dbc=itemmodifiedappearance.db2)
- **Appearance ID:** [https://warcraft.wiki.gg/wiki/AppearanceID](https://warcraft.wiki.gg/wiki/AppearanceID)
- **Artifact Appearance ID:** [https://warcraft.wiki.gg/wiki/ArtifactAppearanceID](https://warcraft.wiki.gg/wiki/ArtifactAppearanceID)
- **Inventory Slot ID:** [https://warcraft.wiki.gg/wiki/InventorySlotID](https://warcraft.wiki.gg/wiki/InventorySlotID)
- **GlobalStrings Slot Search:** [https://wow.tools/dbc/?dbc=globalstrings#search=SLOT](https://wow.tools/dbc/?dbc=globalstrings#search=SLOT)
- **Transmog Set ID:** [https://warcraft.wiki.gg/wiki/TransmogSetID](https://warcraft.wiki.gg/wiki/TransmogSetID)
- **DB2 TransmogSet:** [https://wow.tools/dbc/?dbc=transmogset](https://wow.tools/dbc/?dbc=transmogset)
- **Weapon Enchant ID:** [https://warcraft.wiki.gg/wiki/WeaponEnchantID](https://warcraft.wiki.gg/wiki/WeaponEnchantID)
- **DB2 ItemVisuals:** [https://wow.tools/dbc/?dbc=itemvisuals.db2](https://wow.tools/dbc/?dbc=itemvisuals.db2)
- **DB2 SpellItemEnchantment:** [https://wow.tools/dbc/?dbc=spellitemenchantment.db2](https://wow.tools/dbc/?dbc=spellitemenchantment.db2)

#### D. Criaturas & Modelos 3D (Creature Display ID)
- **Creature Display ID:** [https://warcraft.wiki.gg/wiki/CreatureDisplayID](https://warcraft.wiki.gg/wiki/CreatureDisplayID)
- **DB2 CreatureDisplayInfo:** [https://wago.tools/db2/CreatureDisplayInfo](https://wago.tools/db2/CreatureDisplayInfo)

#### E. Montarias & Equipamento de Montaria (Mount ID)
- **Mount ID:** [https://warcraft.wiki.gg/wiki/MountID](https://warcraft.wiki.gg/wiki/MountID)
- **DB2 Mount (Geral):** [https://wago.tools/db2/Mount](https://wago.tools/db2/Mount)
- **DB2 Mount (WoW Forever 1.60.1):** [https://wago.tools/db2/Mount?build=1.60.1.70009](https://wago.tools/db2/Mount?build=1.60.1.70009)
- **Mount Equipment ID:** [https://warcraft.wiki.gg/wiki/MountEquipmentID](https://warcraft.wiki.gg/wiki/MountEquipmentID)
- **DB2 MountEquipment:** [https://wow.tools/dbc/?dbc=mountequipment.db2](https://wow.tools/dbc/?dbc=mountequipment.db2)

#### F. Mascotes de Batalha (Battle Pet IDs)
- **Battle Pet Species ID:** [https://warcraft.wiki.gg/wiki/BattlePetSpeciesID](https://warcraft.wiki.gg/wiki/BattlePetSpeciesID)
- **Battle Pet Type ID:** [https://warcraft.wiki.gg/wiki/BattlePetTypeID](https://warcraft.wiki.gg/wiki/BattlePetTypeID)

#### G. Classes, Raças & Especializações (Spec ID)
- **Class ID:** [https://warcraft.wiki.gg/wiki/ClassID](https://warcraft.wiki.gg/wiki/ClassID)
- **DB2 ChrClasses:** [https://wow.tools/dbc/?dbc=chrclasses.db2](https://wow.tools/dbc/?dbc=chrclasses.db2)
- **Race ID:** [https://warcraft.wiki.gg/wiki/RaceID](https://warcraft.wiki.gg/wiki/RaceID)
- **Specialization ID:** [https://warcraft.wiki.gg/wiki/SpecializationID](https://warcraft.wiki.gg/wiki/SpecializationID)
- **Spec ID:** [https://warcraft.wiki.gg/wiki/SpecID](https://warcraft.wiki.gg/wiki/SpecID)
- **DB2 ChrSpecialization (Wago):** [https://wago.tools/db2/ChrSpecialization](https://wago.tools/db2/ChrSpecialization)
- **DB2 ChrSpecialization (WoW.tools):** [https://wow.tools/dbc/?dbc=chrspecialization](https://wow.tools/dbc/?dbc=chrspecialization)

#### H. Moedas (Currency ID) & Loja de Conta
- **Currency ID:** [https://warcraft.wiki.gg/wiki/CurrencyID](https://warcraft.wiki.gg/wiki/CurrencyID)
- **DB2 CurrencyTypes:** [https://wago.tools/db2/CurrencyTypes](https://wago.tools/db2/CurrencyTypes)
- **DB2 AccountStoreCategory:** [https://wago.tools/db2/AccountStoreCategory](https://wago.tools/db2/AccountStoreCategory)
- **DB2 AccountStoreItem:** [https://wago.tools/db2/AccountStoreItem](https://wago.tools/db2/AccountStoreItem)
- **DB2 ActionBarGroup:** [https://wago.tools/db2/ActionBarGroup](https://wago.tools/db2/ActionBarGroup)

#### I. Facções & Reputações
- **Faction ID:** [https://warcraft.wiki.gg/wiki/FactionID](https://warcraft.wiki.gg/wiki/FactionID)
- **DB2 Faction:** [https://wago.tools/db2/Faction](https://wago.tools/db2/Faction)

#### J. Mapas, Zonas & Encontros de Masmorras / Raides
- **UiMap ID:** [https://warcraft.wiki.gg/wiki/UiMapID](https://warcraft.wiki.gg/wiki/UiMapID)
- **DB2 UiMap:** [https://wago.tools/db2/UiMap](https://wago.tools/db2/UiMap)
- **WorldMapArea ID:** [https://warcraft.wiki.gg/wiki/WorldMapAreaID](https://warcraft.wiki.gg/wiki/WorldMapAreaID)
- **Instance ID:** [https://warcraft.wiki.gg/wiki/InstanceID](https://warcraft.wiki.gg/wiki/InstanceID)
- **DB2 Map:** [https://wago.tools/db2/Map](https://wago.tools/db2/Map)
- **Difficulty ID:** [https://warcraft.wiki.gg/wiki/DifficultyID](https://warcraft.wiki.gg/wiki/DifficultyID)
- **Dungeon Encounter ID:** [https://warcraft.wiki.gg/wiki/DungeonEncounterID](https://warcraft.wiki.gg/wiki/DungeonEncounterID)
- **Journal Encounter ID:** [https://warcraft.wiki.gg/wiki/JournalEncounterID](https://warcraft.wiki.gg/wiki/JournalEncounterID)
- **DB2 JournalEncounter:** [https://wago.tools/db2/JournalEncounter](https://wago.tools/db2/JournalEncounter)
- **LFG Dungeon ID:** [https://warcraft.wiki.gg/wiki/LfgDungeonID](https://warcraft.wiki.gg/wiki/LfgDungeonID)
- **DB2 LFGDungeons:** [https://wago.tools/db2/LFGDungeons](https://wago.tools/db2/LFGDungeons)

#### K. Quests, Brinquedos (Toy ID) & Profissões
- **Quest ID:** [https://warcraft.wiki.gg/wiki/QuestID](https://warcraft.wiki.gg/wiki/QuestID)
- **Toy ID:** [https://warcraft.wiki.gg/wiki/ToyID](https://warcraft.wiki.gg/wiki/ToyID)
- **DB2 Toy:** [https://wago.tools/db2/Toy](https://wago.tools/db2/Toy)
- **TradeSkillLine ID:** [https://warcraft.wiki.gg/wiki/TradeSkillLineID](https://warcraft.wiki.gg/wiki/TradeSkillLineID)
- **DB2 SkillLine:** [https://wago.tools/db2/SkillLine](https://wago.tools/db2/SkillLine)

#### L. Arquivos do Cliente, Cenas 3D, Filmes, Guarnições & Idiomas
- **FileData ID:** [https://warcraft.wiki.gg/wiki/FileDataID](https://warcraft.wiki.gg/wiki/FileDataID)
- **Atlas ID:** [https://warcraft.wiki.gg/wiki/AtlasID](https://warcraft.wiki.gg/wiki/AtlasID)
- **ModelScene ID:** [https://warcraft.wiki.gg/wiki/ModelSceneID](https://warcraft.wiki.gg/wiki/ModelSceneID)
- **DB2 UiModelScene:** [https://bnet.marlam.in/dbc.php?dbc=uimodelscene.db2](https://bnet.marlam.in/dbc.php?dbc=uimodelscene.db2)
- **Movie ID:** [https://warcraft.wiki.gg/wiki/MovieID](https://warcraft.wiki.gg/wiki/MovieID)
- **DB2 Movie:** [https://wago.tools/db2/Movie](https://wago.tools/db2/Movie)
- **Plot ID:** [https://warcraft.wiki.gg/wiki/PlotID](https://warcraft.wiki.gg/wiki/PlotID)
- **Building ID:** [https://warcraft.wiki.gg/wiki/BuildingID](https://warcraft.wiki.gg/wiki/BuildingID)
- **Contribution ID:** [https://warcraft.wiki.gg/wiki/ContributionID](https://warcraft.wiki.gg/wiki/ContributionID)
- **DB2 Contribution:** [https://bnet.marlam.in/dbc.php?dbc=contribution.db2](https://bnet.marlam.in/dbc.php?dbc=contribution.db2)
- **Garrison Follower ID:** [https://warcraft.wiki.gg/wiki/GarrFollowerID](https://warcraft.wiki.gg/wiki/GarrFollowerID)
- **DB2 GarrFollower:** [https://wago.tools/db2/GarrFollower](https://wago.tools/db2/GarrFollower)
- **Language ID:** [https://warcraft.wiki.gg/wiki/LanguageID](https://warcraft.wiki.gg/wiki/LanguageID)
- **DB2 Languages:** [https://wago.tools/db2/Languages](https://wago.tools/db2/Languages)
- **UiWidgetSet ID:** [https://warcraft.wiki.gg/wiki/UiWidgetSetID](https://warcraft.wiki.gg/wiki/UiWidgetSetID)

---

## 🏛️ Portal Canônico de Customização de Interface, FrameXML & Widget API

Para o desenvolvimento, manipulação, engenharia reversa e criação de addons autênticos e livres de taint para o World of Warcraft (com foco prioritário no **WoW Forever Beta Build 16001** e **Classic Era**), as seguintes 9 fontes oficiais e documentações canônicas devem ser consultadas obrigatoriamente:

### 1. Repositório Código-Fonte Oficial da UI da Blizzard (Gethe wow-ui-source)
- **URL Canônica:** [https://github.com/Gethe/wow-ui-source](https://github.com/Gethe/wow-ui-source)
- **Papel na Arquitetura:** Extração direta e versionada de todo o FrameXML, SharedXML, Blizzard_APIDocumentationGenerated e templates de widgets oficiais da Blizzard em todas as branches (`live`, `classic`, `classic_era` e `classic_beta` para WoW Forever).
- **Como usar:** Consultar as definições originais de templates como `UIPanelDialogTemplate`, `UIPanelButtonTemplate`, `UIPanelCloseButton`, manipulação de texturas e assinaturas exatas de enums e estruturas.

### 2. Especificação e Sintaxe XML do FrameXML
- **URL Canônica:** [https://warcraft.wiki.gg/wiki/XML](https://warcraft.wiki.gg/wiki/XML)
- **Papel na Arquitetura:** Estrutura fundamental do XML no motor de interface do World of Warcraft. Define hierarquias `<Ui>`, `<Frame>`, `<Layer>`, `<Texture>`, `<FontString>` e injeção de scripts `<Scripts>`.
- **Como usar:** Criação declarativa de interfaces e carregamento de templates virtuais reutilizáveis (`virtual="true"`).

### 3. Sistema de Interface de Usuário em XML (XML User Interface)
- **URL Canônica:** [https://warcraft.wiki.gg/wiki/XML_user_interface](https://warcraft.wiki.gg/wiki/XML_user_interface)
- **Papel na Arquitetura:** Arquitetura de ancoragem (`<Anchors>`, `<Anchor point="..." relativeTo="..." relativePoint="..."/>`), herança de múltiplos templates (`inherits="..."`), gerenciamento de camadas visuais (`BACKGROUND`, `BORDER`, `ARTWORK`, `OVERLAY`, `HIGHLIGHT`) e tratamento de coordenadas relativas.
- **Como usar:** Estruturação espacial de janelas, sub-painéis e barras de rolagem compatíveis com a escala de renderização do cliente.

### 4. Sistema de Variáveis de Console (Console Variables / CVars)
- **URL Canônica:** [https://warcraft.wiki.gg/wiki/Console_variables](https://warcraft.wiki.gg/wiki/Console_variables)
- **Papel na Arquitetura:** Leitura e alteração de variáveis de console da Blizzard através de `GetCVar`, `SetCVar` e `C_CVar.GetCVar`.
- **Como usar:** Habilitar rastreamento de erros de script (`scriptErrors`), manipular zoom de câmera e ajustar comportamento de interface de combate sem disparar restrições de ambiente seguro.

### 5. Catálogo Canônico de Eventos do Motor (Events)
- **URL Canônica:** [https://warcraft.wiki.gg/wiki/Events](https://warcraft.wiki.gg/wiki/Events)
- **Papel na Arquitetura:** Matriz de eventos do cliente WoW despachados pelo motor C++ para o subsistema Lua.
- **Como usar:** Registro via `RegisterEvent` e manipulação segura no handler `OnEvent`. Filtrar eventos suportados pelo WoW Forever (`ADDON_LOADED`, `PLAYER_LOGIN`, `PLAYER_LOGOUT`, `BAG_UPDATE_DELAYED`, `PLAYER_MONEY`, `SPELLS_CHANGED`, `BOSS_KILL`, etc.) e evitar eventos inexistentes em Vanilla+ (como `LEARNED_SPELL_IN_TAB` ou eventos exclusivos do Retail).

### 6. Relação Completa de Handlers de Script em Widgets (Widget Script Handlers)
- **URL Canônica:** [https://warcraft.wiki.gg/wiki/Widget_script_handlers](https://warcraft.wiki.gg/wiki/Widget_script_handlers)
- **Papel na Arquitetura:** Todos os manipuladores de script suportados por objetos de interface: `OnLoad`, `OnEvent`, `OnShow`, `OnHide`, `OnClick`, `OnEnter`, `OnLeave`, `OnMouseDown`, `OnMouseUp`, `OnMouseWheel`, `OnDragStart`, `OnDragStop`, `OnUpdate`, `OnChar`, `OnKeyDown`, `OnKeyUp`.
- **Como usar:** Implementar arrasto do botão de minimapa (`OnDragStart`/`OnDragStop`), tooltips informativos (`OnEnter`/`OnLeave`), rolagem dinâmica de listas e transição suave entre abas.

### 7. API de Manipulação Segura de Scripts (ScriptObject API)
- **URL Canônica:** [https://warcraft.wiki.gg/wiki/ScriptObject_API](https://warcraft.wiki.gg/wiki/ScriptObject_API)
- **Papel na Arquitetura:** Métodos canônicos `HookScript`, `SetScript`, `GetScript` e `HasScript`.
- **Como usar:** Utilizar primordialmente `HookScript` para estender comportamento de frames existentes da Blizzard sem sobrescrever handlers nativos, prevenindo quebras de execução e taints de segurança.

### 8. API Universal de Widgets do WoW (Widget API)
- **URL Canônica:** [https://warcraft.wiki.gg/wiki/Widget_API](https://warcraft.wiki.gg/wiki/Widget_API)
- **Papel na Arquitetura:** Manual de métodos para todos os tipos de widget: Frame, Button, CheckButton, EditBox, ScrollFrame, Slider, StatusBar, Texture, FontString.
- **Como usar:** Configuração completa em tempo de execução via Lua: `SetPoint`, `SetSize`, `SetBackdrop`, `SetBackdropColor`, `SetBackdropBorderColor`, `SetTexture`, `SetTexCoord`, `SetText`, `SetFontObject`, `EnableMouse`, `SetMovable`, `SetFrameStrata`.

### 9. Portal Central de Customização de Interface (Interface Customization)
- **URL Canônica:** [https://warcraft.wiki.gg/wiki/Warcraft_Wiki:Interface_customization](https://warcraft.wiki.gg/wiki/Warcraft_Wiki:Interface_customization)
- **Papel na Arquitetura:** Hub enciclopédico de design de addons, boas práticas de interface, anatomia de arquivos `.toc`, convenções de áudio/som (`PlaySound`) e conformidade com as políticas de desenvolvedores da Blizzard.
- **Como usar:** Padrão arquitetural e diretrizes visuais para garantir que o addon `HaleckAccountImporter` e a interface `AddonInterface.lua` sigam a identidade clássica autêntica de World of Warcraft.

