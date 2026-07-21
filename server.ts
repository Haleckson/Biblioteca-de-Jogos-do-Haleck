import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { HowLongToBeatService } from "howlongtobeat";
import * as cheerio from "cheerio";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const PORT = 3000;
const hltbService = new HowLongToBeatService();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Helper to parse HLTB Game ID from URL or raw string
function parseHltbId(input: string): string | null {
  const cleaned = input.trim();
  if (!cleaned) return null;

  // If it's just a sequence of digits
  if (/^\d+$/.test(cleaned)) {
    return cleaned;
  }

  try {
    // Handle potential URL inputs
    let urlStr = cleaned;
    if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
      urlStr = "https://" + cleaned;
    }
    const url = new URL(urlStr);
    
    if (url.hostname.includes("howlongtobeat.com")) {
      // Matches /game/12345 or /game/12345-slug
      const pathMatch = url.pathname.match(/\/game\/(\d+)/);
      if (pathMatch) {
        return pathMatch[1];
      }
      
      // Matches ?id=12345
      const idParam = url.searchParams.get("id");
      if (idParam && /^\d+$/.test(idParam)) {
        return idParam;
      }
    }
  } catch (e) {
    // If not a valid URL structure, try to regex find /game/ID
  }

  const matches = cleaned.match(/\/game\/(\d+)/);
  if (matches) {
    return matches[1];
  }

  return null;
}

// Convert hours like "1h 33m", "12½" to 12.5, or "12" to 12
function parseTimeToNumber(timeStr: string): number {
  if (!timeStr) return 0;
  let cleaned = timeStr.trim();
  if (cleaned === "" || cleaned.startsWith("--") || cleaned === "-") return 0;

  // Check if it has hours and minutes like "1h 33m" or "1 h 33 m"
  const hMatch = cleaned.match(/([\d\.]+)\s*h/i);
  const mMatch = cleaned.match(/([\d\.]+)\s*m/i);
  
  if (hMatch || mMatch) {
    let hours = 0;
    let minutes = 0;
    if (hMatch) hours = parseFloat(hMatch[1]) || 0;
    if (mMatch) minutes = parseFloat(mMatch[1]) || 0;
    return hours + (minutes / 60);
  }

  // Check if it is in minutes only, like "45 Mins" or "45 min"
  if (cleaned.toLowerCase().includes("min") || cleaned.toLowerCase().includes("mins")) {
    const minsMatch = cleaned.match(/([\d\.]+)/);
    if (minsMatch) {
      const mins = parseFloat(minsMatch[1]) || 0;
      return mins / 60;
    }
  }

  // If it contains "½"
  let hasHalf = false;
  if (cleaned.includes("½")) {
    hasHalf = true;
    cleaned = cleaned.replace("½", "");
  }

  // Pure decimal or number
  const numMatch = cleaned.replace(/,/g, ".").match(/([\d\.]+)/);
  if (numMatch) {
    let val = parseFloat(numMatch[1]) || 0;
    if (hasHalf) val += 0.5;
    return val;
  }

  return 0;
}

// Fallback HTML Scraper when the library fails or is blocked
async function fetchHltbDetailFallback(id: string) {
  const url = `https://howlongtobeat.com/game/${id}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://howlongtobeat.com/"
    }
  });

  if (!response.ok) {
    throw new Error(`Servidor HLTB retornou status ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // 1. Get Game Name
  let name = "";
  try {
    const headerEl = $('div[class*=GameHeader_profile_header__]');
    if (headerEl.length > 0) {
      name = headerEl.text().replace(/[\n\t\r]+/g, " ").trim();
    }
  } catch (e) {}

  if (!name) {
    const titleMatch = html.match(/<title>How long is\s+([\s\S]+?)\?\s+\|\s+HowLongToBeat<\/title>/i) 
      || html.match(/<title>([\s\S]+?)\s+-\s+HowLongToBeat<\/title>/i);
    name = titleMatch ? titleMatch[1].trim() : "Jogo HLTB";
  }

  // 2. Extract times
  let gameplayMain = 0;
  let gameplayMainExtra = 0;
  let gameplayCompletionist = 0;

  const parseTimeStr = (text: string): number => {
    return parseTimeToNumber(text);
  };

  // A. Try parsing from HTML tables FIRST (highly reliable and exact for Main Story, Main + Extras, Completionist)
  try {
    $("table").each(function () {
      const tableHeaders = $(this).find("thead th, thead td, tr:first-child td, tr:first-child th").map((_, el) => $(el).text().trim().toLowerCase()).get();
      const avgIndex = tableHeaders.findIndex(h => h.includes("average"));
      if (avgIndex !== -1) {
        $(this).find("tbody tr, tr.spreadsheet").each(function () {
          const rowCells = $(this).find("td").map((_, el) => $(el).text().trim()).get();
          if (rowCells.length > avgIndex) {
            const rowLabel = rowCells[0].toLowerCase().trim();
            const avgValue = rowCells[avgIndex];
            const timeVal = parseTimeStr(avgValue);
            if (timeVal) {
              if (rowLabel === "main story" || rowLabel.includes("main story")) {
                gameplayMain = timeVal;
              } else if (rowLabel === "main + extras" || rowLabel === "main + extra" || rowLabel.includes("main + extras") || rowLabel.includes("main + extra")) {
                gameplayMainExtra = timeVal;
              } else if (rowLabel === "completionist" || rowLabel.includes("completionist")) {
                gameplayCompletionist = timeVal;
              }
            }
          }
        });
      }
    });
  } catch (err) {
    console.error("Erro ao analisar tabelas de tempos do HLTB:", err);
  }

  const processPair = (type: string, valText: string) => {
    const typeClean = type.trim().toLowerCase();
    const timeVal = parseTimeStr(valText);
    if (!timeVal) return;

    if (
      typeClean.includes("main story") || 
      typeClean.includes("single-player") || 
      typeClean.includes("solo") ||
      typeClean === "main"
    ) {
      if (gameplayMain === 0) gameplayMain = timeVal;
    } else if (
      typeClean.includes("main + extra") || 
      typeClean.includes("main + sides") || 
      typeClean.includes("main+extra") || 
      typeClean.includes("main+sides") || 
      typeClean.includes("co-op")
    ) {
      if (gameplayMainExtra === 0) gameplayMainExtra = timeVal;
    } else if (
      typeClean.includes("completionist") || 
      typeClean.includes("vs.") || 
      typeClean.includes("100%")
    ) {
      if (gameplayCompletionist === 0) gameplayCompletionist = timeVal;
    }
  };

  // B. Fallback 1: Try parsing from elements containing GameStats_game_times__
  if (gameplayMain === 0 || gameplayMainExtra === 0 || gameplayCompletionist === 0) {
    const liElements = $('div[class*=GameStats_game_times__] li, li[class*=GameStats_game_times__], div[class*=GameStats_game_times__] div');
    liElements.each(function () {
      const h4Text = $(this).find('h4').text().trim();
      const h5Text = $(this).find('h5').text().trim();
      if (h4Text && h5Text) {
        processPair(h4Text, h5Text);
      }
    });
  }

  // C. Fallback 2: Sibling scan fallback
  if (gameplayMain === 0 || gameplayMainExtra === 0 || gameplayCompletionist === 0) {
    $('h4').each(function() {
      const typeText = $(this).text().trim();
      const siblingH5 = $(this).siblings('h5').text().trim() || $(this).parent().find('h5').text().trim();
      if (typeText && siblingH5) {
        processPair(typeText, siblingH5);
      }
    });
  }

  // D. Fallback 3: Regex scan fallback
  const findTimeForLabel = (labelPattern: string): number => {
    const escapedPattern = labelPattern.replace(/\+/g, '\\+');
    const labelRegex = new RegExp(`(?:${escapedPattern})[\\s\\S]{1,150}?(?:<h5>|<div>|class="[^"]*time[^"]*"[^>]*>)\\s*([\\d\\.\\s½]+)\\s*(?:Hours?|Mins?|h)?`, 'i');
    const match = html.match(labelRegex);
    if (match && match[1]) {
      return parseTimeToNumber(match[1].trim());
    }
    return 0;
  };

  if (gameplayMain === 0) {
    gameplayMain = findTimeForLabel("Main Story") || findTimeForLabel("Single-Player") || findTimeForLabel("Solo");
  }
  if (gameplayMainExtra === 0) {
    gameplayMainExtra = findTimeForLabel("Main \\+ Extra") || findTimeForLabel("Main \\+ Sides") || findTimeForLabel("Co-Op");
  }
  if (gameplayCompletionist === 0) {
    gameplayCompletionist = findTimeForLabel("Completionist") || findTimeForLabel("Vs\\.");
  }

  return {
    id,
    name,
    gameplayMain,
    gameplayMainExtra,
    gameplayCompletionist
  };
}

// HowLongToBeat API route (Supports ID/URL lookup & Search as fallback)
app.get("/api/hltb", async (req, res) => {
  const urlParam = req.query.url as string;
  const queryParam = req.query.q as string;

  // 1. If we got a URL/ID parameter (Preferred)
  if (urlParam) {
    const hltbId = parseHltbId(urlParam);
    if (!hltbId) {
      res.status(400).json({ error: "Link do HowLongToBeat inválido. Cole um link como 'https://howlongtobeat.com/game/10270' ou digite o ID do jogo." });
      return;
    }

    // Try our beautiful custom scraper FIRST to ensure we grab "Main + Extra" correctly!
    try {
      console.log(`Buscando detalhes do HLTB por scraper para o ID: ${hltbId}`);
      const fallbackResult = await fetchHltbDetailFallback(hltbId);
      res.json(fallbackResult);
      return;
    } catch (err: any) {
      console.warn("Erro no scraper de fallback, tentando biblioteca original:", err);
      try {
        const result = await hltbService.detail(hltbId);
        res.json(result);
        return;
      } catch (libErr: any) {
        console.error("Ambas as tentativas falharam:", libErr);
        res.status(500).json({ error: "Não foi possível carregar os dados deste jogo do HowLongToBeat." });
        return;
      }
    }
  }

  // 2. If we only got a search query parameter 'q'
  if (queryParam) {
    try {
      const results = await hltbService.search(queryParam);
      res.json(results);
    } catch (err: any) {
      console.error("Erro ao buscar no HLTB por termo:", err);
      res.status(500).json({ error: "Erro ao realizar busca no HLTB. Por favor, cole o link direto do jogo para buscar." });
    }
    return;
  }

  res.status(400).json({ error: "Informe o parâmetro 'url' ou 'q'." });
});

// Helper to fetch and parse Metacritic details
async function fetchMetacriticDetail(urlStr: string, platformCode?: string) {
  let targetUrl = urlStr.trim();
  if (!targetUrl) throw new Error("Link do Metacritic não fornecido.");

  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    targetUrl = "https://" + targetUrl;
  }

  let slug: string | null = null;
  try {
    const urlObj = new URL(targetUrl);
    if (!urlObj.hostname.includes("metacritic.com")) {
      throw new Error("O link fornecido deve ser do site metacritic.com");
    }
    const slugMatch = urlObj.pathname.match(/^\/game\/([a-zA-Z0-9-]+)/);
    slug = slugMatch ? slugMatch[1] : null;
  } catch (e: any) {
    throw new Error(e.message || "Link do Metacritic inválido.");
  }

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.metacritic.com/"
  };

  const response = await fetch(targetUrl, { headers });
  if (!response.ok) {
    throw new Error(`Servidor Metacritic retornou status ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract available platforms from links
  const platformsMap = new Map<string, string>();
  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (href && (href.includes("/critic-reviews/") || href.includes("/user-reviews/")) && href.includes("platform=")) {
      try {
        const u = new URL(href, "https://www.metacritic.com");
        const code = u.searchParams.get("platform");
        if (code && !platformsMap.has(code)) {
          const logoText = $(el).find(".game-platform-logo__text").text().trim();
          const svgTitle = $(el).find("svg title").text().trim();
          const text = $(el).text().trim();
          let name = logoText || svgTitle || text.split("Based on")[0].trim() || code;
          
          if (name.toLowerCase().includes("view all") || name.toLowerCase().includes("latest") || name.toLowerCase().includes("critic reviews") || name.toLowerCase().includes("user reviews")) {
            name = code.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
          }
          platformsMap.set(code, name);
        }
      } catch (e) {}
    }
  });

  const platforms = Array.from(platformsMap.entries()).map(([code, name]) => ({ code, name }));

  let metascore: number | null = null;
  let userScore: number | null = null;

  if (platformCode && slug) {
    // Fetch specific platform pages
    const criticUrl = `https://www.metacritic.com/game/${slug}/critic-reviews/?platform=${platformCode}`;
    const userUrl = `https://www.metacritic.com/game/${slug}/user-reviews/?platform=${platformCode}`;

    try {
      const cRes = await fetch(criticUrl, { headers });
      if (cRes.ok) {
        const cHtml = await cRes.text();
        const $c = cheerio.load(cHtml);
        const critText = $c(".score-card-left__score-number").first().text().trim();
        if (critText && !isNaN(critText as any)) {
          metascore = parseInt(critText, 10);
        }
      }
    } catch (e) {
      console.error("Error fetching platform critic score:", e);
    }

    try {
      const uRes = await fetch(userUrl, { headers });
      if (uRes.ok) {
        const uHtml = await uRes.text();
        const $u = cheerio.load(uHtml);
        const userText = $u(".score-card-left__score-number").first().text().trim();
        if (userText && !isNaN(userText as any)) {
          userScore = parseFloat(userText);
        }
      }
    } catch (e) {
      console.error("Error fetching platform user score:", e);
    }
  }

  // Fallback to standard main page selectors if still null
  if (metascore === null) {
    $('[data-testid="global-score-value"]').each((_, el) => {
      const text = $(el).text().trim().replace(",", ".");
      const val = parseFloat(text);
      if (!isNaN(val)) {
        const parent = $(el).parent();
        const wrapper = $(el).closest('[data-testid="global-score-value-wrapper"]');
        const title = (
          $(el).attr("title") ||
          parent.attr("title") ||
          wrapper.attr("title") ||
          $(el).attr("aria-label") ||
          parent.attr("aria-label") ||
          wrapper.attr("aria-label") ||
          ""
        ).toLowerCase();

        if (title.includes("metascore") && metascore === null) {
          if (val >= 0 && val <= 100) {
            metascore = Math.round(val);
          }
        } else if (title.includes("user score") && userScore === null) {
          if (val >= 0 && val <= 10) {
            userScore = val;
          }
        }
      }
    });
  }

  // 2. Try parsing JSON-LD scripts
  if (metascore === null || userScore === null) {
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const content = $(el).text();
        const parsed = JSON.parse(content);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          if (item.aggregateRating) {
            const rating = item.aggregateRating;
            const best = rating.bestRating ? String(rating.bestRating) : "100";
            const val = parseFloat(rating.ratingValue);
            if (!isNaN(val)) {
              if (best === "100" && metascore === null) {
                if (val >= 0 && val <= 100) {
                  metascore = Math.round(val);
                }
              } else if (best === "10" && userScore === null) {
                if (val >= 0 && val <= 10) {
                  userScore = val;
                }
              }
            }
          }
        }
      } catch (e) {
        // ignore
      }
    });
  }

  // 3. Try parsing Next.js / Nuxt initial state or script variables
  if (metascore === null || userScore === null) {
    $('script').each((_, el) => {
      const content = $(el).text();
      if (content.includes("metascore") || content.includes("userScore")) {
        const msMatch = content.match(/"metascore"\s*:\s*(\d+)/i) || content.match(/"metaScore"\s*:\s*(\d+)/i);
        if (msMatch && msMatch[1] && metascore === null) {
          const val = parseFloat(msMatch[1]);
          if (val >= 0 && val <= 100) {
            metascore = Math.round(val);
          }
        }
        const usMatch = content.match(/"userScore"\s*:\s*([\d\.]+)/i);
        if (usMatch && usMatch[1] && userScore === null) {
          const val = parseFloat(usMatch[1]);
          if (val >= 0 && val <= 10) {
            userScore = val;
          }
        }
      }
    });
  }

  // 4. Try DOM selectors for score elements
  if (metascore === null) {
    $('[class*="c-productScoreInfo_scoreNumber"], [class*="c-productScoreInfo_scoreNumber"] span, .metascore_w').each((_, el) => {
      const text = $(el).text().trim().replace(",", ".");
      const val = parseInt(text, 10);
      if (!isNaN(val) && val >= 0 && val <= 100 && metascore === null) {
        metascore = val;
      }
    });
  }

  if (userScore === null) {
    $('[class*="c-siteReviewHeader_userScore"], [class*="c-siteReviewHeader_userScore"] span, [class*="c-userScore_scoreNumber"], [class*="c-userScore_scoreNumber"] span, .metascore_w.user').each((_, el) => {
      const text = $(el).text().trim().replace(",", ".");
      const val = parseFloat(text);
      if (!isNaN(val) && val >= 0 && val <= 10 && userScore === null) {
        userScore = val;
      }
    });
  }

  // 5. Try broad Regex Fallbacks on the HTML body
  if (metascore === null) {
    const msRegex = /class="[^"]*c-productScoreInfo_scoreNumber[^"]*">[^]*?<span>(\d+)<\/span>/i;
    const match = html.match(msRegex);
    if (match && match[1]) {
      const val = parseInt(match[1]);
      if (val >= 0 && val <= 100) {
        metascore = val;
      }
    }
  }

  if (userScore === null) {
    const usRegex = /class="[^"]*(?:c-siteReviewHeader_userScore|c-userScore_scoreNumber)[^"]*">[^]*?<span>([\d\.,]+)<\/span>/i;
    const match = html.match(usRegex);
    if (match && match[1]) {
      const parsedUserScore = parseFloat(match[1].replace(",", "."));
      if (!isNaN(parsedUserScore) && parsedUserScore >= 0 && parsedUserScore <= 10) {
        userScore = parsedUserScore;
      }
    }
  }

  return {
    metacriticUrl: targetUrl,
    metacriticCritScore: metascore,
    metacriticUserScore: userScore,
    platforms
  };
}

// Metacritic API route
app.get("/api/metacritic", async (req, res) => {
  const urlParam = req.query.url as string;
  const platformParam = req.query.platform as string;
  if (!urlParam) {
    res.status(400).json({ error: "Informe o parâmetro 'url'." });
    return;
  }

  try {
    const result = await fetchMetacriticDetail(urlParam, platformParam);
    res.json(result);
  } catch (err: any) {
    console.error("Erro no scraper do Metacritic:", err);
    res.status(500).json({ error: err.message || "Não foi possível carregar os dados deste jogo do Metacritic." });
  }
});

// Helper to parse Steam dates into YYYY-MM-DD
function parseSteamDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const parsed = Date.parse(dateStr);
    if (!isNaN(parsed)) {
      return new Date(parsed).toISOString().split("T")[0];
    }
    const monthsPtMap: { [key: string]: number } = {
      jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11
    };
    const cleaned = dateStr.toLowerCase().replace(/de/g, "").replace(/\s+/g, " ");
    const parts = cleaned.split(" ");
    if (parts.length >= 3) {
      const day = parseInt(parts[0], 10);
      const year = parseInt(parts[parts.length - 1], 10);
      let month = 0;
      for (const [key, value] of Object.entries(monthsPtMap)) {
        if (cleaned.includes(key)) {
          month = value;
          break;
        }
      }
      if (!isNaN(day) && !isNaN(year)) {
        const d = new Date(year, month, day);
        return d.toISOString().split("T")[0];
      }
    }
  } catch (e) {}
  return dateStr;
}

interface WikipediaInfo {
  summary: string;
  rawText: string;
  pageTitle: string;
}

// Helper to fetch Portuguese Wikipedia summary and raw text for a game
async function fetchWikipediaData(title: string): Promise<WikipediaInfo | null> {
  try {
    const searchUrl = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(title + " jogo")}&utf8=&format=json`;
    const searchRes = await fetch(searchUrl, { headers: { "User-Agent": "GameVault/1.0" } });
    if (!searchRes.ok) return null;
    const searchJson = await searchRes.json();
    const result = searchJson.query?.search?.[0];
    const pageId = result?.pageid;
    const pageTitle = result?.title || "";
    if (!pageId) return null;

    const detailUrl = `https://pt.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&redirects=1&pageids=${pageId}&format=json`;
    const detailRes = await fetch(detailUrl, { headers: { "User-Agent": "GameVault/1.0" } });
    if (!detailRes.ok) return null;
    const detailJson = await detailRes.json();
    const extract = detailJson.query?.pages?.[pageId]?.extract;
    if (extract) {
      const sentences = extract.split(/[.!?]/).map((s: string) => s.trim()).filter(Boolean);
      const summary = sentences.slice(0, 3).join(". ") + ".";
      return {
        summary,
        rawText: extract,
        pageTitle
      };
    }
  } catch (e) {
    console.error("Erro ao buscar dados no Wikipedia:", e);
  }
  return null;
}

async function fetchWikipediaSummary(title: string): Promise<string> {
  const data = await fetchWikipediaData(title);
  return data ? data.summary : "";
}

function parsePortugueseDate(text: string): string | null {
  const months = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho", 
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];
  
  // Look for "D de MONTH de YYYY" or "DD de MONTH de YYYY"
  const dateMatch = text.match(/(\d{1,2})\s+de\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/i);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]).toString().padStart(2, "0");
    const monthIndex = months.indexOf(dateMatch[2].toLowerCase()) + 1;
    const month = monthIndex.toString().padStart(2, "0");
    const year = dateMatch[3];
    return `${year}-${month}-${day}`;
  }
  return null;
}

function extractDetailsFromText(text: string, title: string) {
  let developer = "";
  let publisher = "";
  let releaseDate = "";
  let genres: string[] = [];
  let series = "";

  const lowerText = text.toLowerCase();

  // 1. Genres extraction
  const genreKeywords = [
    { key: "mmorpg", name: "MMORPG" },
    { key: "mmo", name: "MMO" },
    { key: "rpg", name: "RPG" },
    { key: "estratégia", name: "Estratégia" },
    { key: "tiro", name: "Tiro (FPS)" },
    { key: "fps", name: "Tiro (FPS)" },
    { key: "plataforma", name: "Plataforma" },
    { key: "ação", name: "Ação" },
    { key: "aventura", name: "Aventura" },
    { key: "simulação", name: "Simulação" },
    { key: "corrida", name: "Corrida" },
    { key: "esporte", name: "Esporte" },
    { key: "luta", name: "Luta" },
    { key: "sobrevivência", name: "Sobrevivência" },
    { key: "terror", name: "Terror" },
    { key: "puzzle", name: "Quebra-cabeça" },
    { key: "quebra-cabeça", name: "Quebra-cabeça" },
    { key: "sandbox", name: "Sandbox" },
    { key: "metroidvania", name: "Metroidvania" },
    { key: "roguelike", name: "Roguelike" },
    { key: "moba", name: "MOBA" }
  ];

  genreKeywords.forEach(g => {
    if (lowerText.includes(g.key)) {
      if (!genres.includes(g.name)) genres.push(g.name);
    }
  });

  // 2. Release date extraction
  const ptDate = parsePortugueseDate(text);
  if (ptDate) {
    releaseDate = ptDate;
  } else {
    const years = text.match(/\b(19\d{2}|20[0-2]\d)\b/g);
    if (years && years.length > 0) {
      const releaseIndex = lowerText.indexOf("lançado");
      if (releaseIndex !== -1) {
        const sub = text.substring(releaseIndex, releaseIndex + 150);
        const subYears = sub.match(/\b(19\d{2}|20[0-2]\d)\b/);
        if (subYears) {
          releaseDate = `${subYears[0]}-01-01`;
        }
      }
      if (!releaseDate) {
        releaseDate = `${years[0]}-01-01`;
      }
    }
  }

  // 3. Developer / Publisher extraction
  const popularCompanies = [
    "Blizzard Entertainment", "Blizzard", "Valve", "Ubisoft", "Electronic Arts", "EA", "BioWare",
    "Square Enix", "Capcom", "Nintendo", "Sony Interactive Entertainment", "Sony", "Microsoft", "Xbox Game Studios",
    "Bethesda Game Studios", "Bethesda", "Rockstar Games", "Rockstar", "CD Projekt Red", "CD Projekt",
    "Bungie", "Insomniac Games", "Naughty Dog", "Sega", "Atlus", "Bandai Namco", "Konami", "Epic Games",
    "Mojang", "Riot Games", "FromSoftware", "Obsidian Entertainment", "Respawn Entertainment", "Santa Monica Studio",
    "Guerrilla Games", "Bioware", "Larian Studios", "Supergiant Games", "Remedy Entertainment", "PlatinumGames"
  ];

  for (const company of popularCompanies) {
    const rx = new RegExp(`\\b${company}\\b`, "i");
    if (rx.test(text)) {
      developer = company;
      publisher = company;
      break;
    }
  }

  if (!developer) {
    const devMatch = text.match(/(?:desenvolvido|produzido)\s+pela?\s+([A-Z][a-zA-Z\s&]+?)(?=\s+(?:e\s+publicado|para|em|no|com|,|\.))/i);
    if (devMatch && devMatch[1]) {
      developer = devMatch[1].trim();
    }
  }
  if (!publisher) {
    const pubMatch = text.match(/(?:publicado|distribuído)\s+pela?\s+([A-Z][a-zA-Z\s&]+?)(?=\s+(?:em|para|no|com|,|\.))/i);
    if (pubMatch && pubMatch[1]) {
      publisher = pubMatch[1].trim();
    }
  }

  if (!developer) developer = "Estúdio Desconhecido";
  if (!publisher) publisher = developer !== "Estúdio Desconhecido" ? developer : "Distribuidora Desconhecida";

  // 4. Series/saga extraction
  const seriesMatch = text.match(/(?:série|franquia|série de jogos|universo)\s+([A-Z][a-zA-Z0-9\s]+?)(?=\s+(?:de|,|\.|\(|é|foi))/i);
  if (seriesMatch && seriesMatch[1]) {
    series = seriesMatch[1].trim();
  } else {
    const knownSeries = [
      "Warcraft", "StarCraft", "Diablo", "Half-Life", "Portal", "Counter-Strike", "Assassin's Creed",
      "Far Cry", "Grand Theft Auto", "Red Dead Redemption", "Mass Effect", "Dragon Age", "Final Fantasy",
      "Resident Evil", "Monster Hunter", "The Legend of Zelda", "Super Mario", "Metroid", "Pokemon", "Pokémon",
      "The Witcher", "Cyberpunk", "Elder Scrolls", "Fallout", "Doom", "Quake", "Halo", "Gears of War",
      "Uncharted", "The Last of Us", "God of War", "Silent Hill", "Castlevania", "Metal Gear", "Dark Souls",
      "Borderlands", "Civilization", "Age of Empires", "Total War", "The Sims", "Tomb Raider", "Mortal Kombat",
      "Street Fighter", "Tekken", "Sonic", "Minecraft"
    ];
    for (const s of knownSeries) {
      const rx = new RegExp(`\\b${s}\\b`, "i");
      if (rx.test(text) || rx.test(title)) {
        series = s;
        break;
      }
    }
  }

  return { developer, publisher, releaseDate, genres, series };
}

async function enhanceGamesListWithWikipedia(gamesList: any[]): Promise<any[]> {
  try {
    const enhanced = await Promise.all(
      gamesList.map(async (game) => {
        const wikiData = await fetchWikipediaData(game.name);
        if (!wikiData) {
          return {
            ...game,
            series: game.series || ""
          };
        }

        const extracted = extractDetailsFromText(wikiData.rawText, game.name);

        let summary = game.summary;
        if (!summary || summary === "Detalhes obtidos do HowLongToBeat." || summary === "Ficha técnica e diário de bordo prontos para preenchimento manual." || summary.trim().length < 10) {
          summary = wikiData.summary;
        }

        const developer = (!game.developer || game.developer === "Estúdio Desconhecido") && extracted.developer !== "Estúdio Desconhecido" 
          ? extracted.developer 
          : game.developer || "Estúdio Desconhecido";

        const publisher = (!game.publisher || game.publisher === "Distribuidora Desconhecida") && extracted.publisher !== "Distribuidora Desconhecida" 
          ? extracted.publisher 
          : game.publisher || "Distribuidora Desconhecida";

        const releaseDate = !game.releaseDate && extracted.releaseDate 
          ? extracted.releaseDate 
          : game.releaseDate || "";

        let genres = [...(game.genres || [])];
        if (genres.length === 0 || (genres.length === 2 && genres[0] === "RPG" && genres[1] === "Aventura")) {
          if (extracted.genres && extracted.genres.length > 0) {
            genres = extracted.genres;
          }
        } else if (extracted.genres) {
          extracted.genres.forEach(g => {
            if (!genres.includes(g)) genres.push(g);
          });
        }

        const series = game.series || extracted.series || "";

        return {
          ...game,
          summary,
          developer,
          publisher,
          releaseDate,
          genres,
          series
        };
      })
    );
    return enhanced;
  } catch (e) {
    console.error("Erro ao enriquecer jogos com Wikipedia:", e);
    return gamesList;
  }
}

// Lazy initializer for GoogleGenAI client with dynamic key checking and format validation
let geminiClient: GoogleGenAI | null = null;
let cachedApiKey: string | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("A chave GEMINI_API_KEY não está configurada. Por favor, adicione sua chave Gemini no menu 'Configurações > Secrets' do AI Studio.");
  }

  // Format check for Google API key
  if (apiKey && !apiKey.trim().startsWith("AIzaSy")) {
    throw new Error(
      `A chave GEMINI_API_KEY configurada ("${apiKey.substring(0, 8)}...") parece inválida.\n\n` +
      `Como corrigir:\n` +
      `1. Chaves de API válidas do Google Gemini sempre começam com as letras "AIzaSy" (ex: AIzaSyD-xxxxxxxxxxxxxxxxxxxxxxx).\n` +
      `2. Acesse o Google AI Studio (https://aistudio.google.com/), faça login e clique em "Obter chave de API" (Get API Key) para criar uma chave gratuita.\n` +
      `3. No painel lateral ou configurações ("Settings" > "Secrets"), atualize seu segredo com o nome "GEMINI_API_KEY" usando a chave nova.`
    );
  }

  if (!geminiClient || cachedApiKey !== apiKey) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    cachedApiKey = apiKey;
  }
  return geminiClient;
}

// Intelligent Game Metadata endpoint utilizing Gemini 3.5-flash with Google Search grounding,
// falling back to keyless Steam + HowLongToBeat + Wikipedia aggregation.
// Returns a list of matching games under a `{ games: [...] }` schema so users can pick the exact option.
app.get("/api/game-metadata", async (req, res) => {
  const query = req.query.q as string;
  if (!query || !query.trim()) {
    res.status(400).json({ error: "Informe o parâmetro 'q' contendo o nome do jogo." });
    return;
  }

  // A. Try Gemini 3.5-flash FIRST if the API key is configured
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = getGeminiClient();
      console.log(`Buscando até 5 opções de metadados de jogos via Gemini 3.5-flash com pesquisa no Google para: "${query}"`);

      const prompt = `Utilize a Pesquisa do Google para encontrar até 5 opções de jogos oficiais, reais e atualizados que combinem com a busca: "${query}". 
Isso serve para que o usuário possa escolher a versão/jogo exato (ex: discernir entre clássico de 1997 e o Remake de 2020).
Ordene por relevância.

Para CADA jogo encontrado, retorne dados extremamente precisos e em português (com exceção de nomes próprios de estúdios, marcas ou títulos oficiais). 
Preencha os seguintes campos de forma precisa:
- Nome do jogo (name)
- Nome da série ou saga que este jogo pertence (series) (ex: "Warcraft", "Final Fantasy", "The Legend of Zelda")
- Sinopse/Resumo curto (summary) - máximo de 3 frases em português
- Data de lançamento (releaseDate) - formato YYYY-MM-DD
- Desenvolvedora (developer)
- Distribuidora (publisher)
- Lista de gêneros (genres) - em português se aplicável (ex: "Ação", "RPG", "Aventura", "MMORPG"). CERTIFIQUE-SE de incluir o gênero exato (por exemplo, "MMORPG" para World of Warcraft, Ragnarok, etc.).
- Lista de plataformas (platforms) - ex: "PC", "PlayStation 5", "Xbox Series X/S", "Nintendo Switch"
- Nota do Metacritic (metacritic) - número inteiro entre 0 e 100
- Tempo estimado Main Story do HowLongToBeat (hltbMain) - número de horas
- Tempo estimado Main + Extras do HowLongToBeat (hltbMainExtra) - número de horas
- Tempo estimado Completionist do HowLongToBeat (hltbCompletionist) - número de horas
- URL da imagem de Capa vertical do jogo (coverUrl) - retorne uma URL pública de imagem de alta qualidade estável (pode ser do Steam CDN, IGDB, Unsplash ou outros repositórios públicos).
- URL da imagem de Ícone quadrado/logotipo do jogo (iconUrl) - retorne uma URL pública de imagem de tamanho pequeno ou quadrado estável (pode ser do Steam CDN, IGDB, Unsplash, etc.).`;

      const schema = {
        type: Type.OBJECT,
        properties: {
          games: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Official name of the game" },
                series: { type: Type.STRING, description: "Name of the game franchise/saga/series, e.g., Warcraft, Final Fantasy, Halo. Leave empty if none." },
                summary: { type: Type.STRING, description: "Short summary of the game in Portuguese, up to 3 sentences" },
                releaseDate: { type: Type.STRING, description: "Release date in YYYY-MM-DD format" },
                developer: { type: Type.STRING, description: "Developer studio name" },
                publisher: { type: Type.STRING, description: "Publisher name" },
                genres: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "List of game genres in Portuguese (e.g., Ação, Aventura, MMORPG, RPG de Estratégia)"
                },
                platforms: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "List of release platforms"
                },
                metacritic: { 
                  type: Type.INTEGER, 
                  description: "Metacritic critic score, integer 0-100" 
                },
                hltbMain: { 
                  type: Type.NUMBER, 
                  description: "HowLongToBeat Main Story completion time in hours" 
                },
                hltbMainExtra: { 
                  type: Type.NUMBER, 
                  description: "HowLongToBeat Main + Extras completion time in hours" 
                },
                hltbCompletionist: { 
                  type: Type.NUMBER, 
                  description: "HowLongToBeat Completionist completion time in hours" 
                },
                coverUrl: { 
                  type: Type.STRING, 
                  description: "Valid stable public direct URL to a high-res vertical cover image" 
                },
                iconUrl: { 
                  type: Type.STRING, 
                  description: "Valid stable public direct URL to a small or square icon/logo" 
                }
              },
              required: ["name", "summary", "releaseDate", "developer", "publisher", "genres", "platforms"]
            },
            description: "Array of matching game candidate objects"
          }
        },
        required: ["games"]
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });

      if (response.text) {
        const gameData = JSON.parse(response.text);
        if (gameData && Array.isArray(gameData.games)) {
          res.json(gameData);
          return;
        }
      }
    } catch (err: any) {
      console.warn("Erro ao buscar metadados com Gemini, acionando fallback gratuito do Steam+HLTB:", err);
    }
  }

  // B. Fallback / Alternative: Free, Keyless Online Aggregator (Steam API + HowLongToBeat + Wikipedia)
  try {
    console.log(`Buscando metadados via Aggregator Online Livre (Steam + HLTB + Wikipedia) para: "${query}"`);
    
    // Parallel calls: Steam store search & HowLongToBeat search
    const steamSearchPromise = fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=portuguese&cc=BR`)
      .then(res => res.ok ? res.json() : null)
      .catch(err => {
        console.error("Erro na busca do Steam:", err);
        return null;
      });

    const hltbSearchPromise = hltbService.search(query)
      .catch(err => {
        console.error("Erro na busca do HLTB:", err);
        return null;
      });

    const [steamSearch, hltbResults] = await Promise.all([steamSearchPromise, hltbSearchPromise]);

    const games: any[] = [];

    if (steamSearch && steamSearch.items && steamSearch.items.length > 0) {
      // Get up to 4 Steam games and fetch details in parallel
      const itemsToFetch = steamSearch.items.slice(0, 4);
      const detailPromises = itemsToFetch.map(async (item: any) => {
        const appId = item.id;
        try {
          const detailRes = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&l=portuguese`);
          if (detailRes.ok) {
            const detailJson = await detailRes.json();
            if (detailJson[appId] && detailJson[appId].success) {
              const data = detailJson[appId].data;
              let name = data.name || item.name;
              let summary = data.short_description || data.about_the_game || "";
              
              if (summary) {
                summary = summary.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
                if (summary.length > 300) {
                  summary = summary.substring(0, 300) + "...";
                }
              }
              const developer = data.developers?.[0] || "Estúdio Desconhecido";
              const publisher = data.publishers?.[0] || "Distribuidora Desconhecida";
              
              let releaseDate = "";
              if (data.release_date && data.release_date.date) {
                releaseDate = parseSteamDate(data.release_date.date);
              }
              const genres = data.genres ? data.genres.map((g: any) => g.description) : ["Ação", "Aventura"];
              const metacritic = data.metacritic ? data.metacritic.score : 80;
              const platforms = ["PC"];
              if (data.platforms) {
                if (data.platforms.windows && !platforms.includes("PC")) platforms.push("PC");
                if (data.platforms.mac) platforms.push("macOS");
                if (data.platforms.linux) platforms.push("Linux");
              }
              
              const coverUrl = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`;
              const iconUrl = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/capsule_184x69.jpg`;

              // Find a matching HLTB time if possible
              let hltbMain = 0;
              let hltbMainExtra = 0;
              let hltbCompletionist = 0;
              if (hltbResults && hltbResults.length > 0) {
                const lowerName = name.toLowerCase();
                const matchedHltb = hltbResults.find((h: any) => 
                  lowerName.includes(h.name.toLowerCase()) || h.name.toLowerCase().includes(lowerName)
                ) || hltbResults[0];
                if (matchedHltb) {
                  hltbMain = matchedHltb.gameplayMain || 0;
                  hltbMainExtra = matchedHltb.gameplayMainExtra || 0;
                  hltbCompletionist = matchedHltb.gameplayCompletionist || 0;
                }
              }

              return {
                name,
                summary: summary || "Ficha técnica pronta para preenchimento manual.",
                releaseDate,
                developer,
                publisher,
                genres,
                platforms,
                metacritic,
                hltbMain,
                hltbMainExtra,
                hltbCompletionist,
                coverUrl,
                iconUrl
              };
            }
          }
        } catch (e) {
          console.error(`Erro ao buscar detalhes no Steam para ${appId}:`, e);
        }
        return null;
      });

      const resolved = await Promise.all(detailPromises);
      resolved.forEach(g => {
        if (g) games.push(g);
      });
    }

    // If Steam returned nothing but HLTB has results, populate from HLTB
    if (games.length === 0 && hltbResults && hltbResults.length > 0) {
      hltbResults.slice(0, 4).forEach((h: any) => {
        const cover = h.imageUrl.startsWith("http") ? h.imageUrl : `https://howlongtobeat.com${h.imageUrl}`;
        games.push({
          name: h.name,
          summary: "Detalhes obtidos do HowLongToBeat.",
          releaseDate: "",
          developer: "Estúdio Desconhecido",
          publisher: "Distribuidora Desconhecida",
          genres: ["RPG", "Aventura"],
          platforms: ["PC", "PlayStation 5", "Xbox Series X/S", "Nintendo Switch"],
          metacritic: 80,
          hltbMain: h.gameplayMain || 0,
          hltbMainExtra: h.gameplayMainExtra || 0,
          hltbCompletionist: h.gameplayCompletionist || 0,
          coverUrl: cover,
          iconUrl: cover
        });
      });
    }

    // Ensure we have at least one entry if both failed
    if (games.length === 0) {
      games.push({
        name: query,
        summary: "Ficha técnica e diário de bordo prontos para preenchimento manual.",
        releaseDate: "",
        developer: "Estúdio Desconhecido",
        publisher: "Distribuidora Desconhecida",
        genres: ["RPG", "Aventura"],
        platforms: ["PC", "PlayStation 5", "Xbox Series X/S", "Nintendo Switch"],
        metacritic: 80,
        hltbMain: 0,
        hltbMainExtra: 0,
        hltbCompletionist: 0,
        coverUrl: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80&w=600",
        iconUrl: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80&w=150"
      });
    }

    const enhancedGames = await enhanceGamesListWithWikipedia(games);
    res.json({ games: enhancedGames });
  } catch (err: any) {
    console.error("Erro fatal no aggregator de fallback:", err);
    res.status(500).json({ error: "Não foi possível carregar os dados inteligentes do jogo online." });
  }
});

// Helper to delete an uploaded image from ImgBB via its delete_url
async function deleteFromImgBB(deleteUrl: string): Promise<boolean> {
  try {
    console.log(`Iniciando exclusão do ImgBB para a URL: ${deleteUrl}`);
    const getRes = await fetch(deleteUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
      }
    });
    if (!getRes.ok) {
      console.warn(`Não foi possível carregar a página de exclusão do ImgBB. Status: ${getRes.status}`);
      return false;
    }
    const html = await getRes.text();
    
    let authToken = "";
    const inputMatch = html.match(/name="auth_token"\s+value="([^"]+)"/) || html.match(/value="([^"]+)"\s+name="auth_token"/);
    if (inputMatch) {
      authToken = inputMatch[1];
    } else {
      const jsMatch = html.match(/auth_token\s*[:=]\s*"([^"]+)"/) || html.match(/auth_token\s*[:=]\s*'([^']+)'/);
      if (jsMatch) {
        authToken = jsMatch[1];
      }
    }
    
    console.log(`Token de exclusão extraído para ${deleteUrl}: ${authToken}`);

    const cookieHeader = getRes.headers.get("set-cookie") || "";
    
    const formData = new URLSearchParams();
    formData.append("action", "delete");
    if (authToken) {
      formData.append("auth_token", authToken);
    }
    
    const postRes = await fetch(deleteUrl, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
        ...(cookieHeader ? { "Cookie": cookieHeader } : {})
      },
      body: formData.toString()
    });
    
    console.log(`Resposta da requisição de exclusão do ImgBB para ${deleteUrl}: status ${postRes.status}`);
    return postRes.ok;
  } catch (err) {
    console.error("Erro ao deletar imagem do ImgBB:", err);
    return false;
  }
}

// Endpoint to delete media from ImgBB
app.post("/api/delete-imgbb", express.json(), async (req, res) => {
  const { deleteUrl } = req.body;
  if (!deleteUrl) {
    res.status(400).json({ error: "deleteUrl é obrigatório." });
    return;
  }
  
  const success = await deleteFromImgBB(deleteUrl);
  if (success) {
    res.json({ success: true, message: "Mídia deletada com sucesso do ImgBB." });
  } else {
    res.status(500).json({ error: "Falha ao deletar a mídia do ImgBB." });
  }
});

// Endpoint for AI-powered game journal text correction
app.post("/api/correct-text", express.json(), async (req, res) => {
  const { text, gameName } = req.body;
  if (!text) {
    res.status(400).json({ error: "O texto é obrigatório para correção." });
    return;
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      res.status(400).json({ error: "A chave GEMINI_API_KEY não está configurada no servidor." });
      return;
    }

    const ai = getGeminiClient();
    const systemPrompt = `Você é um assistente especialista em revisão de textos para diários de jogos (gaming journals). Sua tarefa é corrigir a ortografia, a gramática, a pontuação e os termos e nomes próprios específicos de lore do jogo "${gameName || "um videogame"}".

Diretrizes importantes:
1. Respeite os termos em português (PT-BR) e inglês que sejam próprios do jogo (por exemplo, nomes de personagens como "Link", "Zelda", "Ganon", itens como "Master Sword", locais como "Hyrule", "Lorule", etc.).
2. O texto de entrada é em formato HTML (pode conter tags como <p>, <b>, <i>, <br>, <ul>, <li>). Você DEVE preservar essas tags exatamente na mesma posição estrutural, corrigindo apenas o texto visível dentro delas. Não introduza novas tags HTML que não existiam, a não ser que seja para manter a estrutura correta.
3. Além de gerar o texto corrigido, forneça uma lista curta em português listando as principais correções feitas (por exemplo, erros ortográficos de nomes do jogo, ou de gramática).
4. Mantenha estritamente o tom original do autor (seja descontraído, empolgado ou focado em detalhes). Não reescreva o texto de forma formal a menos que ele já seja formal; o objetivo é puramente a correção ortográfica, de gramática e de terminologia do jogo.`;

    const prompt = `Corrija o seguinte texto do diário do jogo "${gameName || "videogame"}" seguindo as diretrizes:\n\n${text}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            correctedText: {
              type: Type.STRING,
              description: "O texto HTML totalmente corrigido, preservando as tags HTML originais intactas."
            },
            explanation: {
              type: Type.STRING,
              description: "Uma breve explicação em português (PT-BR) sobre o que foi corrigido."
            },
            changes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Lista de alterações específicas feitas (ex: ['Zellda -> Zelda', 'Sword de mestre -> Master Sword'])."
            }
          },
          required: ["correctedText", "explanation"]
        }
      }
    });

    const resText = response.text;
    if (resText) {
      const parsed = JSON.parse(resText);
      res.json(parsed);
    } else {
      res.status(500).json({ error: "Resposta vazia do modelo de IA." });
    }
  } catch (err: any) {
    console.error("Erro na rota de correção de texto:", err);
    
    const errString = err?.message || (typeof err === "object" ? JSON.stringify(err) : String(err));
    if (errString.includes("429") || errString.includes("RESOURCE_EXHAUSTED") || errString.includes("credits are depleted") || errString.includes("prepayment")) {
      res.status(429).json({
        error: "Seus créditos de pagamento antecipado (prepayment credits) no Google AI Studio foram esgotados.\n\n" +
               "Como corrigir:\n" +
               "1. Acesse as Configurações de Cobrança do Google AI Studio em https://ai.studio/projects para adicionar fundos ao seu projeto.\n" +
               "2. Ou forneça uma GEMINI_API_KEY própria com créditos ativos nas variáveis de ambiente do aplicativo (Settings > Secrets)."
      });
      return;
    }

    res.status(500).json({ error: err.message || "Erro desconhecido ao corrigir texto por IA." });
  }
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Erro crítico ao iniciar o servidor backend:", err);
});
