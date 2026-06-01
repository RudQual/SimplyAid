import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Heart, Mail, Lock, ArrowRight, AlertCircle, User, Eye, EyeOff } from 'lucide-react';
import './Login.css';

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState('employee');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup, t } = useAuth();
  const navigate = useNavigate();

  // --- Form Submit ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isSignUp && password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signup(name, email, password, employeeId, role);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || (isSignUp ? 'Sign up failed. Please try again.' : 'Login failed. Please try again.'));
    } finally { setLoading(false); }
  };

  const toggleMode = () => {
    setIsSignUp(prev => !prev);
    setError('');
    setName('');
    setEmail('');
    setEmployeeId('');
    setRole('employee');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-orb login-orb-1"></div>
        <div className="login-orb login-orb-2"></div>
        <div className="login-orb login-orb-3"></div>
      </div>
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

            {/* Employee ID field — sign-up only */}
            <div className={`login-field login-field--animated ${isSignUp ? 'login-field--visible' : 'login-field--hidden'}`}>
              <label>Employee ID (Optional)</label>
              <div className="login-input-wrap">
                <User size={18} className="login-input-icon" />
                <input
                  type="text"
                  value={employeeId}
                  onChange={e => setEmployeeId(e.target.value)}
                  placeholder="EMP-12345"
                  tabIndex={isSignUp ? 0 : -1}
                  id="signup-employee-id"
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
                  style={{width:'100%',background:'transparent',border:'none',outline:'none',color:'inherit',fontSize:'inherit',paddingLeft:'0.5rem'}}
                >
                  <option value="employee">Employee (Worker)</option>
                  <option value="admin">Admin (Doctor / Manager)</option>
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
    </div>
  );
};

export default Login;
