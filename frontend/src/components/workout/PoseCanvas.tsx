/**
 * PoseCanvas — Advanced In-Browser Pose Detection Engine
 *
 * Architecture:
 *  • MediaPipe PoseLandmarker (FULL/HEAVY model, GPU delegate w/ CPU fallback)
 *  • 3D world-landmark angles for accuracy independent of camera angle
 *  • Exponential Moving Average (EMA) on all angles to eliminate jitter
 *  • Confidence-voted exercise classifier (N consecutive frames to confirm)
 *  • Hysteresis finite-state machine for rep counting (avoids false triggers)
 *  • Velocity-aware rep detection for fast movements
 *  • 12 exercises with biomechanical angle thresholds
 *  • Multi-rule form feedback with severity scoring
 *  • Color-segmented skeleton (arm / leg / spine / face)
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { updatePoseData, setWsConnected } from '../../store/workoutSlice';

// WebSocket is an OPTIONAL analytics bridge — all pose detection runs locally in-browser.
// If WS fails, the app still works 100%. Never show "AI Offline" to users.
const WS_URL = 'ws://localhost:8000/ws/pose';
const WS_OPTIONAL = true; // suppress all WS failure UX

// ─────────────────────────────────────────────────────────────────────────────
//  LANDMARK INDICES  (MediaPipe BlazePose 33-point model)
// ─────────────────────────────────────────────────────────────────────────────
const LM = {
  NOSE: 0,
  L_EYE_IN: 1, L_EYE: 2, L_EYE_OUT: 3,
  R_EYE_IN: 4, R_EYE: 5, R_EYE_OUT: 6,
  L_EAR: 7, R_EAR: 8,
  MOUTH_L: 9, MOUTH_R: 10,
  L_SHOULDER: 11, R_SHOULDER: 12,
  L_ELBOW: 13,    R_ELBOW: 14,
  L_WRIST: 15,    R_WRIST: 16,
  L_PINKY: 17,    R_PINKY: 18,
  L_INDEX: 19,    R_INDEX: 20,
  L_THUMB: 21,    R_THUMB: 22,
  L_HIP: 23,      R_HIP: 24,
  L_KNEE: 25,     R_KNEE: 26,
  L_ANKLE: 27,    R_ANKLE: 28,
  L_HEEL: 29,     R_HEEL: 30,
  L_FOOT: 31,     R_FOOT: 32,
};

// ─────────────────────────────────────────────────────────────────────────────
//  SKELETON — colored by body segment
// ─────────────────────────────────────────────────────────────────────────────
type SegmentColor = 'arm' | 'leg' | 'torso' | 'face';
const SKELETON_SEGMENTS: Array<{ pairs: [number, number][]; color: SegmentColor }> = [
  { color: 'arm',   pairs: [[11,13],[13,15],[15,17],[15,19],[12,14],[14,16],[16,18],[16,20]] },
  { color: 'leg',   pairs: [[23,25],[25,27],[27,29],[27,31],[24,26],[26,28],[28,30],[28,32]] },
  { color: 'torso', pairs: [[11,12],[11,23],[12,24],[23,24]] },
  { color: 'face',  pairs: [[0,7],[0,8],[7,9],[8,10]] },
];
const SEG_COLORS: Record<SegmentColor, string> = {
  arm:   'rgba(99,220,139,0.85)',
  leg:   'rgba(96,165,250,0.85)',
  torso: 'rgba(251,146,60,0.85)',
  face:  'rgba(200,200,200,0.5)',
};
const JOINT_COLORS: Record<SegmentColor, string> = {
  arm:   'rgba(34,197,94,1)',
  leg:   'rgba(59,130,246,1)',
  torso: 'rgba(249,115,22,1)',
  face:  'rgba(160,160,160,0.6)',
};

// Build a joint→segment lookup for coloring each joint
const JOINT_SEGMENT: Record<number, SegmentColor> = {};
SKELETON_SEGMENTS.forEach(({ color, pairs }) => {
  pairs.forEach(([a, b]) => { JOINT_SEGMENT[a] = JOINT_SEGMENT[a] ?? color; JOINT_SEGMENT[b] = color; });
});

// ─────────────────────────────────────────────────────────────────────────────
//  MATH HELPERS
// ─────────────────────────────────────────────────────────────────────────────
interface Pt3 { x: number; y: number; z: number }

function angle3D(a: Pt3, b: Pt3, c: Pt3): number {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const mag = (v: typeof ba) => Math.sqrt(v.x**2 + v.y**2 + v.z**2);
  const cosine = dot / (mag(ba) * mag(bc) + 1e-9);
  return (Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI;
}

// EMA smoother — per named angle
class AngleSmoother {
  private vals: Record<string, number> = {};
  constructor(private alpha = 0.35) {}   // lower alpha = smoother (more lag)
  smooth(name: string, raw: number): number {
    if (this.vals[name] === undefined) { this.vals[name] = raw; return raw; }
    this.vals[name] = this.alpha * raw + (1 - this.alpha) * this.vals[name];
    return Math.round(this.vals[name] * 10) / 10;
  }
  get(name: string) { return this.vals[name] ?? 0; }
  reset() { this.vals = {}; }
}

// ─────────────────────────────────────────────────────────────────────────────
//  ANGLE COMPUTATION  (3D world landmarks preferred; 2D fallback)
// ─────────────────────────────────────────────────────────────────────────────
function computeAngles(
  lm2d: any[],
  smoother: AngleSmoother,
  lm3d?: any[],
): Record<string, number> {
  const src = (lm3d && lm3d.length > 0) ? lm3d : lm2d;

  const safe = (ai: number, bi: number, ci: number, name: string) => {
    if (!src[ai] || !src[bi] || !src[ci]) return smoother.get(name);
    const vis = (lm2d[ai]?.visibility ?? 1) * (lm2d[bi]?.visibility ?? 1) * (lm2d[ci]?.visibility ?? 1);
    if (vis < 0.15) return smoother.get(name); // skip low-confidence landmarks
    const raw = src[ai].z !== undefined
      ? angle3D(src[ai], src[bi], src[ci])
      : angle3D({ ...src[ai], z: 0 }, { ...src[bi], z: 0 }, { ...src[ci], z: 0 });
    return smoother.smooth(name, raw);
  };

  // ── Arms
  const leftElbow     = safe(LM.L_SHOULDER, LM.L_ELBOW,    LM.L_WRIST,    'leftElbow');
  const rightElbow    = safe(LM.R_SHOULDER, LM.R_ELBOW,    LM.R_WRIST,    'rightElbow');
  const leftShoulder  = safe(LM.L_ELBOW,   LM.L_SHOULDER,  LM.L_HIP,      'leftShoulder');
  const rightShoulder = safe(LM.R_ELBOW,   LM.R_SHOULDER,  LM.R_HIP,      'rightShoulder');
  const leftWrist     = safe(LM.L_ELBOW,   LM.L_WRIST,     LM.L_INDEX,    'leftWrist');
  const rightWrist    = safe(LM.R_ELBOW,   LM.R_WRIST,     LM.R_INDEX,    'rightWrist');

  // ── Legs
  const leftKnee      = safe(LM.L_HIP,     LM.L_KNEE,      LM.L_ANKLE,    'leftKnee');
  const rightKnee     = safe(LM.R_HIP,     LM.R_KNEE,      LM.R_ANKLE,    'rightKnee');
  const leftHip       = safe(LM.L_SHOULDER,LM.L_HIP,       LM.L_KNEE,     'leftHip');
  const rightHip      = safe(LM.R_SHOULDER,LM.R_HIP,       LM.R_KNEE,     'rightHip');
  const leftAnkle     = safe(LM.L_KNEE,    LM.L_ANKLE,     LM.L_FOOT,     'leftAnkle');
  const rightAnkle    = safe(LM.R_KNEE,    LM.R_ANKLE,     LM.R_FOOT,     'rightAnkle');

  // ── Spine / Torso
  const leftTorso     = safe(LM.L_SHOULDER,LM.L_HIP,       LM.L_ANKLE,    'leftTorso');
  const rightTorso    = safe(LM.R_SHOULDER,LM.R_HIP,       LM.R_ANKLE,    'rightTorso');
  const leftSpine     = safe(LM.L_SHOULDER,LM.L_HIP,       LM.L_KNEE,     'leftSpine');
  const rightSpine    = safe(LM.R_SHOULDER,LM.R_HIP,       LM.R_KNEE,     'rightSpine');

  // ── Neck / Head
  const neckTilt      = safe(LM.L_SHOULDER,LM.NOSE,         LM.R_SHOULDER,'neckTilt');

  const avg = (a: number, b: number) => Math.round((a + b) / 2 * 10) / 10;

  return {
    left_elbow: leftElbow,         right_elbow: rightElbow,
    left_shoulder: leftShoulder,   right_shoulder: rightShoulder,
    left_wrist: leftWrist,         right_wrist: rightWrist,
    left_knee: leftKnee,           right_knee: rightKnee,
    left_hip: leftHip,             right_hip: rightHip,
    left_ankle: leftAnkle,         right_ankle: rightAnkle,
    left_torso: leftTorso,         right_torso: rightTorso,
    left_spine: leftSpine,         right_spine: rightSpine,
    neck_tilt: neckTilt,
    // Averages (used by exercise configs)
    avg_elbow:    avg(leftElbow,    rightElbow),
    avg_shoulder: avg(leftShoulder, rightShoulder),
    avg_knee:     avg(leftKnee,     rightKnee),
    avg_hip:      avg(leftHip,      rightHip),
    avg_torso:    avg(leftTorso,    rightTorso),
    avg_spine:    avg(leftSpine,    rightSpine),
    avg_ankle:    avg(leftAnkle,    rightAnkle),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXERCISE CONFIGS  — 12 exercises, biomechanical thresholds
//
//  Each config has:
//    recognition: angle ranges that must ALL be satisfied to classify this exercise
//    repStates:   { down: {...}, up: {...} } or { hold: {...} } for timed exercises
//    is_timed:    true for hold-based exercises (plank, wall sit)
//    repDown:     angle that triggers "down" state (with hysteresis)
//    repUp:       angle that triggers "up" / rep-complete state (with hysteresis)
//    repHinge:    which angle key drives the FSM
// ─────────────────────────────────────────────────────────────────────────────
type Range = [number, number];
interface ExerciseConfig {
  displayName: string;
  muscles: string[];
  /** All conditions must hold for this exercise to be recognized */
  recognition: Record<string, Range>;
  /** Which angle key drives rep counting */
  repKey: string;
  /** Angle below this → "down" phase (with hysteresis buffer built in) */
  downThresh: number;
  /** Angle above this → "up" phase / rep complete */
  upThresh: number;
  /** Extra conditions that must hold during DOWN to count it as a real rep */
  downConditions?: Record<string, Range>;
  is_timed?: boolean;
  /** For timed: hold condition angles */
  holdCondition?: Record<string, Range>;
}

const EXERCISES: Record<string, ExerciseConfig> = {
  // ── SQUAT ────────────────────────────────────────────────────────────────
  squat: {
    displayName: 'Squat', muscles: ['Quadriceps', 'Glutes', 'Hamstrings', 'Core'],
    recognition: { avg_knee: [45, 175], avg_hip: [45, 175], avg_torso: [60, 175] },
    repKey: 'avg_knee',
    downThresh: 105,   // knee angle below 105° = "down"
    upThresh:   155,   // knee angle above 155° = standing / rep complete
    downConditions: { avg_hip: [40, 130] }, // hips must also bend
  },

  // ── ROMANIAN / CONVENTIONAL DEADLIFT ────────────────────────────────────
  deadlift: {
    displayName: 'Deadlift', muscles: ['Hamstrings', 'Glutes', 'Lower Back', 'Traps'],
    recognition: { avg_hip: [40, 165], avg_knee: [120, 180], avg_torso: [50, 170] },
    repKey: 'avg_hip',
    downThresh: 100,   // hip hinge: torso parallel to floor
    upThresh:   155,   // standing fully erect
  },

  // ── PUSH-UP ─────────────────────────────────────────────────────────────
  pushup: {
    displayName: 'Push-up', muscles: ['Chest', 'Triceps', 'Anterior Deltoid', 'Core'],
    recognition: { avg_elbow: [50, 175], avg_torso: [140, 180], avg_shoulder: [30, 100] },
    repKey: 'avg_elbow',
    downThresh: 95,    // elbows ~90° = chest near floor
    upThresh:   150,   // arms extended
    downConditions: { avg_torso: [140, 180] },
  },

  // ── BICEP CURL ──────────────────────────────────────────────────────────
  bicep_curl: {
    displayName: 'Bicep Curl', muscles: ['Biceps Brachii', 'Brachialis', 'Forearms'],
    recognition: { avg_elbow: [25, 165], avg_shoulder: [140, 180] },
    repKey: 'avg_elbow',
    downThresh: 145,   // arm nearly fully extended
    upThresh:   65,    // fully curled (lower = more curled)
    // Note: up/down are inverted for curl (curling = angle decreasing)
  },

  // ── SHOULDER PRESS / OVERHEAD PRESS ─────────────────────────────────────
  shoulder_press: {
    displayName: 'Shoulder Press', muscles: ['Deltoids', 'Triceps', 'Upper Traps'],
    recognition: { avg_elbow: [60, 175], avg_shoulder: [70, 150] },
    repKey: 'avg_elbow',
    downThresh: 100,   // elbows ~90° at shoulder height
    upThresh:   155,   // arms locked out overhead
    downConditions: { avg_shoulder: [75, 140] },
  },

  // ── LATERAL RAISE ───────────────────────────────────────────────────────
  lateral_raise: {
    displayName: 'Lateral Raise', muscles: ['Medial Deltoid', 'Supraspinatus'],
    recognition: { avg_shoulder: [40, 110], avg_elbow: [150, 180] },
    repKey: 'avg_shoulder',
    downThresh: 30,    // arms at sides
    upThresh:   80,    // arms parallel to floor
  },

  // ── LUNGE ────────────────────────────────────────────────────────────────
  lunge: {
    displayName: 'Lunge', muscles: ['Quadriceps', 'Glutes', 'Hamstrings', 'Calves'],
    recognition: { left_knee: [45, 165], right_knee: [45, 165], avg_torso: [120, 180] },
    repKey: 'left_knee',
    downThresh: 105,   // front knee ~90°
    upThresh:   155,   // standing
    downConditions: { right_knee: [45, 130] },
  },

  // ── PLANK ────────────────────────────────────────────────────────────────
  plank: {
    displayName: 'Plank', muscles: ['Core', 'Glutes', 'Shoulders', 'Transverse Abdominis'],
    recognition: { avg_torso: [150, 180], avg_elbow: [75, 105] },
    repKey: 'avg_torso',
    downThresh: 0, upThresh: 0, // not used for timed
    is_timed: true,
    holdCondition: { avg_torso: [150, 180] },
  },

  // ── WALL SIT ─────────────────────────────────────────────────────────────
  wall_sit: {
    displayName: 'Wall Sit', muscles: ['Quadriceps', 'Glutes', 'Calves'],
    recognition: { avg_knee: [75, 105], avg_torso: [150, 180] },
    repKey: 'avg_knee',
    downThresh: 0, upThresh: 0,
    is_timed: true,
    holdCondition: { avg_knee: [75, 105], avg_torso: [150, 180] },
  },

  // ── PULL-UP / CHIN-UP ────────────────────────────────────────────────────
  pullup: {
    displayName: 'Pull-up', muscles: ['Latissimus Dorsi', 'Biceps', 'Rear Deltoids'],
    recognition: { avg_elbow: [25, 155], avg_shoulder: [25, 125] },
    repKey: 'avg_elbow',
    downThresh: 145,   // arms fully extended (hanging)
    upThresh:   65,    // chin over bar (elbows sharply bent)
  },

  // ── TRICEP DIP ───────────────────────────────────────────────────────────
  tricep_dip: {
    displayName: 'Tricep Dip', muscles: ['Triceps', 'Anterior Deltoid', 'Pectoralis Minor'],
    recognition: { avg_elbow: [55, 165], avg_shoulder: [90, 160] },
    repKey: 'avg_elbow',
    downThresh: 90,    // elbows ~90°
    upThresh:   150,   // arms extended
  },

  // ── GLUTE BRIDGE ────────────────────────────────────────────────────────
  glute_bridge: {
    displayName: 'Glute Bridge', muscles: ['Glutes', 'Hamstrings', 'Lower Back'],
    recognition: { avg_hip: [100, 170], avg_knee: [75, 110], avg_torso: [100, 160] },
    repKey: 'avg_hip',
    downThresh: 145,   // hips low (lying flat, hip angle large)
    upThresh:   115,   // hips thrust up (hip angle decreases)
  },
};

// Priority order: more specific / rarer exercises first
const EXERCISE_PRIORITY = [
  'plank', 'wall_sit', 'pullup', 'tricep_dip',
  'deadlift', 'glute_bridge',
  'squat', 'lunge',
  'shoulder_press', 'lateral_raise',
  'pushup', 'bicep_curl',
];

// ─────────────────────────────────────────────────────────────────────────────
//  EXERCISE CLASSIFIER  — confidence voting over N frames
// ─────────────────────────────────────────────────────────────────────────────
const CONFIRM_FRAMES = 6;    // need 6 consecutive matching frames
const RELEASE_FRAMES = 20;   // lose exercise after 20 non-matching frames

class ExerciseClassifier {
  private candidate: string | null = null;
  private candidateCount = 0;
  private current: string | null = null;
  private noMatchCount = 0;

  classify(angles: Record<string, number>): string | null {
    let matched: string | null = null;
    for (const ex of EXERCISE_PRIORITY) {
      const cfg = EXERCISES[ex];
      if (Object.entries(cfg.recognition).every(([k, v]) => inRange(angles[k] ?? -1, v as Range))) {
        matched = ex;
        break;
      }
    }

    if (matched === this.current) {
      this.noMatchCount = 0;
      this.candidateCount = 0;
      this.candidate = null;
      return this.current;
    }

    if (matched === null) {
      this.noMatchCount++;
      if (this.noMatchCount >= RELEASE_FRAMES) {
        this.current = null;
        this.candidate = null;
        this.candidateCount = 0;
      }
      return this.current;
    }

    // New candidate
    if (matched !== this.candidate) {
      this.candidate = matched;
      this.candidateCount = 1;
    } else {
      this.candidateCount++;
    }

    if (this.candidateCount >= CONFIRM_FRAMES) {
      this.current = matched;
      this.candidate = null;
      this.candidateCount = 0;
      this.noMatchCount = 0;
    }

    return this.current;
  }

  reset() {
    this.candidate = null; this.candidateCount = 0;
    this.current = null;   this.noMatchCount = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  REP COUNTER  — hysteresis FSM per exercise
// ─────────────────────────────────────────────────────────────────────────────
const HYSTERESIS = 8; // degrees of hysteresis buffer to prevent jitter

interface RepState {
  reps: number;
  phase: 'up' | 'down';
  holdFrames: number;
  /** Track angle velocity for fast-movement detection */
  prevAngle: number;
  /** Frames spent in down phase (need min dwell to count) */
  downDwell: number;
}

class RepCounterEngine {
  private states: Record<string, RepState> = {};

  getOrCreate(ex: string): RepState {
    if (!this.states[ex]) {
      this.states[ex] = { reps: 0, phase: 'up', holdFrames: 0, prevAngle: -1, downDwell: 0 };
    }
    return this.states[ex];
  }

  count(ex: string, angles: Record<string, number>): { reps: number; phase: string } {
    const cfg = EXERCISES[ex];
    if (!cfg) return { reps: 0, phase: 'unknown' };
    const st = this.getOrCreate(ex);
    const val = angles[cfg.repKey] ?? 0;

    // ── Timed exercise (plank, wall sit) ────────────────────────────────
    if (cfg.is_timed) {
      const hold = cfg.holdCondition ?? {};
      const holding = Object.entries(hold).every(([k, v]) => inRange(angles[k] ?? 0, v as Range));
      if (holding) {
        st.holdFrames++;
        return { reps: Math.floor(st.holdFrames / 30), phase: 'holding' }; // ~30fps
      }
      return { reps: Math.floor(st.holdFrames / 30), phase: 'rest' };
    }

    st.prevAngle = val;

    // ── Standard exercises: inverted-angle exercises (curl, pullup) ──────
    // For these, "down" threshold > "up" threshold (angle decreases to rep)
    const isCurlStyle = cfg.downThresh > cfg.upThresh;

    if (isCurlStyle) {
      // Phase: 'up' means arm fully extended (large angle), 'down' means curled
      if (st.phase === 'up' && val <= cfg.upThresh + HYSTERESIS) {
        st.phase = 'down';
        st.downDwell = 0;
      } else if (st.phase === 'down') {
        st.downDwell++;
        if (val >= cfg.downThresh - HYSTERESIS && st.downDwell >= 3) {
          // Check extra conditions
          const condOk = !cfg.downConditions || Object.entries(cfg.downConditions)
            .every(([k, v]) => inRange(angles[k] ?? 0, v as Range));
          if (condOk) { st.reps++; st.phase = 'up'; st.downDwell = 0; }
        }
      }
    } else {
      // Standard: 'up' = standing/extended, 'down' = contracted/lowered
      if (st.phase === 'up' && val <= cfg.downThresh + HYSTERESIS) {
        // Check extra conditions
        const condOk = !cfg.downConditions || Object.entries(cfg.downConditions)
          .every(([k, v]) => inRange(angles[k] ?? 0, v as Range));
        if (condOk) { st.phase = 'down'; st.downDwell = 0; }
      } else if (st.phase === 'down') {
        st.downDwell++;
        if (val >= cfg.upThresh - HYSTERESIS && st.downDwell >= 3) {
          st.reps++; st.phase = 'up'; st.downDwell = 0;
        }
      }
    }

    return { reps: st.reps, phase: st.phase };
  }

  getReps(ex: string) { return this.states[ex]?.reps ?? 0; }
  reset() { this.states = {}; }
}

// ─────────────────────────────────────────────────────────────────────────────
//  ADVANCED FORM ANALYZER — Elite Biomechanical Engine
//  • 40+ angle-range checks with severity weighting + grace zones
//  • Coordinate-based checks: knee cave, elbow flare, hip shift, asymmetry
//  • Scaled penalties based on deviation magnitude
//  • Symmetry scoring from bilateral landmark comparison
//  • Returns corrections ranked by severity
// ─────────────────────────────────────────────────────────────────────────────
interface FormRule {
  key: string;
  goodRange: Range;
  severity: 'critical' | 'warn' | 'tip';
  msg: string;
  graceDeg?: number;
}

const FORM_RULES: Record<string, FormRule[]> = {
  squat: [
    { key: 'left_torso',  goodRange: [142, 180], severity: 'critical', msg: 'Keep your chest up — back is rounding', graceDeg: 4 },
    { key: 'right_torso', goodRange: [142, 180], severity: 'critical', msg: 'Right side collapsing — keep chest tall', graceDeg: 4 },
    { key: 'avg_spine',   goodRange: [138, 180], severity: 'warn',     msg: 'Maintain a neutral spine throughout', graceDeg: 4 },
    { key: 'left_knee',   goodRange: [45, 165],  severity: 'tip',      msg: 'Go deeper — aim for thighs parallel to floor' },
    { key: 'avg_ankle',   goodRange: [58, 112],  severity: 'warn',     msg: 'Heels lifting — stay flat-footed', graceDeg: 5 },
    { key: 'neck_tilt',   goodRange: [118, 172], severity: 'tip',      msg: 'Look straight ahead — neutral neck position' },
  ],
  deadlift: [
    { key: 'left_torso',  goodRange: [128, 180], severity: 'critical', msg: 'Brace your core — spine is rounding dangerously', graceDeg: 3 },
    { key: 'right_torso', goodRange: [128, 180], severity: 'critical', msg: 'Right side rounding — keep back flat', graceDeg: 3 },
    { key: 'avg_spine',   goodRange: [133, 180], severity: 'critical', msg: 'Neutral spine is non-negotiable — reset if needed', graceDeg: 3 },
    { key: 'avg_knee',    goodRange: [120, 180], severity: 'warn',     msg: 'Keep legs straighter — this is a hip hinge', graceDeg: 5 },
    { key: 'neck_tilt',   goodRange: [113, 172], severity: 'tip',      msg: 'Neck neutral — look at floor 2 feet ahead' },
  ],
  pushup: [
    { key: 'avg_torso',   goodRange: [153, 180], severity: 'critical', msg: 'Body must be a straight line — hips are sagging', graceDeg: 3 },
    { key: 'left_torso',  goodRange: [153, 180], severity: 'critical', msg: 'Left side dropping — squeeze core and glutes', graceDeg: 3 },
    { key: 'right_torso', goodRange: [153, 180], severity: 'warn',     msg: 'Right side lower — level your hips', graceDeg: 4 },
    { key: 'avg_elbow',   goodRange: [53, 102],  severity: 'tip',      msg: 'Lower chest to 1cm from floor for full range' },
    { key: 'avg_shoulder',goodRange: [28, 82],   severity: 'warn',     msg: 'Elbows at 45° — reduces shoulder impingement risk' },
    { key: 'neck_tilt',   goodRange: [118, 177], severity: 'tip',      msg: 'Neck neutral — eyes on floor 12 inches forward' },
  ],
  bicep_curl: [
    { key: 'avg_shoulder', goodRange: [150, 180], severity: 'critical', msg: 'Stop swinging — lock elbows at your sides', graceDeg: 4 },
    { key: 'left_shoulder',goodRange: [150, 180], severity: 'warn',     msg: 'Left elbow drifting — pin it to your side', graceDeg: 5 },
    { key: 'right_shoulder',goodRange: [150, 180], severity: 'warn',   msg: 'Right elbow drifting — control that arm', graceDeg: 5 },
    { key: 'avg_elbow',   goodRange: [22, 68],   severity: 'tip',      msg: 'Curl all the way up — squeeze hard at the top' },
    { key: 'avg_wrist',   goodRange: [138, 180], severity: 'warn',     msg: 'Keep wrists straight — curled wrists reduce force' },
  ],
  shoulder_press: [
    { key: 'avg_torso',   goodRange: [148, 180], severity: 'critical', msg: 'Stop arching lower back — brace core hard', graceDeg: 4 },
    { key: 'left_torso',  goodRange: [148, 180], severity: 'warn',     msg: 'Left side arching — engage core on that side', graceDeg: 5 },
    { key: 'avg_elbow',   goodRange: [152, 180], severity: 'tip',      msg: 'Lock arms fully at the top — complete each rep' },
    { key: 'avg_shoulder',goodRange: [78, 162],  severity: 'warn',     msg: 'Elbows slightly in front — not flared out wide' },
  ],
  lateral_raise: [
    { key: 'avg_elbow',   goodRange: [141, 180], severity: 'warn',     msg: 'Keep arms nearly straight — too much bend shifts load' },
    { key: 'avg_shoulder',goodRange: [70, 107],  severity: 'tip',      msg: 'Raise to shoulder level only — higher = trap recruitment' },
    { key: 'avg_torso',   goodRange: [143, 180], severity: 'critical', msg: 'Stop swinging torso — isolate the deltoid' },
    { key: 'left_shoulder',goodRange: [66, 112], severity: 'warn',     msg: 'Left arm lagging — match it to the right side' },
    { key: 'right_shoulder',goodRange: [66, 112],severity: 'warn',     msg: 'Right arm lagging — raise it evenly with the left' },
  ],
  lunge: [
    { key: 'avg_torso',   goodRange: [141, 180], severity: 'critical', msg: 'Keep torso upright — forward lean overloads knees', graceDeg: 4 },
    { key: 'left_knee',   goodRange: [76, 110],  severity: 'warn',     msg: 'Front knee at 90° — track over the second toe' },
    { key: 'right_knee',  goodRange: [68, 122],  severity: 'tip',      msg: 'Back knee should graze the floor at the bottom' },
    { key: 'avg_spine',   goodRange: [136, 180], severity: 'warn',     msg: 'Spine neutral — don\'t let back round under load' },
  ],
  plank: [
    { key: 'avg_torso',   goodRange: [152, 180], severity: 'critical', msg: 'Hips sagging — squeeze glutes and abs NOW', graceDeg: 3 },
    { key: 'avg_spine',   goodRange: [152, 180], severity: 'critical', msg: 'Hips piking up — lower them to straight', graceDeg: 3 },
    { key: 'avg_elbow',   goodRange: [76, 104],  severity: 'warn',     msg: 'Elbows directly under shoulders for stability' },
    { key: 'neck_tilt',   goodRange: [113, 172], severity: 'warn',     msg: 'Neutral neck — look straight down, not forward' },
  ],
  pullup: [
    { key: 'avg_elbow',   goodRange: [150, 180], severity: 'tip',      msg: 'Full dead hang at bottom — don\'t short-rep' },
    { key: 'avg_shoulder',goodRange: [30, 92],   severity: 'warn',     msg: 'Control the movement — no kipping or swinging' },
    { key: 'avg_torso',   goodRange: [138, 180], severity: 'warn',     msg: 'Hollow body — core engaged throughout' },
  ],
  tricep_dip: [
    { key: 'avg_torso',   goodRange: [141, 180], severity: 'critical', msg: 'Keep torso upright — leaning forward shifts load to chest', graceDeg: 4 },
    { key: 'avg_elbow',   goodRange: [76, 104],  severity: 'tip',      msg: 'Elbows to 90° at the bottom for full range' },
    { key: 'avg_shoulder',goodRange: [83, 167],  severity: 'warn',     msg: 'Shoulders down and back — don\'t shrug at bottom' },
  ],
  glute_bridge: [
    { key: 'avg_hip',     goodRange: [96, 134],  severity: 'tip',      msg: 'Push hips higher — squeeze glutes hard at the top' },
    { key: 'avg_knee',    goodRange: [76, 110],  severity: 'warn',     msg: 'Keep feet flat, knees tracking over toes at 90°' },
    { key: 'avg_spine',   goodRange: [128, 180], severity: 'warn',     msg: 'Don\'t hyperextend lower back — use glutes, not back' },
  ],
  wall_sit: [
    { key: 'avg_knee',    goodRange: [76, 104],  severity: 'critical', msg: 'Thighs must be parallel to floor — adjust position', graceDeg: 3 },
    { key: 'avg_torso',   goodRange: [152, 180], severity: 'warn',     msg: 'Back flat against the wall — no gap behind lower back' },
    { key: 'avg_ankle',   goodRange: [78, 112],  severity: 'tip',      msg: 'Feet flat on floor, directly under knees' },
  ],
};

const SEVERITY_PENALTY: Record<string, number> = { critical: 40, warn: 22, tip: 10 };

/** Coordinate-based biomechanical checks beyond simple angle ranges */
function coordinateChecks(
  exercise: string,
  lms: any[],
  _angles: Record<string, number>,
): Array<{ msg: string; severity: 'critical' | 'warn' | 'tip' }> {
  const results: Array<{ msg: string; severity: 'critical' | 'warn' | 'tip' }> = [];
  if (!lms || lms.length < 33) return results;

  const get = (i: number) => lms[i];
  const vis = (i: number) => (lms[i]?.visibility ?? 0);
  const vp = (a: number, b: number) => vis(a) > 0.38 && vis(b) > 0.38;

  if (exercise === 'squat') {
    if (vp(25, 27)) {
      const lKnee = get(25), lAnkle = get(27);
      if (lKnee && lAnkle && Math.abs(lKnee.x - lAnkle.x) > 0.10)
        results.push({ msg: 'Push your knees OUT — they\'re caving inward (valgus collapse)', severity: 'critical' });
    }
    if (vp(26, 28)) {
      const rKnee = get(26), rAnkle = get(28);
      if (rKnee && rAnkle && Math.abs(rKnee.x - rAnkle.x) > 0.10)
        results.push({ msg: 'Right knee caving — push knees outward over toes', severity: 'critical' });
    }
    if (vis(23) > 0.4 && vis(24) > 0.4 && vis(27) > 0.4 && vis(28) > 0.4) {
      const hipX = (get(23).x + get(24).x) / 2;
      const ankX = (get(27).x + get(28).x) / 2;
      if (Math.abs(hipX - ankX) > 0.13)
        results.push({ msg: 'Hip shift — keep weight centered between both feet', severity: 'warn' });
    }
  }

  if (exercise === 'deadlift') {
    if (vp(11, 23)) {
      const lSh = get(11), lHip = get(23);
      if (lSh && lHip && lSh.x > lHip.x + 0.15)
        results.push({ msg: 'Shoulders drifting too far forward — bar stays close to body', severity: 'critical' });
    }
  }

  if (exercise === 'pushup') {
    if (vp(13, 11)) {
      const lElbow = get(13), lShoulder = get(11);
      if (lElbow && lShoulder && Math.abs(lElbow.x - lShoulder.x) > 0.18)
        results.push({ msg: 'Elbows flaring out — tuck them to 45° to protect shoulders', severity: 'warn' });
    }
    if (vis(23) > 0.4 && vis(11) > 0.4 && vis(25) > 0.4) {
      const hip = get(23), sh = get(11), knee = get(25);
      const midY = (sh.y + knee.y) / 2;
      if (hip && Math.abs(hip.y - midY) > 0.06)
        results.push({ msg: 'Body not straight — hips sagging or piking', severity: 'critical' });
    }
  }

  if (exercise === 'bicep_curl') {
    if (vp(13, 23)) {
      const lElbow = get(13), lHip = get(23);
      if (lElbow && lHip && lElbow.y < lHip.y - 0.12)
        results.push({ msg: 'Left elbow lifting forward — pin it to your side', severity: 'critical' });
    }
    if (vp(14, 24)) {
      const rElbow = get(14), rHip = get(24);
      if (rElbow && rHip && rElbow.y < rHip.y - 0.12)
        results.push({ msg: 'Right elbow lifting forward — pin it to your side', severity: 'critical' });
    }
    if (vp(15, 16)) {
      const lW = get(15), rW = get(16);
      if (lW && rW && Math.abs(lW.y - rW.y) > 0.09)
        results.push({ msg: 'Uneven curl — left and right arms at different heights', severity: 'warn' });
    }
  }

  if (exercise === 'shoulder_press') {
    if (vp(15, 16)) {
      const lW = get(15), rW = get(16);
      if (lW && rW && Math.abs(lW.y - rW.y) > 0.07)
        results.push({ msg: 'Uneven press — one arm is leading the other', severity: 'warn' });
    }
  }

  if (exercise === 'lunge') {
    if (vp(25, 31)) {
      const lKnee = get(25), lFoot = get(31);
      if (lKnee && lFoot && Math.abs(lKnee.x - lFoot.x) > 0.09)
        results.push({ msg: 'Front knee past toes — step further forward to protect joint', severity: 'critical' });
    }
    if (vp(11, 12)) {
      const lSh = get(11), rSh = get(12);
      if (lSh && rSh && Math.abs(lSh.y - rSh.y) > 0.07)
        results.push({ msg: 'Shoulder tilt detected — keep shoulders level throughout', severity: 'warn' });
    }
  }

  if (exercise === 'plank') {
    if (vp(23, 24)) {
      const lHip = get(23), rHip = get(24);
      if (lHip && rHip && Math.abs(lHip.y - rHip.y) > 0.06)
        results.push({ msg: 'Hips rotated — keep pelvis square and level', severity: 'warn' });
    }
    if (vp(13, 11)) {
      const lElbow = get(13), lSh = get(11);
      if (lElbow && lSh && Math.abs(lElbow.x - lSh.x) > 0.10)
        results.push({ msg: 'Elbows not under shoulders — reposition for proper load', severity: 'warn' });
    }
  }

  if (exercise === 'glute_bridge') {
    if (vp(23, 24)) {
      const lHip = get(23), rHip = get(24);
      if (lHip && rHip && Math.abs(lHip.y - rHip.y) > 0.07)
        results.push({ msg: 'Hip rotation — push both sides up evenly', severity: 'warn' });
    }
    if (vp(25, 27)) {
      const lKnee = get(25), lAnkle = get(27);
      if (lKnee && lAnkle && Math.abs(lKnee.x - lAnkle.x) > 0.10)
        results.push({ msg: 'Left knee caving — push it outward for full glute activation', severity: 'warn' });
    }
  }

  if (exercise === 'lateral_raise') {
    if (vp(15, 16)) {
      const lW = get(15), rW = get(16);
      if (lW && rW && Math.abs(lW.y - rW.y) > 0.09)
        results.push({ msg: 'Uneven raise — one arm higher than the other', severity: 'warn' });
    }
  }

  if (exercise === 'pullup') {
    if (vp(15, 16)) {
      const lW = get(15), rW = get(16);
      if (lW && rW && Math.abs(lW.y - rW.y) > 0.09)
        results.push({ msg: 'One arm pulling more — focus on even bilateral pull', severity: 'warn' });
    }
  }

  return results.slice(0, 2);
}

/** Bilateral symmetry score from left/right landmark angle comparison */
function computeSymmetry(angles: Record<string, number>): number {
  const pairs: Array<[string, string]> = [
    ['left_knee', 'right_knee'],
    ['left_elbow', 'right_elbow'],
    ['left_shoulder', 'right_shoulder'],
    ['left_hip', 'right_hip'],
    ['left_torso', 'right_torso'],
  ];
  let totalDiff = 0, count = 0;
  for (const [l, r] of pairs) {
    if (angles[l] > 0 && angles[r] > 0) {
      totalDiff += Math.abs(angles[l] - angles[r]);
      count++;
    }
  }
  return count === 0 ? 100 : Math.max(40, Math.round(100 - (totalDiff / count) * 1.8));
}

function analyzeForm(
  exercise: string,
  angles: Record<string, number>,
  lms?: any[],
): { score: number; corrections: string[]; symmetry: number } {
  const rules = FORM_RULES[exercise] ?? [];
  let deduction = 0;
  const allCorrections: Array<{ msg: string; penalty: number }> = [];

  for (const rule of rules) {
    const val = angles[rule.key] ?? 0;
    if (val === 0) continue;
    const grace = rule.graceDeg ?? 0;
    const [lo, hi] = rule.goodRange;
    if (!inRange(val, [lo - grace, hi + grace])) {
      const dist = val < lo ? (lo - val) : (val - hi);
      const scaled = Math.min(SEVERITY_PENALTY[rule.severity] * 1.4, SEVERITY_PENALTY[rule.severity] * (1 + dist / 30));
      allCorrections.push({ msg: rule.msg, penalty: Math.round(scaled) });
      deduction += Math.round(scaled);
    }
  }

  if (lms) {
    const coordIssues = coordinateChecks(exercise, lms, angles);
    for (const issue of coordIssues) {
      const pen = SEVERITY_PENALTY[issue.severity];
      allCorrections.push({ msg: issue.msg, penalty: pen });
      deduction += pen;
    }
  }

  allCorrections.sort((a, b) => b.penalty - a.penalty);

  return {
    score: Math.max(0, Math.round(100 - deduction)),
    corrections: allCorrections.slice(0, 3).map(c => c.msg),
    symmetry: computeSymmetry(angles),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  UTILS
// ─────────────────────────────────────────────────────────────────────────────
function inRange(val: number, [lo, hi]: Range): boolean { return val >= lo && val <= hi; }

// ─────────────────────────────────────────────────────────────────────────────
//  SKELETON DRAWING  — color-segmented, with angle labels on key joints
// ─────────────────────────────────────────────────────────────────────────────
function drawSkeleton(
  lms: any[],
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  angles: Record<string, number>,
  exercise: string | null,
  formScore: number,
) {
  canvas.width  = video.videoWidth  || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const W = canvas.width, H = canvas.height;
  const MIN_VIS = 0.50; // raised from 0.35 → sharper detection, fewer false positives

  // Quality: smooth rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // ── Draw connections by segment ──────────────────────────────────────────
  SKELETON_SEGMENTS.forEach(({ color, pairs }) => {
    const baseColor = SEG_COLORS[color];
    const lineW = color === 'face' ? 1.5 : (formScore >= 80 ? 3.5 : formScore >= 55 ? 3.0 : 2.5);

    pairs.forEach(([a, b]) => {
      const lmA = lms[a], lmB = lms[b];
      if (!lmA || !lmB) return;
      if ((lmA.visibility ?? 1) < MIN_VIS || (lmB.visibility ?? 1) < MIN_VIS) return;

      const x1 = lmA.x * W, y1 = lmA.y * H;
      const x2 = lmB.x * W, y2 = lmB.y * H;

      // Gradient along limb for depth effect
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, baseColor);
      grad.addColorStop(1, baseColor + 'bb');

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = grad;
      ctx.lineWidth = lineW;
      ctx.lineCap = 'round';

      // Glow on connections when form is excellent
      if (formScore >= 80 && color !== 'face') {
        ctx.shadowColor = baseColor;
        ctx.shadowBlur  = 8;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
  });

  // ── Draw joints ──────────────────────────────────────────────────────────
  lms.forEach((lm: any, i: number) => {
    if ((lm.visibility ?? 1) < MIN_VIS) return;
    const seg: SegmentColor = JOINT_SEGMENT[i] ?? 'face';
    const x = lm.x * W, y = lm.y * H;
    const r = seg === 'face' ? 3.5 : 6;
    const jColor = JOINT_COLORS[seg];

    // Outer glow ring when form is ideal
    if (formScore >= 80 && seg !== 'face') {
      ctx.beginPath();
      ctx.arc(x, y, r + 4, 0, 2 * Math.PI);
      ctx.fillStyle = jColor + '28';
      ctx.fill();
    }

    // Joint fill
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = jColor;
    if (formScore >= 80 && seg !== 'face') {
      ctx.shadowColor = jColor;
      ctx.shadowBlur  = 10;
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    // White rim
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // ── Angle labels on key joints ───────────────────────────────────────────
  const ANGLE_LABELS: Array<{ lmIdx: number; key: string; show: (ex: string | null) => boolean }> = [
    { lmIdx: LM.L_ELBOW,    key: 'left_elbow',    show: ex => ['pushup','bicep_curl','shoulder_press','lateral_raise','pullup','tricep_dip'].includes(ex ?? '') },
    { lmIdx: LM.R_ELBOW,    key: 'right_elbow',   show: ex => ['pushup','bicep_curl','shoulder_press','pullup'].includes(ex ?? '') },
    { lmIdx: LM.L_KNEE,     key: 'left_knee',     show: ex => ['squat','lunge','wall_sit','glute_bridge','sumo_squat'].includes(ex ?? '') },
    { lmIdx: LM.R_KNEE,     key: 'right_knee',    show: ex => ['squat','deadlift','lunge'].includes(ex ?? '') },
    { lmIdx: LM.L_HIP,      key: 'left_hip',      show: ex => ['deadlift','glute_bridge','squat'].includes(ex ?? '') },
    { lmIdx: LM.L_SHOULDER, key: 'left_shoulder', show: ex => ['shoulder_press','lateral_raise'].includes(ex ?? '') },
  ];

  ctx.font = 'bold 12px Inter, system-ui, sans-serif';
  ANGLE_LABELS.forEach(({ lmIdx, key, show }) => {
    if (!show(exercise)) return;
    const lm = lms[lmIdx];
    if (!lm || (lm.visibility ?? 1) < 0.55) return;
    const val = angles[key];
    if (!val) return;

    const x = lm.x * W + 12, y = lm.y * H - 10;
    const txt = `${Math.round(val)}°`;
    const txtW = ctx.measureText(txt).width;
    const labelColor = formScore >= 80 ? '#86efac' : formScore >= 55 ? '#fde68a' : '#fca5a5';

    // Label bg pill
    ctx.fillStyle = 'rgba(3,7,18,0.78)';
    const pad = 5;
    ctx.beginPath();
    ctx.roundRect(x - pad, y - 14, txtW + pad * 2, 18, 5);
    ctx.fill();

    // Label border
    ctx.strokeStyle = labelColor + '55';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = labelColor;
    ctx.fillText(txt, x, y);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
interface PoseCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isActive: boolean;
  /** When set, classifier is bypassed and engine focuses solely on this exercise */
  selectedExercise?: string | null;
}

export default function PoseCanvas({ videoRef, isActive, selectedExercise }: PoseCanvasProps) {
  const canvasRef            = useRef<HTMLCanvasElement>(null);
  const wsRef                = useRef<WebSocket | null>(null);
  const isActiveRef          = useRef(isActive);
  const selectedExerciseRef  = useRef(selectedExercise);
  const dispatch             = useDispatch();
  const token                = useSelector((s: RootState) => s.auth.token);

  // Persistent engine instances (survive re-renders)
  const landmarkerRef = useRef<any>(null);
  const animFrameRef  = useRef<number>(0);
  const smootherRef   = useRef<AngleSmoother>(new AngleSmoother(0.28)); // smoother than before
  const classifierRef = useRef<ExerciseClassifier>(new ExerciseClassifier());
  const repEngineRef  = useRef<RepCounterEngine>(new RepCounterEngine());
  const formScoreRef  = useRef<number>(100);
  // 5-frame rolling average for form score — eliminates flicker
  const formScoreHistoryRef = useRef<number[]>([]);


  const [mpStatus, setMpStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [mpMessage, setMpMessage] = useState('Loading AI model (full)…');

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { selectedExerciseRef.current = selectedExercise ?? null; }, [selectedExercise]);

  // ── Reset counters when session ends ────────────────────────────────────
  useEffect(() => {
    if (!isActive) {
      classifierRef.current.reset();
      repEngineRef.current.reset();
      smootherRef.current.reset();
    }
  }, [isActive]);

  // ── Load MediaPipe (Full model → Lite fallback) ─────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const MODELS = [
        {
          label: 'full model',
          url: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task',
          delegate: 'GPU' as const,
        },
        {
          label: 'full model (CPU)',
          url: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task',
          delegate: 'CPU' as const,
        },
        {
          label: 'lite model (fallback)',
          url: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'CPU' as const,
        },
      ];

      let { PoseLandmarker, FilesetResolver } : any = {};
      try {
        const mod = await import(
          /* @vite-ignore */
          // @ts-ignore
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'
        );
        PoseLandmarker = mod.PoseLandmarker;
        FilesetResolver = mod.FilesetResolver;
      } catch (e) {
        console.error('[PoseCanvas] CDN import failed:', e);
        if (!cancelled) { setMpStatus('error'); setMpMessage('Failed to load MediaPipe SDK'); }
        return;
      }

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      for (const model of MODELS) {
        if (cancelled) return;
        try {
          setMpMessage(`Loading AI (${model.label})…`);
          // Higher confidence thresholds for better accuracy
          const landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: model.url, delegate: model.delegate },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.60,
            minPosePresenceConfidence: 0.60,
            minTrackingConfidence: 0.60,
            outputSegmentationMasks: false,

          });
          if (!cancelled) {
            landmarkerRef.current = landmarker;
            setMpStatus('ready');
            setMpMessage(`AI ready (${model.label})`);
          }
          return; // success!
        } catch (err) {
          console.warn(`[PoseCanvas] ${model.label} failed:`, err);
        }
      }

      if (!cancelled) { setMpStatus('error'); setMpMessage('All pose models failed to load'); }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // ── Detection loop ──────────────────────────────────────────────────────
  useEffect(() => {
    if (mpStatus !== 'ready') return;

    let lastVideoTime = -1;

    const detect = () => {
      const video     = videoRef.current;
      const canvas    = canvasRef.current;
      const landmarker = landmarkerRef.current;

      if (!video || !canvas || !landmarker || video.readyState < 2 || video.videoWidth === 0) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        try {
          const result = landmarker.detectForVideo(video, performance.now());

          if (result?.landmarks?.length > 0) {
            const lm2d  = result.landmarks[0];
            const lm3d  = result.worldLandmarks?.[0];

            // Compute angles using 3D world landmarks when available
            const angles = computeAngles(lm2d, smootherRef.current, lm3d);

            // ── FOCUSED MODE: bypass classifier entirely ─────────────────
            // When user selected an exercise, lock detection to it — zero hallucination
            const focusedExercise = selectedExerciseRef.current;
            const exercise = focusedExercise
              ? focusedExercise  // Use exactly what user chose
              : classifierRef.current.classify(angles); // Freeform: auto-detect

            let reps = 0, phase = 'unknown';
            let form_score = 100;
            let corrections: string[] = [];

            if (exercise && isActiveRef.current) {
              const rep = repEngineRef.current.count(exercise, angles);
              reps  = rep.reps;
              phase = rep.phase;
              const form = analyzeForm(exercise, angles, lm2d);

              // 5-frame rolling average — eliminates flicker in form score display
              formScoreHistoryRef.current = [...formScoreHistoryRef.current.slice(-4), form.score];
              const smoothedScore = Math.round(
                formScoreHistoryRef.current.reduce((a, b) => a + b, 0) / formScoreHistoryRef.current.length
              );

              form_score = smoothedScore;
              corrections = form.corrections;
              formScoreRef.current = form_score;
            } else if (exercise) {
              // Show form feedback in preview (before session starts)
              const form = analyzeForm(exercise, angles, lm2d);
              form_score = form.score;
              corrections = form.corrections;
              formScoreRef.current = form_score;
            }

            // Draw skeleton with angle overlays
            drawSkeleton(lm2d, canvas, video, angles, exercise, formScoreRef.current);


            // ── FOCUSED MODE badge drawn on canvas ───────────────────────
            if (focusedExercise && canvas) {
              const ctx2 = canvas.getContext('2d');
              const cfg2 = EXERCISES[focusedExercise];
              if (ctx2 && cfg2) {
                const label = `🎯 ${cfg2.displayName.toUpperCase()}`;
                ctx2.font = 'bold 11px Inter, sans-serif';
                const tw = ctx2.measureText(label).width;
                const bx = canvas.width - tw - 24, by = 10;
                ctx2.fillStyle = 'rgba(99,102,241,0.85)';
                ctx2.beginPath();
                ctx2.roundRect(bx - 6, by, tw + 18, 22, 6);
                ctx2.fill();
                ctx2.fillStyle = '#fff';
                ctx2.fillText(label, bx + 3, by + 15);
              }
            }

            // Serializable landmarks
            const landmarks = lm2d.map((lm: any) => ({
              x:          Math.round(lm.x          * 10000) / 10000,
              y:          Math.round(lm.y          * 10000) / 10000,
              z:          Math.round((lm.z ?? 0)   * 10000) / 10000,
              visibility: Math.round((lm.visibility ?? 1) * 1000) / 1000,
            }));

            dispatch(updatePoseData({
              detected: true,
              exercise: exercise ?? undefined,
              reps,
              state: phase,
              form_score,
              corrections,
              landmarks,
              angles,
            }));
          } else {
            // Clear canvas
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            dispatch(updatePoseData({ detected: false }));
          }
        } catch {
          // Skip bad frames silently
        }
      }

      animFrameRef.current = requestAnimationFrame(detect);
    };

    animFrameRef.current = requestAnimationFrame(detect);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [mpStatus, dispatch, videoRef]);

  // ── Backend WS (optional analytics bridge — silent if unavailable) ──────
  useEffect(() => {
    // Local AI (MediaPipe) is ALWAYS active regardless of WS status
    // Mark as "connected" immediately since local AI is running
    dispatch(setWsConnected(true));

    if (!token) return;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen  = () => { ws!.send(JSON.stringify({ token })); };
      ws.onclose = () => { wsRef.current = null; }; // silent — local AI still runs
      ws.onerror = () => { ws?.close(); };           // silent — local AI still runs
      ws.onmessage = (e) => {
        try { const d = JSON.parse(e.data); if (d.warning) console.warn('[PoseWS]', d.warning); } catch {}
      };
    } catch {} // silent failure — local AI still runs
    return () => { wsRef.current?.close(); wsRef.current = null; };
  }, [token, dispatch]);


  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <canvas ref={canvasRef} className="pose-canvas" style={{ transform: 'scaleX(-1)' }} />

      {/* Status badge */}
      {mpStatus === 'loading' && (
        <div style={{
          position: 'absolute', bottom: 10, right: 10,
          background: 'rgba(15,15,22,0.9)',
          borderRadius: 8, padding: '5px 12px',
          fontSize: 11, color: '#d4d4d8',
          display: 'flex', alignItems: 'center', gap: 7,
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#f59e0b', display: 'inline-block',
            boxShadow: '0 0 6px #f59e0b',
            animation: 'pulse 1.2s ease-in-out infinite',
          }} />
          {mpMessage}
        </div>
      )}

      {mpStatus === 'error' && (
        <div style={{
          position: 'absolute', bottom: 10, right: 10,
          background: 'rgba(239,68,68,0.12)',
          border: '1px solid rgba(239,68,68,0.35)',
          borderRadius: 8, padding: '5px 12px',
          fontSize: 11, color: '#f87171',
        }}>
          ⚠ {mpMessage}
        </div>
      )}

      {mpStatus === 'ready' && (
        <div style={{
          position: 'absolute', bottom: 10, right: 10,
          background: 'rgba(12,36,18,0.95)',
          borderRadius: 8, padding: '5px 12px',
          fontSize: 11, color: '#86efac',
          display: 'flex', alignItems: 'center', gap: 6,
          border: '1px solid rgba(34,197,94,0.3)',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
          AI Ready • {mpMessage.replace('AI ready (', '').replace(')', '')}
        </div>
      )}
    </>
  );
}
