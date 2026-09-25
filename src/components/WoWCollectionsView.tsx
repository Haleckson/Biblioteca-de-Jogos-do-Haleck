/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Compass,
  Star,
  Search,
  Sparkles,
  Award,
  Filter,
  CheckCircle2,
  Lock,
  RotateCw,
  Play,
  Pause,
  ExternalLink,
  Shield,
  Eye,
  Info,
  AlertCircle,
  ArrowUpDown,
} from "lucide-react";
import {
  BlizzardProfileData,
  BlizzardCollectionMount,
  BlizzardCollectionToy,
  BlizzardCollectionPet,
  BlizzardCollectionTitle,
} from "../types";
import {
  createWowMountViewer,
  createWowPetViewer,
  ZamViewerInstance,
  notifyBlizzardCollectionItemChange,
  disposeContainerWebGLContext,
  setBlizzardSelectedCollectionItem,
} from "../utils/wowModelEngine";
import { generateWoWCharacterProfile } from "../utils/blizzardCharacterData";
import {
  getMountDisplayId,
  getPetDisplayId,
  findKnownMountDisplayId,
  findKnownPetDisplayId,
} from "../utils/blizzardCollectionsCatalog";
import {
  getCachedDisplayId,
  setCachedDisplayId,
} from "../utils/blizzardAssetCache";
import BattlePetSpeciesViewer from "./BattlePetSpeciesViewer";
import {
  resolveWowheadUrl,
  getWowheadMountUrl,
  getWowheadPetUrl,
  getWowheadToyUrl,
  getWowheadTitleUrl,
  getWowheadPetAbilityUrl,
  WowheadBadgeLink,
} from "../utils/wowheadUrls";

interface WoWCollectionsViewProps {
  profile: BlizzardProfileData;
  gameVersion?: string;
  activeCharacterName?: string;
  activeCharacterRealm?: string;
}

export const WoWCollectionsView: React.FC<WoWCollectionsViewProps> = ({
  profile,
  gameVersion,
  activeCharacterName,
  activeCharacterRealm,
}) => {
  const resolvedVersion = useMemo(() => {
    const raw = (gameVersion || profile.wow_version || profile.gameMode || "retail").toLowerCase();
    if (raw.includes("forever") || raw.includes("vanilla+")) return "forever";
    if (raw.includes("mop") || raw.includes("pandaria")) return "mop";
    if (raw.includes("tbc") || raw.includes("burning") || raw.includes("crusade")) return "tbc";
    if (raw.includes("classic") || raw.includes("era") || raw.includes("vanilla")) return "classic";
    return "retail";
  }, [gameVersion, profile.wow_version, profile.gameMode]);

  // In Mists of Pandaria, the collections window was limited to Mounts and Battle Pets (Toys came in WoD, Titles were in character sheet)
  const isMoP = resolvedVersion === "mop";

  const [activeTab, setActiveTab] = useState<"mounts" | "toys" | "pets" | "titles">("mounts");

  // Switch tab away from unsupported sub-tabs in MoP
  useEffect(() => {
    if (isMoP && (activeTab === "toys" || activeTab === "titles")) {
      setActiveTab("mounts");
    }
  }, [isMoP, activeTab]);

  const [searchTerm, setSearchTerm] = useState("");
  const [collectionStatusFilter, setCollectionStatusFilter] = useState<"all" | "collected" | "not_collected">("all");
  const [mountFilter, setMountFilter] = useState<"all" | "ground" | "flying" | "dragonriding" | "favorite">("all");
  const [petFamilyFilter, setPetFamilyFilter] = useState<string>("all");

  // Sorting state for mounts and pets
  const [mountSortBy, setMountSortBy] = useState<
    "name_asc" | "name_desc" | "unlock_recent" | "unlock_oldest" | "rarity" | "type"
  >("name_asc");
  const [petSortBy, setPetSortBy] = useState<
    "name_asc" | "name_desc" | "level_desc" | "level_asc" | "rarity_desc" | "unlock_recent" | "unlock_oldest" | "family"
  >("level_desc");

  // BattlePetSpecies browser modal state
  const [showSpeciesBrowser, setShowSpeciesBrowser] = useState(false);

  // Hover states for rich tooltips
  const [hoveredMount, setHoveredMount] = useState<{
    mount: BlizzardCollectionMount;
    x: number;
    y: number;
  } | null>(null);

  const [hoveredPet, setHoveredPet] = useState<{
    pet: BlizzardCollectionPet;
    x: number;
    y: number;
  } | null>(null);

  const mountLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const petLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (mountLeaveTimeoutRef.current) clearTimeout(mountLeaveTimeoutRef.current);
      if (petLeaveTimeoutRef.current) clearTimeout(petLeaveTimeoutRef.current);
    };
  }, []);

  // Helper to format unlock date or account acquisition info
  const formatUnlockInfo = (
    unlockedAt?: number | string,
    unlockOrder?: number,
    isCharacterSpecific?: boolean,
    characterName?: string
  ) => {
    if (typeof unlockedAt === "number" && unlockedAt > 100000000) {
      const d = new Date(unlockedAt > 10000000000 ? unlockedAt : unlockedAt * 1000);
      return `Desbloqueado em: ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;
    }
    if (typeof unlockedAt === "string" && unlockedAt.length > 4) {
      return `Desbloqueado em: ${unlockedAt}`;
    }
    if (unlockOrder !== undefined) {
      return `Desbloqueado na conta (#${unlockOrder + 1})`;
    }
    if (isCharacterSpecific && characterName) {
      return `Exclusivo do personagem: ${characterName}`;
    }
    return "Desbloqueado na conta Battle.net";
  };

  const collections = useMemo(() => {
    if (profile.collections && ((profile.collections.mounts && profile.collections.mounts.length > 0) || (profile.collections.pets && profile.collections.pets.length > 0))) {
      return profile.collections;
    }
    const gen = generateWoWCharacterProfile({
      name: profile.name,
      realm: profile.realm,
      characterClass: profile.characterClass,
      race: profile.race,
      level: profile.level,
      gender: profile.gender,
      faction: profile.faction,
      gameMode: resolvedVersion,
    });
    return gen.collections || { mounts: [], pets: [], toys: [], titles: [] };
  }, [profile, resolvedVersion]);

  // Selected item for 3D preview
  const [selectedMount, setSelectedMount] = useState<BlizzardCollectionMount | null>(
    collections?.mounts?.[0] || null
  );
  const [selectedPet, setSelectedPet] = useState<BlizzardCollectionPet | null>(
    collections?.pets?.[0] || null
  );

  // Sync selected item when collections update
  useEffect(() => {
    if (collections?.mounts?.length && !selectedMount) {
      setSelectedMount(collections.mounts[0]);
    }
  }, [collections?.mounts, selectedMount]);

  useEffect(() => {
    if (collections?.pets?.length && !selectedPet) {
      setSelectedPet(collections.pets[0]);
    }
  }, [collections?.pets, selectedPet]);

  // 3D Viewer Container Separate Refs & Instance
  const mountViewerMountRef = useRef<HTMLDivElement>(null);
  const petViewerMountRef = useRef<HTMLDivElement>(null);
  const viewerInstanceRef = useRef<ZamViewerInstance | null>(null);
  const animTimerRef = useRef<any>(null);
  const [isViewerLoading, setIsViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [cameraAngle, setCameraAngle] = useState(0);

  // Filtered and Sorted Mounts with character-specific check
  const filteredMounts = useMemo(() => {
    const list = collections?.mounts || [];
    const searchLower = (searchTerm || "").toLowerCase().trim();

    const filtered = list.filter((m) => {
      if (!m) return false;

      // Character-specific check: if mount is specific to a character and a character is active, only show if it matches
      if (m.isCharacterSpecific && m.characterName && activeCharacterName) {
        if (m.characterName.toLowerCase() !== activeCharacterName.toLowerCase()) {
          return false;
        }
      }

      const mName = (m.name || "").toLowerCase();
      const mSource = (m.source || "").toLowerCase();
      const matchesSearch =
        !searchLower ||
        mName.includes(searchLower) ||
        mSource.includes(searchLower);
      const matchesType =
        mountFilter === "all" ||
        (mountFilter === "favorite" ? !!m.isFavorite : m.mountType === mountFilter);
      const matchesStatus =
        collectionStatusFilter === "all" ||
        (collectionStatusFilter === "collected" ? !!m.isCollected : !m.isCollected);
      return matchesSearch && matchesType && matchesStatus;
    });

    return filtered.sort((a, b) => {
      // Pinned favorites
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;

      switch (mountSortBy) {
        case "name_asc":
          return (a.name || "").localeCompare(b.name || "");
        case "name_desc":
          return (b.name || "").localeCompare(a.name || "");
        case "unlock_recent": {
          const uA = a.unlockOrder !== undefined ? a.unlockOrder : 0;
          const uB = b.unlockOrder !== undefined ? b.unlockOrder : 0;
          return uB - uA;
        }
        case "unlock_oldest": {
          const uA = a.unlockOrder !== undefined ? a.unlockOrder : 0;
          const uB = b.unlockOrder !== undefined ? b.unlockOrder : 0;
          return uA - uB;
        }
        case "type":
        case "rarity": {
          const typeWeight: Record<string, number> = {
            dragonriding: 4,
            flying: 3,
            ground: 2,
            aquatic: 1,
          };
          const tA = typeWeight[a.mountType] || 0;
          const tB = typeWeight[b.mountType] || 0;
          if (tB !== tA) return tB - tA;
          return (a.name || "").localeCompare(b.name || "");
        }
        default:
          return (a.name || "").localeCompare(b.name || "");
      }
    });
  }, [collections?.mounts, searchTerm, mountFilter, collectionStatusFilter, mountSortBy, activeCharacterName]);

  // Filtered Toys with null-safe checks
  const filteredToys = useMemo(() => {
    const list = collections?.toys || [];
    const searchLower = (searchTerm || "").toLowerCase().trim();
    return list.filter((t) => {
      if (!t) return false;
      const tName = (t.name || "").toLowerCase();
      const tDesc = (t.description || "").toLowerCase();
      const matchesSearch =
        !searchLower ||
        tName.includes(searchLower) ||
        tDesc.includes(searchLower);
      const matchesStatus =
        collectionStatusFilter === "all" ||
        (collectionStatusFilter === "collected" ? !!t.isCollected : !t.isCollected);
      return matchesSearch && matchesStatus;
    });
  }, [collections?.toys, searchTerm, collectionStatusFilter]);

  // Filtered and Sorted Pets with character-specific check
  const filteredPets = useMemo(() => {
    const list = collections?.pets || [];
    const searchLower = (searchTerm || "").toLowerCase().trim();

    const filtered = list.filter((p) => {
      if (!p) return false;

      // Character-specific check: if pet is specific to a character and a character is active, only show if it matches
      if (p.isCharacterSpecific && p.characterName && activeCharacterName) {
        if (p.characterName.toLowerCase() !== activeCharacterName.toLowerCase()) {
          return false;
        }
      }

      const pName = (p.name || "").toLowerCase();
      const pFamily = (p.family || "").toLowerCase();
      const pSource = (p.source || "").toLowerCase();
      const pSpeciesStr = String(p.speciesId || p.id || "");

      const matchesSearch =
        !searchLower ||
        pName.includes(searchLower) ||
        pFamily.includes(searchLower) ||
        pSource.includes(searchLower) ||
        pSpeciesStr === searchLower ||
        pSpeciesStr.includes(searchLower);
      const matchesFamily =
        petFamilyFilter === "all" || pFamily === petFamilyFilter.toLowerCase();
      const matchesStatus =
        collectionStatusFilter === "all" ||
        (collectionStatusFilter === "collected" ? !!p.isCollected : !p.isCollected);
      return matchesSearch && matchesFamily && matchesStatus;
    });

    return filtered.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;

      switch (petSortBy) {
        case "name_asc":
          return (a.name || "").localeCompare(b.name || "");
        case "name_desc":
          return (b.name || "").localeCompare(a.name || "");
        case "level_desc":
          return (b.level || 1) - (a.level || 1);
        case "level_asc":
          return (a.level || 1) - (b.level || 1);
        case "family":
          return (a.family || "").localeCompare(b.family || "");
        case "unlock_recent": {
          const uA = a.unlockOrder !== undefined ? a.unlockOrder : 0;
          const uB = b.unlockOrder !== undefined ? b.unlockOrder : 0;
          return uB - uA;
        }
        case "unlock_oldest": {
          const uA = a.unlockOrder !== undefined ? a.unlockOrder : 0;
          const uB = b.unlockOrder !== undefined ? b.unlockOrder : 0;
          return uA - uB;
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
          const qA = order[(a.quality || "RARE").toUpperCase()] || 0;
          const qB = order[(b.quality || "RARE").toUpperCase()] || 0;
          if (qB !== qA) return qB - qA;
          return (b.level || 1) - (a.level || 1);
        }
      }
    });
  }, [collections?.pets, searchTerm, petFamilyFilter, collectionStatusFilter, petSortBy, activeCharacterName]);

  // Filtered Titles with null-safe checks
  const filteredTitles = useMemo(() => {
    const list = collections?.titles || [];
    const searchLower = (searchTerm || "").toLowerCase().trim();
    return list.filter((t) => {
      if (!t) return false;
      const tName = (t.name || "").toLowerCase();
      const tSource = (t.source || "").toLowerCase();
      const matchesSearch =
        !searchLower ||
        tName.includes(searchLower) ||
        tSource.includes(searchLower);
      const matchesStatus =
        collectionStatusFilter === "all" ||
        (collectionStatusFilter === "collected" ? !!t.isCollected : !t.isCollected);
      return matchesSearch && matchesStatus;
    });
  }, [collections?.titles, searchTerm, collectionStatusFilter]);

  // Total statistics for counts
  const mountStats = useMemo(() => {
    const list = collections?.mounts || [];
    const collected = list.filter((m) => m && m.isCollected).length;
    return { collected, total: list.length };
  }, [collections?.mounts]);

  const toyStats = useMemo(() => {
    const list = collections?.toys || [];
    const collected = list.filter((t) => t && t.isCollected).length;
    return { collected, total: list.length };
  }, [collections?.toys]);

  const petStats = useMemo(() => {
    const list = collections?.pets || [];
    const collected = list.filter((p) => p && p.isCollected).length;
    return { collected, total: list.length };
  }, [collections?.pets]);

  // Initialize Mount or Pet 3D Viewer when selection changes
  const initModelViewer = useCallback(
    async (
      targetDiv: HTMLDivElement | null,
      creatureDisplayId?: number,
      id?: number,
      type: "mount" | "pet" = "mount",
      name?: string
    ) => {
      if (!targetDiv) return;
      setIsViewerLoading(true);
      setViewerError(null);

      // Force cleanup and notification of collection selection change
      const itemKey = `${type}_${id || 0}_${name || ""}`;
      notifyBlizzardCollectionItemChange(itemKey, targetDiv);
      setBlizzardSelectedCollectionItem({
        type,
        id,
        creatureDisplayId,
        name,
      });

      if (viewerInstanceRef.current) {
        try {
          viewerInstanceRef.current.destroy?.();
        } catch (_) {}
        viewerInstanceRef.current = null;
      }

      try {
        let resolvedDisplayId: number | undefined;

        // 1. Authoritative curated DB check (guaranteed accurate mappings for known mounts & pets)
        const authoritative =
          type === "mount"
            ? findKnownMountDisplayId(id, name)
            : findKnownPetDisplayId(id, name);

        if (authoritative && authoritative > 0) {
          resolvedDisplayId = authoritative;
        }

        // 2. Authoritative creatureDisplayId directly from Blizzard API
        if (!resolvedDisplayId && creatureDisplayId && creatureDisplayId > 0) {
          resolvedDisplayId = creatureDisplayId;
        }

        // 3. Check IndexedDB Persistent Cache (L1 Memory + L2 Storage)
        if (!resolvedDisplayId && id) {
          const cachedId = await getCachedDisplayId(type, id);
          if (cachedId && cachedId > 0 && cachedId !== id) {
            resolvedDisplayId = cachedId;
          }
        }
        if (!resolvedDisplayId && name) {
          const cachedName = await getCachedDisplayId(type, name);
          if (cachedName && cachedName > 0) {
            resolvedDisplayId = cachedName;
          }
        }

        // 4. Try server-side API proxy to get displayId from Blizzard static API if still missing
        if (!resolvedDisplayId && (id || name)) {
          try {
            const query = new URLSearchParams({
              type,
              id: String(id || 0),
              name: name || "",
            });
            const res = await fetch(`/api/blizzard/creature-display?${query.toString()}`);
            if (res.ok) {
              const data = await res.json();
              if (data?.creatureDisplayId && data.creatureDisplayId > 0) {
                resolvedDisplayId = data.creatureDisplayId;
              }
            }
          } catch (e) {
            console.warn("Could not fetch remote creature display id:", e);
          }
        }

        // 5. High-fidelity baseline fallback if completely unresolved
        if (!resolvedDisplayId || resolvedDisplayId <= 0) {
          resolvedDisplayId = type === "mount" ? 2404 : 28917;
        }

        // Persist to IndexedDB cache for instant future loads
        if (id) {
          setCachedDisplayId(type, id, resolvedDisplayId);
        }
        if (name) {
          setCachedDisplayId(type, name, resolvedDisplayId);
        }

        // Update component state for ZamModelViewer canvas MutationObserver
        setBlizzardSelectedCollectionItem({
          type,
          id,
          creatureDisplayId: resolvedDisplayId,
          name,
        });
        targetDiv.setAttribute("data-blizzard-selected-collection-item-id", String(resolvedDisplayId));
        targetDiv.setAttribute("data-blizzard-selected-collection-item-type", type);

        if (animTimerRef.current) {
          clearTimeout(animTimerRef.current);
          animTimerRef.current = null;
        }

        const viewer = type === "pet"
          ? await createWowPetViewer(targetDiv, resolvedDisplayId, 1.3)
          : await createWowMountViewer(targetDiv, resolvedDisplayId, 1.1, type);
        if (viewer) {
          viewerInstanceRef.current = viewer;
          // Safely defer initial animation call to prevent premature actor property access
          animTimerRef.current = setTimeout(() => {
            if (viewerInstanceRef.current === viewer) {
              try {
                viewer.setAnimation("Stand");
              } catch (_) {}
            }
          }, 150);
        } else {
          setViewerError("Could not load 3D mesh for this model.");
        }
      } catch (e) {
        console.warn("Could not load 3D creature viewer:", e);
        setViewerError("Error loading official Blizzard 3D model.");
      } finally {
        setIsViewerLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (activeTab === "mounts" && selectedMount) {
      initModelViewer(
        mountViewerMountRef.current,
        selectedMount.creatureDisplayId,
        selectedMount.id,
        "mount",
        selectedMount.name
      );
    } else if (activeTab === "pets" && selectedPet) {
      initModelViewer(
        petViewerMountRef.current,
        selectedPet.creatureDisplayId,
        selectedPet.id,
        "pet",
        selectedPet.name
      );
    }
    return () => {
      if (animTimerRef.current) {
        clearTimeout(animTimerRef.current);
        animTimerRef.current = null;
      }
      if (viewerInstanceRef.current) {
        try {
          viewerInstanceRef.current.destroy?.();
        } catch (_) {}
        viewerInstanceRef.current = null;
      }
    };
  }, [activeTab, selectedMount, selectedPet, initModelViewer]);

  const rotatePreview = (deg: number) => {
    const newAngle = (cameraAngle + deg) % 360;
    setCameraAngle(newAngle);
    if (viewerInstanceRef.current) {
      viewerInstanceRef.current.setAzimuth((newAngle * Math.PI) / 180);
    }
  };

  const toggleAnimation = () => {
    const next = !isPaused;
    setIsPaused(next);
    viewerInstanceRef.current?.setAnimPaused(next);
  };

  return (
    <div id="wow-collections-component" className="space-y-3">
      {/* 1. Header Toolbar with Sub-Tabs & Counts */}
      <div className="p-3 rounded-2xl bg-zinc-950/90 border border-zinc-800 shadow-xl flex items-center justify-between gap-3 flex-wrap">
        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-700/70 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab("mounts")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "mounts"
                ? "bg-cyan-500 text-black shadow"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Mounts ({mountStats.collected}/{mountStats.total})</span>
          </button>

          {!isMoP && (
            <button
              type="button"
              onClick={() => setActiveTab("toys")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "toys"
                  ? "bg-cyan-500 text-black shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Toys ({toyStats.collected}/{toyStats.total})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab("pets")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "pets"
                ? "bg-cyan-500 text-black shadow"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Pets ({petStats.collected}/{petStats.total})</span>
          </button>

          {!isMoP && (
            <button
              type="button"
              onClick={() => setActiveTab("titles")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "titles"
                  ? "bg-cyan-500 text-black shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Titles ({collections?.titles?.length || 0})</span>
            </button>
          )}
        </div>

        {/* Search & Status Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search collection..."
              className="bg-zinc-900 text-xs text-white placeholder-zinc-500 pl-8 pr-3 py-1.5 rounded-xl border border-zinc-700/80 focus:outline-none focus:border-cyan-500 w-36 sm:w-44 transition-all"
            />
          </div>

          {/* Unlocked vs Locked Filter */}
          <div className="flex items-center bg-zinc-900 p-0.5 rounded-xl border border-zinc-800 text-[11px]">
            {(
              [
                { id: "all", label: "All" },
                { id: "collected", label: "Collected" },
                { id: "not_collected", label: "Locked" },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setCollectionStatusFilter(st.id)}
                className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  collectionStatusFilter === st.id
                    ? "bg-cyan-500 text-black shadow"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. MOUNTS VIEW (Interactive In-Game Journal Style: 3D Stage on Right + Scrollable List on Left) */}
      {activeTab === "mounts" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Mounts List (Left 7 cols) */}
          <div className="lg:col-span-7 space-y-2">
            {/* Filter & Sort Bar */}
            <div className="flex items-center justify-between gap-2 flex-wrap bg-zinc-950/40 p-2 rounded-xl border border-zinc-800/80">
              {/* Filter Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(["all", "ground", "flying", "dragonriding", "favorite"] as const).map((mf) => (
                  <button
                    key={mf}
                    type="button"
                    onClick={() => setMountFilter(mf)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition-all cursor-pointer ${
                      mountFilter === mf
                        ? "bg-cyan-500 text-black shadow"
                        : "bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800"
                    }`}
                  >
                    {mf}
                  </button>
                ))}
              </div>

              {/* Mount Sorting Selector */}
              <div className="flex items-center gap-1.5 bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-800 text-xs">
                <ArrowUpDown size={13} className="text-cyan-400 shrink-0" />
                <select
                  value={mountSortBy}
                  onChange={(e) => setMountSortBy(e.target.value as any)}
                  className="bg-transparent text-[11px] text-zinc-200 focus:outline-none cursor-pointer pr-1"
                >
                  <option value="name_asc" className="bg-zinc-900 text-white">Alfabética (A-Z)</option>
                  <option value="name_desc" className="bg-zinc-900 text-white">Alfabética (Z-A)</option>
                  <option value="unlock_recent" className="bg-zinc-900 text-white">Desbloqueio (Mais recentes)</option>
                  <option value="unlock_oldest" className="bg-zinc-900 text-white">Desbloqueio (Mais antigos)</option>
                  <option value="rarity" className="bg-zinc-900 text-white">Tipo / Raridade</option>
                </select>
              </div>
            </div>

            {/* Mount Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[560px] overflow-y-auto pr-1">
              {filteredMounts.map((mount, idx) => {
                const isSelected = selectedMount?.id === mount.id;
                const isUnlocked = mount.isCollected;

                return (
                  <div
                    key={`mount-${mount.id}-${idx}-${mount.name}`}
                    onClick={() => setSelectedMount(mount)}
                    onMouseEnter={(e) => {
                      if (mountLeaveTimeoutRef.current) {
                        clearTimeout(mountLeaveTimeoutRef.current);
                        mountLeaveTimeoutRef.current = null;
                      }
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredMount({ mount, x: rect.right + 12, y: rect.top });
                    }}
                    onMouseLeave={() => {
                      mountLeaveTimeoutRef.current = setTimeout(() => setHoveredMount(null), 300);
                    }}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                      isSelected
                        ? "bg-cyan-950/40 border-cyan-500 shadow-md"
                        : isUnlocked
                        ? "bg-zinc-950/70 hover:bg-zinc-900/80 border-zinc-800 hover:border-zinc-700"
                        : "bg-zinc-950/40 hover:bg-zinc-900/40 border-zinc-800/60 opacity-60 hover:opacity-90"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative">
                        <img
                          src={mount.iconUrl || "https://render.worldofwarcraft.com/us/icons/56/inv_misc_questionmark.jpg"}
                          alt={mount.name}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              "https://render.worldofwarcraft.com/us/icons/56/inv_misc_questionmark.jpg";
                          }}
                          className={`w-10 h-10 rounded-lg object-cover border ${
                            isUnlocked
                              ? "border-amber-500/80 shadow"
                              : "border-zinc-700 grayscale contrast-75"
                          }`}
                        />
                        {!isUnlocked && (
                          <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                            <Lock className="w-4 h-4 text-zinc-400" />
                          </div>
                        )}
                        {mount.isFavorite && (
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400 absolute -top-1 -right-1 drop-shadow" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p
                          className={`text-xs font-bold truncate ${
                            isUnlocked ? "text-white" : "text-zinc-400"
                          }`}
                        >
                          {mount.name}
                        </p>
                        <p className="text-[10px] text-zinc-400 truncate">
                          {mount.source}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-zinc-900 text-zinc-400 border border-zinc-800">
                            {mount.mountType}
                          </span>
                          {mount.isCharacterSpecific && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-950/80 text-amber-300 border border-amber-500/40">
                              {mount.characterName || "Exclusivo"}
                            </span>
                          )}
                          {isUnlocked ? (
                            <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Collected
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-zinc-500">
                              Locked
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <WowheadBadgeLink
                        url={getWowheadMountUrl(mount.id, mount.itemId, resolvedVersion, mount.spellId, mount.name)}
                        label="Wowhead"
                        compact
                      />
                      <button
                        type="button"
                        title="Preview 3D Mount"
                        className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? "bg-cyan-500 text-black shadow"
                            : "text-zinc-500 hover:text-white"
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredMounts.length === 0 && (
              <div className="p-8 text-center rounded-xl bg-zinc-950/40 border border-zinc-800/80">
                <Info className="w-6 h-6 text-zinc-500 mx-auto mb-2" />
                <p className="text-xs text-zinc-400">No mounts found matching this filter.</p>
              </div>
            )}
          </div>

          {/* Mount 3D Stage Preview (Right 5 cols) */}
          <div className="lg:col-span-5 rounded-2xl bg-gradient-to-b from-zinc-950 via-zinc-900 to-black border border-zinc-800 p-3 flex flex-col justify-between shadow-2xl relative overflow-hidden min-h-[460px]">
            {selectedMount ? (
              <>
                {/* 3D Header Info */}
                <div className="flex items-center justify-between gap-2 z-10 pb-2 border-b border-zinc-800/80">
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                      <span>{selectedMount.name}</span>
                      {selectedMount.isFavorite && (
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      )}
                    </h4>
                    <p className="text-[11px] text-zinc-400 capitalize">
                      {selectedMount.mountType} Mount • {selectedMount.speedBonus || "+100% Speed"}
                    </p>
                  </div>

                  {selectedMount.isCollected ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                      Unlocked
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Locked
                    </span>
                  )}
                </div>

                {/* 3D Canvas Mount Point */}
                <div className="relative flex-1 w-full min-h-[300px] flex items-center justify-center overflow-hidden my-2">
                  <div
                    ref={mountViewerMountRef}
                    className="w-full h-full min-h-[300px] flex items-center justify-center"
                  />

                  {isViewerLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-xs gap-3 z-20">
                      <div className="w-10 h-10 rounded-full border-3 border-cyan-500/20 border-t-cyan-400 animate-spin shadow-[0_0_15px_rgba(6,182,212,0.4)]" />
                      <div className="text-center">
                        <p className="text-xs text-cyan-300 font-bold tracking-wide">
                          Loading official 3D model...
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                          Downloading Blizzard mesh & textures
                        </p>
                      </div>
                    </div>
                  )}

                  {viewerError && !isViewerLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-xs gap-3 p-4 text-center z-20">
                      <div className="p-3 rounded-full bg-red-950/60 border border-red-500/40 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-red-300">3D Model Load Failed</h5>
                        <p className="text-[11px] text-zinc-400 mt-1 max-w-xs">{viewerError}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedMount) {
                            initModelViewer(mountViewerMountRef.current, selectedMount.creatureDisplayId, selectedMount.id, "mount", selectedMount.name);
                          }
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-cyan-400 border border-zinc-700/80 transition-all cursor-pointer flex items-center gap-1.5 hover:border-cyan-500/50"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>Tentar Novamente</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 3D Viewer Toolbar */}
                <div className="flex items-center justify-between gap-2 z-10 pt-2 border-t border-zinc-800/80">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => rotatePreview(-45)}
                      className="p-1.5 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-700/80 cursor-pointer"
                      title="Rotate Left"
                    >
                      <RotateCw className="w-3 h-3 -scale-x-100" />
                    </button>
                    <button
                      type="button"
                      onClick={() => rotatePreview(45)}
                      className="p-1.5 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-700/80 cursor-pointer"
                      title="Rotate Right"
                    >
                      <RotateCw className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={toggleAnimation}
                      className="p-1.5 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-700/80 cursor-pointer"
                      title={isPaused ? "Play" : "Pause"}
                    >
                      {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (viewerInstanceRef.current) {
                          const res = viewerInstanceRef.current.verifyIntegrity();
                          if (!res.isValid) {
                            await viewerInstanceRef.current.forceReloadIfMismatched();
                          } else if (selectedMount) {
                            initModelViewer(mountViewerMountRef.current, selectedMount.creatureDisplayId, selectedMount.id, "mount", selectedMount.name);
                          }
                        } else if (selectedMount) {
                          initModelViewer(mountViewerMountRef.current, selectedMount.creatureDisplayId, selectedMount.id, "mount", selectedMount.name);
                        }
                      }}
                      className="px-2 py-1 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 hover:text-emerald-300 text-[10px] font-bold cursor-pointer flex items-center gap-1 shadow"
                      title="Integridade 3D WebGL: Valida o ID carregado no motor e recarrega se houver incompatibilidade"
                    >
                      <Shield className="w-3 h-3 text-emerald-400" />
                      <span className="hidden sm:inline">3D Verificado</span>
                    </button>
                  </div>

                  <a
                    href={resolveWowheadUrl({
                      kind: "mount",
                      id: selectedMount.id,
                      itemId: selectedMount.itemId,
                      spellId: selectedMount.spellId,
                      version: resolvedVersion,
                      name: selectedMount.name,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:underline"
                  >
                    <span>Wowhead</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Lore / Description */}
                <div className="mt-2 p-2 rounded-xl bg-zinc-900/60 border border-zinc-800 text-[11px] space-y-1">
                  <p className="text-zinc-300 italic">"{selectedMount.description}"</p>
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 flex-wrap gap-1 pt-1 border-t border-zinc-800/50">
                    <span><strong className="text-zinc-300">Source:</strong> {selectedMount.source}</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      {selectedMount.id ? (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                          Item ID: <strong className="text-amber-400">{selectedMount.id}</strong>
                        </span>
                      ) : null}
                      {selectedMount.creatureDisplayId || selectedMount.displayId ? (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                          Display ID: <strong className="text-cyan-400">{selectedMount.creatureDisplayId || selectedMount.displayId}</strong>
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-zinc-500">
                <Compass className="w-8 h-8 mb-2" />
                <p className="text-xs font-bold">Select a mount to preview 3D model</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. PETS VIEW (With 3D Creature Preview) */}
      {activeTab === "pets" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-7 space-y-2">
            {/* Filter & Sort Bar */}
            <div className="flex items-center justify-between gap-2 flex-wrap bg-zinc-950/40 p-2 rounded-xl border border-zinc-800/80">
              {/* Pet Family Filters */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  ["all", "Beast", "Dragonkin", "Flying", "Humanoid", "Elemental", "Mechanical", "Undead", "Critter", "Magic", "Aquatic"] as const
                ).map((pf) => (
                  <button
                    key={pf}
                    type="button"
                    onClick={() => setPetFamilyFilter(pf)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      petFamilyFilter === pf
                        ? "bg-cyan-500 text-black shadow"
                        : "bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800"
                    }`}
                  >
                    {pf}
                  </button>
                ))}
              </div>

              {/* Pet Sorting and Species Browser Button */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center gap-1.5 bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-800 text-xs">
                  <ArrowUpDown size={13} className="text-cyan-400 shrink-0" />
                  <select
                    value={petSortBy}
                    onChange={(e) => setPetSortBy(e.target.value as any)}
                    className="bg-transparent text-[11px] text-zinc-200 focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="level_desc" className="bg-zinc-900 text-white">Nível (25 → 1)</option>
                    <option value="level_asc" className="bg-zinc-900 text-white">Nível (1 → 25)</option>
                    <option value="rarity_desc" className="bg-zinc-900 text-white">Raridade (Maior → Menor)</option>
                    <option value="name_asc" className="bg-zinc-900 text-white">Alfabética (A-Z)</option>
                    <option value="name_desc" className="bg-zinc-900 text-white">Alfabética (Z-A)</option>
                    <option value="unlock_recent" className="bg-zinc-900 text-white">Desbloqueio (Mais recentes)</option>
                    <option value="unlock_oldest" className="bg-zinc-900 text-white">Desbloqueio (Mais antigos)</option>
                    <option value="family" className="bg-zinc-900 text-white">Família</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSpeciesBrowser(true)}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold flex items-center gap-1.5 transition-colors"
                  title="Abrir navegador detalhado de BattlePetSpecies com dados do Wowhead"
                >
                  <Sparkles size={13} />
                  <span>Explorar Espécies</span>
                </button>
              </div>
            </div>

            {/* Pets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[560px] overflow-y-auto pr-1">
              {filteredPets.map((pet, idx) => {
                if (!pet) return null;
                const isSelected = selectedPet?.id === pet.id;
                const isUnlocked = !!pet.isCollected;
                const petName = pet.name || "Battle Pet";
                const petLevel = pet.level || 25;
                const petFamily = pet.family || "Companion";
                const petIcon = pet.iconUrl || "https://render.worldofwarcraft.com/us/icons/56/inv_misc_questionmark.jpg";
                const speciesId = pet.speciesId || (pet.id < 100000 ? pet.id : undefined);

                return (
                  <div
                    key={`pet-${pet.id || idx}-${idx}-${(pet as any).uniqueId || (pet as any).guid || petName}`}
                    onClick={() => setSelectedPet(pet)}
                    onMouseEnter={(e) => {
                      if (petLeaveTimeoutRef.current) {
                        clearTimeout(petLeaveTimeoutRef.current);
                        petLeaveTimeoutRef.current = null;
                      }
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredPet({ pet, x: rect.right + 12, y: rect.top });
                    }}
                    onMouseLeave={() => {
                      petLeaveTimeoutRef.current = setTimeout(() => setHoveredPet(null), 300);
                    }}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                      isSelected
                        ? "bg-cyan-950/40 border-cyan-500 shadow-md"
                        : isUnlocked
                        ? "bg-zinc-950/70 hover:bg-zinc-900/80 border-zinc-800 hover:border-zinc-700"
                        : "bg-zinc-950/40 hover:bg-zinc-900/40 border-zinc-800/60 opacity-60 hover:opacity-90"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative">
                        <img
                          src={petIcon}
                          alt={petName}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              "https://render.worldofwarcraft.com/us/icons/56/inv_misc_questionmark.jpg";
                          }}
                          className={`w-10 h-10 rounded-lg object-cover border ${
                            isUnlocked
                              ? "border-blue-500/80 shadow"
                              : "border-zinc-700 grayscale contrast-75"
                          }`}
                        />
                        {!isUnlocked && (
                          <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                            <Lock className="w-4 h-4 text-zinc-400" />
                          </div>
                        )}
                        {pet.isFavorite && (
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400 absolute -top-1 -right-1" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p
                          className={`text-xs font-bold truncate ${
                            isUnlocked ? "text-white" : "text-zinc-400"
                          }`}
                        >
                          {petName}
                        </p>
                        <p className="text-[10px] text-zinc-400 truncate">
                          Level {petLevel} • {petFamily}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {speciesId && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-zinc-900 text-zinc-400 border border-zinc-800">
                              #{speciesId}
                            </span>
                          )}
                          {pet.isCharacterSpecific && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-950/80 text-amber-300 border border-amber-500/40">
                              {pet.characterName || "Exclusivo"}
                            </span>
                          )}
                          {isUnlocked ? (
                            <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Collected
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-rose-400 flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" /> Locked
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <WowheadBadgeLink
                        url={getWowheadPetUrl(pet.id, pet.speciesId, resolvedVersion, pet.itemId, pet.name, (pet as any).creatureId, (pet as any).spellId)}
                        label="Wowhead"
                        compact
                      />
                      <button
                        type="button"
                        title="Preview Pet 3D Model"
                        className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? "bg-cyan-500 text-black shadow"
                            : "text-zinc-500 hover:text-white"
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredPets.length === 0 && (
              <div className="p-8 text-center rounded-xl bg-zinc-950/40 border border-zinc-800/80">
                <Info className="w-6 h-6 text-zinc-500 mx-auto mb-2" />
                <p className="text-xs text-zinc-400">No battle pets found matching this filter.</p>
              </div>
            )}
          </div>

          {/* Pet 3D Preview (Right 5 cols) */}
          <div className="lg:col-span-5 rounded-2xl bg-gradient-to-b from-zinc-950 via-zinc-900 to-black border border-zinc-800 p-3 flex flex-col justify-between shadow-2xl relative overflow-hidden min-h-[460px]">
            {selectedPet ? (
              <>
                <div className="flex items-center justify-between gap-2 z-10 pb-2 border-b border-zinc-800/80">
                  <div>
                    <h4 className="text-sm font-black text-white">{selectedPet.name || "Battle Pet"}</h4>
                    <p className="text-[11px] text-zinc-400">
                      Level {selectedPet.level || 25} {selectedPet.family || "Companion"} Battle Pet
                    </p>
                  </div>

                  {selectedPet.isCollected ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                      Unlocked
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Locked
                    </span>
                  )}
                </div>

                <div className="relative flex-1 w-full min-h-[300px] flex items-center justify-center overflow-hidden my-2">
                  <div
                    ref={petViewerMountRef}
                    className="w-full h-full min-h-[300px] flex items-center justify-center"
                  />
                  {isViewerLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-xs gap-3 z-20">
                      <div className="w-10 h-10 rounded-full border-3 border-cyan-500/20 border-t-cyan-400 animate-spin shadow-[0_0_15px_rgba(6,182,212,0.4)]" />
                      <div className="text-center">
                        <p className="text-xs text-cyan-300 font-bold tracking-wide">
                          Loading 3D pet model...
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                          Downloading Blizzard mesh & textures
                        </p>
                      </div>
                    </div>
                  )}

                  {viewerError && !isViewerLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-xs gap-3 p-4 text-center z-20">
                      <div className="p-3 rounded-full bg-red-950/60 border border-red-500/40 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-red-300">3D Model Load Failed</h5>
                        <p className="text-[11px] text-zinc-400 mt-1 max-w-xs">{viewerError}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedPet) {
                            initModelViewer(petViewerMountRef.current, selectedPet.creatureDisplayId, selectedPet.id, "pet", selectedPet.name);
                          }
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-cyan-400 border border-zinc-700/80 transition-all cursor-pointer flex items-center gap-1.5 hover:border-cyan-500/50"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>Tentar Novamente</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 3D Pet Toolbar */}
                <div className="flex items-center justify-between gap-2 z-10 pt-2 border-t border-zinc-800/80">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => rotatePreview(-45)}
                      className="p-1.5 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-700/80 cursor-pointer"
                      title="Girar para Esquerda"
                    >
                      <RotateCw className="w-3 h-3 -scale-x-100" />
                    </button>
                    <button
                      type="button"
                      onClick={() => rotatePreview(45)}
                      className="p-1.5 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-700/80 cursor-pointer"
                      title="Girar para Direita"
                    >
                      <RotateCw className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={toggleAnimation}
                      className="p-1.5 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-700/80 cursor-pointer"
                      title={isPaused ? "Play" : "Pause"}
                    >
                      {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (viewerInstanceRef.current) {
                          const res = viewerInstanceRef.current.verifyIntegrity();
                          if (!res.isValid) {
                            await viewerInstanceRef.current.forceReloadIfMismatched();
                          } else if (selectedPet) {
                            initModelViewer(petViewerMountRef.current, selectedPet.creatureDisplayId, selectedPet.id, "pet", selectedPet.name);
                          }
                        } else if (selectedPet) {
                          initModelViewer(petViewerMountRef.current, selectedPet.creatureDisplayId, selectedPet.id, "pet", selectedPet.name);
                        }
                      }}
                      className="px-2 py-1 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 hover:text-emerald-300 text-[10px] font-bold cursor-pointer flex items-center gap-1 shadow"
                      title="Integridade 3D WebGL: Valida o ID carregado no motor e recarrega se houver incompatibilidade"
                    >
                      <Shield className="w-3 h-3 text-emerald-400" />
                      <span className="hidden sm:inline">3D Verificado</span>
                    </button>
                  </div>

                  <a
                    href={resolveWowheadUrl({
                      kind: "pet",
                      id: selectedPet.id,
                      speciesId: selectedPet.speciesId,
                      creatureId: (selectedPet as any).creatureId,
                      spellId: (selectedPet as any).spellId,
                      itemId: selectedPet.itemId,
                      version: resolvedVersion,
                      name: selectedPet.name,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:underline"
                  >
                    <span>Wowhead</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Abilities */}
                {selectedPet.abilities && Array.isArray(selectedPet.abilities) && selectedPet.abilities.length > 0 && (
                  <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800 text-[11px] space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 flex-wrap gap-1">
                      <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                        Combat Abilities:
                      </span>
                      <div className="flex items-center gap-1.5 font-mono">
                        {selectedPet.id ? (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                            Pet ID: <strong className="text-amber-400">{selectedPet.id}</strong>
                          </span>
                        ) : null}
                        {selectedPet.creatureDisplayId || selectedPet.displayId ? (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                            Display ID: <strong className="text-cyan-400">{selectedPet.creatureDisplayId || selectedPet.displayId}</strong>
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {selectedPet.abilities.map((ab, i) => {
                        const abName =
                          typeof ab === "string"
                            ? ab
                            : (ab as any)?.name || (ab as any)?.ability?.name || `Ability ${i + 1}`;
                        return (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]"
                          >
                            {abName}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-zinc-500 py-12">
                <Sparkles className="w-8 h-8 mb-2" />
                <p className="text-xs font-bold">Select a battle pet to preview 3D model</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. TOYS VIEW (Differentiating Unlocked vs Locked) */}
      {activeTab === "toys" && !isMoP && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {filteredToys.map((toy, idx) => {
            const isUnlocked = toy.isCollected;
            return (
              <div
                key={`toy-${toy.id}-${idx}-${toy.name}`}
                className={`p-3 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 ${
                  isUnlocked
                    ? "bg-zinc-950/80 border-zinc-800 hover:border-zinc-700 shadow-lg"
                    : "bg-zinc-950/40 border-zinc-800/60 opacity-60 hover:opacity-90"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="relative shrink-0">
                    <img
                      src={toy.iconUrl}
                      alt={toy.name}
                      className={`w-10 h-10 rounded-xl object-cover border ${
                        isUnlocked
                          ? "border-purple-500/80 shadow"
                          : "border-zinc-700 grayscale contrast-75"
                      }`}
                    />
                    {!isUnlocked && (
                      <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                        <Lock className="w-4 h-4 text-zinc-400" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <h5
                      className={`text-xs font-bold truncate ${
                        isUnlocked ? "text-white" : "text-zinc-400"
                      }`}
                    >
                      {toy.name}
                    </h5>
                    {toy.cooldown && (
                      <span className="text-[10px] text-amber-400 block font-mono">
                        {toy.cooldown}
                      </span>
                    )}
                    <p className="text-[10px] text-zinc-400 mt-1 italic line-clamp-2">
                      "{toy.description}"
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-zinc-400 truncate max-w-[160px]">{toy.source}</span>
                  <div className="flex items-center gap-1.5">
                    <WowheadBadgeLink url={getWowheadToyUrl(toy.id, toy.itemId)} label="Wowhead" compact />
                    {isUnlocked ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Collected
                      </span>
                    ) : (
                      <span className="text-rose-400 font-bold flex items-center gap-0.5">
                        <Lock className="w-3 h-3" /> Locked
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. TITLES VIEW (Differentiating Unlocked vs Locked) */}
      {activeTab === "titles" && !isMoP && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {filteredTitles.map((title, idx) => {
            const isUnlocked = title.isCollected;
            const previewTitle = title.titleFormat.replace("%s", profile.name);

            return (
              <div
                key={`title-${title.id}-${idx}-${title.name}`}
                className={`p-3 rounded-2xl border transition-all flex flex-col justify-between gap-2 ${
                  title.isCurrent
                    ? "bg-cyan-950/40 border-cyan-500 shadow-lg"
                    : isUnlocked
                    ? "bg-zinc-950/80 border-zinc-800 hover:border-zinc-700"
                    : "bg-zinc-950/40 border-zinc-800/60 opacity-60 hover:opacity-90"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span
                      className={`text-xs font-bold ${
                        title.isCurrent
                          ? "text-cyan-300 font-black"
                          : isUnlocked
                          ? "text-white"
                          : "text-zinc-400"
                      }`}
                    >
                      {previewTitle}
                    </span>
                    {title.isCurrent && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500 text-black">
                        Active
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] text-zinc-400 line-clamp-2">
                    {title.source}
                  </p>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-zinc-500 font-mono">ID #{title.id}</span>
                  <div className="flex items-center gap-1.5">
                    <WowheadBadgeLink url={getWowheadTitleUrl(title.id)} label="Wowhead" compact />
                    {isUnlocked ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Unlocked
                      </span>
                    ) : (
                      <span className="text-rose-400 font-bold flex items-center gap-0.5">
                        <Lock className="w-3 h-3" /> Locked
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BattlePetSpecies Full Browser Modal */}
      {showSpeciesBrowser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-5xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <BattlePetSpeciesViewer
              profile={profile}
              pets={collections?.pets || []}
              activeCharacterName={activeCharacterName}
              activeCharacterRealm={activeCharacterRealm}
              onClose={() => setShowSpeciesBrowser(false)}
            />
          </div>
        </div>
      )}

      {/* Rich Floating Tooltip for Mounts */}
      {hoveredMount && (
        <div
          className="fixed z-50 pointer-events-auto p-3.5 rounded-2xl bg-zinc-950/95 border-2 border-amber-500/50 shadow-2xl backdrop-blur-md max-w-xs sm:max-w-sm text-left transition-opacity duration-150 animate-in fade-in space-y-2.5"
          style={{
            top: Math.min(window.innerHeight - 340, Math.max(16, hoveredMount.y - 40)),
            left: Math.min(window.innerWidth - 340, Math.max(16, hoveredMount.x)),
            boxShadow: "0 0 30px rgba(245, 158, 11, 0.25)",
          }}
          onMouseEnter={() => {
            if (mountLeaveTimeoutRef.current) {
              clearTimeout(mountLeaveTimeoutRef.current);
              mountLeaveTimeoutRef.current = null;
            }
          }}
          onMouseLeave={() => {
            mountLeaveTimeoutRef.current = setTimeout(() => setHoveredMount(null), 250);
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2.5 pb-2 border-b border-zinc-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={hoveredMount.mount.iconUrl || "https://render.worldofwarcraft.com/us/icons/56/inv_misc_questionmark.jpg"}
                alt=""
                className="w-11 h-11 rounded-xl border border-amber-500/60 object-cover shadow-sm shrink-0"
              />
              <div className="min-w-0">
                <h5 className="text-xs sm:text-sm font-bold text-white truncate">
                  {hoveredMount.mount.name}
                </h5>
                <p className="text-[11px] text-amber-300 capitalize font-medium">
                  Montaria {hoveredMount.mount.mountType === "flying" ? "Voadora" : hoveredMount.mount.mountType === "dragonriding" ? "Voo Dracônico" : "Terrestre"} • {hoveredMount.mount.speedBonus || "+100% Velocidade"}
                </p>
              </div>
            </div>

            {hoveredMount.mount.isCollected ? (
              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold shrink-0">
                Desbloqueada
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-700 text-[10px] font-bold shrink-0 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Bloqueada
              </span>
            )}
          </div>

          {/* Unlock Information / Data de Desbloqueio da Conta / Personagem */}
          <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[11px] space-y-1">
            <div className="flex items-center justify-between text-zinc-300">
              <span className="text-zinc-500 text-[10px] font-mono">Status de Aquisição:</span>
              <span className="font-semibold text-emerald-400">
                {formatUnlockInfo(
                  hoveredMount.mount.unlockedAt,
                  hoveredMount.mount.unlockOrder,
                  hoveredMount.mount.isCharacterSpecific,
                  hoveredMount.mount.characterName
                )}
              </span>
            </div>
            {hoveredMount.mount.isCharacterSpecific && (
              <p className="text-[10px] text-amber-400 font-mono">
                ✦ Montaria vinculada ao personagem: {hoveredMount.mount.characterName || activeCharacterName || "Exclusivo"}
              </p>
            )}
          </div>

          {/* Source / Como Obter */}
          <div className="text-[11px] space-y-0.5">
            <span className="text-zinc-500 text-[10px] font-mono uppercase tracking-wider block">Fonte / Origem:</span>
            <p className="text-zinc-300 font-sans">{hoveredMount.mount.source}</p>
          </div>

          {/* Lore / Description */}
          {hoveredMount.mount.description && (
            <p className="text-[11px] text-zinc-400 italic bg-zinc-900/40 p-2 rounded-lg border border-zinc-850">
              "{hoveredMount.mount.description}"
            </p>
          )}

          {/* Footer & Shortcut Link to Wowhead */}
          <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400">
            <span className="font-mono">Display #{hoveredMount.mount.creatureDisplayId || hoveredMount.mount.id}</span>
            <WowheadBadgeLink
              url={getWowheadMountUrl(hoveredMount.mount.id, hoveredMount.mount.itemId, resolvedVersion, hoveredMount.mount.spellId, hoveredMount.mount.name)}
              label="Ver no Wowhead"
              compact
            />
          </div>
        </div>
      )}

      {/* Rich Floating Tooltip for Battle Pets */}
      {hoveredPet && (
        <div
          className="fixed z-50 pointer-events-auto p-3.5 rounded-2xl bg-zinc-950/95 border-2 border-cyan-500/50 shadow-2xl backdrop-blur-md max-w-xs sm:max-w-sm text-left transition-opacity duration-150 animate-in fade-in space-y-2.5"
          style={{
            top: Math.min(window.innerHeight - 400, Math.max(16, hoveredPet.y - 40)),
            left: Math.min(window.innerWidth - 340, Math.max(16, hoveredPet.x)),
            boxShadow: "0 0 30px rgba(6, 182, 212, 0.25)",
          }}
          onMouseEnter={() => {
            if (petLeaveTimeoutRef.current) {
              clearTimeout(petLeaveTimeoutRef.current);
              petLeaveTimeoutRef.current = null;
            }
          }}
          onMouseLeave={() => {
            petLeaveTimeoutRef.current = setTimeout(() => setHoveredPet(null), 250);
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2.5 pb-2 border-b border-zinc-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={hoveredPet.pet.iconUrl || "https://render.worldofwarcraft.com/us/icons/56/inv_misc_questionmark.jpg"}
                alt=""
                className="w-11 h-11 rounded-xl border border-cyan-500/60 object-cover shadow-sm shrink-0"
              />
              <div className="min-w-0">
                <h5 className="text-xs sm:text-sm font-bold text-white truncate">
                  {hoveredPet.pet.name}
                </h5>
                <p className="text-[11px] text-cyan-300 font-medium">
                  Nível {hoveredPet.pet.level || 25} • {hoveredPet.pet.family || "Mascote"} ({hoveredPet.pet.quality || "Raro"})
                </p>
              </div>
            </div>

            {hoveredPet.pet.isCollected ? (
              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold shrink-0">
                Coletado
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-700 text-[10px] font-bold shrink-0 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Bloqueado
              </span>
            )}
          </div>

          {/* Unlock Information */}
          <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[11px] space-y-1">
            <div className="flex items-center justify-between text-zinc-300">
              <span className="text-zinc-500 text-[10px] font-mono">Desbloqueio:</span>
              <span className="font-semibold text-emerald-400">
                {formatUnlockInfo(
                  hoveredPet.pet.unlockedAt,
                  hoveredPet.pet.unlockOrder,
                  hoveredPet.pet.isCharacterSpecific,
                  hoveredPet.pet.characterName
                )}
              </span>
            </div>
            {hoveredPet.pet.isCharacterSpecific && (
              <p className="text-[10px] text-amber-400 font-mono">
                ✦ Mascote vinculado a: {hoveredPet.pet.characterName || activeCharacterName || "Personagem"}
              </p>
            )}
          </div>

          {/* Combat Stats: Vida, Poder de Ataque, Velocidade, Breed */}
          <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
            <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">
              Atributos de Combate:
            </span>
            <div className="grid grid-cols-4 gap-1.5 text-center font-mono text-[10px]">
              <div className="p-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-emerald-300">
                <span className="text-zinc-500 text-[9px] block">Vida</span>
                <strong>{hoveredPet.pet.stats?.health || (hoveredPet.pet.level ? 600 + hoveredPet.pet.level * 40 : 1580)}</strong>
              </div>
              <div className="p-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-amber-300">
                <span className="text-zinc-500 text-[9px] block">Poder</span>
                <strong>{hoveredPet.pet.stats?.power || (hoveredPet.pet.level ? 100 + hoveredPet.pet.level * 8 : 290)}</strong>
              </div>
              <div className="p-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-cyan-300">
                <span className="text-zinc-500 text-[9px] block">Velocidade</span>
                <strong>{hoveredPet.pet.stats?.speed || (hoveredPet.pet.level ? 100 + hoveredPet.pet.level * 7 : 275)}</strong>
              </div>
              <div className="p-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-purple-300">
                <span className="text-zinc-500 text-[9px] block">Breed</span>
                <strong>#{hoveredPet.pet.stats?.breedId || 3}</strong>
              </div>
            </div>
          </div>

          {/* Combat Attacks / Habilidades de Mascote */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">
              Ataques & Habilidades:
            </span>
            <div className="flex flex-wrap gap-1">
              {(hoveredPet.pet.abilities && hoveredPet.pet.abilities.length > 0
                ? hoveredPet.pet.abilities
                : ["Ataque Rápido", "Mordida Feroz", "Escudo Protetor"]
              ).map((ab: any, aI: number) => {
                const abName = typeof ab === "string" ? ab : ab?.name || `Habilidade ${aI + 1}`;
                return (
                  <a
                    key={aI}
                    href={getWowheadPetAbilityUrl(abName, resolvedVersion)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="px-2 py-0.5 rounded-md bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[10px] text-zinc-300 hover:text-cyan-300 font-mono transition-colors flex items-center gap-1"
                    title="Ver habilidade no Wowhead"
                  >
                    <span>Slot {aI + 1}: {abName}</span>
                    <ExternalLink size={9} className="opacity-70" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Source & Wowhead Shortcut */}
          <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400">
            <span className="truncate max-w-[150px]">{hoveredPet.pet.source || "Mascote de Batalha"}</span>
            <WowheadBadgeLink
              url={getWowheadPetUrl(hoveredPet.pet.id, hoveredPet.pet.speciesId, resolvedVersion, hoveredPet.pet.itemId, hoveredPet.pet.name, hoveredPet.pet.creatureId, hoveredPet.pet.spellId)}
              label="Ver no Wowhead"
              compact
            />
          </div>
        </div>
      )}
    </div>
  );
};
