/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Game, DiaryEntry, splitEntities } from "./types";
import { SAMPLE_GAMES, DEFAULT_TAGS, DEFAULT_GENRES, COVER_BANK } from "./data";
import StatsCards from "./components/StatsCards";
import GameCard from "./components/GameCard";
import GameFormModal from "./components/GameFormModal";
import GameDetailDrawer from "./components/GameDetailDrawer";
import { CustomAlert, CustomConfirm, CustomPasswordPrompt } from "./components/CustomDialogs";
import { Search, Plus, Filter, Image, Gamepad2, Info, CheckCircle2, Cloud, HardDrive, Lock, Unlock, Mail, Move, ArrowUp, RotateCcw } from "lucide-react";
import { isFirebaseConfigured, syncFromFirebase, saveToFirebase, auth } from "./utils/firebase";
import { uploadToImgBB } from "./utils/imgbb";
import {
  signInWithGoogleDrive,
  isDriveAuthenticated,
  signOutDrive,
  backupLibraryToDrive
} from "./utils/googleDrive";
import GmailModal from "./components/GmailModal";
import { isGmailAuthenticated } from "./utils/gmail";

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

  // Filters State
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

  // Synced local storage effects
  useEffect(() => {
    localStorage.setItem("gameLibrary", JSON.stringify(games));
  }, [games]);

  useEffect(() => {
    localStorage.setItem("globalTagsList", JSON.stringify(globalTags));
  }, [globalTags]);

  useEffect(() => {
    localStorage.setItem("globalGenresList", JSON.stringify(globalGenres));
  }, [globalGenres]);

  useEffect(() => {
    localStorage.setItem("globalCover", coverImage);
  }, [coverImage]);

  // Synchronize and clean up game genres and tags to guarantee uniqueness and no orphans
  useEffect(() => {
    const genresSet = new Set(globalGenres);
    const tagsSet = new Set(globalTags);
    let hasChanged = false;

    const sanitizedGames = games.map((game) => {
      // Keep only unique, non-falsy genres that exist in the global genres list
      const uniqueGenres = Array.from(new Set(game.genre || []))
        .filter((g) => genresSet.has(g));

      // Keep only unique, non-falsy tags that exist in the global tags list
      const uniqueTags = Array.from(new Set(game.tags || []))
        .filter((t) => tagsSet.has(t));

      // Detect difference
      const genresDiff = !game.genre || 
        uniqueGenres.length !== game.genre.length || 
        uniqueGenres.some((val, idx) => val !== game.genre[idx]);

      const tagsDiff = !game.tags || 
        uniqueTags.length !== game.tags.length || 
        uniqueTags.some((val, idx) => val !== game.tags[idx]);

      if (genresDiff || tagsDiff) {
        hasChanged = true;
        return {
          ...game,
          genre: uniqueGenres,
          tags: uniqueTags,
        };
      }
      return game;
    });

    if (hasChanged) {
      setGames(sanitizedGames);
    }
  }, [globalGenres, globalTags, games]);

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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const isFirstMount = useRef(true);

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

  useEffect(() => {
    try {
      sessionStorage.setItem("gameLibraryVisibleCount", visibleCount.toString());
    } catch (e) {
      // ignore
    }
  }, [visibleCount]);

  useEffect(() => {
    const handleScroll = () => {
      if (detailGameId !== null) {
        const drawerScrollable = document.querySelector(".drawer-scrollable-container");
        if (drawerScrollable) {
          setShowScrollTop(drawerScrollable.scrollTop > 300);
          return;
        }
      }
      setShowScrollTop(window.scrollY > 400);
    };

    window.addEventListener("scroll", handleScroll);

    let drawerEl: Element | null = null;
    const interval = setInterval(() => {
      const el = document.querySelector(".drawer-scrollable-container");
      if (el && el !== drawerEl) {
        drawerEl = el;
        el.addEventListener("scroll", handleScroll);
      }
    }, 250);

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
        console.error(err);
        triggerAlert(
          "Erro de Conexão",
          `Não foi possível conectar ao Google Drive: ${err.message || err}`
        );
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
      ensureAdmin("salvar as alterações", executeSave);
    }
  };

  const executeSave = async () => {
    setIsSaving(true);
    setBackupStatus("Preparando envio...");
    
    const abortController = new AbortController();
    backupAbortControllerRef.current = abortController;

    try {
      let gamesUpdated = false;
      const processedGames = await Promise.all(
        games.map(async (game) => {
          let gameUpdated = false;
          let updatedCover = game.cover;
          let updatedIcon = game.icon;

          // Check if cover is base64
          if (game.cover && game.cover.startsWith("data:")) {
            try {
              setBackupStatus(`Enviando capa de ${game.name}...`);
              const res = await uploadToImgBB(game.cover, `${game.name}_cover`);
              updatedCover = res.url;
              gameUpdated = true;
            } catch (err) {
              console.error(`Falha ao carregar a capa do jogo ${game.name} para o ImgBB:`, err);
            }
          }

          // Check if icon is base64 upload
          if (game.icon && game.icon.startsWith("data:") && game.iconType === "upload") {
            try {
              setBackupStatus(`Enviando ícone de ${game.name}...`);
              const res = await uploadToImgBB(game.icon, `${game.name}_icon`);
              updatedIcon = res.url;
              gameUpdated = true;
            } catch (err) {
              console.error(`Falha ao carregar o ícone do jogo ${game.name} para o ImgBB:`, err);
            }
          }

          // Check diary entry media items for base64 data
          const updatedDiary = await Promise.all(
            (game.diary || []).map(async (entry) => {
              let entryUpdated = false;
              const updatedMedias = await Promise.all(
                (entry.medias || []).map(async (media, mediaIdx) => {
                  if (media.src && media.src.startsWith("data:")) {
                    try {
                      setBackupStatus(`Enviando imagem do diário de ${game.name}...`);
                      const res = await uploadToImgBB(media.src, `${game.name}_diario_${mediaIdx + 1}`);
                      entryUpdated = true;
                      return { ...media, src: res.url, deleteUrl: res.deleteUrl };
                    } catch (err) {
                      console.error(`Falha ao carregar imagem do diário do jogo ${game.name} para o ImgBB:`, err);
                    }
                  }
                  return media;
                })
              );

              if (entryUpdated) {
                gameUpdated = true;
                return { ...entry, medias: updatedMedias };
              }
              return entry;
              })
          );

          if (gameUpdated) {
            gamesUpdated = true;
            return {
              ...game,
              cover: updatedCover,
              icon: updatedIcon,
              diary: updatedDiary
            };
          }
          return game;
        })
      );

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
        await backupLibraryToDrive(finalGames, globalTags, globalGenres, (statusMsg) => {
          setBackupStatus(statusMsg);
        }, abortController.signal);
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

  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const unsubscribe = syncFromFirebase((remoteGames, remoteTags, remoteGenres) => {
      isIncomingFirebaseUpdate.current = true;
      
      if (remoteGames.length > 0 || remoteTags.length > 0 || remoteGenres.length > 0) {
        setGames(remoteGames);
        setGlobalTags(sortAlphabetically(remoteTags));
        setGlobalGenres(sortAlphabetically(remoteGenres));
      } else {
        // If Firebase is empty, initialize it with current local/default data
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

  // Handle auto-save to Firebase and conditional sync completion
  useEffect(() => {
    if (isFirebaseConfigured() && hasInitiallySynced.current && !isIncomingFirebaseUpdate.current) {
      saveToFirebase(games, globalTags, globalGenres)
        .then(() => {
          if (!hasBase64Images(games)) {
            setHasUnsavedChanges(false);
          }
        })
        .catch((err) => {
          console.error("Erro ao salvar no Firebase:", err);
        });
    }
  }, [games, globalTags, globalGenres]);

  // Page unload backup safety and warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Ensure local storage is updated synchronously on page leave
      try {
        localStorage.setItem("gameLibrary", JSON.stringify(games));
        localStorage.setItem("globalTagsList", JSON.stringify(globalTags));
        localStorage.setItem("globalGenresList", JSON.stringify(globalGenres));
        localStorage.setItem("globalCover", coverImage);
      } catch (err) {
        console.error("Erro ao salvar dados no localStorage ao descarregar página:", err);
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

  const handleOpenEditForm = (game: Game) => {
    ensureAdmin("editar este jogo", () => {
      setEditGame(game);
      setIsFormOpen(true);
    });
  };

  const handleUpdateGame = (updatedGame: Game) => {
    setGames((prev) =>
      prev.map((g) => (g.id === updatedGame.id ? updatedGame : g))
    );
  };

  // Create or Update
  const handleSaveGame = (
    gameData: Omit<Game, "id" | "diary"> & { id?: string; diary?: DiaryEntry[] }
  ) => {
    if (gameData.id) {
      // Edit mode
      setGames((prev) =>
        prev.map((g) => (g.id === gameData.id ? ({ ...g, ...gameData } as Game) : g))
      );
      // If we are looking at this game's detail, it will automatically update in UI
    } else {
      // Add mode
      const newGame: Game = {
        ...gameData,
        id: "game-" + Date.now(),
        diary: gameData.diary || []
      } as Game;
      setGames((prev) => [newGame, ...prev]);
    }
    setIsFormOpen(false);
    setEditGame(null);
  };

  const handleDeleteGame = (gameId: string) => {
    ensureAdmin("excluir este jogo", () => {
      triggerConfirm(
        "Excluir Jogo",
        "Tem certeza que deseja excluir este jogo permanentemente da biblioteca?",
        () => {
          // Find the game and delete all its diary medias from ImgBB asynchronously
          const targetGame = games.find((g) => g.id === gameId);
          if (targetGame && targetGame.diary) {
            targetGame.diary.forEach((entry) => {
              if (entry.medias) {
                entry.medias.forEach((media) => {
                  if (media.deleteUrl) {
                    fetch("/api/delete-imgbb", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ deleteUrl: media.deleteUrl }),
                    }).catch((err) => console.error("Erro ao deletar mídia do ImgBB ao excluir jogo:", err));
                  }
                });
              }
            });
          }

          setGames((prev) => prev.filter((g) => g.id !== gameId));
          setDetailGameId(null);
          triggerAlert("Excluído", "O jogo foi removido com sucesso.");
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
      // Find the entry and delete its ImgBB medias asynchronously before removing
      const targetGame = games.find((g) => g.id === gameId);
      if (targetGame && targetGame.diary) {
        const targetEntry = targetGame.diary.find((d) => d.id === entryId);
        if (targetEntry && targetEntry.medias) {
          targetEntry.medias.forEach((media) => {
            if (media.deleteUrl) {
              fetch("/api/delete-imgbb", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deleteUrl: media.deleteUrl }),
              }).catch((err) => console.error("Erro ao deletar mídia do ImgBB ao excluir entrada:", err));
            }
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
    });
  };

  // Helper selectors
  const activeGameDetail = useMemo(() => {
    return games.find((g) => g.id === detailGameId) || null;
  }, [games, detailGameId]);

  // Sorting & Filtering Algorithm
  const filteredGames = useMemo(() => {
    let result = games.filter((game) => {
      // Filter by active tab (status matches)
      const matchesTab = activeTab === "Todos" || game.status.includes(activeTab);

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
      const minVal = Math.min(...game.status.map((s) => order[s] || 99));
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
    const handleInfiniteScroll = () => {
      const threshold = 300; // px
      const isNearBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - threshold;

      if (isNearBottom) {
        setVisibleCount((prev) => {
          if (prev < filteredGames.length) {
            return prev + 9;
          }
          return prev;
        });
      }
    };

    window.addEventListener("scroll", handleInfiniteScroll);
    return () => window.removeEventListener("scroll", handleInfiniteScroll);
  }, [filteredGames.length]);

  // Reset or adjust visibleCount on filter change so we don't start with excessive cards but keep session storage working
  useEffect(() => {
    // When filters change, we can reset the view slightly, but let's keep it user-friendly.
    // If the filtered games count is smaller than current visibleCount, that's fine.
  }, [activeTab, searchTerm, platformFilter, publisherFilter, seriesFilter, tagFilter]);

  // Dialog Helpers
  const triggerAlert = (title: string, message: string) => {
    setAlertState({ isOpen: true, title, message });
  };

  // Find game for cover image to use its custom position if available
  const matchedGameForCover = games.find((g) => g.cover === coverImage);
  const bannerPositionStyle: React.CSSProperties = {
    objectPosition: `${bannerX}% ${bannerY}%`,
    transformOrigin: `${bannerX}% ${bannerY}%`,
    transform: `scale(${bannerZoom / 100})`,
    transition: isRepositioning ? "none" : "transform 0.3s ease-out",
  };

  const triggerConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
      }
    });
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
              {isFirebaseConfigured() && (
                isDriveConnected ? (
                  <button
                    onClick={handleDisconnectDrive}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 bg-cyan-950/40 hover:bg-cyan-900/30 px-3.5 py-1.5 rounded-full border border-cyan-800/30 shadow-sm shadow-cyan-950/10 cursor-pointer transition-all"
                    title="Conta Google conectada para backup no Drive e uploads no YouTube. Clique para desconectar."
                  >
                    <HardDrive size={11} className="animate-pulse" />
                    Google Ativo (Drive & YouTube)
                  </button>
                ) : (
                  <button
                    onClick={handleConnectDrive}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 bg-zinc-900/40 hover:bg-zinc-800/50 hover:text-cyan-400 px-3.5 py-1.5 rounded-full border border-zinc-800/30 shadow-sm shadow-zinc-950/10 cursor-pointer transition-all"
                    title="Conectar com a conta Google para fazer backup automático no Drive e upload automatizado de vídeos no YouTube."
                  >
                    <HardDrive size={11} />
                    Conectar Google (Drive/YouTube)
                  </button>
                )
              )}

              {isFirebaseConfigured() && (
                isGmailConnected ? (
                  <button
                    onClick={() => {
                      setGmailTargetGame(null);
                      setGmailModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 bg-cyan-950/40 hover:bg-cyan-900/30 px-3.5 py-1.5 rounded-full border border-cyan-800/30 shadow-sm shadow-cyan-950/10 cursor-pointer transition-all"
                    title="Gmail conectado. Clique para enviar relatórios ou diários."
                  >
                    <Mail size={11} />
                    Gmail Ativo (Enviar Relatório)
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setGmailTargetGame(null);
                      setGmailModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 bg-zinc-900/40 hover:bg-zinc-800/50 hover:text-cyan-400 px-3.5 py-1.5 rounded-full border border-zinc-800/30 shadow-sm shadow-zinc-950/10 cursor-pointer transition-all"
                    title="Conectar com o Gmail para compartilhar relatórios ou diários em HTML."
                  >
                    <Mail size={11} />
                    Conectar Gmail
                  </button>
                )
              )}

              {isAdmin ? (
                <button
                  onClick={() => {
                    setIsAdmin(false);
                    sessionStorage.removeItem("admin_unlocked");
                    triggerAlert("Sessão Encerrada", "Você voltou para o Modo de Leitura.");
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-950/40 hover:bg-red-950/40 hover:text-red-400 px-3.5 py-1.5 rounded-full border border-amber-800/30 shadow-sm shadow-amber-950/10 cursor-pointer transition-all"
                  title="Modo de Edição liberado. Clique para bloquear e voltar ao modo de leitura."
                >
                  <Unlock size={11} />
                  Modo Admin (Ativo)
                </button>
              ) : (
                <button
                  onClick={() => {
                    ensureAdmin("liberar o modo de edição", () => {
                      triggerAlert("Modo Admin Ativo", "Você agora tem permissões de administrador!");
                    });
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 bg-zinc-900/40 hover:bg-zinc-800/50 hover:text-amber-400 px-3.5 py-1.5 rounded-full border border-zinc-800/30 shadow-sm shadow-zinc-950/10 cursor-pointer transition-all"
                  title="Modo de Leitura (Sem edição). Clique para inserir a senha do administrador."
                >
                  <Lock size={11} />
                  Modo Leitura (Bloqueado)
                </button>
              )}

              {/* Database / Synchronization Status Badge */}
              {!isFirebaseConfigured() ? (
                <span 
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-500 bg-amber-950/30 px-3.5 py-1.5 rounded-full border border-amber-500/20 shadow-sm"
                  title="Aviso: Firebase não está configurado nesta versão. Suas alterações são salvas localmente neste navegador/dispositivo."
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Modo Local (Offline)
                </span>
              ) : hasUnsavedChanges ? (
                <span 
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-400 bg-amber-950/40 px-3.5 py-1.5 rounded-full border border-amber-500/30 shadow-sm animate-pulse"
                  title="Você possui alterações locais ou imagens prontas para salvar. Clique em 'Salvar' para sincronizar de forma definitiva!"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  Não Sincronizado
                </span>
              ) : (
                <span 
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 bg-emerald-950/30 px-3.5 py-1.5 rounded-full border border-emerald-500/20 shadow-sm"
                  title="Sincronização Ativa: Todos os seus jogos e mídias estão totalmente salvos na nuvem!"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Sincronizado na Nuvem
                </span>
              )}
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
                className="bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-700 hover:to-cyan-600 text-white text-sm font-bold px-5 py-3 rounded-xl shadow-lg shadow-purple-600/20 hover:shadow-cyan-500/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus size={16} />
                Adicionar Jogo
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

        {/* Stats Bento Box Grid */}
        <StatsCards games={games} activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Filters Controls */}
        <div className="space-y-4 mb-10">
          <div className="relative w-full">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Procurar por título, série, estúdio, tags, gêneros..."
              className="w-full pl-11 pr-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm text-zinc-100 placeholder-zinc-500 shadow-sm"
            />
            <div className="absolute left-4 top-3.5 text-zinc-400">
              <Search size={18} />
            </div>
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

        {/* Games Catalogue Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-6">
          {filteredGames.slice(0, visibleCount).map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onClick={() => setDetailGameId(game.id)}
              isAdmin={isAdmin}
              onUpdateGame={handleUpdateGame}
            />
          ))}
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

        {/* Empty State Fallback */}
        {filteredGames.length === 0 && (
          <div className="text-center py-24 glass rounded-3xl border border-dashed border-zinc-800 p-8">
            <p className="text-5xl animate-bounce">👾</p>
            <h3 className="text-xl font-bold text-white mt-4">Nenhum jogo encontrado</h3>
            <p className="text-sm text-zinc-400 mt-2">Ajuste os filtros ou crie uma nova ficha para este jogo!</p>
          </div>
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
        onClose={() => setDetailGameId(null)}
        onEditClick={handleOpenEditForm}
        onDeleteGame={handleDeleteGame}
        onSaveDiaryEntry={handleSaveDiaryEntry}
        onDeleteDiaryEntry={handleDeleteDiaryEntry}
        triggerAlert={triggerAlert}
        triggerConfirm={triggerConfirm}
        isAdmin={isAdmin}
        onUpdateGame={handleUpdateGame}
        onSendEmailClick={(game) => {
          setGmailTargetGame(game);
          setGmailModalOpen(true);
        }}
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
        onConfirm={confirmState.onConfirm}
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
