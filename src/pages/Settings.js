// src/pages/Settings.js
import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../config/api';
import { useAuth } from '../context/AuthContext';

/* ── helpers ──────────────────────────────────────────── */
const WHO_DEFAULTS = {
  pm1: 15, pm25: 15, pm10: 45,
  co: 9, co2: 1000, o3: 100, no2: 40,
  temperature: 40, humidity: 80,
  voc_index: 250, nox_index: 250,
};
const LABEL  = { pm1:'PM1.0', pm25:'PM2.5', pm10:'PM10', co:'CO', co2:'CO₂', o3:'O₃', no2:'NO₂', temperature:'Temperature', humidity:'Humidity', voc_index:'VOC Index', nox_index:'NOx Index' };
const UNIT   = { pm1:'µg/m³', pm25:'µg/m³', pm10:'µg/m³', co:'ppm', co2:'ppm', o3:'ppb', no2:'µg/m³', temperature:'°C', humidity:'%', voc_index:'', nox_index:'' };
const MAX_V  = { pm1:200, pm25:200, pm10:500, co:50, co2:5000, o3:500, no2:500, temperature:60, humidity:100, voc_index:500, nox_index:500 };

const TABS = ['🔔 Thresholds','📧 Notifications','👤 Account','📡 Sensor','🔧 Hardware Config'];

/* severity colour for slider badge */
function badge(key, val) {
  const warn = WHO_DEFAULTS[key] * 2;
  if (val <= WHO_DEFAULTS[key]) return { bg:'#10b98122', color:'#10b981', label:'Safe' };
  if (val <= warn)              return { bg:'#f59e0b22', color:'#f59e0b', label:'Warning' };
  return                               { bg:'#ef444422', color:'#ef4444', label:'Danger' };
}

/* card styles */
const card = {
  background:'var(--card-bg)',
  padding:24,
  borderRadius:'var(--card-radius)',
  boxShadow:'var(--glass-shadow)',
  border:'1px solid var(--glass-border)',
  marginBottom:20,
};

export default function Settings() {
  const { user } = useAuth();
  const userId = user?._id || user?.id || 'admin';

  const [tab, setTab]           = useState(0);
  const [thresholds, setThr]    = useState(WHO_DEFAULTS);
  const [notif, setNotif]       = useState({ alertEmails:true, dailyDigest:true, digestTime:'07:00' });
  const [sensor, setSensor]     = useState({ location:'Nairobi', retentionDays:30, pollInterval:60 });
  const [profile, setProfile]   = useState({ name: user?.name||'', email: user?.email||'' });
  const [pwd, setPwd]           = useState({ current:'', next:'', confirm:'' });
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState(null);

  /* hardware config twin */
  const HW_DEFAULTS = {
    sendIntervalMs: 180000, mq7R0: 5.0, mq131R0: 10.0, rlValue: 10.0,
    tempOffset: 0.0, humOffset: 0.0,
    aqiWarnThreshold: 100, aqiCriticalThreshold: 150, aqiSevereThreshold: 200,
  };
  const HW_LABELS = {
    sendIntervalMs:'Telemetry Interval', mq7R0:'MQ-7 R₀ (CO baseline)', mq131R0:'MQ-131 R₀ (O₃ baseline)',
    rlValue:'Load Resistor Rₗ', tempOffset:'Temp Offset', humOffset:'Humidity Offset',
    aqiWarnThreshold:'AQI Warning Threshold', aqiCriticalThreshold:'AQI Critical Threshold', aqiSevereThreshold:'AQI Severe Threshold',
  };
  const HW_UNITS = {
    sendIntervalMs:'ms', mq7R0:'kΩ', mq131R0:'kΩ', rlValue:'kΩ',
    tempOffset:'°C', humOffset:'%', aqiWarnThreshold:'', aqiCriticalThreshold:'', aqiSevereThreshold:'',
  };
  const HW_MIN = { sendIntervalMs:30000, mq7R0:0.1, mq131R0:0.1, rlValue:0.1, tempOffset:-10, humOffset:-10, aqiWarnThreshold:0, aqiCriticalThreshold:0, aqiSevereThreshold:0 };
  const HW_MAX = { sendIntervalMs:900000, mq7R0:100, mq131R0:100, rlValue:100, tempOffset:10, humOffset:10, aqiWarnThreshold:500, aqiCriticalThreshold:500, aqiSevereThreshold:500 };
  const HW_STEP= { sendIntervalMs:1000, mq7R0:0.1, mq131R0:0.1, rlValue:0.1, tempOffset:0.1, humOffset:0.1, aqiWarnThreshold:1, aqiCriticalThreshold:1, aqiSevereThreshold:1 };
  const [hwConfig, setHwConfig] = useState(HW_DEFAULTS);
  const [hwTwin, setHwTwin]     = useState(null);  // full twin from backend
  const [hwSaving, setHwSaving] = useState(false);

  /* load saved settings */
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/api/settings/${userId}`);
        if (data?.thresholds)    setThr(t => ({ ...t, ...data.thresholds }));
        if (data?.notifications) setNotif(n => ({ ...n, ...data.notifications }));
        if (data?.sensor)        setSensor(s => ({ ...s, ...data.sensor }));
      } catch (_) {}
    })();
  }, [userId]);

  /* poll hardware config twin every 10 s */
  useEffect(() => {
    const fetchTwin = async () => {
      try {
        const { data } = await api.get('/api/device-config');
        setHwTwin(data);
        if (data?.desired) setHwConfig(c => ({ ...c, ...data.desired }));
      } catch (_) {}
    };
    fetchTwin();
    const id = setInterval(fetchTwin, 10000);
    return () => clearInterval(id);
  }, []);

  const showToast = (msg, ok=true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  /* save thresholds + notifications + sensor in one call */
  const save = useCallback(async () => {
    setSaving(true);
    try {
      await api.post('/api/settings', { userId, thresholds, notifications: notif, sensor });
      showToast('Settings saved ✓');
    } catch { showToast('Save failed', false); }
    setSaving(false);
  }, [userId, thresholds, notif, sensor]);

  /* push desired hardware config to device */
  const saveHwConfig = async () => {
    setHwSaving(true);
    try {
      const { data } = await api.post('/api/device-config/desired', hwConfig);
      setHwTwin(data.config);
      showToast('Hardware config queued — device will apply on next check-in ✓');
    } catch { showToast('Failed to push hardware config', false); }
    setHwSaving(false);
  };

  /* test email */
  const testEmail = async (type) => {
    try {
      const to = user?.email || profile.email || 'erickson9063@gmail.com';
      await api.post('/api/email/test', { type, to });
      showToast(`Test ${type} email sent to ${to} ✓`);
    } catch { showToast('Email test failed — check SMTP config', false); }
  };

  /* profile save */
  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.put(`/api/auth/profile/${userId}`, profile);
      showToast('Profile updated ✓');
    } catch { showToast('Profile update failed', false); }
    setSaving(false);
  };

  /* password change */
  const changePassword = async () => {
    if (pwd.next !== pwd.confirm) return showToast('Passwords do not match', false);
    if (pwd.next.length < 6) return showToast('Password must be at least 6 characters', false);
    setSaving(true);
    try {
      await api.put(`/api/auth/password/${userId}`, { current: pwd.current, next: pwd.next });
      setPwd({ current:'', next:'', confirm:'' });
      showToast('Password changed ✓');
    } catch { showToast('Password change failed — check current password', false); }
    setSaving(false);
  };

  /* ── shared input style ── */
  const inp = {
    width:'100%', padding:'10px 12px', borderRadius:8,
    border:'1px solid rgba(255,255,255,0.12)',
    background:'rgba(255,255,255,0.05)',
    color:'#fff', fontSize:14, outline:'none',
    boxSizing:'border-box',
  };

  return (
    <div style={{ padding:'0 4px' }}>

      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <h2 style={{ margin:'0 0 6px 0', fontSize:28, fontWeight:700 }}>⚙️ Settings</h2>
        <p style={{ margin:0, opacity:0.55, fontSize:14 }}>
          Manage thresholds, notifications, account and sensor preferences
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', top:24, right:24, zIndex:9999,
          padding:'12px 20px', borderRadius:10,
          background: toast.ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${toast.ok ? '#10b981' : '#ef4444'}`,
          color: toast.ok ? '#10b981' : '#ef4444',
          fontSize:14, fontWeight:600,
          boxShadow:'0 4px 20px rgba(0,0,0,0.3)',
          backdropFilter:'blur(12px)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:24, flexWrap:'wrap' }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            padding:'8px 18px', borderRadius:8, border:'none', cursor:'pointer',
            fontWeight:600, fontSize:13,
            background: tab===i ? 'linear-gradient(135deg,#06b6d4,#10b981)' : 'rgba(255,255,255,0.06)',
            color: tab===i ? '#fff' : 'rgba(255,255,255,0.6)',
            transition:'all 0.2s',
          }}>{t}</button>
        ))}
      </div>

      {/* ── TAB 0: Alert Thresholds ── */}
      {tab === 0 && (
        <div style={card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <h3 style={{ margin:0, fontSize:17 }}>🔔 Alert Thresholds</h3>
            <button onClick={() => setThr(WHO_DEFAULTS)} style={{
              padding:'6px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,0.15)',
              background:'transparent', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:12,
            }}>↺ Reset to WHO defaults</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:20 }}>
            {Object.keys(WHO_DEFAULTS).map(k => {
              const b = badge(k, thresholds[k]);
              return (
                <div key={k} style={{ padding:16, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                    <span style={{ fontSize:13, fontWeight:700 }}>{LABEL[k]} <span style={{ opacity:0.45, fontWeight:400 }}>({UNIT[k]})</span></span>
                    <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:b.bg, color:b.color }}>{b.label}</span>
                  </div>
                  <input type="range" min={0} max={MAX_V[k]} value={thresholds[k]}
                    onChange={e => setThr(s => ({ ...s, [k]: Number(e.target.value) }))}
                    style={{ width:'100%', accentColor:'#06b6d4', marginBottom:6 }}
                  />
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, opacity:0.5 }}>
                    <span>0</span>
                    <span style={{ fontWeight:700, fontSize:13, color:b.color }}>{thresholds[k]} {UNIT[k]}</span>
                    <span>{MAX_V[k]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 1: Notifications ── */}
      {tab === 1 && (
        <div style={card}>
          <h3 style={{ margin:'0 0 20px 0', fontSize:17 }}>📧 Email Notifications</h3>

          {[
            { key:'alertEmails', label:'🚨 Alert Emails', desc:'Receive instant emails when AQI thresholds are exceeded' },
            { key:'dailyDigest', label:'📋 Daily Digest',  desc:'Morning summary with 24h stats every day at the time below' },
          ].map(({ key, label, desc }) => (
            <div key={key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div style={{ fontWeight:700, fontSize:14 }}>{label}</div>
                <div style={{ fontSize:12, opacity:0.5, marginTop:2 }}>{desc}</div>
              </div>
              <div
                onClick={() => setNotif(n => ({ ...n, [key]: !n[key] }))}
                style={{
                  width:44, height:24, borderRadius:12, cursor:'pointer',
                  background: notif[key] ? '#10b981' : 'rgba(255,255,255,0.12)',
                  position:'relative', transition:'background 0.2s', flexShrink:0,
                }}
              >
                <div style={{
                  position:'absolute', top:3, left: notif[key] ? 22 : 3,
                  width:18, height:18, borderRadius:'50%', background:'#fff',
                  transition:'left 0.2s',
                }} />
              </div>
            </div>
          ))}

          <div style={{ marginTop:20 }}>
            <label style={{ fontSize:13, fontWeight:600, display:'block', marginBottom:8, opacity:0.7 }}>⏰ Daily digest time (EAT)</label>
            <input type="time" value={notif.digestTime}
              onChange={e => setNotif(n => ({ ...n, digestTime: e.target.value }))}
              style={{ ...inp, width:'auto', padding:'8px 12px' }}
            />
          </div>

          <div style={{ marginTop:24, display:'flex', gap:12, flexWrap:'wrap' }}>
            <button onClick={() => testEmail('alert')} style={{
              padding:'10px 20px', borderRadius:8, border:'none', cursor:'pointer',
              background:'rgba(239,68,68,0.15)', color:'#ef4444', fontWeight:600, fontSize:13,
            }}>🚨 Send Test Alert</button>
            <button onClick={() => testEmail('daily')} style={{
              padding:'10px 20px', borderRadius:8, border:'none', cursor:'pointer',
              background:'rgba(59,130,246,0.15)', color:'#60a5fa', fontWeight:600, fontSize:13,
            }}>📋 Send Test Digest</button>
          </div>
        </div>
      )}

      {/* ── TAB 2: Account ── */}
      {tab === 2 && (
        <>
          <div style={card}>
            <h3 style={{ margin:'0 0 20px 0', fontSize:17 }}>👤 Profile</h3>
            <div style={{ display:'flex', gap:12, marginBottom:24, alignItems:'center' }}>
              <div style={{
                width:56, height:56, borderRadius:'50%',
                background:'linear-gradient(135deg,#06b6d4,#10b981)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:22, fontWeight:700, color:'#fff', flexShrink:0,
              }}>
                {(profile.name||'U')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight:700 }}>{profile.name || 'User'}</div>
                <div style={{ fontSize:12, opacity:0.5 }}>{profile.email || '—'}</div>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
              {[['name','Display Name','text'],['email','Email Address','email']].map(([k,lbl,type]) => (
                <div key={k}>
                  <label style={{ fontSize:12, fontWeight:600, opacity:0.6, display:'block', marginBottom:6 }}>{lbl}</label>
                  <input type={type} value={profile[k]}
                    onChange={e => setProfile(p => ({ ...p, [k]: e.target.value }))}
                    style={inp}
                  />
                </div>
              ))}
            </div>
            <button onClick={saveProfile} disabled={saving} style={{
              padding:'10px 24px', borderRadius:8, border:'none', cursor:'pointer',
              background:'linear-gradient(135deg,#06b6d4,#10b981)', color:'#fff', fontWeight:700,
            }}>💾 Save Profile</button>
          </div>

          <div style={card}>
            <h3 style={{ margin:'0 0 20px 0', fontSize:17 }}>🔑 Change Password</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:14, maxWidth:360 }}>
              {[['current','Current Password'],['next','New Password'],['confirm','Confirm New Password']].map(([k,lbl]) => (
                <div key={k}>
                  <label style={{ fontSize:12, fontWeight:600, opacity:0.6, display:'block', marginBottom:6 }}>{lbl}</label>
                  <input type="password" value={pwd[k]}
                    onChange={e => setPwd(p => ({ ...p, [k]: e.target.value }))}
                    style={inp}
                  />
                </div>
              ))}
            </div>
            <button onClick={changePassword} disabled={saving} style={{
              marginTop:16, padding:'10px 24px', borderRadius:8, border:'none', cursor:'pointer',
              background:'rgba(139,92,246,0.2)', color:'#a78bfa', fontWeight:700, fontSize:13,
            }}>🔑 Update Password</button>
          </div>
        </>
      )}

      {/* ── TAB 3: Sensor Config ── */}
      {tab === 3 && (
        <div style={card}>
          <h3 style={{ margin:'0 0 20px 0', fontSize:17 }}>📡 Sensor Configuration</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:20 }}>
            {[
              { key:'location',      label:'Location Name',           type:'text',   unit:'' },
              { key:'retentionDays', label:'Data Retention (days)',    type:'number', unit:'days' },
              { key:'pollInterval',  label:'Polling Interval',         type:'number', unit:'seconds' },
            ].map(({ key, label, type, unit }) => (
              <div key={key}>
                <label style={{ fontSize:13, fontWeight:600, display:'block', marginBottom:8, opacity:0.7 }}>
                  {label} {unit && <span style={{ opacity:0.4, fontWeight:400 }}>({unit})</span>}
                </label>
                <input type={type} value={sensor[key]}
                  onChange={e => setSensor(s => ({ ...s, [key]: type==='number' ? Number(e.target.value) : e.target.value }))}
                  style={inp}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 4: Hardware Config ── */}
      {tab === 4 && (
        <div>
          {/* Sync status badge */}
          {hwTwin && (
            <div style={{ ...card, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px' }}>
              <div>
                <div style={{ fontWeight:700, fontSize:15 }}>🔌 Device Sync Status</div>
                {hwTwin.reported?.lastSeenAt && (
                  <div style={{ fontSize:12, opacity:0.5, marginTop:4 }}>
                    Last seen: {new Date(hwTwin.reported.lastSeenAt).toLocaleString()}
                    {hwTwin.reported.firmwareVersion && ` · FW ${hwTwin.reported.firmwareVersion}`}
                  </div>
                )}
              </div>
              <div style={{
                padding:'6px 16px', borderRadius:20, fontWeight:700, fontSize:13,
                background: hwTwin.status === 'synced'  ? 'rgba(16,185,129,0.15)'
                          : hwTwin.status === 'pending' ? 'rgba(245,158,11,0.15)'
                          : 'rgba(239,68,68,0.15)',
                color:      hwTwin.status === 'synced'  ? '#10b981'
                          : hwTwin.status === 'pending' ? '#f59e0b'
                          : '#ef4444',
                border:`1px solid ${ hwTwin.status === 'synced' ? '#10b981' : hwTwin.status === 'pending' ? '#f59e0b' : '#ef4444'}`,
              }}>
                { hwTwin.status === 'synced'  ? '✅ In Sync'
                : hwTwin.status === 'pending' ? '⏳ Pending — awaiting device check-in'
                : '❌ Error' }
              </div>
            </div>
          )}

          <div style={card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ margin:0, fontSize:17 }}>🔧 Hardware Configuration</h3>
              <button onClick={() => setHwConfig(HW_DEFAULTS)} style={{
                padding:'6px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,0.15)',
                background:'transparent', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:12,
              }}>↺ Reset to defaults</button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 }}>
              {Object.keys(HW_DEFAULTS).map(k => {
                const isFloat = HW_STEP[k] < 1;
                return (
                  <div key={k} style={{ padding:16, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                    <label style={{ fontSize:13, fontWeight:600, display:'block', marginBottom:8, opacity:0.75 }}>
                      {HW_LABELS[k]} {HW_UNITS[k] && <span style={{ opacity:0.4, fontWeight:400 }}>({HW_UNITS[k]})</span>}
                    </label>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <input
                        type="range"
                        min={HW_MIN[k]} max={HW_MAX[k]} step={HW_STEP[k]}
                        value={hwConfig[k]}
                        onChange={e => setHwConfig(c => ({ ...c, [k]: isFloat ? parseFloat(e.target.value) : parseInt(e.target.value) }))}
                        style={{ flex:1, accentColor:'#a78bfa' }}
                      />
                      <input
                        type="number"
                        min={HW_MIN[k]} max={HW_MAX[k]} step={HW_STEP[k]}
                        value={hwConfig[k]}
                        onChange={e => setHwConfig(c => ({ ...c, [k]: isFloat ? parseFloat(e.target.value) : parseInt(e.target.value) }))}
                        style={{ ...inp, width:80, textAlign:'right', padding:'6px 10px', accentColor:'#a78bfa' }}
                      />
                    </div>
                    {/* Show what the device currently has, if available */}
                    {hwTwin?.reported?.[k] !== undefined && hwTwin.reported[k] !== hwConfig[k] && (
                      <div style={{ fontSize:11, opacity:0.45, marginTop:4 }}>
                        Device currently: {hwTwin.reported[k]}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop:24, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
              <button onClick={saveHwConfig} disabled={hwSaving} style={{
                padding:'12px 28px', fontSize:15, fontWeight:700, borderRadius:10, cursor:'pointer', border:'none',
                background:'linear-gradient(135deg,#7c3aed,#a78bfa)', color:'#fff',
                opacity: hwSaving ? 0.6 : 1,
              }}>
                {hwSaving ? '⏳ Queuing…' : '📡 Push Config to Device'}
              </button>
              <span style={{ fontSize:12, opacity:0.4 }}>
                Changes are applied on the next telemetry cycle (≤ {Math.round((hwConfig.sendIntervalMs||180000)/60000)} min)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Save button (visible on threshold / notif / sensor tabs) */}
      {(tab === 0 || tab === 1 || tab === 3) && (
        <button onClick={save} disabled={saving} className="btn primary" style={{
          padding:'12px 28px', fontSize:15, fontWeight:700, borderRadius:10, cursor:'pointer',
        }}>
          {saving ? '⏳ Saving…' : '💾 Save Settings'}
        </button>
      )}
    </div>
  );
}
