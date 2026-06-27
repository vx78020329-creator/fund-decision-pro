import OpenAI from "openai";
import { getPortfolio, getFundByCode } from "../db/index.js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname_ai = dirname(fileURLToPath(import.meta.url));
const settingsPath = resolve(__dirname_ai, "../../data/settings.json");

function loadSettings(): Record<string, string> {
  if (existsSync(settingsPath)) {
    try { return JSON.parse(readFileSync(settingsPath, "utf-8")); } catch { return {}; }
  }
  return {};
}

function normalizeUrl(url: string): string {
  let u = url.replace(/\/chat\/completions.*$/, "").replace(/\/$/, "");
  if (!u.endsWith("/v1")) u += "/v1";
  return u;
}

function getClient() {
  const s = loadSettings();
  const raw = s.AI_BASE_URL || process.env.AI_BASE_URL || "https://api.mimo.ai/v1";
  return new OpenAI({
    baseURL: normalizeUrl(raw),
    apiKey: s.AI_API_KEY || process.env.AI_API_KEY || "sk-placeholder",
  });
}

function getModel(): string {
  const s = loadSettings();
  return s.AI_MODEL || process.env.AI_MODEL || "mimo-v2.5-pro";
}

function isMockMode(): boolean {
  const s = loadSettings();
  const key = s.AI_API_KEY || process.env.AI_API_KEY || "";
  return !key || key === "sk-placeholder" || key.includes("****");
}

// ========== Token Optimization: Cache + Tiered Routing ==========
const _cache = new Map();
const CACHE_24H = 24 * 60 * 60 * 1000;
function cacheGet(key) { const e = _cache.get(key); if (!e) return null; if (e.exp < Date.now()) { _cache.delete(key); return null; } return e.data; }
function cacheSet(key, data, ttl = CACHE_24H) { _cache.set(key, { data, exp: Date.now() + ttl }); if (_cache.size > 1000) { const first = _cache.keys().next().value; if (first) _cache.delete(first); } }
function getLiteModel() { const s = loadSettings(); return s.AI_LITE_MODEL || "Qwen/Qwen2.5-7B-Instruct"; }
function isSimpleQuestion(msg) { if (msg.length < 25) return true; return /^(什么是|什么叫|怎么|如何|为什么|介绍|解释|区别|对比)/.test(msg.trim()) || /是什么|什么意思|有哪些/.test(msg); }
function msgHash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return Math.abs(h).toString(36); }

export function createSSEmitter(res: any) {
  return (event: string, data: unknown) => {
    const payload = typeof data === "object" && data !== null
      ? { type: event, ...(data as Record<string, unknown>) }
      : { type: event, data };
    res.write("data: " + JSON.stringify(payload) + "\n\n");
  };
}

export interface FundInfo {
  code: string; name: string; type: string; nav: number;
  dailyReturn: number; totalReturn1y: number; totalReturn3y: number;
  size: number; riskLevel: number; manager: string; company: string; benchmark: string;
}

export interface AgentResult {
  agent: string; label: string; icon: string; score: number;
  summary: string; analysis: string; signals: string[];
}

function fundSeed(code: string): number {
  return Math.abs(code.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0));
}

interface AgentDef {
  id: string; label: string; icon: string;
  buildPrompt: (f: FundInfo) => string;
}

﻿const AGENTS: AgentDef[] = [
  {
    id: "macro", label: "宏观研究员", icon: "📊",
    buildPrompt: (f) => `你是资深宏观研究员。分析基金"${f.name}"(${f.code})的宏观环境。
当前数据：类型${f.type}，净值${f.nav}，日涨幅${f.dailyReturn}%，近1年${f.totalReturn1y}%，规模${f.size}亿，风险等级${f.riskLevel}/5。

请分析：1)当前货币政策对该类型基金的影响 2)GDP/CPI/PMI等宏观指标走势 3)市场流动性和资金面 4)地缘政治风险。给出明确的宏观评分和结论。
返回JSON格式：{"score":0-100数字评分,"summary":"一句话宏观结论","analysis":"100-200字详细宏观分析","signals":["宏观信号1","宏观信号2","宏观信号3"]}
只返回纯JSON，不要任何解释文字。`,
  },
  {
    id: "industry", label: "行业研究员", icon: "📈",
    buildPrompt: (f) => `你是行业研究员。分析"${f.name}"(${f.code})所在行业的景气度。
数据：类型${f.type}，近1年${f.totalReturn1y}%，日涨幅${f.dailyReturn}%，规模${f.size}亿。

请分析：1)该基金重仓的行业板块当前景气度 2)行业轮动趋势 3)政策对行业的影响 4)行业估值水平。结合投资方向给出行业评分。
返回JSON：{"score":0-100,"summary":"一句话行业结论","analysis":"100-200字行业分析","signals":["行业信号1","行业信号2","行业信号3"]}
只返回纯JSON。`,
  },
  {
    id: "evaluator", label: "基金评价师", icon: "🔑",
    buildPrompt: (f) => `你是专业基金评价师。深度评价"${f.name}"(${f.code})。
数据：净值${f.nav}，近1年${f.totalReturn1y}%，日涨幅${f.dailyReturn}%，规模${f.size}亿，风险${f.riskLevel}/5，类型${f.type}。

请评价：1)基金经理的投资能力和历史业绩 2)基金的夏普比率、最大回撤等风险指标 3)与同类基金的排名对比 4)基金的费用结构是否合理。给出专业评价分数。
返回JSON：{"score":0-100,"summary":"一句话评价结论","analysis":"100-200字详细评价","signals":["评价信号1","评价信号2","评价信号3"]}
只返回纯JSON。`,
  },
  {
    id: "bull", label: "看多研究员", icon: "🐂",
    buildPrompt: (f) => `你是看多研究员。为"${f.name}"(${f.code})做正面论证。
数据：净值${f.nav}，近1年涨幅${f.totalReturn1y}%，今日${f.dailyReturn}%，规模${f.size}亿，类型${f.type}。

请从以下角度做看多论证：1)基金的投资策略优势 2)重仓股的基本面改善 3)行业政策利好 4)资金流入趋势 5)估值修复空间。必须给出具体的看多理由和目标预期。
返回JSON：{"score":0-100(越高越看好),"summary":"一句话看多结论","analysis":"100-200字看多论证","signals":["看多理由1","看多理由2","看多理由3"]}
只返回纯JSON。`,
  },
  {
    id: "bear", label: "看空研究员", icon: "🐻",
    buildPrompt: (f) => `你是看空研究员。为"${f.name}"(${f.code})做反面论证。
数据：净值${f.nav}，近1年涨幅${f.totalReturn1y}%，今日${f.dailyReturn}%，规模${f.size}亿，类型${f.type}，风险${f.riskLevel}/5。

请从以下角度做看空论证：1)短期涨幅过大风险 2)估值泡沫风险 3)市场风格切换风险 4)宏观政策收紧风险 5)流动性风险。必须给出具体的看空理由和风险提示。
返回JSON：{"score":0-100(越高越危险),"summary":"一句话看空结论","analysis":"100-200字看空论证","signals":["风险1","风险2","风险3"]}
只返回纯JSON。`,
  },
  {
    id: "risk", label: "风控官", icon: "⚖️",
    buildPrompt: (f) => `你是风控官。评估"${f.name}"(${f.code})的风险。
数据：净值${f.nav}，近1年${f.totalReturn1y}%，今日${f.dailyReturn}%，规模${f.size}亿，风险等级${f.riskLevel}/5，类型${f.type}。

请评估：1)最大回撤风险 2)波动率水平 3)流动性风险 4)集中度风险 5)风格漂移风险。给出风控建议：合理仓位比例、止损位、定投策略。分数越高风险越低。
返回JSON：{"score":0-100(越高越安全),"summary":"一句话风控结论","analysis":"100-200字风险评估","signals":["风控建议1","风控建议2","风控建议3"]}
只返回纯JSON。`,
  },
  {
    id: "decision", label: "决策官", icon: "🎯",
    buildPrompt: (f) => `你是决策官。综合评估"${f.name}"(${f.code})并给出最终投资建议。
数据：净值${f.nav}，近1年${f.totalReturn1y}%，今日${f.dailyReturn}%，规模${f.size}亿，类型${f.type}，风险${f.riskLevel}/5。

请综合以下维度给出决策：1)基本面评分 2)技术面评分 3)资金面评分 4)风险收益比评分。给出明确的操作建议（买入/持有/卖出）和仓位建议。
返回JSON：{"score":0-100,"summary":"一句话综合结论","analysis":"100-200字详细综合分析","signals":["建议1","建议2","建议3","建议4"]}
只返回纯JSON。`,
  },
];
;

function extractFundFromPrompt(prompt: string): { name: string; code: string; nav: number; ret1y: number } {
  const nm = prompt.match(/"([^"]+)"/);
  const cm = prompt.match(/\((\d+)\)/);
  const navM = prompt.match(/\u51c0\u503c[:\uff1a]?\s*([\d.]+)/i);
  const retM = prompt.match(/\u8fd11\u5e74[:\uff1a]?\s*([\d.-]+)/i);
  return {
    name: nm?.[1] || "\u8be5\u57fa\u91d1",
    code: cm?.[1] || "000000",
    nav: parseFloat(navM?.[1] || "1.0"),
    ret1y: parseFloat(retM?.[1] || "0"),
  };
}

async function callAgent(prompt: string): Promise<Record<string, unknown>> {
  if (isMockMode()) {
    const fi = extractFundFromPrompt(prompt);
    const s = fundSeed(fi.code);
    const scores = [65, 72, 58, 80, 45, 68];
    const idx = s % 6;
    return { score: scores[idx], summary: "\u57fa\u4e8e" + fi.name + "\u7684\u5206\u6790", analysis: "\u5f53\u524d\u51c0\u503c" + fi.nav + "\uff0c\u8fd11\u5e74" + fi.ret1y + "%", signals: ["\u4fe1\u53f71", "\u4fe1\u53f72", "\u4fe1\u53f73", "\u4fe1\u53f74"] };
  }
  try {
    const client = getClient();
    const now = new Date();
    const dateStr = now.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
    const timeStr = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
    const resp = await client.chat.completions.create({
      model: getModel(),
      messages: [
        { role: "system", content: "\u4f60\u662f\u57fa\u91d1\u5206\u6790\u5f15\u64ce\u3002\u5f53\u524d\u65f6\u95f4:" + dateStr + " " + timeStr + "\u3002\u4f7f\u7528\u5b9e\u65f6\u6570\u636e\u5206\u6790\u3002\u4f60\u5fc5\u987b\u4ee5\u7eafJSON\u683c\u5f0f\u8fd4\u56de\u7ed3\u679c\uff0c\u4e0d\u8981\u4efb\u4f55\u89e3\u91ca\u6587\u5b57\u3002\u683c\u5f0f: {\"score\": 0-100\u7684\u6570\u5b57, \"summary\": \"\u4e00\u53e5\u8bdd\u6982\u62ec\", \"analysis\": \"100-200\u5b57\u8be6\u7ec6\u5206\u6790\", \"signals\": [\"\u4fe1\u53f71\", \"\u4fe1\u53f72\", \"\u4fe1\u53f73\"]}" },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });
    var content = resp.choices[0]?.message?.content || "";
    // Prefer content over reasoning_content
    if (!content) {
      var rc = resp.choices[0]?.message?.reasoning_content || '';
      // Try to find JSON in reasoning (take the LAST valid JSON block)
      var jsonBlocks = [...rc.matchAll(/\{[^{}]*"score"[^{}]*\}/g)];
      if (jsonBlocks.length > 0) content = jsonBlocks[jsonBlocks.length - 1][0];
      else {
        // Extract clean text after thinking markers
        var afterThink = rc.split(/\n(?=[^\s{])/).pop() || '';
        if (afterThink.length > 20) content = afterThink.slice(0, 400);
        else content = rc.slice(-300);
      }
    }
    if (!content) content = "{}";
    } finally { clearTimeout(controller); }
    console.log("[callAgent-raw]", content.slice(0, 300));

    // Try multiple parsing strategies
    // Strategy 1: direct JSON parse
    try {
      var p = JSON.parse(content);
      return { score: Number(p.score) || 50, summary: String(p.summary || "\u5206\u6790\u5b8c\u6210"), analysis: String(p.analysis || ""), signals: Array.isArray(p.signals) ? p.signals.map(String) : [] };
    } catch(e1) {}

    // Strategy 2: strip markdown fences
    try {
      var cleaned = content.replace(/```json\s*/g, "").replace(/```/g, "").trim();
      var p2 = JSON.parse(cleaned);
      return { score: Number(p2.score) || 50, summary: String(p2.summary || "\u5206\u6790\u5b8c\u6210"), analysis: String(p2.analysis || ""), signals: Array.isArray(p2.signals) ? p2.signals.map(String) : [] };
    } catch(e2) {}

    // Strategy 3: extract JSON object from text
    try {
      var jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        var p3 = JSON.parse(jsonMatch[0]);
        return { score: Number(p3.score) || 50, summary: String(p3.summary || "\u5206\u6790\u5b8c\u6210"), analysis: String(p3.analysis || ""), signals: Array.isArray(p3.signals) ? p3.signals.map(String) : [] };
      }
    } catch(e3) {}

    // Strategy 4: extract score and clean up text
    var scoreMatch = content.match(/score[\s:]*?(\d+)/i) || content.match(/(\d+)\s*[/\u5206]/);
    var score = scoreMatch ? Number(scoreMatch[1]) : 50;
    // Remove prompt-like text, keep only actual analysis
    var cleanText = content
      .replace(/\{[^{}]*"score"[^{}]*\}/g, '')
      .replace(/JSON[^:]*:/g, '')
      .replace(/返回JSON[^}]*}/g, '')
      .replace(/格式[：:].*/g, '')
      .replace(/\d+-\d+的数字/g, '')
      .replace(/一句话概括/g, '')
      .replace(/100-200字详细分析/g, '')
      .replace(/[\n\r]+/g, ' ')
      .trim();
    if (cleanText.length < 10) cleanText = '分析完成';
    return {
      score: score,
      summary: cleanText.slice(0, 80),
      analysis: cleanText.slice(0, 300),
      signals: []
    };
  } catch(err) {
    console.error("[callAgent error]", err.message);
    return { score: 50, summary: "\u5206\u6790\u5f15\u64ce\u4e34\u65f6\u4e0d\u53ef\u7528", analysis: err.message, signals: [] };
  }
}

const DIAGNOSIS_CACHE_TTL = 10 * 60 * 1000;
export async function runDiagnosis(fund: FundInfo, emit: (event: string, data: unknown) => void) {
  const _ck = 'diagnosis:' + fund.code;
  const _cached = cacheGet(_ck);
  if (_cached) { emit('diagnosis_complete', _cached); return _cached; }
  const _progress = (i: number, st: string, res?: any) => emit("agent_progress", { current: i + 1, total: AGENTS.length, agent: AGENTS[i].label, icon: AGENTS[i].icon, status: st, result: res || { score: 0, summary: "分析中...", analysis: "", signals: [] } });
  AGENTS.forEach((_, i) => _progress(i, "running", null));
  const agentData = await Promise.all(AGENTS.map(a => callAgent(a.buildPrompt(fund))));
  const results: AgentResult[] = AGENTS.map((agent, i) => ({
    agent: agent.id, label: agent.label, icon: agent.icon,
    score: Number(agentData[i].score) || 50,
    summary: String(agentData[i].summary || "\u5206\u6790\u4e2d"),
    analysis: String(agentData[i].analysis || ""),
    signals: Array.isArray(agentData[i].signals) ? agentData[i].signals.map(String) : [],
  }));
  results.forEach((r, i) => _progress(i, "done"));
  const avgScore = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
  let verdict: "buy" | "sell" | "hold" = "hold";
  if (avgScore >= 70) verdict = "buy";
  else if (avgScore <= 40) verdict = "sell";
  const verdictText = avgScore >= 70 ? "\u7efc\u5408\u8bc4\u5206" + avgScore + "\u5206\uff0c\u5efa\u8bae\u5173\u6ce8" : avgScore <= 40 ? "\u7efc\u5408\u8bc4\u5206" + avgScore + "\u5206\uff0c\u5efa\u8bae\u8c28\u614e" : "\u7efc\u5408\u8bc4\u5206" + avgScore + "\u5206\uff0c\u5efa\u8bae\u89c2\u671b";
  const _result = { results, avgScore, verdict, verdictText };
  cacheSet(_ck, _result, DIAGNOSIS_CACHE_TTL);
  emit("diagnosis_complete", _result);
  return _result;
}

export async function runDebate(fund: FundInfo, emit: (event: string, data: unknown) => void) {
  const _ck = "debate:" + fund.code;
  const _cached = cacheGet(_ck);
  if (_cached) { emit("debate_complete", _cached); return _cached; }
  const bullDef = AGENTS.find(a => a.id === "bull")!;
  const bearDef = AGENTS.find(a => a.id === "bear")!;
  const riskDef = AGENTS.find(a => a.id === "risk")!;

  const [bullR, bearR, riskR] = await Promise.all([
    callAgent(bullDef.buildPrompt(fund)),
    callAgent(bearDef.buildPrompt(fund)),
    callAgent(riskDef.buildPrompt(fund))
  ]);
  const rounds: any[] = [
    { round: 1, stage: "\u6b63\u65b9", speaker: "\u770b\u591a\u7814\u7a76\u5458",
      content: (bullR.summary || "\u5206\u6790\u4e2d") + "\u3002" + (bullR.analysis || "") + "\u3002\u4fe1\u53f7:" + (bullR.signals || []).join("\u3001"), score: Number(bullR.score) || 60 },
    { round: 2, stage: "\u53cd\u65b9", speaker: "\u770b\u7a7a\u7814\u7a76\u5458",
      content: (bearR.summary || "\u5206\u6790\u4e2d") + "\u3002" + (bearR.analysis || "") + "\u3002\u98ce\u9669:" + (bearR.signals || []).join("\u3001"), score: Number(bearR.score) || 50 },
    { round: 3, stage: "\u98ce\u63a7", speaker: "\u98ce\u63a7\u5b98",
      content: "\u98ce\u9669\u8bc4\u4f30:" + (riskR.summary || "\u5206\u6790\u4e2d") + "\u3002" + (riskR.analysis || "") + "\u3002\u91cd\u70b9:" + (riskR.signals || []).join("\u3001"), score: Number(riskR.score) || 55 }
  ];

  const bs = Number(bullR.score) || 60, brs = Number(bearR.score) || 50, rs = Number(riskR.score) || 55;
  const avg = Math.round((bs + (100 - brs) + rs) / 3);
  let fv: "buy" | "sell" | "hold" = "hold", fvt = "";
  if (avg >= 70) { fv = "buy"; fvt = "\u88c1\u51b3:\u4e70\u5165\u504f\u591a(\u770b\u591a" + bs + "\u770b\u7a7a" + brs + "\u98ce\u63a7" + rs + ")\u3002\u5efa\u8bae\u5206\u6279\u5efa\u4ed3\u3002"; }
  else if (avg <= 40) { fv = "sell"; fvt = "\u88c1\u51b3:\u5356\u51fa\u504f\u7a7a(\u770b\u591a" + bs + "\u770b\u7a7a" + brs + "\u98ce\u63a7" + rs + ")\u3002\u5efa\u8bae\u9010\u6b65\u51cf\u4ed3\u3002"; }
  else { fv = "hold"; fvt = "\u88c1\u51b3:\u6301\u6709\u89c2\u671b(\u770b\u591a" + bs + "\u770b\u7a7a" + brs + "\u98ce\u63a7" + rs + ")\u3002\u5efa\u8bae\u7ef4\u6301\u4ed3\u4f4d\u3002"; }
  rounds.push({ round: 4, stage: "\u88c1\u51b3", speaker: "\u51b3\u7b56\u5b98", content: fvt, score: avg });
  return { rounds, finalVerdict: fv, verdictText: fvt };
}

export async function runVerification(fund: FundInfo, userView: string, emit: (event: string, data: unknown) => void) {
  if (isMockMode()) {
    const seed = fundSeed(fund.code);
    const c = [["\u5b8f\u89c2\u4e0b\u884c","\u884c\u4e1a\u98ce\u9669","\u8ffd\u9ad8"],["\u6d41\u52a8\u6027","\u7ade\u54c1\u4f18","\u4f30\u503c\u9ad8"],["\u7ecf\u7406\u5dee","\u89c4\u6a21\u5c0f","\u5386\u53f2\u4e0d\u4ee3\u8868"]];
    const sp = [["\u57fa\u672c\u9762\u7a33","\u4f30\u503c\u5408\u7406"],["\u524d\u666f\u597d","\u56e2\u961f\u7a33"],["\u653f\u7b56\u652f\u6301","\u8d44\u91d1\u5165"]];
    const r = { counterArguments: c[seed%3], supportingArguments: sp[seed%3],
      riskWarning: fund.name + "\u6ce8\u610f" + (fund.riskLevel>3?"\u9ad8\u6ce2":"\u6e29\u548c") + "\u5efa\u8bae\u5206\u6279",
      suggestion: "\u514810%\u5e95\u4ed3\u89c2\u5bdf" + fund.name + "\u540e\u52a0" };
    emit("verify_complete", { type: "verify_complete", result: r });
    return r;
  }
  const p = "\u7528\u6237:" + userView + "\u57fa\u91d1\u201c" + fund.name + "\u201d(" + fund.code + ")\u51c0\u503c" + fund.nav + "\u8fd11\u5e74" + fund.totalReturn1y + "%\u3002\u53cd\u8bba\u3002\u8fd4\u56deJSON:{\"counterArguments\":[],\"supportingArguments\":[],\"riskWarning\":\"\",\"suggestion\":\"\"}";
  const ai = await callAgent(p);
  const result = {
    counterArguments: Array.isArray(ai.counterArguments) ? ai.counterArguments.map(String) : ["\u9700\u66f4\u591a"],
    supportingArguments: Array.isArray(ai.supportingArguments) ? ai.supportingArguments.map(String) : ["\u65b9\u5411\u6b63\u786e"],
    riskWarning: String(ai.riskWarning || "\u6709\u98ce\u9669"),
    suggestion: String(ai.suggestion || "\u5206\u6279"),
  };
  emit("verify_complete", { type: "verify_complete", result });
  return result;
}

export async function runChat(message: string, context?: string): Promise<string> {
  const _ck = "chat:" + msgHash(message + (context || ""));
  const _cached = cacheGet(_ck);
  if (_cached) return _cached;
  if (isMockMode()) {
    if (message.includes("\u63a8\u8350") || message.includes("\u9009")) return "\u63a8\u8350\uff1a1.\u6613\u65b9\u8fbe\u84dd\u7b79(005827) 2.\u5bcc\u56fd\u5929\u60e0(161005) 3.\u4e2d\u6b27\u533b\u7597(003095)";
    if (message.includes("\u5e02\u573a") || message.includes("\u6da8")) return "A\u80a1\uff1a\u9707\u8361\u504f\u5f3a\u3002";
    return "\u62b1\u6b49\uff0cAI\u670d\u52a1\u6682\u65f6\u4e0d\u53ef\u7528\u3002\u8bf7\u5728\u8bbe\u7f6e\u9875\u9762\u914d\u7f6eAPI\u5bc6\u94a5\u540e\u91cd\u8bd5\u3002\n\n\u60a8\u53ef\u4ee5\u95ee\u6211\u5173\u4e8e\uff1a\n\u2022 \u57fa\u91d1\u5206\u6790\u4e0e\u8bc4\u4ef7\n\u2022 \u5e02\u573a\u884c\u60c5\u89e3\u8bfb\n\u2022 \u6295\u8d44\u7b56\u7565\u5efa\u8bae\n\u2022 \u8d44\u4ea7\u914d\u7f6e\u65b9\u6848\n\u2022 \u98ce\u9669\u7ba1\u7406\u65b9\u6cd5";
  }
  try {
    const client = getClient();
    const now = new Date();
    const dateStr = now.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
    const timeStr = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    const hour = now.getHours();
    const day = now.getDay();
    const isMarketOpen = hour >= 9 && hour < 15 && day > 0 && day < 6;

    let portfolioCtx = "";
    try {
      const items = getPortfolio();
      if (items.length > 0) {
        const portLines = items.map(i => {
          const fund = getFundByCode(i.fundCode);
          const nav = fund?.nav || 0;
          const dailyRet = fund?.dailyReturn || 0;
          const ret1y = fund?.totalReturn1y || 0;
          return "  - " + i.fundName + "(" + i.fundCode + "): \u6301\u4ed3" + i.shares + "\u4efd, \u6210\u672c" + i.avgCost + ", \u5f53\u524d\u51c0\u503c" + nav + ", \u65e5\u6da8\u8dcc" + dailyRet + "%, \u8fd11\u5e74" + ret1y + "%";
        });
        const totalValue = items.reduce((s, i) => {
          const fund = getFundByCode(i.fundCode);
          return s + i.shares * (fund?.nav || 0);
        }, 0);
        portfolioCtx = "\n[\u7528\u6237\u6301\u4ed3\u6570\u636e - " + dateStr + "]\n\u6301\u4ed3\u6570\u91cf: " + items.length + "\u53ea\n\u603b\u8d44\u4ea7: " + totalValue.toFixed(2) + "\u5143\n" + portLines.join("\n");
      }
    } catch { /* portfolio not available */ }

    const systemPrompt = "\u57fa\u91d1\u6295\u8d44\u987e\u95ee\u3002" + dateStr + " " + timeStr + ",\u5e02\u573a:" + (isMarketOpen ? "\u4ea4\u6613\u4e2d" : "\u4f11\u5e02") + portfolioCtx + "\n\u89c4\u5219:\u5148\u7ed3\u8bba\u518d\u5206\u6790,\u4e2d\u6587\u4e13\u4e1a\u901a\u4fd7,\u6570\u636e\u51c6\u786e,\u6295\u8d44\u6709\u98ce\u9669\u4ec5\u4f9b\u53c2\u8003";

    const msgs = [{ role: "system", content: systemPrompt }];
    if (context) msgs.push({ role: "user", content: context });
    msgs.push({ role: "user", content: message });
    const resp = await client.chat.completions.create({ model: getModel(), messages: msgs, temperature: 0.5, max_tokens: 800 });
    console.log("[chat-debug] response:", JSON.stringify(resp).slice(0, 500));
    const rcontent = resp.choices[0]?.message?.content;
    if (rcontent) cacheSet(_ck, rcontent, 60 * 60 * 1000);
    return rcontent || "AI\u8fd4\u56de\u5185\u5bb9\u4e3a\u7a7a: " + JSON.stringify(resp).slice(0, 200);
  } catch(err) { console.error("[chat error]", err.message); return "AI\u670d\u52a1\u6682\u4e0d\u53ef\u7528: " + err.message; }
}

export async function runChatStream(
  message: string,
  context: string | undefined,
  onData: (chunk: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): Promise<void> {
  if (isMockMode()) {
    onData(getMockChat(message));
    onDone();
    return;
  }
  try {
    const client = getClient();
    const now = new Date();
    const dateStr = now.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
    const timeStr = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    const isMarketOpen = now.getHours() >= 9 && now.getHours() < 15 && now.getDay() > 0 && now.getDay() < 6;

    let portfolioCtx = "";
    try {
      const items = getPortfolio();
      if (items.length > 0) {
        portfolioCtx = "\n[用户持仓] " + items.length + "只";
      }
    } catch {}

    const systemPrompt = "你是顶级基金投资顾问。" + dateStr + " " + timeStr + ", 市场: " + (isMarketOpen ? "交易中" : "已休市") + "." + portfolioCtx + " 规则: 先结论再分析, 中文, 投资有风险。";

    const msgs = [{ role: "system", content: systemPrompt }];
    if (context) msgs.push({ role: "user", content: context });
    msgs.push({ role: "user", content: message });

    const stream = await client.chat.completions.create({
      model: getModel(),
      messages: msgs,
      temperature: 0.5,
      max_tokens: 1024,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) onData(delta);
    }
    onDone();
  } catch (err) {
    onError(err.message || "AI service unavailable");
  }
}