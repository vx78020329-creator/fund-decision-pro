import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BookOpen, ChevronLeft, ChevronRight, CheckCircle2,
  Clock, Trophy, Star, GraduationCap,
} from 'lucide-react';
import { COURSES, LEVEL_META } from '@/data/learningData';

const ICON_MAP: Record<string, React.FC<{ size?: number; style?: React.CSSProperties }>> = {
  BookOpen, TrendingUp: Star, GraduationCap, Star,
};

const STORAGE_KEY = 'fund-learning-progress';

interface ProgressData {
  completed: string[];
  scores: Record<string, number>;
}

function loadAll(): Record<string, ProgressData> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function saveAll(data: Record<string, ProgressData>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const styles = {
  container: { minHeight: '100vh' as const, color: '#f1f5f9', maxWidth: 860, margin: '0 auto', padding: '0 0 60px' },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    color: '#6366f1', fontSize: 14, cursor: 'pointer', background: 'none', border: 'none',
    marginBottom: 24, padding: 0,
  },
  headerCard: {
    background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(99,102,241,0.1)',
    borderRadius: 16, padding: 28, marginBottom: 24,
  },
  lessonNav: {
    display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 28,
  },
  lessonChip: (active: boolean, done: boolean): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', transition: 'all 0.2s',
    border: active ? '1px solid #6366f1' : done ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(99,102,241,0.15)',
    background: active ? 'rgba(99,102,241,0.2)' : done ? 'rgba(34,197,94,0.1)' : 'rgba(30,41,59,0.6)',
    color: active ? '#a78bfa' : done ? '#22c55e' : '#94a3b8',
  }),
  contentCard: {
    background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(99,102,241,0.1)',
    borderRadius: 16, padding: 32, marginBottom: 24,
  },
  keyPoint: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '10px 0', borderBottom: '1px solid rgba(99,102,241,0.06)',
  },
  quizOption: (selected: boolean, correct: boolean | null, idx: number, answer: number): React.CSSProperties => {
    let bg = 'rgba(30,41,59,0.6)';
    let border = '1px solid rgba(99,102,241,0.1)';
    let color = '#94a3b8';
    if (correct !== null) {
      if (idx === answer) { bg = 'rgba(34,197,94,0.12)'; border = '1px solid rgba(34,197,94,0.4)'; color = '#22c55e'; }
      else if (selected && idx !== answer) { bg = 'rgba(239,68,68,0.12)'; border = '1px solid rgba(239,68,68,0.4)'; color = '#ef4444'; }
    } else if (selected) { bg = 'rgba(99,102,241,0.15)'; border = '1px solid #6366f1'; color = '#a78bfa'; }
    return {
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
      borderRadius: 12, cursor: correct !== null ? 'default' : 'pointer',
      background: bg, border, color, fontSize: 14, transition: 'all 0.2s',
    };
  },
  radio: (selected: boolean): React.CSSProperties => ({
    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
    border: selected ? '2px solid #6366f1' : '2px solid rgba(99,102,241,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }),
  radioInner: { width: 8, height: 8, borderRadius: '50%', background: '#6366f1' },
  submitBtn: {
    padding: '12px 32px', borderRadius: 12, fontSize: 14, fontWeight: 600,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
    border: 'none', cursor: 'pointer', marginTop: 16,
  },
  navBtn: (disabled: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '10px 24px', borderRadius: 12, fontSize: 14, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
    background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(99,102,241,0.2)', color: '#94a3b8',
    transition: 'all 0.2s',
  }),
  navBtnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '10px 24px', borderRadius: 12, fontSize: 14, fontWeight: 600,
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', color: '#fff',
  },
};

export function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const course = useMemo(() => COURSES.find(c => c.id === courseId), [courseId]);

  const [lessonIdx, setLessonIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  // Load progress
  const [progress, setProgress] = useState<Record<string, ProgressData>>(() => loadAll());
  const courseProgress = progress[courseId || ''] || { completed: [], scores: {} };

  useEffect(() => { setSelected(null); setSubmitted(false); setScore(null); }, [lessonIdx]);

  if (!course) {
    return (
      <div style={styles.container}>
        <button style={styles.backBtn} onClick={() => navigate('/learning')}>
          <ChevronLeft size={18} /> 返回学习中心
        </button>
        <div style={{ ...styles.contentCard, textAlign: 'center', padding: 60 }}>
          <p style={{ color: '#64748b', fontSize: 16 }}>课程不存在</p>
        </div>
      </div>
    );
  }

  const lesson = course.lessons[lessonIdx];
  const isCompleted = courseProgress.completed.includes(lesson.id);
  const meta = LEVEL_META.find(l => l.key === course.level);
  const totalLessons = course.lessons.length;

  const handleQuizSubmit = () => {
    if (selected === null) return;
    const correct = lesson.quiz.length > 0
      ? lesson.quiz.reduce((acc, q, i) => {
          const sel = i === 0 ? selected : null;
          return acc;
        }, 0)
      : 0;
    // Score for current quiz question (single question per lesson)
    const quizScore = selected === lesson.quiz[0]?.answer ? 1 : 0;
    setScore(quizScore);
    setSubmitted(true);

    // Save progress
    const completed = [...new Set([...courseProgress.completed, lesson.id])];
    const scores = { ...courseProgress.scores, [lesson.id]: quizScore };
    const newProgress = { ...progress, [course.id]: { completed, scores } };
    setProgress(newProgress);
    saveAll(newProgress);
  };

  const handleComplete = () => {
    if (!isCompleted) {
      const completed = [...courseProgress.completed, lesson.id];
      const newProgress = { ...progress, [course.id]: { ...courseProgress, completed } };
      setProgress(newProgress);
      saveAll(newProgress);
    }
    if (lessonIdx < totalLessons - 1) setLessonIdx(lessonIdx + 1);
  };

  // Parse content into paragraphs
  const renderContent = (text: string) => {
    return text.split('\n\n').map((para, i) => (
      <p key={i} style={{ marginBottom: 16, lineHeight: 1.8, color: '#cbd5e1', fontSize: 15 }}>
        {para}
      </p>
    ));
  };

  return (
    <div style={styles.container}>
      {/* Back button */}
      <button style={styles.backBtn} onClick={() => navigate('/learning')}>
        <ChevronLeft size={18} /> 返回学习中心
      </button>

      {/* Course header */}
      <div style={styles.headerCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: '#f1f5f9' }}>
              {course.title}
            </h1>
            <p style={{ color: '#64748b', fontSize: 13 }}>
              {course.description}
            </p>
          </div>
          <span style={{
            padding: '4px 14px', borderRadius: 12, fontSize: 12, fontWeight: 600,
            color: meta?.color || '#6366f1', background: meta?.bgColor || 'rgba(99,102,241,0.15)',
            border: '1px solid ' + (meta?.color || '#6366f1') + '33',
            whiteSpace: 'nowrap',
          }}>
            {meta?.label}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 20, fontSize: 13, color: '#64748b' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={14} /> {course.estimatedMinutes} 分钟
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <BookOpen size={14} /> {totalLessons} 节课
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#22c55e' }}>
            <Trophy size={14} /> {courseProgress.completed.length}/{totalLessons} 已完成
          </span>
        </div>
      </div>

      {/* Lesson chips */}
      <div style={styles.lessonNav}>
        {course.lessons.map((l, i) => (
          <button
            key={l.id}
            onClick={() => setLessonIdx(i)}
            style={styles.lessonChip(i === lessonIdx, courseProgress.completed.includes(l.id))}
          >
            {(i + 1) + '. ' + l.title}
          </button>
        ))}
      </div>

      {/* Lesson content */}
      <div style={styles.contentCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#f1f5f9' }}>
            {lesson.title}
          </h2>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            {(lessonIdx + 1)}/{totalLessons}
          </span>
        </div>
        {renderContent(lesson.content)}
      </div>

      {/* Key Points */}
      {lesson.keyPoints.length > 0 && (
        <div style={styles.contentCard}>
          <h3 style={{
            fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#f1f5f9',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Star size={18} style={{ color: '#f59e0b' }} />
            重点知识
          </h3>
          {lesson.keyPoints.map((kp, i) => (
            <div key={i} style={styles.keyPoint}>
              <CheckCircle2 size={18} style={{ color: '#22c55e', flexShrink: 0, marginTop: 1 }} />
              <span style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.6 }}>{kp}</span>
            </div>
          ))}
        </div>
      )}

      {/* Quiz Section */}
      {lesson.quiz.length > 0 && (
        <div style={styles.contentCard}>
          <h3 style={{
            fontSize: 16, fontWeight: 600, marginBottom: 20, color: '#f1f5f9',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <GraduationCap size={18} style={{ color: '#6366f1' }} />
            课后练习
          </h3>
          {lesson.quiz.map((q, qi) => (
            <div key={qi} style={{ marginBottom: qi < lesson.quiz.length - 1 ? 28 : 0 }}>
              <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 14, color: '#e2e8f0' }}>
                {q.question}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {q.options.map((opt, oi) => (
                  <div
                    key={oi}
                    onClick={() => !submitted && setSelected(oi)}
                    style={styles.quizOption(selected === oi, submitted ? (oi === q.answer) : null, oi, q.answer)}
                  >
                    <div style={styles.radio(selected === oi)}>
                      {selected === oi && <div style={styles.radioInner} />}
                    </div>
                    <span>{String.fromCharCode(65 + oi)}. {opt}</span>
                    {submitted && oi === q.answer && (
                      <CheckCircle2 size={16} style={{ color: '#22c55e', marginLeft: 'auto' }} />
                    )}
                  </div>
                ))}
              </div>

              {/* Submit / Score */}
              {!submitted ? (
                <button
                  style={{ ...styles.submitBtn, opacity: selected === null ? 0.5 : 1 }}
                  onClick={handleQuizSubmit}
                  disabled={selected === null}
                >
                  提交答案
                </button>
              ) : (
                <div style={{
                  marginTop: 16, padding: '16px 20px', borderRadius: 12,
                  background: score === 1 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  border: '1px solid ' + (score === 1 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'),
                }}>
                  <p style={{
                    fontSize: 15, fontWeight: 600, marginBottom: 6,
                    color: score === 1 ? '#22c55e' : '#ef4444',
                  }}>
                    {score === 1 ? '✅ 答对了！' : '❌ 答错了'}
                    <span style={{ marginLeft: 12, fontSize: 13, fontWeight: 400, color: '#64748b' }}>
                      {score === 1 ? '+1 分' : '0 分'}
                    </span>
                  </p>
                  <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
                    {q.explanation}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Navigation buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <button
          style={styles.navBtn(lessonIdx === 0)}
          onClick={() => lessonIdx > 0 && setLessonIdx(lessonIdx - 1)}
          disabled={lessonIdx === 0}
        >
          <ChevronLeft size={16} /> 上一节
        </button>
        {lessonIdx < totalLessons - 1 ? (
          <button style={styles.navBtnPrimary} onClick={handleComplete}>
            {isCompleted ? '下一节' : '完成并继续'}
            <ChevronRight size={16} />
          </button>
        ) : (
          <button style={styles.navBtnPrimary} onClick={() => navigate('/learning')}>
            <Trophy size={16} style={{ marginRight: 4 }} />
            课程完成
          </button>
        )}
      </div>
    </div>
  );
}
