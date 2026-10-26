import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { login, register, createProfile } from '../store/authSlice';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Mail, Lock, User, Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';

// ── Step 1: Register Form ────────────────────────────────────────────────────
function RegisterStep({ onNext }: { onNext: (data: any) => void }) {
  const [form, setForm] = useState({ email: '', password: '', full_name: '' });
  const [showPass, setShowPass] = useState(false);
  const { loading, error } = useSelector((s: RootState) => s.auth);
  const dispatch = useDispatch<AppDispatch>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await dispatch(register(form));
    if (register.fulfilled.match(result)) {
      onNext(form);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="label">Full Name</label>
        <div className="relative">
          <User className="absolute left-3 top-3.5 w-4 h-4 text-gray-500" />
          <input
            id="reg-name"
            type="text"
            placeholder="John Doe"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="input-field pl-10"
            required
          />
        </div>
      </div>
      <div>
        <label className="label">Email</label>
        <div className="relative">
          <Mail className="absolute left-3 top-3.5 w-4 h-4 text-gray-500" />
          <input
            id="reg-email"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="input-field pl-10"
            required
          />
        </div>
      </div>
      <div>
        <label className="label">Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-3.5 w-4 h-4 text-gray-500" />
          <input
            id="reg-password"
            type={showPass ? 'text' : 'password'}
            placeholder="Min 6 characters"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="input-field pl-10 pr-10"
            required
            minLength={6}
          />
          <button type="button" onClick={() => setShowPass(!showPass)}
            className="absolute right-3 top-3.5 text-gray-500 hover:text-gray-300">
            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</p>}
      <button id="reg-submit" type="submit" className="btn-primary w-full justify-center" disabled={loading}>
        {loading ? 'Creating Account...' : 'Create Account'}
        <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  );
}

// ── Step 2: Fitness Assessment ───────────────────────────────────────────────
function AssessmentStep({ onComplete }: { onComplete: () => void }) {
  const [form, setForm] = useState({
    age: 25, gender: 'male', height_cm: 175, weight_kg: 75,
    goal: 'general_fitness', experience: 'beginner',
  });
  const dispatch = useDispatch<AppDispatch>();
  const { loading } = useSelector((s: RootState) => s.auth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await dispatch(createProfile(form as any));
    if (createProfile.fulfilled.match(result)) {
      onComplete();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Age</label>
          <input type="number" value={form.age} min={13} max={100}
            onChange={(e) => setForm({ ...form, age: +e.target.value })}
            className="input-field" required />
        </div>
        <div>
          <label className="label">Gender</label>
          <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}
            className="input-field">
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="label">Height (cm)</label>
          <input type="number" value={form.height_cm} min={100} max={250}
            onChange={(e) => setForm({ ...form, height_cm: +e.target.value })}
            className="input-field" required />
        </div>
        <div>
          <label className="label">Weight (kg)</label>
          <input type="number" value={form.weight_kg} min={30} max={300}
            onChange={(e) => setForm({ ...form, weight_kg: +e.target.value })}
            className="input-field" required />
        </div>
      </div>
      <div>
        <label className="label">Fitness Goal</label>
        <select value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })}
          className="input-field">
          <option value="weight_loss">Weight Loss</option>
          <option value="muscle_gain">Muscle Gain</option>
          <option value="endurance">Endurance</option>
          <option value="strength">Strength</option>
          <option value="flexibility">Flexibility</option>
          <option value="general_fitness">General Fitness</option>
        </select>
      </div>
      <div>
        <label className="label">Experience Level</label>
        <div className="grid grid-cols-3 gap-3">
          {['beginner', 'intermediate', 'advanced'].map((lvl) => (
            <button key={lvl} type="button"
              onClick={() => setForm({ ...form, experience: lvl })}
              className={`py-2.5 rounded-xl text-sm font-medium capitalize border transition-all ${
                form.experience === lvl
                  ? 'bg-brand-500 border-brand-400 text-white'
                  : 'border-dark-400 text-gray-400 hover:border-brand-600 hover:text-white'
              }`}>
              {lvl}
            </button>
          ))}
        </div>
      </div>
      <button id="assessment-submit" type="submit" className="btn-primary w-full justify-center" disabled={loading}>
        {loading ? 'Saving Profile...' : 'Complete Setup'}
        <CheckCircle className="w-4 h-4" />
      </button>
    </form>
  );
}

// ── Register Page ────────────────────────────────────────────────────────────
export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 bg-glow-green opacity-20 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-10 h-10 bg-brand-gradient rounded-xl flex items-center justify-center shadow-glow-green">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <span className="font-display font-bold text-2xl text-white">FitMentor AI</span>
        </div>

        <div className="card">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-6">
            {['Account', 'Fitness Profile'].map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i <= step ? 'bg-brand-500 text-white' : 'bg-dark-600 text-gray-500'
                }`}>
                  {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-sm ${i <= step ? 'text-white font-medium' : 'text-gray-500'}`}>{s}</span>
                {i < 1 && <div className={`flex-1 h-px ${i < step ? 'bg-brand-500' : 'bg-dark-400'}`} />}
              </div>
            ))}
          </div>

          <h1 className="font-display font-bold text-2xl text-white mb-2">
            {step === 0 ? 'Create Your Account' : 'Fitness Assessment'}
          </h1>
          <p className="text-gray-400 text-sm mb-6">
            {step === 0 ? 'Join FitMentor AI for free.' : "Tell us about yourself to personalize your training."}
          </p>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: step === 0 ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
            >
              {step === 0 ? (
                <RegisterStep onNext={() => setStep(1)} />
              ) : (
                <AssessmentStep onComplete={() => navigate('/dashboard')} />
              )}
            </motion.div>
          </AnimatePresence>

          {step === 0 && (
            <p className="text-center text-gray-500 text-sm mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">Sign in</Link>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
