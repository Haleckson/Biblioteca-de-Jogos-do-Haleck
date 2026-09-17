/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  getYoutubeAccessToken,
  refreshYoutubeToken,
  signInWithYouTube,
  getDriveAccessToken,
  isPopupCancelledOrClosedError,
} from "./googleDrive";
import { getVideoMimeType } from "./mediaUtils";

/**
 * Checks if a URL is a valid YouTube link and extracts the embeddable format.
 */
export function getYoutubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  
  // Regular expressions to match different YouTube URL variants
  // E.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ
  // E.g., https://youtu.be/dQw4w9WgXcQ
  // E.g., https://www.youtube.com/embed/dQw4w9WgXcQ
  // E.g., https://m.youtube.com/watch?v=dQw4w9WgXcQ
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  
  if (match && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}`;
  }
  
  return null;
}

/**
 * Extracts the 11-character YouTube video ID from any YouTube URL format.
 */
export function getYoutubeVideoId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2] && match[2].length === 11) {
    return match[2];
  }
  return null;
}

/**
 * Returns true if the URL is a YouTube link.
 */
export function isYoutubeUrl(url: string): boolean {
  return !!getYoutubeEmbedUrl(url);
}

/**
 * Checks whether YouTube API quota is available for video operations.
 */
export async function checkYoutubeQuota(customToken?: string): Promise<{ available: boolean; message?: string }> {
  let token = customToken || getDriveAccessToken();
  if (!token) {
    return { available: true };
  }

  try {
    const res = await fetch("https://www.googleapis.com/youtube/v3/playlists?mine=true&maxResults=1&part=id", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 403 || res.status === 429) {
      const errText = await res.text();
      if (
        errText.includes("quotaExceeded") ||
        errText.includes("dailyLimitExceeded") ||
        errText.includes("rateLimitExceeded") ||
        errText.includes("quota")
      ) {
        return {
          available: false,
          message: "⚠️ Cota diária da API do YouTube atingida. Aguarde a renovação da cota pelo Google para realizar novos envios."
        };
      }
    }
    return { available: true };
  } catch (err: any) {
    console.warn("Aviso na verificação de cota do YouTube:", err);
    return { available: true };
  }
}

export interface YoutubeUploadResult {
  videoUrl: string;
  videoId: string;
  playlistId?: string;
  playlistUrl?: string;
}

/**
 * Automates the upload of a video file to YouTube, finds/creates a playlist
 * for the specified game, and inserts the video into that playlist.
 */
export async function uploadVideoToYoutube(
  file: File,
  gameName: string,
  entryTitle?: string,
  gridPosition?: number,
  onProgress?: (progressText: string) => void,
  signal?: AbortSignal
): Promise<string & YoutubeUploadResult> {
  if (signal?.aborted) {
    throw new DOMException("Upload YouTube cancelado pelo usuário", "AbortError");
  }

  let token = getYoutubeAccessToken() || getDriveAccessToken();
  
  // Auto-refresh token if missing but previously connected
  if (!token && localStorage.getItem("youtube_connected") === "true") {
    try {
      token = await refreshYoutubeToken();
    } catch (e) {
      console.warn("Falha ao reautenticar sessão salva do YouTube:", e);
    }
  }

  if (!token) {
    try {
      token = await signInWithYouTube();
    } catch (e: any) {
      if (isPopupCancelledOrClosedError(e)) {
        throw new Error("Envio cancelado: a janela de autenticação do YouTube foi fechada.");
      }
      throw new Error("Você precisa autorizar o YouTube para enviar vídeos. Por favor, conecte sua conta.");
    }
  }

  // Pre-check YouTube API Quota before processing heavy file
  const quotaCheck = await checkYoutubeQuota(token);
  if (!quotaCheck.available) {
    throw new Error(quotaCheck.message || "Cota diária da API do YouTube excedida.");
  }

  let videoMimeType = getVideoMimeType(file);
  if (!videoMimeType || videoMimeType.includes("matroska") || videoMimeType.includes("mkv")) {
    videoMimeType = "video/mp4";
  }

  // 1. Initiate Resumable Upload Session
  onProgress?.("Iniciando sessão de upload no YouTube...");
  
  const cleanGameName = (gameName || "Jogo Sem Nome").replace(/[<>]/g, "").trim();
  const displayEntryTitle = (entryTitle ? entryTitle.trim() : `Diário (${new Date().toLocaleDateString("pt-BR")})`).replace(/[<>]/g, "");
  const posNumber = gridPosition || 1;
  
  let rawTitle = `${cleanGameName} - ${displayEntryTitle} - Vídeo #${posNumber}`;
  if (rawTitle.length > 95) {
    rawTitle = rawTitle.substring(0, 92) + "...";
  }
  const videoTitle = rawTitle;

  const videoDesc = 
    `Vídeo de gameplay do jogo "${cleanGameName}".\n` +
    `Entrada do Diário: ${displayEntryTitle}\n` +
    `Posição no Grid de Mídias: #${posNumber}\n` +
    `Data de Envio: ${new Date().toLocaleString("pt-BR")}\n\n` +
    `Gerenciado automaticamente pela sua Biblioteca de Jogos.`;

  const safeTags = [
    cleanGameName.substring(0, 45),
    "Gaming Diary",
    "Biblioteca de Jogos",
    `Vídeo ${posNumber}`
  ].filter((t) => typeof t === "string" && t.trim().length > 0);

  const metadata = {
    snippet: {
      title: videoTitle,
      description: videoDesc.replace(/[<>]/g, ""),
      categoryId: "20", // Gaming Category ID
      tags: safeTags
    },
    status: {
      privacyStatus: "unlisted", // Keep it unlisted by default so it's private/accessible only via link
      selfDeclaredMadeForKids: false
    }
  };

  let initResponse: Response | null = null;
  let initError: any = null;

  for (let initAttempt = 1; initAttempt <= 3; initAttempt++) {
    try {
      // On retry 2, use fallback simple metadata and standard video/mp4 header
      const payloadMetadata = initAttempt === 2 ? {
        snippet: {
          title: videoTitle.substring(0, 80),
          description: `Vídeo de gameplay - ${cleanGameName}`
        },
        status: { privacyStatus: "unlisted" }
      } : metadata;

      const headerMime = initAttempt >= 2 ? "video/mp4" : videoMimeType;

      initResponse = await fetch(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Length": (file.size || 0).toString(),
            "X-Upload-Content-Type": headerMime
          },
          body: JSON.stringify(payloadMetadata)
        }
      );

      if (initResponse.status === 401) {
        if (initAttempt === 1) {
          token = await refreshYoutubeToken();
          continue;
        } else if (initAttempt === 2) {
          token = await signInWithYouTube();
          continue;
        }
      }

      if (initResponse.ok) {
        break;
      }

      // If status is 400 Bad Request, attempt next attempt with simplified metadata
      if (initResponse.status === 400 && initAttempt < 3) {
        console.warn(`Tentativa ${initAttempt} de envio ao YouTube retornou 400. Tentando fallback simples...`);
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
    } catch (err: any) {
      initError = err;
      console.warn(`Tentativa ${initAttempt} de iniciar upload no YouTube falhou:`, err);
      if (initAttempt === 1) {
        try {
          token = await refreshYoutubeToken();
        } catch {
          // Ignore refresh fail on attempt 1
        }
      }
    }
  }

  if (!initResponse || !initResponse.ok) {
    let errText = initError?.message || "Erro de conexão";
    if (initResponse) {
      try {
        errText = await initResponse.text();
      } catch {
        errText = `HTTP ${initResponse.status}`;
      }
    }
    if (errText.includes("youtubeSignupRequired") || errText.includes("channel")) {
      throw new Error("Sua conta do Google ainda não possui um canal ativo no YouTube. Crie um canal no YouTube ou acesse youtube.com para ativá-lo.");
    }
    if (errText.toLowerCase().includes("invalid") || errText.includes("400")) {
      throw new Error("O YouTube recusou os dados do vídeo (400 Bad Request / Request is invalid). Verifique se sua conta do Google possui canal no YouTube ativo.");
    }
    throw new Error(`Falha ao iniciar envio para o YouTube: ${errText}`);
  }

  const uploadUrl = initResponse.headers.get("Location");
  if (!uploadUrl) {
    throw new Error("Não foi possível obter a URL de upload do YouTube a partir dos cabeçalhos da resposta.");
  }

  // 2. Upload binary data using resilient chunking (10MB chunks)
  onProgress?.("Enviando arquivo de vídeo para o YouTube...");
  
  const totalBytes = file.size;
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunk (multiple of 256KB required by YouTube)
  let start = 0;
  let videoId = "";

  if (totalBytes === 0) {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": videoMimeType || "video/mp4" },
      body: file
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Erro na transferência do arquivo para o YouTube: ${res.status} - ${errText}`);
    }
    const data = await res.json();
    videoId = data.id;
  } else {
    while (start < totalBytes) {
      const end = Math.min(start + CHUNK_SIZE, totalBytes);
      const chunk = file.slice(start, end);
      const pct = Math.round((end / totalBytes) * 100);

      onProgress?.(`Enviando vídeo para o YouTube (${pct}%)...`);

      let response: Response | null = null;
      let lastError: any = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          // DO NOT include Content-Length in fetch headers (it's a forbidden header name in browser fetch)
          response = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type": videoMimeType || "application/octet-stream",
              "Content-Range": `bytes ${start}-${end - 1}/${totalBytes}`
            },
            body: chunk
          });

          if (response.status === 308 || response.ok) {
            break;
          } else if (response.status >= 500 || response.status === 429) {
            console.warn(`Tentativa ${attempt} falhou com status ${response.status}. Tentando novamente...`);
            await new Promise((r) => setTimeout(r, 2000 * attempt));
          } else {
            // Unrecoverable HTTP status (4xx other than 308)
            const errText = await response.text();
            throw new Error(`Servidor do YouTube recusou o envio: ${response.status} - ${errText}`);
          }
        } catch (fetchErr: any) {
          lastError = fetchErr;
          console.warn(`Tentativa ${attempt} de envio de bloco do vídeo falhou:`, fetchErr);
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 2000 * attempt));
          }
        }
      }

      if (!response && lastError) {
        throw new Error(`Erro de conexão ao enviar vídeo para o YouTube: ${lastError.message || lastError}`);
      }

      if (response && response.ok) {
        // Upload finished!
        const videoData = await response.json();
        videoId = videoData.id;
        break;
      }

      if (response && response.status === 308) {
        // Chunk uploaded successfully, move to next range
        start = end;
      } else {
        const errText = response ? await response.text() : "Falha desconhecida";
        throw new Error(`Erro na transferência de dados para o YouTube: ${response?.status || "sem resposta"} - ${errText}`);
      }
    }
  }

  if (!videoId) {
    throw new Error("O YouTube não retornou um ID de vídeo válido após o upload.");
  }

  onProgress?.("Vídeo enviado com sucesso! Configurando a playlist do jogo...");

  let playlistId = "";
  let playlistUrl = "";

  try {
    // 3. Find or Create Playlist for this Game
    playlistId = await findOrCreateGamePlaylist(gameName, token, onProgress);
    if (playlistId) {
      playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
    }

    // 4. Associate the uploaded video with this playlist
    onProgress?.("Adicionando vídeo à playlist do jogo...");
    await addVideoToPlaylist(playlistId, videoId, token);
  } catch (playlistErr: any) {
    console.error("Falha ao gerenciar playlist ou inserir vídeo:", playlistErr);
    // Do not fail the whole process if playlist insertion fails because the video was uploaded successfully!
    onProgress?.(`Aviso: Vídeo enviado, mas não foi possível inseri-lo na playlist (${playlistErr.message || playlistErr}).`);
  }

  onProgress?.("Upload concluído com sucesso!");
  const mainVideoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const resultObj = new String(mainVideoUrl) as string & YoutubeUploadResult;
  resultObj.videoUrl = mainVideoUrl;
  resultObj.videoId = videoId;
  resultObj.playlistId = playlistId;
  resultObj.playlistUrl = playlistUrl;
  return resultObj;
}

/**
 * Searches for a playlist by title matching the game name.
 * If found, returns its ID. Otherwise, creates a new playlist.
 */
async function findOrCreateGamePlaylist(
  gameName: string,
  token: string,
  onProgress?: (progressText: string) => void
): Promise<string> {
  onProgress?.(`Verificando se existe a playlist "${gameName}"...`);

  try {
    const listUrl = "https://www.googleapis.com/youtube/v3/playlists?mine=true&maxResults=50&part=snippet";
    const res = await fetch(listUrl, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      const matchedPlaylist = (data.items || []).find(
        (item: any) => item.snippet?.title?.trim().toLowerCase() === gameName.trim().toLowerCase()
      );

      if (matchedPlaylist) {
        onProgress?.(`Playlist existente encontrada para "${gameName}".`);
        return matchedPlaylist.id;
      }
    } else {
      const errText = await res.text();
      console.warn("Erro ao listar playlists:", errText);
    }
  } catch (searchErr) {
    console.error("Erro durante busca de playlists:", searchErr);
  }

  // Create a new playlist
  onProgress?.(`Criando nova playlist para "${gameName}" no seu canal do YouTube...`);
  
  const createUrl = "https://www.googleapis.com/youtube/v3/playlists?part=snippet,status";
  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      snippet: {
        title: gameName,
        description: `Coletânea de vídeos de gameplay e conquistas do jogo "${gameName}".\n\nCriada automaticamente pela Biblioteca do Haleck.`
      },
      status: {
        privacyStatus: "unlisted"
      }
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Falha ao criar nova playlist: ${createRes.status} - ${errText}`);
  }

  const playlistData = await createRes.json();
  onProgress?.(`Nova playlist "${gameName}" criada com sucesso!`);
  return playlistData.id;
}

/**
 * Adds a video to a specific YouTube playlist.
 */
async function addVideoToPlaylist(
  playlistId: string,
  videoId: string,
  token: string
): Promise<void> {
  const url = "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      snippet: {
        playlistId: playlistId,
        resourceId: {
          kind: "youtube#video",
          videoId: videoId
        }
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro ao associar vídeo à playlist: ${res.status} - ${errText}`);
  }
}

