/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Game } from "../types";

/**
 * Parses any playtime string (e.g., "42h 15m", "20.5h", "15 ½ Hours", "45.5") into decimal hours.
 */
export function parsePlaytimeHours(val: string | number | undefined | null): number {
  if (val === undefined || val === null) return 0;
  
  if (typeof val === "number") return isNaN(val) ? 0 : val;

  let str = String(val).trim();
  if (!str || str === "-" || str === "—") return 0;

  let hasHalf = false;
  if (str.includes("½")) {
    hasHalf = true;
    str = str.replace("½", "");
  }

  // Handle "Xh Ym" or "X Hours Y Mins" or "XhYm" or "X:Y"
  const hmMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:h|hora|horas|hour|hours|:)\s*(\d+)\s*(?:m|min|mins|minuto|minutos)?/i);
  if (hmMatch) {
    const hours = parseFloat(hmMatch[1]) || 0;
    const mins = parseFloat(hmMatch[2]) || 0;
    const total = hours + mins / 60 + (hasHalf ? 0.5 : 0);
    return total > 25000 ? 0 : total;
  }

  // Handle "Xh" or "X hours" or "X horas"
  const hMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:h|hora|horas|hour|hours)?/i);
  if (hMatch && hMatch[1]) {
    const hours = parseFloat(hMatch[1]) || 0;
    const total = hours + (hasHalf ? 0.5 : 0);
    return total > 25000 ? 0 : total;
  }

  // Handle plain numbers e.g. "20.5" or "20,5"
  const cleaned = str.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const num = parseFloat(cleaned);
  let total = 0;
  if (!isNaN(num)) {
    total = num + (hasHalf ? 0.5 : 0);
  }

  // Reject impossible hours (> 25,000 hours, e.g. product IDs or epoch timestamps stored by mistake)
  if (total > 25000) return 0;
  return total;
}

/**
 * Formats a decimal number of hours into a readable "00h 00m" string (e.g. 12.5 -> "12h 30m", 0.5 -> "00h 30m", 1250 -> "1250h 00m").
 */
export function formatHoursAndMinutes(totalHours: number): string {
  if (isNaN(totalHours) || totalHours <= 0) return "00h 00m";

  let hours = Math.floor(totalHours);
  let mins = Math.round((totalHours - hours) * 60);

  if (mins >= 60) {
    hours += 1;
    mins = 0;
  }

  const hoursStr = hours < 10 ? `0${hours}` : `${hours}`;
  const minsStr = mins < 10 ? `0${mins}` : `${mins}`;

  return `${hoursStr}h ${minsStr}m`;
}

/**
 * Calculates total invested playtime hours for a game (playtime + additionalPlaytime).
 */
export function getTotalGamePlaytimeHours(game: Partial<Game>): number {
  const main = parsePlaytimeHours(game.playtime);
  const add = parsePlaytimeHours(game.additionalPlaytime);
  return main + add;
}

/**
 * Checks if a game is currently being played (status includes "Jogando").
 */
export function isCurrentlyPlaying(game: Partial<Game>): boolean {
  if (!game || !Array.isArray(game.status)) return false;
  return game.status.some((s) => typeof s === "string" && s.toLowerCase().includes("jogando"));
}

export interface GameTimeBreakdown {
  isGaaS: boolean;
  isCurrentlyPlaying: boolean;

  // Decimal hours
  currentTimeHours: number;   // Active playthrough OR GaaS Season
  finalTimeHours: number;     // Campaign finish time (for Non-GaaS when not playing)
  extraTimeHours: number;     // Tempo Extra (Non-GaaS) or Tempo da Conta (GaaS)
  totalTimeHours: number;     // Sum of all hours

  // Descriptive Labels
  currentLabel: string;       // "Tempo Atual" or "Tempo Atual (Season)"
  finalLabel: string;         // "Tempo Final (Campanha)" or "N/A (GaaS)"
  extraLabel: string;         // "Tempo Extra" or "Tempo da Conta"
  totalLabel: string;         // "Tempo Total" or "Tempo Total GaaS"

  // Formatted "XXh YYm" strings
  currentTimeFormatted: string;
  finalTimeFormatted: string;
  extraTimeFormatted: string;
  totalTimeFormatted: string;

  // Raw notes if present
  playtimeRaw: string;
  additionalPlaytimeRaw: string;
}

/**
 * Returns a comprehensive, intelligent breakdown of time metrics for a game,
 * respecting whether it is a Game as a Service (GaaS) or a traditional campaign game.
 */
export function getGameTimeBreakdown(game: Partial<Game>): GameTimeBreakdown {
  const isGaaS = !!game.isGaaS;
  const isPlaying = isCurrentlyPlaying(game);

  const mainHours = parsePlaytimeHours(game.playtime);
  const extraHours = parsePlaytimeHours(game.additionalPlaytime);
  const totalHours = mainHours + extraHours;

  const playtimeRaw = (game.playtime || "").trim();
  const additionalPlaytimeRaw = (game.additionalPlaytime || "").trim();

  if (isGaaS) {
    return {
      isGaaS: true,
      isCurrentlyPlaying: isPlaying,
      currentTimeHours: mainHours,
      finalTimeHours: 0,
      extraTimeHours: extraHours,
      totalTimeHours: totalHours,

      currentLabel: "Tempo Atual (Season / Atividade)",
      finalLabel: "N/A (Game as a Service)",
      extraLabel: "Tempo da Conta (Histórico)",
      totalLabel: "Tempo Total GaaS",

      currentTimeFormatted: formatHoursAndMinutes(mainHours),
      finalTimeFormatted: "N/A",
      extraTimeFormatted: formatHoursAndMinutes(extraHours),
      totalTimeFormatted: formatHoursAndMinutes(totalHours),

      playtimeRaw,
      additionalPlaytimeRaw,
    };
  }

  // Non-GaaS game
  if (isPlaying) {
    return {
      isGaaS: false,
      isCurrentlyPlaying: true,
      currentTimeHours: mainHours,
      finalTimeHours: 0,
      extraTimeHours: extraHours,
      totalTimeHours: totalHours,

      currentLabel: "Tempo Atual (Em Andamento)",
      finalLabel: "Tempo Final (Ao Terminar)",
      extraLabel: "Tempo Extra (Replays/Pós-jogo)",
      totalLabel: "Tempo Total Investido",

      currentTimeFormatted: formatHoursAndMinutes(mainHours),
      finalTimeFormatted: "Em andamento...",
      extraTimeFormatted: formatHoursAndMinutes(extraHours),
      totalTimeFormatted: formatHoursAndMinutes(totalHours),

      playtimeRaw,
      additionalPlaytimeRaw,
    };
  }

  // Non-GaaS game that is not currently playing (Terminado, Hiatus, Desistido, etc)
  return {
    isGaaS: false,
    isCurrentlyPlaying: false,
    currentTimeHours: 0,
    finalTimeHours: mainHours,
    extraTimeHours: extraHours,
    totalTimeHours: totalHours,

    currentLabel: "Tempo Atual",
    finalLabel: "Tempo Final (Campanha)",
    extraLabel: "Tempo Extra (Replays/Pós-jogo)",
    totalLabel: "Tempo Total Investido",

    currentTimeFormatted: "—",
    finalTimeFormatted: formatHoursAndMinutes(mainHours),
    extraTimeFormatted: formatHoursAndMinutes(extraHours),
    totalTimeFormatted: formatHoursAndMinutes(totalHours),

    playtimeRaw,
    additionalPlaytimeRaw,
  };
}

export interface AppTimeStats {
  totalHoursAll: number;
  totalHoursNonGaaS: number;
  totalHoursGaaS: number;

  totalCampaignHoursNonGaaS: number; // Sum of main campaign hours for Non-GaaS
  totalExtraHoursNonGaaS: number;    // Sum of extra hours for Non-GaaS

  avgCampaignHoursNonGaaS: number;   // Average campaign duration for Non-GaaS games
  avgTotalHoursNonGaaS: number;      // Average total hours per Non-GaaS game

  countNonGaaS: number;
  countGaaS: number;

  mostPlayedNonGaaS: Game | null;
  mostPlayedGaaS: Game | null;
  mostPlayedOverall: Game | null;
}

/**
 * Computes intelligent aggregate statistics separating GaaS games from standard campaign games.
 */
export function calculateAppTimeStats(games: Game[]): AppTimeStats {
  let totalHoursAll = 0;
  let totalHoursNonGaaS = 0;
  let totalHoursGaaS = 0;

  let totalCampaignHoursNonGaaS = 0;
  let totalExtraHoursNonGaaS = 0;

  const nonGaaSList: Game[] = [];
  const gaasList: Game[] = [];

  let mostPlayedNonGaaS: Game | null = null;
  let maxHoursNonGaaS = -1;

  let mostPlayedGaaS: Game | null = null;
  let maxHoursGaaS = -1;

  let mostPlayedOverall: Game | null = null;
  let maxHoursOverall = -1;

  games.forEach((g) => {
    const total = getTotalGamePlaytimeHours(g);
    totalHoursAll += total;

    if (total > maxHoursOverall) {
      maxHoursOverall = total;
      mostPlayedOverall = g;
    }

    if (g.isGaaS) {
      gaasList.push(g);
      totalHoursGaaS += total;
      if (total > maxHoursGaaS) {
        maxHoursGaaS = total;
        mostPlayedGaaS = g;
      }
    } else {
      nonGaaSList.push(g);
      totalHoursNonGaaS += total;

      const main = parsePlaytimeHours(g.playtime);
      const extra = parsePlaytimeHours(g.additionalPlaytime);

      totalCampaignHoursNonGaaS += main;
      totalExtraHoursNonGaaS += extra;

      if (total > maxHoursNonGaaS) {
        maxHoursNonGaaS = total;
        mostPlayedNonGaaS = g;
      }
    }
  });

  const countNonGaaS = nonGaaSList.length;
  const countGaaS = gaasList.length;

  const avgCampaignHoursNonGaaS = countNonGaaS > 0 ? totalCampaignHoursNonGaaS / countNonGaaS : 0;
  const avgTotalHoursNonGaaS = countNonGaaS > 0 ? totalHoursNonGaaS / countNonGaaS : 0;

  return {
    totalHoursAll,
    totalHoursNonGaaS,
    totalHoursGaaS,
    totalCampaignHoursNonGaaS,
    totalExtraHoursNonGaaS,
    avgCampaignHoursNonGaaS,
    avgTotalHoursNonGaaS,
    countNonGaaS,
    countGaaS,
    mostPlayedNonGaaS,
    mostPlayedGaaS,
    mostPlayedOverall,
  };
}

/**
 * Adds seconds to an existing playtime string while preserving bracket notes e.g. "10h 30m [Anotação]"
 */
export function addSecondsToPlaytime(currentPlaytimeStr: string | undefined | null, secondsToAdd: number): string {
  if (secondsToAdd <= 0) return currentPlaytimeStr || "00h 00m";

  const raw = (currentPlaytimeStr || "").trim();
  const bracketMatch = raw.match(/^(.*?)(\s*\[.*\])$/);
  
  let timePart = raw;
  let notePart = "";

  if (bracketMatch) {
    timePart = bracketMatch[1];
    notePart = bracketMatch[2];
  }

  const currentHours = parsePlaytimeHours(timePart);
  const addedHours = secondsToAdd / 3600;
  const newTotalHours = currentHours + addedHours;
  const formattedTime = formatHoursAndMinutes(newTotalHours);

  return `${formattedTime}${notePart}`;
}
