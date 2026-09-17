/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Info, AlertTriangle, Lock, HardDrive, ExternalLink } from "lucide-react";

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
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
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
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed whitespace-pre-line text-left">{message}</p>
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
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
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

interface PasswordPromptProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CustomPasswordPrompt({ isOpen, title, message, onConfirm, onCancel }: PasswordPromptProps) {
  const [passwordInput, setPasswordInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (passwordInput === "159753") {
      setPasswordInput("");
      setErrorMsg("");
      onConfirm();
    } else {
      setErrorMsg("Senha incorreta. Tente novamente.");
    }
  };

  const handleClose = () => {
    setPasswordInput("");
    setErrorMsg("");
    onCancel();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-md glass rounded-3xl p-6 space-y-5 shadow-2xl relative z-10 border border-purple-500/20"
          >
            <>
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-full bg-purple-950/30 text-purple-400 flex items-center justify-center shrink-0">
                  <Lock size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-white text-lg">{title}</h4>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{message}</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    Senha de Acesso
                  </label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (errorMsg) setErrorMsg("");
                    }}
                    placeholder="Digite a senha para autorizar"
                    className={`w-full bg-zinc-950 border ${
                      errorMsg ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/20" : "border-zinc-800 focus:border-purple-500 focus:ring-purple-500/20"
                    } rounded-2xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 transition-all font-mono`}
                    autoFocus
                  />

                  <div className="flex justify-between items-center mt-2.5 min-h-[1.5rem] px-1">
                    <div className="flex-1">
                      {errorMsg && (
                        <motion.p
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-red-400 font-semibold leading-none"
                        >
                          {errorMsg}
                        </motion.p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 px-4 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold hover:bg-zinc-800 transition-all text-sm cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-700 hover:to-cyan-600 transition-all text-white font-bold text-sm shadow-lg shadow-cyan-500/20 cursor-pointer"
                  >
                    Confirmar
                  </button>
                </div>
              </form>
            </>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface DriveConnectPromptProps {
  isOpen: boolean;
  onConnectAndSave: () => void;
  onSaveWithoutDrive: () => void;
  onCancel: () => void;
}

export function CustomDriveConnectPrompt({
  isOpen,
  onConnectAndSave,
  onSaveWithoutDrive,
  onCancel,
}: DriveConnectPromptProps) {
  if (!isOpen) return null;

  const isInIframe = typeof window !== "undefined" && window.self !== window.top;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
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
          className="w-full max-w-md glass rounded-3xl p-6 space-y-5 shadow-2xl relative z-10 border border-cyan-500/30"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-950/60 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <HardDrive size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-white text-lg">Conectar ao Google Drive?</h4>
              <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">
                Você não está conectado ao Google Drive no momento. Deseja se conectar para realizar o backup completo das mídias e metadados na nuvem, ou prefere salvar apenas localmente / Firebase?
              </p>
            </div>
          </div>

          {isInIframe && (
            <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex items-start gap-2.5 text-[11px] text-cyan-200">
              <Info size={14} className="text-cyan-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <span>
                  Ambiente de pré-visualização (iframe) detectado. Se o navegador fechar o pop-up do Google automaticamente, abra o app em uma nova aba:
                </span>
                <a
                  href={typeof window !== "undefined" ? window.location.href : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-cyan-400 hover:text-cyan-300 underline"
                >
                  Abrir App em Nova Aba <ExternalLink size={11} />
                </a>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={onConnectAndSave}
              className="w-full px-4 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 transition-all text-white font-extrabold text-sm shadow-lg shadow-cyan-500/20 cursor-pointer flex items-center justify-center gap-2"
            >
              <HardDrive size={16} />
              Conectar e Fazer Backup
            </button>
            <button
              type="button"
              onClick={onSaveWithoutDrive}
              className="w-full px-4 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white font-bold hover:bg-zinc-800 transition-all text-xs cursor-pointer"
            >
              Salvar Apenas Local / Firebase
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2 text-zinc-500 hover:text-zinc-400 text-xs font-semibold transition-all cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

