import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  HeartPulse, Mail, Lock, User, Building2, ArrowRight, Eye, EyeOff, ShieldCheck, CalendarClock, Boxes, BellRing, Zap, ChevronDown
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getAuthConfig, getDemoAccountsList } from '../services/api';
import { errorMessage, initials, labelize } from '../utils/format';
import { Spinner } from '../components/ui';
import './Login.css';

const FEATURES = [
  { icon: Boxes, title: 'Kit & stock control', text: 'Batch-level inventory for every first aid kit, with full movement history.' },
  { icon: CalendarClock, title: 'Automated expiry checks', text: 'Scheduled scans flag expiring and expired supplies before audits do.' },
  { icon: ShieldCheck, title: 'Factories Act compliance', text: 'Section 45 & 88 checks, inspections and Form 18 in one place.' },
  { icon: BellRing, title: 'Actionable alerts', text: 'Low stock, missing supplies and SOS routed to the right people.' }
];

const ROLE_ORDER = ['admin', 'doctor', 'manager', 'employee'];

const Login = () => {
  const { user, login, signup, quickLoginByEmail } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const mode = params.get('mode') === 'signup' ? 'signup' : 'signin';
  const next = params.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  const [config, setConfig] = useState({ demoLogin: false, selfSignup: true, passwordRule: '' });
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', companyCode: '' });
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState([]);
  const [openGroup, setOpenGroup] = useState('admin');

  useEffect(() => {
    getAuthConfig().then((r) => setConfig(r.data.data)).catch(() => {});
    if (params.get('expired')) toast.error('Your session ended. Please sign in again.', { id: 'expired' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (config.demoLogin) getDemoAccountsList().then((r) => setDemo(r.data.data)).catch(() => {});
  }, [config.demoLogin]);

  const demoGroups = useMemo(() => ROLE_ORDER
    .map((role) => ({ role, users: demo.filter((u) => u.role === role) }))
    .filter((g) => g.users.length), [demo]);

  if (user) return <Navigate to={safeNext} replace />;

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((er) => ({ ...er, [k]: undefined })); };
  const switchMode = (m) => { setErrors({}); setParams(m === 'signup' ? { mode: 'signup' } : {}); };

  const validate = () => {
    const er = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) er.email = 'Enter a valid email address';
    if (!form.password) er.password = 'Enter your password';
    if (mode === 'signup') {
      if (form.name.trim().length < 2) er.name = 'Enter your full name';
      if (!form.companyCode.trim()) er.companyCode = 'Ask your administrator for the company code';
      if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) er.password = 'At least 8 characters, with a letter and a number';
      if (form.confirm !== form.password) er.confirm = 'Passwords do not match';
    }
    setErrors(er);
    return Object.keys(er).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      if (mode === 'signup') {
        await signup({ name: form.name.trim(), email: form.email.trim(), password: form.password, companyCode: form.companyCode.trim() });
        toast.success('Account created — welcome to SimplyAID!');
      } else {
        const res = await login(form.email.trim(), form.password);
        toast.success(`Welcome back, ${res.data.name.split(' ')[0]}`);
      }
      navigate(safeNext, { replace: true });
    } catch (err) {
      setErrors({ form: errorMessage(err, mode === 'signup' ? 'Could not create the account' : 'Sign in failed') });
    } finally {
      setBusy(false);
    }
  };

  const quick = async (email) => {
    setBusy(true);
    try {
      await quickLoginByEmail(email);
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, 'Quick sign-in failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <aside className="auth-hero">
        <div className="auth-hero-inner">
          <div className="auth-brand">
            <span className="brand-mark brand-mark-lg"><HeartPulse size={22} /></span>
            <span className="auth-brand-name">Simply<span>AID</span></span>
          </div>
          <h1>Workplace first aid,<br />always audit-ready.</h1>
          <p className="auth-hero-sub">Inventory, expiry, inspections and compliance for every first aid kit on your site — in one calm, reliable workspace.</p>
          <div className="auth-features">
            {FEATURES.map((f) => (
              <div className="auth-feature" key={f.title}>
                <span className="auth-feature-icon"><f.icon size={18} /></span>
                <div><strong>{f.title}</strong><p>{f.text}</p></div>
              </div>
            ))}
          </div>
          <p className="auth-hero-foot">Built around the Factories Act, 1948 · Sections 45 & 88</p>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-mobile-brand">
            <span className="brand-mark"><HeartPulse size={18} /></span>
            <span className="auth-brand-name">Simply<span>AID</span></span>
          </div>
          <h2>{mode === 'signup' ? 'Create your account' : 'Sign in'}</h2>
          <p className="muted">{mode === 'signup' ? 'Join your organisation’s SimplyAID workspace.' : 'Welcome back. Enter your details to continue.'}</p>

          {config.selfSignup && (
            <div className="segmented auth-switch">
              <button type="button" className={mode === 'signin' ? 'active' : ''} onClick={() => switchMode('signin')}>Sign in</button>
              <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')}>Create account</button>
            </div>
          )}

          {errors.form && <div className="alert alert-danger" role="alert" style={{ marginBottom: 16 }}>{errors.form}</div>}

          <form onSubmit={submit} noValidate>
            {mode === 'signup' && (
              <div className="form-group">
                <label className="form-label" htmlFor="name">Full name</label>
                <div className="input-icon"><User size={16} /><input id="name" value={form.name} onChange={set('name')} autoComplete="name" placeholder="Priya Sharma" /></div>
                {errors.name && <span className="form-error">{errors.name}</span>}
              </div>
            )}
            <div className="form-group">
              <label className="form-label" htmlFor="email">Work email</label>
              <div className="input-icon"><Mail size={16} /><input id="email" type="email" value={form.email} onChange={set('email')} autoComplete="email" placeholder="you@company.com" autoFocus /></div>
              {errors.email && <span className="form-error">{errors.email}</span>}
            </div>
            {mode === 'signup' && (
              <div className="form-group">
                <label className="form-label" htmlFor="companyCode">Company code</label>
                <div className="input-icon"><Building2 size={16} /><input id="companyCode" value={form.companyCode} onChange={set('companyCode')} placeholder="e.g. DMPL" style={{ textTransform: 'uppercase' }} /></div>
                {errors.companyCode ? <span className="form-error">{errors.companyCode}</span> : <span className="form-hint">New accounts start with the employee role. An administrator can change it.</span>}
              </div>
            )}
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <div className="input-icon auth-password">
                <Lock size={16} />
                <input id="password" type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="••••••••" />
                <button type="button" className="auth-eye" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}>{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
              {errors.password && <span className="form-error">{errors.password}</span>}
            </div>
            {mode === 'signup' && (
              <div className="form-group">
                <label className="form-label" htmlFor="confirm">Confirm password</label>
                <div className="input-icon"><Lock size={16} /><input id="confirm" type={showPw ? 'text' : 'password'} value={form.confirm} onChange={set('confirm')} autoComplete="new-password" /></div>
                {errors.confirm && <span className="form-error">{errors.confirm}</span>}
              </div>
            )}
            <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>
              {busy ? <Spinner size="sm" light /> : <>{mode === 'signup' ? 'Create account' : 'Sign in'} <ArrowRight size={17} /></>}
            </button>
          </form>

          {config.demoLogin && demoGroups.length > 0 && (
            <div className="demo-box">
              <div className="demo-box-head"><Zap size={15} /> <strong>Demo accounts</strong><span className="badge badge-amber">Development only</span></div>
              <p className="xsmall muted">Sign in instantly as any seeded user. Password for all demo accounts: <code>Demo@123</code></p>
              {demoGroups.map((g) => (
                <div key={g.role} className="demo-group">
                  <button type="button" className="demo-group-btn" onClick={() => setOpenGroup((o) => (o === g.role ? null : g.role))}>
                    <span className={`badge badge-${g.role}`}>{labelize(g.role)}</span>
                    <span className="xsmall muted">{g.users.length} account{g.users.length > 1 ? 's' : ''}</span>
                    <ChevronDown size={15} className="muted" style={{ marginLeft: 'auto', transform: openGroup === g.role ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                  </button>
                  {openGroup === g.role && (
                    <div className="demo-users">
                      {g.users.map((u) => (
                        <button key={u._id} type="button" className="demo-user" onClick={() => quick(u.email)} disabled={busy}>
                          <span className="avatar avatar-sm">{initials(u.name)}</span>
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <span className="truncate" style={{ display: 'block', fontWeight: 600, fontSize: '0.86rem' }}>{u.name}</span>
                            <span className="truncate xsmall muted" style={{ display: 'block' }}>{u.designation || u.email}{u.department?.name ? ` · ${u.department.name}` : ''}</span>
                          </span>
                          <ArrowRight size={14} className="muted" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Login;
