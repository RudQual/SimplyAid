import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getIncidents, getIncidentStats, doctorReviewIncident } from '../services/api';
import { Stethoscope, ClipboardCheck, AlertTriangle, Eye, CheckCircle, Package, Clock, FileText, Send, User, MapPin, Activity } from 'lucide-react';
import toast from 'react-hot-toast';

const severityColors = {
  minor: { bg: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: 'rgba(34, 197, 94, 0.2)' },
  moderate: { bg: 'rgba(234, 179, 8, 0.1)', color: '#eab308', border: 'rgba(234, 179, 8, 0.2)' },
  serious: { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.2)' },
  fatal: { bg: 'rgba(127, 29, 29, 0.15)', color: '#dc2626', border: 'rgba(127, 29, 29, 0.3)' },
};

const DoctorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pendingIncidents, setPendingIncidents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get incidents forwarded by manager (under_investigation = manager confirmed)
      const [pendingRes, statsRes] = await Promise.all([
        getIncidents({ status: 'under_investigation', limit: 50 }),
        getIncidentStats({ period: 30 })
      ]);
      setPendingIncidents(pendingRes.data.data);
      setStats(statsRes.data.data?.summary);
    } catch (e) {
      toast.error('Failed to load dashboard data');
    } finally { setLoading(false); }
  };

  const openReviewModal = (incident) => {
    setSelectedIncident(incident);
    setReviewNotes('');
    setShowModal(true);
  };

  const handleReview = async () => {
    if (!selectedIncident) return;
    setReviewingId(selectedIncident._id);
    try {
      await doctorReviewIncident(selectedIncident._id, { notes: reviewNotes });
      toast.success('Incident reviewed and resolved!');
      setShowModal(false);
      setSelectedIncident(null);
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to review incident');
    } finally { setReviewingId(null); }
  };

  if (loading) return <div className="page-loader"><div className="spinner"></div></div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Doctor Dashboard</h1>
          <p className="page-subtitle">Review confirmed incidents, manage inventory & first aid supplies</p>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <AlertTriangle size={24} style={{ color: '#ef4444', marginBottom: 8 }} />
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-main)' }}>{pendingIncidents.length}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Awaiting Review</div>
        </div>
        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <Activity size={24} style={{ color: '#6366f1', marginBottom: 8 }} />
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-main)' }}>{stats?.total || 0}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total (30d)</div>
        </div>
        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <CheckCircle size={24} style={{ color: '#22c55e', marginBottom: 8 }} />
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-main)' }}>{(stats?.total || 0) - (stats?.openCases || 0)}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Resolved</div>
        </div>
        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <Clock size={24} style={{ color: '#eab308', marginBottom: 8 }} />
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-main)' }}>{stats?.totalDaysLost || 0}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Days Lost</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-secondary" onClick={() => navigate('/inventory')} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: '14px 16px' }}>
          <Package size={18} /> Manage Inventory
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/expiry')} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: '14px 16px' }}>
          <Clock size={18} /> Expiry Tracking
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/prescriptions')} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: '14px 16px' }}>
          <FileText size={18} /> Prescriptions
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/reports')} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: '14px 16px' }}>
          <FileText size={18} /> Reports
        </button>
      </div>

      {/* Pending Reviews */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '1.2rem', color: 'var(--text-main)' }}>Incidents Awaiting Your Review</h2>
        <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>These incidents have been confirmed by the manager on-site.</p>
      </div>

      {pendingIncidents.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <ClipboardCheck size={48} style={{ color: 'var(--accent)', marginBottom: 16 }} />
          <h3 style={{ margin: '0 0 8px', color: 'var(--text-main)' }}>No Pending Reviews</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>All manager-confirmed incidents have been reviewed.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {pendingIncidents.map(incident => {
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
                        background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)'
                      }}>
                        ✓ Manager Confirmed
                      </span>
                    </div>
                    <p style={{ margin: '0 0 10px', color: 'var(--text-main)', fontSize: '1rem', lineHeight: 1.5 }}>
                      {incident.description?.substring(0, 150)}{incident.description?.length > 150 ? '...' : ''}
                    </p>
                    {incident.managerConfirmation?.notes && (
                      <div style={{
                        background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.15)',
                        borderRadius: 8, padding: '10px 14px', marginBottom: 10, fontSize: '0.85rem'
                      }}>
                        <strong style={{ color: 'var(--accent)' }}>Manager Notes:</strong>{' '}
                        <span style={{ color: 'var(--text-main)' }}>{incident.managerConfirmation.notes}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <User size={14} /> {incident.injuredPerson?.name || 'Unknown'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={14} /> {incident.location}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={14} /> {new Date(incident.dateTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={() => navigate(`/incidents/${incident._id}`)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Eye size={16} /> Full Details
                    </button>
                    <button className="btn btn-primary" onClick={() => openReviewModal(incident)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Stethoscope size={16} /> Review
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowModal(false)}>
          <div className="card" style={{ maxWidth: 520, width: '90%', padding: '32px' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 4px', color: 'var(--text-main)', fontSize: '1.4rem' }}>Doctor Review</h2>
            <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Add your medical assessment for <strong>{selectedIncident?.incidentId}</strong>. This will resolve the incident.
            </p>
            {selectedIncident?.managerConfirmation?.notes && (
              <div style={{
                background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.15)',
                borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.85rem'
              }}>
                <strong style={{ color: 'var(--accent)' }}>Manager's On-Site Notes:</strong>{' '}
                <span style={{ color: 'var(--text-main)' }}>{selectedIncident.managerConfirmation.notes}</span>
              </div>
            )}
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: 'var(--text-main)', fontSize: '0.9rem' }}>
              Medical Assessment & Notes
            </label>
            <textarea
              value={reviewNotes}
              onChange={e => setReviewNotes(e.target.value)}
              placeholder="Diagnosis, treatment recommendations, follow-up required, inventory impact..."
              rows={5}
              style={{ width: '100%', marginBottom: 20 }}
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleReview} disabled={reviewingId}>
                {reviewingId ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></span> : <><CheckCircle size={16} /> Resolve Incident</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorDashboard;
