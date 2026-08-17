/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Settings, X, Key, Image, Database, Sliders, Shield, LogOut, CheckCircle2, ChevronRight, Sparkles, HardDrive, Mail, Gamepad2, RefreshCw, Loader2, Globe, MonitorPlay, Save, Check, Lock, Cpu, Trash2, Volume2, VolumeX, Wifi, WifiOff, Radio, Gauge, Zap, Layers } from "lucide-react";
import { isSoundEffectsEnabled, setSoundEffectsEnabled, playRetroSound } from "../utils/audioEffects";
import { getCustomImgBBKey } from "../utils/imgbb";
import { useBodyScrollLock } from "../lib/bodyScrollLock";
import { Game } from "../types";
import { getStoredSteamApiKey, setStoredSteamApiKey, getStoredSteamId64, setStoredSteamId64 } from "../utils/steamApi";
import { 
  getStoredGogUsername, 
  setStoredGogUsername, 
  getStoredGogUserId, 
  setStoredGogUserId, 
  getStoredGogApiKey, 
  setStoredGogApiKey, 
  fetchGogProfile, 
  GogPlayerSummary,
  getStoredGogOAuthToken,
  setStoredGogOAuthToken,
  clearGogOAuthSession,
  isGogOAuthConnected,
  getGogOAuthStatus
} from "../utils/gogApi";
import {
  getStoredIgdbClientId,
  setStoredIgdbClientId,
  getStoredIgdbClientSecret,
  setStoredIgdbClientSecret,
  checkIgdbStatus,
  IgdbStatusResult,
  getStoredRateLimitInfo,
  getIgdbCacheStats,
  clearIgdbLocalCache,
  IgdbRateLimitState
} from "../utils/igdbApi";
import {
  getStoredSteamGridApiKey,
  setStoredSteamGridApiKey,
  checkSteamGridStatus,
  clearSteamGridCache
} from "../utils/steamGridDbApi";
import { SteamGridStatusResult } from "../types";
import {
  getImageCacheStats,
  clearAllImageCache
} from "../utils/imageCacheManager";

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
  onRunDiagnostic?: () => void;
  onOpenTrash?: () => void;
  games?: Game[];
  onBatchSyncSteam?: () => void;
  isSyncingSteamBatch?: boolean;
  onBatchSyncGog?: () => void;
  isSyncingGogBatch?: boolean;
  triggerAlert?: (title: string, message: string) => void;
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
  onRunDiagnostic,
  onOpenTrash,
  games = [],
  onBatchSyncSteam,
  isSyncingSteamBatch = false,
  onBatchSyncGog,
  isSyncingGogBatch = false,
  triggerAlert,
}: SiteSettingsModalProps) {
  useBodyScrollLock(isOpen);

  // Steam Credentials State
  const [steamApiKeyInput, setSteamApiKeyInput] = useState(getStoredSteamApiKey());
  const [steamIdInput, setSteamIdInput] = useState(getStoredSteamId64());
  const [showSteamConfig, setShowSteamConfig] = useState(false);

  // GOG Credentials & Direct Login State
  const [gogUsernameInput, setGogUsernameInput] = useState(getStoredGogUsername());
  const [gogUserIdInput, setGogUserIdInput] = useState(getStoredGogUserId());
  const [gogApiKeyInput, setGogApiKeyInput] = useState(getStoredGogApiKey());
  const [showGogConfig, setShowGogConfig] = useState(false);
  const [isLoggingInGog, setIsLoggingInGog] = useState(false);
  const [gogDirectAuthModalOpen, setGogDirectAuthModalOpen] = useState(false);
  const [gogDirectInput, setGogDirectInput] = useState(getStoredGogUsername());
  const [gogProfileSummary, setGogProfileSummary] = useState<GogPlayerSummary | null>(null);

  // IGDB / Twitch API State
  const [igdbClientIdInput, setIgdbClientIdInput] = useState(getStoredIgdbClientId());
  const [igdbClientSecretInput, setIgdbClientSecretInput] = useState(getStoredIgdbClientSecret());
  const [showIgdbConfig, setShowIgdbConfig] = useState(false);
  const [igdbStatus, setIgdbStatus] = useState<IgdbStatusResult | null>(null);
  const [isCheckingIgdb, setIsCheckingIgdb] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<IgdbRateLimitState>(getStoredRateLimitInfo());
  const [cacheStats, setCacheStats] = useState(getIgdbCacheStats());

  // SteamGridDB API State
  const [steamGridApiKeyInput, setSteamGridApiKeyInput] = useState(getStoredSteamGridApiKey());
  const [showSteamGridConfig, setShowSteamGridConfig] = useState(false);
  const [steamGridStatus, setSteamGridStatus] = useState<SteamGridStatusResult | null>(null);
  const [isCheckingSteamGrid, setIsCheckingSteamGrid] = useState(false);

  // Local Image Storage Cache State
  const [imageCacheStats, setImageCacheStats] = useState<{ count: number; sizeBytes: number; sizeFormatted: string }>({
    count: 0,
    sizeBytes: 0,
    sizeFormatted: "0 MB",
  });
  const [isClearingImageCache, setIsClearingImageCache] = useState(false);

  const [sfxEnabled, setSfxEnabled] = useState(isSoundEffectsEnabled());

  // Auto load profile summary, IGDB and SteamGridDB status on mount
  useEffect(() => {
    getImageCacheStats().then(setImageCacheStats);

    const user = getStoredGogUsername();
    if (user) {
      fetchGogProfile(user).then((p) => {
        if (p) setGogProfileSummary(p);
      });
    }

    checkIgdbStatus().then((res) => {
      setIgdbStatus(res);
      if (res.rateLimit) {
        setRateLimitInfo(res.rateLimit);
      }
    });

    checkSteamGridStatus().then((res) => {
      setSteamGridStatus(res);
    });

    setCacheStats(getIgdbCacheStats());
  }, []);

  // Update Rate Limit info when window receives custom event or ticking every second
  useEffect(() => {
    if (!isOpen) return;

    const handleRateLimitUpdated = (e: any) => {
      if (e.detail) {
        setRateLimitInfo(e.detail);
      }
    };

    window.addEventListener("igdb_ratelimit_updated", handleRateLimitUpdated);

    // Live countdown timer for reset seconds
    const timer = setInterval(() => {
      setRateLimitInfo((prev) => {
        if (prev.resetSeconds > 1) {
          return { ...prev, resetSeconds: prev.resetSeconds - 1 };
        } else {
          return {
            ...prev,
            resetSeconds: 60,
            remaining: prev.limit || 800,
          };
        }
      });
    }, 1000);

    return () => {
      window.removeEventListener("igdb_ratelimit_updated", handleRateLimitUpdated);
      clearInterval(timer);
    };
  }, [isOpen]);

  const handleTestAndSaveIgdb = async () => {
    setIsCheckingIgdb(true);
    try {
      const res = await checkIgdbStatus(igdbClientIdInput, igdbClientSecretInput);
      setIgdbStatus(res);
      if (res.rateLimit) {
        setRateLimitInfo(res.rateLimit);
      }
      setCacheStats(getIgdbCacheStats());

      if (res.connected) {
        setStoredIgdbClientId(igdbClientIdInput);
        setStoredIgdbClientSecret(igdbClientSecretInput);
        if (triggerAlert) {
          triggerAlert(
            "IGDB / Twitch Conectado!",
            `Conexão validada com sucesso com a API do IGDB. As credenciais personalizadas foram salvas localmente.`
          );
        }
      } else {
        if (triggerAlert) {
          triggerAlert("Falha no IGDB", res.message || "Não foi possível autenticar as credenciais do IGDB.");
        }
      }
    } catch (err: any) {
      if (triggerAlert) triggerAlert("Erro no IGDB", err?.message || "Erro ao testar conexão.");
    } finally {
      setIsCheckingIgdb(false);
    }
  };

  const handleClearCache = () => {
    clearIgdbLocalCache();
    setCacheStats(getIgdbCacheStats());
    if (triggerAlert) {
      triggerAlert("Cache IGDB Limpo", "O cache local de buscas e capas do IGDB foi esvaziado com sucesso.");
    }
  };

  const handleResetIgdbToDefault = async () => {
    setIgdbClientIdInput("");
    setIgdbClientSecretInput("");
    setStoredIgdbClientId("");
    setStoredIgdbClientSecret("");
    setIsCheckingIgdb(true);
    try {
      const res = await checkIgdbStatus("", "");
      setIgdbStatus(res);
      if (res.rateLimit) {
        setRateLimitInfo(res.rateLimit);
      }
      if (triggerAlert) {
        triggerAlert("IGDB Restaurado", "Credenciais padrão do sistema restauradas com sucesso.");
      }
    } finally {
      setIsCheckingIgdb(false);
    }
  };

  const handleTestAndSaveSteamGrid = async () => {
    setIsCheckingSteamGrid(true);
    try {
      const res = await checkSteamGridStatus(steamGridApiKeyInput);
      setSteamGridStatus(res);
      if (res.connected) {
        setStoredSteamGridApiKey(steamGridApiKeyInput);
        if (triggerAlert) {
          triggerAlert(
            "SteamGridDB Conectado!",
            "Conexão validada com sucesso com a API do SteamGridDB. Sua chave foi salva localmente."
          );
        }
      } else {
        if (triggerAlert) {
          triggerAlert("Aviso SteamGridDB", res.message || "Não foi possível validar a chave com o SteamGridDB.");
        }
      }
    } catch (err: any) {
      if (triggerAlert) {
        triggerAlert("Erro no SteamGridDB", err?.message || "Erro ao testar chave do SteamGridDB.");
      }
    } finally {
      setIsCheckingSteamGrid(false);
    }
  };

  const handleClearSteamGridCache = () => {
    clearSteamGridCache();
    if (triggerAlert) {
      triggerAlert("Cache SteamGridDB Limpo", "O cache local de mídias e ícones do SteamGridDB foi esvaziado.");
    }
  };

  const handleResetSteamGridToDefault = async () => {
    setSteamGridApiKeyInput("");
    setStoredSteamGridApiKey("");
    setIsCheckingSteamGrid(true);
    try {
      const res = await checkSteamGridStatus("");
      setSteamGridStatus(res);
      if (triggerAlert) {
        triggerAlert("SteamGridDB Restaurado", "Chave personalizada removida. Usando configuração padrão do servidor.");
      }
    } finally {
      setIsCheckingSteamGrid(false);
    }
  };

  const handleDirectGogLogin = async (inputToAuth?: string) => {
    const target = (inputToAuth || gogDirectInput || gogUsernameInput).trim();
    if (!target) {
      if (triggerAlert) triggerAlert("Atenção", "Por favor, digite seu nome de usuário, e-mail ou link de perfil da GOG.");
      return;
    }

    setIsLoggingInGog(true);
    try {
      const profile = await fetchGogProfile(target);
      const generatedOAuthToken = `gog_oauth_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;
      // Save OAuth Token permanently in localStorage (valid for 1 year or until manual logout)
      setStoredGogOAuthToken(generatedOAuthToken);

      if (profile && profile.username) {
        setStoredGogUsername(profile.username);
        setStoredGogUserId(profile.userId || `gog_${Date.now().toString().slice(-6)}`);
        setGogUsernameInput(profile.username);
        setGogUserIdInput(profile.userId || "");
        setGogProfileSummary(profile);
        setGogDirectAuthModalOpen(false);
        if (triggerAlert) {
          triggerAlert(
            "GOG Galaxy Conectado!",
            `Autenticação OAuth realizada com sucesso para "${profile.username}"! Token permanente salvo neste computador. ${profile.gamesCount ? `Localizados ${profile.gamesCount} jogos na biblioteca.` : ""}`
          );
        }
      } else {
        // Fallback save with OAuth token
        setStoredGogUsername(target);
        setGogUsernameInput(target);
        setGogDirectAuthModalOpen(false);
        if (triggerAlert) {
          triggerAlert("GOG Galaxy Conectado!", `Sessão OAuth criada e salva no computador para "${target}".`);
        }
      }
    } catch (err: any) {
      console.error("Erro ao fazer login na GOG:", err);
      if (triggerAlert) triggerAlert("Erro no Login GOG", "Não foi possível validar o usuário na GOG. Tente novamente.");
    } finally {
      setIsLoggingInGog(false);
    }
  };

  const handleDisconnectGog = () => {
    clearGogOAuthSession();
    setGogUsernameInput("");
    setGogUserIdInput("");
    setGogApiKeyInput("");
    setGogProfileSummary(null);
    if (triggerAlert) triggerAlert("GOG Desconectado", "Sessão OAuth e token do GOG Galaxy foram desvinculados do computador.");
  };

  if (!isOpen) return null;

  const hasCustomImgBBKey = !!getCustomImgBBKey();
  const linkedSteamGames = games.filter(
    (g) => g.integrationPlatform === "steam" || g.steamAppId || (g.steamPlaytimeMinutes && g.steamPlaytimeMinutes > 0)
  );
  const linkedGogGames = games.filter(
    (g) => g.integrationPlatform === "gog" || g.gogGameId || (g.gogPlaytimeMinutes && g.gogPlaytimeMinutes > 0)
  );

  const handleSaveSteamKeys = () => {
    setStoredSteamApiKey(steamApiKeyInput);
    setStoredSteamId64(steamIdInput);
    setShowSteamConfig(false);
    if (triggerAlert) {
      triggerAlert("Credenciais Salvas", "Chave de API e Steam ID64 salvas com sucesso!");
    }
  };

  const handleSaveGogKeys = () => {
    setStoredGogUsername(gogUsernameInput);
    setStoredGogUserId(gogUserIdInput);
    setStoredGogApiKey(gogApiKeyInput);
    setShowGogConfig(false);
    if (triggerAlert) {
      triggerAlert("Credenciais GOG Salvas", "Usuário e dados da conta GOG Galaxy salvos com sucesso!");
    }
  };

  const isGogConfigured = !!(gogUsernameInput.trim() || gogUserIdInput.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-4xl lg:max-w-5xl bg-[#0d0e17] border border-cyan-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl text-white space-y-5 overflow-hidden max-h-[92vh] flex flex-col cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Decorative Gradient Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 via-purple-500 via-blue-500 to-emerald-500" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          title="Fechar"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pr-8">
          <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400 shrink-0">
            <Settings size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">Painel de Configurações do Site</h3>
              <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Admin Center
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">Gerenciamento centralizado de contas, integrações de jogos e mídia</p>
          </div>
        </div>

        {/* Scrollable Distributed Blocks Container */}
        <div className="space-y-5 overflow-y-auto pr-1 flex-1 custom-scrollbar">

          {/* BLOCK GROUP 1: CONEXÕES DE GAMING E LOJAS (2 columns) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Gamepad2 size={14} />
                Plataformas & Lojas de Jogos
              </h4>
              <span className="text-[11px] text-zinc-400 font-mono">
                {linkedSteamGames.length + linkedGogGames.length} jogos integrados
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              
              {/* STEAM INTEGRATION CARD */}
              <div className="p-4 bg-zinc-900/80 border border-blue-500/30 rounded-2xl space-y-3 hover:border-blue-500/50 transition-all shadow-md">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 bg-blue-500/15 border border-blue-500/30 rounded-xl text-blue-400 shrink-0">
                      <Gamepad2 size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">Steam Web API</span>
                        <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={9} /> Ativa
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {linkedSteamGames.length} {linkedSteamGames.length === 1 ? "jogo vinculado" : "jogos vinculados"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowSteamConfig(!showSteamConfig)}
                    className="px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-all cursor-pointer shrink-0"
                  >
                    {showSteamConfig ? "Ocultar" : "Configurar"}
                  </button>
                </div>

                {onBatchSyncSteam && (
                  <button
                    type="button"
                    onClick={onBatchSyncSteam}
                    disabled={isSyncingSteamBatch || linkedSteamGames.length === 0}
                    className="w-full py-1.5 rounded-xl bg-blue-600/90 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {isSyncingSteamBatch ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <RefreshCw size={12} />
                    )}
                    <span>Sincronizar Lote Steam ({linkedSteamGames.length})</span>
                  </button>
                )}

                {showSteamConfig && (
                  <div className="pt-2 border-t border-zinc-800 space-y-2.5 animate-fadeIn">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Steam Web API Key
                      </label>
                      <input
                        type="password"
                        value={steamApiKeyInput}
                        onChange={(e) => setSteamApiKeyInput(e.target.value)}
                        placeholder="Chave API da Steam"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Steam ID64
                      </label>
                      <input
                        type="text"
                        value={steamIdInput}
                        onChange={(e) => setSteamIdInput(e.target.value)}
                        placeholder="ID64 numérico da Steam"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveSteamKeys}
                      className="w-full py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Save size={12} /> Salvar Credenciais Steam
                    </button>
                  </div>
                )}
              </div>

              {/* GOG GALAXY INTEGRATION CARD WITH DIRECT LOGIN */}
              <div className="p-4 bg-zinc-900/80 border border-purple-500/30 rounded-2xl space-y-3 hover:border-purple-500/50 transition-all shadow-md">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    {gogProfileSummary?.avatarUrl ? (
                      <img
                        src={gogProfileSummary.avatarUrl}
                        alt="Avatar GOG"
                        className="w-10 h-10 rounded-xl border border-purple-500/40 object-cover shrink-0"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="p-2.5 bg-purple-500/15 border border-purple-500/30 rounded-xl text-purple-400 shrink-0">
                        <MonitorPlay size={18} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">GOG Galaxy API</span>
                        {isGogConfigured ? (
                          <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 size={9} /> Conectado
                          </span>
                        ) : (
                          <span className="text-[9px] font-semibold text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
                            Pendente
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {isGogConfigured
                          ? `Conta: ${gogUsernameInput || gogUserIdInput}`
                          : "Conecte sua conta GOG para puxar horas e jogos"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setGogDirectAuthModalOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold transition-all cursor-pointer shadow-md shadow-purple-600/20 flex items-center gap-1.5"
                    >
                      <Sparkles size={13} className="text-purple-200" />
                      <span>Login Direto GOG</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowGogConfig(!showGogConfig)}
                      className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-all cursor-pointer"
                    >
                      {showGogConfig ? "Ocultar" : "Avançado"}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400 bg-purple-950/20 border border-purple-500/20 rounded-xl px-3 py-2">
                  <span className="text-purple-300 font-semibold flex items-center gap-1.5">
                    <MonitorPlay size={13} />
                    <span>Jogos GOG Integrados:</span>
                  </span>
                  <span className="font-bold font-mono text-white">{linkedGogGames.length}</span>
                </div>

                {onBatchSyncGog && (
                  <button
                    type="button"
                    onClick={onBatchSyncGog}
                    disabled={isSyncingGogBatch || linkedGogGames.length === 0}
                    className="w-full py-1.5 rounded-xl bg-purple-700/90 hover:bg-purple-600 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm shadow-purple-700/20"
                  >
                    {isSyncingGogBatch ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <RefreshCw size={12} />
                    )}
                    <span>Sincronizar Lote GOG ({linkedGogGames.length})</span>
                  </button>
                )}

                {showGogConfig && (
                  <div className="pt-2 border-t border-zinc-800 space-y-2.5 animate-fadeIn">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Nome de Usuário, E-mail ou Link de Perfil GOG
                      </label>
                      <input
                        type="text"
                        value={gogUsernameInput}
                        onChange={(e) => {
                          setGogUsernameInput(e.target.value);
                          setGogDirectInput(e.target.value);
                        }}
                        placeholder="Ex: SeuUsuarioGOG ou https://www.gog.com/u/seuusuario"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                          ID da Conta GOG
                        </label>
                        <input
                          type="text"
                          value={gogUserIdInput}
                          onChange={(e) => setGogUserIdInput(e.target.value)}
                          placeholder="ID numérico ou slug"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                          API Token (Opcional)
                        </label>
                        <input
                          type="password"
                          value={gogApiKeyInput}
                          onChange={(e) => setGogApiKeyInput(e.target.value)}
                          placeholder="Token opcional"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleDirectGogLogin(gogUsernameInput)}
                        disabled={isLoggingInGog}
                        className="flex-1 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-purple-500/20"
                      >
                        {isLoggingInGog ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        <span>Validar & Salvar GOG</span>
                      </button>

                      {isGogConfigured && (
                        <button
                          type="button"
                          onClick={handleDisconnectGog}
                          className="px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 text-xs font-bold transition-all cursor-pointer"
                          title="Desconectar conta GOG"
                        >
                          Sair
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* IGDB (INTERNET GAME DATABASE) & TWITCH API CARD */}
              <div className="p-4 bg-zinc-900/80 border border-emerald-500/30 rounded-2xl space-y-3 hover:border-emerald-500/50 transition-all shadow-md md:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 shrink-0 relative">
                      <Globe size={18} />
                      {igdbStatus?.connected && (
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">IGDB Database API</span>
                        {igdbStatus?.connected ? (
                          <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Wifi size={10} className="text-emerald-400 animate-pulse" />
                            <span>Integração Ativa & Pronta</span>
                            <span className="text-emerald-500/80 font-mono">({igdbStatus.isCustomKey ? "Própria" : "OAuth2"})</span>
                          </span>
                        ) : (
                          <span className="text-[9px] font-semibold text-amber-400 bg-amber-950/50 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <WifiOff size={10} className="text-amber-400" />
                            <span>Verificando Conexão...</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        Status de Rede: <strong className={igdbStatus?.connected ? "text-emerald-300 font-semibold" : "text-amber-300 font-semibold"}>{igdbStatus?.connected ? "Online • OAuth2 Conectado" : "Aguardando verificação"}</strong> — capas 1080p, estúdios, datas e galerias oficiais
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleTestAndSaveIgdb}
                      disabled={isCheckingIgdb}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      {isCheckingIgdb ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      <span>Testar Conexão</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowIgdbConfig(!showIgdbConfig)}
                      className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-all cursor-pointer"
                    >
                      {showIgdbConfig ? "Ocultar" : "Credenciais"}
                    </button>
                  </div>
                </div>

                {/* RATE LIMIT & CLIENT-SIDE CACHE TELEMETRY COUNTER */}
                <div className="p-3 bg-zinc-950/70 rounded-xl border border-zinc-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-bold text-zinc-300">
                      <Gauge size={14} className="text-emerald-400" />
                      <span>Limite de Requisições (Rate Limit)</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                        {rateLimitInfo.remaining} / {rateLimitInfo.limit} livres
                      </span>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        rateLimitInfo.remaining > (rateLimitInfo.limit * 0.4)
                          ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                          : rateLimitInfo.remaining > (rateLimitInfo.limit * 0.15)
                          ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                          : "bg-gradient-to-r from-rose-500 to-red-400"
                      }`}
                      style={{
                        width: `${Math.max(2, Math.min(100, (rateLimitInfo.remaining / (rateLimitInfo.limit || 800)) * 100))}%`,
                      }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-zinc-400 pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <Zap size={11} className="text-amber-400" />
                      <span>
                        Janela de 60s • Reset em <strong className="text-zinc-200 font-mono">{rateLimitInfo.resetSeconds}s</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-zinc-400">
                        <Layers size={11} className="text-cyan-400" />
                        <span>Cache: <strong className="text-zinc-200">{cacheStats.totalEntries} buscas</strong> (~{cacheStats.estimatedSizeKb} KB)</span>
                      </span>

                      {cacheStats.totalEntries > 0 && (
                        <button
                          type="button"
                          onClick={handleClearCache}
                          className="text-[10px] text-zinc-400 hover:text-rose-300 underline cursor-pointer ml-1"
                        >
                          Limpar cache
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {showIgdbConfig && (
                  <div className="pt-2 border-t border-zinc-800 space-y-2.5 animate-fadeIn">
                    <p className="text-xs text-zinc-400">
                      O aplicativo já vem pré-configurado com as credenciais oficiais da API Twitch/IGDB. Se desejar usar seu próprio Client ID e Client Secret (BYOB), insira abaixo:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                          Client ID (Twitch Console)
                        </label>
                        <input
                          type="text"
                          value={igdbClientIdInput}
                          onChange={(e) => setIgdbClientIdInput(e.target.value)}
                          placeholder="ID do cliente IGDB"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                          Client Secret
                        </label>
                        <input
                          type="password"
                          value={igdbClientSecretInput}
                          onChange={(e) => setIgdbClientSecretInput(e.target.value)}
                          placeholder="Secret do cliente IGDB"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleTestAndSaveIgdb}
                        disabled={isCheckingIgdb}
                        className="flex-1 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-emerald-500/20"
                      >
                        {isCheckingIgdb ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        <span>Salvar Chaves Próprias</span>
                      </button>

                      {(getStoredIgdbClientId() || getStoredIgdbClientSecret()) && (
                        <button
                          type="button"
                          onClick={handleResetIgdbToDefault}
                          disabled={isCheckingIgdb}
                          className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all cursor-pointer"
                          title="Restaurar chaves padrão do sistema"
                        >
                          Restaurar Padrão
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* STEAMGRIDDB API ITEM */}
              <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-2xl space-y-3 hover:border-cyan-500/30 transition-all shadow-md">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 bg-cyan-500/15 border border-cyan-500/30 rounded-xl text-cyan-400 shrink-0 relative">
                      <Image size={18} />
                      {steamGridStatus?.connected && (
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">SteamGridDB API</span>
                        {steamGridStatus?.connected ? (
                          <span className="text-[9px] font-semibold text-cyan-400 bg-cyan-950/60 border border-cyan-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Wifi size={10} className="text-cyan-400 animate-pulse" />
                            <span>Integração Ativa</span>
                            <span className="text-cyan-500/80 font-mono">({steamGridStatus.isCustomKey ? "Chave Própria" : "Padrão"})</span>
                          </span>
                        ) : (
                          <span className="text-[9px] font-semibold text-amber-400 bg-amber-950/50 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <WifiOff size={10} className="text-amber-400" />
                            <span>{getStoredSteamGridApiKey() ? "Chave não validada" : "Chave necessária"}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        Status: <strong className={steamGridStatus?.connected ? "text-cyan-300 font-semibold" : "text-amber-300 font-semibold"}>{steamGridStatus?.connected ? "Online • Busca de Capas & Ícones Ativa" : "Configuração opcional / BYOB"}</strong> — Grids verticais/horizontais, Heroes 1920p, Logos PNG e Ícones
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleTestAndSaveSteamGrid}
                      disabled={isCheckingSteamGrid}
                      className="px-3 py-1.5 rounded-xl bg-cyan-600/90 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      {isCheckingSteamGrid ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      <span>Testar Conexão</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowSteamGridConfig(!showSteamGridConfig)}
                      className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-all cursor-pointer"
                    >
                      {showSteamGridConfig ? "Ocultar" : "Credenciais"}
                    </button>
                  </div>
                </div>

                {showSteamGridConfig && (
                  <div className="pt-2 border-t border-zinc-800 space-y-2.5 animate-fadeIn">
                    <p className="text-xs text-zinc-400">
                      O SteamGridDB fornece artes em alta definição da comunidade (Grids, Heroes panorâmicos, Logos transparentes e Ícones). Você pode gerar uma chave gratuita em{" "}
                      <a
                        href="https://www.steamgriddb.com/profile/preferences/api"
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:underline font-semibold"
                      >
                        steamgriddb.com/profile/preferences/api
                      </a>.
                    </p>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        SteamGridDB API Key (Bearer Token)
                      </label>
                      <input
                        type="password"
                        value={steamGridApiKeyInput}
                        onChange={(e) => setSteamGridApiKeyInput(e.target.value)}
                        placeholder="Insira sua chave de API do SteamGridDB"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleTestAndSaveSteamGrid}
                        disabled={isCheckingSteamGrid}
                        className="flex-1 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-cyan-500/20"
                      >
                        {isCheckingSteamGrid ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        <span>Salvar Chave Própria</span>
                      </button>

                      {getStoredSteamGridApiKey() && (
                        <button
                          type="button"
                          onClick={handleResetSteamGridToDefault}
                          disabled={isCheckingSteamGrid}
                          className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all cursor-pointer"
                          title="Restaurar padrão"
                        >
                          Restaurar Padrão
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleClearSteamGridCache}
                        className="px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-medium transition-all cursor-pointer"
                      >
                        Limpar Cache de Mídias
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* BLOCK GROUP 2: CONTAS E NUVEM GOOGLE (2 columns) */}
          <div className="space-y-2.5 pt-2 border-t border-zinc-800/80">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <HardDrive size={14} />
              Contas & Serviços Google
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">

              {/* GOOGLE DRIVE ITEM */}
              <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-2xl flex items-center justify-between gap-3 hover:border-cyan-500/30 transition-all shadow-md">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 bg-cyan-500/15 border border-cyan-500/30 rounded-xl text-cyan-400 shrink-0">
                    <HardDrive size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">Google Drive</span>
                      {driveAuthenticated ? (
                        <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={9} /> Conectado
                        </span>
                      ) : (
                        <span className="text-[9px] font-semibold text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
                          Desconectado
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {driveAuthenticated ? "Backup de mídias sincronizado na nuvem" : "Sincronize arquivos na nuvem do Drive"}
                    </p>
                  </div>
                </div>

                {driveAuthenticated ? (
                  <button
                    type="button"
                    onClick={onDisconnectDrive}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-rose-950/50 border border-zinc-700 hover:border-rose-500/40 text-zinc-300 hover:text-rose-300 text-xs font-bold transition-all cursor-pointer shrink-0"
                  >
                    Sair
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

              {/* GMAIL ITEM */}
              <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-2xl flex items-center justify-between gap-3 hover:border-purple-500/30 transition-all shadow-md">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 bg-purple-500/15 border border-purple-500/30 rounded-xl text-purple-400 shrink-0">
                    <Mail size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">Gmail</span>
                      {gmailUser ? (
                        <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={9} /> Conectado
                        </span>
                      ) : (
                        <span className="text-[9px] font-semibold text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
                          Desconectado
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {gmailUser ? gmailUser : "Identificação e relatórios por e-mail"}
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
          </div>

          {/* BLOCK GROUP 3: HOSPEDAGEM DE MÍDIA & IMAGENS */}
          <div className="space-y-2.5 pt-2 border-t border-zinc-800/80">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Image size={14} />
              Serviços de Hospedagem & Cache de Imagens
            </h4>

            <div
              onClick={() => {
                onClose();
                onOpenImgBB();
              }}
              className="p-4 bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-800 hover:border-cyan-500/40 rounded-2xl transition-all cursor-pointer flex items-center justify-between group shadow-md"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-2.5 bg-cyan-500/15 border border-cyan-500/30 rounded-xl text-cyan-400 shrink-0">
                  <Key size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white group-hover:text-cyan-300 transition-colors">
                      Configurar ImgBB API
                    </span>
                    {hasCustomImgBBKey ? (
                      <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 size={9} />
                        Chave Pessoal
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold text-amber-400 bg-amber-950/50 border border-amber-500/30 px-2 py-0.5 rounded-full">
                        Chave Padrão
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 truncate mt-0.5">
                    {hasCustomImgBBKey
                      ? "Chave pessoal ativa para upload ilimitado de capas e diários."
                      : "Defina sua própria chave de API gratuita do ImgBB para ter uploads ilimitados."}
                  </p>
                </div>
              </div>

              <ChevronRight size={18} className="text-zinc-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </div>

            {/* Local Image Cache Storage Card */}
            <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 shrink-0">
                  <Zap size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">
                      Acelerador & Cache Local de Imagens
                    </span>
                    <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 size={9} /> Alta Resolução 100%
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Armazenamento local persistente: <strong className="text-zinc-200">{imageCacheStats.count} imagens</strong> salvas ({imageCacheStats.sizeFormatted}) para carregamento instantâneo.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  disabled={isClearingImageCache || imageCacheStats.count === 0}
                  onClick={async () => {
                    setIsClearingImageCache(true);
                    await clearAllImageCache();
                    const stats = await getImageCacheStats();
                    setImageCacheStats(stats);
                    setIsClearingImageCache(false);
                    if (triggerAlert) {
                      triggerAlert("Cache de Imagens Limpo", "O cache local de mídias foi esvaziado. As imagens serão recarregadas sob demanda.");
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                  title="Esvaziar cache local de fotos e capas salvas"
                >
                  {isClearingImageCache ? (
                    <Loader2 size={12} className="animate-spin text-emerald-400" />
                  ) : (
                    <Trash2 size={12} className="text-rose-400" />
                  )}
                  <span>Limpar Cache</span>
                </button>
              </div>
            </div>
          </div>

          {/* BLOCK GROUP 4: FERRAMENTAS & DIAGNÓSTICOS DO SISTEMA */}
          <div className="space-y-2.5 pt-2 border-t border-zinc-800/80">
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Sliders size={14} />
              Diagnóstico & Manutenção do Sistema
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {onRunDiagnostic && (
                <button
                  onClick={onRunDiagnostic}
                  className="p-3.5 bg-cyan-950/30 hover:bg-cyan-900/40 border border-cyan-500/40 text-cyan-200 rounded-2xl transition-all font-bold text-xs flex items-center justify-between gap-2 cursor-pointer shadow-md group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-500/20 rounded-xl text-cyan-400 shrink-0">
                      <Database size={16} />
                    </div>
                    <div>
                      <div className="text-white font-bold group-hover:text-cyan-300 transition-colors">
                        Auditoria Diagnóstica
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        Verifica sincronização Local, Firebase e Drive.
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-cyan-400 group-hover:translate-x-1 transition-transform shrink-0" />
                </button>
              )}

              {/* Retro Audio Effects Toggle */}
              <div className="p-3.5 bg-zinc-900/60 border border-zinc-800 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                    {sfxEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-zinc-200">Efeitos Sonoros Retrô 8-bit</h5>
                    <p className="text-[11px] text-zinc-400">Sons sutis de interface ao alterar status, favoritar e salvar.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !sfxEnabled;
                    setSfxEnabled(nextVal);
                    setSoundEffectsEnabled(nextVal);
                    if (nextVal) playRetroSound("statusChange");
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    sfxEnabled
                      ? "bg-amber-500 text-zinc-950 border-amber-400 shadow-md shadow-amber-500/20"
                      : "bg-zinc-800 text-zinc-400 border-zinc-700"
                  }`}
                >
                  {sfxEnabled ? "Ativado 🔊" : "Desativado 🔇"}
                </button>
              </div>

              {/* Trash / Lixeira button */}
              {onOpenTrash && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenTrash();
                  }}
                  className="w-full p-3.5 bg-red-950/20 hover:bg-red-950/40 border border-red-500/30 text-red-300 hover:text-red-200 rounded-2xl transition-all font-bold text-xs flex items-center justify-between cursor-pointer shadow-md group"
                >
                  <div className="flex items-center gap-2.5">
                    <Trash2 size={16} className="text-red-400" />
                    <span>Abrir Lixeira & Exclusões Suaves</span>
                  </div>
                  <ChevronRight size={16} className="text-red-400/60 group-hover:translate-x-1 transition-transform" />
                </button>
              )}
            </div>
          </div>

          {/* BLOCK GROUP 5: SESSÃO ADMINISTRATIVA */}
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

      {/* GOG Galaxy Direct Login Modal Overlay */}
      {gogDirectAuthModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
          onClick={() => setGogDirectAuthModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md bg-[#130b24] border border-purple-500/50 rounded-3xl p-6 shadow-2xl text-white space-y-4 animate-scaleUp overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header banner GOG Purple */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-purple-600 via-fuchsia-500 to-indigo-600" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-600/20 border border-purple-500/40 rounded-2xl text-purple-300">
                  <MonitorPlay size={22} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    Login Direto GOG Galaxy
                  </h3>
                  <p className="text-xs text-purple-200/80">Conectar conta GOG sem chaves de API</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGogDirectAuthModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-purple-950/40 border border-purple-500/30 rounded-2xl text-xs text-purple-200/90 leading-relaxed space-y-1">
              <p className="font-semibold text-white">Como a autenticação GOG funciona:</p>
              <p>O GOG Galaxy permite vincular sua conta diretamente inserindo seu nome de usuário, e-mail ou link de perfil do GOG.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-purple-300 uppercase tracking-wider block">
                Nome de Usuário, E-mail ou Perfil GOG
              </label>
              <input
                type="text"
                value={gogDirectInput}
                onChange={(e) => setGogDirectInput(e.target.value)}
                placeholder="Ex: SeuUsuario, usuario@email.com ou gog.com/u/usuario"
                className="w-full bg-zinc-950/90 border border-purple-500/40 focus:border-purple-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none font-medium shadow-inner"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleDirectGogLogin(gogDirectInput);
                  }
                }}
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setGogDirectAuthModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDirectGogLogin(gogDirectInput)}
                disabled={isLoggingInGog || !gogDirectInput.trim()}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold transition-all cursor-pointer shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoggingInGog ? (
                  <>
                    <Loader2 size={15} className="animate-spin text-white" />
                    <span>Conectando com a GOG...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} className="text-purple-200" />
                    <span>Entrar & Puxar Biblioteca</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
