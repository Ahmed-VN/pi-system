'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'login' | 'signup'
type Role = 'PI' | 'CO_PI' | 'JRF'

// ─── Icons ────────────────────────────────────────────────────────────────────

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

// ─── Role Card ────────────────────────────────────────────────────────────────

const roles: { id: Role; label: string; desc: string; icon: string }[] = [
  { id: 'PI', label: 'Principal Investigator', desc: 'Lead researcher & project head', icon: '🎓' },
  { id: 'CO_PI', label: 'Co-Investigator', desc: 'Collaborative research partner', icon: '🔬' },
  { id: 'JRF', label: 'Junior Research Fellow', desc: 'Research scholar & fellow', icon: '📚' },
]

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AuthPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('login')
  const [dark, setDark] = useState(false)

  // Login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPw, setShowLoginPw] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // Signup state
  const [signupData, setSignupData] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    department: '', institution: '', role: '' as Role | '',
  })
  const [showSignupPw, setShowSignupPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [signupError, setSignupError] = useState('')
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // ── Login ──────────────────────────────────────────────────────────────────

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    const result = await signIn('credentials', { email: loginEmail, password: loginPassword, redirect: false })
    if (result?.error) {
      setLoginError('Invalid email or password. Please try again.')
      setLoginLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  // ── Signup ─────────────────────────────────────────────────────────────────

  function validateSignup() {
    const errs: Record<string, string> = {}
    if (!signupData.name.trim()) errs.name = 'Full name is required'
    if (!signupData.email.includes('@')) errs.email = 'Enter a valid institutional email'
    if (signupData.password.length < 8) errs.password = 'Password must be at least 8 characters'
    if (signupData.password !== signupData.confirmPassword) errs.confirmPassword = 'Passwords do not match'
    if (!signupData.role) errs.role = 'Please select your role'
    if (!signupData.institution.trim()) errs.institution = 'Institution name is required'
    return errs
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    const errs = validateSignup()
    if (Object.keys(errs).length) { setValidationErrors(errs); return }
    setValidationErrors({})
    setSignupLoading(true)
    setSignupError('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signupData.name,
          email: signupData.email,
          password: signupData.password,
          institution: signupData.institution,
          designation: signupData.department,
          role: signupData.role,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setSignupError(data.error || 'Registration failed'); setSignupLoading(false) }
      else { setSignupSuccess(true); setTimeout(() => { setTab('login'); setSignupSuccess(false) }, 2000) }
    } catch { setSignupError('Network error. Please try again.'); setSignupLoading(false) }
  }

  function handleSignupChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setSignupData(p => ({ ...p, [e.target.name]: e.target.value }))
    setValidationErrors(p => { const n = { ...p }; delete n[e.target.name]; return n })
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  const d = dark
  const bg = d ? '#0d0f14' : '#f4f6fb'
  const card = d ? '#161b26' : '#ffffff'
  const border = d ? '#2a2f3e' : '#e8eaf0'
  const text = d ? '#e8edf5' : '#1a1d2e'
  const muted = d ? '#6b7694' : '#8b91a8'
  const accent = '#3b6cff'
  const accentHover = '#2952e0'
  const inputBg = d ? '#1e2434' : '#f8f9fc'
  const inputBorder = d ? '#2a3048' : '#dde0ea'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Playfair+Display:wght@600;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .auth-root {
          font-family: 'DM Sans', sans-serif;
          min-height: 100vh;
          background: ${bg};
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          transition: background 0.3s;
          position: relative;
          overflow: hidden;
        }

        .auth-root::before {
          content: '';
          position: fixed;
          top: -30%;
          right: -20%;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, ${d ? 'rgba(59,108,255,0.08)' : 'rgba(59,108,255,0.06)'} 0%, transparent 70%);
          pointer-events: none;
          border-radius: 50%;
        }

        .auth-root::after {
          content: '';
          position: fixed;
          bottom: -20%;
          left: -10%;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, ${d ? 'rgba(99,179,237,0.05)' : 'rgba(99,179,237,0.04)'} 0%, transparent 70%);
          pointer-events: none;
          border-radius: 50%;
        }

        .card {
          background: ${card};
          border: 1px solid ${border};
          border-radius: 20px;
          width: 100%;
          max-width: 460px;
          padding: 40px 40px 36px;
          box-shadow: ${d ? '0 24px 80px rgba(0,0,0,0.5)' : '0 24px 80px rgba(59,108,255,0.08), 0 4px 16px rgba(0,0,0,0.04)'};
          position: relative;
          z-index: 1;
          animation: fadeUp 0.5s cubic-bezier(.22,.68,0,1.2) both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .theme-toggle {
          position: fixed;
          top: 20px;
          right: 20px;
          background: ${card};
          border: 1px solid ${border};
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 18px;
          z-index: 10;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .theme-toggle:hover { transform: scale(1.1); }

        .brand {
          text-align: center;
          margin-bottom: 28px;
        }

        .brand-icon {
          width: 52px;
          height: 52px;
          background: linear-gradient(135deg, #3b6cff 0%, #7c4dff 100%);
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          box-shadow: 0 8px 24px rgba(59,108,255,0.3);
        }

        .brand-title {
          font-family: 'Playfair Display', serif;
          font-size: 28px;
          font-weight: 700;
          color: ${text};
          letter-spacing: -0.5px;
          line-height: 1.2;
        }

        .brand-sub {
          font-size: 12px;
          color: ${muted};
          margin-top: 4px;
          line-height: 1.4;
          max-width: 280px;
          margin-left: auto;
          margin-right: auto;
        }

        .tabs {
          display: flex;
          background: ${inputBg};
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 28px;
          border: 1px solid ${inputBorder};
        }

        .tab-btn {
          flex: 1;
          padding: 9px;
          border: none;
          border-radius: 9px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          background: transparent;
          color: ${muted};
        }

        .tab-btn.active {
          background: ${card};
          color: ${text};
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .form-group { margin-bottom: 16px; }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: ${text};
          margin-bottom: 6px;
        }

        .input-wrap { position: relative; }

        .form-input {
          width: 100%;
          padding: 11px 14px;
          background: ${inputBg};
          border: 1.5px solid ${inputBorder};
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: ${text};
          outline: none;
          transition: all 0.2s;
          appearance: none;
        }

        .form-input::placeholder { color: ${muted}; }

        .form-input:focus {
          border-color: ${accent};
          background: ${d ? '#1e2434' : '#fff'};
          box-shadow: 0 0 0 3px rgba(59,108,255,0.12);
        }

        .form-input.has-error { border-color: #ef4444; }
        .form-input.has-error:focus { box-shadow: 0 0 0 3px rgba(239,68,68,0.12); }

        .pw-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: ${muted};
          display: flex;
          align-items: center;
          padding: 2px;
          transition: color 0.15s;
        }
        .pw-toggle:hover { color: ${text}; }

        .field-error {
          font-size: 12px;
          color: #ef4444;
          margin-top: 4px;
        }

        .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

        .role-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 16px; }

        .role-card {
          border: 1.5px solid ${inputBorder};
          border-radius: 10px;
          padding: 10px 8px;
          text-align: center;
          cursor: pointer;
          transition: all 0.18s;
          background: ${inputBg};
        }

        .role-card:hover { border-color: ${accent}; background: ${d ? '#1e2737' : '#f0f4ff'}; }

        .role-card.selected {
          border-color: ${accent};
          background: ${d ? '#1a2540' : '#eff3ff'};
          box-shadow: 0 0 0 3px rgba(59,108,255,0.12);
        }

        .role-icon { font-size: 20px; margin-bottom: 4px; }
        .role-label { font-size: 11px; font-weight: 600; color: ${text}; line-height: 1.2; }
        .role-desc { font-size: 10px; color: ${muted}; margin-top: 2px; line-height: 1.3; }

        .role-error { font-size: 12px; color: #ef4444; margin-bottom: 12px; margin-top: -4px; }

        .forgot-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .remember-label {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 13px;
          color: ${muted};
          cursor: pointer;
          user-select: none;
        }

        .remember-label input[type=checkbox] {
          width: 15px;
          height: 15px;
          accent-color: ${accent};
          cursor: pointer;
        }

        .forgot-link {
          font-size: 13px;
          color: ${accent};
          text-decoration: none;
          font-weight: 500;
          transition: opacity 0.15s;
        }
        .forgot-link:hover { opacity: 0.75; }

        .btn-primary {
          width: 100%;
          padding: 12px;
          background: ${accent};
          color: #fff;
          border: none;
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.18s;
          letter-spacing: 0.1px;
        }
        .btn-primary:hover:not(:disabled) { background: ${accentHover}; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(59,108,255,0.3); }
        .btn-primary:active { transform: translateY(0); }
        .btn-primary:disabled { opacity: 0.65; cursor: not-allowed; }

        .divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 18px 0;
        }
        .divider-line { flex: 1; height: 1px; background: ${border}; }
        .divider-text { font-size: 12px; color: ${muted}; white-space: nowrap; }

        .btn-google {
          width: 100%;
          padding: 11px;
          background: transparent;
          border: 1.5px solid ${inputBorder};
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: ${text};
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.18s;
        }
        .btn-google:hover { border-color: ${accent}; background: ${d ? '#1a2540' : '#f5f7ff'}; }

        .error-box {
          background: ${d ? '#2d1515' : '#fff5f5'};
          border: 1px solid ${d ? '#5c2020' : '#fecaca'};
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 13px;
          color: ${d ? '#fc8181' : '#dc2626'};
          margin-bottom: 16px;
        }

        .success-box {
          background: ${d ? '#0d2d1a' : '#f0fdf4'};
          border: 1px solid ${d ? '#1a5c2a' : '#bbf7d0'};
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 13px;
          color: ${d ? '#68d391' : '#15803d'};
          margin-bottom: 16px;
          text-align: center;
        }

        .footer-text {
          text-align: center;
          font-size: 12px;
          color: ${muted};
          margin-top: 20px;
          line-height: 1.5;
        }

        .footer-text a { color: ${accent}; text-decoration: none; font-weight: 500; }
        .footer-text a:hover { text-decoration: underline; }

        .section-label {
          font-size: 11px;
          font-weight: 600;
          color: ${muted};
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 10px;
        }

        @media (max-width: 500px) {
          .card { padding: 28px 24px; }
          .row-2 { grid-template-columns: 1fr; }
          .role-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="auth-root">
        {/* Theme Toggle */}
        <button className="theme-toggle" onClick={() => setDark(p => !p)} aria-label="Toggle theme">
          {dark ? '☀️' : '🌙'}
        </button>

        <div className="card">
          {/* Brand */}
          <div className="brand">
            <div className="brand-title">ResearchPilot</div>
            <div className="brand-sub">Research Project Management &amp; Collaboration Platform</div>
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button className={`tab-btn ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>Sign In</button>
            <button className={`tab-btn ${tab === 'signup' ? 'active' : ''}`} onClick={() => setTab('signup')}>Create Account</button>
          </div>

          {/* ── LOGIN ─────────────────────────────────────────────────────────── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} autoComplete="on">
              {loginError && <div className="error-box">{loginError}</div>}

              <div className="form-group">
                <label className="form-label">Institutional Email</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="dr.sharma@iitd.ac.in"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="input-wrap">
                  <input
                    className="form-input"
                    type={showLoginPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    style={{ paddingRight: '40px' }}
                    autoComplete="current-password"
                    required
                  />
                  <button type="button" className="pw-toggle" onClick={() => setShowLoginPw(p => !p)}>
                    <EyeIcon open={showLoginPw} />
                  </button>
                </div>
              </div>

              <div className="forgot-row">
                <label className="remember-label">
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                  Remember me
                </label>
                <a href="#" className="forgot-link">Forgot password?</a>
              </div>

              <button type="submit" className="btn-primary" disabled={loginLoading}>
                {loginLoading ? 'Signing in…' : 'Sign In'}
              </button>

              <div className="divider">
                <div className="divider-line" />
                <span className="divider-text">or continue with</span>
                <div className="divider-line" />
              </div>

              <button type="button" className="btn-google" onClick={() => signIn('google')}>
                <GoogleIcon />
                Sign in with Google
              </button>

              <div className="footer-text" style={{ marginTop: '16px' }}>
                No account? <a href="#" onClick={e => { e.preventDefault(); setTab('signup') }}>Create one</a>
              </div>
            </form>
          )}

          {/* ── SIGNUP ────────────────────────────────────────────────────────── */}
          {tab === 'signup' && (
            <form onSubmit={handleSignup} autoComplete="off">
              {signupError && <div className="error-box">{signupError}</div>}
              {signupSuccess && <div className="success-box">✅ Account created! Redirecting to sign in…</div>}

              <div className="section-label">Select Your Role</div>
              <div className="role-grid">
                {roles.map(r => (
                  <div
                    key={r.id}
                    className={`role-card ${signupData.role === r.id ? 'selected' : ''}`}
                    onClick={() => { setSignupData(p => ({ ...p, role: r.id })); setValidationErrors(p => { const n = { ...p }; delete n.role; return n }) }}
                  >
                    <div className="role-icon">{r.icon}</div>
                    <div className="role-label">{r.label}</div>
                    <div className="role-desc">{r.desc}</div>
                  </div>
                ))}
              </div>
              {validationErrors.role && <div className="role-error">{validationErrors.role}</div>}

              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  className={`form-input ${validationErrors.name ? 'has-error' : ''}`}
                  name="name"
                  type="text"
                  placeholder="Dr. Rajesh Sharma"
                  value={signupData.name}
                  onChange={handleSignupChange}
                  required
                />
                {validationErrors.name && <div className="field-error">{validationErrors.name}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">Institutional Email</label>
                <input
                  className={`form-input ${validationErrors.email ? 'has-error' : ''}`}
                  name="email"
                  type="email"
                  placeholder="dr.sharma@iitd.ac.in"
                  value={signupData.email}
                  onChange={handleSignupChange}
                  required
                />
                {validationErrors.email && <div className="field-error">{validationErrors.email}</div>}
              </div>

              <div className="row-2">
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div className="input-wrap">
                    <input
                      className={`form-input ${validationErrors.password ? 'has-error' : ''}`}
                      name="password"
                      type={showSignupPw ? 'text' : 'password'}
                      placeholder="Min 8 chars"
                      value={signupData.password}
                      onChange={handleSignupChange}
                      style={{ paddingRight: '40px' }}
                      required
                    />
                    <button type="button" className="pw-toggle" onClick={() => setShowSignupPw(p => !p)}>
                      <EyeIcon open={showSignupPw} />
                    </button>
                  </div>
                  {validationErrors.password && <div className="field-error">{validationErrors.password}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <div className="input-wrap">
                    <input
                      className={`form-input ${validationErrors.confirmPassword ? 'has-error' : ''}`}
                      name="confirmPassword"
                      type={showConfirmPw ? 'text' : 'password'}
                      placeholder="Repeat password"
                      value={signupData.confirmPassword}
                      onChange={handleSignupChange}
                      style={{ paddingRight: '40px' }}
                      required
                    />
                    <button type="button" className="pw-toggle" onClick={() => setShowConfirmPw(p => !p)}>
                      <EyeIcon open={showConfirmPw} />
                    </button>
                  </div>
                  {validationErrors.confirmPassword && <div className="field-error">{validationErrors.confirmPassword}</div>}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Institution Name</label>
                <input
                  className={`form-input ${validationErrors.institution ? 'has-error' : ''}`}
                  name="institution"
                  type="text"
                  placeholder="Indian Institute of Technology Delhi"
                  value={signupData.institution}
                  onChange={handleSignupChange}
                  required
                />
                {validationErrors.institution && <div className="field-error">{validationErrors.institution}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">Department <span style={{ color: '#8b91a8', fontWeight: 400 }}>(optional)</span></label>
                <input
                  className="form-input"
                  name="department"
                  type="text"
                  placeholder="Computer Science & Engineering"
                  value={signupData.department}
                  onChange={handleSignupChange}
                />
              </div>

              <button type="submit" className="btn-primary" disabled={signupLoading || signupSuccess} style={{ marginTop: '4px' }}>
                {signupLoading ? 'Creating account…' : 'Create Account'}
              </button>

              <div className="footer-text" style={{ marginTop: '16px' }}>
                Already registered? <a href="#" onClick={e => { e.preventDefault(); setTab('login') }}>Sign in</a>
              </div>
            </form>
          )}

          <div className="footer-text">
            By continuing you agree to ANRF's <a href="#">Terms</a> &amp; <a href="#">Privacy Policy</a>
          </div>
        </div>
      </div>
    </>
  )
}
