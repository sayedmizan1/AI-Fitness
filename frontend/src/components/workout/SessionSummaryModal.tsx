/**
 * SessionSummaryModal — World-Class Post-Session Summary (v2)
 *
 * Fixes:
 * • Confetti renders ABOVE the modal (fixed z-index)
 * • AI Session Analysis calls real backend LLM (with local fallback)
 * • Desktop: centered modal; Mobile: bottom sheet
 * • Cleaner stats grid with better typography
 */
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award, Share2, RotateCcw, X, CheckCircle, Zap, Flame, Clock,
  TrendingUp, Star, Target, Brain, Loader2,
} from 'lucide-react';
import { coachApi } from '../../api/coach';

interface SetRecord {
  setNum: number; reps: number; avgFormScore: number;
  duration: number; effortRating: number;
}

interface Stats {
  duration: number;
  totalReps: number;
  calories: number;
  avgFormScore: number;
  setHistory: SetRecord[];
  exerciseName: string;
  personalBest: boolean;
  setsCompleted: number;
  goalSets: number;
  goalRepsPerSet: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNewSession: () => void;
  stats: Stats | null;
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function getGrade(score: number): { letter: string; color: string; glow: string; label: string } {
  if (score >= 90) return { letter: 'A+', color: '#22c55e', glow: 'rgba(34,197,94,0.35)',   label: 'Elite' };
  if (score >= 80) return { letter: 'A',  color: '#4ade80', glow: 'rgba(74,222,128,0.3)',   label: 'Excellent' };
  if (score >= 70) return { letter: 'B',  color: '#84cc16', glow: 'rgba(132,204,22,0.3)',   label: 'Good' };
  if (score >= 58) return { letter: 'C',  color: '#f59e0b', glow: 'rgba(245,158,11,0.3)',   label: 'Fair' };
  if (score >= 45) return { letter: 'D',  color: '#f97316', glow: 'rgba(249,115,22,0.3)',   label: 'Needs Work' };
  return               { letter: 'F',  color: '#ef4444', glow: 'rgba(239,68,68,0.3)',   label: 'Poor' };
}

function generateLocalAnalysis(stats: Stats): string {
  const grade = getGrade(stats.avgFormScore);
  const completionPct = Math.round((stats.setsCompleted / Math.max(stats.goalSets, 1)) * 100);
  const parts: string[] = [];

  if (grade.letter === 'A+' || grade.letter === 'A') {
    parts.push(`Outstanding session! Your ${stats.exerciseName} technique was elite-level throughout.`);
  } else if (grade.letter === 'B') {
    parts.push(`Solid session on ${stats.exerciseName}. Your form held up well across all sets.`);
  } else {
    parts.push(`Good effort on ${stats.exerciseName}. There's room to refine your technique for next time.`);
  }

  if (stats.personalBest) parts.push(`You hit a new personal record — ${stats.totalReps} total reps! 🏆`);

  if (completionPct >= 100) {
    parts.push(`Perfect goal completion: ${stats.setsCompleted}/${stats.goalSets} sets finished.`);
  } else if (completionPct >= 75) {
    parts.push(`You completed ${completionPct}% of your goal — great consistency.`);
  }

  if (stats.setHistory.length > 1) {
    const first = stats.setHistory[0]?.avgFormScore ?? 0;
    const last  = stats.setHistory[stats.setHistory.length - 1]?.avgFormScore ?? 0;
    if (last > first + 5) parts.push('Your form actually improved across sets — excellent fatigue management!');
    else if (last < first - 10) parts.push('Form dropped toward the end. Consider ending sets earlier to protect quality.');
  }

  parts.push('Keep it up — consistency is the secret to long-term results. See you in the next session!');
  return parts.join(' ');
}

// ── Confetti ─────────────────────────────────────────────────────────────────
// Rendered at z-index 10001 (above the modal's 1000)
function Confetti({ count = 70 }: { count?: number }) {
  const pieces = Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    dur: 0.7 + Math.random() * 0.6,
    color: ['#22c55e', '#6366f1', '#f59e0b', '#38bdf8', '#f43f5e', '#a78bfa', '#fbbf24'][i % 7],
    size: 5 + Math.random() * 6,
    rotate: Math.random() * 360,
  }));
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10001, overflow: 'hidden' }}>
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`, width: p.size, height: p.size * 0.5,
            background: p.color,
            animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

// ── Typewriter ────────────────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 18, enabled = true) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!enabled || !text) return;
    setDisplayed('');
    let i = 0;
    const id = setInterval(() => {
      setDisplayed(text.slice(0, ++i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed, enabled]);
  return displayed;
}

export default function SessionSummaryModal({ isOpen, onClose, onNewSession, stats }: Props) {
  const [showConfetti, setShowConfetti]     = useState(false);
  const [copied, setCopied]                 = useState(false);
  const [aiAnalysis, setAiAnalysis]         = useState('');
  const [aiLoading, setAiLoading]           = useState(false);
  const [aiAgent, setAiAgent]               = useState('');

  // Fetch real AI analysis when modal opens
  useEffect(() => {
    if (!isOpen || !stats) return;

    // Confetti for good grades
    const grade = getGrade(stats.avgFormScore);
    if (['A+', 'A', 'B'].includes(grade.letter) || stats.personalBest) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 2500);
      return () => clearTimeout(t);
    }
  }, [isOpen, stats]);

  useEffect(() => {
    if (!isOpen || !stats) { setAiAnalysis(''); return; }
    setAiLoading(true);
    setAiAnalysis('');

    coachApi.sessionAnalysis({
      exercise_name:   stats.exerciseName,
      duration_secs:   stats.duration,
      total_reps:      stats.totalReps,
      avg_form_score:  stats.avgFormScore,
      sets_completed:  stats.setsCompleted,
      goal_sets:       stats.goalSets,
      calories:        stats.calories,
      set_history:     stats.setHistory,
      personal_best:   stats.personalBest,
    }).then(res => {
      setAiAnalysis(res.analysis);
      setAiAgent(res.agent_used);
    }).catch(() => {
      setAiAnalysis(generateLocalAnalysis(stats));
      setAiAgent('local');
    }).finally(() => setAiLoading(false));
  }, [isOpen, stats]); // eslint-disable-line

  const typewriterText = useTypewriter(aiAnalysis, 16, isOpen && !!aiAnalysis);

  const handleShare = useCallback(async () => {
    if (!stats) return;
    const grade = getGrade(stats.avgFormScore);
    const text = [
      `🏋️ FitMentor AI Workout`,
      `Exercise: ${stats.exerciseName}`,
      `Duration: ${formatTime(stats.duration)}`,
      `Total Reps: ${stats.totalReps}`,
      `Avg Form: ${stats.avgFormScore}% (${grade.letter})`,
      `Calories: ~${stats.calories}`,
      `Sets: ${stats.setsCompleted}/${stats.goalSets}`,
      stats.personalBest ? '🏆 New Personal Record!' : '',
    ].filter(Boolean).join('\n');

    try {
      if (navigator.share) {
        await navigator.share({ title: 'My Workout Summary', text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  }, [stats]);

  if (!isOpen || !stats) return null;

  const grade = getGrade(stats.avgFormScore);
  const completionPct = Math.min(100, Math.round((stats.setsCompleted / Math.max(stats.goalSets, 1)) * 100));
  const maxReps = Math.max(...(stats.setHistory.map(s => s.reps)), 1);

  const achievements = [
    { id: 'form',    label: 'Perfect Form',    emoji: '🎯', earned: stats.avgFormScore >= 85,  cls: 'earned-green' },
    { id: 'pr',      label: 'Personal Record', emoji: '🏆', earned: stats.personalBest,         cls: 'earned' },
    { id: 'goal',    label: 'Goal Crusher',    emoji: '🏅', earned: completionPct >= 100,        cls: 'earned-blue' },
    { id: 'consist', label: 'Consistency',     emoji: '⭐', earned: stats.setHistory.length >= 3 && stats.setHistory.every(s => s.avgFormScore >= 65), cls: 'earned' },
    { id: 'calorie', label: 'Calorie Burner',  emoji: '🔥', earned: stats.calories >= 80,        cls: 'earned' },
    { id: 'endure',  label: 'Endurance',       emoji: '💪', earned: stats.totalReps >= 40,       cls: 'earned-blue' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {showConfetti && <Confetti />}

          {/* Backdrop */}
          <motion.div
            className="session-summary-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          >
            {/* Sheet / Modal */}
            <motion.div
              className="session-summary-sheet"
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="sheet-handle" />

              {/* Close */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px 16px 0' }}>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', padding: 6 }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: '0 20px 28px' }}>

                {/* Grade hero */}
                <div style={{ textAlign: 'center', marginBottom: 18 }}>
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.1 }}
                    style={{
                      width: 76, height: 76, borderRadius: 22,
                      background: `radial-gradient(circle, ${grade.glow} 0%, transparent 70%)`,
                      border: `2px solid ${grade.color}55`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 12px',
                      boxShadow: `0 0 36px ${grade.glow}`,
                    }}>
                    <span style={{ fontSize: 32, fontWeight: 900, color: grade.color }}>{grade.letter}</span>
                  </motion.div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: '#f4f4f5', marginBottom: 3 }}>
                    {stats.exerciseName} Complete!
                  </div>
                  <div style={{ fontSize: 12.5, color: grade.color, fontWeight: 700 }}>
                    {grade.label} Performance
                  </div>
                  {stats.personalBest && (
                    <motion.div
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6,
                        padding: '3px 12px', borderRadius: 20,
                        background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.35)',
                        fontSize: 11, fontWeight: 700, color: '#fbbf24',
                      }}>
                      🏆 New Personal Record!
                    </motion.div>
                  )}
                </div>

                {/* Key stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7, marginBottom: 14 }}>
                  {[
                    { label: 'Duration',  value: formatTime(stats.duration), icon: Clock,      color: '#6366f1' },
                    { label: 'Total Reps',value: stats.totalReps,            icon: Zap,        color: '#22c55e' },
                    { label: 'Calories',  value: `~${stats.calories}`,       icon: Flame,      color: '#f97316' },
                    { label: 'Avg Form',  value: `${stats.avgFormScore}%`,   icon: TrendingUp, color: grade.color },
                    { label: 'Sets Done', value: `${stats.setsCompleted}/${stats.goalSets}`, icon: Target, color: '#a78bfa' },
                    { label: 'Goal',      value: `${completionPct}%`,        icon: Star,       color: completionPct >= 100 ? '#22c55e' : '#f59e0b' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} style={{ padding: '10px 6px', borderRadius: 12, textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <Icon size={13} color={color} style={{ margin: '0 auto 4px' }} />
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#f4f4f5', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                      <div style={{ fontSize: 9, color: '#52525b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Set bar chart */}
                {stats.setHistory.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#52525b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                      Set Breakdown
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 72 }}>
                      {stats.setHistory.map((s, i) => {
                        const h = Math.round((s.reps / maxReps) * 62);
                        const c = s.avgFormScore >= 80 ? '#22c55e' : s.avgFormScore >= 60 ? '#f59e0b' : '#ef4444';
                        return (
                          <motion.div
                            key={i}
                            initial={{ height: 0 }} animate={{ height: h }}
                            transition={{ delay: i * 0.07, type: 'spring', stiffness: 200, damping: 20 }}
                            style={{ flex: 1, borderRadius: '4px 4px 0 0', background: c, minWidth: 24, position: 'relative' }}
                            title={`Set ${s.setNum}: ${s.reps} reps, ${s.avgFormScore}% form`}
                          >
                            <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: 9, fontWeight: 800, color: c, whiteSpace: 'nowrap' }}>
                              {s.reps}
                            </div>
                            <div style={{ position: 'absolute', bottom: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 8, color: '#52525b', whiteSpace: 'nowrap' }}>
                              S{s.setNum}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                    <div style={{ marginTop: 22, height: 1, background: 'rgba(255,255,255,0.05)' }} />
                  </div>
                )}

                {/* AI Analysis */}
                <div style={{ padding: '12px 14px', borderRadius: 13, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.14)', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Brain size={13} color="#818cf8" />
                      </div>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: '#6366f1', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                        AI Session Analysis
                      </span>
                    </div>
                    {aiAgent && aiAgent !== 'local' && (
                      <span style={{ fontSize: 9, color: '#4ade80', fontWeight: 700, background: 'rgba(34,197,94,0.1)', padding: '2px 7px', borderRadius: 8 }}>
                        LLM powered
                      </span>
                    )}
                  </div>
                  {aiLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                      <Loader2 size={13} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
                      <span style={{ fontSize: 11.5, color: '#52525b' }}>Analysing your session with AI...</span>
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: 12, color: '#a5b4fc', lineHeight: 1.7 }}>
                      {typewriterText}
                      {typewriterText.length < aiAnalysis.length && (
                        <motion.span
                          animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }}
                          style={{ display: 'inline-block', width: 2, height: 13, background: '#6366f1', marginLeft: 2, verticalAlign: 'middle' }}
                        />
                      )}
                    </p>
                  )}
                </div>

                {/* Achievement badges */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#52525b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                    Achievements
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {achievements.map(a => (
                      <div key={a.id} className={`achievement-badge${a.earned ? ` ${a.cls}` : ''}`}>
                        <span style={{ fontSize: 18 }}>{a.emoji}</span>
                        <span>{a.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <motion.button
                    onClick={onNewSession}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '13px', borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                      color: '#fff', fontSize: 14, fontWeight: 800,
                      boxShadow: '0 4px 20px rgba(34,197,94,0.35)',
                    }}>
                    <RotateCcw size={15} /> New Session
                  </motion.button>
                  <motion.button
                    onClick={handleShare}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    style={{
                      padding: '13px 16px', borderRadius: 12, cursor: 'pointer',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      color: copied ? '#4ade80' : '#a1a1aa', fontSize: 13, fontWeight: 700,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                    {copied ? <CheckCircle size={15} /> : <Share2 size={15} />}
                    {copied ? 'Copied!' : 'Share'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
