import { useState, useEffect } from 'react';
import { getNotifications, markNotificationRead, markAllRead, archiveNotification, getNotificationStats, deleteNotification, deleteBulkNotifications } from '../services/api';
import { Bell, CheckCheck, Archive, AlertTriangle, Info, AlertOctagon, Trash2, ShieldCheck, FolderOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import './NotificationCenter.css';

const NotificationCenter = () => {
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ category: '', unreadOnly: false, search: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => { loadData(); }, [page, filter.category, filter.unreadOnly, showArchived]);

  const loadData = async () => {
    try {
      const params = { page, limit: 20 };
      if (filter.category) params.category = filter.category;
      if (filter.unreadOnly) params.unreadOnly = 'true';
      if (filter.search) params.search = filter.search;
      params.archived = showArchived ? 'true' : 'false';

      const [notifRes, statsRes] = await Promise.all([
        getNotifications(params),
        getNotificationStats().catch(() => ({ data: { data: null } }))
      ]);
      setNotifications(notifRes.data.data || []);
      setTotalPages(notifRes.data.pages || 1);
      setStats(statsRes.data.data);
    } catch (e) {
      toast.error('Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
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
    setSelectedIds(prev => prev.filter(x => x !== id));
    loadData();
  };

  const handleDeleteOne = async (id) => {
    try {
      await deleteNotification(id);
      toast.success('Notification deleted');
      setSelectedIds(prev => prev.filter(x => x !== id));
      loadData();
    } catch (e) {
      toast.error('Failed to delete notification');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected notification(s)?`)) {
      try {
        await deleteBulkNotifications(selectedIds);
        toast.success(`${selectedIds.length} notifications deleted`);
        setSelectedIds([]);
        loadData();
      } catch (e) {
        toast.error('Failed to delete notifications');
      }
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(notifications.map(n => n._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id, checked) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(x => x !== id));
    }
  };

  const severityIcon = (severity) => {
    if (severity === 'critical') return <AlertOctagon size={18} className="notif-icon critical" style={{ color: '#ef4444' }} />;
    if (severity === 'warning') return <AlertTriangle size={18} className="notif-icon warning" style={{ color: '#f59e0b' }} />;
    return <Info size={18} className="notif-icon info" style={{ color: '#3b82f6' }} />;
  };

  const allSelected = notifications.length > 0 && selectedIds.length === notifications.length;

  if (loading) return <div className="page-loader"><div className="spinner"></div></div>;

  return (
    <div className="page-content">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Notification Center</h1>
          <p className="page-subtitle">
            {showArchived 
              ? 'Viewing archived messages (kept indefinitely)' 
              : `${stats?.totalUnread || 0} unread notifications (retained for 30 days)`
            }
          </p>
        </div>
        {!showArchived && (
          <button className="btn btn-ghost" onClick={handleMarkAllRead}>
            <CheckCheck size={18} />Mark All Read
          </button>
        )}
      </div>

      {/* Tabs Row */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border-color)', marginBottom: 20, paddingBottom: 2 }}>
        <button 
          className={`btn-tab ${!showArchived ? 'active' : ''}`}
          onClick={() => { setShowArchived(false); setPage(1); setSelectedIds([]); }}
          style={{
            background: 'none', border: 'none', padding: '10px 16px', fontSize: '0.92rem', fontWeight: 600,
            color: !showArchived ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer',
            borderBottom: !showArchived ? '2px solid var(--accent)' : 'none'
          }}
        >
          <Bell size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
          Active Feed (30 Days)
        </button>
        <button 
          className={`btn-tab ${showArchived ? 'active' : ''}`}
          onClick={() => { setShowArchived(true); setPage(1); setSelectedIds([]); }}
          style={{
            background: 'none', border: 'none', padding: '10px 16px', fontSize: '0.92rem', fontWeight: 600,
            color: showArchived ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer',
            borderBottom: showArchived ? '2px solid var(--accent)' : 'none'
          }}
        >
          <FolderOpen size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
          Archived Messages
        </button>
      </div>

      {/* Category Stats */}
      {stats?.byCategory?.length > 0 && !showArchived && (
        <div className="notif-stats-row" style={{ marginBottom: 20 }}>
          {stats.byCategory.map((cat, i) => (
            <button key={i} className={`notif-stat-chip ${filter.category === cat._id ? 'active' : ''}`}
              onClick={() => { setFilter(f => ({ ...f, category: f.category === cat._id ? '' : cat._id })); setPage(1); }}>
              {cat._id} <span className="notif-stat-count">{cat.unread}</span>
            </button>
          ))}
        </div>
      )}

      {/* Action / Selection bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-app)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input 
            type="checkbox" 
            checked={allSelected} 
            onChange={e => handleSelectAll(e.target.checked)}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Select All</span>
        </div>

        {selectedIds.length > 0 && (
          <button 
            onClick={handleDeleteSelected}
            style={{
              background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)',
              padding: '6px 14px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'
            }}
          >
            <Trash2 size={14} /> Delete Selected ({selectedIds.length})
          </button>
        )}
      </div>

      {/* Unread Filters */}
      {!showArchived && (
        <div className="notif-filters" style={{ marginBottom: 16 }}>
          <label className="notif-toggle">
            <input type="checkbox" checked={filter.unreadOnly} onChange={e => { setFilter(f => ({ ...f, unreadOnly: e.target.checked })); setPage(1); }} />
            <span>Unread only</span>
          </label>
        </div>
      )}

      {/* Notification List */}
      <div className="notif-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {notifications.length > 0 ? notifications.map(n => (
          <div key={n._id} className={`notif-item ${n.isRead ? 'read' : 'unread'}`} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '16px 20px', borderRadius: 14, border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
            <input 
              type="checkbox" 
              checked={selectedIds.includes(n._id)} 
              onChange={e => handleSelectOne(n._id, e.target.checked)}
              style={{ width: 16, height: 16, marginTop: 4, cursor: 'pointer' }}
            />
            {severityIcon(n.severity)}
            <div className="notif-content" onClick={() => !n.isRead && handleMarkRead(n._id)} style={{ flex: 1, cursor: n.isRead ? 'default' : 'pointer' }}>
              <div className="notif-title" style={{ fontWeight: n.isRead ? 600 : 700, color: 'var(--text-main)', fontSize: '0.98rem', marginBottom: 4 }}>{n.title}</div>
              <div className="notif-message" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: 8 }}>{n.message}</div>
              <div className="notif-meta" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className={`badge badge-${n.severity === 'critical' ? 'red' : n.severity === 'warning' ? 'amber' : 'blue'}`}>{n.type?.replace('_', ' ')}</span>
                <span className="notif-time" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{new Date(n.createdAt).toLocaleString()}</span>
              </div>
            </div>
            <div className="notif-actions" style={{ display: 'flex', gap: 6 }}>
              {!n.isRead && (
                <button className="btn btn-ghost btn-sm" onClick={() => handleMarkRead(n._id)} title="Mark Read" style={{ padding: 6 }}>
                  <CheckCheck size={16} />
                </button>
              )}
              {!n.archivedAt && (
                <button className="btn btn-ghost btn-sm" onClick={() => handleArchive(n._id)} title="Archive" style={{ padding: 6 }}>
                  <Archive size={16} />
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteOne(n._id)} title="Delete Notification" style={{ padding: 6, color: '#ef4444' }}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )) : (
          <div className="empty-state" style={{ textAlign: 'center', padding: '48px 24px', border: '1px dashed var(--border-color)', borderRadius: 16 }}>
            <Bell size={48} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>No notifications found</p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination" style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
          <span className="page-info" style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Page {page} of {totalPages}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>Next</button>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
