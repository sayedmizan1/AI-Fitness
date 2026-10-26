/**
 * ExercisePicker — Premium Exercise Selection Modal
 *
 * Features:
 *  • 24 built-in exercises across 5 categories
 *  • Search by name or muscle group
 *  • "Add Custom Exercise" — user can create their own
 *  • Locked pose engine mode — zero hallucination
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Search, Check, ChevronRight, Dumbbell, Timer, Zap,
  Plus, ArrowLeft, Info,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────────────────────
export interface ExerciseMeta {
  id: string;
  displayName: string;
  emoji: string;
  category: 'upper' | 'lower' | 'core' | 'full' | 'custom';
  muscles: string[];
  difficulty: 1 | 2 | 3;
  isTimed: boolean;
  tip: string;
  isCustom?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
//  BUILT-IN CATALOGUE  (24 exercises)
// ─────────────────────────────────────────────────────────────────────────────
export const BUILTIN_EXERCISES: ExerciseMeta[] = [
  // ── Upper Body ──────────────────────────────────────────────────────────
  { id: 'pushup',         displayName: 'Push-up',           emoji: '🤸', category: 'upper', difficulty: 1, isTimed: false, muscles: ['Chest', 'Triceps', 'Anterior Deltoid', 'Core'],         tip: 'Body in straight line, core braced throughout' },
  { id: 'bicep_curl',     displayName: 'Bicep Curl',         emoji: '💪', category: 'upper', difficulty: 1, isTimed: false, muscles: ['Biceps Brachii', 'Brachialis', 'Forearms'],              tip: 'Lock elbows at sides, full range of motion' },
  { id: 'shoulder_press', displayName: 'Shoulder Press',     emoji: '🏋️', category: 'upper', difficulty: 2, isTimed: false, muscles: ['Deltoids', 'Triceps', 'Upper Traps'],                   tip: 'Core braced, press directly overhead' },
  { id: 'lateral_raise',  displayName: 'Lateral Raise',      emoji: '🕊️', category: 'upper', difficulty: 1, isTimed: false, muscles: ['Medial Deltoid', 'Supraspinatus'],                      tip: 'Slight elbow bend, raise to shoulder height only' },
  { id: 'pullup',         displayName: 'Pull-up',            emoji: '🧗', category: 'upper', difficulty: 3, isTimed: false, muscles: ['Latissimus Dorsi', 'Biceps', 'Rear Deltoids'],          tip: 'Dead hang at bottom, chin over bar at top' },
  { id: 'tricep_dip',     displayName: 'Tricep Dip',         emoji: '💺', category: 'upper', difficulty: 2, isTimed: false, muscles: ['Triceps', 'Anterior Deltoid', 'Pectoralis Minor'],      tip: 'Keep torso upright, elbows to 90°' },
  { id: 'chest_fly',      displayName: 'Chest Fly',          emoji: '🦅', category: 'upper', difficulty: 2, isTimed: false, muscles: ['Pectoralis Major', 'Anterior Deltoid', 'Biceps'],       tip: 'Slight elbow bend, arc arms like hugging a tree' },
  { id: 'front_raise',    displayName: 'Front Raise',        emoji: '⬆️', category: 'upper', difficulty: 1, isTimed: false, muscles: ['Anterior Deltoid', 'Upper Chest'],                      tip: 'Keep arms straight, raise to shoulder level' },
  { id: 'arnold_press',   displayName: 'Arnold Press',       emoji: '🔄', category: 'upper', difficulty: 2, isTimed: false, muscles: ['Deltoids (All Heads)', 'Triceps', 'Trapezius'],         tip: 'Rotate palms as you press overhead' },
  { id: 'upright_row',    displayName: 'Upright Row',        emoji: '🔝', category: 'upper', difficulty: 2, isTimed: false, muscles: ['Traps', 'Medial Deltoid', 'Biceps'],                    tip: 'Pull bar to chin, elbows flare out wide' },

  // ── Lower Body ──────────────────────────────────────────────────────────
  { id: 'squat',          displayName: 'Squat',              emoji: '🏋️', category: 'lower', difficulty: 1, isTimed: false, muscles: ['Quadriceps', 'Glutes', 'Hamstrings', 'Core'],          tip: 'Keep chest up, feet shoulder-width apart' },
  { id: 'deadlift',       displayName: 'Deadlift',           emoji: '🏗️', category: 'lower', difficulty: 2, isTimed: false, muscles: ['Hamstrings', 'Glutes', 'Lower Back', 'Traps'],         tip: 'Hinge at hips, maintain neutral spine throughout' },
  { id: 'lunge',          displayName: 'Lunge',              emoji: '🦵', category: 'lower', difficulty: 1, isTimed: false, muscles: ['Quadriceps', 'Glutes', 'Hamstrings', 'Calves'],        tip: 'Keep front knee above ankle, torso upright' },
  { id: 'glute_bridge',   displayName: 'Glute Bridge',       emoji: '🌉', category: 'lower', difficulty: 1, isTimed: false, muscles: ['Glutes', 'Hamstrings', 'Lower Back'],                   tip: 'Drive hips up, squeeze glutes at top' },
  { id: 'wall_sit',       displayName: 'Wall Sit',           emoji: '🪑', category: 'lower', difficulty: 1, isTimed: true,  muscles: ['Quadriceps', 'Glutes', 'Calves'],                      tip: 'Thighs parallel to floor, back flat on wall' },
  { id: 'calf_raise',     displayName: 'Calf Raise',         emoji: '🦶', category: 'lower', difficulty: 1, isTimed: false, muscles: ['Gastrocnemius', 'Soleus'],                              tip: 'Rise on balls of feet, pause at top' },
  { id: 'step_up',        displayName: 'Step-up',            emoji: '🪜', category: 'lower', difficulty: 1, isTimed: false, muscles: ['Quadriceps', 'Glutes', 'Hamstrings'],                   tip: 'Press through heel, fully extend hip at top' },
  { id: 'sumo_squat',     displayName: 'Sumo Squat',         emoji: '🤼', category: 'lower', difficulty: 1, isTimed: false, muscles: ['Inner Thighs', 'Glutes', 'Quadriceps'],                 tip: 'Wide stance, toes pointed out 45°' },

  // ── Core ────────────────────────────────────────────────────────────────
  { id: 'plank',          displayName: 'Plank',              emoji: '🧘', category: 'core',  difficulty: 1, isTimed: true,  muscles: ['Core', 'Glutes', 'Shoulders', 'Transverse Abdominis'], tip: 'Neutral spine, squeeze glutes and core' },
  { id: 'crunch',         displayName: 'Crunch',             emoji: '🪗', category: 'core',  difficulty: 1, isTimed: false, muscles: ['Rectus Abdominis', 'Hip Flexors'],                      tip: 'Lift shoulders, keep lower back on floor' },
  { id: 'bicycle_crunch', displayName: 'Bicycle Crunch',     emoji: '🚴', category: 'core',  difficulty: 2, isTimed: false, muscles: ['Obliques', 'Rectus Abdominis', 'Hip Flexors'],         tip: 'Elbow to opposite knee, controlled rotation' },
  { id: 'mountain_climber',displayName: 'Mountain Climber',  emoji: '🏔️', category: 'core',  difficulty: 2, isTimed: false, muscles: ['Core', 'Hip Flexors', 'Chest', 'Triceps'],             tip: 'Hips level, drive knees toward chest alternately' },

  // ── Full Body ───────────────────────────────────────────────────────────
  { id: 'burpee',         displayName: 'Burpee',             emoji: '💥', category: 'full',  difficulty: 3, isTimed: false, muscles: ['Full Body', 'Core', 'Chest', 'Legs'],                  tip: 'Jump back, chest to floor, explosive jump up' },
  { id: 'jumping_jack',   displayName: 'Jumping Jack',       emoji: '⭐', category: 'full',  difficulty: 1, isTimed: false, muscles: ['Full Body', 'Deltoids', 'Calves'],                     tip: 'Land softly, arms fully overhead' },
];

const CATEGORIES = [
  { id: 'all',    label: 'All',        emoji: '💪' },
  { id: 'upper',  label: 'Upper Body', emoji: '🤸' },
  { id: 'lower',  label: 'Lower Body', emoji: '🦵' },
  { id: 'core',   label: 'Core',       emoji: '🧘' },
  { id: 'full',   label: 'Full Body',  emoji: '💥' },
  { id: 'custom', label: 'My Exercises', emoji: '⭐' },
] as const;

const DIFFICULTY_LABEL = ['', 'Beginner', 'Intermediate', 'Advanced'];
const DIFFICULTY_COLOR = ['', '#22c55e',  '#f59e0b',        '#ef4444'];
const DIFFICULTY_BG    = ['', 'rgba(34,197,94,0.12)', 'rgba(245,158,11,0.12)', 'rgba(239,68,68,0.12)'];

const STORAGE_KEY = 'fitmentor_custom_exercises';

function loadCustomExercises(): ExerciseMeta[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCustomExercises(list: ExerciseMeta[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// ─────────────────────────────────────────────────────────────────────────────
//  PROPS
// ─────────────────────────────────────────────────────────────────────────────
interface ExercisePickerProps {
  isOpen: boolean;
  currentSelection: string | null;
  onSelect: (exerciseId: string) => void;
  onClose: () => void;
  isSessionActive?: boolean;
}

// Build the full catalogue (built-in + custom) so it's exported for other components
export let EXERCISE_CATALOGUE: ExerciseMeta[] = [...BUILTIN_EXERCISES, ...loadCustomExercises()];

// ─────────────────────────────────────────────────────────────────────────────
//  CUSTOM EXERCISE FORM
// ─────────────────────────────────────────────────────────────────────────────
const EMOJI_OPTIONS = ['🏋️','💪','🤸','🧘','🦵','🔥','⚡','🎯','🏃','🚀','💥','⭐','🔄','🎪','🦅','🌊','🪨','🛡️'];
const CATEGORY_OPTIONS: { id: ExerciseMeta['category']; label: string }[] = [
  { id: 'upper',  label: 'Upper Body' },
  { id: 'lower',  label: 'Lower Body' },
  { id: 'core',   label: 'Core' },
  { id: 'full',   label: 'Full Body' },
  { id: 'custom', label: 'Custom / Other' },
];

interface CustomFormProps {
  onSave: (ex: ExerciseMeta) => void;
  onCancel: () => void;
}

function CustomExerciseForm({ onSave, onCancel }: CustomFormProps) {
  const [name, setName]         = useState('');
  const [emoji, setEmoji]       = useState('🔥');
  const [category, setCategory] = useState<ExerciseMeta['category']>('custom');
  const [muscles, setMuscles]   = useState('');
  const [difficulty, setDiff]   = useState<1 | 2 | 3>(1);
  const [isTimed, setIsTimed]   = useState(false);
  const [tip, setTip]           = useState('');
  const [error, setError]       = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const handleSave = () => {
    if (!name.trim()) { setError('Exercise name is required'); return; }
    const muscleList = muscles.split(',').map(m => m.trim()).filter(Boolean);
    if (muscleList.length === 0) { setError('Add at least one muscle group'); return; }
    const id = `custom_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    onSave({
      id,
      displayName: name.trim(),
      emoji,
      category,
      muscles: muscleList,
      difficulty,
      isTimed,
      tip: tip.trim() || 'Focus on proper form and controlled movement',
      isCustom: true,
    });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: '9px 12px',
    color: '#e4e4e7', fontSize: 13, outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'linear-gradient(180deg, rgba(99,102,241,0.06) 0%, transparent 100%)',
      }}>
        <button
          onClick={onCancel}
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#a1a1aa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ArrowLeft size={15} />
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#f4f4f5' }}>Create Custom Exercise</h2>
          <p style={{ margin: 0, fontSize: 11.5, color: '#71717a' }}>AI will track form and count reps for your exercise</p>
        </div>
      </div>

      {/* Form body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{ display: 'grid', gap: 16 }}>

          {/* Name */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#71717a', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
              EXERCISE NAME *
            </label>
            <input
              ref={nameRef}
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              placeholder="e.g. Cable Crossover"
              style={inputStyle}
            />
          </div>

          {/* Emoji picker */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#71717a', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
              ICON
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {EMOJI_OPTIONS.map(e => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  style={{
                    width: 36, height: 36, borderRadius: 8, fontSize: 18, cursor: 'pointer',
                    border: emoji === e ? '2px solid #6366f1' : '2px solid rgba(255,255,255,0.08)',
                    background: emoji === e ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.12s',
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Category + Difficulty */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#71717a', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                CATEGORY
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as ExerciseMeta['category'])}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {CATEGORY_OPTIONS.map(c => (
                  <option key={c.id} value={c.id} style={{ background: '#141820' }}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#71717a', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                DIFFICULTY
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {([1, 2, 3] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setDiff(d)}
                    style={{
                      flex: 1, padding: '8px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 700,
                      border: difficulty === d ? `1.5px solid ${DIFFICULTY_COLOR[d]}` : '1.5px solid rgba(255,255,255,0.08)',
                      background: difficulty === d ? DIFFICULTY_BG[d] : 'rgba(255,255,255,0.03)',
                      color: difficulty === d ? DIFFICULTY_COLOR[d] : '#52525b',
                      transition: 'all 0.12s',
                    }}
                  >
                    {DIFFICULTY_LABEL[d]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Muscles */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#71717a', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
              TARGET MUSCLES * <span style={{ fontWeight: 400, color: '#52525b' }}>(comma separated)</span>
            </label>
            <input
              value={muscles}
              onChange={e => { setMuscles(e.target.value); setError(''); }}
              placeholder="e.g. Chest, Shoulders, Triceps"
              style={inputStyle}
            />
          </div>

          {/* Timed toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e4e4e7' }}>Timed Exercise</div>
              <div style={{ fontSize: 11, color: '#52525b', marginTop: 2 }}>AI counts hold time instead of reps</div>
            </div>
            <button
              onClick={() => setIsTimed(!isTimed)}
              style={{
                width: 44, height: 24, borderRadius: 12, cursor: 'pointer', border: 'none',
                background: isTimed ? '#6366f1' : 'rgba(255,255,255,0.1)',
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3,
                left: isTimed ? 23 : 3,
                transition: 'left 0.2s',
              }} />
            </button>
          </div>

          {/* Coach tip */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#71717a', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
              COACH TIP <span style={{ fontWeight: 400, color: '#52525b' }}>(optional)</span>
            </label>
            <textarea
              value={tip}
              onChange={e => setTip(e.target.value)}
              placeholder="e.g. Keep elbows close to body throughout"
              rows={2}
              style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit' }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '8px 12px', borderRadius: 8,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#f87171', fontSize: 12,
            }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '14px 24px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', gap: 10,
      }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#a1a1aa', fontSize: 13, fontWeight: 600,
        }}>
          Cancel
        </button>
        <button onClick={handleSave} style={{
          flex: 2, padding: '10px', borderRadius: 10, cursor: 'pointer',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none',
          color: '#fff', fontSize: 13, fontWeight: 700,
          boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
        }}>
          Save Exercise
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ExercisePicker({
  isOpen,
  currentSelection,
  onSelect,
  onClose,
  isSessionActive = false,
}: ExercisePickerProps) {
  const [category, setCategory] = useState<string>('all');
  const [search, setSearch]     = useState('');
  const [localSel, setLocalSel] = useState<string | null>(currentSelection);
  const [view, setView]         = useState<'list' | 'create'>('list');
  const [customExercises, setCustomExercises] = useState<ExerciseMeta[]>(loadCustomExercises);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const allExercises = useMemo(
    () => [...BUILTIN_EXERCISES, ...customExercises],
    [customExercises],
  );

  // Keep module-level catalogue in sync
  useEffect(() => {
    EXERCISE_CATALOGUE = [...BUILTIN_EXERCISES, ...customExercises];
  }, [customExercises]);

  useEffect(() => { setLocalSel(currentSelection); }, [currentSelection]);
  useEffect(() => {
    if (isOpen) { setSearch(''); setCategory('all'); setView('list'); }
  }, [isOpen]);

  const filtered = useMemo(() => {
    return allExercises.filter(ex => {
      const matchCat = category === 'all'
        || (category === 'custom' ? ex.isCustom : ex.category === category);
      const q = search.toLowerCase();
      const matchQ = !q
        || ex.displayName.toLowerCase().includes(q)
        || ex.muscles.some(m => m.toLowerCase().includes(q));
      return matchCat && matchQ;
    });
  }, [category, search, allExercises]);

  const handleConfirm = () => {
    if (localSel) { onSelect(localSel); onClose(); }
  };

  const handleSaveCustom = (ex: ExerciseMeta) => {
    const updated = [...customExercises, ex];
    setCustomExercises(updated);
    saveCustomExercises(updated);
    setLocalSel(ex.id);
    setView('list');
    setCategory('custom');
  };

  const handleDeleteCustom = (id: string) => {
    const updated = customExercises.filter(e => e.id !== id);
    setCustomExercises(updated);
    saveCustomExercises(updated);
    if (localSel === id) setLocalSel(null);
    setDeleteConfirm(null);
  };

  const selectedMeta = localSel ? allExercises.find(e => e.id === localSel) : null;
  const customCount  = customExercises.length;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: 'fixed', inset: 0,
            zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={view === 'list' ? onClose : undefined}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.8)',
              backdropFilter: 'blur(12px)',
            }}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 24 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            style={{
              position: 'relative', zIndex: 1,
              width: '100%', maxWidth: 800,
              height: 'min(88vh, 660px)',
              display: 'flex', flexDirection: 'column',
              background: 'linear-gradient(145deg, #0d1117 0%, #141820 100%)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 20,
              boxShadow: '0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(99,102,241,0.08)',
              overflow: 'hidden',
            }}
          >
            <AnimatePresence mode="wait">
              {view === 'create' ? (
                <motion.div key="create" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <CustomExerciseForm
                    onSave={handleSaveCustom}
                    onCancel={() => setView('list')}
                  />
                </motion.div>
              ) : (
                <motion.div key="list" initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                  {/* ── Header ─────────────────────────────────────────── */}
                  <div style={{
                    padding: '18px 22px 14px',
                    flexShrink: 0,
                    background: 'linear-gradient(180deg, rgba(99,102,241,0.07) 0%, transparent 100%)',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <Dumbbell size={18} color="#fff" />
                        </div>
                        <div>
                          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#f4f4f5' }}>
                            {isSessionActive ? 'Change Exercise' : 'Choose Your Exercise'}
                          </h2>
                          <p style={{ margin: 0, fontSize: 11.5, color: '#71717a', marginTop: 2 }}>
                            AI locks on to this movement only — no false detections
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Add custom exercise button */}
                        <button
                          onClick={() => setView('create')}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '7px 13px', borderRadius: 8, cursor: 'pointer',
                            background: 'rgba(99,102,241,0.12)',
                            border: '1px solid rgba(99,102,241,0.3)',
                            color: '#a5b4fc', fontSize: 11.5, fontWeight: 700,
                            transition: 'all 0.15s',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Plus size={13} />
                          Add Exercise
                        </button>
                        {(isSessionActive || currentSelection) && (
                          <button
                            onClick={onClose}
                            style={{
                              width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              color: '#71717a', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Search */}
                    <div style={{ position: 'relative', marginBottom: 12 }}>
                      <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#52525b', pointerEvents: 'none' }} />
                      <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search exercises or muscles…"
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 9, padding: '8px 12px 8px 32px',
                          color: '#e4e4e7', fontSize: 12.5, outline: 'none',
                        }}
                        onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.5)')}
                        onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                      />
                    </div>

                    {/* Category tabs */}
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {CATEGORIES.map(cat => {
                        const isActive = category === cat.id;
                        return (
                          <button
                            key={cat.id}
                            onClick={() => setCategory(cat.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              padding: '4px 11px', borderRadius: 20, cursor: 'pointer',
                              border: isActive ? '1px solid rgba(99,102,241,0.55)' : '1px solid rgba(255,255,255,0.07)',
                              background: isActive ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.03)',
                              color: isActive ? '#a5b4fc' : '#71717a',
                              fontSize: 11.5, fontWeight: 600,
                              transition: 'all 0.13s',
                            }}
                          >
                            <span style={{ fontSize: 11 }}>{cat.emoji}</span>
                            {cat.label}
                            {cat.id === 'custom' && customCount > 0 && (
                              <span style={{
                                background: '#6366f1', color: '#fff',
                                borderRadius: 10, padding: '0 5px', fontSize: 9, fontWeight: 700,
                              }}>
                                {customCount}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Exercise Grid ────────────────────────────────────── */}
                  <div style={{
                    flex: 1, overflowY: 'auto', padding: '14px 22px',
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(99,102,241,0.25) transparent',
                  }}>
                    {filtered.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#3f3f46' }}>
                        <div style={{ fontSize: 36, marginBottom: 10 }}>
                          {category === 'custom' ? '✨' : '🔍'}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#52525b', marginBottom: 6 }}>
                          {category === 'custom' ? 'No custom exercises yet' : 'No results found'}
                        </div>
                        <div style={{ fontSize: 12, color: '#3f3f46', marginBottom: 16 }}>
                          {category === 'custom'
                            ? 'Create your first custom exercise to track it with AI'
                            : 'Try a different category or search term'}
                        </div>
                        {category === 'custom' && (
                          <button
                            onClick={() => setView('create')}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              padding: '9px 18px', borderRadius: 10, cursor: 'pointer',
                              background: 'rgba(99,102,241,0.15)',
                              border: '1px solid rgba(99,102,241,0.35)',
                              color: '#a5b4fc', fontSize: 12.5, fontWeight: 700,
                            }}
                          >
                            <Plus size={14} /> Create Exercise
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
                        gap: 8,
                      }}>
                        {filtered.map(ex => {
                          const isSelected = localSel === ex.id;
                          return (
                            <motion.div
                              key={ex.id}
                              whileHover={{ scale: 1.025, y: -1 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => setLocalSel(ex.id)}
                              style={{
                                position: 'relative',
                                padding: '12px 12px 10px',
                                borderRadius: 12, cursor: 'pointer',
                                border: isSelected
                                  ? '1.5px solid rgba(99,102,241,0.65)'
                                  : '1.5px solid rgba(255,255,255,0.06)',
                                background: isSelected
                                  ? 'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(139,92,246,0.09))'
                                  : 'rgba(255,255,255,0.025)',
                                boxShadow: isSelected ? '0 0 0 3px rgba(99,102,241,0.1)' : 'none',
                                transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
                              }}
                            >
                              {/* Selected checkmark */}
                              {isSelected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  style={{
                                    position: 'absolute', top: 8, right: 8,
                                    width: 18, height: 18, borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                >
                                  <Check size={10} color="#fff" strokeWidth={3} />
                                </motion.div>
                              )}

                              {/* Delete button for custom exercises */}
                              {ex.isCustom && !isSelected && (
                                <button
                                  onClick={e => { e.stopPropagation(); setDeleteConfirm(ex.id); }}
                                  style={{
                                    position: 'absolute', top: 6, right: 6,
                                    width: 18, height: 18, borderRadius: 4,
                                    background: 'rgba(239,68,68,0.12)',
                                    border: '1px solid rgba(239,68,68,0.2)',
                                    color: '#f87171', cursor: 'pointer', fontSize: 10,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    opacity: 0.7,
                                  }}
                                >
                                  <X size={10} />
                                </button>
                              )}

                              {/* Emoji + name */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                                <span style={{ fontSize: 18, flexShrink: 0 }}>{ex.emoji}</span>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{
                                    fontSize: 12.5, fontWeight: 700,
                                    color: isSelected ? '#c7d2fe' : '#e4e4e7',
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                  }}>
                                    {ex.displayName}
                                  </div>
                                  {ex.isTimed && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
                                      <Timer size={8} color="#f59e0b" />
                                      <span style={{ fontSize: 8.5, color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase' }}>
                                        Timed
                                      </span>
                                    </div>
                                  )}
                                  {ex.isCustom && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
                                      <span style={{ fontSize: 8.5, color: '#a5b4fc', fontWeight: 700, textTransform: 'uppercase' }}>
                                        ⭐ Custom
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Difficulty */}
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                padding: '1.5px 7px', borderRadius: 20, marginBottom: 7,
                                background: DIFFICULTY_BG[ex.difficulty],
                              }}>
                                <Zap size={7} color={DIFFICULTY_COLOR[ex.difficulty]} fill={DIFFICULTY_COLOR[ex.difficulty]} />
                                <span style={{ fontSize: 8.5, fontWeight: 700, color: DIFFICULTY_COLOR[ex.difficulty], letterSpacing: '0.02em' }}>
                                  {DIFFICULTY_LABEL[ex.difficulty]}
                                </span>
                              </div>

                              {/* Muscles */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                {ex.muscles.slice(0, 2).map(m => (
                                  <span key={m} style={{
                                    fontSize: 9, padding: '1.5px 5px', borderRadius: 3,
                                    background: 'rgba(255,255,255,0.05)', color: '#71717a', fontWeight: 500,
                                  }}>
                                    {m}
                                  </span>
                                ))}
                                {ex.muscles.length > 2 && (
                                  <span style={{ fontSize: 9, color: '#3f3f46' }}>+{ex.muscles.length - 2}</span>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* ── Footer ───────────────────────────────────────────── */}
                  <div style={{
                    flexShrink: 0,
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    padding: '12px 22px',
                    background: 'rgba(0,0,0,0.3)',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    {/* Preview */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {selectedMeta ? (
                        <motion.div
                          key={selectedMeta.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          style={{ display: 'flex', alignItems: 'center', gap: 9 }}
                        >
                          <span style={{ fontSize: 20, flexShrink: 0 }}>{selectedMeta.emoji}</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#e4e4e7' }}>
                              {selectedMeta.displayName}
                            </div>
                            <div style={{
                              fontSize: 10.5, color: '#52525b',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              maxWidth: 260,
                            }}>
                              💡 {selectedMeta.tip}
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#52525b' }}>
                          <Info size={13} />
                          <span style={{ fontSize: 12 }}>Select an exercise to continue</span>
                        </div>
                      )}
                    </div>

                    {/* Confirm */}
                    <motion.button
                      onClick={handleConfirm}
                      disabled={!localSel}
                      whileHover={localSel ? { scale: 1.03 } : {}}
                      whileTap={localSel ? { scale: 0.97 } : {}}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '10px 20px', borderRadius: 11, border: 'none',
                        cursor: localSel ? 'pointer' : 'not-allowed',
                        background: localSel
                          ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                          : 'rgba(255,255,255,0.05)',
                        color: localSel ? '#fff' : '#52525b',
                        fontSize: 13, fontWeight: 700,
                        boxShadow: localSel ? '0 4px 16px rgba(99,102,241,0.4)' : 'none',
                        transition: 'all 0.2s', flexShrink: 0,
                      }}
                    >
                      {isSessionActive ? 'Switch Exercise' : 'Start Training'}
                      <ChevronRight size={14} />
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Delete confirm dialog */}
          <AnimatePresence>
            {deleteConfirm && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                style={{
                  position: 'absolute', zIndex: 2,
                  background: '#1a1d27',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 14, padding: '20px 24px',
                  textAlign: 'center',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                  maxWidth: 280,
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>🗑️</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f4f4f5', marginBottom: 6 }}>
                  Delete Exercise?
                </div>
                <div style={{ fontSize: 12, color: '#71717a', marginBottom: 16 }}>
                  This custom exercise will be permanently removed.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setDeleteConfirm(null)} style={{
                    flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer',
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#a1a1aa', fontSize: 12, fontWeight: 600,
                  }}>Cancel</button>
                  <button onClick={() => handleDeleteCustom(deleteConfirm!)} style={{
                    flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer',
                    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)',
                    color: '#f87171', fontSize: 12, fontWeight: 700,
                  }}>Delete</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>
  );
}
