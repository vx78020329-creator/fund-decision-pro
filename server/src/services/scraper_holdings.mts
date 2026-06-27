// Add fetchFundHoldings to scraper.ts
export async function fetchFundHoldings(code: string): Promise<Array<{ name: string; code: string; weight: number; industry: string }>> {
  const holdings: Array<{ name: string; code: string; weight: number; industry: string }> = [];
  try {
    const res = await fetch(`http://fund.eastmoney.com/f10/FundArchivesDatas.aspx?type=jjcc&code=${code}&topline=10&year=&month=`, { headers: HEADERS });
    const text = await res.text();
    const m = text.match(/content:"([\s\S]+)",arryear/);
    if (!m) return holdings;
    const html = m[1];
    const rows = [...html.matchAll(/<tr><td>(\d+)<\/td><td><a href='[^']*'>(\d{6})<\/a><\/td><td class='tol'><a[^>]*>([^<]+)<\/a><\/td>[\s\S]*?<td class='tor'>([0-9.]+)%<\/td>/g)];
    for (const r of rows) {
      holdings.push({ code: r[2], name: r[3], weight: parseFloat(r[4]) || 0, industry: "" });
    }
  } catch { /* partial results are fine */ }
  return holdings;
}
