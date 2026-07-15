import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useScanner } from '../contexts/ScannerContext';
import { getIncidents, getDepartments } from '../services/api';
import { Plus, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

const Incidents = () => {
  const { t, requireAuth } = useAuth();
  const { selectedScanner } = useScanner();
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ severity: '', status: '', department: '', search: '' });

  useEffect(() => { loadDepts(); }, []);
  useEffect(() => { loadIncidents(); }, [page, filters, selectedScanner]);

  const loadDepts = async () => { try { const r = await getDepartments(); setDepartments(r.data.data); } catch(e){} };
  const loadIncidents = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15, ...Object.fromEntries(Object.entries(filters).filter(([_,v]) => v)) };
      if (selectedScanner) {
        if (selectedScanner.department && !params.department) params.department = typeof selectedScanner.department === 'string' ? selectedScanner.department : selectedScanner.department._id;
        if (selectedScanner.location) params.location = selectedScanner.location;
      }
      const r = await getIncidents(params);
      setIncidents(r.data.data); setTotalPages(r.data.pages || 1);
    } catch(e){} finally { setLoading(false); }
  };

  const handleFilter = (key, val) => { setFilters(f => ({ ...f, [key]: val })); setPage(1); };

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1 className="page-title">{t('incidents.title')}</h1><p className="page-subtitle">Track and manage workplace incidents</p></div>
        <button className="btn btn-primary" onClick={() => requireAuth(() => navigate('/incidents/new'))}><Plus size={18} />{t('incidents.new')}</button>
      </div>

      {selectedScanner && (
        <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Filter size={18} color="#6366f1" />
          <span style={{ fontSize: '0.9rem', color: '#4b5563' }}>
            Filtered by active scanner: <strong>{selectedScanner.location}</strong>
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{marginBottom: 20, padding: '16px 20px'}}>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
          <div style={{flex:1,minWidth:200,position:'relative'}}>
            <Search size={16} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)'}} />
            <input placeholder={t('common.search')} value={filters.search} onChange={e => handleFilter('search', e.target.value)} style={{paddingLeft:36}} />
          </div>
          <select value={filters.severity} onChange={e => handleFilter('severity', e.target.value)} style={{width:150}}>
            <option value="">{t('incidents.severity')}: {t('common.all')}</option>
            <option value="minor">{t('incidents.minor')}</option>
            <option value="moderate">{t('incidents.moderate')}</option>
            <option value="serious">{t('incidents.serious')}</option>
            <option value="fatal">{t('incidents.fatal')}</option>
          </select>
          <select value={filters.status} onChange={e => handleFilter('status', e.target.value)} style={{width:180}}>
            <option value="">{t('incidents.status')}: {t('common.all')}</option>
            <option value="reported">{t('incidents.reported')}</option>
            <option value="under_investigation">{t('incidents.under_investigation')}</option>
            <option value="resolved">{t('incidents.resolved')}</option>
            <option value="closed">{t('incidents.closed')}</option>
          </select>
          <select value={filters.department} onChange={e => handleFilter('department', e.target.value)} style={{width:180}}>
            <option value="">{t('incidents.department')}: {t('common.all')}</option>
            {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? <div className="page-loader"><div className="spinner"></div></div> : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('incidents.id')}</th><th>{t('incidents.date')}</th><th>{t('incidents.injuredPerson')}</th>
                <th>{t('incidents.department')}</th><th>{t('incidents.type')}</th><th>{t('incidents.severity')}</th>
                <th>{t('incidents.status')}</th><th>{t('incidents.outcome')}</th>
              </tr>
            </thead>
            <tbody>
              {incidents.length === 0 ? (
                <tr><td colSpan={8} style={{textAlign:'center',padding:40,color:'var(--text-muted)'}}>{t('common.noData')}</td></tr>
              ) : incidents.map(inc => (
                <tr key={inc._id} onClick={() => requireAuth(() => navigate(`/incidents/${inc._id}`))} style={{cursor:'pointer'}}>
                  <td style={{fontWeight:600,color:'var(--accent)'}}>{inc.incidentId}</td>
                  <td>{new Date(inc.dateTime).toLocaleDateString()}</td>
                  <td>{inc.injuredPerson?.name}</td>
                  <td>{inc.department?.name}</td>
                  <td><span className="badge badge-reported">{t(`incidents.${inc.incidentType}`)}</span></td>
                  <td><span className={`badge badge-${inc.severity}`}>{t(`incidents.${inc.severity}`)}</span></td>
                  <td><span className={`badge badge-${inc.status}`}>{t(`incidents.${inc.status}`)}</span></td>
                  <td style={{textTransform:'capitalize'}}>{inc.outcome?.replace(/_/g,' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{display:'flex',justifyContent:'center',gap:8,marginTop:20}}>
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p-1)}><ChevronLeft size={16} /></button>
          <span style={{padding:'6px 14px',fontSize:'0.85rem',color:'var(--text-secondary)'}}>Page {page} of {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p+1)}><ChevronRight size={16} /></button>
        </div>
      )}
    </div>
  );
};

export default Incidents;
