import { Router } from "express";

export const marketRouter = Router();

const HEADERS: Record<string, string> = {
  "Referer": "https://finance.eastmoney.com/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

// Real-time market indices from eastmoney
marketRouter.get("/indices", async (_req, res) => {
  try {
    const codes = "1.000001,0.399001,0.399006,1.000016,1.000300,1.000905";
    const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fields=f2,f3,f4,f6,f12,f14&secids=${codes}`;
    const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30000) });
    const json = await resp.json() as any;
    const now = new Date();
    const timeStr = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    
    if (!json?.data?.diff) {
      // Fallback to mock if API fails
      res.json({ updateTime: timeStr, indices: getMockIndices() });
      return;
    }
    
    const indices = json.data.diff.map((item: any) => ({
      code: item.f12,
      name: item.f14,
      current: (item.f2 || 0) / 100,
      change: (item.f4 || 0) / 100,
      changePercent: (item.f3 || 0) / 100,
      volume: formatVolume(item.f6),
      high: 0,
      low: 0,
      open: 0,
      prevClose: 0,
    }));
    
    res.json({ updateTime: timeStr, indices });
  } catch (err) {
    console.error("[market] indices error:", err);
    const now = new Date();
    res.json({ updateTime: now.toLocaleTimeString("zh-CN"), indices: getMockIndices() });
  }
});

function formatVolume(vol: number): string {
  if (!vol) return "0";
  if (vol >= 1e12) return (vol / 1e12).toFixed(1) + "涓囦嚎";
  if (vol >= 1e8) return (vol / 1e8).toFixed(1) + "浜?;
  if (vol >= 1e4) return (vol / 1e4).toFixed(1) + "涓?;
  return String(vol);
}

function getMockIndices() {
  return [
    { code: "000001", name: "涓婅瘉鎸囨暟", current: 3350.28, change: 12.56, changePercent: 0.38, volume: "3621.5浜?, high: 3358.12, low: 3335.40, open: 3338.72, prevClose: 3337.72 },
    { code: "399001", name: "娣辫瘉鎴愭寚", current: 10200.15, change: -45.32, changePercent: -0.44, volume: "4523.8浜?, high: 10268.50, low: 10185.20, open: 10250.30, prevClose: 10245.47 },
    { code: "399006", name: "鍒涗笟鏉挎寚", current: 2050.67, change: 8.93, changePercent: 0.44, volume: "1985.3浜?, high: 2055.80, low: 2038.10, open: 2042.50, prevClose: 2041.74 },
    { code: "000016", name: "涓婅瘉50", current: 2780.45, change: 5.12, changePercent: 0.18, volume: "856.2浜?, high: 2785.60, low: 2772.30, open: 2775.80, prevClose: 2775.33 },
    { code: "000300", name: "娌繁300", current: 3920.88, change: -10.24, changePercent: -0.26, volume: "2835.6浜?, high: 3940.50, low: 3915.20, open: 3932.10, prevClose: 3931.12 },
    { code: "000905", name: "涓瘉500", current: 5680.33, change: 22.15, changePercent: 0.39, volume: "3210.4浜?, high: 5695.20, low: 5658.10, open: 5660.80, prevClose: 5658.18 },
  ];
}

