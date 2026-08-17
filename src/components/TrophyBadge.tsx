/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Trophy, Sparkles } from "lucide-react";
import { TrophyItem } from "../types";

export type TrophyType = "none" | "bronze" | "silver" | "gold" | "platinum" | string;

export interface TrophyBadgeProps {
  key?: React.Key;
  trophy?: TrophyType;
  note?: string;
  mode?: "card" | "detail" | "form";
  className?: string;
}

export const TROPHY_INFO = {
  bronze: {
    name: "Troféu de Bronze",
    shortName: "Bronze",
    description: "Bronze: Joguei o suficiente mas não foi concluído",
    colorClass: "text-amber-600",
    borderClass: "border-amber-700/60",
    bgClass: "bg-amber-950/80",
    glowClass: "shadow-[0_0_10px_rgba(217,119,6,0.3)]",
    iconColor: "text-amber-600",
  },
  silver: {
    name: "Troféu de Prata",
    shortName: "Prata",
    description: "Prata: Joguei o jogo normalmente",
    colorClass: "text-zinc-300",
    borderClass: "border-zinc-500/50",
    bgClass: "bg-zinc-900/90",
    glowClass: "shadow-none",
    iconColor: "text-zinc-300",
  },
  gold: {
    name: "Troféu de Ouro",
    shortName: "Ouro",
    description: "Ouro: Terminei o jogo e fiz bastante extras",
    colorClass: "text-amber-300",
    borderClass: "border-amber-500/60",
    bgClass: "bg-amber-950/90",
    glowClass: "shadow-[0_0_12px_rgba(251,191,36,0.4)]",
    iconColor: "text-amber-400",
  },
  platinum: {
    name: "Troféu de Platina Brilhante",
    shortName: "Platina Brilhante",
    description: "Platina Brilhante: Joguei 100% (Platinado)",
    colorClass: "text-cyan-100",
    borderClass: "border-cyan-300/90",
    bgClass: "bg-gradient-to-r from-slate-950 via-cyan-950 to-indigo-950",
    glowClass: "shadow-[0_0_18px_rgba(34,211,238,0.65)]",
    iconColor: "text-cyan-200",
  },
};

export default function TrophyBadge({ trophy, note, mode = "detail", className = "" }: TrophyBadgeProps) {
  if (!trophy || trophy === "none") return null;

  const info = TROPHY_INFO[trophy as keyof typeof TROPHY_INFO];
  if (!info) return null;

  const isPlatinum = trophy === "platinum";
  const displayNote = note && note.trim() ? note.trim() : "";
  const tooltipTitle = displayNote
    ? `${info.name}\n\n📝 Anotação: ${displayNote}`
    : info.description;

  const badgeContent = (
    <div
      className={`inline-flex items-center justify-center ${
        mode === "card" ? "p-1.5 rounded-lg" : "px-2 py-1 rounded-xl"
      } border ${info.bgClass} ${info.borderClass} ${info.glowClass} ${className} transition-all cursor-help shrink-0 ${
        displayNote ? "ring-1 ring-cyan-400/50" : ""
      }`}
      title={displayNote ? undefined : tooltipTitle}
    >
      {isPlatinum ? (
        <div className="relative flex items-center justify-center shrink-0">
          <Trophy
            size={mode === "card" ? 13 : 16}
            fill="currentColor"
            className="text-cyan-100 drop-shadow-[0_0_8px_rgba(34,211,238,0.95)] animate-pulse"
          />
          <Sparkles
            size={mode === "card" ? 8 : 10}
            className={`text-cyan-300 absolute ${
              mode === "card" ? "-top-1 -right-1" : "-top-1.5 -right-1.5"
            } animate-spin-slow`}
          />
        </div>
      ) : (
        <Trophy
          size={mode === "card" ? 13 : 15}
          fill="currentColor"
          className={`${info.iconColor} shrink-0`}
        />
      )}
    </div>
  );

  return (
    <div
      className="inline-flex items-center cursor-help"
      data-tooltip={displayNote || info.description || info.shortName}
      data-tooltip-title={`Troféu: ${info.shortName}`}
      data-tooltip-theme="cyan"
    >
      {badgeContent}
    </div>
  );
}

export function TrophiesList({
  trophies,
  mode = "card",
  className = ""
}: {
  trophies?: (string | TrophyItem)[];
  mode?: "card" | "detail" | "form";
  className?: string;
}) {
  if (!trophies || trophies.length === 0) return null;

  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      {trophies.map((tr, idx) => {
        const item: TrophyItem = typeof tr === "string" ? { type: tr as any, note: "" } : tr;
        return (
          <TrophyBadge
            key={`${item.type}-${idx}`}
            trophy={item.type}
            note={item.note}
            mode={mode}
          />
        );
      })}
    </div>
  );
}
