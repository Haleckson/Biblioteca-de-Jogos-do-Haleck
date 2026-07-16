import { signInWithPopup, GoogleAuthProvider, User, onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { Game } from "../types";

// In-memory token cache as required by the workspace integration guidelines
let cachedAccessToken: string | null = null;
let currentUser: User | null = null;
let isSigningIn = false;

// Initialize Google Auth Provider with Google Drive File scope
const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/drive.file");

// Monitor auth state to clear token on logout
if (auth) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (!user) {
      cachedAccessToken = null;
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
  localStorage.removeItem("google_drive_connected");
}

/**
 * Helper to fetch with Bearer token authorization.
 */
async function driveFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getDriveAccessToken();
  if (!token) {
    throw new Error("Usuário não autenticado no Google Drive. Por favor, conecte sua conta.");
  }

  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(url, { ...options, headers });
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
  parentId: string
): Promise<string> {
  const existingId = await findFileByName(filename, parentId, false);

  if (existingId) {
    // Update content of existing file
    await driveFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": mimeType,
        },
        body: content,
      }
    );
    return existingId;
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
    const fileId = fileMetadata.id;

    // 2. Upload file content
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
  }
}

/**
 * Utility to fetch a remote image URL and convert it to a Blob.
 */
async function urlToBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch (err) {
    console.error(`Erro ao converter URL para blob: ${url}`, err);
    return null;
  }
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
 * Main function to back up the complete library data and all uploaded media files to Google Drive.
 */
export async function backupLibraryToDrive(
  games: Game[],
  globalTags: string[],
  globalGenres: string[],
  onProgress?: (msg: string) => void
): Promise<void> {
  if (!isDriveAuthenticated()) {
    throw new Error("Não conectado ao Google Drive.");
  }

  onProgress?.("Criando pasta principal no Google Drive...");
  const rootFolderId = await getOrCreateFolder("Biblioteca_Jogos_Backup");

  // 1. Save data backup json
  onProgress?.("Salvando base de dados geral...");
  const backupData = {
    games,
    globalTags,
    globalGenres,
    backedUpAt: new Date().toISOString(),
  };
  const jsonContent = JSON.stringify(backupData, null, 2);
  await uploadOrUpdateFile("dados_biblioteca.json", "application/json", jsonContent, rootFolderId);

  // 2. Scan and upload media files
  for (const game of games) {
    onProgress?.(`Estruturando pasta para o jogo: ${game.name}...`);
    // Create folder for the game (e.g., game.name) inside the root backup folder
    const gameFolderId = await getOrCreateFolder(game.name, rootFolderId);

    // Save game-specific metadata and details
    const gameJsonExists = await findFileByName("dados_jogo.json", gameFolderId, false);
    if (!gameJsonExists) {
      onProgress?.(`Salvando dados e metadados de ${game.name}...`);
      const gameJsonContent = JSON.stringify(game, null, 2);
      await uploadOrUpdateFile("dados_jogo.json", "application/json", gameJsonContent, gameFolderId);
    } else {
      onProgress?.(`Metadados de ${game.name} já existem. Ignorando para evitar sobrescrição...`);
    }

    // Back up game cover directly inside the game folder
    if (game.cover && game.cover.startsWith("http")) {
      const coverName = "capa.webp";
      const exists = await findFileByName(coverName, gameFolderId, false);
      if (!exists) {
        onProgress?.(`Fazendo backup da capa de ${game.name}...`);
        const blob = await urlToBlob(game.cover);
        if (blob) {
          const webpBlob = await convertBlobToWebp(blob);
          await uploadOrUpdateFile(coverName, "image/webp", webpBlob, gameFolderId);
        }
      }
    }

    // Back up custom icon directly inside the game folder
    if (game.icon && game.icon.startsWith("http") && game.iconType === "upload") {
      const iconName = "icone.webp";
      const exists = await findFileByName(iconName, gameFolderId, false);
      if (!exists) {
        onProgress?.(`Fazendo backup do ícone de ${game.name}...`);
        const blob = await urlToBlob(game.icon);
        if (blob) {
          const webpBlob = await convertBlobToWebp(blob);
          await uploadOrUpdateFile(iconName, "image/webp", webpBlob, gameFolderId);
        }
      }
    }

    // Back up diary entry text & medias inside a game-specific "Diario" folder
    if (game.diary && game.diary.length > 0) {
      let gameDiaryFolderId: string | null = null;

      for (let entryIdx = 0; entryIdx < game.diary.length; entryIdx++) {
        const entry = game.diary[entryIdx];
        
        if (!gameDiaryFolderId) {
          gameDiaryFolderId = await getOrCreateFolder("Diario", gameFolderId);
        }

        // 1. Back up diary entry text as a .txt file if it doesn't exist
        const safePeriod = entry.period ? entry.period.replace(/[\s~/\\:*?"<>|]/g, "_") : `entrada_${entryIdx + 1}`;
        const txtFileName = `diario_entrada_${entryIdx + 1}_${safePeriod}.txt`;
        const txtExists = await findFileByName(txtFileName, gameDiaryFolderId, false);
        
        if (!txtExists) {
          const txtContent = `Diário de Jogatina - ${game.name}\nPeríodo: ${entry.period || "Não especificado"}\n\nTexto:\n${entry.text || ""}`;
          onProgress?.(`Fazendo backup do texto do diário de ${game.name} (Entrada ${entryIdx + 1})...`);
          await uploadOrUpdateFile(txtFileName, "text/plain", txtContent, gameDiaryFolderId);
        } else {
          onProgress?.(`Texto do diário (Entrada ${entryIdx + 1}) de ${game.name} já existe. Ignorando...`);
        }

        // 2. Back up diary entry medias
        if (entry.medias && entry.medias.length > 0) {
          for (let mediaIdx = 0; mediaIdx < entry.medias.length; mediaIdx++) {
            const media = entry.medias[mediaIdx];
            if (media.src && media.src.startsWith("http") && !media.isVideo) {
              const mediaName = `diario_entrada_${entryIdx + 1}_media_${mediaIdx + 1}.webp`;

              const exists = await findFileByName(mediaName, gameDiaryFolderId, false);
              if (!exists) {
                onProgress?.(`Fazendo backup da imagem do diário de ${game.name} (${mediaIdx + 1})...`);
                const blob = await urlToBlob(media.src);
                if (blob) {
                  const webpBlob = await convertBlobToWebp(blob);
                  await uploadOrUpdateFile(mediaName, "image/webp", webpBlob, gameDiaryFolderId);
                }
              }
            }
          }
        }
      }
    }
  }

  onProgress?.("Backup concluído com sucesso!");
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
        targetFolderId = await getOrCreateFolder("Diario", gameFolderId);
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

    const fileId = await uploadOrUpdateFile(fileName, mimeType, blob, targetFolderId);
    return fileId;
  } catch (err) {
    console.error("Falha ao enviar backup de mídia para o Google Drive:", err);
    return null;
  }
}
