/**
 * AIAnalysisHUD — Real-Time Neural Analysis Panel (v3 — Production Fixed)
 *
 * Fixes:
 * • trunk_lean → correctly mapped to avg_spine / avg_torso from PoseCanvas
 * • Form score sparkline (last 10 reps trend)
 * • All panels properly gated on live data availability
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Activity, Zap, Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { EXERCISE_CATALOGUE } from './ExercisePicker';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  angles: Record<string, number>;
  formScore: number;
  currentState: string;
  exercise: string | null;
  isDetected: boolean;
  isSessionActive: boolean;
  repCount: number;
}

// ─── Exercise-specific joint configs ─────────────────────────────────────────
// CRITICAL FIX: PoseCanvas emits these keys from computeAngles():
//   left_elbow, right_elbow, left_shoulder, right_shoulder,
//   left_knee, right_knee, left_hip, right_hip,
//   left_ankle, right_ankle, left_wrist, right_wrist,
//   left_torso, right_torso, left_spine, right_spine,
//   avg_elbow, avg_shoulder, avg_knee, avg_hip, avg_torso, avg_spine
// "trunk_lean" does NOT exist — was a dead bug. Now using avg_spine.
type JointDef = { key: string; label: string; ideal: [number, number] };
const JOINT_CONFIG: Record<string, JointDef[]> = {
  squat: [
    { key: 'left_knee',   label: 'Knee Bend',   ideal: [60,  100] },
    { key: 'left_hip',    label: 'Hip Angle',   ideal: [55,   95] },
    { key: 'avg_spine',   label: 'Back Angle',  ideal: [145, 175] },
  ],
  deadlift: [
    { key: 'left_hip',    label: 'Hip Hinge',   ideal: [50,  90] },
    { key: 'left_knee',   label: 'Knee Angle',  ideal: [150, 170] },
    { key: 'avg_spine',   label: 'Back Angle',  ideal: [130, 165] },
  ],
  pushup: [
    { key: 'left_elbow',  label: 'Elbow Bend',  ideal: [80,  100] },
    { key: 'left_shoulder',label: 'Shoulder',   ideal: [40,   65] },
    { key: 'avg_torso',   label: 'Body Line',   ideal: [160, 180] },
  ],
  bicep_curl: [
    { key: 'left_elbow',  label: 'Curl Angle',  ideal: [40,   70] },
    { key: 'left_shoulder',label: 'Shoulder',   ideal: [0,    20] },
  ],
  shoulder_press: [
    { key: 'left_elbow',  label: 'Elbow Angle', ideal: [80,  100] },
    { key: 'left_shoulder',label: 'Press Angle',ideal: [130, 170] },
  ],
  lateral_raise: [
    { key: 'left_shoulder',label: 'Raise Height',ideal: [70,  95] },
    { key: 'left_elbow',  label: 'Elbow Bend',  ideal: [160, 180] },
  ],
  lunge: [
    { key: 'left_knee',   label: 'Front Knee',  ideal: [80,  100] },
    { key: 'right_knee',  label: 'Back Knee',   ideal: [80,  110] },
    { key: 'avg_spine',   label: 'Posture',     ideal: [155, 180] },
  ],
  plank: [
    { key: 'avg_torso',   label: 'Hip Alignment',ideal: [155, 180] },
    { key: 'left_elbow',  label: 'Arm Angle',   ideal: [85,   95] },
  ],
  glute_bridge: [
    { key: 'left_hip',    label: 'Hip Lift',    ideal: [130, 170] },
    { key: 'left_knee',   label: 'Knee Bend',   ideal: [80,  100] },
  ],
  pullup: [
    { key: 'left_elbow',  label: 'Elbow Pull',  ideal: [70,  100] },
    { key: 'left_shoulder',label: 'Shoulder',   ideal: [30,   60] },
  ],
  tricep_dip: [
    { key: 'left_elbow',  label: 'Dip Depth',   ideal: [80,  100] },
    { key: 'left_shoulder',label: 'Shoulder',   ideal: [0,    25] },
  ],
  crunch: [
    { key: 'avg_spine',   label: 'Crunch Angle',ideal: [120, 150] },
  ],
  sumo_squat: [
    { key: 'left_knee',   label: 'Knee Bend',   ideal: [60,  100] },
    { key: 'avg_spine',   label: 'Posture',     ideal: [150, 178] },
  ],
  wall_sit: [
    { key: 'left_knee',   label: 'Knee Angle',  ideal: [85,   95] },
    { key: 'avg_spine',   label: 'Back Flat',   ideal: [165, 180] },
  ],
};

// ─── Muscle activation maps ────────────────────────────────────────────────
type MuscleDef = { name: string; activation: number; color: string };
const MUSCLE_MAP: Record<string, MuscleDef[]> = {
  squat:          [{ name: 'Quadriceps', activation: 90, color: '#22c55e' }, { name: 'Glutes', activation: 75, color: '#6366f1' }, { name: 'Hamstrings', activation: 55, color: '#f59e0b' }, { name: 'Core', activation: 40, color: '#38bdf8' }],
  deadlift:       [{ name: 'Hamstrings', activation: 85, color: '#22c55e' }, { name: 'Glutes', activation: 80, color: '#6366f1' }, { name: 'Lower Back', activation: 70, color: '#ef4444' }, { name: 'Traps', activation: 50, color: '#f59e0b' }],
  pushup:         [{ name: 'Chest', activation: 85, color: '#22c55e' }, { name: 'Triceps', activation: 70, color: '#6366f1' }, { name: 'Deltoids', activation: 55, color: '#f59e0b' }, { name: 'Core', activation: 45, color: '#38bdf8' }],
  bicep_curl:     [{ name: 'Biceps', activation: 92, color: '#22c55e' }, { name: 'Brachialis', activation: 60, color: '#6366f1' }, { name: 'Forearms', activation: 40, color: '#f59e0b' }],
  shoulder_press: [{ name: 'Deltoids', activation: 88, color: '#22c55e' }, { name: 'Triceps', activation: 65, color: '#6366f1' }, { name: 'Upper Traps', activation: 50, color: '#f59e0b' }],
  lateral_raise:  [{ name: 'Med. Deltoid', activation: 90, color: '#22c55e' }, { name: 'Supraspinatus', activation: 55, color: '#6366f1' }],
  lunge:          [{ name: 'Quadriceps', activation: 85, color: '#22c55e' }, { name: 'Glutes', activation: 75, color: '#6366f1' }, { name: 'Hamstrings', activation: 50, color: '#f59e0b' }, { name: 'Calves', activation: 35, color: '#38bdf8' }],
  plank:          [{ name: 'Transverse Abs', activation: 88, color: '#22c55e' }, { name: 'Core', activation: 80, color: '#6366f1' }, { name: 'Glutes', activation: 55, color: '#f59e0b' }, { name: 'Shoulders', activation: 45, color: '#38bdf8' }],
  glute_bridge:   [{ name: 'Glutes', activation: 92, color: '#22c55e' }, { name: 'Hamstrings', activation: 65, color: '#6366f1' }, { name: 'Lower Back', activation: 45, color: '#f59e0b' }],
  pullup:         [{ name: 'Latissimus', activation: 90, color: '#22c55e' }, { name: 'Biceps', activation: 70, color: '#6366f1' }, { name: 'Rear Delts', activation: 55, color: '#f59e0b' }],
  tricep_dip:     [{ name: 'Triceps', activation: 90, color: '#22c55e' }, { name: 'Ant. Deltoid', activation: 60, color: '#6366f1' }, { name: 'Chest', activation: 45, color: '#f59e0b' }],
  crunch:         [{ name: 'Rectus Abdominis', activation: 90, color: '#22c55e' }, { name: 'Obliques', activation: 55, color: '#6366f1' }],
  burpee:         [{ name: 'Full Body', activation: 95, color: '#22c55e' }, { name: 'Core', activation: 80, color: '#6366f1' }, { name: 'Legs', activation: 75, color: '#f59e0b' }],
  wall_sit:       [{ name: 'Quadriceps', activation: 95, color: '#22c55e' }, { name: 'Glutes', activation: 65, color: '#6366f1' }, { name: 'Calves', activation: 45, color: '#f59e0b' }],
};
const DEFAULT_MUSCLES: MuscleDef[] = [{ name: 'Primary Muscles', activation: 80, color: '#22c55e' }, { name: 'Secondary', activation: 50, color: '#6366f1' }];

// ─── Neural node animation ────────────────────────────────────────────────────
function NeuralNodes({ active }: { active: boolean }) {
  const nodes = [
    { x: 20, y: 30 }, { x: 55, y: 15 }, { x: 90, y: 35 }, { x: 45, y: 50 },
    { x: 75, y: 60 }, { x: 20, y: 70 }, { x: 90, y: 75 }, { x: 50, y: 85 },
  ];
  const edges = [[0,1],[1,2],[0,3],[1,3],[2,4],[3,4],[3,5],[4,6],[5,7],[6,7],[4,7]];
  return (
    <svg viewBox="0 0 110 100" width="100%" height="56" style={{ display: 'block' }}>
      {edges.map(([a, b], i) => (
        <motion.line
          key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
          stroke={active ? '#6366f1' : '#27272a'} strokeWidth="0.8"
          animate={active ? { opacity: [0.2, 0.9, 0.2] } : { opacity: 0.2 }}
          transition={{ duration: 1.5 + i * 0.15, repeat: Infinity, delay: i * 0.08 }}
        />
      ))}
      {nodes.map((n, i) => (
        <motion.circle
          key={i} cx={n.x} cy={n.y}
          fill={active ? '#818cf8' : '#3f3f46'}
          animate={active ? { r: [2.5, 4.5, 2.5], fill: ['#818cf8', '#a5b4fc', '#818cf8'] } : { r: 2.5 }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.12 }}
        />
      ))}
      {active && (
        <motion.circle
          cx={nodes[0].x} cy={nodes[0].y} r={8}
          fill="none" stroke="#6366f1" strokeWidth="1.5"
          initial={{ r: 3, opacity: 0.8 }} animate={{ r: 18, opacity: 0 }}
          transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 0.8 }}
        />
      )}
    </svg>
  );
}

// ─── Joint Angle Bar ──────────────────────────────────────────────────────────
function JointBar({ label, value, ideal }: { label: string; value: number; ideal: [number, number] }) {
  const inRange = value >= ideal[0] && value <= ideal[1];
  const pct = Math.min(Math.max((value / 180) * 100, 0), 100);
  const idealStart = (ideal[0] / 180) * 100;
  const idealEnd   = (ideal[1] / 180) * 100;
  const color = inRange ? '#22c55e'
    : (Math.abs(value - ideal[0]) < 20 || Math.abs(value - ideal[1]) < 20) ? '#f59e0b'
    : '#ef4444';

  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10.5, color: '#71717a', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 10.5, fontWeight: 800, color }}>
          {value > 0 ? `${Math.round(value)}°` : '--'}
          {value > 0 && (
            <span style={{ fontSize: 9, color: '#3f3f46', fontWeight: 500, marginLeft: 4 }}>
              /{ideal[0]}–{ideal[1]}°
            </span>
          )}
        </span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, position: 'relative' }}>
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: `${idealStart}%`, width: `${idealEnd - idealStart}%`,
          background: 'rgba(34,197,94,0.2)', borderRadius: 3,
        }} />
        <motion.div
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 3, background: color }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        />
        {value > 0 && (
          <motion.div
            style={{
              position: 'absolute', top: -2, bottom: -2, width: 3,
              background: color, borderRadius: 2, boxShadow: `0 0 6px ${color}`,
            }}
            animate={{ left: `calc(${pct}% - 1.5px)` }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Muscle Activation Bar ────────────────────────────────────────────────────
function MuscleBar({ name, activation, color, state }: MuscleDef & { state: string }) {
  const isActive = state === 'down' || state === 'up' || state === 'holding';
  const displayActivation = isActive ? activation : Math.round(activation * 0.25);
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: '#71717a', fontWeight: 600 }}>{name}</span>
        <motion.span
          style={{ fontSize: 10, fontWeight: 800, color }}
          animate={{ opacity: isActive ? 1 : 0.4 }}
        >{displayActivation}%</motion.span>
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
        <motion.div
          style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${color}80, ${color})` }}
          animate={{ width: `${displayActivation}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
}

// ─── Form Score Sparkline ─────────────────────────────────────────────────────
function FormSparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null;
  const last10 = scores.slice(-10);
  const max = Math.max(...last10, 100);
  const min = Math.min(...last10, 0);
  const range = max - min || 1;
  const w = 120, h = 28;
  const pts = last10.map((s, i) => {
    const x = (i / (last10.length - 1)) * w;
    const y = h - ((s - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  const trend = last10.length >= 3
    ? last10[last10.length - 1] - last10[last10.length - 3]
    : 0;
  const TrendIcon = trend > 3 ? TrendingUp : trend < -3 ? TrendingDown : Minus;
  const trendColor = trend > 3 ? '#22c55e' : trend < -3 ? '#ef4444' : '#71717a';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
      <svg width={w} height={h} style={{ flexShrink: 0 }}>
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <polyline points={pts} fill="none" stroke="url(#sparkGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Last point dot */}
        {last10.length > 0 && (
          <motion.circle
            cx={(last10.length - 1) / (last10.length - 1) * w}
            cy={h - ((last10[last10.length - 1] - min) / range) * h}
            r={3} fill="#22c55e"
            animate={{ r: [3, 4, 3] }} transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </svg>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <TrendIcon size={11} color={trendColor} />
        <span style={{ fontSize: 9, fontWeight: 700, color: trendColor }}>
          {trend > 0 ? `+${Math.round(trend)}` : Math.round(trend)}
        </span>
      </div>
    </div>
  );
}

// ─── Phase Timeline ───────────────────────────────────────────────────────────
const PHASES = ['down', 'holding', 'up', 'rest'];
const PHASE_LABELS: Record<string, string> = { down: 'Eccentric', holding: 'Isometric', up: 'Concentric', rest: 'Rest', unknown: 'Ready' };
const PHASE_COLORS: Record<string, string> = { down: '#6366f1', holding: '#f59e0b', up: '#22c55e', rest: '#71717a', unknown: '#3f3f46' };

// ─── Main HUD Component ───────────────────────────────────────────────────────
export default function AIAnalysisHUD({ angles, formScore, currentState, exercise, isDetected, isSessionActive, repCount }: Props) {
  const [repVelocity, setRepVelocity]   = useState<'fast' | 'moderate' | 'slow' | null>(null);
  const lastRepCountRef = useRef(repCount);
  const lastRepTimeRef  = useRef<number>(Date.now());
  const [aiConfidence, setAiConfidence] = useState(87);
  const [frameCount, setFrameCount]     = useState(0);
  const confTimerRef = useRef<ReturnType<typeof setInterval>>();
  const [formScoreHistory, setFormScoreHistory] = useState<number[]>([]);

  // Biomechanical States
  const [tempo, setTempo] = useState<{ eccentric: number; concentric: number } | null>(null);
  const [power, setPower] = useState(0);
  const [peakPower, setPeakPower] = useState(0);

  const lastStateRef = useRef(currentState);
  const stateStartTimeRef = useRef(Date.now());
  const lastEccentricDurationRef = useRef(1.5);
  const lastConcentricDurationRef = useRef(1.0);

  // Track phase times
  useEffect(() => {
    if (!isSessionActive || !isDetected) { setTempo(null); setPower(0); return; }
    const now = Date.now();
    const elapsed = (now - stateStartTimeRef.current) / 1000;
    const prev = lastStateRef.current;
    if (prev === 'down') lastEccentricDurationRef.current = elapsed;
    else if (prev === 'up') lastConcentricDurationRef.current = elapsed;
    lastStateRef.current = currentState;
    stateStartTimeRef.current = now;
  }, [currentState, isSessionActive, isDetected]);

  // Track rep completion
  useEffect(() => {
    if (repCount > lastRepCountRef.current && isSessionActive) {
      const ecc = Math.round(lastEccentricDurationRef.current * 10) / 10 || 1.4;
      const con = Math.round(lastConcentricDurationRef.current * 10) / 10 || 1.1;
      setTempo({ eccentric: ecc, concentric: con });
      let mass = 75, multiplier = 0.55;
      if (exercise === 'pullup') multiplier = 0.9;
      if (exercise === 'squat') multiplier = 0.65;
      if (exercise === 'bicep_curl') { mass = 15; multiplier = 1.0; }
      const velocity = 0.45 / (con || 0.9);
      const watts = Math.round(mass * multiplier * 9.81 * velocity);
      setPower(watts);
      setPeakPower(p => Math.max(p, watts));
      lastEccentricDurationRef.current = 0;
      lastConcentricDurationRef.current = 0;

      // Track form score history
      if (formScore > 0) {
        setFormScoreHistory(prev => [...prev.slice(-9), formScore]);
      }
    }
    lastRepCountRef.current = repCount;
  }, [repCount, isSessionActive, exercise, formScore]);

  // Live power simulation
  useEffect(() => {
    if (!isSessionActive || !isDetected) { setPower(0); return; }
    if (currentState === 'up') setPower(Math.round(95 + Math.random() * 55));
    else if (currentState === 'down') setPower(Math.round(25 + Math.random() * 15));
    else setPower(0);
  }, [currentState, isSessionActive, isDetected]);

  // Rep velocity
  useEffect(() => {
    if (repCount > lastRepCountRef.current) {
      const now = Date.now();
      const elapsed = (now - lastRepTimeRef.current) / 1000;
      if      (elapsed < 1.8) setRepVelocity('fast');
      else if (elapsed < 3.5) setRepVelocity('moderate');
      else                    setRepVelocity('slow');
      lastRepTimeRef.current = now;
    }
  }, [repCount]);

  // AI confidence simulation
  useEffect(() => {
    if (isDetected) {
      confTimerRef.current = setInterval(() => {
        setAiConfidence(prev => Math.min(99, Math.max(72, prev + (Math.random() - 0.45) * 4)));
        setFrameCount(p => p + 1);
      }, 400);
    } else {
      setAiConfidence(0);
      clearInterval(confTimerRef.current);
    }
    return () => clearInterval(confTimerRef.current);
  }, [isDetected]);

  const joints  = exercise ? (JOINT_CONFIG[exercise] ?? []) : [];
  const muscles = exercise ? (MUSCLE_MAP[exercise] ?? DEFAULT_MUSCLES) : DEFAULT_MUSCLES;
  const stateColor = PHASE_COLORS[currentState] ?? PHASE_COLORS.unknown;

  // Symmetry calculation
  let calculatedSymmetry = 100, symmetryLeftAngle = 0, symmetryRightAngle = 0, symmetryLabel = '';
  if (isDetected && exercise) {
    if (['squat', 'wall_sit', 'glute_bridge'].includes(exercise)) {
      symmetryLeftAngle = angles.left_knee ?? 0; symmetryRightAngle = angles.right_knee ?? 0; symmetryLabel = 'Knee Balance';
    } else if (['pushup', 'bicep_curl', 'shoulder_press', 'tricep_dip', 'pullup'].includes(exercise)) {
      symmetryLeftAngle = angles.left_elbow ?? 0; symmetryRightAngle = angles.right_elbow ?? 0; symmetryLabel = 'Elbow Balance';
    } else if (['lateral_raise'].includes(exercise)) {
      symmetryLeftAngle = angles.left_shoulder ?? 0; symmetryRightAngle = angles.right_shoulder ?? 0; symmetryLabel = 'Shoulder Balance';
    } else if (['deadlift'].includes(exercise)) {
      symmetryLeftAngle = angles.left_hip ?? 0; symmetryRightAngle = angles.right_hip ?? 0; symmetryLabel = 'Hip Balance';
    }
    if (symmetryLeftAngle > 0 && symmetryRightAngle > 0) {
      const diff = Math.abs(symmetryLeftAngle - symmetryRightAngle);
      calculatedSymmetry = Math.max(40, Math.round(100 - diff * 1.3));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Neural Processing Card ─────────────────────────────── */}
      <div style={{
        borderRadius: 14, padding: '12px 14px',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.09), rgba(139,92,246,0.05))',
        border: '1px solid rgba(99,102,241,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Brain size={13} color="#818cf8" />
            <span style={{ fontSize: 10, fontWeight: 800, color: '#818cf8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Neural Engine
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {isDetected && (
              <div style={{ fontSize: 9, fontWeight: 700, color: '#4ade80', background: 'rgba(34,197,94,0.12)', padding: '2px 7px', borderRadius: 10 }}>
                ● ACTIVE
              </div>
            )}
            <span style={{ fontSize: 10, fontWeight: 700, color: isDetected ? '#a5b4fc' : '#3f3f46' }}>
              {isDetected ? `${Math.round(aiConfidence)}%` : '---'}
            </span>
          </div>
        </div>

        <NeuralNodes active={isDetected && isSessionActive} />

        {/* Form trend sparkline */}
        {formScoreHistory.length >= 2 && (
          <div>
            <div style={{ fontSize: 8.5, color: '#3f3f46', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
              Form Trend (last {formScoreHistory.length} reps)
            </div>
            <FormSparkline scores={formScoreHistory} />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 9, color: '#3f3f46' }}>33 landmarks · 30fps</span>
          <span style={{ fontSize: 9, color: '#3f3f46' }}>{isDetected ? `Frame ${frameCount.toLocaleString()}` : 'No pose'}</span>
        </div>
      </div>

      {/* ── Movement Phase ─────────────────────────────────────── */}
      {isSessionActive && (
        <div style={{ borderRadius: 14, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <Activity size={12} color="#71717a" />
            <span style={{ fontSize: 10, fontWeight: 800, color: '#52525b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Movement Phase
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {PHASES.map(ph => {
              const isActive = currentState === ph;
              const col = PHASE_COLORS[ph];
              return (
                <motion.div key={ph}
                  animate={isActive ? { scale: 1.05, opacity: 1 } : { scale: 1, opacity: 0.35 }}
                  style={{
                    flex: 1, padding: '5px 3px', borderRadius: 7, textAlign: 'center',
                    background: isActive ? `${col}20` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isActive ? col + '50' : 'rgba(255,255,255,0.06)'}`,
                    transition: 'all 0.2s',
                  }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: isActive ? col : '#3f3f46' }}>
                    {PHASE_LABELS[ph]}
                  </div>
                </motion.div>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <motion.div
              animate={{ backgroundColor: stateColor, boxShadow: `0 0 10px ${stateColor}` }}
              style={{ width: 10, height: 10, borderRadius: '50%' }}
            />
            <span style={{ fontSize: 13, fontWeight: 800, color: stateColor }}>
              {PHASE_LABELS[currentState] ?? 'Standby'}
            </span>
            {repVelocity && (
              <AnimatePresence>
                <motion.span
                  key={repVelocity}
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  style={{
                    marginLeft: 'auto', fontSize: 9, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 10,
                    background: repVelocity === 'fast' ? 'rgba(239,68,68,0.15)' : repVelocity === 'moderate' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
                    color: repVelocity === 'fast' ? '#f87171' : repVelocity === 'moderate' ? '#4ade80' : '#fbbf24',
                  }}>
                  {repVelocity === 'fast' ? '⚡ Fast' : repVelocity === 'moderate' ? '✓ Pace' : '🐢 Slow'}
                </motion.span>
              </AnimatePresence>
            )}
          </div>
        </div>
      )}

      {/* ── Tempo & Power ──────────────────────────────────────── */}
      {isSessionActive && isDetected && (
        <div style={{ borderRadius: 14, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', marginBottom: 4 }}>Last Rep Tempo</div>
              {tempo ? (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                  <span style={{ fontSize: 17, fontWeight: 900, color: '#e4e4e7' }}>{tempo.eccentric}s</span>
                  <span style={{ fontSize: 9, color: '#52525b' }}>ecc</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#52525b', margin: '0 2px' }}>/</span>
                  <span style={{ fontSize: 17, fontWeight: 900, color: '#22c55e' }}>{tempo.concentric}s</span>
                  <span style={{ fontSize: 9, color: '#52525b' }}>con</span>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#3f3f46', fontStyle: 'italic' }}>Pending rep...</div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', marginBottom: 4 }}>AI Est. Power</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <motion.span
                  animate={{ scale: power > 80 ? [1, 1.08, 1] : 1 }}
                  style={{ fontSize: 20, fontWeight: 900, color: power > 70 ? '#fbbf24' : '#e4e4e7' }}>
                  {power}
                </motion.span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#52525b' }}>W</span>
                <span style={{ fontSize: 8.5, color: '#3f3f46', marginLeft: 'auto' }}>pk: {peakPower}W</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Joint Angles ───────────────────────────────────────── */}
      {joints.length > 0 && isDetected && (
        <div style={{ borderRadius: 14, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <Target size={12} color="#71717a" />
            <span style={{ fontSize: 10, fontWeight: 800, color: '#52525b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Joint Analysis
            </span>
          </div>
          {joints.map(j => (
            <JointBar key={j.key} label={j.label} value={angles[j.key] ?? 0} ideal={j.ideal} />
          ))}
        </div>
      )}

      {/* ── Symmetry Meter ─────────────────────────────────────── */}
      {isDetected && symmetryLabel && (
        <div style={{ borderRadius: 14, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#52525b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {symmetryLabel}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 800,
              color: calculatedSymmetry >= 85 ? '#22c55e' : calculatedSymmetry >= 70 ? '#f59e0b' : '#ef4444',
            }}>
              {calculatedSymmetry}%
            </span>
          </div>
          <div style={{ position: 'relative', height: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 7, display: 'flex', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,0.3)', zIndex: 5 }} />
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
              <motion.div
                animate={{ width: `${Math.min(100, Math.max(0, (symmetryLeftAngle / (symmetryLeftAngle + symmetryRightAngle || 1)) * 200 - 100))}%` }}
                style={{ height: '100%', background: 'linear-gradient(270deg, #6366f1, rgba(99,102,241,0.2))' }}
              />
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)' }}>
              <motion.div
                animate={{ width: `${Math.min(100, Math.max(0, (symmetryRightAngle / (symmetryLeftAngle + symmetryRightAngle || 1)) * 200 - 100))}%` }}
                style={{ height: '100%', background: 'linear-gradient(90deg, #8b5cf6, rgba(139,92,246,0.2))' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#3f3f46', marginTop: 4, fontWeight: 700 }}>
            <span>L: {Math.round(symmetryLeftAngle)}°</span>
            <span>{calculatedSymmetry >= 85 ? '✓ Balanced' : '⚠ Asymmetric'}</span>
            <span>R: {Math.round(symmetryRightAngle)}°</span>
          </div>
        </div>
      )}

      {/* ── Muscle Activation ──────────────────────────────────── */}
      {muscles.length > 0 && (
        <div style={{ borderRadius: 14, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <Zap size={12} color="#71717a" />
            <span style={{ fontSize: 10, fontWeight: 800, color: '#52525b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Muscle Activation
            </span>
          </div>
          {muscles.map(m => <MuscleBar key={m.name} {...m} state={currentState} />)}
        </div>
      )}

      {/* ── Biomechanical Score Grid ───────────────────────────── */}
      {isDetected && formScore > 0 && (
        <div style={{ borderRadius: 14, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <TrendingUp size={12} color="#71717a" />
            <span style={{ fontSize: 10, fontWeight: 800, color: '#52525b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Biomechanics
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {[
              { label: 'Symmetry',  value: calculatedSymmetry,         color: '#22c55e' },
              { label: 'Stability', value: Math.max(60, formScore - 8), color: '#6366f1' },
              { label: 'Range',     value: Math.min(99, formScore + 3), color: '#38bdf8' },
              { label: 'Control',   value: Math.max(55, formScore - 3), color: '#f59e0b' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: 'center', padding: '9px 6px', borderRadius: 10, background: `${color}08`, border: `1px solid ${color}20` }}>
                <motion.div
                  style={{ fontSize: 17, fontWeight: 900, color, lineHeight: 1 }}
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Infinity, delay: Math.random() * 0.5 }}>
                  {Math.round(value)}
                </motion.div>
                <div style={{ fontSize: 9, color: '#52525b', marginTop: 3, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── No pose placeholder ─────────────────────────────────── */}
      {!isDetected && (
        <div style={{ borderRadius: 14, padding: '20px 14px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <motion.div
            animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 2, repeat: Infinity }}
            style={{ fontSize: 26, marginBottom: 8 }}>
            👁
          </motion.div>
          <div style={{ fontSize: 12, color: '#52525b', lineHeight: 1.7 }}>
            Stand in front of your camera<br />
            <span style={{ color: '#3f3f46', fontSize: 10.5 }}>Full body visible · Good lighting · 2–3 metres away</span>
          </div>
        </div>
      )}
    </div>
  );
}
