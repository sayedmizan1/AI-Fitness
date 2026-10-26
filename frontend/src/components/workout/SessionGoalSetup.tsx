/**
 * SessionGoalSetup — Premium Goal Configuration Panel
 *
 * Features:
 * • Workout template presets: Strength, Hypertrophy, Endurance, AMRAP, Custom
 * • Quick-select cards (tap to pick)
 * • Visual rest duration slider with intensity labels
 * • Estimated session duration preview
 * • Smooth collapsible animation
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { setSessionGoal } from '../../store/workoutSlice';
import { Target, ChevronDown, ChevronUp, Clock, Zap, TrendingUp, Repeat, Dumbbell } from 'lucide-react';

interface Template {
  id: string;
  label: string;
  icon: typeof Dumbbell;
  color: string;
  sets: number;
  reps: number;
  rest: number;
  mode: 'fixed' | 'amrap' | 'interval';
  description: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'strength', label: 'Strength', icon: Dumbbell, color: '#ef4444',
    sets: 5, reps: 5, rest: 180, mode: 'fixed',
    description: '5×5 heavy compound — max strength gains',
  },
  {
    id: 'hypertrophy', label: 'Hypertrophy', icon: TrendingUp, color: '#6366f1',
    sets: 4, reps: 12, rest: 90, mode: 'fixed',
    description: '4×12 moderate weight — muscle growth',
  },
  {
    id: 'endurance', label: 'Endurance', icon: Repeat, color: '#22c55e',
    sets: 3, reps: 20, rest: 45, mode: 'fixed',
    description: '3×20 light weight — muscular endurance',
  },
  {
    id: 'amrap', label: 'AMRAP', icon: Zap, color: '#f59e0b',
    sets: 3, reps: 999, rest: 60, mode: 'amrap',
    description: 'As many reps as possible — max effort',
  },
];

const REST_LABELS: Record<number, { label: string; color: string }> = {
  30:  { label: 'Endurance', color: '#22c55e' },
  45:  { label: 'Circuit',   color: '#84cc16' },
  60:  { label: 'Moderate',  color: '#f59e0b' },
  90:  { label: 'Hypertrophy',color: '#f97316' },
  120: { label: 'Strength',  color: '#ef4444' },
  180: { label: 'Max Power', color: '#a855f7' },
};

function estimateDuration(sets: number, reps: number, rest: number): string {
  const repTime = Math.min(reps, 20) * 3; // ~3s per rep
  const total = sets * (repTime + rest);
  const mins = Math.round(total / 60);
  return mins < 60 ? `~${mins} min` : `~${Math.floor(mins / 60)}h ${mins % 60}m`;
}

interface Props { isVisible: boolean; }

export default function SessionGoalSetup({ isVisible }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const goal     = useSelector((s: RootState) => s.workout.sessionGoal);
  const [expanded, setExpanded] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<string | null>('hypertrophy');

  const applyTemplate = (t: Template) => {
    setActiveTemplate(t.id);
    dispatch(setSessionGoal({ sets: t.sets, repsPerSet: t.reps, restDuration: t.rest, mode: t.mode }));
  };

  const update = (field: string, value: number | string) => {
    setActiveTemplate('custom');
    dispatch(setSessionGoal({ [field]: value }));
  };

  const restLabel = REST_LABELS[goal.restDuration] ?? { label: 'Custom', color: '#a1a1aa' };
  const duration  = estimateDuration(goal.sets, goal.repsPerSet, goal.restDuration);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        style={{
          borderRadius: 16, overflow: 'hidden',
          background: 'rgba(13,17,23,0.9)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Header */}
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: 'rgba(99,102,241,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Target size={13} color="#818cf8" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#e4e4e7' }}>Session Goal</div>
            <div style={{ fontSize: 10, color: '#52525b', marginTop: 1 }}>
              {goal.mode === 'amrap'
                ? `${goal.sets} sets AMRAP · ${goal.restDuration}s rest · ${duration}`
                : `${goal.sets} sets × ${goal.repsPerSet} reps · ${goal.restDuration}s rest · ${duration}`
              }
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <div style={{
              padding: '2px 8px', borderRadius: 20,
              background: `${restLabel.color}18`,
              border: `1px solid ${restLabel.color}40`,
              fontSize: 9, fontWeight: 800, color: restLabel.color,
            }}>
              {restLabel.label}
            </div>
            {expanded ? <ChevronUp size={14} color="#52525b" /> : <ChevronDown size={14} color="#52525b" />}
          </div>
        </button>

        {/* Expanded content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              style={{ overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div style={{ padding: '14px' }}>

                {/* Template presets */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#52525b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Workout Templates
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                    {TEMPLATES.map(t => {
                      const Icon = t.icon;
                      const isActive = activeTemplate === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => applyTemplate(t)}
                          style={{
                            padding: '10px 10px', borderRadius: 10, cursor: 'pointer',
                            background: isActive ? `${t.color}10` : 'rgba(255,255,255,0.02)',
                            border: `1.5px solid ${isActive ? `${t.color}50` : 'rgba(255,255,255,0.06)'}`,
                            textAlign: 'left', transition: 'all 0.18s',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <Icon size={11} color={isActive ? t.color : '#52525b'} />
                            <span style={{ fontSize: 11, fontWeight: 800, color: isActive ? t.color : '#a1a1aa' }}>{t.label}</span>
                          </div>
                          <div style={{ fontSize: 9, color: '#52525b', lineHeight: 1.4 }}>{t.description}</div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: '#3f3f46', marginTop: 4 }}>
                            {t.mode === 'amrap' ? `${t.sets}×AMRAP` : `${t.sets}×${t.reps}`} · {t.rest}s rest
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom inputs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                  {[
                    { label: 'Sets', key: 'sets', val: goal.sets, min: 1, max: 10 },
                    { label: 'Reps', key: 'repsPerSet', val: goal.repsPerSet, min: 1, max: 50 },
                    { label: 'Rest (s)', key: 'restDuration', val: goal.restDuration, min: 15, max: 300 },
                  ].map(({ label, key, val, min, max }) => (
                    <div key={key}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button onClick={() => update(key, Math.max(min, val - 1))}
                          style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#a1a1aa', fontSize: 14, lineHeight: '22px', cursor: 'pointer' }}>−</button>
                        <span style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 800, color: '#f4f4f5', fontVariantNumeric: 'tabular-nums' }}>{val}</span>
                        <button onClick={() => update(key, Math.min(max, val + 1))}
                          style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#a1a1aa', fontSize: 14, lineHeight: '22px', cursor: 'pointer' }}>+</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Rest presets */}
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    Rest Duration Presets
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {Object.entries(REST_LABELS).map(([sec, { label, color }]) => {
                      const s = parseInt(sec);
                      const active = goal.restDuration === s;
                      return (
                        <button key={sec} onClick={() => update('restDuration', s)}
                          style={{
                            padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                            background: active ? `${color}18` : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${active ? `${color}50` : 'rgba(255,255,255,0.07)'}`,
                            fontSize: 10, fontWeight: 700,
                            color: active ? color : '#71717a',
                            transition: 'all 0.15s',
                          }}
                        >
                          {s}s · {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Duration preview */}
                <div style={{
                  marginTop: 12, padding: '8px 12px', borderRadius: 10,
                  background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <Clock size={12} color="#818cf8" />
                  <span style={{ fontSize: 11, color: '#818cf8', fontWeight: 600 }}>
                    Estimated session: <strong>{duration}</strong>
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
