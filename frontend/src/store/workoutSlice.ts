import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface SessionGoal {
  sets: number;
  repsPerSet: number;
  restDuration: number; // seconds
  mode: 'fixed' | 'amrap' | 'interval';
  effortTarget: number; // RPE 1–10
}

export interface SetRecord {
  setNum: number;
  reps: number;
  avgFormScore: number;
  duration: number; // seconds
  effortRating: number; // RPE 1–10
}

export interface PersonalBest {
  exercise: string;
  reps: number;
  formScore: number;
  date: string;
}

export interface WorkoutState {
  sessionId: string | null;
  isSessionActive: boolean;
  selectedExercise: string | null;
  currentExercise: string | null;
  repCount: number;
  formScore: number;
  currentState: string;
  corrections: string[];
  landmarks: any[];
  angles: Record<string, number>;
  isDetected: boolean;
  sessionDuration: number;
  totalRepsSession: number;
  exercisesThisSession: string[];
  wsConnected: boolean;
  // NEW: Session Goal System
  sessionGoal: SessionGoal;
  setHistory: SetRecord[];
  personalBests: Record<string, PersonalBest>;
  currentSetDuration: number; // seconds in current set
  effortRating: number; // last RPE rating
  formScoreHistory: number[]; // last 20 form scores for sparkline
  totalCalories: number;
}

const DEFAULT_GOAL: SessionGoal = {
  sets: 3,
  repsPerSet: 12,
  restDuration: 60,
  mode: 'fixed',
  effortTarget: 7,
};

const initialState: WorkoutState = {
  sessionId: null,
  isSessionActive: false,
  selectedExercise: null,
  currentExercise: null,
  repCount: 0,
  formScore: 0,
  currentState: 'unknown',
  corrections: [],
  landmarks: [],
  angles: {},
  isDetected: false,
  sessionDuration: 0,
  totalRepsSession: 0,
  exercisesThisSession: [],
  wsConnected: false,
  sessionGoal: DEFAULT_GOAL,
  setHistory: [],
  personalBests: {},
  currentSetDuration: 0,
  effortRating: 0,
  formScoreHistory: [],
  totalCalories: 0,
};

const workoutSlice = createSlice({
  name: 'workout',
  initialState,
  reducers: {
    startSession(state, action: PayloadAction<string>) {
      state.sessionId = action.payload;
      state.isSessionActive = true;
      state.repCount = 0;
      state.totalRepsSession = 0;
      state.exercisesThisSession = [];
      state.sessionDuration = 0;
      state.setHistory = [];
      state.currentSetDuration = 0;
      state.effortRating = 0;
      state.formScoreHistory = [];
      state.totalCalories = 0;
    },
    setSelectedExercise(state, action: PayloadAction<string | null>) {
      state.selectedExercise = action.payload;
      state.repCount = 0;
    },
    endSession(state) {
      state.isSessionActive = false;
      state.sessionId = null;
      state.currentExercise = null;
      state.selectedExercise = null;
      state.repCount = 0;
      state.formScore = 0;
      state.wsConnected = false;
    },
    setSessionGoal(state, action: PayloadAction<Partial<SessionGoal>>) {
      state.sessionGoal = { ...state.sessionGoal, ...action.payload };
    },
    recordCompletedSet(state, action: PayloadAction<SetRecord>) {
      state.setHistory.push(action.payload);
      // Check for personal best
      const ex = state.selectedExercise || state.currentExercise;
      if (ex) {
        const existing = state.personalBests[ex];
        if (!existing || action.payload.reps > existing.reps ||
          (action.payload.reps === existing.reps && action.payload.avgFormScore > existing.formScore)) {
          state.personalBests[ex] = {
            exercise: ex,
            reps: action.payload.reps,
            formScore: action.payload.avgFormScore,
            date: new Date().toISOString(),
          };
        }
      }
    },
    setEffortRating(state, action: PayloadAction<number>) {
      state.effortRating = action.payload;
    },
    updatePoseData(state, action: PayloadAction<{
      detected: boolean;
      exercise?: string;
      reps?: number;
      state?: string;
      form_score?: number;
      corrections?: string[];
      landmarks?: any[];
      angles?: Record<string, number>;
    }>) {
      const d = action.payload;
      state.isDetected = d.detected;
      if (d.detected) {
        if (d.exercise && d.exercise !== state.currentExercise) {
          if (d.exercise && !state.exercisesThisSession.includes(d.exercise)) {
            state.exercisesThisSession.push(d.exercise);
          }
        }
        state.currentExercise = d.exercise || null;
        const newReps = d.reps ?? state.repCount;
        if (newReps > state.repCount) {
          state.totalRepsSession += newReps - state.repCount;
          // Calorie estimate
          state.totalCalories = Math.round(state.totalRepsSession * 0.4 + state.sessionDuration * 0.07);
        }
        state.repCount = newReps;
        state.currentState = d.state || 'unknown';
        const newScore = d.form_score ?? state.formScore;
        if (newScore > 0) {
          state.formScoreHistory = [...state.formScoreHistory.slice(-19), newScore];
        }
        state.formScore = newScore;
        state.corrections = d.corrections || [];
        state.landmarks = d.landmarks || [];
        state.angles = d.angles || {};
      }
    },
    incrementDuration(state) {
      if (state.isSessionActive) {
        state.sessionDuration += 1;
        state.currentSetDuration += 1;
      }
    },
    resetSetDuration(state) {
      state.currentSetDuration = 0;
    },
    setWsConnected(state, action: PayloadAction<boolean>) {
      state.wsConnected = action.payload;
    },
    resetReps(state) {
      state.repCount = 0;
    },
  },
});

export const {
  startSession, endSession, updatePoseData,
  incrementDuration, setWsConnected, resetReps, setSelectedExercise,
  setSessionGoal, recordCompletedSet, setEffortRating, resetSetDuration,
} = workoutSlice.actions;
export default workoutSlice.reducer;
