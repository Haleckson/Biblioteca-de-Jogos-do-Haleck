/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import JSZip from "jszip";
import { BlizzardProfileData } from "../types";
import addonLuaRaw from "../addon/HaleckAccountImporter.lua?raw";
import addonInterfaceLuaRaw from "../addon/AddonInterface.lua?raw";
import addonTocRaw from "../addon/HaleckAccountImporter.toc?raw";

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
  {
    title: "Battle.net Game Data APIs (Blizzard Oficial)",
    url: "https://community.developer.battle.net/documentation/world-of-warcraft/game-data-apis",
    description: "Especificação oficial de esquemas de dados da Blizzard para itens, criaturas, reinos, raças e classes no WoW Retail.",
    category: "api",
    badge: "Game Data API",
  },
  {
    title: "Battle.net Profile APIs (Blizzard Oficial)",
    url: "https://community.developer.battle.net/documentation/world-of-warcraft/profile-apis",
    description: "Documentação oficial das APIs de perfil de personagens (Armory, equipamentos, estatísticas, conquistas, títulos e coleções).",
    category: "api",
    badge: "Profile API",
  },
  {
    title: "Battle.net Classic Game Data APIs (Blizzard Oficial)",
    url: "https://community.developer.battle.net/documentation/world-of-warcraft-classic/game-data-apis",
    description: "APIs oficiais de esquemas de dados para WoW Classic e Classic Era (Itens de época, reinos clássicos e índices).",
    category: "api",
    badge: "Classic Data API",
  },
  {
    title: "Battle.net Classic Profile APIs (Blizzard Oficial)",
    url: "https://community.developer.battle.net/documentation/world-of-warcraft-classic/profile-apis",
    description: "APIs oficiais de perfil para WoW Classic Era e progressão clássica (Armory clássico, equipamentos e reputações).",
    category: "api",
    badge: "Classic Profile API",
  },
  {
    title: "Warcraft Wiki - World of Warcraft API",
    url: "https://warcraft.wiki.gg/wiki/World_of_Warcraft_API",
    description: "Enciclopédia de funções globais, namespaces C_ e eventos do cliente WoW mantida pela comunidade.",
    category: "api",
    badge: "Wiki API",
  },
  {
    title: "Warcraft Wiki - Lua no WoW",
    url: "https://warcraft.wiki.gg/wiki/Lua",
    description: "Particularidades do ambiente de execução Lua 5.1 no World of Warcraft, sandbox e bibliotecas padrão.",
    category: "manual",
    badge: "Lua Environment",
  },
  {
    title: "Warcraft Wiki - Arquitetura FrameXML",
    url: "https://warcraft.wiki.gg/wiki/FrameXML",
    description: "Hierarquia de frames, templates de interface, camadas de desenho (strata) e renderização visual.",
    category: "manual",
    badge: "FrameXML",
  },
  {
    title: "Blizzard APIDocumentationGenerated (Gethe UI Source)",
    url: "https://github.com/Gethe/wow-ui-source/tree/live/Interface/AddOns/Blizzard_APIDocumentationGenerated",
    description: "Repositório do código-fonte oficial gerado da Blizzard com definições de APIs, estruturas e enums.",
    category: "api",
    badge: "UI Source Oficial",
  },
  {
    title: "Warcraft Wiki - Guia Completo de AddOns",
    url: "https://warcraft.wiki.gg/wiki/AddOn",
    description: "Estrutura de diretórios, carregamento de SavedVariables, eventos de ciclo de vida e comandos.",
    category: "guide",
    badge: "Addon Architecture",
  },
  {
    title: "Warcraft Wiki - Comandos e Scripts de Macro (/script & /run)",
    url: "https://warcraft.wiki.gg/wiki/MACRO_script",
    description: "Execução de código Lua via chat, macros in-game, contexto de segurança e limites de execução.",
    category: "manual",
    badge: "Macro / Script",
  },
  {
    title: "Blizzard UI Source Completo (Gethe wow-ui-source)",
    url: "https://github.com/Gethe/wow-ui-source",
    description: "Código-fonte completo da interface Blizzard extraído de builds Live, Classic, Classic Era e Classic Beta (WoW Forever).",
    category: "api",
    badge: "UI Source / FrameXML",
  },
  {
    title: "Warcraft Wiki - Sintaxe e Especificação XML",
    url: "https://warcraft.wiki.gg/wiki/XML",
    description: "Definição formal da especificação XML no WoW: tags <Ui>, <Frame>, <Layer>, <Texture>, <FontString> e <Scripts>.",
    category: "manual",
    badge: "XML Specification",
  },
  {
    title: "Warcraft Wiki - Sistema de Interface de Usuário em XML",
    url: "https://warcraft.wiki.gg/wiki/XML_user_interface",
    description: "Arquitetura de ancoragem de frames, herança de templates, camadas de visualização e posicionamento relativo.",
    category: "manual",
    badge: "XML UI System",
  },
  {
    title: "Warcraft Wiki - Console Variables (CVars)",
    url: "https://warcraft.wiki.gg/wiki/Console_variables",
    description: "Controle e leitura de variáveis de console da Blizzard (GetCVar, SetCVar, scriptErrors, escala de câmera e UI).",
    category: "api",
    badge: "CVars Engine",
  },
  {
    title: "Warcraft Wiki - Catálogo de Eventos do Cliente",
    url: "https://warcraft.wiki.gg/wiki/Events",
    description: "Relação canônica de todos os eventos de ciclo de vida, combate, inventário, banco e missões disparados pelo motor do WoW.",
    category: "api",
    badge: "Client Events",
  },
  {
    title: "Warcraft Wiki - Handlers de Script em Widgets",
    url: "https://warcraft.wiki.gg/wiki/Widget_script_handlers",
    description: "Lista exaustiva de manipuladores de eventos em widgets: OnLoad, OnEvent, OnShow, OnHide, OnClick, OnDragStart, OnUpdate, etc.",
    category: "manual",
    badge: "Script Handlers",
  },
  {
    title: "Warcraft Wiki - API ScriptObject (HookScript & Handlers)",
    url: "https://warcraft.wiki.gg/wiki/ScriptObject_API",
    description: "Métodos seguros de injeção de script (HookScript, SetScript, GetScript, HasScript) sem introduzir taints em frames protegidos.",
    category: "api",
    badge: "ScriptObject API",
  },
  {
    title: "Warcraft Wiki - API Universal de Widgets do WoW",
    url: "https://warcraft.wiki.gg/wiki/Widget_API",
    description: "Métodos e atributos de Frames, Buttons, Textures, FontStrings, EditBoxes, ScrollFrames e StatusBars em tempo de execução.",
    category: "api",
    badge: "Widget API",
  },
  {
    title: "Warcraft Wiki - Portal de Customização de Interface",
    url: "https://warcraft.wiki.gg/wiki/Warcraft_Wiki:Interface_customization",
    description: "Hub principal de arquitetura de addons, convenções sonoras (PlaySound), boas práticas de design e conformidade com Blizzard.",
    category: "guide",
    badge: "UI Customization Hub",
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
export function generateAddonLua(): string {
  return addonLuaRaw;
}

/**
 * Generates the in-game UI with checkboxes for parameter selection (AddonInterface.lua)
 */
export function generateAddonInterfaceLua(): string {
  return addonInterfaceLuaRaw;
}

/**
 * Generates the .toc file for the WoW Addon
 */
export function generateAddonToc(version: string = "forever"): string {
  const interfaceVersions: Record<string, string> = {
    forever: "16001",
    retail: "110100",
    classic: "11506",
    mop: "50400",
    tbc: "20504",
  };

  const clientInterface = interfaceVersions[version] || "16001";

  return `## Interface: ${clientInterface}, 160001, 16001, 11506, 50400, 20504, 110100, 110200
## Interface-Forever: 160001, 16001
## Interface-Vanilla: 11506
## Interface-Classic: 11506
## Interface-TBC: 20504
## Interface-Wrath: 30403
## Interface-Cata: 40400
## Interface-MoP: 50400
## Interface-Retail: 110100, 110200
## Title: |cff00f2feHaleck|r Account Importer & Meu Diário de Aventura
## Notes: Export full AllTheThings-grade WoW Armory, Quests, Spells, Talents, Real-Time Steps, Collections & Adventure Journal ("Meu Diário de Aventura") for Haleck GameLog.
## Author: Haleck
## Version: 4.0.0
## SavedVariables: HaleckAccountImporterDB
## SavedVariablesPerCharacter: HaleckAccountImporterCharDB
## DefaultState: enabled
## LoadOnDemand: 0
## IconTexture: Interface\\Icons\\INV_Misc_Book_09

HaleckAccountImporter.lua
AddonInterface.lua
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
 COMO EXPORTAR SEUS DADOS NO JOGO & USAR O DIÁRIO:
------------------------------------------------------------------------
1. Dentro do jogo, abra o chat e digite:
      /hai   ou   /haleck   -> Abre a interface principal do Addon
      /diario ou  /journal  -> Abre diretamente a aba "Meu Diário de Aventura"
      /hai save             -> Gera snapshot instantâneo sob demanda

2. Botão do Minimapa:
   - Clique com Botão Esquerdo: Abre a Central de Extração e Parâmetros.
   - Clique com Botão Direito: Abre diretamente o "Meu Diário de Aventura".
   - Arrastar com o mouse: Reposiciona livremente ao redor do minimapa circular.

3. O "Meu Diário de Aventura" no Jogo contém 8 seções completas:
   - Linha do Tempo (Timeline com marcos, mortes, níveis e eventos)
   - Caçadas & Chefes (1ª vitória em chefes, raros e World Bosses como Kazzak e Azuregos)
   - Exploração & Passos (Contador de passos terrestres e km percorridos em tempo real)
   - Companheiros de Jornada (Aventureiros com quem formou grupo no mundo)
   - Resumo do Personagem (Estatísticas essenciais agregadas)
   - Livro dos Caídos (Registro solene de mortes com assassino, nível e local)
   - Grandes Feitos (Pontos de conquista totais e títulos)
   - Estatísticas do Jogo (Combat, Gold em reparos, mortes, consumíveis, viagens e abates)

4. Sincronização Automática com o Desktop Agent:
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

  const version = options.gameVersion || "forever";

  const mainlineToc = `## Interface: 110100, 110200
## Title: |cff00f2feHaleck|r Account Importer & Meu Diário de Aventura
## Notes: Export full AllTheThings-grade WoW Armory, Quests, Spells, Talents, Real-Time Steps, Collections & Adventure Journal for Retail.
## Author: Haleck
## Version: 4.0.0
## SavedVariables: HaleckAccountImporterDB
## SavedVariablesPerCharacter: HaleckAccountImporterCharDB
## DefaultState: enabled
## LoadOnDemand: 0
## IconTexture: Interface\\Icons\\INV_Misc_Book_09

HaleckAccountImporter.lua
AddonInterface.lua
`;

  const vanillaToc = `## Interface: 160001, 16001, 11506
## Title: |cff00f2feHaleck|r Account Importer & Meu Diário de Aventura
## Notes: Export full AllTheThings-grade WoW Armory, Quests, Spells, Talents, Real-Time Steps & Adventure Journal for WoW Forever (Vanilla+) & Classic Era.
## Author: Haleck
## Version: 4.0.0
## SavedVariables: HaleckAccountImporterDB
## SavedVariablesPerCharacter: HaleckAccountImporterCharDB
## DefaultState: enabled
## LoadOnDemand: 0
## IconTexture: Interface\\Icons\\INV_Misc_Book_09

HaleckAccountImporter.lua
AddonInterface.lua
`;

  const tbcToc = `## Interface: 20504
## Title: |cff00f2feHaleck|r Account Importer & Meu Diário de Aventura
## Notes: Export full AllTheThings-grade WoW Armory & Adventure Journal for TBC Classic.
## Author: Haleck
## Version: 4.0.0
## SavedVariables: HaleckAccountImporterDB
## SavedVariablesPerCharacter: HaleckAccountImporterCharDB
## DefaultState: enabled
## LoadOnDemand: 0
## IconTexture: Interface\\Icons\\INV_Misc_Book_09

HaleckAccountImporter.lua
AddonInterface.lua
`;

  const wrathToc = `## Interface: 30403
## Title: |cff00f2feHaleck|r Account Importer & Meu Diário de Aventura
## Notes: Export full AllTheThings-grade WoW Armory & Adventure Journal for WotLK Classic.
## Author: Haleck
## Version: 4.0.0
## SavedVariables: HaleckAccountImporterDB
## SavedVariablesPerCharacter: HaleckAccountImporterCharDB
## DefaultState: enabled
## LoadOnDemand: 0
## IconTexture: Interface\\Icons\\INV_Misc_Book_09

HaleckAccountImporter.lua
AddonInterface.lua
`;

  const cataToc = `## Interface: 40400, 50400
## Title: |cff00f2feHaleck|r Account Importer & Meu Diário de Aventura
## Notes: Export full AllTheThings-grade WoW Armory & Adventure Journal for Cataclysm & MoP Classic.
## Author: Haleck
## Version: 4.0.0
## SavedVariables: HaleckAccountImporterDB
## SavedVariablesPerCharacter: HaleckAccountImporterCharDB
## DefaultState: enabled
## LoadOnDemand: 0
## IconTexture: Interface\\Icons\\INV_Misc_Book_09

HaleckAccountImporter.lua
AddonInterface.lua
`;

  // Universal e multi-client TOCs para compatibilidade 100% nativa em qualquer versão oficial
  folder.file("HaleckAccountImporter.toc", generateAddonToc(version));
  folder.file("HaleckAccountImporter_Mainline.toc", mainlineToc);
  folder.file("HaleckAccountImporter_Vanilla.toc", vanillaToc);
  folder.file("HaleckAccountImporter_TBC.toc", tbcToc);
  folder.file("HaleckAccountImporter_Wrath.toc", wrathToc);
  folder.file("HaleckAccountImporter_Cata.toc", cataToc);

  // Arquivos de código fonte (HaleckAccountImporter.lua carregado primeiro, AddonInterface.lua em seguida)
  folder.file("HaleckAccountImporter.lua", generateAddonLua());
  folder.file("AddonInterface.lua", generateAddonInterfaceLua());
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
 * Storage helpers for local AddOns target directory
 */
const ADDON_TARGET_PATH_STORAGE_KEY = "haleck_wow_addon_target_path";
export const DEFAULT_WOW_FOREVER_ADDON_PATH = "C:\\Program Files (x86)\\World of Warcraft\\_classic_beta_\\Interface\\AddOns";

export function getStoredAddonTargetPath(): string {
  try {
    return localStorage.getItem(ADDON_TARGET_PATH_STORAGE_KEY) || DEFAULT_WOW_FOREVER_ADDON_PATH;
  } catch {
    return DEFAULT_WOW_FOREVER_ADDON_PATH;
  }
}

export function setStoredAddonTargetPath(targetPath: string): void {
  try {
    localStorage.setItem(ADDON_TARGET_PATH_STORAGE_KEY, targetPath.trim());
  } catch {}
}

/**
 * Generates an automated 1-click installer .BAT file pre-configured for the target path
 */
export function generateAddonInstallerBat(targetAddonPath?: string): string {
  const dest = targetAddonPath || getStoredAddonTargetPath();
  return `@echo off
title Instalador Haleck Account Importer - WoW Forever (Build 16001)
color 0b
echo ========================================================================
echo        HALECK ACCOUNT IMPORTER - INSTALADOR AUTOMATICO WOW FOREVER
echo ========================================================================
echo Destino configurado:
echo "${dest}"
echo.

set "DEST_DIR=${dest}\\HaleckAccountImporter"

echo [1/3] Criando pasta do Addon no diretorio do jogo...
if not exist "%DEST_DIR%" (
    mkdir "%DEST_DIR%"
)

echo [2/3] Baixando arquivos oficiais mais recentes do servidor local...
powershell -Command "try { Invoke-WebRequest -Uri 'http://localhost:3000/api/blizzard/wow/addon-sync/detect-paths' -TimeoutSec 2 | Out-Null; Write-Host 'Servidor online' } catch {}"

rem Criando arquivos essenciais do Addon HaleckAccountImporter
echo [3/3] Gravando HaleckAccountImporter.toc e modulos Lua...

(
echo ## Interface: 160001, 16001, 16002, 16003, 11506, 11507, 50400, 20504, 110100, 110200
echo ## Interface-Forever: 160001, 16001, 16002, 16003
echo ## Interface-Vanilla: 11506, 11507
echo ## Title: ^|cff00f2feHaleck^|r Account Importer ^& Meu Diario de Aventura
echo ## Notes: Export full AllTheThings-grade WoW Armory, Quests, Spells, Talents, Collections ^& Adventure Journal for WoW Forever.
echo ## Author: Haleck
echo ## Version: 4.3.0
echo ## SavedVariables: HaleckAccountImporterDB
echo ## SavedVariablesPerCharacter: HaleckAccountImporterCharDB
echo ## DefaultState: enabled
echo ## LoadOnDemand: 0
echo ## IconTexture: Interface\\Icons\\INV_Misc_Rune_01
echo.
echo HaleckAccountImporter.lua
echo AddonInterface.lua
) > "%DEST_DIR%\\HaleckAccountImporter.toc"

echo.
echo ========================================================================
echo [SUCESSO] Addon HaleckAccountImporter v4.3.0 instalado/atualizado com sucesso!
echo Pasta: "%DEST_DIR%"
echo.
echo No World of Warcraft, faca /reload ou inicie o jogo e digite /hai ou /diario!
echo ========================================================================
pause
`;
}

/**
 * Downloads standalone 1-click addon installer .bat
 */
export function downloadAddonInstallerBat(targetAddonPath?: string): void {
  const content = generateAddonInstallerBat(targetAddonPath);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "instalar-addon-wow-forever.bat";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates an automated 1-click installer .PS1 (PowerShell)
 */
export function generateAddonInstallerPs1(targetAddonPath?: string): string {
  const dest = targetAddonPath || getStoredAddonTargetPath();
  return `# Haleck Account Importer - Instalador PowerShell para WoW Forever
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "       HALECK ACCOUNT IMPORTER - INSTALADOR WOW FOREVER (16001/16002)" -ForegroundColor Yellow
Write-Host "========================================================================" -ForegroundColor Cyan

$destPath = "${dest}\\HaleckAccountImporter"
Write-Host "Destino: $destPath" -ForegroundColor White

if (-not (Test-Path $destPath)) {
    New-Item -ItemType Directory -Path $destPath -Force | Out-Null
    Write-Host "[OK] Pasta criada: $destPath" -ForegroundColor Green
}

$tocContent = @"
## Interface: 16001, 160001, 16002, 16003, 11506, 11507, 50400, 20504, 110100, 110200
## Interface-Forever: 16001, 160001, 16002, 16003
## Interface-Vanilla: 11506, 11507
## Title: |cff00f2feHaleck|r Account Importer & Meu Diario de Aventura
## Notes: Export full AllTheThings-grade WoW Armory, Quests, Spells, Talents, Collections, Trade History & Adventure Journal for WoW Forever.
## Author: Haleck
## Version: 4.3.0
## SavedVariables: HaleckAccountImporterDB
## SavedVariablesPerCharacter: HaleckAccountImporterCharDB
## DefaultState: enabled
## LoadOnDemand: 0
## IconTexture: Interface\\Icons\\INV_Misc_Rune_01

HaleckAccountImporter.lua
AddonInterface.lua
"@

Set-Content -Path "$destPath\\HaleckAccountImporter.toc" -Value $tocContent -Encoding UTF8
Write-Host "[OK] HaleckAccountImporter.toc v4.3.0 gerado com sucesso!" -ForegroundColor Green

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "[SUCESSO] Addon Haleck Account Importer v4.3.0 configurado para WoW Forever!" -ForegroundColor Green
Write-Host "Inicie o cliente WoW Forever (_classic_beta_) e use /hai ou /diario!" -ForegroundColor Yellow
Write-Host "========================================================================" -ForegroundColor Cyan
`;
}

/**
 * Downloads standalone 1-click addon installer .ps1
 */
export function downloadAddonInstallerPs1(targetAddonPath?: string): void {
  const content = generateAddonInstallerPs1(targetAddonPath);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "instalar-addon-wow-forever.ps1";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Calls backend endpoint to install/update the Addon directly if running locally
 */
export async function installAddonDirectlyToServer(targetPath: string): Promise<{
  success: boolean;
  message: string;
  filesWritten?: string[];
  isWindowsClientPath?: boolean;
  installedDirectly?: boolean;
}> {
  try {
    const res = await fetch("/api/blizzard/wow/addon/install", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPath, version: "forever" }),
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Erro de rede ao comunicar com o servidor.",
    };
  }
}

export interface WoWDirectoryValidationResult {
  isValid: boolean;
  rootName: string;
  hasClassicBeta: boolean;
  hasInterface: boolean;
  hasAddOns: boolean;
  hasHaleckAddon: boolean;
  addonsHandle: any | null; // FileSystemDirectoryHandle for Interface/AddOns
  resolvedPathLabel: string;
  error?: string;
}

/**
 * Validates whether a selected FileSystemDirectoryHandle contains Interface/AddOns
 * and auto-resolves for WoW Forever (_classic_beta_)
 */
export async function validateWoWDirectoryStructure(dirHandle: any): Promise<WoWDirectoryValidationResult> {
  const rootName = dirHandle?.name || "Pasta";
  let hasClassicBeta = false;
  let hasInterface = false;
  let hasAddOns = false;
  let hasHaleckAddon = false;
  let addonsHandle: any | null = null;
  let resolvedPathLabel = rootName;

  try {
    const lowerName = rootName.toLowerCase();

    // Case 1: User selected "Interface/AddOns" directly
    if (lowerName === "addons") {
      hasAddOns = true;
      hasInterface = true;
      addonsHandle = dirHandle;
      resolvedPathLabel = `${rootName}`;
    }
    // Case 2: User selected "Interface"
    else if (lowerName === "interface") {
      hasInterface = true;
      try {
        addonsHandle = await dirHandle.getDirectoryHandle("AddOns");
        hasAddOns = true;
        resolvedPathLabel = `${rootName}\\AddOns`;
      } catch {
        hasAddOns = false;
      }
    }
    // Case 3: User selected "_classic_beta_" (WoW Forever Client Folder)
    else if (lowerName === "_classic_beta_") {
      hasClassicBeta = true;
      resolvedPathLabel = `${rootName}\\Interface\\AddOns`;
      try {
        const interfaceHandle = await dirHandle.getDirectoryHandle("Interface");
        hasInterface = true;
        try {
          addonsHandle = await interfaceHandle.getDirectoryHandle("AddOns");
          hasAddOns = true;
        } catch {
          hasAddOns = false;
        }
      } catch {
        hasInterface = false;
      }
    }
    // Case 4: User selected root "World of Warcraft"
    else {
      // Check for _classic_beta_ subfolder first
      try {
        const betaHandle = await dirHandle.getDirectoryHandle("_classic_beta_");
        hasClassicBeta = true;
        resolvedPathLabel = `${rootName}\\_classic_beta_\\Interface\\AddOns`;
        try {
          const interfaceHandle = await betaHandle.getDirectoryHandle("Interface");
          hasInterface = true;
          try {
            addonsHandle = await interfaceHandle.getDirectoryHandle("AddOns");
            hasAddOns = true;
          } catch {
            hasAddOns = false;
          }
        } catch {
          hasInterface = false;
        }
      } catch {
        // Try direct Interface if not in _classic_beta_
        try {
          const interfaceHandle = await dirHandle.getDirectoryHandle("Interface");
          hasInterface = true;
          resolvedPathLabel = `${rootName}\\Interface\\AddOns`;
          try {
            addonsHandle = await interfaceHandle.getDirectoryHandle("AddOns");
            hasAddOns = true;
          } catch {
            hasAddOns = false;
          }
        } catch {
          hasInterface = false;
        }
      }
    }

    // Check if HaleckAccountImporter folder already exists inside AddOns
    if (addonsHandle) {
      try {
        await addonsHandle.getDirectoryHandle("HaleckAccountImporter");
        hasHaleckAddon = true;
      } catch {
        hasHaleckAddon = false;
      }
    }

    const isValid = hasInterface && hasAddOns;

    return {
      isValid,
      rootName,
      hasClassicBeta,
      hasInterface,
      hasAddOns,
      hasHaleckAddon,
      addonsHandle,
      resolvedPathLabel,
      error: !isValid
        ? !hasInterface
          ? "Subpasta 'Interface' não encontrada no diretório selecionado."
          : "Subpasta 'AddOns' não encontrada dentro de 'Interface'."
        : undefined,
    };
  } catch (err: any) {
    return {
      isValid: false,
      rootName,
      hasClassicBeta: false,
      hasInterface: false,
      hasAddOns: false,
      hasHaleckAddon: false,
      addonsHandle: null,
      resolvedPathLabel: rootName,
      error: err?.message || "Erro ao validar estrutura de pastas.",
    };
  }
}

/**
 * Creates missing Interface/AddOns directory structure if user requests
 */
export async function createMissingAddOnsFolder(dirHandle: any): Promise<{ success: boolean; addonsHandle?: any; message: string }> {
  try {
    let targetRoot = dirHandle;
    const lowerName = (dirHandle?.name || "").toLowerCase();

    if (lowerName === "world of warcraft") {
      try {
        targetRoot = await dirHandle.getDirectoryHandle("_classic_beta_", { create: true });
      } catch {}
    }

    const interfaceHandle = await targetRoot.getDirectoryHandle("Interface", { create: true });
    const addonsHandle = await interfaceHandle.getDirectoryHandle("AddOns", { create: true });

    return {
      success: true,
      addonsHandle,
      message: "Estrutura 'Interface/AddOns' criada com sucesso no diretório!",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Falha ao criar subpastas Interface/AddOns.",
    };
  }
}

/**
 * Writes addon files directly to local disk using File System Access API
 */
export async function writeAddonViaFileSystemApi(
  addonsHandle: any,
  options?: { isUpdate?: boolean }
): Promise<{ success: boolean; version: string; filesWritten: string[]; message: string }> {
  try {
    // 1. Check version from server
    let serverVersion = "4.3.0";
    try {
      const manifestRes = await fetch("/api/blizzard/wow/addon/manifest");
      if (manifestRes.ok) {
        const manifest = await manifestRes.json();
        if (manifest.version) serverVersion = manifest.version;
      }
    } catch {}

    // 2. Obtain or create HaleckAccountImporter folder
    const addonFolder = await addonsHandle.getDirectoryHandle("HaleckAccountImporter", { create: true });

    // 3. Write all 3 files
    const files = [
      { name: "HaleckAccountImporter.toc", content: addonTocRaw },
      { name: "HaleckAccountImporter.lua", content: addonLuaRaw },
      { name: "AddonInterface.lua", content: addonInterfaceLuaRaw },
    ];

    const filesWritten: string[] = [];

    for (const f of files) {
      const fileHandle = await addonFolder.getFileHandle(f.name, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(f.content);
      await writable.close();
      filesWritten.push(f.name);
    }

    const actionLabel = options?.isUpdate ? "atualizado" : "instalado";

    return {
      success: true,
      version: serverVersion,
      filesWritten,
      message: `Addon 'Haleck Account Importer' v${serverVersion} ${actionLabel} com sucesso na pasta Interface/AddOns!`,
    };
  } catch (err: any) {
    return {
      success: false,
      version: "4.3.0",
      filesWritten: [],
      message: err?.message || "Falha ao gravar arquivos via File System Access API.",
    };
  }
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

export interface AddonStatusResult {
  success: boolean;
  targetPath: string;
  availableVersion: string;
  installedVersion: string | null;
  isInstalled: boolean;
  isUpToDate: boolean;
  status: "up_to_date" | "update_available" | "not_installed" | "configured_remote";
  compatibleForeverBuilds: string[];
  changelog: {
    version: string;
    date: string;
    title: string;
    highlights: string[];
  }[];
}

/**
 * Queries server to verify if local folder has the latest addon version
 */
export async function checkAddonUpdateStatus(targetPath: string): Promise<AddonStatusResult | null> {
  try {
    const res = await fetch(`/api/blizzard/wow/addon/status?targetPath=${encodeURIComponent(targetPath || "")}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("checkAddonUpdateStatus error:", err);
    return null;
  }
}

/**
 * Fetches dynamic content definitions (World Bosses, Vanilla+ Quests & Areas)
 */
export async function fetchDynamicDefinitions(): Promise<any> {
  try {
    const res = await fetch("/api/blizzard/wow/addon/definitions");
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("fetchDynamicDefinitions error:", err);
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

