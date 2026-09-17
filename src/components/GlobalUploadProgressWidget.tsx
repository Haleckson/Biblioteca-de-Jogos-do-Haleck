import React, { useEffect, useState } from "react";
import { Upload, ChevronDown, ChevronUp, CheckCircle, AlertCircle, Loader2, Pause, Play, X, Trash2, CloudUpload, HardDrive, Video, LogIn } from "lucide-react";
import { mediaUploadQueueManager, UploadBatchTask } from "../utils/mediaUploadManager";
import { isDriveAuthenticated, signInWithGoogleDrive, isPopupCancelledOrClosedError } from "../utils/googleDrive";

export function GlobalUploadProgressWidget() {
  const [tasks, setTasks] = useState<UploadBatchTask[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isAuth, setIsAuth] = useState(isDriveAuthenticated());

  useEffect(() => {
    setIsAuth(isDriveAuthenticated());
    const unsubscribe = mediaUploadQueueManager.subscribe((newTasks) => {
      setTasks(newTasks);
      setIsPaused(mediaUploadQueueManager.getIsPaused());
      setIsAuth(isDriveAuthenticated());
    });
    return () => unsubscribe();
  }, []);

  // Update Browser Tab Title with live progress for background tabs
  useEffect(() => {
    if (tasks.length === 0) {
      document.title = "Game Log - Seu Diário de Jogos";
      return;
    }

    const activeTasks = tasks.filter((t) => t.status === "uploading" || t.status === "pending" || t.status === "paused");
    if (activeTasks.length === 0) {
      document.title = "✅ (100%) Concluído - Game Log";
      const timer = setTimeout(() => {
        document.title = "Game Log - Seu Diário de Jogos";
      }, 4000);
      return () => clearTimeout(timer);
    }

    const isDrive = activeTasks.some((t) => t.type === "drive_backup");
    const totalCount = activeTasks.reduce((sum, t) => sum + (t.totalCount || 1), 0);
    const completedCount = activeTasks.reduce((sum, t) => sum + t.completedCount, 0);
    const percent = totalCount > 0 ? Math.min(100, Math.round((completedCount / totalCount) * 100)) : 0;

    if (isPaused) {
      document.title = `⏸️ (${percent}%) Pausado - Game Log`;
    } else if (isDrive) {
      document.title = `☁️ (${percent}%) Backup Drive... - Game Log`;
    } else {
      document.title = `⏳ (${percent}%) Upload (${completedCount}/${totalCount}) - Game Log`;
    }
  }, [tasks, isPaused]);

  if (tasks.length === 0) return null;

  const currentTask = tasks.find((t) => t.status === "uploading" || t.status === "paused") || tasks[0];
  const pendingTasksCount = tasks.filter((t) => t.status === "pending" || t.status === "uploading" || t.status === "paused").length;

  const totalFiles = tasks.reduce((sum, t) => sum + t.totalCount, 0);
  const completedFiles = tasks.reduce((sum, t) => sum + t.completedCount, 0);
  const overallPercent = totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0;
  const isDriveTask = currentTask?.type === "drive_backup";

  const handleTogglePause = () => {
    mediaUploadQueueManager.togglePauseQueue();
    setIsPaused(mediaUploadQueueManager.getIsPaused());
  };

  const handleCancelTask = (taskId: string) => {
    mediaUploadQueueManager.cancelTask(taskId);
  };

  const handleCancelAll = () => {
    if (confirm("Deseja mesmo cancelar todas as tarefas da fila?")) {
      mediaUploadQueueManager.cancelAllTasks();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 transition-all duration-300 animate-slideUp">
      {isMinimized ? (
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-zinc-950/95 border shadow-2xl backdrop-blur-md transition-all cursor-pointer group ${
            isDriveTask ? "border-emerald-500/50 text-emerald-300 hover:border-emerald-400" : "border-cyan-500/50 text-cyan-300 hover:border-cyan-400"
          }`}
          title="Clique para expandir o progresso"
        >
          {isPaused ? (
            <div className="flex items-center gap-1 text-amber-400">
              <Pause size={14} />
              <span className="text-xs font-bold font-mono">Pausado</span>
            </div>
          ) : (
            <div className="relative flex items-center">
              {isDriveTask ? (
                <CloudUpload size={16} className="text-emerald-400 animate-pulse" />
              ) : (
                <Loader2 size={16} className="text-cyan-400 animate-spin" />
              )}
            </div>
          )}
          <span className="text-xs font-bold font-mono">
            ({completedFiles}/{totalFiles})
          </span>
          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border ${
            isDriveTask ? "text-emerald-400 bg-emerald-950 border-emerald-800" : "text-cyan-400 bg-cyan-950 border-cyan-800"
          }`}>
            {overallPercent}%
          </span>
          <ChevronUp size={14} className="text-zinc-400 group-hover:text-white" />
        </button>
      ) : (
        <div className="w-[380px] sm:w-[520px] max-w-[calc(100vw-2rem)] rounded-2xl bg-zinc-950/95 border border-cyan-500/40 shadow-2xl backdrop-blur-md p-4 text-left space-y-3 font-sans">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`p-1.5 rounded-lg border shrink-0 ${
                isDriveTask ? "bg-emerald-950 border-emerald-500/40 text-emerald-300" : "bg-cyan-950 border-cyan-500/40 text-cyan-300"
              }`}>
                {isDriveTask ? <HardDrive size={14} className={isPaused ? "" : "animate-pulse"} /> : <Upload size={14} className={isPaused ? "" : "animate-bounce"} />}
              </div>
              <div className="min-w-0">
                <h4 className={`text-xs font-black uppercase tracking-wider font-mono flex items-center gap-1.5 flex-wrap ${
                  isDriveTask ? "text-emerald-300" : "text-cyan-300"
                }`}>
                  {isDriveTask ? "Backup Google Drive" : "Fila de Uploads"}
                  {isPaused && (
                    <span className="text-[9px] font-bold text-amber-400 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800">
                      PAUSADO
                    </span>
                  )}
                </h4>
                <p className="text-[10px] text-zinc-400 font-mono break-words leading-tight">
                  Navegue livremente pelo site • {pendingTasksCount} {pendingTasksCount === 1 ? "tarefa" : "tarefas"}
                </p>
              </div>
            </div>

            {/* Quick Header Actions: Pause/Play, Cancel All, Minimize */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleTogglePause}
                className={`p-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                  isPaused
                    ? "bg-emerald-950 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900 hover:text-white"
                    : "bg-amber-950/80 border-amber-500/50 text-amber-300 hover:bg-amber-900 hover:text-white"
                }`}
                title={isPaused ? "Continuar tarefas" : "Pausar tarefas"}
              >
                {isPaused ? <Play size={13} fill="currentColor" /> : <Pause size={13} fill="currentColor" />}
              </button>

              <button
                type="button"
                onClick={handleCancelAll}
                className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all cursor-pointer"
                title="Cancelar todas as tarefas da fila"
              >
                <Trash2 size={13} />
              </button>

              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Minimizar barra de progresso"
              >
                <ChevronDown size={15} />
              </button>
            </div>
          </div>

          {/* Current Active Task details */}
          {currentTask && (
            <div className="space-y-2 text-xs">
              <div className="flex items-start justify-between font-mono gap-2">
                <span className="text-zinc-300 font-bold break-words leading-snug flex-1 min-w-0" title={currentTask.gameName}>
                  {currentTask.type === "drive_backup" ? "☁️ " : "🎮 "}{currentTask.gameName}
                </span>
                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                  <span className={`font-extrabold text-[11px] px-2 py-0.5 rounded border ${
                    currentTask.type === "drive_backup" ? "text-emerald-400 bg-emerald-950/80 border-emerald-800" : "text-cyan-400 bg-cyan-950/80 border-cyan-800"
                  }`}>
                    {currentTask.completedCount} / {currentTask.totalCount} ({Math.round((currentTask.completedCount / currentTask.totalCount) * 100)}%)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCancelTask(currentTask.id)}
                    className="p-1 rounded bg-zinc-900 text-zinc-400 hover:text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
                    title="Cancelar esta tarefa"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2.5 rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden relative">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    isPaused
                      ? "bg-amber-500"
                      : currentTask.type === "drive_backup"
                      ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400"
                      : "bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-400"
                  }`}
                  style={{
                    width: `${Math.round((currentTask.completedCount / currentTask.totalCount) * 100)}%`,
                  }}
                />
              </div>

              <div className="flex items-start justify-between text-[10px] text-zinc-400 font-mono gap-2 pt-0.5">
                <span className="break-words leading-relaxed flex-1 min-w-0 pr-2" title={currentTask.currentFileName}>
                  {currentTask.type === "drive_backup" ? "📂 " : "📄 "}{currentTask.currentFileName || "Processando..."}
                </span>
                <div className="shrink-0">
                  {isPaused ? (
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      <Pause size={10} /> Pausado
                    </span>
                  ) : currentTask.status === "completed" ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle size={10} /> Concluído
                    </span>
                  ) : currentTask.status === "error" ? (
                    <span className="text-pink-400 font-bold flex items-center gap-1">
                      <AlertCircle size={10} /> Erro
                    </span>
                  ) : (
                    <span className={`${currentTask.type === "drive_backup" ? "text-emerald-400" : "text-cyan-400"} animate-pulse font-semibold`}>
                      Em progresso...
                    </span>
                  )}
                </div>
              </div>

              {/* Special Summary Component for Video Upload Tasks */}
              {currentTask.items.some((item) => item.isVideo) && (
                <div className="mt-2.5 p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs space-y-2">
                  <div className="flex items-center justify-between text-purple-300 font-semibold font-mono">
                    <span className="flex items-center gap-1.5">
                      <Video size={13} className="text-purple-400 animate-pulse" />
                      Processamento de Vídeo YouTube
                    </span>
                    <span className="text-[10px] bg-purple-900/80 px-2 py-0.5 rounded text-purple-200 border border-purple-700">
                      Auto-Playlist & Atalho Drive
                    </span>
                  </div>

                  {!isAuth && (
                    <div className="flex items-center justify-between bg-amber-950/80 border border-amber-600/50 p-2 rounded-lg text-amber-200 text-[11px] font-mono">
                      <span className="flex items-center gap-1.5">
                        <AlertCircle size={13} className="text-amber-400 shrink-0" />
                        Autenticação do YouTube/Drive necessária
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await signInWithGoogleDrive();
                            setIsAuth(true);
                          } catch (err: any) {
                            if (isPopupCancelledOrClosedError(err)) {
                              console.info("[Widget] Autenticação Google cancelada pelo usuário.");
                            } else {
                              console.warn("[Widget] Aviso ao autenticar Google:", err);
                            }
                          }
                        }}
                        className="flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-2 py-1 rounded cursor-pointer transition-colors shrink-0"
                      >
                        <LogIn size={11} /> Conectar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Queue summary footer */}
          {tasks.length > 1 && (
            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
              <span>Total acumulado: {completedFiles}/{totalFiles} itens</span>
              <span className="text-purple-300 font-bold">+{tasks.length - 1} na fila</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
