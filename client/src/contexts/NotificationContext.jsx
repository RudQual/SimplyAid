import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotifications, markAllRead, markNotificationRead } from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext({ unreadCount: 0, recent: [], refresh: () => {} });
export const useNotifications = () => useContext(NotificationContext);

const POLL_MS = 30000;

/** Where a notification should take the user. */
export const notificationLink = (n) => {
  if (n.link) return n.link;
  if (!n.relatedId) return null;
  switch (n.relatedModel) {
    case 'Incident': return `/incidents/${n.relatedId}`;
    case 'FirstAidBox': return `/kits/${n.relatedId}`;
    case 'InventoryItem': return `/inventory/${n.relatedId}`;
    case 'Inspection': return `/inspections/${n.relatedId}`;
    case 'TreatmentRecord': return `/treatments/${n.relatedId}`;
    case 'User': return `/employees/${n.relatedId}`;
    default: return null;
  }
};

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState({ unreadCount: 0, recent: [], loaded: false });
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!user || inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await getNotifications({ limit: 8 });
      setState({ unreadCount: res.data.unreadCount, recent: res.data.data, loaded: true });
    } catch {
      // Polling failures are transient; the next poll retries.
    } finally {
      inFlight.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    refresh();
    const id = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [user, refresh]);

  const open = useCallback(async (n) => {
    if (!n.isRead) {
      setState((s) => ({ ...s, unreadCount: Math.max(0, s.unreadCount - 1), recent: s.recent.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)) }));
      try { await markNotificationRead(n._id); } catch { refresh(); }
    }
    const link = notificationLink(n);
    if (link) navigate(link);
  }, [navigate, refresh]);

  const readAll = useCallback(async () => {
    await markAllRead();
    setState((s) => ({ ...s, unreadCount: 0, recent: s.recent.map((x) => ({ ...x, isRead: true })) }));
  }, []);

  const value = useMemo(() => ({ ...state, refresh, open, readAll }), [state, refresh, open, readAll]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};
