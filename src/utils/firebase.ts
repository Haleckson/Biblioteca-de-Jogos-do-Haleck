import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, onValue, set } from "firebase/database";
import { getAuth } from "firebase/auth";
import { Game } from "../types";
import { summarizeError } from "./logger";

// Read Firebase configuration from environment variables with provided fallbacks
const env = (import.meta as any).env || {};

const defaultProjectId = "biblioteca-jogos-haleck";

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyC9Vk57pe-lUDx5b12NpLKY9x8PEZDEzYA",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "biblioteca-jogos-haleck.firebaseapp.com",
  databaseURL: env.VITE_FIREBASE_DATABASE_URL || `https://${env.VITE_FIREBASE_PROJECT_ID || defaultProjectId}-default-rtdb.firebaseio.com`,
  projectId: env.VITE_FIREBASE_PROJECT_ID || defaultProjectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "biblioteca-jogos-haleck.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "445497025355",
  appId: env.VITE_FIREBASE_APP_ID || "1:445497025355:web:b716b48336ca59ebcbfece",
};

// Check if Firebase is configured
export const isFirebaseConfigured = (): boolean => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId
  );
};

export let db: any = null;
export let auth: any = null;

if (isFirebaseConfigured()) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getDatabase(app);
    auth = getAuth(app);
  } catch (error) {
    console.error("Erro ao inicializar o Firebase:", error);
  }
}

/**
 * Safely parses array data from Firebase (handles both arrays and numeric-keyed objects).
 */
function parseArraySafely(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((x) => x !== null && x !== undefined);
  if (typeof raw === "object") {
    const keys = Object.keys(raw);
    if (keys.length === 0) return [];
    const isNumericKeys = keys.every((k) => !isNaN(Number(k)));
    if (isNumericKeys) {
      return keys
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => raw[k])
        .filter((x) => x !== null && x !== undefined);
    }
    return Object.values(raw).filter((x) => x !== null && x !== undefined);
  }
  return [];
}

/**
 * Syncs the entire game library from Firebase Realtime Database in real-time.
 * If Firebase is not configured, it returns an unsubscribe function that does nothing.
 */
export const syncFromFirebase = (
  onData: (games: Game[], tags: string[], genres: string[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  if (!db) {
    return () => {};
  }

  const dbRef = ref(db, "library");
  
  // Real-time listener
  const unsubscribe = onValue(
    dbRef,
    (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const rawGames = parseArraySafely(data.games);

        const gamesList: Game[] = rawGames.map((game: any): Game => {
          const diaryRaw = parseArraySafely(game.diary);

          return {
            ...game,
            id: game.id || "",
            name: game.name || "",
            icon: game.icon || "",
            iconType: game.iconType || "emoji",
            series: game.series || "",
            cover: game.cover || "",
            status: Array.isArray(game.status) ? game.status : typeof game.status === "string" && game.status ? [game.status] : [],
            platform: game.platform || "",
            genre: Array.isArray(game.genre) ? game.genre : [],
            tags: Array.isArray(game.tags) ? game.tags : [],
            publisher: game.publisher || "",
            studio: game.studio || "",
            developer: game.developer || "",
            pricePaid: typeof game.pricePaid === "number" ? game.pricePaid : (game.pricePaid !== undefined && game.pricePaid !== null && game.pricePaid !== "" && !isNaN(Number(game.pricePaid)) ? Number(game.pricePaid) : undefined),
            playtime: game.playtime || "",
            additionalPlaytime: game.additionalPlaytime || "",
            trophy: game.trophy || "none",
            trophies: Array.isArray(game.trophies) ? game.trophies : (game.trophy && game.trophy !== "none" ? [game.trophy] : []),
            pros: game.pros || "",
            cons: game.cons || "",
            rating: typeof game.rating === "number" ? game.rating : (game.rating ? Number(game.rating) : 0),
            startDate: game.startDate || "",
            endDate: game.endDate || "",
            releaseDate: game.releaseDate || "",
            coverPosition: typeof game.coverPosition === "number" ? game.coverPosition : 50,
            coverPositionX: typeof game.coverPositionX === "number" ? game.coverPositionX : 50,
            coverZoom: typeof game.coverZoom === "number" ? game.coverZoom : 100,
            replayed: !!game.replayed,
            replayCount: typeof game.replayCount === "number" ? game.replayCount : undefined,
            replayNote: game.replayNote || "",
            isGaaS: !!game.isGaaS,
            isDlc: (game.isDlc as any) === "plus_dlc" ? true : !!game.isDlc,
            dlcMode: game.dlcMode || ((game.isDlc as any) === "plus_dlc" ? "plus_dlc" : game.isDlc ? "dlc" : "none"),
            dlcNames: game.dlcNames || "",
            difficulty: game.difficulty || "",
            hltbMain: game.hltbMain || "",
            hltbExtra: game.hltbExtra || "",
            hltbCompletionist: game.hltbCompletionist || "",
            hltbId: game.hltbId || "",
            metacriticUrl: game.metacriticUrl || "",
            metacriticCritScore: typeof game.metacriticCritScore === "number" ? game.metacriticCritScore : undefined,
            metacriticUserScore: typeof game.metacriticUserScore === "number" ? game.metacriticUserScore : undefined,
            integrationPlatform: game.integrationPlatform || undefined,
            steamAppId: typeof game.steamAppId === "number" ? game.steamAppId : (game.steamAppId ? Number(game.steamAppId) : undefined),
            steamPlaytimeMinutes: typeof game.steamPlaytimeMinutes === "number" ? game.steamPlaytimeMinutes : undefined,
            steamLastPlayedTimestamp: typeof game.steamLastPlayedTimestamp === "number" ? game.steamLastPlayedTimestamp : undefined,
            steamAchievementsCount: typeof game.steamAchievementsCount === "number" ? game.steamAchievementsCount : undefined,
            steamAchievementsTotal: typeof game.steamAchievementsTotal === "number" ? game.steamAchievementsTotal : undefined,
            gogGameId: typeof game.gogGameId === "number" ? game.gogGameId : (game.gogGameId ? Number(game.gogGameId) : undefined),
            gogPlaytimeMinutes: typeof game.gogPlaytimeMinutes === "number" ? game.gogPlaytimeMinutes : undefined,
            gogLastPlayedTimestamp: typeof game.gogLastPlayedTimestamp === "number" ? game.gogLastPlayedTimestamp : undefined,
            gogAchievementsCount: typeof game.gogAchievementsCount === "number" ? game.gogAchievementsCount : undefined,
            gogAchievementsTotal: typeof game.gogAchievementsTotal === "number" ? game.gogAchievementsTotal : undefined,
            diary: diaryRaw.map((entry: any) => {
              const mediasRaw = parseArraySafely(entry.medias);
              return {
                id: entry.id || "",
                period: entry.period || "",
                medias: mediasRaw
                  .filter((m) => m && (m.src || m.id))
                  .map((media: any) => ({
                    id: media.id || undefined,
                    src: media.src || "",
                    isVideo: !!media.isVideo,
                    deleteUrl: media.deleteUrl || "",
                  })),
                text: entry.text || "",
              };
            }),
            dictionary: parseArraySafely(game.dictionary).map((d: any) => ({
              id: d.id || "",
              term: d.term || "",
              variants: Array.isArray(d.variants)
                ? d.variants.map((v: any) => String(v).trim()).filter(Boolean)
                : [],
              group: d.group || undefined,
              format: {
                textColor: d.format?.textColor,
                bgColor: d.format?.bgColor,
                bold: !!d.format?.bold,
                italic: !!d.format?.italic,
                underline: !!d.format?.underline,
                strikethrough: !!d.format?.strikethrough,
              },
            })),
          };
        });

        const tagsList = parseArraySafely(data.globalTags);
        const genresList = parseArraySafely(data.globalGenres);

        onData(gamesList, tagsList as string[], genresList as string[]);
      } else {
        // If snapshot is empty, callback with empty arrays so the app knows there is no remote data yet
        onData([], [], []);
      }
    },
    (error) => {
      console.error("Erro na escuta em tempo real do Firebase:", summarizeError(error));
      if (onError) onError(error);
    }
  );

  return unsubscribe;
};

/**
 * Recursively removes undefined values and strips raw base64/blob URIs from objects before sending to Firebase.
 * This prevents payload bloat (e.g., 200MB base64 arrays) that causes Firebase writes to fail/truncate.
 */
const sanitizeDataForFirebase = (val: any): any => {
  if (val === undefined) {
    return null;
  }
  if (typeof val === "string") {
    // Replace raw data: or blob: URIs with empty placeholder to keep payload lightweight until ImgBB URL is ready
    if (val.startsWith("data:") || val.startsWith("blob:")) {
      return "";
    }
    return val;
  }
  if (Array.isArray(val)) {
    return val.map((v) => sanitizeDataForFirebase(v));
  }
  if (val !== null && typeof val === "object") {
    const res: Record<string, any> = {};
    for (const key of Object.keys(val)) {
      const v = val[key];
      if (v !== undefined) {
        res[key] = sanitizeDataForFirebase(v);
      }
    }
    return res;
  }
  return val;
};

/**
 * Verificação detalhada que compara um conjunto de jogos locais com o conjunto de destino/remoto,
 * comparando o ID do jogo e campos críticos (como pricePaid, rating, playtime, status).
 * Exibe logs de diagnóstico detalhados de quaisquer divergências.
 */
export const verifyGameDataIntegrity = (
  localGames: Game[],
  targetGames: Game[],
  contextLabel: string = "FirebaseVerification"
): { matched: number; mismatches: Array<{ id: string; name: string; field: string; localVal: any; targetVal: any }> } => {
  const mismatches: Array<{ id: string; name: string; field: string; localVal: any; targetVal: any }> = [];
  let matched = 0;

  const targetMap = new Map((targetGames || []).map((g) => [g.id, g]));

  (localGames || []).forEach((localGame) => {
    const targetGame = targetMap.get(localGame.id);
    if (!targetGame) {
      mismatches.push({
        id: localGame.id,
        name: localGame.name,
        field: "PRESENCE",
        localVal: "Existe no estado local",
        targetVal: "Ausente no objeto remoto/destino",
      });
      return;
    }

    const criticalFields: (keyof Game)[] = [
      "id",
      "name",
      "pricePaid",
      "rating",
      "playtime",
      "status",
      "platform",
    ];

    let gameHasMismatch = false;
    criticalFields.forEach((field) => {
      const localVal = localGame[field];
      const targetVal = targetGame[field];

      // Treat null, undefined, and empty string symmetrically
      const isEmptyLocal = localVal === undefined || localVal === null || localVal === "";
      const isEmptyTarget = targetVal === undefined || targetVal === null || targetVal === "";
      if (isEmptyLocal && isEmptyTarget) {
        return;
      }

      // Loose comparison for numbers / numeric strings
      if (
        (typeof localVal === "number" || typeof targetVal === "number") &&
        localVal !== undefined && localVal !== null &&
        targetVal !== undefined && targetVal !== null &&
        !isNaN(Number(localVal)) &&
        !isNaN(Number(targetVal))
      ) {
        if (Number(localVal) === Number(targetVal)) {
          return;
        }
      }

      if (localVal !== targetVal) {
        mismatches.push({
          id: localGame.id,
          name: localGame.name,
          field: String(field),
          localVal,
          targetVal,
        });
        gameHasMismatch = true;
      }
    });

    if (!gameHasMismatch) {
      matched++;
    }
  });

  if (mismatches.length === 0) {
    console.log(`[${contextLabel}] ✅ Integridade OK! ${matched}/${localGames.length} jogos validados.`);
  } else {
    const summaryText = mismatches
      .slice(0, 3)
      .map((m) => `${m.name} (${m.field})`)
      .join(", ");
    const moreCount = mismatches.length > 3 ? ` (+${mismatches.length - 3} mais)` : "";
    console.log(`[${contextLabel}] Sincronização de dados: ${mismatches.length} diferença(s) identificada(s): ${summaryText}${moreCount}`);
  }

  return { matched, mismatches };
};

/**
 * Saves the entire game library to Firebase Realtime Database.
 */
export const saveToFirebase = async (
  games: Game[],
  globalTags: string[],
  globalGenres: string[]
): Promise<void> => {
  if (!db) {
    throw new Error("Firebase não está configurado ou inicializado.");
  }

  const dbRef = ref(db, "library");

  // Diagnostic log before sanitization and dispatch
  console.log(`[saveToFirebase] Enviando ${games.length} jogo(s) ao Firebase.`);

  const sanitizedGames = sanitizeDataForFirebase(games);
  const sanitizedTags = sanitizeDataForFirebase(globalTags);
  const sanitizedGenres = sanitizeDataForFirebase(globalGenres);

  // Verificação pré-envio: Garante que os dados higienizados não alteraram nem perderam nada do objeto original
  verifyGameDataIntegrity(games, sanitizedGames, "PreSendDiagnostic");

  await set(dbRef, {
    games: sanitizedGames,
    globalTags: sanitizedTags,
    globalGenres: sanitizedGenres,
    lastUpdated: new Date().toISOString(),
  });

  console.log("[saveToFirebase] Sucesso: Dados salvos e persistidos com sucesso no banco de dados Firebase.");
};
