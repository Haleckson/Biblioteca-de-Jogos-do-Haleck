import React, { useState, useEffect } from "react";
import { Game } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { X, Clock, Calculator, Globe, RotateCcw, CheckCircle2, Sparkles } from "lucide-react";
import { parsePlaytimeHours, formatHoursAndMinutes, getTotalGamePlaytimeHours } from "../utils/playtime";
import { formatHltbTime } from "../utils/hltbFormatter";
import { useBodyScrollLock } from "../lib/bodyScrollLock";

interface GameEstimateModalProps {
  isOpen?: boolean;
  game: Game | null;
  onClose: () => void;
}

export default function GameEstimateModal({ isOpen = true, game, onClose }: GameEstimateModalProps) {
  useBodyScrollLock(!!isOpen && !!game);

  const [dailyPlayHours, setDailyPlayHours] = useState<number>(2);
  const [deductPlayedTime, setDeductPlayedTime] = useState<boolean>(true);
  const [customPlaytimeInput, setCustomPlaytimeInput] = useState<string>("");

  const [targetMainInput, setTargetMainInput] = useState<string>("");
  const [targetExtraInput, setTargetExtraInput] = useState<string>("");
  const [targetCompInput, setTargetCompInput] = useState<string>("");

  useEffect(() => {
    if (game) {
      setCustomPlaytimeInput(game.playtime ? formatHltbTime(game.playtime) : "00h 00m");
      const m = parsePlaytimeHours(game.hltbMain) || 15;
      const e = Math.max(m, parsePlaytimeHours(game.hltbExtra) || Math.round(m * 1.35));
      const c = Math.max(e, parsePlaytimeHours(game.hltbCompletionist) || Math.round(m * 2.1));

      setTargetMainInput(game.hltbMain ? formatHltbTime(game.hltbMain) : formatHoursAndMinutes(m));
      setTargetExtraInput(game.hltbExtra ? formatHltbTime(game.hltbExtra) : formatHoursAndMinutes(e));
      setTargetCompInput(game.hltbCompletionist ? formatHltbTime(game.hltbCompletionist) : formatHoursAndMinutes(c));
    }
  }, [game]);

  if (!isOpen || !game) return null;

  const currentPlaytimeHours = parsePlaytimeHours(customPlaytimeInput);

  const targetMain = parsePlaytimeHours(targetMainInput) || 15;
  const targetExtra = parsePlaytimeHours(targetExtraInput) || 20;
  const targetComp = parsePlaytimeHours(targetCompInput) || 35;

  const resetToHltb = () => {
    if (game) {
      const m = parsePlaytimeHours(game.hltbMain) || 15;
      const e = Math.max(m, parsePlaytimeHours(game.hltbExtra) || Math.round(m * 1.35));
      const c = Math.max(e, parsePlaytimeHours(game.hltbCompletionist) || Math.round(m * 2.1));

      setTargetMainInput(game.hltbMain ? formatHltbTime(game.hltbMain) : formatHoursAndMinutes(m));
      setTargetExtraInput(game.hltbExtra ? formatHltbTime(game.hltbExtra) : formatHoursAndMinutes(e));
      setTargetCompInput(game.hltbCompletionist ? formatHltbTime(game.hltbCompletionist) : formatHoursAndMinutes(c));
    }
  };

  const handleImportFromSheet = () => {
    if (game) {
      setCustomPlaytimeInput(game.playtime ? formatHltbTime(game.playtime) : "00h 00m");
    }
  };

  // Calculations for 3 modes
  const mainHoursNeeded = deductPlayedTime ? Math.max(0, targetMain - currentPlaytimeHours) : targetMain;
  const extraHoursNeeded = deductPlayedTime ? Math.max(0, targetExtra - currentPlaytimeHours) : targetExtra;
  const compHoursNeeded = deductPlayedTime ? Math.max(0, targetComp - currentPlaytimeHours) : targetComp;

  const rate = dailyPlayHours > 0 ? dailyPlayHours : 1;

  const mainDays = Math.ceil(mainHoursNeeded / rate);
  const extraDays = Math.ceil(extraHoursNeeded / rate);
  const compDays = Math.ceil(compHoursNeeded / rate);

  // Formatter for weeks/months without decimals (zero dízimas)
  const calcMonths = (days: number) => {
    if (days <= 0) return "0 dias";
    if (days < 7) return `${days} dia${days > 1 ? "s" : ""}`;
    if (days < 30) {
      const weeks = Math.round(days / 7);
      return `${weeks} sem.`;
    }
    const months = Math.round(days / 30);
    return `${months} ${months === 1 ? "mês" : "meses"}`;
  };

  const calcDateFormatted = (days: number) => {
    if (days <= 0) return "Hoje mesmo! 🎉";
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const getProgressPct = (target: number) => {
    if (target <= 0) return 0;
    return Math.min(100, Math.round((currentPlaytimeHours / target) * 100));
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-zinc-950 rounded-3xl max-w-5xl lg:max-w-6xl xl:max-w-7xl w-full p-6 sm:p-8 shadow-2xl border border-amber-500/30 relative z-10 space-y-6 max-h-[92vh] overflow-y-auto custom-scrollbar"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-14 rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0 shadow-md">
                <img
                  src={game.cover || "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800"}
                  alt={game.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Calculator size={16} className="text-amber-400" />
                  <span className="text-xs font-bold uppercase font-orbitron tracking-wider text-amber-400">
                    Calculadora de Estimativa
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white truncate max-w-md">{game.name}</h3>
                <p className="text-xs text-zinc-400">
                  {game.platform || "PC"} • Tempo de jogo atual: <strong className="text-amber-400 font-mono">{formatHoursAndMinutes(currentPlaytimeHours)}</strong>
                  {game.additionalPlaytime && parsePlaytimeHours(game.additionalPlaytime) > 0 && (
                    <span className="text-[10px] text-zinc-500 block mt-0.5">
                      (Tempo extra de {game.additionalPlaytime} desconsiderado para a estimativa)
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Controls */}
          <div className="bg-zinc-900/90 p-4 rounded-2xl border border-zinc-800 space-y-4">
            {/* Custom Invested Playtime Input & Import Button */}
            <div className="space-y-2 pb-3 border-b border-zinc-800/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider block">
                    Tempo de Jogo Investido:
                  </label>
                  <span className="text-[11px] text-zinc-400">
                    Digite quanto tempo já jogou ou importe o valor da sua ficha técnica.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customPlaytimeInput}
                    onChange={(e) => setCustomPlaytimeInput(e.target.value)}
                    onBlur={() => setCustomPlaytimeInput(formatHoursAndMinutes(currentPlaytimeHours))}
                    placeholder="Ex: 10h 30m ou 15"
                    className="w-32 bg-zinc-950 border border-amber-500/40 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <button
                    type="button"
                    onClick={handleImportFromSheet}
                    className="px-3 py-1.5 rounded-xl bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                    title="Importar tempo de jogo da ficha técnica do jogo"
                  >
                    <RotateCcw size={12} />
                    <span>Importar da Ficha ({game.playtime ? formatHltbTime(game.playtime) : "00h 00m"})</span>
                  </button>
                </div>
              </div>

              {currentPlaytimeHours > 0 && (
                <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 font-mono bg-zinc-950/80 p-2 rounded-xl border border-zinc-800">
                  <Clock size={12} className="text-amber-400 shrink-0" />
                  <span>
                    Tempo aplicado nos cálculos: <strong className="text-amber-300">{formatHoursAndMinutes(currentPlaytimeHours)}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Daily Pace */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider block">
                  Ritmo diário de jogo:
                </label>
                <span className="text-[11px] text-zinc-400">Quantas horas por dia pretende jogar?</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.5"
                  max="12"
                  step="0.5"
                  value={dailyPlayHours}
                  onChange={(e) => setDailyPlayHours(parseFloat(e.target.value) || 1)}
                  className="w-32 accent-amber-400 cursor-pointer"
                />
                <span className="px-3 py-1 rounded-xl bg-amber-950 text-amber-300 font-mono font-bold text-sm border border-amber-500/30 min-w-[70px] text-center">
                  {dailyPlayHours}h/dia
                </span>
              </div>
            </div>

            {currentPlaytimeHours > 0 && (
              <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-zinc-300 font-medium">
                  Descontar as <strong>{formatHoursAndMinutes(currentPlaytimeHours)}</strong> já jogadas?
                </span>
                <button
                  type="button"
                  onClick={() => setDeductPlayedTime(!deductPlayedTime)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    deductPlayedTime
                      ? "bg-emerald-950 text-emerald-300 border-emerald-500/40"
                      : "bg-zinc-800 text-zinc-400 border-zinc-700"
                  }`}
                >
                  {deductPlayedTime ? "✓ Sim (Descontar progresso)" : "✕ Não (Calcular total do zero)"}
                </button>
              </div>
            )}
          </div>

          {/* Target Hours Fine-Tuning Bar */}
          <div className="bg-zinc-900/60 p-3 rounded-2xl border border-zinc-800/70 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-zinc-300 font-mono uppercase text-[11px]">Meta de Horas por Modo (Editável):</span>
              <button
                type="button"
                onClick={resetToHltb}
                className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                title="Restaurar valores do HowLongToBeat"
              >
                <RotateCcw size={11} />
                <span>Restaurar HLTB</span>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-amber-400 font-bold block mb-1">🎮 Main Story</label>
                <input
                  type="text"
                  value={targetMainInput}
                  onChange={(e) => setTargetMainInput(e.target.value)}
                  onBlur={() => setTargetMainInput(formatHoursAndMinutes(targetMain))}
                  placeholder="Ex: 15h 30m"
                  className="w-full bg-zinc-950 border border-amber-500/30 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="text-[10px] text-cyan-400 font-bold block mb-1">⚡ Main + Extras</label>
                <input
                  type="text"
                  value={targetExtraInput}
                  onChange={(e) => setTargetExtraInput(e.target.value)}
                  onBlur={() => setTargetExtraInput(formatHoursAndMinutes(targetExtra))}
                  placeholder="Ex: 22h 00m"
                  className="w-full bg-zinc-950 border border-cyan-500/30 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>
              <div>
                <label className="text-[10px] text-emerald-400 font-bold block mb-1">🏆 100% Completo</label>
                <input
                  type="text"
                  value={targetCompInput}
                  onChange={(e) => setTargetCompInput(e.target.value)}
                  onBlur={() => setTargetCompInput(formatHoursAndMinutes(targetComp))}
                  placeholder="Ex: 35h 00m"
                  className="w-full bg-zinc-950 border border-emerald-500/30 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>
            </div>
          </div>

          {/* Scenarios Grid - 3 Modes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* 1. Main Story */}
            <div className="p-4 bg-zinc-900/90 rounded-2xl border border-amber-500/30 space-y-3 flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-xs font-extrabold text-amber-400 uppercase font-orbitron truncate">
                    🎮 Main Story
                  </span>
                  <span className="text-[10px] font-mono text-amber-300 bg-amber-950/90 px-2 py-0.5 rounded-lg border border-amber-500/40 shrink-0">
                    {formatHoursAndMinutes(targetMain)} total
                  </span>
                </div>

                {/* Progress bar */}
                {deductPlayedTime && targetMain > 0 && (
                  <div className="space-y-1 my-2">
                    <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                      <span>Progresso:</span>
                      <span className="text-amber-300 font-bold">{getProgressPct(targetMain)}%</span>
                    </div>
                    <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden border border-zinc-800">
                      <div
                        className="bg-amber-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${getProgressPct(targetMain)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="text-2xl font-black font-mono text-amber-400 mt-2">
                  {mainDays <= 0 ? "CONCLUÍDO" : `${mainDays} DIAS`}
                </div>
                <span className="text-[11px] text-zinc-300 font-mono block font-semibold">
                  {mainHoursNeeded <= 0 ? "Nenhuma hora restante!" : `Faltam: ${formatHoursAndMinutes(mainHoursNeeded)} (~${calcMonths(mainDays)})`}
                </span>
              </div>
              <div className="pt-2 border-t border-zinc-800/80 flex justify-between items-center text-[10px] font-mono">
                <span className="text-zinc-500 font-bold uppercase">Previsão:</span>
                <span className="text-amber-200 font-bold">{calcDateFormatted(mainDays)}</span>
              </div>
            </div>

            {/* 2. Main + Extras */}
            <div className="p-4 bg-zinc-900/90 rounded-2xl border border-cyan-500/30 space-y-3 flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-xs font-extrabold text-cyan-400 uppercase font-orbitron truncate">
                    ⚡ Main + Extras
                  </span>
                  <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/90 px-2 py-0.5 rounded-lg border border-cyan-500/40 shrink-0">
                    {formatHoursAndMinutes(targetExtra)} total
                  </span>
                </div>

                {/* Progress bar */}
                {deductPlayedTime && targetExtra > 0 && (
                  <div className="space-y-1 my-2">
                    <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                      <span>Progresso:</span>
                      <span className="text-cyan-300 font-bold">{getProgressPct(targetExtra)}%</span>
                    </div>
                    <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden border border-zinc-800">
                      <div
                        className="bg-cyan-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${getProgressPct(targetExtra)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="text-2xl font-black font-mono text-cyan-400 mt-2">
                  {extraDays <= 0 ? "CONCLUÍDO" : `${extraDays} DIAS`}
                </div>
                <span className="text-[11px] text-zinc-300 font-mono block font-semibold">
                  {extraHoursNeeded <= 0 ? "Nenhuma hora restante!" : `Faltam: ${formatHoursAndMinutes(extraHoursNeeded)} (~${calcMonths(extraDays)})`}
                </span>
              </div>
              <div className="pt-2 border-t border-zinc-800/80 flex justify-between items-center text-[10px] font-mono">
                <span className="text-zinc-500 font-bold uppercase">Previsão:</span>
                <span className="text-cyan-200 font-bold">{calcDateFormatted(extraDays)}</span>
              </div>
            </div>

            {/* 3. 100% Completionist */}
            <div className="p-4 bg-zinc-900/90 rounded-2xl border border-emerald-500/30 space-y-3 flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-xs font-extrabold text-emerald-400 uppercase font-orbitron truncate">
                    🏆 100% Completo
                  </span>
                  <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/90 px-2 py-0.5 rounded-lg border border-emerald-500/40 shrink-0">
                    {formatHoursAndMinutes(targetComp)} total
                  </span>
                </div>

                {/* Progress bar */}
                {deductPlayedTime && targetComp > 0 && (
                  <div className="space-y-1 my-2">
                    <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                      <span>Progresso:</span>
                      <span className="text-emerald-300 font-bold">{getProgressPct(targetComp)}%</span>
                    </div>
                    <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden border border-zinc-800">
                      <div
                        className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${getProgressPct(targetComp)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="text-2xl font-black font-mono text-emerald-400 mt-2">
                  {compDays <= 0 ? "CONCLUÍDO" : `${compDays} DIAS`}
                </div>
                <span className="text-[11px] text-zinc-300 font-mono block font-semibold">
                  {compHoursNeeded <= 0 ? "Nenhuma hora restante!" : `Faltam: ${formatHoursAndMinutes(compHoursNeeded)} (~${calcMonths(compDays)})`}
                </span>
              </div>
              <div className="pt-2 border-t border-zinc-800/80 flex justify-between items-center text-[10px] font-mono">
                <span className="text-zinc-500 font-bold uppercase">Previsão:</span>
                <span className="text-emerald-200 font-bold">{calcDateFormatted(compDays)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-xs">
            {game.hltbId ? (
              <a
                href={`https://howlongtobeat.com/game/${game.hltbId}`}
                target="_blank"
                rel="noreferrer"
                className="text-amber-400 hover:underline inline-flex items-center gap-1 font-semibold"
              >
                <Globe size={12} />
                Ver perfil no HowLongToBeat ↗
              </a>
            ) : (
              <span className="text-zinc-500 text-[11px]">Métricas estimadas via HowLongToBeat</span>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold hover:bg-zinc-800 transition-all cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
