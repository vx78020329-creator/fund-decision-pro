export type FundType = 'stock' | 'mixed' | 'index' | 'etf' | 'bond' | 'qdii' | 'money' | 'fof';

export type RiskLevel = 1 | 2 | 3 | 4 | 5;

export interface Fund {
  code: string;
  name: string;
  type: FundType;
  nav: number;
  accNav: number;
  dailyReturn: number;
  totalReturn1y: number;
  totalReturn3y: number;
  size: number;
  riskLevel: RiskLevel;
  manager: string;
  company: string;
  establishDate: string;
  benchmark: string;
  fee: { manage: number; custody: number; purchase: number; redeem: number; };
}

export interface FundFilter {
  keyword: string;
  type: FundType | 'all';
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  riskLevel: RiskLevel | 0;
  page: number;
  pageSize: number;
}

export interface FundNavPoint { date: string; nav: number; return: number; }

export interface FundHolding { name: string; code: string; weight: number; industry: string; }
