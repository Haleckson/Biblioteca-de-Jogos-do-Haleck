# Ecossistema World of Warcraft, Addons & Diretrizes Blizzard API

Este documento técnico consolida toda a arquitetura de integração, fontes oficiais, compatibilidade de versões (Retail vs. Classic vs. WoW Forever) e as diretrizes de desenvolvimento de Addons em Lua.
**Objetivo:** Servir como base de conhecimento perene para qualquer ambiente de programação, vibe-coding, agentes autônomos ou desenvolvedores que trabalhem no site ou no Addon universal.

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
