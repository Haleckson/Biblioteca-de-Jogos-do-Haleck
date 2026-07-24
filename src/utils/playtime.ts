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
    return hours + mins / 60 + (hasHalf ? 0.5 : 0);
  }

  // Handle "Xh" or "X hours" or "X horas"
  const hMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:h|hora|horas|hour|hours)?/i);
  if (hMatch && hMatch[1]) {
    const hours = parseFloat(hMatch[1]) || 0;
    return hours + (hasHalf ? 0.5 : 0);
  }

  // Handle plain numbers e.g. "20.5" or "20,5"
  const cleaned = str.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const num = parseFloat(cleaned);
  if (!isNaN(num)) {
    return num + (hasHalf ? 0.5 : 0);
  }

  return 0;
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
export function getTotalGamePlaytimeHours(game: Game): number {
  const main = parsePlaytimeHours(game.playtime);
  const add = parsePlaytimeHours(game.additionalPlaytime);
  return main + add;
}
