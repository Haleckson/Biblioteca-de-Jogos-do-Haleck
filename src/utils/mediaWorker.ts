/**
 * Web Worker & OffscreenCanvas utility for non-blocking image compression to WebP (90% quality).
 */

export interface CompressionRequest {
  id: string;
  imageSource: string | File;
  quality?: number; // default 0.90
  maxWidth?: number; // default 2560
  maxHeight?: number; // default 2560
}

export interface CompressionResponse {
  id: string;
  resultUrl: string;
  isWebP: boolean;
  success: boolean;
  error?: string;
}

/**
 * Compresses an image source to WebP format at 90% quality using OffscreenCanvas or HTMLCanvasElement fallback.
 * If the image is ALREADY a WebP file/data-uri, it preserves original quality.
 */
export async function compressImageToWebP(
  imageSource: File | string,
  quality = 1.0,
  maxWidth = 16384,
  maxHeight = 16384
): Promise<{ dataUrl: string; isWebP: boolean }> {
  if (typeof window === "undefined") {
    return { dataUrl: typeof imageSource === "string" ? imageSource : "", isWebP: false };
  }

  const isFile = imageSource instanceof File;
  const isAlreadyWebP = isFile
    ? imageSource.type === "image/webp" || imageSource.name.toLowerCase().endsWith(".webp")
    : typeof imageSource === "string" && (imageSource.startsWith("data:image/webp") || imageSource.includes(".webp"));

  // OPTIMIZATION: If already WebP, return original data without re-encoding to preserve 100% quality and exact resolution
  if (isAlreadyWebP) {
    if (typeof imageSource === "string" && imageSource.startsWith("data:image/webp")) {
      return { dataUrl: imageSource, isWebP: true };
    }
    if (isFile) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({ dataUrl: reader.result as string, isWebP: true });
        };
        reader.onerror = () => {
          resolve({ dataUrl: "", isWebP: false });
        };
        reader.readAsDataURL(imageSource);
      });
    }
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = async () => {
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      // Calculate aspect ratio preserving dimensions
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

      // 1. Try OffscreenCanvas if available in modern browsers for off-thread processing
      if (typeof window.OffscreenCanvas !== "undefined") {
        try {
          const offscreen = new window.OffscreenCanvas(width, height);
          const ctx = offscreen.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const blob = await offscreen.convertToBlob({ type: "image/webp", quality });
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({ dataUrl: reader.result as string, isWebP: true });
            };
            reader.readAsDataURL(blob);
            return;
          }
        } catch (e) {
          console.warn("[MediaWorker] OffscreenCanvas fallback:", e);
        }
      }

      // 2. Standard Canvas fallback
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ dataUrl: img.src, isWebP: isAlreadyWebP });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const reader = new FileReader();
              reader.onloadend = () => {
                resolve({ dataUrl: reader.result as string, isWebP: true });
              };
              reader.readAsDataURL(blob);
            } else {
              resolve({ dataUrl: canvas.toDataURL("image/webp", quality), isWebP: true });
            }
          },
          "image/webp",
          quality
        );
      } catch {
        resolve({ dataUrl: img.src, isWebP: isAlreadyWebP });
      }
    };

    img.onerror = () => {
      if (typeof imageSource === "string") {
        resolve({ dataUrl: imageSource, isWebP: isAlreadyWebP });
      } else {
        resolve({ dataUrl: "", isWebP: false });
      }
    };

    if (isFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        resolve({ dataUrl: "", isWebP: false });
      };
      reader.readAsDataURL(imageSource as File);
    } else {
      img.src = imageSource;
    }
  });
}
