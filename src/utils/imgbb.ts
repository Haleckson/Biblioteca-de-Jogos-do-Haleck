/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const env = (import.meta as any).env || {};
// Fallback key to ensure immediate out-of-the-box operation if the user hasn't configured theirs
const IMGBB_API_KEY = env.VITE_IMGBB_API_KEY || "f372a593e8a447538e6426b362fc3604";

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

/**
 * Execute the upload of an image with retry mechanism and backoff if rate limits are hit.
 */
async function executeUploadWithRetry(
  imageSource: File | string,
  customName?: string,
  attempt = 1,
  maxAttempts = 3
): Promise<ImgBBUploadResponse> {
  if (!IMGBB_API_KEY) {
    throw new Error(
      "A Chave de API do ImgBB não está configurada.\n\n" +
      "Como resolver:\n" +
      "1. Acesse https://api.imgbb.com/ e crie uma chave gratuita.\n" +
      "2. Adicione 'VITE_IMGBB_API_KEY' com sua chave nas configurações de segredos do AI Studio (Secrets)."
    );
  }

  const formData = new FormData();

  if (imageSource instanceof File) {
    formData.append("image", imageSource);
  } else if (typeof imageSource === "string") {
    // Extract base64 part if it's a full data URI
    let base64Data = imageSource;
    if (imageSource.includes("base64,")) {
      base64Data = imageSource.split("base64,")[1];
    }
    formData.append("image", base64Data);
  } else {
    throw new Error("Formato de imagem inválido para upload.");
  }

  if (customName) {
    formData.append("name", sanitizeFilename(customName));
  }

  try {
    console.log(`[ImgBB Queue] Iniciando tentativa ${attempt} de ${maxAttempts} para: ${customName || "imagem"}`);
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let isRateLimit = false;
      let parsedMsg = "";

      try {
        const parsed = JSON.parse(errorText);
        if (parsed?.error?.message) {
          parsedMsg = parsed.error.message;
        }
        if (parsed?.error?.code === 100 || errorText.toLowerCase().includes("rate limit") || errorText.toLowerCase().includes("limit reached")) {
          isRateLimit = true;
        }
      } catch (e) {
        // Ignorar se não for JSON válido
      }

      if (isRateLimit || response.status === 429 || response.status === 400) {
        if (attempt < maxAttempts) {
          const backoffDelay = attempt * 4000; // 4s, 8s, etc.
          console.warn(`[ImgBB Queue] Rate limit detectado na tentativa ${attempt}. Aguardando ${backoffDelay}ms para nova tentativa...`);
          await sleep(backoffDelay);
          return executeUploadWithRetry(imageSource, customName, attempt + 1, maxAttempts);
        }

        throw new Error(
          `Limite de uploads atingido (Rate Limit) ou chave inválida no ImgBB.\n\n` +
          `Como resolver:\n` +
          `1. Crie uma conta gratuita em https://api.imgbb.com/ e clique em 'Começar' ou 'Obter Chave de API' para gerar sua própria chave de upload de graça.\n` +
          `2. Abra as Configurações do seu aplicativo (ícone de engrenagem no topo direito do AI Studio) > menu 'Secrets'.\n` +
          `3. Adicione uma variável com o nome 'VITE_IMGBB_API_KEY' e coloque a sua chave do ImgBB recém-criada.\n` +
          `4. Reinicie ou recarregue o aplicativo para usá-lo com sua própria cota ilimitada!`
        );
      }

      throw new Error(parsedMsg || `Erro na API do ImgBB: Código ${response.status}`);
    }

    const payload = await response.json();
    if (payload && payload.data && payload.data.url) {
      console.log(`[ImgBB Queue] Upload com sucesso na tentativa ${attempt}! URL: ${payload.data.url}`);
      return {
        url: payload.data.url,
        deleteUrl: payload.data.delete_url
      };
    }

    throw new Error("Falha ao obter URL direta do ImgBB na resposta.");
  } catch (err: any) {
    console.error(`[ImgBB Queue] Falha na tentativa ${attempt}:`, err);
    
    // Bubble up friendly known messages
    if (err.message && (err.message.includes("Limite de uploads") || err.message.includes("VITE_IMGBB_API_KEY"))) {
      throw err;
    }

    // Otherwise retry on standard network failures as well
    if (attempt < maxAttempts) {
      const backoffDelay = attempt * 3000;
      console.warn(`[ImgBB Queue] Falha de rede/conexão. Aguardando ${backoffDelay}ms para nova tentativa...`);
      await sleep(backoffDelay);
      return executeUploadWithRetry(imageSource, customName, attempt + 1, maxAttempts);
    }

    throw new Error(
      `Erro de conexão/upload com o ImgBB: ${err.message || err}\n\n` +
      `Para contornar este problema e ter uploads ilimitados, recomendamos configurar sua própria chave 'VITE_IMGBB_API_KEY' gratuita nas configurações de 'Secrets' do AI Studio.`
    );
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
