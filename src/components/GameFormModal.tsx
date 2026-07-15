/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Game } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, Image as ImageIcon, Upload, Globe, Smile, Check, Loader2 } from "lucide-react";
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

  // ImgBB Uploaded Image covers/icons
  const [tempUploadedCover, setTempUploadedCover] = useState("");
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);

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
    }
    setShowNewGenre(false);
    setShowNewTag(false);
    setNewGenreVal("");
    setNewTagVal("");
  }, [game, isOpen]);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCover(true);
    try {
      const imageUrl = await uploadToImgBB(file);
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
      const imageUrl = await uploadToImgBB(file);
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
                    return (
                      <button
                        type="button"
                        key={genre}
                        onClick={() => toggleGenre(genre)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                          isSelected
                            ? "bg-purple-600/25 text-purple-300 border-purple-500/40"
                            : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                        }`}
                      >
                        {genre}
                      </button>
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
                    return (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                          isSelected
                            ? "bg-cyan-600/25 text-cyan-300 border-cyan-500/40"
                            : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                        }`}
                      >
                        {tag}
                      </button>
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
