import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Menu, Search, Bell, MapPin, Siren, Globe, LogOut, Settings, UserRound, CheckCheck, ChevronDown, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useScanner } from '../../contexts/ScannerContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { triggerSOS } from '../../services/api';
import { useConfirm } from '../ui';
import { errorMessage, initials, labelize, timeAgo } from '../../utils/format';
import { notifText } from '../../utils/i18n';

const useClickOutside = (ref, onOutside) => {
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onOutside(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onOutside]);
};

const Topbar = ({ collapsed, onMenu, onSearch }) => {
  const { user, logout, lang, switchLang, t } = useAuth();
  const { scannersByDepartment, selectedScanner, setSelectedScanner, loadScanners } = useScanner();
  const { unreadCount, recent, open, readAll, refresh } = useNotifications();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(null); // 'notifications' | 'user' | 'location'
  const [sosBusy, setSosBusy] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setMenu(null));

  useEffect(() => { loadScanners(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const toggle = (name) => {
    setMenu((m) => (m === name ? null : name));
    if (name === 'notifications') refresh();
  };

  const handleSOS = async () => {
    const ok = await confirm({
      title: t('sos.confirmTitle'),
      message: t('sos.confirmMsg'),
      confirmLabel: t('sos.confirmBtn'),
      tone: 'danger'
    });
    if (!ok) return;
    setSosBusy(true);
    try {
      const res = await triggerSOS();
      toast.success(lang === 'hi' ? t('sos.employeeBanner') : (res.data.message || t('sos.sent')), { duration: 6000 });
      if (res.data.data?._id) navigate(`/incidents/${res.data.data._id}`);
    } catch (err) {
      toast.error(errorMessage(err, t('sos.failed')));
    } finally {
      setSosBusy(false);
    }
  };

  return (
    <header className={`navbar ${collapsed ? 'collapsed' : ''}`} ref={ref}>
      <button className="icon-btn navbar-menu-btn" onClick={onMenu} aria-label="Open menu"><Menu size={20} /></button>

      <button className="global-search-trigger" onClick={onSearch} aria-label="Search">
        <Search size={16} />
        <span className="label">{t('top.search')}</span>
        <span className="kbd">Ctrl K</span>
      </button>

      <div className="navbar-spacer" />

      <div className="navbar-actions">
        {/* Active location (scanner) — pre-fills incident reports */}
        <div className="dropdown">
          <button className={`location-btn ${selectedScanner ? 'active' : ''}`} onClick={() => toggle('location')} title={t('top.currentLocation')}>
            <MapPin size={15} />
            <span className="label truncate">{selectedScanner ? selectedScanner.location : t('top.setLocation')}</span>
            <ChevronDown size={14} className="label" />
          </button>
          {menu === 'location' && (
            <div className="dropdown-menu" style={{ width: 300, maxHeight: 380, overflowY: 'auto' }}>
              <div className="dropdown-label">{t('top.currentLocation')}</div>
              <p className="xsmall muted" style={{ padding: '0 10px 6px' }}>{t('top.locationHint')}</p>
              {selectedScanner && (
                <button className="dropdown-item danger" onClick={() => { setSelectedScanner(null); setMenu(null); }}><X size={15} /> {t('top.clearLocation')}</button>
              )}
              {Object.keys(scannersByDepartment).length === 0 && <p className="small muted" style={{ padding: 10 }}>{t('top.noLocations')}</p>}
              {Object.entries(scannersByDepartment).map(([dept, list]) => (
                <div key={dept}>
                  <div className="dropdown-label">{dept}</div>
                  {list.map((s) => (
                    <button key={s._id} className={`dropdown-item ${selectedScanner?._id === s._id ? 'active' : ''}`} onClick={() => { setSelectedScanner(s); setMenu(null); }}>
                      <MapPin size={14} />
                      <span><span style={{ display: 'block', fontWeight: 600 }}>{s.name}</span><span className="xsmall muted">{s.location}</span></span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {['employee', 'manager'].includes(user?.role) && (
          <button className="sos-btn" onClick={handleSOS} disabled={sosBusy} title="Emergency SOS / आपातकालीन SOS">
            <Siren size={16} /> <span className="label">{sosBusy ? t('sos.sending') : t('sos.button')}</span>
          </button>
        )}

        <button className="lang-btn" onClick={() => switchLang(lang === 'en' ? 'hi' : 'en')} title={t('top.switchLang')} aria-label={t('top.switchLang')}>
          <Globe size={15} /> <span>{t('top.langShort')}</span>
        </button>

        {/* Notifications */}
        <div className="dropdown">
          <button className="icon-btn" onClick={() => toggle('notifications')} aria-label={`Notifications (${unreadCount} unread)`}>
            <Bell size={18} />
            {unreadCount > 0 && <span className="dot">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>
          {menu === 'notifications' && (
            <div className="dropdown-menu notif-menu">
              <div className="notif-menu-header">
                <strong>{t('top.notifications')}</strong>
                {unreadCount > 0 && (
                  <button className="btn btn-ghost btn-xs" onClick={async () => { try { await readAll(); } catch (e) { toast.error(errorMessage(e)); } }}>
                    <CheckCheck size={14} /> {t('top.markAllRead')}
                  </button>
                )}
              </div>
              <div className="notif-menu-list">
                {recent.length === 0 && <p className="small muted" style={{ padding: 24, textAlign: 'center' }}>{t('top.caughtUp')}</p>}
                {recent.map((n) => (
                  <button key={n._id} className={`notif-row ${n.isRead ? '' : 'unread'} ${n.title?.startsWith('SOS') ? 'sos' : ''}`} onClick={() => { setMenu(null); open(n); }}>
                    <span className={`notif-sev ${n.isRead ? 'read' : n.severity}`} />
                    <span style={{ minWidth: 0 }}>
                      <span className="notif-row-title" style={{ display: 'block' }}>{notifText(n, 'title')}</span>
                      <span className="notif-row-msg">{notifText(n, 'message')}</span>
                      <span className="notif-row-time" style={{ display: 'block' }}>{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="notif-menu-footer">
                <Link to="/notifications" className="card-link" onClick={() => setMenu(null)}>{t('top.viewAll')}</Link>
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="dropdown">
          <button className="user-btn" onClick={() => toggle('user')} aria-label="Account menu">
            <span className="avatar avatar-sm">{user?.profilePhoto ? <img src={user.profilePhoto} alt="" /> : initials(user?.name)}</span>
            <ChevronDown size={14} className="muted user-btn-name" />
          </button>
          {menu === 'user' && (
            <div className="dropdown-menu">
              <div style={{ padding: '8px 10px 10px' }}>
                <div className="strong truncate">{user?.name}</div>
                <div className="xsmall muted truncate">{user?.email}</div>
                <div className="row" style={{ marginTop: 6 }}><span className={`badge badge-${user?.role}`}>{labelize(user?.role)}</span>{user?.company?.name && <span className="xsmall muted truncate">{user.company.name}</span>}</div>
              </div>
              <div className="dropdown-divider" />
              <button className="dropdown-item" onClick={() => { setMenu(null); navigate('/profile'); }}><UserRound size={16} /> {t('top.myProfile')}</button>
              <button className="dropdown-item" onClick={() => { setMenu(null); navigate('/settings'); }}><Settings size={16} /> {t('top.settings')}</button>
              <div className="dropdown-divider" />
              <button className="dropdown-item danger" onClick={logout}><LogOut size={16} /> {t('top.signOut')}</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
