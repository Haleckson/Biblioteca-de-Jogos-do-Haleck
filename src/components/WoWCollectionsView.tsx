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
} from "lucide-react";
import {
  BlizzardProfileData,
  BlizzardCollectionMount,
  BlizzardCollectionToy,
  BlizzardCollectionPet,
  BlizzardCollectionTitle,
} from "../types";
import { createWowMountViewer, ZamViewerInstance } from "../utils/wowModelEngine";

interface WoWCollectionsViewProps {
  profile: BlizzardProfileData;
  gameVersion?: string;
}

export const WoWCollectionsView: React.FC<WoWCollectionsViewProps> = ({ profile, gameVersion }) => {
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

  const collections = profile.collections;

  // Selected item for 3D preview
  const [selectedMount, setSelectedMount] = useState<BlizzardCollectionMount | null>(
    collections?.mounts?.[0] || null
  );
  const [selectedPet, setSelectedPet] = useState<BlizzardCollectionPet | null>(
    collections?.pets?.[0] || null
  );

  // 3D Viewer Container Separate Refs & Instance
  const mountViewerMountRef = useRef<HTMLDivElement>(null);
  const petViewerMountRef = useRef<HTMLDivElement>(null);
  const viewerInstanceRef = useRef<ZamViewerInstance | null>(null);
  const [isViewerLoading, setIsViewerLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [cameraAngle, setCameraAngle] = useState(0);

  // Filtered Mounts
  const filteredMounts = useMemo(() => {
    const list = collections?.mounts || [];
    return list.filter((m) => {
      const matchesSearch =
        !searchTerm ||
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.source.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType =
        mountFilter === "all" ||
        (mountFilter === "favorite" ? m.isFavorite : m.mountType === mountFilter);
      const matchesStatus =
        collectionStatusFilter === "all" ||
        (collectionStatusFilter === "collected" ? m.isCollected : !m.isCollected);
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [collections?.mounts, searchTerm, mountFilter, collectionStatusFilter]);

  // Filtered Toys
  const filteredToys = useMemo(() => {
    const list = collections?.toys || [];
    return list.filter((t) => {
      const matchesSearch =
        !searchTerm ||
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        collectionStatusFilter === "all" ||
        (collectionStatusFilter === "collected" ? t.isCollected : !t.isCollected);
      return matchesSearch && matchesStatus;
    });
  }, [collections?.toys, searchTerm, collectionStatusFilter]);

  // Filtered Pets
  const filteredPets = useMemo(() => {
    const list = collections?.pets || [];
    return list.filter((p) => {
      const matchesSearch =
        !searchTerm ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.family.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFamily =
        petFamilyFilter === "all" || p.family.toLowerCase() === petFamilyFilter.toLowerCase();
      const matchesStatus =
        collectionStatusFilter === "all" ||
        (collectionStatusFilter === "collected" ? p.isCollected : !p.isCollected);
      return matchesSearch && matchesFamily && matchesStatus;
    });
  }, [collections?.pets, searchTerm, petFamilyFilter, collectionStatusFilter]);

  // Filtered Titles
  const filteredTitles = useMemo(() => {
    const list = collections?.titles || [];
    return list.filter((t) => {
      const matchesSearch =
        !searchTerm ||
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.source && t.source.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus =
        collectionStatusFilter === "all" ||
        (collectionStatusFilter === "collected" ? t.isCollected : !t.isCollected);
      return matchesSearch && matchesStatus;
    });
  }, [collections?.titles, searchTerm, collectionStatusFilter]);

  // Total statistics for counts
  const mountStats = useMemo(() => {
    const list = collections?.mounts || [];
    const collected = list.filter((m) => m.isCollected).length;
    return { collected, total: list.length };
  }, [collections?.mounts]);

  const toyStats = useMemo(() => {
    const list = collections?.toys || [];
    const collected = list.filter((t) => t.isCollected).length;
    return { collected, total: list.length };
  }, [collections?.toys]);

  const petStats = useMemo(() => {
    const list = collections?.pets || [];
    const collected = list.filter((p) => p.isCollected).length;
    return { collected, total: list.length };
  }, [collections?.pets]);

  // Initialize Mount or Pet 3D Viewer when selection changes
  const initModelViewer = useCallback(async (targetDiv: HTMLDivElement | null, creatureDisplayId?: number) => {
    if (!targetDiv || !creatureDisplayId) return;
    setIsViewerLoading(true);

    if (viewerInstanceRef.current) {
      viewerInstanceRef.current.destroy?.();
      viewerInstanceRef.current = null;
    }

    try {
      const viewer = await createWowMountViewer(
        targetDiv,
        creatureDisplayId,
        1.1
      );
      if (viewer) {
        viewerInstanceRef.current = viewer;
        viewer.setAnimation("Stand");
      }
    } catch (e) {
      console.warn("Could not load 3D creature viewer:", e);
    } finally {
      setIsViewerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "mounts" && selectedMount?.creatureDisplayId) {
      initModelViewer(mountViewerMountRef.current, selectedMount.creatureDisplayId);
    } else if (activeTab === "pets" && selectedPet?.creatureDisplayId) {
      initModelViewer(petViewerMountRef.current, selectedPet.creatureDisplayId);
    }
    return () => {
      if (viewerInstanceRef.current) {
        viewerInstanceRef.current.destroy?.();
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

            {/* Mount Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[560px] overflow-y-auto pr-1">
              {filteredMounts.map((mount) => {
                const isSelected = selectedMount?.id === mount.id;
                const isUnlocked = mount.isCollected;

                return (
                  <div
                    key={mount.id}
                    onClick={() => setSelectedMount(mount)}
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
                          src={mount.iconUrl}
                          alt={mount.name}
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
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-zinc-900 text-zinc-400 border border-zinc-800">
                            {mount.mountType}
                          </span>
                          {isUnlocked ? (
                            <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Collected
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-rose-400 flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" /> Not Collected
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      title="Preview 3D Mount"
                      className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                        isSelected
                          ? "bg-cyan-500 text-black shadow"
                          : "text-zinc-500 hover:text-white"
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
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
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs gap-2">
                      <div className="w-8 h-8 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
                      <p className="text-[11px] text-cyan-400 font-bold">
                        Loading 3D Mount Mesh...
                      </p>
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
                  </div>

                  <a
                    href={`https://www.wowhead.com/item=${selectedMount.id}`}
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
                  <p className="text-zinc-400 text-[10px]">
                    <strong className="text-zinc-300">Source:</strong> {selectedMount.source}
                  </p>
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
            {/* Pet Family Filters */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                ["all", "Beast", "Dragonkin", "Flying", "Humanoid", "Elemental"] as const
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

            {/* Pets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[560px] overflow-y-auto pr-1">
              {filteredPets.map((pet) => {
                const isSelected = selectedPet?.id === pet.id;
                const isUnlocked = pet.isCollected;

                return (
                  <div
                    key={pet.id}
                    onClick={() => setSelectedPet(pet)}
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
                          src={pet.iconUrl}
                          alt={pet.name}
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
                          {pet.name}
                        </p>
                        <p className="text-[10px] text-zinc-400 truncate">
                          Level {pet.level} • {pet.family}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
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

                    <button
                      type="button"
                      title="Preview Pet 3D Model"
                      className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                        isSelected
                          ? "bg-cyan-500 text-black shadow"
                          : "text-zinc-500 hover:text-white"
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pet 3D Preview (Right 5 cols) */}
          <div className="lg:col-span-5 rounded-2xl bg-gradient-to-b from-zinc-950 via-zinc-900 to-black border border-zinc-800 p-3 flex flex-col justify-between shadow-2xl relative overflow-hidden min-h-[460px]">
            {selectedPet ? (
              <>
                <div className="flex items-center justify-between gap-2 z-10 pb-2 border-b border-zinc-800/80">
                  <div>
                    <h4 className="text-sm font-black text-white">{selectedPet.name}</h4>
                    <p className="text-[11px] text-zinc-400">
                      Level {selectedPet.level} {selectedPet.family} Battle Pet
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
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs gap-2">
                      <div className="w-8 h-8 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
                      <p className="text-[11px] text-cyan-400 font-bold">
                        Loading Pet 3D Mesh...
                      </p>
                    </div>
                  )}
                </div>

                {/* Abilities */}
                {selectedPet.abilities && (
                  <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800 text-[11px]">
                    <span className="text-zinc-400 text-[10px] font-bold block mb-1 uppercase tracking-wider">
                      Combat Abilities:
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {selectedPet.abilities.map((ab, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]"
                        >
                          {ab}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* 4. TOYS VIEW (Differentiating Unlocked vs Locked) */}
      {activeTab === "toys" && !isMoP && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {filteredToys.map((toy) => {
            const isUnlocked = toy.isCollected;
            return (
              <div
                key={toy.id}
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
            );
          })}
        </div>
      )}

      {/* 5. TITLES VIEW (Differentiating Unlocked vs Locked) */}
      {activeTab === "titles" && !isMoP && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {filteredTitles.map((title) => {
            const isUnlocked = title.isCollected;
            const previewTitle = title.titleFormat.replace("%s", profile.name);

            return (
              <div
                key={title.id}
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
            );
          })}
        </div>
      )}
    </div>
  );
};
