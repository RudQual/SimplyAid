import { Link, useNavigate } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
  Boxes, Package, PackageX, CalendarX2, CalendarClock, ShieldCheck, AlertTriangle, ArrowRight, Activity, FilePlus2,
  ScanLine, UserRound, Siren, CheckCircle2, ClipboardList, RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import useAsync from '../hooks/useAsync';
import { getDashboard, getIncidents } from '../services/api';
import {
  PageHeader, StatCard, Card, StatusBadge, ProgressBar, ScoreRing, EmptyState, ErrorState, SkeletonStats, Skeleton
} from '../components/ui';
import { daysLabel, formatNumber, labelize, timeAgo, formatDate } from '../utils/format';
import './Dashboard.css';

const KIT_STATUS = [
  { key: 'adequate', label: 'Adequate', color: 'var(--success-600)' },
  { key: 'needs_replenishment', label: 'Needs restock', color: '#ea580c' },
  { key: 'overdue_inspection', label: 'Inspection due', color: '#eab308' },
  { key: 'items_expired', label: 'Expired items', color: 'var(--danger-600)' }
];

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const ChartTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="chart-tip-label">{label}</div>
      <div className="chart-tip-value">{formatNumber(payload[0].value)} {unit}</div>
    </div>
  );
};

const KitStatusBar = ({ byStatus, total }) => {
  if (!total) return <p className="small muted">No active kits yet.</p>;
  return (
    <div>
      <div className="status-stack" role="img" aria-label="Kit status breakdown">
        {KIT_STATUS.map((s) => {
          const count = byStatus.find((b) => b.status === s.key)?.count || 0;
          if (!count) return null;
          return <span key={s.key} style={{ flex: count, background: s.color }} title={`${s.label}: ${count}`} />;
        })}
      </div>
      <div className="status-legend">
        {KIT_STATUS.map((s) => {
          const count = byStatus.find((b) => b.status === s.key)?.count || 0;
          return (
            <Link key={s.key} to={`/kits?status=${s.key}`} className="status-legend-item">
              <span className="swatch" style={{ background: s.color }} />
              <span>{s.label}</span>
              <strong>{count}</strong>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

const StaffDashboard = ({ data, user }) => {
  const c = data.compliance;
  const exp = data.expiry;
  const inv = data.inventory;
  const categoryData = [...data.inventoryByCategory].sort((a, b) => b.units - a.units).map((x) => ({ name: labelize(x.category), units: x.units }));

  return (
    <>
      <div className="stat-grid">
        <StatCard label="First aid kits" value={formatNumber(data.kits.total)} icon={Boxes} tone="blue" to="/kits"
          meta={<>{data.kits.byStatus.find((s) => s.status === 'adequate')?.count || 0} fully adequate</>} />
        <StatCard label="Inventory items" value={formatNumber(inv.catalogItems)} icon={Package} tone="teal" to="/inventory"
          meta={<>{formatNumber(inv.totalUnits)} units across all kits</>} />
        <StatCard label="Low-stock items" value={formatNumber(inv.lowStockItems + inv.outOfStockItems)} icon={PackageX} tone="amber" to="/inventory?stockStatus=low_stock"
          meta={<>{inv.outOfStockSlots} kit slot{inv.outOfStockSlots === 1 ? '' : 's'} completely empty</>} />
        <StatCard label="Expired units" value={formatNumber(exp.expiredUnits)} icon={CalendarX2} tone="red" to="/expiry?status=expired"
          meta={<>{exp.expiredCount} batch{exp.expiredCount === 1 ? '' : 'es'} to remove</>} />
        <StatCard label="Expiring ≤ 30 days" value={formatNumber(exp.expiringSoonUnits)} icon={CalendarClock} tone="violet" to="/expiry?status=attention"
          meta={<>{exp.critical7Count} batch{exp.critical7Count === 1 ? '' : 'es'} within 7 days</>} />
        {c && (
          <StatCard label="Compliance score" value={`${c.overallCompliance}%`} icon={ShieldCheck} tone={c.complianceStatus === 'compliant' ? 'green' : c.complianceStatus === 'at_risk' ? 'amber' : 'red'} to="/compliance"
            meta={<StatusBadge value={c.complianceStatus} />} />
        )}
      </div>

      <div className="dash-grid">
        {/* Compliance */}
        {c && (
          <Card title="Compliance status" icon={ShieldCheck} actions={<Link to="/compliance" className="card-link">Details <ArrowRight size={14} /></Link>}>
            <div className="compliance-hero">
              <ScoreRing score={c.overallCompliance} label="overall" />
              <div className="compliance-checks">
                {c.checks.map((k) => (
                  <div key={k.key} className="check-row">
                    {k.compliant ? <CheckCircle2 size={16} className="text-green" /> : <AlertTriangle size={16} className={k.status === 'yellow' ? 'text-amber' : 'text-red'} />}
                    <span className="truncate">{k.rule}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Actionable alerts */}
        <Card title="Needs attention" icon={AlertTriangle} flush actions={<Link to="/notifications" className="card-link">All alerts <ArrowRight size={14} /></Link>}>
          {(c?.pendingActions?.length || data.alerts.length) ? (
            <div className="list">
              {(c?.pendingActions || []).map((a) => (
                <Link key={a.message} to={a.link || '/compliance'} className="list-item">
                  <span className={`list-icon ${a.severity === 'critical' ? 'tone-red' : 'tone-amber'}`}><AlertTriangle size={16} /></span>
                  <div className="list-item-main"><div className="list-item-title" style={{ whiteSpace: 'normal' }}>{a.message}</div></div>
                  <ArrowRight size={15} className="faint" />
                </Link>
              ))}
              {data.alerts.slice(0, Math.max(0, 6 - (c?.pendingActions?.length || 0))).map((n) => (
                <Link key={n._id} to={n.link || '/notifications'} className="list-item">
                  <span className={`list-icon ${n.severity === 'critical' ? 'tone-red' : n.severity === 'warning' ? 'tone-amber' : 'tone-blue'}`}><Activity size={16} /></span>
                  <div className="list-item-main">
                    <div className="list-item-title">{n.title}</div>
                    <div className="list-item-sub">{timeAgo(n.createdAt)}</div>
                  </div>
                </Link>
              ))}
            </div>
          ) : <EmptyState icon={CheckCircle2} title="Nothing needs attention" description="All kits are stocked, in date and inspected." />}
        </Card>

        {/* Kit status */}
        <Card title="Kit status" icon={Boxes} subtitle={`${data.kits.total} active kit${data.kits.total === 1 ? '' : 's'}`}>
          <KitStatusBar byStatus={data.kits.byStatus} total={data.kits.total} />
          {data.kits.attention.length > 0 && (
            <div className="attention-kits">
              {data.kits.attention.map((k) => (
                <Link key={k._id} to={`/kits/${k._id}`} className="attention-kit">
                  <div style={{ minWidth: 0 }}>
                    <div className="strong small">{k.boxId}</div>
                    <div className="xsmall muted truncate">{k.location}</div>
                  </div>
                  <StatusBadge value={k.status} />
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Stock by department */}
        <Card title="Stock level by department" icon={Package} subtitle="Share of required units present in each department’s kits">
          {data.stockByDepartment.length ? (
            <div className="dept-bars">
              {data.stockByDepartment.map((d) => (
                <div key={d.department} className="dept-bar">
                  <div className="row-between small">
                    <span className="strong truncate">{d.department}</span>
                    <span className="muted nowrap"><strong className="strong">{d.fillRate}%</strong> · {d.kits} kit{d.kits === 1 ? '' : 's'}{d.lowItems ? ` · ${d.lowItems} low` : ''}</span>
                  </div>
                  <ProgressBar value={d.fillRate} tone="blue" />
                </div>
              ))}
            </div>
          ) : <EmptyState title="No kits yet" />}
        </Card>

        {/* Inventory distribution */}
        <Card title="Inventory by category" icon={Package} subtitle="Units currently in stock">
          {categoryData.length ? (
            <div style={{ height: 240 }}>
              <ResponsiveContainer initialDimension={{ width: 480, height: 220 }}>
                <BarChart data={categoryData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }} barCategoryGap={6}>
                  <CartesianGrid horizontal={false} stroke="var(--slate-150)" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--slate-500)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={86} tick={{ fontSize: 12, fill: 'var(--slate-600)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip unit="units" />} cursor={{ fill: 'var(--slate-100)' }} />
                  <Bar dataKey="units" fill="var(--brand-600)" radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState title="No inventory yet" />}
        </Card>

        {/* Expiry timeline */}
        <Card title="Expiry outlook" icon={CalendarClock} subtitle="Units expiring in each of the next six months" actions={<Link to="/expiry" className="card-link">Expiry tracking <ArrowRight size={14} /></Link>}>
          <div style={{ height: 220 }}>
            <ResponsiveContainer initialDimension={{ width: 480, height: 220 }}>
              <BarChart data={exp.timeline} margin={{ left: -12, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--slate-150)" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--slate-500)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--slate-500)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip unit="units expiring" />} cursor={{ fill: 'var(--slate-100)' }} />
                <Bar dataKey="units" fill="var(--teal-600)" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Expiring soon */}
        <Card title="Expired & expiring soon" icon={CalendarX2} flush>
          {data.expiringSoon.length ? (
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>Item</th><th>Kit</th><th className="num">Qty</th><th>Expiry</th></tr></thead>
                <tbody>
                  {data.expiringSoon.map((e) => (
                    <tr key={e.stockId}>
                      <td><div className="cell-primary">{e.itemName}</div><div className="cell-sub">{e.batchNumber || 'No batch no.'}</div></td>
                      <td><Link to={`/kits/${e.boxObjId}`}>{e.boxId}</Link></td>
                      <td className="num">{e.currentQty}</td>
                      <td><StatusBadge value={e.status} label={e.status === 'expired' ? `Expired ${daysLabel(e.daysRemaining)}` : daysLabel(e.daysRemaining)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon={CheckCircle2} title="Nothing expiring in the next 30 days" />}
        </Card>

        {/* Low stock items */}
        <Card title="Low-stock items" icon={PackageX} flush actions={<Link to="/inventory?stockStatus=low_stock" className="card-link">Inventory <ArrowRight size={14} /></Link>}>
          {data.lowStockItems.length ? (
            <div className="list">
              {data.lowStockItems.map((i) => (
                <Link key={i._id} to={`/inventory/${i._id}`} className="list-item">
                  <div className="list-item-main">
                    <div className="row-between">
                      <span className="list-item-title">{i.name}</span>
                      <StatusBadge value={i.stockStatus} />
                    </div>
                    <div className="row" style={{ marginTop: 6 }}>
                      <div style={{ flex: 1 }}><ProgressBar value={i.fillRate} /></div>
                      <span className="xsmall muted nowrap">{i.totalQty}/{i.totalRequired} {i.unit} · {i.lowStockBoxes} kit{i.lowStockBoxes === 1 ? '' : 's'} short</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : <EmptyState icon={CheckCircle2} title="Every kit meets its required quantities" />}
        </Card>

        {/* Recent activity */}
        <Card title="Recent activity" icon={Activity} flush actions={user.role !== 'manager' && <Link to="/activity" className="card-link">Activity log <ArrowRight size={14} /></Link>}>
          {data.recentActivity.length ? (
            <div className="list">
              {data.recentActivity.map((a) => (
                <div key={a._id} className="list-item">
                  <span className="avatar avatar-sm">{(a.userName || 'S').charAt(0)}</span>
                  <div className="list-item-main">
                    <div className="list-item-title" style={{ fontWeight: 500 }}><strong>{a.userName || 'System'}</strong> · {a.action}{a.entityLabel ? ` · ${a.entityLabel}` : ''}</div>
                    <div className="list-item-sub">{a.details || labelize(a.entity)} · {timeAgo(a.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No activity yet" />}
        </Card>
      </div>
    </>
  );
};

const EmployeeDashboard = ({ user }) => {
  const navigate = useNavigate();
  const { recent } = useNotifications();
  const incidents = useAsync(() => getIncidents({ limit: 5 }), []);
  const actions = [
    { icon: FilePlus2, label: 'Report an incident', text: 'Log an injury, illness or near miss', to: '/incidents/new', tone: 'blue' },
    { icon: ScanLine, label: 'Scan a QR code', text: 'Open a kit or a colleague’s emergency card', to: '/qr-scan', tone: 'teal' },
    { icon: UserRound, label: 'My profile', text: 'Keep your medical & emergency details current', to: '/profile', tone: 'violet' },
    { icon: ClipboardList, label: 'My incidents', text: 'Track the status of your reports', to: '/incidents', tone: 'amber' }
  ];
  return (
    <>
      {user.profileCompletionPercentage < 100 && (
        <div className="alert alert-info mb-24">
          <UserRound size={18} />
          <div style={{ flex: 1 }}>
            <div className="alert-title">Your profile is {user.profileCompletionPercentage || 0}% complete</div>
            <div className="small">First responders rely on your blood group, allergies and emergency contact.</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/profile')}>Complete profile</button>
        </div>
      )}
      <div className="quick-grid mb-24">
        {actions.map((a) => (
          <Link key={a.to} to={a.to} className="card card-interactive quick-card">
            <span className={`stat-icon tone-${a.tone}`}><a.icon size={18} /></span>
            <div><div className="strong">{a.label}</div><div className="small muted">{a.text}</div></div>
          </Link>
        ))}
      </div>
      <div className="alert alert-danger mb-24">
        <Siren size={18} />
        <div><div className="alert-title">In an emergency, press SOS</div><div className="small">The red SOS button at the top creates an emergency report and alerts your manager and the medical team immediately.</div></div>
      </div>
      <div className="grid-2">
        <Card title="My recent incidents" flush actions={<Link to="/incidents" className="card-link">View all <ArrowRight size={14} /></Link>}>
          {incidents.loading ? <div style={{ padding: 20 }}><Skeleton height={60} /></div>
            : incidents.error ? <ErrorState error={incidents.error} onRetry={incidents.reload} />
              : incidents.data?.data?.length ? (
                <div className="list">
                  {incidents.data.data.map((i) => (
                    <Link key={i._id} to={`/incidents/${i._id}`} className="list-item">
                      <div className="list-item-main">
                        <div className="list-item-title">{i.incidentId} · {labelize(i.incidentType)}</div>
                        <div className="list-item-sub">{formatDate(i.dateTime)} · {i.location}</div>
                      </div>
                      <StatusBadge value={i.status} />
                    </Link>
                  ))}
                </div>
              ) : <EmptyState title="No incidents reported" description="Stay safe! Anything you report will appear here." />}
        </Card>
        <Card title="Latest notifications" flush actions={<Link to="/notifications" className="card-link">View all <ArrowRight size={14} /></Link>}>
          {recent.length ? (
            <div className="list">
              {recent.slice(0, 5).map((n) => (
                <div key={n._id} className="list-item">
                  <div className="list-item-main"><div className="list-item-title">{n.title}</div><div className="list-item-sub">{timeAgo(n.createdAt)}</div></div>
                  {!n.isRead && <span className="badge badge-blue">New</span>}
                </div>
              ))}
            </div>
          ) : <EmptyState title="No notifications" />}
        </Card>
      </div>
    </>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const isStaff = user.role !== 'employee';
  const dash = useAsync(() => (isStaff ? getDashboard() : Promise.resolve({ data: { data: null } })), [isStaff], { select: (r) => r.data.data });
  // First name, skipping titles such as "Dr."
  const first = user.name.split(/\s+/).find((w) => !/^(dr|mr|mrs|ms|prof)\.?$/i.test(w)) || user.name;

  return (
    <div className="page-content">
      <PageHeader
        eyebrow={new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
        title={`${greeting()}, ${first}`}
        subtitle={isStaff
          ? (dash.data?.scope === 'department' ? `Here’s the status of ${user.department?.name || 'your department'}’s first aid kits.` : `Here’s the first aid readiness of ${user.company?.name || 'your organisation'}.`)
          : 'Your workplace safety at a glance.'}
        actions={isStaff && (
          <>
            <button className="btn btn-secondary" onClick={() => dash.reload()} disabled={dash.loading}><RefreshCw size={15} className={dash.loading ? 'spinning' : ''} /> Refresh</button>
            <Link to="/kits" className="btn btn-primary"><Boxes size={16} /> Manage kits</Link>
          </>
        )}
      />
      {!isStaff && <EmployeeDashboard user={user} />}
      {isStaff && dash.loading && !dash.data && (
        <>
          <SkeletonStats count={6} />
          <div className="dash-grid">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card"><Skeleton height={180} /></div>)}</div>
        </>
      )}
      {isStaff && dash.error && !dash.data && <div className="card"><ErrorState error={dash.error} onRetry={dash.reload} /></div>}
      {isStaff && dash.data && <StaffDashboard data={dash.data} user={user} />}
    </div>
  );
};

export default Dashboard;
