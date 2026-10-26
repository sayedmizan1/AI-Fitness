import { useEffect, useState } from 'react';
import { analyticsApi } from '../api/coach';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { BarChart3, Flame, Dumbbell, TrendingUp, Target, Award } from 'lucide-react';

const COLORS = ['#22c55e', '#8b5cf6', '#f59e0b', '#3b82f6', '#ef4444', '#06b6d4', '#ec4899'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="glass rounded-lg px-3 py-2 text-xs text-white">
        <p className="font-medium mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Analytics() {
  const [data, setData] = useState<any>(null);
  const [progress, setProgress] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [a, p, g] = await Promise.all([
          analyticsApi.getSummary(),
          analyticsApi.getProgress(),
          analyticsApi.getGoals(),
        ]);
        setData(a);
        setProgress(p.slice(0, 30).reverse());
        setGoals(g);
      } catch { /* no data */ }
      setLoading(false);
    };
    load();
  }, []);

  const topStats = [
    { label: 'Total Sessions', value: data?.total_sessions ?? 0, icon: Dumbbell, color: 'text-brand-400' },
    { label: 'Total Reps', value: (data?.total_reps ?? 0).toLocaleString(), icon: TrendingUp, color: 'text-accent-400' },
    { label: 'Calories Burned', value: `${Math.round(data?.total_calories ?? 0)} kcal`, icon: Flame, color: 'text-orange-400' },
    { label: 'Avg Form Score', value: `${Math.round(data?.avg_form_score ?? 0)}%`, icon: Award, color: 'text-blue-400' },
    { label: 'Consistency', value: `${Math.round(data?.consistency_score ?? 0)}%`, icon: Target, color: 'text-green-400' },
  ];

  if (loading) {
    return (
      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-40" />)}
        </div>
      </div>
    );
  }

  const hasData = data?.total_sessions > 0;

  return (
    <div className="flex-1 p-6 space-y-6">
      <div>
        <h1 className="font-display font-bold text-3xl text-white flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-brand-400" />
          Analytics
        </h1>
        <p className="text-gray-400 mt-1">Track your fitness journey</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {topStats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="stat-card"
          >
            <s.icon className={`w-5 h-5 ${s.color}`} />
            <div className={`font-display font-bold text-2xl ${s.color}`}>{s.value}</div>
            <div className="text-gray-500 text-xs">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {!hasData ? (
        <div className="card text-center py-20">
          <Dumbbell className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <h2 className="font-display font-bold text-xl text-white mb-2">No Data Yet</h2>
          <p className="text-gray-500">Complete workout sessions to see your analytics here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weekly Sessions */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4">Weekly Sessions</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data?.weekly_sessions || []}>
                <XAxis dataKey="week" stroke="#4b5563" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis stroke="#4b5563" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="sessions" fill="#22c55e" radius={[4, 4, 0, 0]} name="Sessions" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Exercise Breakdown */}
          {data?.exercise_breakdown?.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-white mb-4">Exercise Breakdown</h2>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data.exercise_breakdown}
                    cx="50%" cy="50%"
                    outerRadius={80}
                    dataKey="count"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {data.exercise_breakdown.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Weight Trend */}
          {progress.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-white mb-4">Weight Trend</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={progress}>
                  <XAxis dataKey="date" stroke="#4b5563" tick={{ fill: '#9ca3af', fontSize: 11 }}
                    tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                  <YAxis stroke="#4b5563" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="weight_kg" stroke="#8b5cf6" strokeWidth={2.5}
                    dot={{ fill: '#8b5cf6', r: 4 }} name="Weight (kg)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Goals */}
          {goals.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-brand-400" />
                Active Goals
              </h2>
              <div className="space-y-4">
                {goals.filter(g => g.status === 'active').map((g) => {
                  const pct = g.target_value && g.current_value
                    ? Math.min(100, Math.round((g.current_value / g.target_value) * 100))
                    : 0;
                  return (
                    <div key={g.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-white font-medium">{g.description}</span>
                        <span className="text-gray-400">{pct}%</span>
                      </div>
                      <div className="w-full h-2 bg-dark-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-gradient rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
