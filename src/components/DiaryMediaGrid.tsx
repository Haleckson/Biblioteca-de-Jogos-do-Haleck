/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { MediaItem } from "../types";
import { Play, Eye, Loader2, Sparkles, Film, Image as ImageIcon } from "lucide-react";
import { getYoutubeEmbedUrl, isYoutubeUrl } from "../utils/youtube";

interface DiaryMediaGridProps {
  medias: MediaItem[];
  handleOpenZoom: (src: string) => void;
}

export function DiaryMediaGrid({ medias, handleOpenZoom }: DiaryMediaGridProps) {
  const [visibleCount, setVisibleCount] = useState(50);
  const observerRef = useRef<HTMLDivElement | null>(null);

  // Load more function
  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + 50, medias.length));
  };

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
        rootMargin: "200px", // Trigger slightly before scrolling past the bottom for a fluid experience
      }
    );

    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [visibleCount, medias.length]);

  const displayedMedias = medias.slice(0, visibleCount);

  return (
    <div className="space-y-4">
      {/* Media Grid */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 bg-zinc-950/40 rounded-2xl">
        {displayedMedias.map((m, mIdx) => (
          <LazyMediaCard
            key={`${m.src}-${mIdx}`}
            media={m}
            mIdx={mIdx}
            handleOpenZoom={handleOpenZoom}
          />
        ))}
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
    </div>
  );
}

interface LazyMediaCardProps {
  key?: string;
  media: MediaItem;
  mIdx: number;
  handleOpenZoom: (src: string) => void;
}

function LazyMediaCard({ media, mIdx, handleOpenZoom }: LazyMediaCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const embedUrl = getYoutubeEmbedUrl(media.src);
  const isYt = !!embedUrl;

  // Get Youtube Thumbnail
  let ytThumb = "";
  if (isYt && embedUrl) {
    const videoId = embedUrl.split("/embed/")[1]?.split("?")[0];
    if (videoId) {
      // Use hqdefault (high quality) thumbnail
      ytThumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }
  }

  // Handle Play Action (For Videos/YouTube)
  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlaying(true);
  };

  return (
    <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 aspect-video w-full flex items-center justify-center relative group select-none shadow-lg">
      
      {/* 1. YOUTUBE MEDIAS */}
      {isYt ? (
        isPlaying ? (
          <iframe
            src={`${embedUrl}?autoplay=1&rel=0&modestbranding=1`}
            title={`Vídeo do YouTube - ${mIdx}`}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full"
          />
        ) : (
          <div 
            className="w-full h-full relative cursor-pointer group/yt overflow-hidden"
            onClick={handlePlay}
          >
            {/* Thumbnail */}
            <img
              src={ytThumb || "https://placehold.co/400x300/040406/ffffff?text=Video+YouTube"}
              className="w-full h-full object-cover transition-transform duration-500 group-hover/yt:scale-[1.04]"
              alt="Miniatura YouTube"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            {/* Play Button Overlay */}
            <div className="absolute inset-0 bg-black/40 group-hover/yt:bg-black/20 transition-colors duration-300 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-red-600/95 text-white flex items-center justify-center shadow-2xl transition-all duration-300 transform scale-90 group-hover/yt:scale-100 group-hover/yt:bg-red-500 ring-4 ring-transparent group-hover/yt:ring-white/20">
                <Play size={24} fill="currentColor" className="ml-1" />
              </div>
            </div>
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
          <video 
            src={media.src} 
            controls 
            autoPlay 
            className="w-full h-full object-contain" 
          />
        ) : (
          <div 
            className="w-full h-full relative cursor-pointer group/vid"
            onClick={handlePlay}
          >
            {/* Fake placeholder video icon representation */}
            <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 border border-zinc-800 p-4 gap-2 text-center transition-all duration-300 group-hover/vid:bg-zinc-850">
              <Film size={28} className="text-cyan-400 animate-pulse" />
              <div className="space-y-0.5">
                <span className="text-xs text-zinc-300 font-semibold block">Vídeo Anexo</span>
                <span className="text-[9px] text-zinc-500 font-mono block break-all line-clamp-1 max-w-[200px]">{media.src.split("/").pop()}</span>
              </div>
              <div className="px-3 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 flex items-center gap-1 text-[10px] font-bold text-cyan-300 mt-1 transition-all">
                <Play size={10} fill="currentColor" />
                <span>Reproduzir Vídeo</span>
              </div>
            </div>
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
            className={`w-full h-full object-contain cursor-zoom-in transition-all duration-500 hover:scale-[1.04] ${
              isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"
            }`}
            alt="Anexo de diário"
            loading="lazy"
            referrerPolicy="no-referrer"
            onClick={() => handleOpenZoom(media.src)}
            onLoad={() => setIsLoaded(true)}
            onError={(e: any) => {
              setIsLoaded(true);
              (e.target as HTMLImageElement).src = "https://placehold.co/400x300/040406/ffffff?text=Falha+de+Mídia";
            }}
          />

          {/* Image Hover Eye Overlay */}
          {isLoaded && (
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
