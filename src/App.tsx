import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { Home } from '@/pages/Home';
import { FundDetail } from '@/pages/FundDetail';
import { AIDiagnosis } from '@/pages/AIDiagnosis';
import { AIDebate } from '@/pages/AIDebate';
import { Portfolio } from '@/pages/Portfolio';
import { SimTrade } from '@/pages/SimTrade';
import { News } from '@/pages/News';
import { RiskMonitor } from '@/pages/RiskMonitor';
import { AIChat } from '@/pages/AIChat';
import { Settings } from '@/pages/Settings';
import { Dashboard } from '@/pages/Dashboard';
import { LearningCenter } from '@/pages/LearningCenter';
import { CourseDetail } from '@/pages/CourseDetail';
import { MyHoldings } from '@/pages/MyHoldings';
import { DailyAnalysis } from '@/pages/DailyAnalysis';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: '#f1f5f9', background: '#06080f', minHeight: '100vh' }}>
      <h2 style={{ color: '#f43f5e', marginBottom: 16 }}>出错了</h2>
      <p style={{ color: '#64748b', marginBottom: 8 }}>{error.message}</p>
      <button onClick={() => window.location.reload()} style={{ padding: '8px 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
        刷新页面
      </button>
    </div>
  );
}

import React from 'react';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return <ErrorFallback error={this.state.error!} />;
    return this.props.children;
  }
}

export function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
          <Header />
          <Sidebar />
          <main className="pt-14 px-5 md:px-8 pb-8 transition-all duration-300" style={{ marginLeft: '220px', maxWidth: '1400px' }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/fund/:code" element={<FundDetail />} />
              <Route path="/diagnosis/:code" element={<AIDiagnosis />} />
              <Route path="/debate" element={<AIDebate />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/simtrade" element={<SimTrade />} />
              <Route path="/news" element={<News />} />
              <Route path="/risk" element={<RiskMonitor />} />
              <Route path="/chat" element={<AIChat />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/learning" element={<LearningCenter />} />
              <Route path="/learning/:courseId" element={<CourseDetail />} />
              <Route path="/holdings" element={<MyHoldings />} />
              <Route path="/analysis" element={<DailyAnalysis />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
