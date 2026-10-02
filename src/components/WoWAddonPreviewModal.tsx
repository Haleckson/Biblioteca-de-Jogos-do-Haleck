/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import {
  X,
  Copy,
  Check,
  Search,
  Footprints,
  Swords,
  Users,
  Compass,
  Skull,
  Trophy,
  BookOpen,
  Layers,
  FileText,
  Calendar,
  MapPin,
  RefreshCw,
  Sparkles,
  Award,
  Package,
  Wrench,
  Clock,
  Flame,
  Maximize2,
  Shield,
  Coins,
  Activity,
  Zap,
  BarChart2,
  Fish,
  Crosshair,
  Crown,
  HeartHandshake,
  ChevronRight,
  Filter,
} from "lucide-react";
import { BlizzardProfileData } from "../types";

export interface WoWAddonPreviewModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  profile?: BlizzardProfileData;
  activeCharacterName?: string;
  activeCharacterRealm?: string;
  gameVersion?: string;
  embedded?: boolean;
  onExpandModal?: () => void;
}

export type SupportedWoWVersionKey = "forever" | "retail" | "classic" | "mop" | "tbc";

export interface WoWVersionConfig {
  key: SupportedWoWVersionKey;
  name: string;
  shortLabel: string;
  clientVersion: number;
  patch: string;
  themeColor: string;
  borderColor: string;
  bgGlow: string;
  badge: string;
  description: string;
  rulesetTag: string;
}

export const WOW_VERSION_PRESETS: Record<SupportedWoWVersionKey, WoWVersionConfig> = {
  forever: {
    key: "forever",
    name: "WoW Forever (Vanilla+)",
    shortLabel: "Forever Beta",
    clientVersion: 16001,
    patch: "Beta Build 16001 (04/Nov/2026)",
    themeColor: "text-amber-400",
    borderColor: "border-amber-500",
    bgGlow: "shadow-amber-500/20",
    badge: "Vanilla+ Priority",
    description: "Vanilla+ oficial com chefes mundiais, economia de alts e banco pessoal.",
    rulesetTag: "_classic_beta_",
  },
  retail: {
    key: "retail",
    name: "WoW Retail (The War Within / Midnight)",
    shortLabel: "Retail 11.x",
    clientVersion: 110200,
    patch: "Patch 11.2 (Warband Era)",
    themeColor: "text-cyan-400",
    borderColor: "border-cyan-500",
    bgGlow: "shadow-cyan-500/20",
    badge: "Warband & Mythic+",
    description: "Cofre de Guerra compartilhado, Great Vault e pontuação de Mítico+.",
    rulesetTag: "_retail_",
  },
  classic: {
    key: "classic",
    name: "WoW Classic Era",
    shortLabel: "Classic 1.15",
    clientVersion: 11500,
    patch: "Patch 1.15.5 (Era Clássica)",
    themeColor: "text-emerald-400",
    borderColor: "border-emerald-500",
    bgGlow: "shadow-emerald-500/20",
    badge: "Classic 1.12 Ruleset",
    description: "Azeroth original, patentes militares de Honra e attunements canônicos.",
    rulesetTag: "_classic_era_",
  },
  mop: {
    key: "mop",
    name: "WoW Mists of Pandaria",
    shortLabel: "MoP 5.4.8",
    clientVersion: 50408,
    patch: "Patch 5.4.8 (Siege of Orgrimmar)",
    themeColor: "text-emerald-300",
    borderColor: "border-emerald-400",
    bgGlow: "shadow-emerald-400/20",
    badge: "Pandaria Classic",
    description: "Challenge Modes, Ilha Perene, Reforja de itens e Pontos de Bravura.",
    rulesetTag: "_classic_",
  },
  tbc: {
    key: "tbc",
    name: "WoW The Burning Crusade",
    shortLabel: "TBC 2.4.3",
    clientVersion: 20403,
    patch: "Patch 2.4.3 (Fury of the Sunwell)",
    themeColor: "text-lime-400",
    borderColor: "border-lime-500",
    bgGlow: "shadow-lime-500/20",
    badge: "Outland Heroics",
    description: "Chaves Heroicas, Attunement de Karazhan/BT e Times de Arena com Resiliência.",
    rulesetTag: "_classic_",
  },
};

// 27 Parâmetros Granulares correspondentes ao Addon Lua v4.0.0
const SIMULATED_PARAMETERS = [
  { key: "charInfo", cat: "IDENTIDADE", title: "Informações Básicas & Nível", desc: "Nome, Reino, Nível, Classe, Raça, Gênero, Facção e Guilda." },
  { key: "appearance", cat: "VISUAL 3D", title: "Aparência 3D & Barbearia", desc: "Rosto, Cabelo, Barba, Pele e Customizações para o Visualizador 3D." },
  { key: "equippedGear", cat: "EQUIPAMENTO", title: "Itens Equipados (19 Slots)", desc: "Equipamento ativo, Nível de Item (iLvl), Durabilidade e Encantamentos." },
  { key: "allItemIds", cat: "BANCO DE IDs", title: "Mapeamento Universal de Display IDs", desc: "Relação canônica de Item ID <-> 3D Display ID para o banco DB2." },
  { key: "transmogs", cat: "VISUAL 3D", title: "Aparências de Transmog & Ilusões", desc: "Transmogs conhecidos, armas, ombreiras e ilusões visuais ativas." },
  { key: "questsCompleted", cat: "MISSÕES", title: "Quests Concluídas (ATT Scan)", desc: "Scan completo de todas as missões finalizadas na história do personagem." },
  { key: "questsActive", cat: "MISSÕES", title: "Quests Ativas no Quest Log", desc: "Missões em andamento nas diversas zonas de Azeroth e status de objetivos." },
  { key: "spells", cat: "MAGIAS", title: "Grimório de Habilidades Conhecidas", desc: "Todas as magias e técnicas aprendidas em todas as abas do Spellbook." },
  { key: "flightPaths", cat: "MUNDO", title: "Pontos de Voo (Taxi Nodes)", desc: "Mestres de voo e rotas aéreas desbloqueadas pelo aventureiro." },
  { key: "talents", cat: "TALENTOS", title: "Árvores de Especialização & Talentos", desc: "Build clássica de 51 pontos ou árvores modernas de classe e herói." },
  { key: "inventory", cat: "INVENTÁRIO", title: "Inventário, Mochila & Bolsas", desc: "Todos os itens nas 4 bolsas e mochila principal com contagem de stacks." },
  { key: "bank", cat: "BANCO", title: "Banco Pessoal & Reagentes", desc: "Banco principal de 28 slots, bolsa de reagentes e Warband Bank." },
  { key: "economy", cat: "ECONOMIA", title: "Economia de Conta & Ouro de Alts", desc: "Ouro consolidado de todos os personagens e balanço financeiro da sessão." },
  { key: "mounts", cat: "COLEÇÃO", title: "Coleção de Montarias", desc: "Montarias aprendidas, Creature Display IDs, Spell IDs e velocidade." },
  { key: "pets", cat: "COLEÇÃO", title: "Mascotes de Batalha (Pets)", desc: "Companheiros e mascotes colecionados com Species IDs e níveis." },
  { key: "toys", cat: "COLEÇÃO", title: "Caixa de Brinquedos (Toys)", desc: "Brinquedos colecionados catalogados na conta com Item IDs." },
  { key: "titles", cat: "TÍTULOS", title: "Títulos do Personagem", desc: "Títulos honoríficos conhecidos e título exibido atualmente." },
  { key: "achievements", cat: "CONQUISTAS", title: "Conquistas Concluídas & Pontos", desc: "Pontos de conquista totais e lista de achievements desbloqueados." },
  { key: "stepCounter", cat: "JORNADA", title: "Contador de Passos em Tempo Real", desc: "Passos dados na aventura e distância percorrida em quilômetros." },
  { key: "exploration", cat: "MUNDO", title: "Zonas & Regiões Descobertas", desc: "Histórico de mapas e subzonas desbravadas com data da primeira visita." },
  { key: "bossesAndRares", cat: "CAÇADAS", title: "Chefes & Raros Derrotados", desc: "Primeira vitória em cada chefe de raide/masmorra e monstros raros caçados." },
  { key: "worldBosses", cat: "CHEFES", title: "Chefes Mundiais (World Bosses)", desc: "Status de Lord Kazzak, Azuregos e os Quatro Dragões do Pesadelo." },
  { key: "lockouts", cat: "RAIDES", title: "Bloqueios de Instâncias Ativos", desc: "Salvas de masmorras e raides da semana, progresso e tempo para reinício." },
  { key: "companions", cat: "SOCIAL", title: "Companheiros de Grupo & Raide", desc: "Histórico de aventureiros com quem você formou grupo pelo mundo." },
  { key: "pvp", cat: "PVP", title: "Estatísticas de PvP & Honra", desc: "Mortes com Honra (HKs), Patente Militar Clássica e Pontuação de Arena." },
  { key: "nativeStats", cat: "ESTATÍSTICAS", title: "Estatísticas Nativas do WoW", desc: "Dano causado, cura, mortes sofridas, monstros abatidos do painel do jogo." },
  { key: "deathLog", cat: "MORTES", title: "Livro dos Caídos (Registro de Mortes)", desc: "Histórico de mortes com assassino, zona, coordenadas e nível do óbito." },
];

const CLASS_COLORS: Record<string, string> = {
  WARRIOR: "text-[#c79c6e]",
  PALADIN: "text-[#f58cba]",
  HUNTER: "text-[#abd473]",
  ROGUE: "text-[#fff569]",
  PRIEST: "text-[#ffffff]",
  DEATHKNIGHT: "text-[#c41f3b]",
  SHAMAN: "text-[#0070de]",
  MAGE: "text-[#69ccf0]",
  WARLOCK: "text-[#9482c9]",
  MONK: "text-[#00ff96]",
  DRUID: "text-[#ff7d0a]",
  DEMONHUNTER: "text-[#a330c9]",
  EVOKER: "text-[#33937f]",
};

// Dados Canônicos Ricos do Diário de Aventura e Estatísticas Oficiais Blizzard
const COMPREHENSIVE_JOURNAL_DATA = {
  steps: 42890,
  distanceYards: 39240,
  timeline: [
    {
      id: "ev_1",
      timestamp: "2026-09-29 23:45:10",
      type: "boss" as const,
      title: "Vitória Épica: Lord Kazzak (World Boss)",
      desc: "Liderou raide de 40 jogadores da guilda nas Blasted Lands. Derrotou o Comandante da Legião Flamejante antes do Berserk Enrage.",
      icon: "https://wow.zamimg.com/images/wow/icons/large/achievement_boss_ragnaros.jpg",
      zone: "Blasted Lands (Tainted Scar)",
      level: 60,
      reward: "Eye of Shadow & Fel Infused Leggings",
    },
    {
      id: "ev_2",
      timestamp: "2026-09-29 19:12:04",
      type: "level" as const,
      title: "Ascensão Suprema: Nível 60 Alcançado!",
      desc: "Atingiu o ápice de poder em Silithus desbravando as ruínas de Ahn'Qiraj. Desbloqueou acesso aos cenários de raide clássicos.",
      icon: "https://wow.zamimg.com/images/wow/icons/large/spell_holy_surgeoflight.jpg",
      zone: "Silithus (Cenarion Hold)",
      level: 60,
      reward: "Montaria Épica 100% & Armadura de Classe",
    },
    {
      id: "ev_3",
      timestamp: "2026-09-28 22:15:30",
      type: "item" as const,
      title: "Item Lendário Obtido: Thunderfury",
      desc: "Forjou Thunderfury, Blessed Blade of the Windseeker após coletar as duas metades dos Grilhões do Senhor do Vento!",
      icon: "https://wow.zamimg.com/images/wow/icons/large/inv_sword_39.jpg",
      zone: "Silithus",
      level: 60,
      reward: "Espada Lendária de 1 Mão",
    },
    {
      id: "ev_4",
      timestamp: "2026-09-28 20:30:15",
      type: "group" as const,
      title: "Expedição a Stratholme com Uther",
      desc: "Formou grupo de 5 guerreiros para purificar Stratholme. Derrotou Baron Rivendare no tempo limite do desafio.",
      icon: "https://wow.zamimg.com/images/wow/icons/large/achievement_guildperk_massresurrection.jpg",
      zone: "Eastern Plaguelands (Stratholme)",
      level: 59,
      reward: "Rédeas do Corcel da Morte (Tentativa #14)",
    },
    {
      id: "ev_5",
      timestamp: "2026-09-27 16:45:20",
      type: "quest" as const,
      title: "Cadeia de Onyxia Concluída: O Amuleto do Fogo do Dragão",
      desc: "Completou a lendária jornada diplomática de desmascarar Lady Katrana Prestor na Sala do Trono de Stormwind.",
      icon: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_head_dragon_01.jpg",
      zone: "Stormwind Keep",
      level: 60,
      reward: "Drakefire Amulet (Chave de Onyxia's Lair)",
    },
    {
      id: "ev_6",
      timestamp: "2026-09-26 14:10:00",
      type: "discovery" as const,
      title: "Descoberta Histórica: Cratera de Un'Goro",
      desc: "Primeira descida pelos desfiladeiros de Tanaris para a selva primordial repleta de dinossauros selvagens e cristais de poder.",
      icon: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_map02.jpg",
      zone: "Un'Goro Crater",
      level: 50,
      reward: "Ponto de Voo de Marshal's Stand Desbloqueado",
    },
    {
      id: "ev_7",
      timestamp: "2026-09-25 18:22:40",
      type: "death" as const,
      title: "Emboscada Fatal no Cemitério de Duskwood",
      desc: "Surpreendido pelo cavaleiro amaldiçoado Mor'ladim durante a meia-noite em Raven Hill Cemetery.",
      icon: "https://wow.zamimg.com/images/wow/icons/large/ability_creature_cursed_02.jpg",
      zone: "Duskwood (Raven Hill)",
      level: 35,
      reward: "Caminhada de Fantasma de 1.4 km até o Cadáver",
    },
    {
      id: "ev_8",
      timestamp: "2026-09-24 11:05:00",
      type: "boss" as const,
      title: "Vitória: Azuregos, Dragão Azul de Azshara",
      desc: "Defendeu as falésias de Azshara contra o sopro congelante do Dragão Arcano Azul da revoada de Malygos.",
      icon: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_head_dragon_blue.jpg",
      zone: "Azshara",
      level: 60,
      reward: "Puissance of the Blue & Typhoon",
    },
  ],
  bosses: [
    { id: 1, name: "Lord Kazzak", firstKillDate: "2026-09-29 23:45", killCount: 3, zone: "Blasted Lands", level: 60, isWorldBoss: true },
    { id: 2, name: "Azuregos", firstKillDate: "2026-09-24 11:05", killCount: 2, zone: "Azshara", level: 60, isWorldBoss: true },
    { id: 3, name: "Emeriss (Dragão do Pesadelo)", firstKillDate: "2026-09-20 18:30", killCount: 1, zone: "Duskwood", level: 60, isWorldBoss: true },
    { id: 4, name: "Lethon (Dragão do Pesadelo)", firstKillDate: "2026-09-19 21:00", killCount: 1, zone: "The Hinterlands", level: 60, isWorldBoss: true },
    { id: 5, name: "Baron Rivendare", firstKillDate: "2026-09-28 20:30", killCount: 14, zone: "Stratholme", level: 60, isWorldBoss: false },
    { id: 6, name: "General Drakkisath", firstKillDate: "2026-09-27 19:40", killCount: 8, zone: "Upper Blackrock Spire", level: 60, isWorldBoss: false },
    { id: 7, name: "Darkmaster Gandling", firstKillDate: "2026-09-25 22:10", killCount: 6, zone: "Scholomance", level: 60, isWorldBoss: false },
    { id: 8, name: "Mor'ladim (Raro de Elite)", firstKillDate: "2026-09-25 18:45", killCount: 2, zone: "Duskwood", level: 35, isWorldBoss: false },
  ],
  companions: [
    { name: "Uther", realm: "Azralon", class: "Paladin", level: 60, firstMetDate: "2026-09-28 20:30", zone: "Stratholme", timesGrouped: 12, role: "Tank / Sagrado" },
    { name: "Jaina", realm: "Azralon", class: "Mage", level: 60, firstMetDate: "2026-09-25 22:10", zone: "Scholomance", timesGrouped: 9, role: "DPS Arcano / Gelo" },
    { name: "Valeera", realm: "Azralon", class: "Rogue", level: 60, firstMetDate: "2026-09-27 19:40", zone: "Blackrock Spire", timesGrouped: 8, role: "DPS Assassinato" },
    { name: "Malfurion", realm: "Azralon", class: "Druid", level: 60, firstMetDate: "2026-09-22 10:15", zone: "Maraudon", timesGrouped: 7, role: "Healer Restauração" },
    { name: "Rexxar", realm: "Azralon", class: "Hunter", level: 60, firstMetDate: "2026-09-20 15:45", zone: "Dire Maul", timesGrouped: 5, role: "DPS Domínio das Feras" },
  ],
  exploration: [
    { zone: "Blasted Lands", firstVisited: "2026-09-29 20:00", visitCount: 16, completion: "100%" },
    { zone: "Silithus", firstVisited: "2026-09-29 12:30", visitCount: 22, completion: "100%" },
    { zone: "Eastern Plaguelands", firstVisited: "2026-09-28 15:00", visitCount: 34, completion: "100%" },
    { zone: "Western Plaguelands", firstVisited: "2026-09-27 11:20", visitCount: 28, completion: "100%" },
    { zone: "Un'Goro Crater", firstVisited: "2026-09-26 14:10", visitCount: 19, completion: "100%" },
    { zone: "Tanaris", firstVisited: "2026-09-24 09:30", visitCount: 42, completion: "100%" },
    { zone: "Stranglethorn Vale", firstVisited: "2026-09-20 08:45", visitCount: 65, completion: "100%" },
    { zone: "Duskwood", firstVisited: "2026-09-18 19:10", visitCount: 38, completion: "100%" },
    { zone: "Blackrock Mountain", firstVisited: "2026-09-27 17:00", visitCount: 45, completion: "100%" },
  ],
  deaths: [
    {
      id: "d1",
      timestamp: "2026-09-25 18:22:40",
      killerName: "Mor'ladim (Elite Nv 35)",
      zone: "Duskwood",
      subZone: "Raven Hill Cemetery",
      level: 35,
      lastWords: "Puxei acidentalmente enquanto limpava ghouls nos túmulos.",
    },
    {
      id: "d2",
      timestamp: "2026-09-23 21:10:05",
      killerName: "Dano de Queda (Falha de Engenharia)",
      zone: "Thousand Needles",
      subZone: "The Great Lift",
      level: 31,
      lastWords: "O elevador desceu antes de eu pisar na plataforma.",
    },
    {
      id: "d3",
      timestamp: "2026-09-21 17:40:50",
      killerName: "Emboscada PvP Horda (Rogue Nv ??)",
      zone: "Stranglethorn Vale",
      subZone: "Nesingwary's Expedition",
      level: 38,
      lastWords: "Stun lock duplo saindo da furtividade enquanto entregava a quest dos tigres.",
    },
    {
      id: "d4",
      timestamp: "2026-09-18 20:10:15",
      killerName: "Son of Arugal (Elite Nv 25)",
      zone: "Silverpine Forest",
      subZone: "The Dead Field",
      level: 16,
      lastWords: "O lobisomem patrulhou pela colina na neblina sem aviso.",
    },
    {
      id: "d5",
      timestamp: "2026-09-15 14:05:30",
      killerName: "Afogamento por Falha de Fôlego",
      zone: "Westfall",
      subZone: "The Vile Reef (Navios Naufragados)",
      level: 20,
      lastWords: "Fiquei preso no mastro do navio submerso procurando o baú da missão.",
    },
  ],
  // Categorias canônicas da aba Estatísticas do Personagem da Blizzard
  blizzardStats: {
    character: [
      { label: "Mortes Totais Sofridas", val: "48 vezes", highlight: "text-rose-400" },
      { label: "Mortes por Dano de Queda", val: "7 vezes", highlight: "text-amber-300" },
      { label: "Mortes por Afogamento", val: "2 vezes", highlight: "text-blue-300" },
      { label: "Poções de Cura Consumidas", val: "384 poções", highlight: "text-emerald-400" },
      { label: "Poções de Mana Consumidas", val: "142 frascos", highlight: "text-blue-400" },
      { label: "Bandagens de Primeiros Socorros Usadas", val: "512 curativos", highlight: "text-zinc-200" },
      { label: "Refeições e Bebidas Ingeridas", val: "780 porções", highlight: "text-amber-200" },
      { label: "Itens Vendidos a Mercadores NPCs", val: "3.420 itens", highlight: "text-zinc-300" },
      { label: "Ouro Total Saqueado de Criaturas", val: "1.845g 42s 18c", highlight: "text-amber-400" },
      { label: "Ouro Gasto em Reparos de Armadura", val: "640g 80s 00c", highlight: "text-rose-300" },
      { label: "Ouro Gasto em Treinadores & Montarias", val: "1.100g 00s 00c", highlight: "text-yellow-400" },
      { label: "Trocas de Especialização (Respec)", val: "6 vezes", highlight: "text-purple-300" },
      { label: "Rotas de Mestre de Voo Utilizadas", val: "214 voos", highlight: "text-cyan-300" },
    ],
    combat: [
      { label: "Golpes Críticos Desferidos", val: "14.820 críticos", highlight: "text-amber-400" },
      { label: "Golpes Críticos Recebidos", val: "2.140 críticos", highlight: "text-rose-400" },
      { label: "Maior Dano Único Infligido", val: "4.892 (Ambush crítico em Kazzak)", highlight: "text-orange-400" },
      { label: "Maior Cura Única Realizada", val: "2.450 (Bandagem Pesada de Seda Rúnica)", highlight: "text-emerald-400" },
      { label: "Dano Físico Total Infligido", val: "38.490.200 dano", highlight: "text-amber-300" },
      { label: "Dano Mágico Total Infligido", val: "4.120.800 dano", highlight: "text-purple-300" },
      { label: "Dano Total Absorvido por Escudos", val: "420.500 absorvidos", highlight: "text-blue-300" },
      { label: "Criaturas & Monstros Abatidos", val: "18.940 abates", highlight: "text-red-400" },
      { label: "Golpes de Misericórdia (Killing Blows)", val: "11.230 KBs", highlight: "text-yellow-400" },
    ],
    dungeonsRaids: [
      { label: "Masmorras Clássicas Concluídas", val: "68 instâncias", highlight: "text-cyan-400" },
      { label: "Chefes de Masmorra Derrotados", val: "248 chefes", highlight: "text-amber-300" },
      { label: "Raides de 40 Jogadores Finalizadas", val: "14 raides (MC / BWL / Onyxia)", highlight: "text-purple-400" },
      { label: "Chefes de Raide Abatidos", val: "42 chefes", highlight: "text-yellow-400" },
      { label: "Chefes Mundiais Abatidos (Kazzak/Azuregos)", val: "7 abates", highlight: "text-rose-400" },
      { label: "Wipes Sofridos pelo Grupo de Raide", val: "22 wipes", highlight: "text-zinc-400" },
      { label: "Itens de Qualidade Épica (Roxo) Saqueados", val: "34 itens", highlight: "text-purple-300" },
      { label: "Itens de Qualidade Lendária (Laranja)", val: "1 item (Thunderfury)", highlight: "text-orange-400" },
    ],
    pvp: [
      { label: "Abates com Honra (Honorable Kills - HKs)", val: "12.450 HKs", highlight: "text-red-400" },
      { label: "Patente Militar Mais Alta Alcançada", val: "Marechal de Campo (Rank 13)", highlight: "text-amber-400" },
      { label: "Partidas de Warsong Gulch Vencidas", val: "84 vitórias", highlight: "text-emerald-400" },
      { label: "Bandeiras Inimigas Capturadas no WSG", val: "62 bandeiras", highlight: "text-cyan-300" },
      { label: "Partidas de Arathi Basin Vencidas", val: "58 vitórias", highlight: "text-emerald-400" },
      { label: "Bases de Recursos Assaltadas no AB", val: "112 bases", highlight: "text-yellow-300" },
      { label: "Duelos Disputados em Capitais", val: "340 duelos", highlight: "text-zinc-300" },
      { label: "Duelos Vencidos (Taxa de 72%)", val: "245 vitórias", highlight: "text-emerald-400" },
    ],
    world: [
      { label: "Passos Dados a Pé na Aventura", val: "42.890 passos", highlight: "text-cyan-400" },
      { label: "Distância Total Percorrida a Pé", val: "39.24 km", highlight: "text-cyan-300" },
      { label: "Distância Percorrida em Montaria 100%", val: "184.50 km", highlight: "text-amber-300" },
      { label: "Mapas e Subzonas 100% Explorados", val: "38 zonas", highlight: "text-purple-300" },
      { label: "Baús de Tesouro Abertos no Mundo", val: "142 baús", highlight: "text-amber-400" },
      { label: "Visitas a Capitais de Azeroth", val: "380 visitas (Stormwind/Ironforge)", highlight: "text-blue-300" },
      { label: "Pontos de Pesca Raros Descobertos", val: "48 cardumes", highlight: "text-teal-300" },
    ],
    professions: [
      { label: "Itens de Engenharia Goblínica Criados", val: "420 explosivos/gadgets", highlight: "text-yellow-400" },
      { label: "Veios de Minério Minerados", val: "1.240 veios (Tório Rápido)", highlight: "text-amber-300" },
      { label: "Diamantes de Azeroth & Safiras Minerados", val: "18 gemas azuis", highlight: "text-blue-400" },
      { label: "Peixes Fisgados com Sucesso", val: "890 peixes", highlight: "text-cyan-300" },
      { label: "Peixe Lendário: Velho Manjadente Fisgado", val: "1 vez (em Ironforge)", highlight: "text-orange-400" },
      { label: "Leilões Criados na Casa de Leilões", val: "680 lotes", highlight: "text-zinc-200" },
      { label: "Ouro Total Movimentado no Leilão", val: "4.890g 00s 00c", highlight: "text-amber-400" },
      { label: "Maior Quantia de Ouro Guardada na Bolsa", val: "3.240g 85s 12c", highlight: "text-yellow-300" },
    ],
    social: [
      { label: "Emote Mais Usado", val: "/dance (380 vezes)", highlight: "text-purple-300" },
      { label: "Abraços Dados em Aventureiros e NPCs", val: "/hug (124 vezes)", highlight: "text-pink-400" },
      { label: "Vezes que Ficou Alcoolizado em Tavernas", val: "42 bebedeiras", highlight: "text-amber-300" },
      { label: "Bichinhos Inofensivos Mortos (Critters)", val: "18 esquilos/coelhos", highlight: "text-zinc-400" },
      { label: "Horas Acumuladas Descansando (Rested XP)", val: "720 horas em estalagens", highlight: "text-emerald-400" },
    ],
  },
};

export const WoWAddonPreviewModal: React.FC<WoWAddonPreviewModalProps> = ({
  isOpen = false,
  onClose,
  profile,
  activeCharacterName,
  activeCharacterRealm,
  gameVersion,
  embedded = false,
  onExpandModal,
}) => {
  // Aba Principal: 1 = Extração /hai, 2 = Diário /diario
  const [activeCategory, setActiveCategory] = useState<1 | 2>(1);

  // Versão do WoW selecionada no simulador (Default: Forever)
  const [currentVersionKey, setCurrentVersionKey] = useState<SupportedWoWVersionKey>(() => {
    const raw = (gameVersion || profile?.wow_version || "forever").toLowerCase();
    if (raw.includes("retail")) return "retail";
    if (raw.includes("mop")) return "mop";
    if (raw.includes("tbc")) return "tbc";
    if (raw.includes("classic") && !raw.includes("beta")) return "classic";
    return "forever";
  });

  const activeVersion = WOW_VERSION_PRESETS[currentVersionKey];

  // Alternador de Dados Reais vs Demonstração
  const [useDemoData, setUseDemoData] = useState(false);

  // Parâmetros selecionados para extração
  const [selectedParams, setSelectedParams] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    SIMULATED_PARAMETERS.forEach((p) => {
      map[p.key] = true;
    });
    return map;
  });

  // Sub-abas do Diário de Aventura (1 a 8)
  const [journalSubTab, setJournalSubTab] = useState<number>(1);
  const [statsCategoryTab, setStatsCategoryTab] = useState<string>("character");
  const [searchQuery, setSearchQuery] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Identidade do Personagem Ativo
  const charName = activeCharacterName || profile?.name || "Tïtolleza";
  const charRealm = activeCharacterRealm || profile?.realm || (currentVersionKey === "forever" ? "Forever-Beta" : "Azralon");
  const charLevel = profile?.level || (currentVersionKey === "forever" ? 60 : currentVersionKey === "tbc" ? 70 : currentVersionKey === "mop" ? 90 : 80);
  const charClass = profile?.characterClass || "Rogue";

  // Dados efetivos do Diário
  const effectiveJournal = useMemo(() => {
    if (useDemoData || !profile?.adventureJournal?.timeline || profile.adventureJournal.timeline.length === 0) {
      return COMPREHENSIVE_JOURNAL_DATA;
    }
    return {
      steps: profile.adventureJournal.steps || COMPREHENSIVE_JOURNAL_DATA.steps,
      distanceYards: profile.adventureJournal.distanceYards || COMPREHENSIVE_JOURNAL_DATA.distanceYards,
      timeline: profile.adventureJournal.timeline || COMPREHENSIVE_JOURNAL_DATA.timeline,
      bosses: profile.adventureJournal.bosses || COMPREHENSIVE_JOURNAL_DATA.bosses,
      companions: profile.adventureJournal.companions || COMPREHENSIVE_JOURNAL_DATA.companions,
      exploration: profile.adventureJournal.exploration || COMPREHENSIVE_JOURNAL_DATA.exploration,
      deaths: profile.adventureJournal.deaths || COMPREHENSIVE_JOURNAL_DATA.deaths,
      blizzardStats: COMPREHENSIVE_JOURNAL_DATA.blizzardStats,
    };
  }, [useDemoData, profile]);

  const activeParamCount = Object.values(selectedParams).filter(Boolean).length;

  const toggleParam = (key: string) => {
    setSelectedParams((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectAll = (val: boolean) => {
    const next: Record<string, boolean> = {};
    SIMULATED_PARAMETERS.forEach((p) => {
      next[p.key] = val;
    });
    setSelectedParams(next);
  };

  const simulatedLuaExport = `-- ========================================================================
-- HALECK ACCOUNT IMPORTER v4.0.0 - WORLD OF WARCRAFT IN-GAME SNAPSHOT
-- Target: ${activeVersion.name} | Client Build: ${activeVersion.clientVersion}
-- File Location: Interface/AddOns/HaleckAccountImporter/
-- ========================================================================

HaleckAccountImporterDB = {
  version = "4.0.0",
  targetGame = "${activeVersion.key}",
  clientBuild = ${activeVersion.clientVersion},
  patch = "${activeVersion.patch}",
  exportedAt = "${new Date().toISOString()}",
  activeCharacter = {
    name = "${charName}",
    realm = "${charRealm}",
    level = ${charLevel},
    class = "${charClass}",
    race = "NightElf",
    gender = 2,
    faction = "Alliance",
    guild = "Vanguarda de Azeroth",
  },
  systemStats = {
    totalSteps = ${effectiveJournal.steps},
    distanceYards = ${effectiveJournal.distanceYards},
    distanceKm = ${(((effectiveJournal.distanceYards) * 0.9144) / 1000).toFixed(2)},
    worldBossesDefeated = ${effectiveJournal.bosses.filter(b => b.isWorldBoss).length},
    dungeonsCleared = 68,
    honorableKills = 12450,
  },
  selectedParametersCount = ${activeParamCount},
  exportFilters = {
    charInfo = ${selectedParams.charInfo ?? true},
    appearance = ${selectedParams.appearance ?? true},
    equippedGear = ${selectedParams.equippedGear ?? true},
    allItemIds = ${selectedParams.allItemIds ?? true},
    stepCounter = ${selectedParams.stepCounter ?? true},
    adventureJournal = ${selectedParams.bossesAndRares ?? true},
    worldBosses = ${selectedParams.worldBosses ?? true},
    deathLog = ${selectedParams.deathLog ?? true},
  }
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(simulatedLuaExport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // =========================================================================
  // RENDERIZAÇÃO DA JANELA PRINCIPAL COM DESIGN 100% IDÊNTICO AO WOW IN-GAME
  // =========================================================================
  const innerWindow = (
    <div
      className={`relative w-full ${
        embedded
          ? "border-2 border-[#b8860b] rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col bg-[#0c0d13] min-h-[720px] max-h-[85vh]"
          : "w-[95vw] h-[95vh] max-w-[95vw] max-h-[95vh] bg-[#0c0d13] border-2 border-[#b8860b] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.95),inset_0_0_25px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col select-none"
      }`}
    >
      {/* 4 Rivets Ornamentais de Canto (Estilo Moldura de Janela Blizzard) */}
      <div className="absolute top-1.5 left-1.5 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[#ffe066] to-[#8c6200] border border-[#593d00] shadow-sm z-30 pointer-events-none" />
      <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[#ffe066] to-[#8c6200] border border-[#593d00] shadow-sm z-30 pointer-events-none" />
      <div className="absolute bottom-1.5 left-1.5 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[#ffe066] to-[#8c6200] border border-[#593d00] shadow-sm z-30 pointer-events-none" />
      <div className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[#ffe066] to-[#8c6200] border border-[#593d00] shadow-sm z-30 pointer-events-none" />

      {/* =================================================================== */}
      {/* 1. BARRA SUPERIOR IN-GAME: Título com Relevo Dourado & Botão [X]    */}
      {/* =================================================================== */}
      <div className="bg-gradient-to-r from-[#1b1610] via-[#2c2012] to-[#1b1610] px-4 py-2.5 border-b-2 border-[#96721d] flex items-center justify-between shrink-0 shadow-md relative z-20">
        <div className="flex items-center gap-3">
          {/* Brasão / Ícone da Janela WoW com o 'H' Estilizado da Marca Haleck */}
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#071326] via-[#091f3b] to-[#040813] border-2 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.5)] flex items-center justify-center shrink-0">
            <span className="font-orbitron font-black text-cyan-300 text-sm tracking-wider drop-shadow-[0_0_8px_rgba(6,182,212,0.9)]">
              H
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif font-black text-sm sm:text-base text-[#ffd100] tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] uppercase">
                Haleck Account Importer & Diário de Aventura
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/60 border border-[#b8860b]/60 text-[#ffe066] font-bold">
                v4.0.0
              </span>
            </div>
            <p className="text-[10px] text-amber-200/70 font-mono">
              Interface oficial in-game reproduzida para World of Warcraft • Comandos:{" "}
              <code className="text-cyan-300 font-bold bg-black/40 px-1 rounded">/hai</code> e{" "}
              <code className="text-amber-300 font-bold bg-black/40 px-1 rounded">/diario</code>
            </p>
          </div>
        </div>

        {/* Botões Superiores Direitos: Alternador de Dados, Tela Cheia e Fechar */}
        <div className="flex items-center gap-2.5">
          {/* Seletor de Dados Reais vs Demonstração */}
          <button
            type="button"
            onClick={() => setUseDemoData(!useDemoData)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all border flex items-center gap-1.5 cursor-pointer shadow-sm ${
              useDemoData
                ? "bg-gradient-to-b from-[#805008] to-[#422602] text-[#ffd100] border-[#d4af37]"
                : "bg-gradient-to-b from-[#143048] to-[#071624] text-cyan-300 border-cyan-500/60"
            }`}
            title="Alternar entre dados reais sincronizados do personagem e histórico épico de demonstração"
          >
            <RefreshCw size={11} className={useDemoData ? "animate-spin" : ""} />
            <span>Modo: {useDemoData ? "Dados de Exemplo (Histórico Épico)" : "Dados Reais do Armory"}</span>
          </button>

          {/* Botão Expandir Tela Cheia (se embedded) */}
          {embedded && onExpandModal && (
            <button
              type="button"
              onClick={onExpandModal}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-b from-[#1a2d42] to-[#0b1622] border border-[#528eb5] hover:border-cyan-400 text-cyan-200 text-[11px] font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Expandir simulador em tela cheia (95% do viewport)"
            >
              <Maximize2 size={12} />
              <span className="hidden sm:inline">95% Tela Cheia</span>
            </button>
          )}

          {/* Botão Fechar [X] Clássico da Blizzard (UIPanelCloseButton) */}
          {onClose && !embedded && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded bg-gradient-to-b from-[#941c1c] via-[#661010] to-[#3b0606] border-2 border-[#d4af37] hover:border-[#ffe066] hover:from-[#b52626] text-[#ffd100] hover:text-white flex items-center justify-center font-black transition-all cursor-pointer shadow-md active:translate-y-0.5"
              title="Fechar Janela (Esc)"
            >
              <X size={16} className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />
            </button>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. SELETOR DE VERSÃO DO WOW (Forever, Retail, Classic, MoP, TBC)     */}
      {/* =================================================================== */}
      <div className="bg-[#12131b] px-4 py-2 border-b border-[#2b2b3a] flex items-center justify-between flex-wrap gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80 flex items-center gap-1">
            <Filter size={11} />
            <span>Versão do Addon / Cliente:</span>
          </span>

          <div className="flex items-center gap-1 bg-[#07080d] p-1 rounded-xl border border-[#2b2b3a]">
            {(Object.keys(WOW_VERSION_PRESETS) as SupportedWoWVersionKey[]).map((vKey) => {
              const cfg = WOW_VERSION_PRESETS[vKey];
              const isSelected = currentVersionKey === vKey;
              return (
                <button
                  key={vKey}
                  type="button"
                  onClick={() => setCurrentVersionKey(vKey)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? `bg-gradient-to-b from-[#3a280c] to-[#1c1305] text-[#ffd100] border border-[#d4af37] shadow-sm ${cfg.bgGlow}`
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent"
                  }`}
                  title={`${cfg.name} - ${cfg.description}`}
                >
                  <span>{cfg.shortLabel}</span>
                  {vKey === "forever" && (
                    <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-500/40">
                      Vanilla+
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Resumo da Versão Ativa */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-400 text-[11px] hidden md:inline">
            Pasta Oficial: <code className="text-amber-300 font-mono font-bold bg-black/60 px-1 py-0.5 rounded border border-zinc-800">{activeVersion.rulesetTag}</code>
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/70 border border-[#b8860b]/50 text-amber-300 font-bold">
            Build: {activeVersion.clientVersion}
          </span>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 3. FICHA RESUMO DO PERSONAGEM IN-GAME (Character Strip)             */}
      {/* =================================================================== */}
      <div className="bg-[#0e111a] px-4 py-2 border-b border-[#2b2b3a] flex items-center justify-between text-xs flex-wrap gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-zinc-300">Aventureiro:</span>
          <span className={`font-black text-sm ${CLASS_COLORS[charClass.toUpperCase()] || "text-amber-400"}`}>
            {charName}
          </span>
          <span className="text-zinc-400 font-medium">({charRealm})</span>
          <span className="px-2 py-0.5 rounded bg-black/70 text-[11px] font-mono text-emerald-400 font-bold border border-emerald-500/30">
            Nível {charLevel} {charClass}
          </span>
          <span className="text-[10px] text-amber-300 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 font-bold">
            {activeVersion.name}
          </span>
        </div>

        {/* Marcadores Rápidos de Progresso */}
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <span className="text-cyan-300 flex items-center gap-1 font-bold">
            <Footprints size={13} />
            {effectiveJournal.steps.toLocaleString()} passos (~{(((effectiveJournal.distanceYards) * 0.9144) / 1000).toFixed(1)} km)
          </span>
          <span className="text-amber-300 flex items-center gap-1 font-bold">
            <Swords size={13} />
            {effectiveJournal.bosses.length} chefes caçados
          </span>
          <span className="text-blue-300 flex items-center gap-1 font-bold">
            <Users size={13} />
            {effectiveJournal.companions.length} companheiros
          </span>
          <span className="text-rose-400 flex items-center gap-1 font-bold">
            <Skull size={13} />
            {effectiveJournal.deaths.length} mortes
          </span>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 4. ABAS PRINCIPAIS: [Central de Extração] | [Meu Diário de Aventura]*/}
      {/* =================================================================== */}
      <div className="bg-[#090a0f] px-4 pt-2.5 flex items-center gap-2 border-b-2 border-[#96721d] shrink-0">
        <button
          type="button"
          onClick={() => setActiveCategory(1)}
          className={`px-5 py-2.5 rounded-t-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border-t-2 border-x-2 ${
            activeCategory === 1
              ? "bg-gradient-to-b from-[#2a1e0c] to-[#120e06] text-[#ffd100] border-[#d4af37] shadow-lg"
              : "bg-zinc-900/60 text-zinc-400 hover:text-white border-zinc-800"
          }`}
        >
          <Layers size={14} className={activeCategory === 1 ? "text-[#ffd100]" : "text-zinc-400"} />
          <span>⚙️ Central de Extração (/hai)</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/60 text-amber-300 font-mono border border-amber-500/30">
            {activeParamCount}/{SIMULATED_PARAMETERS.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory(2)}
          className={`px-5 py-2.5 rounded-t-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border-t-2 border-x-2 ${
            activeCategory === 2
              ? "bg-gradient-to-b from-[#2a1e0c] to-[#120e06] text-[#ffd100] border-[#d4af37] shadow-lg"
              : "bg-zinc-900/60 text-zinc-400 hover:text-white border-zinc-800"
          }`}
        >
          <BookOpen size={14} className={activeCategory === 2 ? "text-[#ffd100]" : "text-zinc-400"} />
          <span>📖 Meu Diário de Aventura (/diario)</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/60 text-amber-300 font-mono border border-amber-500/30">
            {effectiveJournal.timeline.length} Memórias
          </span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* 5. CONTEÚDO PRINCIPAL ROLÁVEL                                       */}
      {/* =================================================================== */}
      <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 bg-[#0a0b10] custom-scrollbar">
        {/* ================================================================= */}
        {/* CATEGORIA 1: CENTRAL DE EXTRAÇÃO & PARÂMETROS                     */}
        {/* ================================================================= */}
        {activeCategory === 1 && (
          <div className="space-y-4">
            {/* Banner de Instrução In-Game */}
            <div className="flex items-center justify-between text-xs text-amber-200/90 bg-[#16130b] p-3 rounded-xl border border-[#b8860b]/40 shadow-sm">
              <span className="flex items-center gap-2">
                <Check size={14} className="text-amber-400" />
                <span>
                  Selecione os módulos que deseja salvar no snapshot do disco. Quando deslogar ou digitar{" "}
                  <code className="bg-black/60 text-cyan-300 font-mono px-1 rounded">/reload</code>, o Addon gravará os dados ativos no arquivo SavedVariables:
                </span>
              </span>
              <span className="font-mono font-bold text-amber-300 shrink-0 ml-2">
                {activeParamCount} de {SIMULATED_PARAMETERS.length} ativos
              </span>
            </div>

            {/* Grid dos 27 Parâmetros com Visual Clássico WoW */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[58vh] overflow-y-auto pr-1">
              {SIMULATED_PARAMETERS.map((param) => {
                const isChecked = selectedParams[param.key] ?? true;
                return (
                  <div
                    key={param.key}
                    onClick={() => toggleParam(param.key)}
                    className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-3 cursor-pointer select-none ${
                      isChecked
                        ? "bg-[#18150c] border-[#b8860b]/70 hover:border-[#ffd100] text-white shadow-sm"
                        : "bg-[#0f1017] border-zinc-800/90 hover:border-zinc-700 text-zinc-400 opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center font-black text-xs shrink-0 mt-0.5 border ${
                          isChecked
                            ? "bg-gradient-to-b from-[#ffd100] to-[#b8860b] text-black border-[#ffd100] shadow-sm"
                            : "border-zinc-700 text-transparent bg-black/40"
                        }`}
                      >
                        {isChecked ? "✓" : ""}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-black/60 text-[#ffd100] border border-[#b8860b]/40">
                            {param.cat}
                          </span>
                          <span className="text-xs font-bold text-white">{param.title}</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1 leading-snug">{param.desc}</p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                          isChecked
                            ? "bg-amber-950/80 text-[#ffd100] border border-[#b8860b]/40"
                            : "bg-zinc-900 text-zinc-600"
                        }`}
                      >
                        {isChecked ? "Ativo" : "Off"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Barra de Ações do Addon */}
            <div className="pt-3 border-t border-[#2b2b3a] flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-all cursor-pointer"
                >
                  Marcar Todos
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-all cursor-pointer"
                >
                  Desmarcar Todos
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowExportModal(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <FileText size={14} />
                  <span>Ver Snapshot LUA</span>
                </button>

                {/* Botão Oficial Vermelho/Ouro (UIPanelButtonTemplate) */}
                <button
                  type="button"
                  onClick={() => setShowExportModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-b from-[#8f1919] via-[#610e0e] to-[#3b0808] border-2 border-[#d4af37] text-[#ffd100] hover:text-white hover:border-[#ffe066] text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_2px_5px_rgba(0,0,0,0.8)] active:translate-y-0.5 flex items-center gap-2"
                >
                  <Package size={14} />
                  <span>Salvar Configuração no Addon</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* CATEGORIA 2: MEU DIÁRIO DE AVENTURA COM 8 SUB-ABAS E STATS BLIZZARD*/}
        {/* ================================================================= */}
        {activeCategory === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 min-h-[55vh]">
            {/* Menu Lateral Esquerdo do Diário (8 Sub-Abas In-Game) */}
            <div className="md:col-span-3 bg-[#0d0f17] border border-[#2b2b3a] rounded-xl p-2.5 space-y-1.5">
              {[
                { id: 1, label: "📜 Crônica & Linha do Tempo", desc: "Momentos épicos, itens lendários e mortes" },
                { id: 2, label: "📊 Estatísticas do Personagem", desc: "Painel oficial da Blizzard (6 categorias)" },
                { id: 3, label: "⚔️ Caçadas & World Bosses", desc: "Kazzak, Azuregos e chefes abatidos" },
                { id: 4, label: "🗺️ Exploração & Passos", desc: "Passômetro, quilômetros e rotas" },
                { id: 5, label: "👥 Companheiros de Raide", desc: "Aventureiros agrupados em Azeroth" },
                { id: 6, label: "💀 Livro dos Caídos", desc: "Registro solene de mortes e causas" },
                { id: 7, label: "🏆 Conquistas & Títulos", desc: "Proezas de Bravura e patentes" },
                { id: 8, label: "🎭 Curiosidades & Social", desc: "Emotes, álcool e bichinhos abatidos" },
              ].map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => setJournalSubTab(sc.id)}
                  className={`w-full text-left p-2.5 rounded-lg transition-all cursor-pointer flex flex-col ${
                    journalSubTab === sc.id
                      ? "bg-gradient-to-r from-[#2a1f0d] to-[#171106] border border-[#d4af37] text-[#ffd100] shadow-md"
                      : "hover:bg-zinc-800/60 text-zinc-300 border border-transparent"
                  }`}
                >
                  <span className="text-xs font-black">{sc.label}</span>
                  <span className="text-[10px] text-zinc-400 mt-0.5 leading-snug">{sc.desc}</span>
                </button>
              ))}
            </div>

            {/* Painel Central de Visualização com Busca */}
            <div className="md:col-span-9 bg-[#0e1017] border border-[#2b2b3a] rounded-xl p-4 flex flex-col space-y-4">
              {/* Barra de Filtro / Busca */}
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Buscar no Diário por chefe, zona, amigo, item lendário ou estatística..."
                  className="w-full pl-9 pr-3.5 py-2 bg-black/60 border border-zinc-700 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#ffd100]"
                />
              </div>

              {/* ------------------------------------------------------------- */}
              {/* SUB-ABA 1: CRÔNICA & LINHA DO TEMPO                           */}
              {/* ------------------------------------------------------------- */}
              {journalSubTab === 1 && (
                <div className="space-y-3 overflow-y-auto max-h-[50vh] pr-1 custom-scrollbar">
                  {effectiveJournal.timeline
                    .filter((t) => !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.desc.toLowerCase().includes(searchQuery.toLowerCase()) || t.zone.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="p-3.5 rounded-xl bg-[#131622] border border-[#2a2e42] hover:border-[#b8860b] flex items-start gap-3.5 transition-all shadow-sm group"
                      >
                        <img
                          src={item.icon}
                          alt={item.title}
                          className="w-10 h-10 rounded-lg border border-[#b8860b]/60 shrink-0 object-cover mt-0.5 shadow"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs font-black text-[#ffd100] group-hover:text-white transition-colors truncate">
                              {item.title}
                            </h4>
                            <span className="text-[10px] font-mono text-zinc-400 shrink-0 bg-black/50 px-2 py-0.5 rounded border border-zinc-800">
                              {item.timestamp}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-200 mt-1 leading-relaxed">{item.desc}</p>
                          <div className="flex items-center justify-between text-[10px] mt-2 pt-1.5 border-t border-zinc-800/80 font-mono">
                            <span className="text-cyan-400 flex items-center gap-1">
                              <MapPin size={10} />
                              {item.zone}
                            </span>
                            {item.reward && (
                              <span className="text-amber-300 font-bold">
                                Recompensa: {item.reward}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SUB-ABA 2: ESTATÍSTICAS NATIVAS DO WOW (OFICIAL BLIZZARD)     */}
              {/* ------------------------------------------------------------- */}
              {journalSubTab === 2 && (
                <div className="space-y-3">
                  {/* Seletor de Categoria das Estatísticas Oficiais */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-zinc-800">
                    {[
                      { key: "character", label: "Personagem / Geral" },
                      { key: "combat", label: "Combate" },
                      { key: "dungeonsRaids", label: "Masmorras & Raides" },
                      { key: "pvp", label: "PvP & Honra" },
                      { key: "world", label: "Mundo & Viagem" },
                      { key: "professions", label: "Profissões & Ouro" },
                    ].map((cat) => (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setStatsCategoryTab(cat.key)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          statsCategoryTab === cat.key
                            ? "bg-[#2b210c] text-[#ffd100] border border-[#d4af37]"
                            : "text-zinc-400 hover:text-white bg-black/40 border border-zinc-800"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Lista de Registros da Categoria Selecionada */}
                  <div className="space-y-1.5 max-h-[46vh] overflow-y-auto pr-1 custom-scrollbar">
                    {((effectiveJournal.blizzardStats as any)[statsCategoryTab] || [])
                      .filter((s: any) => !searchQuery || s.label.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((stat: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-[#12141f] border border-[#232738] flex items-center justify-between text-xs hover:border-[#b8860b]/40 transition-colors"
                        >
                          <span className="text-zinc-300 font-medium">{stat.label}</span>
                          <span className={`font-mono font-black ${stat.highlight}`}>{stat.val}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SUB-ABA 3: CAÇADAS, CHEFES & WORLD BOSSES                     */}
              {/* ------------------------------------------------------------- */}
              {journalSubTab === 3 && (
                <div className="space-y-2.5 overflow-y-auto max-h-[50vh] pr-1 custom-scrollbar">
                  {effectiveJournal.bosses
                    .filter((b) => !searchQuery || b.name.toLowerCase().includes(searchQuery.toLowerCase()) || b.zone.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((boss) => (
                      <div
                        key={boss.id}
                        className="p-3.5 rounded-xl bg-[#131622] border border-[#2a2e42] hover:border-amber-500/50 flex items-center justify-between gap-3 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#2a1e0a] border border-[#d4af37] flex items-center justify-center text-[#ffd100] shadow">
                            <Swords size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-black text-white">{boss.name}</h4>
                              {boss.isWorldBoss && (
                                <span className="text-[9px] uppercase font-black px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/50 shadow-sm">
                                  World Boss
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              Local: {boss.zone} • Nível {boss.level}
                            </p>
                          </div>
                        </div>

                        <div className="text-right text-[11px] font-mono">
                          <span className="text-amber-400 font-black text-xs block">{boss.killCount} abates</span>
                          <span className="text-[10px] text-zinc-400">1ª vitória: {boss.firstKillDate}</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SUB-ABA 4: EXPLORAÇÃO, ROTAS & PASSOS                         */}
              {/* ------------------------------------------------------------- */}
              {journalSubTab === 4 && (
                <div className="space-y-3 overflow-y-auto max-h-[50vh] pr-1 custom-scrollbar">
                  <div className="p-4 rounded-xl bg-gradient-to-r from-[#172230] to-[#0d141e] border-2 border-cyan-500/40 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Footprints size={24} className="text-cyan-400" />
                      <div>
                        <span className="text-xs font-black text-white uppercase tracking-wider block">Passômetro & Quilometragem</span>
                        <p className="text-[11px] text-zinc-300">Medição contínua via coordenadas geográficas de Azeroth</p>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-lg font-black text-cyan-300 block">
                        {effectiveJournal.steps.toLocaleString()} passos
                      </span>
                      <span className="text-xs text-zinc-300">
                        ~{(((effectiveJournal.distanceYards) * 0.9144) / 1000).toFixed(2)} km percorridos
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {effectiveJournal.exploration
                      .filter((e) => !searchQuery || e.zone.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((exp) => (
                        <div key={exp.zone} className="p-3 rounded-xl bg-[#12141f] border border-[#232738] flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-white block">{exp.zone}</span>
                            <span className="text-[10px] text-zinc-400">1ª Visita: {exp.firstVisited}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-mono font-bold text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">
                              {exp.visitCount} visitas
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SUB-ABA 5: COMPANHEIROS DE RAIDE & GUILDA                     */}
              {/* ------------------------------------------------------------- */}
              {journalSubTab === 5 && (
                <div className="space-y-2.5 overflow-y-auto max-h-[50vh] pr-1 custom-scrollbar">
                  {effectiveJournal.companions
                    .filter((c) => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.class.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((comp) => (
                      <div
                        key={comp.name}
                        className="p-3.5 rounded-xl bg-[#131622] border border-[#2a2e42] hover:border-blue-500/40 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-950/60 border border-blue-500/50 flex items-center justify-center text-blue-400">
                            <Users size={18} />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-white">
                              <span className={CLASS_COLORS[comp.class.toUpperCase()] || "text-white"}>
                                {comp.name}
                              </span>{" "}
                              <span className="text-zinc-500 font-normal">({comp.realm})</span>
                            </h4>
                            <p className="text-[11px] text-zinc-300">
                              {comp.class} Nv. {comp.level} • {comp.role} • 1º encontro em {comp.zone}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-mono font-bold text-blue-300 bg-blue-950 px-3 py-1 rounded-full border border-blue-500/40">
                          {comp.timesGrouped} {comp.timesGrouped === 1 ? "grupo" : "grupos"}
                        </span>
                      </div>
                    ))}
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SUB-ABA 6: LIVRO DOS CAÍDOS (REGISTRO DE MORTES)              */}
              {/* ------------------------------------------------------------- */}
              {journalSubTab === 6 && (
                <div className="space-y-3 overflow-y-auto max-h-[50vh] pr-1 custom-scrollbar">
                  {effectiveJournal.deaths.map((death) => (
                    <div
                      key={death.id}
                      className="p-4 rounded-xl bg-[#170e10] border-2 border-rose-900/60 space-y-2 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white flex items-center gap-2">
                          <Skull size={15} className="text-rose-400" />
                          <span>Caiu perante: <strong className="text-amber-300 font-serif">{death.killerName}</strong></span>
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400 bg-black/60 px-2 py-0.5 rounded border border-zinc-800">
                          {death.timestamp}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-300">
                        Local: <strong className="text-white">{death.zone}</strong> ({death.subZone}) • Nível no óbito: <span className="text-rose-400 font-bold">{death.level}</span>
                      </p>
                      {death.lastWords && (
                        <p className="text-[11px] text-zinc-400 italic border-l-2 border-rose-500/60 pl-2.5 bg-black/30 py-1">
                          "{death.lastWords}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SUB-ABA 7: CONQUISTAS & TÍTULOS                               */}
              {/* ------------------------------------------------------------- */}
              {journalSubTab === 7 && (
                <div className="space-y-3 overflow-y-auto max-h-[50vh] pr-1 custom-scrollbar">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-[#1a160c] border border-[#d4af37]/60 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Trophy size={20} className="text-[#ffd100]" />
                        <div>
                          <span className="text-xs font-black text-white block">Pontos de Conquista</span>
                          <span className="text-[10px] text-zinc-400">Total registrado na conta</span>
                        </div>
                      </div>
                      <span className="font-mono font-black text-base text-[#ffd100]">
                        {profile?.achievementPoints || 1450} pts
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-[#141d1a] border border-emerald-500/60 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Crown size={20} className="text-emerald-400" />
                        <div>
                          <span className="text-xs font-black text-white block">Título Ativo</span>
                          <span className="text-[10px] text-zinc-400">Exibido na placa de identificação</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-xs text-emerald-300">
                        Campeão de Azeroth
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#12141f] border border-[#232738] space-y-2">
                    <h5 className="text-xs font-black text-amber-300 uppercase tracking-wider">
                      Proezas de Bravura & Feitos Notáveis (WoW Forever / Classic)
                    </h5>
                    <div className="space-y-1.5 text-xs text-zinc-300">
                      <div className="p-2 rounded bg-black/40 border border-zinc-800 flex items-center justify-between">
                        <span>⚔️ Marechal de Campo - Patente 13 do Sistema de Honra Clássico</span>
                        <span className="text-[10px] font-mono text-zinc-500">2026-09-15</span>
                      </div>
                      <div className="p-2 rounded bg-black/40 border border-zinc-800 flex items-center justify-between">
                        <span>⚡ Portador de Thunderfury, Lâmina Abençoada do Senhor do Vento</span>
                        <span className="text-[10px] font-mono text-zinc-500">2026-09-28</span>
                      </div>
                      <div className="p-2 rounded bg-black/40 border border-zinc-800 flex items-center justify-between">
                        <span>🐉 Matador de Lord Kazzak nas Blasted Lands</span>
                        <span className="text-[10px] font-mono text-zinc-500">2026-09-29</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SUB-ABA 8: CURIOSIDADES, SOCIAL & ECONOMIA                     */}
              {/* ------------------------------------------------------------- */}
              {journalSubTab === 8 && (
                <div className="space-y-3 overflow-y-auto max-h-[50vh] pr-1 custom-scrollbar">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {effectiveJournal.blizzardStats.social.map((soc, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-[#12141f] border border-[#232738] flex items-center justify-between">
                        <span className="text-xs text-zinc-300 font-medium">{soc.label}</span>
                        <span className={`text-xs font-mono font-black ${soc.highlight}`}>{soc.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 6. RODAPÉ INFORMATIVO WOW                                           */}
      {/* =================================================================== */}
      <div className="bg-[#0b0c12] px-4 py-2 border-t-2 border-[#96721d] flex items-center justify-between text-[11px] text-zinc-400 shrink-0">
        <span className="font-mono">
          Simulador oficial ativo • Pressione <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 font-bold border border-zinc-700">Esc</kbd> ou clique no [X] para fechar
        </span>
        <div className="flex items-center gap-3">
          <span className="text-amber-400 font-bold font-serif">
            Haleck Addon Simulator (ATT-Grade Engine)
          </span>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MODAL INTERNO: CÓDIGO LUA GERADO ON-DEMAND                         */}
      {/* =================================================================== */}
      {showExportModal && (
        <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-md p-5 flex flex-col rounded-2xl border-2 border-[#d4af37]">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <h4 className="text-sm font-black text-[#ffd100] flex items-center gap-2 font-serif uppercase tracking-wide">
              <FileText size={16} className="text-[#ffd100]" />
              <span>Snapshot LUA On-Demand ({activeVersion.name})</span>
            </h4>
            <button
              type="button"
              onClick={() => setShowExportModal(false)}
              className="w-7 h-7 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 my-3 overflow-hidden rounded-xl border border-zinc-800 bg-black p-3.5">
            <textarea
              readOnly
              value={simulatedLuaExport}
              className="w-full h-full bg-transparent text-xs font-mono text-cyan-300 resize-none focus:outline-none custom-scrollbar"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setShowExportModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={copyToClipboard}
              className="px-5 py-2 rounded-xl text-xs font-black bg-gradient-to-b from-[#8f1919] to-[#450909] border border-[#d4af37] text-[#ffd100] hover:text-white flex items-center gap-2 cursor-pointer shadow-md"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? "Copiado para Área de Transferência!" : "Copiar Texto LUA"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Guarda final para o modal externo
  if (!embedded && !isOpen) {
    return null;
  }

  // Modo Embutido (Sub-Aba 3 da Central de Configurações)
  if (embedded) {
    return <div className="w-full relative">{innerWindow}</div>;
  }

  // Modo Modal / Tela Cheia: Ocupa 95% do Espaço de Tela
  return (
    <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      {innerWindow}
    </div>
  );
};
