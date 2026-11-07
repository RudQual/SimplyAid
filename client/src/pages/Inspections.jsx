import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { SearchCheck, Download } from 'lucide-react';
import useAsync from '../hooks/useAsync';
import { getInspections, getDepartments, exportReport } from '../services/api';
import { PageHeader, SearchInput, StatusBadge, EmptyState, ErrorState, SkeletonRows, Pagination } from '../components/ui';
import { formatDateTime, labelize, errorMessage, saveBlob } from '../utils/format';

const LIMIT = 20;

const Inspections = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const f = {
    search: params.get('search') || '', status: params.get('status') || '', complianceStatus: params.get('complianceStatus') || '',
    department: params.get('department') || '', startDate: params.get('startDate') || '', endDate: params.get('endDate') || '',
    page: Number(params.get('page')) || 1
  };
  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  const list = useAsync(() => getInspections(Object.fromEntries(Object.entries({ ...f, limit: LIMIT }).filter(([, v]) => v))), [params.toString()]);
  const depts = useAsync(() => getDepartments(), []);

  const exportCsv = async () => {
    try { const res = await exportReport('inspections', 'csv', { status: f.status || undefined, startDate: f.startDate || undefined, endDate: f.endDate || undefined }); saveBlob(res.data, `inspections-${new Date().toISOString().slice(0, 10)}.csv`); } catch (err) { toast.error(errorMessage(err, 'Export failed')); }
  };
  const rows = list.data?.data || [];

  return (
    <div className="page-content">
      <PageHeader title="Inspections" subtitle="History of every kit inspection, with the kit’s compliance at the time." actions={<button className="btn btn-secondary" onClick={exportCsv}><Download size={15} /> Export CSV</button>} />
      <div className="card card-flush">
        <div className="toolbar">
          <SearchInput value={f.search} onChange={(v) => setFilter('search', v)} placeholder="Search kit, inspection ID, inspector…" />
          <select value={f.status} onChange={(e) => setFilter('status', e.target.value)} aria-label="Result">
            <option value="">Any result</option>{['adequate', 'needs_replenishment', 'items_expired', 'failed'].map((s) => <option key={s} value={s}>{labelize(s)}</option>)}
          </select>
          <select value={f.complianceStatus} onChange={(e) => setFilter('complianceStatus', e.target.value)} aria-label="Compliance">
            <option value="">Any compliance</option>{['compliant', 'at_risk', 'non_compliant'].map((s) => <option key={s} value={s}>{labelize(s)}</option>)}
          </select>
          <select value={f.department} onChange={(e) => setFilter('department', e.target.value)} aria-label="Department">
            <option value="">All departments</option>{(depts.data?.data || []).map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
          <input type="date" value={f.startDate} onChange={(e) => setFilter('startDate', e.target.value)} style={{ width: 'auto' }} aria-label="From" />
          <input type="date" value={f.endDate} onChange={(e) => setFilter('endDate', e.target.value)} style={{ width: 'auto' }} aria-label="To" />
        </div>
        {list.loading && !list.data && <SkeletonRows rows={8} cols={5} />}
        {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
        {list.data && rows.length === 0 && <EmptyState icon={SearchCheck} title="No inspections found" description="Inspections are recorded from a kit’s page using “Inspect”." />}
        {rows.length > 0 && (
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Inspection</th><th>Kit</th><th>Inspector</th><th>Result</th><th>Compliance</th><th className="num">Open deficiencies</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id} className="clickable" onClick={() => navigate(`/inspections/${r._id}`)}>
                    <td><div className="cell-primary">{r.inspectionId}</div><div className="cell-sub">{formatDateTime(r.inspectionDate)}</div></td>
                    <td><div className="strong">{r.firstAidBox?.boxId || '—'}</div><div className="cell-sub">{r.firstAidBox?.location}{r.firstAidBox?.department?.name ? ` · ${r.firstAidBox.department.name}` : ''}</div></td>
                    <td>{r.inspector?.name || r.inspectorName}</td>
                    <td><StatusBadge value={r.status} /></td>
                    <td>{r.complianceScore !== undefined && r.complianceScore !== null ? <StatusBadge value={r.complianceStatus} label={`${r.complianceScore}%`} /> : <span className="faint">—</span>}</td>
                    <td className="num">{(r.deficiencies || []).filter((d) => !d.resolved).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.data && <Pagination page={list.data.currentPage} pages={list.data.pages} total={list.data.total} limit={LIMIT} onChange={(p) => setFilter('page', String(p))} />}
      </div>
    </div>
  );
};

export default Inspections;
