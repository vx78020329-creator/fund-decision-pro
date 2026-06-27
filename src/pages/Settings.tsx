import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Moon, Bell, Shield, Palette, Key, Save, Check, Loader2, Wifi, WifiOff } from 'lucide-react';

interface SettingSection { id: string; label: string; icon: React.ReactNode; }

const SECTIONS: SettingSection[] = [
  { id: 'general', label: '通用设置', icon: <SettingsIcon className="w-4 h-4" /> },
  { id: 'display', label: '显示偏好', icon: <Palette className="w-4 h-4" /> },
  { id: 'notification', label: '通知设置', icon: <Bell className="w-4 h-4" /> },
  { id: 'risk', label: '风控参数', icon: <Shield className="w-4 h-4" /> },
  { id: 'api', label: 'AI 模型配置', icon: <Key className="w-4 h-4" /> },
];

const API_BASE = '/api';

export function Settings() {
  const [section, setSection] = useState('api');
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({
    theme: 'dark',
    language: 'zh-CN',
    pageSize: 20,
    defaultSort: 'totalReturn1y',
    notifications: { price: true, news: true, risk: true, dca: true },
    risk: { maxDrawdown: 15, maxConcentration: 20, alertEnabled: true },
    api: { model: 'mimo-v2.5-pro', endpoint: '', apiKey: '', liteModel: 'Qwen/Qwen2.5-7B-Instruct' },
    _hasApiKey: false as boolean,
  });

  useEffect(() => {
    fetch(API_BASE + '/settings')
      .then(r => r.json())
      .then(s => {
        const hasKey = s._hasApiKey || false;
        setConfig(c => ({ ...c, api: { model: s.AI_MODEL || 'mimo-v2.5-pro', endpoint: s.AI_BASE_URL || '', apiKey: s.AI_API_KEY || '', liteModel: s.AI_LITE_MODEL || 'Qwen/Qwen2.5-7B-Instruct' }, _hasApiKey: hasKey }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    try {
      const body: Record<string, string> = {};
      if (config.api.model) body.AI_MODEL = config.api.model;
      if (config.api.endpoint) body.AI_BASE_URL = config.api.endpoint;
      if (config.api.apiKey && !config.api.apiKey.includes('****')) body.AI_API_KEY = config.api.apiKey;
      if (config.api.liteModel) body.AI_LITE_MODEL = config.api.liteModel;

      const res = await fetch(API_BASE + '/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch { /* ignore */ }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(API_BASE + '/settings/test', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setTestResult({ ok: true, msg: `连接成功！模型: ${data.model || '未知'}` });
      } else {
        setTestResult({ ok: false, msg: data.error || '连接失败' });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: '网络错误: ' + String(e) });
    }
    setTesting(false);
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: '#6366f1' }} />
        <p className="text-sm mt-2" style={{ color: '#64748b' }}>加载中...</p>
      </div>
    );
  }

  return (
    <div className="py-4 md:py-6 animate-fade-in">
      <h1 className="text-xl font-bold mb-1" style={{ color: '#f1f5f9' }}>设置</h1>
      <p className="text-sm mb-6" style={{ color: '#64748b' }}>个性化配置您的基金决策宝</p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-3">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-all mb-1"
              style={{
                background: section === s.id ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                color: section === s.id ? '#c7d2fe' : '#94a3b8',
                border: section === s.id ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid transparent',
              }}>
              {s.icon}{s.label}
            </button>
          ))}
        </div>

        <div className="md:col-span-3 glass-card p-5">
          {section === 'api' && (
            <div className="space-y-5 animate-fade-in">
              <h2 className="text-base font-medium" style={{ color: '#f1f5f9' }}>AI 模型配置</h2>
              <p className="text-xs" style={{ color: '#64748b' }}>
                配置AI服务接口。支持 OpenAI 兼容接口（如 MiMo、DeepSeek、GPT-4o 等）。
                配置完成后AI辩论、AI诊断等功能将使用真实模型。
              </p>

              <div className="p-3 rounded-lg" style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Key className="w-4 h-4" style={{ color: '#6366f1' }} />
                  <span className="text-sm font-medium" style={{ color: '#c7d2fe' }}>接口状态</span>
                </div>
                <p className="text-xs" style={{ color: '#64748b' }}>
                  {(config as any)._hasApiKey || (config.api.apiKey && config.api.apiKey.length > 5 && !config.api.apiKey.startsWith('sk-')) ? '✅ 已配置 API Key，将使用真实AI模型' : '⚠️ 未配置 API Key，当前使用模拟数据'}
                </p>
              </div>

              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#64748b' }}>模型名称</label>
                <select value={config.api.model} onChange={e => setConfig({ ...config, api: { ...config.api, model: e.target.value } })}
                  className="w-full md:w-64 px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                  style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(99, 102, 241, 0.15)', color: '#f1f5f9' }}>
                  <option value="mimo-v2.5-pro">MiMo v2.5 Pro (小米最强)</option>
                  <option value="mimo-v2.5">MiMo v2.5</option>
                  <option value="mimo-v2-pro">MiMo v2 Pro</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                  <option value="deepseek-chat">DeepSeek Chat</option>
                  <option value="deepseek-reasoner">DeepSeek Reasoner</option>
                  <option value="qwen-plus">Qwen Plus (通义千问)</option>
                </select>
              </div>

              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#64748b' }}>API Endpoint</label>
                <input type="text" value={config.api.endpoint}
                  onChange={e => setConfig({ ...config, api: { ...config.api, endpoint: e.target.value } })}
                  placeholder="https://api.mimo.ai/v1"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(99, 102, 241, 0.15)', color: '#f1f5f9' }} />
                <p className="text-xs mt-1" style={{ color: '#475569' }}>
                  MiMo: https://api.mimo.ai/v1 | DeepSeek: https://api.deepseek.com/v1 | OpenAI: https://api.openai.com/v1
                </p>
              </div>

              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#64748b' }}>API Key</label>
                <input type="password" value={config.api.apiKey}
                  onChange={e => setConfig({ ...config, api: { ...config.api, apiKey: e.target.value } })}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(99, 102, 241, 0.15)', color: '#f1f5f9' }} />
                <p className="text-xs mt-1" style={{ color: '#475569' }}>
                  密钥仅存储在服务器端，不会泄露。
                </p>
              </div>

              {testResult && (
                <div className="p-3 rounded-lg text-sm" style={{
                  background: testResult.ok ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${testResult.ok ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  color: testResult.ok ? '#22c55e' : '#ef4444',
                }}>
                  {testResult.ok ? <Wifi className="w-4 h-4 inline mr-1" /> : <WifiOff className="w-4 h-4 inline mr-1" />}
                  {testResult.msg}
                </div>
              )}
            </div>
          )}

          {section === 'general' && (
            <div className="space-y-5 animate-fade-in">
              <h2 className="text-base font-medium" style={{ color: '#f1f5f9' }}>通用设置</h2>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#64748b' }}>每页显示数量</label>
                <select value={config.pageSize} onChange={e => setConfig({ ...config, pageSize: +e.target.value })}
                  className="w-full md:w-48 px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                  style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(99, 102, 241, 0.15)', color: '#f1f5f9' }}>
                  {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n} 条/页</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#64748b' }}>默认排序</label>
                <select value={config.defaultSort} onChange={e => setConfig({ ...config, defaultSort: e.target.value })}
                  className="w-full md:w-48 px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                  style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(99, 102, 241, 0.15)', color: '#f1f5f9' }}>
                  {[['totalReturn1y', '近1年收益'], ['dailyReturn', '日涨幅'], ['size', '基金规模'], ['nav', '最新净值']].map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {section === 'display' && (
            <div className="space-y-5 animate-fade-in">
              <h2 className="text-base font-medium" style={{ color: '#f1f5f9' }}>显示偏好</h2>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#64748b' }}>主题</label>
                <div className="flex gap-2">
                  {[['dark', '深色模式'], ['light', '浅色模式']].map(([k, l]) => (
                    <button key={k} onClick={() => setConfig({ ...config, theme: k })}
                      className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-all"
                      style={{
                        background: config.theme === k ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(30, 41, 59, 0.6)',
                        color: config.theme === k ? '#fff' : '#94a3b8',
                        border: `1px solid ${config.theme === k ? 'rgba(99, 102, 241, 0.4)' : 'rgba(99, 102, 241, 0.1)'}`,
                      }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {section === 'notification' && (
            <div className="space-y-5 animate-fade-in">
              <h2 className="text-base font-medium" style={{ color: '#f1f5f9' }}>通知设置</h2>
              {[
                ['price', '价格异常通知'],
                ['news', '重要资讯通知'],
                ['risk', '风险预警通知'],
                ['dca', '定投提醒'],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#c7d2fe' }}>{label}</span>
                  <button onClick={() => setConfig({ ...config, notifications: { ...config.notifications, [key]: !config.notifications[key as keyof typeof config.notifications] } })}
                    className="w-10 h-5 rounded-full cursor-pointer transition-all relative"
                    style={{ background: config.notifications[key as keyof typeof config.notifications] ? '#6366f1' : 'rgba(30, 41, 59, 0.8)' }}>
                    <div className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all"
                      style={{ left: config.notifications[key as keyof typeof config.notifications] ? '22px' : '2px' }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {section === 'risk' && (
            <div className="space-y-5 animate-fade-in">
              <h2 className="text-base font-medium" style={{ color: '#f1f5f9' }}>风控参数</h2>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#64748b' }}>最大回撤阈值（%）</label>
                <input type="number" value={config.risk.maxDrawdown}
                  onChange={e => setConfig({ ...config, risk: { ...config.risk, maxDrawdown: +e.target.value } })}
                  className="w-full md:w-48 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(99, 102, 241, 0.15)', color: '#f1f5f9' }} />
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#64748b' }}>单只基金最大仓位（%）</label>
                <input type="number" value={config.risk.maxConcentration}
                  onChange={e => setConfig({ ...config, risk: { ...config.risk, maxConcentration: +e.target.value } })}
                  className="w-full md:w-48 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(99, 102, 241, 0.15)', color: '#f1f5f9' }} />
              </div>
            </div>
          )}

          <div className="mt-6 pt-4 flex gap-3" style={{ borderTop: '1px solid rgba(99, 102, 241, 0.1)' }}>
            <button onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all hover:brightness-110"
              style={{ background: saved ? 'rgba(34, 197, 94, 0.15)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: saved ? '#22c55e' : '#fff' }}>
              {saved ? <><Check className="w-4 h-4" />已保存</> : <><Save className="w-4 h-4" />保存设置</>}
            </button>
            {section === 'api' && (
              <button onClick={handleTest} disabled={testing}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                {testing ? '测试中...' : '测试连接'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
