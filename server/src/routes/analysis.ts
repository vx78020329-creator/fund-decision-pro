import { Router } from "express";
import { getDb } from "../db/index.js";
import { fetchNavHistory } from "../services/scraper.js";

export const analysisRouter = Router();

// Get detailed analysis for a single fund
analysisRouter.post("/fund", async (req, res) => {
  const { fundCode, fundName, shares, avgCost, amount } = req.body;
  
  try {
    const db = getDb();
    
    // Get fund basic info
    const fund = db.prepare("SELECT * FROM funds WHERE code = ?").get(fundCode) as Record<string, unknown> | undefined;
    if (!fund || fund.nav === 0) {
      // Fund not in DB or no NAV data - return basic analysis from request params
      res.json({
        fundCode,
        fundName: fundName || fund?.name || 'Unknown',
        type: fund?.type || 'mixed',
        manager: fund?.manager || '',
        company: fund?.company || '',
        riskLevel: fund?.risk_level || 3,
        currentNav: fund?.nav || 0,
        dailyReturn: 0,
        return7d: null,
        return30d: null,
        volatility: '0',
        maxDrawdown: '0',
        size: fund?.size || 0,
        shares,
        avgCost,
        amount,
        marketContext: '\u8be5\u57fa\u91d1\u6570\u636e\u6682\u65e0\u6cd5\u81ea\u52a8\u83b7\u53d6\uff0c\u8bf7\u624b\u52a8\u66f4\u65b0',
        recentPerformance: []
      });
      return;
    }
    
    // Get recent NAV history (30 days)
    const navHistory = db.prepare(
      "SELECT * FROM nav_history WHERE code = ? ORDER BY date DESC LIMIT 30"
    ).all(fundCode) as Array<{ date: string; nav: number; return_pct: number }>;
    
    // If no history, try to fetch from eastmoney
    if (navHistory.length === 0) {
      try {
        const fetched = await fetchNavHistory(fundCode, 30);
        if (fetched.length > 0) {
          navHistory.push(...fetched.map(n => ({ 
            date: n.date, 
            nav: n.nav, 
            return_pct: n.return || 0 
          })));
        }
      } catch (e) {
        console.log("[analysis] Failed to fetch nav history for", fundCode);
      }
    }
    
    // Calculate key metrics
    const currentNav = navHistory.length > 0 ? navHistory[0].nav : ((fund.nav as number) || 0);
    const dailyReturn = navHistory.length > 0 ? navHistory[0].return_pct : ((fund.daily_return as number) || 0);
    
    // Calculate period returns
    const getReturn = (days: number) => {
      if (navHistory.length < days) return null;
      const oldNav = navHistory[Math.min(days - 1, navHistory.length - 1)].nav;
      if (oldNav === 0) return null;
      return ((currentNav - oldNav) / oldNav * 100);
    };
    
    const return7d = getReturn(7);
    const return30d = getReturn(30);
    
    // Calculate volatility (standard deviation of returns)
    const returns = navHistory.slice(0, 20).map(n => n.return_pct).filter(r => r !== 0);
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const volatility = returns.length > 0 
      ? Math.sqrt(returns.reduce((a, r) => a + Math.pow(r - avgReturn, 2), 0) / returns.length)
      : 0;
    
    // Calculate max drawdown
    let peak = currentNav;
    let maxDrawdown = 0;
    for (const nav of navHistory) {
      if (nav.nav > peak) peak = nav.nav;
      if (peak > 0) {
        const dd = (peak - nav.nav) / peak;
        if (dd > maxDrawdown) maxDrawdown = dd;
      }
    }
    
    // Get market context based on fund type
    const marketContext = getMarketContext(fund.type as string);
    
    // Prepare analysis data
    const analysisData = {
      fundCode,
      fundName: fund.name,
      type: fund.type,
      manager: fund.manager || '',
      company: fund.company || '',
      riskLevel: fund.risk_level || 3,
      currentNav,
      dailyReturn,
      return7d,
      return30d,
      volatility: volatility.toFixed(2),
      maxDrawdown: (maxDrawdown * 100).toFixed(2),
      size: fund.size || 0,
      shares,
      avgCost,
      amount,
      marketContext,
      recentPerformance: navHistory.slice(0, 5).map(n => ({
        date: n.date,
        nav: n.nav,
        return: n.return_pct
      }))
    };
    
    res.json(analysisData);
  } catch (err) {
    console.error("[analysis] Error:", err);
    res.status(500).json({ error: "Analysis failed", details: String(err) });
  }
});

// Get summary analysis for all holdings
analysisRouter.post("/summary", async (req, res) => {
  const { holdings } = req.body;
  
  try {
    const db = getDb();
    const results = [];
    
    for (const holding of holdings) {
      const fund = db.prepare("SELECT * FROM funds WHERE code = ?").get(holding.code) as Record<string, unknown> | undefined;
      if (!fund) continue;
      
      const navHistory = db.prepare(
        "SELECT * FROM nav_history WHERE code = ? ORDER BY date DESC LIMIT 30"
      ).all(holding.code) as Array<{ date: string; nav: number; return_pct: number }>;
      
      const currentNav = navHistory.length > 0 ? navHistory[0].nav : ((fund.nav as number) || 0);
      const dailyReturn = navHistory.length > 0 ? navHistory[0].return_pct : 0;
      
      // Calculate profit
      const marketValue = (holding.shares || 0) * currentNav;
      const profit = marketValue - (holding.amount || 0);
      const profitRate = holding.amount > 0 ? (profit / holding.amount * 100) : 0;
      
      results.push({
        code: holding.code,
        name: fund.name,
        type: fund.type,
        dailyReturn,
        currentNav,
        shares: holding.shares || 0,
        amount: holding.amount || 0,
        marketValue,
        profit,
        profitRate,
        weight: 0
      });
    }
    
    // Calculate total and weights
    const totalMarketValue = results.reduce((sum, r) => sum + r.marketValue, 0);
    const totalAmount = results.reduce((sum, r) => sum + r.amount, 0);
    const totalProfit = totalMarketValue - totalAmount;
    const totalProfitRate = totalAmount > 0 ? (totalProfit / totalAmount * 100) : 0;
    
    results.forEach(r => {
      r.weight = totalMarketValue > 0 ? (r.marketValue / totalMarketValue * 100) : 0;
    });
    
    // Group by type
    const typeAllocation: Record<string, number> = {};
    results.forEach(r => {
      if (!typeAllocation[r.type]) typeAllocation[r.type] = 0;
      typeAllocation[r.type] += r.weight;
    });
    
    res.json({
      holdings: results,
      summary: {
        totalMarketValue,
        totalAmount,
        totalProfit,
        totalProfitRate,
        holdingCount: results.length,
        typeAllocation
      }
    });
  } catch (err) {
    console.error("[analysis] Summary error:", err);
    res.status(500).json({ error: "Summary analysis failed" });
  }
});

function getMarketContext(fundType: string): string {
  const contexts: Record<string, string> = {
    stock: '\u80a1\u7968\u578b\u57fa\u91d1\u53d7\u80a1\u5e02\u5f71\u54cd\u8f83\u5927\uff0c\u9700\u5173\u6ce8\u5927\u76d8\u8d70\u52bf\u3001\u884c\u4e1a\u677f\u5757\u8f6e\u52a8\u548c\u653f\u7b56\u9762\u53d8\u5316',
    mixed: '\u6df7\u5408\u578b\u57fa\u91d1\u517c\u987e\u80a1\u7968\u548c\u503a\u5238\uff0c\u9700\u5173\u6ce8\u8d44\u4ea7\u914d\u7f6e\u7b56\u7565\u548c\u5e02\u573a\u73af\u5883\u53d8\u5316',
    index: '\u6307\u6570\u578b\u57fa\u91d1\u8ddf\u8e2a\u5e02\u573a\u6307\u6570\uff0c\u9700\u5173\u6ce8\u6307\u6570\u6210\u4efd\u8c03\u6574\u548c\u5e02\u573a\u6574\u4f53\u8d70\u52bf',
    etf: 'ETF\u57fa\u91d1\u5177\u6709\u9ad8\u6d41\u52a8\u6027\u548c\u4f4e\u8d39\u7528\u7279\u70b9\uff0c\u9700\u5173\u6ce8\u6ea2\u4ef7\u7387\u548c\u8ddf\u8e2a\u8bef\u5dee',
    bond: '\u503a\u5238\u578b\u57fa\u91d1\u53d7\u5229\u7387\u548c\u4fe1\u7528\u73af\u5883\u5f71\u54cd\uff0c\u9700\u5173\u6ce8\u5927\u5b8f\u8d27\u5e01\u653f\u7b56\u548c\u5e02\u573a\u6d41\u52a8\u6027',
    qdii: 'QDII\u57fa\u91d1\u6295\u8d44\u6d77\u5916\u5e02\u573a\uff0c\u9700\u5173\u6ce8\u6c47\u7387\u53d8\u52a8\u548c\u56fd\u9645\u5e02\u573a\u8d70\u52bf',
    money: '\u8d27\u5e01\u578b\u57fa\u91d1\u98ce\u9669\u8f83\u4f4e\uff0c\u4e3b\u8981\u5173\u6ce8\u6536\u76ca\u7387\u548c\u6d41\u52a8\u6027',
    fof: 'FOF\u57fa\u91d1\u901a\u8fc7\u6295\u8d44\u5176\u4ed6\u57fa\u91d1\u5206\u6563\u98ce\u9669\uff0c\u9700\u5173\u6ce8\u5b50\u57fa\u91d1\u9009\u62e9\u548c\u8d44\u4ea7\u914d\u7f6e'
  };
  return contexts[fundType] || contexts.mixed;
}
