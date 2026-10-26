import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import Sidebar from './components/layout/Sidebar';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import WorkoutSession from './pages/WorkoutSession';
import Coach from './pages/Coach';
import Analytics from './pages/Analytics';
import Profile from './pages/Profile';

// Protected layout with sidebar
function AppLayout() {
  const isAuth = useSelector((s: RootState) => s.auth.isAuthenticated);
  if (!isAuth) return <Navigate to="/login" replace />;
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-h-screen overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

// Redirect logged-in users away from auth pages
function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuth = useSelector((s: RootState) => s.auth.isAuthenticated);
  if (isAuth) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthGuard><Login /></AuthGuard>} />
        <Route path="/register" element={<AuthGuard><Register /></AuthGuard>} />

        {/* Protected */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/workout" element={<WorkoutSession />} />
          <Route path="/coach" element={<Coach />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
