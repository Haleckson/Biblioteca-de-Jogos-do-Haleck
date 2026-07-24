import { signInWithPopup, GoogleAuthProvider, User, onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { Game } from "../types";

// In-memory token cache as required by the workspace integration guidelines
let cachedAccessToken: string | null = null;
let currentUser: User | null = null;
let isSigningIn = false;
let tokenTimestamp = 0;

// Initialize Google Auth Provider with Google Drive and YouTube scopes
const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/drive.file");
provider.addScope("https://www.googleapis.com/auth/youtube");
provider.addScope("https://www.googleapis.com/auth/youtube.upload");

// Monitor auth state to clear token on logout
if (auth) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (!user) {
      cachedAccessToken = null;
      tokenTimestamp = 0;
      localStorage.removeItem("google_drive_connected");
    }
  });
}

/**
 * Signs in the user with Google and requests Google Drive file access.
 */
export async function signInWithGoogleDrive(): Promise<string> {
  if (!auth) {
    throw new Error("Firebase Auth não está inicializado.");
  }

  if (isSigningIn) {
    if (cachedAccessToken) return cachedAccessToken;
    throw new Error("Uma autenticação com o Google Drive já está em andamento. Aguarde a conclusão ou tente novamente.");
  }

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    if (!accessToken) {
      throw new Error("Não foi possível obter o token de acesso do Google Drive.");
    }

    cachedAccessToken = accessToken;
    currentUser = result.user;
    tokenTimestamp = Date.now();
    localStorage.setItem("google_drive_connected", "true");
    return accessToken;
  } catch (err: any) {
    console.error("Erro no Login com Google Drive:", err);
    
    if (err.code === "auth/configuration-not-found" || String(err).includes("auth/configuration-not-found")) {
      throw new Error(
        "O provedor 'Google' não está ativado no seu projeto Firebase.\n\n" +
        "Para corrigir isso:\n" +
        "1. Acesse o Console do Firebase (https://console.firebase.google.com/)\n" +
        "2. Selecione seu projeto 'biblioteca-jogos-haleck'\n" +
        "3. Vá em 'Authentication' > aba 'Sign-in method'\n" +
        "4. Clique em 'Adicionar novo provedor' (ou 'Add provider') e escolha 'Google'\n" +
        "5. Ative, selecione um e-mail de suporte (por exemplo, henrickccunha@gmail.com) e clique em 'Salvar'."
      );
    }

    if (
      err.code === "auth/popup-closed-by-user" || 
      String(err).includes("popup-closed-by-user") ||
      String(err).includes("Pending promise was never set") ||
      String(err).includes("assertion")
    ) {
      throw new Error(
        "A janela de autenticação foi fechada ou bloqueada pelo navegador.\n\n" +
        "Como este aplicativo está rodando dentro de um frame de visualização (iframe) do AI Studio, o navegador pode bloquear a sincronização de cookies/armazenamento.\n\n" +
        "Para resolver e conectar com sucesso:\n" +
        "1. Clique no botão de 'Abrir em uma nova aba' (canto superior direito da tela de visualização).\n" +
        "2. Na nova aba, clique em 'Conectar Google Drive' novamente para autorizar sem restrições de iframe!"
      );
    }

    throw err;
  } finally {
    isSigningIn = false;
  }
}

/**
 * Quietly refreshes or re-authenticates Google OAuth token.
 */
export async function refreshDriveToken(): Promise<string> {
  if (!auth) {
    throw new Error("Firebase Auth não está inicializado.");
  }
  if (isSigningIn) {
    if (cachedAccessToken) return cachedAccessToken;
    throw new Error("Autenticação em andamento.");
  }

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    if (!accessToken) {
      throw new Error("Não foi possível renovar o token de acesso do Google Drive.");
    }

    cachedAccessToken = accessToken;
    currentUser = result.user;
    tokenTimestamp = Date.now();
    localStorage.setItem("google_drive_connected", "true");
    return accessToken;
  } catch (err: any) {
    console.error("Erro ao renovar token do Google Drive:", err);
    throw err;
  } finally {
    isSigningIn = false;
  }
}

/**
 * Gets the current cached access token or returns null if not authenticated.
 */
export function getDriveAccessToken(): string | null {
  return cachedAccessToken;
}

/**
 * Checks if the user is authenticated with Google Drive.
 */
export function isDriveAuthenticated(): boolean {
  return !!cachedAccessToken;
}

/**
 * Signs out from Google Drive.
 */
export async function signOutDrive(): Promise<void> {
  cachedAccessToken = null;
  tokenTimestamp = 0;
  localStorage.removeItem("google_drive_connected");
}

let activeBackupSignal: AbortSignal | null = null;

/**
 * Helper to fetch with Bearer token authorization and auto-refresh on 401.
 */
async function driveFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let token = getDriveAccessToken();

  if (!token && localStorage.getItem("google_drive_connected") === "true") {
    try {
      token = await refreshDriveToken();
    } catch (e) {
      console.warn("Falha ao reautenticar sessão salva do Google Drive:", e);
    }
  }

  if (!token) {
    throw new Error("Usuário não autenticado no Google Drive. Por favor, conecte sua conta.");
  }

  const signal = options.signal || activeBackupSignal || undefined;

  const makeRequest = async (authToken: string) => {
    const headers = {
      ...options.headers,
      Authorization: `Bearer ${authToken}`,
    };
    return await fetch(url, { ...options, headers, signal });
  };

  let response = await makeRequest(token);

  // If token expired (401 Unauthorized), attempt automatic token refresh and retry request
  if (response.status === 401) {
    console.warn("Token de acesso do Google Drive expirou (401). Tentando renovar autorização...");
    try {
      const newToken = await refreshDriveToken();
      response = await makeRequest(newToken);
    } catch (refreshErr) {
      console.error("Erro ao renovar token do Google Drive após 401:", refreshErr);
    }
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erro na API do Google Drive: ${response.status} - ${errText}`);
  }
  return response;
}

/**
 * Checks if a file or folder exists by name and parent.
 * Returns the file ID if found, or null otherwise.
 */
export async function findFileByName(name: string, parentId?: string, isFolder = false): Promise<string | null> {
  let query = `name = '${name.replace(/'/g, "\\'")}' and trashed = false`;
  if (isFolder) {
    query += ` and mimeType = 'application/vnd.google-apps.folder'`;
  } else {
    query += ` and mimeType != 'application/vnd.google-apps.folder'`;
  }
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;
  const response = await driveFetch(url);
  const data = await response.json();

  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
}

/**
 * Gets an existing folder or creates it if it does not exist.
 */
export async function getOrCreateFolder(folderName: string, parentId?: string): Promise<string> {
  const existingId = await findFileByName(folderName, parentId, true);
  if (existingId) {
    return existingId;
  }

  // Create new folder
  const metadata: Record<string, any> = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const response = await driveFetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  const folder = await response.json();
  return folder.id;
}

/**
 * Uploads a file or updates its content if it already exists.
 */
export async function uploadOrUpdateFile(
  filename: string,
  mimeType: string,
  content: Blob | string,
  parentId: string,
  existingId?: string | null
): Promise<string> {
  const fileId = existingId || (await findFileByName(filename, parentId, false));

  if (fileId) {
    // Update content of existing file
    await driveFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": mimeType,
        },
        body: content,
      }
    );
    return fileId;
  } else {
    // 1. Create file metadata
    const createRes = await driveFetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: filename,
        mimeType,
        parents: [parentId],
      }),
    });
    const fileMetadata = await createRes.json();
    const newId = fileMetadata.id;

    // 2. Upload file content
    await driveFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${newId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": mimeType,
        },
        body: content,
      }
    );

    return newId;
  }
}

/**
 * Lists all files and folders inside a parent folder.
 */
export async function listFilesAndFoldersInParent(parentId: string): Promise<Array<{ id: string; name: string; mimeType: string }>> {
  const query = `'${parentId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)&pageSize=1000`;
  const response = await driveFetch(url);
  const data = await response.json();
  return data.files || [];
}

/**
 * Deletes a file or folder in Google Drive.
 */
export async function deleteFileOrFolder(id: string): Promise<void> {
  await driveFetch(`https://www.googleapis.com/drive/v3/files/${id}`, {
    method: "DELETE"
  });
}

/**
 * Utility to fetch a remote image or video URL (or parse base64 data URI) and convert it to a Blob.
 */
async function urlToBlob(url: string, retries = 2): Promise<Blob | null> {
  if (!url) return null;

  // Handle data URI (base64)
  if (url.startsWith("data:")) {
    try {
      const isBase64 = url.includes("base64,");
      if (isBase64) {
        const parts = url.split("base64,");
        const mimeMatch = parts[0].match(/data:(.*?);/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
        const byteString = atob(parts[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ab], { type: mimeType });
      }
    } catch (e) {
      console.error("Erro ao converter data URI para blob:", e);
    }
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { referrerPolicy: "no-referrer" });
      if (res.ok) {
        return await res.blob();
      }
      console.warn(`Fetch retornou status ${res.status} para ${url} (tentativa ${attempt + 1})`);
    } catch (err) {
      console.warn(`Erro de fetch para ${url} (tentativa ${attempt + 1}):`, err);
    }
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }

  // Fallback for images: load via HTML Image element and render to canvas to produce blob
  try {
    const blobFromCanvas = await new Promise<Blob | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || 800;
          canvas.height = img.naturalHeight || 600;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((b) => resolve(b), "image/png");
          } else {
            resolve(null);
          }
        } catch (err) {
          console.warn("Erro ao desenhar imagem no canvas fallback:", err);
          resolve(null);
        }
      };
      img.onerror = () => {
        resolve(null);
      };
      img.src = url;
    });
    if (blobFromCanvas) return blobFromCanvas;
  } catch (e) {
    console.error("Fallback image to blob error:", e);
  }

  return null;
}

/**
 * Converts any image blob to webp format using standard client-side HTML5 Canvas.
 */
async function convertBlobToWebp(blob: Blob): Promise<Blob> {
  if (blob.type === "image/webp" || blob.type === "image/gif") return blob;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(blob);
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (webpBlob) => {
          if (webpBlob) {
            resolve(webpBlob);
          } else {
            resolve(blob);
          }
        },
        "image/webp",
        1.0
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    img.src = url;
  });
}

/**
 * Converts any video blob to webm format using a hidden HTML5 video, canvas, and MediaRecorder
 * at highest possible bitrate to ensure 100% visual quality.
 */
async function convertVideoToWebm(blob: Blob): Promise<Blob> {
  if (blob.type === "video/webm") return blob;

  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(blob);
    
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      let stream: MediaStream;
      try {
        stream = (canvas as any).captureStream ? (canvas as any).captureStream(30) : (canvas as any).mozCaptureStream ? (canvas as any).mozCaptureStream(30) : null;
        if (!stream) {
          throw new Error("captureStream not supported");
        }
        
        // Capture audio if possible
        if ((video as any).captureStream) {
          const videoStream = (video as any).captureStream();
          const audioTracks = videoStream.getAudioTracks();
          if (audioTracks.length > 0) {
            stream.addTrack(audioTracks[0]);
          }
        }
      } catch (e) {
        console.warn("Could not capture stream from canvas/video, uploading original video", e);
        URL.revokeObjectURL(url);
        resolve(blob);
        return;
      }
      
      // Determine the best supported mimeType for webm
      let mimeType = "video/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
          mimeType = "video/webm;codecs=vp9";
        } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
          mimeType = "video/webm;codecs=vp8";
        }
      } else {
        URL.revokeObjectURL(url);
        resolve(blob);
        return;
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 12000000 // 12 Mbps for 100% visual quality
      });
      
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const webmBlob = new Blob(chunks, { type: "video/webm" });
        URL.revokeObjectURL(url);
        resolve(webmBlob);
      };
      
      let animFrameId: number;
      const drawFrame = () => {
        if (video.paused || video.ended) {
          return;
        }
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        animFrameId = requestAnimationFrame(drawFrame);
      };
      
      video.onplay = () => {
        drawFrame();
      };
      
      video.onended = () => {
        cancelAnimationFrame(animFrameId);
        try {
          mediaRecorder.stop();
        } catch (e) {}
      };
      
      mediaRecorder.start();
      video.play().catch((err) => {
        console.error("Erro ao reproduzir vídeo para conversão WebM:", err);
        cancelAnimationFrame(animFrameId);
        try {
          mediaRecorder.stop();
        } catch (e) {}
        resolve(blob); // fallback to original
      });
    };
    
    video.onerror = (err) => {
      console.error("Erro ao carregar metadados do vídeo:", err);
      URL.revokeObjectURL(url);
      resolve(blob); // fallback
    };
  });
}

/**
 * Helper to parse start date from period string (e.g., "10/05/2026 ~ 18/05/2026")
 */
function parsePeriodStartDate(period: string): number {
  try {
    const firstPart = period.split("~")[0].trim();
    const parts = firstPart.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day).getTime();
    }
  } catch (err) {
    console.error("Error parsing period date:", err);
  }
  return 0;
}

/**
 * Parses and formats period string to standard YYYY-MM-DD and secure range representation for filenames/folders.
 */
function getFormattedPeriodAndDate(period: string): { startDateYMD: string; formattedRange: string } {
  try {
    const parts = period.split("~");
    const firstPart = parts[0]?.trim() || "";
    const secondPart = parts[1]?.trim() || firstPart;

    const partsStart = firstPart.split("/");
    const partsEnd = secondPart.split("/");

    let startDateYMD = "9999-12-31";
    let formattedRange = "Sem_Data";

    if (partsStart.length === 3) {
      const day = partsStart[0].padStart(2, "0");
      const month = partsStart[1].padStart(2, "0");
      const year = partsStart[2];
      startDateYMD = `${year}-${month}-${day}`;
    }

    const cleanPart = (p: string[]) => {
      if (p.length === 3) {
        return `${p[0].padStart(2, "0")}-${p[1].padStart(2, "0")}-${p[2]}`;
      }
      return p.join("-");
    };

    if (firstPart && secondPart) {
      formattedRange = `${cleanPart(partsStart)} a ${cleanPart(partsEnd)}`;
    } else if (firstPart) {
      formattedRange = cleanPart(partsStart);
    }

    return { startDateYMD, formattedRange };
  } catch (err) {
    console.error("Error formatting period:", err);
  }
  return { startDateYMD: "9999-12-31", formattedRange: "Sem_Data" };
}

/**
 * Compares two games to see if they are identical in terms of fields, tags, genres, status, diary entries, and media content.
 */
function areGamesEqual(g1: Game | null, g2: Game | null): boolean {
  if (!g1 || !g2) return false;

  const getCleanComparable = (g: Game) => {
    return {
      name: g.name || "",
      icon: g.icon || "",
      iconType: g.iconType || "emoji",
      series: g.series || "",
      cover: g.cover || "",
      status: g.status || [],
      platform: g.platform || "",
      genre: g.genre || [],
      tags: g.tags || [],
      publisher: g.publisher || "",
      studio: g.studio || "",
      developer: g.developer || "",
      playtime: g.playtime || "",
      rating: g.rating || 0,
      startDate: g.startDate || "",
      endDate: g.endDate || "",
      releaseDate: g.releaseDate || "",
      coverPosition: g.coverPosition || 0,
      coverPositionX: g.coverPositionX || 50,
      coverZoom: g.coverZoom || 100,
      replayed: !!g.replayed,
      replayCount: g.replayCount || 0,
      isDlc: (g.isDlc as any) === "plus_dlc" ? true : !!g.isDlc,
      dlcMode: g.dlcMode || ((g.isDlc as any) === "plus_dlc" ? "plus_dlc" : g.isDlc ? "dlc" : "none"),
      dlcNames: g.dlcNames || "",
      difficulty: g.difficulty || "",
      hltbMain: g.hltbMain || "",
      hltbExtra: g.hltbExtra || "",
      hltbCompletionist: g.hltbCompletionist || "",
      hltbId: g.hltbId || "",
      metacriticUrl: g.metacriticUrl || "",
      metacriticCritScore: g.metacriticCritScore || 0,
      metacriticUserScore: g.metacriticUserScore || 0,
      additionalPlaytime: g.additionalPlaytime || "",
      trophy: g.trophy || "none",
      trophies: g.trophies || [],
      pros: g.pros || "",
      cons: g.cons || "",
      diary: (g.diary || []).map(d => ({
        id: d.id,
        period: d.period || "",
        text: d.text || "",
        medias: (d.medias || []).map(m => ({ src: m.src, isVideo: !!m.isVideo }))
      }))
    };
  };

  return JSON.stringify(getCleanComparable(g1)) === JSON.stringify(getCleanComparable(g2));
}

/**
 * Main function to back up the complete library data and all uploaded media files to Google Drive.
 */
export async function backupLibraryToDrive(
  games: Game[],
  globalTags: string[],
  globalGenres: string[],
  onProgress?: (msg: string) => void,
  signal?: AbortSignal
): Promise<void> {
  if (signal) {
    activeBackupSignal = signal;
  }

  try {
    if (!isDriveAuthenticated()) {
      throw new Error("Não conectado ao Google Drive.");
    }

    if (tokenTimestamp > 0 && Date.now() - tokenTimestamp > 45 * 60 * 1000) {
      onProgress?.("Renovando sessão do Google Drive para o backup...");
      try {
        await refreshDriveToken();
      } catch (err) {
        console.warn("Aviso ao renovar token proativamente:", err);
      }
    }

    const checkAbort = () => {
      if (activeBackupSignal?.aborted) {
        throw new DOMException("Backup cancelado pelo usuário", "AbortError");
      }
    };

    checkAbort();
    onProgress?.("Criando pasta principal no Google Drive...");
    const rootFolderId = await getOrCreateFolder("Biblioteca_Jogos_Backup");

    checkAbort();
    onProgress?.("Verificando estrutura e arquivos no Google Drive...");
    const rootItems = await listFilesAndFoldersInParent(rootFolderId);

    // Map existing root items: folders and master JSON file
    const existingFoldersByName = new Map<string, string>();
    let masterJsonItem: { id: string; name: string; mimeType: string } | undefined = undefined;

    for (const item of rootItems) {
      if (item.mimeType === "application/vnd.google-apps.folder") {
        existingFoldersByName.set(item.name, item.id);
      } else if (item.name === "dados_biblioteca.json") {
        masterJsonItem = item;
      }
    }

    // Download previous master JSON once to compare all games in 1 single HTTP request
    const previousGamesMap = new Map<string, Game>();
    if (masterJsonItem) {
      try {
        onProgress?.("Verificando histórico de backup anterior...");
        const response = await driveFetch(`https://www.googleapis.com/drive/v3/files/${masterJsonItem.id}?alt=media`);
        const previousData = await response.json();
        if (previousData && Array.isArray(previousData.games)) {
          for (const pg of previousData.games) {
            if (pg.id) previousGamesMap.set(pg.id, pg);
            if (pg.name) previousGamesMap.set(pg.name, pg);
          }
        }
      } catch (err) {
        console.warn("Aviso: Não foi possível ler dados_biblioteca.json anterior para comparação rápida:", err);
      }
    }

    // 1. Save updated master data backup json
    onProgress?.("Salvando base de dados geral...");

    // Sort ALL games' diaries to ensure the complete library database file also has them in ascending order!
    const sortedGames = games.map((game) => ({
      ...game,
      diary: game.diary ? [...game.diary].sort((a, b) => parsePeriodStartDate(a.period) - parsePeriodStartDate(b.period)) : []
    }));

    const backupData = {
      games: sortedGames,
      globalTags,
      globalGenres,
      backedUpAt: new Date().toISOString(),
    };
    const jsonContent = JSON.stringify(backupData, null, 2);
    await uploadOrUpdateFile("dados_biblioteca.json", "application/json", jsonContent, rootFolderId, masterJsonItem?.id);

    // 2. Clean up folders for deleted games in Drive
    checkAbort();
    onProgress?.("Sincronizando estrutura de pastas dos jogos...");
    const activeGameNames = games.map((g) => g.name);

    for (const item of rootItems) {
      if (item.mimeType === "application/vnd.google-apps.folder") {
        if (!["Capas_Temp", "Icones_Temp", "Diario_Temp"].includes(item.name) && !activeGameNames.includes(item.name)) {
          onProgress?.(`Removendo pasta de jogo excluído do Drive: "${item.name}"...`);
          await deleteFileOrFolder(item.id);
          existingFoldersByName.delete(item.name);
        }
      }
    }

    // 3. Scan and upload metadata & media files for each game with differential fast-path
    let skippedCount = 0;
    let changedCount = 0;

    for (let i = 0; i < games.length; i++) {
      checkAbort();
      const game = games[i];

      const sortedDiary = game.diary ? [...game.diary].sort((a, b) => parsePeriodStartDate(a.period) - parsePeriodStartDate(b.period)) : [];
      const gameToSave = { ...game, diary: sortedDiary };

      const existingFolderId = existingFoldersByName.get(game.name);
      const previousGame = (game.id && previousGamesMap.get(game.id)) || previousGamesMap.get(game.name) || null;

      // Fast differential check: if game folder exists in Drive and game data is identical to last backup, skip!
      const isIdentical = previousGame ? areGamesEqual(gameToSave, previousGame) : false;
      if (existingFolderId && isIdentical) {
        skippedCount++;
        onProgress?.(`Verificando (${i + 1}/${games.length}): ${game.name} [Sem alterações]`);
        continue;
      }

      changedCount++;
      onProgress?.(`Processando backup (${i + 1}/${games.length}): ${game.name}...`);
      const gameFolderId = existingFolderId || (await getOrCreateFolder(game.name, rootFolderId));
      existingFoldersByName.set(game.name, gameFolderId);

      checkAbort();
      // List items in game folder
      const gameFolderItems = await listFilesAndFoldersInParent(gameFolderId);

      // Save/check game-specific metadata and details
      const gameJsonItem = gameFolderItems.find((item) => item.name === "dados_jogo.json");
      const gameMetadataChanged = !previousGame || !areGamesEqual(gameToSave, previousGame);

      if (!gameJsonItem || gameMetadataChanged) {
        onProgress?.(`Atualizando metadados de ${game.name}...`);
        const gameJsonContent = JSON.stringify(gameToSave, null, 2);
        await uploadOrUpdateFile("dados_jogo.json", "application/json", gameJsonContent, gameFolderId, gameJsonItem?.id);
      }

      checkAbort();
      // Back up game cover directly inside the game folder
      const capaItem = gameFolderItems.find((item) => item.name === "capa.webp");
      if (game.cover && (game.cover.startsWith("http") || game.cover.startsWith("data:"))) {
        const coverChanged = !previousGame || previousGame.cover !== game.cover;
        if (!capaItem || coverChanged) {
          onProgress?.(`Fazendo backup da capa de ${game.name}...`);
          const blob = await urlToBlob(game.cover);
          if (blob) {
            const webpBlob = await convertBlobToWebp(blob);
            checkAbort();
            await uploadOrUpdateFile("capa.webp", "image/webp", webpBlob, gameFolderId, capaItem?.id);
          }
        }
      } else if (!game.cover && capaItem) {
        onProgress?.(`Removendo capa desassociada de ${game.name}...`);
        await deleteFileOrFolder(capaItem.id);
      }

      checkAbort();
      // Back up custom icon directly inside the game folder
      const iconeItem = gameFolderItems.find((item) => item.name === "icone.webp");
      if (game.icon && (game.icon.startsWith("http") || game.icon.startsWith("data:")) && game.iconType === "upload") {
        const iconChanged = !previousGame || previousGame.icon !== game.icon || previousGame.iconType !== game.iconType;
        if (!iconeItem || iconChanged) {
          onProgress?.(`Fazendo backup do ícone de ${game.name}...`);
          const blob = await urlToBlob(game.icon);
          if (blob) {
            const webpBlob = await convertBlobToWebp(blob);
            checkAbort();
            await uploadOrUpdateFile("icone.webp", "image/webp", webpBlob, gameFolderId, iconeItem?.id);
          }
        }
      } else if ((!game.icon || game.iconType !== "upload") && iconeItem) {
        onProgress?.(`Removendo ícone desassociado de ${game.name}...`);
        await deleteFileOrFolder(iconeItem.id);
      }

      // Back up diary entry text & medias inside structured subfolders for each entry
      const activeFolderNames = sortedDiary.map((entry) => {
        const { startDateYMD, formattedRange } = getFormattedPeriodAndDate(entry.period);
        return `[${startDateYMD}] Diário (${formattedRange}) - ${entry.id}`;
      });

      checkAbort();
      // Clean up obsolete/old format folders inside gameFolderId
      for (const item of gameFolderItems) {
        if (item.mimeType === "application/vnd.google-apps.folder") {
          const isOldFormat = item.name.startsWith("Entrada ");
          const isNewFormatAndObsolete = (item.name.startsWith("[") || item.name.includes("Diário")) && !activeFolderNames.includes(item.name);

          if (item.name === "Midias_Diario") {
            continue;
          }

          if (isOldFormat || isNewFormatAndObsolete) {
            onProgress?.(`Removendo pasta de diário obsoleta do Drive: "${item.name}"...`);
            await deleteFileOrFolder(item.id);
          }
        }
      }

      for (let entryIdx = 0; entryIdx < sortedDiary.length; entryIdx++) {
        checkAbort();
        const entry = sortedDiary[entryIdx];

        const { startDateYMD, formattedRange } = getFormattedPeriodAndDate(entry.period);
        const entryFolderName = `[${startDateYMD}] Diário (${formattedRange}) - ${entry.id}`;

        const entryFolderId = await getOrCreateFolder(entryFolderName, gameFolderId);
        const entryFolderItems = await listFilesAndFoldersInParent(entryFolderId);

        checkAbort();
        // 1. Back up diary entry text as a clean plain .txt file
        const txtFileName = "texto_entrada.txt";
        const txtContent = `==================================================\nDIÁRIO DE JOGATINA - ${game.name.toUpperCase()}\n==================================================\nEntrada: #${entryIdx + 1}\nPeríodo: ${entry.period || "Não especificado"}\n==================================================\n\n${stripHtml(entry.text || "")}\n\n==================================================\nGerado automaticamente via Biblioteca do Haleck\n==================================================`;

        const prevEntry = previousGame?.diary?.find((d: any) => d.id === entry.id);
        const prevEntryIdx = previousGame?.diary ? previousGame.diary.findIndex((d: any) => d.id === entry.id) : -1;
        const textChanged = !prevEntry || prevEntry.text !== entry.text || prevEntry.period !== entry.period || prevEntryIdx !== entryIdx;

        const txtItem = entryFolderItems.find((item) => item.name === txtFileName);

        if (!txtItem || textChanged) {
          onProgress?.(`Salvando texto do diário em "${entryFolderName}"...`);
          await uploadOrUpdateFile(txtFileName, "text/plain", txtContent, entryFolderId, txtItem?.id);
        }

        // 2. Build expected media filenames for this entry and clean up deleted media files
        const expectedMediaNames = new Set<string>();
        if (entry.medias && entry.medias.length > 0) {
          entry.medias.forEach((media, mIdx) => {
            if (media.isVideo) {
              const isYt = media.src && (media.src.includes("youtube.com") || media.src.includes("youtu.be"));
              expectedMediaNames.add(isYt ? `video_youtube_${mIdx + 1}.txt` : `video_anexo_${mIdx + 1}.webm`);
            } else {
              expectedMediaNames.add(`midia_anexa_${mIdx + 1}.webp`);
            }
          });
        }

        // Remove any orphaned media files in entryFolderItems that are no longer part of entry.medias
        for (const item of entryFolderItems) {
          const isMediaFile = item.name.startsWith("midia_anexa_") || item.name.startsWith("video_anexo_") || item.name.startsWith("video_youtube_");
          if (isMediaFile && !expectedMediaNames.has(item.name)) {
            onProgress?.(`Removendo mídia excluída do Drive em "${entryFolderName}": ${item.name}...`);
            await deleteFileOrFolder(item.id);
          }
        }

        // 3. Back up diary entry medias
        if (entry.medias && entry.medias.length > 0) {
          for (let mediaIdx = 0; mediaIdx < entry.medias.length; mediaIdx++) {
            checkAbort();
            const media = entry.medias[mediaIdx];
            if (media.src && (media.src.startsWith("http") || media.src.startsWith("data:"))) {
              if (media.isVideo) {
                const isYt = media.src.includes("youtube.com") || media.src.includes("youtu.be");
                if (isYt) {
                  const shortcutName = `video_youtube_${mediaIdx + 1}.txt`;
                  const existingShortcut = entryFolderItems.find((item) => item.name === shortcutName);
                  if (!existingShortcut) {
                    onProgress?.(`Salvando atalho do vídeo do YouTube em "${entryFolderName}"...`);
                    await uploadOrUpdateFile(shortcutName, "text/plain", `Link do YouTube: ${media.src}`, entryFolderId);
                  }
                } else {
                  const videoName = `video_anexo_${mediaIdx + 1}.webm`;
                  const existingVideo = entryFolderItems.find((item) => item.name === videoName);
                  const prevMedia = prevEntry?.medias?.[mediaIdx];
                  const mediaChanged = !prevMedia || prevMedia.src !== media.src;

                  if (!existingVideo || mediaChanged) {
                    onProgress?.(`Salvando vídeo do diário em "${entryFolderName}" (${mediaIdx + 1}/${entry.medias.length})...`);
                    const blob = await urlToBlob(media.src);
                    if (blob) {
                      const webmBlob = await convertVideoToWebm(blob);
                      checkAbort();
                      await uploadOrUpdateFile(videoName, "video/webm", webmBlob, entryFolderId, existingVideo?.id);
                    }
                  }
                }
              } else {
                const mediaName = `midia_anexa_${mediaIdx + 1}.webp`;
                const existingMedia = entryFolderItems.find((item) => item.name === mediaName);
                const prevMedia = prevEntry?.medias?.[mediaIdx];
                const mediaChanged = !prevMedia || prevMedia.src !== media.src;

                if (!existingMedia || mediaChanged) {
                  onProgress?.(`Salvando imagem do diário de ${game.name} (${mediaIdx + 1}/${entry.medias.length})...`);
                  const blob = await urlToBlob(media.src);
                  if (blob) {
                    const webpBlob = await convertBlobToWebp(blob);
                    checkAbort();
                    await uploadOrUpdateFile(mediaName, "image/webp", webpBlob, entryFolderId, existingMedia?.id);
                  }
                }
              }
            }
          }
        }
      }
    }

    if (changedCount === 0) {
      onProgress?.("Backup concluído! Todos os jogos já estavam 100% atualizados no Google Drive.");
    } else {
      onProgress?.(`Backup concluído com sucesso! (${changedCount} jogo(s) sincronizado(s), ${skippedCount} sem alterações)`);
    }
  } finally {
    activeBackupSignal = null;
  }
}

/**
 * Auxiliary function to strip HTML tags and format the text for plain text (.txt) files.
 */
export function stripHtml(html: string): string {
  if (!html) return "";
  // Convert basic HTML elements to legible plain text formatting
  let text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<li>/gi, " • ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<strong>/gi, "")
    .replace(/<\/strong>/gi, "")
    .replace(/em>/gi, "")
    .replace(/<\/em>/gi, "")
    .replace(/<u>/gi, "")
    .replace(/<\/u>/gi, "");
    
  // Strip all other HTML tags
  text = text.replace(/<[^>]+>/g, "");
  
  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
    
  // Clean up excessive newlines
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Uploads a single media directly to Google Drive as an immediate backup during upload.
 */
export async function uploadSingleMediaBackup(
  fileOrBase64: File | string,
  folderType: "covers" | "icons" | "diary",
  fileName: string,
  gameName?: string
): Promise<string | null> {
  if (!isDriveAuthenticated()) {
    return null; // Skip if Google Drive is not connected
  }

  try {
    const rootFolderId = await getOrCreateFolder("Biblioteca_Jogos_Backup");
    let targetFolderId = rootFolderId;

    if (gameName) {
      const gameFolderId = await getOrCreateFolder(gameName, rootFolderId);
      if (folderType === "diary") {
        targetFolderId = await getOrCreateFolder("Midias_Diario", gameFolderId);
      } else {
        targetFolderId = gameFolderId;
      }
    } else {
      // Fallback if no game name is provided
      if (folderType === "covers") {
        targetFolderId = await getOrCreateFolder("Capas_Temp", rootFolderId);
      } else if (folderType === "icons") {
        targetFolderId = await getOrCreateFolder("Icones_Temp", rootFolderId);
      } else if (folderType === "diary") {
        targetFolderId = await getOrCreateFolder("Diario_Temp", rootFolderId);
      }
    }

    let blob: Blob;
    let mimeType = "image/jpeg";

    if (fileOrBase64 instanceof File) {
      blob = fileOrBase64;
      mimeType = fileOrBase64.type;
    } else {
      // Base64 string
      const response = await fetch(fileOrBase64);
      blob = await response.blob();
      mimeType = blob.type || "image/jpeg";
    }

    // Convert to webp if it is an image (excluding gifs)
    if (mimeType.startsWith("image/") && mimeType !== "image/gif") {
      blob = await convertBlobToWebp(blob);
      mimeType = "image/webp";
      const lastDotIndex = fileName.lastIndexOf(".");
      if (lastDotIndex !== -1) {
        fileName = fileName.substring(0, lastDotIndex) + ".webp";
      } else {
        fileName = fileName + ".webp";
      }
    }

    // Convert to webm if it is a video
    if (mimeType.startsWith("video/")) {
      blob = await convertVideoToWebm(blob);
      mimeType = "video/webm";
      const lastDotIndex = fileName.lastIndexOf(".");
      if (lastDotIndex !== -1) {
        fileName = fileName.substring(0, lastDotIndex) + ".webm";
      } else {
        fileName = fileName + ".webm";
      }
    }

    const fileId = await uploadOrUpdateFile(fileName, mimeType, blob, targetFolderId);
    return fileId;
  } catch (err) {
    console.error("Falha ao enviar backup de mídia para o Google Drive:", err);
    return null;
  }
}
