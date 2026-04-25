// src/pages/Login.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../config/api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [form, setForm]           = useState({ email: '', password: '' });
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [focused, setFocused]     = useState('');
  const { login }                 = useAuth();
  const navigate                  = useNavigate();

  const onChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const onSubmit = async e => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) { setError('Please fill in all fields.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError('Enter a valid email address.'); return; }
    try {
      setLoading(true);
      const res = await api.post('/api/auth/login', form);
      const user = res.data?.user;
      if (user) { login(user); navigate('/dashboard', { replace: true }); }
      else setError('Unexpected response. Please try again.');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.');
    } finally { setLoading(false); }
  };

  const guestLogin = () => {
    login({ id: 'guest', name: 'Guest User', email: 'guest@local' });
    navigate('/dashboard', { replace: true });
  };

  return (
    <div style={styles.page}>
      <style>{css}</style>

      {/* Background particles */}
      <div style={styles.bg}>
        {[...Array(6)].map((_,i) => <div key={i} className={`auth-orb auth-orb-${i}`}/>)}
      </div>

      <div style={styles.card} className="auth-card">
        {/* Brand */}
        <div style={styles.brand}>
          <div style={styles.logo}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#012d1a" strokeWidth="2.5">
              <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/>
            </svg>
          </div>
          <div>
            <div style={styles.brandName}>AirQuality Pro</div>
            <div style={styles.brandSub}>Intelligent Monitoring</div>
          </div>
        </div>

        <h1 style={styles.title}>Welcome back</h1>
        <p style={styles.sub}>Sign in to your monitoring dashboard</p>

        <form onSubmit={onSubmit} style={styles.form} noValidate>
          {/* Email */}
          <div style={styles.fieldWrap}>
            <label style={styles.label} htmlFor="login-email">Email address</label>
            <div style={{ position:'relative' }}>
              <span style={styles.fieldIcon}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              </span>
              <input id="login-email" name="email" type="email" autoComplete="email"
                value={form.email} onChange={onChange}
                onFocus={()=>setFocused('email')} onBlur={()=>setFocused('')}
                placeholder="you@example.com"
                style={inputStyle(focused==='email')}/>
            </div>
          </div>

          {/* Password */}
          <div style={styles.fieldWrap}>
            <label style={styles.label} htmlFor="login-pw">Password</label>
            <div style={{ position:'relative' }}>
              <span style={styles.fieldIcon}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input id="login-pw" name="password" type={showPw?'text':'password'} autoComplete="current-password"
                value={form.password} onChange={onChange}
                onFocus={()=>setFocused('password')} onBlur={()=>setFocused('')}
                placeholder="Your password"
                style={inputStyle(focused==='password')}/>
              <button type="button" onClick={()=>setShowPw(s=>!s)} style={styles.eyeBtn} aria-label="Toggle password">
                {showPw
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>

          {error && (
            <div style={styles.errorBox}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={styles.primaryBtn} className="auth-primary-btn">
            {loading ? <><span className="auth-spinner"/>Signing in…</> : 'Sign In'}
          </button>

          <div style={styles.divider}><span>or</span></div>

          <button type="button" onClick={guestLogin} style={styles.ghostBtn} className="auth-ghost-btn">
            Continue as Guest
          </button>
        </form>

        <p style={styles.switchText}>
          Don't have an account?{' '}
          <Link to="/signup" style={styles.link}>Create one free</Link>
        </p>
      </div>
    </div>
  );
}

/* ─── shared styles ──────────────────────────────────────────── */
const inputStyle = focused => ({
  width: '100%', boxSizing: 'border-box',
  padding: '11px 14px 11px 40px',
  background: 'rgba(255,255,255,0.06)',
  border: `1px solid ${focused ? 'rgba(0,229,160,0.5)' : 'rgba(255,255,255,0.1)'}`,
  borderRadius: 10, color: '#e8eef8', fontSize: 14, fontFamily: 'inherit', outline: 'none',
  boxShadow: focused ? '0 0 0 3px rgba(0,229,160,0.1)' : 'none',
  transition: 'border-color .15s, box-shadow .15s',
});

const styles = {
  page: {
    minHeight: '100vh', width: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg,#070d1c 0%,#0b1a2e 50%,#070d1c 100%)',
    fontFamily: "'Inter',system-ui,sans-serif", padding: '24px', boxSizing: 'border-box',
    position: 'relative', overflow: 'hidden',
  },
  bg: { position:'absolute', inset:0, pointerEvents:'none', zIndex:0 },
  card: {
    position: 'relative', zIndex: 1,
    width: '100%', maxWidth: 440,
    background: 'rgba(255,255,255,0.05)',
    backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 20, padding: '36px 36px 32px',
    boxShadow: '0 24px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
  },
  brand: { display:'flex', alignItems:'center', gap:10, marginBottom:28 },
  logo: {
    width:40, height:40, borderRadius:10, flexShrink:0,
    background:'linear-gradient(135deg,#00e5a0,#06b6d4)',
    display:'flex', alignItems:'center', justifyContent:'center',
    boxShadow:'0 4px 12px rgba(0,229,160,0.3)',
  },
  brandName: { fontSize:15, fontWeight:700, color:'#e8eef8' },
  brandSub:  { fontSize:10, color:'rgba(255,255,255,0.4)', letterSpacing:'.06em', textTransform:'uppercase' },
  title: { fontSize:26, fontWeight:800, color:'#e8eef8', margin:'0 0 6px', letterSpacing:'-.02em' },
  sub:   { fontSize:13, color:'rgba(255,255,255,0.45)', margin:'0 0 28px' },
  form:  { display:'flex', flexDirection:'column', gap:16 },
  fieldWrap: { display:'flex', flexDirection:'column', gap:6 },
  label: { fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.55)', letterSpacing:'.04em' },
  fieldIcon: { position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.3)', display:'flex' },
  eyeBtn: { position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', padding:2, display:'flex', lineHeight:1 },
  errorBox: { display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, fontSize:13, color:'#fca5a5' },
  primaryBtn: {
    padding:'12px', borderRadius:10, border:'none', cursor:'pointer', fontWeight:700, fontSize:14,
    background:'linear-gradient(135deg,#00e5a0,#06b6d4)', color:'#012d1a', fontFamily:'inherit',
    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
    boxShadow:'0 4px 14px rgba(0,229,160,0.3)', transition:'transform .15s, box-shadow .15s',
  },
  divider: {
    display:'flex', alignItems:'center', gap:12, fontSize:11, color:'rgba(255,255,255,0.25)',
    '::before':{content:'""',flex:1,height:1,background:'rgba(255,255,255,0.08)'},
  },
  ghostBtn: {
    padding:'11px', borderRadius:10, border:'1px solid rgba(255,255,255,0.12)',
    background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.6)',
    cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:'inherit', transition:'all .15s',
  },
  switchText: { marginTop:20, textAlign:'center', fontSize:13, color:'rgba(255,255,255,0.4)' },
  link: { color:'#00e5a0', textDecoration:'none', fontWeight:600 },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
  .auth-card { animation: auth-rise .35s cubic-bezier(.34,1.3,.64,1); }
  @keyframes auth-rise { from{opacity:0;transform:translateY(20px) scale(.97)} to{opacity:1;transform:none} }
  .auth-primary-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 20px rgba(0,229,160,.4)!important; }
  .auth-primary-btn:disabled { opacity:.55; cursor:not-allowed; }
  .auth-ghost-btn:hover { background:rgba(255,255,255,.08)!important; color:#e8eef8!important; }
  .auth-spinner { width:14px;height:14px;border:2px solid rgba(1,45,26,.3);border-top-color:#012d1a;border-radius:50%;animation:auth-spin .7s linear infinite;display:inline-block; }
  @keyframes auth-spin { to{transform:rotate(360deg)} }
  .auth-orb { position:absolute;border-radius:50%;filter:blur(80px);opacity:.18;animation:auth-drift 12s ease-in-out infinite; }
  .auth-orb-0 { width:320px;height:320px;background:#00e5a0;top:-120px;left:-80px;animation-delay:0s; }
  .auth-orb-1 { width:260px;height:260px;background:#06b6d4;bottom:-100px;right:-60px;animation-delay:-4s; }
  .auth-orb-2 { width:180px;height:180px;background:#8b5cf6;top:40%;right:10%;animation-delay:-2s; }
  .auth-orb-3 { width:140px;height:140px;background:#00e5a0;bottom:20%;left:5%;animation-delay:-6s; }
  .auth-orb-4 { width:100px;height:100px;background:#f59e0b;top:20%;right:20%;animation-delay:-8s; }
  .auth-orb-5 { width:200px;height:200px;background:#3b82f6;top:60%;left:20%;animation-delay:-3s; }
  @keyframes auth-drift { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(20px,-20px) scale(1.05)} 66%{transform:translate(-15px,15px) scale(.95)} }
`;