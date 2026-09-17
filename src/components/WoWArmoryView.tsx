/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import {
  Shield,
  Trophy,
  Heart,
  Zap,
  Sparkles,
  Award,
  Layers,
  ChevronRight,
  Info,
  CircleDot,
  CheckCircle2,
} from "lucide-react";
import {
  BlizzardProfileData,
  BlizzardGearItem,
  BlizzardReputation,
} from "../types";
import {
  getWoWClassInfo,
  getWoWRaceInfo,
  getWoWFactionInfo,
  getWoWItemQuality,
} from "../utils/blizzardIcons";
import { WoWFactionCrest } from "./WoWFactionCrest";
import { WoWTalentTree } from "./WoWTalentTree";

interface WoWArmoryViewProps {
  profile: BlizzardProfileData;
  onRefresh?: () => void;
  isLoading?: boolean;
}

// Paperdoll standard layout slots
const LEFT_SLOTS = [
  { key: "HEAD", label: "Cabeça", defaultIcon: "https://wow.zamimg.com/images/wow/icons/large/inv_helmet_09.jpg" },
  { key: "NECK", label: "Pescoço", defaultIcon: "https://wow.zamimg.com/images/wow/icons/large/inv_jewelry_necklace_07.jpg" },
  { key: "SHOULDER", label: "Ombros", defaultIcon: "https://wow.zamimg.com/images/wow/icons/large/inv_shoulder_02.jpg" },
  { key: "BACK", label: "Costas", defaultIcon: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_cape_16.jpg" },
  { key: "CHEST", label: "Torso", defaultIcon: "https://wow.zamimg.com/images/wow/icons/large/inv_chest_plate06.jpg" },
  { key: "SHIRT", label: "Camisa", defaultIcon: "https://wow.zamimg.com/images/wow/icons/large/inv_shirt_white_01.jpg" },
  { key: "TABARD", label: "Tabardo", defaultIcon: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_tabard_01.jpg" },
  { key: "WRIST", label: "Pulsos", defaultIcon: "https://wow.zamimg.com/images/wow/icons/large/inv_bracer_07.jpg" },
];

const RIGHT_SLOTS = [
  { key: "HANDS", label: "Mãos", defaultIcon: "https://wow.zamimg.com/images/wow/icons/large/inv_gauntlets_04.jpg" },
  { key: "WAIST", label: "Cinto", defaultIcon: "https://wow.zamimg.com/images/wow/icons/large/inv_belt_12.jpg" },
  { key: "LEGS", label: "Pernas", defaultIcon: "https://wow.zamimg.com/images/wow/icons/large/inv_pants_03.jpg" },
  { key: "FEET", label: "Pés", defaultIcon: "https://wow.zamimg.com/images/wow/icons/large/inv_boots_01.jpg" },
  { key: "RING_1", label: "Dedo 1", defaultIcon: "https://wow.zamimg.com/images/wow/icons/large/inv_jewelry_ring_03.jpg" },
  { key: "RING_2", label: "Dedo 2", defaultIcon: "https://wow.zamimg.com/images/wow/icons/large/inv_jewelry_ring_07.jpg" },
  { key: "TRINKET_1", label: "Berloque 1", defaultIcon: "https://wow.zamimg.com/images/wow/icons/large/inv_jewelry_talisman_01.jpg" },
  { key: "TRINKET_2", label: "Berloque 2", defaultIcon: "https://wow.zamimg.com/images/wow/icons/large/inv_misc_gem_bloodstone_01.jpg" },
];

const WEAPON_SLOTS = [
  { key: "MAIN_HAND", label: "Mão Principal", defaultIcon: "https://wow.zamimg.com/images/wow/icons/large/inv_sword_39.jpg" },
  { key: "OFF_HAND", label: "Mão Secundária", defaultIcon: "https://wow.zamimg.com/images/wow/icons/large/inv_shield_06.jpg" },
  { key: "RANGED", label: "Alcance / Relíquia", defaultIcon: "https://wow.zamimg.com/images/wow/icons/large/inv_weapon_bow_08.jpg" },
];

export const WoWArmoryView: React.FC<WoWArmoryViewProps> = ({
  profile,
  onRefresh,
  isLoading = false,
}) => {
  const [activeTab, setActiveTab] = useState<"armory" | "talents" | "reputations" | "achievements" | "stats">("armory");
  const [hoveredItem, setHoveredItem] = useState<{ item: BlizzardGearItem; slotLabel: string } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [reputationFilter, setReputationFilter] = useState<string>("all");

  const charClass = profile.characterClass || "Warrior";
  const charRace = profile.race || "Human";
  const charFaction = profile.faction || "ALLIANCE";
  const charLevel = profile.level || 1;
  const charSpec = profile.activeSpec || "Especialização";

  const classInfo = getWoWClassInfo(charClass);
  const raceInfo = getWoWRaceInfo(charRace, profile.gender);
  const factionInfo = getWoWFactionInfo(charFaction);

  // Map equipped items by slot
  const gearMap = useMemo(() => {
    const map = new Map<string, BlizzardGearItem>();
    const items = profile.equippedItems || profile.gear || [];
    for (const item of items) {
      if (item.slot) {
        map.set(item.slot.toUpperCase(), item);
      }
    }
    return map;
  }, [profile.equippedItems, profile.gear]);

  const stats = profile.stats || {};
  const maxHealth = stats.health || (charLevel <= 20 ? 450 : charLevel <= 60 ? 5200 : 6400000);
  const resourceType = stats.powerType || (classInfo.id === "rogue" ? "ENERGY" : classInfo.id === "warrior" ? "RAGE" : "MANA");
  const maxPower = stats.power || (resourceType === "ENERGY" || resourceType === "RAGE" ? 100 : charLevel <= 20 ? 320 : 250000);

  const resourceColor =
    resourceType === "ENERGY"
      ? { bg: "bg-amber-500", text: "text-amber-400", label: "Energia" }
      : resourceType === "RAGE"
      ? { bg: "bg-red-600", text: "text-red-400", label: "Fúria" }
      : { bg: "bg-cyan-500", text: "text-cyan-400", label: "Mana" };

  const handleMouseEnter = (item: BlizzardGearItem, slotLabel: string, e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      x: rect.right + 12,
      y: rect.top,
    });
    setHoveredItem({ item, slotLabel });
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
  };

  // Render an Equipment Slot for Paperdoll
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
        className={`group relative flex items-center gap-2 p-1.5 rounded-xl border transition-all cursor-pointer ${
          item
            ? `${quality?.bgClass || "bg-zinc-900"} ${quality?.borderClass || "border-zinc-700"} hover:scale-[1.03] hover:shadow-lg hover:shadow-black/70`
            : "bg-zinc-950/40 border-zinc-800/60 opacity-60 hover:opacity-90"
        } ${isRight ? "flex-row-reverse text-right" : "flex-row text-left"}`}
      >
        {/* Item Icon with Quality Glow */}
        <div className="relative shrink-0">
          <img
            src={iconUrl}
            alt={item?.name || slot.label}
            className={`w-10 h-10 rounded-lg border-2 object-cover transition-transform ${
              item ? quality?.borderClass || "border-zinc-600" : "border-zinc-800 grayscale"
            }`}
          />
          {item?.itemLevel && (
            <span className="absolute -bottom-1.5 -right-1 px-1 py-0.2 rounded bg-black/90 text-[9px] font-mono font-black text-amber-300 border border-zinc-800 shadow">
              {item.itemLevel}
            </span>
          )}
        </div>

        {/* Slot / Item Name info */}
        <div className="min-w-0 flex-1 hidden sm:block">
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-mono uppercase font-bold text-zinc-400 block truncate">
              {slot.label}
            </span>
          </div>
          <p
            className="text-xs font-bold truncate leading-tight mt-0.5"
            style={{ color: item && quality ? quality.color : "#71717a" }}
          >
            {item ? item.name : "Vazio"}
          </p>
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
                title={`Classe: ${classInfo.ptBR}`}
              />
              <div
                className={`absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full border-2 overflow-hidden shadow-md bg-zinc-950 flex items-center justify-center p-0.5 ${factionInfo.borderClass}`}
                title={`Facção: ${factionInfo.name}`}
              >
                <WoWFactionCrest faction={profile.faction} size={18} glow={false} />
              </div>
            </div>

            {/* Names, Spec, Guild & Realm */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-black text-white tracking-wide">
                  {profile.name || "Personagem"}
                </h3>
                <span className="text-xs font-mono font-black text-amber-300 bg-amber-950/70 px-2 py-0.5 rounded-lg border border-amber-500/50">
                  Nvl {charLevel}
                </span>
                {profile.guild && (
                  <span className="text-xs font-semibold text-zinc-300 bg-zinc-800/80 px-2 py-0.5 rounded-lg border border-zinc-700">
                    &lt;{profile.guild}&gt;
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1 text-xs text-zinc-300 flex-wrap">
                <span className="font-bold" style={{ color: classInfo.color }}>
                  {raceInfo.ptBR} • {charSpec} {classInfo.ptBR}
                </span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400 font-mono">Reino: {profile.realm || "Azralon"}</span>
                {profile.gameMode && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-zinc-800 text-cyan-300 border border-zinc-700">
                      {profile.gameMode}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Metrics Badges (iLvl & Achievements) */}
          <div className="flex items-center gap-3 flex-wrap">
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
      </div>

      {/* 2. Armory Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 overflow-x-auto">
        <button
          type="button"
          id="wow-tab-armory"
          onClick={() => setActiveTab("armory")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === "armory"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
              : "text-zinc-400 hover:text-white bg-zinc-900"
          }`}
        >
          <Shield size={13} />
          <span>Armory & Equipamentos</span>
        </button>

        <button
          type="button"
          id="wow-tab-talents"
          onClick={() => setActiveTab("talents")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === "talents"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
              : "text-zinc-400 hover:text-white bg-zinc-900"
          }`}
        >
          <Sparkles size={13} />
          <span>Talentos & Especialização</span>
        </button>

        <button
          type="button"
          id="wow-tab-reputations"
          onClick={() => setActiveTab("reputations")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === "reputations"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
              : "text-zinc-400 hover:text-white bg-zinc-900"
          }`}
        >
          <Award size={13} />
          <span>Reputações</span>
          {profile.reputations && profile.reputations.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-950 text-blue-200">
              {profile.reputations.length}
            </span>
          )}
        </button>

        <button
          type="button"
          id="wow-tab-achievements"
          onClick={() => setActiveTab("achievements")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === "achievements"
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
              : "text-zinc-400 hover:text-white bg-zinc-900"
          }`}
        >
          <Trophy size={13} />
          <span>Conquistas</span>
          {profile.achievements && profile.achievements.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-950 text-amber-200">
              {profile.achievements.length}
            </span>
          )}
        </button>

        <button
          type="button"
          id="wow-tab-stats"
          onClick={() => setActiveTab("stats")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === "stats"
              ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30"
              : "text-zinc-400 hover:text-white bg-zinc-900"
          }`}
        >
          <Layers size={13} />
          <span>Atributos Detalhados</span>
        </button>
      </div>

      {/* 3. TAB CONTENT */}

      {/* TAB: ARMORY (Interactive Paperdoll with Wowhead Mouseover) */}
      {activeTab === "armory" && (
        <div className="space-y-4">
          {/* Main Paperdoll Canvas */}
          <div className="relative rounded-2xl bg-zinc-950/80 border border-zinc-800 p-4 overflow-hidden shadow-2xl">
            {/* Atmosphere Backdrop */}
            <div
              className="absolute inset-0 bg-radial from-zinc-800/20 via-zinc-950/90 to-black pointer-events-none"
            />

            <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              {/* Left Slots Column (8 Slots) */}
              <div className="lg:col-span-3 space-y-2">
                {LEFT_SLOTS.map((slot) => renderSlot(slot, false))}
              </div>

              {/* Center Column: Character Model Showcase & Vital Gauges */}
              <div className="lg:col-span-6 flex flex-col items-center justify-center p-2 text-center relative">
                {/* Authentic Faction Watermark Crest behind the character model */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25 z-0">
                  <WoWFactionCrest
                    faction={profile.faction}
                    size={240}
                    glow={true}
                  />
                </div>

                {/* Character Model / Avatar Illustration */}
                <div className="relative w-52 h-64 sm:w-60 sm:h-72 flex flex-col items-center justify-center z-10">
                  {/* Class Aura Ring */}
                  <div
                    className="absolute inset-2 rounded-full blur-2xl opacity-30 animate-pulse"
                    style={{ backgroundColor: classInfo.color }}
                  />

                  {profile.renderUrl && profile.renderUrl.includes("render.worldofwarcraft.com") ? (
                    <img
                      src={profile.renderUrl}
                      alt={profile.name}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                      className="relative w-full h-full object-contain drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)] z-10 transition-transform duration-300 hover:scale-105"
                    />
                  ) : (
                    /* High-Fidelity Armory Character Portrait Showcase */
                    <div className="relative flex flex-col items-center justify-center p-2">
                      {/* Race & Gender Frame */}
                      <div
                        className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-full p-1.5 shadow-2xl border-4 transition-transform duration-300 hover:scale-105 bg-zinc-950"
                        style={{ borderColor: classInfo.color, boxShadow: `0 0 25px ${classInfo.color}40` }}
                      >
                        <img
                          src={profile.avatarUrl || raceInfo.iconUrl || classInfo.iconUrl}
                          alt={profile.name}
                          onError={(e) => {
                            e.currentTarget.src = raceInfo.iconUrl || classInfo.iconUrl;
                          }}
                          className="w-full h-full object-cover rounded-full"
                        />
                        {/* Class Icon Pin */}
                        <div
                          className="absolute -bottom-1 -right-1 w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 overflow-hidden shadow-lg bg-black"
                          style={{ borderColor: classInfo.color }}
                          title={`${classInfo.ptBR} (${charSpec})`}
                        >
                          <img src={classInfo.iconUrl} alt={classInfo.name} className="w-full h-full object-cover" />
                        </div>
                        {/* Faction Mini Shield */}
                        <div
                          className="absolute -top-1 -left-1 w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-zinc-700 bg-zinc-950 overflow-hidden shadow-lg flex items-center justify-center p-1"
                          title={factionInfo.name}
                        >
                          <WoWFactionCrest faction={profile.faction} size={24} glow={false} />
                        </div>
                      </div>

                      {/* Character Title & Name Plaque */}
                      <div className="mt-2.5 text-center">
                        <span className="text-xs font-mono font-bold text-amber-300 tracking-wider">
                          Nv. {profile.level || 1} • {raceInfo.ptBR}
                        </span>
                        <h3 className="text-lg sm:text-xl font-black text-white tracking-wide" style={{ color: classInfo.color }}>
                          {profile.name}
                        </h3>
                        <span className="text-[11px] font-mono text-zinc-400">
                          {charSpec} {classInfo.ptBR} {profile.guild ? `• <${profile.guild}>` : ""}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Vital Resource Bars */}
                <div className="w-full max-w-sm space-y-2 mt-3 z-10">
                  {/* Health Bar */}
                  <div>
                    <div className="flex justify-between text-[11px] font-mono text-zinc-300 font-bold mb-1">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Heart size={11} /> Vida
                      </span>
                      <span>{maxHealth.toLocaleString()} / {maxHealth.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                      <div className="w-full h-full bg-emerald-500 rounded-full shadow-sm shadow-emerald-500/50" />
                    </div>
                  </div>

                  {/* Resource Bar (Mana / Energy / Rage) */}
                  <div>
                    <div className="flex justify-between text-[11px] font-mono text-zinc-300 font-bold mb-1">
                      <span className={`flex items-center gap-1 ${resourceColor.text}`}>
                        <Zap size={11} /> {resourceColor.label}
                      </span>
                      <span>{maxPower.toLocaleString()} / {maxPower.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                      <div className={`w-full h-full ${resourceColor.bg} rounded-full shadow-sm`} />
                    </div>
                  </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-md mt-4 text-left z-10">
                  <div className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-800">
                    <span className="text-[9px] uppercase font-bold text-zinc-500 block">Crítico</span>
                    <span className="text-xs font-mono font-bold text-amber-300">
                      {stats.crit ? `${stats.crit.toFixed(1)}%` : "16.4%"}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-800">
                    <span className="text-[9px] uppercase font-bold text-zinc-500 block">Aceleração</span>
                    <span className="text-xs font-mono font-bold text-purple-300">
                      {stats.haste ? `${stats.haste.toFixed(1)}%` : "8.2%"}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-800">
                    <span className="text-[9px] uppercase font-bold text-zinc-500 block">Maestria</span>
                    <span className="text-xs font-mono font-bold text-cyan-300">
                      {stats.mastery ? `${stats.mastery.toFixed(1)}%` : "24.0%"}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-800">
                    <span className="text-[9px] uppercase font-bold text-zinc-500 block">Armadura</span>
                    <span className="text-xs font-mono font-bold text-zinc-200">
                      {stats.armor ? stats.armor.toLocaleString() : "280"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Slots Column (8 Slots) */}
              <div className="lg:col-span-3 space-y-2">
                {RIGHT_SLOTS.map((slot) => renderSlot(slot, true))}
              </div>
            </div>

            {/* Bottom Weapons Row (Main Hand, Off Hand, Ranged) */}
            <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-center gap-4 flex-wrap">
              {WEAPON_SLOTS.map((slot) => {
                const item = gearMap.get(slot.key);
                if (!item && slot.key === "RANGED" && charLevel > 70) return null;
                return (
                  <div key={slot.key} className="w-full sm:w-60">
                    {renderSlot(slot, false)}
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-[11px] text-zinc-500 text-center italic flex items-center justify-center gap-1">
            <Info size={12} />
            <span>Passe o mouse sobre os equipamentos para inspecionar os atributos oficiais no padrão Wowhead.</span>
          </p>
        </div>
      )}

      {/* TAB: TALENTS */}
      {activeTab === "talents" && (
        <WoWTalentTree profile={profile} />
      )}

      {/* TAB: REPUTATIONS */}
      {activeTab === "reputations" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-bold text-zinc-300">
              Progresso de Reputação com Facções de Azeroth:
            </span>
            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs">
              {["all", "Capitais", "Expansão"].map((filter) => (
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
                  {filter === "all" ? "Todas" : filter}
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
                .map((rep) => {
                  // Standing colors
                  const standingColors: Record<string, { badge: string; bar: string; text: string }> = {
                    Odiado: { badge: "bg-red-950 text-red-300 border-red-800", bar: "bg-red-700", text: "text-red-400" },
                    Hostil: { badge: "bg-red-900/80 text-red-200 border-red-700", bar: "bg-red-600", text: "text-red-300" },
                    Desfavorável: { badge: "bg-orange-950 text-orange-300 border-orange-800", bar: "bg-orange-600", text: "text-orange-400" },
                    Neutro: { badge: "bg-amber-950 text-amber-300 border-amber-800", bar: "bg-amber-500", text: "text-amber-400" },
                    Amistoso: { badge: "bg-emerald-950 text-emerald-300 border-emerald-800", bar: "bg-emerald-500", text: "text-emerald-400" },
                    Honrado: { badge: "bg-green-950 text-green-300 border-green-700", bar: "bg-green-500", text: "text-green-400" },
                    Reverenciado: { badge: "bg-cyan-950 text-cyan-300 border-cyan-700", bar: "bg-cyan-500", text: "text-cyan-400" },
                    Exaltado: { badge: "bg-blue-950 text-blue-200 border-blue-500", bar: "bg-gradient-to-r from-blue-500 to-indigo-500", text: "text-blue-300" },
                  };

                  const colors = standingColors[rep.standingPtBR] || standingColors["Neutro"];

                  return (
                    <div
                      key={rep.id}
                      className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2 hover:border-blue-500/40 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h5 className="text-xs font-bold text-white truncate">
                          {rep.name}
                        </h5>
                        <span
                          className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-lg border ${colors.badge}`}
                        >
                          {rep.standingPtBR}
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
                        <span>{rep.category || "Azeroth"}</span>
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
              Nenhum dado de reputação registrado para este personagem.
            </div>
          )}
        </div>
      )}

      {/* TAB: ACHIEVEMENTS */}
      {activeTab === "achievements" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-zinc-300">
              Conquistas Desbloqueadas pelo Personagem:
            </span>
            <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-500/40 flex items-center gap-1">
              <Trophy size={12} /> {(profile.achievementPoints || 0).toLocaleString()} Pontos
            </span>
          </div>

          {profile.achievements && profile.achievements.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {profile.achievements.map((a) => (
                <div
                  key={a.id}
                  className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-amber-500/40 transition-all flex items-center gap-3"
                >
                  <div className="w-11 h-11 rounded-xl bg-amber-950/60 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-md overflow-hidden">
                    {a.iconUrl ? (
                      <img
                        src={a.iconUrl}
                        alt={a.title}
                        onError={(e) => {
                          e.currentTarget.src = "https://wow.zamimg.com/images/wow/icons/large/achievement_general.jpg";
                        }}
                        className="w-full h-full object-cover rounded-xl"
                      />
                    ) : (
                      <Trophy size={18} className="text-amber-400" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h5 className="text-xs font-bold text-white truncate">
                        {a.title}
                      </h5>
                      {a.points !== undefined && (
                        <span className="text-[10px] font-mono font-black text-amber-300 shrink-0">
                          +{a.points}
                        </span>
                      )}
                    </div>
                    {a.description && (
                      <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5">
                        {a.description}
                      </p>
                    )}
                    {a.completedTimestamp && (
                      <span className="text-[9px] font-mono text-zinc-500 block mt-1">
                        Concluído em: {new Date(a.completedTimestamp * 1000).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-xs text-zinc-500 bg-zinc-900/40 rounded-xl border border-zinc-800">
              Nenhuma conquista registrada no perfil.
            </div>
          )}
        </div>
      )}

      {/* TAB: STATS */}
      {activeTab === "stats" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Atributos Básicos */}
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
            <h5 className="text-xs font-bold text-zinc-200 uppercase tracking-wider border-b border-zinc-800 pb-2">
              Atributos Primários
            </h5>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-zinc-400">Força:</span>
                <span className="text-white font-bold">{stats.strength || (charLevel <= 20 ? 28 : 2850)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Agilidade:</span>
                <span className="text-white font-bold">{stats.agility || (charLevel <= 20 ? 52 : 3120)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Intelecto:</span>
                <span className="text-white font-bold">{stats.intellect || (charLevel <= 20 ? 36 : 1950)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Vigor:</span>
                <span className="text-emerald-400 font-bold">{stats.stamina || (charLevel <= 20 ? 48 : 4850)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Armadura:</span>
                <span className="text-white font-bold">{stats.armor || (charLevel <= 20 ? 215 : 4200)}</span>
              </div>
            </div>
          </div>

          {/* Atributos de Combate */}
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
            <h5 className="text-xs font-bold text-zinc-200 uppercase tracking-wider border-b border-zinc-800 pb-2">
              Ataque & Feitiços
            </h5>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-zinc-400">Acerto Crítico:</span>
                <span className="text-amber-300 font-bold">{stats.crit ? `${stats.crit.toFixed(1)}%` : "16.4%"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Aceleração (Haste):</span>
                <span className="text-purple-300 font-bold">{stats.haste ? `${stats.haste.toFixed(1)}%` : "8.2%"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Maestria:</span>
                <span className="text-cyan-300 font-bold">{stats.mastery ? `${stats.mastery.toFixed(1)}%` : "24.0%"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Versatilidade:</span>
                <span className="text-blue-300 font-bold">{stats.versatility ? `${stats.versatility.toFixed(1)}%` : "6.5%"}</span>
              </div>
            </div>
          </div>

          {/* Defesa */}
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
            <h5 className="text-xs font-bold text-zinc-200 uppercase tracking-wider border-b border-zinc-800 pb-2">
              Defesa & Evasão
            </h5>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-zinc-400">Esquiva (Dodge):</span>
                <span className="text-white font-bold">{stats.dodge ? `${stats.dodge.toFixed(1)}%` : "5.8%"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Aparo (Parry):</span>
                <span className="text-white font-bold">{stats.parry ? `${stats.parry.toFixed(1)}%` : "3.0%"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Bloqueio (Block):</span>
                <span className="text-white font-bold">{stats.block ? `${stats.block.toFixed(1)}%` : "0.0%"}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. WOWHEAD / BLIZZARD FLOATING MOUSEOVER TOOLTIP */}
      {hoveredItem && (
        <div
          className="fixed z-50 pointer-events-none p-3.5 rounded-xl border-2 shadow-2xl backdrop-blur-md max-w-xs sm:max-w-sm text-left transition-opacity duration-150 animate-in fade-in"
          style={{
            top: Math.min(window.innerHeight - 340, Math.max(16, tooltipPos.y - 40)),
            left: Math.min(window.innerWidth - 320, tooltipPos.x),
            backgroundColor: "rgba(11, 13, 18, 0.97)",
            borderColor: getWoWItemQuality(hoveredItem.item.quality).color,
            boxShadow: `0 0 25px ${getWoWItemQuality(hoveredItem.item.quality).color}33`,
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
              Nível de Item {hoveredItem.item.itemLevel}
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
                <span>Velocidade {hoveredItem.item.attackSpeed || "2.60"}</span>
              </div>
              {hoveredItem.item.dps && (
                <p className="text-zinc-400 text-[11px]">({hoveredItem.item.dps})</p>
              )}
            </div>
          )}

          {/* Base Armor */}
          {hoveredItem.item.armor && (
            <p className="text-xs text-zinc-200 font-sans mt-1">
              {hoveredItem.item.armor} Armadura
            </p>
          )}

          {/* Primary & Secondary Stats */}
          {hoveredItem.item.stats && hoveredItem.item.stats.length > 0 && (
            <div className="mt-1.5 space-y-0.5 text-xs">
              {hoveredItem.item.stats.map((s, idx) => (
                <p
                  key={idx}
                  className={s.startsWith("Equipar:") || s.startsWith("Proc:") || s.startsWith("Uso:") ? "text-emerald-400 font-medium" : "text-zinc-100 font-sans"}
                >
                  {s}
                </p>
              ))}
            </div>
          )}

          {/* Enchantment */}
          {hoveredItem.item.enchantment && (
            <p className="text-xs text-emerald-400 font-medium mt-1">
              ✨ Encantamento: {hoveredItem.item.enchantment}
            </p>
          )}

          {/* Durability & Required Level */}
          <div className="mt-2 pt-1 border-t border-zinc-800 flex justify-between text-[11px] text-zinc-400">
            <span>{hoveredItem.item.durability || "Durabilidade 85 / 85"}</span>
            <span>Requer Nível {hoveredItem.item.requiredLevel || charLevel}</span>
          </div>

          {/* Sell price */}
          <div className="mt-1 flex items-center justify-end gap-2 text-[10px] font-mono text-zinc-400">
            <span>Preço de Venda:</span>
            <span className="text-amber-300 font-bold">1g</span>
            <span className="text-zinc-300 font-bold">45s</span>
            <span className="text-amber-600 font-bold">80c</span>
          </div>
        </div>
      )}
    </div>
  );
};
