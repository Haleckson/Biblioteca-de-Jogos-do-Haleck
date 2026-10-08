/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Checksum SHA-256 vs GitHub Verification Card
 */

import React from "react";
import {
  Hash,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { AddonIntegrityReport } from "../../utils/wowAddonChecksumService";

interface BlizzardAddonChecksumCardProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isChecking: boolean;
  report: AddonIntegrityReport | null;
  onCheckIntegrity: () => void;
  onUpdateAddon: () => void;
}

export const BlizzardAddonChecksumCard: React.FC<BlizzardAddonChecksumCardProps> = ({
  isCollapsed,
  onToggle,
  isChecking,
  report,
  onCheckIntegrity,
  onUpdateAddon,
}) => {
  return (
    <div className="rounded-2xl bg-[#090d18] border border-sky-500/40 shadow-xl overflow-hidden transition-all">
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 sm:p-5 flex items-center justify-between gap-4 text-left cursor-pointer hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0 shadow-md">
            <Hash size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-sm sm:text-base text-white">
                2.3 Validador de Integridade por Checksum (SHA-256 vs GitHub)
              </span>
              {report ? (
                report.isUpToDate ? (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/50 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    <CheckCircle2 size={11} className="text-emerald-400" />
                    <span>Atualizado</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 border border-amber-500/50 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    <AlertTriangle size={11} className="text-amber-400" />
                    <span>Desatualizado</span>
                  </span>
                )
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-950/80 border border-sky-500/40 text-sky-300 font-bold">
                  GitHub Reference
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 truncate">
              Compara os hashes criptográficos SHA-256 locais instalados com o repositório oficial no GitHub
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-mono text-zinc-400 hidden sm:inline-block">
            {isCollapsed ? "Recolhido" : "Expandido"}
          </span>
          <div
            className={`p-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-400 transition-transform duration-200 ${
              !isCollapsed ? "rotate-180 text-white" : ""
            }`}
          >
            <ChevronDown size={16} />
          </div>
        </div>
      </button>

      {!isCollapsed && (
        <div className="p-5 pt-0 border-t border-zinc-800/80 animate-fadeIn space-y-4">
          <div className="p-4 rounded-xl bg-[#05070d] border border-sky-900/40 text-xs space-y-3 mt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-bold text-zinc-200">
                Repositório Oficial do Projeto:
              </span>
              <a
                href="https://github.com/Haleckson/Biblioteca-de-Jogos-do-Haleck"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1 self-start sm:self-auto"
              >
                <span>Haleckson/Biblioteca-de-Jogos-do-Haleck</span>
                <ExternalLink size={11} />
              </a>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              O validador audita individualmente cada arquivo do addon <strong className="text-white">HaleckAccountImporter</strong> (.toc, .lua, interfaces), gerando hashes SHA-256 e comparando com os commits e arquivos da branch principal do GitHub.
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={onCheckIntegrity}
                disabled={isChecking}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-black transition-all cursor-pointer shadow-lg shadow-sky-600/30 flex items-center gap-2 disabled:opacity-50"
              >
                {isChecking ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-white" />
                    <span>Calculando Hashes SHA-256...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={14} className="text-sky-200" />
                    <span>Auditar Checksums dos Arquivos</span>
                  </>
                )}
              </button>

              {report && !report.isUpToDate && (
                <button
                  type="button"
                  onClick={onUpdateAddon}
                  className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white text-xs font-black transition-all cursor-pointer shadow-lg shadow-amber-600/30 flex items-center gap-2"
                >
                  <RefreshCw size={14} />
                  <span>Atualizar Addon Agora (Aplicar Versão GitHub)</span>
                </button>
              )}
            </div>
          </div>

          {/* Report Display */}
          {report && (
            <div className="p-4 rounded-xl bg-[#04060e] border border-sky-500/50 space-y-3">
              {/* Alert Status Banner */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                  report.isUpToDate
                    ? "bg-emerald-950/70 border-emerald-500/60 text-emerald-200"
                    : report.status === "outdated"
                    ? "bg-amber-950/70 border-amber-500/60 text-amber-200"
                    : "bg-rose-950/70 border-rose-500/60 text-rose-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  {report.isUpToDate ? (
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  ) : (
                    <ShieldAlert size={16} className="text-amber-400 shrink-0" />
                  )}
                  <span className="font-semibold">{report.alert || report.summaryMessage}</span>
                </div>
                <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-black/40 border border-white/10 shrink-0">
                  {report.status}
                </span>
              </div>

              {/* Granular Files Table */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {(Array.isArray(report.files)
                  ? report.files
                  : report.files && typeof report.files === "object"
                  ? Object.values(report.files)
                  : []
                ).map((file, idx) => {
                  const fileName = file.fileName || (file as any).name || "Arquivo";
                  const isMatch = file.status === "match" || (file as any).isMatch;

                  return (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-[#060914] border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-1 min-w-0">
                        <span className="font-bold text-white block">{fileName}</span>
                        <div className="flex items-center gap-3 font-mono text-[10px] text-zinc-400 flex-wrap">
                          <span>
                            Local:{" "}
                            <strong className="text-cyan-300">
                              {file.localHash ? file.localHash.slice(0, 14) + "..." : "Não calculado"}
                            </strong>
                          </span>
                          <span>
                            GitHub:{" "}
                            <strong className="text-amber-300">
                              {file.remoteHash ? file.remoteHash.slice(0, 14) + "..." : "Indisponível"}
                            </strong>
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 self-start sm:self-auto ${
                          isMatch
                            ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                            : file.status === "missing_local"
                            ? "bg-zinc-800 text-zinc-400 border border-zinc-700"
                            : "bg-rose-950/80 text-rose-300 border border-rose-500/40"
                        }`}
                      >
                        {isMatch ? "Em Sincronia" : file.status === "missing_local" ? "Não Instalado" : "Divergente"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
