/**
 * Gerenciador de Cache Persistente de Imagens do Navegador (CacheStorage & Blob URL)
 * 
 * Permite que imagens de alta resolução do ImgBB e de outras CDNs sejam baixadas em
 * 100% da resolução/fidelidade original e armazenadas localmente no disco do usuário.
 * 
 * Vantagens:
 * - Leitura instantânea (0 ms) nas próximas aberturas sem nova requisição de rede.
 * - Invalidação automática: Cada link novo tem sua própria chave e mídias alteradas
 *   são atualizadas imediatamente.
 * - Limpeza inteligente e estatísticas de uso em MB para o painel de configurações.
 */

const CACHE_NAME = "haleck-games-image-cache-v1";
const inMemoryBlobCache = new Map<string, string>();
const pendingFetches = new Map<string, Promise<string | null>>();

// Verifica se a Cache API está disponível no navegador
const isCacheStorageSupported = typeof window !== "undefined" && "caches" in window;

/**
 * Obtém a imagem do cache local (CacheStorage ou Blob) ou faz o download em resolução total.
 * Retorna uma URL de Blob local ou a URL original caso a requisição falhe.
 */
export async function getCachedImageUrl(originalUrl: string): Promise<string> {
  if (!originalUrl || typeof originalUrl !== "string") return originalUrl;
  
  // Imagens base64 ou URLs locais já estão em memória
  if (originalUrl.startsWith("data:") || originalUrl.startsWith("blob:")) {
    return originalUrl;
  }

  // 1. Verifica cache em memória (acesso instantâneo 0ms)
  if (inMemoryBlobCache.has(originalUrl)) {
    return inMemoryBlobCache.get(originalUrl)!;
  }

  // 2. Se já houver um download em andamento para esta mesma URL, aguarda a mesma Promise
  if (pendingFetches.has(originalUrl)) {
    const cached = await pendingFetches.get(originalUrl);
    return cached || originalUrl;
  }

  // 3. Cria Promise de download e armazenamento
  const fetchPromise = (async (): Promise<string | null> => {
    try {
      if (!isCacheStorageSupported) return null;

      const cache = await caches.open(CACHE_NAME);
      const cacheKey = new Request(originalUrl, { mode: "cors" });
      const cachedResponse = await cache.match(cacheKey);

      if (cachedResponse) {
        const blob = await cachedResponse.blob();
        if (blob && blob.size > 0) {
          const blobUrl = URL.createObjectURL(blob);
          inMemoryBlobCache.set(originalUrl, blobUrl);
          return blobUrl;
        }
      }

      // Se não está no cache, baixa a imagem com qualidade original
      const response = await fetch(originalUrl, {
        mode: "cors",
        credentials: "omit",
      });

      if (response.ok) {
        // Clona a resposta para salvar no CacheStorage e criar o Blob URL
        const clonedResponse = response.clone();
        cache.put(cacheKey, clonedResponse).catch((err) => {
          console.warn("Falha ao salvar imagem no CacheStorage:", err);
        });

        const blob = await response.blob();
        if (blob && blob.size > 0) {
          const blobUrl = URL.createObjectURL(blob);
          inMemoryBlobCache.set(originalUrl, blobUrl);
          return blobUrl;
        }
      }
    } catch (e) {
      // Falha de CORS ou offline - o navegador carregará normalmente via <img>
      // console.warn("Cache image fetch fallback:", e);
    }
    return null;
  })();

  pendingFetches.set(originalUrl, fetchPromise);
  const result = await fetchPromise;
  pendingFetches.delete(originalUrl);

  return result || originalUrl;
}

/**
 * Pré-carrega uma lista de URLs de imagens em segundo plano sem bloquear a interface.
 */
export function preloadImagesToCache(urls: (string | undefined | null)[]): void {
  if (typeof window === "undefined" || !isCacheStorageSupported) return;

  const validUrls = Array.from(new Set(urls.filter((u): u is string => Boolean(u && typeof u === "string" && !u.startsWith("data:") && !u.startsWith("blob:")))));

  if (validUrls.length === 0) return;

  const runPreload = () => {
    validUrls.forEach((url, idx) => {
      // Escala o pré-carregamento com pequenos atrasos para poupar recursos
      setTimeout(() => {
        getCachedImageUrl(url).catch(() => {});
      }, idx * 100);
    });
  };

  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(() => runPreload(), { timeout: 3000 });
  } else {
    setTimeout(runPreload, 1500);
  }
}

/**
 * Remove uma imagem específica do cache local quando ela for editada ou excluída.
 */
export async function invalidateCachedImageUrl(originalUrl: string): Promise<void> {
  if (!originalUrl) return;

  // Revoga e remove da memória
  if (inMemoryBlobCache.has(originalUrl)) {
    const blobUrl = inMemoryBlobCache.get(originalUrl);
    if (blobUrl && blobUrl.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch (e) {}
    }
    inMemoryBlobCache.delete(originalUrl);
  }

  // Remove do CacheStorage
  if (isCacheStorageSupported) {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.delete(new Request(originalUrl, { mode: "cors" }));
    } catch (e) {
      console.warn("Erro ao invalidar imagem no cache:", e);
    }
  }
}

/**
 * Calcula o tamanho total aproximado e quantidade de itens salvos no cache de imagens.
 */
export async function getImageCacheStats(): Promise<{ count: number; sizeBytes: number; sizeFormatted: string }> {
  if (!isCacheStorageSupported) {
    return { count: 0, sizeBytes: 0, sizeFormatted: "0 MB" };
  }

  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    let totalBytes = 0;

    for (const req of requests) {
      const res = await cache.match(req);
      if (res) {
        const blob = await res.blob();
        totalBytes += blob.size;
      }
    }

    const sizeMb = (totalBytes / (1024 * 1024)).toFixed(1);
    return {
      count: requests.length,
      sizeBytes: totalBytes,
      sizeFormatted: `${sizeMb} MB`,
    };
  } catch (e) {
    return { count: 0, sizeBytes: 0, sizeFormatted: "0 MB" };
  }
}

/**
 * Limpa todo o cache de imagens persistente.
 */
export async function clearAllImageCache(): Promise<boolean> {
  // Revoga todos os Blob URLs ativos na memória
  inMemoryBlobCache.forEach((blobUrl) => {
    if (blobUrl && blobUrl.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch (e) {}
    }
  });
  inMemoryBlobCache.clear();
  pendingFetches.clear();

  if (isCacheStorageSupported) {
    try {
      await caches.delete(CACHE_NAME);
      return true;
    } catch (e) {
      console.error("Erro ao deletar cache de imagens:", e);
      return false;
    }
  }
  return true;
}
