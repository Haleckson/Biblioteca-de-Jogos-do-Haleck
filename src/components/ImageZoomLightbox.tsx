import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  Maximize2,
  Minimize2,
  Download,
  Copy,
  Check,
  ImageIcon,
  Film,
  Tv,
} from "lucide-react";
import { useBodyScrollLock } from "../lib/bodyScrollLock";
import { getYoutubeEmbedUrl } from "../utils/youtube";
import { getCachedImageUrl, preloadImagesToCache } from "../utils/imageCacheManager";

interface ImageZoomLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  currentSrc: string | null;
  allImages?: string[];
  onSelectImage?: (src: string) => void;
  title?: string;
}

export default function ImageZoomLightbox({
  isOpen,
  onClose,
  currentSrc,
  allImages = [],
  onSelectImage,
  title,
}: ImageZoomLightboxProps) {
  useBodyScrollLock(isOpen);

  const [zoomScale, setZoomScale] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(currentSrc);

  const containerRef = useRef<HTMLDivElement>(null);
  const initialTouchDistRef = useRef<number | null>(null);
  const initialScaleRef = useRef<number>(1);
  const lastTapRef = useRef<number>(0);

  const youtubeEmbedUrl = currentSrc ? getYoutubeEmbedUrl(currentSrc) : null;
  const isVideo = React.useMemo(() => {
    if (!currentSrc) return false;
    if (youtubeEmbedUrl) return true;
    if (currentSrc.startsWith("data:video")) return true;
    return (
      /\.(mp4|webm|mov|mkv|avi|m4v|3gp|flv|wmv)(\?.*)?$/i.test(currentSrc) ||
      currentSrc.includes("video_anexo_") ||
      currentSrc.includes("video_youtube_")
    );
  }, [currentSrc, youtubeEmbedUrl]);

  // Helper to normalize and ensure direct image URLs
  const cleanDirectUrl = (rawUrl: string): string => {
    if (!rawUrl || typeof rawUrl !== "string") return rawUrl;
    let url = rawUrl.trim();
    if (url.includes("drive.google.com")) {
      const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
      if (fileIdMatch && fileIdMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
      }
    }
    return url;
  };

  // Filter valid images list
  const validImages = React.useMemo(() => {
    let rawList: string[] = [];
    if (allImages && allImages.length > 0) {
      rawList = allImages.filter(Boolean).map(cleanDirectUrl);
    } else if (currentSrc) {
      rawList = [cleanDirectUrl(currentSrc)];
    }
    const unique = Array.from(new Set(rawList));
    const activeClean = currentSrc ? cleanDirectUrl(currentSrc) : null;
    if (activeClean && !unique.includes(activeClean)) {
      unique.unshift(activeClean);
    }
    return unique;
  }, [allImages, currentSrc]);

  const currentIndex = React.useMemo(() => {
    if (!currentSrc || validImages.length === 0) return -1;
    const directIdx = validImages.indexOf(currentSrc);
    if (directIdx !== -1) return directIdx;

    const normCurrent = currentSrc.trim();
    const foundIdx = validImages.findIndex((img) => {
      const normImg = img.trim();
      if (normImg === normCurrent) return true;
      try {
        return decodeURIComponent(normImg) === decodeURIComponent(normCurrent);
      } catch {
        return false;
      }
    });
    return foundIdx !== -1 ? foundIdx : 0;
  }, [currentSrc, validImages]);

  // Reset states and resolve cache when opening a new image
  useEffect(() => {
    if (currentSrc) {
      setZoomScale(1);
      setImgError(false);
      setControlsVisible(true);
      setResolvedSrc(currentSrc);

      if (!isVideo) {
        getCachedImageUrl(currentSrc).then((cached) => {
          if (cached) setResolvedSrc(cached);
        });
      }
    }
  }, [currentSrc, isVideo]);

  // Preload adjacent images into CacheStorage
  useEffect(() => {
    if (!isOpen || currentIndex === -1 || validImages.length <= 1) return;

    const nextIndex = (currentIndex + 1) % validImages.length;
    const prevIndex = (currentIndex - 1 + validImages.length) % validImages.length;
    const adjacent = [validImages[nextIndex], validImages[prevIndex]].filter(Boolean);

    preloadImagesToCache(adjacent);
  }, [isOpen, currentIndex, validImages]);

  // Navigate functions
  const handleNext = useCallback(() => {
    if (validImages.length <= 1 || currentIndex === -1) return;
    const nextIdx = (currentIndex + 1) % validImages.length;
    setZoomScale(1);
    onSelectImage?.(validImages[nextIdx]);
  }, [validImages, currentIndex, onSelectImage]);

  const handlePrev = useCallback(() => {
    if (validImages.length <= 1 || currentIndex === -1) return;
    const prevIdx = (currentIndex - 1 + validImages.length) % validImages.length;
    setZoomScale(1);
    onSelectImage?.(validImages[prevIdx]);
  }, [validImages, currentIndex, onSelectImage]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Double tap / double click zoom toggle
  const handleDoubleTap = useCallback(() => {
    setZoomScale((prev) => (prev > 1.2 ? 1 : 2.5));
  }, []);

  // Copy Image Link
  const handleCopyLink = useCallback(() => {
    if (!currentSrc) return;
    navigator.clipboard.writeText(currentSrc).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [currentSrc]);

  // Download image
  const handleDownload = useCallback(() => {
    if (!currentSrc) return;
    const a = document.createElement("a");
    a.href = currentSrc;
    a.download = `imagem_${Date.now()}.png`;
    a.target = "_blank";
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [currentSrc]);

  // Auto-hide controls and keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      setControlsVisible(true);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setControlsVisible(false);
      }, 6000);
    };

    resetTimer();

    const handleUserActivity = () => resetTimer();
    window.addEventListener("mousemove", handleUserActivity);
    window.addEventListener("mousedown", handleUserActivity);
    window.addEventListener("touchstart", handleUserActivity);

    const handleKeyDown = (e: KeyboardEvent) => {
      resetTimer();
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "+" || e.key === "=" || e.key === "ArrowUp") {
        e.preventDefault();
        setZoomScale((prev) => Math.min(prev + 0.3, 6));
      } else if (e.key === "-" || e.key === "_" || e.key === "ArrowDown") {
        e.preventDefault();
        setZoomScale((prev) => Math.max(prev - 0.3, 0.5));
      } else if (e.key === "0" || e.key.toLowerCase() === "r") {
        setZoomScale(1);
      } else if (e.key.toLowerCase() === "f") {
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("mousemove", handleUserActivity);
      window.removeEventListener("mousedown", handleUserActivity);
      window.removeEventListener("touchstart", handleUserActivity);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleNext, handlePrev, onClose, toggleFullscreen]);

  // Pinch-to-zoom touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialTouchDistRef.current = dist;
      initialScaleRef.current = zoomScale;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        handleDoubleTap();
      }
      lastTapRef.current = now;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialTouchDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / initialTouchDistRef.current;
      const newScale = Math.min(Math.max(initialScaleRef.current * factor, 0.5), 6);
      setZoomScale(newScale);
    }
  };

  const handleTouchEnd = () => {
    initialTouchDistRef.current = null;
  };

  if (!isOpen || !currentSrc) return null;

  return (
    <AnimatePresence>
      <div
        ref={containerRef}
        key="image-zoom-lightbox-modal"
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-2 sm:p-4 select-none overflow-hidden"
        onWheel={(e) => {
          const factor = 0.12;
          if (e.deltaY < 0) {
            setZoomScale((prev) => Math.min(prev + factor, 6));
          } else {
            setZoomScale((prev) => Math.max(prev - factor, 0.5));
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Dark Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/95 backdrop-blur-xl cursor-zoom-out"
          onClick={onClose}
        />

        {/* Top Header Bar */}
        <div
          className={`absolute top-0 left-0 right-0 p-4 sm:p-6 flex items-center justify-between z-30 transition-all duration-500 bg-gradient-to-b from-black/90 via-black/50 to-transparent ${
            controlsVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
          }`}
        >
          <div className="flex items-center gap-2.5 max-w-[60%] sm:max-w-[80%]">
            <div className={`p-2 rounded-xl border shrink-0 ${
              isVideo
                ? "bg-cyan-950/90 border-cyan-500/50 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                : "bg-zinc-900/90 border-zinc-800 text-cyan-400"
            }`}>
              {isVideo ? <Film size={18} className="animate-pulse" /> : <ImageIcon size={18} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide truncate">
                  {title || (isVideo ? "Modo Teatro" : "Visualizador de Imagem")}
                </h3>
                {isVideo && (
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                    Modo Teatro
                  </span>
                )}
              </div>
              {validImages.length > 1 && (
                <p className="text-[11px] font-mono text-zinc-400">
                  Mídia {currentIndex + 1} de {validImages.length}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="p-2.5 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer border border-zinc-800 shadow-lg flex items-center justify-center"
              title="Copiar Link da Mídia"
            >
              {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
            </button>

            {!isVideo && (
              <button
                type="button"
                onClick={handleDownload}
                className="p-2.5 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer border border-zinc-800 shadow-lg flex items-center justify-center"
                title="Baixar Imagem"
              >
                <Download size={18} />
              </button>
            )}

            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2.5 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer border border-zinc-800 shadow-lg hidden sm:flex items-center justify-center"
              title={isFullscreen ? "Sair da Tela Cheia (F)" : "Tela Cheia Nativa (F)"}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-full bg-red-950/80 hover:bg-red-900 text-red-200 transition-all cursor-pointer border border-red-800/60 shadow-lg flex items-center justify-center"
              title="Fechar (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Main Stage */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", damping: 28, stiffness: 350 }}
          className="relative w-full max-w-7xl h-full max-h-[88vh] z-10 flex flex-col items-center justify-center overflow-hidden my-auto"
        >
          <div className="w-full h-full flex items-center justify-center p-2 sm:p-4 select-none">
            {isVideo ? (
              <div className="w-full max-w-5xl aspect-video rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.95)] border border-cyan-500/30 bg-black relative flex items-center justify-center my-auto ring-1 ring-cyan-500/20">
                {youtubeEmbedUrl ? (
                  <iframe
                    src={`${youtubeEmbedUrl}?autoplay=1&rel=0&modestbranding=1`}
                    title={title || "Vídeo em Modo Teatro"}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                ) : (
                  <video
                    src={currentSrc}
                    controls
                    autoPlay
                    className="w-full h-full object-contain bg-black"
                  />
                )}
              </div>
            ) : imgError ? (
              <div className="flex flex-col items-center justify-center p-8 bg-zinc-900/80 border border-zinc-800 rounded-2xl text-center max-w-md gap-3">
                <ImageIcon size={48} className="text-zinc-600" />
                <h4 className="text-sm font-bold text-zinc-300">Não foi possível carregar esta imagem</h4>
                <p className="text-xs text-zinc-500 break-all">{currentSrc}</p>
                <button
                  onClick={() => setImgError(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white transition-all mt-2"
                >
                  Tentar Novamente
                </button>
              </div>
            ) : (
              <motion.img
                drag={zoomScale > 1.05}
                dragSnapToOrigin={false}
                dragConstraints={{ left: -1000, right: 1000, top: -1000, bottom: 1000 }}
                dragTransition={{ bounceStiffness: 300, bounceDamping: 30 }}
                animate={{ scale: zoomScale }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                src={resolvedSrc || currentSrc}
                alt="Zoom Imagem"
                onDoubleClick={handleDoubleTap}
                onClick={(e) => {
                  if (zoomScale <= 1.05) {
                    e.stopPropagation();
                    onClose();
                  }
                }}
                title={zoomScale <= 1.05 ? "Clique para fechar" : undefined}
                className={`max-w-full max-h-[80vh] sm:max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-zinc-800/80 select-none ${
                  zoomScale > 1.05 ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                }`}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
              />
            )}
          </div>

          {/* Floating Prev / Next Navigation Buttons */}
          {validImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
                className={`absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full bg-zinc-950/90 hover:bg-zinc-850 text-white transition-all cursor-pointer border border-zinc-800 shadow-2xl z-30 flex items-center justify-center hover:scale-110 active:scale-95 duration-300 ${
                  controlsVisible ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
                }`}
                title="Mídia anterior (Seta esquerda)"
              >
                <ChevronLeft size={24} />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className={`absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full bg-zinc-950/90 hover:bg-zinc-850 text-white transition-all cursor-pointer border border-zinc-800 shadow-2xl z-30 flex items-center justify-center hover:scale-110 active:scale-95 duration-300 ${
                  controlsVisible ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
                }`}
                title="Próxima mídia (Seta direita)"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          {/* Bottom Floating Control Bar */}
          <div
            className={`absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-3 bg-zinc-950/95 border border-zinc-800 backdrop-blur-xl px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-2xl shadow-2xl select-none z-30 transition-all duration-500 max-w-[95vw] overflow-x-auto ${
              controlsVisible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"
            }`}
          >
            {isVideo ? (
              /* Video Theater Controls */
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5 font-mono">
                  <Tv size={14} className="text-cyan-400 animate-pulse" />
                  <span>Modo Teatro Exclusivo</span>
                </span>
                <div className="w-px h-4 bg-zinc-800" />
                {validImages.length > 1 && (
                  <span className="text-xs font-mono font-bold text-zinc-400">
                    Mídia {currentIndex + 1} de {validImages.length}
                  </span>
                )}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer text-xs flex items-center gap-1 font-bold"
                  title="Tela Cheia Nativa (F)"
                >
                  <Maximize2 size={13} />
                  <span>Tela Cheia</span>
                </button>
              </div>
            ) : (
              /* Image Controls */
              <>
                <button
                  type="button"
                  onClick={() => setZoomScale((prev) => Math.max(prev - 0.25, 0.5))}
                  className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center justify-center hover:scale-105 active:scale-95"
                  title="Diminuir Zoom (-)"
                >
                  <ZoomOut size={16} />
                </button>

                <div className="flex items-center gap-1">
                  {[1, 1.5, 2].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setZoomScale(preset)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                        Math.abs(zoomScale - preset) < 0.05
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                          : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80"
                      }`}
                    >
                      {preset * 100}%
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setZoomScale((prev) => Math.min(prev + 0.25, 6))}
                  className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center justify-center hover:scale-105 active:scale-95"
                  title="Aumentar Zoom (+)"
                >
                  <ZoomIn size={16} />
                </button>

                <div className="w-px h-5 bg-zinc-800 mx-0.5" />

                <button
                  type="button"
                  onClick={() => setZoomScale(1)}
                  className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center justify-center hover:scale-105 active:scale-95"
                  title="Redefinir Zoom (0 ou R)"
                >
                  <RotateCcw size={16} />
                </button>

                {validImages.length > 1 && (
                  <>
                    <div className="w-px h-5 bg-zinc-800 mx-0.5" />
                    <span className="text-xs font-mono font-bold text-cyan-400 whitespace-nowrap">
                      {currentIndex + 1} / {validImages.length}
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
