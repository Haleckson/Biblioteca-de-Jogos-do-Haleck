import React, { useMemo, useState } from "react";
import {
  Trophy,
  Clock,
  Gamepad2,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Award,
  Layers,
  Star,
  Bookmark,
  Flame,
  X,
  Info,
  ExternalLink,
  RotateCcw,
  Search,
  Tag,
  Calendar,
  Zap,
  Shield,
} from "lucide-react";
import { Game, getDlcMode, formatDateDisplay, splitEntities, getGameHighestTrophy } from "../types";
import TrophyBadge from "./TrophyBadge";

interface DashboardViewProps {
  games: Game[];
  onSelectGame?: (gameId: string) => void;
  onNavigateToLibraryWithStatus?: (status: string) => void;
  onUpdateGame?: (game: Game) => void;
  isAdmin?: boolean;
}

// Helper to parse playtime string (e.g. "45h", "120 horas", "30.5h", "12h 30m", "1000h 15m") to number of hours
export function parsePlaytimeHours(playtimeStr: string | undefined): number {
  if (!playtimeStr) return 0;
  const cleaned = playtimeStr.toLowerCase().replace(/,/g, ".");
  
  // Match hours and minutes if available: e.g. 1200h 30m, 1000h, 15h 20m
  const hmMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*h(?:oras?)?(?:\s*(\d+)\s*m)?/);
  if (hmMatch) {
    const hours = parseFloat(hmMatch[1]) || 0;
    const mins = parseFloat(hmMatch[2]) || 0;
    return hours + mins / 60;
  }

  // Pure numeric match
  const numMatch = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) {
    return parseFloat(numMatch[1]) || 0;
  }
  return 0;
}

export function getTotalGamePlaytimeHours(game: Game): number {
  return parsePlaytimeHours(game.playtime) + parsePlaytimeHours(game.additionalPlaytime);
}

// Formats fractional hours to clean "00h 00m" without repeating decimals
export function formatHoursAndMinutes(totalHours: number): string {
  if (!totalHours || isNaN(totalHours) || totalHours <= 0) return "00h 00m";
  let h = Math.floor(totalHours);
  let m = Math.round((totalHours - h) * 60);
  if (m >= 60) {
    h += Math.floor(m / 60);
    m = m % 60;
  }
  const hStr = h < 10 ? `0${h}` : `${h}`;
  const mStr = m < 10 ? `0${m}` : `${m}`;
  return `${hStr}h ${mStr}m`;
}

// Converts user rating (0-5 scale, step 0.5) to Metacritic equivalent (0-100 scale)
export function convertUserRatingTo100(rating: number | undefined): number {
  if (rating === undefined || rating === null || rating <= 0) return 0;
  return Math.round(rating * 20);
}

interface DetailModalData {
  title: string;
  subtitle: string;
  explanation: string;
  icon?: React.ReactNode;
  gamesList: Game[];
  metricType?: "playtime" | "hltb_backlog" | "metacritic" | "user_rating" | "trophies" | "status" | "general";
}

interface RecentlyFinishedGameCardProps {
  key?: string | number;
  game: Game;
  onSelectGame?: (gameId: string) => void;
  onUpdateGame?: (game: Game) => void;
  isAdmin?: boolean;
}

function RecentlyFinishedGameCard({
  game,
  onSelectGame,
  onUpdateGame,
  isAdmin = true,
}: RecentlyFinishedGameCardProps) {
  const posX = game.coverPositionX !== undefined ? game.coverPositionX : 50;
  const posY = game.coverPosition !== undefined ? game.coverPosition : 50;
  const zoom = game.coverZoom !== undefined ? game.coverZoom : 100;

  const [isAdjusting, setIsAdjusting] = useState(false);
  const [tempPosX, setTempPosX] = useState(posX);
  const [tempPosY, setTempPosY] = useState(posY);
  const [tempZoom, setTempZoom] = useState(zoom);

  const coverContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setTempPosX(posX);
    setTempPosY(posY);
    setTempZoom(zoom);
  }, [posX, posY, zoom]);

  React.useEffect(() => {
    const el = coverContainerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (isAdjusting) {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY < 0 ? 5 : -5;
        setTempZoom((prev) => Math.max(20, Math.min(300, prev + delta)));
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, [isAdjusting]);

  const cardDragRef = React.useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    startPosX: 50,
    startPosY: 50,
  });

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAdjusting) return;
    e.stopPropagation();
    e.preventDefault();
    cardDragRef.current.isDragging = true;
    cardDragRef.current.startX = e.clientX;
    cardDragRef.current.startY = e.clientY;
    cardDragRef.current.startPosX = tempPosX;
    cardDragRef.current.startPosY = tempPosY;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardDragRef.current.isDragging) return;
    e.stopPropagation();
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const containerWidth = rect.width || 150;
    const containerHeight = rect.height || 200;

    const deltaX = e.clientX - cardDragRef.current.startX;
    const deltaY = e.clientY - cardDragRef.current.startY;

    const deltaPctX = (deltaX / containerWidth) * 100;
    const deltaPctY = (deltaY / containerHeight) * 100;

    const zoomFactor = tempZoom / 100;
    const sensitivity = 0.8 / zoomFactor;
    const nextX = Math.max(0, Math.min(100, cardDragRef.current.startPosX - deltaPctX * sensitivity));
    const nextY = Math.max(0, Math.min(100, cardDragRef.current.startPosY - deltaPctY * sensitivity));

    setTempPosX(nextX);
    setTempPosY(nextY);
  };

  const handleMouseUpOrLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (cardDragRef.current.isDragging) {
      e.stopPropagation();
      e.preventDefault();
      cardDragRef.current.isDragging = false;
    }
  };

  const handleSavePosition = () => {
    if (onUpdateGame) {
      onUpdateGame({
        ...game,
        coverPosition: tempPosY,
        coverPositionX: tempPosX,
        coverZoom: tempZoom,
      });
    }
    setIsAdjusting(false);
  };

  const activePosX = isAdjusting ? tempPosX : posX;
  const activePosY = isAdjusting ? tempPosY : posY;
  const activeZoom = isAdjusting ? tempZoom : zoom;

  return (
    <div
      onClick={() => {
        if (!isAdjusting && onSelectGame) {
          onSelectGame(game.id);
        }
      }}
      className="bg-zinc-950 hover:bg-zinc-800 rounded-2xl border border-zinc-800/80 p-2.5 flex flex-col transition-all cursor-pointer group hover:scale-[1.02] relative"
    >
      <div
        ref={coverContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className={`relative aspect-[3/4] w-full rounded-xl overflow-hidden mb-2 bg-zinc-900 ${
          isAdjusting ? "cursor-move border-2 border-dashed border-cyan-400 z-20" : ""
        }`}
      >
        {/* Background blurred cover to prevent black cutoffs when zoom < 100% */}
        <img
          src={game.cover || "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800"}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-50 select-none pointer-events-none"
        />
        <img
          src={game.cover || "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800"}
          alt={game.name}
          style={{
            objectPosition: `${activePosX}% ${activePosY}%`,
            transformOrigin: `${activePosX}% ${activePosY}%`,
            transform: `scale(${Math.max(1, activeZoom / 100)})`,
            objectFit: "cover",
            transition: isAdjusting ? "none" : "transform 0.3s ease-out",
          }}
          className="w-full h-full object-cover select-none pointer-events-none relative z-10"
        />

        {!isAdjusting && (game.replayed || getDlcMode(game) !== "none") && (
          <div className="absolute top-1.5 left-1.5 z-20 flex flex-col gap-1">
            {game.replayed && (
              <div 
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-violet-950/90 text-purple-300 border border-purple-500/40 text-[9px] font-bold font-mono shadow"
                title={`Replay (${game.replayCount || 1}x)`}
              >
                <RotateCcw size={9} />
                <span>{(game.replayCount && game.replayCount > 0) ? game.replayCount : 1}x</span>
              </div>
            )}
            {getDlcMode(game) !== "none" && (
              <div 
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-950/90 text-amber-300 border border-amber-500/40 text-[9px] font-bold font-mono shadow"
                title={getDlcMode(game) === "plus_dlc" ? "Jogo Base + DLC" : "Expansão / DLC"}
              >
                <Layers size={9} />
                <span>{getDlcMode(game) === "plus_dlc" ? "+DLC" : "DLC"}</span>
              </div>
            )}
          </div>
        )}

        {game.trophy && game.trophy !== "none" && !isAdjusting && (
          <div className="absolute top-1.5 right-1.5 z-20">
            <TrophyBadge trophy={game.trophy} mode="card" />
          </div>
        )}

        {/* Reposition button */}
        {isAdmin && !isAdjusting && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTempPosX(posX);
              setTempPosY(posY);
              setTempZoom(zoom);
              setIsAdjusting(true);
            }}
            className="absolute bottom-1.5 right-1.5 z-20 w-6 h-6 flex items-center justify-center rounded-lg bg-zinc-950/85 hover:bg-cyan-500 hover:text-black text-zinc-300 border border-zinc-800 font-extrabold text-[11px] transition-all cursor-pointer shadow-md opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 duration-300"
            title="Ajustar Imagem da Capa"
          >
            ...
          </button>
        )}

        {/* Adjusting overlay - Clean & non-blocking */}
        {isAdjusting && (
          <div 
            className="absolute inset-0 bg-black/30 backdrop-blur-[0.5px] pointer-events-none flex flex-col justify-between p-2 z-30"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1 bg-black/80 px-1.5 py-0.5 rounded border border-cyan-500/20">
                <Shield size={9} />
                Ajuste
              </span>
              <span className="text-[8px] text-zinc-300 font-mono bg-black/80 px-1 py-0.5 rounded border border-zinc-800">
                Z:{tempZoom}% | X:{Math.round(tempPosX)}% | Y:{Math.round(tempPosY)}%
              </span>
            </div>

            <div className="text-[8px] text-zinc-200 font-extrabold text-center uppercase tracking-wider bg-black/85 py-1 px-1.5 rounded-lg border border-zinc-800 self-center animate-pulse">
              Arraste • Scroll
            </div>

            <div className="flex items-center gap-1 pointer-events-auto w-full">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAdjusting(false);
                }}
                className="flex-1 py-1 rounded bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white text-[8px] font-bold uppercase transition-colors cursor-pointer text-center"
                title="Cancelar"
              >
                Cancelar
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setTempPosX(50);
                  setTempPosY(50);
                  setTempZoom(100);
                }}
                className="p-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white text-[8px] transition-colors cursor-pointer text-center"
                title="Restaurar Padrão (100% / Centro)"
              >
                <RotateCcw size={10} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSavePosition();
                }}
                className="flex-1 py-1 rounded bg-cyan-500 text-black text-[8px] font-bold uppercase hover:bg-cyan-400 transition-colors cursor-pointer text-center shadow-sm"
              >
                Salvar
              </button>
            </div>
          </div>
        )}
      </div>

      <h4 className="text-xs font-bold text-white truncate group-hover:text-cyan-400 transition-colors">
        {game.name}
      </h4>
      <div className="mt-auto pt-1.5 border-t border-zinc-900/80 flex flex-col gap-1 text-[10px] font-mono">
        <div className="text-[9px] text-zinc-500 font-sans truncate">
          {formatDateDisplay(game.endDate || game.startDate) || "Zerado"}
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1 text-purple-300" title={`Tempo da Jogatina: ${game.playtime || "0h"}`}>
            <Clock size={10} className="text-purple-400 shrink-0" />
            <span className="truncate">{game.playtime || "0h"}</span>
          </div>
          <div className="flex items-center gap-1 text-cyan-300" title={`Tempo Extra: ${game.additionalPlaytime || "0h"}`}>
            <Clock size={10} className="text-cyan-400 shrink-0" />
            <span className="truncate">{game.additionalPlaytime || "0h"}</span>
          </div>
          <div className="flex items-center gap-1 text-emerald-300 font-bold" title={`Tempo Total: ${formatHoursAndMinutes(getTotalGamePlaytimeHours(game))}`}>
            <Clock size={10} className="text-emerald-400 shrink-0" />
            <span className="truncate">{formatHoursAndMinutes(getTotalGamePlaytimeHours(game))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  games,
  onSelectGame,
  onNavigateToLibraryWithStatus,
  onUpdateGame,
  isAdmin = true,
}) => {
  const [activeModal, setActiveModal] = useState<DetailModalData | null>(null);
  const [modalSearch, setModalSearch] = useState("");
  const [modalSort, setModalSort] = useState<"default" | "completion-desc" | "playtime-desc" | "rating-desc" | "metacritic-desc" | "hltb-desc" | "name-asc">("completion-desc");
  const [dailyPlayHours, setDailyPlayHours] = useState<number>(2);

  // Memoized Metrics Calculations
  const stats = useMemo(() => {
    const totalGames = games.length;
    if (totalGames === 0) {
      return {
        totalGames: 0,
        completedGames: 0,
        playingGames: 0,
        backlogGames: 0,
        pausedGames: 0,
        abandonedGames: 0,
        completionRate: 0,
        totalPlaytimeHours: 0,
        totalJogatinaHours: 0,
        totalExtraHours: 0,
        estimatedBacklogHours: 0,
        backlogMainHours: 0,
        backlogExtraHours: 0,
        backlogCompletionistHours: 0,
        platinumCount: 0,
        goldCount: 0,
        silverCount: 0,
        avgMetacritic: 0,
        metacriticRatedCount: 0,
        avgUserScoreConverted: 0,
        userRatedCount: 0,
        metacriticDistribution: { mustPlay: 0, great: 0, good: 0, mixed: 0 },
        platforms: [],
        genres: [],
        ratingDistribution: { fiveStars: 0, fourStars: 0, threeStars: 0, lowStars: 0, unrated: 0 },
        completionByYear: [],
        series: [],
        topPlaytimeGames: [],
        topMetacriticGames: [],
        topUserRatedGames: [],
        recentlyFinishedGames: [],
      };
    }

    let completedGames = 0;
    let playingGames = 0;
    let backlogGames = 0;
    let pausedGames = 0;
    let abandonedGames = 0;

    let totalPlaytimeHours = 0;
    let totalJogatinaHours = 0;
    let totalExtraHours = 0;

    let backlogMainHours = 0;
    let backlogExtraHours = 0;
    let backlogCompletionistHours = 0;

    let platinumCount = 0;
    let goldCount = 0;
    let silverCount = 0;

    let metacriticSum = 0;
    let metacriticRatedCount = 0;
    let userRatingSumConverted = 0;
    let userRatedCount = 0;

    const metacriticDistribution = { mustPlay: 0, great: 0, good: 0, mixed: 0 };
    const ratingDistribution = { fiveStars: 0, fourStars: 0, threeStars: 0, lowStars: 0, unrated: 0 };
    const platformMap: Record<string, { count: number; hours: number }> = {};
    const genreMap: Record<string, { count: number; hours: number }> = {};
    const yearMap: Record<string, { count: number; hours: number }> = {};
    const seriesMap: Record<string, number> = {};

    games.forEach((game) => {
      // Status counting
      const statusList = game.status || [];
      if (statusList.includes("Jogando")) {
        playingGames++;
      }
      if (statusList.includes("Pausado") || statusList.includes("Em Hiatus")) {
        pausedGames++;
      }
      if (statusList.includes("Zerado") || statusList.includes("Terminado")) {
        completedGames++;

        // Year extraction for completion timeline
        const dateStr = game.endDate || game.startDate;
        if (dateStr) {
          const match = dateStr.match(/(\d{4})/);
          if (match) {
            const y = match[1];
            if (!yearMap[y]) yearMap[y] = { count: 0, hours: 0 };
            yearMap[y].count++;
            yearMap[y].hours += getTotalGamePlaytimeHours(game);
          }
        }
      }
      if (statusList.includes("Backlog")) {
        backlogGames++;
      }
      if (statusList.includes("Abandonado") || statusList.includes("Desistido")) {
        abandonedGames++;
      }

      // Playtime calculation (sum of playtime + additionalPlaytime)
      const jogatinaH = parsePlaytimeHours(game.playtime);
      const extraH = parsePlaytimeHours(game.additionalPlaytime);
      const hours = jogatinaH + extraH;

      totalJogatinaHours += jogatinaH;
      totalExtraHours += extraH;
      totalPlaytimeHours += hours;

      // Backlog estimated hours calculation (only for games marked as Backlog)
      if (statusList.includes("Backlog")) {
        const hltbMainHours = parsePlaytimeHours(game.hltbMain);
        const hltbExtraHours = parsePlaytimeHours(game.hltbExtra);
        const hltbCompHours = parsePlaytimeHours(game.hltbCompletionist);

        const m = hltbMainHours || hltbExtraHours || 15;
        const e = hltbExtraHours || (hltbMainHours ? Math.round(hltbMainHours * 1.35) : 22);
        const c = hltbCompHours || (hltbExtraHours ? Math.round(hltbExtraHours * 1.5) : (hltbMainHours ? Math.round(hltbMainHours * 2.1) : 35));

        backlogMainHours += m;
        backlogExtraHours += e;
        backlogCompletionistHours += c;
      }

      // Trophies - count only the highest tier trophy per game
      const highestTrophy = getGameHighestTrophy(game);
      if (highestTrophy === "platinum") platinumCount++;
      else if (highestTrophy === "gold") goldCount++;
      else if (highestTrophy === "silver") silverCount++;

      // Metacritic & User Ratings
      if (typeof game.metacriticCritScore === "number" && game.metacriticCritScore > 0) {
        metacriticSum += game.metacriticCritScore;
        metacriticRatedCount++;
        const score = game.metacriticCritScore;
        if (score >= 90) metacriticDistribution.mustPlay++;
        else if (score >= 80) metacriticDistribution.great++;
        else if (score >= 70) metacriticDistribution.good++;
        else metacriticDistribution.mixed++;
      }

      if (typeof game.rating === "number" && game.rating > 0) {
        userRatingSumConverted += game.rating * 20;
        userRatedCount++;
        if (game.rating >= 5) ratingDistribution.fiveStars++;
        else if (game.rating >= 4) ratingDistribution.fourStars++;
        else if (game.rating >= 3) ratingDistribution.threeStars++;
        else ratingDistribution.lowStars++;
      } else {
        ratingDistribution.unrated++;
      }

      // Platform distribution
      const plat = game.platform || "Outras";
      if (!platformMap[plat]) platformMap[plat] = { count: 0, hours: 0 };
      platformMap[plat].count++;
      platformMap[plat].hours += hours;

      // Genre distribution
      const rawGenres = Array.isArray(game.genre) ? game.genre : splitEntities(game.genre);
      const activeGenres = rawGenres.length > 0 ? rawGenres : ["Outros"];
      activeGenres.forEach((g) => {
        const cleanG = g.trim();
        if (cleanG) {
          if (!genreMap[cleanG]) genreMap[cleanG] = { count: 0, hours: 0 };
          genreMap[cleanG].count++;
          genreMap[cleanG].hours += hours;
        }
      });

      // Series distribution
      if (game.series && game.series !== "Série autónoma") {
        seriesMap[game.series] = (seriesMap[game.series] || 0) + 1;
      }
    });

    const completionRate = Math.round((completedGames / totalGames) * 100);
    const avgMetacritic = metacriticRatedCount > 0 ? Math.round(metacriticSum / metacriticRatedCount) : 0;
    const avgUserScoreConverted = userRatedCount > 0 ? Math.round(userRatingSumConverted / userRatedCount) : 0;

    // Platform array sorted
    const platforms = Object.entries(platformMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);

    // Genre array sorted
    const genres = Object.entries(genreMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);

    // Completion by year array sorted descending
    const completionByYear = Object.entries(yearMap)
      .map(([year, data]) => ({ year, ...data }))
      .sort((a, b) => b.year.localeCompare(a.year));

    // Series array sorted
    const series = Object.entries(seriesMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Top Playtime Games
    const topPlaytimeGames = [...games]
      .map((g) => ({ game: g, hours: getTotalGamePlaytimeHours(g) }))
      .filter((item) => item.hours > 0)
      .sort((a, b) => b.hours - a.hours);

    // Top Metacritic Games
    const topMetacriticGames = [...games]
      .filter((g) => typeof g.metacriticCritScore === "number" && g.metacriticCritScore > 0)
      .sort((a, b) => (b.metacriticCritScore || 0) - (a.metacriticCritScore || 0));

    // Top User Rated Games
    const topUserRatedGames = [...games]
      .filter((g) => typeof g.rating === "number" && g.rating > 0)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));

    // Recently Finished Games (sorted by endDate or releaseDate)
    const recentlyFinishedGames = [...games]
      .filter((g) => (g.status || []).includes("Zerado") || (g.status || []).includes("Terminado"))
      .sort((a, b) => {
        const dateA = a.endDate || a.startDate || "1970-01-01";
        const dateB = b.endDate || b.startDate || "1970-01-01";
        return dateB.localeCompare(dateA);
      })
      .slice(0, 6);

    return {
      totalGames,
      completedGames,
      playingGames,
      backlogGames,
      pausedGames,
      abandonedGames,
      completionRate,
      totalPlaytimeHours,
      totalJogatinaHours,
      totalExtraHours,
      estimatedBacklogHours: backlogMainHours,
      backlogMainHours,
      backlogExtraHours,
      backlogCompletionistHours,
      platinumCount,
      goldCount,
      silverCount,
      avgMetacritic,
      metacriticRatedCount,
      avgUserScoreConverted,
      userRatedCount,
      metacriticDistribution,
      platforms,
      genres,
      ratingDistribution,
      completionByYear,
      series,
      topPlaytimeGames,
      topMetacriticGames,
      topUserRatedGames,
      recentlyFinishedGames,
    };
  }, [games]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner for Statistics */}
      <div className="bg-gradient-to-r from-zinc-950 via-purple-950/40 to-zinc-950 border border-purple-500/20 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase tracking-widest mb-3">
              <TrendingUp size={14} className="text-cyan-400" />
              <span>Relatório do Jogador & Analytics</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-orbitron text-white tracking-wide">
              Análise Geral da Coleção
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl">
              Acompanhe seu ritmo de jogo, taxas de conclusão, métricas do HowLongToBeat e comparação entre Metacritic e sua nota convertida.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start md:self-auto shrink-0">
            {/* Metascore Média */}
            <div 
              onClick={() => {
                setActiveModal({
                  title: "Análise de Pontuação Metascore",
                  subtitle: `Média Geral: ${stats.avgMetacritic} / 100 Metascore`,
                  explanation: "Calculada a partir dos ratings de crítica profissional nos jogos cadastrados que possuem Metascore oficial.",
                  icon: <Star className="text-amber-400" size={20} />,
                  gamesList: games.filter(g => typeof g.metacriticCritScore === "number" && g.metacriticCritScore > 0).sort((a,b) => (b.metacriticCritScore||0) - (a.metacriticCritScore||0)),
                  metricType: "metacritic",
                });
              }}
              className="bg-zinc-900/90 border border-zinc-800 hover:border-amber-500/40 px-4 py-2.5 rounded-2xl flex items-center gap-3 cursor-pointer transition-all shadow-md group"
            >
              <Sparkles className="text-amber-400 group-hover:scale-110 transition-transform" size={18} />
              <div>
                <span className="block text-[9px] text-zinc-400 font-extrabold uppercase tracking-widest">
                  Metascore Média
                </span>
                <span className="text-base font-black font-mono text-amber-400">
                  {stats.avgMetacritic > 0 ? `${stats.avgMetacritic} / 100` : "N/D"}
                </span>
              </div>
            </div>

            {/* Sua Nota Média (Convertida 0-100) */}
            <div 
              onClick={() => {
                setActiveModal({
                  title: "Sua Nota Média Convertida (0 a 100)",
                  subtitle: `Média Pessoal: ${stats.avgUserScoreConverted} / 100`,
                  explanation: "Sua avaliação em estrelas (0 a 5) convertida matematicamente para a escala 0 a 100 (ex: 4.5 estrelas = 90). Usado exclusivamente nas estatísticas para facilitar comparação.",
                  icon: <Award className="text-cyan-400" size={20} />,
                  gamesList: games.filter(g => typeof g.rating === "number" && g.rating > 0).sort((a,b) => (b.rating||0) - (a.rating||0)),
                  metricType: "user_rating",
                });
              }}
              className="bg-zinc-900/90 border border-zinc-800 hover:border-cyan-500/40 px-4 py-2.5 rounded-2xl flex items-center gap-3 cursor-pointer transition-all shadow-md group"
            >
              <Award className="text-cyan-400 group-hover:scale-110 transition-transform" size={18} />
              <div>
                <span className="block text-[9px] text-zinc-400 font-extrabold uppercase tracking-widest">
                  Sua Nota Média
                </span>
                <span className="text-base font-black font-mono text-cyan-400">
                  {stats.avgUserScoreConverted > 0 ? `${stats.avgUserScoreConverted} / 100` : "N/D"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Games */}
        <div 
          onClick={() => {
            setActiveModal({
              title: "Biblioteca Total do Acervo",
              subtitle: `${stats.totalGames} jogos cadastrados`,
              explanation: "Todos os títulos atualmente presentes na sua biblioteca de jogos.",
              icon: <Gamepad2 className="text-cyan-400" size={20} />,
              gamesList: games,
              metricType: "general",
            });
          }}
          className="bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 hover:border-cyan-500/40 rounded-2xl p-4 transition-all group cursor-pointer shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 group-hover:text-cyan-400 transition-colors">
              Biblioteca Total
            </span>
            <div className="p-2 rounded-xl bg-cyan-950/50 text-cyan-400 border border-cyan-500/20">
              <Gamepad2 size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-orbitron text-white">
            {stats.totalGames}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Clique para ver lista detalhada ➔</p>
        </div>

        {/* Total Playtime */}
        <div 
          onClick={() => {
            setActiveModal({
              title: "Tempo Investido",
              subtitle: `Total de ${formatHoursAndMinutes(stats.totalPlaytimeHours)} investidas no seu acervo`,
              explanation: "Estatística dividida em 3 partes: Tempo da Jogatina (campanhas e jogatinas ativas), Tempo Extra (atividades secundárias e adicionais) e o Tempo Total (somatório de tudo).",
              icon: <Clock className="text-purple-400" size={20} />,
              gamesList: games.filter(g => getTotalGamePlaytimeHours(g) > 0).sort((a,b) => getTotalGamePlaytimeHours(b) - getTotalGamePlaytimeHours(a)),
              metricType: "playtime",
            });
          }}
          className="bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 hover:border-purple-500/40 rounded-2xl p-4 transition-all group cursor-pointer shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 group-hover:text-purple-400 transition-colors">
              Tempo Investido (Total)
            </span>
            <div className="p-2 rounded-xl bg-purple-950/50 text-purple-400 border border-purple-500/20">
              <Clock size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-orbitron text-white">
            {formatHoursAndMinutes(stats.totalPlaytimeHours)}
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
            <span title="Tempo de Jogatina (Campanha/Ativa)">🎮 Jogatina: <strong className="text-purple-300 font-bold">{formatHoursAndMinutes(stats.totalJogatinaHours)}</strong></span>
            <span title="Tempo Extra (Outras Jogatinas)">➕ Extra: <strong className="text-cyan-300 font-bold">{formatHoursAndMinutes(stats.totalExtraHours)}</strong></span>
          </div>
        </div>

        {/* Completion Rate */}
        <div 
          onClick={() => {
            setActiveModal({
              title: "Jogos Zerados & Finalizados",
              subtitle: `${stats.completedGames} jogos concluidos (${stats.completionRate}% do acervo)`,
              explanation: "Jogos marcados com o status 'Zerado' ou 'Terminado'.",
              icon: <CheckCircle2 className="text-cyan-400" size={20} />,
              gamesList: games.filter(g => (g.status || []).includes("Zerado") || (g.status || []).includes("Terminado")),
              metricType: "status",
            });
          }}
          className="bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 hover:border-cyan-500/40 rounded-2xl p-4 transition-all group cursor-pointer shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 group-hover:text-cyan-400 transition-colors">
              Taxa de Conclusão
            </span>
            <div className="p-2 rounded-xl bg-cyan-950/50 text-cyan-400 border border-cyan-500/20">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-orbitron text-cyan-400 flex items-baseline gap-1">
            <span>{stats.completionRate}%</span>
            <span className="text-xs text-zinc-400 font-sans">({stats.completedGames})</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Jogos finalizados ➔</p>
        </div>

        {/* Platinum Trophies */}
        <div 
          onClick={() => {
            setActiveModal({
              title: "Galeria de Platinas (100%)",
              subtitle: `${stats.platinumCount} platinas obtidas`,
              explanation: "Jogos marcados com o troféu máximo de Platina Brilhante na sua biblioteca.",
              icon: <Trophy className="text-slate-100" size={20} />,
              gamesList: games.filter(g => g.trophy === "platinum"),
              metricType: "trophies",
            });
          }}
          className="bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 hover:border-slate-400/40 rounded-2xl p-4 transition-all group cursor-pointer shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 group-hover:text-slate-200 transition-colors">
              Platinas Brilhantes
            </span>
            <div className="p-2 rounded-xl bg-slate-900 text-slate-100 border border-slate-300/40 shadow-sm">
              <Trophy size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-orbitron text-slate-100 flex items-baseline gap-1">
            <span>{stats.platinumCount}</span>
            <span className="text-xs text-zinc-500 font-sans">/ {stats.completedGames}</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Conquistas 100% ➔</p>
        </div>

        {/* Backlog Estimate */}
        <div 
          onClick={() => {
            setActiveModal({
              title: "Estimativa de Fila Backlog (HLTB)",
              subtitle: `~${formatHoursAndMinutes(stats.estimatedBacklogHours)} estimados para concluir`,
              explanation: "Tempo estimado baseado no tempo médio principal/extra fornecido pelo HowLongToBeat apenas para os jogos sinalizados com o status 'Backlog'.",
              icon: <Flame className="text-amber-400" size={20} />,
              gamesList: games.filter(g => (g.status||[]).includes("Backlog")),
              metricType: "hltb_backlog",
            });
          }}
          className="bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 hover:border-amber-500/40 rounded-2xl p-4 transition-all group cursor-pointer shadow-lg col-span-2 sm:col-span-1"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 group-hover:text-amber-400 transition-colors">
              Fila Backlog HLTB
            </span>
            <div className="p-2 rounded-xl bg-amber-950/50 text-amber-400 border border-amber-500/20">
              <Flame size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-orbitron text-amber-400">
            ~{formatHoursAndMinutes(stats.estimatedBacklogHours)}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            {stats.backlogGames} jogos aguardando ➔
          </p>
        </div>
      </div>

      {/* Main Section: Status Distribution & Trophies */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution Progress Bar */}
        <div className="lg:col-span-2 bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="text-cyan-400" size={18} />
              <h3 className="text-base font-bold text-white uppercase font-orbitron tracking-wide">
                Progresso & Status da Coleção
              </h3>
            </div>
            <span className="text-xs text-zinc-400 font-mono">
              {stats.completedGames} de {stats.totalGames} zerados
            </span>
          </div>

          {/* Multi-segmented Progress Bar in Correct Requested Order */}
          {/* Order: 1. Jogando (Verde), 2. Em Hiatus (Laranja), 3. Terminado (Azul), 4. Backlog (Cinza), 5. Desistido (Vermelho) */}
          <div className="space-y-2">
            <div className="h-4 w-full bg-zinc-950 rounded-full overflow-hidden flex p-0.5 border border-zinc-800">
              {stats.playingGames > 0 && (
                <div
                  style={{ width: `${(stats.playingGames / stats.totalGames) * 100}%` }}
                  className="bg-emerald-500 h-full rounded-l-full transition-all"
                  title={`Jogando: ${stats.playingGames}`}
                />
              )}
              {stats.pausedGames > 0 && (
                <div
                  style={{ width: `${(stats.pausedGames / stats.totalGames) * 100}%` }}
                  className="bg-orange-500 h-full transition-all"
                  title={`Em Hiatus / Pausados: ${stats.pausedGames}`}
                />
              )}
              {stats.completedGames > 0 && (
                <div
                  style={{ width: `${(stats.completedGames / stats.totalGames) * 100}%` }}
                  className="bg-blue-500 h-full transition-all"
                  title={`Zerados / Terminados: ${stats.completedGames}`}
                />
              )}
              {stats.backlogGames > 0 && (
                <div
                  style={{ width: `${(stats.backlogGames / stats.totalGames) * 100}%` }}
                  className="bg-zinc-500 h-full transition-all"
                  title={`Backlog / Na Fila: ${stats.backlogGames}`}
                />
              )}
              {stats.abandonedGames > 0 && (
                <div
                  style={{ width: `${(stats.abandonedGames / stats.totalGames) * 100}%` }}
                  className="bg-red-500 h-full rounded-r-full transition-all"
                  title={`Desistidos / Abandonados: ${stats.abandonedGames}`}
                />
              )}
            </div>
          </div>

          {/* Detailed Status Pills in Correct Requested Order */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
            {/* 1. JOGANDO (VERDE) */}
            <button
              onClick={() => {
                setActiveModal({
                  title: "Jogos em Andamento (Jogando)",
                  subtitle: `${stats.playingGames} títulos ativos`,
                  explanation: "Jogos em andamento que você está ativamente jogando.",
                  icon: <Gamepad2 className="text-emerald-400" size={20} />,
                  gamesList: games.filter(g => (g.status || []).includes("Jogando")),
                  metricType: "status",
                });
              }}
              className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800/80 hover:border-emerald-500/50 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold uppercase text-zinc-400 group-hover:text-emerald-400">Jogando</span>
              </div>
              <div className="text-lg font-black text-emerald-400 font-mono">{stats.playingGames}</div>
            </button>

            {/* 2. EM HIATUS (LARANJA) */}
            <button
              onClick={() => {
                setActiveModal({
                  title: "Jogos Em Hiatus / Pausados",
                  subtitle: `${stats.pausedGames} pausados temporariamente`,
                  explanation: "Jogos pausados que você pretende retomar no futuro.",
                  icon: <Clock className="text-orange-400" size={20} />,
                  gamesList: games.filter(g => (g.status || []).includes("Pausado") || (g.status || []).includes("Em Hiatus")),
                  metricType: "status",
                });
              }}
              className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800/80 hover:border-orange-500/50 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="text-[10px] font-bold uppercase text-zinc-400 group-hover:text-orange-400">Em Hiatus</span>
              </div>
              <div className="text-lg font-black text-orange-400 font-mono">{stats.pausedGames}</div>
            </button>

            {/* 3. TERMINADO (AZUL) */}
            <button
              onClick={() => {
                setActiveModal({
                  title: "Jogos Concluídos (Terminado)",
                  subtitle: `${stats.completedGames} finalizados`,
                  explanation: "Jogos finalizados ou zerados com sucesso na sua história.",
                  icon: <CheckCircle2 className="text-blue-400" size={20} />,
                  gamesList: games.filter(g => (g.status || []).includes("Zerado") || (g.status || []).includes("Terminado")),
                  metricType: "status",
                });
              }}
              className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800/80 hover:border-blue-500/50 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[10px] font-bold uppercase text-zinc-400 group-hover:text-blue-400">Terminado</span>
              </div>
              <div className="text-lg font-black text-blue-400 font-mono">{stats.completedGames}</div>
            </button>

            {/* 4. BACKLOG (CINZA) */}
            <button
              onClick={() => {
                setActiveModal({
                  title: "Lista de Espera (Backlog)",
                  subtitle: `${stats.backlogGames} jogos no backlog`,
                  explanation: "Jogos marcados com o status 'Backlog' aguardando para serem jogados.",
                  icon: <Flame className="text-zinc-400" size={20} />,
                  gamesList: games.filter(g => (g.status || []).includes("Backlog")),
                  metricType: "status",
                });
              }}
              className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800/80 hover:border-zinc-500/50 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-zinc-500" />
                <span className="text-[10px] font-bold uppercase text-zinc-400 group-hover:text-zinc-300">Backlog</span>
              </div>
              <div className="text-lg font-black text-zinc-300 font-mono">{stats.backlogGames}</div>
            </button>

            {/* 5. DESISTIDO (VERMELHO) */}
            <button
              onClick={() => {
                setActiveModal({
                  title: "Jogos Desistidos / Abandonados",
                  subtitle: `${stats.abandonedGames} interrompidos`,
                  explanation: "Jogos interrompidos ou desistidos sem previsão de retorno.",
                  icon: <X className="text-red-400" size={20} />,
                  gamesList: games.filter(g => (g.status || []).includes("Abandonado") || (g.status || []).includes("Desistido")),
                  metricType: "status",
                });
              }}
              className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800/80 hover:border-red-500/50 text-left transition-all cursor-pointer group col-span-2 sm:col-span-1"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-[10px] font-bold uppercase text-zinc-400 group-hover:text-red-400">Desistido</span>
              </div>
              <div className="text-lg font-black text-red-400 font-mono">{stats.abandonedGames}</div>
            </button>
          </div>
        </div>

        {/* Trophies Breakdown */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex items-center gap-2">
            <Trophy className="text-amber-400" size={18} />
            <h3 className="text-base font-bold text-white uppercase font-orbitron tracking-wide">
              Sala de Troféus
            </h3>
          </div>

          <div className="space-y-3 my-auto">
            <div 
              onClick={() => {
                setActiveModal({
                  title: "Jogos com Troféu de Platina",
                  subtitle: `${stats.platinumCount} platinas`,
                  explanation: "Conquista máxima de 100% de conclusão nos seus títulos zerados.",
                  icon: <Trophy className="text-slate-100" size={20} />,
                  gamesList: games.filter(g => g.trophy === "platinum"),
                  metricType: "trophies",
                });
              }}
              className="p-3 rounded-2xl bg-slate-950/80 border border-slate-300/40 hover:border-slate-300/80 flex items-center justify-between cursor-pointer transition-all"
            >
              <div className="flex items-center gap-2.5">
                <TrophyBadge trophy="platinum" mode="detail" />
              </div>
              <span className="text-lg font-black text-white font-mono">{stats.platinumCount}</span>
            </div>

            <div 
              onClick={() => {
                setActiveModal({
                  title: "Jogos com Troféu de Ouro",
                  subtitle: `${stats.goldCount} conquistas de Ouro`,
                  explanation: "Títulos onde você alcançou o selo de Ouro.",
                  icon: <Trophy className="text-amber-400" size={20} />,
                  gamesList: games.filter(g => g.trophy === "gold"),
                  metricType: "trophies",
                });
              }}
              className="p-3 rounded-2xl bg-amber-950/20 border border-amber-500/30 hover:border-amber-500/60 flex items-center justify-between cursor-pointer transition-all"
            >
              <div className="flex items-center gap-2.5">
                <TrophyBadge trophy="gold" mode="detail" />
              </div>
              <span className="text-lg font-black text-amber-400 font-mono">{stats.goldCount}</span>
            </div>

            <div 
              onClick={() => {
                setActiveModal({
                  title: "Jogos com Troféu de Prata",
                  subtitle: `${stats.silverCount} conquistas de Prata`,
                  explanation: "Títulos onde você alcançou o selo de Prata.",
                  icon: <Trophy className="text-zinc-400" size={20} />,
                  gamesList: games.filter(g => g.trophy === "silver"),
                  metricType: "trophies",
                });
              }}
              className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-500/30 hover:border-zinc-500/60 flex items-center justify-between cursor-pointer transition-all"
            >
              <div className="flex items-center gap-2.5">
                <TrophyBadge trophy="silver" mode="detail" />
              </div>
              <span className="text-lg font-black text-zinc-300 font-mono">{stats.silverCount}</span>
            </div>
          </div>

          <p className="text-[10px] text-zinc-500 text-center">
            {stats.platinumCount > 0 
              ? `🏆 ${stats.platinumCount} jogos receberam o selo máximo de Platina Brilhante!` 
              : "Defina troféus ao editar as fichas dos seus jogos zerados."}
          </p>
        </div>
      </div>

      {/* Metacritic Analysis & User Rating Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Metacritic Ratings breakdown */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="text-amber-400" size={18} />
              <h3 className="text-base font-bold text-white uppercase font-orbitron tracking-wide">
                Qualidade Metacritic
              </h3>
            </div>
            <span className="text-xs text-amber-400 font-bold bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-800/30">
              {stats.metacriticRatedCount} Jogos Avaliados
            </span>
          </div>

          <div className="space-y-3">
            {/* Must-Play (90+) */}
            <div 
              onClick={() => {
                setActiveModal({
                  title: "Jogos Must-Play (Metascore 90+)",
                  subtitle: `${stats.metacriticDistribution.mustPlay} títulos excepcionais`,
                  explanation: "Os jogos mais aclamados da história com nota igual ou superior a 90.",
                  icon: <Star className="text-emerald-400" size={20} />,
                  gamesList: games.filter(g => typeof g.metacriticCritScore === "number" && g.metacriticCritScore >= 90),
                  metricType: "metacritic",
                });
              }}
              className="cursor-pointer group"
            >
              <div className="flex justify-between text-xs mb-1 font-semibold">
                <span className="text-emerald-400 flex items-center gap-1 group-hover:underline">
                  <span>Must-Play (90 - 100)</span>
                </span>
                <span className="text-zinc-300 font-mono">{stats.metacriticDistribution.mustPlay} jogos</span>
              </div>
              <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                <div
                  style={{ width: `${stats.metacriticRatedCount > 0 ? (stats.metacriticDistribution.mustPlay / stats.metacriticRatedCount) * 100 : 0}%` }}
                  className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all"
                />
              </div>
            </div>

            {/* Great (80-89) */}
            <div 
              onClick={() => {
                setActiveModal({
                  title: "Jogos Aclamados (Metascore 80-89)",
                  subtitle: `${stats.metacriticDistribution.great} títulos aclamados`,
                  explanation: "Jogos com análises muito favoráveis no Metacritic.",
                  icon: <Star className="text-cyan-400" size={20} />,
                  gamesList: games.filter(g => typeof g.metacriticCritScore === "number" && g.metacriticCritScore >= 80 && g.metacriticCritScore < 90),
                  metricType: "metacritic",
                });
              }}
              className="cursor-pointer group"
            >
              <div className="flex justify-between text-xs mb-1 font-semibold">
                <span className="text-cyan-400 group-hover:underline">Aclamados (80 - 89)</span>
                <span className="text-zinc-300 font-mono">{stats.metacriticDistribution.great} jogos</span>
              </div>
              <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                <div
                  style={{ width: `${stats.metacriticRatedCount > 0 ? (stats.metacriticDistribution.great / stats.metacriticRatedCount) * 100 : 0}%` }}
                  className="h-full bg-cyan-500 rounded-full transition-all"
                />
              </div>
            </div>

            {/* Good (70-79) */}
            <div 
              onClick={() => {
                setActiveModal({
                  title: "Jogos Favoráveis (Metascore 70-79)",
                  subtitle: `${stats.metacriticDistribution.good} títulos favoráveis`,
                  explanation: "Jogos com boas avaliações gerais.",
                  icon: <Star className="text-amber-400" size={20} />,
                  gamesList: games.filter(g => typeof g.metacriticCritScore === "number" && g.metacriticCritScore >= 70 && g.metacriticCritScore < 80),
                  metricType: "metacritic",
                });
              }}
              className="cursor-pointer group"
            >
              <div className="flex justify-between text-xs mb-1 font-semibold">
                <span className="text-amber-400 group-hover:underline">Favoráveis (70 - 79)</span>
                <span className="text-zinc-300 font-mono">{stats.metacriticDistribution.good} jogos</span>
              </div>
              <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                <div
                  style={{ width: `${stats.metacriticRatedCount > 0 ? (stats.metacriticDistribution.good / stats.metacriticRatedCount) * 100 : 0}%` }}
                  className="h-full bg-amber-500 rounded-full transition-all"
                />
              </div>
            </div>

            {/* Mixed (<70) */}
            <div 
              onClick={() => {
                setActiveModal({
                  title: "Jogos Mistos / Regulares (Metascore < 70)",
                  subtitle: `${stats.metacriticDistribution.mixed} títulos`,
                  explanation: "Jogos com notas mistas ou inferiores a 70.",
                  icon: <Star className="text-zinc-400" size={20} />,
                  gamesList: games.filter(g => typeof g.metacriticCritScore === "number" && g.metacriticCritScore < 70 && g.metacriticCritScore > 0),
                  metricType: "metacritic",
                });
              }}
              className="cursor-pointer group"
            >
              <div className="flex justify-between text-xs mb-1 font-semibold">
                <span className="text-zinc-400 group-hover:underline">Misto / Regular (&lt;70)</span>
                <span className="text-zinc-300 font-mono">{stats.metacriticDistribution.mixed} jogos</span>
              </div>
              <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                <div
                  style={{ width: `${stats.metacriticRatedCount > 0 ? (stats.metacriticDistribution.mixed / stats.metacriticRatedCount) * 100 : 0}%` }}
                  className="h-full bg-zinc-600 rounded-full transition-all"
                />
              </div>
            </div>
          </div>

          {/* Top Metacritic Games List with Metascore + Sua Nota */}
          {stats.topMetacriticGames.length > 0 && (
            <div className="pt-3 border-t border-zinc-800">
              <h4 className="text-xs font-bold uppercase text-zinc-400 tracking-wider mb-2.5">
                Metascore vs Sua Nota ({stats.topMetacriticGames.length} jogos)
              </h4>
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
                {stats.topMetacriticGames.map((game) => (
                  <div
                    key={game.id}
                    onClick={() => onSelectGame && onSelectGame(game.id)}
                    className="flex items-center justify-between p-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-10 rounded-lg overflow-hidden shrink-0 bg-zinc-900">
                        <img
                          src={game.cover}
                          alt={game.name}
                          style={{
                            objectPosition: `${game.coverPositionX ?? 50}% ${game.coverPosition ?? 50}%`,
                            transform: `scale(${(game.coverZoom ?? 100) / 100})`,
                          }}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-xs font-bold text-white truncate group-hover:text-cyan-400 transition-colors">
                        {game.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Metascore Badge */}
                      <span 
                        className="px-2 py-1 bg-amber-500/20 text-amber-400 font-black font-mono text-[11px] rounded-lg border border-amber-500/30"
                        title="Nota Metacritic (Crítica)"
                      >
                        Meta: {game.metacriticCritScore}
                      </span>

                      {/* Converted User Score Badge (Distinct Color: Cyan) */}
                      <span 
                        className="px-2 py-1 bg-cyan-500/20 text-cyan-300 font-black font-mono text-[11px] rounded-lg border border-cyan-500/30"
                        title="Sua Nota Convertida (0 a 100)"
                      >
                        Sua: {game.rating && game.rating > 0 ? convertUserRatingTo100(game.rating) : "--"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sua Avaliação Pessoal (Estrelas) */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="text-cyan-400" size={18} />
              <h3 className="text-base font-bold text-white uppercase font-orbitron tracking-wide">
                Sua Avaliação Pessoal
              </h3>
            </div>
            <span className="text-xs text-cyan-400 font-bold bg-cyan-950/40 px-2.5 py-1 rounded-full border border-cyan-800/30 font-mono">
              Média: {stats.avgUserScoreConverted}/100
            </span>
          </div>

          <div className="space-y-3">
            {/* 5 Stars */}
            <div 
              onClick={() => {
                setModalSearch("");
                setActiveModal({
                  title: "Jogos 5 Estrelas (Nota 5.0)",
                  subtitle: `${stats.ratingDistribution.fiveStars} jogos perfeitos`,
                  explanation: "Jogos que receberam sua pontuação máxima de 5 estrelas.",
                  icon: <Star className="text-amber-400" size={20} />,
                  gamesList: games.filter(g => typeof g.rating === "number" && g.rating >= 5),
                  metricType: "user_rating",
                });
              }}
              className="cursor-pointer group"
            >
              <div className="flex justify-between text-xs mb-1 font-semibold">
                <span className="text-amber-400 group-hover:underline flex items-center gap-1">
                  ★★★★★ (5.0 Estrelas - Perfeito)
                </span>
                <span className="text-zinc-300 font-mono">{stats.ratingDistribution.fiveStars} jogos</span>
              </div>
              <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                <div
                  style={{ width: `${stats.userRatedCount > 0 ? (stats.ratingDistribution.fiveStars / stats.userRatedCount) * 100 : 0}%` }}
                  className="h-full bg-amber-400 rounded-full transition-all"
                />
              </div>
            </div>

            {/* 4.0 - 4.5 Stars */}
            <div 
              onClick={() => {
                setModalSearch("");
                setActiveModal({
                  title: "Jogos 4.0 a 4.5 Estrelas",
                  subtitle: `${stats.ratingDistribution.fourStars} jogos excelentes`,
                  explanation: "Títulos avaliados entre 4.0 e 4.5 estrelas.",
                  icon: <Star className="text-cyan-400" size={20} />,
                  gamesList: games.filter(g => typeof g.rating === "number" && g.rating >= 4 && g.rating < 5),
                  metricType: "user_rating",
                });
              }}
              className="cursor-pointer group"
            >
              <div className="flex justify-between text-xs mb-1 font-semibold">
                <span className="text-cyan-400 group-hover:underline flex items-center gap-1">
                  ★★★★☆ (4.0 - 4.5 Estrelas - Excelente)
                </span>
                <span className="text-zinc-300 font-mono">{stats.ratingDistribution.fourStars} jogos</span>
              </div>
              <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                <div
                  style={{ width: `${stats.userRatedCount > 0 ? (stats.ratingDistribution.fourStars / stats.userRatedCount) * 100 : 0}%` }}
                  className="h-full bg-cyan-400 rounded-full transition-all"
                />
              </div>
            </div>

            {/* 3.0 - 3.5 Stars */}
            <div 
              onClick={() => {
                setModalSearch("");
                setActiveModal({
                  title: "Jogos 3.0 a 3.5 Estrelas",
                  subtitle: `${stats.ratingDistribution.threeStars} jogos bons`,
                  explanation: "Títulos avaliados entre 3.0 e 3.5 estrelas.",
                  icon: <Star className="text-purple-400" size={20} />,
                  gamesList: games.filter(g => typeof g.rating === "number" && g.rating >= 3 && g.rating < 4),
                  metricType: "user_rating",
                });
              }}
              className="cursor-pointer group"
            >
              <div className="flex justify-between text-xs mb-1 font-semibold">
                <span className="text-purple-400 group-hover:underline flex items-center gap-1">
                  ★★★☆☆ (3.0 - 3.5 Estrelas - Bom)
                </span>
                <span className="text-zinc-300 font-mono">{stats.ratingDistribution.threeStars} jogos</span>
              </div>
              <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                <div
                  style={{ width: `${stats.userRatedCount > 0 ? (stats.ratingDistribution.threeStars / stats.userRatedCount) * 100 : 0}%` }}
                  className="h-full bg-purple-400 rounded-full transition-all"
                />
              </div>
            </div>

            {/* Low Stars */}
            <div 
              onClick={() => {
                setModalSearch("");
                setActiveModal({
                  title: "Jogos Abaixo de 3 Estrelas",
                  subtitle: `${stats.ratingDistribution.lowStars} jogos fracos/regulares`,
                  explanation: "Títulos com notas iguais ou inferiores a 2.5 estrelas.",
                  icon: <Star className="text-zinc-400" size={20} />,
                  gamesList: games.filter(g => typeof g.rating === "number" && g.rating > 0 && g.rating < 3),
                  metricType: "user_rating",
                });
              }}
              className="cursor-pointer group"
            >
              <div className="flex justify-between text-xs mb-1 font-semibold">
                <span className="text-zinc-400 group-hover:underline flex items-center gap-1">
                  ★★☆☆☆ (&lt; 3.0 Estrelas - Regular)
                </span>
                <span className="text-zinc-300 font-mono">{stats.ratingDistribution.lowStars} jogos</span>
              </div>
              <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                <div
                  style={{ width: `${stats.userRatedCount > 0 ? (stats.ratingDistribution.lowStars / stats.userRatedCount) * 100 : 0}%` }}
                  className="h-full bg-zinc-500 rounded-full transition-all"
                />
              </div>
            </div>
          </div>

          {/* Top User Rated Games List with Sua Nota + Metascore */}
          {stats.topUserRatedGames.length > 0 && (
            <div className="pt-3 border-t border-zinc-800">
              <h4 className="text-xs font-bold uppercase text-zinc-400 tracking-wider mb-2.5">
                Seus Jogos Avaliados vs Metascore ({stats.topUserRatedGames.length} jogos)
              </h4>
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
                {stats.topUserRatedGames.map((game) => (
                  <div
                    key={game.id}
                    onClick={() => onSelectGame && onSelectGame(game.id)}
                    className="flex items-center justify-between p-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-10 rounded-lg overflow-hidden shrink-0 bg-zinc-900">
                        <img
                          src={game.cover}
                          alt={game.name}
                          style={{
                            objectPosition: `${game.coverPositionX ?? 50}% ${game.coverPosition ?? 50}%`,
                            transform: `scale(${(game.coverZoom ?? 100) / 100})`,
                          }}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-xs font-bold text-white truncate group-hover:text-cyan-400 transition-colors">
                        {game.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Converted User Score Badge */}
                      <span 
                        className="px-2 py-1 bg-cyan-500/20 text-cyan-300 font-black font-mono text-[11px] rounded-lg border border-cyan-500/30"
                        title="Sua Nota Convertida (0 a 100)"
                      >
                        Sua: {game.rating ? convertUserRatingTo100(game.rating) : "--"}
                      </span>

                      {/* Metascore Badge */}
                      <span 
                        className="px-2 py-1 bg-amber-500/20 text-amber-400 font-black font-mono text-[11px] rounded-lg border border-amber-500/30"
                        title="Nota Metacritic (Crítica)"
                      >
                        Meta: {typeof game.metacriticCritScore === "number" && game.metacriticCritScore > 0 ? game.metacriticCritScore : "--"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Platform & Genre Breakdown Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Platform Breakdown */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gamepad2 className="text-purple-400" size={18} />
                <h3 className="text-base font-bold text-white uppercase font-orbitron tracking-wide">
                  Distribuição por Plataformas
                </h3>
              </div>
              <span className="text-xs text-purple-400 font-bold bg-purple-950/40 px-2.5 py-1 rounded-full border border-purple-800/30">
                {stats.platforms.length} Plataformas
              </span>
            </div>

            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
              {stats.platforms.map((plat) => {
                const pct = stats.totalGames > 0 ? Math.round((plat.count / stats.totalGames) * 100) : 0;
                return (
                  <div 
                    key={plat.name} 
                    onClick={() => {
                      setModalSearch("");
                      setActiveModal({
                        title: `Jogos na Plataforma: ${plat.name}`,
                        subtitle: `${plat.count} jogos (${pct}% do acervo)`,
                        explanation: `Todos os títulos registrados na plataforma ${plat.name}.`,
                        icon: <Gamepad2 className="text-purple-400" size={20} />,
                        gamesList: games.filter(g => (g.platform || "Outras") === plat.name),
                      });
                    }}
                    className="space-y-1 cursor-pointer group"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-white group-hover:text-purple-300 transition-colors">{plat.name}</span>
                      <div className="flex items-center gap-2 text-zinc-400 font-mono text-[11px]">
                        <span>{plat.count} jogos ({pct}%)</span>
                        {plat.hours > 0 && <span className="text-purple-400 font-bold">{formatHoursAndMinutes(plat.hours)}</span>}
                      </div>
                    </div>
                    <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full bg-gradient-to-r from-purple-600 to-cyan-500 rounded-full transition-all"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Genre Breakdown */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="text-cyan-400" size={18} />
                <h3 className="text-base font-bold text-white uppercase font-orbitron tracking-wide">
                  Gêneros Favoritos
                </h3>
              </div>
              <span className="text-xs text-cyan-400 font-bold bg-cyan-950/40 px-2.5 py-1 rounded-full border border-cyan-800/30">
                {stats.genres.length} Gêneros Mapeados
              </span>
            </div>

            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
              {stats.genres.map((g) => {
                const pct = stats.totalGames > 0 ? Math.round((g.count / stats.totalGames) * 100) : 0;
                return (
                  <div 
                    key={g.name} 
                    onClick={() => {
                      setModalSearch("");
                      setActiveModal({
                        title: `Gênero: ${g.name}`,
                        subtitle: `${g.count} jogos catalogados`,
                        explanation: `Todos os títulos associados ao gênero ${g.name}.`,
                        icon: <Tag className="text-cyan-400" size={20} />,
                        gamesList: games.filter(game => {
                          const raw = Array.isArray(game.genre) ? game.genre : splitEntities(game.genre);
                          return raw.includes(g.name);
                        }),
                      });
                    }}
                    className="space-y-1 cursor-pointer group"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-white group-hover:text-cyan-300 transition-colors">{g.name}</span>
                      <div className="flex items-center gap-2 text-zinc-400 font-mono text-[11px]">
                        <span>{g.count} jogos</span>
                        {g.hours > 0 && <span className="text-cyan-400 font-bold">{formatHoursAndMinutes(g.hours)}</span>}
                      </div>
                    </div>
                    <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.min(pct * 2, 100)}%` }}
                        className="h-full bg-gradient-to-r from-cyan-600 to-emerald-400 rounded-full transition-all"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Yearly Completion History & HLTB Pace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Yearly Completion History */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="text-emerald-400" size={18} />
                <h3 className="text-base font-bold text-white uppercase font-orbitron tracking-wide">
                  Histórico de Conclusões por Ano
                </h3>
              </div>
              <span className="text-xs text-emerald-400 font-bold bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-800/30">
                {stats.completedGames} Concluídos
              </span>
            </div>

            {stats.completionByYear.length > 0 ? (
              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin">
                {stats.completionByYear.map((y) => {
                  const pct = stats.completedGames > 0 ? Math.round((y.count / stats.completedGames) * 100) : 0;
                  return (
                    <div 
                      key={y.year}
                      onClick={() => {
                        setModalSearch("");
                        setActiveModal({
                          title: `Jogos Concluídos em ${y.year}`,
                          subtitle: `${y.count} jogos zerados em ${y.year}`,
                          explanation: `Jogos finalizados no ano de ${y.year}.`,
                          icon: <Calendar className="text-emerald-400" size={20} />,
                          gamesList: games.filter(g => {
                            const isDone = (g.status || []).includes("Zerado") || (g.status || []).includes("Terminado");
                            const d = g.endDate || g.startDate || "";
                            return isDone && d.includes(y.year);
                          }),
                          metricType: "status",
                        });
                      }}
                      className="space-y-1 cursor-pointer group"
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold font-mono text-emerald-300 group-hover:underline">Ano {y.year}</span>
                        <div className="flex items-center gap-2 text-zinc-400 font-mono text-[11px]">
                          <span>{y.count} zerados ({pct}%)</span>
                          {y.hours > 0 && <span className="text-emerald-400 font-bold">{formatHoursAndMinutes(y.hours)}</span>}
                        </div>
                      </div>
                      <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-gradient-to-r from-emerald-600 to-green-400 rounded-full transition-all"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-zinc-500">
                Preencha a "Data de Término" dos jogos zerados para ativar a linha do tempo por ano!
              </div>
            )}
          </div>

          {/* HLTB & Pace Performance Card */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="text-amber-400" size={18} />
                <h3 className="text-base font-bold text-white uppercase font-orbitron tracking-wide">
                  Análise HLTB & Ritmo de Jogo
                </h3>
              </div>
              <span className="text-xs text-amber-400 font-bold bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-800/30">
                {stats.backlogGames} no Backlog
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800">
                <span className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Média p/ Jogo Zerado</span>
                <span className="text-base font-black font-mono text-cyan-400">
                  {stats.completedGames > 0 ? formatHoursAndMinutes(stats.totalPlaytimeHours / stats.completedGames) : "0h"}
                </span>
              </div>
              <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800">
                <span className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Estimativa Backlog</span>
                <span className="text-base font-black font-mono text-amber-400">
                  ~{formatHoursAndMinutes(stats.estimatedBacklogHours)}
                </span>
              </div>
              <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800">
                <span className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Tempo Total Ativo</span>
                <span className="text-base font-black font-mono text-purple-400">
                  {formatHoursAndMinutes(stats.totalJogatinaHours)}
                </span>
              </div>
              <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800">
                <span className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Conteúdo Extra</span>
                <span className="text-base font-black font-mono text-emerald-400">
                  {formatHoursAndMinutes(stats.totalExtraHours)}
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-amber-950/20 border border-amber-500/20 rounded-2xl text-xs space-y-1">
              <span className="font-bold text-amber-400 flex items-center gap-1">
                <Zap size={14} /> Dica de Produtividade Gamer:
              </span>
              <p className="text-zinc-300 text-[11px] leading-relaxed">
                Você investiu um total de <strong className="text-cyan-300">{formatHoursAndMinutes(stats.totalPlaytimeHours)}</strong> em toda a sua coleção. Com uma taxa de conclusão de <strong className="text-emerald-400">{stats.completionRate}%</strong>, seu ritmo médio atual é de <strong className="text-amber-300">{stats.completedGames > 0 ? formatHoursAndMinutes(stats.totalPlaytimeHours / stats.completedGames) : "0h"} por jogo concluído</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Playtime Champions & Series Highlights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Invested Playtime Games */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="text-cyan-400" size={18} />
                <h3 className="text-base font-bold text-white uppercase font-orbitron tracking-wide">
                  Mais Horas Jogadas
                </h3>
              </div>
              <span className="text-xs text-cyan-400 font-bold bg-cyan-950/40 px-2.5 py-1 rounded-full border border-cyan-800/30 font-mono">
                {stats.topPlaytimeGames.length} Jogos
              </span>
            </div>

            {stats.topPlaytimeGames.length > 0 ? (
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
                {stats.topPlaytimeGames.map(({ game, hours }, idx) => (
                  <div
                    key={game.id}
                    onClick={() => onSelectGame && onSelectGame(game.id)}
                    className="p-3 bg-zinc-950 hover:bg-zinc-800/80 rounded-2xl border border-zinc-800/60 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 font-black font-mono text-xs flex items-center justify-center shrink-0 border border-cyan-500/30">
                        #{idx + 1}
                      </div>
                      <div className="w-9 h-11 rounded-xl overflow-hidden shrink-0 bg-zinc-900">
                        <img
                          src={game.cover}
                          alt={game.name}
                          loading="lazy"
                          decoding="async"
                          style={{
                            objectPosition: `${game.coverPositionX ?? 50}% ${game.coverPosition ?? 50}%`,
                            transform: `scale(${(game.coverZoom ?? 100) / 100})`,
                          }}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate group-hover:text-cyan-400 transition-colors">
                          {game.name}
                        </h4>
                        <p className="text-[10px] text-zinc-500 truncate">{game.platform || "PC"}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-black font-mono text-cyan-400 block">
                        {formatHoursAndMinutes(hours)}
                      </span>
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wider block">
                        Tempo Declarado
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-zinc-500">
                Preencha o "Tempo de Jogo" nas fichas para ranquear seus títulos com mais horas acumuladas!
              </div>
            )}
          </div>

          {/* Top Series / Franchises */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <Bookmark className="text-purple-400" size={18} />
              <h3 className="text-base font-bold text-white uppercase font-orbitron tracking-wide">
                Franquias em Destaque
              </h3>
            </div>

            {stats.series.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {stats.series.map((s) => (
                  <div
                    key={s.name}
                    onClick={() => {
                      setModalSearch("");
                      setActiveModal({
                        title: `Franquia: ${s.name}`,
                        subtitle: `${s.count} ${s.count === 1 ? "jogo registrado" : "jogos registrados"}`,
                        explanation: `Todos os títulos pertencentes à série ${s.name}.`,
                        icon: <Bookmark className="text-purple-400" size={20} />,
                        gamesList: games.filter(g => g.series === s.name),
                      });
                    }}
                    className="p-3 bg-zinc-950 hover:bg-zinc-800 rounded-2xl border border-zinc-800 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <span className="text-xs font-bold text-zinc-200 truncate">{s.name}</span>
                    <span className="px-2 py-1 bg-purple-950/60 text-purple-300 font-black font-mono text-xs rounded-xl border border-purple-500/20 shrink-0">
                      {s.count} {s.count === 1 ? "jogo" : "jogos"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-zinc-500">
                Adicione a "Série" nas fichas dos jogos para ver quais franquias dominam sua coleção!
              </div>
            )}
          </div>
        </div>

        {/* Recently Completed Games */}
        {stats.recentlyFinishedGames.length > 0 && (
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="text-cyan-400" size={18} />
                <h3 className="text-base font-bold text-white uppercase font-orbitron tracking-wide">
                  Histórico de Jogos Zerados
                </h3>
              </div>
              <span className="text-xs text-cyan-400 font-bold bg-cyan-950/40 px-3 py-1 rounded-full border border-cyan-500/20">
                {stats.completedGames} Concluídos no total
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {stats.recentlyFinishedGames.map((game) => (
                <RecentlyFinishedGameCard
                  key={game.id}
                  game={game}
                  onSelectGame={onSelectGame}
                  onUpdateGame={onUpdateGame}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          </div>
        )}

        {/* Interactive Detail Modal Popup with Search Filter */}
        {activeModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn cursor-pointer"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setActiveModal(null);
                setModalSearch("");
              }
            }}
          >
            <div
              className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-4xl lg:max-w-5xl xl:max-w-6xl w-full max-h-[88vh] overflow-hidden flex flex-col shadow-2xl animate-scaleUp cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/80">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800">
                    {activeModal.icon || <Info className="text-cyan-400" size={20} />}
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-orbitron text-white">
                      {activeModal.title}
                    </h3>
                    <p className="text-xs text-cyan-400 font-mono font-semibold">
                      {activeModal.subtitle}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setActiveModal(null);
                    setModalSearch("");
                  }}
                  className="p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Search & Sort Bar */}
              <div className="px-5 py-2.5 bg-zinc-950 border-b border-zinc-800 flex flex-col sm:flex-row items-center gap-3">
                <div className="flex items-center gap-2 w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 focus-within:border-cyan-500/50">
                  <Search size={16} className="text-zinc-500 shrink-0" />
                  <input
                    type="text"
                    placeholder="Filtrar jogos nesta lista por nome, plataforma ou gênero..."
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    className="w-full bg-transparent text-xs text-white focus:outline-none placeholder:text-zinc-600"
                  />
                  {modalSearch && (
                    <button
                      onClick={() => setModalSearch("")}
                      className="p-1 text-zinc-500 hover:text-white transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                  <span className="text-[10px] text-zinc-500 font-mono uppercase">Ordem:</span>
                  <select
                    value={modalSort}
                    onChange={(e) => setModalSort(e.target.value as any)}
                    className="w-full sm:w-auto bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer hover:border-zinc-700 transition-colors font-mono"
                  >
                    <option value="completion-desc">📅 Data de Conclusão (Mais Recente)</option>
                    <option value="default">Original</option>
                    <option value="playtime-desc">⏱️ Maior Tempo de Jogo</option>
                    <option value="rating-desc">★ Nota Pessoal</option>
                    <option value="metacritic-desc">🏆 Metascore</option>
                    <option value="hltb-desc">🔥 HLTB (Maior)</option>
                    <option value="name-asc">🔤 Nome (A-Z)</option>
                  </select>
                </div>
              </div>

              {/* Explanation Note */}
              <div className="px-5 py-3 bg-purple-950/30 border-b border-purple-500/20 flex items-start gap-2.5 text-xs text-zinc-300">
                <Info size={16} className="text-purple-400 shrink-0 mt-0.5" />
                <span>{activeModal.explanation}</span>
              </div>

              {/* Playtime 3-Part Summary Banner */}
              {activeModal.metricType === "playtime" && (
                <div className="px-5 py-3 bg-zinc-950/90 border-b border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-center">
                  <div className="bg-purple-950/40 p-2.5 rounded-xl border border-purple-500/30">
                    <span className="block text-[10px] font-bold text-purple-400 uppercase tracking-wider">🎮 Tempo da Jogatina</span>
                    <span className="text-sm font-black font-mono text-purple-200">{formatHoursAndMinutes(stats.totalJogatinaHours)}</span>
                    <span className="block text-[9px] text-zinc-500">Campanhas / Ativas</span>
                  </div>
                  <div className="bg-cyan-950/40 p-2.5 rounded-xl border border-cyan-500/30">
                    <span className="block text-[10px] font-bold text-cyan-400 uppercase tracking-wider">➕ Tempo Extra</span>
                    <span className="text-sm font-black font-mono text-cyan-200">{formatHoursAndMinutes(stats.totalExtraHours)}</span>
                    <span className="block text-[9px] text-zinc-500">Secundárias / Outras</span>
                  </div>
                  <div className="bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/40">
                    <span className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider">⏱️ Tempo Total</span>
                    <span className="text-sm font-black font-mono text-emerald-200">{formatHoursAndMinutes(stats.totalPlaytimeHours)}</span>
                    <span className="block text-[9px] text-zinc-500">Somatório Geral</span>
                  </div>
                </div>
              )}

              {/* Backlog Pace Interactive Estimator Banner with Custom Daily Hours Input & Comparative HLTB Scenarios */}
              {activeModal.metricType === "hltb_backlog" && (() => {
                const hoursPerDay = Math.max(0.1, dailyPlayHours || 1);

                // Main Story Scenario
                const mainHours = stats.backlogMainHours || 0;
                const mainDays = Math.ceil(mainHours / hoursPerDay);
                const mainMonths = (mainDays / 30.416).toFixed(1);
                const mainYears = (mainDays / 365.25).toFixed(1);
                const mainTargetDate = new Date();
                mainTargetDate.setDate(mainTargetDate.getDate() + mainDays);
                const mainDateFormatted = mainTargetDate.toLocaleDateString("pt-BR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });

                // Main + Extras Scenario
                const extraHours = stats.backlogExtraHours || 0;
                const extraDays = Math.ceil(extraHours / hoursPerDay);
                const extraMonths = (extraDays / 30.416).toFixed(1);
                const extraYears = (extraDays / 365.25).toFixed(1);
                const extraTargetDate = new Date();
                extraTargetDate.setDate(extraTargetDate.getDate() + extraDays);
                const extraDateFormatted = extraTargetDate.toLocaleDateString("pt-BR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });

                // Completionist Scenario
                const compHours = stats.backlogCompletionistHours || 0;
                const compDays = Math.ceil(compHours / hoursPerDay);
                const compMonths = (compDays / 30.416).toFixed(1);
                const compYears = (compDays / 365.25).toFixed(1);
                const compTargetDate = new Date();
                compTargetDate.setDate(compTargetDate.getDate() + compDays);
                const compDateFormatted = compTargetDate.toLocaleDateString("pt-BR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });

                return (
                  <div className="px-5 py-3.5 bg-gradient-to-r from-amber-950/40 via-zinc-900 to-amber-950/30 border-b border-amber-500/25 space-y-3">
                    {/* Input Field for Daily Hours */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950/90 p-3 rounded-2xl border border-amber-500/30">
                      <div className="flex items-center gap-2">
                        <Zap size={18} className="text-amber-400 shrink-0" />
                        <div>
                          <span className="text-xs text-amber-300 font-bold font-orbitron block">
                            Ritmo de Jogatina Diária:
                          </span>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            Digite quantas horas por dia pretende jogar para calcular suas estimativas
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          min="0.1"
                          max="24"
                          step="0.5"
                          value={dailyPlayHours}
                          onChange={(e) => setDailyPlayHours(Math.max(0.1, parseFloat(e.target.value) || 0))}
                          className="w-24 bg-zinc-900 border border-amber-500/50 text-amber-300 text-sm font-black font-mono rounded-xl px-3 py-1.5 text-center focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 shadow-inner"
                        />
                        <div className="text-left font-mono leading-tight">
                          <span className="block text-xs font-bold text-zinc-300">h / dia</span>
                          <span className="block text-[9px] text-zinc-500">(~{(hoursPerDay * 7).toFixed(1)}h/sem)</span>
                        </div>
                      </div>
                    </div>

                    {/* 3-Way Comparative Scenarios Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Scenario 1: Main Story */}
                      <div className="p-3 bg-zinc-950/90 rounded-2xl border border-amber-500/30 flex flex-col justify-between space-y-2">
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[11px] font-bold text-amber-400 uppercase font-orbitron truncate">
                              🎮 Main Story
                            </span>
                            <span className="text-[10px] font-mono text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-500/30 shrink-0">
                              ~{Math.round(mainHours)}h
                            </span>
                          </div>
                          <div className="text-xl font-black font-mono text-amber-400">
                            {mainDays} DIAS
                          </div>
                          <span className="text-[10px] text-zinc-400 font-mono block">
                            ~{mainMonths} meses / ~{mainYears} anos
                          </span>
                        </div>
                        <div className="pt-2 border-t border-zinc-800 flex justify-between items-center text-[10px] font-mono">
                          <span className="text-zinc-500 font-bold uppercase">Previsão:</span>
                          <span className="text-zinc-200 font-bold">{mainDateFormatted}</span>
                        </div>
                      </div>

                      {/* Scenario 2: Main + Extras */}
                      <div className="p-3 bg-zinc-950/90 rounded-2xl border border-cyan-500/30 flex flex-col justify-between space-y-2">
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[11px] font-bold text-cyan-400 uppercase font-orbitron truncate">
                              ⚡ Main + Extras
                            </span>
                            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded-md border border-cyan-500/30 shrink-0">
                              ~{Math.round(extraHours)}h
                            </span>
                          </div>
                          <div className="text-xl font-black font-mono text-cyan-400">
                            {extraDays} DIAS
                          </div>
                          <span className="text-[10px] text-zinc-400 font-mono block">
                            ~{extraMonths} meses / ~{extraYears} anos
                          </span>
                        </div>
                        <div className="pt-2 border-t border-zinc-800 flex justify-between items-center text-[10px] font-mono">
                          <span className="text-zinc-500 font-bold uppercase">Previsão:</span>
                          <span className="text-zinc-200 font-bold">{extraDateFormatted}</span>
                        </div>
                      </div>

                      {/* Scenario 3: Completionist */}
                      <div className="p-3 bg-zinc-950/90 rounded-2xl border border-emerald-500/30 flex flex-col justify-between space-y-2">
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[11px] font-bold text-emerald-400 uppercase font-orbitron truncate">
                              🏆 Completionist (100%)
                            </span>
                            <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/30 shrink-0">
                              ~{Math.round(compHours)}h
                            </span>
                          </div>
                          <div className="text-xl font-black font-mono text-emerald-400">
                            {compDays} DIAS
                          </div>
                          <span className="text-[10px] text-zinc-400 font-mono block">
                            ~{compMonths} meses / ~{compYears} anos
                          </span>
                        </div>
                        <div className="pt-2 border-t border-zinc-800 flex justify-between items-center text-[10px] font-mono">
                          <span className="text-zinc-500 font-bold uppercase">Previsão:</span>
                          <span className="text-zinc-200 font-bold">{compDateFormatted}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Games List in Modal */}
              <div className="p-5 overflow-y-auto space-y-2.5 max-h-[55vh] scrollbar-thin">
                {(() => {
                  const filteredGames = activeModal.gamesList.filter((g) => {
                    if (!modalSearch.trim()) return true;
                    const q = modalSearch.toLowerCase();
                    return (
                      g.name.toLowerCase().includes(q) ||
                      (g.platform || "").toLowerCase().includes(q) ||
                      (g.series || "").toLowerCase().includes(q) ||
                      (Array.isArray(g.genre) ? g.genre.join(" ") : g.genre || "").toLowerCase().includes(q)
                    );
                  });

                  const sortedGames = [...filteredGames].sort((a, b) => {
                    if (modalSort === "completion-desc") {
                      const getCompletionTime = (g: Game) => {
                        const d = g.endDate || g.startDate;
                        if (!d) return 0;
                        const ts = Date.parse(d);
                        if (!isNaN(ts)) return ts;
                        const brMatch = d.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
                        if (brMatch) {
                          const day = parseInt(brMatch[1], 10);
                          const month = parseInt(brMatch[2], 10) - 1;
                          let year = parseInt(brMatch[3], 10);
                          if (year < 100) year += 2000;
                          return new Date(year, month, day).getTime();
                        }
                        const yearMatch = d.match(/(\d{4})/);
                        if (yearMatch) return new Date(parseInt(yearMatch[1], 10), 0, 1).getTime();
                        return 0;
                      };
                      const timeA = getCompletionTime(a);
                      const timeB = getCompletionTime(b);
                      if (timeA !== timeB) return timeB - timeA;
                      return a.name.localeCompare(b.name);
                    }
                    if (modalSort === "playtime-desc") {
                      return getTotalGamePlaytimeHours(b) - getTotalGamePlaytimeHours(a);
                    }
                    if (modalSort === "rating-desc") {
                      return (b.rating || 0) - (a.rating || 0);
                    }
                    if (modalSort === "metacritic-desc") {
                      return (b.metacriticCritScore || 0) - (a.metacriticCritScore || 0);
                    }
                    if (modalSort === "name-asc") {
                      return a.name.localeCompare(b.name);
                    }
                    if (modalSort === "hltb-desc") {
                      const hltbA = parsePlaytimeHours(a.hltbMain) || parsePlaytimeHours(a.hltbExtra) || 0;
                      const hltbB = parsePlaytimeHours(b.hltbMain) || parsePlaytimeHours(b.hltbExtra) || 0;
                      return hltbB - hltbA;
                    }
                    return 0;
                  });

                  if (sortedGames.length === 0) {
                    return (
                      <div className="text-center py-10 text-xs text-zinc-500">
                        Nenhum jogo encontrado para esta busca.
                      </div>
                    );
                  }

                  return sortedGames.map((game) => {
                    const userHours = getTotalGamePlaytimeHours(game);
                    const hasHltb = game.hltbMain || game.hltbExtra || game.hltbCompletionist;

                    return (
                      <div
                        key={game.id}
                        onClick={() => {
                          setActiveModal(null);
                          setModalSearch("");
                          if (onSelectGame) onSelectGame(game.id);
                        }}
                        className="p-3 bg-zinc-950 hover:bg-zinc-800 rounded-2xl border border-zinc-800 flex items-center justify-between gap-3 cursor-pointer group transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-12 rounded-xl overflow-hidden shrink-0 bg-zinc-900">
                            <img
                              src={game.cover || "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800"}
                              alt={game.name}
                              loading="lazy"
                              decoding="async"
                              style={{
                                objectPosition: `${game.coverPositionX ?? 50}% ${game.coverPosition ?? 50}%`,
                                transform: `scale(${(game.coverZoom ?? 100) / 100})`,
                              }}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white truncate group-hover:text-cyan-400 transition-colors">
                              {game.name}
                            </h4>
                            <p className="text-[10px] text-zinc-400 truncate">
                              {game.platform || "PC"} • {game.series || "Sem Série"}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {game.status && game.status.length > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                                  {game.status.join(", ")}
                                </span>
                              )}
                              {(game.endDate || game.startDate) && (
                                <span className="text-[9px] text-cyan-400 font-mono font-bold bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-500/20">
                                  📅 {game.endDate || game.startDate}
                                </span>
                              )}
                              {userHours > 0 && (
                                <span className="text-[9px] text-purple-400 font-mono font-bold">
                                  ⏱️ Total: {formatHoursAndMinutes(userHours)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right-side metrics customized by modal category */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {activeModal.metricType === "playtime" ? (
                            <div className="flex flex-col items-end gap-1 text-right">
                              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                <span className="px-2 py-0.5 bg-purple-950/80 text-purple-300 font-mono font-bold text-[10px] rounded-lg border border-purple-500/30" title="Tempo da Jogatina">
                                  🎮 Jogatina: {game.playtime || "0h"}
                                </span>
                                <span className="px-2 py-0.5 bg-cyan-950/80 text-cyan-300 font-mono font-bold text-[10px] rounded-lg border border-cyan-500/30" title="Tempo Extra">
                                  ➕ Extra: {game.additionalPlaytime || "0h"}
                                </span>
                                <span className="px-2.5 py-0.5 bg-emerald-950/80 text-emerald-300 font-mono font-bold text-xs rounded-lg border border-emerald-500/40" title="Somatório Total">
                                  ⏱️ Total: {formatHoursAndMinutes(userHours)}
                                </span>
                              </div>
                              {hasHltb ? (
                                <span className="text-[10px] text-amber-400/90 font-mono font-semibold mt-0.5">
                                  HLTB: {game.hltbMain ? `Main ${game.hltbMain}` : ""}{game.hltbExtra ? ` • Extra ${game.hltbExtra}` : ""}{game.hltbCompletionist ? ` • 100% ${game.hltbCompletionist}` : ""}
                                </span>
                              ) : (
                                <span className="text-[10px] text-zinc-500 font-mono mt-0.5">
                                  HLTB: Não cadastrado
                                </span>
                              )}
                            </div>
                          ) : activeModal.metricType === "hltb_backlog" ? (
                            <div className="flex flex-col items-end gap-1 text-right">
                              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                <span className="px-2 py-0.5 bg-amber-950/90 text-amber-300 font-mono font-bold text-[11px] rounded-lg border border-amber-500/40 shadow-sm" title="Campanha Principal">
                                  🎮 Main: {game.hltbMain || "15h"}
                                </span>
                                <span className="px-2 py-0.5 bg-cyan-950/90 text-cyan-300 font-mono font-bold text-[11px] rounded-lg border border-cyan-500/40 shadow-sm" title="História + Extras">
                                  ⚡ Extra: {game.hltbExtra || (game.hltbMain ? `${Math.round(parsePlaytimeHours(game.hltbMain) * 1.35)}h` : "22h")}
                                </span>
                                <span className="px-2.5 py-0.5 bg-emerald-950/90 text-emerald-300 font-mono font-bold text-[11px] rounded-lg border border-emerald-500/40 shadow-sm" title="Complecionista (100%)">
                                  🏆 100%: {game.hltbCompletionist || (game.hltbMain ? `${Math.round(parsePlaytimeHours(game.hltbMain) * 2.1)}h` : "35h")}
                                </span>
                              </div>
                              {userHours > 0 && (
                                <span className="text-[10px] text-purple-300 font-mono font-semibold">
                                  Progresso atual: {formatHoursAndMinutes(userHours)}
                                </span>
                              )}
                            </div>
                          ) : activeModal.metricType === "metacritic" ? (
                            <div className="flex items-center gap-1.5">
                              {game.metacriticCritScore && game.metacriticCritScore > 0 ? (
                                <span className="px-2 py-1 bg-amber-500/20 text-amber-400 font-mono font-bold text-xs rounded-lg border border-amber-500/30">
                                  Meta: {game.metacriticCritScore}
                                </span>
                              ) : (
                                <span className="text-[10px] text-zinc-500">Sem Metascore</span>
                              )}
                              {game.rating && game.rating > 0 && (
                                <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 font-mono font-bold text-xs rounded-lg border border-cyan-500/30">
                                  Sua: {convertUserRatingTo100(game.rating)}
                                </span>
                              )}
                            </div>
                          ) : activeModal.metricType === "user_rating" ? (
                            <div className="flex items-center gap-1.5">
                              {game.rating && game.rating > 0 ? (
                                <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-300 font-mono font-bold text-xs rounded-lg border border-cyan-500/30">
                                  ★ {game.rating} ({convertUserRatingTo100(game.rating)}/100)
                                </span>
                              ) : (
                                <span className="text-[10px] text-zinc-500">Sem nota</span>
                              )}
                              {game.metacriticCritScore && game.metacriticCritScore > 0 && (
                                <span className="px-2 py-1 bg-amber-500/20 text-amber-400 font-mono font-bold text-xs rounded-lg border border-amber-500/30">
                                  Meta: {game.metacriticCritScore}
                                </span>
                              )}
                            </div>
                          ) : activeModal.metricType === "trophies" ? (
                            <div className="flex items-center gap-2">
                              <TrophyBadge trophy={game.trophy || "none"} mode="card" />
                              {game.endDate && (
                                <span className="text-[10px] text-zinc-400 font-mono">
                                  Zerado: {formatDateDisplay(game.endDate)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {game.metacriticCritScore && game.metacriticCritScore > 0 && (
                                <span className="px-2 py-1 bg-amber-500/20 text-amber-400 font-mono font-bold text-xs rounded-lg border border-amber-500/30">
                                  Meta: {game.metacriticCritScore}
                                </span>
                              )}
                              {game.rating && game.rating > 0 && (
                                <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 font-mono font-bold text-xs rounded-lg border border-cyan-500/30">
                                  Sua: {convertUserRatingTo100(game.rating)}
                                </span>
                              )}
                              <ExternalLink size={14} className="text-zinc-500 group-hover:text-white transition-colors" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-zinc-800 bg-zinc-950/80 flex justify-end">
                <button
                  onClick={() => {
                    setActiveModal(null);
                    setModalSearch("");
                  }}
                  className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
