import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Trash2,
  X,
  RotateCcw,
  Gamepad2,
  BookOpen,
  Image as ImageIcon,
  AlertTriangle,
  Sparkles,
  Check,
} from "lucide-react";
import { TrashItem } from "../types";
import {
  getTrashItems,
  subscribeToTrash,
  restoreTrashItem,
  deleteTrashItemPermanently,
  clearTrash,
} from "../utils/trashService";
import { showToast } from "../utils/toast";
import { playRetroSound } from "../utils/audioEffects";

interface TrashModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreGame: (game: any) => void;
  onRestoreDiaryEntry: (gameId: string, entry: any) => void;
  onRestoreMedia: (gameId: string, diaryEntryId: string, media: any) => void;
}

export default function TrashModal({
  isOpen,
  onClose,
  onRestoreGame,
  onRestoreDiaryEntry,
  onRestoreMedia,
}: TrashModalProps) {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [filterType, setFilterType] = useState<"all" | "game" | "diary_entry" | "media">("all");
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeToTrash((updated) => setItems(updated));
    return unsub;
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredItems = filterType === "all" ? items : items.filter((i) => i.type === filterType);

  const handleRestore = (item: TrashItem) => {
    const restored = restoreTrashItem(item.id);
    if (!restored) return;

    playRetroSound("undo");

    if (item.type === "game") {
      onRestoreGame(item.data);
      showToast({
        title: "Jogo Restaurado 🎮",
        message: `"${item.title}" foi devolvido ao catálogo!`,
        type: "success",
      });
    } else if (item.type === "diary_entry" && item.gameId) {
      onRestoreDiaryEntry(item.gameId, item.data);
      showToast({
        title: "Diário Restaurado 📖",
        message: `Entrada "${item.title}" foi devolvida ao diário!`,
        type: "success",
      });
    } else if (item.type === "media" && item.gameId && item.diaryEntryId) {
      onRestoreMedia(item.gameId, item.diaryEntryId, item.data);
      showToast({
        title: "Mídia Restaurada 📸",
        message: `Imagem/Mídia devolvida à entrada do diário!`,
        type: "success",
      });
    }
  };

  const handleDeletePermanently = (item: TrashItem) => {
    deleteTrashItemPermanently(item.id);
    playRetroSound("delete");
    showToast({
      title: "Excluído Definitivamente 🗑️",
      message: `"${item.title}" foi removido para sempre.`,
      type: "info",
    });
  };

  const handleClearAll = () => {
    clearTrash();
    setConfirmClear(false);
    playRetroSound("delete");
    showToast({
      title: "Lixeira Esvaziada 🧹",
      message: "Todos os itens da lixeira foram removidos.",
      type: "info",
    });
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span>Lixeira & Exclusões Suaves</span>
                  <span className="px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 font-mono font-bold">
                    {items.length}
                  </span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Itens apagados ficam salvos aqui para restauração rápida.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Filters & Actions bar */}
          <div className="px-4 sm:px-5 py-3 border-b border-zinc-800/60 bg-zinc-950 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
              {[
                { id: "all", label: "Todos", count: items.length },
                { id: "game", label: "Jogos", count: items.filter((i) => i.type === "game").length },
                { id: "diary_entry", label: "Diários", count: items.filter((i) => i.type === "diary_entry").length },
                { id: "media", label: "Mídias", count: items.filter((i) => i.type === "media").length },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterType === f.id
                      ? "bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/20"
                      : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-800"
                  }`}
                >
                  <span>{f.label}</span>
                  <span className="opacity-75 font-mono text-[10px]">({f.count})</span>
                </button>
              ))}
            </div>

            {items.length > 0 && (
              <div>
                {confirmClear ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-400 font-medium">Tem certeza?</span>
                    <button
                      onClick={handleClearAll}
                      className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
                    >
                      Sim, Esvaziar
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 size={13} />
                    <span>Esvaziar Lixeira</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* List Content */}
          <div className="p-4 sm:p-5 flex-1 overflow-y-auto custom-scrollbar space-y-3">
            {filteredItems.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center justify-center text-zinc-500">
                <Trash2 size={40} className="stroke-[1.5] mb-2 opacity-40 text-zinc-400" />
                <p className="text-sm font-semibold text-zinc-300">Lixeira Vazia</p>
                <p className="text-xs text-zinc-500 mt-1">Nenhum item excluído encontrado nesta categoria.</p>
              </div>
            ) : (
              filteredItems.map((item) => {
                const getItemIcon = () => {
                  switch (item.type) {
                    case "game":
                      return <Gamepad2 size={18} className="text-cyan-400" />;
                    case "diary_entry":
                      return <BookOpen size={18} className="text-amber-400" />;
                    case "media":
                      return <ImageIcon size={18} className="text-emerald-400" />;
                  }
                };

                const getTypeLabel = () => {
                  switch (item.type) {
                    case "game":
                      return "Jogo";
                    case "diary_entry":
                      return "Diário";
                    case "media":
                      return "Mídia / Imagem";
                  }
                };

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 shrink-0 mt-0.5">
                        {getItemIcon()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
                            {getTypeLabel()}
                          </span>
                          {item.gameTitle && (
                            <span className="text-xs text-cyan-400 font-semibold truncate">
                              🎮 {item.gameTitle}
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-white mt-1 truncate">{item.title}</h4>
                        <p className="text-[11px] text-zinc-500 mt-0.5 font-mono">
                          Apagado em: {formatDate(item.deletedAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => handleRestore(item)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                        title="Devolver item ao local de origem"
                      >
                        <RotateCcw size={14} />
                        <span>Restaurar</span>
                      </button>
                      <button
                        onClick={() => handleDeletePermanently(item)}
                        className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-red-950/60 hover:text-red-300 text-zinc-400 text-xs font-medium transition-all cursor-pointer flex items-center gap-1"
                        title="Excluir permanentemente"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
