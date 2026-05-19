import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getNotifications, markAllRead, markNotificationRead } from '../../services/api';
import { Bell, LogOut, Globe, X, Check } from 'lucide-react';
import './Navbar.css';

const Navbar = () => {
  const { user, logout, t, lang, switchLang } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showLang, setShowLang] = useState(false);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      const res = await getNotifications({ limit: 10 });
      setNotifications(res.data.data);
      setUnreadCount(res.data.unreadCount);
    } catch (e) { /* silent */ }
  };

  const handleMarkAllRead = async () => {
    try { await markAllRead(); setUnreadCount(0); setNotifications(n => n.map(x => ({ ...x, isRead: true }))); } catch (e) {}
  };

  const handleNotifClick = async (notif) => {
    if (!notif.isRead) {
      try { await markNotificationRead(notif._id); setUnreadCount(c => Math.max(0, c - 1)); } catch (e) {}
    }
  };

  const getSeverityClass = (s) => s === 'critical' ? 'notif-critical' : s === 'warning' ? 'notif-warning' : 'notif-info';

  return (
    <header className="navbar">
      <div className="navbar-left">
        <h2 className="navbar-title">{t('app.name')}</h2>
      </div>
      <div className="navbar-right">
        {/* Language Toggle */}
        <div className="navbar-dropdown">
          <button className="navbar-icon-btn" onClick={() => { setShowLang(!showLang); setShowNotifs(false); }} title="Language">
            <Globe size={18} /><span className="lang-label">{lang.toUpperCase()}</span>
          </button>
          {showLang && (
            <div className="dropdown-menu lang-menu">
              <button className={`dropdown-item ${lang === 'en' ? 'active' : ''}`} onClick={() => { switchLang('en'); setShowLang(false); }}>
                English {lang === 'en' && <Check size={14} />}
              </button>
              <button className={`dropdown-item ${lang === 'hi' ? 'active' : ''}`} onClick={() => { switchLang('hi'); setShowLang(false); }}>
                हिन्दी {lang === 'hi' && <Check size={14} />}
              </button>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="navbar-dropdown">
          <button className="navbar-icon-btn" onClick={() => { setShowNotifs(!showNotifs); setShowLang(false); }}>
            <Bell size={18} />
            {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          {showNotifs && (
            <div className="dropdown-menu notif-menu">
              <div className="notif-header">
                <span className="notif-title">{t('nav.notifications')}</span>
                {unreadCount > 0 && <button className="notif-read-all" onClick={handleMarkAllRead}>Mark all read</button>}
              </div>
              <div className="notif-list">
                {notifications.length === 0 ? (
                  <div className="notif-empty">No notifications</div>
                ) : notifications.map(n => (
                  <div key={n._id} className={`notif-item ${!n.isRead ? 'unread' : ''} ${getSeverityClass(n.severity)}`} onClick={() => handleNotifClick(n)}>
                    <div className="notif-item-title">{lang === 'hi' && n.titleHi ? n.titleHi : n.title}</div>
                    <div className="notif-item-msg">{lang === 'hi' && n.messageHi ? n.messageHi : n.message}</div>
                    <div className="notif-item-time">{new Date(n.createdAt).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button className="navbar-icon-btn logout-btn" onClick={logout} title={t('nav.logout')}>
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
};

export default Navbar;
