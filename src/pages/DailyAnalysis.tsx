import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Brain, Target } from 'lucide-react';

interface Holding {
  code: string; name: string; amount: number; dailyReturn: number;
  totalReturn: number; returnPct: number; weight: number; type: string;
  shares?: number; avgCost?: number;
}

interface FundAnalysis {
  fundCode: string; fundName: string; type: string; manager: string;
  company: string; riskLevel: number; currentNav: number; dailyReturn: number;
  return7d: number | null; return30d: number | null; volatility: string;
  maxDrawdown: string; size: number; marketContext: string;
  recentPerformance: Array<{ date: string; nav: number; return: number }>;
}

interface AnalysisResult {
  holding: Holding;
  analysis: FundAnalysis | null;
  aiInsight: string;
  recommendation: 'buy_more' | 'hold' | 'reduce' | 'sell';
  loading: boolean;
  error: string;
}

const STORAGE_KEY = 'my_holdings_data';

const DEFAULT_HOLDINGS: Holding[] = [
  { code: '011452', name: '华泰柏瑞质量成长混合C', amount: 562.63, dailyReturn: 16.05, totalReturn: 99.63, returnPct: 21.52, weight: 12.39, type: '混合型', shares: 139.2, avgCost: 3.3261 },
  { code: '017641', name: '摩根标普500指数(QDII)A', amount: 516.95, dailyReturn: -6.58, totalReturn: 6.49, returnPct: 1.32, weight: 11.38, type: 'QDII', shares: 301.71, avgCost: 1.6256 },
  { code: '017811', name: '东方人工智能主题混合C', amount: 119.07, dailyReturn: 7.48, totalReturn: 19.07, returnPct: 19.07, weight: 2.62, type: '混合型', shares: 33.72, avgCost: 2.9656 },
  { code: '020900', name: '天弘中证全指通信设备指数C', amount: 57.48, dailyReturn: 0.9, totalReturn: 7.48, returnPct: 14.95, weight: 1.27, type: '指数型', shares: 12.52, avgCost: 3.9936 },
  { code: '022459', name: '易方达中证A500ETF联接A', amount: 365.27, dailyReturn: 3.64, totalReturn: 8.39, returnPct: 2.35, weight: 8.04, type: '指数型', shares: 267.56, avgCost: 1.3338 },
  { code: '016441', name: '华夏中证红利质量ETF联接C', amount: 501.82, dailyReturn: 1.74, totalReturn: 5.01, returnPct: 1.01, weight: 11.05, type: '指数型', shares: 414.04, avgCost: 1.1999 },
  { code: '011961', name: '易方达稳鑫30天滚动持有短债债券A', amount: 1701.52, dailyReturn: 0, totalReturn: 0.63, returnPct: 0.04, weight: 37.47, type: '债券型', shares: 0, avgCost: 0 },
  { code: '968075', name: '百达策略收益', amount: 334.69, dailyReturn: -9.72, totalReturn: -1.31, returnPct: -0.39, weight: 7.37, type: '混合型', shares: 19.23, avgCost: 17.4727 },
  { code: '008887', name: '华夏国证半导体芯片ETF联接A', amount: 102.71, dailyReturn: 4.98, totalReturn: 2.71, returnPct: 2.71, weight: 2.26, type: '指数型', shares: 40.05, avgCost: 2.4969 },
  { code: '025793', name: '东方阿尔法科技甄选混合C', amount: 97.87, dailyReturn: 0.66, totalReturn: -2.13, returnPct: -2.13, weight: 2.16, type: '混合型', shares: 58.03, avgCost: 1.7232 },
  { code: '014915', name: '财通匠心优选一年持有期混合A', amount: 180.9, dailyReturn: 3.86, totalReturn: 0.9, returnPct: 0.5, weight: 3.98, type: '混合型', shares: 45.13, avgCost: 3.9885 },
];

const DATA_VERSION = 'v2';
function loadHoldings(): Holding[] {
  try {
    const v = localStorage.getItem(STORAGE_KEY + '_ver');
    const d = localStorage.getItem(STORAGE_KEY);
    if (v === DATA_VERSION && d) return JSON.parse(d);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_HOLDINGS));
    localStorage.setItem(STORAGE_KEY + '_ver', DATA_VERSION);
    return DEFAULT_HOLDINGS;
  } catch { return DEFAULT_HOLDINGS; }
}

function formatMoney(n: number) {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getRecommendation(analysis: FundAnalysis, holding: Holding): 'buy_more' | 'hold' | 'reduce' | 'sell' {
  const daily = analysis.dailyReturn || 0;
  const dd = parseFloat(analysis.maxDrawdown) || 0;
  const vol = parseFloat(analysis.volatility) || 0;
  const r30 = analysis.return30d || 0;
  if (holding.returnPct > 15 && daily < -2) return 'reduce';
  if (holding.returnPct < -5 && dd > 15) return 'sell';
  if (r30 > 5 && daily > 0) return 'buy_more';
  return 'hold';
}

function generateFundDetail(analysis: FundAnalysis, holding: Holding, navHistory: any[]): string[] {
  const daily = analysis.dailyReturn || 0;
  const dd = parseFloat(analysis.maxDrawdown) || 0;
  const vol = parseFloat(analysis.volatility) || 0;
  const r7 = analysis.return7d;
  const r30 = analysis.return30d;
  const parts: string[] = [];

  // Fund type-specific analysis
  const typeAnalysis: Record<string, string> = {
    mixed: '混合型基金具备股债配置灵活性，受股票市场和债券市场双重影响',
    index: '指数型基金紧跟对应指数走势，表现取决于成份股表现',
    bond: '债券型基金受利率环境和信用市场影响，波动相对平稳',
    qdii: 'QDII基金投资海外市场，受汇率和国际市场双重影响',
    etf: 'ETF基金跟踪指数，流动性好、费用低',
  };
  const fundType = analysis.type || 'mixed';
  parts.push('📋 基金属性：' + (typeAnalysis[fundType] || typeAnalysis.mixed));

  // Daily performance analysis with specific reasoning
  if (daily > 3) {
    parts.push('🔥 今日大涨' + daily.toFixed(2) + '%，强势领涨。可能受益于：所在板块利好消息、行业政策支持、机构资金流入等多重因素共振');
  } else if (daily > 0.5) {
    parts.push('✅ 今日上涨' + daily.toFixed(2) + '%，表现积极。当前市场环境对该基金所在板块偏向利好');
  } else if (daily < -3) {
    parts.push('⚠️ 今日大跌' + Math.abs(daily).toFixed(2) + '%，需重点关注。可能受到：板块调整、行业利空消息、重大事件冲击等影响');
  } else if (daily < -0.5) {
    parts.push('⚠️ 今日下跌' + Math.abs(daily).toFixed(2) + '%，属于正常波动范围。可能受短期市场情绪、获利回吐等因素影响');
  } else {
    parts.push('📌 今日波动平稳，市场多空博弈均趋于谨慎');
  }

  // Trend analysis
  if (r7 !== null && r7 > 5) {
    parts.push('📈 近7天累计涨' + r7.toFixed(2) + '%，短期势头强劲，可能受益于持续的行业景气度提升或政策利好密集发酵');
  } else if (r7 !== null && r7 < -5) {
    parts.push('📉 近7天累计跌' + Math.abs(r7).toFixed(2) + '%，短期趋势偏弱，可能面临板块轮动调整或资金流出');
  }

  if (r30 !== null && r30 > 10) {
    parts.push('🚀 近30天累计涨' + r30.toFixed(2) + '%，中期表现优秀。可能受益于：所在行业坚持景气、基金经理选股能力强、市场风格与基金策略匹配度高');
  } else if (r30 !== null && r30 < -8) {
    parts.push('📉 近30天累计跌' + Math.abs(r30).toFixed(2) + '%，中期趋势偏弱。可能原因：行业均线下行、重仓股票表现不佳、基金规模贬值等');
  }

  // Risk assessment
  if (dd > 15) {
    parts.push('🚨 最大回撤达' + dd.toFixed(2) + '%，历史风险较高。建议设置止损线或分批出账，降低集中度持有');
  } else if (dd > 10) {
    parts.push('🚨 最大回撤' + dd.toFixed(2) + '%，回撤在可接受范围内，但需关注极端行情下的承受能力');
  }

  if (vol > 2.5) {
    parts.push('📊 日幅波动' + vol.toFixed(2) + '%，波动率较高。适合风险承受能力强、能够承受短期回调的投资者，建议分批建仓降低均价成本');
  }

  // Performance summary
  if (holding.returnPct > 15) {
    parts.push('🎉 累计收益' + holding.returnPct.toFixed(2) + '%，持有价值显著。建议逐步止盈，保留部分底仓交叉操作');
  } else if (holding.returnPct > 5) {
    parts.push('📈 累计收益' + holding.returnPct.toFixed(2) + '%，持有状态良好。可继续持有，关注后续走势变化');
  } else if (holding.returnPct < -5) {
    parts.push('📉 累计亏损' + Math.abs(holding.returnPct).toFixed(2) + '%，需评估持有理由是否仍然充分。建议检查基金基本面和基金经理更换情况');
  }

  return parts;
}

function generatePortfolioSummary(results: AnalysisResult[]): string[] {
  const summary: string[] = [];
  const totalDaily = results.reduce((s, r) => s + r.holding.amount * (r.analysis?.dailyReturn ?? 0) / 100, 0);
  const totalAssets = results.reduce((s, r) => s + r.holding.amount, 0);
  const totalReturn = results.reduce((s, r) => s + r.holding.totalReturn, 0);
  const upFunds = results.filter(r => (r.analysis?.dailyReturn ?? 0) > 0);
  const downFunds = results.filter(r => (r.analysis?.dailyReturn ?? 0) < 0);

  // 1. Market judgment
  if (totalDaily > 50) {
    summary.push('📈 市场判断：今日市场强势上攻，持仓整体盈利' + totalDaily.toFixed(0) + '元。上涨基金' + upFunds.length + '只，下跌' + downFunds.length + '只，多数板块表现积极。');
  } else if (totalDaily > 0) {
    summary.push('📌 市场判断：今日市场小幅上涨，持仓微盈' + totalDaily.toFixed(0) + '元。多空博弈，各板块表现分化。');
  } else if (totalDaily > -50) {
    summary.push('📉 市场判断：今日市场小幅调整，持仓微亏' + Math.abs(totalDaily).toFixed(0) + '元。部分板块承压，需关注支撑位有效性。');
  } else {
    summary.push('⚠️ 市场判断：今日市场明显回调，持仓亏损' + Math.abs(totalDaily).toFixed(0) + '元。多数板块承压，建议减少追涨操作。');
  }

  // 2. Sector analysis
  const typeMap: Record<string, { total: number, count: number, dailyAvg: number }> = {};
  results.forEach(r => {
    const t = r.analysis?.type || r.holding.type || 'unknown';
    if (!typeMap[t]) typeMap[t] = { total: 0, count: 0, dailyAvg: 0 };
    typeMap[t].total += r.holding.amount;
    typeMap[t].count++;
    typeMap[t].dailyAvg += r.analysis?.dailyReturn ?? 0;
  });
  Object.keys(typeMap).forEach(k => { typeMap[k].dailyAvg /= typeMap[k].count; });

  const sorted = Object.entries(typeMap).sort((a, b) => b[1].dailyAvg - a[1].dailyAvg);
  if (sorted.length > 1) {
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    summary.push('📊 板块轮动：' + best[0] + '类基金表现最佳（均涨' + best[1].dailyAvg.toFixed(2) + '%），' + worst[0] + '类基金表现最弱（均跌' + Math.abs(worst[1].dailyAvg).toFixed(2) + '%）。');
  }

  // 3. Top and bottom performers
  const sortedByReturn = [...results].sort((a, b) => (b.analysis?.dailyReturn ?? 0) - (a.analysis?.dailyReturn ?? 0));
  if (sortedByReturn.length >= 2) {
    const best = sortedByReturn[0];
    const worst = sortedByReturn[sortedByReturn.length - 1];
    summary.push('🎯 个基表现：' + best.holding.name + '涨幅最大（+' + (best.analysis?.dailyReturn?.toFixed(2) || '0') + '%，贡献+' + (best.holding.amount * (best.analysis?.dailyReturn ?? 0) / 100).toFixed(0) + '元）；' + worst.holding.name + '跌幅最大（' + (worst.analysis?.dailyReturn?.toFixed(2) || '0') + '%，担颍' + Math.abs(worst.holding.amount * (worst.analysis?.dailyReturn ?? 0) / 100).toFixed(0) + '元）。');
  }

  // 4. Concentration risk
  const maxWeight = Math.max(...results.map(r => (r.holding.amount / totalAssets) * 100));
  const maxFund = results.find(r => (r.holding.amount / totalAssets) * 100 === maxWeight);
  if (maxWeight > 30) {
    summary.push('🚨 集中度风险：' + maxFund?.holding.name + '占比' + maxWeight.toFixed(1) + '%，单一基金仓位过高。建议分散投资，单只基金不超过30%。');
  }

  // 5. Action recommendations
  const recs: string[] = [];
  const buyFunds = results.filter(r => r.recommendation === 'buy_more');
  const sellFunds = results.filter(r => r.recommendation === 'reduce' || r.recommendation === 'sell');
  if (buyFunds.length > 0) {
    recs.push('加仓候选：' + buyFunds.map(r => r.holding.name).join('、'));
  }
  if (sellFunds.length > 0) {
    recs.push('减仓候选：' + sellFunds.map(r => r.holding.name).join('、'));
  }
  if (recs.length > 0) {
    summary.push('📋 操作建议：' + recs.join('。') + '。其余基金建议维持现有仓位。');
  } else {
    summary.push('📋 操作建议：当前无明确加减仓信号，建议维持现有仓位，关注明日异动。');
  }

  return summary;
}
function getRecommendColor(rec: string) {
  switch (rec) {
    case 'buy_more': return { bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.3)', text: '#34d399', label: '\u52a0\u4ed3' };
    case 'hold': return { bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.3)', text: '#818cf8', label: '\u6301\u6709' };
    case 'reduce': return { bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)', text: '#fbbf24', label: '\u51cf\u4ed3' };
    case 'sell': return { bg: 'rgba(251,113,133,0.1)', border: 'rgba(251,113,133,0.3)', text: '#fb7185', label: '\u5356\u51fa' };
    default: return { bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.3)', text: '#818cf8', label: '\u6301\u6709' };
  }
}

function FundAnalysisCard({ result, onNavigate }: { result: AnalysisResult; onNavigate: (code: string) => void }) {
  
  const { holding, analysis, aiInsight, recommendation, loading, error } = result;

  if (loading) {
    return (
      <div className="rounded-2xl p-5 animate-pulse" style={{ background: 'rgba(15,20,40,0.8)', border: '1px solid rgba(99,118,168,0.1)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl" style={{ background: 'rgba(99,102,241,0.2)' }} />
          <div className="flex-1">
            <div className="h-4 rounded mb-2" style={{ background: 'rgba(99,102,241,0.2)', width: '60%' }} />
            <div className="h-3 rounded" style={{ background: 'rgba(99,102,241,0.1)', width: '40%' }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="rounded-2xl p-5" style={{ background: 'rgba(15,20,40,0.8)', border: '1px solid rgba(251,113,133,0.2)' }}>
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" style={{ color: '#fb7185' }} />
          <div>
            <div className="font-semibold text-white">{holding.name}</div>
            <div className="text-xs" style={{ color: '#fb7185' }}>{error || '\u65e0\u6cd5\u83b7\u53d6\u5206\u6790\u6570\u636e'}</div>
          </div>
        </div>
      </div>
    );
  }

  const recColor = getRecommendColor(recommendation);
  const isPositive = (analysis?.dailyReturn ?? holding.dailyReturn) >= 0;

  return (
    <div className="rounded-2xl overflow-hidden transition-all duration-300" style={{ background: 'rgba(15,20,40,0.8)', border: '1px solid rgba(99,118,168,0.1)' }}>
      <div className="p-5 cursor-pointer" >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style={{
              background: isPositive ? 'rgba(52,211,153,0.15)' : 'rgba(251,113,133,0.15)',
              color: isPositive ? '#34d399' : '#fb7185'
            }}>
              {holding.code.slice(-2)}
            </div>
            <div>
              <div className="font-semibold text-white text-sm">{holding.name}</div>
              <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>{holding.code} {'\u00b7'} {analysis.type} {'\u00b7'} {analysis.manager || '\u5f85\u66f4\u65b0'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: recColor.bg, border: '1px solid ' + recColor.border, color: recColor.text }}>
              {recColor.label}
            </div>

          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl" style={{ background: 'rgba(99,102,241,0.06)' }}>
            <div className="text-[10px] mb-1" style={{ color: '#64748b' }}>{'\u4eca\u65e5\u6536\u76ca'}</div>
            <div className="text-lg font-bold" style={{ color: isPositive ? '#34d399' : '#fb7185' }}>
              {isPositive ? '+' : ''}{formatMoney(holding.amount * (analysis?.dailyReturn ?? holding.dailyReturn) / 100)}
            </div>
            <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: isPositive ? '#34d399' : '#fb7185' }}>
              {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {(analysis?.dailyReturn ?? holding.dailyReturn) >= 0 ? '+' : ''}{(analysis?.dailyReturn ?? holding.dailyReturn).toFixed(2)}%
            </div>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'rgba(99,102,241,0.06)' }}>
            <div className="text-[10px] mb-1" style={{ color: '#64748b' }}>{'\u7d2f\u8ba1\u6536\u76ca'}</div>
            <div className="text-lg font-bold" style={{ color: holding.totalReturn >= 0 ? '#34d399' : '#fb7185' }}>
              {holding.totalReturn >= 0 ? '+' : ''}{formatMoney(holding.totalReturn)}
            </div>
            <div className="text-xs mt-0.5" style={{ color: holding.returnPct >= 0 ? '#34d399' : '#fb7185' }}>
              {holding.returnPct >= 0 ? '+' : ''}{holding.returnPct.toFixed(2)}%
            </div>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'rgba(99,102,241,0.06)' }}>
            <div className="text-[10px] mb-1" style={{ color: '#64748b' }}>{'\u6700\u5927\u56de\u64a4'}</div>
            <div className="text-lg font-bold" style={{ color: '#fb7185' }}>{analysis.maxDrawdown}%</div>
            <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>{'\u6ce2\u52a8\u7387 '}{analysis.volatility}%</div>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'rgba(99,102,241,0.06)' }}>
            <div className="text-[10px] mb-1" style={{ color: '#64748b' }}>{'\u6301\u4ed3\u91d1\u989d'}</div>
            <div className="text-lg font-bold text-white">{'\u00a5'}{formatMoney(holding.amount)}</div>
            <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>{'\u5f53\u524d\u51c0\u503c '}{analysis.currentNav.toFixed(4)}</div>
          </div>
        </div>
      </div>

      {/* Detailed analysis - always visible */}
        <div className="px-5 pb-4 space-y-3" style={{ borderTop: '1px solid rgba(99,118,168,0.08)' }}>
          <div className="mt-4 p-4 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(129,140,248,0.04))', border: '1px solid rgba(99,102,241,0.15)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4" style={{ color: '#818cf8' }} />
              <span className="text-xs font-semibold" style={{ color: '#818cf8' }}>{'\u57fa\u91d1\u5206\u6790'}</span>
            </div>
            <div className="text-xs leading-relaxed space-y-1.5">
              {aiInsight.split('\n').map((line: string, i: number) => (
                <div key={i} style={{ color: '#cbd5e1' }}>{line}</div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-lg text-center" style={{ background: 'rgba(99,102,241,0.06)' }}>
              <div className="text-[10px] mb-0.5" style={{ color: '#64748b' }}>{'\u5f53\u524d\u51c0\u503c'}</div>
              <div className="text-sm font-bold text-white">{analysis.currentNav.toFixed(4)}</div>
            </div>
            <div className="p-2.5 rounded-lg text-center" style={{ background: 'rgba(99,102,241,0.06)' }}>
              <div className="text-[10px] mb-0.5" style={{ color: '#64748b' }}>{'\u8fd17\u5929'}</div>
              <div className="text-sm font-bold" style={{ color: (analysis.return7d || 0) >= 0 ? '#34d399' : '#fb7185' }}>
                {analysis.return7d !== null ? ((analysis.return7d >= 0 ? '+' : '') + analysis.return7d.toFixed(2) + '%') : '--'}
              </div>
            </div>
            <div className="p-2.5 rounded-lg text-center" style={{ background: 'rgba(99,102,241,0.06)' }}>
              <div className="text-[10px] mb-0.5" style={{ color: '#64748b' }}>{'\u8fd130\u5929'}</div>
              <div className="text-sm font-bold" style={{ color: (analysis.return30d || 0) >= 0 ? '#34d399' : '#fb7185' }}>
                {analysis.return30d !== null ? ((analysis.return30d >= 0 ? '+' : '') + analysis.return30d.toFixed(2) + '%') : '--'}
              </div>
            </div>
          </div>
          {analysis.recentPerformance && analysis.recentPerformance.length > 0 && (
            <div className="p-3 rounded-xl" style={{ background: 'rgba(99,102,241,0.06)' }}>
              <div className="text-[10px] mb-2" style={{ color: '#64748b' }}>{'\u8fd1\u671f\u51c0\u503c\u8d70\u52bf'}</div>
              <div className="flex gap-2 overflow-x-auto">
                {analysis.recentPerformance.map((p, i) => (
                  <div key={i} className="flex-shrink-0 text-center p-2 rounded-lg" style={{ background: 'rgba(99,102,241,0.08)' }}>
                    <div className="text-[10px]" style={{ color: '#64748b' }}>{p.date}</div>
                    <div className="text-xs font-bold text-white mt-1">{p.nav.toFixed(4)}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: p.return >= 0 ? '#34d399' : '#fb7185' }}>
                      {p.return >= 0 ? '+' : ''}{p.return.toFixed(2)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => onNavigate(holding.code)} className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
              {'\u67e5\u770b\u8be6\u60c5'}
            </button>
            <button onClick={() => onNavigate(holding.code)} className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
              {'AI \u8bca\u65ad'}
            </button>
          </div>
        </div>
    </div>
  );
}

export function DailyAnalysis() {
  const navigate = useNavigate();
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [overallSummary, setOverallSummary] = useState<string>('');

  const holdings = loadHoldings();

  useEffect(() => { analyzeAllHoldings(); }, []);

  async function analyzeAllHoldings() {
    setLoading(true);
    const initialResults: AnalysisResult[] = holdings.map(h => ({
      holding: h, analysis: null, aiInsight: '', recommendation: 'hold' as const, loading: true, error: '',
    }));
    setResults(initialResults);

    const updatedResults = [...initialResults];
    for (let i = 0; i < holdings.length; i++) {
      const h = holdings[i];
      try {
        const res = await fetch('/api/analysis/fund', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fundCode: h.code, fundName: h.name, amount: h.amount, shares: h.shares }),
        });
        if (res.ok) {
          const data = await res.json();
          // Use real-time daily return from API
          const updatedHolding = { ...h, dailyReturn: data.dailyReturn || h.dailyReturn };
          const recommendation = getRecommendation(data, updatedHolding);
          const aiInsight = generateFundDetail(data, h, []).join('\n');
          updatedResults[i] = { holding: updatedHolding, analysis: data, aiInsight, recommendation, loading: false, error: '' };
        } else {
          updatedResults[i] = { ...updatedResults[i], loading: false, error: '\u670d\u52a1\u5668\u9519\u8bef' };
        }
      } catch {
        updatedResults[i] = { ...updatedResults[i], loading: false, error: '\u7f51\u7edc\u9519\u8bef' };
      }
      setResults([...updatedResults]);
    }

    generatePortfolioSummary2(updatedResults);
    setLoading(false);
  }

  function generatePortfolioSummary2(results: AnalysisResult[]) {
    setOverallSummary(JSON.stringify(generatePortfolioSummary(results)));
  }
  const summary = overallSummary ? JSON.parse(overallSummary) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Activity className="w-7 h-7" style={{ color: '#818cf8' }} />
            {'\u6bcf\u65e5\u6301\u4ed3\u5206\u6790'}
          </h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>{'AI \u667a\u80fd\u5206\u6790\u6bcf\u53ea\u6301\u4ed3\u57fa\u91d1\uff0c\u63d0\u4f9b\u4e70\u5356\u5efa\u8bae'}</p>
        </div>
        <button onClick={analyzeAllHoldings} disabled={loading} className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {'\u5237\u65b0\u5206\u6790'}
        </button>
      </div>

      {summary && (
        <div className="rounded-2xl p-6" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(129,140,248,0.06))', border: '1px solid rgba(99,102,241,0.2)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5" style={{ color: '#818cf8' }} />
            <span className="text-lg font-bold text-white">{'\u6301\u4ed3\u603b\u89c8'}</span>
          </div>
          <div className="space-y-2">
            {summary.map((line: string, i: number) => (
              <div key={i} className="text-sm leading-relaxed" style={{ color: '#cbd5e1' }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4">
      {/* Daily Analysis Detail Section */}
      {results.length > 0 && results.some(r => r.analysis) && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(52,211,153,0.05))', border: '1px solid rgba(99,118,168,0.15)' }}>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span style={{ fontSize: 20 }}>{'\u{1f4ca}'}</span> {'\u4eca\u65e5\u57fa\u91d1\u6536\u76ca\u5206\u6790'}
          </h2>

          {/* Per-fund daily P&L breakdown */}
          <div className="rounded-xl p-4" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(99,118,168,0.1)' }}>
            <h3 className="text-sm font-semibold text-white mb-3">{'\u4eca\u65e5\u6536\u76ca\u660e\u7ec6'}</h3>
            <div className="space-y-2">
              {results.filter(r => r.analysis).sort((a, b) => ((b.analysis?.dailyReturn ?? 0) * b.holding.amount) - ((a.analysis?.dailyReturn ?? 0) * a.holding.amount)).map(r => {
                const dailyPnl = r.holding.amount * (r.analysis?.dailyReturn ?? 0) / 100;
                const isUp = dailyPnl >= 0;
                return (
                  <div key={r.holding.code} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid rgba(99,118,168,0.06)' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: isUp ? '#34d399' : '#fb7185' }} />
                      <span className="text-xs text-white" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.holding.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs" style={{ color: '#64748b' }}>{r.analysis?.dailyReturn?.toFixed(2)}%</span>
                      <span className="text-xs font-bold" style={{ color: isUp ? '#34d399' : '#fb7185', minWidth: 60, textAlign: 'right' }}>`{isUp ? '+' : ''}{dailyPnl.toFixed(2)}`</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sector/Type Analysis */}
          <div className="rounded-xl p-4" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(99,118,168,0.1)' }}>
            <h3 className="text-sm font-semibold text-white mb-3">{'\u677f\u5757\u8f6e\u52a8\u5206\u6790'}</h3>
            <div className="grid grid-cols-2 gap-3">
              {(() => {
                const typeMap: Record<string, { names: string[], dailyTotal: number, count: number }> = {};
                results.filter(r => r.analysis).forEach(r => {
                  const t = r.analysis?.type || 'unknown';
                  if (!typeMap[t]) typeMap[t] = { names: [], dailyTotal: 0, count: 0 };
                  typeMap[t].names.push(r.holding.name);
                  typeMap[t].dailyTotal += r.holding.amount * (r.analysis?.dailyReturn ?? 0) / 100;
                  typeMap[t].count++;
                });
                return Object.entries(typeMap).map(([type, data]) => (
                  <div key={type} className="p-3 rounded-lg" style={{ background: 'rgba(99,102,241,0.06)' }}>
                    <div className="text-[10px] mb-1" style={{ color: '#64748b' }}>{type}</div>
                    <div className="text-sm font-bold" style={{ color: data.dailyTotal >= 0 ? '#34d399' : '#fb7185' }}>`{data.dailyTotal >= 0 ? '+' : ''}{data.dailyTotal.toFixed(2)}`</div>
                    <div className="text-[10px] mt-0.5" style={{ color: '#64748b' }}>{data.count}{'\u53ea\u57fa\u91d1'}</div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Market Summary & Recommendation */}
          <div className="rounded-xl p-4" style={{ background: 'rgba(15,20,40,0.6)', border: '1px solid rgba(99,118,168,0.1)' }}>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <span>{'\u{1f3af}'}</span> {'\u7efc\u5408\u5efa\u8bae'}
            </h3>
            <div className="text-xs leading-relaxed space-y-2" style={{ color: '#cbd5e1' }}>
              {(() => {
                const totalDaily = results.reduce((s, r) => s + r.holding.amount * (r.analysis?.dailyReturn ?? 0) / 100, 0);
                const upFunds = results.filter(r => (r.analysis?.dailyReturn ?? 0) > 0);
                const downFunds = results.filter(r => (r.analysis?.dailyReturn ?? 0) < 0);
                const bestFund = results.reduce((best, r) => (r.analysis?.dailyReturn ?? 0) > (best.analysis?.dailyReturn ?? 0) ? r : best, results[0]);
                const worstFund = results.reduce((worst, r) => (r.analysis?.dailyReturn ?? 0) < (worst.analysis?.dailyReturn ?? 0) ? r : worst, results[0]);
                const suggestions: string[] = [];
                if (totalDaily > 0) {
                  suggestions.push('\u{1f4c8} \u4eca\u65e5\u6301\u4ed3\u6574\u4f53\u76c8\u5229\uff0c\u5e02\u573a\u60c5\u7eea\u79ef\u6781\u3002\u4e0a\u6da8\u57fa\u91d1\u5360\u6bd4' + upFunds.length + '/' + results.length + '\uff0c\u5176\u4e2d' + bestFund.holding.name + '\u8868\u73b0\u6700\u4f73\uff08+' + (bestFund.analysis?.dailyReturn?.toFixed(2) || '0') + '%\uff09\u3002');
                } else {
                  suggestions.push('\u{1f4c9} \u4eca\u65e5\u6301\u4ed3\u6574\u4f53\u4e8f\u635f\uff0c\u9700\u5173\u6ce8\u5e02\u573a\u98ce\u9669\u3002\u4e0b\u8dcc\u57fa\u91d1\u5360\u6bd4' + downFunds.length + '/' + results.length + '\uff0c\u5176\u4e2d' + worstFund.holding.name + '\u8dcc\u5e45\u6700\u5927\uff08' + (worstFund.analysis?.dailyReturn?.toFixed(2) || '0') + '%\uff09\u3002');
                }
                const bigGain = results.filter(r => (r.analysis?.dailyReturn ?? 0) > 3);
                const bigLoss = results.filter(r => (r.analysis?.dailyReturn ?? 0) < -2);
                if (bigGain.length > 0) {
                  suggestions.push('\u{1f525} \u5f3a\u52bf\u57fa\u91d1\uff1a' + bigGain.map(r => r.holding.name + '(+' + (r.analysis?.dailyReturn?.toFixed(2) || '0') + '%)').join('\u3001') + '\uff0c\u53ef\u5173\u6ce8\u6301\u7eed\u8d70\u52bf\u3002');
                }
                if (bigLoss.length > 0) {
                  suggestions.push('\u26a0\ufe0f \u5f31\u52bf\u57fa\u91d1\uff1a' + bigLoss.map(r => r.holding.name + '(' + (r.analysis?.dailyReturn?.toFixed(2) || '0') + '%)').join('\u3001') + '\uff0c\u5efa\u8bae\u5173\u6ce8\u56de\u64a4\u98ce\u9669\u3002');
                }
                const bondFund = results.find(r => r.analysis?.type === 'bond' || r.holding.type === '\u503a\u5238\u578b');
                if (bondFund) {
                  suggestions.push('\u{1f6e1}\ufe0f \u9632\u5b88\u8d44\u4ea7\uff1a' + bondFund.holding.name + '\u4eca\u65e5\u6536\u76ca\u7a33\u5b9a\uff0c\u4f5c\u4e3a\u7ec4\u5408\u538b\u8f66\u77f3\u4fdd\u6301\u73b0\u6709\u4ed3\u4f4d\u5373\u53ef\u3002');
                }
                suggestions.push('\u{1f4cb} \u64cd\u4f5c\u5efa\u8bae\uff1a' + (totalDaily > 0 ? '\u4eca\u65e5\u76c8\u5229\u826f\u597d\uff0c\u53ef\u7ee7\u7eed\u6301\u6709\uff0c\u5173\u6ce8\u660e\u65e5\u8d70\u52bf' : '\u4eca\u65e5\u56de\u8c03\uff0c\u5efa\u8bae\u89c2\u671b\u4e3a\u4e3b\uff0c\u907f\u514d\u8ffd\u6da8\u6740\u8dcc'));
                return suggestions.map((s, i) => <div key={i}>{s}</div>);
              })()}
            </div>
          </div>

          {/* Risk Alert */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
            <div className="flex items-start gap-2">
              <span>{'\u26a0\ufe0f'}</span>
              <div className="text-xs leading-relaxed" style={{ color: '#fbbf24' }}>
                {'\u98ce\u9669\u63d0\u793a\uff1a\u57fa\u91d1\u6295\u8d44\u6709\u98ce\u9669\uff0c\u4ee5\u4e0a\u5206\u6790\u4ec5\u4f9b\u53c2\u8003\uff0c\u4e0d\u6784\u6210\u6295\u8d44\u5efa\u8bae\u3002\u8bf7\u6839\u636e\u81ea\u8eab\u98ce\u9669\u627f\u53d7\u80fd\u529b\u548c\u6295\u8d44\u76ee\u6807\u505a\u51fa\u51b3\u7b56\u3002'}</div>
            </div>
          </div>
        </div>
      )}

        {results.map((result) => (
          <FundAnalysisCard key={result.holding.code} result={result} onNavigate={(code) => navigate('/fund/' + code)} />
        ))}
      </div>

      {loading && results.length === 0 && (
        <div className="text-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: '#818cf8' }} />
          <div className="text-sm" style={{ color: '#64748b' }}>{'\u6b63\u5728\u5206\u6790\u6301\u4ed3\u57fa\u91d1...'}</div>
        </div>
      )}
    </div>
  );
}
