/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import { Info, AlertTriangle } from "lucide-react";

interface AlertProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

export function CustomAlert({ isOpen, title, message, onClose }: AlertProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-sm glass rounded-3xl p-6 text-center space-y-4 shadow-2xl relative z-10 border border-cyan-500/20"
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-cyan-950/50 text-cyan-400 flex items-center justify-center">
              <Info size={22} />
            </div>
            <div>
              <h4 className="font-bold text-white text-lg">{title}</h4>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{message}</p>
            </div>
            <button
              onClick={onClose}
              className="w-full px-4 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-700 hover:to-cyan-600 transition-all text-white text-sm font-bold shadow-lg shadow-cyan-500/20"
            >
              Continuar
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface ConfirmProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CustomConfirm({ isOpen, title, message, onConfirm, onCancel }: ConfirmProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-sm glass rounded-3xl p-6 space-y-5 shadow-2xl relative z-10 border border-red-500/20"
          >
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-red-950/30 text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-white text-lg">{title}</h4>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{message}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold hover:bg-zinc-800 transition-all text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 px-4 py-3 rounded-2xl bg-red-600 hover:bg-red-700 transition-all text-white font-bold text-sm"
              >
                Confirmar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
