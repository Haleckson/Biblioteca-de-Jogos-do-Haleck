/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Download,
  Upload,
  X,
  FileCode,
  CheckCircle,
  AlertCircle,
  Copy,
  ExternalLink,
  Shield,
  Layers,
  Sparkles,
  Server,
  RefreshCw,
  FolderArchive,
  Info,
  Terminal,
  Bell,
  Play,
  Send,
  BookOpen,
  Code,
} from "lucide-react";
import { WoWAddonDevModal } from "./WoWAddonDevModal";
import { Game } from "../types";
import {
  downloadWoWAddonZip,
  downloadSyncAgentBatFile,
  downloadSyncAgentPs1File,
  WOW_ADDON_DEV_SOURCES,
  WOW_VERSION_DIFFERENCES,
  WOW_DEPRECATED_FUNCTION_MAP,
  WOW_GOLDEN_RULES,
} from "../utils/addonExportService";
import { parseAddonData, ParsedAddonResult } from "../utils/wowAddonParser";
import { showToast } from "../utils/toast";
import { getWoWClassInfo } from "../utils/blizzardIcons";

interface AddonExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentGame: Game;
  initialTab?: "export" | "import" | "agent" | "docs";
  onApplyImportedData: (res: ParsedAddonResult) => void;
  activeCharacterName?: string;
  activeRealm?: string;
}

export const AddonExportModal: React.FC<AddonExportModalProps> = ({
  isOpen,
  onClose,
  currentGame,
  initialTab = "export",
  onApplyImportedData,
  activeCharacterName = "",
  activeRealm = "",
}) => {
  const [activeTab, setActiveTab] = useState<"export" | "import" | "agent" | "docs">(initialTab);
  const [selectedVersion, setSelectedVersion] = useState<string>("forever");
  const [charName, setCharName] = useState<string>(activeCharacterName);
  const [realmName, setRealmName] = useState<string>(activeRealm);
  const [ruleset, setRuleset] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState<string>("");
  const [devModalOpen, setDevModalOpen] = useState(false);

  // Import states
  const [rawText, setRawText] = useState<string>("");
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedAddonResult | null>(null);
  const [isSyncingServer, setIsSyncingServer] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setCharName(activeCharacterName || currentGame.blizzardCharacterName || "");
      setRealmName(activeRealm || currentGame.blizzardRealm || "");
      if (currentGame.wowVersion) {
        setSelectedVersion(currentGame.wowVersion);
      }
    }
  }, [isOpen, initialTab, activeCharacterName, activeRealm, currentGame]);

  if (!isOpen) return null;

  const handleDownloadZip = async () => {
    try {
      setIsDownloading(true);
      await downloadWoWAddonZip({
        gameVersion: selectedVersion,
        characterName: charName,
        realm: realmName,
        ruleset: ruleset || undefined,
      });
      showToast({ title: "Addon Baixado", message: "Download do Addon iniciado com sucesso!", type: "success" });
    } catch (err: any) {
      showToast({ title: "Erro no Download", message: err.message || "Erro ao gerar arquivo .zip do Addon", type: "error" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleProcessInput = (content: string) => {
    if (!content.trim()) {
      setParsedResult(null);
      setParseError(null);
      return;
    }

    setIsParsing(true);
    setParseError(null);
    try {
      const res = parseAddonData(content);
      setParsedResult(res);
      showToast({ title: "Addon Lido", message: `Personagem ${res.activeProfile.name} detectado!`, type: "success" });
    } catch (err: any) {
      setParseError(err.message || "Erro ao processar dados do Addon.");
      setParsedResult(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawText(text);
      handleProcessInput(text);
    };
    reader.onerror = () => {
      setParseError("Falha ao ler o arquivo selecionado.");
    };
    reader.readAsText(file);
  };

  const handleQueryLocalServer = async () => {
    setIsSyncingServer(true);
    setParseError(null);
    try {
      const r = realmName || "unknown";
      const c = charName || "unknown";
      let res = await fetch(`/api/blizzard/wow/addon-sync/${encodeURIComponent(r)}/${encodeURIComponent(c)}`);
      
      // If not found by name, try fallback to latest sync or /all
      if (!res.ok) {
        res = await fetch("/api/blizzard/wow/addon-sync/latest/latest");
      }
      if (!res.ok) {
        const allRes = await fetch("/api/blizzard/wow/addon-sync/all");
        if (allRes.ok) {
          const allData = await allRes.json();
          if (allData.latestSync) {
            res = { ok: true, json: async () => allData.latestSync } as any;
          }
        }
      }

      if (!res.ok) {
        throw new Error("Nenhum dado recente de Addon encontrado no servidor local.");
      }

      const data = await res.json();
      const payload = data.payload || data;
      const parsed = parseAddonData(payload);
      setParsedResult(parsed);
      setRawText(JSON.stringify(payload, null, 2));
      showToast({ title: "Sincronizado", message: "Snapshot do Addon recuperado do servidor local!", type: "success" });
    } catch (err: any) {
      setParseError(err.message || "Erro ao consultar servidor local.");
    } finally {
      setIsSyncingServer(false);
    }
  };

  const handleApply = () => {
    if (!parsedResult) return;
    onApplyImportedData(parsedResult);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-950 border border-cyan-500/40 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl shadow-cyan-500/10 overflow-hidden text-left">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-300 shrink-0 shadow-inner">
              <FolderArchive size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Haleck Account Importer
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold">
                  WoW Addon Universal
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Exporte diretamente do jogo e importe Armory, Inventário, Coleções e Conquistas.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDevModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-cyan-950/70 hover:bg-cyan-900/90 border border-cyan-500/40 text-cyan-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
              title="Abrir estúdio de criação de addons WoW com templates e documentação"
            >
              <Code size={13} />
              <span>Criar Novo Addon (Dev Studio)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-zinc-800/80 bg-zinc-900/40 px-4 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("export")}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
              activeTab === "export"
                ? "bg-zinc-950 border-cyan-400 text-cyan-300 shadow-sm"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Download size={14} />
            <span>1. Baixar Addon (.zip)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("import")}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
              activeTab === "import"
                ? "bg-zinc-950 border-cyan-400 text-cyan-300 shadow-sm"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Upload size={14} />
            <span>2. Importar Dados do Addon</span>
            {parsedResult && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("agent")}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
              activeTab === "agent"
                ? "bg-zinc-950 border-cyan-400 text-cyan-300 shadow-sm"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Terminal size={14} />
            <span>3. Agente Automático (.bat)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("docs")}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
              activeTab === "docs"
                ? "bg-zinc-950 border-cyan-400 text-cyan-300 shadow-sm"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <BookOpen size={14} />
            <span>4. Fontes & Diretrizes de Código</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-zinc-300 scrollbar-thin scrollbar-thumb-zinc-800">
          {activeTab === "export" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-2">
                <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
                  <Sparkles size={16} />
                  <span>Personalize seu Pacote Addon</span>
                </div>
                <p className="text-zinc-400">
                  O pacote inclui <strong className="text-white">HaleckAccountImporter.toc</strong>, <strong className="text-white">HaleckAccountImporter.lua</strong> e instruções completas para sua versão do World of Warcraft.
                </p>
              </div>

              {/* Version Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-zinc-400 mb-1">
                    Versão do Cliente de WoW:
                  </label>
                  <select
                    value={selectedVersion}
                    onChange={(e) => setSelectedVersion(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-medium focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="forever">⭐ WoW Forever (Vanilla+ • Lançamento 04/Nov - Recomendado)</option>
                    <option value="forever_beta">WoW Forever Beta (Build 16001)</option>
                    <option value="retail">WoW Retail (The War Within 11.x / Midnight)</option>
                    <option value="classic">WoW Classic Era (1.15.x)</option>
                    <option value="mop">Mists of Pandaria Classic (5.4.8)</option>
                    <option value="tbc">The Burning Crusade Classic</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-zinc-400 mb-1">
                    Reino / Ruleset:
                  </label>
                  <input
                    type="text"
                    value={realmName}
                    onChange={(e) => setRealmName(e.target.value)}
                    placeholder="Ex: Azralon, Whitemane ou Forever"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white placeholder-zinc-600 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  disabled={isDownloading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                >
                  <Download size={16} className={isDownloading ? "animate-bounce" : ""} />
                  <span>{isDownloading ? "Gerando Pacote..." : "Baixar HaleckAccountImporter.zip"}</span>
                </button>
              </div>

              {/* Step by Step Guide */}
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2.5">
                <h4 className="font-bold text-white flex items-center gap-1.5">
                  <Info size={14} className="text-cyan-400" />
                  Instruções de Instalação no Jogo:
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 text-zinc-300 leading-relaxed text-[11px]">
                  <li>Extraia o arquivo baixado na pasta <code className="bg-zinc-950 px-1 py-0.5 rounded text-cyan-300 font-mono">Interface/AddOns/</code> do seu World of Warcraft.</li>
                  <li className="text-cyan-200">
                    <strong className="text-cyan-300">⚔️ WoW Forever Beta:</strong> A pasta do cliente vem nomeada no disco como <code className="bg-zinc-950 px-1 py-0.5 rounded text-amber-300 font-mono font-bold">World of Warcraft/_classic_beta_/</code>. Extraia o Addon em <code className="bg-zinc-950 px-1 py-0.5 rounded text-cyan-300 font-mono">_classic_beta_/Interface/AddOns/</code>.
                  </li>
                  <li>No jogo, certifique-se de que o Addon está ativo no botão <strong className="text-white">AddOns</strong>.</li>
                  <li>Dentro do jogo com seu personagem, digite <code className="bg-zinc-950 px-1.5 py-0.5 rounded text-amber-300 font-mono font-bold">/hai</code> ou <code className="bg-zinc-950 px-1.5 py-0.5 rounded text-amber-300 font-mono font-bold">/haleck</code> no chat.</li>
                  <li>Copie os dados gerados ou volte a esta janela na aba <strong className="text-cyan-300">2. Importar Dados</strong> e selecione o arquivo <code className="bg-zinc-950 px-1 py-0.5 rounded text-cyan-300 font-mono">WTF/.../SavedVariables/HaleckAccountImporter.lua</code>.</li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === "import" && (
            <div className="space-y-4">
              {/* Method A & B */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-4 rounded-xl border border-dashed border-cyan-500/50 hover:border-cyan-400 bg-cyan-950/20 hover:bg-cyan-950/30 transition-all text-center space-y-1.5 cursor-pointer group"
                >
                  <Upload size={20} className="mx-auto text-cyan-400 group-hover:-translate-y-0.5 transition-transform" />
                  <span className="font-bold text-white block">Selecionar Arquivo .lua / .json</span>
                  <span className="text-[10px] text-zinc-400 block font-mono">HaleckAccountImporter.lua</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".lua,.json,.txt"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={handleQueryLocalServer}
                  disabled={isSyncingServer}
                  className="p-4 rounded-xl border border-zinc-800 hover:border-zinc-700 bg-zinc-900/80 hover:bg-zinc-900 transition-all text-center space-y-1.5 cursor-pointer group disabled:opacity-50"
                >
                  <Server size={20} className={`mx-auto text-purple-400 group-hover:scale-105 transition-transform ${isSyncingServer ? "animate-spin" : ""}`} />
                  <span className="font-bold text-white block">Consultar Servidor Local</span>
                  <span className="text-[10px] text-zinc-400 block font-mono">Via API /api/blizzard/wow/addon-sync</span>
                </button>
              </div>

              {/* Paste Text Area */}
              <div>
                <label className="block text-[11px] font-bold uppercase text-zinc-400 mb-1">
                  Ou Cole o Texto do Addon (JSON ou Lua):
                </label>
                <textarea
                  value={rawText}
                  onChange={(e) => {
                    setRawText(e.target.value);
                    handleProcessInput(e.target.value);
                  }}
                  rows={5}
                  placeholder="Cole aqui o conteúdo de HaleckAccountImporter.lua ou o texto copiado da janela in-game..."
                  className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 font-mono text-[11px] text-white placeholder-zinc-600 focus:border-cyan-500 focus:outline-none resize-none"
                />
              </div>

              {/* Error Message */}
              {parseError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0 text-red-400" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Success Result Preview */}
              {parsedResult && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-zinc-950 border border-emerald-500/50 space-y-3 shadow-md animate-in fade-in">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-white text-sm">
                            {parsedResult.activeProfile.name}
                          </h4>
                          <span className="px-1.5 py-0.2 rounded bg-amber-950 border border-amber-500/50 text-amber-300 font-mono text-[10px] font-bold">
                            Nível {parsedResult.activeProfile.level}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-purple-950 border border-purple-500/50 text-purple-300 font-mono text-[10px] font-bold">
                            ilvl {parsedResult.activeProfile.equippedItemLevel}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {parsedResult.activeProfile.race} • {parsedResult.activeProfile.characterClass} • {parsedResult.isForever ? `Ruleset: ${parsedResult.ruleset || parsedResult.activeProfile.realm}` : `Reino: ${parsedResult.activeProfile.realm}`}
                        </p>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-bold">
                      {parsedResult.detectedVersionLabel}
                    </span>
                  </div>

                  {/* Summary badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-800">
                    <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800">
                      <span className="text-[9px] text-zinc-400 block uppercase font-bold">Equipamentos</span>
                      <span className="text-xs font-mono font-bold text-white">
                        {parsedResult.activeProfile.equippedItems?.length || 0} slots
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800">
                      <span className="text-[9px] text-zinc-400 block uppercase font-bold">Conquistas</span>
                      <span className="text-xs font-mono font-bold text-amber-300">
                        {parsedResult.activeProfile.achievementPoints || 0} pts
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800">
                      <span className="text-[9px] text-zinc-400 block uppercase font-bold">Montarias</span>
                      <span className="text-xs font-mono font-bold text-cyan-300">
                        {parsedResult.activeProfile.collections?.totalMountsCount || 0}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800">
                      <span className="text-[9px] text-zinc-400 block uppercase font-bold">Mascotes (Pets)</span>
                      <span className="text-xs font-mono font-bold text-emerald-300">
                        {parsedResult.activeProfile.collections?.totalPetsCount || 0}
                      </span>
                    </div>
                  </div>

                  {/* Action button */}
                  <button
                    type="button"
                    onClick={handleApply}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/30"
                  >
                    <CheckCircle size={15} />
                    <span>Aplicar e Salvar no Halo Tracker</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === "agent" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/40 via-zinc-900 to-cyan-950/30 border border-purple-500/40 space-y-2">
                <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
                  <Terminal size={18} className="text-cyan-400" />
                  <span>Agente de Sincronização em Tempo Real (Desktop)</span>
                </div>
                <p className="text-zinc-300 leading-relaxed text-[11px]">
                  O Agente Desktop monitora o arquivo <code className="text-cyan-300 font-mono bg-zinc-950 px-1 py-0.5 rounded">HaleckAccountImporter.lua</code> na sua máquina. Ao salvar dados no jogo com <code className="text-amber-300 font-mono font-bold">/hai</code>, deslogar ou ao registrar evento de morte no modo Hardcore, seus personagens são atualizados automaticamente no Halo Tracker!
                </p>
              </div>

              {/* Download Buttons for Scripts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-white font-bold">
                      <Play size={15} className="text-emerald-400" />
                      <span>Iniciador Windows (.bat)</span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Detecta automaticamente suas pastas de WoW (Retail, Classic, Forever) e roda o monitor em segundo plano com 1 clique.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      downloadSyncAgentBatFile();
                      showToast({ title: "Download Iniciado", message: "Baixando sync-agent.bat!", type: "success" });
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
                  >
                    <Download size={14} />
                    <span>Baixar sync-agent.bat</span>
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-white font-bold">
                      <Bell size={15} className="text-cyan-400" />
                      <span>Script PowerShell (.ps1)</span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Inclui notificações em balão no Windows quando o personagem sincronizar e envio para Discord Webhook opcional.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      downloadSyncAgentPs1File(discordWebhookUrl);
                      showToast({ title: "Download Iniciado", message: "Baixando sync-agent.ps1!", type: "success" });
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-cyan-600/20"
                  >
                    <Download size={14} />
                    <span>Baixar sync-agent.ps1</span>
                  </button>
                </div>
              </div>

              {/* Optional Discord Webhook */}
              <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2">
                <label className="block text-[11px] font-bold uppercase text-zinc-400">
                  Webhook do Discord (Opcional para Alertas):
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={discordWebhookUrl}
                    onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!discordWebhookUrl) {
                        showToast({ title: "Aviso", message: "Insira uma URL de Webhook válida primeiro", type: "warning" });
                        return;
                      }
                      showToast({ title: "Webhook Configurado", message: "URL anexada aos scripts de exportação!", type: "success" });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Send size={13} />
                    <span>Salvar</span>
                  </button>
                </div>
                <span className="text-[10px] text-zinc-500 block">
                  Se preenchido, o agente enviará uma mensagem no Discord a cada sincronização ou morte em Hardcore.
                </span>
              </div>

              {/* Step instructions */}
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                <h5 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Info size={14} className="text-amber-400" />
                  Como Usar o Agente Automático:
                </h5>
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-zinc-400 leading-relaxed">
                  <li>Baixe o <strong className="text-white">sync-agent.bat</strong> e coloque na pasta onde quiser ou junto do seu jogo.</li>
                  <li>Dê um duplo clique no arquivo para abrir a janela de monitoramento.</li>
                  <li>No jogo, basta digitar <code className="text-amber-300 font-bold bg-zinc-950 px-1 py-0.5 rounded font-mono">/hai</code> ou deslogar para atualizar seu catálogo instantaneamente!</li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === "docs" && (
            <div className="space-y-4">
              {/* Header Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 via-zinc-900 to-cyan-950/30 border border-cyan-500/40 space-y-2">
                <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
                  <BookOpen size={18} className="text-cyan-400" />
                  <span>Fontes Oficiais & Diretrizes de Criação de AddOns</span>
                </div>
                <p className="text-zinc-300 leading-relaxed text-[11px]">
                  Para confeccionar e validar AddOns estáveis, consulte as fontes canônicas da linguagem Lua e da Blizzard API. <strong className="text-amber-300 font-semibold">Atenção às diferenças arquiteturais</strong> entre o cliente <strong className="text-white">Retail</strong>, <strong className="text-white">Classic Era</strong>, <strong className="text-white">WoW Forever</strong> e o <strong className="text-white">WoW Forever Beta (Build 16001)</strong>.
                </p>
              </div>

              {/* 1. Official Sources & Reference Links */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <ExternalLink size={14} className="text-cyan-400" />
                  <span>Fontes & Guias Oficiais de Referência:</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {WOW_ADDON_DEV_SOURCES.map((source, idx) => (
                    <a
                      key={idx}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800 hover:border-cyan-500/50 transition-all flex flex-col justify-between group space-y-1.5"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-bold text-zinc-100 group-hover:text-cyan-300 transition-colors text-xs truncate">
                            {source.title}
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-950 text-cyan-400 border border-zinc-800 shrink-0">
                            {source.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                          {source.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-zinc-500 group-hover:text-cyan-400 font-mono transition-colors pt-1">
                        <span className="truncate">{source.url}</span>
                        <ExternalLink size={10} className="shrink-0" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              {/* 2. Version Differences Matrix */}
              <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <Shield size={14} className="text-amber-400" />
                  <span>Diferenças Críticas entre Clientes de WoW:</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {WOW_VERSION_DIFFERENCES.map((diff, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border ${diff.tagColor} space-y-1.5`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-white text-xs">{diff.name}</span>
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-zinc-950/80 border border-zinc-800">
                          Interface: {diff.interfaceVersion}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-300 leading-relaxed">
                        {diff.keyCharacteristics}
                      </p>
                      <p className="text-[10px] text-amber-300/90 font-mono leading-relaxed">
                        ⚠️ {diff.caveats}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. The Deprecated Function Map */}
              <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2.5">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <FileCode size={14} className="text-emerald-400" />
                  <span>The Deprecated Function Map (Mapeamento de Funções):</span>
                </h4>
                <div className="space-y-1.5">
                  {WOW_DEPRECATED_FUNCTION_MAP.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap font-mono text-[11px]">
                          <span className="text-red-400 line-through">{item.legacy}</span>
                          <span className="text-zinc-500">➔</span>
                          <span className="text-emerald-400 font-bold">{item.modern}</span>
                        </div>
                        <p className="text-[10px] text-zinc-400">{item.notes}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. The Golden Rules */}
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <Sparkles size={14} className="text-yellow-400" />
                  <span>The Golden Rules of WoW Addon Coding (Regras de Ouro):</span>
                </h4>
                <div className="space-y-2 text-[11px]">
                  {WOW_GOLDEN_RULES.map((rule, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-zinc-950/70 border border-zinc-800/80">
                      <strong className="text-amber-300 block">{rule.rule}</strong>
                      <span className="text-zinc-400 text-[10px]">{rule.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400">
          <span className="flex items-center gap-1.5 font-mono text-[11px]">
            <Shield size={13} className="text-cyan-400" /> Suporte a WoW Forever, Classic & Retail
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* WOW ADDON DEV STUDIO & TEMPLATE GENERATOR MODAL */}
      <WoWAddonDevModal
        isOpen={devModalOpen}
        onClose={() => setDevModalOpen(false)}
        initialGameVersion={selectedVersion as any}
      />
    </div>
  );
};

export default AddonExportModal;
