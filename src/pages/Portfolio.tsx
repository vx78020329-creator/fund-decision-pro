import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { fetchPortfolio, updatePortfolioItem, removeFromPortfolio, fetchFunds } from '@/services/api';
import type { PortfolioItem } from '@/services/api';
import { formatPercent, formatMoney } from '@/utils/format';
import type { Fund } from '@/types/fund';

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308', '#ec4899', '#f97316', '#14b8a6', '#3b82f6', '#a855f7'];

export function Portfolio() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');

  const { data: portfolioItems = [] } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => fetchPortfolio(),
  });

  const { data: searchData } = useQuery({
    queryKey: ['funds-search-portfolio', search],
    queryFn: () => fetchFunds({ keyword: search, pageSize: 20 }),
    enabled: showAdd && search.length > 0,
  });

  const addMutation = useMutation({
    mutationFn: (item: PortfolioItem) => updatePortfolioItem(item),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portfolio'] }),
  });

  const removeMutation = useMutation({
    mutationFn: (code: string) => removeFromPortfolio(code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portfolio'] }),
  });

  const searchFunds = searchData?.funds || [];
  const totalWeight = portfolioItems.reduce((s: number, h: PortfolioItem) => s + h.weight, 0);
  const chartData = portfolioItems.map((h: PortfolioItem) => ({ name: h.fundName.slice(0, 6), value: h.weight }));

  const addFund = (fund: Fund) => {
    if (portfolioItems.find((h: PortfolioItem) => h.fundCode === fund.code)) return;
    addMutation.mutate({
      fundCode: fund.code,
      fundName: fund.name,
      shares: 0,
      avgCost: fund.nav,
      weight: 10,
    });
    setShowAdd(false);
    setSearch('');
  };

  return (
    <div className="py-4 md:py-6 animate-fade-in">
      <h1 className="text-xl font-bold mb-1" style={{ color: '#f1f5f9' }}>组合管理</h1>
      <p className="text-sm mb-6" style={{ color: '#64748b' }}>构建和管理您的基金投资组合</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="glass-card p-4">
          <div className="text-xs mb-1" style={{ color: '#64748b' }}>持仓数量</div>
          <div className="text-2xl font-bold" style={{ color: '#a5b4fc' }}>{portfolioItems.length}<span className="text-sm" style={{ color: '#64748b' }}> 只</span></div>
        </div>
        <div className="glass-card p-4">
          <div className="text-xs mb-1" style={{ color: '#64748b' }}>今日组合收益</div>
          <div className="flex items-center gap-1">
            <span className="text-2xl font-bold font-mono" style={{ color: '#94a3b8' }}>--</span>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="text-xs mb-1" style={{ color: '#64748b' }}>配比完成度</div>
          <div className="text-2xl font-bold" style={{ color: totalWeight === 100 ? '#22c55e' : '#eab308' }}>
            {totalWeight}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h2 className="text-sm font-medium mb-4" style={{ color: '#94a3b8' }}>资产配置</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" stroke="none">
                  {chartData.map((_: { name: string; value: number }, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'rgba(17,24,39,0.95)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-sm" style={{ color: '#64748b' }}>暂无持仓</div>
          )}
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium" style={{ color: '#94a3b8' }}>持仓明细</h2>
            <button onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs cursor-pointer transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff' }}>
              <Plus className="w-3.5 h-3.5" />添加
            </button>
          </div>

          {showAdd && (
            <div className="mb-4 p-3 rounded-lg animate-fade-in" style={{ background: 'rgba(30, 41, 59, 0.5)' }}>
              <input type="text" placeholder="搜索基金..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-2"
                style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(99, 102, 241, 0.15)', color: '#f1f5f9' }}
              />
              <div className="max-h-32 overflow-y-auto space-y-1">
                {searchFunds.slice(0, 6).map((f: Fund) => (
                  <div key={f.code} onClick={() => addFund(f)}
                    className="flex items-center justify-between px-2 py-1.5 rounded cursor-pointer hover:bg-white/5 text-xs">
                    <span style={{ color: '#f1f5f9' }}>{f.name}</span>
                    <span style={{ color: '#64748b' }}>{f.code}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {portfolioItems.map((h: PortfolioItem) => (
              <div key={h.fundCode} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(99, 102, 241, 0.05)' }}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate" style={{ color: '#f1f5f9' }}>{h.fundName}</div>
                  <div className="text-xs" style={{ color: '#64748b' }}>{h.fundCode}</div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <input type="number" value={h.weight} min={0} max={100}
                    onChange={(e) => addMutation.mutate({ ...h, weight: +e.target.value })}
                    className="w-14 px-1.5 py-0.5 rounded text-xs text-right font-mono outline-none"
                    style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(99, 102, 241, 0.15)', color: '#f1f5f9' }}
                  />
                  <span className="text-xs" style={{ color: '#64748b' }}>%</span>
                  <button onClick={() => removeMutation.mutate(h.fundCode)}
                    className="p-1 rounded cursor-pointer transition-all hover:bg-red-500/10">
                    <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}