/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Game } from "../types";
import { motion } from "motion/react";

export interface GameCardProps {
  game: Game;
  onClick: () => void;
  key?: string | number;
}

export function chipClass(status: string) {
  if (status === "Jogando") return "chip-green";
  if (status === "Em Hiatus") return "chip-orange";
  if (status === "Terminado") return "chip-blue";
  if (status === "Desistido") return "chip-red";
  return "chip-gray";
}

export function renderStars(rating: number) {
  const stars = [];
  
  // Determine color based on rating
  let starColor = "#facc15"; // default yellow-400 (Gold)
  let dropShadow = "";
  
  if (rating >= 5) {
    starColor = "#E5E4E2"; // Platina brilhante
    dropShadow = "drop-shadow(0 0 6px rgba(229, 228, 226, 0.95)) drop-shadow(0 0 1px rgba(255, 255, 255, 1))";
  } else if (rating >= 3.0) {
    starColor = "#facc15"; // Ouro
  } else if (rating >= 2.0) {
    starColor = "#a1a1aa"; // Prata
  } else if (rating > 0) {
    starColor = "#b45309"; // Bronze
  }

  for (let i = 1; i <= 5; i++) {
    const filled = rating >= i;
    const isHalf = !filled && rating + 0.5 >= i;

    if (filled) {
      stars.push(
        <svg 
          key={i} 
          className="w-3.5 h-3.5 fill-current" 
          style={{ color: starColor, filter: dropShadow || undefined }}
          viewBox="0 0 24 24"
        >
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      );
    } else if (isHalf) {
      stars.push(
        <svg 
          key={i} 
          className="w-3.5 h-3.5 fill-current" 
          style={{ filter: dropShadow || undefined }}
          viewBox="0 0 24 24"
        >
          <defs>
            <linearGradient id={`halfGrad-${i}-${rating}`}>
              <stop offset="50%" stopColor={starColor} />
              <stop offset="50%" stopColor="#27272a" />
            </linearGradient>
          </defs>
          <path fill={`url(#halfGrad-${i}-${rating})`} d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      );
    } else {
      stars.push(
        <svg key={i} className="w-3.5 h-3.5 text-zinc-800 fill-current" viewBox="0 0 24 24">
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

export default function GameCard({ game, onClick }: GameCardProps) {
  const coverImg = game.cover || "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800";
  const firstGenre = game.genre && game.genre.length ? game.genre[0] : "Geral";

  return (
    <motion.div
      layout
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25 }}
      className="group cursor-pointer glass rounded-3xl overflow-hidden border border-zinc-700/60 hover:border-cyan-500/50 hover:shadow-cyan-950/20 hover:shadow-lg transition-all duration-300 flex flex-col h-full"
    >
      <div className="relative h-48 overflow-hidden shrink-0">
        <img
          src={coverImg}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          alt={game.name}
          referrerPolicy="no-referrer"
          onError={(e: any) => {
            (e.target as HTMLImageElement).src = "https://placehold.co/800x600/040406/ffffff?text=Sem+Capa";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute top-4 right-4 px-2.5 py-1 rounded-xl bg-zinc-950/90 backdrop-blur-md text-cyan-300 text-[10px] font-extrabold uppercase tracking-widest border border-cyan-500/40 shadow-sm">
          {game.platform || "PC"}
        </div>
      </div>
      <div className="p-5 flex flex-col flex-1 justify-between">
        <div>
          <div className="flex items-start gap-3">
            {renderIcon(game, "w-10 h-10 rounded-2xl shrink-0 mt-0.5")}
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-extrabold text-white group-hover:text-cyan-300 transition-colors break-words leading-tight">
                {game.name}
              </h3>
              <p className="text-[11px] uppercase tracking-[0.25em] text-purple-400 font-bold mt-0.5 truncate">
                {game.series || "Série autónoma"}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 items-center">
            {game.status.map((s, idx) => (
              <span key={`${s}-${idx}`} className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${chipClass(s)}`}>
                {s}
              </span>
            ))}
            {[...game.genre].sort((a, b) => a.localeCompare(b, "pt", { sensitivity: "base" })).map((g, idx) => (
              <span key={`${g}-${idx}`} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950/50 text-purple-300 border border-purple-500/30">
                {g}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[...game.tags].sort((a, b) => a.localeCompare(b, "pt", { sensitivity: "base" })).slice(0, 3).map((t, idx) => (
              <span
                key={`${t}-${idx}`}
                className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-zinc-950 border border-cyan-500/30 text-cyan-300"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-zinc-700/60 flex items-center justify-between">
          <span className="text-xs text-zinc-300 font-mono font-bold">
            {game.playtime || "00h 00m"}
          </span>
          {renderStars(game.rating || 0)}
        </div>
      </div>
    </motion.div>
  );
}
