/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { compressImageToWebP } from "./mediaWorker";
import { showToast } from "./toast";

const env = (import.meta as any).env || {};
// Primary default key provided by the user
const IMGBB_API_KEY = env.VITE_IMGBB_API_KEY || "d07333dc40c5b1fe0f66d09fa89b5d16";

// Dedicated pool of keys for load balancing and rate-limit rotation
const USER_IMGBB_KEYS = [
  "d07333dc40c5b1fe0f66d09fa89b5d16",
  "14cb1f70bff72d67fc860a47350c78f6",
  "417e3c8ef8818541b71a8b95d68b57e9",
  "7f8dee027277949a5586e9185d278c4b",
];

const LEGACY_FALLBACK_KEYS = [
  "34add11536701ed08c43cbc6cde2f6bf",
  "eb752d15c3cb1ed336abd69821bc4129",
  "8a4ef757a3e811f5bb2b4505372338d4",
  "c345330a5991ee7eebf0b691238ebf5c",
  "6d257f6977864e8354c0e64c4c95d9e5",
  "010a301ec9c792942bf9e0f6cbfbb740",
];

let clientRotationIndex = 0;

/**
 * Helper to sanitize filenames to be safe for URLs/ImgBB.
 */
function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD") // Decompose accents
    .replace(/[\u0300-\u036f]/g, "") // Remove accent characters
    .replace(/[^a-zA-Z0-9_\-]/g, "_") // Replace non-alphanumeric with underscore
    .replace(/_+/g, "_") // Consolidate multiple underscores
    .replace(/^_+|_+$/g, "") // Trim leading/trailing underscores
    .trim();
}

/**
 * Compresses an image source (File or base64) using canvas to keep local storage footprint lightweight.
 * If the image is ALREADY a WebP file/data-uri and within max dimension boundaries, it bypasses canvas re-compression completely to preserve 100% of the original quality and speed up uploads.
 */
async function compressImage(imageSource: File | string, maxWidth = 16384, maxHeight = 16384): Promise<string> {
  const { dataUrl } = await compressImageToWebP(imageSource, 1.0, maxWidth, maxHeight);
  return dataUrl || (typeof imageSource === "string" ? imageSource : "");
}

/**
 * Helper to get or set custom user ImgBB API key stored in browser localStorage
 */
export function getCustomImgBBKey(): string {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return (localStorage.getItem("imgbb_custom_api_key") || "").trim();
    }
  } catch {
    // Ignore storage errors
  }
  return "";
}

export function setCustomImgBBKey(key: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const trimmed = key.trim();
      if (trimmed) {
        localStorage.setItem("imgbb_custom_api_key", trimmed);
      } else {
        localStorage.removeItem("imgbb_custom_api_key");
      }
    }
  } catch {
    // Ignore storage errors
  }
}

export interface ImgBBUploadResponse {
  url: string;
  deleteUrl?: string;
}

// In-memory & Session storage cache to prevent duplicate uploads to ImgBB
const uploadCacheMap = new Map<string, ImgBBUploadResponse>();

/**
 * Computes a unique signature for a File object or base64 string to detect duplicate files.
 */
export function getFileSignature(source: File | string): string {
  if (typeof source === "string") {
    if (source.length <= 256) return source;
    return `str_${source.length}_${source.slice(0, 48)}_${source.slice(-48)}`;
  }
  // File signature combines name, size, and last modified date
  return `file_${source.name.replace(/[^a-zA-Z0-9_\-.]/g, "_")}_${source.size}_${source.lastModified}`;
}

export function getCachedImgBBResponseBySignature(sig: string): ImgBBUploadResponse | null {
  if (uploadCacheMap.has(sig)) {
    return uploadCacheMap.get(sig)!;
  }
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const savedSigs = localStorage.getItem("imgbb_file_signatures");
      if (savedSigs) {
        const parsed = JSON.parse(savedSigs);
        if (parsed[sig]) {
          return parsed[sig] as ImgBBUploadResponse;
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function setCachedImgBBResponseBySignature(sig: string, res: ImgBBUploadResponse) {
  uploadCacheMap.set(sig, res);
  saveCacheToSession();
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const savedSigs = localStorage.getItem("imgbb_file_signatures");
      const parsed = savedSigs ? JSON.parse(savedSigs) : {};
      parsed[sig] = res;
      localStorage.setItem("imgbb_file_signatures", JSON.stringify(parsed));
    }
  } catch {
    // ignore
  }
}

function getImageKey(source: string): string {
  if (source.length <= 256) return source;
  // Use length + prefix + suffix signature for fast caching
  return `${source.length}_${source.slice(0, 64)}_${source.slice(-64)}`;
}

// Try restoring cache from localStorage on load
try {
  if (typeof window !== "undefined" && window.localStorage) {
    const savedCache = localStorage.getItem("imgbb_upload_cache") || sessionStorage.getItem("imgbb_upload_cache");
    if (savedCache) {
      const parsed = JSON.parse(savedCache);
      Object.entries(parsed).forEach(([k, v]) => uploadCacheMap.set(k, v as ImgBBUploadResponse));
    }
  }
} catch {
  // Ignore storage errors
}

function saveCacheToSession() {
  try {
    if (typeof window !== "undefined") {
      const obj: Record<string, ImgBBUploadResponse> = {};
      uploadCacheMap.forEach((val, key) => {
        obj[key] = val;
      });
      const serialized = JSON.stringify(obj);
      if (window.localStorage) {
        localStorage.setItem("imgbb_upload_cache", serialized);
      }
      if (window.sessionStorage) {
        sessionStorage.setItem("imgbb_upload_cache", serialized);
      }
    }
  } catch {
    // Ignore
  }
}

// Queue of pending upload tasks
type UploadTask = {
  imageSource: File | string;
  customName?: string;
  signal?: AbortSignal;
  resolve: (value: ImgBBUploadResponse) => void;
  reject: (reason: any) => void;
};

const uploadQueue: UploadTask[] = [];
let isProcessingQueue = false;
const QUEUE_DELAY_MS = 600; // 600ms delay between batch workers

// Helper delay function
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function dataURItoBlob(dataURI: string): Blob {
  try {
    const isDataURI = dataURI.includes("base64,");
    const rawBase64 = isDataURI ? dataURI.split("base64,")[1] : dataURI;
    const mimeString = isDataURI
      ? dataURI.split("base64,")[0].split(":")[1]?.split(";")[0] || "image/png"
      : "image/png";

    const byteString = atob(rawBase64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  } catch {
    return new Blob([dataURI], { type: "image/png" });
  }
}

/**
 * Converts imageSource (File or string) to base64 or Data URI string
 */
async function getImageAsBase64(imageSource: File | string): Promise<string> {
  if (typeof imageSource === "string") {
    return imageSource;
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(imageSource);
  });
}

// Map for deduplicating in-flight upload promises
const inFlightUploadsMap = new Map<string, Promise<ImgBBUploadResponse>>();

/**
 * Execute the upload of an image with retry mechanism and backoff if rate limits are hit.
 */
async function executeUploadWithRetry(
  imageSource: File | string,
  customName?: string,
  attempt = 1,
  maxAttempts = 4,
  signal?: AbortSignal
): Promise<ImgBBUploadResponse> {
  if (signal?.aborted) {
    throw new DOMException("Upload ImgBB cancelado pelo usuário", "AbortError");
  }

  // If imageSource is already a remote URL, bypass upload completely!
  if (
    typeof imageSource === "string" &&
    (imageSource.startsWith("http://") ||
      imageSource.startsWith("https://") ||
      imageSource.startsWith("//"))
  ) {
    console.log(`[ImgBB Bypass] Imagem já está hospedada na web (${imageSource.substring(0, 60)}...). Retornando URL direta.`);
    return { url: imageSource };
  }

  // FAST CHECK: Signature verification by filename, size, and date before processing
  const fileSig = getFileSignature(imageSource);
  const sigCached = getCachedImgBBResponseBySignature(fileSig);
  if (sigCached) {
    console.log(`[ImgBB Signature Cache] Arquivo já enviado anteriormente (${fileSig}). Reutilizando URL ImgBB: ${sigCached.url}`);
    showToast({
      title: "Imagem Reconhecida do Cache",
      message: `A imagem "${typeof imageSource === "object" ? imageSource.name : "enviada"}" já havia sido hospedada anteriormente no ImgBB. URL original reutilizada!`,
      type: "info",
      duration: 3500,
    });
    return sigCached;
  }

  const customUserKey = getCustomImgBBKey();

  // Convert and compress image to high-quality WebP (preserving 100% natural resolution up to 16k)
  let base64Str = await getImageAsBase64(imageSource);
  if (base64Str.startsWith("data:image/")) {
    base64Str = await compressImage(base64Str, 16384, 16384);
  }

  // Check cache first before making any network requests
  const cacheKey = getImageKey(base64Str);
  if (uploadCacheMap.has(cacheKey)) {
    const cached = uploadCacheMap.get(cacheKey)!;
    console.log(`[ImgBB Cache] Imagem já enviada anteriormente. Retornando da memória: ${cached.url}`);
    showToast({
      title: "Imagem Já Enviada (ImgBB)",
      message: `Imagem identificada no cache do ImgBB. O URL original foi reutilizado automaticamente!`,
      type: "info",
      duration: 4000,
    });
    return cached;
  }

  const sanitizedName = customName ? sanitizeFilename(customName) : "image";

  console.log(`[ImgBB Queue] Tentativa ${attempt} de ${maxAttempts} enviando mídia (${sanitizedName})...`);

  // 1. Primary path: Use our backend proxy route (/api/upload-imgbb)
  try {
    const res = await fetch("/api/upload-imgbb", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal,
      body: JSON.stringify({
        image: base64Str,
        name: sanitizedName,
        userApiKey: customUserKey,
      }),
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data?.url) {
      console.log(`[ImgBB Queue] Upload via servidor bem-sucedido! URL: ${data.url}`);
      const response: ImgBBUploadResponse = {
        url: data.url,
        deleteUrl: data.deleteUrl,
      };
      uploadCacheMap.set(cacheKey, response);
      setCachedImgBBResponseBySignature(fileSig, response);
      saveCacheToSession();
      return response;
    }

    const serverErrMsg = data?.error || data?.details || `HTTP ${res.status}`;
    const isRateLimit =
      res.status === 429 ||
      data?.rateLimit ||
      (data?.error && data.error.toLowerCase().includes("rate limit")) ||
      (data?.error && data.error.toLowerCase().includes("limite"));

    if (isRateLimit && attempt < maxAttempts) {
      const backoffDelay = attempt * 5000; // 5s, 10s, 15s backoff
      console.warn(`[ImgBB Queue] Rate limit detectado (tentativa ${attempt}). Aguardando ${backoffDelay}ms para proteção da cota...`);
      await sleep(backoffDelay);
      return executeUploadWithRetry(imageSource, customName, attempt + 1, maxAttempts);
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    throw new Error(`Erro na API de upload: ${serverErrMsg}`);
  } catch (serverErr: any) {
    console.warn(`[ImgBB Queue] Servidor proxy não concluiu (tentativa ${attempt}):`, serverErr?.message || serverErr);

    // If server explicit custom message about fallback key or missing key, throw it directly
    if (
      serverErr?.message &&
      (serverErr.message.includes("chave pública padrão") || serverErr.message.includes("Configurações"))
    ) {
      throw serverErr;
    }

    // 2. Direct fallback to ImgBB API from browser if server route fails completely
    try {
      const clientKeys: string[] = [];
      if (customUserKey) clientKeys.push(customUserKey);

      // Rotate through user provided keys
      const userKeyCount = USER_IMGBB_KEYS.length;
      const offset = clientRotationIndex % userKeyCount;
      clientRotationIndex++;

      for (let i = 0; i < userKeyCount; i++) {
        const k = USER_IMGBB_KEYS[(offset + i) % userKeyCount];
        if (!clientKeys.includes(k)) clientKeys.push(k);
      }

      if (IMGBB_API_KEY && !clientKeys.includes(IMGBB_API_KEY)) clientKeys.push(IMGBB_API_KEY);

      LEGACY_FALLBACK_KEYS.forEach((fk) => {
        if (!clientKeys.includes(fk)) clientKeys.push(fk);
      });

      let lastDirectError = "";

      for (const directKey of clientKeys) {
        const formData = new FormData();
        const isWebP = base64Str.startsWith("data:image/webp");
        const ext = isWebP ? "webp" : "png";

        if (imageSource instanceof File) {
          formData.append("image", imageSource);
        } else {
          const imageBlob = dataURItoBlob(base64Str);
          formData.append("image", imageBlob, `${sanitizedName}.${ext}`);
        }
        formData.append("name", sanitizedName);

        try {
          const directRes = await fetch(`https://api.imgbb.com/1/upload?key=${directKey}`, {
            method: "POST",
            body: formData,
          });

          const directText = await directRes.text();
          let directPayload: any = null;
          try {
            directPayload = JSON.parse(directText);
          } catch {
            // ignore
          }

          if (directRes.ok && directPayload?.data) {
            const directUrl = directPayload.data.url || directPayload.data.image?.url || directPayload.data.display_url;
            if (directUrl) {
              const response: ImgBBUploadResponse = {
                url: directUrl,
                deleteUrl: directPayload.data.delete_url,
              };
              uploadCacheMap.set(cacheKey, response);
              setCachedImgBBResponseBySignature(fileSig, response);
              saveCacheToSession();
              return response;
            }
          }

          lastDirectError = directPayload?.error?.message || directText || `Status ${directRes.status}`;
        } catch (e: any) {
          lastDirectError = e?.message || "Erro de rede no upload direto";
        }
      }

      if (attempt < maxAttempts) {
        const backoffDelay = attempt * 5000;
        await sleep(backoffDelay);
        return executeUploadWithRetry(imageSource, customName, attempt + 1, maxAttempts);
      }

      throw new Error(`ImgBB Direct: ${lastDirectError}`);
    } catch (directErr: any) {
      if (attempt < maxAttempts) {
        const backoffDelay = attempt * 4000;
        await sleep(backoffDelay);
        return executeUploadWithRetry(imageSource, customName, attempt + 1, maxAttempts);
      }

      throw new Error(
        serverErr?.message ||
        directErr?.message ||
        "Ocorreu um erro ao fazer upload para o ImgBB. Para evitar exceder os limites, tente enviar menos imagens juntas ou aguarde alguns minutos."
      );
    }
  }
}

/**
 * Returns all direct ImgBB URLs stored in local/session upload cache
 */
export function getAllCachedImgBBUrls(): string[] {
  const urls: string[] = [];
  try {
    if (typeof window !== "undefined") {
      const savedCache = localStorage.getItem("imgbb_upload_cache") || sessionStorage.getItem("imgbb_upload_cache");
      if (savedCache) {
        const parsed = JSON.parse(savedCache);
        Object.values(parsed).forEach((val: any) => {
          if (val?.url && typeof val.url === "string" && val.url.startsWith("http")) {
            urls.push(val.url);
          }
        });
      }
    }
  } catch {
    // ignore
  }
  uploadCacheMap.forEach((val) => {
    if (val?.url && !urls.includes(val.url)) {
      urls.push(val.url);
    }
  });
  return urls;
}

let activeWorkers = 0;
const MAX_CONCURRENT_WORKERS = 3;

/**
 * Worker function to process queued upload tasks concurrently up to MAX_CONCURRENT_WORKERS.
 */
async function processQueue() {
  if (activeWorkers >= MAX_CONCURRENT_WORKERS) return;

  while (uploadQueue.length > 0 && activeWorkers < MAX_CONCURRENT_WORKERS) {
    const task = uploadQueue.shift();
    if (!task) continue;

    activeWorkers++;
    (async () => {
      try {
        const result = await executeUploadWithRetry(task.imageSource, task.customName, 1, 4, task.signal);
        task.resolve(result);
      } catch (err) {
        task.reject(err);
      } finally {
        activeWorkers--;
        if (uploadQueue.length > 0) {
          await sleep(QUEUE_DELAY_MS);
          processQueue();
        }
      }
    })();
  }
}

/**
 * Uploads an image file or base64 string to ImgBB and returns the public direct image URL and deletion URL.
 * Strictly requires a successful ImgBB upload to prevent filling up local browser storage with heavy base64 data.
 * Places requests into a sequential queue with sequential safety delays and automated retry logic.
 */
export async function uploadToImgBB(
  imageSource: File | string,
  customName?: string,
  attempt = 1,
  maxAttempts = 4,
  signal?: AbortSignal
): Promise<ImgBBUploadResponse> {
  if (signal?.aborted) {
    throw new DOMException("Upload ImgBB cancelado pelo usuário", "AbortError");
  }

  // Direct bypass for remote URLs
  if (
    typeof imageSource === "string" &&
    (imageSource.startsWith("http://") ||
      imageSource.startsWith("https://") ||
      imageSource.startsWith("//"))
  ) {
    return { url: imageSource };
  }

  // Deduplicate in-flight requests if exact same image string is passed
  let requestKey = "";
  if (typeof imageSource === "string") {
    requestKey = getImageKey(imageSource);
    if (inFlightUploadsMap.has(requestKey)) {
      console.log(`[ImgBB Deduplication] Upload do mesmo arquivo já em andamento. Compartilhando Promise existente.`);
      showToast({
        title: "Upload em Andamento",
        message: `Upload do mesmo arquivo já está sendo processado. Compartilhando requisição...`,
        type: "info",
        duration: 3500,
      });
      return inFlightUploadsMap.get(requestKey)!;
    }
  }

  const promise = new Promise<ImgBBUploadResponse>((resolve, reject) => {
    uploadQueue.push({ imageSource, customName, signal, resolve, reject });
    processQueue();
  });

  if (requestKey) {
    inFlightUploadsMap.set(requestKey, promise);
    promise.finally(() => {
      inFlightUploadsMap.delete(requestKey);
    });
  }

  return promise;
}
