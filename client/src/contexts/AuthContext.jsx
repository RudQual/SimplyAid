import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  updateMyProfile, loginUser as loginAPI, signupUser as signupAPI, quickLoginUser as quickLoginAPI, getMe, logoutUser, tokenStore
} from '../services/api';
import { getLang, setLang, hasStoredLang, translate } from '../utils/i18n';

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
  const [lang, setLangState] = useState(getLang);

  /** t('dash.greeting', { name }) — falls back to English, then to `fallback`, then to the key. */
  const t = useCallback((path, vars, fallback) => translate(lang, path, vars, fallback), [lang]);

  const signedIn = useRef(false);
  const switchLang = useCallback((l, { sync = true } = {}) => {
    // Update the module copy first so labelize()/timeAgo() agree on the next render.
    setLang(l);
    setLangState(getLang());
    // Remember the choice on the account too (best effort).
    if (sync && signedIn.current) updateMyProfile({ preferredLanguage: getLang() }).catch(() => {});
  }, []);
  useEffect(() => { signedIn.current = Boolean(user); }, [user]);

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
    // A language picked on this device (e.g. on the sign-in page) wins; otherwise use the account's.
    if (hasStoredLang()) {
      if (res.data.data.preferredLanguage !== getLang()) updateMyProfile({ preferredLanguage: getLang() }).catch(() => {});
    } else if (res.data.data.preferredLanguage) switchLang(res.data.data.preferredLanguage, { sync: false });
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
