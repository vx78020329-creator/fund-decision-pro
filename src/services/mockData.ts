import type { Fund, FundNavPoint, FundHolding, FundType, RiskLevel } from '@/types/fund';

const COMPANIES = [
  '易方达', '华夏', '广发', '南方', '嘉实', '博时', '招商', '富国',
  '工银瑞信', '汇添富', '鹏华', '中银', '建信', '天弘', '兴证全球',
  '景顺长城', '华安', '国泰', '大成', '银华', '交银施罗德', '华泰柏瑞',
  '中欧', '万家', '诺安', '前海开源', '信达澳亚', '永赢', '睿远', '泉果',
];

const MANAGERS = [
  '张坤', '刘彦春', '葛兰', '谢治宇', '朱少醒', '周蔚文', '傅鹏博',
  '王宗合', '杨锐文', '冯明远', '李晓星', '赵诣', '陈皓', '萧楠',
  '归凯', '劳杰男', '袁芳', '何帅', '孙伟', '丘栋荣', '姜诚',
  '郑澄然', '杨金金', '唐晓斌', '韩创', '王斌', '刘畅畅', '周智硕',
];

const FUND_TEMPLATES: Array<{ name: string; type: FundType; risk: RiskLevel; benchmark: string }> = [
  { name: '易方达蓝筹精选混合', type: 'mixed', risk: 3, benchmark: '沪深300' },
  { name: '招商中证白酒指数', type: 'index', risk: 4, benchmark: '中证白酒' },
  { name: '中欧医疗健康混合', type: 'mixed', risk: 4, benchmark: '中证医药' },
  { name: '景顺长城新兴成长混合', type: 'mixed', risk: 3, benchmark: '沪深300' },
  { name: '富国天惠成长混合', type: 'mixed', risk: 3, benchmark: '沪深300' },
  { name: '兴证全球合润混合', type: 'mixed', risk: 3, benchmark: '沪深300' },
  { name: '广发双擎升级混合', type: 'mixed', risk: 4, benchmark: '创业板指' },
  { name: '华夏回报混合', type: 'mixed', risk: 2, benchmark: '沪深300' },
  { name: '南方成分精选混合', type: 'mixed', risk: 3, benchmark: '沪深300' },
  { name: '嘉实增长混合', type: 'mixed', risk: 3, benchmark: '沪深300' },
  { name: '博时主题行业混合', type: 'mixed', risk: 3, benchmark: '沪深300' },
  { name: '工银瑞信前沿医疗股票', type: 'stock', risk: 4, benchmark: '中证医药' },
  { name: '汇添富消费行业混合', type: 'mixed', risk: 3, benchmark: '中证消费' },
  { name: '鹏华新兴产业混合', type: 'mixed', risk: 4, benchmark: '创业板指' },
  { name: '华安创新混合', type: 'mixed', risk: 3, benchmark: '沪深300' },
  { name: '国泰金鹰增长混合', type: 'mixed', risk: 3, benchmark: '沪深300' },
  { name: '大成竞争优势混合', type: 'mixed', risk: 3, benchmark: '沪深300' },
  { name: '银华富裕主题混合', type: 'mixed', risk: 3, benchmark: '中证消费' },
  { name: '交银施罗德优势行业混合', type: 'mixed', risk: 3, benchmark: '沪深300' },
  { name: '华泰柏瑞鼎利混合', type: 'mixed', risk: 3, benchmark: '沪深300' },
  { name: '中欧时代先锋股票', type: 'stock', risk: 4, benchmark: '沪深300' },
  { name: '万家优选混合', type: 'mixed', risk: 3, benchmark: '沪深300' },
  { name: '诺安成长混合', type: 'mixed', risk: 4, benchmark: '创业板指' },
  { name: '前海开源国家比较优势混合', type: 'mixed', risk: 3, benchmark: '沪深300' },
  { name: '睿远成长价值混合', type: 'mixed', risk: 3, benchmark: '沪深300' },
  { name: '泉果旭源三年持有期混合', type: 'mixed', risk: 3, benchmark: '沪深300' },
  { name: '易方达上证50指数', type: 'index', risk: 3, benchmark: '上证50' },
  { name: '华夏沪深300ETF联接', type: 'etf', risk: 3, benchmark: '沪深300' },
  { name: '华泰柏瑞沪深300ETF', type: 'etf', risk: 3, benchmark: '沪深300' },
  { name: '南方中证500ETF', type: 'etf', risk: 3, benchmark: '中证500' },
  { name: '嘉实沪深300ETF联接', type: 'etf', risk: 3, benchmark: '沪深300' },
  { name: '易方达创业板ETF', type: 'etf', risk: 4, benchmark: '创业板指' },
  { name: '华夏科创50ETF', type: 'etf', risk: 4, benchmark: '科创50' },
  { name: '博时标普500ETF联接', type: 'qdii', risk: 3, benchmark: '标普500' },
  { name: '华夏纳斯达克100ETF联接', type: 'qdii', risk: 4, benchmark: '纳斯达克100' },
  { name: '易方达中短期利率债债券', type: 'bond', risk: 1, benchmark: '中债综合' },
  { name: '招商产业债券', type: 'bond', risk: 2, benchmark: '中债综合' },
  { name: '南方宝元债券', type: 'bond', risk: 2, benchmark: '中债综合' },
  { name: '天弘余额宝货币', type: 'money', risk: 1, benchmark: '活期存款' },
  { name: '易方达易理财货币', type: 'money', risk: 1, benchmark: '活期存款' },
  { name: '南方天天利货币', type: 'money', risk: 1, benchmark: '活期存款' },
  { name: '华夏现金增利货币', type: 'money', risk: 1, benchmark: '活期存款' },
  { name: '兴全趋势投资混合', type: 'mixed', risk: 3, benchmark: '沪深300' },
  { name: '富国沪深300增强', type: 'index', risk: 3, benchmark: '沪深300' },
  { name: '景顺长城量化精选股票', type: 'stock', risk: 4, benchmark: '沪深300' },
  { name: '中欧时代智慧混合', type: 'mixed', risk: 3, benchmark: '沪深300' },
  { name: '广发科技先锋混合', type: 'mixed', risk: 4, benchmark: '创业板指' },
  { name: '汇添富全球互联混合(QDII)', type: 'qdii', risk: 4, benchmark: 'MSCI全球' },
  { name: '工银瑞信新能源汽车主题股票', type: 'stock', risk: 5, benchmark: '中证新能源' },
  { name: '华夏军工安全混合', type: 'mixed', risk: 4, benchmark: '中证军工' },
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateMoreFunds(): typeof FUND_TEMPLATES {
  const extra: typeof FUND_TEMPLATES = [];
  const suffixes = ['A', 'C', 'ETF联接A', 'ETF联接C'];
  const themes = [
    '新能源', '半导体', '人工智能', '碳中和', '数字经济', '高端制造',
    '医药生物', '消费升级', '军工', '港股通', '北交所', '专精特新',
    'ESG', '养老目标', '科技创新', '内需增长', '核心资产', '成长动力',
    '价值发现', '均衡配置', '稳健回报', '红利策略', '量化多因子',
  ];
  const bases = FUND_TEMPLATES.slice(0, 20);
  for (let i = 0; i < 150; i++) {
    const base = bases[i % bases.length];
    const theme = themes[i % themes.length];
    const suffix = i < 50 ? '' : suffixes[i % suffixes.length];
    extra.push({
      name: `${base.name.slice(0, 4)}${theme}${suffix || '混合'}`.slice(0, 20),
      type: base.type,
      risk: base.risk,
      benchmark: base.benchmark,
    });
  }
  return extra;
}

let _cachedFunds: Fund[] | null = null;

export function getMockFunds(): Fund[] {
  if (_cachedFunds) return _cachedFunds;
  const allTemplates = [...FUND_TEMPLATES, ...generateMoreFunds()];
  const rand = seededRandom(42);

  _cachedFunds = allTemplates.map((t, i) => {
    const company = COMPANIES[i % COMPANIES.length];
    const manager = MANAGERS[i % MANAGERS.length];
    const code = String(100000 + i * 7 + 3).slice(0, 6);
    const nav = +(0.5 + rand() * 4).toFixed(4);
    const accNav = +(nav * (1 + rand() * 2)).toFixed(4);
    const dailyReturn = +((rand() - 0.45) * 6).toFixed(2);
    const totalReturn1y = +((rand() - 0.4) * 80).toFixed(2);
    const totalReturn3y = +((rand() - 0.35) * 120).toFixed(2);
    const size = +(1 + rand() * 500).toFixed(2);
    const manageFee = +(0.1 + rand() * 1.8).toFixed(2);
    const custodyFee = +(0.02 + rand() * 0.3).toFixed(2);

    return {
      code,
      name: t.name,
      type: t.type,
      nav,
      accNav,
      dailyReturn,
      totalReturn1y,
      totalReturn3y,
      size,
      riskLevel: t.risk,
      manager,
      company,
      establishDate: `${2005 + (i % 18)}-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`,
      benchmark: t.benchmark,
      fee: { manage: manageFee, custody: custodyFee, purchase: +(rand() * 1.5).toFixed(2), redeem: +(rand() * 0.5).toFixed(2) },
    };
  });

  return _cachedFunds;
}

export function getMockNavHistory(code: string, days = 365): FundNavPoint[] {
  const rand = seededRandom(code.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
  const points: FundNavPoint[] = [];
  let nav = 1 + rand() * 2;
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const change = (rand() - 0.48) * 0.04;
    nav = Math.max(0.3, nav * (1 + change));
    points.push({
      date: d.toISOString().slice(0, 10),
      nav: +nav.toFixed(4),
      return: +(change * 100).toFixed(2),
    });
  }
  return points;
}

export function getMockHoldings(): FundHolding[] {
  const stocks = [
    '贵州茅台', '宁德时代', '招商银行', '中国平安', '隆基绿能',
    '五粮液', '比亚迪', '美的集团', '恒瑞医药', '海康威视',
    '长江电力', '中信证券', '药明康德', '迈瑞医疗', '东方财富',
  ];
  const industries = ['消费', '新能源', '金融', '医药', '科技', '制造', '能源'];
  const rand = seededRandom(123);
  return stocks.slice(0, 10).map((name, i) => ({
    name,
    code: String(600000 + i * 111).slice(0, 6),
    weight: +(3 + rand() * 12).toFixed(2),
    industry: industries[i % industries.length],
  }));
}
