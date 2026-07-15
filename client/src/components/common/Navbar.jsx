import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useScanner } from '../../contexts/ScannerContext';
import { getNotifications, markAllRead, markNotificationRead, triggerSOS } from '../../services/api';
import { Bell, LogOut, Globe, X, Check, LogIn, UserPlus, Eye, AlertTriangle, Radio, ChevronDown, MapPin, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import './Navbar.css';

const Navbar = () => {
  const { user, isGuest, logout, t, lang, switchLang } = useAuth();
  const { scanners, selectedScanner, setSelectedScanner, scannersByDepartment, loadScanners } = useScanner();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);

  const notifDropdownRef = useRef(null);
  const langDropdownRef = useRef(null);
  const scannerDropdownRef = useRef(null);

  useEffect(() => {
    if (!isGuest) {
      loadNotifications();
      loadScanners();
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [isGuest]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target)) {
        setShowNotifs(false);
      }
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target)) {
        setShowLang(false);
      }
      if (scannerDropdownRef.current && !scannerDropdownRef.current.contains(e.target)) {
        setShowScanner(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const loadNotifications = async () => {
    try {
      const res = await getNotifications({ limit: 10 });
      setNotifications(res.data.data);
      setUnreadCount(res.data.unreadCount);
    } catch (e) { /* silent */ }
  };

  const handleMarkAllRead = async () => {
    try { await markAllRead(); setUnreadCount(0); setNotifications([]); } catch (e) {}
  };

  const handleNotifClick = async (notif) => {
    if (!notif.isRead) {
      try { await markNotificationRead(notif._id); setUnreadCount(c => Math.max(0, c - 1)); } catch (e) {}
    }
    setNotifications(prev => prev.filter(n => n._id !== notif._id));
    setShowNotifs(false);
    if (notif.relatedModel === 'Incident' && notif.relatedId) {
      navigate(`/incidents/${notif.relatedId}`);
    } else if (notif.relatedModel === 'FirstAidBox' && notif.relatedId) {
      navigate(`/inventory/boxes/scan/${notif.relatedId}`);
    } else if (notif.relatedModel === 'User' && notif.relatedId) {
      navigate(`/employees/${notif.relatedId}`);
    }
  };

  // ── SOS Emergency Handler ──
  const handleSOS = async () => {
    const confirmed = window.confirm(
      '🆘 EMERGENCY SOS\n\nThis will immediately:\n• Create an emergency incident report\n• Notify your manager and all doctors\n\nAre you sure you want to trigger SOS?'
    );
    if (!confirmed) return;

    setSosLoading(true);
    try {
      const res = await triggerSOS();
      const { data, message } = res.data;
      toast.success(message || 'SOS sent! Your manager has been notified.', { duration: 5000, icon: '🆘' });
      if (data?._id) {
        navigate(`/incidents/${data._id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send SOS. Please try again.');
    } finally {
      setSosLoading(false);
    }
  };

  const handleScannerSelect = (scanner) => {
    setSelectedScanner(scanner);
    setShowScanner(false);
  };

  const getSeverityClass = (s) => s === 'critical' ? 'notif-critical' : s === 'warning' ? 'notif-warning' : 'notif-info';

  return (
    <header className="navbar">
      <div className="navbar-left">
        <h2 className="navbar-title">{t('app.name')}</h2>
        {isGuest && (
          <span className="navbar-guest-badge">
            <Eye size={12} /> {t('guest.exploreMode')}
          </span>
        )}
      </div>
      <div className="navbar-right">
        {/* Language Toggle */}
        <div className="navbar-dropdown" ref={langDropdownRef}>
          <button className="navbar-icon-btn" onClick={() => { setShowLang(!showLang); setShowNotifs(false); setShowScanner(false); }} title="Language">
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

        {isGuest ? (
          <div className="navbar-guest-actions">
            <button className="navbar-signin-btn" onClick={() => navigate('/login')} id="navbar-signin-btn">
              <LogIn size={16} /> {t('guest.signInBtn')}
            </button>
            <button className="navbar-signup-btn" onClick={() => navigate('/login?mode=signup')} id="navbar-signup-btn">
              <UserPlus size={16} /> {t('guest.signUpBtn')}
            </button>
          </div>
        ) : (
          <>
            {/* Scanner Selector */}
            <div className="navbar-dropdown" ref={scannerDropdownRef}>
              <button
                className={`scanner-selector-btn ${selectedScanner ? 'has-scanner' : 'no-scanner'}`}
                onClick={() => { setShowScanner(!showScanner); setShowNotifs(false); setShowLang(false); }}
                title={selectedScanner ? `Scanner: ${selectedScanner.name}` : 'Select Scanner'}
              >
                <Radio size={16} />
                <span className="scanner-selector-label">
                  {selectedScanner ? selectedScanner.name : 'No Scanner'}
                </span>
                <ChevronDown size={14} className={`scanner-chevron ${showScanner ? 'open' : ''}`} />
              </button>
              {showScanner && (
                <div className="dropdown-menu scanner-menu">
                  <div className="scanner-menu-header">
                    <span className="scanner-menu-title">Select Scanner</span>
                    {selectedScanner && (
                      <button className="scanner-clear-btn" onClick={() => { setSelectedScanner(null); setShowScanner(false); }}>
                        <X size={12} /> Clear
                      </button>
                    )}
                  </div>
                  <div className="scanner-menu-list">
                    {Object.keys(scannersByDepartment).length === 0 ? (
                      <div className="scanner-empty">No scanners available</div>
                    ) : (
                      Object.entries(scannersByDepartment).map(([deptName, deptScanners]) => (
                        <div key={deptName} className="scanner-dept-group">
                          <div className="scanner-dept-label">
                            <Building2 size={12} />
                            <span>{deptName}</span>
                          </div>
                          {deptScanners.map(scanner => (
                            <button
                              key={scanner._id}
                              className={`scanner-option ${selectedScanner?._id === scanner._id ? 'active' : ''}`}
                              onClick={() => handleScannerSelect(scanner)}
                            >
                              <div className="scanner-option-info">
                                <div className="scanner-option-name">{scanner.name}</div>
                                <div className="scanner-option-location">
                                  <MapPin size={11} /> {scanner.location}
                                  {scanner.floor && <span> · {scanner.floor}</span>}
                                </div>
                              </div>
                              {selectedScanner?._id === scanner._id && <Check size={14} className="scanner-check" />}
                            </button>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* SOS Button — directly triggers emergency report */}
            <button className={`sos-btn ${sosLoading ? 'sos-loading' : ''}`} onClick={handleSOS} disabled={sosLoading}>
              {sosLoading ? (
                <span className="spinner" style={{width:16,height:16,borderWidth:2}}></span>
              ) : (
                <AlertTriangle size={18} />
              )}
              <span>SOS</span>
            </button>

            {/* Notifications */}
            <div className="navbar-dropdown" ref={notifDropdownRef}>
              <button className="navbar-icon-btn" onClick={() => { setShowNotifs(!showNotifs); setShowLang(false); setShowScanner(false); }}>
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
                  <div className="notif-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '10px 14px', textAlign: 'center' }}>
                    <button 
                      onClick={() => { navigate('/notifications'); setShowNotifs(false); }} 
                      style={{
                        background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6
                      }}
                    >
                      Review All Notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button className="navbar-icon-btn logout-btn" onClick={logout} title={t('nav.logout')}>
              <LogOut size={18} />
            </button>
          </>
        )}
      </div>
    </header>
  );
};

export default Navbar;
