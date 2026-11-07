import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Bell, CheckCheck, Archive, ArchiveRestore, Trash2, Mail, MailOpen, ArrowRight } from 'lucide-react';
import useAsync from '../hooks/useAsync';
import {
  getNotifications, getNotificationStats, markNotificationRead, markAllRead, archiveNotification, deleteNotification,
  deleteBulkNotifications, markBulkRead
} from '../services/api';
import { useNotifications } from '../contexts/NotificationContext';
import { PageHeader, SearchInput, EmptyState, ErrorState, SkeletonRows, Pagination, Tabs, useConfirm } from '../components/ui';
import { labelize, timeAgo, formatDateTime, errorMessage } from '../utils/format';
import { notifText } from '../utils/i18n';
import { useAuth } from '../contexts/AuthContext';
import './NotificationCenter.css';

const LIMIT = 20;
const CATEGORIES = ['inventory', 'expiry', 'compliance', 'incident', 'certification', 'treatment', 'system'];

const NotificationCenter = () => {
  const { open, refresh: refreshBell } = useNotifications();
  const { t } = useAuth();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState(() => new Set());
  const f = {
    view: params.get('view') || 'all', category: params.get('category') || '', severity: params.get('severity') || '',
    search: params.get('search') || '', page: Number(params.get('page')) || 1
  };
  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
    setSelected(new Set());
  };
  const query = {
    page: f.page, limit: LIMIT, category: f.category || undefined, severity: f.severity || undefined, search: f.search || undefined,
    unreadOnly: f.view === 'unread' ? 'true' : undefined, archived: f.view === 'archived' ? 'true' : undefined
  };
  const list = useAsync(() => getNotifications(query), [params.toString()]);
  const stats = useAsync(() => getNotificationStats(), [], { select: (r) => r.data.data });

  const after = () => { list.refresh(); stats.refresh(); refreshBell(); setSelected(new Set()); };
  const act = async (fn, msg) => { try { const res = await fn(); toast.success(msg || res.data.message || 'Done'); after(); } catch (err) { toast.error(errorMessage(err)); } };

  const rows = list.data?.data || [];
  const allSelected = rows.length > 0 && rows.every((n) => selected.has(n._id));
  const toggle = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ids = [...selected];

  const bulkDelete = async () => {
    const ok = await confirm({ title: t('notif.deleteConfirm', { n: ids.length }), message: t('notif.cannotUndo'), confirmLabel: t('notif.delete'), tone: 'danger' });
    if (ok) act(() => deleteBulkNotifications(ids));
  };

  return (
    <div className="page-content" style={{ maxWidth: 1100 }}>
      <PageHeader title={t('top.notifications')} subtitle={t('notif.subtitle')}
        actions={<button className="btn btn-secondary" onClick={() => act(markAllRead)} disabled={!stats.data?.totalUnread}><CheckCheck size={16} /> {t('top.markAllRead')}</button>} />

      <Tabs value={f.view} onChange={(v) => setFilter('view', v === 'all' ? '' : v)} tabs={[
        { value: 'all', label: t('notif.inbox') },
        { value: 'unread', label: t('notif.unread'), count: stats.data?.totalUnread },
        { value: 'archived', label: t('notif.archived') }
      ]} />

      <div className="card card-flush">
        <div className="toolbar">
          <SearchInput value={f.search} onChange={(v) => setFilter('search', v)} placeholder={t('notif.search')} />
          <select value={f.category} onChange={(e) => setFilter('category', e.target.value)} aria-label="Category">
            <option value="">{t('notif.allCategories')}</option>
            {CATEGORIES.map((c) => {
              const s = stats.data?.byCategory?.find((x) => x._id === c);
              return <option key={c} value={c}>{labelize(c)}{s ? ` (${t('notif.unreadCount', { n: s.unread })})` : ''}</option>;
            })}
          </select>
          <select value={f.severity} onChange={(e) => setFilter('severity', e.target.value)} aria-label="Severity">
            <option value="">{t('notif.anySeverity')}</option><option value="critical">{t('notif.critical')}</option><option value="warning">{t('notif.warning')}</option><option value="info">{t('notif.info')}</option>
          </select>
        </div>

        {selected.size > 0 && (
          <div className="bulk-bar">
            <span className="small strong">{t('notif.selected', { n: selected.size })}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => act(() => markBulkRead(ids))}><MailOpen size={14} /> {t('notif.markRead')}</button>
            <button className="btn btn-danger-soft btn-sm" onClick={bulkDelete}><Trash2 size={14} /> {t('notif.delete')}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>{t('notif.clear')}</button>
          </div>
        )}

        {list.loading && !list.data && <SkeletonRows rows={8} cols={3} />}
        {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
        {list.data && rows.length === 0 && <EmptyState icon={Bell} title={f.view === 'archived' ? t('notif.noArchived') : t('notif.caughtUp')} description={t('notif.newHere')} />}
        {rows.length > 0 && (
          <div>
            <div className="notif-head">
              <label className="checkbox-row"><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((n) => n._id)))} /> <span className="xsmall muted">{t('notif.selectPage')}</span></label>
            </div>
            {rows.map((n) => (
              <div key={n._id} className={`notif-item ${n.isRead ? '' : 'unread'}`}>
                <input type="checkbox" checked={selected.has(n._id)} onChange={() => toggle(n._id)} aria-label="Select notification" />
                <span className={`notif-sev ${n.isRead ? 'read' : n.severity}`} />
                <button className="notif-body" onClick={() => { open(n); after(); }}>
                  <div className="row wrap" style={{ gap: 8 }}>
                    <span className="notif-title">{notifText(n, 'title')}</span>
                    <span className={`badge badge-${n.severity === 'critical' ? 'red' : n.severity === 'warning' ? 'amber' : 'blue'}`}>{labelize(n.category)}</span>
                  </div>
                  <p className="notif-msg">{notifText(n, 'message')}</p>
                  <span className="xsmall faint" title={formatDateTime(n.createdAt)}>{timeAgo(n.createdAt)}</span>
                </button>
                <div className="notif-actions">
                  <button className="btn btn-ghost btn-icon btn-sm" title={n.isRead ? t('notif.markUnread') : t('notif.markRead')} onClick={() => act(() => markNotificationRead(n._id, !n.isRead), n.isRead ? 'Marked unread' : 'Marked read')}>{n.isRead ? <Mail size={15} /> : <MailOpen size={15} />}</button>
                  <button className="btn btn-ghost btn-icon btn-sm" title={n.archivedAt ? t('notif.restore') : t('notif.archive')} onClick={() => act(() => archiveNotification(n._id, !n.archivedAt))}>{n.archivedAt ? <ArchiveRestore size={15} /> : <Archive size={15} />}</button>
                  <button className="btn btn-ghost btn-icon btn-sm" title={t('notif.delete')} onClick={() => act(() => deleteNotification(n._id))}><Trash2 size={15} /></button>
                  {n.link && <button className="btn btn-ghost btn-icon btn-sm" title={t('notif.open')} onClick={() => open(n)}><ArrowRight size={15} /></button>}
                </div>
              </div>
            ))}
          </div>
        )}
        {list.data && <Pagination page={list.data.currentPage} pages={list.data.pages} total={list.data.total} limit={LIMIT} onChange={(p) => setFilter('page', String(p))} />}
      </div>
    </div>
  );
};

export default NotificationCenter;
