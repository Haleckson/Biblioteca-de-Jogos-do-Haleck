import express from "express";
import compression from "compression";
import path from "path";
import { createServer as createViteServer } from "vite";
import { HowLongToBeatService } from "howlongtobeat";
import * as cheerio from "cheerio";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import { generateWoWCharacterProfile } from "./src/utils/blizzardCharacterData";
import { enrichMountWithBlizzardMetadata, enrichPetWithBlizzardMetadata } from "./src/utils/blizzardCollectionsCatalog";
import { parseAddonData } from "./src/utils/wowAddonParser";

// Global process error handlers for backend resilience
process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ [Server Resilience] Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("⚠️ [Server Resilience] Uncaught Exception:", error);
});

const app = express();
app.set("trust proxy", true);
const PORT = 3000;
const hltbService = new HowLongToBeatService();

// Enable HTTP Compression for faster response payloads
app.use(compression());

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// --- TTL CACHING INFRASTRUCTURE FOR BACKEND PERFORMANCE ---
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class SimpleTTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxItems: number;
  private defaultTtlMs: number;
  public hits = 0;
  public misses = 0;

  constructor(defaultTtlMs = 12 * 60 * 60 * 1000, maxItems = 500) {
    this.defaultTtlMs = defaultTtlMs;
    this.maxItems = maxItems;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    if (this.cache.size >= this.maxItems) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.cache.set(key, { value, expiresAt });
  }

  get size(): number {
    return this.cache.size;
  }

  pruneExpired(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.cache.clear();
  }
}

// Single-Flight Request Coalescing (Deduplication of identical concurrent external requests)
class RequestCoalescer {
  private inFlightMap = new Map<string, Promise<any>>();

  async execute<T>(key: string, taskFn: () => Promise<T>): Promise<T> {
    if (this.inFlightMap.has(key)) {
      return this.inFlightMap.get(key) as Promise<T>;
    }

    const promise = taskFn().finally(() => {
      this.inFlightMap.delete(key);
    });

    this.inFlightMap.set(key, promise);
    return promise;
  }

  get size(): number {
    return this.inFlightMap.size;
  }
}

const requestCoalescer = new RequestCoalescer();

// Automatic Cache Garbage Collection & RAM Optimization (Every 30 minutes)
setInterval(() => {
  try {
    hltbCache.pruneExpired();
    metacriticCache.pruneExpired();
    wikiCache.pruneExpired();
    gameMetadataCache.pruneExpired();
    mediaUrlCache.pruneExpired();
    imageProxyCache.pruneExpired();
    steamGridCache.pruneExpired();
  } catch (err) {
    console.warn("Aviso na limpeza automática de cache:", err);
  }
}, 30 * 60 * 1000);

// Caches for backend routes
const hltbCache = new SimpleTTLCache<any>(12 * 60 * 60 * 1000, 300); // 12h
const metacriticCache = new SimpleTTLCache<any>(12 * 60 * 60 * 1000, 300); // 12h
const wikiCache = new SimpleTTLCache<any>(24 * 60 * 60 * 1000, 500); // 24h
const gameMetadataCache = new SimpleTTLCache<any>(6 * 60 * 60 * 1000, 200); // 6h
const mediaUrlCache = new SimpleTTLCache<any>(24 * 60 * 60 * 1000, 500); // 24h
const imageProxyCache = new SimpleTTLCache<{ contentType: string; buffer: Buffer }>(7 * 24 * 60 * 60 * 1000, 100); // 7d
const steamCache = new SimpleTTLCache<any>(30 * 60 * 1000, 300); // 30m cache for Steam API
const steamGridCache = new SimpleTTLCache<any>(24 * 60 * 60 * 1000, 500); // 24h cache for SteamGridDB

// Resilient HTTP fetch helper with configurable request timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

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
  const cached = hltbCache.get(id);
  if (cached) {
    return cached;
  }

  return requestCoalescer.execute(`hltb:${id}`, async () => {
    const cachedAgain = hltbCache.get(id);
    if (cachedAgain) return cachedAgain;

    const url = `https://howlongtobeat.com/game/${id}`;
  const response = await fetchWithTimeout(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://howlongtobeat.com/"
    }
  }, 10000);

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

  const resObj = {
    id,
    name,
    gameplayMain,
    gameplayMainExtra,
    gameplayCompletionist
  };
  hltbCache.set(id, resObj);
  return resObj;
  });
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

  const cacheKey = `${targetUrl.toLowerCase()}_${platformCode || "all"}`;
  const cached = metacriticCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  return requestCoalescer.execute(`metacritic:${cacheKey}`, async () => {
    const cachedAgain = metacriticCache.get(cacheKey);
    if (cachedAgain) return cachedAgain;

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

  const metaRes = {
    metacriticUrl: targetUrl,
    metacriticCritScore: metascore,
    metacriticUserScore: userScore,
    platforms
  };
  metacriticCache.set(cacheKey, metaRes);
  return metaRes;
  });
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
  const cacheKey = title.toLowerCase().trim();
  const cached = wikiCache.get(cacheKey);
  if (cached !== null) {
    return cached;
  }

  return requestCoalescer.execute(`wiki:${cacheKey}`, async () => {
    const cachedAgain = wikiCache.get(cacheKey);
    if (cachedAgain !== null) return cachedAgain;

    try {
      const searchUrl = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(title + " jogo")}&utf8=&format=json`;
      const searchRes = await fetchWithTimeout(searchUrl, { headers: { "User-Agent": "GameVault/1.0" } }, 8000);
      if (!searchRes.ok) return null;
      const searchJson = await searchRes.json();
      const result = searchJson.query?.search?.[0];
      const pageId = result?.pageid;
      const pageTitle = result?.title || "";
      if (!pageId) return null;

      const detailUrl = `https://pt.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&redirects=1&pageids=${pageId}&format=json`;
      const detailRes = await fetchWithTimeout(detailUrl, { headers: { "User-Agent": "GameVault/1.0" } }, 8000);
      if (!detailRes.ok) return null;
      const detailJson = await detailRes.json();
      const extract = detailJson.query?.pages?.[pageId]?.extract;
      if (extract) {
        const sentences = extract.split(/[.!?]/).map((s: string) => s.trim()).filter(Boolean);
        const summary = sentences.slice(0, 3).join(". ") + ".";
        const wikiObj = {
          summary,
          rawText: extract,
          pageTitle
        };
        wikiCache.set(cacheKey, wikiObj);
        return wikiObj;
      }
    } catch (e) {
      console.error("Erro ao buscar dados no Wikipedia:", e);
    }
    return null;
  });
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

  const cacheKey = query.trim().toLowerCase();
  const cached = gameMetadataCache.get(cacheKey);
  if (cached) {
    res.json(cached);
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
          gameMetadataCache.set(cacheKey, gameData);
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
    const finalPayload = { games: enhancedGames };
    gameMetadataCache.set(cacheKey, finalPayload);
    res.json(finalPayload);
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

// Endpoint to proxy image downloads for Drive backup without CORS restrictions
app.get("/api/proxy-image", async (req, res) => {
  const imageUrl = req.query.url as string;
  if (!imageUrl || (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://"))) {
    res.status(400).json({ error: "URL de imagem inválida." });
    return;
  }

  const cachedImg = imageProxyCache.get(imageUrl);
  if (cachedImg) {
    const etag = `W/"${cachedImg.buffer.length}-${Buffer.from(imageUrl).toString("base64").slice(0, 16)}"`;
    if (req.headers["if-none-match"] === etag) {
      res.status(304).end();
      return;
    }
    res.setHeader("Content-Type", cachedImg.contentType);
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    res.setHeader("ETag", etag);
    res.setHeader("X-Cache", "HIT");
    res.send(cachedImg.buffer);
    return;
  }

  try {
    const result = await requestCoalescer.execute(`proxy:${imageUrl}`, async () => {
      const cachedAgain = imageProxyCache.get(imageUrl);
      if (cachedAgain) return cachedAgain;

      const imgRes = await fetchWithTimeout(imageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        },
      }, 12000);

      if (!imgRes.ok) {
        throw new Error(`Erro ao buscar imagem externa (${imgRes.status}): ${imgRes.statusText}`);
      }

      const contentType = imgRes.headers.get("content-type") || "image/jpeg";
      const arrayBuffer = await imgRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const entry = { contentType, buffer };
      imageProxyCache.set(imageUrl, entry);
      return entry;
    });

    const etag = `W/"${result.buffer.length}-${Buffer.from(imageUrl).toString("base64").slice(0, 16)}"`;
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    res.setHeader("ETag", etag);
    res.setHeader("X-Cache", "MISS");
    res.send(result.buffer);
  } catch (err: any) {
    console.error("Erro no proxy de imagem do servidor:", err);
    res.status(500).json({ error: err.message || "Erro interno ao buscar imagem no servidor." });
  }
});

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

// Sliding window rate limiter for ImgBB uploads to prevent free API key overuse
const uploadTimestamps: number[] = [];
let serverKeyRotationIndex = 0;

const USER_PRIMARY_IMGBB_KEYS = [
  "d07333dc40c5b1fe0f66d09fa89b5d16",
  "14cb1f70bff72d67fc860a47350c78f6",
  "417e3c8ef8818541b71a8b95d68b57e9",
  "7f8dee027277949a5586e9185d278c4b",
];

const PUBLIC_FALLBACK_KEYS = [
  "34add11536701ed08c43cbc6cde2f6bf",
  "eb752d15c3cb1ed336abd69821bc4129",
  "8a4ef757a3e811f5bb2b4505372338d4",
  "c345330a5991ee7eebf0b691238ebf5c",
  "6d257f6977864e8354c0e64c4c95d9e5",
  "010a301ec9c792942bf9e0f6cbfbb740",
];

// Endpoint to upload media to ImgBB securely from server side
app.post("/api/upload-imgbb", express.json({ limit: "50mb" }), async (req, res) => {
  try {
    const { image, name, userApiKey } = req.body;
    if (!image) {
      res.status(400).json({ error: "O parâmetro 'image' é obrigatório para upload." });
      return;
    }

    // Rate limiting check: max 40 requests in any 30-second window
    const now = Date.now();
    while (uploadTimestamps.length > 0 && now - uploadTimestamps[0] > 30000) {
      uploadTimestamps.shift();
    }

    if (uploadTimestamps.length >= 40) {
      res.status(429).json({
        error: "Muitos uploads enviados em pouco tempo. O sistema aguardará para proteger seu limite do ImgBB.",
        rateLimit: true,
      });
      return;
    }

    uploadTimestamps.push(now);

    const userKey = typeof userApiKey === "string" ? userApiKey.trim() : "";
    const envKey = (
      process.env.VITE_IMGBB_API_KEY ||
      process.env.IMGBB_API_KEY ||
      process.env.IMGBB_KEY ||
      ""
    ).trim();

    const candidateKeys: string[] = [];

    // 1. If explicit custom key passed from UI modal, prioritize it
    if (userKey) candidateKeys.push(userKey);

    // 2. Rotate through the user's pool of 4 active ImgBB keys
    const poolSize = USER_PRIMARY_IMGBB_KEYS.length;
    const offset = serverKeyRotationIndex % poolSize;
    serverKeyRotationIndex++;

    for (let i = 0; i < poolSize; i++) {
      const key = USER_PRIMARY_IMGBB_KEYS[(offset + i) % poolSize];
      if (!candidateKeys.includes(key)) candidateKeys.push(key);
    }

    // 3. Environment key if set
    if (envKey && !candidateKeys.includes(envKey)) candidateKeys.push(envKey);

    // 4. Legacy fallback keys
    PUBLIC_FALLBACK_KEYS.forEach((fk) => {
      if (!candidateKeys.includes(fk)) candidateKeys.push(fk);
    });

    // Prepare binary Blob from base64 for ImgBB upload
    let base64Data = image;
    let mimeType = "image/png";
    if (typeof image === "string" && image.includes("base64,")) {
      const parts = image.split("base64,");
      base64Data = parts[1];
      const mimeMatch = parts[0].match(/data:(image\/[a-zA-Z0-9\+\-\.]+);/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
      }
    }

    const imageBuffer = Buffer.from(base64Data, "base64");
    const blob = new Blob([imageBuffer], { type: mimeType });
    const ext = mimeType === "image/webp" ? "webp" : mimeType === "image/jpeg" ? "jpg" : mimeType === "image/gif" ? "gif" : "png";
    const filename = name ? (name.includes(".") ? name : `${name}.${ext}`) : `image.${ext}`;

    let lastErrorMsg = "";
    let lastStatusCode = 400;

    for (let i = 0; i < candidateKeys.length; i++) {
      const currentKey = candidateKeys[i];
      const isFallback = PUBLIC_FALLBACK_KEYS.includes(currentKey);

      const formData = new FormData();
      formData.append("image", blob, filename);
      if (name) {
        formData.append("name", name);
      }

      console.log(`[Server ImgBB Upload] Tentando chave ${i + 1}/${candidateKeys.length}: ${currentKey.substring(0, 6)}... (isFallback: ${isFallback})`);

      try {
        const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${currentKey}`, {
          method: "POST",
          body: formData,
        });

        const responseText = await imgbbRes.text();
        let payload: any = null;
        try {
          payload = JSON.parse(responseText);
        } catch {
          // JSON parse error
        }

        if (imgbbRes.ok && payload?.data) {
          const directUrl = payload.data.url || payload.data.image?.url || payload.data.display_url;
          if (directUrl) {
            res.json({
              url: directUrl,
              deleteUrl: payload.data.delete_url,
            });
            return;
          }
        }

        lastStatusCode = imgbbRes.status;
        lastErrorMsg = payload?.error?.message || responseText || "Erro no serviço do ImgBB";
        console.warn(`[Server ImgBB Upload] Chave ${currentKey.substring(0, 6)}... falhou (${lastStatusCode}): ${lastErrorMsg}`);
      } catch (keyErr: any) {
        console.warn(`[Server ImgBB Upload] Exceção na chave ${currentKey.substring(0, 6)}...:`, keyErr?.message || keyErr);
        lastErrorMsg = keyErr?.message || "Erro ao se conectar ao ImgBB";
      }
    }

    res.status(lastStatusCode || 400).json({
      error: `A chave pública do ImgBB atingiu o limite de requisições (Rate Limit).\n\n` +
             `Como resolver:\n` +
             `1. Obtenha uma chave gratuita em https://api.imgbb.com/\n` +
             `2. Insira sua chave no botão de Configurações do ImgBB no topo da página.`,
      isFallbackKey: true,
      details: lastErrorMsg,
    });
  } catch (err: any) {
    console.error("Erro interno ao processar upload do ImgBB no servidor:", err);
    res.status(500).json({ error: err.message || "Erro interno no servidor ao fazer upload." });
  }
});

// Endpoint to resolve ImgBB viewer page links into direct image URLs
app.get("/api/resolve-media-url", async (req, res) => {
  const urlParam = req.query.url as string;
  if (!urlParam) {
    res.status(400).json({ error: "Parâmetro 'url' é obrigatório." });
    return;
  }

  let cleanedUrl = urlParam.trim();
  if (cleanedUrl.startsWith("http://")) {
    cleanedUrl = cleanedUrl.replace("http://", "https://");
  }

  const cachedResolved = mediaUrlCache.get(cleanedUrl);
  if (cachedResolved) {
    res.json(cachedResolved);
    return;
  }

  // If it's already a direct i.ibb.co / i.ibb.co.com link or ends with a direct image extension
  if (
    cleanedUrl.match(/^https?:\/\/i\.ibb\.co(\.com)?\//i) ||
    cleanedUrl.match(/\.(png|jpg|jpeg|gif|webp|svg)($|\?)/i)
  ) {
    const directResult = { url: cleanedUrl, isDirect: true };
    mediaUrlCache.set(cleanedUrl, directResult);
    res.json(directResult);
    return;
  }

  // If it's an ImgBB page URL (e.g. https://ibb.co/XXXXX or https://ibb.co.com/XXXXX)
  if (cleanedUrl.match(/^https?:\/\/(www\.)?ibb\.co(\.com)?\//i)) {
    try {
      const response = await fetchWithTimeout(cleanedUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      }, 8000);

      if (response.ok) {
        const html = await response.text();
        // Extract og:image meta tag
        const ogImageMatch =
          html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
          html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);

        // Extract twitter:image meta tag as backup
        const twitterImageMatch =
          html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i) ||
          html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']twitter:image["']/i);

        // Extract img tag with id="embed-image-element" or src with i.ibb.co
        const imgTagMatch = html.match(/<img[^>]+src=["'](https?:\/\/i\.ibb\.co(?:\.com)?[^"']+)["']/i);

        const directUrl = ogImageMatch?.[1] || twitterImageMatch?.[1] || imgTagMatch?.[1];

        if (directUrl) {
          const resolvedObj = { url: directUrl, resolved: true, original: urlParam };
          mediaUrlCache.set(cleanedUrl, resolvedObj);
          res.json(resolvedObj);
          return;
        }
      }
    } catch (err: any) {
      console.warn(`[Resolve Media URL] Falha ao resolver ${cleanedUrl}:`, err?.message || err);
    }
  }

  // Return cleaned URL as fallback
  const fallbackObj = { url: cleanedUrl, resolved: false, original: urlParam };
  mediaUrlCache.set(cleanedUrl, fallbackObj);
  res.json(fallbackObj);
});

// --- STEAM WEB API INTEGRATION PROXY ENDPOINTS ---
const DEFAULT_STEAM_KEY = "AE886B79CDBCCE021188A42F2263D210";
const DEFAULT_STEAM_ID64 = "76561198066251037";

// 1. Get Player Summary / Profile
app.get("/api/steam/profile", async (req, res) => {
  try {
    const key = (req.query.key as string) || process.env.STEAM_API_KEY || DEFAULT_STEAM_KEY;
    const steamid = (req.query.steamid as string) || process.env.STEAM_ID64 || DEFAULT_STEAM_ID64;

    if (!key || !steamid) {
      res.status(400).json({ error: "Chave da API Steam e Steam ID64 são obrigatórios." });
      return;
    }

    const cacheKey = `steam:profile:${steamid}`;
    const cached = steamCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const targetUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${encodeURIComponent(key)}&steamids=${encodeURIComponent(steamid)}`;
    const steamRes = await fetchWithTimeout(targetUrl, {}, 8000);
    if (!steamRes.ok) {
      res.status(steamRes.status).json({ error: "Falha ao se comunicar com a API da Steam." });
      return;
    }

    const data = await steamRes.json();
    const players = data?.response?.players;
    const profile = Array.isArray(players) && players.length > 0 ? players[0] : null;

    const result = { success: true, profile };
    steamCache.set(cacheKey, result, 5 * 60 * 1000); // 5 min cache for live profile
    res.json(result);
  } catch (err: any) {
    console.warn("Erro no proxy /api/steam/profile:", err?.message || err);
    res.status(500).json({ error: "Erro interno no servidor de proxy da Steam." });
  }
});

// 2. Get Owned Games
app.get("/api/steam/owned-games", async (req, res) => {
  try {
    const key = (req.query.key as string) || process.env.STEAM_API_KEY || DEFAULT_STEAM_KEY;
    const steamid = (req.query.steamid as string) || process.env.STEAM_ID64 || DEFAULT_STEAM_ID64;

    if (!key || !steamid) {
      res.status(400).json({ error: "Chave da API Steam e Steam ID64 são obrigatórios." });
      return;
    }

    const cacheKey = `steam:owned:${steamid}`;
    const cached = steamCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const targetUrl = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${encodeURIComponent(key)}&steamid=${encodeURIComponent(steamid)}&include_appinfo=true&include_played_free_games=true&format=json`;
    const steamRes = await fetchWithTimeout(targetUrl, {}, 12000);
    if (!steamRes.ok) {
      res.status(steamRes.status).json({ error: "Falha ao obter jogos da Steam." });
      return;
    }

    const data = await steamRes.json();
    const games = data?.response?.games || [];

    const result = { success: true, count: games.length, games };
    steamCache.set(cacheKey, result, 15 * 60 * 1000); // 15 min cache
    res.json(result);
  } catch (err: any) {
    console.warn("Erro no proxy /api/steam/owned-games:", err?.message || err);
    res.status(500).json({ error: "Erro interno ao buscar biblioteca da Steam." });
  }
});

// 3. Get Recently Played Games
app.get("/api/steam/recent-games", async (req, res) => {
  try {
    const key = (req.query.key as string) || process.env.STEAM_API_KEY || DEFAULT_STEAM_KEY;
    const steamid = (req.query.steamid as string) || process.env.STEAM_ID64 || DEFAULT_STEAM_ID64;

    const cacheKey = `steam:recent:${steamid}`;
    const cached = steamCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const targetUrl = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${encodeURIComponent(key)}&steamid=${encodeURIComponent(steamid)}&format=json`;
    const steamRes = await fetchWithTimeout(targetUrl, {}, 8000);
    if (!steamRes.ok) {
      res.status(steamRes.status).json({ error: "Falha ao obter jogos recentes da Steam." });
      return;
    }

    const data = await steamRes.json();
    const games = data?.response?.games || [];

    const result = { success: true, count: games.length, games };
    steamCache.set(cacheKey, result, 10 * 60 * 1000);
    res.json(result);
  } catch (err: any) {
    console.warn("Erro no proxy /api/steam/recent-games:", err?.message || err);
    res.status(500).json({ error: "Erro interno ao buscar jogos recentes da Steam." });
  }
});

// 4. Get Game Achievements for User
app.get("/api/steam/achievements", async (req, res) => {
  try {
    const key = (req.query.key as string) || process.env.STEAM_API_KEY || DEFAULT_STEAM_KEY;
    const steamid = (req.query.steamid as string) || process.env.STEAM_ID64 || DEFAULT_STEAM_ID64;
    const appid = req.query.appid as string;

    if (!appid) {
      res.status(400).json({ error: "App ID do jogo é obrigatório." });
      return;
    }

    const cacheKey = `steam:achievements:${steamid}:${appid}`;
    const cached = steamCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const playerAchievementsUrl = `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?key=${encodeURIComponent(key)}&steamid=${encodeURIComponent(steamid)}&appid=${encodeURIComponent(appid)}&l=portuguese`;
    const schemaUrl = `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${encodeURIComponent(key)}&appid=${encodeURIComponent(appid)}&l=portuguese`;
    const globalPercentUrl = `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=${encodeURIComponent(appid)}`;

    // Fetch player achievements, schema, and global stats in parallel
    const [achRes, schemaRes, globalRes] = await Promise.allSettled([
      fetchWithTimeout(playerAchievementsUrl, {}, 8000),
      fetchWithTimeout(schemaUrl, {}, 8000),
      fetchWithTimeout(globalPercentUrl, {}, 8000),
    ]);

    if (achRes.status !== "fulfilled" || !achRes.value.ok) {
      // Game may not have achievements or profile stats are private
      res.status(404).json({ success: false, error: "Sem conquistas disponíveis para este jogo ou perfil." });
      return;
    }

    const data = await achRes.value.json();
    const playerstats = data?.playerstats;
    if (!playerstats || playerstats.success === false) {
      res.status(404).json({ success: false, error: "Sem dados de conquistas disponíveis." });
      return;
    }

    let schemaMap = new Map<string, { name?: string; description?: string; icon?: string; icongray?: string }>();
    if (schemaRes.status === "fulfilled" && schemaRes.value.ok) {
      try {
        const schemaJson = await schemaRes.value.json();
        const schemaAchList = schemaJson?.game?.availableGameStats?.achievements || [];
        for (const item of schemaAchList) {
          if (item.name) {
            schemaMap.set(item.name, {
              name: item.displayName || item.name,
              description: item.description || "",
              icon: item.icon || "",
              icongray: item.icongray || "",
            });
          }
        }
      } catch (e) {
        console.warn("Erro ao processar esquema da Steam:", e);
      }
    }

    let globalPercentMap = new Map<string, number>();
    if (globalRes.status === "fulfilled" && globalRes.value.ok) {
      try {
        const globalJson = await globalRes.value.json();
        const globalList = globalJson?.achievementpercentages?.achievements || [];
        for (const item of globalList) {
          if (item.name && typeof item.percent === "number") {
            globalPercentMap.set(item.name, Math.round(item.percent * 10) / 10);
          }
        }
      } catch (e) {
        console.warn("Erro ao processar porcentagens globais da Steam:", e);
      }
    }

    const rawAchievements = playerstats.achievements || [];
    const enrichedAchievements = rawAchievements.map((ach: any) => {
      const schemaItem = schemaMap.get(ach.apiname);
      const globalPercent = globalPercentMap.get(ach.apiname);

      return {
        apiname: ach.apiname,
        achieved: ach.achieved,
        unlocktime: ach.unlocktime || 0,
        name: ach.name || schemaItem?.name || ach.apiname,
        description: ach.description || schemaItem?.description || "",
        icon: schemaItem?.icon || "",
        icongray: schemaItem?.icongray || "",
        globalPercent: globalPercent !== undefined ? globalPercent : undefined,
        isUltraRare: globalPercent !== undefined && globalPercent <= 10,
      };
    });

    const totalCount = enrichedAchievements.length;
    const unlockedCount = enrichedAchievements.filter((a: any) => a.achieved === 1).length;
    const percentage = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

    const result = {
      success: true,
      gameName: playerstats.gameName,
      achievements: enrichedAchievements,
      unlockedCount,
      totalCount,
      percentage,
    };

    steamCache.set(cacheKey, result, 30 * 60 * 1000); // 30 min cache
    res.json(result);
  } catch (err: any) {
    console.warn(`Erro no proxy /api/steam/achievements para appid ${req.query.appid}:`, err?.message || err);
    res.status(500).json({ error: "Erro interno ao buscar conquistas na Steam." });
  }
});

// 5. Get Steam Store Game Details
app.get("/api/steam/game-details", async (req, res) => {
  try {
    const appid = req.query.appid as string;
    if (!appid) {
      res.status(400).json({ error: "App ID do jogo é obrigatório." });
      return;
    }

    const cacheKey = `steam:appdetails:${appid}`;
    const cached = steamCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const targetUrl = `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(appid)}&cc=br&l=portuguese`;
    const steamRes = await fetchWithTimeout(targetUrl, {}, 8000);
    if (!steamRes.ok) {
      res.status(steamRes.status).json({ error: "Falha ao obter detalhes do jogo na Steam Store." });
      return;
    }

    const data = await steamRes.json();
    const appData = data?.[appid]?.data;

    const result = { success: !!appData, data: appData || null };
    steamCache.set(cacheKey, result, 60 * 60 * 1000); // 1h cache
    res.json(result);
  } catch (err: any) {
    console.warn(`Erro no proxy /api/steam/game-details para appid ${req.query.appid}:`, err?.message || err);
    res.status(500).json({ error: "Erro interno ao buscar detalhes na loja da Steam." });
  }
});

// --- GOG GALAXY API INTEGRATION PROXY ENDPOINTS ---
const gogCache = new SimpleTTLCache<any>(30 * 60 * 1000, 300);
const GOG_CLIENT_ID = "46899977096215655";
const GOG_CLIENT_SECRET = "9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9";
const GOG_REDIRECT_URI = "https://embed.gog.com/on_login_success?origin=client";

// Known GOG store ID <-> Galaxy client product ID mappings for popular games
const GOG_GAME_ID_ALIASES: Record<string, string[]> = {
  // Cyberpunk 2077 (Base, Phantom Liberty, Ultimate Edition, Galaxy Client IDs)
  "2093619782": ["1423049311", "1274966284", "1256837418", "1728135898", "2093619782", "51254394747352345", "51457199105436657"],
  "1423049311": ["2093619782", "1274966284", "1256837418", "1728135898", "1423049311", "51254394747352345", "51457199105436657"],
  "1274966284": ["1423049311", "2093619782", "1256837418", "1728135898", "1274966284", "51254394747352345", "51457199105436657"],
  "1256837418": ["2093619782", "1423049311", "1274966284", "1728135898", "1256837418", "51254394747352345", "51457199105436657"],
  "1728135898": ["2093619782", "1423049311", "1274966284", "1256837418", "1728135898", "51254394747352345", "51457199105436657"],
  "51254394747352345": ["2093619782", "1423049311", "1274966284", "1256837418", "1728135898", "51254394747352345", "51457199105436657"],
  "51457199105436657": ["2093619782", "1423049311", "1274966284", "1256837418", "1728135898", "51254394747352345", "51457199105436657"],
  // The Witcher: Enhanced Edition (Witcher 1)
  "1207658924": ["1207658924", "49733479681143810"],
  "49733479681143810": ["1207658924", "49733479681143810"],
  // The Witcher 2: Assassins of Kings Enhanced Edition
  "1207658930": ["1207658930", "49733479681143820"],
  "49733479681143820": ["1207658930", "49733479681143820"],
  // The Witcher 3: Wild Hunt & Complete / GOTY Editions
  "1495134320": ["1640424747", "1640498114", "1207658934", "1495134320", "49733479681143825", "49733479681143826"],
  "1640424747": ["1495134320", "1640498114", "1207658934", "1640424747", "49733479681143825", "49733479681143826"],
  "1640498114": ["1495134320", "1640424747", "1207658934", "1640498114", "49733479681143825", "49733479681143826"],
  "1207658934": ["1495134320", "1640424747", "1640498114", "1207658934", "49733479681143825", "49733479681143826"],
  "49733479681143825": ["1495134320", "1640424747", "1640498114", "1207658934", "49733479681143825", "49733479681143826"],
  "49733479681143826": ["1495134320", "1640424747", "1640498114", "1207658934", "49733479681143825", "49733479681143826"],
  // Thronebreaker: The Witcher Tales
  "1297352383": ["1297352383", "51351187425251412"],
  "51351187425251412": ["1297352383", "51351187425251412"],
  // Gwent
  "1971471926": ["1971471926", "51010355152220194"],
  "51010355152220194": ["1971471926", "51010355152220194"],
  // The Witcher Adventure Game
  "1207666883": ["1207666883"],
};

function parseGogUsername(raw: string): string {
  if (!raw) return "";
  let clean = raw.trim();
  if (clean.includes("gog.com/u/")) {
    const parts = clean.split("gog.com/u/");
    if (parts[1]) {
      clean = parts[1].split("/")[0].split("?")[0].trim();
    }
  } else if (clean.includes("gog.com/user/")) {
    const parts = clean.split("gog.com/user/");
    if (parts[1]) {
      clean = parts[1].split("/")[0].split("?")[0].trim();
    }
  } else if (clean.includes("@") && !clean.includes("gog.com")) {
    clean = clean.split("@")[0];
  }
  return clean.replace(/^@/, "");
}

function isValidGogBearerToken(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  const trimmed = token.trim();
  if (!trimmed || trimmed.startsWith("gog_oauth_") || trimmed.length < 20) return false;
  return true;
}

function extractGogPlaytimeMinutes(obj: any): number {
  if (!obj) return 0;

  const sanitizeMinutes = (val: any): number => {
    if (typeof val === "number" && !isNaN(val) && val > 0 && val < 500000) {
      // Reject if value is equal to known GOG IDs (> 100,000 or in aliases) or epoch timestamps (> 1,000,000)
      const strVal = String(Math.round(val));
      if (GOG_GAME_ID_ALIASES[strVal] || val > 300000) {
        return 0;
      }
      return Math.round(val);
    }
    return 0;
  };

  if (typeof obj === "number") {
    return sanitizeMinutes(obj);
  }

  if (typeof obj !== "object") return 0;

  // 1. Direct minutes candidates
  const minuteCandidates = [
    obj.stats?.playtime,
    obj.stats?.playtime_minutes,
    obj.stats?.total_playtime,
    obj.playtime_minutes,
    obj.total_playtime,
    obj.playtime,
    obj.minutes,
    obj.gameplay?.playtime,
    obj.gameplay?.minutes,
    obj.gameplay?.total_playtime,
  ];

  for (const c of minuteCandidates) {
    if (typeof c === "number") {
      const sanitized = sanitizeMinutes(c);
      if (sanitized > 0) return sanitized;
    }
    if (typeof c === "string" && c.trim()) {
      const match = c.match(/(\d+(?:\.\d+)?)/);
      if (match) {
        const parsed = parseFloat(match[1]);
        if (parsed > 0) {
          const inMin = c.toLowerCase().includes("h") ? Math.round(parsed * 60) : Math.round(parsed);
          const sanitized = sanitizeMinutes(inMin);
          if (sanitized > 0) return sanitized;
        }
      }
    }
  }

  // 2. Direct hours candidates
  if (typeof obj.stats?.hours === "number") {
    const sanitized = sanitizeMinutes(obj.stats.hours * 60);
    if (sanitized > 0) return sanitized;
  }
  if (typeof obj.hours === "number") {
    const sanitized = sanitizeMinutes(obj.hours * 60);
    if (sanitized > 0) return sanitized;
  }

  // 3. Duration in seconds (GOG sessions API sometimes returns seconds)
  if (typeof obj.duration === "number" && obj.duration > 0 && obj.duration < 18000000) {
    const sanitized = sanitizeMinutes(obj.duration / 60);
    if (sanitized > 0) return sanitized;
  }

  // 4. Sum of sessions/items
  const sessions = obj.sessions || obj.items || obj.stats?.sessions;
  if (Array.isArray(sessions) && sessions.length > 0) {
    let sumMin = 0;
    for (const s of sessions) {
      if (typeof s?.time === "number") {
        const sm = sanitizeMinutes(s.time);
        if (sm > 0) sumMin += sm;
      } else if (typeof s?.duration === "number" && s.duration > 0 && s.duration < 18000000) {
        const sm = sanitizeMinutes(s.duration / 60);
        if (sm > 0) sumMin += sm;
      } else if (typeof s?.minutes === "number") {
        const sm = sanitizeMinutes(s.minutes);
        if (sm > 0) sumMin += sm;
      }
    }
    if (sumMin > 0 && sumMin < 300000) return sumMin;
  }

  return 0;
}

function extractGogAuthCode(rawInput: string): string {
  if (!rawInput) return "";
  const trimmed = rawInput.trim();
  if (trimmed.includes("code=")) {
    const match = trimmed.match(/[?&]code=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return match[1];
    }
  }
  return trimmed;
}

// 0. OAuth2 Exchange Code for Token
app.post("/api/gog/exchange-code", async (req, res) => {
  try {
    const { code: rawCode } = req.body || {};
    const code = extractGogAuthCode(rawCode || "");

    if (!code) {
      res.status(400).json({ error: "Código de autorização ou URL da GOG é obrigatório." });
      return;
    }

    const tokenUrl = `https://auth.gog.com/token?client_id=${GOG_CLIENT_ID}&client_secret=${GOG_CLIENT_SECRET}&grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(GOG_REDIRECT_URI)}`;

    const tokenRes = await fetchWithTimeout(tokenUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json"
      }
    }, 10000);

    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => "");
      console.warn("Falha no exchange token da GOG:", tokenRes.status, errText);
      res.status(400).json({
        error: "Código de autorização inválido ou expirado. Por favor, tente fazer login novamente na GOG.",
        details: errText
      });
      return;
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const userId = tokenData.user_id ? String(tokenData.user_id) : "";
    const expiresIn = tokenData.expires_in || 3600;
    const expiresAt = Date.now() + (expiresIn * 1000);

    let username = `GOG_User_${userId}`;
    let email = "";
    let avatarUrl = `https://avatar.gog.com/${encodeURIComponent(userId || "gog")}.jpg`;
    let gamesCount = 0;

    try {
      const userRes = await fetchWithTimeout("https://embed.gog.com/userData.json", {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Accept": "application/json"
        }
      }, 6000);
      if (userRes.ok) {
        const userData = await userRes.json();
        if (userData && userData.username) username = userData.username;
        if (userData && userData.email) email = userData.email;
        if (userData && userData.avatar) avatarUrl = userData.avatar;
      }
    } catch (e) {
      console.warn("Aviso ao buscar userData.json da GOG com token:", e);
    }

    try {
      const gamesRes = await fetchWithTimeout("https://embed.gog.com/user/data/games", {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Accept": "application/json"
        }
      }, 6000);
      if (gamesRes.ok) {
        const gamesData = await gamesRes.json();
        const owned = gamesData?.owned || gamesData?.games || (Array.isArray(gamesData) ? gamesData : []);
        if (Array.isArray(owned)) {
          gamesCount = owned.length;
        }
      }
    } catch (e) {}

    res.json({
      success: true,
      accessToken,
      refreshToken,
      expiresAt,
      userId,
      username,
      email,
      avatarUrl,
      gamesCount,
    });
  } catch (err: any) {
    console.error("Erro no proxy /api/gog/exchange-code:", err?.message || err);
    res.status(500).json({ error: "Erro interno no servidor ao autenticar com a GOG." });
  }
});

// 0.1 OAuth2 Refresh Token
app.post("/api/gog/refresh-token", async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      res.status(400).json({ error: "Refresh token é obrigatório." });
      return;
    }

    const tokenUrl = `https://auth.gog.com/token?client_id=${GOG_CLIENT_ID}&client_secret=${GOG_CLIENT_SECRET}&grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`;

    const tokenRes = await fetchWithTimeout(tokenUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json"
      }
    }, 10000);

    if (!tokenRes.ok) {
      res.status(400).json({ error: "Não foi possível renovar a sessão da GOG. Faça login novamente." });
      return;
    }

    const tokenData = await tokenRes.json();
    const expiresIn = tokenData.expires_in || 3600;

    res.json({
      success: true,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken,
      expiresAt: Date.now() + (expiresIn * 1000),
      userId: tokenData.user_id ? String(tokenData.user_id) : "",
    });
  } catch (err: any) {
    console.error("Erro no proxy /api/gog/refresh-token:", err?.message || err);
    res.status(500).json({ error: "Erro interno ao renovar token da GOG." });
  }
});

// 1. Get GOG Player Profile
app.get("/api/gog/profile", async (req, res) => {
  try {
    const rawUser = (req.query.username as string) || "";
    const username = parseGogUsername(rawUser);
    const userId = (req.query.userId as string) || "";
    const rawToken = (req.query.token as string) || "";
    const token = isValidGogBearerToken(rawToken) ? rawToken : "";

    if (!username && !userId && !token) {
      res.status(400).json({ error: "Nome de usuário, token ou perfil da GOG é obrigatório." });
      return;
    }

    const cacheKey = `gog:profile:${token || username || userId}`;
    const cached = gogCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    let profileData: any = {
      username: username || `GOG_User_${userId}`,
      userId: userId || `gog_${Date.now().toString().slice(-6)}`,
      avatarUrl: `https://avatar.gog.com/${encodeURIComponent(username || userId || "gog")}.jpg`,
      gamesCount: 0,
    };

    if (token) {
      try {
        const userRes = await fetchWithTimeout("https://embed.gog.com/userData.json", {
          headers: {
            "Authorization": `Bearer ${token}`,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "application/json"
          }
        }, 6000);
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData && userData.username) profileData.username = userData.username;
          if (userData && userData.userId) profileData.userId = String(userData.userId);
          if (userData && userData.avatar) profileData.avatarUrl = userData.avatar;
        }
      } catch (e) {}

      try {
        const gamesRes = await fetchWithTimeout("https://embed.gog.com/user/data/games", {
          headers: {
            "Authorization": `Bearer ${token}`,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "application/json"
          }
        }, 6000);
        if (gamesRes.ok) {
          const gamesData = await gamesRes.json();
          const owned = gamesData?.owned || gamesData?.games || (Array.isArray(gamesData) ? gamesData : []);
          if (Array.isArray(owned)) {
            profileData.gamesCount = owned.length;
          }
        }
      } catch (e) {}
    }

    const result = { success: true, profile: profileData };
    gogCache.set(cacheKey, result, 10 * 60 * 1000);
    res.json(result);
  } catch (err: any) {
    console.warn("Erro no proxy /api/gog/profile:", err?.message || err);
    res.status(500).json({ error: "Erro interno no servidor ao buscar perfil da GOG." });
  }
});

// 2. Get GOG Owned Games / Catalog Search
app.get("/api/gog/owned-games", async (req, res) => {
  try {
    const rawUser = (req.query.username as string) || "";
    const username = parseGogUsername(rawUser);
    const userId = (req.query.userId as string) || "";
    const rawToken = (req.query.token as string) || "";
    const token = isValidGogBearerToken(rawToken) ? rawToken : "";
    const query = (req.query.query as string) || "";

    const cacheKey = `gog:owned:${token || username || userId}:${query}`;
    const cached = gogCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    let games: any[] = [];
    const statsMap = new Map<string, { playtime: number; lastPlayed?: number; title?: string }>();

    // Helper to extract products from stats response
    const processStatsData = (sData: any) => {
      const products = sData?.products || (Array.isArray(sData) ? sData : []);
      if (Array.isArray(products)) {
        for (const p of products) {
          const pId = String(p.id || p.productId || "");
          const pt = extractGogPlaytimeMinutes(p);
          const pTitle = p.title || p.name || "";
          let lastPlayed: number | undefined = undefined;
          if (p.stats?.last_played) {
            lastPlayed = Math.floor(new Date(p.stats.last_played).getTime() / 1000);
          } else if (p.last_played) {
            lastPlayed = Math.floor(new Date(p.last_played).getTime() / 1000);
          }

          if (pId) {
            const existing = statsMap.get(pId);
            const maxPt = Math.max(existing?.playtime || 0, pt);
            statsMap.set(pId, {
              playtime: maxPt,
              lastPlayed: lastPlayed || existing?.lastPlayed,
              title: pTitle || existing?.title,
            });

            // Also map all known aliases
            if (GOG_GAME_ID_ALIASES[pId]) {
              for (const alias of GOG_GAME_ID_ALIASES[pId]) {
                if (alias !== pId) {
                  const exAlias = statsMap.get(alias);
                  statsMap.set(alias, {
                    playtime: Math.max(exAlias?.playtime || 0, maxPt),
                    lastPlayed: lastPlayed || exAlias?.lastPlayed,
                    title: pTitle || exAlias?.title,
                  });
                }
              }
            }
          }
        }
      }
    };

    // If username or token is present, fetch user stats feed (multi-page)
    if (username || token) {
      const statsUser = username || (token ? "current" : "");
      if (statsUser) {
        const pagesToFetch = [1, 2, 3, 4, 5];
        for (const page of pagesToFetch) {
          const statsUrls = [
            `https://www.gog.com/u/${encodeURIComponent(statsUser)}/games/stats?sort=recent_playtime&order=desc&page=${page}`,
            `https://embed.gog.com/u/${encodeURIComponent(statsUser)}/games/stats?sort=recent_playtime&order=desc&page=${page}`,
            query ? `https://www.gog.com/u/${encodeURIComponent(statsUser)}/games/stats?search=${encodeURIComponent(query)}&page=${page}` : null,
          ].filter(Boolean) as string[];

          for (const sUrl of statsUrls) {
            try {
              // Try with token if available
              if (token) {
                try {
                  const sRes = await fetchWithTimeout(sUrl, {
                    headers: {
                      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                      "Accept": "application/json",
                      "Authorization": `Bearer ${token}`,
                    }
                  }, 4000);
                  if (sRes.ok) {
                    const sData = await sRes.json();
                    processStatsData(sData);
                    continue;
                  }
                } catch {}
              }

              // Public fallback without auth header
              const publicRes = await fetchWithTimeout(sUrl, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                  "Accept": "application/json",
                }
              }, 4000);
              if (publicRes.ok) {
                const sData = await publicRes.json();
                processStatsData(sData);
              }
            } catch {}
          }
        }
      }
    }

    if (token) {
      try {
        const gamesRes = await fetchWithTimeout("https://embed.gog.com/user/data/games", {
          headers: {
            "Authorization": `Bearer ${token}`,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "application/json"
          }
        }, 8000);
        if (gamesRes.ok) {
          const rawGamesData = await gamesRes.json();
          const rawOwned = rawGamesData?.owned || (Array.isArray(rawGamesData) ? rawGamesData : []);
          if (Array.isArray(rawOwned) && rawOwned.length > 0) {
            games = rawOwned.map((g: any) => {
              if (typeof g === "number" || typeof g === "string") {
                const sId = String(g);
                const sStat = statsMap.get(sId);
                return {
                  id: sId,
                  title: sStat?.title || `Jogo GOG (${sId})`,
                  playtime_minutes: sStat?.playtime || 0,
                  last_played_timestamp: sStat?.lastPlayed,
                };
              }
              const sId = String(g.id || g.productId);
              const sStat = statsMap.get(sId);
              const playtime = Math.max(extractGogPlaytimeMinutes(g), sStat?.playtime || 0);
              return {
                id: sId,
                title: g.title || g.name || sStat?.title || "Jogo GOG",
                slug: g.slug || "",
                playtime_minutes: playtime,
                last_played_timestamp: g.last_played ? Math.floor(new Date(g.last_played).getTime() / 1000) : sStat?.lastPlayed,
                img_icon_url: g.image || g.cover || (g.images ? (g.images.logo || g.images.box) : undefined),
              };
            });
          }
        }
      } catch (e) {
        console.warn("Aviso ao buscar user/data/games da GOG:", e);
      }
    }

    // If games is still empty but statsMap has games, convert statsMap into games array
    if (games.length === 0 && statsMap.size > 0) {
      const addedIds = new Set<string>();
      statsMap.forEach((stat, pId) => {
        if (!addedIds.has(pId)) {
          addedIds.add(pId);
          games.push({
            id: pId,
            title: stat.title || `Jogo GOG (${pId})`,
            playtime_minutes: stat.playtime,
            last_played_timestamp: stat.lastPlayed,
          });
        }
      });
    }

    if (query || games.length === 0) {
      try {
        const searchQuery = query || "Cyberpunk Witcher";
        const catRes = await fetchWithTimeout(`https://catalog.gog.com/v1/catalog?limit=30&query=${encodeURIComponent(searchQuery)}`, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        }, 6000);
        if (catRes.ok) {
          const catData = await catRes.json();
          const products = catData?.products || [];
          const catalogGames = products.map((p: any) => {
            const pId = String(p.id);
            const sStat = statsMap.get(pId);
            return {
              id: pId,
              title: p.title,
              slug: p.slug || "",
              playtime_minutes: sStat?.playtime || 0,
              last_played_timestamp: sStat?.lastPlayed,
              img_icon_url: p.coverHorizontal || p.coverVertical,
            };
          });

          if (games.length === 0) {
            games = catalogGames;
          } else if (query) {
            const existingIds = new Set(games.map((g) => String(g.id)));
            for (const cg of catalogGames) {
              if (!existingIds.has(cg.id)) games.push(cg);
            }
          }
        }
      } catch (e) {
        console.warn("Erro ao buscar catálogo GOG:", e);
      }
    }

    const result = { success: true, count: games.length, games };
    gogCache.set(cacheKey, result, 15 * 60 * 1000);
    res.json(result);
  } catch (err: any) {
    console.warn("Erro no proxy /api/gog/owned-games:", err?.message || err);
    res.status(500).json({ error: "Erro interno ao buscar jogos da GOG." });
  }
});

// 3. Get GOG Achievements
app.get("/api/gog/achievements", async (req, res) => {
  try {
    const rawGameId = (req.query.gameId as string) || "";
    const username = parseGogUsername((req.query.username as string) || "");
    const userId = (req.query.userId as string) || "";
    const rawToken = (req.query.token as string) || "";
    const token = isValidGogBearerToken(rawToken) ? rawToken : "";

    if (!rawGameId) {
      res.status(400).json({ error: "ID do jogo na GOG é obrigatório." });
      return;
    }

    const cacheKey = `gog:achievements:${rawGameId}:${token || userId || username}`;
    const cached = gogCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    let gameName = "Jogo GOG";
    let achievements: any[] = [];

    const idsToCheck = [rawGameId];
    if (GOG_GAME_ID_ALIASES[rawGameId]) {
      for (const alias of GOG_GAME_ID_ALIASES[rawGameId]) {
        if (!idsToCheck.includes(alias)) idsToCheck.push(alias);
      }
    }

    for (const gid of idsToCheck) {
      try {
        const prodRes = await fetchWithTimeout(`https://api.gog.com/products/${encodeURIComponent(gid)}`, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        }, 5000);
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          if (prodData && prodData.title) {
            gameName = prodData.title;
            break;
          }
        }
      } catch (e) {}
    }

    const authHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Accept": "application/json",
    };
    if (token) {
      authHeaders["Authorization"] = `Bearer ${token}`;
    }

    for (const gid of idsToCheck) {
      if (achievements.length > 0) break;

      const endpointsToTry: string[] = [];
      if (userId && token) {
        endpointsToTry.push(`https://gameplay.gog.com/clients/${encodeURIComponent(gid)}/users/${encodeURIComponent(userId)}/achievements`);
      }
      if (token) {
        endpointsToTry.push(`https://gameplay.gog.com/clients/${encodeURIComponent(gid)}/achievements`);
      }
      endpointsToTry.push(`https://gameplay.gog.com/v2/games/${encodeURIComponent(gid)}/achievements`);

      for (const url of endpointsToTry) {
        try {
          const gpRes = await fetchWithTimeout(url, { headers: authHeaders }, 6000);
          if (gpRes.ok) {
            const gpData = await gpRes.json();
            const items = gpData?.items || gpData?.achievements || (Array.isArray(gpData) ? gpData : []);
            if (Array.isArray(items) && items.length > 0) {
              achievements = items.map((ach: any) => {
                const isUnlocked = ach.unlocked === true || ach.achieved === 1 || !!ach.date_unlocked || !!ach.unlock_date;
                const unlockTimestamp = (ach.date_unlocked || ach.unlock_date)
                  ? Math.floor(new Date(ach.date_unlocked || ach.unlock_date).getTime() / 1000)
                  : (ach.unlocktime || (isUnlocked ? Math.floor(Date.now() / 1000) : 0));
                const globalPercent = typeof ach.rarity === "number"
                  ? Math.round(ach.rarity * 10) / 10
                  : (typeof ach.global_percentage === "number" ? Math.round(ach.global_percentage * 10) / 10 : undefined);

                return {
                  apiname: String(ach.id || ach.achievement_key || ach.key || ach.api_name || Math.random().toString(36)),
                  achieved: isUnlocked ? 1 : 0,
                  unlocktime: unlockTimestamp,
                  name: ach.visible_name || ach.name || ach.title || "Conquista",
                  description: ach.description || ach.desc || "",
                  icon: ach.image_url_unlocked || ach.icon || ach.image || "",
                  icongray: ach.image_url_locked || ach.icongray || ach.image_locked || ach.icon || "",
                  globalPercent,
                  isUltraRare: globalPercent !== undefined && globalPercent <= 10,
                };
              });
              break;
            }
          }
        } catch (e) {}
      }
    }

    let playtimeMinutes = 0;

    // 1. Check user stats feed
    if (username || token) {
      const statsUser = username || (token ? "current" : "");
      if (statsUser) {
        for (const p of [1, 2, 3]) {
          if (playtimeMinutes > 0) break;
          const statsUrl = `https://www.gog.com/u/${encodeURIComponent(statsUser)}/games/stats?sort=recent_playtime&order=desc&page=${p}`;
          try {
            const sRes = await fetchWithTimeout(statsUrl, {
              headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept": "application/json" }
            }, 4000);
            if (sRes.ok) {
              const sData = await sRes.json();
              const prods = sData?.products || [];
              for (const pr of prods) {
                const prId = String(pr.id || pr.productId || "");
                if (idsToCheck.includes(prId) || (pr.title && gameName && pr.title.toLowerCase().includes(gameName.toLowerCase()))) {
                  const pt = extractGogPlaytimeMinutes(pr);
                  if (pt > 0) {
                    playtimeMinutes = pt;
                    break;
                  }
                }
              }
            }
          } catch {}
        }
      }
    }

    // 2. Check embed user data games
    if (playtimeMinutes === 0 && token) {
      try {
        const userGamesRes = await fetchWithTimeout("https://embed.gog.com/user/data/games", {
          headers: {
            "Authorization": `Bearer ${token}`,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "application/json"
          }
        }, 5000);
        if (userGamesRes.ok) {
          const rawData = await userGamesRes.json();
          const owned = rawData?.owned || (Array.isArray(rawData) ? rawData : []);
          if (Array.isArray(owned)) {
            const found = owned.find((g: any) => {
              if (typeof g === "number" || typeof g === "string") return idsToCheck.includes(String(g));
              return idsToCheck.includes(String(g.id || g.productId));
            });
            if (found && typeof found === "object") {
              playtimeMinutes = extractGogPlaytimeMinutes(found);
            }
          }
        }
      } catch {}
    }

    // 3. Check gameplay.gog.com session APIs
    if (playtimeMinutes === 0 && (token || userId)) {
      for (const gid of idsToCheck) {
        if (playtimeMinutes > 0) break;
        const sessionUrls = [
          userId ? `https://gameplay.gog.com/clients/${encodeURIComponent(gid)}/users/${encodeURIComponent(userId)}/sessions` : null,
          userId ? `https://gameplay.gog.com/games/${encodeURIComponent(gid)}/users/${encodeURIComponent(userId)}/sessions` : null,
          userId ? `https://gameplay.gog.com/clients/${encodeURIComponent(gid)}/users/${encodeURIComponent(userId)}/gameplay` : null,
          `https://gameplay.gog.com/clients/${encodeURIComponent(gid)}/sessions`,
        ].filter(Boolean) as string[];

        for (const sUrl of sessionUrls) {
          try {
            const sRes = await fetchWithTimeout(sUrl, { headers: authHeaders }, 3500);
            if (sRes.ok) {
              const sData = await sRes.json();
              const pt = extractGogPlaytimeMinutes(sData);
              if (pt > 0) {
                playtimeMinutes = pt;
                break;
              }
            }
          } catch {}
        }
      }
    }

    const totalCount = achievements.length;
    const unlockedCount = achievements.filter((a) => a.achieved === 1).length;
    const percentage = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

    const result = {
      success: true,
      gameName,
      achievements,
      unlockedCount,
      totalCount,
      percentage,
      playtime_minutes: playtimeMinutes,
    };

    gogCache.set(cacheKey, result, 30 * 60 * 1000);
    res.json(result);
  } catch (err: any) {
    console.warn(`Erro no proxy /api/gog/achievements para gameId ${req.query.gameId}:`, err?.message || err);
    res.status(500).json({ error: "Erro interno ao buscar conquistas na GOG." });
  }
});

// 4. Get GOG Game Details
app.get("/api/gog/game-details", async (req, res) => {
  try {
    const gameId = req.query.gameId as string;
    if (!gameId) {
      res.status(400).json({ error: "ID do jogo na GOG é obrigatório." });
      return;
    }

    const cacheKey = `gog:details:${gameId}`;
    const cached = gogCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const targetUrl = `https://api.gog.com/products/${encodeURIComponent(gameId)}`;
    const gogRes = await fetchWithTimeout(targetUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    }, 8000);

    if (!gogRes.ok) {
      res.status(gogRes.status).json({ error: "Falha ao obter detalhes do jogo na GOG." });
      return;
    }

    const data = await gogRes.json();
    const result = { success: !!data, data: data || null };
    gogCache.set(cacheKey, result, 60 * 60 * 1000);
    res.json(result);
  } catch (err: any) {
    console.warn(`Erro no proxy /api/gog/game-details para gameId ${req.query.gameId}:`, err?.message || err);
    res.status(500).json({ error: "Erro interno ao buscar detalhes na loja da GOG." });
  }
});

// 5. Smart GOG Game Resolver (Resolves GOG URLs, Slugs, Titles and maps against user library)
app.get("/api/gog/resolve-game", async (req, res) => {
  try {
    const rawInput = (req.query.input as string) || "";
    const rawUser = (req.query.username as string) || "";
    const username = parseGogUsername(rawUser);
    const userId = (req.query.userId as string) || "";
    const rawToken = (req.query.token as string) || "";
    const token = isValidGogBearerToken(rawToken) ? rawToken : "";

    if (!rawInput.trim()) {
      res.status(400).json({ error: "Informe a URL, título ou ID do jogo da GOG." });
      return;
    }

    let input = rawInput.trim();
    let slugOrTitle = input;

    if (input.includes("gog.com/")) {
      const match = input.match(/gog\.com\/(?:[a-z]{2}\/)?game\/([a-zA-Z0-9_-]+)/i);
      if (match && match[1]) {
        slugOrTitle = match[1];
      } else {
        const parts = input.split("/").filter(Boolean);
        slugOrTitle = parts[parts.length - 1] || input;
      }
    }

    const cleanSearchQuery = slugOrTitle.replace(/[_-]+/g, " ").trim();

    let resolvedId: string | null = null;
    let resolvedTitle: string | null = null;
    let resolvedCover: string | null = null;
    let resolvedPlaytime = 0;
    let resolvedLastPlayed: number | undefined = undefined;

    // 1. Direct Numeric ID Lookup
    if (/^\d+$/.test(input)) {
      try {
        const prodRes = await fetchWithTimeout(`https://api.gog.com/products/${encodeURIComponent(input)}?expand=description`, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        }, 6000);
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          if (prodData && prodData.title) {
            resolvedId = input;
            resolvedTitle = prodData.title;
            const img = prodData.images?.logo2x || prodData.images?.background || prodData.images?.boxArtImage || prodData.images?.icon;
            if (img) {
              resolvedCover = img.startsWith("//") ? `https:${img}` : img;
            }
          }
        }
      } catch (e) {
        console.warn("Aviso ao buscar produto direto por ID na GOG:", e);
      }
    }

    // 2. Catalog Search & Smart Ranking if not resolved directly
    if (!resolvedId) {
      try {
        const catRes = await fetchWithTimeout(`https://catalog.gog.com/v1/catalog?limit=25&query=${encodeURIComponent(cleanSearchQuery)}`, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        }, 6000);
        if (catRes.ok) {
          const catData = await catRes.json();
          const products: any[] = catData?.products || [];
          if (products.length > 0) {
            const lowerQuery = cleanSearchQuery.toLowerCase();
            const rawSlugLower = slugOrTitle.toLowerCase().replace(/[^a-z0-9]/g, "");

            // Sort products by relevance
            products.sort((a, b) => {
              const aSlug = (a.slug || "").toLowerCase().replace(/[^a-z0-9]/g, "");
              const bSlug = (b.slug || "").toLowerCase().replace(/[^a-z0-9]/g, "");
              const aTitle = (a.title || "").toLowerCase();
              const bTitle = (b.title || "").toLowerCase();

              // Exact slug match gets top priority
              if (aSlug === rawSlugLower && bSlug !== rawSlugLower) return -1;
              if (bSlug === rawSlugLower && aSlug !== rawSlugLower) return 1;

              // Exact title match
              if (aTitle === lowerQuery && bTitle !== lowerQuery) return -1;
              if (bTitle === lowerQuery && aTitle !== lowerQuery) return 1;

              // Starts with title match
              if (aTitle.startsWith(lowerQuery) && !bTitle.startsWith(lowerQuery)) return -1;
              if (bTitle.startsWith(lowerQuery) && !aTitle.startsWith(lowerQuery)) return 1;

              return 0;
            });

            const best = products[0];
            resolvedId = String(best.id);
            resolvedTitle = best.title;
            resolvedCover = best.coverHorizontal || best.coverVertical;

            // Fetch higher quality image if available
            try {
              const pRes = await fetchWithTimeout(`https://api.gog.com/products/${best.id}`, {
                headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
              }, 3000);
              if (pRes.ok) {
                const pData = await pRes.json();
                const img = pData.images?.logo2x || pData.images?.background || pData.images?.boxArtImage;
                if (img) {
                  resolvedCover = img.startsWith("//") ? `https:${img}` : img;
                }
              }
            } catch {}
          }
        }
      } catch (e) {
        console.warn("Aviso ao buscar catálogo na resolução GOG:", e);
      }
    }

    if (!resolvedId && /^\d+$/.test(input)) {
      resolvedId = input;
      resolvedTitle = `Jogo GOG (${input})`;
    }

    if (!resolvedId) {
      res.status(404).json({ error: `Nenhum jogo correspondente encontrado na GOG para "${rawInput}".` });
      return;
    }

    // 3. Resolve Playtime across all known aliases, web stats & sessions
    const idsToCheck = [resolvedId];
    if (GOG_GAME_ID_ALIASES[resolvedId]) {
      for (const alias of GOG_GAME_ID_ALIASES[resolvedId]) {
        if (!idsToCheck.includes(alias)) idsToCheck.push(alias);
      }
    }

    // 3.1 Check user stats feed across multiple pages
    if (token || username) {
      try {
        const statsUser = username || (token ? "current" : "");
        if (statsUser) {
          const statsUrls = [
            `https://www.gog.com/u/${encodeURIComponent(statsUser)}/games/stats?query=${encodeURIComponent(resolvedTitle || cleanSearchQuery)}`,
            `https://www.gog.com/u/${encodeURIComponent(statsUser)}/games/stats?sort=recent_playtime&order=desc&page=1`,
            `https://www.gog.com/u/${encodeURIComponent(statsUser)}/games/stats?sort=recent_playtime&order=desc&page=2`,
            `https://www.gog.com/u/${encodeURIComponent(statsUser)}/games/stats?sort=recent_playtime&order=desc&page=3`,
            `https://embed.gog.com/u/${encodeURIComponent(statsUser)}/games/stats?sort=recent_playtime&order=desc&page=1`,
          ];

          for (const sUrl of statsUrls) {
            if (resolvedPlaytime > 0) break;
            try {
              const headersToTry: Record<string, string>[] = [];
              if (token) {
                headersToTry.push({
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                  "Accept": "application/json",
                  "Authorization": `Bearer ${token}`,
                });
              }
              headersToTry.push({
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept": "application/json",
              });

              for (const headers of headersToTry) {
                if (resolvedPlaytime > 0) break;
                try {
                  const sRes = await fetchWithTimeout(sUrl, { headers }, 4000);
                  if (sRes.ok) {
                    const sData = await sRes.json();
                    const products = sData?.products || (Array.isArray(sData) ? sData : []);
                    if (Array.isArray(products)) {
                      const match = products.find((p: any) => {
                        const pId = String(p.id || p.productId || "");
                        const pTitle = (p.title || p.name || "").toLowerCase().trim();
                        const targetTitle = (resolvedTitle || "").toLowerCase().trim();
                        const isMatchId = idsToCheck.includes(pId);
                        const isMatchTitle = pTitle && targetTitle && (pTitle === targetTitle || pTitle.includes(targetTitle) || targetTitle.includes(pTitle));
                        return isMatchId || isMatchTitle;
                      });
                      if (match) {
                        const pt = extractGogPlaytimeMinutes(match);
                        if (pt > 0) {
                          resolvedPlaytime = pt;
                          if (match.stats?.last_played) {
                            resolvedLastPlayed = Math.floor(new Date(match.stats.last_played).getTime() / 1000);
                          } else if (match.last_played) {
                            resolvedLastPlayed = Math.floor(new Date(match.last_played).getTime() / 1000);
                          }
                          break;
                        }
                      }
                    }
                  }
                } catch {}
              }
            } catch {}
          }
        }
      } catch {}
    }

    // 3.2 Check embed user data games
    if (resolvedPlaytime === 0 && token) {
      try {
        const userGamesRes = await fetchWithTimeout("https://embed.gog.com/user/data/games", {
          headers: {
            "Authorization": `Bearer ${token}`,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "application/json"
          }
        }, 6000);

        if (userGamesRes.ok) {
          const rawData = await userGamesRes.json();
          const owned = rawData?.owned || (Array.isArray(rawData) ? rawData : []);
          if (Array.isArray(owned)) {
            const found = owned.find((g: any) => {
              if (typeof g === "number" || typeof g === "string") {
                return idsToCheck.includes(String(g));
              }
              const gId = String(g.id || g.productId);
              const gTitle = (g.title || g.name || "").toLowerCase().trim();
              const targetTitle = (resolvedTitle || "").toLowerCase().trim();
              return idsToCheck.includes(gId) || (gTitle && targetTitle && (gTitle === targetTitle || gTitle.includes(targetTitle) || targetTitle.includes(gTitle)));
            });
            if (found && typeof found === "object") {
              const pt = extractGogPlaytimeMinutes(found);
              if (pt > 0) resolvedPlaytime = pt;
            }
          }
        }
      } catch (e) {}
    }

    // 3.3 Query Galaxy sessions and gameplay endpoints
    if (resolvedPlaytime === 0 && (token || userId)) {
      const authHeaders: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json",
      };
      if (token) {
        authHeaders["Authorization"] = `Bearer ${token}`;
      }

      for (const gid of idsToCheck) {
        if (resolvedPlaytime > 0) break;
        const sessionUrls = [
          userId ? `https://gameplay.gog.com/clients/${encodeURIComponent(gid)}/users/${encodeURIComponent(userId)}/sessions` : null,
          userId ? `https://gameplay.gog.com/games/${encodeURIComponent(gid)}/users/${encodeURIComponent(userId)}/sessions` : null,
          userId ? `https://gameplay.gog.com/clients/${encodeURIComponent(gid)}/users/${encodeURIComponent(userId)}/gameplay` : null,
          userId ? `https://gameplay.gog.com/v2/games/${encodeURIComponent(gid)}/users/${encodeURIComponent(userId)}/gameplay` : null,
          `https://gameplay.gog.com/clients/${encodeURIComponent(gid)}/sessions`,
        ].filter(Boolean) as string[];

        for (const sUrl of sessionUrls) {
          try {
            const sRes = await fetchWithTimeout(sUrl, { headers: authHeaders }, 4000);
            if (sRes.ok) {
              const sData = await sRes.json();
              const pt = extractGogPlaytimeMinutes(sData);
              if (pt > 0) {
                resolvedPlaytime = pt;
                break;
              }
            }
          } catch {}
        }
      }
    }

    // 4. Resolve Achievements
    let achievementsData: any = null;
    const idsForAch = [...idsToCheck];

    const achAuthHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Accept": "application/json",
    };
    if (token) {
      achAuthHeaders["Authorization"] = `Bearer ${token}`;
    }

    for (const gid of idsForAch) {
      if (achievementsData) break;
      const endpointsToTry: string[] = [];
      if (userId && token) {
        endpointsToTry.push(`https://gameplay.gog.com/clients/${encodeURIComponent(gid)}/users/${encodeURIComponent(userId)}/achievements`);
      }
      if (token) {
        endpointsToTry.push(`https://gameplay.gog.com/clients/${encodeURIComponent(gid)}/achievements`);
      }
      endpointsToTry.push(`https://gameplay.gog.com/v2/games/${encodeURIComponent(gid)}/achievements`);

      for (const url of endpointsToTry) {
        try {
          const gpRes = await fetchWithTimeout(url, { headers: achAuthHeaders }, 6000);
          if (gpRes.ok) {
            const gpData = await gpRes.json();
            const items = gpData?.items || gpData?.achievements || (Array.isArray(gpData) ? gpData : []);
            if (Array.isArray(items) && items.length > 0) {
              const achievements = items.map((ach: any) => {
                const isUnlocked = ach.unlocked === true || ach.achieved === 1 || !!ach.date_unlocked || !!ach.unlock_date;
                const unlockTimestamp = (ach.date_unlocked || ach.unlock_date)
                  ? Math.floor(new Date(ach.date_unlocked || ach.unlock_date).getTime() / 1000)
                  : (ach.unlocktime || (isUnlocked ? Math.floor(Date.now() / 1000) : 0));
                const globalPercent = typeof ach.rarity === "number"
                  ? Math.round(ach.rarity * 10) / 10
                  : (typeof ach.global_percentage === "number" ? Math.round(ach.global_percentage * 10) / 10 : undefined);

                return {
                  apiname: String(ach.id || ach.achievement_key || ach.key || ach.api_name || Math.random().toString(36)),
                  achieved: isUnlocked ? 1 : 0,
                  unlocktime: unlockTimestamp,
                  name: ach.visible_name || ach.name || ach.title || "Conquista",
                  description: ach.description || ach.desc || "",
                  icon: ach.image_url_unlocked || ach.icon || ach.image || "",
                  icongray: ach.image_url_locked || ach.icongray || ach.image_locked || ach.icon || "",
                  globalPercent,
                  isUltraRare: globalPercent !== undefined && globalPercent <= 10,
                };
              });

              const totalCount = achievements.length;
              const unlockedCount = achievements.filter((a) => a.achieved === 1).length;
              achievementsData = {
                gameName: resolvedTitle,
                achievements,
                unlockedCount,
                totalCount,
                percentage: totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0,
              };
              break;
            }
          }
        } catch (e) {}
      }
    }

    res.json({
      success: true,
      gameId: resolvedId,
      title: resolvedTitle || `Jogo GOG (${resolvedId})`,
      coverUrl: resolvedCover || undefined,
      playtime_minutes: resolvedPlaytime,
      last_played_timestamp: resolvedLastPlayed,
      isOwned: true,
      storeUrl: `https://www.gog.com/en/game/${resolvedId}`,
      achievements: achievementsData,
    });
  } catch (err: any) {
    console.warn("Erro no proxy /api/gog/resolve-game:", err?.message || err);
    res.status(500).json({ error: "Erro ao resolver jogo da GOG." });
  }
});

// --- BLIZZARD BATTLE.NET API PROXY ENDPOINTS ---
const DEFAULT_BLIZZARD_CLIENT_ID = process.env.BLIZZARD_CLIENT_ID || "cd4e166528cc4b14b6f3e80608da21df";
const DEFAULT_BLIZZARD_CLIENT_SECRET = process.env.BLIZZARD_CLIENT_SECRET || "TAYTjZ6bfdquf4scRuNIVlkXM46JodrK";

const BLIZZARD_ALLOWED_REDIRECT_URIS = [
  "https://gameloghalecks.ai.studio/api/blizzard/callback",
  "http://localhost:3000/api/blizzard/callback",
  "https://ais-dev-vo7y2svqbla2eksgmckxxg-422647129975.us-west1.run.app/api/blizzard/callback",
  "https://ais-pre-vo7y2svqbla2eksgmckxxg-422647129975.us-west1.run.app/api/blizzard/callback",
  "https://ais-dev-mqwco4zhvkscmlstabgakc-607246007356.us-east1.run.app/api/blizzard/callback",
];

function resolveAllowedRedirectUri(requestedUri?: string, req?: any): string {
  if (requestedUri && BLIZZARD_ALLOWED_REDIRECT_URIS.includes(requestedUri.trim())) {
    return requestedUri.trim();
  }
  if (req) {
    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
    const host = req.get("x-forwarded-host") || req.get("host") || "";
    const computed = `${proto}://${host}/api/blizzard/callback`;
    if (BLIZZARD_ALLOWED_REDIRECT_URIS.includes(computed)) {
      return computed;
    }
    if (host.includes("localhost") || host.includes("127.0.0.1")) {
      return "http://localhost:3000/api/blizzard/callback";
    }
    if (host.includes("gameloghalecks.ai.studio") || host.includes("ai.studio")) {
      return "https://gameloghalecks.ai.studio/api/blizzard/callback";
    }
    const matchingRun = BLIZZARD_ALLOWED_REDIRECT_URIS.find((u) => host && u.includes(host));
    if (matchingRun) return matchingRun;
  }
  return "https://gameloghalecks.ai.studio/api/blizzard/callback";
}

const blizzardCache = new SimpleTTLCache<any>(30 * 60 * 1000, 500); // 30min cache
let blizzardClientCredentialsToken: string | null = null;
let blizzardClientTokenExpiresAt = 0;

// Helper to get client credentials token for Blizzard Game Data APIs
async function getBlizzardClientCredentialsToken(region = "us", customClientId?: string, customClientSecret?: string): Promise<string | null> {
  const clientId = customClientId || process.env.BLIZZARD_CLIENT_ID || DEFAULT_BLIZZARD_CLIENT_ID;
  const clientSecret = customClientSecret || process.env.BLIZZARD_CLIENT_SECRET || DEFAULT_BLIZZARD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  if (blizzardClientCredentialsToken && Date.now() < blizzardClientTokenExpiresAt - 60000) {
    return blizzardClientCredentialsToken;
  }

  try {
    const oauthHost = region === "cn" ? "https://oauth.battlenet.com.cn" : "https://oauth.battle.net";
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const res = await fetchWithTimeout(`${oauthHost}/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    }, 6000);

    if (res.ok) {
      const data = await res.json();
      blizzardClientCredentialsToken = data.access_token;
      blizzardClientTokenExpiresAt = Date.now() + (data.expires_in || 86400) * 1000;
      return blizzardClientCredentialsToken;
    }
  } catch (err) {
    console.warn("Aviso ao obter client_credentials da Blizzard:", err);
  }
  return null;
}

// 0. Blizzard Client Credentials Direct Token Generator
app.post("/api/blizzard/client-credentials", async (req, res) => {
  try {
    const { clientId: customClientId, clientSecret: customClientSecret, region = "us" } = req.body;
    const clientId = customClientId || process.env.BLIZZARD_CLIENT_ID || DEFAULT_BLIZZARD_CLIENT_ID;
    const clientSecret = customClientSecret || process.env.BLIZZARD_CLIENT_SECRET || DEFAULT_BLIZZARD_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      res.status(400).json({ success: false, error: "Client ID e Client Secret são necessários para gerar o token." });
      return;
    }

    const oauthHost = region === "cn" ? "https://oauth.battlenet.com.cn" : "https://oauth.battle.net";
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const tokenRes = await fetchWithTimeout(`${oauthHost}/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    }, 7000);

    if (tokenRes.ok) {
      const data = await tokenRes.json();
      res.json({
        success: true,
        token: data.access_token,
        expiresIn: data.expires_in || 86400,
      });
      return;
    }

    const errText = await tokenRes.text();
    res.status(tokenRes.status).json({ success: false, error: `Erro Blizzard (${tokenRes.status}): ${errText}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Erro interno ao validar credenciais da Blizzard" });
  }
});

// 1. Blizzard Auth URL Generator
app.get("/api/blizzard/auth-url", (req, res) => {
  const region = ((req.query.region as string) || "us").toLowerCase();
  const clientId = (req.query.clientId as string) || process.env.BLIZZARD_CLIENT_ID || DEFAULT_BLIZZARD_CLIENT_ID;

  if (!clientId) {
    res.status(400).json({
      success: false,
      error: "Blizzard Client ID não informado. Para usar o login oficial OAuth, informe seu Client ID cadastrado em develop.battle.net."
    });
    return;
  }

  const oauthHost = region === "cn" ? "https://oauth.battlenet.com.cn" : "https://oauth.battle.net";
  const redirectUri = resolveAllowedRedirectUri(
    (req.query.redirectUri as string) || (req.query.redirect_uri as string),
    req
  );

  // Required scopes for WoW Profile and User Info
  const scope = (req.query.scope as string) || "openid wow.profile";
  const state = (req.query.state as string) || Math.random().toString(36).substring(2, 15);

  const authUrl = `${oauthHost}/authorize?client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(scope)}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;

  // If requested as JSON explicitly (via ?json=true or Accept: application/json without text/html)
  const wantsJson =
    req.query.json === "true" ||
    (Boolean(req.headers.accept) &&
      req.headers.accept.includes("application/json") &&
      !req.headers.accept.includes("text/html"));

  if (wantsJson) {
    res.json({
      authUrl,
      redirectUri,
      state,
    });
    return;
  }

  // By default, redirect browser/popup directly to Blizzard OAuth login page!
  res.redirect(authUrl);
});

// 2. Blizzard OAuth Callback - Handles popup redirect and posts message to opener window
app.get("/api/blizzard/callback", (req, res) => {
  const code = (req.query.code as string) || "";
  const error = (req.query.error as string) || "";

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Autenticação Battle.net</title>
        <style>
          body { background: #09090b; color: #f4f4f5; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #18181b; padding: 24px; border-radius: 16px; border: 1px solid #27272a; text-align: center; max-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          h2 { color: #38bdf8; margin-top: 0; }
          p { color: #a1a1aa; font-size: 14px; }
          .btn { display: inline-block; margin-top: 16px; padding: 8px 16px; background: #0284c7; color: white; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>${error ? "Erro na Autenticação" : "Battle.net Conectada!"}</h2>
          <p>${error ? "Não foi possível concluir a autorização: " + error : "Autenticação concluída com sucesso. Esta janela será fechada automaticamente..."}</p>
          <a class="btn" href="javascript:window.close();">Fechar Janela</a>
        </div>
        <script>
          const payload = {
            type: "BLIZZARD_AUTH_SUCCESS",
            code: ${JSON.stringify(code)},
            error: ${JSON.stringify(error)}
          };
          if (window.opener) {
            try {
              window.opener.postMessage(payload, "*");
            } catch (e) {
              console.warn("Could not postMessage to opener:", e);
            }
            setTimeout(() => { window.close(); }, 1200);
          } else {
            console.log("Blizzard Auth payload:", payload);
            // If opened in same tab without opener, redirect back with code parameter
            if (${JSON.stringify(Boolean(code))}) {
              setTimeout(() => {
                window.location.href = "/?blizzard_code=" + encodeURIComponent(${JSON.stringify(code)});
              }, 1000);
            }
          }
        </script>
      </body>
    </html>
  `);
});

// 3. Blizzard OAuth Token Exchange (Code -> Token + BattleTag)
app.post("/api/blizzard/oauth-exchange", async (req, res) => {
  try {
    const { code, redirectUri, region = "us", clientId: customClientId, clientSecret: customClientSecret } = req.body;
    if (!code) {
      res.status(400).json({ success: false, error: "Código de autorização não fornecido." });
      return;
    }

    const clientId = customClientId || process.env.BLIZZARD_CLIENT_ID || DEFAULT_BLIZZARD_CLIENT_ID;
    const clientSecret = customClientSecret || process.env.BLIZZARD_CLIENT_SECRET || DEFAULT_BLIZZARD_CLIENT_SECRET;

    if (!clientSecret) {
      res.status(400).json({ success: false, error: "Client Secret da Blizzard não configurado." });
      return;
    }

    const oauthHost = region === "cn" ? "https://oauth.battlenet.com.cn" : "https://oauth.battle.net";
    const targetRedirectUri = resolveAllowedRedirectUri(redirectUri, req);

    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenRes = await fetchWithTimeout(`${oauthHost}/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code.trim(),
        redirect_uri: targetRedirectUri,
      }).toString(),
    }, 8000);

    if (tokenRes.ok) {
      const tokenData = await tokenRes.json();
      const userToken = tokenData.access_token;

      // Fetch User Info to get BattleTag and account ID
      let battleTag = "";
      let accountId = "";
      try {
        const userRes = await fetchWithTimeout(`${oauthHost}/userinfo`, {
          headers: { "Authorization": `Bearer ${userToken}` }
        }, 5000);
        if (userRes.ok) {
          const userData = await userRes.json();
          battleTag = userData.battletag || userData.battle_tag || "";
          accountId = String(userData.id || userData.sub || "");
        }
      } catch (e) {
        console.warn("Aviso ao buscar userinfo da Blizzard:", e);
      }

      res.json({
        success: true,
        token: userToken,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        battleTag,
        accountId,
      });
      return;
    } else {
      const errBody = await tokenRes.text();
      console.warn("Falha no token exchange da Blizzard:", tokenRes.status, errBody);
      res.status(tokenRes.status || 400).json({
        success: false,
        error: `Falha ao autorizar na Blizzard (${tokenRes.status}): ${errBody || "Código ou URL de redirecionamento inválidos"}`,
      });
      return;
    }
  } catch (err: any) {
    console.warn("Erro no /api/blizzard/oauth-exchange:", err);
    res.status(500).json({ success: false, error: err?.message || "Erro ao trocar token da Blizzard" });
  }
});

// 3b. Blizzard OAuth Token Refresh
app.post("/api/blizzard/refresh-token", async (req, res) => {
  try {
    const { refreshToken, region = "us", clientId: customClientId, clientSecret: customClientSecret } = req.body;
    if (!refreshToken) {
      res.status(400).json({ success: false, error: "Refresh token não fornecido." });
      return;
    }

    const clientId = customClientId || process.env.BLIZZARD_CLIENT_ID || DEFAULT_BLIZZARD_CLIENT_ID;
    const clientSecret = customClientSecret || process.env.BLIZZARD_CLIENT_SECRET || DEFAULT_BLIZZARD_CLIENT_SECRET;

    const oauthHost = region === "cn" ? "https://oauth.battlenet.com.cn" : "https://oauth.battle.net";
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const tokenRes = await fetchWithTimeout(`${oauthHost}/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    }, 7000);

    if (!tokenRes.ok) {
      res.status(tokenRes.status).json({ success: false, error: "Falha ao renovar token com a Blizzard." });
      return;
    }
    const tokenData = await tokenRes.json();
    res.json({
      success: true,
      token: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken,
      expiresIn: tokenData.expires_in || 86400,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Erro ao renovar token da Blizzard" });
  }
});

// 4. Fetch Blizzard WoW Characters for the user
// Helpers to resolve WoW official icons for all endpoints
const getWowClassIcon = (clsName?: string) => {
  const c = (clsName || "").toLowerCase();
  if (c.includes("warrior") || c.includes("guerreiro")) return "https://render.worldofwarcraft.com/us/icons/56/classicon_warrior.jpg";
  if (c.includes("paladin") || c.includes("paladino")) return "https://render.worldofwarcraft.com/us/icons/56/classicon_paladin.jpg";
  if (c.includes("hunter") || c.includes("caçador") || c.includes("cacador")) return "https://render.worldofwarcraft.com/us/icons/56/classicon_hunter.jpg";
  if (c.includes("rogue") || c.includes("ladino")) return "https://render.worldofwarcraft.com/us/icons/56/classicon_rogue.jpg";
  if (c.includes("priest") || c.includes("sacerdote")) return "https://render.worldofwarcraft.com/us/icons/56/classicon_priest.jpg";
  if (c.includes("deathknight") || c.includes("cavaleiro")) return "https://render.worldofwarcraft.com/us/icons/56/classicon_deathknight.jpg";
  if (c.includes("shaman") || c.includes("xamã") || c.includes("xama")) return "https://render.worldofwarcraft.com/us/icons/56/classicon_shaman.jpg";
  if (c.includes("mage") || c.includes("mago")) return "https://render.worldofwarcraft.com/us/icons/56/classicon_mage.jpg";
  if (c.includes("warlock") || c.includes("bruxo")) return "https://render.worldofwarcraft.com/us/icons/56/classicon_warlock.jpg";
  if (c.includes("monk") || c.includes("monge")) return "https://render.worldofwarcraft.com/us/icons/56/classicon_monk.jpg";
  if (c.includes("druid") || c.includes("druida")) return "https://render.worldofwarcraft.com/us/icons/56/classicon_druid.jpg";
  if (c.includes("demonhunter") || c.includes("demonio")) return "https://render.worldofwarcraft.com/us/icons/56/classicon_demonhunter.jpg";
  if (c.includes("evoker") || c.includes("conjurador")) return "https://render.worldofwarcraft.com/us/icons/56/classicon_evoker.jpg";
  return "https://render.worldofwarcraft.com/us/icons/56/classicon_warrior.jpg";
};

const getWowRaceFaction = (raceName?: string): "HORDE" | "ALLIANCE" => {
  const r = (raceName || "").toLowerCase().replace(/[\s-_]/g, "");
  if (
    r.includes("nightborne") || r.includes("filhodanoite") || r.includes("filhadanoite") ||
    r.includes("highmountain") || r.includes("altamont") ||
    r.includes("maghar") || r.includes("zandalari") || r.includes("vulpera") ||
    r.includes("orc") || r.includes("tauren") || r.includes("troll") ||
    r.includes("undead") || r.includes("morto") || r.includes("forsaken") ||
    r.includes("renegado") || r.includes("scourge") ||
    r.includes("bloodelf") || r.includes("sangrento") || r.includes("goblin")
  ) {
    return "HORDE";
  }
  return "ALLIANCE";
};

const getWowRaceIcon = (raceName?: string, gender?: string) => {
  const r = (raceName || "").toLowerCase();
  const g = (gender || "").toUpperCase() === "FEMALE" ? "female" : "male";

  // Allied & Specific Races first to avoid substring collision
  if (r.includes("nightborne") || r.includes("filho da noite") || r.includes("filha da noite") || r.includes("filhos da noite") || r.includes("filhadanoite") || r.includes("filhodanoite")) {
    return "https://render.worldofwarcraft.com/us/icons/56/achievement_alliedrace_nightborne.jpg";
  }
  if (r.includes("highmountain") || r.includes("altamont")) {
    return "https://render.worldofwarcraft.com/us/icons/56/achievement_alliedrace_highmountaintauren.jpg";
  }
  if (r.includes("maghar") || r.includes("mag'har")) {
    return "https://render.worldofwarcraft.com/us/icons/56/achievement_alliedrace_magharorc.jpg";
  }
  if (r.includes("zandalari")) {
    return "https://render.worldofwarcraft.com/us/icons/56/achievement_alliedrace_zandalaritroll.jpg";
  }
  if (r.includes("vulpera")) {
    return "https://render.worldofwarcraft.com/us/icons/56/achievement_alliedrace_vulpera.jpg";
  }
  if (r.includes("void") || r.includes("caótico") || r.includes("caotico")) {
    return "https://render.worldofwarcraft.com/us/icons/56/achievement_alliedrace_voidelf.jpg";
  }
  if (r.includes("lightforged") || r.includes("forjado a luz") || r.includes("forjadodaluz")) {
    return "https://render.worldofwarcraft.com/us/icons/56/achievement_alliedrace_lightforgeddraenei.jpg";
  }
  if (r.includes("dark iron") || r.includes("darkiron") || r.includes("ferro negro") || r.includes("ferronegro")) {
    return "https://render.worldofwarcraft.com/us/icons/56/achievement_alliedrace_darkirondwarf.jpg";
  }
  if (r.includes("kul tiran") || r.includes("kultiran") || r.includes("kul tireno") || r.includes("kultireno")) {
    return "https://render.worldofwarcraft.com/us/icons/56/achievement_alliedrace_kultiranhuman.jpg";
  }
  if (r.includes("mechagnome") || r.includes("mecânico") || r.includes("mecanico")) {
    return "https://render.worldofwarcraft.com/us/icons/56/achievement_alliedrace_mechagnome.jpg";
  }
  if (r.includes("dracthyr")) {
    return "https://render.worldofwarcraft.com/us/icons/56/classicon_evoker.jpg";
  }
  if (r.includes("earthen") || r.includes("terrano") || r.includes("terrana")) {
    return "https://render.worldofwarcraft.com/us/icons/56/achievement_character_dwarf_male.jpg";
  }

  // Core Races
  if (r.includes("bloodelf") || r.includes("blood elf") || r.includes("sangrento") || r.includes("elfo de sangue")) {
    return `https://render.worldofwarcraft.com/us/icons/56/achievement_character_bloodelf_${g}.jpg`;
  }
  if (r.includes("nightelf") || r.includes("night elf") || r.includes("elfo noturno") || r.includes("elfa noturna") || r.includes("noturno") || r.includes("noturna")) {
    return `https://render.worldofwarcraft.com/us/icons/56/achievement_character_nightelf_${g}.jpg`;
  }
  if (r.includes("orc")) return `https://render.worldofwarcraft.com/us/icons/56/race_orc_${g}.jpg`;
  if (r.includes("undead") || r.includes("forsaken") || r.includes("morto") || r.includes("renegado")) {
    return `https://render.worldofwarcraft.com/us/icons/56/race_scourge_${g}.jpg`;
  }
  if (r.includes("tauren")) return `https://render.worldofwarcraft.com/us/icons/56/race_tauren_${g}.jpg`;
  if (r.includes("troll")) return `https://render.worldofwarcraft.com/us/icons/56/race_troll_${g}.jpg`;
  if (r.includes("goblin")) return `https://render.worldofwarcraft.com/us/icons/56/race_goblin_${g}.jpg`;
  if (r.includes("human") || r.includes("humano") || r.includes("humana")) {
    return `https://render.worldofwarcraft.com/us/icons/56/race_human_${g}.jpg`;
  }
  if (r.includes("dwarf") || r.includes("anão") || r.includes("anao") || r.includes("anã") || r.includes("ana")) {
    return `https://render.worldofwarcraft.com/us/icons/56/race_dwarf_${g}.jpg`;
  }
  if (r.includes("gnome") || r.includes("gnomo") || r.includes("gnoma")) {
    return `https://render.worldofwarcraft.com/us/icons/56/race_gnome_${g}.jpg`;
  }
  if (r.includes("draenei")) return `https://render.worldofwarcraft.com/us/icons/56/race_draenei_${g}.jpg`;
  if (r.includes("worgen")) return `https://render.worldofwarcraft.com/us/icons/56/race_worgen_${g}.jpg`;
  if (r.includes("pandaren")) return `https://render.worldofwarcraft.com/us/icons/56/race_pandaren_${g}.jpg`;

  return `https://render.worldofwarcraft.com/us/icons/56/race_human_${g}.jpg`;
};

const getWowFactionIcon = (faction?: string, raceName?: string) => {
  let f = (faction || "").toUpperCase();
  if (!f || f === "NEUTRAL") {
    f = getWowRaceFaction(raceName);
  }
  if (f === "ALLIANCE" || f.includes("ALIAN") || f.includes("ALLI")) {
    return "https://render.worldofwarcraft.com/us/icons/56/pvpcurrency-honor-alliance.jpg";
  }
  return "https://render.worldofwarcraft.com/us/icons/56/pvpcurrency-honor-horde.jpg";
};

// Proxy for Wowhead ZamModelViewer WebGL 3D models and textures
app.use("/api/zamimg/modelviewer", async (req, res) => {
  try {
    const subPath = req.url;
    let targetUrl = `https://wow.zamimg.com/modelviewer${subPath}`;
    let proxyRes = await fetchWithTimeout(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.wowhead.com/",
        "Accept": "*/*",
      }
    }, 15000);

    // Fallback 1: If 404 and path matches meta/models/8/{id}.json or meta/models/{type}/{id}.json, try meta/npc/{id}.json
    if (!proxyRes.ok && subPath.includes("/meta/models/")) {
      const match = subPath.match(/\/meta\/models\/(?:\d+)\/(\d+)\.json/);
      if (match && match[1]) {
        const altUrl = `https://wow.zamimg.com/modelviewer/live/meta/npc/${match[1]}.json`;
        const altRes = await fetchWithTimeout(altUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.wowhead.com/",
            "Accept": "*/*",
          }
        }, 15000);
        if (altRes.ok) {
          proxyRes = altRes;
        }
      }
    }

    // Fallback 2: If 404 on meta/armor/:slot/:id.json, provide authoritative working slot model
    if (!proxyRes.ok && subPath.includes("/meta/armor/")) {
      const armorMatch = subPath.match(/\/meta\/armor\/(\d+)\/(\d+)\.json/);
      if (armorMatch) {
        const slotNum = parseInt(armorMatch[1], 10);
        // Authoritative verified 200 OK fallback display IDs on wow.zamimg.com
        const slotFallbackIds: Record<number, number> = {
          1: 28414,  // Helm (Bloodfang)
          3: 32369,  // Shoulders (Judgment / Dreadnaught)
          4: 11440,  // Shirt
          5: 30422,  // Chest (Dreadnaught)
          6: 30425,  // Waist (Dreadnaught)
          7: 30424,  // Legs (Dreadnaught)
          8: 27540,  // Boots (Judgment)
          9: 30425,  // Wrists
          10: 30418, // Gloves (Dreadnaught)
          16: 27549, // Cloak
          19: 11440, // Tabard
          20: 30422, // Robe
        };
        const fbId = slotFallbackIds[slotNum] || 30422;
        const fbUrl = `https://wow.zamimg.com/modelviewer/live/meta/armor/${slotNum}/${fbId}.json`;
        const fbRes = await fetchWithTimeout(fbUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.wowhead.com/",
            "Accept": "*/*",
          }
        }, 15000);
        if (fbRes.ok) {
          proxyRes = fbRes;
        }
      }
    }

    // Fallback 3: If 404 on meta/item/:id.json (weapons), provide authoritative working weapon model
    if (!proxyRes.ok && subPath.includes("/meta/item/")) {
      const fbUrl = `https://wow.zamimg.com/modelviewer/live/meta/item/45233.json`;
      const fbRes = await fetchWithTimeout(fbUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://www.wowhead.com/",
          "Accept": "*/*",
        }
      }, 15000);
      if (fbRes.ok) {
        proxyRes = fbRes;
      }
    }

    if (!proxyRes.ok) {
      res.status(proxyRes.status).send(await proxyRes.text());
      return;
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Cache-Control", "public, max-age=86400");
    const contentType = proxyRes.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    const buffer = Buffer.from(await proxyRes.arrayBuffer());
    res.send(buffer);
  } catch (err: any) {
    console.warn("Error proxying zamimg modelviewer asset:", req.url, err?.message);
    res.status(502).json({ error: "Failed to proxy modelviewer asset" });
  }
});

// Endpoint to resolve accurate 3D creatureDisplayId and official media for Mounts and Pets
app.get("/api/blizzard/creature-display", async (req, res) => {
  try {
    const type = ((req.query.type as string) || "mount").toLowerCase();
    const id = parseInt(req.query.id as string, 10);
    const nameParam = (req.query.name as string) || "";
    const region = ((req.query.region as string) || "us").toLowerCase();
    if ((!id || isNaN(id)) && !nameParam) {
      return res.status(400).json({ error: "Missing id or name" });
    }

    const cacheKey = `blizz_creature_disp_${type}_${id}_${nameParam}_${region}`;
    const cached = blizzardCache.get(cacheKey);
    if (cached) return res.json(cached);

    const token = await getBlizzardClientCredentialsToken(region);
    if (!token) {
      const enriched = type === "mount"
        ? enrichMountWithBlizzardMetadata({ id, name: nameParam })
        : enrichPetWithBlizzardMetadata({ id, name: nameParam });
      const fallbackDisplay = enriched.creatureDisplayId || (type === "mount" ? 2404 : 21975);
      return res.json({ id, creatureDisplayId: fallbackDisplay, name: enriched.name });
    }

    if (type === "mount") {
      if (id > 0) {
        const mRes = await fetchWithTimeout(
          `https://${region}.api.blizzard.com/data/wow/mount/${id}?namespace=static-${region}&locale=en_US`,
          { headers: { Authorization: `Bearer ${token}` } },
          5000
        );
        if (mRes.ok) {
          const mData = await mRes.json();
          const mountName = typeof mData.name === "object" ? mData.name.en_US || mData.name.pt_BR || nameParam : mData.name || nameParam;
          const mountDesc = typeof mData.description === "object" ? mData.description.en_US || mData.description.pt_BR : mData.description;
          // Priority 1: Blizzard API authoritative creature_displays array
          let displayId = mData.creature_displays?.[0]?.id;
          if (!displayId) {
            const enriched = enrichMountWithBlizzardMetadata({ id, name: mountName });
            displayId = enriched.creatureDisplayId;
          }
          const result = {
            id,
            creatureDisplayId: displayId || 2404,
            name: mountName,
            description: mountDesc,
          };
          blizzardCache.set(cacheKey, result);
          return res.json(result);
        }
      }
      const enriched = enrichMountWithBlizzardMetadata({ id, name: nameParam });
      return res.json({ id, creatureDisplayId: enriched.creatureDisplayId || 2404, name: enriched.name });
    } else if (type === "pet") {
      if (id > 0) {
        const pRes = await fetchWithTimeout(
          `https://${region}.api.blizzard.com/data/wow/pet/${id}?namespace=static-${region}&locale=en_US`,
          { headers: { Authorization: `Bearer ${token}` } },
          5000
        );
        if (pRes.ok) {
          const pData = await pRes.json();
          let displayId = pData.creature_display?.id || pData.creature_displays?.[0]?.id;
          let iconUrl = pData.icon;

          if (!iconUrl) {
            try {
              const mRes = await fetchWithTimeout(
                `https://${region}.api.blizzard.com/data/wow/media/pet/${id}?namespace=static-${region}&locale=en_US`,
                { headers: { Authorization: `Bearer ${token}` } },
                3000
              );
              if (mRes.ok) {
                const mData = await mRes.json();
                const foundIcon = mData.assets?.find((a: any) => a.key === "icon")?.value;
                if (foundIcon) iconUrl = foundIcon;
              }
            } catch (_) {}
          }

          if (!displayId && pData.creature?.id) {
            const cRes = await fetchWithTimeout(
              `https://${region}.api.blizzard.com/data/wow/creature/${pData.creature.id}?namespace=static-${region}&locale=en_US`,
              { headers: { Authorization: `Bearer ${token}` } },
              4000
            );
            if (cRes.ok) {
              const cData = await cRes.json();
              displayId = cData.creature_displays?.[0]?.id;
            }
          }

          // Wowhead fallback for pet display ID
          if (!displayId && id > 0) {
            try {
              const whRes = await fetchWithTimeout(`https://nether.wowhead.com/tooltip/pet/${id}`, {}, 3000);
              if (whRes.ok) {
                const whData = await whRes.json();
                if (whData?.displayid) displayId = Number(whData.displayid);
              }
            } catch (_) {}
          }

          if (!displayId && id > 0) {
            try {
              const xmlRes = await fetchWithTimeout(`https://www.wowhead.com/npc=${id}&xml`, {}, 3000);
              if (xmlRes.ok) {
                const xmlText = await xmlRes.text();
                const m = xmlText.match(/"displayid"\s*:\s*(\d+)/i) || xmlText.match(/<displayId>(\d+)<\/displayId>/i);
                if (m) displayId = parseInt(m[1], 10);
              }
            } catch (_) {}
          }

          const petName = typeof pData.name === "object" ? pData.name.en_US || pData.name.pt_BR || nameParam : pData.name || nameParam;
          const enriched = enrichPetWithBlizzardMetadata({
            id,
            name: petName,
            creatureDisplayId: displayId,
            iconUrl,
          });

          const result = {
            id,
            creatureDisplayId: displayId || enriched.creatureDisplayId || 28917,
            iconUrl: iconUrl || enriched.iconUrl,
            name: petName,
          };
          blizzardCache.set(cacheKey, result);
          return res.json(result);
        }
      }

      const enriched = enrichPetWithBlizzardMetadata({ id, name: nameParam });
      return res.json({
        id,
        creatureDisplayId: enriched.creatureDisplayId || 28917,
        iconUrl: enriched.iconUrl,
        name: enriched.name,
      });
    }
    return res.json({ id, creatureDisplayId: type === "mount" ? 2404 : 28917 });
  } catch (err: any) {
    return res.json({ creatureDisplayId: 2404 });
  }
});

// Endpoint to fetch complete Mount.db2 metadata using mount IDs
app.get("/api/blizzard/wow/mount-metadata", async (req, res) => {
  try {
    const idParam = req.query.id ? String(req.query.id) : "";
    const idsParam = req.query.ids ? String(req.query.ids) : "";
    const region = ((req.query.region as string) || "us").toLowerCase();

    const idsToResolve: number[] = [];
    if (idParam) {
      const parsed = parseInt(idParam, 10);
      if (!isNaN(parsed) && parsed > 0) idsToResolve.push(parsed);
    }
    if (idsParam) {
      idsParam
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0)
        .forEach((n) => {
          if (!idsToResolve.includes(n)) idsToResolve.push(n);
        });
    }

    if (idsToResolve.length === 0) {
      return res.status(400).json({ error: "Missing mount id or ids parameter" });
    }

    // Resolve each mount ID
    const results: any[] = [];
    const token = await getBlizzardClientCredentialsToken(region).catch(() => null);

    for (const mId of idsToResolve.slice(0, 100)) {
      const cacheKey = `blizz_mount_meta_${mId}_${region}`;
      const cached = blizzardCache.get(cacheKey);
      if (cached) {
        results.push(cached);
        continue;
      }

      // 1. Authoritative base from Blizzard catalog & DB2
      const enriched = enrichMountWithBlizzardMetadata({ id: mId });

      let officialName = enriched.name;
      let officialDesc = enriched.description;
      let officialDisplayId = enriched.creatureDisplayId || 2404;
      let officialMountType = enriched.mountType || "ground";
      let officialSource = enriched.source || "Drop / World Event";
      let officialIcon = enriched.iconUrl;

      // 2. Query Blizzard Static Game Data API if token is available
      if (token) {
        try {
          const apiRes = await fetchWithTimeout(
            `https://${region}.api.blizzard.com/data/wow/mount/${mId}?namespace=static-${region}&locale=en_US`,
            { headers: { Authorization: `Bearer ${token}` } },
            3000
          );
          if (apiRes.ok) {
            const apiData = await apiRes.json();
            if (apiData.name) {
              officialName = typeof apiData.name === "object" ? apiData.name.en_US || apiData.name.pt_BR : apiData.name;
            }
            if (apiData.description) {
              officialDesc = typeof apiData.description === "object" ? apiData.description.en_US || apiData.description.pt_BR : apiData.description;
            }
            if (apiData.creature_displays?.[0]?.id) {
              officialDisplayId = apiData.creature_displays[0].id;
            }
            if (apiData.source?.name) {
              officialSource = typeof apiData.source.name === "object" ? apiData.source.name.en_US || apiData.source.name.pt_BR : apiData.source.name;
            }
          }
        } catch (_) {}
      }

      // 3. Fallback to Wowhead item/spell tooltip if needed
      if (!officialIcon || officialIcon.includes("ability_mount_ridinghorse")) {
        try {
          const whRes = await fetchWithTimeout(`https://nether.wowhead.com/tooltip/item/${mId}`, {}, 2000);
          if (whRes.ok) {
            const whData = await whRes.json();
            if (whData.name && officialName === "Official Mount") officialName = whData.name;
            if (whData.icon) officialIcon = `https://render.worldofwarcraft.com/us/icons/56/${whData.icon}.jpg`;
          }
        } catch (_) {}
      }

      const meta = {
        id: mId,
        name: officialName,
        iconUrl: officialIcon,
        spellId: enriched.spellId,
        itemId: enriched.itemId,
        mountType: officialMountType,
        creatureDisplayId: officialDisplayId,
        source: officialSource,
        description: officialDesc,
        speedBonus: enriched.speedBonus || "+100% Ground Speed",
        factionRequirement: enriched.factionRequirement || "ANY",
      };

      blizzardCache.set(cacheKey, meta, 24 * 60 * 60 * 1000); // 24h cache
      results.push(meta);
    }

    if (idParam && results.length === 1) {
      return res.json(results[0]);
    }
    return res.json({ mounts: results });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch mount metadata", details: err.message });
  }
});

// Endpoint to resolve BattlePetSpecies details by species ID with Wowhead tooltip & DB2
app.get("/api/blizzard/wow/battlepet-species/:id", async (req, res) => {
  try {
    const speciesId = parseInt(req.params.id, 10);
    if (!speciesId || isNaN(speciesId)) {
      return res.status(400).json({ error: "Invalid species id" });
    }

    const cacheKey = `blizz_pet_species_${speciesId}`;
    const cached = blizzardCache.get(cacheKey);
    if (cached) return res.json(cached);

    // 1. Authoritative base from blizzardCollectionsCatalog & blizzardMountDb
    const enriched = enrichPetWithBlizzardMetadata({ id: speciesId, speciesId });

    let name = enriched.name;
    let iconUrl = enriched.iconUrl;
    let family = enriched.family;
    let creatureDisplayId = enriched.creatureDisplayId;
    let description = "World of Warcraft Battle Pet Companion";
    let source = enriched.source || "Pet Battle / Wild Capture";

    // 2. Find creature ID mapped to this species ID from WOW_PET_CREATURE_TO_SPECIES
    const { WOW_PET_CREATURE_TO_SPECIES } = await import("./src/utils/blizzardMountDb");
    let mappedCreatureId: number | undefined;
    for (const [cStr, sId] of Object.entries(WOW_PET_CREATURE_TO_SPECIES)) {
      if (sId === speciesId) {
        mappedCreatureId = parseInt(cStr, 10);
        break;
      }
    }

    // 3. Query Wowhead tooltip API using creature ID
    if (mappedCreatureId) {
      try {
        const whRes = await fetchWithTimeout(`https://nether.wowhead.com/tooltip/npc/${mappedCreatureId}`, {}, 3000);
        if (whRes.ok) {
          const whData = await whRes.json();
          if (whData.name) name = whData.name;
          if (whData.tooltip) {
            // Extract description from quotes: "..."
            const descMatch = whData.tooltip.match(/"([^"]+)"/);
            if (descMatch) description = descMatch[1];
            // Extract source
            const sourceMatch = whData.tooltip.match(/color:\s*#FFD200[^>]*>([^<]+)<\/span>\s*([^<]+)/i);
            if (sourceMatch) {
              source = `${sourceMatch[1].trim()} ${sourceMatch[2].trim()}`;
            }
          }
        }
      } catch (_) {}
    }

    const result = {
      speciesId,
      creatureId: mappedCreatureId,
      name,
      iconUrl,
      family,
      creatureDisplayId: creatureDisplayId || 28917,
      description,
      source,
      quality: "RARE",
      abilities: enriched.abilities || ["Attack", "Defend", "Surge"],
    };

    blizzardCache.set(cacheKey, result, 24 * 60 * 60 * 1000);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to resolve BattlePetSpecies", details: err.message });
  }
});

const WOW_CLASS_ID_MAP: Record<number, string> = {
  1: "Warrior",
  2: "Paladin",
  3: "Hunter",
  4: "Rogue",
  5: "Priest",
  6: "Death Knight",
  7: "Shaman",
  8: "Mage",
  9: "Warlock",
  10: "Monk",
  11: "Druid",
  12: "Demon Hunter",
  13: "Evoker",
};

const WOW_RACE_ID_MAP: Record<number, string> = {
  1: "Human",
  2: "Orc",
  3: "Dwarf",
  4: "Night Elf",
  5: "Undead",
  6: "Tauren",
  7: "Gnome",
  8: "Troll",
  9: "Goblin",
  10: "Blood Elf",
  11: "Draenei",
  22: "Worgen",
  24: "Pandaren",
  25: "Pandaren",
  26: "Pandaren",
  27: "Nightborne",
  28: "Highmountain Tauren",
  29: "Void Elf",
  30: "Lightforged Draenei",
  31: "Zandalari Troll",
  32: "Kul Tiran",
  34: "Dark Iron Dwarf",
  35: "Vulpera",
  36: "Mag'har Orc",
  37: "Mechagnome",
  52: "Dracthyr",
  70: "Dracthyr",
  84: "Earthen",
  85: "Earthen",
};

const toEnglishClassName = (rawName?: string, classId?: number): string => {
  if (classId && WOW_CLASS_ID_MAP[classId]) return WOW_CLASS_ID_MAP[classId];
  if (!rawName) return "Warrior";
  const lower = rawName.toLowerCase().trim();
  if (lower.includes("guerreir") || lower.includes("warrior")) return "Warrior";
  if (lower.includes("paladin")) return "Paladin";
  if (lower.includes("caçador de dem") || lower.includes("cacador de dem") || lower.includes("demon hunter")) return "Demon Hunter";
  if (lower.includes("caçador") || lower.includes("cacador") || lower.includes("hunter")) return "Hunter";
  if (lower.includes("ladino") || lower.includes("rogue")) return "Rogue";
  if (lower.includes("sacerdote") || lower.includes("priest")) return "Priest";
  if (lower.includes("cavaleiro da morte") || lower.includes("death knight")) return "Death Knight";
  if (lower.includes("xamã") || lower.includes("xama") || lower.includes("shaman")) return "Shaman";
  if (lower.includes("mago") || lower.includes("mage")) return "Mage";
  if (lower.includes("bruxo") || lower.includes("warlock")) return "Warlock";
  if (lower.includes("monge") || lower.includes("monk")) return "Monk";
  if (lower.includes("druida") || lower.includes("druid")) return "Druid";
  if (lower.includes("conjurador") || lower.includes("evoker")) return "Evoker";
  return rawName;
};

const toEnglishRaceName = (rawName?: string, raceId?: number): string => {
  if (raceId && WOW_RACE_ID_MAP[raceId]) return WOW_RACE_ID_MAP[raceId];
  if (!rawName) return "Human";
  const lower = rawName.toLowerCase().trim();
  if (lower.includes("filho da noite") || lower.includes("filha da noite") || lower.includes("nightborne")) return "Nightborne";
  if (lower.includes("altamont") || lower.includes("highmountain")) return "Highmountain Tauren";
  if (lower.includes("mag'har") || lower.includes("maghar")) return "Mag'har Orc";
  if (lower.includes("zandalari")) return "Zandalari Troll";
  if (lower.includes("vulpera")) return "Vulpera";
  if (lower.includes("caótico") || lower.includes("caotico") || lower.includes("void elf")) return "Void Elf";
  if (lower.includes("forjado a luz") || lower.includes("lightforged")) return "Lightforged Draenei";
  if (lower.includes("ferro negro") || lower.includes("dark iron")) return "Dark Iron Dwarf";
  if (lower.includes("kul tir") || lower.includes("kultir")) return "Kul Tiran";
  if (lower.includes("mecagnomo") || lower.includes("mechagnome")) return "Mechagnome";
  if (lower.includes("dracthyr")) return "Dracthyr";
  if (lower.includes("terrestre") || lower.includes("earthen")) return "Earthen";
  if (lower.includes("sangrento") || lower.includes("elfo de sangue") || lower.includes("blood elf")) return "Blood Elf";
  if (lower.includes("elfo noturno") || lower.includes("elfa noturna") || lower.includes("night elf")) return "Night Elf";
  if (lower.includes("humano") || lower.includes("humana") || lower.includes("human")) return "Human";
  if (lower.includes("orc")) return "Orc";
  if (lower.includes("anão") || lower.includes("anao") || lower.includes("dwarf")) return "Dwarf";
  if (lower.includes("morto-vivo") || lower.includes("morto vivo") || lower.includes("undead") || lower.includes("forsaken")) return "Undead";
  if (lower.includes("tauren")) return "Tauren";
  if (lower.includes("gnomo") || lower.includes("gnome")) return "Gnome";
  if (lower.includes("troll")) return "Troll";
  if (lower.includes("goblin")) return "Goblin";
  if (lower.includes("draenei")) return "Draenei";
  if (lower.includes("worgen")) return "Worgen";
  if (lower.includes("pandaren")) return "Pandaren";
  return rawName;
};

// 4. Fetch Blizzard WoW Characters for the user (/wow/user/characters)
app.get(["/api/blizzard/wow/characters", "/api/blizzard/wow/user/characters"], async (req, res) => {
  try {
    const region = ((req.query.region as string) || "us").toLowerCase();
    const token = (req.query.token as string) || "";
    const rawVersion = ((req.query.version as string) || (req.query.wow_version as string) || "").toLowerCase();
    const force = req.query.force === "true" || req.query.nocache === "true";
    let gameId = (req.query.gameId as string) || "";
    if (!gameId && rawVersion) {
      if (rawVersion === "all") gameId = "all";
      else gameId = `wow-${rawVersion}`;
    } else if (!gameId) {
      gameId = "all";
    }

    // 1. Parse target mode
    let targetMode = "all";
    if (gameId && gameId !== "all") {
      targetMode = gameId.replace("wow-", "").toLowerCase();
    } else if (rawVersion && rawVersion !== "all") {
      targetMode = rawVersion.toLowerCase();
    }

    const cacheKey = `blizzard_wow_chars_v5_${region}_${gameId}_${rawVersion}_${token.substring(0, 15)}`;
    if (!force) {
      const cached = blizzardCache.get(cacheKey);
      if (cached && Array.isArray((cached as any).characters) && (cached as any).characters.length > 0) {
        res.json(cached);
        return;
      }
    }

    let apiCharacters: any[] = [];

    // Attempt official Blizzard Profile API if user token is valid
    if (token && !token.startsWith("bnet_token_")) {
      try {
        const apiHost = `https://${region}.api.blizzard.com`;
        
        // Namespaces in Blizzard API:
        // Retail: profile-${region}
        // Classic Era (Vanilla 1.15, SoD, Hardcore): profile-classic1x-${region}
        // Progression Classic (Cataclysm / MoP): profile-classic-${region}
        const queries: { namespace: string; defaultMode: string }[] = [];

        if (targetMode === "retail") {
          queries.push({ namespace: `profile-${region}`, defaultMode: "retail" });
        } else if (targetMode === "classic" || targetMode === "forever") {
          queries.push({ namespace: `profile-classic1x-${region}`, defaultMode: targetMode === "forever" ? "forever" : "classic" });
          queries.push({ namespace: `profile-classic-${region}`, defaultMode: "mop" });
        } else if (targetMode === "mop" || targetMode === "tbc") {
          queries.push({ namespace: `profile-classic-${region}`, defaultMode: "mop" });
          queries.push({ namespace: `profile-classic1x-${region}`, defaultMode: "classic" });
        } else {
          // "all" -> fetch all valid namespaces
          queries.push({ namespace: `profile-${region}`, defaultMode: "retail" });
          queries.push({ namespace: `profile-classic1x-${region}`, defaultMode: "classic" });
          queries.push({ namespace: `profile-classic-${region}`, defaultMode: "mop" });
        }

        const results = await Promise.allSettled(
          queries.map(async (q) => {
            const res = await fetchWithTimeout(`${apiHost}/profile/user/wow?namespace=${q.namespace}&locale=en_US`, {
              headers: {
                "Authorization": `Bearer ${token}`,
                "Battlenet-Namespace": q.namespace,
              }
            }, 7000);
            if (!res.ok) {
              const fallbackRes = await fetchWithTimeout(`${apiHost}/profile/user/wow?namespace=${q.namespace}&locale=en_US`, {
                headers: {
                  "Authorization": `Bearer ${token}`,
                  "Battlenet-Namespace": q.namespace,
                }
              }, 6000);
              if (!fallbackRes.ok) return { ok: false, mode: q.defaultMode, namespace: q.namespace, accounts: [] };
              const data = await fallbackRes.json();
              return { ok: true, mode: q.defaultMode, namespace: q.namespace, accounts: data.wow_accounts || [] };
            }
            const data = await res.json();
            return { ok: true, mode: q.defaultMode, namespace: q.namespace, accounts: data.wow_accounts || [] };
          })
        );

        const seenCharKeys = new Set<string>();

        for (const r of results) {
          if (r.status === "fulfilled" && r.value.ok) {
            const defaultMode = r.value.mode;
            const ns = r.value.namespace;
            for (const acc of r.value.accounts) {
              const accId = acc.id ? String(acc.id) : undefined;
              const accChars = acc.characters || [];
              for (const c of accChars) {
                const charLvl = typeof c.level === "number" && c.level > 0 ? c.level : 1;
                
                // Class resolution in English
                let charCls = toEnglishClassName(c.playable_class?.name, c.playable_class?.id);

                // Race resolution in English
                let charRace = toEnglishRaceName(c.playable_race?.name, c.playable_race?.id);

                const charGender = c.gender?.type || "MALE";
                let charFaction = "HORDE";
                if (c.faction?.type) {
                  charFaction = c.faction.type.toUpperCase().includes("ALLI") ? "ALLIANCE" : "HORDE";
                } else if (c.faction?.name) {
                  const fn = c.faction.name.toUpperCase();
                  charFaction = (fn.includes("ALIAN") || fn.includes("ALLI")) ? "ALLIANCE" : "HORDE";
                } else {
                  charFaction = getWowRaceFaction(charRace);
                }
                const rSlug = c.realm?.slug || (c.realm?.name ? c.realm.name.toLowerCase().replace(/['\s]+/g, "-") : "azralon");
                const rName = c.realm?.name || c.realm?.slug || "Azralon";
                const uniqueKey = `${c.name.toLowerCase()}-${rSlug}-${ns}`;

                if (seenCharKeys.has(uniqueKey)) continue;
                seenCharKeys.add(uniqueKey);
                
                // Accurate version tag:
                let modeTag = defaultMode;
                if (ns.includes("classic1x")) {
                  modeTag = targetMode === "forever" ? "forever" : "classic";
                } else if (ns.includes("classic-") || ns.includes("classic")) {
                  modeTag = targetMode === "tbc" ? "tbc" : "mop";
                } else {
                  modeTag = "retail";
                }

                // Calculate item level estimate if not returned
                const fallbackIlvl = modeTag === "retail" ? (charLvl >= 80 ? 620 : charLvl >= 70 ? 460 : charLvl * 5)
                  : modeTag === "mop" ? (charLvl >= 90 ? 496 : charLvl >= 85 ? 378 : charLvl * 4)
                  : (charLvl >= 60 ? 75 : charLvl * 1.5);

                apiCharacters.push({
                  id: c.id,
                  name: c.name,
                  realm: rName,
                  realmSlug: rSlug,
                  level: charLvl,
                  characterClass: charCls,
                  race: charRace,
                  faction: charFaction,
                  accountId: accId,
                  equippedItemLevel: c.equipped_item_level || Math.round(fallbackIlvl),
                  averageItemLevel: c.average_item_level || Math.round(fallbackIlvl),
                  activeSpec: c.active_spec?.name || "Primary Specialization",
                  gender: charGender,
                  gameMode: modeTag,
                  wow_version: modeTag,
                  classIconUrl: getWowClassIcon(charCls),
                  raceIconUrl: getWowRaceIcon(charRace, charGender),
                  factionIconUrl: getWowFactionIcon(charFaction, charRace),
                  avatarUrl: getWowRaceIcon(charRace, charGender),
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn("Aviso ao buscar perfil oficial do WoW na Blizzard API:", err);
      }
    }

    let characters: any[] = [];

    // Intelligently filter characters matching the requested targetMode
    if (targetMode === "classic" || targetMode === "forever") {
      const eraChars = apiCharacters.filter((c) => c.wow_version === "classic" || c.wow_version === "forever" || c.gameMode === "classic" || c.gameMode === "forever");
      if (eraChars.length > 0) {
        characters = eraChars;
      } else {
        // Fallback: If player has Progression Classic characters (Cataclysm/MoP), show them so they aren't hidden
        const progChars = apiCharacters.filter((c) => c.wow_version === "mop" || c.wow_version === "tbc" || c.gameMode === "mop");
        characters = progChars.length > 0 ? progChars : apiCharacters;
      }
    } else if (targetMode === "mop" || targetMode === "tbc") {
      const progChars = apiCharacters.filter((c) => c.wow_version === "mop" || c.wow_version === "tbc" || c.gameMode === "mop" || c.gameMode === "tbc");
      if (progChars.length > 0) {
        characters = progChars;
      } else {
        // Fallback: Classic Era characters
        const eraChars = apiCharacters.filter((c) => c.wow_version === "classic" || c.gameMode === "classic");
        characters = eraChars.length > 0 ? eraChars : apiCharacters;
      }
    } else if (targetMode === "retail") {
      const retailChars = apiCharacters.filter((c) => c.wow_version === "retail" || c.gameMode === "retail");
      characters = retailChars.length > 0 ? retailChars : apiCharacters;
    } else {
      characters = apiCharacters;
    }

    // Only return mock catalog if demo is explicitly requested (?demo=true)
    // Never inject fake/unwanted characters into real account synchronization!
    const isDemoRequested = req.query.demo === "true";
    const queryCharName = (req.query.character as string) || (req.query.name as string) || (req.query.characterName as string);
    const queryRealm = (req.query.realm as string) || (req.query.realmSlug as string) || "azralon";

    if (characters.length === 0 && queryCharName) {
      // Attempt to fetch specific character directly from public Blizzard API using client credentials
      const rSlug = queryRealm.toLowerCase().replace(/['\s]+/g, "-");
      const cName = queryCharName.toLowerCase();
      const credToken = (await getBlizzardClientCredentialsToken(region)) || "";
      if (credToken) {
        try {
          const namespacesToTry = [
            `profile-${region}`,
            `profile-classic1x-${region}`,
            `profile-classic-${region}`,
          ];
          for (const ns of namespacesToTry) {
            const charUrl = `https://${region}.api.blizzard.com/profile/wow/character/${encodeURIComponent(rSlug)}/${encodeURIComponent(cName)}?namespace=${ns}&locale=en_US`;
            const charRes = await fetch(charUrl, { headers: { Authorization: `Bearer ${credToken}` } });
            if (charRes.ok) {
              const cd = await charRes.json();
              const charFaction = cd.faction?.type || "HORDE";
              const charRace = cd.race?.name || "Orc";
              const charCls = cd.character_class?.name || "Warrior";
              const charGender = cd.gender?.type || "MALE";
              const modeTag = ns.includes("classic1x") ? "classic" : ns.includes("classic") ? "mop" : "retail";

              characters.push({
                id: cd.id || Date.now(),
                name: cd.name,
                realm: cd.realm?.name || queryRealm,
                realmSlug: cd.realm?.slug || rSlug,
                level: cd.level || 80,
                characterClass: charCls,
                race: charRace,
                faction: charFaction,
                equippedItemLevel: cd.equipped_item_level || 620,
                averageItemLevel: cd.average_item_level || cd.equipped_item_level || 620,
                activeSpec: cd.active_spec?.name || "Primary Specialization",
                gender: charGender,
                gameMode: modeTag,
                wow_version: modeTag,
                classIconUrl: getWowClassIcon(charCls),
                raceIconUrl: getWowRaceIcon(charRace, charGender),
                factionIconUrl: getWowFactionIcon(charFaction, charRace),
                avatarUrl: getWowRaceIcon(charRace, charGender),
              });
              break;
            }
          }
        } catch (e) {
          console.warn("Could not fetch individual character via client credentials:", e);
        }
      }
    }

    if (characters.length === 0 && isDemoRequested) {
      const defaultCatalog: Record<string, any[]> = {
        retail: [
          {
            name: "Haleck",
            realm: "Azralon",
            realmSlug: "azralon",
            level: 80,
            characterClass: "Warrior",
            race: "Orc",
            faction: "HORDE",
            equippedItemLevel: 625,
            averageItemLevel: 625,
            activeSpec: "Fury",
            gender: "MALE",
            gameMode: "retail",
            wow_version: "retail",
            classIconUrl: getWowClassIcon("Warrior"),
            raceIconUrl: getWowRaceIcon("Orc", "MALE"),
            factionIconUrl: getWowFactionIcon("HORDE"),
            avatarUrl: getWowRaceIcon("Orc", "MALE"),
          },
        ],
        classic: [
          {
            name: "Haleck",
            realm: "Whitemane",
            realmSlug: "whitemane",
            level: 60,
            characterClass: "Warrior",
            race: "Orc",
            faction: "HORDE",
            equippedItemLevel: 80,
            averageItemLevel: 80,
            activeSpec: "Arms",
            gender: "MALE",
            gameMode: "classic",
            wow_version: "classic",
            classIconUrl: getWowClassIcon("Warrior"),
            raceIconUrl: getWowRaceIcon("Orc", "MALE"),
            factionIconUrl: getWowFactionIcon("HORDE"),
            avatarUrl: getWowRaceIcon("Orc", "MALE"),
          },
        ],
        mop: [],
      };

      if (targetMode === "classic" || targetMode === "forever") {
        characters = defaultCatalog.classic;
      } else if (targetMode === "mop" || targetMode === "tbc") {
        characters = defaultCatalog.mop;
      } else if (targetMode === "retail") {
        characters = defaultCatalog.retail;
      } else {
        characters = [...defaultCatalog.retail, ...defaultCatalog.classic];
      }
    }

    // Sort: Highest level first, then alphabetical by name
    characters.sort((a, b) => (b.level || 0) - (a.level || 0) || a.name.localeCompare(b.name));

    const result = { success: true, characters, total: characters.length, targetMode };
    if (characters.length > 0) {
      blizzardCache.set(cacheKey, result, 5 * 60 * 1000);
    }
    res.json(result);
  } catch (err: any) {
    console.warn("Erro no /api/blizzard/wow/characters:", err);
    res.status(500).json({ success: false, error: err?.message || "Erro ao listar personagens de WoW" });
  }
});

const SERVER_KNOWN_ITEM_DISPLAYS: Record<number, { displayId: number; slotId: number; inventoryType: string; name: string }> = {
  157632: { displayId: 127184, slotId: 21, inventoryType: "TWOHWEAPON", name: "Staff of Interwoven Power" },
  157710: { displayId: 117298, slotId: 20, inventoryType: "ROBE", name: "Curate's Robe" },
  157709: { displayId: 139244, slotId: 6, inventoryType: "WAIST", name: "Curate's Cord" },
  157711: { displayId: 66904, slotId: 7, inventoryType: "LEGS", name: "Curate's Leggings" },
  157712: { displayId: 117300, slotId: 8, inventoryType: "FEET", name: "Curate's Boots" },
  157713: { displayId: 66395, slotId: 9, inventoryType: "WRIST", name: "Curate's Bracers" },
  157714: { displayId: 66376, slotId: 10, inventoryType: "HANDS", name: "Curate's Gloves" },
  157708: { displayId: 40075, slotId: 16, inventoryType: "CLOAK", name: "Curate's Cloak" },
  19019: { displayId: 31260, slotId: 21, inventoryType: "TWOHWEAPON", name: "Thunderfury, Blessed Blade of the Windseeker" },
  17182: { displayId: 28438, slotId: 21, inventoryType: "TWOHWEAPON", name: "Sulfuras, Hand of Ragnaros" },
  22589: { displayId: 39597, slotId: 21, inventoryType: "TWOHWEAPON", name: "Atiesh, Greatstaff of the Guardian" },
  32837: { displayId: 45233, slotId: 21, inventoryType: "WEAPONMAINHAND", name: "Warglaive of Azzinoth" },
  32838: { displayId: 45233, slotId: 22, inventoryType: "WEAPONOFFHAND", name: "Warglaive of Azzinoth" },
  46017: { displayId: 60232, slotId: 21, inventoryType: "WEAPONMAINHAND", name: "Val'anyr, Hammer of Ancient Kings" },
  49623: { displayId: 65377, slotId: 21, inventoryType: "TWOHWEAPON", name: "Shadowmourne" },
  71086: { displayId: 96350, slotId: 21, inventoryType: "TWOHWEAPON", name: "Dragonwrath, Tarecgosa's Rest" },
  77949: { displayId: 106367, slotId: 21, inventoryType: "WEAPONMAINHAND", name: "Golad, Twilight of Aspects" },
  77950: { displayId: 106367, slotId: 22, inventoryType: "WEAPONOFFHAND", name: "Tiriosh, Nightmare of Ages" },
  128935: { displayId: 147576, slotId: 21, inventoryType: "TWOHWEAPON", name: "Strom'kar, the Warbreaker" },
  128910: { displayId: 147610, slotId: 21, inventoryType: "TWOHWEAPON", name: "Warswords of the Valarjar" },
  128289: { displayId: 147610, slotId: 22, inventoryType: "WEAPONOFFHAND", name: "Warswords of the Valarjar" },
  120978: { displayId: 133202, slotId: 21, inventoryType: "TWOHWEAPON", name: "Ashbringer" },
};

/**
 * Resolves authoritative WoW Item Display ID, Appearance ID, and Slot ID from Blizzard Game Data API.
 * Maps Item ID -> Appearance ID -> Item Display Info ID (item_display_info_id)
 * Handles both base items and transmogrified items with persistent caching.
 */
async function resolveBlizzardItemDisplayData(
  itemId: number,
  region: string = "us",
  staticNs: string = `static-${region}`,
  headers: any
): Promise<{
  itemId: number;
  displayId: number;
  appearanceId: number;
  inventoryType: string;
  slotId: number;
  iconUrl?: string;
  name?: string;
}> {
  if (!itemId || itemId <= 0) {
    return { itemId, displayId: 0, appearanceId: 0, inventoryType: "", slotId: 0 };
  }

  const cacheKey = `blizz_item_display_v5_${region}_${itemId}`;
  const cached = blizzardCache.get(cacheKey);
  if (cached) return cached;

  const known = SERVER_KNOWN_ITEM_DISPLAYS[itemId];

  try {
    let displayId = known ? known.displayId : 0;
    let appearanceId = 0;
    let inventoryType = known ? known.inventoryType : "";
    let itemName = known ? known.name : "";
    let iconUrl = "";

    // 1. Fetch item definition from Blizzard Game Data API
    if (!displayId) {
      const itemRes = await fetchWithTimeout(
        `https://${region}.api.blizzard.com/data/wow/item/${itemId}?namespace=${staticNs}&locale=en_US`,
        { headers },
        4000
      );

      if (itemRes.ok) {
        const itemJson = await itemRes.json();
        if (!itemName) itemName = itemJson.name || "";
        if (!inventoryType) inventoryType = itemJson.inventory_type?.type || "";
        appearanceId = itemJson.appearances?.[0]?.id || 0;

        if (appearanceId > 0) {
          const appRes = await fetchWithTimeout(
            `https://${region}.api.blizzard.com/data/wow/item-appearance/${appearanceId}?namespace=${staticNs}&locale=en_US`,
            { headers },
            4000
          );
          if (appRes.ok) {
            const appJson = await appRes.json();
            displayId = appJson.item_display_info_id || 0;
          }
        }
      }
    }

    // 2. Fetch from Wowhead tooltip / XML API if Blizzard Game Data API did not yield displayId
    if (!displayId) {
      try {
        const whRes = await fetchWithTimeout(`https://nether.wowhead.com/tooltip/item/${itemId}`, {}, 3000);
        if (whRes.ok) {
          const whJson = await whRes.json();
          if (whJson.name && !itemName) itemName = whJson.name;
          if (whJson.displayid) displayId = Number(whJson.displayid);
          if (whJson.icon && !iconUrl) iconUrl = `https://render.worldofwarcraft.com/us/icons/56/${whJson.icon}.jpg`;
        }
      } catch (_) {}
    }

    if (!displayId) {
      try {
        const xmlRes = await fetchWithTimeout(`https://www.wowhead.com/item=${itemId}&xml`, {}, 3000);
        if (xmlRes.ok) {
          const xmlText = await xmlRes.text();
          const dispMatch = xmlText.match(/"displayid"\s*:\s*(\d+)/i) || xmlText.match(/<displayId>(\d+)<\/displayId>/i);
          if (dispMatch) displayId = parseInt(dispMatch[1], 10);
          const iconMatch = xmlText.match(/<icon[^>]*>(\w+)<\/icon>/i);
          if (iconMatch && !iconUrl) iconUrl = `https://render.worldofwarcraft.com/us/icons/56/${iconMatch[1].toLowerCase()}.jpg`;
          const nameMatch = xmlText.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/i);
          if (nameMatch && !itemName) itemName = nameMatch[1];
        }
      } catch (_) {}
    }

    // 3. Fetch official icon asset if not already retrieved
    const iconCached = blizzardCache.get(`blizz_item_icon_${region}_${itemId}`);
    if (iconCached) {
      if (!iconUrl) iconUrl = iconCached;
    } else if (!iconUrl) {
      try {
        const mediaRes = await fetchWithTimeout(
          `https://${region}.api.blizzard.com/data/wow/media/item/${itemId}?namespace=${staticNs}&locale=en_US`,
          { headers },
          3000
        );
        if (mediaRes.ok) {
          const mediaJson = await mediaRes.json();
          iconUrl = mediaJson.assets?.find((a: any) => a.key === "icon")?.value || "";
          if (iconUrl) {
            blizzardCache.set(`blizz_item_icon_${region}_${itemId}`, iconUrl, 24 * 60 * 60 * 1000);
          }
        }
      } catch (_) {}
    }

    // 3. Map slot ID according to WoW Model Viewer / ZamModelViewer standards
    let slotId = 0;
    const invUpper = (inventoryType || "").toUpperCase();
    if (invUpper === "HEAD") slotId = 1;
    else if (invUpper === "SHOULDER") slotId = 3;
    else if (invUpper === "BODY" || invUpper === "SHIRT") slotId = 4;
    else if (invUpper === "ROBE") slotId = 20;
    else if (invUpper === "CHEST") slotId = 5;
    else if (invUpper === "WAIST") slotId = 6;
    else if (invUpper === "LEGS") slotId = 7;
    else if (invUpper === "FEET") slotId = 8;
    else if (invUpper === "WRIST") slotId = 9;
    else if (invUpper === "HANDS") slotId = 10;
    else if (invUpper === "CLOAK") slotId = 16;
    else if (invUpper === "TABARD") slotId = 19;
    else if (
      invUpper === "TWOHWEAPON" ||
      invUpper === "WEAPON" ||
      invUpper === "WEAPONMAINHAND" ||
      invUpper === "RANGED" ||
      invUpper === "RANGEDRIGHT"
    ) slotId = 21;
    else if (
      invUpper === "SHIELD" ||
      invUpper === "WEAPONOFFHAND" ||
      invUpper === "HOLDABLE"
    ) slotId = 22;

    const result = {
      itemId,
      displayId,
      appearanceId,
      inventoryType,
      slotId,
      iconUrl,
      name: itemName,
    };

    if (displayId > 0) {
      blizzardCache.set(cacheKey, result, 30 * 24 * 60 * 60 * 1000);
    }
    return result;
  } catch (err) {
    return { itemId, displayId: 0, appearanceId: 0, inventoryType: "", slotId: 0 };
  }
}

// Known WoW achievement icon map and dynamic Wowhead resolver
const SERVER_ACHIEVEMENT_ICONS = new Map<number, string>([
  [6, "achievement_level_10"],
  [7, "achievement_level_20"],
  [8, "achievement_level_30"],
  [9, "achievement_level_40"],
  [10, "achievement_level_50"],
  [11, "achievement_level_60"],
  [12, "achievement_level_70"],
  [13, "achievement_level_80"],
  [14, "achievement_level_90"],
  [499, "achievement_dungeon_utgardepinnacle_heroic"],
  [504, "achievement_quests_completed_01"],
  [628, "achievement_dungeon_classicdungeonmaster"],
  [844, "achievement_zone_kalimdor_01"],
  [845, "achievement_zone_easternkingdoms_01"],
  [846, "achievement_zone_outland_01"],
  [847, "achievement_zone_northrend_01"],
  [1280, "achievement_boss_ragnaros"],
  [1301, "achievement_boss_onyxia"],
  [456, "achievement_dungeon_deadmines"],
  [457, "achievement_dungeon_shadowfangkeep"],
  [458, "achievement_dungeon_stockades"],
  [459, "achievement_dungeon_gnomeregan"],
  [460, "achievement_dungeon_scarletmonastery"],
  [461, "achievement_dungeon_zulfarrak"],
  [462, "achievement_dungeon_stratholme"],
  [463, "achievement_dungeon_scholomance"],
  [464, "achievement_dungeon_blackrockdepths"],
  [465, "achievement_dungeon_lowerblackrockspire"],
  [466, "achievement_dungeon_diremaul"],
  [514, "achievement_arena_2v2_1"],
  [515, "achievement_arena_3v3_1"],
  [516, "achievement_arena_5v5_1"],
  [1153, "achievement_bg_winwsg_10times"],
  [1154, "achievement_bg_winab_10times"],
  [1155, "achievement_bg_winav_10times"],
  [2144, "achievement_featsofstrength_gladiator"],
  [4820, "achievement_boss_lichking"],
]);

async function resolveWowheadAchievementIcon(id: number): Promise<string> {
  if (SERVER_ACHIEVEMENT_ICONS.has(id)) {
    const icon = SERVER_ACHIEVEMENT_ICONS.get(id)!;
    return `https://wow.zamimg.com/images/wow/icons/large/${icon}.jpg`;
  }
  try {
    const res = await fetchWithTimeout(`https://nether.wowhead.com/tooltip/achievement/${id}`, {}, 3000);
    if (res.ok) {
      const data = await res.json();
      if (data?.icon) {
        SERVER_ACHIEVEMENT_ICONS.set(id, data.icon);
        return `https://wow.zamimg.com/images/wow/icons/large/${data.icon}.jpg`;
      }
    }
  } catch (_) {}
  return "https://render.worldofwarcraft.com/us/icons/56/achievement_general.jpg";
}

// 5. Fetch Full Character Profile (Equipment, Talents, Achievements, Reputations)
app.get("/api/blizzard/wow/character-profile", async (req, res) => {
  try {
    const character = (req.query.character as string) || "Haleck";
    const realm = (req.query.realm as string) || "azralon";
    const region = ((req.query.region as string) || "us").toLowerCase();
    const gameId = (req.query.gameId as string) || "wow-retail";
    const token = (req.query.token as string) || "";

    // Explicit character attributes passed from character selection
    const charClassParam = (req.query.characterClass as string) || "";
    const raceParam = (req.query.race as string) || "";
    const levelParam = req.query.level !== undefined ? parseInt(req.query.level as string, 10) : undefined;
    const genderParam = (req.query.gender as string) || "";
    const factionParam = (req.query.faction as string) || "";
    const activeSpecParam = (req.query.activeSpec as string) || "";
    const equippedItemLevelParam = req.query.equippedItemLevel ? parseInt(req.query.equippedItemLevel as string, 10) : undefined;
    const versionParam = (req.query.version as string) || "";

    const cacheKey = `blizzard_char_profile_v3_${region}_${gameId}_${realm.toLowerCase()}_${character.toLowerCase()}_${charClassParam}_${levelParam || 0}`;
    const cached = blizzardCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const realmSlug = realm.toLowerCase().replace(/['\s]+/g, "-");
    const charLower = character.toLowerCase();

    // 1. Try Live Blizzard API with user token or client credentials
    let effectiveToken = token && !token.startsWith("bnet_token_") ? token : "";
    if (!effectiveToken) {
      effectiveToken = (await getBlizzardClientCredentialsToken(region)) || "";
    }

    if (effectiveToken) {
      try {
        let namespace = `profile-${region}`;
        if (gameId === "wow-classic" || gameId === "wow-forever" || versionParam === "classic" || versionParam === "forever") {
          namespace = `profile-classic1x-${region}`;
        } else if (gameId === "wow-tbc" || versionParam === "tbc" || gameId === "wow-mop" || versionParam === "mop") {
          namespace = `profile-classic-${region}`;
        }
        const headers = { Authorization: `Bearer ${effectiveToken}` };

        // Fetch primary profile summary
        let summaryUrl = `https://${region}.api.blizzard.com/profile/wow/character/${encodeURIComponent(realmSlug)}/${encodeURIComponent(charLower)}?namespace=${namespace}&locale=en_US`;
        let summaryRes = await fetch(summaryUrl, { headers });

        if (!summaryRes.ok) {
          // Try alternate namespaces across Retail, Progression Classic, and Classic Era
          const candidateNamespaces = [
            namespace.includes("classic1x") ? `profile-classic-${region}` : `profile-classic1x-${region}`,
            `profile-${region}`,
            `profile-classic1x-${region}`,
            `profile-classic-${region}`,
          ].filter((n) => n !== namespace);

          for (const candNs of candidateNamespaces) {
            summaryUrl = `https://${region}.api.blizzard.com/profile/wow/character/${encodeURIComponent(realmSlug)}/${encodeURIComponent(charLower)}?namespace=${candNs}&locale=en_US`;
            const altRes = await fetch(summaryUrl, { headers });
            if (altRes.ok) {
              summaryRes = altRes;
              namespace = candNs;
              break;
            }
          }
        }

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();

          // Fetch Equipment, Statistics, Achievements, Reputations, Media, Appearance, Collections, and Mythic+ in parallel
          const userCollectionsHeader = { Authorization: `Bearer ${token || effectiveToken}` };
          const isRetailNamespace = namespace === `profile-${region}` || namespace.startsWith("profile-us") || namespace.startsWith("profile-eu");
          const keystonePromise = isRetailNamespace
            ? fetch(`https://${region}.api.blizzard.com/profile/wow/character/${encodeURIComponent(realmSlug)}/${encodeURIComponent(charLower)}/mythic-keystone-profile?namespace=profile-${region}&locale=en_US`, { headers })
            : Promise.resolve(null);

          const [equipRes, statsRes, achieveRes, repRes, mediaRes, appearRes, mountsRes, petsRes, keystoneRes] = await Promise.allSettled([
            fetch(`https://${region}.api.blizzard.com/profile/wow/character/${encodeURIComponent(realmSlug)}/${encodeURIComponent(charLower)}/equipment?namespace=${namespace}&locale=en_US`, { headers }),
            fetch(`https://${region}.api.blizzard.com/profile/wow/character/${encodeURIComponent(realmSlug)}/${encodeURIComponent(charLower)}/statistics?namespace=${namespace}&locale=en_US`, { headers }),
            fetch(`https://${region}.api.blizzard.com/profile/wow/character/${encodeURIComponent(realmSlug)}/${encodeURIComponent(charLower)}/achievements?namespace=${namespace}&locale=en_US`, { headers }),
            fetch(`https://${region}.api.blizzard.com/profile/wow/character/${encodeURIComponent(realmSlug)}/${encodeURIComponent(charLower)}/reputations?namespace=${namespace}&locale=en_US`, { headers }),
            fetch(`https://${region}.api.blizzard.com/profile/wow/character/${encodeURIComponent(realmSlug)}/${encodeURIComponent(charLower)}/character-media?namespace=${namespace}&locale=en_US`, { headers }),
            fetch(`https://${region}.api.blizzard.com/profile/wow/character/${encodeURIComponent(realmSlug)}/${encodeURIComponent(charLower)}/appearance?namespace=${namespace}&locale=en_US`, { headers }),
            fetch(`https://${region}.api.blizzard.com/profile/user/wow/collections/mounts?namespace=profile-${region}&locale=en_US`, { headers: userCollectionsHeader }),
            fetch(`https://${region}.api.blizzard.com/profile/user/wow/collections/pets?namespace=profile-${region}&locale=en_US`, { headers: userCollectionsHeader }),
            keystonePromise,
          ]);

          const equipData = equipRes.status === "fulfilled" && equipRes.value && (equipRes.value as any).ok ? await (equipRes.value as any).json() : null;
          const statsData = statsRes.status === "fulfilled" && statsRes.value && (statsRes.value as any).ok ? await (statsRes.value as any).json() : null;
          const achieveData = achieveRes.status === "fulfilled" && achieveRes.value && (achieveRes.value as any).ok ? await (achieveRes.value as any).json() : null;
          const repData = repRes.status === "fulfilled" && repRes.value && (repRes.value as any).ok ? await (repRes.value as any).json() : null;
          const mediaData = mediaRes.status === "fulfilled" && mediaRes.value && (mediaRes.value as any).ok ? await (mediaRes.value as any).json() : null;
          const appearData = appearRes.status === "fulfilled" && appearRes.value && (appearRes.value as any).ok ? await (appearRes.value as any).json() : null;
          const mountsData = mountsRes.status === "fulfilled" && mountsRes.value && (mountsRes.value as any).ok ? await (mountsRes.value as any).json() : null;
          const petsData = petsRes.status === "fulfilled" && petsRes.value && (petsRes.value as any).ok ? await (petsRes.value as any).json() : null;
          const keystoneData = keystoneRes.status === "fulfilled" && keystoneRes.value && (keystoneRes.value as any).ok ? await (keystoneRes.value as any).json() : null;

          // Map slot to displayId from character appearance endpoint
          const appearSlotDisplayMap = new Map<string, number>();
          if (appearData?.items && Array.isArray(appearData.items)) {
            for (const aIt of appearData.items) {
              const slotType = aIt.slot?.type?.toUpperCase();
              const dId = aIt.display_id || aIt.item_appearance_modifier_id;
              if (slotType && dId) {
                appearSlotDisplayMap.set(slotType, dId);
              }
            }
          }

          // Resolve official item media icons and true 3D display IDs from Blizzard Static API in parallel
          const staticNs = namespace.includes("classic1x")
            ? `static-classic1x-${region}`
            : namespace.includes("classic")
            ? `static-classic-${region}`
            : `static-${region}`;

          const equippedItems: any[] = [];
          if (equipData?.equipped_items && Array.isArray(equipData.equipped_items)) {
            // First resolve in parallel all equipped items and their transmog counterparts
            const itemResolutions = await Promise.allSettled(
              equipData.equipped_items.map(async (it: any) => {
                const baseItemId = it.item?.id || 0;
                const transmogItemId = it.transmog?.item?.id;

                const [baseData, visualData] = await Promise.all([
                  baseItemId ? resolveBlizzardItemDisplayData(baseItemId, region, staticNs, headers) : null,
                  transmogItemId ? resolveBlizzardItemDisplayData(transmogItemId, region, staticNs, headers) : null,
                ]);

                return {
                  it,
                  baseItemId,
                  transmogItemId,
                  baseData,
                  visualData,
                };
              })
            );

            for (const r of itemResolutions) {
              if (r.status !== "fulfilled" || !r.value) continue;
              const { it, baseItemId, transmogItemId, baseData, visualData } = r.value;

              const slot = it.slot?.type || "MAIN_HAND";
              const statsArr: string[] = [];
              if (Array.isArray(it.stats)) {
                for (const st of it.stats) {
                  if (st.display?.display_string) statsArr.push(st.display.display_string);
                  else if (st.value && st.type?.name) statsArr.push(`+${st.value} ${st.type.name}`);
                }
              }

              // Determine visual displayId:
              // If transmogged and visualData has displayId, prioritize it!
              // Also check appearance endpoint displayId if visualData didn't have one
              const appearDisplayId = appearSlotDisplayMap.get(slot.toUpperCase()) || 0;
              const effectiveTransmogDisplayId = (visualData?.displayId || 0) > 0
                ? visualData!.displayId
                : (appearDisplayId > 0 && it.transmog ? appearDisplayId : 0);

              const isTransmogged = Boolean(transmogItemId || it.transmog);
              const resolvedDisplayId = (isTransmogged && effectiveTransmogDisplayId > 0)
                ? effectiveTransmogDisplayId
                : (baseData?.displayId || appearDisplayId || 0);

              // Determine slotId (e.g. 20 for ROBE, 5 for CHEST, 21 for MAIN_HAND, etc.)
              const effectiveInvType = (isTransmogged ? visualData?.inventoryType : baseData?.inventoryType) || it.inventory_type?.type || "";
              let resolvedSlotId = isTransmogged ? (visualData?.slotId || 0) : (baseData?.slotId || 0);

              if (!resolvedSlotId) {
                const slotUpper = slot.toUpperCase();
                if (slotUpper === "HEAD") resolvedSlotId = 1;
                else if (slotUpper === "SHOULDER") resolvedSlotId = 3;
                else if (slotUpper === "SHIRT") resolvedSlotId = 4;
                else if (slotUpper === "CHEST") resolvedSlotId = (effectiveInvType.toUpperCase() === "ROBE" || it.inventory_type?.type === "ROBE") ? 20 : 5;
                else if (slotUpper === "WAIST") resolvedSlotId = 6;
                else if (slotUpper === "LEGS") resolvedSlotId = 7;
                else if (slotUpper === "FEET") resolvedSlotId = 8;
                else if (slotUpper === "WRIST") resolvedSlotId = 9;
                else if (slotUpper === "HANDS") resolvedSlotId = 10;
                else if (slotUpper === "BACK") resolvedSlotId = 16;
                else if (slotUpper === "TABARD") resolvedSlotId = 19;
                else if (slotUpper === "MAIN_HAND") resolvedSlotId = 21;
                else if (slotUpper === "OFF_HAND") resolvedSlotId = 22;
                else if (slotUpper === "RANGED") resolvedSlotId = 26;
              }

              const resolvedIcon = baseData?.iconUrl || visualData?.iconUrl;
              const defaultSlotIcon = `https://render.worldofwarcraft.com/us/icons/56/${
                slot.toLowerCase().includes("head")
                  ? "inv_helmet_09"
                  : slot.toLowerCase().includes("shoulder")
                  ? "inv_shoulder_02"
                  : slot.toLowerCase().includes("chest")
                  ? "inv_chest_plate06"
                  : slot.toLowerCase().includes("belt") || slot.toLowerCase().includes("waist")
                  ? "inv_belt_12"
                  : slot.toLowerCase().includes("leg")
                  ? "inv_pants_03"
                  : slot.toLowerCase().includes("boot") || slot.toLowerCase().includes("feet")
                  ? "inv_boots_01"
                  : slot.toLowerCase().includes("glove") || slot.toLowerCase().includes("hand")
                  ? "inv_gauntlets_04"
                  : slot.toLowerCase().includes("wrist")
                  ? "inv_bracer_07"
                  : slot.toLowerCase().includes("shield")
                  ? "inv_shield_06"
                  : slot.toLowerCase().includes("bow") || slot.toLowerCase().includes("ranged")
                  ? "inv_weapon_bow_08"
                  : "inv_sword_39"
              }.jpg`;

              equippedItems.push({
                slot,
                slotId: resolvedSlotId,
                itemId: baseItemId,
                id: baseItemId,
                displayId: resolvedDisplayId,
                visualItemId: isTransmogged ? transmogItemId : baseItemId,
                name: it.name || "Item",
                itemLevel: it.level?.value || 0,
                quality: it.quality?.type || "COMMON",
                armor: it.armor?.value,
                armorType: it.inventory_type?.name,
                inventoryType: effectiveInvType,
                stats: statsArr,
                enchantment: it.enchantments?.[0]?.display_string,
                durability: it.durability?.display_string,
                binding: it.binding?.name,
                iconUrl: resolvedIcon || defaultSlotIcon,
                transmog: it.transmog ? {
                  itemId: it.transmog.item?.id,
                  name: it.transmog.item?.name,
                  displayString: it.transmog.display_string,
                  displayId: visualData?.displayId || 0,
                } : undefined,
              });
            }
          }

          // Parse live reputations
          const reputations: any[] = [];
          if (repData?.reputations && Array.isArray(repData.reputations)) {
            for (const r of repData.reputations.slice(0, 30)) {
              const standingRaw = r.standing?.name || "Neutral";
              reputations.push({
                id: r.faction?.id || 0,
                name: r.faction?.name || "Faction",
                standing: standingRaw,
                standingPtBR: standingRaw,
                current: r.standing?.value || 0,
                max: r.standing?.max || 3000,
                percent: r.standing?.max ? Math.min(100, Math.round(((r.standing?.value || 0) / r.standing.max) * 100)) : 100,
                category: "Azeroth",
              });
            }
          }

          // Parse live achievements without truncation
          const achievements: any[] = [];
          if (achieveData?.achievements && Array.isArray(achieveData.achievements)) {
            for (const a of achieveData.achievements) {
              const aId = a.id || a.achievement?.id || 0;
              const aTitle = a.achievement?.name || a.name || "Achievement";
              const aDesc = a.description || "";
              const aPoints = a.achievement?.points !== undefined ? a.achievement.points : a.points || 10;
              const completedAt = a.completed_timestamp ? Math.floor(a.completed_timestamp / 1000) : undefined;
              const isCharSpec = a.is_character_specific !== undefined ? !!a.is_character_specific : false;
              achievements.push({
                id: aId,
                title: aTitle,
                description: aDesc,
                points: aPoints,
                completedTimestamp: completedAt,
                isCharacterSpecific: isCharSpec,
                characterName: a.character?.name || summaryData.name,
                characterRealm: a.character?.realm?.slug || a.character?.realm?.name || summaryData.realm?.name,
                iconUrl: SERVER_ACHIEVEMENT_ICONS.has(aId)
                  ? `https://wow.zamimg.com/images/wow/icons/large/${SERVER_ACHIEVEMENT_ICONS.get(aId)}.jpg`
                  : "https://render.worldofwarcraft.com/us/icons/56/achievement_general.jpg",
              });
            }
          }

          // Parse media assets
          let avatarUrl = "";
          let renderUrl = "";
          let mainRawUrl = "";
          let insetUrl = "";

          if (mediaData?.assets && Array.isArray(mediaData.assets)) {
            for (const asset of mediaData.assets) {
              if (asset.key === "avatar") avatarUrl = asset.value;
              if (asset.key === "main") renderUrl = asset.value;
              if (asset.key === "main-raw") mainRawUrl = asset.value;
              if (asset.key === "inset") insetUrl = asset.value;
            }
          }

          const primaryRender =
            mainRawUrl ||
            renderUrl ||
            insetUrl ||
            `https://render.worldofwarcraft.com/${region}/character/${encodeURIComponent(realmSlug)}/${encodeURIComponent(charLower)}/main.png`;

          const liveClass = toEnglishClassName(summaryData.character_class?.name || charClassParam || "Warrior");
          const liveRace = toEnglishRaceName(summaryData.race?.name || raceParam || "Human");
          const liveFaction = (summaryData.faction?.type || factionParam || "ALLIANCE").toUpperCase();
          const liveLevel = summaryData.level || levelParam || 1;

          const profileData = {
            battleTag: "BattleTag#1234",
            name: summaryData.name || character,
            realm: summaryData.realm?.name || realm,
            realmSlug: summaryData.realm?.slug || realmSlug,
            level: liveLevel,
            characterClass: liveClass,
            race: liveRace,
            gender: summaryData.gender?.type || genderParam || "MALE",
            faction: liveFaction,
            equippedItemLevel: summaryData.equipped_item_level || equippedItemLevelParam || 0,
            averageItemLevel: summaryData.average_item_level || 0,
            activeSpec: summaryData.active_spec?.name || activeSpecParam || "Primary Specialization",
            achievementPoints: summaryData.achievement_points || 0,
            achievementPointsTotal: summaryData.achievement_points || 0,
            guild: summaryData.guild?.name || "",
            avatarUrl: avatarUrl || getWowClassIcon(liveClass),
            renderUrl: primaryRender,
            mainRawUrl: mainRawUrl || undefined,
            insetImageUrl: insetUrl || undefined,
            classIconUrl: getWowClassIcon(liveClass),
            raceIconUrl: getWowRaceIcon(liveRace, summaryData.gender?.type),
            factionIconUrl: getWowFactionIcon(liveFaction, liveRace),
            gameMode: gameId.replace("wow-", "") || "retail",
            stats: {
              health: statsData?.health || 100,
              power: statsData?.power || 100,
              powerType: statsData?.power_type?.name || "MANA",
              strength: statsData?.strength?.effective || 0,
              agility: statsData?.agility?.effective || 0,
              intellect: statsData?.intellect?.effective || 0,
              stamina: statsData?.stamina?.effective || 0,
              armor: statsData?.armor?.effective || 0,
              crit: statsData?.melee_crit?.value || statsData?.spell_crit?.value || 15,
              haste: statsData?.melee_haste?.value || 0,
              mastery: statsData?.mastery?.value || 0,
              versatility: statsData?.versatility || 0,
            },
            equippedItems: equippedItems.length > 0 ? equippedItems : undefined,
            gear: equippedItems,
            transmogs: equippedItems.reduce((acc: Record<string, any>, item: any) => {
              if (item.transmog) {
                acc[item.slot.toUpperCase()] = {
                  slot: item.slot,
                  slotId: item.slotId,
                  itemId: item.transmog.itemId,
                  displayId: item.transmog.displayId || item.displayId,
                  name: item.transmog.name,
                  displayString: item.transmog.displayString,
                };
              }
              return acc;
            }, {}),
            transmogSlots: equippedItems
              .filter((item: any) => Boolean(item.transmog))
              .map((item: any) => ({
                slot: item.slot,
                slotId: item.slotId,
                itemId: item.transmog.itemId,
                displayId: item.transmog.displayId || item.displayId,
                name: item.transmog.name,
                displayString: item.transmog.displayString,
              })),
            achievements,
            reputations,
            talents: [],
            appearance: appearData || undefined,
            lastSyncedAt: new Date().toISOString(),
          };

          // Generate base authentic profile for this character's class, level, and race
          const fallback = generateWoWCharacterProfile({
            name: character,
            realm,
            realmSlug,
            characterClass: liveClass,
            race: liveRace,
            level: liveLevel,
            gender: summaryData.gender?.type || genderParam,
            faction: liveFaction,
            activeSpec: summaryData.active_spec?.name || activeSpecParam,
            equippedItemLevel: summaryData.equipped_item_level || equippedItemLevelParam,
            gameMode: gameId.replace("wow-", ""),
          });

          // Always provide authentic inventory, bank, accountEconomy, mythicPlus, and worldBosses
          (profileData as any).inventory = fallback.inventory;
          (profileData as any).bank = fallback.bank;
          (profileData as any).accountEconomy = fallback.accountEconomy;
          (profileData as any).mythicPlus = fallback.mythicPlus;
          (profileData as any).worldBosses = fallback.worldBosses;

          const isClassicOrForever =
            namespace.includes("classic") ||
            gameId.includes("forever") ||
            gameId.includes("classic") ||
            versionParam === "classic" ||
            versionParam === "forever";

          // If live Mythic+ data was returned from Retail API, incorporate real rating and best runs
          if (keystoneData && keystoneData.current_mythic_rating && !isClassicOrForever) {
            const liveRating = Math.round(keystoneData.current_mythic_rating.rating || 0);
            const liveRuns = Array.isArray(keystoneData.current_period?.best_runs)
              ? keystoneData.current_period.best_runs.map((r: any) => ({
                  mapName: r.dungeon?.name || "Mythic Dungeon",
                  level: r.keystone_level || 10,
                  completed: !!r.is_completed_within_time,
                  score: Math.round(r.mythic_rating?.rating || 0),
                }))
              : [];
            (profileData as any).mythicPlus = {
              rating: liveRating,
              currentKeystone: (fallback.mythicPlus as any)?.currentKeystone,
              runHistory: liveRuns.length > 0 ? liveRuns : (fallback.mythicPlus as any)?.runHistory || [],
              greatVault: (fallback.mythicPlus as any)?.greatVault || [],
            };
          }

          // Strict version isolation: NEVER bleed retail features into classic/forever and vice-versa
          if (isClassicOrForever) {
            (profileData as any).mythicPlus = undefined;
            (profileData as any).greatVault = undefined;
            if ((profileData as any).bank) {
              (profileData as any).bank.warbandBank = undefined;
            }
          } else {
            (profileData as any).worldBosses = undefined;
          }

          // Merge collections: use live Blizzard account mounts & pets if available, enriched with authentic 3D display IDs and official CDN icons
          const liveMounts: any[] = [];
          if (mountsData?.mounts && Array.isArray(mountsData.mounts)) {
            let mOrder = 0;
            for (const m of mountsData.mounts) {
              const mId = m.mount?.id || 0;
              const mName = m.mount?.name || "Mount";
              const mDisplay = m.creature_display?.id || m.creature_displays?.[0]?.id || m.mount?.creature_displays?.[0]?.id;
              const isCharSpec = !!m.is_character_specific;
              const cName = m.character?.name || undefined;
              const cRealm = m.character?.realm?.slug || m.character?.realm?.name || undefined;
              const enriched = enrichMountWithBlizzardMetadata({
                id: mId,
                name: mName,
                creatureDisplayId: mDisplay,
                isFavorite: !!m.is_favorite,
                isCollected: true,
                isCharacterSpecific: isCharSpec,
                characterName: cName,
                characterRealm: cRealm,
                characterId: m.character?.id,
                unlockOrder: mOrder++,
                unlockedAt: mOrder,
              });
              liveMounts.push(enriched);
            }
          }

          const livePets: any[] = [];
          if (petsData?.pets && Array.isArray(petsData.pets)) {
            let pOrder = 0;
            for (const p of petsData.pets) {
              const pSpeciesId = p.species?.id || (typeof p.id === "number" && p.id < 100000 ? p.id : 0);
              const pId = p.id || pSpeciesId || 0;
              const pName = p.species?.name || p.name || "Pet";
              const pDisplay = p.creature_display?.id || p.creature_displays?.[0]?.id;
              const isCharSpec = !!p.is_character_specific;
              const cName = p.character?.name || undefined;
              const cRealm = p.character?.realm?.slug || p.character?.realm?.name || undefined;
              const enriched = enrichPetWithBlizzardMetadata({
                id: pId,
                speciesId: pSpeciesId,
                name: pName,
                creatureDisplayId: pDisplay,
                level: p.level || 1,
                quality: p.quality?.type || p.quality?.name || "RARE",
                isFavorite: !!p.is_favorite,
                isCollected: true,
                isCharacterSpecific: isCharSpec,
                characterName: cName,
                characterRealm: cRealm,
                characterId: p.character?.id,
                unlockOrder: pOrder++,
                unlockedAt: pOrder,
                stats: p.stats ? {
                  breedId: p.stats.breed_id,
                  health: p.stats.health,
                  power: p.stats.power,
                  speed: p.stats.speed,
                } : undefined,
              });
              livePets.push(enriched);
            }
          }

          // Deduplicate collections
          const uniqueMounts: any[] = [];
          const seenMountIds = new Set<number>();
          const allMounts = liveMounts.length > 0 ? [...liveMounts, ...(fallback.collections?.mounts || [])] : (fallback.collections?.mounts || []);
          for (const m of allMounts) {
            if (m && m.id && !seenMountIds.has(m.id)) {
              seenMountIds.add(m.id);
              uniqueMounts.push(m);
            }
          }

          const uniquePets: any[] = [];
          const seenPetIds = new Set<number>();
          const allPets = livePets.length > 0 ? [...livePets, ...(fallback.collections?.pets || [])] : (fallback.collections?.pets || []);
          for (const p of allPets) {
            if (p && p.id && !seenPetIds.has(p.id)) {
              seenPetIds.add(p.id);
              uniquePets.push(p);
            }
          }

          // Combine with rich 3D-enabled fallback collections
          (profileData as any).collections = {
            mounts: uniqueMounts,
            pets: uniquePets,
            toys: fallback.collections?.toys || [],
            titles: fallback.collections?.titles || [],
          };

          // If equipped items or stats are empty from API, fill in using generator
          if (!profileData.equippedItems || profileData.equippedItems.length === 0) {
            profileData.equippedItems = fallback.equippedItems;
            profileData.gear = fallback.gear;
            if (!profileData.stats.strength) profileData.stats = { ...profileData.stats, ...fallback.stats };
            if (profileData.reputations.length === 0) profileData.reputations = fallback.reputations;
            if (profileData.achievements.length === 0) profileData.achievements = fallback.achievements;
          }
          if (profileData.talents.length === 0) {
            profileData.talents = fallback.talents;
          }

          blizzardCache.set(cacheKey, profileData, 30 * 60 * 1000);
          res.json(profileData);
          return;
        }
      } catch (liveErr) {
        console.warn("Blizzard Live API profile fetch error, proceeding to authentic generator:", liveErr);
      }
    }

    // 2. Fallback: Generate authentic character profile matching the exact class, level, race, and faction
    const resolvedClass = charClassParam || (character.toLowerCase().includes("priest") ? "Priest" : character.toLowerCase().includes("mage") ? "Mage" : character.toLowerCase().includes("druid") ? "Druid" : character.toLowerCase().includes("warrior") ? "Warrior" : "Priest");
    const resolvedRace = raceParam || (resolvedClass === "Priest" ? "Human" : "Night Elf");
    const resolvedLevel = levelParam !== undefined ? levelParam : (gameId.includes("classic") || gameId.includes("forever") ? 60 : gameId.includes("tbc") ? 70 : gameId.includes("mop") ? 90 : 80);
    const resolvedGender = genderParam || "MALE";
    const resolvedFaction = factionParam || "ALLIANCE";
    const resolvedSpec = activeSpecParam || (resolvedClass === "Priest" ? "Holy" : resolvedClass === "Druid" ? "Feral" : "Primary Specialization");
    const resolvedIlvl = equippedItemLevelParam || (resolvedLevel <= 60 ? 82 : resolvedLevel <= 70 ? 141 : resolvedLevel <= 90 ? 496 : 625);

    const generatedProfile = generateWoWCharacterProfile({
      name: character,
      realm,
      realmSlug,
      characterClass: resolvedClass,
      race: resolvedRace,
      level: resolvedLevel,
      gender: resolvedGender,
      faction: resolvedFaction,
      activeSpec: resolvedSpec,
      equippedItemLevel: resolvedIlvl,
      gameMode: (versionParam || gameId.replace("wow-", "") || "retail"),
    });

    // Populate official icons
    generatedProfile.classIconUrl = getWowClassIcon(generatedProfile.characterClass);
    generatedProfile.raceIconUrl = getWowRaceIcon(generatedProfile.race, generatedProfile.gender);
    generatedProfile.factionIconUrl = getWowFactionIcon(generatedProfile.faction);

    blizzardCache.set(cacheKey, generatedProfile, 30 * 60 * 1000);
    res.json(generatedProfile);
  } catch (err: any) {
    console.warn("Erro no /api/blizzard/wow/character-profile:", err);
    res.status(500).json({ error: err?.message || "Erro ao obter detalhes do personagem de WoW" });
  }
});

// In-memory storage for WoW Addon sync snapshots and multi-character account economy
interface SyncedAddonRecord {
  receivedAt: string;
  profile: any;
  payload: any;
  detectedVersion: string;
  isForever: boolean;
  ruleset?: string;
}

const wowAddonSyncStore: Record<string, SyncedAddonRecord> = {};
const wowAddonEconomyStore: Record<string, {
  characterName: string;
  realm: string;
  gold: number;
  silver?: number;
  copper?: number;
  faction?: string;
  characterClass?: string;
  level?: number;
  lastUpdated: string;
}> = {};

// 1. Endpoint to receive in-game Addon export data (Lua SavedVariables or JSON)
app.post("/api/blizzard/wow/addon-sync", (req, res) => {
  try {
    const payload = req.body;
    if (!payload) {
      return res.status(400).json({ error: "Payload vazio ou inválido" });
    }

    let parsed: any = null;

    // Use robust parseAddonData parser
    if (payload.rawLua && typeof payload.rawLua === "string") {
      try {
        parsed = parseAddonData(payload.rawLua);
      } catch (err: any) {
        console.warn("Aviso ao analisar rawLua com parseAddonData, tentando fallback manual:", err?.message);
      }
    } else {
      try {
        parsed = parseAddonData(payload);
      } catch (_) {}
    }

    // Fallback if direct object structure
    const root = parsed?.rawPayload || payload.lastExport || payload.payload || payload;
    const profile = parsed?.activeProfile || root.character || {};
    const detectedVersion = parsed?.detectedVersion || (root.game?.isForever ? "forever" : root.game?.version || "retail");
    const isForever = parsed?.isForever || root.game?.isForever || detectedVersion.includes("forever");
    const ruleset = parsed?.ruleset || root.game?.ruleset || root.character?.ruleset;

    const charName = (profile.name || root.character?.name || "Unknown").toLowerCase();
    const realmRaw = (profile.realm || root.character?.realm || root.game?.realm || "Unknown");
    const realmSlug = (profile.realmSlug || realmRaw).toLowerCase().replace(/['\s]+/g, "-");
    const key = `${charName}-${realmSlug}`;

    // Enforce version strictness on the stored profile
    if (isForever || detectedVersion === "classic" || detectedVersion === "forever") {
      if (profile.bank) profile.bank.warbandBank = undefined;
      profile.mythicPlus = undefined;
      profile.greatVault = undefined;
    } else if (detectedVersion === "retail") {
      profile.worldBosses = undefined;
    }

    // Store snapshot
    const record: SyncedAddonRecord = {
      receivedAt: new Date().toISOString(),
      profile: profile,
      payload: root,
      detectedVersion,
      isForever,
      ruleset,
    };
    wowAddonSyncStore[key] = record;
    wowAddonSyncStore["latest"] = record;

    // Update Account Economy Store across alts
    const charKey = `${charName}-${realmSlug}`;
    const charGold = profile.inventory?.gold ?? root.inventory?.gold ?? 0;
    wowAddonEconomyStore[charKey] = {
      characterName: profile.name || root.character?.name || charName,
      realm: realmRaw,
      gold: charGold,
      silver: profile.inventory?.silver ?? root.inventory?.silver ?? 0,
      copper: profile.inventory?.copper ?? root.inventory?.copper ?? 0,
      faction: profile.faction || root.character?.faction,
      characterClass: profile.characterClass || root.character?.characterClass,
      level: profile.level || root.character?.level || 1,
      lastUpdated: new Date().toISOString(),
    };

    // If payload contains accountEconomy.charactersGold, merge them into the economy store
    const incomingAlts = profile.accountEconomy?.charactersGold || root.accountEconomy?.charactersGold;
    if (Array.isArray(incomingAlts)) {
      for (const alt of incomingAlts) {
        if (alt && alt.characterName) {
          const aKey = `${alt.characterName.toLowerCase()}-${(alt.realm || realmRaw).toLowerCase().replace(/['\s]+/g, "-")}`;
          wowAddonEconomyStore[aKey] = {
            characterName: alt.characterName,
            realm: alt.realm || realmRaw,
            gold: alt.gold || 0,
            faction: alt.faction,
            characterClass: alt.characterClass || alt.class,
            level: alt.level || 1,
            lastUpdated: new Date().toISOString(),
          };
        }
      }
    }

    // Calculate total account gold
    const totalGold = Object.values(wowAddonEconomyStore).reduce((acc, curr) => acc + (curr.gold || 0), 0);

    // Warm blizzardCache so immediate Armory calls return this synced profile
    blizzardCache.set(`blizz_char_profile_${charName}_${realmSlug}`, profile, 24 * 60 * 60 * 1000);
    blizzardCache.set(`blizz_char_profile_${charName}_${realmRaw.toLowerCase()}`, profile, 24 * 60 * 60 * 1000);

    return res.json({
      success: true,
      message: "Dados do Haleck Account Importer sincronizados com sucesso!",
      character: profile.name || charName,
      realm: realmRaw,
      ruleset: ruleset,
      level: profile.level || 1,
      characterClass: profile.characterClass || "Warrior",
      equippedItemLevel: profile.equippedItemLevel || 0,
      detectedVersion,
      isForever,
      bankItemsCount:
        (profile.bank?.mainBank?.length || 0) +
        (profile.bank?.reagentBank?.length || 0) +
        (profile.bank?.warbandBank?.length || 0),
      totalAccountGold: totalGold,
      totalAltsTracked: Object.keys(wowAddonEconomyStore).length,
      receivedAt: record.receivedAt,
    });
  } catch (err: any) {
    console.error("Erro ao sincronizar addon:", err);
    return res.status(500).json({ error: "Falha ao processar dados do addon", details: err?.message });
  }
});

// 2. Endpoint to query all synced characters and global account economy
app.get("/api/blizzard/wow/addon-sync/all", (req, res) => {
  const characters = Object.entries(wowAddonSyncStore)
    .filter(([k]) => k !== "latest")
    .map(([key, record]) => ({
      key,
      characterName: record.profile?.name,
      realm: record.profile?.realm,
      level: record.profile?.level,
      characterClass: record.profile?.characterClass,
      equippedItemLevel: record.profile?.equippedItemLevel,
      detectedVersion: record.detectedVersion,
      isForever: record.isForever,
      receivedAt: record.receivedAt,
      gold: record.profile?.inventory?.gold || 0,
      bankItemCount:
        (record.profile?.bank?.mainBank?.length || 0) +
        (record.profile?.bank?.reagentBank?.length || 0) +
        (record.profile?.bank?.warbandBank?.length || 0),
    }));

  const alts = Object.values(wowAddonEconomyStore);
  const totalAccountGold = alts.reduce((sum, a) => sum + (a.gold || 0), 0);

  return res.json({
    totalCharacters: characters.length,
    characters,
    accountEconomy: {
      totalGold: totalAccountGold,
      charactersGold: alts,
      totalAlts: alts.length,
    },
    latestSync: wowAddonSyncStore["latest"] || null,
  });
});

// 3. Endpoint to query detected WoW installation paths and version directories
app.get("/api/blizzard/wow/addon-sync/detect-paths", (req, res) => {
  res.json({
    success: true,
    preferredGame: "WoW Forever (Vanilla+)",
    officialLaunchDate: "2026-11-04",
    detectedEnvironments: [
      {
        versionKey: "forever_beta",
        name: "WoW Forever Beta (Build 16001 - Vanilla+)",
        clientFolder: "_classic_beta_",
        folderExample: "World of Warcraft/_classic_beta_/",
        addonPath: "World of Warcraft/_classic_beta_/Interface/AddOns/HaleckAccountImporter/",
        savedVariablesPath: "World of Warcraft/_classic_beta_/WTF/Account/<SUA_CONTA>/SavedVariables/HaleckAccountImporter.lua",
        interfaceBuild: "16001",
        status: "Active Beta",
        notes: "A pasta do WoW Forever Beta vem nomeada como _classic_beta_. Todas as APIs seguem regras Anti-Taint e chamadas seguras em pcall.",
      },
      {
        versionKey: "forever",
        name: "WoW Forever Oficial (Vanilla+)",
        clientFolder: "_classic_era_ ou _forever_",
        folderExample: "World of Warcraft/_classic_era_/",
        addonPath: "World of Warcraft/_classic_era_/Interface/AddOns/HaleckAccountImporter/",
        savedVariablesPath: "World of Warcraft/_classic_era_/WTF/Account/<SUA_CONTA>/SavedVariables/HaleckAccountImporter.lua",
        interfaceBuild: "16001",
        officialRelease: "04 de Novembro de 2026",
        notes: "Transição do Beta 16001 para lançamento oficial Vanilla+.",
      },
      {
        versionKey: "classic",
        name: "WoW Classic Era (1.15.x)",
        clientFolder: "_classic_era_",
        folderExample: "World of Warcraft/_classic_era_/",
        addonPath: "World of Warcraft/_classic_era_/Interface/AddOns/HaleckAccountImporter/",
        savedVariablesPath: "World of Warcraft/_classic_era_/WTF/Account/<SUA_CONTA>/SavedVariables/HaleckAccountImporter.lua",
        interfaceBuild: "11506",
      },
      {
        versionKey: "mop",
        name: "WoW Classic Progression (MoP/Cataclysm)",
        clientFolder: "_classic_",
        folderExample: "World of Warcraft/_classic_/",
        addonPath: "World of Warcraft/_classic_/Interface/AddOns/HaleckAccountImporter/",
        savedVariablesPath: "World of Warcraft/_classic_/WTF/Account/<SUA_CONTA>/SavedVariables/HaleckAccountImporter.lua",
        interfaceBuild: "50400",
      },
      {
        versionKey: "retail",
        name: "WoW Retail (The War Within 11.x)",
        clientFolder: "_retail_",
        folderExample: "World of Warcraft/_retail_/",
        addonPath: "World of Warcraft/_retail_/Interface/AddOns/HaleckAccountImporter/",
        savedVariablesPath: "World of Warcraft/_retail_/WTF/Account/<SUA_CONTA>/SavedVariables/HaleckAccountImporter.lua",
        interfaceBuild: "110100",
      },
    ],
  });
});

// 4. Endpoint to query account economy and total gold across all alts
app.get("/api/blizzard/wow/addon-sync/account-economy", (req, res) => {
  const alts = Object.values(wowAddonEconomyStore);
  const totalGold = alts.reduce((sum, a) => sum + (a.gold || 0), 0);
  return res.json({
    totalGold,
    totalAlts: alts.length,
    characters: alts,
    updatedAt: new Date().toISOString(),
  });
});

// 5. Endpoint to query synced addon data for a specific character
app.get("/api/blizzard/wow/addon-sync/:realm/:name", (req, res) => {
  const charName = req.params.name.toLowerCase();
  const realm = req.params.realm.toLowerCase().replace(/['\\s]+/g, "-");
  const key = `${charName}-${realm}`;
  const data = wowAddonSyncStore[key] || wowAddonSyncStore["latest"];
  if (!data) {
    return res.status(404).json({ error: "Nenhum dado de addon encontrado para este personagem" });
  }
  return res.json(data);
});

// 6. Endpoint to clear sync storage
app.post("/api/blizzard/wow/addon-sync/clear", (req, res) => {
  for (const k in wowAddonSyncStore) delete wowAddonSyncStore[k];
  for (const k in wowAddonEconomyStore) delete wowAddonEconomyStore[k];
  return res.json({ success: true, message: "Histórico de sincronização do Add-on limpo com sucesso." });
});


// 5.1. Resolve Single Item 3D Display ID & Metadata from Blizzard Game Data API
app.get("/api/blizzard/item-display/:id", async (req, res) => {
  try {
    const itemId = parseInt(req.params.id, 10);
    if (!itemId || isNaN(itemId)) {
      res.status(400).json({ error: "Invalid item ID" });
      return;
    }
    const region = ((req.query.region as string) || "us").toLowerCase();
    const token = (await getBlizzardClientCredentialsToken(region)) || "";
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const staticNs = `static-${region}`;

    const data = await resolveBlizzardItemDisplayData(itemId, region, staticNs, headers);
    res.json(data);
  } catch (err: any) {
    console.warn("Erro no /api/blizzard/item-display/:id:", err);
    res.status(500).json({ error: err?.message || "Erro ao obter display ID do item" });
  }
});

// 5.2. Batch Resolve Multiple Items 3D Display IDs from Blizzard Game Data API
app.post("/api/blizzard/items-display", async (req, res) => {
  try {
    const { itemIds, region = "us" } = req.body || {};
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      res.status(400).json({ error: "itemIds must be a non-empty array" });
      return;
    }

    const token = (await getBlizzardClientCredentialsToken(region)) || "";
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const staticNs = `static-${region}`;

    const results: Record<number, any> = {};
    const limitedIds = itemIds.slice(0, 50).filter((id: any) => typeof id === "number" && id > 0);

    const promises = limitedIds.map(async (id: number) => {
      const data = await resolveBlizzardItemDisplayData(id, region, staticNs, headers);
      results[id] = data;
    });

    await Promise.allSettled(promises);
    res.json({ success: true, items: results });
  } catch (err: any) {
    console.warn("Erro no /api/blizzard/items-display:", err);
    res.status(500).json({ error: err?.message || "Erro ao obter display IDs em lote" });
  }
});

// 5.3. Wowhead Achievement Icon Resolution (Single & Batch)
app.get("/api/wow/achievement-icons", async (req, res) => {
  try {
    const idsParam = req.query.ids as string;
    if (!idsParam) return res.json({ icons: {} });
    const ids = idsParam
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0)
      .slice(0, 100);

    const result: Record<number, string> = {};
    await Promise.all(
      ids.map(async (id) => {
        result[id] = await resolveWowheadAchievementIcon(id);
      })
    );
    res.json({ icons: result });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to resolve achievement icons", details: err?.message });
  }
});

app.post("/api/wow/achievement-icons", async (req, res) => {
  try {
    const ids: number[] = Array.isArray(req.body?.ids)
      ? req.body.ids.slice(0, 100).filter((id: any) => typeof id === "number" && id > 0)
      : [];
    const result: Record<number, string> = {};
    await Promise.all(
      ids.map(async (id) => {
        result[id] = await resolveWowheadAchievementIcon(id);
      })
    );
    res.json({ icons: result });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to resolve achievement icons", details: err?.message });
  }
});

// 5.4. Live Blizzard Character Achievements endpoint
app.get("/api/blizzard/wow/character-achievements", async (req, res) => {
  try {
    const name = (req.query.name as string) || "";
    const realm = (req.query.realm as string) || "";
    const region = ((req.query.region as string) || "us").toLowerCase();
    const gameMode = ((req.query.gameMode as string) || "retail").toLowerCase();

    if (!name || !realm) {
      return res.status(400).json({ error: "Name and realm are required" });
    }

    const token = (await getBlizzardClientCredentialsToken(region)) || "";
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    let namespace = `profile-${region}`;
    if (gameMode.includes("classic") || gameMode.includes("era") || gameMode.includes("forever")) {
      namespace = `profile-classic1x-${region}`;
    } else if (gameMode.includes("tbc") || gameMode.includes("mop")) {
      namespace = `profile-classic-${region}`;
    }

    const realmSlug = realm.toLowerCase().replace(/['\s]+/g, "-");
    const charLower = name.toLowerCase();

    const achieveUrl = `https://${region}.api.blizzard.com/profile/wow/character/${encodeURIComponent(
      realmSlug
    )}/${encodeURIComponent(charLower)}/achievements?namespace=${namespace}&locale=en_US`;

    const achieveRes = await fetch(achieveUrl, { headers });
    if (!achieveRes.ok) {
      return res.status(achieveRes.status).json({ error: "Character achievements not found on Blizzard API" });
    }

    const data = await achieveRes.json();
    const rawList = Array.isArray(data?.achievements) ? data.achievements : [];
    const parsed: any[] = [];

    for (const a of rawList) {
      const aId = a.id || a.achievement?.id || 0;
      const aTitle = a.achievement?.name || a.name || "Achievement";
      const aDesc = a.description || "";
      const aPoints = a.achievement?.points !== undefined ? a.achievement.points : a.points || 10;
      const completedAt = a.completed_timestamp ? Math.floor(a.completed_timestamp / 1000) : undefined;
      const isCharSpec = a.is_character_specific !== undefined ? !!a.is_character_specific : false;

      parsed.push({
        id: aId,
        title: aTitle,
        description: aDesc,
        points: aPoints,
        completedTimestamp: completedAt,
        isCharacterSpecific: isCharSpec,
        characterName: a.character?.name || name,
        characterRealm: a.character?.realm?.slug || a.character?.realm?.name || realm,
        iconUrl: SERVER_ACHIEVEMENT_ICONS.has(aId)
          ? `https://wow.zamimg.com/images/wow/icons/large/${SERVER_ACHIEVEMENT_ICONS.get(aId)}.jpg`
          : "https://render.worldofwarcraft.com/us/icons/56/achievement_general.jpg",
      });
    }

    // Resolve Wowhead icons for the first 40 achievements in parallel
    const topIds = parsed.slice(0, 40).map((a) => a.id);
    await Promise.all(
      topIds.map(async (id, idx) => {
        if (!SERVER_ACHIEVEMENT_ICONS.has(id)) {
          parsed[idx].iconUrl = await resolveWowheadAchievementIcon(id);
        }
      })
    );

    res.json({
      totalPoints: data?.total_quantity || 0,
      totalPointsCategories: data?.total_points || 0,
      achievements: parsed,
    });
  } catch (err: any) {
    console.warn("Erro no /api/blizzard/wow/character-achievements:", err);
    res.status(500).json({ error: err?.message || "Failed to fetch character achievements" });
  }
});

// --- IGDB (INTERNET GAME DATABASE) API INTEGRATION PROXY ENDPOINTS ---
const DEFAULT_IGDB_CLIENT_ID = "q7t22adru470b0ok1n0w1diijs94r1";
const DEFAULT_IGDB_CLIENT_SECRET = "nddpy82x7pink6ayhjmi1j7u2f9dzb";

const igdbCache = new SimpleTTLCache<any>(60 * 60 * 1000, 500); // 1h cache
let igdbCachedToken: string | null = null;
let igdbTokenExpiresAt: number = 0;

interface IgdbRateLimitInfo {
  limit: number;
  remaining: number;
  resetSeconds: number;
  requestsUsed: number;
}

let igdbRateLimitState: IgdbRateLimitInfo = {
  limit: 800,
  remaining: 800,
  resetSeconds: 60,
  requestsUsed: 0,
};
let igdbWindowStart = Date.now();

function updateIgdbRateLimit(headers?: Headers) {
  const now = Date.now();
  const elapsedSeconds = Math.floor((now - igdbWindowStart) / 1000);
  
  if (elapsedSeconds >= 60) {
    igdbWindowStart = now;
    igdbRateLimitState.remaining = igdbRateLimitState.limit;
    igdbRateLimitState.resetSeconds = 60;
  } else {
    igdbRateLimitState.resetSeconds = Math.max(1, 60 - elapsedSeconds);
  }

  if (headers) {
    const rem = headers.get("ratelimit-remaining") || headers.get("x-ratelimit-remaining") || headers.get("twitch-ratelimit-remaining");
    const lim = headers.get("ratelimit-limit") || headers.get("x-ratelimit-limit");
    const rst = headers.get("ratelimit-reset");

    if (rem !== null && rem !== undefined && !isNaN(Number(rem))) {
      igdbRateLimitState.remaining = Number(rem);
    }
    if (lim !== null && lim !== undefined && !isNaN(Number(lim))) {
      igdbRateLimitState.limit = Number(lim);
    }
    if (rst !== null && rst !== undefined && !isNaN(Number(rst))) {
      const resetTime = Number(rst);
      if (resetTime > 1000000000) {
        igdbRateLimitState.resetSeconds = Math.max(1, resetTime - Math.floor(now / 1000));
      } else {
        igdbRateLimitState.resetSeconds = Math.max(1, resetTime);
      }
    }
  }

  igdbRateLimitState.requestsUsed++;
  if (igdbRateLimitState.remaining > 0 && !headers?.get("ratelimit-remaining")) {
    igdbRateLimitState.remaining = Math.max(0, igdbRateLimitState.remaining - 1);
  }
}

function getIgdbCurrentRateLimit(): IgdbRateLimitInfo {
  const now = Date.now();
  const elapsedSeconds = Math.floor((now - igdbWindowStart) / 1000);
  if (elapsedSeconds >= 60) {
    igdbWindowStart = now;
    igdbRateLimitState.remaining = igdbRateLimitState.limit;
    igdbRateLimitState.resetSeconds = 60;
  } else {
    igdbRateLimitState.resetSeconds = Math.max(1, 60 - elapsedSeconds);
  }
  return { ...igdbRateLimitState };
}

async function getIgdbAuth(customClientId?: string, customSecret?: string): Promise<{ token: string; clientId: string }> {
  const clientId = (customClientId || process.env.IGDB_CLIENT_ID || process.env.TWITCH_CLIENT_ID || DEFAULT_IGDB_CLIENT_ID).trim();
  const clientSecret = (customSecret || process.env.IGDB_CLIENT_SECRET || process.env.TWITCH_CLIENT_SECRET || DEFAULT_IGDB_CLIENT_SECRET).trim();

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais do IGDB / Twitch não configuradas.");
  }

  const now = Date.now();
  const isDefaultCredentials = !customClientId && !customSecret;

  if (isDefaultCredentials && igdbCachedToken && igdbTokenExpiresAt > now + 60000) {
    return { token: igdbCachedToken, clientId };
  }

  const tokenUrl = `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`;
  const res = await fetchWithTimeout(tokenUrl, { method: "POST" }, 8000);
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Falha na autenticação do IGDB na Twitch (HTTP ${res.status}): ${errText}`);
  }

  const tokenData = await res.json();
  if (!tokenData.access_token) {
    throw new Error("Token de acesso não retornado pela Twitch.");
  }

  if (isDefaultCredentials) {
    igdbCachedToken = tokenData.access_token;
    igdbTokenExpiresAt = now + (tokenData.expires_in || 3600) * 1000;
  }

  return { token: tokenData.access_token, clientId };
}

const GENRE_TRANSLATIONS: Record<string, string> = {
  "Shooter": "Tiro / Shooter",
  "Adventure": "Aventura",
  "Role-playing (RPG)": "RPG",
  "Platform": "Plataforma",
  "Strategy": "Estratégia",
  "Action": "Ação",
  "Indie": "Indie",
  "Racing": "Corrida",
  "Fighting": "Luta",
  "Simulator": "Simulação",
  "Puzzle": "Puzzle",
  "Sport": "Esportes",
  "Music": "Música / Ritmo",
  "Arcade": "Arcade",
  "Visual Novel": "Visual Novel",
  "Hack and slash/Beat 'em up": "Hack and Slash",
  "Turn-based strategy (TBS)": "Estratégia por Turnos",
  "Real Time Strategy (RTS)": "Estratégia em Tempo Real",
  "Card & Board Game": "Cartas e Tabuleiro",
  "MOBA": "MOBA",
  "Point-and-click": "Point and Click",
  "Tactical": "Tático",
  "Quiz/Trivia": "Quiz / Trivia",
  "Pinball": "Pinball",
};

function formatIgdbGame(item: any) {
  const releaseDate = item.first_release_date
    ? new Date(item.first_release_date * 1000).toISOString().split("T")[0]
    : "";

  let developer = "";
  let publisher = "";
  if (Array.isArray(item.involved_companies)) {
    const devs = item.involved_companies.filter((c: any) => c.developer && c.company?.name).map((c: any) => c.company.name);
    const pubs = item.involved_companies.filter((c: any) => c.publisher && c.company?.name).map((c: any) => c.company.name);
    developer = devs.join(" / ");
    publisher = pubs.join(" / ");
  }

  const series = item.collection?.name || (item.franchises && item.franchises[0]?.name) || "";

  const genres = Array.isArray(item.genres)
    ? item.genres.map((g: any) => GENRE_TRANSLATIONS[g.name] || g.name)
    : [];

  const platforms = Array.isArray(item.platforms)
    ? item.platforms.map((p: any) => {
        if (p.name === "PC (Microsoft Windows)") return "PC";
        return p.name;
      })
    : [];

  const coverId = item.cover?.image_id;
  const coverUrl = coverId ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${coverId}.jpg` : "";
  const coverHdUrl = coverId ? `https://images.igdb.com/igdb/image/upload/t_720p/${coverId}.jpg` : "";
  const iconUrl = coverId ? `https://images.igdb.com/igdb/image/upload/t_thumb/${coverId}.jpg` : "";

  const artworks = Array.isArray(item.artworks)
    ? item.artworks.map((a: any) => ({
        id: a.id,
        url: `https://images.igdb.com/igdb/image/upload/t_720p/${a.image_id}.jpg`,
        hdUrl: `https://images.igdb.com/igdb/image/upload/t_1080p/${a.image_id}.jpg`,
      }))
    : [];

  const screenshots = Array.isArray(item.screenshots)
    ? item.screenshots.map((s: any) => ({
        id: s.id,
        url: `https://images.igdb.com/igdb/image/upload/t_720p/${s.image_id}.jpg`,
        hdUrl: `https://images.igdb.com/igdb/image/upload/t_1080p/${s.image_id}.jpg`,
      }))
    : [];

  const videos = Array.isArray(item.videos)
    ? item.videos.map((v: any) => ({
        id: v.id,
        videoId: v.video_id,
        title: v.name || "Trailer Oficial",
        youtubeUrl: `https://www.youtube.com/watch?v=${v.video_id}`,
      }))
    : [];

  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    series,
    summary: item.summary || item.storyline || "",
    storyline: item.storyline || "",
    releaseDate,
    developer,
    publisher,
    genres,
    platforms,
    rating: item.rating ? Math.round(item.rating) : undefined,
    aggregatedRating: item.aggregated_rating ? Math.round(item.aggregated_rating) : undefined,
    totalRating: item.total_rating ? Math.round(item.total_rating) : undefined,
    coverUrl,
    coverHdUrl,
    iconUrl,
    artworks,
    screenshots,
    videos,
    igdbUrl: item.url || (item.slug ? `https://www.igdb.com/games/${item.slug}` : undefined),
    source: "igdb" as const,
  };
}

// 1. Status and Credential Verification Endpoint
app.get("/api/igdb/status", async (req, res) => {
  try {
    const customClientId = req.query.clientId as string | undefined;
    const customSecret = req.query.clientSecret as string | undefined;
    const auth = await getIgdbAuth(customClientId, customSecret);

    const isCustomKey = !!(customClientId && customSecret);
    const masked = auth.clientId ? `${auth.clientId.slice(0, 4)}...${auth.clientId.slice(-4)}` : "Configurado";
    const rateLimit = getIgdbCurrentRateLimit();

    res.json({
      connected: true,
      message: "Conexão com a API do IGDB / Twitch estabelecida com sucesso!",
      clientIdMasked: masked,
      isCustomKey,
      rateLimit,
    });
  } catch (err: any) {
    res.status(500).json({
      connected: false,
      error: err?.message || "Falha ao verificar credenciais do IGDB.",
      rateLimit: getIgdbCurrentRateLimit(),
    });
  }
});

// 2. Search Games via IGDB
app.get("/api/igdb/search", async (req, res) => {
  try {
    const query = (req.query.q as string) || "";
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      res.status(400).json({ error: "Parâmetro 'q' contendo o nome do jogo é obrigatório." });
      return;
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 8, 1), 20);
    const customClientId = req.query.clientId as string | undefined;
    const customSecret = req.query.clientSecret as string | undefined;

    const cacheKey = `igdb:search:${cleanQuery.toLowerCase()}:${limit}`;
    const cached = igdbCache.get(cacheKey);
    if (cached) {
      res.json({ ...cached, cached: true, rateLimit: getIgdbCurrentRateLimit() });
      return;
    }

    const auth = await getIgdbAuth(customClientId, customSecret);

    const apicalypseBody = `search "${cleanQuery.replace(/"/g, '\\"')}"; fields id, name, slug, summary, storyline, first_release_date, cover.image_id, cover.url, artworks.image_id, artworks.url, screenshots.image_id, screenshots.url, genres.name, platforms.name, platforms.abbreviation, involved_companies.company.name, involved_companies.developer, involved_companies.publisher, total_rating, rating, aggregated_rating, rating_count, aggregated_rating_count, collection.name, franchises.name, videos.video_id, videos.name, url; limit ${limit};`;

    const igdbRes = await fetchWithTimeout("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": auth.clientId,
        "Authorization": `Bearer ${auth.token}`,
        "Accept": "application/json",
        "Content-Type": "text/plain",
      },
      body: apicalypseBody,
    }, 10000);

    updateIgdbRateLimit(igdbRes.headers);

    if (!igdbRes.ok) {
      const errText = await igdbRes.text().catch(() => "");
      throw new Error(`Erro na busca IGDB (HTTP ${igdbRes.status}): ${errText}`);
    }

    const rawGames = await igdbRes.json();
    const games = Array.isArray(rawGames) ? rawGames.map(formatIgdbGame) : [];

    const result = { success: true, count: games.length, games };
    igdbCache.set(cacheKey, result, 60 * 60 * 1000);
    res.json({ ...result, rateLimit: getIgdbCurrentRateLimit() });
  } catch (err: any) {
    console.warn("Erro no proxy /api/igdb/search:", err?.message || err);
    res.status(500).json({ error: err?.message || "Erro interno ao buscar jogos no IGDB.", rateLimit: getIgdbCurrentRateLimit() });
  }
});

// 3. Get Game Details by ID
app.get("/api/igdb/game-details", async (req, res) => {
  try {
    const gameId = req.query.id as string;
    if (!gameId) {
      res.status(400).json({ error: "Parâmetro 'id' do jogo no IGDB é obrigatório." });
      return;
    }

    const customClientId = req.query.clientId as string | undefined;
    const customSecret = req.query.clientSecret as string | undefined;

    const cacheKey = `igdb:game:${gameId}`;
    const cached = igdbCache.get(cacheKey);
    if (cached) {
      res.json({ ...cached, cached: true, rateLimit: getIgdbCurrentRateLimit() });
      return;
    }

    const auth = await getIgdbAuth(customClientId, customSecret);

    const apicalypseBody = `where id = ${parseInt(gameId, 10)}; fields id, name, slug, summary, storyline, first_release_date, cover.image_id, cover.url, artworks.image_id, artworks.url, screenshots.image_id, screenshots.url, genres.name, platforms.name, platforms.abbreviation, involved_companies.company.name, involved_companies.developer, involved_companies.publisher, total_rating, rating, aggregated_rating, rating_count, aggregated_rating_count, collection.name, franchises.name, videos.video_id, videos.name, url; limit 1;`;

    const igdbRes = await fetchWithTimeout("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": auth.clientId,
        "Authorization": `Bearer ${auth.token}`,
        "Accept": "application/json",
        "Content-Type": "text/plain",
      },
      body: apicalypseBody,
    }, 10000);

    updateIgdbRateLimit(igdbRes.headers);

    if (!igdbRes.ok) {
      const errText = await igdbRes.text().catch(() => "");
      throw new Error(`Erro ao obter detalhes no IGDB (HTTP ${igdbRes.status}): ${errText}`);
    }

    const rawList = await igdbRes.json();
    const rawGame = Array.isArray(rawList) && rawList.length > 0 ? rawList[0] : null;

    if (!rawGame) {
      res.status(404).json({ error: "Jogo não encontrado no IGDB." });
      return;
    }

    const game = formatIgdbGame(rawGame);
    const result = { success: true, game };
    igdbCache.set(cacheKey, result, 60 * 60 * 1000);
    res.json({ ...result, rateLimit: getIgdbCurrentRateLimit() });
  } catch (err: any) {
    console.warn("Erro no proxy /api/igdb/game-details:", err?.message || err);
    res.status(500).json({ error: err?.message || "Erro interno ao obter detalhes no IGDB.", rateLimit: getIgdbCurrentRateLimit() });
  }
});

// =============================================================
// STEAMGRIDDB API INTEGRATION (Covers, Heroes, Logos, Icons)
// =============================================================

function getSteamGridApiKey(req: express.Request): { key: string | null; isCustomKey: boolean } {
  const queryKey = (req.query.apiKey as string)?.trim();
  const headerKey = (req.headers["x-steamgriddb-key"] as string)?.trim();
  const authHeader = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();

  const customKey = queryKey || headerKey || (authHeader && !authHeader.startsWith("ey") ? authHeader : "");
  if (customKey) {
    return { key: customKey, isCustomKey: true };
  }

  const envKey = process.env.STEAMGRIDDB_API_KEY?.trim();
  if (envKey) {
    return { key: envKey, isCustomKey: false };
  }

  return { key: null, isCustomKey: false };
}

async function fetchSteamGrid(endpoint: string, apiKey: string, timeoutMs = 12000): Promise<any> {
  const url = endpoint.startsWith("http") ? endpoint : `https://www.steamgriddb.com/api/v2${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  const res = await fetchWithTimeout(url, {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json",
      "User-Agent": "HaleckGameLog/1.0"
    }
  }, timeoutMs);

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new Error("Chave de API do SteamGridDB inválida ou não autorizada. Verifique sua chave nas configurações.");
    }
    if (res.status === 404) {
      return { success: false, data: [] };
    }
    throw new Error(`Erro na API SteamGridDB (HTTP ${res.status}): ${errText || res.statusText}`);
  }

  return res.json();
}

// 1. SteamGridDB Connection Status
app.get("/api/steamgriddb/status", async (req, res) => {
  try {
    const { key, isCustomKey } = getSteamGridApiKey(req);
    if (!key) {
      res.json({
        connected: false,
        isCustomKey: false,
        message: "Nenhuma chave de API do SteamGridDB configurada. Gere sua chave gratuita em steamgriddb.com/profile/preferences/api."
      });
      return;
    }

    const testRes = await fetchSteamGrid("/games/id/1", key, 8000);
    const masked = key.length > 8 ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : "••••••••";

    if (testRes && (testRes.success || testRes.data)) {
      res.json({
        connected: true,
        isCustomKey,
        keyMasked: masked,
        message: "Conexão com a API do SteamGridDB validada com sucesso!"
      });
    } else {
      res.json({
        connected: false,
        isCustomKey,
        keyMasked: masked,
        message: "Não foi possível validar a chave com o SteamGridDB."
      });
    }
  } catch (err: any) {
    res.status(500).json({
      connected: false,
      isCustomKey: false,
      error: err?.message || "Falha ao verificar status da API do SteamGridDB."
    });
  }
});

// 2. SteamGridDB Search Autocomplete Games
app.get("/api/steamgriddb/search", async (req, res) => {
  try {
    const query = ((req.query.q as string) || "").trim();
    if (!query) {
      res.status(400).json({ error: "Parâmetro 'q' contendo o termo de busca é obrigatório." });
      return;
    }

    const { key } = getSteamGridApiKey(req);
    if (!key) {
      res.status(401).json({ error: "Chave do SteamGridDB não configurada. Insira sua chave nas Configurações." });
      return;
    }

    const cacheKey = `sgdb:search:${query.toLowerCase()}`;
    const cached = steamGridCache.get(cacheKey);
    if (cached) {
      res.json({ ...cached, cached: true });
      return;
    }

    const data = await fetchSteamGrid(`/search/autocomplete/${encodeURIComponent(query)}`, key);
    const games = Array.isArray(data?.data) ? data.data : [];

    const result = { success: true, count: games.length, games };
    steamGridCache.set(cacheKey, result, 2 * 60 * 60 * 1000); // 2 hours
    res.json(result);
  } catch (err: any) {
    console.warn("Erro no proxy /api/steamgriddb/search:", err?.message || err);
    res.status(500).json({ error: err?.message || "Erro interno ao buscar jogos no SteamGridDB." });
  }
});

// 3. SteamGridDB Unified Media Gallery (Grids, Heroes, Logos, Icons)
app.get("/api/steamgriddb/media", async (req, res) => {
  try {
    const query = ((req.query.q as string) || "").trim();
    let gameId = req.query.gameId as string | undefined;
    const steamAppId = req.query.steamAppId as string | undefined;
    const typesParam = (req.query.types as string) || "grid,hero,logo,icon";
    const nsfw = req.query.nsfw === "true" ? "true" : req.query.nsfw === "any" ? "any" : "false";
    const humor = req.query.humor === "true" ? "true" : req.query.humor === "any" ? "any" : "false";

    if (!gameId && !query && !steamAppId) {
      res.status(400).json({ error: "Informe 'gameId', 'q' ou 'steamAppId' para buscar mídias no SteamGridDB." });
      return;
    }

    const { key } = getSteamGridApiKey(req);
    if (!key) {
      res.status(401).json({ error: "Chave do SteamGridDB não configurada. Insira sua chave gratuita nas Configurações." });
      return;
    }

    const cacheKey = `sgdb:media:${gameId || (query ? query.toLowerCase() : steamAppId)}:${typesParam}:${nsfw}:${humor}`;
    const cached = steamGridCache.get(cacheKey);
    if (cached) {
      res.json({ ...cached, cached: true });
      return;
    }

    let targetGameName = query || "";
    let candidateGames: any[] = [];
    let targetGameId = gameId ? parseInt(gameId, 10) : undefined;

    // If query is provided, search autocomplete first to get candidates and primary targetGameId
    if (!targetGameId && query) {
      const searchRes = await fetchSteamGrid(`/search/autocomplete/${encodeURIComponent(query)}`, key);
      if (searchRes && Array.isArray(searchRes.data) && searchRes.data.length > 0) {
        candidateGames = searchRes.data;
        targetGameId = searchRes.data[0].id;
        targetGameName = searchRes.data[0].name;
      }
    }

    // If not found by query, but steamAppId was provided, attempt resolution via Steam App ID
    if (!targetGameId && steamAppId) {
      try {
        const steamGameRes = await fetchSteamGrid(`/games/steam/${steamAppId}`, key);
        if (steamGameRes && steamGameRes.data?.id) {
          targetGameId = steamGameRes.data.id;
          targetGameName = steamGameRes.data.name || targetGameName;
          candidateGames = [steamGameRes.data];
        }
      } catch (err) {
        // Continue to /steam/ endpoints
      }
    }

    if (!targetGameId && !steamAppId) {
      res.json({ success: true, count: 0, media: [], candidates: [] });
      return;
    }

    const requestedTypes = typesParam.split(",").map((t) => t.trim().toLowerCase());
    const tasks: Promise<any>[] = [];

    // Helper to determine media endpoint prefix (by gameId or by steamAppId)
    const getEndpoint = (category: string) => {
      if (targetGameId) {
        return `/${category}/game/${targetGameId}?nsfw=${nsfw}&humor=${humor}`;
      } else if (steamAppId) {
        return `/${category}/steam/${steamAppId}?nsfw=${nsfw}&humor=${humor}`;
      }
      return null;
    };

    if (requestedTypes.includes("grid")) {
      const ep = getEndpoint("grids");
      if (ep) tasks.push(fetchSteamGrid(ep, key).then((r) => ({ type: "grid", data: r?.data || [] })).catch(() => ({ type: "grid", data: [] })));
    }
    if (requestedTypes.includes("hero")) {
      const ep = getEndpoint("heroes");
      if (ep) tasks.push(fetchSteamGrid(ep, key).then((r) => ({ type: "hero", data: r?.data || [] })).catch(() => ({ type: "hero", data: [] })));
    }
    if (requestedTypes.includes("logo")) {
      const ep = getEndpoint("logos");
      if (ep) tasks.push(fetchSteamGrid(ep, key).then((r) => ({ type: "logo", data: r?.data || [] })).catch(() => ({ type: "logo", data: [] })));
    }
    if (requestedTypes.includes("icon")) {
      const ep = getEndpoint("icons");
      if (ep) tasks.push(fetchSteamGrid(ep, key).then((r) => ({ type: "icon", data: r?.data || [] })).catch(() => ({ type: "icon", data: [] })));
    }

    const responses = await Promise.all(tasks);
    const media: any[] = [];

    responses.forEach((resp) => {
      const type = resp.type;
      const items = Array.isArray(resp.data) ? resp.data : [];

      items.forEach((item: any) => {
        const width = item.width || (type === "hero" ? 1920 : type === "grid" ? 600 : 256);
        const height = item.height || (type === "hero" ? 620 : type === "grid" ? 900 : 256);

        let orientation: "vertical" | "horizontal" | "square" | "panoramic" = "vertical";
        if (type === "hero") {
          orientation = "panoramic";
        } else if (type === "icon") {
          orientation = "square";
        } else if (type === "logo") {
          orientation = width > height * 1.6 ? "horizontal" : "square";
        } else if (type === "grid") {
          orientation = height > width ? "vertical" : "horizontal";
        }

        media.push({
          id: `${type}_${item.id}`,
          rawId: item.id,
          type,
          style: item.style || "alternate",
          width,
          height,
          orientation,
          url: item.url,
          thumbUrl: item.thumb || item.url,
          mime: item.mime || "image/jpeg",
          score: item.score ?? 0,
          nsfw: !!item.nsfw,
          humor: !!item.humor,
          notes: item.notes || "",
          language: item.language || "en",
          author: item.author ? {
            name: item.author.name,
            steam64: item.author.steam64,
            avatar: item.author.avatar,
          } : undefined,
          gameId: targetGameId,
          gameName: targetGameName,
        });
      });
    });

    // Sort media by score descending, then by id
    media.sort((a, b) => (b.score || 0) - (a.score || 0));

    const result = {
      success: true,
      count: media.length,
      media,
      game: targetGameId ? { id: targetGameId, name: targetGameName } : undefined,
      candidates: candidateGames,
    };

    steamGridCache.set(cacheKey, result, 60 * 60 * 1000); // 1 hour
    res.json(result);
  } catch (err: any) {
    console.warn("Erro no proxy /api/steamgriddb/media:", err?.message || err);
    res.status(500).json({ error: err?.message || "Erro interno ao buscar mídias no SteamGridDB." });
  }
});

// 4. SteamGridDB Icons Dedicated Endpoint
app.get("/api/steamgriddb/icons", async (req, res) => {
  try {
    const query = ((req.query.q as string) || "").trim();
    let gameId = req.query.gameId as string | undefined;
    const steamAppId = req.query.steamAppId as string | undefined;

    if (!gameId && !query && !steamAppId) {
      res.status(400).json({ error: "Informe 'gameId', 'q' ou 'steamAppId' para buscar ícones no SteamGridDB." });
      return;
    }

    const { key } = getSteamGridApiKey(req);
    if (!key) {
      res.status(401).json({ error: "Chave do SteamGridDB não configurada. Insira sua chave nas Configurações." });
      return;
    }

    const cacheKey = `sgdb:icons:${gameId || (query ? query.toLowerCase() : steamAppId)}`;
    const cached = steamGridCache.get(cacheKey);
    if (cached) {
      res.json({ ...cached, cached: true });
      return;
    }

    let targetGameName = query || "";
    let candidateGames: any[] = [];
    let targetGameId = gameId ? parseInt(gameId, 10) : undefined;

    if (!targetGameId && query) {
      const searchRes = await fetchSteamGrid(`/search/autocomplete/${encodeURIComponent(query)}`, key);
      if (searchRes && Array.isArray(searchRes.data) && searchRes.data.length > 0) {
        candidateGames = searchRes.data;
        targetGameId = searchRes.data[0].id;
        targetGameName = searchRes.data[0].name;
      }
    }

    if (!targetGameId && steamAppId) {
      try {
        const steamGameRes = await fetchSteamGrid(`/games/steam/${steamAppId}`, key);
        if (steamGameRes && steamGameRes.data?.id) {
          targetGameId = steamGameRes.data.id;
          targetGameName = steamGameRes.data.name || targetGameName;
          candidateGames = [steamGameRes.data];
        }
      } catch (err) {
        // Continue
      }
    }

    if (!targetGameId && !steamAppId) {
      res.json({ success: true, count: 0, icons: [], candidates: [] });
      return;
    }

    const endpoint = targetGameId ? `/icons/game/${targetGameId}` : `/icons/steam/${steamAppId}`;
    const rawRes = await fetchSteamGrid(endpoint, key);
    const items = Array.isArray(rawRes?.data) ? rawRes.data : [];

    const icons = items.map((item: any) => ({
      id: `icon_${item.id}`,
      rawId: item.id,
      type: "icon",
      style: item.style || "official",
      width: item.width || 256,
      height: item.height || 256,
      orientation: "square",
      url: item.url,
      thumbUrl: item.thumb || item.url,
      mime: item.mime || "image/png",
      score: item.score ?? 0,
      nsfw: !!item.nsfw,
      humor: !!item.humor,
      notes: item.notes || "",
      author: item.author ? {
        name: item.author.name,
        steam64: item.author.steam64,
        avatar: item.author.avatar,
      } : undefined,
      gameId: targetGameId,
      gameName: targetGameName,
    }));

    icons.sort((a: any, b: any) => (b.score || 0) - (a.score || 0));

    const result = {
      success: true,
      count: icons.length,
      icons,
      game: targetGameId ? { id: targetGameId, name: targetGameName } : undefined,
      candidates: candidateGames,
    };

    steamGridCache.set(cacheKey, result, 60 * 60 * 1000);
    res.json(result);
  } catch (err: any) {
    console.warn("Erro no proxy /api/steamgriddb/icons:", err?.message || err);
    res.status(500).json({ error: err?.message || "Erro interno ao buscar ícones no SteamGridDB." });
  }
});

// System Health & Performance Monitoring Endpoint
app.get("/api/health", (req, res) => {
  const memoryUsage = process.memoryUsage();
  res.json({
    status: "ok",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    inFlightRequests: requestCoalescer.size,
    memory: {
      rssMb: Math.round(memoryUsage.rss / (1024 * 1024)),
      heapTotalMb: Math.round(memoryUsage.heapTotal / (1024 * 1024)),
      heapUsedMb: Math.round(memoryUsage.heapUsed / (1024 * 1024)),
    },
    cacheStats: {
      steamGrid: { hits: steamGridCache.hits, misses: steamGridCache.misses, size: steamGridCache.size },
      igdb: { hits: igdbCache.hits, misses: igdbCache.misses, size: igdbCache.size },
      hltb: { hits: hltbCache.hits, misses: hltbCache.misses, size: hltbCache.size },
      metacritic: { hits: metacriticCache.hits, misses: metacriticCache.misses, size: metacriticCache.size },
      wikipedia: { hits: wikiCache.hits, misses: wikiCache.misses, size: wikiCache.size },
      gameMetadata: { hits: gameMetadataCache.hits, misses: gameMetadataCache.misses, size: gameMetadataCache.size },
      imageProxy: { hits: imageProxyCache.hits, misses: imageProxyCache.misses, size: imageProxyCache.size },
      mediaUrl: { hits: mediaUrlCache.hits, misses: mediaUrlCache.misses, size: mediaUrlCache.size },
    },
  });
});

// Sliding window rate limiter for AI text correction
const textCorrectionTimestamps: number[] = [];

// Endpoint for AI-powered game journal text correction
app.post("/api/correct-text", express.json(), async (req, res) => {
  const now = Date.now();
  while (textCorrectionTimestamps.length > 0 && now - textCorrectionTimestamps[0] > 60000) {
    textCorrectionTimestamps.shift();
  }
  if (textCorrectionTimestamps.length >= 20) {
    res.status(429).json({
      error: "Muitas solicitações de correção por IA enviadas em pouco tempo. Aguarde alguns segundos.",
    });
    return;
  }
  textCorrectionTimestamps.push(now);

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

// Real-Time Server-Sent Events (SSE) Manager for Live Server Updates
const sseClients = new Set<express.Response>();

function broadcastSSE(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Broadcast server status periodically every 30 seconds if clients are connected
setInterval(() => {
  if (sseClients.size > 0) {
    const memoryUsage = process.memoryUsage();
    broadcastSSE("server_stats", {
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      inFlightRequests: requestCoalescer.size,
      connectedClients: sseClients.size,
      memory: {
        rssMb: Math.round(memoryUsage.rss / (1024 * 1024)),
        heapTotalMb: Math.round(memoryUsage.heapTotal / (1024 * 1024)),
        heapUsedMb: Math.round(memoryUsage.heapUsed / (1024 * 1024)),
      },
      cacheStats: {
        hltb: hltbCache.size,
        metacritic: metacriticCache.size,
        wikipedia: wikiCache.size,
        gameMetadata: gameMetadataCache.size,
        imageProxy: imageProxyCache.size,
        mediaUrl: mediaUrlCache.size,
      },
    });
  }
}, 30000);

// Endpoint SSE para atualizações e notificações do servidor em tempo real
app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  sseClients.add(res);

  const initialPayload = {
    type: "connected",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    connectedClients: sseClients.size,
    cacheStats: {
      hltb: hltbCache.size,
      metacritic: metacriticCache.size,
      wikipedia: wikiCache.size,
      gameMetadata: gameMetadataCache.size,
      imageProxy: imageProxyCache.size,
      mediaUrl: mediaUrlCache.size,
    },
  };

  res.write(`event: connected\ndata: ${JSON.stringify(initialPayload)}\n\n`);

  const heartbeatTimer = setInterval(() => {
    try {
      res.write(`event: ping\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
    } catch {
      clearInterval(heartbeatTimer);
      sseClients.delete(res);
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeatTimer);
    sseClients.delete(res);
  });

  res.on("error", () => {
    clearInterval(heartbeatTimer);
    sseClients.delete(res);
  });
});

// Endpoint para controle e limpeza manual de cache do servidor
app.post("/api/cache/purge", express.json(), (req, res) => {
  const { cacheName } = req.body || {};
  if (cacheName === "hltb") hltbCache.clear();
  else if (cacheName === "metacritic") metacriticCache.clear();
  else if (cacheName === "wikipedia") wikiCache.clear();
  else if (cacheName === "gameMetadata") gameMetadataCache.clear();
  else if (cacheName === "imageProxy") imageProxyCache.clear();
  else if (cacheName === "mediaUrl") mediaUrlCache.clear();
  else if (!cacheName || cacheName === "all") {
    hltbCache.clear();
    metacriticCache.clear();
    wikiCache.clear();
    gameMetadataCache.clear();
    imageProxyCache.clear();
    mediaUrlCache.clear();
  } else {
    res.status(400).json({ error: "Nome de cache inválido." });
    return;
  }
  broadcastSSE("cache_purged", { cacheName: cacheName || "all", timestamp: new Date().toISOString() });
  res.json({ message: "Cache limpo com sucesso!", cacheName: cacheName || "all" });
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

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Configuração de Keep-Alive e Timeouts para estabilidade sob tráfego e proxy (Cloud Run / Nginx)
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  // Handler para Graceful Shutdown no encerramento do container ou reinicialização
  const shutdown = (signal: string) => {
    console.log(`\n[Server Resilience] Recebido sinal ${signal}. Iniciando shutdown gracioso...`);
    server.close(() => {
      console.log("[Server Resilience] Conexões HTTP encerradas com sucesso.");
      process.exit(0);
    });
    setTimeout(() => {
      console.error("[Server Resilience] Forçando encerramento do processo após 10s.");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((err) => {
  console.error("Erro crítico ao iniciar o servidor backend:", err);
});
