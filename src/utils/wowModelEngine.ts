/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Wowhead ZamModelViewer Integration Helper
// Provides typed access to Wowhead WebGL 3D Model Viewer and animations

export interface Character3DConfig {
  race: number; // 1: Human, 2: Orc, 3: Dwarf, 4: Night Elf, 5: Undead, 6: Tauren, 7: Gnome, 8: Troll, etc.
  gender: number; // 0: Male, 1: Female
  skin?: number;
  face?: number;
  hairStyle?: number;
  hairColor?: number;
  facialStyle?: number;
  items?: [number, number][]; // [slotId, displayId]
}

export const RACE_NAME_TO_ID: Record<string, number> = {
  human: 1,
  orc: 2,
  dwarf: 3,
  nightelf: 4,
  "night elf": 4,
  scourge: 5,
  undead: 5,
  forsaken: 5,
  tauren: 6,
  gnome: 7,
  troll: 8,
  goblin: 9,
  bloodelf: 10,
  "blood elf": 10,
  draenei: 11,
  worgen: 22,
  pandaren: 24,
  nightborne: 27,
  highmountaintauren: 28,
  "highmountain tauren": 28,
  voidelf: 29,
  "void elf": 29,
  lightforgeddraenei: 30,
  "lightforged draenei": 30,
  zandalaritroll: 31,
  "zandalari troll": 31,
  kultiran: 32,
  "kul tiran": 32,
  darkirondwarf: 34,
  "dark iron dwarf": 34,
  vulpera: 35,
  magharorc: 36,
  "mag'har orc": 36,
  mechagnome: 37,
  dracthyr: 52,
  earthen: 84,
};

export function getRaceIdFromName(raceName?: string): number {
  if (!raceName) return 1;
  const clean = raceName.toLowerCase().trim();
  return RACE_NAME_TO_ID[clean] || 1;
}

export function getGenderId(gender?: string): number {
  if (!gender) return 0;
  return gender.toUpperCase().startsWith("F") ? 1 : 0;
}

const NOT_DISPLAYED_SLOTS = [2, 11, 12, 13, 14];

export async function fetchCharacterCustomizationOptions(race: number, gender: number) {
  const raceGender = race * 2 - 1 + gender;
  try {
    const res = await fetch(`/api/zamimg/modelviewer/live/meta/charactercustomization/${raceGender}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.data || data;
  } catch (e) {
    console.warn("Could not load character customization options, falling back to defaults", e);
    return null;
  }
}

export function buildCharacterOptions(character: Character3DConfig, fullOptions: any) {
  if (!fullOptions || !Array.isArray(fullOptions.Options)) {
    return [];
  }
  const options = fullOptions.Options;
  const parts: Record<string, keyof Character3DConfig> = {
    Face: "face",
    "Skin Color": "skin",
    "Hair Style": "hairStyle",
    "Hair Color": "hairColor",
    "Facial Hair": "facialStyle",
    Mustache: "facialStyle",
    Beard: "facialStyle",
    Sideburns: "facialStyle",
  };

  const result = [];
  for (const [partName, charKey] of Object.entries(parts)) {
    const part = options.find((o: any) => o.Name === partName);
    if (part && Array.isArray(part.Choices) && part.Choices.length > 0) {
      const idx = character[charKey] !== undefined ? Number(character[charKey]) : 0;
      const choice = part.Choices[idx] || part.Choices[0];
      result.push({
        optionId: part.Id,
        choiceId: choice.Id,
      });
    }
  }
  return result;
}

export interface ZamViewerInstance {
  setAnimation: (anim: string) => void;
  setAnimPaused: (paused: boolean) => void;
  setAzimuth: (azimuth: number) => void;
  setZenith: (zenith: number) => void;
  setDistance: (distance: number) => void;
  destroy?: () => void;
  renderer?: any;
  method?: (fn: string, args: any) => void;
}

/**
 * Creates and mounts a Wowhead ZamModelViewer 3D instance into the container element
 */
export async function ensureViewerAssetsLoaded(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const win = window as any;

  // 1. Ensure jQuery is available and configure CORS
  if (!win.jQuery && typeof document !== "undefined") {
    let jqScript = document.querySelector('script[src*="jquery.min.js"]') as HTMLScriptElement | null;
    if (!jqScript) {
      jqScript = document.createElement("script");
      jqScript.src = "/vendor/jquery.min.js";
      jqScript.async = false;
      document.head.appendChild(jqScript);
    }
  }

  // Wait for jQuery
  for (let i = 0; i < 30; i++) {
    if (win.jQuery) {
      win.$ = win.jQuery = win.jQuery || win.$;
      win.jQuery.support = win.jQuery.support || {};
      win.jQuery.support.cors = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  if (win.jQuery) {
    win.$ = win.jQuery = win.jQuery || win.$;
    win.jQuery.support = win.jQuery.support || {};
    win.jQuery.support.cors = true;
  }

  // 2. Ensure ZamModelViewer is loaded
  if (!win.ZamModelViewer && typeof document !== "undefined") {
    let script = document.querySelector('script[src*="viewer.min.js"]') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.src = "/vendor/viewer.min.js";
      script.async = false;
      document.body.appendChild(script);
    }
  }

  // 3. Poll for both ZamModelViewer and jQuery
  for (let i = 0; i < 40; i++) {
    if (win.jQuery) {
      win.$ = win.jQuery = win.jQuery || win.$;
      win.jQuery.support = win.jQuery.support || {};
      win.jQuery.support.cors = true;
    }
    if (win.ZamModelViewer && win.jQuery) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return !!(win.ZamModelViewer && win.jQuery);
}

export async function createWowCharacterViewer(
  container: HTMLElement,
  character: Character3DConfig,
  aspect = 1.1
): Promise<ZamViewerInstance | null> {
  await ensureViewerAssetsLoaded();
  const win = window as any;
  if (!win.ZamModelViewer || !win.jQuery) {
    console.warn("ZamModelViewer or jQuery not loaded on window");
    return null;
  }

  const race = character.race || 1;
  const gender = character.gender || 0;
  const raceGender = race * 2 - 1 + gender;

  let charOptions: any[] = [];
  const fullOptions = await fetchCharacterCustomizationOptions(race, gender);
  if (fullOptions) {
    charOptions = buildCharacterOptions(character, fullOptions);
  }

  const items = (character.items || []).filter(([slot]) => !NOT_DISPLAYED_SLOTS.includes(slot));

  // Clear previous viewer elements in container and mount into a clean host node
  container.innerHTML = "";
  const initialWidth = container.clientWidth || container.offsetWidth || 480;
  const initialHeight = Math.max(280, Math.round(initialWidth / aspect));

  const hostDiv = document.createElement("div");
  hostDiv.id = `zam-char-host-${Math.random().toString(36).substring(2, 9)}`;
  hostDiv.style.width = "100%";
  hostDiv.style.height = "100%";
  hostDiv.style.minHeight = `${initialHeight}px`;
  hostDiv.className = "zam-clean-host";
  container.appendChild(hostDiv);

  const viewerOptions: any = {
    type: 2, // WOW
    contentPath: "/api/zamimg/modelviewer/live/",
    container: win.jQuery(hostDiv),
    aspect: aspect,
    hd: true,
    models: {
      id: raceGender,
      type: 16, // CHARACTER
    },
    items: items,
  };

  if (charOptions.length > 0) {
    viewerOptions.charCustomization = {
      options: charOptions,
    };
  }

  try {
    const rawViewer = new win.ZamModelViewer(viewerOptions);
    try {
      rawViewer.setAdaptiveMode?.(true);
    } catch (_) {}

    const viewerWrapper: ZamViewerInstance = {
      setAnimation: (anim: string) => {
        try {
          if (rawViewer.renderer?.actors?.[0]?.setAnimation) {
            rawViewer.renderer.actors[0].setAnimation(anim);
          } else if (rawViewer.method) {
            rawViewer.method("setAnimation", [anim]);
          }
        } catch (e) {
          console.warn("Error setting animation:", e);
        }
      },
      setAnimPaused: (paused: boolean) => {
        try {
          if (rawViewer.renderer?.actors?.[0]?.setAnimPaused) {
            rawViewer.renderer.actors[0].setAnimPaused(paused);
          }
        } catch (e) {
          console.warn("Error toggling pause:", e);
        }
      },
      setAzimuth: (azimuth: number) => {
        if (rawViewer.renderer) rawViewer.renderer.azimuth = azimuth;
      },
      setZenith: (zenith: number) => {
        if (rawViewer.renderer) rawViewer.renderer.zenith = zenith;
      },
      setDistance: (distance: number) => {
        if (rawViewer.renderer) rawViewer.renderer.distance = distance;
      },
      destroy: () => {
        try {
          if (rawViewer.destroy) rawViewer.destroy();
          container.innerHTML = "";
        } catch (e) {}
      },
      renderer: rawViewer.renderer,
      method: rawViewer.method ? rawViewer.method.bind(rawViewer) : undefined,
    };

    return viewerWrapper;
  } catch (err: any) {
    console.warn("Notice: ZamModelViewer character interactive mode preparing textures:", err?.message || String(err));
    return null;
  }
}

/**
 * Creates and mounts a Wowhead ZamModelViewer 3D instance for a Mount, Pet or NPC
 */
export async function createWowMountViewer(
  container: HTMLElement,
  creatureDisplayId: number,
  aspect = 1.1
): Promise<ZamViewerInstance | null> {
  await ensureViewerAssetsLoaded();
  const win = window as any;
  if (!win.ZamModelViewer || !win.jQuery) {
    console.warn("ZamModelViewer or jQuery not loaded on window");
    return null;
  }

  container.innerHTML = "";
  const initialWidth = container.clientWidth || container.offsetWidth || 400;
  const initialHeight = Math.max(260, Math.round(initialWidth / aspect));

  const hostDiv = document.createElement("div");
  hostDiv.id = `zam-mount-host-${Math.random().toString(36).substring(2, 9)}`;
  hostDiv.style.width = "100%";
  hostDiv.style.height = "100%";
  hostDiv.style.minHeight = `${initialHeight}px`;
  hostDiv.className = "zam-clean-mount-host";
  container.appendChild(hostDiv);

  const viewerOptions: any = {
    type: 2, // WOW
    contentPath: "/api/zamimg/modelviewer/live/",
    container: win.jQuery(hostDiv),
    aspect: aspect,
    hd: true,
    models: {
      id: creatureDisplayId,
      type: 8, // NPC / CREATURE / MOUNT
    },
    items: [],
  };

  try {
    const rawViewer = new win.ZamModelViewer(viewerOptions);
    try {
      rawViewer.setAdaptiveMode?.(true);
    } catch (_) {}

    const viewerWrapper: ZamViewerInstance = {
      setAnimation: (anim: string) => {
        try {
          if (rawViewer.renderer?.actors?.[0]?.setAnimation) {
            rawViewer.renderer.actors[0].setAnimation(anim);
          } else if (rawViewer.method) {
            rawViewer.method("setAnimation", [anim]);
          }
        } catch (e) {}
      },
      setAnimPaused: (paused: boolean) => {
        try {
          if (rawViewer.renderer?.actors?.[0]?.setAnimPaused) {
            rawViewer.renderer.actors[0].setAnimPaused(paused);
          }
        } catch (e) {}
      },
      setAzimuth: (azimuth: number) => {
        if (rawViewer.renderer) rawViewer.renderer.azimuth = azimuth;
      },
      setZenith: (zenith: number) => {
        if (rawViewer.renderer) rawViewer.renderer.zenith = zenith;
      },
      setDistance: (distance: number) => {
        if (rawViewer.renderer) rawViewer.renderer.distance = distance;
      },
      destroy: () => {
        try {
          if (rawViewer.destroy) rawViewer.destroy();
          container.innerHTML = "";
        } catch (e) {}
      },
      renderer: rawViewer.renderer,
      method: rawViewer.method ? rawViewer.method.bind(rawViewer) : undefined,
    };

    return viewerWrapper;
  } catch (err: any) {
    console.warn("Notice: ZamModelViewer creature interactive mode preparing textures:", err?.message || String(err));
    return null;
  }
}
