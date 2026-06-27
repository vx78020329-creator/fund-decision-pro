import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Clock, ChevronRight, GraduationCap, TrendingUp, Star, Trophy } from 'lucide-react';
import { COURSES, LEVEL_META, type Course } from '@/data/learningData';

const ICON_MAP: Record<string, React.FC<{ size?: number; style?: React.CSSProperties }>> = {
  BookOpen, TrendingUp, GraduationCap, Star,
};

const STORAGE_KEY = 'fund-learning-progress';

function loadProgress(): Record<string, { completed: string[]; scores: Record<string, number> }> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

const levelBadge = (level: string) => {
  const meta = LEVEL_META.find(l => l.key === level);
  if (!meta) return null;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 12,
      fontSize: 12, fontWeight: 600, color: meta.color, background: meta.bgColor,
      border: '1px solid ' + meta.color + '33',
    }}>
      {meta.label}
    </span>
  );
};

export function LearningCenter() {
  const navigate = useNavigate();
  const [activeLevel, setActiveLevel] = useState<string>('all');
  const progress = useMemo(() => loadProgress(), []);

  const filtered = useMemo(() => {
    if (activeLevel === 'all') return COURSES;
    return COURSES.filter(c => c.level === activeLevel);
  }, [activeLevel]);

  const getProgress = (course: Course) => {
    const p = progress[course.id];
    if (!p || !p.completed) return 0;
    return Math.round((p.completed.length / course.lessons.length) * 100);
  };

  const tabs = [
    { key: 'all', label: '全部', color: '#6366f1', bgColor: 'rgba(99,102,241,0.15)' },
    ...LEVEL_META,
  ];

  return (
    <div style={{ minHeight: '100vh', color: '#f1f5f9' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: 28, fontWeight: 700, marginBottom: 8,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          📚 学习中心
        </h1>
        <p style={{ color: '#64748b', fontSize: 14 }}>
          系统化学习基金投资知识，从入门到专家的完整学习路径
        </p>
      </div>

      {/* Level Tabs */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveLevel(tab.key)}
            style={{
              padding: '8px 20px', borderRadius: 20, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.2s',
              border: activeLevel === tab.key ? '1px solid ' + (tab.color || '#6366f1') : '1px solid rgba(99,102,241,0.2)',
              background: activeLevel === tab.key ? (tab.bgColor || 'rgba(99,102,241,0.15)') : 'rgba(30,41,59,0.6)',
              color: activeLevel === tab.key ? (tab.color || '#6366f1') : '#94a3b8',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Course Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: 20,
      }}>
        {filtered.map(course => {
          const pct = getProgress(course);
          const Icon = ICON_MAP[course.icon] || BookOpen;
          const meta = LEVEL_META.find(l => l.key === course.level);
          return (
            <div
              key={course.id}
              onClick={() => navigate('/learning/' + course.id)}
              style={{
                background: 'rgba(30,41,59,0.6)',
                border: '1px solid rgba(99,102,241,0.1)',
                borderRadius: 16, padding: 24, cursor: 'pointer',
                transition: 'all 0.25s',
                position: 'relative', overflow: 'hidden',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.4)';
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(99,102,241,0.15)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.1)';
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
              }}
            >
              {/* Top row: icon + badges */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'linear-gradient(135deg, ' + (meta?.color || '#6366f1') + '22, ' + (meta?.color || '#6366f1') + '08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={24} style={{ color: meta?.color || '#6366f1' }} />
                </div>
                {levelBadge(course.level)}
              </div>

              {/* Title + description */}
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#f1f5f9' }}>
                {course.title}
              </h3>
              <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, marginBottom: 16, minHeight: 42 }}>
                {course.description}
              </p>

              {/* Meta row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, fontSize: 13, color: '#64748b' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={14} />
                  {course.estimatedMinutes} 分钟
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <BookOpen size={14} />
                  {course.lessons.length} 节课
                </span>
              </div>

              {/* Progress bar */}
              <div style={{ marginTop: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                  <span>学习进度</span>
                  <span>{pct}%</span>
                </div>
                <div style={{
                  height: 4, borderRadius: 2, background: 'rgba(99,102,241,0.1)', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    width: pct + '%',
                    background: pct === 100
                      ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                      : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>

              {/* Completed badge */}
              {pct === 100 && (
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                  display: 'flex', alignItems: 'center', gap: 4,
                  color: '#22c55e', fontSize: 12, fontWeight: 600,
                }}>
                  <Trophy size={14} /> 已完成
                </div>
              )}

              {/* Hover arrow */}
              <div style={{
                position: 'absolute', right: 20, bottom: 24,
                color: 'rgba(99,102,241,0.4)', transition: 'all 0.2s',
              }}>
                <ChevronRight size={20} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
