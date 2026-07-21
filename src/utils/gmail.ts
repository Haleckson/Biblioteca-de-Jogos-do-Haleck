import { signInWithPopup, GoogleAuthProvider, User, onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { Game } from "../types";

// Cache token in memory
let cachedGmailAccessToken: string | null = null;
let currentGmailUser: User | null = null;
let isSigningInGmail = false;

// Provider with minimal Gmail scopes
const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/gmail.send");
provider.addScope("https://www.googleapis.com/auth/userinfo.email");

// Monitor auth state
if (auth) {
  onAuthStateChanged(auth, (user) => {
    currentGmailUser = user;
    if (!user) {
      cachedGmailAccessToken = null;
      localStorage.removeItem("gmail_connected");
    }
  });
}

/**
 * Sign in user with Gmail scopes
 */
export async function signInWithGmail(): Promise<string> {
  if (!auth) {
    throw new Error("Firebase Auth não está inicializado.");
  }

  if (isSigningInGmail) {
    throw new Error("Uma autenticação com o Gmail já está em andamento. Aguarde.");
  }

  try {
    isSigningInGmail = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    if (!accessToken) {
      throw new Error("Não foi possível obter o token de acesso do Gmail.");
    }

    cachedGmailAccessToken = accessToken;
    currentGmailUser = result.user;
    localStorage.setItem("gmail_connected", "true");
    return accessToken;
  } catch (err: any) {
    console.error("Erro no login do Gmail:", err);
    if (err.code === "auth/popup-closed-by-user" || String(err).includes("popup-closed-by-user")) {
      throw new Error(
        "A janela de autenticação foi fechada.\n\n" +
        "Caso esteja em um iframe do AI Studio, use o botão de 'Abrir em uma nova aba' no canto superior direito para conectar sem restrições."
      );
    }
    throw err;
  } finally {
    isSigningInGmail = false;
  }
}

/**
 * Check connectivity and tokens
 */
export function isGmailAuthenticated(): boolean {
  return !!cachedGmailAccessToken;
}

export function getGmailAccessToken(): string | null {
  return cachedGmailAccessToken;
}

export function getGmailUserEmail(): string | null {
  return currentGmailUser?.email || null;
}

export async function signOutGmail(): Promise<void> {
  cachedGmailAccessToken = null;
  localStorage.removeItem("gmail_connected");
}

/**
 * Convert content to base64url format for Gmail API
 */
function toBase64Url(str: string): string {
  // UTF-8 friendly base64 encoding
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  const base64 = btoa(binary);
  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Composes an RFC 822 compliant MIME message and sends it via Gmail REST API
 */
export async function sendGmailEmail(to: string, subject: string, bodyHtml: string): Promise<void> {
  const token = getGmailAccessToken();
  if (!token) {
    throw new Error("Não conectado ao Gmail. Por favor, faça login primeiro.");
  }

  // Construct MIME message
  const mimeParts = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(
      Array.from(new TextEncoder().encode(subject))
        .map((b) => String.fromCharCode(b))
        .join("")
    )}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    btoa(
      Array.from(new TextEncoder().encode(bodyHtml))
        .map((b) => String.fromCharCode(b))
        .join("")
    ),
  ];

  const rawMime = mimeParts.join("\r\n");
  const rawBase64Url = toBase64Url(rawMime);

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw: rawBase64Url,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Falha ao enviar e-mail via Gmail: ${response.status} - ${errText}`);
  }
}

/**
 * Formats a single game as a beautifully styled HTML email
 */
export function formatGameEmailHtml(game: Game): string {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const parts = dateStr.split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
  };

  const statusChips = (game.status || [])
    .map((s) => `<span style="display:inline-block; padding: 4px 10px; margin-right: 5px; font-size: 11px; font-weight: bold; border-radius: 12px; background-color: #1e1b4b; color: #a5b4fc; border: 1px solid #312e81;">${s}</span>`)
    .join("");

  const genres = (game.genre || [])
    .map((g) => `<span style="display:inline-block; padding: 3px 8px; margin-right: 4px; font-size: 11px; border-radius: 8px; background-color: #1c1917; color: #d6d3d1; border: 1px solid #44403c;">${g}</span>`)
    .join(" ");

  const tags = (game.tags || [])
    .map((t) => `<span style="display:inline-block; padding: 3px 8px; margin-right: 4px; font-size: 11px; border-radius: 8px; background-color: #0f172a; color: #38bdf8; border: 1px solid #1e293b;">#${t}</span>`)
    .join(" ");

  let ratingStars = "";
  const rating = game.rating || 0;
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) {
      ratingStars += "★";
    } else if (rating + 0.5 >= i) {
      ratingStars += "½";
    } else {
      ratingStars += "☆";
    }
  }

  // Build entries HTML
  let diaryEntriesHtml = "";
  if (!game.diary || game.diary.length === 0) {
    diaryEntriesHtml = `<p style="color: #a1a1aa; font-style: italic; font-size: 13px;">Nenhuma anotação registrada no diário deste jogo.</p>`;
  } else {
    diaryEntriesHtml = [...game.diary]
      .reverse() // Display newest first
      .map((entry) => {
        let entryMediaHtml = "";
        if (entry.medias && entry.medias.length > 0) {
          const images = entry.medias
            .filter((m) => !m.isVideo && m.src)
            .map(
              (m) =>
                `<img src="${m.src}" alt="Anexo" style="max-width: 150px; max-height: 100px; border-radius: 8px; margin-right: 8px; margin-top: 8px; object-fit: cover; border: 1px solid #3f3f46;" referrerPolicy="no-referrer" />`
            )
            .join("");
          if (images) {
            entryMediaHtml = `<div style="margin-top: 8px;">${images}</div>`;
          }
        }

        return `
          <div style="margin-bottom: 20px; padding: 15px; border-radius: 12px; background-color: #18181b; border-left: 4px solid #06b6d4;">
            <div style="font-weight: bold; color: #ec4899; font-size: 12px; font-family: monospace; text-transform: uppercase; margin-bottom: 6px;">
              Período: ${entry.period}
            </div>
            <div style="color: #e4e4e7; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${entry.text}</div>
            ${entryMediaHtml}
          </div>
        `;
      })
      .join("");
  }

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #f4f4f5; padding: 30px; border-radius: 20px; max-width: 650px; margin: 0 auto; border: 1px solid #27272a;">
      <div style="text-align: center; margin-bottom: 25px;">
        <span style="font-size: 40px; display: block; margin-bottom: 10px;">🎮</span>
        <h2 style="margin: 0; color: #22d3ee; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">Diário de Jogatina</h2>
        <p style="margin: 5px 0 0 0; color: #a1a1aa; font-size: 12px;">Relatório enviado da Biblioteca do Haleck</p>
      </div>
      
      <hr style="border: 0; border-top: 1px solid #27272a; margin-bottom: 25px;" />

      <!-- Cover and Title -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <tr>
          ${
            game.cover
              ? `<td style="width: 120px; vertical-align: top; padding-right: 20px;">
                  <img src="${game.cover}" alt="${game.name}" style="width: 120px; border-radius: 12px; object-fit: cover; border: 1px solid #27272a;" referrerPolicy="no-referrer" />
                 </td>`
              : ""
          }
          <td style="vertical-align: top;">
            <h1 style="margin: 0 0 8px 0; font-size: 24px; color: #ffffff; text-transform: uppercase;">${game.name}</h1>
            <p style="margin: 0 0 12px 0; color: #c084fc; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Série: ${game.series || "Não se aplica"}</p>
            <div style="margin-bottom: 12px;">
              ${statusChips}
            </div>
            <div style="font-size: 15px; color: #fbbf24; font-weight: bold;">
              Nota Pessoal: ${ratingStars} <span style="font-size: 12px; color: #a1a1aa; font-weight: normal;">(${rating}/5)</span>
            </div>
          </td>
        </tr>
      </table>

      <!-- Meta Grid -->
      <div style="background-color: #18181b; padding: 15px; border-radius: 12px; margin-bottom: 25px; border: 1px solid #27272a;">
        <h4 style="margin: 0 0 10px 0; color: #a1a1aa; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px;">Metadados de Perfil</h4>
        <table style="width: 100%; font-size: 13px;">
          <tr>
            <td style="padding: 4px 0; color: #71717a;">Plataforma:</td>
            <td style="padding: 4px 0; color: #e4e4e7; font-weight: bold;">${game.platform || "PC"}</td>
            <td style="padding: 4px 0; color: #71717a; padding-left: 15px;">Tempo de Jogo:</td>
            <td style="padding: 4px 0; color: #22d3ee; font-family: monospace; font-weight: bold;">${game.playtime || "00h 00m"}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #71717a;">Publisher:</td>
            <td style="padding: 4px 0; color: #e4e4e7;">${game.publisher || "Desconhecido"}</td>
            <td style="padding: 4px 0; color: #71717a; padding-left: 15px;">Lançamento:</td>
            <td style="padding: 4px 0; color: #e4e4e7; font-family: monospace;">${formatDate(game.releaseDate)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #71717a;">Data de Início:</td>
            <td style="padding: 4px 0; color: #e4e4e7; font-family: monospace;">${formatDate(game.startDate)}</td>
            <td style="padding: 4px 0; color: #71717a; padding-left: 15px;">Data de Fim:</td>
            <td style="padding: 4px 0; color: #e4e4e7; font-family: monospace;">${game.endDate ? formatDate(game.endDate) : "Em aberto"}</td>
          </tr>
        </table>
        
        ${
          game.hltbMain || game.hltbExtra || game.hltbCompletionist
            ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #27272a; font-size: 12px;">
                <span style="color: #a1a1aa; font-weight: bold; display: block; margin-bottom: 5px; text-transform: uppercase; font-size: 10px; letter-spacing: 1px;">Estimativas HowLongToBeat:</span>
                <span style="color: #c084fc; font-weight: bold; margin-right: 15px;">Campanha: <span style="font-family: monospace;">${game.hltbMain || "—"}</span></span>
                <span style="color: #22d3ee; font-weight: bold; margin-right: 15px;">Extras: <span style="font-family: monospace;">${game.hltbExtra || "—"}</span></span>
                <span style="color: #f472b6; font-weight: bold;">100%: <span style="font-family: monospace;">${game.hltbCompletionist || "—"}</span></span>
               </div>`
            : ""
        }
      </div>

      <!-- Genres and Tags -->
      <div style="margin-bottom: 25px;">
        <div style="margin-bottom: 10px;">
          <span style="color: #71717a; font-size: 12px; font-weight: bold; margin-right: 10px; text-transform: uppercase;">Gêneros:</span>
          ${genres}
        </div>
        <div>
          <span style="color: #71717a; font-size: 12px; font-weight: bold; margin-right: 10px; text-transform: uppercase;">Tags:</span>
          ${tags}
        </div>
      </div>

      <hr style="border: 0; border-top: 1px solid #27272a; margin-bottom: 25px;" />

      <!-- Diary Entries -->
      <div>
        <h3 style="margin: 0 0 15px 0; color: #22d3ee; font-size: 18px; text-transform: uppercase; letter-spacing: 1.5px;">Anotações do Diário</h3>
        ${diaryEntriesHtml}
      </div>

      <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #27272a; font-size: 11px; color: #71717a;">
        Enviado via Biblioteca de Jogos do Haleck. Desenvolvido com carinho.
      </div>
    </div>
  `;
}

/**
 * Formats a summary of the entire library as an HTML email
 */
export function formatLibraryReportHtml(games: Game[]): string {
  const totalGames = games.length;
  const statusCounts = games.reduce((acc: Record<string, number>, game) => {
    (game.status || []).forEach((s) => {
      acc[s] = (acc[s] || 0) + 1;
    });
    return acc;
  }, {});

  // Playtime calculation helper
  const parsePlaytimeToMinutes = (playtimeStr: string): number => {
    if (!playtimeStr) return 0;
    const match = playtimeStr.match(/(\d+)\s*h\s*(\d+)\s*m/i) || playtimeStr.match(/(\d+)\s*h/i);
    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      return hours * 60 + minutes;
    }
    // Try raw number of hours
    const num = parseInt(playtimeStr, 10);
    return isNaN(num) ? 0 : num * 60;
  };

  const totalMinutes = games.reduce((sum, g) => sum + parsePlaytimeToMinutes(g.playtime || ""), 0);
  const totalHoursStr = `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;

  const topRated = [...games]
    .filter((g) => g.rating && g.rating > 0)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 5);

  const topRatedRows = topRated
    .map(
      (g) => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #1f1f23; color: #ffffff; font-weight: bold;">${g.name}</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #1f1f23; color: #e4e4e7;">${g.platform || "PC"}</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #1f1f23; color: #fbbf24; font-weight: bold; font-family: monospace;">${"★".repeat(Math.floor(g.rating || 0))} (${g.rating}/5)</td>
    </tr>
  `
    )
    .join("");

  const statusRows = Object.entries(statusCounts)
    .map(
      ([status, count]) => `
    <div style="display: inline-block; width: 45%; margin-bottom: 12px; margin-right: 5%;">
      <span style="color: #a1a1aa; font-size: 13px;">${status}:</span>
      <span style="color: #ffffff; font-weight: bold; font-size: 15px; margin-left: 5px;">${count}</span>
    </div>
  `
    )
    .join("");

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #f4f4f5; padding: 30px; border-radius: 20px; max-width: 650px; margin: 0 auto; border: 1px solid #27272a;">
      <div style="text-align: center; margin-bottom: 25px;">
        <span style="font-size: 40px; display: block; margin-bottom: 10px;">📊</span>
        <h2 style="margin: 0; color: #c084fc; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">Relatório de Status da Biblioteca</h2>
        <p style="margin: 5px 0 0 0; color: #a1a1aa; font-size: 12px;">Enviado da Biblioteca de Jogos do Haleck</p>
      </div>
      
      <hr style="border: 0; border-top: 1px solid #27272a; margin-bottom: 25px;" />

      <!-- High-level numbers -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <tr>
          <td style="width: 50%; padding-right: 10px;">
            <div style="background-color: #1e1b4b; border: 1px solid #312e81; padding: 15px; border-radius: 12px; text-align: center;">
              <span style="color: #a5b4fc; font-size: 11px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Total de Jogos</span>
              <span style="display: block; font-size: 32px; font-weight: 900; color: #ffffff; margin-top: 5px;">${totalGames}</span>
            </div>
          </td>
          <td style="width: 50%; padding-left: 10px;">
            <div style="background-color: #0c4a6e; border: 1px solid #0369a1; padding: 15px; border-radius: 12px; text-align: center;">
              <span style="color: #7dd3fc; font-size: 11px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Tempo de Jogo Total</span>
              <span style="display: block; font-size: 24px; font-weight: 900; color: #ffffff; margin-top: 12px; font-family: monospace;">${totalHoursStr}</span>
            </div>
          </td>
        </tr>
      </table>

      <!-- Distributions -->
      <div style="background-color: #18181b; padding: 20px; border-radius: 12px; margin-bottom: 25px; border: 1px solid #27272a;">
        <h3 style="margin: 0 0 15px 0; color: #22d3ee; font-size: 15px; text-transform: uppercase; letter-spacing: 1.5px;">Distribuição de Status</h3>
        <div style="box-sizing: border-box; width: 100%;">
          ${statusRows}
        </div>
      </div>

      <!-- Top Games -->
      ${
        topRated.length > 0
          ? `<div style="background-color: #18181b; padding: 20px; border-radius: 12px; margin-bottom: 25px; border: 1px solid #27272a;">
              <h3 style="margin: 0 0 15px 0; color: #f472b6; font-size: 15px; text-transform: uppercase; letter-spacing: 1.5px;">Jogos Favoritos (Melhores Notas)</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="text-align: left;">
                    <th style="padding-bottom: 8px; color: #71717a; border-bottom: 1px solid #27272a;">Título</th>
                    <th style="padding-bottom: 8px; color: #71717a; border-bottom: 1px solid #27272a;">Plataforma</th>
                    <th style="padding-bottom: 8px; color: #71717a; border-bottom: 1px solid #27272a;">Avaliação</th>
                  </tr>
                </thead>
                <tbody>
                  ${topRatedRows}
                </tbody>
              </table>
             </div>`
          : ""
      }

      <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #27272a; font-size: 11px; color: #71717a;">
        Relatório gerado em ${new Date().toLocaleDateString("pt-BR")}. Desenvolvido via Haleck Library.
      </div>
    </div>
  `;
}
