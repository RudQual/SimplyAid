import { Link, useNavigate } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
  Boxes, Package, PackageX, CalendarX2, CalendarClock, ShieldCheck, AlertTriangle, ArrowRight, Activity,
  UserRound, Siren, CheckCircle2, RefreshCw, MapPin
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import useAsync from '../hooks/useAsync';
import { getDashboard, getIncidents } from '../services/api';
import {
  StatCard, Card, StatusBadge, ProgressBar, ScoreRing, EmptyState, ErrorState, SkeletonStats, Skeleton
} from '../components/ui';
import { daysLabel, formatNumber, labelize, timeAgo, formatDate } from '../utils/format';
import { notifText } from '../utils/i18n';
import './Dashboard.css';

const KIT_STATUS = [
  { key: 'adequate', tkey: 'dash.adequate', color: 'var(--success-600)' },
  { key: 'needs_replenishment', tkey: 'dash.needsRestock', color: '#c2410c' },
  { key: 'overdue_inspection', tkey: 'dash.inspectionDue', color: '#ca8a04' },
  { key: 'items_expired', tkey: 'dash.expiredItems', color: 'var(--danger-600)' }
];

const greetingKey = () => {
  const h = new Date().getHours();
  return h < 12 ? 'dash.morning' : h < 17 ? 'dash.afternoon' : 'dash.evening';
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

const KitStatusBar = ({ byStatus, total, t }) => {
  if (!total) return <p className="small muted">{t('dash.noKits')}</p>;
  return (
    <div>
      <div className="status-stack" role="img" aria-label={t('dash.kitStatus')}>
        {KIT_STATUS.map((s) => {
          const count = byStatus.find((b) => b.status === s.key)?.count || 0;
          if (!count) return null;
          return <span key={s.key} style={{ flex: count, background: s.color }} title={`${t(s.tkey)}: ${count}`} />;
        })}
      </div>
      <div className="status-legend">
        {KIT_STATUS.map((s) => {
          const count = byStatus.find((b) => b.status === s.key)?.count || 0;
          return (
            <Link key={s.key} to={`/kits?status=${s.key}`} className="status-legend-item">
              <span className="swatch" style={{ background: s.color }} />
              <span>{t(s.tkey)}</span>
              <strong>{count}</strong>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

/** Open SOS calls the signed-in staff member can respond to. */
const SosStrip = ({ t }) => {
  const sos = useAsync(() => getIncidents({ isSOS: 'true', status: 'reported', limit: 5 }), [], { select: (r) => r.data.data });
  if (!sos.data?.length) return null;
  return (
    <section className="sos-strip" aria-live="polite">
      <div className="sos-strip-head">
        <Siren size={18} />
        <strong>{t('dash.openSos')}</strong>
        <span>{t('dash.openSosText', { n: sos.data.length })}</span>
      </div>
      {sos.data.map((i) => (
        <Link key={i._id} to={`/incidents/${i._id}`} className="sos-strip-row">
          <span className="mono">{i.incidentId}</span>
          <span className="strong">{i.injuredPerson?.name}</span>
          <span className="sos-strip-loc"><MapPin size={13} /> {i.location}</span>
          <span className="faint">{timeAgo(i.createdAt)}</span>
          <span className="sos-strip-go">{t('dash.respond')} <ArrowRight size={14} /></span>
        </Link>
      ))}
    </section>
  );
};

const StaffDashboard = ({ data, user, t }) => {
  const c = data.compliance;
  const exp = data.expiry;
  const inv = data.inventory;
  const categoryData = [...data.inventoryByCategory].sort((a, b) => b.units - a.units).map((x) => ({ name: labelize(x.category), units: x.units }));

  return (
    <>
      <SosStrip t={t} />
      <div className="stat-grid">
        <StatCard label={t('dash.kits')} value={formatNumber(data.kits.total)} icon={Boxes} tone="blue" to="/kits"
          meta={t('dash.kitsMeta', { n: data.kits.byStatus.find((s) => s.status === 'adequate')?.count || 0 })} />
        <StatCard label={t('dash.items')} value={formatNumber(inv.catalogItems)} icon={Package} tone="teal" to="/inventory"
          meta={t('dash.itemsMeta', { n: formatNumber(inv.totalUnits) })} />
        <StatCard label={t('dash.lowStock')} value={formatNumber(inv.lowStockItems + inv.outOfStockItems)} icon={PackageX} tone="amber" to="/inventory?stockStatus=low_stock"
          meta={t('dash.lowStockMeta', { n: inv.outOfStockSlots })} />
        <StatCard label={t('dash.expired')} value={formatNumber(exp.expiredUnits)} icon={CalendarX2} tone="red" to="/expiry?status=expired"
          meta={t('dash.expiredMeta', { n: exp.expiredCount })} />
        <StatCard label={t('dash.expiring')} value={formatNumber(exp.expiringSoonUnits)} icon={CalendarClock} tone="violet" to="/expiry?status=attention"
          meta={t('dash.expiringMeta', { n: exp.critical7Count })} />
        {c && (
          <StatCard label={t('dash.complianceScore')} value={`${c.overallCompliance}%`} icon={ShieldCheck} tone={c.complianceStatus === 'compliant' ? 'green' : c.complianceStatus === 'at_risk' ? 'amber' : 'red'} to="/compliance"
            meta={<StatusBadge value={c.complianceStatus} />} />
        )}
      </div>

      <div className="dash-grid">
        {c && (
          <Card title={t('dash.complianceStatus')} icon={ShieldCheck} actions={<Link to="/compliance" className="card-link">{t('dash.details')} <ArrowRight size={14} /></Link>}>
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

        <Card title={t('dash.needsAttention')} icon={AlertTriangle} flush actions={<Link to="/notifications" className="card-link">{t('dash.allAlerts')} <ArrowRight size={14} /></Link>}>
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
                    <div className="list-item-title">{notifText(n, 'title')}</div>
                    <div className="list-item-sub">{timeAgo(n.createdAt)}</div>
                  </div>
                </Link>
              ))}
            </div>
          ) : <EmptyState icon={CheckCircle2} title={t('dash.nothingAttention')} description={t('dash.nothingAttentionText')} />}
        </Card>

        <Card title={t('dash.kitStatus')} icon={Boxes} subtitle={t('dash.activeKits', { n: data.kits.total })}>
          <KitStatusBar byStatus={data.kits.byStatus} total={data.kits.total} t={t} />
          {data.kits.attention.length > 0 && (
            <div className="attention-kits">
              {data.kits.attention.map((k) => (
                <Link key={k._id} to={`/kits/${k._id}`} className="attention-kit">
                  <div style={{ minWidth: 0 }}>
                    <div className="strong small mono">{k.boxId}</div>
                    <div className="xsmall muted truncate">{k.location}</div>
                  </div>
                  <StatusBadge value={k.status} />
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card title={t('dash.stockByDept')} icon={Package} subtitle={t('dash.stockByDeptSub')}>
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
          ) : <EmptyState title={t('dash.noKits')} />}
        </Card>

        <Card title={t('dash.byCategory')} icon={Package} subtitle={t('dash.byCategorySub')}>
          {categoryData.length ? (
            <div style={{ height: 240 }}>
              <ResponsiveContainer initialDimension={{ width: 480, height: 220 }}>
                <BarChart data={categoryData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }} barCategoryGap={6}>
                  <CartesianGrid horizontal={false} stroke="var(--slate-150)" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--slate-500)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={86} tick={{ fontSize: 12, fill: 'var(--slate-600)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip unit="units" />} cursor={{ fill: 'var(--slate-100)' }} />
                  <Bar dataKey="units" fill="var(--brand-600)" radius={[0, 2, 2, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState title={t('common.noData')} />}
        </Card>

        <Card title={t('dash.expiryOutlook')} icon={CalendarClock} subtitle={t('dash.expiryOutlookSub')} actions={<Link to="/expiry" className="card-link">{t('dash.expiryTracking')} <ArrowRight size={14} /></Link>}>
          <div style={{ height: 220 }}>
            <ResponsiveContainer initialDimension={{ width: 480, height: 220 }}>
              <BarChart data={exp.timeline} margin={{ left: -12, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--slate-150)" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--slate-500)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--slate-500)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip unit="units expiring" />} cursor={{ fill: 'var(--slate-100)' }} />
                <Bar dataKey="units" fill="var(--accent-ochre)" radius={[2, 2, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title={t('dash.expiringSoon')} icon={CalendarX2} flush>
          {data.expiringSoon.length ? (
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>{t('dash.item')}</th><th>{t('dash.kit')}</th><th className="num">{t('dash.qty')}</th><th>{t('dash.expiry')}</th></tr></thead>
                <tbody>
                  {data.expiringSoon.map((e) => (
                    <tr key={e.stockId}>
                      <td><div className="cell-primary">{e.itemName}</div><div className="cell-sub">{e.batchNumber || 'No batch no.'}</div></td>
                      <td><Link to={`/kits/${e.boxObjId}`} className="mono">{e.boxId}</Link></td>
                      <td className="num">{e.currentQty}</td>
                      <td><StatusBadge value={e.status} label={e.status === 'expired' ? `Expired ${daysLabel(e.daysRemaining)}` : daysLabel(e.daysRemaining)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon={CheckCircle2} title={t('dash.nothingExpiring')} />}
        </Card>

        <Card title={t('dash.lowStockItems')} icon={PackageX} flush actions={<Link to="/inventory?stockStatus=low_stock" className="card-link">{t('dash.inventory')} <ArrowRight size={14} /></Link>}>
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
          ) : <EmptyState icon={CheckCircle2} title={t('dash.allStocked')} />}
        </Card>

        <Card title={t('dash.recentActivity')} icon={Activity} flush actions={user.role !== 'manager' && <Link to="/activity" className="card-link">{t('dash.activityLog')} <ArrowRight size={14} /></Link>}>
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
          ) : <EmptyState title={t('dash.noActivity')} />}
        </Card>
      </div>
    </>
  );
};

const EmployeeDashboard = ({ user, t }) => {
  const navigate = useNavigate();
  const { recent } = useNotifications();
  const incidents = useAsync(() => getIncidents({ limit: 5 }), []);
  const duties = [
    { label: t('dash.actReport'), text: t('dash.actReportText'), to: '/incidents/new' },
    { label: t('dash.actScan'), text: t('dash.actScanText'), to: '/qr-scan' },
    { label: t('dash.actProfile'), text: t('dash.actProfileText'), to: '/profile' },
    { label: t('dash.actMine'), text: t('dash.actMineText'), to: '/incidents' }
  ];
  return (
    <>
      {user.profileCompletionPercentage < 100 && (
        <div className="alert alert-info mb-24">
          <UserRound size={18} />
          <div style={{ flex: 1 }}>
            <div className="alert-title">{t('dash.profileIncomplete', { pct: user.profileCompletionPercentage || 0 })}</div>
            <div className="small">{t('dash.profileWhy')}</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/profile')}>{t('dash.completeProfile')}</button>
        </div>
      )}

      <div className="emp-top mb-24">
        <ol className="duty-list">
          {duties.map((d, i) => (
            <li key={d.to}>
              <Link to={d.to} className="duty-row">
                <span className="duty-no">{String(i + 1).padStart(2, '0')}</span>
                <span className="duty-text"><strong>{d.label}</strong><span>{d.text}</span></span>
                <ArrowRight size={16} className="duty-arrow" />
              </Link>
            </li>
          ))}
        </ol>
        <aside className="sos-note">
          <Siren size={22} />
          <h3>{t('dash.sosTitle')}</h3>
          <p>{t('dash.sosText')}</p>
        </aside>
      </div>

      <div className="grid-2">
        <Card title={t('dash.myRecent')} flush actions={<Link to="/incidents" className="card-link">{t('dash.viewAll')} <ArrowRight size={14} /></Link>}>
          {incidents.loading ? <div style={{ padding: 20 }}><Skeleton height={60} /></div>
            : incidents.error ? <ErrorState error={incidents.error} onRetry={incidents.reload} />
              : incidents.data?.data?.length ? (
                <div className="list">
                  {incidents.data.data.map((i) => (
                    <Link key={i._id} to={`/incidents/${i._id}`} className="list-item">
                      <div className="list-item-main">
                        <div className="list-item-title"><span className="mono">{i.incidentId}</span> · {i.isSOS ? t('sos.badge') : labelize(i.incidentType)}</div>
                        <div className="list-item-sub">{formatDate(i.dateTime)} · {i.location}</div>
                      </div>
                      <StatusBadge value={i.status} />
                    </Link>
                  ))}
                </div>
              ) : <EmptyState title={t('dash.noIncidents')} description={t('dash.noIncidentsText')} />}
        </Card>
        <Card title={t('dash.latestNotifs')} flush actions={<Link to="/notifications" className="card-link">{t('dash.viewAll')} <ArrowRight size={14} /></Link>}>
          {recent.length ? (
            <div className="list">
              {recent.slice(0, 5).map((n) => (
                <div key={n._id} className="list-item">
                  <div className="list-item-main"><div className="list-item-title">{notifText(n, 'title')}</div><div className="list-item-sub">{timeAgo(n.createdAt)}</div></div>
                  {!n.isRead && <span className="badge badge-blue">{t('dash.new')}</span>}
                </div>
              ))}
            </div>
          ) : <EmptyState title={t('dash.noNotifs')} />}
        </Card>
      </div>
    </>
  );
};

const Dashboard = () => {
  const { user, t, lang } = useAuth();
  const isStaff = user.role !== 'employee';
  const dash = useAsync(() => (isStaff ? getDashboard() : Promise.resolve({ data: { data: null } })), [isStaff], { select: (r) => r.data.data });
  // First name, skipping titles such as "Dr."
  const first = user.name.split(/\s+/).find((w) => !/^(dr|mr|mrs|ms|prof)\.?$/i.test(w)) || user.name;
  const today = new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  return (
    <div className="page-content">
      <header className="dash-head">
        <div>
          <div className="dash-date">{today}{user.department?.name ? <> · {user.department.name}</> : null}</div>
          <h1 className="page-title">{t('dash.greeting', { greet: t(greetingKey()), name: first })}</h1>
          <p className="page-subtitle">
            {isStaff
              ? (dash.data?.scope === 'department'
                ? t('dash.subDept', { dept: user.department?.name || '—' })
                : t('dash.subOrg', { org: user.company?.name || '—' }))
              : t('dash.subEmployee')}
          </p>
        </div>
        {isStaff && (
          <div className="page-actions">
            <button className="btn btn-secondary" onClick={() => dash.reload()} disabled={dash.loading}><RefreshCw size={15} className={dash.loading ? 'spinning' : ''} /> {t('dash.refresh')}</button>
            <Link to="/kits" className="btn btn-primary"><Boxes size={16} /> {t('dash.manageKits')}</Link>
          </div>
        )}
      </header>
      {!isStaff && <EmployeeDashboard user={user} t={t} />}
      {isStaff && dash.loading && !dash.data && (
        <>
          <SkeletonStats count={6} />
          <div className="dash-grid">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card"><Skeleton height={180} /></div>)}</div>
        </>
      )}
      {isStaff && dash.error && !dash.data && <div className="card"><ErrorState error={dash.error} onRetry={dash.reload} /></div>}
      {isStaff && dash.data && <StaffDashboard data={dash.data} user={user} t={t} />}
    </div>
  );
};

export default Dashboard;
