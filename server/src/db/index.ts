import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, "../../data");
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const db = new Database(resolve(dataDir, "fund.db"));
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");

// ── Schema ──────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS funds (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    nav REAL DEFAULT 0,
    acc_nav REAL DEFAULT 0,
    daily_return REAL DEFAULT 0,
    total_return_1y REAL DEFAULT 0,
    total_return_3y REAL DEFAULT 0,
    size REAL DEFAULT 0,
    risk_level INTEGER DEFAULT 3,
    manager TEXT DEFAULT '',
    company TEXT DEFAULT '',
    establish_date TEXT DEFAULT '',
    benchmark TEXT DEFAULT '',
    fee_manage REAL DEFAULT 0,
    fee_custody REAL DEFAULT 0,
    fee_purchase REAL DEFAULT 0,
    fee_redeem REAL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS nav_history (
    code TEXT NOT NULL,
    date TEXT NOT NULL,
    nav REAL NOT NULL,
    return_pct REAL DEFAULT 0,
    PRIMARY KEY (code, date)
  );

  CREATE TABLE IF NOT EXISTS holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    stock_name TEXT NOT NULL,
    stock_code TEXT DEFAULT '',
    weight REAL DEFAULT 0,
    industry TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    fund_code TEXT NOT NULL,
    fund_name TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    nav REAL DEFAULT 0,
    shares REAL DEFAULT 0,
    fee REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    confirm_date TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dca_plans (
    id TEXT PRIMARY KEY,
    fund_code TEXT NOT NULL,
    fund_name TEXT NOT NULL,
    amount REAL NOT NULL,
    frequency TEXT NOT NULL,
    day_of_week INTEGER,
    day_of_month INTEGER,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS portfolio (
    fund_code TEXT PRIMARY KEY,
    fund_name TEXT NOT NULL,
    shares REAL DEFAULT 0,
    avg_cost REAL DEFAULT 0,
    weight REAL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ai_sessions (
    id TEXT PRIMARY KEY,
    fund_code TEXT,
    session_type TEXT NOT NULL,
    status TEXT DEFAULT 'running',
    result TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sync_state (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_nav_code ON nav_history(code);
  CREATE INDEX IF NOT EXISTS idx_nav_date ON nav_history(date);
  CREATE INDEX IF NOT EXISTS idx_holdings_code ON holdings(code);
  CREATE INDEX IF NOT EXISTS idx_trades_code ON trades(fund_code);
  CREATE INDEX IF NOT EXISTS idx_portfolio_code ON portfolio(fund_code);
`);

export { db };
export function getDb() { return db; }

// ── Helpers ─────────────────────────────────────────────

function rowToFund(row: Record<string, unknown>) {
  return {
    code: row.code,
    name: row.name,
    type: row.type,
    nav: row.nav,
    accNav: row.acc_nav,
    dailyReturn: row.daily_return,
    totalReturn1y: row.total_return_1y,
    totalReturn3y: row.total_return_3y,
    size: row.size,
    riskLevel: row.risk_level,
    updatedAt: row.updated_at,
    manager: row.manager,
    company: row.company,
    establishDate: row.establish_date,
    benchmark: row.benchmark,
    fee: {
      manage: row.fee_manage,
      custody: row.fee_custody,
      purchase: row.fee_purchase,
      redeem: row.fee_redeem,
    },
  };
}

const SORT_MAP: Record<string, string> = {
  totalReturn1y: "total_return_1y",
  totalReturn3y: "total_return_3y",
  dailyReturn: "daily_return",
  size: "size",
  nav: "nav",
  name: "name",
};

export function getFunds(params: {
  keyword?: string;
  type?: string;
  sortBy?: string;
  sortOrder?: string;
  riskLevel?: number;
  page?: number;
  pageSize?: number;
}) {
  const { keyword, type, sortBy, sortOrder, riskLevel, page = 1, pageSize = 20 } = params;

  const conditions: string[] = [];
  const binds: unknown[] = [];

  if (keyword) {
    conditions.push("(name LIKE ? OR code LIKE ? OR manager LIKE ? OR company LIKE ?)");
    const kw = `%${keyword}%`;
    binds.push(kw, kw, kw, kw);
  }
  if (type && type !== "all") {
    conditions.push("type = ?");
    binds.push(type);
  }
  if (riskLevel && riskLevel > 0) {
    conditions.push("risk_level = ?");
    binds.push(riskLevel);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const orderCol = SORT_MAP[sortBy || ""] || "total_return_1y";
  const orderDir = sortOrder === "asc" ? "ASC" : "DESC";

  const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM funds ${where}`).get(...binds) as { cnt: number };
  const total = countRow.cnt;

  const offset = (page - 1) * pageSize;
  const rows = db.prepare(
    `SELECT * FROM funds ${where} ORDER BY ${orderCol} ${orderDir} LIMIT ? OFFSET ?`
  ).all(...binds, pageSize, offset) as Record<string, unknown>[];

  return { funds: rows.map(rowToFund), total, page, pageSize };
}

export function getFundByCode(code: string) {
  const row = db.prepare("SELECT * FROM funds WHERE code = ?").get(code) as Record<string, unknown> | undefined;
  return row ? rowToFund(row) : null;
}

export function getNavHistory(code: string, days?: number) {
  const limit = days || 365;
  const rows = db.prepare(
    "SELECT date, nav, return_pct as returnVal FROM nav_history WHERE code = ? ORDER BY date DESC LIMIT ?"
  ).all(code, limit) as Array<{ date: string; nav: number; returnVal: number }>;
  return rows.reverse().map(r => ({ date: r.date, nav: r.nav, return: r.returnVal }));
}

export function getHoldings(code: string) {
  const rows = db.prepare(
    "SELECT stock_name as name, stock_code as code, weight, industry FROM holdings WHERE code = ? ORDER BY weight DESC LIMIT 10"
  ).all(code);
  return rows;
}

export function upsertFund(fund: {
  code: string; name: string; type: string; nav: number; accNav: number;
  dailyReturn: number; totalReturn1y: number; totalReturn3y: number;
  size: number; riskLevel: number; manager: string; company: string;
  establishDate: string; benchmark: string;
  manageFee: number; custodyFee: number; purchaseFee: number; redeemFee: number;
}) {
  db.prepare(`
    INSERT INTO funds (code, name, type, nav, acc_nav, daily_return, total_return_1y, total_return_3y,
      size, risk_level, manager, company, establish_date, benchmark,
      fee_manage, fee_custody, fee_purchase, fee_redeem, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(code) DO UPDATE SET
      name=excluded.name, type=excluded.type, nav=CASE WHEN excluded.nav > 0 THEN excluded.nav ELSE nav END, acc_nav=CASE WHEN excluded.acc_nav > 0 THEN excluded.acc_nav ELSE acc_nav END,
      daily_return=CASE WHEN excluded.daily_return != 0 THEN excluded.daily_return ELSE daily_return END, total_return_1y=CASE WHEN excluded.total_return_1y != 0 THEN excluded.total_return_1y ELSE total_return_1y END,
      total_return_3y=excluded.total_return_3y, size=excluded.size, risk_level=excluded.risk_level,
      manager=excluded.manager, company=excluded.company, establish_date=excluded.establish_date,
      benchmark=excluded.benchmark, fee_manage=excluded.fee_manage, fee_custody=excluded.fee_custody,
      fee_purchase=excluded.fee_purchase, fee_redeem=excluded.fee_redeem, updated_at=datetime('now')
  `).run(
    fund.code, fund.name, fund.type, fund.nav, fund.accNav,
    fund.dailyReturn, fund.totalReturn1y, fund.totalReturn3y,
    fund.size, fund.riskLevel, fund.manager, fund.company,
    fund.establishDate, fund.benchmark,
    fund.manageFee, fund.custodyFee, fund.purchaseFee, fund.redeemFee,
  );
}

export function bulkUpsertFunds(funds: Parameters<typeof upsertFund>[0][]) {
  const tx = db.transaction((items: Parameters<typeof upsertFund>[0][]) => {
    for (const f of items) upsertFund(f);
  });
  tx(funds);
}

export function bulkInsertNav(code: string, points: Array<{ date: string; nav: number; return: number }>) {
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO nav_history (code, date, nav, return_pct) VALUES (?, ?, ?, ?)"
  );
  const tx = db.transaction((pts: typeof points) => {
    for (const p of pts) stmt.run(code, p.date, p.nav, p.return);
  });
  tx(points);
  return points.length;
}

export function bulkInsertHoldings(code: string, items: Array<{ name: string; code: string; weight: number; industry: string }>) {
  db.prepare("DELETE FROM holdings WHERE code = ?").run(code);
  const stmt = db.prepare(
    "INSERT INTO holdings (code, stock_name, stock_code, weight, industry) VALUES (?, ?, ?, ?, ?)"
  );
  const tx = db.transaction((hs: typeof items) => {
    for (const h of hs) stmt.run(code, h.name, h.code, h.weight, h.industry);
  });
  tx(items);
}

// ── Trades ──────────────────────────────────────────────

export function insertTrade(trade: {
  id: string; fundCode: string; fundName: string; type: string;
  amount: number; nav: number; shares: number; fee: number;
  status: string; confirmDate: string | null;
}) {
  db.prepare(`
    INSERT INTO trades (id, fund_code, fund_name, type, amount, nav, shares, fee, status, confirm_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(trade.id, trade.fundCode, trade.fundName, trade.type, trade.amount, trade.nav, trade.shares, trade.fee, trade.status, trade.confirmDate);
}

export function getTrades(limit = 50) {
  const rows = db.prepare("SELECT * FROM trades ORDER BY created_at DESC LIMIT ?").all(limit) as Record<string, unknown>[];
  return rows.map(r => ({
    id: r.id,
    fundCode: r.fund_code,
    fundName: r.fund_name,
    type: r.type,
    amount: r.amount,
    nav: r.nav,
    shares: r.shares,
    fee: r.fee,
    status: r.status,
    confirmDate: r.confirm_date,
    createdAt: r.created_at,
  }));
}

export function confirmTrade(id: string) {
  db.prepare("UPDATE trades SET status = 'confirmed', confirm_date = datetime('now') WHERE id = ?").run(id);
}

export function confirmPendingTrades() {
  db.prepare("UPDATE trades SET status = 'confirmed', confirm_date = datetime('now') WHERE status = 'pending'").run();
}

// ── DCA Plans ───────────────────────────────────────────

export function insertDcaPlan(plan: {
  id: string; fundCode: string; fundName: string; amount: number;
  frequency: string; dayOfWeek: number | null; dayOfMonth: number | null; active: number;
}) {
  db.prepare(`
    INSERT INTO dca_plans (id, fund_code, fund_name, amount, frequency, day_of_week, day_of_month, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(plan.id, plan.fundCode, plan.fundName, plan.amount, plan.frequency, plan.dayOfWeek, plan.dayOfMonth, plan.active);
}

export function getDcaPlans() {
  const rows = db.prepare("SELECT * FROM dca_plans ORDER BY created_at DESC").all() as Record<string, unknown>[];
  return rows.map(r => ({
    id: r.id,
    fundCode: r.fund_code,
    fundName: r.fund_name,
    amount: r.amount,
    frequency: r.frequency,
    dayOfWeek: r.day_of_week,
    dayOfMonth: r.day_of_month,
    active: Boolean(r.active),
    createdAt: r.created_at,
  }));
}

export function toggleDcaPlan(id: string, active: boolean) {
  db.prepare("UPDATE dca_plans SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
}

// ── Portfolio ───────────────────────────────────────────

export function getPortfolio() {
  const rows = db.prepare("SELECT * FROM portfolio ORDER BY weight DESC").all() as Record<string, unknown>[];
  return rows.map(r => ({
    fundCode: r.fund_code,
    fundName: r.fund_name,
    shares: r.shares,
    avgCost: r.avg_cost,
    weight: r.weight,
  }));
}

export function upsertPortfolioItem(item: {
  fundCode: string; fundName: string; shares: number; avgCost: number; weight: number;
}) {
  db.prepare(`
    INSERT INTO portfolio (fund_code, fund_name, shares, avg_cost, weight, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(fund_code) DO UPDATE SET
      fund_name=excluded.fund_name, shares=excluded.shares, avg_cost=excluded.avg_cost,
      weight=excluded.weight, updated_at=datetime('now')
  `).run(item.fundCode, item.fundName, item.shares, item.avgCost, item.weight);
}

export function deletePortfolioItem(code: string) {
  db.prepare("DELETE FROM portfolio WHERE fund_code = ?").run(code);
}

// ── AI Sessions ─────────────────────────────────────────

export function createAiSession(session: {
  id: string; fundCode: string | null; sessionType: string; status: string; result: string;
}) {
  db.prepare(`
    INSERT INTO ai_sessions (id, fund_code, session_type, status, result)
    VALUES (?, ?, ?, ?, ?)
  `).run(session.id, session.fundCode, session.sessionType, session.status, session.result);
}

export function getAiSession(id: string) {
  const row = db.prepare("SELECT * FROM ai_sessions WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id,
    fundCode: row.fund_code,
    sessionType: row.session_type,
    status: row.status,
    result: row.result,
    createdAt: row.created_at,
  };
}

export function updateAiSession(id: string, updates: { status?: string; result?: string }) {
  if (updates.status) db.prepare("UPDATE ai_sessions SET status = ? WHERE id = ?").run(updates.status, id);
  if (updates.result) db.prepare("UPDATE ai_sessions SET result = ? WHERE id = ?").run(updates.result, id);
}

// ── Sync State ──────────────────────────────────────────

export function getSyncState(key: string): string | null {
  const row = db.prepare("SELECT value FROM sync_state WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSyncState(key: string, value: string) {
  db.prepare(`
    INSERT INTO sync_state (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')
  `).run(key, value);
}

export function closeDb() {
  db.close();
}