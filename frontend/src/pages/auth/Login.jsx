import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { COMPANY_CONFIG, APP_NAME } from '../../config/company.js';
import './auth.css';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');
  const [apiError, setApiError] = useState('');

  const isExpired = new URLSearchParams(location.search).get('expired') === 'true';

  React.useEffect(() => { document.title = `Sign in | ${APP_NAME}`; }, []);

  function validate() {
    const e = {};
    if (!email.trim()) e.email = 'Email is required';
    if (!password) e.password = 'Password is required';
    else if (password.length < 4) e.password = 'Password must be at least 4 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    setApiError('');
    if (!validate()) return;
    setStatus('submitting');
    try {
      await login({ email, password });
      toast.success('Signed in successfully.');
      const dest = location.state?.from?.pathname || '/dashboard';
      navigate(dest, { replace: true });
    } catch (err) {
      setApiError(err?.message || 'Invalid credentials. Please try again.');
      setStatus('error');
      return;
    }
    setStatus('success');
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <img src={COMPANY_CONFIG.logo} alt="L Laetus Life Sciences" />
          <div>
            <div className="auth-brand-name">L LAETUS LIFE SCIENCES</div>
            <div className="auth-brand-sub">ERP · Sales · Inventory · GST Billing</div>
            <div className="auth-brand-tagline">“love , life and lifesaving care”</div>
          </div>
        </div>
        <h1 className="auth-title">Sign in to your account</h1>
        <p className="page-desc" style={{ marginBottom: 'var(--space-6)' }}>Enter your work email and password to continue.</p>

        {isExpired && !apiError && (
          <div className="auth-alert" role="alert" style={{ background: '#fff3cd', color: '#856404', borderColor: '#ffeeba' }}>
            ⚠️ Your session has expired or authentication failed. Please sign in again.
          </div>
        )}
        {apiError && <div className="auth-alert" role="alert">{apiError}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-field mb-4">
            <label htmlFor="email">Email<span className="required">*</span></label>
            <input id="email" type="email" className={`form-control ${errors.email ? 'has-error' : ''}`}
              value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            {errors.email && <span className="form-error">{errors.email}</span>}
          </div>

          <div className="form-field mb-2">
            <label htmlFor="password">Password<span className="required">*</span></label>
            <div className="password-wrap">
              <input id="password" type={showPassword ? 'text' : 'password'} className={`form-control ${errors.password ? 'has-error' : ''}`}
                value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {errors.password && <span className="form-error">{errors.password}</span>}
          </div>

          <div className="flex-between mb-6" style={{ marginTop: 6 }}>
            <label className="flex-gap-2" style={{ fontSize: 'var(--font-size-sm)' }}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me
            </label>
            <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 'var(--font-size-sm)' }}>Forgot password?</a>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
