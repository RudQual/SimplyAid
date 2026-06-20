import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTreatment } from '../services/api';
import { ArrowLeft, User, Calendar, MapPin, Stethoscope, Pill, FileText } from 'lucide-react';
import './Treatments.css';

const TreatmentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [treatment, setTreatment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTreatment(id).then(res => setTreatment(res.data.data))
      .catch(() => navigate('/treatments'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-loader"><div className="spinner"></div></div>;
  if (!treatment) return null;

  return (
    <div className="page-content">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
          <div>
            <h1 className="page-title">{treatment.treatmentId}</h1>
            <p className="page-subtitle">Treatment Record Details</p>
          </div>
        </div>
        <span className={`badge badge-${treatment.injurySeverity}`}>{treatment.injurySeverity}</span>
      </div>

      <div className="treatment-detail-grid">
        <div>
          {/* Main Info */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 16 }}><User size={18} /> Patient Information</h3>
            <div className="detail-row"><span className="detail-label">Employee</span><span className="detail-value">{treatment.employee?.name || treatment.employeeName}</span></div>
            <div className="detail-row"><span className="detail-label">Employee ID</span><span className="detail-value">{treatment.employee?.employeeId || '—'}</span></div>
            <div className="detail-row"><span className="detail-label">Date</span><span className="detail-value">{new Date(treatment.treatmentDate).toLocaleDateString()}</span></div>
            <div className="detail-row"><span className="detail-label">Time</span><span className="detail-value">{treatment.treatmentTime || '—'}</span></div>
            <div className="detail-row"><span className="detail-label">Location</span><span className="detail-value">{treatment.treatmentLocation || '—'}</span></div>
          </div>

          {/* Treatment Info */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 16 }}><Stethoscope size={18} /> Treatment Details</h3>
            <div className="detail-row"><span className="detail-label">Injury Type</span><span className="detail-value">{treatment.injuryType || '—'}</span></div>
            <div className="detail-row"><span className="detail-label">Severity</span><span className="detail-value"><span className={`badge badge-${treatment.injurySeverity}`}>{treatment.injurySeverity}</span></span></div>
            <div className="detail-row"><span className="detail-label">Treatment</span><span className="detail-value">{treatment.treatmentProvided}</span></div>
            <div className="detail-row"><span className="detail-label">First Aider</span><span className="detail-value">{treatment.firstAider?.name || treatment.firstAiderName || '—'}</span></div>
            {treatment.firstAidBoxUsed && (
              <div className="detail-row"><span className="detail-label">Box Used</span><span className="detail-value">{treatment.firstAidBoxUsed.boxId} — {treatment.firstAidBoxUsed.location}</span></div>
            )}
            {treatment.incident && (
              <div className="detail-row"><span className="detail-label">Linked Incident</span><span className="detail-value" style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => navigate(`/incidents/${treatment.incident._id}`)}>{treatment.incident.incidentId}</span></div>
            )}
            {treatment.remarks && (
              <div className="detail-row"><span className="detail-label">Remarks</span><span className="detail-value">{treatment.remarks}</span></div>
            )}
          </div>
        </div>

        <div>
          {/* Medicines */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 16 }}><Pill size={18} /> Medicines Used</h3>
            {treatment.medicinesUsed?.length > 0 ? (
              treatment.medicinesUsed.map((med, i) => (
                <div key={i} className="detail-row">
                  <span className="detail-label">{med.name || med.item?.name || 'Item'}</span>
                  <span className="detail-value">Qty: {med.quantity}</span>
                </div>
              ))
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No medicines recorded</p>
            )}
          </div>

          {/* Meta */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 16 }}><FileText size={18} /> Record Info</h3>
            <div className="detail-row"><span className="detail-label">Created</span><span className="detail-value">{new Date(treatment.createdAt).toLocaleString()}</span></div>
            <div className="detail-row"><span className="detail-label">Updated</span><span className="detail-value">{new Date(treatment.updatedAt).toLocaleString()}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TreatmentDetail;
