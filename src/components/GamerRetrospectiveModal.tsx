import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  X,
  Trophy,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Star,
  Gamepad2,
  Flame,
  Award,
  Share2,
  Calendar,
  Layers,
  BarChart3,
  Copy,
  Check,
  RotateCcw,
} from "lucide-react";
import { Game, getGameHighestTrophy } from "../types";
import { parsePlaytimeHours, formatHoursAndMinutes } from "../utils/playtime";
import { useBodyScrollLock } from "../lib/bodyScrollLock";

interface GamerRetrospectiveModalProps {
  games: Game[];
  onClose: () => void;
}

const SLIDE_TABS = [
  { id: 0, label: "Resumo", icon: BarChart3 },
  { id: 1, label: "Destaque", icon: Flame },
  { id: 2, label: "Preferências", icon: Layers },
  { id: 3, label: "Platinas", icon: Trophy },
  { id: 4, label: "Compartilhar", icon: Share2 },
];

export function GamerRetrospectiveModal({ games, onClose }: GamerRetrospectiveModalProps) {
  useBodyScrollLock(true);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedYear, setSelectedYear] = useState<string>("2026");
  const [copiedText, setCopiedText] = useState(false);

  // Available Years from game end dates/start dates
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    games.forEach((g) => {
      if (g.endDate) {
        const match = g.endDate.match(/(\d{4})/);
        if (match) years.add(match[1]);
      }
      if (g.startDate) {
        const match = g.startDate.match(/(\d{4})/);
        if (match) years.add(match[1]);
      }
    });
    years.add("2026");
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [games]);

  // Filter games based on selected year
  const filteredGames = useMemo(() => {
    if (selectedYear === "all") return games;
    return games.filter((g) => {
      const endMatch = g.endDate && g.endDate.includes(selectedYear);
      const startMatch = g.startDate && g.startDate.includes(selectedYear);
      return endMatch || startMatch;
    });
  }, [games, selectedYear]);

  // Calculations for Retrospective
  const finishedGames = useMemo(
    () => filteredGames.filter((g) => !g.isGaaS && g.status.some((s) => s.toLowerCase().includes("terminado") || s.toLowerCase().includes("zerado"))),
    [filteredGames]
  );

  // Consider ONLY campaign/current time (g.playtime) for retrospective metrics of the selected period
  const totalHours = useMemo(() => {
    return filteredGames.reduce((acc, g) => acc + parsePlaytimeHours(g.playtime), 0);
  }, [filteredGames]);

  const campaignNonGaaSHours = useMemo(() => {
    return filteredGames
      .filter((g) => !g.isGaaS)
      .reduce((acc, g) => acc + parsePlaytimeHours(g.playtime), 0);
  }, [filteredGames]);

  const gaaSHours = useMemo(() => {
    return filteredGames
      .filter((g) => g.isGaaS)
      .reduce((acc, g) => acc + parsePlaytimeHours(g.playtime), 0);
  }, [filteredGames]);

  const archivedExtraHours = useMemo(() => {
    return filteredGames.reduce((acc, g) => acc + parsePlaytimeHours(g.additionalPlaytime), 0);
  }, [filteredGames]);

  const mostPlayedGame = useMemo(() => {
    const valid = filteredGames.filter((g) => parsePlaytimeHours(g.playtime) > 0);
    if (valid.length === 0) return null;
    return [...valid].sort((a, b) => parsePlaytimeHours(b.playtime) - parsePlaytimeHours(a.playtime))[0];
  }, [filteredGames]);

  const platinumGames = useMemo(() => {
    return filteredGames.filter((g) => getGameHighestTrophy(g) === "platinum");
  }, [filteredGames]);

  // Platform & Genre Counts
  const platformStats = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredGames.forEach((g) => {
      if (g.platform) {
        counts[g.platform] = (counts[g.platform] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filteredGames]);

  const genreStats = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredGames.forEach((g) => {
      g.genre?.forEach((gn) => {
        counts[gn] = (counts[gn] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filteredGames]);

  const TOTAL_SLIDES = SLIDE_TABS.length;

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev < TOTAL_SLIDES - 1 ? prev + 1 : prev));
  };

  const handlePrevSlide = () => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : prev));
  };

  // Keyboard Navigation (Left / Right / Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        setCurrentSlide((prev) => Math.min(TOTAL_SLIDES - 1, prev + 1));
      } else if (e.key === "ArrowLeft") {
        setCurrentSlide((prev) => Math.max(0, prev - 1));
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [TOTAL_SLIDES, onClose]);

  const handleCopySummary = () => {
    const yearLabel = selectedYear === "all" ? "Geral" : selectedYear;
    const text = `🎆 **Retrospectiva Gamer - ${yearLabel}** 🎮
🏆 Jogos Zerados: ${finishedGames.length}
⏱️ Horas Investidas (Campanhas do Ano): ${formatHoursAndMinutes(totalHours)}
👑 Jogo Mais Jogado: ${mostPlayedGame ? mostPlayedGame.name : "Nenhum"} (${mostPlayedGame ? formatHoursAndMinutes(parsePlaytimeHours(mostPlayedGame.playtime)) : "0h"})
💎 Platinas Conquistadas: ${platinumGames.length}
🎮 Plataforma Principal: ${platformStats[0] ? platformStats[0][0] : "Variadas"}
✨ Gerado no GamerVault!`;

    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-xl"
    >
      {/* Background ambient glow effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-cyan-950/30 via-purple-950/20 to-pink-950/30 pointer-events-none" />

      {/* Expanded Modal Box (max-w-4xl) */}
      <div className="relative w-full max-w-4xl bg-zinc-950 border-2 border-cyan-500/50 rounded-3xl shadow-[0_0_60px_rgba(6,182,212,0.3)] flex flex-col overflow-hidden max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 text-zinc-950 font-bold shadow-lg shadow-cyan-500/20">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>Retrospectiva Gamer</span>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 text-xs uppercase font-mono font-bold">
                  {selectedYear === "all" ? "Visão Geral" : selectedYear}
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400 hidden sm:block">
                Navegue com os botões, clique nas abas ou use as setas ⬅️ ➡️ do teclado
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Year Selector */}
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setCurrentSlide(0);
              }}
              className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-700 text-xs font-extrabold text-cyan-300 outline-none cursor-pointer hover:border-cyan-400 transition-colors"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  Ano {y}
                </option>
              ))}
              <option value="all">Todas as Eras (Geral)</option>
            </select>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Fechar (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Slide Interactive Tab Buttons */}
        <div className="px-4 py-2.5 bg-zinc-950 border-b border-zinc-800/80 flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar">
          {SLIDE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentSlide === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentSlide(tab.id)}
                className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-2 shrink-0 ${
                  isActive
                    ? "bg-gradient-to-r from-cyan-500 to-purple-600 text-zinc-950 shadow-md shadow-cyan-500/20 scale-105"
                    : "bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800/60"
                }`}
              >
                <Icon size={14} className={isActive ? "text-zinc-950" : "text-cyan-400"} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Slide Canvas */}
        <div className="p-6 sm:p-10 flex-1 overflow-y-auto min-h-[400px] flex flex-col justify-center relative bg-zinc-950/60">
          <AnimatePresence mode="wait">
            {/* SLIDE 0: VISÃO GERAL */}
            {currentSlide === 0 && (
              <motion.div
                key="slide-0"
                initial={{ opacity: 0, scale: 0.96, x: 30 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.96, x: -30 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 text-center max-w-3xl mx-auto w-full"
              >
                <div className="space-y-1">
                  <span className="text-xs uppercase font-black tracking-widest text-cyan-400 font-mono">
                    Seu Período em Resumo
                  </span>
                  <h2 className="text-2xl sm:text-4xl font-black text-white">Estatísticas do Jogador</h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col items-center justify-center gap-1.5 shadow-xl hover:border-emerald-500/40 transition-colors">
                    <CheckCircle2 size={30} className="text-emerald-400" />
                    <span className="text-2xl sm:text-3xl font-black text-white">{finishedGames.length}</span>
                    <span className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Jogos Zerados
                    </span>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col items-center justify-center gap-1.5 shadow-xl hover:border-purple-500/40 transition-colors">
                    <Clock size={30} className="text-purple-400" />
                    <span className="text-xl sm:text-2xl font-black text-white">{formatHoursAndMinutes(totalHours)}</span>
                    <span className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-wider">Horas Totais</span>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col items-center justify-center gap-1.5 shadow-xl hover:border-amber-500/40 transition-colors">
                    <Trophy size={30} className="text-amber-400" />
                    <span className="text-2xl sm:text-3xl font-black text-white">{platinumGames.length}</span>
                    <span className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-wider">Platinas</span>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col items-center justify-center gap-1.5 shadow-xl hover:border-cyan-500/40 transition-colors">
                    <Gamepad2 size={30} className="text-cyan-400" />
                    <span className="text-2xl sm:text-3xl font-black text-white">{filteredGames.length}</span>
                    <span className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-wider">Cadastrados</span>
                  </div>
                </div>

                {/* Distribuição Inteligente de Tempo sem dízimas */}
                <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-left space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                    <span className="text-xs font-extrabold text-cyan-300 uppercase tracking-wider font-mono flex items-center gap-2">
                      <Clock size={16} className="text-cyan-400" /> Distribuição de Tempo (Campanhas da Era)
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">Sem Tempo Extra Antigo</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                    <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 flex flex-col gap-1">
                      <span className="text-[10px] text-purple-300/80 uppercase font-sans font-extrabold">Campanhas Principais:</span>
                      <strong className="text-purple-200 text-base sm:text-lg font-black">{formatHoursAndMinutes(campaignNonGaaSHours)}</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-pink-950/40 border border-pink-500/30 flex flex-col gap-1">
                      <span className="text-[10px] text-pink-300/80 uppercase font-sans font-extrabold">Games as a Service:</span>
                      <strong className="text-pink-200 text-base sm:text-lg font-black">{formatHoursAndMinutes(gaaSHours)}</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-cyan-950/20 border border-zinc-800/80 flex flex-col gap-1 opacity-75">
                      <span className="text-[10px] text-zinc-400 uppercase font-sans font-extrabold">Tempo Extra (Ignorado):</span>
                      <strong className="text-zinc-300 text-base sm:text-lg font-black">{formatHoursAndMinutes(archivedExtraHours)}</strong>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SLIDE 1: O GRANDE CAMPEÃO (MAIS JOGADO) */}
            {currentSlide === 1 && (
              <motion.div
                key="slide-1"
                initial={{ opacity: 0, scale: 0.96, x: 30 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.96, x: -30 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 text-center flex flex-col items-center max-w-3xl mx-auto w-full"
              >
                <div className="space-y-1">
                  <span className="text-xs uppercase font-black tracking-widest text-purple-400 flex items-center justify-center gap-1.5 font-mono">
                    <Flame size={16} className="text-amber-400 animate-bounce" /> O Maior Destaque
                  </span>
                  <h2 className="text-2xl sm:text-4xl font-black text-white">Jogo Mais Jogado</h2>
                </div>

                {mostPlayedGame ? (
                  <div className="p-6 rounded-3xl bg-zinc-900/90 border-2 border-purple-500/50 shadow-2xl flex flex-col sm:flex-row items-center gap-6 max-w-2xl w-full">
                    <img
                      src={mostPlayedGame.cover || "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=300"}
                      alt={mostPlayedGame.name}
                      className="w-32 h-44 object-cover rounded-2xl shadow-xl shrink-0 border border-purple-400/30"
                    />
                    <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-3 min-w-0 flex-1">
                      <span className="px-3 py-1 rounded-full bg-purple-950 border border-purple-500/40 text-purple-300 text-xs font-bold uppercase tracking-wider">
                        {mostPlayedGame.platform}
                      </span>
                      <h3 className="text-xl sm:text-2xl font-black text-white leading-tight truncate max-w-full">
                        {mostPlayedGame.name}
                      </h3>

                      {/* Tempo sem dízima periódica usando formatHoursAndMinutes da campanha */}
                      <div className="flex items-center gap-2 text-cyan-300 font-mono font-bold text-base sm:text-lg bg-zinc-950/90 px-4 py-2 rounded-xl border border-zinc-800 shadow-md">
                        <Clock size={18} className="text-cyan-400 shrink-0" />
                        <span>{formatHoursAndMinutes(parsePlaytimeHours(mostPlayedGame.playtime))} investidas</span>
                      </div>

                      {mostPlayedGame.rating > 0 && (
                        <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold bg-amber-950/40 px-3 py-1 rounded-lg border border-amber-500/30">
                          <Star size={15} className="fill-amber-400 text-amber-400" />
                          <span>Nota do Jogador: {mostPlayedGame.rating} / 5</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">Nenhum jogo registrado neste período.</p>
                )}
              </motion.div>
            )}

            {/* SLIDE 2: DOMÍNIO DE PLATAFORMAS & GÊNEROS */}
            {currentSlide === 2 && (
              <motion.div
                key="slide-2"
                initial={{ opacity: 0, scale: 0.96, x: 30 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.96, x: -30 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 max-w-3xl mx-auto w-full"
              >
                <div className="text-center space-y-1">
                  <span className="text-xs uppercase font-black tracking-widest text-cyan-400 font-mono">Hábitos de Jogo</span>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">Plataformas & Gêneros Favoritos</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {/* Top Platforms */}
                  <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-4">
                    <h4 className="text-xs font-black uppercase text-cyan-400 tracking-wider flex items-center gap-2 font-mono">
                      <Gamepad2 size={18} /> Top Plataformas
                    </h4>
                    {platformStats.length === 0 ? (
                      <p className="text-xs text-zinc-500">Sem plataformas registradas.</p>
                    ) : (
                      platformStats.slice(0, 4).map(([plat, count], idx) => (
                        <div key={plat} className="flex items-center justify-between text-xs font-bold text-zinc-200 border-b border-zinc-800/80 pb-2">
                          <span className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-500/40 flex items-center justify-center text-xs font-mono font-bold">
                              #{idx + 1}
                            </span>
                            <span className="text-sm font-bold text-white">{plat}</span>
                          </span>
                          <span className="text-cyan-300 font-mono text-sm">{count} {count === 1 ? "jogo" : "jogos"}</span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Top Genres */}
                  <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-4">
                    <h4 className="text-xs font-black uppercase text-purple-400 tracking-wider flex items-center gap-2 font-mono">
                      <Layers size={18} /> Top Gêneros
                    </h4>
                    {genreStats.length === 0 ? (
                      <p className="text-xs text-zinc-500">Sem gêneros registrados.</p>
                    ) : (
                      genreStats.slice(0, 4).map(([genre, count], idx) => (
                        <div key={genre} className="flex items-center justify-between text-xs font-bold text-zinc-200 border-b border-zinc-800/80 pb-2">
                          <span className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-full bg-purple-950 text-purple-400 border border-purple-500/40 flex items-center justify-center text-xs font-mono font-bold">
                              #{idx + 1}
                            </span>
                            <span className="text-sm font-bold text-white">{genre}</span>
                          </span>
                          <span className="text-purple-300 font-mono text-sm">{count} {count === 1 ? "jogo" : "jogos"}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* SLIDE 3: GALERIA DE PLATINAS & TROFÉUS */}
            {currentSlide === 3 && (
              <motion.div
                key="slide-3"
                initial={{ opacity: 0, scale: 0.96, x: 30 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.96, x: -30 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 text-center max-w-3xl mx-auto w-full"
              >
                <div className="space-y-1">
                  <span className="text-xs uppercase font-black tracking-widest text-amber-400 flex items-center justify-center gap-1.5 font-mono">
                    <Trophy size={16} /> Conquistas de Elite
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">Galeria de Platinas</h2>
                </div>

                {platinumGames.length === 0 ? (
                  <div className="p-8 rounded-3xl bg-zinc-900/60 border border-zinc-800 text-zinc-400 text-xs sm:text-sm max-w-lg mx-auto">
                    Nenhuma platina registrada neste período. Continue jogando para conquistar seus 100%! 🏆
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-1">
                    {platinumGames.map((g) => (
                      <div key={g.id} className="p-3 rounded-2xl bg-zinc-900 border border-cyan-500/30 flex items-center gap-3 shadow-md hover:border-cyan-400 transition-colors">
                        <img src={g.cover} alt={g.name} className="w-12 h-14 object-cover rounded-xl shrink-0" />
                        <div className="text-left min-w-0 flex-1">
                          <h4 className="text-xs sm:text-sm font-extrabold text-zinc-100 truncate">{g.name}</h4>
                          <span className="text-[11px] text-cyan-300 font-semibold flex items-center gap-1 mt-0.5">
                            🏆 Platina Conquistada
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* SLIDE 4: CARD FINAL & COMPARTILHAMENTO */}
            {currentSlide === 4 && (
              <motion.div
                key="slide-4"
                initial={{ opacity: 0, scale: 0.96, x: 30 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.96, x: -30 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 text-center flex flex-col items-center max-w-3xl mx-auto w-full"
              >
                <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-cyan-950/80 via-zinc-900 to-purple-950/80 border-2 border-cyan-400/50 shadow-2xl max-w-lg w-full space-y-5 text-left">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                    <div className="flex items-center gap-2.5">
                      <Gamepad2 className="text-cyan-400" size={24} />
                      <span className="text-base font-black text-white">GamerVault Retrospective</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950 px-2.5 py-1 rounded-lg border border-cyan-500/40">
                      {selectedYear === "all" ? "Todas as Eras" : selectedYear}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs sm:text-sm text-zinc-300">
                    <p className="flex items-center justify-between">
                      <span>🏆 Jogos Zerados:</span> <strong className="text-emerald-400 font-mono text-base">{finishedGames.length}</strong>
                    </p>
                    <p className="flex items-center justify-between">
                      <span>⏱️ Horas de Jogatina:</span> <strong className="text-cyan-300 font-mono text-base">{formatHoursAndMinutes(totalHours)}</strong>
                    </p>
                    <p className="flex items-center justify-between">
                      <span>👑 Jogo Destaque:</span> <strong className="text-purple-300 truncate max-w-[200px]">{mostPlayedGame?.name || "Nenhum"}</strong>
                    </p>
                    <p className="flex items-center justify-between">
                      <span>💎 Platinas:</span> <strong className="text-amber-400 font-mono text-base">{platinumGames.length}</strong>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-zinc-950 font-black text-xs sm:text-sm transition-all shadow-xl shadow-cyan-500/20 active:scale-95 cursor-pointer flex items-center gap-2.5"
                >
                  {copiedText ? <Check size={18} /> : <Copy size={18} />}
                  <span>{copiedText ? "Resumo Copiado para a Área de Transferência!" : "Copiar Resumo da Retrospectiva"}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Slide Footer Navigation Controls */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/90 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handlePrevSlide}
            disabled={currentSlide === 0}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
              currentSlide === 0 ? "opacity-30 cursor-not-allowed text-zinc-600" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60"
            }`}
          >
            <ChevronLeft size={18} />
            <span>Anterior</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-cyan-400">
              Passo {currentSlide + 1} de {TOTAL_SLIDES}
            </span>
          </div>

          <button
            type="button"
            onClick={handleNextSlide}
            disabled={currentSlide === TOTAL_SLIDES - 1}
            className={`px-5 py-2.5 rounded-2xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
              currentSlide === TOTAL_SLIDES - 1
                ? "opacity-30 cursor-not-allowed text-zinc-600"
                : "bg-cyan-500 hover:bg-cyan-400 text-zinc-950 shadow-lg shadow-cyan-500/25"
            }`}
          >
            <span>Próximo</span>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
