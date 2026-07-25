/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { memo } from "react";
import { Game, splitEntities, getDlcMode, getGameTrophies, getGameTrophyItems, parseContextNote } from "../types";
import { motion } from "motion/react";
import { Clock, Folder, Tag, Layers, RotateCcw, Shield, Maximize2, Settings } from "lucide-react";
import { formatHltbTime } from "../utils/hltbFormatter";
import TrophyBadge, { TrophiesList } from "./TrophyBadge";
import { formatHoursAndMinutes, getTotalGamePlaytimeHours } from "./DashboardView";

export interface GameCardProps {
  game: Game;
  onClick: () => void;
  isAdmin?: boolean;
  onUpdateGame?: (updatedGame: Game) => void;
  onOpenZoom?: (src: string) => void;
  onOpenGameEstimateModal?: (game: Game) => void;
  onEditGame?: (game: Game) => void;
  key?: string | number;
}

export function chipClass(status: string) {
  if (status === "Jogando") return "chip-green";
  if (status === "Em Hiatus") return "chip-orange";
  if (status === "Terminado") return "chip-blue";
  if (status === "Desistido") return "chip-red";
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

export function getStatusBorderClass(statusList: string[]) {
  if (!statusList || !statusList.length) return "!border-zinc-700/60 hover:!border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.05)] hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]";
  const status = statusList[0];
  if (status === "Jogando") return "!border-emerald-500/60 hover:!border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.12)] hover:shadow-[0_0_25px_rgba(16,185,129,0.25)]";
  if (status === "Em Hiatus") return "!border-amber-500/60 hover:!border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.12)] hover:shadow-[0_0_25px_rgba(245,158,11,0.25)]";
  if (status === "Terminado") return "!border-sky-500/60 hover:!border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.12)] hover:shadow-[0_0_25px_rgba(56,189,248,0.25)]";
  if (status === "Desistido") return "!border-rose-500/60 hover:!border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.12)] hover:shadow-[0_0_25px_rgba(244,63,94,0.25)]";
  if (status === "Backlog") return "!border-purple-500/60 hover:!border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.12)] hover:shadow-[0_0_25px_rgba(168,85,247,0.25)]";
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

  const coverContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setTempPosX(posX);
    setTempPosY(posY);
    setTempZoom(zoom);
  }, [posX, posY, zoom]);

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
      layout
      onClick={(e) => {
        if (isAdjusting) {
          e.stopPropagation();
          return;
        }
        onClick();
      }}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25 }}
      className={`group cursor-pointer glass rounded-3xl transition-all duration-300 flex flex-col h-full relative z-10 hover:z-40 ${getStatusBorderClass(game.status)}`}
    >
      <div 
        ref={coverContainerRef}
        onMouseDown={handleCardMouseDown}
        onMouseMove={handleCardMouseMove}
        onMouseUp={handleCardMouseUpOrLeave}
        onMouseLeave={handleCardMouseUpOrLeave}
        className={`relative h-56 rounded-t-3xl shrink-0 ${isAdjusting ? "cursor-move border-2 border-dashed border-cyan-400" : ""}`}
      >
        <div className="w-full h-full rounded-t-3xl overflow-hidden group-hover:scale-[1.03] transition-transform duration-500 ease-out relative">
          <img
            src={coverImg}
            alt=""
            className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-50 select-none pointer-events-none"
          />
          <img
            src={coverImg}
            className="w-full h-full object-cover origin-center select-none pointer-events-none relative z-10"
            style={imageStyle}
            alt={game.name}
            referrerPolicy="no-referrer"
            onError={(e: any) => {
              (e.target as HTMLImageElement).src = "https://placehold.co/800x600/040406/ffffff?text=Sem+Capa";
            }}
          />
        </div>
        <div className="absolute inset-0 rounded-t-3xl bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
        
        {/* Status badges container */}
        <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-20">
          {game.replayed && (
            <div className="relative group/replay">
              <div 
                className="flex items-center gap-1 px-2 py-1 rounded-xl bg-violet-950/95 backdrop-blur-md text-purple-300 border border-purple-500/40 shadow-lg shadow-purple-950/50 cursor-pointer" 
                title={game.replayNote ? undefined : `Status: Replay (${game.replayCount || 1}x)`}
              >
                <RotateCcw size={12} className="stroke-[2.5]" />
                <span className="text-[10px] font-extrabold font-mono">{(game.replayCount && game.replayCount > 0) ? game.replayCount : 1}x</span>
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
                className="flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-950/95 backdrop-blur-md text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-950/50 cursor-pointer" 
                title={game.dlcNames ? undefined : (getDlcMode(game) === "plus_dlc" ? "Status: Jogo Base + DLC" : "Status: Expansão / DLC")}
              >
                <Layers size={12} className="stroke-[2.5]" />
                <span className="text-[10px] font-extrabold font-mono uppercase tracking-wider">
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
        <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5 z-25">
          <div className="flex flex-wrap gap-1 justify-end max-w-[100%]">
            {splitEntities(game.platform || "PC").map((p, pIdx) => {
              const parsed = parseContextNote(p);
              const style = getPlatformBadgeStyle(parsed.main);
              return (
                <div key={`${p}-${pIdx}`} className="relative group/plat inline-flex items-center">
                  <span 
                    className={`px-2.5 py-1 rounded-xl bg-zinc-950/90 backdrop-blur-md text-[10px] font-extrabold uppercase tracking-widest border shadow-sm cursor-help ${style.text} ${style.border} ${style.bg} ${style.glow}`}
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
                  onOpenZoom(coverImg);
                }}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-950/80 hover:bg-cyan-500 hover:text-black text-cyan-400 border border-zinc-800/80 transition-all duration-300 shadow-lg cursor-pointer hover:scale-110 active:scale-95"
                title="Ampliar capa em tela cheia"
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
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[0.5px] pointer-events-none flex flex-col justify-between p-3 z-30">
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
              <h3 className="text-base sm:text-lg font-extrabold text-white group-hover:text-cyan-300 transition-colors break-words leading-tight">
                <span className="align-middle">{game.name}</span>
                {getGameTrophyItems(game).length > 0 && (
                  <span className="inline-flex align-middle ml-2 shrink-0">
                    <TrophiesList trophies={getGameTrophyItems(game)} mode="card" />
                  </span>
                )}
              </h3>
              <div 
                className="flex flex-wrap items-center gap-1 mt-1 text-xs uppercase tracking-wider text-purple-400 font-bold"
                title={`Série / Saga: ${game.series || "Série Autónoma"}`}
              >
                <Layers size={10} className="shrink-0 opacity-80" />
                {game.series ? (
                  splitEntities(game.series).map((s, sIdx) => (
                    <span key={`${s}-${sIdx}`} className="truncate bg-purple-950/10 px-1.5 py-0.5 rounded border border-purple-900/15 text-[10px]">{s}</span>
                  ))
                ) : (
                  <span className="truncate">Série Autónoma</span>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5 items-center">
            {game.status.map((s, idx) => (
              <span 
                key={`${s}-${idx}`} 
                className={`px-2.5 py-1 rounded-xl text-xs font-bold uppercase tracking-wider ${chipClass(s)} shadow-sm`}
                title={`Status do Jogo: ${s}`}
              >
                {s}
              </span>
            ))}
            {game.difficulty && splitEntities(game.difficulty).map((d, dIdx) => {
              const parsed = parseContextNote(d);
              return (
                <div key={`${d}-${dIdx}`} className="relative group/diff inline-flex items-center">
                  <span 
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold uppercase tracking-wider bg-amber-950/40 text-amber-300 border border-amber-500/20 shadow-sm cursor-help"
                    title={parsed.note ? undefined : `Dificuldade: ${parsed.main}`}
                  >
                    <Shield size={10} className="shrink-0 opacity-80" />
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
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-purple-950/40 text-purple-300 border border-purple-500/20"
                title={`Gênero: ${g}`}
              >
                <Folder size={10} className="shrink-0 opacity-80" />
                <span>{g}</span>
              </span>
            ))}
          </div>
          {game.tags && game.tags.length > 0 && (
            <div className="mt-3 max-h-[52px] overflow-y-auto flex flex-wrap gap-1.5 pr-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              {[...game.tags].sort((a, b) => a.localeCompare(b, "pt", { sensitivity: "base" })).map((t, idx) => (
                <span
                  key={`${t}-${idx}`}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-xs font-medium bg-zinc-950 text-cyan-400 border border-cyan-500/10 whitespace-nowrap"
                  title={`Marcador (Tag): ${t}`}
                >
                  <Tag size={8} className="shrink-0 opacity-70" />
                  <span>{t}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-zinc-850">
          <div className="flex items-stretch justify-between gap-2.5">
            {(() => {
              const playParsed = parseContextNote(game.playtime || "0h");
              const addParsed = parseContextNote(game.additionalPlaytime || "0h");
              const hasCustomNote = !!(playParsed.note || addParsed.note);
              return (
                <div 
                  className="flex flex-col justify-center gap-1.5 bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800/60 shrink-0 relative group/playtime"
                  title={hasCustomNote ? undefined : "Tempo Pessoal: Jogatina Atual/Última, Jogatinas Passadas e Tempo Total"}
                >
                  <div className="flex items-center gap-1.5 text-xs text-purple-300 font-mono font-semibold cursor-help" title={playParsed.note ? undefined : `Jogatina Atual: ${playParsed.main}`}>
                    <Clock size={12} className="text-purple-400 shrink-0" />
                    <span>{playParsed.main}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-cyan-300 font-mono font-semibold cursor-help" title={addParsed.note ? undefined : `Jogatinas Passadas: ${addParsed.main}`}>
                    <Clock size={12} className="text-cyan-400 shrink-0" />
                    <span>{addParsed.main}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-mono font-bold" title={`Tempo Total Investido: ${formatHoursAndMinutes(getTotalGamePlaytimeHours(game))}`}>
                    <Clock size={12} className="text-emerald-400 shrink-0" />
                    <span>{formatHoursAndMinutes(getTotalGamePlaytimeHours(game))}</span>
                  </div>

                  {hasCustomNote && (
                    <div className="absolute bottom-full left-0 mb-2 hidden group-hover/playtime:flex flex-col gap-2 min-w-[220px] max-w-xs p-3 rounded-xl bg-zinc-950/95 border border-purple-500/60 shadow-2xl z-50 text-left pointer-events-none backdrop-blur-md">
                      {playParsed.note && (
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wider text-purple-300 font-mono border-b border-zinc-800 pb-0.5 mb-1">
                            Jogatina Atual: {playParsed.main}
                          </div>
                          <p className="text-xs text-zinc-200 font-medium leading-relaxed font-sans">{playParsed.note}</p>
                        </div>
                      )}
                      {addParsed.note && (
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wider text-cyan-300 font-mono border-b border-zinc-800 pb-0.5 mb-1">
                            Jogatinas Passadas: {addParsed.main}
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
              className="flex flex-col justify-center gap-1.5 bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800/60 shrink-0 ml-auto min-w-0 overflow-hidden"
              title="Avaliações e Notas do Jogo"
            >
              <div 
                className="flex items-center justify-start gap-2.5 w-full min-w-0"
                title={`Avaliação Pessoal: ${game.rating || 0} de 5 estrelas`}
              >
                <span className="w-[86px] sm:w-[90px] shrink-0 text-[10px] sm:text-[11px] font-bold text-zinc-300 uppercase tracking-tight font-sans whitespace-nowrap flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0"></span>
                  <span>Pessoal</span> <span className="text-zinc-400 font-mono text-[10px]">({game.rating || 0})</span>
                </span>
                <div className="flex items-center shrink-0">{renderStars(game.rating || 0, `${game.id}-top-personal`, "w-3 h-3 sm:w-3.5 sm:h-3.5")}</div>
              </div>

              {game.metacriticCritScore !== undefined && game.metacriticCritScore !== null ? (
                <div 
                  className="flex items-center justify-start gap-2.5 w-full min-w-0"
                  title={`Nota da Crítica (Metacritic): ${game.metacriticCritScore} de 100`}
                >
                  <span className="w-[86px] sm:w-[90px] shrink-0 text-[10px] sm:text-[11px] font-bold text-amber-400 uppercase tracking-tight font-sans whitespace-nowrap flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                    <span>Crítica</span> <span className="font-mono text-[10px]">({game.metacriticCritScore})</span>
                  </span>
                  <div className="flex items-center shrink-0">{renderStars(Math.round((game.metacriticCritScore / 20) * 2) / 2, `${game.id}-top-crit`, "w-3 h-3 sm:w-3.5 sm:h-3.5", "", game.metacriticCritScore >= 95)}</div>
                </div>
              ) : (
                <div className="flex items-center justify-start gap-2.5 w-full min-w-0 opacity-40" title="Nota da Crítica: N/A">
                  <span className="w-[86px] sm:w-[90px] shrink-0 text-[10px] sm:text-[11px] font-medium text-zinc-500 uppercase tracking-tight font-sans whitespace-nowrap flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0"></span>
                    <span>Crítica</span> <span className="font-mono text-[10px]">(N/A)</span>
                  </span>
                  <div className="flex items-center shrink-0 opacity-30">{renderStars(0, `${game.id}-top-crit-na`, "w-3 h-3 sm:w-3.5 sm:h-3.5")}</div>
                </div>
              )}

              {game.metacriticUserScore !== undefined && game.metacriticUserScore !== null ? (
                <div 
                  className="flex items-center justify-start gap-2.5 w-full min-w-0"
                  title={`Nota do Público (Metacritic): ${game.metacriticUserScore.toFixed(1)} de 10`}
                >
                  <span className="w-[86px] sm:w-[90px] shrink-0 text-[10px] sm:text-[11px] font-bold text-cyan-400 uppercase tracking-tight font-sans whitespace-nowrap flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0"></span>
                    <span>Público</span> <span className="font-mono text-[10px]">({game.metacriticUserScore.toFixed(1)})</span>
                  </span>
                  <div className="flex items-center shrink-0">{renderStars(Math.round((game.metacriticUserScore / 2) * 2) / 2, `${game.id}-top-user`, "w-3 h-3 sm:w-3.5 sm:h-3.5", "", game.metacriticUserScore >= 9.5)}</div>
                </div>
              ) : (
                <div className="flex items-center justify-start gap-2.5 w-full min-w-0 opacity-40" title="Nota do Público: N/A">
                  <span className="w-[86px] sm:w-[90px] shrink-0 text-[10px] sm:text-[11px] font-medium text-zinc-500 uppercase tracking-tight font-sans whitespace-nowrap flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0"></span>
                    <span>Público</span> <span className="font-mono text-[10px]">(N/A)</span>
                  </span>
                  <div className="flex items-center shrink-0 opacity-30">{renderStars(0, `${game.id}-top-user-na`, "w-3 h-3 sm:w-3.5 sm:h-3.5")}</div>
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
        </div>
      </div>
    </motion.div>
  );
}

const GameCard = memo(GameCardComponent);
export default GameCard;
