import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  loginUser as loginAPI, signupUser as signupAPI, quickLoginUser as quickLoginAPI, getMe, logoutUser, tokenStore
} from '../services/api';
import translations from '../utils/translations';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// Role capabilities mirrored from the server (server/config/roles.js). The server
// always enforces permissions; these only decide what the UI offers.
const CAN = {
  manageInventory: ['admin', 'doctor', 'manager'],
  manageCatalog: ['admin', 'doctor', 'manager'],
  retireKits: ['admin', 'doctor'],
  inspect: ['admin', 'doctor', 'manager'],
  viewCompliance: ['admin', 'doctor', 'manager'],
  viewReports: ['admin', 'doctor', 'manager'],
  manageUsers: ['admin', 'doctor'],
  viewUsers: ['admin', 'doctor', 'manager'],
  viewActivity: ['admin', 'doctor'],
  manageDepartments: ['admin', 'doctor'],
  treatments: ['admin', 'doctor'],
  reviewIncidents: ['admin', 'doctor'],
  confirmIncidents: ['manager']
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState(() => localStorage.getItem('simplyaid_lang') || 'en');

  const t = useCallback((path) => {
    let val = translations[lang];
    for (const k of path.split('.')) val = val?.[k];
    if (val) return val;
    let fallback = translations.en;
    for (const k of path.split('.')) fallback = fallback?.[k];
    return fallback || path;
  }, [lang]);

  const switchLang = useCallback((l) => { setLang(l); localStorage.setItem('simplyaid_lang', l); }, []);

  useEffect(() => {
    if (!tokenStore.get()) { setLoading(false); return; }
    getMe()
      .then((res) => setUser(res.data.data))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const handleAuthResponse = useCallback((res) => {
    tokenStore.set(res.data.token);
    setUser(res.data.data);
    if (res.data.data.preferredLanguage) switchLang(res.data.data.preferredLanguage);
    return res.data;
  }, [switchLang]);

  const login = useCallback(async (email, password) => handleAuthResponse(await loginAPI({ email, password })), [handleAuthResponse]);
  const signup = useCallback(async (data) => handleAuthResponse(await signupAPI(data)), [handleAuthResponse]);
  const quickLoginByEmail = useCallback(async (email) => handleAuthResponse(await quickLoginAPI({ email })), [handleAuthResponse]);

  /** Store a token issued by the server (e.g. after a password change). */
  const updateSession = useCallback((token, userData) => {
    if (token) tokenStore.set(token);
    if (userData) setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try { await logoutUser(); } catch { /* token may already be invalid */ }
    tokenStore.clear();
    setUser(null);
    window.location.assign('/login');
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await getMe();
    setUser(res.data.data);
    return res.data.data;
  }, []);

  const hasRole = useCallback((...roles) => Boolean(user && roles.includes(user.role)), [user]);
  const can = useCallback((capability) => Boolean(user && CAN[capability] && CAN[capability].includes(user.role)), [user]);

  const value = useMemo(() => ({
    user, loading, login, signup, quickLoginByEmail, logout, refreshUser, updateSession, hasRole, can, t, lang, switchLang,
    getRoleRedirect: () => '/',
    // All app routes require sign-in, so the old guest-mode helpers are no-ops.
    isGuest: false,
    requireAuth: (callback) => callback()
  }), [user, loading, login, signup, quickLoginByEmail, logout, refreshUser, updateSession, hasRole, can, t, lang, switchLang]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
