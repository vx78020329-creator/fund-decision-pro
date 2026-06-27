import type { Fund, FundNavPoint, FundHolding } from '@/types/fund';
import { getMockFunds, getMockNavHistory, getMockHoldings } from './mockData';

const API_BASE = '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    console.log("[API] Fetching:", API_BASE + url);
    const res = await fetch(`${API_BASE}${url}`,
      Object.assign({ headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(120000) }, options)
    );
    console.log("[API] Response:", res.status, "for", url);
    if (!res.ok) { console.log("[API] Error status:", res.status); return null; }
    return res.json() as Promise<T>;
  } catch (err) { console.error("[API] Fetch error:", url, err); return null; }
}

// ===== Fund APIs =====
export async function fetchFunds(params: {
  keyword?: string;
  type?: string;
  sortBy?: string;
  sortOrder?: string;
  riskLevel?: number;
  page?: number;
  pageSize?: number;
}): Promise<{ funds: Fund[]; total: number; page: number; pageSize: number }> {
  const query = new URLSearchParams();
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.type && params.type !== 'all') query.set('type', params.type);
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);
  if (params.riskLevel) query.set('riskLevel', String(params.riskLevel));
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));

  const result = await fetchJSON<{ funds: Fund[]; total: number; page: number; pageSize: number }>(
    `/funds?${query}`
  );

  // If backend returned real data, use it (even if some funds have nav=0)
  if (result && result.total > 0) return result;

  // Mock fallback
  let all = getMockFunds();
  if (params.keyword) {
    const kw = params.keyword.toLowerCase();
    all = all.filter(f =>
      f.name.toLowerCase().includes(kw) ||
      f.code.includes(kw) ||
      f.company.toLowerCase().includes(kw) ||
      f.manager.toLowerCase().includes(kw)
    );
  }
  if (params.type && params.type !== 'all') {
    all = all.filter(f => f.type === params.type);
  }
  if (params.riskLevel && params.riskLevel > 0) {
    all = all.filter(f => f.riskLevel === params.riskLevel);
  }
  const sortBy = params.sortBy || 'totalReturn1y';
  const sortOrder = params.sortOrder || 'desc';
  all.sort((a, b) => {
    const va = (a as unknown as Record<string, unknown>)[sortBy] as number;
    const vb = (b as unknown as Record<string, unknown>)[sortBy] as number;
    return sortOrder === 'desc' ? vb - va : va - vb;
  });
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  return {
    funds: all.slice((page - 1) * pageSize, page * pageSize),
    total: all.length,
    page,
    pageSize,
  };
}

export async function fetchFundByCode(code: string): Promise<Fund | null> {
  const result = await fetchJSON<Fund>(`/funds/${code}`);
  if (result) return result;
  return getMockFunds().find(f => f.code === code) || null;
}

export async function fetchNavHistory(code: string, days = 1095): Promise<FundNavPoint[]> {
  const result = await fetchJSON<FundNavPoint[]>(`/funds/${code}/nav?days=${days}`);
  if (result) return result;
  return getMockNavHistory(code, days);
}

export async function fetchHoldings(code: string): Promise<FundHolding[]> {
  const result = await fetchJSON<FundHolding[]>(`/funds/${code}/holdings`);
  if (result) return result;
  return getMockHoldings();
}

export async function syncFunds(): Promise<{ synced: number }> {
  const result = await fetchJSON<{ synced: number }>('/funds/sync', { method: 'POST' });
  return result || { synced: 0 };
}

// ===== AI APIs =====
export interface AgentProgress {
  agent: string;
  label: string;
  icon: string;
  score: number;
  summary: string;
  analysis: string;
  signals: string[];
}

export interface DiagnosisResult {
  fundCode: string;
  fundName: string;
  agents: AgentProgress[];
  finalScore: number;
  verdict: 'buy' | 'sell' | 'hold';
  verdictText: string;
}

export function streamDiagnosis(
  code: string,
  onProgress: (agent: string, result: AgentProgress) => void,
  onComplete: (result: DiagnosisResult) => void,
  onError: (error: string) => void,
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_BASE}/ai/diagnose/${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        onError('API unavailable');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'agent_progress') {
                if (data.result) onProgress(data.agent, data.result);
              } else if (data.type === 'diagnosis_complete') {
                onComplete(data.result);
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        onError(String(err));
      }
    }
  })();

  return () => controller.abort();
}

export async function runDebate(fundCode: string): Promise<{
  rounds: Array<{ round: number; stage: string; speaker: string; content: string; score?: number }>;
  finalVerdict: string;
  verdictText: string;
} | null> {
  return fetchJSON('/ai/debate', {
    method: 'POST',
    body: JSON.stringify({ fundCode }),
    signal: AbortSignal.timeout(30000),
  });
}

export async function runVerify(fundCode: string, userView: string): Promise<{
  counterArguments: string[];
  supportingArguments: string[];
  riskWarning: string;
  suggestion: string;
} | null> {
  return fetchJSON('/ai/verify', {
    method: 'POST',
    body: JSON.stringify({ fundCode, userView }),
  });
}

export async function runChat(message: string, context?: string): Promise<{ reply: string } | null> {
  return fetchJSON('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, context }),
  });
}

// ===== Trade APIs =====
export interface Trade {
  id: string;
  fundCode: string;
  fundName: string;
  type: 'buy' | 'sell';
  amount: number;
  nav: number;
  shares: number;
  fee: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  confirmDate: string;
  createdAt: string;
}

export interface DcaPlan {
  id: string;
  fundCode: string;
  fundName: string;
  amount: number;
  frequency: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  active: boolean;
}

export async function submitBuy(fundCode: string, amount: number): Promise<Trade | null> {
  return fetchJSON('/trade/buy', {
    method: 'POST',
    body: JSON.stringify({ fundCode, amount }),
  });
}

export async function submitSell(fundCode: string, shares: number): Promise<Trade | null> {
  return fetchJSON('/trade/sell', {
    method: 'POST',
    body: JSON.stringify({ fundCode, shares }),
  });
}

export async function fetchTrades(limit = 50): Promise<Trade[]> {
  const result = await fetchJSON<Trade[]>(`/trade/history?limit=${limit}`);
  return result || [];
}

export async function confirmTradeById(id: string): Promise<Trade | null> {
  return fetchJSON(`/trade/confirm/${id}`, { method: 'POST' });
}

export async function createDcaPlan(params: {
  fundCode: string;
  amount: number;
  frequency: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
}): Promise<DcaPlan | null> {
  return fetchJSON('/trade/dca', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function fetchDcaPlans(): Promise<DcaPlan[]> {
  const result = await fetchJSON<DcaPlan[]>('/trade/dca');
  return result || [];
}

export async function toggleDcaPlanActive(id: string, active: boolean): Promise<DcaPlan | null> {
  return fetchJSON(`/trade/dca/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
  });
}

// ===== Portfolio APIs =====
export interface PortfolioItem {
  fundCode: string;
  fundName: string;
  shares: number;
  avgCost: number;
  weight: number;
  nav?: number;
  dailyReturn?: number;
  marketValue?: number;
  profit?: number;
}

export async function fetchPortfolio(): Promise<PortfolioItem[]> {
  const result = await fetchJSON<PortfolioItem[]>('/portfolio');
  return result || [];
}

export async function updatePortfolioItem(item: PortfolioItem): Promise<PortfolioItem | null> {
  return fetchJSON('/portfolio', {
    method: 'POST',
    body: JSON.stringify(item),
  });
}

export async function removeFromPortfolio(code: string): Promise<boolean> {
  const result = await fetchJSON(`/portfolio/${code}`, { method: 'DELETE' });
  return result !== null;
}
// ===== News APIs =====
export interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  tag: string;
  important: boolean;
  content: string;
  summary: string;
  keyPoints: string[];
  originalTime?: string;  url?: string;}

export async function fetchNews(): Promise<NewsItem[]> {
  const result = await fetchJSON<NewsItem[]>('/funds/news/list');
  return result || [];
}

// ===== Sync Progress =====
export interface SyncProgress {
  running: boolean;
  total: number;
  processed: number;
  phase: string;
  lastSyncTime: string;
  error: string;
}

export async function fetchSyncProgress(): Promise<SyncProgress> {
  const result = await fetchJSON<SyncProgress>('/funds/sync/progress');
  return result || { running: false, total: 0, processed: 0, phase: '', lastSyncTime: '', error: '' };
}

export async function fetchFundCount(): Promise<number> {
  const result = await fetchJSON<{ total: number }>('/funds/count');
  return result?.total || 0;
}


export function streamChat(
  message: string,
  onChunk: (text: string) => void,
  onComplete: (fullText: string) => void,
  onError: (error: string) => void,
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_BASE}/ai/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        onError('API unavailable');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'chunk' && data.content) {
                fullText += data.content;
                onChunk(fullText);
              } else if (data.type === 'error') {
                onError(data.content);
              }
            } catch { /* ignore */ }
          }
        }
      }
      if (fullText) onComplete(fullText);
    } catch (err) {
      if (!controller.signal.aborted) {
        onError(String(err));
      }
    }
  })();

  return () => controller.abort();
}

// ===== Daily Analysis APIs =====
export interface FundAnalysisData {
  fundCode: string;
  fundName: string;
  type: string;
  manager: string;
  company: string;
  riskLevel: number;
  currentNav: number;
  dailyReturn: number;
  return7d: number | null;
  return30d: number | null;
  volatility: string;
  maxDrawdown: string;
  size: number;
  shares?: number;
  avgCost?: number;
  amount?: number;
  marketContext: string;
  recentPerformance: Array<{ date: string; nav: number; return: number }>;
}

export interface AnalysisSummary {
  holdings: Array<{
    code: string;
    name: string;
    type: string;
    dailyReturn: number;
    currentNav: number;
    shares: number;
    amount: number;
    marketValue: number;
    profit: number;
    profitRate: number;
    weight: number;
  }>;
  summary: {
    totalMarketValue: number;
    totalAmount: number;
    totalProfit: number;
    totalProfitRate: number;
    holdingCount: number;
    typeAllocation: Record<string, number>;
  };
}

export async function fetchFundAnalysis(params: {
  fundCode: string;
  fundName?: string;
  shares?: number;
  avgCost?: number;
  amount?: number;
}): Promise<FundAnalysisData | null> {
  return fetchJSON('/analysis/fund', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function fetchAnalysisSummary(holdings: Array<{
  code: string;
  shares: number;
  amount: number;
}>): Promise<AnalysisSummary | null> {
  return fetchJSON('/analysis/summary', {
    method: 'POST',
    body: JSON.stringify({ holdings }),
  });
}



// ===== News AI Analysis =====
export interface NewsAnalysis {
  summary: string;
  impact: string;
  recommendation: string;
  impactScore: number;
  direction: 'positive' | 'negative' | 'neutral';
}

export async function analyzeNews(title: string, content: string, source?: string, time?: string): Promise<NewsAnalysis> {
  const result = await fetchJSON<NewsAnalysis>('/funds/news/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, source, time }),
  });
  return result || { summary: '', impact: '', recommendation: '', impactScore: 0, direction: 'neutral' };
}
