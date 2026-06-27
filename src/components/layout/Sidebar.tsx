import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Brain, BarChart3, Wallet, PieChart, ArrowRightLeft, Newspaper, ShieldAlert, MessageCircle, Settings, Sparkles, GraduationCap, Activity } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: '\u57fa\u91d1\u51b3\u7b56\u5b9d' },
  { to: '/dashboard', icon: BarChart3, label: '\u603b\u89c8\u4eea\u8868\u76d8' },
  { to: '/holdings', icon: Wallet, label: '\u6211\u7684\u6301\u4ed3' },
  { to: '/analysis', icon: Activity, label: '\u6bcf\u65e5\u5206\u6790' },
  { to: '/learning', icon: GraduationCap, label: '\u5b66\u4e60\u4e2d\u5fc3' },
  { to: '/debate', icon: Brain, label: 'AI \u8fa9\u8bba' },
  { to: '/portfolio', icon: PieChart, label: '\u6a21\u62df\u6295\u8d44\u7ec4\u5408' },
  { to: '/simtrade', icon: ArrowRightLeft, label: '\u6a21\u62df\u4ea4\u6613' },
  { to: '/news', icon: Newspaper, label: '\u5b9e\u65f6\u8d44\u8baf' },
  { to: '/risk', icon: ShieldAlert, label: '\u98ce\u9669\u76d1\u63a7' },
  { to: '/chat', icon: MessageCircle, label: 'AI \u804a\u5929' },
  { to: '/settings', icon: Settings, label: '\u8bbe\u7f6e' },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed top-0 left-0 h-screen z-30 pt-[60px] overflow-y-auto scrollbar-hide" style={{ width: '220px', background: '#0c1021', borderRight: '1px solid rgba(99, 118, 168, 0.08)' }}>
      <nav className="flex flex-col gap-0.5 mt-2">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.to ||
            (item.to !== '/' && location.pathname.startsWith(item.to));
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              style={{ position: 'relative' }}
            >
              <item.icon className="w-[18px] h-[18px] shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-auto pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="p-3 rounded-xl" style={{ background: 'rgba(99,102,241,0.06)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4" style={{ color: 'var(--accent-indigo)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{'\u667a\u80fd\u4f53\u7cfb'}</span>
          </div>
          <div className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {'7\u5927\u667a\u80fd\u4f53\u534f\u540c\u5206\u6790'}<br />
            {'\u5b8f\u89c2\u00b7\u884c\u4e1a\u00b7\u57fa\u91d1\u00b7\u591a\u5934\u00b7\u7a7a\u5934\u00b7\u98ce\u63a7\u00b7\u51b3\u7b56'}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent-emerald)' }} />
            <span className="text-[10px] font-medium" style={{ color: 'var(--accent-emerald)' }}>{'\u5168\u7ebf\u8fd0\u884c\u4e2d'}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
