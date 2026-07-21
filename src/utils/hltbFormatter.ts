/**
 * Formats a decimal/fractional hour or string duration from HowLongToBeat to "00h 00m" format.
 * Examples:
 *   20.5 -> "20h 30m"
 *   "20.5" -> "20h 30m"
 *   "20.5h" -> "20h 30m"
 *   "20 ½ h" -> "20h 30m"
 *   "20h" -> "20h 00m"
 *   "20h 30m" -> "20h 30m"
 */
export function formatHltbTime(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return "";
  
  let valStr = String(val).trim();
  if (valStr === "" || valStr === "-" || valStr === "—") return "";

  // If it already matches the "Xh Ym" pattern, extract, pad, and return it
  const hourMinMatch = valStr.match(/^(\d+)h\s*(\d+)m$/i);
  if (hourMinMatch) {
    const h = parseInt(hourMinMatch[1], 10);
    const m = parseInt(hourMinMatch[2], 10);
    return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
  }

  let hasHalf = false;
  if (valStr.includes("½")) {
    hasHalf = true;
    valStr = valStr.replace("½", "");
  }

  // Extract all digits and decimal points (e.g., "20.5h" -> "20.5")
  // Replace commas with dots if any (e.g. "20,5" -> "20.5")
  const cleanedNumStr = valStr.replace(/,/g, ".").replace(/[^\d\.]/g, "");
  const parsedFloat = parseFloat(cleanedNumStr);

  if (isNaN(parsedFloat)) {
    return String(val); // fallback to original value
  }

  let hours = Math.floor(parsedFloat);
  let mins = 0;

  if (hasHalf) {
    mins = 30;
  } else {
    const decimal = parsedFloat - hours;
    mins = Math.round(decimal * 60);
  }

  // Handle case where rounding minutes makes it 60
  if (mins >= 60) {
    hours += Math.floor(mins / 60);
    mins = mins % 60;
  }

  const hStr = String(hours).padStart(2, "0");
  const mStr = String(mins).padStart(2, "0");

  return `${hStr}h ${mStr}m`;
}
