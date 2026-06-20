import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getTreatments, getDepartments, getUsers } from '../services/api';
import { Stethoscope, Plus, Search, Filter, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import './Treatments.css';

const Treatments = () => {
  const { requireAuth } = useAuth();
  const navigate = useNavigate();
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('');

  useEffect(() => { loadTreatments(); }, [page, severity]);

  const loadTreatments = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 15 };
      if (search) params.search = search;
      if (severity) params.severity = severity;
      const res = await getTreatments(params);
      setTreatments(res.data.data);
      setTotalPages(res.data.pages || 1);
    } catch (e) { /* graceful fallback */ }
    finally { setLoading(false); }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadTreatments();
  };

  const severityColor = (s) => {
    const map = { minor: 'green', moderate: 'amber', serious: 'red', critical: 'red' };
    return map[s] || 'blue';
  };

  if (loading && !treatments.length) return <div className="page-loader"><div className="spinner"></div></div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Treatment Records</h1>
          <p className="page-subtitle">QR-based treatment logging and history</p>
        </div>
        <button className="btn btn-primary" onClick={() => requireAuth(() => navigate('/treatments/new'))}>
          <Plus size={18} />New Treatment
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="treatments-filters">
          <form onSubmit={handleSearch} className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search by ID, employee, treatment..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <select value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }}>
            <option value="">All Severities</option>
            <option value="minor">Minor</option>
            <option value="moderate">Moderate</option>
            <option value="serious">Serious</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Treatment List */}
      {treatments.length > 0 ? (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Employee</th>
                <th>Date</th>
                <th>Injury Type</th>
                <th>Severity</th>
                <th>First Aider</th>
                <th>Treatment</th>
              </tr>
            </thead>
            <tbody>
              {treatments.map(t => (
                <tr key={t._id} onClick={() => navigate(`/treatments/${t._id}`)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600, color: 'var(--blue-600)' }}>{t.treatmentId}</td>
                  <td>
                    <div className="employee-cell">
                      <div className="employee-avatar-sm">{t.employee?.name?.charAt(0) || '?'}</div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{t.employee?.name || t.employeeName}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.employee?.employeeId}</div>
                      </div>
                    </div>
                  </td>
                  <td>{new Date(t.treatmentDate).toLocaleDateString()}</td>
                  <td>{t.injuryType || '—'}</td>
                  <td><span className={`badge badge-${t.injurySeverity}`}>{t.injurySeverity}</span></td>
                  <td>{t.firstAider?.name || t.firstAiderName || '—'}</td>
                  <td className="treatment-desc">{t.treatmentProvided?.substring(0, 50)}{t.treatmentProvided?.length > 50 ? '...' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <Stethoscope size={48} />
          <p>No treatment records found</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft size={16} />Prev
          </button>
          <span className="page-info">Page {page} of {totalPages}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next<ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Treatments;
