// src/pages/AdminPanel.js
// Admin-only control panel: hardware config, user management, system stats.
// Access is blocked at the route level (AdminRoute in App.js) AND at the API
// level (requireAdmin middleware on /api/admin/*).

import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../config/api';
import { useAuth } from '../context/AuthContext';

/* ── shared styles ─────────────────────────────────────────────────────────── */
const card = {
  background: 'var(--card-bg)',
  padding: 24,
  borderRadius: 'var(--card-radius)',
  boxShadow: 'var(--glass-shadow)',
  border: '1px solid var(--glass-border)',
  marginBottom: 20,
};
const inp = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.05)',
  color: '#fff', fontSize: 14, outline: 'none',
  boxSizing: 'border-box',
};
const btn = (color = '#06b6d4', bg = 'rgba(6,182,212,0.12)') => ({
  padding: '8px 18px', borderRadius: 8, border: `1px solid ${color}`,
  background: bg, color, fontWeight: 600, fontSize: 13, cursor: 'pointer',
});

const TABS = ['📊 System Overview', '🔧 Hardware Config', '👥 User Management'];

/* ── Hardware config defaults / meta ────────────────────────────────────────── */
const HW_DEFAULTS = {
  sendIntervalMs: 180000, mq7R0: 5.0, mq131R0: 10.0, rlValue: 10.0,
  tempOffset: 0.0, humOffset: 0.0,
  aqiWarnThreshold: 100, aqiCriticalThreshold: 150, aqiSevereThreshold: 200,
};
const HW_LABELS = {
  sendIntervalMs: 'Telemetry Interval',
  mq7R0: 'MQ-7 R₀ — CO baseline',
  mq131R0: 'MQ-131 R₀ — O₃ baseline',
  rlValue: 'Load Resistor Rₗ',
  tempOffset: 'Temperature Offset',
  humOffset: 'Humidity Offset',
  aqiWarnThreshold: 'AQI Warning Threshold',
  aqiCriticalThreshold: 'AQI Critical Threshold',
  aqiSevereThreshold: 'AQI Severe Threshold',
};
const HW_UNITS = {
  sendIntervalMs: 'ms', mq7R0: 'kΩ', mq131R0: 'kΩ', rlValue: 'kΩ',
  tempOffset: '°C', humOffset: '%',
  aqiWarnThreshold: '', aqiCriticalThreshold: '', aqiSevereThreshold: '',
};
const HW_MIN  = { sendIntervalMs:30000,  mq7R0:0.1,  mq131R0:0.1,  rlValue:0.1, tempOffset:-10, humOffset:-10, aqiWarnThreshold:0,   aqiCriticalThreshold:0,   aqiSevereThreshold:0   };
const HW_MAX  = { sendIntervalMs:900000, mq7R0:100,  mq131R0:100,  rlValue:100, tempOffset:10,  humOffset:10,  aqiWarnThreshold:500, aqiCriticalThreshold:500, aqiSevereThreshold:500 };
const HW_STEP = { sendIntervalMs:1000,   mq7R0:0.1,  mq131R0:0.1,  rlValue:0.1, tempOffset:0.1, humOffset:0.1, aqiWarnThreshold:1,   aqiCriticalThreshold:1,   aqiSevereThreshold:1   };

/* ════════════════════════════════════════════════════════════════════════════ */
export default function AdminPanel() {
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [toast, setToast] = useState(null);

  /* stats */
  const [stats, setStats] = useState(null);

  /* hardware config */
  const [hwConfig, setHwConfig] = useState(HW_DEFAULTS);
  const [hwTwin, setHwTwin]     = useState(null);
  const [hwSaving, setHwSaving] = useState(false);

  /* users */
  const [users, setUsers] = useState([]);
  const [userLoading, setUserLoading] = useState(false);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  /* ── load stats ─────────────────────────────────────────────────── */
  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get('/api/admin/stats');
      setStats(data);
    } catch (err) {
      showToast('Could not load system stats: ' + (err.response?.data?.error || err.message), false);
    }
  }, []);

  /* ── load hardware twin ──────────────────────────────────────────── */
  const loadHwTwin = useCallback(async () => {
    try {
      const { data } = await api.get('/api/admin/device-config');
      setHwTwin(data);
      if (data?.desired) setHwConfig(c => ({ ...c, ...data.desired }));
    } catch (err) {
      showToast('Could not load device config: ' + (err.response?.data?.error || err.message), false);
    }
  }, []);

  /* ── load users ─────────────────────────────────────────────────── */
  const loadUsers = useCallback(async () => {
    setUserLoading(true);
    try {
      const { data } = await api.get('/api/admin/users');
      setUsers(data);
    } catch (err) {
      showToast('Could not load users: ' + (err.response?.data?.error || err.message), false);
    }
    setUserLoading(false);
  }, []);

  useEffect(() => {
    loadStats();
    loadHwTwin();
    const id = setInterval(loadHwTwin, 10000);
    return () => clearInterval(id);
  }, [loadStats, loadHwTwin]);

  useEffect(() => {
    if (tab === 2) loadUsers();
  }, [tab, loadUsers]);

  /* ── push hardware config ───────────────────────────────────────── */
  const pushHwConfig = async () => {
    setHwSaving(true);
    try {
      const { data } = await api.post('/api/admin/device-config', hwConfig);
      setHwTwin(data.config);
      showToast('✅ Hardware config queued — device will apply on next check-in');
    } catch (err) {
      showToast('Failed: ' + (err.response?.data?.error || err.message), false);
    }
    setHwSaving(false);
  };

  /* ── change user role ───────────────────────────────────────────── */
  const changeRole = async (userId, role) => {
    try {
      await api.put(`/api/admin/users/${userId}/role`, { role });
      setUsers(us => us.map(u => u._id === userId ? { ...u, role } : u));
      showToast(`Role updated to "${role}"`);
    } catch (err) {
      showToast('Role update failed: ' + (err.response?.data?.error || err.message), false);
    }
  };

  /* ── delete user ────────────────────────────────────────────────── */
  const deleteUser = async (userId) => {
    if (!window.confirm('Permanently delete this user?')) return;
    try {
      await api.delete(`/api/admin/users/${userId}`);
      setUsers(us => us.filter(u => u._id !== userId));
      showToast('User deleted');
    } catch (err) {
      showToast('Delete failed: ' + (err.response?.data?.error || err.message), false);
    }
  };

  /* ════════════════════ RENDER ════════════════════════════════════ */
  return (
    <div style={{ padding: '0 4px' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 6px 0', fontSize: 28, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800,
            background: 'rgba(239,68,68,0.15)', color: '#ef4444',
            border: '1px solid #ef4444', letterSpacing: '0.06em',
          }}>ADMIN</span>
          🛡️ Admin Control Panel
        </h2>
        <p style={{ margin: 0, opacity: 0.55, fontSize: 14 }}>
          System configuration, device management and user administration.
          Logged in as <strong style={{ color: '#a78bfa' }}>{user?.email}</strong>
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 9999,
          padding: '12px 20px', borderRadius: 10,
          background: toast.ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${toast.ok ? '#10b981' : '#ef4444'}`,
          color: toast.ok ? '#10b981' : '#ef4444',
          fontSize: 14, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 13,
            background: tab === i ? 'linear-gradient(135deg,#7c3aed,#a78bfa)' : 'rgba(255,255,255,0.06)',
            color: tab === i ? '#fff' : 'rgba(255,255,255,0.6)',
            transition: 'all 0.2s',
          }}>{t}</button>
        ))}
      </div>

      {/* ── TAB 0: System Overview ─────────────────────────────────── */}
      {tab === 0 && (
        <div>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 20 }}>
            {[
              { label: 'Total Readings', value: stats?.totalReadings?.toLocaleString() ?? '—', color: '#06b6d4', icon: '📡' },
              { label: 'Total Alerts',   value: stats?.totalAlerts?.toLocaleString()   ?? '—', color: '#f59e0b', icon: '🚨' },
              { label: 'Registered Users', value: stats?.totalUsers ?? '—',                    color: '#10b981', icon: '👥' },
              { label: 'Last Reading',   value: stats?.lastReading ? new Date(stats.lastReading).toLocaleTimeString() : '—', color: '#a78bfa', icon: '🕐' },
            ].map(({ label, value, color, icon }) => (
              <div key={label} style={{ ...card, marginBottom: 0 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: 12, opacity: 0.55, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Device Twin status */}
          {hwTwin && (
            <div style={{ ...card }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>🔌 Device Twin — arduino-001</h3>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{
                  padding: '8px 20px', borderRadius: 20, fontWeight: 700, fontSize: 13,
                  background: hwTwin.status === 'synced' ? 'rgba(16,185,129,0.15)' : hwTwin.status === 'pending' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                  color: hwTwin.status === 'synced' ? '#10b981' : hwTwin.status === 'pending' ? '#f59e0b' : '#ef4444',
                  border: `1px solid ${hwTwin.status === 'synced' ? '#10b981' : hwTwin.status === 'pending' ? '#f59e0b' : '#ef4444'}`,
                }}>
                  {hwTwin.status === 'synced' ? '✅ In Sync' : hwTwin.status === 'pending' ? '⏳ Pending' : '❌ Error'}
                </div>
                {hwTwin.reported?.lastSeenAt && (
                  <span style={{ fontSize: 13, opacity: 0.55 }}>
                    Last seen: {new Date(hwTwin.reported.lastSeenAt).toLocaleString()}
                    {hwTwin.reported.firmwareVersion && ` · FW ${hwTwin.reported.firmwareVersion}`}
                  </span>
                )}
                {!hwTwin.reported?.lastSeenAt && (
                  <span style={{ fontSize: 13, opacity: 0.45 }}>Device has not checked in yet</span>
                )}
              </div>

              {hwTwin.status === 'pending' && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', fontSize: 13, color: '#f59e0b' }}>
                  ⚠️ Config change is queued. It will be applied within {Math.ceil((hwConfig.sendIntervalMs || 180000) / 60000)} min on the next telemetry cycle.
                </div>
              )}
            </div>
          )}

          <div style={{ ...card }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 16 }}>⚡ Quick Actions</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={loadStats} style={btn('#06b6d4')}>🔄 Refresh Stats</button>
              <button onClick={loadHwTwin} style={btn('#a78bfa')}>🔄 Refresh Device Twin</button>
              <button onClick={() => setTab(1)} style={btn('#10b981')}>🔧 Open Hardware Config</button>
              <button onClick={() => setTab(2)} style={btn('#f59e0b')}>👥 Manage Users</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 1: Hardware Config ─────────────────────────────────── */}
      {tab === 1 && (
        <div>
          {/* Sync banner */}
          {hwTwin && (
            <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>🔌 Device Sync Status — arduino-001</div>
                {hwTwin.reported?.lastSeenAt && (
                  <div style={{ fontSize: 12, opacity: 0.5, marginTop: 3 }}>
                    Last seen: {new Date(hwTwin.reported.lastSeenAt).toLocaleString()}
                    {hwTwin.reported.firmwareVersion && ` · FW ${hwTwin.reported.firmwareVersion}`}
                  </div>
                )}
              </div>
              <div style={{
                padding: '6px 16px', borderRadius: 20, fontWeight: 700, fontSize: 13,
                background: hwTwin.status === 'synced' ? 'rgba(16,185,129,0.15)' : hwTwin.status === 'pending' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                color: hwTwin.status === 'synced' ? '#10b981' : hwTwin.status === 'pending' ? '#f59e0b' : '#ef4444',
                border: `1px solid ${hwTwin.status === 'synced' ? '#10b981' : hwTwin.status === 'pending' ? '#f59e0b' : '#ef4444'}`,
              }}>
                {hwTwin.status === 'synced' ? '✅ In Sync' : hwTwin.status === 'pending' ? '⏳ Pending — awaiting device' : '❌ Error'}
              </div>
            </div>
          )}

          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 17 }}>🔧 Hardware Parameters</h3>
              <button onClick={() => setHwConfig(HW_DEFAULTS)} style={btn('rgba(255,255,255,0.4)', 'transparent')}>
                ↺ Reset defaults
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20 }}>
              {Object.keys(HW_DEFAULTS).map(k => {
                const isFloat = HW_STEP[k] < 1;
                const reported = hwTwin?.reported?.[k];
                const isDiff = reported !== undefined && reported !== hwConfig[k];
                return (
                  <div key={k} style={{ padding: 16, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${isDiff ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
                    <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8, opacity: 0.8 }}>
                      {HW_LABELS[k]}
                      {HW_UNITS[k] && <span style={{ opacity: 0.45, fontWeight: 400, marginLeft: 4 }}>({HW_UNITS[k]})</span>}
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="range"
                        min={HW_MIN[k]} max={HW_MAX[k]} step={HW_STEP[k]}
                        value={hwConfig[k]}
                        onChange={e => setHwConfig(c => ({ ...c, [k]: isFloat ? parseFloat(e.target.value) : parseInt(e.target.value) }))}
                        style={{ flex: 1, accentColor: '#a78bfa' }}
                      />
                      <input
                        type="number"
                        min={HW_MIN[k]} max={HW_MAX[k]} step={HW_STEP[k]}
                        value={hwConfig[k]}
                        onChange={e => setHwConfig(c => ({ ...c, [k]: isFloat ? parseFloat(e.target.value) : parseInt(e.target.value) }))}
                        style={{ ...inp, width: 90, textAlign: 'right', padding: '6px 10px' }}
                      />
                    </div>
                    {isDiff && (
                      <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                        <span>⚠ Device currently: <strong>{reported}</strong></span>
                        <span style={{ opacity: 0.5 }}>Desired: {hwConfig[k]}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <button onClick={pushHwConfig} disabled={hwSaving} style={{
                padding: '12px 28px', fontSize: 15, fontWeight: 700, borderRadius: 10,
                cursor: 'pointer', border: 'none',
                background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', color: '#fff',
                opacity: hwSaving ? 0.6 : 1,
              }}>
                {hwSaving ? '⏳ Pushing…' : '📡 Push Config to Device'}
              </button>
              <span style={{ fontSize: 12, opacity: 0.4 }}>
                Applied within ≤ {Math.ceil((hwConfig.sendIntervalMs || 180000) / 60000)} min
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: User Management ─────────────────────────────────── */}
      {tab === 2 && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 17 }}>👥 Registered Users ({users.length})</h3>
            <button onClick={loadUsers} style={btn('#06b6d4')}>🔄 Refresh</button>
          </div>

          {userLoading ? (
            <div style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>Loading users…</div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, opacity: 0.4 }}>No users found</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {users.map(u => (
                <div key={u._id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 16px', borderRadius: 10,
                  background: u._id === user?.id ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${u._id === user?.id ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  flexWrap: 'wrap', gap: 8,
                }}>
                  {/* Left: user info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: u.role === 'admin' ? 'linear-gradient(135deg,#7c3aed,#a78bfa)' : 'linear-gradient(135deg,#0ea5e9,#06b6d4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 800, color: '#fff',
                      }}>
                        {(u.name || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {u.name || '—'}
                          {u._id === user?.id && <span style={{ fontSize: 10, opacity: 0.5 }}>(you)</span>}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.5, fontWeight: 400 }}>{u.email}</div>
                      </div>
                    </div>
                  </div>

                  {/* Middle: role badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: u.role === 'admin' ? 'rgba(167,139,250,0.15)' : 'rgba(100,116,139,0.15)',
                      color: u.role === 'admin' ? '#a78bfa' : '#94a3b8',
                      border: `1px solid ${u.role === 'admin' ? '#a78bfa' : 'rgba(100,116,139,0.3)'}`,
                    }}>
                      {u.role === 'admin' ? '🛡️ Admin' : '👤 User'}
                    </span>
                    <div style={{ fontSize: 11, opacity: 0.4 }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Right: actions */}
                  {u._id !== user?.id && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      {u.role !== 'admin' ? (
                        <button
                          onClick={() => changeRole(u._id, 'admin')}
                          style={btn('#a78bfa', 'rgba(167,139,250,0.1)')}
                        >
                          ↑ Make Admin
                        </button>
                      ) : (
                        <button
                          onClick={() => changeRole(u._id, 'user')}
                          style={btn('#f59e0b', 'rgba(245,158,11,0.1)')}
                        >
                          ↓ Demote
                        </button>
                      )}
                      <button
                        onClick={() => deleteUser(u._id)}
                        style={btn('#ef4444', 'rgba(239,68,68,0.08)')}
                      >
                        🗑 Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
