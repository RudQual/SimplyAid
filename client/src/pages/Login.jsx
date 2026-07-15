import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getDemoAccountsList } from '../services/api';
import { Heart, Mail, Lock, ArrowRight, AlertCircle, User, Eye, EyeOff, Users, Stethoscope, Shield, ChevronDown, Zap } from 'lucide-react';
import './Login.css';

// ── Demo account data (hardcoded fallback) ──
const DEMO_ACCOUNTS = [
  // Doctors (3)
  { name: 'Dr. Arun Desai', email: 'arun@simplyaid.com', role: 'doctor', designation: 'Head Doctor', dept: 'Administration', isHead: true },
  { name: 'Dr. Meena Iyer', email: 'meena@simplyaid.com', role: 'doctor', designation: 'Factory Doctor', dept: 'Safety & EHS' },
  { name: 'Dr. Priya Kapoor', email: 'priya@simplyaid.com', role: 'doctor', designation: 'Occupational Health', dept: 'Production' },
  // Managers (5)
  { name: 'Rajesh Gupta', email: 'rajesh@simplyaid.com', role: 'manager', designation: 'Head Manager', dept: 'Administration', isHead: true },
  { name: 'Vikram Patel', email: 'vikram@simplyaid.com', role: 'manager', designation: 'Production Manager', dept: 'Production' },
  { name: 'Deepak Joshi', email: 'deepak@simplyaid.com', role: 'manager', designation: 'Maintenance Manager', dept: 'Maintenance' },
  { name: 'Neha Kulkarni', email: 'neha@simplyaid.com', role: 'manager', designation: 'QC Manager', dept: 'Quality Control' },
  { name: 'Sanjay Tiwari', email: 'sanjay@simplyaid.com', role: 'manager', designation: 'Logistics Manager', dept: 'Logistics' },
  // Employees — Production (6)
  { name: 'Ravi Kumar', email: 'ravi@simplyaid.com', role: 'employee', designation: 'Machine Operator', dept: 'Production' },
  { name: 'Anita Sharma', email: 'anita@simplyaid.com', role: 'employee', designation: 'Floor Supervisor', dept: 'Production' },
  { name: 'Mohan Rao', email: 'mohan@simplyaid.com', role: 'employee', designation: 'Welder', dept: 'Production' },
  { name: 'Lakshmi Devi', email: 'lakshmi@simplyaid.com', role: 'employee', designation: 'Assembly Line Worker', dept: 'Production' },
  { name: 'Ramesh Patil', email: 'ramesh@simplyaid.com', role: 'employee', designation: 'CNC Operator', dept: 'Production' },
  { name: 'Pooja Bhat', email: 'pooja.b@simplyaid.com', role: 'employee', designation: 'Production Helper', dept: 'Production' },
  // Employees — Maintenance (4)
  { name: 'Sunil Yadav', email: 'sunil@simplyaid.com', role: 'employee', designation: 'Technician', dept: 'Maintenance' },
  { name: 'Arvind Mishra', email: 'arvind@simplyaid.com', role: 'employee', designation: 'Electrician', dept: 'Maintenance' },
  { name: 'Ganesh Bhosle', email: 'ganesh@simplyaid.com', role: 'employee', designation: 'Plumber', dept: 'Maintenance' },
  { name: 'Dinesh Sawant', email: 'dinesh@simplyaid.com', role: 'employee', designation: 'HVAC Technician', dept: 'Maintenance' },
  // Employees — QC (3)
  { name: 'Sunita Kadam', email: 'sunita@simplyaid.com', role: 'employee', designation: 'Quality Inspector', dept: 'Quality Control' },
  { name: 'Ajay Chavan', email: 'ajay@simplyaid.com', role: 'employee', designation: 'Lab Technician', dept: 'Quality Control' },
  { name: 'Meghna Jain', email: 'meghna@simplyaid.com', role: 'employee', designation: 'Testing Analyst', dept: 'Quality Control' },
  // Employees — Safety (2)
  { name: 'Kavita Nair', email: 'kavita@simplyaid.com', role: 'employee', designation: 'Safety Inspector', dept: 'Safety & EHS' },
  { name: 'Nitin Pawar', email: 'nitin@simplyaid.com', role: 'employee', designation: 'Fire Safety Officer', dept: 'Safety & EHS' },
  // Employees — Logistics (3)
  { name: 'Prakash Gaikwad', email: 'prakash@simplyaid.com', role: 'employee', designation: 'Warehouse Supervisor', dept: 'Logistics' },
  { name: 'Rekha Mane', email: 'rekha@simplyaid.com', role: 'employee', designation: 'Dispatch Coordinator', dept: 'Logistics' },
  { name: 'Vishal Kale', email: 'vishal@simplyaid.com', role: 'employee', designation: 'Forklift Operator', dept: 'Logistics' },
  // Employees — Stores (2)
  { name: 'Ashok Jadhav', email: 'ashok@simplyaid.com', role: 'employee', designation: 'Store Keeper', dept: 'Stores & Warehouse' },
  { name: 'Seema Patil', email: 'seema@simplyaid.com', role: 'employee', designation: 'Inventory Clerk', dept: 'Stores & Warehouse' },
  // Employees — HR (2)
  { name: 'Pooja Mehta', email: 'pooja@simplyaid.com', role: 'employee', designation: 'HR Executive', dept: 'Human Resources' },
  { name: 'Amit Thakur', email: 'amit@simplyaid.com', role: 'employee', designation: 'Payroll Officer', dept: 'Human Resources' },
  // Employees — Admin (2)
  { name: 'Sneha Deshpande', email: 'sneha@simplyaid.com', role: 'employee', designation: 'Admin Executive', dept: 'Administration' },
  { name: 'Rohit Shinde', email: 'rohit@simplyaid.com', role: 'employee', designation: 'Office Assistant', dept: 'Administration' },
];

const ROLE_CONFIG = {
  employee: { icon: Users, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', label: 'Employees' },
  manager:  { icon: Shield, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Managers' },
  doctor:   { icon: Stethoscope, color: '#10b981', bg: 'rgba(16,185,129,0.1)', label: 'Doctors' },
};

const Login = () => {
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(searchParams.get('mode') === 'signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('employee');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickLoading, setQuickLoading] = useState(null); // email of account being quick-logged-in
  const [expandedRole, setExpandedRole] = useState('employee');
  const { login, signup, quickLoginByEmail, getRoleRedirect, t } = useAuth();
  const navigate = useNavigate();

  // Sync with URL param changes
  useEffect(() => {
    if (searchParams.get('mode') === 'signup') setIsSignUp(true);
  }, [searchParams]);

  // ── Role-based redirect helper ──
  const redirectByRole = (userData) => {
    const role = userData?.role || userData?.data?.role;
    const path = getRoleRedirect(role);
    navigate(path);
  };

  // ── Normal Form Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isSignUp && password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      let result;
      if (isSignUp) {
        result = await signup(name, email, password, '', role);
      } else {
        result = await login(email, password);
      }
      redirectByRole(result);
    } catch (err) {
      setError(err.response?.data?.message || (isSignUp ? 'Sign up failed. Please try again.' : 'Login failed. Please try again.'));
    } finally { setLoading(false); }
  };

  // ── Quick Login (demo dropdown) ──
  const handleQuickLogin = async (accountEmail) => {
    setError('');
    setQuickLoading(accountEmail);
    try {
      const result = await quickLoginByEmail(accountEmail);
      redirectByRole(result);
    } catch (err) {
      setError(err.response?.data?.message || 'Quick login failed.');
    } finally { setQuickLoading(null); }
  };

  const toggleMode = () => {
    const newMode = !isSignUp;
    setIsSignUp(newMode);
    
    if (newMode) {
      searchParams.set('mode', 'signup');
    } else {
      searchParams.delete('mode');
    }
    navigate(`?${searchParams.toString()}`, { replace: true });
    
    setError('');
    setName('');
    setEmail('');
    setRole('employee');
    setPassword('');
    setConfirmPassword('');
  };

  // Group accounts by role
  const groupedAccounts = ['employee', 'manager', 'doctor'].map(role => ({
    role,
    ...ROLE_CONFIG[role],
    accounts: DEMO_ACCOUNTS.filter(a => a.role === role)
  }));

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-orb login-orb-1"></div>
        <div className="login-orb login-orb-2"></div>
        <div className="login-orb login-orb-3"></div>
      </div>

      <div className="login-layout">
        {/* ── Left: Original Login Card ── */}
        <div className="login-container">
          <div className={`login-card ${isSignUp ? 'login-card--signup' : ''}`}>
            <div className="login-header">
              <div className="login-logo"><Heart size={28} /></div>
              <h1 className="login-title">Simply<span>AID</span></h1>
              <p className="login-subtitle">{t('app.tagline')}</p>
            </div>

            <div className="login-welcome" key={isSignUp ? 'signup' : 'signin'}>
              <h2>{isSignUp ? t('auth.signupWelcome') : t('auth.welcome')}</h2>
              <p>{isSignUp ? t('auth.signupSubtitle') : t('auth.subtitle')}</p>
            </div>

            {error && <div className="login-error"><AlertCircle size={16} />{error}</div>}

            <form onSubmit={handleSubmit} className="login-form">
              {/* Name field — sign-up only */}
              <div className={`login-field login-field--animated ${isSignUp ? 'login-field--visible' : 'login-field--hidden'}`}>
                <label>{t('auth.name')}</label>
                <div className="login-input-wrap">
                  <User size={18} className="login-input-icon" />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="John Doe"
                    required={isSignUp}
                    tabIndex={isSignUp ? 0 : -1}
                    id="signup-name"
                  />
                </div>
              </div>

              {/* User Type — sign-up only */}
              <div className={`login-field login-field--animated ${isSignUp ? 'login-field--visible' : 'login-field--hidden'}`}>
                <label>User Type</label>
                <div className="login-input-wrap">
                  <User size={18} className="login-input-icon" />
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    tabIndex={isSignUp ? 0 : -1}
                    id="signup-role"
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="doctor">Doctor</option>
                  </select>
                </div>
              </div>

              {/* Email */}
              <div className="login-field">
                <label>{t('auth.email')}</label>
                <div className="login-input-wrap">
                  <Mail size={18} className="login-input-icon" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required id="auth-email" />
                </div>
              </div>

              {/* Password */}
              <div className="login-field">
                <label>{t('auth.password')}</label>
                <div className="login-input-wrap">
                  <Lock size={18} className="login-input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    id="auth-password"
                  />
                  <button type="button" className="login-eye-btn" onClick={() => setShowPassword(v => !v)} tabIndex={-1} aria-label="Toggle password visibility">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password — sign-up only */}
              <div className={`login-field login-field--animated ${isSignUp ? 'login-field--visible' : 'login-field--hidden'}`}>
                <label>{t('auth.confirmPassword')}</label>
                <div className="login-input-wrap">
                  <Lock size={18} className="login-input-icon" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required={isSignUp}
                    tabIndex={isSignUp ? 0 : -1}
                    id="signup-confirm-password"
                  />
                  <button type="button" className="login-eye-btn" onClick={() => setShowConfirm(v => !v)} tabIndex={-1} aria-label="Toggle confirm password visibility">
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="login-btn" disabled={loading} id="auth-submit-btn">
                {loading ? <span className="spinner" style={{width:20,height:20,borderWidth:2}}></span> : <>{isSignUp ? t('auth.signupBtn') : t('auth.loginBtn')} <ArrowRight size={18} /></>}
              </button>
            </form>

            {/* Toggle between Sign In and Sign Up */}
            <div className="login-toggle">
              <p>
                {isSignUp ? t('auth.haveAccount') : t('auth.noAccount')}{' '}
                <button type="button" className="login-toggle-btn" onClick={toggleMode}>
                  {isSignUp ? t('auth.login') : t('auth.signup')}
                </button>
              </p>
            </div>

            <div className="login-footer">
              <p>Compliant with Indian Factories Act, 1948</p>
            </div>
          </div>
        </div>

        {/* ── Right: Quick Access Demo Panel ── */}
        <div className="demo-panel">
          <div className="demo-panel-card">
            <div className="demo-panel-header">
              <div className="demo-panel-icon"><Zap size={20} /></div>
              <div>
                <h2 className="demo-panel-title">Quick Access</h2>
                <p className="demo-panel-subtitle">Click any account to login instantly</p>
              </div>
            </div>

            <div className="demo-panel-groups">
              {groupedAccounts.map(group => {
                const Icon = group.icon;
                const isExpanded = expandedRole === group.role;
                return (
                  <div key={group.role} className="demo-group">
                    <button
                      className={`demo-group-header ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => setExpandedRole(isExpanded ? null : group.role)}
                      style={{ '--role-color': group.color, '--role-bg': group.bg }}
                    >
                      <div className="demo-group-left">
                        <div className="demo-group-icon-wrap" style={{ background: group.bg, color: group.color }}>
                          <Icon size={16} />
                        </div>
                        <span className="demo-group-label">{group.label}</span>
                        <span className="demo-group-count">{group.accounts.length}</span>
                      </div>
                      <ChevronDown size={16} className={`demo-chevron ${isExpanded ? 'rotated' : ''}`} />
                    </button>

                    <div className={`demo-group-list ${isExpanded ? 'expanded' : ''}`}>
                      {group.accounts.map(account => (
                        <button
                          key={account.email}
                          className={`demo-account-btn ${quickLoading === account.email ? 'loading' : ''}`}
                          onClick={() => handleQuickLogin(account.email)}
                          disabled={quickLoading !== null}
                          style={{ '--role-color': group.color }}
                        >
                          <div className="demo-account-avatar" style={{ background: group.bg, color: group.color }}>
                            {account.name.charAt(0)}
                          </div>
                          <div className="demo-account-info">
                            <div className="demo-account-name">
                              {account.name}
                              {account.isHead && <span className="demo-head-badge">★ HEAD</span>}
                            </div>
                            <div className="demo-account-meta">
                              {account.designation} · {account.dept}
                            </div>
                          </div>
                          {quickLoading === account.email ? (
                            <span className="spinner" style={{width:16,height:16,borderWidth:2}}></span>
                          ) : (
                            <ArrowRight size={14} className="demo-account-arrow" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="demo-panel-footer">
              <p>All accounts use password: <code>Demo@123</code></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
