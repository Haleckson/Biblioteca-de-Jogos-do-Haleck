/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Game } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, Image as ImageIcon, Upload, Globe, Smile, Check, Loader2, Search, Clock, RefreshCw } from "lucide-react";
import { COVER_BANK } from "../data";
import { uploadToImgBB } from "../utils/imgbb";

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
  const [playtime, setPlaytime] = useState("");
  const [platform, setPlatform] = useState("");
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

  // HowLongToBeat States
  const [hltbMain, setHltbMain] = useState("");
  const [hltbExtra, setHltbExtra] = useState("");
  const [hltbCompletionist, setHltbCompletionist] = useState("");
  const [hltbId, setHltbId] = useState("");

  const [isFetchingHltb, setIsFetchingHltb] = useState(false);
  const [hltbUrlInput, setHltbUrlInput] = useState("");
  const [showHltbImport, setShowHltbImport] = useState(false);

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
      setHltbMain(data.gameplayMain ? `${data.gameplayMain}h` : "");
      setHltbExtra(data.gameplayMainExtra ? `${data.gameplayMainExtra}h` : "");
      setHltbCompletionist(data.gameplayCompletionist ? `${data.gameplayCompletionist}h` : "");
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
      
      setHltbMain(data.gameplayMain ? `${data.gameplayMain}h` : "");
      setHltbExtra(data.gameplayMainExtra ? `${data.gameplayMainExtra}h` : "");
      setHltbCompletionist(data.gameplayCompletionist ? `${data.gameplayCompletionist}h` : "");
      
      triggerAlert("Métricas Atualizadas", "As médias do HowLongToBeat foram atualizadas com sucesso!");
    } catch (err: any) {
      console.error(err);
      triggerAlert("Erro ao atualizar", `Não foi possível atualizar dados: ${err.message || err}`);
    } finally {
      setIsFetchingHltb(false);
    }
  };

  // Initialize form
  useEffect(() => {
    if (game) {
      setName(game.name || "");
      setSeries(game.series || "");
      setPublisher(game.publisher || "");
      setPlaytime(game.playtime || "");
      setPlatform(game.platform || "");
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
    } else {
      // Clear all
      setName("");
      setSeries("");
      setPublisher("");
      setPlaytime("");
      setPlatform("");
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
    }
    setShowNewGenre(false);
    setShowNewTag(false);
    setNewGenreVal("");
    setNewTagVal("");

    // Clear HLTB import states
    setIsFetchingHltb(false);
    setHltbUrlInput("");
    setShowHltbImport(false);
  }, [game, isOpen]);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCover(true);
    try {
      const fileNameParam = `${name.trim() || "jogo"}_cover`;
      const imageUrl = await uploadToImgBB(file, fileNameParam);
      setTempUploadedCover(imageUrl);
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

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingIcon(true);
    try {
      const fileNameParam = `${name.trim() || "jogo"}_icon`;
      const imageUrl = await uploadToImgBB(file, fileNameParam);
      setTempUploadedIcon(imageUrl);
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
      playtime: playtime.trim() || "00h 00m",
      rating: Math.min(5, Math.max(0, rating)),
      startDate,
      endDate,
      releaseDate,
      cover: finalCover,
      icon: finalIcon,
      iconType: activeIconTab,
      status: selectedStatus,
      genre: selectedGenres,
      tags: selectedTags,
      platform: platform.trim() || "PC",
      hltbMain,
      hltbExtra,
      hltbCompletionist,
      hltbId,
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
            className="bg-zinc-950 rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-purple-500/30 relative z-10"
          >
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50 sticky top-0 backdrop-blur z-30">
              <h3 className="text-lg font-bold text-white">
                {game ? "Editar Ficha de Jogo" : "Adicionar Novo Jogo"}
              </h3>
              <button
                onClick={onClose}
                className="text-zinc-400 hover:text-white transition-colors p-1.5 hover:bg-zinc-800 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Título do Jogo *
                </label>
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
                    Estúdio / Publisher
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
                    Tempo de Jogo
                  </label>
                  <input
                    type="text"
                    value={playtime}
                    onChange={(e) => setPlaytime(e.target.value)}
                    placeholder="Ex: 42h 15m"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                  />
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
                  {globalGenres.map((genre) => {
                    const isSelected = selectedGenres.includes(genre);
                    const isEditing = editingGenre === genre;
                    return isEditing ? (
                      <div
                        key={genre}
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
                        key={genre}
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
                  {globalTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    const isEditing = editingTag === tag;
                    return isEditing ? (
                      <div
                        key={tag}
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
                        key={tag}
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
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900 border border-zinc-800">
                    <label className={`px-4 py-2 rounded-xl transition-all font-semibold border text-zinc-300 border-zinc-800 cursor-pointer flex items-center gap-1.5 ${isUploadingIcon ? "bg-zinc-900 opacity-60 cursor-not-allowed" : "bg-zinc-950 hover:bg-zinc-800"}`}>
                      {isUploadingIcon ? (
                        <>
                          <Loader2 size={14} className="animate-spin text-cyan-400" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={14} className="text-purple-400" />
                          <span>Escolher Ficheiro</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isUploadingIcon}
                        onChange={handleIconUpload}
                        className="hidden"
                      />
                    </label>
                    {tempUploadedIcon && (
                      <div className="flex items-center gap-2">
                        <img
                          src={tempUploadedIcon}
                          className="w-9 h-9 rounded-xl object-cover border border-cyan-500"
                          alt="Icon Preview"
                        />
                        <span className="text-[10px] text-zinc-400">Ícone salvo</span>
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">Ou ficheiro local:</span>
                      <label className={`px-3 py-2 rounded-xl border text-zinc-300 border-zinc-800 cursor-pointer flex items-center gap-1.5 ${isUploadingCover ? "bg-zinc-900 opacity-60 cursor-not-allowed" : "bg-zinc-900 hover:bg-zinc-800"}`}>
                        {isUploadingCover ? (
                          <>
                            <Loader2 size={12} className="animate-spin text-cyan-400" />
                            <span>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={12} className="text-purple-400" />
                            <span>Escolher Ficheiro</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          disabled={isUploadingCover}
                          onChange={handleCoverUpload}
                          className="hidden"
                        />
                      </label>
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
