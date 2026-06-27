import { useMemo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, ArrowUpDown, ChevronLeft, ChevronRight,
  Search, Database, BarChart3, Wallet, Users, Activity, RefreshCw,
} from 'lucide-react';
import { useFundStore } from '@/stores/fundStore';
import { fetchFunds, syncFunds, fetchSyncProgress, fetchFundCount } from '@/services/api';
import { formatPercent, formatNav, formatMoney, riskLabel, riskColor, fundTypeLabel } from '@/utils/format';
import type { Fund, FundType } from '@/types/fund';

const TYPE_TABS: Array<{ key: FundType | 'all'; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'stock', label: '股票型' },
  { key: 'mixed', label: '混合型' },
  { key: 'index', label: '指数型' },
  { key: 'etf', label: 'ETF' },
  { key: 'bond', label: '债券型' },
  { key: 'qdii', label: 'QDII' },
  { key: 'money', label: '货币型' },
  { key: 'fof', label: 'FOF' },
];

const SORT_OPTIONS = [
  { key: 'totalReturn1y', label: '近1年' },
  { key: 'dailyReturn', label: '日涨跌' },
  { key: 'totalReturn3y', label: '近3年' },
  { key: 'size', label: '规模' },
  { key: 'nav', label: '净值' },
];

function MiniSparkline({ color }: { color: string }) {
  const points = useMemo(() => {
    const pts: number[] = [];
    let v = 50;
    for (let i = 0; i < 12; i++) {
      v += (Math.random() - 0.45) * 8;
      v = Math.max(20, Math.min(80, v));
      pts.push(v);
    }
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const range = max - min || 1;
    return pts.map((p, i) => `${(i / 11) * 100},${100 - ((p - min) / range) * 80}`).join(' ');
  }, []);
  return (
    <svg width="48" height="24" viewBox="0 0 100 100" preserveAspectRatio="none" className="opacity-40">
      <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatCard({ label, value, change, icon: Icon, color, changeColor }: {
  label: string; value: string; change?: string; icon: React.ElementType; color: string; changeColor?: string;
}) {
  return (
    <div className="stat-card animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg" style={{ background: `${color}10` }}>
          <Icon className="w-4.5 h-4.5" style={{ color }} />
        </div>
        <MiniSparkline color={color} />
      </div>
      <div className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{value}</div>
      {change !== undefined && (
        <div className="flex items-center gap-1 mt-1.5">
          {change.startsWith('+') ? (
            <TrendingUp className="w-3 h-3" style={{ color: changeColor || 'var(--accent-emerald)' }} />
          ) : change.startsWith('-') ? (
            <TrendingDown className="w-3 h-3" style={{ color: changeColor || 'var(--accent-rose)' }} />
          ) : null}
          <span className="text-xs font-medium" style={{ color: changeColor || (change.startsWith('-') ? 'var(--accent-rose)' : 'var(--accent-emerald)') }}>{change}</span>
        </div>
      )}
    </div>
  );
}

function FundRow({ fund, index }: { fund: Fund; index: number }) {
  const navigate = useNavigate();
  const isUp = fund.dailyReturn >= 0;
  return (
    <div className="fund-row animate-fade-in" style={{ animationDelay: `${Math.min(index * 25, 400)}ms`, animationFillMode: 'both' }} onClick={() => navigate(`/fund/${fund.code}`)}>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold truncate mb-0.5" style={{ color: 'var(--text-primary)' }}>{fund.name}</div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{fund.code}</span>
          <span className="badge" style={{ background: `${riskColor(fund.riskLevel)}12`, color: riskColor(fund.riskLevel), padding: '1px 6px', fontSize: '10px' }}>{riskLabel(fund.riskLevel)}</span>
        </div>
      </div>
      <div><span className="badge badge-indigo" style={{ padding: '2px 8px', fontSize: '11px' }}>{fundTypeLabel(fund.type)}</span></div>
      <div className="text-right hidden md:block">
        <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatNav(fund.nav)}</div>
      </div>
      <div className="text-right">
        <div className="text-[13px] font-semibold" style={{ color: isUp ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontFamily: 'var(--font-mono)' }}>{formatPercent(fund.dailyReturn)}</div>
      </div>
      <div className="text-right hidden md:block">
        <div className="text-[13px] font-semibold" style={{ color: fund.totalReturn1y >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontFamily: 'var(--font-mono)' }}>{formatPercent(fund.totalReturn1y)}</div>
      </div>
      <div className="text-right hidden md:block">
        <div className="text-[13px]" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{formatMoney(fund.size * 100000000)}</div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="h-14 rounded-lg animate-pulse" style={{ background: 'rgba(99,102,241,0.05)' }} />
      ))}
    </div>
  );
}

export function Home() {
  const { filter, setFilter, toggleSort } = useFundStore();
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);
  const [searchText, setSearchText] = useState(filter.keyword);

  const { data, isLoading } = useQuery({
    queryKey: ['funds', filter.keyword, filter.type, filter.sortBy, filter.sortOrder, filter.riskLevel, filter.page, filter.pageSize],
    queryFn: () => fetchFunds({ keyword: filter.keyword, type: filter.type, sortBy: filter.sortBy, sortOrder: filter.sortOrder, riskLevel: filter.riskLevel, page: filter.page, pageSize: filter.pageSize }),
  });

  const { data: syncProgress } = useQuery({ queryKey: ['syncProgress'], queryFn: fetchSyncProgress, refetchInterval: syncing ? 2000 : false });
  const { data: totalCount = 0 } = useQuery({ queryKey: ['fundCount'], queryFn: fetchFundCount });
const { data: topDailyData } = useQuery({
    queryKey: ['topDaily'],
    queryFn: () => fetchFunds({ sortBy: 'dailyReturn', sortOrder: 'desc', page: 1, pageSize: 1 }),
  });
  const { data: topYearData } = useQuery({
    queryKey: ['topYear'],
    queryFn: () => fetchFunds({ sortBy: 'totalReturn1y', sortOrder: 'desc', page: 1, pageSize: 1 }),
  });
  const topDailyFund = topDailyData?.funds?.[0];
  const topYearFund = topYearData?.funds?.[0];

  const funds = data?.funds || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / filter.pageSize) || 1;
  const pagedFunds = funds;

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try { await syncFunds(); } finally { setSyncing(false); }
  }, []);

  const handleSearch = useCallback(() => { setFilter({ keyword: searchText, page: 1 }); }, [searchText, setFilter]);

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="基金总数" value={totalCount.toLocaleString()} icon={BarChart3} color="#818cf8" />
        <StatCard label="同步状态" value={syncProgress?.running ? '同步中' : '已完成'} icon={Database} color="#34d399" />
        <StatCard label="日涨跌第一" value={topDailyFund ? formatPercent(topDailyFund.dailyReturn) : '--'} icon={TrendingUp} color="#fbbf24" />
        <StatCard label="近1年第一" value={topYearFund ? formatPercent(topYearFund.totalReturn1y) : '--'} icon={Activity} color="#06b6d4" />
      </div>

      {/* Search */}
      <div className="glass-card p-4 mb-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input value={searchText} onChange={e => setSearchText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="搜索基金名称/代码/经理" className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
          </div>
          <button onClick={handleSearch} className="px-4 py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>搜索</button>
        </div>
      </div>

      {/* Filter */}
      <div className="glass-card p-4 mb-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {TYPE_TABS.map((tab) => (
              <button key={tab.key} onClick={() => setFilter({ type: tab.key, page: 1 })} className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all ${filter.type === tab.key ? 'text-white' : 'hover:brightness-110'}`} style={filter.type === tab.key ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' } : { background: 'rgba(30, 41, 59, 0.6)', color: '#94a3b8', border: '1px solid rgba(99, 102, 241, 0.15)' }}>{tab.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {SORT_OPTIONS.map((opt) => (
              <button key={opt.key} onClick={() => toggleSort(opt.key)} className="btn-ghost" style={{ borderColor: filter.sortBy === opt.key ? 'var(--border-accent)' : undefined, color: filter.sortBy === opt.key ? 'var(--accent-indigo)' : undefined }}>{opt.label}{filter.sortBy === opt.key && <ArrowUpDown className="w-3 h-3" />}</button>
            ))}
            <button onClick={handleSync} disabled={syncing} className="btn-ghost" style={{ borderColor: 'rgba(99,102,241,0.2)', color: 'var(--accent-indigo)' }}><Database className="w-3.5 h-3.5" />{syncing ? '同步中' : '同步'}</button>
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? <LoadingSkeleton /> : (
        <div className="glass-card overflow-hidden">
          <div className="fund-row" style={{ background: 'rgba(99,102,241,0.03)', borderBottom: '1px solid var(--border-subtle)', cursor: 'default' }}>
            <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{'基金名称'}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{'类型'}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-right hidden md:block" style={{ color: 'var(--text-muted)' }}>{'净值'}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-right" style={{ color: 'var(--text-muted)' }}>{'日涨跌'}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-right" style={{ color: 'var(--text-muted)' }}>{'近1年'}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-right hidden md:block" style={{ color: 'var(--text-muted)' }}>{'规模'}</div>
          </div>
          {pagedFunds.length > 0 ? pagedFunds.map((fund, i) => <FundRow key={fund.code} fund={fund} index={i} />) : (
            <div className="py-24 text-center"><Wallet className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.5 }} /><div className="text-sm" style={{ color: 'var(--text-muted)' }}>{'没有找到匹配的基金'}</div></div>
          )}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 px-1">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{`共${total}只基金，第${filter.page}/${totalPages}页`}</span>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setFilter({ page: Math.max(1, filter.page - 1) })} disabled={filter.page <= 1} className="btn-ghost disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const start = Math.max(1, Math.min(filter.page - 2, totalPages - 4));
            const pageNum = start + i;
            if (pageNum > totalPages) return null;
            return <button key={pageNum} onClick={() => setFilter({ page: pageNum })} className="w-8 h-8 rounded-lg text-xs font-semibold transition-all" style={{ background: filter.page === pageNum ? 'var(--gradient-brand)' : 'transparent', color: filter.page === pageNum ? '#fff' : 'var(--text-muted)', border: `1px solid ${filter.page === pageNum ? 'var(--border-accent)' : 'var(--border-subtle)'}` }}>{pageNum}</button>;
          })}
          <button onClick={() => setFilter({ page: Math.min(totalPages, filter.page + 1) })} disabled={filter.page >= totalPages} className="btn-ghost disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          <select value={filter.pageSize} onChange={(e) => setFilter({ pageSize: Number(e.target.value), page: 1 })} className="ml-2 px-2 py-1 rounded-lg text-xs outline-none" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
            <option value={20}>20条/页</option>
            <option value={50}>50条/页</option>
            <option value={100}>100条/页</option>
            <option value={200}>200条/页</option>
          </select>
        </div>
      </div>
    </div>
  );
}
