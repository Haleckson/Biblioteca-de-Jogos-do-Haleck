/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Game, DiaryEntry } from "./types";
import { SAMPLE_GAMES, DEFAULT_TAGS, DEFAULT_GENRES, COVER_BANK } from "./data";
import StatsCards from "./components/StatsCards";
import GameCard from "./components/GameCard";
import GameFormModal from "./components/GameFormModal";
import GameDetailDrawer from "./components/GameDetailDrawer";
import { CustomAlert, CustomConfirm, CustomPasswordPrompt } from "./components/CustomDialogs";
import { Search, Plus, Filter, Image, Gamepad2, Info, CheckCircle2, Cloud, HardDrive, Lock, Unlock } from "lucide-react";
import { isFirebaseConfigured, syncFromFirebase, saveToFirebase, auth } from "./utils/firebase";
import { uploadToImgBB } from "./utils/imgbb";
import {
  signInWithGoogleDrive,
  isDriveAuthenticated,
  signOutDrive,
  backupLibraryToDrive
} from "./utils/googleDrive";

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
      return sortAlphabetically(list);
    } catch {
      return sortAlphabetically(DEFAULT_TAGS);
    }
  });

  const [globalGenres, setGlobalGenres] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("globalGenresList");
      const list = saved ? JSON.parse(saved) : DEFAULT_GENRES;
      return sortAlphabetically(list);
    } catch {
      return sortAlphabetically(DEFAULT_GENRES);
    }
  });

  const [coverImage, setCoverImage] = useState<string>(() => {
    return localStorage.getItem("globalCover") || COVER_BANK[0];
  });

  // Filters State
  const [activeTab, setActiveTab] = useState<string>("Todos");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [platformFilter, setPlatformFilter] = useState<string>("All");

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

  // Firebase Realtime Synchronization refs and hooks
  const isIncomingFirebaseUpdate = useRef(false);
  const hasInitiallySynced = useRef(!isFirebaseConfigured());
  const [isSaving, setIsSaving] = useState(false);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return sessionStorage.getItem("admin_unlocked") === "true";
  });

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
    ensureAdmin("salvar as alterações", executeSave);
  };

  const executeSave = async () => {
    setIsSaving(true);
    setBackupStatus("Preparando envio...");
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
              updatedCover = await uploadToImgBB(game.cover, `${game.name}_cover`);
              gameUpdated = true;
            } catch (err) {
              console.error(`Falha ao carregar a capa do jogo ${game.name} para o ImgBB:`, err);
            }
          }

          // Check if icon is base64 upload
          if (game.icon && game.icon.startsWith("data:") && game.iconType === "upload") {
            try {
              setBackupStatus(`Enviando ícone de ${game.name}...`);
              updatedIcon = await uploadToImgBB(game.icon, `${game.name}_icon`);
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
                      const uploadedSrc = await uploadToImgBB(media.src, `${game.name}_diario_${mediaIdx + 1}`);
                      entryUpdated = true;
                      return { ...media, src: uploadedSrc };
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

      // Sincronizar mídias e metadados no Google Drive se autenticado
      if (isDriveAuthenticated()) {
        await backupLibraryToDrive(finalGames, globalTags, globalGenres, (statusMsg) => {
          setBackupStatus(statusMsg);
        });
      }

      triggerAlert(
        "Sucesso ao Salvar",
        isDriveAuthenticated()
          ? "Alterações salvas no Firebase e backup de segurança gerado no seu Google Drive com sucesso!"
          : "As alterações e todas as novas imagens foram salvas e enviadas com sucesso em tempo real!"
      );
    } catch (err: any) {
      console.error(err);
      triggerAlert(
        "Erro ao Salvar",
        `Houve um erro ao enviar os dados: ${err.message || err}`
      );
    } finally {
      setIsSaving(false);
      setBackupStatus(null);
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

      setTimeout(() => {
        isIncomingFirebaseUpdate.current = false;
      }, 100);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isFirebaseConfigured() && hasInitiallySynced.current && !isIncomingFirebaseUpdate.current) {
      saveToFirebase(games, globalTags, globalGenres).catch((err) => {
        console.error("Erro ao salvar no Firebase:", err);
      });
    }
  }, [games, globalTags, globalGenres]);

  // Distinct platform options inside games list
  const platformOptions = useMemo(() => {
    const platforms = games.map((g) => g.platform).filter(Boolean);
    return ["All", ...Array.from(new Set(platforms))];
  }, [games]);

  // Actions
  const handleRandomCover = () => {
    ensureAdmin("alterar a imagem de capa", () => {
      const nextIdx = Math.floor(Math.random() * COVER_BANK.length);
      setCoverImage(COVER_BANK[nextIdx]);
    });
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
          setGames((prev) => prev.filter((g) => g.id !== gameId));
          setDetailGameId(null);
          triggerAlert("Excluído", "O jogo foi removido com sucesso.");
        }
      );
    });
  };

  // Diary Actions
  const handleSaveDiaryEntry = (gameId: string, entry: DiaryEntry) => {
    ensureAdmin("salvar entrada no diário", () => {
      setGames((prev) =>
        prev.map((g) => {
          if (g.id === gameId) {
            const diary = g.diary || [];
            const exists = diary.some((d) => d.id === entry.id);
            const updatedDiary = exists
              ? diary.map((d) => (d.id === entry.id ? entry : d))
              : [entry, ...diary];
            return { ...g, diary: updatedDiary };
          }
          return g;
        })
      );
    });
  };

  const handleDeleteDiaryEntry = (gameId: string, entryId: string) => {
    ensureAdmin("remover entrada do diário", () => {
      triggerConfirm(
        "Excluir Entrada",
        "Tem certeza que deseja apagar esta entrada do diário?",
        () => {
          setGames((prev) =>
            prev.map((g) => {
              if (g.id === gameId) {
                const updatedDiary = (g.diary || []).filter((d) => d.id !== entryId);
                return { ...g, diary: updatedDiary };
              }
              return g;
            })
          );
        }
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

      // Filter by Search Input (matches title, series, publisher, genres or tags)
      const matchesSearch =
        searchTerm.trim() === "" ||
        [
          game.name,
          game.series,
          game.publisher,
          ...game.genre,
          ...game.tags
        ]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm.toLowerCase().trim());

      // Filter by platform dropdown
      const matchesPlatform = platformFilter === "All" || game.platform === platformFilter;

      return matchesTab && matchesSearch && matchesPlatform;
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
  }, [games, activeTab, searchTerm, platformFilter]);

  // Dialog Helpers
  const triggerAlert = (title: string, message: string) => {
    setAlertState({ isOpen: true, title, message });
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
      <div className="relative w-full h-48 md:h-72 overflow-hidden shadow-2xl border-b border-purple-500/20">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-950/40 via-[#040406]/60 to-cyan-950/40 z-10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-[#040406] z-15 pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.04] z-10 bg-[linear-gradient(to_right,#06b6d4_1px,transparent_1px),linear-gradient(to_bottom,#06b6d4_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        
        <img
          id="page-cover"
          className="w-full h-full object-cover transform scale-100 transition-all duration-700"
          src={coverImage}
          alt="Gaming Banner"
          referrerPolicy="no-referrer"
          onError={(e: any) => {
            (e.target as HTMLImageElement).src = COVER_BANK[0];
          }}
        />

        <div className="absolute bottom-6 right-6 z-20 flex gap-2">
          <button
            onClick={handleRandomCover}
            className="bg-black/40 hover:bg-black/60 text-cyan-400 backdrop-blur-md text-xs font-semibold px-4 py-2 rounded-xl border border-cyan-500/30 shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Image size={14} />
            Alterar Capa
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 relative z-20 pt-8">
        
        {/* Title Banner Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-orbitron tracking-wider text-transparent bg-gradient-to-r from-cyan-400 via-white to-purple-400 bg-clip-text uppercase">
              Biblioteca do Haleck
            </h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {isFirebaseConfigured() ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-800/30 shadow-sm shadow-emerald-950/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Nuvem Ativa (Realtime DB)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 bg-zinc-900/60 px-2.5 py-1 rounded-full border border-zinc-800/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                  Modo Local (Offline)
                </span>
              )}

              {isFirebaseConfigured() && (
                isDriveConnected ? (
                  <button
                    onClick={handleDisconnectDrive}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-cyan-400 bg-cyan-950/40 hover:bg-cyan-900/30 px-2.5 py-1 rounded-full border border-cyan-800/30 shadow-sm shadow-cyan-950/10 cursor-pointer transition-all"
                    title="Google Drive conectado para backup de segurança. Clique para desconectar."
                  >
                    <HardDrive size={11} className="animate-pulse" />
                    Google Drive Ativo (Backup)
                  </button>
                ) : (
                  <button
                    onClick={handleConnectDrive}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 bg-zinc-900/40 hover:bg-zinc-800/50 hover:text-cyan-400 px-2.5 py-1 rounded-full border border-zinc-800/30 shadow-sm shadow-zinc-950/10 cursor-pointer transition-all"
                    title="Conectar com o Google Drive para fazer backup automático dos dados e mídias."
                  >
                    <HardDrive size={11} />
                    Conectar Google Drive
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
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-400 bg-amber-950/40 hover:bg-red-950/40 hover:text-red-400 px-2.5 py-1 rounded-full border border-amber-800/30 shadow-sm shadow-amber-950/10 cursor-pointer transition-all"
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
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 bg-zinc-900/40 hover:bg-zinc-800/50 hover:text-amber-400 px-2.5 py-1 rounded-full border border-zinc-800/30 shadow-sm shadow-zinc-950/10 cursor-pointer transition-all"
                  title="Modo de Leitura (Sem edição). Clique para inserir a senha do administrador."
                >
                  <Lock size={11} />
                  Modo Leitura (Bloqueado)
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center gap-3">
              {isFirebaseConfigured() && (
                <button
                  onClick={handleManualSave}
                  disabled={isSaving}
                  className="bg-zinc-900/90 hover:bg-zinc-800 text-zinc-100 border border-zinc-700/60 text-sm font-bold px-5 py-3 rounded-xl shadow-lg hover:border-cyan-500/50 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  title="Sincronizar e salvar alterações manualmente na nuvem"
                >
                  <Cloud size={16} className={`${isSaving ? "animate-spin text-cyan-400" : "text-cyan-400"}`} />
                  {isSaving ? "Salvando..." : "Salvar"}
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
        <StatsCards games={games} />

        {/* Active Filters Navigation Tabs */}
        <div className="border-b border-zinc-700/80 mb-8 overflow-x-auto whitespace-nowrap scrollbar-none">
          <nav className="flex space-x-8 text-sm font-bold pb-2">
            {["Todos", "Jogando", "Em Hiatus", "Terminado", "Backlog", "Desistido"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 px-1 border-b-2 text-sm font-bold transition-all cursor-pointer ${
                  activeTab === tab
                    ? "border-cyan-500 text-cyan-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Filters Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-10">
          <div className="relative flex-1">
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
          <div className="flex items-center gap-2">
            <div className="text-zinc-400">
              <Filter size={16} />
            </div>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm font-semibold text-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm cursor-pointer"
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
          </div>
        </div>

        {/* Games Catalogue Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredGames.map((game) => (
            <GameCard key={game.id} game={game} onClick={() => setDetailGameId(game.id)} />
          ))}
        </div>

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
    </div>
  );
}
