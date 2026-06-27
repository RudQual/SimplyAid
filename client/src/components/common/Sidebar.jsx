import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LayoutDashboard, AlertTriangle, Package, Users, Building2, FileBarChart, Settings, ChevronLeft, ChevronRight, Heart, Lock, LogIn, ScanLine, Stethoscope, FileText, Clock, ShieldCheck, Activity, Bot, Pill, ClipboardCheck, UserCog } from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ collapsed, onToggle }) => {
  const { user, hasRole, isGuest, requireAuth, t } = useAuth();
  const navigate = useNavigate();

  // Role-based menu configuration
  // null roles = visible to everyone, specific roles = restricted
  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: t('nav.dashboard'), roles: null },
    { path: '/incidents', icon: AlertTriangle, label: t('nav.incidents'), roles: null },
    { path: '/incidents/new', icon: FileText, label: 'Report Incident', roles: ['user', 'manager'] },
    { path: '/qr-scan', icon: ScanLine, label: 'QR Scanner', roles: null },

    // Manager-specific
    { path: '/manager-dashboard', icon: ClipboardCheck, label: 'Confirmations', roles: ['manager'] },

    // Doctor-specific
    { path: '/doctor-dashboard', icon: Stethoscope, label: 'Doctor Dashboard', roles: ['doctor'] },
    { path: '/treatments', icon: Stethoscope, label: t('nav.treatments'), roles: ['doctor'] },
    { path: '/inventory', icon: Package, label: t('nav.inventory'), roles: ['doctor'] },
    { path: '/expiry', icon: Clock, label: t('nav.expiry'), roles: ['doctor'] },
    { path: '/prescriptions', icon: Pill, label: 'Prescriptions', roles: ['doctor'] },
    { path: '/employees', icon: Users, label: t('nav.employees'), roles: ['doctor', 'manager'] },
    { path: '/scan-history', icon: ScanLine, label: 'Scan History', roles: ['doctor', 'manager'] },
    { path: '/compliance', icon: ShieldCheck, label: t('nav.compliance'), roles: ['doctor'] },
    { path: '/analytics', icon: Activity, label: t('nav.analytics'), roles: ['doctor'] },
    { path: '/ai-assistant', icon: Bot, label: 'AI Assistant', roles: ['doctor'] },
    { path: '/departments', icon: Building2, label: t('nav.departments'), roles: ['doctor'] },
    { path: '/reports', icon: FileBarChart, label: t('nav.reports'), roles: ['doctor', 'manager'] },
    { path: '/settings', icon: Settings, label: t('nav.settings'), roles: ['doctor'] },
  ];

  // Filter menu items based on user role
  const visible = menuItems.filter(item => {
    if (!item.roles) return true; // null roles = visible to all
    if (!user) return false; // guests can't see role-restricted items
    return item.roles.includes(user.role);
  });

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
