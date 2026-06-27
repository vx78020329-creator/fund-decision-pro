import { Router } from "express";
import {
  insertTrade,
  getTrades,
  confirmTrade,
  confirmPendingTrades,
  insertDcaPlan,
  getDcaPlans,
  toggleDcaPlan,
  getFundByCode,
} from "../db/index.js";
import { randomUUID } from "node:crypto";

export const tradeRouter = Router();

// POST /api/trade/buy — simulated purchase
tradeRouter.post("/buy", (req, res) => {
  const { fundCode, amount } = req.body;
  if (!fundCode || !amount) {
    res.status(400).json({ error: "fundCode and amount are required" });
    return;
  }

  const fund = getFundByCode(fundCode);
  const fundName = fund?.name || fundCode;
  const nav = fund?.nav || 1;
  const feeRate = fund?.fee?.purchase || 0;
  const feeAmount = Number(amount) * feeRate / 100;
  const shares = (Number(amount) - feeAmount) / nav;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const confirmDate = tomorrow.toISOString().slice(0, 10);

  const id = randomUUID();
  insertTrade({
    id,
    fundCode,
    fundName,
    type: "buy",
    amount: Number(amount),
    nav,
    shares,
    fee: feeAmount,
    status: "pending",
    confirmDate,
  });

  res.json({
    id,
    fundCode,
    fundName,
    type: "buy",
    amount: Number(amount),
    nav,
    shares,
    fee: feeAmount,
    status: "pending",
    confirmDate,
    createdAt: new Date().toISOString(),
  });
});

// POST /api/trade/sell — simulated redemption
tradeRouter.post("/sell", (req, res) => {
  const { fundCode, shares } = req.body;
  if (!fundCode || !shares) {
    res.status(400).json({ error: "fundCode and shares are required" });
    return;
  }

  const fund = getFundByCode(fundCode);
  const fundName = fund?.name || fundCode;
  const nav = fund?.nav || 1;
  const feeRate = fund?.fee?.redeem || 0;
  const amount = Number(shares) * nav;
  const feeAmount = amount * feeRate / 100;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const confirmDate = tomorrow.toISOString().slice(0, 10);

  const id = randomUUID();
  insertTrade({
    id,
    fundCode,
    fundName,
    type: "sell",
    amount: amount - feeAmount,
    nav,
    shares: Number(shares),
    fee: feeAmount,
    status: "pending",
    confirmDate,
  });

  res.json({
    id,
    fundCode,
    fundName,
    type: "sell",
    amount: amount - feeAmount,
    nav,
    shares: Number(shares),
    fee: feeAmount,
    status: "pending",
    confirmDate,
    createdAt: new Date().toISOString(),
  });
});

// GET /api/trade/history — list trades
tradeRouter.get("/history", (req, res) => {
  const limit = req.query.limit != null ? Number(req.query.limit) : 50;
  const trades = getTrades(limit);
  res.json(trades);
});

// POST /api/trade/confirm/:id — confirm a pending trade
tradeRouter.post("/confirm/:id", (req, res) => {
  confirmTrade(req.params.id);
  res.json({ ok: true, id: req.params.id });
});

// POST /api/trade/confirm-pending — auto-confirm all pending
tradeRouter.post("/confirm-pending", (_req, res) => {
  confirmPendingTrades();
  res.json({ ok: true });
});

// POST /api/trade/dca — create DCA plan
tradeRouter.post("/dca", (req, res) => {
  const { fundCode, amount, frequency, dayOfWeek, dayOfMonth } = req.body;
  if (!fundCode || !amount || !frequency) {
    res.status(400).json({ error: "fundCode, amount, and frequency are required" });
    return;
  }

  const fund = getFundByCode(fundCode);
  const fundName = fund?.name || fundCode;

  const id = randomUUID();
  insertDcaPlan({
    id,
    fundCode,
    fundName,
    amount: Number(amount),
    frequency,
    dayOfWeek: dayOfWeek ?? null,
    dayOfMonth: dayOfMonth ?? null,
    active: 1,
  });

  res.json({ id, fundCode, fundName, amount: Number(amount), frequency, active: true });
});

// GET /api/trade/dca — list DCA plans
tradeRouter.get("/dca", (_req, res) => {
  const plans = getDcaPlans();
  res.json(plans);
});

// PATCH /api/trade/dca/:id — toggle DCA plan
tradeRouter.patch("/dca/:id", (req, res) => {
  const { active } = req.body;
  if (active == null) {
    res.status(400).json({ error: "active is required" });
    return;
  }
  toggleDcaPlan(req.params.id, Boolean(active));
  res.json({ ok: true, id: req.params.id, active: Boolean(active) });
});