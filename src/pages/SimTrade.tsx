import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, Calendar, Clock, CheckCircle2, Plus, Wallet, TrendingUp } from 'lucide-react';
import { fetchFunds, submitBuy, submitSell, fetchTrades, fetchDcaPlans, confirmTradeById, toggleDcaPlanActive } from '@/services/api';
import type { Trade, DcaPlan } from '@/services/api';
import { formatPercent, formatMoney, formatNav } from '@/utils/format';
import type { Fund } from '@/types/fund';

export function SimTrade() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'trade' | 'dca' | 'history'>('trade');
  const [selectedFund, setSelectedFund] = useState('');
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [search, setSearch] = useState('');

  const { data: searchData } = useQuery({
    queryKey: ['funds-search-trade', search],
    queryFn: () => fetchFunds({ keyword: search, pageSize: 20 }),
  });

  const { data: trades = [] } = useQuery({
    queryKey: ['trades'],
    queryFn: () => fetchTrades(50),
  });

  const { data: dcaPlans = [] } = useQuery({
    queryKey: ['dca-plans'],
    queryFn: () => fetchDcaPlans(),
  });

  const buyMutation = useMutation({
    mutationFn: ({ code, amt }: { code: string; amt: number }) => submitBuy(code, amt),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trades'] }),
  });

  const sellMutation = useMutation({
    mutationFn: ({ code, shares }: { code: string; shares: number }) => submitSell(code, shares),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trades'] }),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => confirmTradeById(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trades'] }),
  });

  const toggleDcaMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => toggleDcaPlanActive(id, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dca-plans'] }),
  });

  const funds = searchData?.funds || [];
  const fund = funds.find((f: Fund) => f.code === selectedFund);
  const buyFee = fund ? (+amount * fund.fee.purchase / 100) : 0;
  const shares = fund && +amount > 0 ? ((+amount - buyFee) / fund.nav) : 0;

  const tabs = [
    { key: 'trade', label: '申购/赎回', icon: <ArrowRightLeft className="w-4 h-4" /> },
    { key: 'dca', label: '定投计划', icon: <Calendar className="w-4 h-4" /> },
    { key: 'history', label: '交易记录', icon: <Clock className="w-4 h-4" /> },
  ] as const;

  const handleSubmit = async () => {
    if (!selectedFund || +amount <= 0) return;
    if (tradeType === 'buy') {
      buyMutation.mutate({ code: selectedFund, amt: +amount });
    }
    setAmount('');
  };

  return (
    <div className="py-4 md:py-6 animate-fade-in">
      <h1 className="text-xl font-bold mb-1" style={{ color: '#f1f5f9' }}>模拟交易</h1>
      <p className="text-sm mb-6" style={{ color: '#64748b' }}>虚拟资金，真实体验基金申赎和定投</p>

      <div className="glass-card p-5 mb-4"
        style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(6, 182, 212, 0.1))' }}>
        <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>模拟账户余额</div>
        <div className="text-3xl font-bold font-mono" style={{ color: '#f1f5f9' }}>¥ 1,000,000.00</div>
        <div className="flex items-center gap-4 mt-3">
          <div className="text-xs" style={{ color: '#94a3b8' }}>总资产 <span className="font-mono" style={{ color: '#f1f5f9' }}>¥ 1,000,000.00</span></div>
          <div className="text-xs" style={{ color: '#94a3b8' }}>总收益 <span className="font-mono" style={{ color: '#22c55e' }}>+¥ 0.00</span></div>
        </div>
      </div>

      <div className="flex gap-1 mb-4">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all"
            style={{
              background: tab === t.key ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: tab === t.key ? '#a5b4fc' : '#64748b',
              border: `1px solid ${tab === t.key ? 'rgba(99, 102, 241, 0.25)' : 'transparent'}`,
            }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'trade' && (
        <div className="glass-card p-5 animate-fade-in">
          <div className="flex gap-2 mb-4">
            {(['buy', 'sell'] as const).map(t => (
              <button key={t} onClick={() => setTradeType(t)}
                className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all"
                style={{
                  background: tradeType === t ? (t === 'buy' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)') : 'rgba(30, 41, 59, 0.5)',
                  color: tradeType === t ? (t === 'buy' ? '#22c55e' : '#ef4444') : '#64748b',
                  border: `1px solid ${tradeType === t ? (t === 'buy' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)') : 'transparent'}`,
                }}>
                {t === 'buy' ? '申购' : '赎回'}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: '#64748b' }}>选择基金</label>
              <input type="text" placeholder="搜索基金名称或代码..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(99, 102, 241, 0.15)', color: '#f1f5f9' }}
              />
              {search && funds.length > 0 && (
                <div className="mt-1 max-h-32 overflow-y-auto rounded-lg" style={{ background: 'rgba(17, 24, 39, 0.95)', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                  {funds.slice(0, 8).map((f: Fund) => (
                    <div key={f.code} onClick={() => { setSelectedFund(f.code); setSearch(f.name); }}
                      className="px-3 py-2 cursor-pointer transition-all hover:bg-white/5 text-sm"
                      style={{ color: '#f1f5f9' }}>
                      {f.name} <span className="text-xs" style={{ color: '#64748b' }}>{f.code}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs mb-1.5 block" style={{ color: '#64748b' }}>金额（元）</label>
              <input type="number" placeholder="10000" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(99, 102, 241, 0.15)', color: '#f1f5f9' }}
              />
            </div>

            {fund && +amount > 0 && (
              <div className="p-3 rounded-lg space-y-2" style={{ background: 'rgba(30, 41, 59, 0.4)' }}>
                <div className="flex justify-between text-xs">
                  <span style={{ color: '#64748b' }}>当前净值</span>
                  <span style={{ color: '#f1f5f9' }}>{formatNav(fund.nav)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: '#64748b' }}>手续费</span>
                  <span style={{ color: '#ef4444' }}>¥{buyFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: '#64748b' }}>确认份额</span>
                  <span style={{ color: '#a5b4fc' }}>{shares.toFixed(2)} 份</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: '#64748b' }}>确认时间</span>
                  <span style={{ color: '#eab308' }}>T+1（下一个交易日）</span>
                </div>
              </div>
            )}

            <button onClick={handleSubmit} disabled={!selectedFund || +amount <= 0}
              className="w-full py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all hover:brightness-110 disabled:opacity-50"
              style={{ background: tradeType === 'buy' ? 'linear-gradient(135deg, #22c55e, #06b6d4)' : 'linear-gradient(135deg, #ef4444, #f97316)', color: '#fff' }}>
              {tradeType === 'buy' ? '确认申购' : '确认赎回'}
            </button>
          </div>
        </div>
      )}

      {tab === 'dca' && (
        <div className="space-y-3 animate-fade-in">
          {dcaPlans.map((plan: DcaPlan) => (
            <div key={plan.id} className="glass-card p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-medium" style={{ color: '#f1f5f9' }}>{plan.fundName}</div>
                  <div className="text-xs" style={{ color: '#64748b' }}>{plan.fundCode}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: plan.active ? '#22c55e' : '#64748b' }} />
                  <span className="text-xs" style={{ color: plan.active ? '#22c55e' : '#64748b' }}>{plan.active ? '运行中' : '已暂停'}</span>
                  <button onClick={() => toggleDcaMutation.mutate({ id: plan.id, active: !plan.active })}
                    className="text-xs px-2 py-0.5 rounded cursor-pointer"
                    style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#a5b4fc' }}>
                    {plan.active ? '暂停' : '启动'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <div>
                  <div className="text-xs" style={{ color: '#64748b' }}>每期金额</div>
                  <div className="text-sm font-mono" style={{ color: '#f1f5f9' }}>¥{plan.amount.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: '#64748b' }}>频率</div>
                  <div className="text-sm" style={{ color: '#f1f5f9' }}>{plan.frequency}</div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: '#64748b' }}>状态</div>
                  <div className="text-sm" style={{ color: plan.active ? '#22c55e' : '#64748b' }}>{plan.active ? '运行中' : '已暂停'}</div>
                </div>
              </div>
            </div>
          ))}
          <button className="w-full py-3 rounded-lg text-sm font-medium cursor-pointer border-dashed transition-all hover:bg-white/5"
            style={{ border: '1px dashed rgba(99, 102, 241, 0.3)', color: '#a5b4fc' }}>
            <Plus className="w-4 h-4 inline mr-1" />新建定投计划
          </button>
        </div>
      )}

      {tab === 'history' && (
        <div className="glass-card overflow-hidden animate-fade-in">
          <div className="grid grid-cols-6 gap-2 px-4 py-2.5 text-xs font-medium"
            style={{ background: 'rgba(99, 102, 241, 0.05)', borderBottom: '1px solid rgba(99, 102, 241, 0.1)', color: '#64748b' }}>
            <div className="col-span-2">基金</div>
            <div>类型</div>
            <div className="text-right">金额</div>
            <div className="text-right">净值</div>
            <div className="text-right">状态</div>
          </div>
          {trades.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: '#64748b' }}>暂无交易记录</div>
          ) : trades.map((t: Trade) => (
            <div key={t.id} className="grid grid-cols-6 gap-2 px-4 py-3 items-center text-sm"
              style={{ borderBottom: '1px solid rgba(99, 102, 241, 0.05)' }}>
              <div className="col-span-2">
                <div className="truncate" style={{ color: '#f1f5f9' }}>{t.fundName}</div>
                <div className="text-xs" style={{ color: '#64748b' }}>{t.createdAt?.slice(0, 10)}</div>
              </div>
              <div>
                <span className="text-xs px-1.5 py-0.5 rounded"
                  style={{ background: t.type === 'buy' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: t.type === 'buy' ? '#22c55e' : '#ef4444' }}>
                  {t.type === 'buy' ? '申购' : '赎回'}
                </span>
              </div>
              <div className="text-right font-mono" style={{ color: '#f1f5f9' }}>¥{t.amount.toLocaleString()}</div>
              <div className="text-right font-mono" style={{ color: '#94a3b8' }}>{t.nav > 0 ? formatNav(t.nav) : '--'}</div>
              <div className="text-right">
                {t.status === 'confirmed' ? (
                  <span className="text-xs" style={{ color: '#22c55e' }}><CheckCircle2 className="w-3.5 h-3.5 inline" /> 已确认</span>
                ) : (
                  <button onClick={() => confirmMutation.mutate(t.id)}
                    className="text-xs px-2 py-0.5 rounded cursor-pointer"
                    style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#eab308' }}>
                    <Clock className="w-3.5 h-3.5 inline" /> 待确认
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}