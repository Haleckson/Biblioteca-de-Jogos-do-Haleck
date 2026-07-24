/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MediaItem {
  src: string;
  isVideo: boolean;
  deleteUrl?: string;
}

export interface DiaryEntry {
  id: string;
  period: string; // e.g. "10/05/2026 ~ 18/05/2026"
  medias: MediaItem[];
  text: string;
}

export interface Game {
  id: string;
  name: string;
  icon: string;
  iconType: "emoji" | "upload" | "url";
  series: string;
  cover: string;
  status: string[]; // e.g. ["Jogando", "Terminado"]
  platform: string;
  genre: string[];
  tags: string[];
  publisher: string;
  developer?: string;
  studio?: string;
  playtime: string;
  additionalPlaytime?: string;
  rating: number; // 0 to 5, step 0.5
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD or empty
  releaseDate: string; // YYYY-MM-DD
  diary: DiaryEntry[];
  coverPosition?: number;
  coverPositionX?: number;
  coverZoom?: number;
  replayed?: boolean;
  replayCount?: number;
  isDlc?: boolean;
  dlcMode?: "none" | "dlc" | "plus_dlc";
  dlcNames?: string;
  difficulty?: string;
  hltbMain?: string;
  hltbExtra?: string;
  hltbCompletionist?: string;
  hltbId?: string;
  metacriticUrl?: string;
  metacriticCritScore?: number;
  metacriticUserScore?: number;
  trophy?: "none" | "silver" | "gold" | "platinum";
  trophies?: ("silver" | "gold" | "platinum")[];
  pros?: string;
  cons?: string;
}

export function getGameTrophies(game: Partial<Game>): ("silver" | "gold" | "platinum")[] {
  if (Array.isArray(game.trophies) && game.trophies.length > 0) {
    return game.trophies;
  }
  if (game.trophy && game.trophy !== "none") {
    return [game.trophy as "silver" | "gold" | "platinum"];
  }
  return [];
}

export function getGameHighestTrophy(game: Partial<Game>): "none" | "silver" | "gold" | "platinum" {
  const trophies = getGameTrophies(game);
  if (trophies.includes("platinum")) return "platinum";
  if (trophies.includes("gold")) return "gold";
  if (trophies.includes("silver")) return "silver";
  return "none";
}

export function splitEntities(val: string | undefined | null): string[] {
  if (!val) return [];
  return val.split("; ").map((s) => s.trim()).filter(Boolean);
}

export function getDlcMode(game: { dlcMode?: "none" | "dlc" | "plus_dlc" | string; isDlc?: boolean | string }): "none" | "dlc" | "plus_dlc" {
  if (game.dlcMode === "plus_dlc" || game.isDlc === ("plus_dlc" as any)) return "plus_dlc";
  if (game.dlcMode === "dlc" || game.isDlc === ("dlc" as any) || game.isDlc === true) return "dlc";
  return "none";
}

export function formatDateDisplay(dateStr: string | undefined | null): string {
  if (!dateStr || !dateStr.trim()) return "";
  const clean = dateStr.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) return clean;
  const match = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) {
    const [, yyyy, mm, dd] = match;
    const formattedDd = dd.padStart(2, "0");
    const formattedMm = mm.padStart(2, "0");
    return `${formattedDd}/${formattedMm}/${yyyy}`;
  }
  const matchReverse = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (matchReverse) {
    const [, dd, mm, yyyy] = matchReverse;
    const formattedDd = dd.padStart(2, "0");
    const formattedMm = mm.padStart(2, "0");
    return `${formattedDd}/${formattedMm}/${yyyy}`;
  }
  return clean;
}

