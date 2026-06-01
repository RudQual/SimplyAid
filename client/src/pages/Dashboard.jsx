import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getIncidentStats, getIncidents, getComplianceStatus } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { AlertTriangle, ShieldCheck, Clock, TrendingUp, Plus, ClipboardCheck, FileBarChart, Activity } from 'lucide-react';
import './Dashboard.css';

const COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#6366f1', '#ec4899'];

const Dashboard = () => {
  const { t, user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [recentIncidents, setRecentIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, incidentsRes] = await Promise.all([
        getIncidentStats({ period: 30 }),
        getIncidents({ limit: 5 })
      ]);
      setStats(statsRes.data.data);
      setRecentIncidents(incidentsRes.data.data);
      if (hasRole('admin')) {
        const compRes = await getComplianceStatus();
        setCompliance(compRes.data.data);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="page-loader"><div className="spinner"></div></div>;

  const summary = stats?.summary || {};
  const monthlyData = (stats?.monthlyTrend || []).map(m => ({
    month: `${m._id.year}-${String(m._id.month).padStart(2,'0')}`,
    count: m.count, serious: m.serious
  }));
  const typeData = (stats?.typeBreakdown || []).map(t => ({ name: t._id, value: t.count }));
  const deptData = (stats?.departmentStats || []).map(d => ({ name: d.department?.name || 'Unknown', count: d.count, serious: d.serious }));

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('dashboard.title')}</h1>
          <p className="page-subtitle">Welcome back, {user?.name}. Here's your safety overview.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => navigate('/incidents/new')}><Plus size={18} />{t('dashboard.reportIncident')}</button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid-stats" style={{marginBottom: 24}}>
        <div className="stat-card blue">
          <div className="stat-icon blue"><Activity size={24} /></div>
          <div><div className="stat-value">{summary.total || 0}</div><div className="stat-label">{t('dashboard.totalIncidents')} (30d)</div></div>
        </div>
        <div className="stat-card amber">
          <div className="stat-icon amber"><Clock size={24} /></div>
          <div><div className="stat-value">{summary.openCases || 0}</div><div className="stat-label">{t('dashboard.openCases')}</div></div>
        </div>
        <div className="stat-card red">
          <div className="stat-icon red"><AlertTriangle size={24} /></div>
          <div><div className="stat-value">{summary.totalDaysLost || 0}</div><div className="stat-label">{t('dashboard.daysLost')}</div></div>
        </div>
        {compliance && (
          <div className={`stat-card ${compliance.overallCompliance >= 80 ? 'green' : compliance.overallCompliance >= 50 ? 'amber' : 'red'}`}>
            <div className={`stat-icon ${compliance.overallCompliance >= 80 ? 'green' : compliance.overallCompliance >= 50 ? 'amber' : 'red'}`}><ShieldCheck size={24} /></div>
            <div><div className="stat-value">{compliance.overallCompliance}%</div><div className="stat-label">{t('dashboard.compliance')}</div></div>
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid-2" style={{marginBottom: 24}}>
        <div className="card">
          <div className="card-header"><h3 className="card-title">{t('dashboard.trend')}</h3></div>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <Tooltip contentStyle={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: 8, color: 'var(--text-primary)' }} />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} name="Total" />
                <Line type="monotone" dataKey="serious" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444' }} name="Serious" />
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="empty-state"><p>No trend data yet</p></div>}
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">{t('dashboard.departmentOverview')}</h3></div>
          {deptData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={deptData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} angle={-20} textAnchor="end" height={60} />
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <Tooltip contentStyle={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: 8, color: 'var(--text-primary)' }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4,4,0,0]} name="Incidents" />
                <Bar dataKey="serious" fill="#ef4444" radius={[4,4,0,0]} name="Serious" />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="empty-state"><p>No department data yet</p></div>}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid-2">
        {/* Recent Incidents */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{t('dashboard.recentIncidents')}</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/incidents')}>{t('common.view')} All</button>
          </div>
          {recentIncidents.length > 0 ? (
            <div className="table-container" style={{border:'none'}}>
              <table className="data-table">
                <thead><tr><th>ID</th><th>{t('incidents.severity')}</th><th>{t('incidents.department')}</th><th>{t('incidents.status')}</th></tr></thead>
                <tbody>
                  {recentIncidents.map(inc => (
                    <tr key={inc._id} onClick={() => navigate(`/incidents/${inc._id}`)} style={{cursor:'pointer'}}>
                      <td style={{fontWeight:600,color:'var(--accent)'}}>{inc.incidentId}</td>
                      <td><span className={`badge badge-${inc.severity}`}>{t(`incidents.${inc.severity}`)}</span></td>
                      <td>{inc.department?.name}</td>
                      <td><span className={`badge badge-${inc.status}`}>{t(`incidents.${inc.status}`)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="empty-state"><p>No incidents reported yet</p></div>}
        </div>

        {/* Quick Actions + Type Breakdown */}
        <div style={{display:'flex',flexDirection:'column',gap:20}}>
          <div className="card">
            <h3 className="card-title" style={{marginBottom:16}}>{t('dashboard.quickActions')}</h3>
            <div className="quick-actions">
              <button className="quick-action-btn" onClick={() => navigate('/incidents/new')}>
                <Plus size={20} /><span>{t('dashboard.reportIncident')}</span>
              </button>
              <button className="quick-action-btn" onClick={() => navigate('/inventory')}>
                <ClipboardCheck size={20} /><span>{t('dashboard.inspectBox')}</span>
              </button>
              <button className="quick-action-btn" onClick={() => navigate('/reports')}>
                <FileBarChart size={20} /><span>{t('dashboard.viewReports')}</span>
              </button>
            </div>
          </div>
          {typeData.length > 0 && (
            <div className="card" style={{flex:1}}>
              <h3 className="card-title" style={{marginBottom:8}}>By Type</h3>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={typeData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={4} dataKey="value" label={({name,value}) => `${name}: ${value}`} labelLine={false}>
                    {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
