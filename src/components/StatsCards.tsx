/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Game } from "../types";
import { motion } from "motion/react";
import { Gamepad2, Play, Pause, CheckCircle, FolderOpen, AlertTriangle } from "lucide-react";

interface StatsProps {
  games: Game[];
}

export default function StatsCards({ games }: StatsProps) {
  const total = games.length;
  const playing = games.filter(g => g.status.includes("Jogando")).length;
  const hiatus = games.filter(g => g.status.includes("Em Hiatus")).length;
  const finished = games.filter(g => g.status.includes("Terminado")).length;
  const backlog = games.filter(g => g.status.includes("Backlog")).length;
  const dropped = games.filter(g => g.status.includes("Desistido")).length;

  const stats = [
    { label: "Total", count: total, color: "text-cyan-400", bg: "border-cyan-500/40", bgHover: "hover:border-cyan-400", icon: Gamepad2 },
    { label: "Jogando", count: playing, color: "text-green-400", bg: "border-green-500/40", bgHover: "hover:border-green-400", icon: Play },
    { label: "Em Hiatus", count: hiatus, color: "text-orange-400", bg: "border-orange-500/40", bgHover: "hover:border-orange-400", icon: Pause },
    { label: "Terminado", count: finished, color: "text-blue-400", bg: "border-blue-500/40", bgHover: "hover:border-blue-400", icon: CheckCircle },
    { label: "Backlog", count: backlog, color: "text-zinc-300", bg: "border-zinc-600/40", bgHover: "hover:border-zinc-400", icon: FolderOpen },
    { label: "Desistido", count: dropped, color: "text-red-400", bg: "border-red-500/40", bgHover: "hover:border-red-400", icon: AlertTriangle },
  ];

  return (
    <div id="stats-container" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className={`glass rounded-2xl p-4 border ${stat.bg} ${stat.bgHover} relative overflow-hidden group hover:scale-[1.02] transition-all duration-300 shadow-lg`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-left min-w-0">
                <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-400 font-extrabold group-hover:text-zinc-200 transition-colors">
                  {stat.label}
                </div>
                <div className={`mt-1.5 text-2xl font-black ${stat.color} font-sans tracking-tight`}>
                  {stat.count}
                </div>
              </div>
              <div className={`p-2.5 rounded-xl bg-zinc-950/80 border ${stat.bg} ${stat.color} shrink-0 shadow-inner group-hover:scale-110 transition-transform duration-300`}>
                <Icon size={18} className="stroke-[2.5]" />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
