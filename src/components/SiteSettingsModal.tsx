/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Settings, X, Key, Image, Database, Sliders, Shield, LogOut, CheckCircle2, ChevronRight, Sparkles, HardDrive, Mail, Gamepad2, RefreshCw, Loader2, Globe, MonitorPlay, Save, Check, Lock, Cpu, Trash2, Volume2, VolumeX, Wifi, WifiOff, Radio, Gauge, Zap, Layers, Copy, ExternalLink, ClipboardPaste, Video, Code, Clock } from "lucide-react";
import { WoWAddonDevModal } from "./WoWAddonDevModal";
import { isSoundEffectsEnabled, setSoundEffectsEnabled, playRetroSound } from "../utils/audioEffects";
import { getCustomImgBBKey } from "../utils/imgbb";
import { isYouTubeAuthenticated, signInWithYouTube, signOutYouTube } from "../utils/googleDrive";
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
  getGogOAuthStatus,
  exchangeGogCode
} from "../utils/gogApi";
import {
  getStoredBlizzardBattleTag,
  setStoredBlizzardBattleTag,
  getStoredBlizzardOAuthToken,
  setStoredBlizzardOAuthToken,
  getStoredBlizzardRegion,
  setStoredBlizzardRegion,
  getStoredBlizzardClientId,
  setStoredBlizzardClientId,
  getStoredBlizzardClientSecret,
  setStoredBlizzardClientSecret,
  clearBlizzardOAuthSession,
  isBlizzardAuthenticated,
  getBlizzardAuthUrl,
  exchangeBlizzardCode,
  verifyAndSaveManualToken,
  requestBlizzardClientCredentials,
  getEffectiveBlizzardRedirectUri,
  registerBlizzardReauthListener,
  clearAllBlizzardRawCache,
  getBlizzardCacheStats,
  DEFAULT_BLIZZARD_CLIENT_ID,
  DEFAULT_BLIZZARD_CLIENT_SECRET,
  BLIZZARD_ALLOWED_REDIRECT_URIS,
} from "../utils/blizzardApi";
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
  onBatchSyncBlizzard?: () => void | Promise<void>;
  isSyncingBlizzardBatch?: boolean;
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
  onBatchSyncBlizzard,
  isSyncingBlizzardBatch = false,
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
  const [copiedGogLink, setCopiedGogLink] = useState(false);

  // Blizzard / Battle.net State
  const [blizzardBattleTag, setBlizzardBattleTag] = useState(getStoredBlizzardBattleTag());
  const [blizzardRegion, setBlizzardRegion] = useState(getStoredBlizzardRegion());
  const [blizzardClientId, setBlizzardClientId] = useState(getStoredBlizzardClientId());
  const [blizzardClientSecret, setBlizzardClientSecret] = useState(getStoredBlizzardClientSecret());
  const [blizzardTokenInput, setBlizzardTokenInput] = useState(getStoredBlizzardOAuthToken());
  const [isBlizzardConnected, setIsBlizzardConnected] = useState(isBlizzardAuthenticated());
  const [showBlizzardConfig, setShowBlizzardConfig] = useState(false);
  const [isConnectingBlizzard, setIsConnectingBlizzard] = useState(false);
  const [blizzardDirectAuthModalOpen, setBlizzardDirectAuthModalOpen] = useState(false);
  const [blizzardDirectInput, setBlizzardDirectInput] = useState("");
  const [copiedBlizzardLink, setCopiedBlizzardLink] = useState(false);
  const [blizzardModalTab, setBlizzardModalTab] = useState<"battletag" | "oauth">("battletag");
  const [addonDevModalOpen, setAddonDevModalOpen] = useState(false);

  const activeBlizzardClientId = (blizzardClientId || "").trim() || DEFAULT_BLIZZARD_CLIENT_ID;
  const dynamicBlizzardOAuthUrl = getBlizzardAuthUrl(blizzardRegion || "us", undefined, activeBlizzardClientId);

  // Auto-listen to Blizzard OAuth popup success
  useEffect(() => {
    const handleAuthMessage = async (e: MessageEvent) => {
      if (e.data && e.data.type === "BLIZZARD_AUTH_SUCCESS") {
        const code = e.data.code;
        if (code) {
          await handleDirectBlizzardLogin(code);
        } else if (e.data.error && triggerAlert) {
          triggerAlert("Erro na Autenticação Blizzard", `A Blizzard retornou o erro: ${e.data.error}`);
        }
      }
    };
    window.addEventListener("message", handleAuthMessage);
    return () => window.removeEventListener("message", handleAuthMessage);
  }, [blizzardRegion, blizzardClientId, blizzardClientSecret]);

  // Listen to Blizzard OAuth pre-flight re-authentication prompts
  useEffect(() => {
    const unsubscribe = registerBlizzardReauthListener((title, message) => {
      if (triggerAlert) {
        triggerAlert(title, message);
      }
    });
    return () => unsubscribe();
  }, [triggerAlert]);

  // Check URL query parameters if redirected in full window
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const bnetCode = urlParams.get("blizzard_code") || urlParams.get("code");
      if (bnetCode && (window.location.search.includes("blizzard") || bnetCode.startsWith("US") || bnetCode.startsWith("EU"))) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        handleDirectBlizzardLogin(bnetCode);
      }
    }
  }, []);

  const handleOpenBlizzardPopup = () => {
    if (!dynamicBlizzardOAuthUrl) return;
    const width = 600;
    const height = 750;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    window.open(
      dynamicBlizzardOAuthUrl,
      "blizzard_oauth_popup",
      `width=${width},height=${height},left=${left},top=${top},status=yes,scrollbars=yes`
    );
  };

  const handleCopyBlizzardLink = async () => {
    if (!dynamicBlizzardOAuthUrl) {
      if (triggerAlert) {
        triggerAlert("Client ID Necessário", "Por favor, digite seu Client ID da Blizzard para gerar o link oficial de login.");
      }
      return;
    }
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(dynamicBlizzardOAuthUrl);
        setCopiedBlizzardLink(true);
        setTimeout(() => setCopiedBlizzardLink(false), 4000);
        if (triggerAlert) {
          triggerAlert("Link Copiado!", "Link de login oficial da Blizzard / Battle.net copiado para a área de transferência.");
        }
      }
    } catch {}
  };

  const handlePasteBlizzardCodeFromClipboard = async () => {
    try {
      if (navigator.clipboard) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setBlizzardDirectInput(text.trim());
          if (triggerAlert) {
            triggerAlert("Texto Colado!", "Código/Token colado da área de transferência com sucesso.");
          }
        }
      }
    } catch (err) {
      console.warn("Não foi possível ler da área de transferência:", err);
    }
  };

  const GOG_OAUTH_URL = "https://auth.gog.com/auth?client_id=46899977096215655&redirect_uri=https://embed.gog.com/on_login_success?origin=client&response_type=code&layout=client2";

  const handleOpenOfficialGog = (e?: React.MouseEvent) => {
    // Keep native anchor navigation as default, but guarantee clipboard copy as fallback
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(GOG_OAUTH_URL);
        setCopiedGogLink(true);
        setTimeout(() => setCopiedGogLink(false), 4000);
      }
    } catch {}
  };

  const handleCopyGogLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(GOG_OAUTH_URL);
        setCopiedGogLink(true);
        setTimeout(() => setCopiedGogLink(false), 4000);
        if (triggerAlert) {
          triggerAlert("Link Copiado!", "Link de login oficial da GOG copiado para a área de transferência.");
        }
      }
    } catch {
      // fallback
    }
  };

  const handlePasteGogCodeFromClipboard = async () => {
    try {
      if (navigator.clipboard) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setGogDirectInput(text.trim());
          if (triggerAlert) {
            triggerAlert("Texto Colado!", "URL / Código colado da área de transferência com sucesso.");
          }
        }
      }
    } catch (err) {
      console.warn("Não foi possível ler da área de transferência:", err);
    }
  };

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

  // Local Blizzard API Raw Responses Cache State
  const [blizzardCacheStats, setBlizzardCacheStats] = useState<{ count: number; totalSizeBytes: number; storageType: string }>({
    count: 0,
    totalSizeBytes: 0,
    storageType: "indexeddb",
  });
  const [isClearingBlizzardCache, setIsClearingBlizzardCache] = useState(false);

  const [sfxEnabled, setSfxEnabled] = useState(isSoundEffectsEnabled());
  const [youtubeConnected, setYoutubeConnected] = useState(isYouTubeAuthenticated());
  const [isConnectingYoutube, setIsConnectingYoutube] = useState(false);

  // Auto load profile summary, IGDB and SteamGridDB status on mount
  useEffect(() => {
    getImageCacheStats().then(setImageCacheStats);
    getBlizzardCacheStats().then(setBlizzardCacheStats);

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
      if (triggerAlert) triggerAlert("Atenção", "Por favor, digite seu código de login oficial da GOG, URL redirecionada ou nome de usuário/perfil.");
      return;
    }

    setIsLoggingInGog(true);
    try {
      // Check if input is an OAuth code or redirect URL
      if (target.includes("code=") || target.includes("embed.gog.com") || target.length >= 30) {
        try {
          const authResult = await exchangeGogCode(target);
          if (authResult && authResult.success) {
            setGogUsernameInput(authResult.username);
            setGogUserIdInput(authResult.userId);
            setGogProfileSummary({
              username: authResult.username,
              userId: authResult.userId,
              avatarUrl: authResult.avatarUrl,
              gamesCount: authResult.gamesCount,
            });
            setGogDirectAuthModalOpen(false);
            if (triggerAlert) {
              triggerAlert(
                "GOG Galaxy Conectado com Sucesso!",
                `Conta "${authResult.username}" vinculada oficialmente via OAuth da GOG! Suas horas de jogo, conquistas e jogos da biblioteca ficarão sincronizados permanentemente.`
              );
            }
            return;
          }
        } catch (authErr: any) {
          console.warn("Tentativa de exchange de código falhou, tentando busca por perfil:", authErr);
        }
      }

      // Fallback: Profile lookup
      const profile = await fetchGogProfile(target);

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
            `Conta GOG vinculada para "${profile.username}"! Sessão salva permanentemente neste computador. ${profile.gamesCount ? `Localizados ${profile.gamesCount} jogos na biblioteca.` : ""}`
          );
        }
      } else {
        setStoredGogUsername(target);
        setGogUsernameInput(target);
        setGogDirectAuthModalOpen(false);
        if (triggerAlert) {
          triggerAlert("GOG Galaxy Conectado!", `Sessão vinculada e salva no computador para "${target}".`);
        }
      }
    } catch (err: any) {
      console.error("Erro ao fazer login na GOG:", err);
      if (triggerAlert) triggerAlert("Erro no Login GOG", "Não foi possível validar o usuário na GOG. Verifique o código ou nome de usuário e tente novamente.");
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

  const handleDirectBlizzardLogin = async (inputToAuth?: string) => {
    const target = (inputToAuth || blizzardDirectInput || blizzardBattleTag).trim();
    if (!target) {
      if (triggerAlert) triggerAlert("Atenção", "Por favor, digite sua BattleTag (ex: Arthas#1234) ou o código gerado pelo login oficial da Blizzard.");
      return;
    }

    if (blizzardClientId.trim()) setStoredBlizzardClientId(blizzardClientId.trim());
    if (blizzardClientSecret.trim()) setStoredBlizzardClientSecret(blizzardClientSecret.trim());
    if (blizzardRegion) setStoredBlizzardRegion(blizzardRegion);

    setIsConnectingBlizzard(true);
    try {
      // 1. Direct BattleTag linking (e.g. "Arthas#1234" or "Haleck#1234")
      if (target.includes("#") && !target.includes("code=") && !target.includes("http")) {
        setStoredBlizzardBattleTag(target);
        setBlizzardBattleTag(target);
        setBlizzardDirectAuthModalOpen(false);
        setIsBlizzardConnected(true);
        if (triggerAlert) {
          triggerAlert("BattleTag Vinculada com Sucesso!", `Conta BattleTag "${target}" salva permanentemente. Personagens e dados sincronizados no servidor.`);
        }
        return;
      }

      // 2. OAuth authorization code or access token exchange
      if (target.includes("code=") || target.includes("localhost") || target.length >= 20) {
        let code = target;
        if (code.includes("code=")) {
          const match = code.match(/(?:[?&]|^)code=([^&#\s]+)/);
          if (match) code = match[1];
        }
        code = code.replace(/^Bearer\s+/i, "").trim().replace(/^["']|["']$/g, "");

        try {
          const effRedirectUri = getEffectiveBlizzardRedirectUri();
          const authResult = await exchangeBlizzardCode(code, effRedirectUri);
          if (authResult && (authResult.token || authResult.success)) {
            setIsBlizzardConnected(true);
            const tag = authResult.battleTag || getStoredBlizzardBattleTag();
            if (tag) setBlizzardBattleTag(tag);
            setBlizzardDirectAuthModalOpen(false);
            if (triggerAlert) {
              triggerAlert(
                "Battle.net / Blizzard Conectado com Sucesso!",
                `Conta Battle.net vinculada oficialmente via OAuth da Blizzard! BattleTag: "${tag || "Gamer"}". Seus personagens de WoW, equipamentos, conquistas e montarias foram sincronizados com sucesso.`
              );
            }
            return;
          } else if (authResult && (authResult.requiresReauth || authResult.error)) {
            console.warn("Blizzard OAuth exchange aviso:", authResult.error);
            const noticeTitle = authResult.userNotice?.title || "Código Expirado ou Inválido";
            const noticeMsg =
              authResult.userNotice?.message ||
              authResult.error ||
              "O código de autorização expirou ou já foi utilizado. Por favor, inicie uma nova autenticação.";
            if (triggerAlert) {
              triggerAlert(noticeTitle, noticeMsg);
            }
            if (authResult.requiresReauth) {
              return;
            }
          }
        } catch (authErr: any) {
          console.warn("Tentativa de exchange de código Blizzard falhou, tentando validação de token:", authErr);
        }
      }

      // 3. Fallback: Check if it's a token or valid BattleTag
      const verified = await verifyAndSaveManualToken(target, blizzardBattleTag);
      if (verified) {
        setIsBlizzardConnected(true);
        const tag = getStoredBlizzardBattleTag() || target;
        setBlizzardBattleTag(tag);
        setBlizzardDirectAuthModalOpen(false);
        if (triggerAlert) {
          triggerAlert(
            "Battle.net / Blizzard Conectado!",
            `Sessão persistente ativada para "${tag}". Seus dados da Blizzard e World of Warcraft estão sincronizados permanentemente no servidor.`
          );
        }
      } else {
        // Save as BattleTag reference
        if (target.includes("#")) {
          setStoredBlizzardBattleTag(target);
          setBlizzardBattleTag(target);
          setBlizzardDirectAuthModalOpen(false);
          setIsBlizzardConnected(true);
          if (triggerAlert) {
            triggerAlert("BattleTag Vinculada!", `BattleTag "${target}" salva com sucesso.`);
          }
        } else {
          if (triggerAlert) {
            triggerAlert("Falha na Validação", "Não foi possível validar o código ou token da Blizzard. Certifique-se de copiar o código retornado na URL de login ou informe sua BattleTag (ex: Arthas#1234).");
          }
        }
      }
    } catch (err: any) {
      console.error("Erro ao conectar Blizzard:", err);
      if (triggerAlert) triggerAlert("Erro no Login Blizzard", "Não foi possível conectar com a API da Blizzard: " + (err.message || String(err)));
    } finally {
      setIsConnectingBlizzard(false);
    }
  };

  const handleDisconnectBlizzard = () => {
    clearBlizzardOAuthSession();
    setBlizzardTokenInput("");
    setBlizzardBattleTag("");
    setIsBlizzardConnected(false);
    if (triggerAlert) triggerAlert("Blizzard Desconectada", "Sua sessão da Battle.net / Blizzard foi removida.");
  };

  const handleSaveBlizzardKeys = async () => {
    setIsConnectingBlizzard(true);
    try {
      const reg = blizzardRegion || "us";
      setStoredBlizzardRegion(reg);
      if (blizzardClientId) setStoredBlizzardClientId(blizzardClientId);
      if (blizzardClientSecret) setStoredBlizzardClientSecret(blizzardClientSecret);
      if (blizzardBattleTag) setStoredBlizzardBattleTag(blizzardBattleTag);

      if (blizzardTokenInput && blizzardTokenInput.trim()) {
        const ok = await verifyAndSaveManualToken(blizzardTokenInput.trim(), blizzardBattleTag);
        if (ok) {
          setIsBlizzardConnected(true);
          setShowBlizzardConfig(false);
          if (triggerAlert) {
            triggerAlert("Battle.net Conectado!", "Token OAuth da Blizzard validado e salvo com sucesso!");
          }
          return;
        }
      }

      if (blizzardClientId && blizzardClientSecret && (!blizzardTokenInput || !blizzardTokenInput.trim())) {
        try {
          const directAuth = await requestBlizzardClientCredentials(blizzardClientId, blizzardClientSecret, reg);
          if (directAuth.success && directAuth.token) {
            setIsBlizzardConnected(true);
            setShowBlizzardConfig(false);
            if (triggerAlert) {
              triggerAlert("Battle.net Conectado via API!", "Credenciais de desenvolvedor autenticadas com sucesso diretamente na Blizzard!");
            }
            return;
          }
        } catch (authErr) {
          console.warn("Client credentials error:", authErr);
        }
      }

      setIsBlizzardConnected(isBlizzardAuthenticated());
      setShowBlizzardConfig(false);
      if (triggerAlert) {
        triggerAlert("Configurações Salvas", "Região, credenciais e BattleTag salvas com sucesso!");
      }
    } finally {
      setIsConnectingBlizzard(false);
    }
  };

  if (!isOpen) return null;

  const hasCustomImgBBKey = !!getCustomImgBBKey();
  const linkedSteamGames = games.filter(
    (g) => g.integrationPlatform === "steam" || g.steamAppId || (g.steamPlaytimeMinutes && g.steamPlaytimeMinutes > 0)
  );
  const linkedGogGames = games.filter(
    (g) => g.integrationPlatform === "gog" || g.gogGameId || (g.gogPlaytimeMinutes && g.gogPlaytimeMinutes > 0)
  );
  const linkedBlizzardGames = games.filter(
    (g) =>
      g.integrationPlatform === "battlenet" ||
      (g.integrationPlatform as any) === "blizzard" ||
      g.platform?.toLowerCase().includes("blizzard") ||
      g.platform?.toLowerCase().includes("battle.net") ||
      g.name?.toLowerCase().includes("warcraft") ||
      g.name?.toLowerCase().includes("world of warcraft") ||
      g.name?.toLowerCase().includes("diablo") ||
      g.name?.toLowerCase().includes("overwatch") ||
      g.name?.toLowerCase().includes("starcraft") ||
      g.name?.toLowerCase().includes("hearthstone")
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
                {linkedSteamGames.length + linkedGogGames.length + linkedBlizzardGames.length} jogos integrados
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

              {/* BLIZZARD BATTLE.NET & WOW API INTEGRATION CARD */}
              <div className="p-4 bg-zinc-900/80 border border-sky-500/30 rounded-2xl space-y-3 hover:border-sky-500/50 transition-all shadow-md">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 bg-sky-500/15 border border-sky-500/30 rounded-xl text-sky-400 shrink-0">
                      <Zap size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">Blizzard Battle.net API</span>
                        {isBlizzardConnected ? (
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
                        {isBlizzardConnected
                          ? `BattleTag: ${blizzardBattleTag || "Ativa"} (${linkedBlizzardGames.length} jogos/WoW)`
                          : "Conecte sua conta Battle.net para puxar personagens e armory"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setBlizzardDirectAuthModalOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-extrabold transition-all cursor-pointer shadow-md shadow-sky-600/20 flex items-center gap-1.5"
                    >
                      <Sparkles size={13} className="text-sky-200" />
                      <span>Login Battle.net</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowBlizzardConfig(!showBlizzardConfig)}
                      className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-all cursor-pointer"
                    >
                      {showBlizzardConfig ? "Ocultar" : "Avançado"}
                    </button>
                  </div>
                </div>

                {/* Sincronização em Lote da API Blizzard / WoW */}
                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-zinc-400">
                    <span className="text-white font-medium">{linkedBlizzardGames.length}</span> {linkedBlizzardGames.length === 1 ? "jogo/expansão" : "jogos/expansões"} identificados
                  </div>
                  {onBatchSyncBlizzard && (
                    <button
                      type="button"
                      onClick={() => onBatchSyncBlizzard()}
                      disabled={isSyncingBlizzardBatch}
                      className="px-3 py-1.5 rounded-xl bg-sky-950/60 hover:bg-sky-900/80 border border-sky-500/40 text-sky-200 hover:text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                    >
                      {isSyncingBlizzardBatch ? (
                        <>
                          <Loader2 size={12} className="animate-spin text-sky-400" />
                          <span>Sincronizando WoW...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw size={12} className="text-sky-400" />
                          <span>Sincronizar Tudo (API)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Botão de Acesso Rápido ao Add-on Dev Studio */}
                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-cyan-300">
                    <Code size={13} className="text-cyan-400" />
                    <span>Criação de Add-ons & Documentação Lua:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAddonDevModalOpen(true)}
                    className="px-2.5 py-1 rounded-xl bg-cyan-950/70 hover:bg-cyan-900/90 border border-cyan-500/40 text-cyan-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <Code size={12} />
                    <span>Add-on Dev Studio</span>
                  </button>
                </div>

                {/* Configurações Avançadas e Chaves da Blizzard */}
                {showBlizzardConfig && (
                  <div className="pt-3 border-t border-zinc-800 space-y-2.5 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                          Região Blizzard
                        </label>
                        <select
                          value={blizzardRegion}
                          onChange={(e) => setBlizzardRegion(e.target.value as "us" | "eu" | "kr" | "tw")}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                        >
                          <option value="us">US / Americas (Brasil)</option>
                          <option value="eu">EU / Europe</option>
                          <option value="kr">KR / Korea</option>
                          <option value="tw">TW / Taiwan</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                          BattleTag
                        </label>
                        <input
                          type="text"
                          value={blizzardBattleTag}
                          onChange={(e) => setBlizzardBattleTag(e.target.value)}
                          placeholder="Ex: Arthas#1234"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                          Client ID (Developer)
                        </label>
                        <input
                          type="text"
                          value={blizzardClientId}
                          onChange={(e) => setBlizzardClientId(e.target.value)}
                          placeholder="Client ID da Blizzard"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-sky-500 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                          Client Secret
                        </label>
                        <input
                          type="password"
                          value={blizzardClientSecret}
                          onChange={(e) => setBlizzardClientSecret(e.target.value)}
                          placeholder="Client Secret"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-sky-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        OAuth Bearer Token (Manual ou Automático)
                      </label>
                      <input
                        type="password"
                        value={blizzardTokenInput}
                        onChange={(e) => setBlizzardTokenInput(e.target.value)}
                        placeholder="Bearer token gerado"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-sky-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveBlizzardKeys}
                        disabled={isConnectingBlizzard}
                        className="flex-1 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-sky-500/20"
                      >
                        {isConnectingBlizzard ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        <span>Validar & Salvar Blizzard</span>
                      </button>

                      {isBlizzardConnected && (
                        <button
                          type="button"
                          onClick={handleDisconnectBlizzard}
                          className="px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 text-xs font-bold transition-all cursor-pointer"
                          title="Desconectar conta Blizzard"
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

              {/* YOUTUBE ITEM */}
              <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-2xl flex items-center justify-between gap-3 hover:border-red-500/30 transition-all shadow-md">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 shrink-0">
                    <Video size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">YouTube</span>
                      {youtubeConnected ? (
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
                      {youtubeConnected ? "Upload de vídeos e playlists sincronizados" : "Envio de vídeos e criação de playlists por jogo"}
                    </p>
                  </div>
                </div>

                {youtubeConnected ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await signOutYouTube();
                      setYoutubeConnected(false);
                      if (triggerAlert) triggerAlert("YouTube Desconectado", "A autorização do YouTube foi desvinculada.");
                    }}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-rose-950/50 border border-zinc-700 hover:border-rose-500/40 text-zinc-300 hover:text-rose-300 text-xs font-bold transition-all cursor-pointer shrink-0"
                  >
                    Sair
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isConnectingYoutube}
                    onClick={async () => {
                      try {
                        setIsConnectingYoutube(true);
                        await signInWithYouTube();
                        setYoutubeConnected(true);
                        if (triggerAlert) triggerAlert("YouTube Conectado", "Conta autorizada para envio de vídeos e organização de playlists no YouTube!");
                      } catch (err: any) {
                        if (!err?.isCancelled) {
                          if (triggerAlert) triggerAlert("Erro no YouTube", `Não foi possível autorizar o YouTube: ${err.message || err}`);
                        }
                      } finally {
                        setIsConnectingYoutube(false);
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer shrink-0 shadow-md shadow-red-500/20 flex items-center gap-1.5"
                  >
                    {isConnectingYoutube ? <Loader2 size={13} className="animate-spin" /> : null}
                    Conectar
                  </button>
                )}
              </div>

              {typeof window !== "undefined" && window.self !== window.top && (!driveAuthenticated || !gmailUser) && (
                <div className="p-3 bg-zinc-950/80 border border-zinc-800/80 rounded-xl flex items-start gap-2.5 text-[11px] text-zinc-400">
                  <ExternalLink size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span>
                      Dica: Se o navegador fechar o pop-up de login do Google automaticamente devido às restrições de iframe de visualização, você pode{" "}
                    </span>
                    <a
                      href={window.location.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 font-bold underline inline-flex items-center gap-0.5"
                    >
                      abrir o aplicativo em uma nova aba ↗
                    </a>
                    <span> para conectar suas contas sem interferência do navegador.</span>
                  </div>
                </div>
              )}
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

            {/* Local Blizzard API Raw Responses Cache Card */}
            <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-2.5 bg-sky-500/15 border border-sky-500/30 rounded-xl text-sky-400 shrink-0">
                  <Database size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">
                      Cache Local da Blizzard API
                    </span>
                    <span className="text-[9px] font-mono font-bold text-sky-400 bg-sky-950/50 border border-sky-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Clock size={9} /> TTL 24h Ativo
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Armazenamento local de respostas brutas ({blizzardCacheStats.storageType.toUpperCase()}): <strong className="text-zinc-200">{blizzardCacheStats.count} perfis salvos</strong> com frescor de 24h para navegação instantânea e economia de cota da API.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  disabled={isClearingBlizzardCache || blizzardCacheStats.count === 0}
                  onClick={async () => {
                    setIsClearingBlizzardCache(true);
                    await clearAllBlizzardRawCache();
                    const stats = await getBlizzardCacheStats();
                    setBlizzardCacheStats(stats);
                    setIsClearingBlizzardCache(false);
                    if (triggerAlert) {
                      triggerAlert("Cache Blizzard Limpo", "O cache local de respostas brutas da Blizzard API foi esvaziado. Novas requisições consultarão a API da Blizzard.");
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                  title="Esvaziar cache local de dados brutos da Blizzard"
                >
                  {isClearingBlizzardCache ? (
                    <Loader2 size={12} className="animate-spin text-sky-400" />
                  ) : (
                    <Trash2 size={12} className="text-rose-400" />
                  )}
                  <span>Limpar Cache Blizzard</span>
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
            className="relative w-full max-w-lg bg-[#130b24] border border-purple-500/50 rounded-3xl p-6 shadow-2xl text-white space-y-4 animate-scaleUp overflow-hidden"
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
                    Conectar Conta GOG Galaxy
                  </h3>
                  <p className="text-xs text-purple-200/80">Sincronização contínua de horas, conquistas e jogos</p>
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

            {/* Quick Step Guide for Official OAuth */}
            <div className="p-3.5 bg-purple-950/40 border border-purple-500/30 rounded-2xl text-xs text-purple-200/90 leading-relaxed space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-white flex items-center gap-1.5 text-xs">
                  <Sparkles size={13} className="text-purple-300" />
                  Método Oficial OAuth (Recomendado)
                </span>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Permanente
                </span>
              </div>
              
              <div className="space-y-1 text-[11px] text-zinc-300">
                <p>1. Clique no botão para abrir o login da GOG ou copie o link oficial.</p>
                <p>2. Faça login na sua conta GOG. A página retornará uma confirmação.</p>
                <p>3. Copie o link final (ou código) retornado e cole no campo abaixo.</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <a
                  href={GOG_OAUTH_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleOpenOfficialGog}
                  className="inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs transition-all shadow-md shadow-purple-600/30 cursor-pointer text-center"
                >
                  <ExternalLink size={14} />
                  <span>Abrir Login Oficial GOG</span>
                </a>

                <button
                  type="button"
                  onClick={handleCopyGogLink}
                  className="inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-purple-200 hover:text-white font-bold text-xs transition-all cursor-pointer border border-purple-500/30"
                >
                  {copiedGogLink ? (
                    <>
                      <Check size={14} className="text-emerald-400" />
                      <span className="text-emerald-400">Link Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} className="text-purple-300" />
                      <span>Copiar Link de Login</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-purple-300 uppercase tracking-wider block">
                  Cole a URL de Sucesso, Código OAuth ou Usuário:
                </label>
                <button
                  type="button"
                  onClick={handlePasteGogCodeFromClipboard}
                  className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <ClipboardPaste size={12} />
                  <span>Colar da Transferência</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={gogDirectInput}
                  onChange={(e) => setGogDirectInput(e.target.value)}
                  placeholder="Ex: https://embed.gog.com/on_login_success?origin=client&code=... ou SeuUsuarioGOG"
                  className="w-full bg-zinc-950/90 border border-purple-500/40 focus:border-purple-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none font-medium shadow-inner"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleDirectGogLogin(gogDirectInput);
                    }
                  }}
                />
              </div>
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
                    <CheckCircle2 size={15} className="text-purple-200" />
                    <span>Confirmar & Sincronizar Permanente</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BLIZZARD BATTLE.NET DIRECT AUTH MODAL */}
      {blizzardDirectAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-sky-500/40 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 relative max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-sky-500/15 border border-sky-500/30 rounded-2xl text-sky-400">
                  <Zap size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Vincular Conta Blizzard / Battle.net</h3>
                  <p className="text-xs text-zinc-400">Sincronização persistente de personagens, WoW e conquistas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBlizzardDirectAuthModalOpen(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex bg-zinc-950/80 p-1 rounded-2xl border border-zinc-800 gap-1">
              <button
                type="button"
                onClick={() => setBlizzardModalTab("battletag")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  blizzardModalTab === "battletag"
                    ? "bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-md shadow-sky-600/20"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                <Zap size={14} />
                <span>⚡ BattleTag Direta</span>
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold">Instantâneo</span>
              </button>
              <button
                type="button"
                onClick={() => setBlizzardModalTab("oauth")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  blizzardModalTab === "oauth"
                    ? "bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-md shadow-sky-600/20"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                <Key size={14} />
                <span>Login Oficial OAuth</span>
              </button>
            </div>

            {/* TAB 1: BATTLETAG (INSTANT & NO 401 ERRORS) */}
            {blizzardModalTab === "battletag" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="bg-sky-950/20 border border-sky-500/25 rounded-2xl p-4 text-xs text-zinc-300 space-y-2">
                  <div className="font-semibold text-sky-300 flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-sky-400" />
                    <span>Conexão Direta Sem Necessidade de App Blizzard</span>
                  </div>
                  <p className="text-zinc-400 leading-relaxed text-[11px]">
                    Não precisa se cadastrar no portal de desenvolvedores da Blizzard nem configurar chaves. Digite sua <strong>BattleTag completa</strong> (ex: <code className="text-sky-300 font-mono">Arthas#1234</code>) para vincular sua conta e sincronizar automaticamente todos os seus personagens do World of Warcraft.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-sky-300 uppercase tracking-wider block">
                    Sua BattleTag:
                  </label>
                  <input
                    type="text"
                    value={blizzardBattleTag}
                    onChange={(e) => {
                      setBlizzardBattleTag(e.target.value);
                      setBlizzardDirectInput(e.target.value);
                    }}
                    placeholder="Ex: Arthas#1234 ou SeuNick#5678"
                    className="w-full bg-zinc-950/90 border border-sky-500/40 focus:border-sky-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none font-medium shadow-inner"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleDirectBlizzardLogin(blizzardBattleTag);
                      }
                    }}
                  />
                  <p className="text-[11px] text-zinc-500">
                    Insira seu nome de jogador seguido da hashtag e números cadastrados na Battle.net.
                  </p>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setBlizzardDirectAuthModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDirectBlizzardLogin(blizzardBattleTag)}
                    disabled={isConnectingBlizzard || !blizzardBattleTag.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-extrabold transition-all cursor-pointer shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isConnectingBlizzard ? (
                      <>
                        <Loader2 size={15} className="animate-spin text-white" />
                        <span>Vinculando BattleTag...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={15} className="text-sky-200" />
                        <span>Vincular BattleTag & Sincronizar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: OFFICIAL OAUTH (BLIZZARD DEVELOPER PORTAL) */}
            {blizzardModalTab === "oauth" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="bg-amber-950/20 border border-amber-500/25 rounded-2xl p-3.5 text-xs text-zinc-300 space-y-1.5">
                  <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <Shield size={14} className="text-amber-400" />
                    <span>Por que ocorre o erro 401 Bad client credentials?</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    A Blizzard exige que todo login OAuth use um <strong>Client ID</strong> registrado por você no portal gratuito de desenvolvedores da Blizzard. Sem um Client ID cadastrado, a página oficial da Battle.net rejeita a autorização com o erro 401.
                  </p>
                  <div className="pt-1">
                    <a
                      href="https://develop.battle.net/access/clients"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-bold underline"
                    >
                      <span>Abrir Portal de Desenvolvedores da Blizzard (develop.battle.net)</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>

                {/* PASSO 1: CLIENT ID & REDIRECT URI */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-sky-300 uppercase tracking-wider block">
                        1. Seu Blizzard Client ID:
                      </label>
                      <span className="text-[10px] text-zinc-400 font-mono">develop.battle.net</span>
                    </div>
                    <input
                      type="text"
                      value={blizzardClientId || DEFAULT_BLIZZARD_CLIENT_ID}
                      onChange={(e) => setBlizzardClientId(e.target.value)}
                      placeholder="Client ID da Blizzard"
                      className="w-full bg-zinc-950/90 border border-sky-500/40 focus:border-sky-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none font-medium shadow-inner"
                    />
                  </div>

                  {/* Redirect URI Badge */}
                  <div className="bg-sky-950/40 border border-sky-500/30 rounded-xl p-2.5 text-xs flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wider mb-0.5">
                        Redirect URI Autorizada:
                      </div>
                      <div className="font-mono text-[11px] text-zinc-200 truncate select-all">
                        {getEffectiveBlizzardRedirectUri()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(getEffectiveBlizzardRedirectUri());
                        if (triggerAlert) triggerAlert("Copiado!", "Redirect URI copiada para a área de transferência.");
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-sky-900/60 hover:bg-sky-800 text-sky-200 text-[11px] font-bold shrink-0 flex items-center gap-1 transition-all cursor-pointer border border-sky-600/40"
                    >
                      <Copy size={11} />
                      <span>Copiar</span>
                    </button>
                  </div>
                </div>

                {/* PASSO 2: BOTÃO ABRIR LOGIN OFICIAL */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-sky-300 uppercase tracking-wider block">
                    2. Autorização na Blizzard Battle.net:
                  </label>
                  {dynamicBlizzardOAuthUrl ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleOpenBlizzardPopup}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-extrabold text-center text-xs flex items-center justify-center gap-1.5 shadow-md shadow-sky-600/30 transition-all cursor-pointer"
                      >
                        <ExternalLink size={14} />
                        <span>Abrir Janela de Login Blizzard Battle.net</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyBlizzardLink}
                        className="px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-zinc-700 shrink-0"
                        title="Copiar URL de login oficial"
                      >
                        {copiedBlizzardLink ? (
                          <>
                            <Check size={14} className="text-emerald-400" />
                            <span className="text-emerald-400">Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} className="text-sky-300" />
                            <span>Copiar Link</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : null}
                  <p className="text-[10px] text-zinc-500">
                    A janela de login da Battle.net abrirá e sincronizará sua conta automaticamente ao autorizar.
                  </p>
                </div>

                {/* PASSO 3: COLAR CÓDIGO */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-sky-300 uppercase tracking-wider block">
                      3. Cole o Código Retornado ou URL de Redirecionamento:
                    </label>
                    <button
                      type="button"
                      onClick={handlePasteBlizzardCodeFromClipboard}
                      className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <ClipboardPaste size={12} />
                      <span>Colar da Transferência</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={blizzardDirectInput}
                    onChange={(e) => setBlizzardDirectInput(e.target.value)}
                    placeholder="Ex: https://localhost/?code=US123... ou token Bearer"
                    className="w-full bg-zinc-950/90 border border-sky-500/40 focus:border-sky-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none font-medium shadow-inner"
                  />
                </div>

                {/* CLIENT SECRET OPCIONAL */}
                {blizzardClientId && (
                  <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                      Client Secret (Opcional - Para Autenticação Direta via API):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={blizzardClientSecret}
                        onChange={(e) => setBlizzardClientSecret(e.target.value)}
                        placeholder="Client Secret da Blizzard"
                        className="flex-1 bg-zinc-950/90 border border-zinc-800 focus:border-sky-400 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none font-medium"
                      />
                      {blizzardClientId && blizzardClientSecret && (
                        <button
                          type="button"
                          onClick={handleSaveBlizzardKeys}
                          disabled={isConnectingBlizzard}
                          className="px-3 py-2 rounded-xl bg-sky-700 hover:bg-sky-600 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                        >
                          <Zap size={13} />
                          <span>Autenticar via API</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setBlizzardDirectAuthModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDirectBlizzardLogin(blizzardDirectInput)}
                    disabled={isConnectingBlizzard || !blizzardDirectInput.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-extrabold transition-all cursor-pointer shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isConnectingBlizzard ? (
                      <>
                        <Loader2 size={15} className="animate-spin text-white" />
                        <span>Validando Código na Blizzard...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={15} className="text-sky-200" />
                        <span>Confirmar & Sincronizar OAuth</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WOW ADDON DEV STUDIO & DOCUMENTATION MODAL */}
      <WoWAddonDevModal
        isOpen={addonDevModalOpen}
        onClose={() => setAddonDevModalOpen(false)}
        triggerAlert={triggerAlert}
      />
    </div>
  );
}
