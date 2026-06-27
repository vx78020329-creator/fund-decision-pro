// Settings API - manage API keys
import { Router } from "express";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const settingsPath = resolve(__dirname, "../../data/settings.json");

function getSettings() {
  if (existsSync(settingsPath)) {
    try { return JSON.parse(readFileSync(settingsPath, "utf-8")); } catch { return {}; }
  }
  return {};
}

function saveSettings(data: Record<string, string>) {
  writeFileSync(settingsPath, JSON.stringify(data, null, 2), "utf-8");
}

const settingsRouter = Router();

settingsRouter.get("/", (_req, res) => {
  const s = getSettings();
  // Mask the API key for security
  const masked = { ...s } as Record<string, string>;
  if (masked.AI_API_KEY && masked.AI_API_KEY.length > 8) {
    masked.AI_API_KEY = masked.AI_API_KEY.substring(0, 4) + "****" + masked.AI_API_KEY.substring(masked.AI_API_KEY.length - 4);
  }
  // Add flag to indicate if a real key is configured
  masked._hasApiKey = !!(s.AI_API_KEY && !s.AI_API_KEY.includes("****") && s.AI_API_KEY !== "sk-placeholder");
  res.json(masked);
});

settingsRouter.post("/", (req, res) => {
  const { AI_BASE_URL, AI_API_KEY, AI_MODEL } = req.body;
  const current = getSettings();
  if (AI_BASE_URL !== undefined) current.AI_BASE_URL = AI_BASE_URL;
  if (AI_API_KEY !== undefined) current.AI_API_KEY = AI_API_KEY;
  if (AI_MODEL !== undefined) current.AI_MODEL = AI_MODEL;
  saveSettings(current);
  // Update process.env so the running server picks up new values
  if (current.AI_BASE_URL) process.env.AI_BASE_URL = current.AI_BASE_URL;
  if (current.AI_API_KEY) process.env.AI_API_KEY = current.AI_API_KEY;
  if (current.AI_MODEL) process.env.AI_MODEL = current.AI_MODEL;
  res.json({ ok: true, message: "Settings saved. Restart server to apply." });
});

settingsRouter.post("/test", async (_req, res) => {
  const s = getSettings();
  let baseUrl = s.AI_BASE_URL || process.env.AI_BASE_URL || "https://api.mimo.ai/v1";
  // Normalize: strip /chat/completions, ensure ends with /v1
  baseUrl = baseUrl.replace(/\/chat\/completions.*$/, "").replace(/\/$/, "");
  if (!baseUrl.endsWith("/v1")) baseUrl += "/v1";
  const apiKey = s.AI_API_KEY || process.env.AI_API_KEY || "sk-placeholder";
  const model = s.AI_MODEL || process.env.AI_MODEL || "mimo-v2.5-pro";
  try {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ baseURL: baseUrl, apiKey });
    const resp = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Say 'ok' in one word" }],
      max_tokens: 10,
    });
    res.json({ ok: true, reply: resp.choices[0]?.message?.content || "ok", model, baseUrl });
  } catch (err: any) {
    res.json({ ok: false, error: err.message || String(err) });
  }
});

import express from "express";
import cors from "cors";
import { db } from "./db/index.js";
import { fundsRouter } from "./routes/funds.js";
import { aiRouter } from "./routes/ai.js";
import { tradeRouter } from "./routes/trade.js";
import { portfolioRouter } from "./routes/portfolio.js";
import { marketRouter } from "./routes/market.js";
import { analysisRouter } from "./routes/analysis.js";
import { startAutoUpdate } from "./services/scraper.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/funds", fundsRouter);
app.use("/api/ai", aiRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/trade", tradeRouter);
app.use("/api/portfolio", portfolioRouter);
app.use("/api/market", marketRouter);
app.use("/api/analysis", analysisRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), dbPath: db.name });
});

// Serve static frontend in production
const distPath = resolve(__dirname, "../../dist");
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(resolve(distPath, "index.html"));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Fund Decision Pro API server running on port ${PORT}`);
  console.log(`   Database: ${db.name}`);
  console.log(`   Frontend: ${existsSync(distPath) ? distPath : "dev mode"}`);

  // Start background auto-update (every 4 hours)
  startAutoUpdate(4 * 60 * 60 * 1000);

  // Auto-sync on startup if database is empty (new deployment)
  const fundCount = db.prepare("SELECT COUNT(*) as c FROM funds").get() as { c: number };
  if (fundCount.c === 0) {
    console.log("[startup] Database empty, starting initial sync...");
    import("./services/scraper.js").then(({ syncFundList }) => {
      syncFundList().then(count => {
        console.log(`[startup] Initial sync complete: ${count} funds`);
      }).catch(err => console.error("[startup] Sync error:", err));
    });
  } else {
    console.log(`[startup] Database has ${fundCount.c} funds, skipping initial sync`);
  }
});
