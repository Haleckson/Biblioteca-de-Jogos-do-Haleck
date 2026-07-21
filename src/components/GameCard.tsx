/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { memo } from "react";
import { Game, splitEntities } from "../types";
import { motion } from "motion/react";
import { Clock, Folder, Tag, Layers, RotateCcw, Shield } from "lucide-react";
import { formatHltbTime } from "../utils/hltbFormatter";

export interface GameCardProps {
  game: Game;
  onClick: () => void;
  isAdmin?: boolean;
  onUpdateGame?: (updatedGame: Game) => void;
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
          className={`${size} fill-current`} 
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
          className={`${size} fill-current`} 
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
        <svg key={i} className={`${size} text-zinc-800 fill-current`} viewBox="0 0 24 24">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      );
    }
  }
  return <div className="flex items-center gap-0.5">{stars}</div>;
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

function GameCardComponent({ game, onClick, isAdmin, onUpdateGame }: GameCardProps) {
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
    transform: `scale(${activeZoom / 100})`,
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
      className={`group cursor-pointer glass rounded-3xl overflow-hidden transition-all duration-300 flex flex-col h-full relative ${getStatusBorderClass(game.status)}`}
    >
      <div 
        ref={coverContainerRef}
        onMouseDown={handleCardMouseDown}
        onMouseMove={handleCardMouseMove}
        onMouseUp={handleCardMouseUpOrLeave}
        onMouseLeave={handleCardMouseUpOrLeave}
        className={`relative h-56 overflow-hidden shrink-0 ${isAdjusting ? "cursor-move border-2 border-dashed border-cyan-400" : ""}`}
      >
        <div className="w-full h-full overflow-hidden group-hover:scale-[1.03] transition-transform duration-500 ease-out">
          <img
            src={coverImg}
            className="w-full h-full object-cover origin-center select-none pointer-events-none"
            style={imageStyle}
            alt={game.name}
            referrerPolicy="no-referrer"
            onError={(e: any) => {
              (e.target as HTMLImageElement).src = "https://placehold.co/800x600/040406/ffffff?text=Sem+Capa";
            }}
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
        {game.replayed && (
          <div 
            className="absolute top-4 left-4 flex items-center gap-1 px-2 py-1 rounded-xl bg-violet-950/95 backdrop-blur-md text-purple-300 border border-purple-500/40 shadow-lg shadow-purple-950/50" 
            title={`Status: Replay (${game.replayCount || 1}x)`}
          >
            <RotateCcw size={12} className="stroke-[2.5]" />
            <span className="text-[10px] font-extrabold font-mono">{(game.replayCount && game.replayCount > 0) ? game.replayCount : 1}x</span>
          </div>
        )}
        <div className="absolute top-4 right-4 flex flex-wrap gap-1 justify-end max-w-[70%] z-25">
          {splitEntities(game.platform || "PC").map((p, pIdx) => {
            const style = getPlatformBadgeStyle(p);
            return (
              <span 
                key={`${p}-${pIdx}`}
                className={`px-2.5 py-1 rounded-xl bg-zinc-950/90 backdrop-blur-md text-[10px] font-extrabold uppercase tracking-widest border shadow-sm ${style.text} ${style.border} ${style.bg} ${style.glow}`}
                title={`Plataforma: ${p}`}
              >
                {p}
              </span>
            );
          })}
        </div>

        {isAdmin && !isAdjusting && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTempPosX(posX);
              setTempPosY(posY);
              setTempZoom(zoom);
              setIsAdjusting(true);
            }}
            className="absolute bottom-3 right-3 z-20 w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-950/80 hover:bg-cyan-500 hover:text-black text-zinc-400 border border-zinc-800/80 font-extrabold text-xs tracking-widest transition-all duration-300 shadow-lg cursor-pointer animate-fade-in"
            title="Ajustar Imagem"
          >
            ...
          </button>
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
                {game.name}
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
            {game.difficulty && splitEntities(game.difficulty).map((d, dIdx) => (
              <span 
                key={`${d}-${dIdx}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold uppercase tracking-wider bg-amber-950/40 text-amber-300 border border-amber-500/20 shadow-sm"
                title={`Dificuldade: ${d}`}
              >
                <Shield size={10} className="shrink-0 opacity-80" />
                <span>{d}</span>
              </span>
            ))}
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
          <div className="flex items-start justify-between gap-3">
            <div 
              className="flex items-center gap-1.5 text-xs text-zinc-300 font-semibold bg-zinc-950/60 px-2.5 py-1.5 rounded-xl border border-zinc-800/50 mt-1 shrink-0"
              title={`Tempo de Jogo Registrado: ${game.playtime || "00h 00m"}`}
            >
              <Clock size={12} className="text-cyan-400" />
              <span className="font-mono">{game.playtime || "00h 00m"}</span>
            </div>
            <div className="flex flex-col items-end gap-1 flex-1 min-w-0">
              <div 
                className="flex items-center gap-1.5 justify-end w-full"
                title={`Avaliação Pessoal: ${game.rating || 0} de 5 estrelas`}
              >
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider font-sans whitespace-nowrap flex items-center gap-0.5">
                  Pessoal <span className="text-zinc-300 font-mono text-[8px]">({game.rating || 0})</span>:
                </span>
                <div className="shrink-0">{renderStars(game.rating || 0, `${game.id}-top-personal`)}</div>
              </div>
              {game.metacriticCritScore !== undefined && game.metacriticCritScore !== null && (
                <div 
                  className="flex items-center gap-1.5 justify-end w-full"
                  title={`Nota da Crítica (Metacritic): ${game.metacriticCritScore} de 100`}
                >
                  <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider font-sans whitespace-nowrap flex items-center gap-0.5">
                    Crítica <span className="font-mono text-[8px]">({game.metacriticCritScore})</span>:
                  </span>
                  <div className="shrink-0">{renderStars(Math.round((game.metacriticCritScore / 20) * 2) / 2, `${game.id}-top-crit`, "w-3.5 h-3.5", "", game.metacriticCritScore >= 95)}</div>
                </div>
              )}
              {game.metacriticUserScore !== undefined && game.metacriticUserScore !== null && (
                <div 
                  className="flex items-center gap-1.5 justify-end w-full"
                  title={`Nota do Público (Metacritic): ${game.metacriticUserScore.toFixed(1)} de 10`}
                >
                  <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider font-sans whitespace-nowrap flex items-center gap-0.5">
                    Público <span className="font-mono text-[8px]">({game.metacriticUserScore.toFixed(1)})</span>:
                  </span>
                  <div className="shrink-0">{renderStars(Math.round((game.metacriticUserScore / 2) * 2) / 2, `${game.id}-top-user`, "w-3.5 h-3.5", "", game.metacriticUserScore >= 9.5)}</div>
                </div>
              )}
            </div>
          </div>

          {(game.hltbMain || game.hltbExtra || game.hltbCompletionist) && (
            <div className="mt-3 pt-2.5 border-t border-zinc-800/60">
              <div className="text-[9px] uppercase tracking-wider text-zinc-400 font-extrabold text-center mb-1.5">
                Dados do How Long to Beat
              </div>
              <div className="grid grid-cols-3 gap-0.5 text-center bg-zinc-950/40 rounded-xl p-1 border border-zinc-800/40 min-w-0 overflow-hidden">
                <div 
                  className="min-w-0"
                  title={`Tempo estimado para a Campanha Principal (HowLongToBeat): ${formatHltbTime(game.hltbMain) || "Não especificado"}`}
                >
                  <span className="block text-[8px] text-zinc-400 uppercase tracking-wider font-bold truncate">Campanha</span>
                  <span className="text-[11px] font-black text-purple-400 font-mono leading-none truncate block">{formatHltbTime(game.hltbMain) || "-"}</span>
                </div>
                <div 
                  className="min-w-0"
                  title={`Tempo estimado para Campanha + Extras (HowLongToBeat): ${formatHltbTime(game.hltbExtra) || "Não especificado"}`}
                >
                  <span className="block text-[8px] text-zinc-400 uppercase tracking-wider font-bold truncate">História+Ext</span>
                  <span className="text-[11px] font-black text-cyan-400 font-mono leading-none truncate block">{formatHltbTime(game.hltbExtra) || "-"}</span>
                </div>
                <div 
                  className="min-w-0"
                  title={`Tempo estimado para 100% de conclusão (HowLongToBeat): ${formatHltbTime(game.hltbCompletionist) || "Não especificado"}`}
                >
                  <span className="block text-[8px] text-zinc-400 uppercase tracking-wider font-bold truncate">100%</span>
                  <span className="text-[11px] font-black text-pink-400 font-mono leading-none truncate block">{formatHltbTime(game.hltbCompletionist) || "-"}</span>
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
