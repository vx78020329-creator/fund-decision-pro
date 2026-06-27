import { create } from 'zustand';
import type { FundFilter } from '@/types/fund';

interface FundState {
  filter: FundFilter;
  setFilter: (partial: Partial<FundFilter>) => void;
  resetFilter: () => void;
  toggleSort: (key: string) => void;
}

const defaultFilter: FundFilter = {
  keyword: '',
  type: 'all',
  sortBy: 'totalReturn1y',
  sortOrder: 'desc',
  riskLevel: 0,
  page: 1,
  pageSize: 50,
};

export const useFundStore = create<FundState>((set) => ({
  filter: { ...defaultFilter },
  setFilter: (partial) =>
    set((state) => ({
      filter: { ...state.filter, ...partial, ...(partial.type !== undefined || partial.keyword !== undefined ? { page: 1 } : {}) },
    })),
  resetFilter: () => set({ filter: { ...defaultFilter } }),
  toggleSort: (key: string) => set((state) => ({
    filter: {
      ...state.filter,
      sortBy: key as any,
      sortOrder: state.filter.sortBy === key && state.filter.sortOrder === 'desc' ? 'asc' : 'desc',
    },
  })),
}));
