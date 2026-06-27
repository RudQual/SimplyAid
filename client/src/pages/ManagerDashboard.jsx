import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getIncidents, managerConfirmIncident } from '../services/api';
import { ClipboardCheck, AlertTriangle, Eye, Send, MapPin, Clock, User, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const severityColors = {
  minor: { bg: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: 'rgba(34, 197, 94, 0.2)' },
  moderate: { bg: 'rgba(234, 179, 8, 0.1)', color: '#eab308', border: 'rgba(234, 179, 8, 0.2)' },
  serious: { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.2)' },
  fatal: { bg: 'rgba(127, 29, 29, 0.15)', color: '#dc2626', border: 'rgba(127, 29, 29, 0.3)' },
};

const ManagerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);
  const [confirmNotes, setConfirmNotes] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);

  useEffect(() => { loadIncidents(); }, []);

  const loadIncidents = async () => {
    setLoading(true);
    try {
      // Get reported incidents that need manager confirmation
      const res = await getIncidents({ status: 'reported', limit: 50 });
      setIncidents(res.data.data);
    } catch (e) {
      toast.error('Failed to load incidents');
    } finally { setLoading(false); }
  };

  const openConfirmModal = (incident) => {
    setSelectedIncident(incident);
    setConfirmNotes('');
    setShowModal(true);
  };

  const handleConfirm = async () => {
    if (!selectedIncident) return;
    setConfirmingId(selectedIncident._id);
    try {
      await managerConfirmIncident(selectedIncident._id, { notes: confirmNotes });
      toast.success('Incident confirmed and sent to doctor!');
      setShowModal(false);
      setSelectedIncident(null);
      loadIncidents();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to confirm incident');
    } finally { setConfirmingId(null); }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Manager Dashboard</h1>
          <p className="page-subtitle">Review and confirm reported incidents on-site</p>
        </div>
        <div className="stats-badge">
          <AlertTriangle size={18} />
          <span>{incidents.length} Pending</span>
        </div>
      </div>

      {loading ? (
        <div className="page-loader"><div className="spinner"></div></div>
      ) : incidents.length === 0 ? (
        <div className="card" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <ClipboardCheck size={48} style={{ color: 'var(--accent)', marginBottom: 16 }} />
          <h3 style={{ margin: '0 0 8px', color: 'var(--text-main)' }}>All Clear!</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>No pending incidents require your confirmation.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {incidents.map(incident => {
            const sev = severityColors[incident.severity] || severityColors.minor;
            return (
              <div key={incident._id} className="card" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 250 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent)', fontSize: '0.9rem' }}>
                        {incident.incidentId}
                      </span>
                      <span style={{
                        padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                        background: sev.bg, color: sev.color, border: `1px solid ${sev.border}`
                      }}>
                        {incident.severity?.toUpperCase()}
                      </span>
                      <span style={{
                        padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 500,
                        background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)'
                      }}>
                        {incident.incidentType?.replace('_', ' ')}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 10px', color: 'var(--text-main)', fontSize: '1rem', lineHeight: 1.5 }}>
                      {incident.description?.substring(0, 150)}{incident.description?.length > 150 ? '...' : ''}
                    </p>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <User size={14} /> {incident.injuredPerson?.name || 'Unknown'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={14} /> {incident.location}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={14} /> {new Date(incident.dateTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={() => navigate(`/incidents/${incident._id}`)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Eye size={16} /> View
                    </button>
                    <button className="btn btn-primary" onClick={() => openConfirmModal(incident)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Send size={16} /> Confirm & Send
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowModal(false)}>
          <div className="card" style={{ maxWidth: 520, width: '90%', padding: '32px' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 4px', color: 'var(--text-main)', fontSize: '1.4rem' }}>Confirm Incident</h2>
            <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Add your on-site observations for <strong>{selectedIncident?.incidentId}</strong>. This will be forwarded to the Doctor for review.
            </p>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: 'var(--text-main)', fontSize: '0.9rem' }}>
              On-Site Notes & Observations
            </label>
            <textarea
              value={confirmNotes}
              onChange={e => setConfirmNotes(e.target.value)}
              placeholder="Describe what you observed on-site, items used, condition of the affected person..."
              rows={5}
              style={{ width: '100%', marginBottom: 20 }}
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirm} disabled={confirmingId}>
                {confirmingId ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></span> : <><Send size={16} /> Confirm & Forward to Doctor</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerDashboard;
