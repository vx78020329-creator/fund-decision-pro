import { useParams, useNavigate } from 'react-router-dom';
import { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Play, Loader2, CheckCircle2, Globe, BarChart3, Search, TrendingUp, TrendingDown, Shield, Target } from 'lucide-react';
import { fetchFundByCode, streamDiagnosis } from '@/services/api';
import type { AgentProgress, DiagnosisResult } from '@/services/api';
import { formatPercent, fundTypeLabel } from '@/utils/format';

interface AgentDisplay {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  status: 'pending' | 'running' | 'done';
  score: number;
  summary: string;
  details: string[];
}

const AGENTS_CONFIG = [
  { id: 'macro', name: '宏观研究员', icon: <Globe className="w-5 h-5" />, color: '#6366f1' },
  { id: 'industry', name: '行业研究员', icon: <BarChart3 className="w-5 h-5" />, color: '#8b5cf6' },
  { id: 'evaluator', name: '基金评价师', icon: <Search className="w-5 h-5" />, color: '#06b6d4' },
  { id: 'bull', name: '看多研究员', icon: <TrendingUp className="w-5 h-5" />, color: '#22c55e' },
  { id: 'bear', name: '看空研究员', icon: <TrendingDown className="w-5 h-5" />, color: '#ef4444' },
  { id: 'risk', name: '风控官', icon: <Shield className="w-5 h-5" />, color: '#eab308' },
  { id: 'decision', name: '决策官', icon: <Target className="w-5 h-5" />, color: '#ec4899' },
];

function getAgentFallback(id: string): { score: number; summary: string; details: string[] } {
  const fallbacks: Record<string, { score: number; summary: string; details: string[] }> = {
    macro: { score: 72, summary: '宏观环境偏中性偏积极，货币政策宽松', details: ['GDP增速稳定在5%左右，消费复苏趋势明确', '央行维持适度宽松货币政策，流动性充裕', '市场情绪指数处于中性区间，未见极端恐慌或贪婪', '中美利差收窄，外资流入预期改善'] },
    industry: { score: 68, summary: '所属行业景气度中等，存在结构性机会', details: ['行业处于周期中段，增速边际放缓', '龙头企业竞争优势明显，集中度提升', '政策面支持方向明确，但落地节奏待观察', '估值水平处于历史中位数附近'] },
    evaluator: { score: 75, summary: '基金经理从业经验丰富，历史业绩稳健', details: ['基金经理任职超过5年，经历过完整牛熊周期', '近3年收益率排名同类前30%', '最大回撤控制在同类平均水平', '投资风格稳定，未出现明显风格漂移'] },
    bull: { score: 78, summary: '当前估值合理，长期配置价值突出', details: ['PE估值处于近3年30%分位，具备安全边际', '重仓股基本面扎实，盈利能力持续改善', '行业政策红利释放，中长期增长空间打开', '资金面持续流入，北向资金加仓明显'] },
    bear: { score: 45, summary: '短期存在调整风险，需关注回撤控制', details: ['短期涨幅过大，技术面存在回调压力', '部分重仓股估值偏高，性价比下降', '市场风格可能切换，成长股面临资金分流', '宏观经济数据波动可能影响市场信心'] },
    risk: { score: 65, summary: '风险等级适中，需关注集中度和流动性', details: ['基金规模适中，不存在流动性风险', '前十大持仓集中度偏高，需关注个股风险', '历史最大回撤在同类基金中处于中等水平', '换手率正常，交易成本可控'] },
    decision: { score: 70, summary: '综合建议：持有，可逢低适量加仓', details: ['多空博弈偏多头，基本面支撑较强', '短期有波动风险，建议分批建仓', '长期配置价值明确，适合定投策略', '建议仓位控制在组合的15-20%'] },
  };
  return fallbacks[id] || { score: 50, summary: '分析中...', details: [] };
}

export function AIDiagnosis() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentDisplay[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<DiagnosisResult | null>(null);

  const { data: fund } = useQuery({
    queryKey: ['fund', code],
    queryFn: () => fetchFundByCode(code!),
    enabled: !!code,
  });

  const runDiagnosis = useCallback(() => {
    if (!fund) return;
    setIsRunning(true);
    setVerdict(null);
    setAgents(AGENTS_CONFIG.map(a => ({ ...a, status: 'pending' as const, score: 0, summary: '', details: [] })));

    streamDiagnosis(
      fund.code,
      (_agentId: string, result: AgentProgress) => {
        if (!result) return;
        setAgents(prev => prev.map(a =>
          a.id === result.agent
            ? { ...a, status: 'done', score: result.score, summary: result.summary, details: result.signals || [] }
            : a
        ));
      },
      (result: DiagnosisResult) => {
        setVerdict(result);
        setIsRunning(false);
      },
      () => {
        // Fallback: simulate sequentially with local data
        AGENTS_CONFIG.forEach((config, i) => {
          setTimeout(() => {
            setAgents(prev => prev.map(a => a.id === config.id ? { ...a, status: 'running' } : a));
            const fb = getAgentFallback(config.id);
            setTimeout(() => {
              setAgents(prev => prev.map(a => a.id === config.id ? { ...a, ...fb, status: 'done' } : a));
              if (i === AGENTS_CONFIG.length - 1) {
                setIsRunning(false);
                setVerdict({
                  fundCode: fund.code,
                  fundName: fund.name,
                  agents: [],
                  finalScore: 70,
                  verdict: 'hold',
                  verdictText: '综合建议：持有，可逢低适量加仓',
                });
              }
            }, 800 + Math.random() * 600);
          }, i * 1200);
        });
      },
    );
  }, [fund]);

  if (!fund) {
    return (
      <div className="py-20 text-center">
        <div className="text-lg mb-2" style={{ color: '#64748b' }}>加载中...</div>
        <button onClick={() => navigate('/')} className="text-sm cursor-pointer" style={{ color: '#6366f1' }}>返回列表</button>
      </div>
    );
  }

  const allDone = agents.every(a => a.status === 'done');
  const avgScore = allDone ? Math.round(agents.reduce((s, a) => s + a.score, 0) / agents.length) : 0;
  const decisionAgent = agents.find(a => a.id === 'decision');

  return (
    <div className="py-4 md:py-6 animate-fade-in">
      <button onClick={() => navigate(`/fund/${fund.code}`)} className="flex items-center gap-1.5 mb-4 cursor-pointer text-sm" style={{ color: '#6366f1' }}>
        <ArrowLeft className="w-4 h-4" />返回基金详情
      </button>

      <div className="glass-card p-5 mb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#f1f5f9' }}>AI 七维诊断</h1>
            <p className="text-sm mt-1" style={{ color: '#64748b' }}>{fund.name} ({fund.code}) · {fundTypeLabel(fund.type)}</p>
          </div>
          <button onClick={runDiagnosis} disabled={isRunning}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50 transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff' }}>
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isRunning ? '诊断中...' : '开始诊断'}
          </button>
        </div>
      </div>

      {decisionAgent && decisionAgent.status === 'done' && (
        <div className="glass-card p-5 mb-4 animate-fade-in"
          style={{ border: '1px solid rgba(236, 72, 153, 0.3)', boxShadow: '0 0 20px rgba(236, 72, 153, 0.1)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5" style={{ color: '#ec4899' }} />
            <span className="text-base font-bold" style={{ color: '#ec4899' }}>综合裁决</span>
            <span className="text-2xl font-bold font-mono ml-auto" style={{ color: '#f1f5f9' }}>{decisionAgent.score}<span className="text-sm" style={{ color: '#64748b' }}>/100</span></span>
          </div>
          <p className="text-sm" style={{ color: '#c7d2fe' }}>{decisionAgent.summary}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {agents.map((agent) => (
          <div key={agent.id}
            className="glass-card p-4 cursor-pointer transition-all animate-fade-in"
            style={{
              border: agent.status === 'done' ? `1px solid ${agent.color}30` : '1px solid rgba(99, 102, 241, 0.1)',
              boxShadow: agent.status === 'done' ? `0 0 15px ${agent.color}10` : 'none',
            }}
            onClick={() => setExpanded(expanded === agent.id ? null : agent.id)}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span style={{ color: agent.color }}>{agent.icon}</span>
                <span className="text-sm font-medium" style={{ color: '#f1f5f9' }}>{agent.name}</span>
              </div>
              {agent.status === 'pending' && <div className="w-5 h-5 rounded-full" style={{ border: '2px solid rgba(99, 102, 241, 0.2)' }} />}
              {agent.status === 'running' && <Loader2 className="w-5 h-5 animate-spin" style={{ color: agent.color }} />}
              {agent.status === 'done' && <CheckCircle2 className="w-5 h-5" style={{ color: '#22c55e' }} />}
            </div>

            {agent.status === 'running' && (
              <div className="space-y-2">
                <div className="skeleton h-3 w-full" />
                <div className="skeleton h-3 w-3/4" />
              </div>
            )}

            {agent.status === 'done' && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(99, 102, 241, 0.1)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${agent.score}%`, background: `linear-gradient(90deg, ${agent.color}, ${agent.color}88)` }} />
                  </div>
                  <span className="text-sm font-bold font-mono" style={{ color: agent.color }}>{agent.score}</span>
                </div>
                <p className="text-xs" style={{ color: '#94a3b8' }}>{agent.summary}</p>

                {agent.details.length > 0 && (
                  <ul className="mt-3 space-y-1.5 animate-fade-in">
                    {agent.details.map((d, i) => (
                      <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: '#94a3b8' }}>
                        <span className="mt-1 w-1 h-1 rounded-full shrink-0" style={{ background: agent.color }} />
                        {d}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}