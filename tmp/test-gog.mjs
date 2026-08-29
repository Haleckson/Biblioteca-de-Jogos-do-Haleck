import fetch from "node-fetch";

async function run() {
  const res = await fetch("https://profiles-static.gog.com/assets/bundle_min.js?8e8978b3", {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  const js = await res.text();
  
  // Search for API calls
  const urlPattern = /["'`](\/[a-zA-Z0-9_\-\/?=&]+|https?:\/\/[^"'`\s]+)["'`]/g;
  let m;
  const urls = new Set();
  while ((m = urlPattern.exec(js)) !== null) {
    const s = m[1];
    if (s.includes("api") || s.includes("game") || s.includes("user") || s.includes("stat") || s.includes("achiev") || s.includes("feed")) {
      if (!s.endsWith(".png") && !s.endsWith(".jpg") && !s.endsWith(".svg") && !s.endsWith(".css") && s.length < 100) {
        urls.add(s);
      }
    }
  }
  console.log("URLs found in GOG profiles bundle:", Array.from(urls));
}

run();
