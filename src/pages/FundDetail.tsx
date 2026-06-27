import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Brain, ShoppingCart, BarChart3, Shield, Award, DollarSign, RefreshCw, LineChart, Activity } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { fetchFundByCode, fetchNavHistory, fetchHoldings } from '@/services/api';
import { formatPercent, formatNav, riskLabel, riskColor, fundTypeLabel } from '@/utils/format';

type TimeRange = '1m' | '3m' | '6m' | '1y' | '3y';
const TIME_LABELS: Record<TimeRange, string> = { '1m': '近1月', '3m': '近3月', '6m': '近6月', '1y': '近1年', '3y': '近3年' };
const COLORS = ['#818cf8', '#34d399', '#fb7185', '#fbbf24', '#06b6d4', '#a78bfa', '#f472b6', '#22d3ee'];

export function FundDetail() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>('1y');
  const [activeTab, setActiveTab] = useState<'performance' | 'nav' | 'holdings' | 'info'>('performance');

  const { data: fund, isLoading: fundLoading } = useQuery({
    queryKey: ['fund', code], queryFn: () => fetchFundByCode(code!), enabled: !!code,
  });

  const { data: navHistory = [] } = useQuery({
    queryKey: ['nav', code], queryFn: () => fetchNavHistory(code!, 1095), enabled: !!code,
  });

  const { data: holdings = [] } = useQuery({
    queryKey: ['holdings', code], queryFn: () => fetchHoldings(code!), enabled: !!code,
  });

  const filteredNav = useMemo(() => {
    if (!navHistory.length) return [];
    const now = Date.now();
    const ranges: Record<TimeRange, number> = { '1m': 30, '3m': 90, '6m': 180, '1y': 365, '3y': 1095 };
    const cutoff = now - ranges[timeRange] * 86400 * 1000;
    return navHistory.filter((n: any) => new Date(n.date).getTime() >= cutoff);
  }, [navHistory, timeRange]);

  const metrics = useMemo(() => {
    if (filteredNav.length < 2) return null;
    const first = filteredNav[0].nav;
    const last = filteredNav[filteredNav.length - 1].nav;
    const periodReturn = ((last - first) / first) * 100;
    let maxDD = 0, peak = first;
    for (const p of filteredNav) {
      if (p.nav > peak) peak = p.nav;
      const dd = (peak - p.nav) / peak * 100;
      if (dd > maxDD) maxDD = dd;
    }
    const dailyReturns = [];
    for (let i = 1; i < filteredNav.length; i++) {
      dailyReturns.push((filteredNav[i].nav - filteredNav[i-1].nav) / filteredNav[i-1].nav);
    }
    const avg = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((a, b) => a + (b - avg) ** 2, 0) / dailyReturns.length;
    const dailyVol = Math.sqrt(variance);
    const annualizedVol = dailyVol * Math.sqrt(252) * 100;
    const days = filteredNav.length;
    const annualizedReturn = (Math.pow(last / first, 252 / days) - 1) * 100;
    return { periodReturn, maxDrawdown: maxDD, volatility: annualizedVol, annualizedReturn };
  }, [filteredNav]);

  const drawdownData = useMemo(() => {
    if (filteredNav.length < 2) return [];
    let peak = filteredNav[0].nav;
    return filteredNav.map((p: any) => {
      if (p.nav > peak) peak = p.nav;
      return { date: p.date, drawdown: -((peak - p.nav) / peak * 100) };
    });
  }, [filteredNav]);

  if (fundLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary, #0c1021)' }}>
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: '#818cf8', borderTopColor: 'transparent' }} />
        <p style={{ color: '#8892b0' }}>加载中...</p>
      </div>
    </div>
  );
  if (!fund) return <div className="min-h-screen flex items-center justify-center" style={{ color: '#8892b0' }}>基金不存在</div>;

  const tabs = [
    { key: 'performance' as const, label: '净值走势', icon: LineChart },
    { key: 'nav' as const, label: '历史净值', icon: BarChart3 },
    { key: 'holdings' as const, label: '持仓分布', icon: Shield },
    { key: 'info' as const, label: '基金信息', icon: Award },
  ];

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg" style={{ background: 'rgba(99,102,241,0.1)' }}>
          <ArrowLeft className="w-5 h-5" style={{ color: '#818cf8' }} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">{fund.name}</h1>
          <p className="text-sm" style={{ color: '#8892b0' }}>{fund.code} · {fundTypeLabel(fund.type)} · {riskLabel(fund.riskLevel)}</p>
        </div>
        <div className="ml-auto text-right">
          <div className="text-2xl font-bold text-white">{formatNav(fund.nav)}</div>
          <div className="text-sm" style={{ color: fund.dailyReturn >= 0 ? '#34d399' : '#fb7185' }}>
            {fund.dailyReturn >= 0 ? '+' : ''}{fund.dailyReturn.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(30,35,60,0.8)' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={activeTab === t.key
              ? { background: 'rgba(99,102,241,0.2)', color: '#818cf8' }
              : { color: '#64748b' }}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Performance Tab */}
      {activeTab === 'performance' && (
        <div className="space-y-4">
          {/* Time Range Selector */}
          <div className="flex gap-2">
            {(Object.keys(TIME_LABELS) as TimeRange[]).map(tr => (
              <button key={tr} onClick={() => setTimeRange(tr)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={timeRange === tr
                  ? { background: 'rgba(99,102,241,0.2)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }
                  : { color: '#64748b', border: '1px solid transparent' }}>
                {TIME_LABELS[tr]}
              </button>
            ))}
          </div>

          {/* NAV Chart */}
          {filteredNav.length > 0 ? (
            <div className="p-4 rounded-xl" style={{ background: 'rgba(15,18,35,0.8)' }}>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={filteredNav}>
                  <defs>
                    <linearGradient id="navGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,118,168,0.1)" />
                  <XAxis dataKey="date" tick={{ fill: '#8892b0', fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fill: '#8892b0', fontSize: 10 }} tickFormatter={v => v.toFixed(2)} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ background: '#1a1f3a', border: '1px solid rgba(99,118,168,0.2)', borderRadius: 8, color: 'white', fontSize: 12 }} formatter={(value: any) => [(value ?? 0).toFixed(4), '净值']} />
                  <Area type="monotone" dataKey="nav" stroke="#818cf8" fill="url(#navGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="h-48 flex items-center justify-center text-sm" style={{ color: '#8892b0' }}>暂无净值数据</div>}

          {/* Drawdown Chart */}
          {drawdownData.length > 0 && (
            <div className="p-4 rounded-xl" style={{ background: 'rgba(15,18,35,0.8)' }}>
              <h3 className="text-sm font-semibold text-white mb-3">回撤修复</h3>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={drawdownData}>
                  <defs>
                    <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fb7185" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,118,168,0.1)" />
                  <XAxis dataKey="date" tick={{ fill: '#8892b0', fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fill: '#8892b0', fontSize: 10 }} tickFormatter={v => v.toFixed(1) + '%'} />
                  <Tooltip contentStyle={{ background: '#1a1f3a', border: '1px solid rgba(99,118,168,0.2)', borderRadius: 8, color: 'white', fontSize: 12 }} formatter={(value: any) => [(value ?? 0).toFixed(2) + '%', '回撤']} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                  <Area type="monotone" dataKey="drawdown" stroke="#fb7185" fill="url(#ddGrad)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Metrics */}
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: '区间收益', value: formatPercent(metrics.periodReturn), color: metrics.periodReturn >= 0 ? '#34d399' : '#fb7185', icon: TrendingUp },
                { label: '最大回撤', value: metrics.maxDrawdown.toFixed(2) + '%', color: '#fb7185', icon: TrendingDown },
                { label: '年化波动率', value: metrics.volatility.toFixed(2) + '%', color: '#fbbf24', icon: Activity },
                { label: '年化收益', value: formatPercent(metrics.annualizedReturn), color: metrics.annualizedReturn >= 0 ? '#34d399' : '#fb7185', icon: DollarSign },
              ].map((m, i) => (
                <div key={i} className="p-3 rounded-xl" style={{ background: 'rgba(15,18,35,0.8)' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <m.icon className="w-3.5 h-3.5" style={{ color: m.color }} />
                    <span className="text-xs" style={{ color: '#64748b' }}>{m.label}</span>
                  </div>
                  <div className="text-lg font-bold" style={{ color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* NAV History Tab */}
      {activeTab === 'nav' && (
        <div className="space-y-4">
          {filteredNav.length > 0 ? (
            <>
              <div className="p-4 rounded-xl" style={{ background: 'rgba(15,18,35,0.8)' }}>
                <h3 className="text-sm font-semibold text-white mb-3">净值走势</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={filteredNav.slice(-30)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,118,168,0.1)" />
                    <XAxis dataKey="date" tick={{ fill: '#8892b0', fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                    <YAxis tick={{ fill: '#8892b0', fontSize: 10 }} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ background: '#1a1f3a', border: '1px solid rgba(99,118,168,0.2)', borderRadius: 8, color: 'white', fontSize: 12 }} />
                    <Bar dataKey="nav" fill="#818cf8" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(15,18,35,0.8)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ color: '#8892b0' }}>
                      <th className="text-left py-2 px-4 font-medium">日期</th>
                      <th className="text-right py-2 px-4 font-medium">单位净值</th>
                      <th className="text-right py-2 px-4 font-medium">日涨跌</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNav.slice().reverse().slice(0, 30).map((p: any, i: number) => (
                      <tr key={i} style={{ borderTop: '1px solid rgba(99,118,168,0.1)' }}>
                        <td className="py-2 px-4" style={{ color: '#cbd5e1' }}>{p.date}</td>
                        <td className="text-right py-2 px-4 text-white font-mono">{p.nav.toFixed(4)}</td>
                        <td className="text-right py-2 px-4 font-mono" style={{ color: (p.return || 0) >= 0 ? '#34d399' : '#fb7185' }}>
                          {p.return !== undefined ? ((p.return >= 0 ? '+' : '') + p.return.toFixed(2) + '%') : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : <div className="py-10 text-center text-sm" style={{ color: '#8892b0' }}>暂无净值数据</div>}
        </div>
      )}

      {/* Holdings Tab */}
      {activeTab === 'holdings' && (
        <div className="space-y-4">
          {holdings.length > 0 ? (
            <>
              <div className="p-4 rounded-xl" style={{ background: 'rgba(15,18,35,0.8)' }}>
                <h3 className="text-sm font-semibold text-white mb-3">前十大持仓</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={holdings.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,118,168,0.1)" />
                    <XAxis type="number" tick={{ fill: '#8892b0', fontSize: 10 }} tickFormatter={v => v + '%'} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#8892b0', fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#1a1f3a', border: '1px solid rgba(99,118,168,0.2)', borderRadius: 8, color: 'white', fontSize: 12 }} formatter={(value: any) => [(value ?? 0).toFixed(2) + '%', '占比']} />
                    <Bar dataKey="ratio" radius={[0, 4, 4, 0]}>
                      {holdings.slice(0, 10).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(15,18,35,0.8)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ color: '#8892b0' }}>
                      <th className="text-left py-2 px-4 font-medium">股票</th>
                      <th className="text-right py-2 px-4 font-medium">占比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((h: any, i: number) => (
                      <tr key={i} style={{ borderTop: '1px solid rgba(99,118,168,0.1)' }}>
                        <td className="py-2 px-4" style={{ color: '#cbd5e1' }}>{h.name}</td>
                        <td className="text-right py-2 px-4 text-white font-mono">{h.ratio?.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : <div className="py-10 text-center text-sm" style={{ color: '#8892b0' }}>暂无持仓数据</div>}
        </div>
      )}

      {/* Info Tab */}
      {activeTab === 'info' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '最新净值', value: formatNav(fund.nav) },
              { label: '累计净值', value: formatNav(fund.accNav || fund.nav) },
              { label: '日涨跌', value: (fund.dailyReturn >= 0 ? '+' : '') + fund.dailyReturn.toFixed(2) + '%', color: fund.dailyReturn >= 0 ? '#34d399' : '#fb7185' },
              { label: '基金规模', value: fund.size >= 10000 ? (fund.size / 10000).toFixed(2) + '亿' : fund.size > 0 ? fund.size.toFixed(2) + '万' : '暂无数据' },
              { label: '基金类型', value: fundTypeLabel(fund.type) },
              { label: '风险等级', value: riskLabel(fund.riskLevel) },
            ].map((item, i) => (
              <div key={i} className="p-3 rounded-xl" style={{ background: 'rgba(15,18,35,0.8)' }}>
                <div className="text-xs mb-1" style={{ color: '#64748b' }}>{item.label}</div>
                <div className="text-sm font-bold" style={{ color: item.color || '#ffffff' }}>{item.value}</div>
              </div>
            ))}
          </div>
          {/* Detailed Info */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(15,18,35,0.8)' }}>
            <h4 className="text-sm font-semibold text-white mb-3">基金详情</h4>
            {[
              { label: '基金经理', value: fund.manager || '暂无数据' },
              { label: '基金公司', value: fund.company || '暂无数据' },
              { label: '成立日期', value: fund.establishDate || '暂无数据' },
              { label: '业绩基准', value: fund.benchmark || '暂无数据' },
              { label: '管理费率', value: fund.fee?.manage ? fund.fee.manage + '%' : '暂无数据' },
              { label: '托管费率', value: fund.fee?.custody ? fund.fee.custody + '%' : '暂无数据' },
            ].map((item, i) => (
              <div key={i} className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid rgba(99,118,168,0.1)' }}>
                <span className="text-sm" style={{ color: '#8892b0' }}>{item.label}</span>
                <span className="text-sm font-medium text-white text-right max-w-[60%]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button onClick={() => navigate(`/diagnosis/${code}`)}
          className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
          style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
          <Brain className="w-4 h-4" />
          AI 诊断
        </button>
        <button onClick={() => navigate('/simtrade')}
          className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
          style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
          <ShoppingCart className="w-4 h-4" />
          模拟交易
        </button>
      </div>
    </div>
  );
}
