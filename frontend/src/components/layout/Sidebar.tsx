import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { logout } from '../../store/authSlice';
import {
  LayoutDashboard, Dumbbell, BarChart3, MessageSquare,
  User, LogOut, Zap, Menu, X, Play,
} from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', color: '#22c55e' },
  { path: '/workout',   icon: Dumbbell,        label: 'Workout',   color: '#6366f1' },
  { path: '/analytics', icon: BarChart3,        label: 'Analytics', color: '#38bdf8' },
  { path: '/coach',     icon: MessageSquare,    label: 'AI Coach',  color: '#a78bfa' },
  { path: '/profile',   icon: User,             label: 'Profile',   color: '#f59e0b' },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const user      = useSelector((s: RootState) => s.auth.user);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  const initials = user?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '20px 20px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px rgba(34,197,94,0.35)',
          flexShrink: 0,
        }}>
          <Zap size={18} color="#fff" />
        </div>
        <div>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#f4f4f5', letterSpacing: '-0.02em' }}>
            FitMentor <span style={{ color: '#22c55e' }}>AI</span>
          </span>
          <div style={{ fontSize: 9.5, color: '#3f3f46', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 1 }}>
            AI Fitness Trainer
          </div>
        </div>
      </div>

      {/* Quick Start Button */}
      <div style={{ padding: '14px 14px 6px' }}>
        <Link
          to="/workout"
          onClick={() => setMobileOpen(false)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px', borderRadius: 12, textDecoration: 'none',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            color: '#fff', fontWeight: 700, fontSize: 13.5,
            boxShadow: '0 4px 16px rgba(34,197,94,0.3)',
            transition: 'all 0.2s',
          }}
        >
          <Play size={14} fill="#fff" /> Start Workout
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
        <div style={{ marginBottom: 6, padding: '2px 10px' }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: '#3f3f46', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Navigation
          </span>
        </div>
        {navItems.map(({ path, icon: Icon, label, color }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              onClick={() => setMobileOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 10, marginBottom: 2,
                textDecoration: 'none', position: 'relative', overflow: 'hidden',
                background: active ? `${color}15` : 'transparent',
                border: active ? `1px solid ${color}30` : '1px solid transparent',
                color: active ? color : '#71717a',
                fontWeight: active ? 700 : 500,
                fontSize: 13.5,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                if (!active) (e.currentTarget as HTMLElement).style.color = '#e4e4e7';
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                if (!active) (e.currentTarget as HTMLElement).style.color = '#71717a';
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: active ? `${color}20` : 'rgba(255,255,255,0.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={15} color={active ? color : '#71717a'} />
              </div>
              <span>{label}</span>
              {active && (
                <div style={{
                  marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%',
                  background: color, boxShadow: `0 0 8px ${color}`,
                }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{
        padding: '12px 10px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 10, marginBottom: 4,
          background: 'rgba(255,255,255,0.03)',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800, color: '#fff',
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#e4e4e7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.full_name}
            </div>
            <div style={{ fontSize: 10.5, color: '#52525b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
            background: 'transparent', border: '1px solid transparent',
            color: '#71717a', fontSize: 13, fontWeight: 500,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.08)';
            e.currentTarget.style.color = '#f87171';
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#71717a';
            e.currentTarget.style.borderColor = 'transparent';
          }}
        >
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar — hidden on mobile, flex on lg+ */}
      <aside className="hidden lg:flex" style={{
        width: 220, flexShrink: 0,
        background: 'rgba(9,12,20,0.95)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        height: '100vh', position: 'sticky', top: 0,
        flexDirection: 'column',
      }}>
        <SidebarContent />
      </aside>

      {/* Mobile Header — only visible below lg */}
      <header className="lg:hidden flex items-center justify-between" style={{
        background: 'rgba(3,7,18,0.97)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '0 16px', height: 52,
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={13} color="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 14, color: '#f4f4f5' }}>
            FitMentor <span style={{ color: '#22c55e' }}>AI</span>
          </span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', padding: 4 }}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.65)' }}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              style={{
                position: 'fixed', top: 0, left: 0, bottom: 0,
                width: 260, zIndex: 50,
                background: '#090c14',
                borderRight: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation — hidden on desktop */}
      <MobileBottomNav />
    </>
  );
}

// ── Mobile Bottom Navigation ──────────────────────────────────
function MobileBottomNav() {
  const location = useLocation();
  const items = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Home',     color: '#6366f1' },
    { path: '/workout',   icon: Dumbbell,        label: 'Workout',  color: '#22c55e' },
    { path: '/analytics', icon: BarChart3,        label: 'Stats',    color: '#38bdf8' },
    { path: '/coach',     icon: MessageSquare,    label: 'Coach',    color: '#a78bfa' },
    { path: '/profile',   icon: User,             label: 'Profile',  color: '#f59e0b' },
  ];

  return (
    <nav className="bottom-nav lg:hidden">
      {items.map(({ path, icon: Icon, label, color }) => {
        const active = location.pathname === path;
        const isWorkout = path === '/workout';
        return (
          <Link
            key={path}
            to={path}
            className={`bottom-nav-item ${active ? (isWorkout ? 'active-green' : 'active') : ''}`}
          >
            {active && <div className="nav-dot" style={{ background: color }} />}
            <div className="nav-icon-wrap" style={active ? { background: `${color}18` } : {}}>
              {isWorkout ? (
                <div style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: active ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={15} color={active ? '#fff' : '#52525b'} />
                </div>
              ) : (
                <Icon size={18} color={active ? color : '#52525b'} />
              )}
            </div>
            <span style={{ fontSize: 9.5, letterSpacing: '0.03em' }}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
