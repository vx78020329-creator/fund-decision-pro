import { Router } from "express";
import { getPortfolio, upsertPortfolioItem, deletePortfolioItem, getFundByCode, getTrades, getNavHistory, db } from "../db/index.js";
import { syncFundNav } from "../services/scraper.js";

export const portfolioRouter = Router();

function round(n: number, digits = 2): number {
  return Number(n.toFixed(digits));
}

// GET /api/portfolio �?list portfolio holdings
portfolioRouter.get("/", (_req, res) => {
  const items = getPortfolio();
  // Enrich with current fund data
  const enriched = items.map(item => {
    const fund = getFundByCode(item.fundCode);
    return {
      ...item,
      nav: fund?.nav || 0,
      dailyReturn: fund?.dailyReturn || 0,
      marketValue: item.shares * (fund?.nav || 0),
      profit: item.shares * (fund?.nav || 0) - item.shares * item.avgCost,
    };
  });
  res.json(enriched);
});

// POST /api/portfolio �?add/update portfolio position
portfolioRouter.post("/", (req, res) => {
  const { fundCode, fundName, shares, avgCost, weight } = req.body;
  if (!fundCode || !fundName) {
    res.status(400).json({ error: "fundCode and fundName are required" });
    return;
  }
  upsertPortfolioItem({
    fundCode,
    fundName,
    shares: shares != null ? Number(shares) : 0,
    avgCost: avgCost != null ? Number(avgCost) : 0,
    weight: weight != null ? Number(weight) : 0,
  });
  res.json({ ok: true });
});

// DELETE /api/portfolio/:code �?remove position
portfolioRouter.delete("/:code", (req, res) => {
  deletePortfolioItem(req.params.code);
  res.json({ ok: true });
});

// GET /api/portfolio/summary �?portfolio summary
portfolioRouter.get("/summary", (_req, res) => {
  const items = getPortfolio();
  let totalValue = 0;
  let totalCost = 0;
  for (const item of items) {
    const fund = getFundByCode(item.fundCode);
    const nav = fund?.nav || 0;
    totalValue += item.shares * nav;
    totalCost += item.shares * item.avgCost;
  }
  res.json({
    positionCount: items.length,
    totalValue,
    totalCost,
    profit: totalValue - totalCost,
    profitPercent: totalCost > 0 ? ((totalValue - totalCost) / totalCost * 100) : 0,
  });
});


// POST /api/portfolio/sync - sync NAV data for all portfolio holdings
portfolioRouter.post("/sync", async (_req, res) => {
  try {
    const items = getPortfolio();
    const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
    const codes = items.map(i => i.fundCode);
    let updated = 0;
    for (const code of codes) {
      try {
        const count = await syncFundNav(code);
        if (count > 0) updated++;
      } catch (err) {
        console.error(`[portfolio/sync] Failed to sync ${code}:`, err);
      }
    }
    res.json({ synced: codes.length, updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// GET /api/portfolio/dashboard - comprehensive dashboard overview
portfolioRouter.get("/dashboard", (_req, res) => {
  try {
    const items = getPortfolio();
    const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10); // Beijing UTC+8

    // Enrich holdings with fund data and calculate totals
    let totalAssets = 0;
    let totalCost = 0;
    let todayPnl = 0;

    const holdings = items.map(item => {
      const fund = getFundByCode(item.fundCode);
      const nav = fund?.nav || 0;
      const dailyReturn = fund?.dailyReturn || 0;
      const navMissing = nav <= 0;
      // When nav is missing (e.g. QDII funds not in eastmoney), use avgCost as fallback
      const effectiveNav = navMissing ? item.avgCost : nav;
      const marketValue = item.shares * effectiveNav;
      const costValue = item.shares * item.avgCost;
      const pnl = navMissing ? 0 : marketValue - costValue;
      const pnlPercent = navMissing ? 0 : (costValue > 0 ? (pnl / costValue * 100) : 0);
            // Calculate todayPnl from actual NAV difference (matches Alipay)
      // If latest NAV is not from today, today's PnL = 0 (market hasn't updated yet)
      const latestNavDate = (() => {
        const h = getNavHistory(item.fundCode, 2);
        return h.length > 0 ? h[h.length - 1].date : '';
      })();
      const isLatestToday = latestNavDate === today;
      let holdingTodayPnl = 0;
      if (!navMissing && item.shares > 0) {
        const navHistory = getNavHistory(item.fundCode, 5);
        if (navHistory.length >= 2) {
          if (isLatestToday) {
            const len = navHistory.length;
            holdingTodayPnl = Math.round(item.shares * (navHistory[len-1].nav - navHistory[len-2].nav) * 100) / 100;
          }
          // else: today's NAV not available yet, todayPnl stays 0
        }
      }

      // yesterdayPnl: NAV diff between navHistory[1] and navHistory[2]
      let holdingYesterdayPnl = 0;
      if (!navMissing && item.shares > 0) {
        const navHistory = getNavHistory(item.fundCode, 5);
        if (navHistory.length >= 2) {
          const yLen = navHistory.length;
          if (isLatestToday && yLen >= 3) {
            holdingYesterdayPnl = Math.round(item.shares * (navHistory[yLen-2].nav - navHistory[yLen-3].nav) * 100) / 100;
          } else {
            holdingYesterdayPnl = Math.round(item.shares * (navHistory[yLen-1].nav - navHistory[yLen-2].nav) * 100) / 100;
          }
        }
      }
            totalAssets += marketValue;
      totalCost += costValue;
      todayPnl += holdingTodayPnl;

      return {
        code: item.fundCode,
        name: item.fundName,
        shares: round(item.shares),
        avgCost: round(item.avgCost, 4),
        currentNav: round(nav, 4),
        marketValue: round(marketValue, 2),
        costValue: round(costValue, 2),
        pnl: round(pnl, 2),
        pnlPercent: round(pnlPercent, 2),
        todayPnl: round(holdingTodayPnl, 2),
        todayPnlPercent: round(dailyReturn, 2),
        yesterdayPnl: round(holdingYesterdayPnl, 2),
        weight: 0, // recalculated below
        type: fund?.type || "unknown",
        riskLevel: fund?.riskLevel || 3,
        navMissing,
      };
    });

    // Recalculate actual weights based on current market values
    for (const h of holdings) {
      h.weight = totalAssets > 0 ? round((h.marketValue / totalAssets) * 100, 2) : 0;
    }

    const totalPnl = totalAssets - totalCost;
    const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost * 100) : 0;
    const todayPnlPercent = totalAssets > 0 ? (Math.round(todayPnl / totalAssets * 10000) / 100) : 0;
    // Also calculate yesterday total
    let totalYesterday = 0;
    for (const h of holdings) { totalYesterday += h.yesterdayPnl || 0; }
    const yesterdayPnlPercent = totalAssets > 0 ? (Math.round(totalYesterday / totalAssets * 10000) / 100) : 0;

    // Recent 10 trades
    const recentTrades = getTrades(10);

    // Daily returns (last 30 days) �?weighted sum of per-fund daily returns
    const dailyReturnsMap = new Map<string, number>();
    for (const item of items) {
      const fund = getFundByCode(item.fundCode);
      const nav = fund?.nav || 0;
      const holdingWeight = totalAssets > 0 ? (item.shares * nav) / totalAssets : 0;
      const history = getNavHistory(item.fundCode, 30);
      for (const h of history) {
        const existing = dailyReturnsMap.get(h.date) || 0;
        dailyReturnsMap.set(h.date, existing + h.return * holdingWeight);
      }
    }
    const dailyReturns = Array.from(dailyReturnsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, ret]) => ({ date, ret: round(ret, 2) }));

    // Cash balance �?stored in sync_state, defaults to 0
    let cashBalance = 0;
    try {
      const row = db.prepare("SELECT value FROM sync_state WHERE key = 'cash_balance'").get() as { value: string } | undefined;
      if (row) cashBalance = Number(row.value) || 0;
    } catch { /* no cash_balance configured yet */ }

    res.json({
      totalAssets: round(totalAssets, 2),
      totalCost: round(totalCost, 2),
      totalPnl: round(totalPnl, 2),
      totalPnlPercent: round(totalPnlPercent, 2),
      todayPnl: round(todayPnl, 2),
      todayPnlPercent: round(todayPnlPercent, 2),
      yesterdayPnl: round(totalYesterday, 2),
      yesterdayPnlPercent: round(yesterdayPnlPercent, 2),
      cashBalance: round(cashBalance, 2),
      holdingsCount: holdings.length,
      holdings,
      recentTrades,
      dailyReturns,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});
