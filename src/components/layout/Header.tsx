import { Search, Bell, Zap } from 'lucide-react';
import { useFundStore } from '@/stores/fundStore';

export function Header() {
  const { filter, setFilter } = useFundStore();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 h-14 flex items-center px-5"
      style={{
        background: 'rgba(6,8,15,0.85)',
        backdropFilter: 'blur(16px) saturate(1.2)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 mr-6 shrink-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
          style={{ background: 'var(--gradient-brand)' }}
        >
          基
        </div>
        <span className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          决策宝
        </span>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="搜索基金名称、代码.."
          value={filter.keyword}
          onChange={(e) => setFilter({ keyword: e.target.value })}
          className="input-search"
          style={{ paddingLeft: '40px' }}
        />
      </div>

      {/* Right */}
      <div className="flex items-center gap-3 ml-auto">
        <button
          className="relative p-2 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <Bell className="w-[18px] h-[18px]" />
          <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: 'var(--accent-rose)' }} />
        </button>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
          style={{ background: 'rgba(99,102,241,0.08)' }}
        >
          <Zap className="w-3.5 h-3.5" style={{ color: 'var(--accent-indigo)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--accent-indigo)' }}>AI 就绪</span>
        </div>
      </div>
    </header>
  );
}