import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { createProfile } from '../store/authSlice';
import { motion } from 'framer-motion';
import { User, Mail, Calendar, Target, Dumbbell, Flame, Scale, Save, CheckCircle } from 'lucide-react';

export default function Profile() {
  const user = useSelector((s: RootState) => s.auth.user);
  const profile = useSelector((s: RootState) => s.auth.profile);
  const dispatch = useDispatch<AppDispatch>();

  const [form, setForm] = useState({
    age: profile?.age || 25,
    gender: profile?.gender || 'male',
    height_cm: profile?.height_cm || 175,
    weight_kg: profile?.weight_kg || 75,
    goal: profile?.goal || 'general_fitness',
    experience: profile?.experience || 'beginner',
  });
  const [saved, setSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await dispatch(createProfile(form as any));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const goalLabels: Record<string, string> = {
    weight_loss: 'Weight Loss', muscle_gain: 'Muscle Gain',
    endurance: 'Endurance', strength: 'Strength',
    flexibility: 'Flexibility', general_fitness: 'General Fitness',
  };

  return (
    <div className="flex-1 p-6 space-y-6">
      <div>
        <h1 className="font-display font-bold text-3xl text-white">Profile</h1>
        <p className="text-gray-400 mt-1">Manage your account and fitness profile</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Info */}
        <div className="card text-center">
          <div className="w-20 h-20 rounded-2xl bg-brand-gradient flex items-center justify-center mx-auto mb-4 shadow-glow-green text-3xl font-bold text-white">
            {user?.full_name?.charAt(0).toUpperCase()}
          </div>
          <h2 className="font-display font-bold text-xl text-white">{user?.full_name}</h2>
          <p className="text-gray-400 text-sm mt-1">{user?.email}</p>
          <div className="mt-4 space-y-2">
            {profile && (
              <>
                <div className="badge-green justify-center">
                  <Target className="w-3.5 h-3.5" />
                  {goalLabels[profile.goal] || profile.goal}
                </div>
                <div className="flex justify-center gap-4 mt-4 text-sm">
                  <div className="text-center">
                    <p className="font-bold text-2xl text-brand-400">{profile.bmi?.toFixed(1)}</p>
                    <p className="text-gray-500">BMI</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-2xl text-accent-400">{profile.daily_calories}</p>
                    <p className="text-gray-500">kcal/day</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-2xl text-orange-400">{profile.training_days_per_week}</p>
                    <p className="text-gray-500">days/week</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Fitness Profile Form */}
        <div className="lg:col-span-2 card">
          <h2 className="font-semibold text-white text-lg mb-6 flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-brand-400" />
            Fitness Profile
          </h2>
          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Age</label>
                <input type="number" value={form.age} min={13} max={100}
                  onChange={(e) => setForm({ ...form, age: +e.target.value })}
                  className="input-field" />
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
                <label className="label flex items-center gap-1.5"><Scale className="w-3.5 h-3.5" />Height (cm)</label>
                <input type="number" value={form.height_cm} min={100} max={250}
                  onChange={(e) => setForm({ ...form, height_cm: +e.target.value })}
                  className="input-field" />
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><Scale className="w-3.5 h-3.5" />Weight (kg)</label>
                <input type="number" value={form.weight_kg} min={30} max={300}
                  onChange={(e) => setForm({ ...form, weight_kg: +e.target.value })}
                  className="input-field" />
              </div>
            </div>

            <div>
              <label className="label flex items-center gap-1.5"><Target className="w-3.5 h-3.5" />Fitness Goal</label>
              <select value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })}
                className="input-field">
                {Object.entries(goalLabels).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
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

            <button id="save-profile" type="submit" className="btn-primary w-full justify-center">
              {saved ? (
                <><CheckCircle className="w-4 h-4" /> Profile Saved!</>
              ) : (
                <><Save className="w-4 h-4" /> Save Profile</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
