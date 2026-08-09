import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause, Square, Clock, Gamepad2, Plus, Sparkles, X, Check, Edit3, BookOpen, Trash2 } from "lucide-react";
import { Game, ActiveLiveSession } from "../types";
import { addSecondsToPlaytime, formatHoursAndMinutes } from "../utils/playtime";

const STORAGE_KEY = "gamer_vault_active_session";

interface LiveSessionWidgetProps {
  games: Game[];
  onUpdateGame: (updatedGame: Game) => void;
  onOpenLiveSessionModal?: () => void;
}

export function LiveSessionWidget({ games, onUpdateGame }: LiveSessionWidgetProps) {
  const [activeSession, setActiveSession] = useState<ActiveLiveSession | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [isDiscardConfirming, setIsDiscardConfirming] = useState(false);
  const [manualMinutesInput, setManualMinutesInput] = useState<number>(0);
  const [sessionNote, setSessionNote] = useState("");
  const [addToDiary, setAddToDiary] = useState(true);

  // Sync session changes to localStorage & notify other components
  useEffect(() => {
    if (activeSession) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(activeSession));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    window.dispatchEvent(new Event("LIVE_SESSION_CHANGED"));
  }, [activeSession]);

  // Listener for custom events from other components
  useEffect(() => {
    const handleCustomStart = (e: CustomEvent<{ gameId: string }>) => {
      const { gameId } = e.detail;
      const gameExists = games.some((g) => g.id === gameId);
      if (!gameExists) return;

      const newSession: ActiveLiveSession = {
        gameId,
        startTimestamp: Date.now(),
        accumulatedMs: 0,
        isPaused: false,
        sessionNotes: "",
      };
      setActiveSession(newSession);
    };

    const handleTogglePauseEvent = () => {
      if (!activeSession) return;
      handleTogglePause();
    };

    const handleFinishEvent = () => {
      if (!activeSession) return;
      handleOpenFinishModal();
    };

    window.addEventListener("START_LIVE_SESSION" as any, handleCustomStart as any);
    window.addEventListener("TOGGLE_PAUSE_LIVE_SESSION" as any, handleTogglePauseEvent as any);
    window.addEventListener("FINISH_LIVE_SESSION" as any, handleFinishEvent as any);

    return () => {
      window.removeEventListener("START_LIVE_SESSION" as any, handleCustomStart as any);
      window.removeEventListener("TOGGLE_PAUSE_LIVE_SESSION" as any, handleTogglePauseEvent as any);
      window.removeEventListener("FINISH_LIVE_SESSION" as any, handleFinishEvent as any);
    };
  }, [games, activeSession]);

  // Timer tick effect - Calculates elapsed seconds accurately using Date.now()
  useEffect(() => {
    if (!activeSession) {
      setElapsedSeconds(0);
      return;
    }

    const updateTimer = () => {
      if (activeSession.isPaused) {
        setElapsedSeconds(Math.floor(activeSession.accumulatedMs / 1000));
      } else {
        const currentRunMs = Date.now() - activeSession.startTimestamp;
        const totalMs = activeSession.accumulatedMs + currentRunMs;
        setElapsedSeconds(Math.floor(totalMs / 1000));
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  if (!activeSession) return null;

  const activeGame = games.find((g) => g.id === activeSession.gameId);
  if (!activeGame) return null;

  const handleTogglePause = () => {
    if (activeSession.isPaused) {
      // Resume
      setActiveSession({
        ...activeSession,
        startTimestamp: Date.now(),
        isPaused: false,
        pausedTimestamp: undefined,
      });
    } else {
      // Pause
      const currentRunMs = Date.now() - activeSession.startTimestamp;
      setActiveSession({
        ...activeSession,
        accumulatedMs: activeSession.accumulatedMs + currentRunMs,
        isPaused: true,
        pausedTimestamp: Date.now(),
      });
    }
  };

  const handleOpenFinishModal = () => {
    // Pause if running before finish
    if (!activeSession.isPaused) {
      const currentRunMs = Date.now() - activeSession.startTimestamp;
      const totalMs = activeSession.accumulatedMs + currentRunMs;
      setActiveSession({
        ...activeSession,
        accumulatedMs: totalMs,
        isPaused: true,
      });
    }

    const currentTotalMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    setManualMinutesInput(currentTotalMinutes);
    setSessionNote("");
    setAddToDiary(true);
    setIsDiscardConfirming(false);
    setIsFinishModalOpen(true);
  };

  const handleDiscardSession = () => {
    setActiveSession(null);
    setIsFinishModalOpen(false);
    setIsDiscardConfirming(false);
  };

  const handleConfirmFinish = () => {
    if (!activeGame) return;

    const secondsToAdd = Math.max(0, manualMinutesInput * 60);

    // 1. Update main playtime
    const updatedPlaytime = addSecondsToPlaytime(activeGame.playtime, secondsToAdd);

    // 2. Optional: Add entry to Diary
    let updatedDiary = [...(activeGame.diary || [])];
    if (addToDiary && manualMinutesInput > 0) {
      const today = new Date();
      const dateFormatted = today.toLocaleDateString("pt-BR");
      const durationHoursDec = manualMinutesInput / 60;
      const durationFormatted = formatHoursAndMinutes(durationHoursDec);

      const defaultText = `⏱️ **Sessão ao Vivo**: +${durationFormatted}${
        sessionNote.trim() ? `\n\n${sessionNote.trim()}` : ""
      }`;

      updatedDiary.unshift({
        id: `diary-live-${Date.now()}`,
        period: dateFormatted,
        text: defaultText,
        medias: [],
      });
    }

    // 3. Save updated game
    const updatedGame: Game = {
      ...activeGame,
      playtime: updatedPlaytime,
      diary: updatedDiary,
    };

    onUpdateGame(updatedGame);
    setActiveSession(null);
    setIsFinishModalOpen(false);
  };

  // Format seconds to HH:MM:SS
  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <>
      {/* Floating Bottom Bar Widget */}
      <motion.div
        initial={{ y: 80, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 80, opacity: 0, scale: 0.9 }}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[90] max-w-lg w-[92vw] sm:w-auto"
      >
        <div className="bg-zinc-950/90 border-2 border-cyan-500/60 rounded-2xl p-2.5 sm:px-4 sm:py-3 shadow-[0_0_35px_rgba(6,182,212,0.25)] backdrop-blur-xl flex items-center justify-between gap-3 text-white">
          {/* Game Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <img
                src={activeGame.cover || "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=300"}
                alt={activeGame.name}
                className="w-10 h-12 object-cover rounded-lg border border-cyan-500/30 shadow-md"
              />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500" />
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                <Clock size={12} className="animate-spin text-cyan-400" />
                <span>Sessão ao Vivo</span>
              </div>
              <span className="text-xs font-extrabold text-zinc-100 truncate max-w-[140px] sm:max-w-[180px]">
                {activeGame.name}
              </span>
            </div>
          </div>

          {/* Timer Display */}
          <div className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-sm sm:text-base font-black text-cyan-300 tracking-wider shrink-0 shadow-inner">
            {formatTimer(elapsedSeconds)}
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleTogglePause}
              className={`p-2 rounded-xl transition-all cursor-pointer font-bold ${
                activeSession.isPaused
                  ? "bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300"
                  : "bg-amber-950 hover:bg-amber-900 border border-amber-500/50 text-amber-300"
              }`}
              title={activeSession.isPaused ? "Retomar Sessão" : "Pausar Sessão"}
            >
              {activeSession.isPaused ? <Play size={16} /> : <Pause size={16} />}
            </button>

            <button
              type="button"
              onClick={handleOpenFinishModal}
              className="p-2 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 hover:text-white transition-all cursor-pointer font-bold flex items-center gap-1 shadow-md active:scale-95"
              title="Finalizar Sessão e Salvar Tempo"
            >
              <Square size={16} className="fill-cyan-400 text-cyan-400" />
              <span className="hidden sm:inline text-xs">Concluir</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!activeSession.isPaused) {
                  const currentRunMs = Date.now() - activeSession.startTimestamp;
                  setActiveSession({
                    ...activeSession,
                    accumulatedMs: activeSession.accumulatedMs + currentRunMs,
                    isPaused: true,
                  });
                }
                setIsDiscardConfirming(true);
                setIsFinishModalOpen(true);
              }}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-rose-950 border border-zinc-800 hover:border-rose-500/50 text-zinc-400 hover:text-rose-300 transition-all cursor-pointer"
              title="Descartar Sessão de Jogo"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Modal: Finalizar Sessão e Ajustar Tempo */}
      <AnimatePresence>
        {isFinishModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md cursor-pointer"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsFinishModalOpen(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-zinc-950 border-2 border-cyan-500/50 p-5 sm:p-6 rounded-3xl max-w-md w-full space-y-4 shadow-2xl cursor-default text-zinc-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-400">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Finalizar Sessão de Jogo</h3>
                    <p className="text-xs text-zinc-400">{activeGame.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFinishModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Time Adjustment Box */}
              <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
                <label className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <Clock size={14} /> Tempo Registrado nesta Sessão (Minutos):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={manualMinutesInput}
                    onChange={(e) => setManualMinutesInput(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-lg font-mono font-bold text-cyan-300 outline-none focus:border-cyan-400"
                  />
                  <span className="text-xs font-semibold text-zinc-400 shrink-0">
                    min ({formatHoursAndMinutes(manualMinutesInput / 60)})
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  💡 Este tempo será **somado diretamente ao Tempo Principal do Jogo (`playtime`)**.
                </p>
              </div>

              {/* Diary Note Option */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addToDiary}
                      onChange={(e) => setAddToDiary(e.target.checked)}
                      className="accent-cyan-500 rounded cursor-pointer"
                    />
                    <span>Registrar no Diário de Jogatina</span>
                  </label>
                </div>

                {addToDiary && (
                  <textarea
                    value={sessionNote}
                    onChange={(e) => setSessionNote(e.target.value)}
                    placeholder="Escreva anotações ou observações desta sessão (ex: Derrotei o Boss da Caverna)..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-cyan-500"
                  />
                )}
              </div>

              {/* Action Buttons */}
              {isDiscardConfirming ? (
                <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-500/60 space-y-2.5 text-left">
                  <p className="text-xs font-bold text-rose-200">
                    ⚠️ Tem certeza que deseja descartar esta sessão? O tempo decorrido nesta sessão não será salvo no jogo.
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsDiscardConfirming(false)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleDiscardSession}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 size={14} /> Sim, Descartar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsDiscardConfirming(true)}
                    className="px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 size={14} /> Descartar
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsFinishModalOpen(false)}
                      className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmFinish}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-zinc-950 font-black text-xs transition-all shadow-lg shadow-cyan-500/20 active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <Check size={16} /> Salvar Sessão
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Helper to dispatch CustomEvent to trigger a live session from any component
 */
export function startLiveSessionForGame(gameId: string) {
  const event = new CustomEvent("START_LIVE_SESSION", { detail: { gameId } });
  window.dispatchEvent(event);
}

/**
 * Header Badge indicator showing active live game session and quick timer controls
 */
export function LiveSessionHeaderBadge({ games }: { games: Game[] }) {
  const [session, setSession] = useState<ActiveLiveSession | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [elapsedSec, setElapsedSec] = useState(0);

  // Sync state on event or storage
  useEffect(() => {
    const syncState = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        setSession(saved ? JSON.parse(saved) : null);
      } catch {
        setSession(null);
      }
    };

    window.addEventListener("LIVE_SESSION_CHANGED", syncState);
    window.addEventListener("storage", syncState);
    return () => {
      window.removeEventListener("LIVE_SESSION_CHANGED", syncState);
      window.removeEventListener("storage", syncState);
    };
  }, []);

  // Timer tick
  useEffect(() => {
    if (!session) {
      setElapsedSec(0);
      return;
    }

    const updateTimer = () => {
      if (session.isPaused) {
        setElapsedSec(Math.floor(session.accumulatedMs / 1000));
      } else {
        const currentRunMs = Date.now() - session.startTimestamp;
        const totalMs = session.accumulatedMs + currentRunMs;
        setElapsedSec(Math.floor(totalMs / 1000));
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session]);

  const activeGame = session ? games.find((g) => g.id === session.gameId) : null;

  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const handleTogglePause = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new Event("TOGGLE_PAUSE_LIVE_SESSION"));
  };

  const handleFinish = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new Event("FINISH_LIVE_SESSION"));
  };

  if (!session || !activeGame) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-300 bg-rose-950/60 hover:bg-rose-900/80 px-3.5 py-1.5 rounded-full border border-rose-500/40 shadow-sm shadow-rose-950/20 cursor-pointer transition-all"
        data-tooltip="Nenhuma sessão de jogo em andamento. Clique no botão ▶ em qualquer card de jogo para iniciar o cronômetro!"
        data-tooltip-title="Iniciar Sessão ao Vivo ⏱️"
        data-tooltip-theme="cyan"
      >
        <Play size={12} className="fill-rose-400 text-rose-400" />
        <span>Iniciar Sessão</span>
      </span>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-2 text-xs font-bold bg-cyan-950/90 text-cyan-200 px-3 py-1.5 rounded-full border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.25)]"
      data-tooltip={`Sessão de jogo ativa para '${activeGame.name}'. Use os controles rápidos para pausar ou finalizar.`}
      data-tooltip-title="Sessão ao Vivo em Andamento 🎮"
      data-tooltip-theme="cyan"
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="relative flex h-2 w-2">
          {!session.isPaused && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${session.isPaused ? "bg-amber-400" : "bg-emerald-500"}`} />
        </span>
        <span className="text-cyan-400 font-extrabold uppercase tracking-wider text-[10px] hidden sm:inline">Ao Vivo:</span>
        <span className="text-white font-extrabold truncate max-w-[110px] sm:max-w-[150px]">{activeGame.name}</span>
        <span className="font-mono text-cyan-300 font-black px-1.5 py-0.5 rounded bg-zinc-950/80 border border-cyan-500/30">
          {formatTimer(elapsedSec)}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0 border-l border-cyan-500/30 pl-1.5">
        <button
          type="button"
          onClick={handleTogglePause}
          className={`p-1 rounded-md transition-all cursor-pointer ${
            session.isPaused
              ? "bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300"
              : "bg-amber-950 hover:bg-amber-900 border border-amber-500/50 text-amber-300"
          }`}
          title={session.isPaused ? "Retomar Sessão" : "Pausar Sessão"}
        >
          {session.isPaused ? <Play size={11} /> : <Pause size={11} />}
        </button>

        <button
          type="button"
          onClick={handleFinish}
          className="p-1 rounded-md bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 hover:text-white transition-all cursor-pointer"
          title="Finalizar e Salvar Tempo"
        >
          <Square size={11} className="fill-cyan-400 text-cyan-400" />
        </button>
      </div>
    </div>
  );
}
