import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { login } from '../store/authSlice';
import { motion } from 'framer-motion';
import { Zap, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { loading, error } = useSelector((s: RootState) => s.auth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await dispatch(login(form));
    if (login.fulfilled.match(result)) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-glow-green opacity-20 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-10 h-10 bg-brand-gradient rounded-xl flex items-center justify-center shadow-glow-green">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <span className="font-display font-bold text-2xl text-white">FitMentor AI</span>
        </div>

        <div className="card">
          <h1 className="font-display font-bold text-2xl text-white mb-2">Welcome Back</h1>
          <p className="text-gray-400 text-sm mb-6">Sign in to continue your training.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 w-4 h-4 text-gray-500" />
                <input
                  id="login-email"
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
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Your password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input-field pl-10 pr-10"
                  required
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-3.5 text-gray-500 hover:text-gray-300">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</p>
            )}

            <button id="login-submit" type="submit" className="btn-primary w-full justify-center" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium">
              Create one free
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
