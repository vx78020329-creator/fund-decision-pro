import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { TrendingUp, TrendingDown, Shield, Target, Play, Loader2, Search } from 'lucide-react';
import { fetchFunds, runDebate } from '@/services/api';
import { fundTypeLabel, formatPercent } from '@/utils/format';
import type { Fund } from '@/types/fund';

interface Message {
  id: string;
  agent: string;
  icon: React.ReactNode;
  color: string;
  text: string;
  round: number;
}

export function AIDebate() {
  const location = useLocation();
  const navState = location.state as { fundCode?: string; fundName?: string } | null;
  const [selectedFund, setSelectedFund] = useState<string>(navState?.fundCode || '');
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [round, setRound] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [funds, setFunds] = useState<Fund[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Load funds with useEffect instead of useQuery to avoid refetch issues
  useEffect(() => {
    let cancelled = false;
    fetchFunds({ keyword: searchTerm, pageSize: 30 }).then(result => {
      if (!cancelled && mountedRef.current && result) {
        setFunds(result.funds || []);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [searchTerm]);

  const runDebateFlow = async () => {
    if (!selectedFund || isRunning) return;
    setIsRunning(true);
    setMessages([]);
    setRound(0);

    try {
      const result = await runDebate(selectedFund);

      if (!mountedRef.current) return;

      if (result && result.rounds && result.rounds.length > 0) {
        const iconMap: Record<string, React.ReactNode> = {
          '看多研究员': <TrendingUp className="w-4 h-4" />,
          '看空研究员': <TrendingDown className="w-4 h-4" />,
          '风控官': <Shield className="w-4 h-4" />,
          '决策官': <Target className="w-4 h-4" />,
        };
        const colorMap: Record<string, string> = {
          '看多研究员': '#22c55e',
          '看空研究员': '#ef4444',
          '风控官': '#eab308',
          '决策官': '#ec4899',
        };

        const allMessages: Message[] = result.rounds.map((r, i) => ({
          id: `${r.round}-${r.speaker}-${i}`,
          agent: r.speaker,
          icon: iconMap[r.speaker] || <Target className="w-4 h-4" />,
          color: colorMap[r.speaker] || '#a5b4fc',
          text: r.content,
          round: r.round,
        }));

        if (mountedRef.current) {
          setMessages(allMessages);
          setRound(result.rounds[result.rounds.length - 1].round);
        }
      } else {
        // Fallback
        if (mountedRef.current) {
          setMessages([
            { id: 'f1', agent: '看多研究员', icon: <TrendingUp className="w-4 h-4" />, color: '#22c55e', text: '基本面稳健，估值合理，具备中长期配置价值。重仓股盈利改善，PE处于历史低位。', round: 1 },
            { id: 'f2', agent: '看空研究员', icon: <TrendingDown className="w-4 h-4" />, color: '#ef4444', text: '短期涨幅偏大，存在回调压力。技术面超买，市场风格可能切换。', round: 1 },
            { id: 'f3', agent: '风控官', icon: <Shield className="w-4 h-4" />, color: '#eab308', text: '风险可控，但需注意集中度。建议定投分散风险，单次投入不超过20%。', round: 3 },
            { id: 'f4', agent: '决策官', icon: <Target className="w-4 h-4" />, color: '#ec4899', text: '综合裁决：持有观望。多空势均力敌，建议维持仓位等待方向信号。', round: 4 },
          ]);
          setRound(4);
        }
      }
    } catch (err) {
      console.error('[debate] error:', err);
      if (mountedRef.current) {
        setMessages([
          { id: 'err', agent: '决策官', icon: <Target className="w-4 h-4" />, color: '#f59e0b', text: '辩论服务暂时不可用，请稍后重试。', round: 1 },
        ]);
      }
    } finally {
      if (mountedRef.current) setIsRunning(false);
    }
  };

  const fund = funds.find((f) => f.code === selectedFund);

  return (
    <div className="py-4 md:py-6 animate-fade-in">
      <h1 className="text-xl font-bold mb-1" style={{ color: '#f1f5f9' }}>AI 多空辩论</h1>
      <p className="text-sm mb-6" style={{ color: '#64748b' }}>看多 vs 看空研究员激烈交锋，风控官把关，决策官裁决</p>

      <div className="glass-card p-5 mb-4">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1">
            <label className="text-xs mb-2 block" style={{ color: '#64748b' }}>选择辩论基金</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#64748b' }} />
              <input type="text" placeholder="搜索基金..." value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(99, 102, 241, 0.15)', color: '#f1f5f9' }}
              />
            </div>
            <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
              {funds.slice(0, 15).map((f) => (
                <div key={f.code}
                  onClick={() => { setSelectedFund(f.code); setSearchTerm(''); }}
                  className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all"
                  style={{
                    background: selectedFund === f.code ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                    border: `1px solid ${selectedFund === f.code ? 'rgba(99, 102, 241, 0.3)' : 'transparent'}`,
                  }}>
                  <div>
                    <span className="text-sm" style={{ color: '#f1f5f9' }}>{f.name}</span>
                    <span className="text-xs ml-2" style={{ color: '#64748b' }}>{f.code}</span>
                  </div>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#a5b4fc' }}>
                    {fundTypeLabel(f.type)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-start">
            <button onClick={runDebateFlow} disabled={isRunning || !selectedFund}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50 transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff' }}>
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {isRunning ? '辩论进行中...' : '开始辩论'}
            </button>
            {!selectedFund && (
              <p className="text-xs mt-2" style={{ color: '#f59e0b' }}>
                请先选择一只基金
              </p>
            )}
          </div>
        </div>
      </div>

      {fund && (
        <div className="glass-card p-3 mb-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-sm font-medium" style={{ color: '#f1f5f9' }}>{fund.name}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs" style={{ color: '#64748b' }}>{fund.code}</span>
                <span className="text-xs" style={{ color: fund.dailyReturn >= 0 ? '#22c55e' : '#ef4444' }}>{formatPercent(fund.dailyReturn)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {isRunning && (
        <div className="flex items-center justify-center gap-3 mb-4">
          {[1, 2, 3, 4].map(r => (
            <div key={r} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: round >= r ? '#6366f1' : 'rgba(99, 102, 241, 0.2)' }} />
              <span className="text-xs" style={{ color: round >= r ? '#a5b4fc' : '#64748b' }}>
                {r === 1 ? '立论' : r === 2 ? '反驳' : r === 3 ? '风控' : '裁决'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className="glass-card p-4 animate-fade-in"
            style={{ borderLeft: `3px solid ${msg.color}` }}>
            <div className="flex items-center gap-2 mb-2">
              <span style={{ color: msg.color }}>{msg.icon}</span>
              <span className="text-sm font-medium" style={{ color: msg.color }}>{msg.agent}</span>
              <span className="text-xs ml-auto" style={{ color: '#64748b' }}>第{msg.round}轮</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#c7d2fe' }}>{msg.text}</p>
          </div>
        ))}
      </div>

      {messages.length === 0 && !isRunning && (
        <div className="py-20 text-center">
          <div className="text-sm" style={{ color: '#64748b' }}>选择基金并开始辩论</div>
        </div>
      )}
    </div>
  );
}
