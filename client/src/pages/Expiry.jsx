import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CalendarX2, CalendarClock, AlarmClock, CalendarCheck, RefreshCw, Download, Timer } from 'lucide-react';
import useAsync from '../hooks/useAsync';
import { getExpiryDashboard, getExpiringItems, getDepartments, checkExpiryAlerts, exportReport, removeExpiredStock } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader, StatCard, SearchInput, StatusBadge, EmptyState, ErrorState, SkeletonRows, Pagination, Tabs, useConfirm } from '../components/ui';
import { CATEGORIES, labelize, formatDate, formatDateTime, daysLabel, errorMessage, saveBlob, timeAgo } from '../utils/format';

const LIMIT = 20;
const TABS = [
  { value: 'attention', label: 'Needs action' },
  { value: 'expired', label: 'Expired' },
  { value: 'critical', label: '≤ 7 days' },
  { value: 'soon', label: '8–30 days' },
  { value: 'warning', label: '31–90 days' },
  { value: 'ok', label: 'Healthy' }
];

const Expiry = () => {
  const { can } = useAuth();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const [checking, setChecking] = useState(false);
  const f = {
    status: params.get('status') || 'attention',
    search: params.get('search') || '',
    category: params.get('category') || '',
    department: params.get('department') || '',
    page: Number(params.get('page')) || 1
  };
  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const dash = useAsync(() => getExpiryDashboard({ department: f.department || undefined }), [f.department], { select: (r) => r.data.data });
  const list = useAsync(() => getExpiringItems({
    status: f.status, search: f.search || undefined, category: f.category || undefined, department: f.department || undefined, page: f.page, limit: LIMIT
  }), [params.toString()]);
  const depts = useAsync(() => getDepartments(), []);

  const s = dash.data?.summary;
  const schedule = dash.data?.schedule;

  const runCheck = async () => {
    setChecking(true);
    try { const res = await checkExpiryAlerts(); toast.success(res.data.message); dash.refresh(); } catch (err) { toast.error(errorMessage(err)); } finally { setChecking(false); }
  };
  const exportCsv = async () => {
    try { const res = await exportReport('expiry', 'csv', { status: f.status === 'ok' ? undefined : f.status }); saveBlob(res.data, `expiry-${new Date().toISOString().slice(0, 10)}.csv`); } catch (err) { toast.error(errorMessage(err, 'Export failed')); }
  };
  const removeExpired = async (row) => {
    const ok = await confirm({ title: `Remove expired ${row.itemName}?`, message: `All expired batches of this item in ${row.boxId} will be removed and logged as written off.`, confirmLabel: 'Remove', tone: 'danger' });
    if (!ok) return;
    try { const res = await removeExpiredStock(row.boxObjId, row.itemId); toast.success(res.data.message); list.refresh(); dash.refresh(); } catch (err) { toast.error(errorMessage(err)); }
  };

  const rows = list.data?.data || [];

  return (
    <div className="page-content">
      <PageHeader
        title="Expiry tracking"
        subtitle="Every batch in every kit, by days until expiry. Checks also run automatically on a schedule."
        actions={(
          <>
            <button className="btn btn-secondary" onClick={exportCsv}><Download size={15} /> Export</button>
            <button className="btn btn-primary" onClick={runCheck} disabled={checking}><RefreshCw size={15} className={checking ? 'spinning' : ''} /> Run check now</button>
          </>
        )}
      />

      {schedule && (
        <div className="alert alert-info mb-24">
          <Timer size={17} />
          <div className="small">
            Automatic check every <strong>{schedule.intervalHours} h</strong>
            {schedule.lastRunAt ? <> · last run {timeAgo(schedule.lastRunAt)} ({formatDateTime(schedule.lastRunAt)}), {schedule.alertsGeneratedLastRun} new alert(s)</> : ' · has not run yet'}
            {schedule.nextRunAt && <> · next around {formatDateTime(schedule.nextRunAt)}</>}. Alerts are never duplicated.
          </div>
        </div>
      )}

      <div className="stat-grid">
        <StatCard label="Expired" value={s?.expiredCount ?? '—'} icon={CalendarX2} tone="red" loading={dash.loading} onClick={() => setFilter('status', 'expired')} meta={`${s?.expiredUnits ?? 0} units must be removed`} />
        <StatCard label="Within 7 days" value={s?.critical7Count ?? '—'} icon={AlarmClock} tone="amber" loading={dash.loading} onClick={() => setFilter('status', 'critical')} meta="batches" />
        <StatCard label="8–30 days" value={s?.critical30Count ?? '—'} icon={CalendarClock} tone="violet" loading={dash.loading} onClick={() => setFilter('status', 'soon')} meta="batches" />
        <StatCard label="31–90 days" value={s?.warning90Count ?? '—'} icon={CalendarClock} tone="blue" loading={dash.loading} onClick={() => setFilter('status', 'warning')} meta="batches" />
        <StatCard label="Healthy" value={s?.healthyCount ?? '—'} icon={CalendarCheck} tone="green" loading={dash.loading} onClick={() => setFilter('status', 'ok')} meta={`of ${s?.totalBatches ?? 0} batches in ${s?.totalBoxes ?? 0} kits`} />
      </div>

      <Tabs value={f.status} onChange={(v) => setFilter('status', v)} tabs={TABS} />

      <div className="card card-flush">
        <div className="toolbar">
          <SearchInput value={f.search} onChange={(v) => setFilter('search', v)} placeholder="Search item, kit, batch…" />
          <select value={f.category} onChange={(e) => setFilter('category', e.target.value)} aria-label="Category">
            <option value="">All categories</option>{CATEGORIES.map((c) => <option key={c} value={c}>{labelize(c)}</option>)}
          </select>
          <select value={f.department} onChange={(e) => setFilter('department', e.target.value)} aria-label="Department">
            <option value="">All departments</option>{(depts.data?.data || []).map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        </div>
        {list.loading && !list.data && <SkeletonRows rows={8} cols={6} />}
        {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
        {list.data && rows.length === 0 && <EmptyState icon={CalendarCheck} title="Nothing here" description="No batches match this expiry band and filters." />}
        {rows.length > 0 && (
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Item</th><th>Kit</th><th className="hide-sm">Batch</th><th className="num">Qty</th><th>Expiry date</th><th>Status</th>{can('manageInventory') && <th className="actions" />}</tr></thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.stockId}>
                    <td><div className="cell-primary">{e.itemName}</div><div className="cell-sub">{labelize(e.itemCategory)}</div></td>
                    <td><Link to={`/kits/${e.boxObjId}`} className="strong">{e.boxId}</Link><div className="cell-sub">{e.boxLocation} · {e.department}</div></td>
                    <td className="mono hide-sm">{e.batchNumber || '—'}</td>
                    <td className="num">{e.currentQty}</td>
                    <td className="nowrap">{formatDate(e.expiryDate)}<div className="cell-sub">{daysLabel(e.daysRemaining)}</div></td>
                    <td><StatusBadge value={e.status} /></td>
                    {can('manageInventory') && <td className="actions">{e.status === 'expired' && <button className="btn btn-danger-soft btn-xs" onClick={() => removeExpired(e)}>Remove</button>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.data && <Pagination page={list.data.currentPage} pages={list.data.pages} total={list.data.total} limit={LIMIT} onChange={(p) => setFilter('page', String(p))} />}
      </div>

      {dash.data?.recentRemovals?.length > 0 && (
        <div className="card card-flush mt-16">
          <div className="card-header"><h3 className="card-title">Recently removed expired stock</h3></div>
          <div className="list">
            {dash.data.recentRemovals.map((t) => (
              <div key={t._id} className="list-item">
                <div className="list-item-main"><div className="list-item-title">{t.itemName} · {t.boxCode}</div><div className="list-item-sub">{formatDateTime(t.createdAt)} · {t.performedByName || 'System'}</div></div>
                <strong className="text-red">{t.quantityChange}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
      {dash.error && <ErrorState error={dash.error} onRetry={dash.reload} />}
    </div>
  );
};

export default Expiry;
