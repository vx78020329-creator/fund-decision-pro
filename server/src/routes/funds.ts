import { Router } from "express";
import OpenAI from "openai";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { updateAllReturns1y } from "../services/update-returns.js";
import { getFunds, getFundByCode, getNavHistory, getHoldings, getSyncState, setSyncState, getDb, bulkInsertNav } from "../db/index.js";
import { syncFundList, syncFundNav, fetchFundDetail, fetchNavHistory, fetchEastmoneyNews, getSyncProgress } from "../services/scraper.js";

export const fundsRouter = Router();

// ===== AI News Analysis =====
const _aiCache = new Map();
let _aiRunning = false;

function _loadCfg() {
  const p = resolve(dirname(fileURLToPath(import.meta.url)), "../../data/settings.json");
  if (existsSync(p)) { try { return JSON.parse(readFileSync(p, "utf-8")); } catch {} }
  return {};
}
function _getClient() {
  const s = _loadCfg();
  let url = s.AI_BASE_URL || "https://token-plan-cn.xiaomimimo.com/v1";
  if (!url.endsWith("/v1")) url += "/v1";
  return new OpenAI({ baseURL: url, apiKey: s.AI_API_KEY || "" });
}
function _getModel() { return _loadCfg().AI_MODEL || "mimo-v2.5-pro"; }

async function _analyzeOne(title, content, source) {
  const key = title.slice(0, 40);
  if (_aiCache.has(key)) return _aiCache.get(key);
  try {
    const client = _getClient();
    const r = await client.chat.completions.create({
      model: _getModel(),
      messages: [
        { role: "user", content: "\u4F60\u662F\u91D1\u878D\u5206\u6790\u5E08\u3002\u5206\u6790\u4EE5\u4E0B\u65B0\u95FB\uFF0C\u76F4\u63A5\u8F93\u51FA\u4E09\u884C\uFF0C\u4E0D\u8981\u5176\u4ED6\u6587\u5B57\uFF1A\n\u7B2C\u4E00\u884C\uFF1A\u6838\u5FC3\u5185\u5BB9\u6458\u8981(\u4E0D\u8D8520\u5B57)\n\u7B2C\u4E8C\u884C\uFF1A\u5BF9\u5E02\u573A\u7684\u5F71\u54CD(\u4E0D\u8D8550\u5B57)\n\u7B2C\u4E09\u884C\uFF1A\u6295\u8D44\u5EFA\u8BAE(\u4E0D\u8D8530\u5B57)\n\n\u65B0\u95FB\uFF1A" + title + "\n" + (content || title) },
      ],
      temperature: 0.3,
      max_tokens: 400,
    });
    const raw = (r.choices[0]?.message?.content || r.choices[0]?.message?.reasoning_content || "").trim();
    const lines = raw.split("\n").map(l => l.replace(/^[\d\.\s]+/, "").trim()).filter(l => l.length > 2 && l.length < 100 && !l.includes("?") && !l.includes("\uFF1F"));

    let summary = lines[0] || "";
    let impact = lines[1] || "";
    let rec = lines[2] || "";
    
    // Direction guess from content
    const full = summary + impact + rec;
    let dir = "neutral";
    let score = 5;
    if (/\u770B\u591A|\u5229\u597D|\u4E0A\u6DA8|\u6B63\u9762|\u7A81\u7834|\u521B\u65B0\u9AD8/.test(full)) dir = "positive";
    else if (/\u770B\u7A7A|\u5229\u7A7A|\u4E0B\u8DCC|\u8DCC\u5E45|\u8D1F\u9762|\u98CE\u9669/.test(full)) dir = "negative";
    
    if (!summary || summary.length < 3) { console.log("[news-ai] empty:", raw.slice(0, 40)); return null; }
    const obj = { summary: summary.slice(0, 100), impact: impact.slice(0, 200), recommendation: rec.slice(0, 100), impactScore: score, direction: dir };
    _aiCache.set(key, obj);
    console.log("[news-ai] ok:", summary.slice(0, 40));
    return obj;
  } catch (e) { console.error("[news-ai] err:", e.message); }
  return null;
}
async function _batchAnalyze(news) {
  if (_aiRunning) return;
  _aiRunning = true;
  try {
    const todo = news.filter(n => !_aiCache.has(n.title.slice(0, 40))).slice(0, 25);
    console.log("[news-ai] analyzing", todo.length, "items...");
    for (const item of todo) {
      const r = await _analyzeOne(item.title, item.content, item.source);
      if (r) { item.aiSummary = r.summary; item.aiImpact = r.impact; item.aiRecommendation = r.recommendation; item.aiImpactScore = r.impactScore; item.aiDirection = r.direction; }
      await new Promise(x => setTimeout(x, 150));
    }
    console.log("[news-ai] batch done, cache:", _aiCache.size);
  } finally { _aiRunning = false; }
}

function _enrich(news) {
  return news.map(item => {
    const c = _aiCache.get(item.title.slice(0, 40));
    return c ? { ...item, aiSummary: c.summary, aiImpact: c.impact, aiRecommendation: c.recommendation, aiImpactScore: c.impactScore, aiDirection: c.direction } : item;
  });
}

fundsRouter.get("/news/list", async (_req, res) => {
  try {
    const news = await fetchEastmoneyNews();
    res.json(_enrich(news));
    _batchAnalyze(news).catch(() => {});
  } catch { res.json([]); }
});

// ===== Fund List =====
fundsRouter.get("/", (req, res) => {
  const keyword = req.query.keyword || undefined;
  const type = req.query.type || undefined;
  const sortBy = req.query.sortBy || undefined;
  const sortOrder = req.query.sortOrder || undefined;
  const riskLevel = req.query.riskLevel != null ? Number(req.query.riskLevel) : undefined;
  const page = req.query.page != null ? Number(req.query.page) : 1;
  const pageSize = req.query.pageSize != null ? Number(req.query.pageSize) : 20;
  res.json(getFunds({ keyword, type, sortBy, sortOrder, riskLevel, page, pageSize }));
});

fundsRouter.get("/count", (_req, res) => {
  res.json({ total: getFunds({ pageSize: 1 }).total });
});

// ===== Sync =====
fundsRouter.post("/sync", async (_req, res) => {
  try {
    const count = await syncFundList();
    await updateAllReturns1y();
    setSyncState("last_sync", new Date().toISOString());
    res.json({ synced: count });
  } catch (err) {
    console.error("[sync] error:", err);
    res.status(500).json({ error: "Sync failed" });
  }
});

fundsRouter.get("/sync/progress", (_req, res) => {
  res.json(getSyncProgress());
});

// ===== Fund Detail =====
fundsRouter.get("/:code", async (req, res) => {
  let fund = getFundByCode(req.params.code);
  if (!fund) { res.status(404).json({ error: "Fund not found" }); return; }
  const lastUpdate = fund.updated_at ? new Date(fund.updated_at).toDateString() : "";
  const today = new Date().toDateString();
  if (!fund.nav || fund.nav === 0 || lastUpdate !== today) {
    try {
      const [navs, detail] = await Promise.all([
        fetchNavHistory(req.params.code, 30),
        fetchFundDetail(req.params.code),
      ]);
      const latest = navs.length > 0 ? navs[0] : null;
      const db = getDb();
      db.prepare("UPDATE funds SET nav = ?, acc_nav = ?, daily_return = ?, size = ?, manager = CASE WHEN ? != '' THEN ? ELSE manager END, company = CASE WHEN ? != '' THEN ? ELSE company END, fee_manage = ?, fee_custody = ?, updated_at = datetime('now') WHERE code = ?")
        .run(latest?.nav || 0, latest?.accNav || 0, latest?.return || 0, detail.size || 0, detail.manager, detail.manager, detail.company, detail.company, detail.fees.manage, detail.fees.custody, req.params.code);
      if (navs.length > 0) bulkInsertNav(req.params.code, navs.map(n => ({ date: n.date, nav: n.nav, return: n.return })));
      fund = getFundByCode(req.params.code);
    } catch (err) { console.error("[fund detail] auto-sync error:", err); }
  }
  res.json(fund);
});

fundsRouter.get("/:code/nav", (req, res) => {
  const days = req.query.days != null ? Number(req.query.days) : undefined;
  res.json(getNavHistory(req.params.code, days));
});

fundsRouter.get("/:code/holdings", (req, res) => {
  res.json(getHoldings(req.params.code));
});

fundsRouter.post("/:code/sync", async (req, res) => {
  try {
    const [detail, navCount] = await Promise.all([
      fetchFundDetail(req.params.code),
      syncFundNav(req.params.code),
    ]);
    res.json({ detail: true, navInserted: navCount });
  } catch (err) {
    res.status(500).json({ error: "Fund sync failed" });
  }
});
