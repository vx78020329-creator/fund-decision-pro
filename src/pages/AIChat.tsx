import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2, Plus, MessageSquare, Trash2, ChevronLeft, Clock, Sparkles, TrendingUp, BarChart3, Shield } from 'lucide-react';
import { runChat, streamChat } from '@/services/api';

interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; time: string; }
interface Conversation { id: string; title: string; messages: ChatMessage[]; createdAt: number; updatedAt: number; }

const STORAGE_KEY = 'fund-chat-conversations';
function loadConversations(): Conversation[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function saveConversations(cv: Conversation[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(cv)); }
function autoTitle(msgs: ChatMessage[]): string { const f = msgs.find(m => m.role === 'user'); return f ? f.content.slice(0, 30) + (f.content.length > 30 ? '...' : '') : 'New Chat'; }

const QA = [
  { label: '\u5E2E\u6211\u9009\u57FA\u91D1', icon: Sparkles, p: '\u8BF7\u6839\u636E\u5F53\u524D\u5E02\u573A\u73AF\u5883\uFF0C\u63A8\u8350\u51E0\u53EA\u9002\u5408\u957F\u671F\u6301\u6709\u7684\u57FA\u91D1' },
  { label: '\u5206\u6790\u5E02\u573A', icon: TrendingUp, p: '\u8BF7\u5206\u6790\u5F53\u524DA\u80A1\u5E02\u573A\u8D70\u52BF\u548C\u6295\u8D44\u673A\u4F1A' },
  { label: '\u98CE\u9669\u8BC4\u4F30', icon: Shield, p: '\u8BF7\u8BC4\u4F30\u5F53\u524D\u5E02\u573A\u7684\u6574\u4F53\u98CE\u9669\u6C34\u5E73' },
  { label: '\u884C\u4E1A\u5BF9\u6BD4', icon: BarChart3, p: '\u8BF7\u5BF9\u6BD4\u65B0\u80FD\u6E90\u3001\u534A\u5BFC\u4F53\u3001\u6D88\u8D39\u4E09\u4E2A\u884C\u4E1A\u7684\u6295\u8D44\u4EF7\u503C' },
];
export function AIChat() {
  const [convos, setConvos] = useState<Conversation[]>(loadConversations);
  const [activeId, setActiveId] = useState<string>(() => { const s = loadConversations(); return s.length > 0 ? s[0].id : ''; });
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [showHist, setShowHist] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const active = convos.find(c => c.id === activeId);
  const msgs = active?.messages || [];

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [msgs.length, typing]);

  const persist = useCallback((fn: (prev: Conversation[]) => Conversation[]) => {
    setConvos(p => { const n = fn(p); saveConversations(n); return n; });
  }, []);

  const newConvo = useCallback(() => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2,5);
    persist(p => [{ id, title: 'New Chat', messages: [], createdAt: Date.now(), updatedAt: Date.now() }, ...p]);
    setActiveId(id);
  }, [persist]);

  const delConvo = useCallback((id: string) => {
    persist(p => p.filter(c => c.id !== id));
    setActiveId(prev => { const r = convos.filter(c => c.id !== id); return r.length > 0 ? r[0].id : ''; });
  }, [convos, persist]);

  const [streamingText, setStreamingText] = useState('');
  const abortRef = useRef<(() => void) | null>(null);

  const send = async (text: string) => {
    if (!text.trim() || typing) return;
    let tid = activeId;
    if (!tid || !convos.find(c => c.id === tid)) {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2,5);
      persist(p => [{ id, title: text.trim().slice(0,30), messages: [], createdAt: Date.now(), updatedAt: Date.now() }, ...p]);
      tid = id; setActiveId(id);
    }
    const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const um: ChatMessage = { id: Date.now().toString(), role: 'user', content: text.trim(), time: now };
    persist(p => p.map(c => c.id !== tid ? c : { ...c, messages: [...c.messages, um], updatedAt: Date.now(), title: c.messages.length === 0 ? autoTitle([um]) : c.title }));
    setInput(''); setTyping(true); setStreamingText('');
    
    const fullTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const msgId = (Date.now()+1).toString();
    
    abortRef.current = streamChat(
      text.trim(),
      (chunk) => { setStreamingText(chunk); },
      (fullText) => {
        const am: ChatMessage = { id: msgId, role: 'assistant', content: fullText || '\u65E0\u54CD\u5E94', time: fullTime };
        persist(p => p.map(c => c.id === tid ? { ...c, messages: [...c.messages, am], updatedAt: Date.now() } : c));
        setStreamingText(''); setTyping(false);
      },
      (error) => {
        const em: ChatMessage = { id: msgId, role: 'assistant', content: error || '\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528', time: fullTime };
        persist(p => p.map(c => c.id === tid ? { ...c, messages: [...c.messages, em], updatedAt: Date.now() } : c));
        setStreamingText(''); setTyping(false);
      },
    );
  };

  const fmtDate = (ts: number) => { const d = new Date(ts); if (d.toDateString() === new Date().toDateString()) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }); return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }); };
  const barCls = 'transition-all duration-300 ease-in-out flex-shrink-0 overflow-hidden ' + (showHist ? 'w-64' : 'w-0');

  return (
    <div className="flex h-[calc(100vh-4rem)] animate-fade-in overflow-hidden">
      <div className={barCls} style={{ borderRight: '1px solid rgba(99,102,241,0.1)', background: 'rgba(15,23,42,0.6)' }}>
        <div className="p-3 flex flex-col h-full">
          <button onClick={newConvo} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer transition-all hover:brightness-110 mb-3" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff' }}>
            <Plus className="w-4 h-4" /> {"\u65B0\u5EFA\u5BF9\u8BDD"}
          </button>
          <div className="flex-1 overflow-y-auto space-y-1">
            {convos.map(c => (
              <div key={c.id} onClick={() => setActiveId(c.id)} className="group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all hover:bg-white/5" style={c.id === activeId ? { background: 'rgba(99,102,241,0.15)', color: '#e0e7ff' } : { color: '#94a3b8' }}>
                <MessageSquare className="w-4 h-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{c.title}</p>
                  <p className="text-[10px] flex items-center" style={{ color: '#475569' }}><Clock className="w-3 h-3 mr-1" />{fmtDate(c.updatedAt)} <span className="ml-1">{c.messages.length} \u6761\u6D88\u606F</span></p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); delConvo(c.id); }} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 transition-opacity cursor-pointer">
                  <Trash2 className="w-3 h-3" style={{ color: '#ef4444' }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0" style={{ borderColor: 'rgba(99,102,241,0.1)' }}>
          <button onClick={() => setShowHist(!showHist)} className="p-2 rounded-lg cursor-pointer hover:bg-white/5" style={{ color: '#94a3b8' }}>
            {showHist ? <ChevronLeft className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
          </button>
          <div><h1 className="text-lg font-bold" style={{ color: '#f1f5f9' }}>{'\u667A\u80FD AI \u52A9\u624B'}</h1>
          <p className="text-xs" style={{ color: '#64748b' }}>{'\u57FA\u91D1\u5206\u6790\u3001\u5E02\u573A\u89E3\u8BFB\u3001\u6295\u8D44\u5EFA\u8BAE'}</p></div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 p-4">
          {msgs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(6,182,212,0.2))' }}>
                <Bot className="w-8 h-8" style={{ color: '#a5b4fc' }} />
              </div>
              <p className="text-sm mb-6" style={{ color: '#64748b' }}>{'\u9009\u62E9\u5FEB\u6377\u64CD\u4F5C\u6216\u76F4\u63A5\u8F93\u5165\u95EE\u9898'}</p>
              <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                {QA.map((a, i) => (
                  <button key={i} onClick={() => send(a.p)} className="flex items-center gap-2 p-3 rounded-xl text-sm cursor-pointer transition-all hover:scale-[1.02]" style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(99,102,241,0.1)', color: '#94a3b8' }}>
                    <a.icon className="w-4 h-4" style={{ color: '#a5b4fc' }} />{a.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {msgs.map(msg => (
            <div key={msg.id} className={msg.role === 'user' ? 'flex gap-3 animate-fade-in flex-row-reverse' : 'flex gap-3 animate-fade-in'}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: msg.role === 'user' ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'linear-gradient(135deg,#06b6d4,#22c55e)' }}>
                {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
              </div>
              <div className={msg.role === 'user' ? 'max-w-[75%] p-3 rounded-xl text-sm leading-relaxed rounded-tr-none' : 'max-w-[75%] p-3 rounded-xl text-sm leading-relaxed rounded-tl-none'} style={{ background: msg.role === 'user' ? 'rgba(99,102,241,0.15)' : 'rgba(30,41,59,0.6)', border: '1px solid ' + (msg.role === 'user' ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)'), color: '#c7d2fe', whiteSpace: 'pre-wrap' }}>
                {msg.content}
                <div className="text-[10px] mt-1.5" style={{ color: '#475569' }}>{msg.time}</div>
              </div>
            </div>
          ))}

          {typing && (
            <div className="flex gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#06b6d4,#22c55e)' }}><Bot className="w-4 h-4 text-white" /></div>
              <div className="px-4 py-3 rounded-xl rounded-tl-none" style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(99,102,241,0.1)' }}>
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#06b6d4' }} />
              </div>
            </div>
          )}
        </div>

        <div className="p-3 shrink-0" style={{ borderTop: '1px solid rgba(99,102,241,0.1)' }}>
          <div className="flex items-center gap-2">
            <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)} placeholder={'\u8F93\u5165\u60A8\u7684\u95EE\u9898...'} className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(99,102,241,0.15)', color: '#f1f5f9' }} />
            <button onClick={() => send(input)} className="p-2.5 rounded-xl cursor-pointer transition-all hover:brightness-110" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff' }}>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}