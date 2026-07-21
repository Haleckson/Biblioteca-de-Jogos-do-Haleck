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
  difficulty?: string;
  hltbMain?: string;
  hltbExtra?: string;
  hltbCompletionist?: string;
  hltbId?: string;
  metacriticUrl?: string;
  metacriticCritScore?: number;
  metacriticUserScore?: number;
}

export function splitEntities(val: string | undefined | null): string[] {
  if (!val) return [];
  return val.split("; ").map((s) => s.trim()).filter(Boolean);
}

