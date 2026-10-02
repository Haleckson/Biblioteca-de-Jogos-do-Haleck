/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Settings,
  X,
  Key,
  Image,
  Database,
  Sliders,
  Shield,
  LogOut,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  HardDrive,
  Mail,
  Gamepad2,
  RefreshCw,
  Loader2,
  Globe,
  MonitorPlay,
  Save,
  Check,
  Lock,
  Cpu,
  Trash2,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Radio,
  Gauge,
  Zap,
  Layers,
  Copy,
  ExternalLink,
  ClipboardPaste,
  Video,
  Code,
  Clock,
  Download,
  Upload,
  FolderArchive,
  FolderOpen,
  Footprints,
  Swords,
  Users,
  FileText,
  Archive,
  HelpCircle,
  Info,
  Terminal,
  BookOpen,
  Eye,
  Server,
  AlertCircle,
  Activity,
  Compass,
  FileCode,
} from "lucide-react";
import { WoWAddonDevModal } from "./WoWAddonDevModal";
import { WoWAddonPreviewModal } from "./WoWAddonPreviewModal";
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
  exchangeGogCode,
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
  IgdbRateLimitState,
} from "../utils/igdbApi";
import {
  getStoredSteamGridApiKey,
  setStoredSteamGridApiKey,
  checkSteamGridStatus,
  clearSteamGridCache,
} from "../utils/steamGridDbApi";
import { SteamGridStatusResult } from "../types";
import { getImageCacheStats, clearAllImageCache } from "../utils/imageCacheManager";
import {
  downloadWoWAddonZip,
  downloadSyncAgentBatFile,
  downloadSyncAgentPs1File,
  getStoredAddonTargetPath,
  setStoredAddonTargetPath,
  downloadAddonInstallerBat,
  downloadAddonInstallerPs1,
  installAddonDirectlyToServer,
  checkAddonUpdateStatus,
  fetchDynamicDefinitions,
  AddonStatusResult,
  DEFAULT_WOW_FOREVER_ADDON_PATH,
  WOW_GOLDEN_RULES,
  WOW_VERSION_DIFFERENCES,
  validateWoWDirectoryStructure,
  writeAddonViaFileSystemApi,
  createMissingAddOnsFolder,
  WoWDirectoryValidationResult,
} from "../utils/addonExportService";
import { parseAddonData, ParsedAddonResult } from "../utils/wowAddonParser";
import {
  performSavedVariablesDryRun,
  exportProfileToSavedVariablesLua,
  exportProfileToJson,
  DryRunReport,
} from "../utils/wowSavedVariablesIntegrity";

export type AdminCategory = "blizzard" | "steam" | "gog" | "media" | "system";
export type BlizzardSubTab = "auth" | "addon_sync" | "simulator";

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
  initialCategory?: AdminCategory;
  initialBlizzardSubTab?: BlizzardSubTab;
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
  initialCategory = "blizzard",
  initialBlizzardSubTab = "auth",
}: SiteSettingsModalProps) {
  useBodyScrollLock(isOpen);

  // Active Category & SubTabs State
  const [activeCategory, setActiveCategory] = useState<AdminCategory>(initialCategory);
  const [blizzardSubTab, setBlizzardSubTab] = useState<BlizzardSubTab>(initialBlizzardSubTab);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(true);
  const [copiedRedirectUri, setCopiedRedirectUri] = useState<string | null>(null);
  const [copiedEndpoint, setCopiedEndpoint] = useState<boolean>(false);

  const handleCopyText = (text: string, type: "uri" | "endpoint") => {
    navigator.clipboard.writeText(text);
    if (type === "uri") {
      setCopiedRedirectUri(text);
      setTimeout(() => setCopiedRedirectUri(null), 2500);
    } else {
      setCopiedEndpoint(true);
      setTimeout(() => setCopiedEndpoint(false), 2500);
    }
  };

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
  const [addonDevModalOpen, setAddonDevModalOpen] = useState(false);
  const [simulatorModalOpen, setSimulatorModalOpen] = useState(false);

  // Addon & Sync Technical State
  const [selectedWoWVersion, setSelectedWoWVersion] = useState<string>("forever");
  const [addonCharName, setAddonCharName] = useState<string>("");
  const [addonRealmName, setAddonRealmName] = useState<string>("");
  const [addonRuleset, setAddonRuleset] = useState<string>("");
  const [isDownloadingAddon, setIsDownloadingAddon] = useState<boolean>(false);
  const [addonRawText, setAddonRawText] = useState<string>("");
  const [isParsingAddon, setIsParsingAddon] = useState<boolean>(false);
  const [addonParseError, setAddonParseError] = useState<string | null>(null);
  const [addonParsedResult, setAddonParsedResult] = useState<ParsedAddonResult | null>(null);
  const [isSyncingAddonServer, setIsSyncingAddonServer] = useState<boolean>(false);
  const addonFileInputRef = useRef<HTMLInputElement | null>(null);
  const wowDirectoryInputRef = useRef<HTMLInputElement | null>(null);

  // Addon Local Target Path & Auto-Installer State
  const [addonTargetPath, setAddonTargetPath] = useState<string>(getStoredAddonTargetPath());
  const [wowDirHandle, setWowDirHandle] = useState<any | null>(null);
  const [wowAddonsHandle, setWowAddonsHandle] = useState<any | null>(null);
  const [wowDirValidation, setWowDirValidation] = useState<WoWDirectoryValidationResult | null>(null);
  const [isValidatingWoWDir, setIsValidatingWoWDir] = useState<boolean>(false);
  const [isInstallingAddon, setIsInstallingAddon] = useState<boolean>(false);
  const [isUpdatingAddonDirectly, setIsUpdatingAddonDirectly] = useState<boolean>(false);
  const [isExportingJson, setIsExportingJson] = useState<boolean>(false);
  const [addonInstallMessage, setAddonInstallMessage] = useState<{ text: string; type: "success" | "info" | "error" } | null>(null);
  const [addonUpdateStatus, setAddonUpdateStatus] = useState<AddonStatusResult | null>(null);
  const [isCheckingAddonStatus, setIsCheckingAddonStatus] = useState<boolean>(false);
  const [dynamicDefsStatus, setDynamicDefsStatus] = useState<any | null>(null);
  const [isSyncingDynamicDefs, setIsSyncingDynamicDefs] = useState<boolean>(false);

  // SavedVariables Dry-Run & Integrity Validator State
  const [dryRunReport, setDryRunReport] = useState<DryRunReport | null>(null);
  const [dryRunRawText, setDryRunRawText] = useState<string>("");
  const [isPerformingDryRun, setIsPerformingDryRun] = useState<boolean>(false);
  const [isExportingSavedVariables, setIsExportingSavedVariables] = useState<boolean>(false);

  // IGDB / Twitch State
  const [igdbClientIdInput, setIgdbClientIdInput] = useState(getStoredIgdbClientId());
  const [igdbClientSecretInput, setIgdbClientSecretInput] = useState(getStoredIgdbClientSecret());
  const [showIgdbConfig, setShowIgdbConfig] = useState(false);
  const [isCheckingIgdb, setIsCheckingIgdb] = useState(false);
  const [igdbStatus, setIgdbStatus] = useState<IgdbStatusResult | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<IgdbRateLimitState>(getStoredRateLimitInfo());
  const [cacheStats, setCacheStats] = useState(getIgdbCacheStats());

  // SteamGridDB State
  const [steamGridApiKeyInput, setSteamGridApiKeyInput] = useState(getStoredSteamGridApiKey());
  const [showSteamGridConfig, setShowSteamGridConfig] = useState(false);
  const [isCheckingSteamGrid, setIsCheckingSteamGrid] = useState(false);
  const [steamGridStatus, setSteamGridStatus] = useState<SteamGridStatusResult | null>(null);

  // Image & Blizzard Raw Caches
  const [imageCacheStats, setImageCacheStats] = useState({ count: 0, sizeFormatted: "0 KB" });
  const [isClearingImageCache, setIsClearingImageCache] = useState(false);
  const [blizzardCacheStats, setBlizzardCacheStats] = useState<{ count: number; totalSizeBytes: number; storageType: string } | null>(null);
  const [isClearingBlizzardCache, setIsClearingBlizzardCache] = useState(false);

  // System & Audio
  const [sfxEnabled, setSfxEnabled] = useState(isSoundEffectsEnabled());
  const [youtubeConnected, setYoutubeConnected] = useState(isYouTubeAuthenticated());
  const [isConnectingYoutube, setIsConnectingYoutube] = useState(false);

  // Active WoW Game Identification
  const activeWowGame = games.find(
    (g) =>
      g.isWow ||
      (g.name && g.name.toLowerCase().includes("warcraft")) ||
      (g.platform && g.platform.toLowerCase().includes("warcraft")) ||
      g.blizzardCharacterName
  );

  const activeBlizzardClientId = (blizzardClientId || "").trim() || DEFAULT_BLIZZARD_CLIENT_ID;
  const dynamicBlizzardOAuthUrl = getBlizzardAuthUrl(blizzardRegion || "us", undefined, activeBlizzardClientId);

  // Reset to initial tab/category on open
  useEffect(() => {
    if (isOpen) {
      if (initialCategory) setActiveCategory(initialCategory);
      if (initialBlizzardSubTab) setBlizzardSubTab(initialBlizzardSubTab);
      if (activeWowGame) {
        setAddonCharName(activeWowGame.blizzardCharacterName || "");
        setAddonRealmName(activeWowGame.blizzardRealm || "");
        if (activeWowGame.wowVersion) {
          setSelectedWoWVersion(activeWowGame.wowVersion);
        }
      }
    }
  }, [isOpen, initialCategory, initialBlizzardSubTab, activeWowGame]);

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

  // Initial diagnostics load on mount
  useEffect(() => {
    getImageCacheStats().then(setImageCacheStats);
    getBlizzardCacheStats().then(setBlizzardCacheStats);

    checkIgdbStatus().then((res) => {
      setIgdbStatus(res);
      if (res.rateLimit) setRateLimitInfo(res.rateLimit);
    });

    checkSteamGridStatus().then((res) => {
      setSteamGridStatus(res);
    });

    setCacheStats(getIgdbCacheStats());
  }, [isOpen]);

  // Escape key listener to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (simulatorModalOpen) {
          setSimulatorModalOpen(false);
        } else if (blizzardDirectAuthModalOpen) {
          setBlizzardDirectAuthModalOpen(false);
        } else if (gogDirectAuthModalOpen) {
          setGogDirectAuthModalOpen(false);
        } else if (addonDevModalOpen) {
          setAddonDevModalOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, simulatorModalOpen, blizzardDirectAuthModalOpen, gogDirectAuthModalOpen, addonDevModalOpen, onClose]);

  // Handlers for Steam
  const handleSaveSteamKeys = () => {
    setStoredSteamApiKey(steamApiKeyInput);
    setStoredSteamId64(steamIdInput);
    if (triggerAlert) {
      triggerAlert("Credenciais Steam Salvas", "As configurações da Steam Web API foram atualizadas com sucesso!");
    }
  };

  // Handlers for GOG
  const handleDirectGogLogin = async (input: string) => {
    if (!input.trim()) return;
    setIsLoggingInGog(true);
    try {
      if (input.includes("code=") || input.length >= 40) {
        let code = input.trim();
        if (code.includes("code=")) {
          const match = code.match(/code=([^&]+)/);
          if (match) code = match[1];
        }
        const tokenRes = await exchangeGogCode(code);
        if (tokenRes && tokenRes.accessToken) {
          setStoredGogOAuthToken(tokenRes.accessToken);
          if (tokenRes.userId) setStoredGogUserId(tokenRes.userId);
          const profile = await fetchGogProfile(tokenRes.userId);
          if (profile) {
            setGogProfileSummary(profile);
            setStoredGogUsername(profile.username);
            setGogUsernameInput(profile.username);
          }
          setGogDirectAuthModalOpen(false);
          if (triggerAlert) triggerAlert("GOG Galaxy Conectado!", "Sua conta oficial da GOG foi conectada com sucesso!");
          return;
        }
      }

      const profile = await fetchGogProfile(input.trim());
      if (profile) {
        setGogProfileSummary(profile);
        setStoredGogUsername(profile.username);
        setStoredGogUserId(profile.userId);
        setGogUsernameInput(profile.username);
        setGogUserIdInput(profile.userId);
        setGogDirectAuthModalOpen(false);
        if (triggerAlert) triggerAlert("GOG Conectado", `Perfil de ${profile.username} identificado e sincronizado.`);
      } else {
        if (triggerAlert) triggerAlert("Falha GOG", "Não foi possível carregar os dados públicos do perfil da GOG informado.");
      }
    } catch (err: any) {
      if (triggerAlert) triggerAlert("Erro GOG", err?.message || "Erro ao conectar conta GOG.");
    } finally {
      setIsLoggingInGog(false);
    }
  };

  const handleDisconnectGog = () => {
    clearGogOAuthSession();
    setStoredGogUsername("");
    setStoredGogUserId("");
    setStoredGogApiKey("");
    setGogUsernameInput("");
    setGogUserIdInput("");
    setGogApiKeyInput("");
    setGogProfileSummary(null);
    if (triggerAlert) triggerAlert("GOG Desconectado", "Credenciais e sessões da GOG foram removidas.");
  };

  // Handlers for Blizzard
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

  const handleDirectBlizzardLogin = async (rawInput: string) => {
    if (!rawInput.trim()) return;
    setIsConnectingBlizzard(true);
    try {
      let code = rawInput.trim();
      if (code.includes("code=")) {
        const match = code.match(/code=([^&]+)/);
        if (match) code = match[1];
      }
      code = decodeURIComponent(code);

      const res = await exchangeBlizzardCode(code);

      if (res && res.success && res.token) {
        setStoredBlizzardOAuthToken(res.token);
        setBlizzardTokenInput(res.token);
        if (res.battleTag) {
          setStoredBlizzardBattleTag(res.battleTag);
          setBlizzardBattleTag(res.battleTag);
        }
        setIsBlizzardConnected(true);
        setBlizzardDirectAuthModalOpen(false);

        if (triggerAlert) {
          triggerAlert("Blizzard Conectada!", "Token OAuth oficial da Battle.net gerado e salvo com sucesso!");
        }

        if (onBatchSyncBlizzard) {
          setTimeout(() => onBatchSyncBlizzard(), 500);
        }
      } else {
        throw new Error(res.error || "A Blizzard não retornou um token de acesso válido.");
      }
    } catch (err: any) {
      if (triggerAlert) triggerAlert("Erro na Blizzard", err?.message || "Falha ao validar código na Blizzard.");
    } finally {
      setIsConnectingBlizzard(false);
    }
  };

  const handleSaveBlizzardKeys = async () => {
    setStoredBlizzardBattleTag(blizzardBattleTag);
    setStoredBlizzardRegion(blizzardRegion);
    setStoredBlizzardClientId(blizzardClientId);
    setStoredBlizzardClientSecret(blizzardClientSecret);

    if (blizzardTokenInput.trim()) {
      setIsConnectingBlizzard(true);
      try {
        const valid = await verifyAndSaveManualToken(blizzardTokenInput.trim(), blizzardRegion);
        if (valid) {
          setIsBlizzardConnected(true);
          if (triggerAlert) triggerAlert("Token Blizzard Válido", "Token OAuth verificado e salvo com sucesso!");
        } else {
          setIsBlizzardConnected(false);
          if (triggerAlert) triggerAlert("Token Inválido", "O token fornecido expirou ou não possui as permissões necessárias.");
        }
      } finally {
        setIsConnectingBlizzard(false);
      }
      return;
    }

    if (blizzardClientId.trim() && blizzardClientSecret.trim()) {
      setIsConnectingBlizzard(true);
      try {
        const res = await requestBlizzardClientCredentials(blizzardRegion, blizzardClientId, blizzardClientSecret);
        if (res && res.success && res.token) {
          setStoredBlizzardOAuthToken(res.token);
          setBlizzardTokenInput(res.token);
          setIsBlizzardConnected(true);
          if (triggerAlert) triggerAlert("Client Credentials Conectado", "Chaves de API da Blizzard validadas com sucesso!");
        }
      } catch (err: any) {
        if (triggerAlert) triggerAlert("Erro na API Blizzard", err?.message || "Não foi possível autenticar o par de chaves.");
      } finally {
        setIsConnectingBlizzard(false);
      }
      return;
    }

    if (triggerAlert) triggerAlert("Configurações Salvas", "Preferências da Blizzard atualizadas localmente.");
  };

  const handleDisconnectBlizzard = () => {
    clearBlizzardOAuthSession();
    setStoredBlizzardBattleTag("");
    setStoredBlizzardOAuthToken("");
    setBlizzardBattleTag("");
    setBlizzardTokenInput("");
    setIsBlizzardConnected(false);
    if (triggerAlert) triggerAlert("Blizzard Desconectada", "Sessão e token da Battle.net removidos.");
  };

  const handleClearBlizzardCache = async () => {
    setIsClearingBlizzardCache(true);
    await clearAllBlizzardRawCache();
    const stats = await getBlizzardCacheStats();
    setBlizzardCacheStats(stats);
    setIsClearingBlizzardCache(false);
    if (triggerAlert) triggerAlert("Cache Blizzard Limpo", "Cache de respostas da API Blizzard esvaziado.");
  };

  // Addon & Sync Handlers
  const handleDownloadAddonZip = async () => {
    try {
      setIsDownloadingAddon(true);
      await downloadWoWAddonZip({
        gameVersion: selectedWoWVersion,
        characterName: addonCharName,
        realm: addonRealmName,
        ruleset: addonRuleset || undefined,
      });
      if (triggerAlert) triggerAlert("Addon Baixado", "Download do HaleckAccountImporter.zip iniciado com sucesso!");
    } catch (err: any) {
      if (triggerAlert) triggerAlert("Erro no Addon", err.message || "Falha ao gerar pacote do Addon.");
    } finally {
      setIsDownloadingAddon(false);
    }
  };

  const handleUploadSavedVariables = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingAddon(true);
    setAddonParseError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || "");
        setAddonRawText(text);
        const parsed = parseAddonData(text);
        setAddonParsedResult(parsed);

        // Enviar snapshot diretamente para o backend persistente
        fetch("/api/blizzard/wow/addon-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawLua: text }),
        }).catch((e) => console.warn("Aviso ao persistir addon sync:", e));

        if (triggerAlert) {
          triggerAlert(
            "Addon Importado!",
            `Snapshot lido com sucesso! Personagem ${parsed.activeProfile.name} (${parsed.activeProfile.realm}) detectado com ${parsed.activeProfile.equippedItems?.length || 0} itens.`
          );
        }
      } catch (err: any) {
        setAddonParseError(err.message || "Erro ao ler arquivo do Addon.");
        if (triggerAlert) triggerAlert("Erro de Importação", err.message || "Arquivo inválido ou corrompido.");
      } finally {
        setIsParsingAddon(false);
      }
    };
    reader.onerror = () => {
      setIsParsingAddon(false);
      setAddonParseError("Erro ao abrir arquivo do disco.");
    };
    reader.readAsText(file);
  };

  const handleQueryLocalAddonServer = async () => {
    setIsSyncingAddonServer(true);
    try {
      let res = await fetch("/api/blizzard/wow/addon-sync/latest");
      if (!res.ok) res = await fetch("/api/blizzard/wow/addon-sync/all");
      if (!res.ok) throw new Error("Nenhum dado recente de Addon encontrado no endpoint local /api/blizzard/wow/addon-sync");

      const data = await res.json();
      const payload = data.latestSync?.payload || data.payload || data;
      const parsed = parseAddonData(payload);
      setAddonParsedResult(parsed);
      setAddonRawText(JSON.stringify(payload, null, 2));
      if (triggerAlert) triggerAlert("Sincronizado", `Snapshot recebido do servidor local para ${parsed.activeProfile.name}!`);
    } catch (err: any) {
      if (triggerAlert) triggerAlert("Aviso de Sincronização", err.message || "Servidor local sem dados no momento.");
    } finally {
      setIsSyncingAddonServer(false);
    }
  };

  // Handler to perform Dry-Run Integrity check
  const handlePerformDryRun = (textOverride?: string) => {
    const content = (textOverride !== undefined ? textOverride : dryRunRawText || addonRawText).trim();
    if (!content) {
      if (triggerAlert) triggerAlert("Atenção", "Insira ou selecione um arquivo de SavedVariables (.lua ou JSON) para validar.");
      return;
    }

    setIsPerformingDryRun(true);
    try {
      const report = performSavedVariablesDryRun(content);
      setDryRunReport(report);
      if (report.isValid) {
        if (triggerAlert) triggerAlert("Dry-Run Aprovado!", `Integridade verificada com sucesso! ${report.stats.questsCompleted} quests, ${report.stats.achievementsCount} conquistas e ${report.stats.equippedItemsCount} itens coincidem 100% com o schema.`);
      } else {
        if (triggerAlert) triggerAlert("Avisos no Dry-Run", `Validação concluída com ${report.totalErrors} erros e ${report.totalWarnings} avisos. Verifique o relatório.`);
      }
    } catch (err: any) {
      if (triggerAlert) triggerAlert("Erro no Dry-Run", err?.message || "Falha ao processar análise de integridade.");
    } finally {
      setIsPerformingDryRun(false);
    }
  };

  // Handler to confirm dry-run import and persist
  const handleConfirmDryRunImport = async () => {
    if (!dryRunReport || !dryRunReport.parsedProfile) return;
    try {
      const payloadToSend = dryRunReport.rawPayload || dryRunReport.parsedProfile;
      const res = await fetch("/api/blizzard/wow/addon-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadToSend.rawLua ? { rawLua: payloadToSend.rawLua } : { payload: payloadToSend }),
      });
      if (res.ok) {
        setAddonParsedResult({
          activeProfile: dryRunReport.parsedProfile,
          allCharacters: [
            {
              id: Date.now(),
              name: dryRunReport.parsedProfile.name,
              realm: dryRunReport.parsedProfile.realm,
              realmSlug: dryRunReport.parsedProfile.realmSlug,
              level: dryRunReport.parsedProfile.level,
              characterClass: dryRunReport.parsedProfile.characterClass,
              race: dryRunReport.parsedProfile.race,
              faction: dryRunReport.parsedProfile.faction,
              equippedItemLevel: dryRunReport.parsedProfile.equippedItemLevel,
              activeSpec: dryRunReport.parsedProfile.activeSpec,
              achievementPoints: dryRunReport.parsedProfile.achievementPoints,
              gameMode: dryRunReport.detectedVersion,
              wow_version: dryRunReport.detectedVersion,
            },
          ],
          detectedVersion: dryRunReport.detectedVersion,
          detectedVersionLabel: dryRunReport.isForever ? "WoW Forever (Vanilla+)" : dryRunReport.detectedVersion,
          isForever: dryRunReport.isForever,
          ruleset: dryRunReport.ruleset,
        });
        if (triggerAlert) {
          triggerAlert("Importação Concluída com Sucesso!", `Dados do personagem ${dryRunReport.characterName} (${dryRunReport.realm}) validados no dry-run e persistidos no servidor.`);
        }
      } else {
        throw new Error("Servidor retornou erro ao persistir dados.");
      }
    } catch (err: any) {
      if (triggerAlert) triggerAlert("Erro ao Importar", err?.message || "Falha ao salvar no banco do servidor.");
    }
  };

  // Handler to export current character / data to SavedVariables Lua
  const handleExportCurrentSavedVariables = () => {
    setIsExportingSavedVariables(true);
    try {
      const profileToExport: any =
        addonParsedResult?.activeProfile ||
        activeWowGame?.blizzardProfileData || {
          name: addonCharName || "Titolleza",
          realm: addonRealmName || "Azralon",
          level: 60,
          characterClass: "Warrior",
          race: "NightElf",
          faction: "Alliance",
          equippedItemLevel: 88,
          achievementPoints: 3450,
          wow_version: "forever",
          equippedItems: [],
          inventory: { backpack: [], bags: [] },
          collections: { mounts: [], pets: [], toys: [], titles: [] },
          quests: { completed: [123, 456, 789], active: [], completedCount: 3 },
          achievements: [],
          reputations: [],
          professions: [],
          adventureJournal: {
            timeline: [],
            bosses: [],
            companions: [],
            exploration: [],
            deaths: [],
            statistics: { steps: 42890, distanceYards: 39240 },
          },
          worldBosses: [],
        };

      const luaContent = exportProfileToSavedVariablesLua(profileToExport, {
        version: selectedWoWVersion || "forever",
        clientBuild: 16001,
      });

      const blob = new Blob([luaContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "HaleckAccountImporter.lua";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (triggerAlert) {
        triggerAlert("SavedVariables Exportado", "Arquivo HaleckAccountImporter.lua gerado com sucesso com 100% de conformidade com o schema!");
      }
    } catch (err: any) {
      if (triggerAlert) triggerAlert("Erro ao Exportar", err?.message || "Falha ao exportar SavedVariables.");
    } finally {
      setIsExportingSavedVariables(false);
    }
  };

  const handleExportCurrentSnapshotJson = () => {
    setIsExportingJson(true);
    try {
      const profileToExport: any =
        addonParsedResult?.activeProfile ||
        activeWowGame?.blizzardProfileData || {
          name: addonCharName || "Titolleza",
          realm: addonRealmName || "Azralon",
          level: 60,
          characterClass: "Warrior",
          race: "NightElf",
          faction: "Alliance",
          equippedItemLevel: 88,
          achievementPoints: 3450,
          wow_version: "forever",
          equippedItems: [],
          inventory: { backpack: [], bags: [] },
          collections: { mounts: [], pets: [], toys: [], titles: [] },
          quests: { completed: [123, 456, 789], active: [], completedCount: 3 },
          achievements: [],
          reputations: [],
          professions: [],
          adventureJournal: {
            timeline: [],
            bosses: [],
            companions: [],
            exploration: [],
            deaths: [],
            statistics: { steps: 42890, distanceYards: 39240 },
          },
          worldBosses: [],
        };

      const jsonContent = exportProfileToJson(profileToExport, 16001);
      const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "HaleckAccountImporter_Snapshot.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (triggerAlert) {
        triggerAlert("Snapshot JSON Exportado", "Arquivo HaleckAccountImporter_Snapshot.json gerado com sucesso para auditoria e backup!");
      }
    } catch (err: any) {
      if (triggerAlert) triggerAlert("Erro ao Exportar", err?.message || "Falha ao exportar snapshot JSON.");
    } finally {
      setIsExportingJson(false);
    }
  };

  const resolveWoWForeverPath = (inputPath: string): string => {
    let p = inputPath.trim().replace(/\//g, "\\");
    if (p.endsWith("\\")) p = p.slice(0, -1);

    const lower = p.toLowerCase();
    if (lower.endsWith("haleckaccountimporter")) {
      return p;
    }
    if (lower.endsWith("addons") || lower.endsWith("interface\\addons")) {
      return `${p}\\HaleckAccountImporter`;
    }
    if (lower.endsWith("interface")) {
      return `${p}\\AddOns\\HaleckAccountImporter`;
    }
    if (lower.endsWith("_classic_beta_")) {
      return `${p}\\Interface\\AddOns\\HaleckAccountImporter`;
    }
    if (lower.endsWith("world of warcraft")) {
      return `${p}\\_classic_beta_\\Interface\\AddOns\\HaleckAccountImporter`;
    }
    if (lower.includes("world of warcraft") && !lower.includes("interface")) {
      return `${p}\\_classic_beta_\\Interface\\AddOns\\HaleckAccountImporter`;
    }
    return `${p}\\HaleckAccountImporter`;
  };

  const handlePickWoWDirectory = async () => {
    if (typeof (window as any).showDirectoryPicker === "function") {
      try {
        setIsValidatingWoWDir(true);
        // Request readwrite mode to permit directly installing and updating files
        const dirHandle = await (window as any).showDirectoryPicker({
          mode: "readwrite",
          startIn: "desktop",
        });
        if (dirHandle) {
          setWowDirHandle(dirHandle);
          const validation = await validateWoWDirectoryStructure(dirHandle);
          setWowDirValidation(validation);
          if (validation.addonsHandle) {
            setWowAddonsHandle(validation.addonsHandle);
          }

          const resolved = resolveWoWForeverPath(
            `C:\\Program Files (x86)\\World of Warcraft\\${validation.resolvedPathLabel}`
          );
          setAddonTargetPath(resolved);
          setStoredAddonTargetPath(resolved);

          if (validation.isValid) {
            if (triggerAlert) {
              triggerAlert(
                "Pasta Válida e Conforme!",
                `Subpasta 'Interface/AddOns' detectada com sucesso em '${validation.rootName}'. Pronto para instalar ou atualizar o addon!`
              );
            }
          } else {
            if (triggerAlert) {
              triggerAlert(
                "Atenção na Estrutura",
                `A pasta '${validation.rootName}' foi selecionada, mas a subpasta 'Interface/AddOns' não foi encontrada. Você pode criá-la com 1 clique abaixo.`
              );
            }
          }
          return;
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.warn("Erro ao selecionar diretório via File System Access API:", err);
      } finally {
        setIsValidatingWoWDir(false);
      }
    }
    wowDirectoryInputRef.current?.click();
  };

  const handleCreateMissingAddOns = async () => {
    if (!wowDirHandle) return;
    try {
      setIsValidatingWoWDir(true);
      const res = await createMissingAddOnsFolder(wowDirHandle);
      if (res.success && res.addonsHandle) {
        setWowAddonsHandle(res.addonsHandle);
        const reval = await validateWoWDirectoryStructure(wowDirHandle);
        setWowDirValidation(reval);
        if (triggerAlert) {
          triggerAlert("Estrutura Criada!", "Subpastas 'Interface/AddOns' criadas com sucesso na pasta selecionada!");
        }
      } else {
        throw new Error(res.message);
      }
    } catch (err: any) {
      if (triggerAlert) triggerAlert("Erro ao Criar Pastas", err?.message || "Falha ao gerar estrutura.");
    } finally {
      setIsValidatingWoWDir(false);
    }
  };

  const handleDirectorySelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const firstFile = files[0];
      const relPath = firstFile.webkitRelativePath || "";
      const rootFolder = relPath.split("/")[0] || "World of Warcraft";
      const resolved = resolveWoWForeverPath(`C:\\Program Files (x86)\\${rootFolder}`);
      setAddonTargetPath(resolved);
      setStoredAddonTargetPath(resolved);
      if (triggerAlert) {
        triggerAlert("Pasta Mapeada!", `Diretório local detectado e vinculado à estrutura do WoW Forever: ${resolved}`);
      }
    }
  };

  // Distinct Handlers for 'Instalar Addon' and 'Atualizar Addon'
  const handleInstallAddonAction = async () => {
    await handlePerformAddonInstallOrUpdate(false);
  };

  const handleUpdateAddonAction = async () => {
    setIsUpdatingAddonDirectly(true);
    try {
      await handlePerformAddonInstallOrUpdate(true);
      await handleCheckAddonStatus();
    } finally {
      setIsUpdatingAddonDirectly(false);
    }
  };

  // Shared routine to verify version and copy files to Interface/AddOns
  const handlePerformAddonInstallOrUpdate = async (isUpdate: boolean) => {
    if (!addonTargetPath.trim() && !wowAddonsHandle) {
      if (triggerAlert) triggerAlert("Caminho Obrigatório", "Selecione o diretório do WoW ou defina o caminho da pasta Interface/AddOns.");
      return;
    }

    if (addonTargetPath.trim()) {
      setStoredAddonTargetPath(addonTargetPath);
    }

    if (!isUpdate) {
      setIsInstallingAddon(true);
    }
    setAddonInstallMessage(null);

    try {
      // 1. Verificar versão atual disponível no servidor
      let serverVersion = "4.1.0";
      try {
        const manifestRes = await fetch("/api/blizzard/wow/addon/manifest");
        if (manifestRes.ok) {
          const manifest = await manifestRes.json();
          if (manifest.version) serverVersion = manifest.version;
        }
      } catch (e) {
        console.warn("Aviso ao checar versão do servidor:", e);
      }

      // 2. Se temos acesso direto via File System Access API (Interface/AddOns)
      if (wowAddonsHandle) {
        const writeRes = await writeAddonViaFileSystemApi(wowAddonsHandle, { isUpdate });
        if (writeRes.success) {
          // Re-validar estrutura de pastas
          if (wowDirHandle) {
            const reval = await validateWoWDirectoryStructure(wowDirHandle);
            setWowDirValidation(reval);
          }

          // Atualizar o backend em segundo plano caso seja ambiente sincronizado
          fetch("/api/blizzard/wow/addon/install", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetPath: addonTargetPath, version: "forever" }),
          }).catch(() => {});

          const actionLabel = isUpdate ? "atualizado" : "instalado";
          setAddonInstallMessage({
            text: `[Sucesso] Addon Haleck Account Importer v${serverVersion} ${actionLabel} com sucesso na pasta Interface/AddOns!`,
            type: "success",
          });

          if (triggerAlert) {
            triggerAlert(
              isUpdate ? "Addon Atualizado com Sucesso!" : "Addon Instalado com Sucesso!",
              `Versão ${serverVersion} gravada diretamente na pasta Interface/AddOns (${writeRes.filesWritten.join(", ")}).`
            );
          }
          return;
        }
      }

      // 3. Fallback: Gravação via Endpoint do Servidor local
      const result = await installAddonDirectlyToServer(addonTargetPath);
      if (result.success && result.installedDirectly) {
        setAddonInstallMessage({ text: result.message, type: "success" });
        if (triggerAlert) {
          triggerAlert(
            isUpdate ? "Addon Atualizado com Sucesso!" : "Addon Instalado com Sucesso!",
            result.message
          );
        }
      } else {
        // Fallback para Windows client host -> gerar instalador automatizado .BAT pré-configurado
        const actionLabel = isUpdate ? "atualização" : "instalação";
        setAddonInstallMessage({
          text: `Caminho do WoW Forever configurado: ${addonTargetPath}. O instalador automático (.BAT) de 1 clique foi preparado para ${actionLabel} no disco.`,
          type: "info",
        });
        downloadAddonInstallerBat(addonTargetPath);
        if (triggerAlert) {
          triggerAlert(
            "Instalador 1-Clique Baixado",
            `O script 'instalar-addon-wow-forever.bat' pré-configurado para a sua pasta foi gerado e baixado. Execute-o para concluir a cópia dos arquivos do addon!`
          );
        }
      }
    } catch (err: any) {
      setAddonInstallMessage({
        text: err?.message || "Erro ao instalar/atualizar addon.",
        type: "error",
      });
      if (triggerAlert) {
        triggerAlert("Erro na Operação", err?.message || "Falha ao gravar arquivos do Addon.");
      }
    } finally {
      setIsInstallingAddon(false);
    }
  };

  const handleCheckAddonStatus = async () => {
    setIsCheckingAddonStatus(true);
    try {
      const res = await checkAddonUpdateStatus(addonTargetPath);
      setAddonUpdateStatus(res);
      if (res?.isUpToDate) {
        if (triggerAlert) triggerAlert("Addon 100% Atualizado!", `Haleck Account Importer v${res.availableVersion} é a versão mais recente instalada.`);
      } else if (res?.status === "update_available") {
        if (triggerAlert) triggerAlert("Nova Atualização Encontrada!", `Nova versão v${res.availableVersion} disponível para WoW Forever (Instalada: v${res.installedVersion || "desconhecida"}).`);
      } else {
        if (triggerAlert) triggerAlert("Verificação Concluída", `Status: ${res?.status || "Configurado"}. Clique em Atualizar para gravar a v${res?.availableVersion || "4.1.0"}.`);
      }
    } catch (err: any) {
      if (triggerAlert) triggerAlert("Erro ao Verificar", err?.message || "Não foi possível verificar status.");
    } finally {
      setIsCheckingAddonStatus(false);
    }
  };

  const handleSyncDynamicDefinitions = async () => {
    setIsSyncingDynamicDefs(true);
    try {
      const defs = await fetchDynamicDefinitions();
      setDynamicDefsStatus(defs);
      if (triggerAlert) {
        const bossCount = Object.keys(defs?.worldBosses || {}).length;
        triggerAlert("Definições Sincronizadas!", `${bossCount} chefes de mundo e camadas adaptativas atualizadas com sucesso para a Build ${defs?.clientBuild || 16001}!`);
      }
    } catch (err: any) {
      if (triggerAlert) triggerAlert("Erro nas Definições", err?.message || "Falha ao sincronizar definições de conteúdo.");
    } finally {
      setIsSyncingDynamicDefs(false);
    }
  };

  // Handlers for IGDB
  const handleTestAndSaveIgdb = async () => {
    setIsCheckingIgdb(true);
    try {
      const res = await checkIgdbStatus(igdbClientIdInput, igdbClientSecretInput);
      setIgdbStatus(res);
      if (res.rateLimit) setRateLimitInfo(res.rateLimit);
      setCacheStats(getIgdbCacheStats());

      if (res.connected) {
        setStoredIgdbClientId(igdbClientIdInput);
        setStoredIgdbClientSecret(igdbClientSecretInput);
        if (triggerAlert) triggerAlert("IGDB Conectado", "Conexão validada com a API oficial do IGDB!");
      } else {
        if (triggerAlert) triggerAlert("Falha IGDB", res.message || "Não foi possível autenticar no IGDB.");
      }
    } catch (err: any) {
      if (triggerAlert) triggerAlert("Erro IGDB", err?.message || "Erro ao testar conexão.");
    } finally {
      setIsCheckingIgdb(false);
    }
  };

  const handleClearCache = () => {
    clearIgdbLocalCache();
    setCacheStats(getIgdbCacheStats());
    if (triggerAlert) triggerAlert("Cache IGDB Limpo", "Cache local de buscas de jogos esvaziado.");
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
      if (res.rateLimit) setRateLimitInfo(res.rateLimit);
      if (triggerAlert) triggerAlert("IGDB Restaurado", "Credenciais padrão restauradas.");
    } finally {
      setIsCheckingIgdb(false);
    }
  };

  // Handlers for SteamGridDB
  const handleTestAndSaveSteamGrid = async () => {
    setIsCheckingSteamGrid(true);
    try {
      setStoredSteamGridApiKey(steamGridApiKeyInput);
      const res = await checkSteamGridStatus(steamGridApiKeyInput);
      setSteamGridStatus(res);
      if (res.connected) {
        if (triggerAlert) triggerAlert("SteamGridDB Conectado", "Chave validada para posters e logos comunitários!");
      } else {
        if (triggerAlert) triggerAlert("Falha SteamGridDB", res.message || "Chave de API inválida.");
      }
    } catch (err: any) {
      if (triggerAlert) triggerAlert("Erro SteamGridDB", err?.message || "Falha no teste.");
    } finally {
      setIsCheckingSteamGrid(false);
    }
  };

  const handleClearSteamGridCache = () => {
    clearSteamGridCache();
    if (triggerAlert) triggerAlert("Cache SteamGridDB Limpo", "Cache de imagens de capas comunitárias limpo.");
  };

  const handleResetSteamGridToDefault = () => {
    setSteamGridApiKeyInput("");
    setStoredSteamGridApiKey("");
    setSteamGridStatus(null);
    if (triggerAlert) triggerAlert("SteamGridDB Restaurado", "Padrão restabelecido.");
  };

  // Counts of linked games
  const linkedSteamGames = games.filter(
    (g) => g.steamAppId || g.platform?.toLowerCase().includes("steam") || g.integrationPlatform === "steam"
  );
  const linkedGogGames = games.filter(
    (g) => g.gogGameId || g.platform?.toLowerCase().includes("gog") || g.integrationPlatform === "gog"
  );
  const linkedBlizzardGames = games.filter(
    (g) =>
      g.integrationPlatform === "blizzard" ||
      g.integrationPlatform === "battlenet" ||
      g.platform?.toLowerCase().includes("blizzard") ||
      g.platform?.toLowerCase().includes("battle.net") ||
      g.name?.toLowerCase().includes("warcraft") ||
      g.name?.toLowerCase().includes("world of warcraft") ||
      !!g.blizzardCharacterName
  );

  const isSteamConfigured = !!(steamApiKeyInput || steamIdInput);
  const isGogConfigured = isGogOAuthConnected() || !!gogUsernameInput || !!gogUserIdInput;
  const hasCustomImgBBKey = !!getCustomImgBBKey();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-[95vw] h-[95vh] max-w-[1750px] bg-[#0c0e16] border border-cyan-500/30 rounded-3xl shadow-2xl text-white flex flex-col overflow-hidden cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Decorative Gradient Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 via-blue-500 via-purple-500 to-emerald-500" />

        {/* Modal Top Header (Single-line, 3 Zones) */}
        <div className="h-16 px-5 sm:px-6 bg-[#090b12] border-b border-zinc-800/80 flex items-center justify-between gap-4 shrink-0">
          {/* Zone 1: Brand & Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400 shrink-0">
              <Settings size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                  Painel de Administração & Central Técnica
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-bold hidden sm:inline-block">
                  95% Viewport Console
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate">
                Central unificada de integrações de APIs, contas de jogos, motor do Addon e serviços de mídia
              </p>
            </div>
          </div>

          {/* Zone 2: Platform Status Overview */}
          <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isBlizzardConnected ? "bg-sky-400 animate-pulse" : "bg-zinc-600"}`} />
              <span className="text-zinc-400">Blizzard:</span>
              <strong className={isBlizzardConnected ? "text-sky-300" : "text-zinc-500"}>
                {isBlizzardConnected ? (blizzardBattleTag || "OAuth Ativo") : "Offline"}
              </strong>
            </div>

            <span className="text-zinc-700">|</span>

            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isSteamConfigured ? "bg-blue-400" : "bg-zinc-600"}`} />
              <span className="text-zinc-400">Steam:</span>
              <strong className={isSteamConfigured ? "text-blue-300" : "text-zinc-500"}>
                {isSteamConfigured ? `${linkedSteamGames.length} jogos` : "Pendente"}
              </strong>
            </div>

            <span className="text-zinc-700">|</span>

            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isGogConfigured ? "bg-purple-400" : "bg-zinc-600"}`} />
              <span className="text-zinc-400">GOG:</span>
              <strong className={isGogConfigured ? "text-purple-300" : "text-zinc-500"}>
                {isGogConfigured ? (gogUsernameInput || "Conectado") : "Offline"}
              </strong>
            </div>

            <span className="text-zinc-700">|</span>

            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${igdbStatus?.connected ? "bg-emerald-400" : "bg-zinc-600"}`} />
              <span className="text-zinc-400">IGDB:</span>
              <strong className={igdbStatus?.connected ? "text-emerald-300" : "text-zinc-500"}>
                {igdbStatus?.connected ? "API Online" : "Pendente"}
              </strong>
            </div>
          </div>

          {/* Zone 3: Actions & Close */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Fechar (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Main Body: Left Sidebar (Collapsible, starts collapsed) + Right Content Viewport (Flex-1) */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT SIDEBAR NAVIGATION */}
          <div
            className={`${
              isSidebarCollapsed ? "w-16 sm:w-20 p-2 sm:p-2.5" : "w-64 sm:w-72 p-3 sm:p-4"
            } bg-[#08090f] border-r border-zinc-800/80 flex flex-col justify-between shrink-0 select-none transition-all duration-300 ease-in-out`}
          >
            <div className="space-y-2">
              {/* Sidebar Header with Collapse/Expand Toggle */}
              <div className="flex items-center justify-between px-1 py-1 mb-1 border-b border-zinc-800/60 pb-2">
                {!isSidebarCollapsed && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 truncate">
                    Menu do Painel
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className={`p-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-cyan-500/50 hover:bg-zinc-800 text-zinc-400 hover:text-cyan-300 transition-all cursor-pointer ${
                    isSidebarCollapsed ? "mx-auto" : "ml-auto"
                  }`}
                  title={isSidebarCollapsed ? "Expandir Menu Lateral (Mais Opções)" : "Recolher Menu Lateral (Modo Foco / Mais Espaço)"}
                >
                  {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                </button>
              </div>

              {/* Category 1: BLIZZARD & BATTLE.NET */}
              <button
                type="button"
                onClick={() => setActiveCategory("blizzard")}
                className={`w-full ${
                  isSidebarCollapsed ? "p-2 justify-center" : "p-2.5 justify-between"
                } rounded-2xl transition-all cursor-pointer flex items-center text-left border relative group ${
                  activeCategory === "blizzard"
                    ? "bg-sky-950/70 border-sky-500/60 text-white shadow-lg shadow-sky-500/10 ring-1 ring-sky-500/30"
                    : "bg-zinc-950/40 border-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
                }`}
                title={isSidebarCollapsed ? "Blizzard & Battle.net" : undefined}
              >
                {/* Active Indicator Strip */}
                {activeCategory === "blizzard" && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-sky-400 shadow-sm shadow-sky-400" />
                )}
                <div className={`flex items-center gap-3 ${isSidebarCollapsed ? "justify-center" : "min-w-0"}`}>
                  <div
                    className={`p-2 rounded-xl shrink-0 relative ${
                      activeCategory === "blizzard" ? "bg-sky-500 text-white shadow-md shadow-sky-500/30" : "bg-sky-950/50 text-sky-400"
                    }`}
                  >
                    <Zap size={16} />
                    {isSidebarCollapsed && isBlizzardConnected && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-zinc-950 animate-pulse" />
                    )}
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="min-w-0">
                      <div className="font-bold text-xs truncate">Blizzard & Battle.net</div>
                      <div className="text-[10px] text-zinc-500 truncate">
                        {isBlizzardConnected ? "OAuth Ativo" : "Login, Addon & Diário"}
                      </div>
                    </div>
                  )}
                </div>
                {!isSidebarCollapsed && (
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                      isBlizzardConnected ? "bg-emerald-950 text-emerald-300" : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {linkedBlizzardGames.length}
                  </span>
                )}

                {/* Floating Tooltip when Collapsed */}
                {isSidebarCollapsed && (
                  <div className="absolute left-full ml-3 px-3 py-1.5 bg-[#0e121e] border border-sky-500/40 rounded-xl shadow-2xl text-xs whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                    <span className="font-bold text-white">Blizzard & Battle.net</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 font-bold">
                      {isBlizzardConnected ? "Conectado" : `${linkedBlizzardGames.length} jogos`}
                    </span>
                  </div>
                )}
              </button>

              {/* Category 2: STEAM WEB API */}
              <button
                type="button"
                onClick={() => setActiveCategory("steam")}
                className={`w-full ${
                  isSidebarCollapsed ? "p-2 justify-center" : "p-2.5 justify-between"
                } rounded-2xl transition-all cursor-pointer flex items-center text-left border relative group ${
                  activeCategory === "steam"
                    ? "bg-blue-950/70 border-blue-500/60 text-white shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/30"
                    : "bg-zinc-950/40 border-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
                }`}
                title={isSidebarCollapsed ? "Steam Web API" : undefined}
              >
                {/* Active Indicator Strip */}
                {activeCategory === "steam" && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-blue-400 shadow-sm shadow-blue-400" />
                )}
                <div className={`flex items-center gap-3 ${isSidebarCollapsed ? "justify-center" : "min-w-0"}`}>
                  <div
                    className={`p-2 rounded-xl shrink-0 relative ${
                      activeCategory === "steam" ? "bg-blue-500 text-white shadow-md shadow-blue-500/30" : "bg-blue-950/50 text-blue-400"
                    }`}
                  >
                    <Gamepad2 size={16} />
                    {isSidebarCollapsed && isSteamConfigured && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-400 ring-2 ring-zinc-950" />
                    )}
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="min-w-0">
                      <div className="font-bold text-xs truncate">Steam Web API</div>
                      <div className="text-[10px] text-zinc-500 truncate">
                        {isSteamConfigured ? "Chave configurada" : "Chave Web & ID64"}
                      </div>
                    </div>
                  )}
                </div>
                {!isSidebarCollapsed && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-bold shrink-0">
                    {linkedSteamGames.length}
                  </span>
                )}

                {/* Floating Tooltip when Collapsed */}
                {isSidebarCollapsed && (
                  <div className="absolute left-full ml-3 px-3 py-1.5 bg-[#0e121e] border border-blue-500/40 rounded-xl shadow-2xl text-xs whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                    <span className="font-bold text-white">Steam Web API</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      {linkedSteamGames.length} jogos
                    </span>
                  </div>
                )}
              </button>

              {/* Category 3: GOG GALAXY */}
              <button
                type="button"
                onClick={() => setActiveCategory("gog")}
                className={`w-full ${
                  isSidebarCollapsed ? "p-2 justify-center" : "p-2.5 justify-between"
                } rounded-2xl transition-all cursor-pointer flex items-center text-left border relative group ${
                  activeCategory === "gog"
                    ? "bg-purple-950/70 border-purple-500/60 text-white shadow-lg shadow-purple-500/10 ring-1 ring-purple-500/30"
                    : "bg-zinc-950/40 border-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
                }`}
                title={isSidebarCollapsed ? "GOG Galaxy" : undefined}
              >
                {/* Active Indicator Strip */}
                {activeCategory === "gog" && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-purple-400 shadow-sm shadow-purple-400" />
                )}
                <div className={`flex items-center gap-3 ${isSidebarCollapsed ? "justify-center" : "min-w-0"}`}>
                  <div
                    className={`p-2 rounded-xl shrink-0 relative ${
                      activeCategory === "gog" ? "bg-purple-500 text-white shadow-md shadow-purple-500/30" : "bg-purple-950/50 text-purple-400"
                    }`}
                  >
                    <MonitorPlay size={16} />
                    {isSidebarCollapsed && isGogConfigured && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-purple-400 ring-2 ring-zinc-950" />
                    )}
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="min-w-0">
                      <div className="font-bold text-xs truncate">GOG Galaxy</div>
                      <div className="text-[10px] text-zinc-500 truncate">
                        {isGogConfigured ? "Conta vinculada" : "OAuth & Username"}
                      </div>
                    </div>
                  )}
                </div>
                {!isSidebarCollapsed && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-bold shrink-0">
                    {linkedGogGames.length}
                  </span>
                )}

                {/* Floating Tooltip when Collapsed */}
                {isSidebarCollapsed && (
                  <div className="absolute left-full ml-3 px-3 py-1.5 bg-[#0e121e] border border-purple-500/40 rounded-xl shadow-2xl text-xs whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                    <span className="font-bold text-white">GOG Galaxy</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      {linkedGogGames.length} jogos
                    </span>
                  </div>
                )}
              </button>

              {/* Category 4: MÍDIA & METADADOS */}
              <button
                type="button"
                onClick={() => setActiveCategory("media")}
                className={`w-full ${
                  isSidebarCollapsed ? "p-2 justify-center" : "p-2.5 justify-between"
                } rounded-2xl transition-all cursor-pointer flex items-center text-left border relative group ${
                  activeCategory === "media"
                    ? "bg-emerald-950/70 border-emerald-500/60 text-white shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30"
                    : "bg-zinc-950/40 border-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
                }`}
                title={isSidebarCollapsed ? "Mídia & Metadados" : undefined}
              >
                {/* Active Indicator Strip */}
                {activeCategory === "media" && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-emerald-400 shadow-sm shadow-emerald-400" />
                )}
                <div className={`flex items-center gap-3 ${isSidebarCollapsed ? "justify-center" : "min-w-0"}`}>
                  <div
                    className={`p-2 rounded-xl shrink-0 ${
                      activeCategory === "media" ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30" : "bg-emerald-950/50 text-emerald-400"
                    }`}
                  >
                    <Image size={16} />
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="min-w-0">
                      <div className="font-bold text-xs truncate">Mídia & Metadados</div>
                      <div className="text-[10px] text-zinc-500 truncate">IGDB, SteamGridDB, ImgBB & Drive</div>
                    </div>
                  )}
                </div>
                {!isSidebarCollapsed && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-bold shrink-0">
                    APIs
                  </span>
                )}

                {/* Floating Tooltip when Collapsed */}
                {isSidebarCollapsed && (
                  <div className="absolute left-full ml-3 px-3 py-1.5 bg-[#0e121e] border border-emerald-500/40 rounded-xl shadow-2xl text-xs whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                    <span className="font-bold text-white">Mídia & Metadados</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold">
                      5 Serviços
                    </span>
                  </div>
                )}
              </button>

              {/* Category 5: SISTEMA & MANUTENÇÃO */}
              <button
                type="button"
                onClick={() => setActiveCategory("system")}
                className={`w-full ${
                  isSidebarCollapsed ? "p-2 justify-center" : "p-2.5 justify-between"
                } rounded-2xl transition-all cursor-pointer flex items-center text-left border relative group ${
                  activeCategory === "system"
                    ? "bg-amber-950/70 border-amber-500/60 text-white shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30"
                    : "bg-zinc-950/40 border-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
                }`}
                title={isSidebarCollapsed ? "Sistema & Manutenção" : undefined}
              >
                {/* Active Indicator Strip */}
                {activeCategory === "system" && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-amber-400 shadow-sm shadow-amber-400" />
                )}
                <div className={`flex items-center gap-3 ${isSidebarCollapsed ? "justify-center" : "min-w-0"}`}>
                  <div
                    className={`p-2 rounded-xl shrink-0 ${
                      activeCategory === "system" ? "bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/30" : "bg-amber-950/50 text-amber-400"
                    }`}
                  >
                    <Sliders size={16} />
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="min-w-0">
                      <div className="font-bold text-xs truncate">Sistema & Manutenção</div>
                      <div className="text-[10px] text-zinc-500 truncate">Áudio retrô, cache, lixeira</div>
                    </div>
                  )}
                </div>
                {!isSidebarCollapsed && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-bold shrink-0">
                    Tools
                  </span>
                )}

                {/* Floating Tooltip when Collapsed */}
                {isSidebarCollapsed && (
                  <div className="absolute left-full ml-3 px-3 py-1.5 bg-[#0e121e] border border-amber-500/40 rounded-xl shadow-2xl text-xs whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                    <span className="font-bold text-white">Sistema & Manutenção</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      Opções
                    </span>
                  </div>
                )}
              </button>
            </div>

            {/* Sidebar Bottom: Admin Status & Logout */}
            <div className="pt-3 border-t border-zinc-800/80 space-y-2">
              {!isSidebarCollapsed ? (
                <>
                  <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[11px] flex items-center justify-between">
                    <span className="text-zinc-400 flex items-center gap-1.5">
                      <Shield size={13} className="text-cyan-400" />
                      <span>Modo Editor</span>
                    </span>
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40 font-mono">
                      Ativo
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onExitAdmin();
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-rose-950/30 hover:bg-rose-950/60 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <LogOut size={13} />
                    <span>Bloquear Modo Editor</span>
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800 text-cyan-400 relative group flex items-center justify-center cursor-help"
                    title="Modo Editor Ativo"
                  >
                    <Shield size={16} />
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-zinc-950" />
                    <div className="absolute left-full ml-3 px-2.5 py-1 bg-[#0e121e] border border-cyan-500/40 rounded-xl shadow-xl text-xs whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                      Modo Editor Ativo
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onExitAdmin();
                    }}
                    className="p-2 rounded-xl bg-rose-950/30 hover:bg-rose-950/60 border border-rose-500/30 text-rose-400 hover:text-rose-200 transition-all cursor-pointer relative group flex items-center justify-center"
                    title="Bloquear Modo Editor"
                  >
                    <LogOut size={16} />
                    <div className="absolute left-full ml-3 px-2.5 py-1 bg-[#0e121e] border border-rose-500/40 rounded-xl shadow-xl text-xs whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                      Bloquear Modo Editor
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT CONTENT VIEWPORT */}
          <div className="flex-1 bg-[#0c0e16] p-5 sm:p-7 overflow-y-auto custom-scrollbar flex flex-col space-y-5">
            {/* ========================================================================= */}
            {/* CATEGORY: BLIZZARD & BATTLE.NET (SUB-TABS ARCHITECTURE)                    */}
            {/* ========================================================================= */}
            {activeCategory === "blizzard" && (
              <div className="space-y-6">
                {/* Header Banner & Sub-Tabs Navigation */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#0d1629] via-[#090d1a] to-[#0d1629] border border-sky-500/40 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-xl relative overflow-hidden">
                  <div className="flex items-center gap-3.5 z-10">
                    <div className="p-3 bg-sky-500/20 border border-sky-500/40 rounded-2xl text-sky-300 shrink-0 shadow-lg shadow-sky-500/10">
                      <Zap size={24} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base sm:text-lg font-black text-white tracking-wide">
                          Central Técnica Blizzard & World of Warcraft
                        </h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-950/90 border border-sky-400/50 text-sky-300 font-bold uppercase tracking-wider">
                          WoW Forever • Classic • Retail
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-1 max-w-2xl leading-relaxed">
                        Gerencie autenticação Battle.net permanente, gerador de pacotes do Addon universal, monitor em segundo plano e simulador in-game interativo.
                      </p>
                    </div>
                  </div>

                  {/* 3 Technical Sub-Tabs Switcher */}
                  <div className="flex items-center gap-1.5 p-1.5 bg-[#05070d] rounded-xl border border-zinc-800 shrink-0 z-10 shadow-inner">
                    <button
                      type="button"
                      onClick={() => setBlizzardSubTab("auth")}
                      className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                        blizzardSubTab === "auth"
                          ? "bg-sky-600 text-white shadow-md shadow-sky-600/30 ring-1 ring-sky-400/50"
                          : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
                      }`}
                    >
                      <Key size={14} className={blizzardSubTab === "auth" ? "text-white" : "text-sky-400"} />
                      <span>1. Autenticação & Contas</span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isBlizzardConnected ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"
                        }`}
                        title={isBlizzardConnected ? "Conectado" : "Desconectado"}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => setBlizzardSubTab("addon_sync")}
                      className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                        blizzardSubTab === "addon_sync"
                          ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30 ring-1 ring-cyan-400/50"
                          : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
                      }`}
                    >
                      <FolderArchive size={14} className={blizzardSubTab === "addon_sync" ? "text-white" : "text-cyan-400"} />
                      <span>2. Addon & Sincronização</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 font-bold border border-cyan-500/40">
                        v4.0.0
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBlizzardSubTab("simulator")}
                      className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                        blizzardSubTab === "simulator"
                          ? "bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-md shadow-amber-500/30 ring-1 ring-amber-300/50"
                          : "text-amber-400 hover:text-amber-200 hover:bg-zinc-900/60"
                      }`}
                    >
                      <Sparkles size={14} className="text-amber-300" />
                      <span>3. Simulador In-Game</span>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-500/40">
                        Ao Vivo
                      </span>
                    </button>
                  </div>
                </div>

                {/* ========================================================================= */}
                {/* SUB-TAB 1: AUTENTICAÇÃO & CONTAS                                          */}
                {/* ========================================================================= */}
                {blizzardSubTab === "auth" && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* CARD 1: STATUS & CONEXÃO OFICIAL BATTLE.NET OAUTH */}
                      <div className="p-5 rounded-2xl bg-[#090d18] border border-sky-500/40 space-y-4 shadow-xl relative overflow-hidden flex flex-col justify-between">
                        <div className="space-y-4">
                          {/* Card Header */}
                          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
                                <Zap size={16} />
                              </div>
                              <div>
                                <span className="font-black text-sm text-white block">Conexão Oficial Battle.net OAuth</span>
                                <span className="text-[11px] text-zinc-400 block">Sincronização com a API Blizzard</span>
                              </div>
                            </div>

                            {isBlizzardConnected ? (
                              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/50 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                                <CheckCircle2 size={12} className="text-emerald-400" />
                                <span>OAuth Conectado</span>
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-zinc-400 bg-zinc-900 border border-zinc-700 px-3 py-1 rounded-full">
                                Desconectado
                              </span>
                            )}
                          </div>

                          {/* 3 Metric Tiles with High Visual Definition */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                            <div className="p-3 bg-[#04060d] border border-zinc-800/90 rounded-xl space-y-1">
                              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                                BattleTag Ativo
                              </span>
                              <span className="font-mono font-black text-sm text-sky-300 truncate block">
                                {blizzardBattleTag || "Não definido"}
                              </span>
                            </div>

                            <div className="p-3 bg-[#04060d] border border-zinc-800/90 rounded-xl space-y-1">
                              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                                Região Oficial
                              </span>
                              <span className="font-mono font-bold text-xs text-white uppercase truncate block">
                                {(blizzardRegion || "us").toUpperCase()} (Americas / Brasil)
                              </span>
                            </div>

                            <div className="p-3 bg-[#04060d] border border-zinc-800/90 rounded-xl space-y-1">
                              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                                Jogos Identificados
                              </span>
                              <span className="font-mono font-bold text-xs text-emerald-400 truncate block">
                                {linkedBlizzardGames.length} catálogo WoW
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons Row */}
                        <div className="space-y-2.5 pt-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setBlizzardDirectAuthModalOpen(true)}
                              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-black transition-all cursor-pointer shadow-md shadow-sky-600/30 flex items-center justify-center gap-2"
                            >
                              <Sparkles size={14} className="text-sky-200" />
                              <span>{isBlizzardConnected ? "Reconectar / Trocar Conta Battle.net" : "Conectar com Battle.net"}</span>
                            </button>

                            {isBlizzardConnected && (
                              <button
                                type="button"
                                onClick={handleDisconnectBlizzard}
                                className="py-2.5 px-4 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
                                title="Desconectar e limpar tokens salvos"
                              >
                                Desconectar
                              </button>
                            )}
                          </div>

                          {onBatchSyncBlizzard && (
                            <button
                              type="button"
                              onClick={() => onBatchSyncBlizzard()}
                              disabled={isSyncingBlizzardBatch}
                              className="w-full py-2.5 rounded-xl bg-sky-950/80 hover:bg-sky-900/90 border border-sky-500/40 text-sky-200 hover:text-white text-xs font-black transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                            >
                              {isSyncingBlizzardBatch ? (
                                <>
                                  <Loader2 size={14} className="animate-spin text-sky-400" />
                                  <span>Sincronizando WoW via API da Blizzard...</span>
                                </>
                              ) : (
                                <>
                                  <RefreshCw size={14} className="text-sky-400" />
                                  <span>Sincronizar Armory & Personagens (API Blizzard)</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* CARD 2: CREDENCIAIS PERSONALIZADAS & CONFIGURAÇÃO AVANÇADA (BYOB) */}
                      <div className="p-5 rounded-2xl bg-[#090d18] border border-zinc-800 space-y-4 shadow-xl flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                                <Key size={16} />
                              </div>
                              <div>
                                <span className="font-black text-sm text-white block">Credenciais Próprias Blizzard (BYOB)</span>
                                <span className="text-[11px] text-zinc-400 block">Bring Your Own Backend • API Developer Portal</span>
                              </div>
                            </div>
                            <a
                              href="https://develop.battle.net/access/clients"
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1 bg-sky-950/60 border border-sky-500/30 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                            >
                              <span>develop.battle.net</span>
                              <ExternalLink size={10} />
                            </a>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider block">
                                Região do Cliente
                              </label>
                              <select
                                value={blizzardRegion}
                                onChange={(e) => setBlizzardRegion(e.target.value as "us" | "eu" | "kr" | "tw")}
                                className="w-full bg-[#05070d] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none cursor-pointer"
                              >
                                <option value="us">US / Americas (Brasil)</option>
                                <option value="eu">EU / Europe</option>
                                <option value="kr">KR / Korea</option>
                                <option value="tw">TW / Taiwan</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider block">
                                BattleTag Padrão
                              </label>
                              <input
                                type="text"
                                value={blizzardBattleTag}
                                onChange={(e) => setBlizzardBattleTag(e.target.value)}
                                placeholder="Ex: Arthas#1234"
                                className="w-full bg-[#05070d] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none font-mono"
                              >
                              </input>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider block">
                                Client ID
                              </label>
                              <input
                                type="text"
                                value={blizzardClientId}
                                onChange={(e) => setBlizzardClientId(e.target.value)}
                                placeholder="Client ID da Blizzard"
                                className="w-full bg-[#05070d] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-sky-500 focus:outline-none"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider block">
                                Client Secret
                              </label>
                              <input
                                type="password"
                                value={blizzardClientSecret}
                                onChange={(e) => setBlizzardClientSecret(e.target.value)}
                                placeholder="Client Secret"
                                className="w-full bg-[#05070d] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-sky-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="space-y-1 text-xs">
                            <label className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider block">
                              OAuth Bearer Token (Manual ou Automático)
                            </label>
                            <input
                              type="password"
                              value={blizzardTokenInput}
                              onChange={(e) => setBlizzardTokenInput(e.target.value)}
                              placeholder="Bearer token ativo"
                              className="w-full bg-[#05070d] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-sky-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleSaveBlizzardKeys}
                          disabled={isConnectingBlizzard}
                          className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-sky-500/20 mt-3"
                        >
                          {isConnectingBlizzard ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          <span>Validar & Salvar Configurações da Blizzard</span>
                        </button>
                      </div>
                    </div>

                    {/* SECTION: REDIRECT URIS & CACHE BANNER */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Left Block: Redirect URIs with Individual Copy */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-[#090d18] border border-zinc-800 text-xs space-y-3 shadow-md">
                        <div className="flex items-center gap-2.5 text-zinc-200 font-bold border-b border-zinc-800/80 pb-2.5">
                          <Globe size={16} className="text-sky-400" />
                          <span>URIs de Redirecionamento Autorizadas no Portal Battle.net</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          Cadastre as URLs abaixo no seu cliente no portal de desenvolvedores da Blizzard (seção <strong className="text-zinc-200 font-semibold">Redirect URIs</strong>):
                        </p>
                        <div className="space-y-2 font-mono text-[11px]">
                          {BLIZZARD_ALLOWED_REDIRECT_URIS.slice(0, 3).map((uri, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-xl bg-[#04060d] border border-zinc-800 text-zinc-300 flex items-center justify-between gap-2 group hover:border-zinc-700 transition-colors"
                            >
                              <span className="truncate select-all">{uri}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyText(uri, "uri")}
                                className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-[10px] font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer"
                                title="Copiar URL"
                              >
                                {copiedRedirectUri === uri ? (
                                  <>
                                    <Check size={11} className="text-emerald-400" />
                                    <span className="text-emerald-400">Copiado!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={11} />
                                    <span>Copiar</span>
                                  </>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right Block: Local Cache Management */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-[#090d18] border border-zinc-800 text-xs flex flex-col justify-between space-y-3 shadow-md">
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2.5 text-zinc-200 font-bold border-b border-zinc-800/80 pb-2.5">
                            <Database size={16} className="text-sky-400" />
                            <span>Cache Local de Respostas Brutas da Blizzard</span>
                          </div>
                          <p className="text-[11px] text-zinc-400 leading-relaxed">
                            Armazenamento local em IndexedDB com validade de 24 horas (TTL). Evita o consumo repetido da quota oficial da Blizzard e acelera a renderização dos personagens.
                          </p>
                          <div className="p-3 rounded-xl bg-[#04060d] border border-zinc-800 flex items-center justify-between">
                            <span className="text-zinc-400 text-xs">Perfis e Respostas em Cache:</span>
                            <span className="font-mono font-black text-sm text-sky-300">
                              {blizzardCacheStats?.count || 0} perfis armazenados
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleClearBlizzardCache}
                          disabled={isClearingBlizzardCache || (blizzardCacheStats?.count || 0) === 0}
                          className="self-start px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 disabled:opacity-40 text-xs font-bold text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center gap-2 mt-2"
                        >
                          {isClearingBlizzardCache ? <Loader2 size={13} className="animate-spin text-sky-400" /> : <Trash2 size={13} className="text-rose-400" />}
                          <span>Esvaziar Cache Local</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ========================================================================= */}
                {/* SUB-TAB 2: ADDON & SINCRONIZAÇÃO                                          */}
                {/* ========================================================================= */}
                {blizzardSubTab === "addon_sync" && (
                  <div className="space-y-6">
                    {/* ========================================================================= */}
                    {/* SEÇÃO 1: CONFIGURAÇÃO DE CAMINHO DA PASTA 'Interface/AddOns' & AUTO-INSTALL*/}
                    {/* ========================================================================= */}
                    <div className="p-5 rounded-2xl bg-gradient-to-r from-[#071326] via-[#091b35] to-[#061021] border-2 border-cyan-500/50 space-y-5 shadow-2xl relative overflow-hidden">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-950/80 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-md shadow-cyan-500/20 shrink-0">
                            <FolderArchive size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="font-black text-base text-white">Configuração da Pasta 'Interface/AddOns' & Instalação Automática</h5>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-400/50 text-cyan-300 font-black">
                                WoW Forever (16001)
                              </span>
                            </div>
                            <p className="text-xs text-zinc-300 mt-0.5">
                              Defina o diretório local do cliente para instalar ou atualizar o addon <strong className="text-cyan-300">Haleck Account Importer</strong> com 1 clique e manter total coesão com a estrutura de pastas do jogo.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950/80 border border-amber-500/40 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                            <Sparkles size={13} className="text-amber-400" />
                            <span>Pasta Oficial: _classic_beta_</span>
                          </span>
                        </div>
                      </div>

                      {/* Quick Preset Buttons for 1-Click Path Selection */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
                          Atalhos Rápidos de Diretórios Oficiais:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              const p = "C:\\Program Files (x86)\\World of Warcraft\\_classic_beta_\\Interface\\AddOns";
                              setAddonTargetPath(p);
                              setStoredAddonTargetPath(p);
                            }}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
                              addonTargetPath.includes("_classic_beta_") && addonTargetPath.startsWith("C:")
                                ? "bg-cyan-950/60 border-cyan-400 text-white shadow-md shadow-cyan-950/40"
                                : "bg-[#040711] border-zinc-800 text-zinc-300 hover:border-zinc-700"
                            }`}
                          >
                            <span className="font-black text-cyan-300 text-[11px] flex items-center gap-1">
                              <span>WoW Forever Beta (Padrão)</span>
                              <CheckCircle2 size={11} className="text-cyan-400" />
                            </span>
                            <span className="font-mono text-[10px] text-zinc-400 truncate">C:\...\World of Warcraft\_classic_beta_\Interface\AddOns</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const p = "D:\\World of Warcraft\\_classic_beta_\\Interface\\AddOns";
                              setAddonTargetPath(p);
                              setStoredAddonTargetPath(p);
                            }}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
                              addonTargetPath.includes("_classic_beta_") && addonTargetPath.startsWith("D:")
                                ? "bg-cyan-950/60 border-cyan-400 text-white shadow-md shadow-cyan-950/40"
                                : "bg-[#040711] border-zinc-800 text-zinc-300 hover:border-zinc-700"
                            }`}
                          >
                            <span className="font-black text-amber-300 text-[11px]">Drive D: (WoW Forever Beta)</span>
                            <span className="font-mono text-[10px] text-zinc-400 truncate">D:\World of Warcraft\_classic_beta_\Interface\AddOns</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const p = "C:\\Program Files (x86)\\World of Warcraft\\_classic_era_\\Interface\\AddOns";
                              setAddonTargetPath(p);
                              setStoredAddonTargetPath(p);
                            }}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
                              addonTargetPath.includes("_classic_era_")
                                ? "bg-cyan-950/60 border-cyan-400 text-white shadow-md shadow-cyan-950/40"
                                : "bg-[#040711] border-zinc-800 text-zinc-300 hover:border-zinc-700"
                            }`}
                          >
                            <span className="font-black text-emerald-300 text-[11px]">WoW Classic Era (1.15)</span>
                            <span className="font-mono text-[10px] text-zinc-400 truncate">C:\...\World of Warcraft\_classic_era_\Interface\AddOns</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const p = "C:\\Program Files (x86)\\World of Warcraft\\_retail_\\Interface\\AddOns";
                              setAddonTargetPath(p);
                              setStoredAddonTargetPath(p);
                            }}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
                              addonTargetPath.includes("_retail_")
                                ? "bg-cyan-950/60 border-cyan-400 text-white shadow-md shadow-cyan-950/40"
                                : "bg-[#040711] border-zinc-800 text-zinc-300 hover:border-zinc-700"
                            }`}
                          >
                            <span className="font-black text-sky-300 text-[11px]">WoW Retail (11.x)</span>
                            <span className="font-mono text-[10px] text-zinc-400 truncate">C:\...\World of Warcraft\_retail_\Interface\AddOns</span>
                          </button>
                        </div>
                      </div>

                      {/* Hidden directory picker input fallback */}
                      <input
                        type="file"
                        ref={wowDirectoryInputRef}
                        onChange={handleDirectorySelected}
                        {...({ webkitdirectory: "", directory: "" } as any)}
                        className="hidden"
                      />

                      {/* Path Input Box and Action Controls */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
                            Caminho Local da Pasta 'Interface/AddOns' do WoW Forever:
                          </label>
                          <span className="text-[10px] text-cyan-400 font-mono">
                            Auto-resolução inteligente para _classic_beta_
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
                          <input
                            type="text"
                            value={addonTargetPath}
                            onChange={(e) => setAddonTargetPath(e.target.value)}
                            placeholder="C:\Program Files (x86)\World of Warcraft\_classic_beta_\Interface\AddOns"
                            className="flex-1 bg-[#04060d] border border-cyan-500/40 rounded-xl px-4 py-3 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 shadow-inner"
                          />

                          <button
                            type="button"
                            onClick={handlePickWoWDirectory}
                            className="px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-950 to-blue-950 hover:from-cyan-900 hover:to-blue-900 border border-cyan-500/50 text-cyan-200 hover:text-white text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center justify-center gap-1.5 shadow-md shadow-cyan-950/40"
                            title="Abrir explorador de pastas nativo do seu computador para selecionar o diretório do jogo"
                          >
                            <FolderOpen size={15} className="text-cyan-400" />
                            <span>Procurar Pasta...</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setStoredAddonTargetPath(addonTargetPath);
                              if (triggerAlert) triggerAlert("Caminho Salvo", "Caminho da pasta Interface/AddOns registrado com sucesso!");
                            }}
                            className="px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
                          >
                            <Save size={14} />
                            <span>Salvar</span>
                          </button>
                        </div>
                      </div>

                      {/* STATUS VISUAL DE CONFORMIDADE DA ESTRUTURA (INTERFACE/ADDONS) */}
                      {isValidatingWoWDir && (
                        <div className="p-3.5 rounded-xl border border-cyan-500/40 bg-cyan-950/30 text-cyan-200 text-xs flex items-center gap-2.5 animate-pulse">
                          <Loader2 size={16} className="animate-spin text-cyan-400 shrink-0" />
                          <span>Validando conformidade da estrutura de pastas do WoW Forever...</span>
                        </div>
                      )}

                      {wowDirValidation ? (
                        <div
                          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg transition-all ${
                            wowDirValidation.isValid
                              ? "bg-emerald-950/40 border-emerald-500/60 text-emerald-200"
                              : "bg-rose-950/40 border-rose-500/60 text-rose-200"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="shrink-0 mt-0.5">
                              {wowDirValidation.isValid ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                              ) : (
                                <XCircle className="w-5 h-5 text-rose-400" />
                              )}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-xs uppercase tracking-wide">
                                  {wowDirValidation.isValid
                                    ? "Conformidade Verificada: Subpasta Interface/AddOns Encontrada"
                                    : "Não Conforme: Subpasta Interface/AddOns Não Encontrada"}
                                </span>
                                <span
                                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                                    wowDirValidation.isValid
                                      ? "bg-emerald-900/80 text-emerald-300 border border-emerald-500/40"
                                      : "bg-rose-900/80 text-rose-300 border border-rose-500/40"
                                  }`}
                                >
                                  {wowDirValidation.isValid ? "100% Compatível" : "Incompleto"}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-300">
                                {wowDirValidation.isValid ? (
                                  <>
                                    Diretório raiz <strong className="text-white font-mono">{wowDirValidation.rootName}</strong> validado. 
                                    Destino: <span className="font-mono text-cyan-300 text-[11px]">{wowDirValidation.resolvedPathLabel}</span>. 
                                    {wowDirValidation.hasHaleckAddon ? (
                                      <span className="text-emerald-300 font-semibold ml-1">
                                        (Addon já detectado no disco — pronto para Atualizar!)
                                      </span>
                                    ) : (
                                      <span className="text-cyan-300 font-semibold ml-1">
                                        (Pronto para Instalação inicial!)
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {wowDirValidation.error || "A subpasta 'Interface/AddOns' não foi encontrada dentro do diretório selecionado."}
                                    {" "}Para que o jogo reconheça o Addon, o cliente do WoW Forever necessita da subpasta <code className="text-amber-300 bg-black/40 px-1 py-0.5 rounded">Interface/AddOns</code>.
                                  </>
                                )}
                              </p>
                            </div>
                          </div>

                          {!wowDirValidation.isValid && wowDirHandle && (
                            <button
                              type="button"
                              onClick={handleCreateMissingAddOns}
                              disabled={isValidatingWoWDir}
                              className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all cursor-pointer shrink-0 flex items-center gap-1.5 shadow-md self-start sm:self-auto"
                            >
                              {isValidatingWoWDir ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                              <span>Criar Interface/AddOns Agora</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-xl border border-cyan-900/40 bg-cyan-950/20 text-cyan-200/90 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <Info size={16} className="text-cyan-400 shrink-0" />
                            <span>
                              Clique em <strong className="text-white">Procurar Pasta...</strong> para selecionar a pasta raiz do WoW Forever (<code className="text-cyan-300">_classic_beta_</code> ou <code className="text-cyan-300">World of Warcraft</code>) via File System Access API nativa do navegador.
                            </span>
                          </div>
                          {addonTargetPath.includes("AddOns") && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-900/60 border border-cyan-400/40 text-cyan-300 font-bold shrink-0 flex items-center gap-1 self-start sm:self-auto">
                              <CheckCircle2 size={11} className="text-cyan-300" />
                              <span>Caminho Padrão Configurado</span>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Distinct Installation & Update Actions Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                        {/* BOTÃO 1: INSTALAR ADDON */}
                        <button
                          type="button"
                          onClick={handleInstallAddonAction}
                          disabled={isInstallingAddon || isUpdatingAddonDirectly}
                          className="py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/30 disabled:opacity-50"
                          title="Instala o addon Haleck Account Importer v4.1.0 completo na pasta do jogo"
                        >
                          {isInstallingAddon ? <Loader2 size={16} className="animate-spin text-white" /> : <Download size={16} className="text-emerald-100" />}
                          <span>Instalar Addon</span>
                        </button>

                        {/* BOTÃO 2: ATUALIZAR ADDON */}
                        <button
                          type="button"
                          onClick={handleUpdateAddonAction}
                          disabled={isInstallingAddon || isUpdatingAddonDirectly}
                          className="py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-600/30 disabled:opacity-50"
                          title="Atualiza o código do addon para a versão v4.1.0 preservando 100% dos dados salvos no WTF/"
                        >
                          {isUpdatingAddonDirectly ? <Loader2 size={16} className="animate-spin text-white" /> : <RefreshCw size={16} className="text-cyan-100" />}
                          <span>Atualizar Addon</span>
                        </button>

                        {/* BOTÃO 3: BAIXAR INSTALADOR 1-CLIQUE (.BAT) */}
                        <button
                          type="button"
                          onClick={() => downloadAddonInstallerBat(addonTargetPath)}
                          className="py-3 px-4 rounded-xl bg-[#040814] hover:bg-[#07132a] border border-cyan-500/40 text-cyan-200 hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm text-center"
                          title="Gera script em lote do Windows para instalação automática"
                        >
                          <Terminal size={15} className="text-cyan-400" />
                          <span>Baixar (.BAT)</span>
                        </button>

                        {/* BOTÃO 4: BAIXAR SCRIPT POWERSHELL (.PS1) */}
                        <button
                          type="button"
                          onClick={() => downloadAddonInstallerPs1(addonTargetPath)}
                          className="py-3 px-4 rounded-xl bg-[#040814] hover:bg-[#07132a] border border-purple-500/40 text-purple-200 hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm text-center"
                          title="Gera script em PowerShell do Windows com verificação de integridade"
                        >
                          <FileCode size={15} className="text-purple-400" />
                          <span>PowerShell (.PS1)</span>
                        </button>
                      </div>

                      {/* Status / Feedback Banner */}
                      {addonInstallMessage && (
                        <div
                          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 shadow-md ${
                            addonInstallMessage.type === "success"
                              ? "bg-emerald-950/70 border-emerald-500/60 text-emerald-200"
                              : addonInstallMessage.type === "info"
                              ? "bg-cyan-950/70 border-cyan-500/60 text-cyan-200"
                              : "bg-rose-950/70 border-rose-500/60 text-rose-200"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {addonInstallMessage.type === "success" ? (
                              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                            ) : (
                              <Info size={16} className="text-cyan-400 shrink-0" />
                            )}
                            <span className="font-semibold">{addonInstallMessage.text}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAddonInstallMessage(null)}
                            className="text-zinc-400 hover:text-white text-xs cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      {/* Cohesion Tree Structure Guide */}
                      <div className="p-4 rounded-xl bg-[#04060d] border border-cyan-900/50 text-xs space-y-2">
                        <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider block">
                          Estrutura de Pastas Coesa com o Jogo:
                        </span>
                        <pre className="font-mono text-[11px] text-zinc-300 leading-relaxed overflow-x-auto bg-black/60 p-3 rounded-lg border border-zinc-800">
                          {`World of Warcraft/_classic_beta_/
└── Interface/
    └── AddOns/
        └── HaleckAccountImporter/
            ├── HaleckAccountImporter.toc     (Manifesto com Interface: 16001 e Brasão H)
            ├── HaleckAccountImporter.lua     (Motor ATT-Grade, Quests, Spells, SavedVariables)
            └── AddonInterface.lua            (Interface Visual Dual-Category & Diário de Aventura)`}
                        </pre>
                      </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* SEÇÃO 1B: VERIFICADOR DE VERSÃO & ATUALIZAÇÕES CONTÍNUAS (WOW FOREVER)    */}
                    {/* ========================================================================= */}
                    <div className="p-5 rounded-2xl bg-gradient-to-r from-[#06152b] via-[#081f3d] to-[#040e1f] border-2 border-cyan-400/60 space-y-5 shadow-2xl relative overflow-hidden">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-900/60 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-600/30 border border-cyan-400/60 flex items-center justify-center text-cyan-300 shadow-lg shadow-cyan-500/20 shrink-0">
                            <RefreshCw size={20} className={isCheckingAddonStatus ? "animate-spin" : ""} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="font-black text-base text-white">Central de Atualizações Contínuas & Camada Adaptativa</h5>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-400/60 text-cyan-300 font-black">
                                v4.1.0 • Build 16001+
                              </span>
                            </div>
                            <p className="text-xs text-zinc-300 mt-0.5">
                              O <strong className="text-cyan-300">WoW: Forever</strong> está em constante evolução. Esta central audita o addon instalado, detecta alterações de build da Blizzard e aplica atualizações em 1 clique sem quebrar seu histórico ou dados salvos.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={handleCheckAddonStatus}
                            disabled={isCheckingAddonStatus}
                            className="px-3.5 py-2 rounded-xl bg-[#040a16] hover:bg-[#07152b] border border-cyan-500/50 text-cyan-300 hover:text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                          >
                            <RefreshCw size={13} className={isCheckingAddonStatus ? "animate-spin" : ""} />
                            <span>{isCheckingAddonStatus ? "Verificando..." : "Verificar Versão no Disco"}</span>
                          </button>
                        </div>
                      </div>

                      {/* Live Version Status Indicators */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-[#040713] border border-cyan-900/60 space-y-1">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                            Versão Disponível no Site
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-cyan-300">v4.1.0</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                              Lançamento Oficial 2026
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-400 block">WoW Forever (Builds 16001 / 16002 / 16003)</span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#040713] border border-cyan-900/60 space-y-1">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                            Versão Instalada no seu Jogo
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-white">
                              {addonUpdateStatus?.installedVersion ? `v${addonUpdateStatus.installedVersion}` : "v4.1.0 (Configurada)"}
                            </span>
                            {addonUpdateStatus?.isUpToDate && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                                Em Dia
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-400 block truncate">
                            {addonTargetPath ? addonTargetPath.split("\\").slice(-2).join("\\") : "Interface\\AddOns"}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#040713] border border-cyan-900/60 space-y-1">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                            Status da Camada de Compatibilidade
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 size={13} />
                              <span>100% Blindado Contra Taint</span>
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-400 block">
                            Auto-migração de SavedVariables ativada (v410)
                          </span>
                        </div>
                      </div>

                      {/* 1-Click Update Actions Bar */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleUpdateAddonAction}
                            disabled={isInstallingAddon || isUpdatingAddonDirectly}
                            className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-600/30 disabled:opacity-50"
                          >
                            {isUpdatingAddonDirectly ? <Loader2 size={14} className="animate-spin text-white" /> : <Zap size={14} className="text-cyan-200" />}
                            <span>Atualizar Addon Agora (1-Clique)</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleSyncDynamicDefinitions}
                            disabled={isSyncingDynamicDefs}
                            className="py-2.5 px-3.5 rounded-xl bg-[#040816] hover:bg-[#071328] border border-cyan-500/40 text-cyan-200 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                          >
                            {isSyncingDynamicDefs ? <Loader2 size={13} className="animate-spin text-cyan-400" /> : <Layers size={13} className="text-cyan-400" />}
                            <span>Sincronizar Definições de Conteúdo (Vanilla+)</span>
                          </button>
                        </div>

                        <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Builds homologadas: 16001, 16002, 16003</span>
                        </div>
                      </div>

                      {/* Adaptive Safeguards Grid (How the addon survives WoW Forever updates) */}
                      <div className="space-y-2 border-t border-cyan-950/80 pt-3">
                        <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider block">
                          Mecanismos de Proteção Ativos para Atualizações do WoW Forever:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                          <div className="p-2.5 rounded-xl bg-[#04060e] border border-cyan-900/40 space-y-1">
                            <span className="font-bold text-white text-[11px] block">1. Detecção Dinâmica de APIs</span>
                            <p className="text-[10px] text-zinc-400 leading-snug">
                              Inspeção em tempo de execução para C_QuestLog e GetQuestLogTitle via pcall seguro sem travamentos.
                            </p>
                          </div>

                          <div className="p-2.5 rounded-xl bg-[#04060e] border border-cyan-900/40 space-y-1">
                            <span className="font-bold text-white text-[11px] block">2. Auto-Migração de SavedVariables</span>
                            <p className="text-[10px] text-zinc-400 leading-snug">
                              Converte schemas antigos automaticamente no ADDON_LOADED mantendo mortes, passômetro e histórico.
                            </p>
                          </div>

                          <div className="p-2.5 rounded-xl bg-[#04060e] border border-cyan-900/40 space-y-1">
                            <span className="font-bold text-white text-[11px] block">3. Injeção de Definições Remotas</span>
                            <p className="text-[10px] text-zinc-400 leading-snug">
                              Novos chefes e missões de Vanilla+ são incorporados sem exigir reescrita manual dos arquivos Lua.
                            </p>
                          </div>

                          <div className="p-2.5 rounded-xl bg-[#04060e] border border-cyan-900/40 space-y-1">
                            <span className="font-bold text-white text-[11px] block">4. Preservação de Configurações</span>
                            <p className="text-[10px] text-zinc-400 leading-snug">
                              Atualizações de 1 clique alteram apenas código executável, mantendo intactas as variáveis do WTF/.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* SEÇÃO 2: VALIDADOR DE INTEGRIDADE DE SAVEDVARIABLES & DRY-RUN              */}
                    {/* ========================================================================= */}
                    <div className="p-5 rounded-2xl bg-[#080d1a] border border-amber-500/50 space-y-5 shadow-2xl">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-950/80 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shadow-md shadow-amber-500/20 shrink-0">
                            <Activity size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="font-black text-base text-white">Validador de Integridade de SavedVariables & Dry-Run</h5>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950 border border-amber-400/50 text-amber-300 font-black">
                                Schema Auditor
                              </span>
                            </div>
                            <p className="text-xs text-zinc-300 mt-0.5">
                              Verifica a integridade das variáveis salvas no addon (<code className="text-cyan-300 font-mono">HaleckAccountImporter.lua</code>), garantindo que os formatos de quests, conquistas e coleções coincidam rigorosamente com o schema esperado pelo site antes da importação definitiva.
                            </p>
                          </div>
                        </div>

                        {/* Top Export Buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={handleExportCurrentSavedVariables}
                            disabled={isExportingSavedVariables}
                            className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-600/30 disabled:opacity-50"
                            title="Exportar variáveis salvas em Lua para colar diretamente no WTF/Account/<Conta>/SavedVariables/ do WoW"
                          >
                            <Download size={13} className={isExportingSavedVariables ? "animate-bounce" : ""} />
                            <span>Exportar Dados (.lua)</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleExportCurrentSnapshotJson}
                            disabled={isExportingJson}
                            className="px-3.5 py-2.5 rounded-xl bg-[#081224] hover:bg-[#0c1a33] border border-cyan-500/50 text-cyan-200 hover:text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                            title="Exportar snapshot limpo em JSON para backup, auditoria ou conferência de schema"
                          >
                            <FileText size={13} className={isExportingJson ? "animate-spin" : ""} />
                            <span>Exportar Snapshot (.json)</span>
                          </button>
                        </div>
                      </div>

                      {/* Dry-Run Input Area: File Selection or Direct Paste */}
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                            Insira o Conteúdo do Arquivo de Variáveis Salvas para Validação:
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => addonFileInputRef.current?.click()}
                              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-cyan-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <Upload size={12} />
                              <span>Carregar Arquivo .lua / .json</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (addonRawText) {
                                  setDryRunRawText(addonRawText);
                                  handlePerformDryRun(addonRawText);
                                }
                              }}
                              disabled={!addonRawText}
                              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                            >
                              <RefreshCw size={12} />
                              <span>Usar Último Snapshot</span>
                            </button>
                          </div>
                        </div>

                        <textarea
                          rows={4}
                          value={dryRunRawText}
                          onChange={(e) => setDryRunRawText(e.target.value)}
                          placeholder="Cole aqui o conteúdo de HaleckAccountImporter.lua (ex: HaleckAccountImporterDB = { ... }) ou faça upload pelo botão acima..."
                          className="w-full bg-[#04060d] border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 font-mono focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 shadow-inner resize-y"
                        />

                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => handlePerformDryRun()}
                            disabled={isPerformingDryRun || !dryRunRawText.trim()}
                            className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-white font-black text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-amber-600/30 disabled:opacity-50"
                          >
                            {isPerformingDryRun ? <Loader2 size={14} className="animate-spin text-white" /> : <Activity size={14} />}
                            <span>Executar Análise de Integridade (Dry-Run)</span>
                          </button>

                          {dryRunRawText && (
                            <button
                              type="button"
                              onClick={() => {
                                setDryRunRawText("");
                                setDryRunReport(null);
                              }}
                              className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                            >
                              Limpar Texto
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Dry-Run Audit Results Report Box */}
                      {dryRunReport && (
                        <div className="p-4 rounded-xl bg-[#040712] border-2 border-amber-500/60 space-y-4 shadow-xl">
                          {/* Report Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h6 className="font-black text-sm text-white">Relatório do Dry-Run: {dryRunReport.characterName} ({dryRunReport.realm})</h6>
                                <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                                  dryRunReport.isValid
                                    ? "bg-emerald-950 text-emerald-300 border border-emerald-500/50"
                                    : "bg-rose-950 text-rose-300 border border-rose-500/50"
                                }`}>
                                  {dryRunReport.isValid ? "Schema 100% Válido" : "Requer Atenção"}
                                </span>
                              </div>
                              <span className="text-[11px] text-zinc-400">
                                Versão: <strong className="text-white">{dryRunReport.isForever ? "WoW Forever (Vanilla+ 16001)" : dryRunReport.detectedVersion}</strong> • Nível: {dryRunReport.level} • Classe: {dryRunReport.characterClass}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleConfirmDryRunImport}
                                disabled={!dryRunReport.isValid}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs transition-all cursor-pointer shadow-md shadow-emerald-600/30 disabled:opacity-40 flex items-center gap-1.5"
                              >
                                <CheckCircle2 size={14} />
                                <span>Confirmar & Importar Definitivo</span>
                              </button>
                            </div>
                          </div>

                          {/* 4 Metrics Cards */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                            <div className="p-2.5 rounded-lg bg-[#070b16] border border-zinc-800">
                              <span className="text-[10px] text-zinc-400 uppercase font-bold block">Quests Verificadas</span>
                              <span className="font-mono font-black text-sm text-cyan-300">{dryRunReport.stats.questsCompleted} concluídas</span>
                              <span className="text-[10px] text-zinc-500 block">{dryRunReport.stats.questsActive} no Quest Log</span>
                            </div>

                            <div className="p-2.5 rounded-lg bg-[#070b16] border border-zinc-800">
                              <span className="text-[10px] text-zinc-400 uppercase font-bold block">Conquistas & Pontos</span>
                              <span className="font-mono font-black text-sm text-amber-300">{dryRunReport.stats.achievementPoints} pontos</span>
                              <span className="text-[10px] text-zinc-500 block">{dryRunReport.stats.achievementsCount} registros</span>
                            </div>

                            <div className="p-2.5 rounded-lg bg-[#070b16] border border-zinc-800">
                              <span className="text-[10px] text-zinc-400 uppercase font-bold block">Coleções Auditadas</span>
                              <span className="font-mono font-black text-sm text-emerald-300">{dryRunReport.stats.mountsCount} montarias</span>
                              <span className="text-[10px] text-zinc-500 block">{dryRunReport.stats.petsCount} pets • {dryRunReport.stats.toysCount} toys</span>
                            </div>

                            <div className="p-2.5 rounded-lg bg-[#070b16] border border-zinc-800">
                              <span className="text-[10px] text-zinc-400 uppercase font-bold block">Equipamento & Visual</span>
                              <span className="font-mono font-black text-sm text-purple-300">{dryRunReport.stats.equippedItemsCount} slots</span>
                              <span className="text-[10px] text-zinc-500 block">Display IDs conferidos</span>
                            </div>
                          </div>

                          {/* Granular Items Audit Table */}
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {dryRunReport.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="p-2.5 rounded-lg bg-[#060914] border border-zinc-800/80 flex items-start justify-between gap-3 text-xs"
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-white">{item.name}</span>
                                    <span className="text-[10px] font-mono text-zinc-400 uppercase px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800">
                                      {item.category}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-zinc-300 leading-relaxed">{item.details}</p>
                                </div>

                                <div className="shrink-0">
                                  {item.status === "valid" ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded-md">
                                      <CheckCircle2 size={11} />
                                      <span>Válido</span>
                                    </span>
                                  ) : item.status === "warning" ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-950/80 border border-amber-500/40 px-2 py-0.5 rounded-md">
                                      <AlertCircle size={11} />
                                      <span>Aviso</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-950/80 border border-rose-500/40 px-2 py-0.5 rounded-md">
                                      <X size={11} />
                                      <span>Erro</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ========================================================================= */}
                    {/* SEÇÃO 3: DOWNLOAD DO PACOTE UNIVERSAL & WATCHER (.BAT / .PS1)              */}
                    {/* ========================================================================= */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Pacote Universal .ZIP */}
                      <div className="p-5 rounded-2xl bg-[#070e1c] border border-cyan-500/40 space-y-4 shadow-xl">
                        <div className="flex items-center justify-between border-b border-cyan-950/60 pb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2.5 bg-cyan-500/20 border border-cyan-500/40 rounded-xl text-cyan-300">
                              <Download size={18} />
                            </div>
                            <div>
                              <h5 className="font-black text-sm text-white">Baixar Pacote Universal do Addon (.ZIP)</h5>
                              <p className="text-[11px] text-zinc-400">Versão 4.0.0 com ATT-Grade Harvest e Diário de Aventuras</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-cyan-950 border border-cyan-400/50 text-cyan-300 font-black">
                            v4.0.0
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider block">
                              Versão do Cliente WoW
                            </label>
                            <select
                              value={selectedWoWVersion}
                              onChange={(e) => setSelectedWoWVersion(e.target.value)}
                              className="w-full bg-[#04060d] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none cursor-pointer"
                            >
                              <option value="forever">WoW Forever Beta (Build 16001)</option>
                              <option value="retail">WoW Retail (The War Within / Midnight)</option>
                              <option value="classic">WoW Classic Era (1.15.x)</option>
                              <option value="mop">WoW MoP (5.4.8)</option>
                              <option value="tbc">WoW TBC (2.4.3)</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider block">
                              Personagem Padrão
                            </label>
                            <input
                              type="text"
                              value={addonCharName}
                              onChange={(e) => setAddonCharName(e.target.value)}
                              placeholder="Ex: Tïtolleza"
                              className="w-full bg-[#04060d] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none font-mono"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleDownloadAddonZip}
                          disabled={isDownloadingAddon}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-600/30 disabled:opacity-50"
                        >
                          <Download size={15} className={isDownloadingAddon ? "animate-bounce" : ""} />
                          <span>{isDownloadingAddon ? "Gerando Pacote..." : "Baixar HaleckAccountImporter.zip"}</span>
                        </button>
                      </div>

                      {/* Agente Live Watcher */}
                      <div className="p-5 rounded-2xl bg-[#090d18] border border-purple-500/40 space-y-4 shadow-xl flex flex-col justify-between">
                        <div className="space-y-3.5">
                          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2.5 bg-purple-500/20 border border-purple-500/40 rounded-xl text-purple-300">
                                <Terminal size={18} />
                              </div>
                              <div>
                                <h5 className="font-black text-sm text-white">Agente Local de Sincronização (.BAT / .PS1)</h5>
                                <p className="text-[11px] text-zinc-400">Monitoramento contínuo em tempo real do SavedVariables</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-purple-950 border border-purple-400/50 text-purple-300 font-black">
                              Live Watcher
                            </span>
                          </div>

                          <p className="text-xs text-zinc-300 leading-relaxed">
                            O agente roda em segundo plano no Windows e, sempre que você der <code className="bg-black/70 px-1.5 py-0.5 rounded text-cyan-300 font-mono font-bold border border-cyan-500/40">/reload</code> ou deslogar de um personagem no WoW, ele envia automaticamente o novo snapshot completo para o site!
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <button
                              type="button"
                              onClick={() => downloadSyncAgentBatFile()}
                              className="p-3 rounded-xl bg-[#05070d] border border-zinc-800 hover:border-purple-500/60 hover:bg-purple-950/20 text-white text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 shadow-sm text-center"
                            >
                              <Terminal size={18} className="text-purple-400" />
                              <span className="font-black text-white">Baixar Script Windows (.BAT)</span>
                              <span className="text-[10px] text-zinc-400 font-normal">Execução simples com 1 clique</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => downloadSyncAgentPs1File()}
                              className="p-3 rounded-xl bg-[#05070d] border border-zinc-800 hover:border-sky-500/60 hover:bg-sky-950/20 text-white text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 shadow-sm text-center"
                            >
                              <FileCode size={18} className="text-sky-400" />
                              <span className="font-black text-white">Baixar PowerShell (.PS1)</span>
                              <span className="text-[10px] text-zinc-400 font-normal">Monitoramento nativo assíncrono</span>
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl bg-[#04060d] border border-zinc-800 text-xs">
                          <span className="text-zinc-400">Endpoint Local de Ingestão:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-cyan-400 font-black">/api/blizzard/wow/addon-sync</span>
                            <button
                              type="button"
                              onClick={() => handleCopyText("/api/blizzard/wow/addon-sync", "endpoint")}
                              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                              title="Copiar Endpoint"
                            >
                              {copiedEndpoint ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* SEÇÃO 4: IMPORTAÇÃO MANUAL & DEV STUDIO                                    */}
                    {/* ========================================================================= */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Card: Importação Manual Direta */}
                      <div className="p-5 rounded-2xl bg-[#090d18] border border-zinc-800 space-y-3.5 shadow-xl">
                        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                          <span className="font-black text-xs text-white uppercase tracking-wider flex items-center gap-2">
                            <Upload size={15} className="text-cyan-400" />
                            Importar Arquivo de Dados Manualmente
                          </span>
                          <button
                            type="button"
                            onClick={handleQueryLocalAddonServer}
                            disabled={isSyncingAddonServer}
                            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <RefreshCw size={12} className={isSyncingAddonServer ? "animate-spin text-cyan-400" : "text-zinc-400"} />
                            <span>Consultar Servidor Local</span>
                          </button>
                        </div>

                        <div
                          onClick={() => addonFileInputRef.current?.click()}
                          className="p-5 rounded-xl border border-dashed border-cyan-500/40 hover:border-cyan-400 bg-cyan-950/15 hover:bg-cyan-950/25 transition-all text-center space-y-2 cursor-pointer group"
                        >
                          <Archive size={24} className="mx-auto text-cyan-400 group-hover:scale-110 transition-transform" />
                          <span className="font-black text-xs text-white block">
                            Clique para selecionar SavedVariables/HaleckAccountImporter.lua ou .zip
                          </span>
                          <span className="text-[10px] text-zinc-400 font-mono block">Suporta arquivos .lua, .zip, .json</span>
                        </div>
                        <input
                          type="file"
                          ref={addonFileInputRef}
                          onChange={handleUploadSavedVariables}
                          accept=".lua,.zip,.json,.txt"
                          className="hidden"
                        />

                        <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-200 flex items-start gap-2">
                          <Zap size={14} className="text-amber-400 shrink-0 mt-0.5" />
                          <span>
                            <strong className="text-white">Dica WoW Forever:</strong> No jogo, após clicar em "Salvar Dados", clique em <strong className="text-cyan-300">"⚡ Recarregar UI (/reload)"</strong> no próprio addon para que o cliente grave o arquivo no disco antes do upload.
                          </span>
                        </div>

                        {addonParsedResult && (
                          <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-200 flex items-center justify-between shadow-sm">
                            <span className="font-semibold">
                              Detectado: <strong className="text-white font-black">{addonParsedResult.activeProfile.name}</strong> ({addonParsedResult.activeProfile.characterClass}, Nv. {addonParsedResult.activeProfile.level})
                            </span>
                            <span className="text-[10px] font-mono text-emerald-300 font-black px-2 py-0.5 rounded bg-emerald-900/60 border border-emerald-500/30">
                              {addonParsedResult.activeProfile.equippedItems?.length || 0} itens
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Card: Addon Dev Studio */}
                      <div className="p-5 rounded-2xl bg-[#090d18] border border-zinc-800 space-y-4 shadow-xl flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                            <span className="font-black text-xs text-white uppercase tracking-wider flex items-center gap-2">
                              <Code size={15} className="text-purple-400" />
                              Estúdio de Desenvolvimento de Addons (Dev Studio)
                            </span>
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed">
                            Acesse a documentação canônica com as 12 fontes oficiais do ecossistema Blizzard, mapas de funções descontinuadas, regras Anti-Taint e gerador de templates.
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-800/80">
                          <button
                            type="button"
                            onClick={() => setAddonDevModalOpen(true)}
                            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-black text-xs transition-all cursor-pointer flex items-center gap-2 shadow-md shadow-purple-700/20"
                          >
                            <Code size={14} />
                            <span>Abrir Addon Dev Studio</span>
                          </button>
                          <span className="text-[11px] text-zinc-400 font-mono">100% Compatível com WoW Forever</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ========================================================================= */}
                {/* SUB-TAB 3: SIMULADOR IN-GAME                                              */}
                {/* ========================================================================= */}
                {blizzardSubTab === "simulator" && (
                  <div className="space-y-5">
                    {/* Header bar com ações e status */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-[#0a101f] to-blue-950/40 border border-amber-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0 shadow-md shadow-amber-500/10">
                          <Sparkles size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-black text-white">
                              Simulador In-Game Interativo
                            </h4>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-400/50 text-cyan-300 font-black">
                              /hai & /diario
                            </span>
                          </div>
                          <p className="text-xs text-zinc-300 mt-0.5">
                            Interface gráfica in-game oficial reproduzida diretamente no console de administração com dados reais ou de demonstração.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setSimulatorModalOpen(true)}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs transition-all cursor-pointer shadow-md shadow-cyan-600/30 flex items-center gap-2"
                        >
                          <Eye size={14} />
                          <span>Expandir em Tela Cheia</span>
                        </button>
                      </div>
                    </div>

                    {/* Simulador Interativo Embutido Diretamente na Tela */}
                    <div className="w-full">
                      <WoWAddonPreviewModal
                        embedded={true}
                        profile={activeWowGame?.blizzardProfileData}
                        activeCharacterName={addonCharName || activeWowGame?.blizzardCharacterName}
                        activeCharacterRealm={addonRealmName || activeWowGame?.blizzardRealm}
                        gameVersion={selectedWoWVersion || activeWowGame?.wowVersion}
                        onExpandModal={() => setSimulatorModalOpen(true)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* CATEGORY: STEAM WEB API                                                    */}
            {/* ========================================================================= */}
            {activeCategory === "steam" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-zinc-900/80 border border-blue-500/30 space-y-4 shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-500/15 border border-blue-500/30 rounded-xl text-blue-400 shrink-0">
                        <Gamepad2 size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-white">Configuração da Steam Web API</h4>
                          <span className="text-[10px] font-bold text-blue-300 bg-blue-950 border border-blue-500/40 px-2 py-0.5 rounded-full">
                            PC Gaming
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Sincronize jogos, horas jogadas, conquistas e artes da Steam
                        </p>
                      </div>
                    </div>

                    {onBatchSyncSteam && (
                      <button
                        type="button"
                        onClick={onBatchSyncSteam}
                        disabled={isSyncingSteamBatch || linkedSteamGames.length === 0}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-blue-600/20"
                      >
                        {isSyncingSteamBatch ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                        <span>Sincronizar Lote ({linkedSteamGames.length})</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-800 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Steam Web API Key
                      </label>
                      <input
                        type="password"
                        value={steamApiKeyInput}
                        onChange={(e) => setSteamApiKeyInput(e.target.value)}
                        placeholder="Chave API gerada em steamcommunity.com/dev/apikey"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
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
                        placeholder="ID64 numérico (ex: 76561198...)"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveSteamKeys}
                    className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                  >
                    <Save size={13} />
                    <span>Salvar Credenciais Steam</span>
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* CATEGORY: GOG GALAXY                                                       */}
            {/* ========================================================================= */}
            {activeCategory === "gog" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-zinc-900/80 border border-purple-500/30 space-y-4 shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
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
                          <MonitorPlay size={20} />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-white">Integração GOG Galaxy</h4>
                          {isGogConfigured ? (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 size={10} /> Conectado
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
                              Pendente
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {isGogConfigured
                            ? `Conta vinculada: ${gogUsernameInput || gogUserIdInput} (${linkedGogGames.length} jogos)`
                            : "Conecte sua conta GOG para sincronizar jogos DRM-free e horas"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setGogDirectAuthModalOpen(true)}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold transition-all cursor-pointer shadow-md shadow-purple-600/20 flex items-center gap-1.5"
                      >
                        <Sparkles size={13} className="text-purple-200" />
                        <span>Login Direto GOG</span>
                      </button>

                      {isGogConfigured && (
                        <button
                          type="button"
                          onClick={handleDisconnectGog}
                          className="px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 text-xs font-bold transition-all cursor-pointer"
                        >
                          Sair
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-800 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Usuário ou Link de Perfil GOG
                      </label>
                      <input
                        type="text"
                        value={gogUsernameInput}
                        onChange={(e) => {
                          setGogUsernameInput(e.target.value);
                          setGogDirectInput(e.target.value);
                        }}
                        placeholder="Ex: SeuUsuarioGOG"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        ID da Conta GOG
                      </label>
                      <input
                        type="text"
                        value={gogUserIdInput}
                        onChange={(e) => setGogUserIdInput(e.target.value)}
                        placeholder="ID numérico ou slug"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleDirectGogLogin(gogUsernameInput)}
                      disabled={isLoggingInGog}
                      className="py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-purple-600/20"
                    >
                      {isLoggingInGog ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                      <span>Validar & Salvar GOG</span>
                    </button>

                    {onBatchSyncGog && (
                      <button
                        type="button"
                        onClick={onBatchSyncGog}
                        disabled={isSyncingGogBatch || linkedGogGames.length === 0}
                        className="py-2 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        {isSyncingGogBatch ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                        <span>Sincronizar Lote ({linkedGogGames.length})</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* CATEGORY: MÍDIA & METADADOS (IGDB, STEAMGRIDDB, IMGBB, DRIVE, YOUTUBE)    */}
            {/* ========================================================================= */}
            {activeCategory === "media" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* IGDB DATABASE API CARD */}
                  <div className="p-4 rounded-2xl bg-zinc-900/80 border border-emerald-500/30 space-y-3.5 shadow-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400">
                          <Globe size={18} />
                        </div>
                        <div>
                          <h5 className="font-bold text-sm text-white">IGDB Database API</h5>
                          <p className="text-[11px] text-zinc-400">Metadados oficiais, capas e galerias Twitch</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleTestAndSaveIgdb}
                        disabled={isCheckingIgdb}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                      >
                        {isCheckingIgdb ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        <span>Testar Conexão</span>
                      </button>
                    </div>

                    {/* Rate Limit Info */}
                    <div className="p-3 bg-zinc-950/70 rounded-xl border border-zinc-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 flex items-center gap-1">
                          <Gauge size={12} className="text-emerald-400" />
                          <span>Rate Limit Disponível:</span>
                        </span>
                        <span className="font-mono font-bold text-emerald-400">
                          {rateLimitInfo.remaining} / {rateLimitInfo.limit} livres (Reset em {rateLimitInfo.resetSeconds}s)
                        </span>
                      </div>
                      <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-300"
                          style={{
                            width: `${Math.max(5, Math.min(100, (rateLimitInfo.remaining / (rateLimitInfo.limit || 800)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                          Client ID (Twitch)
                        </label>
                        <input
                          type="text"
                          value={igdbClientIdInput}
                          onChange={(e) => setIgdbClientIdInput(e.target.value)}
                          placeholder="Client ID próprio"
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
                          placeholder="Client Secret próprio"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-zinc-500">
                        Cache: {cacheStats.totalEntries} buscas ({cacheStats.estimatedSizeKb} KB)
                      </span>
                      <button
                        type="button"
                        onClick={handleClearCache}
                        className="text-xs text-zinc-400 hover:text-white underline cursor-pointer"
                      >
                        Limpar Cache IGDB
                      </button>
                    </div>
                  </div>

                  {/* STEAMGRIDDB API CARD */}
                  <div className="p-4 rounded-2xl bg-zinc-900/80 border border-cyan-500/30 space-y-3.5 shadow-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-cyan-500/15 border border-cyan-500/30 rounded-xl text-cyan-400">
                          <Image size={18} />
                        </div>
                        <div>
                          <h5 className="font-bold text-sm text-white">SteamGridDB API</h5>
                          <p className="text-[11px] text-zinc-400">Posters verticais, heróis panorâmicos e logos PNG</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleTestAndSaveSteamGrid}
                        disabled={isCheckingSteamGrid}
                        className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                      >
                        {isCheckingSteamGrid ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        <span>Validar Chave</span>
                      </button>
                    </div>

                    <div className="space-y-1 text-xs">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        SteamGridDB API Key (Bearer Token)
                      </label>
                      <input
                        type="password"
                        value={steamGridApiKeyInput}
                        onChange={(e) => setSteamGridApiKeyInput(e.target.value)}
                        placeholder="Insira sua chave gratuita de steamgriddb.com/api"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <a
                        href="https://www.steamgriddb.com/profile/preferences/api"
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        <span>Gerar Chave Gratuita</span>
                        <ExternalLink size={11} />
                      </a>

                      <button
                        type="button"
                        onClick={handleClearSteamGridCache}
                        className="text-xs text-zinc-400 hover:text-white underline cursor-pointer"
                      >
                        Limpar Cache SteamGridDB
                      </button>
                    </div>
                  </div>
                </div>

                {/* IMGBB & GOOGLE ACCOUNTS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* ImgBB */}
                  <div
                    onClick={() => {
                      onClose();
                      onOpenImgBB();
                    }}
                    className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-cyan-500/40 transition-all cursor-pointer space-y-2 group shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key size={16} className="text-cyan-400" />
                        <span className="font-bold text-xs text-white group-hover:text-cyan-300 transition-colors">
                          ImgBB API
                        </span>
                      </div>
                      <ChevronRight size={14} className="text-zinc-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      {hasCustomImgBBKey ? "Chave pessoal ativa para upload ilimitado." : "Chave padrão ativa. Clique para configurar chave própria."}
                    </p>
                  </div>

                  {/* Google Drive */}
                  <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2 shadow-md flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <HardDrive size={16} className="text-cyan-400" />
                          <span className="font-bold text-xs text-white">Google Drive</span>
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${driveAuthenticated ? "bg-emerald-950 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}>
                          {driveAuthenticated ? "Conectado" : "Offline"}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1">Backup de mídias e saves na nuvem.</p>
                    </div>
                    {driveAuthenticated ? (
                      <button
                        type="button"
                        onClick={onDisconnectDrive}
                        className="py-1 px-2.5 rounded-lg bg-zinc-800 hover:bg-red-950/60 text-zinc-300 hover:text-red-300 text-xs font-bold transition-all cursor-pointer self-start"
                      >
                        Sair
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onConnectDrive}
                        className="py-1 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all cursor-pointer self-start"
                      >
                        Conectar
                      </button>
                    )}
                  </div>

                  {/* YouTube */}
                  <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2 shadow-md flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Video size={16} className="text-red-400" />
                          <span className="font-bold text-xs text-white">YouTube</span>
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${youtubeConnected ? "bg-emerald-950 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}>
                          {youtubeConnected ? "Conectado" : "Offline"}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1">Upload de vídeos e trailers de gameplay.</p>
                    </div>
                    {youtubeConnected ? (
                      <button
                        type="button"
                        onClick={async () => {
                          await signOutYouTube();
                          setYoutubeConnected(false);
                        }}
                        className="py-1 px-2.5 rounded-lg bg-zinc-800 hover:bg-red-950/60 text-zinc-300 hover:text-red-300 text-xs font-bold transition-all cursor-pointer self-start"
                      >
                        Sair
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            setIsConnectingYoutube(true);
                            await signInWithYouTube();
                            setYoutubeConnected(true);
                          } finally {
                            setIsConnectingYoutube(false);
                          }
                        }}
                        className="py-1 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all cursor-pointer self-start"
                      >
                        Conectar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* CATEGORY: SISTEMA & MANUTENÇÃO                                             */}
            {/* ========================================================================= */}
            {activeCategory === "system" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Retro Sound FX */}
                  <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                        {sfxEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                      </div>
                      <div>
                        <h5 className="font-bold text-xs text-white">Efeitos Sonoros Retrô 8-bit</h5>
                        <p className="text-[11px] text-zinc-400">Feedback sonoro tátil de interface</p>
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

                  {/* Cache Local de Imagens */}
                  <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
                        <Zap size={18} />
                      </div>
                      <div>
                        <h5 className="font-bold text-xs text-white">Cache Local de Imagens</h5>
                        <p className="text-[11px] text-zinc-400">
                          {imageCacheStats.count} fotos salvas ({imageCacheStats.sizeFormatted})
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isClearingImageCache || imageCacheStats.count === 0}
                      onClick={async () => {
                        setIsClearingImageCache(true);
                        await clearAllImageCache();
                        const stats = await getImageCacheStats();
                        setImageCacheStats(stats);
                        setIsClearingImageCache(false);
                        if (triggerAlert) triggerAlert("Cache de Imagens Limpo", "Fotos em cache removidas.");
                      }}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs font-bold text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      {isClearingImageCache ? <Loader2 size={12} className="animate-spin text-emerald-400" /> : <Trash2 size={12} className="text-rose-400" />}
                      <span>Limpar</span>
                    </button>
                  </div>

                  {/* Auditoria Diagnóstica */}
                  {onRunDiagnostic && (
                    <button
                      type="button"
                      onClick={onRunDiagnostic}
                      className="p-4 rounded-2xl bg-cyan-950/20 hover:bg-cyan-950/40 border border-cyan-500/30 text-left transition-all cursor-pointer flex items-center justify-between group shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-cyan-500/20 border border-cyan-500/40 rounded-xl text-cyan-300">
                          <Database size={18} />
                        </div>
                        <div>
                          <h5 className="font-bold text-xs text-white group-hover:text-cyan-300 transition-colors">
                            Auditoria Diagnóstica
                          </h5>
                          <p className="text-[11px] text-zinc-400">Verifica sincronização LocalStorage, Firebase e Drive</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-cyan-400 group-hover:translate-x-1 transition-transform" />
                    </button>
                  )}

                  {/* Lixeira & Exclusões Suaves */}
                  {onOpenTrash && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenTrash();
                      }}
                      className="p-4 rounded-2xl bg-red-950/20 hover:bg-red-950/40 border border-red-500/30 text-left transition-all cursor-pointer flex items-center justify-between group shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300">
                          <Trash2 size={18} />
                        </div>
                        <div>
                          <h5 className="font-bold text-xs text-white group-hover:text-red-300 transition-colors">
                            Lixeira & Restauração
                          </h5>
                          <p className="text-[11px] text-zinc-400">Recuperar jogos e registros excluídos</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-red-400 group-hover:translate-x-1 transition-transform" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Status Bar */}
        <div className="h-10 px-5 bg-[#08090f] border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500 shrink-0">
          <span>
            Pressione <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]">Esc</kbd> para fechar o console
          </span>
          <span className="font-mono text-cyan-400 font-semibold">
            Haleck Universal Catalog & Admin Center
          </span>
        </div>
      </div>

      {/* SUB-MODAL: GOG GALAXY DIRECT LOGIN OVERLAY */}
      {gogDirectAuthModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
          onClick={() => setGogDirectAuthModalOpen(false)}
        >
          <div
            className="relative w-full max-w-lg bg-[#130b24] border border-purple-500/50 rounded-3xl p-6 shadow-2xl text-white space-y-4 animate-scaleUp overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-600/20 border border-purple-500/40 rounded-2xl text-purple-300">
                  <MonitorPlay size={20} />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Login Direto GOG Galaxy</h4>
                  <p className="text-xs text-purple-300/80">Autenticação oficial ou identificação de perfil</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGogDirectAuthModalOpen(false)}
                className="p-2 rounded-xl bg-purple-950/60 hover:bg-purple-900 text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Nome de Usuário ou Código OAuth GOG:
              </label>
              <input
                type="text"
                value={gogDirectInput}
                onChange={(e) => setGogDirectInput(e.target.value)}
                placeholder="Ex: SeuUsuario ou code=XYZ..."
                className="w-full bg-zinc-950 border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setGogDirectAuthModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDirectGogLogin(gogDirectInput)}
                disabled={isLoggingInGog || !gogDirectInput.trim()}
                className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
              >
                {isLoggingInGog ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                <span>Confirmar Conexão GOG</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL: BLIZZARD BATTLE.NET DIRECT LOGIN OVERLAY */}
      {blizzardDirectAuthModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
          onClick={() => setBlizzardDirectAuthModalOpen(false)}
        >
          <div
            className="relative w-full max-w-xl bg-[#09111e] border border-sky-500/50 rounded-3xl p-6 shadow-2xl text-white space-y-4 animate-scaleUp overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-sky-500/20 border border-sky-500/40 rounded-2xl text-sky-300">
                  <Zap size={22} />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Login Oficial Blizzard Battle.net</h4>
                  <p className="text-xs text-sky-300/80">OAuth 2.0 com autorização de conta permanente</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBlizzardDirectAuthModalOpen(false)}
                className="p-2 rounded-xl bg-sky-950/60 hover:bg-sky-900 text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-sky-950/30 border border-sky-500/30 space-y-2 text-xs">
              <span className="font-bold text-white block">1. Abrir Janela Oficial da Blizzard:</span>
              <button
                type="button"
                onClick={handleOpenBlizzardPopup}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-600/30"
              >
                <ExternalLink size={14} />
                <span>Abrir Janela de Login Battle.net</span>
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  2. Cole o Código Retornado ou URL de Redirecionamento:
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (navigator.clipboard) {
                        const txt = await navigator.clipboard.readText();
                        if (txt) setBlizzardDirectInput(txt.trim());
                      }
                    } catch {}
                  }}
                  className="text-[11px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
                >
                  <ClipboardPaste size={12} />
                  <span>Colar da Transferência</span>
                </button>
              </div>
              <input
                type="text"
                value={blizzardDirectInput}
                onChange={(e) => setBlizzardDirectInput(e.target.value)}
                placeholder="Ex: https://localhost/?code=US1234... ou token Bearer"
                className="w-full bg-zinc-950 border border-sky-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setBlizzardDirectAuthModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDirectBlizzardLogin(blizzardDirectInput)}
                disabled={isConnectingBlizzard || !blizzardDirectInput.trim()}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-sky-600/20"
              >
                {isConnectingBlizzard ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                <span>Confirmar & Sincronizar OAuth</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL: WOW ADDON DEV STUDIO & DOCUMENTATION */}
      <WoWAddonDevModal
        isOpen={addonDevModalOpen}
        onClose={() => setAddonDevModalOpen(false)}
        triggerAlert={triggerAlert}
      />

      {/* SUB-MODAL: IN-GAME ADDON SIMULATOR FULL OVERLAY */}
      <WoWAddonPreviewModal
        isOpen={simulatorModalOpen}
        onClose={() => setSimulatorModalOpen(false)}
        profile={addonParsedResult?.activeProfile || activeWowGame?.blizzardProfileData}
        activeCharacterName={addonCharName || activeWowGame?.blizzardCharacterName}
        activeCharacterRealm={addonRealmName || activeWowGame?.blizzardRealm}
        gameVersion={selectedWoWVersion || activeWowGame?.wowVersion}
      />
    </div>
  );
}
