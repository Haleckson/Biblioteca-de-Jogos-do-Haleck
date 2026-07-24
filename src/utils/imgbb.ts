/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const env = (import.meta as any).env || {};
// Fallback key provided by the user for immediate out-of-the-box operation
const IMGBB_API_KEY = env.VITE_IMGBB_API_KEY || "d112b9aaf62217ffd155269d04f96f6b";

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
 */
function compressImage(imageSource: File | string, maxWidth = 800, maxHeight = 800): Promise<string> {
  return new Promise((resolve) => {
    // Check if window and document are available (browser environment)
    if (typeof window === "undefined" || typeof document === "undefined") {
      if (typeof imageSource === "string") {
        resolve(imageSource);
      } else {
        resolve("");
      }
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(img.src);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      // Use jpeg with 0.7 quality to significantly compress the size (~40KB typical)
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };

    img.onerror = () => {
      if (typeof imageSource === "string") {
        resolve(imageSource);
      } else {
        resolve("");
      }
    };

    if (imageSource instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        resolve("");
      };
      reader.readAsDataURL(imageSource);
    } else {
      img.src = imageSource;
    }
  });
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

// Queue of pending upload tasks
type UploadTask = {
  imageSource: File | string;
  customName?: string;
  resolve: (value: ImgBBUploadResponse) => void;
  reject: (reason: any) => void;
};

const uploadQueue: UploadTask[] = [];
let isProcessingQueue = false;
const QUEUE_DELAY_MS = 2000; // 2 seconds between uploads to respect API rate limits

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

/**
 * Execute the upload of an image with retry mechanism and backoff if rate limits are hit.
 */
async function executeUploadWithRetry(
  imageSource: File | string,
  customName?: string,
  attempt = 1,
  maxAttempts = 3
): Promise<ImgBBUploadResponse> {
  const customUserKey = getCustomImgBBKey();
  const base64Str = await getImageAsBase64(imageSource);
  const sanitizedName = customName ? sanitizeFilename(customName) : "image";

  console.log(`[ImgBB Queue] Tentativa ${attempt} de ${maxAttempts} enviando mídia (${sanitizedName})...`);

  // 1. Primary path: Use our backend proxy route (/api/upload-imgbb)
  try {
    const res = await fetch("/api/upload-imgbb", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: base64Str,
        name: sanitizedName,
        userApiKey: customUserKey,
      }),
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data?.url) {
      console.log(`[ImgBB Queue] Upload via servidor bem-sucedido! URL: ${data.url}`);
      return {
        url: data.url,
        deleteUrl: data.deleteUrl,
      };
    }

    const serverErrMsg = data?.error || data?.details || `HTTP ${res.status}`;
    const isRateLimit =
      res.status === 429 ||
      (data?.error && data.error.toLowerCase().includes("rate limit")) ||
      (data?.error && data.error.toLowerCase().includes("limite"));

    if (isRateLimit && attempt < maxAttempts) {
      const backoffDelay = attempt * 4000;
      console.warn(`[ImgBB Queue] Rate limit detectado no servidor (tentativa ${attempt}). Aguardando ${backoffDelay}ms...`);
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
      const effectiveKey =
        customUserKey ||
        IMGBB_API_KEY ||
        "d112b9aaf62217ffd155269d04f96f6b";

      const formData = new FormData();
      if (imageSource instanceof File) {
        formData.append("image", imageSource);
      } else {
        const imageBlob = dataURItoBlob(base64Str);
        formData.append("image", imageBlob, `${sanitizedName}.png`);
      }
      formData.append("name", sanitizedName);

      const directRes = await fetch(`https://api.imgbb.com/1/upload?key=${effectiveKey}`, {
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

      if (directRes.ok && directPayload?.data?.url) {
        return {
          url: directPayload.data.url,
          deleteUrl: directPayload.data.delete_url,
        };
      }

      const directErrorMsg = directPayload?.error?.message || directText || `Status ${directRes.status}`;

      if ((directRes.status === 429 || directRes.status === 400) && attempt < maxAttempts) {
        const backoffDelay = attempt * 4000;
        await sleep(backoffDelay);
        return executeUploadWithRetry(imageSource, customName, attempt + 1, maxAttempts);
      }

      throw new Error(`ImgBB Direct: ${directErrorMsg}`);
    } catch (directErr: any) {
      if (attempt < maxAttempts) {
        const backoffDelay = attempt * 3000;
        await sleep(backoffDelay);
        return executeUploadWithRetry(imageSource, customName, attempt + 1, maxAttempts);
      }

      throw new Error(
        serverErr?.message ||
        directErr?.message ||
        "Ocorreu um erro ao fazer upload para o ImgBB. Verifique sua chave nas configurações."
      );
    }
  }
}

/**
 * Worker function to process queued upload tasks sequentially.
 */
async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (uploadQueue.length > 0) {
    const task = uploadQueue.shift();
    if (!task) continue;

    try {
      const result = await executeUploadWithRetry(task.imageSource, task.customName);
      task.resolve(result);
    } catch (err) {
      task.reject(err);
    }

    // Wait a delay before processing next task to prevent hitting API rate limits
    if (uploadQueue.length > 0) {
      console.log(`[ImgBB Queue] Respeitando limite de cota. Aguardando ${QUEUE_DELAY_MS}ms antes de processar o próximo upload...`);
      await sleep(QUEUE_DELAY_MS);
    }
  }

  isProcessingQueue = false;
}

/**
 * Uploads an image file or base64 string to ImgBB and returns the public direct image URL and deletion URL.
 * Strictly requires a successful ImgBB upload to prevent filling up local browser storage with heavy base64 data.
 * Places requests into a sequential queue with sequential safety delays and automated retry logic.
 */
export async function uploadToImgBB(imageSource: File | string, customName?: string): Promise<ImgBBUploadResponse> {
  return new Promise((resolve, reject) => {
    uploadQueue.push({ imageSource, customName, resolve, reject });
    processQueue();
  });
}
