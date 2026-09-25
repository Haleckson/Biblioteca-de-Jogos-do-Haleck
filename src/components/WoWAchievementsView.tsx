/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Trophy,
  Search,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  Lock,
  Calendar,
  Sparkles,
  ExternalLink,
  RotateCw,
  Award,
  ChevronDown,
  Info,
  Shield,
  Layers,
  X,
} from "lucide-react";
import { BlizzardAchievement, BlizzardProfileData } from "../types";
import {
  getWowheadAchievementUrl,
  WowheadBadgeLink,
} from "../utils/wowheadUrls";

interface WoWAchievementsViewProps {
  profile: BlizzardProfileData;
  gameVersion?: string;
  activeCharacterName?: string;
  activeCharacterRealm?: string;
  onClose?: () => void;
  isEmbedded?: boolean;
}

const CATEGORIES = [
  "Todas",
  "Masmorras e Raides",
  "Missões",
  "JxJ (PvP)",
  "Exploração",
  "Geral & Personagem",
  "Profissões",
  "Reputação",
  "Eventos Mundiais",
  "Proezas de Bravura",
  "Legado",
];

export const WoWAchievementsView: React.FC<WoWAchievementsViewProps> = ({
  profile,
  gameVersion,
  activeCharacterName,
  activeCharacterRealm,
  onClose,
  isEmbedded = false,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "in_progress">("all");
  const [sortBy, setSortBy] = useState<
    "recent" | "oldest" | "points_desc" | "points_asc" | "title_asc" | "title_desc"
  >("recent");

  // Dynamic icon resolution cache for Wowhead icons
  const [resolvedIcons, setResolvedIcons] = useState<Record<number, string>>({});
  const [isLoadingLive, setIsLoadingLive] = useState(false);
  const [liveAchievements, setLiveAchievements] = useState<BlizzardAchievement[] | null>(null);

  // Hovered achievement for rich tooltip
  const [hoveredAchievement, setHoveredAchievement] = useState<{
    achieve: BlizzardAchievement;
    x: number;
    y: number;
  } | null>(null);

  const achieveLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (achieveLeaveTimeoutRef.current) clearTimeout(achieveLeaveTimeoutRef.current);
    };
  }, []);

  // Base achievements from profile or live fetch
  const baseAchievements: BlizzardAchievement[] = useMemo(() => {
    if (liveAchievements && liveAchievements.length > 0) {
      return liveAchievements;
    }
    if (profile.achievements && profile.achievements.length > 0) {
      return profile.achievements;
    }
    if (profile.recentAchievements && profile.recentAchievements.length > 0) {
      return profile.recentAchievements.map((r) => ({
        id: r.id,
        title: r.name,
        points: r.points,
        description: r.description,
        completedTimestamp: r.completedTimestamp,
        iconUrl: "https://render.worldofwarcraft.com/us/icons/56/achievement_general.jpg",
      }));
    }
    return [];
  }, [liveAchievements, profile.achievements, profile.recentAchievements]);

  // Batch resolve Wowhead icons for achievements that have placeholder or generic icons
  useEffect(() => {
    const idsToResolve = baseAchievements
      .filter((a) => {
        if (!a.id || resolvedIcons[a.id]) return false;
        const icon = a.iconUrl || "";
        return (
          icon.includes("achievement_general") ||
          icon.includes("inv_misc_questionmark") ||
          !icon
        );
      })
      .map((a) => a.id)
      .slice(0, 60);

    if (idsToResolve.length === 0) return;

    let isMounted = true;
    const fetchIcons = async () => {
      try {
        const res = await fetch(`/api/wow/achievement-icons?ids=${idsToResolve.join(",")}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.icons) {
            setResolvedIcons((prev) => ({ ...prev, ...data.icons }));
          }
        }
      } catch (_) {}
    };

    fetchIcons();
    return () => {
      isMounted = false;
    };
  }, [baseAchievements, resolvedIcons]);

  // Refresh live achievements from Blizzard API
  const refreshFromBlizzard = useCallback(async () => {
    const charName = activeCharacterName || profile.name;
    const realm = activeCharacterRealm || profile.realmSlug || profile.realm;
    if (!charName || !realm) return;

    setIsLoadingLive(true);
    try {
      const res = await fetch(
        `/api/blizzard/wow/character-achievements?name=${encodeURIComponent(
          charName
        )}&realm=${encodeURIComponent(realm)}&gameMode=${encodeURIComponent(
          gameVersion || profile.gameMode || "retail"
        )}`
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.achievements) && data.achievements.length > 0) {
          setLiveAchievements(data.achievements);
        }
      }
    } catch (err) {
      console.warn("Erro ao atualizar conquistas via Blizzard:", err);
    } finally {
      setIsLoadingLive(false);
    }
  }, [activeCharacterName, profile.name, activeCharacterRealm, profile.realmSlug, profile.realm, gameVersion, profile.gameMode]);

  // Compute metrics
  const totalPoints = useMemo(() => {
    return (
      profile.achievementPoints ||
      profile.achievementPointsTotal ||
      baseAchievements.reduce((sum, a) => sum + (a.points || 0), 0)
    );
  }, [profile.achievementPoints, profile.achievementPointsTotal, baseAchievements]);

  const completedCount = useMemo(() => {
    return baseAchievements.filter((a) => a.completedTimestamp !== undefined && a.completedTimestamp > 0).length;
  }, [baseAchievements]);

  // Filter and Sort Achievements
  const filteredAchievements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = baseAchievements.filter((a) => {
      if (!a) return false;

      // Search match
      if (q) {
        const matchTitle = (a.title || "").toLowerCase().includes(q);
        const matchDesc = (a.description || "").toLowerCase().includes(q);
        const matchCat = (a.category || "").toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchCat) return false;
      }

      // Status filter
      const isDone = a.completedTimestamp !== undefined && a.completedTimestamp > 0;
      if (statusFilter === "completed" && !isDone) return false;
      if (statusFilter === "in_progress" && isDone) return false;

      // Category filter
      if (selectedCategory !== "Todas") {
        const cat = (a.category || "").toLowerCase();
        const sel = selectedCategory.toLowerCase();
        if (sel.includes("masmorra") || sel.includes("raide")) {
          if (!cat.includes("dungeon") && !cat.includes("raid") && !cat.includes("masmorra")) return false;
        } else if (sel.includes("missões") || sel.includes("quest")) {
          if (!cat.includes("quest") && !cat.includes("miss")) return false;
        } else if (sel.includes("pxp") || sel.includes("jxj") || sel.includes("pvp")) {
          if (!cat.includes("pvp") && !cat.includes("jxj") && !cat.includes("player")) return false;
        } else if (sel.includes("explora")) {
          if (!cat.includes("explor") && !cat.includes("zone")) return false;
        } else if (sel.includes("profis")) {
          if (!cat.includes("profess") && !cat.includes("craft")) return false;
        } else if (sel.includes("reputa")) {
          if (!cat.includes("reput") && !cat.includes("faction")) return false;
        } else if (sel.includes("eventos")) {
          if (!cat.includes("event") && !cat.includes("world")) return false;
        } else if (sel.includes("proezas") || sel.includes("feats")) {
          if (!cat.includes("feat") && !cat.includes("proeza")) return false;
        } else if (sel.includes("legado") || sel.includes("legacy")) {
          if (!cat.includes("legacy") && !cat.includes("legado")) return false;
        }
      }

      return true;
    });

    // Sort order
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "recent":
          return (b.completedTimestamp || 0) - (a.completedTimestamp || 0);
        case "oldest":
          return (a.completedTimestamp || 0) - (b.completedTimestamp || 0);
        case "points_desc":
          return (b.points || 0) - (a.points || 0);
        case "points_asc":
          return (a.points || 0) - (b.points || 0);
        case "title_asc":
          return (a.title || "").localeCompare(b.title || "");
        case "title_desc":
          return (b.title || "").localeCompare(a.title || "");
        default:
          return (b.completedTimestamp || 0) - (a.completedTimestamp || 0);
      }
    });
  }, [baseAchievements, searchQuery, selectedCategory, statusFilter, sortBy]);

  const handleCardMouseEnter = (achieve: BlizzardAchievement, e: React.MouseEvent) => {
    if (achieveLeaveTimeoutRef.current) {
      clearTimeout(achieveLeaveTimeoutRef.current);
      achieveLeaveTimeoutRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredAchievement({
      achieve,
      x: rect.right + 12,
      y: rect.top,
    });
  };

  const handleCardMouseLeave = () => {
    achieveLeaveTimeoutRef.current = setTimeout(() => {
      setHoveredAchievement(null);
    }, 300);
  };

  return (
    <div className="space-y-4">
      {/* 1. Header Hero Banner: Trophy, Points & Blizzard Live Sync */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-950/40 via-zinc-900 to-zinc-950 border border-amber-500/30 p-4 shadow-xl">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/30 to-amber-900/60 border-2 border-amber-500/60 flex items-center justify-center shadow-lg shadow-amber-950/50">
              <Trophy size={28} className="text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-black text-white tracking-wide flex items-center gap-2">
                  <span>Progresso de Conquistas</span>
                  <span className="text-amber-400 font-mono text-sm px-2 py-0.5 rounded-lg bg-amber-950/80 border border-amber-500/50">
                    World of Warcraft
                  </span>
                </h3>
                {onClose && (
                  <button
                    onClick={onClose}
                    className="sm:hidden p-1 rounded-lg text-zinc-400 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5 mt-1 text-xs text-zinc-300 flex-wrap">
                <span className="text-amber-300 font-mono font-black text-sm">
                  {totalPoints.toLocaleString()} Pontos
                </span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400">
                  {completedCount} concluídas de {baseAchievements.length} registradas
                </span>
                {activeCharacterName && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span className="font-mono text-zinc-300">
                      Personagem: <strong>{activeCharacterName}</strong>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action: Refresh / Import from Blizzard */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshFromBlizzard}
              disabled={isLoadingLive}
              className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 font-bold text-xs transition-all shadow-md cursor-pointer flex items-center gap-2 disabled:opacity-50"
              title="Sincronizar dados de conquistas diretamente da API oficial da Blizzard"
            >
              <RotateCw size={14} className={isLoadingLive ? "animate-spin text-amber-400" : "text-amber-400"} />
              <span>{isLoadingLive ? "Sincronizando..." : "Sincronizar Blizzard"}</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="hidden sm:flex p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
                title="Fechar"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 pt-3 border-t border-zinc-800/80">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-1.5">
            <span>Conclusão Geral</span>
            <span className="text-amber-300 font-bold">
              {baseAchievements.length > 0
                ? `${Math.round((completedCount / baseAchievements.length) * 100)}%`
                : "100%"}
            </span>
          </div>
          <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/80">
            <div
              className="h-full bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400 rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
              style={{
                width: `${
                  baseAchievements.length > 0
                    ? Math.min(100, Math.round((completedCount / baseAchievements.length) * 100))
                    : 100
                }%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* 2. Controls Toolbar: Category Pills, Search, Status & Order by Completion Date */}
      <div className="p-3 bg-zinc-950/80 rounded-2xl border border-zinc-800 shadow-inner space-y-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? "bg-amber-500 text-black font-bold shadow-md shadow-amber-500/30"
                  : "bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-850 border border-zinc-800"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search, Status & Sort bar */}
        <div className="flex items-center justify-between gap-2.5 flex-wrap">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar conquista por nome, descrição ou recompensa..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 transition-colors"
            />
          </div>

          {/* Status Switcher */}
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                statusFilter === "all" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("completed")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                statusFilter === "completed" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              <CheckCircle2 size={12} />
              <span>Concluídas</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("in_progress")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                statusFilter === "in_progress" ? "bg-amber-600 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Lock size={12} />
              <span>Em Progresso</span>
            </button>
          </div>

          {/* Sort Selector: Explicit Sorting by Completion Date */}
          <div className="flex items-center gap-1.5 shrink-0 bg-zinc-900 px-2.5 py-1.5 rounded-xl border border-zinc-800">
            <ArrowUpDown size={13} className="text-amber-400" />
            <span className="text-[11px] font-mono text-zinc-400">Ordenar por:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer"
            >
              <option value="recent" className="bg-zinc-900 text-white">
                Data de Conclusão (Mais Recentes)
              </option>
              <option value="oldest" className="bg-zinc-900 text-white">
                Data de Conclusão (Mais Antigas)
              </option>
              <option value="points_desc" className="bg-zinc-900 text-white">
                Maior Pontuação (+pts)
              </option>
              <option value="points_asc" className="bg-zinc-900 text-white">
                Menor Pontuação (-pts)
              </option>
              <option value="title_asc" className="bg-zinc-900 text-white">
                Nome (A-Z)
              </option>
              <option value="title_desc" className="bg-zinc-900 text-white">
                Nome (Z-A)
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Achievements Grid */}
      {filteredAchievements.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredAchievements.map((achieve, idx) => {
            const isDone = achieve.completedTimestamp !== undefined && achieve.completedTimestamp > 0;
            const finalIconUrl =
              resolvedIcons[achieve.id] ||
              achieve.iconUrl ||
              "https://render.worldofwarcraft.com/us/icons/56/achievement_general.jpg";
            const wowheadUrl = getWowheadAchievementUrl(achieve.id, gameVersion || profile.wow_version);

            return (
              <div
                key={`achieve-${achieve.id}-${idx}`}
                onMouseEnter={(e) => handleCardMouseEnter(achieve, e)}
                onMouseLeave={handleCardMouseLeave}
                className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3.5 relative group ${
                  isDone
                    ? "bg-zinc-950/80 hover:bg-zinc-900/90 border-zinc-800 hover:border-amber-500/50 shadow-md hover:shadow-lg"
                    : "bg-zinc-950/40 border-zinc-800/60 opacity-70 hover:opacity-90"
                }`}
              >
                {/* Wowhead Resolved Achievement Icon */}
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-zinc-950 border-2 border-amber-500/50 overflow-hidden shadow-inner group-hover:scale-105 transition-transform">
                    <img
                      src={finalIconUrl}
                      alt={achieve.title}
                      onError={(e) => {
                        e.currentTarget.src =
                          "https://render.worldofwarcraft.com/us/icons/56/achievement_general.jpg";
                      }}
                      className="w-full h-full object-cover rounded-xl"
                      loading="lazy"
                    />
                  </div>
                  {isDone ? (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-sm">
                      <CheckCircle2 size={11} className="stroke-[3]" />
                    </div>
                  ) : (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center border border-zinc-700">
                      <Lock size={10} />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                        {achieve.title}
                      </h4>
                      {achieve.isCharacterSpecific && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-950/90 text-amber-300 border border-amber-500/40">
                          {achieve.characterName || "Exclusivo do Personagem"}
                        </span>
                      )}
                    </div>

                    {/* Points Badge */}
                    <span className="px-2 py-0.5 rounded-lg bg-amber-950/80 text-amber-300 font-mono font-black text-xs border border-amber-500/50 shrink-0 shadow-xs">
                      +{achieve.points ?? 10}
                    </span>
                  </div>

                  {achieve.description && (
                    <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                      {achieve.description}
                    </p>
                  )}

                  {/* Footer Row: Completion Date & Wowhead Shortcut */}
                  <div className="mt-2.5 pt-2 border-t border-zinc-800/70 flex items-center justify-between text-[10px] text-zinc-400 flex-wrap gap-1.5">
                    <div className="flex items-center gap-1 font-mono">
                      {isDone ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                          <Calendar size={11} />
                          <span>
                            Concluído em:{" "}
                            {new Date(achieve.completedTimestamp! * 1000).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </span>
                      ) : (
                        <span className="text-zinc-500 flex items-center gap-1">
                          <Lock size={11} />
                          <span>Não Concluído</span>
                        </span>
                      )}
                    </div>

                    {/* Direct Wowhead Link */}
                    <WowheadBadgeLink url={wowheadUrl} label="Wowhead" compact />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center rounded-2xl bg-zinc-950/40 border border-zinc-800/80 space-y-2">
          <Info className="w-8 h-8 text-zinc-500 mx-auto" />
          <h4 className="text-sm font-bold text-zinc-300">Nenhuma conquista encontrada</h4>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Tente mudar o filtro de categoria ou a busca por termo para visualizar outras conquistas.
          </p>
        </div>
      )}

      {/* 4. Rich Floating Tooltip on Hover */}
      {hoveredAchievement && (
        <div
          className="fixed z-50 pointer-events-auto p-3.5 rounded-2xl bg-zinc-950/95 border-2 border-amber-500/50 shadow-2xl backdrop-blur-md max-w-xs sm:max-w-sm text-left transition-opacity duration-150 animate-in fade-in space-y-2"
          style={{
            top: Math.min(window.innerHeight - 280, Math.max(16, hoveredAchievement.y - 20)),
            left: Math.min(window.innerWidth - 340, Math.max(16, hoveredAchievement.x)),
            boxShadow: "0 0 30px rgba(245, 158, 11, 0.25)",
          }}
          onMouseEnter={() => {
            if (achieveLeaveTimeoutRef.current) {
              clearTimeout(achieveLeaveTimeoutRef.current);
              achieveLeaveTimeoutRef.current = null;
            }
          }}
          onMouseLeave={() => {
            achieveLeaveTimeoutRef.current = setTimeout(() => {
              setHoveredAchievement(null);
            }, 250);
          }}
        >
          <div className="flex items-start justify-between gap-2 pb-2 border-b border-zinc-800">
            <div className="flex items-center gap-2.5">
              <img
                src={
                  resolvedIcons[hoveredAchievement.achieve.id] ||
                  hoveredAchievement.achieve.iconUrl ||
                  "https://render.worldofwarcraft.com/us/icons/56/achievement_general.jpg"
                }
                alt=""
                className="w-10 h-10 rounded-xl border border-amber-500/60 object-cover"
              />
              <div>
                <h5 className="text-xs font-bold text-white">
                  {hoveredAchievement.achieve.title}
                </h5>
                <span className="text-[10px] text-zinc-400 font-mono">
                  ID: #{hoveredAchievement.achieve.id}
                </span>
              </div>
            </div>

            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold">
              +{hoveredAchievement.achieve.points ?? 10} pts
            </span>
          </div>

          <p className="text-[11px] text-zinc-300 leading-relaxed">
            {hoveredAchievement.achieve.description || "Conquista oficial de World of Warcraft."}
          </p>

          <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-400">
            {hoveredAchievement.achieve.completedTimestamp ? (
              <span className="text-emerald-400 font-mono font-semibold">
                Concluído:{" "}
                {new Date(hoveredAchievement.achieve.completedTimestamp * 1000).toLocaleDateString()}
              </span>
            ) : (
              <span className="text-zinc-500">Em Progresso</span>
            )}

            <WowheadBadgeLink
              url={getWowheadAchievementUrl(hoveredAchievement.achieve.id, gameVersion || profile.wow_version)}
              label="Abrir no Wowhead"
              compact
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default WoWAchievementsView;
