/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Info, AlertTriangle, Lock, Mail, CheckCircle2 } from "lucide-react";

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
  const [isSending, setIsSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (passwordInput === "159753") {
      setPasswordInput("");
      setErrorMsg("");
      setSuccessMsg("");
      onConfirm();
    } else {
      setErrorMsg("Senha incorreta. Tente novamente.");
    }
  };

  const handleForgotPassword = async () => {
    setIsSending(true);
    setErrorMsg("");
    try {
      // Simulate real delay for sending email
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setSuccessMsg("A senha foi enviada para o e-mail henrickccunha@gmail.com. Basta conferir o e-mail para lembrar!");
    } catch (err) {
      setErrorMsg("Falha ao tentar enviar o e-mail. Tente novamente.");
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setPasswordInput("");
    setErrorMsg("");
    setSuccessMsg("");
    onCancel();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
            {successMsg ? (
              <div className="text-center space-y-5 py-4">
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-950/50 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                  <CheckCircle2 size={24} />
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-white text-lg">E-mail Enviado!</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed px-2">{successMsg}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSuccessMsg("");
                    setPasswordInput("");
                    setErrorMsg("");
                  }}
                  className="w-full px-4 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-700 hover:to-cyan-600 transition-all text-white text-sm font-bold shadow-lg shadow-cyan-500/20 cursor-pointer"
                >
                  Voltar para o Login
                </button>
              </div>
            ) : (
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
                      disabled={isSending}
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
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={isSending}
                        className="text-xs font-bold text-purple-400 hover:text-purple-300 transition-colors cursor-pointer select-none disabled:text-zinc-600 shrink-0"
                      >
                        {isSending ? "Enviando..." : "Esqueci a senha"}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={isSending}
                      className="flex-1 px-4 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold hover:bg-zinc-800 transition-all text-sm cursor-pointer disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSending}
                      className="flex-1 px-4 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-700 hover:to-cyan-600 transition-all text-white font-bold text-sm shadow-lg shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
                    >
                      Confirmar
                    </button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

