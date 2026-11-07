import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Mail, Lock, User, Building2, ArrowRight, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getAuthConfig, getDemoAccountsList } from '../services/api';
import { errorMessage, initials, labelize } from '../utils/format';
import { Spinner } from '../components/ui';
import './Login.css';

const CHECKS = ['auth.check1', 'auth.check2', 'auth.check3', 'auth.check4', 'auth.check5'];
const ROLE_ORDER = ['admin', 'doctor', 'manager', 'employee'];

const LangSwitch = ({ lang, onChange }) => (
  <div className="auth-lang" role="group" aria-label="Language / भाषा">
    <button type="button" className={lang === 'en' ? 'on' : ''} onClick={() => onChange('en')}>English</button>
    <button type="button" className={lang === 'hi' ? 'on' : ''} onClick={() => onChange('hi')}>हिन्दी</button>
  </div>
);

const Login = () => {
  const { user, login, signup, quickLoginByEmail, t, lang, switchLang } = useAuth();
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
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) er.email = t('auth.errEmail');
    if (!form.password) er.password = t('auth.errPassword');
    if (mode === 'signup') {
      if (form.name.trim().length < 2) er.name = t('auth.errName');
      if (!form.companyCode.trim()) er.companyCode = t('auth.errCompany');
      if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) er.password = t('auth.errPwRule');
      if (form.confirm !== form.password) er.confirm = t('auth.errMismatch');
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
        toast.success(t('auth.accountCreated'));
      } else {
        const res = await login(form.email.trim(), form.password);
        toast.success(t('auth.welcomeBack', { name: res.data.name.split(' ')[0] }));
      }
      navigate(safeNext, { replace: true });
    } catch (err) {
      setErrors({ form: errorMessage(err, mode === 'signup' ? t('auth.failedUp') : t('auth.failedIn')) });
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
      toast.error(errorMessage(err, t('auth.failedIn')));
    } finally {
      setBusy(false);
    }
  };

  const [line1, line2] = t('auth.heroTitle').split('\n');

  return (
    <div className="auth-page">
      <div className="auth-tape" aria-hidden="true" />
      <header className="auth-top">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="auth-brand-name">Simply<span>AID</span></span>
        </div>
        <LangSwitch lang={lang} onChange={(l) => switchLang(l)} />
      </header>

      <div className="auth-body">
        <section className="auth-intro">
          <h1>{line1}<br /><em>{line2}</em></h1>
          <p className="auth-lede">{t('auth.heroSub')}</p>

          <div className="auth-sheet">
            <div className="auth-sheet-head">
              <span>{t('auth.sheetTitle')}</span>
              <span className="mono">No. 01–05</span>
            </div>
            <ol>
              {CHECKS.map((k, i) => (
                <li key={k}>
                  <span className="auth-sheet-no">{String(i + 1).padStart(2, '0')}</span>
                  <span className="auth-sheet-text">{t(k)}</span>
                  <span className="auth-tick" aria-hidden="true" />
                </li>
              ))}
            </ol>
            <div className="auth-stamp" aria-hidden="true">{t('auth.stamp')}</div>
          </div>
        </section>

        <main className="auth-card">
          {config.selfSignup && (
            <div className="auth-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'on' : ''} onClick={() => switchMode('signin')}>{t('auth.signIn')}</button>
              <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => switchMode('signup')}>{t('auth.createAccount')}</button>
            </div>
          )}
          <h2>{mode === 'signup' ? t('auth.createAccount') : t('auth.signIn')}</h2>
          <p className="muted auth-card-sub">{mode === 'signup' ? t('auth.joinSub') : t('auth.welcome')}</p>

          {errors.form && <div className="alert alert-danger" role="alert" style={{ marginBottom: 16 }}>{errors.form}</div>}

          <form onSubmit={submit} noValidate>
            {mode === 'signup' && (
              <div className="form-group">
                <label className="form-label" htmlFor="name">{t('auth.fullName')}</label>
                <div className="input-icon"><User size={16} /><input id="name" value={form.name} onChange={set('name')} autoComplete="name" placeholder="Priya Sharma" /></div>
                {errors.name && <span className="form-error">{errors.name}</span>}
              </div>
            )}
            <div className="form-group">
              <label className="form-label" htmlFor="email">{t('auth.email')}</label>
              <div className="input-icon"><Mail size={16} /><input id="email" type="email" value={form.email} onChange={set('email')} autoComplete="email" placeholder="you@company.com" autoFocus /></div>
              {errors.email && <span className="form-error">{errors.email}</span>}
            </div>
            {mode === 'signup' && (
              <div className="form-group">
                <label className="form-label" htmlFor="companyCode">{t('auth.companyCode')}</label>
                <div className="input-icon"><Building2 size={16} /><input id="companyCode" value={form.companyCode} onChange={set('companyCode')} placeholder="e.g. DMPL" style={{ textTransform: 'uppercase' }} /></div>
                {errors.companyCode ? <span className="form-error">{errors.companyCode}</span> : <span className="form-hint">{t('auth.companyHint')}</span>}
              </div>
            )}
            <div className="form-group">
              <label className="form-label" htmlFor="password">{t('auth.password')}</label>
              <div className="input-icon auth-password">
                <Lock size={16} />
                <input id="password" type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="••••••••" />
                <button type="button" className="auth-eye" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? t('auth.hidePw') : t('auth.showPw')}>{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
              {errors.password && <span className="form-error">{errors.password}</span>}
            </div>
            {mode === 'signup' && (
              <div className="form-group">
                <label className="form-label" htmlFor="confirm">{t('auth.confirmPassword')}</label>
                <div className="input-icon"><Lock size={16} /><input id="confirm" type={showPw ? 'text' : 'password'} value={form.confirm} onChange={set('confirm')} autoComplete="new-password" /></div>
                {errors.confirm && <span className="form-error">{errors.confirm}</span>}
              </div>
            )}
            <button className="btn btn-primary btn-lg btn-block auth-submit" type="submit" disabled={busy}>
              {busy ? <Spinner size="sm" light /> : <>{mode === 'signup' ? t('auth.createAccount') : t('auth.signIn')} <ArrowRight size={17} /></>}
            </button>
          </form>

          {config.demoLogin && demoGroups.length > 0 && (
            <div className="demo-box">
              <div className="demo-box-head"><strong>{t('auth.demoTitle')}</strong><span className="badge badge-amber">{t('auth.demoDev')}</span></div>
              <p className="xsmall muted">{t('auth.demoHint')} <code>Demo@123</code></p>
              {demoGroups.map((g) => (
                <div key={g.role} className="demo-group">
                  <button type="button" className="demo-group-btn" onClick={() => setOpenGroup((o) => (o === g.role ? null : g.role))}>
                    <span className={`badge badge-${g.role}`}>{labelize(g.role)}</span>
                    <span className="xsmall muted">{t(g.users.length > 1 ? 'auth.accounts' : 'auth.account', { n: g.users.length })}</span>
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
        </main>
      </div>

      <footer className="auth-foot">
        <span>SimplyAID</span>
        <span>{t('auth.stamp')}</span>
      </footer>
    </div>
  );
};

export default Login;
