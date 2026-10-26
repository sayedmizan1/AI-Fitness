import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { analyticsApi, workoutApi } from '../api/coach';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dumbbell, Flame, TrendingUp, Target, Play, MessageSquare,
  BarChart3, Zap, Trophy, Calendar, ChevronRight, Brain,
  Activity, Sparkles, Battery, Clock, Star,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  LineChart, Line, CartesianGrid,
} from 'recharts';

// Simulated AI-generated insight based on time of day + data
function getAIInsight(analytics: any, user: any) {
  const h = new Date().getHours();
  const name = user?.full_name?.split(' ')[0] ?? 'Athlete';
  const streak = analytics?.consistency_score ?? 0;
  if (!analytics) return { title: `Welcome, ${name}! 🎯`, body: 'Complete your first session to unlock AI-powered insights and personalized coaching recommendations.', icon: '🚀', color: '#6366f1' };
  if (h < 9)  return { title: `Morning fuel activated, ${name}!`, body: `Your ${Math.round(streak)}% consistency is building real habits. Morning workouts boost metabolism 25% longer. Keep the streak alive.`, icon: '🌅', color: '#f59e0b' };
  if (h < 14) return { title: `Peak performance window, ${name}!`, body: `Muscle strength is typically 10-25% higher mid-morning. Great time for strength work. Your data shows you perform best at this hour.`, icon: '⚡', color: '#22c55e' };
  if (h < 18) return { title: `Afternoon power, ${name}!`, body: `Core temperature peaks 4–6pm — ideal for speed and power exercises. Your recent sessions show ${Math.round(streak)}% consistency. Excellent.`, icon: '🔥', color: '#f97316' };
  return { title: `Evening recovery mode, ${name}!`, body: `Great time for flexibility and moderate training. Your body recovers 40% faster with proper post-workout nutrition. Rest well tonight.`, icon: '🌙', color: '#a78bfa' };
}

// Simulated AI muscle recovery status
function getRecoveryStatus(analytics: any) {
  const score = analytics?.consistency_score ?? 0;
  return [
    { muscle: 'Quadriceps',   pct: Math.min(100, 70 + score * 0.3), color: '#22c55e' },
    { muscle: 'Chest',        pct: Math.min(100, 85 + score * 0.15), color: '#6366f1' },
    { muscle: 'Back',         pct: Math.min(100, 60 + score * 0.4),  color: '#38bdf8' },
    { muscle: 'Shoulders',    pct: Math.min(100, 90 + score * 0.1),  color: '#f59e0b' },
    { muscle: 'Core',         pct: Math.min(100, 75 + score * 0.25), color: '#f97316' },
    { muscle: 'Hamstrings',   pct: Math.min(100, 65 + score * 0.35), color: '#a78bfa' },
  ];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: 'rgba(9,12,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '8px 12px', fontSize: 12, color: '#e4e4e7' }}>
        <strong>{label}</strong>: {payload[0].value} sessions
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const user    = useSelector((s: RootState) => s.auth.user);
  const profile = useSelector((s: RootState) => s.auth.profile);
  const [analytics, setAnalytics] = useState<any>(null);
  const [sessions, setSessions]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [aiThinking, setAiThinking] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [a, s] = await Promise.all([analyticsApi.getSummary(), workoutApi.getSessions()]);
        setAnalytics(a);
        setSessions(s.slice(0, 5));
      } catch {}
      setLoading(false);
      setTimeout(() => setAiThinking(false), 1200);
    };
    load();
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const aiInsight  = getAIInsight(analytics, user);
  const recovery   = getRecoveryStatus(analytics);

  const statCards = [
    { label: 'Total Sessions', value: analytics?.total_sessions ?? 0,                     icon: Calendar,   color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.2)' },
    { label: 'Total Reps',     value: analytics?.total_reps?.toLocaleString() ?? 0,        icon: Dumbbell,   color: '#6366f1', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.2)' },
    { label: 'Cals Burned',    value: Math.round(analytics?.total_calories ?? 0),           icon: Flame,      color: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.2)' },
    { label: 'Consistency',    value: `${Math.round(analytics?.consistency_score ?? 0)}%`, icon: TrendingUp, color: '#38bdf8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.2)' },
  ];

  // Fake performance trend data for sparkline
  const trendData = Array.from({ length: 7 }, (_, i) => ({
    day: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i],
    score: 55 + Math.round(Math.sin(i * 0.9) * 20 + (analytics?.consistency_score ?? 40) * 0.4),
  }));

  return (
    <div className="flex-1 p-5 space-y-5 max-w-screen-xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl text-white flex items-center gap-3">
              {greeting()}, {user?.full_name?.split(' ')[0]} 👋
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {profile
                ? `Goal: ${profile.goal?.replace('_', ' ')} · BMI: ${profile.bmi?.toFixed(1)} · ${profile.training_days_per_week} days/week`
                : 'Complete your fitness profile to unlock personalized AI coaching'}
            </p>
          </div>
          <Link to="/workout" className="btn-primary hidden sm:flex">
            <Play className="w-4 h-4" /> Start Workout
          </Link>
        </div>
      </motion.div>

      {/* ── AI Daily Brief ───────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div style={{
          borderRadius: 18, padding: '18px 20px',
          background: `linear-gradient(135deg, ${aiInsight.color}12, ${aiInsight.color}06)`,
          border: `1px solid ${aiInsight.color}28`,
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Glow blob */}
          <div style={{ position: 'absolute', top: -30, right: -30, width: 150, height: 150, background: `radial-gradient(circle, ${aiInsight.color}15, transparent)`, borderRadius: '50%', pointerEvents: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${aiInsight.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 22 }}>
              {aiInsight.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: aiInsight.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  🧠 AI Daily Brief
                </span>
                <AnimatePresence>
                  {aiThinking && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', gap: 3 }}>
                      {[0,1,2].map(i => (
                        <motion.div key={i} animate={{ y: [0,-3,0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }} style={{ width: 4, height: 4, borderRadius: '50%', background: aiInsight.color }} />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <AnimatePresence mode="wait">
                {!aiThinking && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f4f4f5', marginBottom: 5 }}>{aiInsight.title}</div>
                    <div style={{ fontSize: 12.5, color: '#a1a1aa', lineHeight: 1.65 }}>{aiInsight.body}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <Link to="/coach" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 9, background: `${aiInsight.color}15`, border: `1px solid ${aiInsight.color}30`, color: aiInsight.color, fontSize: 11.5, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
              <MessageSquare size={12} /> Ask AI
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ── Stat Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.07 }}
            style={{ borderRadius: 16, padding: '16px', background: s.bg, border: `1px solid ${s.border}` }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: '#71717a', fontWeight: 600 }}>{s.label}</span>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon size={15} color={s.color} />
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* ── Main Grid ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Weekly Chart + Form trend */}
        <div className="lg:col-span-3 space-y-4">

          {/* Weekly Sessions */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2 text-sm">
              <BarChart3 className="w-4 h-4 text-brand-400" /> Weekly Workout Sessions
            </h2>
            {analytics?.weekly_sessions?.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={analytics.weekly_sessions} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="week" stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 11 }} />
                  <YAxis stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="sessions" fill="url(#barGrad)" radius={[5,5,0,0]} />
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#16a34a" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-gray-600">
                <div className="text-center">
                  <Dumbbell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No workout data yet. Start your first session!</p>
                </div>
              </div>
            )}
          </div>

          {/* AI Performance Trend */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 className="font-semibold text-white flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-accent-400" />AI Form Score Trend
              </h2>
              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 10, background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', fontWeight: 600 }}>
                AI Estimated
              </span>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="day" stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 10 }} />
                <YAxis domain={[0, 100]} stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 10 }} />
                <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#818cf8', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { to: '/workout', icon: Dumbbell,      label: 'Start Workout', sub: 'AI-guided',      color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.2)' },
              { to: '/coach',   icon: MessageSquare, label: 'AI Coach',      sub: 'Ask anything',   color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)' },
              { to: '/analytics',icon: BarChart3,    label: 'Analytics',     sub: 'View progress',  color: '#38bdf8', bg: 'rgba(56,189,248,0.08)',  border: 'rgba(56,189,248,0.2)' },
            ].map(q => (
              <Link key={q.to} to={q.to} style={{ textDecoration: 'none' }}>
                <motion.div
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  style={{ borderRadius: 14, padding: '14px 12px', background: q.bg, border: `1px solid ${q.border}`, cursor: 'pointer', transition: 'all 0.15s' }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: `${q.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                    <q.icon size={16} color={q.color} />
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#f4f4f5', marginBottom: 2 }}>{q.label}</div>
                  <div style={{ fontSize: 10.5, color: '#52525b' }}>{q.sub}</div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Right panel ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* AI Muscle Recovery Map */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Battery size={13} color="#22c55e" />
              </div>
              <h2 className="font-semibold text-white text-sm">AI Muscle Recovery</h2>
              <span style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 700, color: '#52525b', background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: 8 }}>
                Estimated
              </span>
            </div>
            {recovery.map(r => (
              <div key={r.muscle} style={{ marginBottom: 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: '#71717a', fontWeight: 500 }}>{r.muscle}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: r.pct > 80 ? '#22c55e' : r.pct > 50 ? '#f59e0b' : '#ef4444' }}>
                    {Math.round(r.pct)}%
                  </span>
                </div>
                <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${r.pct}%` }}
                    transition={{ duration: 1, delay: 0.3 }}
                    style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${r.color}60, ${r.color})` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* AI Profile */}
          {profile && (
            <div className="card" style={{ borderColor: 'rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Brain size={14} color="#818cf8" />
                <h2 className="font-semibold text-white text-sm">AI Profile</h2>
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 9.5, fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 10 }}>
                  <Sparkles size={9} /> Active
                </span>
              </div>
              <div className="space-y-2 text-sm">
                {[
                  ['Daily Calories', `${profile.daily_calories ?? '—'} kcal`],
                  ['Training Days',  `${profile.training_days_per_week ?? '—'} days/week`],
                  ['BMI',           profile.bmi?.toFixed(1) ?? '—'],
                  ['Experience',    profile.experience],
                  ['Goal',          profile.goal?.replace('_', ' ')],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-gray-500 text-xs">{k}</span>
                    <span className="text-white font-semibold text-xs capitalize">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Sessions */}
          <div className="card">
            <h2 className="font-semibold text-white mb-3 flex items-center gap-2 text-sm">
              <Trophy className="w-4 h-4 text-yellow-400" /> Recent Sessions
            </h2>
            {sessions.length > 0 ? (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0">
                    <div>
                      <p className="text-white font-medium text-xs">
                        {new Date(s.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-gray-500 text-xs">{s.duration_mins ? `${Math.round(s.duration_mins)} min` : 'In progress'}</p>
                    </div>
                    <span className={`badge ${s.status === 'completed' ? 'badge-green' : 'badge-orange'} text-xs`}>
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Clock className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-600 text-xs">No sessions yet</p>
                <Link to="/workout" className="inline-flex items-center gap-1 mt-3 text-brand-400 text-xs font-semibold hover:text-brand-300">
                  Start your first session <ChevronRight size={12} />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
