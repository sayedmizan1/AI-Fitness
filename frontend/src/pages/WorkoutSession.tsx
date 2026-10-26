/**
 * WorkoutSession — Production-Ready AI Fitness Training Page
 *
 * Features:
 * • Full mobile-first responsive layout (single col → 2-col on 1100px+)
 * • Fixed-aspect camera container (no layout jumps ever)
 * • Screen Wake Lock (prevents phone sleep during workout)
 * • Fullscreen camera mode on mobile
 * • Haptic feedback on rep count (Vibration API)
 * • Live camera HUD overlay (rep + form + phase — no blur)
 * • Priority-queue voice coach (corrections interrupt cues)
 * • Set → RPE → Rest flow with configurable timer
 * • Session summary modal with grade + achievements
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import {
  startSession, endSession, incrementDuration, resetReps, setSelectedExercise,
  setSessionGoal, recordCompletedSet, resetSetDuration,
} from '../store/workoutSlice';
import { workoutApi } from '../api/coach';
import PoseCanvas from '../components/workout/PoseCanvas';
import RepCounter from '../components/workout/RepCounter';
import FormScoreGauge from '../components/workout/FormScoreGauge';
import ExercisePicker, { EXERCISE_CATALOGUE } from '../components/workout/ExercisePicker';
import AIAnalysisHUD from '../components/workout/AIAnalysisHUD';
import BodyScanOverlay from '../components/workout/BodyScanOverlay';
import AICoachStream from '../components/workout/AICoachStream';
import WorkoutAIChat from '../components/workout/WorkoutAIChat';
import RepQualityTimeline, { RepDetail } from '../components/workout/RepQualityTimeline';
import SessionGoalSetup from '../components/workout/SessionGoalSetup';
import SessionSummaryModal from '../components/workout/SessionSummaryModal';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Square, RefreshCw, AlertTriangle, Camera, CameraOff,
  Dumbbell, Clock, Zap, Target, CheckCircle2, Activity,
  TrendingUp, Flame, Brain, Volume2, VolumeX, Coffee,
  Sparkles, Award, Maximize2, Minimize2,
} from 'lucide-react';

const formatTime = (secs: number) => {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const TIPS = [
  '💡 Breathe out on the effort phase of every rep',
  '💡 Keep core braced throughout every exercise',
  '💡 Rest 60–90 s between sets for hypertrophy',
  '💡 Slow the eccentric phase for more muscle growth',
  '💡 Stay hydrated — drink water every 15 minutes',
  '💡 Warm up 5 min before intense training',
  '💡 Focus on the muscle you\'re working, not just weight',
];

export default function WorkoutSession() {
  const dispatch = useDispatch<AppDispatch>();
  const {
    isSessionActive, sessionId, repCount, formScore, currentExercise,
    currentState, corrections, isDetected, sessionDuration,
    totalRepsSession, exercisesThisSession, selectedExercise, angles,
    sessionGoal, personalBests, totalCalories, currentSetDuration,
  } = useSelector((s: RootState) => s.workout);

  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const tipRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const [cameraOn, setCameraOn]     = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tipIndex, setTipIndex]     = useState(0);
  const [mpLoading, setMpLoading]   = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [sessionStats, setSessionStats] = useState<any>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // Set & Rest tracking
  const [voiceOn, setVoiceOn]             = useState(true);
  const [currentSet, setCurrentSet]       = useState(1);
  const [isResting, setIsResting]         = useState(false);
  const [restRemaining, setRestRemaining] = useState(60);
  const [repHistory, setRepHistory]       = useState<RepDetail[]>([]);
  const [localSetHistory, setLocalSetHistory] = useState<Array<{
    setNum: number; reps: number; avgScore: number; duration: number; effortRating: number;
  }>>([]);
  const [pendingRpe, setPendingRpe] = useState<number | null>(null);

  const selectedMeta = selectedExercise
    ? EXERCISE_CATALOGUE.find(e => e.id === selectedExercise) ?? null
    : null;
  const activeExercise = currentExercise ?? selectedExercise;
  const setsCompleted  = localSetHistory.length;
  const goalProgress   = Math.min(1, setsCompleted / Math.max(sessionGoal.sets, 1));
  const scoreColor = formScore >= 80 ? '#22c55e' : formScore >= 55 ? '#f59e0b' : '#ef4444';

  // ── Screen Wake Lock ────────────────────────────────────────
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch {}
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }, []);

  // ── Voice Coach Queue ────────────────────────────────────────
  const speakQueue  = useRef<Array<{ text: string; priority: number }>>([]);
  const isSpeaking  = useRef(false);

  const processQueue = useCallback(() => {
    if (isSpeaking.current || speakQueue.current.length === 0 || !('speechSynthesis' in window)) return;
    const item = speakQueue.current.shift()!;
    isSpeaking.current = true;
    const utt = new SpeechSynthesisUtterance(item.text);
    utt.rate = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const eng = voices.find(v => v.lang.startsWith('en') && v.localService) || voices.find(v => v.lang.startsWith('en')) || voices[0];
    if (eng) utt.voice = eng;
    utt.onend = utt.onerror = () => { isSpeaking.current = false; processQueue(); };
    window.speechSynthesis.speak(utt);
  }, []);

  const speak = useCallback((text: string, priority = 1) => {
    if (!voiceOn || !('speechSynthesis' in window)) return;
    try {
      if (priority === 2) {
        window.speechSynthesis.cancel();
        isSpeaking.current = false;
        speakQueue.current = [{ text, priority }];
      } else {
        speakQueue.current.push({ text, priority });
        if (speakQueue.current.length > 3) speakQueue.current = speakQueue.current.slice(-2);
      }
      processQueue();
    } catch {}
  }, [voiceOn, processQueue]);

  // ── Haptic Feedback ─────────────────────────────────────────
  const haptic = useCallback((pattern: number | number[] = 50) => {
    try { if ('vibrate' in navigator) navigator.vibrate(pattern); } catch {}
  }, []);

  // ── Rep tracking ─────────────────────────────────────────────
  const lastRepRef = useRef(0);
  useEffect(() => {
    if (isSessionActive && repCount > lastRepRef.current && !isResting) {
      if (repCount > 0) {
        haptic(repCount % 5 === 0 ? [60, 30, 60] : 40);
        setRepHistory(prev => [...prev, {
          repNum: repCount, score: formScore,
          corrections: [...corrections], timestamp: Date.now(),
        }]);
        if (repCount % 5 === 0) speak(`${repCount} reps!`, 1);
      }
      lastRepRef.current = repCount;
    } else if (!isSessionActive) {
      lastRepRef.current = 0;
    }
  }, [repCount, isSessionActive, formScore, corrections, isResting, speak, haptic]);

  // Correction voice feedback
  const lastCorrRef = useRef('');
  useEffect(() => {
    if (isSessionActive && corrections.length > 0 && !isResting) {
      const c = corrections[0];
      if (c !== lastCorrRef.current) { speak(c, 2); lastCorrRef.current = c; }
    } else if (corrections.length === 0) { lastCorrRef.current = ''; }
  }, [corrections, isSessionActive, isResting, speak]);

  // ── Rest countdown ───────────────────────────────────────────
  useEffect(() => {
    let id: ReturnType<typeof setInterval>;
    if (isResting && restRemaining > 0) {
      id = setInterval(() => {
        setRestRemaining(t => {
          if (t <= 1) {
            setIsResting(false);
            setCurrentSet(s => s + 1);
            setRepHistory([]);
            dispatch(resetSetDuration());
            speak(`Rest complete. Set ${currentSet + 1} — let's go!`, 2);
            haptic([40, 30, 40, 30, 80]);
            return sessionGoal.restDuration;
          }
          if (t === 10) speak('10 seconds!', 1);
          if (t === 5)  speak('5!', 1);
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(id);
  }, [isResting, restRemaining, currentSet, sessionGoal.restDuration, speak, haptic, dispatch]);

  const handleEndSet = useCallback((rpe = 0) => {
    if (repCount === 0) return;
    const avg = repHistory.length > 0
      ? Math.round(repHistory.reduce((s, r) => s + r.score, 0) / repHistory.length)
      : formScore;
    const rec = { setNum: currentSet, reps: repCount, avgScore: avg, duration: currentSetDuration, effortRating: rpe };
    setLocalSetHistory(prev => [...prev, rec]);
    dispatch(recordCompletedSet({ setNum: currentSet, reps: repCount, avgFormScore: avg, duration: currentSetDuration, effortRating: rpe }));
    dispatch(resetReps());
    setRestRemaining(sessionGoal.restDuration);
    setIsResting(true);
    setPendingRpe(null);
    speak(`Set ${currentSet} done. Rest now.`, 2);
    haptic([80, 40, 80]);
  }, [repCount, repHistory, formScore, currentSet, currentSetDuration, sessionGoal.restDuration, dispatch, speak, haptic]);

  // Keep as backup — in case the effect fires before direct assignment
  useEffect(() => {
    if (cameraOn && streamRef.current && videoRef.current) {
      if (!videoRef.current.srcObject) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [cameraOn]);


  useEffect(() => {
    if (cameraOn && !selectedExercise && !isSessionActive) {
      const t = setTimeout(() => setPickerOpen(true), 500);
      return () => clearTimeout(t);
    }
  }, [cameraOn]); // eslint-disable-line

  useEffect(() => {
    if (isSessionActive) {
      tipRef.current = setInterval(() => setTipIndex(i => (i + 1) % TIPS.length), 8000);
    }
    return () => { if (tipRef.current) clearInterval(tipRef.current); };
  }, [isSessionActive]);

  const startCamera = useCallback(async () => {
    setCameraError('');
    setMpLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);

      // Immediately assign srcObject — don't wait for useEffect
      // Use rAF to ensure the video element is visible in the DOM
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        });
      });

      // Fallback: clear loading state after 4s even if pose not detected
      setTimeout(() => setMpLoading(false), 4000);

    } catch (e: any) {
      setCameraError(
        e.name === 'NotAllowedError' ? 'Camera permission denied. Click the camera icon in your browser.' :
        e.name === 'NotFoundError'   ? 'No camera found. Please connect a webcam.' :
        'Could not access camera. Check browser settings.',
      );
      setMpLoading(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setMpLoading(false);
    // Clear tip interval when camera stops to prevent memory leak
    if (tipRef.current) { clearInterval(tipRef.current); tipRef.current = null; }
  }, []);

  const handleStart = async () => {
    if (!selectedExercise) { setPickerOpen(true); return; }
    let sid = `local-${Date.now()}`;
    try { const s = await workoutApi.startSession(); sid = s.id; } catch {}
    dispatch(startSession(sid));
    setCurrentSet(1); setIsResting(false);
    setRepHistory([]); setLocalSetHistory([]);
    setSummaryOpen(false);
    timerRef.current = setInterval(() => dispatch(incrementDuration()), 1000);
    await requestWakeLock();
    speak(`Session started. ${selectedMeta?.displayName ?? 'Exercise'} focused.`, 2);
    haptic([40, 30, 80]);
  };

  const handleEnd = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    releaseWakeLock();

    const calories = totalCalories || Math.round(totalRepsSession * 0.42 + sessionDuration * 0.08);
    const avgForm  = localSetHistory.length > 0
      ? Math.round(localSetHistory.reduce((s, r) => s + r.avgScore, 0) / localSetHistory.length)
      : formScore;

    setSessionStats({
      duration: sessionDuration, totalReps: totalRepsSession, calories, avgFormScore: avgForm,
      setHistory: localSetHistory.map(s => ({
        setNum: s.setNum, reps: s.reps, avgFormScore: s.avgScore,
        duration: s.duration, effortRating: s.effortRating,
      })),
      exerciseName: selectedMeta?.displayName ?? (selectedExercise ?? 'Workout'),
      personalBest: !!(selectedExercise && personalBests[selectedExercise] &&
        totalRepsSession >= personalBests[selectedExercise].reps),
      setsCompleted, goalSets: sessionGoal.sets, goalRepsPerSet: sessionGoal.repsPerSet,
    });

    if (sessionId && !sessionId.startsWith('local-')) {
      try { await workoutApi.endSession(sessionId, { duration_mins: sessionDuration / 60, calories_burned: calories }); } catch {}
    }

    dispatch(endSession());
    stopCamera();
    setIsResting(false);
    setRepHistory([]);
    speak('Session finished. Amazing work!', 2);
    haptic([80, 40, 80, 40, 120]);
    setTimeout(() => setSummaryOpen(true), 400);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (tipRef.current)   clearInterval(tipRef.current);
      stopCamera();
      releaseWakeLock();
    };
  }, [stopCamera, releaseWakeLock]);

  useEffect(() => { if (isDetected) setMpLoading(false); }, [isDetected]);

  // ── Fullscreen handler ────────────────────────────────────────
  const toggleFullscreen = () => {
    setFullscreen(f => !f);
    if (!fullscreen) haptic(30);
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <>
      {/* Floating AI Chat during session */}
      <WorkoutAIChat
        exercise={selectedExercise}
        exerciseName={selectedMeta?.displayName ?? 'Exercise'}
        repCount={repCount}
        formScore={formScore}
        corrections={corrections}
        isSessionActive={isSessionActive}
        sessionDuration={sessionDuration}
      />

      {/* Modals */}
      {sessionStats && (
        <SessionSummaryModal
          isOpen={summaryOpen}
          onClose={() => setSummaryOpen(false)}
          onNewSession={() => { setSummaryOpen(false); setLocalSetHistory([]); setCurrentSet(1); }}
          stats={sessionStats}
        />
      )}
      <ExercisePicker
        isOpen={pickerOpen}
        currentSelection={selectedExercise}
        onSelect={id => { dispatch(setSelectedExercise(id)); setPickerOpen(false); setRepHistory([]); }}
        onClose={() => setPickerOpen(false)}
        isSessionActive={isSessionActive}
      />

      <div className="workout-page">
        <div className="workout-layout">

          {/* ══ LEFT COLUMN: Camera + Controls ══════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>

            {/* Session Header */}
            <div className="session-header">
              <div>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Activity size={14} color="#fff" />
                  </div>
                  AI Workout
                </h1>
                <p style={{ margin: '2px 0 0 37px', fontSize: 10, color: '#3f3f46' }}>
                  MediaPipe · 33 landmarks · Real-time form analysis
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {/* Voice toggle */}
                <button
                  onClick={() => setVoiceOn(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px',
                    borderRadius: 20, cursor: 'pointer', transition: 'all 0.18s',
                    background: voiceOn ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)',
                    border: voiceOn ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {voiceOn ? <Volume2 size={12} color="#a5b4fc" /> : <VolumeX size={12} color="#52525b" />}
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.05em', color: voiceOn ? '#a5b4fc' : '#52525b' }}>
                    {voiceOn ? 'VOICE' : 'MUTED'}
                  </span>
                </button>

                {isSessionActive && (
                  <>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px',
                      borderRadius: 20, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                    }}>
                      <div className="live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
                      <span style={{ fontSize: 9, fontWeight: 800, color: '#f87171', letterSpacing: '0.06em' }}>LIVE</span>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 20,
                      background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                    }}>
                      <Clock size={12} color="#4ade80" />
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#4ade80', fontVariantNumeric: 'tabular-nums' }}>
                        {formatTime(sessionDuration)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Goal Setup */}
            <SessionGoalSetup isVisible={!isSessionActive} />

            {/* Goal progress bar during session */}
            {isSessionActive && sessionGoal.sets > 1 && (
              <div style={{
                padding: '9px 12px', borderRadius: 11,
                background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.14)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24' }}>
                    🎯 {sessionGoal.sets} sets × {sessionGoal.repsPerSet} reps
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#f59e0b' }}>
                    {setsCompleted}/{sessionGoal.sets} sets
                  </span>
                </div>
                <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                  <motion.div
                    animate={{ width: `${Math.round(goalProgress * 100)}%` }}
                    transition={{ type: 'spring', stiffness: 80, damping: 18 }}
                    style={{
                      height: '100%', borderRadius: 3,
                      background: goalProgress >= 1 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : 'linear-gradient(90deg,#f59e0b,#fbbf24)',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Exercise Banner */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 13px', borderRadius: 11,
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
            }}>
              {selectedMeta ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 17 }}>{selectedMeta.emoji}</span>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#e4e4e7' }}>{selectedMeta.displayName}</span>
                      <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 8, background: 'rgba(99,102,241,0.14)', color: '#a5b4fc', fontWeight: 700, marginLeft: 7 }}>
                        AI FOCUSED
                      </span>
                    </div>
                  </div>
                  {!isResting && (
                    <button onClick={() => setPickerOpen(true)} style={{
                      padding: '4px 10px', borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)',
                      color: '#71717a', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                    }}>
                      Change
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Dumbbell size={14} color="#fbbf24" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>Select an exercise</span>
                  </div>
                  <button onClick={() => setPickerOpen(true)} style={{
                    padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: 'rgba(245,158,11,0.16)', color: '#fbbf24', fontSize: 10.5, fontWeight: 700,
                  }}>
                    Choose
                  </button>
                </>
              )}
            </div>

            {/* ── CAMERA CONTAINER ─────────────────────────────── */}
            <div className={`camera-container${fullscreen ? ' fullscreen-mode' : ''}`}>
              {/* Fullscreen toggle */}
              {cameraOn && (
                <button
                  onClick={toggleFullscreen}
                  style={{
                    position: 'absolute', top: 10, right: fullscreen ? 14 : 48, zIndex: 20,
                    width: 30, height: 30, borderRadius: 8,
                    background: 'rgba(15,15,22,0.85)', border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    pointerEvents: 'all',
                  }}
                >
                  {fullscreen ? <Minimize2 size={13} color="#a1a1aa" /> : <Maximize2 size={13} color="#a1a1aa" />}
                </button>
              )}

              {/* Video */}
              <video
                ref={videoRef}
                className="camera-video"
                style={{ display: cameraOn ? 'block' : 'none' }}
                muted autoPlay playsInline
              />

              {/* Pose canvas */}
              {cameraOn && (
                <PoseCanvas
                  videoRef={videoRef as any}
                  isActive={isSessionActive && !isResting}
                  selectedExercise={selectedExercise}
                />
              )}

              {/* Body scan overlay */}
              <BodyScanOverlay isScanning={mpLoading} isDetected={isDetected} />

              {/* ── Camera HUD top bar ── */}
              {cameraOn && !mpLoading && (
                <div className="camera-hud-bar">
                  {/* Pose detected pill */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20,
                    background: isDetected ? 'rgba(21,128,61,0.9)' : 'rgba(18,18,24,0.88)',
                    border: `1px solid ${isDetected ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    pointerEvents: 'none',
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: isDetected ? '#4ade80' : '#52525b' }} />
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: isDetected ? '#bbf7d0' : '#71717a' }}>
                      {isDetected ? '🧠 Pose Detected' : 'No Pose'}
                    </span>
                  </div>

                  {/* Live rep + form badges (only when active) */}
                  {isSessionActive && isDetected && !isResting && (
                    <div style={{ display: 'flex', gap: 6, pointerEvents: 'none' }}>
                      {/* Rep count */}
                      <motion.div
                        key={repCount}
                        animate={repCount > 0 ? { scale: [1, 1.2, 1] } : {}}
                        transition={{ duration: 0.3 }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20,
                          background: 'rgba(99,102,241,0.9)', border: '1px solid rgba(99,102,241,0.5)',
                        }}
                      >
                        <Zap size={11} color="#c7d2fe" />
                        <span style={{ fontSize: 12, fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                          {repCount}
                        </span>
                      </motion.div>
                      {/* Form score */}
                      {formScore > 0 && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20,
                          background: formScore >= 80 ? 'rgba(21,128,61,0.9)' : formScore >= 55 ? 'rgba(120,53,15,0.9)' : 'rgba(127,29,29,0.9)',
                          border: `1px solid ${scoreColor}55`,
                        }}>
                          {formScore >= 80
                            ? <CheckCircle2 size={11} color="#4ade80" />
                            : <AlertTriangle size={11} color={scoreColor} />
                          }
                          <span style={{ fontSize: 11, fontWeight: 800, color: scoreColor }}>
                            {formScore}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Camera HUD bottom bar ── */}
              <div className="camera-hud-bottom" style={{ pointerEvents: 'none' }}>
                {/* Corrections */}
                <AnimatePresence>
                  {cameraOn && corrections.length > 0 && !isResting && (
                    <>
                      {corrections.slice(0, 2).map((c, i) => (
                        <motion.div
                          key={c}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: i * 0.07 }}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: 8,
                            padding: '8px 11px', borderRadius: 10, marginBottom: 5,
                            background: i === 0 ? 'rgba(127,29,29,0.95)' : 'rgba(120,53,15,0.9)',
                            border: `1px solid ${i === 0 ? 'rgba(239,68,68,0.5)' : 'rgba(245,158,11,0.35)'}`,
                          }}
                        >
                          <AlertTriangle size={12} color={i === 0 ? '#f87171' : '#fbbf24'} style={{ flexShrink: 0, marginTop: 1 }} />
                          <div>
                            {i === 0 && <div style={{ fontSize: 7.5, fontWeight: 800, color: '#f87171', letterSpacing: '0.1em', marginBottom: 1 }}>PRIORITY CORRECTION</div>}
                            <span style={{ fontSize: 11, color: i === 0 ? '#fecaca' : '#fde68a', fontWeight: 600, lineHeight: 1.4 }}>{c}</span>
                          </div>
                        </motion.div>
                      ))}
                    </>
                  )}
                </AnimatePresence>

                {/* Perfect form praise */}
                {isSessionActive && cameraOn && corrections.length === 0 && isDetected && formScore >= 85 && !isResting && (
                  <motion.div
                    animate={{ opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 9,
                      background: 'rgba(20,83,45,0.92)', border: '1px solid rgba(34,197,94,0.35)',
                      fontSize: 11, color: '#86efac', fontWeight: 600, marginBottom: 4,
                    }}
                  >
                    <CheckCircle2 size={13} color="#22c55e" />
                    Perfect form — elite biomechanics!
                  </motion.div>
                )}

                {/* Tip strip */}
                {isSessionActive && cameraOn && corrections.length === 0 && (!isDetected || formScore < 85) && !isResting && (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={tipIndex}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      style={{
                        padding: '7px 12px', borderRadius: 9, marginBottom: 4,
                        background: 'rgba(15,15,22,0.88)', border: '1px solid rgba(255,255,255,0.1)',
                        fontSize: 10.5, color: '#94a3b8',
                      }}
                    >
                      {TIPS[tipIndex]}
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>

              {/* Rest screen */}
              {cameraOn && isResting && (
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(8,8,16,0.97)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 14, zIndex: 12,
                }}>
                  <div style={{ position: 'relative', width: 110, height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg style={{ position: 'absolute', width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                      <circle cx="55" cy="55" r="46" stroke="rgba(255,255,255,0.06)" strokeWidth="5" fill="transparent" />
                      <motion.circle cx="55" cy="55" r="46" stroke="#8b5cf6" strokeWidth="5" fill="transparent"
                        strokeDasharray={2 * Math.PI * 46}
                        animate={{ strokeDashoffset: (2 * Math.PI * 46) * (1 - restRemaining / sessionGoal.restDuration) }}
                        transition={{ duration: 1, ease: 'linear' }}
                      />
                    </svg>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Coffee size={20} color="#c4b5fd" style={{ marginBottom: 3 }} />
                      <span style={{ fontSize: 22, fontWeight: 900, color: '#f4f4f5', fontVariantNumeric: 'tabular-nums' }}>
                        {restRemaining}s
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', padding: '0 24px' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#c4b5fd', marginBottom: 4 }}>Recovery Rest</div>
                    <div style={{ fontSize: 11, color: '#52525b', marginBottom: 12, lineHeight: 1.5 }}>
                      Set {currentSet} complete · Next: Set {currentSet + 1} · {sessionGoal.repsPerSet} reps
                    </div>

                    {/* RPE picker */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 9, color: '#52525b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
                        How hard was that? (RPE)
                      </div>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        {[5,6,7,8,9,10].map(r => (
                          <button key={r} onClick={() => setPendingRpe(r)}
                            style={{
                              width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
                              fontSize: 11, fontWeight: 800,
                              background: pendingRpe === r ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.06)',
                              color: pendingRpe === r ? '#c4b5fd' : '#71717a',
                              outline: pendingRpe === r ? '2px solid rgba(139,92,246,0.5)' : 'none',
                            }}>
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Rest duration quick-set */}
                    <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 10 }}>
                      {[30,60,90,120].map(d => (
                        <button key={d}
                          onClick={() => { dispatch(setSessionGoal({ restDuration: d })); setRestRemaining(d); }}
                          style={{
                            padding: '3px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            fontSize: 10, fontWeight: 700,
                            background: sessionGoal.restDuration === d ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)',
                            color: sessionGoal.restDuration === d ? '#c4b5fd' : '#71717a',
                            outline: sessionGoal.restDuration === d ? '1px solid rgba(139,92,246,0.4)' : 'none',
                          }}>
                          {d}s
                        </button>
                      ))}
                    </div>

                    <button onClick={() => setIsResting(false)}
                      style={{
                        padding: '7px 18px', borderRadius: 9, cursor: 'pointer',
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                        color: '#e4e4e7', fontSize: 11, fontWeight: 700,
                      }}>
                      Skip Rest →
                    </button>
                  </div>
                </div>
              )}

              {/* Camera off placeholder */}
              {!cameraOn && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 16, padding: 24,
                }}>
                  <div style={{ position: 'relative' }}>
                    <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.45, 0.2] }} transition={{ duration: 2.5, repeat: Infinity }}
                      style={{ position: 'absolute', inset: -22, borderRadius: '50%', border: '1.5px solid rgba(99,102,241,0.3)' }} />
                    <div style={{
                      width: 68, height: 68, borderRadius: '50%',
                      background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.18)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CameraOff size={26} color="#3f3f46" />
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#e4e4e7', marginBottom: 5 }}>Camera Off</div>
                    <div style={{ fontSize: 11, color: '#52525b', marginBottom: 14 }}>Enable webcam for AI pose detection</div>
                    {cameraError && (
                      <div style={{ padding: '8px 12px', borderRadius: 9, marginBottom: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 11, maxWidth: 300, textAlign: 'left' }}>
                        {cameraError}
                      </div>
                    )}
                    <motion.button onClick={startCamera} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '11px 22px', borderRadius: 11, border: 'none', cursor: 'pointer',
                        background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
                        fontSize: 14, fontWeight: 700, boxShadow: '0 4px 18px rgba(99,102,241,0.4)',
                      }}
                    >
                      <Camera size={15} /> Enable Camera
                    </motion.button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Controls ──────────────────────────────────────── */}
            <div className="controls-bar">
              {!cameraOn ? (
                <motion.button onClick={startCamera} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    padding: '13px', border: '1px solid rgba(99,102,241,0.3)',
                    background: 'rgba(99,102,241,0.07)', color: '#a5b4fc', fontSize: 13, fontWeight: 700, borderRadius: 12,
                  }}>
                  <Camera size={16} /> Enable Camera
                </motion.button>
              ) : !isSessionActive ? (
                <motion.button onClick={handleStart} disabled={!selectedExercise}
                  whileHover={selectedExercise ? { scale: 1.02 } : {}}
                  whileTap={selectedExercise ? { scale: 0.97 } : {}}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '13px', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 14,
                    cursor: selectedExercise ? 'pointer' : 'not-allowed',
                    background: selectedExercise ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'rgba(255,255,255,0.05)',
                    color: selectedExercise ? '#fff' : '#52525b',
                    boxShadow: selectedExercise ? '0 4px 18px rgba(34,197,94,0.35)' : 'none',
                    transition: 'all 0.2s',
                  }}>
                  <Play size={16} fill={selectedExercise ? '#fff' : '#52525b'} />
                  {selectedExercise ? `Start — ${selectedMeta?.displayName}` : 'Choose Exercise'}
                </motion.button>
              ) : (
                <>
                  {!isResting && (
                    <motion.button onClick={() => handleEndSet(pendingRpe ?? 0)} disabled={repCount === 0}
                      whileHover={repCount > 0 ? { scale: 1.02 } : {}}
                      whileTap={repCount > 0 ? { scale: 0.97 } : {}}
                      style={{
                        flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                        padding: '13px', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 13,
                        cursor: repCount > 0 ? 'pointer' : 'not-allowed',
                        background: repCount > 0 ? 'linear-gradient(135deg,#8b5cf6,#6366f1)' : 'rgba(255,255,255,0.04)',
                        color: repCount > 0 ? '#fff' : '#52525b',
                        boxShadow: repCount > 0 ? '0 4px 14px rgba(139,92,246,0.3)' : 'none',
                        transition: 'all 0.18s', whiteSpace: 'nowrap',
                      }}>
                      <Coffee size={14} /> End Set {currentSet}
                    </motion.button>
                  )}
                  <motion.button onClick={handleEnd} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '13px', borderRadius: 12, cursor: 'pointer',
                      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)',
                      color: '#f87171', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                    }}>
                    <Square size={13} fill="#f87171" /> End
                  </motion.button>
                  <button onClick={() => dispatch(resetReps())} title="Reset reps"
                    style={{ padding: '13px 14px', borderRadius: 12, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#71717a' }}>
                    <RefreshCw size={14} />
                  </button>
                  <button onClick={() => setPickerOpen(true)} title="Change exercise"
                    style={{ padding: '13px 14px', borderRadius: 12, cursor: 'pointer', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.18)', color: '#a5b4fc' }}>
                    <Target size={14} />
                  </button>
                </>
              )}
            </div>

            {/* AI Coach Strip */}
            <AICoachStream
              exercise={activeExercise}
              currentState={currentState}
              formScore={formScore}
              corrections={corrections}
              repCount={repCount}
              isSessionActive={isSessionActive}
              isDetected={isDetected}
              isResting={isResting}
            />

            {/* Rep Quality Timeline */}
            {isSessionActive && (
              <div style={{ borderRadius: 14, padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Sparkles size={12} color="#fb923c" />
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: '#fb923c', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Set {currentSet} — Rep by Rep
                  </span>
                </div>
                <RepQualityTimeline reps={repHistory} />
              </div>
            )}

            {/* Session Stats Bar */}
            {isSessionActive && (
              <div className="session-stats-grid">
                {[
                  { label: 'Time',     value: formatTime(sessionDuration), icon: Clock,      color: '#6366f1' },
                  { label: 'Reps',     value: totalRepsSession,            icon: Zap,        color: '#22c55e' },
                  { label: 'Calories', value: `~${totalCalories || Math.round(totalRepsSession * 0.42 + sessionDuration * 0.08)}`, icon: Flame, color: '#f97316' },
                  { label: 'Sets',     value: `${setsCompleted}/${sessionGoal.sets}`, icon: Award, color: '#a78bfa' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} style={{
                    padding: '10px 8px', borderRadius: 11, textAlign: 'center',
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                  }}>
                    <Icon size={13} color={color} style={{ margin: '0 auto 4px' }} />
                    <div className="stat-value" style={{ color: '#f4f4f5' }}>{value}</div>
                    <div style={{ fontSize: 8.5, color: '#52525b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ══ RIGHT COLUMN: HUD Panel ══════════════════════════ */}
          <div className="hud-panel">

            {/* Active Set Card */}
            {isSessionActive && (
              <div className="active-set-card">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 8, fontWeight: 800, color: '#52525b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                    {selectedMeta?.isTimed ? '⏱ Hold Time' : '💪 Set Reps'}
                  </div>
                  <RepCounter
                    count={repCount}
                    exercise={activeExercise}
                    state={currentState}
                    currentSet={currentSet}
                    setsCompleted={setsCompleted}
                    formScore={formScore}
                  />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 8, fontWeight: 800, color: '#52525b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                    📐 Form Quality
                  </div>
                  <FormScoreGauge score={formScore} size={110} />
                </div>
              </div>
            )}

            {/* AI Analysis HUD */}
            <div style={{ borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', padding: '13px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 11 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(99,102,241,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Brain size={12} color="#818cf8" />
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: '#6366f1', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  AI Real-Time Analysis
                </span>
              </div>
              <AIAnalysisHUD
                angles={angles} formScore={formScore} currentState={currentState}
                exercise={activeExercise} isDetected={isDetected}
                isSessionActive={isSessionActive} repCount={repCount}
              />
            </div>

            {/* Set History */}
            {isSessionActive && (
              <div style={{ borderRadius: 14, padding: '13px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: '#52525b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                  Set History
                </div>
                {localSetHistory.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#3f3f46', fontStyle: 'italic', padding: '8px 0', textAlign: 'center' }}>
                    Complete a set to see history
                  </div>
                ) : (
                  <>
                    {/* Sparkline */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 28, marginBottom: 10 }}>
                      {localSetHistory.map(s => {
                        const h = Math.round((s.avgScore / 100) * 100);
                        const c = s.avgScore >= 80 ? '#22c55e' : s.avgScore >= 60 ? '#f59e0b' : '#ef4444';
                        return <div key={s.setNum} className="sparkline-bar" title={`Set ${s.setNum}: ${s.avgScore}% form`} style={{ background: c, height: `${h}%` }} />;
                      })}
                    </div>
                    <table className="set-history-table">
                      <thead><tr><th>Set</th><th>Reps</th><th>Form</th><th>RPE</th></tr></thead>
                      <tbody>
                        {localSetHistory.map(s => (
                          <tr key={s.setNum}>
                            <td>#{s.setNum}</td>
                            <td style={{ fontVariantNumeric: 'tabular-nums' }}>{s.reps}</td>
                            <td><span style={{ color: s.avgScore >= 80 ? '#22c55e' : s.avgScore >= 60 ? '#f59e0b' : '#ef4444' }}>{s.avgScore}%</span></td>
                            <td style={{ color: '#71717a' }}>{s.effortRating > 0 ? `${s.effortRating}/10` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            )}

            {/* Exercise Info */}
            {selectedMeta && (
              <div style={{ borderRadius: 14, padding: '13px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', marginBottom: 5 }}>Target Muscles</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 9 }}>
                  {selectedMeta.muscles.map(m => (
                    <span key={m} style={{ fontSize: 9.5, padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', color: '#a1a1aa' }}>{m}</span>
                  ))}
                </div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', marginBottom: 4 }}>Coach Tip</div>
                <p style={{ margin: 0, fontSize: 11, color: '#71717a', lineHeight: 1.55 }}>{selectedMeta.tip}</p>
              </div>
            )}

            {/* Done this session */}
            {exercisesThisSession.length > 0 && (
              <div style={{ borderRadius: 12, padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#52525b', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>🏆 Done This Session</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {exercisesThisSession.map(ex => {
                    const meta = EXERCISE_CATALOGUE.find(e => e.id === ex);
                    return (
                      <span key={ex} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.18)', color: '#4ade80' }}>
                        {meta?.emoji} {meta?.displayName ?? ex.replace(/_/g, ' ')}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Onboarding hint */}
            {!cameraOn && !isSessionActive && (
              <div style={{ borderRadius: 14, padding: '18px 14px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 26, marginBottom: 8 }}>🚀</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e4e4e7', marginBottom: 5 }}>Ready to train?</div>
                <div style={{ fontSize: 10.5, color: '#52525b', lineHeight: 1.75, marginBottom: 12 }}>
                  1. Set session goal<br />
                  2. Enable camera<br />
                  3. Pick exercise<br />
                  4. Start — AI does the rest
                </div>
                <button onClick={startCamera} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 12, fontWeight: 700,
                }}>
                  <Camera size={13} /> Get Started
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
