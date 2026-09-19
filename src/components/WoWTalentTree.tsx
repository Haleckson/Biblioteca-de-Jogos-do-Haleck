/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import {
  Sparkles,
  Layers,
  Copy,
  Check,
  ChevronRight,
  Info,
  Shield,
  Zap,
  RotateCcw,
  Plus,
  Minus,
  Maximize2,
  Columns,
  Calculator,
  UserCheck,
  ExternalLink,
} from "lucide-react";
import { BlizzardProfileData } from "../types";
import { getWoWClassInfo } from "../utils/blizzardIcons";
import {
  WoWTalentNode,
  WoWTalentTreeData,
  RetailDualTalents,
  MoPTierRow,
  getClassicTalentTrees,
  getTBCTalentTrees,
  getMoPTalentMatrix,
  getRetailDualTalentTrees,
  isTalentTierUnlocked,
} from "../utils/blizzardTalents";

interface WoWTalentTreeProps {
  profile: BlizzardProfileData;
  activeVersion?: string;
}

export const WoWTalentTree: React.FC<WoWTalentTreeProps> = ({
  profile,
  activeVersion,
}) => {
  const charClass = profile.characterClass || "Druid";
  const charSpec = profile.activeSpec || "Feral";
  const charLevel = profile.level || 80;

  // Determine effective expansion strictly from the chosen WoW game's version
  const detectedVersion = useMemo(() => {
    const raw = (activeVersion || profile.wow_version || profile.gameMode || "retail").toLowerCase();
    if (raw.includes("forever") || raw.includes("vanilla+")) return "Forever";
    if (raw.includes("mop") || raw.includes("pandaria")) return "Classic MoP";
    if (raw.includes("tbc") || raw.includes("burning") || raw.includes("crusade")) return "Classic TBC";
    if (raw.includes("classic") || raw.includes("era") || raw.includes("vanilla")) return "Classic Era";
    return "Retail (Midnight)";
  }, [activeVersion, profile.wow_version, profile.gameMode]);

  // Selected expansion version is strictly locked to the chosen WoW game version
  const selectedVersion = detectedVersion;

  // Dual mode: "Character Build" (Read-only active spec) vs "Talent Calculator" (Editable sandbox)
  const [talentMode, setTalentMode] = useState<"build" | "calculator">("build");

  // Layout View mode for 3-spec trees
  const [viewMode, setViewMode] = useState<"all-specs" | "single">("all-specs");
  const [activeSingleTab, setActiveSingleTab] = useState<number>(1);

  // Hover state for detailed tooltip
  const [hoveredNode, setHoveredNode] = useState<{ node: WoWTalentNode; treeTitle?: string } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [copiedBuild, setCopiedBuild] = useState(false);

  // 1. Classic Era & Forever Data State (51 points, 3 specs)
  const [classicTrees, setClassicTrees] = useState<WoWTalentTreeData[]>(() =>
    getClassicTalentTrees(charClass, charSpec, charLevel)
  );

  // 2. TBC Data State (61 points, 3 specs with 41-pt capstones)
  const [tbcTrees, setTbcTrees] = useState<WoWTalentTreeData[]>(() =>
    getTBCTalentTrees(charClass, charSpec, charLevel)
  );

  // 3. MoP Data State (6 Tiers of 3 Talents)
  const [mopTiers, setMopTiers] = useState<MoPTierRow[]>(() =>
    getMoPTalentMatrix(charClass, charSpec)
  );

  // 4. Retail (Midnight) Data State (Dual Trees + Hero Talents)
  const [retailTrees, setRetailTrees] = useState<RetailDualTalents>(() =>
    getRetailDualTalentTrees(charClass, charSpec)
  );

  // Re-sync when character changes
  useEffect(() => {
    setClassicTrees(getClassicTalentTrees(charClass, charSpec, charLevel));
    setTbcTrees(getTBCTalentTrees(charClass, charSpec, charLevel));
    setMopTiers(getMoPTalentMatrix(charClass, charSpec));
    setRetailTrees(getRetailDualTalentTrees(charClass, charSpec));
  }, [charClass, charSpec, charLevel]);

  // Reset talent calculator points
  const handleResetCalculator = () => {
    if (selectedVersion === "Classic MoP") {
      setMopTiers((prev) =>
        prev.map((tier) => ({
          ...tier,
          talents: tier.talents.map((t) => ({ ...t, selected: false })),
        }))
      );
    } else if (selectedVersion === "Classic TBC") {
      setTbcTrees((prev) =>
        prev.map((tree) => ({
          ...tree,
          pointsSpent: 0,
          nodes: tree.nodes.map((n) => ({ ...n, rank: 0 })),
        }))
      );
    } else if (selectedVersion === "Retail (Midnight)") {
      setRetailTrees((prev) => ({
        classTree: {
          ...prev.classTree,
          pointsSpent: 0,
          nodes: prev.classTree.nodes.map((n) => ({ ...n, rank: 0 })),
        },
        specTree: {
          ...prev.specTree,
          pointsSpent: 0,
          nodes: prev.specTree.nodes.map((n) => ({ ...n, rank: 0 })),
        },
        heroTree: prev.heroTree
          ? {
              ...prev.heroTree,
              pointsSpent: 0,
              nodes: prev.heroTree.nodes.map((n) => ({ ...n, rank: 0 })),
            }
          : undefined,
      }));
    } else {
      // Classic Era or Forever
      setClassicTrees((prev) =>
        prev.map((tree) => ({
          ...tree,
          pointsSpent: 0,
          nodes: tree.nodes.map((n) => ({ ...n, rank: 0 })),
        }))
      );
    }
  };

  // Point handling for Classic / Forever / TBC
  const handleModifyClassicPoint = (
    treeList: WoWTalentTreeData[],
    setTreeList: React.Dispatch<React.SetStateAction<WoWTalentTreeData[]>>,
    treeIdx: number,
    nodeId: string,
    delta: number,
    maxTotalPoints: number
  ) => {
    if (talentMode !== "calculator") return;

    const currentTotal = treeList.reduce((sum, t) => sum + t.pointsSpent, 0);
    if (delta > 0 && currentTotal >= maxTotalPoints) return;

    setTreeList((prevTrees) => {
      const nextTrees = JSON.parse(JSON.stringify(prevTrees)) as WoWTalentTreeData[];
      const tree = nextTrees[treeIdx];
      const node = tree.nodes.find((n) => n.id === nodeId);
      if (!node) return prevTrees;

      if (delta > 0) {
        if (!isTalentTierUnlocked(tree.pointsSpent, node.row)) return prevTrees;
        if (node.rank < node.maxRank) {
          node.rank += 1;
          tree.pointsSpent += 1;
        }
      } else if (delta < 0) {
        if (node.rank > 0) {
          node.rank -= 1;
          tree.pointsSpent -= 1;
        }
      }

      return nextTrees;
    });
  };

  // MoP Tier Selection (1 of 3 per row)
  const handleSelectMoPTalent = (tierIndex: number, talentId: string) => {
    if (talentMode !== "calculator") return;
    setMopTiers((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as MoPTierRow[];
      const row = next[tierIndex];
      row.talents.forEach((t) => {
        t.selected = t.id === talentId ? !t.selected : false;
      });
      return next;
    });
  };

  // Copy Build String
  const copyBuildCode = () => {
    const buildString = `WOW-${selectedVersion.replace(/\s+/g, "")}-${charClass}-${charSpec}-${Date.now().toString(36)}`;
    navigator.clipboard.writeText(buildString);
    setCopiedBuild(true);
    setTimeout(() => setCopiedBuild(false), 2000);
  };

  const classInfo = getWoWClassInfo(charClass);

  return (
    <div id="wow-talents-component" className="space-y-3">
      {/* 1. Header Toolbar: Mode Switcher, Version Selector, Export */}
      <div className="p-3 rounded-2xl bg-zinc-950/90 border border-zinc-800 shadow-xl flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Dual Mode Switcher: Character Build vs Talent Calculator */}
          <div className="flex items-center bg-zinc-900 p-0.5 rounded-xl border border-zinc-700/70 shadow-inner">
            <button
              type="button"
              onClick={() => setTalentMode("build")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                talentMode === "build"
                  ? "bg-cyan-500 text-black shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Character Build</span>
            </button>
            <button
              type="button"
              onClick={() => setTalentMode("calculator")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                talentMode === "calculator"
                  ? "bg-cyan-500 text-black shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Talent Calculator</span>
            </button>
          </div>

          {/* Fixed Version Badge (Strictly matches the chosen WoW game's version) */}
          <div className="flex items-center gap-1.5 bg-zinc-900/90 px-3 py-1.5 rounded-xl border border-zinc-800 text-xs shadow-inner">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Versão do Jogo:</span>
            <span className="text-cyan-400 font-bold text-xs flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              {selectedVersion}
            </span>
          </div>

          {/* Mode Instructions / Reset */}
          {talentMode === "calculator" ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-400">
                Left-click to add, Right-click to remove
              </span>
              <button
                type="button"
                onClick={handleResetCalculator}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 text-[11px] font-bold cursor-pointer"
                title="Reset all spent points"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
              Active In-Game Configuration
            </span>
          )}
        </div>

        {/* Copy Build String */}
        <button
          type="button"
          onClick={copyBuildCode}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-bold text-zinc-300 hover:text-white transition-all cursor-pointer shadow"
        >
          {copiedBuild ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Build Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export Build</span>
            </>
          )}
        </button>
      </div>

      {/* 2. VERSION-SPECIFIC TALENT TREE DISPLAY */}

      {/* A. CLASSIC MOP (MISTS OF PANDARIA 5.4 - 6 TIER MATRIX) */}
      {selectedVersion === "Classic MoP" && (
        <div className="p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800 shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div>
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <span>Mists of Pandaria Talent Grid</span>
                <span className="text-xs font-normal text-amber-400">
                  (Choose 1 Talent per Tier)
                </span>
              </h4>
              <p className="text-[11px] text-zinc-400">
                Tiers unlock at levels 15, 30, 45, 60, 75, and 90.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {mopTiers.map((tierRow, tierIdx) => (
              <div
                key={tierRow.level}
                className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col md:flex-row items-start md:items-center gap-3"
              >
                <div className="w-20 shrink-0 font-mono font-bold text-xs text-amber-400 bg-zinc-950 px-2 py-1 rounded-lg border border-zinc-800 text-center">
                  Level {tierRow.level}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 w-full">
                  {tierRow.talents.map((talent) => {
                    const isSelected = talent.selected;
                    return (
                      <div
                        key={talent.id}
                        onClick={() => handleSelectMoPTalent(tierIdx, talent.id)}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredNode({ node: talent, treeTitle: `Level ${tierRow.level} Talent` });
                          setTooltipPos({ x: rect.right + 10, y: rect.top });
                        }}
                        onMouseLeave={() => setHoveredNode(null)}
                        className={`p-2 rounded-xl border transition-all flex items-center gap-2.5 ${
                          talentMode === "calculator" ? "cursor-pointer" : ""
                        } ${
                          isSelected
                            ? "bg-cyan-950/60 border-cyan-500 shadow-md ring-1 ring-cyan-500/50"
                            : "bg-zinc-950/70 border-zinc-800 hover:border-zinc-700 opacity-70 hover:opacity-100"
                        }`}
                      >
                        <img
                          src={talent.icon}
                          alt={talent.name}
                          className={`w-9 h-9 rounded-lg object-cover border ${
                            isSelected ? "border-cyan-400" : "border-zinc-700"
                          }`}
                        />
                        <div className="min-w-0">
                          <p
                            className={`text-xs font-bold truncate ${
                              isSelected ? "text-cyan-300" : "text-white"
                            }`}
                          >
                            {talent.name}
                          </p>
                          <p className="text-[10px] text-zinc-400 line-clamp-1">
                            {talent.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* B. CLASSIC TBC (LEVEL 70, 61 POINTS, 41-PT CAPSTONES) */}
      {selectedVersion === "Classic TBC" && (
        <div className="p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800 shadow-2xl space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div>
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <span>The Burning Crusade Talent Trees</span>
                <span className="text-xs font-mono text-cyan-400">
                  ({tbcTrees.reduce((s, t) => s + t.pointsSpent, 0)} / 61 Points)
                </span>
              </h4>
              <p className="text-[11px] text-zinc-400">
                Expanded 41-point capstone trees for Level 70.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {tbcTrees.map((tree, treeIdx) => (
              <div
                key={tree.id}
                className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <img
                      src={tree.icon}
                      alt={tree.name}
                      className="w-7 h-7 rounded-lg border border-zinc-700 object-cover"
                    />
                    <h5 className="text-xs font-black text-white">{tree.name}</h5>
                  </div>
                  <span className="font-mono text-xs font-bold text-cyan-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                    {tree.pointsSpent} pts
                  </span>
                </div>

                {/* Nodes Grid */}
                <div className="grid grid-cols-3 gap-2">
                  {tree.nodes.map((node) => {
                    const isMaxed = node.rank >= node.maxRank;
                    const hasPoints = node.rank > 0;
                    return (
                      <div
                        key={node.id}
                        onClick={() =>
                          handleModifyClassicPoint(
                            tbcTrees,
                            setTbcTrees,
                            treeIdx,
                            node.id,
                            1,
                            61
                          )
                        }
                        onContextMenu={(e) => {
                          e.preventDefault();
                          handleModifyClassicPoint(
                            tbcTrees,
                            setTbcTrees,
                            treeIdx,
                            node.id,
                            -1,
                            61
                          )
                        }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredNode({ node, treeTitle: tree.name });
                          setTooltipPos({ x: rect.right + 10, y: rect.top });
                        }}
                        onMouseLeave={() => setHoveredNode(null)}
                        className={`relative p-1.5 rounded-xl border transition-all flex flex-col items-center justify-center ${
                          talentMode === "calculator" ? "cursor-pointer hover:scale-105" : ""
                        } ${
                          isMaxed
                            ? "bg-amber-950/30 border-amber-500 shadow"
                            : hasPoints
                            ? "bg-cyan-950/40 border-cyan-500"
                            : "bg-zinc-950/60 border-zinc-800 opacity-60"
                        }`}
                      >
                        <img
                          src={node.icon}
                          alt={node.name}
                          className={`w-9 h-9 rounded-lg object-cover border ${
                            isMaxed
                              ? "border-amber-400"
                              : hasPoints
                              ? "border-cyan-400"
                              : "border-zinc-700 grayscale"
                          }`}
                        />
                        <span className="text-[10px] font-mono font-bold mt-1 text-zinc-300">
                          {node.rank}/{node.maxRank}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* C. CLASSIC ERA & FOREVER (LEVEL 60, 51 POINTS, 3 SPECS) */}
      {(selectedVersion === "Classic Era" || selectedVersion === "Forever") && (
        <div className="p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800 shadow-2xl space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div>
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <span>{selectedVersion} Classic Talent Trees</span>
                <span className="text-xs font-mono text-cyan-400">
                  ({classicTrees.reduce((s, t) => s + t.pointsSpent, 0)} / 51 Points)
                </span>
              </h4>
              <p className="text-[11px] text-zinc-400">
                Authentic 1.12 vanilla talent system with 5-point tier locks.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {classicTrees.map((tree, treeIdx) => (
              <div
                key={tree.id}
                className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <img
                      src={tree.icon}
                      alt={tree.name}
                      className="w-7 h-7 rounded-lg border border-zinc-700 object-cover"
                    />
                    <h5 className="text-xs font-black text-white">{tree.name}</h5>
                  </div>
                  <span className="font-mono text-xs font-bold text-cyan-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                    {tree.pointsSpent} pts
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {tree.nodes.map((node) => {
                    const isMaxed = node.rank >= node.maxRank;
                    const hasPoints = node.rank > 0;
                    return (
                      <div
                        key={node.id}
                        onClick={() =>
                          handleModifyClassicPoint(
                            classicTrees,
                            setClassicTrees,
                            treeIdx,
                            node.id,
                            1,
                            51
                          )
                        }
                        onContextMenu={(e) => {
                          e.preventDefault();
                          handleModifyClassicPoint(
                            classicTrees,
                            setClassicTrees,
                            treeIdx,
                            node.id,
                            -1,
                            51
                          )
                        }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredNode({ node, treeTitle: tree.name });
                          setTooltipPos({ x: rect.right + 10, y: rect.top });
                        }}
                        onMouseLeave={() => setHoveredNode(null)}
                        className={`relative p-1.5 rounded-xl border transition-all flex flex-col items-center justify-center ${
                          talentMode === "calculator" ? "cursor-pointer hover:scale-105" : ""
                        } ${
                          isMaxed
                            ? "bg-amber-950/30 border-amber-500 shadow"
                            : hasPoints
                            ? "bg-cyan-950/40 border-cyan-500"
                            : "bg-zinc-950/60 border-zinc-800 opacity-60"
                        }`}
                      >
                        <img
                          src={node.icon}
                          alt={node.name}
                          className={`w-9 h-9 rounded-lg object-cover border ${
                            isMaxed
                              ? "border-amber-400"
                              : hasPoints
                              ? "border-cyan-400"
                              : "border-zinc-700 grayscale"
                          }`}
                        />
                        <span className="text-[10px] font-mono font-bold mt-1 text-zinc-300">
                          {node.rank}/{node.maxRank}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* D. RETAIL (MIDNIGHT) - DUAL CLASS & SPEC TREES + HERO TALENTS */}
      {selectedVersion === "Retail (Midnight)" && (
        <div className="p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800 shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div>
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <span>Retail (Midnight) Dual Trees & Hero Talents</span>
              </h4>
              <p className="text-[11px] text-zinc-400">
                Class Tree + Spec Tree + {retailTrees.heroTree?.heroTreeName || "Hero Talents"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Class Tree */}
            <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <h5 className="text-xs font-black text-white">{retailTrees.classTree.title}</h5>
                <span className="font-mono text-xs text-cyan-400 font-bold">
                  {retailTrees.classTree.pointsSpent}/{retailTrees.classTree.maxPoints} pts
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {retailTrees.classTree.nodes.map((node) => (
                  <div
                    key={node.id}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredNode({ node, treeTitle: retailTrees.classTree.title });
                      setTooltipPos({ x: rect.right + 10, y: rect.top });
                    }}
                    onMouseLeave={() => setHoveredNode(null)}
                    className="p-2 rounded-xl bg-zinc-950/70 border border-cyan-500/50 flex items-center gap-2"
                  >
                    <img src={node.icon} alt="" className="w-8 h-8 rounded-lg object-cover border border-cyan-400" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{node.name}</p>
                      <span className="text-[10px] text-zinc-400 uppercase">{node.type || "Talent"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Spec Tree */}
            <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <h5 className="text-xs font-black text-white">{retailTrees.specTree.title}</h5>
                <span className="font-mono text-xs text-cyan-400 font-bold">
                  {retailTrees.specTree.pointsSpent}/{retailTrees.specTree.maxPoints} pts
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {retailTrees.specTree.nodes.map((node) => (
                  <div
                    key={node.id}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredNode({ node, treeTitle: retailTrees.specTree.title });
                      setTooltipPos({ x: rect.right + 10, y: rect.top });
                    }}
                    onMouseLeave={() => setHoveredNode(null)}
                    className="p-2 rounded-xl bg-zinc-950/70 border border-amber-500/50 flex items-center gap-2"
                  >
                    <img src={node.icon} alt="" className="w-8 h-8 rounded-lg object-cover border border-amber-400" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{node.name}</p>
                      <span className="text-[10px] text-zinc-400 uppercase">{node.type || "Talent"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero Talents Tree */}
            {retailTrees.heroTree && (
              <div className="p-3.5 rounded-xl bg-gradient-to-b from-purple-950/30 to-zinc-950/70 border border-purple-800/60 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-purple-800/40">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <h5 className="text-xs font-black text-purple-300">
                      {retailTrees.heroTree.heroTreeName}
                    </h5>
                  </div>
                  <span className="font-mono text-xs text-purple-300 font-bold">
                    {retailTrees.heroTree.pointsSpent}/{retailTrees.heroTree.maxPoints} pts
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {retailTrees.heroTree.nodes.map((node) => (
                    <div
                      key={node.id}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredNode({ node, treeTitle: retailTrees.heroTree?.heroTreeName });
                        setTooltipPos({ x: rect.right + 10, y: rect.top });
                      }}
                      onMouseLeave={() => setHoveredNode(null)}
                      className="p-2 rounded-xl bg-purple-950/40 border border-purple-500/50 flex items-center gap-2"
                    >
                      <img src={node.icon} alt="" className="w-8 h-8 rounded-lg object-cover border border-purple-400" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-purple-200 truncate">{node.name}</p>
                        <span className="text-[10px] text-purple-400">Hero Mastery</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Floating WoW-Authentic Talent Tooltip */}
      {hoveredNode && (
        <div
          className="fixed z-50 pointer-events-none p-3 rounded-xl bg-zinc-950/95 border-2 border-zinc-700 shadow-2xl text-xs max-w-xs space-y-1.5 backdrop-blur-md"
          style={{
            left: `${Math.min(tooltipPos.x, window.innerWidth - 320)}px`,
            top: `${Math.min(tooltipPos.y, window.innerHeight - 200)}px`,
          }}
        >
          <div className="flex items-center gap-2">
            <img
              src={hoveredNode.node.icon}
              alt=""
              className="w-8 h-8 rounded-lg border border-zinc-700 object-cover"
            />
            <div>
              <p className="font-bold text-white text-sm tracking-wide">
                {hoveredNode.node.name}
              </p>
              {hoveredNode.node.maxRank > 1 && (
                <p className="text-[11px] font-mono text-cyan-400">
                  Rank {hoveredNode.node.rank} / {hoveredNode.node.maxRank}
                </p>
              )}
            </div>
          </div>

          {(hoveredNode.node.spellCost || hoveredNode.node.castTime) && (
            <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
              <span>{hoveredNode.node.spellCost}</span>
              <span>{hoveredNode.node.castTime}</span>
            </div>
          )}

          {hoveredNode.node.cooldown && (
            <p className="text-amber-400 font-mono text-[11px]">
              {hoveredNode.node.cooldown}
            </p>
          )}

          <p className="text-amber-200/90 text-[11px] leading-relaxed">
            {hoveredNode.node.description}
          </p>

          {hoveredNode.node.nextRankDescription && (
            <div className="pt-1.5 border-t border-zinc-800 text-[10px] text-zinc-400">
              <span className="text-cyan-400 font-bold">Next Rank: </span>
              {hoveredNode.node.nextRankDescription}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
