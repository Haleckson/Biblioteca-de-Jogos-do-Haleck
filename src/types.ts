/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MediaItem {
  src: string;
  isVideo: boolean;
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
  playtime: string;
  rating: number; // 0 to 5, step 0.5
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD or empty
  releaseDate: string; // YYYY-MM-DD
  diary: DiaryEntry[];
}
