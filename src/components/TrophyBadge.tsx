/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Trophy, Sparkles } from "lucide-react";

export type TrophyType = "none" | "silver" | "gold" | "platinum" | string;

export interface TrophyBadgeProps {
  key?: React.Key;
  trophy?: TrophyType;
  mode?: "card" | "detail" | "form";
  className?: string;
}

export const TROPHY_INFO = {
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

export default function TrophyBadge({ trophy, mode = "detail", className = "" }: TrophyBadgeProps) {
  if (!trophy || trophy === "none") return null;

  const info = TROPHY_INFO[trophy as keyof typeof TROPHY_INFO];
  if (!info) return null;

  const isPlatinum = trophy === "platinum";

  if (mode === "card") {
    return (
      <div
        className={`inline-flex items-center justify-center p-1.5 rounded-lg border ${info.bgClass} ${info.borderClass} ${info.glowClass} ${className} transition-all cursor-help shrink-0`}
        title={info.description}
      >
        {isPlatinum ? (
          <div className="relative flex items-center justify-center shrink-0">
            <Trophy
              size={13}
              fill="currentColor"
              className="text-cyan-100 drop-shadow-[0_0_8px_rgba(34,211,238,0.95)] animate-pulse"
            />
            <Sparkles size={8} className="text-cyan-300 absolute -top-1 -right-1 animate-ping opacity-90" />
          </div>
        ) : (
          <Trophy size={13} fill="currentColor" className={`${info.iconColor} shrink-0`} />
        )}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center px-2 py-1 rounded-xl border ${info.bgClass} ${info.borderClass} ${info.glowClass} ${className} transition-all cursor-help shrink-0`}
      title={info.description}
    >
      {isPlatinum ? (
        <div className="relative flex items-center justify-center shrink-0">
          <Trophy
            size={16}
            fill="currentColor"
            className="text-cyan-100 drop-shadow-[0_0_12px_rgba(34,211,238,1)] animate-pulse"
          />
          <Sparkles size={10} className="text-cyan-300 absolute -top-1.5 -right-1.5 animate-spin-slow" />
        </div>
      ) : (
        <Trophy size={15} fill="currentColor" className={`${info.iconColor} shrink-0`} />
      )}
    </div>
  );
}

export function TrophiesList({ trophies, mode = "card", className = "" }: { trophies?: string[]; mode?: "card" | "detail" | "form"; className?: string }) {
  if (!trophies || trophies.length === 0) return null;

  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      {trophies.map((tr, idx) => (
        <TrophyBadge key={`${tr}-${idx}`} trophy={tr} mode={mode} />
      ))}
    </div>
  );
}
