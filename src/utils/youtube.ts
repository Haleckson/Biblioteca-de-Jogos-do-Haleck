/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDriveAccessToken } from "./googleDrive";

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
 * Returns true if the URL is a YouTube link.
 */
export function isYoutubeUrl(url: string): boolean {
  return !!getYoutubeEmbedUrl(url);
}

/**
 * Automates the upload of a video file to YouTube, finds/creates a playlist
 * for the specified game, and inserts the video into that playlist.
 */
export async function uploadVideoToYoutube(
  file: File,
  gameName: string,
  onProgress?: (progressText: string) => void
): Promise<string> {
  const token = getDriveAccessToken();
  if (!token) {
    throw new Error("Você precisa estar conectado ao Google. Clique em 'Conectar Google Drive' no topo da página.");
  }

  // 1. Initiate Resumable Upload Session
  onProgress?.("Iniciando sessão de upload no YouTube...");
  
  const metadata = {
    snippet: {
      title: `${gameName} - Diário de Jogo (${new Date().toLocaleDateString("pt-BR")})`,
      description: `Vídeo enviado automaticamente para o diário do jogo "${gameName}" na minha Biblioteca de Jogos.\n\nEnviado em: ${new Date().toLocaleString("pt-BR")}`,
      categoryId: "20", // Gaming Category ID
      tags: [gameName, "Gaming Diary", "Biblioteca de Jogos"]
    },
    status: {
      privacyStatus: "unlisted", // Keep it unlisted by default so it's private/accessible only via link
      selfDeclaredMadeForKids: false
    }
  };

  const initResponse = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": file.size.toString(),
        "X-Upload-Content-Type": file.type
      },
      body: JSON.stringify(metadata)
    }
  );

  if (!initResponse.ok) {
    const errText = await initResponse.text();
    throw new Error(`Falha ao iniciar envio para o YouTube: ${initResponse.status} - ${errText}`);
  }

  const uploadUrl = initResponse.headers.get("Location");
  if (!uploadUrl) {
    throw new Error("Não foi possível obter a URL de upload do YouTube a partir dos cabeçalhos da resposta.");
  }

  // 2. Upload the binary data
  onProgress?.("Enviando arquivo de vídeo para os servidores do YouTube...");
  
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type
    },
    body: file
  });

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text();
    throw new Error(`Erro na transferência de dados para o YouTube: ${uploadResponse.status} - ${errText}`);
  }

  const videoData = await uploadResponse.json();
  const videoId = videoData.id;
  if (!videoId) {
    throw new Error("O YouTube não retornou um ID de vídeo válido após o upload.");
  }

  onProgress?.("Vídeo enviado com sucesso! Configurando a playlist do jogo...");

  try {
    // 3. Find or Create Playlist for this Game
    const playlistId = await findOrCreateGamePlaylist(gameName, token, onProgress);

    // 4. Associate the uploaded video with this playlist
    onProgress?.("Adicionando vídeo à playlist do jogo...");
    await addVideoToPlaylist(playlistId, videoId, token);
  } catch (playlistErr: any) {
    console.error("Falha ao gerenciar playlist ou inserir vídeo:", playlistErr);
    // Do not fail the whole process if playlist insertion fails because the video was uploaded successfully!
    onProgress?.(`Aviso: Vídeo enviado, mas não foi possível inseri-lo na playlist (${playlistErr.message || playlistErr}).`);
  }

  onProgress?.("Upload concluído com sucesso!");
  return `https://www.youtube.com/watch?v=${videoId}`;
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

