/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Game } from "../types";
import { motion } from "motion/react";
import { Gamepad2, Play, Pause, CheckCircle, FolderOpen, AlertTriangle } from "lucide-react";

interface StatsProps {
  games: Game[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function StatsCards({ games, activeTab, onTabChange }: StatsProps) {
  const total = games.length;
  const getStatus = (g: Game) => Array.isArray(g.status) ? g.status : typeof g.status === "string" ? [g.status] : [];
  const playing = games.filter(g => getStatus(g).includes("Jogando")).length;
  const hiatus = games.filter(g => getStatus(g).includes("Em Hiatus")).length;
  const finished = games.filter(g => getStatus(g).includes("Terminado")).length;
  const backlog = games.filter(g => getStatus(g).includes("Backlog")).length;
  const dropped = games.filter(g => getStatus(g).includes("Desistido")).length;

  const stats = [
    { label: "Total", value: "Todos", count: total, color: "text-cyan-400", bg: "border-cyan-500/40", bgHover: "hover:border-cyan-400", icon: Gamepad2 },
    { label: "Jogando", value: "Jogando", count: playing, color: "text-green-400", bg: "border-green-500/40", bgHover: "hover:border-green-400", icon: Play },
    { label: "Em Hiatus", value: "Em Hiatus", count: hiatus, color: "text-orange-400", bg: "border-orange-500/40", bgHover: "hover:border-orange-400", icon: Pause },
    { label: "Terminado", value: "Terminado", count: finished, color: "text-blue-400", bg: "border-blue-500/40", bgHover: "hover:border-blue-400", icon: CheckCircle },
    { label: "Backlog", value: "Backlog", count: backlog, color: "text-zinc-300", bg: "border-zinc-600/40", bgHover: "hover:border-zinc-400", icon: FolderOpen },
    { label: "Desistido", value: "Desistido", count: dropped, color: "text-red-400", bg: "border-red-500/40", bgHover: "hover:border-red-400", icon: AlertTriangle },
  ];

  return (
    <div id="stats-container" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        const isActive = activeTab === stat.value;
        return (
          <motion.div
            key={stat.label}
            id={`stat-card-${stat.value.toLowerCase().replace(/\s+/g, '-')}`}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            onClick={() => onTabChange(stat.value)}
            className={`glass rounded-2xl p-4 border relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 shadow-lg cursor-pointer ${
              isActive
                ? `bg-zinc-900/90 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-2 ring-offset-2 ring-offset-zinc-950 ${
                    stat.value === "Todos" ? "ring-cyan-500 border-cyan-400/80" :
                    stat.value === "Jogando" ? "ring-green-500 border-green-400/80" :
                    stat.value === "Em Hiatus" ? "ring-orange-500 border-orange-400/80" :
                    stat.value === "Terminado" ? "ring-blue-500 border-blue-400/80" :
                    stat.value === "Backlog" ? "ring-zinc-400 border-zinc-300/80" :
                    "ring-red-500 border-red-400/80"
                  }`
                : `${stat.bg} ${stat.bgHover}`
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-left min-w-0">
                <div className={`text-[10px] uppercase tracking-[0.25em] font-extrabold transition-colors ${
                  isActive ? "text-zinc-200" : "text-zinc-400 group-hover:text-zinc-200"
                }`}>
                  {stat.label}
                </div>
                <div className={`mt-1.5 text-2xl font-black font-sans tracking-tight ${stat.color}`}>
                  {stat.count}
                </div>
              </div>
              <div className={`p-2.5 rounded-xl shrink-0 shadow-inner group-hover:scale-110 transition-transform duration-300 ${
                isActive ? "bg-zinc-950/80 border border-current text-white" : `bg-zinc-950/80 border ${stat.bg} ${stat.color}`
              }`}>
                <Icon size={18} className="stroke-[2.5]" />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
