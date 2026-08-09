import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Maximize2,
  Minimize2,
  Sparkles,
  BookOpen,
  Calendar,
  Image as ImageIcon,
  Film,
  Award,
} from "lucide-react";
import { Game, DiaryEntry } from "../types";
import { playRetroSound } from "../utils/audioEffects";
import { cleanHTMLText } from "../utils/htmlSanitizer";
import { applyDictionaryToHtml } from "../utils/dictionaryUtils";

interface StorytellingModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: Game | null;
}

export default function StorytellingModal({ isOpen, onClose, game }: StorytellingModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0); // 0 = Cover/Overview, 1..N = Entries
  const [selectedMediaIdx, setSelectedMediaIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const thumbnailContainerRef = useRef<HTMLDivElement>(null);
  const activeThumbnailRef = useRef<HTMLButtonElement>(null);

  const entries: DiaryEntry[] = game?.diary || [];
  const totalSlides = game ? 1 + entries.length : 0;

  // Reset index when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setSelectedMediaIdx(0);
      setIsPlaying(false);
    }
  }, [isOpen]);

  // Auto-scroll selected thumbnail into view when selectedMediaIdx changes
  useEffect(() => {
    if (activeThumbnailRef.current) {
      activeThumbnailRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [selectedMediaIdx, currentIndex]);

  // Navigation Logic
  const handleNext = () => {
    playRetroSound("click");
    if (currentIndex === 0) {
      // Cover -> First entry
      if (entries.length > 0) {
        setCurrentIndex(1);
        setSelectedMediaIdx(0);
      }
      return;
    }

    const currentEntry = entries[currentIndex - 1];
    const mediaCount = currentEntry?.medias?.length || 0;

    // Check if there are more media items in the current entry
    if (mediaCount > 0 && selectedMediaIdx + 1 < mediaCount) {
      setSelectedMediaIdx((prev) => prev + 1);
    } else {
      // Advance to next entry slide
      if (currentIndex + 1 < totalSlides) {
        setCurrentIndex((prev) => prev + 1);
        setSelectedMediaIdx(0);
      } else {
        // Loop back to Cover
        setCurrentIndex(0);
        setSelectedMediaIdx(0);
      }
    }
  };

  const handlePrev = () => {
    playRetroSound("click");
    if (currentIndex === 0) {
      // Go to last entry and last media
      const lastSlide = totalSlides - 1;
      setCurrentIndex(lastSlide);
      if (lastSlide > 0) {
        const lastEntry = entries[lastSlide - 1];
        const mediaCount = lastEntry?.medias?.length || 0;
        setSelectedMediaIdx(mediaCount > 0 ? mediaCount - 1 : 0);
      }
      return;
    }

    // On an entry slide
    if (selectedMediaIdx > 0) {
      setSelectedMediaIdx((prev) => prev - 1);
    } else {
      // Go to previous slide
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      if (prevIndex > 0) {
        const prevEntry = entries[prevIndex - 1];
        const mediaCount = prevEntry?.medias?.length || 0;
        setSelectedMediaIdx(mediaCount > 0 ? mediaCount - 1 : 0);
      } else {
        setSelectedMediaIdx(0);
      }
    }
  };

  // Auto slideshow timer
  useEffect(() => {
    if (!isPlaying || totalSlides === 0) return;
    const interval = setInterval(() => {
      handleNext();
    }, 4500);
    return () => clearInterval(interval);
  }, [isPlaying, currentIndex, selectedMediaIdx, totalSlides, entries]);

  // Keyboard controls
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === " ") {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex, selectedMediaIdx, totalSlides]);

  if (!isOpen || !game) return null;

  const togglePlay = () => {
    playRetroSound("click");
    setIsPlaying(!isPlaying);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Calculate total frame steps (Cover + All media items across entries)
  const currentEntry = currentIndex > 0 ? entries[currentIndex - 1] : null;
  const currentMedias = currentEntry?.medias || [];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999999] flex flex-col bg-zinc-950 text-white overflow-hidden select-none">
        {/* Top Header & Control Bar */}
        <div className="p-3 sm:p-5 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl z-20">
          <div className="flex items-center gap-3">
            <img
              src={game.cover}
              alt={game.name}
              className="w-9 h-12 object-cover rounded-xl border border-zinc-700 shadow-md"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 text-[10px] font-mono font-bold uppercase tracking-wider border border-cyan-500/30">
                  Apresentação Storytelling 🎬
                </span>
                <span className="text-xs text-zinc-400 font-mono hidden sm:inline">
                  {currentIndex === 0
                    ? "Capa / Resumo"
                    : `Registro ${currentIndex} de ${entries.length}`}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-black text-white mt-0.5 truncate max-w-xs sm:max-w-md">
                {game.name}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Play/Pause Auto Presentation */}
            <button
              onClick={togglePlay}
              className={`px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border ${
                isPlaying
                  ? "bg-amber-500 text-zinc-950 border-amber-400 shadow-lg shadow-amber-500/20 animate-pulse"
                  : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border-zinc-700"
              }`}
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} />}
              <span className="hidden sm:inline">{isPlaying ? "Pausar Auto Play" : "Auto Apresentar"}</span>
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer"
              title="Alternar Tela Cheia"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-red-950/60 text-zinc-400 hover:text-red-300 border border-zinc-700 transition-all cursor-pointer"
              title="Fechar Apresentação"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Progress Line */}
        <div className="w-full bg-zinc-900 h-1 relative overflow-hidden">
          <motion.div
            key={`${currentIndex}-${selectedMediaIdx}`}
            initial={{ width: "0%" }}
            animate={{ width: isPlaying ? "100%" : `${((currentIndex + 1) / totalSlides) * 100}%` }}
            transition={{ duration: isPlaying ? 4.5 : 0.3, ease: "linear" }}
            className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-amber-400"
          />
        </div>

        {/* Main Presentation Stage */}
        <div className="flex-1 relative flex flex-col lg:flex-row items-center justify-center p-3 sm:p-6 gap-6 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentIndex}-${selectedMediaIdx}`}
              initial={{ opacity: 0, scale: 0.98, x: 15 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.98, x: -15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="w-full max-w-6xl flex flex-col lg:flex-row items-center justify-center gap-6 h-full max-h-[82vh]"
            >
              {/* SLIDE 0: Cover & Game Stats Overview */}
              {currentIndex === 0 ? (
                <>
                  <div className="flex-1 w-full flex flex-col items-center justify-center relative bg-zinc-950/80 border border-zinc-800 rounded-3xl p-4 overflow-hidden h-full max-h-[48vh] lg:max-h-full shadow-2xl">
                    <img
                      src={game.cover}
                      alt={game.name}
                      className="max-h-full max-w-full object-contain rounded-2xl shadow-2xl border border-white/10"
                    />
                  </div>

                  <div className="flex-1 w-full flex flex-col justify-between bg-zinc-900/90 border border-zinc-800/90 rounded-3xl p-6 sm:p-8 backdrop-blur-md overflow-y-auto custom-scrollbar max-h-[45vh] lg:max-h-full">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="px-3 py-1 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-black uppercase tracking-wider">
                          {game.platform}
                        </span>
                        {(Array.isArray(game.status) ? game.status : typeof game.status === "string" ? [game.status] : []).map((st) => (
                          <span
                            key={st}
                            className="px-2.5 py-1 rounded-xl bg-purple-500/20 border border-purple-400/40 text-purple-200 text-xs font-extrabold"
                          >
                            {st}
                          </span>
                        ))}
                      </div>

                      <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-2">
                        {game.name}
                      </h2>

                      {game.series && (
                        <p className="text-xs font-bold text-zinc-400 mb-4">
                          Série: <span className="text-cyan-300">{game.series}</span>
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-3 my-4 p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80">
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase font-bold block">Nota</span>
                          <span className="text-base font-black text-amber-400">⭐ {game.rating || "N/A"} / 5</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase font-bold block">Tempo Jogado</span>
                          <span className="text-base font-black text-cyan-400">{game.playtime || "N/A"}</span>
                        </div>
                      </div>

                      {game.pros && (
                        <div className="mb-3">
                          <span className="text-xs font-bold text-emerald-400 block mb-1">👍 Pontos Positivos</span>
                          <p className="text-xs text-zinc-300 leading-relaxed bg-emerald-950/20 p-3 rounded-xl border border-emerald-500/20">
                            {game.pros}
                          </p>
                        </div>
                      )}

                      {entries.length === 0 && (
                        <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 text-cyan-300 text-xs font-medium text-center my-4">
                          📖 Nenhuma entrada de diário registrada ainda. Adicione diários ao jogo para que apareçam nos próximos slides!
                        </div>
                      )}
                    </div>

                    {/* Footer Slide Navigation Controls */}
                    <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between">
                      <button
                        onClick={handlePrev}
                        className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 active:scale-95"
                      >
                        <ChevronLeft size={16} />
                        <span>Anterior</span>
                      </button>

                      <div className="flex items-center gap-1 overflow-x-auto max-w-[180px] custom-scrollbar px-1 py-1">
                        {Array.from({ length: totalSlides }).map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setCurrentIndex(idx);
                              setSelectedMediaIdx(0);
                            }}
                            className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all cursor-pointer ${
                              currentIndex === idx ? "bg-cyan-400 w-5" : "bg-zinc-700 hover:bg-zinc-500"
                            }`}
                          />
                        ))}
                      </div>

                      <button
                        onClick={handleNext}
                        className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-black transition-all cursor-pointer flex items-center gap-2 active:scale-95"
                      >
                        <span>Próximo</span>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* SLIDES 1..N: Diary Entries with Step-by-Step Media Carousel */
                (() => {
                  if (!currentEntry) return null;
                  const formattedText = cleanHTMLText(
                    applyDictionaryToHtml(currentEntry.text, game.dictionary).updatedHtml
                  );

                  return (
                    <>
                      {/* Left Side: Media Display & Carousel */}
                      {currentMedias.length > 0 ? (
                        <div className="flex-1 w-full flex flex-col items-center justify-center relative bg-zinc-950/70 border border-zinc-800/90 rounded-3xl p-3.5 overflow-hidden h-full max-h-[50vh] lg:max-h-full shadow-xl">
                          {/* Main Selected Media View */}
                          <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-2xl bg-black/40">
                            {currentMedias[selectedMediaIdx]?.isVideo ? (
                              <video
                                src={currentMedias[selectedMediaIdx].src}
                                controls
                                autoPlay
                                loop
                                className="max-h-full max-w-full object-contain rounded-xl"
                              />
                            ) : (
                              <img
                                src={currentMedias[selectedMediaIdx]?.src}
                                alt="Mídia do Diário"
                                className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
                              />
                            )}

                            {/* Media Index Badge overlay */}
                            <div className="absolute top-3 left-3 bg-zinc-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-zinc-700 text-[11px] font-mono font-bold text-cyan-300 flex items-center gap-1.5">
                              <ImageIcon size={12} />
                              <span>
                                {selectedMediaIdx + 1} / {currentMedias.length}
                              </span>
                            </div>
                          </div>

                          {/* Media Thumbnails Carousel Bar */}
                          {currentMedias.length > 1 && (
                            <div className="w-full flex items-center gap-2 mt-3 pt-2 border-t border-zinc-800/80">
                              <div
                                ref={thumbnailContainerRef}
                                className="flex items-center gap-2 overflow-x-auto custom-scrollbar w-full py-1 px-1 scroll-smooth"
                              >
                                {currentMedias.map((m, mIdx) => {
                                  const isSelected = selectedMediaIdx === mIdx;
                                  return (
                                    <button
                                      key={mIdx}
                                      ref={isSelected ? activeThumbnailRef : null}
                                      onClick={() => setSelectedMediaIdx(mIdx)}
                                      className={`relative w-14 h-11 shrink-0 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                                        isSelected
                                          ? "border-cyan-400 scale-105 shadow-md shadow-cyan-500/30 ring-2 ring-cyan-500/20"
                                          : "border-zinc-800 opacity-60 hover:opacity-100 hover:border-zinc-600"
                                      }`}
                                    >
                                      {m.isVideo ? (
                                        <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-cyan-400">
                                          <Film size={18} />
                                        </div>
                                      ) : (
                                        <img src={m.src} alt="" className="w-full h-full object-cover" />
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 w-full flex flex-col items-center justify-center p-8 bg-zinc-900/40 border border-zinc-800/80 rounded-3xl text-zinc-500 min-h-[250px]">
                          <ImageIcon size={48} className="mb-2 opacity-30 text-zinc-400" />
                          <p className="text-sm font-medium text-zinc-400">Entrada sem mídias anexadas</p>
                        </div>
                      )}

                      {/* Right Side: Rich Text Content Reader */}
                      <div className="flex-1 w-full flex flex-col justify-between bg-zinc-900/90 border border-zinc-800/90 rounded-3xl p-6 sm:p-8 backdrop-blur-md overflow-y-auto custom-scrollbar max-h-[45vh] lg:max-h-full">
                        <div>
                          {/* Period & Key Moments Tags */}
                          <div className="flex flex-wrap items-center gap-2 mb-4">
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
                              <Calendar size={14} />
                              <span>{currentEntry.period || "Registro de Jogatina"}</span>
                            </span>

                            {currentEntry.keyMoments &&
                              currentEntry.keyMoments.map((km) => (
                                <span
                                  key={km}
                                  className="px-2.5 py-1 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-extrabold shadow-sm flex items-center gap-1"
                                >
                                  <Sparkles size={12} className="text-cyan-400" />
                                  <span>{km}</span>
                                </span>
                              ))}
                          </div>

                          {/* Formatted Diary Entry Text */}
                          <div
                            className="prose prose-invert prose-sm max-w-none text-zinc-200 text-sm sm:text-base leading-relaxed font-sans break-words"
                            dangerouslySetInnerHTML={{ __html: formattedText }}
                          />
                        </div>

                        {/* Footer Entry Navigation Controls */}
                        <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between">
                          <button
                            onClick={handlePrev}
                            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 active:scale-95"
                          >
                            <ChevronLeft size={16} />
                            <span>Anterior</span>
                          </button>

                          {/* Pagination Indicator */}
                          <div className="flex items-center gap-1 overflow-x-auto max-w-[180px] custom-scrollbar px-1 py-1">
                            {Array.from({ length: totalSlides }).map((_, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  setCurrentIndex(idx);
                                  setSelectedMediaIdx(0);
                                }}
                                className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all cursor-pointer ${
                                  currentIndex === idx ? "bg-cyan-400 w-5" : "bg-zinc-700 hover:bg-zinc-500"
                                }`}
                              />
                            ))}
                          </div>

                          <button
                            onClick={handleNext}
                            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-black transition-all cursor-pointer flex items-center gap-2 active:scale-95"
                          >
                            <span>Próximo</span>
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    </>
                  );
                })()
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </AnimatePresence>
  );
}
