/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Filter,
  Sparkles,
  Award,
  ArrowUpDown,
  ExternalLink,
  Eye,
  Shield,
  CheckCircle2,
  Lock,
  RotateCw,
  Play,
  Pause,
  X,
  Info,
  Layers,
  ChevronRight,
  Heart,
  Zap,
} from "lucide-react";
import {
  BlizzardCollectionPet,
  BlizzardProfileData,
} from "../types";
import {
  createWowPetViewer,
  ZamViewerInstance,
  notifyBlizzardCollectionItemChange,
  setBlizzardSelectedCollectionItem,
} from "../utils/wowModelEngine";
import {
  WOW_PET_ID_TO_DISPLAY,
  WOW_PET_NAME_TO_DISPLAY,
  WOW_PET_CREATURE_TO_SPECIES,
} from "../utils/blizzardMountDb";
import {
  findKnownPetDisplayId,
  enrichPetWithBlizzardMetadata,
} from "../utils/blizzardCollectionsCatalog";
import { fetchBattlePetSpeciesData, BattlePetSpeciesInfo } from "../utils/blizzardApi";
import {
  resolveWowheadUrl,
  getWowheadPetUrl,
  getWowheadPetAbilityUrl,
  WowheadBadgeLink,
} from "../utils/wowheadUrls";

export interface BattlePetSpeciesViewerProps {
  profile?: BlizzardProfileData;
  pets?: BlizzardCollectionPet[];
  activeCharacterName?: string;
  activeCharacterRealm?: string;
  onClose?: () => void;
  className?: string;
  isEmbedded?: boolean;
}

const PET_FAMILIES = [
  "All",
  "Humanoid",
  "Dragonkin",
  "Flying",
  "Undead",
  "Critter",
  "Magic",
  "Elemental",
  "Beast",
  "Aquatic",
  "Mechanical",
];

const QUALITY_COLORS: Record<string, { border: string; text: string; bg: string }> = {
  POOR: { border: "border-zinc-500/50", text: "text-zinc-400", bg: "bg-zinc-800/40" },
  COMMON: { border: "border-zinc-300/60", text: "text-zinc-200", bg: "bg-zinc-800/40" },
  UNCOMMON: { border: "border-emerald-500/60", text: "text-emerald-400", bg: "bg-emerald-950/30" },
  RARE: { border: "border-cyan-500/60", text: "text-cyan-400", bg: "bg-cyan-950/30" },
  EPIC: { border: "border-purple-500/60", text: "text-purple-400", bg: "bg-purple-950/30" },
  LEGENDARY: { border: "border-amber-500/60", text: "text-amber-400", bg: "bg-amber-950/30" },
};

export const BattlePetSpeciesViewer: React.FC<BattlePetSpeciesViewerProps> = ({
  profile,
  pets: externalPets,
  activeCharacterName,
  activeCharacterRealm,
  onClose,
  className = "",
  isEmbedded = false,
}) => {
  // Source pets from profile or props
  const rawPets = useMemo(() => {
    if (externalPets && externalPets.length > 0) return externalPets;
    if (profile?.collections?.pets && profile.collections.pets.length > 0) {
      return profile.collections.pets;
    }
    return [];
  }, [externalPets, profile?.collections?.pets]);

  // Filters and sorting state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFamily, setSelectedFamily] = useState("All");
  const [selectedQuality, setSelectedQuality] = useState("All");
  const [collectionStatus, setCollectionStatus] = useState<"all" | "collected" | "not_collected">("all");
  const [sortBy, setSortBy] = useState<
    "name_asc" | "name_desc" | "level_desc" | "level_asc" | "rarity_desc" | "species_asc" | "unlock_recent"
  >("rarity_desc");

  // Selected Pet for 3D inspection modal
  const [inspectingPet, setInspectingPet] = useState<BlizzardCollectionPet | null>(null);
  const [inspectingSpeciesData, setInspectingSpeciesData] = useState<BattlePetSpeciesInfo | null>(null);
  const [isLoadingSpeciesData, setIsLoadingSpeciesData] = useState(false);

  // 3D Viewer inside inspect modal
  const viewerMountRef = useRef<HTMLDivElement>(null);
  const viewerInstanceRef = useRef<ZamViewerInstance | null>(null);
  const [isViewerLoading, setIsViewerLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Fetch species info when inspecting
  useEffect(() => {
    if (!inspectingPet) {
      setInspectingSpeciesData(null);
      return;
    }
    const speciesId = inspectingPet.speciesId || (inspectingPet.id < 100000 ? inspectingPet.id : 0);
    if (speciesId > 0) {
      setIsLoadingSpeciesData(true);
      fetchBattlePetSpeciesData(speciesId)
        .then((data) => {
          setInspectingSpeciesData(data);
        })
        .finally(() => {
          setIsLoadingSpeciesData(false);
        });
    }
  }, [inspectingPet]);

  // Filter and sort pets
  const filteredAndSortedPets = useMemo(() => {
    const list = [...rawPets];
    const searchLower = searchTerm.trim().toLowerCase();

    const filtered = list.filter((pet) => {
      if (!pet) return false;

      // Character-specific check: if pet is specific to a character and a character is active, only show if it matches
      if (pet.isCharacterSpecific && pet.characterName && activeCharacterName) {
        if (pet.characterName.toLowerCase() !== activeCharacterName.toLowerCase()) {
          return false;
        }
      }

      // Search matching (by name, speciesId, family, or source)
      const pName = (pet.name || "").toLowerCase();
      const pFamily = (pet.family || "").toLowerCase();
      const pSource = (pet.source || "").toLowerCase();
      const pSpeciesStr = String(pet.speciesId || pet.id || "");

      const matchesSearch =
        !searchLower ||
        pName.includes(searchLower) ||
        pFamily.includes(searchLower) ||
        pSource.includes(searchLower) ||
        pSpeciesStr === searchLower ||
        pSpeciesStr.includes(searchLower);

      if (!matchesSearch) return false;

      // Family filter
      if (selectedFamily !== "All") {
        if (pFamily !== selectedFamily.toLowerCase()) return false;
      }

      // Quality filter
      if (selectedQuality !== "All") {
        const qUpper = (pet.quality || "RARE").toUpperCase();
        if (qUpper !== selectedQuality.toUpperCase()) return false;
      }

      // Collection status filter
      if (collectionStatus === "collected" && !pet.isCollected) return false;
      if (collectionStatus === "not_collected" && pet.isCollected) return false;

      return true;
    });

    // Sorting
    return filtered.sort((a, b) => {
      // Favorites always float to top if marked
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;

      switch (sortBy) {
        case "name_asc":
          return (a.name || "").localeCompare(b.name || "");
        case "name_desc":
          return (b.name || "").localeCompare(a.name || "");
        case "level_desc":
          return (b.level || 1) - (a.level || 1);
        case "level_asc":
          return (a.level || 1) - (b.level || 1);
        case "species_asc": {
          const sA = a.speciesId || a.id || 0;
          const sB = b.speciesId || b.id || 0;
          return sA - sB;
        }
        case "unlock_recent": {
          const ordA = a.unlockOrder !== undefined ? a.unlockOrder : 0;
          const ordB = b.unlockOrder !== undefined ? b.unlockOrder : 0;
          return ordB - ordA;
        }
        case "rarity_desc":
        default: {
          const order: Record<string, number> = {
            LEGENDARY: 6,
            EPIC: 5,
            RARE: 4,
            UNCOMMON: 3,
            COMMON: 2,
            POOR: 1,
          };
          const rA = order[(a.quality || "RARE").toUpperCase()] || 0;
          const rB = order[(b.quality || "RARE").toUpperCase()] || 0;
          if (rB !== rA) return rB - rA;
          return (b.level || 1) - (a.level || 1);
        }
      }
    });
  }, [
    rawPets,
    searchTerm,
    selectedFamily,
    selectedQuality,
    collectionStatus,
    sortBy,
    activeCharacterName,
  ]);

  // Statistics
  const stats = useMemo(() => {
    const total = rawPets.length;
    const collected = rawPets.filter((p) => p.isCollected).length;
    const maxLevel = rawPets.filter((p) => p.level === 25).length;
    const rareCount = rawPets.filter(
      (p) => (p.quality || "").toUpperCase() === "RARE" || (p.quality || "").toUpperCase() === "EPIC"
    ).length;
    return { total, collected, maxLevel, rareCount };
  }, [rawPets]);

  // Initialize 3D model viewer when modal opens
  useEffect(() => {
    if (!inspectingPet || !viewerMountRef.current) return;

    let isSubscribed = true;
    setIsViewerLoading(true);

    const targetDiv = viewerMountRef.current;
    const speciesId = inspectingPet.speciesId || inspectingPet.id;
    const petKey = `pet_species_${speciesId}_${inspectingPet.name || ""}`;

    notifyBlizzardCollectionItemChange(petKey, targetDiv);

    const displayId =
      inspectingPet.creatureDisplayId ||
      findKnownPetDisplayId(speciesId, inspectingPet.name) ||
      (speciesId && WOW_PET_ID_TO_DISPLAY[speciesId]) ||
      28917;

    setBlizzardSelectedCollectionItem({
      type: "pet",
      id: speciesId,
      creatureDisplayId: displayId,
      name: inspectingPet.name,
    });

    createWowPetViewer(targetDiv, displayId, 1.4)
      .then((viewer) => {
        if (!isSubscribed) {
          viewer?.destroy?.();
          return;
        }
        viewerInstanceRef.current = viewer;
      })
      .catch((err) => {
        console.warn("Could not create 3D pet viewer:", err);
      })
      .finally(() => {
        if (isSubscribed) setIsViewerLoading(false);
      });

    return () => {
      isSubscribed = false;
      if (viewerInstanceRef.current) {
        try {
          viewerInstanceRef.current.destroy?.();
        } catch (_) {}
        viewerInstanceRef.current = null;
      }
    };
  }, [inspectingPet]);

  const togglePause = useCallback(() => {
    if (!viewerInstanceRef.current) return;
    try {
      if (isPaused) {
        viewerInstanceRef.current.play?.();
        setIsPaused(false);
      } else {
        viewerInstanceRef.current.pause?.();
        setIsPaused(true);
      }
    } catch (_) {}
  }, [isPaused]);

  return (
    <div
      className={`bg-zinc-950/95 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col ${className} ${
        isEmbedded ? "p-4" : "p-6"
      }`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">
                BattlePetSpecies Browser
              </h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
                DB2 & Wowhead Resolving
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Coleção precisa de mascotes sincronizada com a Battle.net
              {activeCharacterName ? ` para ${activeCharacterName}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Stat Badges */}
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
              Desbloqueados: <strong className="text-cyan-400">{stats.collected}</strong> / {stats.total}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-amber-300">
              Nv. 25: <strong>{stats.maxLevel}</strong>
            </span>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title="Fechar Mascotes"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="py-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar mascote por nome, ID de espécie, família ou fonte..."
              className="w-full pl-9 pr-3 py-2 bg-zinc-900/90 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 bg-zinc-900/90 border border-zinc-800 rounded-xl px-2.5 py-1.5">
            <ArrowUpDown size={14} className="text-cyan-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="rarity_desc" className="bg-zinc-900 text-white">
                Raridade / Qualidade
              </option>
              <option value="level_desc" className="bg-zinc-900 text-white">
                Nível (25 → 1)
              </option>
              <option value="level_asc" className="bg-zinc-900 text-white">
                Nível (1 → 25)
              </option>
              <option value="name_asc" className="bg-zinc-900 text-white">
                Alfabética (A-Z)
              </option>
              <option value="name_desc" className="bg-zinc-900 text-white">
                Alfabética (Z-A)
              </option>
              <option value="species_asc" className="bg-zinc-900 text-white">
                ID da Espécie (Crescente)
              </option>
              <option value="unlock_recent" className="bg-zinc-900 text-white">
                Ordem de Desbloqueio
              </option>
            </select>
          </div>

          {/* Collection Status Toggle */}
          <div className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setCollectionStatus("all")}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                collectionStatus === "all"
                  ? "bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Todos ({rawPets.length})
            </button>
            <button
              onClick={() => setCollectionStatus("collected")}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                collectionStatus === "collected"
                  ? "bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Desbloqueados ({stats.collected})
            </button>
          </div>
        </div>

        {/* Family Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-zinc-800">
          {PET_FAMILIES.map((family) => {
            const isSelected = selectedFamily === family;
            return (
              <button
                key={family}
                onClick={() => setSelectedFamily(family)}
                className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap transition-all ${
                  isSelected
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold shadow-sm"
                    : "bg-zinc-900/70 border border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                }`}
              >
                {family === "All" ? "Todas Famílias" : family}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mascot Species Grid */}
      <div className="flex-1 overflow-y-auto min-h-[340px] max-h-[580px] pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
        {filteredAndSortedPets.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-zinc-800 rounded-xl">
            <Info size={28} className="text-zinc-600 mb-2" />
            <p className="text-sm font-semibold text-zinc-300">Nenhum mascote encontrado</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm">
              Tente alterar os filtros de busca, família ou verificar se a conta Battle.net possui mascotes desta categoria.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {filteredAndSortedPets.map((pet, idx) => {
              const speciesId = pet.speciesId || (pet.id < 100000 ? pet.id : undefined);
              const qStyle = QUALITY_COLORS[(pet.quality || "RARE").toUpperCase()] || QUALITY_COLORS.RARE;
              const displayId =
                pet.creatureDisplayId ||
                (speciesId && WOW_PET_ID_TO_DISPLAY[speciesId]) ||
                findKnownPetDisplayId(speciesId, pet.name) ||
                28917;

              return (
                <div
                  key={`${pet.id}-${speciesId}-${idx}`}
                  onClick={() => setInspectingPet(pet)}
                  className={`group relative p-2.5 rounded-xl bg-zinc-900/80 border ${qStyle.border} hover:border-cyan-400/80 hover:bg-zinc-900 transition-all cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-cyan-950/20`}
                >
                  {/* Top Row: Icon + Name + Badges */}
                  <div className="flex items-start gap-2.5">
                    {/* Pet Icon */}
                    <div className="relative w-12 h-12 rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                      <img
                        src={pet.iconUrl || "https://render.worldofwarcraft.com/us/icons/56/inv_misc_monsterclaw_04.jpg"}
                        alt={pet.name}
                        onError={(e) => {
                          e.currentTarget.src =
                            "https://render.worldofwarcraft.com/us/icons/56/inv_misc_monsterclaw_04.jpg";
                        }}
                        className="w-full h-full object-cover rounded-xl"
                        loading="lazy"
                      />
                      {pet.level !== undefined && (
                        <span className="absolute bottom-0 right-0 bg-black/80 text-amber-300 font-mono font-bold text-[9px] px-1 rounded-tl-md border-t border-l border-zinc-800">
                          {pet.level}
                        </span>
                      )}
                    </div>

                    {/* Pet Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className={`text-xs font-bold truncate ${qStyle.text} group-hover:text-cyan-300 transition-colors`}>
                          {pet.name}
                        </h4>
                        {pet.isFavorite && (
                          <span className="text-amber-400 text-xs shrink-0" title="Favorito">
                            ★
                          </span>
                        )}
                      </div>

                      {/* Species ID & Family */}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {speciesId && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/60">
                            ID: {speciesId}
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800/60 text-zinc-300">
                          {pet.family || "Beast"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: Source & Character Specific Indicator */}
                  <div className="mt-2 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-400">
                    <span className="truncate max-w-[140px] text-zinc-500" title={pet.source}>
                      {pet.source || "Coleção de Mascotes"}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {pet.isCharacterSpecific && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] bg-amber-950/60 text-amber-300 border border-amber-500/40 font-mono"
                          title={`Específico de ${pet.characterName || "personagem"}`}
                        >
                          {pet.characterName || "Personagem"}
                        </span>
                      )}

                      <WowheadBadgeLink
                        url={getWowheadPetUrl(pet.id, pet.speciesId, undefined, pet.itemId, pet.name)}
                        label="Wowhead"
                        compact
                      />

                      <span className="text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 font-semibold">
                        <Eye size={11} /> 3D
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inspecting 3D Mascot Modal */}
      {inspectingPet && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-zinc-950 border border-cyan-500/30 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800/80 bg-zinc-900/60">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-700 overflow-hidden shrink-0">
                  <img
                    src={inspectingPet.iconUrl || "https://render.worldofwarcraft.com/us/icons/56/inv_misc_monsterclaw_04.jpg"}
                    alt={inspectingPet.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">
                      {inspectingPet.name}
                    </h3>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        QUALITY_COLORS[(inspectingPet.quality || "RARE").toUpperCase()]?.border || "border-cyan-500/40"
                      } ${
                        QUALITY_COLORS[(inspectingPet.quality || "RARE").toUpperCase()]?.text || "text-cyan-300"
                      }`}
                    >
                      {inspectingPet.quality || "Rare"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                    <span>Família: <strong className="text-zinc-200">{inspectingPet.family || "Beast"}</strong></span>
                    <span>•</span>
                    <span>Nível: <strong className="text-amber-300">{inspectingPet.level || 25}</strong></span>
                    {inspectingPet.speciesId && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-zinc-500">Species ID #{inspectingPet.speciesId}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {inspectingPet.speciesId && (
                  <a
                    href={resolveWowheadUrl({
                      kind: "pet",
                      id: inspectingPet.speciesId,
                      speciesId: inspectingPet.speciesId,
                      creatureId: inspectingPet.creatureId || inspectingSpeciesData?.creatureId,
                      name: inspectingPet.name,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-cyan-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
                    title="Ver no Wowhead"
                  >
                    <ExternalLink size={14} /> Wowhead
                  </a>
                )}
                <button
                  onClick={() => setInspectingPet(null)}
                  className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* 3D Model Viewer Canvas Container */}
            <div className="relative w-full h-80 bg-radial from-zinc-900 via-zinc-950 to-black border-b border-zinc-800 flex items-center justify-center overflow-hidden">
              <div
                ref={viewerMountRef}
                className="w-full h-full flex items-center justify-center"
                data-wow-pet-viewer="true"
              />

              {isViewerLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm gap-2 text-cyan-400">
                  <RotateCw size={24} className="animate-spin" />
                  <span className="text-xs font-mono">Renderizando Modelo 3D...</span>
                </div>
              )}

              {/* Viewer Controls */}
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-zinc-800 text-xs">
                <button
                  onClick={togglePause}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
                  title={isPaused ? "Retomar" : "Pausar"}
                >
                  {isPaused ? <Play size={14} /> : <Pause size={14} />}
                </button>
                <span className="text-[10px] font-mono text-zinc-500">
                  Display #{inspectingPet.creatureDisplayId || (inspectingPet.speciesId && WOW_PET_ID_TO_DISPLAY[inspectingPet.speciesId]) || 28917}
                </span>
              </div>
            </div>

            {/* Mascot Details & Lore */}
            <div className="p-4 space-y-3 overflow-y-auto text-xs">
              {inspectingSpeciesData?.description && (
                <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-zinc-300 italic">
                  "{inspectingSpeciesData.description}"
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800">
                  <span className="text-zinc-500 text-[11px] block">Origem / Fonte:</span>
                  <span className="text-zinc-200 font-semibold mt-0.5 block">
                    {inspectingSpeciesData?.source || inspectingPet.source || "World of Warcraft"}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800">
                  <span className="text-zinc-500 text-[11px] block">Status na Conta:</span>
                  <span className="text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                    <CheckCircle2 size={13} /> Desbloqueado na Battle.net
                  </span>
                </div>
              </div>

              {/* Combat Stats if available */}
              {inspectingPet.stats && (
                <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                  <span className="text-zinc-400 font-bold block mb-2">Atributos de Combate:</span>
                  <div className="grid grid-cols-3 gap-2 font-mono text-center">
                    <div className="p-1.5 rounded bg-zinc-950 border border-zinc-800 text-emerald-300">
                      <span className="text-[10px] text-zinc-500 block">Vida</span>
                      <strong>{inspectingPet.stats.health || "1,500"}</strong>
                    </div>
                    <div className="p-1.5 rounded bg-zinc-950 border border-zinc-800 text-amber-300">
                      <span className="text-[10px] text-zinc-500 block">Poder</span>
                      <strong>{inspectingPet.stats.power || "290"}</strong>
                    </div>
                    <div className="p-1.5 rounded bg-zinc-950 border border-zinc-800 text-cyan-300">
                      <span className="text-[10px] text-zinc-500 block">Velocidade</span>
                      <strong>{inspectingPet.stats.speed || "290"}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Abilities */}
              {inspectingPet.abilities && inspectingPet.abilities.length > 0 && (
                <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                  <span className="text-zinc-400 font-bold block mb-2">Habilidades de Mascote:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {inspectingPet.abilities.map((ability, aIdx) => (
                      <a
                        key={aIdx}
                        href={getWowheadPetAbilityUrl(ability)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 hover:text-cyan-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Ver habilidade no Wowhead"
                      >
                        <span>{ability}</span>
                        <ExternalLink size={10} className="opacity-60" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Footer Wowhead Link */}
              <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-zinc-500 font-mono text-[11px]">
                  ID: #{inspectingPet.id} • Species: #{inspectingPet.speciesId || inspectingPet.id}
                </span>
                <WowheadBadgeLink
                  url={getWowheadPetUrl(inspectingPet.id, inspectingPet.speciesId, undefined, inspectingPet.itemId, inspectingPet.name, inspectingPet.creatureId || inspectingSpeciesData?.creatureId)}
                  label="Abrir no Wowhead"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BattlePetSpeciesViewer;
