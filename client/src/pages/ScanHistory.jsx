import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getScanHistory, getUsers } from '../services/api';
import { ScanLine, Search, Filter, Clock, User, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const ScanHistory = () => {
  const { t } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    actionType: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    loadLogs();
  }, [page, filters]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 25 };
      if (filters.actionType) params.actionType = filters.actionType;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const res = await getScanHistory(params);
      setLogs(res.data.data);
      setTotalPages(res.data.pages || 1);
      setTotal(res.data.total || 0);
    } catch (e) {
      toast.error('Failed to load scan history');
    } finally {
      setLoading(false);
    }
  };

  const actionColors = {
    profile_view: 'blue',
    attendance: 'green',
    emergency: 'red',
    dispensing: 'amber',
    access_control: 'purple'
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.scanHistory')}</h1>
          <p className="page-subtitle">QR code scan audit trail — {total} total scans</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Filter size={16} style={{ color: 'var(--text-muted)' }} />
          <select
            value={filters.actionType}
            onChange={e => { setFilters(f => ({ ...f, actionType: e.target.value })); setPage(1); }}
            style={{ width: 180 }}
          >
            <option value="">All Actions</option>
            <option value="profile_view">Profile View</option>
            <option value="attendance">Attendance</option>
            <option value="emergency">Emergency</option>
            <option value="dispensing">Dispensing</option>
            <option value="access_control">Access Control</option>
          </select>
          <input
            type="date"
            value={filters.startDate}
            onChange={e => { setFilters(f => ({ ...f, startDate: e.target.value })); setPage(1); }}
            style={{ width: 160 }}
            placeholder="Start Date"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={e => { setFilters(f => ({ ...f, endDate: e.target.value })); setPage(1); }}
            style={{ width: 160 }}
            placeholder="End Date"
          />
          {(filters.actionType || filters.startDate || filters.endDate) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setFilters({ actionType: '', startDate: '', endDate: '' }); setPage(1); }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="page-loader"><div className="spinner"></div></div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <ScanLine size={48} />
          <p>No scan logs found</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Employee ID</th>
                  <th>Action</th>
                  <th>Scanned By</th>
                  <th>Date & Time</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log._id}>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {log.employee?.profilePhoto ? (
                          <img src={log.employee.profilePhoto} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', fontSize: '0.75rem', fontWeight: 700 }}>
                            {log.employee?.name?.charAt(0) || '?'}
                          </div>
                        )}
                        {log.employee?.name || 'Unknown'}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'monospace', color: '#3b82f6', fontWeight: 600, fontSize: '0.82rem' }}>
                      {log.employee?.employeeId || '—'}
                    </td>
                    <td>
                      <span className={`badge badge-${actionColors[log.actionType] || 'closed'}`}>
                        {log.actionType?.replace('_', ' ')}
                      </span>
                    </td>
                    <td>{log.scannedBy?.name || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                        {new Date(log.scanTime).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {log.ipAddress || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 20 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={16} /> Prev
              </button>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Page {page} of {totalPages}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ScanHistory;
