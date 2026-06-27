import type { RiskLevel, FundType } from '@/types/fund';

export function formatPercent(v: number, digits = 2): string {
  const s = v >= 0 ? '+' : '';
  return s + v.toFixed(digits) + '%';
}

export function formatMoney(v: number): string {
  if (v >= 1e12) return (v / 1e12).toFixed(2) + '万亿';
  if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (v >= 1e4) return (v / 1e4).toFixed(2) + '万';
  return v.toFixed(2);
}

export function formatNav(v: number): string {
  return v.toFixed(4);
}

export function formatDate(d: string): string {
  return d.replace(/-/g, '/');
}

export function riskLabel(l: RiskLevel): string {
  const m: Record<RiskLevel, string> = { 1: '低风险', 2: '中低风险', 3: '中风险', 4: '中高风险', 5: '高风险' };
  return m[l];
}

export function riskColor(l: RiskLevel): string {
  const m: Record<RiskLevel, string> = { 1: '#22c55e', 2: '#84cc16', 3: '#eab308', 4: '#f97316', 5: '#ef4444' };
  return m[l];
}

export function fundTypeLabel(t: FundType): string {
  const m: Record<FundType, string> = {
    stock: '股票型', mixed: '混合型', index: '指数型', etf: 'ETF',
    bond: '债券型', qdii: 'QDII', money: '货币型', fof: 'FOF',
  };
  return m[t];
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
