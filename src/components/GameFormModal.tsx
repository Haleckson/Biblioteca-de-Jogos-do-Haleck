/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Game, TrophyItem, getDlcMode, getGameTrophyItems, parseProConTopic } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, Image as ImageIcon, Upload, Globe, Smile, Check, CheckCircle, Tag, Loader2, Search, Clock, RefreshCw, RotateCcw, Sparkles, Trophy, Layers, ThumbsUp, ThumbsDown, Infinity, Gamepad2, Calendar, Monitor, ChevronDown, ChevronRight, DollarSign } from "lucide-react";
import { COVER_BANK } from "../data";
import { uploadToImgBB } from "../utils/imgbb";
import { formatHltbTime } from "../utils/hltbFormatter";
import { formatHoursAndMinutes, parsePlaytimeHours } from "../utils/playtime";
import { useBodyScrollLock } from "../lib/bodyScrollLock";
import {
  fetchSteamOwnedGames,
  fetchSteamAchievements,
  formatSteamPlaytime,
  getSteamHeaderImageUrl,
  isPcPlatform,
  SteamOwnedGame,
  SteamAchievementsResult,
} from "../utils/steamApi";
import {
  fetchGogOwnedGames,
  fetchGogAchievements,
  formatGogPlaytime,
  GogOwnedGame,
  GogAchievementsResult,
} from "../utils/gogApi";

interface GameFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: Game | null;
  onSave: (gameData: Omit<Game, "id" | "diary"> & { id?: string; diary?: any[] }) => void;
  globalTags: string[];
  globalGenres: string[];
  onAddGlobalTag: (tag: string) => void;
  onAddGlobalGenre: (genre: string) => void;
  onDeleteGlobalTag?: (tag: string) => void;
  onDeleteGlobalGenre?: (genre: string) => void;
  onEditGlobalTag?: (oldTag: string, newTag: string) => void;
  onEditGlobalGenre?: (oldGenre: string, newGenre: string) => void;
  triggerAlert: (title: string, msg: string) => void;
}

export default function GameFormModal({
  isOpen,
  onClose,
  game,
  onSave,
  globalTags,
  globalGenres,
  onAddGlobalTag,
  onAddGlobalGenre,
  onDeleteGlobalTag,
  onDeleteGlobalGenre,
  onEditGlobalTag,
  onEditGlobalGenre,
  triggerAlert
}: GameFormModalProps) {
  useBodyScrollLock(isOpen);

  // Form fields state
  const [name, setName] = useState("");
  const [series, setSeries] = useState("");
  const [publisher, setPublisher] = useState("");
  const [studio, setStudio] = useState("");
  const [pricePaid, setPricePaid] = useState<string>("");
  const [playtime, setPlaytime] = useState("");
  const [additionalPlaytime, setAdditionalPlaytime] = useState("");
  const [trophy, setTrophy] = useState<"none" | "silver" | "gold" | "platinum">("none");
  const [selectedTrophyItems, setSelectedTrophyItems] = useState<TrophyItem[]>([]);

  const addTrophy = (type: "silver" | "gold" | "platinum") => {
    setSelectedTrophyItems((prev) => [...prev, { type, note: "" }]);
  };

  const removeTrophy = (type: "silver" | "gold" | "platinum") => {
    setSelectedTrophyItems((prev) => {
      const idx = prev.map((t) => t.type).lastIndexOf(type);
      if (idx === -1) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  };

  const updateTrophyNote = (index: number, note: string) => {
    setSelectedTrophyItems((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], note };
      }
      return next;
    });
  };

  const removeTrophyIndex = (index: number) => {
    setSelectedTrophyItems((prev) => prev.filter((_, i) => i !== index));
  };

  const silverCount = selectedTrophyItems.filter((t) => t.type === "silver").length;
  const goldCount = selectedTrophyItems.filter((t) => t.type === "gold").length;
  const platinumCount = selectedTrophyItems.filter((t) => t.type === "platinum").length;
  const [pros, setPros] = useState("");
  const [cons, setCons] = useState("");
  const [replayed, setReplayed] = useState(false);
  const [replayCount, setReplayCount] = useState<number>(0);
  const [replayNote, setReplayNote] = useState("");
  const [isGaaS, setIsGaaS] = useState(false);
  const [dlcMode, setDlcMode] = useState<"none" | "dlc" | "plus_dlc">("none");
  const [dlcNames, setDlcNames] = useState("");
  const [platform, setPlatform] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [rating, setRating] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  const [activeIconTab, setActiveIconTab] = useState<"emoji" | "upload" | "url">("emoji");
  const [iconEmoji, setIconEmoji] = useState("🎮");
  const [tempUploadedIcon, setTempUploadedIcon] = useState("");
  const [iconUrl, setIconUrl] = useState("");

  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Toggle custom creation inputs
  const [showNewGenre, setShowNewGenre] = useState(false);
  const [newGenreVal, setNewGenreVal] = useState("");
  const [showNewTag, setShowNewTag] = useState(false);
  const [newTagVal, setNewTagVal] = useState("");

  const [editingGenre, setEditingGenre] = useState<string | null>(null);
  const [editingGenreValue, setEditingGenreValue] = useState("");
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingTagValue, setEditingTagValue] = useState("");

  // ImgBB Uploaded Image covers/icons
  const [tempUploadedCover, setTempUploadedCover] = useState("");
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [isDragOverIcon, setIsDragOverIcon] = useState(false);
  const [isDragOverCover, setIsDragOverCover] = useState(false);

  // HowLongToBeat States
  const [hltbMain, setHltbMain] = useState("");
  const [hltbExtra, setHltbExtra] = useState("");
  const [hltbCompletionist, setHltbCompletionist] = useState("");
  const [hltbId, setHltbId] = useState("");

  const [isFetchingHltb, setIsFetchingHltb] = useState(false);
  const [hltbUrlInput, setHltbUrlInput] = useState("");
  const [showHltbImport, setShowHltbImport] = useState(false);

  // Metacritic States
  const [metacriticUrl, setMetacriticUrl] = useState("");
  const [metacriticCritScore, setMetacriticCritScore] = useState<number | undefined>(undefined);
  const [metacriticUserScore, setMetacriticUserScore] = useState<number | undefined>(undefined);

  // Replay Prompt Modal States
  const [showReplayPromptModal, setShowReplayPromptModal] = useState(false);
  const [pendingReplayPreviousStatus, setPendingReplayPreviousStatus] = useState<string[]>([]);
  const [autoArchivePlaytime, setAutoArchivePlaytime] = useState(true);

  const [isFetchingMetacritic, setIsFetchingMetacritic] = useState(false);
  const [metacriticUrlInput, setMetacriticUrlInput] = useState("");
  const [showMetacriticImport, setShowMetacriticImport] = useState(false);
  const [metacriticPlatforms, setMetacriticPlatforms] = useState<{ code: string; name: string }[]>([]);
  const [selectedMetacriticPlatform, setSelectedMetacriticPlatform] = useState<string>("");

  // Integration Platform Switcher
  const [integrationPlatform, setIntegrationPlatform] = useState<"none" | "steam" | "gog">("steam");

  // Steam States
  const [steamAppId, setSteamAppId] = useState<number | undefined>(undefined);
  const [steamPlaytimeMinutes, setSteamPlaytimeMinutes] = useState<number | undefined>(undefined);
  const [steamLastPlayedTimestamp, setSteamLastPlayedTimestamp] = useState<number | undefined>(undefined);
  const [steamAchievementsCount, setSteamAchievementsCount] = useState<number | undefined>(undefined);
  const [steamAchievementsTotal, setSteamAchievementsTotal] = useState<number | undefined>(undefined);

  // GOG States
  const [gogGameId, setGogGameId] = useState<number | string | undefined>(undefined);
  const [gogPlaytimeMinutes, setGogPlaytimeMinutes] = useState<number | undefined>(undefined);
  const [gogLastPlayedTimestamp, setGogLastPlayedTimestamp] = useState<number | undefined>(undefined);
  const [gogAchievementsCount, setGogAchievementsCount] = useState<number | undefined>(undefined);
  const [gogAchievementsTotal, setGogAchievementsTotal] = useState<number | undefined>(undefined);

  const [showGogImport, setShowGogImport] = useState(false);
  const [isFetchingGog, setIsFetchingGog] = useState(false);
  const [gogUrlInput, setGogUrlInput] = useState("");
  const [gogUserGamesList, setGogUserGamesList] = useState<GogOwnedGame[]>([]);
  const [isLoadingGogGames, setIsLoadingGogGames] = useState(false);
  const [gogAchieveData, setGogAchieveData] = useState<GogAchievementsResult | null>(null);

  const [isFetchingAIMetadata, setIsFetchingAIMetadata] = useState(false);
  const [gameCandidates, setGameCandidates] = useState<any[]>([]);
  const [isSelectingCandidate, setIsSelectingCandidate] = useState(false);

  // Estado dos blocos colapsáveis (todos iniciam colapsados por padrão)
  const [openBlocks, setOpenBlocks] = useState<Record<string, boolean>>({});
  const [activeBlock, setActiveBlock] = useState<string>("basic");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const chipsBarRef = useRef<HTMLDivElement>(null);

  const handleScrollModal = () => {
    if (!scrollContainerRef.current) return;
    const containerTop = scrollContainerRef.current.getBoundingClientRect().top;
    const blocks = [
      "basic",
      "playtime",
      "trophies",
      "proscons",
      "hltb",
      "dates",
      "platform",
      "status",
      "genres",
      "tags"
    ];

    let currentActive = "basic";
    for (const key of blocks) {
      const el = document.getElementById(`block-${key}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top - containerTop <= 160) {
          currentActive = key;
        }
      }
    }
    setActiveBlock(currentActive);
  };

  useEffect(() => {
    if (!activeBlock || !chipsBarRef.current) return;
    const activeChipEl = chipsBarRef.current.querySelector(`[data-chip-key="${activeBlock}"]`) as HTMLElement;
    if (activeChipEl) {
      activeChipEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [activeBlock]);

  const toggleBlock = (blockKey: string) => {
    setOpenBlocks((prev) => ({
      ...prev,
      [blockKey]: !prev[blockKey],
    }));
  };

  const getCategoryBorderClass = (category: string, isOpen: boolean) => {
    switch (category) {
      case "steam":
        return isOpen
          ? "border-2 border-blue-500/80 shadow-md shadow-blue-500/10"
          : "border-2 border-blue-500/50 hover:border-blue-500/80 shadow-sm shadow-blue-500/5";
      case "metacritic":
        return isOpen
          ? "border-2 border-amber-500/80 shadow-md shadow-amber-500/10"
          : "border-2 border-amber-500/50 hover:border-amber-500/80 shadow-sm shadow-amber-500/5";
      case "hltb":
        return isOpen
          ? "border-2 border-purple-500/80 shadow-md shadow-purple-500/10"
          : "border-2 border-purple-500/50 hover:border-purple-500/80 shadow-sm shadow-purple-500/5";
      case "basic":
        return isOpen
          ? "border-2 border-cyan-500/80 shadow-md shadow-cyan-500/10"
          : "border-2 border-cyan-500/50 hover:border-cyan-500/80 shadow-sm shadow-cyan-500/5";
      case "playtime":
        return isOpen
          ? "border-2 border-teal-500/80 shadow-md shadow-teal-500/10"
          : "border-2 border-teal-500/50 hover:border-teal-500/80 shadow-sm shadow-teal-500/5";
      case "trophies":
        return isOpen
          ? "border-2 border-amber-500/80 shadow-md shadow-amber-500/10"
          : "border-2 border-amber-500/50 hover:border-amber-500/80 shadow-sm shadow-amber-500/5";
      case "replay":
        return isOpen
          ? "border-2 border-purple-500/80 shadow-md shadow-purple-500/10"
          : "border-2 border-purple-500/50 hover:border-purple-500/80 shadow-sm shadow-purple-500/5";
      case "gaas":
        return isOpen
          ? "border-2 border-pink-500/80 shadow-md shadow-pink-500/10"
          : "border-2 border-pink-500/50 hover:border-pink-500/80 shadow-sm shadow-pink-500/5";
      case "dates":
        return isOpen
          ? "border-2 border-sky-500/80 shadow-md shadow-sky-500/10"
          : "border-2 border-sky-500/50 hover:border-sky-500/80 shadow-sm shadow-sky-500/5";
      case "platform":
        return isOpen
          ? "border-2 border-indigo-500/80 shadow-md shadow-indigo-500/10"
          : "border-2 border-indigo-500/50 hover:border-indigo-500/80 shadow-sm shadow-indigo-500/5";
      case "proscons":
        return isOpen
          ? "border-2 border-emerald-500/80 shadow-md shadow-emerald-500/10"
          : "border-2 border-emerald-500/50 hover:border-emerald-500/80 shadow-sm shadow-emerald-500/5";
      case "status":
        return isOpen
          ? "border-2 border-emerald-500/80 shadow-md shadow-emerald-500/10"
          : "border-2 border-emerald-500/50 hover:border-emerald-500/80 shadow-sm shadow-emerald-500/5";
      case "genres":
        return isOpen
          ? "border-2 border-fuchsia-500/80 shadow-md shadow-fuchsia-500/10"
          : "border-2 border-fuchsia-500/50 hover:border-fuchsia-500/80 shadow-sm shadow-fuchsia-500/5";
      case "tags":
        return isOpen
          ? "border-2 border-cyan-500/80 shadow-md shadow-cyan-500/10"
          : "border-2 border-cyan-500/50 hover:border-cyan-500/80 shadow-sm shadow-cyan-500/5";
      case "icon":
        return isOpen
          ? "border-2 border-sky-500/80 shadow-md shadow-sky-500/10"
          : "border-2 border-sky-500/50 hover:border-sky-500/80 shadow-sm shadow-sky-500/5";
      case "cover":
        return isOpen
          ? "border-2 border-rose-500/80 shadow-md shadow-rose-500/10"
          : "border-2 border-rose-500/50 hover:border-rose-500/80 shadow-sm shadow-rose-500/5";
      default:
        return isOpen
          ? "border-2 border-zinc-700 shadow-md"
          : "border-2 border-zinc-800 hover:border-zinc-700";
    }
  };

  const applyGameCandidate = (data: any) => {
    if (data.name) setName(data.name);
    if (data.developer) setStudio(data.developer);
    if (data.publisher) setPublisher(data.publisher);
    if (data.series) setSeries(data.series);
    if (data.releaseDate) setReleaseDate(data.releaseDate);
    if (data.platforms && data.platforms.length > 0) {
      setPlatform(data.platforms.join(", "));
    }

    if (data.metacritic !== undefined && data.metacritic !== null) {
      setMetacriticCritScore(data.metacritic);
    }

    if (data.hltbMain !== undefined && data.hltbMain !== null) {
      setHltbMain(formatHltbTime(data.hltbMain));
    }
    if (data.hltbMainExtra !== undefined && data.hltbMainExtra !== null) {
      setHltbExtra(formatHltbTime(data.hltbMainExtra));
    }
    if (data.hltbCompletionist !== undefined && data.hltbCompletionist !== null) {
      setHltbCompletionist(formatHltbTime(data.hltbCompletionist));
    }

    if (data.coverUrl) {
      setCoverUrl(data.coverUrl);
      setTempUploadedCover(data.coverUrl);
    }

    if (data.iconUrl) {
      setActiveIconTab("url");
      setIconUrl(data.iconUrl);
    }

    if (data.genres && Array.isArray(data.genres)) {
      data.genres.forEach((genreName: string) => {
        const capitalized = genreName.trim();
        if (capitalized) {
          if (!globalGenres.includes(capitalized)) {
            onAddGlobalGenre(capitalized);
          }
          setSelectedGenres((prev) => {
            if (prev.includes(capitalized)) return prev;
            return [...prev, capitalized];
          });
        }
      });
    }
  };

  const handleFetchAIMetadata = async () => {
    const term = name.trim();
    if (!term) {
      triggerAlert("Título Vazio", "Por favor, digite o título do jogo para buscar os metadados com Inteligência Artificial.");
      return;
    }

    setIsFetchingAIMetadata(true);
    try {
      const response = await fetch(`/api/game-metadata?q=${encodeURIComponent(term)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Servidor retornou erro: ${response.status}`);
      }

      const data = await response.json();

      if (data && Array.isArray(data.games)) {
        if (data.games.length === 0) {
          triggerAlert("Sem Resultados", `Não encontramos nenhuma sugestão para "${term}". Por favor, digite o título por extenso.`);
        } else if (data.games.length === 1) {
          applyGameCandidate(data.games[0]);
          triggerAlert("Metadados Carregados!", `Encontramos os detalhes de "${data.games[0].name}" e preenchemos a ficha de jogo com dados de alta qualidade.`);
        } else {
          setGameCandidates(data.games);
          setIsSelectingCandidate(true);
        }
      } else {
        // Fallback for single object response format
        applyGameCandidate(data);
        triggerAlert("Metadados Carregados!", `Encontramos os detalhes de "${data.name || term}" e preenchemos a ficha de jogo com dados de alta qualidade.`);
      }
    } catch (err: any) {
      console.error("Erro ao carregar metadados via IA:", err);
      triggerAlert("Busca por IA indisponível", `Não foi possível carregar os metadados automáticos: ${err.message || err}`);
    } finally {
      setIsFetchingAIMetadata(false);
    }
  };

  const handleLoadHltbUrl = async () => {
    const input = hltbUrlInput.trim();
    if (!input) {
      triggerAlert("Link Vazio", "Por favor, insira o link da página do jogo do HowLongToBeat ou o ID numérico.");
      return;
    }

    setIsFetchingHltb(true);
    try {
      const response = await fetch(`/api/hltb?url=${encodeURIComponent(input)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Servidor retornou erro: ${response.status}`);
      }
      const data = await response.json();
      
      // Set the 3 times
      setHltbMain(data.gameplayMain ? formatHltbTime(data.gameplayMain) : "");
      setHltbExtra(data.gameplayMainExtra ? formatHltbTime(data.gameplayMainExtra) : "");
      setHltbCompletionist(data.gameplayCompletionist ? formatHltbTime(data.gameplayCompletionist) : "");
      if (data.id) {
        setHltbId(data.id);
      }
      
      setShowHltbImport(false);
      setHltbUrlInput("");
      triggerAlert("Sucesso", "Métricas carregadas com sucesso do HowLongToBeat!");
    } catch (err: any) {
      console.error(err);
      triggerAlert("Erro ao carregar", `Não foi possível extrair dados: ${err.message || err}`);
    } finally {
      setIsFetchingHltb(false);
    }
  };

  const handleRefreshHltb = async () => {
    if (!hltbId) {
      triggerAlert("ID ausente", "Não há um ID do HowLongToBeat associado a este jogo para atualizar.");
      return;
    }
    setIsFetchingHltb(true);
    try {
      const response = await fetch(`/api/hltb?url=${encodeURIComponent(hltbId)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Servidor retornou erro: ${response.status}`);
      }
      const data = await response.json();
      
      setHltbMain(data.gameplayMain ? formatHltbTime(data.gameplayMain) : "");
      setHltbExtra(data.gameplayMainExtra ? formatHltbTime(data.gameplayMainExtra) : "");
      setHltbCompletionist(data.gameplayCompletionist ? formatHltbTime(data.gameplayCompletionist) : "");
      
      triggerAlert("Métricas Atualizadas", "As médias do HowLongToBeat foram atualizadas com sucesso!");
    } catch (err: any) {
      console.error(err);
      triggerAlert("Erro ao atualizar", `Não foi possível atualizar dados: ${err.message || err}`);
    } finally {
      setIsFetchingHltb(false);
    }
  };

  const handleLoadMetacriticUrl = async () => {
    const input = metacriticUrlInput.trim();
    if (!input) {
      triggerAlert("Link Vazio", "Por favor, insira o link da página do jogo do Metacritic.");
      return;
    }

    setIsFetchingMetacritic(true);
    try {
      const response = await fetch(`/api/metacritic?url=${encodeURIComponent(input)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Servidor retornou erro: ${response.status}`);
      }
      const data = await response.json();
      
      const targetUrl = data.metacriticUrl || input;
      setMetacriticUrl(targetUrl);
      
      const platformsList = data.platforms || [];
      setMetacriticPlatforms(platformsList);

      let matchedPlatformCode = "";
      if (platformsList.length > 0 && platform) {
        const platformLower = platform.toLowerCase();
        const found = platformsList.find((p: any) => 
          p.name.toLowerCase().includes(platformLower) || 
          platformLower.includes(p.name.toLowerCase()) ||
          p.code.toLowerCase().includes(platformLower) ||
          platformLower.includes(p.code.toLowerCase())
        );
        if (found) {
          matchedPlatformCode = found.code;
        }
      }

      if (matchedPlatformCode) {
        setSelectedMetacriticPlatform(matchedPlatformCode);
        const platResponse = await fetch(`/api/metacritic?url=${encodeURIComponent(targetUrl)}&platform=${matchedPlatformCode}`);
        if (platResponse.ok) {
          const platData = await platResponse.json();
          setMetacriticCritScore(platData.metacriticCritScore !== null ? platData.metacriticCritScore : undefined);
          setMetacriticUserScore(platData.metacriticUserScore !== null ? platData.metacriticUserScore : undefined);
          triggerAlert("Sucesso", `Dados da plataforma "${matchedPlatformCode}" carregados com sucesso!`);
        } else {
          setMetacriticCritScore(data.metacriticCritScore !== null ? data.metacriticCritScore : undefined);
          setMetacriticUserScore(data.metacriticUserScore !== null ? data.metacriticUserScore : undefined);
          triggerAlert("Sucesso", "Dados gerais carregados com sucesso!");
        }
      } else {
        setSelectedMetacriticPlatform("");
        setMetacriticCritScore(data.metacriticCritScore !== null ? data.metacriticCritScore : undefined);
        setMetacriticUserScore(data.metacriticUserScore !== null ? data.metacriticUserScore : undefined);
        triggerAlert("Sucesso", "Dados carregados com sucesso do Metacritic!");
      }
      
      setShowMetacriticImport(false);
      setMetacriticUrlInput("");
    } catch (err: any) {
      console.error(err);
      triggerAlert("Erro ao carregar", `Não foi possível extrair dados: ${err.message || err}`);
    } finally {
      setIsFetchingMetacritic(false);
    }
  };

  const handleSelectFormPlatform = async (platformCode: string) => {
    setSelectedMetacriticPlatform(platformCode);
    if (!metacriticUrl) return;
    setIsFetchingMetacritic(true);
    try {
      const response = await fetch(`/api/metacritic?url=${encodeURIComponent(metacriticUrl)}&platform=${platformCode}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Servidor retornou erro: ${response.status}`);
      }
      const data = await response.json();
      setMetacriticCritScore(data.metacriticCritScore !== null ? data.metacriticCritScore : undefined);
      setMetacriticUserScore(data.metacriticUserScore !== null ? data.metacriticUserScore : undefined);
      triggerAlert("Atualizado", `Notas atualizadas para a plataforma selecionada!`);
    } catch (err: any) {
      console.error(err);
      triggerAlert("Erro", `Não foi possível carregar notas para esta plataforma: ${err.message || err}`);
    } finally {
      setIsFetchingMetacritic(false);
    }
  };

  const handleRefreshMetacritic = async () => {
    if (!metacriticUrl) {
      triggerAlert("Link ausente", "Não há um link do Metacritic associado a este jogo para atualizar.");
      return;
    }
    setIsFetchingMetacritic(true);
    try {
      const response = await fetch(`/api/metacritic?url=${encodeURIComponent(metacriticUrl)}&platform=${selectedMetacriticPlatform}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Servidor retornou erro: ${response.status}`);
      }
      const data = await response.json();
      
      setMetacriticCritScore(data.metacriticCritScore !== null ? data.metacriticCritScore : undefined);
      setMetacriticUserScore(data.metacriticUserScore !== null ? data.metacriticUserScore : undefined);
      
      triggerAlert("Notas Atualizadas", "As notas do Metacritic foram atualizadas com sucesso!");
    } catch (err: any) {
      console.error(err);
      triggerAlert("Erro ao atualizar", `Não foi possível atualizar dados: ${err.message || err}`);
    } finally {
      setIsFetchingMetacritic(false);
    }
  };

  // Steam States
  const [showSteamImport, setShowSteamImport] = useState(false);
  const [isFetchingSteam, setIsFetchingSteam] = useState(false);
  const [steamUrlInput, setSteamUrlInput] = useState("");
  const [steamUserGamesList, setSteamUserGamesList] = useState<SteamOwnedGame[]>([]);
  const [isLoadingSteamGames, setIsLoadingSteamGames] = useState(false);
  const [steamAchieveData, setSteamAchieveData] = useState<SteamAchievementsResult | null>(null);

  // Auto fetch Steam achievements if steamAppId exists
  useEffect(() => {
    if (steamAppId && isOpen) {
      fetchSteamAchievements(steamAppId)
        .then((data) => setSteamAchieveData(data))
        .catch(() => setSteamAchieveData(null));
    } else {
      setSteamAchieveData(null);
    }
  }, [steamAppId, isOpen]);

  const handleFetchUserSteamGames = async () => {
    if (steamUserGamesList.length > 0) return;
    setIsLoadingSteamGames(true);
    try {
      const owned = await fetchSteamOwnedGames();
      setSteamUserGamesList(owned);
    } catch (err) {
      console.warn("Erro ao buscar jogos do usuário na Steam:", err);
    } finally {
      setIsLoadingSteamGames(false);
    }
  };

  const handleLinkSteamGame = async (steamGame: SteamOwnedGame) => {
    setSteamAppId(steamGame.appid);
    setSteamPlaytimeMinutes(steamGame.playtime_forever);
    setSteamLastPlayedTimestamp(steamGame.rtime_last_played);
    setShowSteamImport(false);
    try {
      const ach = await fetchSteamAchievements(steamGame.appid);
      if (ach) {
        setSteamAchieveData(ach);
        setSteamAchievementsCount(ach.unlockedCount);
        setSteamAchievementsTotal(ach.totalCount);
      }
    } catch {
      // Ignore
    }
    triggerAlert("Steam Vinculada", `Jogo "${steamGame.name}" vinculado com sucesso! (${formatSteamPlaytime(steamGame.playtime_forever)} registrados na Steam)`);
  };

  const handleLoadSteamInput = async () => {
    const input = steamUrlInput.trim();
    if (!input) {
      triggerAlert("Campo Vazio", "Por favor, digite um App ID, link da loja Steam ou nome do jogo.");
      return;
    }

    setIsFetchingSteam(true);
    try {
      const match = input.match(/app\/(\d+)/) || input.match(/run\/(\d+)/) || input.match(/^(\d+)$/);
      let foundAppId = match ? parseInt(match[1], 10) : null;

      if (!foundAppId) {
        let list = steamUserGamesList;
        if (list.length === 0) {
          list = await fetchSteamOwnedGames();
          setSteamUserGamesList(list);
        }
        const matchGame = list.find((g) => g.name.toLowerCase().includes(input.toLowerCase()));
        if (matchGame) {
          await handleLinkSteamGame(matchGame);
          return;
        }
      }

      if (!foundAppId) {
        throw new Error("Não foi possível identificar o App ID na Steam. Digite o código numérico do App ID (ex: 39140).");
      }

      setSteamAppId(foundAppId);

      let list = steamUserGamesList;
      if (list.length === 0) {
        list = await fetchSteamOwnedGames();
        setSteamUserGamesList(list);
      }
      const ownedMatch = list.find((g) => g.appid === foundAppId);
      if (ownedMatch) {
        setSteamPlaytimeMinutes(ownedMatch.playtime_forever);
        setSteamLastPlayedTimestamp(ownedMatch.rtime_last_played);
      } else {
        setSteamPlaytimeMinutes(0);
      }

      try {
        const ach = await fetchSteamAchievements(foundAppId);
        if (ach) {
          setSteamAchieveData(ach);
          setSteamAchievementsCount(ach.unlockedCount);
          setSteamAchievementsTotal(ach.totalCount);
        }
      } catch {
        // Ignore
      }

      setShowSteamImport(false);
      triggerAlert("Steam Vinculada", `App ID ${foundAppId} vinculado com sucesso!`);
    } catch (err: any) {
      console.error(err);
      triggerAlert("Erro ao Vincular", err.message || "Erro ao processar dados da Steam.");
    } finally {
      setIsFetchingSteam(false);
    }
  };

  const handleSyncSteamData = async () => {
    if (!steamAppId) return;
    setIsFetchingSteam(true);
    try {
      const owned = await fetchSteamOwnedGames();
      setSteamUserGamesList(owned);
      const match = owned.find((g) => g.appid === steamAppId);
      if (match) {
        setSteamPlaytimeMinutes(match.playtime_forever);
        setSteamLastPlayedTimestamp(match.rtime_last_played);
      }
      const ach = await fetchSteamAchievements(steamAppId);
      if (ach) {
        setSteamAchieveData(ach);
        setSteamAchievementsCount(ach.unlockedCount);
        setSteamAchievementsTotal(ach.totalCount);
      }
      triggerAlert("Dados Atualizados", `Estatísticas da Steam atualizadas para o App ID ${steamAppId}!`);
    } catch (err: any) {
      console.error(err);
      triggerAlert("Erro de Sincronização", "Não foi possível atualizar dados da Steam.");
    } finally {
      setIsFetchingSteam(false);
    }
  };

  const handleUnlinkSteam = () => {
    setSteamAppId(undefined);
    setSteamPlaytimeMinutes(undefined);
    setSteamLastPlayedTimestamp(undefined);
    setSteamAchieveData(null);
    triggerAlert("Steam Desvinculada", "Os dados da Steam foram removidos deste jogo.");
  };

  // GOG Handlers
  const handleFetchUserGogGames = async () => {
    if (gogUserGamesList.length > 0) return;
    setIsLoadingGogGames(true);
    try {
      const owned = await fetchGogOwnedGames();
      setGogUserGamesList(owned);
    } catch (err) {
      console.warn("Erro ao buscar jogos do usuário na GOG:", err);
    } finally {
      setIsLoadingGogGames(false);
    }
  };

  const handleLinkGogGame = async (gogGame: GogOwnedGame) => {
    setGogGameId(gogGame.id);
    setGogPlaytimeMinutes(gogGame.playtime_minutes);
    setGogLastPlayedTimestamp(gogGame.last_played_timestamp);
    setShowGogImport(false);
    try {
      const ach = await fetchGogAchievements(gogGame.id);
      if (ach) {
        setGogAchieveData(ach);
        setGogAchievementsCount(ach.unlockedCount);
        setGogAchievementsTotal(ach.totalCount);
      }
    } catch {}
    triggerAlert(
      "GOG Vinculada",
      `Jogo "${gogGame.title}" vinculado com sucesso! (${formatGogPlaytime(gogGame.playtime_minutes)} registrados na GOG)`
    );
  };

  const handleLoadGogInput = async () => {
    const input = gogUrlInput.trim();
    if (!input) {
      triggerAlert("Campo Vazio", "Por favor, digite o ID do jogo ou nome do jogo da GOG.");
      return;
    }
    setIsFetchingGog(true);
    try {
      let list = gogUserGamesList;
      if (list.length === 0) {
        list = await fetchGogOwnedGames();
        setGogUserGamesList(list);
      }
      const matchGame = list.find(
        (g) => g.title.toLowerCase().includes(input.toLowerCase()) || String(g.id) === input
      );
      if (matchGame) {
        await handleLinkGogGame(matchGame);
        return;
      }
      setGogGameId(input);
      setGogPlaytimeMinutes(0);
      setShowGogImport(false);
      triggerAlert("GOG Vinculada", `ID de jogo GOG ${input} vinculado com sucesso!`);
    } catch (err: any) {
      triggerAlert("Erro ao Vincular GOG", err?.message || "Erro ao processar dados da GOG.");
    } finally {
      setIsFetchingGog(false);
    }
  };

  const handleSyncGogData = async () => {
    if (!gogGameId) return;
    setIsFetchingGog(true);
    try {
      const owned = await fetchGogOwnedGames();
      setGogUserGamesList(owned);
      const match = owned.find((g) => String(g.id) === String(gogGameId));
      if (match) {
        setGogPlaytimeMinutes(match.playtime_minutes);
        setGogLastPlayedTimestamp(match.last_played_timestamp);
      }
      const ach = await fetchGogAchievements(gogGameId);
      if (ach) {
        setGogAchieveData(ach);
        setGogAchievementsCount(ach.unlockedCount);
        setGogAchievementsTotal(ach.totalCount);
      }
      triggerAlert("Estatísticas GOG Atualizadas", `Estatísticas da GOG sincronizadas com sucesso!`);
    } catch (err: any) {
      triggerAlert("Erro de Sincronização", "Não foi possível atualizar dados da GOG.");
    } finally {
      setIsFetchingGog(false);
    }
  };

  const handleUnlinkGog = () => {
    setGogGameId(undefined);
    setGogPlaytimeMinutes(undefined);
    setGogLastPlayedTimestamp(undefined);
    setGogAchieveData(null);
    triggerAlert("GOG Desvinculada", "Os dados da GOG foram removidos deste jogo.");
  };

  // Initialize form
  useEffect(() => {
    if (game) {
      setName(game.name || "");
      setSeries(game.series || "");
      setPublisher(game.publisher || "");
      setStudio(game.studio || game.developer || "");
      setPricePaid(game.pricePaid !== undefined && game.pricePaid !== null ? String(game.pricePaid) : "");
      setReplayed(!!game.replayed);
      setReplayCount(game.replayCount || 0);
      setReplayNote(game.replayNote || "");
      setIsGaaS(!!game.isGaaS);
      setDlcMode(getDlcMode(game));
      setDlcNames(game.dlcNames || "");
      setPlaytime(game.playtime || "");
      setAdditionalPlaytime(game.additionalPlaytime || "");
      setTrophy(game.trophy || "none");
      setSelectedTrophyItems(getGameTrophyItems(game));
      setPros(game.pros || "");
      setCons(game.cons || "");
      setPlatform(game.platform || "");
      setDifficulty(game.difficulty || "");
      setRating(game.rating || 0);
      setStartDate(game.startDate || "");
      setEndDate(game.endDate || "");
      setReleaseDate(game.releaseDate || "");

      const isDataCover = game.cover && game.cover.startsWith("data:");
      setCoverUrl(isDataCover ? "" : game.cover || "");
      setTempUploadedCover(isDataCover ? "" : game.cover || ""); // Clean up potential legacy base64 if needed, otherwise use cover

      const iconType = game.iconType || "emoji";
      setActiveIconTab(iconType);
      if (iconType === "emoji") {
        setIconEmoji(game.icon || "🎮");
      } else if (iconType === "upload") {
        setTempUploadedIcon(game.icon || "");
      } else {
        setIconUrl(game.icon || "");
      }

      setSelectedStatus(game.status || []);
      setSelectedGenres(game.genre || []);
      setSelectedTags(game.tags || []);

      // HLTB values
      setHltbMain(game.hltbMain || "");
      setHltbExtra(game.hltbExtra || "");
      setHltbCompletionist(game.hltbCompletionist || "");
      setHltbId(game.hltbId || "");

      // Metacritic values
      setMetacriticUrl(game.metacriticUrl || "");
      setMetacriticCritScore(game.metacriticCritScore !== undefined ? game.metacriticCritScore : undefined);
      setMetacriticUserScore(game.metacriticUserScore !== undefined ? game.metacriticUserScore : undefined);

      // Integration platform selection
      const activePlat = game.integrationPlatform || (game.gogGameId ? "gog" : game.steamAppId ? "steam" : "none");
      setIntegrationPlatform(activePlat);

      // Steam values
      setSteamAppId(game.steamAppId);
      setSteamPlaytimeMinutes(game.steamPlaytimeMinutes);
      setSteamLastPlayedTimestamp(game.steamLastPlayedTimestamp);
      setSteamAchievementsCount(game.steamAchievementsCount);
      setSteamAchievementsTotal(game.steamAchievementsTotal);

      // GOG values
      setGogGameId(game.gogGameId);
      setGogPlaytimeMinutes(game.gogPlaytimeMinutes);
      setGogLastPlayedTimestamp(game.gogLastPlayedTimestamp);
      setGogAchievementsCount(game.gogAchievementsCount);
      setGogAchievementsTotal(game.gogAchievementsTotal);

      if (game.steamAppId) {
        fetchSteamAchievements(game.steamAppId)
          .then((ach) => {
            if (ach) {
              setSteamAchieveData(ach);
              setSteamAchievementsCount(ach.unlockedCount);
              setSteamAchievementsTotal(ach.totalCount);
            }
          })
          .catch(() => {});
      } else {
        setSteamAchieveData(null);
      }

      if (game.gogGameId) {
        fetchGogAchievements(game.gogGameId)
          .then((ach) => {
            if (ach) {
              setGogAchieveData(ach);
              setGogAchievementsCount(ach.unlockedCount);
              setGogAchievementsTotal(ach.totalCount);
            }
          })
          .catch(() => {});
      } else {
        setGogAchieveData(null);
      }
      
      if (game.metacriticUrl) {
        fetch(`/api/metacritic?url=${encodeURIComponent(game.metacriticUrl)}`)
          .then((res) => {
            if (!res.ok) return null;
            return res.json();
          })
          .then((data) => {
            if (data && data.platforms) {
              setMetacriticPlatforms(data.platforms);
            }
          })
          .catch((err) => {
            console.warn("Não foi possível obter plataformas no modal:", err?.message || err);
          });
      } else {
        setMetacriticPlatforms([]);
        setSelectedMetacriticPlatform("");
      }
    } else {
      // Clear all
      setName("");
      setSeries("");
      setPublisher("");
      setStudio("");
      setPricePaid("");
      setReplayed(false);
      setReplayCount(0);
      setReplayNote("");
      setDlcMode("none");
      setDlcNames("");
      setPlaytime("");
      setAdditionalPlaytime("");
      setTrophy("none");
      setSelectedTrophyItems([]);
      setPros("");
      setCons("");
      setPlatform("");
      setDifficulty("");
      setRating(0);
      setStartDate("");
      setEndDate("");
      setReleaseDate("");
      setCoverUrl("");
      setTempUploadedCover("");
      setActiveIconTab("emoji");
      setIconEmoji("🎮");
      setTempUploadedIcon("");
      setIconUrl("");
      setSelectedStatus([]);
      setSelectedGenres([]);
      setSelectedTags([]);

      // HLTB values
      setHltbMain("");
      setHltbExtra("");
      setHltbCompletionist("");
      setHltbId("");

      // Metacritic values
      setMetacriticUrl("");
      setMetacriticCritScore(undefined);
      setMetacriticUserScore(undefined);
      setMetacriticPlatforms([]);
      setSelectedMetacriticPlatform("");

      // Steam values
      setIntegrationPlatform("steam");
      setSteamAppId(undefined);
      setSteamPlaytimeMinutes(undefined);
      setSteamLastPlayedTimestamp(undefined);
      setSteamAchievementsCount(undefined);
      setSteamAchievementsTotal(undefined);
      setSteamAchieveData(null);

      // GOG values
      setGogGameId(undefined);
      setGogPlaytimeMinutes(undefined);
      setGogLastPlayedTimestamp(undefined);
      setGogAchievementsCount(undefined);
      setGogAchievementsTotal(undefined);
      setGogAchieveData(null);
      setShowGogImport(false);
      setGogUrlInput("");
    }
    setShowNewGenre(false);
    setShowNewTag(false);
    setNewGenreVal("");
    setNewTagVal("");

    // Clear HLTB import states
    setIsFetchingHltb(false);
    setHltbUrlInput("");
    setShowHltbImport(false);

    // Clear Metacritic import states
    setIsFetchingMetacritic(false);
    setMetacriticUrlInput("");
    setShowMetacriticImport(false);
  }, [game, isOpen]);

  const uploadCoverFile = async (file: File) => {
    setIsUploadingCover(true);
    try {
      const fileNameParam = `${name.trim() || "jogo"}_cover`;
      const res = await uploadToImgBB(file, fileNameParam);
      setTempUploadedCover(res.url);
      setCoverUrl(""); // override text input with direct ImgBB url
    } catch (err: any) {
      console.error(err);
      triggerAlert(
        "Erro de Upload",
        `Não foi possível enviar a capa para o ImgBB: ${err.message || err}`
      );
    } finally {
      setIsUploadingCover(false);
    }
  };

  const uploadIconFile = async (file: File) => {
    setIsUploadingIcon(true);
    try {
      const fileNameParam = `${name.trim() || "jogo"}_icon`;
      const res = await uploadToImgBB(file, fileNameParam);
      setTempUploadedIcon(res.url);
    } catch (err: any) {
      console.error(err);
      triggerAlert(
        "Erro de Upload",
        `Não foi possível enviar o ícone para o ImgBB: ${err.message || err}`
      );
    } finally {
      setIsUploadingIcon(false);
    }
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadCoverFile(file);
  };

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadIconFile(file);
  };

  // Drag and drop events for Icon
  const handleIconDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverIcon(true);
  };

  const handleIconDragLeave = () => {
    setIsDragOverIcon(false);
  };

  const handleIconDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverIcon(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      uploadIconFile(file);
    } else if (file) {
      triggerAlert("Formato Inválido", "Por favor, envie apenas arquivos de imagem para o ícone.");
    }
  };

  // Drag and drop events for Cover
  const handleCoverDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverCover(true);
  };

  const handleCoverDragLeave = () => {
    setIsDragOverCover(false);
  };

  const handleCoverDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverCover(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      uploadCoverFile(file);
    } else if (file) {
      triggerAlert("Formato Inválido", "Por favor, envie apenas arquivos de imagem para a capa do jogo.");
    }
  };

  const toggleStatus = (statusVal: string) => {
    const isTurningOnJogando = statusVal === "Jogando" && !selectedStatus.includes("Jogando");

    if (isTurningOnJogando) {
      const prevStatusList = game ? (game.status || []) : selectedStatus;
      const wasInactiveOrFinished =
        prevStatusList.some((s) => ["Terminado", "Em Hiatus", "Desistido", "Backlog"].includes(s)) ||
        (prevStatusList.length > 0 && !prevStatusList.includes("Jogando"));

      if (wasInactiveOrFinished) {
        setPendingReplayPreviousStatus(prevStatusList);
        setAutoArchivePlaytime(parsePlaytimeHours(playtime) > 0);
        setShowReplayPromptModal(true);
      }
    }

    setSelectedStatus((prev) =>
      prev.includes(statusVal) ? prev.filter((s) => s !== statusVal) : [...prev, statusVal]
    );
  };

  const handleConfirmReplayPrompt = (addReplay: boolean) => {
    if (addReplay) {
      const currentCount = replayed ? (replayCount || 1) : 0;
      const nextCount = currentCount + 1;
      setReplayed(true);
      setReplayCount(nextCount);

      const todayStr = new Date().toLocaleDateString("pt-BR");
      const newNoteChunk = `Replay #${nextCount} iniciado em ${todayStr}`;
      setReplayNote((prev) => {
        const trimmed = prev.trim();
        return trimmed ? `${trimmed}; ${newNoteChunk}` : newNoteChunk;
      });

      if (autoArchivePlaytime && parsePlaytimeHours(playtime) > 0) {
        const currentMainH = parsePlaytimeHours(playtime);
        const currentAddH = parsePlaytimeHours(additionalPlaytime);
        const newAddH = currentAddH + currentMainH;
        setAdditionalPlaytime(
          formatHoursAndMinutes(newAddH) + ` [Campanha anterior: ${playtime}]`
        );
        setPlaytime("0h");
      }
    }
    setShowReplayPromptModal(false);
  };

  const toggleGenre = (genreVal: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genreVal) ? prev.filter((g) => g !== genreVal) : [...prev, genreVal]
    );
  };

  const toggleTag = (tagVal: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagVal) ? prev.filter((t) => t !== tagVal) : [...prev, tagVal]
    );
  };

  const submitCustomGenre = () => {
    const val = newGenreVal.trim();
    if (!val) return;
    onAddGlobalGenre(val);
    if (!selectedGenres.includes(val)) {
      setSelectedGenres((prev) => [...prev, val]);
    }
    setNewGenreVal("");
    setShowNewGenre(false);
  };

  const submitCustomTag = () => {
    const val = newTagVal.trim();
    if (!val) return;
    onAddGlobalTag(val);
    if (!selectedTags.includes(val)) {
      setSelectedTags((prev) => [...prev, val]);
    }
    setNewTagVal("");
    setShowNewTag(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      triggerAlert("Campo Obrigatório", "Por favor, preencha o título do jogo.");
      return;
    }

    if (selectedStatus.length === 0) {
      triggerAlert("Progresso Requerido", "Por favor, selecione pelo menos uma categoria de progresso.");
      return;
    }

    if (selectedGenres.length === 0) {
      triggerAlert("Gênero Requerido", "Por favor, selecione pelo menos um gênero para o jogo.");
      return;
    }

    // Determine icon
    let finalIcon = "🎮";
    if (activeIconTab === "emoji") finalIcon = iconEmoji.trim() || "🎮";
    if (activeIconTab === "upload") finalIcon = tempUploadedIcon || "🎮";
    if (activeIconTab === "url") finalIcon = iconUrl.trim() || "🎮";

    // Determine cover
    const finalCover = tempUploadedCover || coverUrl.trim() || COVER_BANK[0];

    const formatAndSortList = (raw: string) => {
      if (!raw) return "";
      const items = raw
        .split(/[;\n\r]+/)
        .map((item) => item.trim())
        .filter(Boolean);
      items.sort((a, b) => {
        const topicA = parseProConTopic(a).topic;
        const topicB = parseProConTopic(b).topic;
        return topicA.localeCompare(topicB, "pt", { sensitivity: "base" });
      });
      return items.join("; ");
    };

    const trophyTypes = selectedTrophyItems.map((t) => t.type);
    const highestTrophy = trophyTypes.length > 0
      ? (trophyTypes.includes("platinum") ? "platinum" : trophyTypes.includes("gold") ? "gold" : "silver")
      : "none";

    const parsePriceInput = (val: string): number | undefined => {
      if (!val || !val.trim()) return undefined;
      const sanitized = val.replace(",", ".").replace(/[^0-9.]/g, "");
      if (!sanitized) return undefined;
      const parsed = parseFloat(sanitized);
      return isNaN(parsed) ? undefined : parsed;
    };

    onSave({
      id: game?.id,
      name: name.trim(),
      series: series.trim(),
      publisher: publisher.trim(),
      studio: studio.trim(),
      pricePaid: parsePriceInput(pricePaid),
      playtime: playtime.trim() || "00h 00m",
      additionalPlaytime: additionalPlaytime.trim(),
      trophy: highestTrophy,
      trophies: selectedTrophyItems,
      pros: formatAndSortList(pros),
      cons: formatAndSortList(cons),
      rating: Math.min(5, Math.max(0, rating)),
      startDate,
      endDate,
      releaseDate,
      cover: finalCover,
      icon: finalIcon,
      iconType: activeIconTab,
      status: selectedStatus,
      replayed,
      replayCount: replayed ? Math.max(1, replayCount) : 0,
      replayNote: replayed ? replayNote.trim() : "",
      isGaaS,
      dlcMode,
      dlcNames: dlcMode !== "none" ? dlcNames.trim() : "",
      isDlc: dlcMode === "dlc" || dlcMode === "plus_dlc",
      difficulty: difficulty.trim(),
      genre: selectedGenres,
      tags: selectedTags,
      platform: platform.trim() || "PC",
      hltbMain,
      hltbExtra,
      hltbCompletionist,
      hltbId,
      metacriticUrl,
      metacriticCritScore,
      metacriticUserScore,
      integrationPlatform,
      steamAppId: integrationPlatform === "steam" ? steamAppId : undefined,
      steamPlaytimeMinutes: integrationPlatform === "steam" ? steamPlaytimeMinutes : undefined,
      steamLastPlayedTimestamp: integrationPlatform === "steam" ? steamLastPlayedTimestamp : undefined,
      steamAchievementsCount: integrationPlatform === "steam"
        ? (steamAchieveData ? steamAchieveData.unlockedCount : (steamAchievementsCount !== undefined ? steamAchievementsCount : game?.steamAchievementsCount))
        : undefined,
      steamAchievementsTotal: integrationPlatform === "steam"
        ? (steamAchieveData ? steamAchieveData.totalCount : (steamAchievementsTotal !== undefined ? steamAchievementsTotal : game?.steamAchievementsTotal))
        : undefined,
      gogGameId: integrationPlatform === "gog" ? gogGameId : undefined,
      gogPlaytimeMinutes: integrationPlatform === "gog" ? gogPlaytimeMinutes : undefined,
      gogLastPlayedTimestamp: integrationPlatform === "gog" ? gogLastPlayedTimestamp : undefined,
      gogAchievementsCount: integrationPlatform === "gog"
        ? (gogAchieveData ? gogAchieveData.unlockedCount : (gogAchievementsCount !== undefined ? gogAchievementsCount : game?.gogAchievementsCount))
        : undefined,
      gogAchievementsTotal: integrationPlatform === "gog"
        ? (gogAchieveData ? gogAchieveData.totalCount : (gogAchievementsTotal !== undefined ? gogAchievementsTotal : game?.gogAchievementsTotal))
        : undefined,
      ...(game ? { diary: game.diary } : { diary: [] })
    });
  };

  const scrollToBlock = (blockKey: string) => {
    setActiveBlock(blockKey);
    setOpenBlocks((prev) => ({ ...prev, [blockKey]: true }));
    if (blockKey === "genres" || blockKey === "tags") {
      setOpenBlocks((prev) => ({ ...prev, genres: true, tags: true }));
    }
    setTimeout(() => {
      const el = document.getElementById(`block-${blockKey}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 60);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            ref={scrollContainerRef}
            onScroll={handleScrollModal}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-zinc-950 rounded-2xl max-w-5xl lg:max-w-6xl xl:max-w-7xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-purple-500/30 relative z-10"
          >
            <div className="p-4 sm:p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/95 sticky top-0 backdrop-blur-md z-30 shadow-md gap-3">
              <h3 className="text-base sm:text-lg font-bold text-white truncate">
                {game ? "Editar Ficha de Jogo" : "Adicionar Novo Jogo"}
              </h3>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold hover:bg-zinc-800 transition-all text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="game-form"
                  className="btn-neon px-4 py-2 sm:px-5 sm:py-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white font-bold text-xs sm:text-sm shadow-lg shadow-purple-600/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={15} />
                  <span>Salvar Ficha</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-zinc-400 hover:text-white transition-colors p-1.5 hover:bg-zinc-800 rounded-lg ml-0.5 cursor-pointer"
                  title="Fechar"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Quick Navigation Chips Bar */}
            <div className="sticky top-[61px] z-20 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-6 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none shadow-sm">
              <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
                <Sparkles size={11} className="text-purple-400" />
                <span>Atalhos:</span>
              </span>
              <div ref={chipsBarRef} className="flex items-center gap-1.5 shrink-0">
                {[
                  { key: "basic", label: "Informações", icon: Gamepad2, activeClass: "bg-cyan-500/25 text-cyan-300 border-cyan-400 border-b-2 ring-2 ring-cyan-500/40 shadow-md shadow-cyan-500/20 font-extrabold scale-[1.03]" },
                  { key: "playtime", label: "Tempo", icon: Clock, activeClass: "bg-teal-500/25 text-teal-300 border-teal-400 border-b-2 ring-2 ring-teal-500/40 shadow-md shadow-teal-500/20 font-extrabold scale-[1.03]" },
                  { key: "trophies", label: "Troféus", icon: Trophy, activeClass: "bg-amber-500/25 text-amber-300 border-amber-400 border-b-2 ring-2 ring-amber-500/40 shadow-md shadow-amber-500/20 font-extrabold scale-[1.03]" },
                  { key: "proscons", label: "Prós/Contras", icon: ThumbsUp, activeClass: "bg-emerald-500/25 text-emerald-300 border-emerald-400 border-b-2 ring-2 ring-emerald-500/40 shadow-md shadow-emerald-500/20 font-extrabold scale-[1.03]" },
                  { key: "hltb", label: "HLTB", icon: Sparkles, activeClass: "bg-purple-500/25 text-purple-300 border-purple-400 border-b-2 ring-2 ring-purple-500/40 shadow-md shadow-purple-500/20 font-extrabold scale-[1.03]" },
                  { key: "dates", label: "Datas", icon: Calendar, activeClass: "bg-sky-500/25 text-sky-300 border-sky-400 border-b-2 ring-2 ring-sky-500/40 shadow-md shadow-sky-500/20 font-extrabold scale-[1.03]" },
                  { key: "platform", label: "Plataforma", icon: Monitor, activeClass: "bg-indigo-500/25 text-indigo-300 border-indigo-400 border-b-2 ring-2 ring-indigo-500/40 shadow-md shadow-indigo-500/20 font-extrabold scale-[1.03]" },
                  { key: "status", label: "Progresso", icon: CheckCircle, activeClass: "bg-emerald-500/25 text-emerald-300 border-emerald-400 border-b-2 ring-2 ring-emerald-500/40 shadow-md shadow-emerald-500/20 font-extrabold scale-[1.03]" },
                  { key: "genres", label: "Gêneros", icon: Gamepad2, activeClass: "bg-fuchsia-500/25 text-fuchsia-300 border-fuchsia-400 border-b-2 ring-2 ring-fuchsia-500/40 shadow-md shadow-fuchsia-500/20 font-extrabold scale-[1.03]" },
                  { key: "tags", label: "Tags", icon: Tag, activeClass: "bg-cyan-500/25 text-cyan-300 border-cyan-400 border-b-2 ring-2 ring-cyan-500/40 shadow-md shadow-cyan-500/20 font-extrabold scale-[1.03]" },
                ].map((chip) => {
                  const IconComp = chip.icon;
                  const isOpen = !!openBlocks[chip.key];
                  const isActive = activeBlock === chip.key;
                  return (
                    <button
                      key={chip.key}
                      data-chip-key={chip.key}
                      type="button"
                      onClick={() => scrollToBlock(chip.key)}
                      className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap select-none ${
                        isActive
                          ? chip.activeClass
                          : isOpen
                          ? "bg-zinc-900 text-zinc-200 border-zinc-700 hover:text-white hover:bg-zinc-800"
                          : "bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:text-white hover:bg-zinc-800"
                      }`}
                    >
                      <IconComp size={12} className={isActive ? "animate-pulse" : ""} />
                      <span>{chip.label}</span>
                      {isActive ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      ) : isOpen ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {isSelectingCandidate && (
              <div className="absolute inset-x-0 bottom-0 top-[73px] bg-zinc-950 z-40 flex flex-col p-6 space-y-6">
                <div className="text-center space-y-2 border-b border-zinc-900 pb-4 shrink-0">
                  <h4 className="text-base font-black text-cyan-400 uppercase tracking-wider flex items-center justify-center gap-2">
                    <Sparkles size={16} className="text-purple-400" />
                    Qual é o jogo correto?
                  </h4>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Encontramos múltiplos resultados para sua busca. Selecione o jogo exato para preencher a Ficha Técnica com alta precisão:
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                  {gameCandidates.map((cand, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        applyGameCandidate(cand);
                        setIsSelectingCandidate(false);
                        triggerAlert("Metadados Carregados!", `Encontramos os detalhes de "${cand.name}" e preenchemos a ficha de jogo com sucesso.`);
                      }}
                      className="w-full group flex gap-4 text-left p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-850 hover:border-cyan-500/50 hover:bg-zinc-900/85 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                    >
                      <div className="w-16 h-24 bg-black rounded-xl overflow-hidden border border-zinc-800 shrink-0">
                        <img
                          src={cand.coverUrl || "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80&w=150"}
                          alt={cand.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://placehold.co/150x225/0c0a0f/ffffff?text=${encodeURIComponent(cand.name)}`;
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                        <div>
                          <h5 className="text-sm font-black text-white group-hover:text-cyan-400 transition-colors line-clamp-1">
                            {cand.name}
                          </h5>
                          {cand.releaseDate && (
                            <span className="text-[10px] font-mono text-zinc-400 block mt-1">
                              Lançamento: {cand.releaseDate.split("-")[0] || cand.releaseDate}
                            </span>
                          )}
                          {cand.developer && (
                            <span className="text-[10px] text-zinc-500 block mt-0.5 line-clamp-1">
                              Estúdio: {cand.developer}
                            </span>
                          )}
                        </div>
                        {cand.platforms && cand.platforms.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {cand.platforms.slice(0, 4).map((plat: string) => (
                              <span key={plat} className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-zinc-800 border border-zinc-750 text-zinc-300">
                                {plat}
                              </span>
                            ))}
                            {cand.platforms.length > 4 && (
                              <span className="text-[8px] font-mono text-zinc-500">
                                +{cand.platforms.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-zinc-900 shrink-0">
                  <p className="text-[10px] text-zinc-500">Não encontrou o jogo? Volte e preencha manualmente.</p>
                  <button
                    type="button"
                    onClick={() => setIsSelectingCandidate(false)}
                    className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
                  >
                    Voltar ao Formulário
                  </button>
                </div>
              </div>
            )}

            <form id="game-form" onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Controles Globais de Expansão/Colapso dos Blocos */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-xs text-zinc-300 font-mono font-semibold">
                  📂 Blocos do formulário (iniciam colapsados):
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenBlocks({
                        basic: true,
                        playtime: true,
                        trophies: true,
                        replay: true,
                        gaas: true,
                        dates: true,
                        platform: true,
                        proscons: true,
                        status: true,
                        genres: true,
                        tags: true,
                        hltb: true,
                        metacritic: true,
                        steam: true,
                        icon: true,
                        cover: true,
                      });
                    }}
                    className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 px-3 py-1.5 bg-cyan-950/60 border border-cyan-500/40 rounded-xl transition-all cursor-pointer"
                  >
                    Expandir Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenBlocks({})}
                    className="text-[11px] font-bold text-zinc-400 hover:text-zinc-200 px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl transition-all cursor-pointer"
                  >
                    Recolher Todos
                  </button>
                </div>
              </div>

              {/* Bloco 1: Informações Básicas */}
              <div id="block-basic" className={`scroll-mt-28 bg-zinc-950/80 p-4.5 rounded-2xl transition-all ${getCategoryBorderClass("basic", !!openBlocks["basic"])}`}>
                <div
                  onClick={() => toggleBlock("basic")}
                  className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-cyan-500/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Gamepad2 size={16} className="text-cyan-400 shrink-0" />
                    <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider font-mono shrink-0">
                      Informações Básicas
                    </h4>
                    {name && !openBlocks["basic"] && (
                      <span className="text-xs text-zinc-400 font-normal truncate">
                        — {name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={handleFetchAIMetadata}
                      disabled={isFetchingAIMetadata}
                      className={`text-xs font-bold text-cyan-400 flex items-center gap-1 hover:text-cyan-300 transition-colors cursor-pointer ${
                        isFetchingAIMetadata ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      {isFetchingAIMetadata ? (
                        <>
                          <Loader2 size={12} className="animate-spin text-cyan-400" />
                          <span>Buscando Metadados...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={12} className="text-purple-400 animate-pulse" />
                          <span>Preencher via IA</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleBlock("basic")}
                      className="p-1 rounded-lg text-cyan-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {openBlocks["basic"] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>

                {openBlocks["basic"] && (
                  <div className="pt-4 space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-bold text-zinc-300 uppercase tracking-widest">
                          Título do Jogo *
                        </label>
                      </div>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        placeholder="Ex: Metroid Dread"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 uppercase tracking-widest mb-1.5">
                          Série / Saga
                        </label>
                        <input
                          type="text"
                          value={series}
                          onChange={(e) => setSeries(e.target.value)}
                          placeholder="Ex: Metroid"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 uppercase tracking-widest mb-1.5">
                          Publicadora
                        </label>
                        <input
                          type="text"
                          value={publisher}
                          onChange={(e) => setPublisher(e.target.value)}
                          placeholder="Ex: Nintendo"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-300 uppercase tracking-widest mb-1.5">
                        Estúdio/Developer
                      </label>
                      <input
                        type="text"
                        value={studio}
                        onChange={(e) => setStudio(e.target.value)}
                        placeholder="Ex: Retro Studios / MercurySteam"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 uppercase tracking-widest mb-1.5">
                          Nota Pessoal (0-5)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="5"
                          step="0.5"
                          value={rating}
                          onChange={(e) => setRating(parseFloat(e.target.value) || 0)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                          <DollarSign size={13} className="text-emerald-400 shrink-0" />
                          <span>Valor Pago (R$)</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Ex: 149.90"
                          value={pricePaid}
                          onChange={(e) => setPricePaid(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-4 py-2.5 text-sm text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 uppercase tracking-widest mb-1.5">
                          Lançamento
                        </label>
                        <input
                          type="date"
                          value={releaseDate}
                          onChange={(e) => setReleaseDate(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tempo de Jogo Reformulado (Normais x GaaS) */}
              <div id="block-playtime" className={`scroll-mt-28 bg-zinc-950/80 p-4.5 rounded-2xl transition-all ${getCategoryBorderClass("playtime", !!openBlocks["playtime"])}`}>
                <div
                  onClick={() => toggleBlock("playtime")}
                  className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-teal-500/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock size={16} className="text-teal-400 shrink-0" />
                    <h4 className="text-xs font-bold text-teal-300 uppercase tracking-wider font-mono shrink-0">
                      {isGaaS
                        ? "Horas de Jogo (Game as a Service)"
                        : selectedStatus.includes("Jogando")
                        ? "Horas de Jogo (Em Andamento)"
                        : "Horas de Jogo (Campanha & Extras)"}
                    </h4>
                    {!openBlocks["playtime"] && (playtime || additionalPlaytime) && (
                      <span className="text-xs text-teal-400 font-mono font-bold truncate">
                        — {formatHoursAndMinutes(parsePlaytimeHours(playtime) + parsePlaytimeHours(additionalPlaytime))}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-teal-400/80 font-mono hidden sm:inline">
                      {isGaaS ? "Modo GaaS Ativo" : selectedStatus.includes("Jogando") ? "Em Andamento" : "Campanha Concluída/Pausada"}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleBlock("playtime")}
                      className="p-1 rounded-lg text-teal-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {openBlocks["playtime"] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>

                {openBlocks["playtime"] && (
                  <div className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-cyan-300 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                          <span>
                            {isGaaS
                              ? "Tempo Atual (Season / Atividade)"
                              : selectedStatus.includes("Jogando")
                              ? "Tempo Atual (Em Andamento)"
                              : "Tempo Final (Campanha Principal)"}
                          </span>
                          <span className="text-[10px] text-cyan-500/80 font-normal">Campanha/Atividade</span>
                        </label>
                        <input
                          type="text"
                          value={playtime}
                          onChange={(e) => setPlaytime(e.target.value)}
                          placeholder={
                            isGaaS
                              ? "Ex: 42h 15m [Season 3 - Passe de Batalha]"
                              : selectedStatus.includes("Jogando")
                              ? "Ex: 18h 30m [Capítulo 4 - Em andamento]"
                              : "Ex: 24h 15m [Zerado no Hard]"
                          }
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                        />
                        <p className="text-[10px] text-zinc-500 mt-1 font-sans">
                          {isGaaS
                            ? "Tempo investido na Season ou atividade atual. Colchetes [ ] viram tooltip!"
                            : selectedStatus.includes("Jogando")
                            ? "Tempo investido até agora na campanha atual. Ao mudar status p/ Terminado, torna-se Tempo Final da Campanha."
                            : "Tempo investido exclusivamente na campanha principal deste jogo. Colchetes [ ] viram tooltip!"}
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-purple-300 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                          <span>
                            {isGaaS ? "Tempo da Conta (Histórico Acumulado)" : "Tempo Extra (Replays / Pós-jogo / Outras vezes)"}
                          </span>
                          <span className="text-[10px] text-purple-500/80 font-normal">Extra/Conta</span>
                        </label>
                        <input
                          type="text"
                          value={additionalPlaytime}
                          onChange={(e) => setAdditionalPlaytime(e.target.value)}
                          placeholder={
                            isGaaS
                              ? "Ex: 350h [Acumulado desde o lançamento em 2022]"
                              : "Ex: 120h 30m [Replay no New Game+ em 2024]"
                          }
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                        />
                        <p className="text-[10px] text-zinc-500 mt-1 font-sans">
                          {isGaaS
                            ? "Horas totais anteriores ou acumuladas na conta do jogo. Colchetes [ ] viram tooltip!"
                            : "Tempo extra investido em replays, DLCs ou outras jogatinas. Colchetes [ ] viram tooltip!"}
                        </p>
                      </div>
                    </div>

                    {/* Helper p/ Replay */}
                    {!isGaaS && parsePlaytimeHours(playtime) > 0 && selectedStatus.includes("Jogando") && (
                      <div className="bg-purple-950/40 p-2.5 rounded-xl border border-purple-500/40 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 text-xs text-purple-200">
                          <RotateCcw size={14} className="text-purple-400 shrink-0" />
                          <span>Rejogando este título? Você pode mover o tempo da campanha anterior para <strong>Tempo Extra</strong>.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const playH = parsePlaytimeHours(playtime);
                            const addH = parsePlaytimeHours(additionalPlaytime);
                            const newAddH = addH + playH;
                            setAdditionalPlaytime(formatHoursAndMinutes(newAddH) + ` [Campanha anterior: ${playtime}]`);
                            setPlaytime("0h");
                          }}
                          className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-[11px] transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
                        >
                          <span>📦 Arquivar {formatHoursAndMinutes(parsePlaytimeHours(playtime))} em Tempo Extra</span>
                        </button>
                      </div>
                    )}

                    <div className="bg-zinc-900/90 p-3 rounded-xl border border-cyan-500/30 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Clock size={15} className="text-cyan-400 shrink-0" />
                        <span className="text-xs font-bold text-zinc-300">Tempo Total Investido (Somatório):</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-xs text-zinc-400">
                          ({formatHoursAndMinutes(parsePlaytimeHours(playtime))} + {formatHoursAndMinutes(parsePlaytimeHours(additionalPlaytime))}) =
                        </span>
                        <strong className="text-sm font-black text-cyan-300 bg-cyan-950/80 px-2.5 py-1 rounded-lg border border-cyan-500/40">
                          {formatHoursAndMinutes(parsePlaytimeHours(playtime) + parsePlaytimeHours(additionalPlaytime))}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Seção de Troféus Organizada */}
              <div id="block-trophies" className={`scroll-mt-28 bg-zinc-950/80 p-4.5 rounded-2xl transition-all ${getCategoryBorderClass("trophies", !!openBlocks["trophies"])}`}>
                <div
                  onClick={() => toggleBlock("trophies")}
                  className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-amber-500/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Trophy size={16} className="text-amber-400 shrink-0" />
                    <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider font-mono shrink-0">
                      Troféus & Conquistas
                    </h4>
                    {!openBlocks["trophies"] && selectedTrophyItems.length > 0 && (
                      <span className="text-xs text-amber-400 font-mono font-bold truncate">
                        — {selectedTrophyItems.length} troféus (P:{platinumCount} O:{goldCount} P:{silverCount})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleBlock("trophies")}
                      className="p-1 rounded-lg text-amber-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {openBlocks["trophies"] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>

                {openBlocks["trophies"] && (
                  <div className="pt-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] text-zinc-400">
                        Adicione as conquistas do jogo e registre anotações ou datas individuais.
                      </p>

                      {selectedTrophyItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedTrophyItems([])}
                          className="text-[10px] text-zinc-400 hover:text-rose-400 font-bold uppercase transition-colors cursor-pointer px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-rose-500/40"
                        >
                          Limpar todos ({selectedTrophyItems.length})
                        </button>
                      )}
                    </div>

                    {/* Seletores / Contadores Rápidos */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Silver Card */}
                      <div className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-2 ${silverCount > 0 ? "bg-slate-900/90 border-slate-500/50 shadow-[0_0_10px_rgba(203,213,225,0.15)]" : "bg-zinc-900/80 border-zinc-800/80"}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Trophy size={14} fill="currentColor" className={silverCount > 0 ? "text-slate-300" : "text-zinc-600"} />
                            <span className={`text-xs font-bold ${silverCount > 0 ? "text-slate-200" : "text-zinc-400"}`}>Prata</span>
                          </div>
                          {silverCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 font-mono text-[10px] font-extrabold border border-slate-600 shrink-0">
                              x{silverCount}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 w-full">
                          <button
                            type="button"
                            onClick={() => removeTrophy("silver")}
                            disabled={silverCount === 0}
                            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-20 text-zinc-300 font-black flex items-center justify-center text-sm cursor-pointer transition-all shrink-0"
                            title="Remover 1 Prata"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => addTrophy("silver")}
                            className="flex-1 h-7 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-100 border border-slate-500/40 text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer transition-all min-w-0"
                            title="Adicionar 1 Prata"
                          >
                            <Plus size={12} className="shrink-0" />
                            <span className="truncate">Prata</span>
                          </button>
                        </div>
                      </div>

                      {/* Gold Card */}
                      <div className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-2 ${goldCount > 0 ? "bg-amber-950/80 border-amber-500/60 shadow-[0_0_12px_rgba(251,191,36,0.2)]" : "bg-zinc-900/80 border-zinc-800/80"}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Trophy size={14} fill="currentColor" className={goldCount > 0 ? "text-amber-400" : "text-zinc-600"} />
                            <span className={`text-xs font-bold ${goldCount > 0 ? "text-amber-300" : "text-zinc-400"}`}>Ouro</span>
                          </div>
                          {goldCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-900 text-amber-300 font-mono text-[10px] font-extrabold border border-amber-500 shrink-0">
                              x{goldCount}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 w-full">
                          <button
                            type="button"
                            onClick={() => removeTrophy("gold")}
                            disabled={goldCount === 0}
                            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-20 text-zinc-300 font-black flex items-center justify-center text-sm cursor-pointer transition-all shrink-0"
                            title="Remover 1 Ouro"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => addTrophy("gold")}
                            className="flex-1 h-7 rounded-lg bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-500/50 text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer transition-all min-w-0"
                            title="Adicionar 1 Ouro"
                          >
                            <Plus size={12} className="shrink-0" />
                            <span className="truncate">Ouro</span>
                          </button>
                        </div>
                      </div>

                      {/* Platinum Card */}
                      <div className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-2 ${platinumCount > 0 ? "bg-cyan-950/90 border-cyan-400/80 shadow-[0_0_14px_rgba(34,211,238,0.25)]" : "bg-zinc-900/80 border-zinc-800/80"}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Trophy size={14} fill="currentColor" className={platinumCount > 0 ? "text-cyan-200 animate-pulse" : "text-zinc-600"} />
                            <span className={`text-xs font-bold ${platinumCount > 0 ? "text-cyan-100" : "text-zinc-400"}`}>Platina</span>
                          </div>
                          {platinumCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-cyan-900 text-cyan-200 font-mono text-[10px] font-extrabold border border-cyan-400 shrink-0">
                              x{platinumCount}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 w-full">
                          <button
                            type="button"
                            onClick={() => removeTrophy("platinum")}
                            disabled={platinumCount === 0}
                            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-20 text-zinc-300 font-black flex items-center justify-center text-sm cursor-pointer transition-all shrink-0"
                            title="Remover 1 Platina"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => addTrophy("platinum")}
                            className="flex-1 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-100 border border-cyan-400/60 text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer transition-all min-w-0"
                            title="Adicionar 1 Platina"
                          >
                            <Plus size={12} className="shrink-0" />
                            <span className="truncate">Platina</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Lista de Troféus com Caixas de Texto */}
                    {selectedTrophyItems.length > 0 ? (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                          <span>Anotações dos Troféus ({selectedTrophyItems.length})</span>
                          <span className="text-[10px] text-zinc-500 font-normal italic">
                            Aparece no tooltip em mouseover no card/painel
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {selectedTrophyItems.map((item, idx) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-xl border flex flex-col gap-2 transition-all ${
                                item.type === "platinum"
                                  ? "bg-cyan-950/30 border-cyan-500/40 text-cyan-100"
                                  : item.type === "gold"
                                  ? "bg-amber-950/30 border-amber-500/40 text-amber-100"
                                  : "bg-slate-900/50 border-slate-700/50 text-slate-100"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-bold ${
                                      item.type === "platinum"
                                        ? "bg-cyan-950 border-cyan-400/60 text-cyan-200"
                                        : item.type === "gold"
                                        ? "bg-amber-950 border-amber-500/60 text-amber-300"
                                        : "bg-slate-800 border-slate-500/60 text-slate-200"
                                    }`}
                                  >
                                    <Trophy size={12} fill="currentColor" />
                                    <span>
                                      {item.type === "platinum"
                                        ? "Platina"
                                        : item.type === "gold"
                                        ? "Ouro"
                                        : "Prata"}{" "}
                                      #{idx + 1}
                                    </span>
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeTrophyIndex(idx)}
                                  className="p-1 text-zinc-400 hover:text-rose-400 font-bold text-xs rounded-lg hover:bg-rose-950/40 transition-colors cursor-pointer"
                                  title="Remover este troféu"
                                >
                                  <X size={14} />
                                </button>
                              </div>

                              <textarea
                                rows={2}
                                value={item.note || ""}
                                onChange={(e) => updateTrophyNote(idx, e.target.value)}
                                placeholder="Escreva a anotação do troféu..."
                                className="w-full bg-zinc-950/90 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/70 focus:ring-1 focus:ring-cyan-500/30 font-mono leading-relaxed resize-y"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl text-center">
                        <p className="text-xs text-zinc-500 italic">
                          Nenhum troféu adicionado ainda. Clique nos botões acima para incluir Prata, Ouro ou Platina.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Seção de Replay Organizada */}
              <div className={`bg-zinc-950/80 p-4.5 rounded-2xl transition-all ${getCategoryBorderClass("replay", !!openBlocks["replay"])}`}>
                <div
                  onClick={() => toggleBlock("replay")}
                  className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-purple-500/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <RotateCcw size={16} className="text-purple-400 shrink-0" />
                    <h4 className="text-xs font-bold text-purple-200 uppercase tracking-wider font-mono shrink-0">
                      Replay & Re-plays
                    </h4>
                    {replayed && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-900/80 text-purple-200 text-[10px] font-mono border border-purple-500/50 shrink-0">
                        {replayCount || 1}x
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleBlock("replay")}
                      className="p-1 rounded-lg text-purple-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {openBlocks["replay"] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>

                {openBlocks["replay"] && (
                  <div className="pt-4 space-y-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] text-zinc-400">
                        Ative para indicar que jogou este jogo mais de uma vez e adicione observações.
                      </p>
                      <label className="flex items-center gap-2 cursor-pointer select-none bg-zinc-900 hover:bg-zinc-850 px-3.5 py-1.5 rounded-xl border border-zinc-800 transition-colors shrink-0" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={replayed}
                          onChange={(e) => {
                            setReplayed(e.target.checked);
                            if (e.target.checked && replayCount === 0) {
                              setReplayCount(1);
                            }
                          }}
                          className="rounded border-zinc-800 bg-zinc-950 text-purple-500 focus:ring-purple-500 h-4 w-4 accent-purple-500"
                        />
                        <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                          Ativar Replay
                        </span>
                      </label>
                    </div>

                    {replayed ? (
                      <div className="space-y-3 pt-1 animate-fade-in">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/70 p-3 rounded-xl border border-zinc-800/60">
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-purple-300 font-bold uppercase tracking-wider font-mono">
                              Vezes Jogadas:
                            </span>
                            <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-xl p-1">
                              <button
                                type="button"
                                onClick={() => setReplayCount(Math.max(1, replayCount - 1))}
                                className="w-7 h-7 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white font-bold text-sm flex items-center justify-center cursor-pointer hover:bg-zinc-800 transition-colors"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={replayCount || 1}
                                onChange={(e) => setReplayCount(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-12 py-0.5 bg-transparent text-sm text-white font-mono font-bold text-center focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setReplayCount(replayCount + 1)}
                                className="w-7 h-7 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white font-bold text-sm flex items-center justify-center cursor-pointer hover:bg-zinc-800 transition-colors"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <p className="text-[11px] text-zinc-400 italic font-sans flex-1">
                            Apenas o ícone <span className="font-mono text-purple-300 font-bold bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-500/30">[{replayCount || 1}x]</span> continuará visível nos cards, e a anotação vai para o tooltip.
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-purple-300 uppercase tracking-widest mb-1.5 font-mono">
                            Anotação do Replay (Exibida na Tooltip)
                          </label>
                          <textarea
                            rows={2.5}
                            value={replayNote}
                            onChange={(e) => setReplayNote(e.target.value)}
                            placeholder="Ex: 1ª Jogatina no PS4 em 2021; 2ª Jogatina no PS5 em 2026 no New Game+ (Modo Marcha da Morte sem morrer)"
                            className="w-full bg-zinc-900/90 border border-purple-900/40 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/60 leading-relaxed font-sans resize-y"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl text-center">
                        <p className="text-xs text-zinc-500 italic">
                          Marque a caixa acima se você jogou este jogo novamente para registrar quantas vezes jogou e suas anotações.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Jogo como Serviço (GaaS) Card */}
              <div className={`bg-zinc-950/80 p-4.5 rounded-2xl transition-all ${getCategoryBorderClass("gaas", !!openBlocks["gaas"])}`}>
                <div
                  onClick={() => toggleBlock("gaas")}
                  className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-pink-500/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Infinity size={18} className="text-pink-400 animate-pulse shrink-0" />
                    <h4 className="text-xs font-bold text-pink-200 uppercase tracking-wider font-mono shrink-0">
                      Game as a Service (GaaS)
                    </h4>
                    {isGaaS && (
                      <span className="px-2 py-0.5 rounded-full bg-pink-950 text-pink-300 border border-pink-500/40 text-[10px] font-mono font-bold shrink-0">
                        Ativo
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleBlock("gaas")}
                      className="p-1 rounded-lg text-pink-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {openBlocks["gaas"] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>

                {openBlocks["gaas"] && (
                  <div className="pt-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] text-zinc-400">
                        Jogos com suporte/conteúdo contínuo (ex: MMOs, Battle Royales). São contabilizados no tempo de jogo mas não entram em taxas de 100% de conclusão.
                      </p>

                      <label className="flex items-center gap-2 cursor-pointer select-none bg-zinc-900 hover:bg-zinc-850 px-3.5 py-1.5 rounded-xl border border-zinc-800 transition-colors shrink-0" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isGaaS}
                          onChange={(e) => setIsGaaS(e.target.checked)}
                          className="rounded border-zinc-800 bg-zinc-950 text-pink-500 focus:ring-pink-500 h-4 w-4 accent-pink-500"
                        />
                        <span className="text-xs font-bold uppercase tracking-wider text-pink-300 font-mono">
                          Ativar GaaS
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Datas de Jogatina */}
              <div id="block-dates" className={`scroll-mt-28 bg-zinc-950/80 p-4.5 rounded-2xl transition-all ${getCategoryBorderClass("dates", !!openBlocks["dates"])}`}>
                <div
                  onClick={() => toggleBlock("dates")}
                  className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-sky-500/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Calendar size={16} className="text-sky-400 shrink-0" />
                    <h4 className="text-xs font-bold text-sky-300 uppercase tracking-wider font-mono shrink-0">
                      Datas de Jogatina
                    </h4>
                    {!openBlocks["dates"] && (startDate || endDate) && (
                      <span className="text-xs text-sky-400 font-mono font-bold truncate">
                        — {startDate || "..."} até {endDate || "..."}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleBlock("dates")}
                      className="p-1 rounded-lg text-sky-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {openBlocks["dates"] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>

                {openBlocks["dates"] && (
                  <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-300 uppercase tracking-widest mb-1.5">
                        Data de Início
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-300 uppercase tracking-widest mb-1.5">
                        Data de Término
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Plataforma e Dificuldade Lado a Lado */}
              <div id="block-platform" className={`scroll-mt-28 bg-zinc-950/80 p-4.5 rounded-2xl transition-all ${getCategoryBorderClass("platform", !!openBlocks["platform"])}`}>
                <div
                  onClick={() => toggleBlock("platform")}
                  className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-indigo-500/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Monitor size={16} className="text-indigo-400 shrink-0" />
                    <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider font-mono shrink-0">
                      Plataforma e Dificuldade
                    </h4>
                    {!openBlocks["platform"] && (platform || difficulty) && (
                      <span className="text-xs text-indigo-400 font-mono font-bold truncate">
                        — {[platform, difficulty].filter(Boolean).join(" | ")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleBlock("platform")}
                      className="p-1 rounded-lg text-indigo-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {openBlocks["platform"] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>

                {openBlocks["platform"] && (
                  <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-300 uppercase tracking-widest mb-1.5">
                        Plataforma
                      </label>
                      <input
                        type="text"
                        value={platform}
                        onChange={(e) => setPlatform(e.target.value)}
                        placeholder="Ex: Nintendo Switch [OLED, Docked], PS5"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="text-[10px] text-zinc-500 mt-1">
                        Use colchetes <code className="text-indigo-400 font-mono font-bold">[ ]</code> para notas de contexto no tooltip!
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-300 uppercase tracking-widest mb-1.5">
                        Dificuldade
                      </label>
                      <input
                        type="text"
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value)}
                        placeholder="Ex: Hard [Sem Checklist], Marcha da Morte"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="text-[10px] text-zinc-500 mt-1">
                        Use colchetes <code className="text-indigo-400 font-mono font-bold">[ ]</code> para contextualizar no tooltip!
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Pros & Cons Inputs */}
              <div id="block-proscons" className={`scroll-mt-28 bg-zinc-950/80 p-4.5 rounded-2xl transition-all ${getCategoryBorderClass("proscons", !!openBlocks["proscons"])}`}>
                <div
                  onClick={() => toggleBlock("proscons")}
                  className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-emerald-500/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ThumbsUp size={16} className="text-emerald-400 shrink-0" />
                    <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider font-mono shrink-0">
                      Prós e Contras
                    </h4>
                    {!openBlocks["proscons"] && (pros || cons) && (
                      <span className="text-xs text-emerald-400 font-mono font-bold truncate">
                        — Prós & Contras registrados
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleBlock("proscons")}
                      className="p-1 rounded-lg text-emerald-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {openBlocks["proscons"] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>

                {openBlocks["proscons"] && (
                  <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-2xl p-4 space-y-2 flex flex-col">
                      <label className="block text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                        <ThumbsUp size={14} className="text-emerald-400 shrink-0" />
                        <span>+ Prós (Pressione Enter ou ';')</span>
                      </label>
                      <textarea
                        rows={4}
                        value={pros}
                        onChange={(e) => setPros(e.target.value)}
                        placeholder="Ex: Gráficos [Rodou a 60 FPS com Ray Tracing]&#10;Trilha sonora [Música do chefe épica e marcante]&#10;Jogabilidade [Controles responsivos]"
                        className="w-full flex-1 bg-zinc-900/90 border border-emerald-900/40 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 leading-relaxed font-sans resize-y min-h-[110px]"
                      />
                      <p className="text-[11px] text-zinc-400 leading-tight">
                        Pressione <code className="text-emerald-400 font-mono font-bold bg-emerald-950/60 px-1 py-0.5 rounded border border-emerald-800/40">Enter</code> ou separe por <code className="text-emerald-400 font-mono font-bold bg-emerald-950/60 px-1 py-0.5 rounded border border-emerald-800/40">;</code>. O texto em colchetes <code className="text-emerald-400 font-mono font-bold bg-emerald-950/60 px-1 py-0.5 rounded border border-emerald-800/40">[ ]</code> vira tooltip no mouseover!
                      </p>
                    </div>

                    <div className="bg-rose-950/30 border border-rose-500/40 rounded-2xl p-4 space-y-2 flex flex-col">
                      <label className="block text-xs font-bold text-rose-400 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                        <ThumbsDown size={14} className="text-rose-400 shrink-0" />
                        <span>- Contras (Pressione Enter ou ';')</span>
                      </label>
                      <textarea
                        rows={4}
                        value={cons}
                        onChange={(e) => setCons(e.target.value)}
                        placeholder="Ex: Bugs [Apenas no lançamento antes do patch 1.2]&#10;História curta [Zerado em apenas 8 horas de campanha]"
                        className="w-full flex-1 bg-zinc-900/90 border border-rose-900/40 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-rose-500/60 leading-relaxed font-sans resize-y min-h-[110px]"
                      />
                      <p className="text-[11px] text-zinc-400 leading-tight">
                        Pressione <code className="text-rose-400 font-mono font-bold bg-rose-950/60 px-1 py-0.5 rounded border border-rose-800/40">Enter</code> ou separe por <code className="text-rose-400 font-mono font-bold bg-rose-950/60 px-1 py-0.5 rounded border border-rose-800/40">;</code>. O texto em colchetes <code className="text-rose-400 font-mono font-bold bg-rose-950/60 px-1 py-0.5 rounded border border-rose-800/40">[ ]</code> vira tooltip no mouseover!
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Categoria de Progresso & DLC */}
              <div id="block-status" className={`scroll-mt-28 bg-zinc-950/80 p-4.5 rounded-2xl transition-all ${getCategoryBorderClass("status", !!openBlocks["status"])}`}>
                <div
                  onClick={() => toggleBlock("status")}
                  className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-emerald-500/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                    <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider font-mono shrink-0">
                      Categoria de Progresso & Expansões *
                    </h4>
                    {!openBlocks["status"] && selectedStatus.length > 0 && (
                      <span className="text-xs text-emerald-400 font-mono font-bold truncate">
                        — {selectedStatus.join(", ")} {dlcMode !== "none" ? `(${dlcMode})` : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleBlock("status")}
                      className="p-1 rounded-lg text-emerald-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {openBlocks["status"] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>

                {openBlocks["status"] && (
                  <div className="pt-4 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                      {["Jogando", "Em Hiatus", "Terminado", "Backlog", "Desistido"].map((status) => (
                        <label key={status} className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={selectedStatus.includes(status)}
                            onChange={() => toggleStatus(status)}
                            className="rounded border-zinc-800 bg-zinc-950 text-emerald-500 focus:ring-emerald-500 h-4 w-4 accent-emerald-500"
                          />
                          {status}
                        </label>
                      ))}
                    </div>
                    <div className="mt-3 px-1 pt-2 border-t border-zinc-800/60">
                      <div className="w-full">
                        <span className="block font-bold text-xs uppercase tracking-wider text-amber-300 mb-1.5 flex items-center gap-1.5">
                          <Layers size={13} className="stroke-[2.5]" />
                          Marcador de DLC / Expansão
                        </span>
                        <div className="grid grid-cols-3 gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                          <button
                            type="button"
                            onClick={() => setDlcMode("none")}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                              dlcMode === "none"
                                ? "bg-zinc-800 text-white shadow"
                                : "text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            Nenhum
                          </button>
                          <button
                            type="button"
                            onClick={() => setDlcMode("dlc")}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                              dlcMode === "dlc"
                                ? "bg-amber-950 text-amber-300 border border-amber-500/50 shadow"
                                : "text-zinc-500 hover:text-amber-300"
                            }`}
                            title="Apenas a Expansão / DLC"
                          >
                            <Layers size={11} />
                            DLC
                          </button>
                          <button
                            type="button"
                            onClick={() => setDlcMode("plus_dlc")}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                              dlcMode === "plus_dlc"
                                ? "bg-amber-950 text-amber-300 border border-amber-500/50 shadow"
                                : "text-zinc-500 hover:text-amber-300"
                            }`}
                            title="Jogo Base + Conteúdo DLC"
                          >
                            <Layers size={11} />
                            +DLC
                          </button>
                        </div>
                        <p className="text-[10px] text-zinc-500 italic mt-1 font-sans">
                          {dlcMode === "none" && "Jogo padrão sem marcador adicional"}
                          {dlcMode === "dlc" && "Indica que este item é uma Expansão / DLC individual"}
                          {dlcMode === "plus_dlc" && "Indica que a jogada conta o Jogo Base + DLC"}
                        </p>

                        {dlcMode !== "none" && (
                          <div className="mt-3 animate-fade-in">
                            <label className="block text-[10px] uppercase tracking-wider text-amber-300 font-bold mb-1">
                              Nome das DLCs / Expansões Jogadas
                            </label>
                            <input
                              type="text"
                              value={dlcNames}
                              onChange={(e) => setDlcNames(e.target.value)}
                              placeholder="Ex: Shadow of the Erdtree [100% Zerada]; Blood and Wine [Terminada no PS5]"
                              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-amber-900/40 text-amber-200 placeholder-zinc-600 outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                            />
                            <p className="text-[10px] text-zinc-500 italic mt-1">
                              Separe nomes por ponto e vírgula ( ; ). Use colchetes <code className="text-amber-400 font-mono font-bold">[ ]</code> para contextualizar no tooltip!
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Gêneros */}
              <div id="block-genres" className={`scroll-mt-28 bg-zinc-950/80 p-4.5 rounded-2xl transition-all ${getCategoryBorderClass("genres", !!openBlocks["genres"])}`}>
                <div
                  onClick={() => toggleBlock("genres")}
                  className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-fuchsia-500/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Gamepad2 size={16} className="text-fuchsia-400 shrink-0" />
                    <h4 className="text-xs font-bold text-fuchsia-300 uppercase tracking-wider font-mono shrink-0">
                      Gêneros *
                    </h4>
                    {!openBlocks["genres"] && selectedGenres.length > 0 && (
                      <span className="text-xs text-fuchsia-400 font-mono font-bold truncate">
                        — {selectedGenres.join(", ")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleBlock("genres")}
                      className="p-1 rounded-lg text-fuchsia-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {openBlocks["genres"] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>

                {openBlocks["genres"] && (
                  <div className="pt-4 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-fuchsia-300 uppercase tracking-widest font-mono">
                        Selecione os gêneros do jogo
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowNewGenre(!showNewGenre)}
                        className="text-[10px] uppercase tracking-[0.25em] text-fuchsia-400 font-extrabold hover:underline cursor-pointer"
                      >
                        Criar Gênero
                      </button>
                    </div>

                    {showNewGenre && (
                      <div className="mb-3 flex gap-2 p-3 rounded-2xl bg-zinc-900 border border-zinc-800">
                        <input
                          type="text"
                          value={newGenreVal}
                          onChange={(e) => setNewGenreVal(e.target.value)}
                          placeholder="Nome do gênero..."
                          className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                        />
                        <button
                          type="button"
                          onClick={submitCustomGenre}
                          className="px-4 py-2 rounded-xl bg-cyan-600 text-white font-bold text-xs"
                        >
                          Confirmar
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-zinc-900 border border-zinc-800 max-h-32 overflow-y-auto">
                      {globalGenres.map((genre, idx) => {
                        const isSelected = selectedGenres.includes(genre);
                        const isEditing = editingGenre === genre;
                        return isEditing ? (
                          <div
                            key={`genre-edit-${genre}-${idx}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-zinc-800 bg-zinc-950 text-xs font-semibold"
                          >
                            <input
                              type="text"
                              value={editingGenreValue}
                              onChange={(e) => setEditingGenreValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (onEditGlobalGenre && editingGenreValue.trim()) {
                                    onEditGlobalGenre(genre, editingGenreValue.trim());
                                  }
                                  setEditingGenre(null);
                                } else if (e.key === "Escape") {
                                  setEditingGenre(null);
                                }
                              }}
                              className="w-20 bg-transparent text-white outline-none border-b border-cyan-500 text-xs py-0.5"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (onEditGlobalGenre && editingGenreValue.trim()) {
                                  onEditGlobalGenre(genre, editingGenreValue.trim());
                                }
                                setEditingGenre(null);
                              }}
                              className="text-green-400 hover:text-green-300 text-xs font-bold px-1 cursor-pointer"
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingGenre(null)}
                              className="text-zinc-400 hover:text-zinc-200 text-xs font-bold px-1 cursor-pointer"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <div
                            key={`genre-view-${genre}-${idx}`}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-semibold transition-all ${
                              isSelected
                                ? "bg-purple-600/25 text-purple-300 border-purple-500/40"
                                : "bg-zinc-950 text-zinc-400 border-zinc-800"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleGenre(genre)}
                              className="hover:text-white transition-colors cursor-pointer"
                            >
                              {genre}
                            </button>
                            {onEditGlobalGenre && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingGenre(genre);
                                  setEditingGenreValue(genre);
                                }}
                                className="text-zinc-500 hover:text-cyan-400 hover:bg-zinc-800 p-0.5 rounded transition-all cursor-pointer flex items-center justify-center w-4 h-4 text-xs font-bold ml-1"
                                title="Editar gênero"
                              >
                                ✎
                              </button>
                            )}
                            {onDeleteGlobalGenre && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteGlobalGenre(genre);
                                }}
                                className="text-zinc-500 hover:text-red-400 hover:bg-zinc-850 p-0.5 rounded transition-all cursor-pointer flex items-center justify-center w-4 h-4 text-xs font-bold ml-0.5"
                                title="Excluir gênero"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Etiquetas / Tags */}
              <div id="block-tags" className={`scroll-mt-28 bg-zinc-950/80 p-4.5 rounded-2xl transition-all ${getCategoryBorderClass("tags", !!openBlocks["tags"])}`}>
                <div
                  onClick={() => toggleBlock("tags")}
                  className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-cyan-500/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Tag size={16} className="text-cyan-400 shrink-0" />
                    <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider font-mono shrink-0">
                      Etiquetas / Tags
                    </h4>
                    {!openBlocks["tags"] && selectedTags.length > 0 && (
                      <span className="text-xs text-cyan-400 font-mono font-bold truncate">
                        — {selectedTags.join(", ")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleBlock("tags")}
                      className="p-1 rounded-lg text-cyan-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {openBlocks["tags"] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>

                {openBlocks["tags"] && (
                  <div className="pt-4 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-cyan-300 uppercase tracking-widest font-mono">
                        Selecione as tags
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowNewTag(!showNewTag)}
                        className="text-[10px] uppercase tracking-[0.25em] text-cyan-400 font-extrabold hover:underline cursor-pointer"
                      >
                        Criar Tag
                      </button>
                    </div>

                    {showNewTag && (
                      <div className="mb-3 flex gap-2 p-3 rounded-2xl bg-zinc-900 border border-zinc-800">
                        <input
                          type="text"
                          value={newTagVal}
                          onChange={(e) => setNewTagVal(e.target.value)}
                          placeholder="Tag customizada..."
                          className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                        />
                        <button
                          type="button"
                          onClick={submitCustomTag}
                          className="px-4 py-2 rounded-xl bg-cyan-600 text-white font-bold text-xs cursor-pointer"
                        >
                          Confirmar
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-zinc-900 border border-zinc-800 max-h-36 overflow-y-auto">
                      {globalTags.map((tag, idx) => {
                        const isSelected = selectedTags.includes(tag);
                        const isEditing = editingTag === tag;
                        return isEditing ? (
                          <div
                            key={`tag-edit-${tag}-${idx}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-zinc-800 bg-zinc-950 text-xs font-semibold"
                          >
                            <input
                              type="text"
                              value={editingTagValue}
                              onChange={(e) => setEditingTagValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (onEditGlobalTag && editingTagValue.trim()) {
                                    onEditGlobalTag(tag, editingTagValue.trim());
                                  }
                                  setEditingTag(null);
                                } else if (e.key === "Escape") {
                                  setEditingTag(null);
                                }
                              }}
                              className="w-20 bg-transparent text-white outline-none border-b border-cyan-500 text-xs py-0.5"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (onEditGlobalTag && editingTagValue.trim()) {
                                  onEditGlobalTag(tag, editingTagValue.trim());
                                }
                                setEditingTag(null);
                              }}
                              className="text-green-400 hover:text-green-300 text-xs font-bold px-1 cursor-pointer"
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTag(null)}
                              className="text-zinc-400 hover:text-zinc-200 text-xs font-bold px-1 cursor-pointer"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <div
                            key={`tag-view-${tag}-${idx}`}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-semibold transition-all ${
                              isSelected
                                ? "bg-cyan-600/25 text-cyan-300 border-cyan-500/40"
                                : "bg-zinc-950 text-zinc-400 border-zinc-800"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleTag(tag)}
                              className="hover:text-white transition-colors cursor-pointer"
                            >
                              {tag}
                            </button>
                            {onEditGlobalTag && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingTag(tag);
                                  setEditingTagValue(tag);
                                }}
                                className="text-zinc-500 hover:text-cyan-400 hover:bg-zinc-800 p-0.5 rounded transition-all cursor-pointer flex items-center justify-center w-4 h-4 text-xs font-bold ml-1"
                                title="Editar tag"
                              >
                                ✎
                              </button>
                            )}
                            {onDeleteGlobalTag && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteGlobalTag(tag);
                                }}
                                className="text-zinc-500 hover:text-red-400 hover:bg-zinc-850 p-0.5 rounded transition-all cursor-pointer flex items-center justify-center w-4 h-4 text-xs font-bold ml-0.5"
                                title="Excluir tag"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* HowLongToBeat (HLTB) Integration Section - Borda Roxa */}
              <div id="block-hltb" className="scroll-mt-28 bg-zinc-950/80 border-2 border-purple-500/70 bg-purple-950/20 shadow-md shadow-purple-500/10 rounded-2xl p-4.5 space-y-4">
                <div className="flex items-center justify-between border-b border-purple-500/30 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-purple-300 font-mono">
                      Métricas HowLongToBeat (HLTB)
                    </h4>
                  </div>
                  <div className="flex gap-2">
                    {hltbId && (
                      <button
                        type="button"
                        onClick={handleRefreshHltb}
                        disabled={isFetchingHltb}
                        className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors px-2.5 py-1.5 bg-amber-950/20 border border-amber-800/30 rounded-xl hover:bg-amber-950/40 font-semibold cursor-pointer disabled:opacity-50"
                        title="Atualizar dados direto do HowLongToBeat"
                      >
                        {isFetchingHltb ? (
                          <Loader2 size={12} className="animate-spin text-amber-500" />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                        <span>Sincronizar</span>
                      </button>
                    )}
                    {!showHltbImport && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowHltbImport(true);
                        }}
                        className="text-xs font-bold text-purple-300 hover:text-purple-200 flex items-center gap-1.5 transition-colors px-2.5 py-1.5 bg-purple-950/50 border border-purple-500/40 rounded-xl hover:bg-purple-900/60 font-semibold cursor-pointer"
                      >
                        <Globe size={12} />
                        {hltbMain ? "Vincular Outro Link" : "Importar via Link"}
                      </button>
                    )}
                  </div>
                </div>

                {showHltbImport ? (
                  <div className="space-y-3">
                    <p className="text-[10px] text-zinc-400">
                      Cole o link da página do jogo no HowLongToBeat (ex: <code className="text-purple-300 bg-zinc-950 px-1 py-0.5 rounded">https://howlongtobeat.com/game/10270</code>) ou apenas o ID numérico:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={hltbUrlInput}
                        onChange={(e) => setHltbUrlInput(e.target.value)}
                        placeholder="Cole o link ou ID do HLTB..."
                        className="flex-1 bg-zinc-950 border border-purple-900/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleLoadHltbUrl();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleLoadHltbUrl}
                        disabled={isFetchingHltb}
                        className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        {isFetchingHltb ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Check size={12} />
                        )}
                        <span>Carregar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowHltbImport(false)}
                        className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {hltbMain || hltbExtra || hltbCompletionist ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {hltbMain && (
                            <button
                              type="button"
                              onClick={() => setPlaytime(hltbMain)}
                              className="p-2.5 rounded-xl bg-zinc-950 border border-purple-500/30 hover:border-purple-500/60 hover:bg-purple-950/30 text-left transition-all group/metric cursor-pointer"
                              title="Clique para aplicar este tempo como Tempo de Jogo"
                            >
                              <span className="block text-[9px] font-black uppercase text-zinc-400 tracking-wider">História Principal</span>
                              <span className="text-sm font-black text-purple-300 font-mono mt-0.5 block flex items-center justify-between">
                                <span>{hltbMain}</span>
                                <span className="text-[9px] opacity-0 group-hover/metric:opacity-100 transition-opacity text-purple-400 font-sans">Usar →</span>
                              </span>
                            </button>
                          )}
                          {hltbExtra && (
                            <button
                              type="button"
                              onClick={() => setPlaytime(hltbExtra)}
                              className="p-2.5 rounded-xl bg-zinc-950 border border-purple-500/30 hover:border-cyan-500/60 hover:bg-cyan-950/30 text-left transition-all group/metric cursor-pointer"
                              title="Clique para aplicar este tempo como Tempo de Jogo"
                            >
                              <span className="block text-[9px] font-black uppercase text-zinc-400 tracking-wider">História + Extras</span>
                              <span className="text-sm font-black text-cyan-300 font-mono mt-0.5 block flex items-center justify-between">
                                <span>{hltbExtra}</span>
                                <span className="text-[9px] opacity-0 group-hover/metric:opacity-100 transition-opacity text-cyan-400 font-sans">Usar →</span>
                              </span>
                            </button>
                          )}
                          {hltbCompletionist && (
                            <button
                              type="button"
                              onClick={() => setPlaytime(hltbCompletionist)}
                              className="p-2.5 rounded-xl bg-zinc-950 border border-purple-500/30 hover:border-pink-500/60 hover:bg-pink-950/30 text-left transition-all group/metric cursor-pointer"
                              title="Clique para aplicar este tempo como Tempo de Jogo"
                            >
                              <span className="block text-[9px] font-black uppercase text-zinc-400 tracking-wider">Complecionista (100%)</span>
                              <span className="text-sm font-black text-pink-300 font-mono mt-0.5 block flex items-center justify-between">
                                <span>{hltbCompletionist}</span>
                                <span className="text-[9px] opacity-0 group-hover/metric:opacity-100 transition-opacity text-pink-400 font-sans">Usar →</span>
                              </span>
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 text-center flex items-center justify-center gap-1">
                          <Clock size={10} className="text-purple-400" />
                          <span>Dica: Clique em qualquer card de tempo acima para preencher o "Tempo de Jogo"!</span>
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-3 text-xs text-zinc-400 italic">
                        Nenhuma métrica vinculada a este jogo ainda. Clique em "Importar via Link" para colar a página do HowLongToBeat!
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Metacritic Integration Section - Borda Laranja / Amber */}
              <div className="bg-zinc-950/80 border-2 border-amber-500/70 bg-amber-950/20 shadow-md shadow-amber-500/10 rounded-2xl p-4.5 space-y-4">
                <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-amber-300 font-mono">
                      Notas do Metacritic
                    </h4>
                  </div>
                  <div className="flex gap-2">
                    {metacriticUrl && (
                      <button
                        type="button"
                        onClick={handleRefreshMetacritic}
                        disabled={isFetchingMetacritic}
                        className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors px-2.5 py-1.5 bg-amber-950/30 border border-amber-500/40 rounded-xl hover:bg-amber-950/50 font-semibold cursor-pointer disabled:opacity-50"
                        title="Atualizar notas direto do Metacritic"
                      >
                        {isFetchingMetacritic ? (
                          <Loader2 size={12} className="animate-spin text-amber-500" />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                        <span>Sincronizar</span>
                      </button>
                    )}
                    {!showMetacriticImport && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMetacriticImport(true);
                        }}
                        className="text-xs font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1.5 transition-colors px-2.5 py-1.5 bg-amber-950/50 border border-amber-500/40 rounded-xl hover:bg-amber-900/60 font-semibold cursor-pointer"
                      >
                        <Globe size={12} />
                        {metacriticUrl ? "Vincular Outro Link" : "Importar via Link"}
                      </button>
                    )}
                  </div>
                </div>

                {showMetacriticImport ? (
                  <div className="space-y-3">
                    <p className="text-[10px] text-zinc-400">
                      Cole o link da página do jogo no Metacritic (ex: <code className="text-amber-300 bg-zinc-950 px-1 py-0.5 rounded">https://www.metacritic.com/game/metroid-dread/</code>):
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={metacriticUrlInput}
                        onChange={(e) => setMetacriticUrlInput(e.target.value)}
                        placeholder="Cole o link do Metacritic..."
                        className="flex-1 bg-zinc-950 border border-amber-900/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleLoadMetacriticUrl();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleLoadMetacriticUrl}
                        disabled={isFetchingMetacritic}
                        className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        {isFetchingMetacritic ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Check size={12} />
                        )}
                        <span>Carregar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMetacriticImport(false)}
                        className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {metacriticCritScore !== undefined || metacriticUserScore !== undefined ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {metacriticCritScore !== undefined && (
                            <div className="p-2.5 rounded-xl bg-zinc-950 border border-amber-500/30 text-left">
                              <span className="block text-[9px] font-black uppercase text-zinc-400 tracking-wider">Média da Crítica (Metascore)</span>
                              <span className="text-sm font-black text-amber-300 font-mono mt-0.5 block flex items-center justify-between">
                                <span>{metacriticCritScore}</span>
                              </span>
                            </div>
                          )}
                          {metacriticUserScore !== undefined && (
                            <div className="p-2.5 rounded-xl bg-zinc-950 border border-amber-500/30 text-left">
                              <span className="block text-[9px] font-black uppercase text-zinc-400 tracking-wider">Média dos Usuários</span>
                              <span className="text-sm font-black text-cyan-300 font-mono mt-0.5 block flex items-center justify-between">
                                <span>{metacriticUserScore.toFixed(1)}</span>
                              </span>
                            </div>
                          )}
                        </div>

                        {metacriticUrl && metacriticPlatforms.length > 0 && (
                          <div className="pt-2 border-t border-amber-500/20">
                            <label className="block text-[10px] font-bold text-amber-300 uppercase tracking-wider mb-1 text-left font-mono">
                              Extrair dados da plataforma:
                            </label>
                            <select
                              value={selectedMetacriticPlatform}
                              onChange={(e) => handleSelectFormPlatform(e.target.value)}
                              disabled={isFetchingMetacritic}
                              className="w-full bg-zinc-950 border border-amber-900/40 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50 cursor-pointer"
                            >
                              <option value="">Geral (Média Principal)</option>
                              {metacriticPlatforms.map((p) => (
                                <option key={p.code} value={p.code}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-3 text-xs text-zinc-400 italic">
                        Nenhuma nota do Metacritic vinculada a este jogo ainda. Clique em "Importar via Link"!
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Integração de Plataforma / Loja (Steam vs GOG) */}
              <div id="block-steam" className="bg-zinc-950/80 border-2 border-cyan-500/70 bg-cyan-950/20 shadow-md shadow-cyan-500/10 rounded-2xl p-4.5 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-cyan-300 flex items-center gap-1.5 font-mono">
                      <Gamepad2 size={14} className="text-cyan-400" />
                      Plataforma & Integração de Estatísticas
                    </h4>
                  </div>

                  {/* Tabs para alternar entre Steam e GOG */}
                  <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setIntegrationPlatform("steam")}
                      className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                        integrationPlatform === "steam"
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30 ring-1 ring-blue-400/50"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      <span>Steam</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIntegrationPlatform("gog");
                        handleFetchUserGogGames();
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                        integrationPlatform === "gog"
                          ? "bg-purple-600 text-white shadow-sm shadow-purple-500/30 ring-1 ring-purple-400/50"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                      <span>GOG Galaxy</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIntegrationPlatform("none")}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        integrationPlatform === "none"
                          ? "bg-zinc-800 text-zinc-200"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      <span>Desativado</span>
                    </button>
                  </div>
                </div>

                {/* STEAM INTEGRATION PANEL */}
                {integrationPlatform === "steam" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] text-blue-300/80 font-medium flex items-center gap-1.5">
                        <Globe size={13} className="text-blue-400" />
                        <span>Sincronia oficial via Steam Web API</span>
                      </div>
                      <div className="flex gap-2">
                        {steamAppId && (
                          <>
                            <button
                              type="button"
                              onClick={handleSyncSteamData}
                              disabled={isFetchingSteam}
                              className="text-xs font-bold text-blue-300 hover:text-blue-200 flex items-center gap-1 transition-colors px-2.5 py-1.5 bg-blue-950/40 border border-blue-500/40 rounded-xl hover:bg-blue-900/60 font-semibold cursor-pointer disabled:opacity-50"
                              title="Atualizar dados e horas de jogo da Steam"
                            >
                              {isFetchingSteam ? (
                                <Loader2 size={12} className="animate-spin text-blue-400" />
                              ) : (
                                <RefreshCw size={12} />
                              )}
                              <span>Sincronizar</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleUnlinkSteam}
                              className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors px-2.5 py-1.5 bg-red-950/20 border border-red-800/30 rounded-xl hover:bg-red-950/40 cursor-pointer"
                              title="Desvincular da Steam"
                            >
                              Desvincular
                            </button>
                          </>
                        )}
                        {!showSteamImport && !steamAppId && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowSteamImport(true);
                              handleFetchUserSteamGames();
                            }}
                            className="text-xs font-bold text-blue-300 hover:text-blue-200 flex items-center gap-1.5 transition-colors px-2.5 py-1.5 bg-blue-950/50 border border-blue-500/40 rounded-xl hover:bg-blue-900/60 font-semibold cursor-pointer"
                          >
                            <Globe size={12} />
                            <span>Vincular Jogo da Steam</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {showSteamImport ? (
                      <div className="space-y-3 bg-zinc-950 p-3.5 border border-blue-900/40 rounded-xl">
                        <p className="text-[10px] text-zinc-400">
                          Selecione o jogo correspondente da sua biblioteca Steam ou informe o App ID/link da Steam:
                        </p>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={steamUrlInput}
                            onChange={(e) => setSteamUrlInput(e.target.value)}
                            placeholder="App ID (ex: 1091500) ou link da loja Steam..."
                            className="flex-1 bg-zinc-900 border border-blue-900/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleLoadSteamInput();
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleLoadSteamInput}
                            disabled={isFetchingSteam}
                            className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            {isFetchingSteam ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            <span>Vincular</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowSteamImport(false)}
                            className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-colors cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>

                        {isLoadingSteamGames ? (
                          <div className="py-2 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                            <Loader2 size={14} className="animate-spin text-blue-400" />
                            <span>Buscando jogos da sua conta Steam...</span>
                          </div>
                        ) : steamUserGamesList.length > 0 ? (
                          <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                              Escolha um jogo da sua biblioteca Steam ({steamUserGamesList.length} jogos):
                            </label>
                            <div className="max-h-44 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                              {steamUserGamesList
                                .filter((sg) => !name || sg.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(sg.name.toLowerCase()) || !steamUrlInput || sg.name.toLowerCase().includes(steamUrlInput.toLowerCase()))
                                .slice(0, 20)
                                .map((sg) => (
                                  <div
                                    key={sg.appid}
                                    onClick={() => handleLinkSteamGame(sg)}
                                    className="p-2 bg-zinc-900 hover:bg-blue-950/40 border border-zinc-800 hover:border-blue-500/40 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-2 group"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <img
                                        src={getSteamHeaderImageUrl(sg.appid)}
                                        alt={sg.name}
                                        className="w-12 h-6 object-cover rounded border border-zinc-800 shrink-0"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                      />
                                      <span className="text-xs font-bold text-zinc-200 group-hover:text-blue-300 truncate">
                                        {sg.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-[11px] font-mono font-bold text-cyan-400">
                                        {formatSteamPlaytime(sg.playtime_forever)}
                                      </span>
                                      <span className="text-[10px] font-bold bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded-lg">
                                        Vincular
                                      </span>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : steamAppId ? (
                      <div className="space-y-3">
                        <div className="p-3 rounded-xl bg-zinc-950 border border-blue-500/30 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={getSteamHeaderImageUrl(steamAppId)}
                              alt={`Steam App ${steamAppId}`}
                              className="w-16 h-8 object-cover rounded-lg border border-zinc-800 shrink-0"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white truncate">App ID: {steamAppId}</span>
                                <a
                                  href={`https://store.steampowered.com/app/${steamAppId}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-blue-400 hover:underline"
                                >
                                  Ver na Loja ↗
                                </a>
                              </div>
                              {steamPlaytimeMinutes !== undefined && steamPlaytimeMinutes > 0 && (
                                <p className="text-xs font-mono font-bold text-cyan-400 mt-0.5">
                                  Tempo na Steam: {formatSteamPlaytime(steamPlaytimeMinutes)}
                                </p>
                              )}
                            </div>
                          </div>

                          {steamPlaytimeMinutes !== undefined && steamPlaytimeMinutes > 0 && (
                            <button
                              type="button"
                              onClick={() => setPlaytime(formatSteamPlaytime(steamPlaytimeMinutes))}
                              className="px-2.5 py-1.5 bg-blue-950/60 hover:bg-blue-900 border border-blue-500/40 text-blue-200 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
                              title="Copiar tempo registrado na Steam para o campo Tempo de Jogo"
                            >
                              Usar Horas →
                            </button>
                          )}
                        </div>

                        {steamAchieveData && steamAchieveData.totalCount > 0 && (
                          <div className="p-2.5 rounded-xl bg-zinc-950 border border-amber-500/30 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Trophy size={14} className="text-amber-400" />
                              <span className="text-xs font-bold text-zinc-300">
                                Conquistas Desbloqueadas:
                              </span>
                              <span className="text-xs font-mono font-extrabold text-amber-400">
                                {steamAchieveData.unlockedCount} / {steamAchieveData.totalCount} ({steamAchieveData.percentage}%)
                              </span>
                            </div>
                            <div className="w-24 h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                              <div
                                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400"
                                style={{ width: `${steamAchieveData.percentage}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-3 text-xs text-zinc-400 italic">
                        Nenhum jogo da Steam vinculado. Clique em "Vincular Jogo da Steam" para sincronizar horas e conquistas!
                      </div>
                    )}
                  </div>
                )}

                {/* GOG GALAXY INTEGRATION PANEL */}
                {integrationPlatform === "gog" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] text-purple-300/80 font-medium flex items-center gap-1.5">
                        <Globe size={13} className="text-purple-400" />
                        <span>Sincronia oficial via GOG Galaxy API</span>
                      </div>
                      <div className="flex gap-2">
                        {gogGameId && (
                          <>
                            <button
                              type="button"
                              onClick={handleSyncGogData}
                              disabled={isFetchingGog}
                              className="text-xs font-bold text-purple-300 hover:text-purple-200 flex items-center gap-1 transition-colors px-2.5 py-1.5 bg-purple-950/40 border border-purple-500/40 rounded-xl hover:bg-purple-900/60 font-semibold cursor-pointer disabled:opacity-50"
                              title="Atualizar dados e horas de jogo da GOG"
                            >
                              {isFetchingGog ? (
                                <Loader2 size={12} className="animate-spin text-purple-400" />
                              ) : (
                                <RefreshCw size={12} />
                              )}
                              <span>Sincronizar</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleUnlinkGog}
                              className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors px-2.5 py-1.5 bg-red-950/20 border border-red-800/30 rounded-xl hover:bg-red-950/40 cursor-pointer"
                              title="Desvincular da GOG"
                            >
                              Desvincular
                            </button>
                          </>
                        )}
                        {!showGogImport && !gogGameId && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowGogImport(true);
                              handleFetchUserGogGames();
                            }}
                            className="text-xs font-bold text-purple-300 hover:text-purple-200 flex items-center gap-1.5 transition-colors px-2.5 py-1.5 bg-purple-950/50 border border-purple-500/40 rounded-xl hover:bg-purple-900/60 font-semibold cursor-pointer"
                          >
                            <Globe size={12} />
                            <span>Vincular Jogo da GOG</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {showGogImport ? (
                      <div className="space-y-3 bg-zinc-950 p-3.5 border border-purple-900/40 rounded-xl">
                        <p className="text-[10px] text-zinc-400">
                          Selecione o jogo correspondente da sua biblioteca GOG ou digite o ID / nome:
                        </p>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={gogUrlInput}
                            onChange={(e) => setGogUrlInput(e.target.value)}
                            placeholder="ID do jogo GOG ou nome do jogo..."
                            className="flex-1 bg-zinc-900 border border-purple-900/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleLoadGogInput();
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleLoadGogInput}
                            disabled={isFetchingGog}
                            className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            {isFetchingGog ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            <span>Vincular</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowGogImport(false)}
                            className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-colors cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>

                        {isLoadingGogGames ? (
                          <div className="py-2 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                            <Loader2 size={14} className="animate-spin text-purple-400" />
                            <span>Buscando jogos da sua conta GOG...</span>
                          </div>
                        ) : gogUserGamesList.length > 0 ? (
                          <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                              Escolha um jogo da sua biblioteca GOG ({gogUserGamesList.length} jogos):
                            </label>
                            <div className="max-h-44 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                              {gogUserGamesList
                                .filter((gg) => !name || gg.title.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(gg.title.toLowerCase()) || !gogUrlInput || gg.title.toLowerCase().includes(gogUrlInput.toLowerCase()))
                                .slice(0, 20)
                                .map((gg) => (
                                  <div
                                    key={gg.id}
                                    onClick={() => handleLinkGogGame(gg)}
                                    className="p-2 bg-zinc-900 hover:bg-purple-950/40 border border-zinc-800 hover:border-purple-500/40 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-2 group"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-xs font-bold text-zinc-200 group-hover:text-purple-300 truncate">
                                        {gg.title}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-[11px] font-mono font-bold text-fuchsia-400">
                                        {formatGogPlaytime(gg.playtime_minutes)}
                                      </span>
                                      <span className="text-[10px] font-bold bg-purple-600 hover:bg-purple-500 text-white px-2 py-0.5 rounded-lg">
                                        Vincular
                                      </span>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : gogGameId ? (
                      <div className="space-y-3">
                        <div className="p-3 rounded-xl bg-zinc-950 border border-purple-500/30 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white truncate">GOG Game ID: {gogGameId}</span>
                                <a
                                  href={`https://www.gog.com/en/game/${gogGameId}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-purple-400 hover:underline"
                                >
                                  Ver na GOG / Galaxy ↗
                                </a>
                              </div>
                              {gogPlaytimeMinutes !== undefined && gogPlaytimeMinutes > 0 && (
                                <p className="text-xs font-mono font-bold text-fuchsia-400 mt-0.5">
                                  Tempo na GOG: {formatGogPlaytime(gogPlaytimeMinutes)}
                                </p>
                              )}
                            </div>
                          </div>

                          {gogPlaytimeMinutes !== undefined && gogPlaytimeMinutes > 0 && (
                            <button
                              type="button"
                              onClick={() => setPlaytime(formatGogPlaytime(gogPlaytimeMinutes))}
                              className="px-2.5 py-1.5 bg-purple-950/60 hover:bg-purple-900 border border-purple-500/40 text-purple-200 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
                              title="Copiar tempo registrado na GOG para o campo Tempo de Jogo"
                            >
                              Usar Horas →
                            </button>
                          )}
                        </div>

                        {gogAchieveData && gogAchieveData.totalCount > 0 && (
                          <div className="p-2.5 rounded-xl bg-zinc-950 border border-purple-500/30 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Trophy size={14} className="text-fuchsia-400" />
                              <span className="text-xs font-bold text-zinc-300">
                                Conquistas Desbloqueadas:
                              </span>
                              <span className="text-xs font-mono font-extrabold text-fuchsia-400">
                                {gogAchieveData.unlockedCount} / {gogAchieveData.totalCount} ({gogAchieveData.percentage}%)
                              </span>
                            </div>
                            <div className="w-24 h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                              <div
                                className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-400"
                                style={{ width: `${gogAchieveData.percentage}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-3 text-xs text-zinc-400 italic">
                        Nenhum jogo da GOG vinculado. Clique em "Vincular Jogo da GOG" para sincronizar horas e conquistas!
                      </div>
                    )}
                  </div>
                )}

                {/* NONE PANEL */}
                {integrationPlatform === "none" && (
                  <div className="text-center py-3 text-xs text-zinc-500 italic">
                    Nenhuma integração de loja ativa para este jogo. Serão exibidos apenas dados e tempos manuais.
                  </div>
                )}
              </div>

              {/* Ícone do Perfil */}
              <div className="bg-zinc-950/80 p-4.5 rounded-2xl border-2 border-sky-500/60 shadow-md shadow-sky-500/10 space-y-3">
                <label className="block text-xs font-bold text-sky-300 uppercase tracking-widest font-mono">
                  Ícone do Perfil
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setActiveIconTab("emoji")}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      activeIconTab === "emoji" ? "bg-cyan-600 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                    }`}
                  >
                    <Smile size={14} /> Emoji
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveIconTab("upload")}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      activeIconTab === "upload" ? "bg-cyan-600 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                    }`}
                  >
                    <Upload size={14} /> Subir Ícone
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveIconTab("url")}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      activeIconTab === "url" ? "bg-cyan-600 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                    }`}
                  >
                    <Globe size={14} /> URL da Web
                  </button>
                </div>

                {activeIconTab === "emoji" && (
                  <input
                    type="text"
                    value={iconEmoji}
                    onChange={(e) => setIconEmoji(e.target.value)}
                    placeholder="Ex: 👾, 👑, ☄️, 🕹️"
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white text-sm"
                  />
                )}

                {activeIconTab === "upload" && (
                  <div 
                    onDragOver={handleIconDragOver}
                    onDragLeave={handleIconDragLeave}
                    onDrop={handleIconDrop}
                    className={`flex flex-col items-center justify-center p-5 rounded-2xl bg-zinc-950 border-2 border-dashed transition-all cursor-pointer relative overflow-hidden ${
                      isDragOverIcon 
                        ? "border-cyan-500 bg-cyan-950/10 scale-[1.01]" 
                        : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/40"
                    }`}
                    onClick={() => {
                      const iconInput = document.getElementById("icon-file-input");
                      if (iconInput) iconInput.click();
                    }}
                  >
                    <input
                      id="icon-file-input"
                      type="file"
                      accept="image/*"
                      disabled={isUploadingIcon}
                      onChange={handleIconUpload}
                      className="hidden"
                    />
                    {isUploadingIcon ? (
                      <div className="flex flex-col items-center gap-2 py-1 text-center">
                        <Loader2 size={20} className="animate-spin text-cyan-400" />
                        <span className="text-xs text-zinc-300 font-medium animate-pulse">Enviando ícone...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-center">
                        <Upload size={18} className="text-purple-400" />
                        <p className="text-xs font-semibold text-zinc-300">
                          Arraste o ícone aqui ou <span className="text-cyan-400 underline decoration-dashed underline-offset-4">escolha um arquivo</span>
                        </p>
                      </div>
                    )}
                    {tempUploadedIcon && !isUploadingIcon && (
                      <div className="absolute right-3 top-3 flex items-center gap-1.5 bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 px-2 py-1 rounded-xl">
                        <img
                          src={tempUploadedIcon}
                          className="w-5 h-5 rounded-md object-cover border border-cyan-500"
                          alt="Icon Preview"
                        />
                        <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Salvo</span>
                      </div>
                    )}
                  </div>
                )}

                {activeIconTab === "url" && (
                  <input
                    type="url"
                    value={iconUrl}
                    onChange={(e) => setIconUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white text-sm"
                  />
                )}
              </div>

              {/* Imagem de Capa */}
              <div className="bg-zinc-950/80 p-4.5 rounded-2xl border-2 border-rose-500/60 shadow-md shadow-rose-500/10 space-y-3">
                <label className="block text-xs font-bold text-rose-300 uppercase tracking-widest font-mono">
                  Imagem de Capa
                </label>
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1">
                    <input
                      type="url"
                      value={coverUrl}
                      onChange={(e) => {
                        setCoverUrl(e.target.value);
                        setTempUploadedCover(""); // clear upload if text changes
                      }}
                      placeholder="https://images.unsplash.com/photo-..."
                      className="w-full px-4 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm text-white mb-2"
                    />
                    <div 
                      onDragOver={handleCoverDragOver}
                      onDragLeave={handleCoverDragLeave}
                      onDrop={handleCoverDrop}
                      className={`flex flex-col items-center justify-center p-5 rounded-2xl bg-zinc-950 border-2 border-dashed transition-all cursor-pointer relative overflow-hidden ${
                        isDragOverCover 
                          ? "border-rose-500 bg-rose-950/10 scale-[1.01]" 
                          : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/40"
                      }`}
                      onClick={() => {
                        const coverInput = document.getElementById("cover-file-input");
                        if (coverInput) coverInput.click();
                      }}
                    >
                      <input
                        id="cover-file-input"
                        type="file"
                        accept="image/*"
                        disabled={isUploadingCover}
                        onChange={handleCoverUpload}
                        className="hidden"
                      />
                      {isUploadingCover ? (
                        <div className="flex flex-col items-center gap-2 py-1 text-center">
                          <Loader2 size={20} className="animate-spin text-rose-400" />
                          <span className="text-xs text-zinc-300 font-medium animate-pulse">Enviando imagem de capa...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-center">
                          <Upload size={18} className="text-rose-400" />
                          <p className="text-xs font-semibold text-zinc-300">
                            Arraste a capa aqui ou <span className="text-rose-400 underline decoration-dashed underline-offset-4">escolha um arquivo</span>
                          </p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
                            Formatos: JPG, PNG, WEBP, GIF
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  {(tempUploadedCover || coverUrl) && (
                    <div className="w-28 h-20 rounded-2xl overflow-hidden border border-rose-500/40 shrink-0 bg-black">
                      <img
                        src={tempUploadedCover || coverUrl}
                        className="w-full h-full object-cover"
                        alt="Capa"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://placehold.co/100x100/040406/ffffff?text=Capa";
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-5 flex justify-end gap-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold hover:bg-zinc-800 transition-all text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-neon px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-bold text-sm"
                >
                  Salvar Ficha
                </button>
              </div>
            </form>

            {/* Modal de confirmação inteligente de Replay */}
            {showReplayPromptModal && (
              <AnimatePresence>
                <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/85 backdrop-blur-md"
                    onClick={() => setShowReplayPromptModal(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="w-full max-w-md bg-zinc-950 border-2 border-purple-500/60 rounded-3xl p-6 shadow-[0_0_50px_rgba(168,85,247,0.3)] relative z-10 space-y-5 text-white"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-purple-950/80 border border-purple-500/50 text-purple-300 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/20">
                        <RotateCcw size={24} className="stroke-[2.5]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 font-mono">
                          Replay Inteligente Detectado
                        </span>
                        <h3 className="text-lg font-black text-white leading-tight mt-0.5">
                          Adicionar +1 Marcador de Replay?
                        </h3>
                        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                          Identificamos que você está alterando o status de <strong className="text-purple-200">{name || game?.name || "este jogo"}</strong> de <span className="text-zinc-300 italic font-semibold">{pendingReplayPreviousStatus.join(", ") || "Inativo/Concluído"}</span> para <span className="text-emerald-400 font-bold">Jogando</span>.
                        </p>
                      </div>
                    </div>

                    {/* Visual Transição de Replays */}
                    <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-purple-500/30 flex items-center justify-between gap-3 font-mono">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold font-sans">Contagem Atual:</span>
                        <span className="text-xs font-bold text-zinc-300 bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800">
                          {replayed ? (replayCount || 1) : 0}x Replays
                        </span>
                      </div>

                      <div className="text-purple-400 font-black text-xl">➔</div>

                      <div className="flex flex-col gap-0.5 text-right">
                        <span className="text-[10px] uppercase tracking-wider text-purple-300 font-bold font-sans">Nova Contagem:</span>
                        <span className="text-sm font-black text-purple-200 bg-purple-950 px-3 py-1 rounded-lg border border-purple-500/60 shadow-md">
                          {(replayed ? (replayCount || 1) : 0) + 1}x Replay
                        </span>
                      </div>
                    </div>

                    {/* Opção para arquivar tempo da campanha em Tempo Extra */}
                    {parsePlaytimeHours(playtime) > 0 && (
                      <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-zinc-900/60 border border-purple-900/40 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={autoArchivePlaytime}
                          onChange={(e) => setAutoArchivePlaytime(e.target.checked)}
                          className="mt-0.5 rounded border-zinc-800 bg-zinc-950 text-purple-500 focus:ring-purple-500 h-4 w-4 accent-purple-500 shrink-0"
                        />
                        <div className="text-xs leading-relaxed">
                          <span className="font-bold text-purple-200 block">
                            Mover {formatHoursAndMinutes(parsePlaytimeHours(playtime))} para Tempo Extra
                          </span>
                          <span className="text-[11px] text-zinc-400 font-sans">
                            Preserva as horas da jogatina anterior em Tempo Extra e reseta o Tempo Atual para sua nova campanha.
                          </span>
                        </div>
                      </label>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleConfirmReplayPrompt(true)}
                        className="flex-1 px-4 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 transition-all text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        <RotateCcw size={16} />
                        <span>Sim, Adicionar +1 Replay</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfirmReplayPrompt(false)}
                        className="px-4 py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-all text-zinc-300 font-bold text-xs cursor-pointer active:scale-95"
                      >
                        Apenas Mudar Status
                      </button>
                    </div>
                  </motion.div>
                </div>
              </AnimatePresence>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
