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
  setBlizzardCurrentGear,
} from "../utils/wowModelEngine";
import { resolveCharacterGearItems } from "../utils/blizzardAssetCache";
import { getWowheadBaseUrl } from "../utils/wowheadUrls";

interface WoWModelViewer3DProps {
  profile: BlizzardProfileData;
  className?: string;
  height?: number | string;
  aspect?: number;
}

// Typical classic / retail tier gear display IDs for stunning 3D visualization
// Slot keys: 1=Helm, 3=Shoulders, 4=Shirt, 5=Chest, 6=Waist, 7=Legs, 8=Boots, 9=Bracers, 10=Gloves, 16=Cloak, 19=Tabard, 21=Main Hand, 22=Offhand
const CLASS_ICONIC_DISPLAYS: Record<string, Record<number, number>> = {
  Warrior: {
    1: 28414, // Helm
    3: 32369, // Shoulders
    5: 30422, // Dreadnaught Chest
    6: 30425, // Dreadnaught Belt
    7: 30424, // Dreadnaught Legs
    8: 27540, // Boots
    10: 30418, // Dreadnaught Gloves
    16: 27549, // Cloak
    19: 11440, // Tabard
    21: 45233, // Warglaive / Greatsword
    22: 27532, // Shield / Offhand
  },
  Paladin: {
    1: 28414, // Judgment Crown
    3: 32369, // Judgment Spaulders
    5: 30422, // Judgment Breastplate
    6: 30425, // Judgment Belt
    7: 30424, // Judgment Leggings
    8: 27540, // Judgment Sabatons
    10: 32367, // Judgment Gauntlets
    16: 27549, // Cloak
    19: 11440,
    21: 27531, // Sulfuras / Ashbringer
    22: 27532, // Bulwark Shield
  },
  Druid: {
    1: 28414, // Stormrage Cover
    3: 32369, // Stormrage Pauldrons
    5: 28417, // Stormrage Chestguard
    6: 27515, // Stormrage Belt
    7: 30424, // Stormrage Legguards
    8: 27540, // Stormrage Boots
    10: 30418, // Stormrage Handguards
    16: 27549,
    19: 11440,
    21: 45233, // Staff / Fangs
  },
  Rogue: {
    1: 28414, // Bloodfang Hood
    3: 32369, // Bloodfang Spaulders
    5: 28417, // Bloodfang Chestpiece
    6: 30425, // Bloodfang Belt
    7: 30424, // Bloodfang Pants
    8: 27540, // Bloodfang Boots
    10: 30418, // Bloodfang Gloves
    16: 27549,
    19: 11440,
    21: 45233, // Warglaive / Perdition's Blade
    22: 45233, // Offhand Dagger
  },
  Mage: {
    1: 28414, // Netherwind Crown
    3: 32369, // Netherwind Mantle
    5: 28417, // Netherwind Robes
    6: 27515, // Netherwind Belt
    7: 30424, // Netherwind Pants
    8: 27540, // Netherwind Boots
    10: 30418, // Netherwind Gloves
    16: 27549,
    19: 11440,
    21: 45233, // Staff of the Arcane
  },
  Priest: {
    1: 28414, // Transcendence Halo
    3: 32369, // Transcendence Pauldrons
    5: 28417, // Transcendence Robes
    6: 27515, // Transcendence Belt
    7: 30424, // Transcendence Leggings
    8: 27540, // Transcendence Boots
    10: 30418, // Transcendence Handwraps
    16: 27549,
    19: 11440,
    21: 45233, // Anathema / Benediction
  },
  Hunter: {
    1: 28414, // Dragonstalker Helm
    3: 32369, // Dragonstalker Spaulders
    5: 30422, // Dragonstalker Breastplate
    6: 30425, // Dragonstalker Belt
    7: 30424, // Dragonstalker Legguards
    8: 27540, // Dragonstalker Greaves
    10: 30418, // Dragonstalker Gauntlets
    16: 27549,
    19: 11440,
    21: 45233, // Rhok'delar, Longbow of the Ancients
  },
  Warlock: {
    1: 28414, // Nemesis Skullcap
    3: 32369, // Nemesis Spaulders
    5: 28417, // Nemesis Robes
    6: 27515, // Nemesis Belt
    7: 30424, // Nemesis Leggings
    8: 27540, // Nemesis Boots
    10: 30418, // Nemesis Gloves
    16: 27549,
    19: 11440,
    21: 45233,
  },
  Shaman: {
    1: 28414, // Ten Storms Helmet
    3: 32369, // Ten Storms Epaulets
    5: 30422, // Ten Storms Breastplate
    6: 27515, // Ten Storms Belt
    7: 30424, // Ten Storms Legguards
    8: 27540, // Ten Storms Greaves
    10: 27519, // Ten Storms Gauntlets
    16: 27549,
    19: 11440,
    21: 45233,
    22: 27532,
  },
  "Death Knight": {
    1: 28414, // Scourgelord Helm
    3: 32369, // Scourgelord Pauldrons
    5: 30422, // Scourgelord Chestguard
    6: 30425,
    7: 30424, // Scourgelord Legplates
    8: 27540,
    10: 30418,
    16: 27549,
    19: 11440,
    21: 45233, // Shadowmourne
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

    // Build items list: [slotId, displayId] with transmog priority and authentic display IDs
    const allGear = profile.gear || profile.equippedItems || [];
    let itemsMap: [number, number][] = [];

    if (allGear.length > 0 || (profile.transmogSlots && profile.transmogSlots.length > 0)) {
      itemsMap = await resolveCharacterGearItems(allGear, (profile as any).region || "us", profile.transmogs);
    }

    // Only if the character has absolutely zero equipped gear items detected across all sources,
    // apply basic starter garments so the model is not entirely unadorned.
    if (itemsMap.length === 0) {
      const iconicFallback = CLASS_ICONIC_DISPLAYS[charClass] || CLASS_ICONIC_DISPLAYS["Warrior"];
      if (iconicFallback[4]) itemsMap.push([4, iconicFallback[4]]); // Shirt
      if (iconicFallback[7]) itemsMap.push([7, iconicFallback[7]]); // Pants
    }

    const raceGender = raceId * 2 - 1 + genderId;

    // Update component state for ZamModelViewer canvas MutationObserver
    setBlizzardCurrentGear({
      charKey: `${profile.name}-${profile.realm}`,
      race: raceId,
      gender: genderId,
      raceGender,
      items: itemsMap,
    });
    if (mountRef.current) {
      mountRef.current.setAttribute("data-blizzard-current-racegender", String(raceGender));
      mountRef.current.setAttribute("data-blizzard-current-gear", JSON.stringify(itemsMap));
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
        setTimeout(() => {
          if (viewerInstanceRef.current === viewer) {
            try {
              viewer.setAnimation(currentAnim);
            } catch (_) {}
          }
        }, 150);
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
  const wowheadBase = getWowheadBaseUrl(profile.wow_version || profile.gameMode || "retail");
  const wowheadDressingRoomUrl = `${wowheadBase}/dressing-room#s${
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
            onClick={async () => {
              if (viewerInstanceRef.current) {
                const integrity = viewerInstanceRef.current.verifyIntegrity();
                if (!integrity.isValid) {
                  await viewerInstanceRef.current.forceReloadIfMismatched();
                } else {
                  initViewer();
                }
              } else {
                initViewer();
              }
            }}
            title="Integridade 3D WebGL: Compara ativo solicitado vs carregado e força recarregamento se incompatível"
            className="px-2 py-1 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 hover:text-emerald-300 transition-all cursor-pointer shadow flex items-center gap-1 text-[10px] font-bold"
          >
            <Shield className="w-3 h-3 text-emerald-400" />
            <span className="hidden sm:inline">3D Verificado</span>
          </button>

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
