/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import {
  Code,
  FileCode,
  Download,
  Copy,
  Check,
  ExternalLink,
  BookOpen,
  Layers,
  Sparkles,
  Shield,
  HelpCircle,
  FolderArchive,
  Info,
  ChevronRight,
  Terminal,
  Search,
  X,
  FileText,
  AlertCircle,
  Database,
  Cpu,
  RefreshCw,
  Coins,
  Crown,
  Vault,
} from "lucide-react";
import {
  WOW_ADDON_DEV_SOURCES,
  WOW_VERSION_DIFFERENCES,
  WOW_DEPRECATED_FUNCTION_MAP,
  WOW_GOLDEN_RULES,
  CustomAddonTemplateOptions,
  generateCustomAddonTemplate,
  downloadCustomAddonTemplateZip,
  downloadCustomAddonFile,
  getInterfaceVersionForGame,
  getFriendlyGameVersionName,
} from "../utils/addonExportService";

interface WoWAddonDevModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialGameVersion?: "retail" | "classic" | "forever" | "forever_beta";
  triggerAlert?: (title: string, message: string) => void;
}

export const WoWAddonDevModal: React.FC<WoWAddonDevModalProps> = ({
  isOpen,
  onClose,
  initialGameVersion = "forever",
  triggerAlert,
}) => {
  const [activeTab, setActiveTab] = useState<"template" | "sources" | "differences" | "deprecated" | "golden_rules" | "internal_docs">("template");

  // Template Form State
  const [gameVersion, setGameVersion] = useState<"retail" | "classic" | "forever" | "forever_beta">(initialGameVersion);
  const [addonName, setAddonName] = useState("MeuNovoAddon");
  const [addonTitle, setAddonTitle] = useState("Meu Novo Addon");
  const [author, setAuthor] = useState("Haleck");
  const [version, setVersion] = useState("1.0.0");
  const [notes, setNotes] = useState("Addon universal customizado gerado via Haleck Studio");
  const [savedVariables, setSavedVariables] = useState("MeuNovoAddonDB");
  const [slashCommand, setSlashCommand] = useState("/meuaddon");
  const [includeEventFrame, setIncludeEventFrame] = useState(true);
  const [includeBankTrackingSnippet, setIncludeBankTrackingSnippet] = useState(true);
  const [includeMythicOrWorldBossSnippet, setIncludeMythicOrWorldBossSnippet] = useState(true);

  // File Preview Active Tab
  const [previewTab, setPreviewTab] = useState<"toc" | "lua" | "readme">("toc");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Search filter for sources and deprecated map
  const [sourcesSearch, setSourcesSearch] = useState("");
  const [deprecatedSearch, setDeprecatedSearch] = useState("");

  const templateOptions: CustomAddonTemplateOptions = useMemo(() => ({
    addonName,
    gameVersion,
    title: addonTitle,
    author,
    version,
    notes,
    savedVariables,
    slashCommand,
    includeEventFrame,
    includeBankTrackingSnippet,
    includeMythicOrWorldBossSnippet,
  }), [
    addonName,
    gameVersion,
    addonTitle,
    author,
    version,
    notes,
    savedVariables,
    slashCommand,
    includeEventFrame,
    includeBankTrackingSnippet,
    includeMythicOrWorldBossSnippet,
  ]);

  const generatedFiles = useMemo(() => {
    return generateCustomAddonTemplate(templateOptions);
  }, [templateOptions]);

  const copyToClipboard = async (text: string, key: string, label: string) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 3000);
        if (triggerAlert) {
          triggerAlert("Copiado com Sucesso!", `${label} foi copiado para a sua área de transferência.`);
        }
      }
    } catch (err) {
      console.error("Falha ao copiar:", err);
    }
  };

  const handleDownloadZip = async () => {
    try {
      await downloadCustomAddonTemplateZip(templateOptions);
      if (triggerAlert) {
        triggerAlert("Download Iniciado", `O pacote ZIP para ${generatedFiles.folderName} foi gerado com sucesso.`);
      }
    } catch (err: any) {
      if (triggerAlert) {
        triggerAlert("Erro ao baixar", err?.message || "Não foi possível gerar o ZIP.");
      }
    }
  };

  const handleDownloadCurrentFile = () => {
    if (previewTab === "toc") {
      downloadCustomAddonFile(`${generatedFiles.folderName}.toc`, generatedFiles.toc);
    } else if (previewTab === "lua") {
      downloadCustomAddonFile(`${generatedFiles.folderName}.lua`, generatedFiles.lua);
    } else {
      downloadCustomAddonFile("README.txt", generatedFiles.readme);
    }
  };

  const filteredSources = useMemo(() => {
    const q = sourcesSearch.toLowerCase().trim();
    if (!q) return WOW_ADDON_DEV_SOURCES;
    return WOW_ADDON_DEV_SOURCES.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.url.toLowerCase().includes(q) ||
        s.badge.toLowerCase().includes(q)
    );
  }, [sourcesSearch]);

  const filteredDeprecated = useMemo(() => {
    const q = deprecatedSearch.toLowerCase().trim();
    if (!q) return WOW_DEPRECATED_FUNCTION_MAP;
    return WOW_DEPRECATED_FUNCTION_MAP.filter(
      (m) =>
        m.legacy.toLowerCase().includes(q) ||
        m.modern.toLowerCase().includes(q) ||
        m.notes.toLowerCase().includes(q)
    );
  }, [deprecatedSearch]);

  const systemPromptTemplate = useMemo(() => {
    return `You are a World of Warcraft Addon Development Expert specializing in Lua and the Blizzard UI FrameXML API.
Target Client: ${getFriendlyGameVersionName(gameVersion)} (Interface: ${getInterfaceVersionForGame(gameVersion)})

MANDATORY RULES:
1. NEVER overwrite global functions from Blizzard (Anti-Taint). Keep your logic inside a local namespace: "local ADDON_NAME, addon = ...".
2. Wrap risky or version-dependent APIs in pcall().
3. Load SavedVariables only in the ADDON_LOADED event checking that the loaded addon name matches your addon.
4. For WoW Retail (The War Within), use modern C_ namespaces (e.g. C_Container, C_Item, C_Bank). For Classic/Forever, use legacy global fallbacks if C_ is not present.
5. Create clean .toc files with accurate ## Interface, ## SavedVariables, and ## Title.`;
  }, [gameVersion]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-5xl bg-[#0c0d14] border border-cyan-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl text-white space-y-4 overflow-hidden max-h-[92vh] flex flex-col cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Decorative Gradient Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 via-sky-500 via-indigo-500 to-amber-500" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          title="Fechar"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pr-8">
          <div className="p-2.5 bg-cyan-500/15 border border-cyan-500/40 rounded-2xl text-cyan-400 shrink-0 shadow-lg shadow-cyan-500/20">
            <Code size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Add-on Dev Studio & Fontes de Documentação
              </h3>
              <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/80 border border-cyan-500/40 px-2 py-0.5 rounded-full uppercase tracking-wider">
                WoW Lua API
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Gerador de boilerplates para Retail, Classic e Forever + Acesso rápido a fontes oficiais da Blizzard e Wago
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 border-b border-zinc-800 pb-2 overflow-x-auto custom-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("template")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === "template"
                ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/30"
                : "text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
            }`}
          >
            <Sparkles size={13} />
            <span>Gerador de Template (.toc / .lua)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sources")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === "sources"
                ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                : "text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
            }`}
          >
            <BookOpen size={13} />
            <span>Fontes & Documentação Oficial</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-950 text-sky-200">
              {WOW_ADDON_DEV_SOURCES.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("differences")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === "differences"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                : "text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
            }`}
          >
            <Layers size={13} />
            <span>Diferenças de Versão</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("deprecated")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === "deprecated"
                ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                : "text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
            }`}
          >
            <RefreshCw size={13} />
            <span>APIs Deprecadas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("golden_rules")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === "golden_rules"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                : "text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
            }`}
          >
            <Shield size={13} />
            <span>Regras de Ouro & Prompt IA</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("internal_docs")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === "internal_docs"
                ? "bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-600/30"
                : "text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
            }`}
          >
            <BookOpen size={13} />
            <span>Diretrizes & WoW Forever (04/Nov)</span>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30">
              Ecosystem
            </span>
          </button>
        </div>

        {/* Scrollable Main Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">

          {/* TAB 1: TEMPLATE GENERATOR */}
          {activeTab === "template" && (
            <div className="space-y-4">
              {/* Version Selector Banner */}
              <div className="p-3.5 bg-zinc-900/90 border border-cyan-500/30 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={14} />
                    1. Selecione a Versão Alvo do World of Warcraft
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    Interface: <strong className="text-white">{getInterfaceVersionForGame(gameVersion)}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "forever" as const, label: "WoW Forever (Vanilla+)", desc: "Lançamento Oficial 04/Nov • Principal", badge: "16001", isPrimary: true },
                    { id: "forever_beta" as const, label: "Forever Beta", desc: "Build 16001 em Testes", badge: "16001", isPrimary: false },
                    { id: "classic" as const, label: "Classic Era", desc: "Vanilla 1.15.x", badge: "11506", isPrimary: false },
                    { id: "retail" as const, label: "Retail (11.0+)", desc: "The War Within / Midnight", badge: "110100", isPrimary: false },
                  ].map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setGameVersion(v.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between relative ${
                        gameVersion === v.id
                          ? "bg-cyan-950/70 border-cyan-400 text-white shadow-md shadow-cyan-900/30 ring-1 ring-cyan-400/40"
                          : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{v.label}</span>
                        <span className="text-[9px] font-mono px-1 rounded bg-black/40 text-cyan-300">
                          {v.badge}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500 mt-1">{v.desc}</span>
                      {v.isPrimary && (
                        <span className="mt-1 text-[8px] font-extrabold uppercase tracking-wider text-cyan-300 bg-cyan-950/90 border border-cyan-500/40 px-1.5 py-0.5 rounded-md inline-block w-fit">
                          ⭐ Jogo Principal
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Customization Controls (2 columns) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Column A: Metadata */}
                <div className="p-3.5 bg-zinc-900/80 border border-zinc-800 rounded-2xl space-y-3">
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={13} className="text-cyan-400" />
                    2. Identificação do Add-on (.toc)
                  </h4>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                        Nome da Pasta / ID
                      </label>
                      <input
                        type="text"
                        value={addonName}
                        onChange={(e) => setAddonName(e.target.value)}
                        placeholder="Ex: MeuAddon"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                        Título Exibido
                      </label>
                      <input
                        type="text"
                        value={addonTitle}
                        onChange={(e) => setAddonTitle(e.target.value)}
                        placeholder="Ex: Meu Addon Incrível"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                        Autor
                      </label>
                      <input
                        type="text"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                        Versão
                      </label>
                      <input
                        type="text"
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                      SavedVariables (Conta)
                    </label>
                    <input
                      type="text"
                      value={savedVariables}
                      onChange={(e) => setSavedVariables(e.target.value)}
                      placeholder="Ex: MeuAddonDB"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                      Comando de Barra (/slash)
                    </label>
                    <input
                      type="text"
                      value={slashCommand}
                      onChange={(e) => setSlashCommand(e.target.value)}
                      placeholder="Ex: /meuaddon"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Column B: Features & Toggles */}
                <div className="p-3.5 bg-zinc-900/80 border border-zinc-800 rounded-2xl space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Terminal size={13} className="text-amber-400" />
                      3. Módulos & Recursos Integrados (.lua)
                    </h4>

                    <div className="space-y-2">
                      <label className="flex items-start gap-2.5 p-2 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeEventFrame}
                          onChange={(e) => setIncludeEventFrame(e.target.checked)}
                          className="mt-0.5 rounded text-cyan-500 focus:ring-0"
                        />
                        <div>
                          <span className="text-xs font-bold text-white block">
                            Ciclo de Eventos (ADDON_LOADED & PLAYER_LOGIN)
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            Inicialização segura de SavedVariables e mensagens no chat.
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 p-2 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeBankTrackingSnippet}
                          onChange={(e) => setIncludeBankTrackingSnippet(e.target.checked)}
                          className="mt-0.5 rounded text-cyan-500 focus:ring-0"
                        />
                        <div>
                          <span className="text-xs font-bold text-white block">
                            Snippet de Rastreamento de Banco & Warband
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            Escaneamento automático em BANK_FRAME_OPENED (Suporte a Warband no Retail).
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 p-2 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeMythicOrWorldBossSnippet}
                          onChange={(e) => setIncludeMythicOrWorldBossSnippet(e.target.checked)}
                          className="mt-0.5 rounded text-cyan-500 focus:ring-0"
                        />
                        <div>
                          <span className="text-xs font-bold text-white block">
                            Snippet de Mítico+ (Retail) ou World Bosses (Classic)
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            Lê pontuação de masmorras míticas ou temporizadores de chefes de mundo.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-2 border-t border-zinc-800 flex gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadZip}
                      className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-600/30 transition-all cursor-pointer"
                    >
                      <FolderArchive size={14} />
                      <span>Baixar Pacote Completo (.ZIP)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadCurrentFile}
                      className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-zinc-700 shrink-0"
                      title="Baixar arquivo da aba ativa"
                    >
                      <Download size={13} />
                      <span>Baixar .{previewTab}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Code Previewer Box */}
              <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewTab("toc")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        previewTab === "toc"
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <FileCode size={12} />
                      <span>{generatedFiles.folderName}.toc</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPreviewTab("lua")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        previewTab === "lua"
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <Code size={12} />
                      <span>{generatedFiles.folderName}.lua</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPreviewTab("readme")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        previewTab === "readme"
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <FileText size={12} />
                      <span>README.txt</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const text =
                        previewTab === "toc"
                          ? generatedFiles.toc
                          : previewTab === "lua"
                          ? generatedFiles.lua
                          : generatedFiles.readme;
                      copyToClipboard(text, previewTab, `Código de ${previewTab.toUpperCase()}`);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {copiedKey === previewTab ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        <span className="text-emerald-400">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copiar Código</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative">
                  <pre className="p-3 bg-zinc-900/90 border border-zinc-800/80 rounded-xl text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-60 leading-relaxed custom-scrollbar selection:bg-cyan-500 selection:text-black">
                    {previewTab === "toc" && generatedFiles.toc}
                    {previewTab === "lua" && generatedFiles.lua}
                    {previewTab === "readme" && generatedFiles.readme}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SOURCES & DOCUMENTATION */}
          {activeTab === "sources" && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-2.5 text-zinc-500" />
                  <input
                    type="text"
                    value={sourcesSearch}
                    onChange={(e) => setSourcesSearch(e.target.value)}
                    placeholder="Filtrar por nome, URL, biblioteca ou categoria..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <span className="text-xs text-zinc-400 whitespace-nowrap">
                  {filteredSources.length} de {WOW_ADDON_DEV_SOURCES.length} fontes
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredSources.map((source, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-zinc-900/80 border border-zinc-800 hover:border-cyan-500/50 rounded-2xl space-y-2.5 transition-all shadow-md group flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-xs text-white group-hover:text-cyan-300 transition-colors">
                          {source.title}
                        </h4>
                        <span className="text-[9px] font-semibold text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded-full shrink-0">
                          {source.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        {source.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[240px]">
                        {source.url.replace(/^https?:\/\//, "")}
                      </span>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(source.url, `src-${idx}`, "Link")}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                          title="Copiar URL"
                        >
                          {copiedKey === `src-${idx}` ? (
                            <Check size={12} className="text-emerald-400" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold flex items-center gap-1 transition-colors"
                        >
                          <span>Acessar</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: VERSION DIFFERENCES */}
          {activeTab === "differences" && (
            <div className="space-y-4">
              <div className="p-3 bg-purple-950/30 border border-purple-500/30 rounded-2xl text-xs text-purple-200 flex items-center gap-2">
                <Info size={16} className="text-purple-400 shrink-0" />
                <span>
                  Cada versão do WoW possui um número de <strong>Interface ID</strong> no arquivo <code>.toc</code> e conjuntos específicos de APIs disponíveis.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {WOW_VERSION_DIFFERENCES.map((diff, idx) => (
                  <div
                    key={idx}
                    className={`p-4 bg-zinc-900/80 border rounded-2xl space-y-2.5 ${diff.tagColor}`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-sm text-white">{diff.name}</h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/50 border border-white/20">
                        Interface: {diff.interfaceVersion}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div>
                        <span className="font-bold text-zinc-300">Características:</span>
                        <p className="text-zinc-400 mt-0.5 leading-relaxed">{diff.keyCharacteristics}</p>
                      </div>
                      <div>
                        <span className="font-bold text-amber-300">Atenção & Ressalvas:</span>
                        <p className="text-zinc-400 mt-0.5 leading-relaxed">{diff.caveats}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Matrix Table */}
              <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Matriz de Compatibilidade de APIs Críticas
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] text-left">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400">
                        <th className="py-1.5 px-2">Recurso / API</th>
                        <th className="py-1.5 px-2">Retail (11.x)</th>
                        <th className="py-1.5 px-2">Classic Era (1.15)</th>
                        <th className="py-1.5 px-2">WoW Forever (1.12.1)</th>
                        <th className="py-1.5 px-2">Forever Beta (16001)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-mono text-zinc-300">
                      <tr>
                        <td className="py-2 px-2 text-white font-sans font-bold">Mochilas & Banco</td>
                        <td className="py-2 px-2 text-emerald-400">C_Container</td>
                        <td className="py-2 px-2 text-amber-400">GetContainerItemID</td>
                        <td className="py-2 px-2 text-amber-400">GetContainerItemID</td>
                        <td className="py-2 px-2 text-sky-400">Global + pcall</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2 text-white font-sans font-bold">Warband Bank</td>
                        <td className="py-2 px-2 text-emerald-400">C_Bank.FetchPurchasedBankTabData</td>
                        <td className="py-2 px-2 text-rose-400">Não Suportado</td>
                        <td className="py-2 px-2 text-rose-400">Não Suportado</td>
                        <td className="py-2 px-2 text-rose-400">Não Suportado</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2 text-white font-sans font-bold">Mítico+ & Vault</td>
                        <td className="py-2 px-2 text-emerald-400">C_MythicPlus / C_WeeklyRewards</td>
                        <td className="py-2 px-2 text-rose-400">N/A</td>
                        <td className="py-2 px-2 text-rose-400">N/A</td>
                        <td className="py-2 px-2 text-rose-400">N/A</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2 text-white font-sans font-bold">Chefes Mundiais</td>
                        <td className="py-2 px-2 text-zinc-400">World Quests</td>
                        <td className="py-2 px-2 text-emerald-400">Kazzak / Azuregos / Dragões</td>
                        <td className="py-2 px-2 text-emerald-400">Kazzak / Azuregos / Dragões</td>
                        <td className="py-2 px-2 text-emerald-400">Respawn Timers custom</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2 text-white font-sans font-bold">Regras do Servidor</td>
                        <td className="py-2 px-2 text-zinc-400">Padrão Oficial</td>
                        <td className="py-2 px-2 text-zinc-400">Padrão Era</td>
                        <td className="py-2 px-2 text-sky-400">GetRuleset()</td>
                        <td className="py-2 px-2 text-sky-400">C_GameRules / GetRuleset</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DEPRECATED FUNCTIONS */}
          {activeTab === "deprecated" && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-2.5 text-zinc-500" />
                  <input
                    type="text"
                    value={deprecatedSearch}
                    onChange={(e) => setDeprecatedSearch(e.target.value)}
                    placeholder="Buscar função antiga ou substituição moderna C_..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-2xl text-xs text-amber-200 flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-400 shrink-0" />
                <span>
                  No Retail, funções globais foram empacotadas em namespaces <code>C_*</code>. Addons multi-versão devem usar fallbacks condicionais: <code>(C_Container and C_Container.Func) or Func</code>.
                </span>
              </div>

              <div className="space-y-2.5">
                {filteredDeprecated.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-zinc-900/80 border border-zinc-800 rounded-2xl space-y-2 hover:border-amber-500/40 transition-all shadow-md"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-rose-400 font-mono text-xs line-through bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/40">
                          {item.legacy}
                        </span>
                        <ChevronRight size={14} className="text-zinc-500" />
                        <span className="text-emerald-400 font-mono text-xs font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/40">
                          {item.modern}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            `local function Safe_${item.modern.split(".")[1] || "Call"}(...)\n    if ${item.modern.split(".")[0]} and ${item.modern} then\n        return ${item.modern}(...)\n    elseif ${item.legacy.split("(")[0]} then\n        return ${item.legacy.split("(")[0]}(...)\n    end\nend`,
                            `dep-${idx}`,
                            "Código de Compatibilidade"
                          )
                        }
                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300 font-mono flex items-center gap-1 transition-colors cursor-pointer"
                        title="Copiar wrapper universal"
                      >
                        {copiedKey === `dep-${idx}` ? (
                          <>
                            <Check size={11} className="text-emerald-400" />
                            <span className="text-emerald-400">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} />
                            <span>Copiar Wrapper</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-zinc-400">{item.notes}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: GOLDEN RULES & AI SYSTEM PROMPT */}
          {activeTab === "golden_rules" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {WOW_GOLDEN_RULES.map((rule, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-zinc-900/80 border border-emerald-500/30 rounded-2xl space-y-2 shadow-md"
                  >
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                      <Shield size={15} />
                      <span>{rule.rule}</span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">{rule.detail}</p>
                  </div>
                ))}
              </div>

              {/* AI Coding Prompt Copier */}
              <div className="p-4 bg-zinc-900 border border-cyan-500/30 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-cyan-400" />
                    <h4 className="font-bold text-sm text-white">System Prompt de IA para Desenvolvimento</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(systemPromptTemplate, "ai-prompt", "System Prompt para IA")}
                    className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-cyan-600/30"
                  >
                    {copiedKey === "ai-prompt" ? (
                      <>
                        <Check size={13} className="text-white" />
                        <span>Prompt Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copiar System Prompt</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-xs text-zinc-400">
                  Use este prompt com seu modelo de IA favorito (ChatGPT, Claude, Gemini) para instruí-lo a gerar código Lua e arquivos <code>.toc</code> seguindo as regras de ouro sem alucinar funções inexistentes.
                </p>

                <pre className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-48 leading-relaxed custom-scrollbar">
                  {systemPromptTemplate}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 6: INTERNAL DOCUMENTATION & WOW FOREVER ECOSYSTEM */}
          {activeTab === "internal_docs" && (
            <div className="space-y-4">
              {/* Highlight Hero Banner for WoW Forever Launch */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/80 via-zinc-900 to-indigo-950/80 border border-cyan-500/50 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 font-black text-xs border border-cyan-500/40">
                      Vanilla+
                    </span>
                    <h4 className="text-sm font-extrabold text-white">
                      WoW Forever: Lançamento Oficial em 04 de Novembro de 2026
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-950 border border-cyan-500/40 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    ⭐ Jogo Principal do Haleck
                  </span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  O ambiente do site e do Addon Universal foi arquitetado para suportar nativamente a transição da versão Beta (Build 16001) para o lançamento oficial. Todas as ferramentas priorizam a estabilidade em Vanilla+, detecção dinâmica de regras (Rulesets) e proteção contra taints de interface.
                </p>
              </div>

              {/* Critical Beta Guidelines: Secret Health Values & Dead Secure SNI */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 bg-zinc-900/90 border border-rose-500/40 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
                    <AlertCircle size={15} className="text-rose-400" />
                    <span>Secret Health Values (Beta & Release)</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    No WoW Forever Beta e no lançamento oficial, valores exatos numéricos de pontos de vida de jogadores e chefes são protegidos contra automações abusivas. Os addons devem operar com porcentagens ou tratar chamadas com <code>pcall</code> defensivo para não quebrar a UI em combate.
                  </p>
                </div>

                <div className="p-3.5 bg-zinc-900/90 border border-amber-500/40 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                    <Shield size={15} className="text-amber-400" />
                    <span>Dead Secure SNI & Anti-Taint</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Chamadas seguras do cliente de jogo exigem isolamento absoluto do namespace (<code>local ADDON_NAME, addon = ...</code>). Jamais modifique metatables nativas da Blizzard ou variáveis globais para garantir que seus botões continuem clicáveis em combate.
                  </p>
                </div>
              </div>

              {/* Strict Version Differentiation Notice */}
              <div className="p-3.5 bg-zinc-900/90 border border-purple-500/40 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
                  <Layers size={15} className="text-purple-400" />
                  <span>Distinção Rígida de Recursos: Retail vs. Classic vs. Forever</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-300 pt-1">
                  <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800">
                    <strong className="text-cyan-300 block mb-1">WoW Forever & Classic:</strong>
                    <ul className="list-disc list-inside space-y-1 text-zinc-400 text-[11px]">
                      <li>Banco Pessoal do Personagem e de Reagentes</li>
                      <li>Economia Global da Conta (Somatório de ouro de todos os alts)</li>
                      <li><strong>Chefes Mundiais:</strong> Kazzak, Azuregos, Dragões do Pesadelo e cronômetros de respawn</li>
                      <li>Sem poluição de recursos de expansões futuras</li>
                    </ul>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800">
                    <strong className="text-purple-300 block mb-1">WoW Retail (The War Within):</strong>
                    <ul className="list-disc list-inside space-y-1 text-zinc-400 text-[11px]">
                      <li><strong>Cofre de Guerra (Warband Bank):</strong> Abas compartilhadas de conta</li>
                      <li><strong>Mítico+:</strong> Mythic Score oficial e pedra-chave do inventário</li>
                      <li><strong>The Great Vault:</strong> Progresso semanal de Raids, Dungeons e Delves</li>
                      <li>Namespaces modernos C_ (C_Container, C_Bank, C_MythicPlus)</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Client Folders & Path Mapping Reference */}
              <div className="p-3.5 bg-zinc-900/90 border border-cyan-500/40 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                    <FolderArchive size={15} className="text-cyan-400" />
                    <span>Mapeamento de Pastas de Instalação no Disco</span>
                  </div>
                  <span className="text-[10px] bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded font-mono">
                    Prioridade WoW Forever Beta
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-zinc-300">
                  <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-cyan-500/30">
                    <div className="flex items-center justify-between">
                      <strong className="text-amber-300 text-[11px] font-bold">⭐ WoW Forever Beta (Vanilla+ - Build 16001):</strong>
                      <code className="text-[10px] text-cyan-300 bg-zinc-900 px-1.5 py-0.5 rounded font-mono">_classic_beta_</code>
                    </div>
                    <p className="text-[11px] text-zinc-300 mt-1">
                      A pasta do WoW Forever Beta vem escrita no disco como <code className="text-cyan-300 font-bold font-mono">World of Warcraft/_classic_beta_/</code>.
                    </p>
                    <div className="mt-1 text-[10px] text-zinc-400 font-mono space-y-0.5">
                      <div>Addons: <span className="text-zinc-300">World of Warcraft/_classic_beta_/Interface/AddOns/</span></div>
                      <div>SavedVariables: <span className="text-zinc-300">World of Warcraft/_classic_beta_/WTF/Account/&lt;CONTA&gt;/SavedVariables/HaleckAccountImporter.lua</span></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded-xl bg-zinc-950/60 border border-zinc-800">
                      <strong className="text-zinc-200 block text-[10px] uppercase font-bold text-cyan-400">WoW Classic Era / Forever Oficial:</strong>
                      <code className="text-[10px] text-zinc-300 font-mono">World of Warcraft/_classic_era_/</code>
                    </div>
                    <div className="p-2 rounded-xl bg-zinc-950/60 border border-zinc-800">
                      <strong className="text-zinc-200 block text-[10px] uppercase font-bold text-purple-400">WoW Retail (The War Within):</strong>
                      <code className="text-[10px] text-zinc-300 font-mono">World of Warcraft/_retail_/</code>
                    </div>
                  </div>
                </div>
              </div>

              {/* 12 Canonical Documentation Sources Quick Reference */}
              <div className="p-4 bg-zinc-900/90 border border-zinc-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen size={14} className="text-cyan-400" />
                    <span>As 12 Fontes Canônicas Integradas</span>
                  </h4>
                  <span className="text-[11px] text-zinc-400 font-mono">docs/WOW_ADDON_ECOSYSTEM.md</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {WOW_ADDON_DEV_SOURCES.map((s, idx) => (
                    <a
                      key={idx}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 hover:border-cyan-500/50 transition-all flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-xs font-bold text-white group-hover:text-cyan-300 truncate block">
                          {s.title}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono truncate block">
                          {s.badge}
                        </span>
                      </div>
                      <ExternalLink size={12} className="text-zinc-500 group-hover:text-cyan-400 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Haleck Studio WoW Add-on Development Kit</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default WoWAddonDevModal;
