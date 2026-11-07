import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Boxes, MapPin, UserRound, CalendarClock, LayoutGrid, List, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import useAsync from '../hooks/useAsync';
import { getBoxes, getDepartments } from '../services/api';
import { PageHeader, SearchInput, StatusBadge, EmptyState, ErrorState, Skeleton, Segmented, ProgressBar } from '../components/ui';
import KitFormModal from '../components/kits/KitFormModal';
import { formatDate, daysLabel } from '../utils/format';
import './Kits.css';

const STATUS_OPTIONS = [
  ['', 'All statuses'], ['adequate', 'Adequate'], ['needs_replenishment', 'Needs restock'],
  ['items_expired', 'Expired items'], ['overdue_inspection', 'Inspection due']
];
const COMPLIANCE_OPTIONS = [['', 'Any compliance'], ['compliant', 'Compliant'], ['at_risk', 'At risk'], ['non_compliant', 'Non-compliant']];

const daysUntil = (d) => (d ? Math.ceil((new Date(d) - Date.now()) / 86400000) : null);

const KitCard = ({ kit }) => {
  const required = kit.items.filter((i) => i.requiredQty > 0);
  const ok = required.filter((i) => i.currentQty >= i.requiredQty).length;
  const fill = required.length ? Math.round((ok / required.length) * 100) : 100;
  const due = daysUntil(kit.nextInspectionDue);
  return (
    <Link to={`/kits/${kit._id}`} className="card card-interactive kit-card">
      <div className="row-between">
        <div className="row" style={{ minWidth: 0 }}>
          <span className="stat-icon tone-blue"><Boxes size={18} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="kit-card-id">{kit.boxId}</div>
            <div className="xsmall muted">Class {kit.classType} · {kit.department?.name}</div>
          </div>
        </div>
        <StatusBadge value={kit.status} />
      </div>
      <div className="kit-card-meta">
        <span><MapPin size={14} /> <span className="truncate">{kit.location}{kit.floor ? ` · ${kit.floor}` : ''}</span></span>
        <span><UserRound size={14} /> <span className="truncate">{kit.inCharge?.name || 'No one in charge'}</span></span>
        <span className={due !== null && due < 0 ? 'text-red' : ''}><CalendarClock size={14} /> {kit.nextInspectionDue ? `Inspection ${daysLabel(due)}` : 'Never inspected'}</span>
      </div>
      <div>
        <div className="row-between xsmall muted" style={{ marginBottom: 6 }}>
          <span>{ok}/{required.length} items at required level</span>
          <span className="row" style={{ gap: 4 }}><ShieldCheck size={13} /> {kit.compliance.score}%</span>
        </div>
        <ProgressBar value={fill} />
      </div>
    </Link>
  );
};

const Kits = () => {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState(() => localStorage.getItem('simplyaid_kits_view') || 'grid');
  const [showCreate, setShowCreate] = useState(false);
  const filters = {
    search: params.get('search') || '',
    department: params.get('department') || '',
    status: params.get('status') || '',
    compliance: params.get('compliance') || '',
    classType: params.get('classType') || ''
  };
  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  const depts = useAsync(() => getDepartments(), []);
  const kits = useAsync(() => getBoxes(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))), [params.toString()]);
  useEffect(() => { localStorage.setItem('simplyaid_kits_view', view); }, [view]);

  const list = kits.data?.data || [];
  const counts = useMemo(() => ({
    total: list.length,
    attention: list.filter((k) => k.status !== 'adequate').length
  }), [list]);

  return (
    <div className="page-content">
      <PageHeader
        title="First aid kits"
        subtitle="Every kit on site, its contents, condition and inspection schedule."
        actions={can('manageInventory') && <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={16} /> New kit</button>}
      />

      <div className="toolbar">
        <SearchInput value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Search kit ID or location…" />
        <select value={filters.department} onChange={(e) => setFilter('department', e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {(depts.data?.data || []).map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} aria-label="Status">
          {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filters.compliance} onChange={(e) => setFilter('compliance', e.target.value)} aria-label="Compliance">
          {COMPLIANCE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filters.classType} onChange={(e) => setFilter('classType', e.target.value)} aria-label="Class">
          <option value="">All classes</option><option value="A">Class A</option><option value="B">Class B</option><option value="C">Class C</option>
        </select>
        <div className="toolbar-spacer" />
        <Segmented value={view} onChange={setView} options={[{ value: 'grid', label: <LayoutGrid size={15} /> }, { value: 'table', label: <List size={15} /> }]} />
      </div>

      {!kits.loading && !kits.error && (
        <p className="small muted mb-16">{counts.total} kit{counts.total === 1 ? '' : 's'} · {counts.attention} need{counts.attention === 1 ? 's' : ''} attention</p>
      )}

      {kits.loading && (
        <div className="kit-grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="card"><Skeleton height={150} /></div>)}</div>
      )}
      {kits.error && <div className="card"><ErrorState error={kits.error} onRetry={kits.reload} /></div>}
      {!kits.loading && !kits.error && list.length === 0 && (
        <div className="card">
          <EmptyState icon={Boxes} title="No kits match these filters" description="Try clearing a filter, or add a new kit."
            action={can('manageInventory') && <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={16} /> New kit</button>} />
        </div>
      )}

      {!kits.loading && list.length > 0 && view === 'grid' && (
        <div className="kit-grid">{list.map((k) => <KitCard key={k._id} kit={k} />)}</div>
      )}

      {!kits.loading && list.length > 0 && view === 'table' && (
        <div className="card card-flush">
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Kit</th><th>Location</th><th>In charge</th><th>Status</th><th className="num">Compliance</th><th>Next inspection</th></tr></thead>
              <tbody>
                {list.map((k) => (
                  <tr key={k._id} className="clickable" onClick={() => navigate(`/kits/${k._id}`)}>
                    <td><div className="cell-primary">{k.boxId}</div><div className="cell-sub">Class {k.classType} · {k.department?.name}</div></td>
                    <td>{k.location}</td>
                    <td>{k.inCharge?.name || <span className="faint">Unassigned</span>}</td>
                    <td><StatusBadge value={k.status} /></td>
                    <td className="num"><StatusBadge value={k.compliance.status} label={`${k.compliance.score}%`} /></td>
                    <td className={daysUntil(k.nextInspectionDue) < 0 ? 'text-red' : ''}>{formatDate(k.nextInspectionDue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <KitFormModal open={showCreate} onClose={() => setShowCreate(false)} onSaved={(kit) => navigate(`/kits/${kit._id}`)} />
    </div>
  );
};

export default Kits;
