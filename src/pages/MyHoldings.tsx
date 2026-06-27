import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart, Pie, Cell, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area,
} from 'recharts';
import {
  Wallet, TrendingUp, TrendingDown, Plus, X, Search, BarChart3,
  ArrowUpRight, ArrowDownRight, RefreshCw, Activity, AlertTriangle,
  Trash2, ChevronDown, Sparkles, Target, Layers,
} from 'lucide-react';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import FadeIn from '../components/ui/FadeIn';

/* ────────────────────── types ────────────────────── */

interface Holding {
  code: string; name: string; amount: number; dailyReturn: number;
  yesterdayReturn: number; totalReturn: number; returnPct: number;
  weight: number; type: string; shares: number; avgCost: number;
  currentNav: number; navMissing: boolean;
}

/* ────────────────────── constants ────────────────────── */

const FUND_TYPE_MAP: Record<string, string> = {
  '混合型': 'mixed', '混合': 'mixed', '进阶理财': 'mixed',
  '指数型': 'index', '指数': 'index', ETF: 'index',
  QDII: 'qdii',
  '债券型': 'bond', '债券': 'bond', '稳健理财': 'bond',
  '货币型': 'money', '货币': 'money',
};
const ENGLISH_TYPES = new Set(['mixed', 'index', 'qdii', 'bond', 'money', 'stock', 'etf', 'fof']);
function normalizeType(raw: string): string {
  if (!raw) return 'other';
  const lower = raw.toLowerCase();
  if (ENGLISH_TYPES.has(lower)) return lower;
  if (FUND_TYPE_MAP[raw]) return FUND_TYPE_MAP[raw];
  for (const [k, v] of Object.entries(FUND_TYPE_MAP)) {
    if (lower.includes(k.toLowerCase())) return v;
  }
  return 'other';
}
const TYPE_LABELS: Record<string, string> = {
  mixed: '混合型', index: '指数型', qdii: 'QDII',
  bond: '债券型', money: '货币型', other: '其它',
};
const PIE_COLORS = ['#818cf8', '#34d399', '#fb7185', '#fbbf24', '#06b6d4', '#a78bfa', '#f472b6', '#38bdf8'];

const formatMoney = (n: number) =>
  n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ────────────────────── animation variants ────────────────────── */

const stagger = {
  container: { transition: { staggerChildren: 0.08 } },
  item: {
    initial: { opacity: 0, y: 30, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] } },
  },
};
const cardHover = {
  rest: { scale: 1, boxShadow: '0 0 0 rgba(99,102,241,0)' },
  hover: {
    scale: 1.015,
    boxShadow: '0 8px 32px rgba(99,102,241,0.15)',
    transition: { type: 'spring', stiffness: 300, damping: 20 },
  },
};
const modalBackdrop = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};
const modalContent = {
  hidden: { opacity: 0, scale: 0.9, y: 40 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 350, damping: 28 } },
  exit: { opacity: 0, scale: 0.92, y: 30, transition: { duration: 0.2 } },
};

/* ────────────────────── Animated Stat Card ────────────────────── */

function StatCard({
  label, value, prefix, suffix, color, icon, decimals = 2, delay = 0,
}: {
  label: string; value: number; prefix?: string; suffix?: string;
  color: string; icon: React.ReactNode; decimals?: number; delay?: number;
}) {
  return (
    <FadeIn delay={delay} direction="up">
      <motion.div
        className="relative overflow-hidden rounded-2xl p-4 backdrop-blur-xl cursor-default"
        variants={cardHover}
        initial="rest"
        whileHover="hover"
        style={{
          background: 'linear-gradient(135deg, rgba(17,23,41,0.9), rgba(22,29,51,0.8))',
          border: '1px solid rgba(99,118,168,0.12)',
        }}
      >
        <motion.div
          className="absolute inset-0 -translate-x-full pointer-events-none"
          animate={{ translateX: ['200%', '-200%'] }}
          transition={{ repeat: Infinity, repeatDelay: 4, duration: 2, ease: 'easeInOut' }}
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)' }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: color + '20' }}>
              {icon}
            </div>
            <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>{label}</span>
          </div>
          <div className="text-xl font-bold text-white tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <AnimatedNumber value={value} prefix={prefix ?? ''} suffix={suffix ?? ''} decimals={decimals} className="text-white" />
          </div>
        </div>
      </motion.div>
    </FadeIn>
  );
}

/* ────────────────────── Modal (AnimatePresence) ────────────────────── */

function AnimatedModal({
  open, onClose, title, children, icon,
}: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; icon?: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          variants={modalBackdrop}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-md rounded-2xl p-6 relative"
            variants={modalContent}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={e => e.stopPropagation()}
            style={{
              background: 'linear-gradient(145deg, #161d33, #0c1021)',
              border: '1px solid rgba(99,118,168,0.18)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.08) inset',
            }}
          >
            <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex items-center gap-3 mb-5">
              {icon && <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>{icon}</div>}
              <h3 className="text-lg font-bold text-white">{title}</h3>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ────────────────────── Buy / Sell / Add Modals ────────────────────── */

function BuyModal({ fund, onClose, onConfirm }: {
  fund: { code: string; name: string; currentNav: number } | null;
  onClose: () => void;
  onConfirm: (code: string, name: string, amount: number, nav: number) => void;
}) {
  const [amount, setAmount] = useState('');
  if (!fund) return null;
  return (
    <AnimatedModal open={true} onClose={onClose} title={'买入 ' + fund.name} icon={<ArrowUpRight className="w-5 h-5" style={{ color: '#34d399' }} />}>
      <div className="space-y-4">
        <div className="p-4 rounded-xl" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)' }}>
          <p className="text-sm text-gray-400">{'基金代码: '}{fund.code}</p>
          <p className="text-white font-semibold mt-1">{fund.name}</p>
          {fund.currentNav > 0 && (
            <p className="text-xs text-gray-500 mt-1">{'最新净值: ¥'}{fund.currentNav.toFixed(4)}</p>
          )}
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-2">{'申购金额 (元)'}</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder={'请输入金额'}
            className="w-full rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            style={{ background: 'rgba(15,20,40,0.8)', border: '1px solid rgba(99,118,168,0.15)' }} />
        </div>
        <div className="flex gap-2">
          {[100, 500, 1000, 5000].map(v => (
            <motion.button key={v} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setAmount(String(v))} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>
              {'¥'}{v}
            </motion.button>
          ))}
        </div>
        <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
          onClick={() => { if (amount && Number(amount) > 0) { onConfirm(fund.code, fund.name, Number(amount), fund.currentNav); onClose(); } }}
          className="w-full py-3.5 rounded-xl font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 16px rgba(99,102,241,0.3)' }}>
          {'确认买入'}
        </motion.button>
      </div>
    </AnimatedModal>
  );
}

function SellModal({ holding, onClose, onConfirm }: {
  holding: Holding | null; onClose: () => void;
  onConfirm: (code: string, name: string, sellShares: number) => void;
}) {
  const [pct, setPct] = useState(0);
  if (!holding) return null;
  const sellShares = Math.round(holding.shares * pct / 100 * 100) / 100;
  return (
    <AnimatedModal open={true} onClose={onClose} title={'卖出 ' + holding.name} icon={<ArrowDownRight className="w-5 h-5" style={{ color: '#fb7185' }} />}>
      <div className="space-y-4">
        <div className="p-4 rounded-xl" style={{ background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.15)' }}>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">{'可卖份额'}</span>
            <span className="text-white font-bold">{holding.shares.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-gray-400">{'最新净值'}</span>
            <span className="text-white font-bold">{'¥'}{holding.currentNav.toFixed(4)}</span>
          </div>
        </div>
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-400">{'贴出比例'}</span>
            <span className="text-white font-bold">{pct}%</span>
          </div>
          <input type="range" min={0} max={100} step={5} value={pct} onChange={e => setPct(Number(e.target.value))} className="w-full accent-rose-500" />
          <div className="flex justify-between text-xs mt-1" style={{ color: '#64748b' }}>
            {[0, 25, 50, 75, 100].map(v => (
              <button key={v} onClick={() => setPct(v)} className="hover:text-white transition-colors">{v}%</button>
            ))}
          </div>
        </div>
        <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(15,20,40,0.6)' }}>
          <p className="text-xs text-gray-500 mb-1">{'预计贴出金额'}</p>
          <p className="text-xl font-bold text-white">{'¥'}{formatMoney(sellShares * holding.currentNav)}</p>
        </div>
        <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
          onClick={() => { if (sellShares > 0) { onConfirm(holding.code, holding.name, sellShares); onClose(); } }}
          className="w-full py-3.5 rounded-xl font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #f43f5e, #fb7185)', boxShadow: '0 4px 16px rgba(244,63,94,0.3)' }}>
          {'确认卖出'}
        </motion.button>
      </div>
    </AnimatedModal>
  );
}

function AddFundModal({ open, onClose, onAdd, existing }: {
  open: boolean; onClose: () => void; onAdd: (fund: { code: string; name: string }) => void; existing: string[];
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Array<{ code: string; name: string; type: string }>>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) { setSearch(''); setResults([]); }
  }, [open]);
  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/funds/search?q=' + encodeURIComponent(search));
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const filtered = results.filter(f => !existing.includes(f.code));
  return (
    <AnimatedModal open={open} onClose={onClose} title={'添加基金'} icon={<Plus className="w-5 h-5" style={{ color: '#818cf8' }} />}>
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={'搜索基金名称或代码'}
            className="w-full rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            style={{ background: 'rgba(15,20,40,0.8)', border: '1px solid rgba(99,118,168,0.15)' }} />
        </div>
        <div className="max-h-60 overflow-y-auto space-y-1">
          {loading && <p className="text-center text-gray-500 py-4">{'搜索中...'}</p>}
          {!loading && search && filtered.length === 0 && (
            <p className="text-center text-gray-500 py-4">{'没有找到匹配的基金'}</p>
          )}
          {filtered.map((f, i) => (
            <motion.button key={f.code} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => { onAdd({ code: f.code, name: f.name }); onClose(); }}
              className="w-full text-left p-3 rounded-xl hover:bg-white/5 transition-colors flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">{f.name}</p>
                <p className="text-gray-500 text-xs mt-0.5">{f.code} · {TYPE_LABELS[normalizeType(f.type)] || f.type}</p>
              </div>
              <Plus className="w-4 h-4 text-indigo-400" />
            </motion.button>
          ))}
        </div>
      </div>
    </AnimatedModal>
  );
}

/* ────────────────────── Fund Card Component ────────────────────── */

function FundCard({
  h, index, onBuy, onSell, onDelete, onNavigate,
}: {
  h: Holding; index: number;
  onBuy: () => void; onSell: () => void; onDelete: () => void; onNavigate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPositive = h.navMissing ? true : h.dailyReturn >= 0;
  const dailyColor = h.navMissing ? '#64748b' : h.dailyReturn >= 0 ? '#34d399' : '#fb7185';
  const totalColor = h.navMissing ? '#64748b' : h.returnPct >= 0 ? '#34d399' : '#fb7185';

  return (
    <motion.div layout variants={stagger.item} initial="initial" animate="animate"
      className="relative overflow-hidden rounded-2xl backdrop-blur-xl"
      style={{ background: 'linear-gradient(145deg, rgba(17,23,41,0.95), rgba(15,20,40,0.85))', border: '1px solid rgba(99,118,168,0.1)' }}>
      <motion.div className="absolute inset-0 rounded-2xl opacity-0 pointer-events-none"
        whileHover={{ opacity: 1 }} transition={{ duration: 0.3 }}
        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.04))', filter: 'blur(30px)' }} />
      <div className="relative z-10 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 cursor-pointer" onClick={onNavigate}>
            <motion.div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold"
              whileHover={{ rotate: [0, -5, 5, 0] }} transition={{ duration: 0.4 }}
              style={{
                background: isPositive ? 'linear-gradient(135deg, rgba(52,211,153,0.2), rgba(52,211,153,0.08))' : 'linear-gradient(135deg, rgba(251,113,133,0.2), rgba(251,113,133,0.08))',
                color: isPositive ? '#34d399' : '#fb7185',
                border: '1px solid ' + (isPositive ? 'rgba(52,211,153,0.2)' : 'rgba(251,113,133,0.2)'),
              }}>
              {h.code.slice(-2)}
            </motion.div>
            <div>
              <div className="font-semibold text-white text-sm leading-tight">{h.name}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs" style={{ color: '#64748b' }}>{h.code}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>
                  {TYPE_LABELS[h.type] || h.type}
                </span>
                {h.navMissing && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5" style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
                    <AlertTriangle className="w-2.5 h-2.5" /> {'净值缺失'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={onBuy}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
              {'买入'}
            </motion.button>
            <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={onSell}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(251,113,133,0.12)', color: '#fb7185', border: '1px solid rgba(251,113,133,0.2)' }}>
              {'卖出'}
            </motion.button>
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onDelete}
              className="p-1.5 rounded-lg transition-all hover:bg-white/5" style={{ color: '#475569' }}>
              <Trash2 className="w-3.5 h-3.5" />
            </motion.button>
            <motion.button whileHover={{ scale: 1.1 }} onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg transition-all hover:bg-white/5" style={{ color: '#64748b' }}>
              <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.25 }}>
                <ChevronDown className="w-4 h-4" />
              </motion.div>
            </motion.button>
          </div>
        </div>
        <div className="flex items-end justify-between mb-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: '#475569' }}>{'持仓金额'}</div>
            <div className="text-lg font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {'¥'}{formatMoney(h.amount)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: '#475569' }}>{'今日收益'}</div>
            <div className="text-base font-bold flex items-center gap-1 justify-end" style={{ color: dailyColor, fontVariantNumeric: 'tabular-nums' }}>
              {h.navMissing ? '--' : (
                <>
                  {h.dailyReturn >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {h.dailyReturn >= 0 ? '+' : ''}{'¥'}{h.dailyReturn.toFixed(2)}
                </>
              )}
            </div>
          </div>
        </div>
        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1, transition: { duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] } }}
              exit={{ height: 0, opacity: 0, transition: { duration: 0.2 } }} className="overflow-hidden">
              <div className="pt-3 mt-2" style={{ borderTop: '1px solid rgba(99,118,168,0.08)' }}>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '昨日收益', value: h.navMissing ? '--' : (h.yesterdayReturn >= 0 ? '+' : '') + '¥' + h.yesterdayReturn.toFixed(2), color: h.navMissing ? '#64748b' : h.yesterdayReturn >= 0 ? '#34d399' : '#fb7185' },
                    { label: '累计收益%', value: h.navMissing ? '--' : (h.returnPct >= 0 ? '+' : '') + h.returnPct.toFixed(2) + '%', color: totalColor },
                    { label: '累计收益', value: h.navMissing ? '--' : (h.totalReturn >= 0 ? '+' : '') + '¥' + formatMoney(h.totalReturn), color: h.navMissing ? '#64748b' : h.totalReturn >= 0 ? '#34d399' : '#fb7185' },
                    { label: '持仓份额', value: h.shares.toFixed(2), color: '#e2e8f0' },
                    { label: '平均成本', value: h.avgCost > 0 ? h.avgCost.toFixed(4) : '--', color: '#e2e8f0' },
                    { label: '最新净值', value: h.currentNav > 0 ? h.currentNav.toFixed(4) : '--', color: '#e2e8f0' },
                    { label: '持仓比例', value: h.weight > 0 ? h.weight.toFixed(1) + '%' : '0.0%', color: '#818cf8' },
                    { label: '盈利率', value: h.navMissing ? '--' : (h.returnPct >= 0 ? '+' : '') + h.returnPct.toFixed(2) + '%', color: totalColor },
                    { label: '市值估算', value: h.currentNav > 0 && h.shares > 0 ? '¥' + formatMoney(h.currentNav * h.shares) : '--', color: '#e2e8f0' },
                  ].map((item, idx) => (
                    <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }} className="p-2.5 rounded-xl"
                      style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,118,168,0.06)' }}>
                      <div className="text-[10px] mb-0.5" style={{ color: '#475569' }}>{item.label}</div>
                      <div className="text-xs font-bold" style={{ color: item.color, fontVariantNumeric: 'tabular-nums' }}>{item.value}</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ────────────────────── Loading / Error states ────────────────────── */

function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary, #0c1021)' }}>
      <motion.div className="text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <motion.div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))', border: '1px solid rgba(99,102,241,0.2)' }}>
          <RefreshCw className="w-6 h-6" style={{ color: '#818cf8' }} />
        </motion.div>
        <p className="text-gray-400 font-medium">{'加载持仓数据...'}</p>
        <motion.div className="h-1 w-32 mx-auto mt-3 rounded-full overflow-hidden" style={{ background: 'rgba(99,102,241,0.1)' }}>
          <motion.div className="h-full rounded-full" animate={{ x: ['-100%', '100%'] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
            style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', width: '60%' }} />
        </motion.div>
      </motion.div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary, #0c1021)' }}>
      <motion.div className="text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <motion.div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }}
          style={{ background: 'rgba(251,113,133,0.12)', border: '1px solid rgba(251,113,133,0.2)' }}>
          <AlertTriangle className="w-6 h-6" style={{ color: '#fb7185' }} />
        </motion.div>
        <p className="text-gray-300 mb-4 font-medium">{error}</p>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onRetry}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 4px 16px rgba(99,102,241,0.3)' }}>
          {'重试'}
        </motion.button>
      </motion.div>
    </div>
  );
}

/* ────────────────────── Custom Tooltip ────────────────────── */

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(22,29,51,0.95)', border: '1px solid rgba(99,118,168,0.2)', backdropFilter: 'blur(8px)' }}>
      <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-bold text-white">{'¥'}{formatMoney(payload[0].value)}</p>
    </div>
  );
}

/* ────────────────────── Main Component ────────────────────── */

interface DashboardHolding {
  code: string; name: string; shares: number; avgCost: number;
  currentNav: number; marketValue: number; costValue: number;
  pnl: number; pnlPercent: number; todayPnl: number;
  todayPnlPercent: number; yesterdayPnl: number; weight: number; type: string;
  riskLevel: number; navMissing?: boolean;
}
interface DashboardData {
  totalAssets: number; totalCost: number; totalPnl: number; totalPnlPercent: number;
  todayPnl: number; todayPnlPercent: number; yesterdayPnl: number; yesterdayPnlPercent: number;
  cashBalance: number; holdingsCount: number; holdings: DashboardHolding[];
  recentTrades: unknown[]; dailyReturns: Array<{ date: string; ret: number }>;
}

export function MyHoldings() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buyFund, setBuyFund] = useState<{ code: string; name: string; currentNav: number } | null>(null);
  const [sellHolding, setSellHolding] = useState<Holding | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showAddFund, setShowAddFund] = useState(false);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'all' | string>('all');
  const [chartPeriod, setChartPeriod] = useState<'1M' | '3M'>('3M');
  const [refreshing, setRefreshing] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/portfolio/dashboard');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data: DashboardData = await res.json();
      setDashboardData(data);
      setHoldings(data.holdings.map(h => ({
        code: h.code, name: h.name, amount: h.marketValue,
        dailyReturn: h.todayPnl, yesterdayReturn: h.yesterdayPnl || 0,
        totalReturn: h.pnl, returnPct: h.pnlPercent,
        weight: h.weight, type: normalizeType(h.type), shares: h.shares,
        avgCost: h.avgCost, currentNav: h.currentNav, navMissing: !!h.navMissing,
      })));
      setLastRefresh(new Date());
      setPulseKey(k => k + 1);
      setError(null);
    } catch (err) {
      console.error('[Holdings] Failed to load dashboard:', err);
      setError('加载持仓数据失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const getInterval = () => {
      const h = new Date().getHours();
      return (h >= 19 && h < 21) ? 20 * 60 * 1000 : 60 * 1000;
    };
    let timer = setInterval(loadDashboard, getInterval());
    const resync = setInterval(() => {
      clearInterval(timer);
      timer = setInterval(loadDashboard, getInterval());
    }, 60 * 1000);
    return () => { clearInterval(timer); clearInterval(resync); };
  }, [loadDashboard]);

  const refreshAllHoldings = useCallback(async () => {
    setRefreshing(true);
    try { await fetch('/api/portfolio/sync', { method: 'POST' }); } catch (err) { console.error('[Holdings] Sync failed:', err); }
    await loadDashboard();
    setRefreshing(false);
  }, [loadDashboard]);

  const handleBuy = useCallback(async (code: string, name: string, amount: number, nav: number) => {
    try {
      const existing = holdings.find(h => h.code === code);
      const buyShares = nav > 0 ? Math.round(amount / nav * 100) / 100 : 0;
      const totalShares = (existing?.shares || 0) + buyShares;
      const totalCost = (existing?.shares || 0) * (existing?.avgCost || 0) + amount;
      const newAvgCost = totalShares > 0 ? Math.round(totalCost / totalShares * 10000) / 10000 : 0;
      await fetch('/api/portfolio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fundCode: code, fundName: name, shares: totalShares, avgCost: newAvgCost }),
      });
      await loadDashboard();
    } catch (err) { console.error('[Holdings] Buy failed:', err); }
  }, [holdings, loadDashboard]);

  const handleSell = useCallback(async (code: string, _name: string, sellShares: number) => {
    try {
      const existing = holdings.find(h => h.code === code);
      if (!existing) return;
      const remainingShares = Math.max(0, Math.round((existing.shares - sellShares) * 100) / 100);
      if (remainingShares <= 0.01) {
        await fetch('/api/portfolio/' + code, { method: 'DELETE' });
      } else {
        await fetch('/api/portfolio', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fundCode: code, fundName: existing.name, shares: remainingShares, avgCost: existing.avgCost }),
        });
      }
      await loadDashboard();
    } catch (err) { console.error('[Holdings] Sell failed:', err); }
  }, [holdings, loadDashboard]);

  const handleAddFund = useCallback(async (fund: { code: string; name: string }) => {
    try {
      await fetch('/api/portfolio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fundCode: fund.code, fundName: fund.name, shares: 0, avgCost: 0 }),
      });
      await loadDashboard();
    } catch (err) { console.error('[Holdings] Add fund failed:', err); }
  }, [loadDashboard]);

  const handleDelete = useCallback(async (code: string) => {
    try {
      await fetch('/api/portfolio/' + code, { method: 'DELETE' });
      await loadDashboard();
    } catch (err) { console.error('[Holdings] Delete failed:', err); }
  }, [loadDashboard]);

  const totalAssets = useMemo(() => holdings.reduce((s, h) => s + h.amount, 0), [holdings]);
  const totalDaily = useMemo(() => holdings.reduce((s, h) => s + h.dailyReturn, 0), [holdings]);
  const totalReturn = useMemo(() => holdings.reduce((s, h) => s + h.totalReturn, 0), [holdings]);
  const totalYesterday = useMemo(() => holdings.reduce((s, h) => s + h.yesterdayReturn, 0), [holdings]);
  const totalYesterdayPct = dashboardData?.yesterdayPnlPercent ?? (totalAssets > 0 ? (totalYesterday / (totalAssets - totalReturn) * 100) : 0);
  const totalDailyPct = dashboardData?.todayPnlPercent ?? (totalAssets > 0 ? (totalDaily / totalAssets * 100) : 0);
  const totalReturnPct = dashboardData?.totalPnlPercent ?? (totalAssets > 0 ? (totalReturn / (totalAssets - totalReturn) * 100) : 0);
  const bestPerformer = useMemo(() => {
    if (holdings.length === 0) return null;
    return [...holdings].filter(h => !h.navMissing).sort((a, b) => b.returnPct - a.returnPct)[0] ?? null;
  }, [holdings]);

  const pieData = useMemo(() => {
    const cats: Record<string, number> = {};
    holdings.forEach(h => { const label = TYPE_LABELS[h.type] || h.type; cats[label] = (cats[label] || 0) + h.amount; });
    return Object.entries(cats).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
  }, [holdings]);

  const filtered = activeTab === 'all' ? holdings : holdings.filter(h => h.type === activeTab);

  const portfolioHistory = useMemo(() => {
    if (!dashboardData?.dailyReturns || dashboardData.dailyReturns.length === 0) return [];
    let cumulative = totalAssets;
    const sorted = [...dashboardData.dailyReturns].sort((a, b) => a.date.localeCompare(b.date));
    for (const d of sorted) { cumulative = cumulative / (1 + d.ret / 100); }
    return sorted.map(d => {
      cumulative = cumulative * (1 + d.ret / 100);
      return { date: d.date.slice(5), value: Math.round(cumulative * 100) / 100, daily: d.ret };
    });
  }, [dashboardData, totalAssets]);

  const todayPnlColor = totalDaily >= 0 ? '#34d399' : '#fb7185';
  const totalPnlColor = totalReturn >= 0 ? '#34d399' : '#fb7185';

  const TABS = [
    { key: 'all', label: '全部', icon: <Layers className="w-3 h-3" /> },
    { key: 'mixed', label: '混合型', icon: <BarChart3 className="w-3 h-3" /> },
    { key: 'index', label: '指数型', icon: <Activity className="w-3 h-3" /> },
    { key: 'qdii', label: 'QDII', icon: <Target className="w-3 h-3" /> },
    { key: 'bond', label: '债券型', icon: <Wallet className="w-3 h-3" /> },
  ];

  if (loading) return <LoadingState />;
  if (error && holdings.length === 0) return <ErrorState error={error} onRetry={loadDashboard} />;

  return (
    <div className="min-h-screen pb-8" style={{ background: 'var(--bg-primary, #0c1021)' }}>
      {/* Hero Header */}
      <div className="px-4 pt-6 pb-2">
        <FadeIn direction="down">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <motion.div className="w-10 h-10 rounded-xl flex items-center justify-center"
                animate={{ rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 16px rgba(99,102,241,0.3)' }}>
                <Wallet className="w-5 h-5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">{'我的持仓'}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs" style={{ color: '#64748b' }}>{'真实持仓 · 实时更新'}</span>
                  {lastRefresh && (
                    <motion.span key={pulseKey} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                      style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.15)' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {lastRefresh.toLocaleTimeString('zh-CN')}
                    </motion.span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={refreshAllHoldings} disabled={refreshing}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: refreshing ? 'rgba(52,211,153,0.08)' : 'rgba(52,211,153,0.12)',
                  color: '#34d399', border: '1px solid rgba(52,211,153,0.25)',
                  boxShadow: refreshing ? 'none' : '0 2px 8px rgba(52,211,153,0.1)',
                }}>
                <motion.div animate={{ rotate: refreshing ? 360 : 0 }} transition={{ repeat: refreshing ? Infinity : 0, duration: 1, ease: 'linear' }}>
                  <RefreshCw className="w-4 h-4" />
                </motion.div>
                {refreshing ? '更新中..' : '刷新'}
              </motion.button>
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => setShowAddFund(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 4px 16px rgba(99,102,241,0.25)' }}>
                <Plus className="w-4 h-4" /> {'添加'}
              </motion.button>
            </div>
          </div>
        </FadeIn>
      </div>

      {/* Summary Hero Card */}
      <div className="px-4 mb-4">
        <FadeIn delay={0.1}>
          <motion.div className="relative overflow-hidden rounded-2xl p-5"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.08), rgba(6,182,212,0.06))', border: '1px solid rgba(99,118,168,0.12)', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <motion.div className="absolute -top-20 -right-20 w-40 h-40 rounded-full pointer-events-none"
              animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.25, 0.15] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
              style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.3), transparent 70%)' }} />
            <motion.div className="absolute -bottom-16 -left-16 w-32 h-32 rounded-full pointer-events-none"
              animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.2, 0.1] }}
              transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut', delay: 1 }}
              style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.2), transparent 70%)' }} />
            <div className="relative z-10">
              <div className="mb-4">
                <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>{'总资产'}</p>
                <motion.p key={totalAssets} initial={{ opacity: 0.5 }} animate={{ opacity: 1 }}
                  className="text-4xl font-bold text-white mt-1 tracking-tight"
                  style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {'¥'}<AnimatedNumber value={totalAssets} decimals={2} className="text-white" />
                </motion.p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: '今日盈亏', value: totalDaily, pct: totalDailyPct, icon: <Activity className="w-3.5 h-3.5" /> },
                  { label: '昨日收益', value: totalYesterday, pct: totalYesterdayPct, icon: <TrendingUp className="w-3.5 h-3.5" /> },
                  { label: '累计收益', value: totalReturn, pct: totalReturnPct, icon: <Sparkles className="w-3.5 h-3.5" /> },
                ].map((item, i) => {
                  const color = item.value >= 0 ? '#34d399' : '#fb7185';
                  return (
                    <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.08 }} className="p-3 rounded-xl"
                      style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(99,118,168,0.06)' }}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span style={{ color: '#64748b' }}>{item.icon}</span>
                        <span className="text-[11px]" style={{ color: '#64748b' }}>{item.label}</span>
                      </div>
                      <div className="font-bold text-sm flex items-center gap-1" style={{ color, fontVariantNumeric: 'tabular-nums' }}>
                        {item.value >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        <span>{item.value >= 0 ? '+' : ''}{'¥'}{formatMoney(item.value)}</span>
                      </div>
                      <div className="text-[10px] mt-0.5 font-medium" style={{ color: color + '99' }}>
                        {item.pct >= 0 ? '+' : ''}{item.pct.toFixed(2)}%
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </FadeIn>
      </div>

      {/* Stat Cards */}
      <div className="px-4 mb-4 grid grid-cols-2 gap-3">
        <StatCard label={'持仓数量'} value={holdings.length} suffix={' 只'}
          color="#818cf8" icon={<Layers className="w-4 h-4" style={{ color: '#818cf8' }} />} decimals={0} delay={0.15} />
        <StatCard label={bestPerformer ? '最佳表现' : '平均收益率'}
          value={bestPerformer ? bestPerformer.returnPct : totalReturnPct} prefix="" suffix="%"
          color="#34d399" icon={<Sparkles className="w-4 h-4" style={{ color: '#34d399' }} />} delay={0.22} />
      </div>

      {/* Pie Chart */}
      <div className="px-4 mb-4">
        <FadeIn delay={0.2}>
          <motion.div className="relative overflow-hidden rounded-2xl p-5 backdrop-blur-xl"
            style={{ background: 'linear-gradient(145deg, rgba(22,29,51,0.9), rgba(15,20,40,0.8))', border: '1px solid rgba(99,118,168,0.1)' }}>
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
                <BarChart3 className="w-3.5 h-3.5" style={{ color: '#818cf8' }} />
              </div>
              {'资产配置'}
            </h3>
            <div className="flex items-center">
              <div style={{ width: 140, height: 140 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={58} paddingAngle={3} dataKey="value"
                      animationBegin={200} animationDuration={800}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number | string) => '¥' + formatMoney(Number(v ?? 0))}
                      contentStyle={{ background: '#161d33', border: '1px solid rgba(99,118,168,0.2)', borderRadius: 12, color: '#fff', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2.5 pl-2">
                {pieData.map((d, i) => (
                  <motion.div key={d.name} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.06 }} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <motion.div className="w-2.5 h-2.5 rounded-full" animate={{ scale: [1, 1.3, 1] }}
                        transition={{ repeat: Infinity, duration: 3, delay: i * 0.3 }}
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-sm" style={{ color: '#94a3b8' }}>{d.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-white">{'¥'}{formatMoney(d.value)}</span>
                      <span className="text-[10px] ml-1" style={{ color: '#64748b' }}>
                        ({totalAssets > 0 ? ((d.value / totalAssets) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </FadeIn>
      </div>

      {/* Portfolio History Chart */}
      <div className="px-4 mb-4">
        <FadeIn delay={0.25}>
          <motion.div className="relative overflow-hidden rounded-2xl p-5 backdrop-blur-xl"
            style={{ background: 'linear-gradient(145deg, rgba(22,29,51,0.9), rgba(15,20,40,0.8))', border: '1px solid rgba(99,118,168,0.1)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.15)' }}>
                  <Activity className="w-3.5 h-3.5" style={{ color: '#34d399' }} />
                </div>
                {'净值走势'}
              </h3>
              <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'rgba(99,102,241,0.06)' }}>
                {(['1M', '3M'] as const).map(p => (
                  <motion.button key={p} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => setChartPeriod(p)} className="px-3 py-1 rounded-md text-xs font-semibold transition-all"
                    style={chartPeriod === p
                      ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }
                      : { color: '#64748b' }}>
                    {p}
                  </motion.button>
                ))}
              </div>
            </div>
            <div style={{ height: 220 }}>
              {portfolioHistory.length > 0 ? (
                <ResponsiveContainer>
                  <AreaChart data={chartPeriod === '1M' ? portfolioHistory.slice(-30) : portfolioHistory}>
                    <defs>
                      <linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.35} />
                        <stop offset="50%" stopColor="#818cf8" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,118,168,0.06)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#475569' }} domain={['dataMin - 50', 'dataMax + 50']} axisLine={false} tickLine={false} width={55} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="value" stroke="#818cf8" strokeWidth={2.5}
                      fill="url(#gradArea)" animationDuration={1200} dot={false}
                      activeDot={{ r: 4, fill: '#818cf8', stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">{'暂无走势数据'}</div>
              )}
            </div>
          </motion.div>
        </FadeIn>
      </div>

      {/* Holdings List */}
      <div className="px-4 mb-4">
        <FadeIn delay={0.3}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
                <Wallet className="w-3.5 h-3.5" style={{ color: '#818cf8' }} />
              </div>
              {'持仓明细'}
              <span className="text-[10px] px-2 py-0.5 rounded-full font-normal" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>
                {holdings.length}{'只'}
              </span>
            </h3>
          </div>
        </FadeIn>
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {TABS.map((tab, i) => (
            <motion.button key={tab.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32 + i * 0.04 }} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all"
              style={activeTab === tab.key
                ? { background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)', boxShadow: '0 2px 8px rgba(99,102,241,0.15)' }
                : { background: 'rgba(99,102,241,0.04)', color: '#64748b', border: '1px solid transparent' }}>
              {tab.icon}
              {tab.label}
            </motion.button>
          ))}
        </div>
        <motion.div className="space-y-3" variants={stagger.container} initial="initial" animate="animate">
          {filtered.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3 }}>
                <Wallet className="w-10 h-10 mx-auto mb-3 opacity-20" />
              </motion.div>
              <p className="text-gray-500 mb-3">{'暂无持仓'}</p>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setShowAddFund(true)} className="text-sm font-semibold px-4 py-2 rounded-xl"
                style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>
                {'添加基金'}
              </motion.button>
            </motion.div>
          )}
          {filtered.map((h, i) => (
            <FundCard key={h.code} h={h} index={i}
              onBuy={() => setBuyFund({ code: h.code, name: h.name, currentNav: h.currentNav })}
              onSell={() => setSellHolding(h)}
              onDelete={() => { if (confirm('确认删除该持仓？')) handleDelete(h.code); }}
              onNavigate={() => navigate('/fund/' + h.code)} />
          ))}
        </motion.div>
      </div>

      {/* Footer */}
      <div className="px-4 mt-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="p-3 rounded-xl flex items-center justify-between"
          style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,118,168,0.06)' }}>
          <div className="flex items-center gap-2 text-xs" style={{ color: '#475569' }}>
            <RefreshCw className="w-3 h-3" />
            <span>{'每60秒自动刷新 · 数据来源: 后端持仓数据库'}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px]" style={{ color: '#34d399' }}>{'实时'}</span>
          </div>
        </motion.div>
      </div>

      {/* Modals */}
      <BuyModal fund={buyFund} onClose={() => setBuyFund(null)} onConfirm={handleBuy} />
      <SellModal holding={sellHolding} onClose={() => setSellHolding(null)} onConfirm={handleSell} />
      <AddFundModal open={showAddFund} onClose={() => setShowAddFund(false)} onAdd={handleAddFund} existing={holdings.map(h => h.code)} />
    </div>
  );
}
