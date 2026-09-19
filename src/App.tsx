/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Game, DiaryEntry, splitEntities } from "./types";
import { SAMPLE_GAMES, DEFAULT_TAGS, DEFAULT_GENRES, COVER_BANK } from "./data";
import StatsCards from "./components/StatsCards";
import GameCard from "./components/GameCard";
import GameFormModal from "./components/GameFormModal";
import GameDetailDrawer from "./components/GameDetailDrawer";
import GameEstimateModal from "./components/GameEstimateModal";
import { CustomAlert, CustomConfirm, CustomPasswordPrompt, CustomDriveConnectPrompt } from "./components/CustomDialogs";
import { Search, Plus, Filter, Image, Gamepad2, Info, CheckCircle2, Cloud, HardDrive, Lock, Unlock, Mail, Move, ArrowUp, RotateCcw, Key, Settings, BarChart3, Sparkles, Wifi, WifiOff } from "lucide-react";
import GlobalSearchModal from "./components/GlobalSearchModal";
import { DashboardView } from "./components/DashboardView";
import { isFirebaseConfigured, syncFromFirebase, saveToFirebase, verifyGameDataIntegrity, auth, syncGogAuthFromFirebase } from "./utils/firebase";
import { uploadToImgBB, getCustomImgBBKey } from "./utils/imgbb";
import {
  signInWithGoogleDrive,
  isDriveAuthenticated,
  signOutDrive,
  backupLibraryToDrive,
  backupSingleGameToDriveDeep,
  isPopupCancelledOrClosedError
} from "./utils/googleDrive";
import GmailModal from "./components/GmailModal";
import { isGmailAuthenticated } from "./utils/gmail";
import ImgBBModal from "./components/ImgBBModal";
import WelcomeRoleModal from "./components/WelcomeRoleModal";
import { GlobalUploadProgressWidget } from "./components/GlobalUploadProgressWidget";
import { mediaUploadQueueManager } from "./utils/mediaUploadManager";
import SiteSettingsModal from "./components/SiteSettingsModal";
import { formatSteamPlaytime, fetchSteamOwnedGames, fetchSteamAchievements, fetchSteamProfile, SteamPlayerSummary } from "./utils/steamApi";
import { fetchGogOwnedGames, fetchGogAchievements, formatGogPlaytime, fetchGogProfile, resolveGogGame, setStoredGogOAuthToken, setStoredGogUsername, setStoredGogUserId, GogPlayerSummary } from "./utils/gogApi";
import { parsePlaytimeHours } from "./utils/playtime";
import ImageZoomLightbox from "./components/ImageZoomLightbox";
import { repairAllGameMedias, recoverAndReindexImgBBMedias, deduplicateAndSanitizeGameMedias } from "./utils/mediaRepair";
import { GlobalTooltip } from "./components/GlobalTooltip";
import { LiveSessionWidget, LiveSessionHeaderBadge } from "./components/LiveSessionWidget";
import { GamerRetrospectiveModal } from "./components/GamerRetrospectiveModal";
import { runSyncDiagnostic, DiagnosticResult } from "./utils/syncDiagnostic";
import { SyncDiagnosticModal } from "./components/SyncDiagnosticModal";
import { ToastContainer } from "./components/ToastContainer";
import { showToast } from "./utils/toast";
import { moveToTrash } from "./utils/trashService";
import { addToSyncQueue, initSyncQueueListener } from "./utils/syncQueue";
import TrashModal from "./components/TrashModal";
import SocialCardModal from "./components/SocialCardModal";
import StorytellingModal from "./components/StorytellingModal";
import KanbanView, { mapKanbanToStatus } from "./components/KanbanView";
import { restoreTrashItem } from "./utils/trashService";
import { playRetroSound } from "./utils/audioEffects";
import { preloadImagesToCache } from "./utils/imageCacheManager";
import {
  persistGameLibrary,
  loadGameLibrary,
  safeSetLocalStorage,
  safeGetLocalStorage
} from "./utils/storageDb";

const sortAlphabetically = (arr: string[]) => {
  return [...arr].sort((a, b) => a.localeCompare(b, "pt", { sensitivity: "base" }));
};

export default function App() {
  // Core game data storage & custom tags/genres
  const [games, setGames] = useState<Game[]>(() => {
    try {
      const saved = localStorage.getItem("gameLibrary");
      return saved ? JSON.parse(saved) : SAMPLE_GAMES;
    } catch {
      return SAMPLE_GAMES;
    }
  });

  const [globalTags, setGlobalTags] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("globalTagsList");
      const list = saved ? JSON.parse(saved) : DEFAULT_TAGS;
      return sortAlphabetically(Array.from(new Set(list)));
    } catch {
      return sortAlphabetically(Array.from(new Set(DEFAULT_TAGS)));
    }
  });

  const [globalGenres, setGlobalGenres] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("globalGenresList");
      const list = saved ? JSON.parse(saved) : DEFAULT_GENRES;
      return sortAlphabetically(Array.from(new Set(list)));
    } catch {
      return sortAlphabetically(Array.from(new Set(DEFAULT_GENRES)));
    }
  });

  const [coverImage, setCoverImage] = useState<string>(() => {
    // Pick a random cover from the games collection on every page load
    const initialGames = (() => {
      try {
        const savedGames = localStorage.getItem("gameLibrary");
        return savedGames ? JSON.parse(savedGames) : SAMPLE_GAMES;
      } catch {
        return SAMPLE_GAMES;
      }
    })();
    const covers = (initialGames as Game[]).map((g) => g.cover).filter(Boolean);
    const pool = covers.length > 0 ? covers : COVER_BANK;
    return pool[Math.floor(Math.random() * pool.length)];
  });

  // View Mode & Filters State
  const [activeViewMode, setActiveViewMode] = useState<"library" | "dashboard">("library");
  const [activeTab, setActiveTab] = useState<string>("Todos");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [platformFilter, setPlatformFilter] = useState<string>("All");
  const [publisherFilter, setPublisherFilter] = useState<string>("All");
  const [seriesFilter, setSeriesFilter] = useState<string>("All");
  const [tagFilter, setTagFilter] = useState<string>("All");

  // Banner position state & dragging handlers
  const [bannerX, setBannerX] = useState<number>(50);
  const [bannerY, setBannerY] = useState<number>(30);
  const [bannerZoom, setBannerZoom] = useState<number>(100);
  const [isRepositioning, setIsRepositioning] = useState(false);
  const [showSavedNotification, setShowSavedNotification] = useState(false);

  useEffect(() => {
    const savedY = localStorage.getItem(`bannerPosition_${coverImage}`);
    const savedX = localStorage.getItem(`bannerPositionX_${coverImage}`);
    const savedZoom = localStorage.getItem(`bannerZoom_${coverImage}`);
    if (savedY) setBannerY(parseFloat(savedY));
    if (savedX) setBannerX(parseFloat(savedX));
    if (savedZoom) setBannerZoom(parseFloat(savedZoom));
    
    if (!savedY || !savedX || !savedZoom) {
      const matched = games.find((g) => g.cover === coverImage);
      if (matched) {
        if (typeof matched.coverPosition === "number") setBannerY(matched.coverPosition);
        if (typeof matched.coverPositionX === "number") setBannerX(matched.coverPositionX);
        if (typeof matched.coverZoom === "number") setBannerZoom(matched.coverZoom);
      } else {
        if (!savedY) setBannerY(30);
        if (!savedX) setBannerX(50);
        if (!savedZoom) setBannerZoom(100);
      }
    }
  }, [coverImage, games]);

  const dragRef = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    startBannerX: number;
    startBannerY: number;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    startBannerX: 50,
    startBannerY: 30,
  });

  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bannerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (isRepositioning) {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY < 0 ? 5 : -5;
        setBannerZoom((prev) => Math.max(100, Math.min(300, prev + delta)));
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, [isRepositioning]);

  const handleBannerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isRepositioning) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current.isDragging = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
    dragRef.current.startBannerX = bannerX;
    dragRef.current.startBannerY = bannerY;
  };

  const handleBannerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragRef.current.isDragging) return;
    e.preventDefault();
    e.stopPropagation();
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width || 800;
    const containerHeight = rect.height || 288;
    
    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;
    
    const deltaPctX = (deltaX / containerWidth) * 100;
    const deltaPctY = (deltaY / containerHeight) * 100;
    
    const zoomFactor = bannerZoom / 100;
    const sensitivity = 0.8 / zoomFactor;
    const nextX = Math.max(0, Math.min(100, dragRef.current.startBannerX - deltaPctX * sensitivity));
    const nextY = Math.max(0, Math.min(100, dragRef.current.startBannerY - deltaPctY * sensitivity));
    
    setBannerX(nextX);
    setBannerY(nextY);
  };

  const handleBannerMouseUpOrLeave = (e?: React.MouseEvent | React.TouchEvent) => {
    if (dragRef.current.isDragging) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      dragRef.current.isDragging = false;
      localStorage.setItem(`bannerPosition_${coverImage}`, bannerY.toString());
      localStorage.setItem(`bannerPositionX_${coverImage}`, bannerX.toString());
      localStorage.setItem(`bannerZoom_${coverImage}`, bannerZoom.toString());
    }
  };

  const handleBannerTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isRepositioning) return;
    const touch = e.touches[0];
    dragRef.current.isDragging = true;
    dragRef.current.startX = touch.clientX;
    dragRef.current.startY = touch.clientY;
    dragRef.current.startBannerX = bannerX;
    dragRef.current.startBannerY = bannerY;
  };

  const handleBannerTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!dragRef.current.isDragging) return;
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width || 800;
    const containerHeight = rect.height || 288;
    const touch = e.touches[0];
    
    const deltaX = touch.clientX - dragRef.current.startX;
    const deltaY = touch.clientY - dragRef.current.startY;
    
    const deltaPctX = (deltaX / containerWidth) * 100;
    const deltaPctY = (deltaY / containerHeight) * 100;
    
    const zoomFactor = bannerZoom / 100;
    const sensitivity = 0.8 / zoomFactor;
    const nextX = Math.max(0, Math.min(100, dragRef.current.startBannerX - deltaPctX * sensitivity));
    const nextY = Math.max(0, Math.min(100, dragRef.current.startBannerY - deltaPctY * sensitivity));
    
    setBannerX(nextX);
    setBannerY(nextY);
  };


  // Drawer & Modals state
  const [detailGameId, setDetailGameId] = useState<string | null>(null);
  const [editGame, setEditGame] = useState<Game | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [estimateGameModal, setEstimateGameModal] = useState<Game | null>(null);

  // New Features Modal & View State
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [socialCardGame, setSocialCardGame] = useState<Game | null>(null);
  const [storytellingGame, setStorytellingGame] = useState<Game | null>(null);
  const [dashboardViewMode, setDashboardViewMode] = useState<"grid" | "kanban">("grid");

  const handleRestoreGameFromTrash = (game: Game) => {
    setGames((prev) => {
      const exists = prev.some((g) => g.id === game.id);
      if (exists) return prev;
      const updated = [game, ...prev];
      saveToFirebase(updated, globalTags, globalGenres).catch(() => {});
      return updated;
    });
    playRetroSound("statusChange");
    showToast({
      title: "Jogo Restaurado 🔄",
      message: `"${game.name}" foi restaurado com sucesso.`,
      type: "success",
    });
  };

  const handleRestoreDiaryEntryFromTrash = (gameId: string, entry: DiaryEntry) => {
    setGames((prev) => {
      const updated = prev.map((g) => {
        if (g.id !== gameId) return g;
        const diary = g.diary || [];
        const exists = diary.some((e) => e.id === entry.id);
        const newDiary = exists ? diary : [...diary, entry];
        return { ...g, diary: newDiary };
      });
      saveToFirebase(updated, globalTags, globalGenres).catch(() => {});
      return updated;
    });
    playRetroSound("statusChange");
    showToast({
      title: "Entrada Restaurada 🔄",
      message: `A entrada do diário foi restaurada.`,
      type: "success",
    });
  };

  const handleRestoreMediaFromTrash = (gameId: string, diaryEntryId: string, media: any) => {
    setGames((prev) => {
      const updated = prev.map((g) => {
        if (g.id !== gameId) return g;
        const newDiary = (g.diary || []).map((e) => {
          if (e.id !== diaryEntryId) return e;
          const medias = e.medias || [];
          const exists = medias.some((m) => m.src === media.src);
          return exists ? e : { ...e, medias: [...medias, media] };
        });
        return { ...g, diary: newDiary };
      });
      saveToFirebase(updated, globalTags, globalGenres).catch(() => {});
      return updated;
    });
    playRetroSound("statusChange");
    showToast({
      title: "Mídia Restaurada 🔄",
      message: "Mídia restaurada com sucesso no diário.",
      type: "success",
    });
  };

  // Global Search Modal state
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [selectedSearchDiaryId, setSelectedSearchDiaryId] = useState<string | null>(null);
  const [isRetrospectiveOpen, setIsRetrospectiveOpen] = useState(false);
  const [selectedSearchOpenDictionary, setSelectedSearchOpenDictionary] = useState<boolean>(false);

  // Diagnostic Modal state
  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [isDiagnosticLoading, setIsDiagnosticLoading] = useState(false);

  const handleRunDiagnostic = async () => {
    setIsDiagnosticModalOpen(true);
    setIsDiagnosticLoading(true);
    try {
      const res = await runSyncDiagnostic(games);
      setDiagnosticResult(res);
    } catch (err: any) {
      console.error("Erro ao executar diagnóstico:", err);
    } finally {
      setIsDiagnosticLoading(false);
    }
  };

  // Global Keyboard Shortcut (Ctrl+K or Cmd+K) to toggle Global Search Modal
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsGlobalSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Custom alert & confirm states
  const [alertState, setAlertState] = useState({ isOpen: false, title: "", message: "" });
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });
  const [passwordState, setPasswordState] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  const triggerPasswordPrompt = (title: string, message: string, onConfirm: () => void) => {
    setPasswordState({
      isOpen: true,
      title,
      message,
      onConfirm
    });
  };

  const triggerAlert = useCallback((title: string, message: string) => {
    const isError = /erro|falha|campo|inválid/i.test(title);
    const isWarning = /aviso|alerta|parcial|atenção/i.test(title);
    const isSuccess = /sucesso|concluíd|carregad|restaurad|salv|editad|excluíd/i.test(title);
    const type = isError ? "error" : isWarning ? "warning" : isSuccess ? "success" : "info";

    showToast({ title, message, type });
  }, []);

  const triggerConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        onConfirm();
      }
    });
  };

  // Synced local storage effects
  useEffect(() => {
    mediaUploadQueueManager.setGameUpdateCallback((gameId, updateFn) => {
      setGames((prevGames) =>
        prevGames.map((g) => (g.id === gameId ? updateFn(g) : g))
      );
    });
  }, []);

  // Asynchronously hydrate library from IndexedDB if available
  useEffect(() => {
    loadGameLibrary().then((saved) => {
      if (saved && Array.isArray(saved) && saved.length > 0) {
        setGames((currentGames) => {
          // If current games is just the default sample games or empty, adopt saved
          if (
            currentGames.length <= SAMPLE_GAMES.length &&
            currentGames.every((g, i) => SAMPLE_GAMES[i] && g.id === SAMPLE_GAMES[i].id)
          ) {
            return saved;
          }
          return currentGames;
        });
      }
    });
  }, []);

  const gamesRef = useRef(games);
  useEffect(() => {
    gamesRef.current = games;
    persistGameLibrary(games);
    console.log(`[GamesStateLog] Estado 'games' atualizado. Total de jogos: ${games.length}`, {
      isEmpty: games.length === 0,
      isComplete: games.length > 0,
      gamesCount: games.length,
      sampleGameNames: games.slice(0, 5).map((g) => g.name),
    });

    // Pré-carrega capas e mídias principais no CacheStorage local em background
    if (games.length > 0) {
      const coverUrls = games.map((g) => g.cover).filter(Boolean);
      const iconUrls = games.map((g) => g.iconUrl).filter(Boolean);
      const recentDiaryMedias = games.flatMap((g) => 
        (g.diary || []).flatMap((d) => (d.medias || []).map((m) => m.url)).slice(0, 30)
      );
      preloadImagesToCache([...coverUrls, ...iconUrls, ...recentDiaryMedias]);
    }
  }, [games]);

  useEffect(() => {
    safeSetLocalStorage("globalTagsList", JSON.stringify(globalTags));
  }, [globalTags]);

  useEffect(() => {
    safeSetLocalStorage("globalGenresList", JSON.stringify(globalGenres));
  }, [globalGenres]);

  useEffect(() => {
    safeSetLocalStorage("globalCover", coverImage);
  }, [coverImage]);

  // Synchronize and collect global tags and genres from games list automatically
  useEffect(() => {
    let tagsAdded = false;
    let genresAdded = false;

    const tagsSet = new Set<string>(globalTags);
    const genresSet = new Set<string>(globalGenres);

    games.forEach((game) => {
      (game.tags || []).forEach((tag) => {
        if (tag && !tagsSet.has(tag)) {
          tagsSet.add(tag);
          tagsAdded = true;
        }
      });
      (game.genre || []).forEach((gen) => {
        if (gen && !genresSet.has(gen)) {
          genresSet.add(gen);
          genresAdded = true;
        }
      });
    });

    if (tagsAdded) {
      setGlobalTags(sortAlphabetically(Array.from(tagsSet)));
    }
    if (genresAdded) {
      setGlobalGenres(sortAlphabetically(Array.from(genresSet)));
    }
  }, [games]);

  // Firebase Realtime Synchronization refs and hooks
  const isIncomingFirebaseUpdate = useRef(false);
  const hasInitiallySynced = useRef(!isFirebaseConfigured());
  const backupAbortControllerRef = useRef<AbortController | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [gmailModalOpen, setGmailModalOpen] = useState(false);
  const [gmailTargetGame, setGmailTargetGame] = useState<Game | null>(null);
  const [imgBBModalOpen, setImgBBModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [steamModalOpen, setSteamModalOpen] = useState(false);

  const handleImportSteamGame = (newGameData: Partial<Game>) => {
    const newGameObj: Game = {
      id: `game-steam-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: newGameData.name || "Novo Jogo Steam",
      platform: newGameData.platform || "PC (Steam)",
      status: newGameData.status || ["Jogando"],
      genre: newGameData.genre || ["PC"],
      tags: newGameData.tags || ["Steam"],
      cover: newGameData.cover || "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80",
      icon: newGameData.icon || "🎮",
      iconType: newGameData.iconType || "emoji",
      rating: newGameData.rating || 0,
      startDate: newGameData.startDate || new Date().toISOString().slice(0, 10),
      endDate: "",
      releaseDate: "",
      playtime: newGameData.playtime || "0h",
      series: "",
      publisher: "Steam",
      diary: [],
      steamAppId: newGameData.steamAppId,
      steamPlaytimeMinutes: newGameData.steamPlaytimeMinutes,
      steamLastPlayedTimestamp: newGameData.steamLastPlayedTimestamp,
      steamAchievementsCount: newGameData.steamAchievementsCount,
      steamAchievementsTotal: newGameData.steamAchievementsTotal,
    };

    setGames((prev) => [newGameObj, ...prev]);
    setHasUnsavedChanges(true);
  };

  const handleUpdateGameSteamPlaytime = (gameId: string, steamPlaytimeMins: number, appid: number) => {
    setGames((prev) =>
      prev.map((g) => {
        if (g.id === gameId) {
          return {
            ...g,
            steamAppId: appid,
            steamPlaytimeMinutes: steamPlaytimeMins,
            playtime: formatSteamPlaytime(steamPlaytimeMins),
          };
        }
        return g;
      })
    );
    setHasUnsavedChanges(true);
  };
  const [drivePromptOpen, setDrivePromptOpen] = useState(false);
  const [globalZoomImage, setGlobalZoomImage] = useState<{ src: string; allImages?: string[]; title?: string } | null>(null);
  const [welcomeModalOpen, setWelcomeModalOpen] = useState<boolean>(() => {
    return sessionStorage.getItem("role_choice_done") !== "true";
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const isFirstMount = useRef(true);

  const handleSelectViewer = () => {
    setIsAdmin(false);
    sessionStorage.removeItem("admin_unlocked");
    sessionStorage.setItem("role_choice_done", "true");
    setWelcomeModalOpen(false);
  };

  const handleSelectEditor = (passwordInput: string): boolean => {
    if (passwordInput === "159753") {
      setIsAdmin(true);
      sessionStorage.setItem("admin_unlocked", "true");
      sessionStorage.setItem("role_choice_done", "true");
      setWelcomeModalOpen(false);
      triggerAlert("Modo Editor Ativo", "Acesso liberado! Você agora tem permissões de administrador.");
      return true;
    }
    return false;
  };

  const hasBase64Images = (gamesList: Game[]): boolean => {
    return gamesList.some((game) => {
      if (game.cover && game.cover.startsWith("data:")) return true;
      if (game.icon && game.icon.startsWith("data:") && game.iconType === "upload") return true;
      if (game.diary && game.diary.some((entry) => entry.medias && entry.medias.some((m) => m.src && m.src.startsWith("data:")))) return true;
      return false;
    });
  };

  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return sessionStorage.getItem("admin_unlocked") === "true";
  });

  const [visibleCount, setVisibleCount] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem("gameLibraryVisibleCount");
      return saved ? parseInt(saved, 10) : 15;
    } catch {
      return 15;
    }
  });

  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isBatchSyncingSteam, setIsBatchSyncingSteam] = useState(false);
  const [isBatchSyncingGog, setIsBatchSyncingGog] = useState(false);
  const [steamProfile, setSteamProfile] = useState<SteamPlayerSummary | null>(null);
  const [gogProfile, setGogProfile] = useState<GogPlayerSummary | null>(null);

  useEffect(() => {
    let mounted = true;

    // Sincronizar credenciais de autenticação da GOG armazenadas no Firebase (Cross-Device)
    let unsubscribeGogAuth: (() => void) | undefined;
    if (isFirebaseConfigured()) {
      try {
        unsubscribeGogAuth = syncGogAuthFromFirebase((authData) => {
          if (authData) {
            console.log("[CrossDeviceGOG] Sessão GOG sincronizada da nuvem:", authData.username || authData.userId);
            if (authData.token) setStoredGogOAuthToken(authData.token, authData.expiresAt, authData.refreshToken, true);
            if (authData.username) setStoredGogUsername(authData.username, true);
            if (authData.userId) setStoredGogUserId(authData.userId, true);
            
            // Recarrega o perfil da GOG imediatamente
            fetchGogProfile().then((prof) => {
              if (mounted && prof) setGogProfile(prof);
            }).catch(() => {});
          }
        });
      } catch (err) {
        console.warn("Erro ao escutar sessão GOG no Firebase:", err);
      }
    }

    const loadGamingProfiles = async () => {
      try {
        const steamProf = await fetchSteamProfile();
        if (mounted && steamProf) {
          setSteamProfile(steamProf);
        }
      } catch (e) {
        // ignore steam profile error
      }
      try {
        const gogProf = await fetchGogProfile();
        if (mounted && gogProf) {
          setGogProfile(gogProf);
        }
      } catch (e) {
        // ignore gog profile error
      }
    };
    loadGamingProfiles();
    const interval = setInterval(loadGamingProfiles, 2 * 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
      if (unsubscribeGogAuth) unsubscribeGogAuth();
    };
  }, []);

  const handleBatchSyncSteam = async () => {
    const steamLinkedGames = games.filter((g) => g.steamAppId || (g.steamPlaytimeMinutes && g.steamPlaytimeMinutes > 0));
    if (steamLinkedGames.length === 0) {
      triggerAlert("Nenhum Jogo Vinculado", "Não há jogos com ID da Steam na sua biblioteca para sincronizar.");
      return;
    }

    setIsBatchSyncingSteam(true);
    try {
      const ownedList = await fetchSteamOwnedGames();
      let updatedCount = 0;

      const newGames = await Promise.all(
        games.map(async (g) => {
          if (!g.steamAppId) return g;
          const match = ownedList.find((o) => o.appid === g.steamAppId || String(o.appid) === String(g.steamAppId));
          let updated = { ...g };
          if (match) {
            updated.steamPlaytimeMinutes = match.playtime_forever;
            if (match.rtime_last_played) {
              updated.steamLastPlayedTimestamp = match.rtime_last_played;
            }
          }
          try {
            const ach = await fetchSteamAchievements(g.steamAppId);
            if (ach) {
              const prevCount = g.steamAchievementsCount;
              const currentCount = ach.unlockedCount;
              if (prevCount !== undefined && currentCount > prevCount) {
                const diff = currentCount - prevCount;
                showToast({
                  title: `🏆 Novas Conquistas em "${g.name}"!`,
                  message: `Você conquistou +${diff} nova(s) conquista(s)! Total: ${currentCount} / ${ach.totalCount}`,
                  type: "achievement",
                  duration: 8000,
                });
              }
              updated.steamAchievementsCount = ach.unlockedCount;
              updated.steamAchievementsTotal = ach.totalCount;
            }
          } catch {
            // Ignore individual achievement fetch failure
          }
          updatedCount++;
          return updated;
        })
      );

      setGames(newGames);
      triggerAlert(
        "Sincronização em Lote Concluída",
        `Sucesso! Dados e estatísticas da Steam sincronizados para ${updatedCount} ${updatedCount === 1 ? "jogo" : "jogos"}.`
      );
    } catch (err: any) {
      console.error(err);
      triggerAlert("Erro na Sincronização em Lote", "Não foi possível buscar a lista de jogos do usuário na Steam Web API.");
    } finally {
      setIsBatchSyncingSteam(false);
    }
  };

  const handleBatchSyncGog = async () => {
    const gogLinkedGames = games.filter(
      (g) =>
        g.integrationPlatform === "gog" ||
        g.gogGameId ||
        (g.gogPlaytimeMinutes && g.gogPlaytimeMinutes > 0) ||
        (g.platform && g.platform.toLowerCase().includes("gog"))
    );
    if (gogLinkedGames.length === 0) {
      triggerAlert("Nenhum Jogo GOG Vinculado", "Não há jogos com dados, ID da GOG ou plataforma GOG na sua biblioteca para sincronizar.");
      return;
    }

    setIsBatchSyncingGog(true);
    try {
      let ownedList: any[] = [];
      try {
        ownedList = await fetchGogOwnedGames();
      } catch (e) {
        console.warn("Aviso ao buscar owned games:", e);
      }

      let updatedCount = 0;
      let totalPlaytimeUpdated = 0;

      const newGames = await Promise.all(
        games.map(async (g) => {
          const isGogTarget =
            g.integrationPlatform === "gog" ||
            g.gogGameId ||
            (g.gogPlaytimeMinutes && g.gogPlaytimeMinutes > 0) ||
            (g.platform && g.platform.toLowerCase().includes("gog"));

          if (!isGogTarget) return g;
          let updated = { ...g };
          let newPlaytime = updated.gogPlaytimeMinutes || 0;
          let newLastPlayed = updated.gogLastPlayedTimestamp;

          // 1. Tenta resolver profundamente pela API da GOG
          try {
            const queryKey = String(updated.gogGameId || updated.name).trim();
            const resolved = await resolveGogGame(queryKey);
            if (resolved && resolved.success) {
              if (!updated.gogGameId && resolved.gameId) {
                updated.gogGameId = resolved.gameId;
              }
              if (typeof resolved.playtime_minutes === "number" && resolved.playtime_minutes > 0) {
                newPlaytime = resolved.playtime_minutes;
              }
              if (resolved.last_played_timestamp) {
                newLastPlayed = resolved.last_played_timestamp;
              }
              if (resolved.achievements) {
                const prevCount = g.gogAchievementsCount;
                const currentCount = resolved.achievements.unlockedCount;
                if (prevCount !== undefined && currentCount > prevCount) {
                  const diff = currentCount - prevCount;
                  showToast({
                    title: `🏆 Novas Conquistas GOG em "${g.name}"!`,
                    message: `Você conquistou +${diff} nova(s) conquista(s) na GOG! Total: ${currentCount} / ${resolved.achievements.totalCount}`,
                    type: "achievement",
                    duration: 8000,
                  });
                }
                updated.gogAchievementsCount = resolved.achievements.unlockedCount;
                updated.gogAchievementsTotal = resolved.achievements.totalCount;
              }
            }
          } catch (e) {
            console.warn(`Aviso ao resolver jogo ${g.name} na GOG:`, e);
          }

          // 2. Fallback na lista de jogos adquiridos
          if (ownedList.length > 0) {
            const match = ownedList.find(
              (o) =>
                (updated.gogGameId && String(o.id) === String(updated.gogGameId)) ||
                (o.title && o.title.toLowerCase().trim() === g.name.toLowerCase().trim()) ||
                (o.slug && g.name.toLowerCase().includes(o.slug.toLowerCase().replace(/[-_]/g, " ")))
            );
            if (match) {
              if (typeof match.playtime_minutes === "number" && match.playtime_minutes > 0) {
                newPlaytime = Math.max(newPlaytime, match.playtime_minutes);
              }
              if (match.last_played_timestamp) {
                newLastPlayed = match.last_played_timestamp;
              }
              if (!updated.gogGameId) {
                updated.gogGameId = String(match.id);
              }
            }
          }

          // 3. Fallback de conquistas e tempo via endpoint dedicado de achievements
          if (updated.gogGameId) {
            try {
              const ach = await fetchGogAchievements(updated.gogGameId);
              if (ach) {
                if (typeof ach.playtime_minutes === "number" && ach.playtime_minutes > 0) {
                  newPlaytime = Math.max(newPlaytime, ach.playtime_minutes);
                }
                const prevCount = g.gogAchievementsCount;
                const currentCount = ach.unlockedCount;
                if (prevCount !== undefined && currentCount > prevCount) {
                  const diff = currentCount - prevCount;
                  showToast({
                    title: `🏆 Novas Conquistas GOG em "${g.name}"!`,
                    message: `Você conquistou +${diff} nova(s) conquista(s) na GOG! Total: ${currentCount} / ${ach.totalCount}`,
                    type: "achievement",
                    duration: 8000,
                  });
                }
                updated.gogAchievementsCount = ach.unlockedCount;
                updated.gogAchievementsTotal = ach.totalCount;
              }
            } catch {
              // Ignore individual achievement fetch failure
            }
          }

          // Atribuição garantida do tempo de jogo formatado e persistido
          if (newPlaytime > 0 && newPlaytime < 300000) {
            updated.gogPlaytimeMinutes = newPlaytime;
            updated.playtime = formatGogPlaytime(newPlaytime);
            if (!updated.integrationPlatform || updated.integrationPlatform === "none") {
              updated.integrationPlatform = "gog";
            }
            totalPlaytimeUpdated++;
          } else if (parsePlaytimeHours(updated.playtime) > 25000) {
            updated.playtime = "0h";
            updated.gogPlaytimeMinutes = 0;
          }
          if (newLastPlayed) {
            updated.gogLastPlayedTimestamp = newLastPlayed;
          }

          updatedCount++;
          return updated;
        })
      );

      setGames(newGames);
      setHasUnsavedChanges(true);

      // Auto-salva no Firebase Realtime Database para persistência na nuvem
      if (isFirebaseConfigured()) {
        try {
          await saveToFirebase(newGames, globalTags, globalGenres);
          setHasUnsavedChanges(false);
          console.log("[BatchSyncGOG] Jogos e tempos GOG salvos no Firebase com sucesso.");
        } catch (saveErr) {
          console.warn("Aviso ao salvar sincronização GOG no Firebase:", saveErr);
        }
      }

      triggerAlert(
        "Sincronização em Lote GOG Concluída",
        `Sucesso! Dados e estatísticas da GOG Galaxy sincronizados para ${updatedCount} ${updatedCount === 1 ? "jogo" : "jogos"} (Tempo de jogo atualizado em ${totalPlaytimeUpdated} jogos).`
      );
    } catch (err: any) {
      console.error(err);
      triggerAlert("Erro na Sincronização GOG", "Não foi possível sincronizar todos os dados da GOG do usuário.");
    } finally {
      setIsBatchSyncingGog(false);
    }
  };

  useEffect(() => {
    try {
      sessionStorage.setItem("gameLibraryVisibleCount", visibleCount.toString());
    } catch (e) {
      // ignore
    }
  }, [visibleCount]);

  useEffect(() => {
    let ticking = false;
    const updateScrollTopState = () => {
      let isPastThreshold = false;
      if (detailGameId !== null) {
        const drawerScrollable = document.querySelector(".drawer-scrollable-container");
        if (drawerScrollable) {
          isPastThreshold = drawerScrollable.scrollTop > 300;
        } else {
          isPastThreshold = window.scrollY > 400;
        }
      } else {
        isPastThreshold = window.scrollY > 400;
      }
      setShowScrollTop((prev) => (prev !== isPastThreshold ? isPastThreshold : prev));
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollTopState);
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    let drawerEl: Element | null = null;
    const interval = setInterval(() => {
      const el = document.querySelector(".drawer-scrollable-container");
      if (el && el !== drawerEl) {
        drawerEl = el;
        el.addEventListener("scroll", handleScroll, { passive: true });
      }
    }, 500);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (drawerEl) {
        drawerEl.removeEventListener("scroll", handleScroll);
      }
      clearInterval(interval);
    };
  }, [detailGameId]);

  const ensureAdmin = (actionName: string, onAuthorized: () => void | Promise<void>) => {
    if (isAdmin) {
      onAuthorized();
    } else {
      triggerPasswordPrompt(
        "Acesso Restrito",
        `Para ${actionName}, insira a senha do administrador para liberar o modo de edição.`,
        () => {
          setIsAdmin(true);
          sessionStorage.setItem("admin_unlocked", "true");
          onAuthorized();
        }
      );
    }
  };

  useEffect(() => {
    setIsDriveConnected(isDriveAuthenticated());
    setIsGmailConnected(isGmailAuthenticated());
  }, []);

  const handleConnectDrive = async () => {
    ensureAdmin("conectar ao Google Drive", async () => {
      try {
        setBackupStatus("Conectando ao Google Drive...");
        await signInWithGoogleDrive();
        setIsDriveConnected(true);
        triggerAlert(
          "Google Drive Conectado",
          "Sua conta foi conectada! Agora, ao salvar, um backup completo de mídias e metadados será enviado para uma pasta organizada no seu Google Drive."
        );
      } catch (err: any) {
        if (isPopupCancelledOrClosedError(err)) {
          console.info("[GoogleDrive] Autenticação cancelada pelo usuário ou janela fechada.");
          const isInIframe = typeof window !== "undefined" && window.self !== window.top;
          triggerAlert(
            "Conexão Não Concluída",
            isInIframe
              ? "A janela de login do Google foi fechada antes da conclusão.\n\n💡 Dica de Visualização: Como o app está rodando dentro do preview (iframe) do AI Studio, abra o aplicativo em uma nova aba do navegador para autorizar sem restrições.\n\n⚠️ Se o Google exibiu 'Acesso bloqueado' com os 'Detalhes da solicitação', certifique-se de adicionar seu e-mail como 'Usuário de teste' (Test user) na Tela de Consentimento OAuth do projeto no Google Cloud Console."
              : "A janela de login do Google foi fechada antes de concluir a autorização.\n\n⚠️ Se o Google exibiu 'Acesso bloqueado' com os 'Detalhes da solicitação', certifique-se de adicionar seu e-mail como 'Usuário de teste' (Test user) na Tela de Consentimento OAuth do projeto no Google Cloud Console."
          );
        } else {
          console.error(err);
          triggerAlert(
            "Erro de Conexão",
            `Não foi possível conectar ao Google Drive: ${err.message || err}`
          );
        }
      } finally {
        setBackupStatus(null);
      }
    });
  };

  const handleDisconnectDrive = () => {
    ensureAdmin("desconectar o Google Drive", () => {
      triggerConfirm(
        "Desconectar Google Drive",
        "Tem certeza que deseja desconectar o backup do Google Drive?",
        async () => {
          try {
            await signOutDrive();
            setIsDriveConnected(false);
            triggerAlert("Desconectado", "Sua conta do Google Drive foi desconectada.");
          } catch (err: any) {
            console.error(err);
            triggerAlert("Erro", `Erro ao desconectar: ${err.message}`);
          }
        }
      );
    });
  };

  const handleManualSave = () => {
    if (isSaving) {
      triggerConfirm(
        "Cancelar Backup?",
        "Deseja realmente cancelar o backup para o Google Drive em andamento?",
        () => {
          if (backupAbortControllerRef.current) {
            backupAbortControllerRef.current.abort();
            setBackupStatus("Cancelando backup...");
          }
        }
      );
    } else {
      ensureAdmin("salvar as alterações", () => {
        if (!isDriveAuthenticated()) {
          setDrivePromptOpen(true);
        } else {
          executeSave();
        }
      });
    }
  };

  const handleConnectDriveAndSave = async () => {
    setDrivePromptOpen(false);
    try {
      setBackupStatus("Conectando ao Google Drive...");
      await signInWithGoogleDrive();
      setIsDriveConnected(true);
      executeSave();
    } catch (err: any) {
      if (isPopupCancelledOrClosedError(err)) {
        console.info("[GoogleDrive] Login cancelado durante o fluxo de salvar.");
        triggerConfirm(
          "Login Não Concluído",
          "A janela de autenticação do Google Drive foi fechada. Deseja prosseguir salvando os dados no Firebase / Localmente sem o backup do Drive neste momento?",
          () => {
            executeSave();
          }
        );
      } else {
        console.error(err);
        triggerAlert(
          "Erro de Conexão",
          `Não foi possível conectar ao Google Drive: ${err.message || err}`
        );
      }
    } finally {
      setBackupStatus(null);
    }
  };

  const executeSave = async () => {
    setIsSaving(true);
    setBackupStatus("Preparando envio...");
    
    const abortController = new AbortController();
    backupAbortControllerRef.current = abortController;

    try {
      let gamesUpdated = false;
      const processedGames = [];

      for (let i = 0; i < games.length; i++) {
        const game = games[i];
        let gameUpdated = false;
        let updatedCover = game.cover;
        let updatedIcon = game.icon;

        // Check if cover is base64 or blob
        if (game.cover && (game.cover.startsWith("data:") || game.cover.startsWith("blob:"))) {
          try {
            setBackupStatus(`Enviando capa de ${game.name} (${i + 1}/${games.length})...`);
            const res = await uploadToImgBB(game.cover, `${game.name}_cover`);
            updatedCover = res.url;
            gameUpdated = true;
          } catch (err) {
            console.error(`Falha ao carregar a capa do jogo ${game.name} para o ImgBB:`, err);
          }
        }

        // Check if icon is base64 or blob upload
        if (game.icon && (game.icon.startsWith("data:") || game.icon.startsWith("blob:")) && game.iconType === "upload") {
          try {
            setBackupStatus(`Enviando ícone de ${game.name}...`);
            const res = await uploadToImgBB(game.icon, `${game.name}_icon`);
            updatedIcon = res.url;
            gameUpdated = true;
          } catch (err) {
            console.error(`Falha ao carregar o ícone do jogo ${game.name} para o ImgBB:`, err);
          }
        }

        // Check diary entry media items for base64 or blob data
        const updatedDiary = [];
        for (const entry of game.diary || []) {
          let entryUpdated = false;
          const updatedMedias = [];

          for (let mediaIdx = 0; mediaIdx < (entry.medias || []).length; mediaIdx++) {
            const media = entry.medias![mediaIdx];
            if (media.src && (media.src.startsWith("data:") || media.src.startsWith("blob:")) && !media.isVideo) {
              try {
                setBackupStatus(`Enviando foto do diário de ${game.name}...`);
                const res = await uploadToImgBB(media.src, `${game.name}_diario_${mediaIdx + 1}`);
                entryUpdated = true;
                updatedMedias.push({ ...media, src: res.url, deleteUrl: res.deleteUrl || media.deleteUrl });
              } catch (err) {
                console.error(`Falha ao carregar imagem do diário do jogo ${game.name} para o ImgBB:`, err);
                updatedMedias.push(media);
              }
            } else {
              updatedMedias.push(media);
            }
          }

          if (entryUpdated) {
            gameUpdated = true;
          }
          updatedDiary.push({ ...entry, medias: updatedMedias });
        }

        if (gameUpdated) {
          gamesUpdated = true;
        }

        processedGames.push({
          ...game,
          cover: updatedCover,
          icon: updatedIcon,
          diary: updatedDiary
        });
      }

      let finalGames = games;
      if (gamesUpdated) {
        setGames(processedGames);
        finalGames = processedGames;
      }

      setBackupStatus("Salvando no Firebase...");
      await saveToFirebase(finalGames, globalTags, globalGenres);
      setHasUnsavedChanges(false);

      // Sincronizar mídias e metadados no Google Drive se autenticado
      if (isDriveAuthenticated()) {
        const driveTaskId = `drive_backup_${Date.now()}`;
        mediaUploadQueueManager.startDriveBackupTask({
          id: driveTaskId,
          gameCount: finalGames.length,
          abortController,
        });

        try {
          await backupLibraryToDrive(
            finalGames,
            globalTags,
            globalGenres,
            (statusMsg, completedSteps, totalSteps) => {
              setBackupStatus(statusMsg);
              mediaUploadQueueManager.updateDriveBackupProgress({
                id: driveTaskId,
                completedCount: completedSteps ?? 0,
                totalCount: totalSteps ?? finalGames.length,
                currentMessage: statusMsg,
              });
            },
            abortController.signal
          );
          mediaUploadQueueManager.finishDriveBackupTask(driveTaskId);
        } catch (backupErr: any) {
          mediaUploadQueueManager.finishDriveBackupTask(
            driveTaskId,
            backupErr.name === "AbortError" || String(backupErr).includes("cancel") ? "Cancelado" : String(backupErr.message || backupErr)
          );
          throw backupErr;
        }
      }

      triggerAlert(
        "Sucesso ao Salvar",
        isDriveAuthenticated()
          ? "Alterações salvas no Firebase e backup de segurança gerado no seu Google Drive com sucesso!"
          : "As alterações e todas as novas imagens foram salvas e enviadas com sucesso em tempo real!"
      );
    } catch (err: any) {
      if (err.name === "AbortError" || err.message?.includes("abort") || err.message?.includes("cancel")) {
        console.log("Backup cancelado pelo usuário.");
        triggerAlert("Backup Cancelado", "O backup para o Google Drive foi cancelado com sucesso!");
      } else {
        console.error(err);
        triggerAlert(
          "Erro ao Salvar",
          `Houve um erro ao enviar os dados: ${err.message || err}`
        );
      }
    } finally {
      setIsSaving(false);
      setBackupStatus(null);
      backupAbortControllerRef.current = null;
    }
  };

  const handleDeepBackupSingleGameDrive = useCallback(
    async (game: Game) => {
      if (!isDriveAuthenticated()) {
        triggerConfirm(
          "Google Drive Não Conectado",
          "Deseja conectar sua conta do Google Drive agora para realizar o backup profundo deste jogo?",
          () => {
            handleConnectDrive();
          }
        );
        return;
      }

      const driveTaskId = `deep_drive_backup_${game.id}_${Date.now()}`;
      const abortController = new AbortController();

      mediaUploadQueueManager.startDriveBackupTask({
        id: driveTaskId,
        gameCount: 1,
        abortController,
      });

      try {
        await backupSingleGameToDriveDeep(
          game,
          games,
          globalTags,
          globalGenres,
          (statusMsg, completedSteps, totalSteps) => {
            mediaUploadQueueManager.updateDriveBackupProgress({
              id: driveTaskId,
              completedCount: completedSteps ?? 0,
              totalCount: totalSteps ?? 1,
              currentMessage: statusMsg,
            });
          },
          abortController.signal
        );
        mediaUploadQueueManager.finishDriveBackupTask(driveTaskId);
        triggerAlert(
          "Backup Profundo Concluído",
          `O backup de "${game.name}" e todas as suas mídias foi totalmente verificado e salvo no Google Drive!`
        );
      } catch (err: any) {
        const errMsg = err.name === "AbortError" || String(err).includes("cancel") ? "Cancelado" : String(err.message || err);
        mediaUploadQueueManager.finishDriveBackupTask(driveTaskId, errMsg);
        if (err.name !== "AbortError") {
          triggerAlert("Erro no Backup", `Não foi possível concluir o backup no Google Drive: ${errMsg}`);
        }
      }
    },
    [games, globalTags, globalGenres, triggerAlert, triggerConfirm]
  );

  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const unsubscribe = syncFromFirebase((remoteGames, remoteTags, remoteGenres) => {
      console.log(`[FirebaseSync] Sincronização Firebase recebida. Jogos remotos: ${remoteGames.length}, Tags: ${remoteTags.length}, Gêneros: ${remoteGenres.length}`);
      
      // Executa verificação detalhada entre o estado local e os dados retornados pelo Firebase
      if (gamesRef.current && gamesRef.current.length > 0) {
        verifyGameDataIntegrity(gamesRef.current, remoteGames, "FirebaseSyncComparison");
      }

      isIncomingFirebaseUpdate.current = true;
      
      if (remoteGames.length > 0 || remoteTags.length > 0 || remoteGenres.length > 0) {
        setGames(remoteGames);
        setGlobalTags(sortAlphabetically(remoteTags));
        setGlobalGenres(sortAlphabetically(remoteGenres));
      } else {
        // If Firebase is empty, initialize it with current local/default data
        console.log("[FirebaseSync] Firebase retornou array vazio. Inicializando com estado local.");
        saveToFirebase(games, globalTags, globalGenres).catch((err) => {
          console.error("Erro ao inicializar dados no Firebase:", err);
        });
      }

      hasInitiallySynced.current = true;
      setHasUnsavedChanges(false);

      setTimeout(() => {
        isIncomingFirebaseUpdate.current = false;
      }, 100);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Auto-repair and deduplicate ImgBB links and media URLs
  const hasAttemptedAutoRepair = useRef(false);
  useEffect(() => {
    if (games.length === 0 || hasAttemptedAutoRepair.current) return;
    
    // First deduplicate any bloated/duplicate entries
    const { sanitizedGames, deduplicatedCount } = deduplicateAndSanitizeGameMedias(games);
    let workingGames = sanitizedGames;
    if (deduplicatedCount > 0) {
      console.log(`[AutoDeduplicate] Removidas ${deduplicatedCount} mídias duplicadas/inválidas das entradas.`);
      setGames(sanitizedGames);
    }

    const needsRepair = workingGames.some((g) => {
      if (g.cover && g.cover.includes("ibb.co") && !g.cover.includes("i.ibb.co")) return true;
      if (g.icon && g.icon.includes("ibb.co") && !g.icon.includes("i.ibb.co")) return true;
      return g.diary?.some((e) =>
        e.medias?.some(
          (m) => (m.src?.includes("ibb.co") && !m.src?.includes("i.ibb.co")) || m.src?.startsWith("blob:")
        )
      );
    });

    if (needsRepair) {
      hasAttemptedAutoRepair.current = true;
      repairAllGameMedias(workingGames).then(({ repairedGames, repairedCount }) => {
        if (repairedCount > 0) {
          console.log(`[AutoRepair] Corrigidas ${repairedCount} mídias automaticamente.`);
          setGames(repairedGames);
        }
      });
    }
  }, [games]);

  // Media upload error notification listener
  useEffect(() => {
    const handleUploadError = (e: any) => {
      const detail = e.detail;
      if (detail) {
        triggerAlert(
          "⚠️ Alerta de Falha de Upload / Indexação",
          `Ocorreu uma falha ao enviar ${detail.failedCount} de ${detail.totalCount} mídias para "${detail.gameName}". As imagens enviadas com sucesso foram mantidas no cache. Clique em 'Reindexar Cache' nas configurações ou no diário para tentar recuperá-las.`
        );
      }
    };
    window.addEventListener("media_upload_error", handleUploadError);
    return () => window.removeEventListener("media_upload_error", handleUploadError);
  }, [triggerAlert]);

  const handleRepairAllMedias = async () => {
    setIsSaving(true);
    try {
      // Step 1: Deduplicate and sanitize
      const { sanitizedGames, deduplicatedCount } = deduplicateAndSanitizeGameMedias(games);
      
      // Step 2: Repair page links to direct image URLs
      const { repairedGames, repairedCount } = await repairAllGameMedias(sanitizedGames);

      const totalFixed = deduplicatedCount + repairedCount;

      if (totalFixed > 0) {
        setGames(repairedGames);
        if (isFirebaseConfigured()) {
          await saveToFirebase(repairedGames, globalTags, globalGenres);
        }
        const msg = [
          deduplicatedCount > 0 ? `• ${deduplicatedCount} mídias duplicadas/inválidas foram removidas.` : "",
          repairedCount > 0 ? `• ${repairedCount} link(s) de imagem foram convertidos para URLs diretas.` : "",
        ].filter(Boolean).join("\n");

        triggerAlert("Mídias Limpas e Corrigidas!", msg);
      } else {
        triggerAlert(
          "Mídias Verificadas",
          "Todas as mídias e imagens da sua biblioteca estão organizadas, sem duplicatas e com links funcionais!"
        );
      }
    } catch (err: any) {
      console.error("Erro ao reparar mídias:", err);
      triggerAlert("Erro na Correção", `Falha ao reparar links de mídias: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Set hasUnsavedChanges when user updates local states
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (hasInitiallySynced.current && !isIncomingFirebaseUpdate.current) {
      setHasUnsavedChanges(true);
    }
  }, [games, globalTags, globalGenres]);

  useEffect(() => {
    const cleanup = initSyncQueueListener(async (item) => {
      if (item.type === "FIREBASE_SAVE") {
        if (!isFirebaseConfigured()) return false;
        try {
          await saveToFirebase(
            item.payload.games,
            item.payload.globalTags,
            item.payload.globalGenres
          );
          return true;
        } catch (err) {
          console.error("[SyncQueue] Erro ao re-tentar salvamento no Firebase:", err);
          return false;
        }
      }
      return false;
    });
    return () => cleanup();
  }, []);

  // Handle auto-save to Firebase and conditional sync completion
  useEffect(() => {
    if (isFirebaseConfigured() && hasInitiallySynced.current && !isIncomingFirebaseUpdate.current) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        addToSyncQueue({
          type: "FIREBASE_SAVE",
          payload: { games, globalTags, globalGenres },
          lastError: "Sem conexão com a internet (offline).",
        });
        return;
      }

      saveToFirebase(games, globalTags, globalGenres)
        .then(() => {
          if (!hasBase64Images(games)) {
            setHasUnsavedChanges(false);
          }
        })
        .catch((err) => {
          console.error("Erro ao salvar no Firebase. Adicionando à fila de sincronização:", err);
          addToSyncQueue({
            type: "FIREBASE_SAVE",
            payload: { games, globalTags, globalGenres },
            lastError: err?.message || String(err),
          });
        });
    }
  }, [games, globalTags, globalGenres]);

  // Page unload backup safety and warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Ensure local storage is updated safely on page leave
      try {
        persistGameLibrary(games);
        safeSetLocalStorage("globalTagsList", JSON.stringify(globalTags));
        safeSetLocalStorage("globalGenresList", JSON.stringify(globalGenres));
        safeSetLocalStorage("globalCover", coverImage);
      } catch (err) {
        console.warn("Aviso ao salvar dados ao descarregar página:", err);
      }

      if (isFirebaseConfigured() && hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "Você tem alterações ou imagens pendentes que ainda não foram sincronizadas na nuvem. Deseja mesmo sair?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges, games, globalTags, globalGenres, coverImage]);

  // Distinct platform options inside games list sorted alphabetically
  const platformOptions = useMemo(() => {
    const platforms = games.flatMap((g) => splitEntities(g.platform)).filter(Boolean);
    const unique = Array.from(new Set(platforms)).map(String).sort((a, b) => a.localeCompare(b, "pt", { sensitivity: "base" }));
    return ["All", ...unique];
  }, [games]);

  // Distinct publisher options inside games list sorted alphabetically
  const publisherOptions = useMemo(() => {
    const publishers = games.flatMap((g) => splitEntities(g.publisher)).filter(Boolean);
    const unique = Array.from(new Set(publishers)).map(String).sort((a, b) => a.localeCompare(b, "pt", { sensitivity: "base" }));
    return ["All", ...unique];
  }, [games]);

  // Distinct series options inside games list sorted alphabetically
  const seriesOptions = useMemo(() => {
    const seriesList = games.flatMap((g) => splitEntities(g.series)).filter(Boolean);
    const unique = Array.from(new Set(seriesList)).map(String).sort((a, b) => a.localeCompare(b, "pt", { sensitivity: "base" }));
    return ["All", ...unique];
  }, [games]);

  // Distinct tag options inside games list sorted alphabetically
  const tagOptions = useMemo(() => {
    const tags = games.flatMap((g) => g.tags || []).filter(Boolean);
    const unique = Array.from(new Set(tags)).sort((a, b) => (a as string).localeCompare(b as string, "pt", { sensitivity: "base" }));
    return ["All", ...unique];
  }, [games]);

  // Actions
  const handleRandomCover = () => {
    const covers = games.map((g) => g.cover).filter(Boolean);
    const pool = covers.length > 0 ? covers : COVER_BANK;
    
    // Filter out the current cover to guarantee it changes if possible
    const available = pool.filter((c) => c !== coverImage);
    const finalPool = available.length > 0 ? available : pool;
    const randomCover = finalPool[Math.floor(Math.random() * finalPool.length)];
    setCoverImage(randomCover);
  };

  const handleResetData = () => {
    ensureAdmin("restaurar o catálogo", () => {
      triggerConfirm(
        "Restaurar Catálogo",
        "Queres repor a biblioteca de videojogos para as configurações padrão de demonstração? Isso substituirá dados personalizados atuais.",
        () => {
          setGames(SAMPLE_GAMES);
          setGlobalTags(sortAlphabetically(DEFAULT_TAGS));
          setGlobalGenres(sortAlphabetically(DEFAULT_GENRES));
          setCoverImage(COVER_BANK[0]);
          setDetailGameId(null);
          triggerAlert("Restauro Efetuado", "O catálogo foi restaurado com sucesso.");
        }
      );
    });
  };

  const handleAddGlobalTag = (newTag: string) => {
    if (!globalTags.includes(newTag)) {
      setGlobalTags((prev) => sortAlphabetically([...prev, newTag]));
    }
  };

  const handleAddGlobalGenre = (newGenre: string) => {
    if (!globalGenres.includes(newGenre)) {
      setGlobalGenres((prev) => sortAlphabetically([...prev, newGenre]));
    }
  };

  const handleDeleteGlobalTag = (tagToDelete: string) => {
    ensureAdmin("excluir esta tag permanentemente", () => {
      triggerConfirm(
        "Excluir Tag Global",
        `Tem certeza que deseja remover a tag "${tagToDelete}" de todo o sistema? Ela também será removida de todos os jogos que a possuem.`,
        () => {
          setGlobalTags((prev) => sortAlphabetically(prev.filter((t) => t !== tagToDelete)));
          setGames((prev) =>
            prev.map((g) => ({
              ...g,
              tags: g.tags ? g.tags.filter((t) => t !== tagToDelete) : []
            }))
          );
          triggerAlert("Excluída", `A tag "${tagToDelete}" foi removida.`);
        }
      );
    });
  };

  const handleDeleteGlobalGenre = (genreToDelete: string) => {
    ensureAdmin("excluir este gênero permanentemente", () => {
      triggerConfirm(
        "Excluir Gênero Global",
        `Tem certeza que deseja remover o gênero "${genreToDelete}" de todo o sistema? Ele também será removido de todos os jogos que o possuem.`,
        () => {
          setGlobalGenres((prev) => sortAlphabetically(prev.filter((g) => g !== genreToDelete)));
          setGames((prev) =>
            prev.map((g) => ({
              ...g,
              genre: g.genre ? g.genre.filter((gen) => gen !== genreToDelete) : []
            }))
          );
          triggerAlert("Excluído", `O gênero "${genreToDelete}" foi removido.`);
        }
      );
    });
  };

  const handleEditGlobalTag = (oldTag: string, newTag: string) => {
    if (!newTag || newTag.trim() === "" || oldTag === newTag) return;
    ensureAdmin("editar esta tag permanentemente", () => {
      setGlobalTags((prev) => {
        const filtered = prev.filter((t) => t !== oldTag);
        if (filtered.includes(newTag)) return sortAlphabetically(filtered);
        return sortAlphabetically([...filtered, newTag]);
      });
      setGames((prev) =>
        prev.map((g) => {
          if (g.tags && g.tags.includes(oldTag)) {
            const updatedTags = g.tags.map((t) => (t === oldTag ? newTag : t));
            return {
              ...g,
              tags: Array.from(new Set(updatedTags))
            };
          }
          return g;
        })
      );
      triggerAlert("Editada", `A tag "${oldTag}" foi renomeada para "${newTag}".`);
    });
  };

  const handleEditGlobalGenre = (oldGenre: string, newGenre: string) => {
    if (!newGenre || newGenre.trim() === "" || oldGenre === newGenre) return;
    ensureAdmin("editar este gênero permanentemente", () => {
      setGlobalGenres((prev) => {
        const filtered = prev.filter((g) => g !== oldGenre);
        if (filtered.includes(newGenre)) return sortAlphabetically(filtered);
        return sortAlphabetically([...filtered, newGenre]);
      });
      setGames((prev) =>
        prev.map((g) => {
          if (g.genre && g.genre.includes(oldGenre)) {
            const updatedGenres = g.genre.map((gen) => (gen === oldGenre ? newGenre : gen));
            return {
              ...g,
              genre: Array.from(new Set(updatedGenres))
            };
          }
          return g;
        })
      );
      triggerAlert("Editado", `O gênero "${oldGenre}" foi renomeado para "${newGenre}".`);
    });
  };

  const handleOpenAddForm = () => {
    ensureAdmin("adicionar um novo jogo", () => {
      setEditGame(null);
      setIsFormOpen(true);
    });
  };

  const handleOpenEditForm = useCallback((game: Game) => {
    ensureAdmin("editar este jogo", () => {
      setEditGame(game);
      setIsFormOpen(true);
    });
  }, [isAdmin]);

  const handleUpdateGame = useCallback((updatedGame: Game) => {
    if (!isAdmin) {
      triggerAlert("Modo Admin Necessário", "É necessário ativar o Modo Admin (Editor) para realizar alterações de dados.");
      return;
    }
    console.log(`[handleUpdateGame] Jogo atualizado: "${updatedGame.name}" (ID: ${updatedGame.id})`);
    setGames((prev) => prev.map((g) => (g.id === updatedGame.id ? updatedGame : g)));
  }, [isAdmin]);

  // Create or Update
  const handleSaveGame = (
    gameData: Omit<Game, "id" | "diary"> & { id?: string; diary?: DiaryEntry[] }
  ) => {
    if (!isAdmin) {
      triggerAlert("Modo Admin Necessário", "É necessário ativar o Modo Admin (Editor) para salvar dados.");
      return;
    }
    // Sanitize and convert numeric fields safely
    const parseNumber = (val: any): number | undefined => {
      if (val === undefined || val === null) return undefined;
      if (typeof val === "number") return isNaN(val) ? undefined : val;
      if (typeof val === "string") {
        const cleaned = val.replace(",", ".").trim();
        if (cleaned === "") return undefined;
        const parsed = Number(cleaned);
        return isNaN(parsed) ? undefined : parsed;
      }
      return undefined;
    };

    const sanitizedRating = parseNumber(gameData.rating) ?? 0;
    const sanitizedPricePaid = parseNumber(gameData.pricePaid);
    const sanitizedReplayCount = parseNumber(gameData.replayCount);
    const sanitizedCoverPosition = parseNumber(gameData.coverPosition);
    const sanitizedCoverPositionX = parseNumber(gameData.coverPositionX);
    const sanitizedCoverZoom = parseNumber(gameData.coverZoom);

    const sanitizedGameData = {
      ...gameData,
      rating: Math.min(5, Math.max(0, sanitizedRating)),
      pricePaid: sanitizedPricePaid,
      replayCount: sanitizedReplayCount,
      coverPosition: sanitizedCoverPosition,
      coverPositionX: sanitizedCoverPositionX,
      coverZoom: sanitizedCoverZoom,
      playtime: typeof gameData.playtime === "string" ? gameData.playtime.trim() || "00h 00m" : "00h 00m",
      additionalPlaytime: typeof gameData.additionalPlaytime === "string" ? gameData.additionalPlaytime.trim() : "",
    };

    if (sanitizedGameData.id) {
      // Edit mode
      setGames((prev) => prev.map((g) => (g.id === sanitizedGameData.id ? ({ ...g, ...sanitizedGameData } as Game) : g)));
      console.log(`[handleSaveGame] Jogo editado com sucesso: "${sanitizedGameData.name}" (ID: ${sanitizedGameData.id})`);
    } else {
      // Add mode
      const newGame: Game = {
        ...sanitizedGameData,
        id: "game-" + Date.now(),
        diary: sanitizedGameData.diary || []
      } as Game;
      setGames((prev) => [newGame, ...prev]);
      console.log(`[handleSaveGame] Novo jogo criado: "${newGame.name}" (ID: ${newGame.id})`);
    }

    setIsFormOpen(false);
    setEditGame(null);
  };

  const handleBulkAddGames = (
    gamesList: Array<Omit<Game, "id" | "diary"> & { id?: string; diary?: DiaryEntry[] }>
  ) => {
    if (!isAdmin) {
      triggerAlert("Modo Admin Necessário", "É necessário ativar o Modo Admin (Editor) para adicionar jogos em lote.");
      return;
    }
    if (!gamesList || gamesList.length === 0) return;

    const baseTimestamp = Date.now();
    const createdGames: Game[] = gamesList.map((gameData, idx) => ({
      ...gameData,
      id: `game-${baseTimestamp}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      diary: gameData.diary || [],
      rating: Math.min(5, Math.max(0, gameData.rating || 0)),
      playtime: typeof gameData.playtime === "string" ? gameData.playtime.trim() || "00h 00m" : "00h 00m",
      additionalPlaytime: typeof gameData.additionalPlaytime === "string" ? gameData.additionalPlaytime.trim() : "",
      status: gameData.status && gameData.status.length > 0 ? gameData.status : ["Quero Jogar"],
      genre: gameData.genre && gameData.genre.length > 0 ? gameData.genre : ["Ação"],
    } as Game));

    setGames((prev) => [...createdGames, ...prev]);
    setHasUnsavedChanges(true);
    setIsFormOpen(false);
    setEditGame(null);
    triggerAlert(
      "Importação em Lote Concluída!",
      `Sucesso! ${createdGames.length} ${createdGames.length === 1 ? "jogo foi adicionado" : "jogos foram adicionados"} à sua biblioteca a partir do IGDB.`
    );
  };

  const handleDeleteGame = (gameId: string) => {
    ensureAdmin("excluir este jogo", () => {
      triggerConfirm(
        "Excluir Jogo",
        "Tem certeza que deseja mover este jogo para a Lixeira?",
        () => {
          const targetGame = games.find((g) => g.id === gameId);
          if (targetGame) {
            moveToTrash({
              type: "game",
              title: targetGame.name,
              data: targetGame,
              gameId: targetGame.id,
              gameTitle: targetGame.name,
            });
          }

          setGames((prev) => prev.filter((g) => g.id !== gameId));
          setDetailGameId(null);
          showToast({
            title: "Movido para a Lixeira 🗑️",
            message: `"${targetGame?.name || 'Jogo'}" foi enviado para a Lixeira.`,
            type: "info",
          });
        }
      );
    });
  };

  // Diary Actions
  const parsePeriodStartDateForDiary = (period: string): number => {
    try {
      const firstPart = period.split("~")[0].trim();
      const parts = firstPart.split("/");
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day).getTime();
      }
    } catch (err) {
      console.error("Error parsing period date:", err);
    }
    return 0;
  };

  const handleSaveDiaryEntry = (gameId: string, entry: DiaryEntry) => {
    ensureAdmin("salvar entrada no diário", () => {
      setGames((prev) =>
        prev.map((g) => {
          if (g.id === gameId) {
            const diary = g.diary || [];
            const exists = diary.some((d) => d.id === entry.id);
            const updatedDiary = exists
              ? diary.map((d) => (d.id === entry.id ? entry : d))
              : [...diary, entry];
            
            // Sort chronologically ascending (oldest to newest)
            updatedDiary.sort((a, b) => parsePeriodStartDateForDiary(a.period) - parsePeriodStartDateForDiary(b.period));
            
            return { ...g, diary: updatedDiary };
          }
          return g;
        })
      );
    });
  };

  const handleDeleteDiaryEntry = (gameId: string, entryId: string) => {
    ensureAdmin("remover entrada do diário", () => {
      const targetGame = games.find((g) => g.id === gameId);
      if (targetGame && targetGame.diary) {
        const targetEntry = targetGame.diary.find((d) => d.id === entryId);
        if (targetEntry) {
          moveToTrash({
            type: "diary_entry",
            title: `Registro ${targetEntry.period || "Sem Data"}`,
            data: targetEntry,
            gameId: targetGame.id,
            gameTitle: targetGame.name,
          });
        }
      }

      setGames((prev) =>
        prev.map((g) => {
          if (g.id === gameId) {
            const updatedDiary = (g.diary || []).filter((d) => d.id !== entryId);
            return { ...g, diary: updatedDiary };
          }
          return g;
        })
      );

      showToast({
        title: "Movido para a Lixeira 🗑️",
        message: "A entrada do diário foi enviada para a Lixeira.",
        type: "info",
      });
    });
  };

  const handleDeleteMultipleDiaryEntries = (gameId: string, entryIds: string[]) => {
    ensureAdmin("remover entradas do diário", () => {
      const entryIdsSet = new Set(entryIds);
      const targetGame = games.find((g) => g.id === gameId);
      if (targetGame && targetGame.diary) {
        targetGame.diary.forEach((entry) => {
          if (entryIdsSet.has(entry.id)) {
            moveToTrash({
              type: "diary_entry",
              title: `Registro ${entry.period || "Sem Data"}`,
              data: entry,
              gameId: targetGame.id,
              gameTitle: targetGame.name,
            });
          }
        });
      }

      setGames((prev) =>
        prev.map((g) => {
          if (g.id === gameId) {
            const updatedDiary = (g.diary || []).filter((d) => !entryIdsSet.has(d.id));
            return { ...g, diary: updatedDiary };
          }
          return g;
        })
      );

      showToast({
        title: "Movido para a Lixeira 🗑️",
        message: `${entryIds.length} entrada(s) movida(s) para a Lixeira.`,
        type: "info",
      });
    });
  };

  // Helper selectors & memoized handlers for high-performance rendering
  const activeGameDetail = useMemo(() => {
    return games.find((g) => g.id === detailGameId) || null;
  }, [games, detailGameId]);

  const handleSelectGameCard = useCallback((gameId: string) => {
    setDetailGameId(gameId);
  }, []);

  const handleOpenZoomForGame = useCallback((src: string, customAllImages?: string[], customTitle?: string) => {
    setGlobalZoomImage({
      src,
      allImages: customAllImages,
      title: customTitle,
    });
  }, []);

  const handleEstimateForGame = useCallback((game: Game) => {
    setEstimateGameModal(game);
  }, []);

  // Sorting & Filtering Algorithm
  const filteredGames = useMemo(() => {
    let result = games.filter((game) => {
      // Filter by active tab (status matches)
      const gameStatusList = Array.isArray(game.status) ? game.status : typeof game.status === "string" ? [game.status] : [];
      const matchesTab = activeTab === "Todos" || gameStatusList.includes(activeTab);

      // Filter by Search Input (matches title, series, publisher, studio, developer, genres or tags)
      const matchesSearch =
        searchTerm.trim() === "" ||
        [
          game.name,
          game.series,
          game.publisher,
          game.studio || "",
          game.developer || "",
          ...game.genre,
          ...game.tags
        ]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm.toLowerCase().trim());

      // Filter by platform dropdown
      const matchesPlatform = platformFilter === "All" || splitEntities(game.platform || "PC").includes(platformFilter);
      const matchesPublisher = publisherFilter === "All" || splitEntities(game.publisher).includes(publisherFilter);
      const matchesSeries = seriesFilter === "All" || splitEntities(game.series).includes(seriesFilter);
      const matchesTag = tagFilter === "All" || (game.tags && game.tags.includes(tagFilter));

      return matchesTab && matchesSearch && matchesPlatform && matchesPublisher && matchesSeries && matchesTag;
    });

    // Custom sorting priority if "Todos" is selected
    const statusSortRank = (game: Game) => {
      const order: Record<string, number> = {
        Jogando: 1,
        "Em Hiatus": 2,
        Terminado: 3,
        Backlog: 4,
        Desistido: 5
      };
      const gameStatusList = Array.isArray(game.status) ? game.status : typeof game.status === "string" ? [game.status] : [];
      const minVal = Math.min(...gameStatusList.map((s) => order[s] || 99));
      return isFinite(minVal) ? minVal : 99;
    };

    result = result.sort((a, b) => {
      if (activeTab === "Todos") {
        const diff = statusSortRank(a) - statusSortRank(b);
        if (diff !== 0) return diff;
      }
      return a.name.localeCompare(b.name, "pt-PT", { sensitivity: "base" });
    });

    return result;
  }, [games, activeTab, searchTerm, platformFilter, publisherFilter, seriesFilter, tagFilter]);

  // Infinite scroll effect
  useEffect(() => {
    let ticking = false;
    const handleInfiniteScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const threshold = 350; // px
        const isNearBottom =
          window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - threshold;

        if (isNearBottom) {
          setVisibleCount((prev) => (prev < filteredGames.length ? prev + 9 : prev));
        }
        ticking = false;
      });
    };

    window.addEventListener("scroll", handleInfiniteScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleInfiniteScroll);
  }, [filteredGames.length]);

  // Reset or adjust visibleCount on filter change so we don't start with excessive cards but keep session storage working
  useEffect(() => {
    // When filters change, we can reset the view slightly, but let's keep it user-friendly.
    // If the filtered games count is smaller than current visibleCount, that's fine.
  }, [activeTab, searchTerm, platformFilter, publisherFilter, seriesFilter, tagFilter]);

  // Find game for cover image to use its custom position if available
  const matchedGameForCover = games.find((g) => g.cover === coverImage);
  const bannerPositionStyle: React.CSSProperties = {
    objectPosition: `${bannerX}% ${bannerY}%`,
    transformOrigin: `${bannerX}% ${bannerY}%`,
    transform: `scale(${bannerZoom / 100})`,
    transition: isRepositioning ? "none" : "transform 0.3s ease-out",
  };

  return (
    <div className="min-h-screen relative bg-[#040406] text-[#f3f4f6] font-sans">
      {/* Background Matrix Grid */}
      <div className="fixed inset-0 pointer-events-none grid-bg opacity-[0.035]" />

      {/* Hero Banner Cover */}
      <div 
        ref={bannerRef}
        onMouseDown={handleBannerMouseDown}
        onMouseMove={handleBannerMouseMove}
        onMouseUp={handleBannerMouseUpOrLeave}
        onMouseLeave={handleBannerMouseUpOrLeave}
        onTouchStart={handleBannerTouchStart}
        onTouchMove={handleBannerTouchMove}
        onTouchEnd={handleBannerMouseUpOrLeave}
        className={`relative w-full h-48 md:h-72 overflow-hidden shadow-2xl border-b border-purple-500/20 ${isRepositioning ? "cursor-move select-none" : ""}`}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-purple-950/40 via-[#040406]/60 to-cyan-950/40 z-10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-[#040406] z-15 pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.04] z-10 bg-[linear-gradient(to_right,#06b6d4_1px,transparent_1px),linear-gradient(to_bottom,#06b6d4_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        
        {isRepositioning && (
          <div className="absolute inset-x-0 top-4 z-20 flex justify-center pointer-events-none">
            <span className="bg-black/90 text-cyan-400 border border-cyan-500/30 text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full backdrop-blur-md shadow-lg font-bold animate-pulse">
              Modo Reposicionar: Arraste para Mover • Scroll para Zoom
            </span>
          </div>
        )}

        {showSavedNotification && (
          <div className="absolute top-4 left-4 z-30 flex items-center gap-1.5 bg-emerald-500/95 text-white font-black text-[10px] uppercase tracking-widest px-2.5 py-1.5 rounded-lg border border-emerald-400/40 shadow-lg backdrop-blur-md animate-fade-in">
            <CheckCircle2 size={11} className="text-white" />
            Salvo
          </div>
        )}

        <img
          id="page-cover"
          className="w-full h-full object-cover transform transition-all duration-300 pointer-events-none origin-center select-none"
          style={bannerPositionStyle}
          src={coverImage}
          alt="Gaming Banner"
          referrerPolicy="no-referrer"
          onError={(e: any) => {
            (e.target as HTMLImageElement).src = COVER_BANK[0];
          }}
        />

        <div className="absolute bottom-6 right-6 z-20 flex items-center gap-2">
          {isAdmin && isRepositioning ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setBannerX(50);
                  setBannerY(30);
                  setBannerZoom(100);
                }}
                className="bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 backdrop-blur-md text-[10px] uppercase tracking-wider font-extrabold px-3 py-1.5 rounded-lg border border-zinc-700/50 shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw size={12} />
                Restaurar Padrão
              </button>
              <button
                onClick={() => {
                  setIsRepositioning(false);
                  if (matchedGameForCover) {
                    const updatedGames = games.map((g) =>
                      g.id === matchedGameForCover.id ? { 
                       ...g, 
                        coverPosition: bannerY,
                        coverPositionX: bannerX,
                        coverZoom: bannerZoom
                      } : g
                    );
                    setGames(updatedGames);
                  }
                  localStorage.setItem(`bannerPosition_${coverImage}`, bannerY.toString());
                  localStorage.setItem(`bannerPositionX_${coverImage}`, bannerX.toString());
                  localStorage.setItem(`bannerZoom_${coverImage}`, bannerZoom.toString());
                  setShowSavedNotification(true);
                  setTimeout(() => {
                    setShowSavedNotification(false);
                  }, 2500);
                }}
                className="bg-emerald-500 hover:bg-emerald-600 text-white backdrop-blur-md text-[10px] uppercase tracking-wider font-extrabold px-3 py-1.5 rounded-lg border border-emerald-400/30 shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 size={12} />
                Salvar Posição
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleRandomCover}
                className="w-8 h-8 rounded-lg bg-black/60 hover:bg-black/85 text-zinc-300 hover:text-cyan-400 border border-zinc-800/80 font-black text-sm flex items-center justify-center transition-all cursor-pointer shadow-lg"
                title="Alterar Capa Aleatória"
              >
                <Image size={12} />
              </button>
              {isAdmin && (
                <button
                  onClick={() => setIsRepositioning(true)}
                  className="w-8 h-8 rounded-lg bg-black/60 hover:bg-black/85 text-zinc-300 hover:text-cyan-400 border border-zinc-800/80 font-black text-sm flex items-center justify-center transition-all cursor-pointer shadow-lg"
                  title="Reposicionar Banner"
                >
                  <Move size={12} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pb-24 relative z-20 pt-8">
        
        {/* Title Banner Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-orbitron tracking-wider text-transparent bg-gradient-to-r from-cyan-400 via-white to-purple-400 bg-clip-text uppercase">
              Biblioteca do Haleck
            </h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {/* Database / Synchronization Status Badge (Network Icon Only) */}
              {!isFirebaseConfigured() ? (
                <span 
                  className="inline-flex items-center justify-center px-2.5 py-1.5 rounded-full bg-red-950/50 text-red-400 border border-red-500/40 shadow-sm shadow-red-950/20"
                  title="Servidor Desconectado (Modo Local Offline)"
                >
                  <WifiOff size={13} className="text-red-400" />
                </span>
              ) : hasUnsavedChanges ? (
                <span 
                  className="inline-flex items-center justify-center px-2.5 py-1.5 rounded-full bg-red-950/50 text-red-400 border border-red-500/40 shadow-sm shadow-red-950/20 animate-pulse"
                  title="Servidor Desconectado / Pendente de Sincronização (Clique em Salvar)"
                >
                  <WifiOff size={13} className="text-red-400" />
                </span>
              ) : (
                <span 
                  className="inline-flex items-center justify-center px-2.5 py-1.5 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-950/20"
                  title="Servidor Conectado & Sincronizado"
                >
                  <Wifi size={13} className="text-emerald-400" />
                </span>
              )}

              {/* Mode Identifier Badge (Leitor / Editor) */}
              {isAdmin ? (
                <button
                  onClick={() => {
                    setIsAdmin(false);
                    sessionStorage.removeItem("admin_unlocked");
                    triggerAlert("Sessão Encerrada", "Você voltou para o modo Leitor.");
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-300 bg-amber-950/60 hover:bg-amber-900/60 px-3.5 py-1.5 rounded-full border border-amber-500/40 shadow-sm shadow-amber-950/20 cursor-pointer transition-all"
                  title="Modo Editor ativo. Clique para bloquear e voltar ao modo Leitor."
                >
                  <Unlock size={11} className="text-amber-400" />
                  <span>Editor</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    ensureAdmin("liberar o modo de edição", () => {
                      triggerAlert("Modo Editor Ativo", "Você agora tem permissões de Editor!");
                    });
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold text-sky-400 bg-blue-950/60 hover:bg-blue-900/60 px-3.5 py-1.5 rounded-full border border-blue-500/40 shadow-sm shadow-blue-950/20 cursor-pointer transition-all"
                  title="Modo Leitor. Clique para inserir a senha do Editor."
                >
                  <Lock size={11} className="text-sky-400" />
                  <span>Leitor</span>
                </button>
              )}

              {/* Google Drive Visual Connection Indicator */}
              {isDriveConnected ? (
                <span 
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold text-sky-400 bg-blue-950/60 px-3.5 py-1.5 rounded-full border border-blue-500/40 shadow-sm shadow-blue-950/30"
                  title="GDrive Conectado: Seus backups de mídias e metadados estão sincronizados no Google Drive."
                >
                  <HardDrive size={12} className="text-sky-400 animate-pulse" />
                  <span>GDrive</span>
                </span>
              ) : (
                <span 
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 bg-zinc-900/40 px-3.5 py-1.5 rounded-full border border-zinc-800/40 shadow-sm opacity-60 grayscale"
                  title="GDrive Desconectado. Você pode conectar no menu de Configurações (engrenagem) ou ao Clicar em Salvar."
                >
                  <HardDrive size={12} className="text-zinc-500 grayscale" />
                  <span>GDrive</span>
                </span>
              )}

              {/* Steam Persona Real-Time Status Badge */}
              {steamProfile && (
                steamProfile.gameextrainfo ? (
                  <a
                    href={steamProfile.profileurl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-extrabold text-emerald-300 bg-emerald-950/70 hover:bg-emerald-900/80 px-3.5 py-1.5 rounded-full border border-emerald-500/50 shadow-md shadow-emerald-950/40 transition-all animate-pulse cursor-pointer"
                    title={`Sua conta Steam (${steamProfile.personaname}) está jogando no momento! Clique para abrir perfil.`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                    <Gamepad2 size={13} className="text-emerald-400 shrink-0" />
                    <span>Jogando Agora: <strong className="text-white underline underline-offset-2">{steamProfile.gameextrainfo}</strong></span>
                  </a>
                ) : (
                  <a
                    href={steamProfile.profileurl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-300 bg-blue-950/40 hover:bg-blue-900/50 px-3.5 py-1.5 rounded-full border border-blue-500/30 shadow-sm transition-all cursor-pointer"
                    title={`Steam Profile: ${steamProfile.personaname}`}
                  >
                    {steamProfile.avatar ? (
                      <img src={steamProfile.avatar} alt={steamProfile.personaname} className="w-4 h-4 rounded-full" />
                    ) : (
                      <Gamepad2 size={12} className="text-blue-400" />
                    )}
                    <span>Steam: <strong className="text-zinc-200">{steamProfile.personaname}</strong> ({steamProfile.personastate > 0 ? "Online" : "Offline"})</span>
                  </a>
                )
              )}

              {/* Live Session Header Badge Indicator */}
              <LiveSessionHeaderBadge games={games} />
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center gap-3">
              {isFirebaseConfigured() && (
                <button
                  onClick={handleManualSave}
                  disabled={isSaving && !isDriveConnected}
                  className={`text-sm font-bold px-5 py-3 rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                    hasUnsavedChanges
                      ? "bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-700 hover:to-yellow-600 text-white border border-amber-500/50 shadow-amber-500/10"
                      : "bg-zinc-900/90 hover:bg-zinc-800 text-zinc-100 border border-zinc-700/60 hover:border-cyan-500/50"
                  }`}
                  title={
                    isSaving 
                      ? "Sincronizando..." 
                      : hasUnsavedChanges
                      ? "Alterações pendentes detectadas! Clique para sincronizar agora tudo na nuvem e no Drive"
                      : "Sincronizar e salvar alterações manualmente na nuvem"
                  }
                >
                  <Cloud size={16} className={`${isSaving ? "animate-spin text-white" : hasUnsavedChanges ? "text-white" : "text-cyan-400"}`} />
                  {isSaving ? "Salvando..." : hasUnsavedChanges ? "Salvar Sincronização" : "Salvar"}
                </button>
              )}

              <button
                onClick={handleOpenAddForm}
                className="bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-700 hover:to-cyan-600 text-white text-sm font-bold font-orbitron tracking-wider px-5 py-3 rounded-xl shadow-lg shadow-purple-600/20 hover:shadow-cyan-500/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus size={16} />
                Adicionar Jogo
              </button>

              {/* Site Settings Gear Button in top-right banner */}
              <button
                onClick={() => {
                  ensureAdmin("acessar as configurações do site", () => {
                    setSettingsModalOpen(true);
                  });
                }}
                className="p-3 bg-zinc-900/90 hover:bg-zinc-800 text-cyan-400 hover:text-cyan-300 border border-zinc-700/80 hover:border-cyan-500/50 rounded-xl shadow-lg hover:shadow-cyan-500/20 transition-all flex items-center justify-center cursor-pointer group"
                title="Configurações do Site (Painel Admin)"
              >
                <Settings size={18} className="group-hover:rotate-45 transition-transform duration-300" />
              </button>
            </div>

            {backupStatus && (
              <div className="text-xs text-cyan-400 font-mono animate-pulse flex items-center gap-1.5 self-end">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping" />
                {backupStatus}
              </div>
            )}
          </div>
        </div>

        {/* Primary View Selector Tabs: Biblioteca vs Estatísticas */}
        <div className="flex items-center gap-3 mb-8 border-b border-zinc-800/80 pb-4">
          <button
            onClick={() => setActiveViewMode("library")}
            className={`px-5 py-2.5 rounded-2xl font-orbitron font-bold text-xs sm:text-sm tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeViewMode === "library"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 border border-cyan-400/40"
                : "bg-zinc-900/80 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800"
            }`}
          >
            <Gamepad2 size={16} />
            <span>Biblioteca de Jogos</span>
          </button>

          <button
            onClick={() => setActiveViewMode("dashboard")}
            className={`px-5 py-2.5 rounded-2xl font-orbitron font-bold text-xs sm:text-sm tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeViewMode === "dashboard"
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20 border border-purple-400/40"
                : "bg-zinc-900/80 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800"
            }`}
          >
            <BarChart3 size={16} />
            <span>Estatísticas & Analytics</span>
          </button>
        </div>

        {activeViewMode === "dashboard" ? (
          <DashboardView
            games={games}
            onSelectGame={(id) => setDetailGameId(id)}
            onNavigateToLibraryWithStatus={(status) => {
              setActiveTab(status);
              setActiveViewMode("library");
            }}
            onUpdateGame={handleUpdateGame}
            onOpenRetrospective={() => setIsRetrospectiveOpen(true)}
            isAdmin={isAdmin}
          />
        ) : (
          <>
            {/* Stats Bento Box Grid */}
            <StatsCards games={games} activeTab={activeTab} onTabChange={setActiveTab} />

            {/* Filters Controls */}
            <div className="space-y-4 mb-10">
              <div className="relative w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filtrar por título, série, estúdio, tags, gêneros..."
                    className="w-full pl-11 pr-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm text-zinc-100 placeholder-zinc-500 shadow-sm"
                  />
                  <div className="absolute left-4 top-3.5 text-zinc-400">
                    <Search size={18} />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsGlobalSearchOpen(true)}
                  className="px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-950/90 to-purple-950/90 hover:from-cyan-900/90 hover:to-purple-900/90 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shrink-0 group active:scale-95"
                  title="Abrir Busca Global Integrada (pesquisa diários de bordo, dicionário de estilização, anotações e notas)"
                >
                  <Sparkles size={16} className="text-cyan-400 group-hover:rotate-12 transition-transform" />
                  <span>Busca Global Profunda</span>
                  <kbd className="px-2 py-0.5 rounded bg-cyan-900/60 text-cyan-300 font-mono text-[10px] border border-cyan-500/30 shadow-inner">
                    ⌘K
                  </kbd>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 bg-zinc-950/60 p-3 rounded-2xl border border-zinc-800/60">
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-bold uppercase tracking-wider px-1">
                  <Filter size={14} className="text-cyan-400" />
                  Filtrar por:
                </div>
                
                {/* Platform filter */}
                <select
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm cursor-pointer"
                >
                  <option value="All">Todas as Plataformas</option>
                  {platformOptions
                    .filter((p) => p !== "All")
                    .map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                </select>

                {/* Series filter */}
                <select
                  value={seriesFilter}
                  onChange={(e) => setSeriesFilter(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm cursor-pointer"
                >
                  <option value="All">Todas as Séries / Sagas</option>
                  {seriesOptions
                    .filter((s) => s !== "All")
                    .map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                </select>

                {/* Publisher filter */}
                <select
                  value={publisherFilter}
                  onChange={(e) => setPublisherFilter(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm cursor-pointer"
                >
                  <option value="All">Todas as Publicadoras</option>
                  {publisherOptions
                    .filter((p) => p !== "All")
                    .map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                </select>

                {/* Tag filter */}
                <select
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm cursor-pointer"
                >
                  <option value="All">Todas as Tags</option>
                  {tagOptions
                    .filter((t) => t !== "All")
                    .map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                </select>

                {/* View Mode Switcher: Grid vs Kanban */}
                <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setDashboardViewMode("grid");
                      playRetroSound("click");
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      dashboardViewMode === "grid"
                        ? "bg-purple-600 text-white shadow-md shadow-purple-900/50"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <BarChart3 size={14} />
                    <span>Grade</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDashboardViewMode("kanban");
                      playRetroSound("click");
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      dashboardViewMode === "kanban"
                        ? "bg-purple-600 text-white shadow-md shadow-purple-900/50"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Move size={14} />
                    <span>Kanban</span>
                  </button>
                </div>

                {/* Clean filter helper if any is active */}
                {(platformFilter !== "All" || seriesFilter !== "All" || publisherFilter !== "All" || tagFilter !== "All") && (
                  <button
                    onClick={() => {
                      setPlatformFilter("All");
                      setSeriesFilter("All");
                      setPublisherFilter("All");
                      setTagFilter("All");
                    }}
                    className="text-xs text-red-400 hover:text-red-300 font-bold px-2 py-1 ml-auto transition-colors cursor-pointer"
                  >
                    Limpar Filtros
                  </button>
                )}
              </div>
            </div>

            {/* Games Catalogue View (Grid or Kanban) */}
            {dashboardViewMode === "kanban" ? (
              <KanbanView
                games={filteredGames}
                onSelectGame={(selectedGame) => {
                  const gameId = typeof selectedGame === "string" ? selectedGame : selectedGame?.id;
                  if (gameId) {
                    handleSelectGameCard(gameId);
                  }
                }}
                onUpdateGameStatus={(gameId, newStatusInput) => {
                  const targetGame = games.find((g) => g.id === gameId);
                  if (targetGame) {
                    const primaryStatuses = [
                      "Jogando",
                      "Em Hiatus",
                      "Pausado",
                      "Terminado",
                      "Zerado",
                      "Backlog",
                      "Quero Jogar",
                      "Desistido",
                      "Abandonado",
                    ];

                    const mappedStatus = mapKanbanToStatus(
                      typeof newStatusInput === "string"
                        ? newStatusInput
                        : Array.isArray(newStatusInput)
                        ? newStatusInput[0]
                        : "Jogando"
                    );

                    const currentStatusList = Array.isArray(targetGame.status)
                      ? targetGame.status.filter(Boolean)
                      : typeof targetGame.status === "string" && targetGame.status
                      ? [targetGame.status]
                      : [];

                    const otherStatuses = currentStatusList.filter(
                      (s) => !primaryStatuses.some((p) => p.toLowerCase() === (s || "").toLowerCase())
                    );

                    const updatedStatuses = [mappedStatus, ...otherStatuses];

                    handleUpdateGame({ ...targetGame, status: updatedStatuses });
                    playRetroSound("statusChange");
                  }
                }}
                onOpenGameForm={() => setIsFormOpen(true)}
              />
            ) : (
              <>
                <div 
                  className="grid gap-[clamp(0.875rem,1.5vw,1.5rem)]"
                  style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
                >
                  <AnimatePresence mode="popLayout">
                    {filteredGames.slice(0, visibleCount).map((game) => (
                      <GameCard
                        key={game.id}
                        game={game}
                        onClick={handleSelectGameCard}
                        isAdmin={isAdmin}
                        onUpdateGame={handleUpdateGame}
                        onEditGame={handleOpenEditForm}
                        onOpenGameEstimateModal={handleEstimateForGame}
                        onOpenZoom={handleOpenZoomForGame}
                      />
                    ))}
                  </AnimatePresence>
                </div>

                {/* Loading Indicator for Infinite Scroll */}
                {filteredGames.length > visibleCount && (
                  <div className="flex justify-center items-center py-10">
                    <span className="text-xs text-zinc-500 font-mono flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-ping"></span>
                      Carregando mais jogos...
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Empty State Fallback */}
            {filteredGames.length === 0 && (
              <div className="text-center py-24 glass rounded-3xl border border-dashed border-zinc-800 p-8">
                <p className="text-5xl animate-bounce">👾</p>
                <h3 className="text-xl font-bold text-white mt-4">Nenhum jogo encontrado</h3>
                <p className="text-sm text-zinc-400 mt-2">Ajuste os filtros ou crie uma nova ficha para este jogo!</p>
              </div>
            )}
          </>
        )}

      </div>

      {/* Game Add/Edit Form Modal */}
      <GameFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditGame(null);
        }}
        game={editGame}
        onSave={handleSaveGame}
        onBulkSaveGames={handleBulkAddGames}
        globalTags={globalTags}
        globalGenres={globalGenres}
        onAddGlobalTag={handleAddGlobalTag}
        onAddGlobalGenre={handleAddGlobalGenre}
        onDeleteGlobalTag={handleDeleteGlobalTag}
        onDeleteGlobalGenre={handleDeleteGlobalGenre}
        onEditGlobalTag={handleEditGlobalTag}
        onEditGlobalGenre={handleEditGlobalGenre}
        triggerAlert={triggerAlert}
      />

      {/* Game Detail slide-out Drawer */}
      <GameDetailDrawer
        game={activeGameDetail}
        isOpen={detailGameId !== null}
        onClose={() => {
          setDetailGameId(null);
          setSelectedSearchDiaryId(null);
          setSelectedSearchOpenDictionary(false);
        }}
        onEditClick={handleOpenEditForm}
        onDeleteGame={handleDeleteGame}
        onSaveDiaryEntry={handleSaveDiaryEntry}
        onDeleteDiaryEntry={handleDeleteDiaryEntry}
        onDeleteMultipleDiaryEntries={handleDeleteMultipleDiaryEntries}
        triggerAlert={triggerAlert}
        triggerConfirm={triggerConfirm}
        isAdmin={isAdmin}
        onUpdateGame={handleUpdateGame}
        onOpenGameEstimateModal={(g) => setEstimateGameModal(g)}
        onSendEmailClick={(game) => {
          setGmailTargetGame(game);
          setGmailModalOpen(true);
        }}
        onDeepBackupDrive={handleDeepBackupSingleGameDrive}
        onOpenStorytelling={(g) => setStorytellingGame(g)}
        onOpenSocialCard={(g) => setSocialCardGame(g)}
        onRestoreGame={handleRestoreGameFromTrash}
        initialSelectedDiaryId={selectedSearchDiaryId}
        initialOpenDictionary={selectedSearchOpenDictionary}
      />

      {/* Global Deep Search Modal */}
      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        games={games}
        onSelectResult={(gameId, options) => {
          setSelectedSearchDiaryId(options?.diaryId || null);
          setSelectedSearchOpenDictionary(!!options?.openDictionary);
          setDetailGameId(gameId);
        }}
      />

      {/* Individual Game Estimate Modal */}
      <GameEstimateModal
        isOpen={!!estimateGameModal}
        onClose={() => setEstimateGameModal(null)}
        game={estimateGameModal}
      />

      {/* Custom dialog components */}
      <CustomAlert
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        onClose={() => setAlertState((prev) => ({ ...prev, isOpen: false }))}
      />

      <CustomConfirm
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={() => {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
          confirmState.onConfirm();
        }}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />

      <CustomPasswordPrompt
        isOpen={passwordState.isOpen}
        title={passwordState.title}
        message={passwordState.message}
        onConfirm={() => {
          setPasswordState((prev) => ({ ...prev, isOpen: false }));
          passwordState.onConfirm();
        }}
        onCancel={() => setPasswordState((prev) => ({ ...prev, isOpen: false }))}
      />

      <GmailModal
        isOpen={gmailModalOpen}
        onClose={() => {
          setGmailModalOpen(false);
          setGmailTargetGame(null);
          setIsGmailConnected(isGmailAuthenticated());
        }}
        game={gmailTargetGame}
        gamesListForReport={games}
        triggerAlert={triggerAlert}
      />

      <WelcomeRoleModal
        isOpen={welcomeModalOpen}
        onSelectViewer={handleSelectViewer}
        onSelectEditor={handleSelectEditor}
      />

      <SiteSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        onOpenImgBB={() => setImgBBModalOpen(true)}
        onExitAdmin={() => {
          setIsAdmin(false);
          sessionStorage.removeItem("admin_unlocked");
          triggerAlert("Sessão Encerrada", "Você voltou para o Modo de Leitura.");
        }}
        driveAuthenticated={isDriveConnected}
        onConnectDrive={handleConnectDrive}
        onDisconnectDrive={handleDisconnectDrive}
        gmailUser={isGmailConnected ? "Conta Gmail Conectada" : null}
        onConnectGmail={() => {
          setGmailTargetGame(null);
          setGmailModalOpen(true);
        }}
        onDisconnectGmail={() => {
          setIsGmailConnected(false);
          triggerAlert("Gmail Desconectado", "Sua sessão do Gmail foi desconectada.");
        }}
        onRunDiagnostic={handleRunDiagnostic}
        onOpenTrash={() => setIsTrashOpen(true)}
        games={games}
        onBatchSyncSteam={handleBatchSyncSteam}
        isSyncingSteamBatch={isBatchSyncingSteam}
        onBatchSyncGog={handleBatchSyncGog}
        isSyncingGogBatch={isBatchSyncingGog}
        triggerAlert={triggerAlert}
      />

      {/* Trash / Soft Delete Modal */}
      <TrashModal
        isOpen={isTrashOpen}
        onClose={() => setIsTrashOpen(false)}
        onRestoreGame={handleRestoreGameFromTrash}
        onRestoreDiaryEntry={handleRestoreDiaryEntryFromTrash}
        onRestoreMedia={handleRestoreMediaFromTrash}
      />

      {/* Social Media Card Generator Modal */}
      {socialCardGame && (
        <SocialCardModal
          game={socialCardGame}
          isOpen={!!socialCardGame}
          onClose={() => setSocialCardGame(null)}
        />
      )}

      {/* Storytelling Slides Modal */}
      {storytellingGame && (
        <StorytellingModal
          game={storytellingGame}
          isOpen={!!storytellingGame}
          onClose={() => setStorytellingGame(null)}
        />
      )}

      <SyncDiagnosticModal
        isOpen={isDiagnosticModalOpen}
        onClose={() => setIsDiagnosticModalOpen(false)}
        result={diagnosticResult}
        isLoading={isDiagnosticLoading}
        onReRun={handleRunDiagnostic}
      />

      <CustomDriveConnectPrompt
        isOpen={drivePromptOpen}
        onConnectAndSave={handleConnectDriveAndSave}
        onSaveWithoutDrive={() => {
          setDrivePromptOpen(false);
          executeSave();
        }}
        onCancel={() => setDrivePromptOpen(false)}
      />

      <ImgBBModal
        isOpen={imgBBModalOpen}
        onClose={() => setImgBBModalOpen(false)}
        onRepairMedias={handleRepairAllMedias}
      />

      {/* Global Image Zoom Lightbox */}
      <ImageZoomLightbox
        isOpen={!!globalZoomImage}
        onClose={() => setGlobalZoomImage(null)}
        currentSrc={globalZoomImage?.src || null}
        allImages={globalZoomImage?.allImages}
        onSelectImage={(src) => setGlobalZoomImage((prev) => (prev ? { ...prev, src } : null))}
        title={globalZoomImage?.title}
      />

      {/* Global Custom Tooltip Portal */}
      <GlobalTooltip />

      {/* Floating Live Session Widget */}
      <LiveSessionWidget games={games} onUpdateGame={handleUpdateGame} />

      {/* Gamer Retrospective Modal */}
      {isRetrospectiveOpen && (
        <GamerRetrospectiveModal games={games} onClose={() => setIsRetrospectiveOpen(false)} />
      )}

      {/* Global Upload Progress Widget */}
      <GlobalUploadProgressWidget />

      {/* Global Toast Popup Notifications */}
      <ToastContainer />

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={() => {
            if (detailGameId !== null) {
              const drawerScrollable = document.querySelector(".drawer-scrollable-container");
              if (drawerScrollable) {
                drawerScrollable.scrollTo({ top: 0, behavior: "smooth" });
                return;
              }
            }
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="fixed bottom-6 right-6 z-40 w-10 h-10 rounded-xl bg-zinc-950/90 text-zinc-400 hover:text-cyan-400 hover:bg-zinc-900 border border-zinc-850 flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer animate-fade-in"
          title="Voltar ao Topo"
        >
          <ArrowUp size={20} className="stroke-[2.5]" />
        </button>
      )}
    </div>
  );
}
