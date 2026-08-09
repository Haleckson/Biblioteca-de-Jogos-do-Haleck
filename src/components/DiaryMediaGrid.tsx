/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { MediaItem } from "../types";
import { Play, Eye, Loader2, Film, Image as ImageIcon, Trash2, CheckSquare, Square, Check, Tv, Maximize2 } from "lucide-react";
import { getYoutubeEmbedUrl } from "../utils/youtube";
import { YouTubeThumbnail } from "./YouTubeThumbnail";
import { resolveSingleMediaUrl } from "../utils/mediaRepair";
import { CustomConfirm } from "./CustomDialogs";

interface DiaryMediaGridProps {
  medias: MediaItem[];
  handleOpenZoom: (src: string) => void;
  onDeleteMedias?: (mediasToDelete: MediaItem[]) => void;
  onDeleteAllMedias?: () => void;
  triggerConfirm?: (title: string, message: string, callback: () => void) => void;
  readOnly?: boolean;
}

export function DiaryMediaGrid({
  medias,
  handleOpenZoom,
  onDeleteMedias,
  onDeleteAllMedias,
  triggerConfirm,
  readOnly = false,
}: DiaryMediaGridProps) {
  const [visibleCount, setVisibleCount] = useState(50);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [internalConfirmState, setInternalConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const observerRef = useRef<HTMLDivElement | null>(null);

  const requestDeleteConfirm = (title: string, message: string, onConfirm: () => void) => {
    if (triggerConfirm) {
      triggerConfirm(title, message, onConfirm);
    } else {
      setInternalConfirmState({
        isOpen: true,
        title,
        message,
        onConfirm: () => {
          onConfirm();
          setInternalConfirmState(null);
        },
      });
    }
  };

  // Load more function
  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + 50, medias.length));
  };

  // Reset selection when medias change or mode toggled off
  useEffect(() => {
    setSelectedIndices(new Set());
  }, [medias.length, isSelectionMode]);

  // Infinite Scroll Observer
  useEffect(() => {
    if (!observerRef.current || visibleCount >= medias.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      {
        rootMargin: "200px",
      }
    );

    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [visibleCount, medias.length]);

  const displayedMedias = medias.slice(0, visibleCount);

  const toggleSelectAll = () => {
    if (selectedIndices.size === displayedMedias.length) {
      setSelectedIndices(new Set());
    } else {
      const all = new Set<number>();
      displayedMedias.forEach((_, idx) => all.add(idx));
      setSelectedIndices(all);
    }
  };

  const toggleSelectItem = (idx: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const executeDeleteSelected = () => {
    if (!onDeleteMedias) return;
    const itemsToDelete = Array.from<number>(selectedIndices)
      .map((idx) => displayedMedias[idx])
      .filter((item): item is MediaItem => Boolean(item));
    if (itemsToDelete.length === 0) return;

    onDeleteMedias(itemsToDelete);
    setSelectedIndices(new Set());
    setIsSelectionMode(false);
  };

  const handleConfirmDeleteSelected = () => {
    if (selectedIndices.size === 0 || !onDeleteMedias) return;
    const itemsToDelete = Array.from<number>(selectedIndices)
      .map((idx) => displayedMedias[idx])
      .filter((item): item is MediaItem => Boolean(item));
    if (itemsToDelete.length === 0) return;

    const message = `Tem certeza que deseja excluir ${itemsToDelete.length} ${
      itemsToDelete.length === 1 ? "mídia selecionada" : "mídias selecionadas"
    }? Esta ação não poderá ser desfeita.`;

    requestDeleteConfirm("Excluir Mídias Selecionadas", message, executeDeleteSelected);
  };

  const executeDeleteAll = () => {
    if (onDeleteAllMedias) {
      onDeleteAllMedias();
    } else if (onDeleteMedias) {
      onDeleteMedias(medias);
    }
    setSelectedIndices(new Set());
    setIsSelectionMode(false);
  };

  const handleConfirmDeleteAll = () => {
    if (!onDeleteAllMedias && !onDeleteMedias) return;
    const message = `Tem certeza que deseja apagar TODAS as ${medias.length} mídias anexadas a esta entrada de diário? Esta ação é irreversível.`;

    requestDeleteConfirm("Deletar Todas as Mídias", message, executeDeleteAll);
  };

  return (
    <div className="space-y-3">
      {/* Action Bar for Batch Delete & Selection Controls */}
      {!readOnly && (onDeleteMedias || onDeleteAllMedias) && medias.length > 0 && (
        <div className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSelectionMode(!isSelectionMode)}
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
                isSelectionMode
                  ? "bg-cyan-950 border-cyan-500/60 text-cyan-300"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
              }`}
            >
              {isSelectionMode ? <CheckSquare size={14} /> : <Square size={14} />}
              <span>{isSelectionMode ? "Sair da Seleção" : "Selecionar Mídias"}</span>
            </button>

            {isSelectionMode && (
              <button
                type="button"
                onClick={toggleSelectAll}
                className="px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer text-[11px]"
              >
                {selectedIndices.size === displayedMedias.length ? "Desmarcar Todas" : "Marcar Todas"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isSelectionMode && selectedIndices.size > 0 && (
              <button
                type="button"
                onClick={handleConfirmDeleteSelected}
                className="px-3 py-1.5 rounded-xl bg-red-950 border border-red-500/60 text-red-300 hover:bg-red-900 hover:text-white font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-lg animate-pulse"
              >
                <Trash2 size={13} />
                <span>Excluir Selecionadas ({selectedIndices.size})</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleConfirmDeleteAll}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-red-950 hover:border-red-500/50 text-zinc-400 hover:text-red-300 transition-all cursor-pointer flex items-center gap-1.5 text-[11px]"
              title="Apagar todas as mídias desta entrada com 1 clique"
            >
              <Trash2 size={13} />
              <span>Deletar Todas ({medias.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Media Grid */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 bg-zinc-950/40 rounded-2xl">
        {displayedMedias.map((m, mIdx) => {
          const isSelected = selectedIndices.has(mIdx);
          return (
            <LazyMediaCard
              key={`${m.src}-${mIdx}`}
              media={m}
              mIdx={mIdx}
              handleOpenZoom={handleOpenZoom}
              isSelectionMode={!readOnly && isSelectionMode}
              isSelected={isSelected}
              onToggleSelect={() => toggleSelectItem(mIdx)}
              onSingleDelete={
                !readOnly && onDeleteMedias
                  ? () => {
                      requestDeleteConfirm("Excluir Mídia", "Deseja realmente apagar esta mídia do diário?", () => {
                        onDeleteMedias([m]);
                      });
                    }
                  : undefined
              }
            />
          );
        })}
      </div>

      {/* Infinite Scroll Trigger / Status */}
      {medias.length > visibleCount && (
        <div ref={observerRef} className="flex flex-col items-center justify-center py-4 gap-2">
          <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
            <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            <span>Carregando mídias ({visibleCount} de {medias.length} exibidas)...</span>
          </div>
          <button
            onClick={handleLoadMore}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-[10px] uppercase tracking-wider font-bold text-cyan-400 transition-all cursor-pointer"
          >
            Carregar Mais Manualmente
          </button>
        </div>
      )}

      {/* Footer Info of Total Medias */}
      {medias.length > 50 && (
        <div className="text-center text-[10px] text-zinc-500 font-medium uppercase tracking-widest pb-1">
          Exibindo {Math.min(visibleCount, medias.length)} de {medias.length} mídias anexadas
        </div>
      )}

      {/* Internal Confirmation Dialog Fallback */}
      {internalConfirmState && (
        <CustomConfirm
          isOpen={internalConfirmState.isOpen}
          title={internalConfirmState.title}
          message={internalConfirmState.message}
          onConfirm={internalConfirmState.onConfirm}
          onCancel={() => setInternalConfirmState(null)}
        />
      )}
    </div>
  );
}

interface LazyMediaCardProps {
  key?: string;
  media: MediaItem;
  mIdx: number;
  handleOpenZoom: (src: string) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onSingleDelete?: () => void;
}

function LazyMediaCard({
  media,
  mIdx,
  handleOpenZoom,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  onSingleDelete,
}: LazyMediaCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const embedUrl = getYoutubeEmbedUrl(media.src);
  const isYt = !!embedUrl;

  // Handle Play Action (For Videos/YouTube)
  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelectionMode && onToggleSelect) {
      onToggleSelect();
      return;
    }
    setIsPlaying(true);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelectionMode && onToggleSelect) {
      e.stopPropagation();
      onToggleSelect();
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`rounded-xl overflow-hidden border bg-zinc-950 aspect-video w-full flex items-center justify-center relative group select-none shadow-lg transition-all duration-200 ${
        isSelected
          ? "border-cyan-400 ring-2 ring-cyan-500/50 scale-[0.98]"
          : "border-zinc-800 hover:border-zinc-700"
      } ${isSelectionMode ? "cursor-pointer" : ""}`}
    >
      {/* Checkbox overlay in selection mode */}
      {isSelectionMode && (
        <div
          className={`absolute top-2 left-2 z-20 w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
            isSelected
              ? "bg-cyan-500 text-black font-extrabold shadow-md"
              : "bg-black/60 border border-zinc-600 text-transparent"
          }`}
        >
          <Check size={14} className={isSelected ? "stroke-[3]" : "opacity-0"} />
        </div>
      )}

      {/* Quick Single Delete Button (when not in selection mode) */}
      {!isSelectionMode && onSingleDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSingleDelete();
          }}
          className="absolute top-2 right-2 z-20 p-1.5 rounded-lg bg-black/70 hover:bg-red-600 border border-zinc-700/80 hover:border-red-500 text-zinc-300 hover:text-white transition-all opacity-0 group-hover:opacity-100 cursor-pointer shadow-md"
          title="Excluir esta mídia"
        >
          <Trash2 size={13} />
        </button>
      )}

      {/* 1. YOUTUBE MEDIAS */}
      {isYt ? (
        isPlaying ? (
          <div className="w-full h-full relative group/yt">
            <iframe
              src={`${embedUrl}?autoplay=1&rel=0&modestbranding=1`}
              title={`Vídeo do YouTube - ${mIdx}`}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenZoom(media.src);
              }}
              className="absolute top-2 left-2 z-20 px-2.5 py-1 rounded-lg bg-black/85 hover:bg-cyan-600 border border-zinc-700 hover:border-cyan-400 text-zinc-300 hover:text-white transition-all cursor-pointer shadow-lg flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md opacity-0 group-hover/yt:opacity-100"
              title="Expandir para o Modo Teatro"
            >
              <Tv size={12} className="text-cyan-400" />
              <span>Modo Teatro</span>
            </button>
          </div>
        ) : (
          <div 
            className="w-full h-full relative cursor-pointer group/yt overflow-hidden bg-black"
            onClick={handlePlay}
          >
            {/* Thumbnail */}
            <YouTubeThumbnail
              url={media.src}
              className="w-full h-full object-cover transition-transform duration-500 group-hover/yt:scale-[1.04]"
              alt={`Miniatura YouTube ${mIdx + 1}`}
            />
            {/* Play Button Overlay */}
            <div className="absolute inset-0 bg-black/40 group-hover/yt:bg-black/20 transition-colors duration-300 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-red-600/95 text-white flex items-center justify-center shadow-2xl transition-all duration-300 transform scale-90 group-hover/yt:scale-100 group-hover/yt:bg-red-500 ring-4 ring-transparent group-hover/yt:ring-white/20">
                <Play size={24} fill="currentColor" className="ml-1" />
              </div>
            </div>
            {/* Modo Teatro Overlay Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenZoom(media.src);
              }}
              className="absolute top-2 left-2 z-20 px-2.5 py-1 rounded-lg bg-black/80 hover:bg-cyan-600 border border-zinc-700 hover:border-cyan-400 text-zinc-200 hover:text-white transition-all cursor-pointer shadow-lg flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md opacity-90 group-hover/yt:opacity-100 group-hover/yt:scale-105"
              title="Abrir diretamente no Modo Teatro"
            >
              <Tv size={12} className="text-cyan-400" />
              <span>Modo Teatro</span>
            </button>
            {/* Badge */}
            <span className="absolute bottom-2.5 right-2.5 bg-black/80 backdrop-blur-md text-[9px] font-bold uppercase tracking-wider text-white px-2 py-1 rounded-md border border-zinc-800 flex items-center gap-1">
              <Film size={10} className="text-red-400" />
              <span>YouTube</span>
            </span>
          </div>
        )
      ) : media.isVideo ? (
        /* 2. DIRECT VIDEOS (MP4, WEBM, ETC) */
        isPlaying ? (
          <div className="w-full h-full relative group/vid">
            <video 
              src={media.src} 
              controls 
              autoPlay 
              className="w-full h-full object-contain" 
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenZoom(media.src);
              }}
              className="absolute top-2 left-2 z-20 px-2.5 py-1 rounded-lg bg-black/85 hover:bg-cyan-600 border border-zinc-700 hover:border-cyan-400 text-zinc-300 hover:text-white transition-all cursor-pointer shadow-lg flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md opacity-0 group-hover/vid:opacity-100"
              title="Expandir para o Modo Teatro"
            >
              <Tv size={12} className="text-cyan-400" />
              <span>Modo Teatro</span>
            </button>
          </div>
        ) : (
          <div 
            className="w-full h-full relative cursor-pointer group/vid overflow-hidden bg-black flex items-center justify-center"
            onClick={handlePlay}
          >
            <video 
              src={media.src} 
              preload="metadata"
              muted 
              className="w-full h-full object-cover opacity-80 group-hover/vid:opacity-100 transition-opacity" 
            />
            <div className="absolute inset-0 bg-black/40 group-hover/vid:bg-black/20 transition-colors duration-300 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-cyan-600/90 text-white flex items-center justify-center shadow-xl transition-all duration-300 transform scale-90 group-hover/vid:scale-100 group-hover/vid:bg-cyan-500">
                <Play size={22} fill="currentColor" className="ml-0.5" />
              </div>
            </div>
            {/* Modo Teatro Overlay Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenZoom(media.src);
              }}
              className="absolute top-2 left-2 z-20 px-2.5 py-1 rounded-lg bg-black/80 hover:bg-cyan-600 border border-zinc-700 hover:border-cyan-400 text-zinc-200 hover:text-white transition-all cursor-pointer shadow-lg flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md opacity-90 group-hover/vid:opacity-100 group-hover/vid:scale-105"
              title="Abrir diretamente no Modo Teatro"
            >
              <Tv size={12} className="text-cyan-400" />
              <span>Modo Teatro</span>
            </button>
            <span className="absolute bottom-2.5 right-2.5 bg-black/80 backdrop-blur-md text-[9px] font-bold uppercase tracking-wider text-cyan-300 px-2 py-1 rounded-md border border-zinc-800 flex items-center gap-1">
              <Film size={10} />
              <span>Vídeo</span>
            </span>
          </div>
        )
      ) : (
        /* 3. DIRECT IMAGES (JPG, PNG, WEBP, GIF, ETC) */
        <div className="w-full h-full relative overflow-hidden flex items-center justify-center bg-zinc-950/20">
          
          {/* Blur skeleton loader */}
          {!isLoaded && (
            <div className="absolute inset-0 bg-zinc-900 animate-pulse flex items-center justify-center gap-1.5">
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              <span className="text-[10px] text-zinc-500 font-mono">Carregando imagem...</span>
            </div>
          )}

          <img
            src={media.src}
            className={`w-full h-full object-contain transition-all duration-500 hover:scale-[1.04] ${
              isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"
            } ${isSelectionMode ? "" : "cursor-zoom-in"}`}
            alt="Anexo de diário"
            loading="lazy"
            referrerPolicy="no-referrer"
            onClick={(e) => {
              if (isSelectionMode) return;
              handleOpenZoom(media.src);
            }}
            onLoad={() => setIsLoaded(true)}
            onError={async (e: any) => {
              const imgEl = e.target as HTMLImageElement;
              const currentSrc = media.src;
              if (currentSrc && !imgEl.dataset.triedRepair) {
                imgEl.dataset.triedRepair = "true";
                try {
                  const resolved = await resolveSingleMediaUrl(currentSrc);
                  if (resolved && resolved !== currentSrc) {
                    imgEl.src = resolved;
                    return;
                  }
                } catch {
                  // ignore
                }
              }
              setIsLoaded(true);
              imgEl.src = "https://placehold.co/400x300/040406/ffffff?text=Falha+de+Mídia";
            }}
          />

          {/* Image Hover Eye Overlay */}
          {isLoaded && !isSelectionMode && (
            <div 
              className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors duration-300 flex items-center justify-center pointer-events-none opacity-0 hover:opacity-100"
              onClick={() => handleOpenZoom(media.src)}
            >
              <div className="w-10 h-10 rounded-full bg-zinc-900/90 border border-zinc-700 flex items-center justify-center text-white shadow-2xl scale-75 group-hover:scale-100 transition-all duration-300">
                <Eye size={18} className="text-cyan-400" />
              </div>
            </div>
          )}
          
          {/* Badge */}
          {isLoaded && (
            <span className="absolute bottom-2.5 right-2.5 bg-zinc-950/80 backdrop-blur-md text-[9px] font-bold uppercase tracking-wider text-zinc-400 px-2 py-0.5 rounded-md border border-zinc-800/80 flex items-center gap-1 pointer-events-none">
              <ImageIcon size={10} className="text-purple-400" />
              <span>Imagem</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
