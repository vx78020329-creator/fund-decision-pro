import { Router } from "express";
import {
  getFundByCode,
  createAiSession,
  updateAiSession,
} from "../db/index.js";
import {
  runDiagnosis,
  runDebate,
  runVerification,
  runChat, runChatStream,
  createSSEmitter,
} from "../services/ai-agents.js";
import { randomUUID } from "node:crypto";

export const aiRouter = Router();

// POST /api/ai/diagnose/:code 鈥?SSE streaming diagnosis
aiRouter.post("/diagnose/:code", async (req, res) => {
  const fund = getFundByCode(req.params.code);
  if (!fund) { res.status(404).json({ error: "Fund not found" }); return; }

  const sessionId = randomUUID();
  createAiSession({ id: sessionId, fundCode: fund.code, sessionType: "diagnose", status: "running", result: "{}" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const emit = (event: string, data: unknown) => {
    const payload = event === "agent_progress"
      ? JSON.stringify({ type: "agent_progress", ...data as object })
      : event === "diagnosis_complete"
        ? JSON.stringify(data)
        : JSON.stringify({ type: event, ...data as object });
    res.write(`data: ${payload}\n\n`);
  };

  try {
    const result = await runDiagnosis(fund, emit);
    updateAiSession(sessionId, { status: "completed", result: JSON.stringify(result) });
  } catch (err) {
    console.error("[ai/diagnose]", err);
    updateAiSession(sessionId, { status: "failed" });
  }
  res.write("data: [DONE]\n\n");
  res.end();
});

// POST /api/ai/debate 鈥?JSON response (not SSE)
aiRouter.post("/debate", async (req, res) => {
  const { fundCode } = req.body;
  if (!fundCode) { res.status(400).json({ error: "fundCode required" }); return; }

  const fund = getFundByCode(fundCode);
  const fundName = fund?.name || fundCode;
  const fundInfo = fund ? `净值{fund.nav}，近1年{fund.totalReturn1y}%` : "";

  try {
    const result = await runDebate(fund || { code: fundCode, name: fundName, type: "mixed", nav: 1, dailyReturn: 0, totalReturn1y: 0, totalReturn3y: 0, size: 0, riskLevel: 3, manager: "", company: "", benchmark: "" }, () => {});
    res.json(result);
  } catch (err) {
    console.error("[ai/debate]", err);
    res.status(500).json({ error: "Debate failed" });
  }
});

// POST /api/ai/verify 鈥?counter-argument
aiRouter.post("/verify", async (req, res) => {
  const { fundCode, userView } = req.body;
  if (!fundCode || !userView) { res.status(400).json({ error: "fundCode and userView required" }); return; }

  const fund = getFundByCode(fundCode);
  try {
    const result = await runVerification(fund || { code: fundCode, name: fundCode, type: "mixed", nav: 1, dailyReturn: 0, totalReturn1y: 0, totalReturn3y: 0, size: 0, riskLevel: 3, manager: "", company: "", benchmark: "" }, userView, () => {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Verification failed" });
  }
});


// POST /api/ai/chat/stream - SSE streaming chat
// POST /api/ai/chat/stream - SSE streaming chat
aiRouter.post("/chat/stream", async (req, res) => {
  const { message, context } = req.body;
  if (!message) { res.status(400).json({ error: "message required" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    await runChatStream(
      message,
      context,
      (chunk) => {
        const payload = JSON.stringify({ type: "chunk", content: chunk });
        res.write("data: " + payload + "\n\n");
      },
      () => {
        res.write("data: [DONE]\n\n");
        res.end();
      },
      (err) => {
        const errPayload = JSON.stringify({ type: "error", content: err });
        res.write("data: " + errPayload + "\n\n");
        res.write("data: [DONE]\n\n");
        res.end();
      },
    );
  } catch (err) {
    const errPayload = JSON.stringify({ type: "error", content: "AI service unavailable" });
    res.write("data: " + errPayload + "\n\n");
    res.write("data: [DONE]\n\n");
    res.end();
  }
});
// POST /api/ai/chat
aiRouter.post("/chat", async (req, res) => {
  const { message, context } = req.body;
  if (!message) { res.status(400).json({ error: "message required" }); return; }
  try {
    const reply = await runChat(message, context);
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: "Chat failed" });
  }
});