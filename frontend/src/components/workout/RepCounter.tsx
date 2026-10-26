/**
 * RepCounter — Elite Rep Display
 *
 * Features:
 * • Large animated rep number with count-up flash
 * • Phase direction arrow (↓/↑) with pulse animation
 * • Rep PACE ring (green=ideal 1.5–4s/rep, red=too fast/slow)
 * • Tempo timer (shows seconds for current rep)
 * • Milestone burst at 5, 10, 15, 20, 25, 30 reps
 * • Personal Best crown badge with golden glow
 * • Set number pill: "Set 2 / 4"
 * • 3-ring SVG progress: sets / reps-in-set / form
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EXERCISE_CATALOGUE } from './ExercisePicker';
import { Award, Target, Zap } from 'lucide-react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

// Phase coaching cues
const PHASE_CUES: Record<string, { down: string; up: string; holding: string; rest: string }> = {
  squat:           { down: '↓ SQUAT',    up: '↑ DRIVE',      holding: '● HOLD', rest: '◌ RESET' },
  deadlift:        { down: '↓ HINGE',    up: '↑ DRIVE HIPS', holding: '● HOLD', rest: '◌ RESET' },
  pushup:          { down: '↓ LOWER',    up: '↑ PUSH',       holding: '● HOLD', rest: '◌ RESET' },
  bicep_curl:      { down: '↓ EXTEND',   up: '↑ CURL',       holding: '● HOLD', rest: '◌ RESET' },
  shoulder_press:  { down: '↓ LOWER',    up: '↑ PRESS',      holding: '● HOLD', rest: '◌ RESET' },
  lateral_raise:   { down: '↓ LOWER',    up: '↑ RAISE',      holding: '● HOLD', rest: '◌ RESET' },
  lunge:           { down: '↓ LUNGE',    up: '↑ STAND',      holding: '● HOLD', rest: '◌ RESET' },
  plank:           { down: '◌ REST',     up: '◌ GET SET',    holding: '● HOLD STEADY', rest: '◌ REST' },
  pullup:          { down: '↓ HANG',     up: '↑ CHIN UP',    holding: '● HOLD', rest: '◌ RESET' },
  tricep_dip:      { down: '↓ LOWER',    up: '↑ PRESS',      holding: '● HOLD', rest: '◌ RESET' },
  glute_bridge:    { down: '↓ LOWER',    up: '↑ THRUST',     holding: '● HOLD', rest: '◌ RESET' },
  crunch:          { down: '↓ LOWER',    up: '↑ CRUNCH',     holding: '● HOLD', rest: '◌ RESET' },
  sumo_squat:      { down: '↓ SQUAT',    up: '↑ DRIVE',      holding: '● HOLD', rest: '◌ RESET' },
};
const DEFAULT_CUES = { down: '↓ DOWN', up: '↑ UP', holding: '● HOLD', rest: '◌ REST' };
const MILESTONES = [5, 10, 15, 20, 25, 30, 40, 50];

// Ideal rep tempo range: 1.5s – 4s per rep
const IDEAL_TEMPO_MIN = 1.5;
const IDEAL_TEMPO_MAX = 4.0;

interface Props {
  count: number;
  exercise: string | null;
  state: string;
  currentSet: number;
  setsCompleted: number;
  formScore: number;
}

// SVG Ring helper
function Ring({ radius, progress, color, strokeWidth = 5, glow = false }: {
  radius: number; progress: number; color: string; strokeWidth?: number; glow?: boolean;
}) {
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - Math.min(1, Math.max(0, progress)));
  return (
    <motion.circle
      cx={72} cy={72} r={radius}
      fill="none" stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeDasharray={circ}
      animate={{ strokeDashoffset: offset }}
      transition={{ type: 'spring', stiffness: 90, damping: 20 }}
      style={{
        transform: 'rotate(-90deg)',
        transformOrigin: '72px 72px',
        filter: glow ? `drop-shadow(0 0 6px ${color})` : undefined,
      }}
    />
  );
}

export default function RepCounter({ count, exercise, state, currentSet, setsCompleted, formScore }: Props) {
  const prevCount    = useRef(count);
  const prevExercise = useRef(exercise);
  const repStartTime = useRef<number>(Date.now());
  const { sessionGoal, personalBests } = useSelector((s: RootState) => s.workout);

  const [showFlash, setShowFlash]           = useState(false);
  const [showMilestone, setShowMilestone]   = useState(false);
  const [milestoneNum, setMilestoneNum]     = useState(0);
  const [repTempo, setRepTempo]             = useState(0);    // seconds per rep
  const [currentRepTimer, setCurrentRepTimer] = useState(0); // live elapsed seconds for current rep
  const [paceStatus, setPaceStatus]         = useState<'ideal' | 'fast' | 'slow' | 'none'>('none');

  // Live timer for current rep
  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = (Date.now() - repStartTime.current) / 1000;
      setCurrentRepTimer(parseFloat(elapsed.toFixed(1)));
    }, 100);
    return () => clearInterval(id);
  }, []);

  // Rep flash + tempo calc
  useEffect(() => {
    if (count > prevCount.current && exercise === prevExercise.current) {
      const now = Date.now();
      const tempo = (now - repStartTime.current) / 1000;
      setRepTempo(parseFloat(tempo.toFixed(1)));

      if (tempo < IDEAL_TEMPO_MIN) setPaceStatus('fast');
      else if (tempo > IDEAL_TEMPO_MAX) setPaceStatus('slow');
      else setPaceStatus('ideal');

      repStartTime.current = now;
      setCurrentRepTimer(0);

      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 450);

      if (MILESTONES.includes(count)) {
        setMilestoneNum(count);
        setShowMilestone(true);
        setTimeout(() => setShowMilestone(false), 900);
      }
    }
    if (exercise !== prevExercise.current) {
      repStartTime.current = Date.now();
      setCurrentRepTimer(0);
      setPaceStatus('none');
      prevExercise.current = exercise;
    }
    prevCount.current = count;
  }, [count, exercise]);

  // Get cues
  const cues = (exercise && PHASE_CUES[exercise]) ? PHASE_CUES[exercise] : DEFAULT_CUES;
  const phaseCue =
    state === 'down'    ? cues.down :
    state === 'up'      ? cues.up   :
    state === 'holding' ? cues.holding : cues.rest;

  const phaseColor =
    state === 'down'    ? '#60a5fa' :
    state === 'up'      ? '#22c55e' :
    state === 'holding' ? '#f59e0b' : '#52525b';

  // Personal best detection
  const pb = exercise ? personalBests[exercise] : null;
  const isPB = pb && count > 0 && count >= pb.reps;

  // Ring progress values
  const repsTarget  = sessionGoal.repsPerSet || 12;
  const setsTarget  = sessionGoal.sets || 3;
  const repProgress  = Math.min(1, count / repsTarget);
  const setProgress  = Math.min(1, setsCompleted / setsTarget);
  const formProgress = formScore / 100;

  const formColor = formScore >= 80 ? '#22c55e' : formScore >= 55 ? '#f59e0b' : '#ef4444';

  // Pace ring color
  const paceColor = paceStatus === 'ideal' ? '#22c55e' : paceStatus === 'fast' ? '#ef4444' : paceStatus === 'slow' ? '#f59e0b' : '#27272a';
  const paceProgress = paceStatus === 'ideal' ? 1 :
    paceStatus === 'fast' ? Math.min(1, IDEAL_TEMPO_MIN / currentRepTimer) :
    paceStatus === 'slow' ? Math.min(1, IDEAL_TEMPO_MAX / currentRepTimer) : 0.5;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative' }}>

      {/* 3-ring SVG */}
      <div style={{ position: 'relative', width: 144, height: 144, flexShrink: 0 }}>
        <svg width={144} height={144} viewBox="0 0 144 144">
          {/* Background tracks */}
          {[60, 48, 36].map((r, i) => (
            <circle key={i} cx={72} cy={72} r={r}
              fill="none" stroke="rgba(255,255,255,0.06)"
              strokeWidth={i === 0 ? 6 : i === 1 ? 5 : 4}
            />
          ))}
          {/* Set progress ring (outer) */}
          <Ring radius={60} progress={setProgress}  color="#a78bfa" strokeWidth={6} />
          {/* Rep progress ring (middle) */}
          <Ring radius={48} progress={repProgress}  color="#6366f1" strokeWidth={5} glow />
          {/* Form ring (inner) */}
          <Ring radius={36} progress={formProgress} color={formColor} strokeWidth={4} glow />
        </svg>

        {/* Center: Big rep number */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 0,
        }}>
          <motion.div
            key={count}
            animate={showFlash ? { scale: [1, 1.4, 1], color: ['#f4f4f5', '#4ade80', '#f4f4f5'] } : {}}
            transition={{ duration: 0.42 }}
            style={{
              fontSize: 36, fontWeight: 900, color: '#f4f4f5',
              fontVariantNumeric: 'tabular-nums', lineHeight: 1,
            }}
          >
            {count}
          </motion.div>
          <div style={{ fontSize: 9, color: '#52525b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            REPS
          </div>
        </div>

        {/* Milestone ripple */}
        <AnimatePresence>
          {showMilestone && (
            <motion.div
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 2.6, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
              style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '2px solid #22c55e', pointerEvents: 'none',
              }}
            />
          )}
        </AnimatePresence>

        {/* PB crown */}
        <AnimatePresence>
          {isPB && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="pr-badge"
              style={{
                position: 'absolute', top: -6, right: -6,
                width: 26, height: 26, borderRadius: '50%',
                background: 'linear-gradient(135deg,#f59e0b,#fbbf24)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid rgba(251,191,36,0.6)',
              }}
            >
              <Award size={13} color="#78350f" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Set pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '3px 10px', borderRadius: 20,
        background: 'rgba(163,130,250,0.1)', border: '1px solid rgba(167,139,250,0.2)',
      }}>
        <Target size={10} color="#a78bfa" />
        <span style={{ fontSize: 10, fontWeight: 800, color: '#a78bfa' }}>
          Set {currentSet} / {setsTarget}
        </span>
        {setsCompleted > 0 && (
          <span style={{ fontSize: 9, color: '#6d5bbf' }}>• {setsCompleted} done</span>
        )}
      </div>

      {/* Phase cue */}
      <motion.div
        key={state}
        initial={{ opacity: 0, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          fontSize: 10.5, fontWeight: 800, color: phaseColor,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}
      >
        {phaseCue}
      </motion.div>

      {/* Tempo / pace badge */}
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        {repTempo > 0 && (
          <span className={`tempo-badge ${paceStatus === 'ideal' ? 'tempo-ideal' : paceStatus === 'fast' ? 'tempo-fast' : 'tempo-slow'}`}>
            <Zap size={9} />
            {repTempo}s / rep
          </span>
        )}
        {currentRepTimer > 0.3 && (
          <span style={{
            fontSize: 9.5, fontWeight: 700, color: '#52525b',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {currentRepTimer.toFixed(1)}s
          </span>
        )}
      </div>

      {/* Milestone label */}
      <AnimatePresence>
        {showMilestone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -8 }}
            style={{
              position: 'absolute', top: -28,
              padding: '3px 12px', borderRadius: 20,
              background: 'linear-gradient(135deg,rgba(34,197,94,0.3),rgba(99,102,241,0.3))',
              border: '1px solid rgba(34,197,94,0.5)',
              fontSize: 11, fontWeight: 800, color: '#4ade80',
              whiteSpace: 'nowrap',
            }}
          >
            🎉 {milestoneNum} REPS!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
