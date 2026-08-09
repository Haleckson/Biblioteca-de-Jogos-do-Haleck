/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  Trash2,
  BellRing,
  Trophy,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import {
  ToastMessage,
  subscribeToToasts,
  dismissToast,
  clearAllToasts,
} from "../utils/toast";

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToToasts((updatedToasts) => {
      setToasts(updatedToasts);
    });
    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[999999] flex flex-col items-start gap-2 max-w-sm sm:max-w-md w-[calc(100vw-2rem)] pointer-events-none p-1">
      {/* Header bar when toasts exist */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        className="pointer-events-auto flex items-center justify-between w-full px-3 py-1.5 rounded-xl bg-zinc-950/90 border border-zinc-800/80 shadow-xl backdrop-blur-md text-xs font-semibold text-zinc-300 mb-0.5"
      >
        <div className="flex items-center gap-1.5 text-cyan-400">
          <BellRing size={14} className="animate-pulse" />
          <span className="font-mono">{toasts.length} Notificaçõ{toasts.length > 1 ? "es" : "ão"}</span>
        </div>
        <button
          type="button"
          onClick={clearAllToasts}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-white text-zinc-400 transition-all cursor-pointer font-sans text-[11px] font-semibold active:scale-95"
          title="Fechar todas as notificações na tela"
        >
          <Trash2 size={12} className="text-zinc-400" />
          <span>Fechar Todos ({toasts.length})</span>
        </button>
      </motion.div>

      {/* Scrollable list bounded to max-h-[70vh] */}
      <div className="w-full flex flex-col gap-2 max-h-[70vh] overflow-y-auto pr-1 pointer-events-auto custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => {
            const getBadgeDetails = () => {
              switch (toast.type) {
                case "error":
                  return {
                    icon: <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />,
                    border: "border-red-500/40 bg-zinc-950/95 text-red-200 shadow-red-950/30",
                    badge: "bg-red-950/80 text-red-400 border-red-500/30",
                  };
                case "warning":
                  return {
                    icon: <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />,
                    border: "border-amber-500/40 bg-zinc-950/95 text-amber-200 shadow-amber-950/30",
                    badge: "bg-amber-950/80 text-amber-400 border-amber-500/30",
                  };
                case "achievement":
                  return {
                    icon: (
                      <div className="relative shrink-0 mt-0.5">
                        <Trophy size={20} className="text-amber-400 animate-bounce" />
                        <Sparkles size={12} className="text-yellow-300 absolute -top-1 -right-1 animate-pulse" />
                      </div>
                    ),
                    border: "border-amber-400/60 bg-gradient-to-r from-amber-950/95 via-zinc-950/95 to-yellow-950/90 text-amber-100 shadow-xl shadow-amber-500/20",
                    badge: "bg-amber-500/20 text-amber-300 border-amber-400/40",
                    isAchievement: true,
                  };
                case "success":
                  return {
                    icon: <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />,
                    border: "border-emerald-500/40 bg-zinc-950/95 text-emerald-200 shadow-emerald-950/30",
                    badge: "bg-emerald-950/80 text-emerald-400 border-emerald-500/30",
                  };
                case "info":
                default:
                  return {
                    icon: <Info size={18} className="text-cyan-400 shrink-0 mt-0.5" />,
                    border: "border-cyan-500/40 bg-zinc-950/95 text-cyan-200 shadow-cyan-950/30",
                    badge: "bg-cyan-950/80 text-cyan-400 border-cyan-500/30",
                  };
              }
            };

            const style = getBadgeDetails();

            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: -50, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className={`w-full glass rounded-2xl p-3.5 shadow-2xl border ${style.border} backdrop-blur-xl flex items-start gap-3 relative group overflow-hidden`}
              >
                {style.isAchievement && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 animate-pulse" />
                    <motion.div
                      animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.3, 0.7, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute -top-6 -right-6 w-20 h-20 bg-amber-400/20 rounded-full blur-xl"
                    />
                  </div>
                )}
                {style.icon}

                <div className="min-w-0 flex-1 pr-5">
                  <h5 className="font-bold text-xs text-white leading-tight flex items-center gap-2">
                    <span>{toast.title}</span>
                  </h5>
                  <p className="text-[11.5px] text-zinc-300 mt-1 leading-relaxed whitespace-pre-line break-words">
                    {toast.message}
                  </p>
                  {toast.action && (
                    <div className="mt-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          toast.action?.onClick();
                          dismissToast(toast.id);
                        }}
                        className="px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw size={12} className="text-cyan-400" />
                        <span>{toast.action.label}</span>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="absolute top-2.5 right-2.5 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800/80 transition-colors cursor-pointer"
                  title="Fechar notificação"
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
