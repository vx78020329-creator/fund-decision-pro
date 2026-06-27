import { getDb } from "../db/index.js";

const HEADERS: Record<string, string> = {
  "Referer": "http://fund.eastmoney.com/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
};

// Fetch all fund 1-year returns from eastmoney ranking API
export async function updateAllReturns1y(): Promise<number> {
  const db = getDb();
  const returns = new Map<string, number>();
  const pageSize = 100;
  const today = new Date().toISOString().slice(0, 10);
  
  console.log("[returns1y] Starting fetch...");
  
  for (let page = 1; page <= 280; page++) {
    try {
      const url = "https://fund.eastmoney.com/data/rankhandler.aspx?op=ph&dt=kf&ft=all&rs=&gs=0&sc=1nzf&st=desc&ed=" + today + "&qdii=&tabSubtype=,,,,,&pi=" + page + "&pn=" + pageSize + "&dx=1&v=0." + page;
      const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30000) });
      const text = await resp.text();
      const dataMatch = text.match(/datas:\[(.*?)\]/s);
      if (!dataMatch || !dataMatch[1]) break;
      const items = dataMatch[1].split('"').filter(s => s.includes(","));
      if (items.length === 0) break;
      for (const item of items) {
        const parts = item.split(",");
        if (parts.length > 11) {
          returns.set(parts[0], parseFloat(parts[11]) || 0);
        }
      }
      if (page % 50 === 0) console.log("[returns1y] Page " + page + ": " + returns.size + " funds");
      await new Promise(r => setTimeout(r, 30));
    } catch { break; }
  }
  
  console.log("[returns1y] Fetched " + returns.size + " fund returns, updating database...");
  
  // Bulk update
  const stmt = db.prepare("UPDATE funds SET total_return_1y = ? WHERE code = ?");
  const tx = db.transaction(() => {
    let updated = 0;
    for (const [code, ret] of returns) {
      const result = stmt.run(ret, code);
      if (result.changes > 0) updated++;
    }
    return updated;
  });
  
  const updated = tx();
  console.log("[returns1y] Updated " + updated + " funds with 1Y returns");
  return updated;
}

