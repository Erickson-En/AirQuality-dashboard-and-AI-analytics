// src/components/Sidebar.js
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { path: '/dashboard',  label: 'Dashboard',    icon: '▦',  title: 'Overview' },
  { path: '/real-time',  label: 'Real-Time',    icon: '◎',  title: 'Live Feed' },
  { path: '/historical', label: 'Historical',   icon: '⊞',  title: 'Trends' },
  { path: '/analytics',  label: 'Analytics',    icon: '✦',  title: 'AI Analytics' },
  { path: '/settings',   label: 'Settings',     icon: '⚙',  title: 'Configuration' },
];

// Admin-only nav item shown conditionally below
const ADMIN_NAV = { path: '/admin', label: 'Admin Panel', icon: '🛡', title: 'Admin Control Panel' };

export default function Sidebar() {
  const loc = useLocation();
  const { user, logout, isAdmin } = useAuth() || {};
  const isActive = (path) => loc.pathname === path;
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="brand">
        <div className="logo" aria-hidden="true" />
        <h1>
          AirQuality
          <span>Pro Monitor</span>
        </h1>
      </div>

      {/* Navigation */}
      <span className="nav-label">Navigation</span>
      <nav className="nav" aria-label="Main navigation">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={isActive(item.path) ? 'active' : ''}
            title={item.title}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        ))}

        {/* Admin Panel — only visible to users with role=admin */}
        {isAdmin && (
          <>
            <div style={{
              margin: '12px 8px 6px',
              borderTop: '1px solid rgba(255,255,255,0.07)',
              paddingTop: 10,
            }}>
              <span style={{ fontSize: 10, opacity: 0.4, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 8px' }}>
                Admin
              </span>
            </div>
            <Link
              to={ADMIN_NAV.path}
              className={isActive(ADMIN_NAV.path) ? 'active' : ''}
              title={ADMIN_NAV.title}
              style={{
                background: isActive(ADMIN_NAV.path)
                  ? 'linear-gradient(135deg,rgba(124,58,237,0.3),rgba(167,139,250,0.15))'
                  : 'transparent',
                borderLeft: isActive(ADMIN_NAV.path) ? '3px solid #a78bfa' : '3px solid transparent',
              }}
            >
              <span className="nav-icon" aria-hidden="true">{ADMIN_NAV.icon}</span>
              {ADMIN_NAV.label}
            </Link>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {/* Live clock */}
        <div className="sidebar-footer-item" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, letterSpacing: '0.05em', opacity: 0.5 }}>LOCAL TIME</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 600 }}>
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        {/* System status */}
        <div className="sidebar-footer-item">
          <span className="status-dot" />
          <span>System Online</span>
        </div>

        {/* Logged-in user */}
        {user && (
          <div
            className="sidebar-footer-item"
            style={{ justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={logout}
            title="Click to sign out"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
              {isAdmin && (
                <span style={{
                  fontSize: 9, padding: '1px 5px', borderRadius: 4,
                  background: 'rgba(167,139,250,0.2)', color: '#a78bfa',
                  border: '1px solid rgba(167,139,250,0.4)', fontWeight: 700,
                  letterSpacing: '0.04em', flexShrink: 0,
                }}>ADMIN</span>
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email || user.username || 'User'}
              </span>
            </div>
            <span style={{ opacity: 0.5, fontSize: 11 }}>Sign out</span>
          </div>
        )}

        <div className="sidebar-footer-item" style={{ marginTop: 6 }}>
          <span style={{ fontSize: 10, opacity: 0.3, letterSpacing: '0.04em' }}>
            v1.2 · Nairobi, Kenya
          </span>
        </div>
      </div>
    </aside>
  );
}
