import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, onValue, set } from "firebase/database";
import { getAuth } from "firebase/auth";
import { Game } from "../types";

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

let db: any = null;
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
        // Firebase might occasionally return lists as objects with numeric keys, handle both
        const rawGames = Array.isArray(data.games)
          ? data.games
          : data.games
          ? Object.values(data.games)
          : [];

        const gamesList: Game[] = rawGames.map((game: any): Game => {
          // Normalize game-level fields
          const diaryRaw = Array.isArray(game.diary)
            ? game.diary
            : game.diary
            ? Object.values(game.diary)
            : [];

          return {
            id: game.id || "",
            name: game.name || "",
            icon: game.icon || "",
            iconType: game.iconType || "emoji",
            series: game.series || "",
            cover: game.cover || "",
            status: Array.isArray(game.status) ? game.status : [],
            platform: game.platform || "",
            genre: Array.isArray(game.genre) ? game.genre : [],
            tags: Array.isArray(game.tags) ? game.tags : [],
            publisher: game.publisher || "",
            studio: game.studio || "",
            developer: game.developer || "",
            playtime: game.playtime || "",
            additionalPlaytime: game.additionalPlaytime || "",
            trophy: game.trophy || "none",
            trophies: Array.isArray(game.trophies) ? game.trophies : (game.trophy && game.trophy !== "none" ? [game.trophy] : []),
            pros: game.pros || "",
            cons: game.cons || "",
            rating: typeof game.rating === "number" ? game.rating : 0,
            startDate: game.startDate || "",
            endDate: game.endDate || "",
            releaseDate: game.releaseDate || "",
            coverPosition: typeof game.coverPosition === "number" ? game.coverPosition : 50,
            coverPositionX: typeof game.coverPositionX === "number" ? game.coverPositionX : 50,
            coverZoom: typeof game.coverZoom === "number" ? game.coverZoom : 100,
            replayed: !!game.replayed,
            replayCount: typeof game.replayCount === "number" ? game.replayCount : undefined,
            replayNote: game.replayNote || "",
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
            diary: diaryRaw.map((entry: any) => {
              const mediasRaw = Array.isArray(entry.medias)
                ? entry.medias
                : entry.medias
                ? Object.values(entry.medias)
                : [];
              return {
                id: entry.id || "",
                period: entry.period || "",
                medias: mediasRaw.map((media: any) => ({
                  src: media.src || "",
                  isVideo: !!media.isVideo,
                  deleteUrl: media.deleteUrl || "",
                })),
                text: entry.text || "",
              };
            }),
          };
        });

        const tagsList = Array.isArray(data.globalTags)
          ? data.globalTags
          : data.globalTags
          ? Object.values(data.globalTags)
          : [];

        const genresList = Array.isArray(data.globalGenres)
          ? data.globalGenres
          : data.globalGenres
          ? Object.values(data.globalGenres)
          : [];

        onData(gamesList, tagsList as string[], genresList as string[]);
      } else {
        // If snapshot is empty, callback with empty arrays so the app knows there is no remote data yet
        onData([], [], []);
      }
    },
    (error) => {
      console.error("Erro na escuta em tempo real do Firebase:", error);
      if (onError) onError(error);
    }
  );

  return unsubscribe;
};

/**
 * Recursively removes undefined values from an object or array to prevent Firebase errors.
 */
const sanitizeDataForFirebase = (val: any): any => {
  if (val === undefined) {
    return null;
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
  const sanitizedGames = sanitizeDataForFirebase(games);
  const sanitizedTags = sanitizeDataForFirebase(globalTags);
  const sanitizedGenres = sanitizeDataForFirebase(globalGenres);

  await set(dbRef, {
    games: sanitizedGames,
    globalTags: sanitizedTags,
    globalGenres: sanitizedGenres,
    lastUpdated: new Date().toISOString(),
  });
};
