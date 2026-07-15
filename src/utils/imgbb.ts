/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const env = (import.meta as any).env || {};
// Fallback key to ensure immediate out-of-the-box operation if the user hasn't configured theirs
const IMGBB_API_KEY = env.VITE_IMGBB_API_KEY || "bf1377da1d596495be1340156d9eb74b";

/**
 * Uploads an image file or base64 string to ImgBB and returns the public direct image URL.
 */
export async function uploadToImgBB(imageSource: File | string): Promise<string> {
  if (!IMGBB_API_KEY) {
    throw new Error("Chave de API do ImgBB não está configurada.");
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

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorDetails = await response.text();
    console.error("Falha ao fazer upload para o ImgBB:", errorDetails);
    throw new Error(`Erro na API do ImgBB: ${response.status} - ${response.statusText}`);
  }

  const payload = await response.json();
  if (payload && payload.data && payload.data.url) {
    return payload.data.url;
  }

  throw new Error("Falha ao obter URL direta do ImgBB na resposta.");
}
