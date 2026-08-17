import express from "express";
import compression from "compression";
import path from "path";
import { createServer as createViteServer } from "vite";
import { HowLongToBeatService } from "howlongtobeat";
import * as cheerio from "cheerio";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";

// Global process error handlers for backend resilience
process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ [Server Resilience] Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("⚠️ [Server Resilience] Uncaught Exception:", error);
});

const app = express();
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
    // If e-mail was entered, extract prefix or use as handle
    clean = clean.split("@")[0];
  }
  return clean.replace(/^@/, "");
}

// 1. Get GOG Player Profile
app.get("/api/gog/profile", async (req, res) => {
  try {
    const rawUser = (req.query.username as string) || "";
    const username = parseGogUsername(rawUser);
    const userId = (req.query.userId as string) || "";

    if (!username && !userId) {
      res.status(400).json({ error: "Nome de usuário, e-mail ou perfil da GOG é obrigatório." });
      return;
    }

    const cacheKey = `gog:profile:${username || userId}`;
    const cached = gogCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    // Try fetching from GOG embed public user endpoint if username exists
    let profileData: any = {
      username: username || `GOG_User_${userId}`,
      userId: userId || `gog_${Date.now().toString().slice(-6)}`,
      avatarUrl: `https://avatar.gog.com/${encodeURIComponent(username || "gog")}.jpg`,
      gamesCount: 0,
    };

    if (username) {
      try {
        const gogRes = await fetchWithTimeout(`https://embed.gog.com/users/${encodeURIComponent(username)}/games`, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        }, 6000);
        if (gogRes.ok) {
          const gamesData = await gogRes.json();
          if (Array.isArray(gamesData)) {
            profileData.gamesCount = gamesData.length;
          }
        }
      } catch (e) {
        console.warn("Aviso ao buscar perfil público da GOG:", e);
      }
    }

    const result = { success: true, profile: profileData };
    gogCache.set(cacheKey, result, 10 * 60 * 1000);
    res.json(result);
  } catch (err: any) {
    console.warn("Erro no proxy /api/gog/profile:", err?.message || err);
    res.status(500).json({ error: "Erro interno no servidor ao buscar perfil da GOG." });
  }
});

// 2. Get GOG Owned Games
app.get("/api/gog/owned-games", async (req, res) => {
  try {
    const rawUser = (req.query.username as string) || "";
    const username = parseGogUsername(rawUser);
    const userId = (req.query.userId as string) || "";

    const cacheKey = `gog:owned:${username || userId}`;
    const cached = gogCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    let games: any[] = [];
    if (username) {
      try {
        const gogRes = await fetchWithTimeout(`https://embed.gog.com/users/${encodeURIComponent(username)}/games`, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        }, 8000);
        if (gogRes.ok) {
          const rawGames = await gogRes.json();
          if (Array.isArray(rawGames)) {
            games = rawGames.map((g: any) => ({
              id: g.id,
              title: g.title,
              playtime_minutes: g.playtime || 0,
              last_played_timestamp: g.last_played ? Math.floor(new Date(g.last_played).getTime() / 1000) : undefined,
              img_icon_url: g.image || g.cover,
            }));
          }
        }
      } catch (e) {
        console.warn("Erro ao buscar biblioteca pública da GOG:", e);
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
    const gameId = req.query.gameId as string;
    const username = (req.query.username as string) || "";

    if (!gameId) {
      res.status(400).json({ error: "ID do jogo na GOG é obrigatório." });
      return;
    }

    const cacheKey = `gog:achievements:${gameId}:${username}`;
    const cached = gogCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    // Attempt fetching game product info from GOG catalog API
    let gameName = "Jogo GOG";
    try {
      const prodRes = await fetchWithTimeout(`https://api.gog.com/products/${encodeURIComponent(gameId)}`, {}, 6000);
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        if (prodData && prodData.title) {
          gameName = prodData.title;
        }
      }
    } catch (e) {}

    // Response structure
    const result = {
      success: true,
      gameName,
      achievements: [],
      unlockedCount: 0,
      totalCount: 0,
      percentage: 0,
    };

    gogCache.set(cacheKey, result, 30 * 60 * 1000);
    res.json(result);
  } catch (err: any) {
    console.warn(`Erro no proxy /api/gog/achievements para gameId ${req.query.gameId}:`, err?.message || err);
    res.status(500).json({ error: "Erro interno ao buscar conquistas na GOG." });
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
