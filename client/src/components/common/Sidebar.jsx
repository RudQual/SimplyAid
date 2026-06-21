import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LayoutDashboard, AlertTriangle, Package, Users, Building2, FileBarChart, Settings, ChevronLeft, ChevronRight, Heart, Lock, LogIn, ScanLine, Stethoscope, FileText, Clock, ShieldCheck, Activity, Bot, Pill } from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ collapsed, onToggle }) => {
  const { user, hasRole, isGuest, requireAuth, t } = useAuth();
  const navigate = useNavigate();

  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: t('nav.dashboard'), roles: null },
    { path: '/incidents', icon: AlertTriangle, label: t('nav.incidents'), roles: null },
    { path: '/treatments', icon: Stethoscope, label: t('nav.treatments'), roles: ['admin'] },
    { path: '/inventory', icon: Package, label: t('nav.inventory'), roles: ['admin'] },
    { path: '/expiry', icon: Clock, label: t('nav.expiry'), roles: ['admin'] },
    { path: '/employees', icon: Users, label: t('nav.employees'), roles: ['admin'] },
    { path: '/scan-history', icon: ScanLine, label: 'Scan History', roles: ['admin'] },
    { path: '/compliance', icon: ShieldCheck, label: t('nav.compliance'), roles: ['admin'] },
    { path: '/analytics', icon: Activity, label: t('nav.analytics'), roles: ['admin'] },
    { path: '/ai-assistant', icon: Bot, label: 'AI Assistant', roles: ['admin'] },
    { path: '/departments', icon: Building2, label: t('nav.departments'), roles: ['admin'] },
    { path: '/reports', icon: FileBarChart, label: t('nav.reports'), roles: ['admin'] },
    { path: '/prescriptions', icon: Pill, label: 'Prescriptions', roles: null },
    { path: '/qr-scan', icon: ScanLine, label: 'QR Scanner', roles: null },
    { path: '/settings', icon: Settings, label: t('nav.settings'), roles: ['admin'] },
  ];

  // Everyone sees all items
  const visible = menuItems;

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon"><Heart size={22} /></div>
          {!collapsed && <div className="logo-text"><span className="logo-name">Simply<span className="logo-accent">AID</span></span><span className="logo-tag">{t('app.tagline')}</span></div>}
        </div>
        <button className="sidebar-toggle" onClick={onToggle}>
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
      <nav className="sidebar-nav">
        {visible.map(item => (
          <NavLink key={item.path} to={item.path} end={item.path === '/'} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} title={collapsed ? item.label : ''}>
            <item.icon size={20} />
            {!collapsed && <span>{item.label}</span>}
            {!collapsed && isGuest && item.roles && <Lock size={12} className="sidebar-lock-icon" />}
          </NavLink>
        ))}
      </nav>
      {!collapsed && (
        <div className="sidebar-footer">
          {isGuest ? (
            <button className="sidebar-signin-btn" onClick={() => navigate('/login')}>
              <LogIn size={18} />
              <span>{t('guest.signInBtn')}</span>
            </button>
          ) : (
            <div className="sidebar-user" onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
              <div className="user-avatar">{user?.name?.charAt(0)}</div>
              <div className="user-info">
                <div className="user-name">
                  {user?.name}
                  {user?.profileCompletionPercentage !== undefined && user.profileCompletionPercentage < 100 && (
                    <span className="profile-badge" title={`${user.profileCompletionPercentage}% Complete`}>!</span>
                  )}
                </div>
                <div className="user-role">{user?.role?.replace('_', ' ')}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
