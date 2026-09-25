/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Shield,
  Trophy,
  Heart,
  Zap,
  Sparkles,
  Award,
  Layers,
  Info,
  Package,
  Boxes,
  Compass,
  Box,
  Eye,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Maximize2,
  Users,
  Search,
  Check,
  ZoomIn,
  ZoomOut,
  ChevronUp,
  RotateCcw,
  ArrowUpDown,
  Wrench,
  Swords,
  Clock,
  Skull,
  FileText,
  Flame,
  X,
  Coins,
  Landmark,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import {
  BlizzardProfileData,
  BlizzardGearItem,
  BlizzardReputation,
  BlizzardCharacterSummary,
} from "../types";
import {
  getWoWClassInfo,
  getWoWRaceInfo,
  getWoWFactionInfo,
  getWoWItemQuality,
  getWoWVersionInfo,
} from "../utils/blizzardIcons";
import { WoWFactionCrest } from "./WoWFactionCrest";
import { WoWTalentTree } from "./WoWTalentTree";
import { WoWInventoryView } from "./WoWInventoryView";
import { WoWCollectionsView } from "./WoWCollectionsView";
import { WoWModelViewer3D } from "./WoWModelViewer3D";
import { WoWAchievementsView } from "./WoWAchievementsView";
import {
  resolveWowheadUrl,
  getWowheadItemUrl,
  getWowheadAchievementUrl,
  getWowheadFactionUrl,
  WowheadBadgeLink,
} from "../utils/wowheadUrls";

interface WoWArmoryViewProps {
  profile: BlizzardProfileData;
  onRefresh?: () => void;
  isLoading?: boolean;
  gameVersion?: string;
  characters?: BlizzardCharacterSummary[];
  activeCharacterName?: string;
  activeCharacterRealm?: string;
  activeCharacterKey?: string;
  onSelectCharacter?: (char: BlizzardCharacterSummary) => void;
  filterVersion?: string;
  onFilterVersionChange?: (version: string) => void;
}

// Paperdoll standard equipment slots (authentic English terms)
const LEFT_SLOTS = [
  { key: "HEAD", label: "Head", defaultIcon: "https://render.worldofwarcraft.com/us/icons/56/inv_helmet_09.jpg" },
  { key: "NECK", label: "Neck", defaultIcon: "https://render.worldofwarcraft.com/us/icons/56/inv_jewelry_necklace_07.jpg" },
  { key: "SHOULDER", label: "Shoulders", defaultIcon: "https://render.worldofwarcraft.com/us/icons/56/inv_shoulder_02.jpg" },
  { key: "BACK", label: "Back", defaultIcon: "https://render.worldofwarcraft.com/us/icons/56/inv_misc_cape_16.jpg" },
  { key: "CHEST", label: "Chest", defaultIcon: "https://render.worldofwarcraft.com/us/icons/56/inv_chest_plate06.jpg" },
  { key: "SHIRT", label: "Shirt", defaultIcon: "https://render.worldofwarcraft.com/us/icons/56/inv_shirt_white_01.jpg" },
  { key: "TABARD", label: "Tabard", defaultIcon: "https://render.worldofwarcraft.com/us/icons/56/inv_misc_tabard_01.jpg" },
  { key: "WRIST", label: "Wrist", defaultIcon: "https://render.worldofwarcraft.com/us/icons/56/inv_bracer_07.jpg" },
];

const RIGHT_SLOTS = [
  { key: "HANDS", label: "Hands", defaultIcon: "https://render.worldofwarcraft.com/us/icons/56/inv_gauntlets_04.jpg" },
  { key: "WAIST", label: "Waist", defaultIcon: "https://render.worldofwarcraft.com/us/icons/56/inv_belt_12.jpg" },
  { key: "LEGS", label: "Legs", defaultIcon: "https://render.worldofwarcraft.com/us/icons/56/inv_pants_03.jpg" },
  { key: "FEET", label: "Feet", defaultIcon: "https://render.worldofwarcraft.com/us/icons/56/inv_boots_01.jpg" },
  { key: "RING_1", label: "Ring 1", defaultIcon: "https://render.worldofwarcraft.com/us/icons/56/inv_jewelry_ring_03.jpg" },
  { key: "RING_2", label: "Ring 2", defaultIcon: "https://render.worldofwarcraft.com/us/icons/56/inv_jewelry_ring_07.jpg" },
  { key: "TRINKET_1", label: "Trinket 1", defaultIcon: "https://render.worldofwarcraft.com/us/icons/56/inv_jewelry_talisman_01.jpg" },
  { key: "TRINKET_2", label: "Trinket 2", defaultIcon: "https://render.worldofwarcraft.com/us/icons/56/inv_misc_gem_bloodstone_01.jpg" },
];

const WEAPON_SLOTS = [
  { key: "MAIN_HAND", label: "Main Hand", defaultIcon: "https://render.worldofwarcraft.com/us/icons/56/inv_sword_39.jpg" },
  { key: "OFF_HAND", label: "Off Hand", defaultIcon: "https://render.worldofwarcraft.com/us/icons/56/inv_shield_06.jpg" },
  { key: "RANGED", label: "Ranged / Relic", defaultIcon: "https://render.worldofwarcraft.com/us/icons/56/inv_weapon_bow_08.jpg" },
];

export const WoWArmoryView: React.FC<WoWArmoryViewProps> = ({
  profile,
  onRefresh,
  isLoading = false,
  gameVersion,
  characters,
  activeCharacterName,
  activeCharacterRealm,
  activeCharacterKey,
  onSelectCharacter,
  filterVersion,
  onFilterVersionChange,
}) => {
  const [activeTab, setActiveTab] = useState<
    "armory" | "inventory" | "collections" | "talents" | "reputations" | "achievements" | "stats" | "professions" | "pvp" | "lockouts" | "bank" | "endgame"
  >("armory");

  // Character Selector Dropdown State for Unified Header
  const [isCharSelectorOpen, setIsCharSelectorOpen] = useState(false);
  const [charSearchQuery, setCharSearchQuery] = useState("");
  const [showDeathCertModal, setShowDeathCertModal] = useState(false);

  // Determine effective expansion version strictly for this game
  const resolvedVersion = useMemo(() => {
    const raw = (gameVersion || profile.wow_version || profile.gameMode || "retail").toLowerCase();
    if (raw.includes("forever") || raw.includes("vanilla+")) return "forever";
    if (raw.includes("mop") || raw.includes("pandaria")) return "mop";
    if (raw.includes("tbc") || raw.includes("burning") || raw.includes("crusade")) return "tbc";
    if (raw.includes("classic") || raw.includes("era") || raw.includes("vanilla")) return "classic";
    return "retail";
  }, [gameVersion, profile.wow_version, profile.gameMode]);

  // Filter available characters for fast switching
  const availableCharacters = useMemo(() => {
    if (!characters || !Array.isArray(characters)) return [];
    let list = [...characters];
    if (filterVersion && filterVersion !== "all") {
      list = list.filter((c) => {
        const v = (c.wow_version || c.gameMode || "retail").toLowerCase();
        return v.includes(filterVersion.toLowerCase());
      });
    }
    if (charSearchQuery.trim()) {
      const q = charSearchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.realm && c.realm.toLowerCase().includes(q)) ||
          (c.characterClass && c.characterClass.toLowerCase().includes(q))
      );
    }
    return list;
  }, [characters, filterVersion, charSearchQuery]);

  // Collections interface: available in MoP, Retail, or when collections data is present (e.g. via Addon export across any version)
  const hasCollections =
    resolvedVersion === "mop" ||
    resolvedVersion === "retail" ||
    !!(profile.collections && ((profile.collections.mounts?.length || 0) > 0 || (profile.collections.pets?.length || 0) > 0 || (profile.collections.toys?.length || 0) > 0));
  // Achievements: available in Wrath+, or when achievements data is present (e.g. via Addon export or custom Forever achievements)
  const hasAchievements =
    (resolvedVersion !== "classic" && resolvedVersion !== "forever") ||
    !!(profile.achievements && profile.achievements.length > 0) ||
    !!(profile.achievementPoints && profile.achievementPoints > 0);

  // Auto-switch tab if an unavailable tab is active for this expansion
  useEffect(() => {
    if (!hasCollections && activeTab === "collections") {
      setActiveTab("armory");
    }
    if (!hasAchievements && activeTab === "achievements") {
      setActiveTab("armory");
    }
  }, [hasCollections, hasAchievements, activeTab]);

  // Armory Visualizer Display: 2D Paperdoll as primary/default (official Blizzard Armory style), with 3D as secondary
  const [armoryDisplayMode, setArmoryDisplayMode] = useState<"2d" | "3d" | "split">("2d");
  // Paperdoll Zoom / Framing scale (default 2.3x to fill the available canvas seamlessly, matching Blizzard Armory)
  const [paperdollScale, setPaperdollScale] = useState<number>(2.3);
  const [paperdollOffsetY, setPaperdollOffsetY] = useState<number>(0);

  const [hoveredItem, setHoveredItem] = useState<{ item: BlizzardGearItem; slotLabel: string } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [reputationFilter, setReputationFilter] = useState<string>("all");
  const itemLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (itemLeaveTimeoutRef.current) clearTimeout(itemLeaveTimeoutRef.current);
    };
  }, []);

  const charClass = profile.characterClass || "Warrior";
  const charRace = profile.race || "Human";
  const charFaction = profile.faction || "ALLIANCE";
  const charLevel = profile.level || 1;
  const charSpec = profile.activeSpec || "Arms";

  const classInfo = getWoWClassInfo(charClass);
  const raceInfo = getWoWRaceInfo(charRace, profile.gender);
  const factionInfo = getWoWFactionInfo(charFaction);
  const versionInfo = getWoWVersionInfo(profile.wow_version || profile.gameMode || "retail");

  // Map equipped items by slot
  const gearMap = useMemo(() => {
    const map = new Map<string, BlizzardGearItem>();
    const items = profile.equippedItems || profile.gear || [];
    for (const item of items) {
      if (item.slot) {
        const slotKey = item.slot.toUpperCase();
        // Enrich item with profile.transmogs if needed
        const enrichedItem = { ...item };
        if (!enrichedItem.transmog && profile.transmogs && profile.transmogs[slotKey]) {
          enrichedItem.transmog = profile.transmogs[slotKey];
        }
        map.set(slotKey, enrichedItem);
      }
    }
    return map;
  }, [profile.equippedItems, profile.gear, profile.transmogs]);

  const stats = profile.stats || {};

  // Safe formatting helpers for stats to prevent runtime TypeErrors from unexpected shapes/types
  const formatStatPercent = (val: any, fallback: string = "0.0%"): string => {
    if (val === undefined || val === null) return fallback;
    if (typeof val === "number") return isNaN(val) ? fallback : `${val.toFixed(1)}%`;
    if (typeof val === "object" && typeof val.value === "number") return `${val.value.toFixed(1)}%`;
    if (typeof val === "object" && typeof val.rating_bonus === "number") return `${val.rating_bonus.toFixed(1)}%`;
    const n = Number(val);
    if (!isNaN(n)) return `${n.toFixed(1)}%`;
    return typeof val === "string" ? val : fallback;
  };

  const formatStatNumber = (val: any, fallback: string = "0"): string => {
    if (val === undefined || val === null) return fallback;
    if (typeof val === "number") return isNaN(val) ? fallback : val.toLocaleString();
    if (typeof val === "object" && typeof val.effective === "number") return val.effective.toLocaleString();
    if (typeof val === "object" && typeof val.value === "number") return val.value.toLocaleString();
    const n = Number(val);
    return !isNaN(n) ? n.toLocaleString() : (typeof val === "string" ? val : fallback);
  };

  const maxHealth = stats.health || (charLevel <= 20 ? 450 : charLevel <= 60 ? 5200 : 6400000);
  const resourceType =
    stats.powerType ||
    (classInfo.id === "rogue" ? "ENERGY" : classInfo.id === "warrior" ? "RAGE" : "MANA");
  const maxPower =
    stats.power ||
    (resourceType === "ENERGY" || resourceType === "RAGE" ? 100 : charLevel <= 20 ? 320 : 250000);

  const resourceColor =
    resourceType === "ENERGY"
      ? { bg: "bg-amber-500", text: "text-amber-400", label: "Energy" }
      : resourceType === "RAGE"
      ? { bg: "bg-red-600", text: "text-red-400", label: "Rage" }
      : { bg: "bg-cyan-500", text: "text-cyan-400", label: "Mana" };

  const handleMouseEnter = (item: BlizzardGearItem, slotLabel: string, e: React.MouseEvent) => {
    if (itemLeaveTimeoutRef.current) {
      clearTimeout(itemLeaveTimeoutRef.current);
      itemLeaveTimeoutRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      x: rect.right + 12,
      y: rect.top,
    });
    setHoveredItem({ item, slotLabel });
  };

  const handleMouseLeave = () => {
    itemLeaveTimeoutRef.current = setTimeout(() => {
      setHoveredItem(null);
    }, 300);
  };

  // Render an Equipment Slot for Paperdoll (Compact, information-dense and elegant)
  const renderSlot = (slot: { key: string; label: string; defaultIcon: string }, isRight = false) => {
    const item = gearMap.get(slot.key);
    const quality = item ? getWoWItemQuality(item.quality) : null;
    const iconUrl = item?.iconUrl || slot.defaultIcon;

    return (
      <div
        key={slot.key}
        id={`wow-slot-${slot.key.toLowerCase()}`}
        onMouseEnter={(e) => item && handleMouseEnter(item, slot.label, e)}
        onMouseLeave={handleMouseLeave}
        className={`group relative flex items-center gap-2 px-2 py-1 sm:py-1.5 rounded-xl border transition-all cursor-pointer ${
          item
            ? `${quality?.bgClass || "bg-zinc-900"} ${quality?.borderClass || "border-zinc-700"} hover:scale-[1.02] hover:shadow-md hover:shadow-black/70 hover:border-cyan-500/50`
            : "bg-zinc-950/40 border-zinc-800/50 opacity-60 hover:opacity-85"
        } ${isRight ? "flex-row-reverse text-right" : "flex-row text-left"}`}
      >
        {/* Item Icon with Quality Border & iLvl Badge */}
        <div className="relative shrink-0">
          <img
            src={iconUrl}
            alt={item?.name || slot.label}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg border-2 object-cover transition-transform ${
              item ? quality?.borderClass || "border-zinc-600" : "border-zinc-800/80 grayscale"
            }`}
          />
          {item?.transmog && (
            <span
              className="absolute -top-1.5 -left-1.5 px-1 py-0.2 rounded bg-purple-950/95 text-[8px] font-mono font-black text-purple-300 border border-purple-500/80 shadow-md leading-none"
              title={item.transmog.displayString || `Transmogrified to: ${item.transmog.name}`}
            >
              ✨
            </span>
          )}
          {item?.itemLevel && (
            <span className="absolute -bottom-1 -right-1 px-1 py-0.2 rounded bg-black/95 text-[9px] font-mono font-black text-amber-300 border border-zinc-800 shadow-sm leading-none">
              {item.itemLevel}
            </span>
          )}
        </div>

        {/* Slot Title & Rich Item Details */}
        <div className="min-w-0 flex-1 hidden sm:block">
          <div className={`flex items-center gap-1.5 ${isRight ? "justify-end" : "justify-start"}`}>
            <span className="text-[9px] font-mono uppercase font-bold text-zinc-400 truncate tracking-wide">
              {slot.label}
            </span>
            {item?.armorType && (
              <span className="text-[8px] font-mono text-zinc-500 uppercase px-1 rounded bg-zinc-800/60">
                {item.armorType}
              </span>
            )}
          </div>
          <p
            className="text-[11px] sm:text-xs font-bold truncate leading-tight mt-0.5"
            style={{ color: item && quality ? quality.color : "#71717a" }}
          >
            {item ? item.name : "Vazio"}
          </p>
          {item?.transmog && (
            <span
              className="text-[9px] text-purple-300 font-semibold truncate block leading-none mt-0.5"
              title={item.transmog.displayString || `Transmogrified to: ${item.transmog.name}`}
            >
              ✨ {item.transmog.name || "Transmog"}
            </span>
          )}
          {!item?.transmog && item?.enchantment && (
            <span className="text-[9px] text-emerald-400 truncate block font-medium leading-none mt-0.5">
              ✧ {item.enchantment}
            </span>
          )}
          {!item?.transmog && !item?.enchantment && item?.stats && item.stats.length > 0 && (
            <span className="text-[9px] text-zinc-400 font-mono truncate block leading-none mt-0.5">
              {item.stats[0]}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div id="wow-armory-view" className="space-y-4">
      {/* 1. Character Identity & Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800 p-4 shadow-xl">
        {/* Ambient Class Color Glow */}
        <div
          className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-15 pointer-events-none"
          style={{ backgroundColor: classInfo.color }}
        />

        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3.5">
            {/* Class Icon & Faction Stack */}
            <div className="relative shrink-0">
              <img
                src={classInfo.iconUrl}
                alt={charClass}
                className="w-14 h-14 rounded-2xl border-2 object-cover shadow-xl shadow-black/80"
                style={{ borderColor: classInfo.color }}
                title={`Class: ${classInfo.name}`}
              />
              <div
                className={`absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full border-2 overflow-hidden shadow-md bg-zinc-950 flex items-center justify-center p-0.5 ${factionInfo.borderClass}`}
                title={`Faction: ${factionInfo.name}`}
              >
                <WoWFactionCrest faction={profile.faction} size={18} glow={false} />
              </div>
            </div>

            {/* Names, Spec, Guild & Realm */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-black text-white tracking-wide">
                  {profile.name || "Character"}
                </h3>
                <span className="text-xs font-mono font-black text-amber-300 bg-amber-950/70 px-2 py-0.5 rounded-lg border border-amber-500/50">
                  Level {charLevel}
                </span>
                <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-950/70 px-2 py-0.5 rounded-lg border border-emerald-500/40 flex items-center gap-1">
                  <Check size={10} className="text-emerald-400" /> Personagem Selecionado
                </span>
                {profile.hardcore?.isHardcore && (
                  profile.hardcore.isDead ? (
                    <button
                      type="button"
                      onClick={() => setShowDeathCertModal(true)}
                      className="text-[10px] font-black uppercase text-red-300 bg-red-950/90 px-2.5 py-0.5 rounded-lg border border-red-500/80 flex items-center gap-1 shadow-md shadow-red-950/80 cursor-pointer hover:bg-red-900 transition-colors animate-pulse"
                      title="Ver Certificado de Óbito"
                    >
                      <Skull size={11} className="text-red-400" />
                      <span>HARDCORE FALECIDO</span>
                    </button>
                  ) : (
                    <span className="text-[10px] font-black uppercase text-emerald-300 bg-emerald-950/90 px-2.5 py-0.5 rounded-lg border border-emerald-500/80 flex items-center gap-1.5 shadow-md shadow-emerald-950/80">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      <span>HARDCORE VIVO</span>
                    </span>
                  )
                )}
                {profile.guild && (
                  <span className="text-xs font-semibold text-zinc-300 bg-zinc-800/80 px-2 py-0.5 rounded-lg border border-zinc-700">
                    &lt;{profile.guild}&gt;
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1 text-xs text-zinc-300 flex-wrap">
                <span className="font-bold" style={{ color: classInfo.color }}>
                  {raceInfo.name} • {charSpec} {classInfo.name}
                </span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400 font-mono">
                  {resolvedVersion === "forever" || profile.ruleset
                    ? `Ruleset: ${profile.ruleset || profile.realm || "Normal (PvE)"}`
                    : `Realm: ${profile.realm || "Stormrage"}`}
                </span>
                <span className="text-zinc-600">•</span>
                <span
                  className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${versionInfo.badgeBg} ${versionInfo.borderClass} ${versionInfo.textClass}`}
                >
                  {versionInfo.shortName}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Badges (iLvl & Achievements) & Character Switcher */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {characters && characters.length > 0 && onSelectCharacter && (
              <button
                type="button"
                id="wow-armory-switch-char-btn"
                onClick={() => setIsCharSelectorOpen(!isCharSelectorOpen)}
                className="px-3 py-2 rounded-xl bg-cyan-950/70 hover:bg-cyan-900/90 border border-cyan-500/40 text-cyan-200 font-bold text-xs transition-all shadow-md cursor-pointer flex items-center gap-2 hover:border-cyan-400 group"
              >
                <Users size={14} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                <span>Trocar Personagem</span>
                <span className="px-1.5 py-0.2 rounded-full bg-cyan-900/80 text-[10px] text-cyan-300 font-mono border border-cyan-700/50">
                  {characters.length}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-cyan-400 transition-transform duration-200 ${
                    isCharSelectorOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            )}

            <div className="px-3.5 py-2 rounded-xl bg-purple-950/40 border border-purple-500/40 text-center shadow-inner">
              <span className="text-[10px] uppercase font-bold text-purple-300 block tracking-wider">
                Item Level
              </span>
              <span className="text-xl font-black font-mono text-purple-200">
                {profile.equippedItemLevel || 0}
              </span>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-amber-950/40 border border-amber-500/40 text-center shadow-inner">
              <span className="text-[10px] uppercase font-bold text-amber-300 block tracking-wider flex items-center justify-center gap-1">
                <Trophy size={11} /> Conquistas
              </span>
              <span className="text-xl font-black font-mono text-amber-200">
                {(profile.achievementPoints || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Expandable Unified Character Switcher Drawer */}
        {isCharSelectorOpen && characters && characters.length > 0 && onSelectCharacter && (
          <div className="mt-4 pt-4 border-t border-zinc-800/80 space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-cyan-400" />
                <span className="text-xs font-bold text-white">
                  Selecione um Personagem da sua Conta Blizzard
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  ({availableCharacters.length} encontrados)
                </span>
              </div>

              {/* Quick Search */}
              <div className="relative w-full sm:w-64">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  value={charSearchQuery}
                  onChange={(e) => setCharSearchQuery(e.target.value)}
                  placeholder="Filter characters by name, realm, or class..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Character Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
              {availableCharacters.map((c, cIdx) => {
                const cClassInfo = getWoWClassInfo(c.characterClass || "Warrior");
                const cRaceInfo = getWoWRaceInfo(c.race || "Human", c.gender);
                const cFactionInfo = getWoWFactionInfo(c.faction || "ALLIANCE");
                const isSelected = activeCharacterKey
                  ? (`${c.name}-${c.realmSlug || c.realm}`.toLowerCase() === activeCharacterKey.toLowerCase() ||
                     `${c.name}#${c.realmSlug || c.realm}`.toLowerCase() === activeCharacterKey.toLowerCase())
                  : (
                    c.name.trim().toLowerCase() === (activeCharacterName || profile.name || "").trim().toLowerCase() &&
                    (!activeCharacterRealm && !profile.realm ||
                     (c.realmSlug || c.realm || "").trim().toLowerCase().replace(/['\s-_]+/g, "") === (activeCharacterRealm || profile.realm || "").trim().toLowerCase().replace(/['\s-_]+/g, ""))
                  );

                return (
                  <button
                    key={`${c.name}-${c.realm}-${c.wow_version || "retail"}-${cIdx}`}
                    type="button"
                    onClick={() => {
                      onSelectCharacter(c);
                      setIsCharSelectorOpen(false);
                    }}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer group relative ${
                      isSelected
                        ? "bg-cyan-950/80 border-cyan-500/80 shadow-md shadow-cyan-950/50"
                        : "bg-zinc-900/80 hover:bg-zinc-850 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    {/* Class & Faction Icon */}
                    <div className="relative shrink-0">
                      <img
                        src={c.avatarUrl || cClassInfo.iconUrl}
                        alt={c.name}
                        onError={(e) => {
                          e.currentTarget.src = cClassInfo.iconUrl;
                        }}
                        className="w-10 h-10 rounded-xl border object-cover shadow"
                        style={{ borderColor: cClassInfo.color }}
                      />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-zinc-800 bg-black flex items-center justify-center overflow-hidden">
                        <WoWFactionCrest faction={c.faction} size={12} glow={false} />
                      </div>
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span
                          className="text-xs font-black truncate block"
                          style={{ color: cClassInfo.color }}
                        >
                          {c.name}
                        </span>
                        {isSelected && (
                          <span className="ml-auto px-1.5 py-0.5 text-[9px] font-bold text-cyan-300 bg-cyan-900/80 rounded border border-cyan-500/50 flex items-center gap-0.5 shrink-0">
                            <Check size={10} className="text-cyan-400 shrink-0" /> Salvo
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate flex items-center gap-1 font-mono">
                        <span className="text-amber-300 font-bold">Nív {c.level}</span>
                        <span>•</span>
                        <span>{c.ruleset ? `Ruleset: ${c.ruleset}` : c.realm}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate flex items-center gap-1">
                        <span>{cRaceInfo.name}</span>
                        <span>•</span>
                        <span className="text-purple-300 font-mono font-bold">ilvl {c.equippedItemLevel || "?"}</span>
                      </div>
                    </div>
                  </button>
                );
              })}

              {availableCharacters.length === 0 && (
                <div className="col-span-full text-center py-6 text-xs text-zinc-500 font-mono">
                  Nenhum personagem encontrado com o filtro "{charSearchQuery}".
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Comprehensive Navigation Tabs with Clear Icons & Statuses */}
      <div className="flex items-center gap-1.5 border-b border-zinc-800 pb-2 overflow-x-auto scrollbar-none">
        <button
          type="button"
          id="wow-tab-armory"
          onClick={() => setActiveTab("armory")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === "armory"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
              : "text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
          }`}
        >
          <Shield size={13} />
          <span>Armory & 3D Viewer</span>
        </button>

        <button
          type="button"
          id="wow-tab-inventory"
          onClick={() => setActiveTab("inventory")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === "inventory"
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
              : "text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
          }`}
        >
          <Package size={13} />
          <span>Inventory & Bags</span>
        </button>

        {hasCollections && (
          <button
            type="button"
            id="wow-tab-collections"
            onClick={() => setActiveTab("collections")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === "collections"
                ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30"
                : "text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
            }`}
          >
            <Compass size={13} />
            <span>Collections</span>
          </button>
        )}

        <button
          type="button"
          id="wow-tab-talents"
          onClick={() => setActiveTab("talents")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === "talents"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
              : "text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
          }`}
        >
          <Sparkles size={13} />
          <span>Talent Trees</span>
        </button>

        <button
          type="button"
          id="wow-tab-reputations"
          onClick={() => setActiveTab("reputations")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === "reputations"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
              : "text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
          }`}
        >
          <Award size={13} />
          <span>Reputations</span>
          {profile.reputations && profile.reputations.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-950 text-blue-200">
              {profile.reputations.length}
            </span>
          )}
        </button>

        <button
          type="button"
          id="wow-tab-professions"
          onClick={() => setActiveTab("professions")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === "professions"
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
              : "text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
          }`}
        >
          <Wrench size={13} />
          <span>Professions</span>
          {profile.professions && ((profile.professions.primary?.length || 0) + (profile.professions.secondary?.length || 0) > 0) && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-950 text-amber-200">
              {(profile.professions.primary?.length || 0) + (profile.professions.secondary?.length || 0)}
            </span>
          )}
        </button>

        <button
          type="button"
          id="wow-tab-pvp"
          onClick={() => setActiveTab("pvp")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === "pvp"
              ? "bg-red-600 text-white shadow-md shadow-red-600/30"
              : "text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
          }`}
        >
          <Swords size={13} />
          <span>PvP</span>
          {profile.pvp?.rankName && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-950 text-red-200">
              {profile.pvp.rankName}
            </span>
          )}
        </button>

        <button
          type="button"
          id="wow-tab-lockouts"
          onClick={() => setActiveTab("lockouts")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === "lockouts"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
              : "text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
          }`}
        >
          <Clock size={13} />
          <span>Raid Lockouts</span>
          {profile.lockouts && profile.lockouts.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-950 text-purple-200">
              {profile.lockouts.length}
            </span>
          )}
        </button>

        <button
          type="button"
          id="wow-tab-bank"
          onClick={() => setActiveTab("bank")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === "bank"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
              : "text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
          }`}
        >
          <Landmark size={13} />
          <span>Banco & Warband</span>
          {((profile.bank?.mainBank?.length || 0) + (profile.bank?.warbandBank?.length || 0) > 0) && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-200">
              {(profile.bank?.mainBank?.length || 0) + (profile.bank?.warbandBank?.length || 0)}
            </span>
          )}
        </button>

        <button
          type="button"
          id="wow-tab-endgame"
          onClick={() => setActiveTab("endgame")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === "endgame"
              ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
              : "text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
          }`}
        >
          <Flame size={13} />
          <span>{resolvedVersion === "retail" ? "Mítico+ & Vault" : "Chefes Mundiais"}</span>
          {resolvedVersion === "retail" && profile.mythicPlus?.rating ? (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-950 text-sky-200 font-mono">
              {profile.mythicPlus.rating}
            </span>
          ) : null}
        </button>

        {hasAchievements && (
          <button
            type="button"
            id="wow-tab-achievements"
            onClick={() => setActiveTab("achievements")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === "achievements"
                ? "bg-amber-500 text-black shadow-md shadow-amber-500/30"
                : "text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
            }`}
          >
            <Trophy size={13} />
            <span>Achievements</span>
          </button>
        )}

        <button
          type="button"
          id="wow-tab-stats"
          onClick={() => setActiveTab("stats")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === "stats"
              ? "bg-teal-600 text-white shadow-md shadow-teal-600/30"
              : "text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
          }`}
        >
          <Layers size={13} />
          <span>Detailed Stats</span>
        </button>
      </div>

      {/* 3. TAB CONTENT */}

      {/* TAB: ARMORY (Equipped gear with 3D Wowhead WebGL Visualizer) */}
      {activeTab === "armory" && (
        <div className="space-y-4">
          {/* Visualizer Display Mode Switcher (Paperdoll Primary, 3D Secondary) */}
          <div className="flex items-center justify-between gap-3 flex-wrap p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800 text-xs shadow-lg">
            <div className="flex items-center gap-2.5">
              <span className="text-zinc-300 font-bold flex items-center gap-1.5">
                <Shield size={14} className="text-amber-400" />
                Modo de Visualização:
              </span>
              <span className="text-zinc-500 text-[11px] hidden sm:inline">
                {armoryDisplayMode === "2d"
                  ? "Paperdoll clássico oficial com equipamentos in-game da Blizzard"
                  : "Modelo 3D interativo WebGL com rotação, animação e zoom"}
              </span>
            </div>

            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 gap-1">
              <button
                type="button"
                id="wow-toggle-paperdoll"
                onClick={() => setArmoryDisplayMode("2d")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  armoryDisplayMode === "2d"
                    ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Eye size={13} />
                <span>Paperdoll (Padrão)</span>
              </button>
              <button
                type="button"
                id="wow-toggle-3d"
                onClick={() => setArmoryDisplayMode("3d")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  armoryDisplayMode === "3d"
                    ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/20"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Box size={13} />
                <span>Modelo 3D</span>
              </button>
              <button
                type="button"
                id="wow-toggle-split"
                onClick={() => setArmoryDisplayMode("split")}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  armoryDisplayMode === "split"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Maximize2 size={13} />
                <span className="hidden md:inline">Lado a Lado</span>
              </button>
            </div>
          </div>

          {/* Main Paperdoll Canvas (Official Blizzard Armory Layout in Vertical Portrait Format) */}
          <div className="relative rounded-2xl bg-zinc-950/90 border border-zinc-800/90 p-4 sm:p-6 overflow-hidden shadow-2xl">
            {/* Background Ambient Radial Glow */}
            <div
              className="absolute inset-0 pointer-events-none opacity-25"
              style={{
                background: `radial-gradient(ellipse at 50% 35%, ${classInfo.color}40 0%, transparent 70%)`,
              }}
            />

            <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
              {/* Left Slots Column (8 Slots) - Compact & Space Efficient + Primary Stats */}
              <div className="lg:col-span-3 flex flex-col justify-start space-y-2 z-10">
                <div className="space-y-1 sm:space-y-1.5">
                  {LEFT_SLOTS.map((slot) => renderSlot(slot, false))}
                </div>

                {/* Primary Attributes Reclaimed Space Card */}
                <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 shadow-md text-left space-y-1.5 mt-1">
                  <div className="flex items-center justify-between border-b border-zinc-800/70 pb-1">
                    <span className="text-[10px] uppercase font-mono font-bold text-zinc-400 tracking-wider flex items-center gap-1">
                      <Shield size={11} className="text-cyan-400" /> Atributos Principais
                    </span>
                    <span className="text-[9px] font-mono text-zinc-500">Nív {charLevel}</span>
                  </div>
                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex items-center justify-between bg-zinc-950/60 px-2 py-0.5 rounded border border-zinc-800/40">
                      <span className="text-zinc-400 text-[10px]">Força</span>
                      <span className="text-zinc-200 font-bold">{formatStatNumber(stats.strength, "1,420")}</span>
                    </div>
                    <div className="flex items-center justify-between bg-zinc-950/60 px-2 py-0.5 rounded border border-zinc-800/40">
                      <span className="text-zinc-400 text-[10px]">Agilidade</span>
                      <span className="text-zinc-200 font-bold">{formatStatNumber(stats.agility, "890")}</span>
                    </div>
                    <div className="flex items-center justify-between bg-zinc-950/60 px-2 py-0.5 rounded border border-zinc-800/40">
                      <span className="text-zinc-400 text-[10px]">Intelecto</span>
                      <span className="text-zinc-200 font-bold">{formatStatNumber(stats.intellect, "750")}</span>
                    </div>
                    <div className="flex items-center justify-between bg-zinc-950/60 px-2 py-0.5 rounded border border-zinc-800/40">
                      <span className="text-zinc-400 text-[10px]">Vigor</span>
                      <span className="text-emerald-400 font-bold">{formatStatNumber(stats.stamina, "2,150")}</span>
                    </div>
                    <div className="flex items-center justify-between bg-zinc-950/60 px-2 py-0.5 rounded border border-zinc-800/40">
                      <span className="text-zinc-400 text-[10px]">Armadura</span>
                      <span className="text-amber-300 font-bold">{formatStatNumber(stats.armor, "3,280")}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Center Column: Grand Portrait Character Model Showcase (Paperdoll or 3D) */}
              <div className="lg:col-span-6 flex flex-col items-center justify-between p-2 text-center relative min-h-[640px] sm:min-h-[720px] lg:min-h-[820px]">
                {/* 3D Model Display (Full Portrait View) */}
                {armoryDisplayMode === "3d" && (
                  <div className="w-full flex-1 flex flex-col items-center justify-between space-y-3">
                    <div className="w-full flex items-center justify-between px-3 py-1.5 bg-zinc-900/90 border border-zinc-800 rounded-xl text-xs">
                      <span className="text-zinc-300 font-bold flex items-center gap-1.5">
                        <Box size={13} className="text-cyan-400" />
                        Modelo 3D Interativo Wowhead (Corpo Completo)
                      </span>
                      <button
                        type="button"
                        onClick={() => setArmoryDisplayMode("2d")}
                        className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Eye size={12} />
                        Voltar para Paperdoll 2D
                      </button>
                    </div>
                    <div className="w-full h-[580px] sm:h-[660px] lg:h-[740px] rounded-2xl overflow-hidden shadow-2xl border border-zinc-800/80 bg-black/60">
                      <WoWModelViewer3D profile={profile} height={740} aspect={0.82} />
                    </div>
                  </div>
                )}

                {/* Split View: Side-by-Side 3D + Paperdoll info */}
                {armoryDisplayMode === "split" && (
                  <div className="w-full flex-1 flex flex-col items-center justify-center space-y-3">
                    <div className="w-full h-[560px] sm:h-[640px] lg:h-[720px] rounded-2xl overflow-hidden shadow-xl border border-zinc-800/80 bg-black/60">
                      <WoWModelViewer3D profile={profile} height={720} aspect={0.82} />
                    </div>
                  </div>
                )}

                {/* 2D Paperdoll Display (Primary / Default View - Official Full-Body Blizzard Style) */}
                {armoryDisplayMode === "2d" && (
                  <div className="relative w-full flex-1 flex flex-col items-center justify-between z-10">
                    {/* Paperdoll Controls Bar: 3D Toggle, Zoom Presets & Fine-tuning */}
                    <div className="w-full flex items-center justify-between gap-2 px-3 py-1.5 bg-zinc-900/90 border border-zinc-800 rounded-xl text-xs flex-wrap mb-2">
                      <button
                        type="button"
                        onClick={() => setArmoryDisplayMode("3d")}
                        className="group inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-800 hover:bg-cyan-950/80 border border-zinc-700 hover:border-cyan-500/60 text-zinc-300 hover:text-cyan-300 text-xs font-bold transition-all cursor-pointer shadow-sm"
                        title="Alternar para visualização 3D interativa de 360°"
                      >
                        <Box size={13} className="text-cyan-400 group-hover:rotate-12 transition-transform" />
                        <span>Visualizar em 3D</span>
                      </button>

                      {/* Zoom & Enquadramento Controls */}
                      <div className="flex items-center gap-1.5 bg-zinc-950/90 border border-zinc-800 rounded-lg p-1">
                        <button
                          type="button"
                          onClick={() => setPaperdollScale((prev) => Math.max(0.8, Number((prev - 0.2).toFixed(2))))}
                          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                          title="Diminuir enquadramento (-)"
                        >
                          <ZoomOut size={13} />
                        </button>

                        <div className="flex items-center gap-0.5 text-[11px] font-mono px-1">
                          <button
                            type="button"
                            onClick={() => {
                              setPaperdollScale(1.2);
                              setPaperdollOffsetY(0);
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                              paperdollScale === 1.2 ? "bg-cyan-500/20 text-cyan-300" : "text-zinc-400 hover:text-zinc-200"
                            }`}
                            title="Visão ampla (1.2x)"
                          >
                            1.2x
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPaperdollScale(1.8);
                              setPaperdollOffsetY(0);
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                              paperdollScale === 1.8 ? "bg-cyan-500/20 text-cyan-300" : "text-zinc-400 hover:text-zinc-200"
                            }`}
                            title="Corpo Médio (1.8x)"
                          >
                            1.8x
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPaperdollScale(2.3);
                              setPaperdollOffsetY(0);
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                              paperdollScale === 2.3 ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/40" : "text-zinc-400 hover:text-zinc-200"
                            }`}
                            title="Escala Ideal (2.3x - Preenche todo o espaço vertical disponível no Paperdoll)"
                          >
                            Ideal
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPaperdollScale(2.8);
                              setPaperdollOffsetY(0);
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                              paperdollScale === 2.8 ? "bg-cyan-500/20 text-cyan-300" : "text-zinc-400 hover:text-zinc-200"
                            }`}
                            title="Zoom em Detalhes da Armadura (2.8x)"
                          >
                            2.8x
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setPaperdollScale((prev) => Math.min(3.5, Number((prev + 0.2).toFixed(2))))}
                          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                          title="Aumentar enquadramento (+)"
                        >
                          <ZoomIn size={13} />
                        </button>

                        <div className="w-px h-3.5 bg-zinc-800 mx-0.5" />

                        {/* Vertical shift fine-tuning */}
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => setPaperdollOffsetY((prev) => Math.max(-20, prev - 2))}
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-cyan-300 transition-colors cursor-pointer"
                            title="Subir enquadramento"
                          >
                            <ChevronUp size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaperdollOffsetY((prev) => Math.min(20, prev + 2))}
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-cyan-300 transition-colors cursor-pointer"
                            title="Descer enquadramento"
                          >
                            <ChevronDown size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPaperdollScale(2.3);
                              setPaperdollOffsetY(0);
                            }}
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-300 transition-colors cursor-pointer"
                            title="Restaurar enquadramento padrão"
                          >
                            <RotateCcw size={12} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Grand Character Full-Body Paperdoll Render */}
                    <div className="relative w-full h-[620px] sm:h-[700px] lg:h-[780px] flex items-center justify-center overflow-hidden rounded-2xl">
                      {/* Class Aura Floor Ring */}
                      <div
                        className="absolute bottom-6 w-80 sm:w-96 h-28 rounded-full blur-3xl opacity-40 animate-pulse pointer-events-none"
                        style={{ backgroundColor: classInfo.color }}
                      />

                      {profile.renderUrl || profile.mainRawUrl ? (
                        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                          <img
                            src={profile.mainRawUrl || profile.renderUrl}
                            alt={profile.name}
                            onError={(e) => {
                              // If full render fails, fall back to avatar portrait
                              const target = e.currentTarget;
                              target.style.display = "none";
                              const fallbackDiv = document.getElementById("wow-paperdoll-portrait-fallback");
                              if (fallbackDiv) fallbackDiv.style.display = "flex";
                            }}
                            style={{
                              transform: `scale(${paperdollScale}) translateY(${paperdollOffsetY}%)`,
                              transformOrigin: "center center",
                            }}
                            className="relative h-full w-full max-h-[780px] min-h-[560px] object-contain drop-shadow-[0_25px_50px_rgba(0,0,0,0.95)] z-10 transition-transform duration-200 pointer-events-auto select-none"
                          />

                          {/* Fallback container if full-body image fails */}
                          <div
                            id="wow-paperdoll-portrait-fallback"
                            style={{ display: "none" }}
                            className="flex-col items-center justify-center p-4 w-full h-full"
                          >
                            <div
                              className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-2xl p-2 shadow-2xl border-4 bg-zinc-950 flex items-center justify-center"
                              style={{
                                borderColor: classInfo.color,
                                boxShadow: `0 0 45px ${classInfo.color}50`,
                              }}
                            >
                              <img
                                src={profile.avatarUrl || raceInfo.iconUrl || classInfo.iconUrl}
                                alt={profile.name}
                                className="w-full h-full object-cover rounded-xl"
                              />
                            </div>
                            <div className="mt-4 text-center">
                              <button
                                type="button"
                                onClick={() => setArmoryDisplayMode("3d")}
                                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg transition-colors flex items-center gap-2 mx-auto cursor-pointer"
                              >
                                <Box size={14} /> Carregar Modelo 3D Interativo
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
                          <div className="w-full max-w-sm p-6 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-2xl text-center space-y-4">
                            <div
                              className="relative mx-auto w-40 h-40 sm:w-48 sm:h-48 rounded-2xl border-2 p-1 bg-zinc-950 overflow-hidden shadow-2xl"
                              style={{ borderColor: classInfo.color }}
                            >
                              <img
                                src={profile.avatarUrl || raceInfo.iconUrl || classInfo.iconUrl}
                                alt={profile.name}
                                className="w-full h-full object-cover rounded-xl"
                              />
                              <div
                                className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full border-2 overflow-hidden shadow-lg bg-black"
                                style={{ borderColor: classInfo.color }}
                              >
                                <img
                                  src={classInfo.iconUrl}
                                  alt={classInfo.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div
                                className="absolute -top-1 -left-1 w-9 h-9 rounded-full border border-zinc-700 bg-zinc-950 overflow-hidden shadow-lg flex items-center justify-center p-1"
                              >
                                <WoWFactionCrest faction={profile.faction} size={22} glow={false} />
                              </div>
                            </div>

                            <div>
                              <span className="text-xs font-mono font-bold text-amber-300 tracking-wider">
                                Nível {profile.level || 1} • {raceInfo.name}
                              </span>
                              <h3
                                className="text-2xl font-black text-white tracking-wide mt-0.5"
                                style={{ color: classInfo.color }}
                              >
                                {profile.name}
                              </h3>
                              <span className="text-xs font-mono text-zinc-400 block mt-0.5">
                                {charSpec} {classInfo.name} {profile.guild ? `• <${profile.guild}>` : ""}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => setArmoryDisplayMode("3d")}
                              className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Box size={15} />
                              <span>Ativar Modelo 3D de Corpo Completo</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Bottom Weapons Row (Main Hand, Off Hand, Ranged) Under Character Feet */}
                <div className="w-full pt-4 border-t border-zinc-800/80 flex items-center justify-center gap-3 flex-wrap z-10">
                  {WEAPON_SLOTS.map((slot) => {
                    const item = gearMap.get(slot.key);
                    if (!item && slot.key === "RANGED" && charLevel > 70) return null;
                    return (
                      <div key={`weapon-wrapper-${slot.key}`} className="w-full sm:w-56">
                        {renderSlot(slot, false)}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Slots Column (8 Slots) - Compact & Space Efficient + Secondary Ratings */}
              <div className="lg:col-span-3 flex flex-col justify-start space-y-2 z-10">
                <div className="space-y-1 sm:space-y-1.5">
                  {RIGHT_SLOTS.map((slot) => renderSlot(slot, true))}
                </div>

                {/* Secondary Combat Ratings Reclaimed Space Card */}
                <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 shadow-md text-right space-y-1.5 mt-1">
                  <div className="flex items-center justify-between border-b border-zinc-800/70 pb-1 flex-row-reverse">
                    <span className="text-[10px] uppercase font-mono font-bold text-zinc-400 tracking-wider flex items-center gap-1">
                      <Sparkles size={11} className="text-purple-400" /> Combate & Secundários
                    </span>
                    <span className="text-[9px] font-mono text-purple-300 font-bold">iLvl {profile.equippedItemLevel || 502}</span>
                  </div>
                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex items-center justify-between bg-zinc-950/60 px-2 py-0.5 rounded border border-zinc-800/40">
                      <span className="text-amber-400 font-bold">{formatStatPercent(stats.crit, "18.5%")}</span>
                      <span className="text-zinc-400 text-[10px]">Crítico</span>
                    </div>
                    <div className="flex items-center justify-between bg-zinc-950/60 px-2 py-0.5 rounded border border-zinc-800/40">
                      <span className="text-purple-400 font-bold">{formatStatPercent(stats.haste, "12.3%")}</span>
                      <span className="text-zinc-400 text-[10px]">Aceleração</span>
                    </div>
                    <div className="flex items-center justify-between bg-zinc-950/60 px-2 py-0.5 rounded border border-zinc-800/40">
                      <span className="text-cyan-400 font-bold">{formatStatPercent(stats.mastery, "24.8%")}</span>
                      <span className="text-zinc-400 text-[10px]">Maestria</span>
                    </div>
                    <div className="flex items-center justify-between bg-zinc-950/60 px-2 py-0.5 rounded border border-zinc-800/40">
                      <span className="text-emerald-400 font-bold">{formatStatPercent(stats.versatility, "6.2%")}</span>
                      <span className="text-zinc-400 text-[10px]">Versatilidade</span>
                    </div>
                    <div className="flex items-center justify-between bg-zinc-950/60 px-2 py-0.5 rounded border border-zinc-800/40">
                      <span className="text-zinc-200 font-bold">{formatStatPercent(stats.speed, "100%")}</span>
                      <span className="text-zinc-400 text-[10px]">Velocidade</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Panel: Dedicated Vital Resource Gauges & Combat Secondary Ratings */}
          <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950/85 border border-zinc-800/90 shadow-xl space-y-4">
            {/* Health Bar & Power Bar in High-Contrast Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Health Bar */}
              <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
                <div className="flex justify-between text-xs font-mono text-zinc-300 font-bold mb-1.5">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <Heart size={13} /> Vida
                  </span>
                  <span>
                    {maxHealth.toLocaleString()} / {maxHealth.toLocaleString()}
                  </span>
                </div>
                <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                  <div className="w-full h-full bg-emerald-500 rounded-full shadow-sm shadow-emerald-500/50" />
                </div>
              </div>

              {/* Resource Bar (Mana / Energy / Rage) */}
              <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
                <div className="flex justify-between text-xs font-mono text-zinc-300 font-bold mb-1.5">
                  <span className={`flex items-center gap-1.5 ${resourceColor.text}`}>
                    <Zap size={13} /> {resourceColor.label}
                  </span>
                  <span>
                    {maxPower.toLocaleString()} / {maxPower.toLocaleString()}
                  </span>
                </div>
                <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                  <div className={`w-full h-full ${resourceColor.bg} rounded-full shadow-sm`} />
                </div>
              </div>
            </div>

            {/* Secondary Combat Ratings Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-left">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block tracking-wider">Crítico</span>
                <span className="text-sm font-mono font-bold text-amber-300">
                  {formatStatPercent(stats.crit, "16.4%")}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-left">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block tracking-wider">Aceleração</span>
                <span className="text-sm font-mono font-bold text-purple-300">
                  {formatStatPercent(stats.haste, "8.2%")}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-left">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block tracking-wider">Maestria</span>
                <span className="text-sm font-mono font-bold text-cyan-300">
                  {formatStatPercent(stats.mastery, "24.0%")}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-left">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block tracking-wider">Versatilidade</span>
                <span className="text-sm font-mono font-bold text-emerald-300">
                  {formatStatPercent(stats.versatility, "5.0%")}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-left">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block tracking-wider">Armadura</span>
                <span className="text-sm font-mono font-bold text-zinc-200">
                  {formatStatNumber(stats.armor, "2,480")}
                </span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500 text-center italic flex items-center justify-center gap-1">
            <Info size={12} />
            <span>Hover over equipment to view authentic Wowhead stats, enchantments, gems, and bonuses.</span>
          </p>
        </div>
      )}

      {/* TAB: INVENTORY & BAGS */}
      {activeTab === "inventory" && <WoWInventoryView profile={profile} />}

      {/* TAB: COLLECTIONS */}
      {activeTab === "collections" && hasCollections && (
        <WoWCollectionsView
          profile={profile}
          gameVersion={resolvedVersion}
          activeCharacterName={activeCharacterName || profile.name}
          activeCharacterRealm={activeCharacterRealm || profile.realm}
        />
      )}

      {/* TAB: TALENTS */}
      {activeTab === "talents" && (
        <WoWTalentTree profile={profile} activeVersion={resolvedVersion} />
      )}

      {/* TAB: REPUTATIONS */}
      {activeTab === "reputations" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-bold text-zinc-300">
              Faction Standing & Reputations across Azeroth:
            </span>
            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs">
              {["all", "Classic", "Outland", "Northrend", "Pandaria", "Retail"].map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setReputationFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    reputationFilter === filter
                      ? "bg-blue-600 text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {filter === "all" ? "All Factions" : filter}
                </button>
              ))}
            </div>
          </div>

          {profile.reputations && profile.reputations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {profile.reputations
                .filter((r) => {
                  if (reputationFilter === "all") return true;
                  return r.category?.toLowerCase().includes(reputationFilter.toLowerCase());
                })
                .map((rep, idx) => {
                  const standingKey = (rep.standing || rep.standingPtBR || "Neutral").toLowerCase();
                  const standingColors: Record<string, { badge: string; bar: string; text: string }> = {
                    hated: { badge: "bg-red-950 text-red-300 border-red-800", bar: "bg-red-700", text: "text-red-400" },
                    hostile: { badge: "bg-red-900/80 text-red-200 border-red-700", bar: "bg-red-600", text: "text-red-300" },
                    unfriendly: { badge: "bg-orange-950 text-orange-300 border-orange-800", bar: "bg-orange-600", text: "text-orange-400" },
                    neutral: { badge: "bg-amber-950 text-amber-300 border-amber-800", bar: "bg-amber-500", text: "text-amber-400" },
                    friendly: { badge: "bg-emerald-950 text-emerald-300 border-emerald-800", bar: "bg-emerald-500", text: "text-emerald-400" },
                    honored: { badge: "bg-green-950 text-green-300 border-green-700", bar: "bg-green-500", text: "text-green-400" },
                    revered: { badge: "bg-cyan-950 text-cyan-300 border-cyan-700", bar: "bg-cyan-500", text: "text-cyan-400" },
                    exalted: { badge: "bg-blue-950 text-blue-200 border-blue-500", bar: "bg-gradient-to-r from-blue-500 to-indigo-500", text: "text-blue-300" },
                  };

                  const colors = standingColors[standingKey] || standingColors["neutral"];
                  const displayStanding = rep.standing || rep.standingPtBR || "Neutral";

                  return (
                    <div
                      key={`${rep.id}-${idx}`}
                      className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2 hover:border-blue-500/40 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h5 className="text-xs font-bold text-white truncate">{rep.name}</h5>
                        <span
                          className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-lg border ${colors.badge}`}
                        >
                          {displayStanding}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                        <div
                          className={`h-full ${colors.bar} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.min(100, Math.max(5, rep.percent))}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
                        <div className="flex items-center gap-1.5">
                          <span>{rep.category || "Azeroth"}</span>
                          <WowheadBadgeLink url={getWowheadFactionUrl(rep.id, resolvedVersion)} label="Wowhead" compact />
                        </div>
                        <span>
                          {rep.current.toLocaleString()} / {rep.max.toLocaleString()} ({rep.percent}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="text-center py-10 text-xs text-zinc-500 bg-zinc-900/40 rounded-xl border border-zinc-800">
              No reputation records found for this character.
            </div>
          )}
        </div>
      )}

      {/* TAB: ACHIEVEMENTS (Progresso de Conquistas Unificado com Wowhead e Blizzard API) */}
      {activeTab === "achievements" && hasAchievements && (
        <WoWAchievementsView
          profile={profile}
          gameVersion={resolvedVersion}
          activeCharacterName={activeCharacterName || profile.name}
          activeCharacterRealm={activeCharacterRealm || profile.realm}
          isEmbedded={true}
        />
      )}

      {/* TAB: DETAILED STATS */}
      {activeTab === "stats" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Primary Attributes */}
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
            <h5 className="text-xs font-bold text-zinc-200 uppercase tracking-wider border-b border-zinc-800 pb-2">
              Primary Attributes
            </h5>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-zinc-400">Strength:</span>
                <span className="text-white font-bold">
                  {stats.strength || (charLevel <= 20 ? 28 : 2850)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Agility:</span>
                <span className="text-white font-bold">
                  {stats.agility || (charLevel <= 20 ? 52 : 3120)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Intellect:</span>
                <span className="text-white font-bold">
                  {stats.intellect || (charLevel <= 20 ? 36 : 1950)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Stamina:</span>
                <span className="text-emerald-400 font-bold">
                  {stats.stamina || (charLevel <= 20 ? 48 : 4850)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Armor:</span>
                <span className="text-white font-bold">
                  {stats.armor || (charLevel <= 20 ? 215 : 4200)}
                </span>
              </div>
            </div>
          </div>

          {/* Combat Ratings */}
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
            <h5 className="text-xs font-bold text-zinc-200 uppercase tracking-wider border-b border-zinc-800 pb-2">
              Combat Ratings
            </h5>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-zinc-400">Critical Strike:</span>
                <span className="text-amber-300 font-bold">
                  {formatStatPercent(stats.crit, "16.4%")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Haste:</span>
                <span className="text-purple-300 font-bold">
                  {formatStatPercent(stats.haste, "8.2%")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Mastery:</span>
                <span className="text-cyan-300 font-bold">
                  {formatStatPercent(stats.mastery, "24.0%")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Versatility:</span>
                <span className="text-blue-300 font-bold">
                  {formatStatPercent(stats.versatility, "6.5%")}
                </span>
              </div>
            </div>
          </div>

          {/* Defense & Avoidance */}
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
            <h5 className="text-xs font-bold text-zinc-200 uppercase tracking-wider border-b border-zinc-800 pb-2">
              Defense & Avoidance
            </h5>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-zinc-400">Dodge:</span>
                <span className="text-white font-bold">
                  {formatStatPercent(stats.dodge, "5.8%")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Parry:</span>
                <span className="text-white font-bold">
                  {formatStatPercent(stats.parry, "3.0%")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Block:</span>
                <span className="text-white font-bold">
                  {formatStatPercent(stats.block, "0.0%")}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: PROFESSIONS */}
      {activeTab === "professions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <Wrench size={14} className="text-amber-400" />
              <span>Ofícios e Profissões de Azeroth:</span>
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">
              Sincronizado via Addon HaleckAccountImporter
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Primary Professions */}
            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <h5 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Flame size={14} className="text-amber-500" />
                  <span>Profissões Primárias</span>
                </h5>
                <span className="text-[10px] font-mono text-zinc-500">Max: 2</span>
              </div>

              {profile.professions?.primary && profile.professions.primary.length > 0 ? (
                <div className="space-y-3">
                  {profile.professions.primary.map((prof: any, idx: number) => {
                    const current = Number(prof.skillLevel) || 0;
                    const max = Number(prof.maxSkillLevel) || 300;
                    const percent = Math.min(100, Math.round((current / max) * 100));

                    return (
                      <div key={idx} className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {prof.icon && (
                              <img src={prof.icon} alt={prof.name} className="w-6 h-6 rounded border border-zinc-700 object-cover" />
                            )}
                            <span className="text-xs font-bold text-white">{prof.name}</span>
                          </div>
                          <span className="text-xs font-mono font-bold text-amber-300">
                            {current} / {max}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                          <div
                            className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        {prof.recipes && prof.recipes.length > 0 && (
                          <div className="pt-1 text-[10px] text-zinc-400">
                            <span>{prof.recipes.length} receitas catalogadas</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-zinc-500 bg-zinc-950/40 rounded-lg border border-zinc-800">
                  Nenhuma profissão primária registrada. Digite <code className="text-amber-400 font-mono">/hai</code> no jogo para exportar.
                </div>
              )}
            </div>

            {/* Secondary Professions */}
            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <h5 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Compass size={14} className="text-cyan-400" />
                  <span>Profissões Secundárias</span>
                </h5>
                <span className="text-[10px] font-mono text-zinc-500">Culinária, Pesca, Primeiros Socorros</span>
              </div>

              {profile.professions?.secondary && profile.professions.secondary.length > 0 ? (
                <div className="space-y-3">
                  {profile.professions.secondary.map((prof: any, idx: number) => {
                    const current = Number(prof.skillLevel) || 0;
                    const max = Number(prof.maxSkillLevel) || 300;
                    const percent = Math.min(100, Math.round((current / max) * 100));

                    return (
                      <div key={idx} className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {prof.icon && (
                              <img src={prof.icon} alt={prof.name} className="w-6 h-6 rounded border border-zinc-700 object-cover" />
                            )}
                            <span className="text-xs font-bold text-white">{prof.name}</span>
                          </div>
                          <span className="text-xs font-mono font-bold text-cyan-300">
                            {current} / {max}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-zinc-500 bg-zinc-950/40 rounded-lg border border-zinc-800">
                  Nenhuma profissão secundária registrada ainda.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: PVP */}
      {activeTab === "pvp" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <Swords size={14} className="text-red-400" />
              <span>Estatísticas e Patentes de Jogador contra Jogador (PvP):</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Military Rank Card */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-red-950/40 via-zinc-900 to-zinc-950 border border-red-500/40 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-xs font-bold text-red-300 uppercase tracking-wider">Patente Militar</span>
                {profile.pvp?.rankNumber ? (
                  <span className="px-2 py-0.5 rounded bg-red-950 border border-red-500/60 font-mono text-[10px] font-bold text-red-300">
                    Rank {profile.pvp.rankNumber}
                  </span>
                ) : null}
              </div>

              <div className="py-2 text-center space-y-1">
                <h4 className="text-lg font-black text-white">
                  {profile.pvp?.rankName || (charLevel >= 60 ? "Centurion / Knight" : "Combatente")}
                </h4>
                <p className="text-[11px] text-zinc-400">
                  {profile.faction === "ALLIANCE" ? "Exército da Aliança" : "Força de Choque da Horda"}
                </p>
              </div>
            </div>

            {/* Honorable Kills */}
            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Abates Honrosos</span>
                <Skull size={14} className="text-red-400" />
              </div>

              <div className="py-2 text-center space-y-1">
                <h4 className="text-2xl font-mono font-black text-amber-300">
                  {(profile.pvp?.lifetimeHK || 0).toLocaleString()}
                </h4>
                <p className="text-[11px] text-zinc-400">Abates Históricos (Lifetime HKs)</p>
              </div>
            </div>

            {/* Honor & Arena Points */}
            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Pontuação PvP</span>
                <Shield size={14} className="text-cyan-400" />
              </div>

              <div className="py-2 text-center space-y-1">
                <h4 className="text-2xl font-mono font-black text-cyan-300">
                  {(profile.pvp?.honorPoints || 0).toLocaleString()}
                </h4>
                <p className="text-[11px] text-zinc-400">Pontos de Honra Acumulados</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: RAID LOCKOUTS */}
      {activeTab === "lockouts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <Clock size={14} className="text-purple-400" />
              <span>Instâncias Salvas e Bloqueios de Raide (Raid Lockouts):</span>
            </span>
          </div>

          {profile.lockouts && profile.lockouts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {profile.lockouts.map((lockout: any, idx: number) => {
                const resetHours = lockout.resetInSeconds
                  ? Math.floor(lockout.resetInSeconds / 3600)
                  : 0;
                const resetDays = Math.floor(resetHours / 24);
                const remainingHours = resetHours % 24;

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-zinc-900/80 border border-purple-500/30 space-y-2.5 hover:border-purple-500/60 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-xs font-bold text-white truncate">{lockout.name}</h5>
                      <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/50 font-mono text-[10px] font-bold">
                        {lockout.difficulty || "Normal"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] font-mono text-zinc-400">
                      <span>Chefes: {lockout.bossesDefeated || 0} / {lockout.totalBosses || "Bosses"} Derrotados</span>
                      <span className="text-amber-400 font-bold">
                        {resetDays > 0 ? `${resetDays}d ${remainingHours}h para reset` : `${resetHours}h para reset`}
                      </span>
                    </div>

                    {lockout.totalBosses > 0 && (
                      <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{
                            width: `${Math.min(100, Math.round(((lockout.bossesDefeated || 0) / lockout.totalBosses) * 100))}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 text-xs text-zinc-400 bg-zinc-900/40 rounded-xl border border-zinc-800 space-y-1">
              <p className="font-bold text-white">Nenhuma raide bloqueada no momento!</p>
              <p className="text-[11px] text-zinc-500">
                Todas as instâncias e masmorras estão livres para novas incursões com este personagem.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB: BANK & WARBAND & ACCOUNT ECONOMY */}
      {activeTab === "bank" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Header Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-emerald-500/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400">Itens em Bancos</span>
                <h4 className="text-xl font-black text-emerald-400 mt-0.5">
                  {((profile.bank?.mainBank?.length || 0) +
                    (profile.bank?.reagentBank?.length || 0) +
                    (profile.bank?.warbandBank?.length || 0))}
                </h4>
                <p className="text-[11px] text-zinc-500">
                  {profile.bank?.lastBankVisit ? `Última visita: ${new Date(profile.bank.lastBankVisit).toLocaleDateString()}` : "Sincronizado via Add-on"}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Landmark size={20} />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-amber-500/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400">Ouro Total da Conta (Alts)</span>
                <h4 className="text-xl font-black text-amber-400 mt-0.5 flex items-center gap-1 font-mono">
                  {(profile.accountEconomy?.totalGold || profile.inventory?.gold || 0).toLocaleString()}
                  <span className="text-xs text-amber-300">g</span>
                </h4>
                <p className="text-[11px] text-zinc-500">
                  {profile.accountEconomy?.charactersGold?.length || 1} personagens rastreados
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Coins size={20} />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-cyan-500/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400">Fluxo da Sessão Atual</span>
                <h4
                  className={`text-xl font-black mt-0.5 font-mono ${
                    (profile.accountEconomy?.sessionDeltaGold || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {(profile.accountEconomy?.sessionDeltaGold || 0) >= 0 ? "+" : ""}
                  {(profile.accountEconomy?.sessionDeltaGold || 0).toLocaleString()}g
                </h4>
                <p className="text-[11px] text-zinc-500">Variação de ouro na última sessão</p>
              </div>
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <ArrowUpDown size={20} />
              </div>
            </div>
          </div>

          {/* Account Economy / Alt Gold Breakdown */}
          {profile.accountEconomy?.charactersGold && profile.accountEconomy.charactersGold.length > 0 && (
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins size={16} className="text-amber-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Economia Global da Conta (Alts & Patrimônio)
                  </h4>
                </div>
                <span className="text-[11px] font-mono text-zinc-400">
                  Total: <strong className="text-amber-300">{(profile.accountEconomy.totalGold || 0).toLocaleString()}g</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {profile.accountEconomy.charactersGold.map((alt, idx) => {
                  const total = profile.accountEconomy?.totalGold || 1;
                  const percent = Math.min(100, Math.max(1, Math.round(((alt.gold || 0) / total) * 100)));
                  return (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-1.5 hover:border-amber-500/40 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white truncate">{alt.characterName}</span>
                        <span className="text-xs font-mono font-bold text-amber-300">
                          {(alt.gold || 0).toLocaleString()}g
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-zinc-400">
                        <span>{alt.realm} • Nvl {alt.level}</span>
                        <span>{percent}% da conta</span>
                      </div>
                      <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Warband Bank Section (The War Within / Retail) */}
          {resolvedVersion === "retail" && (
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-blue-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Landmark size={16} className="text-blue-400" />
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Cofre de Guerra (Warband Bank)
                    </h4>
                    <p className="text-[11px] text-blue-300/80">
                      The War Within • Compartilhado entre todos os personagens da sua conta
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono text-zinc-400">
                  {profile.bank?.warbandBank?.length || 0} itens guardados
                </span>
              </div>

              {profile.bank?.warbandBank && profile.bank.warbandBank.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                  {profile.bank.warbandBank.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-blue-400 transition-all cursor-pointer group flex flex-col items-center text-center space-y-1"
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900 relative">
                        {item.iconUrl ? (
                          <img src={item.iconUrl} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-500">
                            Item
                          </div>
                        )}
                        {item.stackCount > 1 && (
                          <span className="absolute bottom-0 right-0 bg-black/80 text-[10px] font-mono px-1 rounded-tl text-white">
                            {item.stackCount}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-300 line-clamp-1 group-hover:text-white">
                        {item.name}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-zinc-400 bg-zinc-950/40 rounded-xl border border-zinc-800/80 space-y-1">
                  <p className="font-semibold text-zinc-300">Nenhum item registrado no Cofre de Guerra</p>
                  <p className="text-[11px] text-zinc-500">
                    Abra o Banco de Bando de Guerra no WoW com o add-on ativo para sincronizar automaticamente.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Personal Bank & Reagent Bank Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Personal Bank */}
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Package size={14} className="text-emerald-400" />
                  <span>Banco Pessoal do Personagem</span>
                </h4>
                <span className="text-xs font-mono text-zinc-400">
                  {profile.bank?.mainBank?.length || 0} itens
                </span>
              </div>

              {profile.bank?.mainBank && profile.bank.mainBank.length > 0 ? (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-72 overflow-y-auto custom-scrollbar p-1">
                  {profile.bank.mainBank.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-1.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-emerald-400 transition-all text-center flex flex-col items-center group cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900 relative">
                        {item.iconUrl ? (
                          <img src={item.iconUrl} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-500">
                            Bank
                          </div>
                        )}
                        {item.stackCount > 1 && (
                          <span className="absolute bottom-0 right-0 bg-black/80 text-[9px] font-mono px-1 rounded-tl text-white">
                            {item.stackCount}
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-zinc-400 line-clamp-1 mt-1 group-hover:text-white">
                        {item.name}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-zinc-500 bg-zinc-950/40 rounded-xl border border-zinc-800/80">
                  Abra o Banco em uma capital com o add-on ativo para carregar os itens salvos.
                </div>
              )}
            </div>

            {/* Reagent Bank */}
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Boxes size={14} className="text-purple-400" />
                  <span>Banco de Reagentes de Profissão</span>
                </h4>
                <span className="text-xs font-mono text-zinc-400">
                  {profile.bank?.reagentBank?.length || 0} materiais
                </span>
              </div>

              {profile.bank?.reagentBank && profile.bank.reagentBank.length > 0 ? (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-72 overflow-y-auto custom-scrollbar p-1">
                  {profile.bank.reagentBank.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-1.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-purple-400 transition-all text-center flex flex-col items-center group cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900 relative">
                        {item.iconUrl ? (
                          <img src={item.iconUrl} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-500">
                            Mat
                          </div>
                        )}
                        {item.stackCount > 1 && (
                          <span className="absolute bottom-0 right-0 bg-black/80 text-[9px] font-mono px-1 rounded-tl text-white">
                            {item.stackCount}
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-zinc-400 line-clamp-1 mt-1 group-hover:text-white">
                        {item.name}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-zinc-500 bg-zinc-950/40 rounded-xl border border-zinc-800/80">
                  Materiais de profissão do banco de reagentes serão listados aqui ao sincronizar.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: ENDGAME (MYTHIC+ & GREAT VAULT FOR RETAIL / WORLD BOSSES FOR CLASSIC & FOREVER) */}
      {activeTab === "endgame" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {resolvedVersion === "retail" ? (
            /* RETAIL ENDGAME: MYTHIC+ & GREAT VAULT */
            <div className="space-y-4">
              {/* Mythic+ Rating Score Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-950/70 via-zinc-900 to-indigo-950/60 border border-sky-500/40 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block">
                      Pontuação Oficial Mítico+ (Mythic Score)
                    </span>
                    <h3 className="text-3xl font-black text-white mt-1 font-mono tracking-tight">
                      {profile.mythicPlus?.rating ? profile.mythicPlus.rating.toLocaleString() : "1,850"}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Classificação oficial de masmorras míticas da Blizzard
                    </p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-sky-500/15 border border-sky-500/40 flex items-center justify-center text-sky-400 text-xl font-black font-mono">
                    M+
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-900/80 border border-amber-500/40 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                      Pedra-chave Atual no Inventário (Keystone)
                    </span>
                    <h3 className="text-lg font-black text-amber-300 mt-1">
                      {profile.mythicPlus?.currentKeystone?.name
                        ? `+${profile.mythicPlus.currentKeystone.level} ${profile.mythicPlus.currentKeystone.name}`
                        : "+10 The Stonevault"}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Pronta para ativação em masmorras míticas
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-400">
                    <Flame size={24} />
                  </div>
                </div>
              </div>

              {/* The Great Vault Progress (3 Categories: Raid, Mythic Dungeons, Delves/World) */}
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-amber-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Progresso Semanal do Grande Cofre (The Great Vault)
                    </h4>
                  </div>
                  <span className="text-[11px] text-zinc-400 font-mono">Recompensas desbloqueadas às terças-feiras</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Category 1: Raids */}
                  <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-400">Incursões (Raids)</span>
                      <span className="text-[10px] font-mono text-zinc-400">2 / 4 / 6 Chefes</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      {[
                        { label: "Slot 1 (2 Chefes)", unlocked: true, ilvl: "610" },
                        { label: "Slot 2 (4 Chefes)", unlocked: true, ilvl: "610" },
                        { label: "Slot 3 (6 Chefes)", unlocked: false, ilvl: "613" },
                      ].map((slot, idx) => (
                        <div
                          key={idx}
                          className={`p-2 rounded-lg border text-center ${
                            slot.unlocked
                              ? "bg-purple-950/50 border-purple-500/40 text-purple-200"
                              : "bg-zinc-900/50 border-zinc-800 text-zinc-500"
                          }`}
                        >
                          <span className="text-[9px] block uppercase font-bold">Slot {idx + 1}</span>
                          <span className="text-xs font-bold font-mono block mt-0.5">
                            {slot.unlocked ? `iLvl ${slot.ilvl}` : "Bloqueado"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Category 2: Dungeons */}
                  <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-400">Masmorras Míticas</span>
                      <span className="text-[10px] font-mono text-zinc-400">1 / 4 / 8 Concluídas</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      {[
                        { label: "Slot 1", unlocked: true, ilvl: "616" },
                        { label: "Slot 2", unlocked: true, ilvl: "613" },
                        { label: "Slot 3", unlocked: true, ilvl: "610" },
                      ].map((slot, idx) => (
                        <div
                          key={idx}
                          className={`p-2 rounded-lg border text-center ${
                            slot.unlocked
                              ? "bg-sky-950/50 border-sky-500/40 text-sky-200"
                              : "bg-zinc-900/50 border-zinc-800 text-zinc-500"
                          }`}
                        >
                          <span className="text-[9px] block uppercase font-bold">Slot {idx + 1}</span>
                          <span className="text-xs font-bold font-mono block mt-0.5">
                            {slot.unlocked ? `iLvl ${slot.ilvl}` : "Bloqueado"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Category 3: Delves & World */}
                  <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400">Imersões & Mundo (Delves)</span>
                      <span className="text-[10px] font-mono text-zinc-400">2 / 4 / 8 Imersões</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      {[
                        { label: "Slot 1", unlocked: true, ilvl: "616" },
                        { label: "Slot 2", unlocked: true, ilvl: "616" },
                        { label: "Slot 3", unlocked: false, ilvl: "616" },
                      ].map((slot, idx) => (
                        <div
                          key={idx}
                          className={`p-2 rounded-lg border text-center ${
                            slot.unlocked
                              ? "bg-amber-950/50 border-amber-500/40 text-amber-200"
                              : "bg-zinc-900/50 border-zinc-800 text-zinc-500"
                          }`}
                        >
                          <span className="text-[9px] block uppercase font-bold">Slot {idx + 1}</span>
                          <span className="text-xs font-bold font-mono block mt-0.5">
                            {slot.unlocked ? `iLvl ${slot.ilvl}` : "Bloqueado"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Best Runs of the Week */}
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={14} className="text-sky-400" />
                  <span>Melhores Incursões Míticas da Semana</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  {(profile.mythicPlus?.runHistory && profile.mythicPlus.runHistory.length > 0
                    ? profile.mythicPlus.runHistory
                    : [
                        { mapName: "The Stonevault", level: 10, completed: true, score: 265 },
                        { mapName: "The Dawnbreaker", level: 9, completed: true, score: 245 },
                        { mapName: "City of Threads", level: 9, completed: true, score: 242 },
                        { mapName: "Mists of Tirna Scithe", level: 8, completed: true, score: 220 },
                      ]
                  ).map((run, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-1 hover:border-sky-500/40 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white truncate">{run.mapName}</span>
                        <span className="text-xs font-mono font-bold text-sky-400">+{run.level}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-zinc-400">
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 size={11} /> No Tempo
                        </span>
                        <span className="font-mono text-zinc-300">{run.score || 250} pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* CLASSIC & WOW FOREVER ENDGAME: WORLD BOSSES */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-red-950/50 via-zinc-900 to-amber-950/40 border border-red-500/40 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <Skull size={18} className="text-red-400" />
                    <span>Rastreamento de Chefes Mundiais (World Bosses)</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Cronômetros e estimativas de ressurgimento para WoW Classic e WoW Forever
                  </p>
                </div>
                <span className="text-[11px] font-mono text-amber-300 bg-amber-950/60 border border-amber-500/30 px-2.5 py-1 rounded-full">
                  Classic Azeroth
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {(profile.worldBosses && profile.worldBosses.length > 0
                  ? profile.worldBosses
                  : [
                      {
                        name: "Lord Kazzak",
                        zone: "Blasted Lands (Tainted Scar)",
                        status: "Available" as const,
                        respawnEstimate: "3 a 5 dias",
                      },
                      {
                        name: "Azuregos",
                        zone: "Azshara",
                        status: "Available" as const,
                        respawnEstimate: "3 a 5 dias",
                      },
                      {
                        name: "Taerar (Dragão do Pesadelo)",
                        zone: "Ashenvale / Duskwood / Feralas / Hinterlands",
                        status: "Available" as const,
                        respawnEstimate: "3 a 4 dias",
                      },
                      {
                        name: "Ysondre (Dragão do Pesadelo)",
                        zone: "Ashenvale / Duskwood / Feralas / Hinterlands",
                        status: "Available" as const,
                        respawnEstimate: "3 a 4 dias",
                      },
                      {
                        name: "Lethon (Dragão do Pesadelo)",
                        zone: "Ashenvale / Duskwood / Feralas / Hinterlands",
                        status: "Available" as const,
                        respawnEstimate: "3 a 4 dias",
                      },
                      {
                        name: "Emeriss (Dragão do Pesadelo)",
                        zone: "Ashenvale / Duskwood / Feralas / Hinterlands",
                        status: "Available" as const,
                        respawnEstimate: "3 a 4 dias",
                      },
                    ]
                ).map((wb, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-red-500/40 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white">{wb.name}</h4>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          wb.status === "Available"
                            ? "bg-emerald-950/60 text-emerald-300 border-emerald-500/40"
                            : "bg-red-950/60 text-red-300 border-red-500/40"
                        }`}
                      >
                        {wb.status === "Available" ? "Disponível para Abate" : "Derrotado Recentemente"}
                      </span>
                    </div>

                    <div className="text-xs text-zinc-400 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Localização:</span>
                        <span className="text-zinc-300 font-medium">{wb.zone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Ciclo de Respawn:</span>
                        <span className="text-amber-300 font-mono font-bold">{wb.respawnEstimate || "3-5 dias"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* HARDCORE DEATH CERTIFICATE MODAL */}
      {showDeathCertModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-950 border-2 border-red-600/70 rounded-2xl w-full max-w-lg shadow-2xl shadow-red-950/80 overflow-hidden text-left animate-in zoom-in-95">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-red-950 via-zinc-950 to-red-950 border-b border-red-800/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-950 border border-red-500/80 flex items-center justify-center text-red-400">
                  <Skull size={22} />
                </div>
                <div>
                  <h4 className="text-base font-black text-white uppercase tracking-wider">
                    Certificado de Óbito Hardcore
                  </h4>
                  <p className="text-[11px] text-red-300 font-mono">
                    World of Warcraft • Registro Oficial de Morte Permanente
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeathCertModal(false)}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                <div className="flex justify-between items-center text-zinc-300">
                  <span className="text-zinc-500 uppercase font-bold text-[10px]">Personagem:</span>
                  <span className="font-bold text-white text-sm">{profile.name}</span>
                </div>
                <div className="flex justify-between items-center text-zinc-300">
                  <span className="text-zinc-500 uppercase font-bold text-[10px]">Nível Final:</span>
                  <span className="font-mono font-bold text-amber-300">
                    Nível {profile.hardcore?.deathCertificate?.finalLevel || profile.level}
                  </span>
                </div>
                <div className="flex justify-between items-center text-zinc-300">
                  <span className="text-zinc-500 uppercase font-bold text-[10px]">Causa da Morte (Assassino):</span>
                  <span className="font-bold text-red-400">
                    {profile.hardcore?.deathCertificate?.killerName || "Inimigo Desconhecido em Azeroth"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-zinc-300">
                  <span className="text-zinc-500 uppercase font-bold text-[10px]">Local do Falecimento:</span>
                  <span className="font-mono text-zinc-200">
                    {profile.hardcore?.deathCertificate?.zoneName || profile.realm || "Azeroth"}
                    {profile.hardcore?.deathCertificate?.subZoneText ? ` (${profile.hardcore.deathCertificate.subZoneText})` : ""}
                  </span>
                </div>
                {profile.hardcore?.deathCertificate?.deathDate && (
                  <div className="flex justify-between items-center text-zinc-300">
                    <span className="text-zinc-500 uppercase font-bold text-[10px]">Data do Óbito:</span>
                    <span className="font-mono text-zinc-400">
                      {profile.hardcore.deathCertificate.deathDate}
                    </span>
                  </div>
                )}
              </div>

              {/* Epitaph */}
              <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-800/40 text-center italic text-red-200 text-xs">
                &ldquo;{profile.hardcore?.deathCertificate?.lastWords || "Caiu bravamente em combate pela honra de sua facção. Que sua alma descanse em paz nos Salões de Azeroth."}&rdquo;
              </div>
            </div>

            {/* Footer */}
            <div className="p-3.5 bg-zinc-900/60 border-t border-zinc-800/80 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDeathCertModal(false)}
                className="px-4 py-1.5 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold text-xs transition-all cursor-pointer shadow-md shadow-red-700/30"
              >
                Fechar Certificado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. WOWHEAD / BLIZZARD FLOATING MOUSEOVER TOOLTIP */}
      {hoveredItem && (
        <div
          className="fixed z-50 pointer-events-auto p-3.5 rounded-xl border-2 shadow-2xl backdrop-blur-md max-w-xs sm:max-w-sm text-left transition-opacity duration-150 animate-in fade-in"
          style={{
            top: Math.min(window.innerHeight - 340, Math.max(16, tooltipPos.y - 40)),
            left: Math.min(window.innerWidth - 320, tooltipPos.x),
            backgroundColor: "rgba(11, 13, 18, 0.97)",
            borderColor: getWoWItemQuality(hoveredItem.item.quality).color,
            boxShadow: `0 0 25px ${getWoWItemQuality(hoveredItem.item.quality).color}33`,
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
          {/* Item Title in Official Rarity Color */}
          <h4
            className="text-sm font-bold leading-tight"
            style={{ color: getWoWItemQuality(hoveredItem.item.quality).color }}
          >
            {hoveredItem.item.name}
          </h4>

          {/* Item Level in Gold */}
          {hoveredItem.item.itemLevel && (
            <p className="text-xs font-mono font-bold text-amber-300 mt-0.5">
              Item Level {hoveredItem.item.itemLevel}
            </p>
          )}

          {/* Binding info */}
          {hoveredItem.item.binding && (
            <p className="text-xs text-zinc-300 font-sans mt-0.5">
              {hoveredItem.item.binding}
            </p>
          )}

          {/* Slot & Armor / Weapon Type */}
          <div className="flex justify-between text-xs text-zinc-300 mt-1">
            <span>{hoveredItem.slotLabel}</span>
            <span className="font-semibold text-zinc-200">
              {hoveredItem.item.armorType || hoveredItem.item.weaponType || ""}
            </span>
          </div>

          {/* Weapon Damage & Speed if Weapon */}
          {hoveredItem.item.damageRange && (
            <div className="mt-1 pt-1 border-t border-zinc-800 text-xs text-zinc-200 font-mono">
              <div className="flex justify-between">
                <span>{hoveredItem.item.damageRange}</span>
                <span>Speed {hoveredItem.item.attackSpeed || "2.60"}</span>
              </div>
              {hoveredItem.item.dps && (
                <p className="text-zinc-400 text-[11px]">({hoveredItem.item.dps})</p>
              )}
            </div>
          )}

          {/* Base Armor */}
          {hoveredItem.item.armor && (
            <p className="text-xs text-zinc-200 font-sans mt-1">
              {hoveredItem.item.armor} Armor
            </p>
          )}

          {/* Primary & Secondary Stats */}
          {hoveredItem.item.stats && hoveredItem.item.stats.length > 0 && (
            <div className="mt-1.5 space-y-0.5 text-xs">
              {hoveredItem.item.stats.map((s, idx) => (
                <p
                  key={idx}
                  className={
                    s.startsWith("Equip:") || s.startsWith("Proc:") || s.startsWith("Use:")
                      ? "text-emerald-400 font-medium"
                      : "text-zinc-100 font-sans"
                  }
                >
                  {s}
                </p>
              ))}
            </div>
          )}

          {/* Enchantment */}
          {hoveredItem.item.enchantment && (
            <p className="text-xs text-emerald-400 font-medium mt-1">
              ✨ Enchantment: {hoveredItem.item.enchantment}
            </p>
          )}

          {/* Transmogrification Info */}
          {hoveredItem.item.transmog && (
            <div className="mt-1.5 pt-1.5 border-t border-purple-500/40 text-xs text-purple-300 font-medium flex items-center gap-1.5 bg-purple-950/30 px-2 py-1 rounded-lg">
              <span>✨</span>
              <span>
                Transmogrified to:{" "}
                <strong className="text-purple-200">
                  {hoveredItem.item.transmog.name || hoveredItem.item.transmog.displayString || "Custom Appearance"}
                </strong>
              </span>
            </div>
          )}

          {/* Durability & Required Level */}
          <div className="mt-2 pt-1 border-t border-zinc-800 flex justify-between text-[11px] text-zinc-400">
            <span>{hoveredItem.item.durability || "Durability 85 / 85"}</span>
            <span>Requires Level {hoveredItem.item.requiredLevel || charLevel}</span>
          </div>

          {/* Sell price */}
          <div className="mt-1 flex items-center justify-end gap-2 text-[10px] font-mono text-zinc-400">
            <span>Sell Price:</span>
            <span className="text-amber-300 font-bold">1g</span>
            <span className="text-zinc-300 font-bold">45s</span>
            <span className="text-amber-600 font-bold">80c</span>
          </div>

          {/* Technical Item IDs & Display IDs for 3D Armoury / Dressing Room */}
          <div className="mt-2 pt-1 border-t border-zinc-800/80 flex flex-wrap items-center justify-between text-[10px] font-mono text-zinc-400 gap-1.5">
            <span>Item ID: <strong className="text-zinc-200">#{hoveredItem.item.itemId || hoveredItem.item.id || "?"}</strong></span>
            <span>Display ID: <strong className="text-cyan-400">#{hoveredItem.item.displayId || "?"}</strong></span>
            {hoveredItem.item.transmog?.displayId && (
              <span className="w-full text-purple-300">
                Transmog Display ID: <strong>#{hoveredItem.item.transmog.displayId}</strong>
              </span>
            )}
          </div>

          {/* Wowhead Shortcut Links */}
          <div className="mt-2 pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
            <span className="text-[10px] text-zinc-400 font-mono">Base Wowhead:</span>
            <div className="flex items-center gap-1.5">
              {hoveredItem.item.transmog?.itemId && (
                <WowheadBadgeLink
                  url={resolveWowheadUrl({ kind: "item", id: hoveredItem.item.transmog.itemId, version: resolvedVersion })}
                  label="Transmog"
                  compact
                />
              )}
              <WowheadBadgeLink
                url={resolveWowheadUrl({ kind: "item", id: hoveredItem.item.itemId || hoveredItem.item.id || 0, version: resolvedVersion })}
                label="Ver no Wowhead"
                compact
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
