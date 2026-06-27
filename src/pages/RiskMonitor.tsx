import { useMemo, useState } from 'react';
import { Shield, AlertTriangle, CheckCircle2, TrendingDown, Activity, Eye, Settings } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { getMockFunds } from '@/services/mockData';
import { formatPercent } from '@/utils/format';

interface RiskAlert { id: string; level: 'high' | 'medium' | 'low'; title: string; desc: string; fund?: string; time: string; }

export function RiskMonitor() {
  const allFunds = useMemo(() => getMockFunds(), []);
  const [selectedMetric, setSelectedMetric] = useState<'drawdown' | 'volatility' | 'concentration'>('drawdown');

  const alerts: RiskAlert[] = [
    { id: '1', level: 'high', title: '回撤预警', desc: '诺安成长混合近1月回撤达-12.5%，超过设定阈值-10%', fund: '诺安成长混合', time: '10分钟前' },
    { id: '2', level: 'high', title: '集中度风险', desc: '您的组合中消费行业占比达45%，建议分散至30%以下', time: '30分钟前' },
    { id: '3', level: 'medium', title: '风格漂移提醒', desc: '景顺长城新兴成长混合持仓偏向大盘价值，与基金契约风格不符', fund: '景顺长城新兴成长混合', time: '1小时前' },
    { id: '4', level: 'medium', title: '流动性预警', desc: '持有的某债基连续3日净赎回超过基金规模5%', time: '2小时前' },
    { id: '5', level: 'low', title: '市场波动加大', desc: '沪深300近5日波动率升至年化25%，建议关注仓位控制', time: '3小时前' },
  ];

  const drawdownData = useMemo(() => {
    const funds = allFunds.slice(0, 10);
    return funds.map(f => ({
      name: f.name.slice(0, 6),
      maxDrawdown: -(5 + Math.random() * 25),
      volatility: 10 + Math.random() * 30,
      sharpe: 0.3 + Math.random() * 1.5,
    }));
  }, [allFunds]);

  const barOption = {
    backgroundColor: 'transparent',
    grid: { top: 30, right: 20, bottom: 50, left: 60 },
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(17,24,39,0.95)', borderColor: 'rgba(99,102,241,0.2)', textStyle: { color: '#f1f5f9', fontSize: 12 } },
    xAxis: {
      type: 'category',
      data: drawdownData.map(d => d.name),
      axisLine: { lineStyle: { color: 'rgba(99,102,241,0.1)' } },
      axisLabel: { color: '#64748b', fontSize: 10, rotate: 30 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: '#64748b', fontSize: 10, formatter: (v: number) => v.toFixed(0) + '%' },
      splitLine: { lineStyle: { color: 'rgba(99,102,241,0.06)' } },
    },
    series: [{
      type: 'bar',
      data: drawdownData.map(d => ({
        value: selectedMetric === 'drawdown' ? d.maxDrawdown : selectedMetric === 'volatility' ? -d.volatility : -d.sharpe * 10,
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: '#ef4444' }, { offset: 1, color: '#ef444440' }],
          },
          borderRadius: [4, 4, 0, 0],
        },
      })),
      barWidth: '50%',
    }],
  };

  const riskScore = 65;
  const getScoreColor = (s: number) => s >= 70 ? '#22c55e' : s >= 50 ? '#eab308' : '#ef4444';

  return (
    <div className="py-4 md:py-6 animate-fade-in">
      <h1 className="text-xl font-bold mb-1" style={{ color: '#f1f5f9' }}>风险监控</h1>
      <p className="text-sm mb-6" style={{ color: '#64748b' }}>实时监控组合风险，预警异常波动</p>

      {/* Risk Score */}
      <div className="glass-card p-5 mb-4">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="35" fill="none" stroke="rgba(99,102,241,0.1)" strokeWidth="6" />
                <circle cx="40" cy="40" r="35" fill="none" stroke={getScoreColor(riskScore)} strokeWidth="6"
                  strokeDasharray={`${riskScore * 2.2} 220`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold font-mono" style={{ color: getScoreColor(riskScore) }}>{riskScore}</span>
              </div>
            </div>
            <div>
              <div className="text-base font-medium" style={{ color: '#f1f5f9' }}>组合风险评分</div>
              <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>评分越高越安全（满分100）</div>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-3 gap-4">
            {[
              { label: '最大回撤', value: '-8.5%', color: '#ef4444' },
              { label: '年化波动率', value: '18.2%', color: '#eab308' },
              { label: '夏普比率', value: '1.23', color: '#22c55e' },
            ].map(m => (
              <div key={m.label} className="text-center">
                <div className="text-xs mb-1" style={{ color: '#64748b' }}>{m.label}</div>
                <div className="text-lg font-bold font-mono" style={{ color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="glass-card p-5 mb-4">
        <h2 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: '#94a3b8' }}>
          <AlertTriangle className="w-4 h-4" />风险预警
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>{alerts.filter(a => a.level === 'high').length}</span>
        </h2>
        <div className="space-y-2">
          {alerts.map(alert => (
            <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg animate-fade-in"
              style={{
                background: alert.level === 'high' ? 'rgba(239, 68, 68, 0.05)' : alert.level === 'medium' ? 'rgba(234, 179, 8, 0.05)' : 'rgba(99, 102, 241, 0.05)',
                border: `1px solid ${alert.level === 'high' ? 'rgba(239, 68, 68, 0.15)' : alert.level === 'medium' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(99, 102, 241, 0.1)'}`,
              }}>
              <div className="mt-0.5">
                {alert.level === 'high' ? <AlertTriangle className="w-4 h-4" style={{ color: '#ef4444' }} /> :
                 alert.level === 'medium' ? <AlertTriangle className="w-4 h-4" style={{ color: '#eab308' }} /> :
                 <Eye className="w-4 h-4" style={{ color: '#6366f1' }} />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium" style={{ color: '#f1f5f9' }}>{alert.title}</span>
                  <span className="text-xs" style={{ color: '#64748b' }}>{alert.time}</span>
                </div>
                <p className="text-xs" style={{ color: '#94a3b8' }}>{alert.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium" style={{ color: '#94a3b8' }}>风险指标对比</h2>
          <div className="flex gap-1">
            {([['drawdown', '最大回撤'], ['volatility', '波动率'], ['concentration', '集中度']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setSelectedMetric(k)}
                className="px-2.5 py-1 rounded text-xs cursor-pointer transition-all"
                style={{ background: selectedMetric === k ? 'rgba(99, 102, 241, 0.2)' : 'transparent', color: selectedMetric === k ? '#a5b4fc' : '#64748b' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <ReactECharts option={barOption} style={{ height: 300 }} />
      </div>
    </div>
  );
}
