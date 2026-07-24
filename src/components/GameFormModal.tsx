/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Game, getDlcMode, getGameTrophies } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, Image as ImageIcon, Upload, Globe, Smile, Check, Loader2, Search, Clock, RefreshCw, RotateCcw, Sparkles, Trophy, Layers, ThumbsUp, ThumbsDown } from "lucide-react";
import { COVER_BANK } from "../data";
import { uploadToImgBB } from "../utils/imgbb";
import { formatHltbTime } from "../utils/hltbFormatter";

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
  // Form fields state
  const [name, setName] = useState("");
  const [series, setSeries] = useState("");
  const [publisher, setPublisher] = useState("");
  const [studio, setStudio] = useState("");
  const [playtime, setPlaytime] = useState("");
  const [additionalPlaytime, setAdditionalPlaytime] = useState("");
  const [trophy, setTrophy] = useState<"none" | "silver" | "gold" | "platinum">("none");
  const [selectedTrophies, setSelectedTrophies] = useState<string[]>([]);

  const addTrophy = (type: "silver" | "gold" | "platinum") => {
    setSelectedTrophies((prev) => [...prev, type]);
  };

  const removeTrophy = (type: "silver" | "gold" | "platinum") => {
    setSelectedTrophies((prev) => {
      const idx = prev.lastIndexOf(type);
      if (idx === -1) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  };

  const silverCount = selectedTrophies.filter((t) => t === "silver").length;
  const goldCount = selectedTrophies.filter((t) => t === "gold").length;
  const platinumCount = selectedTrophies.filter((t) => t === "platinum").length;
  const [pros, setPros] = useState("");
  const [cons, setCons] = useState("");
  const [replayed, setReplayed] = useState(false);
  const [replayCount, setReplayCount] = useState<number>(0);
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

  const [isFetchingMetacritic, setIsFetchingMetacritic] = useState(false);
  const [metacriticUrlInput, setMetacriticUrlInput] = useState("");
  const [showMetacriticImport, setShowMetacriticImport] = useState(false);
  const [metacriticPlatforms, setMetacriticPlatforms] = useState<{ code: string; name: string }[]>([]);
  const [selectedMetacriticPlatform, setSelectedMetacriticPlatform] = useState<string>("");

  const [isFetchingAIMetadata, setIsFetchingAIMetadata] = useState(false);
  const [gameCandidates, setGameCandidates] = useState<any[]>([]);
  const [isSelectingCandidate, setIsSelectingCandidate] = useState(false);

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

  // Initialize form
  useEffect(() => {
    if (game) {
      setName(game.name || "");
      setSeries(game.series || "");
      setPublisher(game.publisher || "");
      setStudio(game.studio || game.developer || "");
      setReplayed(!!game.replayed);
      setReplayCount(game.replayCount || 0);
      setDlcMode(getDlcMode(game));
      setDlcNames(game.dlcNames || "");
      setPlaytime(game.playtime || "");
      setAdditionalPlaytime(game.additionalPlaytime || "");
      setTrophy(game.trophy || "none");
      setSelectedTrophies(getGameTrophies(game));
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
      
      if (game.metacriticUrl) {
        fetch(`/api/metacritic?url=${encodeURIComponent(game.metacriticUrl)}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.platforms) {
              setMetacriticPlatforms(data.platforms);
            }
          })
          .catch((err) => console.error("Erro ao carregar plataformas:", err));
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
      setReplayed(false);
      setReplayCount(0);
      setDlcMode("none");
      setDlcNames("");
      setPlaytime("");
      setAdditionalPlaytime("");
      setTrophy("none");
      setSelectedTrophies([]);
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
    setSelectedStatus((prev) =>
      prev.includes(statusVal) ? prev.filter((s) => s !== statusVal) : [...prev, statusVal]
    );
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

    onSave({
      id: game?.id,
      name: name.trim(),
      series: series.trim(),
      publisher: publisher.trim(),
      studio: studio.trim(),
      playtime: playtime.trim() || "00h 00m",
      additionalPlaytime: additionalPlaytime.trim(),
      trophy: selectedTrophies.length > 0 ? (selectedTrophies.includes("platinum") ? "platinum" : selectedTrophies.includes("gold") ? "gold" : "silver") : "none",
      trophies: selectedTrophies,
      pros: pros.trim(),
      cons: cons.trim(),
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
      ...(game ? { diary: game.diary } : { diary: [] })
    });
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

            <form id="game-form" onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    Título do Jogo *
                  </label>
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
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
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
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
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
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
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
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
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
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                    Lançamento
                  </label>
                  <input
                    type="date"
                    value={releaseDate}
                    onChange={(e) => setReleaseDate(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                    Tempo de Jogo (Esta Jogatina)
                  </label>
                  <input
                    type="text"
                    value={playtime}
                    onChange={(e) => setPlaytime(e.target.value)}
                    placeholder="Ex: 42h 15m ou 1000h 00m"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1 font-sans">
                    Tempo investido nesta jogatina específica.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                    Horas Adicionais (Outras Jogatinas)
                  </label>
                  <input
                    type="text"
                    value={additionalPlaytime}
                    onChange={(e) => setAdditionalPlaytime(e.target.value)}
                    placeholder="Ex: 1200h 30m"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1 font-sans">
                    Tempo de outras jogatinas / re-plays acumulado ao total investido.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                      Troféus de Conquista (Multi-Seleção & Múltiplas Cópias)
                    </label>
                    {selectedTrophies.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedTrophies([])}
                        className="text-[10px] text-zinc-500 hover:text-rose-400 font-bold uppercase transition-colors cursor-pointer"
                      >
                        Limpar troféus
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Silver Card */}
                    <div className={`p-2.5 rounded-2xl border transition-all flex flex-col justify-between gap-2 ${silverCount > 0 ? "bg-slate-900/90 border-slate-500/50 shadow-[0_0_10px_rgba(203,213,225,0.2)]" : "bg-zinc-900/90 border-zinc-800"}`}>
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
                          className="w-7 h-7 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-20 text-zinc-300 font-black flex items-center justify-center text-sm cursor-pointer transition-all shrink-0"
                          title="Remover 1 Prata"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => addTrophy("silver")}
                          className="flex-1 h-7 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-100 border border-slate-500/40 text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer transition-all min-w-0"
                          title="Adicionar 1 Prata"
                        >
                          <Plus size={12} className="shrink-0" />
                          <span className="truncate">Prata</span>
                        </button>
                      </div>
                    </div>

                    {/* Gold Card */}
                    <div className={`p-2.5 rounded-2xl border transition-all flex flex-col justify-between gap-2 ${goldCount > 0 ? "bg-amber-950/80 border-amber-500/60 shadow-[0_0_12px_rgba(251,191,36,0.25)]" : "bg-zinc-900/90 border-zinc-800"}`}>
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
                          className="w-7 h-7 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-20 text-zinc-300 font-black flex items-center justify-center text-sm cursor-pointer transition-all shrink-0"
                          title="Remover 1 Ouro"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => addTrophy("gold")}
                          className="flex-1 h-7 rounded-xl bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-500/50 text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer transition-all min-w-0"
                          title="Adicionar 1 Ouro"
                        >
                          <Plus size={12} className="shrink-0" />
                          <span className="truncate">Ouro</span>
                        </button>
                      </div>
                    </div>

                    {/* Platinum Card */}
                    <div className={`p-2.5 rounded-2xl border transition-all flex flex-col justify-between gap-2 ${platinumCount > 0 ? "bg-cyan-950/90 border-cyan-400/80 shadow-[0_0_14px_rgba(34,211,238,0.3)]" : "bg-zinc-900/90 border-zinc-800"}`}>
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
                          className="w-7 h-7 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-20 text-zinc-300 font-black flex items-center justify-center text-sm cursor-pointer transition-all shrink-0"
                          title="Remover 1 Platina"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => addTrophy("platinum")}
                          className="flex-1 h-7 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-100 border border-cyan-400/60 text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer transition-all min-w-0"
                          title="Adicionar 1 Platina"
                        >
                          <Plus size={12} className="shrink-0" />
                          <span className="truncate">Platina</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Display selected badges list below */}
                  {selectedTrophies.length > 0 && (
                    <div className="mt-2.5 p-2 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center gap-1.5 flex-wrap min-h-[38px]">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mr-1">
                        Troféus ({selectedTrophies.length}):
                      </span>
                      {selectedTrophies.map((tr, idx) => (
                        <span
                          key={idx}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-semibold ${
                            tr === "platinum"
                              ? "bg-cyan-950/80 border-cyan-400/60 text-cyan-200"
                              : tr === "gold"
                              ? "bg-amber-950/80 border-amber-500/60 text-amber-300"
                              : "bg-slate-800/80 border-slate-500/60 text-slate-200"
                          }`}
                        >
                          <Trophy size={11} fill="currentColor" />
                          <span className="capitalize">{tr === "platinum" ? "Platina" : tr === "gold" ? "Ouro" : "Prata"}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTrophies((prev) => {
                                const copy = [...prev];
                                copy.splice(idx, 1);
                                return copy;
                              });
                            }}
                            className="text-zinc-400 hover:text-rose-400 font-bold ml-1 cursor-pointer"
                            title="Remover este troféu"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                    Data de Término
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Plataforma
                </label>
                <input
                  type="text"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  placeholder="Ex: Nintendo Switch, PS5, PC"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Dificuldade
                </label>
                <input
                  type="text"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  placeholder="Ex: Normal, Hard, Marcha da Morte"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Pros & Cons Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 font-mono">
                    <ThumbsUp size={13} className="text-emerald-400 shrink-0" />
                    <span>+ Prós (Separados por ';')</span>
                  </label>
                  <textarea
                    rows={2}
                    value={pros}
                    onChange={(e) => setPros(e.target.value)}
                    placeholder="Ex: Gráficos espetaculares; Trilha sonora épica; Jogabilidade fluida"
                    className="w-full bg-zinc-900 border border-emerald-900/40 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Insira os pontos positivos do jogo separados por ponto e vírgula (;).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-rose-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 font-mono">
                    <ThumbsDown size={13} className="text-rose-400 shrink-0" />
                    <span>- Contras (Separados por ';')</span>
                  </label>
                  <textarea
                    rows={2}
                    value={cons}
                    onChange={(e) => setCons(e.target.value)}
                    placeholder="Ex: História curta; Carregamentos lentos; Quedas de taxa de quadros"
                    className="w-full bg-zinc-900 border border-rose-900/40 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Insira os pontos negativos do jogo separados por ponto e vírgula (;).
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">
                  Categoria de Progresso *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                  {["Jogando", "Em Hiatus", "Terminado", "Backlog", "Desistido"].map((status) => (
                    <label key={status} className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedStatus.includes(status)}
                        onChange={() => toggleStatus(status)}
                        className="rounded border-zinc-800 bg-zinc-950 text-cyan-500 focus:ring-cyan-500 h-4 w-4 accent-cyan-500"
                      />
                      {status}
                    </label>
                  ))}
                </div>
                <div className="mt-3 px-1 flex flex-col sm:flex-row sm:items-center gap-4 pt-2 border-t border-zinc-800/60">
                  <div className="flex-1">
                    <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer select-none">
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
                      <span className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-purple-300">
                        <RotateCcw size={12} className="stroke-[2.5]" />
                        Replay
                      </span>
                    </label>
                    {replayed && (
                      <div className="mt-2 pl-6 flex items-center gap-2 animate-fade-in">
                        <span className="text-xs text-zinc-400 font-medium">Quantidade:</span>
                        <input
                          type="number"
                          min="1"
                          value={replayCount || 1}
                          onChange={(e) => setReplayCount(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-16 px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white font-mono text-center focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
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
                          placeholder="Ex: Shadow of the Erdtree; Sunbreak; Blood and Wine"
                          className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-amber-900/40 text-amber-200 placeholder-zinc-600 outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                        />
                        <p className="text-[10px] text-zinc-500 italic mt-1">
                          Separe múltiplos nomes de DLC por ponto e vírgula ( ; )
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    Gêneros *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNewGenre(!showNewGenre)}
                    className="text-[10px] uppercase tracking-[0.25em] text-cyan-400 font-extrabold hover:underline"
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

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    Etiquetas / Tags
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNewTag(!showNewTag)}
                    className="text-[10px] uppercase tracking-[0.25em] text-cyan-400 font-extrabold hover:underline"
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
                      className="px-4 py-2 rounded-xl bg-cyan-600 text-white font-bold text-xs"
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

              {/* HowLongToBeat (HLTB) Integration Section */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4.5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-zinc-300">
                      Métricas HowLongToBeat
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
                        className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1.5 transition-colors px-2.5 py-1.5 bg-purple-950/20 border border-purple-800/30 rounded-xl hover:bg-purple-950/40 font-semibold cursor-pointer"
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
                        className="flex-1 bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
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
                              className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-purple-500/40 hover:bg-purple-950/10 text-left transition-all group/metric"
                              title="Clique para aplicar este tempo como Tempo de Jogo"
                            >
                              <span className="block text-[9px] font-black uppercase text-zinc-500 tracking-wider">História Principal</span>
                              <span className="text-sm font-black text-purple-400 font-mono mt-0.5 block flex items-center justify-between">
                                <span>{hltbMain}</span>
                                <span className="text-[9px] opacity-0 group-hover/metric:opacity-100 transition-opacity text-purple-500 font-sans">Usar →</span>
                              </span>
                            </button>
                          )}
                          {hltbExtra && (
                            <button
                              type="button"
                              onClick={() => setPlaytime(hltbExtra)}
                              className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-cyan-500/40 hover:bg-cyan-950/10 text-left transition-all group/metric"
                              title="Clique para aplicar este tempo como Tempo de Jogo"
                            >
                              <span className="block text-[9px] font-black uppercase text-zinc-500 tracking-wider">História + Extras</span>
                              <span className="text-sm font-black text-cyan-400 font-mono mt-0.5 block flex items-center justify-between">
                                <span>{hltbExtra}</span>
                                <span className="text-[9px] opacity-0 group-hover/metric:opacity-100 transition-opacity text-cyan-500 font-sans">Usar →</span>
                              </span>
                            </button>
                          )}
                          {hltbCompletionist && (
                            <button
                              type="button"
                              onClick={() => setPlaytime(hltbCompletionist)}
                              className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-pink-500/40 hover:bg-pink-950/10 text-left transition-all group/metric"
                              title="Clique para aplicar este tempo como Tempo de Jogo"
                            >
                              <span className="block text-[9px] font-black uppercase text-zinc-500 tracking-wider">Complecionista (100%)</span>
                              <span className="text-sm font-black text-pink-400 font-mono mt-0.5 block flex items-center justify-between">
                                <span>{hltbCompletionist}</span>
                                <span className="text-[9px] opacity-0 group-hover/metric:opacity-100 transition-opacity text-pink-500 font-sans">Usar →</span>
                              </span>
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 text-center flex items-center justify-center gap-1">
                          <Clock size={10} className="text-zinc-500" />
                          <span>Dica: Clique em qualquer card de tempo acima para preencher o "Tempo de Jogo"!</span>
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-3 text-xs text-zinc-500">
                        Nenhuma métrica vinculada a este jogo ainda. Clique em "Importar via Link" para colar a página do HowLongToBeat!
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Metacritic Integration Section */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4.5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-zinc-300">
                      Notas do Metacritic
                    </h4>
                  </div>
                  <div className="flex gap-2">
                    {metacriticUrl && (
                      <button
                        type="button"
                        onClick={handleRefreshMetacritic}
                        disabled={isFetchingMetacritic}
                        className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors px-2.5 py-1.5 bg-amber-950/20 border border-amber-800/30 rounded-xl hover:bg-amber-950/40 font-semibold cursor-pointer disabled:opacity-50"
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
                        className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors px-2.5 py-1.5 bg-amber-950/20 border border-amber-800/30 rounded-xl hover:bg-amber-950/40 font-semibold cursor-pointer"
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
                        className="flex-1 bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
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
                            <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-left">
                              <span className="block text-[9px] font-black uppercase text-zinc-500 tracking-wider">Média da Crítica (Metascore)</span>
                              <span className="text-sm font-black text-amber-400 font-mono mt-0.5 block flex items-center justify-between">
                                <span>{metacriticCritScore}</span>
                              </span>
                            </div>
                          )}
                          {metacriticUserScore !== undefined && (
                            <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-left">
                              <span className="block text-[9px] font-black uppercase text-zinc-500 tracking-wider">Média dos Usuários</span>
                              <span className="text-sm font-black text-cyan-400 font-mono mt-0.5 block flex items-center justify-between">
                                <span>{metacriticUserScore.toFixed(1)}</span>
                              </span>
                            </div>
                          )}
                        </div>

                        {metacriticUrl && metacriticPlatforms.length > 0 && (
                          <div className="pt-2 border-t border-zinc-850/60">
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 text-left">
                              Extrair dados da plataforma:
                            </label>
                            <select
                              value={selectedMetacriticPlatform}
                              onChange={(e) => handleSelectFormPlatform(e.target.value)}
                              disabled={isFetchingMetacritic}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50 cursor-pointer"
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
                      <div className="text-center py-3 text-xs text-zinc-500">
                        Nenhuma nota do Metacritic vinculada a este jogo ainda. Clique em "Importar via Link"!
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">
                  Ícone do Perfil
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setActiveIconTab("emoji")}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                      activeIconTab === "emoji" ? "bg-cyan-600 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                    }`}
                  >
                    <Smile size={14} /> Emoji
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveIconTab("upload")}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                      activeIconTab === "upload" ? "bg-cyan-600 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                    }`}
                  >
                    <Upload size={14} /> Subir Ícone
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveIconTab("url")}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
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

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
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
                      className="w-full px-4 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm text-white mb-2"
                    />
                    <div 
                      onDragOver={handleCoverDragOver}
                      onDragLeave={handleCoverDragLeave}
                      onDrop={handleCoverDrop}
                      className={`flex flex-col items-center justify-center p-5 rounded-2xl bg-zinc-950 border-2 border-dashed transition-all cursor-pointer relative overflow-hidden ${
                        isDragOverCover 
                          ? "border-purple-500 bg-purple-950/10 scale-[1.01]" 
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
                          <Loader2 size={20} className="animate-spin text-cyan-400" />
                          <span className="text-xs text-zinc-300 font-medium animate-pulse">Enviando imagem de capa...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-center">
                          <Upload size={18} className="text-purple-400" />
                          <p className="text-xs font-semibold text-zinc-300">
                            Arraste a capa aqui ou <span className="text-purple-400 underline decoration-dashed underline-offset-4">escolha um arquivo</span>
                          </p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
                            Formatos: JPG, PNG, WEBP, GIF
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  {(tempUploadedCover || coverUrl) && (
                    <div className="w-28 h-20 rounded-2xl overflow-hidden border border-zinc-800 shrink-0 bg-black">
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
