import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Heart, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, t } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-orb login-orb-1"></div>
        <div className="login-orb login-orb-2"></div>
        <div className="login-orb login-orb-3"></div>
      </div>
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo"><Heart size={28} /></div>
            <h1 className="login-title">Simply<span>AID</span></h1>
            <p className="login-subtitle">{t('app.tagline')}</p>
          </div>
          <div className="login-welcome">
            <h2>{t('auth.welcome')}</h2>
            <p>{t('auth.subtitle')}</p>
          </div>
          {error && <div className="login-error"><AlertCircle size={16} />{error}</div>}
          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label>{t('auth.email')}</label>
              <div className="login-input-wrap">
                <Mail size={18} className="login-input-icon" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@simplyaid.com" required />
              </div>
            </div>
            <div className="login-field">
              <label>{t('auth.password')}</label>
              <div className="login-input-wrap">
                <Lock size={18} className="login-input-icon" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
            </div>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? <span className="spinner" style={{width:20,height:20,borderWidth:2}}></span> : <>{t('auth.loginBtn')} <ArrowRight size={18} /></>}
            </button>
          </form>
          <div className="login-footer">
            <p>Compliant with Indian Factories Act, 1948</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
