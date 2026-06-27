import { bulkUpsertFunds, bulkInsertNav, bulkInsertHoldings, getDb } from "../db/index.js";

const HEADERS: Record<string, string> = {
  "Referer": "http://fund.eastmoney.com/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

// Prefix-based type mapping (order matters - more specific prefixes first)
const TYPE_PREFIXES: Array<[string, string]> = [
  ["\u80a1\u7968\u578b", "stock"],
  ["\u6df7\u5408\u578b", "mixed"],
  ["\u6307\u6570\u578b", "index"],
  ["\u503a\u5238\u578b", "bond"],
  ["QDII", "qdii"],
  ["\u8d27\u5e01\u578b", "money"],
  ["\u7406\u8d22\u578b", "money"],
  ["FOF", "fof"],
  ["\u5546\u54c1", "etf"],
  ["Reits", "etf"],
  ["ETF", "etf"],
];

const RISK_PREFIXES: Array<[string, number]> = [
  ["\u80a1\u7968\u578b", 5],
  ["\u6df7\u5408\u578b-\u504f\u80a1", 4],
  ["\u6df7\u5408\u578b-\u7075\u6d3b", 3],
  ["\u6df7\u5408\u578b-\u504f\u503a", 2],
  ["\u6df7\u5408\u578b-\u7edd\u5bf9", 2],
  ["\u6df7\u5408\u578b-\u5e73\u8861", 3],
  ["\u6df7\u5408\u578b", 3],
  ["\u6307\u6570\u578b-\u80a1\u7968", 4],
  ["\u6307\u6570\u578b-\u6d77\u5916", 4],
  ["\u6307\u6570\u578b-\u56fa\u6536", 2],
  ["\u6307\u6570\u578b", 3],
  ["\u503a\u5238\u578b-\u4e2d\u77ed\u503a", 1],
  ["\u503a\u5238\u578b", 2],
  ["QDII-\u7eaf\u503a", 1],
  ["QDII-\u666e\u901a", 5],
  ["QDII-\u6df7\u5408\u504f\u80a1", 4],
  ["QDII-\u6df7\u5408\u503a", 2],
  ["QDII-\u5546\u54c1", 4],
  ["QDII", 4],
  ["\u8d27\u5e01\u578b", 1],
  ["\u7406\u8d22\u578b", 1],
  ["FOF-\u7a33\u5065", 2],
  ["FOF-\u8fdb\u53d6", 3],
  ["FOF-\u5747\u8861", 2],
  ["FOF", 2],
  ["\u5546\u54c1", 4],
  ["Reits", 3],
];

function mapFundType(rawType: string): string {
  for (const [prefix, mapped] of TYPE_PREFIXES) {
    if (rawType.startsWith(prefix)) return mapped;
  }
  return "mixed";
}

function mapRiskLevel(rawType: string): number {
  for (const [prefix, risk] of RISK_PREFIXES) {
    if (rawType.startsWith(prefix)) return risk;
  }
  return 3;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function parseJsonp(text: string): unknown {
  const s = text.indexOf("(");
  const e = text.lastIndexOf(")");
  if (s === -1 || e === -1) return null;
  return JSON.parse(text.slice(s + 1, e));
}

// 鈹€鈹€ Sync Progress Tracking 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
let syncState = {
  running: false,
  total: 0,
  processed: 0,
  phase: "" as string,
  lastSyncTime: "" as string,
  error: "" as string,
};

export function getSyncProgress() { return { ...syncState }; }

// 鈹€鈹€ Fetch all fund codes from eastmoney 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
export async function fetchAllFundCodes(): Promise<Array<{ code: string; abbr: string; name: string; type: string }>> {
  try {
    const res = await fetch("http://fund.eastmoney.com/js/fundcode_search.js", { headers: HEADERS });
    const text = await res.text();
    const match = text.match(/var\s+r\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) return [];
    const arr = JSON.parse(match[1]) as string[][];
    return arr.map(item => ({ code: item[0], abbr: item[1], name: item[2], type: item[3] }));
  } catch (err) {
    console.error("[scraper] fetchAllFundCodes error:", err);
    return [];
  }
}

// 鈹€鈹€ Fetch NAV history 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
export async function fetchNavHistory(code: string, _pageSize = 20, maxPages = 1): Promise<Array<{ date: string; nav: number; return: number; accNav: number }>> {
  const allResults: Array<{ date: string; nav: number; return: number; accNav: number }> = [];
  const PAGE_SIZE = 20;
  try {
    for (let page = 1; page <= maxPages; page++) {
      const ts = Date.now();
      const url = `https://api.fund.eastmoney.com/f10/lsjz?callback=jQuery&fundCode=${code}&pageIndex=${page}&pageSize=${PAGE_SIZE}&startDate=&endDate=&_=${ts}`;
      const res = await fetch(url, { headers: HEADERS });
      const text = await res.text();
      const json = parseJsonp(text) as { Data?: { LSJZList?: Array<{ FSRQ: string; DWJZ: string; LJJZ: string; JZZZL: string }> } } | null;
      if (!json?.Data?.LSJZList || json.Data.LSJZList.length === 0) break;
      for (const item of json.Data.LSJZList) {
        allResults.push({
          date: item.FSRQ,
          nav: parseFloat(item.DWJZ) || 0,
          return: parseFloat(item.JZZZL) || 0,
          accNav: parseFloat(item.LJJZ) || 0,
        });
      }
      if (json.Data.LSJZList.length < PAGE_SIZE) break;
      if (page < maxPages) await sleep(80);
    }
  } catch { /* partial results are fine */ }
  return allResults;
}

// 鈹€鈹€ Fetch fund detail (manager, fees, size) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
export async function fetchFundDetail(code: string): Promise<{
  manager: string; company: string; size: number;
  fees: { manage: number; custody: number };
  establishDate: string; benchmark: string;
}> {
  try {
    const res = await fetch(`http://fund.eastmoney.com/pingzhongdata/${code}.js`, { headers: HEADERS });
    const text = await res.text();
    let manager = "", company = "", size = 0, manageFee = 0, custodyFee = 0;

    // Extract manager from Data_currentFundManager JSON (bracket counting)
    const mgrIdx = text.indexOf('Data_currentFundManager');
    if (mgrIdx >= 0) {
      const arrStart = text.indexOf('[', mgrIdx);
      if (arrStart >= 0) {
        let depth = 0, arrEnd = arrStart;
        for (let i = arrStart; i < text.length; i++) {
          if (text[i] === '[') depth++;
          if (text[i] === ']') { depth--; if (depth === 0) { arrEnd = i + 1; break; } }
        }
        try {
          const mgrArr = JSON.parse(text.substring(arrStart, arrEnd));
          if (mgrArr.length > 0) {
            manager = mgrArr[0].name || "";
            if (mgrArr[0].fundSize) {
              const szMatch = mgrArr[0].fundSize.match(/([\d.]+)/);
              if (szMatch) size = parseFloat(szMatch[1]) || 0;
            }
          }
        } catch {}
      }
    }
    // Fallback: parse fund_minsg (this is min purchase, not fund size - skip)
    // Try fundSize text directly
    if (!size) {
      const fszMatch = text.match(/fundSize[":\s]*"(\d+[\d.]*\u4ebf)/);
      if (fszMatch) {
        const numMatch = fszMatch[1].match(/(\d+[\d.]*)/);
        if (numMatch) size = parseFloat(numMatch[1]) || 0;
      }
    }

    // Extract fees
    const f = text.match(/fund_Rate\s*=\s*"([^"]*)"/);
    if (f) { const p = f[1].split(","); manageFee = parseFloat(p[0]) || 0; custodyFee = parseFloat(p[1]) || 0; }

    // Fetch company, size, establishment date and benchmark from fund detail page
    let establishDate = "";
    let benchmark = "";
    try {
      const detailRes = await fetch(`https://fundf10.eastmoney.com/jbgk_${code}.html`, { headers: HEADERS });
      const detailText = await detailRes.text();
      // Company name
      const compMatch = detailText.match(/\u57FA\u91D1\u7BA1\u7406\u4EBA[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
      if (compMatch) company = compMatch[1].trim();
      // Fund size (亿元)
      const szMatch = detailText.match(/\u57FA\u91D1\u89C4\u6A21[\s\S]*?([\d.]+)\u4EBF/);
      if (szMatch) size = parseFloat(szMatch[1]) || 0;
      // Manager name
      const mgrMatch = detailText.match(/\u57FA\u91D1\u7ECF\u7406[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
      if (mgrMatch && !manager) manager = mgrMatch[1].trim();
      // Establishment date
      const edMatch = detailText.match(/\u6210\u7ACB\u65E5\u671F[\s\S]*?(\d{4}[-\/]\d{2}[-\/]\d{2})/);
      if (edMatch) establishDate = edMatch[1];
      // Benchmark
      const bmMatch = detailText.match(/<th[^>]*>\s*\u4E1A\u7EE9\u6BD4\u8F83\u57FA\u51C6\s*<\/th>\s*<td[^>]*>\s*([\s\S]*?)\s*<\/td/);
      if (bmMatch) benchmark = bmMatch[1].trim().replace(/<[^>]+>/g, '');
    } catch {}

    return { manager, company, size, fees: { manage: manageFee, custody: custodyFee }, establishDate, benchmark };
  } catch { return { manager: "", company: "", size: 0, fees: { manage: 0, custody: 0 }, establishDate: "", benchmark: "" }; }
}



// ===== Fetch fund stock holdings =====
export async function fetchFundHoldings(code: string): Promise<Array<{ name: string; code: string; weight: number; industry: string }>> {
  const holdings: Array<{ name: string; code: string; weight: number; industry: string }> = [];
  try {
    const res = await fetch(`http://fund.eastmoney.com/f10/FundArchivesDatas.aspx?type=jjcc&code=${code}&topline=10&year=&month=`, { headers: HEADERS });
    const text = await res.text();
    const m = text.match(/content:"([\s\S]+)",arryear/);
    if (!m) return holdings;
    const html = m[1];
    const rows = [...html.matchAll(/<tr><td>(\d+)<\/td><td><a href='[^']*'>(\d{6})<\/a><\/td><td class='tol'><a[^>]*>([^<]+)<\/a><\/td>[\s\S]*?<td class='tor'>([0-9.]+)%<\/td>/g)];
    for (const r of rows) {
      holdings.push({ code: r[2], name: r[3], weight: parseFloat(r[4]) || 0, industry: "" });
    }
  } catch { /* partial results are fine */ }
  return holdings;
}


// ===== News Fetching (WallstreetCN + Eastmoney) =====
export async function fetchEastmoneyNews(): Promise<Array<{ id: string; title: string; summary: string; content: string; time: string; source: string; tag: string; important: boolean; keyPoints: string[]; url: string }>> {
  type NewsItem = { id: string; title: string; summary: string; content: string; time: string; source: string; tag: string; important: boolean; keyPoints: string[]; url: string };
  const items: NewsItem[] = [];
  const seen = new Set<string>();
  let idCounter = 1;

  function add(item: Omit<NewsItem, "id">) {
    const key = item.title.slice(0, 30);
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ id: String(idCounter++), ...item });
  }

  function classify(title: string): { tag: string; important: boolean } {
    if (/鍒╃巼|闄嶅噯|闄嶆伅|LPR|MLF|鍥藉€簗璐у竵|娴佸姩鎬GDP|PMI|CPI/.test(title)) return { tag: "瀹忚", important: true };
    if (/鏀垮簻|鍥藉姟闄鍙戞敼濮攟鐩戠|鏀跨瓥/.test(title)) return { tag: "鏀跨瓥", important: true };
    if (/ETF|LOF|鍏嫙|绉佸嫙|鍩洪噾|鍙戣/.test(title)) return { tag: "鍩洪噾", important: false };
    if (/鏂拌兘婧恷鍏変紡|鐢垫睜|鍖昏嵂|鍗婂浣搢鑺墖|姹借溅|浜哄伐鏅鸿兘|AI/.test(title)) return { tag: "琛屼笟", important: false };
    if (/A鑲涓婅瘉|娣辫瘉|娌繁|鍒涗笟鏉縷娑ㄥ仠|璺屽仠|鍖楀悜璧勯噾/.test(title)) return { tag: "鑲″競", important: false };
    return { tag: "缁煎悎", important: false };
  }

  function formatTime(ts: number): string {
    const d = new Date(ts * 1000);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60000) return "鍒氬垰";
    if (diff < 3600000) return Math.floor(diff / 60000) + "鍒嗛挓鍓?;
    if (diff < 86400000) return Math.floor(diff / 3600000) + "灏忔椂鍓?;
    return d.toLocaleDateString("zh-CN") + " " + d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }

  function formatOriginalTime(ts: number): string {
    const d = new Date(ts * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  // Source 1: WallstreetCN 7x24 flash news
  try {
    let cursor = "";
    for (let page = 0; page < 12; page++) {
      const url = cursor
        ? `https://api-one-wscn.awtmt.com/apiv1/content/lives?channel=global-channel&limit=20&cursor=${cursor}`
        : "https://api-one-wscn.awtmt.com/apiv1/content/lives?channel=global-channel&limit=20";
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) break;
      const json = await resp.json() as any;
      const data = json.data;
      if (!data?.items?.length) break;
      for (const item of data.items) {
        const text = (item.content_text || "").replace(/<[^>]+>/g, "").trim();
        if (text.length < 5) continue;
        const { tag, important } = classify(text);
        add({
          title: text.length > 80 ? text.slice(0, 80) + "..." : text,
          summary: text.length > 200 ? text.slice(0, 200) + "..." : text,
          content: text,
          time: formatTime(item.display_time),
          source: "鍗庡皵琛楄闂?7x24",
          tag, important,
          keyPoints: [text.slice(0, 60)],
          url: item.uri || "",
        });
      }
      cursor = data.next_cursor || "";
      if (!cursor) break;
      await sleep(300);
    }
  } catch (err) {
    console.error("[news] WallstreetCN error:", err);
  }

  // Source 2: Eastmoney finance news (GBK encoded)
  async function fetchGBK(url: string): Promise<string> {
    try {
      const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
      const buf = await resp.arrayBuffer();
      return new TextDecoder("gbk").decode(buf);
    } catch { return ""; }
  }

  try {
    const html = await fetchGBK("https://finance.eastmoney.com/a/cssgs.html");
    const regex = /<a[^>]*href="(https?:\/\/finance\.eastmoney\.com\/a\/[^"]*)"[^>]*>([^<]{8,})<\/a>/g;
    let m;
    while ((m = regex.exec(html)) !== null && items.length < 250) {
      const title = m[2].trim();
      if (title.length < 8) continue;
      const { tag, important } = classify(title);
      add({ title, summary: title, content: title, time: new Date().toLocaleString("zh-CN"), source: "涓滄柟璐㈠瘜", tag, important, keyPoints: [title], url: m[1] });
    }
  } catch {}

  // Source 3: Eastmoney stock news
  try {
    const html = await fetchGBK("https://stock.eastmoney.com/a/cgsxw.html");
    const regex = /<a[^>]*href="(https?:\/\/stock\.eastmoney\.com\/a\/[^"]*)"[^>]*title="([^"]*)"[^>]*>/g;
    let m;
    while ((m = regex.exec(html)) !== null && items.length < 280) {
      const title = m[2].trim();
      if (title.length < 8) continue;
      const { tag, important } = classify(title);
      add({ title, summary: title, content: title, time: new Date().toLocaleString("zh-CN"), source: "涓滄柟璐㈠瘜鑲＄エ", tag, important, keyPoints: [title], url: m[1] });
    }
  } catch {}

  // Source 4: Eastmoney fund news
  try {
    const html = await fetchGBK("https://fund.eastmoney.com/a/czjj.html");
    const regex = /<a[^>]*href="(https?:\/\/fund\.eastmoney\.com\/a\/[^"]*)"[^>]*title="([^"]*)"[^>]*>/g;
    let m;
    while ((m = regex.exec(html)) !== null && items.length < 300) {
      const title = m[2].trim();
      if (title.length < 5) continue;
      const { tag, important } = classify(title);
      add({ title, summary: title, content: title, time: new Date().toLocaleString("zh-CN"), source: "涓滄柟璐㈠瘜鍩洪噾", tag, important, keyPoints: [title], url: m[1] });
    }
  } catch {}

  // Source 5: Sina finance
  try {
    const resp = await fetch("https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2509&k=&num=50&page=1", { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) });
    const json = await resp.json() as any;
    if (json?.result?.data) {
      for (const item of json.result.data) {
        const title = (item.title || "").trim();
        if (title.length < 5) continue;
        const { tag, important } = classify(title);
        const ts = parseInt(item.ctime) || 0;
        add({ title, summary: title, content: title, time: ts > 0 ? formatTime(ts) : new Date().toLocaleString("zh-CN"), source: "鏂版氮璐㈢粡", tag, important, keyPoints: [title], url: item.url || "" });
      }
    }
  } catch {}

  // Source 6: 10jqka (Tonghuashun)
  try {
    const resp = await fetch("https://news.10jqka.com.cn/tapp/news/push/stock/?page=1&tag=&track=website&pagesize=50", { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) });
    const json = await resp.json() as any;
    if (json?.data?.list) {
      for (const item of json.data.list) {
        const title = (item.title || "").trim();
        if (title.length < 5) continue;
        const { tag, important } = classify(title);
        add({ title, summary: title, content: title, time: item.ctime || new Date().toLocaleString("zh-CN"), source: "鍚岃姳椤?, tag, important, keyPoints: [title], url: item.url || "" });
      }
    }
  } catch {}

  console.log(`[news] Fetched ${items.length} items from all sources`);
  return items;
}
export async function syncFundList(): Promise<number> {
  if (syncState.running) { console.log("[scraper] Sync already running"); return 0; }
  syncState = { running: true, total: 0, processed: 0, phase: "????????锟斤拷?", lastSyncTime: "", error: "" };
  try {
    console.log("[scraper] Phase 1: Fetching all fund codes...");
    const allCodes = await fetchAllFundCodes();
    if (allCodes.length === 0) { syncState.running = false; return 0; }
    syncState.total = allCodes.length;
    console.log(`[scraper] Found ${allCodes.length} funds total`);
    syncState.phase = "鍚屾涓?..?";
    const BATCH = 500;
    for (let i = 0; i < allCodes.length; i += BATCH) {
      const batch = allCodes.slice(i, i + BATCH);
      const funds = batch.map(f => ({
        code: f.code, name: f.name, type: mapFundType(f.type),
        nav: 0, accNav: 0, dailyReturn: 0, totalReturn1y: 0, totalReturn3y: 0,
        size: 0, riskLevel: mapRiskLevel(f.type), manager: "", company: f.abbr || "",
        establishDate: "", benchmark: "", manageFee: 0, custodyFee: 0, purchaseFee: 0, redeemFee: 0,
      }));
      bulkUpsertFunds(funds);
      syncState.processed = Math.min(i + BATCH, allCodes.length);
    }
    console.log(`[scraper] Phase 1 done: ${allCodes.length} funds in DB`);
    syncState.phase = "??????????";
    const db = getDb();
    const fundsToDetail = db.prepare("SELECT code FROM funds WHERE nav = 0 OR nav IS NULL").all() as { code: string }[];
    console.log(`[scraper] Phase 2: Fetching details for ${fundsToDetail.length} funds...`);
    syncState.total = allCodes.length + fundsToDetail.length;
    let detailCount = 0;
    for (let i = 0; i < fundsToDetail.length; i += 5) {
      const batch = fundsToDetail.slice(i, i + 5);
      const promises = batch.map(async (f) => {
        try {
          const [navs, detail] = await Promise.all([fetchNavHistory(f.code, 5), fetchFundDetail(f.code)]);
          const latest = navs.length > 0 ? navs[0] : null;
          db.prepare(`UPDATE funds SET nav = ?, acc_nav = ?, daily_return = ?, size = ?, manager = CASE WHEN ? != '' THEN ? ELSE manager END, company = CASE WHEN ? != '' THEN ? ELSE company END, fee_manage = ?, fee_custody = ?, updated_at = datetime('now') WHERE code = ?`)
            .run(latest?.nav || 0, latest?.accNav || 0, latest?.return || 0, detail.size || 0, detail.manager, detail.manager, detail.company, detail.company, detail.fees.manage, detail.fees.custody, f.code);
          if (navs.length > 0) bulkInsertNav(f.code, navs.map(n => ({ date: n.date, nav: n.nav, return: n.return })));
          detailCount++;
        } catch (err) { console.error(`[scraper] Detail error ${f.code}:`, err); }
      });
      await Promise.all(promises);
      syncState.processed = allCodes.length + i + batch.length;
      if ((i + 5) % 50 === 0) console.log(`[scraper] Details: ${i + 5}/${fundsToDetail.length}`);
      await sleep(100);
    }
    console.log("[scraper] Updating 1-year returns...");
    const { updateAllReturns1y } = await import("./update-returns.js");
    await updateAllReturns1y().catch(e => console.error("[scraper] returns1y error:", e));

    syncState.phase = "Phase 3: 锟街茶幏鍙栧熀閲戣鎯?..";
    const fundsNeedingHoldings = db.prepare("SELECT f.code FROM funds f WHERE f.nav > 0 AND f.code NOT IN (SELECT DISTINCT code FROM holdings)").all() as { code: string }[];
    console.log(`[scraper] Phase 3: Fetching holdings for ${fundsNeedingHoldings.length} funds...`);
    syncState.total = allCodes.length + fundsNeedingHoldings.length;
    let holdingsCount = 0;
    for (let i = 0; i < fundsNeedingHoldings.length; i += 5) {
      const batch = fundsNeedingHoldings.slice(i, i + 5);
      const promises = batch.map(async (f) => {
        try {
          const hs = await fetchFundHoldings(f.code);
          if (hs.length > 0) { bulkInsertHoldings(f.code, hs); holdingsCount++; }
        } catch (err) { console.error(`[scraper] Holdings error ${f.code}:`, err); }
      });
      await Promise.all(promises);
      syncState.processed = allCodes.length + i + batch.length;
      if ((i + 5) % 50 === 0) console.log(`[scraper] Holdings: ${i + 5}/${fundsNeedingHoldings.length}`);
      await sleep(150);
    }
    syncState.phase = "锟斤拷锟?;
    syncState.lastSyncTime = new Date().toISOString();
    syncState.running = false;
    console.log(`[scraper] Full sync complete: ${allCodes.length} funds, ${detailCount} details, ${holdingsCount} holdings`);
    return allCodes.length;
  } catch (err) {
    syncState.error = String(err);
    syncState.running = false;
    console.error("[scraper] Full sync error:", err);
    return 0;
  }
}

export async function incrementalUpdate(): Promise<number> {
  if (syncState.running) return 0;
  syncState = { running: true, total: 0, processed: 0, phase: "????????", lastSyncTime: "", error: "" };
  try {
    const db = getDb();
    const funds = db.prepare("SELECT code FROM funds").all() as { code: string }[];
    syncState.total = funds.length;
    console.log(`[scraper] Incremental update: ${funds.length} funds`);
    let updated = 0;
    for (let i = 0; i < funds.length; i += 10) {
      const batch = funds.slice(i, i + 10);
      const promises = batch.map(async (f) => {
        try {
          const navs = await fetchNavHistory(f.code, 5);
          if (navs.length > 0) {
            db.prepare("UPDATE funds SET nav = ?, acc_nav = ?, daily_return = ?, updated_at = datetime('now') WHERE code = ?")
              .run(navs[0].nav, navs[0].accNav, navs[0].return, f.code);
            bulkInsertNav(f.code, navs.map(n => ({ date: n.date, nav: n.nav, return: n.return })));
            updated++;
          }
        } catch { }
      });
      await Promise.all(promises);
      syncState.processed = i + batch.length;
      await sleep(80);
    }
    syncState.phase = "???";
    syncState.lastSyncTime = new Date().toISOString();
    syncState.running = false;
    console.log(`[scraper] Incremental update done: ${updated}/${funds.length} updated`);
    return updated;
  } catch (err) {
    syncState.error = String(err);
    syncState.running = false;
    return 0;
  }
}

export async function syncFundNav(code: string, maxPages = 30): Promise<number> {
  const navs = await fetchNavHistory(code, 20, maxPages);
  if (navs.length === 0) return 0;
  bulkInsertNav(code, navs.map(n => ({ date: n.date, nav: n.nav, return: n.return })));
  const db = getDb();
  db.prepare("UPDATE funds SET nav = ?, acc_nav = ?, daily_return = ?, updated_at = datetime('now') WHERE code = ?")
    .run(navs[0].nav, navs[0].accNav, navs[0].return, code);
  return navs.length;
}

// ===== Batch fix company names (abbreviation -> Chinese name) =====
export async function fixCompanyNames(limit = 500): Promise<number> {
  const db = getDb();
  // Find funds with all-uppercase company names (abbreviations)
  const funds = db.prepare("SELECT code, company FROM funds WHERE company IS NOT NULL AND company != '' AND company GLOB '[A-Z]*' ORDER BY code LIMIT ?").all(limit) as { code: string; company: string }[];
  if (funds.length === 0) return 0;
  console.log(`[scraper] Fixing company names for ${funds.length} funds...`);
  let fixed = 0;
  const stmt = db.prepare("UPDATE funds SET company = ? WHERE code = ?");
  for (let i = 0; i < funds.length; i += 5) {
    const batch = funds.slice(i, i + 5);
    const promises = batch.map(async (f) => {
      try {
        const res = await fetch(`https://fundf10.eastmoney.com/jbgk_${f.code}.html`, { headers: HEADERS });
        const text = await res.text();
        const m = text.match(/\u57FA\u91D1\u7BA1\u7406\u4EBA[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
        if (m && m[1]) {
          stmt.run(m[1].trim(), f.code);
          fixed++;
        }
      } catch {}
    });
    await Promise.all(promises);
    if ((i + 5) % 50 === 0) console.log(`[scraper] Company fix: ${i + 5}/${funds.length}`);
    await sleep(100);
  }
  console.log(`[scraper] Company fix done: ${fixed}/${funds.length}`);
  return fixed;
}

let autoUpdateTimer: ReturnType<typeof setInterval> | null = null;
export function startAutoUpdate(intervalMs = 4 * 60 * 60 * 1000) {
  if (autoUpdateTimer) return;
  console.log(`[scraper] Auto-update started (interval: ${intervalMs / 1000 / 60}min)`);
  autoUpdateTimer = setInterval(async () => {
    if (!syncState.running) {
      console.log("[scraper] Running auto-update...");
      await incrementalUpdate();
    }
  }, intervalMs);
}
export function stopAutoUpdate() {
  if (autoUpdateTimer) { clearInterval(autoUpdateTimer); autoUpdateTimer = null; }
}




