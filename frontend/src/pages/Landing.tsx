import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Zap, Camera, Brain, BarChart3, Shield, Play,
  CheckCircle, Star, ArrowRight, Activity, Users,
  Target, Dumbbell, Timer, TrendingUp, ChevronRight,
} from 'lucide-react';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Exercises', href: '#exercises' },
];

const FEATURES = [
  {
    icon: Camera,
    title: 'Real-Time Pose Detection',
    desc: 'MediaPipe tracks 33 body landmarks at 30fps in your browser. No uploads, no lag — 100% private.',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.1)',
  },
  {
    icon: Target,
    title: 'Zero-Hallucination Tracking',
    desc: 'Choose your exercise and the AI locks on. No false reps, no wrong exercise detection — ever.',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.1)',
  },
  {
    icon: Brain,
    title: 'AI Fitness Coach',
    desc: 'Gemini 2.0 Flash + Groq LLaMA3 answer questions about form, nutrition, and recovery in seconds.',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.1)',
  },
  {
    icon: Shield,
    title: 'Injury Prevention',
    desc: 'Real-time form corrections catch dangerous movement patterns before they cause injury.',
    color: '#f87171',
    bg: 'rgba(248,113,113,0.1)',
  },
  {
    icon: BarChart3,
    title: 'Deep Progress Analytics',
    desc: 'Every rep, session, calorie, and form score tracked. See exactly how you\'re improving over time.',
    color: '#38bdf8',
    bg: 'rgba(56,189,248,0.1)',
  },
  {
    icon: Star,
    title: 'Custom Exercises',
    desc: 'Create your own exercises with custom muscle groups, difficulty, and coaching cues. AI tracks them.',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.1)',
  },
];

const EXERCISES = [
  { name: 'Squat', emoji: '🏋️', muscles: 'Quads · Glutes' },
  { name: 'Push-up', emoji: '🤸', muscles: 'Chest · Triceps' },
  { name: 'Deadlift', emoji: '🏗️', muscles: 'Hamstrings · Back' },
  { name: 'Bicep Curl', emoji: '💪', muscles: 'Biceps · Forearms' },
  { name: 'Plank', emoji: '🧘', muscles: 'Core · Shoulders' },
  { name: 'Pull-up', emoji: '🧗', muscles: 'Lats · Biceps' },
  { name: 'Lunge', emoji: '🦵', muscles: 'Quads · Glutes' },
  { name: 'Shoulder Press', emoji: '🏋️', muscles: 'Deltoids · Triceps' },
  { name: 'Burpee', emoji: '💥', muscles: 'Full Body' },
  { name: 'Glute Bridge', emoji: '🌉', muscles: 'Glutes · Hamstrings' },
  { name: 'Tricep Dip', emoji: '💺', muscles: 'Triceps · Delts' },
  { name: 'Mountain Climber', emoji: '🏔️', muscles: 'Core · Cardio' },
];

const STEPS = [
  { n: '01', title: 'Create your account', desc: 'Sign up free — no credit card needed.', icon: Users },
  { n: '02', title: 'Choose your exercise', desc: 'Pick from 24+ exercises or create your own.', icon: Dumbbell },
  { n: '03', title: 'Enable your camera', desc: 'Allow webcam access — everything runs privately in your browser.', icon: Camera },
  { n: '04', title: 'Start training', desc: 'AI counts reps, checks form, and coaches you in real time.', icon: Activity },
];

const STATS = [
  { value: '24+', label: 'Exercises', icon: Dumbbell },
  { value: '33', label: 'Landmarks Tracked', icon: Target },
  { value: '30fps', label: 'Detection Speed', icon: Timer },
  { value: '100%', label: 'Private (in-browser)', icon: Shield },
];

const TESTIMONIALS = [
  { name: 'Ahmed K.', role: 'Home Gym Athlete', text: 'Finally a trainer that tells me exactly what I\'m doing wrong in real time. My squat form improved massively in two weeks.', rating: 5 },
  { name: 'Priya M.', role: 'Fitness Enthusiast', text: 'The focused mode is a game changer. When I select push-ups, it ONLY tracks push-ups. No false reps at all.', rating: 5 },
  { name: 'Carlos R.', role: 'Personal Trainer', text: 'I recommend FitMentor to clients who train at home. The form corrections are as good as what I\'d say in person.', rating: 5 },
];

export default function Landing() {
  return (
    <div style={{ minHeight: '100vh', background: '#030712', overflowX: 'hidden' }}>

      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, width: '100%', zIndex: 50,
        background: 'rgba(3,7,18,0.85)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(34,197,94,0.4)',
            }}>
              <Zap size={18} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: 17, color: '#f4f4f5', letterSpacing: '-0.02em' }}>
              FitMentor <span style={{ color: '#22c55e' }}>AI</span>
            </span>
          </div>

          {/* Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href} style={{
                fontSize: 14, fontWeight: 500, color: '#71717a', textDecoration: 'none',
                transition: 'color 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.color = '#f4f4f5')}
                onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}
              >
                {l.label}
              </a>
            ))}
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/login" style={{
              padding: '8px 18px', borderRadius: 10,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#e4e4e7', fontSize: 13.5, fontWeight: 600, textDecoration: 'none',
              transition: 'all 0.15s',
            }}>
              Sign In
            </Link>
            <Link to="/register" style={{
              padding: '8px 18px', borderRadius: 10,
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              color: '#fff', fontSize: 13.5, fontWeight: 700, textDecoration: 'none',
              boxShadow: '0 4px 15px rgba(34,197,94,0.3)',
            }}>
              Start Free →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section style={{ padding: '140px 24px 100px', position: 'relative', overflow: 'hidden' }}>
        {/* BG glows */}
        <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, background: 'radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '20%', right: '5%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '6px 16px', borderRadius: 20, marginBottom: 28,
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
            }}>
              <Zap size={13} color="#22c55e" />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#4ade80', letterSpacing: '0.02em' }}>
                Powered by Gemini AI + MediaPipe — runs 100% in your browser
              </span>
            </div>

            <h1 style={{
              fontSize: 'clamp(42px, 7vw, 80px)',
              fontWeight: 900,
              color: '#f4f4f5',
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
              marginBottom: 24,
            }}>
              Your Personal AI
              <br />
              <span style={{
                background: 'linear-gradient(135deg, #22c55e 0%, #4ade80 50%, #6366f1 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                Fitness Trainer
              </span>
            </h1>

            <p style={{
              fontSize: 'clamp(16px, 2.5vw, 21px)',
              color: '#71717a', lineHeight: 1.65,
              maxWidth: 640, margin: '0 auto 40px',
            }}>
              Real-time pose detection, automatic rep counting, live form correction,
              and personalized AI coaching — all from your webcam. Free to start.
            </p>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
              <Link to="/register" style={{
                display: 'inline-flex', alignItems: 'center', gap: 9,
                padding: '15px 34px', borderRadius: 14,
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                color: '#fff', fontSize: 16, fontWeight: 800, textDecoration: 'none',
                boxShadow: '0 8px 30px rgba(34,197,94,0.4)',
              }}>
                <Play size={18} fill="#fff" /> Start Training Free
                <ArrowRight size={16} />
              </Link>
              <Link to="/login" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '15px 28px', borderRadius: 14,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                color: '#e4e4e7', fontSize: 16, fontWeight: 700, textDecoration: 'none',
              }}>
                Sign In
              </Link>
            </div>

            <p style={{ fontSize: 13, color: '#3f3f46' }}>
              No credit card required · Works with any webcam · Private by design
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '28px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, textAlign: 'center' }}>
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
            >
              <div style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 900, color: '#f4f4f5', lineHeight: 1, marginBottom: 6 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 13, color: '#52525b', fontWeight: 500 }}>{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: '100px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 900, color: '#f4f4f5', letterSpacing: '-0.02em', marginBottom: 12 }}>
              Get started in 4 steps
            </h2>
            <p style={{ color: '#71717a', fontSize: 16 }}>From sign-up to first rep in under 2 minutes</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            {STEPS.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.12 }}
                viewport={{ once: true }}
                style={{
                  padding: '28px 24px',
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 18,
                  position: 'relative',
                }}
              >
                <div style={{
                  fontSize: 11, fontWeight: 800, color: '#6366f1',
                  letterSpacing: '0.1em', marginBottom: 14,
                }}>
                  STEP {step.n}
                </div>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, marginBottom: 16,
                  background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <step.icon size={20} color="#818cf8" />
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#f4f4f5', marginBottom: 8 }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: 13, color: '#71717a', lineHeight: 1.6 }}>{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" style={{ padding: '100px 24px', background: 'rgba(255,255,255,0.015)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 900, color: '#f4f4f5', letterSpacing: '-0.02em', marginBottom: 12 }}>
              Everything you need to train smart
            </h2>
            <p style={{ color: '#71717a', fontSize: 16 }}>No trainer. No gym. Just results.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                viewport={{ once: true }}
                whileHover={{ y: -3 }}
                style={{
                  padding: '24px',
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 18,
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = `${f.color}40`)}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)')}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 12, marginBottom: 16,
                  background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <f.icon size={22} color={f.color} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f4f4f5', marginBottom: 8 }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: 13.5, color: '#71717a', lineHeight: 1.65 }}>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Exercises ────────────────────────────────────────────────────── */}
      <section id="exercises" style={{ padding: '100px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 900, color: '#f4f4f5', letterSpacing: '-0.02em', marginBottom: 12 }}>
              24+ exercises — and growing
            </h2>
            <p style={{ color: '#71717a', fontSize: 16 }}>All tracked with AI precision. Add your own custom exercises too.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
            {EXERCISES.map((ex, i) => (
              <motion.div
                key={ex.name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.04, y: -2 }}
                style={{
                  padding: '16px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 14,
                  display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'default',
                }}
              >
                <span style={{ fontSize: 22 }}>{ex.emoji}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#e4e4e7' }}>{ex.name}</div>
                  <div style={{ fontSize: 10.5, color: '#52525b', marginTop: 1 }}>{ex.muscles}</div>
                </div>
              </motion.div>
            ))}
            {/* + Custom */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              viewport={{ once: true }}
              style={{
                padding: '16px 14px',
                background: 'rgba(99,102,241,0.06)',
                border: '1px dashed rgba(99,102,241,0.3)',
                borderRadius: 14,
                display: 'flex', alignItems: 'center', gap: 10,
              }}
            >
              <span style={{ fontSize: 22 }}>⭐</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#a5b4fc' }}>Your Custom</div>
                <div style={{ fontSize: 10.5, color: '#6366f1', marginTop: 1 }}>Add your own →</div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px', background: 'rgba(255,255,255,0.015)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontSize: 'clamp(24px,3.5vw,38px)', fontWeight: 900, color: '#f4f4f5', letterSpacing: '-0.02em', marginBottom: 8 }}>
              Real athletes. Real results.
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.12 }}
                viewport={{ once: true }}
                style={{
                  padding: '24px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 18,
                }}
              >
                <div style={{ display: 'flex', gap: 2, marginBottom: 14 }}>
                  {Array(t.rating).fill(0).map((_, j) => (
                    <Star key={j} size={14} color="#fbbf24" fill="#fbbf24" />
                  ))}
                </div>
                <p style={{ fontSize: 13.5, color: '#a1a1aa', lineHeight: 1.65, marginBottom: 16 }}>
                  "{t.text}"
                </p>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f4f4f5' }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: '#52525b' }}>{t.role}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section style={{ padding: '100px 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            style={{
              padding: '60px 40px',
              background: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(99,102,241,0.08) 100%)',
              border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: 24,
            }}
          >
            <div style={{
              width: 64, height: 64, borderRadius: 18, margin: '0 auto 24px',
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 40px rgba(34,197,94,0.4)',
            }}>
              <Zap size={28} color="#fff" />
            </div>
            <h2 style={{ fontSize: 'clamp(24px,4vw,36px)', fontWeight: 900, color: '#f4f4f5', letterSpacing: '-0.02em', marginBottom: 14 }}>
              Ready to train smarter?
            </h2>
            <p style={{ color: '#71717a', fontSize: 16, marginBottom: 32, lineHeight: 1.6 }}>
              Join athletes using FitMentor AI to train with precision, prevent injury, and reach their goals faster.
            </p>
            <Link to="/register" style={{
              display: 'inline-flex', alignItems: 'center', gap: 9,
              padding: '16px 40px', borderRadius: 14,
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              color: '#fff', fontSize: 16, fontWeight: 800, textDecoration: 'none',
              boxShadow: '0 8px 30px rgba(34,197,94,0.4)',
            }}>
              <Zap size={18} /> Start Your Free Trial
              <ChevronRight size={16} />
            </Link>
            <p style={{ fontSize: 12, color: '#3f3f46', marginTop: 16 }}>
              Free forever · No credit card · Cancel anytime
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '36px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={13} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: 14, color: '#52525b' }}>FitMentor AI</span>
          </div>
          <div style={{ fontSize: 12.5, color: '#3f3f46', textAlign: 'center' }}>
            © 2026 FitMentor AI. Built with Gemini 2.0 Flash · Groq LLaMA3 · MediaPipe.
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {['Privacy', 'Terms', 'Contact'].map(l => (
              <a key={l} href="#" style={{ fontSize: 13, color: '#52525b', textDecoration: 'none' }}>{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
