import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, Wallet, Activity, AlertTriangle,
  Brain, Target, Shield, Eye, DollarSign,
  Package, ArrowUpRight, PieChart as PieChartIcon, Zap,
} from 'lucide-react';

const API = '/api';
const INITIAL_CAPITAL = 1000000;

interface Holding {
  code: string;
  name: string;
  shares: number;
  avgCost: number;
  currentNav: number;
  marketValue: number;
  todayPnl: number;
  todayPnlPercent: number;
  pnl: number;
  pnlPercent: number;
}

interface DashboardData {
  totalAssets: number;
  totalPnl: number;
  totalPnlPercent: number;
  todayPnl: number;
  todayPnlPercent: number;
  cashBalance: number;
  holdingsCount: number;
  holdings: Holding[];
  aiSummary?: string;
  recentDecisions?: { action: string; fund: string; reason: string; time: string }[];
  dailyReturns?: { date: string; ret: number }[];
}

interface MarketIndex {
  name: string;
  code: string;
  current: number;
  change: number;
  changePercent: number;
}

function fmt(n: number) {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPnl(n: number) {
  return (n >= 0 ? '+' : '') + fmt(n);
}
function pnlColor(n: number) {
  return n >= 0 ? '#22c55e' : '#ef4444';
}

function AssetCurveChart({ history }: { history: { date: string; ret: number }[] }) {
  const [range, setRange] = useState<'week' | 'month' | 'all'>('all');
  const filtered = useMemo(() => {
    if (range === 'week') return history.slice(-7);
    if (range === 'month') return history.slice(-30);
    return history;
  }, [history, range]);

  if (filtered.length < 2) return <div className="text-sm" style={{ color: '#64748b' }}>数据不足</div>;

  const values = filtered.map(p => p.ret);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rangeVal = max - min || 1;
  const W = 600, H = 200, PAD = 40;

  const pts = filtered.map((p, i) => {
    const x = PAD + (i / (filtered.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((p.ret - min) / rangeVal) * (H - PAD * 2);
    return { x, y, ...p };
  });

  const linePath = pts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
  const areaPath = linePath + ` L${pts[pts.length - 1].x},${H - PAD} L${pts[0].x},${H - PAD} Z`;
  const isUp = values[values.length - 1] >= values[0];

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(pct => {
    const y = H - PAD - pct * (H - PAD * 2);
    const val = min + pct * rangeVal;
    return { y, val };
  });

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {(['week', 'month', 'all'] as const).map(r => (
          <button key={r} onClick={() => setRange(r)}
            className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
            style={{
              background: range === r ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: range === r ? '#818cf8' : '#64748b',
              border: range === r ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
            }}>
            {r === 'week' ? '本周' : r === 'month' ? '本月' : '全部'}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }}>
        <defs>
          <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isUp ? '#22c55e' : '#ef4444'} stopOpacity="0.2" />
            <stop offset="100%" stopColor={isUp ? '#22c55e' : '#ef4444'} stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={PAD} y1={g.y} x2={W - PAD} y2={g.y} stroke="rgba(99,102,241,0.06)" strokeDasharray="4,4" />
            <text x={PAD - 4} y={g.y + 3} textAnchor="end" fill="#475569" fontSize="9" fontFamily="var(--font-mono)">
              {fmt(g.val)}
            </text>
          </g>
        ))}
        <path d={areaPath} fill="url(#curveGrad)" />
        <path d={linePath} fill="none" stroke={isUp ? '#22c55e' : '#ef4444'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.length > 0 && (
          <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="4"
            fill={isUp ? '#22c55e' : '#ef4444'} stroke="#111729" strokeWidth="2" />
        )}
      </svg>
    </div>
  );
}

function AssetPieChart({ holdings, cash }: { holdings: Holding[]; cash: number }) {
  const total = holdings.reduce((s, h) => s + h.marketValue, 0) + cash;
  if (total <= 0) return null;
  const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308', '#f97316', '#ef4444', '#ec4899'];
  const sorted = [...holdings].sort((a, b) => b.marketValue - a.marketValue).slice(0, 7);
  let cumAngle = -90;
  const segments = sorted.map((h, i) => {
    const pct = h.marketValue / total;
    const angle = pct * 360;
    const start = cumAngle;
    cumAngle += angle;
    return { name: h.name.slice(0, 6), pct, color: colors[i % colors.length], startAngle: start, angle };
  });
  if (cash > 0 && cash / total > 0.01) {
    segments.push({ name: '现金', pct: cash / total, color: '#475569', startAngle: cumAngle, angle: (cash / total) * 360 });
  }
  const cx = 80, cy = 80, r = 65;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 160 160" style={{ width: 150, height: 150, flexShrink: 0 }}>
        {segments.map((seg, i) => {
          if (seg.angle < 1) return null;
          const s = (seg.startAngle * Math.PI) / 180;
          const e = ((seg.startAngle + seg.angle) * Math.PI) / 180;
          const large = seg.angle > 180 ? 1 : 0;
          return <path key={i} d={`M${cx},${cy} L${cx + r * Math.cos(s)},${cy + r * Math.sin(s)} A${r},${r} 0 ${large},1 ${cx + r * Math.cos(e)},${cy + r * Math.sin(e)} Z`} fill={seg.color} opacity="0.85" />;
        })}
        <circle cx={cx} cy={cy} r="35" fill="#111729" />
        <text x={cx} y={cy - 4} textAnchor="middle" fill="#f1f5f9" fontSize="14" fontWeight="bold">{holdings.length}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="#64748b" fontSize="9">只基金</text>
      </svg>
      <div className="flex-1 space-y-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
            <span className="text-xs truncate" style={{ color: '#94a3b8', maxWidth: 70 }}>{seg.name}</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(99,102,241,0.08)' }}>
              <div className="h-full rounded-full" style={{ width: `${seg.pct * 100}%`, background: seg.color, opacity: 0.7 }} />
            </div>
            <span className="text-xs font-mono" style={{ color: '#94a3b8' }}>{(seg.pct * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HoldingsBar({ holding }: { holding: Holding }) {
  const isUp = holding.todayPnl >= 0;
  const barWidth = Math.min(Math.abs(holding.todayPnlPercent) * 20, 100);
  return (
    <div className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid rgba(99,102,241,0.06)' }}>
      <div className="w-32 shrink-0">
        <div className="text-xs font-medium truncate" style={{ color: '#e2e8f0' }}>{holding.name.slice(0, 10)}</div>
        <div className="text-[10px] font-mono" style={{ color: '#64748b' }}>{holding.code}</div>
      </div>
      <div className="flex-1 relative h-5 rounded-full overflow-hidden" style={{ background: 'rgba(99,102,241,0.05)' }}>
        <div className="absolute top-0 h-full rounded-full transition-all duration-500"
          style={{
            width: `${barWidth}%`,
            background: isUp
              ? 'linear-gradient(90deg, rgba(34,197,94,0.3), rgba(34,197,94,0.6))'
              : 'linear-gradient(270deg, rgba(239,68,68,0.3), rgba(239,68,68,0.6))',
            ...(isUp ? { left: '50%' } : { right: '50%' }),
          }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-4" style={{ background: 'rgba(99,102,241,0.2)' }} />
      </div>
      <span className="w-16 text-right text-xs font-mono font-semibold" style={{ color: pnlColor(holding.todayPnl) }}>
        {fmtPnl(holding.todayPnlPercent)}%
      </span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="py-4 md:py-6 space-y-4">
      <div className="skeleton h-12 rounded-xl" />
      <div className="flex gap-2">{[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton h-28 flex-1 rounded-xl" />)}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="skeleton h-64 rounded-xl" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
      <div className="skeleton h-48 rounded-xl" />
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [indices, setIndices] = useState<{ updateTime: string; indices: MarketIndex[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    Promise.all([
      fetch(API + '/portfolio/dashboard').then(r => r.json()).catch(() => null),
      fetch(API + '/market/indices').then(r => r.json()).catch(() => null),
    ]).then(([d, idx]) => { if (d) setData(d); if (idx) setIndices(idx); setLoading(false); });
  }, []);

  if (loading || !data) return <DashboardSkeleton />;

  const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const isMarketOpen = now.getHours() >= 9 && now.getHours() < 15 && now.getDay() > 0 && now.getDay() < 6;
  const positionRatio = data.totalAssets > 0 ? ((data.totalAssets - data.cashBalance) / data.totalAssets * 100) : 0;

  const metricCards = [
    { label: '模拟总资产', value: '¥' + fmt(data.totalAssets), sub: '初始 ¥' + fmt(INITIAL_CAPITAL), icon: Wallet, color: '#6366f1' },
    { label: '累计盈亏', value: fmtPnl(data.totalPnl), sub: fmtPnl(data.totalPnlPercent) + '% 总收益', icon: TrendingUp, color: data.totalPnl >= 0 ? '#22c55e' : '#ef4444' },
    { label: '今日盈亏', value: fmtPnl(data.todayPnl), sub: fmtPnl(data.todayPnlPercent) + '%', icon: Activity, color: data.todayPnl >= 0 ? '#22c55e' : '#ef4444' },
    { label: '现金余额', value: '¥' + fmt(data.cashBalance), sub: '仓位 ' + positionRatio.toFixed(0) + '%', icon: DollarSign, color: '#06b6d4' },
    { label: '持仓数量', value: data.holdingsCount + ' 只', sub: data.holdingsCount > 0 ? '持仓中' : '空仓', icon: Package, color: '#8b5cf6' },
  ];

  const quickActions = [
    { label: 'AI诊断', desc: '智能诊断持仓风险与收益', icon: Target, color: '#6366f1', path: '/diagnosis/110011' },
    { label: 'AI辩论', desc: '多空观点碰撞辅助决策', icon: Brain, color: '#8b5cf6', path: '/debate' },
    { label: '模拟交易', desc: '虚拟资金模拟实战演练', icon: Zap, color: '#06b6d4', path: '/simtrade' },
    { label: '风险监控', desc: '实时监控投资组合风险', icon: Shield, color: '#f59e0b', path: '/risk' },
  ];

  return (
    <div className="py-4 md:py-6 space-y-4 animate-fade-in max-w-[1200px] mx-auto">

      {/* Risk Disclaimer */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.12)' }}>
        <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#eab308' }} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]" style={{ color: '#94a3b8' }}>
          <span style={{ color: '#eab308', fontWeight: 600 }}>风险提示</span>
          <span>|</span>
          <span>模拟交易使用虚拟资金，不涉及真实资金交易，仅供学习参考</span>
          <span className="hidden md:inline">· 投资有风险，入市需谨慎</span>
        </div>
      </div>

      {/* Date & Status */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm" style={{ color: '#94a3b8' }}>{dateStr}</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs" style={{ color: isMarketOpen ? '#22c55e' : '#64748b' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: isMarketOpen ? '#22c55e' : '#475569', boxShadow: isMarketOpen ? '0 0 6px rgba(34,197,94,0.4)' : 'none' }} />
            {isMarketOpen ? '交易时段' : '非交易时段'}
          </span>
          <span className="text-xs font-mono" style={{ color: '#64748b' }}>{timeStr}</span>
        </div>
      </div>

      {/* 5 Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {metricCards.map((item, i) => (
          <div key={i} className="stat-card animate-fade-in" style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}>
            <div className="flex items-start justify-between mb-2">
              <div className="p-1.5 rounded-lg" style={{ background: `${item.color}12` }}>
                <item.icon className="w-4 h-4" style={{ color: item.color }} />
              </div>
            </div>
            <div className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: '#64748b' }}>{item.label}</div>
            <div className="text-xl font-bold tracking-tight" style={{ color: item.color, fontFamily: 'var(--font-mono)' }}>{item.value}</div>
            <div className="text-[11px] mt-1" style={{ color: '#64748b' }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Market Indices Strip */}
      {indices && indices.indices.length > 0 && (
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
          {indices.indices.map((idx, i) => (
            <div key={i} className="glass-card px-4 py-2.5 flex items-center gap-3 shrink-0" style={{ minWidth: 160 }}>
              <div>
                <div className="text-xs font-medium" style={{ color: '#94a3b8' }}>{idx.name}</div>
                <div className="text-sm font-mono font-bold" style={{ color: '#e2e8f0' }}>{idx.current.toFixed(2)}</div>
              </div>
              <span className="text-xs font-mono font-semibold" style={{ color: pnlColor(idx.changePercent) }}>
                {fmtPnl(idx.changePercent)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* AI Decision Summary */}
      {data.aiSummary && (
        <div className="glass-card p-5 animate-fade-in" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg" style={{ background: 'rgba(139,92,246,0.1)' }}>
              <Brain className="w-4 h-4" style={{ color: '#8b5cf6' }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: '#c4b5fd' }}>AI 决策摘要</span>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-mono" style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>LIVE</span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>{data.aiSummary}</p>
          {data.recentDecisions && data.recentDecisions.length > 0 && (
            <div className="mt-4 space-y-2">
              {data.recentDecisions.slice(0, 3).map((d, i) => (
                <div key={i} className="flex items-start gap-3 text-xs">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0"
                    style={{
                      background: d.action === '买入' ? 'rgba(34,197,94,0.12)' : d.action === '卖出' ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)',
                      color: d.action === '买入' ? '#22c55e' : d.action === '卖出' ? '#ef4444' : '#818cf8',
                    }}>
                    {d.action}
                  </span>
                  <span style={{ color: '#e2e8f0' }}>{d.fund}</span>
                  <span className="flex-1" style={{ color: '#64748b' }}>{d.reason}</span>
                  <span className="shrink-0 font-mono" style={{ color: '#475569' }}>{d.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="glass-card p-5 animate-fade-in" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4" style={{ color: '#6366f1' }} />
            <span className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>资产曲线</span>
          </div>
          {data.dailyReturns && data.dailyReturns.length > 1 ? (
            <AssetCurveChart history={data.dailyReturns} />
          ) : (
            <div className="flex items-center justify-center h-40 text-xs" style={{ color: '#475569' }}>暂无历史数据</div>
          )}
        </div>
        <div className="glass-card p-5 animate-fade-in" style={{ animationDelay: '350ms', animationFillMode: 'both' }}>
          <div className="flex items-center gap-2 mb-4">
            <PieChartIcon className="w-4 h-4" style={{ color: '#8b5cf6' }} />
            <span className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>资产配置</span>
          </div>
          {data.holdings.length > 0 ? (
            <AssetPieChart holdings={data.holdings} cash={data.cashBalance} />
          ) : (
            <div className="flex items-center justify-center h-40 text-xs" style={{ color: '#475569' }}>暂无持仓</div>
          )}
        </div>
      </div>

      {/* Holdings Daily Performance */}
      {data.holdings.length > 0 && (
        <div className="glass-card p-5 animate-fade-in" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4" style={{ color: '#06b6d4' }} />
            <span className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>持仓今日表现</span>
          </div>
          <div>
            {data.holdings
              .sort((a, b) => Math.abs(b.todayPnlPercent) - Math.abs(a.todayPnlPercent))
              .map(h => <HoldingsBar key={h.code} holding={h} />)}
          </div>
        </div>
      )}

      {/* Holdings Detail Table */}
      {data.holdings.length > 0 && (
        <div className="glass-card p-5 animate-fade-in overflow-x-auto" style={{ animationDelay: '500ms', animationFillMode: 'both' }}>
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-4 h-4" style={{ color: '#06b6d4' }} />
            <span className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>持仓明细</span>
            <span className="text-[10px] ml-auto font-mono" style={{ color: '#475569' }}>共 {data.holdings.length} 只</span>
          </div>
          <table className="w-full text-xs" style={{ minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(99,102,241,0.08)' }}>
                {['基金名称', '基金代码', '持仓份额', '成本净值', '最新净值', '持仓市值', '总盈亏'].map(h => (
                  <th key={h} className="text-left py-2 px-2 font-medium" style={{ color: '#64748b' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.holdings.map(h => (
                <tr key={h.code} className="transition-colors" style={{ borderBottom: '1px solid rgba(99,102,241,0.04)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td className="py-2.5 px-2 font-medium" style={{ color: '#e2e8f0' }}>{h.name.slice(0, 12)}</td>
                  <td className="py-2.5 px-2 font-mono" style={{ color: '#64748b' }}>{h.code}</td>
                  <td className="py-2.5 px-2 font-mono" style={{ color: '#94a3b8' }}>{h.shares.toLocaleString()}</td>
                  <td className="py-2.5 px-2 font-mono" style={{ color: '#94a3b8' }}>{h.avgCost.toFixed(4)}</td>
                  <td className="py-2.5 px-2 font-mono" style={{ color: '#e2e8f0' }}>{h.currentNav.toFixed(4)}</td>
                  <td className="py-2.5 px-2 font-mono" style={{ color: '#e2e8f0' }}>¥{fmt(h.marketValue)}</td>
                  <td className="py-2.5 px-2 font-mono font-semibold" style={{ color: pnlColor(h.pnl) }}>
                    {fmtPnl(h.pnl)} ({fmtPnl(h.pnlPercent)}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickActions.map((a, i) => (
          <div key={i}
            className="glass-card glass-card-interactive p-4 cursor-pointer animate-fade-in group"
            style={{ animationDelay: `${600 + i * 60}ms`, animationFillMode: 'both' }}
            onClick={() => navigate(a.path)}>
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-xl" style={{ background: `${a.color}10` }}>
                <a.icon className="w-5 h-5" style={{ color: a.color }} />
              </div>
              <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: '#64748b' }} />
            </div>
            <div className="text-sm font-semibold mb-1" style={{ color: '#e2e8f0' }}>{a.label}</div>
            <div className="text-[11px]" style={{ color: '#64748b' }}>{a.desc}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center py-4">
        <span className="text-[10px]" style={{ color: '#334155' }}>数据仅供学习参考 · 模拟投资不构成任何投资建议</span>
      </div>
    </div>
  );
}

export default Dashboard;