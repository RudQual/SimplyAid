import { useState, useEffect } from 'react';
import { getNotifications, markNotificationRead, markAllRead, archiveNotification, getNotificationStats } from '../services/api';
import { Bell, CheckCheck, Archive, Search, Filter, AlertTriangle, Info, AlertOctagon } from 'lucide-react';
import toast from 'react-hot-toast';
import './NotificationCenter.css';

const NotificationCenter = () => {
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ category: '', unreadOnly: false, search: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => { loadData(); }, [page, filter.category, filter.unreadOnly]);

  const loadData = async () => {
    try {
      const params = { page, limit: 20 };
      if (filter.category) params.category = filter.category;
      if (filter.unreadOnly) params.unreadOnly = 'true';
      if (filter.search) params.search = filter.search;
      const [notifRes, statsRes] = await Promise.all([
        getNotifications(params),
        getNotificationStats().catch(() => ({ data: { data: null } }))
      ]);
      setNotifications(notifRes.data.data);
      setTotalPages(notifRes.data.pages || 1);
      setStats(statsRes.data.data);
    } catch (e) {}
    finally { setLoading(false); }
  };

  const handleMarkRead = async (id) => {
    await markNotificationRead(id);
    loadData();
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
    toast.success('All marked as read');
    loadData();
  };

  const handleArchive = async (id) => {
    await archiveNotification(id);
    toast.success('Notification archived');
    loadData();
  };

  const severityIcon = (severity) => {
    if (severity === 'critical') return <AlertOctagon size={18} className="notif-icon critical" />;
    if (severity === 'warning') return <AlertTriangle size={18} className="notif-icon warning" />;
    return <Info size={18} className="notif-icon info" />;
  };

  const categories = ['inventory', 'expiry', 'compliance', 'incident', 'certification', 'treatment', 'prescription', 'system'];

  if (loading) return <div className="page-loader"><div className="spinner"></div></div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notification Center</h1>
          <p className="page-subtitle">{stats?.totalUnread || 0} unread notifications</p>
        </div>
        <button className="btn btn-ghost" onClick={handleMarkAllRead}><CheckCheck size={18} />Mark All Read</button>
      </div>

      {/* Category Stats */}
      {stats?.byCategory?.length > 0 && (
        <div className="notif-stats-row" style={{ marginBottom: 20 }}>
          {stats.byCategory.map((cat, i) => (
            <button key={i} className={`notif-stat-chip ${filter.category === cat._id ? 'active' : ''}`}
              onClick={() => setFilter(f => ({ ...f, category: f.category === cat._id ? '' : cat._id }))}>
              {cat._id} <span className="notif-stat-count">{cat.unread}</span>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="notif-filters" style={{ marginBottom: 16 }}>
        <label className="notif-toggle">
          <input type="checkbox" checked={filter.unreadOnly} onChange={e => { setFilter(f => ({ ...f, unreadOnly: e.target.checked })); setPage(1); }} />
          <span>Unread only</span>
        </label>
      </div>

      {/* Notification List */}
      <div className="notif-list">
        {notifications.length > 0 ? notifications.map(n => (
          <div key={n._id} className={`notif-item ${n.isRead ? 'read' : 'unread'}`}>
            {severityIcon(n.severity)}
            <div className="notif-content" onClick={() => !n.isRead && handleMarkRead(n._id)} style={{ cursor: n.isRead ? 'default' : 'pointer' }}>
              <div className="notif-title">{n.title}</div>
              <div className="notif-message">{n.message}</div>
              <div className="notif-meta">
                <span className={`badge badge-${n.severity === 'critical' ? 'red' : n.severity === 'warning' ? 'amber' : 'blue'}`}>{n.type?.replace('_', ' ')}</span>
                <span className="notif-time">{new Date(n.createdAt).toLocaleString()}</span>
              </div>
            </div>
            <div className="notif-actions">
              {!n.isRead && <button className="btn btn-ghost btn-sm" onClick={() => handleMarkRead(n._id)} title="Mark Read"><CheckCheck size={14} /></button>}
              <button className="btn btn-ghost btn-sm" onClick={() => handleArchive(n._id)} title="Archive"><Archive size={14} /></button>
            </div>
          </div>
        )) : (
          <div className="empty-state"><Bell size={48} /><p>No notifications</p></div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
          <span className="page-info">Page {page} of {totalPages}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>Next</button>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
