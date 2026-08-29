/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { memo } from "react";
import { Game, splitEntities, getDlcMode, getGameTrophies, getGameTrophyItems, parseContextNote, formatDateDisplay } from "../types";
import { motion } from "motion/react";
import { Clock, Folder, Tag, Layers, RotateCcw, Shield, Maximize2, Settings, Play, Infinity, AlertTriangle, Gamepad2, Trophy, Calendar, Building2, BookOpen, Sparkles, CalendarCheck } from "lucide-react";
import { formatHltbTime } from "../utils/hltbFormatter";
import TrophyBadge, { TrophiesList } from "./TrophyBadge";
import { formatHoursAndMinutes, getTotalGamePlaytimeHours, getGameTimeBreakdown } from "../utils/playtime";
import { startLiveSessionForGame } from "./LiveSessionWidget";
import { formatSteamPlaytime } from "../utils/steamApi";
import { formatGogPlaytime } from "../utils/gogApi";
import CachedImage from "./CachedImage";

export interface GameCardProps {
  game: Game;
  onClick?: (id?: string) => void;
  isAdmin?: boolean;
  onUpdateGame?: (updatedGame: Game) => void;
  onOpenZoom?: (src: string, customAllImages?: string[], customTitle?: string) => void;
  onOpenGameEstimateModal?: (game: Game) => void;
  onEditGame?: (game: Game) => void;
  key?: string | number;
}

export function chipClass(status: string) {
  const s = (status || "").toLowerCase().trim();
  if (s.includes("jogando")) return "chip-green";
  if (s.includes("hiatus") || s.includes("pausado")) return "chip-orange";
  if (s.includes("terminado") || s.includes("zerado") || s.includes("conclu") || s.includes("platinado") || s.includes("100%")) return "chip-blue";
  if (s.includes("desistido") || s.includes("abandonado") || s.includes("interrompido")) return "chip-red";
  return "chip-gray";
}

export function getPlatformBadgeStyle(platformName: string) {
  const p = (platformName || "PC").toLowerCase().trim();
  
  if (p === "pc" || p.includes("steam") || p.includes("epic") || p.includes("gog") || p.includes("computer")) {
    return {
      text: "text-purple-400",
      border: "border-purple-500/40",
      bg: "bg-purple-950/40",
      glow: "shadow-[0_0_8px_rgba(168,85,247,0.15)]",
    };
  }
  
  if (p.includes("sony") || p.includes("playstation") || p.startsWith("ps") || p === "psp" || p.includes("vita")) {
    return {
      text: "text-blue-400",
      border: "border-blue-500/40",
      bg: "bg-blue-950/40",
      glow: "shadow-[0_0_8px_rgba(59,130,246,0.15)]",
    };
  }
  
  if (p.includes("microsoft") || p.includes("xbox") || p === "xone" || p === "xsx" || p === "x360") {
    return {
      text: "text-emerald-400",
      border: "border-emerald-500/40",
      bg: "bg-emerald-950/40",
      glow: "shadow-[0_0_8px_rgba(16,185,129,0.15)]",
    };
  }
  
  if (p.includes("nintendo") || p.includes("switch") || p.includes("wii") || p === "ds" || p === "3ds" || p === "snes" || p === "nes") {
    return {
      text: "text-red-400",
      border: "border-red-500/40",
      bg: "bg-red-950/40",
      glow: "shadow-[0_0_8px_rgba(239,68,68,0.15)]",
    };
  }
  
  if (p.includes("mobile") || p.includes("android") || p.includes("ios") || p.includes("apple") || p.includes("iphone") || p.includes("ipad")) {
    return {
      text: "text-amber-400",
      border: "border-amber-500/40",
      bg: "bg-amber-950/40",
      glow: "shadow-[0_0_8px_rgba(245,158,11,0.15)]",
    };
  }
  
  return {
    text: "text-cyan-300",
    border: "border-cyan-500/40",
    bg: "bg-cyan-950/40",
    glow: "shadow-[0_0_8px_rgba(6,182,212,0.15)]",
  };
}

export function renderStars(rating: number, prefix = "", size = "w-3.5 h-3.5", dropShadow = "", forcePlatina = false) {
  const stars = [];
  const actualRating = forcePlatina ? 5 : rating;
  
  // Determine color based on rating
  let starColor = "#facc15"; // default yellow-400 (Gold)
  let actualDropShadow = dropShadow;
  
  if (actualRating >= 5) {
    starColor = "#E5E4E2"; // Platina brilhante
    actualDropShadow = dropShadow || "drop-shadow(0 0 6px rgba(229, 228, 226, 0.95)) drop-shadow(0 0 1px rgba(255, 255, 255, 1))";
  } else if (actualRating >= 3.0) {
    starColor = "#facc15"; // Ouro
  } else if (actualRating >= 2.0) {
    starColor = "#a1a1aa"; // Prata
  } else if (actualRating > 0) {
    starColor = "#b45309"; // Bronze
  }

  const uniqueSuffix = prefix ? prefix.replace(/[^a-zA-Z0-9]/g, "-") : Math.random().toString(36).substring(2, 6);

  for (let i = 1; i <= 5; i++) {
    const filled = actualRating >= i;
    const isHalf = !filled && actualRating + 0.5 >= i;

    if (filled) {
      stars.push(
        <svg 
          key={i} 
          className={`${size} fill-current shrink-0`} 
          style={{ color: starColor, filter: actualDropShadow || undefined }}
          viewBox="0 0 24 24"
        >
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      );
    } else if (isHalf) {
      const gradId = `halfGrad-${i}-${rating}-${uniqueSuffix}`;
      stars.push(
        <svg 
          key={i} 
          className={`${size} fill-current shrink-0`} 
          style={{ filter: actualDropShadow || undefined }}
          viewBox="0 0 24 24"
        >
          <defs>
            <linearGradient id={gradId}>
              <stop offset="50%" stopColor={starColor} />
              <stop offset="50%" stopColor="#27272a" />
            </linearGradient>
          </defs>
          <path fill={`url(#${gradId})`} d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      );
    } else {
      stars.push(
        <svg key={i} className={`${size} text-zinc-800 fill-current shrink-0`} viewBox="0 0 24 24">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      );
    }
  }
  return <div className="flex items-center gap-0.5 shrink-0">{stars}</div>;
}

export function renderIcon(game: Game, className = "w-10 h-10 rounded-2xl") {
  if (game.iconType === "emoji" || !game.icon) {
    return (
      <span className={`${className} flex items-center justify-center text-2xl select-none bg-zinc-900/85 border border-zinc-800/80`}>
        {game.icon || "🎮"}
      </span>
    );
  }
  return (
    <img
      src={game.icon}
      className={`${className} object-cover border border-zinc-800/80`}
      alt="icon"
      referrerPolicy="no-referrer"
      onError={(e: any) => {
        (e.target as HTMLImageElement).src = "https://placehold.co/100x100/040406/ffffff?text=🎮";
      }}
    />
  );
}

export function getStatusBorderClass(rawStatusList: string[] | string) {
  const statusList = Array.isArray(rawStatusList)
    ? rawStatusList
    : typeof rawStatusList === "string" && rawStatusList
    ? [rawStatusList]
    : [];
  if (!statusList.length) return "!border-zinc-700/60 hover:!border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.05)] hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]";
  const status = statusList[0];
  if (status === "Jogando") return "!border-emerald-500/60 hover:!border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.12)] hover:shadow-[0_0_25px_rgba(16,185,129,0.25)]";
  if (status === "Em Hiatus" || status === "Pausado") return "!border-amber-500/60 hover:!border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.12)] hover:shadow-[0_0_25px_rgba(245,158,11,0.25)]";
  if (status === "Terminado" || status === "Zerado") return "!border-sky-500/60 hover:!border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.12)] hover:shadow-[0_0_25px_rgba(56,189,248,0.25)]";
  if (status === "Desistido" || status === "Abandonado") return "!border-rose-500/60 hover:!border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.12)] hover:shadow-[0_0_25px_rgba(244,63,94,0.25)]";
  if (status === "Backlog" || status === "Quero Jogar") return "!border-purple-500/60 hover:!border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.12)] hover:shadow-[0_0_25px_rgba(168,85,247,0.25)]";
  return "!border-zinc-700/60 hover:!border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.05)] hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]";
}

function GameCardComponent({ game, onClick, isAdmin, onUpdateGame, onOpenZoom, onOpenGameEstimateModal, onEditGame }: GameCardProps) {
  const coverImg = game.cover || "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800";
  const firstGenre = game.genre && game.genre.length ? game.genre[0] : "Geral";

  const posX = game.coverPositionX !== undefined ? game.coverPositionX : 50;
  const posY = game.coverPosition !== undefined ? game.coverPosition : 50;
  const zoom = game.coverZoom !== undefined ? game.coverZoom : 100;

  const [isAdjusting, setIsAdjusting] = React.useState(false);
  const [tempPosX, setTempPosX] = React.useState(posX);
  const [tempPosY, setTempPosY] = React.useState(posY);
  const [tempZoom, setTempZoom] = React.useState(zoom);

  // Collect diary images for hover slideshow feature
  const diaryImages = React.useMemo(() => {
    if (!game.diary || !Array.isArray(game.diary)) return [];
    const imgs: string[] = [];

    const decodeAndCleanUrl = (raw: any): string => {
      if (!raw) return "";
      let str = "";
      if (typeof raw === "string") {
        str = raw;
      } else if (typeof raw === "object" && raw !== null) {
        str = raw.src || raw.url || raw.photo || raw.image || raw.link || "";
      }
      if (typeof str !== "string" || !str) return "";

      str = str
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .trim();

      str = str.replace(/[<>"'\)\]\s]+$/, "").replace(/^[<>"'\(\[\s]+/, "");

      // Convert Google Drive view URLs to direct image URLs
      if (str.includes("drive.google.com")) {
        const fileIdMatch = str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || str.match(/id=([a-zA-Z0-9_-]+)/);
        if (fileIdMatch && fileIdMatch[1]) {
          return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
        }
      }

      return str;
    };

    const addImg = (rawUrlOrObj: any) => {
      if (!rawUrlOrObj) return;
      if (typeof rawUrlOrObj === "object" && rawUrlOrObj !== null) {
        if (
          rawUrlOrObj.isVideo ||
          rawUrlOrObj.type === "video" ||
          (rawUrlOrObj.mimeType && typeof rawUrlOrObj.mimeType === "string" && rawUrlOrObj.mimeType.startsWith("video/"))
        ) {
          return;
        }
      }
      const cleanUrl = decodeAndCleanUrl(rawUrlOrObj);
      if (
        cleanUrl &&
        (cleanUrl.startsWith("http") || cleanUrl.startsWith("blob:") || cleanUrl.startsWith("data:image")) &&
        !imgs.includes(cleanUrl) &&
        !cleanUrl.includes("youtube.com") &&
        !cleanUrl.includes("youtu.be") &&
        !cleanUrl.match(/\.(mp4|webm|ogg|mov|mkv|avi|m4v|3gp|flv|wmv)($|\?)/i) &&
        !cleanUrl.includes("video_anexo_") &&
        !cleanUrl.includes("video_youtube_")
      ) {
        imgs.push(cleanUrl);
      }
    };

    for (const entry of game.diary) {
      if (!entry) continue;

      // 1. Check medias array
      if (Array.isArray(entry.medias)) {
        for (const m of entry.medias) {
          addImg(m);
        }
      }

      // 2. Check direct fields (photo, photos, image, images, screenshot, screenshots)
      if ((entry as any).photo) addImg((entry as any).photo);
      if ((entry as any).image) addImg((entry as any).image);
      if ((entry as any).screenshot) addImg((entry as any).screenshot);
      if ((entry as any).cover) addImg((entry as any).cover);
      if (Array.isArray((entry as any).photos)) {
        for (const p of (entry as any).photos) addImg(p);
      }
      if (Array.isArray((entry as any).images)) {
        for (const i of (entry as any).images) addImg(i);
      }
      if (Array.isArray((entry as any).screenshots)) {
        for (const s of (entry as any).screenshots) addImg(s);
      }

      // 3. Check entry text / content / HTML / Markdown / URLs
      const textToScan = entry.text || (entry as any).content || "";
      if (textToScan && typeof textToScan === "string") {
        const decodedText = textToScan
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, "&");

        const imgTagRegex = /<img[^>]+src=["']([^"']+)["']/gi;
        const mdImgRegex = /!\[.*?\]\((.*?)\)/gi;
        const srcAttrRegex = /src=["']([^"']+)["']/gi;
        const genericUrlRegex = /(https?:\/\/[^\s<"'\)\>]+)/gi;

        let match: RegExpExecArray | null;
        while ((match = imgTagRegex.exec(decodedText)) !== null) {
          if (match[1]) addImg(match[1]);
        }
        while ((match = mdImgRegex.exec(decodedText)) !== null) {
          if (match[1]) addImg(match[1]);
        }
        while ((match = srcAttrRegex.exec(decodedText)) !== null) {
          if (match[1]) addImg(match[1]);
        }
        while ((match = genericUrlRegex.exec(decodedText)) !== null) {
          const urlStr = match[1];
          if (urlStr) {
            const cleaned = decodeAndCleanUrl(urlStr);
            if (
              cleaned.match(/\.(png|jpg|jpeg|gif|webp|svg)($|\?)/i) ||
              cleaned.includes("i.ibb.co") ||
              cleaned.includes("ibb.co/") ||
              cleaned.includes("images.unsplash.com") ||
              cleaned.includes("i.imgur.com") ||
              cleaned.includes("imgur.com/") ||
              cleaned.includes("lh3.googleusercontent.com") ||
              cleaned.includes("media.discordapp.net") ||
              cleaned.includes("cdn.discordapp.com")
            ) {
              addImg(cleaned);
            }
          }
        }
      }
    }
    return imgs;
  }, [game.diary]);

  const [activeRandomImage, setActiveRandomImage] = React.useState<string | null>(null);
  const [failedUrls, setFailedUrls] = React.useState<Set<string>>(new Set());
  const [showSpoilerPrompt, setShowSpoilerPrompt] = React.useState(false);
  const hoverTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const intervalTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const validDiaryImages = React.useMemo(() => {
    return diaryImages.filter((img) => !failedUrls.has(img));
  }, [diaryImages, failedUrls]);

  const pickRandomImage = React.useCallback(() => {
    if (validDiaryImages.length === 0) {
      setActiveRandomImage(null);
      return;
    }
    setActiveRandomImage((prev) => {
      if (validDiaryImages.length === 1) return validDiaryImages[0];
      let next = validDiaryImages[Math.floor(Math.random() * validDiaryImages.length)];
      let attempts = 0;
      while (next === prev && attempts < 10) {
        next = validDiaryImages[Math.floor(Math.random() * validDiaryImages.length)];
        attempts++;
      }
      return next;
    });
  }, [validDiaryImages]);

  const handleMouseEnterCard = () => {
    if (isAdjusting) return;
    if (validDiaryImages.length === 0) return;

    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);

    const pref = sessionStorage.getItem("spoiler_warning_preference");
    if (pref === "declined") {
      return;
    }

    if (!pref) {
      // Exibe o alerta de spoiler após 3 segundos (3000ms) de mouseover
      hoverTimerRef.current = setTimeout(() => {
        if (!isAdjusting) {
          setShowSpoilerPrompt(true);
        }
      }, 3000);
      return;
    }

    // Inicia exibição do carrossel após breve hover de 200ms e alterna imagem a cada 3 segundos
    hoverTimerRef.current = setTimeout(() => {
      if (isAdjusting) return;
      pickRandomImage();

      intervalTimerRef.current = setInterval(() => {
        if (isAdjusting) {
          if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
          return;
        }
        pickRandomImage();
      }, 3000);
    }, 200);
  };

  const handleMouseLeaveCard = (e?: React.MouseEvent) => {
    if (e && e.relatedTarget && e.relatedTarget instanceof Node && (e.currentTarget as HTMLElement).contains(e.relatedTarget)) {
      return;
    }

    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (intervalTimerRef.current) {
      clearInterval(intervalTimerRef.current);
      intervalTimerRef.current = null;
    }
    if (!isAdjusting) {
      setActiveRandomImage(null);
    }
  };

  const coverContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setTempPosX(posX);
    setTempPosY(posY);
    setTempZoom(zoom);
  }, [posX, posY, zoom]);

  React.useEffect(() => {
    if (isAdjusting) {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      if (intervalTimerRef.current) {
        clearInterval(intervalTimerRef.current);
        intervalTimerRef.current = null;
      }
      setActiveRandomImage(null);
      setShowSpoilerPrompt(false);
    }
  }, [isAdjusting]);

  React.useEffect(() => {
    const el = coverContainerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (isAdjusting) {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY < 0 ? 5 : -5;
        setTempZoom((prev) => Math.max(100, Math.min(300, prev + delta)));
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, [isAdjusting]);

  const cardDragRef = React.useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    startPosX: 50,
    startPosY: 50,
  });

  const handleCardMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAdjusting) return;
    e.stopPropagation();
    e.preventDefault();
    cardDragRef.current.isDragging = true;
    cardDragRef.current.startX = e.clientX;
    cardDragRef.current.startY = e.clientY;
    cardDragRef.current.startPosX = tempPosX;
    cardDragRef.current.startPosY = tempPosY;
  };

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardDragRef.current.isDragging) return;
    e.stopPropagation();
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const containerWidth = rect.width || 200;
    const containerHeight = rect.height || 224;

    const deltaX = e.clientX - cardDragRef.current.startX;
    const deltaY = e.clientY - cardDragRef.current.startY;

    const deltaPctX = (deltaX / containerWidth) * 100;
    const deltaPctY = (deltaY / containerHeight) * 100;

    const zoomFactor = tempZoom / 100;
    const sensitivity = 0.8 / zoomFactor;
    const nextX = Math.max(0, Math.min(100, cardDragRef.current.startPosX - deltaPctX * sensitivity));
    const nextY = Math.max(0, Math.min(100, cardDragRef.current.startPosY - deltaPctY * sensitivity));

    setTempPosX(nextX);
    setTempPosY(nextY);
  };

  const handleCardMouseUpOrLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (cardDragRef.current.isDragging) {
      e.stopPropagation();
      e.preventDefault();
      cardDragRef.current.isDragging = false;
    }
  };

  const handleSavePosition = () => {
    if (!isAdmin) return;
    if (onUpdateGame) {
      onUpdateGame({
        ...game,
        coverPosition: tempPosY,
        coverPositionX: tempPosX,
        coverZoom: tempZoom,
      });
    }
    setIsAdjusting(false);
  };

  const activePosX = isAdjusting ? tempPosX : posX;
  const activePosY = isAdjusting ? tempPosY : posY;
  const activeZoom = isAdjusting ? tempZoom : zoom;

  const imageStyle: React.CSSProperties = {
    objectPosition: `${activePosX}% ${activePosY}%`,
    transformOrigin: `${activePosX}% ${activePosY}%`,
    transform: `scale(${Math.max(1, activeZoom / 100)})`,
    objectFit: "cover",
    transition: isAdjusting ? "none" : "transform 0.3s ease-out",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 12 }}
      transition={{
        duration: 0.28,
        ease: [0.25, 0.1, 0.25, 1]
      }}
      onMouseEnter={handleMouseEnterCard}
      onMouseLeave={handleMouseLeaveCard}
      onClick={(e) => {
        if (isAdjusting) {
          e.stopPropagation();
          return;
        }
        if (onClick) onClick(game.id);
      }}
      className={`game-card group cursor-pointer glass rounded-3xl transition-all duration-300 flex flex-col h-full relative z-10 hover:z-40 overflow-hidden ${getStatusBorderClass(game.status)}`}
    >
      <div 
        ref={coverContainerRef}
        onMouseDown={handleCardMouseDown}
        onMouseMove={handleCardMouseMove}
        onMouseUp={handleCardMouseUpOrLeave}
        onMouseLeave={handleCardMouseUpOrLeave}
        className={`relative rounded-t-3xl shrink-0 overflow-hidden ${isAdjusting ? "cursor-move border-2 border-dashed border-cyan-400" : ""}`}
        style={{ height: "clamp(10.5rem, 15vw, 14rem)" }}
      >
        <div className="w-full h-full rounded-t-3xl overflow-hidden group-hover:scale-[1.03] transition-transform duration-500 ease-out relative">
          <CachedImage
            src={coverImg}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-50 select-none pointer-events-none"
          />
          <CachedImage
            src={coverImg}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover origin-center select-none pointer-events-none relative z-10"
            style={imageStyle}
            alt={game.name}
            fallbackSrc="https://placehold.co/800x600/040406/ffffff?text=Sem+Capa"
          />

          {/* Random Diary Image Overlay (after hover) */}
          {activeRandomImage && !isAdjusting ? (
            <div 
              className="absolute inset-0 z-20 rounded-t-3xl overflow-hidden transition-all duration-300 animate-fadeIn bg-zinc-950/20 cursor-zoom-in group/diaryimg"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenZoom) {
                  onOpenZoom(activeRandomImage, validDiaryImages, `Diário - ${game.name}`);
                }
              }}
              title="Clique na imagem para expandir no Modo Teatro (tela cheia)"
            >
              <CachedImage
                src={activeRandomImage}
                alt="Diário de Jogatina"
                className="w-full h-full object-cover transition-all duration-500 group-hover/diaryimg:scale-105 cursor-zoom-in relative z-10"
                onError={() => {
                  const brokenUrl = activeRandomImage;
                  if (brokenUrl) {
                    setFailedUrls((prev) => new Set(prev).add(brokenUrl));
                  }
                  const remaining = validDiaryImages.filter((u) => u !== brokenUrl);
                  if (remaining.length > 0) {
                    setActiveRandomImage(remaining[Math.floor(Math.random() * remaining.length)]);
                  } else {
                    setActiveRandomImage(null);
                  }
                }}
              />
              
              {/* Unified Diary & Theater Pill Button */}
              <div 
                className="absolute bottom-3 left-3 z-30 px-2.5 py-1 rounded-xl bg-black/90 backdrop-blur-md text-[10px] font-extrabold text-cyan-300 border border-cyan-500/50 shadow-lg flex items-center gap-2 font-mono"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    pickRandomImage();
                  }}
                  className="hover:text-white transition-colors cursor-pointer"
                  title="Clique para alternar para a próxima imagem do diário"
                >
                  📸 Diário ({validDiaryImages.length})
                </button>
                <span className="text-zinc-600 font-normal">|</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenZoom && activeRandomImage) {
                      onOpenZoom(activeRandomImage, validDiaryImages, `Diário - ${game.name}`);
                    }
                  }}
                  className="flex items-center gap-1 text-cyan-400 font-sans font-bold hover:text-cyan-300 transition-colors cursor-pointer"
                  title="Ampliar imagem do diário no Modo Teatro"
                >
                  <Maximize2 size={11} className="shrink-0" />
                  <span>Teatro</span>
                </button>
              </div>
            </div>
          ) : validDiaryImages.length > 0 && !isAdjusting ? (
            <div 
              onClick={(e) => {
                e.stopPropagation();
                if (isAdjusting) return;
                const pref = sessionStorage.getItem("spoiler_warning_preference");
                if (pref === "declined") return;
                if (!pref) {
                  setShowSpoilerPrompt(true);
                  return;
                }
                pickRandomImage();
                if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
                intervalTimerRef.current = setInterval(() => {
                  if (isAdjusting) {
                    if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
                    return;
                  }
                  pickRandomImage();
                }, 3000);
              }}
              className="absolute bottom-3 left-3 z-20 px-2.5 py-1 rounded-xl bg-black/85 backdrop-blur-md text-[10px] font-extrabold text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5 shadow-lg opacity-90 hover:opacity-100 hover:scale-105 transition-all font-mono cursor-pointer"
              title="Fotos do diário disponíveis (passe o mouse ou clique para exibir)"
            >
              <span>📸 {validDiaryImages.length}</span>
            </div>
          ) : null}
        </div>
        <div className="absolute inset-0 rounded-t-3xl bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none z-15" />
        
        {/* Status badges container */}
        <div className="absolute top-3 left-3 flex flex-col gap-1 z-25">
          {game.isGaaS && (
            <div className="relative group/gaas">
              <div 
                className="h-6 px-1.5 flex items-center justify-center rounded-lg bg-gradient-to-r from-violet-950/90 via-fuchsia-950/90 to-pink-950/90 backdrop-blur-md text-pink-300 border border-pink-500/40 shadow-sm cursor-pointer hover:scale-105 transition-all duration-300 group-hover/gaas:px-2" 
                data-tooltip="Jogo como Serviço (GaaS) - Atividade e jogatina contínuas sem término estrito"
                data-tooltip-title="Game as a Service ♾️"
                data-tooltip-theme="pink"
              >
                <Infinity size={13} className="stroke-[2.5] text-pink-400 shrink-0" />
                <span className="max-w-0 opacity-0 group-hover/gaas:max-w-[50px] group-hover/gaas:opacity-100 group-hover/gaas:ml-1 text-[9px] font-extrabold uppercase font-mono tracking-wider transition-all duration-300 whitespace-nowrap overflow-hidden">
                  GaaS
                </span>
              </div>
            </div>
          )}
          {game.replayed && (
            <div className="relative group/replay">
              <div 
                className="h-6 px-1.5 flex items-center justify-center rounded-lg bg-violet-950/95 backdrop-blur-md text-purple-300 border border-purple-500/40 shadow-lg shadow-purple-950/50 cursor-pointer transition-all duration-300 group-hover/replay:px-2" 
                title={game.replayNote ? undefined : `Status: Replay (${game.replayCount || 1}x)`}
              >
                <RotateCcw size={11} className="stroke-[2.5] shrink-0" />
                <span className="max-w-0 opacity-0 group-hover/replay:max-w-[60px] group-hover/replay:opacity-100 group-hover/replay:ml-1 text-[9px] font-extrabold font-mono transition-all duration-300 whitespace-nowrap overflow-hidden">
                  {(game.replayCount && game.replayCount > 0) ? game.replayCount : 1}x
                </span>
              </div>
              {game.replayNote && (
                <div className="absolute top-full left-0 mt-1.5 hidden group-hover/replay:flex flex-col gap-1 min-w-[200px] max-w-xs p-2.5 rounded-xl bg-zinc-950/95 border border-purple-500/60 shadow-2xl z-50 text-left pointer-events-none backdrop-blur-md">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-purple-300 font-mono border-b border-zinc-800 pb-1">
                    Replay ({(game.replayCount && game.replayCount > 0) ? game.replayCount : 1}x)
                  </div>
                  <p className="text-xs text-zinc-200 font-medium leading-relaxed font-sans">
                    {game.replayNote}
                  </p>
                </div>
              )}
            </div>
          )}
          {getDlcMode(game) !== "none" && (
            <div className="relative group/dlc">
              <div 
                className="h-6 px-1.5 flex items-center justify-center rounded-lg bg-amber-950/95 backdrop-blur-md text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-950/50 cursor-pointer transition-all duration-300 group-hover/dlc:px-2" 
                title={game.dlcNames ? undefined : (getDlcMode(game) === "plus_dlc" ? "Status: Jogo Base + DLC" : "Status: Expansão / DLC")}
              >
                <Layers size={11} className="stroke-[2.5] shrink-0" />
                <span className="max-w-0 opacity-0 group-hover/dlc:max-w-[60px] group-hover/dlc:opacity-100 group-hover/dlc:ml-1 text-[9px] font-extrabold font-mono uppercase tracking-wider transition-all duration-300 whitespace-nowrap overflow-hidden">
                  {getDlcMode(game) === "plus_dlc" ? "+DLC" : "DLC"}
                </span>
              </div>
              {game.dlcNames && (
                <div className="absolute top-full left-0 mt-1.5 hidden group-hover/dlc:flex flex-col gap-1.5 min-w-[200px] max-w-xs p-2.5 rounded-xl bg-zinc-950/95 border border-amber-500/60 shadow-2xl z-50 text-left pointer-events-none backdrop-blur-md">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300 font-mono border-b border-zinc-800 pb-1">
                    DLCs / Expansões
                  </div>
                  <div className="flex flex-col gap-1">
                    {splitEntities(game.dlcNames).map((d, idx) => {
                      const parsed = parseContextNote(d);
                      return (
                        <div key={idx} className="text-xs text-zinc-200 font-medium">
                          • <strong className="text-amber-200">{parsed.main}</strong>
                          {parsed.note && <span className="text-zinc-400 block pl-3 text-[11px] italic">{parsed.note}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 z-25">
          <div className="flex flex-wrap gap-1 justify-end max-w-[100%]">
            {splitEntities(game.platform || "PC").map((p, pIdx) => {
              const parsed = parseContextNote(p);
              const style = getPlatformBadgeStyle(parsed.main);
              return (
                <div key={`${p}-${pIdx}`} className="relative group/plat inline-flex items-center">
                  <span 
                    className={`px-2 py-0.5 rounded-lg bg-zinc-950/90 backdrop-blur-md text-[9px] font-extrabold uppercase tracking-wider border shadow-sm cursor-help ${style.text} ${style.border} ${style.bg} ${style.glow}`}
                    title={parsed.note ? undefined : `Plataforma: ${parsed.main}`}
                  >
                    {parsed.main}
                  </span>
                  {parsed.note && (
                    <div className="absolute top-full right-0 mt-1.5 hidden group-hover/plat:flex flex-col gap-1 min-w-[180px] max-w-xs p-2.5 rounded-xl bg-zinc-950/95 border border-cyan-500/60 shadow-2xl z-50 text-left pointer-events-none backdrop-blur-md">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 font-mono border-b border-zinc-800 pb-1">
                        Plataforma: {parsed.main}
                      </div>
                      <p className="text-xs text-zinc-200 font-medium leading-relaxed font-sans">
                        {parsed.note}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {onOpenGameEstimateModal && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenGameEstimateModal(game);
              }}
              className="opacity-0 group-hover:opacity-100 transition-all duration-200 w-7 h-7 rounded-xl bg-amber-950/95 hover:bg-amber-900 text-amber-300 border border-amber-500/40 shadow-lg flex items-center justify-center cursor-pointer backdrop-blur-md hover:scale-110 active:scale-95"
              title="Calcular estimativa de tempo para terminar este jogo"
            >
              <Clock size={13} className="text-amber-400 shrink-0" />
            </button>
          )}
        </div>

        {!isAdjusting && (
          <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300">
            {onOpenZoom && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeRandomImage && validDiaryImages.includes(activeRandomImage)) {
                    onOpenZoom(activeRandomImage, validDiaryImages, `Diário - ${game.name}`);
                  } else {
                    onOpenZoom(coverImg, [coverImg, ...validDiaryImages], `Capa / Diário - ${game.name}`);
                  }
                }}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-950/80 hover:bg-cyan-500 hover:text-black text-cyan-400 border border-zinc-800/80 transition-all duration-300 shadow-lg cursor-pointer hover:scale-110 active:scale-95"
                title={activeRandomImage ? "Ampliar foto do diário em modo teatro" : "Ampliar capa/mídias em tela cheia"}
              >
                <Maximize2 size={13} />
              </button>
            )}

            {isAdmin && onEditGame && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditGame(game);
                }}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-950/80 hover:bg-cyan-500 hover:text-black text-cyan-400 border border-zinc-800/80 transition-all duration-300 shadow-lg cursor-pointer hover:scale-110 active:scale-95"
                title="Editar Ficha do Jogo"
              >
                <Settings size={13} />
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (hoverTimerRef.current) {
                    clearTimeout(hoverTimerRef.current);
                    hoverTimerRef.current = null;
                  }
                  if (intervalTimerRef.current) {
                    clearInterval(intervalTimerRef.current);
                    intervalTimerRef.current = null;
                  }
                  setActiveRandomImage(null);
                  setShowSpoilerPrompt(false);
                  setTempPosX(posX);
                  setTempPosY(posY);
                  setTempZoom(zoom);
                  setIsAdjusting(true);
                }}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-950/80 hover:bg-cyan-500 hover:text-black text-zinc-400 border border-zinc-800/80 font-extrabold text-xs tracking-widest transition-all duration-300 shadow-lg cursor-pointer hover:scale-110 active:scale-95"
                title="Ajustar Imagem de Capa"
              >
                ...
              </button>
            )}
          </div>
        )}

        {isAdjusting && (
          <div className="absolute inset-0 bg-black/60 pointer-events-none flex flex-col justify-between p-3 z-30">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1 bg-black/70 px-2 py-0.5 rounded-md border border-cyan-500/20">
                <Shield size={9} />
                Ajuste de Capa
              </span>
              <span className="text-[8px] text-zinc-300 font-mono bg-black/70 px-1.5 py-0.5 rounded-md">
                Z:{tempZoom}% | X:{Math.round(tempPosX)}% | Y:{Math.round(tempPosY)}%
              </span>
            </div>
            
            <div className="text-[9px] text-zinc-200 font-extrabold text-center uppercase tracking-wider bg-black/85 py-1 px-2 rounded-lg border border-zinc-800 self-center animate-pulse">
              Arraste para Mover • Scroll para Zoom
            </div>

            <div className="flex items-center gap-1.5 pointer-events-auto w-full">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAdjusting(false);
                }}
                className="flex-1 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer text-center hover:bg-zinc-900"
              >
                Cancelar
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setTempPosX(50);
                  setTempPosY(50);
                  setTempZoom(100);
                }}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer text-center hover:bg-zinc-700"
                title="Restaurar Padrão"
              >
                <RotateCcw size={10} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSavePosition();
                }}
                className="flex-1 py-1 rounded-lg bg-cyan-500 text-black hover:bg-cyan-400 text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer text-center"
              >
                Confirmar
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="p-5 flex flex-col flex-1 justify-between">
        <div>
          <div className="flex items-start gap-3">
            {renderIcon(game, "w-11 h-11 rounded-2xl shrink-0 mt-0.5 shadow-md border border-zinc-800")}
            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold text-white group-hover:text-cyan-300 transition-colors break-words leading-tight" style={{ fontSize: "clamp(0.875rem, 1.1vw, 1.125rem)" }}>
                <span className="align-middle">{game.name}</span>
                {getGameTrophyItems(game).length > 0 && (
                  <span className="inline-flex align-middle ml-2 shrink-0">
                    <TrophiesList trophies={getGameTrophyItems(game)} mode="card" />
                  </span>
                )}
              </h3>

            </div>
          </div>
          <div className="mt-3.5 flex flex-wrap gap-1 items-center">
            {(Array.isArray(game.status) ? game.status : typeof game.status === "string" ? [game.status] : []).map((s, idx) => (
              <span 
                key={`${s}-${idx}`} 
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${chipClass(s)} shadow-sm`}
                title={`Status do Jogo: ${s}`}
              >
                {s}
              </span>
            ))}

            {/* Integration Platform Badge (Steam vs GOG) */}
            {(game.integrationPlatform === "steam" || (!game.integrationPlatform && game.steamAppId)) && (
              <span 
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-blue-950/80 text-blue-300 border border-blue-500/40 shadow-sm shadow-blue-500/20"
                title={`Integrado com Steam API (App ID: ${game.steamAppId || 'Vinc.'})`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span>Steam</span>
                {game.steamAchievementsCount !== undefined && game.steamAchievementsTotal ? (
                  <span className="text-[9px] font-mono font-normal text-blue-200 opacity-90">({game.steamAchievementsCount}/{game.steamAchievementsTotal})</span>
                ) : null}
              </span>
            )}

            {(game.integrationPlatform === "gog" || (!game.integrationPlatform && game.gogGameId)) && (
              <span 
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-purple-950/80 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/20"
                title={`Integrado com GOG Galaxy API (Game ID: ${game.gogGameId || 'Vinc.'})`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                <span>GOG</span>
                {game.gogAchievementsCount !== undefined && game.gogAchievementsTotal ? (
                  <span className="text-[9px] font-mono font-normal text-purple-200 opacity-90">({game.gogAchievementsCount}/{game.gogAchievementsTotal})</span>
                ) : null}
              </span>
            )}
            {game.difficulty && splitEntities(game.difficulty).map((d, dIdx) => {
              const parsed = parseContextNote(d);
              return (
                <div key={`${d}-${dIdx}`} className="relative group/diff inline-flex items-center">
                  <span 
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-950/40 text-amber-300 border border-amber-500/20 shadow-sm cursor-help"
                    title={parsed.note ? undefined : `Dificuldade: ${parsed.main}`}
                  >
                    <Shield size={9} className="shrink-0 opacity-80" />
                    <span>{parsed.main}</span>
                  </span>
                  {parsed.note && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/diff:flex flex-col gap-1 min-w-[180px] max-w-xs p-2.5 rounded-xl bg-zinc-950/95 border border-amber-500/60 shadow-2xl z-50 text-left pointer-events-none backdrop-blur-md">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono border-b border-zinc-800 pb-1">
                        Dificuldade: {parsed.main}
                      </div>
                      <p className="text-xs text-zinc-200 font-medium leading-relaxed font-sans">
                        {parsed.note}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
            {[...game.genre].sort((a, b) => a.localeCompare(b, "pt", { sensitivity: "base" })).map((g, idx) => (
              <span 
                key={`${g}-${idx}`} 
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-purple-950/40 text-purple-300 border border-purple-500/20"
                title={`Gênero: ${g}`}
              >
                <Folder size={9} className="shrink-0 opacity-80" />
                <span>{g}</span>
              </span>
            ))}
          </div>
          {game.tags && game.tags.length > 0 && (
            <div className="mt-2.5 max-h-[48px] overflow-y-auto flex flex-wrap gap-1 pr-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              {[...game.tags].sort((a, b) => a.localeCompare(b, "pt", { sensitivity: "base" })).map((t, idx) => (
                <span
                  key={`${t}-${idx}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-zinc-950 text-cyan-400 border border-cyan-500/10 whitespace-nowrap"
                  title={`Marcador (Tag): ${t}`}
                >
                  <Tag size={8} className="shrink-0 opacity-70" />
                  <span>{t}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="mt-3.5 sm:mt-4 pt-2.5 sm:pt-3 border-t border-zinc-850">
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 2xl:gap-2.5 items-stretch">
            {(() => {
              const breakdown = getGameTimeBreakdown(game);
              const playParsed = parseContextNote(breakdown.playtimeRaw);
              const addParsed = parseContextNote(breakdown.additionalPlaytimeRaw);
              const hasCustomNote = !!(playParsed.note || addParsed.note);

              return (
                <div 
                  className="flex flex-col justify-center gap-1.5 bg-zinc-950/80 p-2 2xl:p-2.5 rounded-xl border border-zinc-800/60 min-w-0 relative group/playtime"
                  data-tooltip={`${breakdown.currentLabel} | ${breakdown.extraLabel} | ${breakdown.totalLabel}`}
                  data-tooltip-title="Resumo de Tempo de Jogo"
                  data-tooltip-theme="cyan"
                >
                  {/* Row 1: Main/Current/Campanha/Season Time */}
                  <div className="flex items-center justify-between gap-1 text-[11px] 2xl:text-xs text-purple-300 font-mono font-semibold">
                    <div 
                      className="flex items-center gap-1.5 cursor-help min-w-0 truncate" 
                      data-tooltip={playParsed.note ? `${breakdown.currentLabel}: ${breakdown.isGaaS || breakdown.isCurrentlyPlaying ? breakdown.currentTimeFormatted : breakdown.finalTimeFormatted} (${playParsed.note})` : `${breakdown.currentLabel}: ${breakdown.isGaaS || breakdown.isCurrentlyPlaying ? breakdown.currentTimeFormatted : breakdown.finalTimeFormatted}`}
                      data-tooltip-title={breakdown.currentLabel}
                      data-tooltip-theme="purple"
                    >
                      <Clock size={12} className="text-purple-400 shrink-0" />
                      <strong className="text-purple-200 truncate">
                        {breakdown.isGaaS || breakdown.isCurrentlyPlaying
                          ? breakdown.currentTimeFormatted
                          : breakdown.finalTimeFormatted}
                      </strong>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startLiveSessionForGame(game.id);
                      }}
                      className="p-1 rounded-md bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                      data-tooltip="Iniciar Cronômetro de Sessão ao Vivo para este jogo"
                      data-tooltip-title="Sessão ao Vivo"
                      data-tooltip-theme="cyan"
                    >
                      <Play size={9} className="fill-cyan-400" />
                    </button>
                  </div>

                  {/* Row 2: Extra Time / Account Time */}
                  <div 
                    className="flex items-center gap-1.5 text-[11px] 2xl:text-xs text-cyan-300 font-mono font-semibold cursor-help min-w-0 truncate" 
                    data-tooltip={addParsed.note ? `${breakdown.extraLabel}: ${breakdown.extraTimeFormatted} (${addParsed.note})` : `${breakdown.extraLabel}: ${breakdown.extraTimeFormatted}`}
                    data-tooltip-title={breakdown.extraLabel}
                    data-tooltip-theme="cyan"
                  >
                    <Clock size={12} className="text-cyan-400 shrink-0" />
                    <strong className="text-cyan-200 truncate">{breakdown.extraTimeFormatted}</strong>
                  </div>

                  {/* Row 3: Total Time */}
                  <div 
                    className="flex items-center gap-1.5 text-[11px] 2xl:text-xs text-emerald-300 font-mono font-bold cursor-help min-w-0 truncate" 
                    data-tooltip={`${breakdown.totalLabel}: Somatório do ${breakdown.currentLabel} (${breakdown.isGaaS || breakdown.isCurrentlyPlaying ? breakdown.currentTimeFormatted : breakdown.finalTimeFormatted}) + ${breakdown.extraLabel} (${breakdown.extraTimeFormatted})`}
                    data-tooltip-title={breakdown.totalLabel}
                    data-tooltip-theme="emerald"
                  >
                    <Clock size={12} className="text-emerald-400 shrink-0" />
                    <strong className="text-emerald-300 truncate">{breakdown.totalTimeFormatted}</strong>
                  </div>

                  {hasCustomNote && (
                    <div className="absolute bottom-full left-0 mb-2 hidden group-hover/playtime:flex flex-col gap-2 min-w-[220px] max-w-xs p-3 rounded-xl bg-zinc-950/95 border border-purple-500/60 shadow-2xl z-50 text-left pointer-events-none backdrop-blur-md">
                      {playParsed.note && (
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wider text-purple-300 font-mono border-b border-zinc-800 pb-0.5 mb-1">
                            {breakdown.isGaaS ? "Season/Atividade" : breakdown.isCurrentlyPlaying ? "Tempo Atual" : "Campanha Principal"}
                          </div>
                          <p className="text-xs text-zinc-200 font-medium leading-relaxed font-sans">{playParsed.note}</p>
                        </div>
                      )}
                      {addParsed.note && (
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wider text-cyan-300 font-mono border-b border-zinc-800 pb-0.5 mb-1">
                            {breakdown.isGaaS ? "Tempo da Conta" : "Tempo Extra (Replays)"}
                          </div>
                          <p className="text-xs text-zinc-200 font-medium leading-relaxed font-sans">{addParsed.note}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
            <div 
              className="rating-container flex flex-col justify-center gap-1.5 bg-zinc-950/80 p-2 2xl:p-2.5 rounded-xl border border-zinc-800/60 min-w-0 overflow-hidden"
              title="Avaliações e Notas do Jogo"
            >
              <div 
                className="flex items-center justify-between gap-1 w-full min-w-0"
                title={`Avaliação Pessoal: ${game.rating || 0} de 5 estrelas`}
              >
                <span className="shrink-0 text-[clamp(0.55rem,0.85vw,0.6875rem)] font-bold text-zinc-300 uppercase tracking-tight font-sans whitespace-nowrap flex items-center gap-0.5 sm:gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0"></span>
                  <span>Pessoal</span> <span className="text-zinc-400 font-mono text-[clamp(0.5rem,0.75vw,0.625rem)]">({game.rating || 0})</span>
                </span>
                <div className="flex items-center shrink-0 min-w-0 gap-0.5 flex-wrap justify-end">{renderStars(game.rating || 0, `${game.id}-top-personal`, "w-[clamp(9px,0.8vw,13px)] h-[clamp(9px,0.8vw,13px)]")}</div>
              </div>

              {game.metacriticCritScore !== undefined && game.metacriticCritScore !== null ? (
                <div 
                  className="flex items-center justify-between gap-1 w-full min-w-0"
                  title={`Nota da Crítica (Metacritic): ${game.metacriticCritScore} de 100`}
                >
                  <span className="shrink-0 text-[clamp(0.55rem,0.85vw,0.6875rem)] font-bold text-amber-400 uppercase tracking-tight font-sans whitespace-nowrap flex items-center gap-0.5 sm:gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                    <span>Crítica</span> <span className="font-mono text-[clamp(0.5rem,0.75vw,0.625rem)]">({game.metacriticCritScore})</span>
                  </span>
                  <div className="flex items-center shrink-0 min-w-0 gap-0.5 flex-wrap justify-end">{renderStars(Math.round((game.metacriticCritScore / 20) * 2) / 2, `${game.id}-top-crit`, "w-[clamp(9px,0.8vw,13px)] h-[clamp(9px,0.8vw,13px)]", "", game.metacriticCritScore >= 95)}</div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-1 w-full min-w-0 opacity-40" title="Nota da Crítica: N/A">
                  <span className="shrink-0 text-[clamp(0.55rem,0.85vw,0.6875rem)] font-medium text-zinc-500 uppercase tracking-tight font-sans whitespace-nowrap flex items-center gap-0.5 sm:gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0"></span>
                    <span>Crítica</span> <span className="font-mono text-[clamp(0.5rem,0.75vw,0.625rem)]">(N/A)</span>
                  </span>
                  <div className="flex items-center shrink-0 min-w-0 opacity-30 gap-0.5 flex-wrap justify-end">{renderStars(0, `${game.id}-top-crit-na`, "w-[clamp(9px,0.8vw,13px)] h-[clamp(9px,0.8vw,13px)]")}</div>
                </div>
              )}

              {game.metacriticUserScore !== undefined && game.metacriticUserScore !== null ? (
                <div 
                  className="flex items-center justify-between gap-1 w-full min-w-0"
                  title={`Nota do Público (Metacritic): ${game.metacriticUserScore.toFixed(1)} de 10`}
                >
                  <span className="shrink-0 text-[clamp(0.55rem,0.85vw,0.6875rem)] font-bold text-cyan-400 uppercase tracking-tight font-sans whitespace-nowrap flex items-center gap-0.5 sm:gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0"></span>
                    <span>Público</span> <span className="font-mono text-[clamp(0.5rem,0.75vw,0.625rem)]">({game.metacriticUserScore.toFixed(1)})</span>
                  </span>
                  <div className="flex items-center shrink-0 min-w-0 gap-0.5 flex-wrap justify-end">{renderStars(Math.round((game.metacriticUserScore / 2) * 2) / 2, `${game.id}-top-user`, "w-[clamp(9px,0.8vw,13px)] h-[clamp(9px,0.8vw,13px)]", "", game.metacriticUserScore >= 9.5)}</div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-1 w-full min-w-0 opacity-40" title="Nota do Público: N/A">
                  <span className="shrink-0 text-[clamp(0.55rem,0.85vw,0.6875rem)] font-medium text-zinc-500 uppercase tracking-tight font-sans whitespace-nowrap flex items-center gap-0.5 sm:gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0"></span>
                    <span>Público</span> <span className="font-mono text-[clamp(0.5rem,0.75vw,0.625rem)]">(N/A)</span>
                  </span>
                  <div className="flex items-center shrink-0 min-w-0 opacity-30 gap-0.5 flex-wrap justify-end">{renderStars(0, `${game.id}-top-user-na`, "w-[clamp(9px,0.8vw,13px)] h-[clamp(9px,0.8vw,13px)]")}</div>
                </div>
              )}
            </div>
          </div>

          {(game.hltbMain || game.hltbExtra || game.hltbCompletionist) && (
            <div className="mt-3 pt-2.5 border-t border-zinc-800/80">
              <div className="text-xs uppercase tracking-wider text-zinc-400 font-extrabold text-center mb-1.5 font-mono">
                HowLongToBeat
              </div>
              <div className="grid grid-cols-3 gap-1 text-center bg-zinc-950/60 rounded-xl p-1.5 border border-zinc-800/60 min-w-0 overflow-hidden shadow-inner">
                <div 
                  className="min-w-0"
                  title={`Tempo estimado para a Campanha Principal (HowLongToBeat): ${formatHltbTime(game.hltbMain) || "Não especificado"}`}
                >
                  <span className="block text-[10px] text-zinc-400 uppercase tracking-wider font-bold truncate">Campanha</span>
                  <span className="text-xs sm:text-sm font-black text-purple-300 font-mono leading-none truncate block py-0.5">{formatHltbTime(game.hltbMain) || "-"}</span>
                </div>
                <div 
                  className="min-w-0"
                  title={`Tempo estimado para Campanha + Extras (HowLongToBeat): ${formatHltbTime(game.hltbExtra) || "Não especificado"}`}
                >
                  <span className="block text-[10px] text-zinc-400 uppercase tracking-wider font-bold truncate">História+Ext</span>
                  <span className="text-xs sm:text-sm font-black text-cyan-300 font-mono leading-none truncate block py-0.5">{formatHltbTime(game.hltbExtra) || "-"}</span>
                </div>
                <div 
                  className="min-w-0"
                  title={`Tempo estimado para 100% de conclusão (HowLongToBeat): ${formatHltbTime(game.hltbCompletionist) || "Não especificado"}`}
                >
                  <span className="block text-[10px] text-zinc-400 uppercase tracking-wider font-bold truncate">100%</span>
                  <span className="text-xs sm:text-sm font-black text-pink-300 font-mono leading-none truncate block py-0.5">{formatHltbTime(game.hltbCompletionist) || "-"}</span>
                </div>
              </div>
            </div>
          )}

          {/* Steam Badge & Mini Achievements Bar */}
          {(game.integrationPlatform === "steam" || (!game.integrationPlatform && game.steamAppId) || (game.steamPlaytimeMinutes && game.steamPlaytimeMinutes > 0)) && (game.steamAppId || (game.steamPlaytimeMinutes && game.steamPlaytimeMinutes > 0)) && (
            <div className="mt-2.5 pt-2 border-t border-zinc-800/80">
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-blue-950/40 border border-blue-500/30 rounded-xl shadow-inner">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Gamepad2 size={13} className="text-blue-400 shrink-0" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-300 font-mono truncate">
                    Steam: {game.steamPlaytimeMinutes ? formatSteamPlaytime(game.steamPlaytimeMinutes) : "Vinculado"}
                  </span>
                </div>

                {game.steamAchievementsCount !== undefined && game.steamAchievementsTotal !== undefined && game.steamAchievementsTotal > 0 ? (
                  <div className="flex items-center gap-1.5 shrink-0" title={`Conquistas Steam: ${game.steamAchievementsCount}/${game.steamAchievementsTotal}`}>
                    {game.steamAchievementsCount === game.steamAchievementsTotal ? (
                      <span className="text-[10px] font-mono font-extrabold text-amber-300 bg-gradient-to-r from-amber-500/30 to-yellow-400/30 border border-amber-400/60 px-1.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse shadow-sm">
                        <Sparkles size={10} className="text-yellow-300" />
                        <span>👑 100% Achiev.</span>
                      </span>
                    ) : (
                      <>
                        <Trophy size={11} className="text-amber-400 shrink-0" />
                        <span className="text-[10px] font-mono font-bold text-amber-300">
                          {Math.round((game.steamAchievementsCount / game.steamAchievementsTotal) * 100)}%
                        </span>
                        <div className="w-10 h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-yellow-400"
                            style={{ width: `${Math.round((game.steamAchievementsCount / game.steamAchievementsTotal) * 100)}%` }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* GOG Badge & Mini Achievements Bar */}
          {(game.integrationPlatform === "gog" || (!game.integrationPlatform && game.gogGameId) || (game.gogPlaytimeMinutes && game.gogPlaytimeMinutes > 0)) && (game.gogGameId || (game.gogPlaytimeMinutes && game.gogPlaytimeMinutes > 0)) && (
            <div className="mt-2.5 pt-2 border-t border-zinc-800/80">
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-purple-950/40 border border-purple-500/30 rounded-xl shadow-inner">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Gamepad2 size={13} className="text-purple-400 shrink-0" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-300 font-mono truncate">
                    GOG: {game.gogPlaytimeMinutes ? formatGogPlaytime(game.gogPlaytimeMinutes) : "Vinculado"}
                  </span>
                </div>

                {game.gogAchievementsCount !== undefined && game.gogAchievementsTotal !== undefined && game.gogAchievementsTotal > 0 ? (
                  <div className="flex items-center gap-1.5 shrink-0" title={`Conquistas GOG: ${game.gogAchievementsCount}/${game.gogAchievementsTotal}`}>
                    {game.gogAchievementsCount === game.gogAchievementsTotal ? (
                      <span className="text-[10px] font-mono font-extrabold text-fuchsia-300 bg-gradient-to-r from-purple-500/30 to-fuchsia-400/30 border border-purple-400/60 px-1.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse shadow-sm">
                        <Sparkles size={10} className="text-fuchsia-300" />
                        <span>👑 100% Achiev.</span>
                      </span>
                    ) : (
                      <>
                        <Trophy size={11} className="text-purple-400 shrink-0" />
                        <span className="text-[10px] font-mono font-bold text-purple-300">
                          {Math.round((game.gogAchievementsCount / game.gogAchievementsTotal) * 100)}%
                        </span>
                        <div className="w-10 h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-400"
                            style={{ width: `${Math.round((game.gogAchievementsCount / game.gogAchievementsTotal) * 100)}%` }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hover Extra Info Drawer - Slides up smoothly from bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none transform translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-300 ease-out bg-gradient-to-t from-zinc-950 via-zinc-950/98 to-zinc-900/95 border-t-2 border-cyan-500/50 p-3.5 shadow-2xl rounded-b-3xl">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-1.5 mb-2">
          <div className="flex items-center gap-1.5 text-cyan-300 font-mono text-[10px] font-extrabold uppercase tracking-wider">
            <Sparkles size={11} className="text-cyan-400 animate-pulse shrink-0" />
            <span>Informações Adicionais</span>
          </div>
          <span className="text-[9px] text-zinc-400 font-mono font-medium">Card Hover</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Série / Saga */}
          <div className="flex flex-col gap-0.5 bg-zinc-900/90 p-2 rounded-xl border border-purple-500/20 min-w-0">
            <span className="text-[9px] font-bold text-purple-400 uppercase tracking-wider font-mono flex items-center gap-1 truncate">
              <Layers size={9} className="shrink-0" />
              Série
            </span>
            <span className="text-zinc-200 font-semibold text-[11px] truncate" title={game.series || "Série Autónoma"}>
              {game.series || "Série Autónoma"}
            </span>
          </div>

          {/* Data de Início */}
          <div className="flex flex-col gap-0.5 bg-zinc-900/90 p-2 rounded-xl border border-cyan-500/20 min-w-0">
            <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider font-mono flex items-center gap-1 truncate">
              <Calendar size={9} className="shrink-0" />
              Início
            </span>
            <span className="text-zinc-200 font-semibold text-[11px] truncate font-mono">
              {formatDateDisplay(game.startDate) || "Não informada"}
            </span>
          </div>

          {/* Desenvolvedor / Publisher / Estúdio */}
          <div className="flex flex-col gap-0.5 bg-zinc-900/90 p-2 rounded-xl border border-amber-500/20 min-w-0">
            <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider font-mono flex items-center gap-1 truncate">
              <Building2 size={9} className="shrink-0" />
              Desenvolvedora
            </span>
            <span className="text-zinc-200 font-semibold text-[11px] truncate" title={game.developer || game.publisher || game.studio || "Não especificado"}>
              {game.developer || game.publisher || game.studio || "Não especificado"}
            </span>
          </div>

          {/* Diário de Jogatina */}
          <div className="flex flex-col gap-0.5 bg-zinc-900/90 p-2 rounded-xl border border-emerald-500/20 min-w-0">
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider font-mono flex items-center gap-1 truncate">
              <BookOpen size={9} className="shrink-0" />
              Diário
            </span>
            <span className="text-zinc-200 font-semibold text-[11px] truncate font-mono">
              {game.diary && game.diary.length > 0 ? `${game.diary.length} entrada(s)` : "Sem registros"}
            </span>
          </div>
        </div>
      </div>

      {/* Spoiler Warning Modal */}
      {showSpoilerPrompt && (
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn" 
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-zinc-900 border border-amber-500/50 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-2.5 rounded-xl bg-amber-950/80 border border-amber-500/40 shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">Aviso de Spoilers 📸</h3>
                <p className="text-xs text-amber-200/80 font-medium">Imagens do Diário de Jogatina</p>
              </div>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Cuidado! As imagens salvas nos diários de jogatina podem conter spoilers da história.
              <br /><br />
              Deseja permitir a exibição de imagens aleatórias do diário ao passar o mouse sobre as capas dos jogos nesta sessão?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  sessionStorage.setItem("spoiler_warning_preference", "declined");
                  setShowSpoilerPrompt(false);
                }}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition-all cursor-pointer"
              >
                Não, Ocultar
              </button>
              <button
                type="button"
                onClick={() => {
                  sessionStorage.setItem("spoiler_warning_preference", "accepted");
                  setShowSpoilerPrompt(false);
                  if (diaryImages.length > 0) {
                    pickRandomImage();
                    if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
                    intervalTimerRef.current = setInterval(() => {
                      pickRandomImage();
                    }, 3000);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black text-xs transition-all shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer"
              >
                Sim, Permitir Exibição
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

const GameCard = memo(GameCardComponent);
export default GameCard;
