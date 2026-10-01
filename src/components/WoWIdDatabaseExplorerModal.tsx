/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Database,
  Search,
  X,
  RefreshCw,
  ExternalLink,
  Layers,
  Sparkles,
  Shield,
  Eye,
  Link as LinkIcon,
  Download,
  Info,
  CheckCircle2,
  ChevronRight,
  Boxes,
  Trophy,
  Award,
  Scroll,
  Globe,
  Copy,
  Check,
  FolderArchive,
  BookOpen,
} from "lucide-react";
import {
  fetchWoWIdDatabase,
  fetchWoWIdStats,
  lookupWoWIdWithRelations,
  WoWIdCategory,
  WoWIdDatabaseStats,
  WoWIdRelation,
} from "../utils/wowIdDatabase";
import {
  WOW_VERSIONS_CATALOG,
  WOW_DB2_SOURCES_CATALOG,
  WoWDb2SourceItem,
  WoWVersionDefinition,
} from "../utils/wowSourcesCatalog";
import { showToast } from "../utils/toast";

interface WoWIdDatabaseExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: WoWIdCategory;
  initialSearch?: string;
}

export const WoWIdDatabaseExplorerModal: React.FC<WoWIdDatabaseExplorerModalProps> = ({
  isOpen,
  onClose,
  initialCategory = "items",
  initialSearch = "",
}) => {
  const [activeCategory, setActiveCategory] = useState<WoWIdCategory | "sources">(initialCategory);
  const [searchTerm, setSearchTerm] = useState<string>(initialSearch);
  const [selectedVersion, setSelectedVersion] = useState<string>("all");
  const [sourceCategoryFilter, setSourceCategoryFilter] = useState<string>("all");
  const [copiedSourceId, setCopiedSourceId] = useState<string | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [stats, setStats] = useState<WoWIdDatabaseStats | null>(null);

  // Detail inspector for selected ID
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [selectedType, setSelectedType] = useState<string>("item");
  const [idDetails, setIdDetails] = useState<any | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      loadStats();
      if (activeCategory !== "sources") {
        loadData(activeCategory, searchTerm, selectedVersion);
      }
    }
  }, [isOpen, activeCategory, selectedVersion]);

  const loadStats = async () => {
    try {
      const s = await fetchWoWIdStats();
      setStats(s);
    } catch (_) {}
  };

  const loadData = async (cat: WoWIdCategory | "sources", search: string, ver = selectedVersion) => {
    if (cat === "sources") return;
    setIsLoading(true);
    try {
      const res = await fetchWoWIdDatabase(cat, search, 100, 0, ver);
      if (res.success) {
        setRecords(res.records || []);
        setTotalCount(res.total || 0);
        if (res.stats) setStats(res.stats);
      } else {
        setRecords([]);
        setTotalCount(0);
      }
    } catch (e: any) {
      showToast({ title: "Erro na Busca", message: e.message || "Erro ao consultar banco de IDs", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeCategory !== "sources") {
      loadData(activeCategory, searchTerm, selectedVersion);
    }
  };

  const handleInspectId = async (id: string | number, type: string) => {
    setSelectedId(id);
    setSelectedType(type);
    setIsLoadingDetails(true);
    try {
      const details = await lookupWoWIdWithRelations(id, type);
      setIdDetails(details);
    } catch (_) {
      setIdDetails(null);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleSeedDefaults = async () => {
    try {
      const res = await fetch("/api/blizzard/wow/ids/seed", { method: "POST" });
      if (res.ok) {
        showToast({ title: "Banco Reinicializado", message: "Catálogo de IDs canônicos atualizado com sucesso!", type: "success" });
        loadStats();
        if (activeCategory !== "sources") {
          loadData(activeCategory, searchTerm, selectedVersion);
        }
      }
    } catch (_) {}
  };

  const handleExportDatabase = () => {
    const dataToExport = activeCategory === "sources" ? WOW_DB2_SOURCES_CATALOG : records;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `wow_${activeCategory}_export.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast({ title: "Exportado", message: `Arquivo JSON de ${activeCategory} baixado!`, type: "success" });
  };

  const handleCopySourceUrl = (src: WoWDb2SourceItem) => {
    navigator.clipboard.writeText(src.url);
    setCopiedSourceId(src.id);
    showToast({
      title: "Link Copiado",
      message: `URL copiada: ${src.title}`,
      type: "success",
    });
    setTimeout(() => {
      setCopiedSourceId((curr) => (curr === src.id ? null : curr));
    }, 2500);
  };

  // Filter sources
  const filteredSources = WOW_DB2_SOURCES_CATALOG.filter((src) => {
    const matchesCat = sourceCategoryFilter === "all" || src.category === sourceCategoryFilter;
    const matchesVer = selectedVersion === "all" || src.targetVersions.includes(selectedVersion);
    const matchesSearch =
      !searchTerm.trim() ||
      src.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      src.idType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (src.db2Table && src.db2Table.toLowerCase().includes(searchTerm.toLowerCase())) ||
      src.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      src.url.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesVer && matchesSearch;
  });

  const sourceCategories = Array.from(new Set(WOW_DB2_SOURCES_CATALOG.map((s) => s.category)));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-950 border border-cyan-500/40 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl shadow-cyan-500/10 overflow-hidden text-left">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-300 shrink-0 shadow-inner">
              <Database size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  World of Warcraft ID & Relational Database
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold">
                  Armazenamento Permanente
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Catálogo unificado e relacional de Item IDs, Display IDs, Spell IDs, Montarias, Mascotes e Vínculos 3D.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportDatabase}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              title="Exportar tabela atual em JSON"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Exportar JSON</span>
            </button>
            <button
              type="button"
              onClick={handleSeedDefaults}
              className="px-3 py-1.5 rounded-xl bg-cyan-950/70 hover:bg-cyan-900/90 border border-cyan-500/40 text-cyan-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              title="Restaurar banco canônico de IDs padrão"
            >
              <RefreshCw size={13} />
              <span className="hidden sm:inline">Recarregar IDs Padrão</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Quick Stats Bar */}
        {stats && (
          <div className="bg-zinc-900/40 border-b border-zinc-800/80 px-4 py-2.5 flex items-center justify-between text-xs text-zinc-400 overflow-x-auto gap-4 shrink-0">
            <div className="flex items-center gap-4 text-[11px] font-mono whitespace-nowrap">
              <span>🛡️ Itens: <strong className="text-cyan-300 font-bold">{stats.totalItems}</strong></span>
              <span>🎭 Modelos 3D: <strong className="text-cyan-300 font-bold">{stats.totalDisplays}</strong></span>
              <span>✨ Feitiços: <strong className="text-cyan-300 font-bold">{stats.totalSpells}</strong></span>
              <span>🐴 Montarias: <strong className="text-cyan-300 font-bold">{stats.totalMounts}</strong></span>
              <span>🐾 Mascotes: <strong className="text-cyan-300 font-bold">{stats.totalPets}</strong></span>
              <span>🐉 Criaturas: <strong className="text-cyan-300 font-bold">{stats.totalCreatures}</strong></span>
              <span>🏆 Conquistas: <strong className="text-cyan-300 font-bold">{stats.totalAchievements ?? 0}</strong></span>
              <span>👑 Títulos: <strong className="text-cyan-300 font-bold">{stats.totalTitles ?? 0}</strong></span>
              <span>📜 Missões: <strong className="text-cyan-300 font-bold">{stats.totalQuests ?? 0}</strong></span>
              <span>🔗 Vínculos Relacionais: <strong className="text-purple-300 font-bold">{stats.totalRelations}</strong></span>
            </div>
            <div className="text-[10px] text-zinc-500 whitespace-nowrap">
              Última atualização: {new Date(stats.lastUpdated).toLocaleDateString()}
            </div>
          </div>
        )}

        {/* Category Navigation Tabs */}
        <div className="flex border-b border-zinc-800/80 bg-zinc-900/30 px-4 pt-2 gap-1.5 overflow-x-auto shrink-0">
          {[
            { id: "items", label: "Itens (Item IDs)", icon: Shield },
            { id: "displays", label: "Modelos 3D (Display IDs)", icon: Eye },
            { id: "spells", label: "Feitiços (Spell IDs)", icon: Sparkles },
            { id: "mounts", label: "Montarias (Mount IDs)", icon: Layers },
            { id: "pets", label: "Mascotes (Pet Species)", icon: Boxes },
            { id: "creatures", label: "Criaturas & Chefes", icon: Info },
            { id: "achievements", label: "Conquistas (Achievements)", icon: Trophy },
            { id: "titles", label: "Títulos (Titles)", icon: Award },
            { id: "quests", label: "Missões (Quests)", icon: Scroll },
            { id: "relations", label: "Vínculos Relacionais", icon: LinkIcon },
            { id: "sources", label: "Fontes & DB2 Tables (60)", icon: Globe },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveCategory(tab.id as any);
                  setSelectedId(null);
                }}
                className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center gap-1.5 cursor-pointer border-b-2 whitespace-nowrap ${
                  active
                    ? "bg-zinc-950 border-cyan-400 text-cyan-300 shadow-sm"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Workspace */}
        {activeCategory === "sources" ? (
          /* Dedicated DB2 Sources & WoW Versions Explorer */
          <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
            {/* Top Toolbar: Search + Category Filter + Version Selector */}
            <div className="p-3.5 border-b border-zinc-800/80 bg-zinc-900/40 space-y-3 shrink-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[240px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar em 60 fontes por tabela DB2, ID Type, nome ou URL..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                {/* Version Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-400 font-medium hidden sm:inline">Versão:</span>
                  <select
                    value={selectedVersion}
                    onChange={(e) => setSelectedVersion(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-cyan-300 font-bold focus:border-cyan-500 focus:outline-none cursor-pointer"
                  >
                    <option value="all">Todas as Versões (Global)</option>
                    <option value="forever">⭐ WoW Forever Beta (1.60.1 / 16001)</option>
                    <option value="classic_era">WoW Classic Era (1.15.6)</option>
                    <option value="retail">WoW Retail: The War Within (11.x)</option>
                    <option value="midnight">WoW Retail: Midnight (12.1)</option>
                    <option value="tbc">TBC Classic (2.5.4)</option>
                    <option value="wotlk">WotLK Classic (3.4.3)</option>
                    <option value="cata">Cataclysm Classic (4.4.1)</option>
                    <option value="mop">Mists of Pandaria (5.4.8)</option>
                    <option value="wod">Warlords of Draenor (6.2)</option>
                    <option value="legion">Legion (7.3)</option>
                    <option value="bfa">Battle for Azeroth (8.3)</option>
                    <option value="shadowlands">Shadowlands (9.2)</option>
                    <option value="dragonflight">Dragonflight (10.2)</option>
                  </select>
                </div>
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setSourceCategoryFilter("all")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                    sourceCategoryFilter === "all"
                      ? "bg-cyan-500 text-black shadow-sm"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  Todas ({WOW_DB2_SOURCES_CATALOG.length})
                </button>
                {sourceCategories.map((cat) => {
                  const count = WOW_DB2_SOURCES_CATALOG.filter((s) => s.category === cat).length;
                  const isAct = sourceCategoryFilter === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSourceCategoryFilter(cat)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                        isAct
                          ? "bg-cyan-500 text-black shadow-sm"
                          : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content: Architecture Notice + Grid of Sources */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Version Architecture Overview Card */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/40 via-zinc-900 to-purple-950/30 border border-cyan-500/40 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} className="text-cyan-400" />
                    <h4 className="text-xs font-bold text-white">
                      Arquitetura de Versões & Numerações TOC Oficiais
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">
                    60 Fontes Indexadas • DB2 & APIs
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-zinc-950 border border-cyan-500/50">
                    <div className="flex items-center justify-between text-cyan-300 font-bold">
                      <span>⭐ WoW Forever (Vanilla+)</span>
                      <span className="font-mono text-[10px]">TOC 160001</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1">
                      Build <strong className="text-white">1.60.1.70009 / 16001</strong> • Pasta no disco: <code className="text-amber-300 font-mono">_classic_beta_</code>
                    </p>
                    <a
                      href="https://wago.tools/db2?build=1.60.1.70009"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 mt-1 font-mono"
                    >
                      Abrir DB2 no Wago.tools <ExternalLink size={10} />
                    </a>
                  </div>

                  <div className="p-2.5 rounded-lg bg-zinc-950 border border-amber-500/40">
                    <div className="flex items-center justify-between text-amber-300 font-bold">
                      <span>WoW Classic Era (60)</span>
                      <span className="font-mono text-[10px]">TOC 11506</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1">
                      Build <strong className="text-white">1.15.6.58238</strong> • Pasta no disco: <code className="text-zinc-300 font-mono">_classic_era_</code>
                    </p>
                    <a
                      href="https://wago.tools/db2?build=1.15.6.58238"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-amber-400 hover:underline flex items-center gap-1 mt-1 font-mono"
                    >
                      Abrir DB2 no Wago.tools <ExternalLink size={10} />
                    </a>
                  </div>

                  <div className="p-2.5 rounded-lg bg-zinc-950 border border-purple-500/40">
                    <div className="flex items-center justify-between text-purple-300 font-bold">
                      <span>WoW Retail: The War Within</span>
                      <span className="font-mono text-[10px]">TOC 110100</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1">
                      Build <strong className="text-white">11.1.0</strong> • Pasta no disco: <code className="text-zinc-300 font-mono">_retail_</code>
                    </p>
                    <a
                      href="https://wago.tools/db2"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-purple-400 hover:underline flex items-center gap-1 mt-1 font-mono"
                    >
                      Abrir DB2 no Wago.tools <ExternalLink size={10} />
                    </a>
                  </div>

                  <div className="p-2.5 rounded-lg bg-zinc-950 border border-fuchsia-500/40">
                    <div className="flex items-center justify-between text-fuchsia-300 font-bold">
                      <span>WoW Retail: Midnight (12.1)</span>
                      <span className="font-mono text-[10px]">TOC 120100</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1">
                      Build <strong className="text-white">12.1.0</strong> • Quel'Thalas & Suporte Antecipado
                    </p>
                    <a
                      href="https://wago.tools/db2"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-fuchsia-400 hover:underline flex items-center gap-1 mt-1 font-mono"
                    >
                      Abrir DB2 no Wago.tools <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              </div>

              {/* Sources Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredSources.map((src) => {
                  const isCopied = copiedSourceId === src.id;
                  const isForeverSpecific = src.targetVersions.includes("forever") && src.url.includes("1.60");
                  return (
                    <div
                      key={src.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 group ${
                        isForeverSpecific
                          ? "bg-cyan-950/20 border-cyan-500/50 hover:border-cyan-400"
                          : "bg-zinc-900/50 border-zinc-800/80 hover:border-zinc-700"
                      }`}
                    >
                      <div className="space-y-1.5">
                        {/* Header Badges */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-bold">
                            {src.category}
                          </span>
                          {src.db2Table && (
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold">
                              {src.db2Table}
                            </span>
                          )}
                          {!src.db2Table && (
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-purple-950 border border-purple-500/40 text-purple-300 font-bold">
                              {src.idType}
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                          {src.title}
                        </h4>

                        {/* Description */}
                        <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-3">
                          {src.description}
                        </p>

                        {/* Target Versions Tags */}
                        <div className="flex items-center gap-1 flex-wrap pt-1">
                          {src.targetVersions.map((v) => (
                            <span
                              key={v}
                              className={`text-[8.5px] font-mono px-1.5 py-0.2 rounded ${
                                v === "forever"
                                  ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40"
                                  : v === "retail" || v === "midnight"
                                  ? "bg-purple-950 text-purple-300 border border-purple-500/40"
                                  : "bg-zinc-800 text-zinc-400"
                              }`}
                            >
                              {v === "forever" ? "Forever 1.60" : v === "retail" ? "Retail 11.x" : v === "midnight" ? "Midnight 12.1" : v}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopySourceUrl(src)}
                          className="px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-mono text-zinc-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                        >
                          {isCopied ? (
                            <>
                              <Check size={11} className="text-emerald-400" />
                              <span className="text-emerald-300">Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span>Copiar Link</span>
                            </>
                          )}
                        </button>

                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/40 text-[10px] font-bold text-cyan-300 hover:text-white transition-all flex items-center gap-1 font-mono"
                        >
                          <span>Abrir</span>
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredSources.length === 0 && (
                <div className="py-20 text-center text-zinc-500 text-xs">
                  Nenhuma fonte encontrada para o termo pesquisado ou filtros ativos.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Two-Pane Workspace for Standard ID Categories */
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Search & Records Table */}
            <div className="flex-1 flex flex-col border-r border-zinc-800/80 overflow-hidden">
              {/* Search Input & Version Dropdown */}
              <div className="p-3 border-b border-zinc-800/60 bg-zinc-900/20 shrink-0">
                <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder={`Buscar em ${activeCategory} por ID, nome ou modelo...`}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  <select
                    value={selectedVersion}
                    onChange={(e) => setSelectedVersion(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-2 text-xs text-zinc-300 font-medium focus:border-cyan-500 focus:outline-none shrink-0 cursor-pointer"
                  >
                    <option value="all">Todas as Versões</option>
                    <option value="forever">⭐ WoW Forever (1.60)</option>
                    <option value="classic_era">Classic Era (1.15)</option>
                    <option value="retail">Retail (11.x)</option>
                    <option value="midnight">Retail: Midnight (12.1)</option>
                    <option value="tbc">TBC Classic</option>
                    <option value="wotlk">WotLK Classic</option>
                    <option value="cata">Cata Classic</option>
                    <option value="mop">MoP Classic</option>
                  </select>

                  <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    Buscar
                  </button>
                </form>
              </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {isLoading ? (
                <div className="py-20 text-center text-zinc-400 flex flex-col items-center justify-center gap-2">
                  <RefreshCw size={24} className="animate-spin text-cyan-400" />
                  <span className="text-xs">Consultando banco de IDs de WoW...</span>
                </div>
              ) : records.length === 0 ? (
                <div className="py-16 text-center text-zinc-500 text-xs">
                  Nenhum registro encontrado para esta categoria ou filtro.
                </div>
              ) : (
                records.map((r: any, idx: number) => {
                  const idVal = r.id || r.displayId || r.spellId || r.mountId || r.speciesId || r.creatureId || r.achievementId || r.titleId || r.questId || idx;
                  const isSelected = selectedId === idVal;

                  return (
                    <div
                      key={`${idVal}-${idx}`}
                      onClick={() => handleInspectId(idVal, activeCategory.slice(0, -1))}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-cyan-950/40 border-cyan-500/60 shadow-sm shadow-cyan-500/10"
                          : "bg-zinc-900/40 hover:bg-zinc-900/80 border-zinc-800/80 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center font-mono text-[10px] text-cyan-400 shrink-0 font-bold">
                          #{idVal}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate">
                            {r.title || r.name || r.label || `${activeCategory.toUpperCase()} #${idVal}`}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono mt-0.5 flex-wrap">
                            {r.displayId && (
                              <span className="text-cyan-300">DisplayID: #{r.displayId}</span>
                            )}
                            {r.spellId && (
                              <span className="text-purple-300">SpellID: #{r.spellId}</span>
                            )}
                            {r.creatureDisplayId && (
                              <span className="text-amber-300">CreatureDisplay: #{r.creatureDisplayId}</span>
                            )}
                            {r.points !== undefined && (
                              <span className="text-amber-300 font-bold">★ {r.points} Pontos</span>
                            )}
                            {r.rewardTitleId && (
                              <span className="text-purple-300">Título: #{r.rewardTitleId}</span>
                            )}
                            {r.rewardItemId && (
                              <span className="text-cyan-300">Item: #{r.rewardItemId}</span>
                            )}
                            {r.rewardMountId && (
                              <span className="text-emerald-400">Montaria: #{r.rewardMountId}</span>
                            )}
                            {r.level !== undefined && (
                              <span className="text-zinc-400">Nv. {r.level}</span>
                            )}
                            {r.zone && (
                              <span className="text-zinc-400">{r.zone}</span>
                            )}
                            {r.slotId !== undefined && (
                              <span className="text-zinc-500">Slot #{r.slotId}</span>
                            )}
                            {r.linkedItemIds && (
                              <span className="text-emerald-400">{r.linkedItemIds.length} Itens Vinculados</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <ChevronRight size={14} className="text-zinc-500 shrink-0" />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Relations & 3D Connection Inspector */}
          <div className="w-80 sm:w-96 flex flex-col bg-zinc-950 overflow-y-auto p-4 space-y-4 shrink-0">
            {isLoadingDetails ? (
              <div className="py-20 text-center text-zinc-400 flex flex-col items-center justify-center gap-2">
                <RefreshCw size={20} className="animate-spin text-cyan-400" />
                <span className="text-xs">Carregando vínculos relacionais...</span>
              </div>
            ) : selectedId && idDetails ? (
              <div className="space-y-4">
                {/* Header of Inspector */}
                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                  <span className="text-[10px] font-mono uppercase text-cyan-400 font-bold block mb-1">
                    Inspeção de Vínculos & Dependências
                  </span>
                  <h3 className="text-sm font-black text-white">
                    {idDetails.record?.name || `${idDetails.type?.toUpperCase()} #${idDetails.id}`}
                  </h3>
                  <div className="mt-2 text-xs font-mono text-zinc-400 space-y-1">
                    <div>ID Principal: <strong className="text-white">#{idDetails.id}</strong></div>
                    <div>Tipo: <strong className="text-cyan-300 uppercase">{idDetails.type}</strong></div>
                    {idDetails.record?.displayId && (
                      <div>Display ID 3D: <strong className="text-emerald-400">#{idDetails.record.displayId}</strong></div>
                    )}
                    {idDetails.record?.spellId && (
                      <div>Spell ID: <strong className="text-purple-400">#{idDetails.record.spellId}</strong></div>
                    )}
                  </div>
                </div>

                {/* Linked Items Sharing Display */}
                {idDetails.linkedItems && idDetails.linkedItems.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-2">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Layers size={13} className="text-cyan-400" />
                      <span>Itens que compartilham este Modelo 3D:</span>
                    </h4>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {idDetails.linkedItems.map((it: any) => (
                        <div
                          key={it.id}
                          className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] flex items-center justify-between"
                        >
                          <span className="font-medium text-zinc-200 truncate">{it.name || `Item #${it.id}`}</span>
                          <span className="font-mono text-[10px] text-cyan-400 shrink-0 ml-2">ID #{it.id}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Explicit Relations Map */}
                <div className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-2.5">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <LinkIcon size={13} className="text-purple-400" />
                    <span>Conexões Relacionais ({idDetails.relations?.length || 0}):</span>
                  </h4>
                  {idDetails.relations && idDetails.relations.length > 0 ? (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {idDetails.relations.map((rel: WoWIdRelation, idx: number) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-zinc-950 border border-purple-500/30 text-[11px] space-y-1"
                        >
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="text-zinc-400">{rel.sourceType} #{rel.sourceId}</span>
                            <span className="text-purple-400 font-bold">→ {rel.relation} →</span>
                            <span className="text-cyan-400">{rel.targetType} #{rel.targetId}</span>
                          </div>
                          {rel.label && (
                            <p className="text-[10px] text-zinc-300 italic">{rel.label}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-zinc-500">Nenhuma relação externa registrada para este identificador.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-24 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-2">
                <Info size={24} className="text-zinc-600" />
                <span>Selecione um identificador à esquerda para inspecionar seus modelos 3D e vínculos relacionais.</span>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
};
