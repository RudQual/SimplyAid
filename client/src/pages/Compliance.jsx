import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Download, ArrowRight, Info } from 'lucide-react';
import useAsync from '../hooks/useAsync';
import { getCompanyCompliance, getDepartmentCompliance, runComplianceCheck, exportReport } from '../services/api';
import { PageHeader, Card, ScoreRing, StatusBadge, ProgressBar, EmptyState, ErrorState, PageLoader, Tabs, SearchInput } from '../components/ui';
import { errorMessage, saveBlob, formatDate, labelize } from '../utils/format';

const RULES = [
  ['Supplies', '40 pts', 'Share of required items held at or above their required quantity.'],
  ['Expiry', '25 pts', 'Full marks only when the kit contains no expired units.'],
  ['Inspection', '20 pts', 'Kit has been inspected and the next inspection is not overdue.'],
  ['Person in charge', '15 pts', 'A certified first-aider is assigned (half marks if assigned but not certified).']
];

const CheckIcon = ({ c }) => (c.compliant ? <CheckCircle2 size={18} className="text-green" /> : c.status === 'yellow' ? <AlertTriangle size={18} className="text-amber" /> : <XCircle size={18} className="text-red" />);

const Compliance = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('kits');
  const [running, setRunning] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const company = useAsync(() => getCompanyCompliance(), [], { select: (r) => r.data.data });
  const depts = useAsync(() => getDepartmentCompliance(), [], { select: (r) => r.data.data });

  const run = async () => {
    setRunning(true);
    try { const res = await runComplianceCheck(); toast.success(res.data.message); company.refresh(); depts.refresh(); } catch (err) { toast.error(errorMessage(err)); } finally { setRunning(false); }
  };
  const download = async (format) => {
    try { const res = await exportReport('compliance', format); saveBlob(res.data, `compliance-${new Date().toISOString().slice(0, 10)}.${format}`); } catch (err) { toast.error(errorMessage(err, 'Export failed')); }
  };

  if (company.loading && !company.data) return <PageLoader />;
  if (company.error) return <div className="page-content"><div className="card"><ErrorState error={company.error} onRetry={company.reload} /></div></div>;
  const c = company.data;
  const s = c.summary;
  const q = search.trim().toLowerCase();
  const kits = c.boxes.filter((b) => (!statusFilter || b.complianceStatus === statusFilter)
    && (!q || b.boxId.toLowerCase().includes(q) || b.location.toLowerCase().includes(q) || (b.department?.name || '').toLowerCase().includes(q)));

  return (
    <div className="page-content">
      <PageHeader
        title="Compliance"
        subtitle="Factories Act, 1948 — Section 45 (first aid appliances) and Section 88 (accident notices), evaluated on live data."
        actions={(
          <>
            <button className="btn btn-secondary" onClick={() => download('pdf')}><Download size={15} /> PDF report</button>
            <button className="btn btn-primary" onClick={run} disabled={running}><RefreshCw size={15} className={running ? 'spinning' : ''} /> Run check & alert</button>
          </>
        )}
      />

      <div className="grid-main-side mb-24">
        <Card>
          <div className="row wrap" style={{ gap: 28, alignItems: 'center' }}>
            <ScoreRing score={c.overallCompliance} size={140} stroke={12} label="overall" />
            <div style={{ flex: 1, minWidth: 240 }}>
              <div className="row" style={{ marginBottom: 6 }}><StatusBadge value={c.complianceStatus} size="lg" /></div>
              <p className="small muted" style={{ marginBottom: 14 }}>50% the average of the six statutory checks, 50% the average kit score ({s.averageBoxScore}%).</p>
              <div className="grid-3" style={{ gap: 12 }}>
                <div className="mini-stat"><div className="label">Compliant kits</div><div className="value text-green">{s.compliantBoxes}</div></div>
                <div className="mini-stat"><div className="label">At risk</div><div className="value text-amber">{s.atRiskBoxes}</div></div>
                <div className="mini-stat"><div className="label">Non-compliant</div><div className="value text-red">{s.nonCompliantBoxes}</div></div>
              </div>
            </div>
          </div>
        </Card>
        <Card title="Action items" flush>
          {c.pendingActions.length === 0 ? <EmptyState icon={CheckCircle2} title="No open actions" description="Everything checks out." /> : (
            <div className="list">
              {c.pendingActions.map((a) => (
                <Link key={a.message} to={a.link} className="list-item">
                  <span className={`list-icon ${a.severity === 'critical' ? 'tone-red' : 'tone-amber'}`}><AlertTriangle size={16} /></span>
                  <div className="list-item-main"><div className="list-item-title" style={{ whiteSpace: 'normal' }}>{a.message}</div></div>
                  <ArrowRight size={15} className="faint" />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Statutory checks" className="mb-24" flush>
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th style={{ width: 36 }} /><th>Requirement</th><th>Reference</th><th className="num">Required</th><th className="num">Current</th><th className="num">Score</th><th>Result</th></tr></thead>
            <tbody>
              {c.checks.map((k) => (
                <tr key={k.key}>
                  <td><CheckIcon c={k} /></td>
                  <td className="cell-primary">{k.rule}</td>
                  <td className="muted small">{k.section}</td>
                  <td className="num">{k.required}</td>
                  <td className="num">{k.actual}</td>
                  <td className="num strong">{k.score}%</td>
                  <td><StatusBadge value={k.compliant ? 'compliant' : k.status === 'yellow' ? 'at_risk' : 'non_compliant'} label={k.compliant ? 'Pass' : 'Fail'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'kits', label: 'By kit', count: c.boxes.length },
        { value: 'departments', label: 'By department', count: depts.data?.departments?.length },
        { value: 'rules', label: 'How scores work' }
      ]} />

      {tab === 'kits' && (
        <div className="card card-flush">
          <div className="toolbar">
            <SearchInput value={search} onChange={setSearch} placeholder="Search kits…" delay={0} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Compliance status">
              <option value="">All</option><option value="non_compliant">Non-compliant</option><option value="at_risk">At risk</option><option value="compliant">Compliant</option>
            </select>
          </div>
          {kits.length === 0 ? <EmptyState icon={ShieldCheck} title="No kits match" /> : (
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>Kit</th><th style={{ minWidth: 140 }}>Score</th><th>Issues</th><th className="hide-sm">Last inspected</th></tr></thead>
                <tbody>
                  {kits.map((b) => (
                    <tr key={b._id} className="clickable" onClick={() => navigate(`/kits/${b._id}`)}>
                      <td><div className="cell-primary">{b.boxId}</div><div className="cell-sub">{b.location} · {b.department?.name}</div></td>
                      <td><div className="row"><div style={{ flex: 1 }}><ProgressBar value={b.score} tone={b.complianceStatus === 'compliant' ? 'green' : b.complianceStatus === 'at_risk' ? 'amber' : 'red'} /></div><strong className="small" style={{ width: 38, textAlign: 'right' }}>{b.score}%</strong></div></td>
                      <td>{b.issues.length ? <div className="stack-sm" style={{ gap: 3 }}>{b.issues.map((i) => <span key={i.message} className={`small ${i.severity === 'critical' ? 'text-red' : 'text-amber'}`}>• {i.message}</span>)}</div> : <span className="text-green small">No issues</span>}</td>
                      <td className="hide-sm">{formatDate(b.lastInspectionDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'departments' && (
        <div className="card card-flush">
          {depts.loading ? <PageLoader /> : depts.error ? <ErrorState error={depts.error} onRetry={depts.reload} /> : (
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>Department</th><th style={{ minWidth: 140 }}>Score</th><th className="num">People</th><th className="num">Kits (req.)</th><th className="num">Missing supplies</th><th className="num">Overdue</th><th className="num hide-sm">Incidents (30d)</th></tr></thead>
                <tbody>
                  {depts.data.departments.map((d) => (
                    <tr key={d.department._id}>
                      <td><div className="cell-primary">{d.department.name}</div><div className="cell-sub">{labelize(d.department.riskLevel)} risk</div></td>
                      <td><div className="row"><div style={{ flex: 1 }}><ProgressBar value={d.complianceScore} tone={d.status === 'green' ? 'green' : d.status === 'yellow' ? 'amber' : 'red'} /></div><strong className="small" style={{ width: 38, textAlign: 'right' }}>{d.complianceScore}%</strong></div></td>
                      <td className="num">{d.employeeCount}</td>
                      <td className={`num ${d.availableBoxes < d.requiredBoxes ? 'text-red' : ''}`}>{d.availableBoxes} ({d.requiredBoxes})</td>
                      <td className="num">{d.boxesMissingSupplies}</td>
                      <td className="num">{d.overdueInspections}</td>
                      <td className="num hide-sm">{d.incidentCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'rules' && (
        <Card>
          <div className="alert alert-info mb-16"><Info size={16} /> Each kit is scored out of 100 from four rules. ≥ 90 is compliant, ≥ 70 at risk, below 70 non-compliant. Regardless of score, a kit with any expired units is non-compliant, and a kit missing any required item is at best at risk.</div>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Rule</th><th>Weight</th><th>How it is measured</th></tr></thead>
              <tbody>{RULES.map(([r, w, d]) => <tr key={r}><td className="cell-primary">{r}</td><td>{w}</td><td>{d}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="small muted mt-16">The overall score is 50% the average of six statutory checks and 50% the average kit score. Each statutory check scores the share that complies, e.g. 17 of 20 kits free of expired stock = 85%: one box per 150 workers, fully stocked kits, no expired items, inspections on schedule, certified person in charge, and Form 18 filed for reportable accidents. Scheduled checks raise alerts for failing kits and statutory checks.</p>
        </Card>
      )}
    </div>
  );
};

export default Compliance;
