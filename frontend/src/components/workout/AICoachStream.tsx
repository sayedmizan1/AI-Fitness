/**
 * AICoachStream — Smarter Adaptive Coaching Engine
 *
 * Enhancements:
 * • Context-aware: warm-up cues (rep 1–3) vs fatigue cues (rep 10+)
 * • Fatigue detection: drops in consecutive form score → "Consider stopping"
 * • Positive reinforcement streaks: 3+ perfect reps in a row
 * • Set halfway point motivation
 * • Correction history memory — no repeated advice
 * • Adaptive interval: 4s (poor form) / 8s (fair) / 12s (good)
 * • BreathingPacer during rest
 * • Premium card design with priority color coding
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Wind, Zap, TrendingDown, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

interface Props {
  exercise: string | null;
  currentState: string;
  formScore: number;
  corrections: string[];
  repCount: number;
  isSessionActive: boolean;
  isDetected: boolean;
  isResting: boolean;
}

// ── Coaching message banks ─────────────────────────────────────
const WARMUP_CUES = [
  'Start slow and feel the movement pattern — quality over speed.',
  'First reps are warm-up reps. Focus on alignment, not power.',
  'Let your joints warm up. Controlled motion now pays dividends later.',
];

const MIDSET_PUSH = [
  "Halfway there! You're doing great — keep the form tight.",
  'This is where champions are made. Every rep counts.',
  'Breathe and push. Your muscles are adapting right now.',
];

const FATIGUE_WARN = [
  '⚠ Form is dropping. Consider ending this set to prevent injury.',
  '⚠ You\'re fatiguing. Stop if you feel your form break down.',
  '⚠ Quality over quantity. A clean stop beats a sloppy rep.',
];

const PERFECT_STREAK = [
  '🔥 Perfect form streak! Your technique is elite.',
  '⭐ Flawless reps! You\'re dialing this exercise in perfectly.',
  '🎯 Biomechanics locked in. This is textbook form.',
];

const EXERCISE_CUES: Record<string, string[]> = {
  squat:          ['Drive knees out over toes.', 'Chest up, brace your core.', 'Full depth — crease below the knee.'],
  deadlift:       ['Hinge at the hips, not the waist.', 'Keep the bar close to your body.', 'Squeeze your glutes at lockout.'],
  pushup:         ['Elbows at 45° — not flared out.', 'Tight core prevents hip sag.', 'Full range: chest to floor.'],
  bicep_curl:     ['Pin elbows to your sides.', 'Supinate at the top for peak contraction.', 'Don\'t swing your back.'],
  shoulder_press: ['Stack wrists over elbows.', 'Drive through your lats at lockout.', 'Don\'t arch your lower back.'],
  lunge:          ['Front knee tracks over second toe.', 'Drive up through your heel.', 'Upright torso throughout.'],
  squat_jump:     ['Land soft — bend knees on impact.', 'Full extension at the top.', 'Engage core before you jump.'],
  plank:          ['Neutral spine — no hip drop or pike.', 'Squeeze glutes and quads.', 'Press the floor away with your hands.'],
  glute_bridge:   ['Full hip extension at the top.', 'Drive through your heels.', 'Pause and squeeze glutes hard.'],
  pullup:         ['Start from a dead hang.', 'Drive elbows down and back.', 'Chin fully over the bar counts.'],
};

const GENERIC_CUES = [
  'Control the movement — both directions count.',
  'Breathe out on the effort, in on the return.',
  'Mind-muscle connection: feel the target muscle working.',
  'Slow the eccentric (lowering) phase for more growth.',
  'Your form is building the foundation. Quality reps only.',
];

// ── Breathing Pacer ────────────────────────────────────────────
function BreathingPacer() {
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [count, setCount] = useState(4);

  useEffect(() => {
    const sequence: Array<{ phase: 'inhale' | 'hold' | 'exhale'; duration: number }> = [
      { phase: 'inhale', duration: 4 },
      { phase: 'hold',   duration: 2 },
      { phase: 'exhale', duration: 4 },
    ];
    let idx = 0, remaining = sequence[0].duration;
    const tick = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        idx = (idx + 1) % sequence.length;
        remaining = sequence[idx].duration;
      }
      setPhase(sequence[idx].phase);
      setCount(remaining);
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const phaseColor = phase === 'inhale' ? '#60a5fa' : phase === 'hold' ? '#a78bfa' : '#34d399';
  const label = phase === 'inhale' ? 'BREATHE IN' : phase === 'hold' ? 'HOLD' : 'BREATHE OUT';
  const scale = phase === 'inhale' ? 1.18 : phase === 'hold' ? 1.18 : 0.88;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
      <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
        <motion.div
          animate={{ scale }}
          transition={{ duration: phase === 'hold' ? 0.1 : phase === 'inhale' ? 3.8 : 3.8, ease: 'easeInOut' }}
          style={{
            width: 52, height: 52, borderRadius: '50%',
            border: `2.5px solid ${phaseColor}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 14px ${phaseColor}44`,
          }}
        >
          <Wind size={16} color={phaseColor} />
        </motion.div>
        <div style={{
          position: 'absolute', top: -6, right: -6,
          width: 18, height: 18, borderRadius: '50%',
          background: phaseColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 900, color: '#000',
        }}>{count}</div>
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 800, color: phaseColor, letterSpacing: '0.1em' }}>{label}</div>
        <div style={{ fontSize: 10, color: '#52525b', marginTop: 1 }}>4-2-4 breathing pattern</div>
      </div>
    </div>
  );
}

export default function AICoachStream({ exercise, currentState, formScore, corrections, repCount, isSessionActive, isDetected, isResting }: Props) {
  const { sessionGoal, formScoreHistory } = useSelector((s: RootState) => s.workout);
  const [message, setMessage]           = useState('');
  const [msgType, setMsgType]           = useState<'info' | 'warn' | 'success' | 'correction'>('info');
  const [msgKey, setMsgKey]             = useState(0);
  const [coachFreq, setCoachFreq]       = useState<'frequent' | 'normal' | 'relaxed'>('normal');
  const [formTrend, setFormTrend]       = useState<'up' | 'down' | 'stable'>('stable');

  const correctionHistoryRef = useRef<string[]>([]);
  const lastCoachTimeRef     = useRef(0);
  const formHistoryRef       = useRef<number[]>([]);
  const perfectStreakRef     = useRef(0);
  const lastRepCountRef      = useRef(0);

  const pushMessage = useCallback((text: string, type: typeof msgType) => {
    setMessage(text);
    setMsgType(type);
    setMsgKey(k => k + 1);
  }, []);

  // Detect rep changes for context-aware messaging
  useEffect(() => {
    if (!isSessionActive || repCount === lastRepCountRef.current) return;
    lastRepCountRef.current = repCount;

    // Track form history
    formHistoryRef.current = [...formHistoryRef.current.slice(-9), formScore];

    // Fatigue detection: last 3 consecutive drops of 5+ points
    const hist = formHistoryRef.current;
    if (hist.length >= 3) {
      const last3 = hist.slice(-3);
      const dropping = last3[0] > last3[1] + 5 && last3[1] > last3[2] + 5;
      if (dropping && formScore < 60) {
        pushMessage(FATIGUE_WARN[Math.floor(Math.random() * FATIGUE_WARN.length)], 'warn');
        return;
      }
    }

    // Perfect streak tracking
    if (formScore >= 85 && corrections.length === 0) {
      perfectStreakRef.current++;
      if (perfectStreakRef.current === 3 || perfectStreakRef.current === 6 || perfectStreakRef.current === 10) {
        pushMessage(PERFECT_STREAK[Math.floor(Math.random() * PERFECT_STREAK.length)], 'success');
        return;
      }
    } else {
      perfectStreakRef.current = 0;
    }

    // Warm-up cues
    if (repCount <= 3) {
      pushMessage(WARMUP_CUES[Math.min(repCount - 1, 2)], 'info');
      return;
    }

    // Mid-set push — use actual sessionGoal from Redux (not hardcoded 12)
    const goalReps = sessionGoal.repsPerSet || 12;
    if (repCount === Math.floor(goalReps / 2)) {
      pushMessage(MIDSET_PUSH[Math.floor(Math.random() * MIDSET_PUSH.length)], 'success');
      return;
    }
  }, [repCount, formScore, corrections, isSessionActive, pushMessage, sessionGoal.repsPerSet]);

  // Form trend detection
  useEffect(() => {
    if (formScoreHistory.length >= 3) {
      const recent = formScoreHistory.slice(-3);
      const delta = recent[recent.length - 1] - recent[0];
      if (delta > 5) setFormTrend('up');
      else if (delta < -5) setFormTrend('down');
      else setFormTrend('stable');
    }
  }, [formScoreHistory]);

  // Adaptive coaching interval
  useEffect(() => {
    if (!isSessionActive || isResting || !isDetected) return;

    const interval = formScore < 60 ? 4000 : formScore < 80 ? 8000 : 12000;
    setCoachFreq(formScore < 60 ? 'frequent' : formScore < 80 ? 'normal' : 'relaxed');

    const id = setInterval(() => {
      const now = Date.now();
      if (now - lastCoachTimeRef.current < interval * 0.9) return;
      lastCoachTimeRef.current = now;

      // Priority: corrections first
      if (corrections.length > 0) {
        const newCorrections = corrections.filter(c => !correctionHistoryRef.current.includes(c));
        if (newCorrections.length > 0) {
          pushMessage(newCorrections[0], 'correction');
          correctionHistoryRef.current = [...correctionHistoryRef.current.slice(-4), newCorrections[0]];
          return;
        }
        correctionHistoryRef.current = [];
        pushMessage(corrections[0], 'correction');
        return;
      }

      // Exercise cues
      const cues = (exercise && EXERCISE_CUES[exercise]) ? EXERCISE_CUES[exercise] : GENERIC_CUES;
      pushMessage(cues[Math.floor(Math.random() * cues.length)], 'info');
    }, Math.min(interval, 5000));

    return () => clearInterval(id);
  }, [isSessionActive, isDetected, isResting, formScore, corrections, exercise, pushMessage]);

  // Initial message
  useEffect(() => {
    if (isSessionActive && !message) {
      pushMessage('AI coach active. Get into position and start moving.', 'info');
    }
  }, [isSessionActive]); // eslint-disable-line

  const typeColor = {
    info:       '#a5b4fc',
    warn:       '#fbbf24',
    success:    '#4ade80',
    correction: '#f87171',
  }[msgType];

  const typeBg = {
    info:       'rgba(99,102,241,0.06)',
    warn:       'rgba(245,158,11,0.06)',
    success:    'rgba(34,197,94,0.06)',
    correction: 'rgba(239,68,68,0.06)',
  }[msgType];

  const typeBorder = {
    info:       'rgba(99,102,241,0.15)',
    warn:       'rgba(245,158,11,0.2)',
    success:    'rgba(34,197,94,0.2)',
    correction: 'rgba(239,68,68,0.25)',
  }[msgType];

  const TypeIcon = {
    info:       Brain,
    warn:       TrendingDown,
    success:    CheckCircle,
    correction: AlertCircle,
  }[msgType];

  // Resting state
  if (isResting) {
    return (
      <div style={{ borderRadius: 14, padding: '12px 14px', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
          <Wind size={13} color="#c4b5fd" />
          <span style={{ fontSize: 10, fontWeight: 800, color: '#c4b5fd', letterSpacing: '0.08em' }}>RECOVERY BREATHING</span>
        </div>
        <BreathingPacer />
      </div>
    );
  }

  if (!isSessionActive) {
    return (
      <div style={{ borderRadius: 14, padding: '12px 14px', background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Brain size={13} color="#818cf8" />
          <span style={{ fontSize: 11, color: '#6366f1', fontWeight: 700 }}>AI Coach ready — start a session to activate.</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 14, overflow: 'hidden' }}>
      {/* Frequency indicator strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
        background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <Brain size={11} color="#6366f1" />
        <span style={{ fontSize: 9, fontWeight: 800, color: '#52525b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          AI COACH
        </span>
        <div style={{ flex: 1 }} />
        <div style={{
          padding: '1px 7px', borderRadius: 20,
          background: coachFreq === 'frequent' ? 'rgba(239,68,68,0.12)' : coachFreq === 'normal' ? 'rgba(245,158,11,0.10)' : 'rgba(34,197,94,0.10)',
          fontSize: 8.5, fontWeight: 800, letterSpacing: '0.07em',
          color: coachFreq === 'frequent' ? '#f87171' : coachFreq === 'normal' ? '#fbbf24' : '#4ade80',
        }}>
          {coachFreq === 'frequent' ? '⚡ ACTIVE' : coachFreq === 'normal' ? '● NORMAL' : '◌ RELAXED'}
        </div>
      </div>

      {/* Message */}
      <div style={{ padding: '10px 12px', background: typeBg, border: `1px solid ${typeBorder}`, borderTop: 'none' }}>
        <AnimatePresence mode="wait">
          {message ? (
            <motion.div
              key={msgKey}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}
            >
              <div style={{
                width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                background: `${typeColor}22`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
              }}>
                <TypeIcon size={12} color={typeColor} />
              </div>
              <div>
                {msgType === 'correction' && (
                  <div style={{ fontSize: 8, fontWeight: 800, color: typeColor, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
                    FORM CORRECTION
                  </div>
                )}
                {msgType === 'warn' && (
                  <div style={{ fontSize: 8, fontWeight: 800, color: typeColor, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
                    FATIGUE ALERT
                  </div>
                )}
                {msgType === 'success' && (
                  <div style={{ fontSize: 8, fontWeight: 800, color: typeColor, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
                    PERFECT FORM STREAK
                  </div>
                )}
                <p className="coach-message-text" style={{ margin: 0, color: typeColor === '#f87171' ? '#fecaca' : typeColor === '#fbbf24' ? '#fde68a' : typeColor === '#4ade80' ? '#bbf7d0' : '#c7d2fe' }}>
                  {message}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="empty" className="shimmer-bg" style={{ height: 14, borderRadius: 6, width: '70%' }} />
          )}
        </AnimatePresence>
      </div>

      {/* Form trend + streak footer */}
      <div style={{ padding: '5px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {formTrend !== 'stable' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {formTrend === 'up'
              ? <TrendingUp size={10} color="#4ade80" />
              : <TrendingDown size={10} color="#f87171" />}
            <span style={{ fontSize: 9, fontWeight: 700, color: formTrend === 'up' ? '#4ade80' : '#f87171' }}>
              Form {formTrend === 'up' ? 'improving ↑' : 'dropping ↓'}
            </span>
          </div>
        ) : <div />}
        {perfectStreakRef.current >= 2 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Zap size={9} color="#4ade80" />
            <span style={{ fontSize: 9, fontWeight: 700, color: '#4ade80' }}>
              {perfectStreakRef.current}× perfect!
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
