/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Auto-Scanner & Database Ingestion Card for WoW Forever / Classic / Retail
 * Intelligent root folder selection, directory auto-scan, SavedVariables parsing,
 * and account/realm/character subdivision with database synchronization.
 */

import React, { useRef, useState } from "react";
import {
  FolderSearch,
  FolderOpen,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Coins,
  Users,
  Database,
  ChevronDown,
  ChevronRight,
  HardDrive,
  Save,
  ExternalLink,
  ShieldCheck,
  Server,
  FileCode2,
} from "lucide-react";
import { WoWScanResult, ScannedAccountGroup, downloadAutoScanScriptBat } from "../../utils/wowDirectoryScannerService";

interface BlizzardAddonScannerCardProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isScanning: boolean;
  scanResult: WoWScanResult | null;
  wowRootPath: string;
  onUpdateWoWRootPath: (newPath: string) => void;
  onSaveWoWRootPath: () => void;
  onScanAndImport: () => void;
  onScanFromFiles: (files: FileList) => void;
  onClearScanResult?: () => void;
  triggerAlert?: (title: string, message: string) => void;
}

export const BlizzardAddonScannerCard: React.FC<BlizzardAddonScannerCardProps> = ({
  isCollapsed,
  onToggle,
  isScanning,
  scanResult,
  wowRootPath,
  onUpdateWoWRootPath,
  onSaveWoWRootPath,
  onScanAndImport,
  onScanFromFiles,
  onClearScanResult,
  triggerAlert,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directFilesInputRef = useRef<HTMLInputElement>(null);
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({});

  const toggleAccount = (accName: string) => {
    setExpandedAccounts((prev) => ({
      ...prev,
      [accName]: !prev[accName],
    }));
  };

  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onScanFromFiles(e.target.files);
    }
  };

  const handleDirectFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onScanFromFiles(e.target.files);
    }
  };

  const handleOpenFolderPicker = () => {
    const isInIframe = typeof window !== "undefined" && window.self !== window.top;
    if (isInIframe) {
      // In iframe, direct input trigger avoids cross-origin SecurityError
      fileInputRef.current?.click();
    } else {
      // In top-level frame, attempt directory scan
      try {
        onScanAndImport();
      } catch {
        fileInputRef.current?.click();
      }
    }
  };

  // Extract current drive letter or default to C:
  const currentDriveMatch = (wowRootPath || "").match(/^([a-zA-Z]:)/);
  const activeDrive = currentDriveMatch ? currentDriveMatch[1].toUpperCase() : "C:";

  const changeDrive = (newDrive: string) => {
    const current = (wowRootPath || "").trim();
    let updated = current;
    if (/^[a-zA-Z]:/.test(current)) {
      updated = `${newDrive}${current.slice(2)}`;
    } else {
      updated = `${newDrive}\\Program Files (x86)\\World of Warcraft\\_classic_beta_`;
    }
    onUpdateWoWRootPath(updated);
    if (triggerAlert) {
      triggerAlert("Unidade Alterada", `Caminho do Scanner ajustado para a unidade ${newDrive}: ${updated}`);
    }
  };

  const setPresetPath = (pathSuffix: string, label: string) => {
    const fullPath = `${activeDrive}${pathSuffix}`;
    onUpdateWoWRootPath(fullPath);
    if (triggerAlert) {
      triggerAlert("Caminho Predefinido", `Caminho do ${label} aplicado (${activeDrive}): ${fullPath}`);
    }
  };

  return (
    <div className="rounded-2xl bg-[#090d18] border border-emerald-500/40 shadow-xl overflow-hidden transition-all">
      {/* Hidden file input for cross-origin iframe compatible folder selection */}
      <input
        ref={fileInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
        onChange={handleFolderInputChange}
      />

      {/* Hidden direct file input for individual SavedVariables .lua / .json selection */}
      <input
        ref={directFilesInputRef}
        type="file"
        accept=".lua,.json"
        multiple
        className="hidden"
        onChange={handleDirectFilesChange}
      />

      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 sm:p-5 flex items-center justify-between gap-4 text-left cursor-pointer hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-md">
            <FolderSearch size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-sm sm:text-base text-white">
                2.2 Auto-Scanner de Diretório & Importação para o Banco
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-bold">
                SavedVariables Pipeline
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 truncate">
              Varre o diretório do WoW Forever, localiza SavedVariables, subdivide contas e heróis e sincroniza com o banco
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
          {/* STEP 1: CONFIGURE & SEARCH ROOT DIRECTORY */}
          <div className="p-4 rounded-xl bg-[#05070d] border border-emerald-900/40 text-xs space-y-3 mt-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-emerald-300 font-bold">
                <HardDrive size={15} />
                <span>Configuração da Pasta Raiz do WoW</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-bold">
                <ShieldCheck size={11} />
                <span>Permissão Total Concedida</span>
              </span>
            </div>

            <p className="text-[11px] text-zinc-300 leading-relaxed">
              Defina a pasta raiz da sua versão do World of Warcraft no seu computador (ex: <code className="text-cyan-300 bg-black/40 px-1 py-0.5 rounded font-mono">_classic_beta_</code> para WoW Forever). Ao salvar o caminho, o próprio site varre <strong>automaticamente todas as pastas e subpastas</strong> à procura dos arquivos de SavedVariables (<code className="text-emerald-300">HaleckAccountImporter.lua</code>), sem que você precise escolher arquivos manualmente!
            </p>

            {/* Path Input & Actions */}
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={wowRootPath}
                    onChange={(e) => onUpdateWoWRootPath(e.target.value)}
                    placeholder="Ex: C:\Program Files (x86)\World of Warcraft\_classic_beta_"
                    className="w-full bg-zinc-950 border border-emerald-500/40 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 font-mono shadow-inner"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onSaveWoWRootPath}
                    className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 border border-emerald-500/50 shadow-md shadow-emerald-950/40"
                    title="Salva o caminho e dispara automaticamente a varredura das pastas e subpastas"
                  >
                    <Save size={13} className="text-emerald-300" />
                    <span>Salvar Caminho & Iniciar Auto-Scan</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenFolderPicker}
                    disabled={isScanning}
                    className="px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-zinc-700 shrink-0"
                    title="Procurar pasta raiz no computador"
                  >
                    <FolderOpen size={14} className="text-cyan-400" />
                    <span>Procurar Pasta...</span>
                  </button>
                </div>
              </div>

              {/* Drive selector pills */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="text-[10px] text-zinc-400 font-mono uppercase font-bold">Unidade de Disco:</span>
                {(["C:", "D:", "E:"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => changeDrive(d)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border ${
                      activeDrive === d
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-400 shadow-sm shadow-emerald-500/30"
                        : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-800"
                    }`}
                  >
                    {d}
                  </button>
                ))}
                <span className="text-[10px] text-zinc-500 ml-1">
                  (Altera a letra da unidade preservando as subpastas)
                </span>
              </div>

              {/* Presets adapted to active drive */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-[10px]">
                <span className="text-zinc-500 font-mono uppercase font-bold mr-1">Predefinições ({activeDrive}):</span>
                <button
                  type="button"
                  onClick={() =>
                    setPresetPath("\\Program Files (x86)\\World of Warcraft\\_classic_beta_", "WoW Forever Beta")
                  }
                  className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-cyan-300 transition-colors cursor-pointer"
                >
                  _classic_beta_ (WoW Forever)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPresetPath("\\World of Warcraft\\_classic_beta_", "WoW Forever (Direto)")
                  }
                  className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-amber-300 transition-colors cursor-pointer"
                >
                  World of Warcraft\_classic_beta_
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPresetPath("\\Program Files (x86)\\World of Warcraft", "WoW Raiz Global")
                  }
                  className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-emerald-300 transition-colors cursor-pointer"
                >
                  World of Warcraft (Raiz)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPresetPath("\\Program Files (x86)\\World of Warcraft\\_classic_era_", "WoW Classic Era")
                  }
                  className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-amber-300 transition-colors cursor-pointer"
                >
                  _classic_era_ (Era)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPresetPath("\\Program Files (x86)\\World of Warcraft\\_retail_", "WoW Retail")
                  }
                  className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-purple-300 transition-colors cursor-pointer"
                >
                  _retail_ (The War Within)
                </button>
              </div>
            </div>

            {/* SCAN ACTION BUTTONS */}
            <div className="pt-2 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleOpenFolderPicker}
                disabled={isScanning}
                className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-black transition-all cursor-pointer shadow-lg shadow-emerald-600/30 flex items-center gap-2 disabled:opacity-50"
              >
                {isScanning ? (
                  <>
                    <Loader2 size={15} className="animate-spin text-white" />
                    <span>Analisando Pastas e Subpastas WTF/Account...</span>
                  </>
                ) : (
                  <>
                    <FolderSearch size={15} className="text-emerald-200" />
                    <span>Executar Varredura Inteligente & Importar</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  downloadAutoScanScriptBat(wowRootPath);
                  if (triggerAlert) {
                    triggerAlert(
                      "Auto-Scanner de 1-Clique Baixado!",
                      `O arquivo 'auto-scan-wow.bat' foi gerado para a pasta:\n${wowRootPath}\nBasta clicar nele no Windows para varrer todas as pastas e subpastas de SavedVariables e sincronizar automaticamente com o site!`
                    );
                  }
                }}
                className="py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-cyan-950 to-blue-950 hover:from-cyan-900 hover:to-blue-900 border border-cyan-500/50 text-cyan-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-cyan-950/40"
                title="Gera um script leve para Windows que faz a varredura automática do diretório e subpastas sem precisar escolher arquivos manualmente"
              >
                <Sparkles size={14} className="text-cyan-400" />
                <span>Baixar Auto-Scan 1-Clique (.BAT)</span>
              </button>

              <button
                type="button"
                onClick={() => directFilesInputRef.current?.click()}
                disabled={isScanning}
                className="py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Selecionar manualmente arquivos .lua ou .json do addon (HaleckAccountImporter.lua)"
              >
                <FileCode2 size={13} className="text-cyan-400" />
                <span>Selecionar Arquivo(s) .LUA / .JSON</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.open("https://gameloghalecks.ai.studio", "_blank");
                  }
                }}
                className="py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Acessar versão oficial em aba completa com acesso direto de disco"
              >
                <ExternalLink size={12} className="text-cyan-400" />
                <span>Versão Publicada (gameloghalecks.ai.studio)</span>
              </button>
            </div>
          </div>

          {/* SCANNER FEEDBACK RESULT & ACCOUNT SUBDIVISION */}
          {scanResult && (
            <div className="p-4 sm:p-5 rounded-xl bg-[#04060e] border border-emerald-500/50 space-y-4">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <CheckCircle2 size={18} className="text-emerald-400" />
                  <span className="font-bold text-sm text-white">Relatório de Varredura & Subdivisão</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold">
                    {scanResult.detectedFlavorLabel}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    ({scanResult.scannedAt})
                  </span>
                </div>
                {onClearScanResult && (
                  <button
                    type="button"
                    onClick={onClearScanResult}
                    className="text-[11px] text-zinc-400 hover:text-white transition-colors cursor-pointer self-start sm:self-auto font-bold"
                  >
                    Limpar Relatório
                  </button>
                )}
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-[#070b16] border border-zinc-800/80 space-y-0.5">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block">Arquivos Encontrados</span>
                  <span className="font-mono font-black text-sm text-cyan-300">
                    {scanResult.filesFound.length} arquivo(s)
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#070b16] border border-zinc-800/80 space-y-0.5">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block">Contas Mapeadas</span>
                  <span className="font-mono font-black text-sm text-amber-300">
                    {scanResult.accountsFound.length} conta(s)
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#070b16] border border-zinc-800/80 space-y-0.5">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block">Personagens Sincronizados</span>
                  <span className="font-mono font-black text-sm text-emerald-300">
                    {scanResult.totalCharactersImported} heróis
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#070b16] border border-zinc-800/80 space-y-0.5">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block">Economia Consolidada</span>
                  <span className="font-mono font-black text-sm text-yellow-300">
                    {Math.floor(scanResult.totalGoldAggregated / 10000)}g
                  </span>
                </div>
              </div>

              {/* SUBDIVISION: ACCOUNTS & CHARACTERS HIERARCHY */}
              {scanResult.accountGroups && scanResult.accountGroups.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                    <Users size={14} className="text-cyan-400" />
                    <span>Contas e Personagens Subdivididos:</span>
                  </div>

                  <div className="space-y-2.5">
                    {scanResult.accountGroups.map((acc) => {
                      const isExpanded = expandedAccounts[acc.accountName] !== false; // default expanded
                      return (
                        <div
                          key={acc.accountName}
                          className="rounded-xl bg-[#060914] border border-zinc-800 overflow-hidden"
                        >
                          {/* Account Header */}
                          <button
                            type="button"
                            onClick={() => toggleAccount(acc.accountName)}
                            className="w-full p-3 sm:p-3.5 flex items-center justify-between gap-3 text-left hover:bg-white/[0.02] cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
                                <Server size={14} />
                              </div>
                              <div className="min-w-0">
                                <span className="font-mono font-bold text-xs text-white block truncate">
                                  Conta: <span className="text-cyan-300">{acc.accountName}</span>
                                </span>
                                <span className="text-[10px] text-zinc-400">
                                  {acc.realms.length} reino(s) • {acc.totalCharacters} herói(s) detectados
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono font-bold text-xs text-yellow-300 bg-yellow-950/40 border border-yellow-500/30 px-2 py-0.5 rounded-full">
                                {Math.floor(acc.totalGold / 10000)}g
                              </span>
                              <ChevronDown
                                size={14}
                                className={`text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              />
                            </div>
                          </button>

                          {/* Account Body: Realms & Characters */}
                          {isExpanded && (
                            <div className="p-3 pt-0 border-t border-zinc-800/60 space-y-3 mt-1 text-xs">
                              {acc.realms.map((realm) => (
                                <div key={realm.realmName} className="space-y-2 mt-2">
                                  <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 px-1">
                                    <span className="flex items-center gap-1.5 text-zinc-300">
                                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
                                      Reino: <span className="text-white">{realm.realmName}</span>
                                    </span>
                                    <span className="font-mono text-[10px] text-yellow-400">
                                      {Math.floor(realm.totalGold / 10000)}g
                                    </span>
                                  </div>

                                  {/* Characters Grid */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                    {realm.characters.map((c) => (
                                      <div
                                        key={c.name}
                                        className="p-2.5 rounded-lg bg-[#0a0f1d] border border-zinc-800/80 flex items-center justify-between gap-2 shadow-sm"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          {c.classIconUrl ? (
                                            <img
                                              src={c.classIconUrl}
                                              alt={c.characterClass}
                                              className="w-6 h-6 rounded-md border border-zinc-700 shrink-0"
                                            />
                                          ) : (
                                            <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-cyan-300 shrink-0">
                                              {c.name.substring(0, 1)}
                                            </div>
                                          )}
                                          <div className="min-w-0">
                                            <span className="font-bold text-xs text-white block truncate">
                                              {c.name}
                                            </span>
                                            <span className="text-[10px] text-zinc-400 block truncate">
                                              {c.race} {c.characterClass} • Nv. {c.level}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                          <span className="font-mono font-bold text-[11px] text-yellow-300 block">
                                            {Math.floor(c.gold / 10000)}g
                                          </span>
                                          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/80 px-1 py-0.2 rounded border border-emerald-500/30">
                                            Sincronizado
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SCANNED SAVEDVARIABLES FILES TABLE */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                  <FileCode2 size={14} className="text-emerald-400" />
                  <span>Arquivos SavedVariables Processados:</span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {scanResult.filesFound.map((f, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-[#060914] border border-zinc-800/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-white text-[11px] truncate">
                            {f.filePath}
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                            {f.accountName}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-400 block">
                          Tamanho: {(f.fileSize / 1024).toFixed(1)} KB • Atualizado em {f.lastModified}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                          f.importedToDb
                            ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                            : "bg-amber-950/80 text-amber-300 border border-amber-500/40"
                        }`}
                      >
                        {f.importedToDb ? "No Banco de Dados" : "Salvo Localmente"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
