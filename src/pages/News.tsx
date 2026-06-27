import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Newspaper, TrendingUp, TrendingDown, Clock, ExternalLink, ChevronDown, ChevronUp,
  RefreshCw, Sparkles, Tag, AlertCircle, BarChart3, Landmark, Building, FileText, Filter, Loader2, Minus,
} from 'lucide-react';
import { fetchNews } from '@/services/api';

import type { NewsItem } from '@/services/api';

const TAG_CONFIG: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
  "宏观": { icon: <Landmark className="w-3 h-3" />, color: "#a5b4fc", bgColor: "rgba(99,102,241,0.12)" },
  "市场": { icon: <BarChart3 className="w-3 h-3" />, color: "#67e8f9", bgColor: "rgba(6,182,212,0.12)" },
  "行业": { icon: <Building className="w-3 h-3" />, color: "#c4b5fd", bgColor: "rgba(139,92,246,0.12)" },
  "基金": { icon: <FileText className="w-3 h-3" />, color: "#6ee7b7", bgColor: "rgba(16,185,129,0.12)" },
  "政策": { icon: <AlertCircle className="w-3 h-3" />, color: "#fcd34d", bgColor: "rgba(245,158,11,0.12)" },
};

// Fallback mock news data
const MOCK_NEWS: NewsItem[] = [
  { id: "1", title: "央行宣布降准0.5个百分点，释放长期资金约1万亿元", source: "新华社", time: "2小时前", tag: "宏观", important: true,
    content: "中国人民银行决定于2025年7月15日下调金融机构存款准备金率0.5个百分点。本次降准预计释放长期资金约1万亿元人民币。央行表示此举旨在优化金融机构资金结构，提升金融服务能力，更好支持实体经济。降准后金融机构加权平均存款准备金率约为6.2%。",
    summary: "央行下调存款准备金率0.5个百分点，释放约1万亿元长期资金，优化金融机构资金结构，支持实体经济发展。",
    keyPoints: ["降准0.5个百分点，释放约1万亿元", "加权平均存款准备金率降至约6.2%", "旨在优化金融机构资金结构", "提升金融服务实体经济能力"] },
  { id: "2", title: "沪深两市成交额突破1.2万亿，北向资金净买入超80亿", source: "东方财富", time: "3小时前", tag: "市场", important: true,
    content: "今日A股市场交投活跃，沪深两市合计成交额突破1.2万亿元，创近两周新高。北向资金全天净买入超过80亿元，连续第三个交易日净流入。分析人士认为，市场情绪回暖主要受到政策预期改善和外资持续流入的双重提振。",
    summary: "A股两市成交额突破1.2万亿创两周新高，北向资金连续三日净流入超80亿，市场情绪受政策预期和外资双重提振。",
    keyPoints: ["两市成交额突破1.2万亿", "北向资金净买入超80亿", "连续第三个交易日净流入", "政策预期改善和外资流入双重提振"] },
  { id: "3", title: "新能源板块集体走强，宁德时代涨超5%", source: "证券时报", time: "4小时前", tag: "行业", important: false,
    content: "新能源板块今日表现强势，宁德时代盘中涨幅超过5%，带动整个新能源产业链走强。消息面上，工信部发布《新能源汽车产业发展规划（2025-2035年）》，明确了未来十年的发展目标和重点任务。",
    summary: "新能源板块大涨，宁德时代涨超5%，工信部发布新能源汽车产业十年发展规划明确发展目标。",
    keyPoints: ["宁德时代盘中涨超5%", "新能源产业链集体走强", "工信部发布新能源汽车产业十年规划", "明确未来发展目标和重点任务"] },
  { id: "4", title: "张坤管理基金最新季报出炉，重仓股曝光", source: "中国基金报", time: "5小时前", tag: "基金", important: false,
    content: "易方达蓝筹精选混合基金发布2025年二季报，基金经理张坤在报告期内对持仓进行了微调。前十大重仓股中，贵州茅台仍为第一大重仓股，占比9.8%。新增了美团-W和中国海洋石油两只港股标的，减持了药明康德和海康威视。",
    summary: "张坤管理的易方达蓝筹精选混合基金发布二季报，持仓微调，新增美团和中国海洋石油两只港股标的。",
    keyPoints: ["贵州茅台仍为第一大重仓股占比9.8%", "新增美团-W和中国海洋石油两只港股", "减持药明康德和海康威视", "报告期内对持仓进行了微调"] },
  { id: "5", title: "国务院发布促进消费20条措施，汽车家电成重点", source: "人民日报", time: "6小时前", tag: "政策", important: true,
    content: "国务院办公厅印发《关于进一步促进消费扩容提质的若干措施》，共20条具体举措。重点包括：加大对汽车以旧换新的补贴力度，支持绿色智能家电下乡，扩大数字消费和文旅消费，完善农村电商配送体系等。预计该政策将直接拉动消费增长1-2个百分点。",
    summary: "国务院印发20条促消费措施，重点支持汽车以旧换新、绿色智能家电下乡，预计拉动消费增长1-2个百分点。",
    keyPoints: ["20条促消费具体举措", "加大汽车以旧换新补贴力度", "支持绿色智能家电下乡", "预计拉动消费增长1-2个百分点"] },
  { id: "6", title: "半导体行业景气度回升，多只相关基金净值创新高", source: "上海证券报", time: "7小时前", tag: "行业", important: false,
    content: "受全球半导体行业周期见底回升影响，多只重仓半导体的基金近期净值创出新高。诺安成长混合、银河创新成长等基金近一个月涨幅均超过8%。分析师指出，AI算力需求爆发、国产替代加速以及库存周期触底是推动半导体行业复苏的三大驱动力。",
    summary: "半导体行业周期见底回升，多只重仓半导体基金净值创新高，AI算力需求、国产替代、库存触底三大驱动。",
    keyPoints: ["多只半导体基金净值创新高", "诺安成长等近一个月涨超8%", "AI算力需求爆发推动复苏", "国产替代加速和库存周期触底"] },
  { id: "7", title: "美联储暗示9月可能降息，全球市场应声上涨", source: "财联社", time: "8小时前", tag: "宏观", important: true,
    content: "美联储主席鲍威尔在Jackson Hole年会上发表讲话，暗示如果通胀继续回落，美联储可能在9月会议上考虑降息。消息传出后，全球主要股指应声上涨，纳斯达克指数涨超1.5%，美元指数回落至101以下。分析人士认为，这标志着美联储货币政策转向的开始。",
    summary: "美联储鲍威尔暗示9月可能降息，全球股市应声上涨，纳指涨超1.5%，美元回落，标志着货币政策转向开始。",
    keyPoints: ["鲍威尔暗示9月可能降息", "纳斯达克指数涨超1.5%", "美元指数回落至101以下", "标志美联储货币政策转向开始"] },
  { id: "8", title: "医药板块触底反弹，创新药ETF获资金大幅申购", source: "中国证券报", time: "10小时前", tag: "行业", important: false,
    content: "经历近一年的调整后，医药板块近期出现明显反弹迹象。多只创新药ETF获得大幅申购，资金持续流入。据统计，近一周创新药ETF合计净流入超过30亿元。机构观点认为，创新药板块估值已处于历史底部，政策环境改善叠加管线兑现期，板块有望迎来估值修复。",
    summary: "医药板块触底反弹，创新药ETF一周净流入超30亿，估值处于历史底部，政策改善叠加管线兑现推动修复。",
    keyPoints: ["创新药ETF一周净流入超30亿", "板块估值处于历史底部", "政策环境改善", "创新药管线兑现期到来"] },
];

const TAG_FILTERS = ["全部", "宏观", "市场", "行业", "基金", "政策"];

function NewsCard({ item, index }: { item: NewsItem; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const tagConf = TAG_CONFIG[item.tag] || TAG_CONFIG["市场"];

  return (
    <div
      className="glass-card glass-card-interactive p-5 animate-fade-in"
      style={{ animationDelay: `${Math.min(index * 40, 300)}ms`, animationFillMode: 'both' }}
    >
      {/* Tags + Important */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="badge"
          style={{ background: tagConf.bgColor, color: tagConf.color, fontSize: '11px', padding: '3px 10px' }}
        >
          {tagConf.icon}
          <span className="ml-1">{item.tag}</span>
        </span>
        {item.important && (
          <span className="badge" style={{ background: 'rgba(244,63,94,0.12)', color: '#fda4af', fontSize: '10px', padding: '2px 8px' }}>
            <AlertCircle className="w-2.5 h-2.5 mr-0.5" />
            重要
          </span>
        )}
      </div>

      {/* Title */}
      <h3
        className="text-[15px] font-bold leading-snug mb-2 cursor-pointer"
        style={{ color: 'var(--text-primary)' }}
        onClick={() => setExpanded(!expanded)}
      >
        {item.title}
      </h3>

      {/* Source + Time */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{item.source}</span>
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-xs hover:underline" style={{ color: 'var(--accent-cyan)' }}>
            <ExternalLink className="w-3 h-3" />
            原文
          </a>
        )}
        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <Clock className="w-3 h-3" />
          {item.time}
        </span>
        {item.originalTime && (
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--accent-amber)', opacity: 0.8 }}>
            <Clock className="w-3 h-3" />
            {item.originalTime}
          </span>
        )}
        
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs cursor-pointer"
          style={{ color: 'var(--accent-indigo)' }}
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? '收起' : '展开详情'}
        </button>
      </div>

      {/* Summary (always visible) */}
      <p className="text-[13px] leading-relaxed mb-2" style={{ color: 'var(--text-secondary)' }}>
        {item.summary}
      </p>

      {/* Expanded: Key Points + Content */}
      {expanded && (
        <div className="animate-fade-in mt-3" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
          {/* Key Points */}
          {item.keyPoints && item.keyPoints.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--accent-amber)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>核心要点</span>
              </div>
              <div className="space-y-1.5">
                {item.keyPoints.map((point, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: tagConf.color }} />
                    <span className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{point}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          
        {/* Auto AI Analysis */}
        {(item as any).aiSummary && (
          <div className="animate-fade-in mb-4 p-4 rounded-xl" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-4 h-4 rounded-full" style={{ background: 'var(--accent-indigo)' }} />
              <span className="text-sm font-bold" style={{ color: 'var(--accent-indigo)' }}>AI 智能分析</span>
              <div className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  background: (item as any).aiDirection === 'positive' ? 'rgba(16,185,129,0.12)' : (item as any).aiDirection === 'negative' ? 'rgba(239,68,68,0.12)' : 'rgba(156,163,175,0.12)',
                  color: (item as any).aiDirection === 'positive' ? '#6ee7b7' : (item as any).aiDirection === 'negative' ? '#fca5a5' : '#9ca3af',
                }}>
                {(item as any).aiDirection === 'positive' ? '↑ 看多' : (item as any).aiDirection === 'negative' ? '↓ 看空' : '— 中性'}
                · 影响力 {(item as any).aiImpactScore}/10
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>📋 AI摘要</div>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{(item as any).aiSummary}</p>
              </div>
              {(item as any).aiImpact && (
                <div>
                  <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>📊 影响分析</div>
                  <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{(item as any).aiImpact}</p>
                </div>
              )}
              {(item as any).aiRecommendation && (
                <div>
                  <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>💡 投资建议</div>
                  <p className="text-[13px] leading-relaxed" style={{ color: (item as any).aiDirection === 'positive' ? '#6ee7b7' : (item as any).aiDirection === 'negative' ? '#fca5a5' : 'var(--text-secondary)' }}>{(item as any).aiRecommendation}</p>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Full Content */}
          <div className="p-3 rounded-lg" style={{ background: 'rgba(99,102,241,0.04)' }}>
            <div className="text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              详细内容
            </div>
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {item.content}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function News() {
  const [activeTag, setActiveTag] = useState("全部");
  const [showImportantOnly, setShowImportantOnly] = useState(false);

  const { data: apiNews, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['news'],
    queryFn: async () => {
      console.log("[News] fetchNews start");
      try {
        const result = await fetchNews();
        console.log("[News] fetchNews result:", result?.length ?? "null");
        return result;
      } catch (e) {
        console.error("[News] fetchNews error:", e);
        return [];
      }
    },
    staleTime: 60_000,
    refetchInterval: 3 * 60_000,
    retry: 3,
    refetchOnWindowFocus: true,
  });

  console.log("[News] render: apiNews length =", apiNews?.length, "isLoading =", isLoading);
  const news = apiNews && apiNews.length > 0 ? apiNews : MOCK_NEWS;
  let filteredNews = activeTag === "全部" ? news : news.filter(n => n.tag === activeTag);
  if (showImportantOnly) filteredNews = filteredNews.filter(n => n.important);

  return (
    <div className="py-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>市场资讯</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>实时市场动态、政策解读、行业热点</p>
        </div>
        <button onClick={() => refetch()} disabled={isRefetching} className="btn-ghost" style={{ borderColor: 'var(--border-accent)', color: 'var(--accent-indigo)' }}>
          <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          {isRefetching ? '刷新中' : '刷新'}
        </button>
      </div>

      {/* Tag Filters */}
      <div className="tab-group inline-flex mb-5">
        {TAG_FILTERS.map(tag => (
          <button
            key={tag}
            onClick={() => setActiveTag(tag)}
            className={`tab-item ${activeTag === tag ? 'active' : ''}`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          共 {filteredNews.length} 条资讯
        </span>
        <button
          onClick={() => setShowImportantOnly(!showImportantOnly)}
          className="text-xs px-2 py-0.5 rounded-full cursor-pointer transition-all"
          style={{
            background: showImportantOnly ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.08)',
            color: showImportantOnly ? '#fca5a5' : 'var(--accent-rose)',
            border: '1px solid ' + (showImportantOnly ? 'rgba(239,68,68,0.3)' : 'transparent'),
          }}
        >
          {filteredNews.filter(n => n.important).length} 条重要{showImportantOnly ? " ✓" : ""}
        </button>
      </div>

      {/* News List */}
      <div className="space-y-3">
        {filteredNews.map((item, i) => (
          <NewsCard key={item.id} item={item} index={i} />
        ))}
      </div>

      {filteredNews.length === 0 && (
        <div className="py-20 text-center">
          <Newspaper className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>暂无资讯</div>
        </div>
      )}
    </div>
  );
}