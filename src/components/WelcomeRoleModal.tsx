/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Eye, ShieldCheck, Lock, ArrowRight, Gamepad2, CheckCircle2, AlertCircle } from "lucide-react";
import { useBodyScrollLock } from "../lib/bodyScrollLock";

interface WelcomeRoleModalProps {
  isOpen: boolean;
  onSelectViewer: () => void;
  onSelectEditor: (password: string) => boolean; // returns true if password is correct
}

export default function WelcomeRoleModal({ isOpen, onSelectViewer, onSelectEditor }: WelcomeRoleModalProps) {
  useBodyScrollLock(isOpen);

  const [selectedRole, setSelectedRole] = useState<"none" | "editor">("none");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleEditorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorMsg("Por favor, digite a senha.");
      return;
    }

    const success = onSelectEditor(password);
    if (!success) {
      setErrorMsg("Senha incorreta. Tente novamente ou entre como Leitor.");
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in cursor-pointer"
        onClick={(e) => {
          if (e.target === e.currentTarget) onSelectViewer();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-3xl lg:max-w-4xl bg-[#0d0e17] border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl text-white space-y-6 overflow-hidden cursor-default"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Decorative Gradient */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 via-cyan-500 to-emerald-500" />

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 rounded-2xl text-cyan-400 mb-1">
              <Gamepad2 size={28} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Bem-vindo à Biblioteca de Jogos
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
              Como deseja acessar a plataforma hoje? Escolha o modo de acesso adequado para continuar.
            </p>
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Viewer Option */}
            <div
              onClick={() => {
                setSelectedRole("none");
                onSelectViewer();
              }}
              className={`group relative p-5 bg-zinc-900/60 hover:bg-zinc-800/80 border ${
                selectedRole === "none" ? "border-cyan-500/40 hover:border-cyan-400" : "border-zinc-800"
              } rounded-2xl transition-all cursor-pointer space-y-3 shadow-lg hover:shadow-cyan-500/10 flex flex-col justify-between`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
                    <Eye size={20} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 rounded-full">
                    Livre
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-white group-hover:text-cyan-300 transition-colors">
                    Visualização
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed mt-1">
                    Acesso como usuário comum. Consulte catálogo, diários e estatísticas. Sem necessidade de senha.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="w-full mt-2 py-2.5 px-3 bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/30 text-cyan-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 group-hover:shadow-md"
              >
                Acessar Leitura
                <ArrowRight size={14} />
              </button>
            </div>

            {/* Editor Option */}
            <div
              onClick={() => {
                setSelectedRole("editor");
                setErrorMsg("");
              }}
              className={`group relative p-5 bg-zinc-900/60 hover:bg-zinc-800/80 border ${
                selectedRole === "editor" ? "border-purple-500/80 bg-purple-950/10" : "border-zinc-800"
              } rounded-2xl transition-all cursor-pointer space-y-3 shadow-lg hover:shadow-purple-500/10 flex flex-col justify-between`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400">
                    <ShieldCheck size={20} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 bg-purple-950/60 border border-purple-500/30 text-purple-300 rounded-full">
                    Requer Senha
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-white group-hover:text-purple-300 transition-colors">
                    Modo Editor
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed mt-1">
                    Acesso de administrador. Permite adicionar/editar jogos, gerenciar mídias, diários e opções do site.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="w-full mt-2 py-2.5 px-3 bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/30 text-purple-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 group-hover:shadow-md"
              >
                Acessar como Editor
                <Lock size={13} />
              </button>
            </div>
          </div>

          {/* Inline Password Prompt when Editor is Selected */}
          {selectedRole === "editor" && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleEditorSubmit}
              className="p-4 bg-purple-950/20 border border-purple-500/30 rounded-2xl space-y-3"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
                <Lock size={14} />
                <span>Digite a Senha do Administrador</span>
              </div>

              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg("");
                  }}
                  placeholder="Senha de acesso..."
                  autoFocus
                  className="w-full bg-[#12131d] border border-purple-500/40 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 font-mono"
                />
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 text-xs text-rose-400">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedRole("none")}
                  className="flex-1 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-950/50 transition-all flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={14} />
                  Confirmar Acesso
                </button>
              </div>
            </motion.form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
