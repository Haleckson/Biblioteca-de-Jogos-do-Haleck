import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Database,
  RefreshCw,
  Copy,
  X,
  Folder,
  Layers,
  ShieldCheck,
  Info,
  Check,
  Trash2,
  AlertCircle,
  FileText,
  Clock,
  Film,
  Upload,
} from "lucide-react";
import { DiagnosticResult } from "../utils/syncDiagnostic";
import { useBodyScrollLock } from "../lib/bodyScrollLock";
import { getFailedUploadLogs, clearFailedUploadLogs, FailedUploadLog } from "../utils/failedUploadLogs";
import { getBackupLogs, clearBackupLogs, BackupOperationLog } from "../utils/backupAuditLog";
import { getSyncQueue, clearSyncQueue, processSyncQueue, SyncQueueItem } from "../utils/syncQueue";

interface SyncDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: DiagnosticResult | null;
  isLoading?: boolean;
  onReRun?: () => void;
  onSyncDriveNow?: () => void;
}

export function SyncDiagnosticModal({
  isOpen,
  onClose,
  result,
  isLoading = false,
  onReRun,
  onSyncDriveNow,
}: SyncDiagnosticModalProps) {
  useBodyScrollLock(isOpen);
  const [activeTab, setActiveTab] = useState<"audit" | "timeline" | "queue">("audit");
  const [filter, setFilter] = useState<"all" | "firebase" | "drive" | "media">("all");
  const [copied, setCopied] = useState(false);
  const [failedLogs, setFailedLogs] = useState<FailedUploadLog[]>(() => getFailedUploadLogs());
  const [backupLogs, setBackupLogs] = useState<BackupOperationLog[]>(() => getBackupLogs());
  const [syncQueueItems, setSyncQueueItems] = useState<SyncQueueItem[]>(() => getSyncQueue());
  const [isRetryingQueue, setIsRetryingQueue] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBackupLogs(getBackupLogs());
      setSyncQueueItems(getSyncQueue());
    }

    const handleLogAdded = () => {
      setBackupLogs(getBackupLogs());
    };

    const handleQueueChanged = () => {
      setSyncQueueItems(getSyncQueue());
    };

    if (typeof window !== "undefined") {
      window.addEventListener("backup_log_added", handleLogAdded);
      window.addEventListener("backup_logs_cleared", handleLogAdded);
      window.addEventListener("SYNC_QUEUE_CHANGED", handleQueueChanged);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("backup_log_added", handleLogAdded);
        window.removeEventListener("backup_logs_cleared", handleLogAdded);
        window.removeEventListener("SYNC_QUEUE_CHANGED", handleQueueChanged);
      }
    };
  }, [isOpen]);

  const handleClearLogs = () => {
    clearFailedUploadLogs();
    setFailedLogs([]);
  };

  const handleClearAuditLogs = () => {
    clearBackupLogs();
    setBackupLogs([]);
  };

  if (!isOpen) return null;

  const discrepancies = result?.discrepancies || [];

  const filteredDiscrepancies = discrepancies.filter((d) => {
    if (filter === "firebase") return d.type === "missing_in_firebase";
    if (filter === "drive") return d.type === "missing_in_drive" || d.type === "orphaned_in_drive";
    if (filter === "media") return d.type === "media_mismatch";
    return true;
  });

  const countFirebase = discrepancies.filter((d) => d.type === "missing_in_firebase").length;
  const countDrive = discrepancies.filter((d) => d.type === "missing_in_drive" || d.type === "orphaned_in_drive").length;
  const countMedia = discrepancies.filter((d) => d.type === "media_mismatch").length;

  const handleCopyReport = () => {
    if (!result) return;
    const reportText =
      `==================================================\n` +
      `RELATÓRIO DE AUDITORIA DIAGNÓSTICA DE SINCRONIA\n` +
      `Data/Hora: ${result.timestamp}\n` +
      `==================================================\n\n` +
      `RESUMO:\n${result.summary}\n\n` +
      `ESTATÍSTICAS:\n` +
      `• Jogos Locais: ${result.localGamesCount}\n` +
      `• Registros Firebase: ${result.firebaseGamesCount ?? "N/A / Não conectado"}\n` +
      `• Pastas Google Drive: ${result.driveFoldersCount ?? "N/A / Não verificado"}\n` +
      `• Total de Inconsistências: ${discrepancies.length}\n\n` +
      `DETALHES DAS INCONSISTÊNCIAS:\n` +
      (discrepancies.length > 0
        ? discrepancies.map((d, i) => `${i + 1}. [${d.type.toUpperCase()}] ${d.gameName ? `(${d.gameName}) ` : ""}${d.details}`).join("\n")
        : "Nenhuma divergência identificada! Todos os sistemas sincronizados.") +
      `\n\n==================================================\n` +
      `Gerado por Biblioteca do Haleck - Sistema de Auditoria`;

    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isPerfect = discrepancies.length === 0 && !isLoading;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/85 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative z-10 w-full max-w-2xl max-h-[90vh] bg-zinc-950 border border-cyan-500/30 rounded-3xl p-5 sm:p-6 flex flex-col shadow-2xl text-zinc-100 overflow-hidden"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-3 rounded-2xl shrink-0 ${isPerfect ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30" : "bg-cyan-950/60 text-cyan-400 border border-cyan-500/30"}`}>
                {isPerfect ? <ShieldCheck size={24} /> : <Database size={24} />}
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 flex-wrap">
                  Auditoria Diagnóstica
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                    Sincronia Multi-Backend
                  </span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5 truncate">
                  Inspeção em tempo real entre Banco Local, Firebase e Google Drive
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Tab Selector */}
              <div className="flex items-center bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab("audit")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "audit" ? "bg-cyan-500 text-zinc-950 shadow-md" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <ShieldCheck size={13} />
                  Divergências
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("timeline")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "timeline" ? "bg-cyan-500 text-zinc-950 shadow-md" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Clock size={13} />
                  Linha do Tempo
                  {backupLogs.length > 0 && (
                    <span className="text-[10px] bg-zinc-950/80 px-1.5 py-0.2 rounded-full border border-cyan-400/40 font-mono">
                      {backupLogs.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("queue")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "queue" ? "bg-cyan-500 text-zinc-950 shadow-md" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <RefreshCw size={13} />
                  Fila Offline
                  {syncQueueItems.length > 0 && (
                    <span className="text-[10px] bg-amber-500 text-zinc-950 px-1.5 py-0.2 rounded-full font-bold font-mono animate-pulse">
                      {syncQueueItems.length}
                    </span>
                  )}
                </button>
              </div>

              <button
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar my-4 pr-1 space-y-4">
            {activeTab === "timeline" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                      <Clock size={14} className="text-cyan-400" />
                      Linha do Tempo de Operações de Backup ({backupLogs.length})
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      Registro de todas as requisições para ImgBB, Google Drive e YouTube.
                    </p>
                  </div>
                  {backupLogs.length > 0 && (
                    <button
                      onClick={handleClearAuditLogs}
                      className="px-2.5 py-1 bg-zinc-900 hover:bg-red-950/60 hover:border-red-500/40 border border-zinc-800 text-zinc-400 hover:text-red-300 rounded-lg text-[10px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
                      title="Limpar histórico da linha do tempo"
                    >
                      <Trash2 size={12} />
                      Limpar
                    </button>
                  )}
                </div>

                {backupLogs.length === 0 ? (
                  <div className="py-12 text-center text-zinc-500 text-xs space-y-2">
                    <Clock size={28} className="mx-auto text-zinc-600 animate-pulse" />
                    <p>Nenhuma operação de backup registrada recentemente.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {backupLogs.map((log) => {
                      const timeStr = new Date(log.timestamp).toLocaleTimeString("pt-BR");
                      const isSuccess = log.status === "success";
                      const isWarn = log.status === "warning";

                      return (
                        <div
                          key={log.id}
                          className="p-3 bg-zinc-900/80 border border-zinc-800/80 rounded-xl text-xs space-y-1 hover:border-zinc-700 transition-all font-mono"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${
                                  log.provider === "YouTube"
                                    ? "bg-red-950 text-red-300 border border-red-800"
                                    : log.provider === "Google Drive"
                                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                    : log.provider === "ImgBB"
                                    ? "bg-cyan-950 text-cyan-300 border border-cyan-800"
                                    : "bg-purple-950 text-purple-300 border border-purple-800"
                                }`}
                              >
                                {log.provider}
                              </span>
                              <span className="font-bold text-white text-[11px]">{log.action}</span>
                              {log.gameName && (
                                <span className="text-zinc-400 text-[10px]">({log.gameName})</span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  isSuccess
                                    ? "text-emerald-400 bg-emerald-950/80"
                                    : isWarn
                                    ? "text-amber-400 bg-amber-950/80"
                                    : "text-red-400 bg-red-950/80"
                                }`}
                              >
                                {isSuccess ? "SUCESSO" : isWarn ? "AVISO" : "ERRO"}
                              </span>
                              <span className="text-[10px] text-zinc-500">{timeStr}</span>
                            </div>
                          </div>

                          <p className="text-zinc-300 text-[11px] leading-relaxed break-words font-sans pt-0.5">
                            {log.details}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : isLoading ? (
              <div className="py-16 text-center space-y-4">
                <RefreshCw size={36} className="animate-spin text-cyan-400 mx-auto" />
                <div>
                  <h4 className="text-sm font-bold text-white">Executando Auditoria Diagnóstica...</h4>
                  <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                    Inspecionando banco local, consultando nós do Firebase e varrendo diretórios no Google Drive.
                  </p>
                </div>
              </div>
            ) : result ? (
              <>
                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl text-center">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 flex items-center justify-center gap-1">
                      <Layers size={12} className="text-cyan-400" />
                      Locais
                    </span>
                    <span className="block text-xl font-black text-white mt-1">
                      {result.localGamesCount}
                    </span>
                  </div>

                  <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl text-center">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 flex items-center justify-center gap-1">
                      <Database size={12} className="text-amber-400" />
                      Firebase
                    </span>
                    <span className="block text-xl font-black text-white mt-1">
                      {result.firebaseGamesCount !== undefined ? result.firebaseGamesCount : "N/A"}
                    </span>
                  </div>

                  <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl text-center">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 flex items-center justify-center gap-1">
                      <HardDrive size={12} className="text-purple-400" />
                      Google Drive
                    </span>
                    <span className="block text-xl font-black text-white mt-1">
                      {result.driveFoldersCount !== undefined ? result.driveFoldersCount : "N/A"}
                    </span>
                  </div>

                  <div className={`p-3 border rounded-2xl text-center ${discrepancies.length > 0 ? "bg-amber-950/30 border-amber-500/40" : "bg-emerald-950/30 border-emerald-500/40"}`}>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 flex items-center justify-center gap-1">
                      <AlertTriangle size={12} className={discrepancies.length > 0 ? "text-amber-400" : "text-emerald-400"} />
                      Divergências
                    </span>
                    <span className={`block text-xl font-black mt-1 ${discrepancies.length > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                      {discrepancies.length}
                    </span>
                  </div>
                </div>

                {/* Summary Banner */}
                <div className={`p-3.5 rounded-2xl border flex items-start gap-3 ${discrepancies.length > 0 ? "bg-amber-950/20 border-amber-500/30 text-amber-200" : "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"}`}>
                  {discrepancies.length > 0 ? (
                    <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs leading-relaxed font-medium">
                    {result.summary}
                  </div>
                </div>

                {/* Filters */}
                {discrepancies.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <button
                      onClick={() => setFilter("all")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${filter === "all" ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/20" : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400"}`}
                    >
                      Todas ({discrepancies.length})
                    </button>
                    {countFirebase > 0 && (
                      <button
                        onClick={() => setFilter("firebase")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${filter === "firebase" ? "bg-amber-500 text-black shadow-md shadow-amber-500/20" : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400"}`}
                      >
                        Firebase ({countFirebase})
                      </button>
                    )}
                    {countDrive > 0 && (
                      <button
                        onClick={() => setFilter("drive")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${filter === "drive" ? "bg-purple-500 text-white shadow-md shadow-purple-500/20" : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400"}`}
                      >
                        Google Drive ({countDrive})
                      </button>
                    )}
                    {countMedia > 0 && (
                      <button
                        onClick={() => setFilter("media")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${filter === "media" ? "bg-pink-500 text-white shadow-md shadow-pink-500/20" : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400"}`}
                      >
                        Mídias & Mapeamento ({countMedia})
                      </button>
                    )}
                  </div>
                )}

                {/* Discrepancies Scrollable List */}
                {filteredDiscrepancies.length > 0 ? (
                  <div className="space-y-2.5 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">
                    {filteredDiscrepancies.map((item, idx) => {
                      const isFb = item.type === "missing_in_firebase";
                      const isDriveMissing = item.type === "missing_in_drive";
                      const isDriveOrphan = item.type === "orphaned_in_drive";

                      return (
                        <div
                          key={idx}
                          className="p-3 bg-zinc-900/70 border border-zinc-800/80 rounded-2xl hover:border-zinc-700 transition-all text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider ${
                                isFb
                                  ? "bg-amber-950/80 text-amber-300 border border-amber-500/30"
                                  : isDriveMissing
                                  ? "bg-purple-950/80 text-purple-300 border border-purple-500/30"
                                  : isDriveOrphan
                                  ? "bg-indigo-950/80 text-indigo-300 border border-indigo-500/30"
                                  : "bg-pink-950/80 text-pink-300 border border-pink-500/30"
                              }`}
                            >
                              {isFb ? "Firebase" : isDriveMissing ? "Drive Ausente" : isDriveOrphan ? "Drive Órfão" : "Mídia / Arquivo"}
                            </span>

                            {item.gameName && (
                              <span className="text-zinc-300 font-bold truncate max-w-[200px]">
                                🎮 {item.gameName}
                              </span>
                            )}
                          </div>

                          <p className="text-zinc-300 leading-relaxed font-normal">
                            {item.details}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : discrepancies.length > 0 ? (
                  <div className="py-8 text-center text-zinc-500 text-xs">
                    Nenhuma divergência encontrada nesta categoria.
                  </div>
                ) : (
                  <div className="py-10 text-center space-y-3 bg-emerald-950/10 border border-emerald-500/20 rounded-2xl p-4">
                    <CheckCircle2 size={32} className="text-emerald-400 mx-auto" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-300">Tudo Sincronizado Perfeitamente!</h4>
                      <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                        A verificação cruzada não encontrou nenhuma discrepância entre seus dados locais, nuvem Firebase e estrutura de pastas do Google Drive.
                      </p>
                    </div>
                  </div>
                )}
                {/* Failed Upload Logs Section */}
                {failedLogs.length > 0 && (
                  <div className="mt-4 p-3.5 bg-red-950/20 border border-red-500/30 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={16} className="text-red-400 shrink-0" />
                        <h4 className="text-xs font-bold text-red-200 uppercase tracking-wider">
                          Logs de Mídias/Uploads Falhos ({failedLogs.length})
                        </h4>
                      </div>
                      <button
                        onClick={handleClearLogs}
                        className="px-2.5 py-1 bg-red-900/40 hover:bg-red-900/70 border border-red-500/30 text-red-200 rounded-lg text-[10px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
                        title="Limpar logs de erro"
                      >
                        <Trash2 size={12} />
                        Limpar Logs
                      </button>
                    </div>

                    <p className="text-[11px] text-zinc-400">
                      Arquivos que excederam as tentativas silenciosas de reenvio para o ImgBB:
                    </p>

                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                      {failedLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl text-[11px] space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-white truncate max-w-[220px]">
                              📄 {log.fileName}
                            </span>
                            <span className="text-[9px] text-zinc-400 shrink-0">
                              {log.timestamp}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-zinc-400 text-[10px]">
                            <span>🎮 {log.gameName}</span>
                            {log.fileSize && (
                              <span>{(log.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                            )}
                          </div>
                          <p className="text-red-300/90 text-[10px] font-mono bg-red-950/30 p-1 rounded border border-red-900/30">
                            {log.errorMessage}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : activeTab === "queue" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                      <RefreshCw size={14} className="text-cyan-400" />
                      Fila de Sincronização Pendente ({syncQueueItems.length})
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      Operações armazenadas no localStorage em caso de falha de conexão ou modo offline.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {syncQueueItems.length > 0 && (
                      <button
                        onClick={async () => {
                          setIsRetryingQueue(true);
                          await processSyncQueue();
                          setSyncQueueItems(getSyncQueue());
                          setIsRetryingQueue(false);
                        }}
                        disabled={isRetryingQueue}
                        className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw size={12} className={isRetryingQueue ? "animate-spin" : ""} />
                        Sincronizar Agora
                      </button>
                    )}
                    {syncQueueItems.length > 0 && (
                      <button
                        onClick={() => {
                          clearSyncQueue();
                          setSyncQueueItems([]);
                        }}
                        className="px-2.5 py-1 bg-zinc-900 hover:bg-red-950/60 hover:border-red-500/40 border border-zinc-800 text-zinc-400 hover:text-red-300 rounded-lg text-[10px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={12} />
                        Limpar Fila
                      </button>
                    )}
                  </div>
                </div>

                {syncQueueItems.length === 0 ? (
                  <div className="p-6 text-center bg-zinc-900/40 rounded-2xl border border-zinc-800/80">
                    <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-2" />
                    <p className="text-xs font-bold text-zinc-200">Fila Vazia!</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Não há nenhuma operação de salvamento pendente. Todos os seus dados estão em dia.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {syncQueueItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-zinc-900/60 border border-amber-500/30 rounded-xl space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between font-mono text-[11px]">
                          <span className="font-bold text-amber-300 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            {item.type}
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            {new Date(item.timestamp).toLocaleString("pt-BR")}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-zinc-300 text-[11px] pt-1 border-t border-zinc-800/60">
                          <span>🎮 {item.payload?.games?.length || 0} Jogos no Pacote</span>
                          <span className="text-[10px] font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                            Tentativas: {item.attempts}
                          </span>
                        </div>

                        {item.lastError && (
                          <div className="mt-1 text-[10px] text-red-300 font-mono bg-red-950/40 p-1.5 rounded border border-red-900/40">
                            Última Falha: {item.lastError}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {onReRun && (
                <button
                  onClick={onReRun}
                  disabled={isLoading}
                  className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                  Refazer Auditoria
                </button>
              )}

              {result && (
                <button
                  onClick={handleCopyReport}
                  className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  {copied ? "Copiado!" : "Copiar Relatório"}
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-700 hover:to-cyan-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-cyan-500/20 cursor-pointer"
            >
              Concluir
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
