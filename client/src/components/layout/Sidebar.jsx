import { NavLink, Link } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { visibleSections } from './navigation';
import { initials, labelize } from '../../utils/format';

const Sidebar = ({ collapsed, onToggle, mobileOpen, onNavigate }) => {
  const { user, t } = useAuth();
  const { unreadCount } = useNotifications();
  const sections = visibleSections(user?.role);

  return (
    <>
      <div className={`sidebar-backdrop ${mobileOpen ? 'show' : ''}`} onClick={onNavigate} />
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-header">
          <Link to="/" className="brand" onClick={onNavigate}>
            <span className="brand-mark" aria-hidden="true" />
            {!collapsed && (
              <span>
                <span className="brand-name">Simply<span>AID</span></span>
                <span className="brand-tag">{t('app.tagline')}</span>
              </span>
            )}
          </Link>
          <button className="sidebar-collapse-btn" onClick={onToggle} aria-label={t('nav.collapse')}><PanelLeftClose size={17} /></button>
        </div>

        <nav className="sidebar-nav">
          {collapsed && (
            <button className="nav-link" onClick={onToggle} aria-label={t('nav.expand')} title={t('nav.expand')}><PanelLeftOpen size={18} /></button>
          )}
          {sections.map((section) => (
            <div className="nav-section" key={section.title}>
              <div className="nav-section-title">{t(section.tkey, null, section.title)}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  title={collapsed ? t(item.tkey, null, item.label) : undefined}
                  onClick={onNavigate}
                >
                  <item.icon size={18} />
                  <span>{t(item.tkey, null, item.label)}</span>
                  {item.badge === 'notifications' && unreadCount > 0 && <span className="nav-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Link to="/profile" className="sidebar-user" onClick={onNavigate} title={collapsed ? user?.name : undefined}>
            <span className="avatar avatar-sm">
              {user?.profilePhoto ? <img src={user.profilePhoto} alt="" /> : initials(user?.name)}
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="sidebar-user-name truncate">{user?.name}</div>
              <div className="sidebar-user-role">{labelize(user?.role)}{user?.department?.name ? ` · ${user.department.name}` : ''}</div>
            </div>
          </Link>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
