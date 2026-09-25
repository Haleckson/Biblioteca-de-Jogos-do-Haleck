/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Wowhead ZamModelViewer Integration Helper
// Provides typed access to Wowhead WebGL 3D Model Viewer and animations

import {
  getCachedDisplayIdSync,
  getCachedDisplayId,
  setCachedDisplayId,
  prefetchAndVerifyBlizzardAsset,
  prefetchAndVerifyBlizzardGearList,
  isAssetStoredInIndexedDB,
} from "./blizzardAssetCache";

export interface Character3DConfig {
  race: number; // 1: Human, 2: Orc, 3: Dwarf, 4: Night Elf, 5: Undead, 6: Tauren, 7: Gnome, 8: Troll, etc.
  gender: number; // 0: Male, 1: Female
  skin?: number;
  face?: number;
  hairStyle?: number;
  hairColor?: number;
  facialStyle?: number;
  items?: [number, number][]; // [slotId, displayId]
  customizations?: {
    optionId?: number;
    choiceId?: number;
    option?: { id: number; name?: string };
    choice?: { id: number; name?: string };
  }[];
}

export const RACE_NAME_TO_ID: Record<string, number> = {
  // English
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

  // Português (pt_BR)
  humano: 1,
  humana: 1,
  anao: 3,
  anão: 3,
  ana: 3,
  anã: 3,
  "elfo noturno": 4,
  "elfa noturna": 4,
  "morto-vivo": 5,
  "morta-viva": 5,
  "morto vivo": 5,
  "morta viva": 5,
  renegado: 5,
  renegada: 5,
  gnomo: 7,
  gnoma: 7,
  "elfo sangrento": 10,
  "elfa sangrenta": 10,
  "elfo de sangue": 10,
  "filho da noite": 27,
  "filha da noite": 27,
  "tauren altamontês": 28,
  "tauren altamontes": 28,
  "elfo caótico": 29,
  "elfa caótica": 29,
  "elfo caotico": 29,
  "elfa caotica": 29,
  "draenei forjado a luz": 30,
  "draeneio forjado a luz": 30,
  "forjado a luz": 30,
  "troll zandalari": 31,
  kultireno: 32,
  kultirena: 32,
  "kul tireno": 32,
  "kul tirena": 32,
  "anão ferro negro": 34,
  "anao ferro negro": 34,
  "orc mag'har": 36,
  "gnomo mecânico": 37,
  "gnomo mecanico": 37,
  terrano: 84,
  terrana: 84,
};

export function getRaceIdFromName(raceName?: string): number {
  if (!raceName) return 1;
  const clean = raceName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  const rawClean = raceName.toLowerCase().trim();
  return RACE_NAME_TO_ID[rawClean] || RACE_NAME_TO_ID[clean] || 1;
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

export type ZamAssetType = "mount" | "pet" | "npc" | "character" | "item";

export interface ZamIntegrityExpectedAsset {
  assetType: ZamAssetType;
  expectedId: number;
  expectedItems?: [number, number][]; // [slot, displayId] for armory equipment
  assetLabel?: string;
}

export interface ZamIntegrityCheckResult {
  isValid: boolean;
  expectedId: number;
  loadedId: number | null;
  expectedType: ZamAssetType;
  loadedType: number | null;
  itemsMatched: boolean;
  mismatchedSlots?: { slot: number; expected: number; loaded?: number }[];
  reason?: string;
  isContextLost?: boolean;
  timestamp: number;
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
  // Integrity verification & validation layer
  expectedAsset?: ZamIntegrityExpectedAsset;
  verifyIntegrity: () => ZamIntegrityCheckResult;
  forceReloadIfMismatched: () => Promise<boolean>;
  getLoadedAssetInfo: () => {
    loadedId: number | null;
    loadedType: number | null;
    loadedItems: [number, number][];
    isContextLost: boolean;
  };
  reRender?: (correctId?: number) => void;
  hardResetCanvas?: (assetId?: number) => void;
  runDiagnosticCheck?: (delay?: number) => void;
  requestedId?: number | null;
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
    if (win.ZamModelViewer && win.jQuery) {
      installZamModelViewerInterceptor(win);
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (win.ZamModelViewer && win.jQuery) {
    installZamModelViewerInterceptor(win);
    return true;
  }
  return false;
}

// Global safety guard for ZamModelViewer WebGL unhandled rejections
if (typeof window !== "undefined" && !(window as any).__zamRejectionHandled) {
  (window as any).__zamRejectionHandled = true;
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    const str = String(reason?.message || reason || "");
    if (
      str === "error" ||
      str === "[object Event]" ||
      str === "undefined" ||
      str.includes("ZamModelViewer") ||
      str.includes("zamimg") ||
      str.includes("modelviewer") ||
      str.includes("webgl") ||
      str.includes("WebGL") ||
      str.includes("CONTEXT_LOST_WEBGL") ||
      str.includes("createTexture") ||
      str.includes("Couldn't create actor") ||
      str.includes("Failed to fetch") ||
      str.includes("css")
    ) {
      event.preventDefault();
      // Silently suppressed background WebGL / asset loading rejection
    }
  });
}

/**
 * Disposes active WebGL contexts and removes canvases to prevent memory leaks and model mixing
 */
export function disposeContainerWebGLContext(container: HTMLElement | null | undefined): void {
  if (!container) return;
  try {
    const canvases = container.querySelectorAll("canvas");
    canvases.forEach((canvas) => {
      // Mark as intentionally disposing so webglcontextlost event is NOT treated as an unexpected crash
      (canvas as any).__zamDisposing = true;
      (canvas as any).__zamContextLostBound = false;
      if ((canvas as any).__zamCanvasMutationObserver) {
        try {
          (canvas as any).__zamCanvasMutationObserver.disconnect();
          (canvas as any).__zamCanvasMutationObserver = null;
        } catch (_) {}
      }
      try {
        const gl = (
          canvas.getContext("webgl2") ||
          canvas.getContext("webgl") ||
          canvas.getContext("experimental-webgl")
        ) as WebGLRenderingContext | null;
        if (gl && typeof gl.getExtension === "function") {
          const ext = gl.getExtension("WEBGL_lose_context");
          if (ext) {
            ext.loseContext();
          }
        }
      } catch (_) {}
      try {
        canvas.remove();
      } catch (_) {}
    });

    const win = typeof window !== "undefined" ? (window as any) : null;
    if (win?.jQuery) {
      try {
        win.jQuery(container).empty();
      } catch (_) {}
    }
    container.innerHTML = "";
  } catch (err) {
    // Suppress disposal notice
  }
}

let activeSelectedCharacterKey: string | null = null;
let activeSelectedCollectionItemKey: string | null = null;

export interface BlizzardSelectedCollectionItemState {
  type: "mount" | "pet";
  id?: number;
  creatureDisplayId?: number;
  name?: string;
}

export interface BlizzardCurrentGearState {
  charKey?: string;
  race?: number;
  gender?: number;
  raceGender?: number;
  items: [number, number][]; // [slot, displayId]
}

let activeBlizzardCollectionItemState: BlizzardSelectedCollectionItemState | null = null;
let activeBlizzardCurrentGearState: BlizzardCurrentGearState | null = null;

export function setBlizzardSelectedCollectionItem(item: BlizzardSelectedCollectionItemState | null): void {
  activeBlizzardCollectionItemState = item;
}

export function getBlizzardSelectedCollectionItem(): BlizzardSelectedCollectionItemState | null {
  return activeBlizzardCollectionItemState;
}

export function setBlizzardCurrentGear(gear: BlizzardCurrentGearState | null): void {
  activeBlizzardCurrentGearState = gear;
}

export function getBlizzardCurrentGear(): BlizzardCurrentGearState | null {
  return activeBlizzardCurrentGearState;
}

/**
 * Interceptor notification when character changes to force clean re-initialization
 */
export function notifyBlizzardCharacterChange(charKey: string, container?: HTMLElement | null): void {
  if (activeSelectedCharacterKey !== charKey) {
    activeSelectedCharacterKey = charKey;
    if (container) {
      disposeContainerWebGLContext(container);
    }
  }
}

/**
 * Interceptor notification when collection item (mount/pet) changes to force clean re-initialization
 */
export function notifyBlizzardCollectionItemChange(itemKey: string, container?: HTMLElement | null): void {
  if (activeSelectedCollectionItemKey !== itemKey) {
    activeSelectedCollectionItemKey = itemKey;
    if (container) {
      disposeContainerWebGLContext(container);
    }
  }
}

/**
 * Installs ZamModelViewer constructor interceptor on window
 * Implements:
 * 1. Diagnostic check comparing internal requestedId with DOM displayedId after 500ms delay, triggering internal re-render with correct ID on mismatch.
 * 2. Explicit event listener and observer catching 'webglcontextlost' events, logging the specific asset ID that triggered it, and automatically initiating a hard reset of the canvas.
 * 3. Canvas MutationObserver capturing rendered ID and forcing a clean re-render if it mismatches blizzardSelectedCollectionItem or current gear state.
 */
function installZamModelViewerInterceptor(win: any): void {
  if (win.ZamModelViewer && !win.ZamModelViewer.__intercepted) {
    const OriginalViewer = win.ZamModelViewer;

    // Helper: Attach WebGL context lost listener and MutationObserver to canvas/container
    function attachContextLostListenerAndObserver(instance: any, containerEl: HTMLElement | null) {
      if (!containerEl) return;

      const bindCanvasEvents = (canvas: HTMLCanvasElement) => {
        if (!canvas || (canvas as any).__zamContextLostBound) return;
        (canvas as any).__zamContextLostBound = true;

        const handleContextLost = (event: Event) => {
          // If intentional disposal, destroyed, or container disconnected from DOM, ignore
          if (
            (canvas as any).__zamDisposing ||
            instance._isDestroyed ||
            instance._isDisposing ||
            !containerEl ||
            !containerEl.isConnected
          ) {
            return;
          }

          event.preventDefault?.();

          // Log the specific asset ID that triggered it
          const assetId =
            instance.requestedId ??
            instance.options?.models?.id ??
            canvas.getAttribute("data-zam-requested-id") ??
            canvas.getAttribute("data-zam-displayed-id") ??
            containerEl.getAttribute("data-zam-requested-id") ??
            containerEl.getAttribute("data-zam-displayed-id") ??
            "unknown";

          console.warn(
            `[ZamModelViewer] 'webglcontextlost' event caught on canvas for asset ID #${assetId}. Automatically initiating hard reset of canvas...`
          );

          // Automatically initiate a hard reset of the canvas if element still valid in DOM
          if (containerEl.isConnected && typeof instance.hardResetCanvas === "function") {
            instance.hardResetCanvas(Number(assetId));
          }
        };

        canvas.addEventListener("webglcontextlost", handleContextLost, false);

        // Also stamp attributes on canvas for DOM synchronization
        if (instance.requestedId !== null && instance.requestedId !== undefined) {
          canvas.setAttribute("data-zam-requested-id", String(instance.requestedId));
          canvas.setAttribute("data-zam-displayed-id", String(instance.requestedId));
          canvas.setAttribute("data-zam-canvas-id", String(instance.requestedId));
          (canvas as any).__zamModelId = Number(instance.requestedId);
        }

        // MutationObserver directly on canvas to capture rendered ID
        // and trigger clean re-render if it mismatches blizzardSelectedCollectionItem or current gear
        if (typeof MutationObserver !== "undefined" && !(canvas as any).__zamCanvasMutationObserver) {
          let debounceTimer: any = null;
          const canvasMutationObserver = new MutationObserver(() => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              // 1. Capture rendered ID from canvas attributes or active WebGL actor
              let renderedId: number | null = null;
              const domAttr =
                canvas.getAttribute("data-zam-displayed-id") ||
                canvas.getAttribute("data-zam-canvas-id") ||
                canvas.getAttribute("data-zam-loaded-id");
              if (domAttr) {
                const parsed = Number(domAttr);
                if (!isNaN(parsed)) renderedId = parsed;
              }

              const primaryActor = instance.renderer?.actors?.[0];
              if (primaryActor) {
                const actorId = primaryActor.id ?? primaryActor.modelId ?? primaryActor.displayId ?? primaryActor.model?.id;
                if (actorId !== undefined && actorId !== null) {
                  const parsedActorId = Number(actorId);
                  if (!isNaN(parsedActorId)) renderedId = parsedActorId;
                }
              }

              if (renderedId === null) return;

              // 2. Compare against blizzardSelectedCollectionItem (mount or pet)
              const colState = activeBlizzardCollectionItemState;
              const isColTarget =
                instance.options?.models?.type !== 16 ||
                containerEl.getAttribute("data-zam-requested-type") === "mount" ||
                containerEl.getAttribute("data-zam-requested-type") === "pet" ||
                containerEl.hasAttribute("data-blizzard-selected-collection-item-id");

              if (colState && isColTarget) {
                const expectedColId =
                  colState.creatureDisplayId ||
                  colState.id ||
                  Number(containerEl.getAttribute("data-blizzard-selected-collection-item-id"));

                if (expectedColId && Number(renderedId) !== Number(expectedColId)) {
                  console.warn(
                    `[ZamModelViewer Canvas MutationObserver] Mismatch detected: canvas renderedId (#${renderedId}) !== blizzardSelectedCollectionItem (#${expectedColId}). Forcing clean re-render of WebGL component...`
                  );
                  if (typeof instance.hardResetCanvas === "function") {
                    instance.hardResetCanvas(Number(expectedColId));
                  } else if (typeof instance.reRender === "function") {
                    instance.reRender(Number(expectedColId));
                  }
                  return;
                }
              }

              // 3. Compare against gear atual (character gear and raceGender)
              const gearState = activeBlizzardCurrentGearState;
              const isCharTarget =
                instance.options?.models?.type === 16 ||
                containerEl.getAttribute("data-zam-requested-type") === "character" ||
                containerEl.hasAttribute("data-blizzard-current-racegender");

              if (gearState && isCharTarget) {
                const expectedRaceGender =
                  gearState.raceGender ||
                  Number(containerEl.getAttribute("data-blizzard-current-racegender"));

                if (expectedRaceGender && Number(renderedId) !== Number(expectedRaceGender)) {
                  console.warn(
                    `[ZamModelViewer Canvas MutationObserver] Mismatch detected: canvas renderedId (#${renderedId}) !== character base ID (#${expectedRaceGender}). Forcing clean re-render of WebGL component...`
                  );
                  if (typeof instance.hardResetCanvas === "function") {
                    instance.hardResetCanvas(Number(expectedRaceGender));
                  }
                  return;
                }

                // Compare equipped gear items
                if (primaryActor && Array.isArray(gearState.items) && gearState.items.length > 0) {
                  const loadedActorItems: [number, number][] =
                    Array.isArray(primaryActor.items) ? primaryActor.items :
                    Array.isArray(primaryActor.gear) ? primaryActor.gear :
                    Array.isArray(primaryActor.equipment) ? primaryActor.equipment : [];

                  if (loadedActorItems.length > 0) {
                    const loadedMap = new Map<number, number>();
                    for (const [slot, dispId] of loadedActorItems) {
                      loadedMap.set(Number(slot), Number(dispId));
                    }
                    let gearMismatchFound = false;
                    let mismatchDetails = "";
                    for (const [slot, expectedDisplay] of gearState.items) {
                      const loadedDisplay = loadedMap.get(Number(slot));
                      if (loadedDisplay !== undefined && loadedDisplay !== Number(expectedDisplay)) {
                        gearMismatchFound = true;
                        mismatchDetails = `slot ${slot}: expected #${expectedDisplay}, loaded #${loadedDisplay}`;
                        break;
                      }
                    }
                    if (gearMismatchFound) {
                      console.warn(
                        `[ZamModelViewer Canvas MutationObserver] Gear mismatch detected with gear atual (${mismatchDetails})! Forcing clean re-render of WebGL component...`
                      );
                      if (typeof instance.hardResetCanvas === "function") {
                        instance.hardResetCanvas(gearState.raceGender || renderedId);
                      }
                      return;
                    }
                  }
                }
              }
            }, 50);
          });

          try {
            canvasMutationObserver.observe(canvas, {
              attributes: true,
              attributeFilter: [
                "data-zam-displayed-id",
                "data-zam-canvas-id",
                "data-zam-loaded-id",
                "data-zam-requested-id",
              ],
            });
            (canvas as any).__zamCanvasMutationObserver = canvasMutationObserver;
          } catch (_) {}
        }
      };

      // Check existing canvas immediately
      const existingCanvases = containerEl.querySelectorAll("canvas");
      existingCanvases.forEach((c) => bindCanvasEvents(c));

      // Also check renderer canvas if already created
      if (instance.renderer?.canvas?.[0]) {
        bindCanvasEvents(instance.renderer.canvas[0]);
      }

      // Observer: MutationObserver to catch canvas creation or replacements in container
      if (typeof MutationObserver !== "undefined" && !instance._domObserver) {
        const observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            for (let i = 0; i < mutation.addedNodes.length; i++) {
              const node = mutation.addedNodes[i];
              if (node instanceof HTMLCanvasElement) {
                bindCanvasEvents(node);
              } else if (node instanceof HTMLElement) {
                const childCanvases = node.querySelectorAll("canvas");
                childCanvases.forEach((c) => bindCanvasEvents(c));
              }
            }
          }
        });

        try {
          observer.observe(containerEl, { childList: true, subtree: true });
          instance._domObserver = observer;
        } catch (_) {}
      }
    }

    // Helper: 500ms Diagnostic check comparing internal requestedId with DOM displayedId
    function scheduleDiagnosticCheck(instance: any, delay = 500) {
      if (instance._diagnosticTimer) {
        clearTimeout(instance._diagnosticTimer);
      }

      instance._diagnosticTimer = setTimeout(() => {
        const requestedId = instance.requestedId ?? instance.options?.models?.id;
        if (requestedId === undefined || requestedId === null) return;

        const containerEl = instance.container ? (instance.container[0] || instance.container) : null;
        const canvasEl = containerEl?.querySelector?.("canvas") || instance.renderer?.canvas?.[0];

        // 1. Read displayedId rendered in the DOM
        let displayedId: number | null = null;
        const domAttr =
          canvasEl?.getAttribute("data-zam-displayed-id") ||
          canvasEl?.getAttribute("data-zam-canvas-id") ||
          containerEl?.getAttribute("data-zam-displayed-id") ||
          containerEl?.getAttribute("data-zam-loaded-id");

        if (domAttr !== null && domAttr !== undefined && domAttr !== "") {
          const parsed = Number(domAttr);
          if (!isNaN(parsed)) displayedId = parsed;
        }

        // 2. Cross-verify with active actor in WebGL renderer if available
        const actors = instance.renderer?.actors;
        if (Array.isArray(actors) && actors.length > 0 && actors[0]) {
          const actor = actors[0];
          const actorId = actor.id ?? actor.modelId ?? actor.displayId ?? actor.model?.id;
          if (actorId !== undefined && actorId !== null) {
            const parsedActorId = Number(actorId);
            if (!isNaN(parsedActorId)) {
              displayedId = parsedActorId;
              if (canvasEl) canvasEl.setAttribute("data-zam-displayed-id", String(parsedActorId));
              if (containerEl) containerEl.setAttribute("data-zam-displayed-id", String(parsedActorId));
            }
          }
        }

        // 3. Diagnostic comparison: if they mismatch after 500ms delay, trigger internal re-render with correct ID
        if (displayedId !== null && !isNaN(displayedId) && Number(displayedId) !== Number(requestedId)) {
          console.warn(
            `[ZamModelViewer Diagnostic] Asset ID mismatch detected after ${delay}ms delay: internal requestedId=${requestedId} !== DOM displayedId=${displayedId}. Triggering internal re-render with correct ID (${requestedId})...`
          );
          if (typeof instance.reRender === "function") {
            instance.reRender(Number(requestedId));
          }
        } else {
          // IDs match or verified: ensure DOM displayedId is stamped
          if (canvasEl && requestedId !== null) {
            canvasEl.setAttribute("data-zam-displayed-id", String(requestedId));
          }
          if (containerEl && requestedId !== null) {
            containerEl.setAttribute("data-zam-displayed-id", String(requestedId));
          }
        }
      }, delay);
    }

    function InterceptedZamModelViewer(this: any, options: any) {
      if (options && options.container) {
        const rawEl = options.container[0] || options.container;
        if (rawEl && rawEl instanceof HTMLElement) {
          disposeContainerWebGLContext(rawEl);
        }
      }

      let instance: any;
      try {
        instance = new OriginalViewer(options);
      } catch (err) {
        try {
          instance = OriginalViewer.call(this, options) || this;
        } catch (e2) {
          instance = this;
        }
      }

      // Preserve prototype chain
      if (instance && instance !== this) {
        Object.setPrototypeOf(instance, InterceptedZamModelViewer.prototype);
      }

      const self = instance || this;
      self.options = options;

      // Extract and stamp internal requestedId
      const modelId = options?.models?.id;
      const modelType = options?.models?.type;
      const requestedId = modelId !== undefined && modelId !== null ? Number(modelId) : null;
      self.requestedId = requestedId;
      self._requestedId = requestedId;

      const rawContainer = options?.container ? (options.container[0] || options.container) : null;
      if (rawContainer && rawContainer instanceof HTMLElement) {
        if (requestedId !== null) {
          rawContainer.setAttribute("data-zam-requested-id", String(requestedId));
          rawContainer.setAttribute("data-zam-displayed-id", String(requestedId));
          rawContainer.setAttribute("data-zam-loaded-id", String(requestedId));
        }
        if (modelType !== undefined) {
          rawContainer.setAttribute("data-zam-loaded-type", String(modelType));
        }
      }

      // Hard reset canvas method: cleans up WebGL context and reinstantiates canvas
      self.hardResetCanvas = function (assetId?: number) {
        if (this._isHardResetting || this._isDestroyed || this._isDisposing) return;

        const rawEl = this.container ? (this.container[0] || this.container) : null;
        if (!rawEl || !rawEl.isConnected) {
          return;
        }

        const now = Date.now();
        if (this._lastHardResetTime && now - this._lastHardResetTime < 2500) {
          return;
        }
        this._lastHardResetTime = now;
        this._isHardResetting = true;

        const targetId = assetId ?? this.requestedId ?? this.options?.models?.id;
        console.warn(`[ZamModelViewer] Hard reset canvas initiated for asset ID #${targetId}...`);

        // 1. Destroy old renderer safely
        try {
          if (this.renderer && typeof this.renderer.destroy === "function") {
            this.renderer.destroy();
          }
        } catch (_) {}

        // 2. Dispose container WebGL context
        disposeContainerWebGLContext(rawEl);

        // 3. Update target requested ID on options
        if (targetId !== undefined && targetId !== null) {
          const numId = Number(targetId);
          this.requestedId = numId;
          this._requestedId = numId;
          if (this.options?.models) {
            this.options.models.id = numId;
          }
          if (rawEl && rawEl.isConnected) {
            rawEl.setAttribute("data-zam-requested-id", String(numId));
            rawEl.setAttribute("data-zam-displayed-id", String(numId));
            rawEl.setAttribute("data-zam-loaded-id", String(numId));
          }
        }

        // 4. Re-initialize viewer with container dimensions
        try {
          if (rawEl && rawEl.isConnected && typeof this.init === "function") {
            const width = rawEl.clientWidth || rawEl.offsetWidth || 360;
            const height = Math.max(200, Math.round(width / (this.aspect || 1.1)));
            this.init(width, height);
          }
        } catch (initErr: any) {
          const msg = initErr?.message || String(initErr);
          if (!msg.includes("createTexture") && !msg.includes("css")) {
            console.warn("[ZamModelViewer] Hard reset init notice:", initErr);
          }
        }

        // 5. Re-attach WebGL context lost listeners and restart 500ms diagnostic check
        setTimeout(() => {
          this._isHardResetting = false;
          if (rawEl && rawEl.isConnected && !this._isDestroyed) {
            attachContextLostListenerAndObserver(this, rawEl);
            scheduleDiagnosticCheck(this, 500);
          }
        }, 120);
      };

      // Internal re-render with correct ID
      self.reRender = function (correctId?: number) {
        const targetId = correctId ?? this.requestedId ?? this.options?.models?.id;
        if (targetId !== undefined && targetId !== null) {
          const numId = Number(targetId);
          this.requestedId = numId;
          this._requestedId = numId;
          if (this.options?.models) {
            this.options.models.id = numId;
          }
        }
        this.hardResetCanvas(this.requestedId);
      };

      // Diagnostic check trigger
      self.runDiagnosticCheck = function (delay = 500) {
        scheduleDiagnosticCheck(this, delay);
      };

      // Override destroy to clean up timers and observers
      const originalDestroy = self.destroy;
      self.destroy = function () {
        this._isDestroyed = true;
        this._isDisposing = true;
        if (this._diagnosticTimer) {
          clearTimeout(this._diagnosticTimer);
          this._diagnosticTimer = null;
        }
        if (this._domObserver) {
          try {
            this._domObserver.disconnect();
          } catch (_) {}
          this._domObserver = null;
        }
        const el = this.container ? (this.container[0] || this.container) : null;
        if (el) {
          try {
            const canvases = el.querySelectorAll("canvas");
            canvases.forEach((c: any) => {
              if (c.__zamCanvasMutationObserver) {
                c.__zamCanvasMutationObserver.disconnect();
                c.__zamCanvasMutationObserver = null;
              }
            });
          } catch (_) {}
          disposeContainerWebGLContext(el);
        }
        try {
          if (originalDestroy) {
            originalDestroy.call(this);
          }
        } catch (_) {}
      };

      // Set up listeners, observer, and initial 500ms diagnostic check
      setTimeout(() => {
        attachContextLostListenerAndObserver(self, rawContainer);
        scheduleDiagnosticCheck(self, 500);
      }, 50);

      return self;
    }

    InterceptedZamModelViewer.prototype = Object.create(OriginalViewer.prototype);
    InterceptedZamModelViewer.prototype.constructor = InterceptedZamModelViewer;
    Object.assign(InterceptedZamModelViewer, OriginalViewer);
    InterceptedZamModelViewer.__intercepted = true;
    win.ZamModelViewer = InterceptedZamModelViewer;
  }
}

/**
 * Extracts active model ID, type, and equipped items from the loaded WebGL context & renderer
 */
export function extractZamViewerLoadedAsset(
  rawViewer: any,
  container?: HTMLElement | null
): {
  loadedId: number | null;
  loadedType: number | null;
  loadedItems: [number, number][];
  isContextLost: boolean;
} {
  let loadedId: number | null = null;
  let loadedType: number | null = null;
  let loadedItems: [number, number][] = [];
  let isContextLost = false;

  if (!rawViewer) {
    return { loadedId, loadedType, loadedItems, isContextLost: true };
  }

  // 1. Inspect Canvas WebGL context state
  if (container) {
    const canvas = container.querySelector("canvas");
    if (canvas) {
      try {
        const gl = (
          canvas.getContext("webgl2") ||
          canvas.getContext("webgl") ||
          canvas.getContext("experimental-webgl")
        ) as WebGLRenderingContext | null;
        if (gl && typeof gl.isContextLost === "function" && gl.isContextLost()) {
          isContextLost = true;
        }
      } catch (_) {}

      // Secondary check from stamped dataset
      const cid = canvas.getAttribute("data-zam-canvas-id") || (canvas as any).__zamModelId;
      if (cid && loadedId === null) {
        loadedId = Number(cid);
      }
      const ctype = (canvas as any).__zamModelType;
      if (ctype && loadedType === null) {
        loadedType = Number(ctype);
      }
      const citems = (canvas as any).__zamItems;
      if (Array.isArray(citems) && citems.length > 0 && loadedItems.length === 0) {
        loadedItems = citems;
      }
    }
  }

  // 2. Read from rawViewer.renderer.actors
  const actors = rawViewer.renderer?.actors || rawViewer.actors;
  if (Array.isArray(actors) && actors.length > 0) {
    const primaryActor = actors[0];
    if (primaryActor) {
      if (primaryActor.id !== undefined && primaryActor.id !== null) {
        loadedId = Number(primaryActor.id);
      } else if (primaryActor.modelId !== undefined) {
        loadedId = Number(primaryActor.modelId);
      } else if (primaryActor.displayId !== undefined) {
        loadedId = Number(primaryActor.displayId);
      } else if (primaryActor.model?.id !== undefined) {
        loadedId = Number(primaryActor.model.id);
      }

      if (primaryActor.type !== undefined) {
        loadedType = Number(primaryActor.type);
      } else if (primaryActor.model?.type !== undefined) {
        loadedType = Number(primaryActor.model.type);
      }

      if (Array.isArray(primaryActor.items)) {
        loadedItems = primaryActor.items;
      } else if (Array.isArray(primaryActor.gear)) {
        loadedItems = primaryActor.gear;
      } else if (Array.isArray(primaryActor.equipment)) {
        loadedItems = primaryActor.equipment;
      }
    }
  }

  // 3. Fallback: inspect rawViewer.models or rawViewer.options.models
  if (loadedId === null) {
    const models = rawViewer.models || rawViewer.options?.models || rawViewer.renderer?.models;
    if (models?.id !== undefined && models?.id !== null) {
      loadedId = Number(models.id);
      loadedType = models.type !== undefined ? Number(models.type) : null;
    }
  }

  // Fallback items from options
  if (loadedItems.length === 0) {
    const items = rawViewer.options?.items || rawViewer.items || rawViewer.renderer?.items;
    if (Array.isArray(items)) {
      loadedItems = items;
    }
  }

  return { loadedId, loadedType, loadedItems, isContextLost };
}

/**
 * Validates integrity between requested asset ID (mount, pet, or armory item)
 * and the actual asset loaded in the WebGL context.
 */
export function verifyZamViewerIntegrity(
  expected: ZamIntegrityExpectedAsset,
  rawViewer: any,
  container: HTMLElement
): ZamIntegrityCheckResult {
  const extracted = extractZamViewerLoadedAsset(rawViewer, container);
  const now = Date.now();

  // 1. Check if WebGL context is lost
  if (extracted.isContextLost) {
    return {
      isValid: false,
      expectedId: expected.expectedId,
      loadedId: extracted.loadedId,
      expectedType: expected.assetType,
      loadedType: extracted.loadedType,
      itemsMatched: false,
      isContextLost: true,
      reason: "WebGL context lost in canvas rendering layer",
      timestamp: now,
    };
  }

  // 2. Container desynchronization: check if user switched to another item in the UI
  const containerRequestedId = container.getAttribute("data-zam-requested-id");
  if (containerRequestedId && Number(containerRequestedId) !== Number(expected.expectedId)) {
    return {
      isValid: false,
      expectedId: expected.expectedId,
      loadedId: extracted.loadedId,
      expectedType: expected.assetType,
      loadedType: extracted.loadedType,
      itemsMatched: false,
      reason: `Container requested asset has changed to #${containerRequestedId} (this viewer expected #${expected.expectedId})`,
      timestamp: now,
    };
  }

  // 3. Direct ID comparison: verify that WebGL actor loaded ID matches expected ID
  if (extracted.loadedId !== null && Number(extracted.loadedId) !== Number(expected.expectedId)) {
    return {
      isValid: false,
      expectedId: expected.expectedId,
      loadedId: extracted.loadedId,
      expectedType: expected.assetType,
      loadedType: extracted.loadedType,
      itemsMatched: false,
      reason: `Asset ID mismatch: WebGL loaded asset #${extracted.loadedId}, but component requested #${expected.expectedId}`,
      timestamp: now,
    };
  }

  // 4. Model Type verification: 8 = NPC/Mount/Pet, 16 = Character, 1 = Item
  if (extracted.loadedType !== null) {
    const expectedTypeCode =
      expected.assetType === "character" ? 16 :
      expected.assetType === "item" ? 1 : 8;
    if (extracted.loadedType !== expectedTypeCode) {
      return {
        isValid: false,
        expectedId: expected.expectedId,
        loadedId: extracted.loadedId,
        expectedType: expected.assetType,
        loadedType: extracted.loadedType,
        itemsMatched: false,
        reason: `Model Type mismatch: WebGL type is ${extracted.loadedType}, expected ${expectedTypeCode}`,
        timestamp: now,
      };
    }
  }

  // 5. Character Armory Equipment item integrity verification
  let itemsMatched = true;
  const mismatchedSlots: { slot: number; expected: number; loaded?: number }[] = [];
  if (expected.assetType === "character" && expected.expectedItems && expected.expectedItems.length > 0) {
    if (extracted.loadedItems.length > 0) {
      const loadedMap = new Map(extracted.loadedItems);
      for (const [slot, expectedDisplay] of expected.expectedItems) {
        if (!expectedDisplay || expectedDisplay <= 0) continue;
        const loadedDisplay = loadedMap.get(slot);
        if (loadedDisplay !== undefined && loadedDisplay !== expectedDisplay) {
          mismatchedSlots.push({ slot, expected: expectedDisplay, loaded: loadedDisplay });
        }
      }
      if (mismatchedSlots.length > 0) {
        itemsMatched = false;
        const slotDescs = mismatchedSlots
          .map((s) => `slot ${s.slot} (expected display #${s.expected}, loaded #${s.loaded})`)
          .join(", ");
        return {
          isValid: false,
          expectedId: expected.expectedId,
          loadedId: extracted.loadedId,
          expectedType: expected.assetType,
          loadedType: extracted.loadedType,
          itemsMatched: false,
          mismatchedSlots,
          reason: `Armory equipment mismatch: ${slotDescs}`,
          timestamp: now,
        };
      }
    }
  }

  return {
    isValid: true,
    expectedId: expected.expectedId,
    loadedId: extracted.loadedId ?? expected.expectedId,
    expectedType: expected.assetType,
    loadedType: extracted.loadedType,
    itemsMatched,
    timestamp: now,
  };
}

/**
 * Verificação de integridade de modelo no ZamModelViewer:
 * Antes de renderizar, compara o Display ID do item equipado / ativo
 * com o ID do modelo carregado no canvas. Se houver discrepância,
 * força a re-inicialização do contexto WebGL para carregar o ativo correto.
 */
export function verifyModelIntegrityBeforeRender(
  container: HTMLElement,
  rawViewer: any,
  expected: ZamIntegrityExpectedAsset,
  onMismatchForceReset?: () => void | Promise<any>
): boolean {
  if (!container || !rawViewer) return true;

  const result = verifyZamViewerIntegrity(expected, rawViewer, container);
  if (!result.isValid) {
    console.warn(
      `[ZamModelViewer Model Integrity] Discrepancy detected before render: ${result.reason}. Forcing clean WebGL context re-initialization to load correct asset #${expected.expectedId}...`
    );

    if (typeof onMismatchForceReset === "function") {
      try {
        onMismatchForceReset();
      } catch (err) {
        console.warn("[ZamModelViewer Model Integrity] Error in onMismatchForceReset callback:", err);
      }
    } else if (typeof rawViewer.hardResetCanvas === "function") {
      rawViewer.hardResetCanvas(Number(expected.expectedId));
    } else {
      disposeContainerWebGLContext(container);
    }
    return false;
  }

  return true;
}

/**
 * Attaches an automated integrity validation monitor to a ZamViewerInstance.
 * Periodically verifies (at mount, +120ms, +550ms, and on demand) that the WebGL context
 * actually renders the expected asset ID and equipment.
 * If a mismatch is detected, it disposes the container's WebGL context and triggers a clean reload.
 */
export function attachModelViewerIntegrityGuard(
  container: HTMLElement,
  rawViewer: any,
  expected: ZamIntegrityExpectedAsset,
  reloadCallback: () => Promise<ZamViewerInstance | null>,
  currentAttempt = 0,
  maxAttempts = 2
): {
  verify: () => ZamIntegrityCheckResult;
  forceReload: () => Promise<boolean>;
  stop: () => void;
} {
  let isStopped = false;
  let timer1: any = null;
  let timer2: any = null;

  const performCheck = async (): Promise<boolean> => {
    if (isStopped) return true;
    const check = verifyZamViewerIntegrity(expected, rawViewer, container);
    if (!check.isValid) {
      console.warn(
        `[ZamModelViewer Integrity Guard] Incompatibility detected: ${check.reason}. ` +
        `Expected ${expected.assetType} #${expected.expectedId}, loaded #${check.loadedId}. ` +
        (currentAttempt < maxAttempts
          ? `Forcing clean reload (attempt ${currentAttempt + 1}/${maxAttempts})...`
          : "Max reload attempts reached.")
      );

      if (currentAttempt < maxAttempts) {
        isStopped = true;
        clearTimeout(timer1);
        clearTimeout(timer2);
        disposeContainerWebGLContext(container);
        try {
          await reloadCallback();
          return false;
        } catch (err) {
          console.warn("[ZamModelViewer Integrity Guard] Reload error:", err);
          return false;
        }
      }
      return false;
    }
    return true;
  };

  timer1 = setTimeout(() => {
    performCheck();
  }, 120);

  timer2 = setTimeout(() => {
    performCheck();
  }, 550);

  return {
    verify: () => verifyZamViewerIntegrity(expected, rawViewer, container),
    forceReload: async () => {
      isStopped = true;
      clearTimeout(timer1);
      clearTimeout(timer2);
      disposeContainerWebGLContext(container);
      const res = await reloadCallback();
      return res !== null;
    },
    stop: () => {
      isStopped = true;
      clearTimeout(timer1);
      clearTimeout(timer2);
    },
  };
}

// Global cache to avoid redundant asset prefetching
const PRELOADED_ASSET_CACHE = new Set<string>();

/**
 * Preloads shaders, metadata, and textures for ZamModelViewer with locale=en_US
 * to prevent model pop-in, Dwarf fallback glitches, and misaligned gear.
 */
export async function preloadZamModelAssets(config: {
  models?: { id: number; type: number };
  items?: [number, number][];
  locale?: string;
}): Promise<void> {
  const locale = config.locale || "en_US";
  const tasks: Promise<void>[] = [];

  // Preload creature or character metadata and textures
  if (config.models?.id) {
    const metaKey = config.models.type === 16 ? `char-${config.models.id}` : `npc-${config.models.id}`;
    if (!PRELOADED_ASSET_CACHE.has(metaKey)) {
      PRELOADED_ASSET_CACHE.add(metaKey);
      const url =
        config.models.type === 16
          ? `/api/zamimg/modelviewer/live/meta/charactercustomization/${config.models.id}.json?locale=${locale}`
          : `/api/zamimg/modelviewer/live/meta/npc/${config.models.id}.json?locale=${locale}`;

      tasks.push(
        fetch(url)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (!data) return;
            const textures = [
              ...(Array.isArray(data.Textures) ? data.Textures : []),
              ...(Array.isArray(data.Textures2) ? data.Textures2 : []),
              ...(Array.isArray(data.TextureFiles) ? data.TextureFiles : []),
            ];
            for (const t of textures) {
              if (t && typeof t === "string") {
                const img = new Image();
                img.src = `/api/zamimg/modelviewer/live/textures/${t.toLowerCase()}`;
              } else if (typeof t === "number") {
                const img = new Image();
                img.src = `/api/zamimg/modelviewer/live/textures/${t}.png`;
              }
            }
          })
          .catch(() => {})
      );
    }
  }

  // Preload item gear metadata and textures with exact display IDs and locale=en_US
  if (config.items && Array.isArray(config.items)) {
    for (const [slot, displayId] of config.items) {
      if (!displayId || displayId <= 0) continue;
      const itemKey = `item-${slot}-${displayId}`;
      if (PRELOADED_ASSET_CACHE.has(itemKey)) continue;
      PRELOADED_ASSET_CACHE.add(itemKey);

      const isArmor = [1, 3, 4, 5, 6, 7, 8, 9, 10, 16, 19, 20].includes(slot);
      const itemUrl = isArmor
        ? `/api/zamimg/modelviewer/live/meta/armor/${slot}/${displayId}.json?locale=${locale}`
        : `/api/zamimg/modelviewer/live/meta/item/${displayId}.json?locale=${locale}`;

      tasks.push(
        fetch(itemUrl)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (!data) return;
            const textures: (string | number)[] = [];
            if (data.Textures) {
              if (Array.isArray(data.Textures)) textures.push(...data.Textures);
              else if (typeof data.Textures === "object") textures.push(...Object.values(data.Textures) as (string | number)[]);
            }
            if (data.Textures2) {
              if (Array.isArray(data.Textures2)) textures.push(...data.Textures2);
              else if (typeof data.Textures2 === "object") textures.push(...Object.values(data.Textures2) as (string | number)[]);
            }
            if (Array.isArray(data.TextureFiles)) {
              textures.push(...data.TextureFiles);
            }
            for (const t of textures) {
              if (t && typeof t === "string") {
                const img = new Image();
                img.src = `/api/zamimg/modelviewer/live/textures/${t.toLowerCase()}`;
              } else if (typeof t === "number") {
                const img = new Image();
                img.src = `/api/zamimg/modelviewer/live/textures/${t}.png`;
              }
            }
          })
          .catch(() => {})
      );
    }
  }

  try {
    await Promise.allSettled(tasks);
  } catch (_) {}
}

export async function createWowCharacterViewer(
  container: HTMLElement,
  character: Character3DConfig,
  aspect = 1.1,
  reloadAttempt = 0
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

  // Stamp container with requested asset info for cross-component desynchronization detection
  container.setAttribute("data-zam-requested-id", String(raceGender));
  container.setAttribute("data-zam-requested-type", "character");

  let charOptions: any[] = [];
  if (character.customizations && Array.isArray(character.customizations) && character.customizations.length > 0) {
    charOptions = character.customizations
      .map((c: any) => ({
        optionId: c.option?.id ?? c.optionId,
        choiceId: c.choice?.id ?? c.choiceId,
      }))
      .filter((c: any) => c.optionId !== undefined && c.choiceId !== undefined);
  }

  if (charOptions.length === 0) {
    const fullOptions = await fetchCharacterCustomizationOptions(race, gender);
    if (fullOptions) {
      charOptions = buildCharacterOptions(character, fullOptions);
    }
  }

  const rawItems = (character.items || []).filter(([slot]) => !NOT_DISPLAYED_SLOTS.includes(slot));

  // Pre-fetching layer: verify all character gear items in IndexedDB before 3D instantiation
  const items = await prefetchAndVerifyBlizzardGearList(rawItems, "en_US");

  // Pre-load all character shaders, item metadata, and textures with locale=en_US
  await preloadZamModelAssets({
    models: { id: raceGender, type: 16 },
    items,
    locale: "en_US",
  });

  // Properly dispose any existing WebGL contexts and canvas elements in container
  disposeContainerWebGLContext(container);
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
    locale: "en_US",
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

    hostDiv.setAttribute("data-zam-loaded-id", String(raceGender));
    hostDiv.setAttribute("data-zam-loaded-type", "16");

    const expectedAsset: ZamIntegrityExpectedAsset = {
      assetType: "character",
      expectedId: raceGender,
      expectedItems: items,
      assetLabel: `Character Race ${race} Gender ${gender}`,
    };

    const integrityGuard = attachModelViewerIntegrityGuard(
      container,
      rawViewer,
      expectedAsset,
      () => createWowCharacterViewer(container, character, aspect, reloadAttempt + 1),
      reloadAttempt,
      2
    );

    // Verificação de integridade de modelo antes de renderizar
    verifyModelIntegrityBeforeRender(
      container,
      rawViewer,
      expectedAsset,
      () => createWowCharacterViewer(container, character, aspect, reloadAttempt + 1)
    );

    const viewerWrapper: ZamViewerInstance = {
      setAnimation: (anim: string) => {
        try {
          const actor = rawViewer.renderer?.actors?.[0];
          // Check if actor and its animation state are fully initialized
          const hasP = Boolean(
            actor &&
            actor.ai &&
            typeof actor.ai === "object" &&
            "P" in (actor.ai as any) &&
            (actor.ai as any).P
          );
          if (actor && hasP && typeof actor.setAnimation === "function") {
            try {
              actor.setAnimation(anim);
            } catch (_) {}
          }
        } catch (_) {}
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
        integrityGuard.stop();
        try {
          if (rawViewer.destroy) rawViewer.destroy();
        } catch (_) {}
        disposeContainerWebGLContext(container);
      },
      renderer: rawViewer.renderer,
      method: rawViewer.method ? rawViewer.method.bind(rawViewer) : undefined,
      expectedAsset,
      verifyIntegrity: () => integrityGuard.verify(),
      forceReloadIfMismatched: () => integrityGuard.forceReload(),
      getLoadedAssetInfo: () => extractZamViewerLoadedAsset(rawViewer, container),
      reRender: (correctId?: number) => {
        if (typeof rawViewer.reRender === "function") rawViewer.reRender(correctId);
      },
      hardResetCanvas: (assetId?: number) => {
        if (typeof rawViewer.hardResetCanvas === "function") rawViewer.hardResetCanvas(assetId);
      },
      runDiagnosticCheck: (delay?: number) => {
        if (typeof rawViewer.runDiagnosticCheck === "function") rawViewer.runDiagnosticCheck(delay);
      },
      requestedId: rawViewer.requestedId ?? raceGender,
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
  aspect = 1.1,
  assetType: "mount" | "pet" | "npc" = "mount",
  reloadAttempt = 0
): Promise<ZamViewerInstance | null> {
  await ensureViewerAssetsLoaded();
  const win = window as any;
  if (!win.ZamModelViewer || !win.jQuery) {
    console.warn("ZamModelViewer or jQuery not loaded on window");
    return null;
  }

  // Pre-fetching layer: verify asset display ID in IndexedDB before 3D instantiation
  const category = assetType === "pet" ? "pet" : "mount";
  const verified = await prefetchAndVerifyBlizzardAsset(category, creatureDisplayId, creatureDisplayId, "en_US");
  const targetCreatureDisplayId = verified.verifiedDisplayId > 0 ? verified.verifiedDisplayId : creatureDisplayId;

  // Stamp container with requested asset info for cross-component desynchronization detection
  container.setAttribute("data-zam-requested-id", String(targetCreatureDisplayId));
  container.setAttribute("data-zam-requested-type", assetType);

  // Properly dispose any existing WebGL contexts and canvas elements in container
  disposeContainerWebGLContext(container);
  const initialWidth = container.clientWidth || container.offsetWidth || 400;
  const initialHeight = Math.max(260, Math.round(initialWidth / aspect));

  const hostDiv = document.createElement("div");
  hostDiv.id = `zam-mount-host-${Math.random().toString(36).substring(2, 9)}`;
  hostDiv.style.width = "100%";
  hostDiv.style.height = "100%";
  hostDiv.style.minHeight = `${initialHeight}px`;
  hostDiv.className = "zam-clean-mount-host";
  container.appendChild(hostDiv);

  // Preload creature model metadata and textures with locale=en_US
  await preloadZamModelAssets({
    models: { id: targetCreatureDisplayId, type: 8 },
    items: [],
    locale: "en_US",
  });

  const viewerOptions: any = {
    type: 2, // WOW
    contentPath: "/api/zamimg/modelviewer/live/",
    container: win.jQuery(hostDiv),
    aspect: aspect,
    hd: true,
    locale: "en_US",
    models: {
      id: targetCreatureDisplayId,
      type: 8, // NPC / CREATURE / MOUNT
    },
    items: [],
  };

  try {
    const rawViewer = new win.ZamModelViewer(viewerOptions);
    try {
      rawViewer.setAdaptiveMode?.(true);
    } catch (_) {}

    hostDiv.setAttribute("data-zam-loaded-id", String(targetCreatureDisplayId));
    hostDiv.setAttribute("data-zam-loaded-type", "8");

    const expectedAsset: ZamIntegrityExpectedAsset = {
      assetType,
      expectedId: targetCreatureDisplayId,
      assetLabel: `${assetType} #${targetCreatureDisplayId}`,
    };

    const integrityGuard = attachModelViewerIntegrityGuard(
      container,
      rawViewer,
      expectedAsset,
      () => createWowMountViewer(container, targetCreatureDisplayId, aspect, assetType, reloadAttempt + 1),
      reloadAttempt,
      2
    );

    // Verificação de integridade de modelo antes de renderizar
    verifyModelIntegrityBeforeRender(
      container,
      rawViewer,
      expectedAsset,
      () => createWowMountViewer(container, targetCreatureDisplayId, aspect, assetType, reloadAttempt + 1)
    );

    const viewerWrapper: ZamViewerInstance = {
      setAnimation: (anim: string) => {
        try {
          const actor = rawViewer.renderer?.actors?.[0];
          const hasP = Boolean(
            actor &&
            actor.ai &&
            typeof actor.ai === "object" &&
            "P" in (actor.ai as any) &&
            (actor.ai as any).P
          );
          if (actor && hasP && typeof actor.setAnimation === "function") {
            try {
              actor.setAnimation(anim);
            } catch (_) {}
          }
        } catch (_) {}
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
        integrityGuard.stop();
        try {
          if (rawViewer.destroy) rawViewer.destroy();
        } catch (_) {}
        disposeContainerWebGLContext(container);
      },
      renderer: rawViewer.renderer,
      method: rawViewer.method ? rawViewer.method.bind(rawViewer) : undefined,
      expectedAsset,
      verifyIntegrity: () => integrityGuard.verify(),
      forceReloadIfMismatched: () => integrityGuard.forceReload(),
      getLoadedAssetInfo: () => extractZamViewerLoadedAsset(rawViewer, container),
      reRender: (correctId?: number) => {
        if (typeof rawViewer.reRender === "function") rawViewer.reRender(correctId);
      },
      hardResetCanvas: (assetId?: number) => {
        if (typeof rawViewer.hardResetCanvas === "function") rawViewer.hardResetCanvas(assetId);
      },
      runDiagnosticCheck: (delay?: number) => {
        if (typeof rawViewer.runDiagnosticCheck === "function") rawViewer.runDiagnosticCheck(delay);
      },
      requestedId: rawViewer.requestedId ?? creatureDisplayId,
    };

    return viewerWrapper;
  } catch (err: any) {
    console.warn("Notice: ZamModelViewer creature interactive mode preparing textures:", err?.message || String(err));
    return null;
  }
}

/**
 * Creates and mounts a Wowhead ZamModelViewer 3D instance for a Pet (companion / battle pet)
 */
export async function createWowPetViewer(
  container: HTMLElement,
  creatureDisplayId: number,
  aspect = 1.3,
  reloadAttempt = 0
): Promise<ZamViewerInstance | null> {
  return createWowMountViewer(container, creatureDisplayId, aspect, "pet", reloadAttempt);
}

/**
 * Creates and mounts a Wowhead ZamModelViewer 3D instance for a single Armory Item (weapons, shields, armor)
 */
export async function createWowItemViewer(
  container: HTMLElement,
  itemDisplayId: number,
  aspect = 1.1,
  reloadAttempt = 0
): Promise<ZamViewerInstance | null> {
  await ensureViewerAssetsLoaded();
  const win = window as any;
  if (!win.ZamModelViewer || !win.jQuery) {
    console.warn("ZamModelViewer or jQuery not loaded on window");
    return null;
  }

  // Pre-fetching layer: verify item display ID in IndexedDB before 3D instantiation
  const verified = await prefetchAndVerifyBlizzardAsset("item", itemDisplayId, itemDisplayId, "en_US");
  const targetItemDisplayId = verified.verifiedDisplayId > 0 ? verified.verifiedDisplayId : itemDisplayId;

  container.setAttribute("data-zam-requested-id", String(targetItemDisplayId));
  container.setAttribute("data-zam-requested-type", "item");
  disposeContainerWebGLContext(container);

  const initialWidth = container.clientWidth || container.offsetWidth || 360;
  const initialHeight = Math.max(260, Math.round(initialWidth / aspect));

  const hostDiv = document.createElement("div");
  hostDiv.id = `zam-item-host-${Math.random().toString(36).substring(2, 9)}`;
  hostDiv.style.width = "100%";
  hostDiv.style.height = "100%";
  hostDiv.style.minHeight = `${initialHeight}px`;
  hostDiv.className = "zam-clean-item-host";
  container.appendChild(hostDiv);

  await preloadZamModelAssets({
    models: { id: targetItemDisplayId, type: 1 },
    items: [],
    locale: "en_US",
  });

  const viewerOptions: any = {
    type: 2, // WOW
    contentPath: "/api/zamimg/modelviewer/live/",
    container: win.jQuery(hostDiv),
    aspect: aspect,
    hd: true,
    locale: "en_US",
    models: {
      id: targetItemDisplayId,
      type: 1, // ITEM
    },
    items: [],
  };

  try {
    const rawViewer = new win.ZamModelViewer(viewerOptions);
    try {
      rawViewer.setAdaptiveMode?.(true);
    } catch (_) {}

    hostDiv.setAttribute("data-zam-loaded-id", String(targetItemDisplayId));
    hostDiv.setAttribute("data-zam-loaded-type", "1");

    const expectedAsset: ZamIntegrityExpectedAsset = {
      assetType: "item",
      expectedId: targetItemDisplayId,
      assetLabel: `Item #${targetItemDisplayId}`,
    };

    const integrityGuard = attachModelViewerIntegrityGuard(
      container,
      rawViewer,
      expectedAsset,
      () => createWowItemViewer(container, targetItemDisplayId, aspect, reloadAttempt + 1),
      reloadAttempt,
      2
    );

    const viewerWrapper: ZamViewerInstance = {
      setAnimation: () => {},
      setAnimPaused: (paused: boolean) => {
        try {
          if (rawViewer.renderer?.actors?.[0]?.setAnimPaused) {
            rawViewer.renderer.actors[0].setAnimPaused(paused);
          }
        } catch (_) {}
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
        integrityGuard.stop();
        try {
          if (rawViewer.destroy) rawViewer.destroy();
        } catch (_) {}
        disposeContainerWebGLContext(container);
      },
      renderer: rawViewer.renderer,
      method: rawViewer.method ? rawViewer.method.bind(rawViewer) : undefined,
      expectedAsset,
      verifyIntegrity: () => integrityGuard.verify(),
      forceReloadIfMismatched: () => integrityGuard.forceReload(),
      getLoadedAssetInfo: () => extractZamViewerLoadedAsset(rawViewer, container),
      reRender: (correctId?: number) => {
        if (typeof rawViewer.reRender === "function") rawViewer.reRender(correctId);
      },
      hardResetCanvas: (assetId?: number) => {
        if (typeof rawViewer.hardResetCanvas === "function") rawViewer.hardResetCanvas(assetId);
      },
      runDiagnosticCheck: (delay?: number) => {
        if (typeof rawViewer.runDiagnosticCheck === "function") rawViewer.runDiagnosticCheck(delay);
      },
      requestedId: rawViewer.requestedId ?? itemDisplayId,
    };

    return viewerWrapper;
  } catch (err: any) {
    console.warn("Notice: ZamModelViewer item mode preparing textures:", err?.message || String(err));
    return null;
  }
}
