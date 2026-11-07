import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FileBarChart, FileText, FileSpreadsheet, Package, PackageX, CalendarClock, ShieldCheck, SearchCheck, ArrowLeftRight, ClipboardList, History } from 'lucide-react';
import useAsync from '../hooks/useAsync';
import { listReports, getReport, exportReport } from '../services/api';
import { PageHeader, Card, EmptyState, ErrorState, SkeletonRows, Spinner } from '../components/ui';
import { CATEGORIES, labelize, errorMessage, saveBlob, formatDateTime } from '../utils/format';

const META = {
  inventory: { icon: Package, text: 'Stock and fill rate for every catalog item across kits.' },
  'low-stock': { icon: PackageX, text: 'Every kit item below its required quantity, largest shortfall first.' },
  expiry: { icon: CalendarClock, text: 'Batches by days to expiry, including expired stock.' },
  compliance: { icon: ShieldCheck, text: 'Statutory checks plus a score and issues for every kit.' },
  inspections: { icon: SearchCheck, text: 'Inspection history with results and open deficiencies.' },
  'stock-movements': { icon: ArrowLeftRight, text: 'Ledger of restocks, usage, corrections and write-offs.' },
  'accident-register': { icon: ClipboardList, text: 'Reportable accidents (Section 88) with Form 18 status.' },
  activity: { icon: History, text: 'Who did what, and when, across the system.' }
};

// Filters available per report
const FILTERS = {
  inventory: ['category', 'stockStatus'],
  expiry: ['expiryStatus'],
  inspections: ['dates', 'inspectionStatus'],
  'stock-movements': ['dates', 'movementType'],
  'accident-register': ['dates'],
  activity: ['dates']
};

const PREVIEW_ROWS = 50;

const Reports = () => {
  const [params, setParams] = useSearchParams();
  const type = params.get('type') || 'inventory';
  const [filters, setFilters] = useState({});
  const [busy, setBusy] = useState(null);
  const catalog = useAsync(() => listReports(), [], { select: (r) => r.data.data });

  const query = useMemo(() => {
    const q = {};
    if (filters.category) q.category = filters.category;
    if (filters.stockStatus) q.stockStatus = filters.stockStatus;
    if (filters.status) q.status = filters.status;
    if (filters.type) q.type = filters.type;
    if (filters.startDate) q.startDate = filters.startDate;
    if (filters.endDate) q.endDate = filters.endDate;
    return q;
  }, [filters]);

  const report = useAsync(() => getReport(type, query), [type, JSON.stringify(query)], { select: (r) => r.data.data });

  const choose = (t) => { setFilters({}); setParams({ type: t }, { replace: true }); };
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const download = async (format) => {
    setBusy(format);
    try {
      const res = await exportReport(type, format, query);
      saveBlob(res.data, `simplyaid-${type}-${new Date().toISOString().slice(0, 10)}.${format}`);
      toast.success(`${format.toUpperCase()} downloaded`);
    } catch (err) {
      toast.error(errorMessage(err, 'Export failed'));
    } finally {
      setBusy(null);
    }
  };

  const available = catalog.data || [];
  const f = FILTERS[type] || [];
  const r = report.data;

  return (
    <div className="page-content">
      <PageHeader title="Reports" subtitle="Preview any report on live data, then export it as CSV (spreadsheets) or PDF (print & audits)." />

      <div className="report-grid">
        <div className="stack-sm">
          {catalog.loading && <SkeletonRows rows={6} cols={1} />}
          {available.map((rep) => {
            const M = META[rep.type] || { icon: FileBarChart, text: '' };
            return (
              <button key={rep.type} className={`card report-option ${rep.type === type ? 'active' : ''}`} onClick={() => choose(rep.type)}>
                <span className={`stat-icon ${rep.type === type ? 'tone-blue' : 'tone-slate'}`}><M.icon size={17} /></span>
                <span style={{ minWidth: 0 }}><span className="strong" style={{ display: 'block' }}>{rep.title}</span><span className="xsmall muted">{M.text}</span></span>
              </button>
            );
          })}
        </div>

        <div className="card card-flush" style={{ minWidth: 0 }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">{r?.title || 'Report'}</h3>
              <p className="card-subtitle">{r ? `${r.rows.length} row${r.rows.length === 1 ? '' : 's'} · generated ${formatDateTime(r.generatedAt)}` : 'Loading…'}</p>
            </div>
            <div className="row">
              <button className="btn btn-secondary btn-sm" onClick={() => download('csv')} disabled={Boolean(busy) || !r}>{busy === 'csv' ? <Spinner size="sm" /> : <FileSpreadsheet size={15} />} CSV</button>
              <button className="btn btn-primary btn-sm" onClick={() => download('pdf')} disabled={Boolean(busy) || !r}>{busy === 'pdf' ? <Spinner size="sm" light /> : <FileText size={15} />} PDF</button>
            </div>
          </div>
          {f.length > 0 && (
            <div className="toolbar" style={{ paddingBottom: 0 }}>
              {f.includes('category') && <select value={filters.category || ''} onChange={set('category')} aria-label="Category"><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c} value={c}>{labelize(c)}</option>)}</select>}
              {f.includes('stockStatus') && <select value={filters.stockStatus || ''} onChange={set('stockStatus')} aria-label="Stock status"><option value="">Any stock status</option>{['in_stock', 'low_stock', 'out_of_stock', 'not_stocked'].map((s) => <option key={s} value={s}>{labelize(s)}</option>)}</select>}
              {f.includes('expiryStatus') && <select value={filters.status || ''} onChange={set('status')} aria-label="Expiry status"><option value="">All batches</option><option value="attention">Needs action (≤ 30 days)</option><option value="expired">Expired</option><option value="warning">31–90 days</option></select>}
              {f.includes('inspectionStatus') && <select value={filters.status || ''} onChange={set('status')} aria-label="Result"><option value="">Any result</option>{['adequate', 'needs_replenishment', 'items_expired', 'failed'].map((s) => <option key={s} value={s}>{labelize(s)}</option>)}</select>}
              {f.includes('movementType') && <select value={filters.type || ''} onChange={set('type')} aria-label="Type"><option value="">All movements</option>{['restock', 'dispense', 'adjustment', 'expired_removal'].map((s) => <option key={s} value={s}>{labelize(s)}</option>)}</select>}
              {f.includes('dates') && (
                <>
                  <input type="date" value={filters.startDate || ''} onChange={set('startDate')} style={{ width: 'auto' }} aria-label="From" />
                  <input type="date" value={filters.endDate || ''} onChange={set('endDate')} style={{ width: 'auto' }} aria-label="To" />
                </>
              )}
            </div>
          )}
          {r?.summary && (
            <div style={{ padding: '14px 20px 0' }}>
              {r.summary.map((line) => <div key={line} className={`small ${line.startsWith('FAIL') ? 'text-red' : line.startsWith('PASS') ? 'text-green' : 'strong'}`}>{line}</div>)}
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            {report.loading && <SkeletonRows rows={8} cols={5} />}
            {report.error && <ErrorState error={report.error} onRetry={report.reload} />}
            {r && !report.loading && r.rows.length === 0 && <EmptyState icon={FileBarChart} title="No rows" description="Nothing matches the selected filters." />}
            {r && !report.loading && r.rows.length > 0 && (
              <div className="table-container" style={{ maxHeight: 560 }}>
                <table className="data-table">
                  <thead><tr>{r.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
                  <tbody>
                    {r.rows.slice(0, PREVIEW_ROWS).map((row, idx) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <tr key={idx}>{r.columns.map((c) => <td key={c.key} className="small">{row[c.key] === '' || row[c.key] === undefined || row[c.key] === null ? '—' : String(row[c.key])}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {r && r.rows.length > PREVIEW_ROWS && <p className="small muted" style={{ padding: '12px 20px' }}>Showing the first {PREVIEW_ROWS} of {r.rows.length} rows. Export to get everything.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
