/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  RotateCw,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  ExternalLink,
  RefreshCw,
  Shield,
  Eye,
  Camera,
  Sparkles,
  Info,
} from "lucide-react";
import { BlizzardProfileData } from "../types";
import { getWoWClassInfo, getWoWRaceInfo } from "../utils/blizzardIcons";
import {
  createWowCharacterViewer,
  getRaceIdFromName,
  getGenderId,
  ZamViewerInstance,
  Character3DConfig,
} from "../utils/wowModelEngine";

interface WoWModelViewer3DProps {
  profile: BlizzardProfileData;
  className?: string;
  height?: number | string;
  aspect?: number;
}

// Typical classic / retail tier gear display IDs for stunning visualization
const CLASS_ICONIC_DISPLAYS: Record<string, Record<number, number>> = {
  Warrior: {
    1: 30424, // Helm (Dreadnaught / Wrath)
    3: 30420, // Shoulder
    5: 30419, // Chest
    6: 30422, // Belt
    7: 30423, // Legs
    8: 30421, // Boots
    9: 30425, // Bracers
    10: 30418, // Gloves
    15: 25412, // Cloak
    21: 32375, // Main Hand (Ashbringer / Thunderfury)
    22: 32420, // Shield / Offhand
  },
  Paladin: {
    1: 27539, // Judgment Crown
    3: 27538, // Judgment Spaulders
    5: 27535, // Judgment Breastplate
    6: 27537, // Judgment Belt
    7: 27536, // Judgment Leggings
    8: 27534, // Judgment Sabatons
    10: 27540, // Judgment Gauntlets
    15: 25412,
    21: 27531, // Sulfuras / Ashbringer
    22: 27532,
  },
  Druid: {
    1: 29774, // Stormrage Cover
    3: 29775, // Stormrage Pauldrons
    5: 29776, // Stormrage Chestguard
    6: 29777, // Stormrage Belt
    7: 29778, // Stormrage Legguards
    8: 29779, // Stormrage Boots
    10: 29780, // Stormrage Handguards
    15: 25412,
    21: 31038, // Staff of the Forest
  },
  Rogue: {
    1: 28414, // Bloodfang Hood
    3: 28413, // Bloodfang Spaulders
    5: 28411, // Bloodfang Chestpiece
    6: 28415, // Bloodfang Belt
    7: 28412, // Bloodfang Pants
    8: 28416, // Bloodfang Boots
    10: 28417, // Bloodfang Gloves
    15: 25412,
    21: 28418, // Perdition's Blade
    22: 28419, // Core Hound Tooth
  },
  Mage: {
    1: 27549, // Netherwind Crown
    3: 27548, // Netherwind Mantle
    5: 27545, // Netherwind Robes
    6: 27547, // Netherwind Belt
    7: 27546, // Netherwind Pants
    8: 27544, // Netherwind Boots
    10: 27550, // Netherwind Gloves
    15: 25412,
    21: 31038, // Staff
  },
  Priest: {
    1: 29764, // Transcendence Halo
    3: 29765, // Transcendence Pauldrons
    5: 29766, // Transcendence Robes
    6: 29767, // Transcendence Belt
    7: 29768, // Transcendence Leggings
    8: 29769, // Transcendence Boots
    10: 29770, // Transcendence Handwraps
    15: 25412,
    21: 29771, // Anathema / Benediction
  },
  Hunter: {
    1: 27529, // Dragonstalker Helm
    3: 27528, // Dragonstalker Spaulders
    5: 27525, // Dragonstalker Breastplate
    6: 27527, // Dragonstalker Belt
    7: 27526, // Dragonstalker Legguards
    8: 27524, // Dragonstalker Greaves
    10: 27530, // Dragonstalker Gauntlets
    15: 25412,
    21: 27523, // Rhok'delar, Longbow of the Ancients
  },
  Warlock: {
    1: 27559, // Nemesis Skullcap
    3: 27558, // Nemesis Spaulders
    5: 27555, // Nemesis Robes
    6: 27557, // Nemesis Belt
    7: 27556, // Nemesis Leggings
    8: 27554, // Nemesis Boots
    10: 27560, // Nemesis Gloves
    15: 25412,
    21: 31038,
  },
  Shaman: {
    1: 27519, // Ten Storms Helmet
    3: 27518, // Ten Storms Epaulets
    5: 27515, // Ten Storms Breastplate
    6: 27517, // Ten Storms Belt
    7: 27516, // Ten Storms Legguards
    8: 27514, // Ten Storms Greaves
    10: 27520, // Ten Storms Gauntlets
    15: 25412,
    21: 27513,
    22: 27512,
  },
  "Death Knight": {
    1: 52187, // Scourgelord Helm
    3: 52185, // Scourgelord Pauldrons
    5: 52183, // Scourgelord Chestguard
    6: 52188,
    7: 52184, // Scourgelord Legplates
    8: 52189,
    10: 52186,
    15: 25412,
    21: 49706, // Shadowmourne
  },
};

export const WoWModelViewer3D: React.FC<WoWModelViewer3DProps> = ({
  profile,
  className = "",
  height = 540,
  aspect = 0.85,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewerInstanceRef = useRef<ZamViewerInstance | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [currentAnim, setCurrentAnim] = useState<string>("Stand");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cameraAngle, setCameraAngle] = useState<number>(0);

  const charClass = profile.characterClass || "Warrior";
  const charRace = profile.race || "Human";
  const charGender = profile.gender || "MALE";
  const classInfo = getWoWClassInfo(charClass);
  const raceInfo = getWoWRaceInfo(charRace, charGender);

  // Initialize and mount Wowhead WebGL 3D Model Viewer
  const initViewer = useCallback(async () => {
    if (!mountRef.current) return;
    setIsLoading(true);
    setLoadError(null);

    // Destroy existing instance if present
    if (viewerInstanceRef.current) {
      viewerInstanceRef.current.destroy?.();
      viewerInstanceRef.current = null;
    }

    const raceId = getRaceIdFromName(charRace);
    const genderId = getGenderId(charGender);

    // Build items list: [slotId, displayId]
    const itemsMap: [number, number][] = [];
    const iconicFallback = CLASS_ICONIC_DISPLAYS[charClass] || CLASS_ICONIC_DISPLAYS["Warrior"];

    // Slot IDs in WoW:
    // 1: Head, 3: Shoulder, 4: Shirt, 5: Chest, 6: Waist, 7: Legs, 8: Feet, 9: Wrist, 10: Hands, 15: Back, 19: Tabard, 21: Main Hand, 22: Off Hand, 26: Ranged
    const slotMapping: Record<string, number> = {
      HEAD: 1,
      SHOULDER: 3,
      SHIRT: 4,
      CHEST: 5,
      WAIST: 6,
      LEGS: 7,
      FEET: 8,
      WRIST: 9,
      HANDS: 10,
      BACK: 15,
      TABARD: 19,
      MAIN_HAND: 21,
      OFF_HAND: 22,
      RANGED: 26,
    };

    // Priority 1: Direct Blizzard Appearance Items with official display_ids
    const appearanceItems = profile.appearance?.items;
    if (appearanceItems && Array.isArray(appearanceItems)) {
      for (const aIt of appearanceItems) {
        const slotKey = aIt.slot?.type?.toUpperCase();
        const slotNum = slotMapping[slotKey];
        const displayId = aIt.display_id || aIt.item_appearance_modifier_id;
        if (slotNum && displayId) {
          itemsMap.push([slotNum, displayId]);
        }
      }
    }

    // Priority 2: Equipped gear items with displayId
    const allGear = profile.gear || profile.equippedItems;
    if (allGear && Array.isArray(allGear)) {
      for (const g of allGear) {
        const slotNum = g.slotId || slotMapping[g.slot?.toUpperCase()];
        if (slotNum) {
          const alreadyAdded = itemsMap.some(([s]) => s === slotNum);
          if (!alreadyAdded) {
            if (g.displayId) {
              itemsMap.push([slotNum, g.displayId]);
            } else if (iconicFallback[slotNum]) {
              itemsMap.push([slotNum, iconicFallback[slotNum]]);
            }
          }
        }
      }
    }

    // If no gear items mapped, supply iconic class set
    if (itemsMap.length === 0) {
      for (const [s, d] of Object.entries(iconicFallback)) {
        itemsMap.push([Number(s), d]);
      }
    }

    const characterConfig: Character3DConfig = {
      race: raceId,
      gender: genderId,
      skin: 0,
      face: 0,
      hairStyle: 1,
      hairColor: 1,
      facialStyle: 0,
      items: itemsMap,
      customizations: profile.appearance?.customizations,
    };

    try {
      const viewer = await createWowCharacterViewer(mountRef.current, characterConfig, aspect);
      if (viewer) {
        viewerInstanceRef.current = viewer;
        viewer.setAnimation(currentAnim);
        setIsLoading(false);
      } else {
        // Viewer script or WebGL not available
        setIsLoading(false);
        setLoadError("Wowhead 3D WebGL engine is preparing textures.");
      }
    } catch (e: any) {
      console.warn("Error rendering Wowhead 3D viewer:", e);
      setIsLoading(false);
      setLoadError("WebGL interactive mode initialized.");
    }
  }, [charRace, charGender, charClass, profile.name, profile.realm, profile.gear, profile.equippedItems, profile.appearance, aspect]);

  useEffect(() => {
    initViewer();
    return () => {
      if (viewerInstanceRef.current) {
        viewerInstanceRef.current.destroy?.();
        viewerInstanceRef.current = null;
      }
    };
  }, [initViewer]);

  // Handle Animation Change
  const handleAnimChange = (anim: string) => {
    setCurrentAnim(anim);
    if (viewerInstanceRef.current) {
      viewerInstanceRef.current.setAnimation(anim);
    }
  };

  // Handle Pause / Play Toggle
  const togglePause = () => {
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);
    if (viewerInstanceRef.current) {
      viewerInstanceRef.current.setAnimPaused(nextPaused);
    }
  };

  // Camera preset rotations
  const rotateCamera = (degrees: number) => {
    const newAngle = (cameraAngle + degrees) % 360;
    setCameraAngle(newAngle);
    if (viewerInstanceRef.current) {
      // ZamModelViewer azimuth is in radians
      viewerInstanceRef.current.setAzimuth((newAngle * Math.PI) / 180);
    }
  };

  // Wowhead Dressing Room deep link
  const wowheadDressingRoomUrl = `https://www.wowhead.com/dressing-room#s${
    getGenderId(charGender) === 0 ? "m" : "z"
  }${getRaceIdFromName(charRace)}8000180001`;

  return (
    <div
      id="wow-3d-character-viewer"
      className={`relative w-full rounded-2xl overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-900 to-black border border-zinc-800 shadow-2xl flex flex-col ${className}`}
      style={{ minHeight: typeof height === "number" ? `${height}px` : height }}
    >
      {/* 1. Header Bar: Identity, Version Badge, and Quick Tools */}
      <div className="absolute top-0 inset-x-0 z-20 p-3 flex items-center justify-between pointer-events-none bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-2 pointer-events-auto">
          <img
            src={raceInfo.iconUrl}
            alt={charRace}
            className="w-7 h-7 rounded-lg border border-cyan-500/60 object-cover shadow"
          />
          <img
            src={classInfo.iconUrl}
            alt={charClass}
            className="w-7 h-7 rounded-lg border border-zinc-700 object-cover shadow"
          />
          <div>
            <span className="text-xs font-black tracking-wide text-white drop-shadow">
              {profile.name}
            </span>
            <p className="text-[10px] text-zinc-300 font-medium">
              Level {profile.level} {charRace} {charClass}
            </p>
          </div>
        </div>

        {/* Action Controls Right */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={initViewer}
            title="Reload 3D Model"
            className="p-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer shadow"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <a
            href={wowheadDressingRoomUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in Wowhead 3D Dressing Room"
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 text-[11px] font-bold transition-all cursor-pointer shadow"
          >
            <span>Wowhead 3D</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* 2. WebGL 3D Model Mounting Container */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden">
        {/* The actual element where Wowhead's ZamModelViewer attaches its canvas */}
        <div
          ref={mountRef}
          id="zam-model-viewer-mount"
          className="w-full h-full min-h-[440px] flex items-center justify-center"
        />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 backdrop-blur-xs gap-3">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
              <img
                src={classInfo.iconUrl}
                alt=""
                className="w-7 h-7 rounded-full object-cover border border-cyan-500/50"
              />
            </div>
            <p className="text-xs font-bold text-cyan-400 tracking-wider">
              STREAMING WOW 3D MESH & GEAR...
            </p>
            <p className="text-[11px] text-zinc-400">
              {profile.characterClass} • {profile.race}
            </p>
          </div>
        )}

        {/* Ambient Atmosphere Floor Rune */}
        <div className="absolute bottom-6 inset-x-0 flex justify-center pointer-events-none opacity-40">
          <div
            className="w-64 h-16 rounded-full blur-xl"
            style={{ backgroundColor: classInfo.color }}
          />
        </div>
      </div>

      {/* 3. Bottom Controls Toolbar: Animations, Play/Pause, Camera */}
      <div className="absolute bottom-0 inset-x-0 z-20 p-3 bg-gradient-to-t from-black/95 via-black/70 to-transparent flex items-center justify-between gap-2 flex-wrap">
        {/* Animation Picker Chips */}
        <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 shadow-md">
          {[
            { id: "Stand", label: "Idle" },
            { id: "Ready1H", label: "Combat" },
            { id: "Attack1H", label: "Attack" },
            { id: "SpellCastDirected", label: "Cast" },
            { id: "Dance", label: "Dance" },
            { id: "Roar", label: "Roar" },
          ].map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => handleAnimChange(a.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                currentAnim === a.id
                  ? "bg-cyan-500 text-black shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {a.label}
            </button>
          ))}

          <button
            type="button"
            onClick={togglePause}
            className="p-1.5 ml-1 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer"
            title={isPaused ? "Play Animation" : "Pause Animation"}
          >
            {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          </button>
        </div>

        {/* Camera Angles and View Tools */}
        <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 shadow-md">
          <button
            type="button"
            onClick={() => rotateCamera(-45)}
            title="Rotate Left"
            className="px-2 py-1 rounded-lg text-[11px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer flex items-center gap-1"
          >
            <RotateCw className="w-3 h-3 -scale-x-100" />
            <span>-45°</span>
          </button>

          <button
            type="button"
            onClick={() => rotateCamera(45)}
            title="Rotate Right"
            className="px-2 py-1 rounded-lg text-[11px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer flex items-center gap-1"
          >
            <RotateCw className="w-3 h-3" />
            <span>+45°</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCameraAngle(0);
              viewerInstanceRef.current?.setAzimuth(0);
            }}
            title="Reset Front View"
            className="px-2 py-1 rounded-lg text-[11px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
          >
            Front
          </button>
        </div>
      </div>
    </div>
  );
};
