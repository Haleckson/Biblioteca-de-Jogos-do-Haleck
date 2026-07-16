import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { HowLongToBeatService } from "howlongtobeat";
import * as cheerio from "cheerio";

const app = express();
const PORT = 3000;
const hltbService = new HowLongToBeatService();

app.use(express.json());

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

// Convert hours like "12½" to 12.5, or "12" to 12
function parseTimeToNumber(timeStr: string): number {
  let cleaned = timeStr.replace(/\s+/g, "");
  if (cleaned.includes("½")) {
    cleaned = cleaned.replace("½", "");
    const base = parseFloat(cleaned) || 0;
    return base + 0.5;
  }
  return parseFloat(cleaned) || 0;
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
    if (!text || text.startsWith('--')) return 0;
    let cleaned = text.replace(/[\n\r\t]+/g, "").replace(/\s+/g, "").trim();
    const isMins = cleaned.toLowerCase().includes("mins") || cleaned.toLowerCase().includes("min");
    
    const match = cleaned.match(/([\d\.]+)(½)?/);
    if (match) {
      let val = parseFloat(match[1]) || 0;
      if (match[2]) val += 0.5;
      if (isMins) {
        return Math.max(1, Math.round(val / 60));
      }
      return val;
    }
    return 0;
  };

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
      gameplayMain = timeVal;
    } else if (
      typeClean.includes("main + extra") || 
      typeClean.includes("main + sides") || 
      typeClean.includes("main+extra") || 
      typeClean.includes("main+sides") || 
      typeClean.includes("co-op")
    ) {
      gameplayMainExtra = timeVal;
    } else if (
      typeClean.includes("completionist") || 
      typeClean.includes("vs.") || 
      typeClean.includes("100%")
    ) {
      gameplayCompletionist = timeVal;
    }
  };

  // Try parsing from elements containing GameStats_game_times__
  const liElements = $('div[class*=GameStats_game_times__] li, li[class*=GameStats_game_times__], div[class*=GameStats_game_times__] div');
  liElements.each(function () {
    const h4Text = $(this).find('h4').text().trim();
    const h5Text = $(this).find('h5').text().trim();
    if (h4Text && h5Text) {
      processPair(h4Text, h5Text);
    }
  });

  // Sibling scan fallback
  if (gameplayMain === 0 && gameplayMainExtra === 0 && gameplayCompletionist === 0) {
    $('h4').each(function() {
      const typeText = $(this).text().trim();
      const siblingH5 = $(this).siblings('h5').text().trim() || $(this).parent().find('h5').text().trim();
      if (typeText && siblingH5) {
        processPair(typeText, siblingH5);
      }
    });
  }

  // Regex scan fallback
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

startServer();
