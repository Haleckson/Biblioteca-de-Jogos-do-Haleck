/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ActiveLiveSession {
  gameId: string;
  startTimestamp: number; // Date.now() when started
  accumulatedMs: number; // Elapsed ms prior to last pause
  isPaused: boolean;
  pausedTimestamp?: number;
  sessionNotes?: string;
}

export interface MediaItem {
  id?: string;
  src: string;
  isVideo: boolean;
  deleteUrl?: string;
}

export interface DiaryEntry {
  id: string;
  period: string; // e.g. "10/05/2026 ~ 18/05/2026"
  medias: MediaItem[];
  text: string;
  keyMoments?: string[]; // e.g. ["Boss Fight", "Platina", "Plot Twist", "Review Final", "Momento Épico"]
}

export interface TrashItem {
  id: string;
  deletedAt: number; // Date.now()
  type: "game" | "diary_entry" | "media";
  title: string;
  gameId?: string;
  gameTitle?: string;
  diaryEntryId?: string;
  data: any; // Original deleted payload
}

export interface TrophyItem {
  type: "silver" | "gold" | "platinum";
  note?: string;
}

export interface DictionaryFormat {
  textColor?: string;
  bgColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

export interface DictionaryItem {
  id: string;
  term: string; // Word or phrase, e.g. "Korok Seed" or "Term 1, Term 2"
  variants?: string[]; // Optional variations, plurals, or synonyms, e.g. ["Korok Seeds", "Sementes Korok"] or ["Kakariko Village"]
  group?: string; // Optional group/conjunto name, e.g. "Itens", "Personagens"
  format: DictionaryFormat;
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
  dictionary?: DictionaryItem[];
  coverPosition?: number;
  coverPositionX?: number;
  coverZoom?: number;
  replayed?: boolean;
  replayCount?: number;
  replayNote?: string;
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
  trophies?: (("silver" | "gold" | "platinum") | TrophyItem)[];
  pros?: string;
  cons?: string;
  isGaaS?: boolean;
  pricePaid?: number;
  integrationPlatform?: "steam" | "gog" | "none";
  steamAppId?: number | string;
  steamPlaytimeMinutes?: number;
  steamLastPlayedTimestamp?: number;
  steamAchievementsCount?: number;
  steamAchievementsTotal?: number;
  gogGameId?: number | string;
  gogPlaytimeMinutes?: number;
  gogLastPlayedTimestamp?: number;
  gogAchievementsCount?: number;
  gogAchievementsTotal?: number;
}

export function getGameTrophyItems(game: Partial<Game>): TrophyItem[] {
  if (Array.isArray(game.trophies) && game.trophies.length > 0) {
    return game.trophies.map((item) => {
      if (typeof item === "string") {
        return { type: item as "silver" | "gold" | "platinum", note: "" };
      }
      if (item && typeof item === "object" && item.type) {
        return { type: item.type, note: item.note || "" };
      }
      return { type: "silver", note: "" };
    });
  }
  if (game.trophy && game.trophy !== "none") {
    return [{ type: game.trophy as "silver" | "gold" | "platinum", note: "" }];
  }
  return [];
}

export function getGameTrophies(game: Partial<Game>): ("silver" | "gold" | "platinum")[] {
  return getGameTrophyItems(game).map((item) => item.type);
}

export function getGameHighestTrophy(game: Partial<Game>): "none" | "silver" | "gold" | "platinum" {
  const trophyTypes = getGameTrophies(game);
  if (trophyTypes.includes("platinum")) return "platinum";
  if (trophyTypes.includes("gold")) return "gold";
  if (trophyTypes.includes("silver")) return "silver";
  return "none";
}

export function splitEntities(val: string | undefined | null): string[] {
  if (!val) return [];
  return val.split(/[;\n\r]+/).map((s) => s.trim()).filter(Boolean);
}

export interface ContextParsed {
  main: string;
  note?: string;
}

export function parseContextNote(raw: string | undefined | null): ContextParsed {
  if (!raw) return { main: "" };
  const trimmed = raw.trim();
  if (!trimmed) return { main: "" };

  // Prioritize bracket match: "Topic [Note]"
  const bracketMatch = trimmed.match(/^([^[]+)\[([^\]]+)\]$/);
  if (bracketMatch) {
    return {
      main: bracketMatch[1].trim(),
      note: bracketMatch[2].trim(),
    };
  }

  // Fallback check for parenthesis match: "Topic (Note)"
  const parenMatch = trimmed.match(/^([^(]+)\(([^)]+)\)$/);
  if (parenMatch) {
    return {
      main: parenMatch[1].trim(),
      note: parenMatch[2].trim(),
    };
  }

  return { main: trimmed };
}

export interface ProConParsed {
  topic: string;
  note?: string;
}

export function parseProConTopic(raw: string): ProConParsed {
  const parsed = parseContextNote(raw);
  return {
    topic: parsed.main,
    note: parsed.note,
  };
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

