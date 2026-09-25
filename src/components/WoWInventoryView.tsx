/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Package,
  Search,
  Coins,
  Sparkles,
  ArrowUpDown,
  LayoutGrid,
  Layers,
  Filter,
  CheckCircle2,
  Info,
} from "lucide-react";
import {
  BlizzardProfileData,
  BlizzardInventoryItem,
  BlizzardBagContainer,
} from "../types";
import { getWoWItemQuality } from "../utils/blizzardIcons";
import { generateWoWCharacterProfile } from "../utils/blizzardCharacterData";
import { resolveWowheadUrl, getWowheadItemUrl, WowheadBadgeLink } from "../utils/wowheadUrls";

interface WoWInventoryViewProps {
  profile: BlizzardProfileData;
}

export const WoWInventoryView: React.FC<WoWInventoryViewProps> = ({ profile }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"unified" | "split">("unified");
  const [sortBy, setSortBy] = useState<"slot" | "quality" | "name">("slot");
  const [hoveredItem, setHoveredItem] = useState<{
    item: BlizzardInventoryItem;
    x: number;
    y: number;
  } | null>(null);

  const itemLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (itemLeaveTimeoutRef.current) clearTimeout(itemLeaveTimeoutRef.current);
    };
  }, []);

  const inventory = useMemo(() => {
    if (profile.inventory && (profile.inventory.backpack || (profile.inventory.bags && profile.inventory.bags.length > 0))) {
      return profile.inventory;
    }
    const gen = generateWoWCharacterProfile({
      name: profile.name,
      realm: profile.realm,
      characterClass: profile.characterClass,
      race: profile.race,
      level: profile.level,
      gender: profile.gender,
      faction: profile.faction,
      gameMode: profile.wow_version || profile.gameMode || "retail",
    });
    return gen.inventory;
  }, [profile]);

  // Aggregate all bags
  const allContainers = useMemo(() => {
    if (!inventory) return [];
    const list: BlizzardBagContainer[] = [];
    if (inventory.backpack) list.push(inventory.backpack);
    if (inventory.bags && Array.isArray(inventory.bags)) {
      list.push(...inventory.bags);
    }
    return list;
  }, [inventory]);

  // Compute total slots and used slots
  const totalSlots = allContainers.reduce((sum, b) => sum + b.slotCount, 0);
  const totalUsedSlots = allContainers.reduce(
    (sum, b) => sum + b.items.filter((it) => it !== null).length,
    0
  );

  // Flatten all slots into a unified list
  const unifiedSlots = useMemo(() => {
    const slots: {
      bagIndex: number;
      slotIndex: number;
      bagName: string;
      item: BlizzardInventoryItem | null;
    }[] = [];

    allContainers.forEach((container, bIdx) => {
      container.items.forEach((item, sIdx) => {
        slots.push({
          bagIndex: bIdx,
          slotIndex: sIdx,
          bagName: container.name,
          item: item,
        });
      });
    });

    if (sortBy === "quality") {
      const qualityOrder: Record<string, number> = {
        LEGENDARY: 6,
        EPIC: 5,
        RARE: 4,
        UNCOMMON: 3,
        COMMON: 2,
        POOR: 1,
      };
      return [...slots].sort((a, b) => {
        if (!a.item && !b.item) return 0;
        if (!a.item) return 1;
        if (!b.item) return -1;
        const qA = qualityOrder[a.item.quality] || 0;
        const qB = qualityOrder[b.item.quality] || 0;
        if (qB !== qA) return qB - qA;
        return a.item.name.localeCompare(b.item.name);
      });
    }

    if (sortBy === "name") {
      return [...slots].sort((a, b) => {
        if (!a.item && !b.item) return 0;
        if (!a.item) return 1;
        if (!b.item) return -1;
        return a.item.name.localeCompare(b.item.name);
      });
    }

    return slots;
  }, [allContainers, sortBy]);

  const handleMouseEnter = (item: BlizzardInventoryItem, e: React.MouseEvent) => {
    if (itemLeaveTimeoutRef.current) {
      clearTimeout(itemLeaveTimeoutRef.current);
      itemLeaveTimeoutRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredItem({
      item,
      x: rect.right + 10,
      y: Math.max(10, rect.top - 20),
    });
  };

  const handleMouseLeave = () => {
    itemLeaveTimeoutRef.current = setTimeout(() => {
      setHoveredItem(null);
    }, 300);
  };

  return (
    <div id="wow-inventory-component" className="space-y-3">
      {/* 1. Currency & Wallet Bar + Filters */}
      <div className="p-3 rounded-2xl bg-zinc-950/90 border border-zinc-800 shadow-xl flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Gold, Silver, Copper */}
          <div className="flex items-center gap-2.5 bg-zinc-900/90 px-3 py-1.5 rounded-xl border border-zinc-700/70 shadow-inner">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Money:</span>
            <div className="flex items-center gap-2 font-mono font-bold text-xs">
              <span className="flex items-center gap-1 text-amber-400">
                {inventory?.gold?.toLocaleString() || 0}
                <span className="w-3 h-3 rounded-full bg-amber-500 border border-amber-300 inline-block" />
              </span>
              <span className="flex items-center gap-1 text-zinc-300">
                {inventory?.silver || 0}
                <span className="w-3 h-3 rounded-full bg-zinc-400 border border-zinc-200 inline-block" />
              </span>
              <span className="flex items-center gap-1 text-amber-700">
                {inventory?.copper || 0}
                <span className="w-3 h-3 rounded-full bg-amber-800 border border-amber-600 inline-block" />
              </span>
            </div>
          </div>

          {/* Bag Space Gauge */}
          <div className="flex items-center gap-1.5 bg-zinc-900/60 px-2.5 py-1.5 rounded-xl border border-zinc-800 text-[11px]">
            <Package className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-zinc-400">Slots:</span>
            <span className="font-mono font-bold text-white">
              {totalUsedSlots} / {totalSlots}
            </span>
            <span className="text-[10px] text-zinc-500">
              ({totalSlots - totalUsedSlots} free)
            </span>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-zinc-900 p-0.5 rounded-xl border border-zinc-800 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("unified")}
              title="Unified All-in-One Bag"
              className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === "unified"
                  ? "bg-cyan-500 text-black shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Unified</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("split")}
              title="Separate Individual Bags"
              className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === "split"
                  ? "bg-cyan-500 text-black shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Split</span>
            </button>
          </div>

          {/* Sort Option */}
          <button
            type="button"
            onClick={() =>
              setSortBy(sortBy === "slot" ? "quality" : sortBy === "quality" ? "name" : "slot")
            }
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/80 text-[11px] font-bold text-zinc-300 hover:text-white transition-all cursor-pointer"
            title="Cycle sorting mode"
          >
            <ArrowUpDown className="w-3 h-3 text-cyan-400" />
            <span>Sort: {sortBy.toUpperCase()}</span>
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search items..."
              className="bg-zinc-900 text-xs text-white placeholder-zinc-500 pl-7 pr-3 py-1.5 rounded-xl border border-zinc-700/80 focus:outline-none focus:border-cyan-500 w-32 sm:w-40 transition-all"
            />
          </div>

          {/* Category Chips */}
          <div className="flex items-center bg-zinc-900 p-0.5 rounded-xl border border-zinc-800 text-[11px]">
            {(["all", "equipment", "consumable", "tradegoods", "quest", "junk"] as const).map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2 py-0.5 rounded-lg font-bold capitalize transition-all cursor-pointer ${
                    activeCategory === cat
                      ? "bg-cyan-500 text-black shadow"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {cat === "all" ? "All" : cat === "tradegoods" ? "Trades" : cat}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* 2. Currencies Row */}
      {inventory?.currencies && inventory.currencies.length > 0 && (
        <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 shadow-sm flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-3">
            {inventory.currencies.map((curr) => (
              <div
                key={curr.id}
                className="flex items-center gap-2 px-2 py-1 rounded-lg bg-zinc-900/80 border border-zinc-800 shrink-0"
              >
                <img
                  src={curr.iconUrl}
                  alt={curr.name}
                  className="w-5 h-5 rounded border border-zinc-700 object-cover shadow"
                />
                <div className="min-w-0">
                  <span className="text-[10px] text-zinc-400 block truncate max-w-[100px]">
                    {curr.name}
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-300">
                    {curr.count.toLocaleString()}
                    {curr.max ? (
                      <span className="text-zinc-500 font-normal text-[10px]"> / {curr.max}</span>
                    ) : null}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. INVENTORY CONTAINER (Unified Compact Grid vs Split Bags) */}
      {viewMode === "unified" ? (
        /* UNIFIED ALL-IN-ONE COMPACT BAG */
        <div className="p-3.5 rounded-2xl bg-zinc-950/90 border border-zinc-800 shadow-xl">
          {/* Equipped Bags Bar Header */}
          <div className="flex items-center justify-between gap-3 mb-3 pb-2.5 border-b border-zinc-800/80">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Unified Bag
              </span>
              <span className="text-[10px] text-zinc-500">
                ({totalUsedSlots} items / {totalSlots} slots)
              </span>
            </div>

            {/* Mini Equipped Bags Icons */}
            <div className="flex items-center gap-1.5">
              {allContainers.map((bag, i) => {
                const used = bag.items.filter((it) => it !== null).length;
                return (
                  <div
                    key={bag.id}
                    title={`${bag.name} (${used}/${bag.slotCount})`}
                    className="relative group flex items-center"
                  >
                    <img
                      src={bag.iconUrl}
                      alt={bag.name}
                      className="w-6 h-6 rounded-md border border-zinc-700 object-cover"
                    />
                    <span className="absolute -bottom-1 -right-1 text-[8px] font-mono font-bold bg-zinc-950 px-0.5 rounded text-zinc-300 border border-zinc-800">
                      {used}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Compact Slot Grid (w-9 h-9 or w-10 h-10) */}
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 gap-1.5">
            {unifiedSlots.map((slotObj, idx) => {
              const item = slotObj.item;
              const matchesSearch =
                !searchTerm ||
                (item && item.name.toLowerCase().includes(searchTerm.toLowerCase()));
              const matchesCat =
                activeCategory === "all" || (item && item.itemType === activeCategory);
              const isDimmed = item && (!matchesSearch || !matchesCat);
              const quality = item ? getWoWItemQuality(item.quality) : null;

              return (
                <div
                  key={idx}
                  onMouseEnter={(e) => item && handleMouseEnter(item, e)}
                  onMouseLeave={handleMouseLeave}
                  className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-lg border transition-all flex items-center justify-center select-none ${
                    item
                      ? `${quality?.borderClass || "border-zinc-700"} ${
                          quality?.bgClass || "bg-zinc-900"
                        } ${
                          isDimmed
                            ? "opacity-25"
                            : "hover:scale-105 hover:z-10 hover:shadow-lg cursor-pointer"
                        }`
                      : "border-zinc-800/80 bg-zinc-900/40 opacity-50"
                  }`}
                >
                  {item ? (
                    <>
                      <img
                        src={item.iconUrl}
                        alt={item.name}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded object-cover"
                      />
                      {item.stackCount > 1 && (
                        <span className="absolute bottom-0.5 right-1 text-[10px] font-mono font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
                          {item.stackCount}
                        </span>
                      )}
                      {item.itemType === "quest" && (
                        <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
                      )}
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* SPLIT BAGS COMPACT VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {allContainers.map((container, bIdx) => {
            const used = container.items.filter((it) => it !== null).length;
            return (
              <div
                key={container.id}
                className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800 shadow-lg flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <img
                      src={container.iconUrl}
                      alt={container.name}
                      className="w-7 h-7 rounded-lg border border-zinc-700 object-cover shadow"
                    />
                    <div>
                      <h5 className="text-xs font-bold text-white tracking-wide truncate max-w-[140px]">
                        {container.name}
                      </h5>
                      <p className="text-[10px] text-zinc-400">
                        {bIdx === 0 ? "Backpack" : `Bag #${bIdx}`}
                      </p>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-900 text-zinc-300 border border-zinc-800">
                    {used} / {container.slotCount}
                  </span>
                </div>

                {/* Compact grid for individual bag */}
                <div className="grid grid-cols-4 sm:grid-cols-4 gap-1.5">
                  {container.items.map((item, sIdx) => {
                    const matchesSearch =
                      !searchTerm ||
                      (item && item.name.toLowerCase().includes(searchTerm.toLowerCase()));
                    const matchesCat =
                      activeCategory === "all" || (item && item.itemType === activeCategory);
                    const isDimmed = item && (!matchesSearch || !matchesCat);
                    const quality = item ? getWoWItemQuality(item.quality) : null;

                    return (
                      <div
                        key={sIdx}
                        onMouseEnter={(e) => item && handleMouseEnter(item, e)}
                        onMouseLeave={handleMouseLeave}
                        className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-lg border transition-all flex items-center justify-center select-none ${
                          item
                            ? `${quality?.borderClass || "border-zinc-700"} ${
                                quality?.bgClass || "bg-zinc-900"
                              } ${
                                isDimmed
                                  ? "opacity-25"
                                  : "hover:scale-105 hover:z-10 hover:shadow-lg cursor-pointer"
                              }`
                            : "border-zinc-800/80 bg-zinc-900/40 opacity-50"
                        }`}
                      >
                        {item ? (
                          <>
                            <img
                              src={item.iconUrl}
                              alt={item.name}
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded object-cover"
                            />
                            {item.stackCount > 1 && (
                              <span className="absolute bottom-0.5 right-1 text-[10px] font-mono font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
                                {item.stackCount}
                              </span>
                            )}
                          </>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Hover Item Tooltip (WoW-authentic floating box) */}
      {hoveredItem && (
        <div
          className="fixed z-50 pointer-events-auto p-3 rounded-xl bg-zinc-950/95 border-2 border-zinc-700 shadow-2xl text-xs max-w-xs space-y-1.5 backdrop-blur-md"
          style={{
            left: `${Math.min(hoveredItem.x, window.innerWidth - 320)}px`,
            top: `${Math.min(hoveredItem.y, window.innerHeight - 260)}px`,
          }}
          onMouseEnter={() => {
            if (itemLeaveTimeoutRef.current) {
              clearTimeout(itemLeaveTimeoutRef.current);
              itemLeaveTimeoutRef.current = null;
            }
          }}
          onMouseLeave={() => {
            itemLeaveTimeoutRef.current = setTimeout(() => {
              setHoveredItem(null);
            }, 250);
          }}
        >
          <div className="flex items-center gap-2">
            <img
              src={hoveredItem.item.iconUrl}
              alt=""
              className="w-8 h-8 rounded-lg border border-zinc-700 object-cover"
            />
            <div>
              <p
                className="font-bold text-sm tracking-wide"
                style={{
                  color: getWoWItemQuality(hoveredItem.item.quality).color,
                }}
              >
                {hoveredItem.item.name}
              </p>
              <p className="text-[11px] text-zinc-400 capitalize">
                {hoveredItem.item.itemType}
                {hoveredItem.item.itemSubType ? ` • ${hoveredItem.item.itemSubType}` : ""}
              </p>
            </div>
          </div>

          {hoveredItem.item.itemLevel && (
            <p className="text-amber-300 font-mono text-[11px]">
              Item Level {hoveredItem.item.itemLevel}
            </p>
          )}

          {hoveredItem.item.binding && (
            <p className="text-white text-[11px]">{hoveredItem.item.binding}</p>
          )}

          {hoveredItem.item.stats && hoveredItem.item.stats.length > 0 && (
            <div className="space-y-0.5 text-emerald-400 font-mono text-[11px]">
              {hoveredItem.item.stats.map((st, sI) => (
                <p key={sI}>{st}</p>
              ))}
            </div>
          )}

          {hoveredItem.item.useEffect && (
            <p className="text-emerald-400 text-[11px]">
              Use: {hoveredItem.item.useEffect}
            </p>
          )}

          {hoveredItem.item.description && (
            <p className="text-amber-200/90 italic text-[11px]">
              "{hoveredItem.item.description}"
            </p>
          )}

          {hoveredItem.item.sellPrice && (
            <div className="pt-1 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-400">
              <span>Sell Price:</span>
              <span className="font-mono text-zinc-300">
                {hoveredItem.item.sellPrice.gold > 0 && (
                  <span className="text-amber-400 font-bold mr-1">
                    {hoveredItem.item.sellPrice.gold}g
                  </span>
                )}
                {hoveredItem.item.sellPrice.silver > 0 && (
                  <span className="text-zinc-300 font-bold mr-1">
                    {hoveredItem.item.sellPrice.silver}s
                  </span>
                )}
                <span className="text-amber-700 font-bold">
                  {hoveredItem.item.sellPrice.copper}c
                </span>
              </span>
            </div>
          )}

          {/* Wowhead Shortcut Link */}
          <div className="pt-1.5 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400">
            <span className="font-mono text-[9px] text-zinc-500">ID #{hoveredItem.item.id}</span>
            <WowheadBadgeLink
              url={resolveWowheadUrl({ kind: "item", id: hoveredItem.item.id, version: profile.wow_version || profile.gameMode })}
              label="Ver no Wowhead"
              compact
            />
          </div>
        </div>
      )}
    </div>
  );
};
