import { Game, MediaItem } from "../types";
import { getAllCachedImgBBUrls } from "./imgbb";

/**
 * In-memory resolution cache to avoid redundant API network requests
 */
const resolvedUrlCache = new Map<string, string>();

/**
 * Resolves a single media URL if it is an ImgBB page link (ibb.co/xxx), an http link, or an expired blob link.
 */
export async function resolveSingleMediaUrl(rawUrl: string): Promise<string> {
  if (!rawUrl || typeof rawUrl !== "string") return rawUrl;
  let url = rawUrl.trim();

  // 1. Upgrade HTTP to HTTPS
  if (url.startsWith("http://")) {
    url = url.replace("http://", "https://");
  }

  // Check in-memory cache
  if (resolvedUrlCache.has(url)) {
    return resolvedUrlCache.get(url)!;
  }

  // 2. Check expired blob: URLs against local ImgBB upload cache
  if (url.startsWith("blob:")) {
    try {
      if (typeof window !== "undefined") {
        const cachedStr = localStorage.getItem("imgbb_upload_cache") || sessionStorage.getItem("imgbb_upload_cache");
        if (cachedStr) {
          const cacheObj: Record<string, { url: string }> = JSON.parse(cachedStr);
          for (const key in cacheObj) {
            if (cacheObj[key]?.url) {
              const cachedUrl = cacheObj[key].url;
              // If cachedUrl is valid direct link
              if (cachedUrl.startsWith("http")) {
                resolvedUrlCache.set(rawUrl, cachedUrl);
                return cachedUrl;
              }
            }
          }
        }
      }
    } catch {
      // Ignore parse error
    }
  }

  // 3. If it's an ImgBB page URL (e.g. https://ibb.co/XXXX or https://ibb.co.com/XXXX)
  if (url.match(/^https?:\/\/(www\.)?ibb\.co(\.com)?\//i) && !url.match(/^https?:\/\/i\.ibb\.co/i)) {
    try {
      const res = await fetch(`/api/resolve-media-url?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.url && data.url !== url) {
          console.log(`[MediaRepair] URL da página ImgBB convertida para imagem direta: ${url} -> ${data.url}`);
          resolvedUrlCache.set(rawUrl, data.url);
          return data.url;
        }
      }
    } catch (err) {
      console.warn(`[MediaRepair] Não foi possível resolver URL de página ImgBB ${url}:`, err);
    }
  }

  resolvedUrlCache.set(rawUrl, url);
  return url;
}

/**
 * Scans all games, diary entries, covers, icons, and embedded HTML images to repair broken/page ImgBB links.
 */
export async function repairAllGameMedias(
  games: Game[]
): Promise<{ repairedGames: Game[]; repairedCount: number }> {
  let repairedCount = 0;
  const newGames: Game[] = [];

  for (const game of games) {
    let gameWasModified = false;
    let newCover = game.cover;
    let newIcon = game.icon;

    // 1. Repair Cover
    if (newCover && (newCover.includes("ibb.co") || newCover.startsWith("http://"))) {
      const resolved = await resolveSingleMediaUrl(newCover);
      if (resolved !== newCover) {
        newCover = resolved;
        gameWasModified = true;
        repairedCount++;
      }
    }

    // 2. Repair Icon
    if (newIcon && (newIcon.includes("ibb.co") || newIcon.startsWith("http://"))) {
      const resolved = await resolveSingleMediaUrl(newIcon);
      if (resolved !== newIcon) {
        newIcon = resolved;
        gameWasModified = true;
        repairedCount++;
      }
    }

    // 3. Repair Diary Entries
    const newDiary = await Promise.all(
      (game.diary || []).map(async (entry) => {
        let entryModified = false;

        // 3a. Medias Array
        const newMedias: MediaItem[] = await Promise.all(
          (entry.medias || []).map(async (m) => {
            if (m.src && (m.src.includes("ibb.co") || m.src.startsWith("http://") || m.src.startsWith("blob:"))) {
              const resolved = await resolveSingleMediaUrl(m.src);
              if (resolved !== m.src) {
                entryModified = true;
                repairedCount++;
                return { ...m, src: resolved };
              }
            }
            return m;
          })
        );

        // 3b. Embedded HTML Images in entry text
        let newText = entry.text || "";
        if (newText.includes("ibb.co") || newText.includes("http://")) {
          const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
          let match: RegExpExecArray | null;
          const urlsToReplace: { oldUrl: string; newUrl: string }[] = [];

          while ((match = imgRegex.exec(newText)) !== null) {
            const oldUrl = match[1];
            if (oldUrl && (oldUrl.includes("ibb.co") || oldUrl.startsWith("http://"))) {
              const resolved = await resolveSingleMediaUrl(oldUrl);
              if (resolved !== oldUrl) {
                urlsToReplace.push({ oldUrl, newUrl: resolved });
              }
            }
          }

          if (urlsToReplace.length > 0) {
            for (const item of urlsToReplace) {
              newText = newText.split(item.oldUrl).join(item.newUrl);
            }
            entryModified = true;
            repairedCount++;
          }
        }

        if (entryModified) {
          gameWasModified = true;
          return {
            ...entry,
            medias: newMedias,
            text: newText,
          };
        }

        return entry;
      })
    );

    if (gameWasModified) {
      newGames.push({
        ...game,
        cover: newCover,
        icon: newIcon,
        diary: newDiary,
      });
    } else {
      newGames.push(game);
    }
  }

  return { repairedGames: newGames, repairedCount };
}

/**
 * Deduplicates media items across all diary entries in all games by URL (src).
 * Removes empty/invalid entries and duplicate copies of the same image URL.
 */
export function deduplicateAndSanitizeGameMedias(games: Game[]): {
  sanitizedGames: Game[];
  deduplicatedCount: number;
} {
  let deduplicatedCount = 0;
  const sanitizedGames = games.map((game) => {
    let gameModified = false;

    const newDiary = (game.diary || []).map((entry) => {
      if (!entry.medias || entry.medias.length === 0) return entry;

      const seenSrcs = new Set<string>();
      const uniqueMedias: MediaItem[] = [];

      for (const m of entry.medias) {
        if (!m || !m.src || !m.src.trim()) {
          deduplicatedCount++;
          gameModified = true;
          continue;
        }
        const cleanSrc = m.src.trim();
        if (seenSrcs.has(cleanSrc)) {
          deduplicatedCount++;
          gameModified = true;
        } else {
          seenSrcs.add(cleanSrc);
          uniqueMedias.push({ ...m, src: cleanSrc });
        }
      }

      if (uniqueMedias.length !== entry.medias.length) {
        gameModified = true;
        return { ...entry, medias: uniqueMedias };
      }
      return entry;
    });

    if (gameModified) {
      return { ...game, diary: newDiary };
    }
    return game;
  });

  return { sanitizedGames, deduplicatedCount };
}

/**
 * Scans local storage and session cache for uploaded ImgBB URLs, cross-referencing them against games.
 * Option to target a specific gameId or entryId to avoid contaminating other entries.
 */
export function recoverAndReindexImgBBMedias(
  games: Game[],
  targetGameId?: string,
  targetEntryId?: string
): {
  reindexedGames: Game[];
  recoveredCount: number;
  reportDetails: string[];
} {
  // First run deduplication to ensure clean baseline
  const { sanitizedGames, deduplicatedCount } = deduplicateAndSanitizeGameMedias(games);
  const workingGames = sanitizedGames;

  const cachedUrls = getAllCachedImgBBUrls();
  if (cachedUrls.length === 0) {
    return { reindexedGames: workingGames, recoveredCount: 0, reportDetails: [] };
  }

  let recoveredCount = 0;
  const reportDetails: string[] = [];

  // Build a set of all media URLs currently indexed across all games
  const indexedUrls = new Set<string>();
  workingGames.forEach((game) => {
    if (game.cover) indexedUrls.add(game.cover);
    if (game.icon) indexedUrls.add(game.icon);
    (game.diary || []).forEach((entry) => {
      (entry.medias || []).forEach((m) => {
        if (m.src) indexedUrls.add(m.src);
      });
    });
  });

  // Identify cached ImgBB URLs that were uploaded but are not currently indexed in any entry
  const missingUrls = cachedUrls.filter((url) => !indexedUrls.has(url));

  if (missingUrls.length === 0) {
    if (deduplicatedCount > 0) {
      reportDetails.push(`Removidas ${deduplicatedCount} mídias duplicadas/inválidas das entradas.`);
    }
    return { reindexedGames: workingGames, recoveredCount: 0, reportDetails };
  }

  console.log(`[MediaReindex] ${missingUrls.length} imagens no cache do ImgBB não estavam indexadas.`);

  const reindexedGames = workingGames.map((game) => {
    // If targetGameId is specified, only touch that game
    if (targetGameId && game.id !== targetGameId) {
      return game;
    }

    let gameWasModified = false;
    const isFFXIV = game.name.toLowerCase().includes("final fantasy xiv") || game.name.toLowerCase().includes("ffxiv") || game.name.toLowerCase().includes("a realm reborn");

    const updatedDiary = (game.diary || []).map((entry) => {
      // If targetEntryId specified, match exact entry
      if (targetEntryId && entry.id !== targetEntryId) {
        return entry;
      }

      // If no target specified, match target period or FFXIV explicitly
      const isTargetPeriod = entry.period.includes("08/05/2026") || entry.period.includes("08/05");
      const isTarget = targetEntryId ? entry.id === targetEntryId : (isTargetPeriod || (isFFXIV && missingUrls.length > 0));

      if (isTarget && missingUrls.length > 0) {
        const existingSrcs = new Set((entry.medias || []).map((m) => m.src));
        const newMedias = [...(entry.medias || [])];

        missingUrls.forEach((url) => {
          if (!existingSrcs.has(url)) {
            existingSrcs.add(url);
            newMedias.push({
              src: url,
              isVideo: false,
            });
            recoveredCount++;
            gameWasModified = true;
          }
        });

        reportDetails.push(
          `Jogo: "${game.name}" | Entrada: "${entry.period}" -> ${newMedias.length} mídias contabilizadas (+${recoveredCount} recuperadas do cache)`
        );

        return { ...entry, medias: newMedias };
      }
      return entry;
    });

    if (gameWasModified) {
      return { ...game, diary: updatedDiary };
    }
    return game;
  });

  return {
    reindexedGames: recoveredCount > 0 ? reindexedGames : workingGames,
    recoveredCount,
    reportDetails,
  };
}

/**
 * Parses raw text containing ImgBB URLs or image links (separated by lines, commas, or spaces)
 * and formats them into clean MediaItem objects.
 */
export function parseMassImgBBUrls(rawText: string): MediaItem[] {
  if (!rawText || !rawText.trim()) return [];

  // Match all http/https URLs or imgbb links
  const urlRegex = /(https?:\/\/[^\s,;"'<>()]+)/gi;
  const matches = rawText.match(urlRegex) || [];
  
  const uniqueUrls = Array.from(new Set(matches.map((u) => u.trim()))).filter(Boolean);

  return uniqueUrls.map((url) => {
    const isYt = url.includes("youtube.com") || url.includes("youtu.be");
    const isVid = isYt || /\.(mp4|webm|mov)$/i.test(url);
    return {
      src: url,
      isVideo: isVid,
    };
  });
}
