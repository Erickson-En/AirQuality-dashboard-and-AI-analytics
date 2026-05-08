// src/App.js
import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import FullDashboard from './pages/FullDashboard';
import RealTimeData from './pages/RealTimeData';
import HistoricalData from './pages/HistoricalData';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import AdminPanel from './pages/AdminPanel';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AIChatbot from './components/AIChatbot';
import { AuthProvider, useAuth } from './context/AuthContext';
import './index.css';

/* ── Route guards ──────────────────────────────────────────────────────────── */

/** Redirects to /login if the user is not authenticated. */
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

/**
 * Redirects to /dashboard if the user is authenticated but is not an admin.
 * A non-admin who somehow navigates to /admin gets bounced back to the dashboard.
 */
const AdminRoute = ({ children }) => {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
};

/* ── Layout wrapper (applies sidebar/header on non-auth pages) ─────────────── */
const AuthLayout = ({ children }) => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';
  if (isAuthPage) return children;
  return (
    <Layout>
      {children}
      <AIChatbot />
    </Layout>
  );
};

/* ── App ───────────────────────────────────────────────────────────────────── */
function App() {
  return (
    <AuthProvider>
      <AuthLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route path="/dashboard" element={<ProtectedRoute><FullDashboard /></ProtectedRoute>} />
          <Route path="/real-time" element={<ProtectedRoute><RealTimeData /></ProtectedRoute>} />
          <Route path="/historical" element={<ProtectedRoute><HistoricalData /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/settings"  element={<ProtectedRoute><Settings /></ProtectedRoute>} />

          {/* Admin-only route — non-admins are redirected to /dashboard */}
          <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
        </Routes>
      </AuthLayout>
    </AuthProvider>
  );
}

export default App;
