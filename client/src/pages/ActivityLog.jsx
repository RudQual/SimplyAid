import { Fragment, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { History, Download, Lock, ChevronDown, ChevronRight } from 'lucide-react';
import useAsync from '../hooks/useAsync';
import { getAuditLogs, exportReport } from '../services/api';
import { PageHeader, SearchInput, EmptyState, ErrorState, SkeletonRows, Pagination } from '../components/ui';
import { formatDateTime, labelize, errorMessage, saveBlob, initials } from '../utils/format';

const LIMIT = 25;
const ENTITIES = ['FirstAidBox', 'Inventory', 'InventoryItem', 'Inspection', 'Compliance', 'Incident', 'Treatment', 'User', 'Department', 'Auth', 'Report', 'MedicalProfile', 'QrScan', 'Scanner', 'System'];
const ENTITY_LABEL = { FirstAidBox: 'Kit', Inventory: 'Stock', InventoryItem: 'Catalog item', QrScan: 'QR scan', MedicalProfile: 'Medical profile', Auth: 'Sign-in' };

const show = (v) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

const ActivityLog = () => {
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(null);
  const f = { search: params.get('search') || '', entity: params.get('entity') || '', startDate: params.get('startDate') || '', endDate: params.get('endDate') || '', page: Number(params.get('page')) || 1 };
  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  const logs = useAsync(() => getAuditLogs(Object.fromEntries(Object.entries({ ...f, limit: LIMIT }).filter(([, v]) => v))), [params.toString()]);
  const exportCsv = async () => {
    try { const res = await exportReport('activity', 'csv', { entity: f.entity || undefined, search: f.search || undefined, startDate: f.startDate || undefined, endDate: f.endDate || undefined }); saveBlob(res.data, `activity-${new Date().toISOString().slice(0, 10)}.csv`); } catch (err) { toast.error(errorMessage(err, 'Export failed')); }
  };
  const rows = logs.data?.data || [];

  return (
    <div className="page-content">
      <PageHeader title="Activity log" subtitle="A permanent record of important actions. Entries cannot be edited or deleted."
        actions={<button className="btn btn-secondary" onClick={exportCsv}><Download size={15} /> Export CSV</button>} />
      <div className="card card-flush">
        <div className="toolbar">
          <SearchInput value={f.search} onChange={(v) => setFilter('search', v)} placeholder="Search action, person, record…" />
          <select value={f.entity} onChange={(e) => setFilter('entity', e.target.value)} aria-label="Record type">
            <option value="">All record types</option>{ENTITIES.map((e) => <option key={e} value={e}>{ENTITY_LABEL[e] || labelize(e)}</option>)}
          </select>
          <input type="date" value={f.startDate} onChange={(e) => setFilter('startDate', e.target.value)} style={{ width: 'auto' }} aria-label="From" />
          <input type="date" value={f.endDate} onChange={(e) => setFilter('endDate', e.target.value)} style={{ width: 'auto' }} aria-label="To" />
          <div className="toolbar-spacer" />
          <span className="xsmall muted row"><Lock size={13} /> Read-only</span>
        </div>
        {logs.loading && !logs.data && <SkeletonRows rows={10} cols={4} />}
        {logs.error && <ErrorState error={logs.error} onRetry={logs.reload} />}
        {logs.data && rows.length === 0 && <EmptyState icon={History} title="No activity found" />}
        {rows.length > 0 && (
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th style={{ width: 28 }} /><th>When</th><th>Who</th><th>Action</th><th>Record</th><th className="hide-sm">Details</th></tr></thead>
              <tbody>
                {rows.map((l) => {
                  const hasChanges = l.changes && Object.keys(l.changes).length > 0;
                  return (
                    <Fragment key={l._id}>
                      <tr className={hasChanges ? 'clickable' : ''} onClick={() => hasChanges && setOpen(open === l._id ? null : l._id)}>
                        <td>{hasChanges && (open === l._id ? <ChevronDown size={15} className="muted" /> : <ChevronRight size={15} className="muted" />)}</td>
                        <td className="nowrap small">{formatDateTime(l.createdAt)}</td>
                        <td>
                          <div className="row"><span className="avatar avatar-sm">{initials(l.userName || 'System')}</span>
                            <div><div className="strong small">{l.userName || 'System'}</div><div className="xsmall muted">{labelize(l.userRole || 'system')}</div></div>
                          </div>
                        </td>
                        <td className="cell-primary">{l.action}</td>
                        <td><span className="badge badge-gray">{ENTITY_LABEL[l.entity] || labelize(l.entity)}</span>{l.entityLabel && <div className="cell-sub">{l.entityLabel}</div>}</td>
                        <td className="small muted hide-sm">{l.details || (hasChanges ? `${Object.keys(l.changes).length} field(s) changed` : '—')}</td>
                      </tr>
                      {open === l._id && hasChanges && (
                        <tr className="item-row-expand">
                          <td colSpan={6} style={{ padding: '10px 20px 14px 56px' }}>
                            <table className="batch-table">
                              <thead><tr><th style={{ paddingLeft: 0 }}>Field</th><th>Before</th><th>After</th></tr></thead>
                              <tbody>
                                {Object.entries(l.changes).map(([field, ch]) => (
                                  <tr key={field}><td style={{ paddingLeft: 0 }} className="strong">{labelize(field)}</td><td className="text-red">{show(ch.from)}</td><td className="text-green">{show(ch.to)}</td></tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {logs.data && <Pagination page={logs.data.currentPage} pages={logs.data.pages} total={logs.data.total} limit={LIMIT} onChange={(p) => setFilter('page', String(p))} />}
      </div>
    </div>
  );
};

export default ActivityLog;
