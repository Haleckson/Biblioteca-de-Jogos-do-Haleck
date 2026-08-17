import { signInWithPopup, GoogleAuthProvider, User, onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { Game } from "../types";
import { generateBackupPDFReport, PDFReportData } from "./pdfReport";
import { isVideoFile, isImageFile, getVideoMimeType } from "./mediaUtils";
import { addBackupLog } from "./backupAuditLog";

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
 * Helper to pause execution while mediaUploadQueueManager is paused, or throw AbortError if canceled.
 */
export async function checkDrivePauseAndAbort(signal?: AbortSignal) {
  const { mediaUploadQueueManager } = await import("./mediaUploadManager");
  while (mediaUploadQueueManager.getIsPaused()) {
    if (signal?.aborted || activeBackupSignal?.aborted) {
      throw new DOMException("Backup cancelado pelo usuário", "AbortError");
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  if (signal?.aborted || activeBackupSignal?.aborted) {
    throw new DOMException("Backup cancelado pelo usuário", "AbortError");
  }
}

/**
 * Helper to fetch with Bearer token authorization and auto-refresh on 401.
 */
async function driveFetch(url: string, options: RequestInit = {}): Promise<Response> {
  await checkDrivePauseAndAbort(options.signal);

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
    // 1. Update metadata (filename and mimeType) if updating an existing file
    try {
      await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: filename,
          mimeType,
        }),
      });
    } catch (err) {
      console.warn("Aviso ao atualizar metadados do arquivo no Drive:", err);
    }

    // 2. Update content of existing file
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
 * Renames an existing file or folder in Google Drive.
 */
export async function renameFileOrFolder(fileId: string, newName: string): Promise<void> {
  await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: newName,
    }),
  });
}

/**
 * Gets or creates a diary entry folder, automatically migrating and renaming any existing folder
 * that belongs to this entryId (e.g. if it had [0000-00-00] or an older date format), completely preventing duplicate folders.
 */
export async function getOrCreateDiaryEntryFolder(
  targetFolderName: string,
  entryId: string,
  parentGameFolderId: string
): Promise<string> {
  const existingItems = await listFilesAndFoldersInParent(parentGameFolderId);

  // 1. Check if the exact folder name already exists
  const exactMatch = existingItems.find(
    (item) => item.mimeType === "application/vnd.google-apps.folder" && item.name === targetFolderName
  );
  if (exactMatch) {
    return exactMatch.id;
  }

  // 2. Check if a folder for this entryId exists under an older or temporary name (e.g. [0000-00-00]... or previous date range)
  if (entryId) {
    const legacyMatches = existingItems.filter(
      (item) =>
        item.mimeType === "application/vnd.google-apps.folder" &&
        (item.name.endsWith(`- ${entryId}`) || item.name.includes(entryId))
    );

    if (legacyMatches.length > 0) {
      const primaryFolder = legacyMatches[0];
      try {
        console.log(`[GoogleDrive Auto-Rename] Renomeando pasta de diário de "${primaryFolder.name}" para "${targetFolderName}"...`);
        await renameFileOrFolder(primaryFolder.id, targetFolderName);
        addBackupLog({
          provider: "Google Drive",
          action: "Renomeação de Pasta de Diário",
          status: "success",
          details: `Pasta renomeada de "${primaryFolder.name}" para "${targetFolderName}".`,
        });

        // Clean up any other duplicate folders with the same entryId if any
        for (let i = 1; i < legacyMatches.length; i++) {
          try {
            await deleteFileOrFolder(legacyMatches[i].id);
          } catch (delErr) {
            console.warn("Aviso ao remover pasta duplicada:", delErr);
          }
        }

        return primaryFolder.id;
      } catch (renameErr) {
        console.warn(`Erro ao renomear pasta (${primaryFolder.name}):`, renameErr);
        return primaryFolder.id;
      }
    }
  }

  // 3. If no folder existed for this entry, create a new one
  return await getOrCreateFolder(targetFolderName, parentGameFolderId);
}

/**
 * Utility to fetch a remote image or video URL (or parse base64 data URI) and convert it to a Blob.
 */
async function urlToBlob(url: string, retries = 2): Promise<Blob | null> {
  if (!url) return null;

  // 1. Handle data URI (base64)
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

  // 2. Handle local blob: URL scheme directly (never pass referrerPolicy or CORS headers to blob: URLs)
  if (url.startsWith("blob:")) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const b = await res.blob();
        if (b && b.size > 0) return b;
      }
    } catch (err) {
      console.warn(`Erro ao obter blob da URL local (${url}):`, err);
    }

    // Canvas fallback for local blob image without setting img.crossOrigin
    try {
      const blobFromCanvas = await new Promise<Blob | null>((resolve) => {
        const img = new Image();
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
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });
      if (blobFromCanvas) return blobFromCanvas;
    } catch (e) {
      console.warn("Erro no fallback de canvas para URL blob local:", e);
    }

    return null;
  }

  // 3. Handle standard HTTP/HTTPS URLs
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

  // 4. Fallback for remote images: load via HTML Image element
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

  // 5. Final fallback for images: Proxy request through server endpoint
  try {
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
    const proxyRes = await fetch(proxyUrl);
    if (proxyRes.ok) {
      return await proxyRes.blob();
    }
    console.warn(`Proxy de imagem do servidor retornou status ${proxyRes.status} para ${url}`);
  } catch (err) {
    console.error("Erro no proxy de imagem do servidor:", err);
  }

  return null;
}

/**
 * Computes SHA-256 hash of a string, Blob, or ArrayBuffer for backup change detection.
 */
export async function computeContentHash(data: string | Blob | ArrayBuffer): Promise<string> {
  try {
    let buffer: ArrayBuffer;
    if (typeof data === "string") {
      buffer = new TextEncoder().encode(data).buffer;
    } else if (data instanceof Blob) {
      buffer = await data.arrayBuffer();
    } else {
      buffer = data;
    }
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (err) {
    let str = "";
    if (typeof data === "string") str = data;
    else if (data instanceof Blob) str = `${data.size}_${data.type}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `fnv_${Math.abs(hash)}`;
  }
}

/**
 * Generates an HTML shortcut redirect file content for a YouTube video.
 */
export function createYoutubeHtmlShortcut(youtubeUrl: string, gameName = "", entryTitle = ""): { content: string; blob: Blob } {
  const cleanUrl = youtubeUrl || "https://www.youtube.com";
  const content = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=${cleanUrl}">
  <title>Atalho para Vídeo do YouTube - ${gameName.replace(/[<>]/g, "")}</title>
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; background-color: #09090b; color: #f4f4f5; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; text-align: center;">
  <div style="background-color: #18181b; border: 1px solid #27272a; padding: 32px; border-radius: 20px; max-width: 480px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
    <div style="font-size: 40px; margin-bottom: 16px;">🎬</div>
    <h2 style="font-size: 18px; font-weight: 800; margin: 0 0 8px 0; color: #ffffff;">Redirecionando para o YouTube...</h2>
    <p style="color: #a1a1aa; font-size: 13px; margin: 0 0 24px 0; line-height: 1.5;">${gameName ? `Jogo: <strong>${gameName}</strong>` : ""}${entryTitle ? `<br/>${entryTitle}` : ""}</p>
    <a href="${cleanUrl}" style="display: inline-block; background-color: #0891b2; color: #ffffff; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 12px; text-decoration: none; transition: all 0.2s;">Assistir Vídeo no YouTube</a>
  </div>
  <script>
    setTimeout(function() {
      window.location.href = "${cleanUrl}";
    }, 100);
  </script>
</body>
</html>`;

  return {
    content,
    blob: new Blob([content], { type: "text/html;charset=utf-8" })
  };
}

/**
 * Converts any image blob to webp format using standard client-side HTML5 Canvas (100% quality, natural resolution).
 */
async function convertBlobToWebp(blob: Blob): Promise<Blob> {
  if (blob.type === "image/webp" || blob.type === "image/gif") return blob;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      // Preserve exact 1:1 natural resolution (no downsizing)
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
        1.0 // 100% maximum visual quality
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
 * Resolves appropriate file extension and mime type for attached video blobs without re-encoding.
 */
function getVideoDetails(blob: Blob, srcUrl: string): { extension: string; mimeType: string } {
  const mime = blob.type || "";
  if (mime.includes("mp4")) return { extension: "mp4", mimeType: "video/mp4" };
  if (mime.includes("webm")) return { extension: "webm", mimeType: "video/webm" };
  if (mime.includes("quicktime") || mime.includes("mov")) return { extension: "mov", mimeType: "video/quicktime" };
  if (mime.includes("avi")) return { extension: "avi", mimeType: "video/x-msvideo" };
  if (mime.includes("mkv")) return { extension: "mkv", mimeType: "video/x-matroska" };

  const lower = (srcUrl || "").toLowerCase();
  if (lower.includes(".mp4")) return { extension: "mp4", mimeType: "video/mp4" };
  if (lower.includes(".mov")) return { extension: "mov", mimeType: "video/quicktime" };
  if (lower.includes(".webm")) return { extension: "webm", mimeType: "video/webm" };

  return { extension: "webm", mimeType: mime || "video/webm" };
}

/**
 * Helper to parse start date timestamp from period string (e.g., "10/05/2026 ~ 18/05/2026", "2026-05-10 até 2026-05-18")
 */
function parsePeriodStartDate(period: string): number {
  try {
    if (!period || typeof period !== "string") return 0;
    const cleanStr = period.trim();
    const separator = cleanStr.includes("~")
      ? "~"
      : cleanStr.toLowerCase().includes(" até ")
      ? " até "
      : cleanStr.toLowerCase().includes(" to ")
      ? " to "
      : null;

    const firstPart = (separator ? cleanStr.split(separator)[0] : cleanStr).trim();

    // Check for DD/MM/YYYY
    const brMatch = firstPart.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (brMatch) {
      const day = parseInt(brMatch[1], 10);
      const month = parseInt(brMatch[2], 10) - 1;
      const year = parseInt(brMatch[3], 10);
      return new Date(year, month, day).getTime();
    }

    // Check for YYYY-MM-DD
    const isoMatch = firstPart.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      return new Date(year, month, day).getTime();
    }

    const parsed = Date.parse(firstPart);
    if (!isNaN(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.error("Error parsing period date:", err);
  }
  return 0;
}

/**
 * Parses and formats period string to standard YYYY-MM-DD and clean range representation for filenames/folders.
 * Robust to formats like "DD/MM/AAAA ~ DD/MM/AAAA", "YYYY-MM-DD", "YYYY-MM-DD até YYYY-MM-DD", etc.
 */
function getFormattedPeriodAndDate(period: string): { startDateYMD: string; formattedRange: string } {
  try {
    const parseSingleDate = (str: string): { ymd: string; dmy: string; timestamp: number } | null => {
      if (!str || typeof str !== "string") return null;
      const clean = str.trim();

      // Check for YYYY-MM-DD
      const isoMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
      if (isoMatch) {
        const y = isoMatch[1];
        const m = isoMatch[2].padStart(2, "0");
        const d = isoMatch[3].padStart(2, "0");
        return {
          ymd: `${y}-${m}-${d}`,
          dmy: `${d}-${m}-${y}`,
          timestamp: new Date(Number(y), Number(m) - 1, Number(d)).getTime(),
        };
      }

      // Check for DD/MM/YYYY or DD-MM-YYYY
      const brMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
      if (brMatch) {
        const d = brMatch[1].padStart(2, "0");
        const m = brMatch[2].padStart(2, "0");
        const y = brMatch[3];
        return {
          ymd: `${y}-${m}-${d}`,
          dmy: `${d}-${m}-${y}`,
          timestamp: new Date(Number(y), Number(m) - 1, Number(d)).getTime(),
        };
      }

      // Try Date.parse
      const parsed = Date.parse(clean);
      if (!isNaN(parsed)) {
        const dt = new Date(parsed);
        const y = String(dt.getFullYear());
        const m = String(dt.getMonth() + 1).padStart(2, "0");
        const d = String(dt.getDate()).padStart(2, "0");
        return {
          ymd: `${y}-${m}-${d}`,
          dmy: `${d}-${m}-${y}`,
          timestamp: dt.getTime(),
        };
      }

      return null;
    };

    if (period && typeof period === "string" && period.trim()) {
      const cleanStr = period.trim();
      const separator = cleanStr.includes("~")
        ? "~"
        : cleanStr.toLowerCase().includes(" até ")
        ? " até "
        : cleanStr.toLowerCase().includes(" to ")
        ? " to "
        : null;

      const parts = separator ? cleanStr.split(separator) : [cleanStr];
      const firstRaw = (parts[0] || "").trim();
      const secondRaw = (parts[1] || "").trim();

      const firstParsed = parseSingleDate(firstRaw);
      const secondParsed = parseSingleDate(secondRaw);

      if (firstParsed && secondParsed) {
        return {
          startDateYMD: firstParsed.ymd,
          formattedRange: `${firstParsed.dmy} a ${secondParsed.dmy}`,
        };
      } else if (firstParsed) {
        return {
          startDateYMD: firstParsed.ymd,
          formattedRange: firstParsed.dmy,
        };
      } else if (secondParsed) {
        return {
          startDateYMD: secondParsed.ymd,
          formattedRange: secondParsed.dmy,
        };
      }
    }
  } catch (err) {
    console.error("Error formatting period:", err);
  }

  // Fallback: If no date could be parsed, use current timestamp date rather than "0000-00-00" to avoid corrupt folders
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return { startDateYMD: `${year}-${month}-${day}`, formattedRange: `${day}-${month}-${year}` };
}

function isValidMediaUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  return trimmed.length > 0;
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
      replayNote: g.replayNote || "",
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
      dictionary: g.dictionary || [],
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
  onProgress?: (msg: string, completedSteps?: number, totalSteps?: number) => void,
  signal?: AbortSignal
): Promise<void> {
  if (signal) {
    activeBackupSignal = signal;
  }

  try {
    if (!isDriveAuthenticated()) {
      throw new Error("Não conectado ao Google Drive.");
    }

    // Calculate exact total steps for accurate progress window calculation
    let totalSteps = 4; // 1: Session check, 2: Root folder, 3: History check, 4: Folder sync
    for (const g of games) {
      totalSteps += 1; // game metadata json
      if (isValidMediaUrl(g.cover)) totalSteps += 1;
      if (isValidMediaUrl(g.icon) && (g.iconType === "upload" || g.iconType === "url")) totalSteps += 1;
      if (g.diary) {
        totalSteps += g.diary.length; // text for each diary entry
        for (const entry of g.diary) {
          if (entry.medias) {
            totalSteps += entry.medias.length; // each media attachment
          }
        }
      }
    }
    totalSteps += 1; // master json final save
    let completedSteps = 0;

    const report = (msg: string, stepIncrement = 1) => {
      completedSteps = Math.min(completedSteps + stepIncrement, totalSteps);
      onProgress?.(msg, completedSteps, totalSteps);
    };

    if (tokenTimestamp > 0 && Date.now() - tokenTimestamp > 45 * 60 * 1000) {
      report("Renovando sessão do Google Drive para o backup...", 0);
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
    report("Criando pasta principal no Google Drive...");
    const rootFolderId = await getOrCreateFolder("Biblioteca_Jogos_Backup");

    checkAbort();
    report("Verificando estrutura e arquivos no Google Drive...");
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
        report("Verificando histórico de backup anterior...");
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
    } else {
      report("Criando novo arquivo mestre de dados...", 0);
    }

    // Prepare master JSON backup payload
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

    // Clean up folders for deleted games in Drive - collects obsolete items for manual deletion
    checkAbort();
    report("Sincronizando estrutura de pastas dos jogos...");
    const activeGameNames = games.map((g) => g.name);

    const uploadedItems: PDFReportData["uploadedItems"] = [];
    const youtubeVideos: PDFReportData["youtubeVideos"] = [];
    const obsoleteItemsForManualDelete: PDFReportData["obsoleteItemsForManualDelete"] = [];
    const backupErrors: string[] = [];

    for (const item of rootItems) {
      if (item.name === "9999" || item.name.includes("9999") || item.name.startsWith("[9999")) {
        report(`[GoogleDrive Cleanup] Removendo pasta legada malformada "${item.name}"...`);
        console.log(`[GoogleDrive Backup Path] Limpeza automatica -> Removendo item malformado na raiz: ${item.name} (ID: ${item.id})`);
        addBackupLog({
          provider: "Google Drive",
          action: "Limpeza de Pasta Legada 9999",
          status: "success",
          details: `Pasta legada com nome/data '9999' (${item.name}) removida da raiz do Google Drive.`,
        });
        try {
          await deleteFileOrFolder(item.id);
        } catch (delErr) {
          console.warn(`Erro ao deletar item 9999 na raiz:`, delErr);
        }
        continue;
      }

      if (item.mimeType === "application/vnd.google-apps.folder") {
        if (!["Capas_Temp", "Icones_Temp", "Diario_Temp"].includes(item.name) && !activeGameNames.includes(item.name)) {
          report(`Identificado jogo obsoleto no Drive (excluído no site): "${item.name}"...`, 0);
          obsoleteItemsForManualDelete.push({
            gameName: item.name,
            itemName: item.name,
            itemType: "Pasta de Jogo Removida",
          });
        }
      }
    }

    // Scan and upload metadata & media files for each game
    let skippedCount = 0;
    let changedCount = 0;

    for (let i = 0; i < games.length; i++) {
      checkAbort();
      const game = games[i];

      const sortedDiary = game.diary ? [...game.diary].sort((a, b) => parsePeriodStartDate(a.period) - parsePeriodStartDate(b.period)) : [];
      const gameToSave = { ...game, diary: sortedDiary };

      const totalMediaCount = sortedDiary.reduce((sum, d) => sum + (d.medias ? d.medias.length : 0), 0);

      const existingFolderId = existingFoldersByName.get(game.name);
      const previousGame = (game.id && previousGamesMap.get(game.id)) || previousGamesMap.get(game.name) || null;

      const isIdentical = previousGame ? areGamesEqual(gameToSave, previousGame) : false;
      if (existingFolderId && isIdentical && totalMediaCount === 0) {
        skippedCount++;
        const gameSteps = 1 + (isValidMediaUrl(game.cover) ? 1 : 0) + (isValidMediaUrl(game.icon) && (game.iconType === "upload" || game.iconType === "url") ? 1 : 0);
        report(`Verificando (${i + 1}/${games.length}): ${game.name} [Sem alterações]`, gameSteps);
        continue;
      }

      changedCount++;
      const gameFolderId = existingFolderId || (await getOrCreateFolder(game.name, rootFolderId));
      existingFoldersByName.set(game.name, gameFolderId);

      checkAbort();
      const gameFolderItems = await listFilesAndFoldersInParent(gameFolderId);

      // Save/check game-specific metadata
      const gameJsonItem = gameFolderItems.find((item) => item.name === "dados_jogo.json");
      const gameMetadataChanged = !previousGame || !areGamesEqual(gameToSave, previousGame);

      if (!gameJsonItem || gameMetadataChanged) {
        report(`Atualizando metadados de ${game.name}...`);
        const gameJsonContent = JSON.stringify(gameToSave, null, 2);
        await uploadOrUpdateFile("dados_jogo.json", "application/json", gameJsonContent, gameFolderId, gameJsonItem?.id);
        uploadedItems.push({ game: game.name, file: "dados_jogo.json", type: "Texto Diário", status: gameJsonItem ? "Atualizado" : "Novo" });
      } else {
        report(`Metadados de ${game.name} atualizados.`);
      }

      checkAbort();
      // Back up game cover directly inside the game folder
      const capaItem = gameFolderItems.find((item) => item.name === "capa.webp");
      if (isValidMediaUrl(game.cover)) {
        const coverChanged = !previousGame || previousGame.cover !== game.cover;
        if (!capaItem || coverChanged) {
          report(`Fazendo backup da capa de ${game.name}...`);
          try {
            const blob = await urlToBlob(game.cover);
            if (blob) {
              const webpBlob = await convertBlobToWebp(blob);
              checkAbort();
              await uploadOrUpdateFile("capa.webp", "image/webp", webpBlob, gameFolderId, capaItem?.id);
              uploadedItems.push({ game: game.name, file: "capa.webp", type: "Capa WebP", status: capaItem ? "Atualizado" : "Novo" });
            }
          } catch (e: any) {
            backupErrors.push(`Erro ao salvar capa de ${game.name}: ${e.message || e}`);
          }
        } else {
          report(`Capa de ${game.name} já está salva no Drive.`);
        }
      } else if (!game.cover && capaItem) {
        obsoleteItemsForManualDelete.push({ gameName: game.name, itemName: "capa.webp", itemType: "Mídia Desassociada" });
      }

      checkAbort();
      // Back up custom icon directly inside the game folder
      const iconeItem = gameFolderItems.find((item) => item.name === "icone.webp");
      if (isValidMediaUrl(game.icon) && (game.iconType === "upload" || game.iconType === "url")) {
        const iconChanged = !previousGame || previousGame.icon !== game.icon || previousGame.iconType !== game.iconType;
        if (!iconeItem || iconChanged) {
          report(`Fazendo backup do ícone de ${game.name}...`);
          try {
            const blob = await urlToBlob(game.icon);
            if (blob) {
              const webpBlob = await convertBlobToWebp(blob);
              checkAbort();
              await uploadOrUpdateFile("icone.webp", "image/webp", webpBlob, gameFolderId, iconeItem?.id);
              uploadedItems.push({ game: game.name, file: "icone.webp", type: "Ícone WebP", status: iconeItem ? "Atualizado" : "Novo" });
            }
          } catch (e: any) {
            backupErrors.push(`Erro ao salvar ícone de ${game.name}: ${e.message || e}`);
          }
        } else {
          report(`Ícone de ${game.name} já está salvo no Drive.`);
        }
      } else if ((!game.icon || (game.iconType !== "upload" && game.iconType !== "url")) && iconeItem) {
        obsoleteItemsForManualDelete.push({ gameName: game.name, itemName: "icone.webp", itemType: "Mídia Desassociada" });
      }

      // Back up diary entries
      const activeFolderNames = sortedDiary.map((entry) => {
        const { startDateYMD, formattedRange } = getFormattedPeriodAndDate(entry.period);
        return `[${startDateYMD}] Diário (${formattedRange}) - ${entry.id}`;
      });

      checkAbort();
      for (const item of gameFolderItems) {
        if (item.mimeType === "application/vnd.google-apps.folder") {
          const is9999Folder = item.name === "9999" || item.name.includes("9999") || item.name.startsWith("[9999");
          if (is9999Folder) {
            report(`[GoogleDrive Cleanup] Excluindo pasta legada '9999' em ${game.name}: "${item.name}"...`);
            console.log(`[GoogleDrive Backup Path] Biblioteca_Jogos_Backup > ${game.name} > Limpeza automatica -> Removendo ${item.name}`);
            addBackupLog({
              provider: "Google Drive",
              action: "Limpeza de Pasta Legada 9999",
              status: "success",
              gameName: game.name,
              details: `Pasta legada de diário '9999' (${item.name}) removida de ${game.name}.`,
            });
            try {
              await deleteFileOrFolder(item.id);
            } catch (e) {
              console.warn(`Erro ao remover pasta legada 9999 (${item.name}):`, e);
            }
            continue;
          }

          // Automatically delete legacy 0000-00-00 temporary folders if obsolete
          const is0000Folder = item.name.includes("0000-00-00") || item.name.startsWith("[0000");
          if (is0000Folder && !activeFolderNames.includes(item.name)) {
            report(`[GoogleDrive Cleanup] Limpando pasta temporária duplicada '0000' em ${game.name}: "${item.name}"...`);
            console.log(`[GoogleDrive Backup Path] Biblioteca_Jogos_Backup > ${game.name} > Limpeza automatica -> Removendo ${item.name}`);
            addBackupLog({
              provider: "Google Drive",
              action: "Limpeza de Pasta Duplicada 0000",
              status: "success",
              gameName: game.name,
              details: `Pasta duplicada '0000-00-00' (${item.name}) removida de ${game.name}.`,
            });
            try {
              await deleteFileOrFolder(item.id);
            } catch (del0000Err) {
              console.warn(`Erro ao remover pasta duplicada 0000 (${item.name}):`, del0000Err);
            }
            continue;
          }

          const isOldFormat = item.name.startsWith("Entrada ");
          const isNewFormatAndObsolete = (item.name.startsWith("[") || item.name.includes("Diário")) && !activeFolderNames.includes(item.name);

          if (item.name === "Midias_Diario") continue;

          if (isOldFormat || isNewFormatAndObsolete) {
            obsoleteItemsForManualDelete.push({
              gameName: game.name,
              itemName: item.name,
              itemType: "Entrada de Diário Removida",
            });
          }
        }
      }

      for (let entryIdx = 0; entryIdx < sortedDiary.length; entryIdx++) {
        checkAbort();
        const entry = sortedDiary[entryIdx];

        const { startDateYMD, formattedRange } = getFormattedPeriodAndDate(entry.period);
        const entryFolderName = `[${startDateYMD}] Diário (${formattedRange}) - ${entry.id}`;

        const fullPath = `Biblioteca_Jogos_Backup > ${game.name} > ${entryFolderName}`;
        console.log(`[GoogleDrive Backup Path] ${fullPath}`);
        addBackupLog({
          provider: "Google Drive",
          action: "Verificação de Pasta de Diário",
          status: "success",
          gameName: game.name,
          details: `Caminho da pasta no Drive: ${fullPath}`,
        });

        const entryFolderId = await getOrCreateDiaryEntryFolder(entryFolderName, entry.id, gameFolderId);
        const entryFolderItems = await listFilesAndFoldersInParent(entryFolderId);

        checkAbort();
        const txtFileName = "texto_entrada.txt";
        const txtContent = `==================================================\nDIÁRIO DE JOGATINA - ${game.name.toUpperCase()}\n==================================================\nEntrada: #${entryIdx + 1}\nPeríodo: ${entry.period || "Não especificado"}\n==================================================\n\n${stripHtml(entry.text || "")}\n\n==================================================\nGerado automaticamente via Biblioteca do Haleck\n==================================================`;

        const prevEntry = previousGame?.diary?.find((d: any) => d.id === entry.id);
        const prevEntryIdx = previousGame?.diary ? previousGame.diary.findIndex((d: any) => d.id === entry.id) : -1;
        const textChanged = !prevEntry || prevEntry.text !== entry.text || prevEntry.period !== entry.period || prevEntryIdx !== entryIdx;

        const txtItem = entryFolderItems.find((item) => item.name === txtFileName);

        if (!txtItem || textChanged) {
          report(`Salvando texto do diário em "${entryFolderName}"...`);
          await uploadOrUpdateFile(txtFileName, "text/plain", txtContent, entryFolderId, txtItem?.id);
          uploadedItems.push({ game: game.name, file: `${entryFolderName}/${txtFileName}`, type: "Texto Diário", status: txtItem ? "Atualizado" : "Novo" });
        } else {
          report(`Texto do diário em "${entryFolderName}" já está atualizado.`);
        }

        const expectedMediaNames = new Set<string>();
        if (entry.medias && entry.medias.length > 0) {
          entry.medias.forEach((media, mIdx) => {
            const idxStr = mIdx + 1;
            const isVid = media.isVideo || (media.src && (media.src.includes("youtube.com") || media.src.includes("youtu.be")));
            if (isVid) {
              expectedMediaNames.add(`midia_anexa_${idxStr}.html`);
              expectedMediaNames.add(`midia_anexa_${idxStr}.txt`);
              expectedMediaNames.add(`video_youtube_${idxStr}.txt`);
            } else {
              expectedMediaNames.add(`midia_anexa_${idxStr}.webp`);
            }
          });
        }

        for (const item of entryFolderItems) {
          const isMediaFile = item.name.startsWith("midia_anexa_") || item.name.startsWith("video_anexo_") || item.name.startsWith("video_youtube_");
          if (isMediaFile && !expectedMediaNames.has(item.name)) {
            obsoleteItemsForManualDelete.push({
              gameName: game.name,
              itemName: `${entryFolderName}/${item.name}`,
              itemType: "Mídia Desassociada",
            });
          }
        }

        if (entry.medias && entry.medias.length > 0) {
          for (let mediaIdx = 0; mediaIdx < entry.medias.length; mediaIdx++) {
            checkAbort();
            const media = entry.medias[mediaIdx];
            if (isValidMediaUrl(media.src)) {
              const isVideoOrYt = media.isVideo || media.src.includes("youtube.com") || media.src.includes("youtu.be");
              if (isVideoOrYt) {
                const shortcutName = `midia_anexa_${mediaIdx + 1}.html`;
                const existingShortcut = entryFolderItems.find((item) => item.name === shortcutName || item.name === `video_youtube_${mediaIdx + 1}.txt` || item.name === `midia_anexa_${mediaIdx + 1}.txt`);
                const prevMedia = prevEntry?.medias?.[mediaIdx];
                const mediaChanged = !prevMedia || prevMedia.src !== media.src;

                if (!existingShortcut || mediaChanged) {
                  youtubeVideos.push({
                    gameName: game.name,
                    title: `Vídeo Anexo #${mediaIdx + 1}`,
                    url: media.src,
                    expectedFilename: shortcutName,
                  });

                  report(`Salvando atalho do vídeo do YouTube em "${entryFolderName}"...`);
                  const { blob: htmlBlob } = createYoutubeHtmlShortcut(media.src, game.name, entry.period);
                  await uploadOrUpdateFile(shortcutName, "text/html", htmlBlob, entryFolderId, existingShortcut?.id);
                  uploadedItems.push({ game: game.name, file: `${entryFolderName}/${shortcutName}`, type: "Atalho YouTube", status: existingShortcut ? "Atualizado" : "Novo" });
                } else {
                  report(`Atalho do vídeo do YouTube já salvo.`);
                }
              } else {
                const mediaName = `midia_anexa_${mediaIdx + 1}.webp`;
                const existingMedia = entryFolderItems.find((item) => item.name === mediaName);
                const prevMedia = prevEntry?.medias?.[mediaIdx];
                const mediaChanged = !prevMedia || prevMedia.src !== media.src;

                if (!existingMedia || mediaChanged) {
                  report(`Salvando imagem do diário de ${game.name} (${mediaIdx + 1}/${entry.medias.length})...`);
                  try {
                    const blob = await urlToBlob(media.src);
                    if (blob) {
                      const webpBlob = await convertBlobToWebp(blob);
                      checkAbort();
                      await uploadOrUpdateFile(mediaName, "image/webp", webpBlob, entryFolderId, existingMedia?.id);
                      uploadedItems.push({ game: game.name, file: `${entryFolderName}/${mediaName}`, type: "Mídia WebP", status: existingMedia ? "Atualizado" : "Novo" });
                    }
                  } catch (e: any) {
                    backupErrors.push(`Erro ao salvar mídia de ${game.name} em ${entryFolderName}: ${e.message || e}`);
                  }
                } else {
                  report(`Imagem (${mediaIdx + 1}/${entry.medias.length}) já está salva no Drive.`);
                }
              }
            } else {
              report(`Mídia inválida ignorada.`);
            }
          }
        }
      }
    }

    // Final step: Upload updated master database json
    checkAbort();
    report("Finalizando e salvando arquivo mestre dados_biblioteca.json...");
    await uploadOrUpdateFile("dados_biblioteca.json", "application/json", jsonContent, rootFolderId, masterJsonItem?.id);
    uploadedItems.push({ game: "Biblioteca", file: "dados_biblioteca.json", type: "Texto Diário", status: masterJsonItem ? "Atualizado" : "Novo" });

    // Generate styled PDF Report
    const reportData: PDFReportData = {
      backupType: "Geral (Biblioteca Completa)",
      timestamp: new Date().toLocaleString("pt-BR"),
      stats: {
        totalGamesProcessed: games.length,
        syncedGamesCount: changedCount,
        skippedGamesCount: skippedCount,
        filesUploadedCount: uploadedItems.length,
      },
      uploadedItems,
      youtubeVideos,
      obsoleteItemsForManualDelete,
      errors: backupErrors,
    };

    try {
      generateBackupPDFReport(reportData);
    } catch (pdfErr) {
      console.error("Erro ao gerar relatório PDF:", pdfErr);
    }

    if (obsoleteItemsForManualDelete.length > 0) {
      setTimeout(() => {
        alert(
          `Sincronização do Google Drive concluída!\n\n` +
          `Atenção: Foram identificados ${obsoleteItemsForManualDelete.length} item(ns) obsoleto(s) no seu Google Drive (jogos ou diários excluídos no site).\n\n` +
          `Para sua segurança, o site não apaga nada no Drive automaticamente. O relatório PDF baixado contém a lista completa destes arquivos para você remover manualmente se desejar.`
        );
      }, 500);
    }

    if (changedCount === 0) {
      onProgress?.("Backup concluído! Todos os jogos já estavam 100% atualizados no Google Drive.", totalSteps, totalSteps);
    } else {
      onProgress?.(`Backup concluído com sucesso! (${changedCount} jogo(s) sincronizado(s), ${skippedCount} sem alterações)`, totalSteps, totalSteps);
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
 * Uploads a single media directly to Google Drive into its game/entry folder as an immediate backup during upload.
 */
export async function uploadSingleMediaBackup(
  fileOrBase64: File | string,
  folderType: "covers" | "icons" | "diary",
  fileName: string,
  gameName?: string,
  entryDetails?: { entryId: string; period?: string; mediaIndex?: number },
  signal?: AbortSignal
): Promise<string | null> {
  if (!isDriveAuthenticated()) {
    return null; // Skip if Google Drive is not connected
  }

  try {
    await checkDrivePauseAndAbort(signal);

    const rootFolderId = await getOrCreateFolder("Biblioteca_Jogos_Backup");
    let targetFolderId = rootFolderId;

    if (gameName) {
      const gameFolderId = await getOrCreateFolder(gameName, rootFolderId);
      if (folderType === "diary" && entryDetails?.entryId) {
        const { startDateYMD, formattedRange } = getFormattedPeriodAndDate(entryDetails.period || "");
        const entryFolderName = `[${startDateYMD}] Diário (${formattedRange}) - ${entryDetails.entryId}`;
        targetFolderId = await getOrCreateDiaryEntryFolder(entryFolderName, entryDetails.entryId, gameFolderId);
      } else {
        targetFolderId = gameFolderId;
      }
    }

    let blob: Blob;
    let mimeType = "image/jpeg";

    if (fileOrBase64 instanceof File) {
      blob = fileOrBase64;
      mimeType = fileOrBase64.type || (isVideoFile(fileOrBase64) ? getVideoMimeType(fileOrBase64) : "image/jpeg");
    } else {
      const response = await fetch(fileOrBase64);
      blob = await response.blob();
      mimeType = blob.type || (isVideoFile({ name: fileName }) ? getVideoMimeType({ name: fileName }) : "image/jpeg");
    }

    const isVid = isVideoFile({ name: fileName, type: mimeType }) || typeof fileOrBase64 === "string" && (fileOrBase64.includes("youtube.com") || fileOrBase64.includes("youtu.be"));
    const isImg = isImageFile({ name: fileName, type: mimeType });
    let targetFileName = fileName;

    if (folderType === "covers") {
      targetFileName = "capa.webp";
    } else if (folderType === "icons") {
      targetFileName = "icone.webp";
    }

    if (isVid) {
      // Create HTML redirect shortcut for video backups on Drive
      const youtubeUrl = typeof fileOrBase64 === "string" && fileOrBase64.startsWith("http") ? fileOrBase64 : "";
      const { blob: htmlBlob } = createYoutubeHtmlShortcut(youtubeUrl, gameName);
      blob = htmlBlob;
      mimeType = "text/html";
      if (folderType === "diary" && entryDetails?.mediaIndex) {
        targetFileName = `midia_anexa_${entryDetails.mediaIndex}.html`;
      } else {
        targetFileName = `midia_anexa_1.html`;
      }
    } else if (isImg && mimeType !== "image/gif") {
      blob = await convertBlobToWebp(blob);
      mimeType = "image/webp";
      if (folderType === "diary" && entryDetails?.mediaIndex) {
        targetFileName = `midia_anexa_${entryDetails.mediaIndex}.webp`;
      } else if (folderType !== "covers" && folderType !== "icons") {
        const lastDotIndex = targetFileName.lastIndexOf(".");
        targetFileName = lastDotIndex !== -1 ? targetFileName.substring(0, lastDotIndex) + ".webp" : targetFileName + ".webp";
      }
    }

    const fileId = await uploadOrUpdateFile(targetFileName, mimeType, blob, targetFolderId);
    
    addBackupLog({
      provider: "Google Drive",
      action: isVid ? "Atalho HTML Vídeo" : "Upload Mídia WebP",
      status: "success",
      gameName,
      details: `Arquivo ${targetFileName} (${(blob.size / 1024).toFixed(1)} KB) salvo no Drive.`
    });

    return fileId;
  } catch (err: any) {
    console.error("Falha ao enviar backup de mídia para o Google Drive:", err);
    addBackupLog({
      provider: "Google Drive",
      action: "Upload Mídia Backup",
      status: "error",
      gameName,
      details: `Erro ao enviar ${fileName}: ${err.message || err}`
    });
    return null;
  }
}

/**
 * Deep backup method for a single game: Forces an exhaustive verification of every cover,
 * icon, diary entry text, and media attachment for this specific game in Google Drive.
 */
export async function backupSingleGameToDriveDeep(
  game: Game,
  allGames: Game[],
  globalTags: string[],
  globalGenres: string[],
  onProgress?: (msg: string, completedSteps?: number, totalSteps?: number) => void,
  signal?: AbortSignal
): Promise<void> {
  if (signal) {
    activeBackupSignal = signal;
  }

  try {
    if (!isDriveAuthenticated()) {
      throw new Error("Não conectado ao Google Drive.");
    }

    const sortedDiary = game.diary ? [...game.diary].sort((a, b) => parsePeriodStartDate(a.period) - parsePeriodStartDate(b.period)) : [];
    const totalDiaryMedias = sortedDiary.reduce((sum, d) => sum + (d.medias ? d.medias.length : 0), 0);

    let totalSteps = 4; // 1: Session check, 2: Folders check, 3: Read previous json, 4: dados_jogo.json update
    if (isValidMediaUrl(game.cover)) totalSteps += 1;
    if (isValidMediaUrl(game.icon) && (game.iconType === "upload" || game.iconType === "url")) totalSteps += 1;
    totalSteps += sortedDiary.length; // diary text files
    totalSteps += totalDiaryMedias; // diary media attachments
    totalSteps += 1; // master dados_biblioteca.json update

    let completedSteps = 0;
    const report = (msg: string, stepIncrement = 1) => {
      completedSteps = Math.min(completedSteps + stepIncrement, totalSteps);
      onProgress?.(msg, completedSteps, totalSteps);
    };

    if (tokenTimestamp > 0 && Date.now() - tokenTimestamp > 45 * 60 * 1000) {
      report("Renovando sessão do Google Drive...", 0);
      try {
        await refreshDriveToken();
      } catch (err) {
        console.warn("Aviso ao renovar token:", err);
      }
    }

    const checkAbort = () => {
      if (activeBackupSignal?.aborted) {
        throw new DOMException("Backup cancelado pelo usuário", "AbortError");
      }
    };

    checkAbort();
    report(`Iniciando backup profundo de "${game.name}"...`);
    const rootFolderId = await getOrCreateFolder("Biblioteca_Jogos_Backup");

    checkAbort();
    const gameFolderId = await getOrCreateFolder(game.name, rootFolderId);
    const gameFolderItems = await listFilesAndFoldersInParent(gameFolderId);

    const uploadedItems: PDFReportData["uploadedItems"] = [];
    const youtubeVideos: PDFReportData["youtubeVideos"] = [];
    const obsoleteItemsForManualDelete: PDFReportData["obsoleteItemsForManualDelete"] = [];
    const backupErrors: string[] = [];

    const gameToSave = { ...game, diary: sortedDiary };
    const gameJsonItem = gameFolderItems.find((item) => item.name === "dados_jogo.json");

    // Retrieve previous game state stored in Drive if available to compare media changes
    let drivePreviousGame: Game | null = null;
    if (gameJsonItem) {
      try {
        const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${gameJsonItem.id}?alt=media`);
        drivePreviousGame = await res.json();
      } catch (err) {
        console.warn("Não foi possível ler dados_jogo.json anterior do Drive para comparação:", err);
      }
    }
    report("Metadados e arquivos do Drive verificados.");

    // 1. Force upload/update of dados_jogo.json
    checkAbort();
    report(`Atualizando metadados de "${game.name}"...`);
    const gameJsonContent = JSON.stringify(gameToSave, null, 2);
    await uploadOrUpdateFile("dados_jogo.json", "application/json", gameJsonContent, gameFolderId, gameJsonItem?.id);
    uploadedItems.push({ game: game.name, file: "dados_jogo.json", type: "Texto Diário", status: gameJsonItem ? "Atualizado" : "Novo" });

    // 2. Deep check cover
    checkAbort();
    const capaItem = gameFolderItems.find((item) => item.name === "capa.webp");
    if (isValidMediaUrl(game.cover)) {
      const coverChanged = !drivePreviousGame || drivePreviousGame.cover !== game.cover;
      if (!capaItem || coverChanged) {
        report(`Enviando capa de "${game.name}" para o Drive...`);
        try {
          const blob = await urlToBlob(game.cover);
          if (blob) {
            const webpBlob = await convertBlobToWebp(blob);
            checkAbort();
            await uploadOrUpdateFile("capa.webp", "image/webp", webpBlob, gameFolderId, capaItem?.id);
            uploadedItems.push({ game: game.name, file: "capa.webp", type: "Capa WebP", status: capaItem ? "Atualizado" : "Novo" });
          }
        } catch (e: any) {
          backupErrors.push(`Erro ao salvar capa de ${game.name}: ${e.message || e}`);
        }
      } else {
        report(`Capa de "${game.name}" já está salva no Drive.`);
      }
    } else if (!game.cover && capaItem) {
      obsoleteItemsForManualDelete.push({ gameName: game.name, itemName: "capa.webp", itemType: "Mídia Desassociada" });
    }

    // 3. Deep check icon
    checkAbort();
    const iconeItem = gameFolderItems.find((item) => item.name === "icone.webp");
    if (isValidMediaUrl(game.icon) && (game.iconType === "upload" || game.iconType === "url")) {
      const iconChanged = !drivePreviousGame || drivePreviousGame.icon !== game.icon || drivePreviousGame.iconType !== game.iconType;
      if (!iconeItem || iconChanged) {
        report(`Enviando ícone de "${game.name}" para o Drive...`);
        try {
          const blob = await urlToBlob(game.icon);
          if (blob) {
            const webpBlob = await convertBlobToWebp(blob);
            checkAbort();
            await uploadOrUpdateFile("icone.webp", "image/webp", webpBlob, gameFolderId, iconeItem?.id);
            uploadedItems.push({ game: game.name, file: "icone.webp", type: "Ícone WebP", status: iconeItem ? "Atualizado" : "Novo" });
          }
        } catch (e: any) {
          backupErrors.push(`Erro ao salvar ícone de ${game.name}: ${e.message || e}`);
        }
      } else {
        report(`Ícone de "${game.name}" já está salvo no Drive.`);
      }
    } else if ((!game.icon || (game.iconType !== "upload" && game.iconType !== "url")) && iconeItem) {
      obsoleteItemsForManualDelete.push({ gameName: game.name, itemName: "icone.webp", itemType: "Mídia Desassociada" });
    }

    // 4. Deep check diary entries and media attachments
    const activeFolderNames = sortedDiary.map((entry) => {
      const { startDateYMD, formattedRange } = getFormattedPeriodAndDate(entry.period);
      return `[${startDateYMD}] Diário (${formattedRange}) - ${entry.id}`;
    });

    checkAbort();
    // Clean up obsolete subfolders inside gameFolderId
    for (const item of gameFolderItems) {
      if (item.mimeType === "application/vnd.google-apps.folder") {
        const is9999Folder = item.name === "9999" || item.name.includes("9999") || item.name.startsWith("[9999");
        if (is9999Folder) {
          report(`[GoogleDrive Cleanup] Excluindo pasta legada '9999' em ${game.name}: "${item.name}"...`);
          console.log(`[GoogleDrive Backup Path] Biblioteca_Jogos_Backup > ${game.name} > Limpeza automatica -> Removendo ${item.name}`);
          addBackupLog({
            provider: "Google Drive",
            action: "Limpeza de Pasta Legada 9999",
            status: "success",
            gameName: game.name,
            details: `Pasta legada de diário '9999' (${item.name}) removida de ${game.name}.`,
          });
          try {
            await deleteFileOrFolder(item.id);
          } catch (e) {
            console.warn(`Erro ao remover pasta legada 9999 (${item.name}):`, e);
          }
          continue;
        }

        // Clean up obsolete 0000-00-00 temporary duplicate folders
        const is0000Folder = item.name.includes("0000-00-00") || item.name.startsWith("[0000");
        if (is0000Folder && !activeFolderNames.includes(item.name)) {
          report(`[GoogleDrive Cleanup] Limpando pasta temporária duplicada '0000' em ${game.name}: "${item.name}"...`);
          console.log(`[GoogleDrive Backup Path] Biblioteca_Jogos_Backup > ${game.name} > Limpeza automatica -> Removendo ${item.name}`);
          addBackupLog({
            provider: "Google Drive",
            action: "Limpeza de Pasta Duplicada 0000",
            status: "success",
            gameName: game.name,
            details: `Pasta temporária duplicada '0000-00-00' (${item.name}) removida de ${game.name}.`,
          });
          try {
            await deleteFileOrFolder(item.id);
          } catch (del0000Err) {
            console.warn(`Erro ao remover pasta duplicada 0000 (${item.name}):`, del0000Err);
          }
          continue;
        }

        const isOldFormat = item.name.startsWith("Entrada ");
        const isTempFolder = ["Capas_Temp", "Icones_Temp", "Diario_Temp", "Midias_Diario"].includes(item.name);
        const isNewFormatAndObsolete = (item.name.startsWith("[") || item.name.includes("Diário")) && !activeFolderNames.includes(item.name);

        if (isOldFormat || isTempFolder || isNewFormatAndObsolete) {
          obsoleteItemsForManualDelete.push({
            gameName: game.name,
            itemName: item.name,
            itemType: isTempFolder ? "Pasta Temporária Obsoleta" : "Entrada de Diário Removida",
          });
        }
      }
    }

    for (let entryIdx = 0; entryIdx < sortedDiary.length; entryIdx++) {
      checkAbort();
      const entry = sortedDiary[entryIdx];
      const { startDateYMD, formattedRange } = getFormattedPeriodAndDate(entry.period);
      const entryFolderName = `[${startDateYMD}] Diário (${formattedRange}) - ${entry.id}`;

      const fullPath = `Biblioteca_Jogos_Backup > ${game.name} > ${entryFolderName}`;
      console.log(`[GoogleDrive Backup Path] ${fullPath}`);
      addBackupLog({
        provider: "Google Drive",
        action: "Verificação de Pasta de Diário",
        status: "success",
        gameName: game.name,
        details: `Caminho da pasta no Drive: ${fullPath}`,
      });

      const entryFolderId = await getOrCreateDiaryEntryFolder(entryFolderName, entry.id, gameFolderId);
      const entryFolderItems = await listFilesAndFoldersInParent(entryFolderId);

      checkAbort();
      // Text file
      const txtFileName = "texto_entrada.txt";
      const txtContent = `==================================================\nDIÁRIO DE JOGATINA - ${game.name.toUpperCase()}\n==================================================\nEntrada: #${entryIdx + 1}\nPeríodo: ${entry.period || "Não especificado"}\n==================================================\n\n${stripHtml(entry.text || "")}\n\n==================================================\nGerado automaticamente via Biblioteca do Haleck\n==================================================`;
      const txtItem = entryFolderItems.find((item) => item.name === txtFileName);

      const prevEntry = drivePreviousGame?.diary?.find((d: any) => d.id === entry.id);
      const prevEntryIdx = drivePreviousGame?.diary ? drivePreviousGame.diary.findIndex((d: any) => d.id === entry.id) : -1;
      const textChanged = !prevEntry || prevEntry.text !== entry.text || prevEntry.period !== entry.period || prevEntryIdx !== entryIdx;

      if (!txtItem || textChanged) {
        report(`Atualizando texto do diário (${entryIdx + 1}/${sortedDiary.length})...`);
        await uploadOrUpdateFile(txtFileName, "text/plain", txtContent, entryFolderId, txtItem?.id);
        uploadedItems.push({ game: game.name, file: `${entryFolderName}/${txtFileName}`, type: "Texto Diário", status: txtItem ? "Atualizado" : "Novo" });
      } else {
        report(`Texto do diário (${entryIdx + 1}/${sortedDiary.length}) já está atualizado.`);
      }

      // Media files
      const expectedMediaNames = new Set<string>();
      if (entry.medias && entry.medias.length > 0) {
        entry.medias.forEach((media, mIdx) => {
          const idxStr = mIdx + 1;
          const isVid = media.isVideo || (media.src && (media.src.includes("youtube.com") || media.src.includes("youtu.be")));
          if (isVid) {
            expectedMediaNames.add(`midia_anexa_${idxStr}.html`);
            expectedMediaNames.add(`midia_anexa_${idxStr}.txt`);
            expectedMediaNames.add(`video_youtube_${idxStr}.txt`);
          } else {
            expectedMediaNames.add(`midia_anexa_${idxStr}.webp`);
          }
        });
      }

      // Cleanup deleted or obsolete media files
      for (const item of entryFolderItems) {
        const isMediaFile = item.name.startsWith("midia_anexa_") || item.name.startsWith("video_anexo_") || item.name.startsWith("video_youtube_");
        if (isMediaFile && !expectedMediaNames.has(item.name)) {
          obsoleteItemsForManualDelete.push({
            gameName: game.name,
            itemName: `${entryFolderName}/${item.name}`,
            itemType: "Mídia Desassociada",
          });
        }
      }

      // Upload missing or modified media files
      if (entry.medias && entry.medias.length > 0) {
        for (let mediaIdx = 0; mediaIdx < entry.medias.length; mediaIdx++) {
          checkAbort();
          const media = entry.medias[mediaIdx];
          if (isValidMediaUrl(media.src)) {
            const prevMedia = prevEntry?.medias?.[mediaIdx];
            const mediaChanged = !prevMedia || prevMedia.src !== media.src;

            if (media.isVideo || media.src.includes("youtube.com") || media.src.includes("youtu.be")) {
              const shortcutName = `midia_anexa_${mediaIdx + 1}.html`;
              const existingShortcut = entryFolderItems.find((item) => item.name === shortcutName || item.name === `video_youtube_${mediaIdx + 1}.txt` || item.name === `midia_anexa_${mediaIdx + 1}.txt`);

              if (!existingShortcut || mediaChanged) {
                youtubeVideos.push({
                  gameName: game.name,
                  title: `Vídeo Anexo #${mediaIdx + 1}`,
                  url: media.src,
                  expectedFilename: shortcutName,
                });

                report(`Salvando atalho do vídeo no Drive (${mediaIdx + 1}/${entry.medias.length})...`);
                const { blob: htmlBlob } = createYoutubeHtmlShortcut(media.src, game.name, entry.period);
                await uploadOrUpdateFile(shortcutName, "text/html", htmlBlob, entryFolderId, existingShortcut?.id);
                uploadedItems.push({ game: game.name, file: `${entryFolderName}/${shortcutName}`, type: "Atalho YouTube", status: existingShortcut ? "Atualizado" : "Novo" });
                addBackupLog({
                  provider: "Google Drive",
                  action: "Atalho HTML Vídeo",
                  status: "success",
                  gameName: game.name,
                  details: `Atalho ${shortcutName} para ${media.src} criado no Drive.`
                });
              } else {
                report(`Atalho HTML do vídeo (${mediaIdx + 1}/${entry.medias.length}) já está salvo.`);
              }
            } else {
              const mediaName = `midia_anexa_${mediaIdx + 1}.webp`;
              const existingMedia = entryFolderItems.find((item) => item.name === mediaName);
              if (!existingMedia || mediaChanged) {
                report(`Enviando imagem original WebP (${mediaIdx + 1}/${entry.medias.length})...`);
                try {
                  const blob = await urlToBlob(media.src);
                  if (blob) {
                    const webpBlob = await convertBlobToWebp(blob);
                    checkAbort();
                    await uploadOrUpdateFile(mediaName, "image/webp", webpBlob, entryFolderId, existingMedia?.id);
                    uploadedItems.push({ game: game.name, file: `${entryFolderName}/${mediaName}`, type: "Mídia WebP", status: existingMedia ? "Atualizado" : "Novo" });
                    addBackupLog({
                      provider: "Google Drive",
                      action: "Upload Mídia WebP",
                      status: "success",
                      gameName: game.name,
                      details: `Mídia ${mediaName} (${(webpBlob.size / 1024).toFixed(1)} KB) salva no Drive.`
                    });
                  }
                } catch (e: any) {
                  backupErrors.push(`Erro ao salvar mídia de ${game.name} em ${entryFolderName}: ${e.message || e}`);
                  addBackupLog({
                    provider: "Google Drive",
                    action: "Upload Mídia WebP",
                    status: "error",
                    gameName: game.name,
                    details: `Erro em ${mediaName}: ${e.message || e}`
                  });
                }
              } else {
                report(`Imagem (${mediaIdx + 1}/${entry.medias.length}) já está salva no Drive.`);
              }
            }
          } else {
            report(`Mídia inválida ignorada.`);
          }
        }
      }
    }

    // 5. Update master dados_biblioteca.json in root folder
    checkAbort();
    report(`Atualizando arquivo mestre no Drive...`);
    const rootItems = await listFilesAndFoldersInParent(rootFolderId);
    const masterJsonItem = rootItems.find((i) => i.name === "dados_biblioteca.json");

    const updatedGamesList = allGames.map((g) => (g.id === game.id ? gameToSave : g));
    const backupData = {
      games: updatedGamesList.map((g) => ({
        ...g,
        diary: g.diary ? [...g.diary].sort((a, b) => parsePeriodStartDate(a.period) - parsePeriodStartDate(b.period)) : [],
      })),
      globalTags,
      globalGenres,
      backedUpAt: new Date().toISOString(),
    };
    const jsonContent = JSON.stringify(backupData, null, 2);
    await uploadOrUpdateFile("dados_biblioteca.json", "application/json", jsonContent, rootFolderId, masterJsonItem?.id);
    uploadedItems.push({ game: game.name, file: "dados_biblioteca.json", type: "Texto Diário", status: masterJsonItem ? "Atualizado" : "Novo" });

    // Generate styled PDF Report for single game deep backup
    const reportData: PDFReportData = {
      backupType: "Profundo (Jogo Individual)",
      gameName: game.name,
      timestamp: new Date().toLocaleString("pt-BR"),
      stats: {
        totalGamesProcessed: 1,
        syncedGamesCount: 1,
        skippedGamesCount: 0,
        filesUploadedCount: uploadedItems.length,
      },
      uploadedItems,
      youtubeVideos,
      obsoleteItemsForManualDelete,
      errors: backupErrors,
    };

    try {
      generateBackupPDFReport(reportData);
    } catch (pdfErr) {
      console.error("Erro ao gerar relatório PDF:", pdfErr);
    }

    if (obsoleteItemsForManualDelete.length > 0) {
      setTimeout(() => {
        alert(
          `Backup de "${game.name}" concluído!\n\n` +
          `Atenção: Foram identificados ${obsoleteItemsForManualDelete.length} item(ns) obsoleto(s) no seu Google Drive para este jogo.\n\n` +
          `O relatório PDF baixado contém a lista completa destes arquivos para remoção manual se desejar.`
        );
      }, 500);
    }

    onProgress?.(`Backup profundo de "${game.name}" concluído com sucesso!`, totalSteps, totalSteps);
  } finally {
    activeBackupSignal = null;
  }
}
