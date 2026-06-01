import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LayoutDashboard, AlertTriangle, Package, Users, Building2, FileBarChart, Settings, ChevronLeft, ChevronRight, Shield, Heart, Pill } from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ collapsed, onToggle }) => {
  const { user, hasRole, t } = useAuth();
  const location = useLocation();

  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: t('nav.dashboard'), roles: null },
    { path: '/incidents', icon: AlertTriangle, label: t('nav.incidents'), roles: null },
    { path: '/inventory', icon: Package, label: t('nav.inventory'), roles: ['admin'] },
    { path: '/employees', icon: Users, label: t('nav.employees'), roles: ['admin'] },
    { path: '/departments', icon: Building2, label: t('nav.departments'), roles: ['admin'] },
    { path: '/reports', icon: FileBarChart, label: t('nav.reports'), roles: ['admin'] },
    { path: '/prescriptions', icon: Pill, label: 'Prescriptions', roles: null },
    { path: '/settings', icon: Settings, label: t('nav.settings'), roles: ['admin'] },
  ];

  const visible = menuItems.filter(item => !item.roles || item.roles.some(r => hasRole(r)));

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
          </NavLink>
        ))}
      </nav>
      {!collapsed && (
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">{user?.name?.charAt(0)}</div>
            <div className="user-info"><div className="user-name">{user?.name}</div><div className="user-role">{user?.role?.replace('_', ' ')}</div></div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
