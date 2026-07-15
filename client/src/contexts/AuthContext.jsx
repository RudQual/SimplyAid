import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginUser as loginAPI, signupUser as signupAPI, quickLoginUser as quickLoginAPI, getMe } from '../services/api';
import translations from '../utils/translations';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState(() => localStorage.getItem('simplyaid_lang') || 'en');
  const [showAuthModal, setShowAuthModal] = useState(false);

  const t = useCallback((path) => {
    const keys = path.split('.');
    let val = translations[lang];
    for (const k of keys) { val = val?.[k]; }
    return val || path;
  }, [lang]);

  const switchLang = (l) => { setLang(l); localStorage.setItem('simplyaid_lang', l); };

  useEffect(() => {
    const token = localStorage.getItem('simplyaid_token');
    if (token) {
      getMe().then(res => { setUser(res.data.data); setLoading(false); })
        .catch(() => { localStorage.removeItem('simplyaid_token'); setLoading(false); });
    } else { setLoading(false); }
  }, []);

  // Helper to store auth response
  const handleAuthResponse = (res) => {
    localStorage.setItem('simplyaid_token', res.data.token);
    localStorage.setItem('simplyaid_user', JSON.stringify(res.data.data));
    setUser(res.data.data);
    if (res.data.data.preferredLanguage) switchLang(res.data.data.preferredLanguage);
    return res.data;
  };

  const login = async (email, password) => {
    const res = await loginAPI({ email, password });
    return handleAuthResponse(res);
  };

  const signup = async (name, email, password, employeeId, role) => {
    const res = await signupAPI({ name, email, password, employeeId, role });
    return handleAuthResponse(res);
  };

  const quickLoginByEmail = async (email) => {
    const res = await quickLoginAPI({ email });
    return handleAuthResponse(res);
  };

  // Returns the correct redirect path based on user role
  const getRoleRedirect = (role) => {
    switch (role) {
      case 'doctor': return '/doctor-dashboard';
      case 'manager': return '/manager-dashboard';
      default: return '/';
    }
  };

  const logout = () => {
    localStorage.removeItem('simplyaid_token');
    localStorage.removeItem('simplyaid_user');
    setUser(null);
    window.location.href = '/login';
  };

  const refreshUser = async () => {
    try {
      const res = await getMe();
      setUser(res.data.data);
      localStorage.setItem('simplyaid_user', JSON.stringify(res.data.data));
    } catch (e) {
      console.error('Failed to refresh user:', e);
    }
  };

  // Role-based access control — checks if the logged-in user has one of the specified roles
  const hasRole = (...roles) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  // Guest mode helpers
  const isGuest = !loading && !user;

  // Call this to guard an action. If user is logged in, runs the callback immediately.
  // If guest, shows the auth-required modal instead.
  const requireAuth = (callback) => {
    if (user) {
      callback();
    } else {
      setShowAuthModal(true);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, quickLoginByEmail, getRoleRedirect, logout, refreshUser, hasRole, t, lang, switchLang, isGuest, requireAuth, showAuthModal, setShowAuthModal }}>
      {children}
    </AuthContext.Provider>
  );
};
