/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Settings, X, Key, Image, Database, Sliders, Shield, LogOut, CheckCircle2, ChevronRight, Sparkles, HardDrive, Mail } from "lucide-react";
import { getCustomImgBBKey } from "../utils/imgbb";

interface SiteSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenImgBB: () => void;
  onExitAdmin: () => void;
  driveAuthenticated: boolean;
  onConnectDrive: () => void;
  onDisconnectDrive: () => void;
  gmailUser: string | null;
  onConnectGmail: () => void;
  onDisconnectGmail: () => void;
}

export default function SiteSettingsModal({
  isOpen,
  onClose,
  onOpenImgBB,
  onExitAdmin,
  driveAuthenticated,
  onConnectDrive,
  onDisconnectDrive,
  gmailUser,
  onConnectGmail,
  onDisconnectGmail,
}: SiteSettingsModalProps) {
  if (!isOpen) return null;

  const hasCustomImgBBKey = !!getCustomImgBBKey();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl bg-[#0d0e17] border border-cyan-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl text-white space-y-6 overflow-hidden max-h-[90vh] flex flex-col cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Decorative Line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-500" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          title="Fechar"
        >
          <X size={18} />
        </button>

        {/* Header Title */}
        <div className="flex items-center gap-3.5 pr-8">
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400">
            <Settings size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-white tracking-tight">Configurações do Site</h3>
              <span className="text-[10px] font-bold text-purple-300 bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Admin
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">Painel de preferências e integrações do sistema</p>
          </div>
        </div>

        {/* Scrollable Content Container */}
        <div className="space-y-5 overflow-y-auto pr-1 flex-1 custom-scrollbar">

          {/* Section: Google Services */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <HardDrive size={14} />
              Contas & Integrações Google
            </h4>

            {/* Google Drive Item */}
            <div className="p-4 bg-zinc-900/70 border border-zinc-800 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 shrink-0">
                  <HardDrive size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">Google Drive</span>
                    {driveAuthenticated ? (
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 size={10} /> Conectado
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
                        Desconectado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 truncate mt-0.5">
                    {driveAuthenticated
                      ? "Backup de mídias e dados sincronizado na nuvem."
                      : "Conecte para sincronizar mídias e metadados no Drive."}
                  </p>
                </div>
              </div>

              {driveAuthenticated ? (
                <button
                  type="button"
                  onClick={onDisconnectDrive}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-rose-950/50 border border-zinc-700 hover:border-rose-500/40 text-zinc-300 hover:text-rose-300 text-xs font-bold transition-all cursor-pointer shrink-0"
                >
                  Desconectar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onConnectDrive}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all cursor-pointer shrink-0 shadow-md shadow-cyan-500/20"
                >
                  Conectar
                </button>
              )}
            </div>

            {/* Gmail Item */}
            <div className="p-4 bg-zinc-900/70 border border-zinc-800 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-2.5 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400 shrink-0">
                  <Mail size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">Gmail</span>
                    {gmailUser ? (
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 size={10} /> Conectado
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
                        Não conectado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 truncate mt-0.5">
                    {gmailUser ? gmailUser : "Conecte sua conta Google/Gmail para identificação do usuário."}
                  </p>
                </div>
              </div>

              {gmailUser ? (
                <button
                  type="button"
                  onClick={onDisconnectGmail}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-rose-950/50 border border-zinc-700 hover:border-rose-500/40 text-zinc-300 hover:text-rose-300 text-xs font-bold transition-all cursor-pointer shrink-0"
                >
                  Sair
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onConnectGmail}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all cursor-pointer shrink-0 shadow-md shadow-purple-500/20"
                >
                  Conectar
                </button>
              )}
            </div>
          </div>
          
          {/* Section: Uploads & Media */}
          <div className="space-y-2.5 pt-2 border-t border-zinc-800/80">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Image size={14} />
              Serviços de Mídia & Imagens
            </h4>

            <div
              onClick={() => {
                onClose();
                onOpenImgBB();
              }}
              className="p-4 bg-zinc-900/70 hover:bg-zinc-800/80 border border-zinc-800 hover:border-cyan-500/40 rounded-2xl transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 shrink-0">
                  <Key size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white group-hover:text-cyan-300 transition-colors">
                      Configurar ImgBB
                    </span>
                    {hasCustomImgBBKey ? (
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 size={10} />
                        Chave Própria
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-amber-400 bg-amber-950/50 border border-amber-500/30 px-2 py-0.5 rounded-full">
                        Chave Padrão
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 truncate mt-0.5">
                    {hasCustomImgBBKey
                      ? "Chave pessoal ativa para upload ilimitado de capas e diários."
                      : "Defina sua própria chave de API gratuita do ImgBB para evitar limites de cota."}
                  </p>
                </div>
              </div>

              <ChevronRight size={18} className="text-zinc-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </div>
          </div>

          {/* Section: Future Settings */}
          <div className="space-y-2.5 pt-2 border-t border-zinc-800/80">
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Sliders size={14} />
              Futuras Opções do Sistema
            </h4>

            <div className="grid grid-cols-1 gap-2.5">
              <div className="p-3.5 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl flex items-center justify-between opacity-75">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                    <Database size={16} />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-zinc-300">Backup & Exportação Automática</h5>
                    <p className="text-[11px] text-zinc-500">Agende exportações da biblioteca em JSON/CSV.</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full uppercase">
                  Em breve
                </span>
              </div>

              <div className="p-3.5 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl flex items-center justify-between opacity-75">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-zinc-300">Personalização Visual do Painel</h5>
                    <p className="text-[11px] text-zinc-500">Ajuste temas, cores de destaque e densidade de cards.</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full uppercase">
                  Em breve
                </span>
              </div>
            </div>
          </div>

          {/* Section: Admin Session */}
          <div className="space-y-2.5 pt-2 border-t border-zinc-800/80">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Shield size={14} />
              Sessão do Administrador
            </h4>

            <button
              onClick={() => {
                onClose();
                onExitAdmin();
              }}
              className="w-full p-3.5 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-500/30 text-rose-300 hover:text-rose-200 rounded-2xl transition-all font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <LogOut size={16} />
              Bloquear Modo Editor (Voltar para Modo Leitura)
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
