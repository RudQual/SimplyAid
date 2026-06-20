import { useState, useEffect } from 'react';
import { getInjuryAnalytics, getTreatmentAnalytics, getInventoryAnalytics, getComplianceAnalytics } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
import { Activity, Stethoscope, Package, ShieldCheck } from 'lucide-react';
import './SafetyAnalytics.css';

const COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#6366f1', '#ec4899', '#8b5cf6', '#14b8a6'];

const SafetyAnalytics = () => {
  const [injuries, setInjuries] = useState(null);
  const [treatments, setTreatments] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('injuries');

  useEffect(() => {
    Promise.all([
      getInjuryAnalytics({ period: 180 }).catch(() => ({ data: { data: null } })),
      getTreatmentAnalytics({ period: 30 }).catch(() => ({ data: { data: null } })),
      getInventoryAnalytics({ period: 30 }).catch(() => ({ data: { data: null } })),
      getComplianceAnalytics().catch(() => ({ data: { data: null } }))
    ]).then(([injRes, trtRes, invRes, compRes]) => {
      setInjuries(injRes.data.data);
      setTreatments(trtRes.data.data);
      setInventory(invRes.data.data);
      setCompliance(compRes.data.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loader"><div className="spinner"></div></div>;

  const tooltipStyle = { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-main)', boxShadow: 'var(--shadow-md)' };

  const tabs = [
    { key: 'injuries', label: 'Injury Analytics', icon: Activity },
    { key: 'treatments', label: 'Treatment Analytics', icon: Stethoscope },
    { key: 'inventory', label: 'Inventory Analytics', icon: Package },
    { key: 'compliance', label: 'Compliance Analytics', icon: ShieldCheck }
  ];

  const monthlyInjuries = (injuries?.monthlyTrend || []).map(m => ({ month: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`, count: m.count, serious: m.serious }));
  const severityData = (injuries?.severityDistribution || []).map(s => ({ name: s._id, value: s.count }));
  const deptInjuries = (injuries?.departmentWise || []).map(d => ({ name: d.name || 'Unknown', count: d.count, serious: d.serious }));
  const monthlyTreatments = (treatments?.monthlyTrend || []).map(m => ({ month: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`, count: m.count }));
  const consumptionTrend = (inventory?.consumptionTrend || []).map(m => ({ month: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`, consumed: m.totalConsumed }));

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Safety Analytics</h1>
          <p className="page-subtitle">Management-level safety performance insights</p>
        </div>
      </div>

      <div className="analytics-tabs">
        {tabs.map(tab => (
          <button key={tab.key} className={`analytics-tab ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)}>
            <tab.icon size={18} />{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'injuries' && (
        <>
          <div className="grid-stats" style={{ marginBottom: 24 }}>
            <div className="stat-card blue"><div className="stat-icon blue"><Activity size={24} /></div><div><div className="stat-value">{injuries?.summary?.total || 0}</div><div className="stat-label">Total Incidents</div></div></div>
            <div className="stat-card amber"><div className="stat-icon amber"><Activity size={24} /></div><div><div className="stat-value">{injuries?.summary?.moderate || 0}</div><div className="stat-label">Moderate</div></div></div>
            <div className="stat-card red"><div className="stat-icon red"><Activity size={24} /></div><div><div className="stat-value">{(injuries?.summary?.serious || 0) + (injuries?.summary?.fatal || 0)}</div><div className="stat-label">Serious/Fatal</div></div></div>
            <div className="stat-card purple"><div className="stat-icon purple"><Activity size={24} /></div><div><div className="stat-value">{injuries?.summary?.totalDaysLost || 0}</div><div className="stat-label">Days Lost</div></div></div>
          </div>
          <div className="grid-2" style={{ marginBottom: 24 }}>
            <div className="card"><div className="card-header"><h3 className="card-title">Monthly Incident Trend</h3></div>
              {monthlyInjuries.length > 0 ? (<ResponsiveContainer width="100%" height={280}><LineChart data={monthlyInjuries}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" /><XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} /><YAxis stroke="var(--text-muted)" fontSize={12} /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={2} dot={{ fill: '#2563EB' }} name="Total" /><Line type="monotone" dataKey="serious" stroke="#DC2626" strokeWidth={2} dot={{ fill: '#DC2626' }} name="Serious" /></LineChart></ResponsiveContainer>) : <div className="empty-state"><p>No data yet</p></div>}
            </div>
            <div className="card"><div className="card-header"><h3 className="card-title">Severity Distribution</h3></div>
              {severityData.length > 0 ? (<ResponsiveContainer width="100%" height={280}><PieChart><Pie data={severityData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>{severityData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>) : <div className="empty-state"><p>No data yet</p></div>}
            </div>
          </div>
          <div className="card"><div className="card-header"><h3 className="card-title">Department-wise Incidents</h3></div>
            {deptInjuries.length > 0 ? (<ResponsiveContainer width="100%" height={300}><BarChart data={deptInjuries}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" /><XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} angle={-20} textAnchor="end" height={60} /><YAxis stroke="var(--text-muted)" fontSize={12} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} name="Total" /><Bar dataKey="serious" fill="#DC2626" radius={[4, 4, 0, 0]} name="Serious" /></BarChart></ResponsiveContainer>) : <div className="empty-state"><p>No data yet</p></div>}
          </div>
        </>
      )}

      {activeTab === 'treatments' && (
        <>
          <div className="grid-stats" style={{ marginBottom: 24 }}>
            <div className="stat-card green"><div className="stat-icon green"><Stethoscope size={24} /></div><div><div className="stat-value">{treatments?.summary?.total || 0}</div><div className="stat-label">Treatments (30d)</div></div></div>
            <div className="stat-card blue"><div className="stat-icon blue"><Stethoscope size={24} /></div><div><div className="stat-value">{treatments?.summary?.minor || 0}</div><div className="stat-label">Minor</div></div></div>
            <div className="stat-card red"><div className="stat-icon red"><Stethoscope size={24} /></div><div><div className="stat-value">{(treatments?.summary?.serious || 0) + (treatments?.summary?.critical || 0)}</div><div className="stat-label">Serious/Critical</div></div></div>
          </div>
          <div className="grid-2" style={{ marginBottom: 24 }}>
            <div className="card"><div className="card-header"><h3 className="card-title">Treatment Trend</h3></div>
              {monthlyTreatments.length > 0 ? (<ResponsiveContainer width="100%" height={280}><AreaChart data={monthlyTreatments}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" /><XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} /><YAxis stroke="var(--text-muted)" fontSize={12} /><Tooltip contentStyle={tooltipStyle} /><Area type="monotone" dataKey="count" stroke="#10B981" fill="#ECFDF5" strokeWidth={2} name="Treatments" /></AreaChart></ResponsiveContainer>) : <div className="empty-state"><p>No data yet</p></div>}
            </div>
            <div className="card"><div className="card-header"><h3 className="card-title">Top First Aiders</h3></div>
              {(treatments?.topFirstAiders || []).length > 0 ? (
                <div className="rankings-list">{treatments.topFirstAiders.map((fa, i) => (
                  <div key={i} className="ranking-item"><span className="ranking-rank">#{i + 1}</span><span className="ranking-name">{fa.name || 'Unknown'}</span><span className="ranking-value">{fa.count} treatments</span></div>
                ))}</div>
              ) : <div className="empty-state"><p>No data yet</p></div>}
            </div>
          </div>
          <div className="card"><div className="card-header"><h3 className="card-title">Most Used Medicines</h3></div>
            {(treatments?.topMedicines || []).length > 0 ? (<ResponsiveContainer width="100%" height={300}><BarChart data={treatments.topMedicines.map(m => ({ name: m._id, used: m.totalUsed }))} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" /><XAxis type="number" stroke="var(--text-muted)" fontSize={12} /><YAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={11} width={120} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="used" fill="#2563EB" radius={[0, 4, 4, 0]} name="Qty Used" /></BarChart></ResponsiveContainer>) : <div className="empty-state"><p>No data yet</p></div>}
          </div>
        </>
      )}

      {activeTab === 'inventory' && (
        <>
          <div className="grid-stats" style={{ marginBottom: 24 }}>
            <div className="stat-card blue"><div className="stat-icon blue"><Package size={24} /></div><div><div className="stat-value">{inventory?.summary?.totalItems || 0}</div><div className="stat-label">Total Items</div></div></div>
            <div className="stat-card amber"><div className="stat-icon amber"><Package size={24} /></div><div><div className="stat-value">{inventory?.summary?.lowStockItems || 0}</div><div className="stat-label">Low Stock</div></div></div>
            <div className="stat-card red"><div className="stat-icon red"><Package size={24} /></div><div><div className="stat-value">{inventory?.summary?.expiredItems || 0}</div><div className="stat-label">Expired</div></div></div>
            <div className="stat-card green"><div className="stat-icon green"><Package size={24} /></div><div><div className="stat-value">{inventory?.summary?.totalBoxes || 0}</div><div className="stat-label">Active Boxes</div></div></div>
          </div>
          <div className="grid-2">
            <div className="card"><div className="card-header"><h3 className="card-title">Consumption Trend</h3></div>
              {consumptionTrend.length > 0 ? (<ResponsiveContainer width="100%" height={280}><AreaChart data={consumptionTrend}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" /><XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} /><YAxis stroke="var(--text-muted)" fontSize={12} /><Tooltip contentStyle={tooltipStyle} /><Area type="monotone" dataKey="consumed" stroke="#F97316" fill="#FFF7ED" strokeWidth={2} name="Items Used" /></AreaChart></ResponsiveContainer>) : <div className="empty-state"><p>No data yet</p></div>}
            </div>
            <div className="card"><div className="card-header"><h3 className="card-title">Most Consumed Items</h3></div>
              {(inventory?.mostConsumed || []).length > 0 ? (<ResponsiveContainer width="100%" height={280}><BarChart data={inventory.mostConsumed.map(m => ({ name: m._id, consumed: m.totalConsumed }))} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" /><XAxis type="number" stroke="var(--text-muted)" fontSize={12} /><YAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={11} width={120} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="consumed" fill="#F97316" radius={[0, 4, 4, 0]} name="Consumed" /></BarChart></ResponsiveContainer>) : <div className="empty-state"><p>No data yet</p></div>}
            </div>
          </div>
        </>
      )}

      {activeTab === 'compliance' && (
        <>
          <div className="grid-stats" style={{ marginBottom: 24 }}>
            <div className="stat-card green"><div className="stat-icon green"><ShieldCheck size={24} /></div><div><div className="stat-value">{compliance?.inspectionCompletionRate || 0}%</div><div className="stat-label">Inspection Rate</div></div></div>
            <div className="stat-card blue"><div className="stat-icon blue"><ShieldCheck size={24} /></div><div><div className="stat-value">{compliance?.inspectedThisMonth || 0}/{compliance?.totalBoxes || 0}</div><div className="stat-label">Inspected This Month</div></div></div>
          </div>
          <div className="card"><div className="card-header"><h3 className="card-title">Department Rankings</h3></div>
            {(compliance?.departmentRankings || []).length > 0 ? (
              <div className="table-container" style={{ border: 'none' }}><table className="data-table"><thead><tr><th>Rank</th><th>Department</th><th>Score</th><th>Employees</th><th>Boxes</th><th>Required</th></tr></thead><tbody>
                {compliance.departmentRankings.map((d, i) => (
                  <tr key={i}><td style={{ fontWeight: 800, color: 'var(--blue-600)' }}>#{i + 1}</td><td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{d.name}</td>
                    <td><span className={`badge ${d.score >= 80 ? 'badge-green' : d.score >= 50 ? 'badge-amber' : 'badge-red'}`}>{d.score}%</span></td>
                    <td>{d.empCount}</td><td>{d.boxCount}</td><td>{d.requiredBoxes}</td></tr>
                ))}
              </tbody></table></div>
            ) : <div className="empty-state"><p>No data yet</p></div>}
          </div>
        </>
      )}
    </div>
  );
};

export default SafetyAnalytics;
