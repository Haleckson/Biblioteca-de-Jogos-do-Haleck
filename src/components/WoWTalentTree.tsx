/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import {
  Sparkles,
  Layers,
  Copy,
  Check,
  ChevronRight,
  Info,
  Shield,
  Zap,
  Flame,
  Snowflake,
  Crosshair,
  Skull,
  Compass,
} from "lucide-react";
import { BlizzardProfileData } from "../types";
import { getWoWClassInfo } from "../utils/blizzardIcons";
import {
  WoWTalentNode,
  WoWTalentTreeData,
  RetailDualTalents,
  getClassicTalentTrees,
  getRetailDualTalentTrees,
} from "../utils/blizzardTalents";

export type { WoWTalentNode, WoWTalentTreeData, RetailDualTalents };

interface WoWTalentTreeProps {
  profile: BlizzardProfileData;
}

export const WoWTalentTree: React.FC<WoWTalentTreeProps> = ({ profile }) => {
  const charClass = profile.characterClass || "Druid";
  const charSpec = profile.activeSpec || "Feral";
  const charLevel = profile.level || 18;
  const gameMode = (profile.gameMode || "retail").toLowerCase();
  const defaultIsClassic = gameMode.includes("classic") || gameMode.includes("forever") || gameMode.includes("tbc") || charLevel <= 60;

  const [activeMode, setActiveMode] = useState<"classic" | "retail">(defaultIsClassic ? "classic" : "retail");
  const isClassicEra = activeMode === "classic";

  // Select default tree: for Druid, if Feral -> 1; if Balance -> 0; if Resto -> 2
  const initialTreeIdx = useMemo(() => {
    const s = charSpec.toLowerCase();
    if (s.includes("equil") || s.includes("balance") || s.includes("sagrado") || s.includes("holy") || s.includes("armas") || s.includes("arms")) return 0;
    if (s.includes("feral") || s.includes("combate") || s.includes("prote") || s.includes("furia") || s.includes("fury")) return 1;
    return 2;
  }, [charSpec]);

  const [selectedClassicTree, setSelectedClassicTree] = useState<number>(initialTreeIdx);
  const [hoveredNode, setHoveredNode] = useState<WoWTalentNode | null>(null);
  const [copiedBuild, setCopiedBuild] = useState(false);

  const classInfo = getWoWClassInfo(charClass);

  const classicTrees = useMemo(() => {
    return getClassicTalentTrees(charClass, charSpec, charLevel);
  }, [charClass, charSpec, charLevel]);

  const retailTrees = useMemo(() => {
    return getRetailDualTalentTrees(charClass, charSpec);
  }, [charClass, charSpec]);

  const totalPointsSpent = classicTrees.reduce((sum, t) => sum + t.pointsSpent, 0);
  const maxPointsAvailable = Math.max(0, charLevel - 9);

  const copyBuildCode = () => {
    const code = `BcGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQJISSSkEAAA_${charClass}_${charSpec}_Lvl${charLevel}`;
    navigator.clipboard?.writeText(code);
    setCopiedBuild(true);
    setTimeout(() => setCopiedBuild(false), 2500);
  };

  return (
    <div id="wow-talent-tree-component" className="space-y-4">
      {/* 1. Header Banner & Mode Indicator */}
      <div className="p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800 shadow-xl flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3.5">
          <img
            src={classInfo.iconUrl}
            alt={classInfo.name}
            className="w-12 h-12 rounded-xl border-2 object-cover shadow-lg"
            style={{ borderColor: classInfo.color }}
          />
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-black text-white tracking-wide">
                {charSpec} {classInfo.ptBR}
              </h4>
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-zinc-800 text-cyan-300 border border-zinc-700 uppercase">
                {isClassicEra ? "Árvore Clássica (3 Ramos)" : "Árvore Retail (Dragonflight / TWW)"}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {isClassicEra
                ? `Pontos de talento disponíveis: ${totalPointsSpent} / ${maxPointsAvailable} alocados (Nível ${charLevel})`
                : `Configuração oficial de talentos de Classe e Especialização`}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Tree Mode Switcher */}
          <div className="flex items-center bg-zinc-900 border border-zinc-700/80 rounded-xl p-0.5 text-xs">
            <button
              type="button"
              id="wow-toggle-classic-tree-btn"
              onClick={() => setActiveMode("classic")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                isClassicEra
                  ? "bg-amber-500 text-black shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Clássico
            </button>
            <button
              type="button"
              id="wow-toggle-retail-tree-btn"
              onClick={() => setActiveMode("retail")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                !isClassicEra
                  ? "bg-cyan-500 text-black shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Retail (DF/TWW)
            </button>
          </div>

          <button
            type="button"
            id="wow-copy-build-btn"
            onClick={copyBuildCode}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 hover:border-cyan-500/50 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow"
            title="Copiar código de importação do loadout estilo Wowhead / In-Game"
          >
            {copiedBuild ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copiedBuild ? "Código Copiado!" : "Copiar Build"}</span>
          </button>
        </div>
      </div>

      {/* 2. CLASSIC TALENT TREE CALCULATOR VIEW (Classic / Forever / TBC) */}
      {isClassicEra ? (
        <div className="space-y-4">
          {/* Tree Navigation Selector Tabs */}
          <div className="grid grid-cols-3 gap-2">
            {classicTrees.map((tree, idx) => {
              const isActive = selectedClassicTree === idx;
              return (
                <button
                  key={tree.id}
                  type="button"
                  id={`wow-classic-tree-tab-${tree.id}`}
                  onClick={() => setSelectedClassicTree(idx)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isActive
                      ? "bg-zinc-900 border-amber-500/80 shadow-lg shadow-amber-950/40"
                      : "bg-zinc-950/60 border-zinc-800/80 hover:bg-zinc-900/50 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={tree.icon}
                      alt={tree.name}
                      className={`w-8 h-8 rounded-lg border object-cover shrink-0 ${
                        isActive ? "border-amber-400" : "border-zinc-700 grayscale"
                      }`}
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white block truncate">
                        {tree.name}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
                        Ramo {idx + 1}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-mono font-black px-2 py-0.5 rounded-md border ${
                      tree.pointsSpent > 0
                        ? "bg-amber-950/80 text-amber-300 border-amber-500/50"
                        : "bg-zinc-900 text-zinc-500 border-zinc-800"
                    }`}
                  >
                    {tree.pointsSpent}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Tree Showcase Grid (Authentic WoW 7-tier Calculator Grid) */}
          {classicTrees[selectedClassicTree] && (
            <div className="relative rounded-2xl bg-gradient-to-b from-zinc-950 via-zinc-900/80 to-zinc-950 border border-zinc-800 p-6 overflow-hidden shadow-2xl">
              {/* Watermark Tree Emblem */}
              <div className="absolute right-4 top-4 opacity-5 pointer-events-none">
                <img
                  src={classicTrees[selectedClassicTree].icon}
                  alt="tree-bg"
                  className="w-64 h-64 object-contain blur-sm"
                />
              </div>

              {/* Grid Canvas: 7 Rows (Tiers) */}
              <div className="relative z-10 max-w-xl mx-auto space-y-4">
                {[0, 1, 2, 3, 4, 5, 6].map((rowIdx) => {
                  const nodesInRow = classicTrees[selectedClassicTree].nodes.filter((n) => n.row === rowIdx);
                  const tierMinPoints = rowIdx * 5;
                  const isTierUnlocked = classicTrees[selectedClassicTree].pointsSpent >= tierMinPoints;

                  return (
                    <div key={rowIdx} className="flex items-center gap-4">
                      {/* Tier Points Gate Marker */}
                      <span className="text-[10px] font-mono text-zinc-500 w-8 shrink-0 text-right">
                        {tierMinPoints}p
                      </span>

                      {/* 4 Column Slots for this Row */}
                      <div className="grid grid-cols-4 gap-4 flex-1">
                        {[0, 1, 2, 3].map((colIdx) => {
                          const node = nodesInRow.find((n) => n.col === colIdx);
                          if (!node) {
                            return <div key={colIdx} className="w-12 h-12" />;
                          }

                          const isMaxed = node.rank === node.maxRank;
                          const hasPoints = node.rank > 0;

                          return (
                            <div
                              key={colIdx}
                              className="relative group flex flex-col items-center"
                              onMouseEnter={() => setHoveredNode(node)}
                              onMouseLeave={() => setHoveredNode(null)}
                            >
                              <div
                                className={`relative w-12 h-12 rounded-xl border-2 transition-all duration-200 cursor-pointer flex items-center justify-center ${
                                  hasPoints
                                    ? isMaxed
                                      ? "border-amber-400 bg-amber-950/40 shadow-[0_0_15px_rgba(245,158,11,0.45)] scale-105"
                                      : "border-emerald-400 bg-emerald-950/40 shadow-[0_0_12px_rgba(16,185,129,0.35)]"
                                    : isTierUnlocked
                                    ? "border-zinc-600 bg-zinc-900 opacity-60 hover:opacity-100 hover:border-zinc-400"
                                    : "border-zinc-800 bg-zinc-950/60 opacity-30 grayscale pointer-events-none"
                                }`}
                              >
                                <img
                                  src={node.icon}
                                  alt={node.name}
                                  className={`w-full h-full object-cover rounded-lg ${
                                    !hasPoints && !isTierUnlocked ? "grayscale" : ""
                                  }`}
                                  onError={(e) => {
                                    e.currentTarget.src = "https://wow.zamimg.com/images/wow/icons/large/spell_nature_healingtouch.jpg";
                                  }}
                                />

                                {/* Rank Badge Counter (e.g. 5/5 or 1/1) */}
                                <span
                                  className={`absolute -bottom-2 -right-1 px-1.5 py-0.2 rounded-md text-[9px] font-mono font-black border shadow-md ${
                                    isMaxed
                                      ? "bg-amber-500 text-black border-amber-300"
                                      : hasPoints
                                      ? "bg-emerald-600 text-white border-emerald-400"
                                      : "bg-black/90 text-zinc-400 border-zinc-700"
                                  }`}
                                >
                                  {node.rank}/{node.maxRank}
                                </span>
                              </div>

                              <span className="text-[10px] font-semibold text-zinc-400 mt-1 text-center truncate max-w-[80px]">
                                {node.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 3. RETAIL TALENT VIEW (Dragonflight / The War Within 2-Tree System) */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Class Tree */}
            <div className="p-5 rounded-2xl bg-zinc-950/90 border border-zinc-800 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-cyan-400" />
                  <h5 className="text-sm font-bold text-white">{retailTrees.classTree.title}</h5>
                </div>
                <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40">
                  {retailTrees.classTree.pointsSpent} / {retailTrees.classTree.maxPoints}
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Habilidades fundamentais de utilidade, defesa e mobilidade compartilhadas por todas as especializações de {classInfo.ptBR}. Passe o mouse sobre os talentos para ver descrições completas.
              </p>

              {/* Class Nodes */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                {retailTrees.classTree.nodes.map((node) => (
                  <div
                    key={node.id}
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                    className="p-2 rounded-xl bg-zinc-900 border border-cyan-500/30 hover:border-cyan-400 hover:bg-zinc-800/90 flex items-center gap-2 cursor-pointer transition-all shadow-sm"
                  >
                    <img
                      src={node.icon}
                      alt={node.name}
                      className="w-8 h-8 rounded-lg border border-cyan-400/60 object-cover shrink-0"
                      onError={(e) => {
                        e.currentTarget.src = "https://wow.zamimg.com/images/wow/icons/large/spell_nature_healingtouch.jpg";
                      }}
                    />
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold text-zinc-200 block truncate">{node.name}</span>
                      <span className="text-[9px] font-mono text-cyan-300">
                        {node.rank}/{node.maxRank} • {node.type || "ativo"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Spec Tree */}
            <div className="p-5 rounded-2xl bg-zinc-950/90 border border-zinc-800 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-amber-400" />
                  <h5 className="text-sm font-bold text-white">{retailTrees.specTree.title}</h5>
                </div>
                <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/40">
                  {retailTrees.specTree.pointsSpent} / {retailTrees.specTree.maxPoints}
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Habilidades que definem o núcleo da sua rotação de combate e poder destrutivo em {charSpec}. Passe o mouse sobre os talentos para ver descrições completas.
              </p>

              {/* Spec nodes */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                {retailTrees.specTree.nodes.map((node) => (
                  <div
                    key={node.id}
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                    className="p-2 rounded-xl bg-zinc-900 border border-amber-500/30 hover:border-amber-400 hover:bg-zinc-800/90 flex items-center gap-2 cursor-pointer transition-all shadow-sm"
                  >
                    <img
                      src={node.icon}
                      alt={node.name}
                      className="w-8 h-8 rounded-lg border border-amber-400/60 object-cover shrink-0"
                      onError={(e) => {
                        e.currentTarget.src = "https://wow.zamimg.com/images/wow/icons/large/spell_holy_magicalsentry.jpg";
                      }}
                    />
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold text-zinc-200 block truncate">{node.name}</span>
                      <span className="text-[9px] font-mono text-amber-300">
                        {node.rank}/{node.maxRank} • {node.type || "ativo"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Interactive Wowhead-Style Talent Tooltip */}
      {hoveredNode && (
        <div className="p-4 rounded-xl bg-zinc-950 border border-amber-500/60 shadow-2xl space-y-2 max-w-md animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <img
              src={hoveredNode.icon}
              alt={hoveredNode.name}
              className="w-10 h-10 rounded-lg border-2 border-amber-400 object-cover"
            />
            <div>
              <h5 className="text-sm font-bold text-amber-300 leading-tight">
                {hoveredNode.name}
              </h5>
              <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                <span>Ranque {hoveredNode.rank}/{hoveredNode.maxRank}</span>
                {hoveredNode.spellCost && (
                  <>
                    <span>•</span>
                    <span className="text-cyan-300 font-mono">{hoveredNode.spellCost}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-zinc-200 leading-relaxed pt-1">
            {hoveredNode.description}
          </p>

          {hoveredNode.rank < hoveredNode.maxRank && hoveredNode.nextRankDescription && (
            <div className="pt-2 border-t border-zinc-800 text-xs text-zinc-400">
              <span className="text-[10px] uppercase font-bold text-amber-400/80 block">Próximo Ranque:</span>
              <p className="mt-0.5">{hoveredNode.nextRankDescription}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
