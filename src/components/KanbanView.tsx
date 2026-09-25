import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Gamepad2,
  Star,
  Trophy,
  Plus,
  Play,
  CheckCircle2,
  Pause,
  XCircle,
  Clock,
  Columns3,
  SlidersHorizontal,
  Eye,
  Check,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Minimize2,
  Maximize2,
  Tag,
  Calendar,
  Folder,
  BookOpen,
  Search,
  X,
} from "lucide-react";
import { Game, getGameHighestTrophy, getGameTrophyItems, parseContextNote, formatDateDisplay } from "../types";
import { playRetroSound } from "../utils/audioEffects";
import { chipClass, renderStars, getPlatformBadgeStyle } from "./GameCard";
import TrophyBadge, { TrophiesList } from "./TrophyBadge";
import { formatHoursAndMinutes, getTotalGamePlaytimeHours } from "../utils/playtime";

/**
 * Utilitário para padronizar a conversão entre IDs / Palavras-chave do Kanban
 * e os valores oficiais de status da aplicação.
 */
export function mapKanbanToStatus(columnInput: string | string[]): string {
  if (!columnInput) return "Jogando";
  const rawStr = Array.isArray(columnInput) ? columnInput[0] || "Jogando" : columnInput;
  if (typeof rawStr !== "string") return "Jogando";
  const normalized = rawStr.trim().toLowerCase();
  if (normalized === "playing" || normalized === "jogando") return "Jogando";
  if (
    normalized === "paused" ||
    normalized === "pausado" ||
    normalized === "em hiatus" ||
    normalized === "hiatus"
  ) {
    return "Em Hiatus";
  }
  if (
    normalized === "completed" ||
    normalized === "zerado" ||
    normalized === "terminado" ||
    normalized === "concluido" ||
    normalized === "concluído"
  ) {
    return "Terminado";
  }
  if (
    normalized === "abandoned" ||
    normalized === "abandonado" ||
    normalized === "desistido"
  ) {
    return "Desistido";
  }
  if (
    normalized === "backlog" ||
    normalized === "quero jogar" ||
    normalized === "a jogar"
  ) {
    return "Backlog";
  }
  return rawStr;
}

/**
 * Mapeamento de estilo e cores por status para os cards do Kanban.
 */
export function getKanbanStatusColorStyle(rawStatusList: string[] | string) {
  const statusList = Array.isArray(rawStatusList)
    ? rawStatusList
    : typeof rawStatusList === "string" && rawStatusList
    ? [rawStatusList]
    : [];

  const firstStatus = (statusList[0] || "").toLowerCase();

  if (firstStatus.includes("jogando") || firstStatus.includes("playing")) {
    return {
      borderColor: "!border-emerald-500/50 hover:!border-emerald-400",
      bgGradient: "bg-emerald-950/15 hover:bg-emerald-950/30",
      accentBar: "bg-emerald-500",
      glow: "shadow-[0_0_15px_rgba(16,185,129,0.08)]",
      textColor: "text-emerald-400",
      badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    };
  }

  if (
    firstStatus.includes("hiatus") ||
    firstStatus.includes("pausad") ||
    firstStatus.includes("paused")
  ) {
    return {
      borderColor: "!border-amber-500/50 hover:!border-amber-400",
      bgGradient: "bg-amber-950/15 hover:bg-amber-950/30",
      accentBar: "bg-amber-500",
      glow: "shadow-[0_0_15px_rgba(245,158,11,0.08)]",
      textColor: "text-amber-400",
      badgeBg: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    };
  }

  if (
    firstStatus.includes("terminado") ||
    firstStatus.includes("zerado") ||
    firstStatus.includes("platinado") ||
    firstStatus.includes("conclu")
  ) {
    return {
      borderColor: "!border-sky-500/50 hover:!border-sky-400",
      bgGradient: "bg-sky-950/15 hover:bg-sky-950/30",
      accentBar: "bg-sky-500",
      glow: "shadow-[0_0_15px_rgba(56,189,248,0.08)]",
      textColor: "text-sky-400",
      badgeBg: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    };
  }

  if (
    firstStatus.includes("desistido") ||
    firstStatus.includes("abandonado") ||
    firstStatus.includes("interrompido")
  ) {
    return {
      borderColor: "!border-rose-500/50 hover:!border-rose-400",
      bgGradient: "bg-rose-950/15 hover:bg-rose-950/30",
      accentBar: "bg-rose-500",
      glow: "shadow-[0_0_15px_rgba(244,63,94,0.08)]",
      textColor: "text-rose-400",
      badgeBg: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    };
  }

  if (
    firstStatus.includes("backlog") ||
    firstStatus.includes("quero jogar") ||
    firstStatus.includes("fila")
  ) {
    return {
      borderColor: "!border-purple-500/50 hover:!border-purple-400",
      bgGradient: "bg-purple-950/15 hover:bg-purple-950/30",
      accentBar: "bg-purple-500",
      glow: "shadow-[0_0_15px_rgba(168,85,247,0.08)]",
      textColor: "text-purple-400",
      badgeBg: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    };
  }

  return {
    borderColor: "!border-zinc-700/60 hover:!border-cyan-500/50",
    bgGradient: "bg-zinc-900/90 hover:bg-zinc-800/80",
    accentBar: "bg-cyan-500",
    glow: "shadow-[0_0_12px_rgba(6,182,212,0.05)]",
    textColor: "text-cyan-400",
    badgeBg: "bg-zinc-800 text-zinc-300 border-zinc-700",
  };
}

interface KanbanViewProps {
  games: Game[];
  onSelectGame: (game: Game) => void;
  onUpdateGameStatus: (gameId: string, newStatus: string) => void;
  onOpenGameForm?: () => void;
}

interface ColumnDef {
  id: string;
  title: string;
  statusKeyword: string;
  icon: React.ReactNode;
  headerColor: string;
  borderColor: string;
}

const COLUMNS: ColumnDef[] = [
  {
    id: "backlog",
    title: "Quero Jogar",
    statusKeyword: "Backlog",
    icon: <Clock size={16} className="text-zinc-400" />,
    headerColor: "bg-zinc-800/60 text-zinc-300 border-zinc-700/60",
    borderColor: "hover:border-zinc-500/40",
  },
  {
    id: "playing",
    title: "Jogando",
    statusKeyword: "Jogando",
    icon: <Play size={16} className="text-emerald-400" />,
    headerColor: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    borderColor: "hover:border-emerald-500/40",
  },
  {
    id: "paused",
    title: "Pausado",
    statusKeyword: "Em Hiatus",
    icon: <Pause size={16} className="text-orange-400" />,
    headerColor: "bg-orange-500/10 text-orange-300 border-orange-500/30",
    borderColor: "hover:border-orange-500/40",
  },
  {
    id: "completed",
    title: "Zerado",
    statusKeyword: "Terminado",
    icon: <CheckCircle2 size={16} className="text-blue-400" />,
    headerColor: "bg-blue-500/10 text-blue-300 border-blue-500/30",
    borderColor: "hover:border-blue-500/40",
  },
  {
    id: "abandoned",
    title: "Abandonado",
    statusKeyword: "Desistido",
    icon: <XCircle size={16} className="text-red-400" />,
    headerColor: "bg-red-500/10 text-red-300 border-red-500/30",
    borderColor: "hover:border-red-500/40",
  },
];

export default function KanbanView({
  games,
  onSelectGame,
  onUpdateGameStatus,
  onOpenGameForm,
}: KanbanViewProps) {
  const [draggedGameId, setDraggedGameId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Set of expanded game IDs for individual card expand/collapse (starts empty so all start collapsed by default)
  const [expandedGameIds, setExpandedGameIds] = useState<Set<string>>(new Set());

  // Filter games in real-time within Kanban columns
  const filteredGames = games.filter((g) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = g.name?.toLowerCase().includes(q);
    const platformMatch = g.platform?.toLowerCase().includes(q);
    const developerMatch = g.developer?.toLowerCase().includes(q);
    const publisherMatch = g.publisher?.toLowerCase().includes(q);
    const genreMatch = Array.isArray(g.genre)
      ? g.genre.some((gen) => gen.toLowerCase().includes(q))
      : typeof g.genre === "string" && (g.genre as string).toLowerCase().includes(q);
    const tagMatch = Array.isArray(g.tags)
      ? g.tags.some((t) => t.toLowerCase().includes(q))
      : typeof g.tags === "string" && (g.tags as string).toLowerCase().includes(q);
    const statusMatch = Array.isArray(g.status)
      ? g.status.some((s) => s.toLowerCase().includes(q))
      : typeof g.status === "string" && (g.status as string).toLowerCase().includes(q);

    return (
      nameMatch ||
      platformMatch ||
      developerMatch ||
      publisherMatch ||
      genreMatch ||
      tagMatch ||
      statusMatch
    );
  });

  // Column visibility selector state
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("kanban_visible_columns");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return COLUMNS.map((c) => c.id);
  });

  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  const toggleColumnVisibility = (colId: string) => {
    setVisibleColumnIds((prev) => {
      let updated: string[];
      if (prev.includes(colId)) {
        if (prev.length <= 1) return prev; // Keep at least one column visible
        updated = prev.filter((id) => id !== colId);
      } else {
        updated = [...prev, colId];
      }
      try {
        localStorage.setItem("kanban_visible_columns", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const resetColumns = () => {
    const allIds = COLUMNS.map((c) => c.id);
    setVisibleColumnIds(allIds);
    try {
      localStorage.setItem("kanban_visible_columns", JSON.stringify(allIds));
    } catch (e) {}
  };

  const toggleExpandCard = (gameId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setExpandedGameIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) {
        next.delete(gameId);
      } else {
        next.add(gameId);
      }
      return next;
    });
  };

  const collapseAllVisible = () => {
    setExpandedGameIds(new Set());
  };

  const expandAllVisible = () => {
    const visibleGames = filteredGames.map((g) => g.id);
    setExpandedGameIds(new Set(visibleGames));
  };

  const allVisibleCollapsed =
    filteredGames.length === 0 || filteredGames.every((g) => !expandedGameIds.has(g.id));

  // Group games by column (respecting search filter)
  const getGamesForColumn = (col: ColumnDef) => {
    return filteredGames.filter((g) => {
      const statusList = Array.isArray(g.status)
        ? g.status
        : typeof g.status === "string"
        ? [g.status]
        : [];
      if (col.id === "backlog") {
        return statusList.some(
          (s) =>
            s.toLowerCase().includes("quero jogar") ||
            s.toLowerCase().includes("backlog") ||
            s.toLowerCase().includes("fila") ||
            s.toLowerCase().includes("a jogar")
        );
      }
      if (col.id === "playing") {
        return statusList.some((s) => s.toLowerCase().includes("jogando"));
      }
      if (col.id === "paused") {
        return statusList.some(
          (s) =>
            s.toLowerCase().includes("hiatus") ||
            s.toLowerCase().includes("pausad")
        );
      }
      if (col.id === "completed") {
        return statusList.some(
          (s) =>
            s.toLowerCase().includes("terminado") ||
            s.toLowerCase().includes("zerado") ||
            s.toLowerCase().includes("platinado") ||
            s.toLowerCase().includes("100%") ||
            s.toLowerCase().includes("conclu")
        );
      }
      if (col.id === "abandoned") {
        return statusList.some(
          (s) =>
            s.toLowerCase().includes("desistido") ||
            s.toLowerCase().includes("abandonado") ||
            s.toLowerCase().includes("interrompido")
        );
      }
      return false;
    });
  };

  const handleDragStart = (e: React.DragEvent, gameId: string) => {
    e.dataTransfer.setData("text/plain", gameId);
    setDraggedGameId(gameId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, column: ColumnDef) => {
    e.preventDefault();
    const gameId = e.dataTransfer.getData("text/plain") || draggedGameId;
    if (gameId) {
      const targetStatus = mapKanbanToStatus(column.statusKeyword || column.id);
      onUpdateGameStatus(gameId, targetStatus);
      playRetroSound("statusChange");
    }
    setDraggedGameId(null);
  };

  const visibleColumns = COLUMNS.filter((col) => visibleColumnIds.includes(col.id));

  return (
    <div className="w-full flex flex-col gap-4 pb-6">
      {/* Top Controls Bar: Search, Column Customization & Global Expand/Collapse */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-3 px-4 shadow-md backdrop-blur-md">
          <div className="flex items-center gap-3 flex-wrap flex-1 min-w-[240px]">
            <div className="flex items-center gap-2 shrink-0">
              <Columns3 size={18} className="text-cyan-400" />
              <span className="text-xs font-bold text-zinc-200 tracking-wide">
                Quadro Kanban
              </span>
            </div>

            {/* Real-time Search Input inside Kanban */}
            <div className="relative flex-1 max-w-xs min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar jogos no Kanban..."
                className="w-full bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700 focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/30 rounded-xl pl-8 pr-8 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5 rounded-md hover:bg-zinc-800 transition-colors"
                  title="Limpar pesquisa"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {searchQuery.trim() && (
              <span className="text-[11px] font-mono font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-0.5 rounded-lg shrink-0">
                {filteredGames.length} {filteredGames.length === 1 ? "resultado" : "resultados"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Global Collapse / Expand Toggle */}
            <button
              onClick={allVisibleCollapsed ? expandAllVisible : collapseAllVisible}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-800/80 text-zinc-300 border border-zinc-700/60 hover:bg-zinc-800 hover:text-white transition-all shadow-sm"
              title={
                allVisibleCollapsed
                  ? "Expandir todos os cards no quadro"
                  : "Colapsar todos os cards no quadro"
              }
            >
              {allVisibleCollapsed ? (
                <>
                  <Maximize2 size={13} className="text-cyan-400" />
                  <span>Expandir Todos</span>
                </>
              ) : (
                <>
                  <Minimize2 size={13} className="text-cyan-400" />
                  <span>Colapsar Todos</span>
                </>
              )}
            </button>

            {/* Customizer Columns Selector */}
            <button
              onClick={() => setIsSelectorOpen(!isSelectorOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                isSelectorOpen
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/10"
                  : "bg-zinc-800/80 text-zinc-300 border-zinc-700/60 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              <SlidersHorizontal size={14} className="text-cyan-400" />
              <span>Personalizar Colunas</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-zinc-950/80 text-[10px] font-mono font-extrabold text-cyan-400">
                {visibleColumnIds.length}/{COLUMNS.length}
              </span>
            </button>

            {onOpenGameForm && (
              <button
                onClick={onOpenGameForm}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-zinc-950 transition-all shadow-md"
              >
                <Plus size={14} />
                <span>Novo Jogo</span>
              </button>
            )}
          </div>
        </div>

        {/* Column Visibility Selector Drawer / Panel */}
        {isSelectorOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="bg-zinc-900/95 border border-zinc-800/90 rounded-2xl p-3.5 shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-zinc-400 font-semibold flex items-center gap-1.5 mr-1">
                <Eye size={14} className="text-cyan-400" /> Colunas Visíveis:
              </span>
              <div className="flex flex-wrap gap-2">
                {COLUMNS.map((col) => {
                  const isVisible = visibleColumnIds.includes(col.id);
                  return (
                    <button
                      key={col.id}
                      onClick={() => toggleColumnVisibility(col.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        isVisible
                          ? "bg-zinc-800 text-white border-cyan-500/50 shadow-sm"
                          : "bg-zinc-950/60 text-zinc-500 border-zinc-800 hover:text-zinc-400"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-md flex items-center justify-center border text-[9px] ${
                          isVisible
                            ? "bg-cyan-500 border-cyan-400 text-zinc-950 font-black"
                            : "border-zinc-700 bg-zinc-900"
                        }`}
                      >
                        {isVisible && <Check size={10} strokeWidth={3} />}
                      </div>
                      <span>{col.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {visibleColumnIds.length < COLUMNS.length && (
              <button
                onClick={resetColumns}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-zinc-400 hover:text-cyan-300 hover:bg-zinc-800 text-[11px] font-semibold transition-colors"
              >
                <RotateCcw size={12} />
                <span>Exibir Todas</span>
              </button>
            )}
          </motion.div>
        )}
      </div>

      {/* Kanban Columns Grid */}
      <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
        <div className="flex gap-4 min-w-[100%]">
          {visibleColumns.map((col) => {
            const colGames = getGamesForColumn(col);

            return (
              <div
                key={col.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col)}
                className="flex-1 min-w-[260px] bg-zinc-950/70 border border-zinc-800/80 rounded-3xl p-3 sm:p-4 flex flex-col h-[calc(100vh-230px)] shadow-xl backdrop-blur-md"
              >
                {/* Column Header with Total Games Counter */}
                <div
                  className={`p-3 rounded-2xl border ${col.headerColor} flex items-center justify-between mb-3 shadow-sm`}
                >
                  <div className="flex items-center gap-2">
                    {col.icon}
                    <h4 className="text-xs font-black tracking-wide uppercase">{col.title}</h4>
                  </div>
                  <div
                    className="px-2.5 py-0.5 rounded-full bg-zinc-950/80 border border-white/10 font-mono text-[11px] font-extrabold flex items-center gap-1 shadow-inner"
                    title={`Total de ${colGames.length} ${colGames.length === 1 ? "jogo" : "jogos"} no status ${col.title}`}
                  >
                    <span className="text-cyan-400">{colGames.length}</span>
                    <span className="text-[9px] text-zinc-400 uppercase font-sans font-bold">
                      {colGames.length === 1 ? "jogo" : "jogos"}
                    </span>
                  </div>
                </div>

                {/* Cards Container */}
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
                  {colGames.length === 0 ? (
                    <div className="py-8 text-center border-2 border-dashed border-zinc-800/60 rounded-2xl p-4 text-zinc-600 text-xs font-medium">
                      Nenhum jogo nesta coluna
                    </div>
                  ) : (
                    colGames.map((game) => {
                      const trophy = getGameHighestTrophy(game);
                      const isExpanded = expandedGameIds.has(game.id);
                      const isCollapsed = !isExpanded;

                      // Status list calculation with map fallback
                      const rawStatusList = Array.isArray(game.status)
                        ? game.status.filter(Boolean)
                        : typeof game.status === "string" && game.status
                        ? [game.status]
                        : [];
                      const validatedStatusList =
                        rawStatusList.length > 0
                          ? rawStatusList
                          : [mapKanbanToStatus(col.statusKeyword || col.id)];

                      // Color mapping style
                      const statusStyle = getKanbanStatusColorStyle(validatedStatusList);
                      const platformStyle = getPlatformBadgeStyle(game.platform);

                      // Genre tags calculation
                      const genreList = Array.isArray(game.genre)
                        ? game.genre.filter(Boolean)
                        : typeof game.genre === "string" && game.genre
                        ? [game.genre]
                        : [];

                      // Playtime & Note parsing
                      const totalPlaytimeHours = getTotalGamePlaytimeHours(game);
                      const formattedPlaytime = formatHoursAndMinutes(totalPlaytimeHours) || game.playtime;
                      const playParsed = parseContextNote(game.playtime);
                      const addParsed = parseContextNote(game.additionalPlaytime);
                      const noteText = playParsed.note || addParsed.note || game.replayNote || "";
                      const trophyItems = getGameTrophyItems(game);

                      return (
                        <motion.div
                          key={game.id}
                          layout
                          draggable
                          onDragStart={(e) => handleDragStart(e as any, game.id)}
                          whileHover={{ scale: 1.02, y: -2 }}
                          transition={{ type: "spring", stiffness: 450, damping: 25 }}
                          className={`relative overflow-hidden rounded-2xl border ${statusStyle.borderColor} ${statusStyle.bgGradient} ${statusStyle.glow} shadow-md hover:shadow-2xl hover:shadow-cyan-500/15 transition-all cursor-grab active:cursor-grabbing group p-3 hover:z-20`}
                        >
                          {/* Accent bar on left edge representing status color */}
                          <div
                            className={`absolute left-0 top-0 bottom-0 w-1 ${statusStyle.accentBar}`}
                          />

                          {/* COLLAPSED CARD LAYOUT (Default state) */}
                          {isCollapsed ? (
                            <div className="pl-1.5 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {game.cover ? (
                                  <img
                                    src={game.cover}
                                    alt={game.name}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      onSelectGame(game);
                                    }}
                                    className="w-7 h-7 object-cover rounded-lg shadow-sm border border-white/10 shrink-0 cursor-pointer hover:opacity-80 transition-opacity relative z-10 pointer-events-auto"
                                    title={`Abrir página de ${game.name}`}
                                  />
                                ) : (
                                  <div
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      onSelectGame(game);
                                    }}
                                    className="w-7 h-7 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-400 shrink-0 cursor-pointer hover:text-white transition-colors relative z-10 pointer-events-auto"
                                    title={`Abrir página de ${game.name}`}
                                  >
                                    <Gamepad2 size={14} />
                                  </div>
                                )}

                                <div className="min-w-0 flex-1">
                                  <h5
                                    role="button"
                                    tabIndex={0}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      onSelectGame(game);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onSelectGame(game);
                                      }
                                    }}
                                    className="text-xs font-bold text-white truncate leading-tight hover:text-cyan-400 hover:underline cursor-pointer transition-colors relative z-10 pointer-events-auto inline-block max-w-full"
                                    title={`Abrir página de ${game.name}`}
                                  >
                                    {game.name}
                                  </h5>
                                  <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 font-mono mt-0.5">
                                    <span className="truncate text-cyan-400 uppercase font-bold">
                                      {game.platform}
                                    </span>
                                    {game.rating > 0 && (
                                      <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                                        ★ {game.rating}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={(e) => toggleExpandCard(game.id, e)}
                                className="p-1 rounded-lg bg-zinc-800/80 hover:bg-cyan-500 hover:text-zinc-950 text-zinc-400 transition-all shrink-0 border border-zinc-700/60"
                                title="Expandir Card"
                              >
                                <ChevronDown size={14} />
                              </button>
                            </div>
                          ) : (
                            /* EXPANDED CARD LAYOUT */
                            <div className="pl-1.5">
                              {/* Header row with platform badge, date, and collapse toggle */}
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${platformStyle.bg} ${platformStyle.border} ${platformStyle.text} ${platformStyle.glow} uppercase flex items-center gap-1 shrink-0`}>
                                    {game.platform}
                                  </span>
                                  {(game.endDate || game.startDate) && (
                                    <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1 shrink-0">
                                      <Calendar size={10} className="text-cyan-400 shrink-0" />
                                      {formatDateDisplay(game.endDate || game.startDate)}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={(e) => toggleExpandCard(game.id, e)}
                                  className="p-1 rounded-lg bg-zinc-800/80 hover:bg-cyan-500 hover:text-zinc-950 text-zinc-400 transition-all shrink-0 border border-zinc-700/60"
                                  title="Colapsar Card"
                                >
                                  <ChevronUp size={14} />
                                </button>
                              </div>

                              <div className="flex items-start gap-3">
                                {game.cover ? (
                                  <img
                                    src={game.cover}
                                    alt={game.name}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      onSelectGame(game);
                                    }}
                                    className="w-14 h-20 object-cover rounded-xl shadow-md border border-white/10 shrink-0 cursor-pointer hover:opacity-80 transition-opacity relative z-10 pointer-events-auto"
                                    title={`Abrir página de ${game.name}`}
                                  />
                                ) : (
                                  <div
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      onSelectGame(game);
                                    }}
                                    className="w-14 h-20 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 shrink-0 cursor-pointer hover:text-white transition-colors relative z-10 pointer-events-auto"
                                    title={`Abrir página de ${game.name}`}
                                  >
                                    <Gamepad2 size={20} />
                                  </div>
                                )}

                                <div className="min-w-0 flex-1">
                                  <h5
                                    role="button"
                                    tabIndex={0}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      onSelectGame(game);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onSelectGame(game);
                                      }
                                    }}
                                    className="text-xs font-bold text-white leading-snug hover:text-cyan-400 hover:underline cursor-pointer transition-colors relative z-10 pointer-events-auto inline-block max-w-full"
                                    title={`Abrir página de ${game.name}`}
                                  >
                                    {game.name}
                                  </h5>

                                  {/* Rating & Playtime */}
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-zinc-400">
                                    {game.rating > 0 && (
                                      <div className="flex items-center gap-1">
                                        {renderStars(game.rating, `kanban-${game.id}`, "w-3 h-3")}
                                        <span className="text-[10px] font-bold text-amber-400">{Number(game.rating || 0).toFixed(1)}</span>
                                      </div>
                                    )}

                                    {formattedPlaytime && (
                                      <span className="font-mono text-zinc-300 flex items-center gap-1">
                                        <Clock size={10} className="text-cyan-400 shrink-0" />
                                        {formattedPlaytime}
                                      </span>
                                    )}
                                  </div>

                                  {/* Trophies */}
                                  {trophyItems.length > 0 && (
                                    <div className="mt-1 flex items-center gap-1">
                                      <TrophiesList trophies={trophyItems} mode="card" />
                                    </div>
                                  )}

                                  {/* Status Chips */}
                                  <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                                    {validatedStatusList.map((s, idx) => (
                                      <span
                                        key={`${s}-${idx}`}
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${chipClass(s)} shadow-sm`}
                                      >
                                        {s}
                                      </span>
                                    ))}
                                  </div>

                                  {/* Genre Tags */}
                                  {genreList.length > 0 && (
                                    <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                                      {genreList.slice(0, 3).map((g, idx) => (
                                        <span
                                          key={`genre-${g}-${idx}`}
                                          className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-zinc-950/80 text-zinc-300 border border-zinc-700/60 flex items-center gap-1 shadow-sm"
                                        >
                                          <Tag size={9} className="text-cyan-400" />
                                          {g}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {/* Custom Tags / Folders */}
                                  {Array.isArray(game.tags) && game.tags.filter(Boolean).length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1 items-center">
                                      {game.tags.filter(Boolean).slice(0, 2).map((t, idx) => (
                                        <span
                                          key={`tag-${t}-${idx}`}
                                          className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-zinc-900 text-zinc-400 border border-zinc-800 flex items-center gap-1"
                                        >
                                          <Folder size={9} className="text-purple-400" />
                                          {t}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {/* Note / Context Preview */}
                                  {noteText && (
                                    <p className="mt-1.5 text-[10px] text-zinc-400 italic line-clamp-1 flex items-center gap-1 bg-zinc-950/40 p-1 rounded border border-zinc-800/60" title={noteText}>
                                      <BookOpen size={10} className="text-cyan-400 shrink-0" />
                                      <span className="truncate">{noteText}</span>
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Move Quick Actions */}
                              <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[9px] text-zinc-500 font-mono">Arraste ou Mova:</span>
                                <div className="flex items-center gap-1">
                                  {COLUMNS.filter((c) => c.id !== col.id).map((c) => (
                                    <button
                                      key={c.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const targetStatus = mapKanbanToStatus(
                                          c.statusKeyword || c.id
                                        );
                                        onUpdateGameStatus(game.id, targetStatus);
                                        playRetroSound("statusChange");
                                      }}
                                      className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-cyan-500 hover:text-zinc-950 text-[9px] font-bold text-zinc-300 transition-colors"
                                      title={`Mover para ${c.title}`}
                                    >
                                      {c.title.slice(0, 3)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
