/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import JSZip from "jszip";
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
  Archive,
  HelpCircle,
  Eye,
  Flame,
  Zap,
  Clock,
  Database,
  Calendar,
} from "lucide-react";
import { WoWAddonDevModal } from "./WoWAddonDevModal";
import { WoWAddonPreviewModal } from "./WoWAddonPreviewModal";
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
import { ingestBatchWoWItems, ingestWoWMount } from "../utils/wowIdDatabase";
import {
  getWoWForeverApiStatus,
  calculateWoWForeverWorldBosses,
  WoWForeverApiStatus,
  WoWForeverWorldBossStatus,
} from "../utils/wowForeverApiService";

interface AddonExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentGame: Game;
  initialTab?: "export" | "import" | "agent" | "docs" | "tutorial" | "forever";
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
  const [activeTab, setActiveTab] = useState<"export" | "import" | "agent" | "docs" | "tutorial" | "forever">(initialTab);
  const [selectedVersion, setSelectedVersion] = useState<string>("forever");
  const [charName, setCharName] = useState<string>(activeCharacterName);
  const [realmName, setRealmName] = useState<string>(activeRealm);
  const [ruleset, setRuleset] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState<string>("");
  const [devModalOpen, setDevModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // WoW Forever API state
  const [foreverStatus, setForeverStatus] = useState<WoWForeverApiStatus>(getWoWForeverApiStatus());
  const [worldBosses, setWorldBosses] = useState<WoWForeverWorldBossStatus[]>(calculateWoWForeverWorldBosses());
  const [loadingForeverApi, setLoadingForeverApi] = useState(false);
  const [foreverApiResponse, setForeverApiResponse] = useState<any>(null);

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

      // Automatically ingest all items & mounts into universal database
      if (res.activeProfile) {
        if (res.activeProfile.equippedItems && res.activeProfile.equippedItems.length > 0) {
          ingestBatchWoWItems(
            res.activeProfile.equippedItems.map((it) => ({
              id: Number(it.itemId || it.id),
              displayId: it.displayId,
              name: it.name,
              quality: it.quality,
              iconUrl: it.iconUrl,
              version: res.detectedVersion,
            }))
          ).catch(() => {});
        }

        if (res.activeProfile.collections?.mounts && res.activeProfile.collections.mounts.length > 0) {
          for (const m of res.activeProfile.collections.mounts) {
            if (m.id) {
              ingestWoWMount({
                mountId: m.id,
                name: m.name,
                spellId: m.spellId,
                itemId: m.itemId,
              }).catch(() => {});
            }
          }
        }
      }
    } catch (err: any) {
      setParseError(err.message || "Erro ao processar dados do Addon.");
      setParsedResult(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if uploaded file is a ZIP archive (from SavedVariables folder or WTF)
    if (file.name.toLowerCase().endsWith(".zip") || file.type.includes("zip")) {
      setIsParsing(true);
      setParseError(null);
      try {
        const zip = await JSZip.loadAsync(file);
        let targetFile: JSZip.JSZipObject | null = null;

        // 1. First priority: HaleckAccountImporter.lua
        zip.forEach((path, obj) => {
          if (!obj.dir) {
            const p = path.toLowerCase();
            if (p.includes("haleckaccountimporter") && p.endsWith(".lua")) {
              targetFile = obj;
            }
          }
        });

        // 2. Second priority: Any .lua inside SavedVariables
        if (!targetFile) {
          zip.forEach((path, obj) => {
            if (!obj.dir && !targetFile) {
              const p = path.toLowerCase();
              if (p.includes("savedvariables") && p.endsWith(".lua")) {
                targetFile = obj;
              }
            }
          });
        }

        // 3. Third priority: Any .lua or .json file
        if (!targetFile) {
          zip.forEach((path, obj) => {
            if (!obj.dir && !targetFile) {
              const p = path.toLowerCase();
              if (p.endsWith(".lua") || p.endsWith(".json")) {
                targetFile = obj;
              }
            }
          });
        }

        if (!targetFile) {
          throw new Error("Nenhum arquivo 'HaleckAccountImporter.lua' ou dados reconhecíveis encontrados dentro do arquivo .ZIP. Verifique se você compactou a pasta SavedVariables correta.");
        }

        const text = await (targetFile as any).async("text");
        setRawText(text);
        handleProcessInput(text);
        showToast({ title: "ZIP Descompactado", message: `Arquivo ${(targetFile as any).name} extraído e processado com sucesso!`, type: "success" });
      } catch (err: any) {
        setParseError(err.message || "Erro ao descompactar e processar arquivo ZIP.");
        showToast({ title: "Erro no ZIP", message: err.message || "Falha ao ler arquivo .ZIP", type: "error" });
      } finally {
        setIsParsing(false);
      }
      return;
    }

    // Standard text reader for .lua / .json / .txt
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-3 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0c0d14] border border-cyan-500/40 rounded-3xl w-[98vw] max-w-[98vw] h-[98vh] max-h-[98vh] flex flex-col shadow-2xl shadow-cyan-500/10 overflow-hidden text-left">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-300 shrink-0 shadow-inner">
              <FolderArchive size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Haleck Account Importer Forever
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold">
                  WoW Forever Exclusivo (Build 16001)
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Exporte diretamente do jogo e importe Armory, Bolsas, Banco, Estatísticas, Talentos, Missões e Coleções do WoW Forever.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-900/80 to-blue-900/80 hover:from-cyan-800 hover:to-blue-800 border border-cyan-400/50 text-cyan-200 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
              title="Pré-visualizar a interface in-game do Addon (/hai e /diario) com simulador interativo"
            >
              <Sparkles size={13} className="text-amber-400 animate-pulse" />
              <span>Simulador In-Game</span>
            </button>
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
            onClick={() => setActiveTab("tutorial")}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === "tutorial"
                ? "bg-zinc-950 border-cyan-400 text-cyan-300 shadow-sm"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Archive size={14} />
            <span>Tutorial: Enviar .ZIP & Pastas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("forever")}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === "forever"
                ? "bg-zinc-950 border-cyan-400 text-cyan-300 shadow-sm"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Flame size={14} className="text-amber-400" />
            <span>WoW Forever & Inovações</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-950/90 border border-cyan-500/50 text-cyan-300 font-mono font-bold">5 Ativas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("docs")}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === "docs"
                ? "bg-zinc-950 border-cyan-400 text-cyan-300 shadow-sm"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <BookOpen size={14} />
            <span>Fontes & Diretrizes</span>
          </button>

          <button
            type="button"
            onClick={() => setPreviewModalOpen(true)}
            className="px-4 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 border-transparent text-amber-300 hover:text-amber-200 hover:bg-zinc-900/60 whitespace-nowrap ml-auto"
            title="Abrir Simulador Interativo do Addon (/hai e /diario)"
          >
            <Sparkles size={14} className="text-amber-400 animate-pulse" />
            <span>Simulador In-Game</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-zinc-300 scrollbar-thin scrollbar-thumb-zinc-800">
          {activeTab === "export" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-2">
                <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
                  <Sparkles size={16} />
                  <span>Haleck Account Importer Forever (HAIF)</span>
                </div>
                <p className="text-zinc-400">
                  O pacote inclui <strong className="text-white">HaleckAccountImporterForever.toc</strong> e <strong className="text-white">HaleckAccountImporterForever.lua</strong> com foco exclusivo no WoW Forever (Build 16001 / Camelot Engine).
                </p>
              </div>

              {/* Version & Realm display */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-zinc-400 mb-1">
                    Cliente Alvo:
                  </label>
                  <div className="p-2.5 rounded-xl bg-zinc-900 border border-cyan-500/40 text-cyan-300 font-bold flex items-center justify-between">
                    <span>WoW Forever (Build 16001 • _classic_beta_)</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/40">Exclusivo</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-zinc-400 mb-1">
                    Reino / Ruleset Padrão:
                  </label>
                  <input
                    type="text"
                    value={realmName}
                    onChange={(e) => setRealmName(e.target.value)}
                    placeholder="Ex: Whitemane ou Forever Beta"
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
                  <span>{isDownloading ? "Gerando Pacote..." : "Baixar HaleckAccountImporterForever-5.0.0.zip"}</span>
                </button>
              </div>

              {/* In-Game Usage & Minimap Button Info Card */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/60 via-blue-950/40 to-cyan-950/60 border border-cyan-500/40 flex items-center justify-between gap-3 flex-wrap shadow-inner">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Terminal size={14} className="text-cyan-400" />
                    <span>Comandos no Jogo:</span>
                    <code className="text-cyan-300 font-mono bg-cyan-950 px-1.5 py-0.5 rounded text-[11px]">/haif</code>
                    <code className="text-cyan-300 font-mono bg-cyan-950 px-1.5 py-0.5 rounded text-[11px]">/haif scan</code>
                    <code className="text-cyan-300 font-mono bg-cyan-950 px-1.5 py-0.5 rounded text-[11px]">/haif export</code>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    O botão do minimapa é arrastável e 100% compatível com a gaveta de addons do <strong>EllesmereUI</strong> e Blizzard Addon Compartment!
                  </p>
                </div>
              </div>

              {/* Step by Step Guide */}
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2.5">
                <h4 className="font-bold text-white flex items-center gap-1.5">
                  <Info size={14} className="text-cyan-400" />
                  Instruções de Instalação no Jogo:
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 text-zinc-300 leading-relaxed text-[11px]">
                  <li>Extraia a pasta <code className="bg-zinc-950 px-1 py-0.5 rounded text-cyan-300 font-mono">HaleckAccountImporterForever</code> dentro de <code className="bg-zinc-950 px-1 py-0.5 rounded text-cyan-300 font-mono">_classic_beta_/Interface/AddOns/</code> do seu World of Warcraft.</li>
                  <li className="text-cyan-200">
                    <strong className="text-cyan-300">⚔️ Pasta Oficial:</strong> O cliente de WoW Forever vem escrito no disco como <code className="bg-zinc-950 px-1 py-0.5 rounded text-amber-300 font-mono font-bold">World of Warcraft/_classic_beta_/</code>.
                  </li>
                  <li>No jogo, certifique-se de que o Addon está ativo no menu de AddOns e faça login no seu personagem.</li>
                  <li>Use o comando <code className="bg-zinc-950 px-1.5 py-0.5 rounded text-amber-300 font-mono font-bold">/haif</code> ou clique no ícone do minimapa.</li>
                  <li>Para importar aqui, selecione o arquivo <code className="bg-zinc-950 px-1 py-0.5 rounded text-cyan-300 font-mono">_classic_beta_/WTF/.../SavedVariables/HaleckAccountImporterForever.lua</code> ou use o scanner de 1 clique!</li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === "import" && (
            <div className="space-y-4">
              {/* Critical WoW Forever SavedVariables Tip */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-amber-950/50 via-zinc-900 to-amber-950/30 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5 shadow-sm">
                <Zap size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="text-white block font-bold">Dica Crucial de Salvamento no WoW Forever:</strong>
                  <p className="text-[11px] leading-relaxed text-zinc-300">
                    No jogo, após clicar em <strong className="text-amber-300">"Salvar Dados"</strong>, clique no botão <strong className="text-cyan-300">"⚡ Recarregar UI (/reload)"</strong> dentro do próprio addon ou digite <code className="bg-zinc-950 px-1 py-0.5 rounded font-mono text-cyan-300 font-bold">/reload</code> no chat. Isso faz o cliente do WoW Forever descarregar a memória e gravar o arquivo <code className="bg-zinc-950 px-1 py-0.5 rounded font-mono text-amber-300">_classic_beta_/WTF/.../SavedVariables/HaleckAccountImporter.lua</code> no disco imediatamente para ser importado aqui!
                  </p>
                </div>
              </div>

              {/* Method A & B */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-4 rounded-xl border border-dashed border-cyan-500/50 hover:border-cyan-400 bg-cyan-950/20 hover:bg-cyan-950/30 transition-all text-center space-y-1.5 cursor-pointer group"
                >
                  <Archive size={22} className="mx-auto text-cyan-400 group-hover:-translate-y-0.5 transition-transform" />
                  <span className="font-bold text-white block">Selecionar Arquivo .ZIP / .LUA / .JSON</span>
                  <span className="text-[10px] text-zinc-400 block font-mono">Pasta SavedVariables compactada (.zip) ou arquivo .lua</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".zip,.lua,.json,.txt"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={handleQueryLocalServer}
                  disabled={isSyncingServer}
                  className="p-4 rounded-xl border border-zinc-800 hover:border-zinc-700 bg-zinc-900/80 hover:bg-zinc-900 transition-all text-center space-y-1.5 cursor-pointer group disabled:opacity-50"
                >
                  <Server size={22} className={`mx-auto text-purple-400 group-hover:scale-105 transition-transform ${isSyncingServer ? "animate-spin" : ""}`} />
                  <span className="font-bold text-white block">Consultar Servidor Local</span>
                  <span className="text-[10px] text-zinc-400 block font-mono">Via API /api/blizzard/wow/addon-sync</span>
                </button>
              </div>

              {/* Direct Tutorial Callout Banner */}
              <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-zinc-300 text-[11px]">
                  <HelpCircle size={15} className="text-cyan-400 shrink-0" />
                  <span>Não sabe onde fica a pasta <strong>SavedVariables</strong> ou como criar o <strong>.ZIP</strong>?</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("tutorial")}
                  className="px-2.5 py-1 rounded-lg bg-cyan-950 border border-cyan-500/40 text-cyan-300 hover:text-white text-[11px] font-bold transition-colors cursor-pointer"
                >
                  Ver Tutorial Passo a Passo →
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

          {activeTab === "tutorial" && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-zinc-900 to-blue-950/30 border border-cyan-500/40 space-y-2">
                <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
                  <Archive size={18} />
                  <span>Tutorial: Onde Estão os Arquivos & Como Enviar Pasta .ZIP</span>
                </div>
                <p className="text-zinc-300 leading-relaxed text-[11px]">
                  Ao clicar em <strong>Salvar & Extrair</strong> dentro do jogo, o World of Warcraft salva automaticamente seus dados na pasta <code className="text-cyan-300 font-mono bg-zinc-950 px-1 py-0.5 rounded">SavedVariables</code>. Você pode enviar o arquivo individual ou compactar a pasta inteira em um arquivo <strong>.ZIP</strong> para carregar tudo de uma só vez!
                </p>
              </div>

              {/* Step by step cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Step 1 */}
                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-300 text-xs font-black">
                      1
                    </div>
                    <h4 className="font-bold text-white text-xs">Extrair Dados no Jogo</h4>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Dentro do jogo, digite <code className="text-amber-300 font-bold font-mono">/hai</code> ou clique no ícone do minimapa. Marque os parâmetros desejados e clique em <strong className="text-white">💾 SALVAR & EXTRAIR</strong>.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-300 text-xs font-black">
                      2
                    </div>
                    <h4 className="font-bold text-white text-xs">Localizar a Pasta no Disco</h4>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Abra o Windows Explorer (<code className="text-zinc-300 font-mono">Win + E</code>) e navegue até a pasta <code className="text-cyan-300 font-mono">WTF/Account/&lt;SUA_CONTA&gt;/SavedVariables/</code> da sua versão de WoW.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-300 text-xs font-black">
                      3
                    </div>
                    <h4 className="font-bold text-white text-xs">Criar o Arquivo .ZIP</h4>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Clique com o botão direito na pasta <strong className="text-white">SavedVariables</strong> (ou no arquivo <code className="text-cyan-300 font-mono">HaleckAccountImporter.lua</code>), selecione <strong>Enviar para &gt; Pasta compactada (.zip)</strong>.
                  </p>
                </div>

                {/* Step 4 */}
                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-300 text-xs font-black">
                      4
                    </div>
                    <h4 className="font-bold text-white text-xs">Carregar no Site</h4>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Vá na aba <strong>2. Importar Dados</strong>, clique no botão de seleção ou arraste o arquivo <code className="text-emerald-400 font-mono">.ZIP</code>. O site descompacta e importa tudo instantaneamente!
                  </p>
                </div>
              </div>

              {/* Exact Folder Paths for Each Version */}
              <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
                <h4 className="font-bold text-white text-xs flex items-center gap-2">
                  <FolderArchive size={15} className="text-amber-400" />
                  <span>Onde os arquivos estão gravados em cada versão do World of Warcraft:</span>
                </h4>

                <div className="space-y-2 text-[11px]">
                  {/* WoW Forever Beta */}
                  <div className="p-2.5 rounded-lg bg-zinc-950 border border-cyan-500/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-300">⭐ WoW Forever Beta (Vanilla+ - Build 16001 - Prioritário):</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText("World of Warcraft\\_classic_beta_\\WTF\\Account\\");
                          showToast({ title: "Copiado", message: "Caminho do WoW Forever copiado!", type: "success" });
                        }}
                        className="text-[10px] text-cyan-400 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Copy size={11} /> Copiar Caminho
                      </button>
                    </div>
                    <code className="block font-mono text-[10px] text-amber-200 bg-zinc-900/90 p-1.5 rounded break-all select-all">
                      World of Warcraft\_classic_beta_\WTF\Account\&lt;SUA_CONTA&gt;\SavedVariables\HaleckAccountImporter.lua
                    </code>
                    <p className="text-[10px] text-zinc-400">
                      <strong>Atenção Crítica:</strong> A pasta do cliente do WoW Forever Beta vem no disco nomeada como <code className="text-amber-300 font-bold font-mono">_classic_beta_</code>. Não confundir com <code className="text-zinc-500 font-mono">_classic_era_</code> nem <code className="text-zinc-500 font-mono">_classic_</code>!
                    </p>
                  </div>

                  {/* WoW Classic Era */}
                  <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">WoW Classic Era (1.15.x Original):</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText("World of Warcraft\\_classic_era_\\WTF\\Account\\");
                          showToast({ title: "Copiado", message: "Caminho do Classic Era copiado!", type: "success" });
                        }}
                        className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Copy size={11} /> Copiar Caminho
                      </button>
                    </div>
                    <code className="block font-mono text-[10px] text-zinc-300 bg-zinc-900/90 p-1.5 rounded break-all select-all">
                      World of Warcraft\_classic_era_\WTF\Account\&lt;SUA_CONTA&gt;\SavedVariables\HaleckAccountImporter.lua
                    </code>
                  </div>

                  {/* WoW Retail */}
                  <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-purple-300">WoW Retail (The War Within 11.x / Midnight):</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText("World of Warcraft\\_retail_\\WTF\\Account\\");
                          showToast({ title: "Copiado", message: "Caminho do Retail copiado!", type: "success" });
                        }}
                        className="text-[10px] text-purple-400 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Copy size={11} /> Copiar Caminho
                      </button>
                    </div>
                    <code className="block font-mono text-[10px] text-zinc-300 bg-zinc-900/90 p-1.5 rounded break-all select-all">
                      World of Warcraft\_retail_\WTF\Account\&lt;SUA_CONTA&gt;\SavedVariables\HaleckAccountImporter.lua
                    </code>
                  </div>
                </div>
              </div>

              {/* Action Button to switch to import */}
              <button
                type="button"
                onClick={() => setActiveTab("import")}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-600/20"
              >
                <Upload size={14} />
                <span>Ir para a Tela de Importação de Arquivo .ZIP / .LUA</span>
              </button>
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

          {/* TAB 5: WOW FOREVER (VANILLA+) & AS 5 MELHORIAS ATIVAS */}
          {activeTab === "forever" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Top Banner: WoW Forever Launch Countdown & Canonical Folder */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/40 via-cyan-950/40 to-zinc-900 border border-amber-500/40 space-y-2 shadow-lg">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-amber-300 font-black text-sm">
                    <Flame size={18} className="text-amber-400 animate-pulse" />
                    <span>WoW Forever (Vanilla+) • Lançamento Oficial: 04 de Novembro de 2026</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-500/50 text-amber-200 text-[10px] font-mono font-bold flex items-center gap-1">
                    <Clock size={12} /> {foreverStatus.daysUntilLaunch} dias restantes
                  </span>
                </div>
                <p className="text-zinc-300 leading-relaxed text-[11px]">
                  O Haleck Account Importer está com a arquitetura 100% otimizada para o <strong className="text-white">WoW Forever</strong>. Todas as 5 melhorias arquiteturais recomendadas foram implementadas e estão plenamente operacionais no Addon in-game e no backend do aplicativo.
                </p>
                <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-amber-500/30 flex items-center justify-between flex-wrap gap-2 text-[11px]">
                  <span className="text-zinc-300">
                    <strong className="text-amber-300">Pasta Oficial no Disco:</strong> <code className="text-cyan-300 font-mono font-bold bg-zinc-900 px-1.5 py-0.5 rounded">_classic_beta_</code> (Build 16001 do Beta)
                  </span>
                  <span className="text-zinc-400 text-[10px]">
                    Transição contínua para a pasta final no lançamento de 04/Nov/2026
                  </span>
                </div>
              </div>

              {/* The 5 Implemented Improvements */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle size={14} className="text-emerald-400" />
                  <span>As 5 Melhorias Arquiteturais Implementadas:</span>
                </h4>

                <div className="grid grid-cols-1 gap-2.5">
                  {/* Melhoria 1 */}
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-cyan-500/30 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500/60 text-cyan-300 font-mono text-[10px] font-bold flex items-center justify-center">1</span>
                        <strong className="text-cyan-300 text-xs font-bold">Sincronização Delta / Incremental</strong>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded">
                        HaleckAccountImporterDB.pendingChanges
                      </span>
                    </div>
                    <p className="text-zinc-300 text-[11px] leading-relaxed">
                      Em vez de regravar o perfil completo em disco a cada pequena mudança, o Addon grava apenas um log de alterações incrementais em sessão. No logout ou ao executar <code className="text-amber-300 font-mono">/hai save</code>, o snapshot completo é consolidado. Isso elimina travamentos de frame (hiccups) em computadores mais modestos ao abrir o banco ou transitar de mapa.
                    </p>
                  </div>

                  {/* Melhoria 2 */}
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-cyan-500/30 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500/60 text-cyan-300 font-mono text-[10px] font-bold flex items-center justify-center">2</span>
                        <strong className="text-cyan-300 text-xs font-bold">Rastreamento de World Bosses do Vanilla com Timers & Alertas</strong>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded">
                        6 Chefes Mundiais Monitorados
                      </span>
                    </div>
                    <p className="text-zinc-300 text-[11px] leading-relaxed">
                      Escuta ativa de gritos de monstro (<code className="text-amber-300 font-mono">CHAT_MSG_MONSTER_YELL</code>), eventos do Combat Log (<code className="text-amber-300 font-mono">UNIT_DIED</code>) e seleção de alvos de Lord Kazzak (Barreira do Inferno), Azuregos (Azshara) e dos 4 Dragões do Pesadelo (Taerar, Ysondre, Lethon e Emeriss). Ao detectar o abate, grava o horário exato e calcula a janela de respawn (72h a 96h) com alerta sonoro in-game.
                    </p>
                  </div>

                  {/* Melhoria 3 */}
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-cyan-500/30 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500/60 text-cyan-300 font-mono text-[10px] font-bold flex items-center justify-center">3</span>
                        <strong className="text-cyan-300 text-xs font-bold">Bufferização e Bloqueio Anti-Taint em Combate</strong>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded">
                        InCombatLockdown() Shield
                      </span>
                    </div>
                    <p className="text-zinc-300 text-[11px] leading-relaxed">
                      Todas as alterações de layout, redimensionamentos de frame e abertura de modais são bloqueadas durante o evento <code className="text-amber-300 font-mono">PLAYER_REGEN_DISABLED</code>. As ações são colocadas em um buffer protegido (<code className="text-cyan-200 font-mono">queuedCombatActions</code>) e executadas com segurança assim que o jogador sai de combate (<code className="text-amber-300 font-mono">PLAYER_REGEN_ENABLED</code>), evitando qualquer erro de interface em masmorras e raides do WoW Forever.
                    </p>
                  </div>

                  {/* Melhoria 4 */}
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-cyan-500/30 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500/60 text-cyan-300 font-mono text-[10px] font-bold flex items-center justify-center">4</span>
                        <strong className="text-cyan-300 text-xs font-bold">Compressão Nativa em Base64 / LibDeflate</strong>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded">
                        Prefixo !HAI4:DEF: (~10x Menor)
                      </span>
                    </div>
                    <p className="text-zinc-300 text-[11px] leading-relaxed">
                      Motor de compressão LZ77 + Huffman + Base64 nativo em Lua 5.1 puro embutido no Addon. Reduz payloads com milhares de itens, missões e feitiços para uma string compactada compacta, permitindo que o "Copiar e Colar" seja instantâneo sem congelar a janela de chat do jogo. O site descompacta o fluxo automaticamente via Pako / Web Streams.
                    </p>
                  </div>

                  {/* Melhoria 5 */}
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-cyan-500/30 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500/60 text-cyan-300 font-mono text-[10px] font-bold flex items-center justify-center">5</span>
                        <strong className="text-cyan-300 text-xs font-bold">Preparação para a API Oficial do WoW Forever (Pós-Lançamento Nov/2026)</strong>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded">
                        /api/blizzard/wow/forever/*
                      </span>
                    </div>
                    <p className="text-zinc-300 text-[11px] leading-relaxed">
                      Adaptador backend preparado para os endpoints REST oficiais da Blizzard assim que publicados no Battle.net Developer Portal sob o namespace <code className="text-cyan-300 font-mono">profile-forever</code> e <code className="text-cyan-300 font-mono">dynamic-forever</code>. O motor realiza uma <strong>fusão híbrida</strong>: consome dados autoritativos do servidor oficial enquanto mantém o Addon in-game como fornecedor exclusivo de passos reais em km, mortes Hardcore solenes e inventário detalhado de bolsas e banco.
                    </p>
                  </div>
                </div>
              </div>

              {/* World Bosses Monitor Table */}
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Flame size={14} className="text-amber-400" />
                    <span>World Bosses do Vanilla+ Monitorados:</span>
                  </h4>
                  <button
                    type="button"
                    onClick={async () => {
                      setLoadingForeverApi(true);
                      try {
                        const res = await fetch("/api/blizzard/wow/forever/world-bosses");
                        const data = await res.json();
                        if (data.bosses) setWorldBosses(data.bosses);
                        setForeverApiResponse(data);
                        showToast({ title: "Atualizado", message: "Status dos World Bosses sincronizado!", type: "success" });
                      } catch (e: any) {
                        showToast({ title: "Erro", message: e.message || "Erro ao consultar chefes", type: "error" });
                      } finally {
                        setLoadingForeverApi(false);
                      }
                    }}
                    className="text-[11px] text-cyan-300 hover:text-white bg-cyan-950/80 border border-cyan-500/40 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RefreshCw size={11} className={loadingForeverApi ? "animate-spin" : ""} />
                    <span>Consultar Status Live</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  {worldBosses.map((boss) => (
                    <div key={boss.key} className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center gap-3">
                      <img src={boss.iconUrl} alt={boss.name} className="w-9 h-9 rounded-lg border border-zinc-700 shrink-0 object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <strong className="text-white truncate">{boss.name}</strong>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                            boss.status === "Available"
                              ? "bg-emerald-950 border border-emerald-500/50 text-emerald-300"
                              : boss.status === "Defeated"
                              ? "bg-red-950 border border-red-500/50 text-red-300"
                              : "bg-amber-950 border border-amber-500/50 text-amber-300"
                          }`}>
                            {boss.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 truncate">{boss.zone}</p>
                        <p className="text-[9px] text-zinc-500 font-mono">
                          Janela: {boss.minRespawnHours}h a {boss.maxRespawnHours}h
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Endpoint Tester */}
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Database size={13} className="text-cyan-400" />
                    <span>Testador de Endpoints do Adaptador Backend:</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        setLoadingForeverApi(true);
                        try {
                          const res = await fetch("/api/blizzard/wow/forever/status");
                          const data = await res.json();
                          setForeverApiResponse(data);
                          showToast({ title: "OK", message: "Status do endpoint retornado!", type: "success" });
                        } catch (e: any) {
                          setForeverApiResponse({ error: e.message });
                        } finally {
                          setLoadingForeverApi(false);
                        }
                      }}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] cursor-pointer"
                    >
                      /forever/status
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setLoadingForeverApi(true);
                        try {
                          const res = await fetch("/api/blizzard/wow/forever/world-bosses");
                          const data = await res.json();
                          setForeverApiResponse(data);
                          showToast({ title: "OK", message: "World bosses endpoint retornado!", type: "success" });
                        } catch (e: any) {
                          setForeverApiResponse({ error: e.message });
                        } finally {
                          setLoadingForeverApi(false);
                        }
                      }}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] cursor-pointer"
                    >
                      /forever/world-bosses
                    </button>
                  </div>
                </div>

                {foreverApiResponse && (
                  <pre className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-[10px] text-cyan-200 overflow-x-auto max-h-36">
                    {JSON.stringify(foreverApiResponse, null, 2)}
                  </pre>
                )}
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

      {/* INTERACTIVE IN-GAME ADDON & ADVENTURE JOURNAL SIMULATOR */}
      <WoWAddonPreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        profile={parsedResult?.activeProfile}
        activeCharacterName={charName}
        activeCharacterRealm={realmName}
        gameVersion={selectedVersion}
      />
    </div>
  );
};

export default AddonExportModal;
